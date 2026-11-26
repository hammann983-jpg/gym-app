// Installieren auf dem Handy: Lage erkennen, Browser-Dialog merken und auslösen.
// Muss früh geladen werden, sonst geht das Ereignis "beforeinstallprompt" verloren.
(function () {
  var deferred = null, installed = false, listener = null;

  function changed() { if (listener) listener(); }

  // Reine Erkennung aus der Browser-Kennung (testbar)
  function detect(ua, standalone, hasPrompt, touch) {
    if (standalone) return "installed";
    // iPad meldet sich als Mac: am Touch erkennbar
    var ios = /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && touch > 1);
    var android = /Android/.test(ua);
    if (hasPrompt) return "prompt";
    if ((android || ios) && /; wv\)|FBAN|FBAV|FB_IAB|Instagram|Line\/|Snapchat|musical_ly|BytedanceWebview|trill_|MicroMessenger|LinkedInApp|Pinterest|GSA\//.test(ua)) return ios ? "ios_inapp" : "inapp";
    if (ios) return "ios";
    if (!android) return "other";
    if (/SamsungBrowser/.test(ua)) return "samsung";
    return "android";
  }

  // Öffnet die Seite auf Android direkt in Chrome; fehlt Chrome, bleibt es beim Standardbrowser
  function chromeLink(url) {
    var u = url.split("#")[0].split("?")[0];
    return "intent://" + u.replace(/^https?:\/\//, "") + "#Intent;scheme=https;package=com.android.chrome;S.browser_fallback_url=" + encodeURIComponent(u) + ";end";
  }

  window.addEventListener("beforeinstallprompt", function (e) { e.preventDefault(); deferred = e; changed(); });
  window.addEventListener("appinstalled", function () { deferred = null; installed = true; changed(); });

  window.Install = {
    detect: detect,
    chromeLink: chromeLink,
    state: function () {
      if (installed) return "done";
      var standalone = (window.matchMedia && window.matchMedia("(display-mode: standalone)").matches) || window.navigator.standalone === true;
      return detect(window.navigator.userAgent, standalone, !!deferred, window.navigator.maxTouchPoints || 0);
    },
    // Muss direkt beim Antippen aufgerufen werden
    prompt: function () {
      if (!deferred) return Promise.resolve("none");
      var e = deferred; deferred = null; e.prompt();
      return e.userChoice.then(function (c) { changed(); return c.outcome; }, function () { changed(); return "none"; });
    },
    onChange: function (fn) { listener = fn; }
  };
})();
