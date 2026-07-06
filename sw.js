const CACHE_NAME = 'fitspot-v1';
const STATIC_ASSETS = [
  '/',
  '/index.html'
];

// Instalación — cachear assets básicos
self.addEventListener('install', function(e) {
  e.waitUntil(
    caches.open(CACHE_NAME).then(function(cache) {
      return cache.addAll(STATIC_ASSETS);
    })
  );
  self.skipWaiting();
});

// Activación — limpiar caches antiguas
self.addEventListener('activate', function(e) {
  e.waitUntil(
    caches.keys().then(function(keys) {
      return Promise.all(
        keys.filter(function(key) { return key !== CACHE_NAME; })
            .map(function(key) { return caches.delete(key); })
      );
    })
  );
  self.clients.claim();
});

// Fetch — network first, cache fallback
self.addEventListener('fetch', function(e) {
  // Solo cachear peticiones GET a nuestra propia web
  if (e.request.method !== 'GET') return;
  if (!e.request.url.startsWith(self.location.origin)) return;

  // Supabase y APIs externas — siempre red
  if (e.request.url.includes('supabase.co') ||
      e.request.url.includes('nominatim') ||
      e.request.url.includes('overpass') ||
      e.request.url.includes('openstreetmap')) return;

  e.respondWith(
    fetch(e.request).then(function(response) {
      // Guardar copia en cache si la respuesta es válida
      if (response && response.status === 200) {
        var clone = response.clone();
        caches.open(CACHE_NAME).then(function(cache) {
          cache.put(e.request, clone);
        });
      }
      return response;
    }).catch(function() {
      // Sin red — servir desde cache
      return caches.match(e.request).then(function(cached) {
        return cached || caches.match('/index.html');
      });
    })
  );
});

// ===== PUSH NOTIFICATIONS =====
self.addEventListener('push', function(e) {
  var data = e.data ? e.data.json() : {};
  var title = data.title || 'FitSpot';
  var options = {
    body: data.body || 'Tienes una nueva notificación',
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    vibrate: [100, 50, 100],
    data: { url: data.url || '/' },
    actions: [
      { action: 'open', title: 'Ver' },
      { action: 'close', title: 'Cerrar' }
    ]
  };
  e.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', function(e) {
  e.notification.close();
  var url = e.notification.data && e.notification.data.url || '/';
  e.waitUntil(clients.openWindow(url));
});
