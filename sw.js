// Guarda la carcasa de la aplicación para que abra sin cobertura. Los datos van aparte (IndexedDB).
const VERSION = "expedientes-v5";
const CARCASA = ["./", "index.html", "estilo.css", "config.js", "app.js", "vistas.js", "manifest.webmanifest",
  "logo-192.png", "logo-512.png", "msal-browser.min.js", "sql-wasm.js", "sql-wasm.wasm"];
self.addEventListener("install", (e) => { e.waitUntil(caches.open(VERSION).then((c) => c.addAll(CARCASA))); self.skipWaiting(); });
self.addEventListener("activate", (e) => { e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== VERSION).map((k) => caches.delete(k))))); self.clients.claim(); });
self.addEventListener("fetch", (e) => {
  const u = new URL(e.request.url);
  if (e.request.method !== "GET" || u.origin !== location.origin) return;   // Microsoft y OneDrive, siempre en directo
  // Primero la red (para recibir mejoras), y si no hay cobertura, lo guardado
  e.respondWith(fetch(e.request).then((r) => { const c = r.clone(); caches.open(VERSION).then((k) => k.put(e.request, c)); return r; })
    .catch(() => caches.match(e.request, { ignoreSearch: true })));
});
