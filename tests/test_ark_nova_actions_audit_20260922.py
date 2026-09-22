from __future__ import annotations

import copy
import unittest

from game import ark_nova as rules
from tests import test_ark_nova_rule_regressions as fixtures


class ArkNovaActionsAudit20260922(unittest.TestCase):
    def setUp(self):
        self.h = fixtures.ArkNovaRuleRegressions()
        self.h.setUp()
        self.h.helper.set_slot(self.h.state, "p1", "association", 4)

    def second_university(self, *, spokesperson=False):
        h = self.h
        h.player["universities"] = ["university_hand_limit"]
        h.player["reputation"] = 9
        h.player["reputation_milestones_resolved"] = [5, 8]
        if spokesperson:
            h.player["played_sponsors"] = ["202"]
        rules._recompute_tags(h.player)
        h.act({"type": "association", "choose_effect_order": True, "tasks": [
            {"task": "university", "university_id": "university_reputation"},
        ]})

    def choose_effect(self, predicate):
        pending = self.h.state["pending_choice"]
        self.assertEqual(pending["type"], "effect_order")
        self.h.choose(next(index for index, ref in enumerate(pending["_effects"]) if predicate(ref)))

    def test_second_university_can_upgrade_cards_before_its_reputation(self):
        self.second_university()
        self.assertEqual(self.h.player["reputation"], 9)
        self.choose_effect(lambda ref: ref.get("operation") == "choice")
        self.h.choose("cards")
        self.h.finish_choices()
        self.assertEqual(self.h.player["reputation"], 11)
        self.assertEqual(self.h.player["conservation"], 1)
        self.assertEqual(self.h.state["current_player"], "p2")

    def test_second_university_can_take_reputation_before_upgrade(self):
        self.second_university()
        self.choose_effect(lambda ref: ref.get("rewards", {}).get("reputation"))
        self.h.choose("cards")
        self.h.finish_choices()
        self.assertEqual(self.h.player["reputation"], 9)
        self.assertTrue(self.h.player["action_cards"]["cards"]["upgraded"])

    def test_university_research_trigger_can_follow_upgrade_and_reputation(self):
        self.second_university(spokesperson=True)
        self.choose_effect(lambda ref: ref.get("operation") == "choice")
        self.h.choose("cards")
        self.h.finish_choices()
        self.assertEqual(self.h.player["reputation"], 12)
        self.assertEqual(self.h.player["conservation"], 1)
        self.assertEqual(self.h.player["x_tokens"], 1)

    def test_university_research_trigger_can_precede_upgrade(self):
        self.second_university(spokesperson=True)
        self.choose_effect(lambda ref: ref.get("card_id") == "202")
        self.assertEqual(self.h.player["reputation"], 9)
        self.choose_effect(lambda ref: ref.get("operation") == "choice")
        self.h.choose("cards")
        self.h.finish_choices()
        self.assertEqual(self.h.player["reputation"], 11)

    def test_third_university_conservation_can_unlock_cards_before_reputation(self):
        h = self.h
        h.player["universities"] = ["university_science", "university_hand_limit"]
        h.player["reputation"] = 9
        h.player["reputation_milestones_resolved"] = [5, 8]
        h.player["action_cards"]["build"]["upgraded"] = True
        rules._recompute_tags(h.player)
        h.act({"type": "association", "choose_effect_order": True, "tasks": [
            {"task": "university", "university_id": "university_reputation"},
        ]})
        self.choose_effect(lambda ref: ref.get("source") == "third_university")
        self.assertEqual(h.state["pending_choice"]["type"], "conservation_2")
        h.choose({"kind": "upgrade", "action": "cards"})
        h.finish_choices()
        self.assertEqual(h.player["reputation"], 11)
        self.assertEqual(h.player["conservation"], 3)

    def test_university_upgrade_choices_refresh_after_reputation_upgrade(self):
        h = self.h
        h.player["universities"] = ["university_hand_limit"]
        h.player["reputation"] = 4
        rules._recompute_tags(h.player)
        h.act({"type": "association", "choose_effect_order": True, "tasks": [
            {"task": "university", "university_id": "university_reputation"},
        ]})
        self.choose_effect(lambda ref: ref.get("rewards", {}).get("reputation"))
        h.choose("cards")
        self.assertEqual(h.state["pending_choice"]["type"], "upgrade_action")
        options = [option["value"] for option in h.state["pending_choice"]["options"]]
        self.assertNotIn("cards", options)
        self.assertIn("build", options)
        h.choose("build")
        self.assertEqual(h.player["reputation"], 6)
        self.assertEqual(h.state["current_player"], "p2")

    def test_partner_icon_effect_can_precede_each_map_space_reward(self):
        for existing_count in (1, 2, 3):
            with self.subTest(partner_number=existing_count + 1):
                self.setUp()
                h = self.h
                h.player["partner_zoos"] = ["africa", "europe", "americas"][:existing_count]
                h.player["action_cards"]["association"]["upgraded"] = True
                h.player["played_sponsors"] = ["213"]
                rules._recompute_tags(h.player)
                h.act({"type": "association", "choose_effect_order": True, "tasks": [
                    {"task": "partner_zoo", "continent": "asia"},
                ]})
                self.choose_effect(lambda ref: ref.get("card_id") == "213")
                h.choose({"cells": ["D7"]})
                self.assertEqual(h.state["pending_choice"]["type"], "take_card")
                self.assertEqual(h.player["conservation"], 0)
                self.assertEqual(h.player["association_workers_total"], 1)
                self.assertFalse(h.player["action_cards"]["cards"]["upgraded"])
                before_hand = len(h.player["hand"])
                h.choose("deck")
                self.assertEqual(len(h.player["hand"]), before_hand + 1)
                h.finish_choices()
                if existing_count == 1:
                    self.assertTrue(h.player["action_cards"]["cards"]["upgraded"])
                elif existing_count == 2:
                    self.assertEqual(h.player["association_workers_total"], 2)
                    self.assertEqual(h.player["available_workers"], 1)
                else:
                    self.assertEqual(h.player["conservation"], 3)
                self.assertEqual(h.state["current_player"], "p2")

    def start_borrowed_association(self, *, own_upgraded, borrowed_upgraded):
        h = self.h
        h.helper.set_slot(h.state, "p2", "association", 3)
        h.player["action_cards"]["association"]["upgraded"] = own_upgraded
        h.state["players"]["p2"]["action_cards"]["association"]["upgraded"] = borrowed_upgraded
        h.start_hypnosis_before_appeal()
        h.player["partner_zoos"].append("asia")
        rules._recompute_tags(h.player)
        h.choose("association")

    def test_hypnosis_association_two_can_take_third_partner_with_own_side_one(self):
        self.start_borrowed_association(own_upgraded=False, borrowed_upgraded=True)
        h = self.h
        self.assertFalse(h.player["action_cards"]["association"]["upgraded"])
        self.assertTrue(rules._has_association_task(h.state, "p1", 3))
        h.act({"type": "association", "tasks": [{"task": "partner_zoo", "continent": "africa"}]})
        self.assertEqual(len(h.player["partner_zoos"]), 3)
        self.assertEqual(h.player["association_workers_total"], 2)
        self.assertEqual(h.player["available_workers"], 1)
        self.assertFalse(h.player["action_cards"]["association"]["upgraded"])
        self.assertEqual(h.state["players"]["p2"]["action_cards"]["association"]["slot"], 1)
        self.assertNotIn("_action_level_overrides", h.player)
        self.assertEqual(h.state["current_player"], "p2")

    def test_hypnosis_association_one_cannot_take_third_partner_with_own_side_two(self):
        self.start_borrowed_association(own_upgraded=True, borrowed_upgraded=False)
        h = self.h
        before = copy.deepcopy(h.state)
        _, error = rules.ArkNovaGame.apply_action(h.state, "p1", {
            "type": "association", "tasks": [{"task": "partner_zoo", "continent": "africa"}],
        })
        self.assertIn("Association II", error)
        self.assertEqual(h.state, before)

    def test_hypnosis_donation_partner_reward_uses_borrowed_association_level(self):
        self.start_borrowed_association(own_upgraded=False, borrowed_upgraded=True)
        h = self.h
        h.player.update(conservation=4, milestones_resolved=[2])
        h.state["bonus_tokens"]["5"] = ["partner_zoo"]
        h.act({"type": "association", "tasks": [{"task": "reputation"}], "donate": 2})
        self.assertEqual(h.state["pending_choice"]["type"], "conservation_bonus")
        h.choose({"kind": "token", "token_id": "partner_zoo"})
        h.choose("africa")
        self.assertEqual(len(h.player["partner_zoos"]), 3)
        self.assertFalse(h.player["action_cards"]["association"]["upgraded"])
        self.assertNotIn("_action_level_overrides", h.player)
        self.assertEqual(h.state["current_player"], "p2")


if __name__ == "__main__":
    unittest.main()
