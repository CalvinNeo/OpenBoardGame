"""Classic Cheaty Mages card data (72 spells, 10 fighters, 8 judges).

The numerical inventory follows the original rules' card appendix, cross-checked
against the Chinese card inventory. See designs/cheaty_mages_sources.md for
edition differences and the explicit digital rulings. Descriptions are original
Chinese summaries; icons use Unicode rather than commercial artwork.
"""

from __future__ import annotations

from typing import Any


def _spell(
    card_id: str,
    name: str,
    name_zh: str,
    icon: str,
    kind: str,
    mana: int,
    power: int,
    count: int,
    *,
    forbidden: bool = False,
    effect: str = "power",
    description: str = "",
    enduring: str | None = None,
    face_up: bool = False,
) -> dict[str, Any]:
    return {
        "id": card_id,
        "name": name,
        "name_zh": name_zh,
        "icon": icon,
        "kind": kind,
        "mana": mana,
        "power": power,
        "count": count,
        "forbidden": forbidden,
        "effect": effect,
        "description": description or f"斗士强度(⚔️) {power:+d}；魔力(🔮) {mana:+d}。",
        "enduring": enduring,
        "face_up": face_up,
    }


_SPELL_ROWS = [
    _spell("cure", "Cure", "治愈", "💚", "direct", 0, 2, 4),
    _spell("healing", "Healing", "疗伤", "❤️‍🩹", "direct", 1, 4, 4),
    _spell("regeneration", "Regeneration", "再生", "🌱", "direct", 3, 3, 2),
    _spell("energy_boost", "Energy Boost", "能量激增", "🌟", "direct", 4, 6, 1),
    _spell("refresh", "Refresh", "焕然新生", "☀️", "direct", 6, 10, 1, forbidden=True),
    _spell("magic_missile", "Magic Missile", "魔法飞弹", "☄️", "direct", 0, -2, 4),
    _spell("fireball", "Fireball", "火球", "🔥", "direct", 1, -4, 4),
    _spell("lightning_bolt", "Lightning Bolt", "闪电", "⚡", "direct", 3, -3, 2),
    _spell("blizzard", "Blizzard", "暴风雪", "❄️", "direct", 4, -6, 1),
    _spell("meteor_strike", "Meteor Strike", "陨星冲击", "🌠", "direct", 6, -10, 1, forbidden=True),
    _spell("strengthen", "Strengthen", "强化", "💪", "enchant", 2, 3, 4),
    _spell("might", "Might", "神力", "🦾", "enchant", 4, 5, 4),
    _spell("haste", "Haste", "加速", "💨", "enchant", 6, 4, 2),
    _spell("power_awakening", "Power Awakening", "力量觉醒", "🐅", "enchant", 8, 8, 1),
    _spell("giant_growth", "Giant Growth", "巨化", "🗻", "enchant", 10, 12, 1, forbidden=True),
    _spell("weaken", "Weaken", "虚弱", "🥀", "enchant", 2, -3, 4),
    _spell("cripple", "Cripple", "衰竭", "🪫", "enchant", 4, -5, 4),
    _spell("slow", "Slow", "迟缓", "🐌", "enchant", 6, -4, 2),
    _spell("paralyze", "Paralyze", "麻痹", "🕸️", "enchant", 8, -8, 1),
    _spell("shrink", "Shrink", "缩小", "🐜", "enchant", 10, -12, 1, forbidden=True),
    _spell(
        "mana_boost", "Mana Boost", "魔力增幅", "🔮", "enchant", 5, 0, 2,
        effect="mana", description="魔力(🔮) +5；不改变斗士强度(⚔️)。",
    ),
    _spell(
        "mana_seal", "Mana Seal", "魔力封印", "🔒", "enchant", -5, 0, 2,
        effect="mana", description="魔力(🔮) −5；不改变斗士强度(⚔️)。",
    ),
    _spell(
        "cause_unpopularity", "Cause Unpopularity", "冷门赔率", "💰", "enchant", 3, 0, 2,
        effect="double_prize", description="目标斗士的赏金(💰)翻倍；两张各自生效。",
    ),
    _spell(
        "detect_magic", "Detect Magic", "侦测魔法", "👁️", "support", 0, 0, 2,
        effect="detect_magic", description="秘密查看一名斗士当前的全部暗置法术(🌙)。",
    ),
    _spell(
        "dispel_magic", "Dispel Magic", "驱散魔法", "🧹", "support", 0, 0, 2,
        effect="dispel_magic", description="弃置一张已在场上的法术；不能反制刚施放的即时法术。",
    ),
    _spell(
        "recall", "Recall", "回忆", "📖", "support", 0, 0, 2,
        effect="recall", description="从法术牌库抽取一张手牌。",
    ),
    _spell(
        "amnesia", "Amnesia", "遗忘", "🌀", "support", 0, 0, 2,
        effect="amnesia", description="指定一名玩家，由该玩家选择并弃置一张手牌。",
    ),
    _spell(
        "imitation", "Imitation", "偷换押注", "🎭", "support", 0, 0, 2,
        effect="imitation", description="将自己的一张押注换成未押注号码；单注时不能使用。",
    ),
    _spell(
        "dimension_door", "Dimension Door", "次元之门", "🚪", "support", 0, 0, 1,
        effect="dimension_door", description="弃置当前裁判(⚖️)及其附属法术，再抽取一位裁判。",
    ),
    _spell(
        "confusion", "Confusion", "迷惑", "💫", "support", 0, 0, 1,
        effect="confusion", enduring="judge",
        description="附于当前裁判(⚖️)，跳过其审判；更换裁判时失效，不解除禁用类别。",
    ),
    _spell(
        "invisibility", "Invisibility", "隐身", "🫥", "support", 0, 0, 1,
        effect="invisibility", enduring="player",
        description="本轮自己可以施放被裁判禁用的法术；该牌被驱散后权限消失。",
    ),
    _spell(
        "prismatic_ray", "Prismatic Ray", "棱镜光线", "🌈", "support", 0, 0, 1,
        effect="prismatic_ray", enduring="player",
        description="本轮自己可以将直接法术(☀️)暗置；不改变其类别与魔力。",
    ),
    _spell(
        "metamorphosis", "Metamorphosis", "变形", "🦋", "support", 0, 0, 1,
        forbidden=True, effect="metamorphosis",
        description="替换一名斗士，保留该号码的押注与附着法术；采用新斗士属性。",
    ),
    _spell(
        "alteration", "Alteration", "法术转移", "↪️", "support", 0, 0, 1,
        forbidden=True, effect="alteration",
        description="将一名斗士的一张法术移至另一名斗士；保留原来的明暗状态。",
    ),
    _spell(
        "anti_magic_field", "Anti-Magic Field", "反魔法领域", "🚫", "support", 0, 0, 1,
        forbidden=True, effect="anti_magic_field",
        description="弃置一名斗士的全部法术；可以穿透反射(🪞)的保护。",
    ),
    _spell(
        "reflection", "Reflection", "反射", "🪞", "enchant", 3, 0, 1,
        forbidden=True, effect="reflection", face_up=True,
        description="明置。保护斗士及其法术免受新法术影响；反射本身仍可被驱散或转移，反魔法领域例外。",
    ),
]

SPELLS: dict[str, dict[str, Any]] = {card["id"]: card for card in _SPELL_ROWS}


def _fighter(
    card_id: str, name: str, name_zh: str, icon: str, power: int, prize: int,
    *, reverse: bool = False,
) -> dict[str, Any]:
    return {
        "id": card_id, "name": name, "name_zh": name_zh, "icon": icon,
        "power": power, "prize": prize, "reverse": reverse,
        "description": (
            "亡灵：法术的强度(⚔️)加减反转，魔力(🔮)与赏金(💰)效果不变。"
            if reverse else "无特殊能力。"
        ),
    }


FIGHTERS: dict[str, dict[str, Any]] = {
    card["id"]: card
    for card in [
        _fighter("goblin", "Goblin", "哥布林", "👺", 1, 10),
        _fighter("orc", "Orc", "兽人", "🧌", 2, 8),
        _fighter("skeleton", "Skeleton", "骷髅", "💀", 3, 7, reverse=True),
        _fighter("lizardman", "Lizardman", "蜥蜴人", "🦎", 4, 6),
        _fighter("ghost", "Ghost", "幽灵", "👻", 5, 5, reverse=True),
        _fighter("succubus", "Succubus", "魅魔", "🧛", 6, 5),
        _fighter("dark_elf", "Dark Elf", "黑暗精灵", "🧝", 7, 4),
        _fighter("minotaur", "Minotaur", "牛头人", "🐂", 8, 4),
        _fighter("demon", "Demon", "恶魔", "👿", 9, 3),
        _fighter("dragon", "Dragon", "巨龙", "🐉", 10, 3),
    ]
}


def _judge(
    card_id: str, name: str, name_zh: str, icon: str, limit: int | None,
    verdict: str | None, bans: list[str], description: str,
    *, special: str | None = None,
) -> dict[str, Any]:
    return {
        "id": card_id, "name": name, "name_zh": name_zh, "icon": icon,
        "limit": limit, "verdict": verdict, "bans": bans,
        "special": special, "description": description,
    }


JUDGES: dict[str, dict[str, Any]] = {
    card["id"]: card
    for card in [
        _judge(
            "adoth", "Adoth the Severe Judgemaster", "严厉的阿德斯", "⚖️", 10,
            "eject", ["support", "forbidden"],
            "魔力(🔮)超过10的斗士退场；禁用支援(✨)与禁咒(🚫)。",
        ),
        _judge(
            "tad", "Tad the Daydreamer", "瞌睡的泰德", "😴", None, None, [],
            "不限制法术，也不执行魔力(🔮)判罚。",
        ),
        _judge(
            "ferine", "Ferine the Capricious", "善变的芬莉露", "🎲", None, None, [],
            "审判时翻一张法术：直接(☀️)为10／退场，赋予(🌙)为15／解除，支援(✨)为5／解除。",
            special="random_verdict",
        ),
        _judge(
            "zapp", "Zapp the Cheerful", "爽朗的萨普", "😊", 15, "dispel", ["forbidden"],
            "魔力(🔮)超过15时解除该斗士所有法术；禁用禁咒(🚫)。",
        ),
        _judge(
            "lawty", "Lawty the Opportunist", "投机的劳提", "🧐", 10, "dispel", [],
            "魔力(🔮)超过10时解除该斗士所有法术。",
        ),
        _judge(
            "orlair", "Orlair the Cool Beauty", "冷静的欧蕾尔", "❄️", 12, "eject", ["direct"],
            "魔力(🔮)超过12的斗士退场；禁用直接法术(☀️)。",
        ),
        _judge(
            "lester", "Lester the Show-off", "自大的理斯特", "🎩", 15, "eject", [],
            "魔力(🔮)超过15的斗士退场；魔力小于或等于4的斗士解除全部法术。",
            special="dispel_low_mana",
        ),
        _judge(
            "morla", "Morla the Devious", "狡黠的摩丽雅", "🦊", 12, "dispel", ["support"],
            "魔力(🔮)超过12时解除该斗士所有法术；禁用支援(✨)。",
        ),
    ]
}
