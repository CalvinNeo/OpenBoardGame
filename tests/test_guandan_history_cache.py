import copy
import unittest
from unittest import mock

from game import guandan, guandan_ai


class GuandanHistoryCacheTests(unittest.TestCase):
    def setUp(self):
        players = [
            {"player_id": pid, "name": pid, "seat": seat, "is_bot": True}
            for seat, pid in enumerate(("bot", "opp", "mate", "opp2"))
        ]
        self.state = guandan.GuandanGame.init_game({}, players)
        deck = guandan._full_deck()

        def take(rank):
            card = next(card for card in deck if card.get("rank") == rank)
            deck.remove(card)
            return card

        hand = [take(rank) for rank in (5, 7, 9)]
        lead = take(6)
        self.cards = [hand[1]["id"]]
        self.state.update(
            phase="playing", level_rank=2, current_turn="bot", pass_count=0,
            finish_order=[], round_memories=[], pass_limits={}, _ai_eval_cache={},
            known_card_owners={}, visible_card_id=None,
            current_trick={
                "player_id": "opp2", "cards": [lead["id"]],
                "combo": guandan._evaluate_combo([lead], 2, {}),
            },
            trick_plays={"opp2": [lead]},
        )
        self.state["players"]["bot"]["hand"] = hand
        for pid in ("opp", "mate", "opp2"):
            self.state["players"][pid]["hand"] = deck[:10]
            del deck[:10]
        self.state["seen_cards"] = [lead["id"]] + [card["id"] for card in deck]

    def call(self, name, *args):
        return guandan_ai.call(guandan, name, self.state, "bot", *args)

    def add_history(self):
        self.state["round_memories"] = [{
            "round_number": 1, "level_rank": 2,
            "tricks": [{
                "leader_id": "opp2", "winner_id": "opp2", "status": "completed",
                "actions": [{
                    "player_id": "opp2", "type": "play", "combo_type": "pair",
                    "combo_size": 2, "hand_count_after": 10,
                    "cards": [{"label": "♠️3", "rank": 3, "suit": "spades"}],
                }, {"player_id": "bot", "type": "pass"}],
            }],
        }]

    def test_signature_tracks_public_history_but_not_hidden_initial_hands(self):
        self.add_history()
        signature = guandan_ai._public_history_signature(self.state)
        self.assertEqual(signature, guandan_ai._public_history_signature(copy.deepcopy(self.state)))
        variants = (
            ("trick", "leader_id", "mate"),
            ("trick", "winner_id", "mate"),
            ("trick", "status", "in_progress"),
            ("action", "player_id", "mate"),
            ("action", "type", "pass"),
            ("action", "combo_type", "three"),
            ("action", "combo_size", 3),
            ("action", "hand_count_after", 8),
            ("card", "label", "♣️3"),
            ("card", "rank", 4),
        )
        for target, field, value in variants:
            with self.subTest(target=target, field=field):
                changed = copy.deepcopy(self.state)
                trick = changed["round_memories"][-1]["tricks"][-1]
                item = trick if target == "trick" else trick["actions"][0]
                if target == "card":
                    item = item["cards"][0]
                item[field] = value
                self.assertNotEqual(signature, guandan_ai._public_history_signature(changed))
        self.state["round_memories"][-1]["initial_hands"] = {"opp2": [{"rank": 14}]}
        self.assertEqual(signature, guandan_ai._public_history_signature(self.state))

    def test_signature_covers_only_the_current_round_six_recent_tricks(self):
        self.add_history()
        entry = self.state["round_memories"][-1]
        entry["tricks"] = [copy.deepcopy(entry["tricks"][0]) for _ in range(7)]
        signature = guandan_ai._public_history_signature(self.state)
        entry["tricks"][0]["winner_id"] = "mate"
        self.assertEqual(signature, guandan_ai._public_history_signature(self.state))
        entry["tricks"][1]["winner_id"] = "mate"
        self.assertNotEqual(signature, guandan_ai._public_history_signature(self.state))

    def test_heuristic_finalists_and_component_scores_invalidate_on_public_changes(self):
        mutations = (
            ("history", self.add_history),
            ("pass_count", lambda: self.state.update(pass_count=2)),
            ("hand_count", lambda: self.state["players"]["opp"]["hand"].pop()),
            ("seen_cards", lambda: self.state["seen_cards"].pop()),
            ("known_owner", lambda: self.state.update(known_card_owners={52: "mate"})),
            ("pass_limit", lambda: self.state.update(pass_limits={"mate": {"single": 90}})),
        )
        for name, mutate in mutations:
            with self.subTest(change=name):
                self.state["_ai_eval_cache"] = {}
                self.call("_store_heuristic_scored_candidates", 1, [(self.cards, 1.0, {})])
                self.assertIsNotNone(self.call("_get_cached_heuristic_scored_candidates", 1))
                with mock.patch.object(
                    guandan_ai, "_compute_bot_score_components",
                    side_effect=[{"total": 1.0}, {"total": 2.0}],
                ) as compute:
                    self.assertEqual(self.call("_bot_score_components", self.cards, 1)["total"], 1.0)
                    self.assertEqual(self.call("_bot_score_components", self.cards, 1)["total"], 1.0)
                    mutate()
                    self.assertIsNone(self.call("_get_cached_heuristic_scored_candidates", 1))
                    self.assertEqual(self.call("_bot_score_components", self.cards, 1)["total"], 2.0)
                    self.assertEqual(compute.call_count, 2)

    def test_lead_scores_recompute_when_history_changes_without_hand_changes(self):
        self.state["current_trick"] = None
        for scorer, compute_name in (
            ("_lead_option_score", "_compute_lead_option_score"),
            ("_lead_cheap_option_score", "_compute_lead_cheap_option_score"),
        ):
            with self.subTest(scorer=scorer):
                self.state["round_memories"] = []
                self.state["_ai_eval_cache"] = {}
                with mock.patch.object(guandan_ai, compute_name, side_effect=[1.0, 2.0]) as compute:
                    self.assertEqual(self.call(scorer, self.cards), 1.0)
                    self.assertEqual(self.call(scorer, self.cards), 1.0)
                    self.add_history()
                    self.assertEqual(self.call(scorer, self.cards), 2.0)
                    self.assertEqual(compute.call_count, 2)

    def test_pass_components_recompute_for_history_and_response_window(self):
        self.state["current_trick"]["player_id"] = "mate"
        with mock.patch.object(guandan_ai, "_teammate_protect_bonus", side_effect=[1.0, 2.0, 3.0]) as compute:
            self.assertEqual(self.call("_shared_pass_tactical_components")["protect_teammate"], 1.0)
            self.assertEqual(self.call("_shared_pass_tactical_components")["protect_teammate"], 1.0)
            self.add_history()
            self.assertEqual(self.call("_shared_pass_tactical_components")["protect_teammate"], 2.0)
            self.state["pass_count"] = 2
            self.assertEqual(self.call("_shared_pass_tactical_components")["protect_teammate"], 3.0)
            self.assertEqual(compute.call_count, 3)

    def test_response_components_recompute_for_history_and_response_window(self):
        features = self.call("_candidate_features", self.cards)

        def score():
            return self.call("_shared_response_tactical_components", self.cards, features["combo"], features)

        with mock.patch.object(guandan_ai, "_shared_clean_single_relay_bonus", side_effect=[1.0, 2.0, 3.0]) as compute:
            self.assertEqual(score()["clean_single_relay"], 1.0)
            self.assertEqual(score()["clean_single_relay"], 1.0)
            self.add_history()
            self.assertEqual(score()["clean_single_relay"], 2.0)
            self.state["pass_count"] = 2
            self.assertEqual(score()["clean_single_relay"], 3.0)
            self.assertEqual(compute.call_count, 3)


if __name__ == "__main__":
    unittest.main()
