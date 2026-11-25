// Einfache Übersetzung: lädt i18n/<code>.json, Fallback Englisch. t(key, {n: 3}) ersetzt {n}.
(function () {
  var dict = {}, fallback = {}, current = "en";

  function load(code) {
    return fetch("i18n/" + code + ".json?v=" + window.GYM_CONFIG.VERSION, { cache: "no-cache" })
      .then(function (r) { if (!r.ok) throw new Error(code); return r.json(); });
  }

  window.I18N = {
    init: function (code) {
      current = code || "en";
      var jobs = [load("en").then(function (d) { fallback = d; })];
      if (current !== "en") jobs.push(load(current).then(function (d) { dict = d; }).catch(function () { dict = {}; }));
      return Promise.all(jobs).then(function () {
        if (current === "en") dict = fallback;
        document.documentElement.lang = current;
      });
    },
    has: function (key) { return dict[key] != null || fallback[key] != null; },
    t: function (key, vars) {
      var s = dict[key] != null ? dict[key] : (fallback[key] != null ? fallback[key] : key);
      if (vars) Object.keys(vars).forEach(function (k) { s = s.split("{" + k + "}").join(vars[k]); });
      return s;
    },
    lang: function () { return current; }
  };
})();
