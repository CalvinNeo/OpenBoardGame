import json
import random
from pathlib import Path
from typing import Dict, List, Optional, Tuple
from urllib.parse import quote

DEFAULT_CONFIG = {
    "deck_root": ".aidixit",
    "selected_decks": [],
    "hand_size": 6,
    "target_score": 30,
    "reshuffle_discard": True,
    "player_colors": [
        "#ef4444",
        "#f59e0b",
        "#22c55e",
        "#3b82f6",
        "#6366f1",
        "#8b5cf6",
        "#ec4899",
        "#14b8a6",
    ],
}

_ALLOWED_EXTENSIONS = {".png", ".jpg", ".jpeg", ".webp"}
_CONFIG_CACHE: Optional[Dict] = None


def _config_path() -> Path:
    return Path(__file__).resolve().parent / "assets" / "aidixit.json"


def _normalize_int(value: object, minimum: int) -> Optional[int]:
    try:
        parsed = int(value)
    except (TypeError, ValueError):
        return None
    if parsed < minimum:
        return None
    return parsed


def _normalize_bool(value: object) -> Optional[bool]:
    if isinstance(value, bool):
        return value
    return None


def _normalize_str_list(value: object) -> List[str]:
    if not isinstance(value, list):
        return []
    cleaned: List[str] = []
    for entry in value:
        if not isinstance(entry, str):
            continue
        trimmed = entry.strip()
        if trimmed:
            cleaned.append(trimmed)
    return cleaned


def _normalize_colors(value: object) -> List[str]:
    colors = _normalize_str_list(value)
    return colors


def _normalize_config(raw: Optional[Dict], base: Optional[Dict] = None) -> Dict:
    cfg = dict(base or DEFAULT_CONFIG)
    if not isinstance(raw, dict):
        raw = {}

    deck_root = raw.get("deck_root")
    if isinstance(deck_root, str) and deck_root.strip():
        cfg["deck_root"] = deck_root.strip()

    selected_decks = _normalize_str_list(raw.get("selected_decks"))
    if selected_decks:
        cfg["selected_decks"] = selected_decks

    hand_size = _normalize_int(raw.get("hand_size"), 1)
    if hand_size is not None:
        cfg["hand_size"] = hand_size

    target_score = _normalize_int(raw.get("target_score"), 1)
    if target_score is not None:
        cfg["target_score"] = target_score

    reshuffle = _normalize_bool(raw.get("reshuffle_discard"))
    if reshuffle is not None:
        cfg["reshuffle_discard"] = reshuffle

    colors = _normalize_colors(raw.get("player_colors"))
    if colors:
        cfg["player_colors"] = colors

    if not cfg.get("player_colors"):
        cfg["player_colors"] = list(DEFAULT_CONFIG["player_colors"])

    return cfg


def _load_base_config() -> Dict:
    global _CONFIG_CACHE
    if _CONFIG_CACHE is not None:
        return dict(_CONFIG_CACHE)

    raw: Optional[Dict] = None
    path = _config_path()
    if path.exists():
        with path.open("r", encoding="utf-8") as handle:
            data = json.load(handle)
        if isinstance(data, dict):
            raw = data
    cfg = _normalize_config(raw)
    _CONFIG_CACHE = cfg
    return dict(cfg)


def _merge_config(config: Optional[Dict]) -> Dict:
    base = _load_base_config()
    if not isinstance(config, dict) or not config:
        return base
    merged = dict(base)
    merged.update(config)
    return _normalize_config(merged, base=base)


def _deck_root_path(config: Optional[Dict] = None) -> Path:
    cfg = config if isinstance(config, dict) else _load_base_config()
    root = cfg.get("deck_root") or DEFAULT_CONFIG["deck_root"]
    return Path(root).expanduser()


def _scan_decks(deck_root: Path) -> Dict[str, List[str]]:
    decks: Dict[str, List[str]] = {}
    if not deck_root.is_dir():
        return decks
    for entry in sorted(deck_root.iterdir(), key=lambda p: p.name.casefold()):
        if not entry.is_dir():
            continue
        deck_id = entry.name
        if not deck_id or deck_id.startswith(".") or deck_id.startswith("_"):
            continue
        files = [
            item.name
            for item in sorted(entry.iterdir(), key=lambda p: p.name.casefold())
            if item.is_file() and item.suffix.lower() in _ALLOWED_EXTENSIONS
        ]
        decks[deck_id] = files
    return decks


def list_decks(config: Optional[Dict] = None) -> List[Dict]:
    deck_root = _deck_root_path(config)
    decks = _scan_decks(deck_root)
    return [
        {"id": deck_id, "name": deck_id, "count": len(files)}
        for deck_id, files in sorted(decks.items(), key=lambda item: item[0].casefold())
    ]


def resolve_card_path(deck_id: str, filename: str, config: Optional[Dict] = None) -> Optional[Path]:
    if not isinstance(deck_id, str) or not deck_id:
        return None
    if not isinstance(filename, str) or not filename:
        return None
    if "/" in deck_id or "\\" in deck_id:
        return None
    if "/" in filename or "\\" in filename:
        return None
    if Path(filename).suffix.lower() not in _ALLOWED_EXTENSIONS:
        return None
    deck_root = _deck_root_path(config).resolve()
    deck_path = (deck_root / deck_id).resolve()
    try:
        deck_path.relative_to(deck_root)
    except ValueError:
        return None
    if not deck_path.is_dir():
        return None
    card_path = (deck_path / filename).resolve()
    try:
        card_path.relative_to(deck_path)
    except ValueError:
        return None
    if not card_path.is_file():
        return None
    return card_path


def _turn_order(players: List[Dict]) -> List[str]:
    return [p["player_id"] for p in sorted(players, key=lambda p: p.get("seat", 0))]


def _storyteller_id(state: Dict) -> Optional[str]:
    order = state.get("turn_order", [])
    if not order:
        return None
    idx = int(state.get("storyteller_index") or 0) % len(order)
    return order[idx]


def _split_card_id(card_id: str) -> Optional[Tuple[str, str]]:
    if not isinstance(card_id, str):
        return None
    parts = card_id.split("/", 1)
    if len(parts) != 2:
        return None
    deck, filename = parts
    if not deck or not filename:
        return None
    return deck, filename


def _card_ref(card_id: str) -> Dict:
    parsed = _split_card_id(card_id)
    if not parsed:
        return {"card_id": card_id, "image_url": ""}
    deck, filename = parsed
    return {
        "card_id": card_id,
        "image_url": f"/api/aidixit/card?deck={quote(deck, safe='')}&file={quote(filename, safe='')}",
    }


def _draw_card(state: Dict) -> Optional[str]:
    if not state["deck"]:
        if state["config"].get("reshuffle_discard") and state["discard"]:
            state["deck"] = list(state["discard"])
            state["discard"] = []
            random.shuffle(state["deck"])
        else:
            return None
    if not state["deck"]:
        return None
    return state["deck"].pop()


def _refill_hands(state: Dict) -> None:
    hand_size = int(state["config"]["hand_size"])
    for pid in state["turn_order"]:
        hand = state["players"][pid]["hand"]
        while len(hand) < hand_size:
            card = _draw_card(state)
            if card is None:
                break
            hand.append(card)


def _vote_counts(votes: Dict[str, str]) -> Dict[str, int]:
    counts: Dict[str, int] = {}
    for card_id in votes.values():
        counts[card_id] = counts.get(card_id, 0) + 1
    return counts


def _build_votes_by_card(state: Dict) -> Dict[str, List[Dict]]:
    meta = state.get("player_meta", {})
    votes_by_card: Dict[str, List[Dict]] = {}
    for voter_id, card_id in state.get("votes", {}).items():
        voter = state["players"].get(voter_id)
        voter_meta = meta.get(voter_id, {})
        entry = {
            "player_id": voter_id,
            "name": voter_meta.get("name"),
            "color": voter.get("color") if voter else None,
        }
        votes_by_card.setdefault(card_id, []).append(entry)
    for card_votes in votes_by_card.values():
        card_votes.sort(key=lambda item: meta.get(item["player_id"], {}).get("seat", 0))
    return votes_by_card


def _score_round(state: Dict) -> Dict:
    storyteller_id = _storyteller_id(state)
    story_card = state.get("story_card")
    votes = state.get("votes", {})
    submissions = state.get("submissions", {})
    order = state.get("turn_order", [])

    total_guessers = max(0, len(order) - 1)
    correct_voters = [pid for pid, card_id in votes.items() if card_id == story_card]
    correct_votes = len(correct_voters)

    vote_counts = _vote_counts(votes)
    scores_delta = {pid: 0 for pid in order}
    case = "partial"

    if correct_votes == total_guessers:
        case = "all"
        for pid in order:
            if pid != storyteller_id:
                scores_delta[pid] += 2
    elif correct_votes == 0:
        case = "none"
        for pid in order:
            if pid != storyteller_id:
                scores_delta[pid] += 2
        for voter_card in votes.values():
            owner = next((pid for pid, card_id in submissions.items() if card_id == voter_card), None)
            if owner and owner != storyteller_id:
                scores_delta[owner] += 1
    else:
        case = "partial"
        if storyteller_id:
            scores_delta[storyteller_id] += 3
        for pid in correct_voters:
            scores_delta[pid] += 3
        for voter_card in votes.values():
            owner = next((pid for pid, card_id in submissions.items() if card_id == voter_card), None)
            if owner and owner != storyteller_id:
                scores_delta[owner] += 1

    for pid, delta in scores_delta.items():
        state["players"][pid]["score"] += delta

    return {
        "case": case,
        "storyteller_id": storyteller_id,
        "story_card": story_card,
        "clue": state.get("clue"),
        "correct_voters": correct_voters,
        "vote_counts": vote_counts,
        "scores_delta": scores_delta,
    }


def _end_round(state: Dict) -> None:
    last_result = _score_round(state)
    last_result["pool_cards"] = list(state.get("pool_cards", []))
    last_result["votes_by_card"] = _build_votes_by_card(state)
    state["last_result"] = last_result
    state["discard"].extend(state.get("pool_cards", []))
    state["pool_cards"] = []
    state["votes"] = {}
    state["submissions"] = {}
    state["story_card"] = None
    state["clue"] = None
    _refill_hands(state)

    if state["turn_order"]:
        state["storyteller_index"] = (state["storyteller_index"] + 1) % len(state["turn_order"])
    state["round"] += 1
    state["phase"] = "story"

    target = int(state["config"]["target_score"])
    max_score = max(pdata["score"] for pdata in state["players"].values())
    if max_score >= target:
        winners = [pid for pid, pdata in state["players"].items() if pdata["score"] == max_score]
        state["winner"] = winners
        state["game_over"] = True
        state["phase"] = "game_over"


class AiDixitGame:
    game_id = "aidixit"
    min_players = 3
    max_players = 8

    @staticmethod
    def init_game(config: Optional[Dict], players: List[Dict]) -> Dict:
        cfg = _merge_config(config)
        deck_root = _deck_root_path(cfg)
        decks = _scan_decks(deck_root)
        if not decks:
            raise ValueError(f"no decks found in {deck_root}")
        selected = list(cfg.get("selected_decks") or [])
        if not selected:
            selected = sorted(decks.keys(), key=lambda name: name.casefold())
        missing = [deck_id for deck_id in selected if deck_id not in decks]
        if missing:
            raise ValueError(f"unknown deck(s): {', '.join(missing)}")

        cards: List[str] = []
        for deck_id in selected:
            for filename in decks.get(deck_id, []):
                cards.append(f"{deck_id}/{filename}")

        hand_size = int(cfg["hand_size"])
        if len(cards) < len(players) * hand_size:
            raise ValueError("not enough cards in selected decks")

        random.shuffle(cards)

        turn_order = _turn_order(players)
        player_meta = {p["player_id"]: p for p in players}
        colors = cfg.get("player_colors") or list(DEFAULT_CONFIG["player_colors"])
        players_state: Dict[str, Dict] = {}
        for idx, pid in enumerate(turn_order):
            hand = [cards.pop() for _ in range(hand_size)]
            color = colors[idx % len(colors)] if colors else "#9ca3af"
            players_state[pid] = {"score": 0, "hand": hand, "color": color}

        return {
            "players": players_state,
            "player_meta": player_meta,
            "turn_order": turn_order,
            "storyteller_index": 0,
            "round": 1,
            "phase": "story",
            "clue": None,
            "story_card": None,
            "submissions": {},
            "pool_cards": [],
            "votes": {},
            "deck": cards,
            "discard": [],
            "last_result": None,
            "config": cfg,
            "game_over": False,
            "winner": [],
        }

    @staticmethod
    def apply_action(state: Dict, player_id: str, action: Dict) -> Tuple[List[Dict], Optional[str]]:
        if state.get("game_over"):
            return [], "game over"
        if player_id not in state.get("players", {}):
            return [], "unknown player"

        action_type = action.get("type")
        phase = state.get("phase")
        storyteller_id = _storyteller_id(state)
        events: List[Dict] = []

        if phase == "story":
            if action_type != "submit_story":
                return [], "invalid action"
            if player_id != storyteller_id:
                return [], "not storyteller"
            card_id = action.get("card_id")
            clue = action.get("clue")
            if not isinstance(card_id, str) or card_id not in state["players"][player_id]["hand"]:
                return [], "card not in hand"
            if not isinstance(clue, str) or not clue.strip():
                return [], "clue required"
            state["players"][player_id]["hand"].remove(card_id)
            state["story_card"] = card_id
            state["clue"] = clue.strip()
            state["submissions"] = {player_id: card_id}
            state["phase"] = "submit"
            return events, None

        if phase == "submit":
            if action_type != "submit_card":
                return [], "invalid action"
            if player_id == storyteller_id:
                return [], "storyteller waits"
            if player_id in state["submissions"]:
                return [], "already submitted"
            card_id = action.get("card_id")
            if not isinstance(card_id, str) or card_id not in state["players"][player_id]["hand"]:
                return [], "card not in hand"
            state["players"][player_id]["hand"].remove(card_id)
            state["submissions"][player_id] = card_id
            if len(state["submissions"]) >= len(state["turn_order"]):
                pool = list(state["submissions"].values())
                random.shuffle(pool)
                state["pool_cards"] = pool
                state["votes"] = {}
                state["phase"] = "vote"
            return events, None

        if phase == "vote":
            if action_type != "submit_vote":
                return [], "invalid action"
            if player_id == storyteller_id:
                return [], "storyteller waits"
            if player_id in state["votes"]:
                return [], "already voted"
            card_id = action.get("card_id")
            if card_id not in state.get("pool_cards", []):
                return [], "invalid vote"
            if state["submissions"].get(player_id) == card_id:
                return [], "cannot vote for your card"
            state["votes"][player_id] = card_id
            if len(state["votes"]) >= max(0, len(state["turn_order"]) - 1):
                _end_round(state)
            return events, None

        return [], "invalid phase"

    @staticmethod
    def get_public_view(state: Dict, viewer_id: str) -> Dict:
        meta = state.get("player_meta", {})
        player_ids = sorted(meta.keys(), key=lambda pid: meta[pid].get("seat", 0))
        players_view = []
        for pid in player_ids:
            pdata = state["players"][pid]
            info = meta[pid]
            players_view.append(
                {
                    "player_id": pid,
                    "name": info.get("name"),
                    "seat": info.get("seat"),
                    "is_bot": info.get("is_bot"),
                    "score": pdata["score"],
                    "color": pdata.get("color"),
                }
            )

        storyteller_id = _storyteller_id(state)
        storyteller_name = meta.get(storyteller_id, {}).get("name") if storyteller_id else None

        hand_cards = [
            _card_ref(card_id)
            for card_id in state["players"].get(viewer_id, {}).get("hand", [])
        ]

        pool_cards: List[Dict] = []
        if state.get("phase") == "vote":
            pool_cards = [_card_ref(card_id) for card_id in state.get("pool_cards", [])]
            votes_by_card = _build_votes_by_card(state)
        else:
            votes_by_card = {}

        return {
            "game_id": AiDixitGame.game_id,
            "you": viewer_id,
            "phase": state.get("phase"),
            "round": state.get("round"),
            "storyteller_id": storyteller_id,
            "storyteller_name": storyteller_name,
            "clue": state.get("clue"),
            "players": players_view,
            "hand": hand_cards,
            "submitted": viewer_id in state.get("submissions", {}),
            "voted": viewer_id in state.get("votes", {}),
            "your_submission": state.get("submissions", {}).get(viewer_id),
            "vote_card_id": state.get("votes", {}).get(viewer_id),
            "pool_cards": pool_cards,
            "votes_by_card": votes_by_card,
            "target_score": state.get("config", {}).get("target_score"),
            "deck_count": len(state.get("deck", [])),
            "discard_count": len(state.get("discard", [])),
            "last_result": state.get("last_result"),
            "game_over": state.get("game_over", False),
            "winner": list(state.get("winner", [])),
            "hand_size": state.get("config", {}).get("hand_size"),
        }

    @staticmethod
    def bot_move(state: Dict, bot_id: str) -> Optional[Dict]:
        if state.get("game_over"):
            return None
        if bot_id not in state.get("players", {}):
            return None

        phase = state.get("phase")
        storyteller_id = _storyteller_id(state)
        hand = state["players"][bot_id]["hand"]

        if phase == "story":
            if bot_id != storyteller_id:
                return None
            if bot_id in state.get("submissions", {}):
                return None
            if not hand:
                return None
            return {"type": "submit_story", "card_id": random.choice(hand), "clue": "mystery"}

        if phase == "submit":
            if bot_id == storyteller_id:
                return None
            if bot_id in state.get("submissions", {}):
                return None
            if not hand:
                return None
            return {"type": "submit_card", "card_id": random.choice(hand)}

        if phase == "vote":
            if bot_id == storyteller_id:
                return None
            if bot_id in state.get("votes", {}):
                return None
            pool = list(state.get("pool_cards", []))
            own_card = state.get("submissions", {}).get(bot_id)
            if own_card in pool:
                pool = [card for card in pool if card != own_card]
            if not pool:
                return None
            return {"type": "submit_vote", "card_id": random.choice(pool)}

        return None

    @staticmethod
    def serialize(state: Dict) -> Dict:
        return state

    @staticmethod
    def deserialize(payload: Dict) -> Dict:
        return payload
