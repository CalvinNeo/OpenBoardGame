import copy
import json
import unittest
from collections import Counter

from game.red_doors import RedDoorsGame as Game, _bot_from_view, _held, _review, _shuffle
from game.red_doors_data import CARD_DEFS


def players(count=4):
    return [{"player_id": f"p{i}", "name": f"Player {i}", "seat": i, "is_bot": True} for i in range(count)]


class RedDoorsTests(unittest.TestCase):
    def setUp(self):
        self.state = Game.init_game({"seed": 102}, players())

    def card(self, kind, zone="board"):
        return next(c for c in self.state["cards"].values() if c["kind"] == kind and c["zone"] == zone)

    def give(self, kind, pid="p0", faceup=None):
        card = self.card(kind)
        card.update(zone="held", owner=pid, faceup=(kind in ("gun", "vest") if faceup is None else faceup))
        if kind == "killer_key":
            self.state["players"][pid]["killer"] = True
        return card

    def act(self, kind, pid=None, **args):
        events, error = Game.apply_action(self.state, pid or self.state["current_turn"], {"type": kind, **args})
        self.assertIsNone(error, (kind, args, error))
        self.assertEqual(events[0]["payload"], {"actor": pid or events[0]["payload"]["actor"]})
        return events

    def open(self, kind):
        card = self.card(kind)
        self.act("open_door", door_id=card["ref"], board_epoch=self.state["board_epoch"], turn_id=self.state["turn_id"])
        return card["ref"]

    def resolve(self, choice="use"):
        return self.act("resolve_door", choice=choice, effect_id=self.state["pending"]["id"])

    def target(self, target_id):
        self.act("choose_target", target_id=target_id, effect_id=self.state["pending"]["id"])

    def acknowledge(self):
        rid = self.state["review_id"]
        for pid in self.state["turn_order"]:
            if pid not in self.state["ready"]:
                self.act("ack_review", pid=pid, review_id=rid)

    def reject_unchanged(self, action, pid="p0"):
        before = copy.deepcopy(self.state)
        events, error = Game.apply_action(self.state, pid, action)
        self.assertIsNotNone(error)
        self.assertEqual(events, [])
        self.assertEqual(self.state, before)

    def assert_conserved(self):
        self.assertEqual(Counter(c["kind"] for c in self.state["cards"].values()), Counter({k: v["count"] for k, v in CARD_DEFS.items()}))
        self.assertEqual(len({c["ref"] for c in self.state["cards"].values()}), 16)
        for card in self.state["cards"].values():
            self.assertIn(card["zone"], ("board", "held", "removed"))
            self.assertEqual(card["owner"] in self.state["players"], card["zone"] == "held")

    def test_base_deck_config_and_seat_order(self):
        self.assert_conserved()
        self.assertEqual(len(CARD_DEFS), 11)
        self.assertEqual(self.state["current_turn"], "p0")
        for count in (2, 3, 7):
            with self.assertRaises(ValueError):
                Game.init_game({}, players(count))
        for config in ({"level": 40}, {"seed": True}, {"unknown": 1}):
            with self.assertRaises(ValueError):
                Game.init_game(config, players())
        with self.assertRaises(ValueError):
            Game.init_game({}, players()[:3] + [players()[0]])

    def test_open_is_private_and_first_killer_key_cannot_be_ignored(self):
        self.open("killer_key")
        self.assertFalse(self.state["players"]["p0"]["killer"])
        view = Game.get_public_view(self.state, "p0")
        self.assertEqual(view["private"]["choices"], ["use"])
        self.assertEqual(view["private"]["kind"], "killer_key")
        for observer in ("p1", "spectator"):
            public = Game.get_public_view(self.state, observer)
            self.assertEqual(public["phase"], "resolving")
            self.assertIsNone(public["private"])
            self.assertTrue(all(d["kind"] is None and d["known_kind"] is None for d in public["doors"]))
            self.assertNotIn("seed", public)
            self.assertNotIn("cards", public)
        self.reject_unchanged({"type": "resolve_door", "choice": "return", "effect_id": self.state["pending"]["id"]})
        self.resolve()
        self.assertTrue(self.state["players"]["p0"]["killer"])
        self.assertEqual(Game.get_public_view(self.state, "p1")["players"][0]["inventory"][0]["kind"], None)

    def test_hidden_cards_roles_events_and_bot_broadcast_do_not_distinguish_empty_trap(self):
        self.state["players"]["p0"]["killer"] = True
        self.open("trap")
        alternative = copy.deepcopy(self.state)
        current = alternative["pending"]["card"]
        other = next(cid for cid, c in alternative["cards"].items() if c["kind"] == "empty")
        alternative["cards"][current]["kind"], alternative["cards"][other]["kind"] = "empty", "trap"
        alternative["players"]["p0"]["killer"] = False
        alternative["knowledge"]["p0"][alternative["cards"][current]["ref"]] = "empty"
        self.assertEqual(Game.get_public_view(self.state, "p1"), Game.get_public_view(alternative, "p1"))
        a = {"type": "resolve_door", "choice": "return", "effect_id": self.state["pending"]["id"]}
        result1 = Game.apply_action(self.state, "p0", a)
        result2 = Game.apply_action(alternative, "p0", a)
        self.assertEqual(result1, result2)
        self.assertEqual(Game.get_public_view(self.state, "p1"), Game.get_public_view(alternative, "p1"))

    def test_clue_peek_does_not_trigger_role_or_damage_and_restores(self):
        for kind in ("killer_key", "trap", "gas"):
            with self.subTest(kind=kind):
                self.setUp()
                self.open("clue")
                self.resolve()
                target = self.card(kind)["ref"]
                self.target(target)
                self.assertEqual(self.state["phase"], "private_result")
                self.assertTrue(self.state["players"]["p0"]["alive"])
                self.assertFalse(self.state["players"]["p0"]["killer"])
                self.assertEqual(_held(self.state), [])
                self.assertEqual(Game.get_public_view(self.state, "p0")["private"]["result"]["kind"], kind)
                self.assertIsNone(Game.get_public_view(self.state, "p1")["private"])
                self.state = Game.deserialize(json.loads(json.dumps(Game.serialize(self.state))))
                self.act("ack_private", effect_id=self.state["pending"]["id"])
                self.assertEqual(self.state["current_turn"], "p1")
                self.assertFalse(self.card(kind)["faceup"])
                self.assertTrue(self.card("clue")["faceup"])

    def test_gas_returns_inventory_without_resetting_role_and_can_create_second_killer(self):
        self.give("killer_key")
        self.give("gun")
        self.open("gas")
        refs = {c["ref"] for c in self.state["cards"].values()}
        self.resolve()
        self.assertTrue(self.state["players"]["p0"]["killer"])
        self.assertEqual(_held(self.state, "p0"), [])
        self.assertEqual(self.state["board_epoch"], 2)
        self.assertTrue(all(not v for v in self.state["knowledge"].values()))
        self.assertFalse(refs & {c["ref"] for c in self.state["cards"].values() if c["zone"] == "board"})
        self.assertEqual(self.card("gas", "removed")["owner"], None)
        self.acknowledge()
        self.open("killer_key")
        self.resolve()
        self.assertTrue(self.state["players"]["p1"]["killer"])
        self.assertTrue(self.state["players"]["p0"]["killer"])
        self.assert_conserved()

    def test_empty_inventory_gas_still_shuffles_and_turns_public_cards_down(self):
        self.card("clue")["faceup"] = True
        self.open("gas")
        self.resolve()
        self.assertEqual(self.state["board_epoch"], 2)
        self.assertFalse(self.card("clue")["faceup"])

    def test_trap_with_and_without_vest_and_dead_acknowledgement(self):
        for protected in (False, True):
            with self.subTest(protected=protected):
                self.setUp()
                if protected:
                    self.give("vest")
                self.give("silver_key")
                self.give("gun")
                self.open("trap")
                self.resolve()
                self.assertEqual(self.state["players"]["p0"]["alive"], protected)
                self.assertEqual(_held(self.state, "p0"), [])
                self.assertFalse(self.card("trap")["faceup"])
                if protected:
                    self.assertEqual(self.card("vest", "removed")["owner"], None)
                self.assertIn("ack_review", Game.get_legal_actions(self.state, "p0"))
                self.acknowledge()
                self.assertEqual(self.state["current_turn"], "p1")
                self.assert_conserved()

    def test_fourth_key_recovery_is_anonymous_and_identity_persists(self):
        self.give("killer_key", "p1")
        self.give("silver_key", "p2")
        self.give("silver_key", "p3")
        self.open("silver_key")
        self.resolve()
        self.assertEqual(_held(self.state), [])
        self.assertEqual(self.card("killer_key", "removed")["owner"], None)
        self.assertTrue(self.state["players"]["p1"]["killer"])
        view = Game.get_public_view(self.state, "p0")
        self.assertIsNone(view["players"][1]["role"])
        self.assertEqual(view["removed"], {"killer_key": 1})
        self.assertNotIn("Player 1", " ".join(view["review_notes"]))
        self.assertTrue(all(d["known_kind"] is None and d["kind"] is None for d in view["doors"]))
        self.assert_conserved()

    def test_inspect_is_optional_and_requires_other_hidden_key(self):
        self.open("inspect")
        self.assertEqual(Game.get_public_view(self.state, "p0")["private"]["choices"], ["return"])
        self.resolve("return")
        self.assertFalse(self.card("inspect")["faceup"])
        self.give("silver_key", "p2", faceup=True)
        self.give("silver_key", "p1")
        self.open("inspect")
        self.assertEqual(Game.get_public_view(self.state, "p1")["private"]["choices"], ["return"])

    def test_inspect_reveals_silver_or_removes_killer_key_but_not_role(self):
        for kind in ("silver_key", "killer_key"):
            with self.subTest(kind=kind):
                self.setUp()
                key = self.give(kind, "p1")
                self.open("inspect")
                self.resolve()
                self.target(key["ref"])
                self.assertTrue(self.card("inspect")["faceup"])
                view = Game.get_public_view(self.state, "p2")
                if kind == "killer_key":
                    self.assertEqual(view["players"][1]["role"], "killer")
                    self.assertEqual(view["removed"], {"killer_key": 1})
                    self.assertTrue(self.state["players"]["p1"]["killer"])
                else:
                    self.assertEqual(view["players"][1]["inventory"][0]["kind"], "silver_key")
                    self.assertIsNone(view["players"][1]["role"])

    def test_ammo_requires_gun_can_decline_and_self_target_is_allowed(self):
        self.open("ammo")
        self.assertEqual(Game.get_public_view(self.state, "p0")["private"]["choices"], ["return"])
        self.resolve("return")
        self.give("gun", "p1")
        self.open("ammo")
        self.assertEqual(set(Game.get_public_view(self.state, "p1")["private"]["choices"]), {"return", "use"})
        self.resolve()
        self.target("p1")
        self.assertFalse(self.state["players"]["p1"]["alive"])
        self.assertEqual(self.card("gun")["zone"], "board")

    def test_shot_returns_victim_inventory_and_reloads_maze_but_shooter_keeps_gun(self):
        for protected in (False, True):
            with self.subTest(protected=protected):
                self.setUp()
                self.give("gun")
                self.give("killer_key", "p1")
                if protected:
                    self.give("vest", "p1")
                self.open("ammo")
                self.resolve()
                self.target("p1")
                self.assertEqual(self.state["players"]["p1"]["alive"], protected)
                self.assertTrue(self.state["players"]["p1"]["killer"])
                self.assertEqual(self.card("gun", "held")["owner"], "p0")
                self.assertEqual(self.card("killer_key")["owner"], None)
                self.assertFalse(self.card("ammo")["faceup"])
                self.assert_conserved()

    def test_exit_can_be_revisited_and_cannot_escape_with_too_few_keys(self):
        ref = self.open("exit")
        self.reject_unchanged({"type": "resolve_door", "choice": "escape", "effect_id": self.state["pending"]["id"]})
        self.resolve("return")
        self.assertEqual(self.open("exit"), ref)
        self.assertFalse(self.card("exit")["faceup"])

    def test_escape_winners_include_dead_members_of_winning_side(self):
        for failed in (False, True):
            with self.subTest(failed=failed):
                self.setUp()
                self.state["players"]["p3"].update(killer=failed, alive=False)
                self.give("silver_key", "p0")
                self.give("silver_key", "p1")
                self.give("killer_key" if failed else "silver_key", "p2")
                self.open("exit")
                self.resolve("escape")
                self.assertEqual(self.state["phase"], "round_end")
                self.assertFalse(self.state["game_over"])
                self.assertIn("p3", self.state["winner"])
                self.assertEqual(self.state["ending_reason"], "tainted_escape" if failed else "silver_escape")
                self.assertTrue(all(p["role"] for p in Game.get_public_view(self.state, "spectator")["players"]))

    def test_only_civilian_continues_then_late_killer_key_wins(self):
        for pid in ("p1", "p2", "p3"):
            self.state["players"][pid]["alive"] = False
        self.open("empty")
        self.resolve("return")
        self.assertEqual(self.state["phase"], "choose_door")
        self.open("killer_key")
        self.resolve()
        self.assertEqual(self.state["winner"], ["p0"])
        self.assertEqual(self.state["ending_reason"], "sole_killer")

    def test_two_killers_continue_and_all_dead_has_no_winner(self):
        for pid in ("p0", "p1"):
            self.state["players"][pid]["killer"] = True
        for pid in ("p2", "p3"):
            self.state["players"][pid]["alive"] = False
        self.open("empty")
        self.resolve("return")
        self.assertEqual(self.state["phase"], "choose_door")
        self.setUp()
        for pid in ("p1", "p2", "p3"):
            self.state["players"][pid]["alive"] = False
        self.open("trap")
        self.resolve()
        self.assertEqual((self.state["ending_reason"], self.state["winner"]), ("all_dead", []))

    def test_review_requires_every_seat_rejects_duplicate_and_stale_ack(self):
        self.open("trap")
        self.resolve()
        rid = self.state["review_id"]
        for pid in ("p0", "p1", "p2"):
            self.act("ack_review", pid=pid, review_id=rid)
        self.assertEqual(self.state["phase"], "public_review")
        self.reject_unchanged({"type": "ack_review", "review_id": rid})
        self.reject_unchanged({"type": "ack_review", "review_id": "old"}, pid="p3")
        self.act("ack_review", pid="p3", review_id=rid)
        self.assertEqual(self.state["phase"], "choose_door")

    def test_finish_mode_changes_invalidate_votes_and_replay_resets_roles(self):
        _review(self.state, "all_dead", [])
        old = self.state["review_id"]
        self.act("next_round", review_id=old)
        self.act("set_next_mode", pid="p1", mode="finish", review_id=old)
        self.assertEqual(self.state["ready"], [])
        self.reject_unchanged({"type": "next_round", "review_id": old})
        for pid in self.state["turn_order"]:
            self.act("next_round", pid=pid, review_id=self.state["review_id"])
        self.assertTrue(self.state["game_over"])
        self.assertEqual(Game.get_legal_actions(self.state, "p0"), [])
        self.setUp()
        self.state["players"]["p2"]["killer"] = True
        _review(self.state, "sole_killer", ["p2"])
        for pid in self.state["turn_order"]:
            self.act("next_round", pid=pid, review_id=self.state["review_id"])
        self.assertEqual((self.state["round"], self.state["phase"]), (2, "choose_door"))
        self.assertFalse(any(p["killer"] for p in self.state["players"].values()))
        self.assertGreater(self.state["board_epoch"], 1)

    def test_invalid_and_stale_actions_are_atomic(self):
        ref = self.card("empty")["ref"]
        good = {"type": "open_door", "door_id": ref, "board_epoch": 1, "turn_id": 1}
        for bad in (None, {}, {**good, "x": 1}, {**good, "turn_id": True}, {**good, "board_epoch": 8}, {**good, "door_id": "silver_key:0"}):
            self.reject_unchanged(bad)
        self.reject_unchanged(good, pid="p1")
        self.reject_unchanged(good, pid="spectator")
        self.card("empty")["faceup"] = True
        self.reject_unchanged(good)
        self.card("empty")["faceup"] = False
        self.open("empty")
        old = self.state["pending"]["id"]
        self.resolve("return")
        self.open("empty")
        self.reject_unchanged({"type": "resolve_door", "choice": "return", "effect_id": old}, pid="p1")

    def test_save_roundtrip_every_live_phase_and_reject_corruption(self):
        snapshots = [copy.deepcopy(self.state)]
        self.open("clue")
        snapshots.append(copy.deepcopy(self.state))
        self.resolve()
        snapshots.append(copy.deepcopy(self.state))
        self.target(self.card("trap")["ref"])
        snapshots.append(copy.deepcopy(self.state))
        self.act("ack_private", effect_id=self.state["pending"]["id"])
        self.open("trap")
        self.resolve()
        snapshots.append(copy.deepcopy(self.state))
        _review(self.state, "all_dead", [])
        snapshots.append(copy.deepcopy(self.state))
        for snapshot in snapshots:
            restored = Game.deserialize(json.loads(json.dumps(Game.serialize(snapshot))))
            self.assertEqual(restored, snapshot)
            for pid in snapshot["turn_order"] + ["spectator"]:
                self.assertEqual(Game.get_public_view(restored, pid), Game.get_public_view(snapshot, pid))
        for field, value in (("schema_version", 99), ("cards", {}), ("ready", ["p0", "p0"])):
            corrupt = copy.deepcopy(self.state)
            corrupt[field] = value
            with self.assertRaises(ValueError):
                Game.deserialize(corrupt)

    def test_bot_is_invariant_to_opponent_secrets(self):
        other = copy.deepcopy(self.state)
        other["players"]["p2"]["killer"] = True
        kinds = [c["kind"] for c in other["cards"].values()][::-1]
        for card, kind in zip(other["cards"].values(), kinds):
            card["kind"] = kind
        self.assertEqual(Game.get_public_view(self.state, "p0"), Game.get_public_view(other, "p0"))
        self.assertEqual(Game.bot_move(self.state, "p0"), Game.bot_move(other, "p0"))
        self.assertEqual(_bot_from_view(Game.get_public_view(self.state, "p0")), Game.bot_move(self.state, "p0"))

    def test_inventory_and_inspection_order_cannot_reveal_internal_card_order(self):
        self.give("silver_key", "p1")
        self.give("killer_key", "p1")
        self.give("silver_key", "p2")
        for phase in ("choose_door", "choose_target"):
            if phase == "choose_target":
                self.open("inspect")
                self.resolve()
            alternative = copy.deepcopy(self.state)
            alternative["cards"] = dict(reversed(list(alternative["cards"].items())))
            self.assertEqual(Game.get_public_view(self.state, "p0"), Game.get_public_view(alternative, "p0"))
            self.assertEqual(Game.bot_move(self.state, "p0"), Game.bot_move(alternative, "p0"))

    def test_bots_finish_sixty_seeded_games_without_artificial_turn_limit(self):
        endings = set()
        for count in (4, 5, 6):
            for seed in range(20):
                self.state = Game.init_game({"seed": seed}, players(count))
                for _ in range(1500):
                    if self.state["phase"] == "round_end":
                        break
                    for pid in self.state["turn_order"]:
                        action = Game.bot_move(self.state, pid)
                        if action:
                            _, error = Game.apply_action(self.state, pid, action)
                            self.assertIsNone(error, (count, seed, action, error))
                            break
                    else:
                        self.fail(("deadlock", count, seed, self.state["phase"]))
                    self.assert_conserved()
                else:
                    self.fail(("did not finish", count, seed))
                endings.add(self.state["ending_reason"])
                Game.deserialize(Game.serialize(self.state))
        self.assertEqual(endings, {"tainted_escape", "silver_escape", "sole_killer", "all_dead"})


if __name__ == "__main__":
    unittest.main()
