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


def unpruned_runs(hand, level, threshold, limit, size, length):
    """Materialize every sequence before discovering that most cannot exist."""
    options = []
    sequences = [
        ([14 if rank == 1 else rank for rank in range(start, start + length)], start + length - 1)
        for start in range(1, 16 - length)
    ]
    hand_map = guandan._map_hand_by_id(hand)
    for ranks, high in sequences:
        if high <= threshold:
            continue
        requirements = [(rank, size) for rank in ranks]
        generation_limit = limit if size != 1 or limit <= 1 else max(limit, min(8, limit * 2))
        variants = guandan._materialize_rank_requirements(hand, level, requirements, generation_limit)
        if size != 1:
            options.extend(variants)
            continue
        def ordinary(cards):
            combo = guandan._evaluate_combo([hand_map[cid] for cid in cards], level, {})
            return combo and combo["type"] == "straight"
        variants = [cards for cards in variants if ordinary(cards)]
        if limit <= 1:
            if not variants:
                variants = [cards for cards in guandan._materialize_rank_requirements(
                    hand, level, requirements, 2) if ordinary(cards)]
            options.extend(variants[:1])
        else:
            options.extend(guandan._select_materialization_variants(hand, level, variants, limit))
    return guandan._dedupe_card_sets(options)


class GuandanExactEnumerationTests(unittest.TestCase):
    def _cards(self, labels):
        deck = guandan._full_deck()
        cards = []
        for label in labels:
            card = next(card for card in deck if guandan._card_label(card) == label)
            deck.remove(card)
            cards.append(card)
        return cards

    def test_wild_six_keeps_both_meanings_and_uses_table_type_on_reply(self):
        cards = self._cards(["♠️5", "♥️5", "♣️6", "♦️6", "♥️2", "♥️2"])
        options = guandan._evaluate_combo_options(cards, 2, {})
        self.assertEqual({combo["type"] for combo in options}, {"three_pairs", "steel_plate"})
        self.assertEqual(guandan._evaluate_combo_for_type(cards, 2, {}, "steel_plate")["type"],
                         "steel_plate")

        players = [
            {"player_id": pid, "name": pid, "seat": seat, "is_bot": True}
            for seat, pid in enumerate(("bot", "opp", "mate", "opp2"))
        ]
        state = guandan.GuandanGame.init_game({}, players)
        deck = guandan._full_deck()
        used = {card["id"] for card in cards}
        deck = [card for card in deck if card["id"] not in used]
        lead = []
        for rank in (3, 3, 3, 4, 4, 4):
            card = next(card for card in deck if card.get("rank") == rank)
            deck.remove(card)
            lead.append(card)
        state["players"]["bot"]["hand"] = cards
        for pid in ("opp", "mate", "opp2"):
            state["players"][pid]["hand"], deck = deck[:20], deck[20:]
        state.update(
            phase="playing", current_turn="bot", level_rank=2,
            current_trick={"player_id": "opp", "cards": [card["id"] for card in lead],
                           "combo": guandan._evaluate_combo(lead, 2, {})},
            round_memories=[], known_card_owners={}, visible_card_id=None,
            pass_limits={}, seen_cards=[card["id"] for card in deck + lead],
            trick_plays={"opp": lead}, pass_count=0, finish_order=[], _ai_eval_cache={},
        )
        ids = [card["id"] for card in cards]
        self.assertTrue(guandan._can_play_all(cards, 2, {}, state["current_trick"]["combo"]))
        self.assertIn(set(ids), [set(option) for option in guandan._list_hint_options(state, "bot")])
        for name in ("_hand_has_same_type_beat", "_hand_can_beat_combo"):
            self.assertTrue(guandan_ai.call(guandan, name, cards, 2, state["current_trick"]["combo"], {}))
        self.assertEqual(guandan_ai.call(guandan, "_action_combo", state, "bot",
                                       {"type": "play", "card_ids": ids})["type"], "steel_plate")
        # Context is part of the feature cache identity; a lead has the canonical
        # three-pairs meaning, while a response retains the steel-plate meaning.
        trick = state["current_trick"]
        state["current_trick"] = None
        self.assertEqual(guandan_ai.call(guandan, "_action_combo", state, "bot",
                                       {"type": "play", "card_ids": ids})["type"], "three_pairs")
        state["current_trick"] = trick
        for mode in ("heuristic", "auto"):
            trial = copy.deepcopy(state)
            trial["config"]["bot_mode"] = mode
            self.assertEqual(set(guandan.GuandanGame.bot_move(trial, "bot")["card_ids"]), set(ids))
        _, error = guandan.GuandanGame.apply_action(
            state, "bot", {"type": "play", "card_ids": [card["id"] for card in cards]}
        )
        self.assertIsNone(error)
        self.assertEqual(state["current_trick"]["combo"]["type"], "steel_plate")

    def test_straight_materializer_can_keep_a_natural_bomb_card(self):
        hand = self._cards(["♠️3", "♥️4", "♠️5", "♥️5", "♣️5", "♦️5", "♦️6", "♠️7", "♥️2"])
        # Use the default policy's three materializations, not an enlarged
        # panel that could hide pruning of the strategic alternative.
        options = guandan._list_straight_options(hand, 2, 0, 3)
        target = {card["id"] for card in hand if guandan._card_label(card) in
                  {"♠️3", "♥️4", "♦️6", "♠️7", "♥️2"}}
        self.assertIn(target, [set(option) for option in options])

    def test_bomb_candidates_cover_nine_and_ten_cards_and_heavenly_stays_top(self):
        deck = guandan._full_deck()
        rank_cards = [card for card in deck if card.get("rank") == 3]
        wilds = [card for card in deck if guandan._is_wild(card, 2)]
        for size in (9, 10):
            hand = rank_cards + wilds[: size - len(rank_cards)]
            candidates = guandan_ai.call(guandan, "_find_bomb_candidates", hand, 2, 3)
            self.assertIn(size, {len(candidate["cards"]) for candidate in candidates})
        heavenly = guandan._evaluate_combo([card for card in deck if card.get("joker")], 2, {})
        for size in (9, 10):
            bomb = guandan._evaluate_combo(rank_cards + wilds[:size - 8], 2, {})
            for tier in (7, heavenly["tier"]):
                saved_heavenly = dict(heavenly, tier=tier)
                self.assertFalse(guandan._compare_combos(saved_heavenly, bomb, 2, {}))
                self.assertTrue(guandan._compare_combos(bomb, saved_heavenly, 2, {}))

    def test_card_strength_matches_rank_order_for_every_level_and_card(self):
        for level in range(2, 15):
            ordinary = [rank for rank in range(14, 1, -1) if rank != level]
            for card in guandan._full_deck():
                joker, rank = card.get("joker"), card.get("rank")
                expected = (100 if joker == "big" else 90 if joker == "small" else
                            80 if rank == level else 60 - ordinary.index(rank))
                self.assertEqual(guandan._point_order_value(rank, level, joker), expected)
                self.assertEqual(guandan._single_order_value(card, level),
                                 70 if not joker and rank == level else expected)

    def test_feasibility_checks_keep_all_groups_runs_and_straight_flush_fallbacks(self):
        deck = guandan._full_deck()
        rng = random.Random(293)
        hands = [(level, rng.sample(deck, count))
                 for level in (2, 7, 14) for count in (5, 9, 18, 27)]
        for labels in (
            ["♥️2", "♥️2", "♠️3", "♣️3", "♠️4", "♥️4", "♣️4", "♠️5", "♣️5", "♠️6", "♠️7"],
            ["♠️2", "♠️3", "♠️4", "♠️5", "♠️6", "♥️4", "♣️4", "♦️4", "🃏S", "🃏S"],
        ):
            ids = pick_card_ids(deck, labels)
            hands.append((2, [guandan._map_hand_by_id(deck)[cid] for cid in ids]))
        for level, hand in hands:
            info = guandan._hand_info(hand, level)
            original = copy.deepcopy(info)
            for threshold in (0, 6, 60):
                for limit in (1, 3):
                    with self.subTest(level=level, count=len(hand), threshold=threshold, limit=limit):
                        for fn, size, length in (
                            (guandan._list_straight_options, 1, 5),
                            (guandan._list_three_pairs_options, 2, 3),
                            (guandan._list_steel_plate_options, 3, 2),
                        ):
                            expected = unpruned_runs(hand, level, threshold, limit, size, length)
                            self.assertEqual(fn(hand, level, threshold, limit), expected)
                            self.assertEqual(fn(hand, level, threshold, limit, info=info), expected)
                        for size in (2, 3):
                            expected = []
                            for rank in guandan._ranks_sorted_by_strength(level):
                                if guandan._point_order_value(rank, level) > threshold:
                                    expected.extend(guandan._materialize_rank_requirements(
                                        hand, level, [(rank, size)], limit))
                            if size == 2:
                                for name, value in (("jokers_big", 100), ("jokers_small", 90)):
                                    if len(info[name]) >= 2 and value > threshold:
                                        expected.append(info[name][:2])
                            expected = guandan._dedupe_card_sets(expected)
                            self.assertEqual(guandan._list_rank_group_options(
                                hand, level, threshold, size, limit, info=info), expected)
                        self.assertEqual(info, original)

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
