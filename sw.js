/* ==========================================================================
   買取アカデミー — Service Worker
   ・アプリ本体は「ネットワーク優先、オフラインならキャッシュ」
   ・画像（assets/images/ と images-pack*.zip、icons/）は「キャッシュ優先」
   ・インストール時に何百枚もまとめて取得するようなことはしない
   更新したときは CACHE の数字を1つ上げてください（例 kaitori-v1 → kaitori-v2）
   ========================================================================== */
var CACHE = "kaitori-v1";

self.addEventListener("install", function (e) {
  self.skipWaiting();
});

self.addEventListener("activate", function (e) {
  e.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.map(function (k) {
        return k === CACHE ? null : caches.delete(k);
      }));
    }).then(function () {
      return self.clients.claim();
    })
  );
});

function putSafe(req, res) {
  try {
    if (!res || !res.ok) return;
    if (res.type !== "basic" && res.type !== "default") return;
    var copy = res.clone();
    caches.open(CACHE).then(function (c) { c.put(req, copy); }).catch(function () { });
  } catch (err) { }
}

self.addEventListener("fetch", function (e) {
  var req = e.request;
  if (req.method !== "GET") return;

  var url;
  try { url = new URL(req.url); } catch (err) { return; }
  if (url.origin !== self.location.origin) return;

  /* 1) ページ本体（HTML）: 新しいものを優先。失敗したらキャッシュで開く */
  if (req.mode === "navigate" || req.destination === "document") {
    e.respondWith(
      fetch(req).then(function (res) { putSafe(req, res); return res; })
        .catch(function () {
          return caches.match(req).then(function (m) {
            return m || caches.match("./index.html");
          });
        })
    );
    return;
  }

  /* 2) 画像・アイコン・パッケージ: キャッシュ優先（一度読めば次から即表示） */
  var h = url.pathname;
  var imageLike = /\/assets\/images\//.test(h)
    || /images-pack[^\/]*\.zip$/.test(h)
    || /\/icons\//.test(h)
    || /\/assets\/dist\//.test(h);
  if (!imageLike) return;

  e.respondWith(
    caches.match(req).then(function (m) {
      if (m) return m;
      return fetch(req).then(function (res) {
        putSafe(req, res);
        return res;
      });
    })
  );
});
