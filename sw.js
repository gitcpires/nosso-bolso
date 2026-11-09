// Alteramos a versão para v2 para forçar o cache a ser atualizado nos celulares
const CACHE_NAME = 'nossobolso-cache-v2'; 

// Lista de arquivos essenciais que o aplicativo precisa guardar offline
const urlsToCache = [
  './',
  './painel.html',
  './index.html', // Caso o seu login seja index.html
  './script.js',
  './manifest.json',
  './icone-app.png',
  './papel.jpg'
];

// Evento de Instalação (Guarda os novos arquivos)
self.addEventListener('install', event => {
  self.skipWaiting(); // Força o novo Service Worker a assumir o controle imediatamente
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Cache aberto e arquivos guardados');
        return cache.addAll(urlsToCache);
      })
  );
});

// Evento de Ativação (Apaga a versão antiga do cache)
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          // Se o nome do cache antigo for diferente do novo (v2), ele apaga
          if (cacheName !== CACHE_NAME) {
            console.log('Apagando cache antigo:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim()) // Atualiza todas as abas abertas no celular
  );
});

// Evento Fetch (Tenta buscar na rede primeiro, se falhar ou demorar, usa o cache)
self.addEventListener('fetch', event => {
  event.respondWith(
    fetch(event.request)
      .then(response => {
        // Se a rede funcionar, guarda a versão mais recente no cache
        if (!response || response.status !== 200 || response.type !== 'basic') {
          return response;
        }
        var responseToCache = response.clone();
        caches.open(CACHE_NAME)
          .then(cache => {
            cache.put(event.request, responseToCache);
          });
        return response;
      })
      .catch(() => {
        // Se estiver offline, puxa do cache
        return caches.match(event.request);
      })
  );
});
