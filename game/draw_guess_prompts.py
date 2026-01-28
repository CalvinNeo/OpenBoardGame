DEFAULT_PROMPTS_EN = [
    {"text": "airplane", "quickdraw": "airplane"},
    {"text": "apple", "quickdraw": "apple"},
    {"text": "backpack", "quickdraw": "backpack"},
    {"text": "balloon", "quickdraw": "balloon"},
    {"text": "beach", "quickdraw": "beach"},
    {"text": "bicycle", "quickdraw": "bicycle"},
    {"text": "bridge", "quickdraw": "bridge"},
    {"text": "camera", "quickdraw": "camera"},
    {"text": "castle", "quickdraw": "castle"},
    {"text": "cat", "quickdraw": "cat"},
    {"text": "coffee", "quickdraw": "coffee cup"},
    {"text": "cookie", "quickdraw": "cookie"},
    {"text": "dinosaur", "quickdraw": "dinosaur"},
    {"text": "dragon", "quickdraw": "dragon"},
    {"text": "guitar", "quickdraw": "guitar"},
    {"text": "hamburger", "quickdraw": "hamburger"},
    {"text": "island", "quickdraw": "beach"},
    {"text": "key", "quickdraw": "key"},
    {"text": "kite", "quickdraw": "kite"},
    {"text": "lamp", "quickdraw": "lamp"},
    {"text": "mountain", "quickdraw": "mountain"},
    {"text": "octopus", "quickdraw": "octopus"},
    {"text": "piano", "quickdraw": "piano"},
    {"text": "pizza", "quickdraw": "pizza"},
    {"text": "rainbow", "quickdraw": "rainbow"},
    {"text": "robot", "quickdraw": "robot"},
    {"text": "rocket", "quickdraw": "rocket"},
    {"text": "sailboat", "quickdraw": "sailboat"},
    {"text": "snowman", "quickdraw": "snowman"},
    {"text": "spaceship", "quickdraw": "space ship"},
    {"text": "sunflower", "quickdraw": "sunflower"},
    {"text": "telescope", "quickdraw": "telescope"},
    {"text": "train", "quickdraw": "train"},
    {"text": "treehouse", "quickdraw": "house"},
    {"text": "umbrella", "quickdraw": "umbrella"},
    {"text": "whale", "quickdraw": "whale"},
]

DEFAULT_PROMPTS_ZH = [
    {"text": "飞机", "quickdraw": "airplane"},
    {"text": "苹果", "quickdraw": "apple"},
    {"text": "背包", "quickdraw": "backpack"},
    {"text": "气球", "quickdraw": "balloon"},
    {"text": "海滩", "quickdraw": "beach"},
    {"text": "自行车", "quickdraw": "bicycle"},
    {"text": "桥", "quickdraw": "bridge"},
    {"text": "相机", "quickdraw": "camera"},
    {"text": "城堡", "quickdraw": "castle"},
    {"text": "猫", "quickdraw": "cat"},
    {"text": "咖啡", "quickdraw": "coffee cup"},
    {"text": "饼干", "quickdraw": "cookie"},
    {"text": "恐龙", "quickdraw": "dinosaur"},
    {"text": "龙", "quickdraw": "dragon"},
    {"text": "吉他", "quickdraw": "guitar"},
    {"text": "汉堡", "quickdraw": "hamburger"},
    {"text": "岛屿", "quickdraw": "beach"},
    {"text": "钥匙", "quickdraw": "key"},
    {"text": "风筝", "quickdraw": "kite"},
    {"text": "灯", "quickdraw": "lamp"},
    {"text": "山", "quickdraw": "mountain"},
    {"text": "章鱼", "quickdraw": "octopus"},
    {"text": "钢琴", "quickdraw": "piano"},
    {"text": "披萨", "quickdraw": "pizza"},
    {"text": "彩虹", "quickdraw": "rainbow"},
    {"text": "机器人", "quickdraw": "robot"},
    {"text": "火箭", "quickdraw": "rocket"},
    {"text": "帆船", "quickdraw": "sailboat"},
    {"text": "雪人", "quickdraw": "snowman"},
    {"text": "宇宙飞船", "quickdraw": "space ship"},
    {"text": "向日葵", "quickdraw": "sunflower"},
    {"text": "望远镜", "quickdraw": "telescope"},
    {"text": "火车", "quickdraw": "train"},
    {"text": "树屋", "quickdraw": "house"},
    {"text": "雨伞", "quickdraw": "umbrella"},
    {"text": "鲸鱼", "quickdraw": "whale"},
]

DEFAULT_PROMPTS_BY_LANGUAGE = {
    "en": DEFAULT_PROMPTS_EN,
    "zh": DEFAULT_PROMPTS_ZH,
}

ENGLISH_ALIAS_OVERRIDES = {
    entry["text"]: entry["quickdraw"]
    for entry in DEFAULT_PROMPTS_EN
    if entry.get("quickdraw") and entry["quickdraw"] != entry["text"]
}

CHINESE_TO_QUICKDRAW = {
    entry["text"]: entry["quickdraw"]
    for entry in DEFAULT_PROMPTS_ZH
    if entry.get("quickdraw")
}
