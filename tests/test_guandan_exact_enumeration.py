import copy
import random
import unittest

from game import guandan, guandan_ai
from tests.guandan_history_fixtures import pick_card_ids


def unpruned_full_houses(hand, level, threshold, limit):
    """Slow reference: attempt every rank requirement, including impossible ones."""
    info = guandan._hand_info(hand, level)
    ranks = guandan._ranks_sorted_by_strength(level)
    options = []
    for triple in ranks:
        if guandan._point_order_value(triple, level) <= threshold:
            continue
        for pair in ranks:
            if pair != triple:
                options.extend(guandan._materialize_rank_requirements(
                    hand, level, [(triple, 3), (pair, 2)], limit))
        triples = guandan._materialize_rank_requirements(hand, level, [(triple, 3)], limit)
        for joker_kind in ("jokers_small", "jokers_big"):
            jokers = info[joker_kind]
            if len(jokers) >= 2:
                options.extend(guandan._select_materialization_variants(
                    hand, level, [cards + jokers[:2] for cards in triples], limit))
    return guandan._dedupe_card_sets(options)


class GuandanExactEnumerationTests(unittest.TestCase):
    def test_full_houses_keep_every_reference_materialization_in_order(self):
        deck = guandan._full_deck()
        rng = random.Random(416)
        hands = [(level, rng.sample(deck, count))
                 for level in (2, 7, 14) for count in (5, 9, 18, 27)]
        special_ids = set(pick_card_ids(deck, [
            "♥️2", "♥️2", "♠️3", "♣️3", "♠️4", "♥️4", "♣️4",
            "♠️A", "♣️A", "🃏S", "🃏S", "🃏B", "🃏B",
        ]))
        hands.append((2, [card for card in deck if card["id"] in special_ids]))
        for level, hand in hands:
            for threshold in (0, 60):
                for limit in (1, 3):
                    with self.subTest(level=level, cards=len(hand), threshold=threshold, limit=limit):
                        original = copy.deepcopy(hand)
                        expected = unpruned_full_houses(hand, level, threshold, limit)
                        self.assertEqual(
                            guandan._list_full_house_options(hand, level, threshold, limit), expected)
                        self.assertEqual(hand, original)

    def test_shared_hand_info_is_read_only_and_preserves_physical_variants(self):
        deck = guandan._full_deck()
        ids = set(pick_card_ids(deck, [
            "♥️2", "♥️2", "♠️3", "♣️3", "♠️4", "♥️4", "♣️4",
            "♠️5", "♥️5", "♠️6", "♠️7", "♣️7",
        ]))
        hand = [card for card in deck if card["id"] in ids]
        info = guandan._hand_info(hand, 2)
        original = copy.deepcopy(info)
        for requirements in ([(3, 3), (4, 2)], [(4, 3), (7, 2)],
                             [(rank, 1) for rank in range(3, 8)],
                             [(rank, 2) for rank in range(3, 6)], [(3, 3), (4, 3)]):
            self.assertEqual(
                guandan._materialize_rank_requirements(hand, 2, requirements, 3, info=info),
                guandan._materialize_rank_requirements(hand, 2, requirements, 3),
            )
            self.assertEqual(info, original)

    def test_reentry_cache_tracks_card_faces_level_and_lead_status(self):
        deck = guandan._full_deck()
        ids = pick_card_ids(deck, ["♠️8", "♥️8", "♠️Q", "♥️Q"])
        hand_map = guandan._map_hand_by_id(deck)
        hand = [copy.deepcopy(hand_map[cid]) for cid in ids]
        state = {"players": {"bot": {"hand": hand}}, "level_rank": 2,
                 "current_trick": None, "config": {}}
        cards = ids[:2]

        def score():
            combo = guandan._evaluate_combo(hand[:2], state["level_rank"], {})
            cached = guandan._lead_same_type_reentry_bonus(state, "bot", cards, combo)
            fresh = copy.deepcopy(state)
            fresh.pop("_ai_eval_cache", None)
            reference = guandan_ai.call(
                guandan, "_compute_lead_same_type_reentry_bonus", fresh, "bot", cards, combo)
            self.assertEqual(cached, reference)
            return cached

        self.assertGreater(score(), 0.0)
        self.assertGreater(score(), 0.0)
        # Search reconstruction can reuse physical IDs with different faces.
        for card in hand[2:]:
            card["rank"] = 3
        self.assertEqual(score(), 0.0)
        for card in hand[2:]:
            card["rank"] = 12
        self.assertGreater(score(), 0.0)
        state["level_rank"] = 8
        self.assertEqual(score(), 0.0)
        state["level_rank"] = 2
        self.assertGreater(score(), 0.0)
        state["current_trick"] = {"player_id": "opp"}
        self.assertEqual(score(), 0.0)


if __name__ == "__main__":
    unittest.main()
