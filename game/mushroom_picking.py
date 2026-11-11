"""上山捡菌 / Mushroom Picking: a 2-4 player set-collection card game.

One box ships two rulesets over the same mushroom deck. Basic mode is a pure
set-collection race: on your turn you either draw three and keep two, take one
card out of the public row, or play a set of mushrooms for points. Orders mode
swaps "play cards for points" for "play cards to fill an order (📜)", which
makes the set-collection spine far more visible and adds twenty order cards
with their own skills.

Rules source, confidence table, online rulings and AI notes: designs/task193.md.
The physical game had not shipped when this was written, so every rule here was
recovered from the single Bilibili tutorial video (BV1nyxi6uEar), including a
page-by-page read of the printed rulebook.
"""
import copy
import random
from collections import Counter
from typing import Dict, List, Optional, Sequence, Tuple

from jsonschema import Draft7Validator


MODE_BASIC = "basic"
MODE_ORDERS = "orders"
MODES = (MODE_BASIC, MODE_ORDERS)

STAGE_PLAY = "play"
STAGE_SCORING = "scoring"
STAGE_GAME_OVER = "game_over"

PHASE_ACTION = "action"
PHASE_KEEP = "keep"
PHASE_PICK_ORDER = "pick_order"

DRAW_COUNT = 3
KEEP_COUNT = 2
HAND_POISON_PENALTY = 10
MOREL_PAIR_BONUS = 8
SAME_KIND_THRESHOLD = 3
MAX_LOG_ENTRIES = 80


# --- Card data -----------------------------------------------------------
# `star` is the printed star rating, `points` the face value in the corner.
# `basic` / `orders` are the copy counts in each ruleset.

def _card(key, zh, en, emoji, star, points, basic, orders, kind, text_zh, text_en):
    return {
        "key": key, "zh": zh, "en": en, "emoji": emoji, "star": star,
        "points": points, "basic": basic, "orders": orders, "kind": kind,
        "text_zh": text_zh, "text_en": text_en,
    }


CARDS: Dict[str, Dict] = {
    "qingtou": _card("qingtou", "青头菌", "Russula", "🍄", 1, 2, 8, 8, "mushroom",
                     "三张或三张以上同类菌一起打出，这一组牌面总分翻倍。",
                     "Play three or more of this kind together and that group doubles."),
    "laba": _card("laba", "喇叭菌", "Trumpet Chanterelle", "🍄", 1, 2, 8, 8, "mushroom",
                  "三张或三张以上同类菌一起打出，这一组牌面总分翻倍。",
                  "Play three or more of this kind together and that group doubles."),
    "maotou": _card("maotou", "毛头鬼伞", "Shaggy Mane", "🍄", 1, 3, 8, 8, "mushroom",
                    "打出时二选一：正常得分，或者清空公共牌区。",
                    "On play choose one: score it normally, or wipe the public row."),
    "dasuan": _card("dasuan", "大蒜", "Garlic", "🧄", 1, 0, 8, 8, "garlic",
                    "必须与野生菌一起打出，本次打出的野生菌分数翻倍。",
                    "Must be played with wild mushrooms, which then score double."),
    "yangdu": _card("yangdu", "羊肚菌", "Morel", "🍄", 2, 3, 4, 4, "mushroom",
                    "与竹荪菌一起打出额外加 8 分。",
                    "Play it together with a Bamboo Fungus for 8 extra points."),
    "zhusun": _card("zhusun", "竹荪菌", "Bamboo Fungus", "🍄", 2, 3, 4, 4, "mushroom",
                    "与羊肚菌一起打出额外加 8 分。",
                    "Play it together with a Morel for 8 extra points."),
    "niugan": _card("niugan", "牛肝菌", "Porcini", "🍄", 2, 3, 4, 4, "mushroom",
                    "没有额外效果，稳稳的 3 分。",
                    "No extra effect, a steady 3 points."),
    "jianshou": _card("jianshou", "见手青", "Blueing Bolete", "🍄", 2, 10, 4, 4, "mushroom",
                      "与火力一起打出得 10 分，游戏结束时每张留在手里扣 10 分。",
                      "Scores 10 when played with Campfire, and costs 10 points for every copy left in hand."),
    "songrong": _card("songrong", "松茸菌", "Matsutake", "🍄", 3, 4, 2, 2, "mushroom",
                      "三星菌，每张 4 分。",
                      "A three-star mushroom worth 4 points each."),
    "ganba": _card("ganba", "干巴菌", "Ganba Fungus", "🍄", 3, 4, 2, 2, "mushroom",
                   "三星菌，每张 4 分。",
                   "A three-star mushroom worth 4 points each."),
    "songlu": _card("songlu", "松露菌", "Truffle", "🍄", 3, 12, 2, 2, "mushroom",
                    "只有与野猪一起打出才能得分，单独打出记 0 分。",
                    "Only scores when played together with a Wild Boar, otherwise 0."),
    "huoli": _card("huoli", "火力", "Campfire", "🔥", 0, 0, 3, 0, "fire",
                   "必须与见手青一起打出才能得分。",
                   "Only scores when played together with a Blueing Bolete."),
    "gancao": _card("gancao", "干草", "Dry Grass", "🌾", 0, 0, 2, 0, "hay",
                    "清空公共牌区所有牌，清空的牌进弃牌堆。",
                    "Wipes every card out of the public row into the discard."),
    "yezhu": _card("yezhu", "野猪", "Wild Boar", "🐗", 0, 0, 3, 0, "boar",
                   "与松露菌一起打出得分；单独打出则随机撞飞其它玩家手中一半牌。",
                   "Scores alongside Truffles, or rampages alone and knocks half of every other hand away."),
}

WILD_KEYS = tuple(key for key, card in CARDS.items() if card["kind"] == "mushroom")
DOUBLING_KEYS = ("qingtou", "laba")
MOREL_KEYS = ("yangdu", "zhusun")
BOAR_KEY = "yezhu"
FIRE_KEY = "huoli"
GARLIC_KEY = "dasuan"
HAY_KEY = "gancao"
POISON_KEY = "jianshou"

BASIC_DECK_SIZE = sum(card["basic"] for card in CARDS.values())
ORDERS_DECK_SIZE = sum(card["orders"] for card in CARDS.values())


def _order(key, zh, en, emoji, points, slots, copies, spicy, skill, text_zh, text_en):
    return {
        "key": key, "zh": zh, "en": en, "emoji": emoji, "points": points,
        "slots": slots, "copies": copies, "spicy": spicy, "skill": skill,
        "text_zh": text_zh, "text_en": text_en,
    }


def _star(level, count):
    return [{"star": level} for _ in range(count)]


ORDERS: Dict[str, Dict] = {
    "shanhuopu": _order("shanhuopu", "山货铺", "Mountain Goods Stall", "🧺", 5,
                        _star(1, 2), 3, False, "take_one",
                        "订单完成后，从公共牌区拿取 1 张牌。",
                        "After completing, take 1 card out of the public row."),
    "jiehuosi": _order("jiehuosi", "截货肆", "Cargo Snatchers", "🚚", 5,
                       _star(1, 3), 3, False, "steal",
                       "订单完成后，随机抽取对手 1 张手牌。",
                       "After completing, steal 1 random card from an opponent."),
    "shuaiwandian": _order("shuaiwandian", "甩碗店", "Bowl Smashers", "🍜", 5,
                           _star(1, 3), 3, False, "extra_order",
                           "订单完成后，立刻额外获取 1 张新订单。",
                           "After completing, immediately gain 1 extra order."),
    "houchutang": _order("houchutang", "后厨堂", "Back Kitchen", "🍳", 5,
                         _star(1, 2) + [{"card": GARLIC_KEY}], 1, False, "spicy_bonus",
                         "每完成一单带辣味(🔥)标记的订单额外加 2 分。",
                         "Every completed spicy (🔥) order is worth 2 extra points."),
    "caishichang": _order("caishichang", "菜市场", "Wet Market", "🧺", 0,
                          [], 1, False, "hand_points",
                          "无需打出卡牌即可完成，游戏结束时剩余每张手牌加 1 分。",
                          "Needs no cards at all, and every card left in hand is worth 1 point at the end."),
    "apoguan": _order("apoguan", "阿婆馆", "Granny's House", "🏮", 8,
                      _star(1, 2) + [{"card": POISON_KEY}], 2, True, None,
                      "辣味(🔥)订单，没有额外技能。",
                      "A spicy (🔥) order with no extra skill."),
    "yunweiji": _order("yunweiji", "云味记", "Yun Flavours", "🏮", 12,
                       _star(1, 2) + [{"card": "niugan"}], 1, True, "take_two",
                       "完成订单后，从公共牌区取牌，每次可取 2 张。",
                       "After completing, take up to 2 cards out of the public row."),
    "yingyueju": _order("yingyueju", "映月居", "Moonlit Pavilion", "🌙", 12,
                        _star(1, 2) + [{"card": "zhusun"}], 1, False, "swap",
                        "只要它还没完成，每回合可以免费用 1 张手牌换取公共区 1 张牌。",
                        "While it is still open, swap 1 hand card for 1 public card free each turn."),
    "songrongge": _order("songrongge", "松茸阁", "Matsutake Pavilion", "⛩️", 20,
                         _star(2, 2) + [{"card": "songrong"}], 1, False, "extra_turn",
                         "订单完成后，该玩家立刻额外进行一个回合。",
                         "After completing, immediately take one extra turn."),
    "junwangfu": _order("junwangfu", "菌王府", "Mushroom Manor", "👑", 24,
                        _star(1, 1) + _star(2, 2) + [{"card": "songlu"}], 1, False, None,
                        "分数最高的订单，没有额外技能。",
                        "The highest scoring order, with no extra skill."),
    "jinxiuzhai": _order("jinxiuzhai", "锦绣斋", "Brocade Hall", "🏯", 16,
                         _star(2, 2) + [{"card": "ganba"}], 1, False, "star_hand",
                         "游戏结束时，手牌中每一张三星(★★★)菌加 3 分。",
                         "At the end, every three-star (★★★) mushroom in hand is worth 3 points."),
    "baizhenlou": _order("baizhenlou", "百珍楼", "Hundred Delicacies", "🏛️", 16,
                         _star(2, 3) + _star(3, 1), 1, False, "order_count",
                         "游戏结束时，每完成 1 张订单加 2 分。",
                         "At the end, every order you completed is worth 2 points."),
    "chaofanxianren": _order("chaofanxianren", "炒饭仙人", "Fried Rice Sage", "🍚", 16,
                             [{"card": GARLIC_KEY}, {"card": "niugan"}, {"card": "ganba"}],
                             1, True, None,
                             "辣味(🔥)订单，需要大蒜、牛肝菌与干巴菌各一张。",
                             "A spicy (🔥) order needing one Garlic, one Porcini and one Ganba Fungus."),
}

ORDER_DECK_SIZE = sum(order["copies"] for order in ORDERS.values())
CENTER_ORDERS = 2
HAND_ORDERS = 2
SPICY_KEYS = tuple(key for key, order in ORDERS.items() if order["spicy"])


ACTION_SCHEMA = {
    "type": "object",
    "oneOf": [
        {
            "type": "object",
            "properties": {
                "type": {"const": "draw"},
                "turn": {"type": "integer", "minimum": 1},
            },
            "required": ["type", "turn"],
            "additionalProperties": False,
        },
        {
            "type": "object",
            "properties": {
                "type": {"const": "keep"},
                "turn": {"type": "integer", "minimum": 1},
                "keep": {
                    "type": "array",
                    "items": {"type": "integer", "minimum": 0, "maximum": DRAW_COUNT - 1},
                    "minItems": 0,
                    "maxItems": DRAW_COUNT,
                    "uniqueItems": True,
                },
            },
            "required": ["type", "turn", "keep"],
            "additionalProperties": False,
        },
        {
            "type": "object",
            "properties": {
                "type": {"const": "take"},
                "turn": {"type": "integer", "minimum": 1},
                "card": {"type": "string", "minLength": 1, "maxLength": 40},
            },
            "required": ["type", "turn", "card"],
            "additionalProperties": False,
        },
        {
            "type": "object",
            "properties": {
                "type": {"const": "play"},
                "turn": {"type": "integer", "minimum": 1},
                "cards": {
                    "type": "array",
                    "items": {"type": "string", "minLength": 1, "maxLength": 40},
                    "minItems": 0,
                    "maxItems": 24,
                    "uniqueItems": True,
                },
                "choice": {"enum": ["score", "clear"]},
                "order": {"type": "string", "minLength": 1, "maxLength": 40},
            },
            "required": ["type", "turn", "cards"],
            "additionalProperties": False,
        },
        {
            "type": "object",
            "properties": {
                "type": {"const": "pick_order"},
                "turn": {"type": "integer", "minimum": 1},
                "order": {"type": "string", "minLength": 1, "maxLength": 40},
            },
            "required": ["type", "turn", "order"],
            "additionalProperties": False,
        },
        {
            "type": "object",
            "properties": {
                "type": {"const": "swap"},
                "turn": {"type": "integer", "minimum": 1},
                "give": {"type": "string", "minLength": 1, "maxLength": 40},
                "take": {"type": "string", "minLength": 1, "maxLength": 40},
            },
            "required": ["type", "turn", "give", "take"],
            "additionalProperties": False,
        },
        {
            "type": "object",
            "properties": {
                "type": {"const": "pass"},
                "turn": {"type": "integer", "minimum": 1},
            },
            "required": ["type", "turn"],
            "additionalProperties": False,
        },
        {
            "type": "object",
            "properties": {
                "type": {"const": "continue"},
                "turn": {"type": "integer", "minimum": 1},
            },
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
        "seed": {"type": ["integer", "null"]},
        "mode": {"enum": list(MODES)},
    },
    "additionalProperties": False,
}

ACTION_VALIDATOR = Draft7Validator(ACTION_SCHEMA)
CONFIG_VALIDATOR = Draft7Validator(CONFIG_SCHEMA)


# --- Small helpers -------------------------------------------------------

def card_key(card_id: str) -> str:
    """`qingtou#3` -> `qingtou`."""
    return card_id.split("#", 1)[0]


def card_view(card_id: str) -> Dict:
    card = CARDS[card_key(card_id)]
    return {
        "id": card_id,
        "key": card["key"],
        "zh": card["zh"],
        "en": card["en"],
        "emoji": card["emoji"],
        "star": card["star"],
        "points": card["points"],
        "kind": card["kind"],
        "text_zh": card["text_zh"],
        "text_en": card["text_en"],
    }


def slot_view(slot: Dict) -> Dict:
    """A requirement slot with everything the client needs to draw and match it."""
    if "card" in slot:
        card = CARDS[slot["card"]]
        return {
            "card": slot["card"],
            "star": card["star"],
            "zh": card["zh"],
            "en": card["en"],
            "emoji": card["emoji"],
        }
    return {
        "star": slot["star"],
        "zh": "★" * slot["star"] + "菌",
        "en": f"{slot['star']}-star mushroom",
        "emoji": "🍄",
    }


def order_view(order_id: str) -> Dict:
    order = ORDERS[order_key(order_id)]
    return {
        "id": order_id,
        "key": order["key"],
        "zh": order["zh"],
        "en": order["en"],
        "emoji": order["emoji"],
        "points": order["points"],
        "slots": [slot_view(slot) for slot in order["slots"]],
        "spicy": order["spicy"],
        "skill": order["skill"],
        "text_zh": order["text_zh"],
        "text_en": order["text_en"],
    }


def _as_tuple(value):
    return tuple(_as_tuple(item) for item in value) if isinstance(value, (list, tuple)) else value


def _json_random_state(rng: random.Random) -> List:
    version, numbers, gaussian = rng.getstate()
    return [version, list(numbers), gaussian]


def _rng(state: Dict) -> random.Random:
    rng = random.Random()
    rng.setstate(_as_tuple(state["rng_state"]))
    return rng


def _shuffle(state: Dict, items: List) -> None:
    rng = _rng(state)
    rng.shuffle(items)
    state["rng_state"] = _json_random_state(rng)


def _pick(state: Dict, items: List):
    """Remove and return one random element."""
    rng = _rng(state)
    choice = items[rng.randrange(len(items))]
    state["rng_state"] = _json_random_state(rng)
    return choice


def _sample(state: Dict, items: List, count: int) -> List:
    rng = _rng(state)
    picked = rng.sample(list(items), count)
    state["rng_state"] = _json_random_state(rng)
    return picked


def _log(state: Dict, message: str) -> None:
    state["log"].append(message)
    if len(state["log"]) > MAX_LOG_ENTRIES:
        del state["log"][: len(state["log"]) - MAX_LOG_ENTRIES]


def _name(state: Dict, player_id: str) -> str:
    return state["player_meta"].get(player_id, {}).get("name", player_id)


def _current_player(state: Dict) -> Optional[str]:
    if state["stage"] != STAGE_PLAY:
        return None
    return state["turn_order"][state["turn_index"]]


def _mode(state: Dict) -> str:
    return state["config"].get("mode", MODE_BASIC)


def build_deck(mode: str) -> List[str]:
    """Every card instance id for one ruleset."""
    field = "basic" if mode == MODE_BASIC else "orders"
    deck: List[str] = []
    for key, card in CARDS.items():
        for index in range(card[field]):
            deck.append(f"{key}#{index}")
    return deck


def build_order_deck() -> List[str]:
    deck: List[str] = []
    for key, order in ORDERS.items():
        for index in range(order["copies"]):
            deck.append(f"{key}#{index}")
    return deck


def order_key(order_id: str) -> str:
    return order_id.split("#", 1)[0]


# --- Scoring -------------------------------------------------------------

def play_score(cards: Sequence[str], choice: Optional[str]) -> int:
    """Points for one Basic-mode play. designs/task193.md §6.1."""
    keys = [card_key(card) for card in cards]
    counts = Counter(keys)
    has_boar = counts[BOAR_KEY] > 0
    has_fire = counts[FIRE_KEY] > 0
    has_garlic = counts[GARLIC_KEY] > 0

    base = 0
    for key, count in counts.items():
        card = CARDS[key]
        if key == POISON_KEY:
            base += card["points"] * count if has_fire else 0
        elif key == "songlu":
            base += card["points"] * count if has_boar else 0
        elif key == "maotou":
            base += card["points"] * count if choice != "clear" else 0
        else:
            base += card["points"] * count

    extra = 0
    for group in DOUBLING_KEYS:
        count = counts[group]
        if count >= SAME_KIND_THRESHOLD:
            extra += CARDS[group]["points"] * count
    if all(counts[key] > 0 for key in MOREL_KEYS):
        extra += MOREL_PAIR_BONUS

    subtotal = base + extra
    if has_garlic and any(counts[key] > 0 for key in WILD_KEYS):
        subtotal *= 2
    return subtotal


def play_is_legal(cards: Sequence[str], choice: Optional[str]) -> bool:
    """Structural legality of a Basic-mode play, ignoring whose hand it is."""
    if not cards:
        return False
    keys = [card_key(card) for card in cards]
    counts = Counter(keys)
    if any(key not in CARDS for key in keys):
        return False
    if counts[GARLIC_KEY] and not any(counts[key] for key in WILD_KEYS):
        return False
    if counts[FIRE_KEY] and not counts[POISON_KEY]:
        return False
    if counts[BOAR_KEY]:
        if counts["songlu"]:
            pass
        elif len(cards) != 1:
            return False
    if counts["maotou"]:
        if choice not in ("score", "clear"):
            return False
    elif choice is not None:
        return False
    return True


def play_clears_public(cards: Sequence[str], choice: Optional[str]) -> bool:
    keys = {card_key(card) for card in cards}
    return HAY_KEY in keys or (choice == "clear" and "maotou" in keys)


# --- Order matching ------------------------------------------------------

def match_order(order_id: str, cards: Sequence[str]) -> Optional[List[str]]:
    """Assign cards to the order's slots, or None when it cannot be filled."""
    slots = ORDERS[order_key(order_id)]["slots"]
    if len(cards) != len(slots):
        return None
    remaining = list(cards)
    assigned: List[Optional[str]] = [None] * len(slots)
    # Specific slots first: they are the constrained ones.
    order_of_slots = sorted(range(len(slots)), key=lambda i: 0 if "card" in slots[i] else 1)

    def solve(position: int) -> bool:
        if position == len(order_of_slots):
            return True
        index = order_of_slots[position]
        slot = slots[index]
        for card in list(remaining):
            key = card_key(card)
            if "card" in slot:
                if key != slot["card"]:
                    continue
            elif CARDS[key]["star"] != slot["star"]:
                continue
            remaining.remove(card)
            assigned[index] = card
            if solve(position + 1):
                return True
            assigned[index] = None
            remaining.append(card)
        return False

    if not solve(0):
        return None
    return [card for card in assigned if card is not None]


def order_ready(order_id: str, hand: Sequence[str]) -> bool:
    return match_order(order_id, _candidate_sets(order_id, hand)) is not None


def _candidate_sets(order_id: str, hand: Sequence[str]) -> List[str]:
    """A concrete card set that fills the order, or an empty list."""
    slots = ORDERS[order_key(order_id)]["slots"]
    if not slots:
        return []
    remaining = list(hand)
    picked: List[str] = []
    for slot in sorted(slots, key=lambda s: 0 if "card" in s else 1):
        found = None
        for card in remaining:
            key = card_key(card)
            if "card" in slot:
                if key == slot["card"]:
                    found = card
                    break
            elif CARDS[key]["star"] == slot["star"]:
                found = card
                break
        if found is None:
            return []
        remaining.remove(found)
        picked.append(found)
    # The greedy pass can fail where a full search succeeds, so verify it.
    if match_order(order_id, picked) is None:
        return []
    return picked


# --- Turn flow -----------------------------------------------------------

def _clear_public(state: Dict, reason: str) -> int:
    count = len(state["public"])
    if count:
        state["discard"].extend(state["public"])
        state["public"] = []
        _log(state, reason)
    return count


def _rampage(state: Dict, player_id: str) -> List[Dict]:
    """Wild Boar played alone: every other hand loses half its cards."""
    hits: List[Dict] = []
    for pid in state["turn_order"]:
        if pid == player_id:
            continue
        hand = state["players"][pid]["hand"]
        if not hand:
            continue
        count = (len(hand) + 1) // 2
        lost = _sample(state, hand, count)
        for card in lost:
            hand.remove(card)
        state["discard"].extend(lost)
        hits.append({"player": pid, "cards": lost})
        _log(state, f"野猪撞飞了 {_name(state, pid)} 的 {count} 张手牌。")
    return hits


def _refill_center(state: Dict) -> None:
    while len(state["order_center"]) < CENTER_ORDERS and state["order_deck"]:
        state["order_center"].append(state["order_deck"].pop())


def _apply_order_skill(state: Dict, player_id: str, order_id: str) -> Dict:
    """Immediate skills that fire the moment an order is completed."""
    skill = ORDERS[order_key(order_id)]["skill"]
    player = state["players"][player_id]
    info: Dict = {"skill": skill, "cards": [], "stolen": None, "order": None}
    if skill == "take_one" and state["public"]:
        card = state["public"].pop()
        player["hand"].append(card)
        info["cards"] = [card]
        _log(state, f"{_name(state, player_id)} 从公共牌区拿走了 {CARDS[card_key(card)]['zh']}。")
    elif skill == "take_two" and state["public"]:
        taken = []
        for _ in range(2):
            if not state["public"]:
                break
            card = state["public"].pop()
            player["hand"].append(card)
            taken.append(card)
        info["cards"] = taken
        if taken:
            _log(state, f"{_name(state, player_id)} 从公共牌区拿走了 {len(taken)} 张牌。")
    elif skill == "steal":
        targets = [pid for pid in state["turn_order"]
                   if pid != player_id and state["players"][pid]["hand"]]
        if targets:
            victim = targets[0] if len(targets) == 1 else _pick(state, targets)
            victim_hand = state["players"][victim]["hand"]
            card = _pick(state, victim_hand)
            victim_hand.remove(card)
            player["hand"].append(card)
            info["stolen"] = {"player": victim, "card": card}
            _log(state, f"{_name(state, player_id)} 抽走了 {_name(state, victim)} 的 1 张手牌。")
    elif skill == "extra_order" and state["order_deck"]:
        extra = state["order_deck"].pop()
        player["orders"].append(extra)
        info["order"] = extra
        _log(state, f"{_name(state, player_id)} 立刻多拿到一张订单 {ORDERS[order_key(extra)]['zh']}。")
    elif skill == "extra_turn":
        state["extra_turn"] = True
        _log(state, f"{_name(state, player_id)} 完成松茸阁，立刻多进行一个回合。")
    return info


def _end_turn(state: Dict) -> None:
    for player in state["players"].values():
        player["swap_used"] = False
    state["pending_draw"] = None
    state["phase"] = PHASE_ACTION
    if state["extra_turn"]:
        state["extra_turn"] = False
        state["turn"] += 1
        return
    if state["final_turns_left"] is not None:
        state["final_turns_left"] -= 1
        if state["final_turns_left"] <= 0:
            _start_scoring(state)
            return
    state["turn_index"] = (state["turn_index"] + 1) % len(state["turn_order"])
    state["turn"] += 1


def _start_scoring(state: Dict) -> None:
    state["stage"] = STAGE_SCORING
    state["phase"] = PHASE_ACTION
    state["continue_ready"] = []
    state["final_scores"] = _final_scores(state)
    best = max(entry["total"] for entry in state["final_scores"].values())
    winners = [pid for pid, entry in state["final_scores"].items() if entry["total"] == best]
    state["winners"] = winners
    _log(state, "菌窝见底，本局结束，开始结算。")


def _final_scores(state: Dict) -> Dict[str, Dict]:
    scores: Dict[str, Dict] = {}
    for pid in state["turn_order"]:
        player = state["players"][pid]
        hand = player["hand"]
        lines: List[Dict] = []
        total = 0
        if _mode(state) == MODE_BASIC:
            played = sum(entry["points"] for entry in player["score_cards"])
            total += played
            lines.append({"label_zh": "得分区", "label_en": "Scored cards", "points": played})
        else:
            done = player["done_orders"]
            order_points = sum(ORDERS[order_key(oid)]["points"] for oid in done)
            total += order_points
            lines.append({"label_zh": "完成订单", "label_en": "Completed orders", "points": order_points})
            done_keys = [order_key(oid) for oid in done]
            if "houchutang" in done_keys:
                bonus = 2 * sum(1 for key in done_keys if ORDERS[key]["spicy"])
                total += bonus
                lines.append({"label_zh": "后厨堂辣味加成", "label_en": "Back Kitchen spicy bonus", "points": bonus})
            if "caishichang" in done_keys:
                bonus = len(hand)
                total += bonus
                lines.append({"label_zh": "菜市场手牌", "label_en": "Wet Market hand", "points": bonus})
            if "jinxiuzhai" in done_keys:
                bonus = 3 * sum(1 for card in hand if CARDS[card_key(card)]["star"] == 3)
                total += bonus
                lines.append({"label_zh": "锦绣斋三星手牌", "label_en": "Brocade Hall three-star hand", "points": bonus})
            if "baizhenlou" in done_keys:
                bonus = 2 * len(done)
                total += bonus
                lines.append({"label_zh": "百珍楼订单数", "label_en": "Hundred Delicacies orders", "points": bonus})
        poison = sum(1 for card in hand if card_key(card) == POISON_KEY)
        if poison:
            penalty = -HAND_POISON_PENALTY * poison
            total += penalty
            lines.append({"label_zh": f"手里的见手青 ×{poison}", "label_en": f"Blueing Bolete in hand ×{poison}", "points": penalty})
        scores[pid] = {"total": total, "lines": lines}
    return scores


def _reset_for_rematch(state: Dict) -> None:
    config = state["config"]
    rng = random.Random(config.get("seed"))
    state["rng_state"] = _json_random_state(rng)
    state["players"] = {pid: _new_player() for pid in state["turn_order"]}
    _deal(state)
    state["turn"] = 1
    state["turn_index"] = 0
    state["stage"] = STAGE_PLAY
    state["phase"] = PHASE_ACTION
    state["pending_draw"] = None
    state["extra_turn"] = False
    state["final_turns_left"] = None
    state["final_scores"] = None
    state["winners"] = []
    state["continue_ready"] = []
    state["rematch_ready"] = []
    state["game_over"] = False
    state["seq"] = 0
    state["last_play"] = None
    state["log"] = []


def _new_player() -> Dict:
    return {
        "hand": [],
        "score_cards": [],
        "score": 0,
        "orders": [],
        "done_orders": [],
        "swap_used": False,
    }


def _deal(state: Dict) -> None:
    mode = _mode(state)
    deck = build_deck(mode)
    _shuffle(state, deck)
    state["deck"] = deck
    state["public"] = []
    state["discard"] = []
    state["pending_draw"] = None
    state["extra_turn"] = False
    state["final_turns_left"] = None
    if mode == MODE_ORDERS:
        order_deck = build_order_deck()
        _shuffle(state, order_deck)
        state["order_deck"] = order_deck
        state["order_center"] = []
        for pid in state["turn_order"]:
            player = state["players"][pid]
            player["orders"] = []
            for _ in range(HAND_ORDERS):
                if state["order_deck"]:
                    player["orders"].append(state["order_deck"].pop())
        _refill_center(state)
        _log(state, "玩法二开局，每人面前两张订单，桌面中央两张订单。")
    else:
        state["order_deck"] = []
        state["order_center"] = []
        _log(state, "玩法一开局，62 张菌类牌洗匀成菌窝。")


# --- Bot -----------------------------------------------------------------
# A purpose-built evaluation policy, so this game is listed in
# game/ai_metadata.py and Select Game shows 🤖. See designs/task193.md §8.

def _evaluate_play(cards: Sequence[str], public_size: int):
    """(choice, points, value) for a candidate play, value None when illegal.

    Wiping the public row is worth half a point per card it takes away, so the
    bot reaches for Shaggy Mane's second mode when the row is fat.
    """
    if not cards:
        return None, 0, None
    if any(card_key(card) == "maotou" for card in cards):
        if not play_is_legal(cards, "score"):
            return None, 0, None
        scored = play_score(cards, "score")
        cleared = play_score(cards, "clear")
        clear_value = cleared + public_size * 0.5
        if clear_value > scored:
            return "clear", cleared, clear_value
        return "score", scored, float(scored)
    if not play_is_legal(cards, None):
        return None, 0, None
    points = play_score(cards, None)
    return None, points, float(points)


def _best_basic_play(state: Dict, hand: Sequence[str], public_size: Optional[int] = None):
    """Greedy hill climb from several seeds. Returns (cards, choice, points, value)."""
    pool = list(hand)
    if public_size is None:
        public_size = len(state["public"])
    best_cards: List[str] = []
    best_choice: Optional[str] = None
    best_points = 0
    best_value = -1.0

    seeds: List[List[str]] = [[]]
    for card in pool:
        seeds.append([card])
    for seed in seeds:
        current = list(seed)
        while True:
            value = _evaluate_play(current, public_size)[2]
            if value is None:
                value = -1.0
            improved = False
            for card in pool:
                if card in current:
                    continue
                trial = current + [card]
                trial_value = _evaluate_play(trial, public_size)[2]
                if trial_value is not None and trial_value > value:
                    current, value = trial, trial_value
                    improved = True
                    break
            if not improved:
                if current:
                    choice, points, final = _evaluate_play(current, public_size)
                    if final is not None and final > best_value:
                        best_cards, best_choice = list(current), choice
                        best_points, best_value = points, final
                break
    return best_cards, best_choice, best_points, best_value


def _hand_value(state: Dict, hand: Sequence[str], public_size: Optional[int] = None) -> float:
    """How much a hand is worth, used to price a public card or a kept card."""
    if not hand:
        return 0.0
    if public_size is None:
        public_size = len(state["public"])
    value = _best_basic_play(state, hand, public_size)[3]
    poison = sum(1 for card in hand if card_key(card) == POISON_KEY)
    return max(0.0, value) - poison * 2.0


def _bot_basic(state: Dict, bot_id: str) -> Optional[Dict]:
    turn = state["turn"]
    player = state["players"][bot_id]
    hand = player["hand"]
    cards, choice, points, _ = _best_basic_play(state, hand)
    deck_empty = not state["deck"]

    if cards and (points >= 4 or deck_empty):
        action = {"type": "play", "turn": turn, "cards": cards}
        if choice is not None:
            action["choice"] = choice
        return action

    if state["public"]:
        base = _hand_value(state, hand, len(state["public"]))
        best_card, best_gain = None, 1.5
        for card in state["public"]:
            gain = _hand_value(state, hand + [card], len(state["public"]) - 1) - base
            if gain > best_gain:
                best_card, best_gain = card, gain
        if best_card is not None:
            return {"type": "take", "turn": turn, "card": best_card}

    if state["deck"]:
        return {"type": "draw", "turn": turn}
    if cards:
        action = {"type": "play", "turn": turn, "cards": cards}
        if choice is not None:
            action["choice"] = choice
        return action
    if state["public"]:
        return {"type": "take", "turn": turn, "card": state["public"][0]}
    return {"type": "pass", "turn": turn}


def _order_cost(cards: Sequence[str]) -> float:
    """Rough value of the cards an order consumes."""
    cost = 0.0
    for card in cards:
        key = card_key(card)
        card_data = CARDS[key]
        cost += card_data["points"]
        if key == POISON_KEY:
            cost += 6
        if key in ("songlu", "songrong", "ganba"):
            cost += 3
    return cost


def _bot_orders(state: Dict, bot_id: str) -> Optional[Dict]:
    turn = state["turn"]
    player = state["players"][bot_id]
    hand = list(player["hand"])

    # 1. Finish the most valuable order we can already pay for.
    best_order, best_cards, best_gain = None, None, 0.0
    for order_id in player["orders"]:
        cards = _candidate_sets(order_id, hand)
        if match_order(order_id, cards) is None:
            continue
        gain = ORDERS[order_key(order_id)]["points"] - _order_cost(cards)
        if ORDERS[order_key(order_id)]["skill"] in ("extra_turn", "take_two", "steal", "extra_order"):
            gain += 3
        if best_order is None or gain > best_gain:
            best_order, best_cards, best_gain = order_id, cards, gain
    if best_order is not None:
        return {"type": "play", "turn": turn, "order": best_order, "cards": best_cards}

    # 2. Moonlit Pavilion swap, when the public row clearly offers more.
    if _swap_available(state, bot_id) and state["public"]:
        worst = min(hand, key=lambda card: CARDS[card_key(card)]["points"])
        best_public = max(state["public"], key=lambda card: _need_score(state, bot_id, card))
        if _need_score(state, bot_id, best_public) > _need_score(state, bot_id, worst) + 1:
            return {"type": "swap", "turn": turn, "give": worst, "take": best_public}

    # 3. Take a public card that pushes an order forward.
    if state["public"]:
        best_card, best_value = None, 0.0
        for card in state["public"]:
            value = _need_score(state, bot_id, card)
            if value > best_value:
                best_card, best_value = card, value
        if best_card is not None:
            return {"type": "take", "turn": turn, "card": best_card}

    if state["deck"]:
        return {"type": "draw", "turn": turn}
    if state["public"]:
        return {"type": "take", "turn": turn, "card": state["public"][0]}
    return {"type": "pass", "turn": turn}


def _need_score(state: Dict, bot_id: str, card: str) -> float:
    """How much a single card helps this bot's open orders."""
    player = state["players"][bot_id]
    key = card_key(card)
    score = 0.0
    for order_id in player["orders"]:
        slots = ORDERS[order_key(order_id)]["slots"]
        for slot in slots:
            if "card" in slot and slot["card"] == key:
                score = max(score, ORDERS[order_key(order_id)]["points"] / max(1, len(slots)) + 4)
            elif "star" in slot and CARDS[key]["star"] == slot["star"]:
                score = max(score, ORDERS[order_key(order_id)]["points"] / max(1, len(slots)))
    if key == POISON_KEY:
        score -= 5
    return score


def _swap_available(state: Dict, player_id: str) -> bool:
    player = state["players"][player_id]
    if player["swap_used"] or not player["hand"] or not state["public"]:
        return False
    return any(order_key(oid) == "yingyueju" for oid in player["orders"])


def _bot_keep(state: Dict, bot_id: str) -> Dict:
    pending = state["pending_draw"] or []
    turn = state["turn"]
    if len(pending) <= KEEP_COUNT:
        return {"type": "keep", "turn": turn, "keep": list(range(len(pending)))}
    if _mode(state) == MODE_ORDERS:
        ranked = sorted(range(len(pending)),
                        key=lambda i: _need_score(state, bot_id, pending[i]), reverse=True)
    else:
        ranked = sorted(range(len(pending)),
                        key=lambda i: _hand_value(state, [pending[i]], len(state["public"])), reverse=True)
    return {"type": "keep", "turn": turn, "keep": sorted(ranked[:KEEP_COUNT])}


def _bot_pick_order(state: Dict, bot_id: str) -> Dict:
    turn = state["turn"]
    center = state["order_center"]
    hand = state["players"][bot_id]["hand"]

    def rank(order_id: str) -> float:
        order = ORDERS[order_key(order_id)]
        ready = 1.0 if _candidate_sets(order_id, hand) else 0.0
        return order["points"] / max(1, len(order["slots"])) + ready * 6

    best = max(center, key=rank)
    return {"type": "pick_order", "turn": turn, "order": best}


def _bot_choose_action(state: Dict, bot_id: str) -> Optional[Dict]:
    stage = state["stage"]
    if stage == STAGE_GAME_OVER:
        return {"type": "play_again"}
    if stage == STAGE_SCORING:
        return {"type": "continue", "turn": state["turn"]}
    if _current_player(state) != bot_id:
        return None
    if state["phase"] == PHASE_KEEP:
        return _bot_keep(state, bot_id)
    if state["phase"] == PHASE_PICK_ORDER:
        return _bot_pick_order(state, bot_id)
    if _mode(state) == MODE_ORDERS:
        return _bot_orders(state, bot_id)
    return _bot_basic(state, bot_id)


# --- Serialization guard -------------------------------------------------

def _validate_saved_state(state: Dict) -> None:
    def require(condition: bool) -> None:
        if not condition:
            raise ValueError("invalid Mushroom Picking saved state")

    try:
        require(isinstance(state, dict) and state["game_id"] == "mushroom_picking"
                and state["version"] == 1)
        order = state["turn_order"]
        require(isinstance(order, list) and 2 <= len(order) <= 4
                and len(set(order)) == len(order) and all(order))
        require(set(state["players"]) == set(order) and set(state["player_meta"]) == set(order))
        require(state["player_count"] == len(order))
        require(state["config"].get("mode", MODE_BASIC) in MODES)
        require(state["stage"] in (STAGE_PLAY, STAGE_SCORING, STAGE_GAME_OVER))
        require(state["phase"] in (PHASE_ACTION, PHASE_KEEP, PHASE_PICK_ORDER))
        require(type(state["game_over"]) is bool
                and state["game_over"] == (state["stage"] == STAGE_GAME_OVER))
        require(type(state["turn"]) is int and state["turn"] >= 1)
        require(type(state["turn_index"]) is int and 0 <= state["turn_index"] < len(order))

        for pid in order:
            player = state["players"][pid]
            require(set(player) == {"hand", "score_cards", "score", "orders",
                                    "done_orders", "swap_used"})
            require(all(card_key(card) in CARDS for card in player["hand"]))
            require(isinstance(player["score_cards"], list))
            require(type(player["score"]) is int)
            require(all(order_key(oid) in ORDERS for oid in player["orders"]))
            require(all(order_key(oid) in ORDERS for oid in player["done_orders"]))
            require(type(player["swap_used"]) is bool)

        require(all(card_key(card) in CARDS for card in state["deck"]))
        require(all(card_key(card) in CARDS for card in state["public"]))
        require(all(card_key(card) in CARDS for card in state["discard"]))
        require(state["pending_draw"] is None
                or all(card_key(card) in CARDS for card in state["pending_draw"]))
        require(all(order_key(oid) in ORDERS for oid in state["order_deck"]))
        require(all(order_key(oid) in ORDERS for oid in state["order_center"]))
        require(len(state["order_center"]) <= CENTER_ORDERS)
        require(isinstance(state["log"], list) and all(isinstance(line, str) for line in state["log"]))
        require(isinstance(state["continue_ready"], list) and set(state["continue_ready"]) <= set(order))
        require(isinstance(state["rematch_ready"], list) and set(state["rematch_ready"]) <= set(order))
        require(isinstance(state["winners"], list) and set(state["winners"]) <= set(order))
        require(state["final_turns_left"] is None
                or (type(state["final_turns_left"]) is int and state["final_turns_left"] >= 0))
        rng = random.Random()
        rng.setstate(_as_tuple(state["rng_state"]))
    except (KeyError, TypeError, IndexError, AttributeError, OverflowError, ValueError) as error:
        if isinstance(error, ValueError) and str(error).startswith("invalid Mushroom Picking"):
            raise
        raise ValueError("invalid Mushroom Picking saved state") from error


# --- Game module ---------------------------------------------------------

class MushroomPickingGame:
    game_id = "mushroom_picking"
    min_players = 2
    max_players = 4

    @staticmethod
    def init_game(config: Optional[Dict], players: List[Dict]) -> Dict:
        cfg = {} if config is None else copy.deepcopy(config)
        if not CONFIG_VALIDATOR.is_valid(cfg):
            raise ValueError("invalid Mushroom Picking configuration")
        if not 2 <= len(players) <= 4:
            raise ValueError("Mushroom Picking requires 2-4 players")
        ordered = sorted(players, key=lambda player: player.get("seat", 0))
        ids = [player["player_id"] for player in ordered]
        if len(set(ids)) != len(ids) or any(not isinstance(pid, str) or not pid for pid in ids):
            raise ValueError("player IDs must be unique nonempty strings")
        rng = random.Random(cfg.get("seed"))
        state = {
            "game_id": MushroomPickingGame.game_id,
            "version": 1,
            "config": {"mode": cfg.get("mode", MODE_BASIC)},
            "rng_state": _json_random_state(rng),
            "turn_order": ids,
            "player_count": len(ids),
            "player_meta": {player["player_id"]: copy.deepcopy(player) for player in ordered},
            "players": {pid: _new_player() for pid in ids},
            "deck": [],
            "public": [],
            "discard": [],
            "order_deck": [],
            "order_center": [],
            "pending_draw": None,
            "extra_turn": False,
            "final_turns_left": None,
            "final_scores": None,
            "winners": [],
            "continue_ready": [],
            "rematch_ready": [],
            "last_play": None,
            "stage": STAGE_PLAY,
            "phase": PHASE_ACTION,
            "turn": 1,
            "turn_index": 0,
            "game_over": False,
            "seq": 0,
            "log": [],
        }
        _deal(state)
        return state

    @staticmethod
    def get_legal_actions(state: Dict, player_id: str) -> List[str]:
        if player_id not in state["players"]:
            return []
        if state["stage"] == STAGE_GAME_OVER:
            return [] if player_id in state["rematch_ready"] else ["play_again"]
        if state["stage"] == STAGE_SCORING:
            return [] if player_id in state["continue_ready"] else ["continue"]
        if _current_player(state) != player_id:
            return []
        if state["phase"] == PHASE_KEEP:
            return ["keep"]
        if state["phase"] == PHASE_PICK_ORDER and state["order_center"]:
            return ["pick_order"]
        actions: List[str] = []
        player = state["players"][player_id]
        if state["deck"]:
            actions.append("draw")
        if state["public"]:
            actions.append("take")
        if MushroomPickingGame._has_legal_play(state, player_id):
            actions.append("play")
        if _swap_available(state, player_id):
            actions.append("swap")
        if not actions:
            actions.append("pass")
        return actions

    @staticmethod
    def _has_legal_play(state: Dict, player_id: str) -> bool:
        player = state["players"][player_id]
        hand = player["hand"]
        if _mode(state) == MODE_ORDERS:
            return any(_candidate_sets(oid, hand) or not ORDERS[order_key(oid)]["slots"]
                       for oid in player["orders"])
        keys = {card_key(card) for card in hand}
        if not keys:
            return False
        for card in hand:
            if play_is_legal([card], "score" if card_key(card) == "maotou" else None):
                return True
        for first in hand:
            for second in hand:
                if first == second:
                    continue
                pair = [first, second]
                if play_is_legal(pair, "score" if "maotou" in {card_key(c) for c in pair} else None):
                    return True
        return False

    @staticmethod
    def apply_action(state: Dict, player_id: str, action: Dict) -> Tuple[List[Dict], Optional[str]]:
        if not isinstance(action, dict) or not ACTION_VALIDATOR.is_valid(action):
            return [], "invalid action schema"
        if player_id not in state["players"]:
            return [], "player not found"
        action_type = action["type"]
        if action_type != "play_again" and action.get("turn") != state["turn"]:
            return [], "stale turn"
        if action_type not in MushroomPickingGame.get_legal_actions(state, player_id):
            return [], "action unavailable right now"

        if action_type == "play_again":
            state["rematch_ready"].append(player_id)
            if len(state["rematch_ready"]) == len(state["turn_order"]):
                _reset_for_rematch(state)
            return [], None

        if action_type == "continue":
            state["continue_ready"].append(player_id)
            if len(state["continue_ready"]) == len(state["turn_order"]):
                state["stage"] = STAGE_GAME_OVER
                state["game_over"] = True
            return [], None

        if action_type == "draw":
            drawn = [state["deck"].pop() for _ in range(min(DRAW_COUNT, len(state["deck"])))]
            state["pending_draw"] = drawn
            state["phase"] = PHASE_KEEP
            if not state["deck"]:
                # The player who emptied the nest still finishes this turn, so
                # the count covers their own turn plus one more for everybody.
                state["final_turns_left"] = state["player_count"] + 1
                _log(state, f"{_name(state, player_id)} 抽走了菌窝最后一张牌，每人还剩最后一个回合。")
            _log(state, f"{_name(state, player_id)} 从菌窝摸了 {len(drawn)} 张牌，正在挑牌。")
            return [], None

        if action_type == "keep":
            pending = state["pending_draw"] or []
            keep = sorted(set(action["keep"]))
            expected = min(KEEP_COUNT, len(pending))
            if len(keep) != expected or any(index >= len(pending) for index in keep):
                return [], "you must keep exactly the right number of cards"
            kept = [pending[index] for index in keep]
            dropped = [card for index, card in enumerate(pending) if index not in keep]
            player = state["players"][player_id]
            player["hand"].extend(kept)
            state["public"].extend(dropped)
            state["pending_draw"] = None
            _log(state, f"{_name(state, player_id)} 留下 {len(kept)} 张，"
                        f"{len(dropped)} 张进了公共牌区。")
            _end_turn(state)
            return [], None

        if action_type == "take":
            card = action["card"]
            if card not in state["public"]:
                return [], "that card is not in the public row"
            state["public"].remove(card)
            state["players"][player_id]["hand"].append(card)
            _log(state, f"{_name(state, player_id)} 从公共牌区拿走了 {CARDS[card_key(card)]['zh']}。")
            _end_turn(state)
            return [], None

        if action_type == "swap":
            give, take = action["give"], action["take"]
            player = state["players"][player_id]
            if give not in player["hand"]:
                return [], "that card is not in your hand"
            if take not in state["public"]:
                return [], "that card is not in the public row"
            player["hand"].remove(give)
            state["public"].remove(take)
            player["hand"].append(take)
            state["public"].append(give)
            player["swap_used"] = True
            _log(state, f"{_name(state, player_id)} 用映月居换掉了 {CARDS[card_key(give)]['zh']}，"
                        f"换来 {CARDS[card_key(take)]['zh']}。")
            return [], None

        if action_type == "pass":
            _log(state, f"{_name(state, player_id)} 无牌可打，跳过回合。")
            _end_turn(state)
            return [], None

        if action_type == "pick_order":
            order_id = action["order"]
            if order_id not in state["order_center"]:
                return [], "that order is not in the centre"
            state["order_center"].remove(order_id)
            state["players"][player_id]["orders"].append(order_id)
            _refill_center(state)
            _log(state, f"{_name(state, player_id)} 接下了新订单 {ORDERS[order_key(order_id)]['zh']}。")
            _end_turn(state)
            return [], None

        # play
        cards = list(action["cards"])
        player = state["players"][player_id]
        if len(set(cards)) != len(cards) or any(card not in player["hand"] for card in cards):
            return [], "those cards are not in your hand"

        if _mode(state) == MODE_ORDERS:
            return MushroomPickingGame._apply_order(state, player_id, action, cards)
        return MushroomPickingGame._apply_basic(state, player_id, action, cards)

    @staticmethod
    def _apply_basic(state: Dict, player_id: str, action: Dict, cards: List[str]):
        choice = action.get("choice")
        if not play_is_legal(cards, choice):
            return [], "that combination cannot be played"
        points = play_score(cards, choice)
        player = state["players"][player_id]
        for card in cards:
            player["hand"].remove(card)
        entry = {
            "seq": state["seq"],
            "player": player_id,
            "cards": list(cards),
            "points": points,
            "choice": choice,
        }
        state["seq"] += 1
        player["score_cards"].append(entry)
        player["score"] += points
        state["last_play"] = copy.deepcopy(entry)
        labels = "、".join(CARDS[card_key(card)]["zh"] for card in cards)
        _log(state, f"{_name(state, player_id)} 打出 {labels}，得 {points} 分。")
        if play_clears_public(cards, choice):
            _clear_public(state, "公共牌区被清空，牌全部进了弃牌堆。")
        if any(card_key(card) == BOAR_KEY for card in cards) and not any(
                card_key(card) == "songlu" for card in cards):
            _rampage(state, player_id)
            state["discard"].extend(cards)
            player["score_cards"][-1]["rampage"] = True
        else:
            # Dry Grass is spent rather than kept, so it never sits in a score
            # area taking up space.
            spent = [card for card in cards if card_key(card) == HAY_KEY]
            if spent:
                entry["cards"] = [card for card in cards if card not in spent]
                player["score_cards"][-1]["cards"] = list(entry["cards"])
                state["discard"].extend(spent)
        _end_turn(state)
        return [], None

    @staticmethod
    def _apply_order(state: Dict, player_id: str, action: Dict, cards: List[str]):
        order_id = action.get("order")
        player = state["players"][player_id]
        if order_id not in player["orders"]:
            return [], "that order is not in front of you"
        slots = ORDERS[order_key(order_id)]["slots"]
        if not slots:
            if cards:
                return [], "this order needs no cards"
        elif match_order(order_id, cards) is None:
            return [], "those cards do not fill the order"
        for card in cards:
            player["hand"].remove(card)
        state["discard"].extend(cards)
        player["orders"].remove(order_id)
        player["done_orders"].append(order_id)
        points = ORDERS[order_key(order_id)]["points"]
        player["score"] += points
        info = _apply_order_skill(state, player_id, order_id)
        entry = {
            "seq": state["seq"],
            "player": player_id,
            "order": order_id,
            "cards": list(cards),
            "points": points,
            "skill": info,
        }
        state["seq"] += 1
        state["last_play"] = copy.deepcopy(entry)
        _log(state, f"{_name(state, player_id)} 完成了订单 {ORDERS[order_key(order_id)]['zh']}，"
                    f"得 {points} 分。")
        if state["order_center"]:
            state["phase"] = PHASE_PICK_ORDER
        else:
            _end_turn(state)
        return [], None

    @staticmethod
    def get_public_view(state: Dict, viewer_id: str) -> Dict:
        current = _current_player(state)
        reveal_hands = state["stage"] in (STAGE_SCORING, STAGE_GAME_OVER)
        pending = state["pending_draw"]

        players_view = []
        for index, pid in enumerate(state["turn_order"]):
            player = state["players"][pid]
            meta = state["player_meta"][pid]
            mine = pid == viewer_id
            grouped = Counter(card_key(card) for entry in player["score_cards"] for card in entry["cards"])
            players_view.append({
                "player_id": pid,
                "name": meta.get("name", pid),
                "seat": meta.get("seat", index),
                "is_bot": bool(meta.get("is_bot", False)),
                "is_you": mine,
                "is_current": pid == current,
                "hand_count": len(player["hand"]),
                "hand": [card_view(card) for card in player["hand"]] if (mine or reveal_hands) else None,
                "score": player["score"],
                "plays": len(player["score_cards"]),
                "scored_groups": [
                    {"key": key, "count": count, "zh": CARDS[key]["zh"],
                     "emoji": CARDS[key]["emoji"]}
                    for key, count in sorted(grouped.items(), key=lambda item: -item[1])
                ],
                "orders": [order_view(oid) for oid in player["orders"]],
                "done_orders": [order_view(oid) for oid in player["done_orders"]],
                "orders_ready": [oid for oid in player["orders"]
                                 if mine and (_candidate_sets(oid, player["hand"])
                                              or not ORDERS[order_key(oid)]["slots"])],
                "swap_used": player["swap_used"],
            })

        last_play = copy.deepcopy(state["last_play"])
        if last_play:
            if "cards" in last_play:
                last_play["card_views"] = [card_view(card) for card in last_play["cards"]]
            if last_play.get("order"):
                last_play["order_view"] = order_view(last_play["order"])

        return copy.deepcopy({
            "game_id": MushroomPickingGame.game_id,
            "mode": _mode(state),
            "stage": state["stage"],
            "phase": state["phase"],
            "turn": state["turn"],
            "you": viewer_id,
            "current_player": current,
            "players": players_view,
            "deck_count": len(state["deck"]),
            "public": [card_view(card) for card in state["public"]],
            "discard_count": len(state["discard"]),
            "order_center": [order_view(oid) for oid in state["order_center"]],
            "order_deck_count": len(state["order_deck"]),
            "pending_draw": [card_view(card) for card in pending]
            if (pending and current == viewer_id) else None,
            "pending_count": len(pending) if pending else 0,
            "final_turns_left": state["final_turns_left"],
            "last_play": last_play,
            "final_scores": state["final_scores"] if reveal_hands else None,
            "winners": list(state["winners"]) if reveal_hands else [],
            "continue_ready": list(state["continue_ready"]),
            "rematch_ready": list(state["rematch_ready"]),
            "game_over": state["game_over"],
            "legal_actions": MushroomPickingGame.get_legal_actions(state, viewer_id),
            "log": list(state["log"]),
        })

    @staticmethod
    def bot_move(state: Dict, bot_id: str) -> Optional[Dict]:
        if state.get("game_over") and bot_id in state.get("rematch_ready", []):
            return None
        if not MushroomPickingGame.get_legal_actions(state, bot_id):
            return None
        return _bot_choose_action(state, bot_id)

    @staticmethod
    def serialize(state: Dict) -> Dict:
        return copy.deepcopy(state)

    @staticmethod
    def deserialize(payload: Dict) -> Dict:
        restored = copy.deepcopy(payload)
        _validate_saved_state(restored)
        return restored


__all__ = [
    "ACTION_SCHEMA",
    "BASIC_DECK_SIZE",
    "CARDS",
    "CONFIG_SCHEMA",
    "MODE_BASIC",
    "MODE_ORDERS",
    "MODES",
    "ORDERS",
    "ORDER_DECK_SIZE",
    "MushroomPickingGame",
    "build_deck",
    "build_order_deck",
    "card_key",
    "card_view",
    "match_order",
    "order_key",
    "order_view",
    "play_is_legal",
    "play_score",
]
