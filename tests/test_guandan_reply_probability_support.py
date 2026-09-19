import copy
import itertools
import unittest
from unittest import mock

from game import guandan, guandan_ai


class GuandanReplyProbabilitySupportTests(unittest.TestCase):
    @staticmethod
    def _take(deck, labels):
        cards = []
        for label in labels:
            card = next(card for card in deck if guandan._card_label(card) == label)
            deck.remove(card)
            cards.append(card)
        return cards

    def _case(self, lead_labels, pool_labels, level_rank=2):
        deck = guandan._full_deck()
        lead = self._take(deck, lead_labels)
        pool = self._take(deck, pool_labels)
        combo = guandan._evaluate_combo(lead, level_rank, {})
        self.assertIsNotNone(combo)
        return combo, pool

    def _probability(self, combo, pool, hand_count, level_rank=2, physical_pool=True):
        counts = {}
        wild_count = 0
        for card in pool:
            if guandan._is_joker(card):
                continue
            if guandan._is_wild(card, level_rank):
                wild_count += 1
            else:
                counts[card["rank"]] = counts.get(card["rank"], 0) + 1
        state = {
            "level_rank": level_rank, "config": {}, "round_memories": [],
            "players": {"opponent": {"hand": pool[:hand_count]}},
        }
        return guandan_ai.call(
            guandan, "_opponent_same_type_reply_probability", state, "opponent",
            combo, len(pool), counts, wild_count,
            unknown_cards=pool if physical_pool else None,
        )

    def _supports(self, combo, pool, hand_count, level_rank=2):
        return guandan_ai.call(
            guandan, "_public_pool_supports_same_type_reply",
            pool, hand_count, level_rank, combo,
        )

    def test_physical_single_probability_matches_every_small_pool_hand(self):
        for level_rank, level_label in ((2, "2"), (7, "7"), (14, "A")):
            for lead_label in ("♠️3", "♠️K", f"♠️{level_label}", "🃏S", "🃏B"):
                combo, pool = self._case(
                    [lead_label],
                    ["🃏B", "🃏S", f"♥️{level_label}", f"♣️{level_label}", "♦️4", "♦️10", "♦️A"],
                    level_rank,
                )
                for hand_count in range(1, 6):
                    hands = list(itertools.combinations(pool, hand_count))
                    winning = sum(any(
                        guandan._compare_combos(
                            combo, guandan._evaluate_combo([card], level_rank, {}), level_rank, {}
                        ) for card in hand
                    ) for hand in hands)
                    with self.subTest(level=level_rank, lead=lead_label, count=hand_count):
                        self.assertAlmostEqual(
                            self._probability(combo, pool, hand_count, level_rank), winning / len(hands)
                        )

    def test_level_and_wild_singles_cannot_beat_equal_level_or_jokers(self):
        for lead in ("♠️2", "🃏S", "🃏B"):
            combo, pool = self._case([lead], ["♣️2", "♥️2", "♣️4"])
            for physical_pool in (False, True):
                self.assertEqual(self._probability(combo, pool, 1, physical_pool=physical_pool), 0.0)

    def test_impossible_structures_receive_no_wild_relief(self):
        cases = (
            (["♠️2", "♣️2"], ["♠️K", "♥️2", "♠️3", "♣️4"]),
            (["♠️9", "♣️9", "♦️9"], ["♠️K", "♥️2", "♠️3", "♣️4"]),
            (["♠️7", "♣️7", "♦️7", "♠️3", "♣️3"],
             ["♠️8", "♣️8", "♥️2", "♠️4", "♣️5"]),
            (["♠️3", "♣️4", "♦️5", "♠️6", "♣️7"],
             ["♦️3", "♠️5", "♠️8", "♠️10", "♥️2"]),
            (["♠️3", "♣️3", "♠️4", "♣️4", "♠️5", "♣️5"],
             ["♠️6", "♣️6", "♠️7", "♥️2", "♠️9", "♠️10"]),
            (["♠️3", "♣️3", "♦️3", "♠️4", "♣️4", "♦️4"],
             ["♠️5", "♣️5", "♠️6", "♥️2", "♠️9", "♠️10"]),
        )
        with mock.patch.object(guandan_ai, "_short_hand_structured_reply_breakdown", return_value=None):
            for lead, pool_labels in cases:
                combo, pool = self._case(lead, pool_labels)
                with self.subTest(combo=combo["type"]):
                    self.assertFalse(self._supports(combo, pool, len(pool)))
                    self.assertEqual(self._probability(combo, pool, len(pool)), 0.0)

    def test_negative_support_is_sound_against_exhaustive_physical_plays(self):
        cases = (
            (["♠️2", "♣️2"], ["🃏B", "🃏B", "♥️2", "♠️K", "♣️K", "♠️3", "♣️4"]),
            (["♠️8", "♣️8", "♦️8"], ["♠️9", "♣️9", "♥️2", "♠️K", "♣️K", "♠️3", "♣️4"]),
            (["♠️7", "♣️7", "♦️7", "♠️3", "♣️3"],
             ["♠️8", "♣️8", "♦️8", "🃏B", "🃏B", "♥️2", "♠️4"]),
            (["♠️3", "♣️4", "♦️5", "♠️6", "♣️7"],
             ["♠️8", "♣️9", "♦️10", "♠️J", "♥️2", "♥️2", "♠️4"]),
            (["♠️3", "♣️3", "♠️4", "♣️4", "♠️5", "♣️5"],
             ["♠️6", "♣️6", "♠️7", "♣️7", "♠️8", "♥️2", "♠️10"]),
            (["♠️3", "♣️3", "♦️3", "♠️4", "♣️4", "♦️4"],
             ["♠️5", "♣️5", "♦️5", "♠️6", "♣️6", "♥️2", "♠️10"]),
        )
        for level_rank in (2, 7, 14):
            for lead, pool_labels in cases:
                combo, pool = self._case(lead, pool_labels, level_rank)
                winning_plays = []
                for cards in itertools.combinations(pool, combo["size"]):
                    reply = guandan._evaluate_combo(list(cards), level_rank, {})
                    if reply and reply["type"] == combo["type"] and guandan._compare_combos(
                        combo, reply, level_rank, {}
                    ):
                        winning_plays.append({card["id"] for card in cards})
                for pool_size in range(1, len(pool) + 1):
                    for subpool in itertools.combinations(pool, pool_size):
                        ids = {card["id"] for card in subpool}
                        for hand_count in range(1, pool_size + 1):
                            if self._supports(combo, list(subpool), hand_count, level_rank):
                                continue
                            # Every winning play in this pool fits at least one
                            # H-card hand exactly when H is large enough.
                            possible = hand_count >= combo["size"] and any(
                                play <= ids for play in winning_plays
                            )
                            with self.subTest(level=level_rank, combo=combo["type"], count=hand_count):
                                self.assertFalse(possible)

    def test_full_house_support_accepts_joker_attachment_and_shared_wilds(self):
        lead = ["♠️7", "♣️7", "♦️7", "♠️3", "♣️3"]
        for labels in (
            ["♠️8", "♣️8", "♦️8", "🃏S", "🃏S"],
            ["♠️8", "♣️8", "♥️2", "♠️4", "♥️2"],
        ):
            combo, pool = self._case(lead, labels)
            before = copy.deepcopy(pool)
            self.assertTrue(self._supports(combo, pool, len(pool)))
            self.assertFalse(self._supports(combo, pool, len(pool) - 1))
            self.assertEqual(pool, before)

    def test_existing_six_card_sampling_remains_authoritative(self):
        combo, pool = self._case(["♠️A"], ["♠️3", "♣️3", "♠️4", "♣️4", "♠️5", "♣️5"])
        with mock.patch.object(
            guandan_ai, "_short_hand_structured_reply_breakdown", return_value={"same_type": 0.375}
        ) as sample:
            self.assertEqual(self._probability(combo, pool, 6), 0.375)
            sample.assert_called_once()


if __name__ == "__main__":
    unittest.main()
