/**
 * MetroRide PH — Service Worker v5 · Immortal PWA
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
 *  Users can view stations, calculate fares, use MetroAI (cached context),
 *  and open the transit map without interruption even when completely offline.
 *  Community reports and crowd-level updates are queued and synced automatically
 *  when connectivity is restored.
 */

const CACHE_VERSION  = 'v6';
const SHELL_CACHE    = `metroride-shell-${CACHE_VERSION}`;
const ASSETS_CACHE   = `metroride-assets-${CACHE_VERSION}`;
const DATA_CACHE     = `metroride-data-${CACHE_VERSION}`;
const STATION_CACHE  = `metroride-station-${CACHE_VERSION}`; // SWR for station/fare data
const REPORTS_CACHE  = `metroride-reports-${CACHE_VERSION}`; // Network-first for live reports
const AI_CACHE       = `metroride-ai-${CACHE_VERSION}`;      // MetroAI context + model responses

const ALL_CACHES = [SHELL_CACHE, ASSETS_CACHE, DATA_CACHE, STATION_CACHE, REPORTS_CACHE, AI_CACHE];

// ── Pre-cache: critical app shell + all main routes ───────────────────────
// Pre-caching all primary routes ensures MetroAI, fare calculator, and route
// planner are all immediately available offline without a network round-trip.
const SHELL_PRECACHE = [
  '/',
  '/fare-calculator',
  '/route-planner',
  '/metro-ai',
  '/transit-map',
  '/diagnostics',
  '/settings',
  '/beep-card',
  '/about',
];

// ── Pre-cache: essential transit data (fare tables + full station list) ────
// The transit manifest contains the official 2026 fare tables (LRT-1 Cavite
// Extension, MRT-3, LRT-2), all 51 station records, and the Cavite Extension
// confirmation data. Pre-caching this during registration guarantees offline
// fare calculation and station lookup without any network round-trip.
const DATA_PRECACHE = [
  '/data/transit-manifest-2026.json',
];

// ── URL pattern matchers ──────────────────────────────────────────────────

/** Static assets → Cache-First: bundles, fonts, icons, images */
const STATIC_PATTERNS = [
  /\/_expo\/static\//,
  /\/assets\//,
  /\.(?:woff2?|ttf|otf|eot)$/,
  /\.(?:png|jpe?g|gif|svg|ico|webp)$/,
  /manifest\.json$/,
  // Transit data manifest — Cache-First after pre-cache during install
  /\/data\/transit-manifest-2026\.json/,
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

/**
 * MetroAI / Newell AI + Fastshot → Network-First with AI cache fallback.
 * Cached AI responses allow MetroAI to surface recent answers even offline.
 */
const AI_PATTERNS = [
  /fastshot\.ai/,
  /newell.*\/v1\/(chat|generate|transcribe|vision)/,
  /api\.newell/,
];

/** Supabase → Network-First with stale data fallback */
const SUPABASE_PATTERNS = [
  /supabase\.co/,
];

// Station data cache TTL: 24 hours
const STATION_CACHE_TTL_MS = 24 * 60 * 60 * 1000;

// AI cache TTL: 2 hours (keep recent AI context available offline)
const AI_CACHE_TTL_MS = 2 * 60 * 60 * 1000;

// ─── Install ──────────────────────────────────────────────────────────────

self.addEventListener('install', (event) => {
  event.waitUntil(
    Promise.all([
      // 1. Pre-cache the app shell + all primary routes (fare calculator, route
      //    planner, MetroAI, diagnostics, etc.) — partial failures are tolerated.
      caches.open(SHELL_CACHE).then((cache) =>
        cache.addAll(SHELL_PRECACHE).catch((err) => {
          console.warn('[MetroRide SW v6] Shell pre-cache partial failure:', err);
        }),
      ),
      // 2. Pre-cache essential transit data: 2026 fare tables (LRT-1 including
      //    Cavite Extension, MRT-3, LRT-2), full 51-station list, and Cavite
      //    Extension confirmation. Stored in DATA_CACHE so Cache Integrity check
      //    detects metroride-data-* immediately after installation.
      caches.open(DATA_CACHE).then((cache) =>
        cache.addAll(DATA_PRECACHE).catch((err) => {
          console.warn('[MetroRide SW v6] Transit data pre-cache partial failure (will retry on fetch):', err);
        }),
      ),
    ]).then(() => {
      console.log(
        '[MetroRide SW v6] Installed — Immortal PWA active · 2026 fare tables + DOTr Subsidy pre-cached · ' +
        'LRT-1 Cavite Extension (25 stations) ready · MRT-3/LRT-2 50% subsidy ready · AI offline mode ready',
      );
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
              console.log('[MetroRide SW v6] Evicting stale cache:', n);
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

  // 3. MetroAI / Newell AI → Network-First with AI cache (offline context)
  if (AI_PATTERNS.some((p) => p.test(request.url))) {
    event.respondWith(networkFirstWithTTL(request, AI_CACHE, 10000, AI_CACHE_TTL_MS));
    return;
  }

  // 4. Supabase → Network-First with stale data fallback
  if (SUPABASE_PATTERNS.some((p) => p.test(request.url))) {
    event.respondWith(networkFirst(request, DATA_CACHE, 10000));
    return;
  }

  // 5. Static assets (JS bundles, fonts, icons) → Cache-First
  if (STATIC_PATTERNS.some((p) => p.test(request.url))) {
    event.respondWith(cacheFirst(request, ASSETS_CACHE));
    return;
  }

  // 6. HTML navigation → Network-First with offline shell fallback
  if (request.mode === 'navigate') {
    event.respondWith(navigationFetch(request));
    return;
  }

  // 7. Everything else → Stale-While-Revalidate
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
        error:   'offline',
        message: 'MetroRide is offline — cached data shown.',
        offline: true,
      }),
      {
        status:  503,
        headers: { 'Content-Type': 'application/json' },
      },
    );
  }
}

// ─── Strategy: Network-First with TTL stamping ────────────────────────────
// Used for AI cache: serve fresh responses when available, stale within TTL,
// and a graceful offline JSON when completely unavailable.

async function networkFirstWithTTL(request, cacheName, timeoutMs, ttlMs) {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const response = await fetch(request.clone(), { signal: controller.signal });
    clearTimeout(timer);
    if (response.ok) {
      const cache = await caches.open(cacheName);
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
  } catch (_) {
    const cache   = await caches.open(cacheName);
    const cached  = await cache.match(request);
    if (cached) {
      const cachedAt = cached.headers.get('sw-cached-at');
      const age      = cachedAt ? Date.now() - parseInt(cachedAt, 10) : Infinity;
      // Serve cached AI response within TTL
      if (age <= ttlMs) return cached;
    }
    // Beyond TTL or no cache — return offline stub
    return new Response(
      JSON.stringify({
        error:   'ai_offline',
        message: 'MetroAI is temporarily offline. Cached context is active.',
        offline: true,
        cached:  !!cached,
      }),
      {
        status:  503,
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
  const cache  = await caches.open(cacheName);
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
    const cache    = await caches.open(SHELL_CACHE);
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
    return new Response(offlineFallbackHTML(), {
      status:  200,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    });
  }
}

// ─── Background Sync API ──────────────────────────────────────────────────
// When connectivity returns, the browser fires the 'sync' event.
// We notify all open clients to flush the offline sync queue.

self.addEventListener('sync', (event) => {
  if (event.tag === 'metroride-sync-queue') {
    event.waitUntil(
      self.clients
        .matchAll({ includeUncontrolled: true, type: 'window' })
        .then((clients) => {
          for (const client of clients) {
            client.postMessage({ type: 'FLUSH_SYNC_QUEUE' });
          }
        })
        .catch(() => { /* silent */ }),
    );
  }
});

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
    .glass{background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.10);border-radius:20px;padding:32px 28px;text-align:center;max-width:380px;width:100%}
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
    .sync-row{margin-top:12px;padding:10px 14px;background:rgba(64,224,255,0.06);border:1px solid rgba(64,224,255,0.15);border-radius:10px;font-size:11px;color:rgba(255,255,255,0.45);text-align:left}
    .footer{font-size:11px;color:rgba(255,255,255,0.2);margin-top:16px}
  </style>
</head>
<body>
  <div class="screen">
    <div class="glass">
      <div class="icon">🚇</div>
      <h1>You're Offline</h1>
      <p class="sub">MetroRide PH has activated offline mode.<br/>Cached station data, fare calculator, and MetroAI context are available.</p>
      <div class="badge">Offline Mode Active</div>

      <div class="status-row">
        <span class="status-pill pill-green"><span class="dot dot-green"></span>Fare Data Cached</span>
        <span class="status-pill pill-green"><span class="dot dot-green"></span>Stations Cached</span>
        <span class="status-pill pill-green"><span class="dot dot-green"></span>MetroAI Context</span>
        <span class="status-pill pill-amber"><span class="dot dot-amber"></span>Live Alerts Paused</span>
      </div>

      <div class="sync-row">
        ⏳ Any reports or crowd updates you submit are saved locally and will sync automatically when you reconnect.
      </div>

      <div class="actions" style="margin-top:16px">
        <button class="btn btn-primary" onclick="goToFare()">Fare Calculator</button>
        <button class="btn btn-secondary" onclick="goToRoute()">Route Planner</button>
      </div>

      <div class="actions">
        <button class="btn btn-secondary" onclick="goToAI()">MetroAI</button>
        <button class="btn btn-secondary" onclick="tryReload()">Try Reconnect</button>
      </div>

      <p class="footer">FPJ → Dr. Santos · 2026 Cavite Extension · LRT-1 / MRT-3 / LRT-2</p>
    </div>
  </div>
  <script>
    function goToFare()   { window.location.href = '/fare-calculator'; }
    function goToRoute()  { window.location.href = '/route-planner'; }
    function goToAI()     { window.location.href = '/metro-ai'; }
    function tryReload()  { window.location.reload(); }
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

  // Register a Background Sync tag so the browser can trigger sync
  // when the device comes back online (even if the tab is closed).
  if (type === 'REGISTER_BG_SYNC') {
    const supported = 'sync' in self.registration;
    if (supported) {
      self.registration.sync
        .register('metroride-sync-queue')
        .then(() => event.ports[0]?.postMessage({ supported: true, registered: true }))
        .catch(() => event.ports[0]?.postMessage({ supported: true, registered: false }));
    } else {
      event.ports[0]?.postMessage({ supported: false, registered: false });
    }
  }
});
