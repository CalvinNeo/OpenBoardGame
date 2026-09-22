"""Printed base-game Terra Nova component data; original art is not included.

Sources and verification notes: designs/terra_nova_sources.md.
Hexes use pointy-top odd-r coordinates, with lettered rows and 1-based columns.
"""

TERRAIN_RING = ["lake", "forest", "wasteland", "desert", "swamp"]
TERRAINS = {
    "lake": {"name": "湖泊", "color": "#3286c6"},
    "forest": {"name": "森林", "color": "#3e9464"},
    "wasteland": {"name": "荒地", "color": "#c9584e"},
    "desert": {"name": "沙漠", "color": "#d9ad48"},
    "swamp": {"name": "沼泽", "color": "#55536c"},
    "river": {"name": "河流", "color": "#9bcdd9"},
}
SAILING_POINTS = [0, 2, 3, 4]

_FACTION_ROWS = [
    ("djinn", "水精灵", "Water Sprites", "lake", "A", 7, 2, 0, 2,
     "每次建立城镇，额外获得 4 分。", "每轮一次，在任意空置湖泊免费建造房屋，无需在范围内。", "建立城镇所需建筑价值降至 6，仍须至少 4 栋建筑。"),
    ("merfolk", "海獭", "Sea Dogs", "lake", "B", 7, 2, 0, 4,
     "可选择跨越一格河流建立城镇。", "建成时立即免费提升一级航运。", "每轮一次，免费将一栋房屋升级为贸易站。"),
    ("golems", "魔像", "Golems", "wasteland", "A", 7, 2, 0, 4,
     "退出时，1 或 2 座贸易站得 2 分；3 座得 3 分；4 座得 4 分。", "原需两把铲的地形改造只需一把铲。", "建立城镇所需建筑价值降至 6，仍须至少 4 栋建筑。"),
    ("ifrits", "火精灵", "Fire Sprites", "wasteland", "B", 7, 2, 0, 4,
     "每项魔力行动的消耗减少 1 魔力，不适用于魔力兑换。", "建成时立即免费改造一格任意边缘空地并免费建屋，无需在范围内，不算用铲。", "退出时，每个包含边缘建筑的独立聚落得 1 分。"),
    ("goblins", "矮妖", "Leprechauns", "swamp", "A", 7, 2, 5, 2,
     "每使用一把铲获得 2 魔力，免费铲也算。", "建成时立即获得 6 魔力。", "建立城镇所需建筑价值降至 6，仍须至少 4 栋建筑。"),
    ("inventors", "发明家", "Inventors", "swamp", "B", 7, 2, 0, 2,
     "其他种族每建一栋房屋，双人局获得 2 魔力，三至四人局获得 1 魔力。", "可重复花费 6 魔力，免费改造范围内空地并直接建造贸易站；不算用铲，算升级贸易站。", "每建一栋房屋获得 2 分。"),
    ("fairies", "仙灵", "Fairies", "forest", "A", 7, 2, 2, 3,
     "每轮收入额外获得 2 魔力。", "每轮一次，花费 2 魔力获得一次带一把免费铲的改造建造行动，建屋仍需 4 钱。", "建立城镇所需建筑价值降至 6，仍须至少 4 栋建筑。"),
    ("druids", "德鲁伊", "Druids", "forest", "B", 7, 2, 0, 4,
     "在允许魔力兑换时，可反复花费 3 魔力获得 2 分。", "退出时，每个独立聚落获得 2 魔力。", "每次将房屋升级为贸易站获得 3 分。"),
    ("sun_worshippers", "拜日族", "Sun Worshippers", "desert", "A", 5, 3, 0, 2,
     "初始放置 3 栋房屋，第三栋在所有玩家放完前两栋之后放置。", "每轮一次，免费改造同大陆上直接相邻空地，可支付通常费用立即建屋；不算用铲。", "建立城镇所需建筑价值降至 6，仍须至少 4 栋建筑。"),
    ("felines", "沙猫", "Sand Cats", "desert", "B", 7, 2, 0, 2,
     "其他种族每升级一栋建筑，双人局获得 2 钱，三至四人局获得 1 钱。", "贸易站升级费用变为邻敌 5 钱、不邻敌 7 钱。", "退出时，每栋不邻接河流的建筑获得 1 分。"),
]
FACTIONS = {}
for fid, name, english, terrain, side, coins, houses, left_coins, left_power, ability, left, right in _FACTION_ROWS:
    FACTIONS[fid] = {
        "id": fid, "name": name, "name_en": english, "terrain": terrain,
        "color": TERRAINS[terrain]["color"], "side": side,
        "starting_coins": coins, "starting_houses": houses,
        "income_coins": 2, "income_power": 2 if fid == "fairies" else 0,
        "house_income": [3, 3, 3, 2, 0, 1, 0, 0],
        "house_power_income": [0, 0, 0, 0, 2, 0, 1, 0],
        "trading_post_income": [{"coins": n, "power": 1} for n in [2, 3, 3, 2]],
        "palace_left_income": {"coins": left_coins, "power": left_power},
        "town_threshold_6": side == "A", "ability": ability,
        "left_ability": left, "right_ability": right,
    }
# Exact printed income slots, from the ten full component boards.
# The leading fixed 2-coin income is separate from the eight house slots.
_HOUSE_TRACKS = {
    "djinn": [3, 3, 3, 0, 0, 1, 0, 0],
    "golems": [3, 2, 2, 2, 0, 1, 0, 0],
    "goblins": [3, 3, 3, 3, 0, 2, 0, 0],
    "inventors": [3, 2, 2, 2, 0, 1, 0, 0],
    "felines": [3, 3, 0, 2, 0, 1, 0, 0],
}
_TRADE_TRACKS = {
    "djinn": [(2, 1), (3, 1), (2, 1), (2, 1)],
    "merfolk": [(2, 1), (2, 1), (2, 1), (2, 1)],
    "golems": [(2, 1), (2, 1), (2, 1), (2, 1)],
    "ifrits": [(2, 2), (2, 2), (2, 1), (2, 1)],
    "goblins": [(2, 1), (2, 1), (3, 2), (3, 2)],
    "inventors": [(2, 1), (2, 1), (1, 1), (1, 1)],
    "fairies": [(3, 2), (3, 2), (3, 1), (3, 1)],
    "druids": [(3, 1), (3, 1), (2, 1), (2, 1)],
    "sun_worshippers": [(2, 2), (2, 2), (2, 1), (2, 1)],
    "felines": [(2, 2), (2, 2), (2, 1), (3, 1)],
}
for fid, track in _HOUSE_TRACKS.items():
    FACTIONS[fid]["house_income"] = track
FACTIONS["goblins"]["house_power_income"] = [0, 0, 0, 0, 3, 0, 2, 0]
for fid, track in _TRADE_TRACKS.items():
    FACTIONS[fid]["trading_post_income"] = [{"coins": coins, "power": power} for coins, power in track]

BONUS_TILES = {
    "A": {"id": "A", "name": "开拓", "income": {"coins": 2, "power": 0}, "special": "spade"},
    "B": {"id": "B", "name": "丰收", "income": {"coins": 6, "power": 0}},
    "C": {"id": "C", "name": "远航", "income": {"coins": 0, "power": 3}, "sailing_bonus": 1},
    "D": {"id": "D", "name": "繁荣", "income": {"coins": 3, "power": 3}},
    "E": {"id": "E", "name": "宫殿", "income": {"coins": 0, "power": 4}, "pass_event": "palace", "pass_points": 4},
    "F": {"id": "F", "name": "商贸", "income": {"coins": 0, "power": 2}, "pass_event": "trading_post", "pass_points": 2},
    "G": {"id": "G", "name": "家园", "income": {"coins": 2, "power": 0}, "pass_event": "house", "pass_points": 1},
    "H": {"id": "H", "name": "航海", "income": {"coins": 0, "power": 3}, "pass_event": "sailing", "pass_points": 3},
}
ROUND_TILES = {
    fid: {"id": fid, "name": name, "event": event, "points": points}
    for fid, name, event, points in [
        ("house_1", "建造房屋", "house", 2), ("house_2", "建造房屋", "house", 2),
        ("trading_post_1", "升级贸易站", "trading_post", 3), ("trading_post_2", "升级贸易站", "trading_post", 3),
        ("palace", "升级宫殿", "palace", 5), ("town", "建立城镇", "town", 5),
        ("sailing", "提升航运", "sailing", 2), ("spade", "使用铲子", "spade", 2),
    ]
}
TOWN_TILES = {
    "coins": {"id": "coins", "name": "富庶之城", "score": 5, "coins": 6},
    "power": {"id": "power", "name": "魔力之城", "score": 6, "power": 8},
    "points": {"id": "points", "name": "荣耀之城", "score": 9},
    "sailing": {"id": "sailing", "name": "航海之城", "score": 4, "sailing": 1},
}

# Main 2–4-player map, transcribed from KOSMOS rules p. 2.
# L lake; F forest; W wasteland; D desert; S swamp; R river.
MAP_ROWS = [
    "RFDSFWLDRW",
    "RSLRRDFRDF",
    "SRWRFRSWRL",
    "DRRSWRLRWS",
    "FLDWLDRRFD",
    "WSFRRRSDWL",
    "RLRRWFRLRS",
    "RRLSDSRRRF",
    "SFDWFLWDLR",
]
_MAP_KEYS = dict(zip("LFWDSR", ["lake", "forest", "wasteland", "desert", "swamp", "river"]))
BOARD_CELLS = [
    {"id": f"{chr(65 + row)}{col + 1}", "row": row, "col": col, "terrain": _MAP_KEYS[terrain]}
    for row, terrains in enumerate(MAP_ROWS) for col, terrain in enumerate(terrains)
]
from game.terra_nova_map import BRIDGE_SITES
