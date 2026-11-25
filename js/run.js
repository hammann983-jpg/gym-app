// Lauf-Einheiten (reine Funktionen). Tabellen: lauf-coach (einstieg.md, plaene-5k-10k-hm.md), marathon-coach (plaene.md),
// Tempo-Regeln: trainingsarten-zonen.md Abschnitt 5.
(function () {
  var RACE_KM = { "5k": 5, "10k": 10, hm: 21.0975, m: 42.195 };
  var HEAVY = { fb: 1, uk: 1, legs: 1 };
  var HARD = { quality: 1, long: 1, race: 1, hybrid: 1, sim: 1, brick: 1, bikehard: 1, hyroxrace: 1, trirace: 1 };

  function E(min) { return { k: "easy", min: min }; }
  function Qy(min, q) { return q ? { k: "quality", min: min, q: [q] } : { k: "easy", min: min }; }
  function L(min, q) { return q ? { k: "long", min: min, q: [q] } : { k: "long", min: min }; }
  function R(dist) { return { k: "race", dist: dist }; }
  function fast(n, m, rest) { return rest ? { id: "fast", n: n, m: m, r: rest } : { id: "fast_norest", n: n, m: m }; }
  function tempo(m) { return { id: "tempo", m: m }; }
  var STR = { id: "strides" }, STR4 = { id: "strides_n", n: 4 }, SURGE = { id: "surges", n: 4, m: 1 };

  // Einstieg: 8 Wochen, 3x pro Woche, davor und danach je 5 Min. gehen
  function RW(n, run, walk) { return { k: "runwalk", n: n, run: run, walk: walk, min: Math.round(n * (run + walk)) + 10 }; }
  var einstieg = [RW(8, 1, 2), RW(8, 2, 2), RW(6, 3, 2), RW(5, 3, 1.5), RW(4, 5, 2), RW(3, 8, 2), RW(2, 12, 2), { k: "cont", run: 25, min: 35 }]
    .map(function (s) { return [s, s, s]; });

  var k5 = [
    [E(25), Qy(25, STR4), L(30)],
    [E(25), Qy(30, fast(5, 2, 2)), L(35)],
    [E(30), Qy(30, tempo(12)), L(40)],
    [E(25), Qy(25), L(30)],
    [E(30), Qy(35, fast(5, 3, 2)), L(40)],
    [E(30), Qy(35, tempo(20)), L(45)],
    [E(30), Qy(40, fast(6, 3, 2)), L(50)],
    [E(25), Qy(20, SURGE), R("5k")]
  ];
  var k10 = [
    [E(30), Qy(30, STR), L(45)],
    [E(30), Qy(35, fast(5, 3, 2)), L(50)],
    [E(30), Qy(40, tempo(15)), L(55)],
    [E(30), Qy(30), L(45)],
    [E(35), Qy(40, fast(6, 3)), L(60)],
    [E(35), Qy(45, tempo(20)), L(65)],
    [E(35), Qy(45, fast(5, 4, 2)), L(70)],
    [E(30), Qy(35), L(50)],
    [E(35), Qy(45, tempo(25)), L(75)],
    [E(30), Qy(25, SURGE), R("10k")]
  ];
  var hm = [
    [E(30), Qy(35, STR), E(35), L(60)],
    [E(30), Qy(40, fast(5, 3)), E(40), L(65)],
    [E(30), Qy(40, tempo(15)), E(45), L(75)],
    [E(30), Qy(35), E(35), L(60)],
    [E(35), Qy(45, fast(6, 3)), E(45), L(85)],
    [E(35), Qy(45, tempo(20)), E(50), L(90)],
    [E(35), Qy(50, { id: "km_tempo", n: 5 }), E(50), L(100)],
    [E(35), Qy(40), E(40), L(70)],
    [E(40), Qy(50, tempo(25)), E(55), L(105)],
    [E(40), Qy(50, fast(6, 4, 2)), E(55), L(110, { id: "long_race", m: 20 })],
    [E(35), Qy(40, tempo(10)), E(35), L(75)],
    [E(30), Qy(25, SURGE), E(20), R("hm")]
  ];

  // Marathon-Finisher: [Wochen-km, langer Lauf km, Qualität, Zusatz im langen Lauf]
  function kf(n, r) { return { id: "km_fast", n: n, r: r || 0 }; }
  function mt(m) { return { id: "mtempo", m: m }; }
  var MAR = [
    [30, 12], [33, 14], [36, 16], [28, 12],
    [38, 18, kf(4, 2)], [41, 20, mt(20)], [45, 22, kf(5, 2)], [35, 16],
    [46, 24, mt(25), { id: "mrt_from", at: 18, km: 3 }], [50, 26, kf(6, 2)], [53, 28, mt(30), { id: "mrt_last", km: 5 }], [40, 20],
    [58, 32, mt(20), { id: "mrt_in", km: 8 }], [46, 24, mt(20)], [35, 16, kf(3)], [22, 10, { id: "km_mrt", n: 3 }]
  ];
  var m = MAR.map(function (r, i) {
    var rest = r[0] - r[1], a = Math.ceil(rest / 3), b = Math.ceil((rest - a) / 2), c = rest - a - b;
    var first = { k: "easy", km: a }, mid = r[2] ? { k: "quality", km: b, q: [r[2]] } : { k: "easy", km: b };
    var last = { k: "easy", km: c }, long = { k: "long", km: r[1] };
    if (r[3]) long.q = [r[3]];
    // Rennwoche: der 10-km-Lauf liegt früh in der Woche, danach das Rennen
    if (i === 15) return [first, { k: "long", km: r[1] }, mid, last, R("m")];
    return [first, mid, last, long];
  });

  var TABLES = { einstieg: einstieg, "5k": k5, "10k": k10, hm: hm, m: m };
  var FLAGS = { einstieg: { 4: "deload" }, "5k": { 4: "deload", 8: "taper" }, "10k": { 4: "deload", 8: "deload", 10: "taper" }, hm: { 4: "deload", 8: "deload", 11: "taper", 12: "taper" }, m: { 4: "deload", 8: "deload", 12: "deload", 13: "peak", 14: "taper", 15: "taper", 16: "taper" } };

  function copy(o) { return JSON.parse(JSON.stringify(o)); }

  function goalOf(a) {
    var G = window.Plan.goals(a), p = window.Plan.prio(a);
    if (p === "laufen" || p === "marathon") return p;
    return G.indexOf("marathon") >= 0 ? "marathon" : G.indexOf("laufen") >= 0 ? "laufen" : null;
  }

  // secondary: Laufen ist Zusatzziel. Dann entfällt bei 4 Läufen ein lockerer Lauf (nichts wird draufgepackt).
  function build(a, today, secondary) {
    var g = goalOf(a);
    if (!g) return null;
    var chain = window.Plan.runChain(a, g).slice(), short = false, ew = 0;
    var total = function () { return chain.reduce(function (s, r) { return s + TABLES[r].length; }, 0); };
    if (a.event_datum) ew = Math.ceil((new Date(a.event_datum + "T12:00:00") - (today || new Date())) / 86400000 / 7);
    if (ew >= 2) while (chain.length > 1 && total() > ew) { chain.shift(); short = true; }
    var weeks = [];
    chain.forEach(function (r) {
      TABLES[r].forEach(function (s, i) {
        var runs = copy(s);
        if (secondary) {
          var easy = runs.map(function (x, j) { return x.k === "easy" ? j : -1; }).filter(function (j) { return j >= 0; });
          if (runs.filter(function (x) { return x.k !== "race"; }).length > 3 && easy.length > 1) runs.splice(easy[easy.length - 1], 1);
        }
        weeks.push({ rung: r, n: i + 1, of: TABLES[r].length, flag: FLAGS[r][i + 1] || null, runs: runs });
      });
    });
    if (ew >= 2 && weeks.length > ew) { weeks = weeks.slice(-ew); short = true; } // nur die letzten Wochen, mit Taper
    return { goal: g, weeks: weeks, short: short, secondary: !!secondary };
  }

  // Woche n (ab 1). Nach dem Ende: leichte Woche der letzten Stufe zum Halten.
  function week(run, n) {
    if (n <= run.weeks.length) return run.weeks[n - 1];
    if (run.hold) return run.hold;
    var r = run.weeks[run.weeks.length - 1].rung, i = r === "einstieg" ? 7 : 3, runs = copy(TABLES[r][i]);
    if (run.secondary && runs.length > 3) runs.splice(2, 1);
    return { rung: r, n: i + 1, of: TABLES[r].length, flag: "hold", runs: runs };
  }

  // Kraft und Lauf mischen: kein schwerer Beintag direkt vor Qualitäts-, langem oder Wettkampf-Lauf
  function mix(gym, runs) {
    var slots = [], i;
    for (i = 0; i <= runs.length; i++) slots.push([]);
    var easy = [], hard = [];
    runs.forEach(function (r, j) { (HARD[r.k] ? hard : easy).push(j); });
    var forHeavy = easy.concat([runs.length]);
    var forLight = hard.concat(easy, [runs.length]);
    var nh = 0, nl = 0;
    gym.forEach(function (s, idx) { if (HEAVY[s.type]) slots[forHeavy[nh++ % forHeavy.length]].push(idx); });
    gym.forEach(function (s, idx) { if (!HEAVY[s.type]) slots[forLight[nl++ % forLight.length]].unshift(idx); });
    var out = [];
    for (i = 0; i <= runs.length; i++) {
      slots[i].forEach(function (idx) { out.push({ t: "gym", i: idx }); });
      if (i < runs.length) out.push({ t: "run", j: i });
    }
    return out;
  }

  // Trainings-Tempo (Sekunden pro km, von-bis) aus der 5-km-Zeit
  function paces(answers, results) {
    var runs = (results || []).filter(function (r) { return r.type === "run" && r.sec > 0 && RACE_KM[r.dist]; });
    var t5 = 0, src = null;
    if (runs.length) {
      var l = runs[runs.length - 1];
      t5 = window.Progress.riegel(l.sec, RACE_KM[l.dist], 5); src = "result";
    } else if (Number((answers || {}).zeit_5km) > 0) { t5 = Number(answers.zeit_5km) * 60; src = "answer"; }
    if (!t5) return null;
    var p = t5 / 5, r = function (a, b) { return [p + a, p + b]; };
    return { src: src, time5: t5, easy: r(60, 90), tempo: r(10, 20), interval: r(-10, -5), hyrox: r(20, 40), r5: r(0, 0), r10: r(10, 15), hm: r(25, 30) };
  }

  // Welche Tempo-Zone passt zur Einheit? null = nach Gefühl
  function zone(s, rung) {
    if ((s.sport && s.sport !== "run" && s.k !== "hybrid") || s.k === "runwalk" || s.k === "cont") return null;
    if (s.k === "hybrid") return "hyrox";
    if (s.k === "race") return { "5k": "r5", "10k": "r10", hm: "hm" }[s.dist] || null;
    if (s.k !== "quality") return "easy";
    var id = s.q && s.q[0] ? s.q[0].id : "";
    if (id === "tempo" || id === "km_tempo" || id === "mtempo") return "tempo";
    if (id === "fast" || id === "fast_norest") return "interval";
    if (id === "strides" || id === "strides_n" || id === "surges") return "easy";
    return null;
  }

  window.Run = { build: build, week: week, mix: mix, paces: paces, zone: zone, goalOf: goalOf, TABLES: TABLES, RACE_KM: RACE_KM };
})();
