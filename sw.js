self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open('nosso-bolso-cache').then((cache) => {
      return cache.addAll([
        'painel.html',
        'script.js',
        'icone-app.png'
      ]);
    })
  );
});

self.addEventListener('fetch', (e) => {
  e.respondWith(
    caches.match(e.request).then((response) => {
      return response || fetch(e.request);
    })
  );
});
