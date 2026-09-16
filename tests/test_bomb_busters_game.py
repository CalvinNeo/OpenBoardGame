import copy
import json
import random
import re
import unittest

from game import get_game
from game.bomb_busters import (
    PRACTICE_PRESETS,
    BombBustersGame,
    _assert_state_invariants,
    _build_wire_pool,
    _refresh_validation,
)


def make_players(count=3, bot_ids=None):
    bots = set(bot_ids or [])
    return [
        {
            "player_id": f"p{index}",
            "name": f"Player {index}",
            "seat": index,
            "is_bot": f"p{index}" in bots,
        }
        for index in range(count)
    ]


def make_state(count=3, preset="standard_practice", seed="bomb-test", bot_ids=None):
    return BombBustersGame.init_game(
        {"practice_preset": preset, "seed": seed},
        make_players(count, bot_ids=bot_ids),
    )


def finish_initial_info(state):
    while state["phase"] == "initial_info":
        player_id = state["initial_info_order"][state["initial_info_cursor"]]
        view = BombBustersGame.get_public_view(state, player_id)
        wire_id = view["initial_info_candidate_wire_ids"][0]
        events, error = BombBustersGame.apply_action(
            state, player_id, {"type": "place_initial_info", "wire_id": wire_id}
        )
        if error:
            raise AssertionError(error)
        if not events:
            raise AssertionError("initial clue emitted no event")
    return state


def rig_playing(state, actor_id, specs):
    """Leave only the requested rack slots uncut and give them explicit faces."""
    for token in state["info_tokens"].values():
        token["attached_wire_id"] = None
    for wire in state["wires"].values():
        wire["info_token_id"] = None
        wire["status"] = "secured" if wire["kind"] == "red" else "cut"

    chosen = []
    used_ids = set()
    for spec in specs:
        owner_id = spec["owner_id"]
        rack_index = spec.get("rack_index", 0)
        rack_id = state["players"][owner_id]["rack_ids"][rack_index]
        wire = next(
            state["wires"][wire_id]
            for wire_id in state["racks"][rack_id]["slots"]
            if wire_id not in used_ids
        )
        used_ids.add(wire["wire_id"])
        wire["kind"] = spec["kind"]
        wire["blue_value"] = spec.get("blue_value")
        wire["sort_tick"] = spec.get(
            "sort_tick",
            (int(spec["blue_value"]) * 10 if spec["kind"] == "blue" else 11),
        )
        wire["status"] = "uncut"
        chosen.append(wire)

    state["phase"] = "playing"
    state["current_turn"] = actor_id
    state["current_responder_id"] = None
    state["pending_resolution"] = None
    state["last_result"] = None
    state["result_ready_ids"] = []
    state["detonator"] = {
        "mistake_limit": len(state["turn_order"]),
        "mistakes_used": 0,
        "remaining": len(state["turn_order"]),
    }
    _refresh_validation(state)
    _assert_state_invariants(state)
    return chosen


class BombBustersSetupTests(unittest.TestCase):
    def test_registration_and_player_limits(self):
        definition = get_game("bomb_busters")
        self.assertIsNotNone(definition)
        self.assertEqual(definition.name, "Bomb Busters")
        self.assertEqual(definition.name_zh, "炸弹克星")
        self.assertEqual((definition.min_players, definition.max_players), (2, 5))
        with self.assertRaisesRegex(ValueError, "2 to 5"):
            make_state(1)
        with self.assertRaisesRegex(ValueError, "2 to 5"):
            make_state(6)

    def test_practice_preset_wire_counts_and_sort_ticks(self):
        expected = {
            "short_practice": (24, 0, 0),
            "standard_practice": (48, 2, 1),
            "high_risk_practice": (48, 4, 3),
        }
        for preset_id, (blue_count, yellow_count, red_count) in expected.items():
            with self.subTest(preset=preset_id):
                pool = _build_wire_pool(PRACTICE_PRESETS[preset_id], random.Random(8))
                self.assertEqual(sum(wire["kind"] == "blue" for wire in pool), blue_count)
                self.assertEqual(sum(wire["kind"] == "yellow" for wire in pool), yellow_count)
                self.assertEqual(sum(wire["kind"] == "red" for wire in pool), red_count)
                self.assertTrue(all(wire["sort_tick"] % 10 == 0 for wire in pool if wire["kind"] == "blue"))
                self.assertTrue(all(wire["sort_tick"] % 10 == 1 for wire in pool if wire["kind"] == "yellow"))
                self.assertTrue(all(wire["sort_tick"] % 10 == 5 for wire in pool if wire["kind"] == "red"))

    def test_rack_allocation_dealing_sorting_and_opaque_ids(self):
        expected_racks = {
            2: [2, 2],
            3: [1, 1, 2],
            4: [1, 1, 1, 1],
            5: [1, 1, 1, 1, 1],
        }
        for count, rack_counts in expected_racks.items():
            with self.subTest(players=count):
                state = make_state(count, preset="high_risk_practice", seed=f"racks-{count}")
                self.assertEqual(
                    sorted(len(pdata["rack_ids"]) for pdata in state["players"].values()),
                    rack_counts,
                )
                sizes = [len(rack["slots"]) for rack in state["racks"].values()]
                self.assertLessEqual(max(sizes) - min(sizes), 1)
                for rack in state["racks"].values():
                    ticks = [state["wires"][wire_id]["sort_tick"] for wire_id in rack["slots"]]
                    self.assertEqual(ticks, sorted(ticks))
                for wire_id in state["wires"]:
                    self.assertRegex(wire_id, r"^w-[0-9a-f]{16}$")
                    self.assertIsNone(re.search(r"blue|yellow|red", wire_id))
                _assert_state_invariants(state)

    def test_initial_info_runs_from_captain_and_spoken_clue_does_not_persist(self):
        state = make_state(3, preset="short_practice")
        self.assertEqual(state["initial_info_order"][0], state["captain_id"])
        selected = []
        for player_id in state["initial_info_order"]:
            rack_id = state["players"][player_id]["rack_ids"][0]
            wire = state["wires"][state["racks"][rack_id]["slots"][0]]
            wire.update({"kind": "blue", "blue_value": 1, "sort_tick": 10})
            selected.append((player_id, wire["wire_id"]))

        final_events = []
        for player_id, wire_id in selected:
            final_events, error = BombBustersGame.apply_action(
                state, player_id, {"type": "place_initial_info", "wire_id": wire_id}
            )
            self.assertIsNone(error)
        self.assertEqual(state["phase"], "playing")
        self.assertEqual(state["current_turn"], state["captain_id"])
        self.assertTrue(any(event["type"] == "bomb_busters:spoken_info" for event in final_events))
        view_json = json.dumps(BombBustersGame.get_public_view(state, "p0"))
        self.assertNotIn("spoken_info", view_json)


class BombBustersActionTests(unittest.TestCase):
    def test_duo_cut_success_is_atomic_and_completes_mission(self):
        state = finish_initial_info(make_state(2, preset="short_practice"))
        own, target = rig_playing(
            state,
            "p0",
            [
                {"owner_id": "p0", "kind": "blue", "blue_value": 7},
                {"owner_id": "p1", "kind": "blue", "blue_value": 7},
            ],
        )
        events, error = BombBustersGame.apply_action(
            state,
            "p0",
            {"type": "dual_cut", "own_wire_id": own["wire_id"], "target_wire_id": target["wire_id"]},
        )
        self.assertIsNone(error)
        self.assertEqual((own["status"], target["status"]), ("cut", "cut"))
        self.assertEqual(state["phase"], "mission_result")
        self.assertEqual(state["last_result"]["result"], "success")
        self.assertTrue(any(event["type"] == "bomb_busters:mission_result" for event in events))

    def test_duo_miss_advances_detonator_and_hides_own_wire_from_event(self):
        state = finish_initial_info(make_state(3, preset="short_practice"))
        own, target = rig_playing(
            state,
            "p0",
            [
                {"owner_id": "p0", "kind": "blue", "blue_value": 3},
                {"owner_id": "p1", "kind": "blue", "blue_value": 4},
            ],
        )
        events, error = BombBustersGame.apply_action(
            state,
            "p0",
            {"type": "dual_cut", "own_wire_id": own["wire_id"], "target_wire_id": target["wire_id"]},
        )
        self.assertIsNone(error)
        self.assertEqual(own["status"], "uncut")
        self.assertEqual(state["detonator"]["remaining"], 2)
        self.assertIsNotNone(target["info_token_id"])
        self.assertNotIn(own["wire_id"], json.dumps(events))

    def test_duo_cut_red_target_immediately_fails(self):
        state = finish_initial_info(make_state(2, preset="standard_practice"))
        own, target = rig_playing(
            state,
            "p0",
            [
                {"owner_id": "p0", "kind": "blue", "blue_value": 3},
                {"owner_id": "p1", "kind": "red", "sort_tick": 35},
            ],
        )
        _, error = BombBustersGame.apply_action(
            state,
            "p0",
            {"type": "dual_cut", "own_wire_id": own["wire_id"], "target_wire_id": target["wire_id"]},
        )
        self.assertIsNone(error)
        self.assertEqual(state["phase"], "mission_result")
        self.assertEqual(state["last_result"]["reason"], "red_wire")
        self.assertEqual(state["detonator"]["mistakes_used"], 0)

    def test_yellow_matches_yellow_without_comparing_sort_ticks(self):
        state = finish_initial_info(make_state(2, preset="standard_practice"))
        own, target = rig_playing(
            state,
            "p0",
            [
                {"owner_id": "p0", "kind": "yellow", "sort_tick": 11},
                {"owner_id": "p1", "kind": "yellow", "sort_tick": 101},
            ],
        )
        _, error = BombBustersGame.apply_action(
            state,
            "p0",
            {"type": "dual_cut", "own_wire_id": own["wire_id"], "target_wire_id": target["wire_id"]},
        )
        self.assertIsNone(error)
        self.assertEqual((own["status"], target["status"]), ("cut", "cut"))

    def test_solo_cut_requires_the_complete_remaining_set_and_two_or_four(self):
        state = finish_initial_info(make_state(2, preset="short_practice"))
        wires = rig_playing(
            state,
            "p0",
            [
                {"owner_id": "p0", "kind": "blue", "blue_value": 5},
                {"owner_id": "p0", "kind": "blue", "blue_value": 5},
                {"owner_id": "p1", "kind": "blue", "blue_value": 5},
            ],
        )
        _, error = BombBustersGame.apply_action(
            state,
            "p0",
            {"type": "solo_cut", "wire_ids": [wires[0]["wire_id"], wires[1]["wire_id"]]},
        )
        self.assertEqual(error, "Solo Cut must include every remaining matching wire")

        wires[2]["status"] = "cut"
        _refresh_validation(state)
        events, error = BombBustersGame.apply_action(
            state,
            "p0",
            {"type": "solo_cut", "wire_ids": [wires[0]["wire_id"], wires[1]["wire_id"]]},
        )
        self.assertIsNone(error)
        self.assertTrue(any(event["type"] == "bomb_busters:solo_cut" for event in events))

    def test_reveal_red_secures_every_remaining_wire(self):
        state = finish_initial_info(make_state(2, preset="standard_practice"))
        wires = rig_playing(
            state,
            "p0",
            [
                {"owner_id": "p0", "kind": "red", "sort_tick": 25},
                {"owner_id": "p0", "kind": "red", "sort_tick": 85},
            ],
        )
        _, error = BombBustersGame.apply_action(state, "p0", {"type": "reveal_red_wires"})
        self.assertIsNone(error)
        self.assertTrue(all(wire["status"] == "secured" for wire in wires))
        self.assertEqual(state["last_result"]["result"], "success")

    def test_double_detector_two_matches_waits_for_owner_choice(self):
        state = finish_initial_info(make_state(2, preset="short_practice"))
        own, target_a, target_b = rig_playing(
            state,
            "p0",
            [
                {"owner_id": "p0", "kind": "blue", "blue_value": 6},
                {"owner_id": "p1", "kind": "blue", "blue_value": 6},
                {"owner_id": "p1", "kind": "blue", "blue_value": 6},
            ],
        )
        events, error = BombBustersGame.apply_action(
            state,
            "p0",
            {
                "type": "double_detector_cut",
                "own_wire_id": own["wire_id"],
                "target_wire_ids": [target_a["wire_id"], target_b["wire_id"]],
            },
        )
        self.assertIsNone(error)
        self.assertEqual(state["phase"], "awaiting_detector_choice")
        self.assertTrue(state["players"]["p0"]["personal_detector_used"])
        self.assertNotIn("both", json.dumps(events).lower())
        p0_view = BombBustersGame.get_public_view(state, "p0")
        p1_view = BombBustersGame.get_public_view(state, "p1")
        self.assertEqual(p0_view["pending_choice_wire_ids"], [])
        self.assertCountEqual(
            p1_view["pending_choice_wire_ids"], [target_a["wire_id"], target_b["wire_id"]]
        )

        _, error = BombBustersGame.apply_action(
            state, "p1", {"type": "resolve_detector_choice", "wire_id": target_b["wire_id"]}
        )
        self.assertIsNone(error)
        self.assertEqual((own["status"], target_b["status"]), ("cut", "cut"))
        self.assertEqual(target_a["status"], "uncut")

    def test_double_detector_miss_non_red_waits_for_info_choice_once(self):
        state = finish_initial_info(make_state(3, preset="short_practice"))
        own, target_a, target_b = rig_playing(
            state,
            "p0",
            [
                {"owner_id": "p0", "kind": "blue", "blue_value": 2},
                {"owner_id": "p1", "kind": "blue", "blue_value": 7},
                {"owner_id": "p1", "kind": "yellow", "sort_tick": 81},
            ],
        )
        _, error = BombBustersGame.apply_action(
            state,
            "p0",
            {
                "type": "double_detector_cut",
                "own_wire_id": own["wire_id"],
                "target_wire_ids": [target_a["wire_id"], target_b["wire_id"]],
            },
        )
        self.assertIsNone(error)
        self.assertEqual(state["detonator"]["mistakes_used"], 1)
        _, error = BombBustersGame.apply_action(
            state, "p1", {"type": "resolve_detector_choice", "wire_id": target_a["wire_id"]}
        )
        self.assertIsNone(error)
        self.assertEqual(state["detonator"]["mistakes_used"], 1)
        self.assertIsNotNone(target_a["info_token_id"])

    def test_double_detector_one_red_reveals_only_non_red_info(self):
        state = finish_initial_info(make_state(3, preset="standard_practice"))
        own, red_target, blue_target = rig_playing(
            state,
            "p0",
            [
                {"owner_id": "p0", "kind": "blue", "blue_value": 2},
                {"owner_id": "p1", "kind": "red", "sort_tick": 65},
                {"owner_id": "p1", "kind": "blue", "blue_value": 9},
            ],
        )
        events, error = BombBustersGame.apply_action(
            state,
            "p0",
            {
                "type": "double_detector_cut",
                "own_wire_id": own["wire_id"],
                "target_wire_ids": [red_target["wire_id"], blue_target["wire_id"]],
            },
        )
        self.assertIsNone(error)
        self.assertEqual(state["phase"], "playing")
        self.assertIsNone(red_target["info_token_id"])
        self.assertIsNotNone(blue_target["info_token_id"])
        self.assertNotIn("red_target", json.dumps(events))


class BombBustersPrivacyAndFlowTests(unittest.TestCase):
    def test_public_view_hides_teammate_faces_and_server_secrets(self):
        state = finish_initial_info(make_state(3, preset="high_risk_practice", seed="privacy"))
        view = BombBustersGame.get_public_view(state, "p0")
        hidden = [
            wire
            for rack in view["racks"]
            if rack["owner_id"] != "p0"
            for wire in rack["slots"]
            if wire["status"] == "uncut"
        ]
        self.assertTrue(hidden)
        for wire in hidden:
            self.assertTrue(wire["hidden"])
            for secret_key in ("kind", "blue_value", "sort_tick", "match_key"):
                self.assertNotIn(secret_key, wire)
        self.assertNotIn("rng_seed", view)
        self.assertNotIn("private_audit", view)
        self.assertNotIn("in_play_wire_ids", view)

    def test_result_waits_for_every_human_and_rotates_captain(self):
        state = finish_initial_info(make_state(2, preset="short_practice", seed="ready"))
        own, target = rig_playing(
            state,
            "p0",
            [
                {"owner_id": "p0", "kind": "blue", "blue_value": 4},
                {"owner_id": "p1", "kind": "blue", "blue_value": 4},
            ],
        )
        BombBustersGame.apply_action(
            state,
            "p0",
            {"type": "dual_cut", "own_wire_id": own["wire_id"], "target_wire_id": target["wire_id"]},
        )
        old_captain = state["captain_id"]
        BombBustersGame.apply_action(state, "p0", {"type": "continue_mission"})
        self.assertEqual(state["phase"], "mission_result")
        BombBustersGame.apply_action(state, "p1", {"type": "continue_mission"})
        self.assertEqual(state["phase"], "initial_info")
        self.assertNotEqual(state["captain_id"], old_captain)
        self.assertEqual(state["mission_number"], 2)

    def test_bot_decision_uses_the_public_view_only(self):
        state_a = finish_initial_info(make_state(2, preset="standard_practice", seed="fair-bot"))
        state_a["current_turn"] = "p0"
        state_a["players"]["p0"]["personal_detector_used"] = True
        state_b = copy.deepcopy(state_a)
        target_id = state_b["players"]["p1"]["rack_ids"][0]
        hidden_wire_id = next(
            wire_id
            for wire_id in state_b["racks"][target_id]["slots"]
            if state_b["wires"][wire_id]["status"] == "uncut"
        )
        hidden_wire = state_b["wires"][hidden_wire_id]
        hidden_wire["kind"] = "blue" if hidden_wire["kind"] != "blue" else "yellow"
        hidden_wire["blue_value"] = 12 if hidden_wire["kind"] == "blue" else None
        self.assertEqual(
            BombBustersGame.get_public_view(state_a, "p0")["racks"],
            BombBustersGame.get_public_view(state_b, "p0")["racks"],
        )
        self.assertEqual(BombBustersGame.bot_move(state_a, "p0"), BombBustersGame.bot_move(state_b, "p0"))

    def test_serialization_round_trip_preserves_pending_choice(self):
        state = finish_initial_info(make_state(2, preset="short_practice"))
        own, target_a, target_b = rig_playing(
            state,
            "p0",
            [
                {"owner_id": "p0", "kind": "blue", "blue_value": 6},
                {"owner_id": "p1", "kind": "blue", "blue_value": 6},
                {"owner_id": "p1", "kind": "blue", "blue_value": 6},
            ],
        )
        BombBustersGame.apply_action(
            state,
            "p0",
            {
                "type": "double_detector_cut",
                "own_wire_id": own["wire_id"],
                "target_wire_ids": [target_a["wire_id"], target_b["wire_id"]],
            },
        )
        payload = json.loads(json.dumps(BombBustersGame.serialize(state)))
        restored = BombBustersGame.deserialize(payload)
        self.assertEqual(restored["phase"], "awaiting_detector_choice")
        self.assertEqual(restored["pending_resolution"], state["pending_resolution"])
        self.assertEqual(restored["current_responder_id"], "p1")


if __name__ == "__main__":
    unittest.main()
