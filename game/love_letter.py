"""Classic 16-card Love Letter. All decisions are validated before mutation."""

import copy
import random
from collections import Counter
from typing import Dict, List, Optional, Tuple

from jsonschema import Draft7Validator


CARDS = {
    1: {"name": "Guard", "name_zh": "卫兵", "icon": "💂", "count": 5},
    2: {"name": "Priest", "name_zh": "牧师", "icon": "🔍", "count": 2},
    3: {"name": "Baron", "name_zh": "男爵", "icon": "⚔️", "count": 2},
    4: {"name": "Handmaid", "name_zh": "侍女", "icon": "🛡️", "count": 2},
    5: {"name": "Prince", "name_zh": "王子", "icon": "🤴", "count": 2},
    6: {"name": "King", "name_zh": "国王", "icon": "👑", "count": 1},
    7: {"name": "Countess", "name_zh": "伯爵夫人", "icon": "🌹", "count": 1},
    8: {"name": "Princess", "name_zh": "公主", "icon": "👸", "count": 1},
}
TOKEN_GOALS = {2: 7, 3: 5, 4: 4}
TARGET_CARDS = (1, 2, 3, 5, 6)
CONFIG_SCHEMA = {"type": "object", "properties": {}, "additionalProperties": False}
ACTION_SCHEMA = {
    "oneOf": [
        {
            "type": "object",
            "properties": {
                "type": {"const": "play_card"},
                "round": {"type": "integer", "minimum": 1},
                "turn": {"type": "integer", "minimum": 1},
                "card": {"type": "integer", "minimum": 1, "maximum": 8},
                "target": {"type": "string", "minLength": 1},
                "guess": {"type": "integer", "minimum": 2, "maximum": 8},
            },
            "required": ["type", "round", "turn", "card"],
            "additionalProperties": False,
        },
        {
            "type": "object",
            "properties": {
                "type": {"const": "next_round"},
                "round": {"type": "integer", "minimum": 1},
            },
            "required": ["type", "round"],
            "additionalProperties": False,
        },
    ]
}
_ACTION_VALIDATOR = Draft7Validator(ACTION_SCHEMA)
_CONFIG_VALIDATOR = Draft7Validator(CONFIG_SCHEMA)


def _log(state: Dict, message: str) -> None:
    state["log"].append({"round": state["round"], "turn": state["turn"], "text": message})
    del state["log"][:-80]


def _name(state: Dict, player_id: str) -> str:
    return state["player_meta"][player_id].get("name") or player_id


def _card_name(card: int) -> str:
    return f"{CARDS[card]['icon']} {CARDS[card]['name_zh']} ({card})"


def _invalidate_observations(state: Dict, target: str) -> None:
    # Invalidate on public hand-changing events, never on a secret identity check.
    for records in state["private_notes"].values():
        for record in records:
            if record["target"] == target:
                record["current"] = False


def _observe(state: Dict, viewer: str, target: str, card: int, source: str) -> None:
    records = state["private_notes"][viewer]
    records.append({"target": target, "card": card, "source": source,
                    "turn": state["turn"], "current": True})
    del records[:-24]


def _start_turn(state: Dict, player_id: str) -> None:
    state["turn"] += 1
    state["current_turn"] = player_id
    player = state["players"][player_id]
    player["protected"] = False
    _invalidate_observations(state, player_id)
    player["hand"].append(state["deck"].pop())


def _start_round(state: Dict, starter: str) -> None:
    deck = [rank for rank, card in CARDS.items() for _ in range(card["count"])]
    random.shuffle(deck)
    state["reserve"] = deck.pop()
    state["removed"] = [deck.pop() for _ in range(3)] if len(state["turn_order"]) == 2 else []
    for player in state["players"].values():
        player.update(hand=[deck.pop()], discards=[], alive=True, protected=False, eliminated_by=None)
    state.update(deck=deck, phase="play", next_ready=[], start_player=starter,
                 round_summary=None, private_notes={pid: [] for pid in state["turn_order"]})
    _start_turn(state, starter)
    _log(state, f"第 {state['round']} 轮开始。")


def _targets(state: Dict, actor: str, card: int) -> List[str]:
    if card not in TARGET_CARDS:
        return []
    return [pid for pid in state["turn_order"]
            if state["players"][pid]["alive"]
            and (pid != actor or card == 5)
            and (pid == actor or not state["players"][pid]["protected"])]


def _playable_cards(state: Dict, player_id: str) -> List[int]:
    hand = state["players"][player_id]["hand"]
    if 7 in hand and (5 in hand or 6 in hand):
        return [7]
    return sorted(set(hand))


def _eliminate(state: Dict, player_id: str, reason: str) -> None:
    player = state["players"][player_id]
    revealed = list(player["hand"])
    player["discards"].extend(revealed)
    player.update(hand=[], alive=False, protected=False, eliminated_by=reason)
    _invalidate_observations(state, player_id)
    cards = "、".join(_card_name(card) for card in revealed)
    _log(state, f"{_name(state, player_id)} 淘汰：{reason}。" + (f"弃掉 {cards}。" if cards else ""))


def _finish_round(state: Dict, survivors: List[str]) -> None:
    best_hand = max(state["players"][pid]["hand"][0] for pid in survivors)
    contenders = [pid for pid in survivors if state["players"][pid]["hand"][0] == best_hand]
    best_discard = max(sum(state["players"][pid]["discards"]) for pid in contenders)
    winners = [pid for pid in contenders if sum(state["players"][pid]["discards"]) == best_discard]
    reason = "last_survivor" if len(survivors) == 1 else "highest_card"
    if len(contenders) > 1:
        reason = "shared_win" if len(winners) > 1 else "discard_total"
    for pid in winners:
        state["players"][pid]["tokens"] += 1
    state["round_summary"] = {
        "round": state["round"], "reason": reason, "winners": winners,
        "players": [{"player_id": pid, "hand": list(state["players"][pid]["hand"]),
                     "discard_total": sum(state["players"][pid]["discards"]),
                     "alive": state["players"][pid]["alive"],
                     "tokens": state["players"][pid]["tokens"]} for pid in state["turn_order"]],
    }
    state["current_turn"] = None
    state["next_ready"] = []
    state["winner"] = [pid for pid in state["turn_order"]
                       if state["players"][pid]["tokens"] >= state["token_goal"]]
    state["game_over"] = bool(state["winner"])
    state["phase"] = "game_over" if state["game_over"] else "round_end"
    _log(state, f"{'、'.join(_name(state, pid) for pid in winners)} 获得好感 (❤️ +1)。")


def _advance(state: Dict, actor: str) -> None:
    survivors = [pid for pid in state["turn_order"] if state["players"][pid]["alive"]]
    if len(survivors) == 1 or not state["deck"]:
        _finish_round(state, survivors)
        return
    order = state["turn_order"]
    index = order.index(actor)
    for offset in range(1, len(order) + 1):
        candidate = order[(index + offset) % len(order)]
        if candidate in survivors:
            _start_turn(state, candidate)
            return


def _resolve_card(state: Dict, actor: str, card: int, target: Optional[str], guess: Optional[int]) -> None:
    player = state["players"][actor]
    player["hand"].remove(card)
    player["discards"].append(card)
    _log(state, f"{_name(state, actor)} 打出 {_card_name(card)}。")
    if card in TARGET_CARDS and target is None:
        _log(state, "没有可指定的玩家，效果跳过。")
        return
    if card == 1:
        _log(state, f"猜测 {_name(state, target)} 持有 {_card_name(guess)}。")
        if state["players"][target]["hand"][0] == guess:
            _eliminate(state, target, "卫兵猜中")
        else:
            _log(state, "卫兵未猜中。")
    elif card == 2:
        _observe(state, actor, target, state["players"][target]["hand"][0], "priest")
        _log(state, f"{_name(state, actor)} 秘密查看了 {_name(state, target)} 的手牌。")
    elif card == 3:
        own, other = player["hand"][0], state["players"][target]["hand"][0]
        _observe(state, actor, target, other, "baron")
        _observe(state, target, actor, own, "baron")
        _log(state, f"{_name(state, actor)} 与 {_name(state, target)} 秘密比较手牌。")
        if own != other:
            _eliminate(state, actor if own < other else target, "男爵比牌落败")
        else:
            _log(state, "男爵比牌平手，无人淘汰。")
    elif card == 4:
        player["protected"] = True
    elif card == 5:
        affected = state["players"][target]
        discarded = affected["hand"].pop()
        affected["discards"].append(discarded)
        _invalidate_observations(state, target)
        _log(state, f"{_name(state, target)} 因王子弃掉 {_card_name(discarded)}。")
        if discarded == 8:
            _eliminate(state, target, "弃掉公主")
        elif state["deck"]:
            affected["hand"].append(state["deck"].pop())
        else:
            affected["hand"].append(state["reserve"])
            state["reserve"] = None
    elif card == 6:
        other = state["players"][target]
        _invalidate_observations(state, actor)
        _invalidate_observations(state, target)
        player["hand"], other["hand"] = other["hand"], player["hand"]
        _observe(state, actor, target, other["hand"][0], "king")
        _observe(state, target, actor, player["hand"][0], "king")
        _log(state, f"{_name(state, actor)} 与 {_name(state, target)} 交换了手牌。")
    elif card == 8:
        _eliminate(state, actor, "打出公主")


class LoveLetterGame:
    game_id = "love_letter"
    min_players = 2
    max_players = 4

    @staticmethod
    def init_game(config: Optional[Dict], players: List[Dict]) -> Dict:
        config = {} if config is None else config
        if not _CONFIG_VALIDATOR.is_valid(config):
            raise ValueError("invalid Love Letter configuration")
        if not 2 <= len(players) <= 4:
            raise ValueError("Love Letter requires 2–4 players")
        ordered = sorted(players, key=lambda player: player.get("seat", 0))
        ids = [player["player_id"] for player in ordered]
        if any(not isinstance(pid, str) or not pid for pid in ids) or len(set(ids)) != len(ids):
            raise ValueError("player IDs must be unique nonempty strings")
        state = {
            "game_id": LoveLetterGame.game_id, "version": 1, "config": {},
            "players": {pid: {"tokens": 0} for pid in ids},
            "player_meta": {player["player_id"]: copy.deepcopy(player) for player in ordered},
            "turn_order": ids, "round": 1, "turn": 0, "token_goal": TOKEN_GOALS[len(ids)],
            "log": [], "winner": [], "game_over": False,
        }
        _start_round(state, random.choice(ids))
        return state

    @staticmethod
    def get_legal_actions(state: Dict, player_id: str) -> List[str]:
        if state["game_over"] or player_id not in state["players"]:
            return []
        if state["phase"] == "round_end" and player_id not in state["next_ready"]:
            return ["next_round"]
        if state["phase"] == "play" and player_id == state["current_turn"]:
            return ["play_card"]
        return []

    @staticmethod
    def apply_action(state: Dict, player_id: str, action: Dict) -> Tuple[List[Dict], Optional[str]]:
        if not isinstance(action, dict) or not _ACTION_VALIDATOR.is_valid(action):
            return [], "invalid action schema"
        if any(type(action[key]) is not int for key in ("round", "turn", "card", "guess") if key in action):
            return [], "action numbers must be integers"
        if action["type"] not in LoveLetterGame.get_legal_actions(state, player_id):
            return [], "action unavailable"
        if action["round"] != state["round"]:
            return [], "stale round"
        if action["type"] == "next_round":
            state["next_ready"].append(player_id)
            if len(state["next_ready"]) == len(state["turn_order"]):
                starter = random.choice(state["round_summary"]["winners"])
                state["round"] += 1
                _start_round(state, starter)
            return [{"type": "love_letter:ready", "payload": {"player_id": player_id}}], None
        if action["turn"] != state["turn"]:
            return [], "stale turn"
        card = action["card"]
        if card not in _playable_cards(state, player_id):
            return [], "card unavailable; Countess must be played with Prince or King"
        targets = _targets(state, player_id, card)
        target, guess = action.get("target"), action.get("guess")
        if targets and target not in targets:
            return [], "choose an eligible target"
        if not targets and "target" in action:
            return [], "this card has no eligible target"
        if card == 1 and targets:
            if guess not in range(2, 9):
                return [], "Guard must guess a rank from 2 to 8"
        elif "guess" in action:
            return [], "this action does not need a guess"
        _resolve_card(state, player_id, card, target, guess)
        _advance(state, player_id)
        # No private values ever enter the shared event stream.
        return [{"type": "love_letter:played", "payload": {
            "player_id": player_id, "card": card, "target": target, "guess": guess,
        }}], None

    @staticmethod
    def get_public_view(state: Dict, viewer_id: str) -> Dict:
        reveal = state["phase"] in ("round_end", "game_over")
        legal = LoveLetterGame.get_legal_actions(state, viewer_id)
        playable = _playable_cards(state, viewer_id) if "play_card" in legal else []
        view = {
            "game_id": LoveLetterGame.game_id, "you": viewer_id,
            "phase": state["phase"], "round": state["round"], "turn": state["turn"],
            "current_turn": state["current_turn"], "start_player": state["start_player"],
            "deck_count": len(state["deck"]), "reserve_count": int(state["reserve"] is not None),
            "removed": state["removed"], "token_goal": state["token_goal"],
            "your_hand": state["players"].get(viewer_id, {}).get("hand", []),
            "private_notes": state["private_notes"].get(viewer_id, []),
            "legal_actions": legal, "playable_cards": playable,
            "targets": {str(card): _targets(state, viewer_id, card) for card in playable},
            "next_ready": state["next_ready"], "round_summary": state["round_summary"],
            "game_over": state["game_over"], "winner": state["winner"],
            "log": state["log"], "config": {},
            "players": [{
                "player_id": pid, "name": _name(state, pid),
                "seat": state["player_meta"][pid].get("seat", 0),
                "is_bot": bool(state["player_meta"][pid].get("is_bot")),
                "tokens": state["players"][pid]["tokens"],
                "alive": state["players"][pid]["alive"],
                "protected": state["players"][pid]["protected"],
                "hand_count": len(state["players"][pid]["hand"]),
                "revealed_hand": state["players"][pid]["hand"] if reveal else [],
                "discards": state["players"][pid]["discards"],
                "eliminated_by": state["players"][pid]["eliminated_by"],
            } for pid in state["turn_order"]],
        }
        return copy.deepcopy(view)

    @staticmethod
    def bot_move(state: Dict, bot_id: str) -> Optional[Dict]:
        # This boundary is intentional: no strategy code reads opponents' state.
        return _choose_bot_action(LoveLetterGame.get_public_view(state, bot_id))

    @staticmethod
    def serialize(state: Dict) -> Dict:
        return copy.deepcopy(state)

    @staticmethod
    def deserialize(payload: Dict) -> Dict:
        return copy.deepcopy(payload)


def _choose_bot_action(view: Dict) -> Optional[Dict]:
    if "next_round" in view["legal_actions"]:
        return {"type": "next_round", "round": view["round"]}
    if "play_card" not in view["legal_actions"]:
        return None
    unseen = Counter({rank: card["count"] for rank, card in CARDS.items()})
    unseen.subtract(view["your_hand"] + view["removed"])
    for player in view["players"]:
        unseen.subtract(player["discards"])
    knowledge = {record["target"]: record["card"] for record in view["private_notes"] if record["current"]}
    candidates = []
    for card in view["playable_cards"]:
        kept = list(view["your_hand"])
        kept.remove(card)
        remaining = kept[0]
        targets = view["targets"][str(card)]
        for target in targets or [None]:
            action = {"type": "play_card", "round": view["round"], "turn": view["turn"], "card": card}
            if target is not None:
                action["target"] = target
            score = float(remaining)
            weights = Counter({rank: max(0, count) for rank, count in unseen.items()})
            if target in knowledge:
                weights = Counter({knowledge[target]: 1})
            total = sum(weights.values()) or 1
            expected = sum(rank * count for rank, count in weights.items()) / total
            if card == 8:
                score -= 100
            elif card == 4:
                score += 1.8
            elif card == 1 and target:
                guess = max(range(2, 9), key=lambda rank: (weights[rank], rank))
                action["guess"] = guess
                score += 12 * weights[guess] / total
            elif card == 2 and target:
                score += 1.2 if target not in knowledge else 0
            elif card == 3 and target:
                score += sum((10 if rank < remaining else -14 if rank > remaining else 0) * count
                             for rank, count in weights.items()) / total
            elif card == 5 and target:
                if target == view["you"]:
                    score += -100 if remaining == 8 else expected - remaining
                else:
                    score += 14 * weights[8] / total + (expected - 4) / 2
            elif card == 6 and target:
                score += expected - remaining
            candidates.append((score, action))
    return max(candidates, key=lambda entry: entry[0])[1] if candidates else None
