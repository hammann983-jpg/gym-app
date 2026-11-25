// Ernährung: Tagesziele und Wochen-Essensplan (reine Funktionen). Regeln: fitness-trainer/references/ernaehrung.md
(function () {
  var ACT = { sitzend: 1.2, leicht: 1.3, aktiv: 1.4, sehr_aktiv: 1.5 };
  var SLOT_SPLIT = { 3: [0.28, 0.38, 0.34], 4: [0.25, 0.33, 0.30, 0.12], 5: [0.22, 0.30, 0.28, 0.10, 0.10] };
  var SLOTS = ["fruehstueck", "mittag", "abend", "snack", "snack"];
  var ENDU = ["laufen", "marathon", "triathlon", "hyrox"];

  function num(v) { var n = parseFloat(String(v).replace(",", ".")); return isFinite(n) ? n : 0; }
  function prio(a) { return window.Plan ? window.Plan.prio(a) : (a.ziele && a.ziele[0]); }

  function bmr(a) {
    var w = num(a.gewicht_kg), h = num(a.groesse_cm), age = num(a.alter), base = 10 * w + 6.25 * h - 5 * age;
    return a.geschlecht === "weiblich" ? base - 161 : a.geschlecht === "maennlich" ? base + 5 : base - 78;
  }

  // Anpassung der Kalorien in Prozent (Dezimal): Fettabbau negativ, Aufbau positiv
  function adjust(a) {
    var G = Array.isArray(a.ziele) ? a.ziele : [], p = prio(a), anf = a.kraft_erfahrung === "noch_nie" || a.kraft_erfahrung === "unter_6";
    if (p === "abnehmen") return G.indexOf("muskelaufbau") >= 0 ? -0.10 : -0.15;
    if (p === "bodybuilding") return a.bb_phase === "definition" ? -0.15 : a.bb_phase === "aufbau" ? (anf ? 0.03 : 0.07) : 0;
    if (p === "muskelaufbau") return anf ? 0.03 : 0.07;
    if (ENDU.indexOf(p) >= 0) return 0.03;
    if (G.indexOf("abnehmen") >= 0) return -0.10;
    if (G.indexOf("muskelaufbau") >= 0) return 0.03;
    return 0;
  }

  // Tagesziele oder null (kein Ernährungsziel in Schutzfällen, siehe ernaehrung.md Abschnitt 0)
  function targets(a, adjKcal) {
    if (window.Q && window.Q.screening(a).nutriOff) return null;
    var w = num(a.gewicht_kg), h = num(a.groesse_cm);
    if (!(w > 0 && h > 0 && num(a.alter) > 0)) return null;
    var b = bmr(a), days = Math.min(5, num(a.trainingstage) || 3);
    var factor = Math.min(1.9, (ACT[a.schritte] || 1.3) + Math.min(0.15, days * 0.03));
    var tdee = b * factor, adj = adjust(a), notes = [];
    if (adj < -0.25) adj = -0.25;
    var kcal = Math.max(tdee * 0.75, tdee * (1 + adj) + (adjKcal || 0)); // nie mehr als 25 % unter dem Gesamtumsatz
    var minK = a.geschlecht === "weiblich" ? 1400 : a.geschlecht === "maennlich" ? 1700 : 1550;
    var floor = Math.max(minK, b);
    if (kcal < floor) { kcal = floor; notes.push("min"); }
    kcal = Math.round(kcal / 10) * 10;
    var bmiNow = w / Math.pow(h / 100, 2), ref = bmiNow > 30 ? 25 * Math.pow(h / 100, 2) : w;
    var vegan = a.ernaehrungsform === "vegan";
    var pk = adj < 0 ? 2.0 : adj > 0 ? 1.8 : 1.6;
    if (vegan) pk = Math.min(2.2, pk + 0.2);
    var protein = Math.round(pk * ref);
    var fat = Math.round(Math.max(0.25 * kcal / 9, 0.6 * ref));
    var carbs = Math.max(0, Math.round((kcal - 4 * protein - 9 * fat) / 4));
    var water = Math.round((0.035 * w + 0.5) * 10) / 10; // 35 ml/kg plus 0,5 l an Trainingstagen
    var weekly = Math.round(((tdee - kcal) * 7 / 7700) * 100) / 100; // kg pro Woche, positiv = Abnahme
    if (adj < 0) notes.push("cut");
    if (adj > 0) notes.push("muscle");
    return { kcal: kcal, protein: protein, carbs: carbs, fat: fat, water: water, bmr: Math.round(b), tdee: Math.round(tdee), adj: adj, weeklyKg: weekly, notes: notes };
  }

  // Woche (Jahr + ISO-Kalenderwoche) für die wöchentliche Rotation
  function weekInfo(date) {
    var d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    var dow = (d.getUTCDay() + 6) % 7;
    var monday = new Date(d); monday.setUTCDate(d.getUTCDate() - dow);
    var thu = new Date(d); thu.setUTCDate(d.getUTCDate() - dow + 3);
    var y = thu.getUTCFullYear(), first = new Date(Date.UTC(y, 0, 4));
    var wk = 1 + Math.round(((thu - first) / 86400000 - 3 + ((first.getUTCDay() + 6) % 7)) / 7);
    return { key: y + "-W" + (wk < 10 ? "0" : "") + wk, year: y, week: wk, monday: new Date(monday.getUTCFullYear(), monday.getUTCMonth(), monday.getUTCDate()) };
  }

  function hash(str) { var h = 2166136261; for (var i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0) / 4294967296; }

  function liked(a) { return Array.isArray(a.mag) ? a.mag : []; }

  // Passende Rezepte für einen Slot, beste zuerst; die Reihenfolge wechselt jede Woche
  function pool(a, data, slot, weekKey) {
    var diet = a.ernaehrungsform || "omnivor", allerg = (Array.isArray(a.allergien) ? a.allergien : []).filter(function (x) { return x !== "keine"; });
    var all = data.meals.filter(function (m) {
      return m.slot === slot && m.ernaehrung.indexOf(diet) >= 0 && !m.allergene.some(function (x) { return allerg.indexOf(x) >= 0; });
    });
    var prepMax = a.kochzeit === "unter_15" ? 15 : a.kochzeit === "m15_30" ? 30 : 999;
    var budgets = a.budget === "niedrig" ? ["niedrig"] : a.budget === "mittel" ? ["niedrig", "mittel"] : ["niedrig", "mittel", "hoch"];
    var BR = { niedrig: 0, mittel: 1, hoch: 2 };
    function fill(list, rest, key, min) {
      if (list.length >= min) return list;
      var extra = rest.filter(function (m) { return list.indexOf(m) < 0; }).sort(function (x, y) { return key(x) - key(y); });
      return list.concat(extra.slice(0, min - list.length));
    }
    // erst Kochzeit, dann Budget; fehlen Rezepte, kommen die schnellsten beziehungsweise günstigsten dazu
    var byPrep = fill(all.filter(function (m) { return m.prep <= prepMax; }), all, function (m) { return m.prep; }, 7);
    var list = fill(byPrep.filter(function (m) { return budgets.indexOf(m.budget) >= 0; }), byPrep, function (m) { return BR[m.budget]; }, 6);
    var maxDens = Math.max.apply(null, list.map(function (m) { return m.p / m.kcal; }).concat([0.001]));
    var L = liked(a), likeAll = L.indexOf("alles") >= 0 || !L.length;
    function score(m) {
      if (likeAll) return 1;
      var tags = m.likes.filter(function (t) { return t !== "gemuese" && t !== "salat"; });
      if (!tags.length) return 1;
      return tags.filter(function (t) { return L.indexOf(t) >= 0; }).length / tags.length;
    }
    // Rotation pro Woche; eiweißreiche Rezepte werden leicht bevorzugt, damit das Proteinziel erreichbar bleibt
    var ranked = list.map(function (m) { var s = score(m); return { m: m, b: s >= 1 ? 2 : s >= 0.5 ? 1 : 0, r: hash(weekKey + "|" + slot + "|" + m.id) + 0.6 * (1 - (m.p / m.kcal) / maxDens) }; });
    var good = ranked.filter(function (x) { return x.b === 2; });
    if (good.length >= 4) ranked = good; // genug Rezepte, die nur Gewünschtes enthalten
    ranked.sort(function (x, y) { return y.b - x.b || x.r - y.r; });
    return ranked.map(function (x) { return x.m; });
  }

  function roundItem(food, grams) {
    if (food.s) { var n = Math.max(1, Math.round(grams / food.s)); return { amount: n * food.s, count: n }; }
    var r = grams < 20 ? Math.max(5, Math.round(grams / 5) * 5) : Math.round(grams / 5) * 5;
    return { amount: Math.max(5, r), count: 0 };
  }

  function portion(meal, data, factor) {
    var items = [], k = 0, p = 0, c = 0, f = 0;
    meal.items.forEach(function (it) {
      var food = data.foods[it[0]], ri = roundItem(food, it[1] * factor);
      k += food.k * ri.amount / 100; p += food.p * ri.amount / 100; c += food.c * ri.amount / 100; f += food.f * ri.amount / 100;
      items.push({ id: it[0], amount: ri.amount, count: ri.count });
    });
    return { items: items, kcal: Math.round(k), p: Math.round(p), c: Math.round(c), f: Math.round(f) };
  }

  // Wochenplan: 7 Tage mit je 3 bis 5 Mahlzeiten. swaps: { "<tag>|<slot>": anzahl } verschiebt die Auswahl.
  function week(a, data, date, swaps, adjKcal) {
    var info = weekInfo(date || new Date()), tg = targets(a, adjKcal), m = Number(a.mahlzeiten) || 3;
    var split = SLOT_SPLIT[m] || SLOT_SPLIT[3], pools = {}, days = [];
    ["fruehstueck", "mittag", "abend", "snack"].forEach(function (s) { pools[s] = pool(a, data, s, info.key); });
    for (var d = 0; d < 7; d++) {
      var slots = [], snackNo = 0;
      for (var i = 0; i < split.length; i++) {
        var slot = SLOTS[i], pl = pools[slot];
        if (!pl.length) continue;
        var key = d + "|" + i, off = (swaps && swaps[key]) || 0;
        var idx = ((slot === "snack" ? d * 2 + snackNo : d) + off) % pl.length;
        if (slot === "snack") snackNo++;
        var meal = pl[idx], factor = 1;
        if (tg) factor = Math.max(0.7, Math.min(1.5, tg.kcal * split[i] / meal.kcal));
        var por = portion(meal, data, factor);
        slots.push({ index: i, slot: slot, meal: meal, items: por.items, kcal: por.kcal, p: por.p, c: por.c, f: por.f, pool: pl.length });
      }
      days.push({ day: d, slots: slots, kcal: slots.reduce(function (x, s) { return x + s.kcal; }, 0), p: slots.reduce(function (x, s) { return x + s.p; }, 0) });
    }
    return { info: info, targets: tg, days: days };
  }

  // Einkaufsliste der Woche: Zutaten summiert
  function shopping(w) {
    var tot = {};
    w.days.forEach(function (d) { d.slots.forEach(function (s) { s.items.forEach(function (it) { var e = tot[it.id] || (tot[it.id] = { id: it.id, amount: 0, count: 0 }); e.amount += it.amount; e.count += it.count; }); }); });
    return Object.keys(tot).map(function (k) { return tot[k]; });
  }

  window.Nutrition = { targets: targets, adjust: adjust, bmr: bmr, week: week, weekInfo: weekInfo, pool: pool, shopping: shopping, portion: portion };
})();
