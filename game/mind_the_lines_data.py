"""Original bilingual prompts, drawing motifs and generated boards.

All coordinates and motifs were made for this implementation. No commercial
word cards, illustrations or board layouts are reproduced here.
"""

import math
import random
from typing import Dict, List, Sequence


def _path(*points: Sequence[float]) -> List[List[float]]:
    return [[*a, *b] for a, b in zip(points, points[1:])]


def _oval(cx: float, cy: float, rx: float, ry: float, count: int = 16) -> List[List[float]]:
    points = [(cx + math.cos(i * 2 * math.pi / count) * rx,
               cy + math.sin(i * 2 * math.pi / count) * ry) for i in range(count + 1)]
    return _path(*points)


def _shift(lines: List[List[float]], x: float = 0, y: float = 0,
           scale: float = 1) -> List[List[float]]:
    return [[a * scale + x, b * scale + y, c * scale + x, d * scale + y]
            for a, b, c, d in lines]


def _motifs() -> Dict[str, List[List[float]]]:
    # A small symbolic drawing vocabulary: silhouettes, never text or numbers.
    m = {}
    m["apple"] = _path((500, 280), (370, 230), (260, 320), (240, 500), (340, 730),
                        (490, 760), (650, 710), (740, 510), (730, 330), (620, 240), (500, 280))
    m["apple"] += _path((500, 280), (520, 140), (660, 120), (610, 220), (520, 240))
    m["banana"] = _path((270, 230), (310, 550), (510, 720), (760, 580), (680, 750),
                         (460, 810), (280, 690), (180, 440), (210, 220), (270, 230))
    m["pear"] = _path((450, 180), (570, 180), (590, 390), (740, 610), (700, 770),
                       (500, 820), (300, 750), (270, 590), (430, 370), (450, 180))
    m["pear"] += _path((500, 180), (530, 100))
    m["carrot"] = _path((310, 280), (680, 360), (410, 850), (310, 280))
    m["carrot"] += _path((480, 310), (320, 120), (500, 220), (570, 100), (590, 330))
    m["cherry"] = _oval(340, 640, 170, 170) + _oval(680, 640, 160, 170)
    m["cherry"] += _path((340, 480), (540, 170), (680, 480))
    m["mushroom"] = _path((170, 490), (260, 260), (500, 160), (740, 260), (840, 490),
                           (170, 490), (430, 490), (380, 810), (650, 810), (580, 490))
    m["flower"] = _oval(500, 360, 100, 100)
    for i in range(5):
        angle = 2 * math.pi * i / 5
        m["flower"] += _oval(500 + 180 * math.sin(angle), 360 + 180 * math.cos(angle), 110, 110, 10)
    m["flower"] += _path((500, 560), (500, 860), (300, 710), (490, 730))
    m["tree"] = _path((470, 810), (470, 590), (240, 590), (210, 410), (330, 290),
                       (340, 160), (520, 130), (700, 260), (790, 440), (700, 590),
                       (560, 590), (560, 810), (470, 810))
    m["pine"] = _path((500, 130), (760, 450), (640, 450), (820, 730), (570, 730),
                       (570, 870), (440, 870), (440, 730), (170, 730), (350, 450),
                       (230, 450), (500, 130))
    m["leaf"] = _path((240, 820), (200, 510), (380, 280), (800, 130), (800, 480),
                       (620, 710), (240, 820), (710, 250))
    m["sun"] = _oval(500, 500, 210, 210)
    for i in range(8):
        a = i * math.pi / 4
        m["sun"] += _path((500 + math.cos(a) * 290, 500 + math.sin(a) * 290),
                           (500 + math.cos(a) * 400, 500 + math.sin(a) * 400))
    m["moon"] = _path((630, 160), (340, 170), (180, 350), (150, 560), (330, 780),
                       (600, 820), (820, 660), (580, 680), (390, 500), (420, 270), (630, 160))
    star = [(500 + math.sin(i * math.pi / 5) * (370 if i % 2 == 0 else 155),
             500 - math.cos(i * math.pi / 5) * (370 if i % 2 == 0 else 155)) for i in range(10)]
    m["star"] = _path(*(star + [star[0]]))
    m["cloud"] = _path((180, 650), (110, 520), (220, 380), (350, 370), (410, 220),
                        (590, 230), (690, 370), (830, 380), (910, 520), (820, 650), (180, 650))
    m["rain"] = m["cloud"] + _path((280, 730), (230, 850)) + _path((500, 730), (450, 850)) + _path((720, 730), (670, 850))
    m["mountain"] = _path((100, 820), (390, 200), (700, 820), (900, 820), (690, 410), (560, 570))
    m["mountain"] += _path((300, 390), (390, 450), (450, 330))
    m["house"] = _path((160, 440), (500, 150), (850, 440), (160, 440), (240, 440),
                        (240, 820), (770, 820), (770, 440))
    m["house"] += _path((430, 820), (430, 610), (580, 610), (580, 820))
    m["tent"] = _path((130, 820), (500, 170), (880, 820), (130, 820), (380, 820),
                       (500, 490), (650, 820))
    m["boat"] = _path((130, 640), (870, 640), (710, 820), (300, 820), (130, 640))
    m["boat"] += _path((500, 630), (500, 150), (790, 570), (500, 570), (250, 570), (500, 250))
    m["umbrella"] = _path((140, 480), (250, 270), (500, 170), (750, 270), (860, 480),
                           (140, 480), (500, 480), (500, 810), (420, 880), (330, 800))
    m["fish"] = _path((190, 500), (360, 300), (620, 300), (810, 490), (930, 310),
                       (930, 720), (810, 510), (620, 720), (360, 720), (190, 500))
    m["bird"] = _path((170, 620), (260, 320), (430, 260), (560, 390), (790, 410),
                       (710, 650), (430, 750), (170, 620), (100, 470), (260, 470))
    m["bird"] += _path((430, 450), (540, 610), (680, 500))
    m["cat"] = _path((270, 340), (270, 120), (430, 280), (620, 280), (780, 120),
                      (780, 350), (720, 510), (630, 610), (640, 820), (360, 820),
                      (330, 610), (230, 720), (170, 600), (200, 450))
    m["dog"] = _path((250, 470), (240, 270), (350, 140), (480, 210), (550, 360),
                      (750, 500), (800, 800), (650, 800), (620, 570), (460, 600),
                      (430, 820), (280, 820), (250, 470), (140, 450), (140, 300), (240, 270))
    m["rabbit"] = _oval(500, 670, 220, 180) + _oval(500, 410, 150, 140)
    m["rabbit"] += _path((380, 300), (290, 130), (360, 100), (490, 290),
                         (520, 290), (630, 100), (700, 140), (620, 340))
    m["butterfly"] = _path((500, 280), (220, 140), (120, 390), (350, 550), (180, 680),
                            (280, 840), (500, 680), (710, 840), (850, 680), (650, 550),
                            (900, 390), (780, 140), (500, 280), (500, 680))
    m["turtle"] = _oval(480, 530, 290, 240) + _oval(850, 510, 90, 100)
    m["turtle"] += _path((280, 330), (200, 220)) + _path((280, 740), (200, 840))
    m["turtle"] += _path((670, 330), (740, 220)) + _path((670, 730), (740, 840))
    m["snake"] = _path((150, 750), (340, 820), (590, 730), (650, 600), (410, 560),
                        (220, 420), (320, 210), (590, 160), (800, 250))
    m["snail"] = _oval(430, 510, 240, 230) + _path((240, 760), (810, 760), (900, 630),
                    (810, 540), (750, 680), (240, 760), (430, 570), (500, 490), (420, 410), (330, 510))
    m["spider"] = _oval(500, 530, 160, 190)
    for y in (280, 430, 620, 770):
        m["spider"] += _path((350, 500), (200, y), (100, y + 50))
        m["spider"] += _path((650, 500), (800, y), (900, y + 50))
    m["crown"] = _path((230, 780), (120, 300), (340, 480), (500, 170), (660, 480),
                        (880, 300), (770, 780), (230, 780))
    m["hat"] = _path((100, 730), (900, 730), (780, 620), (720, 250), (290, 250),
                      (220, 620), (100, 730))
    m["shoe"] = _path((240, 220), (510, 220), (520, 510), (850, 640), (910, 770),
                       (150, 770), (150, 610), (240, 220))
    m["shirt"] = _path((370, 170), (130, 290), (220, 500), (340, 420), (300, 830),
                        (710, 830), (660, 420), (790, 500), (870, 290), (630, 170),
                        (560, 300), (450, 300), (370, 170))
    m["glasses"] = _oval(290, 550, 170, 150) + _oval(730, 550, 170, 150)
    m["glasses"] += _path((450, 520), (560, 520)) + _path((120, 500), (150, 220)) + _path((900, 500), (850, 220))
    m["key"] = _oval(310, 330, 190, 190) + _path((440, 460), (790, 810), (880, 720),
                     (770, 610), (700, 680), (610, 590), (660, 530))
    m["cup"] = _path((220, 200), (670, 200), (620, 760), (300, 760), (220, 200))
    m["cup"] += _path((660, 310), (850, 310), (850, 590), (630, 590))
    m["bottle"] = _path((420, 130), (590, 130), (590, 330), (710, 440), (710, 820),
                         (290, 820), (290, 440), (420, 330), (420, 130))
    m["spoon"] = _oval(500, 310, 180, 210) + _path((460, 520), (440, 850), (550, 850), (540, 520))
    m["fork"] = _path((310, 110), (310, 390), (500, 500), (500, 870))
    m["fork"] += _path((500, 110), (500, 500), (700, 390), (700, 110))
    m["scissors"] = _oval(310, 720, 160, 140) + _oval(700, 720, 160, 140)
    m["scissors"] += _path((390, 610), (760, 170)) + _path((620, 610), (250, 170))
    m["hammer"] = _path((480, 850), (480, 330), (260, 330), (260, 170), (800, 170),
                         (800, 330), (590, 330), (590, 850), (480, 850))
    m["chair"] = _path((280, 180), (280, 800)) + _path((280, 560), (750, 560), (750, 820))
    m["chair"] += _path((280, 180), (570, 180), (570, 560))
    m["table"] = _path((130, 350), (850, 350), (850, 480), (130, 480), (130, 350))
    m["table"] += _path((240, 480), (240, 850)) + _path((750, 480), (750, 850))
    m["bed"] = _path((170, 200), (170, 850)) + _path((170, 530), (850, 530), (850, 850))
    m["bed"] += _path((170, 700), (850, 700)) + _path((260, 530), (260, 370), (500, 370), (500, 530))
    m["lamp"] = _path((300, 160), (700, 160), (840, 460), (150, 460), (300, 160))
    m["lamp"] += _path((500, 460), (500, 840), (250, 840), (750, 840))
    m["clock"] = _oval(500, 500, 340, 340) + _path((500, 230), (500, 500), (720, 570))
    m["book"] = _path((500, 300), (180, 200), (180, 730), (500, 830), (830, 730),
                       (830, 200), (500, 300), (500, 830))
    m["envelope"] = _path((130, 300), (870, 300), (870, 760), (130, 760), (130, 300),
                           (500, 590), (870, 300))
    m["heart"] = _path((500, 350), (360, 180), (180, 220), (100, 390), (170, 550),
                        (500, 860), (830, 550), (900, 390), (820, 220), (640, 180), (500, 350))
    m["balloon"] = _oval(500, 350, 240, 260) + _path((500, 610), (430, 720), (550, 790), (490, 900))
    m["kite"] = _path((500, 100), (800, 350), (500, 650), (200, 350), (500, 100),
                       (500, 650), (680, 730), (450, 820), (600, 900))
    m["rocket"] = _path((500, 100), (320, 340), (320, 690), (170, 800), (170, 510),
                         (320, 450), (680, 450), (830, 510), (830, 800), (680, 690),
                         (680, 340), (500, 100)) + _oval(500, 380, 90, 90)
    m["plane"] = _path((500, 100), (410, 400), (100, 610), (420, 550), (420, 760),
                        (270, 870), (500, 820), (730, 870), (580, 760), (580, 550),
                        (900, 610), (590, 400), (500, 100))
    m["car"] = _path((100, 620), (150, 420), (320, 400), (420, 220), (680, 220),
                      (790, 410), (900, 470), (900, 680), (100, 680), (100, 620))
    m["car"] += _oval(290, 710, 100, 100) + _oval(730, 710, 100, 100)
    m["bicycle"] = _oval(250, 660, 180, 180) + _oval(770, 660, 180, 180)
    m["bicycle"] += _path((250, 660), (410, 350), (580, 660), (250, 660), (650, 420),
                          (770, 660), (620, 250), (780, 250))
    m["train"] = _path((150, 240), (700, 240), (700, 490), (900, 600), (900, 750),
                        (130, 750), (150, 240), (150, 480), (700, 480))
    m["train"] += _oval(300, 790, 85, 85) + _oval(730, 790, 85, 85)
    m["bridge"] = _path((100, 350), (900, 350)) + _path((100, 750), (200, 500),
                      (380, 450), (500, 730), (620, 450), (800, 500), (900, 750))
    m["ladder"] = _path((300, 120), (300, 880)) + _path((700, 120), (700, 880))
    for y in (260, 420, 580, 740):
        m["ladder"] += _path((300, y), (700, y))
    m["fence"] = []
    for x in (200, 400, 600, 800):
        m["fence"] += _path((x, 800), (x, 200))
    m["fence"] += _path((100, 390), (900, 390)) + _path((100, 620), (900, 620))
    m["flag"] = _path((220, 880), (220, 120), (820, 170), (740, 340), (820, 510), (220, 460))
    m["candle"] = _path((360, 410), (660, 410), (660, 850), (360, 850), (360, 410))
    m["candle"] += _path((500, 380), (430, 270), (500, 100), (590, 270), (500, 380))
    m["snowman"] = _oval(500, 690, 260, 210) + _oval(500, 340, 160, 160)
    m["snowman"] += _path((260, 580), (100, 350)) + _path((740, 580), (900, 350))
    m["guitar"] = _oval(360, 700, 230, 200) + _oval(500, 500, 170, 150)
    m["guitar"] += _path((510, 480), (750, 110), (850, 170), (610, 550))
    return m


MOTIFS = _motifs()
# Each line contains an independently authored prompt and the symbolic motif
# used only by the basic bot; clients receive words, never these drawing hints.
_EASY = """
苹果|Apple|apple
香蕉|Banana|banana
梨|Pear|pear
胡萝卜|Carrot|carrot
樱桃|Cherries|cherry
蘑菇|Mushroom|mushroom
花朵|Flower|flower
大树|Tree|tree
松树|Pine tree|pine
树叶|Leaf|leaf
太阳|Sun|sun
月亮|Moon|moon
星星|Star|star
云朵|Cloud|cloud
下雨|Rain|rain
高山|Mountain|mountain
房子|House|house
帐篷|Tent|tent
帆船|Sailboat|boat
雨伞|Umbrella|umbrella
小鱼|Fish|fish
小鸟|Bird|bird
猫|Cat|cat
狗|Dog|dog
兔子|Rabbit|rabbit
蝴蝶|Butterfly|butterfly
乌龟|Turtle|turtle
蛇|Snake|snake
蜗牛|Snail|snail
蜘蛛|Spider|spider
皇冠|Crown|crown
帽子|Hat|hat
鞋子|Shoe|shoe
衬衫|Shirt|shirt
眼镜|Glasses|glasses
钥匙|Key|key
杯子|Cup|cup
瓶子|Bottle|bottle
勺子|Spoon|spoon
叉子|Fork|fork
剪刀|Scissors|scissors
锤子|Hammer|hammer
椅子|Chair|chair
桌子|Table|table
床|Bed|bed
台灯|Lamp|lamp
时钟|Clock|clock
书本|Book|book
信封|Envelope|envelope
爱心|Heart|heart
气球|Balloon|balloon
风筝|Kite|kite
火箭|Rocket|rocket
飞机|Airplane|plane
汽车|Car|car
自行车|Bicycle|bicycle
火车|Train|train
桥|Bridge|bridge
梯子|Ladder|ladder
围栏|Fence|fence
旗帜|Flag|flag
蜡烛|Candle|candle
雪人|Snowman|snowman
吉他|Guitar|guitar
"""
_HARD = """
苹果树|Apple tree|tree+apple
果篮|Fruit basket|cup+pear
胡萝卜田|Carrot patch|fence+carrot
樱桃蛋糕|Cherry cake|table+cherry
蘑菇屋|Mushroom cottage|house+mushroom
花瓶|Flower vase|bottle+flower
森林|Forest|pine+tree
落叶|Falling leaves|tree+leaf
日出|Sunrise|mountain+sun
月光小屋|Moonlit cottage|house+moon
星光露营|Stargazing camp|tent+star
山顶云海|Cloudy summit|mountain+cloud
雨中漫步|Rainy walk|shoe+rain
雪山|Snowy mountain|mountain+snowman
树屋|Tree house|tree+house
野营|Camping|tent+candle
灯塔|Lighthouse|house+lamp
暴风雨|Storm|rain+umbrella
钓鱼|Fishing|boat+fish
鸟巢|Bird nest|tree+bird
猫王|Cat king|cat+crown
遛狗|Walking the dog|shoe+dog
魔术帽|Magic hat|hat+rabbit
花园|Garden|flower+butterfly
海龟岛|Turtle island|mountain+turtle
丛林探险|Jungle expedition|tree+snake
雨后蜗牛|Snail after rain|rain+snail
蜘蛛屋|Spider house|house+spider
王国|Kingdom|house+crown
园丁|Gardener|hat+flower
溜冰鞋|Ice skate|shoe+ladder
晾衣架|Clothesline|fence+shirt
读书人|Reader|book+glasses
锁住的房子|Locked house|house+key
下午茶|Afternoon tea|table+cup
漂流瓶|Message in a bottle|bottle+envelope
喝汤|Eating soup|cup+spoon
餐桌|Dinner table|table+fork
裁缝|Tailor|shirt+scissors
木工|Carpenter|chair+hammer
王座|Throne|chair+crown
野餐|Picnic|table+apple
睡前故事|Bedtime story|bed+book
夜间学习|Night study|book+lamp
赶火车|Catching the train|train+clock
情书|Love letter|envelope+heart
邮差|Mail carrier|bicycle+envelope
浪漫晚餐|Romantic dinner|candle+heart
热气球|Hot air balloon|balloon+cup
海边放风筝|Seaside kite|boat+kite
登月|Moon landing|rocket+moon
空中旅行|Air travel|plane+cloud
出租车|Taxi|car+flag
自行车旅行|Cycling trip|bicycle+mountain
铁路桥|Railway bridge|bridge+train
吊桥|Suspension bridge|bridge+ladder
消防救援|Fire rescue|house+ladder
农场|Farm|fence+house
山顶旗帜|Summit flag|mountain+flag
生日许愿|Birthday wish|candle+star
冬日清晨|Winter morning|snowman+sun
音乐之夜|Music at night|guitar+moon
海盗船|Pirate ship|boat+flag
太空猫|Space cat|rocket+cat
"""


def _words(source: str, prefix: str) -> List[Dict]:
    result = []
    for index, row in enumerate(source.strip().splitlines()):
        zh, en, motif = row.split("|")
        result.append({"id": f"{prefix}{index:02d}", "zh": zh, "en": en, "motif": motif})
    return result


WORD_POOLS = {"easy": _words(_EASY, "e"), "hard": _words(_HARD, "h")}
WORDS_BY_ID = {word["id"]: word for pool in WORD_POOLS.values() for word in pool}


def word_outline(word_id: str) -> List[List[float]]:
    """Return an original symbolic outline, with no text strokes."""
    word = WORDS_BY_ID.get(word_id)
    if word is None:
        return []
    names = word["motif"].split("+")
    if len(names) == 1:
        return MOTIFS[names[0]]
    return _shift(MOTIFS[names[0]], 30, 260, .67) + _shift(MOTIFS[names[1]], 430, 10, .50)


def generate_board(seed: object, board_id: str) -> Dict:
    """Create two independent irregular networks, independent of assigned words."""
    sides = []
    for side in range(2):
        rng = random.Random(f"{seed}:board:{board_id}:{side}")
        size = 12
        nodes = [[(round(40 + x * 920 / size + (rng.uniform(-15, 15) if 0 < x < size else 0)),
                   round(40 + y * 920 / size + (rng.uniform(-15, 15) if 0 < y < size else 0)))
                  for x in range(size + 1)] for y in range(size + 1)]
        segments = []
        for y in range(size + 1):
            for x in range(size + 1):
                if x < size:
                    segments.append([*nodes[y][x], *nodes[y][x + 1]])
                if y < size:
                    segments.append([*nodes[y][x], *nodes[y + 1][x]])
                if x < size and y < size and rng.random() < .8:
                    a, b = ((nodes[y][x], nodes[y + 1][x + 1]) if rng.random() < .5 else
                            (nodes[y][x + 1], nodes[y + 1][x]))
                    segments.append([*a, *b])
        # Long, freely crossing arcs add useful organic curves to the network.
        # Their independent random seed cannot convey any assigned prompt.
        for _ in range(7):
            cx, cy = rng.uniform(320, 680), rng.uniform(320, 680)
            rx, ry = rng.uniform(150, 290), rng.uniform(120, 290)
            start, sweep = rng.uniform(0, math.tau), rng.uniform(math.pi, math.tau)
            points = [(round(cx + rx * math.cos(start + sweep * i / 24)),
                       round(cy + ry * math.sin(start + sweep * i / 24))) for i in range(25)]
            segments.extend(_path(*points))
        rng.shuffle(segments)
        sides.append(segments)
    return {"id": board_id, "sides": sides}
