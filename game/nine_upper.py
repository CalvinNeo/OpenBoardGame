import copy
import hashlib
import json
import random
import secrets
import time
from pathlib import Path
from typing import Dict, List, Optional, Tuple


DEFAULT_CONFIG = {"rounds_per_thinker": 1}
DIFFICULTY_LABELS = {1: "入门", 2: "进阶", 3: "烧脑"}
MAX_STATEMENT_LENGTH = 280

_TERM_CACHE: Optional[List[Dict]] = None


def _term_pack_path() -> Path:
    return Path(__file__).resolve().parent / "assets" / "nine_upper_terms.json"


def _clean_text(value: object) -> str:
    if not isinstance(value, str):
        return ""
    return " ".join(value.strip().split())


def _load_terms() -> List[Dict]:
    global _TERM_CACHE
    if _TERM_CACHE is not None:
        return copy.deepcopy(_TERM_CACHE)

    try:
        with _term_pack_path().open("r", encoding="utf-8") as handle:
            payload = json.load(handle)
    except (OSError, json.JSONDecodeError) as exc:
        raise ValueError(f"unable to load 9UPPER term pack: {exc}") from exc

    raw_terms = payload.get("terms") if isinstance(payload, dict) else None
    if not isinstance(raw_terms, list):
        raise ValueError("9UPPER term pack must contain a terms list")

    terms: List[Dict] = []
    term_ids = set()
    terms_by_difficulty = {1: 0, 2: 0, 3: 0}
    for raw in raw_terms:
        if not isinstance(raw, dict):
            raise ValueError("9UPPER terms must be objects")
        term_id = _clean_text(raw.get("id"))
        term = _clean_text(raw.get("term"))
        pronunciation = _clean_text(raw.get("pronunciation"))
        category = _clean_text(raw.get("category"))
        definition = _clean_text(raw.get("definition"))
        difficulty = raw.get("difficulty")
        if not term_id or term_id in term_ids:
            raise ValueError("9UPPER term ids must be unique non-empty strings")
        if not term or not category or not definition:
            raise ValueError(f"9UPPER term {term_id} is incomplete")
        if difficulty not in DIFFICULTY_LABELS:
            raise ValueError(f"9UPPER term {term_id} has invalid difficulty")
        term_ids.add(term_id)
        terms_by_difficulty[difficulty] += 1
        terms.append(
            {
                "id": term_id,
                "term": term,
                "pronunciation": pronunciation,
                "category": category,
                "definition": definition,
                "difficulty": difficulty,
            }
        )

    for difficulty, count in terms_by_difficulty.items():
        if count < 18:
            raise ValueError(f"9UPPER difficulty {difficulty} needs at least 18 terms")
    _TERM_CACHE = terms
    return copy.deepcopy(terms)


def _merge_config(config: Optional[Dict]) -> Tuple[Dict, str]:
    rounds_per_thinker = DEFAULT_CONFIG["rounds_per_thinker"]
    seed: object = secrets.token_hex(16)
    if isinstance(config, dict):
        raw_rounds = config.get("rounds_per_thinker", rounds_per_thinker)
        if isinstance(raw_rounds, int) and not isinstance(raw_rounds, bool) and 1 <= raw_rounds <= 2:
            rounds_per_thinker = raw_rounds
        raw_seed = config.get("seed")
        if isinstance(raw_seed, (str, int)) and not isinstance(raw_seed, bool):
            if str(raw_seed).strip():
                seed = raw_seed
    return {"rounds_per_thinker": rounds_per_thinker}, str(seed)


def _next_rng(state: Dict, purpose: str) -> random.Random:
    counter = int(state.get("rng_counter", 0))
    material = f"{state.get('rng_seed', '')}|{state.get('game_index', 1)}|{counter}|{purpose}"
    digest = hashlib.sha256(material.encode("utf-8")).digest()
    state["rng_counter"] = counter + 1
    return random.Random(int.from_bytes(digest[:16], "big"))


def _player_name(state: Dict, player_id: Optional[str]) -> str:
    if not player_id:
        return "-"
    meta = state.get("player_meta", {}).get(player_id, {})
    return str(meta.get("name") or player_id)


def _answerer_ids(state: Dict) -> List[str]:
    thinker_id = state.get("thinker_id")
    return [player_id for player_id in state.get("turn_order", []) if player_id != thinker_id]


def _build_term_decks(state: Dict) -> None:
    terms = _load_terms()
    state["term_cards"] = {term["id"]: term for term in terms}
    state["term_decks"] = {}
    for difficulty in DIFFICULTY_LABELS:
        deck = [term["id"] for term in terms if term["difficulty"] == difficulty]
        _next_rng(state, f"term-deck-{difficulty}").shuffle(deck)
        state["term_decks"][str(difficulty)] = deck
    state["used_term_ids"] = []


def _draw_term(state: Dict, difficulty: int) -> Dict:
    deck = state.get("term_decks", {}).get(str(difficulty), [])
    if not deck:
        used = set(state.get("used_term_ids", []))
        deck = [
            term_id
            for term_id, term in state.get("term_cards", {}).items()
            if term.get("difficulty") == difficulty and term_id not in used
        ]
        if not deck:
            deck = [
                term_id
                for term_id, term in state.get("term_cards", {}).items()
                if term.get("difficulty") == difficulty
            ]
        _next_rng(state, f"term-refill-{difficulty}").shuffle(deck)
        state.setdefault("term_decks", {})[str(difficulty)] = deck
    if not deck:
        raise ValueError(f"no 9UPPER terms for difficulty {difficulty}")
    term_id = deck.pop()
    state.setdefault("used_term_ids", []).append(term_id)
    return state["term_cards"][term_id]


def _category_options(state: Dict, category: str, difficulty: int) -> List[str]:
    if difficulty == 1:
        return [category]
    if difficulty == 3:
        return []
    categories = sorted({term["category"] for term in state.get("term_cards", {}).values()})
    decoys = [item for item in categories if item != category]
    rng = _next_rng(state, f"category-options-{state.get('round', 1)}")
    rng.shuffle(decoys)
    options = [category] + decoys[:2]
    rng.shuffle(options)
    return options


def _start_round(state: Dict) -> None:
    order = state["turn_order"]
    round_number = int(state["round"])
    thinker_index = (int(state["first_thinker_index"]) + round_number - 1) % len(order)
    thinker_id = order[thinker_index]
    possible_honest = [player_id for player_id in order if player_id != thinker_id]
    previous_honest = state.get("honest_id")
    if len(possible_honest) > 1 and previous_honest in possible_honest:
        possible_honest = [player_id for player_id in possible_honest if player_id != previous_honest]
    honest_id = _next_rng(state, f"honest-{round_number}").choice(possible_honest)

    state.update(
        {
            "phase": "difficulty_selection",
            "thinker_id": thinker_id,
            "honest_id": honest_id,
            "difficulty": None,
            "term_id": None,
            "term": None,
            "pronunciation": None,
            "category": None,
            "category_options": [],
            "definition": None,
            "statements": {},
            "selected_player_id": None,
            "next_round_ready": [],
            "last_round_summary": None,
            "game_over": False,
            "winner_ids": [],
        }
    )


def _score_round(state: Dict, selected_player_id: str) -> Dict:
    thinker_id = state["thinker_id"]
    honest_id = state["honest_id"]
    difficulty = int(state["difficulty"])
    correct = selected_player_id == honest_id
    round_points = {player_id: 0 for player_id in state["turn_order"]}
    if correct:
        round_points[thinker_id] = difficulty
        round_points[honest_id] = difficulty
    else:
        round_points[selected_player_id] = difficulty
    for player_id, points in round_points.items():
        state["players"][player_id]["score"] += points

    summary = {
        "round": int(state["round"]),
        "difficulty": difficulty,
        "difficulty_label": DIFFICULTY_LABELS[difficulty],
        "term": state["term"],
        "pronunciation": state.get("pronunciation"),
        "category": state["category"],
        "definition": state["definition"],
        "thinker_id": thinker_id,
        "honest_id": honest_id,
        "selected_player_id": selected_player_id,
        "correct": correct,
        "statements": [
            {
                "player_id": player_id,
                "name": _player_name(state, player_id),
                "text": state["statements"].get(player_id, ""),
                "role": "honest" if player_id == honest_id else "bluffer",
            }
            for player_id in _answerer_ids(state)
        ],
        "round_points": round_points,
        "scores_after_round": {
            player_id: int(state["players"][player_id]["score"])
            for player_id in state["turn_order"]
        },
    }
    state["selected_player_id"] = selected_player_id
    state["last_round_summary"] = summary
    state.setdefault("round_history", []).append(copy.deepcopy(summary))
    state["next_round_ready"] = []

    if int(state["round"]) >= int(state["total_rounds"]):
        best_score = max(player["score"] for player in state["players"].values())
        state["winner_ids"] = [
            player_id
            for player_id in state["turn_order"]
            if state["players"][player_id]["score"] == best_score
        ]
        state["phase"] = "game_over"
        state["game_over"] = True
        state["game_end_time"] = time.time()
    else:
        state["phase"] = "round_result"
    return summary


def _reset_for_play_again(state: Dict) -> None:
    config = copy.deepcopy(state.get("config") or DEFAULT_CONFIG)
    players = [copy.deepcopy(state["player_meta"][player_id]) for player_id in state["turn_order"]]
    seed = state.get("rng_seed")
    game_index = int(state.get("game_index", 1)) + 1
    fresh = NineUpperGame.init_game({**config, "seed": f"{seed}|game-{game_index}"}, players)
    fresh["game_index"] = game_index
    state.clear()
    state.update(fresh)


def _bot_statement(state: Dict, bot_id: str) -> str:
    if bot_id == state.get("honest_id"):
        return str(state.get("definition") or "")

    difficulty = int(state.get("difficulty") or 3)
    visible_categories = list(state.get("category_options") or [])
    all_categories = sorted({term["category"] for term in state.get("term_cards", {}).values()})
    rng = _next_rng(state, f"bot-bluff-{state.get('round', 1)}-{bot_id}")
    if difficulty == 1:
        bluff_category = state.get("category")
    elif visible_categories:
        bluff_category = rng.choice(visible_categories)
    else:
        bluff_category = rng.choice(all_categories)
    candidates = [
        term
        for term in state.get("term_cards", {}).values()
        if term.get("id") != state.get("term_id") and term.get("category") == bluff_category
    ]
    if not candidates:
        candidates = [
            term for term in state.get("term_cards", {}).values() if term.get("id") != state.get("term_id")
        ]
    borrowed = rng.choice(candidates)
    openings = ["这个词指的是", "我记得它是", "它原本用来描述", "准确说，是指"]
    return f"{rng.choice(openings)}{borrowed['definition']}"


class NineUpperGame:
    game_id = "nine_upper"
    min_players = 3
    max_players = 9

    @staticmethod
    def init_game(config: Optional[Dict], players: List[Dict]) -> Dict:
        if not isinstance(players, list) or not NineUpperGame.min_players <= len(players) <= NineUpperGame.max_players:
            raise ValueError("9UPPER requires 3 to 9 players")
        ordered_players = sorted(players, key=lambda player: player.get("seat", 0))
        order = [player.get("player_id") for player in ordered_players]
        if any(not isinstance(player_id, str) or not player_id for player_id in order):
            raise ValueError("9UPPER players need non-empty player ids")
        if len(set(order)) != len(order):
            raise ValueError("9UPPER players need unique player ids")

        cfg, seed = _merge_config(config)
        player_meta = {
            player["player_id"]: copy.deepcopy(player) for player in ordered_players
        }
        state = {
            "game_id": NineUpperGame.game_id,
            "game_index": 1,
            "config": cfg,
            "rng_seed": seed,
            "rng_counter": 0,
            "turn_order": order,
            "first_thinker_index": 0,
            "players": {
                player_id: {
                    "score": 0,
                    "is_bot": bool(player_meta[player_id].get("is_bot")),
                }
                for player_id in order
            },
            "player_meta": player_meta,
            "phase": "difficulty_selection",
            "round": 1,
            "total_rounds": len(order) * cfg["rounds_per_thinker"],
            "thinker_id": None,
            "honest_id": None,
            "difficulty": None,
            "term_id": None,
            "term": None,
            "pronunciation": None,
            "category": None,
            "category_options": [],
            "definition": None,
            "statements": {},
            "selected_player_id": None,
            "next_round_ready": [],
            "last_round_summary": None,
            "round_history": [],
            "winner_ids": [],
            "game_over": False,
            "game_start_time": time.time(),
            "game_end_time": None,
        }
        _build_term_decks(state)
        state["first_thinker_index"] = _next_rng(state, "first-thinker").randrange(len(order))
        _start_round(state)
        return state

    @staticmethod
    def get_legal_actions(state: Dict, player_id: str) -> List[str]:
        if player_id not in state.get("players", {}):
            return []
        phase = state.get("phase")
        if phase == "game_over":
            return ["play_again"]
        if phase == "difficulty_selection":
            return ["select_difficulty"] if player_id == state.get("thinker_id") else []
        if phase == "statements":
            if player_id == state.get("thinker_id") or player_id in state.get("statements", {}):
                return []
            return ["submit_statement"]
        if phase == "guessing":
            return ["choose_honest"] if player_id == state.get("thinker_id") else []
        if phase == "round_result" and player_id not in state.get("next_round_ready", []):
            return ["next_round"]
        return []

    @staticmethod
    def apply_action(state: Dict, player_id: str, action: Dict) -> Tuple[List[Dict], Optional[str]]:
        if player_id not in state.get("players", {}):
            return [], "unknown player"
        if not isinstance(action, dict):
            return [], "invalid action"
        action_type = action.get("type")
        legal_actions = NineUpperGame.get_legal_actions(state, player_id)
        if action_type not in legal_actions:
            return [], "invalid action"

        if action_type == "select_difficulty":
            difficulty = action.get("difficulty")
            if difficulty not in DIFFICULTY_LABELS:
                return [], "invalid difficulty"
            card = _draw_term(state, difficulty)
            state["difficulty"] = difficulty
            state["term_id"] = card["id"]
            state["term"] = card["term"]
            state["pronunciation"] = card.get("pronunciation")
            state["category"] = card["category"]
            state["definition"] = card["definition"]
            state["category_options"] = _category_options(state, card["category"], difficulty)
            state["phase"] = "statements"
            return [
                {
                    "type": "nine_upper:difficulty_selected",
                    "payload": {"player_id": player_id, "difficulty": difficulty},
                }
            ], None

        if action_type == "submit_statement":
            raw_statement = action.get("statement")
            if not isinstance(raw_statement, str):
                return [], "statement required"
            statement = _clean_text(raw_statement)
            if not statement:
                return [], "statement required"
            if len(statement) > MAX_STATEMENT_LENGTH:
                return [], f"statement may contain at most {MAX_STATEMENT_LENGTH} characters"
            state.setdefault("statements", {})[player_id] = statement
            if all(player in state["statements"] for player in _answerer_ids(state)):
                state["phase"] = "guessing"
            return [
                {"type": "nine_upper:statement_submitted", "payload": {"player_id": player_id}}
            ], None

        if action_type == "choose_honest":
            selected_player_id = action.get("player_id")
            if selected_player_id not in _answerer_ids(state):
                return [], "invalid player"
            summary = _score_round(state, selected_player_id)
            return [
                {
                    "type": "nine_upper:round_scored",
                    "payload": {
                        "round": summary["round"],
                        "selected_player_id": selected_player_id,
                        "correct": summary["correct"],
                    },
                }
            ], None

        if action_type == "next_round":
            ready = state.setdefault("next_round_ready", [])
            if player_id not in ready:
                ready.append(player_id)
            events = [
                {"type": "nine_upper:next_round_ready", "payload": {"player_id": player_id}}
            ]
            if all(player in ready for player in state["turn_order"]):
                state["round"] = int(state["round"]) + 1
                _start_round(state)
                events.append(
                    {"type": "nine_upper:round_started", "payload": {"round": state["round"]}}
                )
            return events, None

        if action_type == "play_again":
            _reset_for_play_again(state)
            return [
                {"type": "nine_upper:play_again", "payload": {"player_id": player_id}}
            ], None

        return [], "invalid action"

    @staticmethod
    def get_public_view(state: Dict, viewer_id: str) -> Dict:
        phase = state.get("phase")
        thinker_id = state.get("thinker_id")
        honest_id = state.get("honest_id")
        statements = state.get("statements", {})
        ready = set(state.get("next_round_ready", []))
        players = []
        for player_id in state.get("turn_order", []):
            meta = state.get("player_meta", {}).get(player_id, {})
            players.append(
                {
                    "player_id": player_id,
                    "name": meta.get("name"),
                    "seat": meta.get("seat"),
                    "is_bot": bool(meta.get("is_bot")),
                    "score": int(state["players"][player_id]["score"]),
                    "is_thinker": player_id == thinker_id,
                    "statement_submitted": player_id in statements,
                    "next_round_ready": player_id in ready,
                }
            )

        if viewer_id == thinker_id:
            your_role = "thinker"
        elif viewer_id == honest_id:
            your_role = "honest"
        else:
            your_role = "bluffer"

        visible_statements = []
        if phase == "guessing":
            visible_statements = [
                {
                    "player_id": player_id,
                    "name": _player_name(state, player_id),
                    "text": statements.get(player_id, ""),
                }
                for player_id in _answerer_ids(state)
            ]

        definition = None
        if viewer_id == honest_id and phase in ("statements", "guessing"):
            definition = state.get("definition")

        return {
            "game_id": NineUpperGame.game_id,
            "you": viewer_id,
            "phase": phase,
            "round": int(state.get("round", 1)),
            "total_rounds": int(state.get("total_rounds", 0)),
            "thinker_id": thinker_id,
            "players": players,
            "your_role": your_role,
            "difficulty": state.get("difficulty"),
            "difficulty_label": DIFFICULTY_LABELS.get(state.get("difficulty")),
            "difficulty_options": [
                {"value": value, "label": label, "points": value}
                for value, label in DIFFICULTY_LABELS.items()
            ],
            "term": state.get("term"),
            "pronunciation": state.get("pronunciation"),
            "category_options": list(state.get("category_options") or []),
            "your_definition": definition,
            "your_statement": statements.get(viewer_id),
            "statements": visible_statements,
            "statement_progress": {
                "done": len(statements),
                "total": len(_answerer_ids(state)),
            },
            "next_round_progress": {
                "done": len(ready),
                "total": len(state.get("turn_order", [])),
            },
            "last_round_summary": copy.deepcopy(state.get("last_round_summary")),
            "winner_ids": list(state.get("winner_ids", [])),
            "game_over": bool(state.get("game_over")),
            "config": copy.deepcopy(state.get("config", {})),
            "legal_actions": NineUpperGame.get_legal_actions(state, viewer_id),
        }

    @staticmethod
    def bot_move(state: Dict, bot_id: str) -> Optional[Dict]:
        legal_actions = NineUpperGame.get_legal_actions(state, bot_id)
        if "select_difficulty" in legal_actions:
            rng = _next_rng(state, f"bot-difficulty-{state.get('round', 1)}-{bot_id}")
            return {
                "type": "select_difficulty",
                "difficulty": rng.choice([1, 2, 2, 3]),
                "delay_ms": rng.randint(500, 1000),
            }
        if "submit_statement" in legal_actions:
            rng = _next_rng(state, f"bot-statement-delay-{state.get('round', 1)}-{bot_id}")
            return {
                "type": "submit_statement",
                "statement": _bot_statement(state, bot_id),
                "delay_ms": rng.randint(650, 1300),
            }
        if "choose_honest" in legal_actions:
            rng = _next_rng(state, f"bot-choice-{state.get('round', 1)}-{bot_id}")
            return {
                "type": "choose_honest",
                "player_id": rng.choice(_answerer_ids(state)),
                "delay_ms": rng.randint(900, 1500),
            }
        if "next_round" in legal_actions:
            rng = _next_rng(state, f"bot-next-{state.get('round', 1)}-{bot_id}")
            return {"type": "next_round", "delay_ms": rng.randint(700, 1200)}
        return None

    @staticmethod
    def serialize(state: Dict) -> Dict:
        return state

    @staticmethod
    def deserialize(payload: Dict) -> Dict:
        return payload
