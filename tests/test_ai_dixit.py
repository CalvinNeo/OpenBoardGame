import tempfile
import unittest
from pathlib import Path

from game.ai_dixit import AiDixitGame


class AiDixitTests(unittest.TestCase):
    def _write_cards(self, root: Path, deck_id: str, count: int) -> None:
        deck_path = root / deck_id
        deck_path.mkdir(parents=True, exist_ok=True)
        for idx in range(count):
            (deck_path / f"card_{idx}.jpg").write_bytes(b"")

    def _players(self):
        return [
            {"player_id": "p1", "name": "Alice", "seat": 0, "is_bot": False},
            {"player_id": "p2", "name": "Bob", "seat": 1, "is_bot": False},
            {"player_id": "p3", "name": "Cara", "seat": 2, "is_bot": False},
        ]

    def test_init_game_deals_hands(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            root = Path(tmpdir)
            self._write_cards(root, "base", 9)
            state = AiDixitGame.init_game(
                {"deck_root": str(root), "selected_decks": ["base"], "hand_size": 2, "target_score": 10},
                self._players(),
            )
        self.assertEqual(state["phase"], "story")
        self.assertEqual(state["storyteller_index"], 0)
        self.assertEqual(state["turn_order"], ["p1", "p2", "p3"])
        for pid in ("p1", "p2", "p3"):
            self.assertEqual(len(state["players"][pid]["hand"]), 2)
            self.assertEqual(state["players"][pid]["score"], 0)

    def test_init_game_requires_enough_cards(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            root = Path(tmpdir)
            self._write_cards(root, "base", 3)
            with self.assertRaises(ValueError):
                AiDixitGame.init_game(
                    {"deck_root": str(root), "selected_decks": ["base"], "hand_size": 2},
                    self._players(),
                )

    def test_submit_story_requires_storyteller(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            root = Path(tmpdir)
            self._write_cards(root, "base", 9)
            state = AiDixitGame.init_game(
                {"deck_root": str(root), "selected_decks": ["base"], "hand_size": 2},
                self._players(),
            )
        non_story_card = state["players"]["p2"]["hand"][0]
        _, error = AiDixitGame.apply_action(
            state,
            "p2",
            {"type": "submit_story", "card_id": non_story_card, "clue": "hint"},
        )
        self.assertEqual(error, "not storyteller")

    def _vote_state(self):
        return {
            "players": {
                "p1": {"score": 0, "hand": [], "color": "#f00"},
                "p2": {"score": 0, "hand": [], "color": "#0f0"},
                "p3": {"score": 0, "hand": [], "color": "#00f"},
            },
            "player_meta": {
                "p1": {"name": "Alice", "seat": 0, "is_bot": False},
                "p2": {"name": "Bob", "seat": 1, "is_bot": False},
                "p3": {"name": "Cara", "seat": 2, "is_bot": False},
            },
            "turn_order": ["p1", "p2", "p3"],
            "storyteller_index": 0,
            "round": 1,
            "phase": "vote",
            "clue": "mystery",
            "story_card": "base/story.jpg",
            "submissions": {
                "p1": "base/story.jpg",
                "p2": "base/p2.jpg",
                "p3": "base/p3.jpg",
            },
            "pool_cards": ["base/story.jpg", "base/p2.jpg", "base/p3.jpg"],
            "votes": {},
            "deck": [],
            "discard": [],
            "last_result": None,
            "config": {"hand_size": 6, "target_score": 30, "reshuffle_discard": False},
            "game_over": False,
            "winner": [],
        }

    def test_scoring_all_correct(self):
        state = self._vote_state()
        AiDixitGame.apply_action(state, "p2", {"type": "submit_vote", "card_id": "base/story.jpg"})
        AiDixitGame.apply_action(state, "p3", {"type": "submit_vote", "card_id": "base/story.jpg"})
        self.assertEqual(state["last_result"]["case"], "all")
        self.assertEqual(state["players"]["p1"]["score"], 0)
        self.assertEqual(state["players"]["p2"]["score"], 2)
        self.assertEqual(state["players"]["p3"]["score"], 2)

    def test_scoring_none_correct(self):
        state = self._vote_state()
        AiDixitGame.apply_action(state, "p2", {"type": "submit_vote", "card_id": "base/p3.jpg"})
        AiDixitGame.apply_action(state, "p3", {"type": "submit_vote", "card_id": "base/p2.jpg"})
        self.assertEqual(state["last_result"]["case"], "none")
        self.assertEqual(state["players"]["p1"]["score"], 0)
        self.assertEqual(state["players"]["p2"]["score"], 3)
        self.assertEqual(state["players"]["p3"]["score"], 3)

    def test_scoring_partial(self):
        state = self._vote_state()
        AiDixitGame.apply_action(state, "p2", {"type": "submit_vote", "card_id": "base/story.jpg"})
        AiDixitGame.apply_action(state, "p3", {"type": "submit_vote", "card_id": "base/p2.jpg"})
        self.assertEqual(state["last_result"]["case"], "partial")
        self.assertEqual(state["players"]["p1"]["score"], 3)
        self.assertEqual(state["players"]["p2"]["score"], 4)
        self.assertEqual(state["players"]["p3"]["score"], 0)

    def test_vote_cannot_target_own_card(self):
        state = self._vote_state()
        _, error = AiDixitGame.apply_action(state, "p2", {"type": "submit_vote", "card_id": "base/p2.jpg"})
        self.assertEqual(error, "cannot vote for your card")
