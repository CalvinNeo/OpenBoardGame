"""Card pool and schemas for 似帽非帽 / That's Not a Hat.

The physical game ships 110 gift cards. Each card shows one everyday object on
the front and an arrow plus a light or dark back on the reverse. This module
keeps the 55 distinct objects (two copies each, so 110 cards) together with the
bilingual labels used by the browser client.
"""
from typing import Dict, List


# Category keys double as the filter chips of the item picker.
CATEGORIES: List[Dict[str, str]] = [
    {"key": "apparel", "emoji": "👕", "zh": "穿戴", "en": "Wearables"},
    {"key": "play", "emoji": "🎈", "zh": "玩物", "en": "Toys"},
    {"key": "tool", "emoji": "🔑", "zh": "用具", "en": "Tools"},
    {"key": "travel", "emoji": "🚀", "zh": "出行", "en": "Travel"},
    {"key": "food", "emoji": "🍕", "zh": "吃喝", "en": "Food"},
    {"key": "nature", "emoji": "🐱", "zh": "生灵", "en": "Creatures"},
]


# key, emoji, zh, en, category
ITEMS: List[Dict[str, str]] = [
    {"key": "hat", "emoji": "🎩", "zh": "礼帽", "en": "Top Hat", "category": "apparel"},
    {"key": "shoe", "emoji": "👟", "zh": "运动鞋", "en": "Sneaker", "category": "apparel"},
    {"key": "backpack", "emoji": "🎒", "zh": "背包", "en": "Backpack", "category": "apparel"},
    {"key": "glasses", "emoji": "👓", "zh": "眼镜", "en": "Glasses", "category": "apparel"},
    {"key": "tie", "emoji": "👔", "zh": "领带", "en": "Necktie", "category": "apparel"},
    {"key": "sock", "emoji": "🧦", "zh": "袜子", "en": "Sock", "category": "apparel"},
    {"key": "glove", "emoji": "🧤", "zh": "手套", "en": "Glove", "category": "apparel"},
    {"key": "scarf", "emoji": "🧣", "zh": "围巾", "en": "Scarf", "category": "apparel"},
    {"key": "crown", "emoji": "👑", "zh": "皇冠", "en": "Crown", "category": "apparel"},
    {"key": "ring", "emoji": "💍", "zh": "戒指", "en": "Ring", "category": "apparel"},
    {"key": "lipstick", "emoji": "💄", "zh": "口红", "en": "Lipstick", "category": "apparel"},
    {"key": "watch", "emoji": "⌚", "zh": "手表", "en": "Wristwatch", "category": "apparel"},
    {"key": "balloon", "emoji": "🎈", "zh": "气球", "en": "Balloon", "category": "play"},
    {"key": "gift", "emoji": "🎁", "zh": "礼盒", "en": "Gift Box", "category": "play"},
    {"key": "teddy", "emoji": "🧸", "zh": "泰迪熊", "en": "Teddy Bear", "category": "play"},
    {"key": "soccer", "emoji": "⚽", "zh": "足球", "en": "Soccer Ball", "category": "play"},
    {"key": "basketball", "emoji": "🏀", "zh": "篮球", "en": "Basketball", "category": "play"},
    {"key": "dice", "emoji": "🎲", "zh": "骰子", "en": "Dice", "category": "play"},
    {"key": "dart", "emoji": "🎯", "zh": "飞镖靶", "en": "Dartboard", "category": "play"},
    {"key": "bowling", "emoji": "🎳", "zh": "保龄球", "en": "Bowling Ball", "category": "play"},
    {"key": "guitar", "emoji": "🎸", "zh": "吉他", "en": "Guitar", "category": "play"},
    {"key": "trophy", "emoji": "🏆", "zh": "奖杯", "en": "Trophy", "category": "play"},
    {"key": "key", "emoji": "🔑", "zh": "钥匙", "en": "Key", "category": "tool"},
    {"key": "lamp", "emoji": "💡", "zh": "灯泡", "en": "Light Bulb", "category": "tool"},
    {"key": "book", "emoji": "📕", "zh": "书本", "en": "Book", "category": "tool"},
    {"key": "camera", "emoji": "📷", "zh": "相机", "en": "Camera", "category": "tool"},
    {"key": "telescope", "emoji": "🔭", "zh": "望远镜", "en": "Telescope", "category": "tool"},
    {"key": "magnet", "emoji": "🧲", "zh": "磁铁", "en": "Magnet", "category": "tool"},
    {"key": "broom", "emoji": "🧹", "zh": "扫帚", "en": "Broom", "category": "tool"},
    {"key": "soap", "emoji": "🧼", "zh": "肥皂", "en": "Soap", "category": "tool"},
    {"key": "extinguisher", "emoji": "🧯", "zh": "灭火器", "en": "Fire Extinguisher", "category": "tool"},
    {"key": "umbrella", "emoji": "☂️", "zh": "雨伞", "en": "Umbrella", "category": "tool"},
    {"key": "bicycle", "emoji": "🚲", "zh": "自行车", "en": "Bicycle", "category": "travel"},
    {"key": "firetruck", "emoji": "🚒", "zh": "消防车", "en": "Fire Engine", "category": "travel"},
    {"key": "ambulance", "emoji": "🚑", "zh": "救护车", "en": "Ambulance", "category": "travel"},
    {"key": "rocket", "emoji": "🚀", "zh": "火箭", "en": "Rocket", "category": "travel"},
    {"key": "airplane", "emoji": "✈️", "zh": "飞机", "en": "Airplane", "category": "travel"},
    {"key": "sailboat", "emoji": "⛵", "zh": "帆船", "en": "Sailboat", "category": "travel"},
    {"key": "helicopter", "emoji": "🚁", "zh": "直升机", "en": "Helicopter", "category": "travel"},
    {"key": "banana", "emoji": "🍌", "zh": "香蕉", "en": "Banana", "category": "food"},
    {"key": "cake", "emoji": "🍰", "zh": "蛋糕", "en": "Cake", "category": "food"},
    {"key": "pizza", "emoji": "🍕", "zh": "披萨", "en": "Pizza", "category": "food"},
    {"key": "burger", "emoji": "🍔", "zh": "汉堡", "en": "Hamburger", "category": "food"},
    {"key": "icecream", "emoji": "🍦", "zh": "冰淇淋", "en": "Ice Cream", "category": "food"},
    {"key": "doughnut", "emoji": "🍩", "zh": "甜甜圈", "en": "Doughnut", "category": "food"},
    {"key": "coffee", "emoji": "☕", "zh": "咖啡", "en": "Coffee", "category": "food"},
    {"key": "tea", "emoji": "🍵", "zh": "清茶", "en": "Tea", "category": "food"},
    {"key": "beer", "emoji": "🍺", "zh": "啤酒", "en": "Beer", "category": "food"},
    {"key": "carrot", "emoji": "🥕", "zh": "胡萝卜", "en": "Carrot", "category": "food"},
    {"key": "mushroom", "emoji": "🍄", "zh": "蘑菇", "en": "Mushroom", "category": "food"},
    {"key": "cat", "emoji": "🐱", "zh": "小猫", "en": "Cat", "category": "nature"},
    {"key": "dog", "emoji": "🐶", "zh": "小狗", "en": "Dog", "category": "nature"},
    {"key": "fish", "emoji": "🐟", "zh": "小鱼", "en": "Fish", "category": "nature"},
    {"key": "bird", "emoji": "🐦", "zh": "小鸟", "en": "Bird", "category": "nature"},
    {"key": "butterfly", "emoji": "🦋", "zh": "蝴蝶", "en": "Butterfly", "category": "nature"},
]

ITEM_BY_KEY: Dict[str, Dict[str, str]] = {item["key"]: item for item in ITEMS}
ITEM_KEYS: List[str] = [item["key"] for item in ITEMS]
COPIES_PER_ITEM = 2


ACTION_SCHEMA = {
    "type": "object",
    "oneOf": [
        {"type": "object", "properties": {"type": {"const": "ready"}}, "required": ["type"], "additionalProperties": False},
        {
            "type": "object",
            "properties": {"type": {"const": "give"}, "item": {"type": "string"}},
            "required": ["type", "item"],
            "additionalProperties": False,
        },
        {"type": "object", "properties": {"type": {"const": "accept"}}, "required": ["type"], "additionalProperties": False},
        {"type": "object", "properties": {"type": {"const": "refuse"}}, "required": ["type"], "additionalProperties": False},
        {"type": "object", "properties": {"type": {"const": "continue"}}, "required": ["type"], "additionalProperties": False},
    ],
}

CONFIG_SCHEMA = {
    "type": "object",
    "properties": {
        "max_penalties": {"type": "integer", "minimum": 1, "maximum": 5},
        "starting_gifts": {"type": "integer", "minimum": 1, "maximum": 2},
    },
    "additionalProperties": False,
}


__all__ = [
    "ACTION_SCHEMA",
    "CATEGORIES",
    "CONFIG_SCHEMA",
    "COPIES_PER_ITEM",
    "ITEMS",
    "ITEM_BY_KEY",
    "ITEM_KEYS",
]
