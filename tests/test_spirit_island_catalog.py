"""Exercise every base-game card and the choices its resolution can expose."""

from copy import deepcopy
import json
import unittest

from game.spirit_island import (
    ELEMENTS,
    SpiritIslandGame as Game,
    _add_piece,
    _defense,
    _enter_phase,
    _power_targets,
    _run,
)
from game.spirit_island_data import FEAR_CARDS, POWERS


class SpiritIslandCatalogTests(unittest.TestCase):
    def new_game(self, count=1):
        state = Game.init_game({"seed": 105}, [
            {"player_id": f"p{i}", "name": f"Guardian {i}", "seat": i}
            for i in range(count)
        ])
        for i, spirit in enumerate(("river", "earth", "lightning", "shadows")[:count]):
            _, error = Game.apply_action(state, f"p{i}", {
                "type": "choose_spirit", "spirit_id": spirit,
            })
            self.assertIsNone(error)
        state["phase"] = "fast"
        return state

    def settle(self, state, branch_index=0):
        """Resolve only queued effects, using choices published for their owner."""
        for _ in range(1000):
            _run(state)
            if state["game_over"] or not state["pending"]:
                self.assertFalse(state["effects"], "effects stranded without a choice")
                # Every intermediate result must remain suitable for a room save.
                json.dumps(Game.serialize(state))
                return
            pending = state["pending"]
            pid = pending["player_id"]
            options = Game.get_public_view(state, pid)["action_options"]
            self.assertTrue(options, f"no action for pending choice: {pending['kind']}")
            choice = options[0]
            if pending["kind"] == "branch":
                choice = options[min(branch_index, len(options) - 1)]
            elif pending["kind"] in ("gain_type", "extra_draft_type"):
                # Alternate Minor and Major draft branches, including forgetting.
                choice = options[min(branch_index, len(options) - 1)]
            _, error = Game.apply_action(state, pid, choice["action"])
            self.assertIsNone(error, (choice, error))
        self.fail("card resolution exceeded 1,000 choices")

    def populated_island(self, count=1):
        state = self.new_game(count)
        for lid, land in state["lands"].items():
            land["pieces"] = []
            land["presence"] = {f"p{i}": 2 for i in range(count)}
            land["blight"] = 1
            for kind, amount in (("dahan", 3), ("explorer", 2), ("town", 2), ("city", 2)):
                _add_piece(state, lid, kind, amount)
        return state

    def empty_island(self):
        state = self.new_game()
        for land in state["lands"].values():
            land["pieces"] = []
            land["presence"] = {}
            land["blight"] = 0
        state["lands"]["A1"]["presence"] = {"p0": 2}
        _add_piece(state, "A8", "city")  # Prevent an unrelated victory.
        return state

    def test_every_power_resolves_with_and_without_thresholds_and_both_branches(self):
        for card_id, card in POWERS.items():
            for threshold in (False, True):
                for branch_index in (0, 1):
                    with self.subTest(card=card_id, threshold=threshold, branch=branch_index):
                        state = self.populated_island()
                        player = state["players"]["p0"]
                        player.update(
                            energy=99, destroyed_presence=2,
                            hand=[cid for cid in ("boon_of_vigor", "flash_floods") if cid != card_id],
                            played=[card_id], used=[card_id],
                            discard=[] if card_id == "wash_away" else ["wash_away"],
                            extra_elements={element: 10 for element in ELEMENTS} if threshold else {},
                        )
                        # A card already in a player's possession cannot also be
                        # drawn from the common supply during its own effect.
                        owned = set(player["hand"] + player["played"] + player["discard"])
                        for power_type in ("minor", "major"):
                            state[power_type + "_deck"] = [
                                cid for cid in state[power_type + "_deck"] if cid not in owned
                            ]
                        restriction = card.get("target_filter", {})
                        if restriction.get("no_blight"):
                            state["lands"]["A2"]["blight"] = 0
                        if restriction.get("no_invaders"):
                            state["lands"]["A2"]["pieces"] = [
                                piece for piece in state["lands"]["A2"]["pieces"]
                                if piece["type"] == "dahan"
                            ]
                        targets = _power_targets(state, "p0", card)
                        self.assertTrue(targets, "fixture must provide a legal power target")
                        value = targets[0]["value"]
                        target = value["land_id"] if isinstance(value, dict) else value
                        state["effects"] = [{
                            "kind": "power", "player_id": "p0", "card_id": card_id,
                            "target": target,
                        }]
                        self.settle(state, branch_index)

    def test_every_fear_card_resolves_at_each_terror_level_solo_and_four_players(self):
        for card_id in FEAR_CARDS:
            for terror_level in (1, 2, 3):
                for count in (1, 4):
                    with self.subTest(card=card_id, terror_level=terror_level, players=count):
                        state = self.populated_island(count)
                        state.update(phase="fear", terror_level=terror_level)
                        state["effects"] = [{"kind": "fear_card", "card_id": card_id}]
                        self.settle(state)

    def test_fear_card_earned_during_fear_resolves_before_invaders(self):
        state = self.empty_island()
        _add_piece(state, "A2", "town")
        _add_piece(state, "A2", "dahan")
        town = next(piece for piece in state["lands"]["A2"]["pieces"]
                    if piece["type"] == "town")
        town["health"] = 1
        state["fear_generated"] = state["fear_pool"] - 1
        state["earned_fear"] = ["dahan_raid"]
        state["fear_deck"] = ["belief_takes_root"] + [
            card for card in FEAR_CARDS if card not in ("dahan_raid", "belief_takes_root")
        ][:7]
        state["invaders"].update(ravage=None, build=None, explore=None)
        _enter_phase(state, "fear")
        _run(state)
        self.assertEqual(state["pending"]["kind"], "fear_land")
        self.assertEqual([card["id"] for card in Game.get_public_view(state, "p0")["fear"]["revealed"]],
                         ["dahan_raid"])

        # The Raid destroys the wounded Town, completing the Fear pool. The
        # newly earned Belief card must grant its defense in this same turn.
        self.settle(state)
        self.assertEqual(state["phase"], "slow")
        self.assertEqual(state["revealed_fear"], ["dahan_raid", "belief_takes_root"])
        self.assertEqual(_defense(state, "A1"), 2)
        self.assertEqual(Game.get_public_view(state, "p0")["fear"]["earned"], 0)

    def test_ravage_waits_for_land_order_before_changing_the_island(self):
        state = self.empty_island()
        for lid in ("A2", "A5"):
            _add_piece(state, lid, "town")
            _add_piece(state, lid, "dahan", 2)
        state["invaders"]["ravage"] = {
            "stage": 1, "terrains": ["wetland"], "name": "湿地",
        }
        before = deepcopy(state["lands"])
        blight_before = state["blight_remaining"]
        _enter_phase(state, "ravage")
        _run(state)
        self.assertEqual(state["pending"]["kind"], "ravage_order")
        self.assertEqual(state["lands"], before)
        self.assertEqual(state["blight_remaining"], blight_before)
        options = Game.get_public_view(state, "p0")["action_options"]
        self.assertEqual({option["land_id"] for option in options}, {"A2", "A5"})

        # Choosing A5 must start there, even though A2 was listed first.
        choice = next(option for option in options if option["land_id"] == "A5")
        _, error = Game.apply_action(state, "p0", choice["action"])
        self.assertIsNone(error)
        self.assertEqual(state["lands"]["A5"]["blight"], 1)
        self.assertEqual(state["lands"]["A2"], before["A2"])
        self.assertEqual(state["pending"]["kind"], "piece")


if __name__ == "__main__":
    unittest.main()
