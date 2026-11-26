import copy
import json
import unittest

from jsonschema import Draft7Validator

from game import get_game
from game import bomb_busters_campaign as campaign
from game.bomb_busters import BombBustersGame, _assert_state_invariants
from game.bomb_busters_missions import AUDIO_MISSIONS, MISSION_COUNT, get_mission
from tests.test_bomb_busters_game import finish_initial_info, make_players, make_state, rig_playing


def make_mission(number, count=3, seed="campaign-test"):
    return BombBustersGame.init_game({"mission_id": number, "seed": seed}, make_players(count))


def apply(state, actor_id, action):
    events, error = BombBustersGame.apply_action(state, actor_id, action)
    if error:
        raise AssertionError(f"Mission {state['mission_id']}: {action}: {error}")
    return events


def finish_setup(state):
    for _ in range(60):
        if state["phase"] == "playing":
            return state
        actor = next((player_id for player_id in state["turn_order"]
                      if BombBustersGame.get_legal_actions(state, player_id)), None)
        if actor is None:
            raise AssertionError(f"Setup stalled in {state['phase']}")
        action = BombBustersGame.bot_move(state, actor)
        if action is None:
            raise AssertionError(f"No setup action for {actor}")
        action = {key: value for key, value in action.items() if key != "delay_ms"}
        apply(state, actor, action)
    raise AssertionError("Setup did not terminate")


def rig(state, actor_id, specs):
    for wire in state["wires"].values():
        for key in ("reversed", "unsorted", "clue", "danger"):
            wire.pop(key, None)
    state["campaign"]["decision"] = None
    state["campaign"]["reserve"] = []
    state["campaign"]["equipment"] = []
    return rig_playing(state, actor_id, specs)


def blue(owner_id, value):
    return {"owner_id": owner_id, "kind": "blue", "blue_value": value}


class BombBustersCampaignCatalogTests(unittest.TestCase):
    def test_all_missions_setup_views_schemas_and_save_roundtrip(self):
        definition = get_game("bomb_busters")
        validator = Draft7Validator(definition.action_schema)
        combinations = 0
        for count in range(2, 6):
            for number in range(1, MISSION_COUNT + 1):
                if count == 2 and number in (34, 65):
                    with self.assertRaisesRegex(ValueError, "3 to 5"):
                        make_mission(number, count)
                    continue
                with self.subTest(players=count, mission=number):
                    state = make_mission(number, count)
                    mission = get_mission(number, count)
                    self.assertEqual(mission["audio_companion"], number in AUDIO_MISSIONS)
                    self.assertEqual(len(state["wires"]) + len(state["campaign"]["reserve"]),
                                     mission["blue_max"] * 4 + mission["yellow_count"] + mission["red_count"]
                                     + (11 if number == 54 else 0))
                    for _ in range(60):
                        _assert_state_invariants(state)
                        saved = json.loads(json.dumps(definition.serialize(state)))
                        restored = definition.deserialize(saved)
                        for viewer_id in [*state["turn_order"], "spectator"]:
                            self.assertEqual(BombBustersGame.get_public_view(state, viewer_id),
                                             BombBustersGame.get_public_view(restored, viewer_id))
                        if state["phase"] == "playing":
                            break
                        actor = next(player_id for player_id in state["turn_order"]
                                     if BombBustersGame.get_legal_actions(state, player_id))
                        action = BombBustersGame.bot_move(state, actor)
                        self.assertIsNotNone(action)
                        action = {key: value for key, value in action.items() if key != "delay_ms"}
                        validator.validate(action)
                        apply(state, actor, action)
                    self.assertEqual(state["phase"], "playing")
                    combinations += 1
        self.assertEqual(combinations, 262)

    def test_mission_ids_are_strict_and_catalog_is_copied(self):
        for number in (0, 67, True, "1", 1.5):
            with self.assertRaises(ValueError):
                get_mission(number, 3)
        mission = get_mission(46, 3)
        mission["rules"] = "modified"
        self.assertNotEqual(get_mission(46, 3)["rules"], "modified")

    def test_help_rules_are_bilingual_for_every_mission(self):
        for number in range(1, MISSION_COUNT + 1):
            with self.subTest(mission=number):
                mission = get_mission(number, 3)
                self.assertTrue(mission["rules"].strip())
                self.assertRegex(mission["rules_zh"], r"[\u4e00-\u9fff]")
                self.assertNotIn(";", mission["rules"])
                self.assertNotIn("；", mission["rules_zh"])

    def test_help_uses_current_mission_translation_for_older_saves(self):
        state = make_mission(46)
        state["campaign"]["mission"].pop("rules_zh", None)
        saved = json.loads(json.dumps(BombBustersGame.serialize(state)))
        restored = BombBustersGame.deserialize(saved)
        expected = get_mission(46, 3)
        for viewer_id in [*state["turn_order"], "spectator"]:
            with self.subTest(viewer=viewer_id):
                view = BombBustersGame.get_public_view(restored, viewer_id)
                self.assertEqual(view["campaign"]["id"], 46)
                self.assertEqual(view["campaign"]["rules_zh"], expected["rules_zh"])
                self.assertEqual(view["campaign"]["rules"], expected["rules"])
        self.assertNotIn("rules_zh", restored["campaign"]["mission"])


class BombBustersCampaignRuleTests(unittest.TestCase):
    def test_mission_46_yellow_is_not_seven_and_early_seven_misses(self):
        state = make_mission(46)
        wires = rig(state, "p0", [blue("p0", 2), blue("p1", 7),
                                    {"owner_id": "p0", "kind": "yellow"},
                                    {"owner_id": "p1", "kind": "yellow"}, blue("p2", 5)])
        self.assertIsNone(campaign._value(state, wires[2]))
        apply(state, "p0", {"type": "dual_cut", "own_wire_id": wires[0]["wire_id"],
                            "target_wire_id": wires[1]["wire_id"]})
        self.assertEqual(state["wires"][wires[1]["wire_id"]]["status"], "uncut")
        self.assertEqual(state["detonator"]["mistakes_used"], 1)
        self.assertEqual(state["wires"][wires[1]["wire_id"]]["clue"]["label"], "7")
        state["current_turn"] = "p0"
        apply(state, "p0", {"type": "dual_cut", "own_wire_id": wires[2]["wire_id"],
                            "target_wire_id": wires[3]["wire_id"]})
        self.assertEqual(state["wires"][wires[2]["wire_id"]]["status"], "cut")

    def test_mission_22_places_two_absent_clues(self):
        state = make_mission(22, 5)
        actor = state["initial_info_order"][0]
        self.assertEqual(state["campaign"]["initial_remaining"][actor], 2)
        labels = BombBustersGame.get_public_view(state, actor)["campaign"]["initial_label_choices"]
        apply(state, actor, {"type": "place_initial_info", "label": labels[0]})
        if len(labels) > 1:
            self.assertEqual(state["initial_info_order"][state["initial_info_cursor"]], actor)
            apply(state, actor, {"type": "place_initial_info", "label": labels[1]})
        notes = state["campaign"]["clue_notes"]
        self.assertEqual(len([note for note in notes if note["player_id"] == actor]), min(2, len(labels)))

    def test_clue_supply_returns_on_cut_and_spoken_does_not_persist(self):
        state = make_mission(4)
        wires = rig(state, "p0", [blue("p0", 1), blue("p1", 1), blue("p2", 1)])
        for wire in wires[:2]:
            self.assertEqual(campaign._clue(state, wire)["mode"], "token")
        clue = campaign._clue(state, wires[2])
        self.assertEqual(clue["mode"], "spoken")
        self.assertNotIn("clue", wires[2])
        self.assertEqual(BombBustersGame.get_public_view(state, "p0")["info_supply"]["1"], 0)
        campaign._cut(state, wires[0])
        self.assertEqual(campaign._clue(state, wires[2])["mode"], "token")
        _assert_state_invariants(state)

    def test_negative_clue_supply_and_actual_value_privacy(self):
        state = make_mission(52)
        wire = rig(state, "p0", [blue("p0", 1), blue("p1", 2)])[0]
        campaign._clue(state, wire, chosen="3")
        _assert_state_invariants(state)
        view = BombBustersGame.get_public_view(state, "p1")
        shown = next(shown for rack in view["racks"] for shown in rack["slots"]
                     if shown["wire_id"] == wire["wire_id"])
        self.assertTrue(shown["hidden"])
        self.assertNotIn("blue_value", shown)

    def test_x_wire_cannot_be_targeted_before_yellow_cleared(self):
        state = make_mission(35)
        wires = rig(state, "p0", [blue("p0", 2), blue("p1", 2),
                                    {"owner_id": "p2", "kind": "yellow"}])
        wires[1]["unsorted"] = True
        before = copy.deepcopy(state)
        events, error = BombBustersGame.apply_action(state, "p0", {
            "type": "dual_cut", "own_wire_id": wires[0]["wire_id"], "target_wire_id": wires[1]["wire_id"]})
        self.assertIn("X-wires", error)
        self.assertEqual(events, [])
        self.assertEqual(state, before)

    def test_nano_pending_insert_prevents_premature_success(self):
        state = make_mission(43, 2)
        wires = rig(state, "p0", [blue("p0", 1), blue("p1", 1)])
        candidate = next(wire for wire in state["wires"].values() if wire not in wires)
        rack = state["racks"][candidate["rack_id"]]
        rack["slots"].remove(candidate["wire_id"])
        state["wires"].pop(candidate["wire_id"])
        candidate.update(kind="blue", blue_value=3, sort_tick=30, status="uncut", info_token_id=None)
        state["campaign"]["reserve"] = [candidate]
        state["campaign"]["nano"]["position"] = 1
        campaign._reindex(state)
        apply(state, "p0", {"type": "dual_cut", "own_wire_id": wires[0]["wire_id"],
                            "target_wire_id": wires[1]["wire_id"]})
        self.assertEqual(state["phase"], "mission_decision")
        self.assertEqual(len(campaign._all_remaining(state)), 1)
        rack_id = state["players"]["p0"]["rack_ids"][0]
        apply(state, "p0", {"type": "mission_choice", "choice": rack_id})
        self.assertEqual(state["wires"][candidate["wire_id"]]["status"], "uncut")

    def test_round_refills_oxygen_when_captain_is_empty(self):
        state = make_mission(44)
        order = campaign._order(state)
        rig(state, order[-1], [blue(order[1], 1), blue(order[-1], 1)])
        state["campaign"]["oxygen_reserve"] = 0
        events = []
        campaign._advance(state, order[-1], events)
        self.assertEqual(state["current_turn"], order[1])
        self.assertEqual(state["campaign"]["round"], 2)
        self.assertEqual(state["campaign"]["oxygen_reserve"], 6)

    def test_underwater_removes_oxygen_from_both_empty_hands(self):
        state = make_mission(49)
        wires = rig(state, "p0", [blue("p0", 1), blue("p1", 1), blue("p2", 2)])
        apply(state, "p0", {"type": "dual_cut", "own_wire_id": wires[0]["wire_id"],
                            "target_wire_id": wires[1]["wire_id"], "recipient_id": "p1"})
        self.assertEqual(state["campaign"]["oxygen"]["p0"], 0)
        self.assertEqual(state["campaign"]["oxygen"]["p1"], 0)

    def test_constraint_ring_has_interleaved_empty_seats(self):
        for count in (2, 3, 4, 5):
            with self.subTest(players=count):
                state = make_mission(61, count)
                data = state["campaign"]
                order = campaign._order(state)
                seats = data["constraint_seats"]
                self.assertEqual(len(seats), max(4, count))
                if count < 4:
                    self.assertIsNone(seats[1])
                if count == 2:
                    self.assertIsNone(seats[-1])
                for owner in order:
                    self.assertEqual(data["constraint_ring"][seats.index(owner)], data["constraints"][owner])
                self.assertEqual(len(set(data["constraint_ring"])), len(seats))

    def test_memory_clue_is_ephemeral_and_constraint_map_is_public(self):
        state = make_mission(50)
        wire = rig(state, "p0", [blue("p0", 3), blue("p1", 2)])[0]
        clue = campaign._clue(state, wire)
        self.assertEqual(clue["mode"], "spoken")
        self.assertNotIn("clue", wire)
        self.assertEqual(state["campaign"]["clue_notes"], [])
        view = BombBustersGame.get_public_view(state, "p1")
        self.assertEqual(view["public_color_markers"], {})
        self.assertEqual(view["cut_blue_counts"], {})
        state = make_mission(57)
        view = BombBustersGame.get_public_view(state, "spectator")
        self.assertEqual(view["campaign"]["constraint_map"], state["campaign"]["constraint_map"])


class BombBustersEquipmentRegressionTests(unittest.TestCase):
    def test_relation_labels_are_public_and_survive_save_load(self):
        for kind, values, symbol in (("equal", (3, 3), "="), ("not_equal", (3, 4), "≠")):
            with self.subTest(equipment=kind):
                state = finish_setup(make_mission(9))
                wires = rig(state, "p0", [blue("p0", values[0]), blue("p0", values[1]), blue("p1", 2)])
                card = campaign._equipment_card(kind, 0)
                card["unlocked"] = True
                state["campaign"]["equipment"] = [card]
                apply(state, "p0", {"type": "use_equipment", "equipment_id": card["id"], "wire_ids": [wire["wire_id"] for wire in wires[:2]]})
                expected = [{"wire_ids": [wire["wire_id"] for wire in wires[:2]], "relation": symbol}]
                restored = BombBustersGame.deserialize(BombBustersGame.serialize(state))
                for viewer in ("p0", "p1", "spectator"):
                    view = BombBustersGame.get_public_view(restored, viewer)
                    self.assertEqual(view["campaign"]["links"], expected)
                    if viewer != "p0":
                        for rack in view["racks"]:
                            if rack["owner_id"] == "p0":
                                self.assertTrue(all("blue_value" not in wire for wire in rack["slots"] if wire["status"] == "uncut"))

    def test_walkie_talkies_offer_and_private_return_use_distinct_payloads(self):
        state = finish_setup(make_mission(9))
        own, teammate, _ = rig(state, "p0", [blue("p0", 3), blue("p1", 4), blue("p2", 5)])
        card = campaign._equipment_card("walkie_talkies", 0)
        card["unlocked"] = True
        state["campaign"]["equipment"] = [card]
        apply(state, "p0", {"type": "use_equipment", "equipment_id": card["id"], "own_wire_id": own["wire_id"], "recipient_id": "p1"})
        self.assertEqual(state["phase"], "mission_decision")
        for viewer in ("p0", "p1", "spectator"):
            decision = BombBustersGame.get_public_view(state, viewer)["campaign"]["decision"]
            self.assertEqual(decision["kind"], "exchange_wire")
            self.assertEqual(bool(decision["choices"]), viewer == "p1")
        apply(state, "p1", {"type": "mission_choice", "choice": teammate["wire_id"]})
        self.assertEqual(state["wires"][own["wire_id"]]["owner_id"], "p1")
        self.assertEqual(state["wires"][teammate["wire_id"]]["owner_id"], "p0")
        self.assertEqual(state["current_turn"], "p0")
        self.assertTrue(state["campaign"]["equipment"][0]["used"])
        _assert_state_invariants(state)

    def test_persistent_equipment_clues_and_stabilizer_are_in_public_view(self):
        for kind in ("post_it", "single_label", "radar", "stabilizer"):
            with self.subTest(equipment=kind):
                state = finish_setup(make_mission(9))
                own, _, _ = rig(state, "p0", [blue("p0", 3), blue("p1", 4), blue("p2", 5)])
                if kind == "single_label":
                    for wire in state["wires"].values():
                        if wire["rack_id"] == own["rack_id"] and wire["wire_id"] != own["wire_id"] and wire["kind"] == "blue":
                            wire["blue_value"] = 2
                card = campaign._equipment_card(kind, 0)
                card["unlocked"] = True
                state["campaign"]["equipment"] = [card]
                action = {"type": "use_equipment", "equipment_id": card["id"]}
                if kind in ("post_it", "single_label"):
                    action["wire_id"] = own["wire_id"]
                if kind == "radar":
                    action["value"] = 3
                apply(state, "p0", action)
                view = BombBustersGame.get_public_view(state, "p1")
                if kind in ("post_it", "single_label"):
                    wire = next(wire for rack in view["racks"] for wire in rack["slots"] if wire["wire_id"] == own["wire_id"])
                    self.assertEqual(wire["public_info"], "3" if kind == "post_it" else "×1")
                elif kind == "radar":
                    self.assertEqual(view["campaign"]["radar_value"], 3)
                    self.assertTrue(next(entry for entry in view["campaign"]["radar"] if entry["rack_id"] == own["rack_id"])["has_value"])
                else:
                    self.assertEqual(view["campaign"]["stabilized"], "p0")


class BombBustersFailureAttributionTests(unittest.TestCase):
    def assert_failure(self, state, events, expected_player, reason):
        self.assertEqual(state["phase"], "mission_result")
        result = state["last_result"]
        self.assertEqual(result["reason"], reason)
        self.assertEqual(result["failed_by"], expected_player)
        self.assertEqual(state["mission_history"][-1], result)
        emitted = next(event["payload"] for event in events if event["type"] == "bomb_busters:mission_result")
        self.assertEqual(emitted, result)
        restored = BombBustersGame.deserialize(BombBustersGame.serialize(state))
        for viewer in ("p0", "p1", "spectator"):
            self.assertEqual(BombBustersGame.get_public_view(restored, viewer)["last_result"], result)

    def test_red_wire_and_final_miss_name_the_cutter_not_the_wire_owner(self):
        for mode in ("practice", "campaign"):
            for detector in (False, True):
                for reason in ("red_wire", "detonator"):
                    with self.subTest(mode=mode, detector=detector, reason=reason):
                        state = finish_setup(make_mission(9)) if mode == "campaign" else finish_initial_info(make_state(3))
                        target = {"owner_id": "p1", "kind": "red", "sort_tick": 35} if reason == "red_wire" else blue("p1", 4)
                        second = {"owner_id": "p1", "kind": "red", "sort_tick": 45} if reason == "red_wire" else blue("p1", 5)
                        prepare = rig if mode == "campaign" else rig_playing
                        wires = prepare(state, "p0", [blue("p0", 3), target, second, blue("p2", 1)])
                        if reason == "detonator":
                            state["detonator"].update(mistakes_used=2, remaining=1)
                        action = {"type": "double_detector_cut" if detector else "dual_cut", "own_wire_id": wires[0]["wire_id"]}
                        if detector:
                            action["target_wire_ids"] = [wire["wire_id"] for wire in wires[1:3]]
                        else:
                            action["target_wire_id"] = wires[1]["wire_id"]
                        events = apply(state, "p0", action)
                        self.assert_failure(state, events, "p0", reason)

    def test_out_of_turn_constraint_penalty_names_its_actor(self):
        state = finish_setup(make_mission(61))
        rig(state, "p0", [blue("p0", 3), blue("p1", 4), blue("p2", 5)])
        state["detonator"].update(mistakes_used=2, remaining=1)
        events = apply(state, "p1", {"type": "mission_choice", "choice": "replace_constraint"})
        self.assert_failure(state, events, "p1", "detonator")

    def test_wrong_special_identification_names_the_actor(self):
        state = finish_setup(make_mission(13))
        wires = rig(state, "p0", [blue("p0", 3), blue("p1", 4), blue("p2", 5)])
        events = apply(state, "p0", {"type": "special_cut", "wire_ids": [wire["wire_id"] for wire in wires]})
        self.assert_failure(state, events, "p0", "special_cut")

    def test_nano_final_space_names_the_cutter(self):
        state = finish_setup(make_mission(53))
        own, target, _ = rig(state, "p0", [blue("p0", 3), blue("p1", 3), blue("p2", 5)])
        state["campaign"]["nano"]["position"] = 11
        events = apply(state, "p0", {"type": "dual_cut", "own_wire_id": own["wire_id"], "target_wire_id": target["wire_id"]})
        self.assert_failure(state, events, "p0", "nano")

    def test_prediction_final_penalty_names_the_predictor_not_the_cutter(self):
        state = finish_setup(make_mission(29))
        own, target, _ = rig(state, "p0", [blue("p0", 3), blue("p1", 3), blue("p2", 5)])
        state["campaign"]["prediction"] = {"value": 3, "predictor_id": "p2"}
        state["detonator"].update(mistakes_used=2, remaining=1)
        events = apply(state, "p0", {"type": "dual_cut", "own_wire_id": own["wire_id"], "target_wire_id": target["wire_id"]})
        self.assert_failure(state, events, "p2", "detonator")

    def test_old_result_without_attribution_still_loads(self):
        state = finish_setup(make_mission(9))
        own, target, _ = rig(state, "p0", [blue("p0", 3), {"owner_id": "p1", "kind": "red", "sort_tick": 35}, blue("p2", 5)])
        apply(state, "p0", {"type": "dual_cut", "own_wire_id": own["wire_id"], "target_wire_id": target["wire_id"]})
        state["last_result"].pop("failed_by")
        state["mission_history"][-1].pop("failed_by")
        restored = BombBustersGame.deserialize(BombBustersGame.serialize(state))
        self.assertNotIn("failed_by", BombBustersGame.get_public_view(restored, "p0")["last_result"])

    def test_timeout_and_recording_failure_do_not_blame_the_reporting_player(self):
        for number, choice, reason in ((10, "timer_expired", "timer"), (19, "audio_failure", "audio_failed")):
            with self.subTest(mission=number):
                state = finish_setup(make_mission(number))
                state["current_turn"] = "p0"
                if number == 10:
                    state["campaign"]["clock"]["deadline"] = 0
                events = apply(state, state["captain_id"], {"type": "mission_choice", "choice": choice})
                self.assert_failure(state, events, None, reason)

    def test_nonfatal_miss_does_not_emit_final_failure(self):
        state = finish_setup(make_mission(9))
        own, target, _ = rig(state, "p0", [blue("p0", 3), blue("p1", 4), blue("p2", 5)])
        events = apply(state, "p0", {"type": "dual_cut", "own_wire_id": own["wire_id"], "target_wire_id": target["wire_id"]})
        self.assertIsNone(state["last_result"])
        self.assertFalse(any(event["type"] == "bomb_busters:mission_result" for event in events))


if __name__ == "__main__":
    unittest.main()
