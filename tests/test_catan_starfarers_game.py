import copy
import unittest

from game.catan_starfarers import (
    CatanStarfarersGame,
    RESOURCE_TOTAL,
    UPGRADE_TOTALS,
    _assert_state,
    _initial_state,
    compute_vp,
)
from game.catan_starfarers_data import ENCOUNTERS, FRIENDSHIP_CARDS, MAP_GRAPH, RESOURCE_TYPES


def make_players(count=3, bots=()):
    return [
        {
            "player_id": f"p{index}",
            "name": f"Player {index}",
            "seat": index,
            "is_bot": index in bots,
        }
        for index in range(count)
    ]


def move_supply_to_hand(state, player_id, resource, count):
    state["resource_supply"][resource] -= count
    state["players"][player_id]["hand"][resource] += count


class CatanStarfarersGameTests(unittest.TestCase):
    def make_state(self, mode="beginner", count=3, language="en"):
        return _initial_state(
            {"setup_mode": mode, "language": language},
            make_players(count),
            rng_seed="starfarers-test-seed",
        )

    def assert_conserved(self, state):
        _assert_state(state)
        for resource in RESOURCE_TYPES:
            total = state["resource_supply"][resource]
            total += sum(card == resource for card in state["reserve_deck"])
            total += sum(player["hand"][resource] for player in state["players"].values())
            self.assertEqual(total, RESOURCE_TOTAL)
        for upgrade, expected in UPGRADE_TOTALS.items():
            total = state["upgrade_supply"][upgrade]
            total += sum(player["upgrades"][upgrade] for player in state["players"].values())
            self.assertEqual(total, expected)

    def test_initial_state_has_four_vp_and_conserves_components(self):
        state = self.make_state()

        self.assertEqual(state["phase"], "production")
        self.assertEqual(len(state["board"]["sectors"]), 15)
        self.assertEqual(len(state["encounter_draw"]), len(ENCOUNTERS))
        self.assertTrue(all(compute_vp(state, player_id) == 4 for player_id in state["turn_order"]))
        self.assert_conserved(state)

    def test_wild_space_hides_contents_and_keeps_removed_sector_private(self):
        state = self.make_state("wild_space")
        view = CatanStarfarersGame.get_public_view(state, "p0")

        self.assertTrue(any(sector["kind"] == "hidden" for sector in view["board"]["sectors"]))
        self.assertNotIn("rng_seed", view)
        self.assertNotIn("removed_sector", view["board"])
        self.assertFalse(any("resource" in player for player in view["players"] if player["player_id"] != "p0"))

    def test_chinese_view_localizes_game_copy_without_changing_ids(self):
        state = self.make_state(language="zh")
        view = CatanStarfarersGame.get_public_view(state, "p0")

        self.assertEqual(view["language"], "zh")
        self.assertEqual(view["setup_mode"], "beginner")
        self.assertIn("红矮星", {sector.get("name") for sector in view["board"]["sectors"]})
        self.assertEqual(
            view["friendship_available"]["diplomats"][0]["name"],
            "开放货舱",
        )
        self.assertIn("新手星域已就绪", view["activity"][0]["message"])

        state["encounter_draw"].remove("encounter-01")
        state["current_encounter"] = {
            "id": "encounter-01",
            "reader_id": "p1",
            "prompt_read": False,
            "selected_option_id": None,
            "result_revealed": False,
        }
        state["phase"] = "encounter_reader"
        encounter = CatanStarfarersGame.get_public_view(state, "p1")["encounter"]
        self.assertEqual(encounter["title"], "漂流中继器")
        self.assertIn("寂静的中继器", encounter["prompt"])
        self.assertEqual(encounter["options"][0]["label"], "花费1燃料进行维修")

    def test_invalid_language_is_rejected(self):
        with self.assertRaisesRegex(ValueError, "language"):
            self.make_state(language="fr")

    def test_normal_production_reaches_trade_build_and_preserves_cards(self):
        state = self.make_state()
        active = state["active_player_id"]

        events, error = CatanStarfarersGame.apply_action(state, active, {"type": "roll_production"})

        self.assertIsNone(error)
        self.assertTrue(events)
        self.assertIn(state["phase"], {"trade_build", "seven_discard", "seven_steal"})
        self.assert_conserved(state)

    def test_secret_tribute_discards_exactly_half(self):
        state = self.make_state()
        for _ in range(6):
            move_supply_to_hand(state, "p1", "ore", 1)
        hand_count = sum(state["players"]["p1"]["hand"].values())
        needed = hand_count // 2
        state["phase"] = "seven_discard"
        state["production"]["dice"] = [3, 4]
        state["production"]["pending_discards"] = {"p1": needed}
        bundle = {resource: 0 for resource in RESOURCE_TYPES}
        remaining = needed
        for resource in RESOURCE_TYPES:
            amount = min(remaining, state["players"]["p1"]["hand"][resource])
            bundle[resource] = amount
            remaining -= amount

        _, error = CatanStarfarersGame.apply_action(
            state, "p1", {"type": "discard_resources", "resources": bundle}
        )

        self.assertIsNone(error)
        self.assertEqual(sum(state["players"]["p1"]["hand"].values()), hand_count - needed)
        self.assertEqual(state["phase"], "seven_steal")
        self.assert_conserved(state)

    def test_player_trade_is_atomic(self):
        state = self.make_state()
        state["phase"] = "trade_build"
        move_supply_to_hand(state, "p0", "ore", 1)
        move_supply_to_hand(state, "p1", "food", 1)
        before_p0 = copy.deepcopy(state["players"]["p0"]["hand"])
        before_p1 = copy.deepcopy(state["players"]["p1"]["hand"])
        give = {"ore": 1}
        want = {"food": 1}

        self.assertIsNone(CatanStarfarersGame.apply_action(
            state, "p0", {"type": "open_trade_offer", "give": give, "want": want}
        )[1])
        self.assertIsNone(CatanStarfarersGame.apply_action(
            state, "p1", {"type": "submit_trade_response", "response": "accept"}
        )[1])
        self.assertIsNone(CatanStarfarersGame.apply_action(
            state, "p0", {"type": "accept_trade_response", "response_player_id": "p1"}
        )[1])

        self.assertEqual(state["players"]["p0"]["hand"]["ore"], before_p0["ore"] - 1)
        self.assertEqual(state["players"]["p0"]["hand"]["food"], before_p0["food"] + 1)
        self.assertEqual(state["players"]["p1"]["hand"]["food"], before_p1["food"] - 1)
        self.assertEqual(state["players"]["p1"]["hand"]["ore"], before_p1["ore"] + 1)
        self.assertIsNone(state["trade"]["offer"])
        self.assert_conserved(state)

    def test_invalid_build_does_not_mutate_state(self):
        state = self.make_state()
        state["phase"] = "trade_build"
        before = copy.deepcopy(state)

        _, error = CatanStarfarersGame.apply_action(
            state,
            "p0",
            {"type": "build_ship", "ship_type": "trade", "spaceport_id": "missing"},
        )

        self.assertIsNotNone(error)
        self.assertEqual(state, before)

    def test_encounter_reader_flow_hides_result_until_reveal(self):
        state = self.make_state()
        active = state["active_player_id"]
        encounter_id = "encounter-02"
        state["encounter_draw"].remove(encounter_id)
        state["current_encounter"] = {
            "id": encounter_id,
            "reader_id": "p1",
            "prompt_read": False,
            "selected_option_id": None,
            "result_revealed": False,
        }
        state["flight"] = {
            "balls": ["black", "yellow"],
            "base_speed": 3,
            "speed": 4,
            "movement_remaining": {ship["id"]: 4 for ship in state["board"]["ships"].values() if ship["player_id"] == active},
            "finished_ship_ids": [],
            "revealed_sector_ids": [],
            "cleared_sector_ids": [],
        }
        state["phase"] = "encounter_reader"

        actor_before = CatanStarfarersGame.get_public_view(state, active)["encounter"]
        self.assertIsNone(actor_before["prompt"])
        self.assertIsNone(CatanStarfarersGame.apply_action(state, "p1", {"type": "read_encounter_prompt"})[1])
        actor_after = CatanStarfarersGame.get_public_view(state, active)["encounter"]
        reader_after = CatanStarfarersGame.get_public_view(state, "p1")["encounter"]
        self.assertTrue(actor_after["prompt"])
        self.assertNotIn("effects", actor_after["options"][0])
        self.assertIn("effects", reader_after["options"][0])

        self.assertIsNone(CatanStarfarersGame.apply_action(
            state, active, {"type": "choose_encounter", "choice": "ride"}
        )[1])
        self.assertEqual(state["phase"], "encounter_reveal")
        self.assertIsNone(CatanStarfarersGame.apply_action(
            state, "p1", {"type": "reveal_encounter_result"}
        )[1])
        self.assertEqual(state["phase"], "flight")
        self.assertIn(encounter_id, state["encounter_discard"])
        self.assert_conserved(state)

    def test_colony_ship_can_settle_and_review_waits_for_everyone(self):
        state = self.make_state()
        ship = next(ship for ship in state["board"]["ships"].values() if ship["player_id"] == "p0")
        ship["node_id"] = "n01"
        state["phase"] = "flight"
        state["flight"] = {
            "balls": ["yellow", "blue"],
            "base_speed": 3,
            "speed": 4,
            "movement_remaining": {ship["id"]: 0},
            "finished_ship_ids": [],
            "revealed_sector_ids": [],
            "cleared_sector_ids": [],
        }
        vp_before = compute_vp(state, "p0")

        _, error = CatanStarfarersGame.apply_action(
            state, "p0", {"type": "establish_colony", "ship_id": ship["id"]}
        )

        self.assertIsNone(error)
        self.assertEqual(compute_vp(state, "p0"), vp_before + 1)
        self.assertEqual(state["phase"], "turn_review")
        self.assertEqual(state["active_player_id"], "p0")
        for player_id in ("p0", "p1"):
            self.assertIsNone(CatanStarfarersGame.apply_action(state, player_id, {"type": "next_turn"})[1])
            self.assertEqual(state["active_player_id"], "p0")
        self.assertIsNone(CatanStarfarersGame.apply_action(state, "p2", {"type": "next_turn"})[1])
        self.assertEqual(state["active_player_id"], "p1")
        self.assertEqual(state["phase"], "production")
        self.assert_conserved(state)

    def test_serialization_round_trip_and_tamper_rejection(self):
        state = self.make_state("explorer")
        restored = CatanStarfarersGame.deserialize(CatanStarfarersGame.serialize(state))
        self.assertEqual(restored, state)

        tampered = copy.deepcopy(state)
        tampered["resource_supply"]["ore"] += 1
        with self.assertRaises(ValueError):
            CatanStarfarersGame.deserialize(tampered)

    def test_all_data_cards_are_conserved_in_initial_state(self):
        state = self.make_state()
        friendship = [card_id for cards in state["friendship_available"].values() for card_id in cards]
        sector_ids = [sector["id"] for sector in state["board"]["sectors"].values()]
        sector_ids.append(state["board"]["removed_sector"]["id"])

        self.assertEqual(set(friendship), {card["id"] for card in FRIENDSHIP_CARDS})
        self.assertEqual(set(sector_ids), {sector["id"] for sector in MAP_GRAPH["sectors"]})


if __name__ == "__main__":
    unittest.main()
