import random
from typing import Dict, List, Optional, Tuple


CARD_FIRST_FINDER = "first_finder"
CARD_CRIMINAL = "criminal"
CARD_DETECTIVE = "detective"
CARD_ALIBI = "alibi"
CARD_DOG = "dog"
CARD_ACCOMPLICE = "accomplice"
CARD_WITNESS = "witness"
CARD_INFO_CONTROL = "info_control"
CARD_RUMOR = "rumor"
CARD_TRADE = "trade"
CARD_BOY = "boy"
CARD_CIVILIAN = "civilian"
CARD_CHIEF = "chief"

SUPPORTED_DETECTIVE_RULES = {"hand_leq_3", "round_ge_2", "always"}
SUPPORTED_DOG_FAIL_BEHAVIOR = {"discard", "give_to_target"}
SUPPORTED_BOY_VISIBILITY_MODE = {"boy_knows_criminal", "mutual"}

BASE_CARD_COUNTS = {
    CARD_FIRST_FINDER: 1,
    CARD_CRIMINAL: 1,
    CARD_DOG: 1,
    CARD_BOY: 1,
    CARD_CIVILIAN: 2,
    CARD_ACCOMPLICE: 2,
    CARD_WITNESS: 3,
    CARD_INFO_CONTROL: 3,
    CARD_DETECTIVE: 4,
    CARD_RUMOR: 4,
    CARD_ALIBI: 5,
    CARD_TRADE: 5,
}

MANDATORY_BY_PLAYER_COUNT = {
    3: {CARD_DETECTIVE: 1, CARD_ALIBI: 1, CARD_ACCOMPLICE: 0},
    4: {CARD_DETECTIVE: 1, CARD_ALIBI: 1, CARD_ACCOMPLICE: 1},
    5: {CARD_DETECTIVE: 1, CARD_ALIBI: 2, CARD_ACCOMPLICE: 1},
    6: {CARD_DETECTIVE: 2, CARD_ALIBI: 2, CARD_ACCOMPLICE: 2},
    7: {CARD_DETECTIVE: 2, CARD_ALIBI: 3, CARD_ACCOMPLICE: 2},
    8: {CARD_DETECTIVE: 2, CARD_ALIBI: 3, CARD_ACCOMPLICE: 2},
}

DEFAULT_CONFIG = {
    "enable_boy": True,
    "enable_chief": False,
    "detective_activation_rule": "hand_leq_3",
    "dog_fail_behavior": "discard",
    "boy_visibility_mode": "boy_knows_criminal",
    "scoring_enabled": True,
    "target_score_by_player_count": {3: 5, 4: 5, 5: 7, 6: 10, 7: 10, 8: 10},
}


def _ordered_players(players: List[Dict]) -> List[Dict]:
    return sorted(players, key=lambda item: int(item.get("seat", 0)))


def _normalize_target_scores(raw: object) -> Dict[int, int]:
    result = dict(DEFAULT_CONFIG["target_score_by_player_count"])
    if not isinstance(raw, dict):
        return result
    for key, value in raw.items():
        try:
            count = int(key)
            score = int(value)
        except (TypeError, ValueError):
            continue
        if 3 <= count <= 8 and score >= 1:
            result[count] = score
    return result


def _normalize_config(config: Optional[Dict]) -> Dict:
    merged = dict(DEFAULT_CONFIG)
    if isinstance(config, dict):
        merged.update(config)
    detective_rule = merged.get("detective_activation_rule")
    if detective_rule not in SUPPORTED_DETECTIVE_RULES:
        detective_rule = DEFAULT_CONFIG["detective_activation_rule"]
    dog_fail_behavior = merged.get("dog_fail_behavior")
    if dog_fail_behavior not in SUPPORTED_DOG_FAIL_BEHAVIOR:
        dog_fail_behavior = DEFAULT_CONFIG["dog_fail_behavior"]
    boy_visibility_mode = merged.get("boy_visibility_mode")
    if boy_visibility_mode not in SUPPORTED_BOY_VISIBILITY_MODE:
        boy_visibility_mode = DEFAULT_CONFIG["boy_visibility_mode"]
    return {
        "enable_boy": bool(merged.get("enable_boy", True)),
        "enable_chief": bool(merged.get("enable_chief", False)),
        "detective_activation_rule": detective_rule,
        "dog_fail_behavior": dog_fail_behavior,
        "boy_visibility_mode": boy_visibility_mode,
        "scoring_enabled": bool(merged.get("scoring_enabled", True)),
        "target_score_by_player_count": _normalize_target_scores(merged.get("target_score_by_player_count")),
    }


def _build_round_deck(config: Dict, player_count: int) -> List[Dict]:
    card_counts = dict(BASE_CARD_COUNTS)
    if not config.get("enable_boy"):
        card_counts.pop(CARD_BOY, None)
    if config.get("enable_chief"):
        card_counts[CARD_CHIEF] = 1
    total_needed = player_count * 4
    while sum(card_counts.values()) < total_needed:
        card_counts[CARD_CIVILIAN] = int(card_counts.get(CARD_CIVILIAN, 0)) + 1
    deck: List[Dict] = []
    next_id = 1
    for card_type, count in card_counts.items():
        for _ in range(int(count)):
            deck.append({"id": f"cd_{next_id:03d}", "type": card_type})
            next_id += 1
    random.shuffle(deck)
    return deck


def _find_and_take_one(deck: List[Dict], card_type: str) -> Optional[Dict]:
    for idx, card in enumerate(deck):
        if card["type"] == card_type:
            return deck.pop(idx)
    return None


def _deal_round_hands(config: Dict, player_ids: List[str]) -> Dict[str, List[Dict]]:
    player_count = len(player_ids)
    total_needed = player_count * 4
    deck = _build_round_deck(config, player_count)
    selected: List[Dict] = []
    mandatory = MANDATORY_BY_PLAYER_COUNT.get(player_count, MANDATORY_BY_PLAYER_COUNT[8])

    for required in (CARD_FIRST_FINDER, CARD_CRIMINAL):
        picked = _find_and_take_one(deck, required)
        if picked:
            selected.append(picked)
    for card_type in (CARD_DETECTIVE, CARD_ALIBI, CARD_ACCOMPLICE):
        need = int(mandatory.get(card_type, 0))
        for _ in range(need):
            picked = _find_and_take_one(deck, card_type)
            if picked:
                selected.append(picked)
    while len(selected) < total_needed and deck:
        selected.append(deck.pop())
    random.shuffle(selected)

    hands = {pid: [] for pid in player_ids}
    for idx, card in enumerate(selected):
        hands[player_ids[idx % player_count]].append(card)
    return hands


def _player_name(state: Dict, player_id: Optional[str]) -> str:
    if not player_id:
        return "-"
    return state["player_meta"].get(player_id, {}).get("name") or player_id


def _hand_has_type(hand: List[Dict], card_type: str) -> bool:
    return any(card["type"] == card_type for card in hand)


def _find_criminal_holder(state: Dict) -> Optional[str]:
    for pid in state["player_order"]:
        if _hand_has_type(state["players"][pid]["hand"], CARD_CRIMINAL):
            return pid
    return None


def _detective_is_active(state: Dict, hand_size_before: int) -> bool:
    rule = state["config"]["detective_activation_rule"]
    if rule == "always":
        return True
    if rule == "round_ge_2":
        return int(state["round_number"]) >= 2
    return hand_size_before <= 3


def _push_private_note(state: Dict, player_id: str, text: str) -> None:
    state["players"][player_id]["private_log"].append(text)


def _begin_round(state: Dict, keep_scores: bool) -> None:
    player_ids = list(state["player_order"])
    hands = _deal_round_hands(state["config"], player_ids)
    for pid in player_ids:
        score = int(state["players"][pid]["score"]) if keep_scores else 0
        state["players"][pid] = {
            "hand": list(hands.get(pid, [])),
            "score": score,
            "is_accomplice": False,
            "private_log": [],
        }

    state["discard"] = []
    state["played"] = []
    state["chief_marks"] = {}
    state["winner_mode"] = None
    state["winner_ids"] = []
    state["game_over"] = False
    state["match_over"] = False
    state["last_summary"] = ""

    first_player = None
    for pid in player_ids:
        if _hand_has_type(state["players"][pid]["hand"], CARD_FIRST_FINDER):
            first_player = pid
            break
    state["current_turn_index"] = player_ids.index(first_player) if first_player in player_ids else 0
    state["current_player_id"] = player_ids[state["current_turn_index"]] if player_ids else None

    boy_holders = [pid for pid in player_ids if _hand_has_type(state["players"][pid]["hand"], CARD_BOY)]
    criminal_holder = _find_criminal_holder(state)
    if criminal_holder and boy_holders:
        for boy_pid in boy_holders:
            _push_private_note(state, boy_pid, f"You are Boy. Criminal is {_player_name(state, criminal_holder)}.")
        if state["config"]["boy_visibility_mode"] == "mutual":
            _push_private_note(state, criminal_holder, "Boy knows your identity.")


def _advance_turn(state: Dict) -> None:
    order = state["player_order"]
    if not order:
        state["current_player_id"] = None
        return
    start_idx = int(state["current_turn_index"])
    for step in range(1, len(order) + 1):
        idx = (start_idx + step) % len(order)
        pid = order[idx]
        if state["players"][pid]["hand"]:
            state["current_turn_index"] = idx
            state["current_player_id"] = pid
            return
    state["current_player_id"] = None


def _apply_scores(state: Dict, winner_mode: str, winner_ids: List[str], criminal_holder_id: Optional[str]) -> None:
    if not state["config"]["scoring_enabled"]:
        return
    scores = {pid: 0 for pid in state["player_order"]}
    if winner_mode == "detective":
        winner_id = winner_ids[0] if winner_ids else None
        for pid in scores:
            if pid == winner_id:
                scores[pid] = 2
            elif criminal_holder_id and pid == criminal_holder_id:
                scores[pid] = 0
            else:
                scores[pid] = 1
    elif winner_mode in ("dog", "chief"):
        winner_id = winner_ids[0] if winner_ids else None
        for pid in scores:
            if pid == winner_id:
                scores[pid] = 3
            elif criminal_holder_id and pid == criminal_holder_id:
                scores[pid] = 0
            else:
                scores[pid] = 1
    elif winner_mode == "criminal":
        for pid in winner_ids:
            if pid in scores:
                scores[pid] = 2
    for pid, delta in scores.items():
        state["players"][pid]["score"] = int(state["players"][pid]["score"]) + int(delta)


def _end_round(state: Dict, winner_mode: str, winner_ids: List[str], summary: str) -> None:
    criminal_holder = _find_criminal_holder(state)
    state["winner_mode"] = winner_mode
    state["winner_ids"] = list(winner_ids)
    state["last_summary"] = summary
    _apply_scores(state, winner_mode, winner_ids, criminal_holder)
    if not state["config"]["scoring_enabled"]:
        state["game_over"] = True
        state["match_over"] = True
        return
    target = int(state["config"]["target_score_by_player_count"].get(len(state["player_order"]), 7))
    max_score = max(int(state["players"][pid]["score"]) for pid in state["player_order"])
    if max_score >= target:
        state["game_over"] = True
        state["match_over"] = True
    else:
        state["game_over"] = True
        state["match_over"] = False


def _remove_card_from_hand(state: Dict, player_id: str, card_id: str) -> Optional[Dict]:
    hand = state["players"][player_id]["hand"]
    for idx, card in enumerate(hand):
        if card["id"] == card_id:
            return hand.pop(idx)
    return None


def _is_card_playable(state: Dict, player_id: str, card: Dict) -> bool:
    hand = state["players"][player_id]["hand"]
    card_type = card["type"]
    has_first = any(c["type"] == CARD_FIRST_FINDER for c in hand)
    played_this_round = any(entry["player_id"] == player_id for entry in state["played"])
    if has_first and not played_this_round and card_type != CARD_FIRST_FINDER:
        return False
    if card_type == CARD_CRIMINAL and len(hand) != 1:
        return False
    if card_type == CARD_DOG:
        return any(len(state["players"][pid]["hand"]) > 0 for pid in state["player_order"] if pid != player_id)
    if card_type == CARD_WITNESS:
        return any(len(state["players"][pid]["hand"]) > 0 for pid in state["player_order"] if pid != player_id)
    # Trade is still considered playable when it is your only card: the played trade card
    # can be the card you give away.
    return True


def _same_time_left_pass(state: Dict) -> None:
    order = state["player_order"]
    chosen: Dict[str, Optional[Dict]] = {}
    for pid in order:
        hand = state["players"][pid]["hand"]
        chosen[pid] = hand.pop(random.randrange(len(hand))) if hand else None
    for idx, pid in enumerate(order):
        incoming = chosen.get(order[(idx - 1) % len(order)])
        if incoming:
            state["players"][pid]["hand"].append(incoming)


def _same_time_right_draw(state: Dict) -> None:
    order = state["player_order"]
    donors: Dict[str, List[Dict]] = {pid: list(state["players"][pid]["hand"]) for pid in order}
    taken_index: Dict[str, Optional[int]] = {}
    for idx, pid in enumerate(order):
        donor_id = order[(idx + 1) % len(order)]
        donor_cards = donors[donor_id]
        taken_index[pid] = random.randrange(len(donor_cards)) if donor_cards else None
    for idx, pid in enumerate(order):
        donor_id = order[(idx + 1) % len(order)]
        donor_hand = state["players"][donor_id]["hand"]
        pick = taken_index[pid]
        if pick is None or pick >= len(donor_hand):
            continue
        state["players"][pid]["hand"].append(donor_hand.pop(pick))


def _remove_last_discard_card(state: Dict, card_id: str) -> Optional[Dict]:
    for idx in range(len(state["discard"]) - 1, -1, -1):
        if state["discard"][idx]["id"] == card_id:
            return state["discard"].pop(idx)
    return None


def _remove_last_played_entry(state: Dict, card_id: str) -> None:
    for idx in range(len(state["played"]) - 1, -1, -1):
        entry = state["played"][idx]
        if isinstance(entry, dict) and isinstance(entry.get("card"), dict) and entry["card"].get("id") == card_id:
            state["played"].pop(idx)
            return


class CriminalDanceGame:
    game_id = "criminal_dance"
    min_players = 3
    max_players = 8

    @staticmethod
    def init_game(config: Optional[Dict], players: List[Dict]) -> Dict:
        ordered = _ordered_players(players)
        cfg = _normalize_config(config)
        player_order = [p["player_id"] for p in ordered]
        player_meta = {p["player_id"]: p for p in ordered}
        state = {
            "config": cfg,
            "player_order": player_order,
            "player_meta": player_meta,
            "players": {pid: {"hand": [], "score": 0, "is_accomplice": False, "private_log": []} for pid in player_order},
            "current_turn_index": 0,
            "current_player_id": player_order[0] if player_order else None,
            "round_number": 1,
            "discard": [],
            "played": [],
            "chief_marks": {},
            "winner_mode": None,
            "winner_ids": [],
            "last_summary": "",
            "game_over": False,
            "match_over": False,
        }
        _begin_round(state, keep_scores=False)
        return state

    @staticmethod
    def get_legal_actions(state: Dict, player_id: str) -> List[str]:
        if state.get("game_over"):
            return ["play_again"]
        if player_id != state.get("current_player_id"):
            return []
        if not state["players"].get(player_id, {}).get("hand"):
            return []
        hand = state["players"][player_id]["hand"]
        if not any(_is_card_playable(state, player_id, card) for card in hand):
            return []
        return ["play_card"]

    @staticmethod
    def apply_action(state: Dict, player_id: str, action: Dict) -> Tuple[List[Dict], Optional[str]]:
        action_type = action.get("type")
        if action_type == "play_again":
            if not state.get("game_over"):
                return [], "round is still running"
            keep_scores = not bool(state.get("match_over"))
            state["round_number"] = 1 if not keep_scores else int(state["round_number"]) + 1
            _begin_round(state, keep_scores=keep_scores)
            return [{"type": "criminal_dance:play_again", "payload": {"round_number": state["round_number"]}}], None
        if state.get("game_over"):
            return [], "round over"
        if player_id != state.get("current_player_id"):
            return [], "not your turn"
        if action_type != "play_card":
            return [], "invalid action"

        card_id = action.get("card_id")
        if not isinstance(card_id, str) or not card_id:
            return [], "card_id required"
        hand_now = state["players"][player_id]["hand"]
        has_first = any(c["type"] == CARD_FIRST_FINDER for c in hand_now)
        played_this_round = any(entry["player_id"] == player_id for entry in state["played"])
        if has_first and not played_this_round:
            selected = next((c for c in hand_now if c["id"] == card_id), None)
            if selected and selected["type"] != CARD_FIRST_FINDER:
                return [], "must play first finder first"
        hand_before = len(state["players"][player_id]["hand"])
        card = _remove_card_from_hand(state, player_id, card_id)
        if not card:
            return [], "card not in hand"
        card_type = card["type"]
        if card_type == CARD_CRIMINAL and hand_before != 1:
            state["players"][player_id]["hand"].append(card)
            return [], "criminal can only be played as last card"
        state["played"].append({"player_id": player_id, "card": card})
        state["discard"].append(card)
        events: List[Dict] = [{"type": "criminal_dance:play_card", "payload": {"player_id": player_id, "card_type": card_type}}]

        if card_type == CARD_ACCOMPLICE:
            state["players"][player_id]["is_accomplice"] = True
        elif card_type == CARD_WITNESS:
            target_id = action.get("target_player_id")
            if target_id not in state["players"] or target_id == player_id:
                return [], "valid target_player_id required"
            hand_types = [c["type"] for c in state["players"][target_id]["hand"]]
            _push_private_note(state, player_id, f"Witness: {_player_name(state, target_id)} has {hand_types}.")
        elif card_type == CARD_INFO_CONTROL:
            _same_time_left_pass(state)
        elif card_type == CARD_RUMOR:
            _same_time_right_draw(state)
        elif card_type == CARD_TRADE:
            target_id = action.get("target_player_id")
            if target_id not in state["players"] or target_id == player_id:
                return [], "valid target_player_id required"
            target_hand = state["players"][target_id]["hand"]
            your_hand = state["players"][player_id]["hand"]
            if not target_hand:
                return [], "target has no cards"
            your_pick_id = action.get("your_card_id")
            your_card = _remove_card_from_hand(state, player_id, your_pick_id) if isinstance(your_pick_id, str) else None
            if not your_card:
                if your_hand:
                    your_card = your_hand.pop(random.randrange(len(your_hand)))
                else:
                    # Trade is the last hand card: give the played Trade card itself.
                    your_card = _remove_last_discard_card(state, card["id"])
                    _remove_last_played_entry(state, card["id"])
                    if not your_card:
                        return [], "you have no card to trade"
            target_pick_id = action.get("target_card_id")
            target_card = _remove_card_from_hand(state, target_id, target_pick_id) if isinstance(target_pick_id, str) else None
            if not target_card:
                target_card = target_hand.pop(random.randrange(len(target_hand)))
            state["players"][player_id]["hand"].append(target_card)
            state["players"][target_id]["hand"].append(your_card)
        elif card_type == CARD_DETECTIVE:
            target_id = action.get("target_player_id")
            if target_id not in state["players"] or target_id == player_id:
                return [], "valid target_player_id required"
            if _detective_is_active(state, hand_before):
                target_hand = state["players"][target_id]["hand"]
                has_criminal = _hand_has_type(target_hand, CARD_CRIMINAL)
                if has_criminal and not _hand_has_type(target_hand, CARD_ALIBI):
                    _end_round(state, "detective", [player_id], f"{_player_name(state, player_id)} caught the criminal.")
                elif has_criminal:
                    events.append({"type": "criminal_dance:alibi_block", "payload": {"player_id": target_id}})
            else:
                events.append({"type": "criminal_dance:detective_inactive", "payload": {"player_id": player_id}})
        elif card_type == CARD_DOG:
            target_id = action.get("target_player_id")
            if target_id not in state["players"] or target_id == player_id:
                return [], "valid target_player_id required"
            target_hand = state["players"][target_id]["hand"]
            if not target_hand:
                return [], "target has no cards"
            pick = target_hand[random.randrange(len(target_hand))]
            events.append({"type": "criminal_dance:dog_reveal", "payload": {"target_id": target_id, "card_type": pick["type"]}})
            if pick["type"] == CARD_CRIMINAL:
                _end_round(state, "dog", [player_id], f"{_player_name(state, player_id)} used Dog to catch the criminal.")
            elif state["config"]["dog_fail_behavior"] == "give_to_target":
                moved_dog = None
                if state["discard"] and state["discard"][-1]["id"] == card["id"]:
                    moved_dog = state["discard"].pop()
                if moved_dog:
                    state["players"][target_id]["hand"].append(moved_dog)
        elif card_type == CARD_CHIEF:
            target_id = action.get("target_player_id")
            if target_id not in state["players"] or target_id == player_id:
                return [], "valid target_player_id required"
            state["chief_marks"][player_id] = target_id
        elif card_type == CARD_CRIMINAL:
            criminal_team = [pid for pid in state["player_order"] if state["players"][pid]["is_accomplice"]]
            criminal_team.append(player_id)
            _end_round(state, "criminal", criminal_team, f"{_player_name(state, player_id)} escaped with Criminal.")

        if not state.get("game_over"):
            _advance_turn(state)
            if state["current_player_id"] is None:
                chief_winner = None
                holder = _find_criminal_holder(state)
                for chief_player, marked_player in state["chief_marks"].items():
                    if holder and marked_player == holder:
                        chief_winner = chief_player
                        break
                if chief_winner:
                    _end_round(state, "chief", [chief_winner], f"{_player_name(state, chief_winner)} wins by Chief mark.")
                else:
                    _end_round(state, "criminal", [], "Round ended with no legal turns left.")
        return events, None

    @staticmethod
    def get_public_view(state: Dict, viewer_id: str) -> Dict:
        players_view = []
        for pid in state["player_order"]:
            pdata = state["players"][pid]
            show_hand = pid == viewer_id
            players_view.append(
                {
                    "player_id": pid,
                    "name": _player_name(state, pid),
                    "seat": state["player_meta"][pid].get("seat"),
                    "score": int(pdata["score"]),
                    "hand_count": len(pdata["hand"]),
                    "hand": list(pdata["hand"]) if show_hand else [],
                    "is_accomplice": bool(pdata["is_accomplice"]),
                    "private_log": list(pdata["private_log"]) if show_hand else [],
                    "you": pid == viewer_id,
                }
            )
        return {
            "game_id": CriminalDanceGame.game_id,
            "you": viewer_id,
            "round_number": int(state["round_number"]),
            "current_player_id": state["current_player_id"],
            "current_player_name": _player_name(state, state.get("current_player_id")),
            "players": players_view,
            "discard": list(state["discard"]),
            "played": list(state["played"]),
            "winner_mode": state.get("winner_mode"),
            "winner_ids": list(state.get("winner_ids", [])),
            "last_summary": state.get("last_summary", ""),
            "criminal_holder_player_id": _find_criminal_holder(state) if state.get("match_over") else None,
            "game_over": bool(state.get("game_over")),
            "match_over": bool(state.get("match_over")),
            "config": dict(state.get("config", {})),
            "legal_actions": CriminalDanceGame.get_legal_actions(state, viewer_id),
        }

    @staticmethod
    def bot_move(state: Dict, bot_id: str) -> Optional[Dict]:
        legal = CriminalDanceGame.get_legal_actions(state, bot_id)
        if "play_again" in legal:
            return {"type": "play_again", "delay_ms": 500}
        if "play_card" not in legal:
            return None
        hand = list(state["players"][bot_id]["hand"])
        if not hand:
            return None
        playable = [card for card in hand if _is_card_playable(state, bot_id, card)]
        if not playable:
            return None
        card = random.choice(playable)
        payload = {"type": "play_card", "card_id": card["id"], "delay_ms": 350}
        if card["type"] in (CARD_DETECTIVE, CARD_CHIEF):
            targets = [pid for pid in state["player_order"] if pid != bot_id]
            if targets:
                payload["target_player_id"] = random.choice(targets)
        elif card["type"] in (CARD_DOG, CARD_WITNESS, CARD_TRADE):
            targets = [pid for pid in state["player_order"] if pid != bot_id and len(state["players"][pid]["hand"]) > 0]
            if targets:
                payload["target_player_id"] = random.choice(targets)
        if card["type"] == CARD_TRADE:
            own_cards = [c for c in hand if c["id"] != card["id"]]
            if own_cards:
                payload["your_card_id"] = random.choice(own_cards)["id"]
        return payload

    @staticmethod
    def serialize(state: Dict) -> Dict:
        return state

    @staticmethod
    def deserialize(payload: Dict) -> Dict:
        return payload
