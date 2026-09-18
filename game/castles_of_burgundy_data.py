"""2011 base game data. Coordinates are axial, for the standard estate #1."""

KINDS = ("castle", "ship", "mine", "knowledge", "building", "animal")
BUILDINGS = {
    "warehouse": ("Warehouse", "🏚️", "Sell one goods type without a die."),
    "workshop": ("Workshop", "🪚", "Take one building from any numbered depot."),
    "church": ("Church", "⛪", "Take one castle, mine or knowledge tile from a numbered depot."),
    "market": ("Market", "🏪", "Take one ship or animal tile from a numbered depot."),
    "boarding_house": ("Boarding House", "🏡", "Gain 4 workers."),
    "bank": ("Bank", "🏦", "Gain 2 silverlings."),
    "city_hall": ("City Hall", "🏛️", "Place another stored tile, ignoring the die number."),
    "watchtower": ("Watchtower", "🗼", "Score 4 victory points."),
}
KNOWLEDGE_BUILDINGS = {
    16: "warehouse", 17: "watchtower", 18: "workshop", 19: "church",
    20: "market", 21: "boarding_house", 22: "bank", 23: "city_hall",
}
KNOWLEDGE = {
    1: "Identical buildings may share a city.",
    2: "Each mine also produces 1 worker at each phase end.",
    3: "Selling goods earns 2 silverlings instead of 1 per sale.",
    4: "Every goods sale also earns 1 worker.",
    5: "Ships may collect goods from two adjacent depots (1 and 6 are adjacent).",
    6: "Your once-per-turn purchase may use any depot, still costing 2 silverlings.",
    7: "Each animal tile scored earns 1 extra VP, including rescored tiles.",
    8: "Each worker adjusts a die by up to 2 steps instead of 1.",
    9: "Placing a building has a free die adjustment of up to 1 step.",
    10: "Placing a ship or animal has a free die adjustment of up to 1 step.",
    11: "Placing a castle, mine or knowledge tile has a free adjustment of up to 1 step.",
    12: "Taking a tile from a numbered depot has a free adjustment of up to 1 step.",
    13: "The take-workers action also earns 1 silverling (not boarding houses).",
    14: "The take-workers action earns 4 workers instead of 2.",
    15: "At game end: 3 VP per different type of goods sold.",
    24: "At game end: 4 VP per different animal type on your estate.",
    25: "At game end: 1 VP per goods tile sold.",
    26: "At game end: 2 VP per colour bonus tile claimed.",
}
KNOWLEDGE.update({number: f"At game end: 4 VP per {BUILDINGS[kind][0]} on your estate."
                  for number, kind in KNOWLEDGE_BUILDINGS.items()})
BLACK_KNOWLEDGE = {7, 12, 14, 15, 24, 25}
ANIMALS = {"cow": "🐄", "sheep": "🐑", "pig": "🐖", "chicken": "🐔"}
KIND_META = {
    "castle": ("Castle", "🏰", "Take an immediate extra action with any die value."),
    "ship": ("Ship", "⛵", "Advance in turn order and collect goods from a depot."),
    "mine": ("Mine", "⛏️", "Gain 1 silverling at each phase end."),
    "knowledge": ("Knowledge", "📜", "Gain a permanent ability or an end-game scoring condition."),
    "building": ("Building", "🏘️", "Resolve its immediate building effect; no duplicates in a city."),
    "animal": ("Pasture", "🐑", "Score the animals on this tile and matching animals in this pasture."),
}
# Reading rows left to right, top to bottom, from rulebook page 3.
ESTATE_ROWS = (
    ("a6", "c5", "c4", "k3"),
    ("a2", "a1", "c6", "k5", "b4"),
    ("a5", "a4", "b3", "k1", "b2", "b3"),
    ("s6", "s1", "s2", "c6", "s5", "s4", "s1"),
    ("b2", "b5", "m4", "b3", "b1", "a2"),
    ("b6", "m1", "k2", "b5", "b6"),
    ("m3", "k4", "k1", "b3"),
)
SHORT_KIND = {"c": "castle", "s": "ship", "m": "mine", "k": "knowledge", "b": "building", "a": "animal"}
DIRECTIONS = ((1, 0), (-1, 0), (0, 1), (0, -1), (1, -1), (-1, 1))


def make_estate() -> list:
    cells = []
    for row, entries in enumerate(ESTATE_ROWS):
        r = row - 3
        for col, entry in enumerate(entries):
            q = max(-3, -r - 3) + col
            cells.append({"id": len(cells), "q": q, "r": r, "kind": SHORT_KIND[entry[0]],
                          "number": int(entry[1]), "tile": None})
    lookup = {(cell["q"], cell["r"]): cell["id"] for cell in cells}
    for cell in cells:
        cell["neighbors"] = [lookup[(cell["q"] + dq, cell["r"] + dr)] for dq, dr in DIRECTIONS
                             if (cell["q"] + dq, cell["r"] + dr) in lookup]
    seen = set()
    for cell in cells:
        if cell["id"] in seen:
            continue
        todo = [cell["id"]]
        while todo:
            index = todo.pop()
            if index in seen:
                continue
            seen.add(index)
            cells[index]["region"] = cell["id"]
            todo.extend(n for n in cells[index]["neighbors"] if n not in seen and cells[n]["kind"] == cell["kind"])
    return cells


# Each row: the two 2-player slots, then the extra 3-player and 4-player slots.
DEPOT_SLOTS = (
    ("building", "ship", "knowledge", "animal"),
    ("knowledge", "castle", "building", "building"),
    ("animal", "building", "ship", "knowledge"),
    ("ship", "building", "animal", "mine"),
    ("mine", "knowledge", "building", "building"),
    ("building", "animal", "castle", "ship"),
)


def make_supply() -> dict:
    supply = {kind: [] for kind in (*KINDS, "black")}
    serial = 0

    def add(kind: str, black: bool = False, **extra) -> None:
        nonlocal serial
        serial += 1
        supply["black" if black else kind].append({"id": f"tile-{serial}", "kind": kind, **extra})

    for kind, normal, black in (("castle", 14, 2), ("mine", 10, 2), ("ship", 20, 6)):
        for _ in range(normal):
            add(kind)
        for _ in range(black):
            add(kind, True)
    for building in BUILDINGS:
        for _ in range(5):
            add("building", building=building)
        for _ in range(2):
            add("building", True, building=building)
    for animal in ANIMALS:
        for count in (2, 3, 3, 4, 4):
            add("animal", animal=animal, count=count)
        for count in (2, 4):
            add("animal", True, animal=animal, count=count)
    for number in range(1, 27):
        add("knowledge", number in BLACK_KNOWLEDGE, number=number)
    return supply


INT_DIE = {"type": "integer", "minimum": 0, "maximum": 1}
INT_DEPOT = {"type": "integer", "minimum": 1, "maximum": 6}
STRING_TILE = {"type": "string", "minLength": 1, "maxLength": 40}


def action_schema(name: str, properties: dict = None, required: tuple = ()) -> dict:
    return {"type": "object", "properties": {"type": {"const": name}, **(properties or {})},
            "required": ["type", *required], "additionalProperties": False}


ACTION_SCHEMA = {"type": "object", "oneOf": [
    action_schema("take", {"die": INT_DIE, "depot": INT_DEPOT, "tile": STRING_TILE, "discard": STRING_TILE}, ("depot", "tile")),
    action_schema("buy", {"depot": {"type": "integer", "minimum": 0, "maximum": 6}, "tile": STRING_TILE, "discard": STRING_TILE}, ("depot", "tile")),
    action_schema("place", {"die": INT_DIE, "tile": STRING_TILE, "cell": {"type": "integer", "minimum": 0, "maximum": 36}}, ("tile", "cell")),
    action_schema("sell", {"die": INT_DIE, "goods": INT_DEPOT}, ("goods",)),
    action_schema("workers", {"die": INT_DIE}),
    action_schema("ship_goods", {
        "depots": {"type": "array", "items": INT_DEPOT, "minItems": 1, "maxItems": 2, "uniqueItems": True},
        "goods": {"type": "array", "items": INT_DEPOT, "maxItems": 3, "uniqueItems": True},
    }, ("depots", "goods")),
    action_schema("skip_bonus"), action_schema("end_turn"), action_schema("next_round"),
]}
CONFIG_SCHEMA = {"type": "object", "properties": {"seed": {"type": ["integer", "string", "null"]}}, "additionalProperties": False}
