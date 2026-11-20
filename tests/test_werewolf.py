import copy
import json
import unittest
from collections import Counter

from game import get_game
from game.werewolf import WerewolfGame as Game
from game.werewolf import _check_win, _dawn, _deaths, _night, _phase, _speeches, recommended_roles


def make_state(roles=None):
    roles = roles or ["werewolf", "werewolf", "seer", "witch", "hunter", "villager", "villager", "guard", "villager"]
    state = Game.init_game({}, [{"player_id": f"p{index}", "name": f"Player {index}", "seat": index}
                               for index in range(len(roles))])
    for player_id, role in zip(state["turn_order"], roles):
        state["players"][player_id]["role"] = role
    state["role_counts"] = dict(Counter(roles))
    state.update(phase="identity", current_turn=None)
    return state


def action(state, kind, **fields):
    return {"type": kind, "game_token": state["game_token"], "window_id": state["window_id"], **fields}


def apply(state, player_id, kind, **fields):
    events, error = Game.apply_action(state, player_id, action(state, kind, **fields))
    if error:
        raise AssertionError((player_id, kind, fields, error))
    return events


def all_ready(state, kind="next_round"):
    for player_id in state["turn_order"]:
        apply(state, player_id, kind)


def night_votes(state, target=None):
    for player_id in ["p0", "p1"]:
        apply(state, player_id, "wolf_vote", target=target)


class WerewolfTests(unittest.TestCase):
    def assert_rejected(self, state, player_id, kind, **fields):
        previous = copy.deepcopy(state)
        self.assertIsNotNone(Game.apply_action(state, player_id, action(state, kind, **fields))[1])
        self.assertEqual(previous, state)

    def test_registration_debug_bots_and_counts(self):
        self.assertIs(get_game("werewolf").module, Game)
        for count in range(6, 17):
            state = Game.init_game({}, [{"player_id": f"p{index}", "seat": index} for index in range(count)])
            self.assertEqual(sum(recommended_roles(count).values()), count)
            self.assertEqual(Game.get_legal_actions(state, "p0"), ["deal"])
            self.assert_rejected(state, "p1", "deal")
            apply(state, "p0", "deal")
            self.assertEqual(Counter(player["role"] for player in state["players"].values()),
                             Counter({role: count for role, count in state["role_counts"].items() if count}))
        for count in (0, 5, 17):
            with self.assertRaises(ValueError):
                Game.init_game({}, [{"player_id": str(index)} for index in range(count)])
        players = [{"player_id": str(index), "is_bot": index == 2} for index in range(6)]
        self.assertEqual(len(Game.init_game({}, players)["players"]), 6)
        players[-1] = players[0]
        for player in players:
            player["is_bot"] = False
        with self.assertRaises(ValueError):
            Game.init_game({}, players)

    def test_setup_validation_and_secure_deal(self):
        players = [{"player_id": str(index)} for index in range(9)]
        state = Game.init_game({}, players)
        for roles in ({"werewolf": 1}, {"werewolf": 5, "villager": 3, "seer": 1},
                      {"werewolf": 2, "villager": 5, "seer": 2}, {"werewolf": 2, "villager": 7},
                      {"werewolf": 2, "seer": 1, "witch": 1, "hunter": 1, "guard": 1, "idiot": 1, "knight": 1, "wolf_king": 1}):
            self.assert_rejected(state, "0", "deal", roles=roles)
        apply(state, "0", "deal", roles={"werewolf": 2, "seer": 1, "witch": 1, "villager": 5}, win_rule="all", self_save="never")
        self.assertEqual(state["win_rule"], "all")
        self.assertEqual(state["self_save"], "never")
        self.assertNotEqual(Game.init_game({}, players)["game_token"], state["game_token"])

    def test_identity_barrier_duplicates_and_stale_actions(self):
        state = make_state()
        previous_action = action(state, "ready")
        apply(state, "p0", "ready")
        self.assert_rejected(state, "p0", "ready")
        self.assertEqual(state["phase"], "identity")
        for player_id in state["turn_order"][1:]:
            apply(state, player_id, "ready")
        self.assertEqual(state["night_actors"], ["p7"])
        self.assertIsNotNone(Game.apply_action(state, "p0", previous_action)[1])
        self.assert_rejected(state, "guest", "ready")
        self.assert_rejected(state, "p7", "guard", target="missing")
        self.assertIsNotNone(Game.apply_action(state, "p7", {"type": "guard"})[1])
        self.assertIsNotNone(Game.apply_action(state, "p7", {**action(state, "guard"), "window_id": True})[1])
        self.assertIsNotNone(Game.apply_action(state, "p7", {**action(state, "guard"), "game_token": "old"})[1])

    def test_wolf_self_attack_setup_public_rule_and_save_compatibility(self):
        players = [{"player_id": f"p{index}"} for index in range(6)]
        for allowed in (False, True):
            with self.subTest(allowed=allowed):
                state = Game.init_game({}, players)
                self.assertFalse(state["allow_wolf_self_attack"])
                for invalid in (0, 1, "true", None):
                    self.assert_rejected(state, "p0", "deal", allow_wolf_self_attack=invalid)
                apply(state, "p0", "deal", allow_wolf_self_attack=allowed)
                self.assertIs(state["allow_wolf_self_attack"], allowed)
                for viewer in ("p0", "p1", "guest"):
                    self.assertIs(Game.get_public_view(state, viewer)["allow_wolf_self_attack"], allowed)
                self.assertEqual(Game.deserialize(Game.serialize(state)), state)
                legacy = Game.serialize(state)
                del legacy["allow_wolf_self_attack"]
                self.assertFalse(Game.get_public_view(legacy, "p0")["allow_wolf_self_attack"])
                self.assertFalse(Game.deserialize(legacy)["allow_wolf_self_attack"])
                self.assertNotIn("allow_wolf_self_attack", legacy)

    def test_wolf_self_attack_rule_applies_to_self_and_teammates(self):
        for allowed in (False, True):
            for role in ("werewolf", "wolf_king", "white_wolf"):
                for target in ("p0", "p1", "p5", None):
                    with self.subTest(allowed=allowed, role=role, target=target):
                        state = make_state()
                        state["allow_wolf_self_attack"] = allowed
                        state["players"]["p0"]["role"] = role
                        _night(state)
                        apply(state, "p7", "guard")
                        if not allowed and target in ("p0", "p1"):
                            self.assert_rejected(state, "p0", "wolf_vote", target=target, allow_wolf_self_attack=True)
                        else:
                            apply(state, "p0", "wolf_vote", target=target, allow_wolf_self_attack=not allowed)
                            self.assertEqual(state["wolf_votes"], {"p0": target})
                        self.assertIs(state["allow_wolf_self_attack"], allowed)

    def test_wolf_self_attack_resolves_normally_without_revealing_role(self):
        state = make_state()
        state["allow_wolf_self_attack"] = True
        state["players"]["p0"]["role"] = "wolf_king"
        _night(state)
        apply(state, "p7", "guard")
        night_votes(state, "p0")
        self.assertEqual(Game.get_public_view(state, "p3")["victim"], "p0")
        self.assertIsNone(Game.get_public_view(state, "p5")["victim"])
        apply(state, "p3", "witch", choice="pass")
        self.assert_rejected(state, "p2", "inspect", target="p2")
        apply(state, "p2", "inspect", target="p0")
        self.assertFalse(state["players"]["p0"]["alive"])
        self.assertEqual(state["phase"], "last_words")
        self.assertFalse(state["players"]["p0"]["revealed"])
        self.assertIsNone(Game.get_public_view(state, "p5")["players"][0]["role"])
        apply(state, "p0", "end_speech")
        self.assertEqual(state["phase"], "dawn_review")

    def test_wolf_self_attack_can_be_guarded_or_saved(self):
        for protected, saved in ((False, True), (True, False), (True, True)):
            with self.subTest(protected=protected, saved=saved):
                state = make_state()
                state["allow_wolf_self_attack"] = True
                _night(state)
                apply(state, "p7", "guard", target="p0" if protected else None)
                night_votes(state, "p0")
                apply(state, "p3", "witch", choice="save" if saved else "pass")
                apply(state, "p2", "inspect", target="p0")
                self.assertEqual(state["players"]["p0"]["alive"], protected != saved)

    def test_full_night_and_review_barrier(self):
        state = make_state()
        all_ready(state, "ready")
        apply(state, "p7", "guard", target="p6")
        self.assert_rejected(state, "p0", "wolf_vote", target="p1")
        apply(state, "p0", "wolf_vote", target="p6")
        self.assert_rejected(state, "p0", "wolf_vote", target="p6")
        self.assertEqual(Game.get_public_view(state, "p1")["wolf_votes"], {"p0": "p6"})
        apply(state, "p1", "wolf_vote", target="p6")
        self.assertEqual(Game.get_public_view(state, "p3")["victim"], "p6")
        apply(state, "p3", "witch", choice="pass")
        apply(state, "p2", "inspect", target="p0")
        self.assertEqual(state["phase"], "dawn_review")
        self.assertTrue(state["players"]["p6"]["alive"])
        for player_id in state["turn_order"][:-1]:
            apply(state, player_id, "next_round")
        self.assertEqual(state["phase"], "dawn_review")
        self.assert_rejected(state, "p0", "next_round")
        apply(state, "p8", "next_round")
        self.assertEqual(state["phase"], "discussion")
        self.assertEqual(state["current_turn"], "p0")

    def test_night_view_never_exposes_actors_or_secrets(self):
        state = make_state()
        all_ready(state, "ready")
        apply(state, "p7", "guard", target="p6")
        night_votes(state, "p8")
        apply(state, "p3", "witch", choice="pass")
        apply(state, "p2", "inspect", target="p0")
        seer = Game.get_public_view(state, "p2")
        self.assertEqual(seer["own"]["inspections"], [{"day": 1, "target": "p0", "team": "wolves"}])
        for viewer in ("guest", "p6", "p8", "p0", "p7", "p3"):
            view = Game.get_public_view(state, viewer)
            self.assertNotIn("night", view)
            self.assertNotIn("night_actors", view)
            self.assertNotIn("night_step", view)
            self.assertIsNone(view["victim"])
            self.assertTrue(all(player["role"] is None for player in view["players"]))
            self.assertEqual((view["own"] or {}).get("inspections", []), [])
            if viewer not in ("p0", "p1"):
                self.assertEqual(view["wolf_team"], [])
                self.assertEqual(view["wolf_votes"], {})
        self.assertIsNone(Game.get_public_view(state, "guest")["own"])
        self.assertEqual(Game.get_public_view(state, "guest")["legal_actions"], [])
        self.assertTrue(all("poison" not in line and "wolves" not in line for line in state["log"]))
        seer["own"]["inspections"].clear()
        self.assertEqual(len(state["players"]["p2"]["inspections"]), 1)

    def test_guard_restriction_and_skipping_resets_previous_guard(self):
        state = make_state()
        state["players"]["p7"]["last_guard"] = "p7"
        _night(state)
        self.assert_rejected(state, "p7", "guard", target="p7")
        apply(state, "p7", "guard", target=None)
        self.assertIsNone(state["players"]["p7"]["last_guard"])

    def test_wolf_ties_and_all_pass(self):
        for targets in (("p5", "p6"), (None, None), ("p5", None)):
            state = make_state()
            _night(state)
            apply(state, "p7", "guard", target=None)
            for player_id, target in zip(("p0", "p1"), targets):
                apply(state, player_id, "wolf_vote", target=target)
            self.assertEqual(state["night"]["kill"], "p5" if targets == ("p5", None) else None)

    def test_witch_self_save_rules_and_no_double_potions(self):
        for day, rule, allowed in ((1, "first_night", True), (2, "first_night", False), (1, "never", False)):
            state = make_state()
            state.update(day=day, self_save=rule)
            _night(state)
            apply(state, "p7", "guard", target=None)
            night_votes(state, "p3")
            if allowed:
                apply(state, "p3", "witch", choice="save")
                self.assertFalse(state["players"]["p3"]["save"])
                self.assertTrue(state["players"]["p3"]["poison"])
                self.assert_rejected(state, "p3", "witch", choice="poison", target="p0")
            else:
                self.assert_rejected(state, "p3", "witch", choice="save")
            if not allowed:
                self.assert_rejected(state, "p3", "witch", choice="poison", target="p3")
                self.assert_rejected(state, "p3", "witch", choice="poison")
                self.assert_rejected(state, "p3", "witch")
                apply(state, "p3", "witch", choice="poison", target="p0")
                self.assertFalse(state["players"]["p3"]["poison"])

    def test_witch_cannot_see_target_after_antidote_used(self):
        state = make_state()
        state["players"]["p3"]["save"] = False
        _night(state)
        apply(state, "p7", "guard", target=None)
        night_votes(state, "p8")
        self.assertIsNone(Game.get_public_view(state, "p3")["victim"])
        self.assert_rejected(state, "p3", "witch", choice="save")

    def test_dawn_protection_matrix_and_hidden_death_causes(self):
        for guarded in (False, True):
            for saved in (False, True):
                state = make_state()
                state.update(night={"guard": "p8" if guarded else None, "kill": "p8", "poison": None, "saved": saved})
                _dawn(state)
                self.assertEqual(state["players"]["p8"]["alive"], guarded != saved)
                if guarded == saved:
                    self.assertEqual(state["phase"], "last_words")
                    self.assertEqual(Game.get_legal_actions(state, "p8"), ["end_speech"])
                for player in Game.get_public_view(state, "guest")["players"]:
                    self.assertNotIn("death_reason", player)

    def test_poison_overrides_attack_and_disables_hunter_and_wolf_king(self):
        for role in ("hunter", "wolf_king"):
            state = make_state()
            state["players"]["p4"]["role"] = role
            state.update(day=2, night={"guard": None, "kill": "p4", "poison": "p4", "saved": False})
            _dawn(state)
            self.assertEqual(state["players"]["p4"]["death_reason"], "poison")
            self.assertEqual(state["phase"], "dawn_review")
            self.assertEqual(Game.get_legal_actions(state, "p4"), ["next_round"])
            self.assertFalse(state["players"]["p4"]["revealed"])

    def test_hunter_chain_and_no_premature_win(self):
        state = make_state()
        state["players"]["p1"]["alive"] = False
        state["players"]["p0"]["role"] = "wolf_king"
        _deaths(state, {"p4": "eaten"}, "dawn_review", ["p4"])
        self.assertEqual(state["current_turn"], "p4")
        self.assert_rejected(state, "p5", "shoot", target="p0")
        self.assert_rejected(state, "p4", "shoot", target="p4")
        apply(state, "p4", "shoot", target="p0")
        self.assertFalse(state["game_over"])
        self.assertEqual(state["current_turn"], "p0")
        apply(state, "p0", "shoot", target="p5")
        self.assertEqual(state["phase"], "last_words")
        apply(state, "p4", "end_speech")
        self.assertEqual(state["phase"], "dawn_review")
        all_ready(state)
        self.assertEqual(state["winning_team"], "good")
        self.assertTrue(all(player["role"] for player in Game.get_public_view(state, "guest")["players"]))

    def test_hunter_can_pass_and_wolf_king_exceptions(self):
        state = make_state()
        _deaths(state, {"p4": "eaten"}, "dawn_review", [])
        apply(state, "p4", "shoot", target=None)
        self.assertEqual(state["phase"], "dawn_review")
        for reason in ("eaten", "poison", "explode", "milk_pierce"):
            state = make_state()
            state["players"]["p0"]["role"] = "wolf_king"
            _deaths(state, {"p0": reason}, "dusk_review", [])
            self.assertEqual(state["phase"], "dusk_review")

    def test_speech_handover_is_only_current_speaker(self):
        state = make_state()
        _speeches(state)
        self.assert_rejected(state, "p1", "end_speech")
        apply(state, "p0", "end_speech")
        self.assertEqual(state["current_turn"], "p1")
        while state["phase"] == "discussion":
            apply(state, state["current_turn"], "end_speech")
        self.assertEqual(state["phase"], "vote")

    def test_ballot_privacy_and_exile_last_words(self):
        state = make_state()
        _phase(state, "vote")
        self.assert_rejected(state, "p0", "vote", target="p0")
        apply(state, "p0", "vote", target="p5")
        self.assert_rejected(state, "p0", "vote", target="p6")
        view = Game.get_public_view(state, "p6")
        self.assertEqual(view["submitted"], ["p0"])
        self.assertNotIn("ballots", view)
        self.assertEqual(view["vote_history"], [])
        for player_id in state["turn_order"][1:]:
            apply(state, player_id, "vote", target="p5" if player_id != "p5" else None)
        self.assertFalse(state["players"]["p5"]["alive"])
        self.assertEqual(state["phase"], "last_words")
        self.assertIsNone(Game.get_public_view(state, "guest")["players"][5]["role"])
        self.assertEqual(len(Game.get_public_view(state, "guest")["vote_history"][0]["ballots"]), 9)
        apply(state, "p5", "end_speech")
        all_ready(state)
        self.assertEqual(state["day"], 2)
        self.assertEqual(state["phase"], "night")

    def test_tie_pk_candidates_cannot_vote_second_tie_no_exile(self):
        state = make_state()
        _phase(state, "vote")
        for index, player_id in enumerate(state["turn_order"]):
            apply(state, player_id, "vote", target="p5" if index < 2 else "p6" if index < 4 else None)
        self.assertTrue(state["pk_round"])
        self.assertEqual(state["vote_candidates"], ["p5", "p6"])
        self.assertEqual(state["current_turn"], "p5")
        apply(state, "p5", "end_speech")
        apply(state, "p6", "end_speech")
        self.assert_rejected(state, "p5", "vote", target="p6")
        self.assert_rejected(state, "p0", "vote", target="p4")
        for index, player_id in enumerate(["p0", "p1", "p2", "p3", "p4", "p7", "p8"]):
            apply(state, player_id, "vote", target="p5" if index < 2 else "p6" if index < 4 else None)
        self.assertEqual(state["phase"], "dusk_review")
        self.assertEqual(state["last_deaths"], [])
        self.assertEqual(len(state["vote_history"]), 2)

    def test_all_abstain_and_idiot_loses_vote(self):
        state = make_state()
        _phase(state, "vote")
        for player_id in state["turn_order"]:
            apply(state, player_id, "vote", target=None)
        self.assertEqual(state["phase"], "dusk_review")
        state = make_state()
        state["players"]["p5"]["role"] = "idiot"
        _phase(state, "vote")
        for player_id in state["turn_order"]:
            apply(state, player_id, "vote", target=None if player_id == "p5" else "p5")
        self.assertTrue(state["players"]["p5"]["alive"])
        self.assertFalse(state["players"]["p5"]["can_vote"])
        self.assertEqual(Game.get_public_view(state, "guest")["players"][5]["role"], "idiot")
        _phase(state, "vote")
        state["ballots"] = {}
        self.assert_rejected(state, "p5", "vote", target="p0")

    def test_explosion_and_white_wolf_hunter_response(self):
        state = make_state()
        _speeches(state)
        self.assert_rejected(state, "p5", "explode")
        self.assert_rejected(state, "p0", "explode", target="p4")
        apply(state, "p1", "explode")
        self.assertEqual(state["phase"], "dusk_review")
        self.assertFalse(state["players"]["p1"]["alive"])
        state = make_state()
        state["players"]["p0"]["role"] = "white_wolf"
        _speeches(state)
        self.assert_rejected(state, "p0", "explode")
        apply(state, "p0", "explode", target="p4")
        self.assertEqual(state["phase"], "death_skill")
        apply(state, "p4", "shoot", target="p1")
        all_ready(state)
        self.assertEqual(state["winning_team"], "good")

    def test_knight_good_target_continues_speaking(self):
        for knight in ("p0", "p5"):
            state = make_state()
            state["players"][knight]["role"] = "knight"
            _speeches(state)
            self.assert_rejected(state, knight, "duel", target=knight)
            apply(state, knight, "duel", target="p6")
            self.assertFalse(state["players"][knight]["alive"])
            self.assertEqual(state["phase"], "discussion")
            self.assertEqual(state["current_turn"], "p1" if knight == "p0" else "p0")
            self.assert_rejected(state, knight, "duel", target="p1")

    def test_knight_kills_wolf_and_ends_day(self):
        state = make_state()
        state["players"]["p5"]["role"] = "knight"
        _speeches(state)
        apply(state, "p5", "duel", target="p0")
        self.assertTrue(state["players"]["p5"]["alive"])
        self.assertTrue(state["players"]["p5"]["revealed"])
        self.assertFalse(state["players"]["p0"]["alive"])
        self.assertEqual(state["phase"], "dusk_review")

    def test_side_all_parity_and_draw(self):
        state = make_state()
        for player_id in ("p5", "p6", "p8"):
            state["players"][player_id]["alive"] = False
        self.assertTrue(_check_win(state))
        self.assertEqual(state["winning_team"], "wolves")
        state = make_state()
        state["win_rule"] = "all"
        for player_id in ("p2", "p3", "p4", "p7", "p8"):
            state["players"][player_id]["alive"] = False
        self.assertFalse(_check_win(state))
        for player_id in ("p5", "p6"):
            state["players"][player_id]["alive"] = False
        self.assertTrue(_check_win(state))
        self.assertEqual(state["winning_team"], "wolves")
        state = make_state()
        for player in state["players"].values():
            player["alive"] = False
        self.assertTrue(_check_win(state))
        self.assertEqual(state["winning_team"], "draw")

    def test_save_roundtrip_at_every_window(self):
        state = make_state()
        for index in range(150):
            restored = Game.deserialize(json.loads(json.dumps(Game.serialize(state))))
            self.assertEqual(state, restored)
            for viewer in ("p0", "p2", "guest"):
                self.assertEqual(Game.get_public_view(state, viewer), Game.get_public_view(restored, viewer))
            actors = [player_id for player_id in state["turn_order"] if Game.get_legal_actions(state, player_id)]
            self.assertTrue(actors)
            player_id = state["current_turn"] if state["current_turn"] in actors else actors[0]
            kind = Game.get_legal_actions(state, player_id)[0]
            if kind == "ready":
                apply(state, player_id, kind)
            elif kind == "witch":
                apply(state, player_id, kind, choice="pass")
            elif kind == "inspect":
                target = next(member_id for member_id in state["turn_order"]
                              if member_id != player_id and state["players"][member_id]["alive"])
                apply(state, player_id, kind, target=target)
            else:
                apply(state, player_id, kind, **({"target": None} if kind in ("guard", "wolf_vote", "vote") else {}))
        self.assertGreater(state["day"], 2)
        for invalid in (None, {}, {**state, "version": 2}, {**state, "turn_order": ["p0"]}, {**state, "phase": "fake"}):
            with self.assertRaises(ValueError):
                Game.deserialize(invalid)

    def test_malformed_save_rejected(self):
        state = make_state()
        _night(state)
        for changes in ({"window_id": True}, {"day": 0}, {"game_token": ""}, {"dealer": "guest"},
                        {"ready": ["guest"]}, {"ready": ["p0", "p0"]}, {"game_over": True},
                        {"win_rule": "parity"}, {"self_save": "always"}, {"night_actors": ["p0"]},
                        {"allow_wolf_self_attack": "true"}, {"allow_wolf_self_attack": 1},
                        {"allow_wolf_self_attack": None}):
            with self.assertRaises(ValueError):
                Game.deserialize({**state, **changes})
        for changes in ({"alive": "yes"}, {"last_guard": "guest"}, {"inspections": [{"target": "guest", "team": "wolves", "day": 1}]}):
            invalid = copy.deepcopy(state)
            invalid["players"]["p7"].update(changes)
            with self.assertRaises(ValueError):
                Game.deserialize(invalid)


class WerewolfBotTests(unittest.TestCase):
    def move(self, state, player_id, kind, **fields):
        previous = copy.deepcopy(state)
        move = Game.bot_move(state, player_id)
        self.assertEqual(move, action(state, kind, **fields))
        self.assertEqual(state, previous)
        self.assertIsNone(Game.apply_action(state, player_id, move)[1])

    def test_default_setup_and_identity_confirmation(self):
        state = Game.init_game({}, [{"player_id": f"p{index}", "is_bot": True} for index in range(6)])
        self.assertIsNone(Game.bot_move(state, "p1"))
        self.assertIsNone(Game.bot_move(state, "guest"))
        self.move(state, "p0", "deal")
        self.move(state, "p0", "ready")
        self.assertIsNone(Game.bot_move(state, "p0"))
        for player_id in state["turn_order"][1:]:
            self.move(state, player_id, "ready")
        self.assertEqual(state["phase"], "night")

    def test_night_defaults_and_duplicate_submissions(self):
        state = make_state()
        all_ready(state, "ready")
        state["players"]["p7"]["last_guard"] = "p7"
        self.move(state, "p7", "guard", target=None)
        self.move(state, "p0", "wolf_vote", target="p2")
        self.assertIsNone(Game.bot_move(state, "p0"))
        self.move(state, "p1", "wolf_vote", target="p2")
        self.move(state, "p3", "witch", choice="pass")
        self.assertTrue(state["players"]["p3"]["save"])
        self.assertTrue(state["players"]["p3"]["poison"])
        self.move(state, "p2", "inspect", target="p0")
        self.assertEqual(state["phase"], "last_words")
        self.move(state, "p2", "end_speech")
        self.assertEqual(state["phase"], "dawn_review")
        for player_id in state["turn_order"][:-1]:
            self.move(state, player_id, "next_round")
            self.assertIsNone(Game.bot_move(state, player_id))
            self.assertEqual(state["phase"], "dawn_review")
        self.move(state, "p8", "next_round")
        self.assertEqual(state["phase"], "discussion")

    def test_debug_wolves_do_not_self_attack_when_allowed(self):
        state = make_state()
        state["allow_wolf_self_attack"] = True
        _night(state)
        self.move(state, "p7", "guard", target=None)
        self.move(state, "p0", "wolf_vote", target="p2")
        self.move(state, "p1", "wolf_vote", target="p2")

    def test_optional_day_skills_wait_for_their_speech(self):
        state = make_state()
        state["players"]["p1"]["role"] = "white_wolf"
        state["players"]["p5"]["role"] = "knight"
        _speeches(state)
        self.assertIsNone(Game.bot_move(state, "p1"))
        self.assertIsNone(Game.bot_move(state, "p5"))
        for player_id in state["turn_order"]:
            self.move(state, player_id, "end_speech")
        self.move(state, "p0", "vote", target="p1")
        self.assertIsNone(Game.bot_move(state, "p0"))
        self.move(state, "p1", "vote", target="p0")

    def test_pk_vote_uses_only_candidates_and_idiot_cannot_vote(self):
        state = make_state()
        state.update(pk_round=True, vote_candidates=["p5", "p6"])
        _phase(state, "vote")
        state["players"]["p8"].update(role="idiot", can_vote=False, revealed=True)
        self.move(state, "p0", "vote", target="p5")
        self.assertIsNone(Game.bot_move(state, "p5"))
        self.assertIsNone(Game.bot_move(state, "p8"))

    def test_dead_bots_skip_death_skill_and_finish_last_words(self):
        for role in ("hunter", "wolf_king"):
            with self.subTest(role=role):
                state = make_state()
                state["players"]["p4"]["role"] = role
                _deaths(state, {"p4": "banished"}, "dusk_review", ["p4"])
                self.move(state, "p4", "shoot", target=None)
                self.move(state, "p4", "end_speech")
                self.move(state, "p4", "next_round")
                self.assertEqual(state["phase"], "dusk_review")

    def test_all_bot_games_finish_with_legal_defaults_and_survive_saves(self):
        tables = [[role for role, count in recommended_roles(size).items() for _ in range(count)]
                  for size in (6, 9, 12, 16)]
        tables.append(["werewolf", "wolf_king", "white_wolf", "seer", "witch", "hunter",
                       "guard", "idiot", "knight", "villager", "villager", "villager"])
        for roles in tables:
            with self.subTest(roles=roles):
                state = make_state(roles)
                for _ in range(1000):
                    state = Game.deserialize(Game.serialize(state))
                    if state["game_over"]:
                        break
                    moves = [(player_id, Game.bot_move(state, player_id)) for player_id in state["turn_order"]]
                    actors = [(player_id, move) for player_id, move in moves if move is not None]
                    self.assertTrue(actors, state["phase"])
                    player_id, move = actors[0]
                    self.assertIsNone(Game.apply_action(state, player_id, move)[1])
                self.assertTrue(state["game_over"])
                self.assertTrue(all(Game.bot_move(state, player_id) is None for player_id in state["turn_order"]))


if __name__ == "__main__":
    unittest.main()
