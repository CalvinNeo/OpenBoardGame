import unittest

from game import get_game
from game.rebel_princess import ROUND_CARDS, RebelPrincessGame, _deal_new_round


def _players(count=4):
    return [{"player_id": f"p{i}", "name": f"P{i}", "seat": i} for i in range(count)]


def _submit_passes(state):
    for pid in state["turn_order"]:
        view = RebelPrincessGame.get_public_view(state, pid)
        card_ids = [card["id"] for card in view["hand"][: view["pass_required"]]]
        _events, error = RebelPrincessGame.apply_action(state, pid, {"type": "pass_cards", "card_ids": card_ids})
        if error:
            raise AssertionError(error)


def _auto_step_round(state, limit=300):
    for _ in range(limit):
        if state["phase"] in ("round_pause", "game_over"):
            return
        moved = False
        for pid in state["turn_order"]:
            view = RebelPrincessGame.get_public_view(state, pid)
            actions = view["legal_actions"]
            if not actions:
                continue
            if "setup_choice" in actions:
                if state["phase"] == "reveal_suit":
                    action = {"type": "setup_choice", "suit": "queen"}
                elif state["phase"] == "split_hand":
                    action = {"type": "setup_choice", "card_ids": [card["id"] for card in view["hand"][: len(view["hand"]) // 2]]}
                else:
                    action = {"type": "setup_choice", "card_id": view["hand"][0]["id"]}
            elif "choose_card" in actions:
                action = {"type": "choose_card", "card_id": view["hand"][0]["id"]}
            elif "play_card" in actions:
                action = {"type": "play_card", "card_id": view["legal_cards"][0]["id"]}
            elif "skip" in actions:
                action = {"type": "skip"}
            elif "next_round_ready" in actions:
                action = {"type": "next_round_ready"}
            else:
                continue
            _events, error = RebelPrincessGame.apply_action(state, pid, action)
            if error:
                raise AssertionError((state["phase"], pid, actions, action, error))
            moved = True
            break
        if not moved:
            raise AssertionError(f"round stuck in {state['phase']}")
    raise AssertionError(f"round did not finish from {state['phase']}")


class RebelPrincessTests(unittest.TestCase):
    def test_registered(self):
        definition = get_game("rebel_princess")
        self.assertIsNotNone(definition)
        self.assertEqual(definition.min_players, 3)
        self.assertEqual(definition.max_players, 6)

    def test_initial_pass_phase_hides_other_hands(self):
        state = RebelPrincessGame.init_game({}, _players(4))
        view = RebelPrincessGame.get_public_view(state, "p0")
        self.assertEqual(view["phase"], "pass")
        self.assertEqual(len(view["hand"]), 10)
        other = next(player for player in view["players"] if player["player_id"] == "p1")
        self.assertEqual(other["hand_count"], 10)
        self.assertNotIn("hand", other)

    def test_all_round_cards_can_finish_one_round(self):
        for round_card in ROUND_CARDS:
            with self.subTest(round_card=round_card["id"]):
                state = RebelPrincessGame.init_game({}, _players(4))
                state["round_cards"][0] = round_card["id"]
                _deal_new_round(state, state["turn_order"][0], 0)
                _submit_passes(state)
                _auto_step_round(state)
                self.assertEqual(state["phase"], "round_pause")


if __name__ == "__main__":
    unittest.main()

