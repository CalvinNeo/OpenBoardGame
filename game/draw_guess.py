import random
from typing import Dict, List, Optional, Tuple

DEFAULT_PROMPTS = [
    "airplane",
    "apple",
    "backpack",
    "balloon",
    "beach",
    "bicycle",
    "bridge",
    "camera",
    "castle",
    "cat",
    "coffee",
    "cookie",
    "dinosaur",
    "dragon",
    "guitar",
    "hamburger",
    "island",
    "key",
    "kite",
    "lamp",
    "mountain",
    "octopus",
    "piano",
    "pizza",
    "rainbow",
    "robot",
    "rocket",
    "sailboat",
    "snowman",
    "spaceship",
    "sunflower",
    "telescope",
    "train",
    "treehouse",
    "umbrella",
    "whale",
]

PLACEHOLDER_IMAGE = (
    "data:image/png;base64,"
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/wcAAgAB/0X8GQAAAABJRU5ErkJggg=="
)

DEFAULT_CONFIG = {
    "prompt_pool": DEFAULT_PROMPTS,
}


def _merge_config(config: Optional[Dict]) -> Dict:
    cfg = {**DEFAULT_CONFIG}
    if config:
        prompt_pool = config.get("prompt_pool")
        if isinstance(prompt_pool, list) and prompt_pool:
            cfg["prompt_pool"] = prompt_pool
    return cfg


def _turn_order(players: List[Dict]) -> List[str]:
    return [p["player_id"] for p in sorted(players, key=lambda p: p.get("seat", 0))]


def _assign_prompts(prompt_pool: List[str], player_ids: List[str]) -> Dict[str, str]:
    prompts = list(prompt_pool) if prompt_pool else list(DEFAULT_PROMPTS)
    if not prompts:
        prompts = ["mystery"]
    if len(prompts) >= len(player_ids):
        choices = random.sample(prompts, len(player_ids))
    else:
        choices = [random.choice(prompts) for _ in range(len(player_ids))]
    return {pid: choices[idx] for idx, pid in enumerate(player_ids)}


def _book_owner_for_player(state: Dict, player_id: str) -> Optional[str]:
    order = state["turn_order"]
    if player_id not in order:
        return None
    total = len(order)
    if total == 0:
        return None
    idx = order.index(player_id)
    owner_idx = (idx - (state["round"] - 1)) % total
    return order[owner_idx]


def _normalize_text(value: Optional[str]) -> str:
    if not value:
        return ""
    return " ".join(value.strip().casefold().split())


def _submission_complete(state: Dict) -> bool:
    return len(state["submissions"]) >= len(state["turn_order"])


def _apply_round(state: Dict) -> None:
    phase = state["phase"]
    round_num = state["round"]
    entry_type = "drawing" if phase == "draw" else "guess"

    for player_id in state["turn_order"]:
        submission = state["submissions"].get(player_id)
        if not submission:
            continue
        owner_id = _book_owner_for_player(state, player_id)
        if owner_id is None:
            continue
        entry = {
            "round": round_num,
            "type": entry_type,
            "author_id": player_id,
            "text": submission.get("text"),
            "image_data": submission.get("image_data"),
        }
        state["books"][owner_id]["entries"].append(entry)

    state["submissions"] = {}
    if round_num >= state["total_rounds"]:
        state["phase"] = "review"
        state["game_over"] = True
        return

    state["round"] = round_num + 1
    state["phase"] = "guess" if phase == "draw" else "draw"


class DrawGuessGame:
    game_id = "draw_guess"
    min_players = 3
    max_players = 8

    @staticmethod
    def init_game(config: Optional[Dict], players: List[Dict]) -> Dict:
        cfg = _merge_config(config)
        order = _turn_order(players)
        player_meta = {p["player_id"]: p for p in players}
        total_rounds = len(order) if len(order) % 2 == 0 else max(len(order) - 1, 2)

        prompts = _assign_prompts(cfg.get("prompt_pool", []), order)
        books = {}
        for owner_id in order:
            books[owner_id] = {
                "owner_id": owner_id,
                "entries": [
                    {
                        "round": 0,
                        "type": "prompt",
                        "author_id": owner_id,
                        "text": prompts.get(owner_id, "mystery"),
                        "image_data": None,
                    }
                ],
            }

        players_state = {pid: {} for pid in order}

        return {
            "players": players_state,
            "turn_order": order,
            "round": 1,
            "total_rounds": total_rounds,
            "phase": "draw",
            "submissions": {},
            "books": books,
            "config": cfg,
            "player_meta": player_meta,
            "prompt_pool": cfg.get("prompt_pool", []),
            "game_over": False,
        }

    @staticmethod
    def get_legal_actions(state: Dict, player_id: str) -> List[str]:
        if state.get("game_over"):
            return []
        if player_id not in state.get("players", {}):
            return []
        if player_id in state.get("submissions", {}):
            return []
        if state["phase"] == "draw":
            return ["submit_drawing"]
        if state["phase"] == "guess":
            return ["submit_guess"]
        return []

    @staticmethod
    def apply_action(state: Dict, player_id: str, action: Dict) -> Tuple[List[Dict], Optional[str]]:
        if state.get("game_over"):
            return [], "game over"
        if player_id not in state.get("players", {}):
            return [], "player not found"
        if player_id in state.get("submissions", {}):
            return [], "already submitted"

        phase = state.get("phase")
        action_type = action.get("type")
        if phase == "draw":
            if action_type != "submit_drawing":
                return [], "invalid action"
            image_data = action.get("image_data")
            if not isinstance(image_data, str) or not image_data.strip():
                return [], "image_data required"
            state["submissions"][player_id] = {
                "type": "drawing",
                "text": None,
                "image_data": image_data,
            }
        elif phase == "guess":
            if action_type != "submit_guess":
                return [], "invalid action"
            text = action.get("text")
            if not isinstance(text, str) or not text.strip():
                return [], "text required"
            state["submissions"][player_id] = {
                "type": "guess",
                "text": text.strip(),
                "image_data": None,
            }
        else:
            return [], "invalid phase"

        if _submission_complete(state):
            _apply_round(state)

        return [], None

    @staticmethod
    def get_public_view(state: Dict, viewer_id: str) -> Dict:
        player_ids = state["turn_order"]
        player_map = state.get("player_meta", {})
        players_view = []
        for pid in player_ids:
            meta = player_map.get(pid, {})
            players_view.append(
                {
                    "player_id": pid,
                    "name": meta.get("name"),
                    "seat": meta.get("seat"),
                    "is_bot": meta.get("is_bot"),
                    "submitted": pid in state.get("submissions", {}),
                }
            )

        current_prompt = None
        current_drawing = None
        if viewer_id in state.get("players", {}):
            owner_id = _book_owner_for_player(state, viewer_id)
            if owner_id is not None:
                book = state["books"].get(owner_id)
                if book and book.get("entries"):
                    last_entry = book["entries"][-1]
                    if state["phase"] == "draw":
                        current_prompt = last_entry.get("text")
                    elif state["phase"] == "guess":
                        current_drawing = last_entry.get("image_data")

        review = None
        if state["phase"] == "review":
            books_view = []
            for owner_id in player_ids:
                meta = player_map.get(owner_id, {})
                book = state["books"].get(owner_id, {})
                entries = []
                for entry in book.get("entries", []):
                    author_meta = player_map.get(entry.get("author_id"), {})
                    entries.append(
                        {
                            "round": entry.get("round"),
                            "type": entry.get("type"),
                            "author_id": entry.get("author_id"),
                            "author_name": author_meta.get("name"),
                            "text": entry.get("text"),
                            "image_data": entry.get("image_data"),
                        }
                    )
                prompt = entries[0].get("text") if entries else None
                final_guess = None
                for entry in reversed(entries):
                    if entry.get("type") == "guess":
                        final_guess = entry.get("text")
                        break
                final_match = False
                if prompt and final_guess:
                    final_match = _normalize_text(prompt) == _normalize_text(final_guess)

                books_view.append(
                    {
                        "owner_id": owner_id,
                        "owner_name": meta.get("name"),
                        "entries": entries,
                        "prompt": prompt,
                        "final_guess": final_guess,
                        "final_match": final_match,
                    }
                )
            review = {"books": books_view}

        return {
            "game_id": DrawGuessGame.game_id,
            "you": viewer_id,
            "phase": state["phase"],
            "round": state["round"],
            "total_rounds": state["total_rounds"],
            "submitted": viewer_id in state.get("submissions", {}),
            "players": players_view,
            "current_prompt": current_prompt,
            "current_drawing": current_drawing,
            "review": review,
            "legal_actions": DrawGuessGame.get_legal_actions(state, viewer_id),
        }

    @staticmethod
    def bot_move(state: Dict, bot_id: str) -> Optional[Dict]:
        if state.get("game_over"):
            return None
        if bot_id not in state.get("players", {}):
            return None
        if bot_id in state.get("submissions", {}):
            return None

        if state["phase"] == "draw":
            return {"type": "submit_drawing", "image_data": PLACEHOLDER_IMAGE}
        if state["phase"] == "guess":
            prompt_pool = state.get("prompt_pool") or DEFAULT_PROMPTS
            guess = random.choice(prompt_pool) if prompt_pool else "unknown"
            return {"type": "submit_guess", "text": guess}
        return None

    @staticmethod
    def serialize(state: Dict) -> Dict:
        return state

    @staticmethod
    def deserialize(payload: Dict) -> Dict:
        return payload
