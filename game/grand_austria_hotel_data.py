"""Mechanical data for the 2021 base game; no commercial artwork.

Sources and scope: /122.md. Card numbers follow the publisher's appendix.
Food shorthand in the transcription is strudel/cake/wine/coffee = s/c/w/k.
"""
from collections import Counter

FOOD = ("strudel", "cake", "wine", "coffee")
COLORS = ("blue", "yellow", "red")
EMPEROR_POINTS = (0, 1, 2, 3, 3, 4, 4, 5, 6, 6, 7, 7, 8, 9)
GROUP_REWARDS = {"blue": (0, 2, 5, 9, 15), "red": (0, 1, 3, 6, 10), "yellow": (0, 1, 3, 6, 10)}
MARKET_COST = (3, 2, 1, 0, 0)
# Rows run from the ground floor upward, columns from left to right.
ROOM_GROUPS = ((0,), (1, 5, 6), (2, 3, 7, 8), (4,), (9, 13, 14),
               (10, 15), (11, 16), (12, 17), (18,), (19,))
ROOM_COLORS = ("blue", "yellow", "red", "red", "blue", "yellow", "yellow", "red", "red", "yellow",
               "blue", "red", "blue", "yellow", "yellow", "blue", "red", "blue", "red", "blue")
ROOMS = [{"id": i, "floor": i // 5, "column": i % 5, "color": color,
          "group": next(n for n, group in enumerate(ROOM_GROUPS) if i in group),
          "bonus": {13: 1, 14: 1, 17: 2, 18: 2, 19: 2}.get(i, 0)}
         for i, color in enumerate(ROOM_COLORS)]


def effect(kind: str, count: int = 1, **kwargs) -> dict:
    return {"kind": kind, "count": count, **kwargs}


def food_items(short: str) -> dict:
    counts = Counter(short)
    return {name: counts[letter] for name, letter in zip(FOOD, "scwk") if counts[letter]}


def food(short: str) -> dict:
    return effect("food", items=food_items(short))


def prepare(count: int = 1, discount: int = 0, max_floor: int = 3, occupy: bool = False) -> dict:
    return effect("prepare", count, discount=discount, max_floor=max_floor, occupy=occupy)


def hire(discount: int = 0, count: int = 1, offer: bool = False) -> dict:
    return effect("hire", count, discount=discount, offer=offer)


# number, name, cost, activation, concise original wording of the mechanism.
_STAFF = [
    (1, "Breakfast Server", 4, "round", "每轮获得一份苹果卷。"),
    (2, "Waitress", 6, "round", "每轮获得一份蛋糕。"),
    (3, "Barkeeper", 4, "round", "每轮获得一份葡萄酒。"),
    (4, "Sous-Chef", 6, "round", "每轮获得一份咖啡。"),
    (5, "Groom", 4, "permanent", "每位红色客人入住获得 2 克朗。"),
    (6, "Stableman", 1, "permanent", "每位蓝色客人入住前进 1 皇帝格。"),
    (7, "Masseuse", 1, "permanent", "每位黄色客人入住获得 1 克朗。"),
    (8, "Tour Guide", 2, "permanent", "每位绿色客人入住加 2 分。"),
    (9, "Butler", 5, "permanent", "准备蓝色房间免费。"),
    (10, "Chauffeur", 5, "permanent", "准备红色房间免费。"),
    (11, "Florist", 5, "permanent", "准备黄色房间免费。"),
    (12, "Executive Housekeeper", 2, "permanent", "取走三点或四点骰时得 2 分。"),
    (13, "Restaurant Manager", 2, "permanent", "取走一点或两点骰，行动强度加 1。"),
    (14, "Decorator", 2, "permanent", "取走一点或两点骰时，可按原价额外准备一间房。"),
    (15, "Bootblack", 4, "permanent", "取走四点骰时，每点强度同时获得克朗与皇帝进度。"),
    (16, "Laundress", 2, "permanent", "取走四点骰时得 4 分。"),
    (17, "Kitchen Hand", 5, "permanent", "六点骰无需付基础费用，强度加 1。"),
    (18, "Checker", 2, "permanent", "取走五点骰时，员工折扣额外加 2。"),
    (19, "Interior Architect", 3, "permanent", "取走三点骰时得 5 分。"),
    (20, "Detective", 2, "permanent", "取走五点骰时前进 2 皇帝格。"),
    (21, "Chef", 3, "once", "立即获得四种餐点各一份。"),
    (22, "Staff Manager", 3, "permanent", "取走三点骰时，可按原价额外雇用一位员工。"),
    (23, "Custodian", 5, "permanent", "以任何方式占用一间房时获得 1 克朗。"),
    (24, "Chief Waiter", 1, "permanent", "从厨房送餐免费。"),
    (25, "Delivery Boy", 6, "permanent", "从市场招揽客人免费。"),
    (26, "Conference Manager", 5, "permanent", "可支付 1 克朗免除本次皇帝惩罚。"),
    (27, "Booking Manager", 4, "end", "终局每间已入住房的红房加 3 分。"),
    (28, "Concierge", 4, "end", "终局每间已入住房的蓝房加 3 分。"),
    (29, "Secretary", 5, "end", "终局复制一位对手的终局员工效果，按自己的酒店计分。"),
    (30, "Reception Clerk", 4, "end", "终局每间已入住房的黄房加 3 分。"),
    (31, "Chambermaid", 4, "end", "终局每间已入住房加 1 分。"),
    (32, "Assistant Manager", 4, "end", "终局每位已雇员工（含自身）加 2 分。"),
    (33, "Male Floor Housekeeper", 5, "permanent", "订单至少四份的客人入住加 4 分。"),
    (34, "Receptionist", 5, "end", "终局每间已准备或入住房加 1 分。"),
    (35, "Page Boy", 2, "once", "立即将至多两间已准备的空房变为已入住。"),
    (36, "Sommelier", 2, "once", "立即获得四份葡萄酒。"),
    (37, "Room Service", 3, "end", "终局每组全部入住的房间加 2 分。"),
    (38, "Porter", 5, "once", "立即补齐一位客人的全部订单。"),
    (39, "Confectioner", 3, "once", "立即获得四份蛋糕。"),
    (40, "Marketing Director", 2, "end", "终局每个已认领目标加 5 分。"),
    (41, "Operator", 3, "end", "终局皇帝轨位置乘 2 计分。"),
    (42, "Gardener", 3, "permanent", "每次获得皇帝奖励加 5 分。"),
    (43, "Barista", 3, "once", "立即获得四份咖啡。"),
    (44, "Larder Cook", 2, "once", "立即获得四份苹果卷。"),
    (45, "Pool Attendant", 1, "once", "立即前进 3 皇帝格。"),
    (46, "Female Floor Housekeeper", 2, "end", "终局每个全部入住的楼层加 5 分。"),
    (47, "Liftboy", 4, "end", "终局每个全部入住的列加 5 分。"),
    (48, "Hotel Manager", 4, "end", "终局每套红、黄、蓝已入住房加 4 分。"),
]
STAFF = {str(i): {"id": str(i), "name": name, "cost": cost, "timing": timing, "text": text}
         for i, name, cost, timing, text in _STAFF}
STAFF_EFFECTS = {"1": [food("s")], "2": [food("c")], "3": [food("w")], "4": [food("k")],
                 "21": [food("scwk")], "35": [effect("occupy", 2)], "36": [food("wwww")],
                 "38": [effect("complete")], "39": [food("cccc")], "43": [food("kkkk")],
                 "44": [food("ssss")], "45": [effect("emperor", 3)]}

_GUESTS = [
    (49, "Sculptor", "w", 0, [prepare(discount=9, max_floor=1)]),
    (50, "Musician", "w", 0, [effect("draw"), prepare()]),
    (51, "Composer", "w", 1, [food("s")]),
    (52, "Tailor", "wk", 0, [food("s"), effect("money", 2)]),
    (53, "Flamenco Dancer", "sw", 0, [food("k"), effect("emperor", 2)]),
    (54, "Portrait Painter", "ww", 0, [effect("any_food"), effect("money", 2)]),
    (55, "Photographer", "www", 7, [effect("draw", 2)]),
    (56, "Vocalist", "sww", 0, [food("c"), hire(3)]),
    (57, "Architect", "wwk", 1, [prepare(2, 1)]),
    (58, "Actress", "wwwk", 7, [effect("occupy")]),
    (59, "Poet", "sssw", 5, [food("c"), hire(2)]),
    (60, "Jewelry Designer", "ccww", 5, [food("k"), effect("money", 3)]),
    (61, "Painter", "swww", 2, [prepare(discount=1), prepare()]),
    (62, "Opera Singer", "scww", 4, [effect("guest"), effect("emperor", 3)]),
    (63, "Dame", "k", 0, [effect("guest")]),
    (64, "Duchess", "k", 0, [hire(1)]),
    (65, "Knight of the Empire", "k", 3, []),
    (66, "Landgrave", "ck", 3, [hire(1), prepare()]),
    (67, "Sovereign", "kk", 2, [effect("draw", 2), effect("emperor", 2)]),
    (68, "Princess", "ssk", 4, [effect("emperor", 3)]),
    (69, "Countess", "cck", 7, [effect("money", 3)]),
    (70, "Elector", "swk", 1, [hire(1), effect("emperor", 3)]),
    (71, "Baron", "skk", 4, [prepare(discount=9)]),
    (72, "Prince", "sck", 7, [effect("occupy")]),
    (73, "Count", "wkk", 4, [hire(1, 2)]),
    (74, "Earl", "ckk", 10, [effect("money")]),
    (75, "Baroness", "wwkk", 5, [hire(3, offer=True)]),
    (76, "Duke", "sskk", 4, [hire(9, offer=True)]),
    (77, "Apothecary", "c", 1, [effect("money")]),
    (78, "Post Councillor", "c", 0, [effect("guest")]),
    (79, "Privy Councillor", "c", 0, [effect("money"), effect("emperor")]),
    (80, "Professor Emeritus", "cw", 4, [effect("guest")]),
    (81, "General", "cc", 0, [food("w"), effect("money", 3)]),
    (82, "Senior Councillor", "cwk", 7, [effect("occupy")]),
    (83, "Councillor of Commerce", "scw", 0, [effect("money", 5)]),
    (84, "Court Councillor", "ccw", 2, [effect("money", 3), effect("guest")]),
    (85, "Major", "ssc", 3, [effect("money", 3)]),
    (86, "Veterinary Councillor", "cww", 3, [hire(3)]),
    (87, "Medicinal Councillor", "cckk", 3, [effect("money", 3), effect("guest", 2)]),
    (88, "Procurator", "cwww", 0, [prepare(2, 9)]),
    (89, "Lord High Commissioner", "sscw", 5, [effect("money", 4)]),
    (90, "Senior Legal Secretary", "sccc", 7, [food("w"), effect("money", 3)]),
    (91, "Tezcatlipoca", "s", 0, [effect("draw", 3)]),
    (92, "Capt. Goldhaken", "s", 0, [effect("money")]),
    (93, "Mr. Horsa", "s", 0, [effect("emperor")]),
    (94, "M. Ingalls", "ss", 0, [hire(1)]),
    (95, "Mr. Boydell", "sc", 2, [effect("emperor", 2)]),
    (96, "Mr. Oundo", "sk", 0, [hire(3)]),
    (97, "E. Gizia", "ssw", 4, [effect("extra_die")]),
    (98, "M. Polo", "sss", 0, [effect("money", 4)]),
    (99, "Cramersopholus", "scc", 5, [effect("draw"), effect("emperor", 2)]),
    (100, "Farmer Franz", "skkk", 4, [effect("emperor", 3), effect("occupy")]),
    (101, "Brother Uwe", "sssk", 3, [effect("emperor", 3), effect("guest")]),
    (102, "Conductor", "sk", 0, [effect("emperor"), effect("occupy")]),
    (103, "Durgoing", "sw", 4, [effect("draw", 2)]),
    (104, "MacLeod", "sscc", 2, [hire(9)]),
]
GUESTS = {str(i): {"id": str(i), "name": name, "color": ("yellow", "blue", "red", "green")[(i - 49) // 14],
                  "order": food_items(order), "vp": vp, "effects": effects}
          for i, name, order, vp, effects in _GUESTS}

OBJECTIVES = {
    "105": {"category": "A", "text": "拥有 20 克朗"},
    "106": {"category": "A", "text": "皇帝轨到达 10"},
    "107": {"category": "A", "text": "雇用 6 位员工"},
    "108": {"category": "A", "text": "准备或入住 12 间房"},
    "109": {"category": "B", "text": "两个楼层全部入住"},
    "110": {"category": "B", "text": "两列房间全部入住"},
    "111": {"category": "B", "text": "六组房间全部入住"},
    "112": {"category": "B", "text": "某一种颜色的房间全部入住"},
    "113": {"category": "C", "text": "红、黄、蓝各入住至少 3 间"},
    "114": {"category": "C", "text": "入住 4 红房和 3 黄房"},
    "115": {"category": "C", "text": "入住 4 黄房和 3 蓝房"},
    "116": {"category": "C", "text": "入住 4 蓝房和 3 红房"},
}
EMPERORS = {
    "A1": {"reward": [effect("money", 3)], "penalty": "money3", "text": "+3 克朗 / 支付 3 克朗，否则 −5 分"},
    "A2": {"reward": [effect("any_food", 2)], "penalty": "kitchen", "text": "任意两份餐点 / 清空厨房"},
    "A3": {"reward": [hire(3, offer=True)], "penalty": "hand2", "text": "抽三张雇一张，优惠 3 / 退回两张手牌，否则 −5 分"},
    "A4": {"reward": [prepare(discount=9)], "penalty": "vacant1", "text": "免费准备一房 / 移除最高空房，否则 −5 分"},
    "B1": {"reward": [food("scwk")], "penalty": "all_food", "text": "四种餐点各一 / 清空厨房和客人餐点"},
    "B2": {"reward": [effect("money", 5)], "penalty": "money5", "text": "+5 克朗 / 支付 5 克朗，否则 −7 分"},
    "B3": {"reward": [hire(9, offer=True)], "penalty": "hand3", "text": "抽三张免费雇一张 / 退回三张手牌，否则 −7 分"},
    "B4": {"reward": [prepare(discount=9, max_floor=1, occupy=True)], "penalty": "vacant2", "text": "免费准备并占用底两层一房 / 移除最高两间空房，否则 −7 分"},
    "C1": {"reward": [effect("vp", 8)], "penalty": "vp8", "text": "+8 分 / −8 分"},
    "C2": {"reward": [prepare(discount=9, occupy=True)], "penalty": "occupied2", "text": "免费准备并占用一房 / 最高两个有客楼层各移除一间入住房"},
    "C3": {"reward": [effect("staff_vp", 2)], "penalty": "staff_vp", "text": "每位员工 +2 分 / 每位员工 −2 分"},
    "C4": {"reward": [hire(9)], "penalty": "end_staff", "text": "免费雇一位员工 / 弃一位终局员工，否则 −10 分"},
}

CONFIG_SCHEMA = {"type": "object", "properties": {"seed": {"type": "integer"}}, "additionalProperties": False}
ACTION_SCHEMA = {"type": "object", "required": ["type", "revision"],
                 "properties": {"type": {"type": "string"}, "revision": {"type": "integer", "minimum": 0}}}
