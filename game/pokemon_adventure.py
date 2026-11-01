from __future__ import annotations

import copy
import random
from typing import Dict, List, Optional, Tuple

from jsonschema import Draft7Validator


CARD_SPECS = [
    {"species": "jigglypuff", "name": "Jigglypuff", "name_zh": "胖丁", "value": 0, "count": 4, "ability": None, "emoji": "🎵", "color": "pink"},
    {"species": "eevee", "name": "Eevee", "name_zh": "伊布", "value": 1, "count": 4, "ability": None, "emoji": "🦊", "color": "brown"},
    {"species": "pikachu", "name": "Pikachu", "name_zh": "皮卡丘", "value": -2, "count": 4, "ability": None, "emoji": "⚡", "color": "yellow"},
    {"species": "bulbasaur", "name": "Bulbasaur", "name_zh": "妙蛙种子", "value": 3, "count": 4, "ability": None, "emoji": "🌱", "color": "green"},
    {"species": "squirtle", "name": "Squirtle", "name_zh": "杰尼龟", "value": 4, "count": 4, "ability": None, "emoji": "💧", "color": "blue"},
    {"species": "vulpix", "name": "Vulpix", "name_zh": "六尾", "value": 5, "count": 4, "ability": None, "emoji": "🔥", "color": "orange"},
    {"species": "slowbro", "name": "Slowbro", "name_zh": "呆壳兽", "value": 6, "count": 4, "ability": None, "emoji": "🐚", "color": "pink"},
    {"species": "gengar", "name": "Gengar", "name_zh": "耿鬼", "value": 7, "count": 4, "ability": None, "emoji": "👻", "color": "purple"},
    {"species": "mr_mime", "name": "Mr. Mime", "name_zh": "魔墙人偶", "value": 8, "count": 4, "ability": None, "emoji": "🎭", "color": "pink"},
    {"species": "onix", "name": "Onix", "name_zh": "大岩蛇", "value": 9, "count": 4, "ability": None, "emoji": "🪨", "color": "gray"},
    {"species": "charizard", "name": "Charizard", "name_zh": "喷火龙", "value": 10, "count": 2, "ability": "charizard", "emoji": "🐲", "color": "orange"},
    {"species": "snorlax", "name": "Snorlax", "name_zh": "卡比兽", "value": 10, "count": 2, "ability": "snorlax", "emoji": "💤", "color": "blue"},
    {"species": "zapdos", "name": "Zapdos", "name_zh": "闪电鸟", "value": 10, "count": 4, "ability": "zapdos", "emoji": "⚡", "color": "yellow"},
    {"species": "mew", "name": "Mew", "name_zh": "梦幻", "value": 2, "count": 2, "ability": "mew", "emoji": "✨", "color": "pink"},
    {"species": "ditto", "name": "Ditto", "name_zh": "百变怪", "value": 0, "count": 2, "ability": "ditto", "emoji": "🔮", "color": "purple"},
    {"species": "team_rocket", "name": "Team Rocket", "name_zh": "火箭队", "value": 12, "count": 4, "ability": "team_rocket", "emoji": "🚀", "color": "gray"},
]
SPEC_BY_ID = {card["species"]: card for card in CARD_SPECS}
CARD_BY_ID = {
    f"{spec['species']}:{number}": {
        "id": f"{spec['species']}:{number}",
        **{key: value for key, value in spec.items() if key != "count"},
    }
    for spec in CARD_SPECS
    for number in range(spec["count"])
}
DEFAULT_CONFIG = {"target_tokens": 3, "seed": None}
SLOT_SCHEMA = {"type": "integer", "minimum": 0, "maximum": 5}


def _action(type_name: str, properties: Dict) -> Dict:
    fields = {"type": {"const": type_name}, **properties}
    return {"type": "object", "properties": fields, "required": list(fields), "additionalProperties": False}


ACTION_SCHEMA = {
    "type": "object",
    "oneOf": [
        _action("initial_reveal", {"slot": SLOT_SCHEMA}),
        _action("draw_deck", {}),
        _action("draw_discard", {}),
        _action("replace_card", {"slot": SLOT_SCHEMA}),
        _action("discard_drawn", {}),
        _action("peek_card", {"slot": SLOT_SCHEMA}),
        _action("swap_cards", {"slots": {"type": "array", "items": SLOT_SCHEMA, "minItems": 2, "maxItems": 2, "uniqueItems": True}}),
        _action("skip_ability", {}),
        _action("steal_card", {"target_player_id": {"type": "string", "minLength": 1}, "target_slot": SLOT_SCHEMA, "slot": SLOT_SCHEMA}),
        _action("choose_ditto", {"slot": SLOT_SCHEMA, "neighbor_slot": SLOT_SCHEMA}),
        _action("next_round", {}),
    ],
}
CONFIG_SCHEMA = {
    "type": "object",
    "properties": {
        "target_tokens": {"type": "integer", "minimum": 1, "maximum": 5, "default": 3},
        "seed": {"type": ["integer", "null"]},
    },
    "additionalProperties": False,
}
_ACTION_VALIDATOR = Draft7Validator(ACTION_SCHEMA)
_CONFIG_VALIDATOR = Draft7Validator(CONFIG_SCHEMA)


def _rng_state(rng: random.Random) -> List:
    version, values, gaussian = rng.getstate()
    return [version, list(values), gaussian]


def _restore_rng(state: Dict) -> random.Random:
    rng = random.Random()
    version, values, gaussian = state["rng_state"]
    rng.setstate((version, tuple(values), gaussian))
    return rng


def _build_deck() -> List[str]:
    return list(CARD_BY_ID)


def _card_view(card_id: str) -> Dict:
    return dict(CARD_BY_ID[card_id])


def _name(state: Dict, player_id: str) -> str:
    return state["player_meta"][player_id].get("name") or player_id


def _append_log(state: Dict, text: str) -> None:
    state["log"].append(text)
    del state["log"][:-80]


def _record_action(state: Dict, action_type: str, player_id: str, **details) -> Dict:
    payload = {"type": action_type, "player_id": player_id, **details}
    state["last_action"] = payload
    return {"type": f"pokemon_adventure:{action_type}", "payload": copy.deepcopy(payload)}


def _neighbors(slot: int) -> List[int]:
    return [candidate for candidate in (slot - 1, slot + 1) if candidate // 3 == slot // 3 and 0 <= candidate < 6]


def _take_deck(state: Dict) -> Optional[str]:
    if not state["deck"] and len(state["discard"]) > 1:
        rng = _restore_rng(state)
        state["deck"] = state["discard"][:-1]
        state["discard"] = state["discard"][-1:]
        rng.shuffle(state["deck"])
        state["rng_state"] = _rng_state(rng)
        state["deck_refills"] += 1
        _append_log(state, "牌库耗尽：保留弃牌顶，将其余弃牌洗回牌库。")
    return state["deck"].pop() if state["deck"] else None


def _replace(state: Dict, player_id: str, slot: int, card_id: str) -> str:
    player = state["players"][player_id]
    old_card = player["hand"][slot]
    player["hand"][slot] = card_id
    player["face_up"][slot] = True
    return old_card


def _score_columns(values: List[int]) -> List[int]:
    return [0 if values[column] == values[column + 3] else values[column] + values[column + 3] for column in range(3)]


def _effective_values(state: Dict, player_id: str) -> List[int]:
    hand = state["players"][player_id]["hand"]
    choices = state["ditto_links"][player_id]

    def resolve(slot: int, visited: Tuple[int, ...]) -> int:
        card = CARD_BY_ID[hand[slot]]
        if card["ability"] != "ditto":
            return card["value"]
        if slot in visited:
            return 0
        neighbor = choices.get(str(slot))
        if neighbor is None:
            return 0
        return resolve(neighbor, (*visited, slot))

    return [resolve(slot, ()) for slot in range(6)]


def _finish_scoring(state: Dict) -> None:
    results = []
    for player_id in state["turn_order"]:
        player = state["players"][player_id]
        values = _effective_values(state, player_id)
        columns = _score_columns(values)
        score = sum(columns)
        player["round_score"] = score
        player["total_score"] += score
        results.append({
            "player_id": player_id,
            "name": _name(state, player_id),
            "values": values,
            "columns": columns,
            "score": score,
            "tokens": player["tokens"],
        })
    ranked = sorted(results, key=lambda result: (result["score"], [-value for value in sorted(result["values"], reverse=True)], state["turn_order"].index(result["player_id"])))
    winner_id = ranked[0]["player_id"]
    state["players"][winner_id]["tokens"] += 1
    for result in results:
        result["tokens"] = state["players"][result["player_id"]]["tokens"]
    tied = sum(result["score"] == ranked[0]["score"] for result in results) > 1
    state["last_round_summary"] = {
        "round": state["round"],
        "reason": state["round_end_reason"],
        "finisher": state["round_finisher"],
        "winner": winner_id,
        "players": results,
        "tie_break": "同分按有效数字从大到小比较，首个不同数字较高者胜；仍完全相同则座位靠前者胜。" if tied else None,
    }
    state["next_start_player"] = winner_id
    state["phase"] = "round_end"
    state["current_turn"] = None
    if state["players"][winner_id]["tokens"] >= state["config"]["target_tokens"]:
        state["game_over"] = True
        state["winner"] = [winner_id]
    _append_log(state, f"第 {state['round']} 小局：{_name(state, winner_id)} 以 {ranked[0]['score']} 分获胜，获得 1 枚精灵球代币。")


def _begin_scoring(state: Dict, reason: str, finisher: Optional[str]) -> None:
    state["drawn"] = None
    state["pending_ability"] = None
    state["round_end_reason"] = reason
    state["round_finisher"] = finisher
    state["ditto_links"] = {player_id: {} for player_id in state["turn_order"]}
    state["ditto_choices"] = []
    state["current_turn"] = None
    for player_id, player in state["players"].items():
        player["face_up"] = [True] * 6
        for slot, card_id in enumerate(player["hand"]):
            if CARD_BY_ID[card_id]["ability"] != "ditto":
                continue
            neighbors = _neighbors(slot)
            if len(neighbors) == 1:
                state["ditto_links"][player_id][str(slot)] = neighbors[0]
            else:
                state["ditto_choices"].append({"player_id": player_id, "slot": slot, "neighbors": neighbors})
    if state["ditto_choices"]:
        state["phase"] = "ditto_choice"
        _append_log(state, "所有牌已公开：请为中列的百变怪选择复制方向。")
    else:
        _finish_scoring(state)


def _complete_turn(state: Dict) -> None:
    actor = state["current_turn"]
    state["drawn"] = None
    state["pending_ability"] = None
    finishers = [player_id for player_id in state["turn_order"] if all(state["players"][player_id]["face_up"])]
    if finishers:
        _begin_scoring(state, "all_revealed", actor if actor in finishers else finishers[0])
        return
    order = state["turn_order"]
    state["current_turn"] = order[(order.index(actor) + 1) % len(order)]
    state["turn"] += 1
    state["phase"] = "turn"


def _start_round(state: Dict, first_round: bool = False) -> None:
    rng = _restore_rng(state)
    deck = _build_deck()
    rng.shuffle(deck)
    if first_round:
        state["next_start_player"] = rng.choice(state["turn_order"])
    for player in state["players"].values():
        player["hand"] = [deck.pop() for _ in range(6)]
        player["face_up"] = [False] * 6
        player["initial_reveal_done"] = False
        player["round_ready"] = False
        player["round_score"] = None
    state["round"] += 1
    state["turn"] = 1
    state["deck"] = deck
    state["discard"] = [state["deck"].pop()]
    state["deck_refills"] = 0
    state["knowledge"] = {player_id: [] for player_id in state["turn_order"]}
    state["ditto_links"] = {player_id: {} for player_id in state["turn_order"]}
    state["ditto_choices"] = []
    state["drawn"] = None
    state["pending_ability"] = None
    state["last_action"] = None
    state["last_round_summary"] = None
    state["round_end_reason"] = None
    state["round_finisher"] = None
    state["current_turn"] = state["next_start_player"]
    state["phase"] = "initial_reveal"
    state["rng_state"] = _rng_state(rng)
    _append_log(state, f"第 {state['round']} 小局开始：每位玩家选择公开 1 张牌。")


def _bot_slot(view: Dict, candidate: Dict) -> int:
    hand = next(player["hand"] for player in view["players"] if player["player_id"] == view["you"])
    hidden = [card["slot"] for card in hand if not card["face_up"]]
    values = [card["card"]["value"] if card["known"] else 4 for card in hand]
    baseline = sum(_score_columns(values))
    scored = []
    for slot in range(6):
        proposal = list(values)
        proposal[slot] = candidate["value"]
        scored.append((sum(_score_columns(proposal)), slot))
    best_score, best_slot = min(scored)
    if hidden and (best_score >= baseline - 8 or not hand[best_slot]["face_up"]):
        return min(hidden, key=lambda slot: (hand[slot]["known"], -(values[slot]), slot))
    return best_slot


class PokemonAdventureGame:
    game_id = "pokemon_adventure"
    min_players = 2
    max_players = 5

    @staticmethod
    def init_game(config: Optional[Dict], players: List[Dict]) -> Dict:
        if config is None:
            config = {}
        if not _CONFIG_VALIDATOR.is_valid(config):
            raise ValueError("invalid Pokémon Paper Safari configuration")
        if not isinstance(players, list) or not 2 <= len(players) <= 5:
            raise ValueError("Pokémon Paper Safari requires 2–5 players")
        if any(not isinstance(player, dict) or not isinstance(player.get("player_id"), str) or not player["player_id"] for player in players):
            raise ValueError("invalid player")
        player_ids = [player["player_id"] for player in players]
        if len(set(player_ids)) != len(player_ids):
            raise ValueError("duplicate player")
        config = {**DEFAULT_CONFIG, **config}
        player_meta = {player["player_id"]: dict(player) for player in players}
        seats = {player_id: index for index, player_id in enumerate(player_ids)}
        player_ids.sort(key=lambda player_id: player_meta[player_id].get("seat", seats[player_id]))
        rng = random.Random(config["seed"])
        state = {
            "game_id": PokemonAdventureGame.game_id,
            "version": 2,
            "config": config,
            "players": {player_id: {"tokens": 0, "total_score": 0} for player_id in player_ids},
            "player_meta": player_meta,
            "turn_order": player_ids,
            "rng_state": _rng_state(rng),
            "round": 0,
            "turn": 1,
            "game_over": False,
            "winner": None,
            "log": [],
        }
        _start_round(state, first_round=True)
        return state

    @staticmethod
    def get_legal_actions(state: Dict, player_id: str) -> List[str]:
        if not isinstance(player_id, str) or player_id not in state["players"] or state["game_over"]:
            return []
        player = state["players"][player_id]
        phase = state["phase"]
        if phase == "initial_reveal":
            return [] if player["initial_reveal_done"] else ["initial_reveal"]
        if phase == "round_end":
            return [] if player["round_ready"] else ["next_round"]
        if phase == "ditto_choice":
            return ["choose_ditto"] if any(choice["player_id"] == player_id for choice in state["ditto_choices"]) else []
        if state["current_turn"] != player_id:
            return []
        if phase == "turn":
            return ["draw_deck", "draw_discard"] if state["discard"] else ["draw_deck"]
        if phase == "drawn":
            drawn = state["drawn"]
            ability = CARD_BY_ID[drawn["card"]]["ability"]
            if ability == "mew":
                return ["steal_card"]
            actions = ["replace_card"]
            if drawn["source"] == "deck" and ability not in ("zapdos", "team_rocket"):
                actions.append("discard_drawn")
            return actions
        if phase == "ability":
            return ["peek_card", "skip_ability"] if state["pending_ability"]["type"] == "charizard" else ["swap_cards", "skip_ability"]
        return []

    @staticmethod
    def apply_action(state: Dict, player_id: str, action: Dict) -> Tuple[List[Dict], Optional[str]]:
        if not isinstance(player_id, str) or player_id not in state["players"]:
            return [], "unknown player"
        if not _ACTION_VALIDATOR.is_valid(action):
            return [], "invalid action"
        slot_values = [action[key] for key in ("slot", "target_slot", "neighbor_slot") if key in action]
        slot_values.extend(action.get("slots", []))
        if any(type(value) is not int for value in slot_values):
            return [], "invalid slot type"
        if state["game_over"]:
            return [], "game over"
        action_type = action["type"]
        if action_type not in PokemonAdventureGame.get_legal_actions(state, player_id):
            return [], "action is not available"
        player = state["players"][player_id]
        events = []
        if action_type == "initial_reveal":
            slot = action["slot"]
            player["face_up"][slot] = True
            player["initial_reveal_done"] = True
            events.append(_record_action(state, action_type, player_id, slot=slot, card=_card_view(player["hand"][slot])))
            _append_log(state, f"{_name(state, player_id)} 公开了位置 {slot + 1} 的牌。")
            if all(data["initial_reveal_done"] for data in state["players"].values()):
                state["phase"] = "turn"
            return events, None
        if action_type == "next_round":
            player["round_ready"] = True
            events.append(_record_action(state, action_type, player_id))
            if all(data["round_ready"] for data in state["players"].values()):
                _start_round(state)
                events.append({"type": "pokemon_adventure:round_started", "payload": {"round": state["round"]}})
            return events, None
        if action_type == "choose_ditto":
            choice = next((choice for choice in state["ditto_choices"] if choice["player_id"] == player_id and choice["slot"] == action["slot"]), None)
            if choice is None or action["neighbor_slot"] not in choice["neighbors"]:
                return [], "choose a horizontal neighbor for your pending Ditto"
            state["ditto_links"][player_id][str(action["slot"])] = action["neighbor_slot"]
            state["ditto_choices"].remove(choice)
            events.append(_record_action(state, action_type, player_id, slot=action["slot"]))
            if not state["ditto_choices"]:
                _finish_scoring(state)
            return events, None
        if action_type in ("draw_deck", "draw_discard"):
            source = "deck" if action_type == "draw_deck" else "discard"
            card_id = _take_deck(state) if source == "deck" else state["discard"].pop()
            if card_id is None:
                _begin_scoring(state, "deck_empty", None)
                events.append(_record_action(state, "deck_empty", player_id))
                return events, None
            state["drawn"] = {"card": card_id, "source": source, "player_id": player_id}
            state["phase"] = "drawn"
            events.append(_record_action(state, action_type, player_id))
            _append_log(state, f"{_name(state, player_id)} 从{'牌库' if source == 'deck' else '弃牌堆'}抽了 1 张牌。")
            return events, None
        if action_type == "peek_card":
            slot = action["slot"]
            if player["face_up"][slot]:
                return [], "choose a face-down card"
            card_id = player["hand"][slot]
            if card_id not in state["knowledge"][player_id]:
                state["knowledge"][player_id].append(card_id)
            events.append(_record_action(state, action_type, player_id, slot=slot))
            _append_log(state, f"{_name(state, player_id)} 用喷火龙窥视了一张暗牌。")
            _complete_turn(state)
            return events, None
        if action_type == "swap_cards":
            first, second = action["slots"]
            player["hand"][first], player["hand"][second] = player["hand"][second], player["hand"][first]
            player["face_up"][first], player["face_up"][second] = player["face_up"][second], player["face_up"][first]
            events.append(_record_action(state, action_type, player_id, slots=list(action["slots"])))
            _append_log(state, f"{_name(state, player_id)} 用卡比兽交换了位置 {first + 1} 与 {second + 1}。")
            _complete_turn(state)
            return events, None
        if action_type == "skip_ability":
            events.append(_record_action(state, action_type, player_id))
            _complete_turn(state)
            return events, None
        drawn_card = state["drawn"]["card"]
        if action_type == "discard_drawn":
            state["discard"].append(drawn_card)
            events.append(_record_action(state, action_type, player_id, card=_card_view(drawn_card)))
            _append_log(state, f"{_name(state, player_id)} 弃掉了 {CARD_BY_ID[drawn_card]['name_zh']}。")
            _complete_turn(state)
            return events, None
        slot = action["slot"]
        if action_type == "steal_card":
            target_id = action["target_player_id"]
            if target_id == player_id or target_id not in state["players"]:
                return [], "choose another player"
            if not state["players"][target_id]["face_up"][action["target_slot"]]:
                return [], "Mew can only steal a face-up card"
            stolen = _replace(state, target_id, action["target_slot"], drawn_card)
            old_card = _replace(state, player_id, slot, stolen)
            state["discard"].append(old_card)
            events.append(_record_action(state, action_type, player_id, target_player_id=target_id, target_slot=action["target_slot"], slot=slot, card=_card_view(stolen)))
            _append_log(state, f"{_name(state, player_id)} 用梦幻从 {_name(state, target_id)} 夺取了一张牌。")
            _complete_turn(state)
            return events, None
        ability = CARD_BY_ID[drawn_card]["ability"]
        if ability == "zapdos":
            actor_index = state["turn_order"].index(player_id)
            carried = drawn_card
            for offset in range(len(state["turn_order"])):
                target_id = state["turn_order"][(actor_index + offset) % len(state["turn_order"])]
                carried = _replace(state, target_id, slot, carried)
            state["discard"].insert(0, carried)
            events.append(_record_action(state, action_type, player_id, slot=slot, card=_card_view(drawn_card), ability=ability, discarded=_card_view(carried)))
            _append_log(state, f"{_name(state, player_id)} 用闪电鸟传递了全员位置 {slot + 1} 的牌，末张 {CARD_BY_ID[carried]['name_zh']} 公开放到弃牌堆底。")
            _complete_turn(state)
            return events, None
        if ability == "team_rocket":
            rng = _restore_rng(state)
            coin = rng.choice(["meowth", "pikachu"])
            state["rng_state"] = _rng_state(rng)
            changes = []
            if coin == "meowth":
                state["discard"].append(_replace(state, player_id, slot, drawn_card))
            else:
                state["discard"].append(drawn_card)
                actor_index = state["turn_order"].index(player_id)
                order = state["turn_order"][actor_index:] + state["turn_order"][:actor_index]
                old_cards = {target_id: state["players"][target_id]["hand"][slot] for target_id in order}
                state["discard"][0:0] = list(old_cards.values())
                for target_id in order:
                    replacement = _take_deck(state)
                    if replacement is None:
                        raise RuntimeError("not enough cards to resolve Team Rocket")
                    _replace(state, target_id, slot, replacement)
                    changes.append({"player_id": target_id, "discarded": _card_view(old_cards[target_id]), "card": _card_view(replacement)})
            events.append(_record_action(state, action_type, player_id, slot=slot, card=_card_view(drawn_card), ability=ability, coin=coin, changes=changes))
            _append_log(state, f"{_name(state, player_id)} 的火箭队投出{'喵喵面，正常入场' if coin == 'meowth' else '皮卡丘面，全员同位置弃牌补牌'}。")
            _complete_turn(state)
            return events, None
        state["discard"].append(_replace(state, player_id, slot, drawn_card))
        state["drawn"] = None
        events.append(_record_action(state, action_type, player_id, slot=slot, card=_card_view(drawn_card), ability=ability))
        _append_log(state, f"{_name(state, player_id)} 在位置 {slot + 1} 放入了 {CARD_BY_ID[drawn_card]['name_zh']}。")
        hidden_slots = [position for position, face_up in enumerate(player["face_up"]) if not face_up]
        if ability == "snorlax" or (ability == "charizard" and hidden_slots):
            state["pending_ability"] = {"type": ability, "player_id": player_id, "slots": hidden_slots if ability == "charizard" else list(range(6))}
            state["phase"] = "ability"
        else:
            _complete_turn(state)
        return events, None

    @staticmethod
    def get_public_view(state: Dict, viewer_id: str) -> Dict:
        players = []
        for player_id in state["turn_order"]:
            player = state["players"][player_id]
            meta = state["player_meta"][player_id]
            known_ids = state["knowledge"][player_id] if viewer_id == player_id else []
            hand = []
            for slot, card_id in enumerate(player["hand"]):
                known = player["face_up"][slot] or card_id in known_ids
                card = _card_view(card_id) if known else None
                if card is not None and state["last_round_summary"]:
                    result = next(result for result in state["last_round_summary"]["players"] if result["player_id"] == player_id)
                    card["effective_value"] = result["values"][slot]
                hand.append({"slot": slot, "face_up": player["face_up"][slot], "known": known, "card": card})
            players.append({
                "player_id": player_id,
                "name": meta.get("name") or player_id,
                "seat": meta.get("seat", state["turn_order"].index(player_id)),
                "is_bot": bool(meta.get("is_bot", False)),
                "tokens": player["tokens"],
                "total_score": player["total_score"],
                "initial_reveal_done": player["initial_reveal_done"],
                "round_ready": player["round_ready"],
                "round_score": player["round_score"],
                "revealed_count": sum(player["face_up"]),
                "hand": hand,
            })
        drawn = state["drawn"]
        drawn_view = None
        if drawn:
            drawn_view = {"player_id": drawn["player_id"], "source": drawn["source"], "card": _card_view(drawn["card"]) if viewer_id == drawn["player_id"] or drawn["source"] == "discard" else None}
        return {
            "game_id": PokemonAdventureGame.game_id,
            "you": viewer_id,
            "phase": state["phase"],
            "round": state["round"],
            "turn": state["turn"],
            "current_turn": state["current_turn"],
            "turn_order": list(state["turn_order"]),
            "config": {"target_tokens": state["config"]["target_tokens"]},
            "players": players,
            "deck_count": len(state["deck"]),
            "discard_count": len(state["discard"]),
            "discard_top": _card_view(state["discard"][-1]) if state["discard"] else None,
            "deck_refills": state["deck_refills"],
            "drawn": drawn_view,
            "pending_ability": copy.deepcopy(state["pending_ability"]),
            "ditto_choices": copy.deepcopy(state["ditto_choices"]),
            "legal_actions": PokemonAdventureGame.get_legal_actions(state, viewer_id),
            "last_action": copy.deepcopy(state["last_action"]),
            "last_round_summary": copy.deepcopy(state["last_round_summary"]),
            "log": list(state["log"][-30:]),
            "winner": copy.deepcopy(state["winner"]),
            "game_over": state["game_over"],
        }

    @staticmethod
    def bot_move(state: Dict, bot_id: str) -> Optional[Dict]:
        view = PokemonAdventureGame.get_public_view(state, bot_id)
        legal = view["legal_actions"]
        if not legal:
            return None
        own = next(player for player in view["players"] if player["player_id"] == bot_id)
        if "initial_reveal" in legal:
            return {"type": "initial_reveal", "slot": (own["seat"] + view["round"]) % 6}
        if "next_round" in legal:
            return {"type": "next_round"}
        if "choose_ditto" in legal:
            choice = next(choice for choice in view["ditto_choices"] if choice["player_id"] == bot_id)
            values = [card["card"]["value"] for card in own["hand"]]
            neighbor = min(choice["neighbors"], key=lambda neighbor: sum(_score_columns([values[neighbor] if slot == choice["slot"] else value for slot, value in enumerate(values)])))
            return {"type": "choose_ditto", "slot": choice["slot"], "neighbor_slot": neighbor}
        if "peek_card" in legal:
            hidden = [card for card in own["hand"] if not card["face_up"]]
            return {"type": "peek_card", "slot": min(hidden, key=lambda card: (card["known"], card["slot"]))["slot"]}
        if "swap_cards" in legal:
            values = [card["card"]["value"] if card["known"] else 4 for card in own["hand"]]
            alternatives = []
            for first in range(6):
                for second in range(first + 1, 6):
                    proposal = list(values)
                    proposal[first], proposal[second] = proposal[second], proposal[first]
                    alternatives.append((sum(_score_columns(proposal)), first, second))
            score, first, second = min(alternatives)
            return {"type": "swap_cards", "slots": [first, second]} if score < sum(_score_columns(values)) else {"type": "skip_ability"}
        if "draw_deck" in legal:
            discard = view["discard_top"]
            if discard and "draw_discard" in legal:
                pair = any(card["known"] and card["card"]["value"] == discard["value"] for card in own["hand"])
                if discard["value"] <= 1 or (pair and discard["value"] >= 0 and discard["ability"] != "team_rocket"):
                    return {"type": "draw_discard"}
            return {"type": "draw_deck"}
        drawn = view["drawn"]["card"]
        slot = _bot_slot(view, drawn)
        if "steal_card" in legal:
            candidates = []
            for opponent in view["players"]:
                if opponent["player_id"] == bot_id:
                    continue
                for card in opponent["hand"]:
                    if not card["face_up"]:
                        continue
                    value = card["card"]["value"] if card["known"] else 4
                    candidates.append((value, opponent["seat"], card["slot"], opponent["player_id"], card))
            _, _, target_slot, target_id, target = min(candidates, key=lambda candidate: candidate[:4])
            slot = _bot_slot(view, target["card"] if target["known"] else {"value": 4})
            return {"type": "steal_card", "target_player_id": target_id, "target_slot": target_slot, "slot": slot}
        return {"type": "replace_card", "slot": slot}

    @staticmethod
    def serialize(state: Dict) -> Dict:
        return copy.deepcopy(state)

    @staticmethod
    def deserialize(payload: Dict) -> Dict:
        if not isinstance(payload, dict) or payload.get("version") != 2 or payload.get("game_id") != PokemonAdventureGame.game_id:
            raise ValueError("incompatible Pokémon Paper Safari save")
        return copy.deepcopy(payload)
