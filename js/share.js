// Teilen-Karten: zeichnet ein Bild (1080 x 1920, Story-Format) auf ein Canvas. Vier Stile.
(function () {
  var W = 1080, H = 1920;
  var NAVY = "#090E1C", SURF = "#111A31", GOLD = "#E9B949", CYAN = "#35C6E0", TEXT = "#F2F5FC", MUTED = "#8E9BBA", LINE = "#1F2B4D";
  var HEAD = '"Barlow Condensed", "Arial Narrow", Arial, sans-serif', BODY = 'Inter, system-ui, Arial, sans-serif';

  function rr(c, x, y, w, h, r) { c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); }
  function font(c, weight, size, fam) { c.font = weight + " " + size + "px " + fam; }
  // Text in Zeilen umbrechen, so dass jede Zeile in maxW passt
  function wrap(c, text, maxW) {
    var words = text.split(/\s+/), lines = [], cur = "";
    words.forEach(function (w) { var test = cur ? cur + " " + w : w; if (c.measureText(test).width > maxW && cur) { lines.push(cur); cur = w; } else cur = test; });
    if (cur) lines.push(cur);
    return lines;
  }
  // Größte Schrift, bei der der Titel in maxLines Zeilen und maxW passt
  function fitTitle(c, text, maxW, maxLines, start, min) {
    for (var s = start; s >= min; s -= 6) { font(c, "700", s, HEAD); var L = wrap(c, text, maxW); if (L.length <= maxLines && L.every(function (l) { return c.measureText(l).width <= maxW; })) return { size: s, lines: L }; }
    font(c, "700", min, HEAD); return { size: min, lines: wrap(c, text, maxW).slice(0, maxLines) };
  }
  function nf(n, lang, d) { return Number(n).toLocaleString(lang, { maximumFractionDigits: d == null ? 0 : d }); }

  function logo(c, x, y, size, mark, color, label) {
    if (mark) c.drawImage(mark, x, y, size, size);
    font(c, "700", size * 0.8, HEAD); c.fillStyle = color; c.textBaseline = "middle"; c.letterSpacing = "6px";
    c.fillText(label.toUpperCase(), x + size + 18, y + size / 2 + 2); c.letterSpacing = "0px";
  }

  // d: { title, date, vol, sets, ex, prs[], week, weeks, lang, labels{}, brand, exercises[{name,best}], weekStats{done,goal,days[7],streak} }
  function draw(style, d, mark, photo) {
    var cv = document.createElement("canvas"); cv.width = W; cv.height = H;
    var c = cv.getContext("2d"); c.textBaseline = "alphabetic";
    var L = d.labels, lang = d.lang;
    if (style === "stats") {
      var g = c.createRadialGradient(W * 0.85, 0, 0, W * 0.85, 0, H * 0.9); g.addColorStop(0, "#1B2850"); g.addColorStop(0.6, NAVY); g.addColorStop(1, NAVY);
      c.fillStyle = g; c.fillRect(0, 0, W, H);
      logo(c, 90, 110, 76, mark, TEXT, d.brand);
      font(c, "600", 34, BODY); c.fillStyle = MUTED; c.letterSpacing = "5px"; c.fillText(d.date.toUpperCase(), 90, 330); c.letterSpacing = "0px";
      var t1 = fitTitle(c, d.title.toUpperCase(), W - 180, 3, 200, 110); font(c, "700", t1.size, HEAD); c.fillStyle = TEXT;
      t1.lines.forEach(function (l, i) { c.fillText(l, 90, 340 + t1.size * 0.95 * (i + 1)); });
      var y0 = 340 + t1.size * 0.95 * t1.lines.length + 150, tw = (W - 180 - 30) / 2, th = 250;
      (d.stats || [[L.volume, nf(d.vol, lang) , "kg"], [L.sets, nf(d.sets, lang), ""], [L.exercises, nf(d.ex, lang), ""], [L.week, d.week + "/" + d.weeks, ""]]).forEach(function (s, i) {
        var x = 90 + (i % 2) * (tw + 30), y = y0 + Math.floor(i / 2) * (th + 30);
        c.fillStyle = "rgba(255,255,255,0.05)"; rr(c, x, y, tw, th, 36); c.fill(); c.strokeStyle = LINE; c.lineWidth = 2; c.stroke();
        font(c, "500", 32, BODY); c.fillStyle = MUTED; c.fillText(s[0], x + 36, y + 70);
        font(c, "700", 120, HEAD); c.fillStyle = TEXT; c.fillText(s[1], x + 36, y + 190);
        if (s[2]) { var wv = c.measureText(s[1]).width; font(c, "600", 44, HEAD); c.fillStyle = GOLD; c.fillText(s[2], x + 36 + wv + 12, y + 190); }
      });
      if (d.prs.length) {
        var py = y0 + 2 * (th + 30) + 20; c.fillStyle = GOLD; rr(c, 90, py, W - 180, 140, 36); c.fill();
        font(c, "700", 46, HEAD); c.fillStyle = "#1A1300"; c.letterSpacing = "3px"; c.fillText(L.record.toUpperCase(), 130, py + 60); c.letterSpacing = "0px";
        font(c, "600", 42, BODY); c.fillText(d.prs[0], 130, py + 112);
      }
      font(c, "500", 32, BODY); c.fillStyle = MUTED; c.fillText(d.brand.toLowerCase(), 90, H - 100);
    } else if (style === "poster") {
      c.fillStyle = GOLD; c.fillRect(0, 0, W, H);
      logo(c, 90, 110, 76, mark ? invert(mark) : null, "#1A1300", d.brand);
      var t2 = fitTitle(c, (d.title + (L.done ? " " + L.done : "")).toUpperCase(), W - 180, 4, 330, 140); font(c, "700", t2.size, HEAD); c.fillStyle = "#1A1300";
      t2.lines.forEach(function (l, i) { c.fillText(l, 90, 280 + t2.size * 0.86 * (i + 1)); });
      var ly = 280 + t2.size * 0.86 * t2.lines.length + 70; c.fillStyle = "#1A1300"; c.fillRect(90, ly, W - 180, 5);
      d.exercises.slice(0, 5).forEach(function (e, i) {
        var y = ly + 100 + i * 112; font(c, "600", 46, BODY); c.fillStyle = "#1A1300"; c.textAlign = "left"; c.fillText(trunc(c, e.name, W - 180 - 330), 90, y);
        font(c, "700", 58, HEAD); c.textAlign = "right"; c.fillText(e.best, W - 90, y); c.textAlign = "left";
        c.fillStyle = "rgba(26,19,0,0.35)"; c.fillRect(90, y + 32, W - 180, 2);
      });
      font(c, "700", 54, HEAD); c.fillStyle = "#1A1300"; c.letterSpacing = "4px"; c.fillText((d.foot || nf(d.vol, lang) + " KG").toUpperCase(), 90, H - 110); c.textAlign = "right"; c.fillText(d.date.toUpperCase(), W - 90, H - 110); c.textAlign = "left"; c.letterSpacing = "0px";
    } else if (style === "photo") {
      if (photo) { var s = Math.max(W / photo.width, H / photo.height), pw = photo.width * s, ph = photo.height * s; c.drawImage(photo, (W - pw) / 2, (H - ph) / 2, pw, ph); }
      else { var g2 = c.createLinearGradient(0, 0, 0, H); g2.addColorStop(0, "#6c7ea6"); g2.addColorStop(0.5, "#2b3556"); g2.addColorStop(1, "#0c1122"); c.fillStyle = g2; c.fillRect(0, 0, W, H); }
      var sh = c.createLinearGradient(0, H * 0.45, 0, H); sh.addColorStop(0, "rgba(9,14,28,0)"); sh.addColorStop(1, "rgba(9,14,28,0.75)"); c.fillStyle = sh; c.fillRect(0, H * 0.45, W, H * 0.55);
      logo(c, 80, 100, 76, mark, "#FFFFFF", d.brand);
      var gx = 50, gy = H - 520, gw = W - 100, gh = 440;
      c.fillStyle = "rgba(9,14,28,0.62)"; rr(c, gx, gy, gw, gh, 56); c.fill(); c.strokeStyle = "rgba(255,255,255,0.16)"; c.lineWidth = 2; c.stroke();
      var t3 = fitTitle(c, d.title.toUpperCase(), gw - 100, 2, 110, 64); font(c, "700", t3.size, HEAD); c.fillStyle = "#FFFFFF";
      t3.lines.forEach(function (l, i) { c.fillText(l, gx + 50, gy + 40 + t3.size * 0.95 * (i + 1)); });
      var ry = gy + gh - 150, cols = [[L.volume, nf(d.vol, lang), "kg"], [L.sets, nf(d.sets, lang), ""], [d.prs.length ? L.record : L.exercises, d.prs.length ? d.prs[0].split(" ").slice(-2).join(" ") : nf(d.ex, lang), ""]];
      if (d.stats) cols = d.stats.slice(0, 3);
      var cw = (gw - 100) / 3;
      cols.forEach(function (s2, i) { var x = gx + 50 + i * cw; font(c, "500", 30, BODY); c.fillStyle = "#9AA7C7"; c.fillText(s2[0], x, ry); font(c, "700", 76, HEAD); c.fillStyle = "#FFFFFF"; c.fillText(s2[1], x, ry + 84); if (s2[2]) { var w2 = c.measureText(s2[1]).width; font(c, "600", 34, HEAD); c.fillStyle = GOLD; c.fillText(s2[2], x + w2 + 8, ry + 84); } });
    } else { // week
      c.fillStyle = "#F6F3EF"; c.fillRect(0, 0, W, H);
      logo(c, 90, 110, 76, mark ? invert(mark, "#10233F") : null, "#10233F", d.brand);
      var ws = d.weekStats, reached = ws.done >= ws.goal;
      var t4 = fitTitle(c, (reached ? L.weekdone : L.weekprogress).toUpperCase(), W - 180, 3, 200, 100); font(c, "700", t4.size, HEAD); c.fillStyle = "#10141F";
      t4.lines.forEach(function (l, i) { c.fillText(l, 90, 300 + t4.size * 0.95 * (i + 1)); });
      var R = t4.lines.length > 2 ? 200 : 250, cy = 300 + t4.size * 0.95 * t4.lines.length + R + 140;
      c.lineWidth = 46; c.lineCap = "round"; c.strokeStyle = "#E6E0D9"; c.beginPath(); c.arc(W / 2, cy, R, 0, Math.PI * 2); c.stroke();
      var frac = Math.min(1, ws.done / Math.max(1, ws.goal)); c.strokeStyle = "#10233F"; c.beginPath(); c.arc(W / 2, cy, R, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * frac); c.stroke();
      font(c, "700", 210, HEAD); c.fillStyle = "#10141F"; c.textAlign = "center"; c.fillText(ws.done + "/" + ws.goal, W / 2, cy + 40);
      font(c, "600", 36, BODY); c.fillStyle = "#6E6A66"; c.letterSpacing = "5px"; c.fillText(L.sessions.toUpperCase(), W / 2, cy + 150); c.letterSpacing = "0px";
      var dy = cy + R + 110, step = (W - 180) / 7;
      for (var i = 0; i < 7; i++) {
        var x = 90 + step * i + step / 2; font(c, "600", 32, BODY); c.fillStyle = "#6E6A66"; c.fillText(d.dayNames[i], x, dy);
        c.beginPath(); c.arc(x, dy + 70, 42, 0, Math.PI * 2); c.fillStyle = ws.days[i] ? "#10233F" : "#E6E0D9"; c.fill();
        if (ws.days[i]) { c.lineWidth = 8; c.strokeStyle = GOLD; c.beginPath(); c.arc(x, dy + 70, 34, 0, Math.PI * 2); c.stroke(); }
      }
      c.textAlign = "left"; c.fillStyle = "#10233F"; rr(c, 90, H - 330, W - 180, 190, 44); c.fill();
      font(c, "600", 44, BODY); c.fillStyle = "#FFFFFF"; c.fillText(L.streak, 140, H - 215);
      font(c, "700", 110, HEAD); c.fillStyle = GOLD; c.textAlign = "right"; c.fillText(L.weeks.replace("{n}", ws.streak), W - 140, H - 198); c.textAlign = "left";
    }
    return cv;
  }

  function trunc(c, s, maxW) { if (c.measureText(s).width <= maxW) return s; while (s.length > 3 && c.measureText(s + "…").width > maxW) s = s.slice(0, -1); return s + "…"; }
  // Logo-Zeichen in anderer Farbe (aus der gelben Vorlage per Maske)
  function invert(img, color) {
    var cv = document.createElement("canvas"); cv.width = img.width; cv.height = img.height; var c = cv.getContext("2d");
    c.drawImage(img, 0, 0); c.globalCompositeOperation = "source-in"; c.fillStyle = color || "#1A1300"; c.fillRect(0, 0, cv.width, cv.height); return cv;
  }

  function save(file) {
    var a = document.createElement("a"); a.href = URL.createObjectURL(file); a.download = file.name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(function () { URL.revokeObjectURL(a.href); }, 5000);
  }
  // Teilen-Dialog des Handys (Instagram, WhatsApp ...). Geht das nicht, wird das Bild gespeichert.
  async function share(file, title) {
    if (navigator.canShare && navigator.canShare({ files: [file] })) { try { await navigator.share({ files: [file], title: title }); return "shared"; } catch (e) { if (e && e.name === "AbortError") return "cancel"; } }
    save(file); return "saved";
  }

  window.Share = { draw: draw, share: share, save: save, W: W, H: H };
})();
