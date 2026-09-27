"""Challengers! base-box card facts; UI text and symbols are locally authored.

Sources and scope are recorded in 124.md. Starter copies retain level S even
when their names also occur in the A/B/C market (relevant to Vampire).
"""

from typing import Dict


SETS = {
    "city": {"name": "城市", "icon": "🏙️", "color": "#24869b"},
    "castle": {"name": "城堡", "icon": "🏰", "color": "#3675aa"},
    "studio": {"name": "电影片场", "icon": "🎬", "color": "#528536"},
    "funfair": {"name": "游乐园", "icon": "🎡", "color": "#ac7509"},
    "haunted": {"name": "鬼屋", "icon": "👻", "color": "#c56525"},
    "space": {"name": "外太空", "icon": "🪐", "color": "#c1464d"},
    "shipwreck": {"name": "沉船", "icon": "⚓", "color": "#8b479c"},
    "robot": {"name": "Robot", "icon": "🤖", "color": "#687383"},
}

# id, English name, Chinese name, base power, level, copies, effect, icon, summary
_ROWS = {
    "city": [
        ("newcomer", "Newcomer", "新人", 1, "S", 0, "none", "👋", "无特殊能力。"),
        ("reporter", "Reporter", "记者", 2, "A", 4, "reporter", "🎤", "看牌顶两张：一张放牌顶，另一张放牌底。"),
        ("talent", "Talent", "天才", 2, "A", 3, "none", "🌟", "无特殊能力。"),
        ("mascot", "Mascot", "吉祥物", 2, "B", 4, "mascot", "🦜", "翻出：替补席每有一种系列，本卡 +1 战力。"),
        ("dog", "Dog", "狗", 3, "B", 3, "none", "🐕", "无特殊能力。"),
        ("fan_bus", "Fan Bus", "粉丝巴士", 6, "C", 4, "fan_bus", "🚌", "翻出：若持有不超过三座奖杯，获得 2 粉丝。"),
        ("champion", "Champion", "冠军", 4, "C", 2, "none", "🏅", "无特殊能力。"),
    ],
    "castle": [
        ("hermit", "Hermit", "隐士", 2, "A", 4, "hermit", "🧙", "翻出：替补席没有城市牌时，本卡 +2 战力。"),
        ("jester", "Jester", "弄臣", 1, "A", 4, "jester", "🃏", "翻出：替补席有基础战力 1 的牌时，本卡 +3 战力。"),
        ("stable_boy", "Stable Boy", "马童", 2, "A", 4, "stable_boy", "🧑‍🌾", "翻出：替补席每张基础战力 3 的牌让本卡 +1 战力。"),
        ("pig", "Pig", "猪", 3, "A", 3, "none", "🐷", "无特殊能力。"),
        ("blacksmith", "Blacksmith", "铁匠", 3, "B", 4, "blacksmith", "⚒️", "替补席：你的城市牌 +1 战力。"),
        ("sorcerer", "Sorcerer", "术士", 4, "B", 4, "sorcerer", "🪄", "可将替补席一张基础战力不超过 3 的牌放入疲劳区。"),
        ("knight", "Knight", "骑士", 3, "B", 4, "knight", "🛡️", "攻击中：对手每有一座奖杯，本卡 +1 战力。"),
        ("horse", "Horse", "马", 5, "B", 3, "none", "🐎", "无特殊能力。"),
        ("prince", "Prince", "王子", 5, "C", 4, "prince", "🤴", "失旗：本卡进入疲劳区。下面的牌仍进入替补席。"),
        ("bard", "Bard", "吟游诗人", 4, "C", 4, "bard", "🪕", "替补席：你的每张牌攻击中 +1 战力。"),
        ("dragon", "Dragon", "巨龙", 7, "C", 2, "none", "🐉", "无特殊能力。"),
    ],
    "studio": [
        ("makeup_artist", "Make-up Artist", "化妆师", 1, "A", 4, "makeup_artist", "💄", "替补席：你的基础战力 1 的牌攻击中 +2 战力。"),
        ("movie_star", "Movie Star", "电影明星", 2, "A", 4, "movie_star", "🎞️", "将替补席至多两张新人放回牌顶。"),
        ("gangster", "Gangster", "黑帮", 2, "A", 4, "gangster", "🕴️", "攻击中：本卡 +2 战力。"),
        ("cat", "Cat", "猫", 3, "A", 3, "none", "🐈", "无特殊能力。"),
        ("director", "Director", "导演", 4, "B", 4, "director", "🎥", "替补席：你的电影片场牌攻击中 +1 战力。"),
        ("cowboy", "Cowboy", "牛仔", 3, "B", 4, "cowboy", "🤠", "取得旗帜：对手将牌顶一张直接放入替补席，不执行其效果。"),
        ("comic_character", "Comic Character", "漫画角色", 4, "B", 4, "comic_character", "💥", "失旗：你的下一张牌攻击中 +2 战力。"),
        ("lion", "Lion", "狮子", 5, "B", 3, "none", "🦁", "无特殊能力。"),
        ("heroine", "Heroine", "女英雄", 5, "C", 4, "heroine", "🦸‍♀️", "取得旗帜：获得 3 粉丝。"),
        ("villain", "Villain", "反派", 10, "C", 4, "villain", "🦹", "将 A 级牌堆顶一张暗放到自己的牌顶。该牌加入牌组。"),
        ("t_rex", "T-Rex", "霸王龙", 7, "C", 2, "none", "🦖", "无特殊能力。"),
    ],
    "funfair": [
        ("clown", "Clown", "小丑", 1, "A", 4, "clown", "🤡", "取得旗帜：获得 2 粉丝。"),
        ("juggler", "Juggler", "杂耍艺人", 2, "A", 4, "juggler", "🤹", "查看牌顶三张，自选顺序放回牌顶。"),
        ("vendor", "Vendor", "摊贩", 2, "A", 4, "vendor", "🍿", "替补席：你的游乐园牌 +1 战力。"),
        ("pony", "Pony", "小马", 3, "A", 3, "none", "🐴", "无特殊能力。"),
        ("pyrotechnician", "Pyrotechnician", "烟火师", 4, "B", 4, "pyrotechnician", "🎆", "翻出：自己的牌库剩至多一张时，获得 2 粉丝。"),
        ("clairvoyant", "Clairvoyant", "占卜师", 4, "B", 4, "clairvoyant", "🔮", "失旗：查看自己的牌库，选一张置顶，其余牌顺序不变。"),
        ("mime", "Mime", "默剧演员", 1, "B", 4, "mime", "🎭", "翻出：替补席每有一个空格，本卡 +1 战力。"),
        ("rubber_duck", "Rubber Duck", "橡皮鸭", 5, "B", 3, "none", "🦆", "无特殊能力。"),
        ("illusionist", "Illusionist", "幻术师", 5, "C", 4, "illusionist", "🎩", "持旗：替补席每有一个空格，本卡 +1 战力。"),
        ("bumper_car", "Bumper Car", "碰碰车", 6, "C", 4, "juggler", "🚗", "查看牌顶三张，自选顺序放回牌顶。"),
        ("teddy_bear", "Teddy Bear", "泰迪熊", 7, "C", 2, "none", "🧸", "无特殊能力。"),
    ],
    "haunted": [
        ("skeleton", "Skeleton", "骷髅", 2, "A", 8, "skeleton", "💀", "持旗：本卡 +1 战力。"),
        ("butler", "Butler", "管家", 1, "A", 4, "butler", "🕯️", "将替补席至多两张牌放入疲劳区。"),
        ("spider", "Spider", "蜘蛛", 3, "A", 3, "none", "🕷️", "无特殊能力。"),
        ("necromancer", "Necromancer", "死灵法师", 3, "B", 4, "necromancer", "🧟", "将替补席一张基础战力 2 的牌放回牌顶。"),
        ("ghost", "Ghost", "幽灵", 1, "B", 4, "ghost", "👻", "对手将牌顶一张放入疲劳区，不执行其效果。"),
        ("teenager", "Teenager", "少年", 2, "B", 4, "teenager", "🛹", "翻出：替补席每张鬼屋牌让本卡 +1 战力。"),
        ("bat", "Bat", "蝙蝠", 5, "B", 3, "none", "🦇", "无特殊能力。"),
        ("vampire", "Vampire", "吸血鬼", 4, "C", 4, "vampire", "🧛", "将替补席一张 B 级牌放回牌顶。起始 S 级狗不算 B 级。"),
        ("vacuum_cleaner", "Vacuum Cleaner", "吸尘器", 5, "C", 4, "butler", "🧹", "将替补席至多两张牌放入疲劳区。"),
        ("werewolf", "Werewolf", "狼人", 7, "C", 2, "none", "🐺", "无特殊能力。"),
    ],
    "space": [
        ("rescue_pod", "Rescue Pod", "救生舱", 1, "A", 4, "rescue_pod", "🚀", "失旗：永久移除此卡，将 B 级牌堆顶一张加入自己的疲劳区。"),
        ("shapeshifter", "Shapeshifter", "变形者", 2, "A", 4, "shapeshifter", "🪞", "选中时：可移除自己牌组一张牌，额外选一张候选牌。"),
        ("ai", "A.I.", "人工智能", 2, "A", 3, "ai", "🧠", "替补席：你的基础战力 2 的牌 +1 战力。"),
        ("cow", "Cow", "牛", 3, "A", 4, "none", "🐄", "无特殊能力。"),
        ("band", "Band", "乐队", 3, "B", 4, "band", "🎸", "替补席：你的外太空牌 +1 战力。"),
        ("clones", "Clones", "克隆人", 4, "B", 5, "clones", "👯", "选中时：获得 1 粉丝。"),
        ("ufo", "UFO", "飞碟", 3, "B", 3, "ufo", "🛸", "将 A 级牌堆顶两张暗放到自己牌底。两张都加入牌组。"),
        ("alien", "Alien", "外星人", 5, "B", 3, "none", "👽", "无特殊能力。"),
        ("hologram", "Hologram", "全息影像", 4, "C", 4, "hologram", "📡", "将 B 级牌堆顶一张暗放到对手牌顶，该牌加入对手牌组。"),
        ("scifi_geek", "Sci-Fi Geek", "科幻迷", 6, "C", 4, "scifi_geek", "🧑‍🚀", "选中时：可移除自己牌组两张外太空牌，额外选一张候选牌。"),
        ("slime", "Slime", "史莱姆", 7, "C", 2, "none", "🫧", "无特殊能力。"),
    ],
    "shipwreck": [
        ("treasure", "Treasure", "宝箱", 2, "A", 4, "treasure", "💎", "持旗：本卡 +2 战力。"),
        ("merman", "Merman", "人鱼", 1, "A", 4, "merman", "🧜", "翻出：替补席有沉船牌时，本卡 +3 战力。"),
        ("sailor", "Sailor", "水手", 2, "A", 4, "sailor", "⛵", "查看自己的牌库，选一张放牌底，其余牌顺序不变。"),
        ("parrot", "Parrot", "鹦鹉", 3, "A", 3, "none", "🦜", "无特殊能力。"),
        ("cook", "Cook", "厨师", 2, "B", 4, "cook", "🧑‍🍳", "替补席：你持旗的牌 +1 战力。"),
        ("lifeguard", "Lifeguard", "救生员", 4, "B", 4, "lifeguard", "🛟", "翻出：自己的牌库剩至多一张时，本卡 +2 战力。"),
        ("navigator", "Navigator", "领航员", 4, "B", 4, "navigator", "🧭", "失旗：看牌顶两张，一张放牌顶，另一张放牌底。"),
        ("shark", "Shark", "鲨鱼", 5, "B", 3, "none", "🦈", "无特殊能力。"),
        ("siren", "Siren", "海妖", 6, "C", 4, "siren", "🧜‍♀️", "可将对手替补席一张牌放入其疲劳区。"),
        ("submarine", "Submarine", "潜艇", 9, "C", 4, "submarine", "🚢", "将自己牌底一张牌放入疲劳区。"),
        ("kraken", "Kraken", "海怪", 7, "C", 2, "none", "🐙", "无特殊能力。"),
    ],
    "robot": [
        ("alpha", "Alpha", "阿尔法", 1, "S", 1, "none", "🤖", "Robot 起始牌。"),
        ("beta", "Beta", "贝塔", 2, "S", 1, "none", "🤖", "Robot 起始牌。"),
        ("good_bot", "Good Bot", "好机器人", 3, "S", 1, "none", "🐕‍🦺", "Robot 起始牌。"),
        ("champ_bot", "C.H.A.M.P.", "机甲冠军", 4, "S", 1, "none", "🦾", "Robot 起始牌。"),
        ("cyborg", "Cyborg", "赛博格", 0, "S", 4, "cyborg", "🤖", "基础战力等于当前轮数。"),
        ("virtual_ghost", "Virtual Ghost", "虚拟幽灵", 1, "R", 2, "ghost", "👾", "对手将牌顶一张放入疲劳区。"),
        ("cyborg_friend", "Cyborg-Friend", "赛博伙伴", 1, "R", 1, "cyborg_friend", "🦾", "翻出：Robot 替补席每张赛博格让本卡 +1 战力。"),
        ("mechanic", "Mechanic", "机械师", 3, "R", 1, "mechanic", "🔧", "翻出：对手替补席每张 B 级牌让本卡 +1 战力。"),
        ("robo_knight", "Robo-Knight", "机甲骑士", 3, "R", 2, "knight", "🛡️", "攻击中：对手每座奖杯让本卡 +1 战力。"),
        ("drone", "Drone", "无人机", 4, "R", 1, "drone", "🚁", "对手将自己替补席一张牌放入疲劳区。"),
        ("necromech", "Necromech", "死灵机甲", 5, "R", 1, "necromech", "⚙️", "对手可将自己替补席一张基础战力 2 的牌放回牌顶。"),
        ("chatbot", "Chatbot", "聊天机器人", 5, "SOLO", 1, "chatbot", "💬", "失旗：Robot 的对手获得 1 粉丝。"),
        ("robogram", "Robogram", "机甲影像", 2, "SOLO", 1, "robogram", "📡", "将 A 级牌堆顶一张暗放到对手牌顶，加入其牌组。"),
        ("autocorrect", "Autocorrect", "自动纠错", 7, "SOLO", 1, "autocorrect", "⌨️", "翻出：对手替补席每有一种系列，本卡 -1 战力。"),
    ],
}

CARDS: Dict[str, Dict] = {}
for _set, _cards in _ROWS.items():
    for _id, _name, _zh, _power, _level, _copies, _effect, _icon, _text in _cards:
        CARDS[_id] = dict(kind=_id, name=_name, name_zh=_zh, power=_power,
                          level=_level, copies=_copies, effect=_effect, icon=_icon,
                          set=_set, description=_text)

STARTER = ["newcomer", "newcomer", "newcomer", "talent", "dog", "champion"]
ROBOT_STARTER = ["alpha", "beta", "good_bot", "champ_bot"] + ["cyborg"] * 4
ROUND_OPTIONS = [
    {"A": 2}, {"A": 2}, {"A": 2, "B": 1}, {"A": 2, "B": 2},
    {"B": 2}, {"B": 2, "C": 1}, {"C": 2},
]
TROPHY_VALUES = [[2, 2, 2, 3], [2, 2, 3, 3], [3, 3, 4, 4],
                 [5, 5, 6, 6], [6, 6, 6, 7], [7, 7, 7, 8], [9, 9, 10, 10]]
