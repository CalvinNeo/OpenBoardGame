import copy
import itertools
import random
from collections import Counter
from typing import Dict, List, Optional, Tuple

from jsonschema import Draft7Validator

from game.for_northwood_data import ACTION_SCHEMA, CARDS, CHARACTERS, CONFIG_SCHEMA, RANKS, STARS, SUITS


ACTION_VALIDATOR = Draft7Validator(ACTION_SCHEMA)
CONFIG_VALIDATOR = Draft7Validator(CONFIG_SCHEMA)


def _value(card: str) -> int:
    return CARDS[card]["value"]


def _suit(card: str) -> str:
    return CARDS[card]["suit"]


def _trump(state: Dict) -> Optional[str]:
    current = state["current_fief"]
    return CHARACTERS[state["fiefs"][current]["ruler"]]["suit"] if current is not None else None


def _log(state: Dict, message: str) -> None:
    state["log"].append(message)
    state["log"] = state["log"][-80:]


def _draw(state: Dict, count: int) -> List[str]:
    drawn = []
    for _ in range(min(count, len(state["deck"]))):
        card = state["deck"].pop()
        drawn.append(card)
        state["hand"].append(card)
        if state["known_top"] and state["known_top"][0] == card:
            state["known_top"].pop(0)
        else:
            state["known_top"] = []
    return drawn


def _put_on_deck(state: Dict, card: str) -> None:
    state["deck"].append(card)
    state["known_top"].insert(0, card)


def _move_hand(state: Dict, cards: List[str], pile: str = "discard") -> None:
    for card in cards:
        state["hand"].remove(card)
        state[pile].append(card)


def _new_visit(state: Dict) -> None:
    state["deck"] = list(CARDS)
    random.shuffle(state["deck"])
    state["hand"] = []
    state["discard"] = []
    state["score"] = []
    state["known_top"] = []
    state["statement"] = None
    state["last_trick"] = None
    state["current_fief"] = None
    state["active_allies"] = [
        {"character": character, "exhausted": False, "borrowed_from": None}
        for character in state["allies"]
    ]
    state["borrowed"] = []
    state["pending"] = None
    state["ability_slot"] = None
    state["ability_used"] = False
    state["parity_effect"] = False
    state["trick"] = 1
    state["phase"] = "choose_fief"
    _draw(state, 8)


def _finish_visit(state: Dict) -> None:
    current = state["current_fief"]
    fief = state["fiefs"][current]
    success = len(state["score"]) == current
    fief["status"] = "friendly" if success else "lost"
    for origin in state["borrowed"]:
        state["fiefs"][origin]["spent"] = True
    stars = STARS[current] if success else 0
    state["stars"] += stars
    state["history"].append({
        "visit": len(state["history"]) + 1,
        "fief": current,
        "ruler": fief["ruler"],
        "score": len(state["score"]),
        "target": current,
        "success": success,
        "stars": stars,
        "tricks": state["trick"] - (state["statement"] is None),
    })
    state["phase"] = "visit_review"
    state["pending"] = None
    state["ability_slot"] = None
    _log(state, f"Fief {current}: {len(state['score'])}/{current} tricks. "
         + (f"Friendly! +{stars} stars." if success else "The ruler remains unconvinced."))


def _complete_ability(state: Dict) -> None:
    state["pending"] = None
    state["ability_slot"] = None
    state["phase"] = "before_trick"
    if not state["hand"] or not state["deck"]:
        _finish_visit(state)


def _complete_trick(state: Dict) -> None:
    state["pending"] = None
    state["last_trick"]["score_after"] = len(state["score"])
    if not state["hand"] or not state["deck"]:
        _finish_visit(state)
    else:
        state["phase"] = "trick_review"


def _pending_cards(state: Dict, kind: str, eligible: List[str], **requirements: object) -> None:
    state["phase"] = "ability"
    state["pending"] = {"kind": kind, "eligible": list(eligible), **requirements}


def _forced_cards(state: Dict, cards: List[str], pile: str = "discard") -> None:
    if not cards:
        _complete_ability(state)
    else:
        _pending_cards(state, "forced", cards, count=len(cards), pile=pile)


def _swap_fiefs(state: Dict) -> List[int]:
    current = state["current_fief"]
    return [index for index, fief in enumerate(state["fiefs"])
            if 0 < abs(index - current) <= 2 and fief["status"] == "unvisited"]


def _neighbor_fiefs(state: Dict) -> List[int]:
    current = state["current_fief"]
    choices = []
    for direction in (-1, 1):
        index = current + direction
        while 0 <= index < 8:
            if state["fiefs"][index]["status"] == "unvisited":
                choices.append(index)
                break
            index += direction
    return choices


def _baron_swap(state: Dict, pile: str) -> None:
    eligible = [card for card in state["hand"]
                if state[pile] and _value(card) == _value(state[pile][-1])]
    if eligible:
        _pending_cards(state, "baron_swap", eligible, count=1, pile=pile, optional=True)
    elif pile == "discard":
        _baron_swap(state, "score")
    else:
        _complete_ability(state)


def _draw_until(state: Dict) -> None:
    drawn = _draw(state, 1)
    if not drawn or _suit(drawn[0]) == _trump(state) or not state["deck"]:
        _complete_ability(state)
    else:
        state["phase"] = "ability"
        state["pending"] = {"kind": "draw_until", "last_draw": drawn[0]}


def _begin_ability(state: Dict, character_id: str) -> None:
    character = CHARACTERS[character_id]
    rank, suit = character["rank"], character["suit"]
    hand = list(state["hand"])
    if suit == "claws":
        if rank == "jack":
            _draw(state, max(0, 8 - len(hand)))
        elif rank == "queen":
            _draw(state, 1)
            for pile in ("discard", "score"):
                if state[pile]:
                    state["hand"].append(state[pile].pop())
        elif rank == "king" and hand:
            _forced_cards(state, [card for card in hand if _value(card) == max(map(_value, hand))], "score")
            return
        elif rank == "prince":
            _draw_until(state)
            return
        elif rank == "lady" and hand:
            _pending_cards(state, "lowest", [card for card in hand if _value(card) == min(map(_value, hand))], count=1)
            return
        elif rank == "baron" and hand:
            _pending_cards(state, "search", hand, count=1)
            return
    elif suit == "flowers":
        if rank == "jack":
            _forced_cards(state, [card for card in hand if _suit(card) == _trump(state)])
            return
        if rank == "queen" and state["score"]:
            _put_on_deck(state, state["score"].pop())
        elif rank == "king":
            pairs = [pair for pair in itertools.combinations(hand, 2) if sum(map(_value, pair)) == 9]
            if pairs:
                _pending_cards(state, "sum_nine", [card for card in hand if any(card in pair for pair in pairs)], count=2, total=9)
                return
        elif rank == "prince":
            counts = Counter(map(_value, hand))
            count = len(hand) - len(counts)
            if count:
                _pending_cards(state, "duplicates", [card for card in hand if counts[_value(card)] > 1], count=count)
                return
        elif rank == "lady":
            eligible = [card for card in hand if _value(card) == len(hand)]
            if eligible:
                _pending_cards(state, "hand_size", eligible, count=1)
                return
        elif rank == "baron":
            _forced_cards(state, [card for card in hand if _value(card) <= 3])
            return
    elif suit == "eyes":
        if rank == "jack":
            _draw(state, 2)
            _pending_cards(state, "discard_two", state["hand"], count=min(2, len(state["hand"])))
            return
        if rank == "queen":
            state["known_top"] = list(reversed(state["deck"][-3:]))
        elif rank == "king":
            state["phase"] = "ability"
            state["pending"] = {"kind": "name_suit", "suits": list(SUITS)}
            return
        elif rank == "prince" and hand:
            repeats = sum(ally["exhausted"] for ally in state["active_allies"])
            _pending_cards(state, "cycle", hand, count=1, remaining=repeats)
            return
        elif rank == "lady":
            total = sum(map(_value, _draw(state, 2)))
            if total:
                _pending_cards(state, "sum_drawn", state["hand"], total=total)
                return
        elif rank == "baron":
            state["parity_effect"] = True
    else:
        if rank == "jack":
            choices = _swap_fiefs(state)
            if choices:
                state["phase"] = "ability"
                state["pending"] = {"kind": "swap_ruler", "fiefs": choices}
                return
        elif rank == "queen":
            ruler = state["fiefs"][state["current_fief"]]["ruler"]
            if ruler != character_id:
                _begin_ability(state, ruler)
                return
        elif rank == "king" and hand and state["deck"]:
            drawn = _draw(state, 1)[0]
            _pending_cards(state, "exchange_top", hand, count=1, revealed=drawn)
            return
        elif rank == "prince":
            choices = _neighbor_fiefs(state)
            if choices:
                state["phase"] = "ability"
                state["pending"] = {"kind": "move_visit", "fiefs": choices}
                return
        elif rank == "lady":
            _draw(state, 1)
            choices = [index for index, ally in enumerate(state["active_allies"])
                       if ally["exhausted"] and index != state["ability_slot"]]
            if choices:
                state["phase"] = "ability"
                state["pending"] = {"kind": "refresh", "slots": choices}
                return
        elif rank == "baron":
            _baron_swap(state, "discard")
            return
    _complete_ability(state)


def _resolve_cards(state: Dict, cards: List[str]) -> Optional[str]:
    pending = state["pending"]
    if "eligible" not in pending or any(card not in pending["eligible"] for card in cards):
        return "Choose only eligible cards."
    if "count" in pending and len(cards) != pending["count"]:
        return f"Choose exactly {pending['count']} cards."
    if "total" in pending and sum(map(_value, cards)) != pending["total"]:
        return f"The selected values must total {pending['total']}."
    kind = pending["kind"]
    if kind == "duplicates":
        remaining = Counter(_value(card) for card in state["hand"] if card not in cards)
        if set(remaining) != set(map(_value, state["hand"])) or any(count != 1 for count in remaining.values()):
            return "Keep exactly one card of every value in your hand."
    if kind == "forced":
        _move_hand(state, cards, pending["pile"])
    elif kind == "lowest":
        _move_hand(state, cards)
        _draw(state, _value(cards[0]))
    elif kind == "search":
        found = [card for card in state["deck"] if _value(card) == _value(cards[0])]
        state["deck"] = [card for card in state["deck"] if card not in found]
        state["hand"].extend(found)
        random.shuffle(state["deck"])
        state["known_top"] = []
    elif kind == "exchange_top":
        state["hand"].remove(cards[0])
        _put_on_deck(state, cards[0])
    elif kind == "baron_swap":
        pile = pending["pile"]
        top = state[pile].pop()
        _move_hand(state, cards, pile)
        state["hand"].append(top)
        if pile == "discard":
            _baron_swap(state, "score")
            return None
    else:
        _move_hand(state, cards)
        if kind == "cycle":
            _draw(state, 1)
            if pending["remaining"] > 1 and state["hand"]:
                _pending_cards(state, "cycle", state["hand"], count=1, remaining=pending["remaining"] - 1)
                return None
        elif kind == "parity_discard":
            _complete_trick(state)
            return None
    _complete_ability(state)
    return None


def _legal_cards(state: Dict) -> List[str]:
    if state["phase"] != "respond":
        return []
    follow = [card for card in state["hand"] if _suit(card) == _suit(state["statement"])]
    return follow or list(state["hand"])


def response_wins(statement: str, response: str, trump: str) -> bool:
    if _suit(statement) == _suit(response):
        return _value(response) > _value(statement)
    return _suit(response) == trump


class ForNorthwoodGame:
    game_id = "for_northwood"
    min_players = 1
    max_players = 1

    @staticmethod
    def init_game(config: Optional[Dict], players: List[Dict]) -> Dict:
        config = dict(config or {})
        if not CONFIG_VALIDATOR.is_valid(config):
            raise ValueError("Invalid For Northwood! configuration.")
        if len(players) != 1:
            raise ValueError("For Northwood! requires exactly one player.")
        config = {"setup": "introductory", "goal": 16, **config}
        allies, rulers = [], []
        for suit in SUITS:
            ranks = list(RANKS)
            if config["setup"] == "standard":
                random.shuffle(ranks)
            allies.append(f"{ranks[0]}_{suit}")
            rulers.extend(f"{rank}_{suit}" for rank in ranks[1:3])
        random.shuffle(rulers)
        owner = players[0]["player_id"]
        state = {
            "config": config,
            "player_id": owner,
            "player_name": players[0].get("name", "Envoy"),
            "turn_order": [owner],
            "current_player": owner,
            "allies": allies,
            "fiefs": [{"ruler": ruler, "status": "unvisited", "spent": False} for ruler in rulers],
            "stars": 0,
            "history": [],
            "log": [],
            "game_over": False,
            "winner": [],
            "scores": {},
        }
        _new_visit(state)
        return state

    @staticmethod
    def get_legal_actions(state: Dict, player_id: str) -> List[str]:
        if player_id != state["player_id"] or state["game_over"]:
            return []
        phase = state["phase"]
        if phase == "choose_fief":
            return ["choose_fief"]
        if phase == "prepare":
            return ["start_visit", "substitute", "return_ally"]
        if phase == "before_trick":
            actions = ["reveal"]
            if not state["ability_used"] and any(not ally["exhausted"] for ally in state["active_allies"]):
                actions.append("use_ability")
            return actions
        if phase == "respond":
            return ["play"]
        if phase == "trick_review":
            return ["next_trick"]
        if phase == "visit_review":
            return ["next_round"]
        pending = state["pending"] or {}
        if phase == "ability":
            if "eligible" in pending:
                return ["ability_cards", "ability_decision"] if pending.get("optional") else ["ability_cards"]
            return [{
                "name_suit": "ability_suit", "draw_until": "ability_decision",
                "swap_ruler": "ability_fief", "move_visit": "ability_fief", "refresh": "ability_ally",
            }[pending["kind"]]]
        return []

    @staticmethod
    def apply_action(state: Dict, player_id: str, action: Dict) -> Tuple[List[Dict], Optional[str]]:
        if not ACTION_VALIDATOR.is_valid(action):
            return [], "Invalid action."
        action_type = action["type"]
        if action_type not in ForNorthwoodGame.get_legal_actions(state, player_id):
            return [], "That action is not available now."
        if action_type == "choose_fief":
            if state["fiefs"][action["fief"]]["status"] != "unvisited":
                return [], "Choose an unvisited fief."
            state["current_fief"] = action["fief"]
            state["phase"] = "prepare"
        elif action_type == "substitute":
            slot, origin = action["slot"], action["fief"]
            fief = state["fiefs"][origin]
            if fief["status"] != "friendly" or fief["spent"] or origin in state["borrowed"]:
                return [], "That ruler cannot join this visit."
            if state["active_allies"][slot]["borrowed_from"] is not None:
                return [], "Return this guest before inviting another ruler."
            state["active_allies"][slot] = {"character": fief["ruler"], "exhausted": False, "borrowed_from": origin}
            state["borrowed"].append(origin)
        elif action_type == "return_ally":
            slot = action["slot"]
            origin = state["active_allies"][slot]["borrowed_from"]
            if origin is None:
                return [], "This is already a permanent ally."
            state["borrowed"].remove(origin)
            state["active_allies"][slot] = {"character": state["allies"][slot], "exhausted": False, "borrowed_from": None}
        elif action_type == "start_visit":
            state["phase"] = "before_trick"
            _log(state, f"Visit {len(state['history']) + 1}: fief {state['current_fief']}, trump {_trump(state)}.")
        elif action_type == "reveal":
            state["statement"] = state["deck"].pop()
            if state["known_top"] and state["known_top"][0] == state["statement"]:
                state["known_top"].pop(0)
            else:
                state["known_top"] = []
            state["discard"].append(state["statement"])
            state["phase"] = "respond"
        elif action_type == "play":
            card = action["card"]
            if card not in _legal_cards(state):
                return [], "You must follow the statement's suit if you can."
            won = response_wins(state["statement"], card, _trump(state))
            before = len(state["score"])
            _move_hand(state, [card], "score" if won else "discard")
            state["last_trick"] = {
                "number": state["trick"], "statement": state["statement"], "response": card,
                "won": won, "score_before": before, "score_after": len(state["score"]),
            }
            _log(state, f"Dialogue {state['trick']}: {'won' if won else 'lost'} the trick.")
            if state["parity_effect"]:
                state["parity_effect"] = False
                if _value(card) % 2 == 0:
                    _draw(state, 1)
                elif state["hand"]:
                    _pending_cards(state, "parity_discard", state["hand"], count=1)
                    return [{"type": "for_northwood:play"}], None
            _complete_trick(state)
        elif action_type == "use_ability":
            slot = action["slot"]
            ally = state["active_allies"][slot]
            if ally["exhausted"]:
                return [], "This ally is exhausted."
            state["ability_used"] = True
            state["ability_slot"] = slot
            ally["exhausted"] = True
            _log(state, f"Activated {CHARACTERS[ally['character']]['name']}.")
            _begin_ability(state, ally["character"])
        elif action_type == "ability_cards":
            error = _resolve_cards(state, action["cards"])
            if error:
                return [], error
        elif action_type == "ability_suit":
            _draw(state, 2)
            _forced_cards(state, [card for card in state["hand"] if _suit(card) == action["suit"]])
        elif action_type == "ability_fief":
            pending = state["pending"]
            destination = action["fief"]
            if destination not in pending["fiefs"]:
                return [], "Choose a highlighted fief."
            current = state["current_fief"]
            if pending["kind"] == "swap_ruler":
                state["fiefs"][current]["ruler"], state["fiefs"][destination]["ruler"] = (
                    state["fiefs"][destination]["ruler"], state["fiefs"][current]["ruler"])
            else:
                state["current_fief"] = destination
            _complete_ability(state)
        elif action_type == "ability_ally":
            if action["slot"] not in state["pending"]["slots"]:
                return [], "Choose another exhausted ally."
            state["active_allies"][action["slot"]]["exhausted"] = False
            _complete_ability(state)
        elif action_type == "ability_decision":
            pending = state["pending"]
            decision = action["decision"]
            if pending["kind"] == "draw_until" and decision in ("draw", "stop"):
                _draw_until(state) if decision == "draw" else _complete_ability(state)
            elif pending.get("optional") and decision == "skip":
                _baron_swap(state, "score") if pending["pile"] == "discard" else _complete_ability(state)
            else:
                return [], "Invalid ability choice."
        elif action_type == "next_trick":
            state["trick"] += 1
            state["statement"] = None
            state["ability_used"] = False
            state["phase"] = "before_trick"
        elif action_type == "next_round":
            if len(state["history"]) == 8:
                state["game_over"] = True
                state["phase"] = "game_over"
                state["winner"] = [player_id] if state["stars"] >= state["config"]["goal"] else []
                state["scores"] = {player_id: state["stars"]}
            else:
                _new_visit(state)
        return [{"type": f"for_northwood:{action_type}"}], None

    @staticmethod
    def get_public_view(state: Dict, viewer_id: str) -> Dict:
        owner = viewer_id == state["player_id"]
        fields = (
            "phase", "player_id", "player_name", "fiefs", "active_allies", "current_fief",
            "statement", "last_trick", "discard", "score", "stars", "history", "trick", "borrowed",
            "ability_used", "parity_effect", "log", "game_over", "winner", "scores", "config",
        )
        view = {key: copy.deepcopy(state[key]) for key in fields}
        view.update({
            "you": viewer_id,
            "is_owner": owner,
            "visit": min(8, len(state["history"]) + (state["phase"] not in ("visit_review", "game_over"))),
            "hand": list(state["hand"]) if owner else [],
            "hand_count": len(state["hand"]),
            "deck_count": len(state["deck"]),
            "known_top": list(state["known_top"]) if owner else [],
            "pending": copy.deepcopy(state["pending"]) if owner else None,
            "legal_cards": _legal_cards(state) if owner else [],
            "legal_actions": ForNorthwoodGame.get_legal_actions(state, viewer_id),
            "trump": _trump(state),
            "cards": copy.deepcopy(CARDS),
            "characters": copy.deepcopy(CHARACTERS),
            "suits": copy.deepcopy(SUITS),
            "star_values": list(STARS),
        })
        return view

    @staticmethod
    def bot_move(state: Dict, bot_id: str) -> Optional[Dict]:
        actions = ForNorthwoodGame.get_legal_actions(state, bot_id)
        if not actions:
            return None
        action = actions[0]
        if action == "choose_fief":
            return {"type": action, "fief": next(index for index, fief in enumerate(state["fiefs"]) if fief["status"] == "unvisited")}
        if action == "play":
            return {"type": action, "card": _legal_cards(state)[0]}
        if action == "ability_cards":
            pending = state["pending"]
            for count in ([pending["count"]] if "count" in pending else range(len(pending["eligible"]) + 1)):
                for selection in itertools.combinations(pending["eligible"], count):
                    if "total" in pending and sum(map(_value, selection)) != pending["total"]:
                        continue
                    if pending["kind"] == "duplicates":
                        remaining = Counter(_value(card) for card in state["hand"] if card not in selection)
                        if set(remaining) != set(map(_value, state["hand"])) or any(value != 1 for value in remaining.values()):
                            continue
                    return {"type": action, "cards": list(selection)}
        if action == "ability_decision":
            return {"type": action, "decision": "skip" if state["pending"].get("optional") else "stop"}
        if action == "ability_fief":
            return {"type": action, "fief": state["pending"]["fiefs"][0]}
        if action == "ability_ally":
            return {"type": action, "slot": state["pending"]["slots"][0]}
        if action == "ability_suit":
            return {"type": action, "suit": next(iter(SUITS))}
        return {"type": action}

    @staticmethod
    def serialize(state: Dict) -> Dict:
        return copy.deepcopy(state)

    @staticmethod
    def deserialize(payload: Dict) -> Dict:
        return copy.deepcopy(payload)
