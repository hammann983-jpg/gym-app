// Ablauf: Sprache -> Willkommen -> Fragebogen -> Ergebnis -> App mit 5 Tabs.
(function () {
  var C = window.GYM_CONFIG, KEY = "gym.v1";
  var $app = document.getElementById("app");
  var QS = [], EX = [], EXBY = {}, NAMES = {};

  function load() { try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch (e) { return {}; } }
  function save() { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) {} }
  var S = load();
  S.answers = S.answers || {};
  S.log = S.log || [];
  var ui = { tab: "today", sub: { progress: "training", coach: "adjust" }, profile: false, err: "", finish: null, planWeek: null };

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
    var k1 = "o." + q.id + "." + o, k2 = "o." + o;
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
      var opts = q.type === "yesno" ? ["ja", "nein", "keine_antwort"] : q.options;
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
    var a = S.answers, goal = t("o.hauptziel." + a.hauptziel);
    var h = '<section class="screen">' + logo() + "<h1>" + esc(t("res.title")) + "</h1><p>" + esc(t("res.sub")) + '</p><div class="stats">' +
      '<div class="stat"><small>' + esc(t("res.goal")) + "</small><b>" + esc(goal) + "</b></div>" +
      '<div class="stat"><small>' + esc(t("res.bmi")) + "</small><b>" + (sc.bmi ? sc.bmi.toLocaleString(window.I18N.lang(), { minimumFractionDigits: 1, maximumFractionDigits: 1 }) : "–") + "</b></div>" +
      '<div class="stat"><small>' + esc(t("res.days")) + "</small><b>" + esc(a.trainingstage) + "</b></div></div>";
    if (sc.yellow) h += '<div class="note warn">' + esc(t("res.flag.yellow")) + "</div>";
    if (sc.nutriOff) h += '<div class="note">' + esc(t("res.flag.nutri")) + "</div>";
    return h + '<button class="btn" id="open">' + esc(t("res.open")) + "</button></section>";
  }

  // ---------- Plan und Training ----------
  function ensurePlan() {
    if (!S.plan && EX.length && S.answers.hauptziel) { S.plan = window.Plan.generate(S.answers, EX); S.done = 0; S.draft = null; save(); }
    return S.plan;
  }
  function sessionTitle(s) { return t("day." + s.type) + (s.letter ? " " + s.letter : ""); }
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
      var txt = n === "cap_days" ? t("note.cap_days", { n: S.plan.daysPerWeek }) : n === "endurance_pending" ? t("note.endurance") : "";
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
    var h = '<div class="sec">' + esc(t("today.next")) + '</div><h2 class="big">' + esc(sessionTitle(s)) + '</h2><div class="chips"><span class="pill acc">' + esc(t("today.week", { n: Math.min(c.week, p.weeks), total: p.weeks })) + '</span><span class="pill">' + esc(t("today.exercises", { n: s.exercises.length })) + "</span></div>";
    if (c.week > p.weeks) h += '<div class="note warn">' + esc(t("today.blockdone")) + "</div>";
    if (deload) h += '<div class="note warn">' + esc(t("today.deload")) + "</div>";
    h += '<div class="card ringrow">' + ring(got, goal) + "<div><h3>" + esc(t("today.goal")) + "</h3><p>" + esc(t("today.of", { done: got, total: goal })) + "</p></div></div>";
    h += notesHtml();
    h += '<p class="qhint">' + esc(t("today.hint")) + "</p>";
    s.exercises.forEach(function (x, i) {
      var hist = history(x.id), sug = window.Plan.suggest(x, hist), n = d.ex[x.id].length;
      h += '<div class="card ex"><div class="exhead"><span class="n">' + (i + 1) + '</span><div><b>' + esc(exName(x.id)) + "</b><small>" +
        esc(t("today.setsline", { sets: n, reps: x.text, rest: fmtRest(x.rest) })) + "</small></div></div>";
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
      h += '<div class="card psess"><div class="phead"><h3>' + esc(sessionTitle(s)) + "</h3>" + (isDone ? '<span class="pill acc">' + icon("check") + "</span>" : "") + "</div>";
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
  var SUBS = { progress: ["training", "weight", "results", "races"], coach: ["adjust", "knowledge", "questions"] };

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
    h += body || emptyCard(tab);
    h += "</main>";
    h += '<nav class="tabs"><div class="inner">' + TABS.map(function (k) {
      return '<button data-tab="' + k + '"' + (k === tab ? ' aria-current="page"' : "") + ">" + icon(k) + "<span>" + esc(t("tab." + k)) + "</span></button>";
    }).join("") + "</div></nav>";
    if (ui.profile) h += profileSheet();
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
    getJSON("data/ex-names.json").then(function (d) { NAMES = d; })
  ]).then(render, render);

  if ("serviceWorker" in navigator && location.protocol.indexOf("http") === 0) {
    navigator.serviceWorker.register("sw.js?v=" + C.VERSION).catch(function () {});
  }
})();
