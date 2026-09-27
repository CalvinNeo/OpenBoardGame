import copy
import json
import unittest
from collections import Counter

from game import dune_imperium as rules
from game.dune_imperium import DuneImperiumGame as Game, legal_moves
from game.dune_imperium_ai import choose_move
from game.dune_imperium_data import CARDS, CONFLICTS, FACTIONS, INTRIGUES, MARKET, RESERVE, effect, gain, influence


def act(state, pid, action):
    events, error = Game.apply_action(state, pid, action)
    if error:
        raise AssertionError((pid, action, error))
    return events


def playing(count=3, seed=4, leaders=None):
    state = Game.init_game({"seed": seed}, [{"player_id": str(i), "name": "Player " + str(i), "seat": i} for i in range(count)])
    state["first"], state["current_turn"] = 0, str(count - 1)
    leaders = leaders or ["paul", "leto", "rabban", "helena"]
    while state["phase"] == "leader":
        pid = state["current_turn"]
        act(state, pid, {"type": "leader", "leader": leaders[int(pid)]})
    if state["phase"] == "baron":
        act(state, state["current_turn"], {"type": "baron", "factions": ["guild", "fremen"]})
    return state


def give(state, pid, kind, zone="hand"):
    uid = next(u for u, k in state["cards"].items() if k == kind)
    for p in state["players"].values():
        for key in ("hand", "deck", "discard", "played", "revealed", "reserved"):
            if uid in p[key]:
                p[key].remove(uid)
    for stack in [state["market"], state["market_deck"], state["trashed"]] + list(state["reserve"].values()):
        if uid in stack:
            stack.remove(uid)
    state["players"][pid][zone].append(uid)
    return uid


def intrigue(state, pid, kind):
    uid = next(u for u, k in state["intrigue_cards"].items() if k == kind)
    for stack in [state["intrigue_deck"], state["intrigue_discard"]] + [p["intrigues"] for p in state["players"].values()]:
        if uid in stack:
            stack.remove(uid)
    state["players"][pid]["intrigues"].append(uid)
    return uid


def settle(state):
    for _ in range(150):
        if state["choice"]:
            c = state["choice"]
            act(state, c["owner"], {"type": "choose", "choice": c["options"][0]})
        elif state["effects"]:
            act(state, state["effects"][0]["owner"], {"type": "resolve", "index": 0})
        else:
            return
    raise AssertionError("Unbounded effect chain")


class DuneImperiumTests(unittest.TestCase):
    def test_base_set_and_setup(self):
        self.assertEqual(sum(CARDS[k]["count"] for k in MARKET), 67)
        self.assertEqual(sum(CARDS[k]["count"] for k in RESERVE), 24)
        self.assertEqual(sum(d["count"] for d in INTRIGUES.values()), 40)
        self.assertEqual(Counter(c["tier"] for c in CONFLICTS.values()), {1: 4, 2: 10, 3: 4})
        for n in (2, 3, 4):
            s = playing(n)
            self.assertEqual(len(s["market"]), 5)
            self.assertEqual([CONFLICTS[c]["tier"] for c in [s["conflict"]] + s["conflict_deck"]], [1] + [2] * 5 + [3] * 4)
            self.assertEqual(s["players"]["0"]["vp"], int(n == 4))
            self.assertEqual(len(s["players"]["0"]["hand"]), 5)
            self.assertEqual(len(s["players"]["0"]["deck"]), 5)
            self.assertEqual(s["players"]["0"]["garrison"], 3)
        h = playing(2)["hagal_deck"]
        self.assertEqual(len(h), 28)
        self.assertEqual(Counter(c["space"] for c in h)["harvest"], 5)
        self.assertEqual(next(c["swords"] for c in h if c["space"] == "heighliner"), 6)

    def test_rejects_invalid_configuration_and_duplicate_players(self):
        for config in ({"seed": True}, {"expansion": "ix"}):
            with self.assertRaises(ValueError):
                Game.init_game(config, [{"player_id": "0"}, {"player_id": "1"}])
        with self.assertRaises(ValueError):
            Game.init_game({}, [{"player_id": "0"}, {"player_id": "0"}])

    def test_invalid_actions_are_atomic_and_strict(self):
        s = playing()
        for pid, action in [("watcher", {"type": "reveal"}), ("1", {"type": "reveal"}),
                            ("0", {"type": "reveal", "extra": 1}), ("0", {"type": "agent"}), ("0", None)]:
            before = copy.deepcopy(s)
            self.assertTrue(Game.apply_action(s, pid, action)[1])
            self.assertEqual(s, before)
        act(s, "0", {"type": "reveal"})
        before = copy.deepcopy(s)
        self.assertTrue(Game.apply_action(s, "0", {"type": "resolve", "index": False})[1])
        self.assertEqual(s, before)

    def test_space_cost_paid_before_card_effect(self):
        s = playing()
        uid = give(s, "0", "dune")
        self.assertFalse(any(m.get("space") == "great_flat" and m.get("card") == uid for m in legal_moves(s, "0")))
        s["players"]["0"]["water"] = 2
        move = next(m for m in legal_moves(s, "0") if m.get("card") == uid and m.get("space") == "great_flat")
        act(s, "0", move)
        self.assertEqual(s["players"]["0"]["water"], 0)
        self.assertEqual(s["players"]["0"]["spice"], 0)
        settle(s)
        self.assertEqual(s["players"]["0"]["spice"], 3)

    def test_alliance_tie_and_loss(self):
        s = playing(4)
        for pid in ("0", "1", "2"):
            rules._influence(s, pid, "emperor", 4)
        self.assertEqual(s["alliances"]["emperor"], "0")
        self.assertEqual(s["players"]["0"]["vp"], 3)
        rules._influence(s, "0", "emperor", -1)
        act(s, "0", {"type": "resolve", "index": 0})
        self.assertEqual(s["choice"]["options"], ["1", "2"])
        act(s, "0", {"type": "choose", "choice": "2"})
        self.assertEqual(s["alliances"]["emperor"], "2")
        self.assertEqual(s["players"]["0"]["vp"], 2)
        rules._influence(s, "0", "emperor", -2)
        self.assertEqual(s["players"]["0"]["vp"], 1)

    def test_shifting_same_faction_is_legal(self):
        s = playing()
        p = s["players"]["0"]
        p["spice"], p["influence"]["fremen"] = 2, 1
        rules._queue(s, "0", [effect("shift")])
        act(s, "0", {"type": "resolve", "index": 0})
        act(s, "0", {"type": "choose", "choice": ["fremen", "fremen"]})
        self.assertEqual((p["spice"], p["influence"]["fremen"]), (2, 1))  # atomic copies replace old references
        self.assertEqual(s["players"]["0"]["influence"]["fremen"], 2)
        self.assertEqual(s["players"]["0"]["spice"], 0)

    def test_hidden_information_and_paul(self):
        s = playing(leaders=["baron", "paul", "leto"])
        uid = intrigue(s, "1", "ambush")
        rules._prompt(s, dict(effect("discard", remaining=1), owner="1", source=None), list(s["players"]["1"]["hand"]))
        public = Game.get_public_view(s, "watcher")
        mine = Game.get_public_view(s, "1")
        self.assertNotIn("seed", public)
        for p in public["players"]:
            for key in ("hand", "intrigues", "peek", "deck_composition", "baron_factions"):
                self.assertNotIn(key, p)
        self.assertEqual(set(public["choice"]), {"owner", "mode"})
        self.assertNotIn(uid, json.dumps(public))
        own = next(p for p in mine["players"] if p["player_id"] == "1")
        self.assertEqual(own["peek"], s["players"]["1"]["deck"][-1])
        self.assertEqual(public["moves"], [])

    def test_deployment_new_troops_plus_two_and_late_reinforcements(self):
        s = playing()
        s["players"]["0"]["garrison"] = 6
        s["players"]["0"]["solari"] = 3
        uid = give(s, "0", "diplomacy")
        m = next(m for m in legal_moves(s, "0") if m.get("card") == uid and m.get("space") == "hardy_warriors")
        act(s, "0", m)
        while s["effects"]:
            act(s, "0", {"type": "resolve", "index": 0})
        self.assertEqual(s["choice"]["options"], list(range(5)))
        act(s, "0", {"type": "choose", "choice": 4})
        intr = intrigue(s, "0", "reinforcements")
        act(s, "0", {"type": "intrigue", "card": intr})
        act(s, "0", {"type": "resolve", "index": 0})
        self.assertEqual(s["choice"]["options"], list(range(4)))
        act(s, "0", {"type": "choose", "choice": 3})
        self.assertEqual(s["players"]["0"]["troops"], 7)
        self.assertEqual(s["players"]["0"]["garrison"], 4)

    def test_recruitment_before_agent_counts_for_same_turn(self):
        s = playing()
        s["players"]["0"]["solari"] = 3
        uid = intrigue(s, "0", "reinforcements")
        act(s, "0", {"type": "intrigue", "card": uid})
        settle(s)
        card = give(s, "0", "dune")
        act(s, "0", next(m for m in legal_moves(s, "0") if m.get("card") == card and m.get("space") == "imperial_basin"))
        act(s, "0", {"type": "resolve", "index": 0})
        self.assertEqual(s["choice"]["options"][-1], 5)

    def test_baron_can_trigger_on_reveal_deployment(self):
        s = playing(leaders=["baron", "paul", "leto"])
        s["players"]["0"]["garrison"] = 5
        uid = intrigue(s, "0", "rapid_mobilization")
        act(s, "0", {"type": "reveal"})
        settle(s)
        act(s, "0", {"type": "intrigue", "card": uid})
        act(s, "0", {"type": "resolve", "index": 0})
        act(s, "0", {"type": "choose", "choice": 4})
        self.assertEqual(s["choice"]["mode"], "baron_power")
        act(s, "0", {"type": "choose", "choice": True})
        self.assertEqual(s["players"]["0"]["influence"]["guild"], 1)
        self.assertTrue(s["players"]["0"]["baron_used"])

    def test_effect_order_carryall_ariana_and_ilban(self):
        s = playing(leaders=["ariana", "ilban", "leto"])
        uid = give(s, "0", "carryall")
        s["spice_bonus"]["hagga_basin"] = 3
        act(s, "0", next(m for m in legal_moves(s, "0") if m.get("card") == uid and m.get("space") == "hagga_basin"))
        before = len(s["players"]["0"]["hand"])
        act(s, "0", {"type": "resolve", "index": 1})
        settle(s)
        self.assertEqual(s["players"]["0"]["spice"], 6)  # 2 base x2 +3 bonus -1
        self.assertEqual(len(s["players"]["0"]["hand"]), before + 1)
        act(s, "0", {"type": "end_turn"})
        s["players"]["1"]["solari"] = 8
        uid = give(s, "1", "dagger")
        act(s, "1", next(m for m in legal_moves(s, "1") if m.get("card") == uid and m.get("space") == "swordmaster"))
        before = len(s["players"]["1"]["hand"])
        settle(s)
        self.assertIn("swordmaster", s["players"]["1"]["agents"])
        self.assertEqual(len(s["players"]["1"]["hand"]), before + 1)

    def test_occupancy_helena_voice_and_kwisatz(self):
        s = playing(leaders=["helena", "paul", "leto"])
        s["occupied"]["arrakeen"] = [{"owner": "1", "agent": "agent1"}]
        uid = give(s, "0", "reconnaissance")
        self.assertTrue(any(m.get("space") == "arrakeen" and m.get("card") == uid for m in legal_moves(s, "0")))
        s["blocked"] = [{"space": "arrakeen", "owner": "1"}]
        self.assertFalse(any(m.get("space") == "arrakeen" for m in legal_moves(s, "0")))
        s["players"]["0"]["agents"] = []
        s["occupied"]["wealth"] = [{"owner": "0", "agent": "agent1"}]
        kh = give(s, "0", "kwisatz_haderach")
        act(s, "0", next(m for m in legal_moves(s, "0") if m.get("card") == kh and m.get("space") == "foldspace"))
        self.assertEqual(s["occupied"]["wealth"], [])
        self.assertEqual(s["occupied"]["foldspace"], [{"owner": "0", "agent": "agent1"}])

    def test_reveal_draw_and_buy_top_of_deck(self):
        s = playing()
        uid = intrigue(s, "0", "recruitment_mission")
        act(s, "0", {"type": "reveal"})
        settle(s)
        act(s, "0", {"type": "intrigue", "card": uid})
        settle(s)
        self.assertNotIn(uid, s["intrigue_discard"])
        s["players"]["0"]["persuasion"] = 20
        buy = next(m for m in legal_moves(s, "0") if m["type"] == "buy" and m["top"] and s["cards"][m["card"]] == "arrakis_liaison")
        act(s, "0", buy)
        count = len(s["players"]["0"]["revealed"])
        rules._draw(s, "0", 1)
        settle(s)
        self.assertEqual(len(s["players"]["0"]["revealed"]), count + 1)
        self.assertEqual(s["players"]["0"]["hand"], [])
        self.assertEqual(s["players"]["0"]["persuasion"], 20)
        act(s, "0", {"type": "end_turn"})
        self.assertIn(uid, s["intrigue_discard"])

    def test_intrigue_is_not_recycled_until_resolved(self):
        s = playing()
        uid = intrigue(s, "0", "sisterhood_secret")
        s["players"]["0"]["influence"]["bene"] = 3
        s["intrigue_discard"] += s["intrigue_deck"]
        s["intrigue_deck"] = []
        act(s, "0", {"type": "intrigue", "card": uid})
        self.assertNotIn(uid, s["intrigue_discard"])
        settle(s)
        self.assertIn(uid, s["intrigue_discard"])
        self.assertNotIn(uid, s["players"]["0"]["intrigues"])

    def test_discard_interrupt_clockwise_and_private(self):
        s = playing(4)
        s["current_turn"] = "2"
        rules._queue(s, "2", [effect("enemy_discard", amount=2)])
        act(s, "2", {"type": "resolve", "index": 0})
        self.assertEqual(s["choice"]["owner"], "3")
        self.assertEqual(legal_moves(s, "2"), [])
        for _ in range(2):
            act(s, "3", legal_moves(s, "3")[0])
        self.assertEqual(s["choice"]["owner"], "0")
        settle(s)
        self.assertEqual([len(s["players"][i]["hand"]) for i in s["order"]], [3, 3, 5, 3])

    def test_trash_cost_and_reserve_return(self):
        s = playing()
        uid = give(s, "0", "assassination_mission")
        rules._trash(s, "0", uid)
        self.assertEqual(s["players"]["0"]["solari"], 4)
        fold = give(s, "0", "foldspace")
        rules._trash(s, "0", fold)
        self.assertIn(fold, s["reserve"]["foldspace"])
        spy = give(s, "0", "imperial_spy")
        rules._trash(s, "0", spy)
        self.assertEqual(s["players"]["0"]["intrigues"], [])

    def test_zero_troops_and_tied_rewards(self):
        for n in (3, 4):
            s = playing(n)
            s["players"]["0"]["troops"] = s["players"]["1"]["troops"] = 2
            s["players"]["2"]["troops"] = 1
            if n == 4:
                s["players"]["3"]["swords"] = 20
            rules._resolve_combat(s)
            awards = s["round_report"]["awards"]
            self.assertEqual(awards["0"], 1)
            self.assertEqual(awards["1"], 1)
            self.assertIsNone(s["combat_winner"])
            self.assertEqual(awards.get("2"), 2 if n == 4 else None)
            if n == 4:
                self.assertEqual(s["round_report"]["strength"]["3"], 0)

    def test_combat_intrigue_resets_passes(self):
        s = playing()
        for i in ("0", "1"):
            s["players"][i]["troops"] = 2
        uid = intrigue(s, "1", "ambush")
        rules._begin_combat(s)
        act(s, "0", {"type": "pass"})
        act(s, "1", {"type": "intrigue", "card": uid})
        settle(s)
        self.assertEqual(s["passes"], [])
        act(s, "1", {"type": "pass"})
        self.assertEqual(s["current_turn"], "0")
        act(s, "0", {"type": "pass"})
        self.assertEqual(s["combat_winner"], "1")

    def test_win_intrigue_and_round_barrier(self):
        s = playing()
        s["players"]["0"]["troops"] = 2
        uid = intrigue(s, "0", "to_the_victor")
        self.assertNotIn({"type": "intrigue", "card": uid}, legal_moves(s, "0"))
        rules._resolve_combat(s)
        settle(s)
        before = s["players"]["0"]["spice"]
        act(s, "0", {"type": "intrigue", "card": uid})
        settle(s)
        self.assertEqual(s["players"]["0"]["spice"], before + 3)
        act(s, "0", {"type": "end_turn"})
        self.assertEqual(s["phase"], "round_end")
        self.assertEqual(s["players"]["0"]["troops"], 2)
        for pid in ("0", "1"):
            act(s, pid, {"type": "next_round"})
            self.assertEqual(s["round"], 1)
        self.assertEqual(legal_moves(s, "0"), [])
        act(s, "2", {"type": "next_round"})
        self.assertEqual(s["round"], 2)
        self.assertEqual(s["players"]["0"]["troops"], 0)

    def test_hagal_harvest_bonus_priority_and_no_resources(self):
        s = playing(2)
        s["spice_bonus"].update(imperial_basin=2, great_flat=1, hagga_basin=0)
        s["hagal_deck"].append({"space": "harvest", "troops": 0, "swords": 2})
        rules._hagal_turn(s)
        self.assertEqual(s["occupied"]["imperial_basin"][0]["owner"], "hagal")
        self.assertEqual(s["spice_bonus"]["imperial_basin"], 0)
        self.assertEqual(s["players"]["hagal"]["spice"], 0)
        s["blocked"] = [{"space": "great_flat", "owner": "0"}]
        s["spice_bonus"]["hagga_basin"] = 1
        s["hagal_deck"].append({"space": "harvest", "troops": 0, "swords": 2})
        rules._hagal_turn(s)
        self.assertEqual(s["occupied"]["hagga_basin"][0]["owner"], "hagal")
        rules._influence(s, "hagal", "guild", 4)
        self.assertEqual(s["alliances"]["guild"], "hagal")
        self.assertEqual(s["players"]["hagal"]["vp"], 0)

    def test_hagal_removes_control_without_rewards(self):
        s = playing(2)
        s["conflict"] = "siege_arrakeen"
        s["control"]["arrakeen"] = "0"
        s["players"]["hagal"]["troops"] = 3
        rules._resolve_combat(s)
        self.assertIsNone(s["control"]["arrakeen"])
        self.assertEqual(s["phase"], "round_end")
        self.assertEqual(s["players"]["hagal"]["vp"], 0)

    def test_final_round_endgame_cards_and_tiebreak(self):
        s = playing()
        s["players"]["0"]["vp"] = s["players"]["1"]["vp"] = 10
        uid = intrigue(s, "1", "tiebreaker")
        rules._resolve_combat(s)
        self.assertTrue(s["final_round"])
        for pid in s["order"]:
            act(s, pid, {"type": "next_round"})
        act(s, "0", {"type": "endgame_done"})
        act(s, "1", {"type": "intrigue", "card": uid})
        act(s, "1", {"type": "endgame_done"})
        act(s, "2", {"type": "endgame_done"})
        self.assertEqual(s["winner"], ["1"])
        self.assertTrue(s["game_over"])
        s["players"]["0"]["spice"] = 10
        s["players"]["0"]["reveal_order"] = 2
        rules._finish(s)
        self.assertEqual(s["winner"], ["0"])

    def test_all_card_and_intrigue_effects_terminate(self):
        for kind in CARDS:
            for mode in ("agent", "reveal"):
                with self.subTest(card=kind, mode=mode):
                    s = playing()
                    s["players"]["0"].update(spice=20, water=20, solari=20)
                    uid = give(s, "0", kind)
                    if mode == "agent":
                        candidates = [m for m in legal_moves(s, "0") if m["type"] == "agent" and m["card"] == uid]
                        if not candidates:
                            continue
                        act(s, "0", candidates[0])
                    else:
                        act(s, "0", {"type": "reveal"})
                    settle(s)
                    self.assertIn("end_turn", Game.get_legal_actions(s, "0"))
        for kind, data in INTRIGUES.items():
            with self.subTest(intrigue=kind):
                s = playing()
                p = s["players"]["0"]
                p.update(spice=20, solari=20, water=20, troops=4, council=True)
                s["players"]["1"]["troops"] = 1
                s["occupied"]["wealth"] = [{"owner": "0", "agent": p["agents"].pop()}]
                s["alliances"]["fremen"] = "0"
                timing = data["timing"]
                s["phase"] = {"combat": "combat", "combat_endgame": "endgame", "endgame": "endgame", "win": "rewards"}.get(timing, "agent")
                s["combat_winner"] = "0"
                uid = intrigue(s, "0", kind)
                act(s, "0", {"type": "intrigue", "card": uid})
                settle(s)
                self.assertFalse(s["effects"])
                self.assertFalse(s["choice"])

    def test_save_load_determinism_and_view_only_ai(self):
        s = playing()
        restored = Game.deserialize(json.loads(json.dumps(Game.serialize(s))))
        self.assertEqual(legal_moves(s, "0"), legal_moves(restored, "0"))
        hidden_changed = copy.deepcopy(s)
        hidden_changed["players"]["1"]["hand"].reverse()
        hidden_changed["market_deck"].reverse()
        hidden_changed["intrigue_deck"].reverse()
        self.assertEqual(choose_move(Game.get_public_view(s, "0")), choose_move(Game.get_public_view(hidden_changed, "0")))
        for _ in range(40):
            pid = next(i for i in s["order"] if legal_moves(s, i))
            move = Game.bot_move(s, pid)
            self.assertEqual(move, Game.bot_move(restored, pid))
            act(s, pid, move)
            act(restored, pid, move)
            self.assertEqual(s, restored)

    def test_ai_completes_games_and_preserves_components(self):
        for count, seed in ((2, 5), (2, 31), (3, 7), (4, 13), (4, 23)):
            with self.subTest(count=count, seed=seed):
                s = playing(count, seed)
                for step in range(2200):
                    if s["game_over"]:
                        break
                    pid = next((i for i in s["order"] if legal_moves(s, i)), None)
                    self.assertIsNotNone(pid, (s["phase"], s["choice"], s["effects"]))
                    act(s, pid, Game.bot_move(s, pid))
                    for p in s["players"].values():
                        self.assertTrue(0 <= p["troops"] + p["garrison"] <= 12)
                        self.assertTrue(all(p[k] >= 0 for k in ("spice", "solari", "water", "garrison", "troops")))
                    if step % 40 == 0:
                        zones = s["market"] + s["market_deck"] + s["trashed"]
                        zones += [c for stack in s["reserve"].values() for c in stack]
                        zones += [c for p in s["players"].values() for k in ("deck", "hand", "discard", "played", "revealed", "reserved") for c in p[k]]
                        self.assertEqual(Counter(zones), Counter(s["cards"].keys()))
                        intrigue_zones = s["intrigue_deck"] + s["intrigue_discard"]
                        intrigue_zones += [x["card"] for x in s["intrigue_resolving"]]
                        intrigue_zones += [c for p in s["players"].values() for k in ("intrigues", "intrigue_active") for c in p[k]]
                        self.assertEqual(Counter(intrigue_zones), Counter(s["intrigue_cards"].keys()))
                self.assertTrue(s["game_over"])
                self.assertLessEqual(s["round"], 10)
                self.assertTrue(s["winner"])


if __name__ == "__main__":
    unittest.main()
