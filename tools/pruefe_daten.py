"""Prüft die Daten im Ordner data/ auf Fehler und Lücken.
Aufruf:  py -V:3.13-64 tools/pruefe_daten.py            (aus dem Projektordner)
Ausgabe: FEHLER (müssen weg) und HINWEISE (Lücken, für die die App einen Ersatz braucht).
"""
import json, itertools, sys
from pathlib import Path

D = Path(__file__).resolve().parent.parent / "data"
fehler, hinweise = [], []
ex = json.load(open(D / "exercises.json", encoding="utf-8"))["uebungen"]
meals = json.load(open(D / "meals.json", encoding="utf-8"))["mahlzeiten"]
hy = json.load(open(D / "hyrox.json", encoding="utf-8"))
qs = json.load(open(D / "fragebogen.json", encoding="utf-8"))["fragen"]

# ---- Übungen
ids = {e["id"] for e in ex}
for e in ex:
    if len(e["cues"]) != 3: fehler.append(f"Übung {e['id']}: genau 3 Cues nötig")
    if not e["equipment"]: fehler.append(f"Übung {e['id']}: kein Equipment")
SLOTS = ["kniebeuge","hinge","ausfall","push_h","push_schraeg","push_v","pull_h","pull_v","schulter_seitlich",
         "schulter_hinten","trizeps","bizeps","beinbeuger","beinstrecker","waden","rumpf","griff"]
EQ_SETS = {
 "gym_voll": {"koerper","kurzhantel","langhantel","maschine","kabel","kettlebell","band","rack","bank","cardio-geraet","sled","wallball"},
 "kurzhanteln_zuhause": {"koerper","kurzhantel","bank","band"},
 "nur_koerper": {"koerper"},
 "kettlebell": {"koerper","kettlebell"},
}
for name, eq in EQ_SETS.items():
    for s in SLOTS:
        cand = [e for e in ex if e["kategorie"] == s and set(e["equipment"]) & eq]
        if not cand:
            hinweise.append(f"Equipment '{name}': Slot '{s}' hat keine Übung. Generator muss den Slot auslassen oder ersetzen.")
# Verletzungsfilter: bleibt pro Slot mindestens eine Übung?
for inj in ["knie","schulter","ruecken","handgelenk","ellbogen"]:
    for s in SLOTS:
        cand = [e for e in ex if e["kategorie"] == s and not any(m == inj or m.startswith(inj + "_") for m in e["meiden_bei"])]
        if not cand:
            hinweise.append(f"Verletzung '{inj}': Slot '{s}' hat keine erlaubte Übung.")

# ---- Hyrox
for st in hy["stationen"]:
    if st["uebung_id"] not in ids: fehler.append(f"Hyrox-Station {st['name']}: Übung {st['uebung_id']} fehlt in exercises.json")
if len(hy["stationen"]) != 8: fehler.append("Hyrox braucht 8 Stationen")

# ---- Mahlzeiten
for m in meals:
    kc = 4 * m["protein_g"] + 4 * m["kohlenhydrate_g"] + 9 * m["fett_g"]
    if abs(kc - m["kcal"]) > 0.08 * kc: fehler.append(f"Mahlzeit {m['id']}: kcal {m['kcal']} passt nicht zu Makros ({kc:.0f})")
FORMEN = ["omnivor","vegetarisch","pescetarisch","vegan"]
ALL = ["gluten","laktose","nuesse","erdnuss","ei","soja","fisch","sesam"]
SL = ["fruehstueck","mittag","abend","snack"]
for f in FORMEN:
    for s in SL:
        n = [m for m in meals if m["slot"] == s and f in m["ernaehrung"]]
        if len(n) < 3: hinweise.append(f"Form '{f}', Slot '{s}': nur {len(n)} Vorlagen ohne Allergiefilter")
# jede Einzel-Allergie und Paare
for f in FORMEN:
    for k in (1, 2):
        for combo in itertools.combinations(ALL, k):
            for s in SL:
                n = [m for m in meals if m["slot"] == s and f in m["ernaehrung"] and not (set(m["allergene"]) & set(combo))]
                if len(n) < 2:
                    hinweise.append(f"Form '{f}' + {'/'.join(combo)} ausgeschlossen: Slot '{s}' hat {len(n)} Vorlage(n)")

# ---- Fragebogen
qid = {q["id"]: q for q in qs}
for q in qs:
    for k, vals in (q.get("bedingung") or {}).items():
        if k not in qid: fehler.append(f"Frage {q['id']}: Bedingung auf unbekannte Frage {k}")
        else:
            for v in vals:
                if v not in qid[k].get("optionen", []): fehler.append(f"Frage {q['id']}: Bedingung nennt Option {v}, die {k} nicht hat")
    if q["typ"] in ("auswahl", "mehrfach", "ja_nein") and not q.get("optionen"): fehler.append(f"Frage {q['id']}: Optionen fehlen")

print(f"{len(ex)} Übungen, {len(meals)} Mahlzeiten, {len(hy['stationen'])} Hyrox-Stationen, {len(qs)} Fragen")
print(f"\nFEHLER: {len(fehler)}")
for x in fehler: print("  -", x)
print(f"\nHINWEISE: {len(hinweise)}")
for x in hinweise[:60]: print("  -", x)
if len(hinweise) > 60: print(f"  ... und {len(hinweise) - 60} weitere")
sys.exit(1 if fehler else 0)
