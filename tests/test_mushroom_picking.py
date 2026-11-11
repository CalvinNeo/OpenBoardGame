"""Rules, privacy, persistence and bot tests for 上山捡菌 (Mushroom Picking).

Run: python -m unittest tests.test_mushroom_picking
"""
import unittest

from jsonschema import Draft7Validator

import game.definitions  # noqa: F401  (registers every game)
from game.registry import get_game
from game.mushroom_picking import (
    ACTION_SCHEMA,
    BASIC_DECK_SIZE,
    CARDS,
    CONFIG_SCHEMA,
    MODE_BASIC,
    MODE_ORDERS,
    ORDERS,
    ORDER_DECK_SIZE,
    MushroomPickingGame,
    build_deck,
    build_order_deck,
    card_key,
    match_order,
    order_key,
    play_is_legal,
    play_score,
)


def players(count):
    return [{"player_id": f"p{index}", "name": f"P{index}", "seat": index} for index in range(count)]


def new_game(count=3, seed=7, mode=MODE_BASIC):
    return MushroomPickingGame.init_game({"seed": seed, "mode": mode}, players(count))


def actor(state):
    return state["turn_order"][state["turn_index"]]


def give(state, player_id, *keys):
    """Force specific cards into a hand, taking them off the deck."""
    hand = state["players"][player_id]["hand"]
    for key in keys:
        found = next((card for card in state["deck"] if card_key(card) == key), None)
        assert found is not None, f"no {key} left in the deck"
        state["deck"].remove(found)
        hand.append(found)
    return hand


def grab_order(state, player_id, key):
    """Move one copy of an order into a player's area, wherever it sits now."""
    pools = [state["order_deck"], state["order_center"]]
    pools += [state["players"][pid]["orders"] for pid in state["turn_order"]]
    pools += [state["players"][pid]["done_orders"] for pid in state["turn_order"]]
    for pool in pools:
        for oid in list(pool):
            if order_key(oid) == key:
                pool.remove(oid)
                state["players"][player_id]["orders"] = [oid]
                return oid
    raise AssertionError(f"no {key} order in play")


def do(state, player_id, action):
    events, error = MushroomPickingGame.apply_action(state, player_id, action)
    return error


def act(state, player_id, **action):
    action.setdefault("turn", state["turn"])
    return do(state, player_id, action)


class RegistrationTest(unittest.TestCase):
    def test_registered(self):
        definition = get_game("mushroom_picking")
        self.assertIsNotNone(definition)
        self.assertEqual(definition.name_zh, "上山捡菌")
        self.assertEqual((definition.min_players, definition.max_players), (2, 4))
        self.assertEqual(definition.turn_mode, "turn")

    def test_schemas_compile(self):
        Draft7Validator.check_schema(ACTION_SCHEMA)
        Draft7Validator.check_schema(CONFIG_SCHEMA)


class DeckTest(unittest.TestCase):
    def test_copy_counts(self):
        self.assertEqual(BASIC_DECK_SIZE, 62)
        self.assertEqual(len(build_deck(MODE_BASIC)), 62)
        self.assertEqual(len(build_deck(MODE_ORDERS)), 54)
        self.assertEqual(ORDER_DECK_SIZE, 20)
        self.assertEqual(len(build_order_deck()), 20)

    def test_orders_mode_drops_the_hazard_cards(self):
        keys = {card_key(card) for card in build_deck(MODE_ORDERS)}
        self.assertNotIn("huoli", keys)
        self.assertNotIn("yezhu", keys)
        self.assertNotIn("gancao", keys)

    def test_instance_ids_are_unique(self):
        for mode in (MODE_BASIC, MODE_ORDERS):
            deck = build_deck(mode)
            self.assertEqual(len(deck), len(set(deck)))

    def test_star_levels_match_the_rulebook(self):
        one = {key for key, card in CARDS.items() if card["star"] == 1}
        two = {key for key, card in CARDS.items() if card["star"] == 2}
        three = {key for key, card in CARDS.items() if card["star"] == 3}
        self.assertEqual(one, {"qingtou", "laba", "maotou", "dasuan"})
        self.assertEqual(two, {"yangdu", "zhusun", "niugan", "jianshou"})
        self.assertEqual(three, {"songrong", "ganba", "songlu"})


class ScoringTest(unittest.TestCase):
    def test_plain_values(self):
        self.assertEqual(play_score(["qingtou#0"], None), 2)
        self.assertEqual(play_score(["niugan#0"], None), 3)
        self.assertEqual(play_score(["ganba#0"], None), 4)

    def test_three_of_a_kind_doubles_that_group(self):
        cards = ["qingtou#0", "qingtou#1", "qingtou#2"]
        self.assertEqual(play_score(cards, None), 12)
        two = ["qingtou#0", "qingtou#1"]
        self.assertEqual(play_score(two, None), 4)

    def test_doubling_is_per_group(self):
        cards = ["qingtou#0", "qingtou#1", "qingtou#2", "laba#0", "laba#1"]
        self.assertEqual(play_score(cards, None), 16)

    def test_morel_pair_bonus(self):
        self.assertEqual(play_score(["yangdu#0"], None), 3)
        self.assertEqual(play_score(["yangdu#0", "zhusun#0"], None), 14)

    def test_garlic_doubles_the_wild_mushrooms_once(self):
        self.assertEqual(play_score(["niugan#0", "dasuan#0"], None), 6)
        self.assertEqual(play_score(["niugan#0", "dasuan#0", "dasuan#1"], None), 6)

    def test_garlic_needs_a_wild_mushroom(self):
        self.assertFalse(play_is_legal(["dasuan#0"], None))
        self.assertFalse(play_is_legal(["dasuan#0", "huoli#0"], None))
        self.assertTrue(play_is_legal(["dasuan#0", "niugan#0"], None))

    def test_truffle_needs_the_boar(self):
        self.assertEqual(play_score(["songlu#0"], None), 0)
        self.assertEqual(play_score(["songlu#0", "yezhu#0"], None), 12)
        self.assertEqual(play_score(["songlu#0", "songlu#1", "yezhu#0"], None), 24)

    def test_boar_alone_or_with_truffle_only(self):
        self.assertTrue(play_is_legal(["yezhu#0"], None))
        self.assertTrue(play_is_legal(["yezhu#0", "songlu#0"], None))
        self.assertFalse(play_is_legal(["yezhu#0", "niugan#0"], None))

    def test_poison_needs_the_campfire(self):
        self.assertEqual(play_score(["jianshou#0"], None), 0)
        self.assertEqual(play_score(["jianshou#0", "huoli#0"], None), 10)
        self.assertFalse(play_is_legal(["huoli#0"], None))

    def test_shaggy_mane_choice(self):
        self.assertEqual(play_score(["maotou#0"], "score"), 3)
        self.assertEqual(play_score(["maotou#0"], "clear"), 0)
        self.assertFalse(play_is_legal(["maotou#0"], None))
        self.assertFalse(play_is_legal(["niugan#0"], "score"))

    def test_garlic_applies_after_the_group_bonus(self):
        cards = ["qingtou#0", "qingtou#1", "qingtou#2", "dasuan#0"]
        self.assertEqual(play_score(cards, None), 24)


class BasicFlowTest(unittest.TestCase):
    def test_draw_keep_is_two_steps(self):
        state = new_game()
        pid = actor(state)
        self.assertIn("draw", MushroomPickingGame.get_legal_actions(state, pid))
        self.assertIsNone(act(state, pid, type="draw"))
        self.assertEqual(state["phase"], "keep")
        self.assertEqual(len(state["pending_draw"]), 3)
        self.assertNotIn("draw", MushroomPickingGame.get_legal_actions(state, pid))
        self.assertIsNone(act(state, pid, type="keep", keep=[0, 2]))
        self.assertEqual(len(state["players"][pid]["hand"]), 2)
        self.assertEqual(len(state["public"]), 1)
        self.assertEqual(actor(state), state["turn_order"][1])

    def test_keep_must_take_exactly_two(self):
        state = new_game()
        pid = actor(state)
        act(state, pid, type="draw")
        self.assertIsNotNone(act(state, pid, type="keep", keep=[0]))
        self.assertIsNotNone(act(state, pid, type="keep", keep=[0, 1, 2]))
        self.assertIsNotNone(act(state, pid, type="keep", keep=[0, 3]))

    def test_short_deck_keeps_everything(self):
        state = new_game()
        pid = actor(state)
        state["deck"] = state["deck"][:2]
        act(state, pid, type="draw")
        self.assertEqual(len(state["pending_draw"]), 2)
        self.assertIsNone(act(state, pid, type="keep", keep=[0, 1]))
        self.assertEqual(len(state["players"][pid]["hand"]), 2)
        self.assertEqual(state["public"], [])

    def test_take_from_public(self):
        state = new_game()
        first = actor(state)
        act(state, first, type="draw")
        act(state, first, type="keep", keep=[0, 1])
        second = actor(state)
        target = state["public"][0]
        self.assertIsNone(act(state, second, type="take", card=target))
        self.assertIn(target, state["players"][second]["hand"])
        self.assertNotIn(target, state["public"])

    def test_take_rejects_a_card_that_is_not_public(self):
        state = new_game()
        pid = actor(state)
        act(state, pid, type="draw")
        act(state, pid, type="keep", keep=[0, 1])
        second = actor(state)
        hidden = state["deck"][0]
        self.assertIsNotNone(act(state, second, type="take", card=hidden))

    def test_play_scores_and_moves_on(self):
        state = new_game()
        pid = actor(state)
        give(state, pid, "qingtou", "qingtou", "qingtou")
        hand = state["players"][pid]["hand"]
        before = len(hand)
        trio = [card for card in hand if card_key(card) == "qingtou"][:3]
        self.assertIsNone(act(state, pid, type="play", cards=trio))
        self.assertEqual(state["players"][pid]["score"], 12)
        self.assertEqual(len(state["players"][pid]["hand"]), before - 3)
        self.assertNotEqual(actor(state), pid)

    def test_play_rejects_cards_you_do_not_hold(self):
        state = new_game()
        pid = actor(state)
        stolen = state["deck"][0]
        self.assertIsNotNone(act(state, pid, type="play", cards=[stolen]))

    def test_hay_wipes_the_public_row(self):
        state = new_game()
        pid = actor(state)
        state["public"] = [state["deck"].pop(), state["deck"].pop()]
        give(state, pid, "gancao")
        hay = next(card for card in state["players"][pid]["hand"] if card_key(card) == "gancao")
        self.assertIsNone(act(state, pid, type="play", cards=[hay]))
        self.assertEqual(state["public"], [])
        self.assertEqual(len(state["discard"]), 3)

    def test_shaggy_mane_clear_wipes_the_public_row(self):
        state = new_game()
        pid = actor(state)
        state["public"] = [state["deck"].pop()]
        give(state, pid, "maotou")
        card = next(c for c in state["players"][pid]["hand"] if card_key(c) == "maotou")
        self.assertIsNone(act(state, pid, type="play", cards=[card], choice="clear"))
        self.assertEqual(state["public"], [])
        self.assertEqual(state["players"][pid]["score"], 0)

    def test_boar_rampage_hits_every_opponent(self):
        state = new_game()
        pid = actor(state)
        for other in state["turn_order"]:
            if other != pid:
                for _ in range(4):
                    state["players"][other]["hand"].append(state["deck"].pop())
        give(state, pid, "yezhu")
        boar = next(c for c in state["players"][pid]["hand"] if card_key(c) == "yezhu")
        before = {other: len(state["players"][other]["hand"]) for other in state["turn_order"]}
        self.assertIsNone(act(state, pid, type="play", cards=[boar]))
        for other in state["turn_order"]:
            if other == pid:
                continue
            self.assertEqual(len(state["players"][other]["hand"]), before[other] - 2)
        self.assertIn(boar, state["discard"])
        self.assertEqual(state["players"][pid]["score"], 0)

    def test_rampage_rounds_up(self):
        state = new_game()
        pid = actor(state)
        other = next(p for p in state["turn_order"] if p != pid)
        state["players"][other]["hand"] = [state["deck"].pop()]
        give(state, pid, "yezhu")
        boar = next(c for c in state["players"][pid]["hand"] if card_key(c) == "yezhu")
        act(state, pid, type="play", cards=[boar])
        self.assertEqual(state["players"][other]["hand"], [])

    def test_final_round_gives_everyone_one_more_turn(self):
        state = new_game(count=3)
        state["deck"] = state["deck"][:1]
        drawer = actor(state)
        act(state, drawer, type="draw")
        # The drawer's own turn still has to finish, so the counter starts at
        # one more than the player count.
        self.assertEqual(state["final_turns_left"], 4)
        act(state, drawer, type="keep", keep=[0])
        self.assertEqual(state["final_turns_left"], 3)
        # Nothing left to draw, take or play, so the last round is all passes.
        state["deck"] = []
        state["public"] = []
        for pid in state["turn_order"]:
            state["players"][pid]["hand"] = []
        order = state["turn_order"]
        start = order.index(drawer)
        for offset in range(1, 4):
            current = actor(state)
            self.assertEqual(current, order[(start + offset) % 3], f"turn {offset}")
            self.assertEqual(state["stage"], "play")
            self.assertEqual(MushroomPickingGame.get_legal_actions(state, current), ["pass"])
            self.assertIsNone(act(state, current, type="pass"))
        self.assertEqual(state["stage"], "scoring")
        self.assertEqual(state["final_turns_left"], 0)

    def test_pass_only_when_nothing_else_is_legal(self):
        state = new_game()
        pid = actor(state)
        self.assertNotIn("pass", MushroomPickingGame.get_legal_actions(state, pid))
        state["deck"] = []
        state["public"] = []
        state["players"][pid]["hand"] = []
        self.assertEqual(MushroomPickingGame.get_legal_actions(state, pid), ["pass"])
        self.assertIsNone(act(state, pid, type="pass"))

    def test_poison_in_hand_is_a_penalty(self):
        from game.mushroom_picking import _final_scores
        state = new_game(count=2)
        clean, poisoned = state["turn_order"]
        for pid in state["turn_order"]:
            state["players"][pid]["hand"] = []
        give(state, poisoned, "jianshou")
        state["players"][poisoned]["score"] = 0
        scores = _final_scores(state)
        self.assertEqual(scores[poisoned]["total"], -10)
        self.assertEqual(scores[clean]["total"], 0)
        penalty = next(line for line in scores[poisoned]["lines"] if line["points"] < 0)
        self.assertIn("见手青", penalty["label_zh"])


class OrderTest(unittest.TestCase):
    def setUp(self):
        self.state = new_game(count=3, mode=MODE_ORDERS)
        self.pid = actor(self.state)

    def test_setup_deals_two_orders_each_and_two_in_the_centre(self):
        for pid in self.state["turn_order"]:
            self.assertEqual(len(self.state["players"][pid]["orders"]), 2)
        self.assertEqual(len(self.state["order_center"]), 2)
        self.assertEqual(len(self.state["deck"]), 54)

    def test_matching_a_star_requirement(self):
        order_id = next(oid for oid in self.state["players"][self.pid]["orders"]
                        if ORDERS[order_key(oid)]["key"] == "shanhuopu")
        give(self.state, self.pid, "qingtou", "laba")
        hand = self.state["players"][self.pid]["hand"]
        pair = [card for card in hand if card_key(card) in ("qingtou", "laba")][:2]
        self.assertIsNotNone(match_order(order_id, pair))
        self.assertIsNone(match_order(order_id, pair[:1]))
        wrong = [card for card in hand if card_key(card) == "niugan"][:2]
        self.assertIsNone(match_order(order_id, wrong))

    def test_specific_slot_takes_priority(self):
        order_id = grab_order(self.state, self.pid, "houchutang")
        give(self.state, self.pid, "dasuan", "qingtou", "laba")
        hand = self.state["players"][self.pid]["hand"]
        cards = [next(c for c in hand if card_key(c) == key) for key in ("dasuan", "qingtou", "laba")]
        self.assertIsNotNone(match_order(order_id, cards))

    def test_completing_an_order_scores_and_refills(self):
        order_id = next(oid for oid in self.state["players"][self.pid]["orders"]
                        if ORDERS[order_key(oid)]["key"] == "shanhuopu")
        self.state["players"][self.pid]["orders"] = [order_id]
        self.state["public"] = [self.state["deck"].pop()]
        give(self.state, self.pid, "qingtou", "laba")
        hand = self.state["players"][self.pid]["hand"]
        pair = [card for card in hand if card_key(card) in ("qingtou", "laba")][:2]
        self.assertIsNone(act(self.state, self.pid, type="play", order=order_id, cards=pair))
        self.assertEqual(self.state["players"][self.pid]["score"], 5)
        self.assertEqual(self.state["players"][self.pid]["done_orders"], [order_id])
        self.assertEqual(self.state["phase"], "pick_order")
        # 山货铺 pulls one card out of the public row.
        self.assertEqual(len(self.state["players"][self.pid]["hand"]), 1)
        self.assertEqual(self.state["public"], [])
        centre_before = len(self.state["order_center"])
        chosen = self.state["order_center"][0]
        self.assertIsNone(act(self.state, self.pid, type="pick_order", order=chosen))
        self.assertIn(chosen, self.state["players"][self.pid]["orders"])
        self.assertEqual(len(self.state["order_center"]), centre_before)

    def test_wet_market_needs_no_cards(self):
        order_id = next((oid for oid in self.state["players"][self.pid]["orders"]
                         if ORDERS[order_key(oid)]["key"] == "caishichang"), None)
        if order_id is None:
            order_id = next(oid for oid in self.state["order_deck"]
                            if ORDERS[order_key(oid)]["key"] == "caishichang")
            self.state["order_deck"].remove(order_id)
            self.state["players"][self.pid]["orders"] = [order_id]
        self.assertIsNone(act(self.state, self.pid, type="play", order=order_id, cards=[]))
        self.assertEqual(self.state["players"][self.pid]["score"], 0)

    def test_wrong_cards_are_rejected(self):
        order_id = next(oid for oid in self.state["players"][self.pid]["orders"]
                        if ORDERS[order_key(oid)]["slots"])
        give(self.state, self.pid, "songlu")
        card = next(c for c in self.state["players"][self.pid]["hand"] if card_key(c) == "songlu")
        self.assertIsNotNone(act(self.state, self.pid, type="play", order=order_id, cards=[card]))

    def test_extra_turn_from_the_matsutake_pavilion(self):
        order_id = grab_order(self.state, self.pid, "songrongge")
        give(self.state, self.pid, "yangdu", "niugan", "songrong")
        hand = self.state["players"][self.pid]["hand"]
        cards = [next(c for c in hand if card_key(c) == key)
                 for key in ("yangdu", "niugan", "songrong")]
        self.assertIsNone(act(self.state, self.pid, type="play", order=order_id, cards=cards))
        self.assertEqual(self.state["players"][self.pid]["score"], 20)
        if self.state["phase"] == "pick_order":
            act(self.state, self.pid, type="pick_order", order=self.state["order_center"][0])
        self.assertEqual(actor(self.state), self.pid)
        self.assertEqual(self.state["stage"], "play")

    def test_moonlit_pavilion_swap_is_free_and_once_per_turn(self):
        grab_order(self.state, self.pid, "yingyueju")
        give(self.state, self.pid, "qingtou")
        self.state["public"] = [self.state["deck"].pop()]
        mine = next(c for c in self.state["players"][self.pid]["hand"] if card_key(c) == "qingtou")
        theirs = self.state["public"][0]
        self.assertIn("swap", MushroomPickingGame.get_legal_actions(self.state, self.pid))
        self.assertIsNone(act(self.state, self.pid, type="swap", give=mine, take=theirs))
        self.assertIn(theirs, self.state["players"][self.pid]["hand"])
        self.assertIn(mine, self.state["public"])
        self.assertNotIn("swap", MushroomPickingGame.get_legal_actions(self.state, self.pid))
        # The swap never ends the turn.
        self.assertEqual(actor(self.state), self.pid)

    def test_end_game_bonuses(self):
        state = new_game(count=2, mode=MODE_ORDERS)
        pid = state["turn_order"][0]
        player = state["players"][pid]
        player["done_orders"] = ["houchutang#0", "apoguan#0", "baizhenlou#0", "caishichang#0",
                                 "jinxiuzhai#0"]
        player["hand"] = [card for card in state["deck"] if card_key(card) == "songrong"][:1]
        state["config"]["mode"] = MODE_ORDERS
        from game.mushroom_picking import _final_scores
        scores = _final_scores(state)
        # 5 + 8 + 16 + 0 + 16 order points, +2 spicy, +1 hand, +3 three-star, +10 orders
        self.assertEqual(scores[pid]["total"], 45 + 2 + 1 + 3 + 10)


class PrivacyTest(unittest.TestCase):
    def test_other_hands_are_hidden(self):
        state = new_game()
        pid = actor(state)
        give(state, pid, "qingtou")
        view = MushroomPickingGame.get_public_view(state, state["turn_order"][1])
        me = next(p for p in view["players"] if p["player_id"] == pid)
        self.assertIsNone(me["hand"])
        self.assertEqual(me["hand_count"], len(state["players"][pid]["hand"]))

    def test_own_hand_is_visible(self):
        state = new_game()
        pid = actor(state)
        give(state, pid, "qingtou")
        view = MushroomPickingGame.get_public_view(state, pid)
        me = next(p for p in view["players"] if p["player_id"] == pid)
        self.assertEqual(len(me["hand"]), len(state["players"][pid]["hand"]))

    def test_pending_draw_is_private(self):
        state = new_game()
        pid = actor(state)
        act(state, pid, type="draw")
        mine = MushroomPickingGame.get_public_view(state, pid)
        theirs = MushroomPickingGame.get_public_view(state, state["turn_order"][1])
        self.assertEqual(len(mine["pending_draw"]), 3)
        self.assertIsNone(theirs["pending_draw"])
        self.assertEqual(theirs["pending_count"], 3)

    def test_hands_are_revealed_at_scoring(self):
        state = new_game()
        from game.mushroom_picking import _start_scoring
        _start_scoring(state)
        view = MushroomPickingGame.get_public_view(state, state["turn_order"][0])
        for player in view["players"]:
            self.assertIsNotNone(player["hand"])


class PersistenceTest(unittest.TestCase):
    def test_round_trip(self):
        state = new_game()
        pid = actor(state)
        act(state, pid, type="draw")
        payload = MushroomPickingGame.serialize(state)
        restored = MushroomPickingGame.deserialize(payload)
        self.assertEqual(restored, payload)

    def test_rejects_a_broken_payload(self):
        state = new_game()
        payload = MushroomPickingGame.serialize(state)
        payload["turn_index"] = 99
        with self.assertRaises(ValueError):
            MushroomPickingGame.deserialize(payload)

    def test_rejects_an_unknown_card(self):
        state = new_game()
        payload = MushroomPickingGame.serialize(state)
        payload["deck"].append("dragon#0")
        with self.assertRaises(ValueError):
            MushroomPickingGame.deserialize(payload)

    def test_rng_survives_the_round_trip(self):
        state = new_game()
        payload = MushroomPickingGame.serialize(state)
        restored = MushroomPickingGame.deserialize(payload)
        pid = actor(restored)
        act(restored, pid, type="draw")
        self.assertEqual([card_key(c) for c in restored["pending_draw"]],
                         [card_key(c) for c in reversed(state["deck"][-3:])])


class BotTest(unittest.TestCase):
    def _play_out(self, mode, count, seed):
        state = new_game(count=count, seed=seed, mode=mode)
        steps = 0
        while not state["game_over"] and steps < 4000:
            steps += 1
            acted = False
            for pid in state["turn_order"]:
                action = MushroomPickingGame.bot_move(state, pid)
                if action is None:
                    continue
                self.assertIsNone(do(state, pid, action), f"{mode} {action}")
                acted = True
            self.assertTrue(acted or state["game_over"], "the table deadlocked")
        self.assertTrue(state["game_over"])
        return state

    def test_basic_mode_finishes(self):
        for count in (2, 3, 4):
            for seed in (1, 2, 3):
                state = self._play_out(MODE_BASIC, count, seed)
                self.assertTrue(state["winners"])

    def test_orders_mode_finishes(self):
        for count in (2, 3, 4):
            for seed in (1, 2, 3):
                state = self._play_out(MODE_ORDERS, count, seed)
                self.assertTrue(state["winners"])

    def test_bot_never_plays_an_illegal_combination(self):
        state = new_game(seed=5)
        pid = actor(state)
        give(state, pid, "dasuan", "huoli", "yezhu", "songlu", "jianshou", "maotou")
        action = MushroomPickingGame.bot_move(state, pid)
        self.assertIsNotNone(action)
        if action["type"] == "play":
            self.assertTrue(play_is_legal(action["cards"], action.get("choice")))
            self.assertIsNone(do(state, pid, action))

    def test_bot_scores_something_in_basic_mode(self):
        state = self._play_out(MODE_BASIC, 3, 9)
        best = max(entry["total"] for entry in state["final_scores"].values())
        self.assertGreater(best, 0)


if __name__ == "__main__":
    unittest.main()
