// Fragebogen-Logik ohne Oberfläche (testbar): sichtbare Fragen, Prüfung, Sicherheits-Check, BMI.
(function () {
  var YN_BAD = ["ja", "keine_antwort"];

  function has(list, v) { return list.indexOf(v) >= 0; }

  function showIf(q, a) {
    if (!q.if) return true;
    return Object.keys(q.if).every(function (k) {
      var v = a[k];
      if (Array.isArray(v)) return v.some(function (x) { return has(q.if[k], x); });
      return v != null && has(q.if[k], v);
    });
  }

  function visible(questions, a) {
    return questions.filter(function (q) { return showIf(q, a); });
  }

  function num(v) { var n = typeof v === "number" ? v : parseFloat(String(v).replace(",", ".")); return isFinite(n) ? n : NaN; }

  // true = Antwort ok. Freiwillige Fragen dürfen leer bleiben.
  function valid(q, v) {
    var empty = v == null || v === "" || (Array.isArray(v) && v.length === 0);
    if (empty) return !q.required;
    if (q.type === "number") { var n = num(v); return n >= q.min && n <= q.max; }
    if (q.type === "multi") return Array.isArray(v) && v.length > 0;
    return true;
  }

  function bmi(a) {
    var w = num(a.gewicht_kg), h = num(a.groesse_cm);
    if (!(w > 0 && h > 0)) return null;
    return w / Math.pow(h / 100, 2);
  }

  // Ergebnis des Sicherheits-Checks nach references/sicherheit.md
  function screening(a) {
    var red = ["s1", "s2", "s3"].some(function (k) { return has(YN_BAD, a[k]); });
    var yellow = ["s4", "s5", "s7"].some(function (k) { return has(YN_BAD, a[k]); });
    var b = bmi(a), age = num(a.alter);
    var nutriOff = has(YN_BAD, a.s6) || has(YN_BAD, a.essstoerung) || (age > 0 && age < 18) || (b != null && b < 18.5);
    return { red: red, yellow: yellow, nutriOff: nutriOff, bmi: b };
  }

  window.Q = { visible: visible, valid: valid, screening: screening, bmi: bmi, num: num };
})();
