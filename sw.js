const CACHE_NAME = 'nosso-bolso-v3';

const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './painel.html',
  './script.js',
  './manifest.json',
  './icone-app.png'
];

// Domínios de bibliotecas visuais/scripts que precisamos guardar em cache para abrir offline
const EXTERNAL_CACHE_DOMAINS = [
  'cdn.tailwindcss.com',
  'cdnjs.cloudflare.com',
  'fonts.googleapis.com',
  'fonts.gstatic.com',
  'www.gstatic.com',
  'cdn.jsdelivr.net'
];

// 1. Instalação: guarda os arquivos essenciais e ativa imediatamente
self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE).catch(() => {});
    })
  );
});

// 2. Ativação: apaga caches antigos e assume o controle das abas abertas
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
          if (cache !== CACHE_NAME) {
            return caches.delete(cache);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// 3. Interceptação
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);
  const isLocal = url.origin === self.location.origin;
  const isExternalAsset = EXTERNAL_CACHE_DOMAINS.some(domain => url.hostname.includes(domain));

  // Ignora chamadas de API do Firebase/Firestore (o próprio SDK cuida do offline)
  if (!isLocal && !isExternalAsset) return;

  // Para arquivos locais: Network-First (sempre busca atualização, cai pro cache se offline)
  if (isLocal) {
    event.respondWith(
      fetch(event.request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const responseToCache = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, responseToCache));
          }
          return networkResponse;
        })
        .catch(() => caches.match(event.request))
    );
    return;
  }

  // Para bibliotecas externas (CDNs): Cache-First com atualização em segundo plano
  if (isExternalAsset) {
    event.respondWith(
      caches.match(event.request).then((cachedResponse) => {
        const fetchPromise = fetch(event.request).then((networkResponse) => {
          if (networkResponse && (networkResponse.status === 200 || networkResponse.type === 'opaque')) {
            const responseToCache = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, responseToCache));
          }
          return networkResponse;
        }).catch(() => cachedResponse);

        return cachedResponse || fetchPromise;
      })
    );
  }
});
