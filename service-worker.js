// BarberStylo - Service Worker atualizado
// Evita que o aplicativo instalado fique preso em versões antigas.

const CACHE_NAME = "barberstylo-v4";
const STATIC_CACHE = "barberstylo-static-v4";

const APP_SHELL = [
  "./",
  "./manifest.json",
  "./logo.png",
  "./icon-192.png",
  "./icon-512.png"
];

// Instala a nova versão imediatamente
self.addEventListener("install", event => {
  self.skipWaiting();

  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then(cache => cache.addAll(APP_SHELL))
      .catch(() => Promise.resolve())
  );
});

// Apaga caches antigos
self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys
          .filter(key => ![CACHE_NAME, STATIC_CACHE].includes(key))
          .map(key => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

// Para páginas e index.html: tenta SEMPRE pegar a versão nova primeiro
async function networkFirstNavigation(request) {
  try {
    const response = await fetch(request, { cache: "no-store" });

    if (response && response.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put("./index.html", response.clone());
    }

    return response;
  } catch (error) {
    const cachedIndex =
      await caches.match("./index.html") ||
      await caches.match("./") ||
      await caches.match(request);

    if (cachedIndex) return cachedIndex;

    throw error;
  }
}

// Arquivos estáticos: usa cache, mas procura atualização
async function staleWhileRevalidate(request) {
  const cached = await caches.match(request);

  const fetchPromise = fetch(request)
    .then(async response => {
      if (response && response.ok) {
        const cache = await caches.open(STATIC_CACHE);
        cache.put(request, response.clone());
      }

      return response;
    })
    .catch(() => null);

  return cached || fetchPromise;
}

self.addEventListener("fetch", event => {
  const request = event.request;

  if (request.method !== "GET") return;

  const url = new URL(request.url);

  // Não interfere em Supabase, WhatsApp ou sites externos
  if (url.origin !== self.location.origin) return;

  const isNavigation =
    request.mode === "navigate" ||
    request.destination === "document" ||
    url.pathname.endsWith("/index.html") ||
    url.pathname.endsWith("/barberstylo-app/");

  if (isNavigation) {
    event.respondWith(networkFirstNavigation(request));
    return;
  }

  event.respondWith(staleWhileRevalidate(request));
});

// Permite forçar atualização do aplicativo futuramente
self.addEventListener("message", event => {
  if (event.data === "SKIP_WAITING") {
    self.skipWaiting();
  }

  if (event.data === "CLEAR_APP_CACHE") {
    event.waitUntil(
      caches.keys().then(keys =>
        Promise.all(keys.map(key => caches.delete(key)))
      )
    );
  }
});
