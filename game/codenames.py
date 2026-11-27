import copy
import json
import secrets
import unicodedata
from functools import lru_cache
from pathlib import Path
from typing import Dict, List, Optional, Tuple

from jsonschema import Draft7Validator


CONFIG_SCHEMA = {"type": "object", "properties": {}, "additionalProperties": False}
ACTION_SCHEMA = {
    "type": "object",
    "properties": {
        "type": {"enum": ["choose_role", "language", "begin", "clue", "guess", "end_turn", "next_round", "confirm_result"]},
        "game_token": {"type": "string"}, "revision": {"type": "integer", "minimum": 0},
        "team": {"enum": ["red", "blue"]}, "role": {"enum": ["spymaster", "operative"]},
        "language": {"enum": ["zh", "en"]}, "word": {"type": "string", "maxLength": 32},
        "number": {"anyOf": [{"type": "integer", "minimum": 0, "maximum": 9}, {"const": "unlimited"}]},
        "index": {"type": "integer", "minimum": 0, "maximum": 24},
    },
    "required": ["type", "game_token", "revision"], "additionalProperties": False,
}
_VALIDATOR = Draft7Validator(ACTION_SCHEMA)
TEAMS = ("red", "blue")


@lru_cache(maxsize=1)
def _vocabulary() -> List[Dict]:
    return json.loads((Path(__file__).parent / "assets" / "codenames" / "words.json").read_text(encoding="utf-8"))


def _opponent(team: str) -> str:
    return "blue" if team == "red" else "red"


def _remaining(state: Dict, team: str) -> int:
    return sum(card["identity"] == team and not card["revealed"] for card in state["board"])


def _record(state: Dict, kind: str, **fields) -> None:
    state["history"].append({"turn": state["turn"], "team": state["active_team"], "type": kind, **fields})


def _valid_teams(state: Dict) -> bool:
    return all(sum(member["team"] == team for member in state["players"].values()) >= 2
               and sum(member["team"] == team and member["role"] == "spymaster"
                       for member in state["players"].values()) == 1 for team in TEAMS)


def _clue_error(state: Dict, value: str) -> Optional[str]:
    normalized = unicodedata.normalize("NFKC", value).strip()
    if not normalized or len(normalized) > 32 or not all(character.isalpha() for character in normalized):
        return "Give one word using letters or Chinese characters, without spaces or punctuation."
    folded = normalized.casefold()
    for card in state["board"]:
        word = card["word"].casefold()
        if not card["revealed"] and (folded in word or word in folded):
            return "A clue cannot contain, or be part of, an unrevealed board word."
    return None


def _finish(state: Dict, winner: str, reason: str) -> None:
    state.update(phase="result", winning_team=winner, end_reason=reason, confirmations=[])
    state["winner"] = [player_id for player_id, member in state["players"].items() if member["team"] == winner]


class CodenamesGame:
    game_id = "codenames"
    min_players = 4
    max_players = 8

    @staticmethod
    def init_game(config: Optional[Dict], players: List[Dict]) -> Dict:
        if not Draft7Validator(CONFIG_SCHEMA).is_valid({} if config is None else config):
            raise ValueError("Invalid Codenames configuration.")
        if not 4 <= len(players) <= 8 or len({member["player_id"] for member in players}) != len(players):
            raise ValueError("Codenames requires 4–8 distinct players.")
        ordered = sorted(players, key=lambda member: member.get("seat", 0))
        return {
            "version": 1, "game_id": "codenames", "config": {}, "game_token": secrets.token_hex(16), "revision": 0,
            "players": {member["player_id"]: {"name": member.get("name", "Player"),
                        "team": TEAMS[index % 2], "role": "spymaster" if index < 2 else "operative",
                        "is_bot": bool(member.get("is_bot", False))} for index, member in enumerate(ordered)},
            "host": ordered[0]["player_id"], "phase": "setup", "language": "zh", "board": [],
            "starting_team": None, "active_team": None, "turn": 0, "clue": None,
            "guesses": 0, "guess_limit": None, "confirmations": [], "history": [],
            "winning_team": None, "winner": [], "end_reason": None, "game_over": False,
        }

    @staticmethod
    def get_legal_actions(state: Dict, player_id: str) -> List[str]:
        member = state["players"].get(player_id)
        if not member or state["game_over"]:
            return []
        phase = state["phase"]
        if phase == "setup":
            return ["choose_role"] + (["language", "begin"] if player_id == state["host"] else [])
        if phase in ("turn_end", "result"):
            return [] if player_id in state["confirmations"] else ["next_round" if phase == "turn_end" else "confirm_result"]
        if member["team"] != state["active_team"]:
            return []
        if phase == "clue" and member["role"] == "spymaster":
            return ["clue"]
        if phase == "guess" and member["role"] == "operative":
            return ["guess"] + (["end_turn"] if state["guesses"] else [])
        return []

    @staticmethod
    def apply_action(state: Dict, player_id: str, action: Dict) -> Tuple[List[Dict], Optional[str]]:
        if not isinstance(action, dict) or not _VALIDATOR.is_valid(action):
            return [], "Invalid action schema."
        if any(type(action[key]) is not int for key in ("revision", "index") if key in action):
            return [], "Action numbers must be integers."
        if "number" in action and action["number"] != "unlimited" and type(action["number"]) is not int:
            return [], "Clue count must be an integer."
        if action["game_token"] != state["game_token"] or action["revision"] != state["revision"]:
            return [], "The game changed. Please use the latest board."
        kind = action["type"]
        if kind not in CodenamesGame.get_legal_actions(state, player_id):
            return [], "That action is not available to you."
        fields = {"choose_role": {"team", "role"}, "language": {"language"}, "clue": {"word", "number"}, "guess": {"index"}}.get(kind, set())
        if set(action) != {"type", "game_token", "revision"} | fields:
            return [], "Unexpected or missing action fields."
        if kind == "choose_role":
            if action["role"] == "spymaster" and any(member["team"] == action["team"] and member["role"] == "spymaster"
                                                       for member_id, member in state["players"].items() if member_id != player_id):
                return [], "That team already has a spymaster."
            state["players"][player_id].update(team=action["team"], role=action["role"])
        elif kind == "language":
            state["language"] = action["language"]
        elif kind == "begin":
            if not _valid_teams(state):
                return [], "Each team needs one spymaster and at least one operative."
            randomizer = secrets.SystemRandom()
            first = randomizer.choice(TEAMS)
            identities = [first] * 9 + [_opponent(first)] * 8 + ["neutral"] * 7 + ["assassin"]
            randomizer.shuffle(identities)
            words = randomizer.sample(_vocabulary(), 25)
            state.update(board=[{"word": word[state["language"]], "identity": identity, "revealed": False}
                                for word, identity in zip(words, identities)], starting_team=first,
                         active_team=first, phase="clue", turn=1)
        elif kind == "clue":
            error = _clue_error(state, action["word"])
            if error:
                return [], error
            number = action["number"]
            state.update(clue={"word": unicodedata.normalize("NFKC", action["word"]).strip(), "number": number},
                         guesses=0, guess_limit=None if number in (0, "unlimited") else number + 1, phase="guess")
            _record(state, "clue", **state["clue"])
        elif kind == "guess":
            card = state["board"][action["index"]]
            if card["revealed"]:
                return [], "That card has already been revealed."
            card["revealed"] = True
            state["guesses"] += 1
            _record(state, "guess", word=card["word"], identity=card["identity"], player_id=player_id)
            if card["identity"] == "assassin":
                _finish(state, _opponent(state["active_team"]), "assassin")
            elif any(_remaining(state, team) == 0 for team in TEAMS):
                _finish(state, next(team for team in TEAMS if _remaining(state, team) == 0), "all_agents")
            elif card["identity"] != state["active_team"] or (state["guess_limit"] is not None and state["guesses"] >= state["guess_limit"]):
                state.update(phase="turn_end", confirmations=[])
        elif kind == "end_turn":
            _record(state, "end_turn")
            state.update(phase="turn_end", confirmations=[])
        elif kind in ("next_round", "confirm_result"):
            state["confirmations"].append(player_id)
            if len(state["confirmations"]) == len(state["players"]):
                if kind == "confirm_result":
                    state.update(phase="game_over", game_over=True)
                else:
                    state.update(phase="clue", turn=state["turn"] + 1, active_team=_opponent(state["active_team"]),
                                 clue=None, guesses=0, guess_limit=None, confirmations=[])
        state["revision"] += 1
        return [{"type": "codenames:action", "payload": {"player_id": player_id, "type": kind}}], None

    @staticmethod
    def get_public_view(state: Dict, viewer_id: str) -> Dict:
        view = copy.deepcopy({key: value for key, value in state.items() if key not in ("version", "players", "board")})
        member = state["players"].get(viewer_id)
        can_see = state["phase"] in ("result", "game_over") or (member is not None and member["role"] == "spymaster")
        view.update(you=viewer_id, players=[{"player_id": player_id, **copy.deepcopy(player)} for player_id, player in state["players"].items()],
                    board=[{"word": card["word"], "revealed": card["revealed"],
                            "identity": card["identity"] if card["revealed"] or can_see else None} for card in state["board"]],
                    remaining={team: _remaining(state, team) for team in TEAMS},
                    teams_valid=_valid_teams(state), legal_actions=CodenamesGame.get_legal_actions(state, viewer_id))
        return view

    @staticmethod
    def bot_move(state: Dict, bot_id: str) -> Optional[Dict]:
        view = CodenamesGame.get_public_view(state, bot_id)
        legal = view["legal_actions"]
        if not legal:
            return None
        base = {"game_token": view["game_token"], "revision": view["revision"]}
        for kind in ("next_round", "confirm_result"):
            if kind in legal:
                return {**base, "type": kind}
        if view["phase"] == "setup":
            return {**base, "type": "begin"} if "begin" in legal and view["teams_valid"] else None
        words = {entry[view["language"]]: entry["tags"][view["language"]] for entry in _vocabulary()}
        if "clue" in legal:
            choices = []
            for tag in {tag for card in view["board"] if not card["revealed"] for tag in words[card["word"]]}:
                if _clue_error({"board": view["board"]}, tag):
                    continue
                matching = [card for card in view["board"] if not card["revealed"] and tag in words[card["word"]]]
                own = sum(card["identity"] == view["active_team"] for card in matching)
                risk = sum(20 if card["identity"] == "assassin" else 5 for card in matching if card["identity"] != view["active_team"])
                if own:
                    choices.append((own - risk, own, tag))
            if choices:
                _, count, tag = max(choices)
                return {**base, "type": "clue", "word": tag, "number": min(9, count)}
            fallback = "联想" if view["language"] == "zh" else "Association"
            return {**base, "type": "clue", "word": fallback, "number": 1}
        if "guess" in legal:
            candidates = [index for index, card in enumerate(view["board"]) if not card["revealed"]
                          and view["clue"]["word"] in words[card["word"]]]
            if not candidates and "end_turn" in legal:
                return {**base, "type": "end_turn"}
            if not candidates:
                candidates = [index for index, card in enumerate(view["board"]) if not card["revealed"]]
            return {**base, "type": "guess", "index": secrets.choice(candidates)}
        return None

    @staticmethod
    def serialize(state: Dict) -> Dict:
        return copy.deepcopy(state)

    @staticmethod
    def deserialize(payload: Dict) -> Dict:
        state = copy.deepcopy(payload)
        try:
            if not isinstance(state, dict) or state["version"] != 1 or state["game_id"] != "codenames":
                raise ValueError("Invalid Codenames save.")
            players = state["players"]
            if not isinstance(players, dict) or not 4 <= len(players) <= 8 or state["host"] not in players:
                raise ValueError("Invalid saved players.")
            if any(not isinstance(player_id, str) or not isinstance(member["name"], str)
                   or member["team"] not in TEAMS or member["role"] not in ("spymaster", "operative")
                   or type(member["is_bot"]) is not bool for player_id, member in players.items()):
                raise ValueError("Invalid saved roles.")
            if state["language"] not in ("zh", "en") or state["phase"] not in ("setup", "clue", "guess", "turn_end", "result", "game_over"):
                raise ValueError("Invalid saved phase.")
            if state["config"] != {}:
                raise ValueError("Invalid saved configuration.")
            if not isinstance(state["game_token"], str) or not state["game_token"] or any(type(state[key]) is not int or state[key] < 0 for key in ("revision", "turn", "guesses")):
                raise ValueError("Invalid saved action version.")
            confirmations = state["confirmations"]
            if not isinstance(confirmations, list) or len(set(confirmations)) != len(confirmations) or not set(confirmations).issubset(players):
                raise ValueError("Invalid saved confirmations.")
            if not isinstance(state["history"], list) or type(state["game_over"]) is not bool or state["game_over"] != (state["phase"] == "game_over"):
                raise ValueError("Invalid saved result.")
            for entry in state["history"]:
                if not isinstance(entry, dict) or entry["type"] not in ("clue", "guess", "end_turn") or entry["team"] not in TEAMS or type(entry["turn"]) is not int or not 1 <= entry["turn"] <= state["turn"]:
                    raise ValueError("Invalid saved history.")
                fields = {"clue": {"word", "number"}, "guess": {"word", "identity", "player_id"}, "end_turn": set()}[entry["type"]]
                if set(entry) != {"turn", "team", "type"} | fields:
                    raise ValueError("Invalid saved history fields.")
                if entry["type"] == "clue" and (not isinstance(entry["word"], str) or not entry["word"].isalpha() or len(entry["word"]) > 32 or not (entry["number"] == "unlimited" or type(entry["number"]) is int and 0 <= entry["number"] <= 9)):
                    raise ValueError("Invalid saved clue history.")
                if entry["type"] == "guess" and (not isinstance(entry["word"], str) or entry["identity"] not in (*TEAMS, "neutral", "assassin") or entry["player_id"] not in players):
                    raise ValueError("Invalid saved guess history.")
            if state["phase"] == "setup":
                if state["board"] or state["turn"] or state["history"] or confirmations or state["clue"] is not None or state["winner"]:
                    raise ValueError("Invalid saved setup.")
            else:
                if not _valid_teams(state) or state["starting_team"] not in TEAMS or state["active_team"] not in TEAMS or state["turn"] < 1:
                    raise ValueError("Invalid saved teams.")
                board = state["board"]
                pool = {entry[state["language"]] for entry in _vocabulary()}
                if not isinstance(board, list) or len(board) != 25 or len({card["word"] for card in board}) != 25:
                    raise ValueError("Invalid saved board.")
                if any(card["word"] not in pool or card["identity"] not in (*TEAMS, "neutral", "assassin") or type(card["revealed"]) is not bool for card in board):
                    raise ValueError("Invalid saved card.")
                counts = {identity: sum(card["identity"] == identity for card in board) for identity in (*TEAMS, "neutral", "assassin")}
                if counts != {state["starting_team"]: 9, _opponent(state["starting_team"]): 8, "neutral": 7, "assassin": 1}:
                    raise ValueError("Invalid saved key.")
                clue = state["clue"]
                if state["phase"] == "clue":
                    if clue is not None or state["guesses"] or state["guess_limit"] is not None or confirmations:
                        raise ValueError("Invalid saved clue phase.")
                else:
                    if not isinstance(clue, dict) or set(clue) != {"word", "number"} or not isinstance(clue["word"], str) or not 1 <= len(clue["word"]) <= 32 or not clue["word"].isalpha():
                        raise ValueError("Invalid saved clue.")
                    number = clue["number"]
                    if not (number == "unlimited" or type(number) is int and 0 <= number <= 9):
                        raise ValueError("Invalid saved clue count.")
                    limit = None if number in (0, "unlimited") else number + 1
                    if state["guess_limit"] != limit or (limit is not None and state["guesses"] > limit):
                        raise ValueError("Invalid saved guess limit.")
                if state["phase"] == "guess" and (confirmations or state["guess_limit"] is not None and state["guesses"] >= state["guess_limit"]):
                    raise ValueError("Invalid saved guessing phase.")
                finished = state["phase"] in ("result", "game_over")
                if finished:
                    winning = state["winning_team"]
                    if winning not in TEAMS or state["end_reason"] not in ("assassin", "all_agents") or state["winner"] != [player_id for player_id, member in players.items() if member["team"] == winning]:
                        raise ValueError("Invalid saved winner.")
                    assassin = next(card for card in board if card["identity"] == "assassin")
                    if state["end_reason"] == "assassin" and (not assassin["revealed"] or winning != _opponent(state["active_team"])):
                        raise ValueError("Invalid assassin result.")
                    if state["end_reason"] == "all_agents" and _remaining(state, winning) != 0:
                        raise ValueError("Invalid agent result.")
                elif state["winner"] or state["winning_team"] is not None or state["end_reason"] is not None or any(_remaining(state, team) == 0 for team in TEAMS) or any(card["identity"] == "assassin" and card["revealed"] for card in board):
                    raise ValueError("Invalid unfinished result.")
            if (state["phase"] == "game_over") != (len(confirmations) == len(players)):
                raise ValueError("Invalid confirmation phase.")
        except (KeyError, TypeError, AttributeError, IndexError) as error:
            raise ValueError("Invalid Codenames save.") from error
        return state
