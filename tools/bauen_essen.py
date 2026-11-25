"""Baut data/essen.json aus Zutaten (Nährwerte je 100 g) und Rezepten.
Die Nährwerte der Rezepte werden ausgerechnet, nicht von Hand geschrieben.
Alle Zahlen sind Richtwerte (Zutaten roh gewogen, außer Dosen- und Fertigprodukte).
Aufruf: py -V:3.13-64 tools/bauen_essen.py
"""
import json, os, sys

# id: (de, en, es, fr, kcal, protein, carbs, fett, diät, allergene, vorliebe, stück_gramm)
# diät: v = vegan, o = vegetarisch (Ei/Milch), p = pescetarisch (Fisch), m = Fleisch
F = {
 "hafer": ("Haferflocken", "Oats", "Copos de avena", "Flocons d'avoine", 370, 13, 59, 7, "v", ["gluten"], "haferflocken", None),
 "skyr": ("Skyr", "Skyr", "Skyr", "Skyr", 63, 11, 4, 0.2, "o", ["laktose"], "quark_skyr", None),
 "magerquark": ("Magerquark", "Low-fat quark", "Quark desnatado", "Fromage blanc maigre", 67, 12, 4, 0.3, "o", ["laktose"], "quark_skyr", None),
 "joghurt": ("Naturjoghurt", "Plain yoghurt", "Yogur natural", "Yaourt nature", 65, 3.5, 4.5, 3.5, "o", ["laktose"], None, None),
 "milch": ("Milch 1,5 %", "Milk 1.5%", "Leche semidesnatada", "Lait demi-écrémé", 47, 3.4, 4.9, 1.5, "o", ["laktose"], None, None),
 "sojajoghurt": ("Sojajoghurt", "Soy yoghurt", "Yogur de soja", "Yaourt au soja", 50, 4, 3, 2, "v", ["soja"], None, None),
 "sojadrink": ("Sojadrink", "Soy drink", "Bebida de soja", "Boisson au soja", 40, 3.3, 2.5, 1.8, "v", ["soja"], None, None),
 "haferdrink": ("Haferdrink", "Oat drink", "Bebida de avena", "Boisson à l'avoine", 45, 0.8, 7, 1.5, "v", ["gluten"], None, None),
 "ei": ("Ei", "Egg", "Huevo", "Œuf", 143, 12.6, 0.7, 9.5, "o", ["ei"], "ei", 55),
 "vollkornbrot": ("Vollkornbrot (Scheibe)", "Wholegrain bread (slice)", "Pan integral (rebanada)", "Pain complet (tranche)", 215, 8, 38, 2, "v", ["gluten"], "brot", 45),
 "toast": ("Vollkorntoast (Scheibe)", "Wholegrain toast (slice)", "Pan de molde integral (rebanada)", "Pain de mie complet (tranche)", 250, 10, 43, 4, "v", ["gluten"], "brot", 35),
 "wrap": ("Wrap (Weizen)", "Wheat wrap", "Tortilla de trigo", "Wrap de blé", 300, 8, 50, 7, "v", ["gluten"], None, 60),
 "huhn": ("Hähnchenbrust", "Chicken breast", "Pechuga de pollo", "Blanc de poulet", 110, 23, 0, 1.5, "m", [], "huhn", None),
 "pute": ("Putenbrust", "Turkey breast", "Pechuga de pavo", "Blanc de dinde", 105, 24, 0, 1, "m", [], "pute", None),
 "rind": ("Rinderhack (mager)", "Lean ground beef", "Carne picada de ternera magra", "Bœuf haché maigre", 140, 21, 0, 6, "m", [], "rind", None),
 "schwein": ("Schweinefilet", "Pork tenderloin", "Solomillo de cerdo", "Filet de porc", 120, 21, 0, 3.5, "m", [], "schwein", None),
 "lachs": ("Lachs", "Salmon", "Salmón", "Saumon", 208, 20, 0, 13, "p", ["fisch"], "lachs_fisch", None),
 "raeucherlachs": ("Räucherlachs", "Smoked salmon", "Salmón ahumado", "Saumon fumé", 180, 25, 0, 8, "p", ["fisch"], "lachs_fisch", None),
 "weissfisch": ("Weißfisch (z. B. Kabeljau)", "White fish (e.g. cod)", "Pescado blanco (p. ej. bacalao)", "Poisson blanc (p. ex. cabillaud)", 82, 18, 0, 0.7, "p", ["fisch"], "lachs_fisch", None),
 "thunfisch": ("Thunfisch (Dose, im eigenen Saft)", "Tuna (canned, in water)", "Atún (lata, al natural)", "Thon (boîte, au naturel)", 116, 26, 0, 1, "p", ["fisch"], "thunfisch", None),
 "tofu": ("Tofu natur", "Plain tofu", "Tofu natural", "Tofu nature", 120, 13, 2, 7, "v", ["soja"], "tofu_tempeh", None),
 "tempeh": ("Tempeh", "Tempeh", "Tempeh", "Tempeh", 190, 19, 9, 11, "v", ["soja"], "tofu_tempeh", None),
 "edamame": ("Edamame", "Edamame", "Edamame", "Edamame", 120, 11, 9, 5, "v", ["soja"], "tofu_tempeh", None),
 "linsen": ("Rote Linsen (trocken)", "Red lentils (dry)", "Lentejas rojas (secas)", "Lentilles corail (sèches)", 340, 25, 50, 1.5, "v", [], "linsen_bohnen", None),
 "kichererbsen": ("Kichererbsen (Dose)", "Chickpeas (canned)", "Garbanzos (lata)", "Pois chiches (boîte)", 120, 8, 18, 2.5, "v", [], "linsen_bohnen", None),
 "bohnen": ("Schwarze Bohnen (Dose)", "Black beans (canned)", "Alubias negras (lata)", "Haricots noirs (boîte)", 90, 6, 14, 0.5, "v", [], "linsen_bohnen", None),
 "reis": ("Reis (trocken)", "Rice (dry)", "Arroz (seco)", "Riz (sec)", 350, 7, 78, 0.6, "v", [], "reis", None),
 "vollkornreis": ("Vollkornreis (trocken)", "Brown rice (dry)", "Arroz integral (seco)", "Riz complet (sec)", 350, 8, 72, 2.5, "v", [], "reis", None),
 "kartoffeln": ("Kartoffeln", "Potatoes", "Patatas", "Pommes de terre", 77, 2, 17, 0.1, "v", [], "kartoffeln", None),
 "suesskartoffel": ("Süßkartoffel", "Sweet potato", "Boniato", "Patate douce", 86, 1.6, 20, 0.1, "v", [], "suesskartoffeln", None),
 "nudeln": ("Vollkornnudeln (trocken)", "Wholewheat pasta (dry)", "Pasta integral (seca)", "Pâtes complètes (sèches)", 350, 13, 66, 2.5, "v", ["gluten"], "nudeln", None),
 "quinoa": ("Quinoa (trocken)", "Quinoa (dry)", "Quinoa (seca)", "Quinoa (sèche)", 370, 14, 64, 6, "v", [], "quinoa_couscous", None),
 "couscous": ("Couscous (trocken)", "Couscous (dry)", "Cuscús (seco)", "Couscous (sec)", 360, 13, 73, 1.5, "v", ["gluten"], "quinoa_couscous", None),
 "brokkoli": ("Brokkoli", "Broccoli", "Brócoli", "Brocoli", 34, 2.8, 6.6, 0.4, "v", [], "gemuese", None),
 "gemuese": ("Pfannengemüse", "Stir-fry vegetables", "Verduras salteadas", "Légumes sautés", 35, 2, 6, 0.3, "v", [], "gemuese", None),
 "spinat": ("Spinat", "Spinach", "Espinacas", "Épinards", 23, 2.9, 3.6, 0.4, "v", [], "gemuese", None),
 "paprika": ("Paprika", "Bell pepper", "Pimiento", "Poivron", 31, 1, 6, 0.3, "v", [], "gemuese", None),
 "tomate": ("Tomate", "Tomato", "Tomate", "Tomate", 18, 0.9, 3.9, 0.2, "v", [], "gemuese", None),
 "zucchini": ("Zucchini", "Zucchini", "Calabacín", "Courgette", 17, 1.2, 3.1, 0.3, "v", [], "gemuese", None),
 "karotte": ("Karotte", "Carrot", "Zanahoria", "Carotte", 41, 0.9, 10, 0.2, "v", [], "gemuese", None),
 "pilze": ("Champignons", "Mushrooms", "Champiñones", "Champignons", 22, 3.1, 3.3, 0.3, "v", [], "gemuese", None),
 "gurke": ("Gurke", "Cucumber", "Pepino", "Concombre", 15, 0.7, 3.6, 0.1, "v", [], "salat", None),
 "salat": ("Blattsalat", "Mixed salad leaves", "Hojas de ensalada", "Salade verte", 15, 1.3, 2, 0.2, "v", [], "salat", None),
 "avocado": ("Avocado", "Avocado", "Aguacate", "Avocat", 160, 2, 9, 15, "v", [], "avocado", None),
 "banane": ("Banane", "Banana", "Plátano", "Banane", 89, 1.1, 23, 0.3, "v", [], "obst", None),
 "apfel": ("Apfel", "Apple", "Manzana", "Pomme", 52, 0.3, 14, 0.2, "v", [], "obst", None),
 "beeren": ("Beeren", "Berries", "Frutos rojos", "Baies", 45, 0.8, 10, 0.4, "v", [], "beeren", None),
 "dattel": ("Datteln", "Dates", "Dátiles", "Dattes", 280, 2, 75, 0.2, "v", [], None, None),
 "oel": ("Olivenöl", "Olive oil", "Aceite de oliva", "Huile d'olive", 884, 0, 0, 100, "v", [], None, None),
 "nuesse": ("Nussmischung", "Mixed nuts", "Frutos secos variados", "Noix mélangées", 600, 18, 17, 51, "v", ["nuesse"], "nuesse", None),
 "mandelmus": ("Mandelmus", "Almond butter", "Crema de almendras", "Purée d'amande", 614, 21, 19, 56, "v", ["nuesse"], "nuesse", None),
 "erdnussmus": ("Erdnussmus", "Peanut butter", "Crema de cacahuete", "Beurre de cacahuète", 590, 25, 16, 50, "v", ["erdnuss"], None, None),
 "whey": ("Whey-Protein", "Whey protein", "Proteína de suero", "Protéine whey", 380, 80, 7, 5, "o", ["laktose"], None, None),
 "erbsenprotein": ("Erbsenprotein", "Pea protein", "Proteína de guisante", "Protéine de pois", 380, 80, 5, 6, "v", [], None, None),
 "leinsamen": ("Leinsamen", "Flaxseed", "Semillas de lino", "Graines de lin", 530, 18, 3, 42, "v", [], None, None),
 "chia": ("Chiasamen", "Chia seeds", "Semillas de chía", "Graines de chia", 480, 17, 8, 31, "v", [], None, None),
 "honig": ("Honig", "Honey", "Miel", "Miel", 304, 0.3, 82, 0, "o", [], None, None),
 "parmesan": ("Parmesan", "Parmesan", "Parmesano", "Parmesan", 400, 36, 0, 28, "o", ["laktose"], None, None),
 "feta": ("Feta", "Feta", "Queso feta", "Feta", 265, 14, 4, 21, "o", ["laktose"], "kaese", None),
 "gouda": ("Gouda", "Gouda", "Queso gouda", "Gouda", 300, 25, 0, 22, "o", ["laktose"], "kaese", None),
 "hummus": ("Hummus", "Hummus", "Hummus", "Houmous", 230, 8, 14, 17, "v", ["sesam"], None, None),
 "passata": ("Passierte Tomaten", "Passata", "Tomate triturado", "Coulis de tomates", 30, 1.5, 5, 0.2, "v", [], None, None),
 "kokosmilch": ("Kokosmilch (light)", "Coconut milk (light)", "Leche de coco (light)", "Lait de coco (léger)", 80, 0.8, 2, 8, "v", [], None, None),
}

# id, slot, typ, vorbereitung_min, budget, [(zutat, gramm)], titel de/en/es/fr
M = []
def m(id, slot, typ, prep, budget, items, de, en, es, fr):
    M.append((id, slot, typ, prep, budget, items, (de, en, es, fr)))

# ---------------- Frühstück ----------------
m("hafer_skyr_beeren", "fruehstueck", None, 5, "niedrig", [("hafer", 60), ("skyr", 200), ("beeren", 100)], "Haferflocken mit Skyr und Beeren", "Oats with skyr and berries", "Avena con skyr y frutos rojos", "Flocons d'avoine, skyr et baies")
m("ruehrei_toast", "fruehstueck", None, 10, "niedrig", [("ei", 165), ("toast", 70), ("tomate", 100)], "Rührei auf Vollkorntoast mit Tomate", "Scrambled eggs on wholegrain toast with tomato", "Huevos revueltos con tostada integral y tomate", "Œufs brouillés sur toast complet et tomate")
m("overnight_oats_vegan", "fruehstueck", None, 5, "niedrig", [("hafer", 60), ("sojajoghurt", 200), ("banane", 100), ("leinsamen", 10), ("erbsenprotein", 25)], "Overnight Oats mit Banane und Erbsenprotein", "Overnight oats with banana and pea protein", "Overnight oats con plátano y proteína de guisante", "Overnight oats banane et protéine de pois")
m("porridge_whey_apfel", "fruehstueck", None, 8, "niedrig", [("hafer", 60), ("milch", 250), ("whey", 25), ("apfel", 120)], "Porridge mit Milch, Whey und Apfel", "Porridge with milk, whey and apple", "Porridge con leche, proteína y manzana", "Porridge au lait, whey et pomme")
m("quark_nuesse_beeren", "fruehstueck", None, 3, "niedrig", [("magerquark", 250), ("beeren", 100), ("nuesse", 20), ("honig", 10)], "Magerquark mit Beeren und Nüssen", "Low-fat quark with berries and nuts", "Quark desnatado con frutos rojos y frutos secos", "Fromage blanc, baies et noix")
m("avocado_ei_brot", "fruehstueck", None, 8, "mittel", [("vollkornbrot", 90), ("avocado", 80), ("ei", 110), ("tomate", 80)], "Avocadobrot mit Ei", "Avocado toast with egg", "Pan con aguacate y huevo", "Tartine d'avocat et œuf")
m("beeren_protein_bowl", "fruehstueck", "bowls", 5, "mittel", [("banane", 120), ("beeren", 100), ("whey", 30), ("hafer", 40), ("milch", 150)], "Beeren-Protein-Bowl", "Berry protein bowl", "Bowl de frutos rojos y proteína", "Bowl baies et protéines")
m("tofu_ruehrei_gemuese", "fruehstueck", None, 12, "niedrig", [("tofu", 200), ("paprika", 80), ("spinat", 60), ("vollkornbrot", 90), ("oel", 5)], "Tofu-Rührei mit Gemüse und Brot", "Tofu scramble with vegetables and bread", "Revuelto de tofu con verduras y pan", "Brouillade de tofu, légumes et pain")
m("joghurt_muesli", "fruehstueck", None, 4, "niedrig", [("joghurt", 250), ("hafer", 50), ("apfel", 100), ("nuesse", 15), ("honig", 10)], "Joghurt mit Haferflocken, Apfel und Nüssen", "Yoghurt with oats, apple and nuts", "Yogur con avena, manzana y frutos secos", "Yaourt, flocons d'avoine, pomme et noix")
m("protein_pfannkuchen", "fruehstueck", None, 15, "niedrig", [("hafer", 70), ("ei", 110), ("banane", 100), ("magerquark", 100)], "Protein-Pfannkuchen mit Banane", "Protein pancakes with banana", "Tortitas de proteína con plátano", "Pancakes protéinés à la banane")
m("fruehstueckswrap", "fruehstueck", "wraps", 10, "niedrig", [("wrap", 120), ("ei", 165), ("paprika", 80), ("feta", 30)], "Frühstückswrap mit Ei und Gemüse", "Breakfast wrap with egg and vegetables", "Wrap de desayuno con huevo y verduras", "Wrap du petit-déjeuner œuf et légumes")
m("milchreis_apfel_vegan", "fruehstueck", None, 25, "niedrig", [("reis", 60), ("sojadrink", 250), ("apfel", 120), ("mandelmus", 15)], "Milchreis mit Apfel und Mandelmus", "Rice pudding with apple and almond butter", "Arroz con leche con manzana y crema de almendras", "Riz au lait, pomme et purée d'amande")
m("lachs_brot_quark", "fruehstueck", None, 5, "mittel", [("vollkornbrot", 90), ("raeucherlachs", 50), ("magerquark", 80), ("gurke", 80)], "Vollkornbrot mit Räucherlachs, Quark und Gurke", "Wholegrain bread with smoked salmon, quark and cucumber", "Pan integral con salmón ahumado, quark y pepino", "Pain complet, saumon fumé, fromage blanc et concombre")
m("smoothie_banane_erdnuss", "fruehstueck", "smoothies", 5, "niedrig", [("milch", 300), ("banane", 120), ("hafer", 40), ("whey", 30), ("erdnussmus", 15)], "Protein-Smoothie mit Banane und Erdnussmus", "Protein smoothie with banana and peanut butter", "Batido de proteína con plátano y crema de cacahuete", "Smoothie protéiné banane et beurre de cacahuète")
m("chia_pudding_vegan", "fruehstueck", None, 5, "mittel", [("chia", 35), ("sojadrink", 250), ("beeren", 100), ("dattel", 20)], "Chia-Pudding mit Beeren", "Chia pudding with berries", "Pudin de chía con frutos rojos", "Pudding de chia aux baies")
m("skyr_banane_mandel", "fruehstueck", None, 3, "niedrig", [("skyr", 250), ("banane", 100), ("mandelmus", 20), ("hafer", 30)], "Skyr mit Banane, Mandelmus und Hafer", "Skyr with banana, almond butter and oats", "Skyr con plátano, crema de almendras y avena", "Skyr, banane, purée d'amande et avoine")
m("bratkartoffeln_spiegelei", "fruehstueck", None, 20, "niedrig", [("kartoffeln", 250), ("ei", 110), ("spinat", 80), ("oel", 8)], "Bratkartoffeln mit Spiegelei und Spinat", "Pan-fried potatoes with fried egg and spinach", "Patatas salteadas con huevo frito y espinacas", "Pommes de terre sautées, œuf au plat et épinards")
m("hummus_brot_gemuese", "fruehstueck", None, 5, "niedrig", [("vollkornbrot", 135), ("hummus", 60), ("gurke", 80), ("tomate", 80)], "Vollkornbrot mit Hummus, Gurke und Tomate", "Wholegrain bread with hummus, cucumber and tomato", "Pan integral con hummus, pepino y tomate", "Pain complet, houmous, concombre et tomate")
m("protein_oats_vegan", "fruehstueck", None, 6, "mittel", [("hafer", 70), ("haferdrink", 250), ("erbsenprotein", 30), ("beeren", 100), ("leinsamen", 10)], "Protein-Haferbrei mit Beeren", "Protein oatmeal with berries", "Gachas de avena con proteína y frutos rojos", "Porridge protéiné aux baies")

# ---------------- Mittag ----------------
m("huhn_reis_brokkoli", "mittag", "bowls", 25, "niedrig", [("huhn", 150), ("reis", 80), ("brokkoli", 200), ("oel", 8)], "Hähnchen mit Reis und Brokkoli", "Chicken with rice and broccoli", "Pollo con arroz y brócoli", "Poulet, riz et brocoli")
m("pute_nudeln_tomate", "mittag", None, 20, "niedrig", [("pute", 150), ("nudeln", 90), ("passata", 150), ("zucchini", 100), ("parmesan", 10)], "Putenstreifen mit Vollkornnudeln und Tomatensauce", "Turkey strips with wholewheat pasta and tomato sauce", "Tiras de pavo con pasta integral y salsa de tomate", "Lanières de dinde, pâtes complètes et sauce tomate")
m("lachs_kartoffel_gemuese", "mittag", None, 30, "mittel", [("lachs", 150), ("kartoffeln", 300), ("gemuese", 200)], "Lachs mit Kartoffeln und Gemüse", "Salmon with potatoes and vegetables", "Salmón con patatas y verduras", "Saumon, pommes de terre et légumes")
m("thunfisch_quinoa_bowl", "mittag", "bowls", 15, "mittel", [("thunfisch", 120), ("quinoa", 60), ("gurke", 100), ("tomate", 100), ("avocado", 50), ("oel", 8)], "Thunfisch-Quinoa-Bowl", "Tuna quinoa bowl", "Bowl de atún y quinoa", "Bowl thon et quinoa")
m("linsen_curry_vegan", "mittag", None, 25, "niedrig", [("linsen", 90), ("kokosmilch", 100), ("spinat", 100), ("reis", 60)], "Rotes Linsen-Curry mit Reis", "Red lentil curry with rice", "Curry de lentejas rojas con arroz", "Curry de lentilles corail et riz")
m("kichererbsen_bowl_vegan", "mittag", "bowls", 15, "niedrig", [("kichererbsen", 200), ("quinoa", 60), ("paprika", 100), ("gurke", 100), ("hummus", 40), ("oel", 5)], "Kichererbsen-Quinoa-Bowl", "Chickpea quinoa bowl", "Bowl de garbanzos y quinoa", "Bowl pois chiches et quinoa")
m("rind_suesskartoffel_brokkoli", "mittag", None, 25, "mittel", [("rind", 150), ("suesskartoffel", 300), ("brokkoli", 150)], "Rindfleisch mit Süßkartoffel und Brokkoli", "Beef with sweet potato and broccoli", "Ternera con boniato y brócoli", "Bœuf, patate douce et brocoli")
m("tofu_pfanne_reis", "mittag", None, 20, "niedrig", [("tofu", 200), ("vollkornreis", 80), ("gemuese", 250), ("oel", 8)], "Tofu-Gemüse-Pfanne mit Vollkornreis", "Tofu and vegetable stir-fry with brown rice", "Salteado de tofu y verduras con arroz integral", "Poêlée de tofu et légumes, riz complet")
m("wrap_huhn_salat", "mittag", "wraps", 10, "mittel", [("wrap", 120), ("huhn", 130), ("salat", 60), ("tomate", 80), ("joghurt", 60)], "Hähnchen-Wrap mit Salat", "Chicken wrap with salad", "Wrap de pollo con ensalada", "Wrap au poulet et à la salade")
m("nudeln_bolognese", "mittag", None, 25, "niedrig", [("nudeln", 90), ("rind", 120), ("passata", 200), ("karotte", 80)], "Vollkornnudeln mit Hack-Tomaten-Sauce", "Wholewheat pasta with beef and tomato sauce", "Pasta integral con salsa de carne y tomate", "Pâtes complètes, sauce bolognaise")
m("linsensuppe_brot", "mittag", "suppen", 30, "niedrig", [("linsen", 80), ("karotte", 100), ("kartoffeln", 150), ("gemuese", 100), ("vollkornbrot", 45)], "Linsensuppe mit Brot", "Lentil soup with bread", "Sopa de lentejas con pan", "Soupe de lentilles avec du pain")
m("schwein_kartoffel_brokkoli", "mittag", None, 25, "mittel", [("schwein", 150), ("kartoffeln", 300), ("brokkoli", 150)], "Schweinefilet mit Kartoffeln und Brokkoli", "Pork tenderloin with potatoes and broccoli", "Solomillo de cerdo con patatas y brócoli", "Filet de porc, pommes de terre et brocoli")
m("couscous_huhn_feta", "mittag", None, 15, "mittel", [("couscous", 80), ("huhn", 140), ("paprika", 100), ("zucchini", 100), ("feta", 30)], "Couscous mit Hähnchen, Gemüse und Feta", "Couscous with chicken, vegetables and feta", "Cuscús con pollo, verduras y feta", "Couscous, poulet, légumes et feta")
m("gebratener_reis_ei", "mittag", None, 20, "niedrig", [("vollkornreis", 80), ("ei", 165), ("gemuese", 250), ("oel", 8)], "Gebratener Reis mit Ei und Gemüse", "Fried rice with egg and vegetables", "Arroz frito con huevo y verduras", "Riz sauté aux œufs et légumes")
m("bohnen_bowl_vegan", "mittag", "bowls", 20, "niedrig", [("bohnen", 200), ("reis", 70), ("avocado", 60), ("tomate", 100), ("paprika", 80)], "Bohnen-Reis-Bowl mit Avocado", "Bean and rice bowl with avocado", "Bowl de alubias y arroz con aguacate", "Bowl haricots, riz et avocat")
m("fisch_reis_spinat", "mittag", None, 25, "mittel", [("weissfisch", 180), ("reis", 80), ("spinat", 150), ("oel", 8)], "Weißfisch mit Reis und Spinat", "White fish with rice and spinach", "Pescado blanco con arroz y espinacas", "Poisson blanc, riz et épinards")
m("hummus_wrap_vegan", "mittag", "wraps", 10, "niedrig", [("wrap", 120), ("hummus", 60), ("kichererbsen", 100), ("salat", 60), ("tomate", 80)], "Hummus-Wrap mit Kichererbsen", "Hummus wrap with chickpeas", "Wrap de hummus con garbanzos", "Wrap houmous et pois chiches")
m("tempeh_nudeln_brokkoli", "mittag", None, 20, "mittel", [("tempeh", 150), ("nudeln", 90), ("brokkoli", 150), ("oel", 8)], "Tempeh mit Vollkornnudeln und Brokkoli", "Tempeh with wholewheat pasta and broccoli", "Tempeh con pasta integral y brócoli", "Tempeh, pâtes complètes et brocoli")
m("pute_suesskartoffel_ofen", "mittag", None, 30, "mittel", [("pute", 150), ("suesskartoffel", 250), ("gemuese", 200), ("oel", 8)], "Putenbrust mit Ofen-Süßkartoffel und Gemüse", "Turkey with baked sweet potato and vegetables", "Pavo con boniato al horno y verduras", "Dinde, patate douce au four et légumes")
m("huhn_eintopf", "mittag", "suppen", 35, "niedrig", [("huhn", 130), ("kartoffeln", 200), ("karotte", 100), ("gemuese", 150)], "Hähnchen-Gemüse-Eintopf", "Chicken and vegetable stew", "Guiso de pollo y verduras", "Ragoût de poulet et légumes")

# ---------------- Abend ----------------
m("lachs_quinoa_spinat", "abend", None, 20, "mittel", [("lachs", 140), ("quinoa", 60), ("spinat", 150)], "Lachs mit Quinoa und Spinat", "Salmon with quinoa and spinach", "Salmón con quinoa y espinacas", "Saumon, quinoa et épinards")
m("huhn_ofengemuese", "abend", None, 35, "niedrig", [("huhn", 160), ("kartoffeln", 250), ("gemuese", 250), ("oel", 8)], "Ofen-Hähnchen mit Kartoffeln und Gemüse", "Oven chicken with potatoes and vegetables", "Pollo al horno con patatas y verduras", "Poulet au four, pommes de terre et légumes")
m("omelett_gemuese_brot", "abend", None, 15, "niedrig", [("ei", 220), ("gemuese", 150), ("vollkornbrot", 90), ("feta", 30)], "Gemüse-Omelett mit Feta und Brot", "Vegetable omelette with feta and bread", "Tortilla de verduras con feta y pan", "Omelette aux légumes, feta et pain")
m("tofu_curry_reis", "abend", None, 25, "niedrig", [("tofu", 180), ("kokosmilch", 100), ("gemuese", 200), ("reis", 70)], "Tofu-Gemüse-Curry mit Reis", "Tofu and vegetable curry with rice", "Curry de tofu y verduras con arroz", "Curry de tofu et légumes, riz")
m("thunfisch_pasta", "abend", None, 20, "niedrig", [("nudeln", 90), ("thunfisch", 100), ("passata", 150), ("zucchini", 100)], "Thunfisch-Pasta mit Zucchini", "Tuna pasta with zucchini", "Pasta con atún y calabacín", "Pâtes au thon et courgettes")
m("rind_wok_reis", "abend", None, 20, "mittel", [("rind", 140), ("reis", 70), ("gemuese", 250), ("oel", 8)], "Rinder-Wok mit Gemüse und Reis", "Beef stir-fry with vegetables and rice", "Salteado de ternera con verduras y arroz", "Wok de bœuf, légumes et riz")
m("linsen_bolognese_vegan", "abend", None, 30, "niedrig", [("nudeln", 90), ("linsen", 60), ("passata", 200), ("karotte", 80), ("pilze", 80)], "Linsen-Bolognese mit Vollkornnudeln", "Lentil bolognese with wholewheat pasta", "Boloñesa de lentejas con pasta integral", "Bolognaise de lentilles et pâtes complètes")
m("paprika_hack_reis", "abend", None, 40, "niedrig", [("paprika", 250), ("rind", 120), ("reis", 50), ("passata", 80)], "Gefüllte Paprika mit Hack und Reis", "Stuffed peppers with beef and rice", "Pimientos rellenos de carne y arroz", "Poivrons farcis au bœuf et riz")
m("pute_salat_bowl", "abend", "bowls", 15, "mittel", [("pute", 140), ("salat", 80), ("quinoa", 50), ("avocado", 50), ("tomate", 100), ("gurke", 80), ("oel", 8)], "Puten-Salat-Bowl mit Quinoa", "Turkey salad bowl with quinoa", "Bowl de ensalada con pavo y quinoa", "Bowl salade, dinde et quinoa")
m("weissfisch_kartoffel_brokkoli", "abend", None, 25, "mittel", [("weissfisch", 180), ("kartoffeln", 300), ("brokkoli", 200), ("oel", 8)], "Weißfisch mit Kartoffeln und Brokkoli", "White fish with potatoes and broccoli", "Pescado blanco con patatas y brócoli", "Poisson blanc, pommes de terre et brocoli")
m("bohnen_chili_vegan", "abend", "suppen", 30, "niedrig", [("bohnen", 200), ("passata", 200), ("paprika", 100), ("reis", 60)], "Bohnen-Chili mit Reis", "Bean chili with rice", "Chili de alubias con arroz", "Chili de haricots avec du riz")
m("shakshuka_brot", "abend", None, 25, "niedrig", [("ei", 165), ("passata", 250), ("paprika", 100), ("vollkornbrot", 90), ("feta", 30)], "Shakshuka mit Brot", "Shakshuka with bread", "Shakshuka con pan", "Shakshuka avec du pain")
m("tempeh_ofen_gemuese", "abend", None, 35, "mittel", [("tempeh", 150), ("suesskartoffel", 250), ("brokkoli", 150), ("oel", 5)], "Tempeh mit Ofen-Süßkartoffel und Brokkoli", "Tempeh with baked sweet potato and broccoli", "Tempeh con boniato al horno y brócoli", "Tempeh, patate douce au four et brocoli")
m("huhn_gemuesesuppe", "abend", "suppen", 30, "niedrig", [("huhn", 150), ("gemuese", 250), ("nudeln", 50), ("karotte", 100)], "Hähnchen-Gemüse-Suppe mit Nudeln", "Chicken vegetable soup with noodles", "Sopa de pollo y verduras con fideos", "Soupe de poulet, légumes et nouilles")
m("kichererbsen_curry_vegan", "abend", None, 25, "niedrig", [("kichererbsen", 200), ("kokosmilch", 100), ("spinat", 120), ("reis", 70)], "Kichererbsen-Spinat-Curry mit Reis", "Chickpea and spinach curry with rice", "Curry de garbanzos y espinacas con arroz", "Curry de pois chiches et épinards, riz")
m("schwein_pfanne_reis", "abend", None, 25, "mittel", [("schwein", 150), ("vollkornreis", 70), ("paprika", 150), ("zucchini", 100), ("oel", 8)], "Schweinefilet-Pfanne mit Paprika und Reis", "Pork tenderloin stir-fry with peppers and rice", "Salteado de solomillo con pimientos y arroz", "Poêlée de filet de porc, poivrons et riz")
m("lachs_salat_kartoffel", "abend", None, 30, "mittel", [("lachs", 130), ("kartoffeln", 250), ("salat", 80), ("gurke", 80), ("joghurt", 50)], "Lachs mit Kartoffeln und Salat", "Salmon with potatoes and salad", "Salmón con patatas y ensalada", "Saumon, pommes de terre et salade")
m("pellkartoffeln_quark", "abend", None, 30, "niedrig", [("kartoffeln", 350), ("magerquark", 200), ("ei", 55), ("gurke", 80)], "Pellkartoffeln mit Kräuterquark und Ei", "Jacket potatoes with herb quark and egg", "Patatas cocidas con quark de hierbas y huevo", "Pommes de terre en robe des champs, fromage blanc aux herbes et œuf")
m("tofu_edamame_bowl", "abend", "bowls", 20, "mittel", [("tofu", 150), ("edamame", 80), ("vollkornreis", 60), ("karotte", 80), ("gurke", 80)], "Tofu-Edamame-Bowl mit Reis", "Tofu edamame bowl with rice", "Bowl de tofu y edamame con arroz", "Bowl tofu, edamame et riz")
m("puten_geschnetzeltes", "abend", None, 25, "mittel", [("pute", 150), ("reis", 70), ("pilze", 150), ("oel", 8)], "Putengeschnetzeltes mit Pilzen und Reis", "Turkey strips with mushrooms and rice", "Pavo salteado con champiñones y arroz", "Émincé de dinde aux champignons et riz")

# ---------------- Snacks ----------------
m("snack_skyr_beeren", "snack", None, 2, "niedrig", [("skyr", 200), ("beeren", 80)], "Skyr mit Beeren", "Skyr with berries", "Skyr con frutos rojos", "Skyr aux baies")
m("snack_quark_apfel", "snack", None, 2, "niedrig", [("magerquark", 150), ("apfel", 100)], "Magerquark mit Apfel", "Low-fat quark with apple", "Quark desnatado con manzana", "Fromage blanc à la pomme")
m("snack_nuesse_obst", "snack", None, 1, "niedrig", [("nuesse", 30), ("apfel", 120)], "Nüsse und ein Apfel", "Nuts and an apple", "Frutos secos y una manzana", "Noix et une pomme")
m("snack_whey_shake", "snack", "smoothies", 3, "niedrig", [("whey", 30), ("milch", 250), ("banane", 100)], "Protein-Shake mit Banane", "Protein shake with banana", "Batido de proteína con plátano", "Shake protéiné à la banane")
m("snack_hummus_gemuese", "snack", None, 5, "niedrig", [("hummus", 60), ("karotte", 100), ("gurke", 80)], "Hummus mit Gemüsesticks", "Hummus with vegetable sticks", "Hummus con palitos de verdura", "Houmous et bâtonnets de légumes")
m("snack_erdnuss_brot", "snack", None, 3, "niedrig", [("vollkornbrot", 45), ("erdnussmus", 20), ("banane", 60)], "Vollkornbrot mit Erdnussmus und Banane", "Wholegrain bread with peanut butter and banana", "Pan integral con crema de cacahuete y plátano", "Pain complet, beurre de cacahuète et banane")
m("snack_edamame", "snack", None, 5, "mittel", [("edamame", 120)], "Edamame mit Salz", "Salted edamame", "Edamame con sal", "Edamame salés")
m("snack_eier_tomate", "snack", None, 12, "niedrig", [("ei", 110), ("tomate", 80)], "Gekochte Eier mit Tomate", "Boiled eggs with tomato", "Huevos cocidos con tomate", "Œufs durs à la tomate")
m("snack_joghurt_beeren", "snack", None, 2, "niedrig", [("joghurt", 200), ("beeren", 80), ("nuesse", 15)], "Joghurt mit Beeren und Nüssen", "Yoghurt with berries and nuts", "Yogur con frutos rojos y frutos secos", "Yaourt, baies et noix")
m("snack_vegan_shake", "snack", "smoothies", 3, "mittel", [("erbsenprotein", 30), ("sojadrink", 250), ("banane", 100)], "Veganer Protein-Shake mit Banane", "Vegan protein shake with banana", "Batido de proteína vegano con plátano", "Shake protéiné végan à la banane")
m("snack_thunfisch_brot", "snack", None, 4, "niedrig", [("thunfisch", 80), ("vollkornbrot", 45), ("gurke", 60)], "Thunfisch auf Vollkornbrot", "Tuna on wholegrain bread", "Atún sobre pan integral", "Thon sur pain complet")
m("snack_datteln_mandeln", "snack", None, 1, "niedrig", [("dattel", 40), ("mandelmus", 20)], "Datteln mit Mandelmus", "Dates with almond butter", "Dátiles con crema de almendras", "Dattes à la purée d'amande")
m("snack_kaese_brot", "snack", None, 3, "niedrig", [("gouda", 30), ("vollkornbrot", 45), ("gurke", 80)], "Käsebrot mit Gurke", "Cheese sandwich with cucumber", "Pan con queso y pepino", "Tartine au fromage et concombre")
m("snack_gruener_smoothie", "snack", "smoothies", 5, "mittel", [("banane", 120), ("spinat", 40), ("beeren", 80), ("sojadrink", 200), ("erbsenprotein", 20)], "Grüner Beeren-Smoothie", "Green berry smoothie", "Batido verde de frutos rojos", "Smoothie vert aux baies")

RANK = {"v": 0, "o": 1, "p": 2, "m": 3}
DIETS = {"v": ["omnivor", "vegetarisch", "pescetarisch", "vegan"], "o": ["omnivor", "vegetarisch", "pescetarisch"], "p": ["omnivor", "pescetarisch"], "m": ["omnivor"]}

def build():
    foods = {}
    for k, v in F.items():
        foods[k] = {"n": {"de": v[0], "en": v[1], "es": v[2], "fr": v[3]}, "k": v[4], "p": v[5], "c": v[6], "f": v[7], "d": v[8], "a": v[9], "l": v[10], "s": v[11]}
    meals = []
    for (id, slot, typ, prep, budget, items, titles) in M:
        kcal = prot = carb = fat = 0.0
        worst, allerg, likes = "v", set(), []
        for (fid, g) in items:
            f = foods[fid]
            kcal += f["k"] * g / 100; prot += f["p"] * g / 100; carb += f["c"] * g / 100; fat += f["f"] * g / 100
            if RANK[f["d"]] > RANK[worst]: worst = f["d"]
            allerg.update(f["a"])
            if f["l"] and f["l"] not in likes: likes.append(f["l"])
        if typ and typ not in likes: likes.append(typ)
        meals.append({"id": id, "slot": slot, "typ": typ, "prep": prep, "budget": budget,
                      "items": [[a, b] for a, b in items], "t": {"de": titles[0], "en": titles[1], "es": titles[2], "fr": titles[3]},
                      "ernaehrung": DIETS[worst], "allergene": sorted(allerg), "likes": likes,
                      "kcal": round(kcal), "p": round(prot), "c": round(carb), "f": round(fat)})
    return {"version": 1, "hinweis": "Zutaten roh gewogen (außer Dosen). Nährwerte sind Richtwerte, aus Zutaten berechnet.", "foods": foods, "meals": meals}

if __name__ == "__main__":
    out = build()
    ids = [x["id"] for x in out["meals"]]
    assert len(ids) == len(set(ids)), "doppelte IDs"
    for x in out["meals"]:
        for fid, _ in x["items"]:
            assert fid in out["foods"], fid
    root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    with open(os.path.join(root, "data", "essen.json"), "w", encoding="utf-8", newline="\n") as fh:
        json.dump(out, fh, ensure_ascii=False, separators=(",", ":"))
    by = {}
    for x in out["meals"]: by[x["slot"]] = by.get(x["slot"], 0) + 1
    print(len(out["meals"]), "Rezepte", by)
