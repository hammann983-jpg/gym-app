// Coach: passt den Plan an Ergebnisse an (feste Regeln, keine KI, alles auf dem Gerät).
// Quellen: fitness-trainer/references/programmierung.md und sicherheit.md, ernaehrungsberater/references/gewichtsmanagement.md,
// lauf-coach (Steigerung höchstens ca. 10 % pro Woche).
(function () {
  function day(s) { return new Date(s + "T12:00:00").getTime() / 86400000; }
  function copy(o) { return JSON.parse(JSON.stringify(o)); }
  var LIMIT = { endu: [0.8, 1.1], sets: [-1, 1], hx: [-1, 2], cardio: [0, 2] };

  function fresh(state) {
    var s = state || {};
    return { endu: s.endu || 1, sets: s.sets || 0, hx: s.hx || 0, cardio: s.cardio || 0, history: s.history || [], seen: s.seen || {} };
  }
  function clamp(key, v) { return Math.round(Math.max(LIMIT[key][0], Math.min(LIMIT[key][1], v)) * 100) / 100; }

  // Höchstens eine Änderung je Bereich in 7 Tagen
  function recently(s, area, today) {
    return s.history.some(function (h) { return h.area === area && !h.undone && day(today) - day(h.date) < 7; });
  }
  function change(s, area, key, vars, today, why) {
    var before = {}, any = false;
    Object.keys(vars).forEach(function (k) { var v = clamp(k, s[k] + vars[k]); if (v !== s[k]) { before[k] = s[k]; s[k] = v; any = true; } });
    if (any) s.history.push({ date: today, area: area, key: key, before: before, info: why || {} });
    return any;
  }

  // input: { log, light (gelbe Gesundheitsantwort), today }
  function review(state, input) {
    var s = fresh(copy(state || {})), today = input.today, log = input.log || [], changed = [];
    var rated = log.map(function (l, i) { return { l: l, i: i }; }).filter(function (x) { return x.l.feel; });
    ["gym", "endu"].forEach(function (area) {
      var from = s.seen[area] || 0;
      var mine = rated.filter(function (x) { return (x.l.type === "run") === (area === "endu") && x.i >= from; }).slice(-3);
      if (!mine.length) return;
      var hard = mine.filter(function (x) { return x.l.feel === "hard" || x.l.feel === "pain"; }).length;
      var pain = mine[mine.length - 1].l.feel === "pain";
      var vars = null, key = null;
      if (pain || hard >= 2) { vars = area === "gym" ? { sets: -1 } : { endu: -0.1 }; key = pain ? area + "_pain" : area + "_down"; }
      else if (!input.light && mine.length === 3 && mine.every(function (x) { return x.l.feel === "easy"; }) && !painSince(log, today)) { vars = area === "gym" ? { sets: 1 } : { endu: 0.05 }; key = area + "_up"; }
      if (vars && (pain || !recently(s, area, today))) {
        if (change(s, area, key, vars, today)) changed.push(key);
        s.seen[area] = log.length;
      }
    });
    // Hyrox: gleiche Zahl an Stationen vergleichen
    var hx = log.map(function (l, i) { return { l: l, i: i }; }).filter(function (x) { return x.l.sport === "hyrox" && x.l.st > 0 && x.l.min > 0 && x.l.kind !== "hyroxrace"; });
    if (hx.length >= 2) {
      var last = hx[hx.length - 1], prev = hx.slice(0, -1).reverse().filter(function (x) { return x.l.st === last.l.st; })[0];
      if (prev && last.i >= (s.seen.hx || 0)) {
        var diff = (prev.l.min - last.l.min) / prev.l.min, pct = Math.round(Math.abs(diff) * 100);
        var up = diff >= 0.03 && last.l.feel !== "hard" && last.l.feel !== "pain" && !input.light, down = diff <= -0.05 && last.l.feel === "hard";
        if ((up || down) && !recently(s, "hx", today)) {
          if (change(s, "hx", up ? "hx_up" : "hx_down", { hx: up ? 1 : -1 }, today, { pct: pct })) changed.push(up ? "hx_up" : "hx_down");
          s.seen.hx = log.length;
        }
      }
    }
    return { state: s, changed: changed };
  }
  function painSince(log, today) { return log.some(function (l) { return l.feel === "pain" && day(today) - day(l.date) < 14; }); }

  // Gewicht: erst Bewegung, dann Kalorien (nie beides auf einmal). Gibt zurück, was sich ändert.
  // adv aus Progress.advice, delta aus Progress.autoAdjust; endurance: Person hat schon Ausdauer-Einheiten
  function weightStep(state, adv, delta, endurance, today) {
    var s = fresh(copy(state || {}));
    if (!delta || !adv) return { state: s, kcal: 0, changed: null };
    if (adv.mode === "cut" && !endurance) {
      if (delta < 0 && s.cardio < LIMIT.cardio[1]) { change(s, "weight", "cardio_up", { cardio: 1 }, today); return { state: s, kcal: 0, changed: "cardio_up" }; }
      if (delta > 0 && s.cardio > 0) { change(s, "weight", "cardio_down", { cardio: -1 }, today); return { state: s, kcal: 0, changed: "cardio_down" }; }
    }
    var key = delta > 0 ? "kcal_up" : "kcal_down";
    s.history.push({ date: today, area: "weight", key: key, before: {}, info: { n: Math.abs(delta) }, kcal: delta });
    return { state: s, kcal: delta, changed: key };
  }

  // Nach längerer Pause: eine Weile leichter
  function comeback(state, today) {
    var s = fresh(copy(state || {}));
    change(s, "comeback", "comeback", { sets: s.sets > -1 ? -1 - s.sets : 0, endu: s.endu > 0.9 ? 0.9 - s.endu : 0 }, today);
    return s;
  }
  // Letzte Änderung zurücknehmen. Gibt die Kalorien-Korrektur mit zurück.
  function undo(state) {
    var s = fresh(copy(state || {}));
    for (var i = s.history.length - 1; i >= 0; i--) {
      var h = s.history[i]; if (h.undone) continue;
      Object.keys(h.before || {}).forEach(function (k) { s[k] = h.before[k]; });
      h.undone = true;
      return { state: s, kcal: -(h.kcal || 0) };
    }
    return { state: s, kcal: 0 };
  }

  // Ausdauer-Einheit an den aktuellen Stand anpassen (Wettkämpfe bleiben unverändert)
  function applyRun(item, state, stationFn) {
    var s = fresh(state), r = copy(item);
    if (r.k === "race" || r.k === "trirace" || r.k === "hyroxrace") return r;
    if (s.endu !== 1) {
      if (r.min && r.k !== "runwalk" && r.k !== "cont") {
        r.min = Math.max(15, Math.round(r.min * s.endu / 5) * 5);
        if (r.k === "brick") { r.bike = Math.max(15, Math.round(r.bike * s.endu / 5) * 5); r.run = Math.max(10, Math.round(r.run * s.endu / 5) * 5); r.min = r.bike + r.run; }
      }
      if (r.km) r.km = Math.max(2, Math.round(r.km * s.endu));
    }
    // Hyrox: Anzahl der Stationen (nicht bei der ganzen Simulation, nicht in leichten Wochen mit 2 Stationen)
    if (s.hx && r.stations && r.stations.length >= 3 && r.stations.length < 8 && stationFn) {
      var n = Math.max(3, Math.min(6, r.stations.length + s.hx)), first = r.from || 0, list = [];
      for (var i = 0; i < n; i++) list.push(stationFn((first + i) % 8));
      r.stations = list;
      (r.q || []).forEach(function (q) { if (q.id === "hybrid") q.n = n; });
      if (s.hx >= 2 && !(r.q || []).some(function (q) { return q.id === "hx_weight"; })) r.q.push({ id: "hx_weight" });
    }
    return r;
  }

  // Gesundheits-Hinweis "gelb": alles locker, keine Intervalle, kein Wettkampftempo (sicherheit.md)
  function lighten(run) {
    var out = copy(run), HARD = { quality: "easy", bikehard: "bike", sim: "hybrid" };
    var weeks = out.weeks.concat(out.hold ? [out.hold] : []);
    weeks.forEach(function (w) {
      w.runs.forEach(function (r) {
        if (HARD[r.k]) { r.k = HARD[r.k]; r.q = r.k === "hybrid" ? [{ id: "hybrid", n: (r.stations || []).length }] : []; }
        else if (r.k === "swim") r.q = [{ id: "swim_endu" }];
        else if (r.k !== "hybrid") r.q = [];
        else r.q = (r.q || []).filter(function (q) { return q.id === "hybrid"; });
      });
    });
    return out;
  }

  // Wie viele Einheiten wurden in den letzten 14 Tagen geschafft? null, wenn noch zu früh.
  function adherence(log, perWeek, today) {
    if (!log.length || day(today) - day(log[0].date) < 14) return null;
    var n = log.filter(function (l) { return day(today) - day(l.date) < 14; }).length;
    return { done: n, planned: perWeek * 2, low: n < perWeek };
  }

  window.Coach = { comeback: comeback, fresh: fresh, review: review, weightStep: weightStep, undo: undo, applyRun: applyRun, lighten: lighten, adherence: adherence };
})();
