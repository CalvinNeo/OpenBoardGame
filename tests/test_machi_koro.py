import copy
import json
import unittest
from collections import Counter

from game import MachiKoroGame, get_game
from game.machi_koro import _effect, _income, _new_card, _refill
from game.machi_koro_data import CARDS, LANDMARKS


def fresh(count=3, edition="all", market="all", seed=17):
    return MachiKoroGame.init_game({"edition": edition, "market": market, "seed": seed},
        [{"player_id": f"p{index}", "name": f"Player {index}", "seat": index} for index in range(count)])


def add(state, owner, card_id, closed=False):
    card = _new_card(state, card_id)
    card["closed"] = closed
    state["players"][owner]["cards"].append(card)
    return card


def settle(state):
    for _ in range(100):
        if state["phase"] != "income":
            return
        public = MachiKoroGame.get_public_view(state, state["current_turn"])
        events, error = MachiKoroGame.apply_action(state, state["current_turn"], {"type": "activate", "uid": public["income_choices"][0]})
        if error:
            raise AssertionError(error)
    raise AssertionError("income did not settle")


class MachiKoroTests(unittest.TestCase):
    def act(self, state, action, owner="p0"):
        events, error = MachiKoroGame.apply_action(state, owner, action)
        self.assertIsNone(error)
        self.assertTrue(events)
        return events

    def reject(self, state, action, owner="p0"):
        before = copy.deepcopy(state)
        self.assertIsNotNone(MachiKoroGame.apply_action(state, owner, action)[1])
        self.assertEqual(before, state)

    def choose(self, state, **fields):
        choice = next(index for index, choice in enumerate(state["pending"]["choices"]) if all(choice.get(key) == value for key, value in fields.items()))
        self.act(state, {"type": "choose", "choice": choice})

    def test_registration_editions_and_setup(self):
        self.assertEqual(get_game("machi_koro").module, MachiKoroGame)
        self.assertEqual(len(CARDS), 39)
        for edition, cards, landmarks in (("base", 15, 4), ("harbor", 25, 6), ("millionaires", 29, 4), ("all", 39, 6)):
            state = fresh(5, edition)
            self.assertEqual(len(state["supply"]), cards)
            self.assertEqual(len(state["landmark_ids"]), landmarks)
            self.assertEqual(state["city_hall"], edition in ("harbor", "all"))
            self.assertTrue(all(player["coins"] == 3 and len(player["cards"]) == 2 for player in state["players"].values()))
            self.assertEqual(state, fresh(5, edition))
        self.assertEqual(MachiKoroGame.init_game({}, [{"player_id": "a"}, {"player_id": "b"}])["config"]["edition"], "all")

    def test_invalid_setup(self):
        for config in ({"edition": "x"}, {"market": "x"}, {"seed": True}, {"bad": 1}):
            with self.assertRaises(ValueError):
                MachiKoroGame.init_game(config, [{"player_id": "a"}, {"player_id": "b"}])
        for count in (1, 6):
            with self.assertRaises(ValueError):
                fresh(count)
        with self.assertRaises(ValueError):
            MachiKoroGame.init_game({}, [{"player_id": "a"}, {"player_id": "a"}])

    def test_invalid_actions_are_atomic(self):
        state = fresh()
        for action in (None, {}, {"type": []}, {"type": "roll"}, {"type": "roll", "dice": True},
                       {"type": "roll", "dice": 2}, {"type": "roll", "dice": 1, "extra": 1}, {"type": "buy", "card": "mine"}):
            self.reject(state, action)
        self.reject(state, {"type": "roll", "dice": 1}, "p1")
        self.reject(state, {"type": "roll", "dice": 1}, "spectator")
        state["phase"] = "build"
        for action in ({"type": "buy", "card": []}, {"type": "buy", "card": "mine"}, {"type": "build", "landmark": []}, {"type": "build", "landmark": "airport"}):
            self.reject(state, action)

    def test_red_before_income_and_counterclockwise_payment(self):
        state = fresh()
        state["players"]["p0"]["coins"] = 1
        add(state, "p1", "cafe")
        add(state, "p2", "cafe")
        state["total"] = 3
        _income(state)
        settle(state)
        self.assertEqual([state["players"][owner]["coins"] for owner in state["turn_order"]], [1, 3, 4])
        self.assertEqual(state["phase"], "build")

    def test_blue_green_red_and_purple_timing(self):
        state = fresh()
        add(state, "p1", "convenience_store")
        add(state, "p1", "stadium")
        add(state, "p0", "cafe")
        state["total"] = 4
        _income(state)
        self.assertTrue(all(player["coins"] == 3 for player in state["players"].values()))
        state["total"] = 1
        _income(state)
        settle(state)
        self.assertTrue(all(player["coins"] == 4 for player in state["players"].values()))

    def test_factory_synergies_include_closed_cards_and_flower_mall(self):
        state = fresh()
        for card_id in ("ranch", "ranch", "forest", "mine", "flower_garden", "flower_garden", "vineyard", "cafe"):
            add(state, "p0", card_id, closed=True)
        state["players"]["p0"]["landmarks"] = ["shopping_mall"]
        expected = {"cheese_factory": 6, "furniture_factory": 6, "produce_market": 8, "flower_shop": 4, "food_warehouse": 2, "soda_bottling_plant": 1}
        for card_id, amount in expected.items():
            before = state["players"]["p0"]["coins"]
            _effect(state, "p0", add(state, "p0", card_id))
            self.assertEqual(state["players"]["p0"]["coins"] - before, amount, card_id)

    def test_early_and_late_landmark_thresholds(self):
        for count in (0, 1, 2, 3):
            state = fresh()
            state["players"]["p0"]["landmarks"] = list(LANDMARKS)[:count]
            state["players"]["p0"]["coins"] = 20
            _effect(state, "p0", add(state, "p0", "corn_field"))
            self.assertEqual(state["players"]["p0"]["coins"], 21 if count < 2 else 20)
            _effect(state, "p1", add(state, "p1", "french_restaurant"))
            self.assertEqual(state["players"]["p1"]["coins"], 8 if count >= 2 else 3)
            _effect(state, "p1", add(state, "p1", "private_club"))
            if count >= 3:
                self.assertEqual(state["players"]["p0"]["coins"], 0)

    def test_city_hall_after_income_not_on_other_players_turn(self):
        state = fresh()
        state["players"]["p0"]["coins"] = state["players"]["p1"]["coins"] = 0
        state["total"] = 6
        _income(state)
        self.assertEqual(state["players"]["p0"]["coins"], 1)
        self.assertEqual(state["players"]["p1"]["coins"], 0)
        base = fresh(edition="base")
        base["players"]["p0"]["coins"] = 0
        base["total"] = 6
        _income(base)
        self.assertEqual(base["players"]["p0"]["coins"], 0)

    def test_harbor_fishing_and_shared_tuna_roll(self):
        state = fresh()
        for owner in ("p0", "p1"):
            state["players"][owner]["landmarks"] = ["harbor"]
            add(state, owner, "tuna_boat")
        add(state, "p0", "tuna_boat")
        add(state, "p2", "tuna_boat")
        state["phase"] = "harbor"
        state["dice"] = [5, 5]
        state["total"] = 10
        self.act(state, {"type": "harbor", "add": True})
        settle(state)
        amount = sum(state["tuna_roll"])
        self.assertTrue(2 <= amount <= 12)
        self.assertEqual(state["players"]["p0"]["coins"], 3 + 2 * amount)
        self.assertEqual(state["players"]["p1"]["coins"], 3 + amount)
        self.assertEqual(state["players"]["p2"]["coins"], 3)
        self.assertEqual(state["dice"], [5, 5])
        self.assertEqual(state["total"], 12)

    def test_radio_tower_and_train_station(self):
        state = fresh()
        state["players"]["p0"]["landmarks"] = ["radio_tower", "train_station"]
        self.act(state, {"type": "roll", "dice": 2})
        self.assertEqual(state["phase"], "reroll")
        self.act(state, {"type": "reroll", "dice": 1})
        self.assertEqual(len(state["dice"]), 1)
        self.assertEqual(state["roll_serial"], 2)
        self.reject(state, {"type": "reroll", "dice": 1})

    def test_publisher_tax_and_stadium(self):
        state = fresh()
        state["players"]["p1"]["coins"] = 11
        state["players"]["p2"]["coins"] = 9
        _effect(state, "p0", add(state, "p0", "tax_office"))
        self.assertEqual([state["players"][owner]["coins"] for owner in state["turn_order"]], [8, 6, 9])
        add(state, "p1", "cafe", closed=True)
        _effect(state, "p0", add(state, "p0", "publisher"))
        self.assertEqual(state["players"]["p1"]["coins"], 4)
        _effect(state, "p0", add(state, "p0", "stadium"))
        self.assertEqual(state["players"]["p0"]["coins"], 15)

    def test_loan_is_negative_cost_and_repays_before_income(self):
        state = fresh()
        state["phase"] = "build"
        self.act(state, {"type": "buy", "card": "loan_office"})
        self.assertEqual(state["players"]["p0"]["coins"], 8)
        state["current_turn"] = "p0"
        state["players"]["p0"]["coins"] = 0
        add(state, "p0", "forest")
        state["total"] = 5
        _income(state)
        settle(state)
        self.assertEqual(state["players"]["p0"]["coins"], 1)

    def test_demolition_mandatory_before_other_income(self):
        state = fresh()
        state["players"]["p0"]["landmarks"] = ["harbor", "train_station"]
        add(state, "p0", "demolition_company")
        add(state, "p0", "general_store")
        state["total"] = 4
        _income(state)
        self.assertEqual(state["pending"]["kind"], "demolition_company")
        self.choose(state, landmark="harbor")
        self.assertEqual(state["players"]["p0"]["coins"], 11)
        self.assertNotIn("harbor", state["players"]["p0"]["landmarks"])

    def test_winery_renovation_and_renovation_company(self):
        state = fresh()
        add(state, "p0", "vineyard")
        winery = add(state, "p0", "winery")
        for expected, closed in ((9, True), (9, False), (15, True)):
            _effect(state, "p0", winery)
            self.assertEqual(state["players"]["p0"]["coins"], expected)
            self.assertEqual(winery["closed"], closed)
        add(state, "p1", "bakery", closed=True)
        _effect(state, "p0", add(state, "p0", "renovation_company"))
        self.choose(state, card="bakery")
        self.assertEqual(state["players"]["p0"]["coins"], 17)
        self.assertTrue(all(card["closed"] for player in state["players"].values() for card in player["cards"] if card["id"] == "bakery"))
        _effect(state, "p0", add(state, "p0", "renovation_company"))
        self.choose(state, card="bakery")
        self.assertEqual(state["players"]["p0"]["coins"], 17)
        _effect(state, "p0", add(state, "p0", "renovation_company"))
        self.choose(state, card="mine")

    def test_tv_trade_gift_and_closed_identity(self):
        state = fresh()
        _effect(state, "p0", add(state, "p0", "tv_station"))
        self.choose(state, target="p1")
        self.assertEqual(state["players"]["p0"]["coins"], 6)
        given = add(state, "p0", "loan_office", closed=True)
        taken = add(state, "p1", "mine")
        _effect(state, "p0", add(state, "p0", "business_center"))
        self.choose(state, give=given["uid"], target="p1", take=taken["uid"])
        self.assertIn(given, state["players"]["p1"]["cards"])
        self.assertTrue(given["closed"])
        moving = add(state, "p0", "moving_company")
        _effect(state, "p0", moving)
        self.choose(state, give=moving["uid"], target="p1")
        self.assertEqual(state["players"]["p0"]["coins"], 10)
        self.assertIn(moving, state["players"]["p1"]["cards"])

    def test_exhibit_returns_itself_and_activates_only_selected_card(self):
        state = fresh()
        hall = add(state, "p0", "exhibit_hall")
        mine = add(state, "p0", "mine")
        other = add(state, "p1", "mine")
        count = state["supply"]["exhibit_hall"]
        _effect(state, "p0", hall)
        self.choose(state, uid=mine["uid"])
        self.assertEqual(state["supply"]["exhibit_hall"], count + 1)
        self.assertNotIn(hall, state["players"]["p0"]["cards"])
        self.assertEqual(state["players"]["p0"]["coins"], 8)
        self.assertEqual(state["players"]["p1"]["coins"], 3)
        self.assertIn(other, state["players"]["p1"]["cards"])

    def test_multiple_movers_all_trigger_even_if_one_is_given_away(self):
        state = fresh()
        first = add(state, "p0", "moving_company")
        second = add(state, "p0", "moving_company")
        closed = add(state, "p0", "moving_company", closed=True)
        state["total"] = 9
        _income(state)
        self.assertEqual(state["phase"], "choose")
        self.assertEqual(state["players"]["p0"]["coins"], 11)
        self.assertFalse(closed["closed"])
        self.choose(state, give=second["uid"], target="p1")
        self.assertEqual(state["pending"]["kind"], "moving_company")
        self.choose(state, give=first["uid"], target="p2")
        self.assertEqual(state["phase"], "build")
        self.assertEqual(state["players"]["p0"]["coins"], 11)

    def test_demolition_can_enable_corn_and_disable_mall_before_income(self):
        state = fresh()
        state["players"]["p0"]["landmarks"] = ["harbor", "shopping_mall"]
        add(state, "p0", "demolition_company")
        add(state, "p0", "corn_field")
        add(state, "p0", "convenience_store")
        state["total"] = 4
        _income(state)
        self.choose(state, landmark="shopping_mall")
        settle(state)
        self.assertEqual(state["players"]["p0"]["coins"], 15)

    def test_park_rounding_and_tech_investment(self):
        state = fresh()
        for owner, amount in zip(state["turn_order"], (0, 1, 6)):
            state["players"][owner]["coins"] = amount
        _effect(state, "p0", add(state, "p0", "park"))
        self.assertTrue(all(player["coins"] == 3 for player in state["players"].values()))
        state["phase"] = "build"
        self.act(state, {"type": "buy", "card": "tech_startup"})
        self.assertEqual(state["phase"], "invest")
        self.reject(state, {"type": "invest", "invest": 1})
        self.act(state, {"type": "invest", "invest": True})
        self.assertEqual(state["players"]["p0"]["investment"], 1)
        self.assertEqual(state["players"]["p0"]["coins"], 1)
        _effect(state, "p0", next(card for card in state["players"]["p0"]["cards"] if card["id"] == "tech_startup"))
        self.assertEqual(state["players"]["p0"]["coins"], 3)

    def test_airport_doubles_round_pause_and_immediate_victory(self):
        state = fresh(2)
        state["players"]["p0"]["landmarks"] = ["airport", "amusement_park"]
        state["phase"] = "build"
        state["dice"] = [2, 2]
        self.act(state, {"type": "pass"})
        self.assertEqual(state["current_turn"], "p0")
        self.assertEqual(state["phase"], "roll")
        self.assertEqual(state["players"]["p0"]["coins"], 13)
        state["phase"] = "build"
        state["dice"] = [1]
        self.act(state, {"type": "pass"})
        state["phase"] = "build"
        self.act(state, {"type": "pass"}, "p1")
        self.assertEqual(state["phase"], "round_summary")
        self.act(state, {"type": "next_round"})
        self.assertEqual(state["phase"], "round_summary")
        self.reject(state, {"type": "next_round"})
        self.act(state, {"type": "next_round"}, "p1")
        self.assertEqual(state["round_number"], 2)
        self.assertEqual(state["current_turn"], "p0")
        state["phase"] = "build"
        state["players"]["p0"]["landmarks"] = [key for key in LANDMARKS if key != "airport"]
        state["players"]["p0"]["coins"] = 30
        self.act(state, {"type": "build", "landmark": "airport"})
        self.assertTrue(state["game_over"])
        self.assertEqual(state["winner"], ["p0"])

    def test_variable_supply_conservation_refill_and_major_uniqueness(self):
        state = fresh(2, market="variable")
        self.assertEqual(len(state["supply"]), 10)
        counts = Counter(state["deck"])
        counts.update(state["supply"])
        for card_id, data in CARDS.items():
            self.assertEqual(counts[card_id], 2 if data["color"] == "purple" else 6)
        state["supply"] = {"wheat_field": 1}
        state["deck"] = ["forest", "ranch", "wheat_field"]
        _refill(state)
        self.assertEqual(state["supply"], {"wheat_field": 2, "ranch": 1, "forest": 1})
        self.assertEqual(state["deck"], [])
        state = fresh()
        state["phase"] = "build"
        state["players"]["p0"]["coins"] = 50
        add(state, "p0", "stadium")
        self.reject(state, {"type": "buy", "card": "stadium"})

    def test_public_privacy_and_save_restore_at_all_choices(self):
        state = fresh(market="variable")
        state["players"]["p0"]["landmarks"] = ["radio_tower", "train_station", "harbor"]
        self.act(state, {"type": "roll", "dice": 2})
        saved = MachiKoroGame.deserialize(json.loads(json.dumps(MachiKoroGame.serialize(state))))
        self.assertEqual(state, saved)
        view = MachiKoroGame.get_public_view(state, "spectator")
        self.assertFalse({"seed", "deck", "roll_serial"} & view.keys())
        self.assertNotIn("seed", view["config"])
        self.assertEqual(view["legal_actions"], [])
        view["players"][0]["coins"] = 999
        self.assertEqual(state["players"]["p0"]["coins"], 3)
        self.act(state, {"type": "reroll", "dice": 1})
        self.act(saved, {"type": "reroll", "dice": 1})
        self.assertEqual(state, saved)
        for card_id in ("tv_station", "business_center", "moving_company", "renovation_company", "exhibit_hall"):
            trial = fresh()
            _effect(trial, "p0", add(trial, "p0", card_id))
            restored = MachiKoroGame.deserialize(json.loads(json.dumps(trial)))
            self.act(trial, {"type": "choose", "choice": 0})
            self.act(restored, {"type": "choose", "choice": 0})
            self.assertEqual(trial, restored)

    def test_bots_complete_all_editions_without_illegal_actions(self):
        for edition in ("base", "harbor", "millionaires", "all"):
            for count in (2, 5):
                with self.subTest(edition=edition, count=count):
                    state = fresh(count, edition, market="variable", seed=count + 11)
                    for _ in range(12000):
                        if state["game_over"]:
                            break
                        owner = next((player_id for player_id in state["turn_order"] if MachiKoroGame.get_legal_actions(state, player_id)), None)
                        self.assertIsNotNone(owner)
                        action = MachiKoroGame.bot_move(state, owner)
                        self.assertIsNotNone(action)
                        self.act(state, action, owner)
                        self.assertTrue(all(player["coins"] >= 0 for player in state["players"].values()))
                    self.assertTrue(state["game_over"], f"stuck in {state['phase']} round {state['round_number']}")


if __name__ == "__main__":
    unittest.main()
