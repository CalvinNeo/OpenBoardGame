import unittest

from game.things_in_rings import ThingsInRingsGame


def _players(count: int = 3):
    return [
        {
            "player_id": f"p{index + 1}",
            "name": f"Player {index + 1}",
            "seat": index,
            "is_bot": False,
        }
        for index in range(count)
    ]


class ThingsInRingsGameTests(unittest.TestCase):
    def test_seed_clue_uses_word_auto_rule(self):
        state = ThingsInRingsGame.init_game({"ring_count": 1, "ring_types": ["word"]}, _players(3))
        state["rings"] = [
            {
                "id": "word_len_2",
                "ring_index": 0,
                "type": "word",
                "text": "名称恰好 2 个字",
                "evaluation_mode": "auto",
                "evaluator": {"kind": "char_count_eq", "value": 2},
            }
        ]
        state["knower_hand"] = [{"id": "t1", "name": "手机"}]
        state["thing_deck"] = [
            {"id": "d1", "name": "雨伞"},
            {"id": "d2", "name": "书包"},
            {"id": "d3", "name": "台灯"},
            {"id": "d4", "name": "镜子"},
            {"id": "d5", "name": "帽子"},
            {"id": "d6", "name": "电风扇"},
            {"id": "d7", "name": "吹风机"},
            {"id": "d8", "name": "茶杯"},
            {"id": "d9", "name": "吉他"},
            {"id": "d10", "name": "牙刷"}
        ]
        state["seed_clues_remaining"] = 1

        events, error = ThingsInRingsGame.apply_action(
            state,
            state["knower_id"],
            {"type": "submit_seed_clue", "hand_index": 0, "memberships": [True]},
        )

        self.assertIsNone(error)
        self.assertTrue(any(evt["type"] == "things_in_rings:phase_play" for evt in events))
        self.assertEqual(state["board_cards"][0]["zone_id"], "1")
        self.assertEqual(state["phase"], "play")

    def test_wrong_auto_guess_draws_and_passes_turn(self):
        state = ThingsInRingsGame.init_game({"ring_count": 1, "ring_types": ["word"]}, _players(3))
        state["rings"] = [
            {
                "id": "word_len_2",
                "ring_index": 0,
                "type": "word",
                "text": "名称恰好 2 个字",
                "evaluation_mode": "auto",
                "evaluator": {"kind": "char_count_eq", "value": 2},
            }
        ]
        state["phase"] = "play"
        state["current_turn"] = "p2"
        state["players"]["p2"]["hand"] = [{"id": "play1", "name": "电风扇"}]
        state["players"]["p3"]["hand"] = [{"id": "hold1", "name": "手机"}]
        state["thing_deck"] = [{"id": "draw1", "name": "雨伞"}]

        events, error = ThingsInRingsGame.apply_action(
            state,
            "p2",
            {"type": "submit_play", "hand_index": 0, "zone_id": "1"},
        )

        self.assertIsNone(error)
        self.assertTrue(events)
        self.assertEqual(state["board_cards"][0]["zone_id"], "0")
        self.assertEqual(state["current_turn"], "p3")
        self.assertEqual(len(state["players"]["p2"]["hand"]), 1)
        self.assertEqual(state["players"]["p2"]["hand"][0]["name"], "雨伞")
        self.assertFalse(state["last_resolution"]["correct"])

    def test_correct_auto_guess_with_last_card_wins(self):
        state = ThingsInRingsGame.init_game({"ring_count": 1, "ring_types": ["word"]}, _players(3))
        state["rings"] = [
            {
                "id": "word_len_2",
                "ring_index": 0,
                "type": "word",
                "text": "名称恰好 2 个字",
                "evaluation_mode": "auto",
                "evaluator": {"kind": "char_count_eq", "value": 2},
            }
        ]
        state["phase"] = "play"
        state["current_turn"] = "p2"
        state["players"]["p2"]["hand"] = [{"id": "play1", "name": "手机"}]
        state["players"]["p3"]["hand"] = [{"id": "hold1", "name": "电风扇"}]

        _, error = ThingsInRingsGame.apply_action(
            state,
            "p2",
            {"type": "submit_play", "hand_index": 0, "zone_id": "1"},
        )

        self.assertIsNone(error)
        self.assertTrue(state["game_over"])
        self.assertEqual(state["winner_player_id"], "p2")
        self.assertEqual(state["players"]["p2"]["wins"], 1)

    def test_manual_judgement_respects_auto_word_bits(self):
        state = ThingsInRingsGame.init_game({"ring_count": 2, "ring_types": ["word", "attribute"]}, _players(3))
        state["rings"] = [
            {
                "id": "word_contains_hand",
                "ring_index": 0,
                "type": "word",
                "text": "名称里有“手”",
                "evaluation_mode": "auto",
                "evaluator": {"kind": "contains", "value": "手"},
            },
            {
                "id": "attr_soft",
                "ring_index": 1,
                "type": "attribute",
                "text": "通常是柔软的",
                "evaluation_mode": "knower",
                "evaluator": {},
            },
        ]
        state["phase"] = "play"
        state["current_turn"] = "p2"
        state["players"]["p2"]["hand"] = [{"id": "play1", "name": "手机"}]
        state["players"]["p3"]["hand"] = [{"id": "hold1", "name": "雨伞"}]

        events, error = ThingsInRingsGame.apply_action(
            state,
            "p2",
            {"type": "submit_play", "hand_index": 0, "zone_id": "11"},
        )

        self.assertIsNone(error)
        self.assertTrue(any(evt["type"] == "things_in_rings:await_judgement" for evt in events))
        self.assertEqual(state["phase"], "judge")

        events, error = ThingsInRingsGame.apply_action(
            state,
            state["knower_id"],
            {"type": "judge_play", "memberships": [True, False]},
        )

        self.assertIsNone(error)
        self.assertTrue(events)
        self.assertEqual(state["board_cards"][0]["zone_id"], "10")
        self.assertEqual(state["current_turn"], "p3")
        self.assertFalse(state["last_resolution"]["correct"])

    def test_manual_judgement_rejects_wrong_auto_bit(self):
        state = ThingsInRingsGame.init_game({"ring_count": 2, "ring_types": ["word", "attribute"]}, _players(3))
        state["rings"] = [
            {
                "id": "word_contains_hand",
                "ring_index": 0,
                "type": "word",
                "text": "名称里有“手”",
                "evaluation_mode": "auto",
                "evaluator": {"kind": "contains", "value": "手"},
            },
            {
                "id": "attr_soft",
                "ring_index": 1,
                "type": "attribute",
                "text": "通常是柔软的",
                "evaluation_mode": "knower",
                "evaluator": {},
            },
        ]
        state["phase"] = "judge"
        state["current_turn"] = state["knower_id"]
        state["pending_judgement"] = {
            "player_id": "p2",
            "thing_card": {"id": "play1", "name": "手机"},
            "proposed_zone_id": "11",
            "auto_memberships": [True, None],
        }

        _, error = ThingsInRingsGame.apply_action(
            state,
            state["knower_id"],
            {"type": "judge_play", "memberships": [False, False]},
        )

        self.assertEqual(error, "ring 1 auto result mismatch")


if __name__ == "__main__":
    unittest.main()
