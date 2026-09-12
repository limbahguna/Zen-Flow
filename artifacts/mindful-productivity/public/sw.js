const CACHE_NAME = "mindful-space-v7";
const STATIC_CACHE = "mindful-static-v7";
const OFFLINE_URL = "/offline.html";

// App shell assets to pre-cache on install
const PRECACHE_URLS = [
  "/",
  "/offline.html",
  "/manifest.json",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/favicon.svg",
  "/movements/shoulder-rolls.webp",
  "/movements/neck-stretch.webp",
  "/movements/stand-and-walk.webp",
  "/movements/back-stretch.webp",
  "/movements/slow-cooldown.webp",
];

// Patterns that should always go network-first (APIs, auth, etc.)
// AI calls now go through /api/ai/coach on the same origin — covered by /api\//
const NETWORK_FIRST_PATTERNS = [
  /supabase\.co/,
  /googleapis\.com\/css/,   // Google Fonts CSS (needs fresh version check)
  /\/api\//,
];

function isNetworkFirst(url) {
  return NETWORK_FIRST_PATTERNS.some((p) => p.test(url));
}

// ── Install: pre-cache the app shell ──────────────────────────────────────────
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(STATIC_CACHE)
      .then((cache) =>
        cache.addAll(
          PRECACHE_URLS.map((url) => new Request(url, { cache: "reload" })),
        ),
      )
      .then(() => self.skipWaiting()),
  );
});

// ── Activate: clean up old caches ─────────────────────────────────────────────
self.addEventListener("activate", (event) => {
  const allowedCaches = new Set([CACHE_NAME, STATIC_CACHE]);
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((k) => !allowedCaches.has(k))
            .map((k) => caches.delete(k)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

// ── Fetch ──────────────────────────────────────────────────────────────────────
self.addEventListener("fetch", (event) => {
  // Only handle GET requests; pass through others (POST for Supabase auth, etc.)
  if (event.request.method !== "GET") return;

  const url = event.request.url;

  // Never intercept chrome-extension or non-http(s) requests
  if (!url.startsWith("http")) return;

  if (isNetworkFirst(url)) {
    // Network-first: try network, fall back to cache
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          // Don't cache error responses
          if (!response || response.status !== 200 || response.type === "error") {
            return response;
          }
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          return response;
        })
        .catch(() => caches.match(event.request)),
    );
    return;
  }

  // Cache-first for static assets (JS, CSS, fonts, images)
  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;

      return fetch(event.request)
        .then((response) => {
          if (!response || response.status !== 200 || response.type === "opaque") {
            return response;
          }
          const clone = response.clone();
          caches.open(STATIC_CACHE).then((cache) => cache.put(event.request, clone));
          return response;
        })
        .catch(() => {
          // If it's a navigation request and we have no cache, show offline page
          if (event.request.mode === "navigate") {
            return caches.match(OFFLINE_URL);
          }
          return new Response("", { status: 408 });
        });
    }),
  );
});
