import json
import random
import time
from pathlib import Path
from typing import Dict, List, Optional, Tuple

from game.memories import build_html_document, esc, format_bool, format_timestamp, render_table, section

DEFAULT_CONFIG: Dict = {"guess_time_limit_sec": 0}
GUESS_TIME_LIMIT_OPTIONS = {0, 60, 120}

_CARD_CACHE: Optional[List[Dict]] = None


def _card_path() -> Path:
    return Path(__file__).resolve().parent / "assets" / "word_decode_cards.json"


def _normalize_text(value: Optional[str]) -> str:
    if not isinstance(value, str):
        return ""
    return " ".join(value.strip().split())


def _now_ms() -> int:
    return int(time.time() * 1000)


def _normalize_guess_time_limit(value: object) -> Optional[int]:
    try:
        parsed = int(value)
    except (TypeError, ValueError):
        return None
    if parsed not in GUESS_TIME_LIMIT_OPTIONS:
        return None
    return parsed


def _merge_config(config: Optional[Dict]) -> Dict:
    merged = dict(DEFAULT_CONFIG)
    if not isinstance(config, dict):
        return merged
    guess_time_limit = _normalize_guess_time_limit(config.get("guess_time_limit_sec"))
    if guess_time_limit is not None:
        merged["guess_time_limit_sec"] = guess_time_limit
    return merged


def _is_single_chinese_char(value: str) -> bool:
    if not isinstance(value, str):
        return False
    text = value.strip()
    if len(text) != 1:
        return False
    code = ord(text)
    return (
        0x4E00 <= code <= 0x9FFF
        or 0x3400 <= code <= 0x4DBF
        or 0x20000 <= code <= 0x2A6DF
        or 0x2A700 <= code <= 0x2B73F
        or 0x2B740 <= code <= 0x2B81F
        or 0x2B820 <= code <= 0x2CEAF
        or 0x2CEB0 <= code <= 0x2EBEF
        or 0x30000 <= code <= 0x3134F
    )


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
    state["guess_submit_order"] = []
    state["guess_drafts"] = {}
    state["guess_deadline_ms"] = None
    state["pending_timeout"] = None
    state["round_summary"] = None
    state["phase"] = "hint"


def _set_guess_timeout(state: Dict) -> None:
    config = state.get("config") or {}
    raw_limit = config.get("guess_time_limit_sec", DEFAULT_CONFIG["guess_time_limit_sec"])
    limit_sec = _normalize_guess_time_limit(raw_limit)
    if limit_sec is None:
        limit_sec = DEFAULT_CONFIG["guess_time_limit_sec"]
    if limit_sec <= 0:
        state["guess_deadline_ms"] = None
        state["pending_timeout"] = None
        return
    deadline_ms = _now_ms() + limit_sec * 1000
    state["guess_deadline_ms"] = deadline_ms
    state["pending_timeout"] = {"type": "guess", "at_ms": deadline_ms}


def _finalize_round(state: Dict) -> None:
    summary = _score_round(state)
    state["round_summary"] = summary
    history = state.get("round_history")
    if not isinstance(history, list):
        history = []
        state["round_history"] = history
    history.append(summary)
    state["phase"] = "round_end"
    state["guess_deadline_ms"] = None
    state["pending_timeout"] = None
    state["guess_submit_order"] = []
    state["guess_drafts"] = {}


def _build_timeout_guess_data(state: Dict, player_id: str) -> Dict:
    draft_map = state.get("guess_drafts")
    if not isinstance(draft_map, dict):
        draft_map = {}
    player_draft = draft_map.get(player_id)
    if not isinstance(player_draft, dict):
        player_draft = {}

    raw_base = player_draft.get("base_guess")
    base_guess = raw_base.strip() if isinstance(raw_base, str) else ""

    raw_hidden = player_draft.get("hidden_guesses")
    hidden_draft = raw_hidden if isinstance(raw_hidden, dict) else {}

    targets = [pid for pid in state.get("turn_order", []) if pid != player_id]
    hidden_guesses: Dict[str, str] = {}
    for target_id in targets:
        guess_value = hidden_draft.get(target_id)
        hidden_guesses[target_id] = guess_value.strip() if isinstance(guess_value, str) else ""

    return {"base_guess": base_guess, "hidden_guesses": hidden_guesses}


def _score_round(state: Dict) -> Dict:
    base_word = state.get("current_card", {}).get("base", "")
    assignments = state.get("assignments", {})
    guesses = state.get("guesses", {})
    scores_delta = {pid: 0 for pid in assignments}
    hidden_correct = {pid: [] for pid in assignments}
    base_correct: List[str] = []

    normalized_base = _normalize_text(base_word)
    first_submitter = None
    submit_order = state.get("guess_submit_order")
    if isinstance(submit_order, list) and submit_order:
        first_submitter = submit_order[0]
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

    base_first_bonus_player = None
    if first_submitter and first_submitter in base_correct:
        scores_delta[first_submitter] = scores_delta.get(first_submitter, 0) + 1
        base_first_bonus_player = first_submitter

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
        "base_first_bonus_player": base_first_bonus_player,
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


def _player_label(player_meta: Dict, player_id: str) -> str:
    meta = player_meta.get(player_id, {})
    return meta.get("name") or player_id or "-"


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

        merged_config = _merge_config(config)
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
            "guess_submit_order": [],
            "guess_drafts": {},
            "guess_deadline_ms": None,
            "pending_timeout": None,
            "round_summary": None,
            "round_history": [],
            "config": merged_config,
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
                if not _is_single_chinese_char(hint):
                    return [], "hint must be a single Chinese character"
                cleaned.append(hint.strip())
            state["hints"][player_id] = cleaned
            if len(state["hints"]) >= len(state.get("assignments", {})):
                state["phase"] = "guess"
                _set_guess_timeout(state)
            return [], None

        if phase == "guess":
            if action_type == "update_guess_draft":
                if player_id in state.get("guesses", {}):
                    return [], None
                base_guess = action.get("base_guess")
                if not isinstance(base_guess, str):
                    base_guess = ""
                hidden_guesses_raw = action.get("hidden_guesses")
                if not isinstance(hidden_guesses_raw, list):
                    hidden_guesses_raw = []
                targets = [pid for pid in state.get("turn_order", []) if pid != player_id]
                draft_map: Dict[str, str] = {}
                for entry in hidden_guesses_raw:
                    if not isinstance(entry, dict):
                        continue
                    target_id = entry.get("target_player_id")
                    guess = entry.get("guess")
                    if target_id not in targets or target_id in draft_map:
                        continue
                    if not isinstance(guess, str):
                        continue
                    draft_map[target_id] = guess.strip()
                drafts = state.get("guess_drafts")
                if not isinstance(drafts, dict):
                    drafts = {}
                    state["guess_drafts"] = drafts
                drafts[player_id] = {"base_guess": base_guess.strip(), "hidden_guesses": draft_map}
                return [], None
            if action_type != "submit_guesses":
                return [], "invalid action"
            if player_id in state.get("guesses", {}):
                return [], "already submitted"
            base_guess = action.get("base_guess")
            if not isinstance(base_guess, str):
                return [], "base_guess required"
            hidden_guesses_raw = action.get("hidden_guesses")
            if not isinstance(hidden_guesses_raw, list):
                return [], "hidden_guesses required"
            targets = [pid for pid in state.get("turn_order", []) if pid != player_id]
            guess_map: Dict[str, str] = {target_id: "" for target_id in targets}
            seen_targets = set()
            for entry in hidden_guesses_raw:
                if not isinstance(entry, dict):
                    return [], "invalid hidden guess"
                target_id = entry.get("target_player_id")
                guess = entry.get("guess")
                if target_id not in targets:
                    return [], "invalid target"
                if target_id in seen_targets:
                    return [], "duplicate target"
                if not isinstance(guess, str):
                    return [], "invalid guess"
                guess_map[target_id] = guess.strip()
                seen_targets.add(target_id)
            state["guesses"][player_id] = {
                "base_guess": base_guess.strip(),
                "hidden_guesses": guess_map,
            }
            submit_order = state.get("guess_submit_order")
            if not isinstance(submit_order, list):
                submit_order = []
                state["guess_submit_order"] = submit_order
            if player_id not in submit_order:
                submit_order.append(player_id)
            drafts = state.get("guess_drafts")
            if isinstance(drafts, dict):
                drafts.pop(player_id, None)
            if len(state["guesses"]) >= len(state.get("assignments", {})):
                _finalize_round(state)
            return [], None

        if phase == "round_end":
            if action_type == "next_round":
                state["round"] = int(state.get("round", 1)) + 1
                _start_round(state)
                return [], None
            if action_type == "end_game":
                state["phase"] = "game_over"
                state["game_over"] = True
                state["pending_timeout"] = None
                state["guess_deadline_ms"] = None
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
            "guess_deadline_ms": state.get("guess_deadline_ms") if phase == "guess" else None,
            "config": dict(state.get("config") or {}),
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

    @staticmethod
    def resolve_guess_timeout(state: Dict, now_ms: int) -> Optional[List[Dict]]:
        if state.get("phase") != "guess":
            return None
        pending = state.get("pending_timeout")
        if not isinstance(pending, dict):
            return None
        if pending.get("type") != "guess":
            return None
        try:
            at_ms = int(pending.get("at_ms", 0))
        except (TypeError, ValueError):
            state["pending_timeout"] = None
            state["guess_deadline_ms"] = None
            return None
        if at_ms <= 0 or now_ms < at_ms:
            return None

        auto_submitted_ids: List[str] = []
        submit_order = state.get("guess_submit_order")
        if not isinstance(submit_order, list):
            submit_order = []
            state["guess_submit_order"] = submit_order
        all_players = list(state.get("assignments", {}).keys())
        for pid in all_players:
            if pid in state.get("guesses", {}):
                continue
            state["guesses"][pid] = _build_timeout_guess_data(state, pid)
            if pid not in submit_order:
                submit_order.append(pid)
            auto_submitted_ids.append(pid)

        _finalize_round(state)
        return [
            {
                "type": "word_decode:guess_timeout",
                "payload": {
                    "auto_submitted_player_ids": auto_submitted_ids,
                },
            }
        ]

    @staticmethod
    def download_memories(state: Dict, room_id: Optional[str] = None) -> str:
        return build_memories_html(state, room_id)


def build_memories_html(state: Dict, room_id: Optional[str] = None) -> str:
    game_id = WordDecodeGame.game_id
    status_label = "Game Over" if state.get("game_over") else "In Progress"
    header = [
        "<h1>Download Memories</h1>",
        f"<div class=\"meta\">Game: {esc(game_id, '-')} · Room: {esc(room_id, '-')}</div>",
        f"<div class=\"meta\">Status: {esc(status_label, status_label)}</div>",
    ]
    start_time = format_timestamp(state.get("game_start_time"))
    if start_time != "-":
        header.append(f"<div class=\"meta\">Game Start: {esc(start_time, start_time)}</div>")
    header.append(f"<div class=\"meta\">Generated: {esc(format_timestamp(time.time()), '-')}</div>")

    player_meta = state.get("player_meta", {})
    order = state.get("turn_order", [])
    player_rows: List[List[str]] = []
    for pid in order:
        meta = player_meta.get(pid, {})
        score = state.get("players", {}).get(pid, {}).get("score", 0)
        player_rows.append(
            [
                esc(pid, "-"),
                esc(meta.get("name"), "-"),
                esc(meta.get("seat"), "-"),
                format_bool(meta.get("is_bot")),
                esc(score, "0"),
            ]
        )
    players_section = section(
        "Players",
        render_table(["Player ID", "Name", "Seat", "Bot", "Score"], player_rows, empty_message="No players"),
    )

    history = state.get("round_history")
    if not isinstance(history, list):
        history = []
    if not history:
        summary = state.get("round_summary")
        if isinstance(summary, dict):
            history = [summary]

    round_blocks: List[str] = []
    for entry in history:
        if not isinstance(entry, dict):
            continue
        round_num = entry.get("round", "-")
        base_word = entry.get("base", "-")
        base_correct = entry.get("base_correct") or []
        base_correct_names = [_player_label(player_meta, pid) for pid in base_correct]
        base_correct_text = ", ".join(base_correct_names) if base_correct_names else "-"
        round_header = [
            f"<h3>Round {esc(round_num, round_num)}</h3>",
            f"<div class=\"small\">Base Word: {esc(base_word, '-')}</div>",
            f"<div class=\"small\">Base Guessed By: {esc(base_correct_text, base_correct_text)}</div>",
        ]

        assignments = entry.get("assignments", {}) or {}
        hints = entry.get("hints", {}) or {}
        hidden_correct = entry.get("hidden_correct", {}) or {}
        hidden_rows: List[List[str]] = []
        for pid in order:
            hidden_word = assignments.get(pid)
            hint_list = hints.get(pid, []) or []
            hint_text = " / ".join(esc(hint, "-") for hint in hint_list) if hint_list else "-"
            guessers = hidden_correct.get(pid, []) or []
            guesser_names = ", ".join(_player_label(player_meta, gid) for gid in guessers) if guessers else "-"
            hidden_rows.append(
                [
                    esc(_player_label(player_meta, pid), "-"),
                    esc(hidden_word, "-"),
                    hint_text,
                    esc(guesser_names, "-"),
                ]
            )
        hidden_table = render_table(
            ["Player", "Hidden Word", "Hints", "Guessed By"],
            hidden_rows,
            empty_message="No hidden words",
        )

        guesses = entry.get("guesses", {}) or {}
        guess_rows: List[List[str]] = []
        for guesser_id in order:
            guess_data = guesses.get(guesser_id, {}) or {}
            base_guess = guess_data.get("base_guess")
            base_correct_flag = "Yes" if guesser_id in base_correct else "No"
            hidden_guesses = guess_data.get("hidden_guesses", {}) or {}
            hidden_lines: List[str] = []
            for target_id in order:
                if target_id == guesser_id:
                    continue
                target_name = _player_label(player_meta, target_id)
                guess_word = hidden_guesses.get(target_id)
                hidden_lines.append(f"{esc(target_name, target_name)}: {esc(guess_word, '-')}")
            hidden_cell = "<br/>".join(hidden_lines) if hidden_lines else "-"
            guess_rows.append(
                [
                    esc(_player_label(player_meta, guesser_id), "-"),
                    esc(base_guess, "-"),
                    esc(base_correct_flag, "-"),
                    hidden_cell,
                ]
            )
        guesses_table = render_table(
            ["Guesser", "Base Guess", "Base Correct", "Hidden Guesses"],
            guess_rows,
            empty_message="No guesses",
        )

        scores_delta = entry.get("scores_delta", {}) or {}
        score_rows: List[List[str]] = []
        for pid in order:
            delta = scores_delta.get(pid, 0)
            score_rows.append([esc(_player_label(player_meta, pid), "-"), esc(delta, "0")])
        scores_table = render_table(
            ["Player", "Score Delta"],
            score_rows,
            empty_message="No scores",
        )

        round_blocks.append(
            "<div class=\"card\">" + "".join(round_header) + hidden_table + guesses_table + scores_table + "</div>"
        )

    rounds_section = section(
        "Rounds",
        "".join(round_blocks) if round_blocks else '<div class="muted">No rounds completed</div>',
    )

    body = "\n".join(header) + players_section + rounds_section
    return build_html_document(f"{game_id} Memories", body)
