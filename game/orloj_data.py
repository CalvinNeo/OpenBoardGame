"""Orloj mechanical data. Sources, digital component adaptations: /125.md.

No publisher artwork is distributed. The workshop combinations are an explicitly
labelled digital deck; rules and all six hammer/assistant effects follow the book.
"""

BASIC = ("paint", "wood", "iron")
RESOURCES = BASIC + ("gold", "coin")
TRACKS = ("blue", "pink", "yellow")
ZODIAC = ("♒", "♓", "♈", "♉", "♊", "♋", "♌", "♍", "♎", "♏", "♐", "♑")
COLORS = ("purple", "orange", "orange", "green", "green", "purple") * 2
APOSTLES = {str(i): {"number": i, "color": COLORS[i - 1]} for i in range(1, 13)}
APOSTLE_SLOTS = [
    {"color": color, "reward": reward, "cost": BASIC[row], "row": row, "column": col}
    for row, line in enumerate((
        (("green", "recover"), ("purple", "upgrade"), ("orange", "coin"), ("green", "worker")),
        (("orange", "recover"), ("green", "coin"), ("purple", "worker"), ("orange", "upgrade")),
        (("purple", "coin"), ("orange", "worker"), ("green", "upgrade"), ("purple", "recover")),
    )) for col, (color, reward) in enumerate(line)
]


def effect(kind: str, **values) -> dict:
    return {"kind": kind, **values}


def gain(**items) -> dict:
    return effect("gain", items=items)


OUTER = (
    (effect("sculptor"),), (gain(coin=1), effect("apostle")),
    (effect("moon_painter"),), (effect("build"),),
    (effect("workshop"),), (gain(coin=1), effect("upgrade")),
) * 2
INNER = (
    (effect("produce", resource="iron"),),
    (effect("mastery", track="yellow"), effect("paid_mastery")),
    (effect("produce", resource="wood"),),
    (effect("mastery", track="blue"), effect("paid_mastery")),
    (effect("produce", resource="paint"),),
    (effect("mastery", track="pink"), effect("paid_mastery")),
) * 2
MOON = ("wood", "repair", "paint", "repair", "iron", "repair") * 2
# Twelve reward sectors, indexed with months I–XII; painter moves clockwise.
CALENDAR = (
    (effect("produce"),), (gain(gold=1, coin=1),), (effect("upgrade"),),
    (effect("recover", count=2),), (effect("moon"),), (effect("apostle"),),
    (effect("upgrade"),), (gain(gold=1),), (effect("produce"),),
    (effect("apostle"),), (effect("rooster"),), (effect("paid_mastery"),),
)
# Six interior grid intersections, clockwise, each adjacent to four cells.
HAMMER_CELLS = ((0, 1, 3, 4), (1, 2, 4, 5), (4, 5, 7, 8),
                (7, 8, 10, 11), (6, 7, 9, 10), (3, 4, 6, 7))
HAMMERS = {
    "painter": {"name": "画家之锤", "moves": [1, 1, 2]},
    "coin": {"name": "铸币之锤", "moves": [1, 2, 3]},
    "rooster": {"name": "雄鸡之锤", "moves": [1, 2, 3]},
    "moon": {"name": "月亮之锤", "moves": [1, 2, 2]},
    "mastery": {"name": "学识之锤", "moves": [1, 1, 3]},
    "apostle": {"name": "使徒之锤", "moves": [1, 2, 3]},
}
PRESETS = (
    {"hammer": "painter", "resources": {"gold": 1, "wood": 1, "paint": 1},
     "deviation": 2, "mastery": [1, 1, 1], "upgrades": 2, "rooster": 0, "apostles": []},
    {"hammer": "coin", "resources": {"coin": 2, "wood": 1, "iron": 1, "paint": 1},
     "deviation": 1, "mastery": [0, 1, 0], "upgrades": 0, "rooster": 0, "apostles": [5, 9]},
    {"hammer": "rooster", "resources": {"iron": 1, "paint": 1},
     "deviation": 1, "mastery": [2, 0, 1], "upgrades": 1, "rooster": 3, "apostles": []},
    {"hammer": "moon", "resources": {"gold": 1, "coin": 3},
     "deviation": 1, "mastery": [1, 0, 2], "upgrades": 1, "rooster": 0, "apostles": []},
)
ROOSTER_ROUNDS = {2: (4, 3, 3, 3), 3: (4, 4, 3, 3), 4: (4, 4, 4, 4)}
METRICS = ("scrolls", "apostles", "upgrades", "months", "zodiac", "workshops")
METRIC_NAMES = {"scrolls": "卷轴", "apostles": "已放使徒", "upgrades": "升级次数",
                "months": "月份工人", "zodiac": "星座工人", "workshops": "工坊"}
PRIMARY_MULTIPLIER = dict(zip(METRICS, (3, 2, 2, 3, 3, 3)))
ASSISTANTS = {
    "scholar": {"name": "学者", "text": "终局 +6 分"},
    "engineer": {"name": "工程师", "text": "每次生产或锤子升级 +1 分"},
    "master": {"name": "大师", "text": "每条 IV 级学识轨 +4 分"},
    "carver": {"name": "雕刻家", "text": "每列已完成使徒 +5 分"},
    "calendar": {"name": "历法师", "text": "每个月份上的工人 +3 分"},
    "astronomer": {"name": "天文学家", "text": "每个星座上的工人 +3 分"},
}
OBJECTIVES = {
    "purple": {"group": 0, "text": "放置 3 位紫色(🟣)使徒", "bonus": [gain(coin=2)]},
    "green": {"group": 0, "text": "放置 3 位绿色(🟢)使徒", "bonus": [effect("apostle")]},
    "orange": {"group": 0, "text": "放置 3 位橙色(🟠)使徒", "bonus": [effect("upgrade")]},
    "assistants": {"group": 1, "text": "安置 2 位助手", "bonus": [effect("any_resource", count=2)]},
    "workshops": {"group": 1, "text": "拥有 3 座工坊", "bonus": [effect("mastery"), effect("mastery")]},
    "upgrades": {"group": 1, "text": "完成 5 次生产/锤子升级", "bonus": [gain(coin=2)]},
    "mastery": {"group": 2, "text": "任一学识达到 III 级", "bonus": [effect("upgrade")]},
    "months": {"group": 2, "text": "2 月份 + 1 星座上有工人", "bonus": [effect("apostle")]},
    "zodiac": {"group": 2, "text": "2 星座 + 1 月份上有工人", "bonus": [effect("any_resource", count=2)]},
}
SCROLLS = {"apostle": [effect("apostle")], "moon": [effect("moon")],
           "painter": [effect("painter")], "rooster": [gain(coin=1), effect("rooster")],
           "upgrade": [effect("upgrade")], "build": [effect("build")]}

# Digital workshop deck. These combinations are not a transcription of all
# physical cards. Keep the ruleset label in the public catalog and Help.
WORKSHOPS = {}
_workshop_rewards = (effect("upgrade"), effect("rooster"), effect("produce"),
                     effect("mastery", track="blue", count=2),
                     effect("mastery", track="pink", count=2),
                     effect("mastery", track="yellow", count=2), gain(gold=1, coin=1))
for _r, _resource in enumerate(BASIC):
    for _i, _reward in enumerate(_workshop_rewards):
        _key = f"w{_r * 7 + _i + 1:02d}"
        WORKSHOPS[_key] = {
            "id": _key, "name": f"{('彩绘', '木雕', '铁艺')[_r]}工坊 {_i + 1}",
            "resource": _resource, "reward": [_reward],
            "assistant": [effect(("rooster", "apostle", "moon", "recover")[_i % 4],
                                 **({"count": 2} if _i % 4 == 3 else {}))],
            "left": ("apostle", "build")[(_i + _r) % 2],
            "right": ("build", "apostle")[(_i // 2 + _r) % 2],
        }

CONFIG_SCHEMA = {"type": "object", "properties": {"seed": {"type": "integer"}}, "additionalProperties": False}
ACTION_SCHEMA = {"type": "object", "required": ["type", "revision"], "properties": {
    "type": {"type": "string"}, "revision": {"type": "integer"},
    "steps": {"type": "integer"}, "rotate": {"type": "integer"}, "first": {"type": "string"},
    "slot": {"type": "integer"}, "index": {"type": "integer"}, "track": {"type": "string"},
    "resource": {"type": "string"}, "zone": {"type": "string"}, "side": {"type": "string"},
    "card": {"type": "string"}, "apostle": {"type": "integer"}, "assistant": {"type": "string"},
    "objective": {"type": "string"}, "payment": {"type": "object"}, "option": {"type": "string"},
}, "additionalProperties": False}
