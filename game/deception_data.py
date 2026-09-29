"""Original bilingual practice cards; no commercial artwork or card scans."""


def _cards(prefix: str, rows: str) -> list:
    result = []
    for index, row in enumerate(rows.strip().splitlines()):
        zh, en, emoji, tags = row.split('|')
        result.append({'id': f'{prefix}{index:02}', 'zh': zh, 'en': en,
                       'emoji': emoji, 'tags': tags.split()})
    return result


MEANS = _cards('m', '''
园艺剪|Pruning shears|✂️|sharp metal outdoor work small
冰锥|Ice pick|🧊|sharp metal cold small
碎瓷片|Porcelain shard|🏺|sharp fragile home small
裁纸刀|Paper cutter|📏|sharp metal work small
登山镐|Climbing pick|⛏️|sharp metal outdoor sport large
锯条|Saw blade|🪚|sharp metal work large
剃刀|Straight razor|🪒|sharp metal home small
鱼叉|Fishing spear|🔱|sharp metal water outdoor large
开信刀|Letter opener|✉️|sharp metal work small
玻璃尖片|Glass splinter|🔍|sharp fragile home small
雕刻凿|Carving chisel|🪛|sharp metal work small
削皮器|Peeler|🥔|sharp metal food home small
铸铁锅|Iron pan|🍳|blunt metal food home large
台球杆|Pool cue|🎱|blunt wood sport large
石制镇纸|Stone paperweight|🪨|blunt stone work small
修理锤|Repair hammer|🔨|blunt metal work small
保龄球|Bowling ball|🎳|blunt heavy sport large
铜雕像|Bronze statue|🗿|blunt metal luxury large
木擀面杖|Rolling pin|🥖|blunt wood food home large
自行车锁|Bicycle lock|🔒|blunt metal outdoor small
长柄铲|Long shovel|🪏|blunt metal outdoor work large
哑铃片|Weight plate|🏋️|blunt metal heavy sport large
石花盆|Stone planter|🪴|blunt stone outdoor heavy large
厚字典|Heavy dictionary|📚|blunt paper work large
帆船缆绳|Sailing rope|🪢|suffocation fabric water outdoor large
针织围巾|Knitted scarf|🧣|suffocation fabric cold home small
窗帘带|Curtain tie|🪟|suffocation fabric home small
旅行枕|Travel pillow|💤|suffocation fabric travel small
包装薄膜|Packing film|📦|suffocation plastic work small
潜水软管|Diving hose|🤿|suffocation plastic water sport large
帐篷拉绳|Tent cord|⛺|suffocation fabric outdoor travel small
棉床单|Cotton sheet|🛏️|suffocation fabric home large
皮革腰带|Leather belt|👖|suffocation fabric luxury small
乐器背带|Instrument strap|🎸|suffocation fabric art small
麻布袋|Burlap sack|👜|suffocation fabric work large
防尘罩|Dust cover|🛋️|suffocation plastic home large
过期药剂|Expired medicine|💊|poison chemical health small
除草液|Weed treatment|🌱|poison chemical outdoor work small
实验试剂|Lab reagent|🧪|poison chemical work small
霉变罐头|Spoiled tin|🥫|poison food metal small
不明蘑菇|Unknown mushroom|🍄|poison food outdoor small
清洁浓液|Cleaning concentrate|🧴|poison chemical home small
染料粉末|Dye powder|🎨|poison chemical art small
旧油漆|Old paint|🪣|poison chemical work large
香料药粉|Herbal powder|🌿|poison food health small
破损气罐|Damaged gas canister|🛢️|poison chemical metal large
受污染的水|Contaminated water|💧|poison water outdoor small
溶剂瓶|Solvent bottle|🍶|poison chemical work small
损坏电暖器|Faulty heater|♨️|burn electric hot home large
漏电台灯|Leaking desk lamp|💡|burn electric work small
蒸汽熨斗|Steam iron|♨️|burn metal hot home small
滚烫茶壶|Scalding teapot|🫖|burn water hot home small
燃烧炭盆|Burning brazier|🔥|burn hot outdoor large
裸露电线|Exposed cable|🔌|burn electric work small
烟花筒|Firework tube|🎆|burn hot outdoor small
聚光灯|Spotlight|🔦|burn electric hot art large
泳池深水|Deep pool|🏊|accident water sport large
破损阶梯|Broken stairs|🪜|accident wood work large
落石|Falling rock|🏔️|accident stone outdoor heavy large
维修升降台|Service lift|🏗️|accident metal work heavy large
结冰坡道|Icy slope|🧊|accident cold outdoor large
失控推车|Runaway cart|🛒|accident metal travel large
松动栏杆|Loose railing|🚧|accident metal outdoor large
倾倒书架|Falling bookcase|📚|accident wood home heavy large
''')

CLUES = _cards('c', '''
折叠车票|Folded ticket|🎫|paper travel small
蓝色纽扣|Blue button|🔵|fabric home small
相片角|Photo corner|📷|paper art small
咖啡渍|Coffee stain|☕|food work hot small
贝壳耳环|Shell earring|🐚|water luxury small
旧门卡|Old keycard|💳|plastic travel work small
球赛腕带|Match wristband|🎟️|fabric sport small
松针|Pine needles|🌲|outdoor wood small
雨靴印|Rainboot print|🥾|water outdoor large
粉笔灰|Chalk dust|🖍️|art work small
丝绸领结|Silk bow tie|🎀|fabric luxury small
冰袋|Ice pack|🧊|cold health plastic small
破裂镜片|Cracked lens|👓|fragile sharp small
音乐谱页|Sheet music|🎼|paper art small
游泳帽|Swim cap|🏊|water sport fabric small
带泥手套|Muddy gloves|🧤|outdoor work fabric small
纸飞机|Paper plane|🛩️|paper travel small
油渍抹布|Oily rag|🧽|work chemical fabric small
生日蜡烛|Birthday candle|🕯️|hot food small
银发夹|Silver hairpin|📎|metal luxury sharp small
公交时刻表|Bus timetable|🚌|paper travel small
盐粒|Salt grains|🧂|food water small
鱼鳞|Fish scales|🐟|food water small
玻璃珠|Glass bead|🔮|fragile art small
药房小票|Pharmacy receipt|🧾|paper health small
木屑|Wood shavings|🪵|wood work small
绒布玩偶|Plush toy|🧸|fabric home small
空电池|Empty battery|🔋|electric metal small
水果网套|Fruit sleeve|🍊|food plastic small
跑步号码布|Race bib|🏃|sport fabric small
旅行地图|Travel map|🗺️|travel paper outdoor large
烧焦纸片|Charred paper|🔥|burn paper hot small
碎花布|Floral fabric|🌸|fabric home small
船票存根|Ferry stub|⛴️|water travel paper small
香水盖|Perfume cap|🌺|chemical luxury small
铜钥匙|Brass key|🗝️|metal home small
园艺标签|Garden label|🌱|outdoor work plastic small
画笔|Paintbrush|🖌️|art wood chemical small
鞋带|Shoelace|👟|fabric sport small
牙科预约单|Dental appointment|🦷|health paper small
金属哨子|Metal whistle|📣|sport metal small
湿海绵|Wet sponge|🧽|water home small
行李挂牌|Luggage tag|🧳|travel plastic small
红线团|Red thread|🧶|fabric art small
茶叶末|Tea crumbs|🍵|food hot small
碎砖|Brick fragment|🧱|stone work heavy small
围裙|Apron|👩‍🍳|fabric food home large
停车代币|Parking token|🅿️|metal travel small
羽毛|Feather|🪶|outdoor small
干花书签|Pressed-flower bookmark|🌷|paper outdoor small
旧唱片|Old record|💿|art plastic large
胶带卷|Tape roll|🧻|plastic work small
护目镜|Safety goggles|🥽|plastic work health small
运动护腕|Sports cuff|💪|fabric sport health small
坚果壳|Nut shells|🥜|food outdoor small
软木塞|Cork stopper|🍾|wood food small
棉绷带|Cotton bandage|🩹|fabric health small
旅行梳|Travel comb|🪮|plastic travel small
铜铃|Brass bell|🔔|metal art small
棋子|Game piece|♟️|wood home small
瓷杯柄|Porcelain handle|☕|fragile food home small
雪花挂饰|Snowflake charm|❄️|cold luxury metal small
工具清单|Tool checklist|📋|work paper small
鹅卵石|River pebble|🪨|stone water outdoor small
''')


def _tile(tile_id: str, zh: str, en: str, rows: str, fixed: bool = False) -> dict:
    options = []
    for row in rows.split(';'):
        chinese, english, tags = row.split('|')
        options.append({'zh': chinese, 'en': english, 'tags': tags.split()})
    assert len(options) == 6
    return {'id': tile_id, 'zh': zh, 'en': en, 'options': options, 'fixed': fixed}


CAUSE = _tile('cause', '死亡原因', 'Cause of death',
              '利器伤|Sharp injury|sharp;重击|Blunt trauma|blunt;窒息|Suffocation|suffocation;中毒|Poisoning|poison;灼伤或触电|Burn / shock|burn electric;环境事故|Accident|accident', True)
LOCATIONS = [
    _tile('location_home', '案发地点 · 居所', 'Location · Home', '厨房|Kitchen|food hot;卧室|Bedroom|fabric home;浴室|Bathroom|water health;书房|Study|paper work;车库|Garage|metal work;庭院|Garden|outdoor wood', True),
    _tile('location_city', '案发地点 · 城市', 'Location · City', '餐馆|Restaurant|food;诊所|Clinic|health;剧院|Theatre|art;车站|Station|travel;商店|Shop|luxury plastic;工坊|Workshop|work metal', True),
    _tile('location_outdoor', '案发地点 · 户外', 'Location · Outdoors', '海岸|Coast|water;树林|Forest|wood outdoor;山路|Mountain path|stone cold;运动场|Sports ground|sport;营地|Campsite|travel fabric;工地|Building site|work heavy', True),
    _tile('location_leisure', '案发地点 · 休闲', 'Location · Leisure', '泳池|Pool|water sport;画室|Studio|art chemical;花房|Greenhouse|outdoor;旅馆|Hotel|travel home;宴会厅|Banquet hall|luxury food;游戏室|Game room|home wood', True),
]
SCENES = [
    _tile('material', '物品材质', 'Material', '金属|Metal|metal;织物|Fabric|fabric;纸张|Paper|paper;木头|Wood|wood;塑料|Plastic|plastic;石头或瓷器|Stone / ceramic|stone fragile'),
    _tile('connection', '物品关联', 'Association', '工作|Work|work;居家|Home|home;旅行|Travel|travel;运动|Sports|sport;饮食|Food|food;艺术|Art|art'),
    _tile('trace', '现场残留', 'Trace', '液体|Liquid|water chemical;纤维|Fibre|fabric;碎片|Fragments|fragile sharp;粉末|Powder|poison stone;焦痕|Scorch marks|burn hot;印迹|Imprint|heavy sport'),
    _tile('temperature', '现场温度', 'Temperature', '冰冷|Icy|cold;清凉|Cool|water;常温|Mild|paper wood;温暖|Warm|fabric home;炎热|Hot|hot;难以判断|Unclear|metal plastic'),
    _tile('impression', '物品印象', 'Impression', '日常|Everyday|home;专业|Specialised|work;精致|Elegant|luxury;古朴|Rustic|wood stone;鲜艳|Colourful|art;危险|Hazardous|chemical sharp electric'),
    _tile('activity', '相关活动', 'Activity', '进餐|Dining|food;维修|Repairs|work metal;休息|Resting|home fabric;锻炼|Training|sport;游览|Touring|travel;创作|Creating|art'),
    _tile('condition', '物品状态', 'Condition', '完整|Intact|plastic;破碎|Broken|fragile;磨损|Worn|fabric wood;潮湿|Wet|water;污损|Stained|chemical food;烧灼|Scorched|hot burn'),
    _tile('size', '显著尺寸', 'Size', '细小|Tiny|small;便携|Portable|travel small;长条|Elongated|sharp wood;宽大|Broad|large;沉重|Heavy|heavy metal stone;蓬松|Fluffy|fabric'),
    _tile('sensory', '感官线索', 'Sensation', '尖锐|Sharp|sharp;粗糙|Rough|stone wood;柔软|Soft|fabric;湿滑|Slippery|water;刺激|Irritating|chemical poison;灼热|Scalding|hot burn'),
    _tile('place_type', '环境特征', 'Surroundings', '私密|Private|home;人来人往|Busy|travel;自然|Natural|outdoor;机械|Mechanical|electric metal;华丽|Ornate|luxury art;整洁|Clinical|health'),
    _tile('victim_activity', '死者先前活动', 'Prior activity', '用餐|Eating|food;洗漱|Washing|water home;工作|Working|work;外出|Travelling|travel outdoor;娱乐|Recreation|sport art;治疗|Treatment|health'),
    _tile('notable', '值得注意', 'Notable detail', '湿气|Moisture|water;气味|Odour|chemical food;碎屑|Debris|wood paper;电力|Electricity|electric;重量|Weight|heavy;花纹|Pattern|fabric art'),
    _tile('storage', '通常存放', 'Usually kept in', '口袋|Pocket|small;工具箱|Toolbox|work metal;厨房|Kitchen|food;衣柜|Wardrobe|fabric;户外|Outdoors|outdoor large;行李箱|Luggage|travel'),
    _tile('mood', '场景氛围', 'Atmosphere', '平静|Quiet|home;匆忙|Hurried|travel;热闹|Festive|art food;紧张|Tense|health;荒凉|Remote|outdoor;繁忙|Industrious|work'),
    _tile('source', '物品来源', 'Origin', '家庭|Household|home;商铺|Retail|plastic luxury;自然|Nature|wood stone outdoor;工厂|Industrial|metal chemical;场馆|Venue|sport art;医疗|Medical|health'),
    _tile('handling', '触感', 'Touch', '冷硬|Cold / hard|metal cold;温热|Warm|hot;柔韧|Flexible|fabric plastic;易碎|Brittle|fragile;轻薄|Thin|paper;厚重|Solid|heavy stone'),
]
CARDS_BY_ID = {card['id']: card for card in MEANS + CLUES}
TILES_BY_ID = {tile['id']: tile for tile in [CAUSE] + LOCATIONS + SCENES}


def public_card(card_id: str) -> dict:
    return {key: value for key, value in CARDS_BY_ID[card_id].items() if key != 'tags'}


def public_tile(tile_id: str, marker=None) -> dict:
    tile = TILES_BY_ID[tile_id]
    return {**{key: value for key, value in tile.items() if key != 'options'},
            'options': [{k: v for k, v in option.items() if k != 'tags'} for option in tile['options']],
            'marker': marker}
