import copy
import json
import unittest
from unittest.mock import patch

from jsonschema import Draft7Validator

from game.mind_the_lines import (
    ACTION_SCHEMA, CONFIG_SCHEMA, MindTheLinesGame as Game,
    choose_bot_action, resolve_timeout,
)
from game.mind_the_lines_data import WORD_POOLS, generate_board, word_outline


def make_state(count=4, seconds=0, difficulty="easy", seed=132):
    return Game.init_game({"draw_seconds": seconds, "difficulty": difficulty, "seed": seed}, [
        {"player_id": f"p{i}", "name": f"Player {i}", "seat": i, "is_bot": i > 0}
        for i in range(count)
    ])


def action(state, kind, **extra):
    return {"type": kind, "round_token": state["round_token"], **extra}


def draw_action(state, kind="submit_drawing", seq=0, segments=None, side=0, rotation=0):
    return action(state, kind, segments=[0, 1] if segments is None else segments,
                  side=side, rotation=rotation, seq=seq)


def ready_all(state):
    for pid in state["turn_order"]:
        events, error = Game.apply_action(state, pid, action(state, "ready"))
        assert error is None, (error, events)


def submit_all(state):
    for pid in state["turn_order"]:
        events, error = Game.apply_action(state, pid, draw_action(state))
        assert error is None, (error, events)


def finish_round(state, mistakes=0):
    if state["phase"] == "ready":
        ready_all(state)
    if state["phase"] == "drawing":
        submit_all(state)
    truth = [c for c in state["cards"] if c["owner_id"] is not None]
    decoys = [c for c in state["cards"] if c["owner_id"] is None]
    picks = truth[:mistakes] + decoys[:len(truth) - mistakes]
    for card in picks:
        events, error = Game.apply_action(state, state["current_turn"], action(
            state, "eliminate", card_id=card["id"], revision=state["revision"]))
        assert error is None, (error, events)


def next_round(state):
    for pid in state["turn_order"]:
        events, error = Game.apply_action(state, pid, action(state, "next_round"))
        assert error is None, (error, events)


class MindTheLinesTests(unittest.TestCase):
    def assert_rejected_unchanged(self, state, pid, move):
        before = copy.deepcopy(state)
        events, error = Game.apply_action(state, pid, move)
        self.assertTrue(error, move)
        self.assertEqual(events, [])
        self.assertEqual(state, before)

    def test_setup_every_player_count_and_private_word_assignment(self):
        for count in range(2, 9):
            with self.subTest(count=count):
                state = make_state(count)
                words_each = 2 if count < 4 else 1
                self.assertEqual(state["words_per_player"], words_each)
                self.assertEqual(state["error_limit"], count)
                self.assertEqual(len(state["cards"]), count * words_each * 2)
                self.assertEqual(len({c["id"] for c in state["cards"]}), len(state["cards"]))
                for pid in state["turn_order"]:
                    self.assertEqual(len(state["players"][pid]["words"]), words_each)
                self.assertEqual(state["start_player"], "p0")
                self.assertEqual(state["phase"], "ready")

    def test_invalid_configuration_and_player_count(self):
        for count in (0, 1, 9):
            with self.assertRaises(ValueError):
                make_state(count)
        players = [{"player_id": "p0"}, {"player_id": "p1"}]
        for cfg in ({"draw_seconds": True}, {"draw_seconds": 121}, {"draw_seconds": "120"},
                    {"difficulty": "medium"}, {"unknown": 1}, {"seed": False}, {"seed": []},
                    {"seed": ""}, [], "easy"):
            with self.subTest(config=cfg), self.assertRaises(ValueError):
                Game.init_game(cfg, players)
        with self.assertRaises(ValueError):
            Game.init_game({}, [players[0], players[0]])
        with self.assertRaises(ValueError):
            Game.init_game({}, [{"player_id": ""}, players[1]])

    def test_board_is_original_deterministic_and_word_independent(self):
        first = generate_board("board-test", "board-1")
        self.assertEqual(first, generate_board("board-test", "board-1"))
        self.assertNotEqual(first["sides"][0], first["sides"][1])
        self.assertNotEqual(first, generate_board("board-test", "board-2"))
        self.assertEqual(make_state(difficulty="easy")["boards"], make_state(difficulty="hard")["boards"])
        for side in first["sides"]:
            self.assertGreater(len(side), 350)
            for line in side:
                self.assertEqual(len(line), 4)
                self.assertTrue(all(type(c) is int and 0 <= c <= 1000 for c in line))
                self.assertNotEqual(line[:2], line[2:])

    def test_original_word_pool_covers_full_game(self):
        for difficulty, pool in WORD_POOLS.items():
            self.assertGreaterEqual(len(pool), 64)
            self.assertEqual(len({w["id"] for w in pool}), len(pool))
            self.assertEqual(len({w["zh"] for w in pool}), len(pool))
            for word in pool:
                self.assertTrue(word["zh"])
                self.assertTrue(word["en"])
                self.assertGreater(len(word_outline(word["id"])), 0)
            self.assertTrue(Draft7Validator(CONFIG_SCHEMA).is_valid({"difficulty": difficulty}))

    def test_clock_starts_only_after_everyone_ready(self):
        state = make_state(seconds=120)
        with patch("game.mind_the_lines._now_ms", return_value=50000):
            for pid in state["turn_order"][:-1]:
                Game.apply_action(state, pid, action(state, "ready"))
                self.assertEqual(state["phase"], "ready")
                self.assertIsNone(state["deadline_ms"])
            Game.apply_action(state, "p3", action(state, "ready"))
        self.assertEqual(state["phase"], "drawing")
        self.assertEqual(state["deadline_ms"], 170000)

    def test_unlimited_practice_and_180_seconds(self):
        unlimited = make_state(seconds=0)
        ready_all(unlimited)
        self.assertIsNone(unlimited["deadline_ms"])
        before = copy.deepcopy(unlimited)
        self.assertEqual(resolve_timeout(unlimited, 10 ** 20), [])
        self.assertEqual(unlimited, before)
        longer = make_state(seconds=180)
        with patch("game.mind_the_lines._now_ms", return_value=9000):
            ready_all(longer)
        self.assertEqual(longer["deadline_ms"], 189000)

    def test_draft_is_private_and_submit_does_not_reveal_early(self):
        state = make_state()
        ready_all(state)
        move = draw_action(state, "save_drawing", segments=[2, 1, 7], seq=4, side=1, rotation=3)
        events, error = Game.apply_action(state, "p0", move)
        self.assertIsNone(error)
        self.assertEqual(events, [])
        own = Game.get_public_view(state, "p0")
        self.assertEqual(own["your_drawing"], {"segments": [1, 2, 7], "seq": 4, "side": 1, "rotation": 3})
        for viewer in ("p1", None, "spectator"):
            view = Game.get_public_view(state, viewer)
            self.assertEqual(view["drawings"], [])
            self.assertEqual(view["cards"], [])
            self.assertNotIn(state["players"]["p0"]["words"][0], view["your_words"])
        move["type"] = "submit_drawing"
        Game.apply_action(state, "p0", move)
        self.assertEqual(state["phase"], "drawing")
        self.assertEqual(Game.get_public_view(state, "p1")["drawings"], [])

    def test_early_submit_starts_oracle_and_exposes_only_selected_side(self):
        state = make_state(seconds=120)
        ready_all(state)
        submit_all(state)
        self.assertEqual(state["phase"], "oracle")
        self.assertIsNone(state["deadline_ms"])
        self.assertEqual(state["current_turn"], "p0")
        view = Game.get_public_view(state, None)
        self.assertEqual(len(view["drawings"]), 4)
        self.assertEqual(len(view["cards"]), 8)
        self.assertTrue(all("owner_id" not in c for c in view["cards"]))
        self.assertTrue(all("words" not in d for d in view["drawings"]))
        self.assertEqual(view["drawings"][0]["lines"], state["boards"]["board-1"]["sides"][0])

    def test_deadline_locks_latest_saved_drafts_once(self):
        state = make_state(seconds=120)
        ready_all(state)
        Game.apply_action(state, "p0", draw_action(state, "save_drawing", seq=9, segments=[2, 9]))
        deadline = state["deadline_ms"]
        before = copy.deepcopy(state)
        self.assertEqual(resolve_timeout(state, deadline - 1), [])
        self.assertEqual(state, before)
        events = resolve_timeout(state, deadline)
        self.assertEqual(len(events), 2)
        self.assertEqual(state["phase"], "oracle")
        self.assertTrue(all(p["submitted"] for p in state["players"].values()))
        self.assertEqual(state["players"]["p0"]["drawing"]["segments"], [2, 9])
        self.assertEqual(state["players"]["p1"]["drawing"]["segments"], [])
        before = copy.deepcopy(state)
        self.assertEqual(resolve_timeout(state, deadline + 9999), [])
        self.assertEqual(state, before)

    def test_late_submit_cannot_replace_timed_out_draft(self):
        state = make_state(seconds=120)
        ready_all(state)
        with patch("game.mind_the_lines._now_ms", return_value=state["deadline_ms"]):
            self.assert_rejected_unchanged(state, "p0", draw_action(state))
        resolve_timeout(state, state["deadline_ms"])
        self.assert_rejected_unchanged(state, "p0", draw_action(state))

    def test_duplicate_ready_save_submit_and_eliminate_are_harmless(self):
        state = make_state()
        ready = action(state, "ready")
        Game.apply_action(state, "p0", ready)
        before = copy.deepcopy(state)
        self.assertEqual(Game.apply_action(state, "p0", ready), ([], None))
        self.assertEqual(state, before)
        ready_all(state)
        move = draw_action(state, "save_drawing", seq=5)
        Game.apply_action(state, "p0", move)
        before = copy.deepcopy(state)
        self.assertEqual(Game.apply_action(state, "p0", move), ([], None))
        self.assertEqual(state, before)
        move["type"] = "submit_drawing"
        Game.apply_action(state, "p0", move)
        before = copy.deepcopy(state)
        self.assertEqual(Game.apply_action(state, "p0", move), ([], None))
        self.assertEqual(state, before)
        for pid in ("p1", "p2", "p3"):
            Game.apply_action(state, pid, draw_action(state))
        elimination = action(state, "eliminate", card_id=state["cards"][0]["id"], revision=state["revision"])
        Game.apply_action(state, "p0", elimination)
        before = copy.deepcopy(state)
        self.assertEqual(Game.apply_action(state, "p0", elimination), ([], None))
        self.assertEqual(state, before)

    def test_stale_sequence_is_ignored_and_same_sequence_cannot_change_ink(self):
        state = make_state()
        ready_all(state)
        Game.apply_action(state, "p0", draw_action(state, "save_drawing", seq=5, segments=[5]))
        for kind in ("save_drawing", "submit_drawing"):
            before = copy.deepcopy(state)
            self.assertEqual(Game.apply_action(state, "p0", draw_action(state, kind, seq=3)), ([], None))
            self.assertEqual(state, before)
        self.assert_rejected_unchanged(state, "p0", draw_action(state, "save_drawing", seq=5, segments=[4]))

    def test_all_invalid_drawing_data_is_atomically_rejected(self):
        state = make_state()
        ready_all(state)
        bad = [{"segments": [-1]}, {"segments": [True]}, {"segments": [1.5]},
               {"segments": [0, 0]}, {"segments": [99999]}, {"segments": "0"},
               {"segments": {}}, {"side": True}, {"side": -1}, {"side": 2},
               {"rotation": 90}, {"rotation": 4}, {"rotation": 1.0},
               {"seq": True}, {"seq": -1}, {"seq": 1.5}, {"extra": "text"},
               {"round_token": "old"}]
        for change in bad:
            with self.subTest(change=change):
                move = draw_action(state, "save_drawing")
                move.update(change)
                self.assert_rejected_unchanged(state, "p0", move)
        missing = draw_action(state)
        del missing["round_token"]
        self.assert_rejected_unchanged(state, "p0", missing)
        self.assert_rejected_unchanged(state, "outsider", draw_action(state))

    def test_oracle_turn_order_has_two_laps_for_two_and_three_players(self):
        for count in (2, 3, 4, 8):
            state = make_state(count)
            ready_all(state)
            submit_all(state)
            order = state["turn_order"] * state["words_per_player"]
            cards = state["cards"][:len(order)]
            for index, pid in enumerate(order):
                self.assertEqual(state["current_turn"], pid)
                Game.apply_action(state, pid, action(state, "eliminate", card_id=cards[index]["id"], revision=state["revision"]))
                if index < len(order) - 1:
                    self.assertEqual(state["phase"], "oracle")
                    self.assertEqual(state["errors"], 0)
                    self.assertTrue(all("owner_id" not in c for c in Game.get_public_view(state, None)["cards"]))
            self.assertIn(state["phase"], ("round_result", "game_over"))

    def test_invalid_eliminations_are_atomic(self):
        state = make_state()
        ready_all(state)
        submit_all(state)
        valid = action(state, "eliminate", card_id=state["cards"][0]["id"], revision=state["revision"])
        self.assert_rejected_unchanged(state, "p1", valid)
        for change in ({"card_id": "missing"}, {"revision": -1}, {"revision": True}, {"revision": 999}, {"card_id": []}):
            self.assert_rejected_unchanged(state, "p0", {**valid, **change})
        Game.apply_action(state, "p0", valid)
        self.assert_rejected_unchanged(state, "p1", {**valid, "revision": state["revision"]})

    def test_four_rounds_and_exact_error_limit_still_wins(self):
        for count in (2, 3, 4, 8):
            with self.subTest(count=count):
                state = make_state(count)
                seen = set()
                for round_number in range(1, 5):
                    current = {c["id"] for c in state["cards"]}
                    self.assertFalse(seen & current)
                    seen.update(current)
                    finish_round(state, mistakes=count if round_number == 1 else 0)
                    self.assertEqual(state["errors"], count)
                    if round_number < 4:
                        self.assertFalse(state["game_over"])
                        next_round(state)
                self.assertEqual(state["phase"], "game_over")
                self.assertTrue(state["success"])
                self.assertEqual(state["outcome"], "win")
                self.assertEqual(state["winner_ids"], state["turn_order"])
                self.assertEqual(len(state["round_history"]), 4)

    def test_errors_above_player_count_end_game_early(self):
        state = make_state(2)
        finish_round(state, mistakes=3)
        self.assertEqual(state["errors"], 3)
        self.assertEqual(state["phase"], "game_over")
        self.assertFalse(state["success"])
        self.assertEqual(state["outcome"], "loss")
        self.assertEqual(state["winner_ids"], [])
        self.assertEqual(Game.get_legal_actions(state, "p0"), [])

    def test_round_reveal_identifies_claims_and_eliminators(self):
        state = make_state()
        finish_round(state, mistakes=1)
        view = Game.get_public_view(state, None)
        self.assertEqual(view["last_round_summary"]["errors"], 1)
        self.assertTrue(all("owner_id" in c for c in view["cards"]))
        self.assertTrue(all("words" in d for d in view["drawings"]))
        self.assertEqual(len(view["last_round_summary"]["claims"]), 4)
        self.assertEqual(sum(c.get("eliminated_by") is not None for c in view["cards"]), 4)

    def test_all_seats_must_confirm_and_boards_pass_clockwise(self):
        state = make_state()
        old_token = state["round_token"]
        old_boards = [state["players"][pid]["board_id"] for pid in state["turn_order"]]
        finish_round(state)
        for pid in state["turn_order"][:-1]:
            move = action(state, "next_round")
            Game.apply_action(state, pid, move)
            self.assertEqual(state["round"], 1)
            self.assertEqual(Game.apply_action(state, pid, move), ([], None))
        Game.apply_action(state, "p3", action(state, "next_round"))
        self.assertEqual(state["round"], 2)
        self.assertEqual(state["start_player"], "p1")
        self.assertNotEqual(state["round_token"], old_token)
        self.assertEqual(state["phase"], "ready")
        for i, pid in enumerate(state["turn_order"]):
            self.assertEqual(state["players"][pid]["board_id"], old_boards[(i - 1) % 4])
            self.assertEqual(state["players"][pid]["drawing"]["segments"], [])
        self.assert_rejected_unchanged(state, "p0", {"type": "next_round", "round_token": old_token})
        self.assert_rejected_unchanged(state, "p0", {"type": "ready", "round_token": old_token})

    def test_spectator_views_have_no_actions_or_private_data(self):
        state = make_state()
        for phase in ("ready", "drawing", "oracle", "round_result"):
            if phase == "drawing":
                ready_all(state)
            elif phase == "oracle":
                submit_all(state)
            elif phase == "round_result":
                finish_round(state)
            for viewer in (None, "spectator"):
                view = Game.get_public_view(state, viewer)
                for key in ("your_words", "your_board", "your_drawing", "legal_actions"):
                    self.assertFalse(view[key])
                for secret in ("seed", "base_seed", "word_deck", "boards", "player_meta"):
                    self.assertNotIn(secret, view)
                    self.assertNotIn(secret, view["config"])

    def test_serialization_preserves_timer_drafts_and_does_not_alias(self):
        state = make_state(seconds=120)
        ready_all(state)
        Game.apply_action(state, "p0", draw_action(state, "save_drawing", seq=7))
        payload = Game.serialize(state)
        restored = Game.deserialize(json.loads(json.dumps(payload)))
        self.assertEqual(restored, state)
        restored["players"]["p0"]["drawing"]["segments"].append(6)
        self.assertNotEqual(restored, state)
        payload["cards"].clear()
        self.assertTrue(state["cards"])
        view = Game.get_public_view(state, "p0")
        view["your_drawing"]["segments"].clear()
        view["your_board"]["sides"][0].clear()
        self.assertTrue(state["players"]["p0"]["drawing"]["segments"])
        self.assertTrue(state["boards"]["board-1"]["sides"][0])

    def test_events_never_contain_private_payloads(self):
        state = make_state()
        all_events = []
        for pid in state["turn_order"]:
            all_events.extend(Game.apply_action(state, pid, action(state, "ready"))[0])
        for pid in state["turn_order"]:
            all_events.extend(Game.apply_action(state, pid, draw_action(state))[0])
        for card in state["cards"][:4]:
            all_events.extend(Game.apply_action(state, state["current_turn"], action(
                state, "eliminate", card_id=card["id"], revision=state["revision"]))[0])
        encoded = json.dumps(all_events, ensure_ascii=False)
        for forbidden in ('"seed"', '"base_seed"', '"word_deck"', '"owner_id"', '"segments"', '"words"', '"zh"', '"en"'):
            self.assertNotIn(forbidden, encoded)

    def test_bot_only_uses_own_public_view(self):
        state = make_state()
        ready_all(state)
        submit_all(state)
        original = Game.get_public_view(state, "p0")
        first = choose_bot_action(original)
        altered = copy.deepcopy(state)
        altered["base_seed"] = "unrelated"
        altered["word_deck"] = []
        for card in altered["cards"]:
            card["owner_id"] = "p0"
        for pid in ("p1", "p2", "p3"):
            altered["players"][pid]["words"] = [{"id": "secret", "zh": "秘密", "en": "Secret"}]
        self.assertEqual(first, Game.bot_move(altered, "p0"))
        with patch.object(Game, "get_public_view", return_value=original) as view_method:
            self.assertEqual(first, Game.bot_move({"private": "unreadable"}, "p0"))
            view_method.assert_called_once_with({"private": "unreadable"}, "p0")

    def test_bots_finish_full_games_with_valid_actions(self):
        validator = Draft7Validator(ACTION_SCHEMA)
        for count, difficulty in ((2, "easy"), (3, "hard"), (4, "easy"), (8, "hard")):
            with self.subTest(count=count, difficulty=difficulty):
                state = make_state(count, difficulty=difficulty)
                for _ in range(200):
                    if state["game_over"]:
                        break
                    progressed = False
                    for pid in state["turn_order"]:
                        move = Game.bot_move(state, pid)
                        if move is None:
                            continue
                        move.pop("delay_ms", None)
                        self.assertTrue(validator.is_valid(move), move)
                        events, error = Game.apply_action(state, pid, move)
                        self.assertIsNone(error, (move, error))
                        progressed = True
                    self.assertTrue(progressed)
                self.assertTrue(state["game_over"])
                self.assertEqual(state["round"], 4)
                self.assertTrue(state["success"])
                self.assertEqual(state["errors"], 0)


if __name__ == "__main__":
    unittest.main()
