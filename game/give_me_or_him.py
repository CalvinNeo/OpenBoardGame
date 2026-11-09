"""给我！还是他？ (Give Me! Or Him?): a cooperative reverse-guessing word game.

Everyone can read the word on your stand except you. On your turn you either play
a hint card -- the number on its back decides whose word the hint is for, and only
the written word is public -- or you hand one of the team's three golden question
marks to any player and force them to guess right now. Guess right and the marker
returns to the middle; guess wrong and it shatters for good.

Rules source and confidence table: designs/task190.md.
"""
import copy
import random
import re
import unicodedata
from typing import Dict, List, Optional, Tuple

from game.give_me_or_him_data import (
    ACTION_SCHEMA,
    ACTION_VALIDATOR,
    CARDS_PER_NUMBER,
    CONFIG_SCHEMA,
    CONFIG_VALIDATOR,
    MAX_HINT_LENGTH,
    STARTING_HAND,
    TEAM_LIVES,
    WORDS,
)

STAGE_PLAY = "play"
STAGE_GUESSING = "guessing"
STAGE_REVEAL = "reveal"
STAGE_GAME_OVER = "game_over"

OUTCOME_WIN = "win"
OUTCOME_LOSE = "lose"

MAX_LOG_ENTRIES = 60
_PUNCT = re.compile(r"[\s\-_·・.,!?;:、，。！？；：'\"“”‘’()（）\[\]【】]+")


# --- Small helpers -------------------------------------------------------

def _as_tuple(value):
    return tuple(_as_tuple(item) for item in value) if isinstance(value, (list, tuple)) else value


def _json_random_state(rng: random.Random) -> List:
    version, numbers, gaussian = rng.getstate()
    return [version, list(numbers), gaussian]


def _shuffle(state: Dict, items: List) -> None:
    rng = random.Random()
    rng.setstate(_as_tuple(state["rng_state"]))
    rng.shuffle(items)
    state["rng_state"] = _json_random_state(rng)


def _sample(state: Dict, population: List, count: int) -> List:
    rng = random.Random()
    rng.setstate(_as_tuple(state["rng_state"]))
    picked = rng.sample(population, count)
    state["rng_state"] = _json_random_state(rng)
    return picked


def normalise(text: str) -> str:
    """Fold a hint or a guess down to comparable characters."""
    folded = unicodedata.normalize("NFKC", str(text or "")).strip().casefold()
    return _PUNCT.sub("", folded)


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


def _unsolved(state: Dict) -> List[str]:
    return [pid for pid in state["turn_order"] if not state["players"][pid]["solved"]]


def _player_by_number(state: Dict, number: int) -> Optional[str]:
    for pid in state["turn_order"]:
        if state["players"][pid]["number"] == number:
            return pid
    return None


def build_hint_deck(player_count: int) -> List[str]:
    """Three cards per player number; the whole deck is dealt out at setup."""
    return [
        f"hint-{number}-{copy_index}"
        for number in range(1, player_count + 1)
        for copy_index in range(CARDS_PER_NUMBER)
    ]


def card_number(card_id: str) -> int:
    return int(card_id.split("-")[1])


def card_target(state: Dict, player_id: str, card_id: str) -> Tuple[Optional[str], bool]:
    """Return (forced target, is_wild). A wild card may point at anybody still guessing."""
    owner = _player_by_number(state, card_number(card_id))
    if owner is None or owner == player_id or state["players"][owner]["solved"]:
        return None, True
    return owner, False


# --- Hint validation -----------------------------------------------------

def hint_error(state: Dict, text: str) -> Optional[str]:
    """Machine-checkable half of the five prohibitions (designs/task190.md §5)."""
    raw = str(text or "").strip()
    if not raw:
        return "提示词不能为空"
    if len(raw) > MAX_HINT_LENGTH:
        return f"提示词最多 {MAX_HINT_LENGTH} 个字"
    if not any(char.isalnum() for char in raw):
        return "提示词不能只用符号"
    folded = normalise(raw)
    if not folded:
        return "提示词不能只用符号"
    words = {normalise(state["players"][pid]["word"]) for pid in state["turn_order"]}
    if folded in words:
        return "不能直接用场上任何一位玩家的词"
    used_chars = set()
    for pid in state["turn_order"]:
        used_chars.update(normalise(state["players"][pid]["word"]))
    if set(folded) & used_chars:
        return "不能使用场上词语里出现过的字"
    if any(normalise(entry["text"]) == folded for entry in state["table"]):
        return "桌面上已经有相同的提示词了"
    return None


# --- Setup ---------------------------------------------------------------

def _deal(state: Dict) -> None:
    deck = build_hint_deck(len(state["turn_order"]))
    _shuffle(state, deck)
    picked_words = _sample(state, [word["zh"] for word in WORDS], len(state["turn_order"]))
    for index, pid in enumerate(state["turn_order"]):
        player = state["players"][pid]
        player["word"] = picked_words[index]
        player["hand"] = [deck.pop() for _ in range(STARTING_HAND)]
        player["solved"] = False
        player["wrong"] = []
        player["hints"] = 0
    state["deck"] = deck
    _log(state, f"发牌完成：每人 {STARTING_HAND} 张提示卡，{len(deck)} 张剩余。")


def _reset_for_rematch(state: Dict) -> None:
    state["stage"] = STAGE_PLAY
    state["turn"] = 1
    state["turn_index"] = 0
    state["table"] = []
    state["result"] = None
    state["guesser"] = None
    state["caller"] = None
    state["continue_ready"] = []
    state["rematch_ready"] = []
    state["game_over"] = False
    state["outcome"] = None
    state["lives"] = TEAM_LIVES
    state["log"] = []
    _deal(state)


def _check_game_end(state: Dict) -> bool:
    if not _unsolved(state):
        state["stage"] = STAGE_GAME_OVER
        state["game_over"] = True
        state["outcome"] = OUTCOME_WIN
        _log(state, "所有人都猜出了自己的词，全队获胜！")
        return True
    if state["lives"] <= 0:
        state["stage"] = STAGE_GAME_OVER
        state["game_over"] = True
        state["outcome"] = OUTCOME_LOSE
        _log(state, "三个金色问号全部碎掉，挑战失败。")
        return True
    return False


def _advance_turn(state: Dict) -> None:
    state["turn_index"] = (state["turn_index"] + 1) % len(state["turn_order"])
    state["turn"] += 1
    state["stage"] = STAGE_PLAY
    state["guesser"] = None
    state["caller"] = None
    state["continue_ready"] = []


# --- Bot ------------------------------------------------------------------
# A deliberately shallow policy, so this game is **not** listed in
# game/ai_metadata.py and Select Game shows no 🤖. It writes a random legal hint
# and guesses a random word that is still in play.
#
# Information discipline: the bot may read every other player's word, the table
# and its own hand, because a human sees exactly that much. When it guesses it
# draws uniformly from the *set* of words still in play — the same set a human is
# staring at — and never uses the knowledge of which entry in that set is its own.

HINT_ATTEMPTS = 60


def _bot_hint_text(state: Dict, rng: random.Random) -> Optional[str]:
    """Draw a word from the deck vocabulary that survives every hard check."""
    pool = [word["zh"] for word in WORDS]
    rng.shuffle(pool)
    for candidate in pool[:HINT_ATTEMPTS]:
        if hint_error(state, candidate) is None:
            return candidate
    return None


def _bot_choose_action(state: Dict, bot_id: str) -> Optional[Dict]:
    rng = random.Random()
    rng.seed(f"{state['game_id']}:{state['turn']}:{state['seq']}:{bot_id}")
    stage = state["stage"]
    turn = state["turn"]

    if stage == STAGE_GAME_OVER:
        return {"type": "play_again"}
    if stage == STAGE_REVEAL:
        return {"type": "continue", "turn": turn}

    if stage == STAGE_GUESSING:
        if state["guesser"] != bot_id:
            return None
        # Sorted so the candidate order carries no ownership hint.
        candidates = sorted({state["players"][pid]["word"] for pid in _unsolved(state)}
                            - set(state["players"][bot_id]["wrong"]))
        if not candidates:
            candidates = sorted({state["players"][pid]["word"] for pid in _unsolved(state)})
        return {"type": "guess", "turn": turn, "text": rng.choice(candidates)}

    hand = list(state["players"][bot_id]["hand"])
    rng.shuffle(hand)
    for card in hand:
        forced, wild = card_target(state, bot_id, card)
        target = forced
        if wild:
            options = _unsolved(state)
            if not options:
                break
            target = rng.choice(options)
        if target is None:
            continue
        text = _bot_hint_text(state, rng)
        if text is None:
            break
        return {"type": "give_hint", "turn": turn, "card": card, "target": target, "text": text}

    options = _unsolved(state)
    if state["lives"] > 0 and options:
        return {"type": "call_guess", "turn": turn, "target": rng.choice(options)}
    return None



# --- Serialization guard -------------------------------------------------

def _validate_saved_state(state: Dict) -> None:
    def require(condition: bool) -> None:
        if not condition:
            raise ValueError("invalid Give Me! Or Him? saved state")

    try:
        require(isinstance(state, dict) and state["game_id"] == "give_me_or_him" and state["version"] == 1)
        order = state["turn_order"]
        require(isinstance(order, list) and 3 <= len(order) <= 6 and len(set(order)) == len(order) and all(order))
        require(set(state["players"]) == set(order) and set(state["player_meta"]) == set(order))
        require(state["player_count"] == len(order))
        require(state["stage"] in (STAGE_PLAY, STAGE_GUESSING, STAGE_REVEAL, STAGE_GAME_OVER))
        require(type(state["game_over"]) is bool and state["game_over"] == (state["stage"] == STAGE_GAME_OVER))
        require(type(state["turn"]) is int and state["turn"] >= 1)
        require(type(state["turn_index"]) is int and 0 <= state["turn_index"] < len(order))
        require(type(state["lives"]) is int and 0 <= state["lives"] <= TEAM_LIVES)
        require(state["lives_max"] == TEAM_LIVES)
        require(state["outcome"] in (None, OUTCOME_WIN, OUTCOME_LOSE))
        require(isinstance(state["log"], list) and all(isinstance(line, str) for line in state["log"]))
        require(isinstance(state["table"], list))
        require(isinstance(state["deck"], list))
        require(isinstance(state["continue_ready"], list) and set(state["continue_ready"]) <= set(order))
        require(isinstance(state["rematch_ready"], list) and set(state["rematch_ready"]) <= set(order))

        seen_cards = list(state["deck"])
        for entry in state["table"]:
            require(set(entry) == {"card", "by", "target", "text", "seq"})
            require(entry["by"] in order and entry["target"] in order)
            require(isinstance(entry["text"], str) and entry["text"].strip())
            seen_cards.append(entry["card"])
        for pid in order:
            player = state["players"][pid]
            require(type(player["number"]) is int and 1 <= player["number"] <= len(order))
            require(isinstance(player["word"], str) and player["word"])
            require(type(player["solved"]) is bool)
            require(isinstance(player["wrong"], list) and isinstance(player["hints"], list) is False)
            require(type(player["hints"]) is int and player["hints"] >= 0)
            require(isinstance(player["hand"], list))
            seen_cards.extend(player["hand"])
        require(sorted(seen_cards) == sorted(build_hint_deck(len(order))))
        require(len(set(seen_cards)) == len(seen_cards))
        numbers = sorted(state["players"][pid]["number"] for pid in order)
        require(numbers == list(range(1, len(order) + 1)))
        rng = random.Random()
        rng.setstate(_as_tuple(state["rng_state"]))
    except (KeyError, TypeError, IndexError, AttributeError, OverflowError, ValueError) as error:
        if isinstance(error, ValueError) and str(error).startswith("invalid Give Me"):
            raise
        raise ValueError("invalid Give Me! Or Him? saved state") from error


# --- Game module ---------------------------------------------------------

class GiveMeOrHimGame:
    game_id = "give_me_or_him"
    min_players = 3
    max_players = 6

    @staticmethod
    def init_game(config: Optional[Dict], players: List[Dict]) -> Dict:
        cfg = {} if config is None else copy.deepcopy(config)
        if not CONFIG_VALIDATOR.is_valid(cfg):
            raise ValueError("invalid Give Me! Or Him? configuration")
        if not 3 <= len(players) <= 6:
            raise ValueError("Give Me! Or Him? requires 3-6 players")
        ordered = sorted(players, key=lambda player: player.get("seat", 0))
        ids = [player["player_id"] for player in ordered]
        if len(set(ids)) != len(ids) or any(not isinstance(pid, str) or not pid for pid in ids):
            raise ValueError("player IDs must be unique nonempty strings")
        rng = random.Random(cfg.get("seed"))
        state = {
            "game_id": GiveMeOrHimGame.game_id,
            "version": 1,
            "config": {},
            "rng_state": _json_random_state(rng),
            "turn_order": ids,
            "player_count": len(ids),
            "player_meta": {player["player_id"]: copy.deepcopy(player) for player in ordered},
            "players": {
                pid: {"number": index + 1, "word": "", "solved": False, "hand": [], "wrong": [], "hints": 0}
                for index, pid in enumerate(ids)
            },
            "deck": [],
            "table": [],
            "lives": TEAM_LIVES,
            "lives_max": TEAM_LIVES,
            "turn": 1,
            "turn_index": 0,
            "stage": STAGE_PLAY,
            "guesser": None,
            "caller": None,
            "result": None,
            "continue_ready": [],
            "rematch_ready": [],
            "game_over": False,
            "outcome": None,
            "seq": 0,
            "log": [],
        }
        _deal(state)
        return state

    @staticmethod
    def get_legal_actions(state: Dict, player_id: str) -> List[str]:
        if player_id not in state["players"]:
            return []
        stage = state["stage"]
        if stage == STAGE_GAME_OVER:
            return [] if player_id in state["rematch_ready"] else ["play_again"]
        if stage == STAGE_GUESSING:
            return ["guess"] if state["guesser"] == player_id else []
        if stage == STAGE_REVEAL:
            return [] if player_id in state["continue_ready"] else ["continue"]
        if _current_player(state) != player_id:
            return []
        actions = []
        if state["players"][player_id]["hand"]:
            actions.append("give_hint")
        if state["lives"] > 0 and _unsolved(state):
            actions.append("call_guess")
        return actions

    @staticmethod
    def apply_action(state: Dict, player_id: str, action: Dict) -> Tuple[List[Dict], Optional[str]]:
        if not isinstance(action, dict) or not ACTION_VALIDATOR.is_valid(action):
            return [], "invalid action schema"
        if player_id not in state["players"]:
            return [], "player not found"
        action_type = action["type"]
        if action_type != "play_again" and action.get("turn") != state["turn"]:
            return [], "stale turn"
        if action_type not in GiveMeOrHimGame.get_legal_actions(state, player_id):
            return [], "action unavailable in this stage"

        if action_type == "play_again":
            state["rematch_ready"].append(player_id)
            if len(state["rematch_ready"]) == len(state["turn_order"]):
                _reset_for_rematch(state)
            return [], None

        if action_type == "give_hint":
            card = action["card"]
            player = state["players"][player_id]
            if card not in player["hand"]:
                return [], "card is not in your hand"
            target = action["target"]
            if target not in state["players"]:
                return [], "unknown target"
            if state["players"][target]["solved"]:
                return [], "that player already guessed their word"
            forced, wild = card_target(state, player_id, card)
            if not wild and target != forced:
                return [], f"card {card} must be played on player {state['players'][forced]['number']}"
            error = hint_error(state, action["text"])
            if error:
                return [], error
            text = str(action["text"]).strip()
            player["hand"].remove(card)
            state["table"].append({
                "card": card, "by": player_id, "target": target, "text": text, "seq": state["seq"],
            })
            state["seq"] += 1
            state["players"][target]["hints"] += 1
            _log(state, f"{_name(state, player_id)} 打出提示「{text}」。")
            _advance_turn(state)
            return [], None

        if action_type == "call_guess":
            target = action["target"]
            if target not in state["players"] or state["players"][target]["solved"]:
                return [], "that player cannot guess"
            if state["lives"] <= 0:
                return [], "no golden question mark left"
            state["stage"] = STAGE_GUESSING
            state["guesser"] = target
            state["caller"] = player_id
            _log(state, f"{_name(state, player_id)} 点名 {_name(state, target)} 猜词。")
            return [], None

        if action_type == "guess":
            guesser = state["guesser"]
            if guesser != player_id:
                return [], "it is not your guess"
            text = str(action["text"]).strip()
            correct = normalise(text) == normalise(state["players"][player_id]["word"])
            state["result"] = {
                "player_id": player_id,
                "text": text,
                "correct": correct,
                "word": state["players"][player_id]["word"] if correct else None,
                "seq": state["seq"],
            }
            state["seq"] += 1
            if correct:
                state["players"][player_id]["solved"] = True
                _log(state, f"{_name(state, player_id)} 猜对了！金色问号回到中央。")
            else:
                state["lives"] -= 1
                state["players"][player_id]["wrong"].append(text)
                _log(state, f"{_name(state, player_id)} 猜错了，碎掉一个金色问号。")
            state["guesser"] = None
            if _check_game_end(state):
                return [], None
            state["stage"] = STAGE_REVEAL
            state["continue_ready"] = []
            return [], None

        # continue
        state["continue_ready"].append(player_id)
        if len(state["continue_ready"]) == len(state["turn_order"]):
            caller = state["caller"]
            state["turn_index"] = state["turn_order"].index(caller) if caller in state["turn_order"] else state["turn_index"]
            _advance_turn(state)
        return [], None

    @staticmethod
    def get_public_view(state: Dict, viewer_id: str) -> Dict:
        viewer = state["players"].get(viewer_id)
        reveal_all = state["stage"] == STAGE_GAME_OVER

        players_view = []
        for index, pid in enumerate(state["turn_order"]):
            player = state["players"][pid]
            meta = state["player_meta"][pid]
            visible = reveal_all or pid != viewer_id or player["solved"]
            players_view.append({
                "player_id": pid,
                "name": meta.get("name", pid),
                "seat": meta.get("seat", index),
                "is_bot": bool(meta.get("is_bot", False)),
                "number": player["number"],
                "solved": player["solved"],
                "word": player["word"] if visible else None,
                "hand_count": len(player["hand"]),
                "hints": player["hints"],
                "wrong": list(player["wrong"]),
                "ready": pid in state["continue_ready"] or pid in state["rematch_ready"],
            })

        hand_view = []
        if viewer:
            for card in viewer["hand"]:
                forced, wild = card_target(state, viewer_id, card)
                hand_view.append({
                    "id": card,
                    "number": card_number(card),
                    "wild": wild,
                    "target": forced,
                    "target_name": _name(state, forced) if forced else None,
                })

        return copy.deepcopy({
            "game_id": GiveMeOrHimGame.game_id,
            "stage": state["stage"],
            "turn": state["turn"],
            "player_count": state["player_count"],
            "lives": state["lives"],
            "lives_max": state["lives_max"],
            "you": viewer_id,
            "your_number": viewer["number"] if viewer else None,
            "current_player": _current_player(state),
            "guesser": state["guesser"],
            "caller": state["caller"],
            "result": state["result"],
            "continue_ready": list(state["continue_ready"]),
            "rematch_ready": list(state["rematch_ready"]),
            "game_over": state["game_over"],
            "outcome": state["outcome"],
            "players": players_view,
            "hand": hand_view,
            "table": [{"id": entry["card"], "text": entry["text"], "by": entry["by"], "seq": entry["seq"]}
                      for entry in state["table"]],
            "deck_count": len(state["deck"]),
            "legal_actions": GiveMeOrHimGame.get_legal_actions(state, viewer_id),
            "log": list(state["log"]),
        })

    @staticmethod
    def bot_move(state: Dict, bot_id: str) -> Optional[Dict]:
        if state.get("game_over") and bot_id in state.get("rematch_ready", []):
            return None
        if not GiveMeOrHimGame.get_legal_actions(state, bot_id):
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
    "CONFIG_SCHEMA",
    "GiveMeOrHimGame",
    "OUTCOME_LOSE",
    "OUTCOME_WIN",
    "STAGE_GAME_OVER",
    "STAGE_GUESSING",
    "STAGE_PLAY",
    "STAGE_REVEAL",
    "build_hint_deck",
    "card_target",
    "hint_error",
    "normalise",
]
