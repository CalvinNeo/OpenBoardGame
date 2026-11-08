"""Static data for 12 Rivers (twelve_rivers).

Board topology is reconstructed from the 2025 Good Games rulebook constraints plus
component photos; see designs/task187.md section 4 for the derivation.
"""

from typing import Dict, List, Optional, Tuple

GAME_NAME = "12 Rivers"
GAME_NAME_ZH = "十二河谷"

# ------------------------------------------------------------------- pearls
PEARL_COLORS: Tuple[str, ...] = ("green", "blue", "pink", "purple", "white")
PEARL_COUNTS: Dict[str, int] = {
    "green": 17,
    "blue": 15,
    "pink": 13,
    "purple": 11,
    "white": 9,
}
PEARL_POINTS: Dict[str, int] = {
    "green": 1,
    "blue": 2,
    "pink": 3,
    "purple": 4,
    "white": 5,
}
PEARL_META: Dict[str, Dict[str, str]] = {
    "green": {"emoji": "\U0001f7e2", "zh": "绿珍珠", "en": "Green pearl"},
    "blue": {"emoji": "\U0001f535", "zh": "蓝珍珠", "en": "Blue pearl"},
    "pink": {"emoji": "\U0001f338", "zh": "粉珍珠", "en": "Pink pearl"},
    "purple": {"emoji": "\U0001f7e3", "zh": "紫珍珠", "en": "Purple pearl"},
    "white": {"emoji": "\u26aa", "zh": "白珍珠", "en": "White pearl"},
}
TOTAL_PEARLS = sum(PEARL_COUNTS.values())

# -------------------------------------------------------------- supply cards
BANNER = "banner"
LANTERN = "lantern"
SUPPLIES = "supplies"
NET = "net"
INSTRUMENT = "instrument"
SUPPLY_KINDS: Tuple[str, ...] = (BANNER, LANTERN, SUPPLIES, NET, INSTRUMENT)
SUPPLY_PER_KIND = 10
SUPPLY_DISPLAY_SIZE = 3
STARTING_HAND = 6

SUPPLY_META: Dict[str, Dict[str, str]] = {
    BANNER: {"emoji": "\U0001f6a9", "zh": "旗帜", "en": "Banner",
             "phase": "exploration",
             "effect_zh": "放置族人标记后：把自己另一枚尚未放置的族人标记移到顺位轨最前面。",
             "effect_en": "After placing a marker: move one of your unplaced markers to the front of the turn track."},
    LANTERN: {"emoji": "\U0001f3ee", "zh": "灯笼", "en": "Lantern",
              "phase": "exploration",
              "effect_zh": "放置族人标记后：从版图上任意拿走 1 枚仙子。",
              "effect_en": "After placing a marker: take any 1 fairy from the board."},
    SUPPLIES: {"emoji": "\U0001f392", "zh": "补给", "en": "Supplies",
               "phase": "exploration",
               "effect_zh": "放置族人标记后：把自己另一枚已放置的族人标记免费移到任意空格，不算放置。",
               "effect_en": "After placing a marker: move one of your placed markers to any free space for free."},
    NET: {"emoji": "\U0001f3a3", "zh": "渔网", "en": "Fishing net",
          "phase": "collection",
          "effect_zh": "在河道收珠时，额外多拿 1 颗位于自己标记处的珍珠。",
          "effect_en": "When collecting from a river: take 1 extra pearl at your marker."},
    INSTRUMENT: {"emoji": "\U0001f3b5", "zh": "乐器", "en": "Instrument",
                 "phase": "collection",
                 "effect_zh": "结交玛卡雅后：把族人标记移到村庄中下一个更靠右的空格，再拿 1 张玛卡雅。",
                 "effect_en": "After befriending a Markaya: move your marker one free space right in the village and take another."},
}

# ------------------------------------------------------------------ fairies
FIRE = "fire"
EARTH = "earth"
WIND = "wind"
LIGHT = "light"
WATER = "water"
FAIRY_KINDS: Tuple[str, ...] = (FIRE, EARTH, WIND, LIGHT, WATER)
FAIRY_PER_KIND = 5
FAIRY_PER_PLAYER = 5

FAIRY_META: Dict[str, Dict[str, str]] = {
    FIRE: {"emoji": "\U0001f525", "zh": "火仙子", "en": "Fire fairy",
           "effect_zh": "当作 1 张任意营地卡：放置时少付 1 张，或作为对子的一半。2 枚火仙子可以当作任意一组对子。",
           "effect_en": "Counts as 1 supply card: pay 1 less when placing, or act as half of a pair. Two fire fairies form any pair."},
    EARTH: {"emoji": "\u26f0\ufe0f", "zh": "土仙子", "en": "Earth fairy",
            "effect_zh": "任意时机把至多 3 颗珍珠在羊驼与自己的玛卡雅之间移动，需符合存放孔颜色。",
            "effect_en": "Move up to 3 pearls between your alpaca and your own Markaya, following spot colours."},
    WIND: {"emoji": "\U0001f32c\ufe0f", "zh": "风仙子", "en": "Wind fairy",
           "effect_zh": "完全免除 1 次放置族人标记的费用（该格也不再获得 +1 营地卡）。",
           "effect_en": "Ignore the cost of one placement entirely (and forgo any card it would grant)."},
    LIGHT: {"emoji": "\U0001f4a1", "zh": "光仙子", "en": "Light fairy",
            "effect_zh": "交付时把 1 个存放孔变成彩虹孔，可以放任意颜色的珍珠，仍按珍珠本身颜色计分。",
            "effect_en": "Turn 1 storage spot into a rainbow spot when delivering; the pearl still scores its own colour."},
    WATER: {"emoji": "\U0001f4a7", "zh": "水仙子", "en": "Water fairy",
            "effect_zh": "在河道收珠时拿 2 颗而不是 1 颗，两颗都必须在自己标记处。",
            "effect_en": "When collecting from a river, take 2 pearls instead of 1, both at your marker."},
}

# -------------------------------------------------------------- alpaca cards
# "Have N pearls of this colour on your alpaca at the same time" - first to
# satisfy it claims the card for 4 reputation points.
ALPACA_CARDS: List[Dict] = [
    {"id": "alp_white", "color": "white", "count": 3, "points": 4},
    {"id": "alp_purple", "color": "purple", "count": 3, "points": 4},
    {"id": "alp_pink", "color": "pink", "count": 4, "points": 4},
    {"id": "alp_blue", "color": "blue", "count": 4, "points": 4},
    {"id": "alp_green", "color": "green", "count": 4, "points": 4},
]
ALPACA_CARD_IDS: Tuple[str, ...] = tuple(card["id"] for card in ALPACA_CARDS)
ALPACA_SLOTS = 6

# ---------------------------------------------------------------- board rows
RIVER_COUNT = 12
RIVERS_PER_PLAYER = 3
TOTAL_ROUNDS = 5

# (row index, cost, list of river groups). Cost is the number of supply cards to
# discard; a negative cost means you gain that many cards instead.
_ROW_SPEC: List[Tuple[int, int, List[List[int]]]] = [
    (1, 3, [[r] for r in range(1, 13)]),
    (2, 2, [[1, 2], [3, 4], [5, 6], [7, 8], [9, 10], [11, 12]]),
    (3, 1, [[1, 2, 3, 4], [5, 6, 7, 8], [9, 10, 11, 12]]),
    (4, 0, [[1, 2, 3, 4, 5, 6, 7, 8], [9, 10, 11, 12]]),
    (5, -1, [[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]]),
]


def _build_board() -> Tuple[List[Dict], Dict[str, Dict], Dict[str, str]]:
    stretches: List[Dict] = []
    by_id: Dict[str, Dict] = {}
    for row, cost, groups in _ROW_SPEC:
        for index, rivers in enumerate(groups, start=1):
            stretch_id = f"r{row}s{index}"
            stretch = {
                "id": stretch_id,
                "row": row,
                "index": index,
                "cost": cost,
                "rivers": tuple(rivers),
                "slots": row,
            }
            stretches.append(stretch)
            by_id[stretch_id] = stretch
    downstream: Dict[str, str] = {}
    for stretch in stretches:
        if stretch["row"] == 5:
            downstream[stretch["id"]] = "sea"
            continue
        target_row = stretch["row"] + 1
        first_river = stretch["rivers"][0]
        for candidate in stretches:
            if candidate["row"] == target_row and first_river in candidate["rivers"]:
                downstream[stretch["id"]] = candidate["id"]
                break
    return stretches, by_id, downstream


STRETCHES, STRETCH_BY_ID, DOWNSTREAM = _build_board()
STRETCH_IDS: Tuple[str, ...] = tuple(stretch["id"] for stretch in STRETCHES)
# Resolution order: upstream rows first, and left to right inside a row.
STRETCH_ORDER: Tuple[str, ...] = tuple(
    stretch["id"] for stretch in sorted(STRETCHES, key=lambda s: (s["row"], s["index"]))
)

SEA_ID = "sea"
SEA_COST = 0
VILLAGE_SLOTS = 6
VILLAGE_COSTS: Tuple[int, ...] = (2, 1, 0, 0, 0, 0)
VILLAGE_IDS: Tuple[str, ...] = tuple(f"v{i}" for i in range(1, VILLAGE_SLOTS + 1))
MARKAYA_DISPLAY_SIZE = 6

# ---------------------------------------------------------------- fairy spots
# Stumps are used in odd rounds (1/3/5), fox statues in even rounds (2/4).
STUMP = "stump"
STATUE = "statue"
FAIRY_SPOTS: List[Dict[str, str]] = [
    {"id": "stump1", "kind": STUMP, "stretch": "r2s1"},
    {"id": "stump2", "kind": STUMP, "stretch": "r2s3"},
    {"id": "stump3", "kind": STUMP, "stretch": "r3s2"},
    {"id": "stump4", "kind": STUMP, "stretch": "r3s3"},
    {"id": "statue1", "kind": STATUE, "stretch": "r2s2"},
    {"id": "statue2", "kind": STATUE, "stretch": "r3s1"},
    {"id": "statue3", "kind": STATUE, "stretch": "r2s4"},
    {"id": "statue4", "kind": STATUE, "stretch": "r4s2"},
]
FAIRY_SPOT_IDS: Tuple[str, ...] = tuple(spot["id"] for spot in FAIRY_SPOTS)
SPOT_BY_ID: Dict[str, Dict[str, str]] = {spot["id"]: spot for spot in FAIRY_SPOTS}
# Which board spot hands its fairies to a given stretch.
FAIRY_SPOTS_FOR_STRETCH: Dict[str, List[str]] = {}
for _spot in FAIRY_SPOTS:
    FAIRY_SPOTS_FOR_STRETCH.setdefault(_spot["stretch"], []).append(_spot["id"])


def fairy_spot_order(kind: str) -> List[str]:
    """Spots of one kind, ordered left to right along the board."""
    spots = [spot for spot in FAIRY_SPOTS if spot["kind"] == kind]
    return [
        spot["id"]
        for spot in sorted(
            spots,
            key=lambda s: (
                STRETCH_BY_ID[s["stretch"]]["rivers"][0],
                STRETCH_BY_ID[s["stretch"]]["row"],
            ),
        )
    ]


def active_river_count(player_count: int) -> int:
    return RIVERS_PER_PLAYER * player_count


def is_stretch_active(stretch_id: str, player_count: int) -> bool:
    stretch = STRETCH_BY_ID[stretch_id]
    return stretch["rivers"][0] <= active_river_count(player_count)


# ------------------------------------------------------------------- Markaya
FULL_EACH = "full_each"
COLOR_EACH = "color_each"
FAIRY_EACH = "fairy_each"
COLOR_MOST = "color_most"
FAIRY_MOST = "fairy_most"
CARD_EACH = "card_each"
CARD_MOST = "card_most"
SELF_FULL = "self_full"
SELF_FOUR_SAME = "self_four_same"
SELF_FIVE_DIFF = "self_five_diff"

INTROVERTED_OBJECTIVES = (SELF_FULL, SELF_FOUR_SAME, SELF_FIVE_DIFF)

OBJECTIVE_META: Dict[str, Dict[str, str]] = {
    FULL_EACH: {
        "zh": "每张存放孔全部填满的玛卡雅（含自己）3 分",
        "en": "3 per Markaya with every storage spot filled (including this one)",
    },
    COLOR_EACH: {"zh": "自己所有玛卡雅上每颗{c} 2 分", "en": "2 per {c} pearl on your Markaya"},
    FAIRY_EACH: {"zh": "每枚未使用仙子 2 分", "en": "2 per unused fairy"},
    COLOR_MOST: {"zh": "拥有最多{c} 6 分（并列不得分）", "en": "6 if you have the most {c} pearls (no points on a tie)"},
    FAIRY_MOST: {"zh": "拥有最多未使用仙子 6 分（并列不得分）", "en": "6 if you have the most unused fairies (no points on a tie)"},
    CARD_EACH: {"zh": "每张手牌 1 分", "en": "1 per supply card in hand"},
    CARD_MOST: {"zh": "手牌最多 5 分（并列不得分）", "en": "5 if you have the most cards in hand (no points on a tie)"},
    SELF_FULL: {"zh": "本板块填满 8 分", "en": "8 if every storage spot on this tile is filled"},
    SELF_FOUR_SAME: {"zh": "本板块有 4 颗同色 6 分", "en": "6 if 4 pearls of one colour are on this tile"},
    SELF_FIVE_DIFF: {"zh": "本板块有 5 颗 5 种不同色 5 分", "en": "5 if 5 pearls in 5 different colours are on this tile"},
}

RAINBOW = "rainbow"

# Value of "most pearls of this colour" tiles, read off the printed tiles.
COLOR_MOST_POINTS: Dict[str, int] = {
    "white": 5,
    "purple": 6,
    "blue": 7,
    "pink": 7,
    "green": 8,
}


def _tile(tile_id: str, name_zh: str, name_en: str, cards: int, spots: List[str], objective: str,
          color: Optional[str] = None) -> Dict:
    return {
        "id": tile_id,
        "name_zh": name_zh,
        "name_en": name_en,
        "cards": cards,
        "spots": tuple(spots),
        "objective": objective,
        "color": color,
        "points": COLOR_MOST_POINTS.get(color, 0) if objective == COLOR_MOST else 0,
    }


STARTING_MARKAYA: List[Dict] = [
    _tile("start1", "起始村民 · 河畔人家", "Starting Markaya", 0,
          ["green", "blue", "pink", "purple"], FULL_EACH),
    _tile("start2", "起始村民 · 林间小屋", "Starting Markaya", 0,
          ["green", "blue", "pink", "white"], FULL_EACH),
    _tile("start3", "起始村民 · 石桥守望", "Starting Markaya", 0,
          ["green", "blue", "purple", "white"], FULL_EACH),
    _tile("start4", "起始村民 · 湖畔灯塔", "Starting Markaya", 0,
          ["green", "pink", "purple", "white"], FULL_EACH),
]

MARKAYA_TILES: List[Dict] = [
    # --- extroverted: most of a colour -------------------------------------
    _tile("mk01", "苔原牧人", "Moss Herder", 2, ["green", "green", "blue", RAINBOW], COLOR_MOST, "green"),
    _tile("mk02", "潮汐渔夫", "Tide Fisher", 2, ["blue", "blue", "pink", RAINBOW], COLOR_MOST, "blue"),
    _tile("mk03", "花圃匠人", "Blossom Gardener", 2, ["pink", "pink", "purple", RAINBOW], COLOR_MOST, "pink"),
    _tile("mk04", "夜观测星者", "Night Stargazer", 2, ["purple", "purple", "white", RAINBOW], COLOR_MOST, "purple"),
    _tile("mk05", "雪线守望者", "Snowline Watcher", 2, ["white", "white", "purple", RAINBOW], COLOR_MOST, "white"),
    # --- extroverted: 2 points per pearl of a colour -----------------------
    _tile("mk06", "拾穗少女", "Gleaner", 1, ["green", "green", "blue"], COLOR_EACH, "green"),
    _tile("mk07", "摆渡人", "Ferryman", 1, ["blue", "blue", "pink"], COLOR_EACH, "blue"),
    _tile("mk08", "织染师", "Dyer", 1, ["pink", "pink", "purple"], COLOR_EACH, "pink"),
    _tile("mk09", "藏经人", "Archivist", 1, ["purple", "purple", "white"], COLOR_EACH, "purple"),
    _tile("mk10", "祈雪祭司", "Snow Priestess", 1, ["white", "white", "purple"], COLOR_EACH, "white"),
    # --- extroverted: fairies, cards, completion ---------------------------
    _tile("mk11", "仙子语者", "Fairy Speaker", 2, ["green", "blue", "pink", RAINBOW], FAIRY_EACH),
    _tile("mk12", "雾中旅伴", "Mist Companion", 1, ["blue", "purple", RAINBOW], FAIRY_MOST),
    _tile("mk13", "营地账房", "Camp Steward", 0, ["green", "pink", "purple"], CARD_EACH),
    _tile("mk14", "行商队长", "Caravan Lead", 0, ["blue", "white", RAINBOW], CARD_MOST),
    _tile("mk15", "丰收督办", "Harvest Overseer", 2, ["green", "blue", "pink", "purple"], FULL_EACH),
    _tile("mk16", "篝火说书人", "Campfire Storyteller", 1, ["green", "green", "pink", RAINBOW], COLOR_EACH, "green"),
    _tile("mk17", "河湾测绘者", "Riverbend Surveyor", 1, ["blue", "blue", "white", RAINBOW], COLOR_EACH, "blue"),
    _tile("mk18", "风铃匠", "Windchime Maker", 1, ["pink", "pink", "green", RAINBOW], COLOR_EACH, "pink"),
    # --- introverted: must fill this tile ---------------------------------
    _tile("mk19", "独居药师", "Hermit Apothecary", 3, ["green", "blue", "pink"], SELF_FULL),
    _tile("mk20", "石屋隐者", "Stone Hut Recluse", 3, ["blue", "purple", "white", RAINBOW], SELF_FULL),
    _tile("mk21", "织网老妇", "Net Weaver", 3, ["green", "blue", "pink", "purple", "white"], SELF_FULL),
    _tile("mk22", "琥珀收藏家", "Amber Collector", 2,
          [RAINBOW, RAINBOW, RAINBOW, RAINBOW, "white"], SELF_FOUR_SAME),
    _tile("mk23", "单色画师", "Monochromist", 2, [RAINBOW, RAINBOW, RAINBOW, RAINBOW], SELF_FOUR_SAME),
    _tile("mk24", "五色织匠", "Five Colour Weaver", 2,
          ["green", "blue", "pink", "purple", "white"], SELF_FIVE_DIFF),
    _tile("mk25", "彩虹祭坛", "Rainbow Altar", 2,
          ["white", "purple", "pink", "blue", "green"], SELF_FIVE_DIFF),
    _tile("mk26", "深潭守望", "Deep Pool Keeper", 3, ["purple", "purple", "blue", RAINBOW], SELF_FULL),
]

MARKAYA_BY_ID: Dict[str, Dict] = {tile["id"]: tile for tile in MARKAYA_TILES}
for _tile_def in STARTING_MARKAYA:
    MARKAYA_BY_ID[_tile_def["id"]] = _tile_def
MARKAYA_IDS: Tuple[str, ...] = tuple(tile["id"] for tile in MARKAYA_TILES)
STARTING_MARKAYA_IDS: Tuple[str, ...] = tuple(tile["id"] for tile in STARTING_MARKAYA)

MARKERS_PER_PLAYER = 3
TRACK_SPACES = 12
