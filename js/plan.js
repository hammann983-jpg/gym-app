// Plan-Generator (reine Funktionen, ohne Oberfläche). Regeln: fitness-trainer/references/programmierung.md
(function () {
  var LEVELS = ["anfaenger", "fortgeschritten", "erfahren"];
  var COMPOUND = { kniebeuge: 1, hinge: 1, ausfall: 1, push_h: 1, push_schraeg: 1, push_v: 1, pull_v: 1, pull_h: 1 };
  var LOWER = { kniebeuge: 1, hinge: 1, ausfall: 1, beinbeuger: 1, beinstrecker: 1, waden: 1 };
  var GROUP = { kniebeuge: "beine", ausfall: "beine", beinstrecker: "beine", hinge: "hinten", beinbeuger: "hinten", push_h: "brust", push_schraeg: "brust", pull_v: "ruecken", pull_h: "ruecken", push_v: "schulter", schulter_seitlich: "schulter", schulter_hinten: "schulter", trizeps: "arme", bizeps: "arme" };
  var VOL_MAX = { anfaenger: 10, fortgeschritten: 16, erfahren: 20 };

  // Platzhalter: Reihenfolge der Kategorien, die probiert werden. "VERT" und "SCHULTER" wechseln pro Einheit.
  var SLOTS = {
    fb: ["kniebeuge", "hinge", "push_h", "pull_h", "VERT", "rumpf"],
    ok: ["push_h", "pull_h", "push_v", "pull_v", "schulter_hinten", "trizeps", "bizeps"],
    uk: ["kniebeuge", "hinge", "ausfall", "beinbeuger", "waden", "rumpf"],
    push: ["push_h", "push_schraeg", "push_v", "schulter_seitlich", "trizeps", "trizeps"],
    pull: ["pull_v", "pull_h", "schulter_hinten", "bizeps", "bizeps", "griffrumpf"],
    legs: ["kniebeuge", "hinge", "ausfall", "STRECK_BEUG", "waden", "rumpf"]
  };
  var EXTRA = { fb: ["trizeps", "bizeps"], ok: ["schulter_seitlich"], uk: ["beinstrecker"], push: ["schulter_seitlich"], pull: ["schulter_hinten"], legs: ["beinbeuger"] };
  var MAXEX = { 30: 4, 45: 5, 60: 6, 75: 7, 90: 8, 120: 8 };

  function rank(l) { return Math.max(0, LEVELS.indexOf(l)); }

  function level(a) {
    var k = a.kraft_erfahrung;
    if (k === "ueber_24") return "erfahren";
    if (k === "m6_24") return "fortgeschritten";
    return "anfaenger";
  }

  var ENDU = ["laufen", "marathon", "triathlon", "hyrox"];
  var BAR_IDS = { klimmzug: 1, dead_hang: 1, haengen_beinheben: 1 }; // brauchen eine Stange

  function goals(a) {
    if (Array.isArray(a.ziele) && a.ziele.length) return a.ziele;
    return a.hauptziel ? [a.hauptziel] : [];
  }
  // wichtigstes Ziel
  function prio(a) {
    var z = goals(a);
    if (z.length <= 1) return z[0] || null;
    return z.indexOf(a.prioritaet) >= 0 ? a.prioritaet : z[0];
  }
  function goalType(a) {
    var g = prio(a);
    if (g === "kraft") return "kraft";
    if (g === "muskelaufbau" || g === "bodybuilding") return "hyp";
    // Muskelaufbau als Zusatzziel zu Abnehmen: Muskeln halten mit Hypertrophie-Training
    if (g === "abnehmen" && goals(a).indexOf("muskelaufbau") >= 0) return "hyp";
    return "fitness"; // abnehmen, fitness und (vorerst) alle Ausdauer-Ziele
  }
  function isEndurance(a) { return ENDU.indexOf(prio(a)) >= 0; }
  function hasEndurance(a) { return goals(a).some(function (g) { return ENDU.indexOf(g) >= 0; }); }

  // Verfügbares Equipment aus Ort (studio, studio_hyrox, zuhause) und Heim-Ausstattung
  function equipSet(a) {
    var e = { koerper: 1 };
    var gym = ["maschine", "kabel", "kurzhantel", "langhantel", "rack", "bank", "kettlebell", "band", "cardio-geraet", "stange"];
    if (a.ort === "studio" || a.ort === "studio_hyrox") gym.forEach(function (x) { e[x] = 1; });
    if (a.ort === "studio_hyrox") { e.sled = 1; e.wallball = 1; }
    if (a.ort === "zuhause") {
      (Array.isArray(a.heim) ? a.heim : []).forEach(function (k) {
        if (k === "kurzhanteln") e.kurzhantel = 1;
        if (k === "kettlebell") e.kettlebell = 1;
        if (k === "band") e.band = 1;
        if (k === "klimmzugstange") e.stange = 1;
        if (k === "bank") e.bank = 1;
      });
    }
    return e;
  }

  // Zuordnung Kategorie -> Muskelgruppe für die Anzeige
  var FOCUS = { kniebeuge: "quads", beinstrecker: "quads", ausfall: "legs", hinge: "posterior", beinbeuger: "posterior", waden: "calves", push_h: "chest", push_schraeg: "chest", push_v: "shoulders", schulter_seitlich: "shoulders", schulter_hinten: "shoulders", pull_v: "back", pull_h: "back", trizeps: "triceps", bizeps: "biceps", rumpf: "core", griff: "grip" };
  function focusOf(exs) {
    var tot = {}, order = [];
    exs.forEach(function (x) {
      var f = FOCUS[x.cat]; if (!f) return;
      if (!(f in tot)) { tot[f] = 0; order.push(f); }
      tot[f] += x.sets;
    });
    var main = order.filter(function (f) { return f !== "core" && f !== "grip"; });
    if (!main.length) main = order;
    main.sort(function (p, q) { return tot[q] - tot[p] || order.indexOf(p) - order.indexOf(q); });
    return main.slice(0, 3);
  }

  // Realistische Dauer des Plans in Wochen (immer durch 4 teilbar außer bei Wettkampf-Datum)
  function planWeeks(a, today) {
    var g = prio(a), lvl = level(a), notes = [], w = 12;
    var rounds4 = function (n) { return Math.max(4, Math.ceil(n / 4) * 4); };
    if (g === "kraft") w = lvl === "erfahren" ? 16 : 12;
    else if (g === "muskelaufbau" || g === "bodybuilding") w = lvl === "erfahren" ? 16 : 12;
    else if (g === "abnehmen") {
      var cur = Number(a.gewicht_kg), tgt = Number(a.zielgewicht_kg);
      if (cur > 0 && tgt > 0 && tgt < cur) w = Math.min(40, Math.max(8, rounds4((cur - tgt) / (cur * 0.005)))); // ca. 0,5 % Körpergewicht pro Woche
      else w = 12;
    } else if (g === "laufen") w = 10;
    else if (g === "marathon") w = (a.lauf_level === "gar_nicht" || a.lauf_level === "unter_10") ? 30 : 18;
    else if (g === "triathlon") w = { sprint: 12, olympisch: 16, halb: 24, voll: 30 }[a.tri_distanz] || 16;
    else if (g === "hyrox") w = 12;
    if (ENDU.indexOf(g) >= 0 && a.event_datum) {
      var days = Math.ceil((new Date(a.event_datum + "T12:00:00") - (today || new Date())) / 86400000), ew = Math.ceil(days / 7);
      if (ew >= 2) { if (ew < w) notes.push("event_soon"); w = Math.min(w, ew); }
    }
    return { weeks: w, notes: notes };
  }

  function available(ex, E) {
    var eq = ex.equipment;
    if (BAR_IDS[ex.id] && !E.stange) return false;
    if (eq.indexOf("koerper") >= 0) return true;
    var primary = eq.filter(function (x) { return x !== "bank" && x !== "rack"; });
    if (!primary.some(function (x) { return E[x]; })) return false;
    if (eq.indexOf("bank") >= 0 && !E.bank) return false;
    if (eq.indexOf("rack") >= 0 && !E.rack) return false;
    return true;
  }

  function blocked(ex, injuries) {
    return (ex.meiden_bei || []).some(function (tag) {
      return injuries.some(function (inj) { return tag === inj || tag.indexOf(inj + "_") === 0; });
    });
  }

  function loadable(ex) { return ex.equipment.some(function (x) { return x !== "koerper"; }); }

  function split(days, lvl) {
    if (days <= 2) return ["fb", "fb"];
    if (days === 3) return lvl === "anfaenger" ? ["fb", "fb", "fb"] : ["push", "pull", "legs"];
    if (days === 4) return ["ok", "uk", "ok", "uk"];
    if (days === 5) return ["ok", "uk", "push", "pull", "legs"];
    return lvl === "erfahren" ? ["push", "pull", "legs", "push", "pull", "legs"] : ["ok", "uk", "push", "pull", "legs"];
  }

  function parseReps(w) {
    var m = /^(\d+)-(\d+)(.*)$/.exec(w || "");
    if (!m) return { lo: null, hi: null, suffix: "", text: w || "" };
    return { lo: +m[1], hi: +m[2], suffix: m[3].trim(), text: w };
  }

  function scheme(goal, lvl, ex, dauer) {
    var cat = ex.kategorie, comp = !!COMPOUND[cat], p = parseReps(ex.wdh_standard);
    var timed = /Sek|\bm\b/i.test(p.suffix) || p.lo == null;
    var rest, sets, lo, hi;
    if (timed) return { sets: 2, lo: p.lo, hi: p.hi, suffix: p.suffix, text: ex.wdh_standard, rest: 60, timed: true };
    if (!loadable(ex)) { lo = p.lo; hi = p.hi; }
    else if (goal === "kraft") { lo = comp ? 4 : 8; hi = comp ? 6 : 12; }
    else if (goal === "hyp") { lo = comp ? 6 : 10; hi = comp ? 12 : 15; }
    else { lo = comp ? 8 : 10; hi = 15; }
    if (goal === "kraft") sets = lvl === "anfaenger" ? 3 : (comp ? 4 : 3);
    else if (goal === "hyp") sets = comp ? (lvl === "erfahren" ? 4 : 3) : (lvl === "anfaenger" ? 2 : 3);
    else sets = lvl === "anfaenger" ? 2 : (comp ? 3 : 2);
    rest = goal === "kraft" ? (comp ? 180 : 90) : goal === "hyp" ? (comp ? 120 : 75) : 75;
    if (dauer <= 45) rest = Math.min(rest, 75);
    return { sets: sets, lo: lo, hi: hi, suffix: p.suffix, text: lo + "-" + hi + (p.suffix ? " " + p.suffix : ""), rest: rest, timed: false };
  }

  function generate(a, exercises, opts) {
    opts = opts || {};
    var lvl = level(a), goal = goalType(a), E = equipSet(a), endurance = isEndurance(a);
    var injuries = (Array.isArray(a.verletzungen) ? a.verletzungen : []).filter(function (x) { return x !== "keine"; });
    var wanted = Number(a.trainingstage) || 3;
    var notes = [], G = goals(a);
    var days = endurance ? Math.min(wanted, 3) : Math.min(wanted, lvl === "erfahren" ? 6 : 5);
    if (!endurance && wanted > days) notes.push("cap_days");
    if (hasEndurance(a)) notes.push("endurance_pending");
    var muscle = G.indexOf("muskelaufbau") >= 0 || (G.indexOf("bodybuilding") >= 0 && a.bb_phase === "aufbau");
    var cut = G.indexOf("abnehmen") >= 0 || (G.indexOf("bodybuilding") >= 0 && a.bb_phase === "definition");
    if (muscle && G.indexOf("abnehmen") >= 0) notes.push("recomp");
    if ((G.indexOf("muskelaufbau") >= 0 || G.indexOf("bodybuilding") >= 0) && (G.indexOf("marathon") >= 0 || G.indexOf("triathlon") >= 0)) notes.push("endu_conflict");
    var pw = planWeeks(a, opts.today);
    pw.notes.forEach(function (n) { notes.push(n); });
    var types = split(days, lvl);
    var dauer = Number(a.dauer_min) || 60;
    var maxEx = MAXEX[dauer] || 6;
    var bb = G.indexOf("bodybuilding") >= 0 && dauer >= 75;
    var usage = {}, typeCount = {}, typeIdx = {};
    types.forEach(function (t) { typeCount[t] = (typeCount[t] || 0) + 1; });
    var pool = exercises.filter(function (ex) { return ex.kategorie !== "hyrox" && available(ex, E) && !blocked(ex, injuries) && rank(ex.level) <= rank(lvl); });

    function pick(cats, used) {
      for (var c = 0; c < cats.length; c++) {
        var cand = pool.filter(function (ex) { return ex.kategorie === cats[c] && used.indexOf(ex.id) < 0; });
        if (!cand.length) continue;
        cand = cand.map(function (ex, i) {
          var pref = COMPOUND[ex.kategorie] && !loadable(ex) ? 1 : 0; // Grundübungen bevorzugt mit Zusatzgewicht
          return { ex: ex, key: [Math.abs(rank(ex.level) - rank(lvl)), pref, usage[ex.id] || 0, i] };
        });
        cand.sort(function (x, y) { for (var i = 0; i < 4; i++) if (x.key[i] !== y.key[i]) return x.key[i] - y.key[i]; return 0; });
        return cand[0].ex;
      }
      return null;
    }

    function cats(token, n) {
      if (token === "VERT") return n % 2 === 0 ? ["push_v", "pull_v"] : ["pull_v", "push_v"];
      if (token === "STRECK_BEUG") return ["beinstrecker", "beinbeuger"];
      if (token === "griffrumpf") return ["griff", "rumpf"];
      return [token];
    }

    var sessions = types.map(function (type) {
      var n = typeIdx[type] = (typeIdx[type] === undefined ? 0 : typeIdx[type] + 1);
      var slots = SLOTS[type].slice(0, maxEx);
      if (bb && slots.length < maxEx) slots = slots.concat(EXTRA[type]).slice(0, maxEx);
      var used = [], list = [];
      slots.forEach(function (token) {
        var ex = pick(cats(token, n), used);
        if (!ex) return;
        used.push(ex.id); usage[ex.id] = (usage[ex.id] || 0) + 1;
        var s = scheme(goal, lvl, ex, dauer);
        list.push({ id: ex.id, cat: ex.kategorie, sets: s.sets, lo: s.lo, hi: s.hi, text: s.text, rest: s.rest, timed: s.timed, compound: !!COMPOUND[ex.kategorie], bodyweight: !loadable(ex), lower: !!LOWER[ex.kategorie], superset: dauer < 40 });
      });
      return { type: type, letter: typeCount[type] > 1 ? String.fromCharCode(65 + n) : "", exercises: list };
    });

    // Wochenvolumen je Muskelgruppe begrenzen
    var max = VOL_MAX[lvl], vol = volume({ sessions: sessions });
    Object.keys(vol).forEach(function (g) {
      var guard = 30;
      while (vol[g] > max && guard-- > 0) {
        var changed = false;
        for (var s = sessions.length - 1; s >= 0 && vol[g] > max; s--) {
          for (var e = sessions[s].exercises.length - 1; e >= 0 && vol[g] > max; e--) {
            var x = sessions[s].exercises[e];
            if (GROUP[x.cat] === g && x.sets > 2) { x.sets--; vol[g]--; changed = true; }
          }
        }
        if (!changed) break;
      }
    });

    sessions.forEach(function (s) { s.focus = focusOf(s.exercises); });
    return { version: 2, goal: goal, level: lvl, daysPerWeek: days, weeks: pw.weeks, sessions: sessions, notes: notes, injuries: injuries, priority: prio(a), cut: cut, muscle: muscle };
  }

  function volume(plan) {
    var v = {};
    plan.sessions.forEach(function (s) { s.exercises.forEach(function (x) { var g = GROUP[x.cat]; if (g) v[g] = (v[g] || 0) + x.sets; }); });
    return v;
  }

  // Deload jede 4. Woche: 40 % weniger Sätze
  function isDeload(week) { return week % 4 === 0; }
  function setsFor(x, week) { return isDeload(week) ? Math.max(2, Math.round(x.sets * 0.6)) : x.sets; }

  // Vorschlag für das nächste Gewicht aus dem Verlauf (neuester Eintrag zuletzt).
  // history: [{kg, reps}] der Arbeitssätze der letzten Einheiten, je Einheit eine Liste.
  function suggest(x, sessionsHistory) {
    if (x.bodyweight || x.timed || !sessionsHistory.length) return null;
    var last = sessionsHistory[sessionsHistory.length - 1].filter(function (s) { return s.kg > 0; });
    if (!last.length) return null;
    var top = Math.max.apply(null, last.map(function (s) { return s.kg; }));
    var allHit = last.length >= Math.min(x.sets, 2) && last.every(function (s) { return s.reps >= x.hi; });
    var missed = function (h) { var w = h.filter(function (s) { return s.kg > 0; }); return w.length && w.every(function (s) { return s.reps < x.lo; }); };
    var prev = sessionsHistory[sessionsHistory.length - 2];
    if (missed(sessionsHistory[sessionsHistory.length - 1]) && prev && missed(prev)) return { kg: Math.round(top * 0.92 * 2) / 2, why: "down" };
    if (allHit) return { kg: top + (x.lower ? 5 : 2.5), why: "up" };
    return { kg: top, why: "same" };
  }

  window.Plan = { planWeeks: planWeeks, prio: prio, goals: goals, focusOf: focusOf, generate: generate, volume: volume, level: level, goalType: goalType, equipSet: equipSet, available: available, blocked: blocked, isDeload: isDeload, setsFor: setsFor, suggest: suggest, split: split };
})();
