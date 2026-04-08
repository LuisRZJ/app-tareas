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

// ── Helpers ───────────────────────────────────────────────────
function putInCache(request, response) {
  if (response && response.ok && response.type !== 'opaque') {
    caches.open(CACHE_NAME).then(cache => cache.put(request, response));
  }
}

// Estrategia: red primero, caché como fallback
async function networkFirst(request, fallbackUrl) {
  try {
    const res = await fetch(request);
    putInCache(request, res.clone());
    return res;
  } catch {
    const cached = await caches.match(request);
    if (cached) return cached;
    if (fallbackUrl) return caches.match(fallbackUrl);
    return new Response('Sin conexión', { status: 503 });
  }
}

// Estrategia: stale-while-revalidate
// Devuelve caché inmediatamente (si existe) y actualiza en segundo plano
async function staleWhileRevalidate(request) {
  const cache  = await caches.open(CACHE_NAME);
  const cached = await cache.match(request);
  // Lanzar actualización en paralelo siempre, sin await
  const networkPromise = fetch(request).then(res => {
    putInCache(request, res.clone());
    return res;
  }).catch(() => null);
  return cached || await networkPromise;
}

// ── Interceptar peticiones ─────────────────────────────────────
self.addEventListener('fetch', e => {
  // Solo GET; dejar pasar el resto sin interferir
  if (e.request.method !== 'GET') return;

  const url = new URL(e.request.url);

  // Peticiones a la API: siempre red, respuesta de error JSON si no hay red
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

  // Recursos externos (Google Fonts, CDNs): stale-while-revalidate
  // Se sirve lo cacheado al instante y se actualiza silenciosamente en paralelo
  if (url.origin !== location.origin) {
    e.respondWith(staleWhileRevalidate(e.request));
    return;
  }

  // App shell y recursos propios: red primero, caché como fallback offline
  // Si hay red → siempre se obtiene la versión más reciente y se actualiza la caché
  // Si no hay red → se sirve lo cacheado; si tampoco hay caché, index.html
  e.respondWith(networkFirst(e.request, '/index.html'));
});
