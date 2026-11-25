// Ablauf: Sprache -> Willkommen -> Fragebogen -> Ergebnis -> App mit 5 Tabs.
(function () {
  var C = window.GYM_CONFIG, KEY = "gym.v1";
  var $app = document.getElementById("app");
  var TIPS = {};
  var KNOW = {};
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
    if (S.plan && !(S.plan.version >= 2)) { S.plan = null; S.draft = null; changed = true; }
    // Wiederherstellen: steht der Zähler nach dem früheren Fehler auf 0, zählt der gespeicherte Verlauf
    if (S.log.length && !S.done && S.plan) { var last = S.log.filter(function (l) { return l.seq >= 0 && l.seq !== null; }).reduce(function (m, l) { return Math.max(m, l.seq + 1); }, 0); if (last) { S.done = last; changed = true; } }
    if (changed) save();
  })();
  var ui = { tab: "today", sub: { progress: "training", coach: "check", nutrition: "mealplan" }, profile: false, err: "", finish: null, planWeek: null, nday: (new Date().getDay() + 6) % 7, nopen: {}, info: null };

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
    share: '<path d="M12 15V4M8 8l4-4 4 4M5 12v7a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-7"/>',
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
    } else if (q.type === "text") {
      h += '<div class="numrow"><input class="num" id="num" type="text" maxlength="30" autocomplete="given-name" style="font-size:28px" value="' + esc(v || "") + '" aria-label="' + esc(t("q." + q.id)) + '"></div>';
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
    var last = idx === list.length - 1, needsNext = q.type === "number" || q.type === "date" || q.type === "multi" || q.type === "text";
    h += '<div class="qnav">' + (idx > 0 ? '<button class="btn ghost" id="back">' + esc(t("q.back")) + "</button>" : "");
    if (needsNext || last) h += '<button class="btn" id="next">' + esc(t(last ? "q.finish" : "q.next")) + "</button>";
    h += "</div>";
    if (!q.required) h += '<button class="skip" id="skip">' + esc(t("q.skip")) + "</button>";
    return h + "</div>";
  }

  // Zeichen, die in die Seite eingreifen könnten, werden entfernt
  function cleanName(v) { return String(v == null ? "" : v).replace(/[<>"{}]/g, "").replace(/\s+/g, " ").trim().slice(0, 30); }
  function hello() { return S.answers.name ? '<p class="hello">' + esc(t("hello", { name: S.answers.name })) + "</p>" : ""; }
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
    if (q.type === "number" || q.type === "date" || q.type === "text") {
      var el = document.getElementById("num");
      v = el ? el.value : v;
      if (q.type === "number" && v !== "") v = window.Q.num(v);
      if (q.type === "text") v = cleanName(v);
      if (v === "" || v == null || (typeof v === "number" && isNaN(v))) v = null;
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
    var a = S.answers, G = window.Plan.goals(a), pr = window.Plan.prio(a), weeks = window.Plan.totalWeeks(a);
    var goal = t("o.ziele." + pr);
    var h = '<section class="screen">' + logo() + hello() + "<h1>" + esc(t("res.title")) + "</h1><p>" + esc(t("res.sub")) + '</p><div class="stats two">' +
      '<div class="stat"><small>' + esc(t("res.goal")) + "</small><b>" + esc(goal) + "</b></div>" +
      '<div class="stat"><small>' + esc(t("res.weeks")) + "</small><b>" + weeks + " " + esc(t("u.weeks")) + "</b></div>" +
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
    else if (S.plan && !(S.plan.version >= 7) && EX.length) upgradePlan();
    return S.plan;
  }
  // Alter Plan: neu erzeugen, volle erledigte Wochen bleiben erledigt
  function upgradePlan() {
    // Ab Version 5 ist der Aufbau gleich: der Stand bleibt genau erhalten
    if (S.plan.version >= 5) { var done = S.done; S.plan = window.Plan.generate(S.answers, EX); S.done = done; S.draft = null; save(); return; }
    var weeks = window.Plan.cursor(S.plan, S.done || 0).week - 1;
    S.plan = window.Plan.generate(S.answers, EX); S.done = window.Plan.doneBefore(S.plan, weeks + 1); S.draft = null; save();
  }
  function sessionTitle(s) { return t("day." + s.type) + (s.letter ? " " + s.letter : ""); }
  // Große Überschrift: die trainierten Muskelgruppen (Ganzkörper behält seinen Namen)
  function focusList(s) {
    var f = s.focus || [];
    return f.some(function (x) { return x === "quads" || x === "posterior"; }) ? f.filter(function (x) { return x !== "legs"; }) : f;
  }
  function headline(s) {
    if (s.type === "fb" || !s.focus || !s.focus.length) return sessionTitle(s);
    return focusList(s).map(function (f) { return t("focus." + f); }).join(" · ");
  }
  function focusLine(s) { return focusList(s).map(function (f) { return t("focus." + f); }).join(" · "); }
  function cur() {
    var c = window.Plan.cursor(S.plan, S.done || 0);
    c.idx = c.item.i;
    return c;
  }
  // ---------- Diagramme ----------
  function svgChart(kind, pts, fmt, label) {
    var W = 320, H = 160, L = 8, R = 8, T = 22, B = 22, n = pts.length;
    var vals = pts.map(function (p) { return p.v; }), hi = Math.max.apply(null, vals), lo = kind === "bar" ? 0 : Math.min.apply(null, vals);
    if (kind !== "bar") { var pad = (hi - lo) * 0.15 || Math.max(1, hi * 0.05); hi += pad; lo -= pad; }
    if (hi === lo) hi = lo + 1;
    var Y = function (v) { return H - B - (v - lo) / (hi - lo) * (H - T - B); };
    var s = '<svg class="chart" viewBox="0 0 ' + W + " " + H + '" role="img" aria-label="' + esc(label) + '">';
    s += '<line x1="' + L + '" x2="' + (W - R) + '" y1="' + (H - B) + '" y2="' + (H - B) + '" stroke="var(--line)"/>';
    var step = (W - L - R) / n, X = function (i) { return kind === "bar" ? L + step * i + step / 2 : n === 1 ? W / 2 : 24 + i * (W - 48) / (n - 1); };
    if (kind !== "bar" && n > 1) s += '<path d="' + pts.map(function (p, i) { return (i ? "L" : "M") + X(i).toFixed(1) + " " + Y(p.v).toFixed(1); }).join(" ") + '" fill="none" stroke="var(--accent)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>';
    var every = Math.max(1, Math.ceil(n / 6));
    pts.forEach(function (p, i) {
      var show = (n - 1 - i) % every === 0;
      if (kind === "bar") { var bw = Math.min(30, step * 0.6), y = Y(p.v); s += '<rect x="' + (X(i) - bw / 2).toFixed(1) + '" y="' + y.toFixed(1) + '" width="' + bw.toFixed(1) + '" height="' + Math.max(p.v ? 2 : 0, H - B - y).toFixed(1) + '" rx="4" fill="' + (i === n - 1 ? "var(--accent)" : "var(--accent-2)") + '"/>'; }
      else s += '<circle cx="' + X(i).toFixed(1) + '" cy="' + Y(p.v).toFixed(1) + '" r="4" fill="var(--accent)"/>';
      if (kind === "bar" ? p.v : show) s += '<text x="' + X(i).toFixed(1) + '" y="' + (Y(p.v) - 8).toFixed(1) + '" text-anchor="middle" fill="var(--text)" font-size="10">' + esc(fmt(p.v)) + "</text>";
      if (show) s += '<text x="' + X(i).toFixed(1) + '" y="' + (H - 6) + '" text-anchor="middle" fill="var(--muted)" font-size="10">' + esc(p.label) + "</text>";
    });
    return s + "</svg>";
  }
  function shortDate(d) { return new Date(d + "T12:00:00").toLocaleDateString(window.I18N.lang(), { day: "numeric", month: "numeric" }); }
  function trendData() {
    var weeks = [], now = weekStartIso(iso(new Date()));
    for (var i = 7; i >= 0; i--) { var d = new Date(now + "T12:00:00"); d.setDate(d.getDate() - 7 * i); weeks.push(iso(d)); }
    var perWeek = weeks.map(function (w) { var l = S.log.filter(function (x) { return weekStartIso(x.date) === w; }); return { label: shortDate(w), n: l.length, vol: l.reduce(function (a, x) { return a + (x.vol || 0); }, 0), min: l.reduce(function (a, x) { return a + (x.min || 0) + (x.cardio ? x.cardio.min : 0); }, 0) }; });
    // Kraft: bestes geschätztes Maximum je Übung und Tag
    var lifts = {};
    var add = function (id, date, kg, reps) { var e = window.Progress.e1rm(kg, reps); if (!(e > 0) || reps > 30) return; lifts[id] = lifts[id] || {}; lifts[id][date] = Math.max(lifts[id][date] || 0, e); };
    S.log.forEach(function (l) { l.ex.forEach(function (x) { x.sets.forEach(function (r) { add(x.id, l.date, r.kg, r.reps); }); }); });
    (S.results || []).forEach(function (r) { if (r.type === "lift") add(r.ex, r.date, r.kg, r.reps); });
    var pace = S.log.filter(function (l) { return l.type === "run" && (l.sport || "run") === "run" && l.km > 0; }).map(function (l) { return { date: l.date, v: l.min * 60 / l.km }; });
    return { perWeek: perWeek, lifts: lifts, pace: pace };
  }
  function trendView() {
    var D = trendData(), opts = [["n", t("trend.n")], ["vol", t("trend.vol")], ["min", t("trend.min")], ["lift", t("trend.lift")], ["pace", t("trend.pace")]];
    var k = ui.trend || "n", h = '<div class="sec">' + esc(t("trend.title")) + '</div><div class="chips trendchips">' + opts.map(function (o) { return '<button class="chip" data-trend="' + o[0] + '" aria-pressed="' + (k === o[0]) + '">' + esc(o[1]) + "</button>"; }).join("") + '</div><div class="card chartc">';
    var empty = '<p class="qhint">' + esc(t("trend.empty." + k)) + "</p>";
    if (k === "lift") {
      var ids = Object.keys(D.lifts).sort(function (a, b) { return Object.keys(D.lifts[b]).length - Object.keys(D.lifts[a]).length; });
      if (!ids.length) h += empty;
      else {
        var id = ids.indexOf(ui.trendEx) >= 0 ? ui.trendEx : ids[0], pts = Object.keys(D.lifts[id]).sort().slice(-12).map(function (d) { return { label: shortDate(d), v: D.lifts[id][d] }; });
        h += '<select id="trendex" aria-label="' + esc(t("rs.exercise")) + '">' + ids.map(function (x) { return '<option value="' + x + '"' + (x === id ? " selected" : "") + ">" + esc(exName(x)) + "</option>"; }).join("") + "</select>" + svgChart("line", pts, function (v) { return nf(v, 0); }, exName(id)) + '<p class="qhint">' + esc(pts.length < 2 ? t("trend.one") : t("trend.liftnote", { d: (pts[pts.length - 1].v >= pts[0].v ? "+" : "") + nf(pts[pts.length - 1].v - pts[0].v, 1) })) + "</p>";
      }
    } else if (k === "pace") {
      if (!D.pace.length) h += empty;
      else h += svgChart("line", D.pace.slice(-12).map(function (p) { return { label: shortDate(p.date), v: p.v }; }), window.Progress.fmtTime, t("trend.pace")) + '<p class="qhint">' + esc(t("trend.pacenote")) + "</p>";
    } else {
      var bars = D.perWeek.map(function (w) { return { label: w.label, v: Math.round(w[k]) }; });
      h += svgChart("bar", bars, function (v) { return nf(v, 0); }, t("trend." + k)) + (bars.some(function (b) { return b.v; }) ? '<p class="qhint">' + esc(t("trend.weeknote")) + "</p>" : empty);
    }
    return h + "</div>";
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
    var bb = window.Plan.goals(S.answers).indexOf("bodybuilding") >= 0 && S.answers.bb_phase && !S.plan.light ? '<div class="note">' + esc(t("bb." + S.answers.bb_phase)) + "</div>" : "";
    return bb + (S.plan.notes || []).map(function (n) {
      var txt = n === "cap_days" ? t("note.cap_days", { n: S.plan.daysPerWeek }) : n === "endurance_pending" ? t("note.endurance") : n === "recomp" ? t("note.recomp") : n === "endu_conflict" ? t("note.endu_conflict") : n === "event_soon" ? t("note.event_soon") : n === "run" || n === "tri" || n === "hyrox" || n === "one_endurance" || n === "light" || n === "hx_alt" || n === "teen" || n === "age60" || n === "sleep" ? t("note." + n) : "";
      return txt ? '<div class="note">' + esc(txt) + "</div>" : "";
    }).join("");
  }

  function ensureDraft(c) {
    var s = sess(c.idx, c.week);
    if (S.draft && S.draft.seq === c.seq && S.draft.ex && s.exercises.every(function (x) { return S.draft.ex[x.id]; })) return S.draft;
    var d = { seq: c.seq, ex: {} };
    s.exercises.forEach(function (x) {
      var n = setsAt(x, c.week), arr = [];
      for (var i = 0; i < n; i++) arr.push({ kg: "", reps: "", done: false });
      d.ex[x.id] = arr;
    });
    S.draft = d; save();
    return d;
  }

  // ---------- Lauf-Einheiten ----------
  function runTitle(r) {
    if (r.k === "race") return t("run.kind.race", { d: t("dist." + r.dist) });
    if (r.k === "trirace") return t("run.kind.trirace", { d: t("o.tri_distanz." + r.dist) });
    return t("run.kind." + r.k);
  }
  function coachState() { return window.Coach.fresh(S.coach); }
  function adj(r) { var lang = window.I18N.lang(); return window.Coach.applyRun(r, coachState(), function (i) { return window.Multi.station(i, S.answers.hyrox_division, S.answers); }); }
  function cardioFor(week, index) { return window.Plan.cardioAt(S.answers, S.plan, week, coachState().cardio, index, S.log); }
  function cardioLine(c) { return t("cardio.line", { min: c.min, kmh: nf(c.kmh, 1), inc: c.incline }); }
  function cardioBox(c, d) {
    if (!c) return "";
    var v = d.cardio || (d.cardio = { done: false, min: "", kmh: "", incline: "" });
    var field = function (k, label, ph, unit) { return '<label class="f"><input type="text" inputmode="decimal" data-cardio="' + k + '" value="' + esc(v[k]) + '" placeholder="' + esc(ph) + '" aria-label="' + esc(label) + '"><i>' + esc(unit) + "</i></label>"; };
    var home = S.answers.ort === "zuhause";
    return '<div class="card cardio"><div class="sec">' + esc(t("cardio.after")) + "</div><h3>" + esc(t(home ? "cardio.walk" : "cardio.treadmill")) + '</h3><div class="stats"><div class="stat"><small>' + esc(t("run.stat.time")) + "</small><b>" + c.min + " " + esc(t("today.min")) + '</b></div><div class="stat"><small>' + esc(t("cardio.speed")) + "</small><b>" + nf(c.kmh, 1) + ' km/h</b></div><div class="stat"><small>' + esc(t("cardio.incline")) + "</small><b>" + c.incline + " %</b></div></div>" +
      (c.why ? '<div class="note">' + esc(t("cardio.adapt." + c.why)) + "</div>" : "") +
      "<p>" + esc(t(home ? "cardio.howhome" : "cardio.how")) + "</p>" + (c.gentle ? '<p class="qhint">' + esc(t("cardio.gentle")) + "</p>" : "") +
      '<div class="cardiorow">' + field("min", t("run.log.min"), c.min, t("today.min")) + field("kmh", t("cardio.speed"), nf(c.kmh, 1), "km/h") + field("incline", t("cardio.incline"), c.incline, "%") + "</div>" +
      '<button class="chip cardiochk" id="cardiochk" aria-pressed="' + !!v.done + '">' + esc(t("cardio.done")) + "</button></div>";
  }
  function sess(i, week) { return window.Plan.sessionFor(S.answers, EX, S.plan, i, week); }
  function setsAt(x, week) { var n = window.Plan.setsFor(x, week), d = coachState().sets; return d ? Math.max(2, Math.min(5, n + d)) : n; }
  function coachReview() {
    var out = window.Coach.review(S.coach, { log: S.log, light: !!(S.plan && S.plan.light), today: iso(new Date()) });
    if (out.changed.length) { S.coach = out.state; S.draft = null; save(); }
    else S.coach = out.state;
    return out.changed;
  }
  function sportName(r) { return t("sport." + (r.sport || "run")); }
  function runSize(r) {
    if (r.k === "race") return nf(window.Run.RACE_KM[r.dist], 1) + " km";
    if (r.km) return nf(r.km, 0) + " km";
    if (r.size) return r.size + " " + t("today.min");
    return r.min ? r.min + " " + t("today.min") : sportName(r);
  }
  function hasSize(r) { return !!(r.km || r.size || r.min || r.k === "race"); }
  function runSteps(r) {
    if (r.k === "runwalk") return [t("run.rw", { n: r.n, run: nf(r.run, 1), walk: nf(r.walk, 1) })];
    if (r.k === "cont") return [t("run.cont", { m: r.run })];
    var out = (r.q || []).map(function (q) {
      var id = q.id === "km_fast" && !q.r ? "km_fast_norest" : q.id;
      return t("run.q." + id, q);
    });
    if (r.k === "brick") out.unshift(t("run.brick", { bike: r.bike, run: r.run }));
    return out.concat((r.stations || []).map(function (s, i) { return (i + 1) + ". " + (s.indexOf("alt:") === 0 ? t("alt." + s.slice(4)) : s); }));
  }
  function paceText(r, rung) {
    var P = window.Run.paces(S.answers, S.results), z = window.Run.zone(r, rung);
    if (!P || !z) return "";
    var a = window.Progress.fmtTime(P[z][0]), b = window.Progress.fmtTime(P[z][1]);
    var fast = nf(3600 / P[z][0], 1), slow = nf(3600 / P[z][1], 1);
    return t("run.pace." + z, { p: (a === b ? a : a + "–" + b) + " " + t("rs.perkm") }) + " · " + t("run.treadmill", { v: slow === fast ? fast : slow + "–" + fast });
  }
  function weekLine(w) {
    return t("run.rungline", { d: t("run.rung." + w.rung), n: w.n, of: w.of }) + (w.flag ? " · " + t("run.flag." + w.flag) : "");
  }
  function goalCard(got, goal) {
    return '<div class="card ringrow">' + ring(got, goal) + '<div class="grow"><h3>' + esc(t("today.goal")) + "</h3><p>" + esc(got > goal ? t("today.more", { done: got, total: goal }) : t("today.of", { done: got, total: goal })) + '</p></div><button class="swap" data-sharekind="week">' + esc(t("share.btn")) + "</button></div>";
  }
  function runToday(p, c) {
    var w = window.Run.week(p.run, c.week), r = adj(w.runs[c.item.j]);
    if (!(S.draft && S.draft.seq === c.seq && S.draft.run)) { S.draft = { seq: c.seq, run: true, min: "", km: "" }; save(); }
    var d = S.draft, pace = paceText(r, w.rung), zone = window.Run.zone(r, w.rung);
    var h = hello() + '<div class="sec">' + esc(t("today.next")) + " · " + esc(sportName(r)) + '</div><h2 class="big">' + esc(runTitle(r)) + '</h2><div class="chips"><span class="pill acc">' + esc(t("today.week", { n: Math.min(c.week, p.weeks), total: p.weeks })) + '</span>' + (hasSize(r) ? '<span class="pill">' + esc(runSize(r)) + "</span>" : "") + "</div>";
    h += notice(p, c) + goalCard(weekGoalDone(), c.items.length) + notesHtml();
    h += '<div class="card"><h3>' + esc(weekLine(w)) + "</h3>";
    if (hasSize(r)) h += '<div class="pex"><span>' + esc(t("run.total")) + "</span><span>" + esc(runSize(r)) + "</span></div>";
    runSteps(r).forEach(function (x) { h += "<p><b>" + esc(x) + "</b></p>"; });
    h += "<p>" + esc(t("run.how." + r.k)) + "</p>";
    if (pace) h += "<p><b>" + esc(pace) + "</b></p>";
    else if (zone && !window.Run.paces(S.answers, S.results)) h += '<p class="qhint">' + esc(t("run.pace.none")) + "</p>";
    if ((r.sport || "run") === "run" && r.k !== "race") h += '<p class="qhint">' + esc(t("run.warm")) + "</p>";
    if (r.sport === "swim" || r.sport === "tri") h += '<p class="qhint">' + esc(t("run.safe.swim")) + "</p>";
    if (r.sport === "bike" || r.sport === "tri") h += '<p class="qhint">' + esc(t("run.safe.bike")) + "</p>";
    h += '</div><div class="note warn">' + esc(t("run.stop")) + "</div>";
    h += '<div class="card ci"><h3>' + esc(t("run.log.title")) + '</h3><div class="cirow"><label class="f"><input type="text" inputmode="decimal" data-run="min" value="' + esc(d.min) + '" placeholder="' + (r.min || "") + '" aria-label="' + esc(t("run.log.min")) + '"><i>' + esc(t("today.min")) + '</i></label><label class="f"><input type="text" inputmode="decimal" data-run="km" value="' + esc(d.km) + '" placeholder="' + (r.km || "") + '" aria-label="' + esc(t("run.log.km")) + '"><i>km</i></label></div><p class="qhint">' + esc(t("run.log.hint")) + "</p></div>";
    return h + '<p class="err" id="err" role="alert">' + esc(ui.err) + '</p><button class="btn" id="rundone">' + esc(t("run.log.done")) + '</button><button class="btn ghost" id="runskip">' + esc(t("run.log.skip")) + "</button>";
  }
  function finishRun() {
    var c = cur(), p = S.plan, w = window.Run.week(p.run, c.week), r = adj(w.runs[c.item.j]), d = S.draft || {};
    var min = num(d.min || ""), km = num(d.km || "");
    if (!(min >= 1 && min <= 1200) || km < 0 || km > 400) { ui.err = t("run.log.invalid"); render(); return; }
    S.log.push({ date: iso(new Date()), seq: c.seq, week: c.week, weeks: p.weeks, type: "run", sport: r.sport || "run", kind: r.k, dist: r.dist || null, rung: w.rung, st: (r.stations || []).length, min: Math.round(min * 10) / 10, km: Math.round(km * 100) / 100, ex: [], vol: 0 });
    S.done = (S.done || 0) + 1; S.draft = null; ui.err = "";
    ui.finish = { run: true, idx: S.log.length - 1 }; save(); render(); window.scrollTo(0, 0);
  }
  function runStats(l) {
    var s = [[t("run.stat.time"), nf(l.min, 1), t("today.min")]];
    if (l.km) s.push([t("run.stat.dist"), nf(l.km, 2), "km"]);
    if (l.km && (l.sport || "run") === "run") s.push([t("rs.pace"), window.Progress.fmtTime(l.min * 60 / l.km), "/km"]);
    return s;
  }
  function logTitle(l) {
    if (l.type === "run") return sportName(l) + " · " + runTitle({ k: l.kind, dist: l.dist });
    return t("day." + l.type) + (l.letter ? " " + l.letter : "");
  }

  function feelBox(i) {
    var l = S.log[i]; if (!l) return "";
    return '<div class="feel"><b>' + esc(t("feel.title")) + '</b><div class="chips">' + ["easy", "ok", "hard", "pain"].map(function (k) { return '<button class="chip" data-feel="' + k + '" data-i="' + i + '" aria-pressed="' + (l.feel === k) + '">' + esc(t("feel." + k)) + "</button>"; }).join("") + "</div>" +
      (l.feel === "pain" ? '<div class="note red">' + esc(t("feel.paintext")) + "</div>" : l.feel ? '<p class="qhint">' + esc(t("feel.thanks")) + "</p>" : "") + "</div>";
  }
  function daysAgo(d) { return Math.round((new Date(iso(new Date()) + "T12:00:00") - new Date(d + "T12:00:00")) / 86400000); }
  function btns(list) { return list.map(function (b, i) { return '<button class="btn' + (i ? " ghost" : "") + '" id="' + b[0] + '">' + esc(t(b[1])) + "</button>"; }).join(""); }
  function box(title, text, list) { return '<div class="card notice"><h3>' + esc(title) + "</h3><p>" + esc(text) + "</p>" + btns(list) + "</div>"; }
  function weeksToEvent() { var d = S.answers.event_datum; if (!d) return 0; var n = window.Progress.daysUntil(d, iso(new Date())); return n > 0 ? Math.ceil(n / 7) : 0; }
  // Immer nur ein Hinweis auf einmal, der wichtigste zuerst
  function notice(p, c) {
    var last = S.log[S.log.length - 1], now = weekStartIso(iso(new Date()));
    if (last && daysAgo(last.date) >= 10 && S.back !== last.date) return box(t("back.title", { n: daysAgo(last.date) }), t("back.text"), [["backeasy", "back.easy"], ["backgo", "back.go"]]);
    if (c.week > p.weeks) return box(t("end.title"), t("end.text"), [["newblock", "end.new"], ["chgoals", "coach.goals.change"]]);
    var left = weeksToEvent(), target = p.weeks - left + 1;
    if (p.run && left && target >= c.week + 2 && target <= p.weeks && S.alignSkip !== now) { ui.align = target; return box(t("align.title"), t("align.text", { n: target - c.week }), [["align", "align.do"], ["alignskip", "align.skip"]]); }
    var prevD = new Date(now + "T12:00:00"); prevD.setDate(prevD.getDate() - 7); var prev = iso(prevD);
    var lw = S.log.filter(function (l) { return weekStartIso(l.date) === prev; });
    if (lw.length && S.reviewSeen !== now) {
      var vol = lw.reduce(function (a, l) { return a + (l.vol || 0); }, 0), min = lw.reduce(function (a, l) { return a + (l.min || 0) + (l.cardio ? l.cardio.min : 0); }, 0);
      var ch = coachState().history.filter(function (h) { return !h.undone && weekStartIso(h.date) >= prev; }).length;
      return box(t("review.title"), t("review.text", { n: lw.length, vol: nf(vol, 0), min: nf(min, 0), ch: ch }), [["reviewok", "review.ok"]]);
    }
    if (S.log.length >= 3 && (!S.lastBackup || daysAgo(S.lastBackup) >= 14) && (!S.bkLater || daysAgo(S.bkLater) >= 7)) return box(t("backup.title"), t("backup.remind"), [["bknow", "backup.save"], ["bklater", "backup.later"]]);
    return "";
  }
  function saveBackup() {
    S.lastBackup = iso(new Date()); save();
    window.Share.save(new File([JSON.stringify({ app: "forma", version: C.VERSION, data: S })], "forma-backup-" + iso(new Date()) + ".json", { type: "application/json" }));
  }

  function todayView() {
    if (ui.finish && ui.finish.run) {
      var rl = S.log[ui.finish.idx];
      return '<div class="card done"><h3>' + esc(t("today.done.title")) + '</h3><div class="stats two">' + runStats(rl).map(function (x) { return '<div class="stat"><small>' + esc(x[0]) + "</small><b>" + esc(x[1] + " " + x[2]) + "</b></div>"; }).join("") + "</div>" + feelBox(ui.finish.idx) + '<button class="btn" data-share="' + ui.finish.idx + '">' + esc(t("share.btn")) + '</button><button class="btn ghost" id="finok">' + esc(t("today.done.ok")) + "</button></div>";
    }
    if (ui.finish) {
      var f = ui.finish, h = '<div class="card done"><h3>' + esc(t("today.done.title")) + '</h3><div class="stats two"><div class="stat"><small>' + esc(t("today.done.vol")) + "</small><b>" + nf(f.vol, 0) + ' kg</b></div><div class="stat"><small>' + esc(t("today.done.sets")) + "</small><b>" + f.sets + "</b></div></div>";
      f.prs.forEach(function (p) { h += '<div class="note warn">' + esc(t("today.done.pr")) + ": " + esc(p) + "</div>"; });
      return h + feelBox(f.idx) + '<button class="btn" data-share="' + f.idx + '">' + esc(t("share.btn")) + '</button><button class="btn ghost" id="finok">' + esc(t("today.done.ok")) + "</button></div>";
    }
    var p = ensurePlan();
    if (!p) return "";
    runAuto();
    var c = cur();
    if (c.item.t === "run") return runToday(p, c);
    var s = sess(c.idx, c.week), d = ensureDraft(c), deload = window.Plan.isDeload(c.week);
    var goal = c.items.length, got = weekGoalDone();
    var h = hello() + '<div class="sec">' + esc(t("today.next")) + (s.type === "fb" ? "" : " · " + esc(sessionTitle(s))) + '</div><h2 class="big">' + esc(headline(s)) + '</h2><div class="chips"><span class="pill acc">' + esc(t("today.week", { n: Math.min(c.week, p.weeks), total: p.weeks })) + '</span><span class="pill">' + esc(t("today.exercises", { n: s.exercises.length })) + "</span>" + (cardioFor(c.week, c.idx) ? '<span class="pill">+ ' + esc(t("cardio.pill", { min: cardioFor(c.week, c.idx).min })) + "</span>" : "") + "</div>";
    if (deload) h += '<div class="note warn">' + esc(t("today.deload")) + "</div>";
    if (((c.week - 1) % 8 === 0) && (c.week > 1 || p.cycle)) h += '<div class="note">' + esc(t("block.new")) + "</div>";
    h += notice(p, c) + goalCard(got, goal);
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
    h += cardioBox(cardioFor(c.week, c.idx), d);
    h += '<p class="err" id="err" role="alert">' + esc(ui.err) + '</p><button class="btn" id="finish">' + esc(t("today.finish")) + "</button>";
    return h;
  }

  function num(v) { var n = parseFloat(String(v).replace(",", ".")); return isFinite(n) ? n : 0; }

  // Pausen-Uhr: liegt außerhalb der App-Fläche, damit sie beim Neuzeichnen bleibt
  var restTimer = null;
  function stopRest() { clearInterval(restTimer); var el = document.getElementById("rest"); if (el) el.remove(); }
  function startRest(sec) {
    stopRest(); if (!(sec > 0)) return;
    var end = Date.now() + sec * 1000, el = document.createElement("div");
    el.id = "rest"; el.setAttribute("role", "timer");
    el.innerHTML = '<span id="resttxt"></span><b id="restnum"></b><button id="restadd">+30 s</button><button id="restx">' + esc(t("rest.skip")) + "</button>";
    document.body.appendChild(el);
    function tick() {
      var left = Math.max(0, Math.ceil((end - Date.now()) / 1000));
      document.getElementById("resttxt").textContent = t(left ? "rest.title" : "rest.done");
      document.getElementById("restnum").textContent = window.Progress.fmtTime(left);
      if (!left) { clearInterval(restTimer); el.className = "over"; if (navigator.vibrate) navigator.vibrate(200); }
    }
    document.getElementById("restadd").onclick = function () { end = Math.max(end, Date.now()) + 30000; el.className = ""; clearInterval(restTimer); restTimer = setInterval(tick, 500); tick(); };
    document.getElementById("restx").onclick = stopRest;
    restTimer = setInterval(tick, 500); tick();
  }
  function finishSession() {
    stopRest();
    var c = cur(), s = sess(c.idx, c.week), d = S.draft, vol = 0, sets = 0, prs = [], entry = { date: iso(new Date()), seq: c.seq, week: c.week, type: s.type, letter: s.letter, ex: [], vol: 0 };
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
    var cd = cardioFor(c.week, c.idx);
    if (cd && d.cardio && d.cardio.done) {
      var cv = { min: d.cardio.min === "" ? cd.min : num(d.cardio.min), kmh: d.cardio.kmh === "" ? cd.kmh : num(d.cardio.kmh), incline: d.cardio.incline === "" ? cd.incline : num(d.cardio.incline) };
      if (!(cv.min >= 1 && cv.min <= 600 && cv.kmh >= 0 && cv.kmh <= 30 && cv.incline >= 0 && cv.incline <= 40)) { ui.err = t("cardio.invalid"); render(); return; }
      entry.cardio = cv;
    }
    entry.vol = vol; S.log.push(entry); S.done = (S.done || 0) + 1; S.draft = null; ui.err = "";
    entry.focus = s.focus || []; entry.prs = prs; entry.weeks = S.plan.weeks;
    ui.finish = { vol: vol, sets: sets, prs: prs, idx: S.log.length - 1 }; save(); render();
  }

  function whyBox() {
    var p = S.plan, a = S.answers, G = window.Plan.goals(a), pr = window.Plan.prio(a), lines = [];
    lines.push(t("why.goal." + pr));
    if (G.length > 1) lines.push(t("why.extra", { g: G.filter(function (g) { return g !== pr; }).map(function (g) { return t("o.ziele." + g); }).join(", ") }));
    lines.push(t("why.days", { n: p.sessions.length, m: Number(a.dauer_min) || 60 }));
    lines.push(t("why.level." + p.level));
    var cw = window.Plan.cardio(a, p, 1, coachState().cardio);
    if (cw) lines.push(t(cw.fat ? "why.cardio.fat" : "why.cardio", { n: cw.count, min: cw.min }));
    if (a.ort) lines.push(t("why.place", { p: t("o.ort." + a.ort) }));
    var inj = (Array.isArray(a.verletzungen) ? a.verletzungen : []).filter(function (x) { return x !== "keine"; });
    if (inj.length) lines.push(t("why.injury", { l: inj.map(function (x) { return t("o.verletzungen." + x); }).join(", ") }));
    return '<details class="know why"' + (S.done ? "" : " open") + "><summary>" + esc(t("why.title")) + '</summary><ul class="tips">' + lines.map(function (x) { return "<li>" + esc(x) + "</li>"; }).join("") + "</ul></details>";
  }
  function planView() {
    var p = ensurePlan();
    if (!p) return "";
    var c = cur(), w = ui.planWeek || Math.min(c.week, p.weeks), before = window.Plan.doneBefore(p, w), rw = p.run ? window.Run.week(p.run, w) : null;
    var h = whyBox() + '<div class="weeks">' + Array.from({ length: p.weeks }, function (_, i) { var k = i + 1; return '<button data-week="' + k + '" aria-pressed="' + (k === w) + '"' + (k === Math.min(c.week, p.weeks) ? ' class="now"' : "") + ">" + k + (window.Plan.isDeload(k) ? "·" : "") + "</button>"; }).join("") + "</div>";
    h += '<div class="sec">' + esc(t("plan.week")) + " " + w + (window.Plan.isDeload(w) ? " · " + esc(t("plan.deloadnote")) : "") + "</div>";
    if (window.Plan.isDeload(w)) h += '<div class="note warn">' + esc(t("today.deload")) + "</div>";
    if (rw) h += '<div class="note">' + esc(weekLine(rw)) + "</div>";
    h += notesHtml();
    window.Plan.weekItems(p, w).forEach(function (it, i) {
      var isDone = (S.done || 0) > before + i, tick = isDone ? '<span class="pill acc">' + icon("check") + "</span>" : "";
      if (it.t === "run") {
        var r = w >= c.week ? adj(rw.runs[it.j]) : rw.runs[it.j], pace = paceText(r, rw.rung);
        h += '<div class="card psess"><div class="phead"><div><h3>' + esc(runTitle(r)) + '</h3><small class="fl">' + esc(sportName(r) + (runSize(r) === sportName(r) ? "" : " · " + runSize(r))) + "</small></div>" + tick + "</div>";
        runSteps(r).forEach(function (x) { h += '<p class="qhint">' + esc(x) + "</p>"; });
        if (pace) h += '<p class="qhint">' + esc(pace) + "</p>";
        h += "</div>";
        return;
      }
      var s = sess(it.i, w), cp = cardioFor(w, it.i);
      h += '<div class="card psess"><div class="phead"><div><h3>' + esc(headline(s)) + "</h3><small class=\"fl\">" + esc(sessionTitle(s) + (s.type === "fb" ? " · " + focusLine(s) : "")) + "</small></div>" + tick + "</div>";
      s.exercises.forEach(function (x) {
        h += '<div class="pex"><span>' + esc(exName(x.id)) + "</span><span>" + (w >= c.week ? setsAt(x, w) : window.Plan.setsFor(x, w)) + " × " + esc(x.text) + "</span></div>";
      });
      if (cp) h += '<div class="pex cardioline"><span>' + esc(t("cardio.after")) + "</span><span>" + esc(cardioLine(cp)) + "</span></div>";
      h += "</div>";
    });
    return h;
  }

  function historyView() {
    if (!S.log.length) return '<div class="card"><h3>' + esc(t("share.empty.title")) + "</h3><p>" + esc(t("share.empty.text")) + "</p></div>";
    var h = '<div class="sharebar" style="margin-top:18px"><button class="btn" data-share="' + (S.log.length - 1) + '">' + esc(t("share.last")) + '</button><button class="btn ghost" data-sharekind="week">' + esc(t("share.week")) + '</button></div><div class="sec">' + esc(t("prog.history")) + "</div>";
    var months = [], by = {};
    S.log.map(function (l, i) { return { l: l, i: i }; }).sort(function (x, y) { return x.l.date < y.l.date ? 1 : x.l.date > y.l.date ? -1 : y.i - x.i; }).forEach(function (x) {
      var m = x.l.date.slice(0, 7); if (!by[m]) { by[m] = []; months.push(m); } by[m].push(x);
    });
    months.forEach(function (m, n) {
      var name = new Date(m + "-15T12:00:00").toLocaleDateString(window.I18N.lang(), { month: "long", year: "numeric" });
      h += '<details class="month"' + (n === 0 || (ui.month === m) ? " open" : "") + ' data-month="' + m + '"><summary>' + esc(name + " (" + by[m].length + ")") + "</summary>";
      by[m].forEach(function (x) {
        var l = x.l, sets = l.ex.reduce(function (a, e) { return a + e.sets.length; }, 0), d = new Date(l.date + "T12:00:00");
        var info = l.type === "run" ? runStats(l).map(function (v) { return v[1] + " " + v[2]; }).join(" · ") : t("prog.entry", { vol: nf(l.vol, 0), sets: sets }) + (l.cardio ? " · " + t("cardio.pill", { min: nf(l.cardio.min, 0) }) : "");
        h += '<div class="card hist"><div><b>' + esc(logTitle(l)) + "</b><small>" + esc(d.toLocaleDateString(window.I18N.lang(), { weekday: "short", day: "numeric", month: "short" })) + " · " + esc(info) + '</small></div><div class="hr"><button class="swap" data-edit="' + x.i + '">' + esc(t("edit.btn")) + '</button><button class="swap" data-share="' + x.i + '">' + esc(t("share.btn")) + "</button></div></div>";
      });
      h += "</details>";
    });
    return h;
  }
  function editSheet() {
    var l = S.log[ui.edit]; if (!l) return "";
    var field = function (k, v, label, unit) { return '<label class="f"><input type="text" inputmode="decimal" data-ed="' + k + '" value="' + esc(v == null ? "" : String(v).replace(".", ",")) + '" aria-label="' + esc(label) + '"><i>' + esc(unit) + "</i></label>"; };
    var h = '<div class="sheet-bg" id="editbg"><div class="sheet" role="dialog" aria-modal="true"><h2>' + esc(t("edit.title")) + '</h2><p>' + esc(logTitle(l)) + '</p><div class="card ci"><input type="date" id="eddate" value="' + esc(l.date) + '" aria-label="' + esc(t("weight.date")) + '">';
    if (l.type === "run") h += '<div class="cirow">' + field("min", l.min, t("run.log.min"), t("today.min")) + field("km", l.km, t("run.log.km"), "km") + "</div>";
    else {
      l.ex.forEach(function (e, i) {
        h += "<b>" + esc(exName(e.id)) + "</b>";
        e.sets.forEach(function (r, j) { h += '<div class="cirow">' + field(i + ":" + j + ":kg", r.kg, t("today.kg"), t("today.kg")) + field(i + ":" + j + ":reps", r.reps, t("today.reps"), t("today.reps")) + "</div>"; });
      });
      if (l.cardio) h += "<b>Cardio</b>" + '<div class="cirow">' + field("c:min", l.cardio.min, t("run.log.min"), t("today.min")) + field("c:kmh", l.cardio.kmh, t("cardio.speed"), "km/h") + field("c:incline", l.cardio.incline, t("cardio.incline"), "%") + "</div>";
      h += '<p class="qhint">' + esc(t("edit.hint")) + "</p>";
    }
    return h + '</div><p class="err" id="ederr" role="alert">' + esc(ui.ederr || "") + '</p><button class="btn" id="edsave">' + esc(t("weight.save")) + '</button><button class="btn ghost danger" id="eddel">' + esc(t("edit.delete")) + '</button><button class="btn ghost" id="edclose">' + esc(t("profile.close")) + "</button></div></div>";
  }
  function saveEdit() {
    var l = JSON.parse(JSON.stringify(S.log[ui.edit])), bad = false, vals = {};
    $app.querySelectorAll("[data-ed]").forEach(function (el) { var raw = el.value.trim(), v = raw === "" ? 0 : parseFloat(raw.replace(",", ".")); if (!(v >= 0 && v <= 2000)) bad = true; vals[el.getAttribute("data-ed")] = v; });
    var date = document.getElementById("eddate").value;
    if (!date || date > iso(new Date())) bad = true;
    if (l.type === "run") { if (!(vals.min >= 1) || vals.km > 400) bad = true; l.min = vals.min; l.km = vals.km; }
    else {
      var vol = 0;
      l.ex.forEach(function (e, i) {
        e.sets = e.sets.map(function (r, j) { return { kg: vals[i + ":" + j + ":kg"], reps: vals[i + ":" + j + ":reps"] }; }).filter(function (r) { return r.reps > 0; });
        e.sets.forEach(function (r) { vol += r.kg * r.reps; });
      });
      l.ex = l.ex.filter(function (e) { return e.sets.length; });
      if (l.cardio) { l.cardio = { min: vals["c:min"], kmh: vals["c:kmh"], incline: vals["c:incline"] }; if (!(l.cardio.min >= 1)) delete l.cardio; else if (l.cardio.kmh > 30 || l.cardio.incline > 40) bad = true; }
      l.vol = vol; l.prs = [];
    }
    if (bad) { ui.ederr = t("edit.invalid"); render(); return; }
    l.date = date; S.log[ui.edit] = l; ui.edit = null; ui.ederr = ""; save(); render();
  }
  function deleteEntry() {
    var i = ui.edit, l = S.log[i]; if (!l || !window.confirm(t("edit.confirm"))) return;
    // war es die zuletzt erledigte Plan-Einheit, ist sie wieder offen
    if (l.seq !== null && l.seq === (S.done || 0) - 1) { S.done -= 1; S.draft = null; }
    S.log.splice(i, 1);
    if (S.coach && S.coach.seen) Object.keys(S.coach.seen).forEach(function (k) { if (S.coach.seen[k] > i) S.coach.seen[k] -= 1; });
    ui.edit = null; ui.finish = null; save(); render();
  }

  // ---------- Angaben ändern, ohne neu anzufangen ----------
  var EDITABLE = ["name", "gewicht_kg", "zielgewicht_kg", "trainingstage", "dauer_min", "ort", "heim", "schlaf", "verletzungen", "event_datum"];
  function answersSheet() {
    var d = ui.ans, h = '<div class="sheet-bg" id="ansbg"><div class="sheet" role="dialog" aria-modal="true"><h2>' + esc(t("ans.title")) + '</h2><p class="qhint">' + esc(t("ans.hint")) + "</p>";
    EDITABLE.forEach(function (id) {
      var q = QS.filter(function (x) { return x.id === id; })[0]; if (!q) return;
      if (id === "heim" && d.ort !== "zuhause") return;
      if (id === "event_datum" && !window.Plan.goals(S.answers).some(function (g) { return ["laufen", "marathon", "triathlon", "hyrox"].indexOf(g) >= 0; })) return;
      h += '<div class="ansq"><div class="lbl">' + esc(t("q." + id)) + "</div>";
      if (q.type === "text") h += '<label class="f"><input type="text" maxlength="30" autocomplete="given-name" data-anst="' + id + '" value="' + esc(d[id] || "") + '" aria-label="' + esc(t("q." + id)) + '"></label>';
      else if (q.type === "number") h += '<label class="f"><input type="text" inputmode="decimal" data-ansn="' + id + '" value="' + esc(d[id] == null ? "" : d[id]) + '" aria-label="' + esc(t("q." + id)) + '"><i>' + esc(unitText(q.unit)) + "</i></label>";
      else if (q.type === "date") h += '<input type="date" data-ansd="' + id + '" value="' + esc(d[id] || "") + '" aria-label="' + esc(t("q." + id)) + '">';
      else h += '<div class="chips">' + (q.options || []).map(function (o) {
        var on = q.type === "multi" ? (d[id] || []).indexOf(o) >= 0 : String(d[id]) === String(o);
        var label = typeof o === "number" ? o + (id === "dauer_min" ? " " + t("today.min") : "") : window.I18N.has("o." + id + "." + o) ? t("o." + id + "." + o) : t("o." + o);
        return '<button class="chip" data-anso="' + id + "|" + o + '" aria-pressed="' + on + '">' + esc(label) + "</button>";
      }).join("") + "</div>";
      h += "</div>";
    });
    return h + '<p class="err" id="anserr" role="alert">' + esc(ui.anserr || "") + '</p><button class="btn" id="anssave">' + esc(t("weight.save")) + '</button><button class="btn ghost" id="ansclose">' + esc(t("profile.close")) + "</button></div></div>";
  }
  function saveAnswers() {
    var d = ui.ans, bad = "";
    if (d.name !== undefined) { d.name = cleanName(d.name); if (!d.name) delete d.name; }
    EDITABLE.forEach(function (id) {
      var q = QS.filter(function (x) { return x.id === id; })[0]; if (!q) return;
      if (id === "heim" && d.ort !== "zuhause") return;
      if (q.type !== "date" && d[id] !== undefined && !window.Q.valid(q, d[id])) bad = bad || t("q." + id);
      if (id === "heim" && !(d.heim && d.heim.length)) bad = bad || t("q.heim");
    });
    if (bad) { ui.anserr = t("ans.invalid", { f: bad }); render(); return; }
    var rebuild = ["trainingstage", "dauer_min", "ort", "heim", "schlaf", "verletzungen", "event_datum"].some(function (k) { return JSON.stringify(d[k]) !== JSON.stringify(S.answers[k]); });
    var daysChanged = d.trainingstage !== S.answers.trainingstage, w = Number(String(d.gewicht_kg).replace(",", "."));
    // geändertes Gewicht zählt auch als aktueller Eintrag für die Ernährung
    if (w > 0 && String(d.gewicht_kg) !== String(ui.ansW)) { var today = iso(new Date()); S.weights = (S.weights || []).filter(function (x) { return x.date !== today; }).concat([{ date: today, kg: Math.round(w * 10) / 10 }]); }
    var pos = S.plan ? cur() : null;
    ["gewicht_kg", "zielgewicht_kg"].forEach(function (k) { if (d[k] !== undefined) d[k] = Number(d[k]); });
    S.answers = d; if (daysChanged) delete S.trainDays;
    if (rebuild && S.plan) {
      var cycle = S.plan.cycle;
      S.plan = window.Plan.generate(S.answers, EX); if (cycle) S.plan.cycle = cycle;
      // gleiche Woche, gleiche Stelle
      var week = Math.min(pos.week, S.plan.weeks), len = window.Plan.weekItems(S.plan, week).length;
      S.done = window.Plan.doneBefore(S.plan, week) + Math.min(pos.pos, len - 1); S.draft = null;
    }
    ui.ans = null; ui.anserr = ""; save(); render();
  }

  // ---------- Rückmeldung ----------
  function feedbackSheet() {
    return '<div class="sheet-bg" id="fbbg"><div class="sheet" role="dialog" aria-modal="true"><h2>' + esc(t("fb.title")) + "</h2><p>" + esc(t("fb.text")) + '</p><textarea id="fbtext" rows="6" aria-label="' + esc(t("fb.title")) + '">' + esc(ui.fbtext || "") + '</textarea><button class="btn" id="fbsend">' + esc(t("fb.send")) + '</button><p class="qhint" id="fbmsg" role="status"></p><button class="btn ghost" id="fbclose">' + esc(t("profile.close")) + "</button></div></div>";
  }
  function sendFeedback() {
    var msg = (document.getElementById("fbtext").value || "").trim(), say = function (k) { document.getElementById("fbmsg").textContent = t(k); };
    if (!msg) { say("fb.empty"); return; }
    var full = C.APP_NAME + " " + t("profile.version") + " " + C.VERSION + " (" + window.I18N.lang() + ", " + (/iphone|ipad/i.test(navigator.userAgent) ? "iPhone" : /android/i.test(navigator.userAgent) ? "Android" : "PC") + ")\n\n" + msg;
    var copy = function () { if (navigator.clipboard) navigator.clipboard.writeText(full).then(function () { say("fb.copied"); }, function () { say("fb.manual"); }); else say("fb.manual"); };
    if (navigator.share) navigator.share({ text: full }).catch(function (e) { if (!e || e.name !== "AbortError") copy(); }); else copy();
  }

  // ---------- App ----------
  var TABS = ["today", "plan", "progress", "nutrition", "coach"];
  var SUBS = { progress: ["training", "weight", "results", "races"], coach: ["check", "know", "qa", "goals"], nutrition: ["mealplan", "shopping"] };

  // ---------- Ernährung ----------
  function foodName(id) { var n = FOOD.foods[id].n; return n[window.I18N.lang()] || n.en; }
  function mealTitle(m) { return m.t[window.I18N.lang()] || m.t.en; }
  function itemText(it) { return (it.count > 0 ? it.count + " × " : it.amount + " g ") + foodName(it.id); }
  function trainDays() { return S.trainDays || window.Nutrition.defaultDays(S.answers); }
  // Mittel der Einträge der letzten 14 Tage, sonst der letzte Eintrag, sonst die Angabe vom Start
  function currentWeight() {
    var ws = (S.weights || []).slice().sort(function (a, b) { return a.date < b.date ? -1 : 1; });
    if (!ws.length) return null;
    var recent = ws.slice(-3).filter(function (w) { return daysAgo(w.date) <= 14; });
    var list = recent.length ? recent : ws.slice(-1);
    return Math.round(list.reduce(function (a, w) { return a + Number(w.kg); }, 0) / list.length * 10) / 10;
  }
  function nutriAnswers() { var w = currentWeight(); return w ? Object.assign({}, S.answers, { gewicht_kg: w }) : S.answers; }
  function nutriWeek() { runAuto(); return window.Nutrition.week(nutriAnswers(), FOOD, new Date(), S.nswap && S.nswap[window.Nutrition.weekInfo(new Date()).key], S.kcalAdj || 0, trainDays(), S.fav); }

  // ---------- Fortschritt: Gewicht, Ergebnisse, Rennen ----------
  function sortedWeights() { return (S.weights || []).slice().sort(function (a, b) { return a.date < b.date ? -1 : 1; }); }
  function goalMode() {
    var base = window.Nutrition.targets(nutriAnswers(), 0);
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
    if (d === 0) return;
    var step = window.Coach.weightStep(S.coach, adv, d, !!(S.plan && S.plan.run) || !!(S.plan && S.plan.light), iso(new Date()));
    S.coach = step.state; S.kcalAdj = (S.kcalAdj || 0) + step.kcal; S.kcalLog = log.concat([{ date: iso(new Date()), delta: step.kcal, state: adv.state }]); save();
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
    var ws = sortedWeights(), h = '<div class="card ci"><label class="fl-lbl" for="wkg">' + esc(t("weight.kg")) + '</label><label class="f big"><input type="text" inputmode="decimal" id="wkg" placeholder="' + (ws.length ? nf(ws[ws.length - 1].kg, 1) : nf(Number(S.answers.gewicht_kg) || 70, 1)) + '"><i>kg</i></label><label class="fl-lbl" for="wdate">' + esc(t("weight.date")) + '</label><input type="date" id="wdate" value="' + iso(new Date()) + '"><button class="btn" id="wsave">' + esc(t("weight.save")) + '</button><p class="err" id="werr" role="alert">' + esc(ui.err) + "</p></div>";
    if (ws.length) {
      var last = ws[ws.length - 1], first = ws[0], ch = Number(last.kg) - Number(first.kg), goal = Number(S.answers.zielgewicht_kg) || 0;
      h += '<div class="stats">' + '<div class="stat"><small>' + esc(t("weight.last")) + "</small><b>" + nf(last.kg, 1) + " kg</b></div>" +
        '<div class="stat"><small>' + esc(t("weight.change")) + "</small><b>" + (ch > 0 ? "+" : "") + nf(ch, 1) + " kg</b></div>" +
        '<div class="stat"><small>' + esc(t("weight.goal")) + "</small><b>" + (goal ? nf(goal, 1) + " kg" : "–") + "</b></div></div>";
      if (ws.length >= 2) h += '<div class="card chartc">' + chartSvg(ws.slice(-24), goal) + '</div><button class="btn ghost" data-sharekind="weight">' + esc(t("share.weight")) + "</button>";
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
    Object.keys(best).forEach(function (id) { h += '<div class="card hist"><div><b>' + esc(exName(id)) + "</b><small>" + esc(t("rs.best")) + ": " + nf(best[id].kg, 2) + " kg × " + best[id].reps + '</small></div><div class="hr"><span>' + esc(t("rs.e1rm")) + ": <b>" + nf(best[id].e, 1) + ' kg</b></span><button class="swap" data-sharekind="lift" data-shareid="' + id + '">' + esc(t("share.btn")) + "</button></div></div>"; });
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
      h += '<p class="qhint">' + esc(t("rs.predictnote")) + '</p><button class="btn ghost" data-sharekind="run">' + esc(t("share.btn")) + "</button></div>";
    }
    if (!R.length) h += '<p class="qhint">' + esc(t("rs.none")) + "</p>";
    else {
      h += '<div class="sec" style="margin-top:18px">' + esc(t("rs.all")) + "</div>";
      R.map(function (r, i) { return { r: r, i: i }; }).reverse().forEach(function (x) {
        var r = x.r, label = r.type === "lift" ? exName(r.ex) + ": " + nf(r.kg, 2) + " kg × " + r.reps : t("dist." + r.dist) + ": " + window.Progress.fmtTime(r.sec);
        h += '<div class="card hist"><div><b>' + esc(label) + "</b><small>" + esc(new Date(r.date + "T12:00:00").toLocaleDateString(window.I18N.lang(), { day: "numeric", month: "short", year: "numeric" })) + '</small></div><button class="swap" data-rsdel="' + x.i + '">' + esc(t("weight.delete")) + "</button></div>";
      });
    }
    return h;
  }

  function racesView() {
    var today = iso(new Date()), races = (S.races || []).slice(), G = window.Plan.goals(S.answers), h = "";
    if (S.answers.event_datum && !races.some(function (r) { return r.fromGoal; })) races.push({ id: "goal", name: t("race.fromgoal"), date: S.answers.event_datum, type: "other", fromGoal: true });
    races.sort(function (a, b) { return a.date < b.date ? -1 : 1; });
    h += '<div class="card ci"><h3>' + esc(t("race.add")) + '</h3><input type="text" id="rname" placeholder="' + esc(t("race.name")) + '" aria-label="' + esc(t("race.name")) + '"><div class="cicol"><input type="date" id="rdate" aria-label="' + esc(t("race.date")) + '"><select id="rtype" aria-label="' + esc(t("race.type")) + '">' +
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
    if (tg && currentWeight()) h += '<p class="qhint">' + esc(t("nutri.byweight", { kg: nf(currentWeight(), 1) })) + "</p>";
    var d = w.days[ui.nday] || w.days[0], lang = window.I18N.lang();
    var mon = w.info.monday;
    h += '<div class="sec">' + esc(t("nutri.week", { d: mon.toLocaleDateString(lang, { day: "numeric", month: "long" }) })) + '</div><div class="days">';
    for (var i = 0; i < 7; i++) {
      var dd = new Date(mon.getFullYear(), mon.getMonth(), mon.getDate() + i);
      h += '<button data-nday="' + i + '" aria-pressed="' + (i === ui.nday) + '"' + (w.days[i].train ? ' class="train"' : "") + '><small>' + esc(dd.toLocaleDateString(lang, { weekday: "short" })) + "</small><b>" + dd.getDate() + "</b></button>";
    }
    h += "</div>";
    h += '<button class="trainbtn" data-trainday="' + d.day + '" aria-pressed="' + d.train + '"><span class="tick"></span><span><b>' + esc(t(d.train ? "nutri.trainday" : "nutri.restday")) + "</b><small>" + esc(t("nutri.traintap")) + "</small></span></button>";
    if (d.train && window.Plan.goals(S.answers).some(function (g) { return ["laufen", "marathon", "triathlon", "hyrox"].indexOf(g) >= 0; })) h += '<div class="note">' + esc(t("nutri.during")) + "</div>";
    d.slots.forEach(function (s) {
      var key = d.day + "|" + s.index, open = !!ui.nopen[key];
      h += '<div class="card meal' + (s.slot === "pre" ? " pre" : "") + '"><div class="mhead"><span class="sec">' + esc(t("slot." + s.slot)) + '</span><button class="swap" data-swap="' + key + '"' + (s.pool < 2 ? " disabled" : "") + ">" + esc(t("nutri.swap")) + "</button></div>" +
        '<button class="fav" data-fav="' + s.meal.id + '" aria-pressed="' + !!(S.fav && S.fav[s.meal.id]) + '">' + (S.fav && S.fav[s.meal.id] ? "♥ " : "♡ ") + esc(t("nutri.fav")) + "</button>" +
        '<button class="mtitle" data-mopen="' + key + '" aria-expanded="' + open + '"><b>' + esc(mealTitle(s.meal)) + "</b></button>" + (s.slot === "pre" ? '<small class="prewhen">' + esc(t("nutri.prewhen")) + "</small>" : "") + "<small>" +
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

  function coachCheck() {
    var s = coachState(), h = '<p class="qhint">' + esc(t("check.intro")) + "</p>";
    var plain = t("check.asplanned");
    var rows = [[t("check.sets"), s.sets ? (s.sets > 0 ? "+" : "") + s.sets : plain], [t("check.endu"), s.endu === 1 ? plain : Math.round(s.endu * 100) + " %"]];
    if (S.plan && S.plan.run && S.plan.run.goal === "hyrox") rows.push([t("check.hx"), s.hx > 0 ? "+" + s.hx : String(s.hx)]);
    rows.push([t("check.cardio"), s.cardio ? s.cardio + " ×" : t("check.nocardio")], [t("check.kcal"), S.kcalAdj ? (S.kcalAdj > 0 ? "+" : "") + S.kcalAdj : plain]);
    h += '<div class="card"><h3>' + esc(t("check.now")) + "</h3>" + rows.map(function (r) { return '<div class="pex"><span>' + esc(r[0]) + "</span><span>" + esc(r[1]) + "</span></div>"; }).join("") + "</div>";
    var ad = S.plan ? window.Coach.adherence(S.log, window.Plan.weekItems(S.plan, cur().week).length, iso(new Date())) : null;
    if (ad) h += '<div class="note ' + (ad.low ? "warn" : "") + '">' + esc(t(ad.low ? "check.adh.low" : "check.adh.ok", { done: ad.done, total: ad.planned })) + "</div>";
    var adv = weightAdvice();
    if (adv && adv.mode === "cut" && adv.state === "tooslow") h += '<div class="card"><h3>' + esc(t("check.plateau")) + '</h3><ul class="tips">' + [1, 2, 3, 4].map(function (i) { return "<li>" + esc(t("check.plateau." + i)) + "</li>"; }).join("") + "</ul></div>";
    var hist = s.history.slice().reverse();
    h += '<div class="sec">' + esc(t("check.changes")) + "</div>";
    if (!hist.length) return h + '<div class="card"><p>' + esc(t("check.none")) + "</p></div>";
    var first = true;
    hist.slice(0, 15).forEach(function (c) {
      var can = !c.undone && first; if (!c.undone) first = false;
      h += '<div class="card change' + (c.undone ? " undone" : "") + '"><small>' + esc(new Date(c.date + "T12:00:00").toLocaleDateString(window.I18N.lang(), { day: "numeric", month: "long" })) + (c.undone ? " · " + esc(t("check.undone")) : "") + "</small><p>" + esc(t("check.c." + c.key, c.info || {})) + "</p>" + (can ? '<button class="swap" id="coachundo">' + esc(t("check.undo")) + "</button>" : "") + "</div>";
    });
    return h;
  }
  var CATS = ["kraft", "muskel", "essen", "laufen", "marathon", "triathlon", "hyrox", "erholung"];
  // Themen zu den eigenen Zielen zuerst. In Schutzfällen keine Ernährungs- und Gewichts-Zahlen.
  function knowledge() {
    var G = window.Plan.goals(S.answers), mine = {}, off = window.Q.screening(S.answers).nutriOff;
    var MAP = { kraft: ["kraft"], muskelaufbau: ["muskel", "kraft"], bodybuilding: ["muskel", "kraft"], abnehmen: ["essen"], fitness: ["kraft"], laufen: ["laufen"], marathon: ["marathon", "laufen"], triathlon: ["triathlon"], hyrox: ["hyrox"] };
    var rank = 0;
    [window.Plan.prio(S.answers)].concat(G).forEach(function (g) { (MAP[g] || []).forEach(function (c) { if (!mine[c]) mine[c] = ++rank; }); });
    var list = (KNOW[window.I18N.lang()] || KNOW.en || []).filter(function (x) { return !(off && (x.cat === "essen" || x.id === "b6")); });
    var cats = CATS.filter(function (c) { return list.some(function (x) { return x.cat === c; }); });
    cats.sort(function (a, b) { return (mine[a] || 99) - (mine[b] || 99) || CATS.indexOf(a) - CATS.indexOf(b); });
    return { list: list, cats: cats };
  }
  function knowList() {
    var k = knowledge(), f = (ui.knowq || "").trim().toLowerCase(), cat = ui.knowcat || k.cats[0];
    var items = k.list.filter(function (x) { return f ? (x.q + " " + x.a).toLowerCase().indexOf(f) >= 0 : x.cat === cat; });
    if (!items.length) return '<p class="qhint">' + esc(t("coach.qa.none")) + "</p>";
    return items.map(function (x) { return '<details class="know"><summary>' + esc(x.q) + "</summary><p>" + esc(x.a) + "</p></details>"; }).join("");
  }
  function knowView() {
    var k = knowledge(), cat = ui.knowcat || k.cats[0];
    return '<input class="search" id="knowsearch" type="search" placeholder="' + esc(t("know.search")) + '" value="' + esc(ui.knowq || "") + '" aria-label="' + esc(t("know.search")) + '"><div class="chips">' +
      k.cats.map(function (c) { return '<button class="chip" data-know="' + c + '" aria-pressed="' + (c === cat) + '">' + esc(t("know.cat." + c)) + "</button>"; }).join("") +
      '</div><div id="knowlist">' + knowList() + '</div><p class="qhint">' + esc(t("know.disc")) + "</p>";
  }
  function coachView() {
    if (ui.sub.coach === "know") return knowView();
    if (ui.sub.coach === "check") { ensurePlan(); runAuto(); coachReview(); return coachCheck(); }
    if (ui.sub.coach === "goals") {
      var G = window.Plan.goals(S.answers);
      return '<div class="card"><h3>' + esc(t("coach.goals.title")) + "</h3><p>" + esc(G.map(function (g) { return t("o.ziele." + g); }).join(", ")) + "</p><p>" + esc(t("coach.goals.text")) + '</p><button class="btn" id="chgoals">' + esc(t("coach.goals.change")) + "</button></div>";
    }
    var f = (ui.qaq || "").toLowerCase();
    var items = EX.filter(function (e) { return e.kategorie !== "hyrox" && (!f || exName(e.id).toLowerCase().indexOf(f) >= 0); });
    var h = '<p class="qhint">' + esc(t("coach.qa.hint")) + '</p><input class="search" id="qasearch" type="search" placeholder="' + esc(t("coach.qa.search")) + '" value="' + esc(ui.qaq || "") + '" aria-label="' + esc(t("coach.qa.search")) + '"><div class="qalist">';
    h += items.map(function (e) { return '<button class="qaitem" data-info="' + e.id + '"><span>' + esc(exName(e.id)) + "</span><small>" + esc(muscles(e).slice(0, 2).join(", ")) + "</small></button>"; }).join("");
    return h + (items.length ? "" : "<p>" + esc(t("coach.qa.none")) + "</p>") + "</div>";
  }

  function emptyCard(tab) {
    return '<div class="card"><h3>' + esc(t("empty." + tab + ".title")) + "</h3><p>" + esc(t("empty." + tab + ".text")) + "</p></div>";
  }

  function shell() {
    var tab = ui.tab, h = '<header class="top"><span class="brand"><img src="icons/mark-256.png?v=' + C.VERSION + '" alt="">' + esc(C.APP_NAME) +
      '</span><span class="hdbtns"><button class="icon-btn" id="hdshare" aria-label="' + esc(t("share.btn")) + '">' + icon("share") + '</button><button class="icon-btn" id="prof" aria-label="' + esc(t("profile.title")) + '">' + icon("user") + "</button></span></header><main>";
    if (tab !== "today" || ui.finish) h += "<h2>" + esc(t("tab." + tab)) + "</h2>";
    if (SUBS[tab]) {
      h += '<div class="seg" role="tablist">' + SUBS[tab].map(function (s) {
        return '<button role="tab" data-sub="' + s + '" aria-selected="' + (ui.sub[tab] === s) + '">' + esc(t("sub." + s)) + "</button>";
      }).join("") + "</div>";
    }
    var body = "";
    if (tab === "today") body = todayView();
    else if (tab === "plan") body = planView();
    else if (tab === "progress" && ui.sub.progress === "training") body = trendView() + historyView();
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
    if (ui.privacy) h += privacySheet();
    if (ui.info) h += infoSheet(ui.info);
    if (ui.share) h += shareSheet();
    if (ui.edit != null) h += editSheet();
    if (ui.ans) h += answersSheet();
    if (ui.fb) h += feedbackSheet();
    return h;
  }

  // ---------- Teilen ----------
  var MARK = null, SHARE_CV = null, SHARE_FILE = null;
  function weekStartIso(s) { var d = new Date(s + "T12:00:00"), k = (d.getDay() + 6) % 7; d.setDate(d.getDate() - k); return iso(d); }
  // Karten ohne einzelnes Training: Woche, Gewicht, Kraft-Rekord, Laufzeit
  function resultData(sh) {
    var lang = window.I18N.lang(), today = iso(new Date()), base = shareData(S.log.length - 1), R = S.results || [], stats, title, date = today;
    var week = base && weekStartIso(base.rawDate) === weekStartIso(today) ? base.weekStats : { done: 0, goal: S.plan ? S.plan.sessions.length : 3, days: [0, 0, 0, 0, 0, 0, 0], streak: 0 };
    if (sh.kind === "weight") {
      var ws = sortedWeights(); if (!ws.length) return null;
      var a = ws[0], b = ws[ws.length - 1], ch = Number(b.kg) - Number(a.kg); date = b.date;
      title = t("share.weight.title");
      stats = [[t("weight.change"), (ch > 0 ? "+" : "") + nf(ch, 1), "kg"], [t("weight.last"), nf(b.kg, 1), "kg"], [t("share.weeks.since"), String(Math.max(1, Math.round((new Date(b.date) - new Date(a.date)) / 604800000))), ""]];
    } else if (sh.kind === "lift") {
      var best = null; R.forEach(function (r) { if (r.type === "lift" && r.ex === sh.id) { var e = window.Progress.e1rm(r.kg, r.reps); if (!best || e > best.e) best = { e: e, kg: r.kg, reps: r.reps, date: r.date }; } });
      if (!best) return null; date = best.date; title = exName(sh.id);
      stats = [[t("rs.best"), nf(best.kg, 2), "kg"], [t("today.reps"), String(best.reps), "×"], [t("rs.e1rm"), nf(best.e, 1), "kg"]];
    } else if (sh.kind === "run") {
      var runs = R.filter(function (r) { return r.type === "run"; }); if (!runs.length) return null;
      var lr = runs[runs.length - 1], km = window.Progress.DIST[lr.dist]; date = lr.date; title = t("dist." + lr.dist);
      stats = [[t("run.stat.time"), window.Progress.fmtTime(lr.sec), ""], [t("rs.pace"), window.Progress.fmtTime(lr.sec / km), "/km"], [t("run.stat.dist"), nf(km, 1), "km"]];
    } else {
      title = t("share.week.title");
      var mine = S.log.filter(function (l) { return weekStartIso(l.date) === weekStartIso(today); });
      var min = mine.reduce(function (x, l) { return x + (l.min || 0); }, 0), vol = mine.reduce(function (x, l) { return x + (l.vol || 0); }, 0);
      stats = [[t("share.sessions"), week.done + "/" + week.goal, ""], [t("today.done.vol"), nf(vol, 0), "kg"], [t("run.stat.time"), nf(min, 0), t("today.min")]];
    }
    var dn = []; for (var q = 0; q < 7; q++) dn.push(new Date(2024, 0, 1 + q).toLocaleDateString(lang, { weekday: "short" }).slice(0, 2));
    return { title: title, date: new Date(date + "T12:00:00").toLocaleDateString(lang, { weekday: "long", day: "numeric", month: "long" }), rawDate: date, vol: 0, sets: 0, ex: 0, prs: [], week: 1, weeks: 1, lang: lang, brand: C.APP_NAME, dayNames: dn, weekStats: week,
      stats: stats, foot: stats[0][1] + " " + stats[0][2], exercises: stats.map(function (x) { return { name: x[0], best: x[1] + " " + x[2] }; }),
      labels: { volume: t("today.done.vol"), sets: t("today.done.sets"), exercises: t("share.exercises"), week: t("plan.week"), record: t("today.done.pr"), done: "", weekdone: t("share.weekdone"), weekprogress: t("share.weekprogress"), sessions: t("share.sessions"), streak: t("share.streak"), weeks: t("share.weeks") } };
  }
  function shareData(i) {
    var l = S.log[i]; if (!l) return null;
    var lang = window.I18N.lang(), ws = weekStartIso(l.date), goal = S.plan ? window.Plan.weekItems(S.plan, l.week).length : 3;
    var byWeek = {}; S.log.forEach(function (x) { var k = weekStartIso(x.date); byWeek[k] = (byWeek[k] || 0) + 1; });
    var days = [0, 0, 0, 0, 0, 0, 0]; S.log.forEach(function (x) { if (weekStartIso(x.date) === ws) days[(new Date(x.date + "T12:00:00").getDay() + 6) % 7] = 1; });
    var streak = 0, k = ws; while (byWeek[k] >= goal) { streak++; var dd = new Date(k + "T12:00:00"); dd.setDate(dd.getDate() - 7); k = iso(dd); }
    var isRun = l.type === "run", rs = isRun ? runStats(l) : null;
    var title = isRun ? runTitle({ k: l.kind, dist: l.dist }) : (l.type === "fb" || !(l.focus || []).length) ? t("day." + l.type) + (l.letter ? " " + l.letter : "") : l.focus.map(function (f) { return t("focus." + f); }).join(" · ");
    var exs = l.ex.map(function (e) { var b = e.sets.reduce(function (a, s) { return (s.kg * s.reps > a.kg * a.reps) ? s : a; }, e.sets[0]); return { name: exName(e.id), best: (b.kg ? nf(b.kg, 2) + " kg × " : "") + b.reps + (b.kg ? "" : " ×") }; });
    var dn = []; for (var q = 0; q < 7; q++) dn.push(new Date(2024, 0, 1 + q).toLocaleDateString(lang, { weekday: "short" }).slice(0, 2));
    if (isRun) exs = rs.map(function (x) { return { name: x[0], best: x[1] + " " + x[2] }; });
    var weekNo = Math.min(l.week, l.weeks || (S.plan && S.plan.weeks) || l.week), weekTotal = l.weeks || (S.plan && S.plan.weeks) || 12;
    return { rawDate: l.date, stats: isRun ? rs.concat([[t("plan.week"), weekNo + "/" + weekTotal, ""]]) : null, foot: isRun ? (l.km ? nf(l.km, 2) + " km" : nf(l.min, 1) + " " + t("today.min")) : null, title: title, date: new Date(l.date + "T12:00:00").toLocaleDateString(lang, { weekday: "long", day: "numeric", month: "long" }), vol: l.vol, sets: l.ex.reduce(function (a, e) { return a + e.sets.length; }, 0), ex: l.ex.length, prs: l.prs || [], week: Math.min(l.week, l.weeks || (S.plan && S.plan.weeks) || l.week), weeks: l.weeks || (S.plan && S.plan.weeks) || 12, lang: lang, brand: C.APP_NAME, exercises: exs, dayNames: dn,
      weekStats: { done: byWeek[ws] || 0, goal: goal, days: days, streak: streak },
      labels: { volume: t("today.done.vol"), sets: t("today.done.sets"), exercises: t("share.exercises"), week: t("plan.week"), record: t("today.done.pr"), done: t("share.done"), weekdone: t("share.weekdone"), weekprogress: t("share.weekprogress"), sessions: t("share.sessions"), streak: t("share.streak"), weeks: t("share.weeks") } };
  }
  function shareSheet() {
    var sh = ui.share, styles = ["stats", "poster", "photo", "week"];
    var R = S.results || [], what = [["week", t("share.what.week")]];
    if (S.log.length) what.push(["last", t("share.what.last")]);
    if ((S.weights || []).length) what.push(["weight", t("sub.weight")]);
    var lift = R.filter(function (r) { return r.type === "lift"; }).pop();
    if (lift) what.push(["lift", t("rs.strength")]);
    if (R.some(function (r) { return r.type === "run"; })) what.push(["run", t("rs.run")]);
    var active = sh.kind || (sh.idx === S.log.length - 1 ? "last" : "");
    var chooser = what.length > 1 ? '<div class="chips what">' + what.map(function (w) { return '<button class="chip" data-swhat="' + w[0] + '" aria-pressed="' + (active === w[0]) + '">' + esc(w[1]) + "</button>"; }).join("") + "</div>" : "";
    return '<div class="sheet-bg" id="sharebg"><div class="sheet" role="dialog" aria-modal="true"><h2>' + esc(t("share.title")) + "</h2>" + chooser + '<div class="sharecv" id="sharecv"></div><p class="qhint">' + esc(t("share.hint")) + '</p><div class="chips">' +
      styles.map(function (s) { return '<button class="chip" data-sstyle="' + s + '" aria-pressed="' + (sh.style === s) + '">' + esc(t("share.style." + s)) + "</button>"; }).join("") +
      '</div><label class="btn ghost filebtn">' + esc(t("share.photo")) + '<input type="file" accept="image/*" id="sharephoto" hidden></label><button class="btn" id="shareok">' + esc(t("share.apps")) + '</button><button class="btn ghost" id="sharesave">' + esc(t("share.save")) + '</button><p class="qhint" id="sharemsg" role="status"></p><button class="btn ghost" id="shareclose">' + esc(t("profile.close")) + "</button></div></div>";
  }
  async function drawShare() {
    var host = document.getElementById("sharecv"); if (!host || !ui.share) return;
    try { await Promise.all([document.fonts.load('700 100px "Barlow Condensed"'), document.fonts.load('600 40px Inter')]); } catch (e) {}
    if (!MARK) MARK = await new Promise(function (res) { var im = new Image(); im.onload = function () { res(im); }; im.onerror = function () { res(null); }; im.src = "icons/mark.png?v=" + C.VERSION; });
    var d = ui.share.kind ? resultData(ui.share) : shareData(ui.share.idx); if (!d) return;
    SHARE_CV = window.Share.draw(ui.share.style, d, MARK, ui.share.photo);
    // Bild schon jetzt erzeugen: iPhones erlauben das Teilen nur direkt beim Antippen
    SHARE_FILE = null; var name = "forma-" + d.rawDate + ".png";
    SHARE_CV.toBlob(function (b) { if (b) SHARE_FILE = new File([b], name, { type: "image/png" }); }, "image/png");
    SHARE_CV.className = "sharecanvas"; host.innerHTML = ""; host.appendChild(SHARE_CV);
  }

  function muscles(e) {
    var lang = window.I18N.lang();
    if (lang === "de") return e.muskeln || [];
    return TIPS[lang] && TIPS[lang][e.id] ? TIPS[lang][e.id].muskeln : [];
  }
  function list(arr) { return '<ul class="tips">' + arr.map(function (x) { return "<li>" + esc(x) + "</li>"; }).join("") + "</ul>"; }
  function infoSheet(id) {
    var e = EXBY[id]; if (!e) return "";
    var lang = window.I18N.lang(), tr = TIPS[lang] && TIPS[lang][id], q = encodeURIComponent(exName(id) + (lang === "de" ? " Technik" : lang === "es" ? " técnica" : lang === "fr" ? " technique" : " form technique"));
    var h = '<div class="sheet-bg" id="infobg"><div class="sheet" role="dialog" aria-modal="true"><h2>' + esc(exName(id)) + "</h2>";
    if (lang !== "de" && !tr) h += '<div class="note">' + esc(t("info.de_only")) + "</div>";
    if (tr) e = tr;
    if (lang === "de" || tr) h += '<div class="lbl">' + esc(t("info.muscles")) + ": " + esc((e.muskeln || []).join(", ")) + "</div>";
    h += "<h3>" + esc(t("info.cues")) + "</h3>" + list(e.cues || []);
    if ((e.fehler || []).length) h += "<h3>" + esc(t("info.mistakes")) + "</h3>" + list(e.fehler);
    if (e.atmung) h += "<h3>" + esc(t("info.breath")) + "</h3><p>" + esc(e.atmung) + "</p>";
    if (e.sicherheit) h += "<h3>" + esc(t("info.safety")) + '</h3><p>' + esc(e.sicherheit) + "</p>";
    if (e.leichter) h += '<p class="lbl">' + esc(t("info.easier")) + ": " + esc(e.leichter) + "</p>";
    if (e.schwerer) h += '<p class="lbl">' + esc(t("info.harder")) + ": " + esc(e.schwerer) + "</p>";
    h += '<a class="btn vid" target="_blank" rel="noopener noreferrer" href="https://www.youtube.com/results?search_query=' + q + '">' + esc(t("info.video")) + '</a><button class="btn ghost" id="infoclose">' + esc(t("info.close")) + "</button></div></div>";
    return h;
  }

  function privacySheet() {
    return '<div class="sheet-bg" id="privbg"><div class="sheet" role="dialog" aria-modal="true"><h2>' + esc(t("priv.title")) + "</h2>" +
      ["local", "photo", "fonts", "host", "links", "delete"].map(function (k) { return "<p>" + esc(t("priv." + k)) + "</p>"; }).join("") +
      '<button class="btn ghost" id="privclose">' + esc(t("profile.close")) + "</button></div></div>";
  }
  function validBackup(d) {
    var x = d && d.app === "forma" && d.data;
    if (!x || typeof x !== "object" || typeof x.answers !== "object" || !Array.isArray(x.log)) return false;
    if (!C.LANGS.some(function (l) { return l.code === x.lang; })) return false;
    // keine HTML-Zeichen aus fremden Dateien übernehmen (auch keine Anführungszeichen)
    var safe = function (v) {
      if (typeof v === "string") return !/[<>"]/.test(v);
      if (v && typeof v === "object") return Object.keys(v).every(function (k) { return safe(k) && safe(v[k]); });
      return true;
    };
    return safe(x);
  }
  function profileSheet() {
    return '<div class="sheet-bg" id="bg"><div class="sheet" role="dialog" aria-modal="true"><h2>' + esc(t("profile.title")) + "</h2>" + hello() +
      '<div><div class="lbl">' + esc(t("profile.language")) + '</div><div class="chips">' +
      C.LANGS.map(function (l) { return '<button class="chip" data-lang="' + l.code + '" lang="' + l.code + '" aria-pressed="' + (S.lang === l.code) + '">' + esc(l.label) + "</button>"; }).join("") +
      '</div></div><button class="btn" id="ansopen">' + esc(t("ans.title")) + '</button><button class="btn ghost" id="fbopen">' + esc(t("fb.title")) + '</button><button class="btn ghost" id="redo">' + esc(t("profile.redo")) + '</button><div><div class="lbl">' + esc(t("backup.title")) + '</div><p class="qhint">' + esc(t("backup.text")) + '</p></div><button class="btn ghost" id="bksave">' + esc(t("backup.save")) + '</button><label class="btn ghost filebtn">' + esc(t("backup.load")) + '<input type="file" accept=".json,application/json" id="bkload" hidden></label><p class="qhint" id="bkmsg" role="status"></p><div><div class="lbl">' + esc(t("install.title")) + '</div><p class="qhint">' + esc(t("install.ios")) + "<br>" + esc(t("install.android")) + '</p></div><button class="btn ghost" id="privopen">' + esc(t("priv.title")) + '</button><p class="ver">' + esc(t("profile.disclaimer")) + '</p><div class="ver">' + esc(t("profile.version")) + " " + C.VERSION + '</div><button class="btn ghost" id="close">' + esc(t("profile.close")) + "</button></div></div>";
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
    on("open", function () { S.onboarded = true; S.plan = null; delete S.trainDays; ensurePlan(); save(); render(); });
    var q = !S.onboarded && S.welcomed && !S.qdone && QS.length ? currentQ() : null;
    $app.querySelectorAll("[data-opt]").forEach(function (b) { b.onclick = function () { pickOption(q, b.getAttribute("data-opt")); }; });
    var inp = document.getElementById("num");
    if (inp) { inp.onkeydown = function (e) { if (e.key === "Enter") tryNext(); }; if (q && q.type === "number") inp.focus(); }
    $app.querySelectorAll("[data-tab]").forEach(function (b) { b.onclick = function () { ui.tab = b.getAttribute("data-tab"); stopRest(); render(); window.scrollTo(0, 0); }; });
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
        var cx = cur(), sx = sess(cx.idx, cx.week), ex = sx && sx.exercises.find(function (x) { return x.id === parts[0]; });
        if (r.done && ex) startRest(ex.rest); else stopRest();
      };
    });
    on("finish", finishSession);
    $app.querySelectorAll("[data-edit]").forEach(function (b) { b.onclick = function () { ui.edit = Number(b.getAttribute("data-edit")); ui.ederr = ""; ui.month = S.log[ui.edit].date.slice(0, 7); render(); }; });
    on("edsave", saveEdit); on("eddel", deleteEntry);
    on("edclose", function () { ui.edit = null; render(); });
    on("ansopen", function () { ui.profile = false; ui.ans = JSON.parse(JSON.stringify(S.answers)); var ws = sortedWeights(); ui.ansW = ui.ans.gewicht_kg; if (ws.length) ui.ans.gewicht_kg = ws[ws.length - 1].kg; ui.ansW = ui.ans.gewicht_kg; ui.anserr = ""; render(); });
    on("ansclose", function () { ui.ans = null; render(); });
    on("anssave", saveAnswers);
    $app.querySelectorAll("[data-ansn]").forEach(function (el) { el.oninput = function () { var id = el.getAttribute("data-ansn"); if (el.value.trim() === "") delete ui.ans[id]; else ui.ans[id] = el.value.trim().replace(",", "."); }; });
    $app.querySelectorAll("[data-anst]").forEach(function (el) { el.oninput = function () { ui.ans[el.getAttribute("data-anst")] = el.value; }; });
    $app.querySelectorAll("[data-ansd]").forEach(function (el) { el.onchange = function () { var id = el.getAttribute("data-ansd"); if (el.value) ui.ans[id] = el.value; else delete ui.ans[id]; }; });
    $app.querySelectorAll("[data-anso]").forEach(function (b) {
      b.onclick = function () {
        var p = b.getAttribute("data-anso").split("|"), q = QS.filter(function (x) { return x.id === p[0]; })[0];
        var val = typeof q.options[0] === "number" ? Number(p[1]) : p[1];
        if (q.type === "multi") {
          var list = (ui.ans[p[0]] || []).slice(), at = list.indexOf(val), solo = val === "keine" || val === "koerper";
          if (at >= 0) list.splice(at, 1); else list = solo ? [val] : list.filter(function (x) { return x !== "keine" && x !== "koerper"; }).concat([val]);
          ui.ans[p[0]] = list;
        } else ui.ans[p[0]] = val;
        var sh = $app.querySelector("#ansbg .sheet"), y = sh.scrollTop; render(); $app.querySelector("#ansbg .sheet").scrollTop = y;
      };
    });
    on("fbopen", function () { ui.profile = false; ui.fb = true; render(); });
    on("fbclose", function () { ui.fb = false; render(); });
    on("fbsend", sendFeedback);
    var ft = document.getElementById("fbtext"); if (ft) ft.oninput = function () { ui.fbtext = ft.value; };
    $app.querySelectorAll("[data-rsdel]").forEach(function (b) { b.onclick = function () { if (!window.confirm(t("edit.confirm"))) return; S.results.splice(Number(b.getAttribute("data-rsdel")), 1); save(); render(); }; });
    $app.querySelectorAll("[data-cardio]").forEach(function (el) { el.oninput = function () { if (S.draft && S.draft.cardio) { S.draft.cardio[el.getAttribute("data-cardio")] = el.value; save(); } }; });
    on("cardiochk", function () { if (!S.draft || !S.draft.cardio) return; S.draft.cardio.done = !S.draft.cardio.done; document.getElementById("cardiochk").setAttribute("aria-pressed", S.draft.cardio.done); save(); });
    on("hdshare", function () { ui.share = { kind: "week", style: "week", photo: null }; stopRest(); render(); });
    $app.querySelectorAll("[data-swhat]").forEach(function (b) {
      b.onclick = function () {
        var k = b.getAttribute("data-swhat"), ph = ui.share.photo;
        if (k === "last") ui.share = { idx: S.log.length - 1, style: "stats", photo: ph };
        else {
          var lift = (S.results || []).filter(function (r) { return r.type === "lift"; }).pop();
          ui.share = { kind: k, id: k === "lift" && lift ? lift.ex : null, style: k === "week" ? "week" : "stats", photo: ph };
        }
        render();
      };
    });
    $app.querySelectorAll("[data-trend]").forEach(function (b) { b.onclick = function () { ui.trend = b.getAttribute("data-trend"); render(); }; });
    var tx = document.getElementById("trendex"); if (tx) tx.onchange = function () { ui.trendEx = tx.value; render(); };
    $app.querySelectorAll("[data-feel]").forEach(function (b) {
      b.onclick = function () { var l = S.log[Number(b.getAttribute("data-i"))]; if (!l) return; l.feel = b.getAttribute("data-feel"); save(); coachReview(); render(); };
    });
    on("coachundo", function () { var u = window.Coach.undo(S.coach); S.coach = u.state; S.kcalAdj = (S.kcalAdj || 0) + u.kcal; S.draft = null; save(); render(); });
    on("rundone", finishRun);
    on("runskip", function () { S.done = (S.done || 0) + 1; S.draft = null; ui.err = ""; save(); render(); window.scrollTo(0, 0); });
    $app.querySelectorAll("[data-run]").forEach(function (el) { el.oninput = function () { if (S.draft && S.draft.run) { S.draft[el.getAttribute("data-run")] = el.value; save(); } }; });
    on("finok", function () { ui.finish = null; render(); window.scrollTo(0, 0); });
    $app.querySelectorAll("[data-info]").forEach(function (b) { b.onclick = function () { ui.info = b.getAttribute("data-info"); render(); }; });
    on("infoclose", function () { ui.info = null; render(); });
    $app.querySelectorAll("[data-share]").forEach(function (b) { b.onclick = function () { ui.share = { idx: Number(b.getAttribute("data-share")), style: "stats", photo: null }; render(); }; });
    $app.querySelectorAll("[data-sstyle]").forEach(function (b) { b.onclick = function () { ui.share.style = b.getAttribute("data-sstyle"); render(); }; });
    on("shareclose", function () { ui.share = null; render(); });
    var sbg = document.getElementById("sharebg");
    if (sbg) sbg.onclick = function (e) { if (e.target === sbg) { ui.share = null; render(); } };
    var sp = document.getElementById("sharephoto");
    if (sp) sp.onchange = function () {
      var f = sp.files && sp.files[0]; if (!f) return;
      var url = URL.createObjectURL(f), im = new Image();
      im.onload = function () { ui.share.photo = im; ui.share.style = "photo"; render(); };
      im.src = url;
    };
    var say = function (k) { var m = document.getElementById("sharemsg"); if (m) m.textContent = t(k); };
    on("shareok", function () { if (SHARE_FILE) window.Share.share(SHARE_FILE, C.APP_NAME).then(function (r) { if (r === "saved") say("share.saved"); }); });
    on("sharesave", function () { if (SHARE_FILE) { window.Share.save(SHARE_FILE); say("share.saved"); } });
    $app.querySelectorAll("[data-sharekind]").forEach(function (b) { b.onclick = function () { ui.share = { kind: b.getAttribute("data-sharekind"), id: b.getAttribute("data-shareid"), style: b.getAttribute("data-sharekind") === "week" ? "week" : "stats", photo: null }; render(); }; });
    if (ui.share) drawShare();
    $app.querySelectorAll("[data-nday]").forEach(function (b) { b.onclick = function () { ui.nday = Number(b.getAttribute("data-nday")); render(); }; });
    $app.querySelectorAll("[data-fav]").forEach(function (b) { b.onclick = function () { var id = b.getAttribute("data-fav"); S.fav = S.fav || {}; if (S.fav[id]) delete S.fav[id]; else S.fav[id] = 1; save(); render(); }; });
    $app.querySelectorAll("[data-trainday]").forEach(function (b) {
      b.onclick = function () {
        var day = Number(b.getAttribute("data-trainday")), list = trainDays().slice(), at = list.indexOf(day);
        if (at >= 0) list.splice(at, 1); else list.push(day);
        S.trainDays = list; ui.nopen = {}; save(); render();
      };
    });
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
    $app.querySelectorAll("[data-know]").forEach(function (b) { b.onclick = function () { ui.knowcat = b.getAttribute("data-know"); ui.knowq = ""; render(); }; });
    var ks = document.getElementById("knowsearch");
    if (ks) ks.oninput = function () { ui.knowq = ks.value; document.getElementById("knowlist").innerHTML = knowList(); };
    var qs = document.getElementById("qasearch");
    if (qs) qs.oninput = function () { ui.qaq = qs.value; var pos = qs.selectionStart; render(); var n = document.getElementById("qasearch"); if (n) { n.focus(); n.setSelectionRange(pos, pos); } };
    var ibg = document.getElementById("infobg");
    if (ibg) ibg.onclick = function (e) { if (e.target === ibg) { ui.info = null; render(); } };
    var bkmsg = function (k) { var m = document.getElementById("bkmsg"); if (m) m.textContent = t(k); };
    on("bksave", function () { saveBackup(); bkmsg("backup.saved"); });
    on("bknow", function () { saveBackup(); render(); });
    on("bklater", function () { S.bkLater = iso(new Date()); save(); render(); });
    on("backgo", function () { S.back = S.log[S.log.length - 1].date; save(); render(); });
    on("backeasy", function () {
      var c = cur(); S.back = S.log[S.log.length - 1].date; S.coach = window.Coach.comeback(S.coach, iso(new Date()));
      if (c.week > 1) S.done = window.Plan.doneBefore(S.plan, c.week - 1);
      S.draft = null; save(); render(); window.scrollTo(0, 0);
    });
    on("align", function () { S.done = window.Plan.doneBefore(S.plan, ui.align); S.draft = null; save(); render(); window.scrollTo(0, 0); });
    on("alignskip", function () { S.alignSkip = weekStartIso(iso(new Date())); save(); render(); });
    on("reviewok", function () { S.reviewSeen = weekStartIso(iso(new Date())); save(); render(); });
    on("newblock", function () {
      var cycle = (S.plan.cycle || 0) + Math.max(1, Math.ceil(S.plan.weeks / 8));
      S.plan = window.Plan.generate(S.answers, EX); S.plan.cycle = cycle; S.done = 0; S.draft = null; save(); render(); window.scrollTo(0, 0);
    });
    var bk = document.getElementById("bkload");
    if (bk) bk.onchange = function () {
      var f = bk.files && bk.files[0]; if (!f || f.size > 5000000) { bkmsg("backup.bad"); return; }
      f.text().then(function (txt) {
        var d = null; try { d = JSON.parse(txt); } catch (e) {}
        if (!validBackup(d)) { bkmsg("backup.bad"); return; }
        if (!window.confirm(t("backup.confirm"))) return;
        localStorage.setItem(KEY, JSON.stringify(d.data)); window.location.reload();
      });
    };
    on("privopen", function () { ui.profile = false; ui.privacy = true; render(); });
    on("privclose", function () { ui.privacy = false; render(); });
    var pbg = document.getElementById("privbg");
    if (pbg) pbg.onclick = function (e) { if (e.target === pbg) { ui.privacy = false; render(); } };
    on("prof", function () { ui.profile = true; render(); });
    on("close", function () { ui.profile = false; render(); });
    on("redo", function () {
      if (!window.confirm(t("profile.redoask"))) return;
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
    getJSON("data/essen.json").then(function (d) { FOOD = d; }),
    getJSON("data/tips.json").then(function (d) { TIPS = d; }),
    getJSON("data/wissen.json").then(function (d) { KNOW = d; })
  ]).then(render, render);

  if ("serviceWorker" in navigator && location.protocol.indexOf("http") === 0) {
    navigator.serviceWorker.register("sw.js?v=" + C.VERSION).catch(function () {});
  }
})();
