// Ablauf: Sprache -> Willkommen -> Fragebogen -> Ergebnis -> App mit 5 Tabs.
(function () {
  var C = window.GYM_CONFIG, KEY = "gym.v1";
  var $app = document.getElementById("app");
  var QS = [];

  function load() { try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch (e) { return {}; } }
  function save() { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) {} }
  var S = load();
  S.answers = S.answers || {};
  var ui = { tab: "today", sub: { progress: "training", coach: "adjust" }, profile: false, err: "" };

  var t = function (k, v) { return window.I18N.t(k, v); };
  function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }

  var ICONS = {
    today: '<circle cx="12" cy="12" r="8"/><path d="M12 8v4l3 2"/>',
    plan: '<rect x="4" y="5" width="16" height="15" rx="2"/><path d="M4 10h16M9 3v4M15 3v4"/>',
    progress: '<path d="M4 19V5M4 19h16M8 15l4-4 3 3 5-6"/>',
    nutrition: '<path d="M7 3v8a3 3 0 0 0 6 0V3M10 3v18M17 3c-2 2-2 6 0 8v10"/>',
    coach: '<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 4-6 8-6s8 2 8 6"/>',
    user: '<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 4-6 8-6s8 2 8 6"/>'
  };
  function icon(n) { return '<svg viewBox="0 0 24 24" aria-hidden="true">' + ICONS[n] + "</svg>"; }

  function setLang(code) { S.lang = code; save(); return window.I18N.init(code).then(render); }

  // Text einer Option: erst frageeigen (o.<frage>.<opt>), dann allgemein (o.<opt>), sonst der Wert selbst.
  function optText(q, o) {
    var k1 = "o." + q.id + "." + o, k2 = "o." + o;
    if (window.I18N.has(k1)) return t(k1);
    if (window.I18N.has(k2)) return t(k2);
    return String(o) + (q.unit ? " " + t(q.unit) : "");
  }
  function unitText(u) { return !u ? "" : (u.indexOf("u.") === 0 ? t(u) : u); }

  function logo() { return '<div class="logo"><img src="icons/mark-256.png?v=' + C.VERSION + '" alt="">' + esc(C.APP_NAME) + "</div>"; }

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

  // ---------- App ----------
  var TABS = ["today", "plan", "progress", "nutrition", "coach"];
  var SUBS = { progress: ["training", "weight", "results", "races"], coach: ["adjust", "knowledge", "questions"] };

  function shell() {
    var tab = ui.tab, h = '<header class="top"><span class="brand"><img src="icons/mark-256.png?v=' + C.VERSION + '" alt="">' + esc(C.APP_NAME) +
      '</span><button class="icon-btn" id="prof" aria-label="' + esc(t("profile.title")) + '">' + icon("user") + "</button></header><main>";
    h += "<h2>" + esc(t("tab." + tab)) + "</h2>";
    if (SUBS[tab]) {
      h += '<div class="seg" role="tablist">' + SUBS[tab].map(function (s) {
        return '<button role="tab" data-sub="' + s + '" aria-selected="' + (ui.sub[tab] === s) + '">' + esc(t("sub." + s)) + "</button>";
      }).join("") + "</div>";
    }
    h += '<div class="card"><h3>' + esc(t("empty." + tab + ".title")) + "</h3><p>" + esc(t("empty." + tab + ".text")) + "</p></div></main>";
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
    if (!S.lang) $app.innerHTML = langScreen();
    else if (!S.welcomed) $app.innerHTML = welcomeScreen();
    else if (!S.onboarded) {
      if (S.qdone) $app.innerHTML = resultScreen();
      else { if (!S.qid) { S.qid = qList()[0].id; save(); } $app.innerHTML = questionScreen(); }
    } else $app.innerHTML = shell();
    bind();
  }

  function on(id, fn) { var el = document.getElementById(id); if (el) el.onclick = fn; }

  function bind() {
    $app.querySelectorAll("[data-lang]").forEach(function (b) { b.onclick = function () { setLang(b.getAttribute("data-lang")); }; });
    on("start", function () { S.welcomed = true; S.qdone = false; save(); render(); });
    on("back", function () { goto(-1); });
    on("next", tryNext);
    on("skip", function () { var q = currentQ(); delete S.answers[q.id]; save(); goto(1); });
    on("redchange", function () { S.qdone = false; S.qid = "s1"; save(); render(); });
    on("open", function () { S.onboarded = true; save(); render(); });
    var q = !S.onboarded && S.welcomed && !S.qdone && QS.length ? currentQ() : null;
    $app.querySelectorAll("[data-opt]").forEach(function (b) { b.onclick = function () { pickOption(q, b.getAttribute("data-opt")); }; });
    var inp = document.getElementById("num");
    if (inp) { inp.onkeydown = function (e) { if (e.key === "Enter") tryNext(); }; if (q && q.type === "number") inp.focus(); }
    $app.querySelectorAll("[data-tab]").forEach(function (b) { b.onclick = function () { ui.tab = b.getAttribute("data-tab"); render(); window.scrollTo(0, 0); }; });
    $app.querySelectorAll("[data-sub]").forEach(function (b) { b.onclick = function () { ui.sub[ui.tab] = b.getAttribute("data-sub"); render(); }; });
    on("prof", function () { ui.profile = true; render(); });
    on("close", function () { ui.profile = false; render(); });
    on("redo", function () {
      if (!window.confirm(t("profile.redo") + "?")) return;
      S.answers = {}; S.qid = null; S.qdone = false; S.onboarded = false; ui.profile = false; save(); render();
    });
    var bg = document.getElementById("bg");
    if (bg) bg.onclick = function (e) { if (e.target === bg) { ui.profile = false; render(); } };
  }

  Promise.all([
    window.I18N.init(S.lang || "en"),
    fetch("data/questionnaire.json?v=" + C.VERSION, { cache: "no-cache" }).then(function (r) { return r.json(); }).then(function (d) { QS = d.questions; })
  ]).then(render, render);

  if ("serviceWorker" in navigator && location.protocol.indexOf("http") === 0) {
    navigator.serviceWorker.register("sw.js?v=" + C.VERSION).catch(function () {});
  }
})();
