/* Service worker: network-first for the app's own files (so app updates arrive as soon as online),
   cache fallback when offline. Own files only: no third-party requests. */
var CACHE = 'pp-pos-v3';
var CORE = ['./', 'index.html', 'manifest.json', 'icon-192.png', 'icon-512.png', 'icon-maskable-512.png'];
var NET_TIMEOUT_MS = 3000;

self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(CACHE).then(function (c) { return c.addAll(CORE); }).then(function () { return self.skipWaiting(); }));
});

self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.filter(function (k) { return k !== CACHE; }).map(function (k) { return caches.delete(k); }));
    }).then(function () { return self.clients.claim(); })
  );
});

function networkFirst(req) {
  return new Promise(function (resolve) {
    var settled = false;
    function fromCache() {
      return caches.match(req, { ignoreSearch: true }).then(function (hit) { return hit || caches.match('index.html'); });
    }
    var timer = setTimeout(function () {
      fromCache().then(function (hit) { if (hit && !settled) { settled = true; resolve(hit); } });
    }, NET_TIMEOUT_MS);
    fetch(req).then(function (res) {
      clearTimeout(timer);
      if (res && res.ok) {
        var copy = res.clone();
        caches.open(CACHE).then(function (c) { c.put(req, copy); });
      }
      if (!settled) { settled = true; resolve(res); }
    }).catch(function () {
      clearTimeout(timer);
      fromCache().then(function (hit) { if (!settled) { settled = true; resolve(hit || Response.error()); } });
    });
  });
}

self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET') return;
  var url = new URL(req.url);
  if (url.origin === self.location.origin) { e.respondWith(networkFirst(req)); return; }
});
