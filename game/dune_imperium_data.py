"""Dune: Imperium (2020), base-set mechanical data. No commercial artwork.

Sources and edition boundaries are recorded in 123.md. Text is an original
Chinese rules summary; effects, rather than display strings, drive the engine.
"""
from typing import Dict, List

FACTIONS = ("emperor", "guild", "bene", "fremen")
ICONS = (*FACTIONS, "landsraad", "city", "spice")
FACTION_NAMES = {"emperor": "皇帝", "guild": "宇航公会", "bene": "贝尼·杰瑟里特", "fremen": "弗雷曼"}
FACTION_BONUS = {"emperor": {"solari": 2}, "guild": {"solari": 3}, "bene": {"intrigue": 1}, "fremen": {"water": 1}}


def effect(kind: str, **values) -> Dict:
    return {"kind": kind, **values}


def gain(**values) -> Dict:
    return effect("gain", values=values)


def influence(faction: str = "any", amount: int = 1, **values) -> Dict:
    return effect("influence", faction=faction, amount=amount, **values)


def pay(cost: Dict, *effects: Dict) -> Dict:
    return effect("pay", cost=cost, effects=list(effects))


def choose(*options: Dict) -> Dict:
    return effect("choice", options=list(options))


def conditional(condition: str, *effects: Dict, **values) -> Dict:
    return effect("conditional", condition=condition, effects=list(effects), **values)


def card(name: str, zh: str, count: int, cost: int, icons: str = "", factions: str = "",
         agent: List[Dict] = None, reveal: List[Dict] = None, acquire: List[Dict] = None) -> Dict:
    return {"name": name, "name_zh": zh, "count": count, "cost": cost,
            "icons": icons.split(), "factions": factions.split(), "agent": agent or [],
            "reveal": reveal or [], "acquire": acquire or []}


CARDS = {
    "convincing_argument": card("Convincing Argument", "有力论据", 2, 0, reveal=[gain(persuasion=2)]),
    "dagger": card("Dagger", "匕首", 2, 0, "landsraad", reveal=[gain(swords=1)]),
    "diplomacy": card("Diplomacy", "外交", 1, 0, "emperor guild bene fremen", reveal=[gain(persuasion=1)]),
    "dune": card("Dune, the Desert Planet", "沙丘，沙漠星球", 2, 0, "spice", reveal=[gain(persuasion=1)]),
    "reconnaissance": card("Reconnaissance", "侦察", 1, 0, "city", reveal=[gain(persuasion=1)]),
    "seek_allies": card("Seek Allies", "寻求盟友", 1, 0, "emperor guild bene fremen", agent=[effect("trash_self")]),
    "signet_ring": card("Signet Ring", "家族戒指", 1, 0, "landsraad city spice", agent=[effect("ring")], reveal=[gain(persuasion=1)]),
    "arrakis_liaison": card("Arrakis Liaison", "厄拉科斯联络员", 8, 2, "city", "fremen", reveal=[gain(persuasion=2)]),
    "foldspace": card("Foldspace", "折叠空间", 6, 0, "emperor guild bene fremen landsraad city spice",
                      agent=[gain(draw=1), effect("trash_self")]),
    "spice_must_flow": card("The Spice Must Flow", "香料必须流动", 10, 9, reveal=[gain(spice=1)], acquire=[gain(vp=1)]),
    "arrakis_recruiter": card("Arrakis Recruiter", "厄拉科斯征兵官", 2, 2, "city", agent=[gain(troops=1)], reveal=[gain(persuasion=1, swords=1)]),
    "assassination_mission": card("Assassination Mission", "暗杀任务", 2, 1, reveal=[gain(swords=1, solari=1)]),
    "bene_initiate": card("Bene Gesserit Initiate", "姐妹会学徒", 2, 3, "landsraad city spice", "bene", [gain(draw=1)], [gain(persuasion=1)]),
    "bene_sister": card("Bene Gesserit Sister", "姐妹会成员", 3, 3, "landsraad bene", "bene", reveal=[choose(gain(persuasion=2), gain(swords=2))]),
    "carryall": card("Carryall", "运载机", 1, 5, "spice", agent=[effect("carryall")], reveal=[gain(persuasion=1, spice=1)]),
    "chani": card("Chani", "契妮", 1, 5, "city spice fremen", "fremen", reveal=[gain(persuasion=2), effect("retreat", amount=12)], acquire=[gain(water=1)]),
    "choam_directorship": card("CHOAM Directorship", "联合公司董事", 1, 8, reveal=[gain(solari=3)], acquire=[influence(f) for f in FACTIONS]),
    "crysknife": card("Crysknife", "晶刃匕首", 1, 3, "spice fremen", "fremen", [gain(solari=1)], [gain(swords=1), conditional("bond", influence("fremen"))]),
    "dr_yueh": card("Dr. Yueh", "岳医生", 1, 1, "city", agent=[gain(draw=1)], reveal=[gain(persuasion=1)]),
    "duncan_idaho": card("Duncan Idaho", "邓肯·艾达荷", 1, 4, "city", agent=[pay({"water": 1}, gain(troops=1, draw=1))], reveal=[gain(swords=2, water=1)]),
    "fedaykin": card("Fedaykin Death Commando", "费戴金突击队", 2, 3, "city spice", "fremen", [effect("trash")], [gain(persuasion=1), conditional("bond", gain(swords=3))]),
    "firm_grip": card("Firm Grip", "铁腕统治", 1, 4, "landsraad emperor", "emperor", [pay({"solari": 2}, influence(exclude="emperor"))], [conditional("alliance", gain(persuasion=4), faction="emperor")]),
    "fremen_camp": card("Fremen Camp", "弗雷曼营地", 2, 4, "spice", "fremen", [pay({"spice": 2}, gain(troops=3))], [gain(persuasion=2, swords=1)]),
    "gene_manipulation": card("Gene Manipulation", "基因操控", 2, 3, "landsraad city", "bene", [effect("trash"), conditional("sister", gain(spice=2))], [gain(persuasion=2)]),
    "guild_administrator": card("Guild Administrator", "公会行政官", 2, 2, "spice guild", "guild", [effect("trash")], [gain(persuasion=1)]),
    "guild_ambassador": card("Guild Ambassador", "公会大使", 1, 4, "landsraad", "guild", [choose(influence("guild"), gain(spice=2))], [conditional("alliance", pay({"spice": 3}, gain(vp=1)), faction="guild")]),
    "guild_bankers": card("Guild Bankers", "公会银行家", 1, 3, "landsraad emperor guild", "guild", reveal=[effect("discount", amount=3)]),
    "gun_thopter": card("Gun Thopter", "武装扑翼机", 2, 4, "city spice", agent=[effect("enemy_garrison")], reveal=[gain(swords=3), effect("deploy", amount=1)]),
    "gurney_halleck": card("Gurney Halleck", "格尼·哈莱克", 1, 6, "city", agent=[gain(troops=2, draw=1)], reveal=[gain(persuasion=2), pay({"solari": 3}, effect("recruit_deploy", amount=2))]),
    "imperial_spy": card("Imperial Spy", "帝国间谍", 2, 2, "emperor", "emperor", [effect("spy")], [gain(persuasion=1, swords=1)]),
    "kwisatz_haderach": card("Kwisatz Haderach", "魁萨茨·哈德拉克", 1, 8, "emperor guild bene fremen landsraad city spice", "bene", [gain(draw=1)]),
    "lady_jessica": card("Lady Jessica", "杰西卡夫人", 1, 7, "landsraad city spice bene", "bene", [gain(draw=2)], [gain(persuasion=3, swords=1)], [influence()]),
    "liet_kynes": card("Liet Kynes", "列特·凯恩斯", 1, 5, "city fremen", "emperor fremen", reveal=[effect("liet")], acquire=[influence("emperor")]),
    "missionaria": card("Missionaria Protectiva", "宗教保护团", 2, 1, "city", "bene", [conditional("sister", influence())], [gain(persuasion=1)]),
    "opulence": card("Opulence", "穷奢极欲", 1, 6, "emperor", "emperor", [gain(solari=3)], [gain(persuasion=1), pay({"solari": 6}, gain(vp=1))]),
    "other_memory": card("Other Memory", "先祖记忆", 1, 4, "city spice", "bene", [effect("memory")], [gain(persuasion=2)]),
    "piter": card("Piter De Vries", "彼得·德弗里斯", 1, 5, "landsraad city", agent=[gain(intrigue=1)], reveal=[gain(persuasion=3, swords=1)]),
    "power_play": card("Power Play", "权力博弈", 3, 5, "emperor guild bene fremen", agent=[effect("trash_self")]),
    "mohiam": card("Reverend Mother Mohiam", "圣母莫希亚姆", 1, 6, "emperor bene", "emperor bene", [conditional("sister", effect("enemy_discard", amount=2))], [gain(persuasion=2, spice=2)]),
    "sardaukar_infantry": card("Sardaukar Infantry", "萨督卡步兵", 2, 1, factions="emperor", reveal=[gain(persuasion=1, swords=2)]),
    "sardaukar_legion": card("Sardaukar Legion", "萨督卡军团", 2, 5, "landsraad emperor", "emperor", [gain(troops=2)], [gain(persuasion=1), effect("deploy", amount=3)]),
    "scout": card("Scout", "斥候", 2, 1, "city spice", reveal=[gain(persuasion=1, swords=1), effect("retreat", amount=2)]),
    "shifting_allegiances": card("Shifting Allegiances", "改换门庭", 2, 3, "landsraad spice", agent=[effect("shift")], reveal=[gain(persuasion=2)]),
    "sietch_mother": card("Sietch Reverend Mother", "穴地圣母", 1, 4, "bene fremen", "bene fremen", [effect("trash")], [conditional("bond", gain(persuasion=3)), gain(spice=1)]),
    "smugglers_thopter": card("Smuggler's Thopter", "走私扑翼机", 2, 4, "spice", "guild", [conditional("influence", gain(draw=2), faction="guild", amount=2)], [gain(persuasion=1, spice=1)]),
    "space_travel": card("Space Travel", "太空旅行", 2, 3, "guild", "guild", [gain(draw=1)], [gain(persuasion=2)]),
    "spice_hunter": card("Spice Hunter", "香料猎人", 2, 2, "spice fremen", "fremen", reveal=[gain(persuasion=1, swords=1), conditional("bond", gain(spice=1))]),
    "spice_smugglers": card("Spice Smugglers", "香料走私客", 2, 2, "city", "guild", [pay({"spice": 2}, influence("guild"), gain(solari=3))], [gain(persuasion=1, swords=1)]),
    "stilgar": card("Stilgar", "斯第尔格", 1, 5, "city spice fremen", "fremen", [gain(water=1)], [gain(persuasion=2, swords=3)]),
    "test_of_humanity": card("Test of Humanity", "人性试炼", 1, 3, "landsraad city bene", "bene", [effect("test_humanity")], [gain(persuasion=2)]),
    "the_voice": card("The Voice", "音言", 2, 2, "city spice", "bene", [effect("voice")], [gain(persuasion=2)]),
    "thufir": card("Thufir Hawat", "瑟菲尔·哈瓦特", 1, 5, "city spice emperor guild bene fremen", agent=[gain(draw=1)], reveal=[gain(persuasion=1, intrigue=1)]),
    "worm_riders": card("Worm Riders", "沙虫骑手", 2, 6, "city spice", "fremen", [gain(spice=2)], [conditional("influence", gain(swords=4), faction="fremen", amount=2), conditional("alliance", gain(swords=2), faction="fremen")]),
}
STARTER = ("convincing_argument", "dagger", "diplomacy", "dune", "reconnaissance", "seek_allies", "signet_ring")
RESERVE = ("arrakis_liaison", "foldspace", "spice_must_flow")
MARKET = tuple(k for k in CARDS if k not in STARTER + RESERVE)

# Two-player House Hagal cards: space, recruited troops, swords, copies.
# The three Arrakeen 1P cards are excluded from the 31-card physical deck.
HAGAL_CARDS = (
    ("conspire", 2, 4, 2), ("wealth", 0, 3, 1), ("heighliner", 3, 6, 1),
    ("foldspace", 0, 1, 2), ("selective_breeding", 0, 2, 2), ("secrets", 0, 1, 1),
    ("hardy_warriors", 2, 5, 1), ("stillsuits", 0, 4, 2), ("rally_troops", 4, 3, 2),
    ("hall_of_oratory", 1, 0, 2), ("carthag", 1, 0, 3), ("harvest", 0, 2, 5),
    ("arrakeen", 1, 1, 3), ("reshuffle", 0, 0, 1),
)


def space(name: str, icon: str, cost: Dict = None, effects: List[Dict] = None,
          combat: bool = False, **extra) -> Dict:
    return {"name": name, "icon": icon, "cost": cost or {}, "effects": effects or [], "combat": combat, **extra}


SPACES = {
    "conspire": space("密谋", "emperor", {"spice": 4}, [gain(solari=5, troops=2, intrigue=1)]),
    "wealth": space("财富", "emperor", effects=[gain(solari=2)]),
    "heighliner": space("太空公会运输舰", "guild", {"spice": 6}, [gain(troops=5, water=2)], True),
    "foldspace": space("折叠空间", "guild", effects=[effect("foldspace")]),
    "selective_breeding": space("选择育种", "bene", {"spice": 2}, [effect("breeding")]),
    "secrets": space("秘密", "bene", effects=[gain(intrigue=1), effect("steal")]),
    "hardy_warriors": space("坚韧战士", "fremen", {"water": 1}, [gain(troops=2)], True),
    "stillsuits": space("蒸馏服", "fremen", effects=[gain(water=1)], combat=True),
    "swordmaster": space("剑师", "landsraad", {"solari": 8}, [effect("swordmaster")]),
    "mentat": space("门塔特", "landsraad", {"solari": 2}, [gain(draw=1), effect("mentat")]),
    "high_council": space("高级议会", "landsraad", {"solari": 5}, [effect("council")]),
    "rally_troops": space("集结部队", "landsraad", {"solari": 4}, [gain(troops=4)]),
    "hall_of_oratory": space("演说大厅", "landsraad", effects=[gain(troops=1)]),
    "arrakeen": space("厄拉金", "city", effects=[gain(troops=1, draw=1)], combat=True),
    "carthag": space("迦太格", "city", effects=[gain(troops=1, intrigue=1)], combat=True),
    "research_station": space("研究站", "city", {"water": 2}, [gain(draw=3)], True),
    "sietch_tabr": space("塔布穴地", "city", effects=[gain(troops=1, water=1)], combat=True, requirement={"fremen": 2}),
    "great_flat": space("大平原", "spice", {"water": 2}, [effect("harvest", amount=3)], True, maker=True),
    "hagga_basin": space("哈加盆地", "spice", {"water": 1}, [effect("harvest", amount=2)], True, maker=True),
    "imperial_basin": space("帝国盆地", "spice", effects=[effect("harvest", amount=1)], combat=True, maker=True),
    "sell_melange": space("出售香料", "spice", effects=[]),
    "secure_contract": space("签订合同", "spice", effects=[gain(solari=3)]),
}

LEADERS = {
    "paul": {"name": "Paul Atreides", "name_zh": "保罗·厄崔迪", "passive": "预知：可查看自己的牌堆顶牌。", "ring": "抽一张牌。"},
    "leto": {"name": "Duke Leto Atreides", "name_zh": "雷托·厄崔迪公爵", "passive": "议会人望：议会格入场费少付一索拉里。", "ring": "可付一香料，在落后于对手的一个派系增加一影响力。"},
    "baron": {"name": "Baron Vladimir Harkonnen", "name_zh": "弗拉基米尔·哈克南男爵", "passive": "妙计：开局秘密选两派系，一次行动部署至少四兵后可揭示，各加一影响力；整局一次。", "ring": "可付一索拉里，抽一阴谋牌。"},
    "rabban": {"name": "Glossu Rabban", "name_zh": "野兽拉班", "passive": "厄拉科斯封地：开局额外一香料、一索拉里。", "ring": "招募一兵；拥有任何联盟则招募两兵。"},
    "helena": {"name": "Helena Richese", "name_zh": "海伦娜·里奇斯", "passive": "眼线：敌方特工不阻挡你的城市及议会格。", "ring": "可移出一张帝国行牌，保留至自己揭示回合结束，可少付一说服力购买。"},
    "ilban": {"name": "Count Ilban Richese", "name_zh": "伊尔班·里奇斯伯爵", "passive": "谈判者：支付行动格的索拉里入场费时抽一牌。", "ring": "获得一索拉里。"},
    "ariana": {"name": "Countess Ariana Thorvald", "name_zh": "阿丽亚娜·索瓦尔德女伯爵", "passive": "香料成瘾：收获产地香料时少得一香料，抽一牌。", "ring": "获得一水。"},
    "memnon": {"name": "Earl Memnon Thorvald", "name_zh": "梅姆农·索瓦尔德伯爵", "passive": "人脉：取得议会席位时增加任一派系一影响力。", "ring": "获得一香料。"},
}


def intrigue(name: str, timing: str, effects: List[Dict], count: int = 1,
             cost: Dict = None, requirement: str = "") -> Dict:
    return {"name": name, "timing": timing, "effects": effects, "count": count,
            "cost": cost or {}, "requirement": requirement}


INTRIGUES = {
    "allied_armada": intrigue("联合舰队", "combat", [gain(swords=7)], cost={"spice": 2}, requirement="alliance"),
    "ambush": intrigue("伏击", "combat", [gain(swords=4)], 2),
    "bindu": intrigue("宾度暂停", "start", [gain(draw=1), effect("bindu")]),
    "bribery": intrigue("贿赂", "plot", [influence()], cost={"solari": 2}),
    "bypass": intrigue("绕过协议", "plot", [effect("bypass")]),
    "calculated_hire": intrigue("精算雇佣", "plot", [effect("mentat")], cost={"spice": 1}, requirement="mentat"),
    "charisma": intrigue("魅力", "plot", [gain(persuasion=2)]),
    "choam_shares": intrigue("联合公司股份", "plot", [gain(vp=1)], cost={"solari": 7}),
    "corner_market": intrigue("垄断市场", "endgame", [effect("corner_market")]),
    "council_dispensation": intrigue("议会特许", "plot", [gain(spice=2)], requirement="council"),
    "demand_respect": intrigue("赢得尊重", "win", [choose(influence(), pay({"spice": 2}, influence(amount=2)))]),
    "dispatch_envoy": intrigue("派出使节", "plot", [effect("envoy")], 2),
    "double_cross": intrigue("出卖", "plot", [effect("double_cross")], cost={"solari": 1}, requirement="enemy_troop"),
    "favored_subject": intrigue("受宠臣民", "plot", [influence("emperor")]),
    "guild_authorization": intrigue("公会许可", "plot", [influence("guild")]),
    "infiltrate": intrigue("渗透", "plot", [effect("infiltrate")]),
    "know_ways": intrigue("了解习俗", "plot", [influence("fremen")]),
    "master_tactician": intrigue("战术大师", "combat", [choose(gain(swords=3), effect("retreat", amount=3))], 3),
    "plans_within_plans": intrigue("计中计", "endgame", [effect("plans")]),
    "poison_snooper": intrigue("毒物探测器", "plot", [effect("snooper")], 2),
    "private_army": intrigue("私人军队", "combat", [gain(swords=5)], 2, {"spice": 2}),
    "rapid_mobilization": intrigue("快速动员", "plot", [effect("deploy", amount=12)]),
    "recruitment_mission": intrigue("招募任务", "plot", [gain(persuasion=1), effect("recruitment")]),
    "refocus": intrigue("重新专注", "plot", [effect("refocus")]),
    "reinforcements": intrigue("增援", "plot", [effect("reinforcements", amount=3)], cost={"solari": 3}),
    "sisterhood_secret": intrigue("姐妹会秘密", "plot", [influence("bene")]),
    "staged_incident": intrigue("策划事故", "combat", [effect("staged")], requirement="three_troops"),
    "sleeper": intrigue("沉睡者必将觉醒", "plot", [gain(vp=1)], cost={"spice": 4}),
    "tiebreaker": intrigue("打破平衡", "combat_endgame", []),
    "to_the_victor": intrigue("献给胜者", "win", [gain(spice=3)]),
    "urgent_mission": intrigue("紧急任务", "plot", [effect("recall")], requirement="agent"),
    "water_of_life": intrigue("生命之水", "plot", [gain(draw=3)], cost={"water": 1, "spice": 1}),
    "water_union": intrigue("贩水者联盟", "plot", [gain(water=1)]),
    "windfall": intrigue("意外之财", "plot", [gain(solari=2)]),
}


def conflict(name: str, tier: int, first: List[Dict], second: List[Dict], third: List[Dict], control: str = "") -> Dict:
    return {"name": name, "tier": tier, "rewards": [first, second, third], "control": control}


CONFLICTS = {
    "skirmish_spice": conflict("小规模冲突 · 香料", 1, [influence(), gain(spice=1)], [gain(spice=2)], [gain(spice=1)]),
    "skirmish_intrigue": conflict("小规模冲突 · 密谋", 1, [gain(vp=1)], [gain(intrigue=1, solari=2)], [gain(solari=2)]),
    "skirmish_solari": conflict("小规模冲突 · 影响", 1, [influence(), gain(solari=2)], [gain(solari=3)], [gain(solari=2)]),
    "skirmish_water": conflict("小规模冲突 · 水", 1, [gain(vp=1)], [gain(water=1)], [gain(spice=1)]),
    "cloak_dagger": conflict("斗篷与匕首", 2, [influence(), gain(intrigue=2)], [gain(intrigue=1, spice=1)], [choose(gain(intrigue=1), gain(spice=1))]),
    "desert_power": conflict("沙漠力量", 2, [gain(vp=1, water=1)], [gain(water=1, spice=1)], [gain(spice=1)]),
    "bank_raid": conflict("公会银行突袭", 2, [gain(solari=6)], [gain(solari=4)], [gain(solari=2)]),
    "machinations": conflict("权谋", 2, [effect("two_factions")], [gain(water=1, solari=2)], [gain(water=1)]),
    "raid_stockpiles": conflict("劫掠储备", 2, [gain(intrigue=1, spice=3)], [gain(spice=2)], [gain(spice=1)]),
    "secure_basin": conflict("控制帝国盆地", 2, [gain(vp=1)], [gain(water=2)], [gain(water=1)], "imperial_basin"),
    "siege_arrakeen": conflict("围攻厄拉金", 2, [gain(vp=1)], [gain(solari=4)], [gain(solari=2)], "arrakeen"),
    "siege_carthag": conflict("围攻迦太格", 2, [gain(vp=1)], [gain(intrigue=1, spice=1)], [gain(spice=1)], "carthag"),
    "sort_chaos": conflict("乱中取利", 2, [effect("next_mentat"), gain(intrigue=1, solari=1)], [gain(intrigue=1, solari=2)], [gain(solari=2)]),
    "terrible_purpose": conflict("可怖使命", 2, [gain(vp=1), effect("trash")], [gain(water=1, spice=1)], [gain(spice=1)]),
    "battle_arrakeen": conflict("厄拉金决战", 3, [gain(vp=2)], [gain(intrigue=1, spice=2, solari=3)], [gain(intrigue=1, solari=2)], "arrakeen"),
    "battle_carthag": conflict("迦太格决战", 3, [gain(vp=2)], [gain(intrigue=1, spice=3)], [gain(spice=3)], "carthag"),
    "battle_basin": conflict("帝国盆地决战", 3, [gain(vp=2)], [gain(spice=5)], [gain(spice=3)], "imperial_basin"),
    "grand_vision": conflict("宏伟愿景", 3, [influence(amount=2), gain(intrigue=1)], [gain(intrigue=1, spice=3)], [gain(spice=3)]),
}

CONFIG_SCHEMA = {"type": "object", "properties": {"seed": {"type": "integer"}}, "additionalProperties": False}
ACTION_SCHEMA = {"type": "object", "properties": {
    "type": {"enum": ["leader", "baron", "agent", "reveal", "resolve", "choose", "buy", "intrigue", "end_turn", "pass", "next_round", "endgame_done"]},
    "leader": {"type": "string"}, "card": {"type": "string"}, "space": {"type": "string"},
    "agent": {"type": "string"}, "amount": {"type": "integer"}, "index": {"type": "integer"},
    "choice": {}, "top": {"type": "boolean"}, "factions": {"type": "array", "items": {"enum": list(FACTIONS)}},
}, "required": ["type"], "additionalProperties": False}
