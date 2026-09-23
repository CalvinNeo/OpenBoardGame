"""Public-history regressions from room 3a8f1e, round 1.

Only card labels and actions are retained from the save. Player identifiers are
local aliases; room credentials, explanations and future actions are omitted.
"""

import copy
import time
import unittest
from unittest import mock
from typing import Dict, List, Sequence

from game import guandan, guandan_ai


INITIAL_HANDS = {
    "calvin": [
        "🃏S", "🃏S", "♠️2", "♣️2", "♣️K", "♣️K", "♣️Q", "♣️Q", "♠️10",
        "♣️10", "♠️9", "♣️9", "♦️9", "♦️9", "♠️8", "♠️8", "♣️8", "♦️8",
        "♦️8", "♠️7", "♠️5", "♣️5", "♦️4", "♦️4", "♥️3", "♦️3", "♦️3",
    ],
    "bot2": [
        "🃏B", "♦️2", "♠️A", "♠️A", "♣️A", "♦️A", "♦️A", "♠️K", "♠️Q",
        "♦️Q", "♦️Q", "♠️J", "♥️J", "♣️J", "♣️J", "♦️J", "♦️J", "♥️8",
        "♠️7", "♣️7", "♠️6", "♠️6", "♣️6", "♠️5", "♥️5", "♠️4", "♥️4",
    ],
    "zhu": [
        "♠️2", "♥️2", "♥️2", "♥️A", "♣️A", "♠️K", "♥️K", "♦️K", "♥️Q",
        "♥️J", "♠️10", "♥️10", "♦️10", "♥️9", "♣️9", "♥️7", "♥️7", "♣️7",
        "♦️7", "♥️6", "♦️6", "♦️5", "♠️4", "♥️4", "♣️4", "♣️3", "♣️3",
    ],
    "bot4": [
        "🃏B", "♣️2", "♦️2", "♥️A", "♥️K", "♦️K", "♠️Q", "♥️Q", "♠️J",
        "♥️10", "♣️10", "♦️10", "♠️9", "♥️9", "♥️8", "♣️8", "♦️7", "♥️6",
        "♣️6", "♦️6", "♥️5", "♣️5", "♦️5", "♣️4", "♠️3", "♠️3", "♥️3",
    ],
}

# Empty labels mean pass. Replay stops before Bot 2's requested decision.
PUBLIC_ACTIONS = (
    # Trick 1: two full houses by each of Bot 2 and Zhu.
    ("bot2", ("♣️6", "♠️6", "♠️6", "♠️4", "♥️4")),
    ("zhu", ("♣️3", "♣️3", "♠️10", "♥️10", "♦️10")),
    ("bot4", ()),
    ("calvin", ()),
    ("bot2", ("♦️Q", "♦️Q", "♠️Q", "♥️5", "♠️5")),
    ("zhu", ("♠️K", "♦️K", "♥️K", "♦️6", "♥️6")),
    ("bot4", ()),
    ("calvin", ()),
    ("bot2", ()),
    # Trick 2: Bot 2 wins a single with the big joker.
    ("zhu", ("♦️5",)),
    ("bot4", ("♦️7",)),
    ("calvin", ("🃏S",)),
    ("bot2", ("🃏B",)),
    ("zhu", ()),
    ("bot4", ()),
    ("calvin", ()),
    # Trick 3: Bot 4 wins a single with the other big joker.
    ("bot2", ("♥️8",)),
    ("zhu", ("♥️J",)),
    ("bot4", ("♠️Q",)),
    ("calvin", ("🃏S",)),
    ("bot2", ()),
    ("zhu", ()),
    ("bot4", ("🃏B",)),
    ("calvin", ()),
    ("bot2", ()),
    ("zhu", ()),
    # Trick 4: Zhu bombs Bot 4's steel plate and has eleven cards.
    ("bot4", ("♦️5", "♥️5", "♣️5", "♣️6", "♦️6", "♥️6")),
    ("calvin", ()),
    ("bot2", ()),
    ("zhu", ("♥️7", "♣️7", "♦️7", "♥️7")),
    ("bot4", ()),
    ("calvin", ()),
    ("bot2", ()),
    # Trick 5: Zhu uses the level single and has nine cards.
    ("zhu", ("♥️Q",)),
    ("bot4", ("♥️A",)),
    ("calvin", ()),
    ("bot2", ()),
    ("zhu", ("♠️2",)),
    ("bot4", ()),
    ("calvin", ()),
    ("bot2", ()),
    # Trick 6: a wild full house leaves four cards.
    ("zhu", ("♥️2", "♣️A", "♥️A", "♣️9", "♥️9")),
    ("bot4", ()),
    ("calvin", ()),
)


def take_labels(available: List[Dict], labels: Sequence[str]) -> List[Dict]:
    """Select physical cards deterministically, including duplicate faces."""
    selected = []
    for label in labels:
        card = next(card for card in available if guandan._card_label(card) == label)
        available.remove(card)
        selected.append(card)
    return selected


def make_retained_bomb_state(remaining_count: int = 4) -> Dict:
    """Rebuild Bot 2's turn after Zhu reaches 17, 11, 9 or 4 cards.

    Every play and pass goes through the real rule handler, so public memories,
    seen cards, pass limits, turn order and physical cards remain consistent.
    """
    if remaining_count not in (17, 11, 9, 4):
        raise ValueError("remaining_count must be 17, 11, 9 or 4")
    players = [
        {"player_id": pid, "name": pid, "seat": seat, "is_bot": pid.startswith("bot")}
        for seat, pid in enumerate(INITIAL_HANDS)
    ]
    state = guandan.GuandanGame.init_game({"bot_mode": "heuristic"}, players)
    deck = guandan._full_deck()
    for pid, labels in INITIAL_HANDS.items():
        state["players"][pid]["hand"] = take_labels(deck, labels)
    assert not deck
    visible = next(card for card in state["players"]["bot2"]["hand"]
                   if guandan._card_label(card) == "♦️A")
    state.update(
        dealer_team="B", level_rank=2, current_turn="bot2", current_trick=None,
        round_memories=[], pass_limits={}, seen_cards=[], trick_plays={},
        known_card_owners={visible["id"]: "bot2"}, visible_card_id=visible["id"],
    )
    guandan._start_round_memory(state)
    for pid, labels in PUBLIC_ACTIONS:
        if (state["current_turn"] == "bot2"
                and len(state["players"]["zhu"]["hand"]) == remaining_count
                and state["pass_count"] == 2
                and state["current_trick"]["player_id"] == "zhu"):
            return state
        action = {"type": "pass"}
        if labels:
            cards = take_labels(list(state["players"][pid]["hand"]), labels)
            action = {"type": "play", "card_ids": [card["id"] for card in cards]}
        _events, error = guandan.GuandanGame.apply_action(state, pid, action)
        assert error is None, (pid, labels, error)
    assert remaining_count == 4
    assert state["current_turn"] == "bot2"
    return state


class GuandanRetainedBombHistoryTests(unittest.TestCase):
    @staticmethod
    def _call(name, *args):
        return guandan_ai.call(guandan, name, *args)

    def test_saved_four_card_tail_keeps_pass_and_rejects_late_bomb(self):
        state = make_retained_bomb_state(4)
        self.assertFalse(self._call("_must_contest_short_enemy_as_last_defender", state, "bot2"))
        self.assertFalse(self._call("_must_contest_structured_enemy_runout", state, "bot2"))
        self.assertEqual(guandan.GuandanGame.bot_move(state, "bot2"), {"type": "pass"})

    def test_intercepts_enemy_bomb_before_only_the_tail_remains(self):
        state = make_retained_bomb_state(11)
        action = guandan.GuandanGame.bot_move(state, "bot2")
        self.assertEqual(action["type"], "play")
        hand = state["players"]["bot2"]["hand"]
        chosen = [card for card in hand if card["id"] in action["card_ids"]]
        combo = guandan._evaluate_combo(chosen, 2, state["config"])
        self.assertEqual(combo["type"], "bomb")
        self.assertTrue(self._call("_remaining_bomb_cover_tier", state, "bot2", action["card_ids"]))

    def test_early_intercept_requires_public_lane_loss_last_defender_and_reserve(self):
        original = make_retained_bomb_state(11)
        self.assertTrue(self._call("_layered_bomb_intercept_context", original, "bot2"))
        for mutation in ("no_history", "not_last", "single"):
            state = copy.deepcopy(original)
            if mutation == "no_history":
                state["round_memories"][-1]["tricks"][-1]["actions"] = []
            elif mutation == "not_last":
                state["pass_count"] = 1
            else:
                state = make_retained_bomb_state(9)
            with self.subTest(mutation=mutation):
                self.assertFalse(self._call("_layered_bomb_intercept_context", state, "bot2"))
        # All bomb-size variants of six J are one resource, not two bombs.
        state = make_retained_bomb_state(11)
        state["players"]["bot2"]["hand"] = [
            card for card in state["players"]["bot2"]["hand"] if card["rank"] != 14
        ]
        self.assertFalse(self._call("_has_layered_bomb_response", state, "bot2"))

    def test_auto_mode_cannot_override_with_the_saved_shallow_bomb_choice(self):
        state = make_retained_bomb_state(4)
        state["config"]["bot_mode"] = "auto"
        cards = [card["id"] for card in take_labels(
            list(state["players"]["bot2"]["hand"]), ("♦️J", "♥️J", "♣️J", "♠️J")
        )]
        action = {"type": "play", "card_ids": cards}
        # A deceptively strong sampled score cannot substitute for checking the
        # publicly supported tail bomb and what happens after this takeover.
        scores = [(action, 1000.0, 1, {"depth": 0, "avg": 1000.0})]
        with mock.patch.object(guandan, "_mcts_score_actions", return_value=scores):
            self.assertEqual(guandan.GuandanGame.bot_move(state, "bot2"), {"type": "pass"})

    def _known_low_bomb_case(self, labels):
        state = make_retained_bomb_state(4)
        hand = state["players"]["bot2"]["hand"]
        selected = take_labels(list(hand), labels)
        state["seen_cards"].extend(card["id"] for card in hand if card not in selected)
        state["players"]["bot2"]["hand"] = selected
        state["known_card_owners"].update({
            card["id"]: "zhu" for card in state["players"]["zhu"]["hand"]
        })
        cards = [card["id"] for card in take_labels(
            list(selected), ("♦️J", "♥️J", "♣️J", "♠️J")
        )]
        return state, cards

    def test_larger_reserve_bomb_does_not_cover_ordinary_followup(self):
        state, cards = self._known_low_bomb_case((
            "♦️J", "♥️J", "♣️J", "♠️J", "♣️A", "♠️A", "♠️A", "♦️A", "♦️A",
            "♠️K", "♦️2", "♣️7", "♠️7",
        ))
        profile = self._call("_retained_bomb_takeover_profile", state, "bot2", cards)
        self.assertEqual(profile["risk"], 1.0)
        self.assertEqual(profile["safe_closeout"], 0.0)

    def test_continuous_bombs_then_final_whole_hand_prove_closeout(self):
        state, cards = self._known_low_bomb_case((
            "♦️J", "♥️J", "♣️J", "♠️J", "♣️A", "♠️A", "♠️A", "♦️A", "♦️A", "♣️7", "♠️7",
        ))
        profile = self._call("_retained_bomb_takeover_profile", state, "bot2", cards)
        self.assertEqual(profile["threat"], 1.0)
        self.assertEqual(profile["safe_closeout"], 1.0)
        self.assertEqual(profile["penalty"], 0.0)

    def test_proved_closeout_route_is_followed_after_winning_the_bomb_trick(self):
        state, cards = self._known_low_bomb_case((
            "♦️J", "♥️J", "♣️J", "♠️J", "♣️A", "♠️A", "♠️A", "♦️A", "♦️A", "♣️7", "♠️7",
        ))
        for pid, action in [("bot2", {"type": "play", "card_ids": cards})] + [
            (pid, {"type": "pass"}) for pid in ("zhu", "bot4", "calvin")
        ]:
            self.assertIsNone(guandan.GuandanGame.apply_action(state, pid, action)[1])
        aces = {card["id"] for card in state["players"]["bot2"]["hand"] if card["rank"] == 14}
        # An expired detailed-scoring budget must keep the same safe route.
        quick = guandan._bot_select_play(copy.deepcopy(state), "bot2", 4, deadline=time.perf_counter() - 1)
        self.assertEqual(set(quick), aces)
        action = guandan.GuandanGame.bot_move(state, "bot2")
        self.assertEqual(set(action["card_ids"]), aces)
        pair = [card["id"] for card in state["players"]["bot2"]["hand"] if card["rank"] == 7]
        self.assertFalse(guandan._should_accept_mcts_override(
            state, "bot2", action, {"type": "play", "card_ids": pair}, 4,
        ))

    def test_bomb_finishing_immediately_is_not_penalized(self):
        state, cards = self._known_low_bomb_case(("♦️J", "♥️J", "♣️J", "♠️J"))
        self.assertEqual(self._call(
            "_retained_bomb_takeover_profile", state, "bot2", cards,
        )["risk"], 0.0)
        self.assertEqual(guandan.GuandanGame.bot_move(state, "bot2")["type"], "play")

    def test_current_or_followup_bomb_can_be_overbombed_before_final_hand(self):
        for followup in (False, True):
            state = make_retained_bomb_state(4)
            available = guandan._full_deck()
            own = take_labels(available, (
                ["♠️A", "♥️A", "♣️A", "♦️A"] if followup else []
            ) + ["♠️J", "♥️J", "♣️J", "♦️J", "♠️7", "♣️7"])
            tail = take_labels(available, ["♠️Q", "♥️Q", "♣️Q", "♦️Q"])
            state["players"]["bot2"]["hand"] = own
            state["seen_cards"] = [card["id"] for card in available]
            state["known_card_owners"] = {card["id"]: "zhu" for card in tail}
            state["current_trick"] = None
            cards = [card["id"] for card in own if card["rank"] == (14 if followup else 11)]
            profile = self._call("_retained_bomb_takeover_profile", state, "bot2", cards)
            with self.subTest(followup=followup):
                self.assertEqual(profile["risk"], 1.0)

    def test_replay_reconstructs_each_decision_without_missing_or_duplicate_cards(self):
        for count, trick_type, bot_count in (
            (17, "full_house", 17), (11, "bomb", 15),
            (9, "single", 15), (4, "full_house", 15),
        ):
            with self.subTest(opponent_cards=count):
                state = make_retained_bomb_state(count)
                self.assertEqual(state["current_turn"], "bot2")
                self.assertEqual(state["pass_count"], 2)
                self.assertEqual(state["current_trick"]["player_id"], "zhu")
                self.assertEqual(state["current_trick"]["combo"]["type"], trick_type)
                self.assertEqual(len(state["players"]["zhu"]["hand"]), count)
                self.assertEqual(len(state["players"]["bot2"]["hand"]), bot_count)
                all_ids = state["seen_cards"] + [
                    card["id"] for player in state["players"].values()
                    for card in player["hand"]
                ]
                self.assertEqual(len(all_ids), 108)
                self.assertEqual(len(set(all_ids)), 108)

    def test_short_hand_reply_belief_never_uses_hidden_cards_or_initial_deal(self):
        state = make_retained_bomb_state(4)
        lead = take_labels(list(state["players"]["bot2"]["hand"]), ("♣️7", "♠️7"))
        combo = guandan._evaluate_combo(lead, 2, state["config"])

        def belief(position):
            return guandan_ai.call(
                guandan, "_public_reply_belief", position, "bot2", "zhu", combo,
            )

        original = belief(state)
        changed = copy.deepcopy(state)
        for pid, player in changed["players"].items():
            if pid != "bot2":
                player["hand"] = [object() for _ in player["hand"]]
        changed["round_memories"][0]["initial_hands"] = {}
        changed.pop("_ai_eval_cache", None)
        self.assertEqual(belief(changed), original)


if __name__ == "__main__":
    unittest.main()
