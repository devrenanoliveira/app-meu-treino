/* Service worker: guarda os arquivos do app para abrir sem internet e atualiza em segundo plano. */
var CACHE = "meutreino-v16";
var ASSETS = [
  "./", "./index.html", "./style.css", "./data.js", "./app.js", "./manifest.webmanifest",
  "./icons/icon-192.png", "./icons/icon-512.png", "./icons/icon-maskable-512.png"
];

self.addEventListener("install", function (e) {
  e.waitUntil(caches.open(CACHE).then(function (c) { return c.addAll(ASSETS); }).then(function () { return self.skipWaiting(); }));
});

self.addEventListener("activate", function (e) {
  e.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.filter(function (k) { return k !== CACHE; }).map(function (k) { return caches.delete(k); }));
    }).then(function () { return self.clients.claim(); })
  );
});

/* Rede primeiro (arquivos sempre na versão mais nova, sem misturar versões); o cache só entra quando está sem internet. */
self.addEventListener("fetch", function (e) {
  if (e.request.method !== "GET") return;
  var same = new URL(e.request.url).origin === self.location.origin;
  e.respondWith(
    fetch(same ? new Request(e.request.url, { cache: "no-cache" }) : e.request).then(function (res) {
      if (same && res && res.ok) { var copy = res.clone(); caches.open(CACHE).then(function (c) { c.put(e.request, copy); }); }
      return res;
    }).catch(function () {
      return caches.open(CACHE).then(function (c) {
        return c.match(e.request, { ignoreSearch: true }).then(function (hit) { return hit || c.match("./index.html"); });
      });
    })
  );
});

self.addEventListener("notificationclick", function (e) {
  e.notification.close();
  e.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(function (list) {
      for (var i = 0; i < list.length; i++) { if ("focus" in list[i]) return list[i].focus(); }
      return self.clients.openWindow("./");
    })
  );
});
