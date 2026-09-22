"""Interaction regressions for the base powers outside the teaching progressions."""
import unittest

from game import spirit_island as si
from game.spirit_island_data import POWERS


class SpiritIslandExtraTests(unittest.TestCase):
    def state(self, count=2):
        state = si.SpiritIslandGame.init_game({"seed": 105}, [
            {"player_id": f"p{i}", "name": f"Spirit {i}", "seat": i} for i in range(count)])
        for i, spirit in enumerate(("lightning", "river")[:count]):
            _, error = si.SpiritIslandGame.apply_action(state, f"p{i}",
                                                       {"type": "choose_spirit", "spirit_id": spirit})
            self.assertIsNone(error)
        state.update(phase="fast", pending=None, effects=[], fear_pool=100, fear_generated=0)
        for land in state["lands"].values():
            land.update(pieces=[], presence={}, blight=0)
        for pid in state["turn_order"]:
            state["lands"]["A1"]["presence"][pid] = 2
            state["players"][pid]["energy"] = 0
        si._add_piece(state, "A8", "city")  # Preserve a distant victory condition.
        return state

    def choose(self, state, value):
        pending = state["pending"]
        self.assertIsNotNone(pending)
        _, error = si.SpiritIslandGame.apply_action(
            state, pending["player_id"], {"type": "choose", "value": value})
        self.assertIsNone(error, (pending, value, error))

    def settle(self, state, chooser=None):
        for _ in range(200):
            si._run(state)
            if state["game_over"] or not state["pending"]:
                return
            pending = state["pending"]
            value = chooser(pending) if chooser else pending["choices"][0]["value"]
            self.choose(state, value)
        self.fail("power did not finish")

    def power(self, state, cid, target="A4", settle=True):
        si._queue(state, [{"kind": "power", "player_id": "p0", "card_id": cid, "target": target}])
        if settle:
            self.settle(state)
        else:
            si._run(state)

    def test_elemental_boon_choice_belongs_to_recipient_and_self_is_not_doubled(self):
        for target in ("p0", "p1"):
            with self.subTest(target=target):
                state = self.state()
                self.power(state, "elemental_boon", target, settle=False)
                self.assertEqual(state["pending"]["player_id"], target)
                self.choose(state, ["sun", "moon", "fire"])
                self.assertEqual(si._elements(state, "p0"), {"sun": 1, "moon": 1, "fire": 1})
                if target == "p1":
                    self.assertEqual(si._elements(state, "p1"), si._elements(state, "p0"))

    def test_blazing_renewal_recipient_chooses_with_casters_range(self):
        state = self.state()
        state["players"]["p1"]["destroyed_presence"] = 2
        state["lands"]["A1"]["presence"]["p1"] = 0
        state["lands"]["C8"]["presence"]["p1"] = 1
        self.power(state, "blazing_renewal", "p1", settle=False)
        self.assertEqual(state["pending"]["player_id"], "p1")
        choices = {item["value"] for item in state["pending"]["choices"]}
        self.assertEqual(choices, {lid for lid in state["lands"] if si._distance(state, "A1", lid) <= 2})
        self.choose(state, "A1")
        self.settle(state)
        self.assertEqual(state["lands"]["A1"]["presence"]["p1"], 2)
        self.assertEqual(state["players"]["p1"]["destroyed_presence"], 0)

    def test_blazing_renewal_without_destroyed_presence_does_no_threshold_damage(self):
        state = self.state()
        state["players"]["p0"]["extra_elements"] = {"fire": 3, "earth": 3, "plant": 2}
        si._add_piece(state, "A1", "town")
        self.power(state, "blazing_renewal", "p1")
        self.assertEqual(si._pieces(state["lands"]["A1"])[0]["health"], 2)

    def test_entwined_solo_gets_two_cards_and_six_energy(self):
        state = self.state(1)
        player = state["players"]["p0"]
        player["extra_elements"] = {"water": 2, "plant": 4}
        before, progression = len(player["hand"]), player["progression_index"]
        self.power(state, "entwined_power", "p0")
        player = state["players"]["p0"]
        self.assertEqual(len(player["hand"]), before + 2)
        self.assertEqual(player["energy"], 6)
        self.assertEqual(player["progression_index"], progression)

    def test_entwined_forgetting_itself_removes_elements_before_threshold(self):
        state = self.state(1)
        player = state["players"]["p0"]
        player["played"] = ["entwined_power"]
        player["extra_elements"] = {"water": 1, "plant": 3}
        state["major_deck"] = ["cleansing_floods", "indomitable_claim", "infinite_vitality", "mists_of_oblivion"]
        before = len(player["hand"])
        self.power(state, "entwined_power", "p0", settle=False)
        self.choose(state, "major")
        self.choose(state, "cleansing_floods")
        self.assertEqual(state["pending"]["kind"], "forget")
        self.choose(state, "entwined_power")
        self.assertEqual(state["pending"]["kind"], "extra_draft_leftover")
        self.choose(state, "indomitable_claim")
        self.assertEqual(state["pending"]["kind"], "forget")
        self.choose(state, "indomitable_claim")
        self.settle(state)
        player = state["players"]["p0"]
        self.assertEqual(player["energy"], 0)
        self.assertEqual(len(player["hand"]), before + 1)
        self.assertIn("entwined_power", state["major_discard"])

    def test_gift_of_power_uses_minor_deck_without_advancing_progression(self):
        state = self.state()
        player = state["players"]["p1"]
        before, index = len(player["hand"]), player["progression_index"]
        self.power(state, "gift_of_power", "p1")
        player = state["players"]["p1"]
        self.assertEqual(len(player["hand"]), before + 1)
        self.assertEqual(POWERS[player["hand"][-1]]["type"], "minor")
        self.assertEqual(player["progression_index"], index)

    def test_mists_bonus_fear_is_capped_at_four(self):
        state = self.state()
        si._add_piece(state, "A4", "town", 5)
        for piece in si._pieces(state["lands"]["A4"]):
            piece["health"] = 1
        self.power(state, "mists_of_oblivion")
        self.assertEqual(state["fear_generated"], 9)
        self.assertEqual(state["mists_fear_used"], {})

    def test_vengeance_does_not_retrigger_itself_or_increase_mists_bonus(self):
        state = self.state()
        si._add_piece(state, "A4", "town", 3)
        towns = si._pieces(state["lands"]["A4"])
        towns[0]["health"] = 1
        self.power(state, "vengeance_of_the_dead")
        self.power(state, "mists_of_oblivion")
        # Mists kills one town; Vengeance kills a second, then stops. Only the
        # first town earns Mists' extra Fear (3 + 1 + 1 + 1 = 6).
        self.assertEqual(state["fear_generated"], 6)
        survivors = si._pieces(state["lands"]["A4"])
        self.assertEqual(len(survivors), 1)
        self.assertEqual(survivors[0]["health"], 1)

    def test_infinite_vitality_prevents_blight_and_dahan_destruction(self):
        state = self.state()
        state["players"]["p0"]["extra_elements"] = {"earth": 4}
        si._add_piece(state, "A4", "dahan")
        self.power(state, "infinite_vitality")
        before = state["blight_remaining"]
        si._queue(state, [{"kind": "blight", "player_id": "p0", "land_id": "A4"},
                          {"kind": "destroy", "player_id": "p0", "land_id": "A4", "types": ["dahan"]}])
        self.settle(state)
        self.assertEqual(state["lands"]["A4"]["blight"], 0)
        self.assertEqual(state["blight_remaining"], before)
        self.assertEqual(si._pieces(state["lands"]["A4"], ["dahan"])[0]["health"], 6)

    def test_tree_defense_moves_when_less_than_two_dahan_are_available(self):
        state = self.state()
        state["players"]["p0"]["extra_elements"] = {"sun": 2, "earth": 2, "plant": 2}
        si._add_piece(state, "A4", "dahan")
        destination = state["lands"]["A4"]["adjacent"][0]
        self.power(state, "the_trees_and_stones_speak_of_war")
        self.assertEqual(state["lands"]["A4"]["defend"], 0)
        self.assertEqual(state["lands"][destination]["defend"], 2)

    def test_constancy_can_only_reclaim_cards_played_this_turn(self):
        state = self.state()
        player = state["players"]["p0"]
        player["played"] = ["gift_of_constancy"]
        player["discard"] = ["gnawing_rootbiters"]
        self.power(state, "gift_of_constancy", "p0")
        si._enter_phase(state, "round_end")
        si._run(state)
        self.assertEqual([choice["value"] for choice in state["pending"]["choices"]],
                         ["gift_of_constancy", "skip"])
        self.choose(state, "gift_of_constancy")
        player = state["players"]["p0"]
        self.assertIn("gift_of_constancy", player["hand"])
        self.assertIn("gnawing_rootbiters", player["discard"])


if __name__ == "__main__":
    unittest.main()
