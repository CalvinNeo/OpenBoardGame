from typing import Dict


SUITS = {
    "claws": {"name": "Claws", "name_zh": "利爪", "icon": "🐾"},
    "flowers": {"name": "Flowers", "name_zh": "繁花", "icon": "🌸"},
    "eyes": {"name": "Eyes", "name_zh": "慧眼", "icon": "👁"},
    "leaves": {"name": "Leaves", "name_zh": "枝叶", "icon": "🍃"},
}
RANKS = {
    "jack": "侍从",
    "queen": "王后",
    "king": "国王",
    "prince": "王子",
    "lady": "夫人",
    "baron": "男爵",
}
STARS = [4, 3, 2, 1, 1, 2, 3, 4]
CARDS = {
    f"{suit}_{value}": {"id": f"{suit}_{value}", "suit": suit, "value": value}
    for suit in SUITS
    for value in range(1, 9)
}

_ABILITIES = {
    "claws": [
        ("Draw until you have eight cards in hand.", "将手牌补到八张。", "🦊"),
        ("Draw the top card of the deck, discard pile and score pile.", "从牌库、弃牌堆和得分堆各取顶牌一张。", "🐱"),
        ("Put every highest-valued card in your hand into the score pile.", "将手中点数最大的所有牌放入得分堆。", "🐺"),
        ("Draw one card at a time. Stop when you draw a trump or choose to stop.", "逐张抽牌，抽到王牌或主动停止时结束，至少抽一张。", "🦁"),
        ("Discard one of your lowest cards, then draw cards equal to its value.", "弃掉一张点数最小的手牌，再抽取等同其点数的牌。", "🐯"),
        ("Choose a hand card. Draw all cards of that value from the deck, then shuffle it.", "选择一张手牌，将牌库中同点数的所有牌收入手中，再洗牌。", "🐻"),
    ],
    "flowers": [
        ("Discard every card in hand that matches the current trump suit.", "弃掉手中所有当前王牌花色的牌。", "🐰"),
        ("Put the top card of the score pile on top of the deck.", "将得分堆顶牌放回牌库顶，得分减少一。", "🦌"),
        ("Discard exactly two cards whose values add up to nine.", "弃掉点数之和恰为九的两张手牌。", "🐐"),
        ("Keep exactly one card of each value in hand. Discard all duplicates.", "手中每种点数恰好保留一张，弃掉所有重复牌。", "🐑"),
        ("Discard a card whose value equals your current hand size.", "弃掉一张点数等于当前手牌张数的牌。", "🐭"),
        ("Discard every card in hand with value one, two or three.", "弃掉手中点数为一、二或三的所有牌。", "🦔"),
    ],
    "eyes": [
        ("Draw two cards, then discard two cards.", "抽两张牌，再弃两张牌。", "🦉"),
        ("Look at the top three deck cards without changing their order.", "查看牌库顶三张牌，不改变顺序。", "🦅"),
        ("Name a suit, draw two cards, then discard every hand card of that suit.", "先指定花色，再抽两张牌，然后弃掉手中该花色的所有牌。", "🐸"),
        ("Discard a card, then draw a card. Repeat once for each other exhausted ally.", "弃一张再抽一张，每有另一位已耗竭盟友，就额外重复一次。", "🐦"),
        ("Draw two cards, then discard cards whose values total the drawn cards' total.", "抽两张牌，再弃掉点数总和等于所抽牌点数总和的任意张手牌。", "🦇"),
        ("After your next response, draw a card if it is even, or discard a card if it is odd.", "打出下一张回应牌后，若点数为偶数则抽一张，否则弃一张。", "🐢"),
    ],
    "leaves": [
        ("Exchange the current ruler with an unvisited ruler one or two fiefs away.", "将当前领主与距离一或二的未访问领主互换，目标墩数不变。", "🐿"),
        ("Use the current ruler's ability.", "执行当前领主的能力。", "🦝"),
        ("Look at the deck's top card and exchange it with a different card in hand.", "查看牌库顶牌，并必须用一张原有手牌与它交换。", "🐗"),
        ("Move this visit to the nearest unvisited fief on either side.", "将此次出访移到左侧或右侧最近的未访问领地。", "🦫"),
        ("Draw a card, then refresh another exhausted ally if there is one.", "抽一张牌，然后必须重置另一位已耗竭盟友，若没有则只抽牌。", "🦡"),
        ("You may swap a hand card with the discard top of the same value, then do the same with the score top.", "可以用同点数手牌交换弃牌堆顶，再以相同方式交换得分堆顶。", "🦦"),
    ],
}


def _characters() -> Dict[str, Dict]:
    result = {}
    for suit, abilities in _ABILITIES.items():
        for rank, (ability, ability_zh, animal) in zip(RANKS, abilities):
            character_id = f"{rank}_{suit}"
            result[character_id] = {
                "id": character_id,
                "suit": suit,
                "rank": rank,
                "name": f"{rank.title()} of {SUITS[suit]['name']}",
                "name_zh": f"{SUITS[suit]['name_zh']}{RANKS[rank]}",
                "ability": ability,
                "ability_zh": ability_zh,
                "animal": animal,
            }
    return result


CHARACTERS = _characters()


def _action(action_type: str, properties: Dict = None) -> Dict:
    fields = properties or {}
    return {
        "type": "object",
        "properties": {"type": {"const": action_type}, **fields},
        "required": ["type", *fields],
        "additionalProperties": False,
    }


_FIEF = {"type": "integer", "minimum": 0, "maximum": 7}
_SLOT = {"type": "integer", "minimum": 0, "maximum": 3}
ACTION_SCHEMA = {
    "type": "object",
    "oneOf": [
        _action("choose_fief", {"fief": _FIEF}),
        _action("substitute", {"slot": _SLOT, "fief": _FIEF}),
        _action("return_ally", {"slot": _SLOT}),
        _action("start_visit"),
        _action("reveal"),
        _action("play", {"card": {"enum": list(CARDS)}}),
        _action("use_ability", {"slot": _SLOT}),
        _action("ability_cards", {"cards": {
            "type": "array", "items": {"enum": list(CARDS)},
            "uniqueItems": True, "maxItems": 32,
        }}),
        _action("ability_fief", {"fief": _FIEF}),
        _action("ability_ally", {"slot": _SLOT}),
        _action("ability_suit", {"suit": {"enum": list(SUITS)}}),
        _action("ability_decision", {"decision": {"enum": ["draw", "stop", "skip"]}}),
        _action("next_trick"),
        _action("next_round"),
    ],
}
CONFIG_SCHEMA = {
    "type": "object",
    "properties": {
        "setup": {"type": "string", "enum": ["introductory", "standard"], "default": "introductory"},
        "goal": {"type": "integer", "enum": [16, 18, 20], "default": 16},
    },
    "additionalProperties": False,
}
