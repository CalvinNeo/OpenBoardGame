"""Stage A rules and explicitly ORIGINAL prototype decks, not official card lists.

See designs/task99.md and task83.md for provenance and unavailable components.
Never remove the prototype notice without verifying the physical deck manifests.
"""

from typing import Dict

COLORS = ("red", "blue", "green", "yellow", "purple")
COLOR_ICONS = dict(zip(COLORS, ("🔴", "🔵", "🟢", "🟡", "🟣")))
FIELDS = {
    "mountain": {"name": "山地", "icon": "🏔️", "rule": "数字严格递增，相邻不同色、不同数。"},
    "cave": {"name": "洞穴", "icon": "🌒", "rule": "数字严格递减，相邻不同色、不同数。"},
    "camp": {"name": "营地", "icon": "⛺", "rule": "相邻不同色、不同数。"},
}
ETERNALS = {
    "A1": {"name": "凤凰", "icon": "🐦‍🔥", "numbers": [1], "ability": "star", "curse": "禁止数字 1", "effect": "收集三张 A 系能力牌获得一颗星。"},
    "A2": {"name": "人鱼", "icon": "🧜", "numbers": [4], "ability": "star", "curse": "禁止数字 4", "effect": "收集三张 A 系能力牌获得一颗星。"},
    "A3": {"name": "国王", "icon": "👑", "numbers": [6], "ability": "star", "curse": "禁止数字 6", "effect": "收集三张 A 系能力牌获得一颗星。"},
    "B1": {"name": "幽灵", "icon": "👻", "ability": "reveal", "numbers": [5, 7], "curse": "禁止数字 5、7", "effect": "暂时公开全员手牌；使用者结束讨论后恢复隐藏。"},
    "B2": {"name": "骷髅", "icon": "💀", "ability": "heal", "numbers": [2, 8], "curse": "禁止数字 2、8", "effect": "恢复一颗已消耗的心。"},
    "B3": {"name": "女巫", "icon": "🧙", "ability": "jewel", "curse": "禁止 Rare", "effect": "免费生成一个尚存宝石（不能选 1/5/9）。"},
    "C1": {"name": "美杜莎", "icon": "🐍", "ability": "recycle", "color": "red", "curse": "禁止红色及红绿双色", "effect": "把弃牌区一张 Rare 放回河流奖励顶。"},
    "C2": {"name": "牛头人", "icon": "🐂", "ability": "swap", "color": "blue", "curse": "禁止蓝色及蓝黄双色", "effect": "换取场地中一张牌，本牌留在原格作为 Rare。"},
    "C3": {"name": "海怪", "icon": "🐙", "ability": "retrieve", "color": "green", "curse": "禁止绿色及红绿双色", "effect": "取回河流中最多两张牌加入手牌。"},
}

# Six numbers + one Rare + one ability per deck. These are test compositions.
# The explicit manifest is deliberately separate from the rule engine.
PROTOTYPE_NUMBERS = {
    "A1": [(1, "red"), (2, "blue"), (3, "green"), (6, "yellow"), (8, "purple"), (9, "blue")],
    "A2": [(1, "green"), (3, "yellow"), (4, "blue"), (5, "red"), (7, "purple"), (8, "green")],
    "A3": [(2, "yellow"), (4, "red"), (5, "green"), (6, "purple"), (8, "blue"), (9, "yellow")],
    "B1": [(1, "blue"), (2, "green"), (4, "purple"), (5, "yellow"), (7, "red"), (9, "green")],
    "B2": [(1, "yellow"), (2, "purple"), (3, "red"), (6, "blue"), (8, "green"), (9, "purple")],
    "B3": [(2, "red"), (3, "purple"), (4, "green"), (5, "blue"), (7, "yellow"), (9, "red")],
    "C1": [(1, "red_green"), (3, "blue"), (4, "yellow"), (5, "purple"), (7, "red_green"), (8, "blue")],
    "C2": [(1, "purple"), (2, "blue_yellow"), (4, "red"), (6, "green"), (8, "blue_yellow"), (9, "red")],
    "C3": [(2, "green"), (3, "blue_yellow"), (5, "red_green"), (6, "yellow"), (7, "purple"), (9, "blue")],
}


def deck_manifest(eternal_id: str) -> list:
    """Public composition, with no instance IDs or shuffled order."""
    return [{"kind": "number", "number": number, "colors": color.split("_")}
            for number, color in PROTOTYPE_NUMBERS[eternal_id]] + [
        {"kind": "rare", "colors": []},
        {"kind": "ability", "colors": [], "ability": ETERNALS[eternal_id]["ability"], "source": eternal_id},
    ]


RECIPES = {
    "any_2": {"name": "任意 2 张", "count": 2},
    "any_3": {"name": "任意 3 张", "count": 3},
    "same_color_3": {"name": "同色 3 张", "count": 3},
    "different_color_3": {"name": "三种不同颜色", "count": 3},
    "one_or_nine": {"name": "1 或 9", "count": 1},
    "same_number_2": {"name": "同数 2 张", "count": 2},
    "same_number_3": {"name": "同数 3 张", "count": 3},
    "one_five_nine": {"name": "1 + 5 + 9 → ⭐", "count": 3},
}
STARS = {
    "jewels_1_3": "前 3 位复苏者全部获得宝石",
    "jewels_4_6": "第 4–6 位复苏者全部获得宝石",
    "all_revived": "复苏全部 9 位永恒族",
    "one_five_nine": "生成 1 / 5 / 9 宝石",
    "bottom_row": "完成下行第四圈",
    "abilities": "使用 3 张 A 系能力牌",
}
REASONS = {
    "closed": "这一行已关闭。", "full": "先完成本行复苏。", "kind": "能力牌请用 Use Ability 或放入河流。",
    "orientation": "请选择普通牌的正向或双色牌的两个方向之一。",
    "curse": "活跃诅咒禁止这张牌进入场地；仍可入河、给牌或生成宝石。",
    "same_color": "与左侧牌接触的颜色不能相同。", "same_number": "相邻数字不能相同。",
    "ascending": "山地数字必须递增，并为中间的 Rare 留出合适数字。",
    "descending": "洞穴数字必须递减，并为中间的 Rare 留出合适数字。",
}


def _action(kind: str, fields: Dict = None) -> Dict:
    fields = fields or {}
    return {"type": "object", "properties": {"type": {"const": kind}, **fields},
            "required": ["type", *fields], "additionalProperties": False}


_ID = {"type": "string", "minLength": 1, "maxLength": 128}
_ROW = {"type": "integer", "minimum": 0, "maximum": 2}
_CARDS = {"type": "array", "items": _ID, "uniqueItems": True, "maxItems": 3}
ACTION_SCHEMA = {"type": "object", "oneOf": [
    _action("choose_start", {"player_id": _ID}), _action("ready"), _action("next_round"),
    _action("place", {"card_id": _ID, "row": _ROW, "orientation": {"enum": ["normal", "rotated"]}}),
    _action("river", {"card_id": _ID}),
    _action("give", {"card_id": _ID, "target": _ID}),
    _action("generate", {"card_ids": _CARDS, "recipe": {"enum": list(RECIPES)}, "target": {"enum": list(ETERNALS)}}),
    _action("ability", {"card_id": _ID, "options": {"type": "object", "properties": {
        "recipe": {"enum": list(RECIPES)}, "target": {"enum": list(ETERNALS)}, "card_id": _ID,
        "card_ids": {**_CARDS, "maxItems": 2}, "row": _ROW,
        "slot": {"type": "integer", "minimum": 0, "maximum": 6},
    }, "additionalProperties": False}}),
    _action("revive", {"eternal_id": {"enum": list(ETERNALS)}}),
    _action("camp", {"row": _ROW}), _action("end_discussion"),
    _action("move_disc", {"disc": {"type": "integer", "minimum": 0, "maximum": 1},
                          "position": {"type": "integer", "minimum": -1, "maximum": 25},
                          "seq": {"type": "integer", "minimum": 1}}),
]}
CONFIG_SCHEMA = {"type": "object", "properties": {
    "strict_discard": {"type": "boolean"},
    "seed": {"oneOf": [{"type": "integer"}, {"type": "string", "maxLength": 80}]},
}, "additionalProperties": False}
