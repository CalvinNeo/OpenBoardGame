import copy
import json
import unittest

from jsonschema import validate

from game.natsumemo import ACTION_SCHEMA, NatsumemoGame as Game, available_starts, final_scores, _draw_event, _study
from game.natsumemo_data import CARDS, TITLES, activity_reward, homework_reward, study_card


def action(state, kind, **fields):
    return {"type": kind, "game_token": state["game_token"], "step": state["step"], **fields}


def game(count=3, seed=142):
    return Game.init_game({"seed": seed}, [{"player_id": f"p{i}", "name": f"Player {i}", "seat": i} for i in range(count)])


def submit(state, pid, kind, **fields):
    payload = action(state, kind, **fields)
    validate(payload, ACTION_SCHEMA)
    events, error = Game.apply_action(state, pid, payload)
    assert error is None, error
    return events


def start(state, card_id="w1_shopping"):
    for i, pid in enumerate(state["turn_order"]):
        submit(state, pid, "choose_role", role="boy" if i % 2 == 0 else "girl")
    state["card"] = copy.deepcopy(CARDS[card_id])
    state["week"] = state["card"]["week"]


def respond(state, attendees, day=0):
    submit(state, state["speaker"], "propose", day=day)
    # Cache simultaneous submissions before any other player has responded.
    requests = [(p, action(state, "respond", attend=p in attendees)) for p in state["turn_order"]
                if p not in state["choices"]]
    for pid, payload in requests:
        assert Game.apply_action(state, pid, payload)[1] is None


def finish(state):
    for _ in range(2000):
        if state["game_over"]:
            return
        acted = False
        for pid in state["turn_order"]:
            payload = Game.bot_move(state, pid)
            if payload:
                payload.pop("delay_ms")
                validate(payload, ACTION_SCHEMA)
                assert Game.apply_action(state, pid, payload)[1] is None
                acted = True
        assert acted, state["phase"]
    raise AssertionError("game did not finish")


class NatsumemoTests(unittest.TestCase):
    def test_inventory_has_all_four_weeks_and_titles(self):
        self.assertEqual(len(CARDS), 36)
        self.assertEqual(len(TITLES), 21)
        for week in range(1, 5):
            self.assertEqual(sum(card["week"] == week for card in CARDS.values()), 9)
        self.assertTrue(all(card["title"] in TITLES and card["description"] for card in CARDS.values()))

    def test_setup_balances_roles_and_rejects_invalid_config(self):
        state = game(4)
        submit(state, "p0", "choose_role", role="boy")
        submit(state, "p1", "choose_role", role="boy")
        self.assert_rejected(state, "p2", action(state, "choose_role", role="boy"))
        self.assert_rejected(state, "p0", action(state, "choose_role", role="girl"))
        for config in ({"seed": True}, {"seed": []}, {"seed": ""}, {"unknown": 1}):
            with self.assertRaises(ValueError):
                Game.init_game(config, [{"player_id": str(i)} for i in range(3)])
        for count in (2, 7):
            with self.assertRaises(ValueError):
                game(count)

    def assert_rejected(self, state, pid, payload):
        before = copy.deepcopy(state)
        self.assertIsNotNone(Game.apply_action(state, pid, payload)[1])
        self.assertEqual(state, before)

    def test_dates_are_consecutive_and_do_not_cross_weeks(self):
        self.assertEqual(available_starts([None, {}, None, None, None, {}, None], 2), [2, 3])
        state = game(); start(state, "w1_sea")
        self.assert_rejected(state, state["speaker"], action(state, "propose", day=6))
        self.assert_rejected(state, state["speaker"], action(state, "propose", day=True))
        state["players"]["p0"]["calendar"][0][1] = {"kind": "occupied"}
        if state["speaker"] == "p0":
            state["speaker"] = "p1"
        respond(state, ["p1", "p2"], 0)
        self.assertEqual(state["result"]["participants"], ["p1", "p2"])
        for pid in ("p1", "p2"):
            cells = state["players"][pid]["calendar"][0]
            self.assertIsNone(cells[0]["points"])
            self.assertEqual(cells[1]["points"], 10)

    def test_simultaneous_choices_remain_private_until_reveal(self):
        state = game(); start(state)
        submit(state, state["speaker"], "propose", day=0)
        first = action(state, "respond", attend=True)
        events, _ = Game.apply_action(state, "p0", first)
        self.assertEqual(events, [{"type": "natsumemo:updated", "payload": {"phase": "respond"}}])
        own, other = Game.get_public_view(state, "p0"), Game.get_public_view(state, "p1")
        self.assertTrue(own["private"]["choice"])
        self.assertIsNone(other["private"]["choice"])
        self.assertIsNone(other["result"])
        self.assertTrue(all(p["calendar"][0][0] is None for p in other["players"]))
        self.assert_rejected(state, "p0", first)
        submit(state, "p1", "respond", attend=True)
        submit(state, "p2", "respond", attend=False)
        self.assertEqual([r["points"] for r in state["result"]["rows"]], [7, 7])

    def test_heart_allocation_is_private_atomic_and_requires_everyone(self):
        state = game(); start(state, "w1_sea"); respond(state, ["p0", "p1", "p2"])
        self.assertEqual(state["phase"], "allocate")
        for allocation in ({"p0": 2}, {"outsider": 2}, {"p1": 1}, {"p1": True}, {"p1": -1, "p2": 3}):
            self.assert_rejected(state, "p0", action(state, "allocate", hearts=allocation))
        submit(state, "p0", "allocate", hearts={"p1": 1, "p2": 1})
        self.assertEqual(Game.get_public_view(state, "p0")["private"]["hearts"], {"p1": 1, "p2": 1})
        self.assertTrue(all("hearts" not in p for p in Game.get_public_view(state, "p1")["players"]))
        self.assertEqual(state["phase"], "allocate")
        submit(state, "p1", "allocate", hearts={"p0": 2})
        submit(state, "p2", "allocate", hearts={"p0": 2})
        step = state["step"]
        submit(state, "p0", "next_round"); submit(state, "p1", "next_round")
        self.assertEqual(state["step"], step)
        self.assert_rejected(state, "p0", action(state, "next_round"))
        submit(state, "p2", "next_round")
        self.assertEqual(state["phase"], "propose")

    def test_boardgame_secret_selection_and_tie_scoring(self):
        state = game(); start(state, "w2_boardgames"); respond(state, ["p0", "p1", "p2"])
        self.assertEqual(state["phase"], "contest")
        submit(state, "p0", "choose_die", value=6)
        other = Game.get_public_view(state, "p1")
        self.assertEqual(other["dice_submitted"], ["p0"])
        self.assertIsNone(other["private"]["die"])
        self.assertIsNone(other["result"])
        self.assert_rejected(state, "p0", action(state, "choose_die", value=1))
        self.assert_rejected(state, "p1", action(state, "choose_die", value=True))
        submit(state, "p1", "choose_die", value=6); submit(state, "p2", "choose_die", value=5)
        self.assertEqual([r["points"] for r in state["result"]["rows"]], [4, 4, 6])
        self.assertEqual(state["result"]["dice"], {"p0": 6, "p1": 6, "p2": 5})

    def test_card_effects_and_solo_overrides(self):
        players = game(4)["players"]
        def reward(card, attendees, pid="p0", dice=None):
            return activity_reward(CARDS[card], attendees, pid, players, dice)
        self.assertEqual(reward("w1_bbq", ["p0", "p1"])["points"], 6)
        self.assertEqual(reward("w2_bbq", ["p0", "p1", "p2"])["points"], 3)
        self.assertEqual(reward("w1_pool", ["p0", "p2"])["points"], 3)
        self.assertEqual(reward("w4_pool", ["p0", "p1"])["points"], 8)
        self.assertEqual(reward("w2_festival", ["p0", "p1"])["points"], 8)
        self.assertEqual(reward("w4_park", ["p0", "p1", "p2"])["points"], 8)
        self.assertEqual(reward("w4_shopping", ["p0"])["points"], 2)
        self.assertEqual(reward("w4_abroad", ["p0"]), {"points": 24, "homework": 0, "hearts": 0, "titles": ["family"]})
        for visit, points in enumerate((3, 6, 10, 10)):
            players["p0"]["visits"]["base"] = visit
            self.assertEqual(reward("w4_base", ["p0"])["points"], points)
        self.assertEqual(reward("w3_video", ["p0", "p1"], dice={"p0": 6, "p1": 6})["points"], 8)
        self.assertEqual(reward("w1_video", ["p0", "p1"], dice={"p0": 6, "p1": 2})["points"], 6)
        self.assertEqual(reward("w4_bugs", ["p0"], dice={"p0": 6})["points"], 10)
        self.assertEqual(reward("w2_bugs", ["p0", "p1"], dice={"p0": 4, "p1": 6})["points"], 5)

    def test_candy_counts_events_not_days_and_includes_study(self):
        players = game()["players"]
        p = players["p0"]
        p["calendar"][0][:3] = [{"id": "trip", "kind": "grandparents"}] * 3
        p["calendar"][1][2] = {"id": "study", "kind": "study"}
        p["calendar"][1][3] = {"id": "homework", "kind": "homework"}
        self.assertEqual(activity_reward(CARDS["w3_candy"], ["p0", "p1"], "p0", players)["points"], 2)

    def test_solo_bugs_rolls_and_solo_boardgames_does_not_wait(self):
        state = game(); start(state, "w4_bugs"); respond(state, ["p0"])
        self.assertIn("p0", state["result"]["dice"])
        self.assertEqual(state["phase"], "event_review")
        state = game(); start(state, "w2_boardgames"); respond(state, ["p0"])
        self.assertEqual(state["phase"], "event_review")
        self.assertEqual(state["players"]["p0"]["titles"], ["solitaire"])

    def test_study_and_homework_errata(self):
        players = game()["players"]
        for week in (1, 2, 3):
            self.assertEqual(activity_reward(study_card(week), ["p0"], "p0", players)["homework"], 3)
            self.assertEqual(homework_reward(week, 2)["homework"], 2)
            self.assertEqual(homework_reward(week, 1)["points"], 3)
        self.assertEqual(activity_reward(study_card(4), ["p0"], "p0", players)["points"], 0)
        self.assertEqual(activity_reward(study_card(4), ["p0"], "p0", players)["homework"], 4)
        self.assertEqual(activity_reward(study_card(4), ["p0", "p1"], "p0", players)["homework"], 3)
        self.assertEqual([homework_reward(4, die)["homework"] for die in range(1, 7)], [0, 0, 3, 3, 3, 4])
        self.assertEqual(homework_reward(4, 2)["titles"], ["super_slacker"])

    def test_empty_events_count_and_weekly_homework_stays_private(self):
        state = game(); start(state)
        first = state["first_speaker"]
        for _ in range(6):
            respond(state, [])
            self.assertEqual(state["phase"], "event_review")
            for pid in state["turn_order"]:
                submit(state, pid, "next_round")
        self.assertEqual(state["review_kind"], "week_review")
        for pid in state["turn_order"]:
            self.assertEqual(len(state["players"][pid]["study_results"][0]["rolls"]), 6)
            self.assertTrue(all(state["players"][pid]["calendar"][0]))
            submit(state, pid, "allocate", hearts={next(p for p in state["turn_order"] if p != pid): 1})
        view = Game.get_public_view(state, "p0")
        self.assertTrue(all("homework" not in p for p in view["players"]))
        self.assertTrue(all("rolls" not in row for row in view["result"]["rows"]))
        for pid in state["turn_order"]:
            submit(state, pid, "next_round")
        self.assertEqual(state["week"], 2)
        self.assertEqual(state["first_speaker"], state["turn_order"][(state["turn_order"].index(first) + 1) % 3])

    def test_skips_full_speaker_and_ends_when_nothing_fits(self):
        state = game(); start(state)
        old = state["speaker"]
        state["players"][old]["calendar"][0] = [{}] * 7
        state["decks"][0] = ["w1_grandparents", "w1_shopping"]
        _draw_event(state)
        self.assertNotEqual(state["speaker"], old)
        self.assertEqual(state["card"]["id"], "w1_grandparents")
        for p in state["players"].values():
            p["calendar"][0] = [{"kind": "occupied"}] * 7
        _draw_event(state)
        self.assertEqual(state["phase"], "week_review")

    def test_study_skips_occupied_wednesday_and_caps_homework(self):
        state = game(); start(state)
        for p in state["players"].values():
            p["homework"] = 29
        state["players"]["p0"]["calendar"][0][2] = {"kind": "occupied"}
        _study(state)
        self.assertNotIn("p0", state["result"]["participants"])
        self.assertTrue(all(p["homework"] == 30 for p in state["players"].values()))

    def test_final_score_givers_titles_homework_and_ties(self):
        state = game()
        for p in state["players"].values():
            p["homework"] = 25
        state["players"]["p0"].update(homework=30, titles=["caretaker"], week_scores=[10, 20, 30, 40])
        state["players"]["p1"]["homework"] = 23
        state["players"]["p0"]["hearts"]["p2"] = 5
        state["players"]["p1"]["hearts"]["p2"] = 4
        scores, contests = final_scores(state)
        self.assertEqual(scores[0], {"player_id": "p0", "activities": 100, "homework": 10,
                                     "titles": 4, "hearts": 15, "title_ids": ["caretaker", "prepared"], "total": 129})
        self.assertEqual(next(row for row in scores if row["player_id"] == "p1")["homework"], -20)
        self.assertEqual(contests[2]["winners"], ["p0"])
        state = game()
        state.update(phase="week_review", week=4)
        for pid in state["turn_order"]:
            submit(state, pid, "next_round")
        self.assertEqual(state["winner_ids"], state["turn_order"])

    def test_stale_and_unknown_requests_are_atomic(self):
        state = game(); start(state)
        for fields in ({"game_token": "old"}, {"step": -1}, {"extra": 1}, {"day": True}):
            self.assert_rejected(state, state["speaker"], {**action(state, "propose", day=0), **fields})
        self.assert_rejected(state, "outsider", action(state, "propose", day=0))
        self.assert_rejected(state, state["speaker"], {"type": []})

    def test_views_serialization_and_bots_complete_all_player_counts(self):
        for count in range(3, 7):
            with self.subTest(count=count):
                state = game(count)
                public = Game.get_public_view(state, "p0")
                for secret in ("base_seed", "decks", "config", "event_dice"):
                    self.assertNotIn(secret, public)
                public["players"][0]["titles"].append("fake")
                self.assertEqual(state["players"]["p0"]["titles"], [])
                self.assertIsNone(Game.get_public_view(state, "spectator")["private"])
                finish(state)
                self.assertEqual(len([h for h in state["history"] if h["kind"] == "study"]), 4)
                self.assertTrue(all(len(p["titles"]) == len(set(p["titles"])) for p in state["players"].values()))
                self.assertTrue(all(all(all(week) for week in p["calendar"]) for p in state["players"].values()))
                saved = json.loads(json.dumps(Game.serialize(state)))
                self.assertEqual(Game.deserialize(saved), state)
                self.assertTrue(all("hearts" in p for p in Game.get_public_view(state, "p0")["players"]))

    def test_bot_reserves_homework_time_before_accepting_an_activity(self):
        state = game(); start(state, "w4_park")
        state["players"]["p0"]["calendar"][3][:6] = [{"kind": "occupied"}] * 6
        submit(state, state["speaker"], "propose", day=6)
        self.assertFalse(Game.bot_move(state, "p0")["attend"])
        state["players"]["p0"]["homework"] = 30
        self.assertTrue(Game.bot_move(state, "p0")["attend"])


if __name__ == "__main__":
    unittest.main()
