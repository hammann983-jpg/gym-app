// Hyrox- und Triathlon-Einheiten (reine Funktionen). Quellen: fitness-trainer/references/hyrox.md,
// triathlon-coach/references/plaene.md. Gleiche Wochenstruktur wie js/run.js.
(function () {
  function copy(o) { return JSON.parse(JSON.stringify(o)); }
  function round5(n) { return Math.max(15, Math.round(n / 5) * 5); }

  // ---------- Hyrox ----------
  // Gewichte: Sekundärquellen, noch nicht gegen das offizielle Regelwerk geprüft (Hinweis in der App)
  var W = { open_frauen: 0, open_maenner: 1, pro_frauen: 2, pro_maenner: 3 };
  var STATIONS = [
    { name: "SkiErg", size: "1000 m" },
    { name: "Sled Push", size: "50 m", kg: [102, 152, 152, 202] },
    { name: "Sled Pull", size: "50 m", kg: [78, 103, 103, 153] },
    { name: "Burpee Broad Jumps", size: "80 m" },
    { name: "Rowing", size: "1000 m" },
    { name: "Farmers Carry", size: "200 m", kg: [16, 24, 24, 32], two: true },
    { name: "Sandbag Lunges", size: "100 m", kg: [10, 20, 20, 30] },
    { name: "Wall Balls", size: "100 ×", kg: [4, 6, 6, 9] }
  ];
  function station(i, division) {
    var s = STATIONS[i], d = W[division], kg = s.kg && d !== undefined ? (s.two ? "2 × " : "") + s.kg[d] + " kg" : "";
    return s.name + " " + s.size + (kg ? " (" + kg + ")" : "");
  }

  // Anteile: 40 % Aufbau, 30 % Kraft-Ausdauer, Rest spezifisch, letzte Woche Taper
  function hyroxPhase(n, total) {
    if (n === total) return "taper";
    if (n % 4 === 0) return "deload";
    var f = (n - 1) / total;
    return f < 0.4 ? "base" : f < 0.7 ? "endurance" : "specific";
  }
  // count: Zahl der Ausdauer-Einheiten pro Woche (2 = locker + Hybrid, 3 = zusätzlich Intervall/Tempo)
  function hyrox(a, total, count) {
    var weeks = [], div = a.hyrox_division;
    for (var n = 1; n <= total; n++) {
      var ph = hyroxPhase(n, total), light = ph === "deload" || ph === "taper";
      var easy = { k: "easy", sport: "run", size: light ? "15–25" : "30–50" };
      // jede 4. Woche vor der Entlastung: Rennsimulation (nicht in der Aufbauphase)
      var sim = n % 4 === 3 && ph !== "base" && ph !== "taper";
      var from = (n % 2 === 1) ? 0 : 4, reps = light ? 2 : 4, st = [];
      for (var i = 0; i < (sim && ph === "specific" ? 8 : reps); i++) st.push(station(sim && ph === "specific" ? i : from + i, div));
      var hy = { k: sim ? "sim" : "hybrid", sport: "hyrox", q: [] };
      hy.q.push(sim ? { id: ph === "specific" ? "sim_full" : "sim_half" } : { id: "hybrid", n: st.length });
      if (ph === "endurance" && !sim) hy.q.push({ id: "hx_weight" });
      if (ph === "specific") hy.q.push({ id: "hx_race" });
      hy.stations = st;
      var runs = [easy, hy];
      if (count >= 3 && !light) runs.splice(1, 0, { k: "quality", sport: "run", q: [{ id: n % 2 === 1 ? "hx_interval" : "hx_tempo" }] });
      if (n === total) runs = [easy, hy, { k: "hyroxrace", sport: "hyrox" }];
      weeks.push({ rung: "hyrox", n: n, of: total, flag: ph, runs: runs });
    }
    var hold = copy(weeks[0]); hold.flag = "hold";
    return { goal: "hyrox", weeks: weeks, hold: hold };
  }

  // ---------- Triathlon ----------
  // Beispielwochen der Aufbauphase, Minuten
  function S(min, q) { return { k: "swim", sport: "swim", min: min, q: [{ id: q }] }; }
  function B(min, q) { return { k: q ? "bikehard" : "bike", sport: "bike", min: min, q: q ? [{ id: q }] : [] }; }
  function Rn(k, min, q) { return { k: k, sport: "run", min: min, q: q ? [{ id: q }] : [] }; }
  function Br(bike, run, q) { return { k: "brick", sport: "bike", min: bike + run, bike: bike, run: run, q: q ? [{ id: q }] : [] }; }
  var WEEKS = {
    sprint: [S(45, "swim_css"), B(60, "bike_tempo"), Rn("easy", 40, "strides4"), S(45, "swim_endu"), Br(90, 20), Rn("long", 50)],
    olympisch: [S(60, "swim_200"), B(75, "bike_threshold"), Rn("quality", 50, "run_tempo20"), S(50, "swim_endu"), Br(120, 25, "bike_race"), Rn("long", 60)],
    halb: [S(60, "swim_css"), B(75, "bike_sweet"), Rn("easy", 30), Rn("quality", 60, "run_quality"), S(60, "swim_endu"), B(60), Br(180, 30, "bike_race3"), Rn("long", 90)],
    voll: [S(60, "swim_css"), B(90, "bike_intervals"), Rn("easy", 45), S(60, "swim_endu"), Rn("quality", 75, "run_quality"), B(90), Br(270, 30, "bike_fuel"), Rn("long", 120)]
  };
  var TAPER = { sprint: [0.6], olympisch: [0.6], halb: [0.8, 0.6], voll: [0.8, 0.6, 0.4] };

  function triathlon(a, total) {
    var d = WEEKS[a.tri_distanz] ? a.tri_distanz : "olympisch", tp = TAPER[d].slice(-Math.max(1, Math.min(TAPER[d].length, total - 1)));
    var main = total - tp.length, base = Math.round(main * 0.35), peak = Math.max(1, Math.round(main * 0.2)), weeks = [];
    for (var n = 1; n <= total; n++) {
      var ph = n > main ? "taper" : n % 4 === 0 ? "deload" : n <= base ? "base" : n > main - peak ? "specific" : "build";
      // Umfang: in der Basis von 70 % ansteigend, Entlastung -30 %, Taper nach Distanz
      var f = ph === "taper" ? tp[n - main - 1] : n <= base ? 0.7 + 0.25 * (n - 1) / base : 1;
      if (ph === "deload") f *= 0.7;
      var calm = ph === "base" || ph === "deload";
      var runs = copy(WEEKS[d]).map(function (s) {
        if (s.k === "brick" && (calm || ph === "taper")) s = B(s.bike);
        if (calm && s.k !== "swim") { if (s.k === "quality" || s.k === "bikehard") s.k = s.sport === "bike" ? "bike" : "easy"; s.q = []; }
        if (s.k === "brick") { s.bike = round5(s.bike * f); s.run = round5(s.run * f); s.min = s.bike + s.run; }
        else s.min = round5(s.min * f);
        return s;
      });
      if (n === total) runs.push({ k: "trirace", sport: "tri", dist: d });
      weeks.push({ rung: "tri", n: n, of: total, flag: ph, runs: runs, dist: d });
    }
    var hi = Math.min(weeks.length - 1, 3), hold = copy(weeks[hi]); hold.flag = "hold"; hold.runs = hold.runs.filter(function (s) { return s.k !== "trirace"; });
    return { goal: "triathlon", weeks: weeks, hold: hold };
  }

  window.Multi = { hyrox: hyrox, triathlon: triathlon, station: station, WEEKS: WEEKS };
})();
