from __future__ import annotations

import unittest

from jsonschema import validate

from game import ark_nova as rules
from game.definitions import ARK_NOVA_ACTION_SCHEMA
from tests import test_ark_nova_rule_regressions as fixtures


class ArkNovaAnimalPlayContracts(unittest.TestCase):
    def test_every_animal_and_printed_enclosure_pass_the_actual_action_entry(self):
        # The independent printed-card fixtures establish which enclosure options
        # are correct. Here they must also survive the network schema and engine,
        # including petting-only animals and zero-capacity reptile-house options.
        for card_id in map(str, range(401, 529)):
            card = rules.ANIMAL_CARDS[card_id]
            for option in card["enclosure_options"]:
                with self.subTest(card_id=card_id, enclosure=option["type"]):
                    h = fixtures.ArkNovaRuleRegressions()
                    h.setUp()
                    kind = "standard_enclosure" if option["type"] == "standard" else option["type"]
                    size = (int(option["required_spaces"]) if kind == "standard_enclosure"
                            else rules.BUILDING_SIZES[kind])
                    building = h.building(size, kind)
                    h.hand(card_id)
                    h.player.update(money=100, partner_zoos=["europe"])
                    h.player["action_cards"]["animals"]["upgraded"] = True
                    h.player["active_effects"]["219"] = {"modifier": "ignore_water_rock_rules"}
                    for condition in card["play"]["conditions"]:
                        if condition["kind"] == "tag_count":
                            h.player["tags"][condition["tag"]] = condition["minimum"]
                    h.helper.set_slot(h.state, "p1", "animals", 5)
                    action = {
                        "type": "animals", "gain_reputation": False, "choose_effect_order": True,
                        "plays": [{"card_id": card_id, "enclosure_id": building["id"]}],
                    }
                    validate(action, ARK_NOVA_ACTION_SCHEMA)
                    h.act(action)
                    self.assertIn(card_id, h.player["played_animals"])
                    self.assertNotIn(card_id, h.player["hand"])
                    occupied = next(b for b in h.player["map"]["buildings"] if b["id"] == building["id"])
                    self.assertEqual(occupied["used_capacity"], option["required_spaces"])
                    self.assertIn(card_id, occupied["occupied_by"])


if __name__ == "__main__":
    unittest.main()
