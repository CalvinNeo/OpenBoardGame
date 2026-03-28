import unittest

from game.forest_shuffle import (
    ForestShuffleGame,
    TREE_SPECIES,
    _make_half,
    _make_split_card,
    _make_tree_card,
    _score_all_players,
)


class ForestShuffleGameTests(unittest.TestCase):
    @staticmethod
    def _players():
        return [
            {"player_id": "p1", "name": "Alice", "seat": 0},
            {"player_id": "p2", "name": "Bob", "seat": 1},
        ]

    def _fresh_state(self):
        return ForestShuffleGame.init_game({"seed": 7}, self._players())

    def test_init_uses_expected_two_player_deck_size(self):
        state = self._fresh_state()
        total_cards_in_use = len(state["deck"]) + sum(len(player["hand"]) for player in state["players"].values())
        self.assertEqual(total_cards_in_use, 131)
        self.assertEqual(state["current_turn"], "p1")
        self.assertEqual(state["winter_count"], 0)

    def test_playing_tree_reveals_card_to_clearing(self):
        state = self._fresh_state()
        state["current_turn"] = "p1"
        state["turn_number"] = 1
        sycamore = _make_tree_card("sycamore", 0)
        pay_a = _make_tree_card("birch", 0)
        pay_b = _make_tree_card("beech", 0)
        reveal = _make_split_card("reveal_1", "left_right", _make_half("squeaker", 0), _make_half("wolf", 0))
        state["players"]["p1"]["hand"] = [sycamore, pay_a, pay_b]
        state["players"]["p2"]["hand"] = []
        state["players"]["p1"]["forest"]["trees"] = []
        state["deck"] = [reveal]
        state["clearing"] = []

        events, error = ForestShuffleGame.apply_action(
            state,
            "p1",
            {"type": "play_card", "card_id": sycamore["id"], "pay_card_ids": [pay_a["id"], pay_b["id"]]},
        )

        self.assertIsNone(error)
        self.assertEqual(len(state["players"]["p1"]["forest"]["trees"]), 1)
        self.assertEqual(len(state["clearing"]), 3)
        self.assertEqual(state["current_turn"], "p2")
        self.assertTrue(any(event["type"] == "forest_shuffle:play_tree" for event in events))

    def test_third_winter_ends_immediately(self):
        state = self._fresh_state()
        state["current_turn"] = "p1"
        state["players"]["p1"]["hand"] = []
        state["deck"] = [
            {"id": "winter_a", "kind": "winter", "name": "Winter is coming"},
            {"id": "winter_b", "kind": "winter", "name": "Winter is coming"},
            {"id": "winter_c", "kind": "winter", "name": "Winter is coming"},
        ]

        events, error = ForestShuffleGame.apply_action(
            state,
            "p1",
            {"type": "draw_cards", "sources": [{"zone": "deck"}, {"zone": "deck"}]},
        )

        self.assertIsNone(error)
        self.assertTrue(state["game_over"])
        self.assertEqual(state["winter_count"], 3)
        self.assertIsNone(state["current_turn"])
        self.assertTrue(any(event["type"] == "forest_shuffle:game_over" for event in events))

    def test_sapling_counts_for_sycamore_but_not_tree_species_goal(self):
        state = self._fresh_state()
        player = state["players"]["p1"]
        player["forest"]["trees"] = []
        selected_species = ["beech", "birch", "douglas_fir", "horse_chestnut", "linden_tree", "oak", "sycamore"]
        for index, species in enumerate(selected_species, start=1):
            player["forest"]["trees"].append(
                {
                    "id": f"tree_{index}",
                    "kind": "tree",
                    "species": species,
                    "name": species,
                    "tree_species": species,
                    "slots": {side: [] for side in ("top", "right", "bottom", "left")},
                }
            )
        player["forest"]["trees"].append(
            {
                "id": "tree_sapling",
                "kind": "sapling",
                "species": "sapling",
                "name": "Tree Sapling",
                "tree_species": None,
                "slots": {side: [] for side in ("top", "right", "bottom", "left")},
            }
        )
        player["forest"]["trees"][0]["slots"]["bottom"].append(
            {
                "id": "wild_1",
                "source_card_id": "wild_src",
                "name": "Wild Strawberries",
                "species": "wild_strawberries",
                "side": "bottom",
                "tags": ["plant"],
                "symbol": "oak",
                "hidden_half": {},
                "active_from_turn": 1,
            }
        )
        state["players"]["p2"]["forest"]["trees"] = []

        _score_all_players(state)
        breakdown = {item["entry_id"]: item["points"] for item in player["score_breakdown"]}

        self.assertEqual(breakdown["tree_7"], 8)
        self.assertEqual(breakdown["wild_1"], 0)

    def test_free_play_bonus_skips_played_card_effect(self):
        state = self._fresh_state()
        state["current_turn"] = "p1"
        state["turn_number"] = 1
        silver_fir = _make_tree_card("silver_fir", 0)
        pay_a = _make_tree_card("silver_fir", 1)
        pay_b = _make_tree_card("silver_fir", 2)
        beech_marten_card = _make_split_card("free_1", "left_right", _make_half("beech_marten", 0), _make_half("wolf", 0))
        state["players"]["p1"]["hand"] = [silver_fir, pay_a, pay_b, beech_marten_card]
        state["players"]["p1"]["forest"]["trees"] = []
        state["players"]["p2"]["hand"] = []
        state["deck"] = []
        state["clearing"] = []

        events, error = ForestShuffleGame.apply_action(
            state,
            "p1",
            {"type": "play_card", "card_id": silver_fir["id"], "pay_card_ids": [pay_a["id"], pay_b["id"]]},
        )

        self.assertIsNone(error)
        self.assertEqual((state["pending_action"] or {}).get("type"), "free_play")
        tree_id = state["players"]["p1"]["forest"]["trees"][0]["id"]

        events, error = ForestShuffleGame.apply_action(
            state,
            "p1",
            {"type": "play_card", "card_id": beech_marten_card["id"], "half_index": 0, "target_tree_id": tree_id},
        )

        self.assertIsNone(error)
        self.assertEqual(len(state["players"]["p1"]["hand"]), 0)
        self.assertIsNone(state["pending_action"])
        self.assertEqual(state["current_turn"], "p2")
        self.assertFalse(any(event["type"] == "forest_shuffle:draw" and event["payload"]["reason"] == "beech_marten" for event in events))

    def test_clearing_empties_at_ten_cards(self):
        state = self._fresh_state()
        state["current_turn"] = "p1"
        state["turn_number"] = 1
        tree = {
            "id": "tree_home",
            "kind": "tree",
            "species": "beech",
            "name": "Beech",
            "tree_species": "beech",
            "slots": {side: [] for side in ("top", "right", "bottom", "left")},
        }
        play_card = _make_split_card("play_1", "left_right", _make_half("beech_marten", 0), _make_half("squeaker", 0))
        pay_card = _make_tree_card("birch", 0)
        state["players"]["p1"]["forest"]["trees"] = [tree]
        state["players"]["p1"]["hand"] = [play_card, pay_card]
        state["clearing"] = [_make_tree_card("beech", index) for index in range(1, 10)]
        state["deck"] = []

        events, error = ForestShuffleGame.apply_action(
            state,
            "p1",
            {"type": "play_card", "card_id": play_card["id"], "half_index": 0, "target_tree_id": "tree_home", "pay_card_ids": [pay_card["id"]]},
        )

        self.assertIsNone(error)
        self.assertEqual(len(state["clearing"]), 0)
        self.assertTrue(any(event["type"] == "forest_shuffle:clear_clearing" for event in events))


if __name__ == "__main__":
    unittest.main()
