from __future__ import annotations

import json
import unittest
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[1]
DATA_DIR = REPO_ROOT / "game" / "assets" / "ark_nova"


class ArkNovaCardDataTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.document = json.loads((DATA_DIR / "cards.json").read_text(encoding="utf-8"))
        cls.animals = cls.document["animal_cards"]
        cls.sponsors = cls.document["sponsor_cards"]
        cls.projects = cls.document["conservation_projects"]
        cls.final_cards = cls.document["final_scoring_cards"]
        cls.unique_buildings = json.loads(
            (DATA_DIR / "unique_buildings.json").read_text(encoding="utf-8")
        )
        cls.animal_by_id = {card["id"]: card for card in cls.animals}
        cls.sponsor_by_id = {card["id"]: card for card in cls.sponsors}
        cls.project_by_id = {card["id"]: card for card in cls.projects}
        cls.final_by_id = {card["id"]: card for card in cls.final_cards}

    def test_base_card_counts_and_continuous_ids(self) -> None:
        self.assertEqual([card["id"] for card in self.animals], [str(value) for value in range(401, 529)])
        self.assertEqual([card["id"] for card in self.sponsors], [str(value) for value in range(201, 265)])
        self.assertEqual([card["id"] for card in self.projects], [str(value) for value in range(101, 133)])
        self.assertEqual([card["id"] for card in self.final_cards], [f"{value:03d}" for value in range(1, 12)])
        self.assertEqual(self.document["summary"]["content_cards"], 235)

    def test_every_play_condition_is_typed(self) -> None:
        valid_kinds = {"tag_count", "partner_zoo", "action_upgrade", "track_threshold"}
        for card in self.animals + self.sponsors:
            for condition in card["play"]["conditions"]:
                self.assertIn(condition["kind"], valid_kinds, card["id"])
        raw_conditions = " ".join(
            card["raw"]["conditions_zh"] for card in self.animals + self.sponsors
        )
        self.assertNotIn("声望条件", raw_conditions)
        self.assertNotIn("吸引力条件", raw_conditions)

    def test_animal_abilities_reference_the_registry(self) -> None:
        registry = self.document["abilities"]
        used = set()
        for card in self.animals:
            for ability in card["abilities"]:
                used.add(ability["ability"])
                self.assertIn(ability["ability"], registry, card["id"])
                self.assertIn(ability["timing"], {"immediate", "after_action", "during_placement"})
                self.assertTrue(ability["cascade"])
        self.assertEqual(len(used), 44)
        self.assertEqual(set(registry) - used, {"perception_2"})

    def test_sponsor_effects_have_timing_kind_and_cascade(self) -> None:
        allowed_timings = {"immediate", "setup_and_passive", "passive", "income", "endgame"}
        for card in self.sponsors:
            if card["id"] not in {"205", "223"}:
                self.assertTrue(card["effects"], card["id"])
            for effect in card["effects"]:
                self.assertIn(effect["timing"], allowed_timings, card["id"])
                self.assertTrue(effect["kind"], card["id"])
                self.assertIn("cascade", effect, card["id"])

    def test_sponsor_track_limits_and_action_upgrades_are_exact(self) -> None:
        max_appeal_ids = {"207", "222", "258", "259", "260", "264"}
        for card_id in max_appeal_ids:
            self.assertIn(
                {"kind": "track_threshold", "track": "appeal", "operator": "<=", "value": 25},
                self.sponsor_by_id[card_id]["play"]["conditions"],
            )
        for card_id, value in {"227": 6, "228": 3, "243": 3, "244": 3, "245": 3, "263": 6}.items():
            self.assertIn(
                {"kind": "track_threshold", "track": "reputation", "operator": ">=", "value": value},
                self.sponsor_by_id[card_id]["play"]["conditions"],
            )
        for card_id in {"201", "207", "216", "219", "262", "263"}:
            self.assertEqual(self.sponsor_by_id[card_id]["play"]["minimum_action_level_from_card_condition"], 2)

    def test_known_card_data_corrections(self) -> None:
        anaconda = self.animal_by_id["482"]
        self.assertEqual(anaconda["placement"]["adjacent_to"], {"water": 1, "rock": 1})
        self.assertEqual(self.animal_by_id["463"]["play"]["base_money_cost"], 11)

        polar_bear = self.sponsor_by_id["251"]
        self.assertEqual(polar_bear["unique_building"]["placement"]["adjacent_to"]["water"], 1)
        self.assertIn("endgame", polar_bear["timing_summary"])
        self.assertEqual(self.sponsor_by_id["256"]["printed_rewards"]["appeal"], 4)
        self.assertEqual(
            self.sponsor_by_id["261"]["printed_rewards"],
            {"appeal": 1, "conservation": 1, "reputation": 0},
        )

    def test_all_unique_building_sponsors_have_placement_data(self) -> None:
        expected_cells = {
            "243": {(0, 0), (-1, 1), (1, 0)},
            "244": {(0, 0), (-1, 0), (1, -1), (1, 0)},
            "245": {(0, 0), (-1, 1), (1, 0), (1, 1)},
            "246": {(0, 0), (1, -1), (-1, 1), (-2, 2)},
            "247": {(0, 0), (-1, 0), (1, 0), (0, 1)},
            "248": {(0, 0), (-1, 0), (-2, 1), (1, 0)},
            "249": {(0, 0), (-1, 0), (1, 0)},
            "250": {(0, 0), (-1, 0), (1, -1), (0, 1)},
            "251": {(0, 0), (-1, 1), (1, 0), (2, -1)},
            "252": {(0, 0), (-1, 0), (1, -1), (2, -2)},
            "253": {(0, 0), (-2, 1), (-1, 1), (1, 0)},
            "254": {(0, 0), (-1, 0), (1, -1)},
            "255": {(0, 0), (1, 0)},
            "256": {(0, 0), (1, 0)},
            "257": {(0, 0), (1, 0)},
        }
        for value in range(243, 258):
            card = self.sponsor_by_id[str(value)]
            self.assertIn("unique_building", card)
            self.assertTrue(
                any(effect["kind"] == "build_or_placement" for effect in card["effects"]),
                card["id"],
            )
            footprint = card["unique_building"]["footprint"]
            cells = {(cell["q"], cell["r"]) for cell in footprint["cells"]}
            self.assertEqual(cells, expected_cells[card["id"]])
            self.assertEqual(footprint["cell_count"], len(cells))
            self.assertEqual(footprint["anchor_cell"], {"q": 0, "r": 0})
            self.assertEqual(footprint["allowed_rotation_steps"], list(range(6)))
            self.assertFalse(footprint["reflection_allowed"])

            pending = {(0, 0)}
            visited = set()
            while pending:
                q, r = pending.pop()
                if (q, r) in visited:
                    continue
                visited.add((q, r))
                for dq, dr in ((1, 0), (1, -1), (0, -1), (-1, 0), (-1, 1), (0, 1)):
                    neighbor = (q + dq, r + dr)
                    if neighbor in cells and neighbor not in visited:
                        pending.add(neighbor)
            self.assertEqual(visited, cells, card["id"])

        self.assertEqual(len(self.document["unique_buildings"]), 15)
        self.assertEqual(self.unique_buildings, self.document["unique_buildings"])
        self.assertEqual(self.document["summary"]["unique_building_footprints"], 15)

    def test_release_and_breeding_projects_have_no_placeholders(self) -> None:
        for value in range(113, 123):
            card = self.project_by_id[str(value)]
            self.assertEqual(card["project_type"], "release")
            self.assertEqual(
                [slot["requirement"]["value"] for slot in card["support_slots"]],
                [5, 4, 3],
            )
            self.assertEqual(card["new_project_bonus"], {"reputation": 1})
            self.assertTrue(card["play"]["must_support_immediately_when_played"])
        for value in range(123, 128):
            card = self.project_by_id[str(value)]
            self.assertEqual(card["project_type"], "breeding")
            self.assertTrue(card["breeding_rules"]["same_eligibility_for_all_slots"])
            self.assertEqual(
                [slot["reward"] for slot in card["support_slots"]],
                [
                    {"conservation": 2, "reputation": 2},
                    {"conservation": 1, "reputation": 2},
                    {"conservation": 2},
                ],
            )
        encoded = json.dumps(self.projects, ensure_ascii=False)
        self.assertNotIn("?", encoded)
        self.assertEqual(self.project_by_id["131"]["metric"], "large_animal")
        self.assertEqual(self.project_by_id["132"]["metric"], "science")

    def test_action_card_faces_are_complete(self) -> None:
        actions = {card["id"]: card for card in self.document["action_cards"]}
        self.assertEqual(set(actions), {"cards", "build", "animals", "association", "sponsors"})
        self.assertEqual(actions["animals"]["sides"]["I"]["maximum_cards_by_strength"]["1"], 0)
        self.assertEqual(actions["animals"]["sides"]["II"]["maximum_cards_by_strength"]["5"], 2)
        self.assertEqual(actions["animals"]["sides"]["II"]["strength_5_bonus"], {"reputation": 1})
        self.assertEqual(actions["sponsors"]["sides"]["II"]["alternative"], "advance_break_by_X_and_gain_2X_money")

    def test_final_scoring_uses_current_thresholds(self) -> None:
        self.assertEqual(
            [step["requirement"] for step in self.final_by_id["001"]["scoring_steps"]],
            [1, 2, 3, 4],
        )
        self.assertEqual(
            [step["requirement"] for step in self.final_by_id["011"]["scoring_steps"]],
            [2, 4, 6, 7],
        )
        self.assertIn("右手边玩家", self.final_by_id["009"]["description_zh"])

    def test_final_scoring_rules_are_typed(self) -> None:
        self.assertEqual(
            {card["scoring_rule"]["kind"] for card in self.final_cards},
            {"metric_ladder", "independent_conditions", "compare_right_hand_neighbor"},
        )
        self.assertEqual(self.final_by_id["001"]["scoring_rule"]["metric"], "large_animal_count")
        architectural = self.final_by_id["004"]["scoring_rule"]
        self.assertEqual(len(architectural["conditions"]), 4)
        self.assertEqual(architectural["building_spaces_exclude"], ["water", "rock"])
        self.assertTrue(self.final_by_id["006"]["scoring_rule"]["include_build_ii_restricted_spaces"])
        diverse = self.final_by_id["009"]["scoring_rule"]
        self.assertEqual(diverse["comparison"], "strictly_greater")
        self.assertFalse(diverse["ties_score"])
        self.assertEqual(len(diverse["metrics"]), 5)


if __name__ == "__main__":
    unittest.main()
