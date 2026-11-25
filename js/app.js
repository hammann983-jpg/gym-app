// Ablauf: Sprache -> Willkommen -> Fragebogen -> Ergebnis -> App mit 5 Tabs.
(function () {
  var C = window.GYM_CONFIG, KEY = "gym.v1";
  var $app = document.getElementById("app");
  var QS = [], EX = [], EXBY = {}, NAMES = {}, FOOD = null;

  function load() { try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch (e) { return {}; } }
  function save() { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) {} }
  var S = load();
  S.answers = S.answers || {};
  S.log = S.log || [];
  // Ältere Antworten (vor Version 6) auf das neue Schema bringen
  (function migrate() {
    var a = S.answers, changed = false;
    if (a.hauptziel && !a.ziele) { a.ziele = [a.hauptziel]; delete a.hauptziel; changed = true; }
    if (a.equipment && !a.ort) {
      a.ort = a.equipment.indexOf("gym_voll") >= 0 ? "studio" : "zuhause";
      if (a.ort === "zuhause") a.heim = a.equipment.map(function (k) { return k === "kurzhanteln" ? "kurzhanteln" : k === "kettlebell" ? "kettlebell" : k === "band" ? "band" : null; }).filter(Boolean).concat(a.equipment.length ? [] : ["koerper"]);
      delete a.equipment; changed = true;
    }
    if (a.ort === "zuhause" && !(a.heim && a.heim.length)) { a.heim = ["koerper"]; changed = true; }
    if (S.plan && S.plan.version !== 2) { S.plan = null; S.draft = null; changed = true; }
    if (changed) save();
  })();
  var ui = { tab: "today", sub: { progress: "training", coach: "qa", nutrition: "mealplan" }, profile: false, err: "", finish: null, planWeek: null, nday: (new Date().getDay() + 6) % 7, nopen: {}, info: null };

  var t = function (k, v) { return window.I18N.t(k, v); };
  function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function nf(n, d) { return Number(n).toLocaleString(window.I18N.lang(), { maximumFractionDigits: d == null ? 1 : d }); }
  function iso(d) { var p = function (n) { return (n < 10 ? "0" : "") + n; }; return d.getFullYear() + "-" + p(d.getMonth() + 1) + "-" + p(d.getDate()); }

  var ICONS = {
    today: '<circle cx="12" cy="12" r="8"/><path d="M12 8v4l3 2"/>',
    plan: '<rect x="4" y="5" width="16" height="15" rx="2"/><path d="M4 10h16M9 3v4M15 3v4"/>',
    progress: '<path d="M4 19V5M4 19h16M8 15l4-4 3 3 5-6"/>',
    nutrition: '<path d="M7 3v8a3 3 0 0 0 6 0V3M10 3v18M17 3c-2 2-2 6 0 8v10"/>',
    coach: '<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 4-6 8-6s8 2 8 6"/>',
    user: '<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 4-6 8-6s8 2 8 6"/>',
    check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>'
  };
  function icon(n) { return '<svg viewBox="0 0 24 24" aria-hidden="true">' + ICONS[n] + "</svg>"; }

  function setLang(code) { S.lang = code; save(); return window.I18N.init(code).then(render); }

  function optText(q, o) {
    var k1 = "o." + (q.textFrom || q.id) + "." + o, k2 = "o." + o;
    if (window.I18N.has(k1)) return t(k1);
    if (window.I18N.has(k2)) return t(k2);
    return String(o) + (q.unit ? " " + t(q.unit) : "");
  }
  function unitText(u) { return !u ? "" : (u.indexOf("u.") === 0 ? t(u) : u); }
  function logo() { return '<div class="logo"><img src="icons/mark-256.png?v=' + C.VERSION + '" alt="">' + esc(C.APP_NAME) + "</div>"; }

  function exName(id) {
    var n = NAMES[id];
    return (n && (n[window.I18N.lang()] || n.en)) || (EXBY[id] && EXBY[id].name) || id;
  }

  function langScreen() {
    return '<section class="screen">' + logo() + "<h1>" + esc(t("lang.title")) + '</h1><div class="lang-list">' +
      C.LANGS.map(function (l) {
        return '<button class="lang-btn" data-lang="' + l.code + '" lang="' + l.code + '" aria-pressed="' + (S.lang === l.code) + '">' + esc(l.label) + "</button>";
      }).join("") + "</div></section>";
  }

  function welcomeScreen() {
    return '<section class="screen">' + logo() + "<h1>" + esc(t("welcome.title")) + "</h1><p>" + esc(t("welcome.text")) +
      '</p><p class="disclaimer">' + esc(t("welcome.disclaimer")) +
      '</p><button class="btn" id="start">' + esc(t("welcome.start")) + "</button></section>";
  }

  // ---------- Fragebogen ----------
  function qList() { return window.Q.visible(QS, S.answers); }

  function questionScreen() {
    var list = qList(), idx = Math.max(0, list.findIndex(function (q) { return q.id === S.qid; }));
    var q = list[idx], v = S.answers[q.id];
    var pct = Math.round((idx / list.length) * 100);
    var h = '<div class="qwrap"><div class="qtop"><div class="qmeta"><span>' + esc(t("q.progress", { n: idx + 1, total: list.length })) +
      "</span><span>" + esc(t("sec." + q.sec)) + '</span></div><div class="bar"><i style="width:' + pct + '%"></i></div></div><div class="qbody">';
    h += '<div class="sec">' + esc(t("sec." + q.sec)) + (q.required ? "" : " · " + esc(t("q.optional"))) + "</div>";
    h += '<h2 class="qtext">' + esc(t("q." + q.id)) + "</h2>";
    if (q.hint) h += '<p class="qhint">' + esc(t("h." + q.id)) + "</p>";
    if (q.type === "number") {
      h += '<div class="numrow"><input class="num" id="num" type="number" inputmode="decimal" min="' + q.min + '" max="' + q.max + '" value="' + esc(v == null ? "" : v) + '" aria-label="' + esc(t("q." + q.id)) + '"><span class="unit">' + esc(unitText(q.unit)) + "</span></div>";
    } else if (q.type === "date") {
      h += '<div class="numrow"><input class="num" id="num" type="date" style="font-size:24px" value="' + esc(v || "") + '"></div>';
    } else {
      var opts = q.type === "yesno" ? ["ja", "nein", "keine_antwort"] : window.Q.options(q, S.answers);
      h += '<div class="opts">' + opts.map(function (o) {
        var on = q.type === "multi" ? (Array.isArray(v) && v.indexOf(o) >= 0) : v === o;
        return '<button class="opt" data-opt="' + esc(o) + '" aria-pressed="' + on + '">' + (q.type === "multi" ? '<span class="tick"></span>' : "") + "<span>" + esc(optText(q, o)) + "</span></button>";
      }).join("") + "</div>";
    }
    h += '<p class="err" id="err" role="alert">' + esc(ui.err) + "</p></div>";
    var last = idx === list.length - 1, needsNext = q.type === "number" || q.type === "date" || q.type === "multi";
    h += '<div class="qnav">' + (idx > 0 ? '<button class="btn ghost" id="back">' + esc(t("q.back")) + "</button>" : "");
    if (needsNext || last) h += '<button class="btn" id="next">' + esc(t(last ? "q.finish" : "q.next")) + "</button>";
    h += "</div>";
    if (!q.required) h += '<button class="skip" id="skip">' + esc(t("q.skip")) + "</button>";
    return h + "</div>";
  }

  function goto(offset) {
    var list = qList(), idx = list.findIndex(function (q) { return q.id === S.qid; });
    var n = idx + offset;
    ui.err = "";
    if (n >= list.length) { S.qdone = true; save(); render(); return; }
    if (n < 0) { S.welcomed = false; save(); render(); return; }
    S.qid = list[n].id; save(); render();
  }

  function currentQ() { var list = qList(); return list.find(function (q) { return q.id === S.qid; }) || list[0]; }

  function tryNext() {
    var q = currentQ(), v = S.answers[q.id];
    if (q.type === "number" || q.type === "date") {
      var el = document.getElementById("num");
      v = el ? el.value : v;
      if (q.type === "number" && v !== "") v = window.Q.num(v);
      if (v === "" || (typeof v === "number" && isNaN(v))) v = null;
      if (v == null) delete S.answers[q.id]; else S.answers[q.id] = v;
    }
    if (!window.Q.valid(q, S.answers[q.id])) {
      ui.err = q.type === "number" ? t("q.invalid", { min: q.min, max: q.max }) : t("q.invalid", { min: "", max: "" });
      render(); return;
    }
    goto(1);
  }

  function pickOption(q, o) {
    var a = S.answers;
    if (q.type === "multi") {
      var cur = Array.isArray(a[q.id]) ? a[q.id].slice() : [], i = cur.indexOf(o);
      if (i >= 0) cur.splice(i, 1);
      else {
        if (q.exclusive && o === q.exclusive) cur = [];
        else if (q.exclusive) cur = cur.filter(function (x) { return x !== q.exclusive; });
        cur.push(o);
      }
      a[q.id] = cur; save(); render();
    } else {
      a[q.id] = (typeof q.options?.[0] === "number") ? Number(o) : o;
      save();
      setTimeout(function () { goto(1); }, 120);
      render();
    }
  }

  function resultScreen() {
    var sc = window.Q.screening(S.answers);
    if (sc.red) {
      return '<section class="screen">' + logo() + '<h1 style="font-size:36px">' + esc(t("res.red.title")) + '</h1><div class="note red">' + esc(t("res.red.text")) + '</div><button class="btn" id="redchange">' + esc(t("res.red.change")) + "</button></section>";
    }
    var a = S.answers, G = window.Plan.goals(a), pr = window.Plan.prio(a), pw = window.Plan.planWeeks(a);
    var goal = t("o.ziele." + pr);
    var h = '<section class="screen">' + logo() + "<h1>" + esc(t("res.title")) + "</h1><p>" + esc(t("res.sub")) + '</p><div class="stats">' +
      '<div class="stat"><small>' + esc(t("res.goal")) + "</small><b>" + esc(goal) + "</b></div>" +
      '<div class="stat"><small>' + esc(t("res.weeks")) + "</small><b>" + pw.weeks + " " + esc(t("u.weeks")) + "</b></div>" +
      '<div class="stat"><small>' + esc(t("res.bmi")) + "</small><b>" + (sc.bmi ? sc.bmi.toLocaleString(window.I18N.lang(), { minimumFractionDigits: 1, maximumFractionDigits: 1 }) : "–") + "</b></div>" +
      '<div class="stat"><small>' + esc(t("res.days")) + "</small><b>" + esc(a.trainingstage) + "</b></div></div>";
    if (G.length > 1) h += '<div class="note">' + esc(t("res.goals")) + ": " + esc(G.map(function (g) { return t("o.ziele." + g); }).join(", ")) + "</div>";
    if (sc.yellow) h += '<div class="note warn">' + esc(t("res.flag.yellow")) + "</div>";
    if (sc.nutriOff) h += '<div class="note">' + esc(t("res.flag.nutri")) + "</div>";
    return h + '<button class="btn" id="open">' + esc(t("res.open")) + "</button></section>";
  }

  // ---------- Plan und Training ----------
  function ensurePlan() {
    if (!S.plan && EX.length && window.Plan.prio(S.answers)) { S.plan = window.Plan.generate(S.answers, EX); S.done = 0; S.draft = null; save(); }
    return S.plan;
  }
  function sessionTitle(s) { return t("day." + s.type) + (s.letter ? " " + s.letter : ""); }
  // Große Überschrift: die trainierten Muskelgruppen (Ganzkörper behält seinen Namen)
  function headline(s) {
    if (s.type === "fb" || !s.focus || !s.focus.length) return sessionTitle(s);
    return s.focus.map(function (f) { return t("focus." + f); }).join(" · ");
  }
  function focusLine(s) { return (s.focus || []).map(function (f) { return t("focus." + f); }).join(" · "); }
  function cur() {
    var n = S.plan.sessions.length, seq = S.done || 0;
    return { idx: seq % n, week: Math.floor(seq / n) + 1, seq: seq };
  }
  function history(id) {
    return S.log.map(function (l) { var e = l.ex.find(function (x) { return x.id === id; }); return e ? e.sets : null; }).filter(Boolean);
  }
  function fmtRest(s) {
    if (s < 60) return s + " s";
    var m = Math.floor(s / 60), r = s % 60;
    return (r ? m + ":" + (r < 10 ? "0" : "") + r : m) + " " + t("today.min");
  }
  function weekGoalDone() {
    var d = new Date(), day = (d.getDay() + 6) % 7, start = new Date(d.getFullYear(), d.getMonth(), d.getDate() - day);
    var s = iso(start);
    return S.log.filter(function (l) { return l.date >= s; }).length;
  }
  function ring(done, total) {
    var C2 = 2 * Math.PI * 27, f = total ? Math.min(1, done / total) : 0;
    return '<div class="ring"><svg width="64" height="64" viewBox="0 0 64 64"><circle cx="32" cy="32" r="27" fill="none" stroke="var(--surface-2)" stroke-width="7"/><circle cx="32" cy="32" r="27" fill="none" stroke="var(--accent)" stroke-width="7" stroke-linecap="round" stroke-dasharray="' + C2.toFixed(1) + '" stroke-dashoffset="' + (C2 * (1 - f)).toFixed(1) + '" transform="rotate(-90 32 32)"/></svg><span>' + done + "/" + total + "</span></div>";
  }
  function notesHtml() {
    return (S.plan.notes || []).map(function (n) {
      var txt = n === "cap_days" ? t("note.cap_days", { n: S.plan.daysPerWeek }) : n === "endurance_pending" ? t("note.endurance") : n === "recomp" ? t("note.recomp") : n === "endu_conflict" ? t("note.endu_conflict") : n === "event_soon" ? t("note.event_soon") : "";
      return txt ? '<div class="note">' + esc(txt) + "</div>" : "";
    }).join("");
  }

  function ensureDraft(c) {
    var s = S.plan.sessions[c.idx];
    if (S.draft && S.draft.seq === c.seq) return S.draft;
    var d = { seq: c.seq, ex: {} };
    s.exercises.forEach(function (x) {
      var n = window.Plan.setsFor(x, c.week), arr = [];
      for (var i = 0; i < n; i++) arr.push({ kg: "", reps: "", done: false });
      d.ex[x.id] = arr;
    });
    S.draft = d; save();
    return d;
  }

  function todayView() {
    if (ui.finish) {
      var f = ui.finish, h = '<div class="card done"><h3>' + esc(t("today.done.title")) + '</h3><div class="stats two"><div class="stat"><small>' + esc(t("today.done.vol")) + "</small><b>" + nf(f.vol, 0) + ' kg</b></div><div class="stat"><small>' + esc(t("today.done.sets")) + "</small><b>" + f.sets + "</b></div></div>";
      f.prs.forEach(function (p) { h += '<div class="note warn">' + esc(t("today.done.pr")) + ": " + esc(p) + "</div>"; });
      return h + '<button class="btn" id="finok">' + esc(t("today.done.ok")) + "</button></div>";
    }
    var p = ensurePlan();
    if (!p) return "";
    var c = cur(), s = p.sessions[c.idx], d = ensureDraft(c), deload = window.Plan.isDeload(c.week);
    var goal = p.sessions.length, got = weekGoalDone();
    var h = '<div class="sec">' + esc(t("today.next")) + (s.type === "fb" ? "" : " · " + esc(sessionTitle(s))) + '</div><h2 class="big">' + esc(headline(s)) + '</h2><div class="chips"><span class="pill acc">' + esc(t("today.week", { n: Math.min(c.week, p.weeks), total: p.weeks })) + '</span><span class="pill">' + esc(t("today.exercises", { n: s.exercises.length })) + "</span></div>";
    if (c.week > p.weeks) h += '<div class="note warn">' + esc(t("today.blockdone")) + "</div>";
    if (deload) h += '<div class="note warn">' + esc(t("today.deload")) + "</div>";
    h += '<div class="card ringrow">' + ring(got, goal) + "<div><h3>" + esc(t("today.goal")) + "</h3><p>" + esc(t("today.of", { done: got, total: goal })) + "</p></div></div>";
    h += notesHtml();
    h += '<p class="qhint">' + esc(t("today.hint")) + "</p>";
    s.exercises.forEach(function (x, i) {
      var hist = history(x.id), sug = window.Plan.suggest(x, hist), n = d.ex[x.id].length;
      h += '<div class="card ex"><div class="exhead"><span class="n">' + (i + 1) + '</span><div class="exname"><b>' + esc(exName(x.id)) + "</b><small>" +
        esc(t("today.setsline", { sets: n, reps: x.text, rest: fmtRest(x.rest) })) + '</small></div><button class="tipbtn" data-info="' + x.id + '">' + esc(t("info.btn")) + "</button></div>";
      if (sug) h += '<div class="sug">' + esc(t("today.sug." + sug.why, { kg: nf(sug.kg, 2) })) + "</div>";
      if (x.superset && i === 0) h += '<div class="sug">' + esc(t("today.superset")) + "</div>";
      d.ex[x.id].forEach(function (r, j) {
        var ph = sug ? nf(sug.kg, 2) : "";
        h += '<div class="setrow"><span class="sl">' + esc(t("today.set")) + " " + (j + 1) + "</span>";
        if (!x.bodyweight && !x.timed) h += '<label class="f"><input type="text" inputmode="decimal" data-ex="' + x.id + '" data-set="' + j + '" data-f="kg" placeholder="' + esc(ph) + '" value="' + esc(r.kg) + '" aria-label="' + esc(t("today.kg")) + '"><i>' + esc(t("today.kg")) + "</i></label>";
        h += '<label class="f"><input type="text" inputmode="numeric" data-ex="' + x.id + '" data-set="' + j + '" data-f="reps" placeholder="' + (x.hi || "") + '" value="' + esc(r.reps) + '" aria-label="' + esc(x.timed ? t("today.sec") : t("today.reps")) + '"><i>' + esc(x.timed ? t("today.sec") : t("today.reps")) + "</i></label>";
        h += '<button class="chk" data-chk="' + x.id + ":" + j + '" aria-pressed="' + r.done + '" aria-label="OK">' + icon("check") + "</button></div>";
      });
      h += "</div>";
    });
    h += '<p class="err" id="err" role="alert">' + esc(ui.err) + '</p><button class="btn" id="finish">' + esc(t("today.finish")) + "</button>";
    return h;
  }

  function num(v) { var n = parseFloat(String(v).replace(",", ".")); return isFinite(n) ? n : 0; }

  function finishSession() {
    var c = cur(), s = S.plan.sessions[c.idx], d = S.draft, vol = 0, sets = 0, prs = [], entry = { date: iso(new Date()), seq: c.seq, week: c.week, type: s.type, letter: s.letter, ex: [], vol: 0 };
    s.exercises.forEach(function (x) {
      var done = (d.ex[x.id] || []).filter(function (r) { return r.done; }).map(function (r) { return { kg: num(r.kg), reps: num(r.reps) }; });
      if (!done.length) return;
      var prevMax = 0; history(x.id).forEach(function (h) { h.forEach(function (r) { if (r.kg > prevMax) prevMax = r.kg; }); });
      var mx = 0;
      done.forEach(function (r) { vol += r.kg * r.reps; sets++; if (r.kg > mx) mx = r.kg; });
      if (prevMax > 0 && mx > prevMax) prs.push(exName(x.id) + " " + nf(mx, 2) + " kg");
      entry.ex.push({ id: x.id, sets: done });
    });
    if (!sets) { ui.err = t("today.nosets"); render(); return; }
    entry.vol = vol; S.log.push(entry); S.done = (S.done || 0) + 1; S.draft = null; ui.err = "";
    ui.finish = { vol: vol, sets: sets, prs: prs }; save(); render();
  }

  function planView() {
    var p = ensurePlan();
    if (!p) return "";
    var c = cur(), w = ui.planWeek || Math.min(c.week, p.weeks), n = p.sessions.length;
    var h = '<div class="weeks">' + Array.from({ length: p.weeks }, function (_, i) { var k = i + 1; return '<button data-week="' + k + '" aria-pressed="' + (k === w) + '"' + (k === Math.min(c.week, p.weeks) ? ' class="now"' : "") + ">" + k + (window.Plan.isDeload(k) ? "·" : "") + "</button>"; }).join("") + "</div>";
    h += '<div class="sec">' + esc(t("plan.week")) + " " + w + (window.Plan.isDeload(w) ? " · " + esc(t("plan.deloadnote")) : "") + "</div>";
    if (window.Plan.isDeload(w)) h += '<div class="note warn">' + esc(t("today.deload")) + "</div>";
    h += notesHtml();
    p.sessions.forEach(function (s, i) {
      var isDone = (S.done || 0) > (w - 1) * n + i;
      h += '<div class="card psess"><div class="phead"><div><h3>' + esc(headline(s)) + "</h3><small class=\"fl\">" + esc(sessionTitle(s) + (s.type === "fb" ? " · " + focusLine(s) : "")) + "</small></div>" + (isDone ? '<span class="pill acc">' + icon("check") + "</span>" : "") + "</div>";
      s.exercises.forEach(function (x) {
        h += '<div class="pex"><span>' + esc(exName(x.id)) + "</span><span>" + window.Plan.setsFor(x, w) + " × " + esc(x.text) + "</span></div>";
      });
      h += "</div>";
    });
    return h;
  }

  function historyView() {
    if (!S.log.length) return "";
    var h = '<div class="sec">' + esc(t("prog.history")) + "</div>";
    S.log.slice().reverse().slice(0, 30).forEach(function (l) {
      var sets = l.ex.reduce(function (a, e) { return a + e.sets.length; }, 0);
      var d = new Date(l.date + "T12:00:00");
      h += '<div class="card hist"><div><b>' + esc(t("day." + l.type) + (l.letter ? " " + l.letter : "")) + "</b><small>" + esc(d.toLocaleDateString(window.I18N.lang(), { weekday: "short", day: "numeric", month: "short" })) + "</small></div><span>" + esc(t("prog.entry", { vol: nf(l.vol, 0), sets: sets })) + "</span></div>";
    });
    return h;
  }

  // ---------- App ----------
  var TABS = ["today", "plan", "progress", "nutrition", "coach"];
  var SUBS = { progress: ["training", "weight", "results", "races"], coach: ["qa", "goals"], nutrition: ["mealplan", "shopping"] };

  // ---------- Ernährung ----------
  function foodName(id) { var n = FOOD.foods[id].n; return n[window.I18N.lang()] || n.en; }
  function mealTitle(m) { return m.t[window.I18N.lang()] || m.t.en; }
  function itemText(it) { return (it.count > 0 ? it.count + " × " : it.amount + " g ") + foodName(it.id); }
  function nutriWeek() { runAuto(); return window.Nutrition.week(S.answers, FOOD, new Date(), S.nswap && S.nswap[window.Nutrition.weekInfo(new Date()).key], S.kcalAdj || 0); }

  // ---------- Fortschritt: Gewicht, Ergebnisse, Rennen ----------
  function sortedWeights() { return (S.weights || []).slice().sort(function (a, b) { return a.date < b.date ? -1 : 1; }); }
  function goalMode() {
    var base = window.Nutrition.targets(S.answers, 0);
    if (!base) return null;
    return base.adj < 0 ? "cut" : base.adj > 0 ? "muscle" : "hold";
  }
  function weightAdvice() {
    var mode = goalMode(), ws = sortedWeights();
    if (!mode) return null;
    var beginner = S.answers.kraft_erfahrung === "noch_nie" || S.answers.kraft_erfahrung === "unter_6";
    var adv = window.Progress.advice(mode, beginner, ws, iso(new Date()));
    adv.mode = mode; return adv;
  }
  // passt das Kalorienziel automatisch an (frühestens alle 14 Tage, höchstens ±300 kcal)
  function runAuto() {
    var adv = weightAdvice(), ws = sortedWeights();
    if (!adv || !ws.length) return;
    var log = S.kcalLog || [], last = log.length ? log[log.length - 1].date : null;
    var d = window.Progress.autoAdjust(adv, S.kcalAdj || 0, last, iso(new Date()), ws[0].date);
    if (d !== 0) { S.kcalAdj = (S.kcalAdj || 0) + d; S.kcalLog = log.concat([{ date: iso(new Date()), delta: d, state: adv.state }]); save(); }
  }

  function chartSvg(pts, goal) {
    var W = 320, H = 150, pad = 26;
    var ys = pts.map(function (p) { return Number(p.kg); }).concat(goal ? [goal] : []);
    var lo = Math.min.apply(null, ys) - 0.5, hi = Math.max.apply(null, ys) + 0.5;
    var xs = pts.map(function (p) { return new Date(p.date + "T12:00:00").getTime(); }), x0 = Math.min.apply(null, xs), x1 = Math.max.apply(null, xs);
    function X(v) { return x1 === x0 ? W / 2 : pad + (v - x0) / (x1 - x0) * (W - 2 * pad); }
    function Y(v) { return H - pad + 6 - (v - lo) / (hi - lo) * (H - 2 * pad); }
    var line = pts.map(function (p, i) { return (i ? "L" : "M") + X(xs[i]).toFixed(1) + " " + Y(Number(p.kg)).toFixed(1); }).join(" ");
    var s = '<svg class="chart" viewBox="0 0 ' + W + " " + H + '" role="img" aria-label="' + esc(t("weight.trend")) + '">';
    if (goal) s += '<line x1="' + pad + '" x2="' + (W - pad) + '" y1="' + Y(goal).toFixed(1) + '" y2="' + Y(goal).toFixed(1) + '" stroke="var(--accent-2)" stroke-dasharray="4 4" stroke-width="1.5"/>';
    s += '<path d="' + line + '" fill="none" stroke="var(--accent)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>';
    pts.forEach(function (p, i) { s += '<circle cx="' + X(xs[i]).toFixed(1) + '" cy="' + Y(Number(p.kg)).toFixed(1) + '" r="3.5" fill="var(--accent)"/>'; });
    s += '<text x="4" y="' + (Y(hi - 0.5) + 4) + '" fill="var(--muted)" font-size="10">' + nf(hi - 0.5, 1) + '</text><text x="4" y="' + (Y(lo + 0.5) + 4) + '" fill="var(--muted)" font-size="10">' + nf(lo + 0.5, 1) + "</text></svg>";
    return s;
  }

  function weightView() {
    var ws = sortedWeights(), h = '<div class="card ci"><div class="cirow"><label class="f"><input type="text" inputmode="decimal" id="wkg" placeholder="' + (ws.length ? nf(ws[ws.length - 1].kg, 1) : "") + '" aria-label="' + esc(t("weight.kg")) + '"><i>kg</i></label><input type="date" id="wdate" value="' + iso(new Date()) + '" aria-label="' + esc(t("weight.date")) + '"><button class="btn" id="wsave">' + esc(t("weight.save")) + '</button></div><p class="err" id="werr" role="alert">' + esc(ui.err) + "</p></div>";
    if (ws.length) {
      var last = ws[ws.length - 1], first = ws[0], ch = Number(last.kg) - Number(first.kg), goal = Number(S.answers.zielgewicht_kg) || 0;
      h += '<div class="stats">' + '<div class="stat"><small>' + esc(t("weight.last")) + "</small><b>" + nf(last.kg, 1) + " kg</b></div>" +
        '<div class="stat"><small>' + esc(t("weight.change")) + "</small><b>" + (ch > 0 ? "+" : "") + nf(ch, 1) + " kg</b></div>" +
        '<div class="stat"><small>' + esc(t("weight.goal")) + "</small><b>" + (goal ? nf(goal, 1) + " kg" : "–") + "</b></div></div>";
      if (ws.length >= 2) h += '<div class="card chartc">' + chartSvg(ws.slice(-24), goal) + "</div>";
      var adv = weightAdvice();
      if (adv && adv.state === "wait") h += '<div class="note">' + esc(t("weight.wait")) + "</div>";
      else if (adv) {
        h += '<div class="note ' + (adv.state === "ontrack" ? "" : "warn") + '"><b>' + esc(t("weight.trend")) + ":</b> " + esc(t("weight.perweek", { kg: (adv.rate > 0 ? "+" : "") + nf(adv.rate, 2), pct: nf(adv.pct, 2) })) + "<br>" + esc(adv.state === "ontrack" ? t("weight.adv.ontrack") : t("weight.adv." + adv.mode + "." + adv.state)) + "</div>";
      }
      if (S.kcalAdj) h += '<div class="note">' + esc(t("weight.adj", { n: (S.kcalAdj > 0 ? "+" : "") + S.kcalAdj })) + "</div>";
      h += '<div class="sec">' + esc(t("weight.history")) + "</div>";
      ws.slice().reverse().slice(0, 20).forEach(function (w) {
        h += '<div class="card hist"><div><b>' + nf(w.kg, 1) + " kg</b><small>" + esc(new Date(w.date + "T12:00:00").toLocaleDateString(window.I18N.lang(), { weekday: "short", day: "numeric", month: "short", year: "numeric" })) + '</small></div><button class="swap" data-wdel="' + w.date + '">' + esc(t("weight.delete")) + "</button></div>";
      });
    } else h += '<div class="note">' + esc(t("weight.wait")) + "</div>";
    return h;
  }

  function resultsView() {
    var lang = window.I18N.lang(), R = S.results || [], h = "";
    var lifts = EX.filter(function (e) { return ["kniebeuge", "hinge", "push_h", "push_schraeg", "push_v", "pull_v", "pull_h", "ausfall"].indexOf(e.kategorie) >= 0 && e.equipment.some(function (q) { return q !== "koerper"; }); });
    h += '<div class="card ci"><h3>' + esc(t("rs.strength")) + '</h3><select id="lift" aria-label="' + esc(t("rs.exercise")) + '">' + lifts.map(function (e) { return '<option value="' + e.id + '">' + esc(exName(e.id)) + "</option>"; }).join("") +
      '</select><div class="cirow"><label class="f"><input type="text" inputmode="decimal" id="lkg" aria-label="' + esc(t("rs.kg")) + '"><i>kg</i></label><label class="f"><input type="text" inputmode="numeric" id="lreps" aria-label="' + esc(t("rs.reps")) + '"><i>' + esc(t("today.reps")) + '</i></label></div><button class="btn" id="lsave">' + esc(t("rs.save")) + '</button><p class="err" id="lerr" role="alert">' + esc(ui.err2 || "") + "</p></div>";
    var best = {};
    R.filter(function (r) { return r.type === "lift"; }).forEach(function (r) { var e = window.Progress.e1rm(r.kg, r.reps); if (!best[r.ex] || e > best[r.ex].e) best[r.ex] = { e: e, kg: r.kg, reps: r.reps, date: r.date }; });
    Object.keys(best).forEach(function (id) { h += '<div class="card hist"><div><b>' + esc(exName(id)) + "</b><small>" + esc(t("rs.best")) + ": " + nf(best[id].kg, 2) + " kg × " + best[id].reps + "</small></div><span>" + esc(t("rs.e1rm")) + ": <b>" + nf(best[id].e, 1) + " kg</b></span></div>"; });
    h += '<div class="card ci" style="margin-top:14px"><h3>' + esc(t("rs.run")) + '</h3><select id="rdist" aria-label="' + esc(t("rs.distance")) + '">' + ["5k", "10k", "hm", "m"].map(function (k) { return '<option value="' + k + '">' + esc(t("dist." + k)) + "</option>"; }).join("") +
      '</select><div class="cirow"><input type="text" id="rtime" inputmode="text" placeholder="25:30" aria-label="' + esc(t("rs.time")) + '"></div><button class="btn" id="rsave">' + esc(t("rs.save")) + '</button><p class="err" id="rerr" role="alert">' + esc(ui.err3 || "") + "</p></div>";
    var runs = R.filter(function (r) { return r.type === "run"; });
    if (runs.length) {
      var lr = runs[runs.length - 1], km = window.Progress.DIST[lr.dist];
      h += '<div class="card"><h3>' + esc(t("dist." + lr.dist)) + ": " + window.Progress.fmtTime(lr.sec) + '</h3><p>' + esc(t("rs.pace")) + ": " + window.Progress.fmtTime(window.Progress.pace(lr.sec, km)) + " " + esc(t("rs.perkm")) + "</p>";
      h += '<div class="sec" style="margin-top:6px">' + esc(t("rs.predict")) + "</div>";
      ["5k", "10k", "hm", "m"].filter(function (k) { return k !== lr.dist; }).forEach(function (k) {
        var s = window.Progress.riegel(lr.sec, km, window.Progress.DIST[k]);
        h += '<div class="pex"><span>' + esc(t("dist." + k)) + "</span><span>" + window.Progress.fmtTime(s) + " · " + window.Progress.fmtTime(window.Progress.pace(s, window.Progress.DIST[k])) + " " + esc(t("rs.perkm")) + "</span></div>";
      });
      h += '<p class="qhint">' + esc(t("rs.predictnote")) + "</p></div>";
    }
    if (!R.length) h += '<p class="qhint">' + esc(t("rs.none")) + "</p>";
    return h;
  }

  function racesView() {
    var today = iso(new Date()), races = (S.races || []).slice(), G = window.Plan.goals(S.answers), h = "";
    if (S.answers.event_datum && !races.some(function (r) { return r.fromGoal; })) races.push({ id: "goal", name: t("race.fromgoal"), date: S.answers.event_datum, type: "other", fromGoal: true });
    races.sort(function (a, b) { return a.date < b.date ? -1 : 1; });
    h += '<div class="card ci"><h3>' + esc(t("race.add")) + '</h3><input type="text" id="rname" placeholder="' + esc(t("race.name")) + '" aria-label="' + esc(t("race.name")) + '"><div class="cirow"><input type="date" id="rdate" aria-label="' + esc(t("race.date")) + '"><select id="rtype" aria-label="' + esc(t("race.type")) + '">' +
      ["5k", "10k", "hm", "m"].map(function (k) { return '<option value="' + k + '">' + esc(t("dist." + k)) + "</option>"; }).join("") + '<option value="tri">' + esc(t("race.tri")) + '</option><option value="hyrox">Hyrox</option><option value="other">' + esc(t("race.other")) + '</option></select></div><button class="btn" id="racesave">' + esc(t("race.save")) + '</button><p class="err" id="raceerr" role="alert">' + esc(ui.err4 || "") + "</p></div>";
    if (!races.length) return h + '<p class="qhint">' + esc(t("race.none")) + "</p>";
    races.forEach(function (r) {
      var n = window.Progress.daysUntil(r.date, today), past = n < 0;
      h += '<div class="card race"><div class="phead"><div><h3>' + esc(r.name) + "</h3><small class=\"fl\">" + esc(new Date(r.date + "T12:00:00").toLocaleDateString(window.I18N.lang(), { day: "numeric", month: "long", year: "numeric" })) + "</small></div>" +
        '<span class="pill ' + (past ? "" : "acc") + '">' + esc(past ? t("race.past") : n === 0 ? t("race.today") : t("race.countdown", { n: n })) + "</span></div>";
      if (past) h += r.result ? "<p>" + esc(t("race.result")) + ": <b>" + esc(r.result) + "</b></p>" : '<div class="cirow"><input type="text" data-rres="' + r.id + '" placeholder="' + esc(t("race.result")) + ' (h:mm:ss)" aria-label="' + esc(t("race.result")) + '"><button class="swap" data-rressave="' + r.id + '">' + esc(t("race.save")) + "</button></div>";
      if (!r.fromGoal) h += '<button class="swap" data-rdel="' + r.id + '" style="align-self:flex-start">' + esc(t("race.delete")) + "</button>";
      h += "</div>";
    });
    return h;
  }

  function nutritionView() {
    if (!FOOD || !S.answers.ernaehrungsform) return "";
    var w = nutriWeek(), tg = w.targets, h = "";
    if (ui.sub.nutrition === "shopping") {
      var done = (S.shop && S.shop[w.info.key]) || {};
      h += '<div class="sec">' + esc(t("nutri.shop.title")) + '</div><p class="qhint">' + esc(t("nutri.shop.hint")) + '</p><div class="card shoplist">';
      window.Nutrition.shopping(w).sort(function (x, y) { return foodName(x.id).localeCompare(foodName(y.id), window.I18N.lang()); }).forEach(function (it) {
        h += '<button class="shop" data-shop="' + it.id + '" aria-pressed="' + !!done[it.id] + '"><span class="tick"></span><span class="sn">' + esc(foodName(it.id)) + '</span><span class="sa">' + (it.count > 0 ? it.count + " ×" : nf(it.amount, 0) + " g") + "</span></button>";
      });
      return h + "</div>";
    }
    if (tg) {
      h += '<div class="card target"><div class="tk"><small>' + esc(t("nutri.target")) + "</small><b>" + nf(tg.kcal, 0) + " <i>" + esc(t("nutri.kcal")) + "</i></b></div><div class=\"macros\">" +
        '<div><small>' + esc(t("nutri.protein")) + "</small><b>" + tg.protein + " g</b></div><div><small>" + esc(t("nutri.carbs")) + "</small><b>" + tg.carbs + " g</b></div><div><small>" + esc(t("nutri.fat")) + "</small><b>" + tg.fat + " g</b></div><div><small>" + esc(t("nutri.water")) + "</small><b>" + nf(tg.water, 1) + " l</b></div></div></div>";
      if (tg.notes.indexOf("min") >= 0) h += '<div class="note warn">' + esc(t("nutri.note.min")) + "</div>";
      else if (tg.notes.indexOf("cut") >= 0) h += '<div class="note">' + esc(t("nutri.note.cut", { kg: nf(Math.abs(tg.weeklyKg), 2) })) + "</div>";
      else if (tg.notes.indexOf("muscle") >= 0) h += '<div class="note">' + esc(t("nutri.note.muscle")) + "</div>";
    } else h += '<div class="note">' + esc(t("nutri.off")) + "</div>";
    var d = w.days[ui.nday] || w.days[0], lang = window.I18N.lang();
    var mon = w.info.monday;
    h += '<div class="sec">' + esc(t("nutri.week", { d: mon.toLocaleDateString(lang, { day: "numeric", month: "long" }) })) + '</div><div class="days">';
    for (var i = 0; i < 7; i++) {
      var dd = new Date(mon.getFullYear(), mon.getMonth(), mon.getDate() + i);
      h += '<button data-nday="' + i + '" aria-pressed="' + (i === ui.nday) + '"><small>' + esc(dd.toLocaleDateString(lang, { weekday: "short" })) + "</small><b>" + dd.getDate() + "</b></button>";
    }
    h += "</div>";
    d.slots.forEach(function (s) {
      var key = d.day + "|" + s.index, open = !!ui.nopen[key];
      h += '<div class="card meal"><div class="mhead"><span class="sec">' + esc(t("slot." + s.slot)) + '</span><button class="swap" data-swap="' + key + '"' + (s.pool < 2 ? " disabled" : "") + ">" + esc(t("nutri.swap")) + "</button></div>" +
        '<button class="mtitle" data-mopen="' + key + '" aria-expanded="' + open + '"><b>' + esc(mealTitle(s.meal)) + "</b></button><small>" +
        (tg ? s.kcal + " " + esc(t("nutri.kcal")) + " · " + s.p + " g " + esc(t("nutri.protein")) + " · " : "") + esc(t("nutri.min", { n: s.meal.prep })) + "</small>";
      if (open) h += '<ul class="ing">' + s.items.map(function (it) { return "<li>" + esc(itemText(it)) + "</li>"; }).join("") + "</ul>";
      h += "</div>";
    });
    if (tg) {
      h += '<div class="card daytotal"><span>' + esc(t("nutri.total")) + "</span><b>" + d.kcal + " " + esc(t("nutri.kcal")) + " · " + d.p + " g " + esc(t("nutri.protein")) + "</b></div>";
      if (d.p < tg.protein * 0.85) h += '<div class="note warn">' + esc(t("nutri.proteinhint")) + "</div>";
    }
    return h + '<p class="qhint">' + esc(t("nutri.weeknote")) + " " + esc(t("nutri.disc")) + "</p>";
  }

  function coachView() {
    if (ui.sub.coach === "goals") {
      var G = window.Plan.goals(S.answers);
      return '<div class="card"><h3>' + esc(t("coach.goals.title")) + "</h3><p>" + esc(G.map(function (g) { return t("o.ziele." + g); }).join(", ")) + "</p><p>" + esc(t("coach.goals.text")) + '</p><button class="btn" id="chgoals">' + esc(t("coach.goals.change")) + "</button></div>";
    }
    var f = (ui.qaq || "").toLowerCase();
    var items = EX.filter(function (e) { return e.kategorie !== "hyrox" && (!f || exName(e.id).toLowerCase().indexOf(f) >= 0); });
    var h = '<p class="qhint">' + esc(t("coach.qa.hint")) + '</p><input class="search" id="qasearch" type="search" placeholder="' + esc(t("coach.qa.search")) + '" value="' + esc(ui.qaq || "") + '" aria-label="' + esc(t("coach.qa.search")) + '"><div class="qalist">';
    h += items.map(function (e) { return '<button class="qaitem" data-info="' + e.id + '"><span>' + esc(exName(e.id)) + "</span><small>" + esc((e.muskeln || []).slice(0, 2).join(", ")) + "</small></button>"; }).join("");
    return h + (items.length ? "" : "<p>" + esc(t("coach.qa.none")) + "</p>") + "</div>";
  }

  function emptyCard(tab) {
    return '<div class="card"><h3>' + esc(t("empty." + tab + ".title")) + "</h3><p>" + esc(t("empty." + tab + ".text")) + "</p></div>";
  }

  function shell() {
    var tab = ui.tab, h = '<header class="top"><span class="brand"><img src="icons/mark-256.png?v=' + C.VERSION + '" alt="">' + esc(C.APP_NAME) +
      '</span><button class="icon-btn" id="prof" aria-label="' + esc(t("profile.title")) + '">' + icon("user") + "</button></header><main>";
    if (tab !== "today" || ui.finish) h += "<h2>" + esc(t("tab." + tab)) + "</h2>";
    if (SUBS[tab]) {
      h += '<div class="seg" role="tablist">' + SUBS[tab].map(function (s) {
        return '<button role="tab" data-sub="' + s + '" aria-selected="' + (ui.sub[tab] === s) + '">' + esc(t("sub." + s)) + "</button>";
      }).join("") + "</div>";
    }
    var body = "";
    if (tab === "today") body = todayView();
    else if (tab === "plan") body = planView();
    else if (tab === "progress" && ui.sub.progress === "training") body = historyView();
    else if (tab === "progress" && ui.sub.progress === "weight") body = weightView();
    else if (tab === "progress" && ui.sub.progress === "results") body = resultsView();
    else if (tab === "progress" && ui.sub.progress === "races") body = racesView();
    else if (tab === "coach") body = coachView();
    else if (tab === "nutrition") body = nutritionView();
    h += body || emptyCard(tab);
    h += "</main>";
    h += '<nav class="tabs"><div class="inner">' + TABS.map(function (k) {
      return '<button data-tab="' + k + '"' + (k === tab ? ' aria-current="page"' : "") + ">" + icon(k) + "<span>" + esc(t("tab." + k)) + "</span></button>";
    }).join("") + "</div></nav>";
    if (ui.profile) h += profileSheet();
    if (ui.info) h += infoSheet(ui.info);
    return h;
  }

  function list(arr) { return '<ul class="tips">' + arr.map(function (x) { return "<li>" + esc(x) + "</li>"; }).join("") + "</ul>"; }
  function infoSheet(id) {
    var e = EXBY[id]; if (!e) return "";
    var lang = window.I18N.lang(), q = encodeURIComponent(exName(id) + (lang === "de" ? " Technik" : lang === "es" ? " técnica" : lang === "fr" ? " technique" : " form technique"));
    var h = '<div class="sheet-bg" id="infobg"><div class="sheet" role="dialog" aria-modal="true"><h2>' + esc(exName(id)) + "</h2>";
    if (lang !== "de" && t("info.de_only")) h += '<div class="note">' + esc(t("info.de_only")) + "</div>";
    h += '<div class="lbl">' + esc(t("info.muscles")) + ": " + esc((e.muskeln || []).join(", ")) + "</div>";
    h += "<h3>" + esc(t("info.cues")) + "</h3>" + list(e.cues || []);
    if ((e.fehler || []).length) h += "<h3>" + esc(t("info.mistakes")) + "</h3>" + list(e.fehler);
    if (e.atmung) h += "<h3>" + esc(t("info.breath")) + "</h3><p>" + esc(e.atmung) + "</p>";
    if (e.sicherheit) h += "<h3>" + esc(t("info.safety")) + '</h3><p>' + esc(e.sicherheit) + "</p>";
    if (e.leichter) h += '<p class="lbl">' + esc(t("info.easier")) + ": " + esc(e.leichter) + "</p>";
    if (e.schwerer) h += '<p class="lbl">' + esc(t("info.harder")) + ": " + esc(e.schwerer) + "</p>";
    h += '<a class="btn vid" target="_blank" rel="noopener noreferrer" href="https://www.youtube.com/results?search_query=' + q + '">' + esc(t("info.video")) + '</a><button class="btn ghost" id="infoclose">' + esc(t("info.close")) + "</button></div></div>";
    return h;
  }

  function profileSheet() {
    return '<div class="sheet-bg" id="bg"><div class="sheet" role="dialog" aria-modal="true"><h2>' + esc(t("profile.title")) + "</h2>" +
      '<div><div class="lbl">' + esc(t("profile.language")) + '</div><div class="chips">' +
      C.LANGS.map(function (l) { return '<button class="chip" data-lang="' + l.code + '" lang="' + l.code + '" aria-pressed="' + (S.lang === l.code) + '">' + esc(l.label) + "</button>"; }).join("") +
      '</div></div><button class="btn ghost" id="redo">' + esc(t("profile.redo")) + '</button><p class="ver">' + esc(t("profile.disclaimer")) + '</p><div class="ver">' + esc(t("profile.version")) + " " + C.VERSION + '</div><button class="btn ghost" id="close">' + esc(t("profile.close")) + "</button></div></div>";
  }

  function render() {
    document.title = C.APP_NAME;
    var keepY = window.scrollY;
    if (!S.lang) $app.innerHTML = langScreen();
    else if (!S.welcomed) $app.innerHTML = welcomeScreen();
    else if (!S.onboarded) {
      if (S.qdone) $app.innerHTML = resultScreen();
      else { if (!S.qid) { S.qid = qList()[0].id; save(); } $app.innerHTML = questionScreen(); }
    } else $app.innerHTML = shell();
    bind();
    if (S.onboarded) window.scrollTo(0, keepY);
  }

  function on(id, fn) { var el = document.getElementById(id); if (el) el.onclick = fn; }

  function bind() {
    $app.querySelectorAll("[data-lang]").forEach(function (b) { b.onclick = function () { setLang(b.getAttribute("data-lang")); }; });
    on("start", function () { S.welcomed = true; S.qdone = false; save(); render(); });
    on("back", function () { goto(-1); });
    on("next", tryNext);
    on("skip", function () { var q = currentQ(); delete S.answers[q.id]; save(); goto(1); });
    on("redchange", function () { S.qdone = false; S.qid = "s1"; save(); render(); });
    on("open", function () { S.onboarded = true; S.plan = null; ensurePlan(); save(); render(); });
    var q = !S.onboarded && S.welcomed && !S.qdone && QS.length ? currentQ() : null;
    $app.querySelectorAll("[data-opt]").forEach(function (b) { b.onclick = function () { pickOption(q, b.getAttribute("data-opt")); }; });
    var inp = document.getElementById("num");
    if (inp) { inp.onkeydown = function (e) { if (e.key === "Enter") tryNext(); }; if (q && q.type === "number") inp.focus(); }
    $app.querySelectorAll("[data-tab]").forEach(function (b) { b.onclick = function () { ui.tab = b.getAttribute("data-tab"); render(); window.scrollTo(0, 0); }; });
    $app.querySelectorAll("[data-sub]").forEach(function (b) { b.onclick = function () { ui.sub[ui.tab] = b.getAttribute("data-sub"); render(); }; });
    $app.querySelectorAll("[data-week]").forEach(function (b) { b.onclick = function () { ui.planWeek = Number(b.getAttribute("data-week")); render(); }; });
    // Training eintragen: Eingaben direkt speichern, ohne neu zu zeichnen (Fokus bleibt)
    $app.querySelectorAll("input[data-ex]").forEach(function (el) {
      el.oninput = function () {
        var r = S.draft && S.draft.ex[el.getAttribute("data-ex")][Number(el.getAttribute("data-set"))];
        if (r) { r[el.getAttribute("data-f")] = el.value; save(); }
      };
    });
    $app.querySelectorAll("[data-chk]").forEach(function (b) {
      b.onclick = function () {
        var parts = b.getAttribute("data-chk").split(":"), r = S.draft.ex[parts[0]][Number(parts[1])];
        r.done = !r.done;
        // leere Felder beim Abhaken mit dem Vorschlag füllen
        if (r.done) {
          var row = b.parentNode;
          var prev = Number(parts[1]) > 0 ? S.draft.ex[parts[0]][Number(parts[1]) - 1] : null;
          row.querySelectorAll("input").forEach(function (el) {
            var f = el.getAttribute("data-f"), fill = el.value || (prev && prev[f]) || el.placeholder;
            if (!el.value && fill) { el.value = fill; r[f] = fill; }
          });
        }
        b.setAttribute("aria-pressed", r.done); save();
      };
    });
    on("finish", finishSession);
    on("finok", function () { ui.finish = null; render(); window.scrollTo(0, 0); });
    $app.querySelectorAll("[data-info]").forEach(function (b) { b.onclick = function () { ui.info = b.getAttribute("data-info"); render(); }; });
    on("infoclose", function () { ui.info = null; render(); });
    $app.querySelectorAll("[data-nday]").forEach(function (b) { b.onclick = function () { ui.nday = Number(b.getAttribute("data-nday")); render(); }; });
    $app.querySelectorAll("[data-mopen]").forEach(function (b) { b.onclick = function () { var k = b.getAttribute("data-mopen"); ui.nopen[k] = !ui.nopen[k]; render(); }; });
    $app.querySelectorAll("[data-swap]").forEach(function (b) {
      b.onclick = function () {
        var wk = window.Nutrition.weekInfo(new Date()).key, k = b.getAttribute("data-swap");
        S.nswap = S.nswap || {}; S.nswap[wk] = S.nswap[wk] || {}; S.nswap[wk][k] = (S.nswap[wk][k] || 0) + 1;
        ui.nopen[k] = false; save(); render();
      };
    });
    $app.querySelectorAll("[data-shop]").forEach(function (b) {
      b.onclick = function () {
        var wk = window.Nutrition.weekInfo(new Date()).key, id = b.getAttribute("data-shop");
        S.shop = S.shop || {}; S.shop[wk] = S.shop[wk] || {}; S.shop[wk][id] = !S.shop[wk][id];
        save(); b.setAttribute("aria-pressed", !!S.shop[wk][id]);
      };
    });
    on("wsave", function () {
      var kg = parseFloat((document.getElementById("wkg").value || "").replace(",", ".")), d = document.getElementById("wdate").value || iso(new Date());
      if (!(kg >= 30 && kg <= 300)) { ui.err = t("weight.invalid"); render(); return; }
      ui.err = ""; S.weights = (S.weights || []).filter(function (w) { return w.date !== d; }).concat([{ date: d, kg: Math.round(kg * 10) / 10 }]);
      save(); runAuto(); render();
    });
    $app.querySelectorAll("[data-wdel]").forEach(function (b) { b.onclick = function () { S.weights = (S.weights || []).filter(function (w) { return w.date !== b.getAttribute("data-wdel"); }); save(); render(); }; });
    on("lsave", function () {
      var kg = parseFloat((document.getElementById("lkg").value || "").replace(",", ".")), reps = parseInt(document.getElementById("lreps").value, 10);
      if (!(kg > 0 && reps >= 1 && reps <= 30)) { ui.err2 = t("rs.invalidlift"); render(); return; }
      ui.err2 = ""; S.results = (S.results || []).concat([{ type: "lift", ex: document.getElementById("lift").value, kg: kg, reps: reps, date: iso(new Date()) }]); save(); render();
    });
    on("rsave", function () {
      var sec = window.Progress.parseTime(document.getElementById("rtime").value);
      if (!(sec > 0)) { ui.err3 = t("rs.invalidtime"); render(); return; }
      ui.err3 = ""; S.results = (S.results || []).concat([{ type: "run", dist: document.getElementById("rdist").value, sec: sec, date: iso(new Date()) }]); save(); render();
    });
    on("racesave", function () {
      var name = (document.getElementById("rname").value || "").trim(), date = document.getElementById("rdate").value;
      if (!name || !date) { ui.err4 = t("race.invalid"); render(); return; }
      ui.err4 = ""; S.races = (S.races || []).concat([{ id: String(Date.now()), name: name.slice(0, 60), date: date, type: document.getElementById("rtype").value }]); save(); render();
    });
    $app.querySelectorAll("[data-rdel]").forEach(function (b) { b.onclick = function () { S.races = (S.races || []).filter(function (r) { return r.id !== b.getAttribute("data-rdel"); }); save(); render(); }; });
    $app.querySelectorAll("[data-rressave]").forEach(function (b) {
      b.onclick = function () {
        var id = b.getAttribute("data-rressave"), inp = $app.querySelector('[data-rres="' + id + '"]'), val = inp ? inp.value.trim().slice(0, 20) : "";
        if (!val) return;
        S.races = S.races || [];
        var r = S.races.find(function (x) { return x.id === id; });
        if (!r && id === "goal") { r = { id: "goal", name: t("race.fromgoal"), date: S.answers.event_datum, type: "other", fromGoal: true }; S.races.push(r); }
        if (r) { r.result = val; save(); render(); }
      };
    });
    on("chgoals", function () { S.onboarded = false; S.qdone = false; S.qid = "ziele"; S.plan = null; S.draft = null; save(); render(); window.scrollTo(0, 0); });
    var qs = document.getElementById("qasearch");
    if (qs) qs.oninput = function () { ui.qaq = qs.value; var pos = qs.selectionStart; render(); var n = document.getElementById("qasearch"); if (n) { n.focus(); n.setSelectionRange(pos, pos); } };
    var ibg = document.getElementById("infobg");
    if (ibg) ibg.onclick = function (e) { if (e.target === ibg) { ui.info = null; render(); } };
    on("prof", function () { ui.profile = true; render(); });
    on("close", function () { ui.profile = false; render(); });
    on("redo", function () {
      if (!window.confirm(t("profile.redo") + "?")) return;
      S.answers = {}; S.qid = null; S.qdone = false; S.onboarded = false; S.plan = null; S.draft = null; ui.profile = false; save(); render();
    });
    var bg = document.getElementById("bg");
    if (bg) bg.onclick = function (e) { if (e.target === bg) { ui.profile = false; render(); } };
  }

  function getJSON(u) { return fetch(u + "?v=" + C.VERSION, { cache: "no-cache" }).then(function (r) { return r.json(); }); }

  Promise.all([
    window.I18N.init(S.lang || "en"),
    getJSON("data/questionnaire.json").then(function (d) { QS = d.questions; }),
    getJSON("data/exercises.json").then(function (d) { EX = d.uebungen; EX.forEach(function (e) { EXBY[e.id] = e; }); }),
    getJSON("data/ex-names.json").then(function (d) { NAMES = d; }),
    getJSON("data/essen.json").then(function (d) { FOOD = d; })
  ]).then(render, render);

  if ("serviceWorker" in navigator && location.protocol.indexOf("http") === 0) {
    navigator.serviceWorker.register("sw.js?v=" + C.VERSION).catch(function () {});
  }
})();
