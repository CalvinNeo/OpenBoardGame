"""Classic Power Grid, Germany. Numerical component data; original SVG layout.

Rules: https://cs.uwaterloo.ca/~dtompkin/archive/dtlib/base/Power%20Grid.pdf
Map cross-reference: github.com/gummyboars/lunboks/blob/master/powerplant/cities.py
"""

RESOURCES = ("coal", "oil", "garbage", "uranium")
TOTAL_RESOURCES = {"coal": 24, "oil": 24, "garbage": 24, "uranium": 12}
INITIAL_MARKET = {"coal": 24, "oil": 18, "garbage": 6, "uranium": 2}
PAYMENTS = (10, 22, 33, 44, 54, 64, 73, 82, 90, 98, 105, 112, 118,
            124, 129, 134, 138, 142, 145, 148, 150)
# regions, removed plants, plant limit, Step 2 threshold, final threshold
PLAYER_RULES = {2: (3, 8, 4, 10, 21), 3: (3, 8, 3, 7, 17),
                4: (4, 4, 3, 7, 17), 5: (5, 0, 3, 7, 15), 6: (5, 0, 3, 6, 14)}
# Each row: coal, oil, garbage, uranium; rows are Steps 1, 2, 3.
REFILL = {2: ((3, 2, 1, 1), (4, 2, 2, 1), (3, 4, 3, 1)),
          3: ((4, 2, 1, 1), (5, 3, 2, 1), (3, 4, 3, 1)),
          4: ((5, 3, 2, 1), (6, 4, 3, 2), (4, 5, 4, 2)),
          5: ((5, 4, 3, 2), (7, 5, 3, 3), (5, 6, 5, 2)),
          6: ((7, 5, 3, 2), (9, 6, 5, 3), (6, 7, 6, 3))}

_PLANT_ROWS = (
    (3, "oil", 2, 1), (4, "coal", 2, 1), (5, "hybrid", 2, 1),
    (6, "garbage", 1, 1), (7, "oil", 3, 2), (8, "coal", 3, 2),
    (9, "oil", 1, 1), (10, "coal", 2, 2), (11, "uranium", 1, 2),
    (12, "hybrid", 2, 2), (13, "green", 0, 1), (14, "garbage", 2, 2),
    (15, "coal", 2, 3), (16, "oil", 2, 3), (17, "uranium", 1, 2),
    (18, "green", 0, 2), (19, "garbage", 2, 3), (20, "coal", 3, 5),
    (21, "hybrid", 2, 4), (22, "green", 0, 2), (23, "uranium", 1, 3),
    (24, "garbage", 2, 4), (25, "coal", 2, 5), (26, "oil", 2, 5),
    (27, "green", 0, 3), (28, "uranium", 1, 4), (29, "hybrid", 1, 4),
    (30, "garbage", 3, 6), (31, "coal", 3, 6), (32, "oil", 3, 6),
    (33, "green", 0, 4), (34, "uranium", 1, 5), (35, "oil", 1, 5),
    (36, "coal", 3, 7), (37, "green", 0, 4), (38, "garbage", 3, 7),
    (39, "uranium", 1, 6), (40, "oil", 2, 6), (42, "coal", 2, 6),
    (44, "green", 0, 5), (46, "hybrid", 3, 7), (50, "green", 0, 6),
)
PLANTS = {n: {"id": n, "resource": fuel, "intake": intake, "output": output}
          for n, fuel, intake, output in _PLANT_ROWS}
REGIONS = ("north", "west", "southwest", "central", "south", "east")
REGION_COLORS = {"north": "#319c9c", "west": "#d36568", "southwest": "#638ab8",
                 "central": "#bd9b3a", "south": "#9073b2", "east": "#a88060"}
# Schematic coordinates intentionally separate neighbouring labels and hit targets.
_CITY_ROWS = (
    ("flensburg", "Flensburg", "north", 370, 45),
    ("kiel", "Kiel", "north", 400, 120),
    ("hamburg", "Hamburg", "north", 370, 210),
    ("hannover", "Hannover", "north", 405, 350),
    ("bremen", "Bremen", "north", 245, 280),
    ("cuxhaven", "Cuxhaven", "north", 220, 165),
    ("wilhelmshaven", "Wilhelmshaven", "north", 95, 220),
    ("osnabruck", "Osnabrück", "west", 210, 375),
    ("munster", "Münster", "west", 165, 465),
    ("essen", "Essen", "west", 165, 550),
    ("duisburg", "Duisburg", "west", 55, 525),
    ("dusseldorf", "Düsseldorf", "west", 125, 635),
    ("dortmund", "Dortmund", "west", 280, 515),
    ("kassel", "Kassel", "west", 420, 475),
    ("aachen", "Aachen", "southwest", 50, 705),
    ("koln", "Köln", "southwest", 215, 675),
    ("trier", "Trier", "southwest", 95, 825),
    ("wiesbaden", "Wiesbaden", "southwest", 270, 780),
    ("saarbrucken", "Saarbrücken", "southwest", 150, 930),
    ("mannheim", "Mannheim", "southwest", 305, 905),
    ("frankfurt-m", "Frankfurt a.M.", "southwest", 360, 705),
    ("stuttgart", "Stuttgart", "south", 330, 1010),
    ("freiburg", "Freiburg", "south", 220, 1115),
    ("konstanz", "Konstanz", "south", 370, 1165),
    ("augsburg", "Augsburg", "south", 515, 1050),
    ("munchen", "München", "south", 655, 1130),
    ("regensburg", "Regensburg", "south", 680, 960),
    ("passau", "Passau", "south", 805, 1030),
    ("nurnberg", "Nürnberg", "central", 575, 860),
    ("wurzburg", "Würzburg", "central", 455, 800),
    ("fulda", "Fulda", "central", 475, 625),
    ("erfurt", "Erfurt", "central", 585, 570),
    ("halle", "Halle", "central", 650, 460),
    ("leipzig", "Leipzig", "central", 730, 560),
    ("dresden", "Dresden", "central", 850, 650),
    ("magdeburg", "Magdeburg", "east", 560, 355),
    ("berlin", "Berlin", "east", 765, 350),
    ("frankfurt-d", "Frankfurt a.O.", "east", 850, 445),
    ("schwerin", "Schwerin", "east", 570, 230),
    ("torgelow", "Torgelow", "east", 810, 200),
    ("rostock", "Rostock", "east", 655, 110),
    ("lubeck", "Lübeck", "east", 525, 135),
)
CITIES = {cid: {"id": cid, "name": name, "region": region, "x": x, "y": y}
          for cid, name, region, x, y in _CITY_ROWS}
EDGES = (
    ("flensburg", "kiel", 4), ("hamburg", "kiel", 8), ("lubeck", "kiel", 4),
    ("hamburg", "lubeck", 6), ("hamburg", "schwerin", 8), ("hamburg", "hannover", 17),
    ("hamburg", "bremen", 11), ("hamburg", "cuxhaven", 11), ("bremen", "cuxhaven", 8),
    ("bremen", "wilhelmshaven", 11), ("bremen", "osnabruck", 11), ("bremen", "hannover", 10),
    ("hannover", "schwerin", 19), ("hannover", "magdeburg", 15), ("hannover", "erfurt", 19),
    ("hannover", "kassel", 15), ("hannover", "osnabruck", 16), ("osnabruck", "wilhelmshaven", 14),
    ("osnabruck", "munster", 7), ("osnabruck", "kassel", 20), ("essen", "munster", 6),
    ("essen", "duisburg", 0), ("essen", "dusseldorf", 2), ("essen", "dortmund", 4),
    ("munster", "dortmund", 2), ("dusseldorf", "koln", 4), ("dusseldorf", "aachen", 9),
    ("kassel", "dortmund", 18), ("kassel", "frankfurt-m", 13), ("kassel", "fulda", 8),
    ("kassel", "erfurt", 15), ("koln", "dortmund", 10), ("koln", "aachen", 7),
    ("koln", "trier", 20), ("koln", "wiesbaden", 21), ("frankfurt-m", "dortmund", 20),
    ("frankfurt-m", "wiesbaden", 0), ("frankfurt-m", "fulda", 8), ("frankfurt-m", "wurzburg", 13),
    ("trier", "aachen", 19), ("trier", "wiesbaden", 18), ("trier", "saarbrucken", 11),
    ("wiesbaden", "saarbrucken", 10), ("wiesbaden", "mannheim", 11), ("mannheim", "saarbrucken", 11),
    ("mannheim", "wurzburg", 10), ("mannheim", "stuttgart", 6), ("stuttgart", "saarbrucken", 17),
    ("stuttgart", "freiburg", 16), ("stuttgart", "konstanz", 16), ("freiburg", "konstanz", 14),
    ("stuttgart", "augsburg", 15), ("stuttgart", "wurzburg", 12), ("augsburg", "konstanz", 17),
    ("augsburg", "munchen", 6), ("augsburg", "regensburg", 13), ("augsburg", "nurnberg", 18),
    ("augsburg", "wurzburg", 19), ("munchen", "passau", 14), ("regensburg", "passau", 12),
    ("regensburg", "munchen", 10), ("regensburg", "nurnberg", 12), ("nurnberg", "wurzburg", 8),
    ("nurnberg", "erfurt", 21), ("wurzburg", "fulda", 11), ("erfurt", "fulda", 13),
    ("erfurt", "halle", 6), ("erfurt", "dresden", 19), ("halle", "leipzig", 0),
    ("halle", "berlin", 17), ("halle", "magdeburg", 11), ("leipzig", "dresden", 13),
    ("frankfurt-d", "leipzig", 21), ("frankfurt-d", "dresden", 16), ("frankfurt-d", "berlin", 6),
    ("berlin", "magdeburg", 10), ("berlin", "schwerin", 18), ("berlin", "torgelow", 15),
    ("torgelow", "rostock", 19), ("schwerin", "magdeburg", 16), ("schwerin", "torgelow", 19),
    ("schwerin", "rostock", 6), ("schwerin", "lubeck", 6),
)
