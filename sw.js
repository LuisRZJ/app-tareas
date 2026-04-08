// sw.js — Service Worker para Daily Planner PWA
const CACHE_NAME = 'daily-planner-v1';

// Recursos del app shell que se cachean al instalar
const APP_SHELL = [
  '/',
  '/index.html',
  '/css/estilos.css',
  '/js/utilidades/categorias.js',
  '/js/utilidades/proyectos.js',
  '/js/utilidades/helpers.js',
  '/js/utilidades/markdown.js',
  '/js/utilidades/db.js',
  '/components/header.js',
  '/components/form.js',
  '/components/filters.js',
  '/components/taskSection.js',
  '/components/settings.js',
  '/components/projects.js',
  '/components/stats.js',
  '/js/app.js',
];

// Iconos se intentan cachear pero no bloquean la instalación
const ICONS = [
  '/icons/icono-app.png',
];

// ── Instalación ────────────────────────────────────────────────
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE_NAME).then(cache =>
      cache.addAll(APP_SHELL).then(() =>
        // Los iconos se cachean en paralelo; si fallan no se bloquea la instalación
        Promise.allSettled(ICONS.map(url => cache.add(url)))
      )
    )
  );
  self.skipWaiting();
});

// ── Activación: eliminar cachés antiguas ──────────────────────
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

// ── Interceptar peticiones ─────────────────────────────────────
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);

  // Peticiones a la API: siempre red primero, sin fallback de caché
  if (url.pathname.startsWith('/api/')) {
    e.respondWith(
      fetch(e.request).catch(() =>
        new Response(JSON.stringify({ error: 'Sin conexión' }), {
          status: 503,
          headers: { 'Content-Type': 'application/json' }
        })
      )
    );
    return;
  }

  // Recursos externos (Google Fonts, etc.): stale-while-revalidate
  if (url.origin !== location.origin) {
    e.respondWith(
      caches.open(CACHE_NAME).then(cache =>
        cache.match(e.request).then(cached => {
          const netFetch = fetch(e.request).then(res => {
            cache.put(e.request, res.clone());
            return res;
          });
          return cached || netFetch;
        })
      )
    );
    return;
  }

  // App shell: caché primero, red como fallback, luego index.html offline
  e.respondWith(
    caches.match(e.request).then(cached => {
      if (cached) return cached;
      return fetch(e.request).then(res => {
        const clone = res.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(e.request, clone));
        return res;
      });
    }).catch(() => caches.match('/index.html'))
  );
});
