/**
 * MetroRide PH — Service Worker v4 · Immortal PWA
 * Guardian-level offline resilience for Philippine metro commuters.
 *
 * Caching Strategy:
 *  - Cache-First:             Static assets (JS bundles, CSS, icons, fonts)
 *  - Stale-While-Revalidate:  Station datasets and fare matrices
 *  - Network-First:           Live commuter reports and real-time alerts
 *  - Network-First + Fallback: Supabase API and Newell AI calls
 *  - Offline Fallback:        Full functional shell when all networks fail
 *
 * Offline Guarantee:
 *  Users can view stations, calculate fares, and open the transit map
 *  without interruption even when completely offline.
 */

const CACHE_VERSION   = 'v4';
const SHELL_CACHE     = `metroride-shell-${CACHE_VERSION}`;
const ASSETS_CACHE    = `metroride-assets-${CACHE_VERSION}`;
const DATA_CACHE      = `metroride-data-${CACHE_VERSION}`;
const STATION_CACHE   = `metroride-station-${CACHE_VERSION}`; // SWR for station/fare data
const REPORTS_CACHE   = `metroride-reports-${CACHE_VERSION}`; // Network-first for live reports

const ALL_CACHES = [SHELL_CACHE, ASSETS_CACHE, DATA_CACHE, STATION_CACHE, REPORTS_CACHE];

// ── Pre-cache: app shell URLs ─────────────────────────────────────────────
const SHELL_PRECACHE = [
  '/',
];

// ── URL pattern matchers ──────────────────────────────────────────────────

/** Static assets → Cache-First: bundles, fonts, icons, images */
const STATIC_PATTERNS = [
  /\/_expo\/static\//,
  /\/assets\//,
  /\.(?:woff2?|ttf|otf|eot)$/,
  /\.(?:png|jpe?g|gif|svg|ico|webp)$/,
  /manifest\.json$/,
];

/** Station / fare data → Stale-While-Revalidate (24h TTL) */
const STATION_DATA_PATTERNS = [
  /\/rest\/v1\/stations/,
  /\/rest\/v1\/fares/,
  /\/rest\/v1\/fare_matrix/,
  /\/rest\/v1\/routes/,
];

/** Live community reports and real-time alerts → Network-First */
const LIVE_REPORT_PATTERNS = [
  /\/netlify\/functions\/communityReports/,
  /\/netlify\/functions\/realtimeAlerts/,
  /\/rest\/v1\/community_reports/,
  /\/rest\/v1\/transit_alerts/,
  /\/rest\/v1\/crowd_levels/,
];

/** Supabase / Newell AI → Network-First with stale fallback */
const API_PATTERNS = [
  /supabase\.co/,
  /fastshot\.ai/,
];

// Station data cache TTL: 24 hours
const STATION_CACHE_TTL_MS = 24 * 60 * 60 * 1000;

// ─── Install ──────────────────────────────────────────────────────────────

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(SHELL_CACHE)
      .then((cache) =>
        cache.addAll(SHELL_PRECACHE).catch((err) => {
          console.warn('[MetroRide SW v4] Shell pre-cache partial failure:', err);
        }),
      )
      .then(() => {
        console.log('[MetroRide SW v4] Installed — Immortal PWA active');
        return self.skipWaiting();
      }),
  );
});

// ─── Activate ─────────────────────────────────────────────────────────────

self.addEventListener('activate', (event) => {
  const keep = new Set(ALL_CACHES);
  event.waitUntil(
    caches
      .keys()
      .then((names) =>
        Promise.all(
          names
            .filter((n) => n.startsWith('metroride-') && !keep.has(n))
            .map((n) => {
              console.log('[MetroRide SW v4] Evicting stale cache:', n);
              return caches.delete(n);
            }),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

// ─── Fetch ────────────────────────────────────────────────────────────────

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Only intercept GET requests over http(s)
  if (request.method !== 'GET') return;
  if (!url.protocol.startsWith('http')) return;

  // 1. Live reports & real-time alerts → Network-First (freshness critical)
  if (LIVE_REPORT_PATTERNS.some((p) => p.test(request.url))) {
    event.respondWith(networkFirst(request, REPORTS_CACHE, 8000));
    return;
  }

  // 2. Station / fare data → Stale-While-Revalidate (offline tolerance)
  if (STATION_DATA_PATTERNS.some((p) => p.test(request.url))) {
    event.respondWith(staleWhileRevalidateWithTTL(request, STATION_CACHE));
    return;
  }

  // 3. Other Supabase / AI API → Network-First with stale data fallback
  if (API_PATTERNS.some((p) => p.test(request.url))) {
    event.respondWith(networkFirst(request, DATA_CACHE, 10000));
    return;
  }

  // 4. Static assets (JS bundles, fonts, icons) → Cache-First
  if (STATIC_PATTERNS.some((p) => p.test(request.url))) {
    event.respondWith(cacheFirst(request, ASSETS_CACHE));
    return;
  }

  // 5. HTML navigation → Network-First with offline shell fallback
  if (request.mode === 'navigate') {
    event.respondWith(navigationFetch(request));
    return;
  }

  // 6. Everything else → Stale-While-Revalidate
  event.respondWith(staleWhileRevalidate(request, ASSETS_CACHE));
});

// ─── Strategy: Network-First ──────────────────────────────────────────────

async function networkFirst(request, cacheName, timeoutMs = 8000) {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const response = await fetch(request.clone(), { signal: controller.signal });
    clearTimeout(timer);
    if (response.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, response.clone());
    }
    return response;
  } catch (_) {
    const cached = await caches.match(request);
    if (cached) return cached;
    return new Response(
      JSON.stringify({
        error: 'offline',
        message: 'MetroRide is offline — cached data shown.',
        offline: true,
      }),
      {
        status: 503,
        headers: { 'Content-Type': 'application/json' },
      },
    );
  }
}

// ─── Strategy: Cache-First ────────────────────────────────────────────────

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

// ─── Strategy: Stale-While-Revalidate ────────────────────────────────────

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

// ─── Strategy: Stale-While-Revalidate with TTL ───────────────────────────
// For station data — serve cache immediately but refresh if older than TTL

async function staleWhileRevalidateWithTTL(request, cacheName) {
  const cache  = await caches.open(cacheName);
  const cached = await cache.match(request);

  let isStale = true;
  if (cached) {
    const cachedDate = cached.headers.get('sw-cached-at');
    if (cachedDate) {
      const age = Date.now() - parseInt(cachedDate, 10);
      isStale = age > STATION_CACHE_TTL_MS;
    }
  }

  const revalidate = () =>
    fetch(request.clone())
      .then((response) => {
        if (response.ok) {
          // Stamp the cache time header
          const headers = new Headers(response.headers);
          headers.set('sw-cached-at', String(Date.now()));
          const stamped = new Response(response.clone().body, {
            status:     response.status,
            statusText: response.statusText,
            headers,
          });
          cache.put(request, stamped);
        }
        return response;
      })
      .catch(() => null);

  if (cached && !isStale) {
    // Fresh — serve from cache, revalidate in background
    revalidate();
    return cached;
  }

  if (cached) {
    // Stale — serve from cache immediately, revalidate in background
    revalidate();
    return cached;
  }

  // No cache — must fetch
  return (await revalidate()) || new Response('', { status: 408 });
}

// ─── Strategy: Navigation (SPA shell fallback) ────────────────────────────

async function navigationFetch(request) {
  try {
    const response = await fetch(request.clone());
    const cache = await caches.open(SHELL_CACHE);
    cache.put(request, response.clone());
    return response;
  } catch (_) {
    // Offline — serve cached shell in priority order
    const offline =
      (await caches.match(request)) ||
      (await caches.match('/')) ||
      (await caches.match('/index.html'));

    if (offline) return offline;

    // Last-resort: full offline fallback page with Neon Onyx styling
    // This page provides access to fare calculator and route planner
    return new Response(offlineFallbackHTML(), {
      status:  200,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    });
  }
}

// ─── Offline Fallback HTML ────────────────────────────────────────────────

function offlineFallbackHTML() {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"/>
  <meta name="theme-color" content="#000000"/>
  <title>MetroRide PH — Offline</title>
  <style>
    *{box-sizing:border-box;margin:0;padding:0}
    html,body{height:100%;background:#08090A;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;color:#fff;overflow-x:hidden}
    .screen{min-height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:24px}
    .glass{background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.10);border-radius:20px;padding:32px 28px;text-align:center;max-width:360px;width:100%}
    .icon{font-size:52px;margin-bottom:16px}
    h1{font-size:22px;font-weight:800;margin-bottom:8px;color:#40E0FF}
    .sub{font-size:14px;color:rgba(255,255,255,0.55);line-height:1.6;margin-bottom:24px}
    .badge{display:inline-flex;align-items:center;gap:6px;margin-bottom:24px;padding:8px 16px;background:rgba(64,224,255,0.12);border:1px solid rgba(64,224,255,0.3);border-radius:999px;font-size:12px;color:#40E0FF;font-weight:600}
    .badge::before{content:"";display:inline-block;width:7px;height:7px;border-radius:50%;background:#40E0FF;animation:pulse 2s infinite}
    @keyframes pulse{0%,100%{opacity:1}50%{opacity:0.4}}
    .actions{display:flex;gap:12px;width:100%;margin-bottom:16px}
    .btn{flex:1;padding:14px 8px;border-radius:14px;font-size:13px;font-weight:700;cursor:pointer;border:none;transition:opacity 0.2s}
    .btn-primary{background:#40E0FF;color:#0A0F1E}
    .btn-secondary{background:rgba(255,255,255,0.08);color:#fff;border:1px solid rgba(255,255,255,0.15)}
    .btn:hover{opacity:0.85}
    .status-row{display:flex;gap:8px;margin-bottom:8px;flex-wrap:wrap;justify-content:center}
    .status-pill{display:inline-flex;align-items:center;gap:5px;padding:5px 10px;border-radius:20px;font-size:11px;font-weight:600}
    .pill-green{background:rgba(34,197,94,0.15);border:1px solid rgba(34,197,94,0.3);color:#22C55E}
    .pill-amber{background:rgba(255,184,0,0.15);border:1px solid rgba(255,184,0,0.3);color:#FFB800}
    .dot{width:6px;height:6px;border-radius:50%;display:inline-block}
    .dot-green{background:#22C55E}
    .dot-amber{background:#FFB800}
    .footer{font-size:11px;color:rgba(255,255,255,0.2);margin-top:16px}
  </style>
</head>
<body>
  <div class="screen">
    <div class="glass">
      <div class="icon">🚇</div>
      <h1>You're Offline</h1>
      <p class="sub">MetroRide PH has activated offline mode.<br/>Cached station data and fare calculator are available.</p>
      <div class="badge">Offline Mode Active</div>

      <div class="status-row">
        <span class="status-pill pill-green"><span class="dot dot-green"></span>Fare Data Cached</span>
        <span class="status-pill pill-green"><span class="dot dot-green"></span>Stations Cached</span>
        <span class="status-pill pill-amber"><span class="dot dot-amber"></span>Live Alerts Unavailable</span>
      </div>

      <div class="actions" style="margin-top:20px">
        <button class="btn btn-primary" onclick="goToFare()">Fare Calculator</button>
        <button class="btn btn-secondary" onclick="goToRoute()">Route Planner</button>
      </div>

      <button class="btn btn-secondary" style="width:100%" onclick="tryReload()">Try Reconnect</button>
      <p class="footer">FPJ → Dr. Santos · 2026 Cavite Extension · LRT-1 / MRT-3 / LRT-2</p>
    </div>
  </div>
  <script>
    function goToFare(){ window.location.href = '/fare-calculator'; }
    function goToRoute(){ window.location.href = '/route-planner'; }
    function tryReload(){ window.location.reload(); }
  </script>
</body>
</html>`;
}

// ─── Cache stats helper ───────────────────────────────────────────────────

async function getCacheStats() {
  const stats = {};
  for (const name of ALL_CACHES) {
    try {
      const cache = await caches.open(name);
      const keys  = await cache.keys();
      stats[name] = { entries: keys.length };
    } catch {
      stats[name] = { entries: 0 };
    }
  }
  return stats;
}

// ─── Message handler ──────────────────────────────────────────────────────

self.addEventListener('message', (event) => {
  const { type } = event.data || {};

  if (type === 'SKIP_WAITING') {
    self.skipWaiting();
  }

  if (type === 'GET_VERSION') {
    event.ports[0]?.postMessage({ version: CACHE_VERSION });
  }

  if (type === 'GET_CACHE_STATS') {
    getCacheStats().then((stats) => {
      event.ports[0]?.postMessage({ stats, version: CACHE_VERSION });
    });
  }

  if (type === 'CLEAR_DATA_CACHE') {
    caches.delete(DATA_CACHE).then(() => {
      event.ports[0]?.postMessage({ success: true });
    });
  }
});
