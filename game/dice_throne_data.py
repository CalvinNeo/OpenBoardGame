"""Playable data for Season One Rerolled and selected Season Two heroes.

This is an explicitly simplified digital adaptation, not a transcription of
printed hero boards. Hero identities and token themes were checked against
https://dice-throne.rulepop.com/#heroes (linked by the publisher's FAQ).
Ability numbers, abbreviated decks/upgrades and automatic token spending are
local rules. Every description below describes an implemented effect.
"""

RULES = {
    "max_health": 50, "starting_cp": 2, "starting_hand": 4,
    "max_hand": 6, "max_cp": 15, "roll_attempts": 3, "dice": 5,
    "first_turn_skips_income": True,
}

RULES_NOTE = (
    "数字简化版：收录第一季重制版 8 位英雄及第二季的枪手、武士、吸血鬼领主、炽天使，共 12 位；"
    "骰面分布、技能数值、精简牌组、升级和自动消耗指示物采用本页面规则，"
    "不等同于实体版逐张复刻。技能免费发动；每人使用独立牌堆。状态与伙伴按说明自动结算，"
    "未实现自由选择消耗时机、完整响应链及全部实体卡牌。第二季的血之力仅自动选择增伤或吸血，"
    "魅惑在对手确认进攻骰时检定，飞行仅自动用于防御；不包含实体版全部可选用法或被动能力。"
)


def _token(name, name_zh, icon, limit, description, positive=False, companion=False):
    return {"name": name, "name_zh": name_zh, "icon": icon, "limit": limit,
            "description": description, "positive": positive, "companion": companion}


STATUSES = {
    "stun": _token("Stun", "眩晕", "💫", 1, "下次进攻阶段跳过；随后移除此指示物。"),
    "concussion": _token("Concussion", "脑震荡", "💥", 1, "下次收入阶段跳过；随后移除此指示物。"),
    "targeted": _token("Targeted", "锁定", "🎯", 1, "下一次受到的进攻伤害 +2；随后移除此指示物。"),
    "entangle": _token("Entangle", "缠绕", "🪢", 1, "下次进攻少 1 次掷骰；随后移除此指示物。"),
    "blind": _token("Blind", "致盲", "🙈", 3, "下次发动攻击时消耗 1 枚并掷 1 骰：1–2 时攻击及其效果失效。"),
    "evasive": _token("Evasive", "闪避", "💨", 3, "受到非终极伤害时自动消耗 1 枚并掷 1 骰：1–2 时避免此次伤害。", True),
    "chi": _token("Chi", "气", "☯️", 5, "受到非终极伤害时自动消耗，每枚阻挡 1 点伤害。", True),
    "cleanse": _token("Cleanse", "净化", "✨", 3, "即将获得负面状态时自动消耗 1 枚，阻止 1 枚负面指示物；不能阻止终极技能的状态。", True),
    "knockdown": _token("Knockdown", "击倒", "⬇️", 1, "进攻开始时自动支付 2 CP 移除；不足则跳过进攻并移除。"),
    "protect": _token("Protect", "守护", "🛡️", 1, "受到非终极进攻伤害时自动消耗，阻挡一半伤害（向上取整）。", True),
    "retribution": _token("Retribution", "惩戒", "⚖️", 1, "受到非终极进攻伤害时自动消耗，反弹减伤前一半伤害（向上取整）。", True),
    "crit": _token("Crit", "暴击", "💢", 1, "下次基础伤害至少为 5 的非终极攻击自动消耗，伤害 +4。", True),
    "accuracy": _token("Accuracy", "精准", "🏹", 1, "下次普通攻击自动消耗，将该攻击变为不可防御。", True),
    "blessing": _token("Blessing of Divinity", "神佑", "🌟", 1, "生命降至 0 时自动移除并将生命设为 1；不能被卡牌移除或转移。", True),
    "fire_mastery": _token("Fire Mastery", "火焰精通", "🔥", 5, "每枚使自己的攻击伤害 +1；自己回合开始时减少 1 枚。", True),
    "burn": _token("Burn", "燃烧", "♨️", 1, "自己回合开始时受到 2 点持续伤害；此状态不会自动移除。"),
    "poison": _token("Poison", "中毒", "☠️", 3, "自己回合开始时每枚造成 1 点持续伤害；不会自动移除。"),
    "shadows": _token("Shadows", "暗影", "🌑", 1, "自动避免非终极进攻伤害；在带着此状态开始并结束自己的回合后移除。", True),
    "sneak_attack": _token("Sneak Attack", "偷袭", "🗡️", 1, "下次非终极攻击自动消耗并掷 1 骰，将点数加到伤害。", True),
    "ninjutsu": _token("Ninjutsu", "忍术", "🥷", 3, "每次非终极攻击自动消耗 1 枚并掷 1 骰：1–3 伤害 +1，4–5 +2，6 +3。", True),
    "smoke_bomb": _token("Smoke Bomb", "烟雾弹", "💭", 1, "受到非终极伤害时自动消耗并掷 1 骰：1–3 时避免此次伤害。", True),
    "delayed_poison": _token("Delayed Poison", "延迟毒素", "🧪", 2, "自己回合结束时每枚造成 3 点伤害，然后全部移除。"),
    "seedling": _token("Seedling Spirit", "幼苗精灵", "🌱", 3, "伙伴：自己下次进攻开始时自动消耗 1 个，增加 1 次掷骰。", True, True),
    "sapling": _token("Sapling Spirit", "树苗精灵", "🌿", 2, "伙伴：自己回合开始时自动消耗 1 个，治疗 2 并获得 1 CP。", True, True),
    "dryad": _token("Dryad Spirit", "树灵", "🌳", 1, "伙伴：下次非终极攻击自动消耗，伤害 +3。", True, True),
    "barbed_vine": _token("Barbed Vine", "荆棘", "🌵", 1, "下次进攻掷骰结束时，每次额外重掷造成 1 点伤害，然后移除。"),
    "wellspring": _token("Wellspring", "生命泉", "💧", 2, "自己回合开始时每枚治疗 1，然后全部移除。", True),
    "reload": _token("Reload", "装填", "🔄", 2, "下次非终极攻击自动消耗 1 枚并掷 1 骰，伤害增加点数的一半（向上取整）。", True),
    "bounty": _token("Bounty", "悬赏", "💰", 1, "每次受到非终极攻击时，该攻击伤害 +1，攻击者获得 1 CP；此状态不会自动移除。"),
    "honor": _token("Honor", "荣誉", "🏅", 2, "下次非终极攻击自动消耗全部荣誉：1 枚使伤害 +2，2 枚使伤害 +5。", True),
    "shame": _token("Shame", "耻辱", "😔", 2, "下次非终极攻击自动移除全部耻辱，每枚使攻击伤害 -1，最低为 0。"),
    "back_strike": _token("Back Strike", "反击", "↩️", 1, "受到非终极进攻伤害时自动消耗并掷 1 骰，反弹点数一半（向上取整）的伤害；在闪避和状态减伤前触发。", True),
    "blood_power": _token("Blood Power", "血之力", "🩸", 5, "非终极攻击发动时自动消耗：至少 4 枚则消耗 4 枚，结算后治疗本次实际造成的伤害；否则消耗 1 枚，使伤害 +2。", True),
    "bleed": _token("Bleed", "流血", "🩹", 2, "自己回合开始时每枚掷 1 骰：1–4 造成 1 点持续伤害；5–6 移除该枚。"),
    "mesmerize": _token("Mesmerize", "魅惑", "👁️", 1, "对手确认进攻骰时自动消耗并掷 1 骰：5–6 时重掷其点数最高的一枚（同点取最左，可影响锁定骰）；不消耗对手掷骰次数。", True),
    "flight": _token("Flight", "飞行", "🕊️", 3, "受到非终极进攻伤害时自动消耗 1 枚并掷 2 骰：有 6 则避免此次进攻伤害；不用于持续伤害或反弹。", True),
    "holy_presence": _token("Holy Presence", "神圣威仪", "🌟", 2, "自己回合开始时每枚对对手造成 1 点持续伤害；不会自动移除，可用卡牌移除。", True),
    "blinding_light": _token("Blinding Light", "炫目圣光", "🌤️", 1, "下次非终极进攻技能发动时移除并掷 1 骰：1 技能及效果失效；2–3 最终攻击伤害减半（向下取整）；4–6 无影响。"),
}


def _ability(id_, name, condition, description, damage=0, damage_type="normal",
             heal=0, self_status=None, opponent_status=None, **effects):
    return {"id": id_, "name": name, "condition": condition, "description": description,
            "damage": damage, "damage_type": damage_type, "heal": heal,
            "self_status": self_status or [], "opponent_status": opponent_status or [], **effects}


def _basic(id_, name, symbol, damage):
    return _ability(id_, name, {"counts": {symbol: 3}},
                    f"3 / 4 / 5 个对应符号：造成 {damage[0]} / {damage[1]} / {damage[2]} 点伤害。",
                    damage=damage[0], scales={symbol: damage})


BARBARIAN_ABILITIES = [
    _basic("smack", "Smack · 猛击", "sword", [4, 6, 8]),
    _ability("sturdy_blow", "Sturdy Blow · 强力打击", {"counts": {"sword": 2, "power": 2}}, "造成 4 点不可防御伤害。", 4, "undefendable"),
    _ability("mighty_blow", "Mighty Blow · 重击", {"straight": 4}, "造成 9 点伤害。", 9),
    _ability("crit_bash", "Crit Bash · 暴烈击", {"counts": {"power": 4}}, "造成 5 点不可防御伤害；施加眩晕。", 5, "undefendable", opponent_status=["stun"]),
    _ability("fortitude", "Fortitude · 坚韧", {"counts": {"heart": 3}}, "3 / 4 / 5 颗心：治疗 4 / 5 / 6。", heal=4, heal_scales={"heart": [4, 5, 6]}),
    _ability("overpower", "Overpower · 压制", {"counts": {"sword": 3, "power": 2}}, "掷 3 骰，以点数总和造成伤害；总和至少 14 时施加脑震荡。", "sum3", concussion_if=14),
    _ability("reckless", "Reckless · 鲁莽", {"straight": 5}, "造成 15 点伤害；自己同时受到 4 点反噬伤害。", 15, return_damage=4),
    _ability("rage", "Rage · 狂怒", {"counts": {"power": 5}}, "造成 15 点终极伤害；施加眩晕。", 15, "ultimate", opponent_status=["stun"]),
]
MOON_ELF_ABILITIES = [
    _basic("longbow", "Longbow · 长弓", "arrow", [4, 5, 7]),
    _ability("demising_shot", "Demising Shot · 歼灭射击", {"counts": {"arrow": 3, "moon": 2}}, "造成 4 点伤害；施加锁定（从下次攻击生效）。", 4, opponent_status=["targeted"]),
    _ability("entangling_shot", "Entangling Shot · 缠绕射击", {"straight": 4}, "造成 7 点伤害；施加缠绕。", 7, opponent_status=["entangle"]),
    _ability("eclipse", "Eclipse · 月蚀", {"counts": {"moon": 4}}, "造成 7 点伤害；施加致盲、缠绕和锁定。", 7, opponent_status=["blind", "entangle", "targeted"]),
    _ability("covered_shot", "Covered Shot · 掩护射击", {"counts": {"arrow": 2, "foot": 3}}, "造成 7 点伤害；获得闪避。", 7, self_status=["evasive"]),
    _ability("exploding_arrow", "Exploding Arrow · 爆裂箭", {"counts": {"arrow": 1, "moon": 3}}, "另掷 5 骰：基础 3 伤害，每箭或脚 +1；每月亮移除对手 1 CP；施加致盲。", 3, opponent_status=["blind"], roll_five=True),
    _ability("blinding_shot", "Blinding Shot · 致盲射击", {"straight": 5}, "造成 8 点伤害；施加致盲并获得闪避。", 8, self_status=["evasive"], opponent_status=["blind"]),
    _ability("lunar_eclipse", "Lunar Eclipse · 月全蚀", {"counts": {"moon": 5}}, "造成 12 点终极伤害；施加致盲、缠绕、锁定并获得闪避。", 12, "ultimate", self_status=["evasive"], opponent_status=["blind", "entangle", "targeted"]),
]
MONK_ABILITIES = [
    _basic("fist_strike", "Fist Strike · 拳击", "fist", [4, 6, 8]),
    _ability("meditate", "Meditate · 冥想", {"counts": {"chi_symbol": 3}}, "获得 3 气并治疗 2。", heal=2, self_status=["chi"] * 3),
    _ability("combo_strike", "Combo Strike · 连击", {"counts": {"fist": 2, "chi_symbol": 2}}, "造成 5 点伤害；获得 2 气。", 5, self_status=["chi"] * 2),
    _ability("flying_kick", "Flying Kick · 飞踢", {"straight": 4}, "造成 7 点伤害；施加击倒。", 7, opponent_status=["knockdown"]),
    _ability("purify", "Purify · 清心", {"counts": {"lotus": 3}}, "治疗 4；获得净化和闪避。", heal=4, self_status=["cleanse", "evasive"]),
    _ability("chi_burst", "Chi Burst · 气爆", {"counts": {"lotus": 4}}, "造成 7 点不可防御伤害；获得 2 气。", 7, "undefendable", self_status=["chi"] * 2),
    _ability("tempest_rush", "Tempest Rush · 疾风突袭", {"straight": 5}, "造成 10 点伤害；获得闪避。", 10, self_status=["evasive"]),
    _ability("transcendence", "Transcendence · 超凡入圣", {"counts": {"lotus": 5}}, "造成 12 点终极伤害；获得 5 气和净化。", 12, "ultimate", self_status=["chi"] * 5 + ["cleanse"]),
]
PALADIN_ABILITIES = [
    _basic("righteous_combat", "Righteous Combat · 正义之战", "sword", [4, 6, 8]),
    _ability("righteous_prayer", "Righteous Prayer · 虔诚祈祷", {"counts": {"prayer": 3}}, "获得 2 CP、暴击和守护。", gain_cp=2, self_status=["crit", "protect"]),
    _ability("holy_strike", "Holy Strike · 神圣打击", {"counts": {"sword": 2, "prayer": 2}}, "造成 5 点伤害；获得精准。", 5, self_status=["accuracy"]),
    _ability("holy_attack", "Holy Attack · 圣光冲击", {"straight": 4}, "造成 7 点伤害；获得惩戒。", 7, self_status=["retribution"]),
    _ability("divine_favor", "Divine Favor · 神恩", {"counts": {"holy": 3}}, "治疗 5；获得守护。", heal=5, self_status=["protect"]),
    _ability("avenging_light", "Avenging Light · 复仇圣光", {"counts": {"holy": 4}}, "造成 8 点不可防御伤害；获得惩戒。", 8, "undefendable", self_status=["retribution"]),
    _ability("holy_judgment", "Holy Judgment · 神圣裁决", {"straight": 5}, "造成 10 点伤害；治疗 2。", 10, heal=2),
    _ability("divine_intervention", "Divine Intervention · 神圣干预", {"counts": {"holy": 5}}, "造成 12 点终极伤害；获得神佑。", 12, "ultimate", self_status=["blessing"]),
]
PYROMANCER_ABILITIES = [
    _basic("fireball", "Fireball · 火球", "fire", [4, 6, 8]),
    _ability("fire_up", "Fire Up · 蓄焰", {"counts": {"magma": 3}}, "获得 3 火焰精通和 1 CP。", gain_cp=1, self_status=["fire_mastery"] * 3),
    _ability("combustion", "Combustion · 燃爆", {"counts": {"fire": 2, "magma": 2}}, "造成 5 点伤害；施加燃烧。", 5, opponent_status=["burn"]),
    _ability("fiery_combo", "Fiery Combo · 烈焰连击", {"straight": 4}, "造成 7 点伤害；获得 1 火焰精通。", 7, self_status=["fire_mastery"]),
    _ability("burning_soul", "Burning Soul · 燃烧之魂", {"counts": {"meteor": 3}}, "造成 5 点不可防御伤害；施加燃烧。", 5, "undefendable", opponent_status=["burn"]),
    _ability("meteorite", "Meteorite · 陨火", {"counts": {"meteor": 4}}, "造成 8 点伤害；施加击倒并获得 2 火焰精通。", 8, self_status=["fire_mastery"] * 2, opponent_status=["knockdown"]),
    _ability("pyroblast", "Pyroblast · 炎爆", {"straight": 5}, "造成 11 点伤害；施加燃烧。", 11, opponent_status=["burn"]),
    _ability("inferno", "Inferno · 炼狱", {"counts": {"meteor": 5}}, "造成 14 点终极伤害；施加燃烧、眩晕并获得 2 火焰精通。", 14, "ultimate", self_status=["fire_mastery"] * 2, opponent_status=["burn", "stun"]),
]
SHADOW_THIEF_ABILITIES = [
    _basic("dagger_strike", "Dagger Strike · 匕首突刺", "dagger", [3, 5, 7]),
    _ability("pickpocket", "Pickpocket · 妙手", {"counts": {"bag": 3}}, "获得 3 CP 并抽 1 张牌。", gain_cp=3, draw=1),
    _ability("poison_blade", "Poison Blade · 淬毒", {"counts": {"dagger": 2, "bag": 2}}, "造成 4 点伤害；施加中毒。", 4, opponent_status=["poison"]),
    _ability("shadow_dance", "Shadow Dance · 影舞", {"straight": 4}, "造成 6 点伤害；获得偷袭。", 6, self_status=["sneak_attack"]),
    _ability("insidious_strike", "Insidious Strike · 阴险一击", {"counts": {"shadow": 3}}, "造成等同当前 CP 的伤害（不消耗 CP）；施加中毒。", "cp", opponent_status=["poison"]),
    _ability("into_shadows", "Into the Shadows · 潜入暗影", {"counts": {"shadow": 4}}, "造成 6 点伤害；获得暗影并治疗 2。", 6, heal=2, self_status=["shadows"]),
    _ability("shadow_shank", "Shadow Shank · 暗影刺杀", {"straight": 5}, "造成 9 点不可防御伤害；获得 2 CP。", 9, "undefendable", gain_cp=2),
    _ability("shadow_realm", "Shadow Realm · 暗影领域", {"counts": {"shadow": 5}}, "造成 11 点终极伤害；获得暗影和偷袭；施加 2 中毒。", 11, "ultimate", self_status=["shadows", "sneak_attack"], opponent_status=["poison"] * 2),
]
TREANT_ABILITIES = [
    _basic("root_slap", "Root Slap · 根须鞭击", "branch", [4, 6, 8]),
    _ability("cultivate", "Cultivate · 培育", {"counts": {"leaf": 3}}, "获得 1 幼苗精灵和 1 树苗精灵；治疗 2。", heal=2, self_status=["seedling", "sapling"]),
    _ability("thorny_grasp", "Thorny Grasp · 荆棘缠身", {"counts": {"branch": 2, "leaf": 2}}, "造成 5 点伤害；施加荆棘。", 5, opponent_status=["barbed_vine"]),
    _ability("natures_grasp", "Nature's Grasp · 自然之握", {"straight": 4}, "造成 7 点伤害；获得 1 幼苗精灵。", 7, self_status=["seedling"]),
    _ability("verdant_growth", "Verdant Growth · 葱郁生长", {"counts": {"spirit": 3}}, "治疗 4；获得 1 树苗精灵和生命泉。", heal=4, self_status=["sapling", "wellspring"]),
    _ability("overgrowth", "Overgrowth · 茂盛", {"counts": {"spirit": 4}}, "造成 8 点伤害；获得 1 树灵并施加荆棘。", 8, self_status=["dryad"], opponent_status=["barbed_vine"]),
    _ability("ancestral_power", "Ancestral Power · 先祖之力", {"straight": 5}, "造成 10 点伤害；获得生命泉。", 10, self_status=["wellspring"]),
    _ability("forest_fury", "Forest Fury · 森林之怒", {"counts": {"spirit": 5}}, "造成 12 点终极伤害；获得幼苗精灵、树苗精灵、树灵并治疗 3。", 12, "ultimate", heal=3, self_status=["seedling", "sapling", "dryad"]),
]
NINJA_ABILITIES = [
    _basic("slash", "Slash · 斩击", "blade", [4, 6, 8]),
    _ability("shuriken", "Shuriken · 手里剑", {"counts": {"star": 3}}, "造成 4 点不可防御伤害；获得忍术。", 4, "undefendable", self_status=["ninjutsu"]),
    _ability("poisoned_edge", "Poisoned Edge · 毒刃", {"counts": {"blade": 2, "star": 2}}, "造成 5 点伤害；施加延迟毒素。", 5, opponent_status=["delayed_poison"]),
    _ability("death_blossom", "Death Blossom · 死亡之花", {"straight": 4}, "造成 7 点伤害；获得忍术。", 7, self_status=["ninjutsu"]),
    _ability("smoke_screen", "Smoke Screen · 烟幕", {"counts": {"mask": 3}}, "造成 5 点伤害；获得烟雾弹。", 5, self_status=["smoke_bomb"]),
    _ability("assassinate", "Assassinate · 暗杀", {"counts": {"mask": 4}}, "造成 8 点不可防御伤害；施加延迟毒素。", 8, "undefendable", opponent_status=["delayed_poison"]),
    _ability("walk_the_line", "Walk the Line · 生死一线", {"straight": 5}, "造成 10 点伤害；获得烟雾弹。", 10, self_status=["smoke_bomb"]),
    _ability("shadow_fang", "Shadow Fang · 影之牙", {"counts": {"mask": 5}}, "造成 13 点终极伤害；施加 2 延迟毒素并获得烟雾弹。", 13, "ultimate", self_status=["smoke_bomb"], opponent_status=["delayed_poison"] * 2),
]


GUNSLINGER_ABILITIES = [
    _basic("six_shooter", "Six Shooter · 六连发", "bullet", [4, 6, 8]),
    _ability("reload_and_aim", "Reload & Aim · 装填瞄准", {"counts": {"dash": 3}}, "获得 2 装填和 1 闪避。", self_status=["reload"] * 2 + ["evasive"]),
    _ability("bounty_hunter", "Bounty Hunter · 赏金猎人", {"counts": {"bullet": 2, "dash": 2}}, "造成 5 点伤害；施加悬赏（从下次攻击生效）。", 5, opponent_status=["bounty"]),
    _ability("quick_draw", "Quick Draw · 快速拔枪", {"straight": 4}, "造成 7 点伤害；获得装填。", 7, self_status=["reload"]),
    _ability("deadeye", "Deadeye · 神射", {"counts": {"bullseye": 3}}, "造成 5 点不可防御伤害；施加悬赏。", 5, "undefendable", opponent_status=["bounty"]),
    _ability("fan_the_hammer", "Fan the Hammer · 连珠射击", {"counts": {"bullseye": 4}}, "造成 8 点伤害；施加击倒。", 8, opponent_status=["knockdown"]),
    _ability("duel_at_dawn", "Duel at Dawn · 黎明决斗", {"straight": 5}, "造成 10 点伤害；获得闪避和装填。", 10, self_status=["evasive", "reload"]),
    _ability("dead_mans_hand", "Dead Man's Hand · 亡者之手", {"counts": {"bullseye": 5}}, "造成 12 点终极伤害；施加悬赏并获得 2 装填。", 12, "ultimate", self_status=["reload"] * 2, opponent_status=["bounty"]),
]
SAMURAI_ABILITIES = [
    _basic("katana_cut", "Katana Cut · 居合斩", "katana", [4, 6, 8]),
    _ability("bushido", "Bushido · 武士道", {"counts": {"helm": 3}}, "获得 2 荣誉和反击。", self_status=["honor"] * 2 + ["back_strike"]),
    _ability("dishonor", "Dishonor · 蒙羞", {"counts": {"katana": 2, "helm": 2}}, "造成 5 点伤害；施加 2 耻辱。", 5, opponent_status=["shame"] * 2),
    _ability("rising_sun", "Rising Sun · 旭日", {"straight": 4}, "造成 7 点伤害；获得荣誉。", 7, self_status=["honor"]),
    _ability("stand_firm", "Stand Firm · 坚守", {"counts": {"banner": 3}}, "治疗 3；获得荣誉和反击。", heal=3, self_status=["honor", "back_strike"]),
    _ability("crimson_blade", "Crimson Blade · 绯红之刃", {"counts": {"banner": 4}}, "造成 8 点不可防御伤害；施加耻辱。", 8, "undefendable", opponent_status=["shame"]),
    _ability("sword_storm", "Sword Storm · 剑岚", {"straight": 5}, "造成 10 点伤害；获得反击。", 10, self_status=["back_strike"]),
    _ability("shoguns_judgment", "Shogun's Judgment · 将军裁决", {"counts": {"banner": 5}}, "造成 13 点终极伤害；获得 2 荣誉并施加 2 耻辱。", 13, "ultimate", self_status=["honor"] * 2, opponent_status=["shame"] * 2),
]
VAMPIRE_LORD_ABILITIES = [
    _basic("rending_claws", "Rending Claws · 撕裂之爪", "fang", [4, 6, 8]),
    _ability("blood_ritual", "Blood Ritual · 血之仪式", {"counts": {"blood_symbol": 3}}, "获得 3 血之力；治疗 2。", heal=2, self_status=["blood_power"] * 3),
    _ability("hemorrhage", "Hemorrhage · 血涌", {"counts": {"fang": 2, "blood_symbol": 2}}, "造成 5 点伤害；施加流血。", 5, opponent_status=["bleed"]),
    _ability("sanguine_strike", "Sanguine Strike · 猩红打击", {"straight": 4}, "造成 7 点伤害；获得 2 血之力。", 7, self_status=["blood_power"] * 2),
    _ability("mesmerizing_gaze", "Mesmerizing Gaze · 魅惑凝视", {"counts": {"gaze": 3}}, "获得魅惑和 2 血之力；治疗 2。", heal=2, self_status=["mesmerize"] + ["blood_power"] * 2),
    _ability("night_feast", "Night Feast · 暗夜盛宴", {"counts": {"gaze": 4}}, "造成 7 点不可防御伤害；治疗 3 并施加流血。", 7, "undefendable", heal=3, opponent_status=["bleed"]),
    _ability("crimson_reign", "Crimson Reign · 猩红统治", {"straight": 5}, "造成 10 点伤害；获得 2 血之力并施加流血。", 10, self_status=["blood_power"] * 2, opponent_status=["bleed"]),
    _ability("blood_moon", "Blood Moon · 血月", {"counts": {"gaze": 5}}, "造成 12 点终极伤害；获得 4 血之力、魅惑并施加 2 流血。", 12, "ultimate", self_status=["blood_power"] * 4 + ["mesmerize"], opponent_status=["bleed"] * 2),
]
SERAPH_ABILITIES = [
    _basic("holy_blade", "Holy Blade · 圣刃", "holy_sword", [4, 6, 8]),
    _ability("ascend", "Ascend · 升空", {"counts": {"grace": 3}}, "获得 2 飞行；治疗 2。", heal=2, self_status=["flight"] * 2),
    _ability("radiant_strike", "Radiant Strike · 光辉打击", {"counts": {"holy_sword": 2, "grace": 2}}, "造成 5 点伤害；施加炫目圣光。", 5, opponent_status=["blinding_light"]),
    _ability("angelic_fury", "Angelic Fury · 天使之怒", {"straight": 4}, "造成 7 点伤害；获得神圣威仪。", 7, self_status=["holy_presence"]),
    _ability("holy_light", "Holy Light · 圣光", {"counts": {"halo": 3}}, "治疗 4；获得净化和神圣威仪。", heal=4, self_status=["cleanse", "holy_presence"]),
    _ability("judgment_ray", "Judgment Ray · 审判光束", {"counts": {"halo": 4}}, "造成 8 点不可防御伤害；施加炫目圣光。", 8, "undefendable", opponent_status=["blinding_light"]),
    _ability("heavens_wrath", "Heaven's Wrath · 天罚", {"straight": 5}, "造成 10 点伤害；获得飞行。", 10, self_status=["flight"]),
    _ability("divine_ascension", "Divine Ascension · 神圣升华", {"counts": {"halo": 5}}, "造成 12 点终极伤害；获得 2 神圣威仪、飞行并施加炫目圣光。", 12, "ultimate", self_status=["holy_presence"] * 2 + ["flight"], opponent_status=["blinding_light"]),
]


def _hero(name, name_zh, icon, subtitle, symbols, abilities, defense, season=1):
    faces, icons, names = [], {}, {}
    for key, symbol_icon, symbol_name, count in symbols:
        faces.extend([key] * count)
        icons[key], names[key] = symbol_icon, symbol_name
    return {"name": name, "name_zh": name_zh, "icon": icon, "subtitle": subtitle,
            "dice_faces": faces, "symbol_icons": icons, "symbol_names": names,
            "abilities": abilities, "defense": defense, "season": season}


def _defense(id_, name, dice, description, **effects):
    return {"id": id_, "name": name, "dice": dice, "description": description, **effects}


HEROES = {
    "barbarian": _hero("Barbarian", "野蛮人", "🪓", "强攻 · 治疗 · 眩晕", [("sword", "⚔️", "Sword · 剑", 3), ("heart", "❤️", "Heart · 心", 2), ("power", "💪", "Power · 力量", 1)], BARBARIAN_ABILITIES, _defense("thick_skin", "Thick Skin · 铜皮铁骨", 3, "每颗心治疗 2。", heal_per={"heart": 2})),
    "moon_elf": _hero("Moon Elf", "月精灵", "🌙", "远射 · 闪避 · 控制", [("arrow", "🏹", "Arrow · 箭", 3), ("foot", "👣", "Foot · 脚", 2), ("moon", "🌙", "Moon · 月亮", 1)], MOON_ELF_ABILITIES, _defense("missed_me", "Missed Me · 打不着", 5, "每 2 支箭反击 1；至少 2 只脚时阻挡一半进攻伤害（向上取整）。", return_groups={"arrow": 2}, half_if={"foot": 2})),
    "monk": _hero("Monk", "武僧", "📿", "聚气 · 减伤 · 净化", [("fist", "👊", "Fist · 拳", 3), ("chi_symbol", "☯️", "Chi · 气", 2), ("lotus", "🪷", "Lotus · 莲", 1)], MONK_ABILITIES, _defense("flowing_defense", "Flowing Defense · 行云流水", 4, "每个气符号阻挡 1；每朵莲获得 1 气；每 2 拳反击 1。", prevent_per={"chi_symbol": 1}, status_per={"lotus": "chi"}, return_groups={"fist": 2})),
    "paladin": _hero("Paladin", "圣骑士", "🛡️", "守护 · 惩戒 · 神佑", [("sword", "⚔️", "Sword · 剑", 3), ("prayer", "🙏", "Prayer · 祷告", 2), ("holy", "✝️", "Holy · 圣光", 1)], PALADIN_ABILITIES, _defense("divine_defense", "Divine Defense · 神圣防御", 3, "每次祷告阻挡 2；每个圣光治疗 1 并获得 1 CP。", prevent_per={"prayer": 2}, heal_per={"holy": 1}, cp_per={"holy": 1})),
    "pyromancer": _hero("Pyromancer", "炎术师", "🔥", "燃烧 · 蓄焰 · 爆发", [("fire", "🔥", "Fire · 火焰", 3), ("magma", "🌋", "Magma · 熔岩", 2), ("meteor", "☄️", "Meteor · 陨星", 1)], PYROMANCER_ABILITIES, _defense("hot_coals", "Hot Coals · 炽热余烬", 3, "每个火焰反击 1；每颗陨星获得 1 火焰精通。", return_per={"fire": 1}, status_per={"meteor": "fire_mastery"})),
    "shadow_thief": _hero("Shadow Thief", "影贼", "🗡️", "偷袭 · 中毒 · 暗影", [("dagger", "🗡️", "Dagger · 匕首", 3), ("bag", "💰", "Bag · 钱袋", 2), ("shadow", "🌑", "Shadow · 暗影", 1)], SHADOW_THIEF_ABILITIES, _defense("shadow_defense", "Shadow Defense · 暗影防御", 3, "每个钱袋获得 1 CP；掷出暗影时获得暗影，可立即避免本次普通进攻伤害。", cp_per={"bag": 1}, status_per={"shadow": "shadows"})),
    "treant": _hero("Treant", "树人", "🌳", "精灵伙伴 · 生长 · 恢复", [("branch", "🪵", "Branch · 枝干", 3), ("leaf", "🍃", "Leaf · 叶", 2), ("spirit", "🌳", "Spirit · 精灵", 1)], TREANT_ABILITIES, _defense("rooted", "Rooted · 扎根", 3, "每片叶子阻挡 1；每个精灵符号治疗 2 并获得 1 幼苗精灵。", prevent_per={"leaf": 1}, heal_per={"spirit": 2}, status_per={"spirit": "seedling"})),
    "ninja": _hero("Ninja", "忍者", "🥷", "忍术 · 烟雾弹 · 延迟毒素", [("blade", "⚔️", "Blade · 忍刀", 3), ("star", "✴️", "Star · 手里剑", 2), ("mask", "🥷", "Mask · 面罩", 1)], NINJA_ABILITIES, _defense("shadow_form", "Shadow Form · 影遁", 3, "每个手里剑阻挡 1；每个面罩获得烟雾弹，可立即用于本次伤害。", prevent_per={"star": 1}, status_per={"mask": "smoke_bomb"})),
    "gunslinger": _hero("Gunslinger", "枪手", "🤠", "装填 · 悬赏 · 闪避", [("bullet", "🔫", "Bullet · 子弹", 3), ("dash", "💨", "Dash · 疾行", 2), ("bullseye", "🎯", "Bullseye · 靶心", 1)], GUNSLINGER_ABILITIES, _defense("dodge_roll", "Dodge Roll · 翻滚闪避", 3, "每个疾行阻挡 1；每个靶心获得闪避，可立即用于本次伤害。", prevent_per={"dash": 1}, status_per={"bullseye": "evasive"}), season=2),
    "samurai": _hero("Samurai", "武士", "⛩️", "荣誉 · 耻辱 · 反击", [("katana", "🗡️", "Katana · 太刀", 3), ("helm", "🛡️", "Helm · 兜", 2), ("banner", "🎌", "Banner · 战旗", 1)], SAMURAI_ABILITIES, _defense("blade_guard", "Blade Guard · 刀锋守势", 3, "每顶兜阻挡 1；每面战旗获得反击，可立即用于本次进攻。", prevent_per={"helm": 1}, status_per={"banner": "back_strike"}), season=2),
    "vampire_lord": _hero("Vampire Lord", "吸血鬼领主", "🧛", "血之力 · 流血 · 魅惑", [("fang", "🦷", "Fang · 尖牙", 3), ("blood_symbol", "🩸", "Blood · 鲜血", 2), ("gaze", "👁️", "Gaze · 凝视", 1)], VAMPIRE_LORD_ABILITIES, _defense("blood_ward", "Blood Ward · 血之守护", 3, "每个鲜血阻挡 1；每个凝视治疗 1 并获得 1 血之力。", prevent_per={"blood_symbol": 1}, heal_per={"gaze": 1}, status_per={"gaze": "blood_power"}), season=2),
    "seraph": _hero("Seraph", "炽天使", "👼", "飞行 · 圣光 · 神圣威仪", [("holy_sword", "⚔️", "Holy Sword · 圣剑", 3), ("grace", "✨", "Grace · 恩典", 2), ("halo", "😇", "Halo · 光环", 1)], SERAPH_ABILITIES, _defense("celestial_guard", "Celestial Guard · 天界守护", 3, "每个恩典阻挡 1；每个光环获得飞行，可立即用于本次进攻。", prevent_per={"grace": 1}, status_per={"halo": "flight"}), season=2),
}

CARDS = {}


def _card(cid, name, cost, timing, target, description, effect, hero=None, inputs=None, **data):
    CARDS[cid] = {"cardid": cid, "name": name, "cost": cost, "timing": timing,
                  "target": target, "description": description, "effect": effect,
                  "hero": hero, "copies": 1, "inputs": inputs or [], **data}


_card("getting_paid", "Getting Paid! · 发薪", 0, "instant", "self", "获得 2 CP。", "gain", gain_cp=2)
_card("double_up", "Double Up! · 双倍收获", 1, "instant", "self", "抽 2 张牌；手牌最多 6 张。", "gain", draw=2)
_card("triple_up", "Triple Up! · 三倍收获", 2, "instant", "self", "抽 3 张牌；手牌最多 6 张。", "gain", draw=3)
_card("vegas_baby", "Vegas Baby! · 赌一把", 0, "main", "self", "掷 1 骰；获得点数一半的 CP（向上取整）。", "vegas")
_card("what_status", "What Status Effects? · 状态清零", 2, "main", "any_player", "移除所选玩家的所有可移除状态（不影响伙伴或神佑）。", "clean_all")
_card("get_outta_here", "Get That Outta Here! · 移除状态", 1, "main", "any_player", "移除所选玩家的 1 枚指定状态（不影响伙伴或神佑）。", "clean_one", inputs=["status"])
_card("bye_bye", "Bye, Bye! · 再见", 2, "instant", "any_player", "移除所选玩家的 1 枚指定状态（不影响伙伴或神佑）。", "clean_one", inputs=["status"])
_card("six_it", "Six-It! · 指定六点", 1, "roll", "self", "将自己选中的进攻骰改为 6。", "set_die", inputs=["die"], fixed_value=6)
_card("so_wild", "So Wild! · 任意骰", 2, "roll", "self", "将自己选中的进攻骰改为指定点数。", "set_die", inputs=["die", "value"])
_card("tip_it", "Tip It! · 推一把", 1, "roll", "self", "将自己选中的进攻骰提高或降低 1 点（范围 1–6）。", "tip_die", inputs=["die", "value"])
_card("try_try_again", "Try, Try Again! · 再试一次", 1, "roll", "self", "重掷自己选中的 1 枚进攻骰，不消耗掷骰次数。", "reroll_die", inputs=["die"])
_card("samesies", "Samesies! · 一模一样", 1, "roll", "self", "将选中的进攻骰改为另一枚自己骰子的点数。", "copy_die", inputs=["die", "source_die"])
_card("one_more_time", "One More Time! · 再来一轮", 1, "roll", "self", "增加 1 次进攻掷骰机会（本回合最多 5 次）。", "extra_roll")
_card("not_this_time", "Not This Time! · 休想", 1, "defense", "self", "阻挡本次进攻的 6 点伤害；不能阻挡终极伤害。", "prevent", prevent=6)

_HERO_ACTIONS = {
    "barbarian": [("concuss", "Concuss · 脑震荡", 1, "opponent", {"opponent_status": ["concussion"]}, "施加脑震荡。"), ("feelin_good", "Feelin' Good · 精神焕发", 1, "self", {"heal": 4}, "治疗 4。")],
    "moon_elf": [("moon_magic", "Moon Magic · 月之魔法", 2, "opponent", {"self_status": ["evasive"], "opponent_status": ["blind", "entangle", "targeted"]}, "获得闪避；施加致盲、缠绕和锁定。"), ("elven_grace", "Elven Grace · 精灵之赐", 1, "self", {"self_status": ["evasive"] * 2}, "获得 2 闪避。")],
    "monk": [("center_yourself", "Center Yourself · 凝神", 1, "self", {"self_status": ["chi"] * 3}, "获得 3 气。"), ("clear_mind", "Clear Mind · 明心", 1, "self", {"heal": 2, "self_status": ["cleanse"]}, "治疗 2 并获得净化。")],
    "paladin": [("absolution", "Absolution · 赦免", 1, "self", {"self_status": ["protect"]}, "获得守护。"), ("divine_blessing", "Divine Blessing · 神圣祝福", 2, "self", {"self_status": ["accuracy", "crit"]}, "获得精准和暴击。")],
    "pyromancer": [("fan_the_flames", "Fan the Flames · 煽风点火", 1, "self", {"self_status": ["fire_mastery"] * 2}, "获得 2 火焰精通。"), ("ignite", "Ignite · 点燃", 1, "opponent", {"opponent_status": ["burn"]}, "施加燃烧。")],
    "shadow_thief": [("poison_tip", "Poison Tip · 毒药", 1, "opponent", {"opponent_status": ["poison"]}, "施加中毒。"), ("cloak_and_dagger", "Cloak and Dagger · 斗篷与匕首", 2, "self", {"self_status": ["shadows", "sneak_attack"]}, "获得暗影和偷袭。")],
    "treant": [("new_growth", "New Growth · 新芽", 1, "self", {"self_status": ["seedling", "sapling"]}, "获得幼苗精灵和树苗精灵。"), ("ancient_spirit", "Ancient Spirit · 古老树灵", 2, "self", {"self_status": ["dryad", "wellspring"]}, "获得树灵和生命泉。")],
    "ninja": [("smoke_and_mirrors", "Smoke and Mirrors · 镜花水月", 1, "self", {"self_status": ["smoke_bomb"]}, "获得烟雾弹。"), ("deadly_art", "Deadly Art · 致命忍术", 1, "self", {"self_status": ["ninjutsu"] * 2}, "获得 2 忍术。")],
    "gunslinger": [("powder_reserve", "Powder Reserve · 弹药储备", 1, "self", {"self_status": ["reload"] * 2}, "获得 2 装填。"), ("wanted_poster", "Wanted Poster · 通缉令", 1, "opponent", {"opponent_status": ["bounty"]}, "施加悬赏。")],
    "samurai": [("code_of_honor", "Code of Honor · 荣誉准则", 1, "self", {"self_status": ["honor"] * 2}, "获得 2 荣誉。"), ("disgrace", "Disgrace · 奇耻大辱", 1, "opponent", {"opponent_status": ["shame"] * 2}, "施加 2 耻辱。")],
    "vampire_lord": [("blood_reserve", "Blood Reserve · 血能储备", 1, "self", {"self_status": ["blood_power"] * 3}, "获得 3 血之力。"), ("mesmerism", "Mesmerism · 催眠术", 1, "self", {"self_status": ["mesmerize"]}, "获得魅惑。")],
    "seraph": [("wings_of_light", "Wings of Light · 光之翼", 1, "self", {"self_status": ["flight"] * 2}, "获得 2 飞行。"), ("sacred_presence", "Sacred Presence · 神圣降临", 2, "self", {"self_status": ["holy_presence"], "heal": 2}, "获得神圣威仪并治疗 2。")],
}
for hero, actions in _HERO_ACTIONS.items():
    for sid, name, cost, target, effects, description in actions:
        _card(f"{hero}_{sid}", name, cost, "main", target, description, "gain", hero=hero, **effects)
    for ability in HEROES[hero]["abilities"]:
        if ability["damage_type"] == "ultimate":
            continue
        for level in (2, 3):
            _card(f"{hero}_{ability['id']}_{level}", f"{ability['name']} {level}", level,
                  "main", "self", f"将此技能提升到 {level} 级：每级使基础伤害或治疗 +1；纯资源技能每级额外获得 1 CP。",
                  "upgrade", hero=hero, ability=ability["id"], level=level)

DECKS = {hero: [cid for cid, card in CARDS.items() if card["hero"] in (None, hero)] for hero in HEROES}
