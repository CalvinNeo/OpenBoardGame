"""Factual card data for Boomerang: Australia (2020).

Sources and the publisher-score-sheet check are recorded in
``designs/boomerang_australia_data_sources.md``.  The Chinese labels are local
display translations; no original card artwork is included.
"""

from typing import Any, Dict


COLLECTION_VALUES: Dict[str, int] = {
    "leaf": 1,
    "flower": 2,
    "shell": 3,
    "souvenir": 5,
}
ANIMAL_VALUES: Dict[str, int] = {
    "kangaroo": 3,
    "emu": 4,
    "wombat": 5,
    "koala": 7,
    "platypus": 9,
}
ACTIVITIES = ("swimming", "bushwalking", "culture", "sightseeing")
# Indexed by the number of matching activity symbols, including zero.
# The publisher's score sheet awards TWO points for two matching symbols.
ACTIVITY_POINTS = (0, 0, 2, 4, 7, 10, 15)

REGIONS: Dict[str, Dict[str, Any]] = {
    "wa": {
        "name": "Western Australia",
        "name_zh": "西澳大利亚",
        "cards": ["A", "B", "C", "D"],
    },
    "nt": {
        "name": "Northern Territory",
        "name_zh": "北领地",
        "cards": ["E", "F", "G", "H"],
    },
    "qld": {
        "name": "Queensland",
        "name_zh": "昆士兰",
        "cards": ["I", "J", "K", "L"],
    },
    "sa": {
        "name": "South Australia",
        "name_zh": "南澳大利亚",
        "cards": ["M", "N", "O", "P"],
    },
    "nsw": {
        "name": "New South Wales",
        "name_zh": "新南威尔士",
        "cards": ["Q", "R", "S", "T"],
    },
    "vic": {
        "name": "Victoria",
        "name_zh": "维多利亚",
        "cards": ["U", "V", "W", "X"],
    },
    "tas": {
        "name": "Tasmania",
        "name_zh": "塔斯马尼亚",
        "cards": ["Y", "Z", "@", "#"],
    },
}

# id, English name, Chinese label, region, throw/catch number,
# collection symbol, animal symbol, activity symbol.
_CARD_ROWS = (
    ("A", "The Bungle Bungles", "邦格尔邦格尔山脉", "wa", 1, "leaf", None, "culture"),
    ("B", "The Pinnacles", "尖峰石阵", "wa", 1, None, "kangaroo", "sightseeing"),
    ("C", "Margaret River", "玛格丽特河", "wa", 1, "shell", "kangaroo", None),
    ("D", "Kalbarri National Park", "卡尔巴里国家公园", "wa", 1, "flower", None, "bushwalking"),
    ("E", "Uluru", "乌鲁鲁", "nt", 4, None, "emu", "culture"),
    ("F", "Kakadu National Park", "卡卡杜国家公园", "nt", 4, None, "wombat", "sightseeing"),
    ("G", "Nitmiluk National Park", "尼特米鲁克国家公园", "nt", 4, "shell", "platypus", None),
    ("H", "King's Canyon", "帝王谷", "nt", 4, None, "koala", "swimming"),
    ("I", "The Great Barrier Reef", "大堡礁", "qld", 6, "flower", None, "sightseeing"),
    ("J", "The Whitsundays", "圣灵群岛", "qld", 6, None, "kangaroo", "culture"),
    ("K", "Daintree Rainforest", "丹翠雨林", "qld", 6, "souvenir", None, "bushwalking"),
    ("L", "Surfers Paradise", "冲浪者天堂", "qld", 6, "flower", None, "swimming"),
    ("M", "Barossa Valley", "巴罗萨谷", "sa", 3, None, "koala", "bushwalking"),
    ("N", "Lake Eyre", "艾尔湖", "sa", 3, None, "emu", "swimming"),
    ("O", "Kangaroo Island", "袋鼠岛", "sa", 3, None, "kangaroo", "bushwalking"),
    ("P", "Mount Gambier", "甘比尔山", "sa", 3, "flower", None, "sightseeing"),
    ("Q", "Blue Mountains", "蓝山", "nsw", 5, None, "wombat", "culture"),
    ("R", "Sydney Harbour", "悉尼港", "nsw", 5, None, "emu", "sightseeing"),
    ("S", "Bondi Beach", "邦迪海滩", "nsw", 5, None, "wombat", "swimming"),
    ("T", "Hunter Valley", "猎人谷", "nsw", 5, None, "emu", "bushwalking"),
    ("U", "Melbourne", "墨尔本", "vic", 2, None, "wombat", "bushwalking"),
    ("V", "The MCG", "墨尔本板球场", "vic", 2, "leaf", None, "culture"),
    ("W", "Twelve Apostles", "十二使徒岩", "vic", 2, "shell", None, "swimming"),
    ("X", "Royal Exhibition Building", "皇家展览馆", "vic", 2, "leaf", "platypus", None),
    ("Y", "Salamanca Markets", "萨拉曼卡市场", "tas", 7, "leaf", "emu", None),
    ("Z", "Mount Wellington", "惠灵顿山", "tas", 7, None, "koala", "sightseeing"),
    ("@", "Port Arthur", "亚瑟港", "tas", 7, "leaf", None, "culture"),
    ("#", "Richmond", "里士满", "tas", 7, None, "kangaroo", "swimming"),
)

CARDS: Dict[str, Dict[str, Any]] = {
    card_id: {
        "id": card_id,
        "name": name,
        "name_zh": name_zh,
        "region": region,
        "number": number,
        "collection": collection,
        "animal": animal,
        "activity": activity,
    }
    for card_id, name, name_zh, region, number, collection, animal, activity in _CARD_ROWS
}
