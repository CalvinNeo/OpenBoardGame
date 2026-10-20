import copy
import unittest

from game import guandan, guandan_ai
from tests.guandan_history_fixtures import pick_card_ids, replay_fixture
from tests.test_guandan_trick_boundary import make_state


class GuandanLevelPairStructureTests(unittest.TestCase):
    def fixture(self):
        return replay_fixture("88f335", 8, {
            "bot_mode": "heuristic", "bot_search_depth": 1,
            "bot_blacklist_separate_value": False, "bot_trick_boundary_mode": "off",
        })

    @staticmethod
    def call(name, *args, **kwargs):
        return guandan_ai.call(guandan, name, *args, **kwargs)

    def score(self, state, cards, actor="seat3"):
        with guandan_ai.complete_heuristic_scoring():
            result = self.call("_bot_score_components", state, actor, cards, 1)
        self.assertNotIn("anytime_partial", result)
        return result

    @staticmethod
    def natural_hand(rank, count):
        return [card for card in guandan._full_deck()
                if card.get("rank") == rank and card.get("suit") != "hearts"][:count]

    def test_recorded_response_spends_one_natural_level_card_and_no_wild_resource(self):
        state = self.fixture()
        hand = state["players"]["seat3"]["hand"]
        self.assertEqual(state["current_turn"], "seat3")
        self.assertEqual(state["current_trick"]["player_id"], "seat2")
        self.assertEqual(guandan._teammate_of(state, "seat3"), "seat1")
        self.assertEqual(state["level_rank"], 2)
        self.assertEqual(len(hand), 27)
        self.assertEqual(sum(guandan._is_wild(card, 2) for card in hand), 2)
        self.assertEqual(sum(card.get("rank") == 2 and not guandan._is_wild(card, 2)
                             for card in hand), 2)
        potential = self.call("_wild_structure_potential", hand, 2)
        self.assertGreater(potential, 0)
        for label in ("♣️2", "♠️2"):
            with self.subTest(label=label):
                cards = pick_card_ids(hand, (label,))
                remaining = [card for card in hand if card["id"] not in cards]
                trial = copy.deepcopy(state)
                _, error = guandan.GuandanGame.apply_action(
                    trial, "seat3", {"type": "play", "card_ids": cards})
                self.assertIsNone(error)
                self.assertEqual(len(trial["players"]["seat3"]["hand"]), 26)
                self.assertEqual(self.call("_wild_structure_opportunity_loss", hand, cards, 2), 0)
                self.assertEqual(self.call("_wild_structure_potential", remaining, 2), potential)

    def test_three_independent_bombs_remain_after_the_natural_single_response(self):
        state = self.fixture()
        hand = state["players"]["seat3"]["hand"]
        spent = set(pick_card_ids(hand, ("♣️2",)))
        remaining = [card for card in hand if card["id"] not in spent]
        groups = (
            (("♠️K", "♥️K", "♣️K", "♥️2"), 13, True),
            (("♦️8", "♣️8", "♦️8", "♥️2"), 8, True),
            (("♠️3", "♠️3", "♥️3", "♣️3"), 3, False),
        )
        for labels, rank, uses_wild in groups:
            cards = pick_card_ids(remaining, labels)
            self.assertTrue(spent.isdisjoint(cards))
            selected = [card for card in remaining if card["id"] in cards]
            combo = guandan._evaluate_combo(selected, 2, state["config"])
            self.assertEqual((combo["type"], combo["size"], combo["rank"], combo["uses_wild"]),
                             ("bomb", 4, rank, uses_wild))
            spent.update(cards)
            remaining = [card for card in remaining if card["id"] not in spent]
        self.assertEqual(len(spent), 13)
        self.assertEqual(len(remaining), 14)
        self.assertIn("♠️2", [guandan._card_label(card) for card in remaining])

    def test_level_pair_relief_is_shared_by_direct_and_cached_features(self):
        state = self.fixture()
        hand = state["players"]["seat3"]["hand"]
        cards = pick_card_ids(hand, ("♣️2",))
        direct = self.call("_control_group_break_penalty", hand, cards, 2)
        first = self.call("_candidate_features", state, "seat3", cards)
        second = self.call("_candidate_features", state, "seat3", cards)
        self.assertAlmostEqual(direct, 0.8)
        self.assertEqual(first["control_break"], direct)
        self.assertEqual(second["control_break"], direct)
        self.assertEqual(first["before_counts"][2], 2)
        self.assertEqual(first["after_counts"][2], 1)
        self.assertEqual(first["fragment_penalty"], 2.0)

    def test_relief_preserves_true_triple_bomb_and_nonlevel_pair_protection(self):
        for level in (2, 7, 14):
            wilds = [card for card in guandan._full_deck() if guandan._is_wild(card, level)]
            for wild_count in (0, 1, 2):
                pair_cost = 0.8 if wild_count else 8.0
                for count, expected in ((2, pair_cost), (3, 9.85), (4, 12.48)):
                    with self.subTest(level=level, count=count, wilds=wild_count):
                        hand = self.natural_hand(level, count) + wilds[:wild_count]
                        self.assertAlmostEqual(self.call(
                            "_control_group_break_penalty", hand, [hand[0]["id"]], level), expected)
        for rank, expected in ((13, 1.7), (14, 2.0)):
            with self.subTest(nonlevel_rank=rank):
                hand = self.natural_hand(rank, 2)
                self.assertAlmostEqual(self.call(
                    "_control_group_break_penalty", hand, [hand[0]["id"]], 2), expected)
        state = self.fixture()
        hand = state["players"]["seat3"]["hand"]
        cargo = pick_card_ids(hand, ("♠️K", "♥️K", "♣️K", "♣️2", "♥️2"))
        self.assertEqual(guandan._evaluate_combo(
            [card for card in hand if card["id"] in cargo], 2, state["config"])["type"], "full_house")
        self.assertAlmostEqual(self.call("_control_group_break_penalty", hand, cargo, 2), 8.0)

    def test_loose_small_joker_does_not_replace_a_wild_for_level_pair_relief(self):
        state = make_state({"bot": [2, 2, 7], "opp": [6, 8],
                            "mate": [10, 11], "opp2": [4, 5]})
        small_joker = next(card for card in guandan._full_deck() if card.get("joker") == "small")
        state["players"]["bot"]["hand"].append(small_joker)
        state["seen_cards"].remove(small_joker["id"])
        hand = state["players"]["bot"]["hand"]
        cards = [next(card["id"] for card in hand if card.get("rank") == 2)]
        self.assertFalse(any(guandan._is_wild(card, 2) for card in hand))
        self.assertAlmostEqual(self.call("_control_group_break_penalty", hand, cards, 2), 8.0)
        self.assertAlmostEqual(self.call("_candidate_features", state, "bot", cards)["control_break"], 8.0)

    def test_spending_a_wild_keeps_its_opportunity_cost_and_no_natural_level_bonus(self):
        state = self.fixture()
        hand = state["players"]["seat3"]["hand"]
        wild = pick_card_ids(hand, ("♥️2",))
        natural = pick_card_ids(hand, ("♣️2",))
        features = self.call("_candidate_features", state, "seat3", wild)
        self.assertEqual(features["before_counts"][2], 2)
        self.assertEqual(features["after_counts"][2], 2)
        self.assertEqual(features["control_break"], 0.0)  # No natural pair was split.
        self.assertGreater(self.call("_wild_structure_opportunity_loss", hand, wild, 2), 0.0)
        self.assertEqual(self.call("_level_response_flexibility_bonus",
                                   state, "seat3", wild, features["combo"]), 0.0)
        self.assertGreater(self.call("_response_material_cost", state, "seat3", wild),
                           self.call("_response_material_cost", state, "seat3", natural))
        self.assertIsNone(guandan.GuandanGame.apply_action(
            copy.deepcopy(state), "seat3", {"type": "play", "card_ids": wild})[1])

    def test_detailed_single_material_cost_does_not_repeat_shape_and_control(self):
        state = self.fixture()
        hand = state["players"]["seat3"]["hand"]
        cards = pick_card_ids(hand, ("♣️2",))
        score = self.score(state, cards)
        standalone = self.call("_response_material_cost", state, "seat3", cards)
        self.assertAlmostEqual(score["shape_value"], -3.9)
        self.assertAlmostEqual(score["control_break_penalty"], -0.8)
        self.assertAlmostEqual(standalone, 15.5365)
        # The standalone resource price includes shape (3.12) and control
        # (0.84). The detailed score owns those costs in separate components.
        self.assertAlmostEqual(score["response_material"], -6.367075)
        self.assertAlmostEqual(standalone + score["response_material"] / 0.55, 3.96)
        self.assertAlmostEqual(score["total"], sum(value for key, value in score.items() if key != "total"))

    def test_bomb_keeps_control_material_cost_when_no_separate_control_term_exists(self):
        state = make_state({"bot": [13, 13, 13, 13, 13, 7, 9], "opp": [6, 8],
                            "mate": [10, 11], "opp2": [4, 5]})
        state["config"].update(bot_blacklist_separate_value=False, bot_trick_boundary_mode="off")
        state["current_turn"] = "opp"
        lead = [state["players"]["opp"]["hand"][0]["id"]]
        self.assertIsNone(guandan.GuandanGame.apply_action(
            state, "opp", {"type": "play", "card_ids": lead})[1])
        for actor in ("mate", "opp2"):
            self.assertIsNone(guandan.GuandanGame.apply_action(
                state, actor, {"type": "pass"})[1])
        self.assertEqual(state["current_turn"], "bot")
        hand = state["players"]["bot"]["hand"]
        cards = [card["id"] for card in hand if card["rank"] == 13][:4]
        self.assertIsNone(guandan.GuandanGame.apply_action(
            copy.deepcopy(state), "bot", {"type": "play", "card_ids": cards})[1])
        score = self.score(state, cards, "bot")
        control = self.call("_control_group_break_penalty", hand, cards, 2)
        without_control = self.call("_response_material_cost", state, "bot", cards,
                                    include_shape_cost=False, include_control_cost=False)
        self.assertGreater(control, 0)
        self.assertNotIn("control_break_penalty", score)
        self.assertAlmostEqual(-score["response_material"] / 0.55 - without_control, control * 1.05)

    def test_hidden_ownership_changes_do_not_change_public_hand_scores(self):
        original = self.fixture()
        changed = copy.deepcopy(original)
        hidden = ["seat0", "seat1", "seat2"]
        pool = [card for actor in hidden for card in changed["players"][actor]["hand"]]
        pool = pool[7:] + pool[:7]
        offset = 0
        for actor in hidden:
            count = len(original["players"][actor]["hand"])
            changed["players"][actor]["hand"] = pool[offset:offset + count]
            offset += count
        self.assertNotEqual(original["players"]["seat0"]["hand"], changed["players"]["seat0"]["hand"])
        cards = pick_card_ids(original["players"]["seat3"]["hand"], ("♣️2",))
        for candidate in (cards, None):
            with self.subTest(candidate="natural_level" if candidate else "pass"):
                original["_ai_eval_cache"] = {}
                changed["_ai_eval_cache"] = {}
                self.assertEqual(self.score(original, candidate), self.score(changed, candidate))


if __name__ == "__main__":
    unittest.main()
