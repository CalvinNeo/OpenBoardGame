"""Cooperative Eternal Decks Stage A, with visibly labelled prototype manifests."""

import copy
import itertools
import random
import secrets
from typing import Dict, List, Optional, Tuple

from jsonschema import Draft7Validator

from game.eternal_decks_data import (
    ACTION_SCHEMA, COLORS, CONFIG_SCHEMA, ETERNALS, FIELDS, RECIPES, REASONS,
    STARS, deck_manifest,
)

_ACTION_VALIDATOR = Draft7Validator(ACTION_SCHEMA)
_CONFIG_VALIDATOR = Draft7Validator(CONFIG_SCHEMA)


def _log(state: Dict, text: str) -> None:
    state["log"].append(text)
    state["log"] = state["log"][-80:]


def _note(state: Dict, text: str) -> None:
    state["turn_notes"].append(text)
    _log(state, text)


def _draw(state: Dict, pid: str) -> None:
    player = state["players"][pid]
    while len(player["hand"]) < 3 and player["deck"]:
        player["hand"].append(player["deck"].pop(0))


def _wild(card: Dict) -> bool:
    return card["kind"] == "rare" or card.get("as_rare", False)


def _active(state: Dict) -> List[str]:
    return [item["id"] for item in state["revived"] if item["jewel"] is None]


def field_reason(state: Dict, card: Dict, row_index: int, orientation: str = "normal") -> Optional[str]:
    """Check only the new placement. Previously accepted cards remain valid.

    With the three Stage A fields, a run of Rare cards can be solved as an
    interval between its numeric anchors. A newly played Rare bypasses these
    constraints; when a number follows it, every intervening Rare needs a value.
    """
    row = state["rows"][row_index]
    if row["closed"]:
        return "closed"
    if len(row["cards"]) >= 7 - len(row["sleeping"]):
        return "full"
    if card["kind"] == "ability":
        return "kind"
    if orientation not in ("normal", "rotated") or (orientation == "rotated" and len(card["colors"]) != 2):
        return "orientation"
    for eid in _active(state):
        eternal = ETERNALS[eid]
        if eid == "B3" and _wild(card):
            return "curse"
        if not _wild(card) and (card.get("number") in eternal.get("numbers", [])
                               or eternal.get("color") in card["colors"]):
            return "curse"
    if _wild(card) or not row["cards"]:
        return None
    previous = row["cards"][-1]
    if not _wild(previous):
        previous_colors = previous["colors"][::(-1 if previous.get("orientation") == "rotated" else 1)]
        colors = card["colors"][::(-1 if orientation == "rotated" else 1)]
        if previous_colors[-1] == colors[0]:
            return "same_color"
        if previous["number"] == card["number"]:
            return "same_number"
    if row["field"] == "camp":
        return None
    ascending = row["field"] == "mountain"
    reason = "ascending" if ascending else "descending"
    rare_count = 0
    for previous in reversed(row["cards"]):
        if _wild(previous):
            rare_count += 1
        else:
            distance = card["number"] - previous["number"] if ascending else previous["number"] - card["number"]
            return None if distance > rare_count else reason
    # All preceding cards are Rare. Values must fit in the 1..9 domain.
    room = card["number"] - 1 if ascending else 9 - card["number"]
    return None if room >= rare_count else reason


def recipe_matches(recipe: str, cards: List[Dict]) -> bool:
    if recipe not in RECIPES or len(cards) != RECIPES[recipe]["count"]:
        return False
    if recipe in ("any_2", "any_3"):
        return True
    if any(card["kind"] == "ability" and not _wild(card) for card in cards):
        return False
    numbers = [set(range(1, 10)) if _wild(card) else {card["number"]} for card in cards]
    colors = [set(COLORS) if _wild(card) else set(card["colors"]) for card in cards]
    if recipe == "one_or_nine":
        return bool(numbers[0] & {1, 9})
    if recipe.startswith("same_number"):
        return bool(set.intersection(*numbers))
    if recipe == "same_color_3":
        return bool(set.intersection(*colors))
    if recipe == "different_color_3":
        return any(len(set(combo)) == 3 for combo in itertools.product(*colors))
    return any(all(value in allowed for value, allowed in zip(combo, numbers))
               for combo in itertools.permutations((1, 5, 9)))


def _targets(state: Dict) -> List[str]:
    return [item["id"] for item in state["revived"] if item["jewel"] is None]


def _ability_options(state: Dict, card: Dict) -> List[Dict]:
    ability = card["ability"]
    if ability in ("star", "heal", "reveal"):
        return [{}]
    if ability == "jewel":
        options = [{"recipe": recipe, "target": target} for recipe, available in state["jewels"].items()
                   if available and recipe != "one_five_nine" for target in _targets(state)]
        return options or [{}]
    if ability == "recycle":
        options = [{"card_id": item["id"]} for item in state["discard"] if item["kind"] == "rare"]
        return options or [{}]
    if ability == "swap":
        options = [{"row": index, "slot": slot} for index, row in enumerate(state["rows"])
                   for slot, item in enumerate(row["cards"]) if not item.get("as_rare")]
        return options or [{}]
    if ability == "retrieve":
        ids = [item["id"] for item in state["river"]]
        return [{"card_ids": list(combo)} for count in range(min(2, len(ids)) + 1)
                for combo in itertools.combinations(ids, count)]
    return []


def _main_actions(state: Dict, pid: str) -> List[Dict]:
    hand = state["players"][pid]["hand"]
    actions = []
    for card in hand:
        cid = card["id"]
        actions.append({"type": "river", "card_id": cid})
        for index in range(3):
            for orientation in (["normal", "rotated"] if len(card["colors"]) == 2 else ["normal"]):
                if field_reason(state, card, index, orientation) is None:
                    actions.append({"type": "place", "card_id": cid, "row": index, "orientation": orientation})
        if state["hearts"]:
            actions.extend({"type": "give", "card_id": cid, "target": target}
                           for target in state["turn_order"] if target != pid)
        if card["kind"] == "ability":
            actions.extend({"type": "ability", "card_id": cid, "options": option}
                           for option in _ability_options(state, card))
    targets = _targets(state)
    if targets:
        for recipe, data in RECIPES.items():
            if not state["jewels"][recipe]:
                continue
            for cards in itertools.combinations(hand, data["count"]):
                if recipe_matches(recipe, list(cards)):
                    actions.extend({"type": "generate", "card_ids": sorted(card["id"] for card in cards),
                                    "recipe": recipe, "target": target} for target in targets)
    return actions


def _star(state: Dict, source: str) -> None:
    if source not in state["stars"]:
        state["stars"].append(source)
        _note(state, f"⭐ {STARS[source]} · {len(state['stars'])}/4")


def _check_stars(state: Dict) -> None:
    for start, source in ((0, "jewels_1_3"), (3, "jewels_4_6")):
        group = state["revived"][start:start + 3]
        if len(group) == 3 and all(item["jewel"] is not None for item in group):
            _star(state, source)
    if len(state["revived"]) == 9:
        _star(state, "all_revived")
    if len(state["stage_cards"]) >= 3:
        _star(state, "abilities")


def _give_jewel(state: Dict, recipe: str, target: str) -> None:
    state["jewels"][recipe] = False
    next(item for item in state["revived"] if item["id"] == target)["jewel"] = recipe
    _note(state, f"💎 {RECIPES[recipe]['name']} → {ETERNALS[target]['name']}，诅咒解除。")
    if recipe == "one_five_nine":
        _star(state, "one_five_nine")
    _check_stars(state)


def _resolve_river(state: Dict, pid: str) -> None:
    if len(state["river"]) < 5:
        return
    state["review_cards"].append({"label": "🌊 生命之河", "cards": copy.deepcopy(state["river"])})
    state["discard"].extend(state["river"])
    state["river"] = []
    if state["river_rewards"]:
        state["players"][pid]["hand"].append(state["river_rewards"].pop())
        _note(state, "🌊 河流清空，行动玩家取得一张 Rare。")
    else:
        state["river_failed"] = True
        _note(state, "🌊 河流清空，取得 Game Over。")


def _end_game(state: Dict, success: bool, reason: str) -> None:
    state["game_over"] = True
    state["phase"] = "game_over"
    state["result"] = {"success": success, "reason": reason}
    state["current_turn"] = None
    state["hands_revealed"] = False
    _log(state, ("🏆 " if success else "🌙 ") + reason)


def _start_turn(state: Dict, pid: str) -> None:
    state["current_turn"] = pid
    state["phase"] = "playing"
    # Every card can go into the river in Stage A. An empty hand is therefore
    # exactly the condition of having no main action, even with hearts left.
    if not state["players"][pid]["hand"]:
        _end_game(state, False, f"{state['player_meta'][pid]['name']} 已无可执行的主行动。")


def _finish_turn(state: Dict, pid: str) -> None:
    _check_stars(state)
    state["hands_revealed"] = False
    if len(state["stars"]) >= 4:
        _end_game(state, True, "取得四颗星，所有玩家共同获胜！")
        return
    if state["river_failed"]:
        _end_game(state, False, "取得了河流 Game Over，全队挑战结束。")
        return
    _draw(state, pid)
    state["turn_count"] += 1
    index = state["turn_order"].index(pid)
    next_pid = state["turn_order"][(index + 1) % len(state["turn_order"])]
    if state["turn_notes"] or state["turn_count"] % len(state["turn_order"]) == 0:
        state["phase"] = "round_end"
        state["next_player"] = next_pid
        state["current_turn"] = None
        state["next_ready"] = []
    else:
        _start_turn(state, next_pid)


def _complete_row(state: Dict, pid: str, index: int) -> bool:
    row = state["rows"][index]
    if len(row["cards"]) < 7 - len(row["sleeping"]):
        return False
    if row["sleeping"]:
        state["phase"] = "revival"
        state["pending_row"] = index
        return True
    row["closed"] = True
    _note(state, f"{FIELDS[row['field']]['icon']} 第 {index + 1} 行第四圈完成。")
    if index == 0 and any(not item["closed"] for item in state["rows"][1:]):
        state["phase"] = "camp_choice"
        return True
    if index == 1:
        state["hearts"] = 3
        _note(state, "❤️ 三颗心全部恢复。")
    if index == 2:
        _star(state, "bottom_row")
    return False


def _use_ability(state: Dict, pid: str, card: Dict, options: Dict) -> bool:
    ability = card["ability"]
    hand = state["players"][pid]["hand"]
    _log(state, f"✨ {ETERNALS[card['source']]['name']}：{ETERNALS[card['source']]['effect']}")
    if ability == "star":
        state["stage_cards"].append(card)
    elif ability == "swap" and options:
        row = state["rows"][options["row"]]
        taken = row["cards"][options["slot"]]
        # A returned numbered/rare card is once again a hand card.
        taken.pop("orientation", None)
        hand.append(taken)
        row["cards"][options["slot"]] = {**card, "as_rare": True}
    else:
        state["discard"].append(card)
        if ability == "heal":
            state["hearts"] = min(3, state["hearts"] + 1)
        elif ability == "reveal":
            state["hands_revealed"] = True
            state["discussion_ready"] = []
            state["phase"] = "discussion"
            return True
        elif ability == "jewel" and options:
            _give_jewel(state, options["recipe"], options["target"])
        elif ability == "recycle" and options:
            restored = next(item for item in state["discard"] if item["id"] == options["card_id"])
            state["discard"].remove(restored)
            restored.pop("orientation", None)
            state["river_rewards"].append(restored)
            _note(state, "🐍 一张 Rare 回到河流奖励顶。")
        elif ability == "retrieve":
            selected = set(options["card_ids"])
            hand.extend(item for item in state["river"] if item["id"] in selected)
            state["river"] = [item for item in state["river"] if item["id"] not in selected]
    return False


class EternalDecksGame:
    game_id = "eternal_decks"
    min_players = 2
    max_players = 4
    supported_player_counts = (2, 4)

    @staticmethod
    def init_game(config: Optional[Dict], players: List[Dict]) -> Dict:
        config = {} if config is None else config
        if not isinstance(config, dict) or not _CONFIG_VALIDATOR.is_valid(config):
            raise ValueError("invalid Eternal Decks configuration")
        if len(players) not in (2, 4):
            raise ValueError("Eternal Decks currently supports 2 or 4 seats; the 3-player jewel card is not verified. Add or remove a bot.")
        ids = [player.get("player_id") for player in players]
        if any(not isinstance(pid, str) or not pid for pid in ids) or len(set(ids)) != len(ids):
            raise ValueError("player IDs must be unique nonempty strings")
        ordered = sorted(players, key=lambda player: player.get("seat", 0))
        seed = config.get("seed", secrets.token_hex(16))
        rng = random.Random(seed)

        def instantiate(definition: Dict) -> Dict:
            return {"id": f"ed{rng.getrandbits(128):032x}", **copy.deepcopy(definition)}

        state = {
            "game_id": EternalDecksGame.game_id, "config": copy.deepcopy(config), "seed": seed,
            "phase": "setup", "turn_order": [player["player_id"] for player in ordered],
            "players": {}, "player_meta": {}, "current_turn": None, "start_player": ordered[0]["player_id"],
            "ready": [], "next_ready": [], "next_player": None, "turn_count": 0,
            "rows": [{"field": field, "cards": [], "sleeping": [f"{series}{i}" for i in (1, 2, 3)],
                      "lap": 1, "closed": False} for field, series in zip(FIELDS, "ABC")],
            "eternal_decks": {}, "revived": [], "hearts": 3, "river": [], "river_rewards": [],
            "river_failed": False, "discard": [], "stage_cards": [], "stars": [],
            "jewels": {recipe: True for recipe in RECIPES}, "pending_row": None,
            "turn_notes": [], "review_cards": [], "hands_revealed": False, "discussion_ready": [],
            "log": [], "result": None, "game_over": False,
        }
        for index, player in enumerate(ordered):
            pid = player["player_id"]
            state["player_meta"][pid] = {"name": player.get("name", pid), "seat": player.get("seat", index),
                                         "is_bot": bool(player.get("is_bot", False)), "color": COLORS[index]}
            deck = [instantiate({"kind": "number", "number": value, "colors": [COLORS[index]], "starting": True})
                    for value in range(1, 6)]
            rng.shuffle(deck)
            if len(ordered) == 2:
                extra = [instantiate({"kind": "number", "number": value, "colors": [COLORS[index + 2]], "starting": True})
                         for value in range(1, 6)]
                rng.shuffle(extra)
                deck.extend(extra[:2])
            state["players"][pid] = {"hand": [], "deck": deck,
                                      "discs": [{"position": -1, "seq": 0} for _ in range(2)]}
            _draw(state, pid)
        for eid in ETERNALS:
            deck = [instantiate(card) for card in deck_manifest(eid)]
            rng.shuffle(deck)
            state["eternal_decks"][eid] = deck
        state["river_rewards"] = [instantiate({"kind": "rare", "colors": []}) for _ in range(3)]
        _log(state, "Stage A · Beginner · Prototype card data · 先选择起始玩家，再全员 Ready。")
        return state

    @staticmethod
    def get_legal_actions(state: Dict, player_id: str) -> List[str]:
        if player_id not in state["players"] or state["game_over"]:
            return []
        actions = ["move_disc"]
        phase = state["phase"]
        if phase == "setup":
            if player_id not in state["ready"]:
                actions += ["ready", "choose_start"]
        elif phase == "round_end":
            if player_id not in state["next_ready"]:
                actions.append("next_round")
        elif phase == "discussion":
            if player_id not in state["discussion_ready"]:
                actions.append("end_discussion")
        elif state["current_turn"] == player_id:
            if phase == "playing":
                actions += sorted({action["type"] for action in _main_actions(state, player_id)})
            else:
                actions += {"revival": ["revive"], "camp_choice": ["camp"],
                            "discussion": ["end_discussion"]}.get(phase, [])
        return actions

    @staticmethod
    def apply_action(state: Dict, player_id: str, action: Dict) -> Tuple[List[Dict], Optional[str]]:
        if not isinstance(action, dict) or not _ACTION_VALIDATOR.is_valid(action):
            return [], "invalid Eternal Decks action"
        # JSON Schema treats 1.0 as an integer; list indices and sequence
        # counters must still be actual Python ints, including direct calls.
        for container in (action, action.get("options", {})):
            if any(key in container and type(container[key]) is not int
                   for key in ("row", "slot", "disc", "position", "seq")):
                return [], "indices and sequence numbers must be integers"
        kind = action["type"]
        if kind not in EternalDecksGame.get_legal_actions(state, player_id):
            return [], "action is not available to this player now"
        # Validate against the exact server-generated options before any mutation.
        if kind in ("place", "river", "give", "generate", "ability"):
            action = copy.deepcopy(action)
            if kind == "generate":
                action["card_ids"].sort()
            if kind == "ability" and "card_ids" in action["options"]:
                selected = action["options"]["card_ids"]
                if not isinstance(selected, list) or any(not isinstance(cid, str) for cid in selected):
                    return [], "invalid ability targets"
                # Canonicalize selections without accepting duplicate targets.
                order = {card["id"]: i for i, card in enumerate(state["river"])}
                selected.sort(key=lambda cid: order.get(cid, -1))
            if action not in _main_actions(state, player_id):
                return [], "illegal cards, target, field, jewel recipe or ability options"
        if kind == "choose_start" and action["player_id"] not in state["players"]:
            return [], "choose a player in this game"
        if kind == "revive" and action["eternal_id"] not in state["rows"][state["pending_row"]]["sleeping"]:
            return [], "choose an Eternal sleeping in the completed row"
        if kind == "camp" and (action["row"] == 0 or state["rows"][action["row"]]["closed"]):
            return [], "choose another open row"
        if kind == "move_disc":
            disc = state["players"][player_id]["discs"][action["disc"]]
            if action["seq"] <= disc["seq"]:
                return [], "stale communication disc update"

        pid = player_id
        player = state["players"][pid]
        if kind == "move_disc":
            disc.update({"position": action["position"], "seq": action["seq"]})
        elif kind == "choose_start":
            if state["start_player"] != action["player_id"]:
                state["start_player"] = action["player_id"]
                state["ready"] = []
        elif kind == "ready":
            state["ready"].append(pid)
            if len(state["ready"]) == len(state["players"]):
                _start_turn(state, state["start_player"])
        elif kind == "next_round":
            state["next_ready"].append(pid)
            if len(state["next_ready"]) == len(state["players"]):
                state["turn_notes"] = []
                state["review_cards"] = []
                _start_turn(state, state["next_player"])
        elif kind == "end_discussion":
            state["discussion_ready"].append(pid)
            if len(state["discussion_ready"]) == len(state["players"]):
                _finish_turn(state, state["current_turn"])
        elif kind == "revive":
            eid = action["eternal_id"]
            index = state["pending_row"]
            row = state["rows"][index]
            row["sleeping"].remove(eid)
            state["review_cards"].append({"label": f"第 {index + 1} 行 · 第 {row['lap']} 圈", "cards": copy.deepcopy(row["cards"])})
            state["discard"].extend(row["cards"])
            row["cards"] = []
            row["lap"] += 1
            player["deck"].extend(state["eternal_decks"].pop(eid))
            state["revived"].append({"id": eid, "owner": pid, "jewel": None})
            state["pending_row"] = None
            _note(state, f"{ETERNALS[eid]['icon']} {state['player_meta'][pid]['name']} 复苏{ETERNALS[eid]['name']}，取得 8 张牌；{ETERNALS[eid]['curse']}。")
            _finish_turn(state, pid)
        elif kind == "camp":
            state["rows"][action["row"]]["field"] = "camp"
            _note(state, f"⛺ 第 {action['row'] + 1} 行改为营地。")
            _finish_turn(state, pid)
        else:
            state["turn_notes"] = []
            state["review_cards"] = []
            if kind == "generate":
                cards = [card for card in player["hand"] if card["id"] in action["card_ids"]]
                for card in cards:
                    player["hand"].remove(card)
                state["river"].extend(cards)
                _give_jewel(state, action["recipe"], action["target"])
                _resolve_river(state, pid)
            else:
                card = next(card for card in player["hand"] if card["id"] == action["card_id"])
                player["hand"].remove(card)
                if kind == "place":
                    row = state["rows"][action["row"]]
                    row["cards"].append({**card, "orientation": action["orientation"]})
                    _log(state, f"{state['player_meta'][pid]['name']} → 第 {action['row'] + 1} 行。")
                    if _complete_row(state, pid, action["row"]):
                        return [{"type": "eternal_decks:update", "payload": {"actor": pid, "action": kind}}], None
                elif kind == "river":
                    state["river"].append(card)
                    _log(state, f"{state['player_meta'][pid]['name']} → 🌊 生命之河。")
                    _resolve_river(state, pid)
                elif kind == "give":
                    state["players"][action["target"]]["hand"].append(card)
                    state["hearts"] -= 1
                    _log(state, f"❤️ {state['player_meta'][pid]['name']} 给 {state['player_meta'][action['target']]['name']} 一张暗牌。")
                elif kind == "ability" and _use_ability(state, pid, card, action["options"]):
                    return [{"type": "eternal_decks:update", "payload": {"actor": pid, "action": kind}}], None
            _finish_turn(state, pid)
        return [{"type": "eternal_decks:update", "payload": {"actor": pid, "action": kind}}], None

    @staticmethod
    def get_public_view(state: Dict, viewer_id: str) -> Dict:
        own_turn = state["phase"] == "playing" and state["current_turn"] == viewer_id
        legal = EternalDecksGame.get_legal_actions(state, viewer_id)
        players = []
        for pid in state["turn_order"]:
            player = state["players"][pid]
            players.append({"player_id": pid, **state["player_meta"][pid],
                            "hand": copy.deepcopy(player["hand"]) if pid == viewer_id or state["hands_revealed"] else [],
                            "hand_count": len(player["hand"]), "deck_count": len(player["deck"]),
                            "discs": copy.deepcopy(player["discs"])})
        moves = _main_actions(state, viewer_id) if own_turn else []
        checks = []
        if own_turn:
            for card in state["players"][viewer_id]["hand"]:
                for row in range(3):
                    for orientation in (["normal", "rotated"] if len(card["colors"]) == 2 else ["normal"]):
                        reason = field_reason(state, card, row, orientation)
                        checks.append({"card_id": card["id"], "row": row, "orientation": orientation,
                                       "reason": REASONS.get(reason, "可以放在这一行。"), "legal": reason is None})
        # Strict discard hides the pile, but Medusa's explicit effect may inspect
        # eligible Rare cards. Those cards are exposed only to its current user.
        eligible = {move["options"].get("card_id") for move in moves if move["type"] == "ability"}
        strict = state["config"].get("strict_discard", False)
        discarded = [card for card in state["discard"] if not strict or card["id"] in eligible]
        return {
            "game_id": EternalDecksGame.game_id, "you": viewer_id, "phase": state["phase"],
            "prototype": True, "stage": "A", "players": players, "current_turn": state["current_turn"],
            "start_player": state["start_player"], "ready": list(state["ready"]),
            "rows": copy.deepcopy(state["rows"]), "revived": copy.deepcopy(state["revived"]),
            "hearts": state["hearts"], "stars": list(state["stars"]), "star_goals": dict(STARS),
            "jewels": dict(state["jewels"]), "recipes": copy.deepcopy(RECIPES),
            "river": copy.deepcopy(state["river"]), "river_reward_count": len(state["river_rewards"]),
            "river_failed": state["river_failed"], "discard": copy.deepcopy(discarded),
            "discard_count": len(state["discard"]), "strict_discard": strict,
            "stage_card_count": len(state["stage_cards"]), "hands_revealed": state["hands_revealed"],
            "discussion_ready": list(state["discussion_ready"]),
            "pending_row": state["pending_row"], "turn_count": state["turn_count"],
            "next_ready": list(state["next_ready"]), "next_player": state["next_player"],
            "review_notes": list(state["turn_notes"]), "review_cards": copy.deepcopy(state["review_cards"]),
            "result": copy.deepcopy(state["result"]), "game_over": state["game_over"],
            "log": list(state["log"]), "legal_actions": legal, "moves": moves, "field_checks": checks,
            "fields": copy.deepcopy(FIELDS), "eternals": {eid: {**copy.deepcopy(data), "deck": deck_manifest(eid)}
                                                           for eid, data in ETERNALS.items()},
        }

    @staticmethod
    def bot_move(state: Dict, bot_id: str) -> Optional[Dict]:
        return _bot_from_view(EternalDecksGame.get_public_view(state, bot_id))

    @staticmethod
    def serialize(state: Dict) -> Dict:
        return copy.deepcopy(state)

    @staticmethod
    def deserialize(payload: Dict) -> Dict:
        return copy.deepcopy(payload)


def _bot_from_view(view: Dict) -> Optional[Dict]:
    """No access to private decks, seeds, or other players' unrevealed cards."""
    legal = view["legal_actions"]
    for kind in ("ready", "next_round", "end_discussion"):
        if kind in legal:
            return {"type": kind}
    if "revive" in legal:
        ids = view["rows"][view["pending_row"]]["sleeping"]
        return {"type": "revive", "eternal_id": min(ids, key=lambda eid: {"B3": 10, "C1": 5, "C2": 5, "C3": 5}.get(eid, 0))}
    if "camp" in legal:
        return {"type": "camp", "row": next(i for i in (1, 2) if not view["rows"][i]["closed"])}
    if not view["moves"]:
        return None
    own = next(player for player in view["players"] if player["player_id"] == view["you"])
    cards = {card["id"]: card for card in own["hand"]}
    supply = own["hand_count"] + own["deck_count"]
    poorest = min(player["hand_count"] + player["deck_count"] for player in view["players"])

    def score(move: Dict) -> float:
        kind = move["type"]
        card = cards.get(move.get("card_id"), {})
        if kind == "generate":
            target = next(i for i, item in enumerate(view["revived"]) if item["id"] == move["target"])
            star = move["recipe"] == "one_five_nine"
            cost = len(move["card_ids"])
            # Spending the last cards on a gem can starve this seat. Public
            # card counts are enough to avoid it; no teammate hand inspection.
            scarcity = 55 if supply - cost < 3 and not (star and len(view["stars"]) == 3) else 0
            return 75 + (35 if star else 0) - cost * 5 - target - scarcity
        if kind == "place":
            row = view["rows"][move["row"]]
            finish = len(row["cards"]) + 1 == 7 - len(row["sleeping"])
            value = card.get("number", 5)
            reserve = (10 - value if row["field"] == "mountain" else value) if row["field"] != "camp" else 2
            reward = 100 if finish and supply <= 4 else 75 if finish else 0
            if finish and row["sleeping"] and supply >= 7 and poorest < 4:
                reward = -20  # Leave a near-complete deck for the hungry seat.
            return 35 + len(row["cards"]) * 4 + reserve + reward - (9 if _wild(card) else 0)
        if kind == "ability":
            ability = card["ability"]
            option = move["options"]
            if ability == "jewel":
                return 110 if option else -15
            if ability == "star":
                return 100 if view["stage_card_count"] == 2 else 48
            if ability == "retrieve":
                return 60 + len(option["card_ids"]) * 8
            if ability == "recycle":
                return 65 if option else -15
            if ability == "heal":
                return 52 if view["hearts"] < 3 else 5
            if ability == "swap":
                return 51 if option else -15
            return 8
        if kind == "give":
            target = next(player for player in view["players"] if player["player_id"] == move["target"])
            remaining = target["hand_count"] + target["deck_count"]
            return 120 if target["hand_count"] == 0 else 85 if remaining <= 2 and supply >= 5 else -20
        return 0 if view["river_reward_count"] else -100

    return max(view["moves"], key=score)
