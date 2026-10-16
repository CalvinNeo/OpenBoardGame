import copy
import unittest

from game import guandan, guandan_ai
from tests.guandan_history_fixtures import pick_card_ids, replay_fixture
from tests.test_guandan_history_policy import CountOnlyHand, UnreadableInitialHands


class GuandanLayeredTakeoverTests(unittest.TestCase):
    def call(self, name, *args):
        return guandan_ai.call(guandan, name, *args)

    def state_with_hand(self, labels, lead="🃏B"):
        state = replay_fixture("2a14d0", 11)
        deck = guandan._full_deck()
        own_ids = set(pick_card_ids(deck, labels))
        state["players"]["bot2"]["hand"] = [card for card in deck if card["id"] in own_ids]
        table_id = pick_card_ids([card for card in deck if card["id"] not in own_ids], (lead,))[0]
        table_card = next(card for card in deck if card["id"] == table_id)
        state["current_trick"] = {
            "player_id": "calvin", "cards": [table_id],
            "combo": guandan._evaluate_combo([table_card], state["level_rank"], state["config"]),
        }
        available = [card for card in deck if card["id"] not in own_ids | {table_id}]
        for pid in ("calvin", "z", "bot4"):
            count = len(state["players"][pid]["hand"])
            state["players"][pid]["hand"] = available[:count]
            del available[:count]
        state["seen_cards"] = [table_id] + [card["id"] for card in available]
        state["round_memories"] = []
        state["known_card_owners"] = {}
        state["pass_limits"] = {}
        state["trick_plays"] = {}
        occupied = [card["id"] for player in state["players"].values() for card in player["hand"]]
        self.assertEqual(len(set(occupied + state["seen_cards"])), 108)
        self.assertEqual(len(occupied + state["seen_cards"]), 108)
        return state

    def test_saved_three_bombs_spend_queens_to_release_ordinary_groups(self):
        for mode in ("heuristic", "auto"):
            for step in (11, 19, 27, 39, 47, 51):
                with self.subTest(mode=mode, step=step):
                    state = replay_fixture("2a14d0", step, {"bot_mode": mode})
                    hand = state["players"]["bot2"]["hand"]
                    queens = {card["id"] for card in hand if card.get("rank") == 12}
                    action = guandan.GuandanGame.bot_move(state, "bot2")
                    self.assertEqual(action["type"], "play")
                    self.assertEqual(set(action["card_ids"]), queens)
                    self.assertIsNone(guandan.GuandanGame.apply_action(state, "bot2", action)[1])
                    remaining = state["players"]["bot2"]["hand"]
                    self.assertEqual(sum(card.get("rank") == 13 for card in remaining), 4)
                    self.assertEqual(sum(card.get("rank") == 14 for card in remaining), 4)

    def test_quick_and_detailed_scores_share_control_inventory(self):
        state = replay_fixture("2a14d0", 11)
        hand = state["players"]["bot2"]["hand"]
        queens = [card["id"] for card in hand if card.get("rank") == 12]
        passed = guandan._bot_score_components(state, "bot2", None, 2)
        played = guandan._bot_score_components(state, "bot2", queens, 2)
        self.assertGreater(played["total"], passed["total"])
        self.assertNotIn("strategic_enemy_pass", passed)
        self.assertNotIn("preserve_premium_bomb", passed)
        self.assertNotIn("premium_bomb_spend_penalty", played)
        self.assertGreater(self.call("_quick_candidate_score", state, "bot2", queens),
                           self.call("_quick_candidate_score", state, "bot2", None))
        for score in (passed, played):
            self.assertAlmostEqual(score["total"], sum(value for key, value in score.items()
                                                       if key != "total"))

    def test_three_bombs_still_wait_for_teammate_single_control(self):
        for step in (31, 35):
            with self.subTest(step=step):
                state = replay_fixture("2a14d0", step, {"bot_mode": "heuristic"})
                self.assertFalse(self.call("_multi_bomb_takeover_profile", state, "bot2"))
                self.assertEqual(guandan.GuandanGame.bot_move(state, "bot2")["type"], "pass")

    def test_reserves_require_disjoint_cards_and_a_useful_ordinary_followup(self):
        queens = ("♠️Q", "♥️Q", "♣️Q", "♦️Q")
        full_house = ("♠️3", "♥️3", "♣️3", "♠️4", "♥️4")
        cases = {
            "overlapping_large_bomb_subsets": queens + (
                "♠️K", "♠️K", "♥️K", "♥️K", "♣️K", "♣️K", "♦️K",
            ) + full_house + ("♠️6",),
            "shared_wildcard": queens + (
                "♠️K", "♥️K", "♣️K", "♠️A", "♥️A", "♣️A", "♥️2",
            ) + full_house + ("♠️6",),
            "third_bomb_needs_wildcard": queens + (
                "♠️K", "♥️K", "♣️K", "♦️K", "♠️A", "♥️A", "♣️A", "♥️2",
            ) + full_house,
            "only_loose_followups": queens + (
                "♠️K", "♥️K", "♣️K", "♦️K", "♠️A", "♥️A", "♣️A", "♦️A",
                "♠️3", "♠️6", "♠️7", "♠️9", "♣️2",
            ),
        }
        for name, labels in cases.items():
            with self.subTest(name=name):
                state = self.state_with_hand(labels)
                self.assertFalse(self.call("_multi_bomb_takeover_profile", state, "bot2"))

    def test_conservation_remains_for_two_bombs_and_short_enemy_defense(self):
        for situation in ("two_bombs", "short_enemy", "finished_leader", "teammate_top", "clean_natural_reply"):
            with self.subTest(situation=situation):
                state = replay_fixture("2a14d0", 11)
                hand = state["players"]["bot2"]["hand"]
                if situation == "two_bombs":
                    removed = next(card for card in hand if card.get("rank") == 13)
                    hand.remove(removed)
                    state["seen_cards"].append(removed["id"])
                elif situation == "short_enemy":
                    state["seen_cards"].extend(card["id"] for card in state["players"]["z"]["hand"][4:])
                    state["players"]["z"]["hand"] = state["players"]["z"]["hand"][:4]
                elif situation == "finished_leader":
                    state["seen_cards"].extend(card["id"] for card in state["players"]["calvin"]["hand"])
                    state["players"]["calvin"].update(hand=[], finished=True, finish_rank=1)
                    state["finish_order"] = ["calvin"]
                elif situation == "teammate_top":
                    state["current_trick"]["player_id"] = "bot4"
                else:
                    state = self.state_with_hand([guandan._card_label(card) for card in hand], lead="♥️A")
                self.assertFalse(self.call("_multi_bomb_takeover_profile", state, "bot2"))

    def test_takeover_uses_only_public_opponent_information(self):
        original = replay_fixture("2a14d0", 11)
        changed = copy.deepcopy(original)
        others = ("calvin", "z", "bot4")
        cards = [card for pid in others for card in changed["players"][pid]["hand"]]
        cards.reverse()
        for pid in others:
            count = len(changed["players"][pid]["hand"])
            changed["players"][pid]["hand"] = cards[:count]
            del cards[:count]
        self.assertEqual(self.call("_multi_bomb_takeover_profile", original, "bot2"),
                         self.call("_multi_bomb_takeover_profile", changed, "bot2"))
        protected = replay_fixture("2a14d0", 11)
        for pid, player in protected["players"].items():
            if pid != "bot2":
                player["hand"] = CountOnlyHand(len(player["hand"]))
        for memory in protected["round_memories"]:
            memory["initial_hands"] = UnreadableInitialHands()
        self.assertEqual(self.call("_multi_bomb_takeover_profile", original, "bot2"),
                         self.call("_multi_bomb_takeover_profile", protected, "bot2"))


if __name__ == "__main__":
    unittest.main()
