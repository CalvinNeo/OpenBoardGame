import copy
import secrets
import unicodedata
from typing import Dict, List, Optional, Tuple

from jsonschema import Draft7Validator


MAX_WORD_LENGTH = 24
USED_WORD_MESSAGE = "That word was already used in an earlier round. Pick a new one."
BOT_WORDS = ("月亮", "星星", "海", "山", "雨", "风", "火", "树",
             "鸟", "鱼", "云", "花", "雪", "光", "路", "门")
TEAM_MODE = "team"
FREE_FOR_ALL_MODE = "free_for_all"
MODES = (TEAM_MODE, FREE_FOR_ALL_MODE)
CONFIG_SCHEMA = {
    "type": "object",
    "properties": {"mode": {"enum": list(MODES)}},
    "additionalProperties": False,
}
ACTION_SCHEMA = {
    "type": "object",
    "properties": {
        "type": {"enum": ["submit_word", "next_round"]},
        "game_token": {"type": "string"},
        "window_id": {"type": "integer", "minimum": 0},
        "word": {"type": "string", "minLength": 1, "maxLength": 96},
    },
    "required": ["type", "game_token", "window_id"],
    "additionalProperties": False,
}
_ACTION_VALIDATOR = Draft7Validator(ACTION_SCHEMA)
_CONFIG_VALIDATOR = Draft7Validator(CONFIG_SCHEMA)


def normalize_word(value: str) -> str:
    if not isinstance(value, str) or len(value) > 96:
        raise ValueError("Enter a word of up to 24 characters.")
    if any(unicodedata.category(character).startswith("C") for character in value):
        raise ValueError("Control and invisible formatting characters are not allowed.")
    word = " ".join(unicodedata.normalize("NFKC", value).split())
    if not word or len(word) > MAX_WORD_LENGTH or not any(character.isalnum() for character in word):
        raise ValueError("Enter a word of up to 24 characters containing letters or numbers.")
    return word


def _build_teams(ids: List[str], mode: str) -> List[Dict]:
    """Team mode pairs adjacent seats; free-for-all gives every player a solo slot."""
    if mode == TEAM_MODE:
        return [{"team_id": f"team-{index // 2 + 1}", "player_ids": ids[index:index + 2],
                 "matched_round": None, "history": []} for index in range(0, len(ids), 2)]
    return [{"team_id": f"team-{index + 1}", "player_ids": [player_id],
             "matched_round": None, "history": []} for index, player_id in enumerate(ids)]


def _revealed_words(state: Dict) -> List[Tuple[int, int, int, str]]:
    """Every revealed word as (round, team index, slot, word), oldest reveal first."""
    return sorted((entry["round"], index, slot, word)
                  for index, team in enumerate(state["teams"])
                  for entry in team["history"]
                  for slot, word in enumerate(entry["words"]))


def _used_words(state: Dict) -> set:
    """Case folded words revealed in earlier rounds; nobody may write them again."""
    return {word.casefold() for _, _, _, word in _revealed_words(state)}


def _used_word_list(state: Dict) -> List[str]:
    """Revealed words in reveal order, de-duplicated, for the player facing list."""
    seen: set = set()
    ordered: List[str] = []
    for _, _, _, word in _revealed_words(state):
        if word.casefold() not in seen:
            seen.add(word.casefold())
            ordered.append(word)
    return ordered


def _team_for(state: Dict, player_id: str) -> Optional[Dict]:
    return next((team for team in state["teams"] if player_id in team["player_ids"]), None)


def _active_players(state: Dict) -> List[str]:
    if state["mode"] == FREE_FOR_ALL_MODE:
        return [team["player_ids"][0] for team in state["teams"]]
    return [player_id for team in state["teams"] if team["matched_round"] is None
            for player_id in team["player_ids"]]


def _is_complete(state: Dict) -> bool:
    matched = [team["matched_round"] is not None for team in state["teams"]]
    return any(matched) if state["mode"] == FREE_FOR_ALL_MODE else all(matched)


def _standings(state: Dict) -> List[Dict]:
    seats = {player_id: index for index, player_id in enumerate(state["turn_order"])}
    teams = sorted(state["teams"], key=lambda team: (
        team["matched_round"] is None, team["matched_round"] or 0, seats[team["player_ids"][0]]))
    return [{
        "team_id": team["team_id"],
        "player_ids": team["player_ids"][:],
        "rounds": team["matched_round"],
        "rank": None if team["matched_round"] is None else 1 + sum(
            other["matched_round"] is not None and other["matched_round"] < team["matched_round"]
            for other in teams),
    } for team in teams]


def _finish_reveal(state: Dict) -> None:
    state["pending"] = {}
    state["window_id"] += 1
    state["game_over"] = _is_complete(state)
    state["phase"] = "game_over" if state["game_over"] else "reveal"
    if state["game_over"]:
        winners = [row for row in _standings(state) if row["rank"] == 1]
        state["winning_team_ids"] = [row["team_id"] for row in winners]
        state["winner"] = [player_id for row in winners for player_id in row["player_ids"]]


def _reveal(state: Dict) -> None:
    if state["mode"] == FREE_FOR_ALL_MODE:
        counts: Dict[str, int] = {}
        for team in state["teams"]:
            folded = state["pending"][team["player_ids"][0]].casefold()
            counts[folded] = counts.get(folded, 0) + 1
        for team in state["teams"]:
            word = state["pending"][team["player_ids"][0]]
            matched = counts[word.casefold()] > 1
            team["history"].append({"round": state["round"], "words": [word], "matched": matched})
            if matched:
                team["matched_round"] = state["round"]
    else:
        for team in state["teams"]:
            if team["matched_round"] is not None:
                continue
            words = [state["pending"][player_id] for player_id in team["player_ids"]]
            matched = words[0].casefold() == words[1].casefold()
            team["history"].append({"round": state["round"], "words": words, "matched": matched})
            if matched:
                team["matched_round"] = state["round"]
    _finish_reveal(state)


def _free_for_all_rounds(state: Dict) -> Dict[int, Dict[str, str]]:
    """Map every revealed round to the word each player wrote, for save validation."""
    rounds: Dict[int, Dict[str, str]] = {}
    for team in state["teams"]:
        for entry in team["history"]:
            rounds.setdefault(entry["round"], {})[team["player_ids"][0]] = entry["words"][0]
    return rounds


def _fresh_bot_word(used: set) -> str:
    """First practice word nobody has revealed yet, so bots never repeat a used word."""
    for candidate in BOT_WORDS:
        if candidate.casefold() not in used:
            return candidate
    index = 1
    while f"词{index}".casefold() in used:
        index += 1
    return f"词{index}"


def _bot_word(view: Dict, bot_id: str) -> str:
    """Round one differs by seat, later rounds take the first still unused practice word."""
    used = {word.casefold() for word in view["used_words"]}
    if view["mode"] == TEAM_MODE:
        team = next(team for team in view["teams"] if team["team_id"] == view["your_team_id"])
        if team["history"]:
            return _fresh_bot_word(used)
        return BOT_WORDS[team["player_ids"].index(bot_id) % 2]
    if view["round"] > 1:
        return _fresh_bot_word(used)
    seat = next(index for index, member in enumerate(view["players"]) if member["player_id"] == bot_id)
    return BOT_WORDS[seat % 2]


class WordSyncGame:
    game_id = "word_sync"
    min_players = 2
    max_players = 10
    supported_player_counts = tuple(range(2, 11))
    player_counts_by_mode = {TEAM_MODE: (2, 4, 6, 8, 10), FREE_FOR_ALL_MODE: tuple(range(2, 11))}

    @staticmethod
    def init_game(config: Dict, players: List[Dict]) -> Dict:
        if not isinstance(config, dict) or not _CONFIG_VALIDATOR.is_valid(config):
            raise ValueError("Word Sync only accepts a team or free_for_all mode.")
        mode = config.get("mode", TEAM_MODE)
        if not isinstance(players, list) or len(players) not in WordSyncGame.player_counts_by_mode[mode]:
            raise ValueError("Word Sync team mode requires 2, 4, 6, 8, or 10 players."
                             if mode == TEAM_MODE else "Word Sync free-for-all requires 2 to 10 players.")
        metadata = []
        for index, player in enumerate(players):
            if not isinstance(player, dict) or not isinstance(player.get("player_id"), str) or not player["player_id"]:
                raise ValueError("Player IDs must be nonempty strings.")
            seat = player.get("seat", index)
            if type(seat) is not int or seat < 0:
                raise ValueError("Seats must be nonnegative integers.")
            metadata.append({"player_id": player["player_id"], "seat": seat,
                             "name": str(player.get("name") or player["player_id"]),
                             "is_bot": bool(player.get("is_bot"))})
        metadata.sort(key=lambda player: player["seat"])
        ids = [player["player_id"] for player in metadata]
        if len(set(ids)) != len(ids) or len({player["seat"] for player in metadata}) != len(ids):
            raise ValueError("Player IDs and seats must be unique.")
        return {
            "game_id": WordSyncGame.game_id, "version": 2, "config": {"mode": mode}, "mode": mode,
            "game_token": secrets.token_hex(16), "window_id": 0, "revision": 0,
            "turn_order": ids, "players": {player["player_id"]: player for player in metadata},
            "teams": _build_teams(ids, mode),
            "round": 1, "phase": "guess", "pending": {}, "next_ready": [],
            "current_turn": None, "game_over": False, "winner": [], "winning_team_ids": [],
        }

    @staticmethod
    def get_legal_actions(state: Dict, player_id: str) -> List[str]:
        if state["game_over"] or player_id not in state["players"]:
            return []
        if state["phase"] == "reveal":
            return [] if player_id in state["next_ready"] else ["next_round"]
        if state["phase"] == "guess" and player_id in _active_players(state) and player_id not in state["pending"]:
            return ["submit_word"]
        return []

    @staticmethod
    def apply_action(state: Dict, player_id: str, action: Dict) -> Tuple[List[Dict], Optional[str]]:
        if not isinstance(action, dict) or not _ACTION_VALIDATOR.is_valid(action):
            return [], "Invalid action schema."
        if type(action["window_id"]) is not int:
            return [], "Invalid action window."
        if action["game_token"] != state["game_token"] or action["window_id"] != state["window_id"]:
            return [], "This action belongs to an old game or round."
        kind = action["type"]
        expected = {"type", "game_token", "window_id"} | ({"word"} if kind == "submit_word" else set())
        if set(action) != expected:
            return [], "Unexpected or missing action fields."
        if kind not in WordSyncGame.get_legal_actions(state, player_id):
            return [], "Action unavailable, or already submitted."
        if kind == "submit_word":
            try:
                word = normalize_word(action["word"])
            except ValueError as error:
                return [], str(error)
            # Words revealed in earlier rounds are burned for everybody; same round copies still match.
            if word.casefold() in _used_words(state):
                return [], USED_WORD_MESSAGE
            state["pending"][player_id] = word
            if all(player in state["pending"] for player in _active_players(state)):
                _reveal(state)
        else:
            state["next_ready"].append(player_id)
            if len(state["next_ready"]) == len(state["players"]):
                state["round"] += 1
                state["window_id"] += 1
                state["phase"] = "guess"
                state["next_ready"] = []
        state["revision"] += 1
        return [{"type": "word_sync:action", "payload": {"player_id": player_id, "type": kind}}], None

    @staticmethod
    def get_public_view(state: Dict, viewer_id: str) -> Dict:
        keys = ("game_id", "game_token", "window_id", "revision", "round", "phase", "mode", "teams",
                "next_ready", "game_over", "winner", "winning_team_ids")
        team = _team_for(state, viewer_id)
        view = {key: state[key] for key in keys}
        view.update(
            you=viewer_id, your_team_id=team["team_id"] if team else None,
            your_word=state["pending"].get(viewer_id), max_word_length=MAX_WORD_LENGTH,
            used_words=_used_word_list(state),
            legal_actions=WordSyncGame.get_legal_actions(state, viewer_id),
            standings=_standings(state),
            players=[{**state["players"][player_id], "submitted": player_id in state["pending"]}
                     for player_id in state["turn_order"]],
        )
        return copy.deepcopy(view)

    @staticmethod
    def bot_move(state: Dict, bot_id: str) -> Optional[Dict]:
        view = WordSyncGame.get_public_view(state, bot_id)
        if not view["legal_actions"]:
            return None
        kind = view["legal_actions"][0]
        action = {"type": kind, "game_token": view["game_token"], "window_id": view["window_id"]}
        if kind == "submit_word":
            action["word"] = _bot_word(view, bot_id)
        return action

    @staticmethod
    def serialize(state: Dict) -> Dict:
        return copy.deepcopy(state)

    @staticmethod
    def deserialize(payload: Dict) -> Dict:
        try:
            state = copy.deepcopy(payload)
            if (not isinstance(state, dict) or state["game_id"] != WordSyncGame.game_id
                    or type(state["version"]) is not int or state["version"] not in (1, 2)):
                raise ValueError("Invalid Word Sync save.")
            players = [state["players"][player_id] for player_id in state["turn_order"]]
            baseline = WordSyncGame.init_game(state["config"], players)
            free_for_all = baseline["mode"] == FREE_FOR_ALL_MODE
            if state.get("mode", baseline["mode"]) != baseline["mode"]:
                raise ValueError("Invalid saved mode.")
            state["mode"] = baseline["mode"]
            if state["turn_order"] != baseline["turn_order"] or state["players"] != baseline["players"]:
                raise ValueError("Invalid saved players.")
            if not isinstance(state["game_token"], str) or len(state["game_token"]) != 32:
                raise ValueError("Invalid saved game token.")
            if any(type(state[key]) is not int or state[key] < minimum for key, minimum in
                   (("round", 1), ("window_id", 0), ("revision", 0))):
                raise ValueError("Invalid saved round.")
            if state["phase"] not in ("guess", "reveal", "game_over") or state["current_turn"] is not None:
                raise ValueError("Invalid saved phase.")
            if len(state["teams"]) != len(baseline["teams"]):
                raise ValueError("Invalid saved teams.")
            revealed = state["round"] - int(state["phase"] == "guess")
            revealed_rows = _revealed_words(state)
            revealed_words = {word.casefold() for _, _, _, word in revealed_rows}
            for team, expected in zip(state["teams"], baseline["teams"]):
                if team["team_id"] != expected["team_id"] or team["player_ids"] != expected["player_ids"]:
                    raise ValueError("Invalid saved pairing.")
                finish = team["matched_round"]
                if finish is not None and (type(finish) is not int or not 1 <= finish <= state["round"]):
                    raise ValueError("Invalid completion round.")
                if len(team["history"]) != (finish if finish is not None else revealed) or (finish or 0) > revealed:
                    raise ValueError("Invalid saved history length.")
                for number, entry in enumerate(team["history"], 1):
                    words = entry["words"]
                    if (not isinstance(words, list) or len(words) != len(expected["player_ids"])
                            or any(normalize_word(word) != word for word in words)):
                        raise ValueError("Invalid saved words.")
                    if type(entry["round"]) is not int or entry["round"] != number:
                        raise ValueError("Invalid saved reveal.")
                    if free_for_all:
                        continue
                    matched = words[0].casefold() == words[1].casefold()
                    if entry["matched"] is not matched or matched != (number == finish):
                        raise ValueError("Invalid saved reveal.")
            if free_for_all:
                for number, words in _free_for_all_rounds(state).items():
                    counts: Dict[str, int] = {}
                    for word in words.values():
                        counts[word.casefold()] = counts.get(word.casefold(), 0) + 1
                    if len(words) != len(state["teams"]) or number > revealed:
                        raise ValueError("Invalid saved reveal.")
                    for team in state["teams"]:
                        finish = team["matched_round"]
                        matched = counts[words[team["player_ids"][0]].casefold()] > 1
                        if team["history"][number - 1]["matched"] is not matched:
                            raise ValueError("Invalid saved reveal.")
                        # A match ends the game, so a winner finishes exactly on the round they matched.
                        if not (finish == number if matched else finish is None or finish > number):
                            raise ValueError("Invalid saved completion.")
            # Version 2 burns a word once its round is revealed, so a word may only appear in one round.
            if state["version"] >= 2:
                first_round: Dict[str, int] = {}
                for number, _, _, word in revealed_rows:
                    if first_round.setdefault(word.casefold(), number) != number:
                        raise ValueError("Invalid saved words.")
            complete = _is_complete(state)
            if state["game_over"] is not complete or complete != (state["phase"] == "game_over"):
                raise ValueError("Invalid saved game result.")
            if state["window_id"] != 2 * (state["round"] - 1) + int(state["phase"] != "guess"):
                raise ValueError("Invalid saved action window.")
            pending = state["pending"]
            if not isinstance(pending, dict) or not set(pending).issubset(_active_players(state)):
                raise ValueError("Invalid saved submissions.")
            if any(normalize_word(word) != word for word in pending.values()):
                raise ValueError("Invalid saved submission text.")
            if state["version"] >= 2 and any(word.casefold() in revealed_words for word in pending.values()):
                raise ValueError("Invalid saved submission text.")
            if (state["phase"] != "guess" and pending) or (state["phase"] == "guess" and len(pending) == len(_active_players(state))):
                raise ValueError("Invalid saved submission phase.")
            ready = state["next_ready"]
            if not isinstance(ready, list) or len(set(ready)) != len(ready) or not set(ready).issubset(state["players"]):
                raise ValueError("Invalid saved confirmations.")
            if (state["phase"] != "reveal" and ready) or len(ready) >= len(players):
                raise ValueError("Invalid saved confirmation phase.")
            revision = sum(len(entry["words"]) for team in state["teams"] for entry in team["history"])
            revision += len(pending) + len(players) * (state["round"] - 1) + len(ready)
            if state["revision"] != revision:
                raise ValueError("Invalid saved revision.")
            winners = [row for row in _standings(state) if complete and row["rank"] == 1]
            if state["winning_team_ids"] != [row["team_id"] for row in winners] or state["winner"] != [
                    player_id for row in winners for player_id in row["player_ids"]]:
                raise ValueError("Invalid saved winners.")
        except (KeyError, TypeError, IndexError, AttributeError) as error:
            raise ValueError("Invalid Word Sync save.") from error
        return state
