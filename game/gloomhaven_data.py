"""Original encounter content using Gloomhaven's first-edition combat framework.

Ability names/text and encounters below are a compact online adaptation, not the
commercial campaign or a transcription of the printed character decks.
"""
from typing import Dict, List

ELEMENTS = ("fire", "ice", "air", "earth", "light", "dark")
CONDITIONS = ("poison", "wound", "disarm", "immobilize", "stun", "muddle", "strengthen")
CLASSES = {
    "brute": {"name": "蛮族", "icon": "🛡️", "color": "#bd7148", "hp": 10, "hand": 10, "role": "近战 · 护盾"},
    "tinkerer": {"name": "工匠", "icon": "⚙️", "color": "#bb9752", "hp": 8, "hand": 12, "role": "治疗 · 控制"},
    "spellweaver": {"name": "织法者", "icon": "🔥", "color": "#7972b3", "hp": 6, "hand": 8, "role": "远程 · 元素"},
    "scoundrel": {"name": "恶棍", "icon": "🗡️", "color": "#69936a", "hp": 8, "hand": 9, "role": "迅捷 · 剧毒"},
    "cragheart": {"name": "裂岩者", "icon": "🪨", "color": "#8f9570", "hp": 10, "hand": 11, "role": "坚韧 · 远近兼备"},
    "mindthief": {"name": "心灵窃贼", "icon": "🧠", "color": "#6f96ab", "hp": 6, "hand": 10, "role": "控制 · 强化"},
}


def effect(kind: str, value: int = 0, **extra) -> Dict:
    return {"kind": kind, "value": value, **extra}


def attack(value: int, distance: int = 1, **extra) -> Dict:
    return effect("attack", value, range=distance, **extra)


def move(value: int, **extra) -> Dict:
    return effect("move", value, **extra)


def heal(value: int, distance: int = 0) -> Dict:
    return effect("heal", value, range=distance)


# Each tuple is (Chinese name, initiative, upper effects, lower effects, metadata).
_CARD_ROWS = {
    "brute": [
        ("盾锋", 15, [attack(3)], [effect("shield", 1)], {}),
        ("长矛突刺", 27, [attack(3, pierce=2)], [move(3)], {}),
        ("横扫", 18, [attack(2, targets=2)], [move(3)], {}),
        ("震地重击", 54, [attack(5, condition="stun")], [move(2)], {"top_loss": True, "xp": 2}),
        ("战地包扎", 72, [heal(3)], [move(4)], {}),
        ("势不可挡", 61, [attack(6)], [move(3)], {"top_loss": True, "xp": 2}),
        ("穿行战线", 35, [attack(3)], [move(4, jump=True)], {"xp": 1}),
        ("守望", 10, [effect("shield", 2)], [heal(2)], {}),
        ("战利品", 87, [effect("loot", 1)], [move(4)], {}),
        ("投掷战斧", 44, [attack(3, 3)], [move(2)], {}),
    ],
    "tinkerer": [
        ("弩箭", 20, [attack(3, 3)], [move(2)], {}),
        ("急救", 19, [heal(3, 3)], [move(3)], {}),
        ("毒液弹", 47, [attack(2, 3, condition="poison")], [move(3)], {}),
        ("电击装置", 16, [attack(1, 3, condition="stun")], [move(2)], {}),
        ("修复装置", 62, [heal(4, 2)], [move(2)], {}),
        ("散射弩", 71, [attack(4, 3, targets=3)], [move(3)], {"top_loss": True, "xp": 2}),
        ("黏着弹", 36, [attack(2, 3, condition="immobilize")], [move(3)], {}),
        ("防护发生器", 26, [effect("shield", 2)], [heal(2, 2)], {}),
        ("过载射击", 76, [attack(5, 4)], [move(4)], {"top_loss": True, "xp": 2}),
        ("补给回收", 82, [effect("loot", 1)], [move(4)], {}),
        ("致盲闪光", 40, [attack(2, 3, condition="muddle")], [move(3)], {}),
        ("炽热射线", 55, [attack(3, 3, infuse="fire")], [heal(2)], {"xp": 1}),
    ],
    "spellweaver": [
        ("烈焰齐射", 69, [attack(3, 3, targets=3, infuse="fire")], [move(3)], {"top_loss": True, "xp": 2}),
        ("寒冰锁链", 21, [attack(2, 3, condition="immobilize", infuse="ice")], [move(3)], {"xp": 1}),
        ("奥术光束", 36, [attack(3, 3)], [heal(3)], {}),
        ("元素爆发", 44, [attack(3, 3, consume="fire")], [move(3)], {"xp": 1}),
        ("以太复苏", 80, [effect("recover", 0)], [move(4, jump=True)], {"top_loss": True}),
        ("流光飞行", 24, [attack(2, 4, infuse="air")], [move(4, jump=True)], {}),
        ("冰晶爆裂", 54, [attack(4, 3, targets=2, consume="ice")], [move(2)], {"top_loss": True, "xp": 2}),
        ("柔光治愈", 7, [heal(3, 3)], [effect("shield", 1)], {}),
    ],
    "scoundrel": [
        ("迅捷刺击", 6, [attack(3)], [move(5)], {}),
        ("双刃", 11, [attack(2, targets=2)], [move(4)], {}),
        ("淬毒匕首", 23, [attack(2, condition="poison")], [move(3)], {}),
        ("飞刀", 33, [attack(2, 3, targets=2)], [move(3)], {}),
        ("割裂", 40, [attack(3, condition="wound")], [move(3)], {"xp": 1}),
        ("致命伏击", 54, [attack(7)], [move(4)], {"top_loss": True, "xp": 2}),
        ("搜刮", 86, [effect("loot", 2)], [move(4)], {}),
        ("藏匿疗伤", 93, [heal(3)], [move(5)], {}),
        ("卸械", 12, [attack(2, condition="disarm")], [move(3)], {}),
    ],
    "cragheart": [
        ("石拳", 35, [attack(3)], [move(3)], {}),
        ("飞石", 57, [attack(3, 3, infuse="earth")], [move(3)], {"xp": 1}),
        ("碎石雨", 77, [attack(2, 3, targets=2)], [move(2)], {}),
        ("岩肤", 13, [effect("shield", 2)], [heal(2)], {}),
        ("大地脉动", 42, [attack(3, 3, consume="earth")], [move(3)], {"xp": 1}),
        ("崩山", 85, [attack(5, 3, targets=2)], [move(2)], {"top_loss": True, "xp": 2}),
        ("自然疗愈", 29, [heal(3, 2)], [move(3)], {}),
        ("晶石刺", 61, [attack(3, 2, pierce=2)], [move(4)], {}),
        ("地缚", 38, [attack(2, 3, condition="immobilize")], [move(2)], {}),
        ("坚毅前行", 46, [heal(4)], [move(4)], {}),
        ("寻矿", 87, [effect("loot", 1)], [move(3, jump=True)], {}),
    ],
    "mindthief": [
        ("精神刺击", 14, [attack(3)], [move(3)], {}),
        ("冰冷低语", 8, [attack(1, 3, condition="stun", infuse="ice")], [move(2)], {"xp": 1}),
        ("思想混乱", 25, [attack(2, 2, condition="muddle")], [move(4)], {}),
        ("心灵强化", 11, [effect("strengthen", 1)], [move(3)], {}),
        ("意志压制", 48, [attack(2, 3, condition="disarm")], [move(3)], {}),
        ("精神撕裂", 67, [attack(5, condition="wound")], [move(3)], {"top_loss": True, "xp": 2}),
        ("暗影潜行", 20, [attack(2, infuse="dark")], [move(4, jump=True)], {}),
        ("侵蚀意志", 39, [attack(3, consume="dark")], [heal(2)], {"xp": 1}),
        ("宁静心灵", 75, [heal(3)], [move(4)], {}),
        ("搜寻秘藏", 84, [effect("loot", 1)], [move(3)], {}),
    ],
}
CARDS: Dict[str, Dict] = {}
for class_id, rows in _CARD_ROWS.items():
    for index, (name, initiative, top, bottom, meta) in enumerate(rows):
        card_id = f"{class_id}_{index + 1}"
        CARDS[card_id] = {"id": card_id, "class_id": class_id, "name": name,
                          "initiative": initiative, "top": top, "bottom": bottom,
                          "top_loss": False, "bottom_loss": False, "xp": 0, **meta}

MONSTERS = {
    "guard": {"name": "强盗守卫", "icon": "🪓", "hp": 5, "move": 2, "attack": 2, "range": 1, "shield": 0},
    "archer": {"name": "强盗弓手", "icon": "🏹", "hp": 4, "move": 2, "attack": 2, "range": 3, "shield": 0},
    "bones": {"name": "活骸", "icon": "💀", "hp": 4, "move": 3, "attack": 1, "range": 1, "shield": 1},
}
# A small original eight-card ability deck, shared by each monster type.
MONSTER_CARDS: List[Dict] = [
    {"name": "逼近", "initiative": 50, "move": 0, "attack": 0},
    {"name": "突进", "initiative": 35, "move": 1, "attack": -1},
    {"name": "重击", "initiative": 70, "move": -1, "attack": 1},
    {"name": "猛攻", "initiative": 15, "move": 0, "attack": 0, "shuffle": True},
    {"name": "固守", "initiative": 30, "move": None, "attack": 0, "shield": 1},
    {"name": "追猎", "initiative": 65, "move": 1, "attack": 0},
    {"name": "狂怒", "initiative": 85, "move": None, "attack": 2, "shuffle": True},
    {"name": "压制", "initiative": 45, "move": 0, "attack": -1, "condition": "muddle"},
]
SCENARIOS = [
    {"id": 1, "name": "灰烬地窖", "subtitle": "穿过封门，清除地窖的强盗。", "enemy": "guard", "second": "archer",
     "obstacles": [[2, 3], [6, 0]], "traps": [[5, 1]], "difficult": [[2, 0], [7, 3]]},
    {"id": 2, "name": "遗忘墓廊", "subtitle": "深入墓廊，让游荡的活骸安息。", "enemy": "bones", "second": "bones",
     "obstacles": [[2, 0], [6, 3]], "traps": [[3, 2], [5, 1]], "difficult": [[2, 3], [6, 0]]},
    {"id": 3, "name": "碎月堡垒", "subtitle": "击败堡垒守军，结束这次远征。", "enemy": "archer", "second": "guard",
     "obstacles": [[1, 3], [7, 0]], "traps": [[5, 1], [6, 2]], "difficult": [[2, 2], [7, 3]]},
]


def build_map(scenario: int, party_size: int, difficulty: int) -> Dict:
    spec = SCENARIOS[scenario - 1]
    cells = []
    for room, columns in ((1, range(4)), (2, range(5, 9))):
        for q in columns:
            for r in range(4):
                pos = [q, r]
                terrain = ("obstacle" if pos in spec["obstacles"] else "trap" if pos in spec["traps"]
                           else "difficult" if pos in spec["difficult"] else "floor")
                cells.append({"q": q, "r": r, "room": room, "terrain": terrain, "coins": 0})
    cells.append({"q": 4, "r": 1, "room": 1, "terrain": "door", "open": False, "coins": 0})
    monsters = {}
    for room, kind in ((1, spec["enemy"]), (2, spec["second"])):
        positions = [[2, 1], [3, 3], [3, 0], [2, 2]] if room == 1 else [[6, 1], [8, 2], [7, 2], [8, 0]]
        for i in range(party_size):
            mid = f"m{room}_{i + 1}"
            elite = room == 2 and i == 0
            base = MONSTERS[kind]
            hp = base["hp"] + difficulty * 2 + (3 if elite else 0)
            monsters[mid] = {"id": mid, "kind": kind, "room": room, "number": (room - 1) * party_size + i + 1,
                             "elite": elite, "pos": positions[i], "hp": hp, "max_hp": hp,
                             "move": base["move"], "attack": base["attack"] + difficulty // 2 + int(elite),
                             "range": base["range"], "shield": base["shield"] + int(elite and kind == "guard"),
                             "round_shield": 0, "conditions": {}, "turns": 0, "dead": False}
    return {"cells": cells, "monsters": monsters}
