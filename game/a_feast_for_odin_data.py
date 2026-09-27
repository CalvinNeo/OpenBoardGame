"""Odin rules and original, code-drawn components. See designs/126.md for scope.

The home board and normal goods follow the base game. Island outlines, mountain
sequences and special-tile silhouettes are a declared digital component set.
No scans or publisher illustrations are served to clients.
"""


def shape(rows: list) -> list:
    return [[x, y] for y, row in enumerate(rows) for x, c in enumerate(row) if c != "."]


def rect(w: int, h: int) -> list:
    return [[x, y] for y in range(h) for x in range(w)]


GOODS = {}
_families = (
    (("peas", "豌豆", "🫛"), ("mead", "蜂蜜酒", "🍺"), ("oil", "鲸油", "🛢️"), ("rune", "符文石", "🗿"), 2, 1, 6),
    (("flax", "亚麻", "🌿"), ("fish", "鱼干", "🐟"), ("hide", "兽皮", "🟩"), ("silverware", "银器", "🍴"), 3, 1, 7),
    (("beans", "蚕豆", "🫘"), ("milk", "牛奶", "🥛"), ("wool", "羊毛", "🧶"), ("chest", "箱子", "📦"), 2, 2, 8),
    (("grain", "谷物", "🌾"), ("salt_meat", "腌肉", "🥓"), ("linen", "亚麻布", "🧵"), ("silk", "丝绸", "🪡"), 4, 1, 9),
    (("cabbage", "卷心菜", "🥬"), ("game_meat", "猎肉", "🍖"), ("skin", "皮骨", "🦴"), ("spices", "香料", "🌶️"), 3, 2, 9),
    (None, ("sheep", "绵羊", "🐑"), ("fur", "毛皮", "🦊"), ("jewelry", "珠宝", "💎"), 4, 2, 10),
    (("fruit", "水果", "🍎"), ("whale_meat", "鲸肉", "🐋"), ("robe", "长袍", "🥼"), ("treasure", "宝箱", "🧰"), 3, 3, 12),
    (None, ("cattle", "牛", "🐄"), ("clothing", "衣服", "👕"), ("hoard", "银币窖藏", "🏺"), 4, 3, 15),
)
for _family in _families:
    _w, _h, _sword = _family[4:]
    for _level, _item in enumerate(_family[:4]):
        if _item is None:
            continue
        _key, _name, _icon = _item
        GOODS[_key] = {"name": _name, "icon": _icon, "color": ("orange", "red", "green", "blue")[_level],
                       "cells": rect(_w, _h), "width": _w, "height": _h,
                       "upgrade": _family[_level + 1][0] if _level < 3 else None,
                       "sword": _sword if _level == 3 else 0, "points": 2 if _key == "sheep" else 3 if _key == "cattle" else 0}
for _key in ("sheep", "cattle"):
    GOODS["pregnant_" + _key] = {**GOODS[_key], "name": "怀孕" + GOODS[_key]["name"], "points": GOODS[_key]["points"] + 1}

SPECIALS = {
    "beads": ("玻璃珠", "📿", [".#.", "###", ".#."], 7, 0, False),
    "helmet": ("头盔", "🪖", ["##", "##", "#."], 8, 1, True),
    "pin": ("衣针", "🧷", ["#...", "####"], 8, 1, True),
    "belt": ("腰带", "➰", ["#####"], 8, 2, False),
    "cross": ("十字架", "✝️", [".#.", "###", ".#.", ".#."], 8, 2, False),
    "horn": ("饮酒角", "📯", ["..##", ".##.", "##.."], 8, 2, False),
    "amber": ("琥珀像", "🗽", [".#.", "###", "###"], 9, 2, False),
    "horseshoe": ("马蹄铁", "🧲", ["#.#", "#.#", "###"], 9, 2, True),
    "brooch": ("金胸针", "🌼", [".#..", "####", ".##.", ".#.."], 9, 3, False),
    "hammer": ("锻锤", "🔨", ["#####", "..#..", "..#..", "..#..", "..#.."], 10, 4, True),
    "fibula": ("扣针", "🔗", ["####", "#..#", "###."], 10, 4, True),
    "axe": ("投斧", "🪓", ["#####", ".###.", "..#.."], 11, 4, True),
    "chalice": ("圣杯", "🏆", ["####", ".##.", ".##.", ".##."], 12, 5, False),
    "shield": ("圆盾", "🛡️", [".##.", "####", "####", ".##."], 13, 6, False),
    "crown": ("英格兰王冠", "👑", ["#.#.#", "#####", "#####"], 16, None, False),
}
for _key, (_name, _icon, _rows, _sword, _price, _forge) in SPECIALS.items():
    GOODS[_key] = {"name": _name, "icon": _icon, "color": "blue", "cells": shape(_rows),
                   "width": len(_rows[0]), "height": len(_rows), "sword": _sword, "price": _price,
                   "forge": _forge, "special": True, "points": 2 if _key == "crown" else 0, "upgrade": None}
for _key, _name, _icon in (("silver", "银币", "💰"), ("wood", "木材", "🌲"), ("stone", "石头", "⛰️"), ("ore", "矿石", "🔷")):
    GOODS[_key] = {"name": _name, "icon": _icon, "color": _key, "cells": [[0, 0]], "width": 1, "height": 1,
                   "sword": 0, "points": 0, "upgrade": None}
WEAPONS = {"bow": {"name": "弓箭", "icon": "🏹"}, "snare": {"name": "陷阱", "icon": "🪤"},
           "spear": {"name": "长矛", "icon": "🔱"}, "sword": {"name": "长剑", "icon": "⚔️"}}
SHIPS = {"whaler": {"name": "捕鲸艇", "icon": "🛶", "cost": 3, "wood": 1, "capacity": 1, "points": 3},
         "knarr": {"name": "商船", "icon": "⛵", "cost": 5, "wood": 2, "capacity": 0, "points": 5},
         "longship": {"name": "长船", "icon": "🚢", "cost": 8, "wood": 2, "capacity": 3, "points": 8}}
HARVEST = {7: (1, 2, 0, 3, 0, 4, 0), 6: (2, 0, 3, 0, 4, 0)}
CROPS = {1: ("peas", "flax", "beans"), 2: ("grain",), 3: ("cabbage",), 4: ("fruit",)}
MOUNTAINS = [list(row) + ["silver2"] for row in (
    ("wood", "wood", "stone", "stone", "ore", "ore"),
    ("wood", "wood", "wood", "stone", "ore", "ore"),
    ("wood", "wood", "stone", "ore", "ore"),
    ("wood", "wood", "wood", "stone", "stone", "ore"),
    ("wood", "stone", "stone", "stone", "ore"),
    ("wood", "wood", "wood", "wood", "stone", "ore"),
    ("wood", "stone", "stone", "ore", "ore"),
    ("wood", "wood", "stone", "stone", "stone", "ore"),
)]


def board_data(name: str, rows: list, points: int = 0, bonuses: dict = None,
               tracks: list = None, kind: str = "island", materials: dict = None) -> dict:
    cells = shape(rows)
    return {"name": name, "width": max(map(len, rows)), "height": len(rows), "cells": cells,
            "negative": [[x, y] for y, row in enumerate(rows) for x, c in enumerate(row) if c == "-"],
            "bonuses": [{"x": x, "y": y, "goods": goods} for (x, y), goods in (bonuses or {}).items()],
            "tracks": tracks or [], "points": points, "kind": kind, "materials": materials or {}}


# Twelve-step income diagonal, the top-right extension, and the shortened bottom
# row give exactly 86 printed negative spaces on the original home board.
_home_rows = []
for _y in range(12):
    _home_rows.append("".join("-" if (_y < 5 and _x != 11 - _y and _x < 12) or (_y >= 5 and _x >= 7) else "o"
                              for _x in range(13 if _y < 3 else 12 if _y < 11 else 8)))
_home_track = {"cap": 18, "steps": [{"x": i, "y": 11-i, "value": value, "origin": [0, 11]}
                                      for i, value in enumerate((0, 1, 2, 2, 3, 4, 5, 6, 7, 9, 12, 15))]}
BOARDS = {"home": board_data("家园", _home_rows, bonuses={(1, 9): {"mead": 1}, (2, 7): {"wood": 1},
                        (5, 10): {"stone": 1}, (0, 5): {"ore": 1}, (6, 7): {"rune": 1}}, tracks=[_home_track], kind="home")}


def island(key: str, name: str, width: int, height: int, points: int, negatives: int,
           bonuses: dict, tier: int, cap: int) -> None:
    """Normalized island layouts retain the base points and printed penalties."""
    special = set(bonuses)
    diag = [(i, height-1-i) for i in range(min(width, height, cap))]
    candidates = [(x, y) for y in range(height) for x in range(width) if (x, y) not in special and (x, y) not in diag]
    neg = set(candidates[:negatives])
    rows = ["".join("-" if (x, y) in neg else "o" for x in range(width)) for y in range(height)]
    track = {"cap": cap, "steps": [{"x": x, "y": y, "value": i, "origin": [0, height-1]} for i, (x, y) in enumerate(diag)]}
    BOARDS[key] = board_data(name, rows, points, bonuses, [track])
    BOARDS[key]["tier"] = tier
    BOARDS[key]["digital_layout"] = True


island("shetland", "设得兰群岛", 7, 6, 6, 24, {(1, 2): {"fish": 1}, (5, 3): {"oil": 1}}, 1, 3)
island("faroe", "法罗群岛", 6, 5, 4, 16, {(1, 1): {"wood": 1}, (4, 2): {"milk": 1}, (1, 3): {"peas": 1}}, 1, 3)
island("iceland", "冰岛", 7, 6, 16, 24, {(1, 2): {"mead": 1}, (5, 3): {"stone": 1, "ore": 1}}, 2, 5)
island("greenland", "格陵兰", 7, 6, 12, 20, {(1, 2): {"sheep": 1}, (5, 3): {"fish": 1}}, 2, 8)
island("bear", "熊岛", 7, 6, 12, 22, {(1, 2): {"rune": 1, "ore": 1}, (5, 3): {"game_meat": 1}}, 2, 5)
island("baffin", "巴芬岛", 8, 7, 12, 34, {(1, 2): {"sheep": 1}, (6, 4): {"oil": 1}}, 3, 7)
island("labrador", "拉布拉多", 9, 7, 36, 40, {(1, 2): {"fish": 1}, (7, 4): {"ore": 1}}, 3, 5)
island("newfoundland", "纽芬兰", 9, 7, 38, 40, {(1, 2): {"pin": 1}, (7, 4): {"stone_house": 1}}, 3, 5)
ISLAND_PAIRS = (("shetland", "bear"), ("faroe", "baffin"), ("iceland", "labrador"), ("greenland", "newfoundland"))
BOARDS["shed"] = {
    "name": "棚屋", "width": 0, "height": 0, "cells": [], "negative": [], "bonuses": [], "tracks": [],
    "points": 8, "kind": "shed", "materials": {"wood": 3, "stone": 3}}
BOARDS["stone_house"] = board_data("石屋", [".o-..", "-ooo.", ".-o--", ".o-o-"], 10,
                                    {(2, 1): {"hide": 1}}, kind="house", materials={"wood": 1, "stone": 1})
_long_rows = ["o-o-o-o-o-o", "-o-.-o-.-o-", "o-o-ooo-o-o"]
BOARDS["long_house"] = board_data("长屋", _long_rows, 17, {(10, 0): {"oil": 1}, (5, 2): {"beans": 1}, (10, 2): {"peas": 1}}, kind="house")
HOUSE_SUPPLY = {"shed": 3, "stone_house": 3, "long_house": 5}


def effect(kind: str, **kwargs) -> dict:
    return {"kind": kind, **kwargs}


def gain(**items) -> dict:
    return effect("gain", items=items)


def exchange(cost: dict, reward: dict) -> dict:
    return effect("exchange", cost=cost, reward=reward)


ACTIONS = {}


def action(key: str, name: str, group: str, workers: int, effects: list, **requirements) -> None:
    ACTIONS[key] = {"name": name, "group": group, "workers": workers, "effects": effects, **requirements}


for _n, (_key, _cost) in enumerate((("shed", {"wood": 2}), ("stone_house", {"stone": 1}), ("long_house", {"stone": 2})), 1):
    action("build_" + _key, "建造" + BOARDS[_key]["name"], "build", _n, [effect("build", building=_key, cost=_cost)])
for _n, _key in enumerate(SHIPS, 1):
    action("build_" + _key, "建造" + SHIPS[_key]["name"], "build", _n, [effect("ship", ship=_key, cost={"wood": SHIPS[_key]["wood"]})])
action("settlement", "房屋与大船", "build", 4, [effect("settlement")])
for _n in (1, 2):
    action("hunt" + str(_n), "狩猎", "hunt", _n, [effect("hunt", mode="hunt")])
action("fish", "捕鱼", "hunt", 1, [gain(fish=1)])
action("snare", "布置陷阱", "hunt", 2, [effect("hunt", mode="snare")])
for _n in (3, 4):
    action("whale" + str(_n), "捕鲸", "hunt", _n, [effect("hunt", mode="whale", boats=3 if _n == 3 else 1)], ship="whaler")
action("stockfish", "购买鱼干", "market", 1, [exchange({"silver": 1}, {"fish": 2})], livestock=True)
action("salt_meat", "购买腌肉", "market", 1, [exchange({"silver": 2}, {"salt_meat": 2})], livestock=True)
action("sheep", "购买绵羊", "market", 2, [exchange({"silver": 1}, {"sheep": 1})], livestock=True)
action("cattle_milk", "购买奶牛", "market", 2, [exchange({"silver": 3}, {"cattle": 1, "milk": 1})], livestock=True)
action("livestock", "牲畜市场", "market", 3, [effect("choice", options=[exchange({}, {"sheep": 1}), exchange({"silver": 1}, {"cattle": 1})])], livestock=True)
action("herd", "成对牲畜", "market", 4, [exchange({"silver": 3}, {"sheep": 1, "cattle": 1})], livestock=True)
action("weekly1", "豌豆与蜂蜜酒", "market", 1, [gain(peas=1, mead=1, silver=1)])
action("weekly2", "亚麻与鱼干", "market", 2, [gain(flax=1, fish=1, silver=1)])
action("weekly3", "水果与食物", "market", 3, [gain(fruit=1, oil=1, salt_meat=1, silver=1)])
action("milk", "挤奶", "market", 1, [effect("produce", animal="cattle", good="milk", maximum=3)])
action("mead", "酿造蜂蜜酒", "market", 2, [gain(mead=2, silver=2)])
action("wool", "剪羊毛", "market", 3, [effect("produce", animal="sheep", good="wool", maximum=3)])
action("products", "香料与畜产", "market", 4, [gain(spices=1, silver=1), effect("produce", animal="cattle", good="milk", fixed=2), effect("produce", animal="sheep", good="wool", fixed=1)])
action("weave", "纺织", "craft", 1, [exchange({"flax": 1}, {"linen": 1})])
action("runestone", "雕刻符文石", "craft", 1, [exchange({"stone": 1}, {"rune": 1, "silver": 1})])
action("tailor", "裁制衣服", "craft", 2, [exchange({"hide": 1, "linen": 1}, {"clothing": 1, "silver": 2})])
action("chest", "制作箱子", "craft", 2, [effect("choice", options=[exchange({"wood": 1}, {"chest": 1, "silver": 1}), exchange({"ore": 1}, {"chest": 1, "silver": 1})])])
action("forge", "锻造", "craft", 3, [effect("forge")])
action("craft_pair", "石木工艺", "craft", 3, [effect("choice", options=[exchange({"stone": 2}, {"rune": 2}), exchange({"wood": 2}, {"chest": 2})])])
action("luxury", "奢侈品工艺", "craft", 4, [gain(silver=4), exchange({"wool": 1}, {"robe": 1}), exchange({"silverware": 1}, {"jewelry": 1})])
action("mountain2", "开采山地", "trade", 1, [effect("mountain", counts=[2])])
action("mountain_upgrade1", "采集与交易", "trade", 1, [effect("mountain", counts=[1]), effect("upgrade", count=1, steps=1)])
action("upgrade2", "两份交易", "trade", 1, [effect("upgrade", count=2, steps=1)])
action("wood_ore", "木材与矿石", "trade", 2, [effect("wood_ore")])
action("mountain_upgrade3", "开采与交易", "trade", 2, [effect("mountain", counts=[3]), effect("upgrade", count=1, steps=1)])
action("upgrade3", "三份交易", "trade", 2, [effect("upgrade", count=3, steps=1)])
action("mountain32", "两座山地", "trade", 3, [effect("mountain", counts=[3, 2])])
action("upgrade_weapons", "交易与武器", "trade", 3, [effect("upgrade", count=3, steps=1), effect("weapons", count=4)])
action("upgrade4", "四份交易", "trade", 3, [effect("upgrade", count=4, steps=1)])
action("mountain_double", "开采与精加工", "trade", 4, [effect("mountain", counts=[4]), effect("upgrade", count=2, steps=2)])
action("grand_trade", "山地或交易", "trade", 4, [effect("choice", options=[effect("mountain", counts=[2, 2, 2, 2]), effect("upgrade", count=3, steps=1)])])
for _n in (1, 2):
    action("overseas" + str(_n), "海外贸易", "sail", _n, [effect("overseas")], ship="knarr")
action("special_sale", "购买奇珍", "sail", 3, [effect("special_sale", count=2)], ship="knarr")
action("raid", "突袭", "sail", 1, [effect("hunt", mode="raid")], ship="longship")
for _n in (2, 3):
    action("pillage" + str(_n), "劫掠", "sail", _n, [effect("hunt", mode="pillage")], ship="longship")
action("plunder", "勒索银币窖藏", "sail", 4, [gain(hoard=1)], ship="longship", ships=2)
for _n in (1, 2, 3):
    action("explore" + str(_n), "探索" + ("近海", "北方", "美洲")[_n-1], "sail", _n, [effect("explore", tier=_n)])
action("draw_occupation", "学习职业", "occupation", 1, [effect("draw", count=1), gain(silver=1)])
action("stone_occupation", "传授职业", "occupation", 1, [effect("paid_occupation")])
action("play_two", "实践两种职业", "occupation", 2, [effect("occupation", count=2)])
action("play_four", "实践四种职业", "occupation", 3, [effect("occupation", count=4)])
for _n in (2, 3):
    action("emigrate" + str(_n), "移民", "occupation", _n, [effect("emigrate")])
action("emigrate4", "换船与移民", "occupation", 4, [effect("convert_whaler"), effect("emigrate")])


OCCUPATIONS = {}


def occupation(key: str, name: str, number: str, points: int, text: str, **effects) -> None:
    OCCUPATIONS[key] = {"name": name, "number": number, "points": points, "text": text, **effects}


# Selected, individually verified effects. Each dark card has two separately
# identified copies in this digital deck; duplicate effects stack explicitly.
occupation("tanner", "制革匠", "47a", 2, "随时用 1 腌肉(🥓) 换 1 兽皮(🟩)。", start=True, trade=exchange({"salt_meat": 1}, {"hide": 1}))
occupation("tutor", "家庭教师", "52a", 0, "随时支付 1 银币(💰)，打出一张职业(📜)。", start=True, tutor=True)
occupation("farm_shop", "农场店主", "53b", 1, "随时支付 1 银币(💰)，把一块橙色食物升为红色。", start=True, shop=True)
occupation("hunter", "熟练猎人", "153a", 2, "每次掷骰行动最多掷 4 次。", start=True, rolls=4)
occupation("lumberjack", "伐木工", "154a", 2, "每次主行动获得至少 2 木材(🌲)，额外获得 1 银币(💰)。", start=True, hook="wood2")
occupation("refuge", "移民助手", "170a", 0, "每次移民少支付 2 银币(💰)，最低为 0。", start=True, migration_discount=2)
occupation("craft_leader", "工艺主管", "8a", 1, "收入前，工艺行动格上至少有 5 名自己的工人(👷)，获得 1 鲸油(🛢️)。", start=True, hook="craft5")
occupation("clear_mind", "清醒者", "160a", 2, "宴会未食用蜂蜜酒(🍺)时，获得 1 银币(💰)，可用于本次宴会。", start=True, hook="no_mead")
occupation("peddler", "小贩", "1A", 0, "牲畜市场每次主行动的银币(💰)总价减少 1。", livestock_discount=1)
occupation("miller", "磨坊主", "7A", 3, "宴会后，库存每份谷物(🌾)给 1 银币(💰)，最多 2。", hook="grain")
occupation("milkman", "挤奶工", "10A", 1, "立即：如有绵羊(🐑)，得到牛奶(🥛)与银币(💰)各 1；如有牛(🐄)，再得到各 1。", immediate="milkman")
occupation("orient", "东方旅者", "17A", 0, "立即：把一块货物升级到同形状蓝色货物。", immediate="orient")
occupation("miner", "矿工", "22A", 1, "立即：每艘长船(🚢)获得石头(⛰️)、矿石(🔷)与银币(💰)各 1。", immediate="miner")
occupation("housekeeper", "管家", "23A", 1, "立即：每座石屋或长屋(🏠)获得 2 银币(💰)。", immediate="houses")
occupation("outfitter", "捕鲸装备商", "24A", 2, "立即：每艘商船(⛵)给 1 鲸油(🛢️)，每艘捕鲸艇(🛶)给 1 木材(🌲)。", immediate="outfitter")
occupation("fisher", "渔夫", "27A", 1, "立即：每艘捕鲸艇(🛶)给 1 鱼干(🐟)。", immediate="fisher")
occupation("arms_supplier", "武器供应商", "32A", 2, "立即：拥有 0/1/2/3 及以上长船(🚢)，抽 0/2/5/10 张武器。", immediate="arms")
occupation("breeder", "家畜繁殖师", "35A", 0, "立即：自己的绵羊(🐑)和牛(🐄)额外繁殖一次。", immediate="breed")
occupation("fruit_picker", "采果人", "43A", 0, "立即得到 1 水果(🍎)。", immediate="fruit")
occupation("farmer", "农夫", "48A", 3, "随时用 1 牛(🐄，可怀孕)换 1 珠宝(💎)。", trade=exchange({"cattle": 1}, {"jewelry": 1}))
occupation("rune_carver", "符文雕刻师", "50A", 2, "随时用 1 符文石(🗿)换 1 兽皮(🟩)。", trade=exchange({"rune": 1}, {"hide": 1}))
occupation("tradesman", "商人", "54A", 3, "随时用 1 银器(🍴)换 1 箱子(📦)或 1 丝绸(🪡)。", trades=[exchange({"silverware": 1}, {"chest": 1}), exchange({"silverware": 1}, {"silk": 1})])
occupation("archer", "弓箭手", "13B", 1, "立即得到 1 弓箭(🏹)；狩猎骰点减 1。", immediate="bow", hunt_discount=1)
occupation("oil_boiler", "炼油师", "140A", 2, "每次捕鲸成功，额外获得 1 鲸油(🛢️)。", hook="whale")
occupation("antler", "鹿角商", "143B", 2, "每次狩猎成功，额外获得 1 银币(💰)。", hook="hunt")
occupation("sled", "雪橇手", "146C", 0, "狩猎和布置陷阱的骰点减 1。", hunt_discount=1, snare_discount=1)
occupation("priest", "祭司", "149A", 1, "每次海外贸易开始前，获得 1 鲸油(🛢️)。", hook="overseas")
occupation("quarryman", "采石工", "156B", 2, "每次主行动取得至少 1 石头(⛰️)，额外获得 1 银币(💰)。", hook="stone1")
occupation("carpenter", "木工大师", "40B", 3, "木材(🌲)可像银币一样，作为单格放入石屋与长屋(🏠)。", wood_house=True)
occupation("tailor_master", "裁缝大师", "44B", 1, "随时用兽皮(🟩)、羊毛(🧶)、亚麻布(🧵)各 1 换衣服(👕)及 3 银币(💰)。", trade=exchange({"hide": 1, "wool": 1, "linen": 1}, {"clothing": 1, "silver": 3}))
occupation("pirate", "海盗", "45C", -1, "随时用 1 木材(🌲)与 6 银币(💰)换 1 宝箱(🧰)。", trade=exchange({"wood": 1, "silver": 6}, {"treasure": 1}))
occupation("stonemason", "石匠", "6B", 1, "从山地取得的每个石头(⛰️)，额外给 1 银币(💰)。", hook="mountain_stone")

CONFIG_SCHEMA = {"type": "object", "properties": {"seed": {"type": "integer"}, "rounds": {"type": "integer", "enum": [6, 7], "default": 7}}, "additionalProperties": False}
ACTION_SCHEMA = {"type": "object", "required": ["type", "revision"], "properties": {
    "type": {"type": "string"}, "revision": {"type": "integer"}, "space": {"type": "string"},
    "copy": {"type": "string"}, "index": {"type": "integer"}, "good": {"type": "string"},
    "board": {"type": "integer"}, "x": {"type": "integer"}, "y": {"type": "integer"},
    "rotation": {"type": "integer"}, "flip": {"type": "boolean"}, "wide": {"type": "boolean"},
    "ship": {"type": "string"}, "card": {"type": "string"}, "option": {"type": "string"},
    "count": {"type": "integer"}, "payment": {"type": "object"},
}, "additionalProperties": False}
