"""Sanitized card faces and public actions from two Guandan regression games.

Original account IDs, room data, bot explanations, timestamps, and source paths
are deliberately absent. Card IDs are allocated from one canonical deck, and
states are rebuilt through the real rules handler using only the requested
prefix of actions. Empty card tuples represent passes.
"""

from typing import Dict, List, Optional, Sequence

from game import guandan


FIXTURES = {
    '72c': {
        'start_player': 'bot2',
        'dealer_team': 'B',
        'level_rank': 2,
        'visible_card': '♥️6',
        "initial_hands": {
            'calvin': (
                '🃏B', '♥️2', '♠️A', '♠️A', '♥️A', '♣️A', '♦️A', '♥️K', '♠️Q',
                '♥️Q', '♣️Q', '♠️J', '♥️10', '♠️9', '♠️9', '♥️9', '♣️9', '♦️9',
                '♥️8', '♠️6', '♥️6', '♦️6', '♥️5', '♠️4', '♠️4', '♥️3', '♦️3',
            ),
            'bot2': (
                '🃏S', '♠️2', '♠️2', '♥️2', '♣️2', '♣️2', '♣️A', '♠️K', '♥️K',
                '♣️K', '♥️J', '♣️J', '♦️J', '♥️10', '♦️8', '♠️7', '♥️7', '♦️7',
                '♠️6', '♥️6', '♣️6', '♥️5', '♣️5', '♥️4', '♠️3', '♣️3', '♣️3',
            ),
            'z': (
                '🃏B', '🃏S', '♣️K', '♦️K', '♣️Q', '♦️Q', '♠️J', '♥️J', '♦️J',
                '♠️10', '♠️10', '♣️10', '♥️9', '♣️9', '♦️9', '♣️8', '♦️8', '♠️7',
                '♥️7', '♣️7', '♣️7', '♦️6', '♠️5', '♣️5', '♦️5', '♦️5', '♦️4',
            ),
            'bot4': (
                '♦️2', '♦️2', '♥️A', '♦️A', '♠️K', '♦️K', '♠️Q', '♥️Q', '♦️Q',
                '♣️J', '♣️10', '♦️10', '♦️10', '♠️8', '♠️8', '♥️8', '♣️8', '♦️7',
                '♣️6', '♠️5', '♥️4', '♣️4', '♣️4', '♦️4', '♠️3', '♥️3', '♦️3',
            ),
        },
        "actions": (
            ('bot2', ('♣️3', '♠️3', '♣️3', '♣️5', '♥️5')),
            ('z', ('♥️9', '♣️9', '♦️9', '♦️8', '♣️8')),
            ('bot4', ()),
            ('calvin', ()),
            ('bot2', ('♥️J', '♦️J', '♣️J', '♠️7', '♦️7')),
            ('z', ()),
            ('bot4', ()),
            ('calvin', ('♥️2', '♥️6', '♠️6', '♦️6')),
            ('bot2', ()),
            ('z', ()),
            ('bot4', ()),
            ('calvin', ('♥️5',)),
            ('bot2', ('♥️7',)),
            ('z', ()),
            ('bot4', ()),
            ('calvin', ('♥️K',)),
            ('bot2', ('♣️A',)),
            ('z', ('🃏S',)),
            ('bot4', ('♥️4', '♣️4', '♣️4', '♦️4')),
            ('calvin', ('♥️9', '♠️9', '♠️9', '♦️9')),
            ('bot2', ()),
            ('z', ()),
            ('bot4', ()),
            ('calvin', ('♦️3', '♥️3')),
            ('bot2', ()),
            ('z', ()),
            ('bot4', ()),
            ('calvin', ('♠️4', '♠️4')),
            ('bot2', ()),
            ('z', ()),
            ('bot4', ()),
            ('calvin', ('♠️Q', '♥️Q')),
            ('bot2', ()),
            ('z', ()),
            ('bot4', ()),
            ('calvin', ('♥️8', '♣️9', '♥️10', '♠️J', '♣️Q')),
            ('bot2', ('♥️6', '♠️6', '♣️6', '♥️2')),
            ('z', ()),
            ('bot4', ()),
            ('calvin', ('♠️A', '♦️A', '♥️A', '♠️A', '♣️A')),
            ('bot2', ()),
            ('z', ()),
            ('bot4', ()),
        ),
    },
    '7a5': {
        'start_player': 'bot4',
        'dealer_team': 'B',
        'level_rank': 2,
        'visible_card': '♠️3',
        "initial_hands": {
            'calvin': (
                '🃏S', '♥️2', '♣️2', '♣️2', '♦️2', '♦️2', '♦️A', '♦️A', '♠️K',
                '♣️K', '♦️K', '♣️Q', '♣️Q', '♦️J', '♣️10', '♥️9', '♥️9', '♣️8',
                '♥️7', '♦️7', '♠️6', '♣️6', '♠️5', '♣️5', '♦️5', '♠️4', '♦️4',
            ),
            'bot2': (
                '♥️A', '♣️A', '♣️A', '♥️10', '♣️10', '♦️10', '♠️9', '♣️9', '♣️9',
                '♠️8', '♠️8', '♥️8', '♠️7', '♣️7', '♦️7', '♠️6', '♥️5', '♥️5',
                '♦️5', '♥️4', '♣️4', '♣️4', '♦️4', '♥️3', '♥️3', '♣️3', '♦️3',
            ),
            'z': (
                '🃏B', '♠️2', '♠️A', '♠️K', '♥️K', '♦️K', '♥️Q', '♦️Q', '♥️J',
                '♥️J', '♣️J', '♦️J', '♠️10', '♦️10', '♠️9', '♦️9', '♦️9', '♠️7',
                '♥️7', '♣️7', '♥️6', '♣️6', '♠️5', '♠️4', '♠️3', '♣️3', '♦️3',
            ),
            'bot4': (
                '🃏B', '🃏S', '♠️2', '♥️2', '♠️A', '♥️A', '♥️K', '♣️K', '♠️Q',
                '♠️Q', '♥️Q', '♦️Q', '♠️J', '♠️J', '♣️J', '♠️10', '♥️10', '♥️8',
                '♣️8', '♦️8', '♦️8', '♥️6', '♦️6', '♦️6', '♣️5', '♥️4', '♠️3',
            ),
        },
        "actions": (
            ('bot4', ('♠️2', '♠️3', '♥️4', '♣️5', '♦️6')),
            ('calvin', ('♣️8', '♥️9', '♣️10', '♦️J', '♣️Q')),
            ('bot2', ()),
            ('z', ()),
            ('bot4', ()),
            ('calvin', ('♥️9',)),
            ('bot2', ('♦️10',)),
            ('z', ()),
            ('bot4', ()),
            ('calvin', ('♣️Q',)),
            ('bot2', ('♣️A',)),
            ('z', ()),
            ('bot4', ()),
            ('calvin', ('🃏S',)),
            ('bot2', ('♥️3', '♣️3', '♦️3', '♥️3')),
            ('z', ()),
            ('bot4', ()),
            ('calvin', ('♥️2', '♠️5', '♣️5', '♦️5')),
            ('bot2', ()),
            ('z', ()),
            ('bot4', ()),
            ('calvin', ('♣️6', '♠️6')),
            ('bot2', ('♣️10', '♥️10')),
            ('z', ('♥️Q', '♦️Q')),
            ('bot4', ('♥️A', '♠️A')),
            ('calvin', ()),
            ('bot2', ()),
            ('z', ()),
            ('bot4', ('♥️6', '♦️6')),
            ('calvin', ('♦️7', '♥️7')),
            ('bot2', ('♣️A', '♥️A')),
            ('z', ()),
            ('bot4', ()),
            ('calvin', ()),
            ('bot2', ('♥️5', '♥️5', '♦️5')),
            ('z', ('♠️9', '♦️9', '♦️9')),
            ('bot4', ('♠️J', '♣️J', '♠️J')),
            ('calvin', ('♦️K', '♠️K', '♣️K')),
            ('bot2', ('♦️4', '♣️4', '♥️4', '♣️4')),
            ('z', ()),
            ('bot4', ()),
            ('calvin', ('♦️2', '♣️2', '♦️2', '♣️2')),
            ('bot2', ()),
            ('z', ()),
            ('bot4', ('♣️8', '♦️8', '♥️8', '♦️8', '♥️2')),
            ('calvin', ()),
            ('bot2', ()),
            ('z', ()),
            ('bot4', ('♥️10', '♠️10')),
            ('calvin', ('♦️A', '♦️A')),
            ('bot2', ()),
            ('z', ()),
            ('bot4', ('♦️Q', '♠️Q', '♥️Q', '♠️Q')),
            ('calvin', ()),
            ('bot2', ()),
            ('z', ()),
            ('bot4', ('♣️K', '♥️K')),
            ('calvin', ()),
            ('bot2', ()),
            ('z', ('♦️J', '♥️J', '♣️J', '♥️J')),
            ('bot4', ()),
            ('calvin', ()),
            ('bot2', ()),
            ('z', ('♥️7', '♣️7', '♠️7', '♣️3', '♦️3')),
            ('bot4', ()),
            ('calvin', ()),
            ('bot2', ('♥️8', '♠️8', '♠️8', '♣️9', '♣️9')),
            ('z', ('♥️K', '♦️K', '♠️K', '♥️6', '♣️6')),
            ('bot4', ()),
            ('calvin', ()),
            ('bot2', ()),
            ('z', ('♦️10',)),
            ('bot4', ('🃏S',)),
            ('calvin', ()),
            ('bot2', ()),
            ('z', ('🃏B',)),
            ('bot4', ()),
            ('calvin', ()),
            ('bot2', ()),
            ('z', ('♠️A', '♠️2', '♠️3', '♠️4', '♠️5')),
            ('bot4', ()),
            ('calvin', ()),
            ('bot2', ()),
            ('z', ('♠️10',)),
            ('bot4', ('🃏B',)),
            ('calvin', ()),
            ('bot2', ('♣️7', '♦️7', '♠️7')),
            ('calvin', ()),
            ('bot2', ('♠️6',)),
            ('calvin', ()),
            ('bot2', ('♠️9',)),
        ),
    },
}


def pick_card_ids(hand: List[Dict], labels: Sequence[str]) -> List[int]:
    """Resolve duplicate card faces to distinct IDs already owned by a player."""
    available = list(hand)
    card_ids = []
    for label in labels:
        for index, card in enumerate(available):
            if guandan._card_label(card) == label:
                card_ids.append(available.pop(index)["id"])
                break
        else:
            raise AssertionError(f"Missing fixture card {label}")
    return card_ids


def replay_fixture(
    case: str,
    before_action: int,
    config: Optional[Dict] = None,
) -> Dict:
    """Build the position before a one-based action, never adding future history.

    ``len(FIXTURES[case]["actions"]) + 1`` replays the entire recorded prefix.
    The returned object is a server state; public views must still be obtained
    through ``GuandanGame.get_public_view`` as in normal gameplay.
    """
    fixture = FIXTURES[case]
    actions = fixture["actions"]
    if not 1 <= before_action <= len(actions) + 1:
        raise ValueError("before_action is outside the recorded game")
    players = [
        {"player_id": player_id, "name": player_id, "seat": seat,
         "is_bot": player_id.startswith("bot")}
        for seat, player_id in enumerate(("calvin", "bot2", "z", "bot4"))
    ]
    state = guandan.GuandanGame.init_game(config or {}, players)
    deck = guandan._full_deck()
    for player_id, labels in fixture["initial_hands"].items():
        card_ids = set(pick_card_ids(deck, labels))
        state["players"][player_id]["hand"] = [
            card for card in deck if card["id"] in card_ids
        ]
        deck = [card for card in deck if card["id"] not in card_ids]
    if deck:
        raise AssertionError("Fixture must allocate all 108 cards exactly once")

    state.update(
        game_start_time=0.0,
        dealer_team=fixture["dealer_team"],
        level_rank=fixture["level_rank"],
        current_turn=fixture["start_player"],
        current_trick=None,
        pass_count=0,
        trick_plays={},
        seen_cards=[],
        pass_limits={},
        known_card_owners={},
        round_memories=[],
    )
    state["visible_card_id"] = pick_card_ids(
        state["players"][fixture["start_player"]]["hand"],
        (fixture["visible_card"],),
    )[0]
    guandan._start_round_memory(state)

    for index, (player_id, labels) in enumerate(actions[:before_action - 1], 1):
        action = {"type": "pass"}
        if labels:
            action = {
                "type": "play",
                "card_ids": pick_card_ids(state["players"][player_id]["hand"], labels),
            }
        if state["current_turn"] != player_id:
            raise AssertionError(f"Fixture {case} action {index} is out of turn")
        _, error = guandan.GuandanGame.apply_action(state, player_id, action)
        if error:
            raise AssertionError(f"Fixture {case} action {index}: {error}")
    return state
