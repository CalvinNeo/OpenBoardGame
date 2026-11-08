import unittest

from game.witchs_brew import WitchsBrewGame
from game.witchs_brew_ai import (
    choose_lead,
    choose_loss,
    choose_response,
    choose_roles,
    claim_tendency,
    hold_probability,
    survival_probability,
)


def players(count=3):
    return [
        {"player_id": f"p{index}", "name": f"P{index}", "seat": index, "is_bot": True}
        for index in range(count)
    ]


def base_state(count=3):
    state = WitchsBrewGame.init_game({}, players(count))
    state["disabled_roles"] = []
    state["starter_player"] = "p0"
    return state


ALL_ROLES = (
    "wolf_keeper", "snake_hunter", "herb_collector", "alchemist", "fortune_teller",
    "assistant", "wizard", "witch", "druid", "warlock", "cutpurse", "begging_monk",
)


def respond_state(count, me, role, passed=(), participants=("p0",), hand=None, resources=None):
    """A state where `me` is being asked to answer `role`.

    Every other player keeps a plausible five card hand, because the belief
    model reasons about how many cards each opponent still holds.
    """
    state = base_state(count)
    state["phase"] = "respond"
    state["active_role"] = role
    state["round_starter"] = "p0"
    state["claimant"] = "p0"
    state["round_participants"] = list(participants)
    state["round_passed"] = list(passed)
    state["favor_players"] = []
    state["current_player"] = me
    state["players"][me]["hand_roles"] = list(hand or [role])
    for index in range(count):
        player_id = f"p{index}"
        if player_id != me:
            state["players"][player_id]["hand_roles"] = list(ALL_ROLES[:5])
    if resources is not None:
        state["players"][me]["resources"] = {
            "red": 0, "green": 0, "white": 0, "gold": 0, "vial": 0, **resources
        }
    return state


def view_of(state, player_id):
    return WitchsBrewGame.get_public_view(state, player_id)


class HoldBeliefTests(unittest.TestCase):
    def test_a_role_already_played_cannot_be_held_again(self):
        state = respond_state(3, "p1", "wolf_keeper", passed=("p2",))
        state["players"]["p2"]["played_roles"] = ["wolf_keeper"]
        state["players"]["p2"]["hand_roles"] = ["wizard", "witch", "druid", "warlock"]
        self.assertEqual(hold_probability(view_of(state, "p1"), "p2", "wolf_keeper"), 0.0)

    def test_a_player_who_passed_this_round_is_known_to_be_empty(self):
        state = respond_state(3, "p1", "wolf_keeper", passed=("p2",))
        self.assertEqual(hold_probability(view_of(state, "p1"), "p2", "wolf_keeper"), 0.0)

    def test_hold_chance_tracks_the_cards_still_in_hand(self):
        state = respond_state(3, "p1", "wolf_keeper")
        full_hand = hold_probability(view_of(state, "p1"), "p2", "wolf_keeper")
        self.assertGreater(full_hand, 0.0)
        state["players"]["p2"]["hand_roles"] = state["players"]["p2"]["hand_roles"][:2]
        self.assertLess(hold_probability(view_of(state, "p1"), "p2", "wolf_keeper"), full_hand)

    def test_survival_drops_as_more_players_still_have_to_answer(self):
        state = respond_state(5, "p1", "wolf_keeper")
        view = view_of(state, "p1")
        one = survival_probability(view, "wolf_keeper", ["p2"])
        two = survival_probability(view, "wolf_keeper", ["p2", "p3"])
        three = survival_probability(view, "wolf_keeper", ["p2", "p3", "p4"])
        self.assertGreater(one, two)
        self.assertGreater(two, three)

    def test_the_last_player_to_answer_always_claims(self):
        self.assertEqual(claim_tendency(0), 1.0)
        self.assertLess(claim_tendency(1), 1.0)
        self.assertLess(claim_tendency(3), claim_tendency(1))


class RespondTests(unittest.TestCase):
    def test_the_last_responder_claims_the_full_action(self):
        state = respond_state(3, "p1", "wolf_keeper", passed=("p2",))
        action = WitchsBrewGame.bot_move(state, "p1")
        self.assertEqual(action, {"type": "respond", "response": "claim_full"})

    def test_an_early_responder_settles_for_a_thin_cauldron_favor(self):
        # The copper top pays 2 VP for one white, so the favor is only two gold
        # worse. Answering first against three live players is not worth it.
        state = respond_state(5, "p1", "wizard", resources={"white": 4, "gold": 6})
        action = WitchsBrewGame.bot_move(state, "p1")
        self.assertEqual(action["response"], "take_favor")

    def test_the_same_cauldron_is_claimed_when_answering_last(self):
        state = respond_state(
            5, "p4", "wizard", passed=("p1", "p2", "p3"), resources={"white": 4, "gold": 6}
        )
        action = WitchsBrewGame.bot_move(state, "p4")
        self.assertEqual(action["response"], "claim_full")

    def test_takes_the_favor_when_the_raid_would_collect_nothing(self):
        # Nobody holds gold, so the Cutpurse full action is worth nothing while
        # the favor still softens the tax.
        state = respond_state(3, "p1", "cutpurse", passed=("p2",))
        for player_id in ("p0", "p2"):
            state["players"][player_id]["resources"]["gold"] = 0
        state["shelves"]["gold_shelf"] = [{"id": "g", "threshold": 6, "vp": 5, "raven": True}]
        action = WitchsBrewGame.bot_move(state, "p1")
        self.assertEqual(action["response"], "take_favor")

    def test_claims_the_raid_that_finishes_the_shelf(self):
        state = respond_state(3, "p1", "cutpurse", passed=("p2",))
        state["shelves"]["gold_shelf"] = [{"id": "g", "threshold": 3, "vp": 5, "raven": True}]
        state["shelf_stored"]["gold_shelf"]["gold"] = 2
        state["players"]["p2"]["resources"]["gold"] = 3
        action = WitchsBrewGame.bot_move(state, "p1")
        self.assertEqual(action["response"], "claim_full")

    def test_response_is_deterministic(self):
        state = respond_state(5, "p1", "wizard", resources={"white": 4, "gold": 6})
        self.assertEqual(
            WitchsBrewGame.bot_move(state, "p1"), WitchsBrewGame.bot_move(state, "p1")
        )


class SelectionTests(unittest.TestCase):
    def test_selection_never_keeps_a_disabled_role(self):
        state = base_state(3)
        state["phase"] = "select_roles"
        state["disabled_roles"] = ["wizard", "witch"]
        chosen = WitchsBrewGame.bot_move(state, "p0")["roles"]
        self.assertEqual(len(chosen), 5)
        self.assertEqual(len(set(chosen)), 5)
        self.assertFalse({"wizard", "witch"} & set(chosen))

    def test_selection_values_the_cauldron_it_can_already_pay_for(self):
        state = base_state(3)
        state["phase"] = "select_roles"
        state["players"]["p0"]["resources"] = {"red": 0, "green": 0, "white": 5, "gold": 0, "vial": 0}
        chosen = choose_roles(view_of(state, "p0"))
        # Copper is bought with white, and this player is swimming in it.
        self.assertIn("wizard", chosen)

    def test_lead_prefers_the_role_nobody_else_can_steal(self):
        state = base_state(3)
        state["phase"] = "play_role"
        state["current_player"] = "p0"
        state["players"]["p0"]["hand_roles"] = ["wolf_keeper", "herb_collector"]
        # p1 has already burned wolf keeper this set, so it cannot be contested.
        state["players"]["p1"]["hand_roles"] = ["herb_collector"]
        state["players"]["p1"]["played_roles"] = ["wolf_keeper", "wizard", "witch", "druid"]
        state["players"]["p2"]["hand_roles"] = ["herb_collector"]
        self.assertEqual(WitchsBrewGame.bot_move(state, "p0")["role"], "wolf_keeper")

    def test_lead_is_deterministic(self):
        state = base_state(3)
        state["phase"] = "play_role"
        state["current_player"] = "p0"
        state["players"]["p0"]["hand_roles"] = ["wolf_keeper", "herb_collector", "wizard"]
        view = view_of(state, "p0")
        self.assertEqual(choose_lead(view), choose_lead(view))


class ResolutionTests(unittest.TestCase):
    def setUp(self):
        self.state = base_state(3)

    def resolve(self, role, resources, strength="full", spell=None):
        self.state["phase"] = "resolve_action"
        self.state["current_player"] = "p0"
        self.state["pending_action"] = {"player_id": "p0", "role": role, "strength": strength}
        self.state["players"]["p0"]["resources"] = {
            "red": 0, "green": 0, "white": 0, "gold": 0, "vial": 0, **resources
        }
        if spell is not None:
            self.state["spell_deck"] = [spell]
        return WitchsBrewGame.bot_move(self.state, "p0")

    def test_alchemist_spends_the_ingredient_it_needs_least(self):
        # Copper wants white, so green is the cheaper thing to sell for gold.
        action = self.resolve("alchemist", {"green": 1, "white": 1})
        self.assertEqual(action["pay_ingredient"], "green")

    def test_buys_the_extra_vial_when_an_ingredient_is_spare(self):
        action = self.resolve("wizard", {"white": 3})
        self.assertEqual(action.get("extra_ingredient"), "white")

    def test_cutpurse_tops_the_shelf_up_to_its_threshold_only(self):
        self.state["shelves"]["gold_shelf"] = [{"id": "g", "threshold": 5, "vp": 4, "raven": False}]
        self.state["shelf_stored"]["gold_shelf"]["gold"] = 3
        for player_id in ("p1", "p2"):
            self.state["players"][player_id]["resources"]["gold"] = 0
        action = self.resolve("cutpurse", {"gold": 9})
        self.assertEqual(action["augment_gold"], 2)

    def test_cutpurse_adds_nothing_once_the_shelf_is_full(self):
        self.state["shelves"]["gold_shelf"] = [{"id": "g", "threshold": 3, "vp": 4, "raven": False}]
        self.state["shelf_stored"]["gold_shelf"]["gold"] = 3
        for player_id in ("p1", "p2"):
            self.state["players"][player_id]["resources"]["gold"] = 0
        action = self.resolve("cutpurse", {"gold": 9})
        self.assertEqual(action["augment_gold"], 0)

    def test_copia_takes_the_colour_the_cauldrons_need(self):
        self.state["cauldrons"]["copper"] = [{"id": "c", "cost": {"white": 1}, "vp": 2, "raven": False}]
        action = self.resolve("warlock", {}, spell="copia")
        self.assertEqual(sum(action["gain_ingredients"].values()), 3)
        self.assertGreaterEqual(action["gain_ingredients"]["white"], 1)

    def test_skips_a_cauldron_it_cannot_pay_for(self):
        action = self.resolve("druid", {"red": 2}, strength="favor")
        self.assertTrue(action.get("skip"))


class LossTests(unittest.TestCase):
    def test_gives_up_the_ingredient_the_cauldrons_need_least(self):
        state = base_state(3)
        state["phase"] = "choose_loss"
        state["current_player"] = "p0"
        state["monk_resolution"] = {"actor": "p1", "pending_losses": [{"player_id": "p0", "amount": 1}], "augment": {}}
        state["players"]["p0"]["resources"] = {"red": 2, "green": 2, "white": 2, "gold": 0, "vial": 0}
        state["cauldrons"]["copper"] = [{"id": "c", "cost": {"white": 1}, "vp": 2, "raven": False}]
        state["cauldrons"]["iron"] = []
        state["cauldrons"]["silver"] = []
        action = WitchsBrewGame.bot_move(state, "p0")
        self.assertEqual(sum(action["loss"].values()), 1)
        self.assertNotEqual(action["loss"]["white"], 1)
        _, error = WitchsBrewGame.apply_action(state, "p0", action)
        self.assertIsNone(error)


class SelfPlayTests(unittest.TestCase):
    def test_three_bots_finish_a_whole_game(self):
        state = WitchsBrewGame.init_game({}, players(3))
        ids = ["p0", "p1", "p2"]
        for _ in range(3000):
            if state.get("game_over"):
                break
            acted = False
            for player_id in ids:
                action = WitchsBrewGame.bot_move(state, player_id)
                if not action:
                    continue
                _, error = WitchsBrewGame.apply_action(state, player_id, action)
                self.assertIsNone(error, f"{player_id} {action} -> {error}")
                acted = True
            self.assertTrue(acted or state.get("game_over"), "game stalled with nobody able to act")
        self.assertTrue(state.get("game_over"), "bots did not reach the end of the game")
        self.assertTrue(state.get("winner"))

    def test_five_bots_finish_a_whole_game(self):
        state = WitchsBrewGame.init_game({}, players(5))
        ids = [f"p{index}" for index in range(5)]
        for _ in range(4000):
            if state.get("game_over"):
                break
            acted = False
            for player_id in ids:
                action = WitchsBrewGame.bot_move(state, player_id)
                if not action:
                    continue
                _, error = WitchsBrewGame.apply_action(state, player_id, action)
                self.assertIsNone(error, f"{player_id} {action} -> {error}")
                acted = True
            self.assertTrue(acted or state.get("game_over"), "game stalled with nobody able to act")
        self.assertTrue(state.get("game_over"), "bots did not reach the end of the game")


if __name__ == "__main__":
    unittest.main()
