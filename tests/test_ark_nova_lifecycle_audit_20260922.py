from __future__ import annotations

import unittest

from game import ark_nova as rules
from tests import test_ark_nova_game as fixtures


class ArkNovaLifecycleAuditRegressions(unittest.TestCase):
    def make_break_state(self, owner_id: str, bonus_token: str):
        helper = fixtures.ArkNovaGameTests()
        state = helper.make_state()
        for player in state["players"].values():
            player["hand"] = []
        owner = state["players"][owner_id]
        owner.update(conservation=4, milestones_resolved=[2], played_sponsors=["206"])
        state["bonus_tokens"]["5"] = [bonus_token]
        state["break_position"] = state["break_limit"] - 1
        return helper, state

    def act(self, state, player_id, action):
        events, error = rules.ArkNovaGame.apply_action(state, player_id, action)
        self.assertIsNone(error, action)
        return events

    def choose(self, state, selection):
        pending = state["pending_choice"]
        self.assertIsNotNone(pending)
        return self.act(state, pending["player_id"], {
            "type": "resolve_choice", "choice_id": pending["choice_id"],
            "selection": selection,
        })

    def claim_break_bonus(self, state, bonus_token):
        self.act(state, "p1", {"type": "sponsors", "mode": "break"})
        self.assertEqual(state["pending_choice"]["type"], "conservation_bonus")
        self.choose(state, {"kind": "token", "token_id": bonus_token})

    def finish_break_clever(self, state, owner_id):
        pending = state["pending_choice"]
        self.assertIsNotNone(pending)
        self.assertEqual(pending["type"], "move_action_card")
        self.assertEqual(pending["player_id"], owner_id)
        self.assertTrue(state["resolving_break"])
        self.assertEqual(state["current_player"], "p1")
        self.choose(state, "cards:1")
        self.assertEqual(state["players"][owner_id]["action_cards"]["cards"]["slot"], 1)
        self.assertIsNone(state["pending_choice"])
        self.assertFalse(state.get("after_action_core_effects"))
        self.assertNotIn("resolving_break", state)
        self.assertEqual(state["current_player"], "p2")

        # The next ordinary turn must not inherit another zoo's income effect.
        self.act(state, "p2", {"type": "sponsors", "mode": "break"})
        self.assertIsNone(state["pending_choice"])
        self.assertEqual(state["current_player"], "p1")
        self.assertFalse(state.get("after_action_core_effects"))

    def test_africa_partner_from_break_bonus_resolves_clever_before_next_turn(self):
        for owner_id in ("p1", "p2"):
            with self.subTest(owner_id=owner_id):
                _, state = self.make_break_state(owner_id, "partner_zoo")
                state["players"][owner_id]["played_sponsors"].append("214")
                rules._recompute_tags(state["players"][owner_id])
                self.claim_break_bonus(state, "partner_zoo")
                self.assertEqual(state["pending_choice"]["type"], "bonus_association")
                self.choose(state, "africa")
                self.assertIn("africa", state["players"][owner_id]["partner_zoos"])
                self.finish_break_clever(state, owner_id)

    def test_africa_expert_played_during_break_resolves_own_clever_before_next_turn(self):
        for owner_id in ("p1", "p2"):
            with self.subTest(owner_id=owner_id):
                helper, state = self.make_break_state(owner_id, "sponsor")
                helper.add_hand_card(state, owner_id, "214")
                rules._recompute_tags(state["players"][owner_id])
                self.claim_break_bonus(state, "sponsor")
                self.assertEqual(state["pending_choice"]["type"], "play_sponsor_for_money")
                self.choose(state, "214")
                self.assertIn("214", state["players"][owner_id]["played_sponsors"])
                self.finish_break_clever(state, owner_id)


if __name__ == "__main__":
    unittest.main()
