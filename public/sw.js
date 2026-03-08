/**
 * MetroRide PH — Service Worker
 * Neon Onyx Ultra-Dark PWA — Offline Resilience Layer
 *
 * Caching Strategy:
 *  - App Shell (HTML + JS + CSS): Network-first, cache fallback
 *  - Static Assets (fonts, icons, images): Cache-first, network fallback
 *  - Supabase API calls: Network-first with stale data fallback
 *  - Community Reports UI: Cached for offline viewing
 */

const CACHE_VERSION = 'v1';
const SHELL_CACHE    = `metroride-shell-${CACHE_VERSION}`;
const ASSETS_CACHE   = `metroride-assets-${CACHE_VERSION}`;
const DATA_CACHE     = `metroride-data-${CACHE_VERSION}`;

/** URLs that form the app shell — cached on install */
const SHELL_PRECACHE = [
  '/',
];

/** URL patterns treated as static assets → cache-first */
const STATIC_PATTERNS = [
  /\/_expo\/static\//,
  /\/assets\//,
  /\.(?:woff2?|ttf|otf|eot)$/,
  /\.(?:png|jpe?g|gif|svg|ico|webp)$/,
  /manifest\.json$/,
];

/** Supabase / API patterns → network-first, stale fallback */
const API_PATTERNS = [
  /supabase\.co/,
  /fastshot\.ai/,
];

// ─── Install ──────────────────────────────────────────────────────────────────

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(SHELL_CACHE)
      .then((cache) =>
        cache.addAll(SHELL_PRECACHE).catch((err) => {
          console.warn('[MetroRide SW] Shell pre-cache partial failure:', err);
        })
      )
      .then(() => self.skipWaiting())
  );
});

// ─── Activate ─────────────────────────────────────────────────────────────────

self.addEventListener('activate', (event) => {
  const keepCaches = new Set([SHELL_CACHE, ASSETS_CACHE, DATA_CACHE]);
  event.waitUntil(
    caches
      .keys()
      .then((names) =>
        Promise.all(
          names
            .filter((n) => n.startsWith('metroride-') && !keepCaches.has(n))
            .map((n) => {
              console.log('[MetroRide SW] Deleting stale cache:', n);
              return caches.delete(n);
            })
        )
      )
      .then(() => self.clients.claim())
  );
});

// ─── Fetch ────────────────────────────────────────────────────────────────────

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Only intercept GET requests over http(s)
  if (request.method !== 'GET') return;
  if (!url.protocol.startsWith('http')) return;

  // Supabase / external API → network-first
  if (API_PATTERNS.some((p) => p.test(request.url))) {
    event.respondWith(networkFirst(request, DATA_CACHE));
    return;
  }

  // Static assets (fonts, images, JS bundles) → cache-first
  if (STATIC_PATTERNS.some((p) => p.test(request.url))) {
    event.respondWith(cacheFirst(request, ASSETS_CACHE));
    return;
  }

  // HTML navigation → network-first with offline shell fallback
  if (request.mode === 'navigate') {
    event.respondWith(navigationFetch(request));
    return;
  }

  // Everything else → stale-while-revalidate
  event.respondWith(staleWhileRevalidate(request, ASSETS_CACHE));
});

// ─── Strategies ───────────────────────────────────────────────────────────────

/** Network first — ideal for API data that may be stale */
async function networkFirst(request, cacheName) {
  try {
    const response = await fetch(request.clone());
    if (response.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, response.clone());
    }
    return response;
  } catch (_) {
    const cached = await caches.match(request);
    if (cached) return cached;
    // Return a minimal JSON error for API calls so the app degrades gracefully
    return new Response(
      JSON.stringify({ error: 'offline', message: 'MetroRide is offline — showing cached data.' }),
      { status: 503, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

/** Cache first — ideal for static assets that rarely change */
async function cacheFirst(request, cacheName) {
  const cached = await caches.match(request);
  if (cached) return cached;
  try {
    const response = await fetch(request.clone());
    if (response.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, response.clone());
    }
    return response;
  } catch (_) {
    return new Response('', { status: 408, statusText: 'Asset unavailable offline' });
  }
}

/** Navigation fetch — serve shell for offline SPA routing */
async function navigationFetch(request) {
  try {
    const response = await fetch(request.clone());
    // Update shell cache on successful navigation
    const cache = await caches.open(SHELL_CACHE);
    cache.put(request, response.clone());
    return response;
  } catch (_) {
    // Offline — return cached shell in priority order
    const offline =
      (await caches.match(request)) ||
      (await caches.match('/')) ||
      (await caches.match('/index.html'));

    if (offline) return offline;

    // Last-resort minimal offline page matching Neon Onyx theme
    return new Response(
      `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"/>
  <meta name="theme-color" content="#000000"/>
  <title>MetroRide PH — Offline</title>
  <style>
    *{box-sizing:border-box;margin:0;padding:0}
    html,body{height:100%;background:#08090A;display:flex;align-items:center;justify-content:center;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;color:#fff}
    .card{background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.10);border-radius:20px;padding:32px 28px;text-align:center;max-width:320px}
    .icon{font-size:48px;margin-bottom:16px}
    h1{font-size:20px;font-weight:700;margin-bottom:8px;color:#40E0FF}
    p{font-size:14px;color:#64748B;line-height:1.6}
    .badge{display:inline-block;margin-top:16px;padding:6px 16px;background:rgba(64,224,255,0.12);border:1px solid rgba(64,224,255,0.3);border-radius:999px;font-size:12px;color:#40E0FF}
  </style>
</head>
<body>
  <div class="card">
    <div class="icon">🚇</div>
    <h1>You're Offline</h1>
    <p>MetroRide PH is waiting for a connection. Your cached data is ready when you reconnect.</p>
    <span class="badge">North Avenue → Taft Avenue</span>
  </div>
</body>
</html>`,
      { status: 200, headers: { 'Content-Type': 'text/html; charset=utf-8' } }
    );
  }
}

/** Stale-while-revalidate — best for resources that update occasionally */
async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);

  const fetchPromise = fetch(request.clone())
    .then((response) => {
      if (response.ok) cache.put(request, response.clone());
      return response;
    })
    .catch(() => null);

  return cached || (await fetchPromise) || new Response('', { status: 408 });
}

// ─── Background Sync message handler ─────────────────────────────────────────

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  if (event.data && event.data.type === 'GET_VERSION') {
    event.ports[0].postMessage({ version: CACHE_VERSION });
  }
});
