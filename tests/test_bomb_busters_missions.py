import copy
import json
import unittest

from jsonschema import Draft7Validator

from game import get_game
from game import bomb_busters_campaign as campaign
from game.bomb_busters import BombBustersGame, _assert_state_invariants
from game.bomb_busters_missions import AUDIO_MISSIONS, MISSION_COUNT, get_mission
from tests.test_bomb_busters_game import make_players, rig_playing


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


if __name__ == "__main__":
    unittest.main()
