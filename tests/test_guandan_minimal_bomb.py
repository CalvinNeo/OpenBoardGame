import unittest

from game import guandan, guandan_ai
from tests.guandan_history_fixtures import pick_card_ids


class GuandanMinimalBombTests(unittest.TestCase):
    def make_position(self):
        players = [
            {"player_id": player_id, "name": player_id, "seat": seat,
             "is_bot": player_id == "bot2"}
            for seat, player_id in enumerate(("enemy", "bot2", "mate", "other"))
        ]
        state = guandan.GuandanGame.init_game({"bot_mode": "heuristic"}, players)
        state.update(level_rank=2, phase="playing", current_turn="bot2")
        deck = guandan._full_deck()

        def take(labels):
            ids = set(pick_card_ids(deck, labels))
            cards = [card for card in deck if card["id"] in ids]
            deck[:] = [card for card in deck if card["id"] not in ids]
            return cards

        bot_hand = take([
            "♠️4", "♠️8", "♠️9", "♠️Q", "♥️8", "♥️Q", "♣️Q",
            "♠️10", "♠️J", "♥️Q", "♥️A",
        ])
        lead = take(["♣️K", "♦️K", "♦️K", "♥️3", "♠️3"])
        enemy_tail = take(["🃏B"])
        state["players"]["bot2"]["hand"] = bot_hand
        state["players"]["enemy"]["hand"] = enemy_tail
        state["players"]["mate"]["hand"] = deck[:27]
        state["players"]["other"]["hand"] = deck[27:]
        state["current_trick"] = {
            "player_id": "enemy",
            "cards": [card["id"] for card in lead],
            "combo": guandan._evaluate_combo(lead, 2, state["config"]),
        }
        state["trick_plays"] = {"enemy": lead}
        state["seen_cards"] = [card["id"] for card in lead]
        state["pass_count"] = 0
        return state

    def test_stronger_straight_flush_removes_minimal_bomb_bonus(self):
        state = self.make_position()
        hand = state["players"]["bot2"]["hand"]
        qqqq = pick_card_ids(hand, ["♠️Q", "♣️Q", "♥️Q", "♥️Q"])
        straight_flush = pick_card_ids(hand, ["♠️8", "♠️9", "♠️10", "♠️J", "♠️Q"])

        self.assertEqual(
            guandan_ai.call(
                guandan, "_defer_bomb_upgrade_risk_penalty", state, "bot2"
            ),
            0.0,
        )
        q_score = guandan._bot_score_components(state, "bot2", qqqq, 4)
        sf_score = guandan._bot_score_components(state, "bot2", straight_flush, 4)
        self.assertNotIn("bomb_stall_escape", q_score)
        self.assertGreater(sf_score["total"], q_score["total"])

        action = guandan.GuandanGame.bot_move(state, "bot2")
        played = [card for card in hand if card["id"] in action["card_ids"]]
        self.assertEqual(guandan._evaluate_combo(played, 2, state["config"])["type"], "straight_flush")

    def test_single_legal_bomb_has_no_minimal_choice_bonus(self):
        state = self.make_position()
        hand = state["players"]["bot2"]["hand"]
        qqqq = pick_card_ids(hand, ["♠️Q", "♣️Q", "♥️Q", "♥️Q"])
        keep = set(qqqq) | set(pick_card_ids(hand, ["♠️4", "♥️8", "♥️A"]))
        state["players"]["bot2"]["hand"] = [card for card in hand if card["id"] in keep]

        options = guandan_ai.call(
            guandan,
            "_list_bomb_options",
            state["players"]["bot2"]["hand"],
            2,
            state["current_trick"]["combo"],
            state["config"],
        )
        self.assertEqual(len(options), 1)
        score = guandan._bot_score_components(state, "bot2", qqqq, 4)
        self.assertNotIn("bomb_stall_escape", score)


if __name__ == "__main__":
    unittest.main()
