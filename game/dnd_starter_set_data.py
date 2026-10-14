"""Original Chinese text and compact online encounters for Heroes of the Borderlands.

This is an explicitly labelled adaptation, not a transcription of the box's
cards, maps, or adventures. General mechanics follow the 2024 free rules.
"""

ABILITIES = {"str": "力量", "dex": "敏捷", "con": "体质", "int": "智力", "wis": "感知", "cha": "魅力"}
SKILLS = {
    "athletics": ("运动", "str"), "acrobatics": ("体操", "dex"),
    "sleight": ("巧手", "dex"), "stealth": ("隐匿", "dex"),
    "arcana": ("奥秘", "int"), "history": ("历史", "int"),
    "investigation": ("调查", "int"), "nature": ("自然", "int"),
    "religion": ("宗教", "int"), "animal": ("驯兽", "wis"),
    "insight": ("洞悉", "wis"), "medicine": ("医药", "wis"),
    "perception": ("察觉", "wis"), "survival": ("求生", "wis"),
    "deception": ("欺瞒", "cha"), "intimidation": ("威吓", "cha"),
    "performance": ("表演", "cha"), "persuasion": ("游说", "cha"),
}
CLASSES = {
    "fighter": {"name": "战士", "emoji": "⚔️", "role": "前线 · 武器与防护", "hp": 12, "hit_die": 10, "ac": 18,
                "mods": {"str": 3, "dex": 1, "con": 2, "int": 0, "wis": 1, "cha": -1},
                "skills": ["athletics", "perception"], "saves": ["str", "con"],
                "weapons": ["longsword", "light_crossbow"], "spells": [],
                "description": "剑盾守住前线，回气恢复生命；2 级获得动作如潮。"},
    "cleric": {"name": "牧师", "emoji": "☀️", "role": "支援 · 治疗与神术", "hp": 10, "hit_die": 8, "ac": 18,
               "mods": {"str": 2, "dex": 0, "con": 2, "int": -1, "wis": 3, "cha": 1},
               "skills": ["insight", "medicine"], "saves": ["wis", "cha"],
               "weapons": ["mace", "light_crossbow"],
               "spells": ["sacred_flame", "cure_wounds", "healing_word", "guiding_bolt", "bless", "hold_person"],
               "description": "以神术治疗伙伴，也可以用圣火打击敌人。"},
    "rogue": {"name": "游荡者", "emoji": "🗡️", "role": "灵巧 · 侦察与偷袭", "hp": 10, "hit_die": 8, "ac": 14,
              "mods": {"str": -1, "dex": 3, "con": 2, "int": 1, "wis": 1, "cha": 0},
              "skills": ["stealth", "sleight", "investigation", "acrobatics"], "saves": ["dex", "int"],
              "weapons": ["shortsword", "shortbow"], "spells": [],
              "description": "每回合一次偷袭；2 级可用附赠动作疾走或撤离。隐匿由 DM 判定。"},
    "wizard": {"name": "法师", "emoji": "🔮", "role": "奥术 · 远程与控制", "hp": 8, "hit_die": 6, "ac": 12,
               "mods": {"str": -1, "dex": 2, "con": 2, "int": 3, "wis": 1, "cha": 0},
               "skills": ["arcana", "history"], "saves": ["int", "wis"],
               "weapons": ["dagger"],
               "spells": ["fire_bolt", "magic_missile", "sleep", "mage_armor", "scorching_ray", "web"],
               "description": "戏法不消耗法术位；复杂控制法术由 DM 配合裁定。"},
}
SPECIES = {
    "human": {"name": "人类", "emoji": "🧑", "text": "多才多艺的边陲旅人。资源与额外专长由 DM 按所用角色板裁定。"},
    "dwarf": {"name": "矮人", "emoji": "⛏️", "text": "坚韧：每级额外 1 点生命。毒素抗性与感官特性由 DM 裁定。"},
    "elf": {"name": "精灵", "emoji": "🍃", "text": "敏锐感官：熟练察觉。血统法术、魅惑抗性与冥想由 DM 裁定。"},
    "halfling": {"name": "半身人", "emoji": "🍀", "text": "幸运：d20 测试掷出 1 时重掷一次。其他族裔特性由 DM 裁定。"},
}
BACKGROUNDS = {
    "soldier": {"name": "士兵", "emoji": "🎖️", "skills": ["athletics", "intimidation"], "text": "曾在边境守卫商道。"},
    "acolyte": {"name": "侍僧", "emoji": "🕯️", "skills": ["insight", "religion"], "text": "为信仰和需要援助的人远行。"},
    "criminal": {"name": "罪犯", "emoji": "🗝️", "skills": ["sleight", "stealth"], "text": "熟悉暗巷，渴望重新书写自己的故事。"},
    "sage": {"name": "贤者", "emoji": "📚", "skills": ["arcana", "history"], "text": "寻找被遗忘的传说与危险的知识。"},
}
WEAPONS = {
    "longsword": {"name": "长剑", "emoji": "⚔️", "ability": "str", "dice": [1, 8], "range": 1, "long": 1},
    "mace": {"name": "硬头锤", "emoji": "🔨", "ability": "str", "dice": [1, 6], "range": 1, "long": 1},
    "shortsword": {"name": "短剑", "emoji": "🗡️", "ability": "dex", "dice": [1, 6], "range": 1, "long": 1},
    "dagger": {"name": "匕首", "emoji": "🗡️", "ability": "dex", "dice": [1, 4], "range": 1, "long": 1},
    "shortbow": {"name": "短弓", "emoji": "🏹", "ability": "dex", "dice": [1, 6], "range": 16, "long": 64},
    "light_crossbow": {"name": "轻弩", "emoji": "🏹", "ability": "dex", "dice": [1, 8], "range": 16, "long": 64},
}
SPELLS = {
    "fire_bolt": {"name": "火焰箭", "emoji": "🔥", "level": 0, "range": 24, "kind": "attack", "dice": [1, 10], "text": "远程法术攻击；命中造成 1d10 火焰伤害。"},
    "sacred_flame": {"name": "圣火术", "emoji": "✨", "level": 0, "range": 12, "kind": "save", "save": "dex", "dice": [1, 8], "text": "目标敏捷豁免；失败受到 1d8 光耀伤害。"},
    "magic_missile": {"name": "魔法飞弹", "emoji": "💫", "level": 1, "range": 24, "kind": "missile", "text": "三枚飞弹各造成 1d4+1 力场伤害。本界面集中攻击一个目标；每升一环增加一枚。"},
    "cure_wounds": {"name": "治疗伤势", "emoji": "💚", "level": 1, "range": 1, "kind": "heal", "dice": [2, 8], "text": "接触友方，恢复 2d8+感知调整值生命，每升一环增加 2d8（2024）。"},
    "healing_word": {"name": "治愈真言", "emoji": "💖", "level": 1, "range": 12, "kind": "heal", "dice": [2, 4], "bonus": True, "text": "附赠动作：恢复 2d4+感知调整值生命，每升一环增加 2d4（2024）。"},
    "guiding_bolt": {"name": "曳光弹", "emoji": "🌠", "level": 1, "range": 24, "kind": "attack", "dice": [4, 6], "text": "命中造成 4d6 光耀伤害，每升一环增加 1d6；下一次对目标的攻击有优势，至施法者下一回合结束。"},
    "scorching_ray": {"name": "灼热射线", "emoji": "☄️", "level": 2, "range": 24, "kind": "rays", "text": "三次独立法术攻击，各造成 2d6 火焰伤害。本界面集中攻击一个目标。"},
    "mage_armor": {"name": "法师护甲", "emoji": "🔷", "level": 1, "range": 0, "kind": "armor", "text": "自身护甲等级改为 13+敏捷调整值，至下次长休（线上时长适配）。"},
    "bless": {"name": "祝福术", "emoji": "🙏", "level": 1, "range": 6, "kind": "manual", "concentration": True, "text": "需要 DM 裁定：至多三名生物的攻击和豁免加 1d4，专注至多 1 分钟。这里只扣除资源并记录专注。"},
    "sleep": {"name": "睡眠术", "emoji": "💤", "level": 1, "range": 12, "kind": "manual", "concentration": True, "text": "需要 DM 裁定：2024 版小范围感知豁免、失能与第二次豁免后的昏迷；并非 2014 版的生命总量骰池。这里只记录资源与专注。"},
    "hold_person": {"name": "人类定身术", "emoji": "🕸️", "level": 2, "range": 12, "kind": "manual", "concentration": True, "text": "需要 DM 裁定：类人生物感知豁免失败则麻痹，每回合结束可再次豁免；专注至多 1 分钟。"},
    "web": {"name": "蛛网术", "emoji": "🕷️", "level": 2, "range": 12, "kind": "manual", "concentration": True, "text": "需要 DM 裁定：区域困难地形、敏捷豁免与束缚、挣脱检定；专注至多 1 小时。"},
}
# Compact enemy profiles; special abilities are deliberately left to the DM.
MONSTERS = {
    "goblin": {"name": "地精", "emoji": "👺", "hp": 7, "ac": 15, "attack": 4, "damage": [1, 6, 2], "speed": 6, "dex": 2, "range": 16},
    "wolf": {"name": "狼", "emoji": "🐺", "hp": 11, "ac": 13, "attack": 4, "damage": [2, 4, 2], "speed": 8, "dex": 2, "range": 1},
    "bandit": {"name": "强盗", "emoji": "🥷", "hp": 11, "ac": 12, "attack": 3, "damage": [1, 6, 1], "speed": 6, "dex": 1, "range": 16},
    "skeleton": {"name": "骷髅", "emoji": "💀", "hp": 13, "ac": 13, "attack": 4, "damage": [1, 6, 2], "speed": 6, "dex": 2, "range": 16},
    "hobgoblin": {"name": "大地精", "emoji": "🪖", "hp": 11, "ac": 18, "attack": 3, "damage": [1, 8, 1], "speed": 6, "dex": 1, "range": 1},
    "bugbear": {"name": "熊地精", "emoji": "👹", "hp": 27, "ac": 16, "attack": 4, "damage": [2, 8, 2], "speed": 6, "dex": 2, "range": 1},
    "ogre": {"name": "食人魔", "emoji": "🧌", "hp": 59, "ac": 11, "attack": 6, "damage": [2, 8, 4], "speed": 8, "dex": -1, "range": 1},
    "cultist": {"name": "邪教徒", "emoji": "🕯️", "hp": 9, "ac": 12, "attack": 3, "damage": [1, 6, 1], "speed": 6, "dex": 1, "range": 1},
}
REGIONS = {
    "keep": {"name": "边陲要塞", "emoji": "🏰", "tag": "交涉与补给"},
    "wild": {"name": "荒野", "emoji": "🌲", "tag": "发现与探索"},
    "caves": {"name": "混沌洞窟", "emoji": "⛰️", "tag": "危险与抉择"},
}


def _scene(name, region, emoji, text, dm, exits, enemies=(), reward=0, safe=False, terrain="field"):
    return {"name": name, "region": region, "emoji": emoji, "text": text, "dm": dm, "exits": exits,
            "enemies": list(enemies), "reward": reward, "safe": safe, "terrain": terrain}


SCENES = {
    "keep": _scene("要塞广场", "keep", "🏰", "晨钟越过城墙。商队、巡逻兵和寻求冒险的人在广场汇合，远处的荒野等待着新的足迹。",
                   "先请每位玩家介绍角色。可在酒馆获得线索，在集市补给，或直接选择荒野与洞窟。不要强制战斗；接受玩家提出的其他行动。",
                   ["tavern", "market", "trail", "caves"], safe=True, terrain="keep"),
    "tavern": _scene("酒馆里的委托", "keep", "🍺", "旅人围着炉火交换消息：道路上的商货失窃，林中传来奇怪声响，山谷里则有越来越多的火光。",
                     "这里是原创引导场景。用游说／洞悉 DC10 了解一条路线，失败也给予线索但附带代价。选择和平交涉即可解决此任务。",
                     ["keep", "trail"], reward=10, safe=True, terrain="keep"),
    "market": _scene("集市与补给站", "keep", "💰", "药剂师把红色药水排列在木架上。铁匠招呼远行者检查武器，城墙内可以安心休息。",
                     "补给使用队伍金币。每瓶治疗药水 50 金币。其他交易、道具与报酬用叙述裁定；不要隐瞒购买价格。",
                     ["keep"], safe=True, terrain="keep"),
    "trail": _scene("荒野道路", "wild", "🛤️", "车辙在泥土中拐弯。一辆无人看守的货车停在前方，草丛里偶尔传来金属碰撞的轻响。",
                    "原创遭遇：地精想抢夺货物。察觉 DC12 可发现埋伏；交涉、付出少量物资或战斗都可以解决。两名冒险者时建议减少敌人数。",
                    ["keep", "woods", "tamarack", "fens", "caves"], ["goblin", "goblin"], 20),
    "woods": _scene("林地", "wild", "🌳", "破碎的树枝指向一处空地。两只狼围着受困的小兽，队伍可以绕行、安抚，或冒险接近。",
                    "原创遭遇：驯兽 DC12 配合食物能驱散狼群。求生 DC12 可找到安全通路。不要让所有解决方式都要求杀死动物。",
                    ["trail", "tamarack"], ["wolf", "wolf"], 15, terrain="woods"),
    "tamarack": _scene("落叶松林", "wild", "🍂", "金色针叶铺满地面。烟雾在倒木之间升起，林深处有人急切地呼救。",
                       "原创遭遇：强盗守着掠来的行囊。可用威吓／游说 DC13 让他们交还物品，或展开战斗；调查 DC12 找到隐蔽补给。",
                       ["trail", "woods", "fens"], ["bandit", "bandit"], 25, terrain="woods"),
    "fens": _scene("迷雾沼泽", "wild", "🌫️", "水面泛起涟漪，旧石道断断续续通往倾斜的墓碑。雾中有什么东西正在靠近。",
                   "原创遭遇：骷髅在遗迹附近游荡。宗教 DC12 可找到封印线索，求生 DC13 可绕过危险。泥地每格消耗双倍移动。",
                   ["trail", "tamarack", "caves"], ["skeleton", "skeleton"], 25, terrain="marsh"),
    "caves": _scene("洞窟谷口", "caves", "⛰️", "峡谷两侧散布着幽深的洞口。烟、脚印与远处的争吵提示着不同的住民；你们可以选择任一条道路。",
                    "这里是选择点。先描述各洞口的线索，再让队伍决定。下面的洞窟是线上紧凑适配，不对应官方逐房间地图。可先从地精洞窟入门。",
                    ["trail", "keep", "cave_goblin", "cave_hobgoblin", "cave_ogre", "cave_bugbear", "cave_shrine"], terrain="cave"),
    "cave_goblin": _scene("地精洞窟", "caves", "👺", "简陋木障拦着洞口。里面响起紧张的争吵，几双眼睛警惕地望向你们。",
                          "原创紧凑遭遇：可谈判换回失窃货物。地精担心邻近的大地精，提供帮助可以换取情报。战斗由三名地精组成。",
                          ["caves"], ["goblin", "goblin", "goblin"], 35, terrain="cave"),
    "cave_hobgoblin": _scene("大地精岗哨", "caves", "🪖", "火盆照亮整齐的武器架。岗哨后的住民显然比外面的劫匪更有纪律。",
                             "原创紧凑遭遇：两名大地精守卫通道，可用其他洞窟的情报交涉。AC 较高，提醒玩家考虑法术、地形与撤退。",
                             ["caves"], ["hobgoblin", "hobgoblin"], 40, terrain="cave"),
    "cave_ogre": _scene("食人魔岩厅", "caves", "🧌", "沉重的脚步从岩厅传来。巨大身影把一只空桶举到眼前，似乎正在为晚餐发愁。",
                         "原创紧凑遭遇：食物、交易与绕行都比正面攻击更安全。食人魔对低等级队伍非常危险；允许撤退，不强迫交战。",
                         ["caves"], ["ogre"], 50, terrain="cave"),
    "cave_bugbear": _scene("熊地精藏身处", "caves", "👹", "厚重兽皮遮住入口，一盏油灯照亮被翻开的包裹。岩壁后传来低沉的呼吸。",
                           "原创紧凑遭遇：熊地精与一名地精守着赃物。可以交换情报或解救俘虏。特殊伏击效果需 DM 根据队伍检定另行裁定。",
                           ["caves"], ["bugbear", "goblin"], 45, terrain="cave"),
    "cave_shrine": _scene("幽暗祭坛", "caves", "🕯️", "烛火围着裂开的石坛摇曳。低语在洞中回响，地上的记号仍散发着不祥的光。",
                          "原创紧凑遭遇：两名邪教徒与一具骷髅守护仪式。宗教／奥秘 DC14 可破坏仪式或说服追随者离开。解决后可回要塞结束冒险。",
                          ["caves"], ["cultist", "cultist", "skeleton"], 60, terrain="cave"),
}
CONDITIONS = {"poisoned": "中毒", "restrained": "束缚", "prone": "倒地", "stunned": "震慑"}
