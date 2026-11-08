"""Witch's Cauldron (女巫坩埚): draft ingredients, sabotage rival cauldrons, brew a balanced potion."""

import copy
import random
from typing import Dict, List, Optional, Tuple

from jsonschema import Draft7Validator


# --- Card catalogue -------------------------------------------------------

INGREDIENTS: Dict[str, Dict] = {
    "r1": {"id": "r1", "kind": "ingredient", "color": "red", "value": 1, "name": "Fragrant Ash", "name_zh": "草木灰", "icon": "🌫️"},
    "r2": {"id": "r2", "kind": "ingredient", "color": "red", "value": 2, "name": "Blazing Bramble", "name_zh": "炽热荆棘", "icon": "🌵"},
    "r3": {"id": "r3", "kind": "ingredient", "color": "red", "value": 3, "name": "Flame Salamander Hide", "name_zh": "熔岩蝾螈皮", "icon": "🦎"},
    "r4": {"id": "r4", "kind": "ingredient", "color": "red", "value": 4, "name": "Phoenix Feather", "name_zh": "不死鸟尾羽", "icon": "🪶", "reveal_to_others": True},
    "r5": {"id": "r5", "kind": "ingredient", "color": "red", "value": 5, "name": "Hellhound Fang", "name_zh": "地狱犬獠牙", "icon": "🦷", "reveal_to_others": True},
    "b1": {"id": "b1", "kind": "ingredient", "color": "blue", "value": 1, "name": "Toxic Moss", "name_zh": "麻痹苔藓", "icon": "🍀"},
    "b2": {"id": "b2", "kind": "ingredient", "color": "blue", "value": 2, "name": "Black Widow Silk", "name_zh": "黑寡妇蛛丝", "icon": "🕸️"},
    "b3": {"id": "b3", "kind": "ingredient", "color": "blue", "value": 3, "name": "Wolfsbane", "name_zh": "乌头草", "icon": "🌿"},
    "b4": {"id": "b4", "kind": "ingredient", "color": "blue", "value": 4, "name": "Chimera Poison-Gland", "name_zh": "奇美拉腺体", "icon": "🫀", "reveal_to_others": True},
    "b5": {"id": "b5", "kind": "ingredient", "color": "blue", "value": 5, "name": "Leviathan Venom-Fang", "name_zh": "利维坦毒牙", "icon": "🐋", "reveal_to_others": True},
    "n0": {"id": "n0", "kind": "ingredient", "color": "neutral", "value": 0, "name": "Void Ether", "name_zh": "虚空幽质", "icon": "🌀"},
}

SPECIALS: Dict[str, Dict] = {
    "lid": {"id": "lid", "kind": "special", "name": "The Cauldron Lid", "name_zh": "锅盖", "icon": "🫕", "must_reveal": True,
            "text_zh": "打出后该坩埚牌堆被封存，任何人都不能再往里加入新的卡牌。",
            "text": "Seals this cauldron: nobody may add any further card to it."},
    "chameleon": {"id": "chameleon", "kind": "special", "name": "Chameleon Tail", "name_zh": "变色龙尾巴", "icon": "🦎", "must_reveal": False,
                  "text_zh": "结算时，你可以自选把红色值或蓝色值 −1。",
                  "text": "At scoring you may subtract 1 from either the red or the blue value."},
    "oath": {"id": "oath", "kind": "special", "name": "Blood Oath", "name_zh": "真名血契", "icon": "🩸", "must_reveal": True,
             "text_zh": "坩埚里有此牌的玩家必须喝下这锅秘药，不能拒绝。",
             "text": "The owner of this cauldron must drink and cannot refuse."},
    "tendril": {"id": "tendril", "kind": "special", "name": "Prophetic Tendril", "name_zh": "预言触须", "icon": "🐙", "must_reveal": True,
                "text_zh": "打出时可查看该坩埚牌堆内任意一张暗置的盖牌。",
                "text": "On play, look at one face-down card in this cauldron."},
    "tide": {"id": "tide", "kind": "special", "name": "Tide-Weaver Stone", "name_zh": "潮汐引力石", "icon": "🪨", "must_reveal": True,
             "text_zh": "打出后，该坩埚牌堆立刻加入中央牌库最上方一张牌，加入的牌必须明牌。",
             "text": "On play, add the top card of the central deck face-up to this cauldron."},
    "fire_scale": {"id": "fire_scale", "kind": "special", "name": "Fire-Eater Scale", "name_zh": "噬火巨龙鳞", "icon": "🐉", "must_reveal": True,
                   "text_zh": "差值 > 3 的炸锅红汤变为安全红汤；但出现在任何蓝汤里都会形成剧毒汤，喝下即中毒。",
                   "text": "A red soup that would explode becomes safe; any blue soup becomes lethal poison."},
    "leviathan_oil": {"id": "leviathan_oil", "kind": "special", "name": "Abyssal Leviathan Oil", "name_zh": "巨鲸凝毒脂", "icon": "🛢️", "must_reveal": True,
                      "text_zh": "差值 > 3 的毒蓝汤变为安全蓝汤；但出现在任何红汤里都会炸锅，喝下即炸锅。",
                      "text": "A blue soup that would poison becomes safe; any red soup explodes."},
    "ouroboros": {"id": "ouroboros", "kind": "special", "name": "Ouroboros", "name_zh": "衔尾蛇", "icon": "🐍", "must_reveal": True,
                  "text_zh": "结算前，所有坩埚里含此牌的玩家按顺时针交换整个坩埚牌堆。",
                  "text": "Before scoring, every cauldron holding this card passes clockwise to the next such player."},
    "negator": {"id": "negator", "kind": "special", "name": "Color Negator", "name_zh": "换汤不换药", "icon": "🔄", "must_reveal": True,
                "text_zh": "结算时这锅秘药转换成另一种属性（红汤↔蓝汤）并按转换后的颜色计分；完美汤药不受影响。",
                "text": "At scoring this soup flips to the other colour; a perfect soup is unaffected."},
}

CATALOG: Dict[str, Dict] = {**INGREDIENTS, **SPECIALS}

# Reconstructed counts: see designs/task188.md §8.
INGREDIENT_COUNTS = {"r1": 6, "r2": 6, "r3": 5, "r4": 4, "r5": 3,
                     "b1": 6, "b2": 6, "b3": 5, "b4": 4, "b5": 3,
                     "n0": 8}
SPECIAL_COUNTS = {"lid": 2, "chameleon": 2, "oath": 2, "tendril": 2, "tide": 1,
                  "fire_scale": 1, "leviathan_oil": 1, "ouroboros": 3, "negator": 2}

SAFE_DIFF = 3          # |red - blue| <= 3 is drinkable
TARGET_SMALL = 7       # 2-5 players
TARGET_LARGE = 5       # 6-7 players


def card_of(card_id: str) -> Dict:
    """Map a card instance id such as `r4.2` back to its catalogue entry."""
    return CATALOG[card_id.split(".")[0]]


def build_deck() -> List[str]:
    deck = []
    for base, count in list(INGREDIENT_COUNTS.items()) + list(SPECIAL_COUNTS.items()):
        deck.extend(f"{base}.{index}" for index in range(count))
    return deck


# --- Schemas --------------------------------------------------------------

def _action(action_type: str, properties: Dict, required: Optional[List[str]] = None) -> Dict:
    fields = {"type": {"const": action_type}, "round": {"type": "integer", "minimum": 1}, **properties}
    return {"type": "object", "properties": fields, "required": required or list(fields), "additionalProperties": False}


ACTION_SCHEMA = {
    "type": "object",
    "oneOf": [
        _action("setup_pick", {"card_id": {"type": "string"}}),
        _action("draft_pick", {"card_id": {"type": "string"}}),
        _action("play_card", {"card_id": {"type": "string"}, "target": {"type": ["string", "null"]},
                              "face_up": {"type": "boolean"}, "peek": {"type": ["integer", "null"], "minimum": 0}},
                 required=["type", "round", "card_id", "target", "face_up"]),
        _action("add_card", {"card_id": {"type": ["string", "null"]}}),
        _action("swap", {"partner": {"type": ["string", "null"]}}),
        _action("drink", {"drink": {"type": "boolean"}}),
        _action("chameleon", {"color": {"enum": ["red", "blue"]}}),
        _action("next_round", {}),
    ],
}
CONFIG_SCHEMA = {"type": "object", "properties": {"seed": {"type": "integer"}}, "additionalProperties": False}
_ACTION_VALIDATOR = Draft7Validator(ACTION_SCHEMA)
_CONFIG_VALIDATOR = Draft7Validator(CONFIG_SCHEMA)


# --- Random helpers -------------------------------------------------------

def _as_tuple(value):
    return tuple(_as_tuple(item) for item in value) if isinstance(value, (list, tuple)) else value


def _json_random_state(rng: random.Random) -> List:
    version, numbers, gaussian = rng.getstate()
    return [version, list(numbers), gaussian]


def _shuffle(state: Dict, cards: List[str]) -> None:
    rng = random.Random()
    rng.setstate(_as_tuple(state["rng_state"]))
    rng.shuffle(cards)
    state["rng_state"] = _json_random_state(rng)


def _draw(state: Dict) -> Optional[str]:
    """Take the top card, recycling the discard pile when the deck runs dry."""
    if not state["deck"] and state["discard"]:
        recycled = state["discard"]
        state["discard"] = []
        _shuffle(state, recycled)
        state["deck"] = recycled
        state["log"].append("Central deck exhausted; the discard pile is shuffled back in.")
    return state["deck"].pop(0) if state["deck"] else None


# --- Table helpers --------------------------------------------------------

def _alive(state: Dict) -> List[str]:
    return [pid for pid in state["turn_order"] if state["players"][pid]["alive"]]


def _circle_order(state: Dict) -> List[str]:
    alive = _alive(state)
    if not alive:
        return []
    start = state["start_index"] % len(state["turn_order"])
    order = state["turn_order"]
    rotated = [order[(start + step) % len(order)] for step in range(len(order))]
    return [pid for pid in rotated if pid in alive]


def _circles_per_round(player_count: int) -> int:
    return 4 if player_count <= 5 else 3


def _target_score(player_count: int) -> int:
    return TARGET_SMALL if player_count <= 5 else TARGET_LARGE


def _sealed(state: Dict, pid: str) -> bool:
    return any(card_of(entry["card"])["id"] == "lid" for entry in state["players"][pid]["cauldron"])


def _place(state: Dict, target: str, card_id: str, face_up: bool, actor: str) -> None:
    """Put one card into a cauldron and fire its on-play effect."""
    entry = {"card": card_id, "face_up": face_up, "by": actor, "seq": state["seq"]}
    state["seq"] += 1
    state["players"][target]["cauldron"].append(entry)
    base = card_of(card_id)["id"]
    if base == "tide":
        extra = _draw(state)
        if extra is None:
            state["log"].append("Tide-Weaver Stone found no card left in the central deck.")
        else:
            state["players"][target]["cauldron"].append({"card": extra, "face_up": True, "by": actor, "seq": state["seq"]})
            state["seq"] += 1
            state["log"].append(f"Tide-Weaver Stone pulled {_label(extra)} into {state['player_meta'][target].get('name', target)}'s cauldron.")


def _label(card_id: str) -> str:
    card = card_of(card_id)
    return f"{card['name_zh']}({card['icon']})"


def _soup_values(cauldron: List[Dict], chameleon: Optional[str]) -> Tuple[int, int]:
    red = blue = 0
    for entry in cauldron:
        card = card_of(entry["card"])
        if card["kind"] != "ingredient":
            continue
        if card["color"] == "red":
            red += card["value"]
        elif card["color"] == "blue":
            blue += card["value"]
    if chameleon == "red":
        red -= 1
    elif chameleon == "blue":
        blue -= 1
    return red, blue


def evaluate_cauldron(cauldron: List[Dict], chameleon: Optional[str] = None) -> Dict:
    """Resolve one cauldron into a soup result. Pure function, used by tests and the view."""
    specials = {card_of(entry["card"])["id"] for entry in cauldron if card_of(entry["card"])["kind"] == "special"}
    red, blue = _soup_values(cauldron, chameleon)
    diff = abs(red - blue)
    soup = "perfect" if diff == 0 else ("red" if red > blue else "blue")
    if "negator" in specials and soup != "perfect":
        soup = "blue" if soup == "red" else "red"

    has_fire = "fire_scale" in specials
    has_oil = "leviathan_oil" in specials
    if has_fire and has_oil:
        has_fire = has_oil = False      # the two cancel each other out

    outcome = soup
    if soup == "perfect":
        outcome = "perfect"
    elif soup == "red":
        if diff > SAFE_DIFF:
            outcome = "safe_red" if has_fire else "explode"
        elif has_oil:
            outcome = "explode"
        else:
            outcome = "safe_red"
    else:
        if diff > SAFE_DIFF:
            outcome = "safe_blue" if has_oil else "poison"
        elif has_fire:
            outcome = "poison"
        else:
            outcome = "safe_blue"

    scored_colors = {"perfect": ("red", "blue", "neutral"),
                     "safe_red": ("red", "neutral"),
                     "safe_blue": ("blue", "neutral")}.get(outcome, ())
    scored = [entry for entry in cauldron
              if card_of(entry["card"])["kind"] == "ingredient" and card_of(entry["card"])["color"] in scored_colors]
    return {
        "red": red, "blue": blue, "diff": diff, "soup": soup, "outcome": outcome,
        "points": len(scored), "scored": [entry["card"] for entry in scored],
        "specials": sorted(specials),
    }


# --- Round flow -----------------------------------------------------------

def _begin_circle(state: Dict) -> None:
    alive = _alive(state)
    state["circle_order"] = _circle_order(state)
    state["display"] = []
    for _ in range(len(alive) + 1):
        card = _draw(state)
        if card is None:
            break
        state["display"].append(card)
    state["stage"] = "draft"
    state["turn_index"] = 0
    state["log"].append(f"Round {state['round']} circle {state['circle']}: {len(state['display'])} cards revealed for the draft.")


def _begin_play(state: Dict) -> None:
    state["stage"] = "play"
    state["turn_index"] = 0
    _skip_empty_hands(state)
    state["log"].append(f"Round {state['round']} circle {state['circle']}: brewing begins.")


def _skip_empty_hands(state: Dict) -> None:
    """A witch with no card left (deck exhausted) simply sits this beat out."""
    order = state["circle_order"]
    while state["turn_index"] < len(order) and not state["players"][order[state["turn_index"]]]["hand"]:
        state["turn_index"] += 1
    if state["turn_index"] >= len(order):
        _end_circle(state)


def _any_open_cauldron(state: Dict) -> bool:
    return any(not _sealed(state, pid) for pid in _alive(state))


def _end_circle(state: Dict) -> None:
    if state["circle"] >= state["circles"]:
        state["stage"] = "add"
        state["pending_add"] = {}
        state["log"].append(f"Round {state['round']}: last card — keep it in your cauldron or discard it?")
    else:
        state["circle"] += 1
        state["start_index"] = (state["start_index"] + 1) % len(state["turn_order"])
        _begin_circle(state)


def _begin_settlement(state: Dict) -> None:
    """Ouroboros fires between the swap and the drink decision."""
    holders = [pid for pid in _alive(state)
               if any(card_of(entry["card"])["id"] == "ouroboros" for entry in state["players"][pid]["cauldron"])]
    if len(holders) >= 2:
        pots = {pid: state["players"][pid]["cauldron"] for pid in holders}
        for index, pid in enumerate(holders):
            state["players"][pid]["cauldron"] = pots[holders[(index + 1) % len(holders)]]
        state["log"].append("Ouroboros: cauldrons holding the snake pass clockwise.")
    state["stage"] = "drink"
    state["pending_drink"] = {}
    state["log"].append(f"Round {state['round']}: drink or refuse?")


def _finish_scoring(state: Dict) -> None:
    summary = []
    for pid in _alive(state):
        pdata = state["players"][pid]
        choice = state["pending_chameleon"].get(pid)
        if not state["pending_drink"].get(pid, True):
            for entry in pdata["cauldron"]:
                state["discard"].append(entry["card"])
            summary.append({"player_id": pid, "refused": True, "outcome": "refused", "points": 0,
                            "red": 0, "blue": 0, "diff": 0, "soup": None, "cards": [e["card"] for e in pdata["cauldron"]],
                            "scored": [], "specials": []})
            pdata["cauldron"] = []
            continue
        result = evaluate_cauldron(pdata["cauldron"], choice)
        scored = set(result["scored"])
        for entry in pdata["cauldron"]:
            if entry["card"] in scored:
                pdata["score_pile"].append(entry["card"])
            else:
                state["discard"].append(entry["card"])
        if result["outcome"] == "explode":
            pdata["explosions"] += 1
        elif result["outcome"] == "poison":
            pdata["poisons"] += 1
        pdata["total"] = len(pdata["score_pile"])
        pdata["rounds"].append({"round": state["round"], **{k: result[k] for k in ("red", "blue", "diff", "soup", "outcome", "points")}})
        summary.append({"player_id": pid, "refused": False, "cards": [e["card"] for e in pdata["cauldron"]], **result})
        pdata["cauldron"] = []
        if pdata["explosions"] >= 2 or pdata["poisons"] >= 2:
            pdata["alive"] = False
            pdata["eliminated_round"] = state["round"]
    state["round_summary"] = summary
    state["pending_chameleon"] = {}
    state["chameleon_players"] = []
    state["next_ready"] = []
    state["stage"] = "scoring"
    state["log"].append(f"Round {state['round']} scored.")


def _check_game_end(state: Dict) -> bool:
    alive = _alive(state)
    if not alive:
        state["winner"] = []
        state["game_over"] = True
        state["stage"] = "game_over"
        state["log"].append("Every witch brewed themselves out of the game. Nobody wins.")
        return True
    if len(alive) == 1:
        state["winner"] = list(alive)
        state["game_over"] = True
        state["stage"] = "game_over"
        state["log"].append("Only one witch is still standing.")
        return True
    target = _target_score(state["player_count"])
    best = max(state["players"][pid]["total"] for pid in alive)
    if best >= target:
        state["winner"] = [pid for pid in alive if state["players"][pid]["total"] == best]
        state["game_over"] = True
        state["stage"] = "game_over"
        state["log"].append(f"A witch reached {best} points (target {target}).")
        return True
    return False


def _deal_soup_base(state: Dict) -> None:
    """Every round opens like the setup: two cards, one becomes the face-up soup base."""
    for pid in _alive(state):
        pdata = state["players"][pid]
        pdata["cauldron"] = []
        pdata["known"] = {}
        pdata["hand"] = [card for card in (_draw(state), _draw(state)) if card]
    state["stage"] = "setup"
    state["pending_setup"] = {}
    state["log"].append(f"Round {state['round']}: every witch picks one of two cards as the base of her cauldron.")


def _start_next_round(state: Dict) -> None:
    state["round"] += 1
    state["circle"] = 1
    state["start_index"] = (state["start_index"] + 1) % len(state["turn_order"])
    state["pending_add"] = {}
    state["pending_swap"] = {}
    state["pending_drink"] = {}
    state["pending_chameleon"] = {}
    state["chameleon_players"] = []
    state["round_summary"] = []
    _deal_soup_base(state)


# --- Serialization guard --------------------------------------------------

def _validate_saved_state(state: Dict) -> None:
    def require(condition: bool) -> None:
        if not condition:
            raise ValueError("invalid Witch's Cauldron saved state")

    try:
        require(isinstance(state, dict) and state["game_id"] == "witch_cauldron" and state["version"] == 1)
        order = state["turn_order"]
        require(isinstance(order, list) and 2 <= len(order) <= 7 and len(set(order)) == len(order) and all(order))
        require(set(state["players"]) == set(order) and set(state["player_meta"]) == set(order))
        require(state["player_count"] == len(order))
        require(state["circles"] == _circles_per_round(len(order)))
        require(type(state["round"]) is int and state["round"] >= 1)
        require(type(state["circle"]) is int and 1 <= state["circle"] <= state["circles"])
        require(state["stage"] in ("setup", "draft", "play", "add", "swap", "drink", "chameleon", "scoring", "game_over"))
        require(type(state["game_over"]) is bool and state["game_over"] == (state["stage"] == "game_over"))
        require(type(state["start_index"]) is int and 0 <= state["start_index"] < len(order))
        require(type(state["seq"]) is int and state["seq"] >= 0)
        require(isinstance(state["log"], list) and all(isinstance(line, str) for line in state["log"]))
        require(isinstance(state["round_summary"], list))
        require(isinstance(state["next_ready"], list) and set(state["next_ready"]) <= set(order))
        require(isinstance(state["winner"], list) and set(state["winner"]) <= set(order))
        require(isinstance(state["display"], list))
        require(all(isinstance(card, str) for card in state["deck"] + state["discard"] + state["display"]))

        seen = list(state["deck"]) + list(state["discard"]) + list(state["display"])
        for pid in order:
            pdata = state["players"][pid]
            require(isinstance(pdata["hand"], list) and isinstance(pdata["cauldron"], list))
            require(type(pdata["total"]) is int and pdata["total"] >= 0)
            require(type(pdata["explosions"]) is int and 0 <= pdata["explosions"] <= 2)
            require(type(pdata["poisons"]) is int and 0 <= pdata["poisons"] <= 2)
            require(type(pdata["alive"]) is bool and type(pdata["refused"]) is bool)
            require(pdata["total"] == len(pdata["score_pile"]))
            require(isinstance(pdata["rounds"], list) and isinstance(pdata["known"], dict))
            seen.extend(pdata["hand"])
            seen.extend(pdata["score_pile"])
            seen.extend(entry["card"] for entry in pdata["cauldron"])
        require(len(seen) == len(build_deck()) and len(set(seen)) == len(seen))
        rng = random.Random()
        rng.setstate(_as_tuple(state["rng_state"]))
    except (KeyError, TypeError, IndexError, AttributeError, OverflowError, ValueError) as error:
        if isinstance(error, ValueError) and str(error).startswith("invalid Witch"):
            raise
        raise ValueError("invalid Witch's Cauldron saved state") from error


# --- Game module ----------------------------------------------------------

class WitchCauldronGame:
    game_id = "witch_cauldron"
    min_players = 2
    max_players = 7

    @staticmethod
    def init_game(config: Optional[Dict], players: List[Dict]) -> Dict:
        cfg = {} if config is None else copy.deepcopy(config)
        if not _CONFIG_VALIDATOR.is_valid(cfg) or ("seed" in cfg and type(cfg["seed"]) is not int):
            raise ValueError("invalid Witch's Cauldron configuration")
        if not 2 <= len(players) <= 7:
            raise ValueError("Witch's Cauldron requires 2-7 players")
        order = sorted(players, key=lambda player: player.get("seat", 0))
        ids = [player["player_id"] for player in order]
        if len(set(ids)) != len(ids) or any(not isinstance(pid, str) or not pid for pid in ids):
            raise ValueError("player IDs must be unique nonempty strings")
        rng = random.Random(cfg.get("seed"))
        state = {
            "game_id": WitchCauldronGame.game_id,
            "version": 1,
            "config": {},
            "rng_state": _json_random_state(rng),
            "turn_order": ids,
            "player_count": len(ids),
            "circles": _circles_per_round(len(ids)),
            "player_meta": {player["player_id"]: copy.deepcopy(player) for player in order},
            "players": {pid: {"hand": [], "cauldron": [], "score_pile": [], "known": {}, "rounds": [],
                              "explosions": 0, "poisons": 0, "refused": False, "alive": True, "total": 0}
                         for pid in ids},
            "deck": build_deck(),
            "discard": [],
            "display": [],
            "round": 1,
            "circle": 1,
            "start_index": 0,
            "stage": "setup",
            "turn_index": 0,
            "circle_order": [],
            "pending_setup": {},
            "pending_add": {},
            "pending_swap": {},
            "pending_drink": {},
            "pending_chameleon": {},
            "next_ready": [],
            "round_summary": [],
            "winner": [],
            "game_over": False,
            "seq": 0,
            "log": [],
        }
        _shuffle(state, state["deck"])
        _deal_soup_base(state)
        return state

    @staticmethod
    def get_legal_actions(state: Dict, player_id: str) -> List[str]:
        if state["game_over"] or player_id not in state["players"]:
            return []
        stage = state["stage"]
        if stage == "scoring":
            return [] if player_id in state["next_ready"] else ["next_round"]
        if not state["players"][player_id]["alive"]:
            return []
        if stage == "setup":
            return [] if player_id in state["pending_setup"] else ["setup_pick"]
        if stage == "draft":
            order = state["circle_order"]
            return ["draft_pick"] if order and order[state["turn_index"]] == player_id else []
        if stage == "play":
            order = state["circle_order"]
            return ["play_card"] if order and order[state["turn_index"]] == player_id else []
        if stage == "add":
            return [] if player_id in state["pending_add"] else ["add_card"]
        if stage == "swap":
            return [] if player_id in state["pending_swap"] else ["swap"]
        if stage == "drink":
            return [] if player_id in state["pending_drink"] else ["drink"]
        if stage == "chameleon":
            return ["chameleon"] if player_id in state["chameleon_players"] and player_id not in state["pending_chameleon"] else []
        return []

    @staticmethod
    def apply_action(state: Dict, player_id: str, action: Dict) -> Tuple[List[Dict], Optional[str]]:
        if not isinstance(action, dict) or not _ACTION_VALIDATOR.is_valid(action):
            return [], "invalid action schema"
        if player_id not in state["players"]:
            return [], "player not found"
        if state["game_over"]:
            return [], "game is over"
        if action["round"] != state["round"]:
            return [], "stale round"
        action_type = action["type"]
        if action_type not in WitchCauldronGame.get_legal_actions(state, player_id):
            return [], "action unavailable in this stage"

        pdata = state["players"][player_id]

        if action_type == "setup_pick":
            if action["card_id"] not in pdata["hand"]:
                return [], "card is not in your hand"
            state["pending_setup"][player_id] = action["card_id"]
            if len(state["pending_setup"]) == len(_alive(state)):
                for pid, chosen in state["pending_setup"].items():
                    hand = state["players"][pid]["hand"]
                    other = [card for card in hand if card != chosen]
                    state["players"][pid]["hand"] = other
                    _place(state, pid, chosen, True, pid)
                state["pending_setup"] = {}
                _begin_circle(state)
            return [], None

        if action_type == "draft_pick":
            if action["card_id"] not in state["display"]:
                return [], "card is not in the display"
            state["display"].remove(action["card_id"])
            pdata["hand"].append(action["card_id"])
            state["turn_index"] += 1
            if state["turn_index"] >= len(state["circle_order"]) or not state["display"]:
                for leftover in state["display"]:
                    state["discard"].append(leftover)
                state["display"] = []
                _begin_play(state)
            return [], None

        if action_type == "play_card":
            if action["card_id"] not in pdata["hand"]:
                return [], "card is not in your hand"
            target = action["target"]
            card = card_of(action["card_id"])
            face_up = action["face_up"]
            if target is None:
                # Every cauldron is sealed by a lid: the only legal move is to bin the card.
                if _any_open_cauldron(state):
                    return [], "you must play into a cauldron"
                pdata["hand"].remove(action["card_id"])
                state["discard"].append(action["card_id"])
                state["turn_index"] += 1
                if state["turn_index"] >= len(state["circle_order"]):
                    _end_circle(state)
                else:
                    _skip_empty_hands(state)
                return [], None
            if target not in state["players"] or not state["players"][target]["alive"]:
                return [], "invalid cauldron"
            if _sealed(state, target):
                return [], "that cauldron is sealed by the lid"
            if card.get("must_reveal") and not face_up:
                return [], "this card must be played face up"
            if card.get("reveal_to_others") and target != player_id and not face_up:
                return [], "this card must be face up in another player's cauldron"
            peek = action.get("peek")
            if peek is not None and card["id"] != "tendril":
                return [], "only the Prophetic Tendril can peek"
            if peek is not None:
                hidden = [index for index, entry in enumerate(state["players"][target]["cauldron"]) if not entry["face_up"]]
                if peek not in hidden:
                    return [], "no such face-down card"
            pdata["hand"].remove(action["card_id"])
            _place(state, target, action["card_id"], face_up, player_id)
            if peek is not None:
                pdata["known"].setdefault(target, {})[str(peek)] = state["players"][target]["cauldron"][peek]["card"]
            state["turn_index"] += 1
            if state["turn_index"] >= len(state["circle_order"]):
                _end_circle(state)
            else:
                _skip_empty_hands(state)
            return [], None

        if action_type == "add_card":
            card_id = action["card_id"]
            if card_id is not None and card_id not in pdata["hand"]:
                return [], "card is not in your hand"
            if card_id is not None and _sealed(state, player_id):
                return [], "your cauldron is sealed by the lid"
            state["pending_add"][player_id] = card_id
            if len(state["pending_add"]) == len(_alive(state)):
                for pid, chosen in state["pending_add"].items():
                    if chosen is None:
                        for leftover in state["players"][pid]["hand"]:
                            state["discard"].append(leftover)
                        state["players"][pid]["hand"] = []
                    else:
                        state["players"][pid]["hand"].remove(chosen)
                        _place(state, pid, chosen, True, pid)
                        for leftover in state["players"][pid]["hand"]:
                            state["discard"].append(leftover)
                        state["players"][pid]["hand"] = []
                state["stage"] = "swap"
                state["pending_swap"] = {}
                state["log"].append(f"Round {state['round']}: anybody trading cauldrons?")
            return [], None

        if action_type == "swap":
            partner = action["partner"]
            alive = _alive(state)
            if partner is not None and (partner not in alive or partner == player_id):
                return [], "invalid swap partner"
            state["pending_swap"][player_id] = partner
            if len(state["pending_swap"]) == len(alive):
                done = set()
                for pid in alive:
                    other = state["pending_swap"].get(pid)
                    if other is None or pid in done:
                        continue
                    if state["pending_swap"].get(other) == pid:
                        first, second = state["players"][pid]["cauldron"], state["players"][other]["cauldron"]
                        state["players"][pid]["cauldron"], state["players"][other]["cauldron"] = second, first
                        done.update({pid, other})
                        state["log"].append(f"{state['player_meta'][pid].get('name', pid)} and {state['player_meta'][other].get('name', other)} traded cauldrons.")
                _begin_settlement(state)
            return [], None

        if action_type == "drink":
            forced = any(card_of(entry["card"])["id"] == "oath" for entry in pdata["cauldron"])
            if not action["drink"]:
                if forced:
                    return [], "the Blood Oath forces you to drink"
                if pdata["refused"]:
                    return [], "you already used your refusal"
                pdata["refused"] = True
            state["pending_drink"][player_id] = action["drink"]
            if len(state["pending_drink"]) == len(_alive(state)):
                state["chameleon_players"] = [
                    pid for pid in _alive(state)
                    if state["pending_drink"].get(pid, True)
                    and any(card_of(entry["card"])["id"] == "chameleon" for entry in state["players"][pid]["cauldron"])
                ]
                state["pending_chameleon"] = {}
                if state["chameleon_players"]:
                    state["stage"] = "chameleon"
                    state["log"].append("Chameleon Tail: choose which colour loses one point of strength.")
                else:
                    _finish_scoring(state)
            return [], None

        if action_type == "chameleon":
            state["pending_chameleon"][player_id] = action["color"]
            if len(state["pending_chameleon"]) == len(state["chameleon_players"]):
                _finish_scoring(state)
            return [], None

        # next_round
        state["next_ready"].append(player_id)
        if len(state["next_ready"]) == len(state["turn_order"]):
            if not _check_game_end(state):
                _start_next_round(state)
        return [], None

    @staticmethod
    def get_public_view(state: Dict, viewer_id: str) -> Dict:
        viewer = state["players"].get(viewer_id)
        reveal_all = state["stage"] in ("scoring", "game_over")

        def pot_view(pid: str) -> List[Dict]:
            known = (viewer or {}).get("known", {}).get(pid, {}) if viewer else {}
            out = []
            for index, entry in enumerate(state["players"][pid]["cauldron"]):
                visible = entry["face_up"] or reveal_all or str(index) in known
                card = card_of(entry["card"])
                out.append({
                    "index": index,
                    "face_up": entry["face_up"],
                    "card": copy.deepcopy(card) if visible else None,
                    "known": (not entry["face_up"]) and visible and not reveal_all,
                    "by": entry["by"],
                })
            return out

        players_view = []
        for index, pid in enumerate(state["turn_order"]):
            pdata = state["players"][pid]
            meta = state["player_meta"][pid]
            submitted = {
                "setup": pid in state["pending_setup"],
                "draft": state["stage"] == "draft" and state["circle_order"][:state["turn_index"]] and pid in state["circle_order"][:state["turn_index"]],
                "play": state["stage"] == "play" and pid in state["circle_order"][:state["turn_index"]],
                "add": pid in state["pending_add"],
                "swap": pid in state["pending_swap"],
                "drink": pid in state["pending_drink"],
                "chameleon": pid in state["pending_chameleon"],
                "scoring": pid in state["next_ready"],
            }.get(state["stage"], False)
            players_view.append({
                "player_id": pid, "name": meta.get("name", pid), "seat": meta.get("seat", index),
                "is_bot": bool(meta.get("is_bot", False)), "alive": pdata["alive"],
                "hand_count": len(pdata["hand"]), "cauldron": pot_view(pid), "sealed": _sealed(state, pid),
                "score_pile": len(pdata["score_pile"]), "total": pdata["total"],
                "explosions": pdata["explosions"], "poisons": pdata["poisons"],
                "refused": pdata["refused"], "rounds": pdata["rounds"],
                "eliminated_round": pdata.get("eliminated_round"),
                "submitted": bool(submitted),
                "drank": state["pending_drink"].get(pid),
            })

        order = state["circle_order"]
        return copy.deepcopy({
            "game_id": WitchCauldronGame.game_id,
            "stage": state["stage"], "round": state["round"], "circle": state["circle"],
            "circles": state["circles"], "player_count": state["player_count"],
            "target": _target_score(state["player_count"]), "safe_diff": SAFE_DIFF,
            "you": viewer_id, "game_over": state["game_over"], "winner": state["winner"],
            "start_player": state["turn_order"][state["start_index"]],
            "current_player": order[state["turn_index"]] if order and state["stage"] in ("draft", "play") and state["turn_index"] < len(order) else None,
            "players": players_view,
            "hand": [copy.deepcopy(card_of(card)) | {"instance": card} for card in viewer["hand"]] if viewer else [],
            "display": [copy.deepcopy(card_of(card)) | {"instance": card} for card in state["display"]],
            "deck_count": len(state["deck"]), "discard_count": len(state["discard"]),
            "pending_setup": state["pending_setup"].get(viewer_id),
            "pending_add": viewer_id in state["pending_add"],
            "pending_swap": state["pending_swap"].get(viewer_id),
            "pending_drink": state["pending_drink"].get(viewer_id),
            "pending_chameleon": state["pending_chameleon"].get(viewer_id),
            "chameleon_players": state.get("chameleon_players", []),
            "next_ready": state["next_ready"], "round_summary": state["round_summary"],
            "legal_actions": WitchCauldronGame.get_legal_actions(state, viewer_id),
            "catalog": CATALOG, "log": state["log"],
        })

    @staticmethod
    def serialize(state: Dict) -> Dict:
        return copy.deepcopy(state)

    @staticmethod
    def deserialize(payload: Dict) -> Dict:
        restored = copy.deepcopy(payload)
        _validate_saved_state(restored)
        return restored
