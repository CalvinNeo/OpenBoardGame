import copy
import json
import unittest
from unittest.mock import patch

from game import mall_of_horror as rules
from game.mall_of_horror import MallOfHorrorGame as Game
from game.mall_of_horror_ai import choose_action


def make_state(n=3, seed=140):
    return Game.init_game({"seed": seed}, [
        {"player_id": f"p{i}", "name": f"Survivor {i}", "seat": i} for i in range(n)
    ])


def action(state, kind, **fields):
    return {"type": kind, "game_token": state["game_token"], "step": state["step"], **fields}


def act(state, pid, kind, **fields):
    events, error = Game.apply_action(state, pid, action(state, kind, **fields))
    if error:
        raise AssertionError((state["phase"], pid, kind, fields, error))
    return events


def arrange(state, placements):
    """Place only the listed survivors; convenient deterministic attack fixtures."""
    for char in state["characters"]:
        char.update(alive=char["id"] in placements, location=placements.get(char["id"]), hidden=False)
    state.update(round=2, phase="move", current_turn="p0", revealed=True)
    for loc in state["locations"]:
        loc["zombies"] = 0


def grant(state, pid, kind):
    sources = [state["deck"], state["discard"]] + [p["hand"] for p in state["players"].values()]
    for source in sources:
        card = next((c for c in source if c["kind"] == kind), None)
        if card:
            source.remove(card)
            state["players"][pid]["hand"].append(card)
            return card["id"]
    raise AssertionError("card unavailable")


def pass_window(state):
    while state["phase"] == "cards":
        act(state, state["current_turn"], "pass")


def to_phase(state, wanted, limit=1500):
    for _ in range(limit):
        if state["phase"] == wanted:
            return state
        for pid in state["turn_order"]:
            move = choose_action(Game.get_public_view(state, pid))
            if move:
                _, error = Game.apply_action(state, pid, move)
                if error:
                    raise AssertionError((move, error))
                break
        else:
            raise AssertionError(("stalled", state["phase"], wanted))
    raise AssertionError("phase not reached")


class MallOfHorrorTests(unittest.TestCase):
    def assertRejected(self, state, pid, payload):
        before = copy.deepcopy(state)
        events, error = Game.apply_action(state, pid, payload)
        self.assertTrue(error)
        self.assertEqual(events, [])
        self.assertEqual(state, before)

    def test_setup_player_counts_and_card_catalog(self):
        for n in (3, 4, 5, 6):
            s = make_state(n)
            self.assertEqual(len(s["characters"]), 12 if n == 3 else n * 3)
            self.assertEqual(s["locations"][1]["closed"], n <= 4)
            self.assertEqual([l["capacity"] for l in s["locations"]], [3, 4, 4, None, 3, 6])
            self.assertEqual(len(s["deck"]), 21 - n)
            self.assertEqual(len({c["id"] for c in rules.build_deck()}), 21)
        for n in (0, 2, 7):
            with self.assertRaises(ValueError):
                make_state(n)
        with self.assertRaises(ValueError):
            Game.init_game({"mode": "made_up"}, [{"player_id": str(i)} for i in range(3)])

    def test_placement_roll_fallback_capacity_and_ownership(self):
        s = make_state()
        s["setup_dice"] = [1, 2]
        self.assertEqual(rules._setup_options(s), [1])
        self.assertRejected(s, "p0", action(s, "place", character_id="s1_pinup", destination=1))
        self.assertRejected(s, "p0", action(s, "place", character_id="s0_pinup", destination=6))
        for c in s["characters"][4:7]:
            c["location"] = 1
        self.assertEqual(rules._setup_options(s), [3, 4, 5, 6])
        act(s, "p0", "place", character_id="s0_tough", destination=5)
        self.assertEqual(s["current_turn"], "p1")
        self.assertEqual(next(c for c in s["characters"] if c["id"] == "s0_tough")["location"], 5)

    def test_complete_setup_places_every_character(self):
        s = make_state(6)
        for _ in range(18):
            pid = s["current_turn"]
            move = choose_action(Game.get_public_view(s, pid))
            self.assertIsNone(Game.apply_action(s, pid, move)[1])
        self.assertNotEqual(s["phase"], "setup")
        self.assertEqual(s["round"], 1)
        self.assertTrue(all(c["location"] is not None for c in s["characters"]))
        self.assertEqual(sum(l["zombies"] for l in s["locations"]), 4)

    def test_full_and_closed_destinations_send_to_parking(self):
        for closed in (False, True):
            s = make_state(4)
            arrange(s, {"s0_pinup": 3, "s1_pinup": 1, "s1_tough": 1, "s1_gunman": 1, "s2_pinup": 6})
            s["destinations"] = {"p0": 1, "p1": 3, "p2": 5}
            s["queue"] = ["p0", "p1", "p2"]
            if closed:
                s["locations"][0]["closed"] = True
            act(s, "p0", "move", character_id="s0_pinup", destination=1, sprint_card_id=None)
            self.assertEqual(rules._characters(s, "p0")[0]["location"], 4)
            self.assertEqual(s["current_turn"], "p1")

    def test_sprint_stay_and_invalid_move_is_atomic(self):
        s = make_state()
        arrange(s, {"s0_pinup": 1, "s0_tough": 3, "s1_pinup": 5, "s2_pinup": 6})
        s["destinations"] = {"p0": 1, "p1": 3, "p2": 5}
        s["queue"] = ["p0", "p1", "p2"]
        self.assertRejected(s, "p0", action(s, "move", character_id="s0_pinup", destination=1, sprint_card_id=None))
        self.assertRejected(s, "p0", action(s, "move", character_id="s1_pinup", destination=1, sprint_card_id=None))
        cid = grant(s, "p0", "sprint")
        self.assertRejected(s, "p0", action(s, "move", character_id="s0_pinup", destination=2, sprint_card_id=cid))
        act(s, "p0", "move", character_id="s0_pinup", destination=1, sprint_card_id=cid)
        self.assertEqual(rules._characters(s, "p0")[0]["location"], 1)
        self.assertIn(cid, [c["id"] for c in s["discard"]])

    def test_only_elected_chief_and_camera_see_forecast(self):
        s = make_state()
        arrange(s, {"s0_pinup": 1, "s1_pinup": 3, "s2_pinup": 6})
        rules._start_camera(s)
        self.assertIsNone(Game.get_public_view(s, "p0")["forecast"])
        cid = grant(s, "p0", "camera")
        act(s, "p0", "play_card", card_id=cid, character_id=None)
        self.assertEqual(Game.get_public_view(s, "p0")["forecast"], s["forecast"])
        self.assertIsNone(Game.get_public_view(s, "p1")["forecast"])
        self.assertIsNone(Game.get_public_view(s, "visitor")["forecast"])
        s["elected"] = True
        rules._start_camera(s)
        self.assertEqual(Game.get_public_view(s, "p0")["forecast"], s["forecast"])

    def test_secret_destinations_and_chief_announcement(self):
        s = make_state()
        arrange(s, {"s0_pinup": 1, "s1_pinup": 3, "s2_pinup": 6})
        s.update(elected=True, revealed=False, forecast=[2, 2, 2, 2])
        rules._start_destinations(s)
        act(s, "p0", "choose_destination", destination=3)
        self.assertEqual(Game.get_public_view(s, "p2")["destinations"], {"p0": 3})
        first_step = s["step"]
        act(s, "p1", "choose_destination", destination=5)
        self.assertEqual(first_step, s["step"])
        self.assertEqual(Game.get_public_view(s, "p1")["destinations"]["p1"], 5)
        self.assertNotIn("p1", Game.get_public_view(s, "p2")["destinations"])
        self.assertRejected(s, "p1", action(s, "choose_destination", destination=4))
        act(s, "p2", "choose_destination", destination=4)
        self.assertTrue(s["revealed"])
        self.assertEqual(Game.get_public_view(s, "visitor")["destinations"], {"p0": 3, "p1": 5, "p2": 4})

    def test_no_impossible_destination_without_sprint(self):
        s = make_state()
        arrange(s, {"s0_pinup": 1, "s0_tough": 1, "s1_pinup": 5})
        s["discard"].extend(s["players"]["p0"]["hand"])
        s["players"]["p0"]["hand"] = []
        s["phase"] = "destinations"
        self.assertRejected(s, "p0", action(s, "choose_destination", destination=1))
        grant(s, "p0", "sprint")
        self.assertIn(1, rules._destination_options(s, "p0"))

    def test_vote_weights_secrets_runoff_and_threat(self):
        s = make_state(4)
        arrange(s, {"s0_pinup": 4, "s1_pinup": 4, "s2_pinup": 3})
        rules._start_vote(s, "truck", 4)
        threat = grant(s, "p2", "threat")
        act(s, "p0", "pass")
        act(s, "p1", "pass")
        act(s, "p2", "play_card", card_id=threat, character_id=None)
        act(s, "p2", "pass")
        self.assertEqual(s["vote"]["weights"], {"p0": 1, "p1": 1})
        act(s, "p0", "vote", target_id="p0")
        other = Game.get_public_view(s, "p1")["vote"]
        self.assertNotIn("ballots", other)
        self.assertIsNone(other["your_vote"])
        act(s, "p1", "vote", target_id="p1")
        self.assertTrue(s["vote"]["runoff"])
        self.assertEqual(s["vote"]["weights"], {"p0": 1, "p1": 1, "p2": 2, "p3": 1})
        self.assertEqual(Game.get_legal_actions(s, "p3"), ["vote"])
        self.assertRejected(s, "p2", action(s, "play_card", card_id=threat, character_id=None))
        for p in s["turn_order"]:
            act(s, p, "vote", target_id="p1")
        self.assertEqual(s["looter"], "p1")
        self.assertEqual(s["last_vote"]["winner"], "p1")

    def test_second_tie_skips_truck_and_retains_chief_without_vision(self):
        for kind, location in (("truck", 4), ("chief", 5)):
            s = make_state(4)
            arrange(s, {"s0_pinup": location, "s1_pinup": location, "s2_pinup": 3, "s3_pinup": 6})
            rules._start_vote(s, kind, location)
            pass_window(s)
            act(s, "p0", "vote", target_id="p0")
            act(s, "p1", "vote", target_id="p1")
            for p, target in (("p0", "p0"), ("p1", "p1"), ("p2", "p0"), ("p3", "p1")):
                act(s, p, "vote", target_id=target)
            self.assertEqual(s["phase"], "camera")
            self.assertFalse(s["elected"])
            self.assertIsNone(Game.get_public_view(s, "p0")["forecast"])
            self.assertIsNone(s["last_vote"]["winner"])

    def test_second_victim_tie_draws_player_color_not_character(self):
        s = make_state(4)
        arrange(s, {"s0_pinup": 1, "s0_tough": 1, "s1_gunman": 1, "s2_pinup": 3, "s3_pinup": 6})
        s["locations"][0]["zombies"] = 5
        s["attack_location"] = 1
        rules._start_vote(s, "victim", 1)
        pass_window(s)
        act(s, "p0", "vote", target_id="p0")
        act(s, "p1", "vote", target_id="p1")
        with patch.object(rules, "_rng") as rng:
            rng.return_value.choice.return_value = "p0"
            for p, target in (("p0", "p0"), ("p1", "p1"), ("p2", "p0"), ("p3", "p1")):
                act(s, p, "vote", target_id=target)
            rng.return_value.choice.assert_called_once_with(["p0", "p1"])
        self.assertEqual(s["phase"], "victim")
        self.assertTrue(s["last_vote"]["random"])

    def test_breach_thresholds(self):
        s = make_state()
        arrange(s, {"s0_tough": 1, "s1_tough": 6, "s2_tough": 6, "s0_pinup": 6, "s1_gunman": 4})
        s["locations"][0]["zombies"] = 1
        self.assertFalse(rules._breached(s, 1))
        s["locations"][0]["zombies"] = 2
        self.assertTrue(rules._breached(s, 1))
        s["locations"][5]["zombies"] = 3
        self.assertFalse(rules._breached(s, 6))
        s["locations"][5]["zombies"] = 4
        self.assertTrue(rules._breached(s, 6))
        s["locations"][3]["zombies"] = 1
        self.assertTrue(rules._breached(s, 4))

    def test_hardware_weapon_and_unsafe_hardware(self):
        for loc in (4, 6):
            s = make_state()
            arrange(s, {"s0_pinup": loc, "s1_pinup": 3, "s2_pinup": 5})
            s["locations"][loc - 1]["zombies"] = 4
            s["attack_location"] = loc
            rules._start_vote(s, "victim", loc)
            cid = grant(s, "p0", "hardware")
            self.assertRejected(s, "p0", action(s, "play_card", card_id=cid, character_id=None))
        s = make_state()
        arrange(s, {"s0_tough": 1, "s1_pinup": 3, "s2_pinup": 5})
        s["locations"][0]["zombies"] = 4
        s["attack_location"] = 1
        rules._start_vote(s, "victim", 1)
        weapon = grant(s, "p0", "weapon2")
        hardware = grant(s, "p0", "hardware")
        act(s, "p0", "play_card", card_id=weapon, character_id=None)
        self.assertEqual(s["locations"][0]["zombies"], 2)
        act(s, "p0", "play_card", card_id=hardware, character_id=None)
        act(s, "p0", "pass")
        self.assertTrue(rules._characters(s, "p0")[0]["alive"])
        self.assertEqual(s["locations"][0]["zombies"], 2)

    def test_hidden_gunman_loses_votes_but_keeps_strength(self):
        s = make_state()
        arrange(s, {"s0_gunman": 1, "s0_pinup": 1, "s1_pinup": 1, "s2_pinup": 6})
        s["locations"][0]["zombies"] = 4
        s["attack_location"] = 1
        rules._start_vote(s, "victim", 1)
        hide = grant(s, "p0", "hide")
        act(s, "p0", "play_card", card_id=hide, character_id="s0_gunman")
        pass_window(s)
        self.assertEqual(s["vote"]["weights"], {"p0": 1, "p1": 1})
        self.assertEqual(Game.get_public_view(s, "p0")["locations"][0]["strength"], 3)

    def test_hidden_only_character_cannot_be_eaten(self):
        s = make_state()
        arrange(s, {"s0_pinup": 1, "s1_pinup": 3, "s2_pinup": 6})
        s["locations"][0]["zombies"] = 3
        s["attack_location"] = 1
        rules._start_vote(s, "victim", 1)
        hide = grant(s, "p0", "hide")
        act(s, "p0", "play_card", card_id=hide, character_id="s0_pinup")
        pass_window(s)
        self.assertEqual(len(rules._characters(s, "p0")), 1)
        self.assertEqual(s["locations"][0]["zombies"], 3)

    def test_parking_multiple_victims_and_hidden_persistence(self):
        s = make_state()
        arrange(s, {"s0_pinup": 4, "s0_tough": 4, "s0_gunman": 4, "s1_pinup": 3, "s2_pinup": 6})
        s["locations"][3]["zombies"] = 3
        s["attack_location"] = 4
        rules._start_vote(s, "victim", 4)
        hide = grant(s, "p0", "hide")
        act(s, "p0", "play_card", card_id=hide, character_id="s0_pinup")
        pass_window(s)
        self.assertEqual(s["phase"], "victim")
        self.assertRejected(s, "p0", action(s, "sacrifice", character_id="s0_pinup"))
        act(s, "p0", "sacrifice", character_id="s0_tough")
        self.assertEqual(s["phase"], "cards")
        self.assertEqual(s["locations"][3]["zombies"], 2)
        pass_window(s)
        self.assertEqual([c["id"] for c in rules._characters(s, "p0")], ["s0_pinup"])
        self.assertEqual(s["locations"][3]["zombies"], 0)

    def test_condemnation_only_empty_non_parking_locations(self):
        s = make_state()
        arrange(s, {"s0_pinup": 3, "s1_pinup": 5, "s2_pinup": 6})
        s.update(forecast=[1, 3, 4, 2], destinations={"p0": 1, "p1": 3, "p2": 5})
        for loc in (1, 3, 4):
            s["locations"][loc - 1]["zombies"] = 7
        rules._reveal_destinations(s)
        self.assertTrue(s["locations"][0]["closed"])
        self.assertEqual(s["locations"][0]["zombies"], 0)
        self.assertFalse(s["locations"][2]["closed"])
        self.assertFalse(s["locations"][3]["closed"])
        self.assertEqual(s["locations"][1]["zombies"], 0)

    def test_noise_unique_maxima_and_ties(self):
        s = make_state()
        arrange(s, {"s0_pinup": 1, "s1_pinup": 1, "s0_tough": 1, "s2_tough": 3})
        rules._start_attacks(s)
        self.assertEqual(s["locations"][0]["zombies"], 2)
        self.assertEqual(len(s["noise"]), 2)
        s = make_state()
        arrange(s, {"s0_pinup": 1, "s0_tough": 1, "s1_pinup": 3, "s1_tough": 3})
        rules._start_attacks(s)
        self.assertEqual(s["noise"], [])

    def test_elimination_revenge_once_only_in_next_round(self):
        s = make_state(4)
        arrange(s, {"s1_pinup": 1, "s1_tough": 1, "s2_pinup": 3, "s2_tough": 3, "s3_pinup": 6})
        rules._finish_round(s)
        self.assertEqual(s["phase"], "round_review")
        self.assertEqual(s["players"]["p0"]["eliminated_round"], 2)
        s.update(round=3, forecast=[2, 2, 2, 2], revealed=False, destinations={"p1": 3, "p2": 5, "p3": 4})
        rules._start_revenge(s)
        self.assertEqual(s["phase"], "revenge")
        self.assertEqual(Game.get_public_view(s, "p0")["destinations"], {})
        act(s, "p0", "place_zombie", destination=6)
        self.assertEqual(s["locations"][5]["zombies"], 1)
        self.assertTrue(s["players"]["p0"]["revenge_used"])
        s["round"] = 4
        rules._start_revenge(s)
        self.assertEqual(s["phase"], "move")

    def test_every_seat_must_acknowledge_including_eliminated(self):
        s = make_state(4)
        arrange(s, {"s1_pinup": 1, "s1_tough": 1, "s2_pinup": 3, "s2_tough": 3, "s3_pinup": 6})
        rules._finish_round(s)
        for pid in ("p1", "p2", "p3"):
            act(s, pid, "next_round")
        self.assertEqual(s["phase"], "round_review")
        self.assertRejected(s, "p1", action(s, "next_round"))
        self.assertRejected(s, "visitor", action(s, "next_round"))
        act(s, "p0", "next_round")
        self.assertEqual(s["round"], 3)
        self.assertNotEqual(s["phase"], "round_review")

    def test_game_end_thresholds_safe_gathering_and_tiebreak(self):
        for n, placements in ((3, {"s0_pinup": 1, "s1_pinup": 3, "s2_gunman": 6}),
                              (6, {f"s{i}_pinup": 1 if i < 3 else 3 for i in range(6)})):
            s = make_state(n)
            arrange(s, placements)
            grant(s, "p0", "hide")
            rules._finish_round(s)
            self.assertTrue(s["game_over"])
            self.assertEqual(s["winner_ids"], ["p0"])
        s = make_state(4)
        arrange(s, {"s0_pinup": 6, "s0_tough": 6, "s1_pinup": 6, "s1_tough": 6, "s2_pinup": 6})
        rules._finish_round(s)
        self.assertTrue(s["game_over"])
        s = make_state(4)
        arrange(s, {"s0_pinup": 4, "s0_tough": 4, "s1_pinup": 4, "s1_tough": 4, "s2_pinup": 4})
        rules._finish_round(s)
        self.assertFalse(s["game_over"])

    def test_does_not_end_mid_attack(self):
        s = make_state()
        arrange(s, {"s0_pinup": 1, "s0_tough": 3, "s1_pinup": 3, "s1_tough": 5, "s2_pinup": 6})
        s["locations"][0]["zombies"] = 1
        s["locations"][2]["zombies"] = 3
        s["attack_location"] = 1
        rules._start_vote(s, "victim", 1)
        pass_window(s)
        self.assertEqual(len(rules._characters(s)), 4)
        self.assertFalse(s["game_over"])
        self.assertEqual(s["vote"]["location"], 3)

    def test_private_loot_distribution_and_short_deck(self):
        for count in (1, 2, 3):
            s = make_state()
            arrange(s, {"s0_pinup": 4, "s1_pinup": 3, "s2_pinup": 6})
            s["deck"] = s["deck"][:count]
            rules._start_vote(s, "truck", 4)
            pass_window(s)
            self.assertEqual(len(Game.get_public_view(s, "p0")["loot"]), count)
            self.assertEqual(Game.get_public_view(s, "p1")["loot"], [])
            keep = s["loot"][0]["id"]
            give = s["loot"][1]["id"] if count > 1 else None
            if give:
                self.assertRejected(s, "p0", action(s, "distribute", keep_id=keep, give_id=keep, recipient_id="p1"))
            act(s, "p0", "distribute", keep_id=keep, give_id=give, recipient_id="p1" if give else None)
            self.assertIn(keep, [c["id"] for c in s["players"]["p0"]["hand"]])
            if give:
                self.assertIn(give, [c["id"] for c in s["players"]["p1"]["hand"]])
            self.assertEqual(len(s["deck"]), max(0, count - 2))
            self.assertNotIn(keep, json.dumps(s["log"]))

    def test_malformed_stale_and_repeated_actions_are_atomic(self):
        s = make_state()
        good = choose_action(Game.get_public_view(s, "p0"))
        for bad in (None, [], {}, {**good, "extra": 2}, {**good, "character_id": []},
                    {**good, "destination": True}, {**good, "step": 0.0}, {**good, "game_token": "old"}):
            self.assertRejected(s, "p0", bad)
        self.assertIsNone(Game.apply_action(s, "p0", good)[1])
        self.assertRejected(s, "p0", good)

    def test_public_view_is_detached_and_has_no_private_data(self):
        s = make_state()
        view = Game.get_public_view(s, "p0")
        for key in ("seed", "random_counter", "deck", "player_meta", "forecast_viewers"):
            self.assertNotIn(key, view)
        for p in view["players"]:
            self.assertNotIn("hand", p)
        view["hand"][0]["kind"] = "changed"
        view["locations"][0]["closed"] = True
        self.assertNotEqual(s["players"]["p0"]["hand"][0]["kind"], "changed")
        self.assertFalse(s["locations"][0]["closed"])
        self.assertEqual(Game.get_public_view(s, "visitor")["hand"], [])
        self.assertEqual(Game.get_public_view(s, "visitor")["legal_actions"], [])

    def test_bots_use_only_the_public_view(self):
        s = make_state()
        baseline = choose_action(Game.get_public_view(s, "p0"))
        changed = copy.deepcopy(s)
        changed["seed"] = "different"
        changed["deck"].reverse()
        changed["players"]["p1"]["hand"], changed["players"]["p2"]["hand"] = changed["players"]["p2"]["hand"], changed["players"]["p1"]["hand"]
        self.assertEqual(choose_action(Game.get_public_view(changed, "p0")), baseline)

    def test_full_games_conserve_cards_and_resume_every_phase(self):
        seen = set()
        for n in (3, 4, 5, 6):
            for seed in (140, 947):
                s = make_state(n, seed)
                for turn in range(1800):
                    seen.add(s["phase"])
                    packed = json.loads(json.dumps(Game.serialize(s)))
                    restored = Game.deserialize(packed)
                    self.assertEqual(s, restored)
                    all_cards = s["deck"] + s["discard"] + s["loot"] + [c for p in s["players"].values() for c in p["hand"]]
                    self.assertEqual(len(all_cards), 21)
                    self.assertEqual(len({c["id"] for c in all_cards}), 21)
                    for loc in s["locations"]:
                        if loc["capacity"] is not None:
                            self.assertLessEqual(len(rules._characters(s, location=loc["id"])), loc["capacity"])
                    if s["game_over"]:
                        break
                    for pid in s["turn_order"]:
                        move = choose_action(Game.get_public_view(s, pid))
                        if move:
                            self.assertEqual(choose_action(Game.get_public_view(restored, pid)), move)
                            self.assertIsNone(Game.apply_action(s, pid, move)[1])
                            self.assertIsNone(Game.apply_action(restored, pid, move)[1])
                            self.assertEqual(s, restored)
                            break
                    else:
                        self.fail(f"No legal action: {s['phase']}")
                else:
                    self.fail(f"Game stalled after {turn} actions")
        self.assertTrue({"setup", "cards", "vote", "distribute", "camera", "chief_destination", "destinations", "move", "victim", "round_review", "game_over"} <= seen)


if __name__ == "__main__":
    unittest.main()
