import json
import random
import time
from pathlib import Path
from typing import Dict, List, Optional, Tuple

DEFAULT_CONFIG: Dict = {}

_CARD_CACHE: Optional[List[Dict]] = None


def _card_path() -> Path:
    return Path(__file__).resolve().parent / "assets" / "word_decode_cards.json"


def _normalize_text(value: Optional[str]) -> str:
    if not isinstance(value, str):
        return ""
    return " ".join(value.strip().split())


def _load_cards() -> List[Dict]:
    global _CARD_CACHE
    if _CARD_CACHE is not None:
        return list(_CARD_CACHE)

    path = _card_path()
    if not path.exists():
        raise ValueError(f"word decode cards missing: {path}")
    with path.open("r", encoding="utf-8") as handle:
        data = json.load(handle)
    if not isinstance(data, list):
        raise ValueError("word decode cards must be a list")

    cards: List[Dict] = []
    for entry in data:
        if not isinstance(entry, dict):
            continue
        base = entry.get("base")
        if not isinstance(base, str) or not base.strip():
            continue
        base = base.strip()
        hidden_raw = entry.get("hidden")
        if not isinstance(hidden_raw, list):
            continue
        hidden: List[str] = []
        for word in hidden_raw:
            if not isinstance(word, str):
                continue
            cleaned = word.strip()
            if not cleaned or cleaned == base or cleaned in hidden:
                continue
            hidden.append(cleaned)
        if len(hidden) < 3:
            continue
        bot_hints_raw = entry.get("bot_hints")
        bot_hints: Dict[str, List[str]] = {}
        if isinstance(bot_hints_raw, dict):
            for word, hints in bot_hints_raw.items():
                if not isinstance(word, str) or not word.strip():
                    continue
                if not isinstance(hints, list):
                    continue
                cleaned_hints = []
                for hint in hints:
                    if isinstance(hint, str) and hint.strip():
                        cleaned_hints.append(hint.strip())
                if cleaned_hints:
                    bot_hints[word.strip()] = cleaned_hints
        cards.append({"base": base, "hidden": hidden, "bot_hints": bot_hints})

    if not cards:
        raise ValueError("word decode cards empty")

    _CARD_CACHE = cards
    return list(_CARD_CACHE)


def _build_card_bag(cards: List[Dict]) -> List[Dict]:
    bag: List[Dict] = []
    for card in cards:
        bag.append(
            {
                "base": card["base"],
                "hidden": list(card.get("hidden") or []),
                "bot_hints": dict(card.get("bot_hints") or {}),
            }
        )
    random.shuffle(bag)
    return bag


def _draw_card(state: Dict) -> Dict:
    bag = state.get("card_bag") or []
    index = int(state.get("card_index", 0))
    if index >= len(bag):
        bag = _build_card_bag(state["cards"])
        index = 0
    card = bag[index]
    state["card_bag"] = bag
    state["card_index"] = index + 1
    return card


def _turn_order(players: List[Dict]) -> List[str]:
    return [p["player_id"] for p in sorted(players, key=lambda p: p.get("seat", 0))]


def _assign_hidden_words(card: Dict, player_ids: List[str]) -> Dict[str, str]:
    hidden_pool = list(card.get("hidden") or [])
    if len(hidden_pool) < len(player_ids):
        raise ValueError("not enough hidden words for player count")
    picks = random.sample(hidden_pool, len(player_ids))
    return {pid: picks[idx] for idx, pid in enumerate(player_ids)}


def _start_round(state: Dict) -> None:
    card = _draw_card(state)
    order = state.get("turn_order", [])
    assignments = _assign_hidden_words(card, order)
    state["current_card"] = card
    state["assignments"] = assignments
    state["hints"] = {}
    state["guesses"] = {}
    state["round_summary"] = None
    state["phase"] = "hint"


def _score_round(state: Dict) -> Dict:
    base_word = state.get("current_card", {}).get("base", "")
    assignments = state.get("assignments", {})
    guesses = state.get("guesses", {})
    scores_delta = {pid: 0 for pid in assignments}
    hidden_correct = {pid: [] for pid in assignments}
    base_correct: List[str] = []

    normalized_base = _normalize_text(base_word)
    for guesser_id, guess_data in guesses.items():
        base_guess = _normalize_text(guess_data.get("base_guess"))
        if base_guess and base_guess == normalized_base:
            scores_delta[guesser_id] = scores_delta.get(guesser_id, 0) + 3
            base_correct.append(guesser_id)
        hidden_guesses = guess_data.get("hidden_guesses", {})
        for target_id, guess in hidden_guesses.items():
            if target_id not in assignments:
                continue
            if _normalize_text(guess) == _normalize_text(assignments[target_id]):
                scores_delta[guesser_id] = scores_delta.get(guesser_id, 0) + 1
                scores_delta[target_id] = scores_delta.get(target_id, 0) + 1
                hidden_correct[target_id].append(guesser_id)

    for pid, delta in scores_delta.items():
        if pid in state.get("players", {}):
            state["players"][pid]["score"] += delta

    summary = {
        "round": state.get("round"),
        "base": base_word,
        "assignments": dict(assignments),
        "hints": {pid: list(hints) for pid, hints in state.get("hints", {}).items()},
        "guesses": {
            pid: {
                "base_guess": data.get("base_guess"),
                "hidden_guesses": dict(data.get("hidden_guesses", {})),
            }
            for pid, data in guesses.items()
        },
        "scores_delta": scores_delta,
        "base_correct": base_correct,
        "hidden_correct": hidden_correct,
    }
    return summary


def _bot_hints_for(card: Dict, hidden_word: str) -> List[str]:
    bot_hints = card.get("bot_hints") or {}
    options = [hint for hint in bot_hints.get(hidden_word, []) if isinstance(hint, str) and hint.strip()]
    if len(options) >= 2:
        return random.sample(options, 2)
    if len(options) == 1:
        return [options[0], options[0]]
    base = card.get("base")
    if isinstance(base, str) and base.strip():
        return [base.strip(), base.strip()]
    return [hidden_word, hidden_word]


class WordDecodeGame:
    game_id = "word_decode"
    min_players = 3
    max_players = 6

    @staticmethod
    def init_game(config: Optional[Dict], players: List[Dict]) -> Dict:
        order = _turn_order(players)
        player_meta = {p["player_id"]: p for p in players}
        cards = _load_cards()
        players_state = {pid: {"score": 0} for pid in order}

        state = {
            "players": players_state,
            "player_meta": player_meta,
            "turn_order": order,
            "round": 1,
            "phase": "hint",
            "cards": cards,
            "card_bag": [],
            "card_index": 0,
            "current_card": None,
            "assignments": {},
            "hints": {},
            "guesses": {},
            "round_summary": None,
            "config": config or {},
            "game_over": False,
            "game_start_time": time.time(),
        }
        _start_round(state)
        return state

    @staticmethod
    def get_legal_actions(state: Dict, player_id: str) -> List[str]:
        if state.get("game_over"):
            return []
        if player_id not in state.get("players", {}):
            return []
        phase = state.get("phase")
        if phase == "hint":
            if player_id not in state.get("hints", {}):
                return ["submit_hints"]
            return []
        if phase == "guess":
            if player_id not in state.get("guesses", {}):
                return ["submit_guesses"]
            return []
        if phase == "round_end":
            return ["next_round", "end_game"]
        return []

    @staticmethod
    def apply_action(state: Dict, player_id: str, action: Dict) -> Tuple[List[Dict], Optional[str]]:
        if state.get("game_over"):
            return [], "game over"
        if player_id not in state.get("players", {}):
            return [], "unknown player"
        if not isinstance(action, dict):
            return [], "invalid action"

        phase = state.get("phase")
        action_type = action.get("type")

        if phase == "hint":
            if action_type != "submit_hints":
                return [], "invalid action"
            if player_id in state.get("hints", {}):
                return [], "already submitted"
            hints = action.get("hints")
            if not isinstance(hints, list) or len(hints) != 2:
                return [], "two hints required"
            cleaned: List[str] = []
            for hint in hints:
                if not isinstance(hint, str) or not hint.strip():
                    return [], "invalid hint"
                cleaned.append(hint.strip())
            state["hints"][player_id] = cleaned
            if len(state["hints"]) >= len(state.get("assignments", {})):
                state["phase"] = "guess"
            return [], None

        if phase == "guess":
            if action_type != "submit_guesses":
                return [], "invalid action"
            if player_id in state.get("guesses", {}):
                return [], "already submitted"
            base_guess = action.get("base_guess")
            if not isinstance(base_guess, str) or not base_guess.strip():
                return [], "base_guess required"
            hidden_guesses_raw = action.get("hidden_guesses")
            if not isinstance(hidden_guesses_raw, list):
                return [], "hidden_guesses required"
            targets = [pid for pid in state.get("turn_order", []) if pid != player_id]
            guess_map: Dict[str, str] = {}
            for entry in hidden_guesses_raw:
                if not isinstance(entry, dict):
                    return [], "invalid hidden guess"
                target_id = entry.get("target_player_id")
                guess = entry.get("guess")
                if target_id not in targets:
                    return [], "invalid target"
                if target_id in guess_map:
                    return [], "duplicate target"
                if not isinstance(guess, str) or not guess.strip():
                    return [], "invalid guess"
                guess_map[target_id] = guess.strip()
            if len(guess_map) != len(targets):
                return [], "guesses incomplete"
            state["guesses"][player_id] = {
                "base_guess": base_guess.strip(),
                "hidden_guesses": guess_map,
            }
            if len(state["guesses"]) >= len(state.get("assignments", {})):
                summary = _score_round(state)
                state["round_summary"] = summary
                state["phase"] = "round_end"
            return [], None

        if phase == "round_end":
            if action_type == "next_round":
                state["round"] = int(state.get("round", 1)) + 1
                _start_round(state)
                return [], None
            if action_type == "end_game":
                state["phase"] = "game_over"
                state["game_over"] = True
                return [], None
            return [], "invalid action"

        return [], "invalid phase"

    @staticmethod
    def get_public_view(state: Dict, viewer_id: str) -> Dict:
        order = state.get("turn_order", [])
        meta_map = state.get("player_meta", {})
        players_view = []
        for pid in order:
            meta = meta_map.get(pid, {})
            pdata = state.get("players", {}).get(pid, {})
            players_view.append(
                {
                    "player_id": pid,
                    "name": meta.get("name"),
                    "seat": meta.get("seat"),
                    "is_bot": meta.get("is_bot"),
                    "score": pdata.get("score", 0),
                    "submitted_hints": pid in state.get("hints", {}),
                    "submitted_guesses": pid in state.get("guesses", {}),
                }
            )

        phase = state.get("phase")
        hints_view = None
        if phase in ("guess", "round_end", "game_over"):
            hints_view = {pid: list(hints) for pid, hints in state.get("hints", {}).items()}

        reveal = None
        if phase in ("round_end", "game_over"):
            reveal = state.get("round_summary")

        your_hidden = None
        if viewer_id in state.get("assignments", {}):
            your_hidden = state["assignments"].get(viewer_id)

        return {
            "game_id": WordDecodeGame.game_id,
            "you": viewer_id,
            "phase": phase,
            "round": state.get("round"),
            "players": players_view,
            "your_hidden_word": your_hidden,
            "hints": hints_view,
            "round_summary": reveal,
            "legal_actions": WordDecodeGame.get_legal_actions(state, viewer_id),
            "game_over": state.get("game_over", False),
        }

    @staticmethod
    def bot_move(state: Dict, bot_id: str) -> Optional[Dict]:
        if state.get("game_over"):
            return None
        if bot_id not in state.get("players", {}):
            return None

        phase = state.get("phase")
        if phase == "hint":
            if bot_id in state.get("hints", {}):
                return None
            hidden = state.get("assignments", {}).get(bot_id)
            if not hidden:
                return None
            card = state.get("current_card") or {}
            hints = _bot_hints_for(card, hidden)
            return {"type": "submit_hints", "hints": hints}

        if phase == "guess":
            if bot_id in state.get("guesses", {}):
                return None
            order = state.get("turn_order", [])
            targets = [pid for pid in order if pid != bot_id]
            hidden_pool = list(state.get("current_card", {}).get("hidden") or [])
            if not hidden_pool:
                hidden_pool = [""]
            guesses = []
            for target_id in targets:
                guess = random.choice(hidden_pool)
                guesses.append({"target_player_id": target_id, "guess": guess})
            base_pool = [card.get("base") for card in state.get("cards", []) if card.get("base")]
            if not base_pool:
                base_pool = [""]
            base_guess = random.choice(base_pool)
            return {"type": "submit_guesses", "base_guess": base_guess, "hidden_guesses": guesses}

        if phase == "round_end":
            meta = state.get("player_meta", {})
            order = state.get("turn_order", [])
            has_human = any(not meta.get(pid, {}).get("is_bot") for pid in order)
            if has_human:
                return None
            return {"type": "next_round"}

        return None

    @staticmethod
    def serialize(state: Dict) -> Dict:
        return state

    @staticmethod
    def deserialize(payload: Dict) -> Dict:
        return payload
