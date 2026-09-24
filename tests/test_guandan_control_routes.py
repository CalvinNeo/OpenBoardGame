import copy
import random
import unittest
from unittest import mock

from game import guandan, guandan_ai
from tests.guandan_history_fixtures import pick_card_ids, replay_fixture


class GuandanControlRouteTests(unittest.TestCase):
    def make_state(self, labels, level=2):
        players = [{"player_id": pid, "name": pid, "seat": seat, "is_bot": True}
                   for seat, pid in enumerate(("bot", "opp", "mate", "opp2"))]
        state = guandan.GuandanGame.init_game({"bot_mode": "heuristic"}, players)
        deck = guandan._full_deck()
        own = set(pick_card_ids(deck, labels))
        state["players"]["bot"]["hand"] = [c for c in deck if c["id"] in own]
        deck = [c for c in deck if c["id"] not in own]
        for pid in ("opp", "mate", "opp2"):
            state["players"][pid]["hand"] = deck[:27]
            del deck[:27]
        state.update(current_turn="bot", level_rank=level, current_trick=None,
                     round_memories=[], seen_cards=[c["id"] for c in deck],
                     known_card_owners={}, pass_limits={}, trick_plays={},
                     visible_card_id=None, _ai_eval_cache={})
        return state

    def call(self, name, *args):
        return guandan_ai.call(guandan, name, *args)

    def test_saved_leads_keep_the_level_cards_in_both_modes(self):
        for mode in ("heuristic", "auto"):
            for boundary, expected in ((57, ["♥️3", "♣️3"]), (67, ["♣️6"])):
                with self.subTest(mode=mode, before_action=boundary):
                    state = replay_fixture("546", boundary, {"bot_mode": mode})
                    pid = state["current_turn"]
                    action = guandan.GuandanGame.bot_move(state, pid)
                    hand = guandan._map_hand_by_id(state["players"][pid]["hand"])
                    self.assertEqual([guandan._card_label(hand[c]) for c in action["card_ids"]],
                                     expected)
                    _, error = guandan.GuandanGame.apply_action(copy.deepcopy(state), pid, action)
                    self.assertIsNone(error)
                    explain = state["bot_explain"][pid]
                    self.assertTrue(explain["method_details"]["hand_route_status"]["complete"])
                    self.assertAlmostEqual(explain["chosen"]["score"],
                                           sum(explain["chosen"]["components"].values()))

    def test_low_pairs_keep_a_higher_pair_as_cover_even_below_nine_cards(self):
        for level, high in ((2, "2"), (5, "5"), (2, "A")):
            with self.subTest(level=level, control_rank=high):
                state = self.make_state([
                    "♠️4", "♣️4", "♠️8", "♣️8", "♠️J", "♣️J",
                    f"♠️{high}", f"♣️{high}",
                ], level)
                action = guandan.GuandanGame.bot_move(state, "bot")
                hand = guandan._map_hand_by_id(state["players"]["bot"]["hand"])
                cards = [hand[c] for c in action["card_ids"]]
                self.assertEqual(len(cards), 2)
                self.assertEqual({c["rank"] for c in cards}, {4})

    def test_high_pair_can_lead_to_a_one_combo_finish(self):
        state = self.make_state(["♠️4", "♣️4", "♠️2", "♣️2"])
        for pid in ("opp", "opp2"):
            hand = state["players"][pid]["hand"]
            state["seen_cards"].extend(c["id"] for c in hand[2:])
            state["players"][pid]["hand"] = hand[:2]
        action = guandan.GuandanGame.bot_move(state, "bot")
        hand = guandan._map_hand_by_id(state["players"]["bot"]["hand"])
        self.assertEqual([hand[c]["rank"] for c in action["card_ids"]], [2, 2])

    def test_recovery_sheds_a_group_without_spending_another_lead(self):
        combos = [{"type": "pair", "size": 2, "rank_value": value}
                  for value in (50, 54, 80)]

        def replies(combo):
            probability = float(combo["rank_value"] < 79)
            return probability, 0.0, 0.0, 0.0, probability

        values = self.call("_hand_route_plan_values", combos, replies, 1.0, 2, {})
        low, high = (values[guandan_ai._hand_route_key(combos[i])] for i in (0, 2))
        self.assertEqual(low["lead_turns"], 2.0)
        self.assertEqual(low["entry_risk"], 0.0)
        self.assertEqual(high["lead_turns"], 3.0)
        self.assertEqual(high["entry_risk"], 1.0)

    def test_near_certain_overcall_does_not_become_certain_recovery(self):
        combos = [{"type": "single", "size": 1, "rank_value": value}
                  for value in (50, 58)]

        def replies(combo):
            probability = 1.0 if combo["rank_value"] < 57 else 0.999
            return probability, 0.0, 0.0, 0.0, probability

        values = self.call("_hand_route_plan_values", combos, replies, 1.0, 2, {})
        low = values[guandan_ai._hand_route_key(combos[0])]
        self.assertAlmostEqual(low["entry_risk"], 0.999)
        self.assertAlmostEqual(low["lead_turns"], 1.999)

    def test_saved_route_and_quick_choice_ignore_hidden_hand_allocations(self):
        state = replay_fixture("546", 57)
        pid = state["current_turn"]
        original = copy.deepcopy(state)
        pool = [c for player, data in state["players"].items()
                if player != pid for c in data["hand"]]
        random.Random(98).shuffle(pool)
        for player, data in state["players"].items():
            if player != pid:
                count = len(data["hand"])
                data["hand"] = pool[:count]
                del pool[:count]
        panels = []
        choices = []
        for current in (original, state):
            options = guandan._list_hint_options(current, pid)
            self.call("_prepare_hand_route_scores", current, pid, options)
            panels.append(current["_ai_eval_cache"]["hand_routes"])
            incumbent = max(options, key=lambda cards:
                            self.call("_lead_cheap_option_score", current, pid, cards))
            choices.append(self.call("_hand_route_control_challenger", current, pid,
                                     incumbent, options) or incumbent)
        self.assertEqual(panels[0], panels[1])
        self.assertEqual(choices[0], choices[1])
        self.assertEqual(len(choices[0]), 1)

    def test_completed_route_remains_the_fallback_when_final_scoring_expires(self):
        state = replay_fixture("546", 67)
        pid = state["current_turn"]
        options = guandan._list_hint_options(state, pid)
        self.call("_prepare_hand_route_scores", state, pid, options)
        # The panel completed earlier in this decision; no finalist can start.
        with mock.patch.object(guandan_ai.time, "perf_counter", return_value=2.0):
            cards = self.call("_bot_select_play", state, pid, 4, 1.0)
        hand = guandan._map_hand_by_id(state["players"][pid]["hand"])
        self.assertEqual([guandan._card_label(hand[c]) for c in cards], ["♣️6"])
        self.assertEqual(state["_ai_eval_cache"]["heuristic_anytime"]["evaluated"], 0)

    def test_local_hold_reward_cannot_reverse_a_better_control_allocation(self):
        state = replay_fixture("546", 57)
        pid = state["current_turn"]
        hand = state["players"][pid]["hand"]
        options = guandan._list_hint_options(state, pid)
        self.call("_prepare_hand_route_scores", state, pid, options)
        cash_out = pick_card_ids(hand, ["♠️2", "♣️2", "♣️2", "♥️3", "♣️3"])
        keep_control = pick_card_ids(hand, ["♦️Q"])
        scored = [(cash_out, 100.0, {"lead_hold": 100.0, "total": 100.0}),
                  (keep_control, 0.0, {"total": 0.0})]
        self.call("_apply_hand_route_order", state, pid, scored)
        self.assertEqual(max(scored, key=lambda item: item[1])[0], keep_control)
        self.assertLess(scored[0][2]["hand_route_control"], 0.0)


if __name__ == "__main__":
    unittest.main()
