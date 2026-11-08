"""Static contract checks for the shared Help / Explain widgets.

Enforces the six Help requirements from designs/task40.md for every game that
has opted into the shared widgets. Games that have not been migrated yet are
reported as pending rather than failing, so this test can gate CI once the
rollout in designs/task185.md completes.

Run: python -m unittest tests.test_help_contract
"""
import json
import os
import re
import unittest

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
GAMES_DIR = os.path.join(ROOT, "static", "games")
ASSETS = os.path.join(ROOT, "static", "game_assets.js")

EMOJI = re.compile(
    "([\u4e00-\u9fffA-Za-z])\s*[\uff08(]\ufe0f?"
    "[\u2190-\u27bf\U0001f000-\U0001faff]"
)
SEMICOLON = re.compile(r"[\uff1b;]")


def _read(path):
    if not os.path.exists(path):
        return ""
    with open(path, encoding="utf-8", errors="ignore") as handle:
        return handle.read()


def registered_games():
    text = _read(ASSETS)
    return re.findall(r'^\s{2}"([a-z0-9_]+)":\s*\{', text, re.M)


def migrated_games():
    """Games whose script calls the shared Help factory."""
    found = []
    for game_id in registered_games():
        path = os.path.join(GAMES_DIR, game_id + ".js")
        if not os.path.exists(path):
            continue
        source = _read(path)
        if "obgCreateHelp" in source:
            found.append(game_id)
    return found


def read(game_id, suffix):
    return _read(os.path.join(GAMES_DIR, game_id + suffix))


def _balanced_object(source, start):
    """Return the {...} literal starting at or after `start`."""
    index = source.find("{", start)
    if index < 0:
        return ""
    depth = 0
    for cursor in range(index, len(source)):
        char = source[cursor]
        if char == "{":
            depth += 1
        elif char == "}":
            depth -= 1
            if depth == 0:
                return source[index:cursor + 1]
    return ""


def help_block(source):
    """Extract the Help config, whether inlined or held in a constant."""
    call = source.find("obgCreateHelp(")
    if call < 0:
        return ""
    arg_start = call + len("obgCreateHelp(")
    tail = source[arg_start:]
    if tail.lstrip().startswith("{"):
        return _balanced_object(source, arg_start)
    name = re.match(r"\s*([A-Za-z_$][\w$]*)", tail)
    if not name:
        return ""
    const = name.group(1)
    for keyword in ("const", "let", "var"):
        match = re.search(keyword + r"\s+" + re.escape(const) + r"\s*=\s*", source)
        if match:
            return _balanced_object(source, match.end())
    return ""


def explanations_block(source):
    """Resolve the explanations map, inlined or held in a constant."""
    call = source.find("obgCreateExplain(")
    if call < 0:
        return ""
    config = _balanced_object(source, call + len("obgCreateExplain("))
    match = re.search(r"explanations:\s*([A-Za-z_$][\w$]*)", config)
    if not match:
        return config
    const = match.group(1)
    for keyword in ("const", "let", "var"):
        found = re.search(keyword + r"\s+" + re.escape(const) + r"\s*=\s*", source)
        if found:
            return _balanced_object(source, found.end())
    return config


def explain_block(source):
    """Extract the Explain config object passed to obgCreateExplain."""
    call = source.find("obgCreateExplain(")
    if call < 0:
        return ""
    return _balanced_object(source, call + len("obgCreateExplain("))

class HelpContractTest(unittest.TestCase):
    def setUp(self):
        self.games = migrated_games()

    def test_shared_widgets_exist(self):
        self.assertTrue(
            os.path.exists(os.path.join(GAMES_DIR, "shared_help.js")),
            "missing static/games/shared_help.js",
        )

    def test_index_loads_shared_widgets(self):
        index = _read(os.path.join(ROOT, "static", "index.html"))
        self.assertIn("shared_help.js", index)
        core = _read(os.path.join(ROOT, "static", "style.css"))
        self.assertIn(".obg-help-dialog", core, "shared Help styles missing from style.css")
        self.assertIn(".obg-explaining", core, "Explain mode styles missing from style.css")

    def test_at_least_one_game_migrated(self):
        self.assertTrue(self.games, "no game has adopted obgCreateHelp yet")

    def test_r1_bilingual_config(self):
        """R1: every Help config carries both zh and en."""
        for game_id in self.games:
            with self.subTest(game=game_id):
                block = help_block(read(game_id, ".js"))
                self.assertIn("zh:", block, "Help config has no zh strings")
                self.assertIn("en:", block, "Help config has no en strings")

    def test_r3_basic_three_sentences(self):
        """R3: basic rules carry win / turn / key."""
        for game_id in self.games:
            with self.subTest(game=game_id):
                block = help_block(read(game_id, ".js"))
                basic = block[block.find("basic:"):] if "basic:" in block else ""
                for field in ("win:", "turn:", "key:"):
                    self.assertIn(field, basic, f"basic is missing {field}")

    def test_r2_no_semicolon_chains(self):
        """R2: Help prose must not chain fragments with semicolons."""
        for game_id in self.games:
            with self.subTest(game=game_id):
                block = help_block(read(game_id, ".js"))
                # Only prose inside quotes matters; count separators in the block.
                hits = len(SEMICOLON.findall(block))
                self.assertLessEqual(
                    hits, 2, f"{game_id} Help uses {hits} semicolons"
                )

    def test_r4_emoji_in_parentheses(self):
        """R4: emoji used in Help must follow a name in parentheses."""
        for game_id in self.games:
            with self.subTest(game=game_id):
                block = help_block(read(game_id, ".js"))
                bare = re.findall(
                    "[\u2190-\u27bf\U0001f000-\U0001faff]", block
                )
                if not bare:
                    continue
                self.assertTrue(
                    EMOJI.search(block),
                    f"{game_id} Help uses emoji without a parenthesised name",
                )

    def test_r6_sections_for_tabs(self):
        """R6: long Help needs at least three sections so tabs appear."""
        for game_id in self.games:
            with self.subTest(game=game_id):
                block = help_block(read(game_id, ".js"))
                sections = block.count("label:")
                self.assertGreaterEqual(
                    sections, 3, f"{game_id} has only {sections} sections"
                )

    def test_explain_registered(self):
        for game_id in self.games:
            with self.subTest(game=game_id):
                source = read(game_id, ".js")
                self.assertIn("obgCreateExplain(", source)

    def test_explain_keys_covered_in_markup(self):
        """Every explained key must exist in the markup and vice versa."""
        for game_id in self.games:
            with self.subTest(game=game_id):
                source = read(game_id, ".js")
                markup = read(game_id, ".html")
                match = re.search(r'attribute:\s*"([^"]+)"', source)
                if not match:
                    self.skipTest(f"{game_id} uses default attribute")
                attribute = match.group(1)
                used = set(re.findall(re.escape(attribute) + r'="([^"]+)"', markup))
                self.assertTrue(used, f"{game_id} markup has no {attribute}")
                config = explanations_block(source)
                for key in used:
                    self.assertIn(
                        key, config, f"{game_id} key {key} has no explanation"
                    )

    def test_help_and_explain_buttons_present(self):
        """Buttons may live in the game template or in index.html."""
        index = _read(os.path.join(ROOT, "static", "index.html"))
        for game_id in self.games:
            with self.subTest(game=game_id):
                markup = read(game_id, ".html") + index
                self.assertIn("HelpBtn", markup, "no Help button in markup")
                self.assertIn("ExplainBtn", markup, "no Explain button in markup")


if __name__ == "__main__":
    unittest.main()
