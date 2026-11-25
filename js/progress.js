// Fortschritt: Gewichtsverlauf, Anpassung der Kalorien, Kraft- und Lauf-Ergebnisse (reine Funktionen).
(function () {
  function day(s) { return new Date(s + "T12:00:00").getTime() / 86400000; }

  // Steigung in kg pro Woche aus den letzten 28 Tagen (lineare Regression). null bei zu wenig Daten.
  function rate(weights, today) {
    var t0 = today ? day(today) : Date.now() / 86400000;
    var pts = weights.filter(function (w) { return t0 - day(w.date) <= 28 && t0 - day(w.date) >= -1; }).map(function (w) { return { x: day(w.date), y: Number(w.kg) }; });
    if (pts.length < 3) return null;
    var span = Math.max.apply(null, pts.map(function (p) { return p.x; })) - Math.min.apply(null, pts.map(function (p) { return p.x; }));
    if (span < 10) return null;
    var n = pts.length, mx = pts.reduce(function (a, p) { return a + p.x; }, 0) / n, my = pts.reduce(function (a, p) { return a + p.y; }, 0) / n;
    var num = 0, den = 0;
    pts.forEach(function (p) { num += (p.x - mx) * (p.y - my); den += (p.x - mx) * (p.x - mx); });
    return den ? (num / den) * 7 : null;
  }

  // Passt das Tempo zum Ziel? mode: "cut" | "muscle" | "hold"; beginner: Anfänger
  function advice(mode, beginner, weights, today) {
    var r = rate(weights, today);
    if (r == null) return { state: "wait", rate: null, pct: null, delta: 0 };
    var last = weights.slice().sort(function (a, b) { return day(a.date) - day(b.date); }).pop();
    var pct = r / Number(last.kg) * 100; // Prozent Körpergewicht pro Woche (negativ = Abnahme)
    var state = "ontrack", delta = 0;
    if (mode === "cut") {
      if (pct > -0.2) { state = "tooslow"; delta = -100; }
      else if (pct < -0.8) { state = "toofast"; delta = 100; }
    } else if (mode === "muscle") {
      var lo = beginner ? 0.1 : 0.03, hi = beginner ? 0.4 : 0.15;
      if (pct < lo) { state = "tooslow"; delta = 100; }
      else if (pct > hi) { state = "toofast"; delta = -100; }
    } else if (Math.abs(pct) > 0.3) { state = pct > 0 ? "toofast" : "tooslow"; delta = pct > 0 ? -100 : 100; }
    return { state: state, rate: Math.round(r * 100) / 100, pct: Math.round(pct * 100) / 100, delta: delta };
  }

  // Soll die App jetzt automatisch anpassen? Frühestens nach 14 Tagen Daten und 14 Tagen seit der letzten Anpassung; Summe höchstens ±300 kcal.
  function autoAdjust(adv, current, lastDate, today, firstDate) {
    if (!adv || adv.delta === 0 || adv.state === "wait") return 0;
    var t = day(today);
    if (firstDate && t - day(firstDate) < 14) return 0;
    if (lastDate && t - day(lastDate) < 14) return 0;
    var next = Math.max(-300, Math.min(300, (current || 0) + adv.delta));
    return next - (current || 0);
  }

  // Geschätztes 1-Wiederholungs-Maximum nach Epley
  function e1rm(kg, reps) { kg = Number(kg); reps = Number(reps); if (!(kg > 0 && reps >= 1)) return 0; return reps === 1 ? kg : kg * (1 + reps / 30); }

  // Riegel: T2 = T1 * (D2 / D1) ^ 1,06 (Sekunden, Kilometer)
  function riegel(t1, d1, d2) { return t1 * Math.pow(d2 / d1, 1.06); }
  var DIST = { "5k": 5, "10k": 10, "hm": 21.0975, "m": 42.195 };
  function fmtTime(sec) {
    sec = Math.round(sec); var h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60, p = function (n) { return (n < 10 ? "0" : "") + n; };
    return h > 0 ? h + ":" + p(m) + ":" + p(s) : m + ":" + p(s);
  }
  // "mm:ss" oder "h:mm:ss" oder Minuten als Zahl -> Sekunden
  function parseTime(str) {
    var s = String(str).trim().replace(",", ".");
    if (/^\d+(\.\d+)?$/.test(s)) return Math.round(parseFloat(s) * 60);
    var m = /^(\d+):(\d{1,2})(?::(\d{1,2}))?$/.exec(s);
    if (!m) return 0;
    return m[3] != null ? (+m[1]) * 3600 + (+m[2]) * 60 + (+m[3]) : (+m[1]) * 60 + (+m[2]);
  }
  function pace(sec, km) { return sec / km; } // Sekunden pro km

  function daysUntil(dateStr, today) { return Math.ceil(day(dateStr) - day(today)); }

  window.Progress = { rate: rate, advice: advice, autoAdjust: autoAdjust, e1rm: e1rm, riegel: riegel, DIST: DIST, fmtTime: fmtTime, parseTime: parseTime, pace: pace, daysUntil: daysUntil };
})();
