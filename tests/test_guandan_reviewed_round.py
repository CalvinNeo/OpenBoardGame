import unittest
from unittest import mock

from game import guandan


class GuandanReviewedRoundRegressionTests(unittest.TestCase):
    """End-to-end regressions taken from room 15b83d, round 1."""

    PLAYERS = [
        {"player_id": "calvin", "name": "calvin", "seat": 0, "is_bot": False},
        {"player_id": "bot3", "name": "Bot 3", "seat": 1, "is_bot": True},
        {"player_id": "zhu", "name": "zhu", "seat": 2, "is_bot": False},
        {"player_id": "bot4", "name": "Bot 4", "seat": 3, "is_bot": True},
    ]

    BOT3_TAIL = [
        "♥️2",
        "♥️7",
        "♣️7",
        "♥️6",
        "♥️6",
        "♦️6",
        "♠️6",
        "♣️5",
        "♠️5",
        "♥️4",
        "♣️4",
        "♣️4",
    ]

    @staticmethod
    def _take_labels(available, labels):
        picked = []
        for label in labels:
            for index, card in enumerate(available):
                if guandan._card_label(card) == label:
                    picked.append(available.pop(index))
                    break
            else:
                raise AssertionError(f"missing card {label}")
        return picked

    def _make_state(self, hands, current_turn, *, finished=()):
        state = guandan.GuandanGame.init_game({}, self.PLAYERS)
        state["phase"] = "playing"
        state["round_number"] = 1
        state["dealer_team"] = "B"
        state["level_rank"] = 2
        state["current_turn"] = current_turn
        state["current_trick"] = None
        state["trick_plays"] = {}
        state["pass_count"] = 0
        state["config"]["bot_mode"] = "heuristic"
        state["config"]["bot_search_depth"] = 4
        state["config"]["bot_think_time_ms"] = 2000

        available = guandan._full_deck()
        for player_id, labels in hands.items():
            state["players"][player_id]["hand"] = self._take_labels(available, labels)

        state["finish_order"] = list(finished)
        for rank, player_id in enumerate(finished, start=1):
            state["players"][player_id]["hand"] = []
            state["players"][player_id]["finished"] = True
            state["players"][player_id]["finish_rank"] = rank

        hand_ids = {
            card["id"]
            for player in state["players"].values()
            for card in player.get("hand", [])
        }
        state["seen_cards"] = [
            card["id"] for card in guandan._full_deck() if card["id"] not in hand_ids
        ]
        return state, available

    def _set_current_trick(self, state, available, player_id, labels, *, prior_plays=None):
        cards = self._take_labels(available, labels)
        state["current_trick"] = {
            "player_id": player_id,
            "cards": [card["id"] for card in cards],
            "combo": guandan._evaluate_combo(
                cards,
                state["level_rank"],
                state.get("config", {}),
            ),
        }
        state["trick_plays"] = dict(prior_plays or {})
        state["trick_plays"][player_id] = cards
        return cards

    @staticmethod
    def _chosen_cards(state, player_id, action):
        hand_map = guandan._map_hand_by_id(state["players"][player_id]["hand"])
        return [hand_map[card_id] for card_id in action.get("card_ids", [])]

    def test_bot4_uses_heavenly_as_last_defender_against_eight_card_enemy_bomb(self):
        state, available = self._make_state(
            {
                "calvin": [
                    "♠️A",
                    "♥️A",
                    "♥️A",
                    "♣️A",
                    "♥️K",
                    "♥️J",
                    "♠️J",
                    "♣️J",
                ],
                "bot3": self.BOT3_TAIL,
                "zhu": [
                    "♠️K",
                    "♦️9",
                    "♠️9",
                    "♦️7",
                    "♣️7",
                    "♥️5",
                    "♣️5",
                    "♦️5",
                    "♦️5",
                    "♠️4",
                    "♥️4",
                    "♦️4",
                ],
                "bot4": [
                    "🃏B",
                    "🃏B",
                    "🃏S",
                    "🃏S",
                    "♦️2",
                    "♠️2",
                    "♣️Q",
                    "♥️Q",
                    "♣️9",
                    "♥️9",
                    "♦️9",
                    "♦️8",
                    "♣️8",
                    "♥️8",
                    "♠️7",
                    "♦️4",
                ],
            },
            "bot4",
        )
        previous_full_house = self._take_labels(
            available,
            ["♥️K", "♠️K", "♣️K", "♣️J", "♦️J"],
        )
        self._set_current_trick(
            state,
            available,
            "calvin",
            ["♥️2", "♠️3", "♦️3", "♦️3"],
            prior_plays={"bot3": "pass", "zhu": "pass", "bot4": previous_full_house},
        )
        state["pass_count"] = 2

        action = guandan.GuandanGame.bot_move(state, "bot4")

        # Passing gives an eight-card opponent the lead even though Bot 4 owns
        # the unbeatable response and every other active player has passed.
        self.assertEqual(action.get("type"), "play")
        chosen = self._chosen_cards(state, "bot4", action)
        combo = guandan._evaluate_combo(chosen, state["level_rank"], state.get("config", {}))
        self.assertEqual(combo.get("type"), "heavenly")

        # Auto mode must not let a noisy MCTS result override the same forced
        # defensive play. Keep the search itself mocked so this remains fast
        # and deterministic.
        state["config"]["bot_mode"] = "auto"
        fake_scores = [
            (
                {"type": "pass"},
                99.0,
                1,
                {
                    "avg": 99.0,
                    "adjusted": 99.0,
                    "std": 0.0,
                    "win_rate": 1.0,
                    "min": 99.0,
                    "max": 99.0,
                },
            )
        ]
        with mock.patch.object(
            guandan,
            "_mcts_pick_action",
            return_value=({"type": "pass"}, fake_scores),
        ) as mcts_pick:
            auto_action = guandan.GuandanGame.bot_move(state, "bot4")

        mcts_pick.assert_called_once()
        self.assertEqual(auto_action.get("type"), "play")
        auto_chosen = self._chosen_cards(state, "bot4", auto_action)
        auto_combo = guandan._evaluate_combo(
            auto_chosen,
            state["level_rank"],
            state.get("config", {}),
        )
        self.assertEqual(auto_combo.get("type"), "heavenly")

    def test_bot4_does_not_feed_low_single_to_seven_card_enemy_after_taking_lead(self):
        state, _ = self._make_state(
            {
                "calvin": [],
                "bot3": self.BOT3_TAIL,
                "zhu": ["♠️K", "♦️9", "♠️9", "♥️5", "♣️5", "♦️5", "♦️5"],
                "bot4": [
                    "🃏B",
                    "🃏B",
                    "🃏S",
                    "🃏S",
                    "♦️2",
                    "♠️2",
                    "♣️9",
                    "♥️9",
                    "♦️9",
                    "♠️7",
                    "♦️4",
                ],
            },
            "bot4",
            finished=("calvin",),
        )

        action = guandan.GuandanGame.bot_move(state, "bot4")

        self.assertEqual(action.get("type"), "play")
        labels = sorted(
            guandan._card_label(card)
            for card in self._chosen_cards(state, "bot4", action)
        )
        self.assertIn(
            labels,
            [
                sorted(["♦️2", "♠️2"]),
                sorted(["♣️9", "♥️9", "♦️9"]),
            ],
        )

    def test_bot3_does_not_pass_as_last_defender_against_six_card_enemy(self):
        state, available = self._make_state(
            {
                "calvin": [],
                "bot3": self.BOT3_TAIL,
                "zhu": ["♦️9", "♠️9", "♥️5", "♣️5", "♦️5", "♦️5"],
                "bot4": [
                    "🃏B",
                    "🃏B",
                    "🃏S",
                    "🃏S",
                    "♦️2",
                    "♠️2",
                    "♣️9",
                    "♥️9",
                    "♦️9",
                    "♠️7",
                ],
            },
            "bot3",
            finished=("calvin",),
        )
        self._set_current_trick(
            state,
            available,
            "zhu",
            ["♠️K"],
            prior_plays={"bot3": "pass", "bot4": "pass"},
        )
        state["pass_count"] = 1

        action = guandan.GuandanGame.bot_move(state, "bot3")

        # Bot 3 is the final defender in this trick and has a legal level-card
        # takeover; passing hands the lead to the six-card opponent.
        self.assertEqual(action.get("type"), "play")
        chosen = self._chosen_cards(state, "bot3", action)
        combo = guandan._evaluate_combo(chosen, state["level_rank"], state.get("config", {}))
        self.assertIn(combo.get("type"), {"single", "bomb"})
