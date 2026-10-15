import copy
import json
import unittest
from unittest.mock import patch

from game.colt_express import (
    ColtExpressGame as Game, ACTIONS, ROLES, _activate_next, _apply_event,
    _end_round, _marshal_encounter, _new_loot, _score, _start_round, _targets,
)


class ColtExpressTests(unittest.TestCase):
    def make(self, count=6, seed=8):
        return Game.init_game({"seed": seed}, [
            {"player_id": f"p{i}", "name": f"Bandit {i}", "seat": i, "is_bot": True}
            for i in range(count)
        ])

    def action(self, state, kind=None, **fields):
        pid = state["current_turn"]
        actions = Game.get_legal_actions(state, pid)
        action = next(a for a in actions if (kind is None or a["type"] == kind)
                      and all(a.get(k) == v for k, v in fields.items()))
        events, error = Game.apply_action(state, pid, action)
        self.assertIsNone(error)
        self.assertEqual(events[0]["payload"], {"player_id": pid})
        return action

    def execute(self, state, pid, kind):
        # Move a real card from its current pile into a single-card program.
        player = state["players"][pid]
        for pile in ("hand", "deck", "discard"):
            card = next((c for c in player[pile] if c["kind"] == kind), None)
            if card:
                player[pile].remove(card)
                break
        else:
            self.fail("fixture has no action card")
        state["round_cards"][state["round"] - 1]["event"] = "none"
        state["program"] = [{"index": 0, "player_id": pid, "card_id": card["id"], "kind": kind,
                             "hidden": False, "status": "queued"}]
        state["execute_index"] = 0
        _activate_next(state)

    def test_setup_counts_roles_positions_and_private_money(self):
        state = self.make()
        self.assertEqual(len(state["cars"]), 7)
        self.assertEqual(set(p["role"] for p in state["players"].values()), set(ROLES))
        for offset in range(6):
            pid = state["turn_order"][(state["first_index"] + offset) % 6]
            player = state["players"][pid]
            self.assertEqual(player["car"], 6 - offset % 2)
            self.assertEqual(len(player["hand"]), 7 if player["role"] == "doc" else 6)
            self.assertEqual(len(player["hand"]) + len(player["deck"]), 10)
            self.assertEqual(player["loots"][0]["value"], 250)
        view = Game.get_public_view(state, "p0")
        self.assertEqual(view["loots"][0]["value"], 250)
        self.assertIsNone(view["players"][1]["loots"][0]["value"])
        self.assertNotIn("seed", view)
        self.assertNotIn("round_cards", view)
        self.assertNotIn("deck", view)
        view["loots"][0]["value"] = 9999
        self.assertEqual(state["players"]["p0"]["loots"][0]["value"], 250)

    def test_program_schedule_double_reverse_and_tunnel(self):
        state = self.make(3)
        state["first_index"] = 0
        state["round_cards"][0]["turns"] = ["normal", "double", "reverse", "tunnel"]
        _start_round(state)
        self.assertEqual([slot["player_id"] for slot in state["schedule"]],
                         ["p0", "p1", "p2", "p0", "p0", "p1", "p1", "p2", "p2", "p0", "p2", "p1", "p0", "p1", "p2"])
        for i in range(12):
            self.action(state, "draw")
        self.assertTrue(all(a["hidden"] for a in Game.get_legal_actions(state, "p0") if a["type"] == "play"))
        self.action(state, "play")
        for viewer in ("p0", "p1", "spectator"):
            entry = Game.get_public_view(state, viewer)["program"][0]
            self.assertIsNone(entry["kind"])
            self.assertNotIn("card_id", entry)
        self.assertNotIn("移动", state["log"][-1]["text"])

    def test_ghost_optional_hidden_first_action_only(self):
        state = self.make()
        ghost = next(pid for pid, p in state["players"].items() if p["role"] == "ghost")
        state["first_index"] = state["turn_order"].index(ghost)
        state["round_cards"][0]["turns"] = ["normal", "normal"]
        _start_round(state)
        choices = Game.get_legal_actions(state, ghost)
        self.assertEqual({a["hidden"] for a in choices if a["type"] == "play"}, {False, True})
        self.action(state, "draw")
        for _ in range(5):
            self.action(state, "draw")
        self.assertEqual({a["hidden"] for a in Game.get_legal_actions(state, ghost) if a["type"] == "play"}, {False})

    def test_hidden_reveals_only_at_execution(self):
        state = self.make(3)
        state["round_cards"][0]["turns"] = ["tunnel"]
        _start_round(state)
        for _ in range(3):
            self.action(state, "play")
        view = Game.get_public_view(state, "spectator")
        self.assertEqual(view["phase"], "execute")
        self.assertTrue(all(not player["hand"] for player in state["players"].values()))
        self.assertIsNotNone(view["program"][0]["kind"])
        self.assertIsNone(view["program"][1]["kind"])
        self.assertEqual(view["active_card"], view["program"][0])

    def test_roof_gun_line_inside_range_and_belle_filter(self):
        state = self.make()
        for i, player in enumerate(state["players"].values()):
            player.update(role="ghost", car=6, level="inside")
        state["players"]["p0"].update(car=2, level="roof")
        state["players"]["p1"].update(car=3, level="roof", role="belle")
        state["players"]["p2"].update(car=5, level="roof")
        state["players"]["p3"].update(car=0, level="roof")
        self.assertEqual(_targets(state, "p0", "shoot"), ["p3"])
        state["players"]["p3"]["level"] = "inside"
        self.assertEqual(_targets(state, "p0", "shoot"), ["p1"])
        state["players"]["p0"]["level"] = "inside"
        self.assertEqual(_targets(state, "p0", "shoot"), [])
        state["players"]["p2"].update(car=3, level="inside")
        self.assertEqual(_targets(state, "p0", "shoot"), ["p2"])

    def test_tuco_vertical_shot(self):
        state = self.make(3)
        for player in state["players"].values():
            player.update(car=2, level="inside", role="ghost")
        state["players"]["p0"].update(role="tuco", level="roof")
        self.assertEqual(set(_targets(state, "p0", "shoot")), {"p1", "p2"})
        self.execute(state, "p0", "shoot")
        self.action(state, "shoot", target="p1")
        self.assertEqual(state["players"]["p0"]["shots"], 1)
        self.assertEqual(state["players"]["p1"]["bullets_received"], 1)

    def test_django_knockback_and_marshal_collision(self):
        state = self.make(3)
        state["players"]["p0"].update(car=2, level="inside", role="django")
        state["players"]["p1"].update(car=1, level="inside", role="doc")
        state["players"]["p2"].update(car=3, level="roof", role="tuco")
        self.execute(state, "p0", "shoot")
        self.action(state, "shoot", target="p1")
        self.assertEqual(state["players"]["p1"]["car"], 0)
        self.assertEqual(state["players"]["p1"]["level"], "roof")
        self.assertEqual(state["players"]["p1"]["bullets_received"], 2)

    def test_cheyenne_punch_steals_purse_and_empty_target_still_moves(self):
        state = self.make(3)
        state["players"]["p0"].update(car=2, level="inside", role="cheyenne")
        state["players"]["p1"].update(car=2, level="inside", role="doc")
        state["players"]["p2"].update(car=3, level="roof", role="tuco")
        self.execute(state, "p0", "punch")
        self.action(state, "punch", target="p1", car=1, loot_type="purse")
        self.assertEqual(len(state["players"]["p0"]["loots"]), 2)
        self.assertEqual(state["players"]["p1"]["loots"], [])
        state["players"]["p1"]["car"] = 2
        self.execute(state, "p0", "punch")
        self.action(state, "punch", target="p1", car=1, loot_type="none")
        self.assertEqual(state["players"]["p1"]["car"], 1)

    def test_cheyenne_can_decline_stealing_purse(self):
        state = self.make(3)
        state["players"]["p0"].update(car=2, level="inside", role="cheyenne")
        state["players"]["p1"].update(car=2, level="inside", role="doc")
        state["players"]["p2"].update(car=3, level="roof", role="tuco")
        purse = state["players"]["p1"]["loots"][0]
        self.execute(state, "p0", "punch")
        self.action(state, "punch", target="p1", car=1, loot_type="purse", steal=False)
        self.assertIn(purse, state["cars"][2]["loot"]["inside"])
        self.assertEqual(len(state["players"]["p0"]["loots"]), 1)

    def test_punch_drops_original_space_before_marshal_escape(self):
        state = self.make(3)
        state["players"]["p0"].update(car=1, level="inside", role="doc")
        state["players"]["p1"].update(car=1, level="inside", role="ghost")
        state["players"]["p2"].update(car=3, level="roof", role="tuco")
        token = _new_loot(state, "gem", 500)
        state["players"]["p1"]["loots"].append(token)
        self.execute(state, "p0", "punch")
        self.action(state, "punch", target="p1", car=0, loot_type="gem")
        self.assertIn(token, state["cars"][1]["loot"]["inside"])
        self.assertNotIn(token, state["cars"][0]["loot"]["roof"])
        self.assertEqual(state["players"]["p1"]["level"], "roof")
        self.assertEqual(state["players"]["p1"]["bullets_received"], 1)

    def test_belle_cannot_be_punched_when_other_target_is_present(self):
        state = self.make(3)
        for player in state["players"].values():
            player.update(car=2, level="roof", role="doc")
        state["players"]["p1"]["role"] = "belle"
        self.assertEqual(_targets(state, "p0", "punch"), ["p2"])
        state["players"]["p2"]["level"] = "inside"
        self.assertEqual(_targets(state, "p0", "punch"), ["p1"])

    def test_marshal_insufficient_neutral_stack_spares_entire_group(self):
        state = self.make(3)
        for player in state["players"].values():
            player.update(car=0, level="inside")
        state["neutral_bullets"] = 2
        _marshal_encounter(state)
        self.assertEqual(state["neutral_bullets"], 2)
        self.assertTrue(all(player["level"] == "roof" and player["bullets_received"] == 0 for player in state["players"].values()))

    def test_roof_move_range_and_required_action(self):
        state = self.make()
        state["players"]["p0"].update(car=3, level="roof")
        self.execute(state, "p0", "move")
        self.assertEqual({a["car"] for a in Game.get_legal_actions(state, "p0")}, {0, 1, 2, 4, 5, 6})
        snapshot = copy.deepcopy(state)
        _, error = Game.apply_action(state, "p0", {"type": "fizzle", "game_token": state["game_token"], "window_id": state["window_id"]})
        self.assertIsNotNone(error)
        self.assertEqual(snapshot, state)

    def test_fizzle_when_no_target_or_ammunition(self):
        state = self.make(3)
        state["players"]["p0"].update(bullets_left=0, shots=6)
        self.execute(state, "p0", "shoot")
        self.assertEqual([a["type"] for a in Game.get_legal_actions(state, "p0")], ["fizzle"])
        self.action(state, "fizzle")
        self.assertEqual(state["players"]["p0"]["shots"], 6)

    def test_all_eight_events(self):
        state = self.make(3)
        state["players"]["p0"].update(car=0, level="roof")
        state["players"]["p1"].update(car=1, level="inside")
        state["players"]["p2"].update(car=2, level="roof")
        _apply_event(state, "angry_marshal")
        self.assertEqual(state["marshal"], 1)
        self.assertEqual(state["players"]["p0"]["bullets_received"], 1)
        self.assertEqual(state["players"]["p1"]["level"], "roof")
        _apply_event(state, "braking")
        self.assertEqual([p["car"] for p in state["players"].values()], [0, 0, 1])
        _apply_event(state, "take_it_all")
        self.assertTrue(any(l["type"] == "strongbox" for l in state["cars"][1]["loot"]["inside"]))
        state["players"]["p1"]["level"] = "inside"
        _apply_event(state, "rebellion")
        self.assertEqual(state["players"]["p1"]["bullets_received"], 2)
        _apply_event(state, "swivel")
        self.assertEqual(state["players"]["p0"]["car"], 3)
        state["players"]["p0"].update(car=1, level="roof")
        cheap = state["players"]["p0"]["loots"][0]
        state["players"]["p0"]["loots"].append(_new_loot(state, "gem", 500))
        _apply_event(state, "revenge")
        self.assertIn(cheap, state["cars"][1]["loot"]["roof"])
        self.assertEqual(len(state["players"]["p0"]["loots"]), 1)
        state["round_cards"][0]["event"] = "pickpocket"
        _end_round(state)
        self.assertEqual(state["phase"], "event")
        self.action(state, "event_loot", loot_id=cheap["id"])
        self.assertIn(cheap, state["players"]["p0"]["loots"])
        before = len(state["players"]["p1"]["loots"])
        _apply_event(state, "hostage")
        self.assertEqual(len(state["players"]["p1"]["loots"]), before + 1)
        self.assertEqual(state["players"]["p1"]["loots"][-1]["value"], 250)

    def test_round_review_barrier_and_final_scoring(self):
        state = self.make(3)
        state["round_cards"][0]["event"] = "none"
        state["round_cards"][4]["event"] = "none"
        _end_round(state)
        window = state["window_id"]
        for pid in ("p0", "p1"):
            action = Game.get_legal_actions(state, pid)[0]
            self.assertIsNone(Game.apply_action(state, pid, action)[1])
            self.assertEqual(state["phase"], "round_end")
            self.assertEqual(state["window_id"], window)
            self.assertEqual(Game.get_legal_actions(state, pid), [])
        self.assertIsNone(Game.apply_action(state, "p2", Game.get_legal_actions(state, "p2")[0])[1])
        self.assertEqual(state["round"], 2)
        state["round"] = 5
        _end_round(state)
        for pid in state["turn_order"]:
            self.assertIsNone(Game.apply_action(state, pid, Game.get_legal_actions(state, pid)[0])[1])
        self.assertTrue(state["game_over"])
        self.assertTrue(all(row["shooter_bonus"] == 1000 for row in state["scoreboard"]))
        self.assertEqual(set(state["winner"]), set(state["turn_order"]))

    def test_pickpocket_choose_exact_purse_or_decline_and_restore(self):
        state = self.make(3)
        state["round_cards"][0]["event"] = "pickpocket"
        for i, player in enumerate(state["players"].values()):
            player.update(car=i + 1, level="roof")
        first = _new_loot(state, "purse", 300)
        second = _new_loot(state, "purse", 500)
        skipped = _new_loot(state, "purse", 450)
        state["cars"][1]["loot"]["roof"] = [first, second]
        state["cars"][2]["loot"]["roof"] = [skipped]
        _end_round(state)
        self.assertEqual(state["phase"], "event")
        self.assertEqual(state["event_pending"], ["p0", "p1"])
        self.assertIsNone(state["round_summary"])
        self.assertEqual(Game.get_legal_actions(state, "p1"), [])
        restored = Game.deserialize(json.loads(json.dumps(Game.serialize(state))))
        self.assertEqual(Game.get_public_view(state, "p0"), Game.get_public_view(restored, "p0"))
        self.action(restored, "event_loot", loot_id=second["id"])
        self.assertIn(second, restored["players"]["p0"]["loots"])
        self.assertIn(first, restored["cars"][1]["loot"]["roof"])
        self.assertEqual(restored["phase"], "event")
        self.action(restored, "skip_event")
        self.assertIn(skipped, restored["cars"][2]["loot"]["roof"])
        self.assertEqual(restored["phase"], "round_end")
        self.assertEqual(restored["event_pending"], [])
        self.assertTrue(any("放弃" in entry["text"] for entry in restored["round_summary"]["entries"]))

    def test_pickpocket_without_targets_goes_directly_to_review(self):
        state = self.make(3)
        state["round_cards"][0]["event"] = "pickpocket"
        for player in state["players"].values():
            player.update(car=1, level="inside")
        _end_round(state)
        self.assertEqual(state["phase"], "round_end")
        invalid = copy.deepcopy(state)
        invalid["next_ready"] = invalid["turn_order"][:]
        with self.assertRaises(ValueError):
            Game.deserialize(invalid)

    def test_long_player_names_produce_valid_action_labels(self):
        state = self.make(3)
        for pid, player in state["players"].items():
            state["player_meta"][pid]["name"] = "匪徒" * 200
            player.update(car=2, level="inside", role="doc")
        self.execute(state, "p0", "punch")
        choices = Game.get_legal_actions(state, "p0")
        self.assertTrue(all(len(action["label"]) <= 250 for action in choices))
        self.action(state, "punch")

    def test_final_ties_use_fewer_received_bullets_then_shared_win(self):
        state = self.make(3)
        state["players"]["p0"]["bullets_received"] = 1
        _score(state)
        self.assertEqual(set(state["winner"]), {"p1", "p2"})

    def test_invalid_unknown_stale_and_boolean_actions_are_atomic(self):
        state = self.make(3)
        action = Game.get_legal_actions(state, state["current_turn"])[0]
        for changes in ({"car": True}, {"window_id": True}, {"window_id": 999}, {"game_token": "old"},
                        {"type": "shoot", "target": "p2"}, {"private_seed": "oops"}):
            snapshot = copy.deepcopy(state)
            self.assertIsNotNone(Game.apply_action(state, state["current_turn"], {**action, **changes})[1])
            self.assertEqual(snapshot, state)
        self.assertIsNotNone(Game.apply_action(state, "spectator", action)[1])

    def test_bullets_are_unplayable_and_kept_across_shuffle(self):
        from game.colt_express import _bullet
        state = self.make(3)
        _bullet(state, "p0")
        _start_round(state)
        state["current_turn"] = "p0"
        player = state["players"]["p0"]
        self.assertEqual(len(player["hand"]) + len(player["deck"]), 11)
        ids = {card["id"] for card in player["hand"] if card["kind"] == "bullet"}
        self.assertFalse(any(a.get("card_id") in ids for a in Game.get_legal_actions(state, "p0")))

    def test_bot_policy_receives_only_public_view(self):
        state = self.make(3)
        pid = state["current_turn"]
        expected = Game.get_public_view(state, pid)
        with patch("game.colt_express._choose_bot_action", return_value=None) as chooser:
            self.assertIsNone(Game.bot_move(state, pid))
            chooser.assert_called_once_with(expected)

    def test_json_round_trip_and_many_complete_bot_games(self):
        for count in (3, 4, 5, 6):
            for seed in range(4):
                with self.subTest(count=count, seed=seed):
                    state = self.make(count, seed)
                    for step in range(1000):
                        if state["game_over"]:
                            break
                        pid = state["current_turn"] or next(p for p in state["turn_order"] if p not in state["next_ready"])
                        action = Game.bot_move(state, pid)
                        self.assertIsNotNone(action)
                        if step % 19 == 0:
                            restored = Game.deserialize(json.loads(json.dumps(Game.serialize(state))))
                            self.assertEqual(Game.get_public_view(state, pid), Game.get_public_view(restored, pid))
                            self.assertEqual(Game.bot_move(state, pid), Game.bot_move(restored, pid))
                            state = restored
                        self.assertIsNone(Game.apply_action(state, pid, action)[1])
                    else:
                        self.fail("bot game did not finish")
                    self.assertEqual(state["round"], 5)
                    self.assertTrue(state["winner"])
                    Game.deserialize(json.loads(json.dumps(Game.serialize(state))))

    def test_rejects_invalid_config_and_save(self):
        for count in (2, 7):
            with self.assertRaises(ValueError):
                self.make(count)
        with self.assertRaises(ValueError):
            Game.init_game({"seed": True}, [{"player_id": str(i)} for i in range(3)])
        state = self.make(3)
        corruptions = []
        invalid = copy.deepcopy(state)
        invalid["players"]["p0"]["car"] = 100
        corruptions.append(invalid)
        invalid = copy.deepcopy(state)
        invalid["players"]["p0"]["hand"][0]["kind"] = "shoot"
        invalid["players"]["p0"]["hand"][1]["kind"] = "shoot"
        invalid["players"]["p0"]["hand"][2]["kind"] = "shoot"
        corruptions.append(invalid)
        invalid = copy.deepcopy(state)
        invalid["players"]["p0"]["loots"].append(copy.deepcopy(invalid["players"]["p1"]["loots"][0]))
        corruptions.append(invalid)
        invalid = copy.deepcopy(state)
        invalid["round_cards"][0]["turns"][0] = "unknown"
        corruptions.append(invalid)
        for invalid in corruptions:
            with self.assertRaises(ValueError):
                Game.deserialize(invalid)


if __name__ == "__main__":
    unittest.main()
