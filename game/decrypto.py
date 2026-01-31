import json
import random
from itertools import permutations
from pathlib import Path
from typing import Dict, List, Optional, Tuple

from game.decrypto_ai import (
    DEFAULT_BOT_CLUE_DIRECTNESS,
    DEFAULT_BOT_STRATEGY_ID,
    get_model_mode,
    is_all_zero_similarity,
    normalize_clue_directness,
    normalize_bot_strategy_id,
    pick_decrypt_guess,
    pick_encryptor_clues,
    pick_intercept_guess,
)

TEAM_IDS = ("white", "black")
TEAM_LABELS = {"white": "White", "black": "Black"}

DEFAULT_CONFIG = {
    "max_rounds": 8,
    "word_packs": ["basic"],
    "bot_strategy": DEFAULT_BOT_STRATEGY_ID,
    "bot_clue_directness": DEFAULT_BOT_CLUE_DIRECTNESS,
}

_PACK_INDEX_CACHE: Optional[List[Dict]] = None


def _pack_index_path() -> Path:
    return Path(__file__).resolve().parent / "assets" / "decrypto_word_packs.json"


def _normalize_text(value: Optional[str]) -> str:
    if not isinstance(value, str):
        return ""
    return " ".join(value.strip().casefold().split())


def _load_pack_index() -> List[Dict]:
    global _PACK_INDEX_CACHE
    if _PACK_INDEX_CACHE is not None:
        return list(_PACK_INDEX_CACHE)

    path = _pack_index_path()
    if not path.exists():
        raise ValueError("decrypto word pack config not found")
    with path.open("r", encoding="utf-8") as handle:
        data = json.load(handle)

    if not isinstance(data, list):
        raise ValueError("decrypto word pack config must be a list")

    packs: List[Dict] = []
    base_dir = path.parent
    for entry in data:
        if not isinstance(entry, dict):
            continue
        pack_id = entry.get("pack_id")
        if not isinstance(pack_id, str) or not pack_id.strip():
            continue
        pack_id = pack_id.strip()
        pack_name = entry.get("pack_name")
        if not isinstance(pack_name, str) or not pack_name.strip():
            pack_name = pack_id
        language = entry.get("language")
        if not isinstance(language, str) or not language.strip():
            language = None
        total_count = entry.get("total_count")
        try:
            total_count = int(total_count)
        except (TypeError, ValueError):
            total_count = None
        raw_path = entry.get("path")
        if not isinstance(raw_path, str) or not raw_path.strip():
            continue
        resolved = Path(raw_path)
        if not resolved.is_absolute():
            resolved = base_dir / resolved
        packs.append(
            {
                "pack_id": pack_id,
                "pack_name": pack_name,
                "language": language,
                "total_count": total_count,
                "path": str(resolved),
            }
        )

    if not packs:
        raise ValueError("no decrypto word packs configured")

    _PACK_INDEX_CACHE = packs
    return list(_PACK_INDEX_CACHE)


def get_decrypto_word_packs() -> List[Dict]:
    packs = _load_pack_index()
    public: List[Dict] = []
    for pack in packs:
        public.append(
            {
                "pack_id": pack["pack_id"],
                "pack_name": pack.get("pack_name") or pack["pack_id"],
                "language": pack.get("language"),
                "total_count": pack.get("total_count"),
            }
        )
    return public


def _load_pack_words(pack: Dict) -> List[str]:
    path = Path(pack["path"])
    if not path.exists():
        raise ValueError(f"word pack file missing: {path}")
    with path.open("r", encoding="utf-8") as handle:
        data = json.load(handle)
    if isinstance(data, dict):
        words = data.get("words", [])
    else:
        words = data
    if not isinstance(words, list):
        raise ValueError(f"invalid word pack data: {path}")
    result: List[str] = []
    for word in words:
        if not isinstance(word, str):
            continue
        cleaned = " ".join(word.strip().split())
        if cleaned:
            result.append(cleaned)
    if not result:
        raise ValueError(f"empty word pack: {path}")
    return result


def _normalize_pack_ids(value: Optional[object]) -> List[str]:
    if not isinstance(value, list):
        return list(DEFAULT_CONFIG["word_packs"])
    pack_ids: List[str] = []
    for item in value:
        if not isinstance(item, str):
            continue
        cleaned = item.strip()
        if cleaned and cleaned not in pack_ids:
            pack_ids.append(cleaned)
    return pack_ids or list(DEFAULT_CONFIG["word_packs"])


def _merge_config(config: Optional[Dict]) -> Dict:
    cfg = {**DEFAULT_CONFIG}
    if config:
        cfg["word_packs"] = _normalize_pack_ids(config.get("word_packs"))
        cfg["bot_strategy"] = normalize_bot_strategy_id(config.get("bot_strategy"))
        cfg["bot_clue_directness"] = normalize_clue_directness(
            config.get("bot_clue_directness")
        )
        max_rounds = config.get("max_rounds")
        try:
            max_rounds = int(max_rounds)
            if max_rounds > 0:
                cfg["max_rounds"] = max_rounds
        except (TypeError, ValueError):
            pass
    return cfg


def _build_word_pool(pack_ids: List[str]) -> List[str]:
    packs = _load_pack_index()
    pack_map = {pack["pack_id"]: pack for pack in packs}
    words: List[str] = []
    for pack_id in pack_ids:
        pack = pack_map.get(pack_id)
        if not pack:
            raise ValueError(f"unknown word pack: {pack_id}")
        words.extend(_load_pack_words(pack))
    deduped: List[str] = []
    seen: set = set()
    for word in words:
        key = _normalize_text(word)
        if not key or key in seen:
            continue
        seen.add(key)
        deduped.append(word)
    return deduped


def _assign_keywords(word_pool: List[str]) -> Tuple[List[str], List[str]]:
    if len(word_pool) < 8:
        raise ValueError("not enough words for decrypto")
    shuffled = list(word_pool)
    random.shuffle(shuffled)
    return shuffled[:4], shuffled[4:8]


def _make_code_deck() -> List[List[int]]:
    deck = [list(code) for code in permutations([1, 2, 3, 4], 3)]
    random.shuffle(deck)
    return deck


def _draw_code(state: Dict, team_id: str) -> List[int]:
    bag = state["code_bags"][team_id]
    if not bag:
        bag.extend(_make_code_deck())
    return list(bag.pop())


def _opponent(team_id: str) -> str:
    return "black" if team_id == "white" else "white"


def _current_encryptor(state: Dict, team_id: str) -> Optional[str]:
    team = state["teams"].get(team_id)
    if not team:
        return None
    players = team["player_ids"]
    if not players:
        return None
    idx = team.get("encryptor_index", 0) % len(players)
    return players[idx]


def _rotate_encryptors(state: Dict) -> None:
    for team_id in TEAM_IDS:
        team = state["teams"][team_id]
        if team["player_ids"]:
            team["encryptor_index"] = (team.get("encryptor_index", 0) + 1) % len(
                team["player_ids"]
            )


def _start_round(state: Dict, increment_round: bool) -> None:
    if increment_round:
        state["round"] += 1
    state["phase"] = "encryption"
    state["round_data"] = {}
    for team_id in TEAM_IDS:
        state["round_data"][team_id] = {
            "code": _draw_code(state, team_id),
            "clues": None,
            "clues_by": None,
            "decrypt_guess": None,
            "decrypt_by": None,
            "intercept_guess": None,
            "intercept_by": None,
        }


def _normalize_guess(value: object) -> Optional[List[int]]:
    if not isinstance(value, list) or len(value) != 3:
        return None
    numbers: List[int] = []
    for item in value:
        if isinstance(item, bool):
            return None
        try:
            num = int(item)
        except (TypeError, ValueError):
            return None
        if num < 1 or num > 4:
            return None
        numbers.append(num)
    if len(set(numbers)) != 3:
        return None
    return numbers


def _validate_clues(clues: object) -> Optional[List[str]]:
    if not isinstance(clues, list) or len(clues) != 3:
        return None
    cleaned: List[str] = []
    for clue in clues:
        if not isinstance(clue, str):
            return None
        cleaned_clue = " ".join(clue.strip().split())
        if not cleaned_clue:
            return None
        cleaned.append(cleaned_clue)
    return cleaned


def _round_ready_to_resolve(state: Dict) -> bool:
    if state["phase"] != "guessing":
        return False
    for team_id in TEAM_IDS:
        data = state["round_data"][team_id]
        if data["decrypt_guess"] is None:
            return False
        if state["round"] > 1 and data["intercept_guess"] is None:
            return False
    return True


def _history_by_keyword(history: List[Dict]) -> Dict[str, List[str]]:
    mapping = {"1": [], "2": [], "3": [], "4": []}
    for entry in history:
        code = entry.get("code") or []
        clues = entry.get("clues") or []
        if not isinstance(code, list) or not isinstance(clues, list):
            continue
        for idx, number in enumerate(code):
            if idx >= len(clues):
                continue
            key = str(number)
            if key in mapping:
                mapping[key].append(clues[idx])
    return mapping


def _apply_round_results(state: Dict) -> None:
    summary = {"round": state["round"], "teams": {}}
    model_mode = get_model_mode()
    mode_label = "离线词向量" if model_mode == "embeddings" else "fallback"
    for team_id in TEAM_IDS:
        data = state["round_data"][team_id]
        code = list(data["code"]) if data.get("code") else None
        clues = list(data["clues"]) if data.get("clues") else None
        decrypt_guess = list(data["decrypt_guess"]) if data.get("decrypt_guess") else None
        intercept_guess = list(data["intercept_guess"]) if data.get("intercept_guess") else None
        decrypt_correct = decrypt_guess == code if decrypt_guess and code else False
        intercept_correct = None
        if state["round"] > 1:
            intercept_correct = intercept_guess == code if intercept_guess and code else False
        summary["teams"][team_id] = {
            "code": code,
            "clues": clues,
            "decrypt_guess": decrypt_guess,
            "intercept_guess": intercept_guess,
            "decrypt_correct": decrypt_correct,
            "intercept_correct": intercept_correct,
            "decrypt_by": data.get("decrypt_by"),
            "intercept_by": data.get("intercept_by"),
        }

        if code and clues:
            keywords = list(state["teams"][team_id]["keywords"])
            decrypt_by = data.get("decrypt_by")
            if decrypt_by and not decrypt_correct:
                meta = state.get("player_meta", {}).get(decrypt_by, {})
                if meta.get("is_bot"):
                    all_zero_note = ""
                    if is_all_zero_similarity(clues, keywords):
                        all_zero_note = " 提示=相似度全0"
                    print(
                        f"[decrypto bot] 猜错了 (模式={mode_label}) "
                        f"类型=解密 目标队伍={team_id} 机器人={decrypt_by} "
                        f"关键词={keywords} 线索={clues} 密码={code} 猜测={decrypt_guess}{all_zero_note}",
                        flush=True,
                    )

            intercept_by = data.get("intercept_by")
            if state["round"] > 1 and intercept_by and intercept_correct is False:
                meta = state.get("player_meta", {}).get(intercept_by, {})
                if meta.get("is_bot"):
                    print(
                        f"[decrypto bot] 猜错了 (模式={mode_label}) "
                        f"类型=拦截 目标队伍={team_id} 机器人={intercept_by} "
                        f"关键词={keywords} 线索={clues} 密码={code} 猜测={intercept_guess}",
                        flush=True,
                    )

        state["teams"][team_id]["history"].append(
            {
                "round": state["round"],
                "code": code,
                "clues": clues,
                "decrypt_guess": decrypt_guess,
                "intercept_guess": intercept_guess,
                "decrypt_correct": decrypt_correct,
                "intercept_correct": intercept_correct,
            }
        )

    for team_id in TEAM_IDS:
        team_summary = summary["teams"][team_id]
        if state["round"] > 1 and team_summary["intercept_correct"]:
            opponent = _opponent(team_id)
            state["teams"][opponent]["intercepts"] += 1
        if not team_summary["decrypt_correct"]:
            state["teams"][team_id]["miscommunications"] += 1

    state["last_round_summary"] = summary


def _set_winner(state: Dict, winner: str) -> None:
    state["winner"] = winner
    state["game_over"] = True
    state["phase"] = "game_over"


def _check_end_conditions(state: Dict) -> None:
    white = state["teams"]["white"]
    black = state["teams"]["black"]
    white_intercepts = int(white["intercepts"])
    black_intercepts = int(black["intercepts"])
    white_mis = int(white["miscommunications"])
    black_mis = int(black["miscommunications"])

    both_intercepts = white_intercepts >= 2 and black_intercepts >= 2
    both_mis = white_mis >= 2 and black_mis >= 2
    if both_intercepts or both_mis:
        _set_winner(state, "draw")
        return

    if white_intercepts >= 2:
        _set_winner(state, "white")
        return
    if black_intercepts >= 2:
        _set_winner(state, "black")
        return

    if white_mis >= 2:
        _set_winner(state, "black")
        return
    if black_mis >= 2:
        _set_winner(state, "white")
        return

    if state["round"] >= int(state["config"]["max_rounds"]):
        _set_winner(state, "draw")


def _resolve_round(state: Dict) -> None:
    _apply_round_results(state)
    _check_end_conditions(state)
    if state.get("game_over"):
        return
    _rotate_encryptors(state)
    _start_round(state, increment_round=True)


class DecryptoGame:
    game_id = "decrypto"
    min_players = 4
    max_players = 8

    @staticmethod
    def init_game(config: Optional[Dict], players: List[Dict]) -> Dict:
        cfg = _merge_config(config)
        ordered_players = sorted(players, key=lambda p: p.get("seat", 0))
        player_ids = [p["player_id"] for p in ordered_players]
        if len(player_ids) % 2 != 0:
            raise ValueError("decrypto requires an even number of players")
        mid = len(player_ids) // 2
        if mid < 2:
            raise ValueError("decrypto requires at least 2 players per team")

        teams = {
            "white": {
                "player_ids": player_ids[:mid],
                "keywords": [],
                "intercepts": 0,
                "miscommunications": 0,
                "history": [],
                "used_clues": [],
                "encryptor_index": 0,
            },
            "black": {
                "player_ids": player_ids[mid:],
                "keywords": [],
                "intercepts": 0,
                "miscommunications": 0,
                "history": [],
                "used_clues": [],
                "encryptor_index": 0,
            },
        }

        word_pool = _build_word_pool(cfg["word_packs"])
        white_keywords, black_keywords = _assign_keywords(word_pool)
        teams["white"]["keywords"] = white_keywords
        teams["black"]["keywords"] = black_keywords

        player_meta = {p["player_id"]: p for p in ordered_players}
        player_teams = {pid: "white" for pid in teams["white"]["player_ids"]}
        for pid in teams["black"]["player_ids"]:
            player_teams[pid] = "black"

        state = {
            "round": 1,
            "phase": "encryption",
            "teams": teams,
            "round_data": {},
            "code_bags": {"white": _make_code_deck(), "black": _make_code_deck()},
            "player_meta": player_meta,
            "player_teams": player_teams,
            "config": cfg,
            "last_round_summary": None,
            "winner": None,
            "game_over": False,
        }
        _start_round(state, increment_round=False)
        return state

    @staticmethod
    def get_legal_actions(state: Dict, player_id: str) -> List[str]:
        if state.get("game_over"):
            return []
        team_id = state.get("player_teams", {}).get(player_id)
        if not team_id:
            return []

        phase = state.get("phase")
        actions: List[str] = []
        if phase == "encryption":
            encryptor = _current_encryptor(state, team_id)
            team_data = state["round_data"][team_id]
            if player_id == encryptor:
                if not team_data.get("clues"):
                    actions.append("submit_clues")
            return actions

        if phase == "guessing":
            encryptor = _current_encryptor(state, team_id)
            if player_id != encryptor and state["round_data"][team_id].get("decrypt_guess") is None:
                actions.append("submit_decrypt")
            if state["round"] > 1:
                opponent = _opponent(team_id)
                if state["round_data"][opponent].get("intercept_guess") is None:
                    actions.append("submit_intercept")
            return actions

        return []

    @staticmethod
    def apply_action(state: Dict, player_id: str, action: Dict) -> Tuple[List[Dict], Optional[str]]:
        if state.get("game_over"):
            return [], "game over"
        team_id = state.get("player_teams", {}).get(player_id)
        if not team_id:
            return [], "unknown player"

        action_type = action.get("type")
        events: List[Dict] = []
        phase = state.get("phase")

        if phase == "encryption":
            if action_type == "submit_clues":
                if player_id != _current_encryptor(state, team_id):
                    return [], "only encryptor can submit clues"
                if state["round_data"][team_id].get("clues"):
                    return [], "clues already submitted"
                clues = _validate_clues(action.get("clues"))
                if clues is None:
                    return [], "invalid clues"
                normalized = [_normalize_text(clue) for clue in clues]
                state["teams"][team_id]["used_clues"].extend(normalized)
                state["round_data"][team_id]["clues"] = clues
                state["round_data"][team_id]["clues_by"] = player_id
                events.append({"type": "decrypto:clues_submitted", "payload": {"team": team_id}})

                if all(state["round_data"][tid].get("clues") for tid in TEAM_IDS):
                    state["phase"] = "guessing"
                return events, None
            return [], "invalid action"

        if phase == "guessing":
            if action_type == "submit_decrypt":
                if player_id == _current_encryptor(state, team_id):
                    return [], "encryptor cannot submit decrypt"
                if state["round_data"][team_id].get("decrypt_guess") is not None:
                    return [], "decrypt already submitted"
                guess = _normalize_guess(action.get("guess"))
                if guess is None:
                    return [], "invalid guess"
                state["round_data"][team_id]["decrypt_guess"] = guess
                state["round_data"][team_id]["decrypt_by"] = player_id
                events.append({"type": "decrypto:decrypt_submitted", "payload": {"team": team_id}})
            elif action_type == "submit_intercept":
                if state["round"] <= 1:
                    return [], "intercept not available in round 1"
                opponent = _opponent(team_id)
                if state["round_data"][opponent].get("intercept_guess") is not None:
                    return [], "intercept already submitted"
                guess = _normalize_guess(action.get("guess"))
                if guess is None:
                    return [], "invalid guess"
                state["round_data"][opponent]["intercept_guess"] = guess
                state["round_data"][opponent]["intercept_by"] = player_id
                events.append(
                    {"type": "decrypto:intercept_submitted", "payload": {"team": team_id}}
                )
            else:
                return [], "invalid action"

            if _round_ready_to_resolve(state):
                resolved_round = state["round"]
                _resolve_round(state)
                events.append(
                    {"type": "decrypto:round_resolved", "payload": {"round": resolved_round}}
                )
            return events, None

        return [], "invalid phase"

    @staticmethod
    def get_public_view(state: Dict, viewer_id: str) -> Dict:
        viewer_team = state.get("player_teams", {}).get(viewer_id)
        encryptor_ids = {team_id: _current_encryptor(state, team_id) for team_id in TEAM_IDS}
        players_view = []
        for pid, meta in state.get("player_meta", {}).items():
            team_id = state.get("player_teams", {}).get(pid)
            players_view.append(
                {
                    "player_id": pid,
                    "name": meta.get("name"),
                    "seat": meta.get("seat"),
                    "is_bot": meta.get("is_bot"),
                    "team_id": team_id,
                    "is_encryptor": pid == encryptor_ids.get(team_id),
                }
            )
        players_view.sort(key=lambda p: p.get("seat", 0))

        teams_view: Dict[str, Dict] = {}
        for team_id in TEAM_IDS:
            team = state["teams"][team_id]
            keywords = None
            if state.get("game_over") or viewer_team == team_id:
                keywords = list(team["keywords"])
            data = state["round_data"].get(team_id, {})
            show_clues = state.get("phase") != "encryption"
            clues_public = list(data["clues"]) if data.get("clues") and show_clues else None
            decrypt_guess = None
            intercept_guess = None
            if viewer_team == team_id:
                decrypt_guess = data.get("decrypt_guess")
            opponent = _opponent(team_id)
            if viewer_team == opponent:
                intercept_guess = data.get("intercept_guess")
            if state.get("game_over") and data.get("intercept_guess"):
                intercept_guess = data.get("intercept_guess")
            teams_view[team_id] = {
                "team_id": team_id,
                "label": TEAM_LABELS[team_id],
                "players": [
                    p
                    for p in players_view
                    if p.get("team_id") == team_id
                ],
                "encryptor_id": encryptor_ids.get(team_id),
                "keywords": keywords,
                "intercepts": team["intercepts"],
                "miscommunications": team["miscommunications"],
                "history": list(team["history"]),
                "history_by_keyword": _history_by_keyword(team["history"]),
                "clues_submitted": bool(data.get("clues")),
                "decrypt_submitted": data.get("decrypt_guess") is not None,
                "intercept_submitted": data.get("intercept_guess") is not None,
                "current_clues": clues_public,
                "decrypt_guess": decrypt_guess,
                "intercept_guess": intercept_guess,
            }

        current_code = None
        if viewer_team and viewer_id == encryptor_ids.get(viewer_team):
            data = state["round_data"].get(viewer_team, {})
            current_code = list(data["code"]) if data.get("code") else None

        return {
            "game_id": DecryptoGame.game_id,
            "you": viewer_id,
            "phase": state["phase"],
            "round": state["round"],
            "max_rounds": state["config"]["max_rounds"],
            "team_id": viewer_team,
            "is_encryptor": viewer_team and viewer_id == encryptor_ids.get(viewer_team),
            "current_code": current_code,
            "teams": teams_view,
            "players": players_view,
            "last_round_summary": state.get("last_round_summary"),
            "winner": state.get("winner"),
            "game_over": state.get("game_over", False),
            "legal_actions": DecryptoGame.get_legal_actions(state, viewer_id),
        }

    @staticmethod
    def bot_move(state: Dict, bot_id: str) -> Optional[Dict]:
        team_id = state.get("player_teams", {}).get(bot_id)
        if not team_id or state.get("game_over"):
            return None
        strategy_id = None
        clue_directness = None
        config = state.get("config")
        if isinstance(config, dict):
            strategy_id = config.get("bot_strategy")
            clue_directness = config.get("bot_clue_directness")

        phase = state.get("phase")
        data = state["round_data"].get(team_id, {})
        if phase == "encryption" and bot_id == _current_encryptor(state, team_id):
            if not data.get("clues"):
                clues = pick_encryptor_clues(
                    state["teams"][team_id]["keywords"],
                    data.get("code") or [],
                    state["teams"][team_id]["used_clues"],
                    state["teams"][team_id]["history"],
                    strategy_id,
                    clue_directness,
                )
                if clues:
                    return {"type": "submit_clues", "clues": clues}
            return None

        if phase == "guessing":
            if bot_id != _current_encryptor(state, team_id) and data.get("decrypt_guess") is None:
                clues = data.get("clues") or []
                guess = pick_decrypt_guess(
                    clues,
                    state["teams"][team_id]["keywords"],
                    state["teams"][team_id]["history"],
                    strategy_id,
                )
                if guess:
                    return {"type": "submit_decrypt", "guess": guess}
            if state["round"] > 1:
                opponent = _opponent(team_id)
                if state["round_data"][opponent].get("intercept_guess") is None:
                    opponent_clues = state["round_data"][opponent].get("clues") or []
                    guess = pick_intercept_guess(
                        opponent_clues,
                        state["teams"][opponent]["history"],
                        strategy_id,
                    )
                    if guess:
                        return {"type": "submit_intercept", "guess": guess}
            return None

        return None

    @staticmethod
    def serialize(state: Dict) -> Dict:
        return state

    @staticmethod
    def deserialize(payload: Dict) -> Dict:
        return payload
