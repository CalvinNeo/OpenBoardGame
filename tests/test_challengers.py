import copy
import json
import unittest
from collections import Counter

from game.challengers import (
    ChallengersGame as Game, ROBOT_ID, _begin_match, _card_view, _discard,
    _draw_market, _end_match, _flag_effect, _immediate, _loss_effect, _new_card, _pump, _reveal, _start_round,
    card_power, validate_state,
)
from game.challengers_ai import choose_action, trim_deck
from game.challengers_data import CARDS, ROUND_OPTIONS, SETS, TROPHY_VALUES


def new_game(count=2, seed=124, **config):
    return Game.init_game({"seed": seed, **config}, [
        {"player_id": f"p{i}", "name": f"Player {i}", "seat": i, "is_bot": True}
        for i in range(count)
    ])


def action(state, pid, kind, **kwargs):
    return {"type": kind, "round": state["round"], "revision": state["players"][pid]["revision"], **kwargs}


def act(state, pid, kind, **kwargs):
    events, error = Game.apply_action(state, pid, action(state, pid, kind, **kwargs))
    if error:
        raise AssertionError(error)
    return events


def battlefield(left=None, right=None, round_number=3):
    """Use tiny controlled decks while preserving the engine's zone invariants."""
    state = new_game()
    state["round"] = round_number
    for player in state["players"].values():
        for uid in player["deck"] + player["offer"]:
            _discard(state, uid)
        player.update(deck=[], offer=[], stage="match", choice=None)
    match = {"id": 0, "seats": ["p0", "p1"], "status": "playing", "holder": "p1", "turn": "p0",
             "lanes": {}, "pending": None, "queue": [], "winner": None, "reason": None,
             "log": [], "trophy": TROPHY_VALUES[round_number - 1][0]}
    for pid, spec in (("p0", left or {}), ("p1", right or {"field": ["champion"], "draw": ["dog"]})):
        lane = {"draw": [], "field": [], "bench": [], "exhaust": [], "next_attack_bonus": 0}
        for zone in ("draw", "field", "bench", "exhaust"):
            for raw in spec.get(zone, []):
                kind, level = raw if isinstance(raw, tuple) else (raw, None)
                uid = _new_card(state, kind, level)
                state["players"][pid]["deck"].append(uid)
                lane[zone].append({"id": uid, "bonus": 0, "attack_bonus": 0} if zone == "field" else uid)
        match["lanes"][pid] = lane
    state["matches"] = [match]
    return state


def substitute_robot(state):
    state["order"] = ["p0"]
    state["players"][ROBOT_ID] = state["players"].pop("p1")
    state["players"][ROBOT_ID]["name"] = "Robot"
    state["schedule"] = [[["p0", ROBOT_ID]] for _ in range(7)]
    match = state["matches"][0]
    match["seats"] = ["p0", ROBOT_ID]
    match["lanes"][ROBOT_ID] = match["lanes"].pop("p1")
    match["holder"] = ROBOT_ID if match["holder"] == "p1" else match["holder"]
    match["turn"] = ROBOT_ID if match["turn"] == "p1" else match["turn"]


class ChallengersRulesTests(unittest.TestCase):
    def test_base_box_counts_levels_and_starters(self):
        market = [c for c in CARDS.values() if c["set"] != "robot" and c["level"] in "ABC"]
        self.assertEqual(sum(c["copies"] for c in market), 260)
        self.assertEqual(sum(c["copies"] for c in CARDS.values() if c["set"] == "robot"), 19)
        self.assertEqual(sum(c["copies"] for c in CARDS.values() if c["level"] == "R"), 8)
        for theme in SETS:
            if theme not in ("city", "robot"):
                self.assertEqual(sum(c["copies"] for c in market if c["set"] == theme), 40, theme)
        state = new_game(8, exclude_set="space")
        self.assertEqual(state["sets"], [s for s in SETS if s not in ("space", "robot")])
        for player in state["players"].values():
            self.assertEqual(Counter(state["cards"][cid]["kind"] for cid in player["deck"]),
                             {"newcomer": 3, "talent": 1, "dog": 1, "champion": 1})
            self.assertTrue(all(state["cards"][c]["level"] == "S" for c in player["deck"]))
        validate_state(state)

    def test_config_rejects_non_objects_and_invalid_levels(self):
        players = [{"player_id": "p0"}]
        for config in ([], False, "", {"robot_level": True}, {"robot_level": 0}, {"exclude_set": "city"}):
            with self.subTest(config=config), self.assertRaises(ValueError):
                Game.init_game(config, players)

    def test_extra_pick_payments_and_declining(self):
        for kind, count in (("shapeshifter", 1), ("scifi_geek", 2)):
            for pay in (False, True):
                with self.subTest(card=kind, pay=pay):
                    state = new_game()
                    player = state["players"]["p0"]
                    for uid in player["offer"]:
                        _discard(state, uid)
                    extra = _new_card(state, "rescue_pod")
                    player["deck"].append(extra)
                    uid = _new_card(state, kind)
                    player.update(offer=[uid, _new_card(state, "clones"), _new_card(state, "cow")], picks_left=1)
                    act(state, "p0", "pick", card_id=uid)
                    choice = state["players"]["p0"]["choice"]
                    self.assertEqual(choice["max"], count)
                    selected = ([extra] if count == 1 else [extra, uid]) if pay else []
                    act(state, "p0", "resolve", card_ids=selected)
                    player = state["players"]["p0"]
                    self.assertEqual(player["picks_left"], 1 if pay else 0)
                    if pay:
                        self.assertTrue(set(selected).isdisjoint(player["deck"]))
                        act(state, "p0", "pick", card_id=player["offer"][0])
                        self.assertEqual(state["players"]["p0"]["fans"], 1)
                    self.assertEqual(state["players"]["p0"]["stage"], "trim")
                    validate_state(state)

    def test_draft_redraw_once_and_private_choice(self):
        state = new_game()
        offer = list(state["players"]["p0"]["offer"])
        act(state, "p0", "pick", card_id=offer[0])
        if state["players"]["p0"]["choice"]:
            act(state, "p0", "resolve", card_ids=[])
        self.assertEqual(len(state["players"]["p0"]["offer"]), 4)
        act(state, "p0", "redraw")
        self.assertEqual(len(state["players"]["p0"]["offer"]), 4)
        self.assertFalse(set(offer) & set(state["players"]["p0"]["offer"]))
        before = copy.deepcopy(state)
        self.assertIsNotNone(Game.apply_action(state, "p0", action(state, "p0", "redraw"))[1])
        self.assertEqual(before, state)
        view = Game.get_public_view(state, "p1")
        self.assertNotIn(offer[0], json.dumps(view))
        self.assertNotIn("rng", view)
        self.assertNotIn("seed", view["config"])
        self.assertEqual(Game.get_public_view(state, "spectator")["offer"], [])

    def test_duplicate_stale_and_foreign_actions_are_atomic(self):
        state = new_game()
        old_action = action(state, "p0", "pick", card_id=state["players"]["p0"]["offer"][0])
        self.assertIsNone(Game.apply_action(state, "p0", old_action)[1])
        before = copy.deepcopy(state)
        self.assertIsNotNone(Game.apply_action(state, "p0", old_action)[1])
        self.assertEqual(before, state)
        for bad in ({"type": "reveal"}, action(state, "p0", "pick", card_id="not-owned"),
                    action(state, "p0", "pick", card_id=state["players"]["p1"]["offer"][0]),
                    {**old_action, "round": True}):
            self.assertIsNotNone(Game.apply_action(state, "p0", bad)[1])
            self.assertEqual(before, state)

    def test_eight_seats_meet_each_other_and_parks_start_independently(self):
        state = new_game(8)
        seen = Counter(tuple(sorted(pair)) for row in state["schedule"] for pair in row)
        self.assertEqual(len(seen), 28)
        self.assertEqual(set(seen.values()), {1})
        seats = state["matches"][0]["seats"]
        for pid in seats:
            while state["players"][pid]["stage"] != "ready" and state["matches"][0]["status"] == "waiting":
                candidate = Game.bot_move(state, pid)
                self.assertIsNotNone(candidate)
                self.assertIsNone(Game.apply_action(state, pid, candidate)[1])
        self.assertEqual(state["matches"][0]["status"], "playing")
        self.assertTrue(all(m["status"] == "waiting" for m in state["matches"][1:]))

    def test_attack_adds_up_but_only_last_card_defends(self):
        state = battlefield({"draw": ["talent", "talent", "dog"]})
        act(state, "p0", "reveal")
        self.assertEqual(state["matches"][0]["holder"], "p1")
        act(state, "p0", "reveal")
        match = state["matches"][0]
        self.assertEqual(match["holder"], "p0")
        self.assertEqual(len(match["lanes"]["p0"]["field"]), 2)
        self.assertEqual(Game.get_public_view(state, "p0")["matches"][0]["lanes"]["p0"]["power"], 2)
        act(state, "p1", "reveal")
        self.assertEqual(len(state["matches"][0]["lanes"]["p0"]["bench"]), 2)

    def test_attacker_with_last_card_can_still_win(self):
        state = battlefield({"draw": ["horse"]}, {"field": ["champion"]})
        act(state, "p0", "reveal")
        self.assertEqual(state["matches"][0]["winner"], "p0")
        self.assertEqual(state["matches"][0]["reason"], "deck_empty")

    def test_same_name_levels_share_one_bench_seat_and_seventh_loses(self):
        bench = ["dog", "cat", "pig", "pony", "parrot", "spider"]
        state = battlefield({"draw": ["horse"]}, {"field": [("dog", "S")], "bench": bench, "draw": ["horse"]})
        act(state, "p0", "reveal")
        self.assertEqual(state["matches"][0]["status"], "playing")
        view = Game.get_public_view(state, "p0")["matches"][0]
        self.assertEqual(view["lanes"]["p1"]["bench_count"], 6)
        state = battlefield({"draw": ["horse"]}, {"field": ["talent"], "bench": bench, "draw": ["horse"]})
        act(state, "p0", "reveal")
        self.assertEqual(state["matches"][0]["reason"], "bench_full")
        self.assertEqual(state["matches"][0]["winner"], "p0")

    def test_bench_auras_stack_and_attack_bonus_expires(self):
        state = battlefield({"field": ["gangster"], "bench": ["director", "director", "makeup_artist", "bard", "cook"]})
        match = state["matches"][0]
        entry = match["lanes"]["p0"]["field"][0]
        self.assertEqual(card_power(state, match, "p0", entry, True), 7)
        self.assertEqual(card_power(state, match, "p0", entry, False), 3)
        state = battlefield({"field": ["skeleton"], "bench": ["ai", "ai"]})
        match = state["matches"][0]
        self.assertEqual(card_power(state, match, "p0", match["lanes"]["p0"]["field"][0], False), 5)

    def test_immediate_bonus_is_a_snapshot(self):
        state = battlefield({"field": ["stable_boy"], "bench": ["dog", "cat"]})
        match = state["matches"][0]
        entry = match["lanes"]["p0"]["field"][0]
        _immediate(state, match, "p0", entry["id"])
        self.assertEqual(entry["bonus"], 2)
        match["lanes"]["p0"]["bench"].clear()
        self.assertEqual(card_power(state, match, "p0", entry, False), 4)

    def test_prince_rescue_and_comic_loss_effects(self):
        for kind in ("prince", "rescue_pod", "comic_character"):
            with self.subTest(kind=kind):
                state = battlefield({"draw": ["dragon", "dog"]}, {"field": [kind], "draw": ["pig", "dog"]})
                lost = state["matches"][0]["lanes"]["p1"]["field"][0]["id"]
                act(state, "p0", "reveal")
                lane = state["matches"][0]["lanes"]["p1"]
                if kind == "prince":
                    self.assertIn(lost, lane["exhaust"])
                    self.assertNotIn(lost, lane["bench"])
                elif kind == "rescue_pod":
                    self.assertNotIn(lost, state["players"]["p1"]["deck"])
                    self.assertEqual(state["cards"][lane["exhaust"][0]]["level"], "B")
                else:
                    act(state, "p1", "reveal")
                    self.assertEqual(state["matches"][0]["lanes"]["p1"]["field"][0]["attack_bonus"], 2)
                validate_state(state)

    def test_cowboy_benches_without_triggering_revealed_effect(self):
        state = battlefield({"draw": ["cowboy", "dog"]}, {"field": ["newcomer"], "draw": ["ghost", "champion"]})
        act(state, "p0", "reveal")
        match = state["matches"][0]
        self.assertEqual(len(match["lanes"]["p0"]["draw"]), 1)
        self.assertIn("ghost", [state["cards"][uid]["kind"] for uid in match["lanes"]["p1"]["bench"]])

    def test_mandatory_recover_uses_printed_base_and_level(self):
        for source, expected in (("necromancer", {"talent"}), ("vampire", {"dog", "knight"})):
            state = battlefield({"draw": [source, "horse"], "bench": [("dog", "S"), "dog", "talent", "knight"]})
            act(state, "p0", "reveal")
            choice = Game.get_public_view(state, "p0")["choice"]
            self.assertEqual({card["kind"] for card in choice["cards"]}, expected)
            self.assertTrue(all(card["level"] != "S" for card in choice["cards"]))
            before = copy.deepcopy(state)
            self.assertIsNotNone(Game.apply_action(state, "p0", action(state, "p0", "resolve", card_ids=[]))[1])
            self.assertEqual(before, state)
            act(state, "p0", "resolve", card_ids=[choice["cards"][0]["id"]])
            validate_state(state)

    def test_butler_can_remove_individual_duplicates(self):
        state = battlefield({"draw": ["butler", "dog"], "bench": ["cat", "cat", "pig"]})
        act(state, "p0", "reveal")
        choice = Game.get_public_view(state, "p0")["choice"]
        cats = [c["id"] for c in choice["cards"] if c["kind"] == "cat"]
        act(state, "p0", "resolve", card_ids=cats)
        lane = state["matches"][0]["lanes"]["p0"]
        self.assertEqual(lane["exhaust"], cats)
        self.assertEqual(len(lane["bench"]), 1)

    def test_private_top_order_and_split_preserve_rest(self):
        for kind in ("juggler", "reporter", "sailor"):
            state = battlefield({"draw": [kind, "cat", "pig", "pony", "dog"]})
            act(state, "p0", "reveal")
            choice = Game.get_public_view(state, "p0")["choice"]
            self.assertIsNotNone(choice)
            self.assertIsNone(Game.get_public_view(state, "p1")["choice"])
            self.assertEqual(Game.get_public_view(state, "p0")["deck"], [])
            order = list(state["matches"][0]["lanes"]["p0"]["draw"])
            if kind == "juggler":
                select = list(reversed(order[:3]))
                expected = select + order[3:]
            elif kind == "reporter":
                select = [order[1]]
                expected = [order[1]] + order[2:] + [order[0]]
            else:
                select = [order[0]]
                expected = order[1:] + order[:1]
            act(state, "p0", "resolve", card_ids=select)
            self.assertEqual(state["matches"][0]["lanes"]["p0"]["draw"], expected)

    def test_generated_cards_stay_secret_until_revealed(self):
        for kind in ("ufo", "villain", "hologram", "robogram"):
            state = battlefield({"draw": [kind, "dog"]}, {"field": ["dragon"], "draw": ["horse", "pig"]})
            target = "p1" if kind in ("hologram", "robogram") else "p0"
            before = set(state["players"][target]["deck"])
            act(state, "p0", "reveal")
            added = set(state["players"][target]["deck"]) - before
            self.assertEqual(len(added), 2 if kind == "ufo" else 1)
            for pid in ("p0", "p1", "watcher"):
                public = json.dumps(Game.get_public_view(state, pid))
                for uid in added:
                    self.assertNotIn(f'"{uid}"', public)
            validate_state(state)

    def test_all_reveal_effects_have_legal_resolutions(self):
        # Includes Robot choices made by its opponent, every aura, and every optional target.
        for kind in CARDS:
            with self.subTest(card=kind):
                state = battlefield({"draw": [kind, "cat", "pig", "pony", "dog"],
                                     "bench": ["newcomer", "talent", "horse", "ai", "skeleton"]},
                                    {"field": ["villain"], "draw": ["dog", "talent", "pig"],
                                     "bench": ["newcomer", "talent", "horse", "vendor"]})
                act(state, "p0", "reveal")
                for _ in range(4):
                    pending = state["matches"][0]["pending"]
                    if not pending:
                        break
                    pid = pending["player_id"]
                    candidate = Game.bot_move(state, pid)
                    self.assertEqual(candidate["type"], "resolve")
                    self.assertIsNone(Game.apply_action(state, pid, candidate)[1])
                self.assertIsNone(state["matches"][0]["pending"])
                validate_state(state)

    def test_market_refills_and_skips_exhausted_supply(self):
        state = new_game()
        pile = state["market"]["C"]
        state["discards"]["C"] = pile
        state["market"]["C"] = []
        taken = _draw_market(state, "C", 3)
        self.assertEqual(len(taken), 3)
        self.assertEqual(state["discards"]["C"], [])
        state["market"]["C"] = []
        self.assertEqual(_draw_market(state, "C", 1), [])

    def test_round_barrier_and_finalists(self):
        state = new_game(4)
        while state["phase"] != "round_end":
            for pid in state["order"]:
                if state["phase"] == "round_end":
                    break
                candidate = Game.bot_move(state, pid)
                if candidate:
                    self.assertIsNone(Game.apply_action(state, pid, candidate)[1])
        before_matches = copy.deepcopy(state["matches"])
        for pid in state["order"][:-1]:
            act(state, pid, "next_round")
        self.assertEqual(state["phase"], "round_end")
        self.assertEqual(state["matches"], before_matches)
        act(state, state["order"][-1], "next_round")
        self.assertEqual(state["round"], 2)
        self.assertEqual(state["phase"], "round")
        state["round"] = 8
        state["finalists"] = ["p0", "p2"]
        _start_round(state)
        self.assertEqual(state["players"]["p0"]["stage"], "trim")
        self.assertEqual(Game.get_legal_actions(state, "p1"), [])
        self.assertEqual(state["players"]["p0"]["offer"], [])

    def test_two_player_early_win_and_multiplayer_trophy_privacy(self):
        state = battlefield({"draw": ["horse"]}, {"field": ["champion"]})
        state["players"]["p0"]["fans"] = 10
        act(state, "p0", "reveal")
        self.assertTrue(state["game_over"])
        self.assertEqual(state["winner"], ["p0"])
        state = new_game(3)
        state["players"]["p0"]["trophies"] = [{"round": 1, "fans": 3}]
        own = next(p for p in Game.get_public_view(state, "p0")["players"] if p["player_id"] == "p0")
        other = next(p for p in Game.get_public_view(state, "p1")["players"] if p["player_id"] == "p0")
        self.assertEqual(own["total"], 3)
        self.assertIsNone(other["total"])
        self.assertIsNone(other["trophies"][0]["fans"])

    def test_robot_levels_and_multiplayer_non_scoring(self):
        for level in range(1, 6):
            state = new_game(1, robot_level=level, solo_special=True)
            robot = state["players"][ROBOT_ID]
            self.assertEqual(len(robot["deck"]), 9 if level == 5 else 8)
            self.assertEqual(sum(state["cards"][uid]["kind"] == "cyborg" for uid in robot["deck"]), 4)
            validate_state(state)

    def test_robot_upgrade_pool_preserves_duplicate_cards(self):
        saw_duplicate = False
        for seed in range(20):
            state = new_game(1, seed=seed, robot_level=5)
            kinds = Counter(state["cards"][uid]["kind"] for uid in state["players"][ROBOT_ID]["deck"])
            for kind, count in kinds.items():
                self.assertLessEqual(count, CARDS[kind]["copies"])
            saw_duplicate |= kinds["virtual_ghost"] == 2 or kinds["robo_knight"] == 2
        self.assertTrue(saw_duplicate)

    def test_hologram_robot_addition_cannot_deadlock_on_a_choice(self):
        state = battlefield({"draw": ["hologram", "horse"]},
                            {"field": ["alpha"], "draw": ["cyborg", "good_bot"], "bench": ["beta"]})
        substitute_robot(state)
        added = _new_card(state, "necromancer")
        state["market"]["B"].insert(0, added)
        act(state, "p0", "reveal")
        match = state["matches"][0]
        self.assertIsNone(match["pending"])
        self.assertEqual(Game.get_legal_actions(state, "p0"), ["reveal"])
        self.assertIn(added, state["players"][ROBOT_ID]["deck"])
        cards = Game.get_public_view(state, "p0")["matches"][0]["lanes"][ROBOT_ID]["field"]
        self.assertEqual(next(c for c in cards if c["id"] == added)["effect"], "none")
        validate_state(state)
        state["round"] = 4
        _start_round(state)
        self.assertIn(added, state["players"][ROBOT_ID]["deck"])

    def test_robot_ignores_normal_card_auras_and_flag_effects(self):
        for kind in ("gangster", "skeleton", "prince", "cowboy", "clown", "heroine", "clairvoyant"):
            with self.subTest(card=kind):
                state = battlefield({"draw": ["dog"]},
                                    {"field": [kind], "draw": ["cyborg", "good_bot"], "bench": ["bard", "cook"]})
                substitute_robot(state)
                match = state["matches"][0]
                uid = match["lanes"][ROBOT_ID]["field"][0]["id"]
                before = copy.deepcopy(state)
                _immediate(state, match, ROBOT_ID, uid)
                _flag_effect(state, match, ROBOT_ID)
                _loss_effect(state, match, ROBOT_ID)
                self.assertEqual(state, before)
                entry = match["lanes"][ROBOT_ID]["field"][0]
                for attacking in (True, False):
                    self.assertEqual(card_power(state, match, ROBOT_ID, entry, attacking), CARDS[kind]["power"])

    def test_finalists_tiebreak_then_final_winner_overrides_fans(self):
        state = new_game(4)
        state["round"] = 7
        state["players"]["p0"].update(fans=20, trophies=[])
        state["players"]["p1"].update(fans=18, trophies=[{"round": 1, "fans": 2}])
        state["players"]["p3"].update(fans=16, trophies=[{"round": 1, "fans": 2}, {"round": 2, "fans": 2}])
        # The final award raises p2 to 20; all four now tie on fans.
        state["players"]["p2"].update(fans=11, trophies=[])
        for match in state["matches"]:
            match["status"] = "done"
        match = state["matches"][0]
        match.update(seats=["p0", "p2"], trophy=9)
        _end_match(state, match, "p2", "deck_empty")
        self.assertEqual(state["finalists"], ["p3", "p2"])
        state["round"] = 8
        _start_round(state)
        state["players"]["p3"]["fans"] = 100
        _end_match(state, state["matches"][0], "p2", "deck_empty")
        self.assertEqual(state["winner"], ["p2"])
        self.assertTrue(state["game_over"])

    def test_save_roundtrip_isolated_and_corruption_rejected(self):
        state = new_game(3)
        restored = Game.deserialize(json.loads(json.dumps(Game.serialize(state))))
        self.assertEqual(restored, state)
        uid = restored["players"]["p0"]["deck"][0]
        restored["players"]["p1"]["deck"].append(uid)
        with self.assertRaises(ValueError):
            Game.deserialize(restored)
        self.assertNotEqual(restored, state)
        view = Game.get_public_view(state, "p0")
        view["deck"].clear()
        self.assertEqual(len(state["players"]["p0"]["deck"]), 6)


class ChallengersAITests(unittest.TestCase):
    def test_deterministic_complete_tournaments_and_saves(self):
        for seed, count in ((1, 1), (9, 2), (17, 3), (26, 4), (44, 5), (56, 6), (73, 7), (124, 8)):
            with self.subTest(seed=seed, count=count):
                state = new_game(count, seed=seed, robot_level=3)
                steps = 0
                while not state["game_over"] and steps < 2200:
                    moved = False
                    for pid in state["order"]:
                        view = Game.get_public_view(state, pid)
                        candidate = choose_action(view)
                        if candidate:
                            self.assertIsNone(Game.apply_action(state, pid, candidate)[1])
                            moved = True
                            steps += 1
                    self.assertTrue(moved, state["phase"])
                    validate_state(state)
                    if steps % 29 == 0:
                        state = Game.deserialize(json.loads(json.dumps(state)))
                self.assertTrue(state["game_over"])
                self.assertTrue(state["winner"])
                if count > 2:
                    self.assertEqual(state["round"], 8)
                    self.assertNotIn(ROBOT_ID, state["finalists"])
                    if ROBOT_ID in state["players"]:
                        self.assertEqual(state["players"][ROBOT_ID]["trophies"], [])

    def test_ai_does_not_mutate_or_use_hidden_information(self):
        state = new_game(3)
        before = copy.deepcopy(state)
        candidate = Game.bot_move(state, "p0")
        self.assertEqual(before, state)
        for pile in state["market"].values():
            pile.reverse()
        state["rng"] = new_game(seed=9)["rng"]
        state["players"]["p1"]["offer"].reverse()
        self.assertEqual(candidate, Game.bot_move(state, "p0"))

    def test_trim_respects_synergies_and_controls_bench_risk(self):
        state = new_game()
        cards = [_card_view(state, _new_card(state, kind)) for kind in
                 ["vendor", "vendor", "pony", "rubber_duck", "teddy_bear", "illusionist", "clown", "dog", "talent", "newcomer"]]
        kept = trim_deck(cards, 7)
        self.assertEqual(sum(c["kind"] == "vendor" for c in kept), 2)
        self.assertLessEqual(len({c["kind"] for c in kept}), 7)
        self.assertNotIn("talent", {c["kind"] for c in kept})


if __name__ == "__main__":
    unittest.main()
