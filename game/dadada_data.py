"""Static data for 哒哒哒 / DADADA (The Op Games, 2024).

Two decks stand in for the physical components: 40 one-syllable Sound cards and a
bank of Image cards. The published Image deck is 200 hand-drawn pictographs whose
artwork is not redistributable, so the online build ships its own picture bank
built from emoji (see designs/task192.md §3.2), which also keeps the client free
of commercial art assets.

Rules source and confidence table: designs/task192.md.
"""

from typing import Dict, List

from jsonschema import Draft7Validator


# --- Sound deck ----------------------------------------------------------
# The physical deck is 40 nonsense one-syllable phonemes ("PU", "PEH", "ah",
# "foo", "bong", "jah", "tep"). Reproduced here as short, pronounceable,
# uppercase nonsense so a chip reads as one syllable at a glance.

SYLLABLES: List[str] = [
    "PU", "PEH", "AH", "OO", "BA", "DA", "FOO", "BONG",
    "JAH", "TEP", "MEEP", "POE", "RUE", "ZIK", "GLORP", "NIM",
    "KOO", "WHA", "YIP", "SNU", "BLIP", "MOO", "GUR", "HEE",
    "TZA", "VOO", "LUM", "NGA", "PIP", "QUO", "RAH", "SOO",
    "TUK", "UMP", "VEH", "WOB", "XAO", "YUM", "ZOO", "BLEH",
]

SOUND_BY_ID: Dict[str, str] = {
    f"snd-{index + 1:02d}": syllable for index, syllable in enumerate(SYLLABLES)
}
SOUND_IDS: List[str] = list(SOUND_BY_ID)

# --- Image deck ----------------------------------------------------------
# Concrete, easily categorised things. The game lives or dies on whether the
# table can sort the pictures into a handful of buckets, so the bank is spread
# deliberately across animals, food, vehicles, tools, home, clothing, nature,
# places, play and body.

_PICTURES: List[Dict[str, str]] = [
    # Animals
    {"emoji": "🐶", "zh": "狗", "en": "Dog"},
    {"emoji": "🐱", "zh": "猫", "en": "Cat"},
    {"emoji": "🐭", "zh": "老鼠", "en": "Mouse"},
    {"emoji": "🐹", "zh": "仓鼠", "en": "Hamster"},
    {"emoji": "🐰", "zh": "兔子", "en": "Rabbit"},
    {"emoji": "🦊", "zh": "狐狸", "en": "Fox"},
    {"emoji": "🐻", "zh": "熊", "en": "Bear"},
    {"emoji": "🐼", "zh": "熊猫", "en": "Panda"},
    {"emoji": "🐨", "zh": "考拉", "en": "Koala"},
    {"emoji": "🐯", "zh": "老虎", "en": "Tiger"},
    {"emoji": "🦁", "zh": "狮子", "en": "Lion"},
    {"emoji": "🐮", "zh": "奶牛", "en": "Cow"},
    {"emoji": "🐷", "zh": "猪", "en": "Pig"},
    {"emoji": "🐸", "zh": "青蛙", "en": "Frog"},
    {"emoji": "🐵", "zh": "猴子", "en": "Monkey"},
    {"emoji": "🐔", "zh": "公鸡", "en": "Rooster"},
    {"emoji": "🐧", "zh": "企鹅", "en": "Penguin"},
    {"emoji": "🐦", "zh": "小鸟", "en": "Bird"},
    {"emoji": "🦆", "zh": "鸭子", "en": "Duck"},
    {"emoji": "🦉", "zh": "猫头鹰", "en": "Owl"},
    {"emoji": "🐴", "zh": "马", "en": "Horse"},
    {"emoji": "🦄", "zh": "独角兽", "en": "Unicorn"},
    {"emoji": "🐝", "zh": "蜜蜂", "en": "Bee"},
    {"emoji": "🐛", "zh": "毛毛虫", "en": "Caterpillar"},
    {"emoji": "🦋", "zh": "蝴蝶", "en": "Butterfly"},
    {"emoji": "🐌", "zh": "蜗牛", "en": "Snail"},
    {"emoji": "🐞", "zh": "瓢虫", "en": "Ladybug"},
    {"emoji": "🐢", "zh": "乌龟", "en": "Turtle"},
    {"emoji": "🐍", "zh": "蛇", "en": "Snake"},
    {"emoji": "🐙", "zh": "章鱼", "en": "Octopus"},
    {"emoji": "🦀", "zh": "螃蟹", "en": "Crab"},
    {"emoji": "🐬", "zh": "海豚", "en": "Dolphin"},
    {"emoji": "🐳", "zh": "鲸鱼", "en": "Whale"},
    {"emoji": "🦈", "zh": "鲨鱼", "en": "Shark"},
    {"emoji": "🐊", "zh": "鳄鱼", "en": "Crocodile"},
    {"emoji": "🦒", "zh": "长颈鹿", "en": "Giraffe"},
    {"emoji": "🐘", "zh": "大象", "en": "Elephant"},
    {"emoji": "🦏", "zh": "犀牛", "en": "Rhino"},
    {"emoji": "🦓", "zh": "斑马", "en": "Zebra"},
    {"emoji": "🐪", "zh": "骆驼", "en": "Camel"},
    {"emoji": "🦘", "zh": "袋鼠", "en": "Kangaroo"},
    {"emoji": "🐿️", "zh": "松鼠", "en": "Squirrel"},
    {"emoji": "🦔", "zh": "刺猬", "en": "Hedgehog"},
    {"emoji": "🦇", "zh": "蝙蝠", "en": "Bat"},
    {"emoji": "🐺", "zh": "狼", "en": "Wolf"},
    {"emoji": "🐗", "zh": "野猪", "en": "Boar"},
    # Fruit and vegetables
    {"emoji": "🍎", "zh": "苹果", "en": "Apple"},
    {"emoji": "🍌", "zh": "香蕉", "en": "Banana"},
    {"emoji": "🍇", "zh": "葡萄", "en": "Grapes"},
    {"emoji": "🍓", "zh": "草莓", "en": "Strawberry"},
    {"emoji": "🍑", "zh": "桃子", "en": "Peach"},
    {"emoji": "🍍", "zh": "菠萝", "en": "Pineapple"},
    {"emoji": "🥝", "zh": "猕猴桃", "en": "Kiwi"},
    {"emoji": "🍅", "zh": "番茄", "en": "Tomato"},
    {"emoji": "🥑", "zh": "牛油果", "en": "Avocado"},
    {"emoji": "🍆", "zh": "茄子", "en": "Eggplant"},
    {"emoji": "🥕", "zh": "胡萝卜", "en": "Carrot"},
    {"emoji": "🌽", "zh": "玉米", "en": "Corn"},
    {"emoji": "🌶️", "zh": "辣椒", "en": "Chili"},
    {"emoji": "🥔", "zh": "土豆", "en": "Potato"},
    {"emoji": "🥦", "zh": "西兰花", "en": "Broccoli"},
    {"emoji": "🍄", "zh": "蘑菇", "en": "Mushroom"},
    # Prepared food and drink
    {"emoji": "🍞", "zh": "面包", "en": "Bread"},
    {"emoji": "🧀", "zh": "奶酪", "en": "Cheese"},
    {"emoji": "🥚", "zh": "鸡蛋", "en": "Egg"},
    {"emoji": "🍳", "zh": "煎蛋", "en": "Fried egg"},
    {"emoji": "🥓", "zh": "培根", "en": "Bacon"},
    {"emoji": "🍔", "zh": "汉堡", "en": "Burger"},
    {"emoji": "🍟", "zh": "薯条", "en": "Fries"},
    {"emoji": "🍕", "zh": "披萨", "en": "Pizza"},
    {"emoji": "🌭", "zh": "热狗", "en": "Hot dog"},
    {"emoji": "🌮", "zh": "塔可", "en": "Taco"},
    {"emoji": "🍣", "zh": "寿司", "en": "Sushi"},
    {"emoji": "🍜", "zh": "拉面", "en": "Ramen"},
    {"emoji": "🍚", "zh": "米饭", "en": "Rice"},
    {"emoji": "🍰", "zh": "蛋糕", "en": "Cake"},
    {"emoji": "🍪", "zh": "饼干", "en": "Cookie"},
    {"emoji": "🍫", "zh": "巧克力", "en": "Chocolate"},
    {"emoji": "🍬", "zh": "糖果", "en": "Candy"},
    {"emoji": "🍩", "zh": "甜甜圈", "en": "Donut"},
    {"emoji": "🍦", "zh": "冰淇淋", "en": "Ice cream"},
    {"emoji": "☕", "zh": "咖啡", "en": "Coffee"},
    {"emoji": "🍵", "zh": "茶", "en": "Tea"},
    {"emoji": "🥛", "zh": "牛奶", "en": "Milk"},
    {"emoji": "🍺", "zh": "啤酒", "en": "Beer"},
    {"emoji": "🍷", "zh": "红酒", "en": "Wine"},
    # Vehicles
    {"emoji": "🚗", "zh": "汽车", "en": "Car"},
    {"emoji": "🚕", "zh": "出租车", "en": "Taxi"},
    {"emoji": "🚌", "zh": "公交车", "en": "Bus"},
    {"emoji": "🚑", "zh": "救护车", "en": "Ambulance"},
    {"emoji": "🚒", "zh": "消防车", "en": "Fire truck"},
    {"emoji": "🚚", "zh": "卡车", "en": "Truck"},
    {"emoji": "🚲", "zh": "自行车", "en": "Bicycle"},
    {"emoji": "🏍️", "zh": "摩托车", "en": "Motorbike"},
    {"emoji": "🚂", "zh": "火车", "en": "Train"},
    {"emoji": "✈️", "zh": "飞机", "en": "Plane"},
    {"emoji": "🚁", "zh": "直升机", "en": "Helicopter"},
    {"emoji": "🚀", "zh": "火箭", "en": "Rocket"},
    {"emoji": "⛵", "zh": "帆船", "en": "Sailboat"},
    {"emoji": "🚤", "zh": "快艇", "en": "Speedboat"},
    {"emoji": "🚢", "zh": "轮船", "en": "Ship"},
    {"emoji": "🚜", "zh": "拖拉机", "en": "Tractor"},
    # Tools and small objects
    {"emoji": "🔨", "zh": "锤子", "en": "Hammer"},
    {"emoji": "🔧", "zh": "扳手", "en": "Wrench"},
    {"emoji": "🪛", "zh": "螺丝刀", "en": "Screwdriver"},
    {"emoji": "🪓", "zh": "斧头", "en": "Axe"},
    {"emoji": "⛏️", "zh": "镐", "en": "Pickaxe"},
    {"emoji": "🧲", "zh": "磁铁", "en": "Magnet"},
    {"emoji": "🔦", "zh": "手电筒", "en": "Flashlight"},
    {"emoji": "🔑", "zh": "钥匙", "en": "Key"},
    {"emoji": "🔒", "zh": "锁", "en": "Lock"},
    {"emoji": "🧯", "zh": "灭火器", "en": "Extinguisher"},
    {"emoji": "🪣", "zh": "水桶", "en": "Bucket"},
    {"emoji": "🧹", "zh": "扫把", "en": "Broom"},
    {"emoji": "🧽", "zh": "海绵", "en": "Sponge"},
    {"emoji": "🪥", "zh": "牙刷", "en": "Toothbrush"},
    {"emoji": "🧷", "zh": "别针", "en": "Safety pin"},
    {"emoji": "📎", "zh": "回形针", "en": "Paperclip"},
    {"emoji": "✂️", "zh": "剪刀", "en": "Scissors"},
    {"emoji": "📏", "zh": "尺子", "en": "Ruler"},
    {"emoji": "📌", "zh": "图钉", "en": "Pushpin"},
    {"emoji": "🖊️", "zh": "钢笔", "en": "Pen"},
    {"emoji": "✏️", "zh": "铅笔", "en": "Pencil"},
    {"emoji": "🖍️", "zh": "蜡笔", "en": "Crayon"},
    {"emoji": "📷", "zh": "相机", "en": "Camera"},
    {"emoji": "🔭", "zh": "望远镜", "en": "Telescope"},
    {"emoji": "🔬", "zh": "显微镜", "en": "Microscope"},
    # Home
    {"emoji": "🛏️", "zh": "床", "en": "Bed"},
    {"emoji": "🚪", "zh": "门", "en": "Door"},
    {"emoji": "🪟", "zh": "窗户", "en": "Window"},
    {"emoji": "🪑", "zh": "椅子", "en": "Chair"},
    {"emoji": "🚽", "zh": "马桶", "en": "Toilet"},
    {"emoji": "🚿", "zh": "淋浴", "en": "Shower"},
    {"emoji": "🛁", "zh": "浴缸", "en": "Bathtub"},
    {"emoji": "💡", "zh": "灯泡", "en": "Light bulb"},
    {"emoji": "🕯️", "zh": "蜡烛", "en": "Candle"},
    {"emoji": "🧸", "zh": "泰迪熊", "en": "Teddy bear"},
    {"emoji": "🪆", "zh": "套娃", "en": "Nesting doll"},
    {"emoji": "🎈", "zh": "气球", "en": "Balloon"},
    {"emoji": "🎁", "zh": "礼物", "en": "Gift"},
    {"emoji": "📦", "zh": "包裹", "en": "Package"},
    {"emoji": "📚", "zh": "书", "en": "Books"},
    {"emoji": "📰", "zh": "报纸", "en": "Newspaper"},
    {"emoji": "📅", "zh": "日历", "en": "Calendar"},
    {"emoji": "⏰", "zh": "闹钟", "en": "Alarm clock"},
    {"emoji": "⌚", "zh": "手表", "en": "Watch"},
    {"emoji": "📱", "zh": "手机", "en": "Phone"},
    {"emoji": "💻", "zh": "笔记本电脑", "en": "Laptop"},
    {"emoji": "⌨️", "zh": "键盘", "en": "Keyboard"},
    {"emoji": "🖨️", "zh": "打印机", "en": "Printer"},
    {"emoji": "📺", "zh": "电视", "en": "Television"},
    {"emoji": "📻", "zh": "收音机", "en": "Radio"},
    {"emoji": "🎙️", "zh": "麦克风", "en": "Microphone"},
    {"emoji": "🎧", "zh": "耳机", "en": "Headphones"},
    # Clothing
    {"emoji": "👕", "zh": "T恤", "en": "T-shirt"},
    {"emoji": "👖", "zh": "牛仔裤", "en": "Jeans"},
    {"emoji": "👗", "zh": "连衣裙", "en": "Dress"},
    {"emoji": "👠", "zh": "高跟鞋", "en": "High heel"},
    {"emoji": "👟", "zh": "运动鞋", "en": "Sneaker"},
    {"emoji": "🥾", "zh": "靴子", "en": "Boot"},
    {"emoji": "🧦", "zh": "袜子", "en": "Sock"},
    {"emoji": "🧣", "zh": "围巾", "en": "Scarf"},
    {"emoji": "🧤", "zh": "手套", "en": "Glove"},
    {"emoji": "🎩", "zh": "礼帽", "en": "Top hat"},
    {"emoji": "👑", "zh": "皇冠", "en": "Crown"},
    {"emoji": "🕶️", "zh": "墨镜", "en": "Sunglasses"},
    {"emoji": "👓", "zh": "眼镜", "en": "Glasses"},
    {"emoji": "💍", "zh": "戒指", "en": "Ring"},
    {"emoji": "🎒", "zh": "背包", "en": "Backpack"},
    {"emoji": "👜", "zh": "手提包", "en": "Handbag"},
    {"emoji": "☂️", "zh": "雨伞", "en": "Umbrella"},
    # Nature and weather
    {"emoji": "🌳", "zh": "树", "en": "Tree"},
    {"emoji": "🌲", "zh": "松树", "en": "Pine tree"},
    {"emoji": "🌵", "zh": "仙人掌", "en": "Cactus"},
    {"emoji": "🌴", "zh": "棕榈树", "en": "Palm tree"},
    {"emoji": "🌸", "zh": "樱花", "en": "Blossom"},
    {"emoji": "🌻", "zh": "向日葵", "en": "Sunflower"},
    {"emoji": "🌹", "zh": "玫瑰", "en": "Rose"},
    {"emoji": "🌷", "zh": "郁金香", "en": "Tulip"},
    {"emoji": "🍀", "zh": "四叶草", "en": "Clover"},
    {"emoji": "🌿", "zh": "草叶", "en": "Herb"},
    {"emoji": "🌊", "zh": "海浪", "en": "Wave"},
    {"emoji": "⛰️", "zh": "山", "en": "Mountain"},
    {"emoji": "🌋", "zh": "火山", "en": "Volcano"},
    {"emoji": "🏝️", "zh": "岛屿", "en": "Island"},
    {"emoji": "🌈", "zh": "彩虹", "en": "Rainbow"},
    {"emoji": "☀️", "zh": "太阳", "en": "Sun"},
    {"emoji": "🌙", "zh": "月亮", "en": "Moon"},
    {"emoji": "⭐", "zh": "星星", "en": "Star"},
    {"emoji": "☁️", "zh": "云", "en": "Cloud"},
    {"emoji": "🌧️", "zh": "雨", "en": "Rain"},
    {"emoji": "⚡", "zh": "闪电", "en": "Lightning"},
    {"emoji": "❄️", "zh": "雪花", "en": "Snowflake"},
    {"emoji": "🔥", "zh": "火", "en": "Fire"},
    {"emoji": "💧", "zh": "水滴", "en": "Water drop"},
    # Places
    {"emoji": "🏠", "zh": "房子", "en": "House"},
    {"emoji": "🏢", "zh": "办公楼", "en": "Office building"},
    {"emoji": "🏥", "zh": "医院", "en": "Hospital"},
    {"emoji": "🏦", "zh": "银行", "en": "Bank"},
    {"emoji": "🏫", "zh": "学校", "en": "School"},
    {"emoji": "🏪", "zh": "便利店", "en": "Convenience store"},
    {"emoji": "🏰", "zh": "城堡", "en": "Castle"},
    {"emoji": "⛲", "zh": "喷泉", "en": "Fountain"},
    {"emoji": "🎡", "zh": "摩天轮", "en": "Ferris wheel"},
    {"emoji": "🎢", "zh": "过山车", "en": "Roller coaster"},
    {"emoji": "🎪", "zh": "马戏团", "en": "Circus"},
    {"emoji": "⛺", "zh": "帐篷", "en": "Tent"},
    {"emoji": "🗼", "zh": "塔", "en": "Tower"},
    {"emoji": "🏯", "zh": "日式城堡", "en": "Japanese castle"},
    # Music, sport and play
    {"emoji": "🎸", "zh": "吉他", "en": "Guitar"},
    {"emoji": "🎹", "zh": "钢琴", "en": "Piano"},
    {"emoji": "🎺", "zh": "小号", "en": "Trumpet"},
    {"emoji": "🎻", "zh": "小提琴", "en": "Violin"},
    {"emoji": "🥁", "zh": "鼓", "en": "Drum"},
    {"emoji": "🎵", "zh": "音符", "en": "Music note"},
    {"emoji": "⚽", "zh": "足球", "en": "Football"},
    {"emoji": "🏀", "zh": "篮球", "en": "Basketball"},
    {"emoji": "🏈", "zh": "橄榄球", "en": "American football"},
    {"emoji": "🎾", "zh": "网球", "en": "Tennis"},
    {"emoji": "🏐", "zh": "排球", "en": "Volleyball"},
    {"emoji": "🎱", "zh": "台球", "en": "Billiards"},
    {"emoji": "🎳", "zh": "保龄球", "en": "Bowling"},
    {"emoji": "⛳", "zh": "高尔夫", "en": "Golf"},
    {"emoji": "🏹", "zh": "弓箭", "en": "Bow and arrow"},
    {"emoji": "🎣", "zh": "钓鱼", "en": "Fishing"},
    {"emoji": "🛹", "zh": "滑板", "en": "Skateboard"},
    {"emoji": "🎲", "zh": "骰子", "en": "Die"},
    {"emoji": "🎯", "zh": "飞镖", "en": "Darts"},
    {"emoji": "🧩", "zh": "拼图", "en": "Puzzle"},
    {"emoji": "🎨", "zh": "调色板", "en": "Palette"},
    # Body and creatures
    {"emoji": "👀", "zh": "眼睛", "en": "Eyes"},
    {"emoji": "👂", "zh": "耳朵", "en": "Ear"},
    {"emoji": "👃", "zh": "鼻子", "en": "Nose"},
    {"emoji": "👄", "zh": "嘴巴", "en": "Mouth"},
    {"emoji": "🦷", "zh": "牙齿", "en": "Tooth"},
    {"emoji": "🦴", "zh": "骨头", "en": "Bone"},
    {"emoji": "🖐️", "zh": "手", "en": "Hand"},
    {"emoji": "👣", "zh": "脚印", "en": "Footprints"},
    {"emoji": "🧠", "zh": "大脑", "en": "Brain"},
    {"emoji": "❤️", "zh": "心", "en": "Heart"},
    {"emoji": "💀", "zh": "骷髅", "en": "Skull"},
    {"emoji": "👻", "zh": "幽灵", "en": "Ghost"},
    {"emoji": "🤖", "zh": "机器人", "en": "Robot"},
    {"emoji": "👽", "zh": "外星人", "en": "Alien"},
    {"emoji": "🛸", "zh": "飞碟", "en": "Flying saucer"},
    # Odds and ends
    {"emoji": "🚦", "zh": "红绿灯", "en": "Traffic light"},
    {"emoji": "🚧", "zh": "施工牌", "en": "Construction sign"},
    {"emoji": "⛽", "zh": "加油站", "en": "Gas pump"},
    {"emoji": "🎰", "zh": "老虎机", "en": "Slot machine"},
    {"emoji": "💰", "zh": "钱袋", "en": "Money bag"},
    {"emoji": "💎", "zh": "钻石", "en": "Diamond"},
    {"emoji": "🏆", "zh": "奖杯", "en": "Trophy"},
    {"emoji": "🎖️", "zh": "勋章", "en": "Medal"},
    {"emoji": "🔔", "zh": "铃铛", "en": "Bell"},
    {"emoji": "🪄", "zh": "魔法棒", "en": "Magic wand"},
    {"emoji": "🎃", "zh": "南瓜灯", "en": "Jack-o'-lantern"},
    {"emoji": "🎄", "zh": "圣诞树", "en": "Christmas tree"},
]

PICTURES: List[Dict[str, str]] = [
    {"id": f"img-{index + 1:03d}", **picture}
    for index, picture in enumerate(_PICTURES)
]
PICTURE_BY_ID: Dict[str, Dict[str, str]] = {picture["id"]: picture for picture in PICTURES}
IMAGE_IDS: List[str] = [picture["id"] for picture in PICTURES]

# --- Setup constants -----------------------------------------------------
# Setup deals five Sound cards and reveals two, keeping three in reserve
# (whatsericplaying.com, designs/task192.md §2). Creation sorts thirteen Image
# cards. Each Communication round lays out six fresh Image cards.

SOUNDS_DEALT = 5
SOUNDS_REVEALED = 2
MAX_SOUNDS = SOUNDS_DEALT
CREATION_IMAGES = 13
CANDIDATES = 6
SAY_WHAT_LIMIT = 2
MAX_WORD_LENGTH = 5
MAX_PROPOSAL_ATTEMPTS = 2

IMAGE_PATTERN = r"^img-\d{3}$"
SOUND_PATTERN = r"^snd-\d{2}$"

# --- Schemas -------------------------------------------------------------

ACTION_SCHEMA = {
    "type": "object",
    "oneOf": [
        {
            "type": "object",
            "properties": {
                "type": {"const": "propose"},
                "turn": {"type": "integer", "minimum": 1},
                "image": {"type": "string", "pattern": IMAGE_PATTERN},
                "sound": {"type": "string", "pattern": r"^(snd-\d{2}|new)$"},
            },
            "required": ["type", "turn", "image", "sound"],
            "additionalProperties": False,
        },
        {
            "type": "object",
            "properties": {
                "type": {"const": "vote"},
                "turn": {"type": "integer", "minimum": 1},
                "approve": {"type": "boolean"},
            },
            "required": ["type", "turn", "approve"],
            "additionalProperties": False,
        },
        {
            "type": "object",
            "properties": {
                "type": {"const": "speak"},
                "turn": {"type": "integer", "minimum": 1},
                "target": {"type": "string", "pattern": IMAGE_PATTERN},
                "word": {
                    "type": "array",
                    "minItems": 1,
                    "maxItems": MAX_WORD_LENGTH,
                    "items": {"type": "string", "pattern": SOUND_PATTERN},
                },
            },
            "required": ["type", "turn", "target", "word"],
            "additionalProperties": False,
        },
        {
            "type": "object",
            "properties": {
                "type": {"const": "guess"},
                "turn": {"type": "integer", "minimum": 1},
                "image": {"type": "string", "pattern": IMAGE_PATTERN},
            },
            "required": ["type", "turn", "image"],
            "additionalProperties": False,
        },
        {
            "type": "object",
            "properties": {"type": {"const": "continue"}, "turn": {"type": "integer", "minimum": 1}},
            "required": ["type", "turn"],
            "additionalProperties": False,
        },
        {
            "type": "object",
            "properties": {"type": {"const": "play_again"}},
            "required": ["type"],
            "additionalProperties": False,
        },
    ],
}

CONFIG_SCHEMA = {
    "type": "object",
    "properties": {
        "seed": {"oneOf": [{"type": "integer"}, {"type": "string", "minLength": 1, "maxLength": 80}]},
    },
    "additionalProperties": False,
}

ACTION_VALIDATOR = Draft7Validator(ACTION_SCHEMA)
CONFIG_VALIDATOR = Draft7Validator(CONFIG_SCHEMA)
