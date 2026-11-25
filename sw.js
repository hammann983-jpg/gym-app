// Offline-Cache. Bei Änderungen CACHE hochzählen und ?v=N in index.html und config.js anpassen.
var CACHE = "forma-v16";
var FILES = ["./", "index.html", "config.js", "js/i18n.js", "js/questionnaire.js", "js/plan.js", "js/nutrition.js", "js/progress.js", "js/run.js", "js/multi.js", "js/share.js", "data/essen.json", "data/exercises.json", "data/ex-names.json", "js/app.js", "css/styles.css",
  "data/questionnaire.json", "i18n/en.json", "i18n/de.json", "i18n/es.json", "i18n/fr.json", "manifest.webmanifest", "icons/mark-256.png", "icons/icon-192.png"];

self.addEventListener("install", function (e) {
  e.waitUntil(caches.open(CACHE).then(function (c) { return c.addAll(FILES); }).then(function () { return self.skipWaiting(); }));
});
self.addEventListener("activate", function (e) {
  e.waitUntil(caches.keys().then(function (ks) {
    return Promise.all(ks.filter(function (k) { return k !== CACHE; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});
self.addEventListener("fetch", function (e) {
  if (e.request.method !== "GET") return;
  var url = new URL(e.request.url);
  if (url.origin !== location.origin) return;
  e.respondWith(
    fetch(e.request, { cache: "no-cache" }).then(function (r) {
      var copy = r.clone();
      caches.open(CACHE).then(function (c) { c.put(e.request, copy); });
      return r;
    }).catch(function () { return caches.match(e.request, { ignoreSearch: true }); })
  );
});
