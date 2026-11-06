# Build Rebel Princess view fixtures for the browser UI acceptance harness.
#
# Run with: python3 -m tests.rebel_princess_fixtures
# Prints a JSON map of scenario name -> public view. The browser harness feeds
# one scenario at a time into renderRebelPrincessGameState so every layout can
# be inspected at the device widths required by DEV_GUIDE.md.

import copy
import json
import random
from typing import Dict, List, Optional

from game.rebel_princess import RebelPrincessGame, _deal_new_round

PLAYERS = [
    {"player_id": "p0", "name": "Calvin", "seat": 0, "is_bot": False},
    {"player_id": "p1", "name": "Mira", "seat": 1, "is_bot": False},
    {"player_id": "p2", "name": "Jun", "seat": 2, "is_bot": False},
    {"player_id": "p3", "name": "Sora", "seat": 3, "is_bot": False},
]
VIEWER = "p0"
LONG_NAMES = [
    {"player_id": "p0", "name": "Bartholomew", "seat": 0, "is_bot": False},
    {"player_id": "p1", "name": "Maximilianus", "seat": 1, "is_bot": False},
    {"player_id": "p2", "name": "Anastasia", "seat": 2, "is_bot": False},
    {"player_id": "p3", "name": "Wilhelmina", "seat": 3, "is_bot": False},
    {"player_id": "p4", "name": "Christopher", "seat": 4, "is_bot": False},
    {"player_id": "p5", "name": "Evangelina", "seat": 5, "is_bot": False},
]


def _new_state(seed: int, players: Optional[List[Dict]] = None) -> Dict:
    random.seed(seed)
    return RebelPrincessGame.init_game(None, copy.deepcopy(players or PLAYERS))


def _actors(state: Dict) -> List[str]:
    """Players the bot driver can advance.

    use_princess is always optional and bot_move never returns it, so a player
    holding only that action must not stall the driver.
    """
    actors = []
    for pid in state["turn_order"]:
        legal = [action for action in RebelPrincessGame.get_legal_actions(state, pid) if action != "use_princess"]
        if legal:
            actors.append(pid)
    return actors


def _bot_step(state: Dict, pid: str) -> bool:
    action = RebelPrincessGame.bot_move(state, pid)
    if not action:
        return False
    _, error = RebelPrincessGame.apply_action(state, pid, action)
    return not error


def _play_until(state: Dict, predicate, limit: int = 800) -> bool:
    for _ in range(limit):
        if predicate(state):
            return True
        actors = _actors(state)
        if not actors:
            return predicate(state)
        if not _bot_step(state, actors[0]):
            return predicate(state)
    return predicate(state)


def _deal_round(state: Dict, round_card_id: str, round_index: int = 0) -> None:
    state["round_cards"] = [
        round_card_id,
        "once_upon_a_time",
        "invitation",
        "royal_decree",
        "poisoned_apple",
    ]
    state["round_card_id"] = round_card_id
    state["round"] = round_index + 1
    state["round_index"] = round_index
    _deal_new_round(state, state["turn_order"][0], round_index)


def _pass_everyone(state: Dict) -> None:
    _play_until(state, lambda s: s["phase"] != "pass")


def _hand_card(state: Dict, pid: str) -> Dict:
    hand = state["players"][pid]["hand"]
    return copy.deepcopy(hand[0]) if hand else {"id": "queen_1", "suit": "queen", "rank": 1, "is_frog": False}


def build_views() -> Dict[str, Dict]:
    views: Dict[str, Dict] = {}

    def save(name: str, state: Dict, viewer: str = VIEWER) -> None:
        views[name] = copy.deepcopy(RebelPrincessGame.get_public_view(state, viewer))

    state = _new_state(7)
    save("pass", state)

    _play_until(state, lambda s: s["phase"] == "trick" and s["current_turn"] == VIEWER and not s["current_trick"])
    save("trick_lead", state)

    _play_until(state, lambda s: s["phase"] == "trick" and s["current_turn"] == VIEWER and s["current_trick"])
    save("trick_follow", state)

    _play_until(
        state,
        lambda s: s["phase"] == "trick" and s["current_turn"] not in (VIEWER, None) and len(s["current_trick"]) >= 2,
    )
    save("trick_wait", state)

    _play_until(state, lambda s: s["phase"] == "round_pause")
    save("round_pause", state)

    _play_until(state, lambda s: s.get("game_over"))
    save("game_over", state)

    for name, card_id in (
        ("split_hand", "after_party"),
        ("gift", "wedding_gift"),
        ("reveal_suit", "crystal_clear"),
        ("reserve_last", "late_to_the_ball"),
        ("trick_pass", "musical_chairs"),
    ):
        setup = _new_state(11)
        _deal_round(setup, card_id)
        _pass_everyone(setup)
        save(name, setup)

    def trick_state(princess_id: str, seed: int = 7) -> Dict:
        crafted = _new_state(seed)
        _play_until(
            crafted,
            lambda s: s["phase"] == "trick" and s["current_turn"] == VIEWER and not s["current_trick"],
        )
        crafted["players"][VIEWER]["princess"] = princess_id
        crafted["players"][VIEWER]["princess_used"] = False
        return crafted

    save("power_little_mermaid", trick_state("little_mermaid"))
    save("power_snow_white", trick_state("snow_white"))
    save("power_pea_princess", trick_state("pea_princess"))
    save("power_cinderella", trick_state("cinderella"))

    scheherazade = trick_state("scheherazade")
    scheherazade["scheherazade"] = {
        "player": VIEWER,
        "target": "p1",
        "drawn": _hand_card(scheherazade, "p1"),
    }
    save("power_scheherazade", scheherazade)

    decide = copy.deepcopy(scheherazade)
    decide["phase"] = "scheherazade_decide"
    decide["current_turn"] = VIEWER
    save("power_scheherazade_decide", decide)

    pocahontas = trick_state("pocahontas")
    pocahontas["phase"] = "pocahontas"
    pocahontas["current_turn"] = VIEWER
    pocahontas["current_trick"] = [
        {"player_id": pid, "card": _hand_card(pocahontas, pid), "was_void": False}
        for pid in pocahontas["turn_order"]
    ]
    save("power_pocahontas", pocahontas)

    mulan = copy.deepcopy(pocahontas)
    mulan["players"][VIEWER]["princess"] = "mulan"
    mulan["phase"] = "mulan"
    save("power_mulan", mulan)

    sleeping = trick_state("sleeping_beauty")
    sleeping["phase"] = "sleeping_beauty_keep"
    sleeping["current_turn"] = VIEWER
    sleeping["sleeping_beauty"] = {
        "player": VIEWER,
        "pool": [{"from": pid, "card": _hand_card(sleeping, pid)} for pid in sleeping["turn_order"]],
    }
    save("power_sleeping_beauty", sleeping)

    haggle = _new_state(11)
    _deal_round(haggle, "haggle_with_the_hag")
    _pass_everyone(haggle)
    _play_until(haggle, lambda s: s["phase"] == "trick" and s["current_turn"] == VIEWER)
    haggle["phase"] = "haggle"
    haggle["current_turn"] = VIEWER
    haggle["pending_haggle"] = {
        "winner": VIEWER,
        "trick_cards": [_hand_card(haggle, pid) for pid in haggle["turn_order"]],
    }
    save("power_haggle", haggle)

    crowded = _new_state(5, LONG_NAMES)
    _play_until(
        crowded,
        lambda s: s["phase"] == "trick" and s["current_turn"] == VIEWER and len(s["current_trick"]) >= 3,
    )
    if crowded["current_turn"] != VIEWER:
        crowded["current_turn"] = VIEWER
    save("six_players", crowded)

    spectator = _new_state(7)
    _play_until(spectator, lambda s: s["phase"] == "trick" and s["current_trick"])
    save("spectator", spectator, viewer="watcher")

    # Last trick: only a couple of cards left, which is where a stretched hand
    # grid would blow the cards up to full width.
    endgame = _new_state(7)
    _play_until(
        endgame,
        lambda s: s["phase"] == "trick" and s["current_turn"] == VIEWER and len(s["players"][VIEWER]["hand"]) > 3,
    )
    endgame["players"][VIEWER]["hand"] = endgame["players"][VIEWER]["hand"][:2]
    save("endgame", endgame)

    log_lines = [
        "Round 1 begins: Once Upon a Time...",
        "Calvin passes 3 cards to the right.",
        "Mira wins the trick with Queen 9 and captures 2 proposals.",
        "Jun plays the Frog and takes 5 proposals.",
    ]
    for name in ("round_pause", "game_over", "six_players"):
        views[name]["log"] = log_lines * 3

    return views


if __name__ == "__main__":
    print(json.dumps(build_views(), ensure_ascii=False))
