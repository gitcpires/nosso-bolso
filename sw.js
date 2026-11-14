const CACHE_NAME = 'nosso-bolso-v2';

const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './painel.html',
  './script.js',
  './manifest.json',
  './icone-app.png'
];

// 1. Instalação: guarda os arquivos essenciais e ativa imediatamente
self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE).catch(() => {
        // Ignora falhas pontuais de cache inicial para não travar a instalação
      });
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

// 3. Interceptação (Estratégia Network-First): busca sempre a versão mais nova na rede
self.addEventListener('fetch', (event) => {
  // Ignora requisições externas de APIs (Firebase, CDNs, etc.) ou métodos diferentes de GET
  if (event.request.method !== 'GET' || !event.request.url.startsWith(self.location.origin)) {
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then((networkResponse) => {
        // Se conseguiu baixar da rede, atualiza o cache local com a versão nova
        if (networkResponse && networkResponse.status === 200) {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });
        }
        return networkResponse;
      })
      .catch(() => {
        // Se estiver offline, entrega o arquivo salvo no cache
        return caches.match(event.request);
      })
  );
});
