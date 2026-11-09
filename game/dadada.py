"""哒哒哒 / DADADA (The Op Games, 2024): a cooperative language-invention game.

The table invents a brand-new language out of five nonsense syllables, then proves
whether it actually works. Creation sorts thirteen picture cards into sound groups,
one picture per turn, and every placement has to survive a vote. Communication then
lays out six fresh pictures, the communicator secretly picks one and names it using
nothing but the invented syllables, and the rest of the table has to agree on which
picture was meant.

Rules source and confidence table: designs/task191.md.
"""
import copy
import random
from typing import Dict, List, Optional, Tuple

from game.dadada_data import (
    ACTION_SCHEMA,
    ACTION_VALIDATOR,
    CANDIDATES,
    CONFIG_SCHEMA,
    CONFIG_VALIDATOR,
    CREATION_IMAGES,
    IMAGE_IDS,
    MAX_PROPOSAL_ATTEMPTS,
    MAX_WORD_LENGTH,
    PICTURE_BY_ID,
    SAY_WHAT_LIMIT,
    SOUND_BY_ID,
    SOUND_IDS,
    SOUNDS_DEALT,
    SOUNDS_REVEALED,
)

STAGE_CREATE = "create"
STAGE_SPEAK = "speak"
STAGE_GUESS = "guess"
STAGE_REVEAL = "reveal"
STAGE_GAME_OVER = "game_over"

NEW_SOUND = "new"
MAX_LOG_ENTRIES = 60


# --- Small helpers -------------------------------------------------------

def _as_tuple(value):
    return tuple(_as_tuple(item) for item in value) if isinstance(value, (list, tuple)) else value


def _json_random_state(rng: random.Random) -> List:
    version, numbers, gaussian = rng.getstate()
    return [version, list(numbers), gaussian]


def _rng(state: Dict) -> random.Random:
    rng = random.Random()
    rng.setstate(_as_tuple(state["rng_state"]))
    return rng


def _shuffle(state: Dict, items: List) -> None:
    rng = _rng(state)
    rng.shuffle(items)
    state["rng_state"] = _json_random_state(rng)


def _log(state: Dict, message: str) -> None:
    state["log"].append(message)
    if len(state["log"]) > MAX_LOG_ENTRIES:
        del state["log"][: len(state["log"]) - MAX_LOG_ENTRIES]


def _name(state: Dict, player_id: str) -> str:
    return state["player_meta"].get(player_id, {}).get("name", player_id)


def _syllable(sound_id: str) -> str:
    return SOUND_BY_ID.get(sound_id, sound_id)


def _label(state: Dict, word: List[str]) -> str:
    return "-".join(_syllable(sound_id) for sound_id in word)


def _picture(image_id: str) -> Dict[str, str]:
    picture = PICTURE_BY_ID.get(image_id, {})
    return {"id": image_id, "emoji": picture.get("emoji", "❔"),
            "zh": picture.get("zh", image_id), "en": picture.get("en", image_id)}


def _current_player(state: Dict) -> Optional[str]:
    if state["stage"] not in (STAGE_CREATE, STAGE_SPEAK):
        return None
    return state["turn_order"][state["turn_index"]]


def _others(state: Dict, player_id: str) -> List[str]:
    return [pid for pid in state["turn_order"] if pid != player_id]


def _sound_entry(state: Dict, sound_id: str) -> Optional[Dict]:
    for entry in state["sounds"]:
        if entry["id"] == sound_id:
            return entry
    return None


def _revealed_sound_ids(state: Dict) -> List[str]:
    return [entry["id"] for entry in state["sounds"]]


def _unassigned(state: Dict) -> List[str]:
    """Creation pictures still waiting for a sound. Named or abandoned, they are done."""
    settled = set(state["placed"]) | set(state["unnamed"])
    return [image for image in state["table"] if image not in settled]


def _draw(state: Dict, count: int) -> List[str]:
    """Take pictures off the deck, recycling the discard when it runs dry."""
    drawn: List[str] = []
    for _ in range(count):
        if not state["image_deck"]:
            if not state["discard"]:
                break
            state["image_deck"] = state["discard"]
            state["discard"] = []
            _shuffle(state, state["image_deck"])
        drawn.append(state["image_deck"].pop())
    return drawn


# --- Phase transitions ---------------------------------------------------

def _advance_turn(state: Dict) -> None:
    state["turn_index"] = (state["turn_index"] + 1) % len(state["turn_order"])
    state["turn"] += 1


def _start_round(state: Dict) -> None:
    state["round"] += 1
    state["communicator"] = state["turn_order"][state["turn_index"]]
    state["players"][state["communicator"]]["speaks"] += 1
    state["candidates"] = _draw(state, CANDIDATES)
    state["target"] = None
    state["word"] = []
    state["guesses"] = {}
    state["result"] = None
    state["continue_ready"] = []
    state["stage"] = STAGE_SPEAK
    state["players"][state["communicator"]]["rounds"] = state["round"]


def _finish_creation(state: Dict) -> None:
    _log(state, f"造词完成，{len(state['sounds'])} 个音节构成了你们的语言。")
    state["pending"] = None
    _advance_turn(state)
    _start_round(state)


def _reset_for_rematch(state: Dict) -> None:
    state["stage"] = STAGE_CREATE
    state["turn"] = 1
    state["turn_index"] = 0
    state["round"] = 0
    state["communicator"] = None
    state["candidates"] = []
    state["target"] = None
    state["word"] = []
    state["guesses"] = {}
    state["result"] = None
    state["pending"] = None
    state["placed"] = {}
    state["unnamed"] = []
    state["defined"] = []
    state["say_what"] = []
    state["score"] = 0
    state["continue_ready"] = []
    state["rematch_ready"] = []
    state["game_over"] = False
    state["log"] = []
    for player in state["players"].values():
        player["speaks"] = 0
    _deal(state)


def _deal(state: Dict) -> None:
    sounds = list(SOUND_IDS)
    _shuffle(state, sounds)
    dealt = sounds[:SOUNDS_DEALT]
    state["sounds"] = [{"id": sound_id, "images": []} for sound_id in dealt[:SOUNDS_REVEALED]]
    state["reserve"] = dealt[SOUNDS_REVEALED:]

    deck = list(IMAGE_IDS)
    _shuffle(state, deck)
    state["image_deck"] = deck
    state["discard"] = []
    state["table"] = [state["image_deck"].pop() for _ in range(CREATION_IMAGES)]
    _log(state, f"翻开 {CREATION_IMAGES} 张图卡和 {SOUNDS_REVEALED} 个音节，造词开始。")


def _resolve_proposal(state: Dict) -> None:
    """Called once every other player has voted on the pending placement."""
    pending = state["pending"]
    voters = _others(state, state["turn_order"][state["turn_index"]])
    approvals = sum(1 for pid in voters if pending["votes"].get(pid))
    accepted = approvals * 2 > len(voters)

    if accepted:
        sound_id = pending["sound"]
        if sound_id == NEW_SOUND:
            sound_id = state["reserve"].pop(0)
            state["sounds"].append({"id": sound_id, "images": []})
        _sound_entry(state, sound_id)["images"].append(pending["image"])
        state["placed"][pending["image"]] = sound_id
        _log(state, f"{_name(state, state['turn_order'][state['turn_index']])} 把 "
                    f"{PICTURE_BY_ID[pending['image']]['zh']} 归到 {_syllable(sound_id)}。")
        state["pending"] = None
        _advance_turn(state)
    elif pending["attempts"] + 1 >= MAX_PROPOSAL_ATTEMPTS:
        state["unnamed"].append(pending["image"])
        _log(state, f"{PICTURE_BY_ID[pending['image']]['zh']} 始终没人认同，留在无名区。")
        state["pending"] = None
        _advance_turn(state)
    else:
        pending["attempts"] += 1
        pending["votes"] = {}
        _log(state, f"大家不同意把 {PICTURE_BY_ID[pending['image']]['zh']} 这样归类，再试一次。")
        return

    if not _unassigned(state):
        _finish_creation(state)


def _resolve_guesses(state: Dict) -> None:
    tally: Dict[str, int] = {}
    for image in state["guesses"].values():
        tally[image] = tally.get(image, 0) + 1
    best = max(tally.values()) if tally else 0
    leaders = [image for image, count in tally.items() if count == best]
    # The table only scores when it converges on exactly one picture. A split
    # vote means they never agreed, which the physical game resolves the same way.
    correct = len(leaders) == 1 and leaders[0] == state["target"]

    state["result"] = {
        "correct": correct,
        "target": state["target"],
        "word": list(state["word"]),
        "tally": tally,
        "leaders": leaders,
        "guesses": dict(state["guesses"]),
        "seq": state["seq"],
    }
    state["seq"] += 1
    if correct:
        state["score"] += 1
        state["defined"].append(state["target"])
        _log(state, f"大家听懂了！{_label(state, state['word'])} 就是 "
                    f"{PICTURE_BY_ID[state['target']]['zh']}。")
    else:
        state["say_what"].append(state["target"])
        _log(state, f"大家没听懂，{PICTURE_BY_ID[state['target']]['zh']} 进了Say What。")
    state["stage"] = STAGE_REVEAL
    state["continue_ready"] = []


def _check_game_end(state: Dict) -> bool:
    if len(state["say_what"]) >= SAY_WHAT_LIMIT or state["round"] >= state["rounds_total"]:
        state["stage"] = STAGE_GAME_OVER
        state["game_over"] = True
        _log(state, f"游戏结束，你们说对了 {state['score']} 个词。")
        return True
    return False


# --- Bot -----------------------------------------------------------------
# A deliberately shallow policy, so this game is **not** listed in
# game/ai_metadata.py and Select Game shows no 🤖. It proposes a random legal
# grouping, approves whatever it is shown, names a random candidate with a random
# legal word, and guesses at random. Inventing a language needs a human.

def _bot_choose_action(state: Dict, bot_id: str) -> Optional[Dict]:
    rng = random.Random()
    rng.seed(f"{state['game_id']}:{state['turn']}:{state['seq']}:{state['round']}:{bot_id}")
    stage = state["stage"]
    turn = state["turn"]

    if stage == STAGE_GAME_OVER:
        return {"type": "play_again"}
    if stage == STAGE_REVEAL:
        return {"type": "continue", "turn": turn}

    if stage == STAGE_CREATE:
        pending = state["pending"]
        if pending is None:
            if state["turn_order"][state["turn_index"]] != bot_id:
                return None
            images = _unassigned(state)
            if not images:
                return None
            choices = _revealed_sound_ids(state)
            if state["reserve"]:
                choices = choices + [NEW_SOUND]
            return {"type": "propose", "turn": turn,
                    "image": rng.choice(images), "sound": rng.choice(choices)}
        if bot_id not in pending["votes"] and bot_id != state["turn_order"][state["turn_index"]]:
            return {"type": "vote", "turn": turn, "approve": rng.random() < 0.75}
        return None

    if stage == STAGE_SPEAK:
        if state["communicator"] != bot_id:
            return None
        sounds = _revealed_sound_ids(state)
        if not sounds or not state["candidates"]:
            return None
        return {"type": "speak", "turn": turn, "target": rng.choice(state["candidates"]),
                "word": [rng.choice(sounds) for _ in range(rng.randint(1, 2))]}

    if stage == STAGE_GUESS:
        if state["communicator"] == bot_id or not state["candidates"]:
            return None
        return {"type": "guess", "turn": turn, "image": rng.choice(state["candidates"])}

    return None


# --- Serialization guard -------------------------------------------------

def _validate_saved_state(state: Dict) -> None:
    def require(condition: bool) -> None:
        if not condition:
            raise ValueError("invalid DADADA saved state")

    try:
        require(isinstance(state, dict) and state["game_id"] == "dadada" and state["version"] == 1)
        order = state["turn_order"]
        require(isinstance(order, list) and 2 <= len(order) <= 6
                and len(set(order)) == len(order) and all(order))
        require(set(state["players"]) == set(order) and set(state["player_meta"]) == set(order))
        require(state["player_count"] == len(order))
        require(state["rounds_total"] == len(order))
        require(state["stage"] in (STAGE_CREATE, STAGE_SPEAK, STAGE_GUESS,
                                   STAGE_REVEAL, STAGE_GAME_OVER))
        require(type(state["game_over"]) is bool
                and state["game_over"] == (state["stage"] == STAGE_GAME_OVER))
        require(type(state["turn"]) is int and state["turn"] >= 1)
        require(type(state["turn_index"]) is int and 0 <= state["turn_index"] < len(order))
        require(type(state["round"]) is int and 0 <= state["round"] <= len(order))
        require(type(state["score"]) is int and state["score"] >= 0)
        require(isinstance(state["log"], list) and all(isinstance(line, str) for line in state["log"]))
        require(isinstance(state["continue_ready"], list) and set(state["continue_ready"]) <= set(order))
        require(isinstance(state["rematch_ready"], list) and set(state["rematch_ready"]) <= set(order))
        require(isinstance(state["sounds"], list) and 1 <= len(state["sounds"]) <= SOUNDS_DEALT)
        require(isinstance(state["reserve"], list))
        require(len(state["sounds"]) + len(state["reserve"]) <= SOUNDS_DEALT)

        sound_ids = [entry["id"] for entry in state["sounds"]]
        require(len(set(sound_ids)) == len(sound_ids))
        require(all(sound_id in SOUND_BY_ID for sound_id in sound_ids))
        require(all(sound_id in SOUND_BY_ID for sound_id in state["reserve"]))
        require(not set(sound_ids) & set(state["reserve"]))

        require(isinstance(state["table"], list) and len(state["table"]) == CREATION_IMAGES)
        require(all(image in PICTURE_BY_ID for image in state["table"]))
        require(isinstance(state["placed"], dict))
        require(set(state["placed"]) <= set(state["table"]))
        require(not set(state["placed"]) & set(state["unnamed"]))
        require(set(state["placed"]) | set(state["unnamed"]) <= set(state["table"]))
        require(all(sound in sound_ids for sound in state["placed"].values()))

        grouped = [image for entry in state["sounds"] for image in entry["images"]]
        require(sorted(grouped) == sorted(state["placed"]))
        for entry in state["sounds"]:
            require(set(entry) == {"id", "images"})
            require(all(state["placed"].get(image) == entry["id"] for image in entry["images"]))

        require(isinstance(state["image_deck"], list) and isinstance(state["discard"], list))
        require(all(image in PICTURE_BY_ID for image in state["image_deck"] + state["discard"]))
        require(isinstance(state["candidates"], list) and len(state["candidates"]) <= CANDIDATES)
        require(all(image in PICTURE_BY_ID for image in state["candidates"]))
        require(state["target"] is None or state["target"] in state["candidates"])
        require(isinstance(state["word"], list) and len(state["word"]) <= MAX_WORD_LENGTH)
        require(all(sound in sound_ids for sound in state["word"]))
        require(isinstance(state["guesses"], dict) and set(state["guesses"]) <= set(order))
        require(all(image in state["candidates"] for image in state["guesses"].values()))
        require(state["communicator"] is None or state["communicator"] in order)

        require(isinstance(state["defined"], list) and isinstance(state["say_what"], list))
        require(len(state["say_what"]) <= SAY_WHAT_LIMIT)
        require(all(image in PICTURE_BY_ID for image in state["defined"] + state["say_what"]))
        require(not set(state["defined"]) & set(state["say_what"]))

        pending = state["pending"]
        if pending is not None:
            require(state["stage"] == STAGE_CREATE)
            require(set(pending) == {"image", "sound", "votes", "attempts"})
            require(pending["image"] in _unassigned(state))
            require(pending["sound"] == NEW_SOUND or pending["sound"] in sound_ids)
            require(pending["sound"] != NEW_SOUND or bool(state["reserve"]))
            require(isinstance(pending["votes"], dict) and set(pending["votes"]) <= set(order))
            require(0 <= pending["attempts"] < MAX_PROPOSAL_ATTEMPTS)

        for pid in order:
            player = state["players"][pid]
            require(set(player) == {"speaks", "rounds"})
            require(type(player["speaks"]) is int and player["speaks"] >= 0)
        rng = random.Random()
        rng.setstate(_as_tuple(state["rng_state"]))
    except (KeyError, TypeError, IndexError, AttributeError, OverflowError, ValueError) as error:
        if isinstance(error, ValueError) and str(error).startswith("invalid DADADA"):
            raise
        raise ValueError("invalid DADADA saved state") from error


# --- Game module ---------------------------------------------------------

class DadadaGame:
    game_id = "dadada"
    min_players = 2
    max_players = 6

    @staticmethod
    def init_game(config: Optional[Dict], players: List[Dict]) -> Dict:
        cfg = {} if config is None else copy.deepcopy(config)
        if not CONFIG_VALIDATOR.is_valid(cfg):
            raise ValueError("invalid DADADA configuration")
        if not 2 <= len(players) <= 6:
            raise ValueError("DADADA requires 2-6 players")
        ordered = sorted(players, key=lambda player: player.get("seat", 0))
        ids = [player["player_id"] for player in ordered]
        if len(set(ids)) != len(ids) or any(not isinstance(pid, str) or not pid for pid in ids):
            raise ValueError("player IDs must be unique nonempty strings")
        rng = random.Random(cfg.get("seed"))
        state = {
            "game_id": DadadaGame.game_id,
            "version": 1,
            "config": {},
            "rng_state": _json_random_state(rng),
            "turn_order": ids,
            "player_count": len(ids),
            "rounds_total": len(ids),
            "player_meta": {player["player_id"]: copy.deepcopy(player) for player in ordered},
            "players": {pid: {"speaks": 0, "rounds": 0} for pid in ids},
            "sounds": [],
            "reserve": [],
            "image_deck": [],
            "discard": [],
            "table": [],
            "placed": {},
            "unnamed": [],
            "pending": None,
            "round": 0,
            "communicator": None,
            "candidates": [],
            "target": None,
            "word": [],
            "guesses": {},
            "result": None,
            "defined": [],
            "say_what": [],
            "score": 0,
            "continue_ready": [],
            "rematch_ready": [],
            "stage": STAGE_CREATE,
            "turn": 1,
            "turn_index": 0,
            "game_over": False,
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
        if stage == STAGE_REVEAL:
            return [] if player_id in state["continue_ready"] else ["continue"]
        if stage == STAGE_CREATE:
            pending = state["pending"]
            if pending is None:
                return ["propose"] if _current_player(state) == player_id else []
            if _current_player(state) == player_id:
                return []
            return [] if player_id in pending["votes"] else ["vote"]
        if stage == STAGE_SPEAK:
            return ["speak"] if state["communicator"] == player_id else []
        if stage == STAGE_GUESS:
            return [] if state["communicator"] == player_id else ["guess"]
        return []

    @staticmethod
    def apply_action(state: Dict, player_id: str, action: Dict) -> Tuple[List[Dict], Optional[str]]:
        if not isinstance(action, dict) or not ACTION_VALIDATOR.is_valid(action):
            return [], "invalid action schema"
        if player_id not in state["players"]:
            return [], "player not found"
        action_type = action["type"]
        if action_type != "play_again" and action.get("turn") != state["turn"]:
            return [], "stale turn"
        if action_type not in DadadaGame.get_legal_actions(state, player_id):
            return [], "action unavailable in this stage"

        if action_type == "play_again":
            state["rematch_ready"].append(player_id)
            if len(state["rematch_ready"]) == len(state["turn_order"]):
                _reset_for_rematch(state)
            return [], None

        if action_type == "propose":
            image = action["image"]
            if image not in _unassigned(state):
                return [], "that picture is already sorted"
            sound = action["sound"]
            if sound == NEW_SOUND:
                if not state["reserve"]:
                    return [], "no sound card left to flip"
            elif _sound_entry(state, sound) is None:
                return [], "unknown sound card"
            state["pending"] = {"image": image, "sound": sound, "votes": {}, "attempts": 0}
            _log(state, f"{_name(state, player_id)} 提议把 {PICTURE_BY_ID[image]['zh']} 叫作 "
                        f"{'新音节' if sound == NEW_SOUND else _syllable(sound)}。")
            return [], None

        if action_type == "vote":
            state["pending"]["votes"][player_id] = bool(action["approve"])
            voters = _others(state, _current_player(state))
            if all(pid in state["pending"]["votes"] for pid in voters):
                _resolve_proposal(state)
            return [], None

        if action_type == "speak":
            target = action["target"]
            if target not in state["candidates"]:
                return [], "that picture is not on the table"
            word = list(action["word"])
            revealed = _revealed_sound_ids(state)
            if any(sound not in revealed for sound in word):
                return [], "you may only use sounds from your language"
            state["target"] = target
            state["word"] = word
            state["stage"] = STAGE_GUESS
            state["seq"] += 1
            _log(state, f"{_name(state, player_id)} 说出 {_label(state, word)}。")
            return [], None

        if action_type == "guess":
            image = action["image"]
            if image not in state["candidates"]:
                return [], "that picture is not on the table"
            state["guesses"][player_id] = image
            guessers = _others(state, state["communicator"])
            if all(pid in state["guesses"] for pid in guessers):
                _resolve_guesses(state)
            return [], None

        # continue
        state["continue_ready"].append(player_id)
        if len(state["continue_ready"]) == len(state["turn_order"]):
            if not _check_game_end(state):
                state["discard"].extend(
                    image for image in state["candidates"] if image != state["target"])
                _advance_turn(state)
                _start_round(state)
        return [], None

    @staticmethod
    def get_public_view(state: Dict, viewer_id: str) -> Dict:
        stage = state["stage"]
        reveal_all = stage in (STAGE_REVEAL, STAGE_GAME_OVER)
        is_communicator = viewer_id == state["communicator"]
        pending = state["pending"]

        sounds_view = [{
            "id": entry["id"],
            "syllable": _syllable(entry["id"]),
            "images": [_picture(image) for image in entry["images"]],
        } for entry in state["sounds"]]

        pending_view = None
        if pending is not None:
            pending_view = {
                "image": _picture(pending["image"]),
                "sound": pending["sound"],
                "syllable": "?" if pending["sound"] == NEW_SOUND else _syllable(pending["sound"]),
                "by": _current_player(state),
                "attempts": pending["attempts"],
                "votes": dict(pending["votes"]),
                "waiting": [pid for pid in _others(state, _current_player(state))
                            if pid not in pending["votes"]],
            }

        guessers = _others(state, state["communicator"]) if state["communicator"] else []
        guesses_view = dict(state["guesses"]) if reveal_all else {}
        guessed_view = [{"player_id": pid, "name": _name(state, pid),
                         "done": pid in state["guesses"]} for pid in guessers]

        result = copy.deepcopy(state["result"]) if reveal_all else None
        if result is not None:
            result["target_picture"] = _picture(result["target"])
            result["word_label"] = _label(state, result["word"])

        players_view = []
        for index, pid in enumerate(state["turn_order"]):
            meta = state["player_meta"][pid]
            players_view.append({
                "player_id": pid,
                "name": meta.get("name", pid),
                "seat": meta.get("seat", index),
                "is_bot": bool(meta.get("is_bot", False)),
                "speaks": state["players"][pid]["speaks"],
                "ready": pid in state["continue_ready"] or pid in state["rematch_ready"],
            })

        return copy.deepcopy({
            "game_id": DadadaGame.game_id,
            "stage": stage,
            "turn": state["turn"],
            "round": state["round"],
            "rounds_total": state["rounds_total"],
            "player_count": state["player_count"],
            "score": state["score"],
            "say_what": [_picture(image) for image in state["say_what"]],
            "say_what_limit": SAY_WHAT_LIMIT,
            "defined": [_picture(image) for image in state["defined"]],
            "you": viewer_id,
            "current_player": _current_player(state),
            "communicator": state["communicator"],
            "players": players_view,
            "sounds": sounds_view,
            "reserve_count": len(state["reserve"]),
            "table": [_picture(image) for image in _unassigned(state)],
            "unnamed": [_picture(image) for image in state["unnamed"]],
            "placed_count": len(state["placed"]),
            "table_total": CREATION_IMAGES,
            "pending": pending_view,
            "candidates": [_picture(image) for image in state["candidates"]],
            # Only the communicator knows which picture they meant, and only
            # until the round is scored.
            "target": _picture(state["target"]) if (state["target"] and (is_communicator or reveal_all)) else None,
            "word": list(state["word"]),
            "word_label": _label(state, state["word"]) if state["word"] else "",
            "word_max": MAX_WORD_LENGTH,
            "guesses": guesses_view,
            "guessers": guessed_view,
            "your_guess": state["guesses"].get(viewer_id) if stage == STAGE_GUESS else None,
            "result": result,
            "continue_ready": list(state["continue_ready"]),
            "rematch_ready": list(state["rematch_ready"]),
            "game_over": state["game_over"],
            "deck_count": len(state["image_deck"]),
            "legal_actions": DadadaGame.get_legal_actions(state, viewer_id),
            "log": list(state["log"]),
        })

    @staticmethod
    def bot_move(state: Dict, bot_id: str) -> Optional[Dict]:
        if state.get("game_over") and bot_id in state.get("rematch_ready", []):
            return None
        if not DadadaGame.get_legal_actions(state, bot_id):
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
    "DadadaGame",
    "NEW_SOUND",
    "STAGE_CREATE",
    "STAGE_GAME_OVER",
    "STAGE_GUESS",
    "STAGE_REVEAL",
    "STAGE_SPEAK",
]
