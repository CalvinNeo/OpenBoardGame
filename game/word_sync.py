import copy
import secrets
import unicodedata
from typing import Dict, List, Optional, Tuple

from jsonschema import Draft7Validator


MAX_WORD_LENGTH = 24
CONFIG_SCHEMA = {"type": "object", "properties": {}, "additionalProperties": False}
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


def _team_for(state: Dict, player_id: str) -> Optional[Dict]:
    return next((team for team in state["teams"] if player_id in team["player_ids"]), None)


def _active_players(state: Dict) -> List[str]:
    return [player_id for team in state["teams"] if team["matched_round"] is None
            for player_id in team["player_ids"]]


def _standings(state: Dict) -> List[Dict]:
    teams = sorted(state["teams"], key=lambda team: (
        team["matched_round"] is None, team["matched_round"] or 0, team["team_id"]))
    return [{
        "team_id": team["team_id"],
        "player_ids": team["player_ids"][:],
        "rounds": team["matched_round"],
        "rank": None if team["matched_round"] is None else 1 + sum(
            other["matched_round"] is not None and other["matched_round"] < team["matched_round"]
            for other in teams),
    } for team in teams]


def _reveal(state: Dict) -> None:
    for team in state["teams"]:
        if team["matched_round"] is not None:
            continue
        words = [state["pending"][player_id] for player_id in team["player_ids"]]
        matched = words[0].casefold() == words[1].casefold()
        team["history"].append({"round": state["round"], "words": words, "matched": matched})
        if matched:
            team["matched_round"] = state["round"]
    state["pending"] = {}
    state["window_id"] += 1
    state["game_over"] = all(team["matched_round"] is not None for team in state["teams"])
    state["phase"] = "game_over" if state["game_over"] else "reveal"
    if state["game_over"]:
        winners = [row for row in _standings(state) if row["rank"] == 1]
        state["winning_team_ids"] = [row["team_id"] for row in winners]
        state["winner"] = [player_id for row in winners for player_id in row["player_ids"]]


class WordSyncGame:
    game_id = "word_sync"
    min_players = 2
    max_players = 8
    supported_player_counts = (2, 4, 6, 8)

    @staticmethod
    def init_game(config: Dict, players: List[Dict]) -> Dict:
        if not isinstance(config, dict) or not _CONFIG_VALIDATOR.is_valid(config):
            raise ValueError("Word Sync does not accept game options.")
        if not isinstance(players, list) or len(players) not in WordSyncGame.supported_player_counts:
            raise ValueError("Word Sync requires 2, 4, 6, or 8 players.")
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
            "game_id": WordSyncGame.game_id, "version": 1, "config": {},
            "game_token": secrets.token_hex(16), "window_id": 0, "revision": 0,
            "turn_order": ids, "players": {player["player_id"]: player for player in metadata},
            "teams": [{"team_id": f"team-{index // 2 + 1}", "player_ids": ids[index:index + 2],
                       "matched_round": None, "history": []} for index in range(0, len(ids), 2)],
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
        keys = ("game_id", "game_token", "window_id", "revision", "round", "phase", "teams",
                "next_ready", "game_over", "winner", "winning_team_ids")
        team = _team_for(state, viewer_id)
        view = {key: state[key] for key in keys}
        view.update(
            you=viewer_id, your_team_id=team["team_id"] if team else None,
            your_word=state["pending"].get(viewer_id), max_word_length=MAX_WORD_LENGTH,
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
            team = next(team for team in view["teams"] if team["team_id"] == view["your_team_id"])
            if team["history"]:
                word = min(team["history"][-1]["words"], key=lambda value: (value.casefold(), value))
            else:
                word = ("月亮", "星星")[team["player_ids"].index(bot_id)]
            action["word"] = word
        return action

    @staticmethod
    def serialize(state: Dict) -> Dict:
        return copy.deepcopy(state)

    @staticmethod
    def deserialize(payload: Dict) -> Dict:
        try:
            state = copy.deepcopy(payload)
            if (not isinstance(state, dict) or state["game_id"] != WordSyncGame.game_id
                    or type(state["version"]) is not int or state["version"] != 1):
                raise ValueError("Invalid Word Sync save.")
            players = [state["players"][player_id] for player_id in state["turn_order"]]
            baseline = WordSyncGame.init_game(state["config"], players)
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
            for team, expected in zip(state["teams"], baseline["teams"]):
                if team["team_id"] != expected["team_id"] or team["player_ids"] != expected["player_ids"]:
                    raise ValueError("Invalid saved pairing.")
                finish = team["matched_round"]
                if finish is not None and (type(finish) is not int or not 1 <= finish <= state["round"]):
                    raise ValueError("Invalid completion round.")
                revealed = state["round"] - int(state["phase"] == "guess")
                if len(team["history"]) != (finish if finish is not None else revealed) or (finish or 0) > revealed:
                    raise ValueError("Invalid saved history length.")
                for number, entry in enumerate(team["history"], 1):
                    words = entry["words"]
                    if not isinstance(words, list) or len(words) != 2 or any(normalize_word(word) != word for word in words):
                        raise ValueError("Invalid saved words.")
                    matched = words[0].casefold() == words[1].casefold()
                    if type(entry["round"]) is not int or entry["round"] != number or entry["matched"] is not matched:
                        raise ValueError("Invalid saved reveal.")
                    if matched != (number == finish):
                        raise ValueError("Invalid saved completion.")
            complete = all(team["matched_round"] is not None for team in state["teams"])
            if state["game_over"] is not complete or complete != (state["phase"] == "game_over"):
                raise ValueError("Invalid saved game result.")
            if state["window_id"] != 2 * (state["round"] - 1) + int(state["phase"] != "guess"):
                raise ValueError("Invalid saved action window.")
            pending = state["pending"]
            if not isinstance(pending, dict) or not set(pending).issubset(_active_players(state)):
                raise ValueError("Invalid saved submissions.")
            if any(normalize_word(word) != word for word in pending.values()):
                raise ValueError("Invalid saved submission text.")
            if (state["phase"] != "guess" and pending) or (state["phase"] == "guess" and len(pending) == len(_active_players(state))):
                raise ValueError("Invalid saved submission phase.")
            ready = state["next_ready"]
            if not isinstance(ready, list) or len(set(ready)) != len(ready) or not set(ready).issubset(state["players"]):
                raise ValueError("Invalid saved confirmations.")
            if (state["phase"] != "reveal" and ready) or len(ready) >= len(players):
                raise ValueError("Invalid saved confirmation phase.")
            revision = sum(len(team["history"]) * 2 for team in state["teams"]) + len(pending)
            revision += len(players) * (state["round"] - 1) + len(ready)
            if state["revision"] != revision:
                raise ValueError("Invalid saved revision.")
            winners = [row for row in _standings(state) if complete and row["rank"] == 1]
            if state["winning_team_ids"] != [row["team_id"] for row in winners] or state["winner"] != [
                    player_id for row in winners for player_id in row["player_ids"]]:
                raise ValueError("Invalid saved winners.")
        except (KeyError, TypeError, IndexError, AttributeError) as error:
            raise ValueError("Invalid Word Sync save.") from error
        return state
