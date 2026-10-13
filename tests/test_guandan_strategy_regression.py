import unittest

from game import guandan


class GuandanStrategyRegressionTests(unittest.TestCase):
    @staticmethod
    def _pick(deck, label):
        for index, card in enumerate(deck):
            if guandan._card_label(card) == label:
                return deck.pop(index)
        raise AssertionError(f"missing card {label}")

    def _make_premium_pair_response_state(self):
        players = [
            {"player_id": "calvin", "name": "calvin", "seat": 0, "is_bot": False},
            {"player_id": "bot2", "name": "Bot 2", "seat": 1, "is_bot": True},
            {"player_id": "z", "name": "z", "seat": 2, "is_bot": False},
            {"player_id": "bot4", "name": "Bot 4", "seat": 3, "is_bot": True},
        ]
        state = guandan.GuandanGame.init_game({}, players)
        state["config"]["bot_mode"] = "heuristic"
        state.update(
            phase="playing",
            round_number=1,
            dealer_team="A",
            level_rank=2,
            current_turn="bot2",
            current_trick=None,
            trick_plays={},
            pass_count=0,
            finish_order=[],
            round_memories=[],
            known_card_owners={},
        )

        deck = guandan._full_deck()
        hands = {
            "calvin": ["♠️A", "♣️A", "♣️A", "♦️A", "♠️8"],
            "bot2": [
                "♦️2", "♦️2", "♠️8", "♥️8", "♣️8", "♠️7", "♦️7",
                "♠️6", "♣️6", "♦️6", "♠️5", "♣️5", "♣️5", "♦️5",
            ],
            "z": [
                "♥️2", "♠️A", "♥️A", "♥️A", "♠️K", "♥️K", "♥️K",
                "♣️K", "♠️J", "♥️J", "♣️J", "♣️3", "♦️3",
            ],
            "bot4": [
                "♠️2", "♥️2", "♠️10", "♣️10", "♣️10", "♥️9", "♣️9",
                "♦️9", "♦️9", "♥️6", "♣️6", "♦️6", "♠️3", "♦️3",
            ],
        }
        for player_id, labels in hands.items():
            state["players"][player_id]["hand"] = [
                self._pick(deck, label) for label in labels
            ]
            state["players"][player_id].update(finished=False, finish_rank=None)

        lead = [self._pick(deck, "♦️K"), self._pick(deck, "♦️K")]
        prior_play = [self._pick(deck, "♦️10"), self._pick(deck, "♦️10")]
        state["current_trick"] = {
            "player_id": "calvin",
            "cards": [card["id"] for card in lead],
            "combo": guandan._evaluate_combo(lead, 2, {}),
        }
        state["trick_plays"] = {
            "calvin": lead,
            "bot2": prior_play,
            "z": "pass",
            "bot4": "pass",
        }

        # Everything outside the four current hands and the two visible plays
        # has already been seen.  The opponent hands remain an unknown public
        # pool, as they do at the saved decision point.
        state["seen_cards"] = [card["id"] for card in deck]
        state["seen_cards"].extend(card["id"] for card in lead + prior_play)
        state["pass_limits"] = {
            "calvin": {"single": 100},
            "bot2": {"three": 57, "straight": 7},
            "z": {"single": 100, "three": 57, "straight": 7, "pair": 56},
            "bot4": {"single": 100, "three": 57, "straight": 7, "pair": 56},
        }
        return state

    def test_premium_pair_is_discounted_when_teammate_cannot_continue_lane(self):
        state = self._make_premium_pair_response_state()
        hand = state["players"]["bot2"]["hand"]
        pair = [card["id"] for card in hand if guandan._card_label(card) == "♦️2"]
        bomb = [
            card["id"] for card in hand
            if guandan._card_label(card) in {"♠️5", "♣️5", "♦️5"}
        ]

        guandan._filter_overbomb_options(
            state,
            "bot2",
            guandan._list_hint_options(state, "bot2"),
        )
        pair_components = guandan._bot_score_components(state, "bot2", pair, 4)
        bomb_components = guandan._bot_score_components(state, "bot2", bomb, 4)

        self.assertNotIn("protect_teammate_lane", pair_components)
        self.assertLess(pair_components["premium_control_overbomb_risk"], 0.0)
        self.assertLess(pair_components["total"], bomb_components["total"])

    def test_bot_keeps_the_level_pair_and_uses_the_low_bomb(self):
        state = self._make_premium_pair_response_state()
        action = guandan.GuandanGame.bot_move(state, "bot2")

        self.assertEqual(action["type"], "play")
        labels = {
            guandan._card_label(card)
            for card in state["players"]["bot2"]["hand"]
            if card["id"] in action["card_ids"]
        }
        self.assertEqual(labels, {"♠️5", "♣️5", "♦️5"})
        self.assertEqual(len(action["card_ids"]), 4)


if __name__ == "__main__":
    unittest.main()
