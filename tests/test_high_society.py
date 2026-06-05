import unittest

from game.high_society import HighSocietyGame, _finalize_game, _resolve_normal_auction, _reveal_next_status


def players(count=3):
    return [
        {"player_id": f"p{i}", "name": f"P{i}", "seat": i, "is_bot": False}
        for i in range(count)
    ]


def card(card_id, card_type, value=None, effect=None, end=False):
    data = {"id": card_id, "type": card_type, "is_end_marker": end}
    if value is not None:
        data["value"] = value
    if effect is not None:
        data["effect"] = effect
    return data


class HighSocietyGameTest(unittest.TestCase):
    def test_normal_auction_can_award_free_card_to_last_remaining_player(self):
        state = HighSocietyGame.init_game({}, players(3))
        state["phase"] = "normal_auction"
        state["current_status"] = card("luxury_5", "luxury", value=5)
        state["start_player"] = "p0"
        state["current_turn"] = "p0"
        state["active_players"] = ["p0", "p1", "p2"]
        state["current_high_bid"] = 0

        events, error = HighSocietyGame.apply_action(state, "p0", {"type": "pass"})
        self.assertIsNone(error)
        self.assertEqual(events[0]["type"], "high_society:pass")
        events, error = HighSocietyGame.apply_action(state, "p1", {"type": "pass"})

        self.assertIsNone(error)
        self.assertEqual(state["phase"], "round_summary")
        self.assertEqual(state["last_round_summary"]["winner"], "p2")
        self.assertEqual(state["last_round_summary"]["paid_total"], 0)
        self.assertEqual([c["id"] for c in state["players"]["p2"]["status_cards"]], ["luxury_5"])

    def test_disgrace_pass_returns_taker_money_and_discards_others_table_money(self):
        state = HighSocietyGame.init_game({}, players(3))
        state["phase"] = "disgrace_auction"
        state["current_status"] = card("passe", "disgrace", effect="minus_5")
        state["start_player"] = "p0"
        state["current_turn"] = "p0"
        state["active_players"] = ["p0", "p1", "p2"]
        state["players"]["p0"]["hand_money"].remove(4000)
        state["players"]["p0"]["table_money"] = [4000]
        state["players"]["p1"]["hand_money"].remove(6000)
        state["players"]["p1"]["table_money"] = [6000]
        state["players"]["p2"]["hand_money"].remove(8000)
        state["players"]["p2"]["table_money"] = [8000]

        events, error = HighSocietyGame.apply_action(state, "p0", {"type": "pass"})

        self.assertIsNone(error)
        self.assertEqual(events[0]["type"], "high_society:disgrace_taken")
        self.assertIn(4000, state["players"]["p0"]["hand_money"])
        self.assertNotIn(6000, state["players"]["p1"]["hand_money"])
        self.assertNotIn(8000, state["players"]["p2"]["hand_money"])
        self.assertEqual(state["players"]["p1"]["spent_money_count"], 1)
        self.assertEqual(state["players"]["p2"]["spent_money_count"], 1)
        self.assertEqual([c["id"] for c in state["players"]["p0"]["status_cards"]], ["passe"])
        self.assertEqual(state["phase"], "round_summary")

    def test_faux_pas_pending_discards_next_luxury_not_prestige(self):
        state = HighSocietyGame.init_game({}, players(3))
        state["players"]["p0"]["status_cards"] = [card("faux_pas", "disgrace", effect="discard_luxury")]
        state["players"]["p0"]["pending_faux_pas"] = True
        state["current_status"] = card("prestige_1", "prestige", effect="double", end=True)
        summary = _resolve_normal_auction(state, "p0")

        self.assertIsNone(summary["discarded_luxury"])
        self.assertTrue(state["players"]["p0"]["pending_faux_pas"])
        self.assertIn("prestige_1", [c["id"] for c in state["players"]["p0"]["status_cards"]])

        state["current_status"] = card("luxury_7", "luxury", value=7)
        summary = _resolve_normal_auction(state, "p0")

        self.assertEqual(summary["discarded_luxury"]["id"], "luxury_7")
        self.assertFalse(state["players"]["p0"]["pending_faux_pas"])
        self.assertNotIn("faux_pas", [c["id"] for c in state["players"]["p0"]["status_cards"]])
        self.assertNotIn("luxury_7", [c["id"] for c in state["players"]["p0"]["status_cards"]])

    def test_fourth_end_marker_ends_without_awarding_revealed_card(self):
        state = HighSocietyGame.init_game({}, players(3))
        state["status_deck"] = [card("scandale", "disgrace", effect="halve", end=True)]
        state["end_marker_revealed_count"] = 3
        state["game_over"] = False

        _reveal_next_status(state)

        self.assertTrue(state["game_over"])
        self.assertEqual(state["phase"], "game_over")
        self.assertEqual(state["final_results"]["unauctioned_card"]["id"], "scandale")
        for pdata in state["players"].values():
            self.assertNotIn("scandale", [c["id"] for c in pdata["status_cards"]])

    def test_lowest_remaining_money_is_eliminated_before_score(self):
        state = HighSocietyGame.init_game({}, players(3))
        state["players"]["p0"]["hand_money"] = [1000]
        state["players"]["p0"]["status_cards"] = [card("luxury_10", "luxury", value=10)]
        state["players"]["p1"]["hand_money"] = [1000, 2000]
        state["players"]["p1"]["status_cards"] = [card("luxury_1", "luxury", value=1)]
        state["players"]["p2"]["hand_money"] = [1000, 2000, 3000]
        state["players"]["p2"]["status_cards"] = [card("luxury_2", "luxury", value=2)]

        _finalize_game(state, unauctioned_card=None)

        self.assertTrue(state["players"]["p0"]["eliminated"])
        self.assertEqual(state["winner"], ["p2"])


if __name__ == "__main__":
    unittest.main()
