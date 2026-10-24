# Dice Throne: Season Two additions

The roster now contains the eight Season One Rerolled heroes and four Season Two
heroes: **Gunslinger (枪手), Samurai (武士), Vampire Lord (吸血鬼领主), and Seraph
(炽天使)**. Both seasons can duel each other; duplicate hero choices remain illegal.

## Rules scope

This continues the existing **simplified digital adaptation**, not a reproduction
of the printed game. Each new hero has eight offensive abilities, a defensive
ability, six numbered dice faces using a local 3/2/1 symbol distribution, two
hero-specific action cards, and level II/III upgrades for non-ultimate abilities.
Ability names, values, distributions, decks and automatic token timing follow the
in-game descriptions. Printed passive abilities and optional token modes not
described here are not implemented.

Hero identities and token themes were checked against the publisher-linked
[Rulepop reference](https://dice-throne.rulepop.com/#heroes), especially its
[Gunslinger](https://dice-throne.rulepop.com/#hero/gunslinger),
[Samurai](https://dice-throne.rulepop.com/#hero/samurai),
[Vampire Lord](https://dice-throne.rulepop.com/#hero/vampire-lord) and
[Seraph](https://dice-throne.rulepop.com/#hero/seraph) entries. No printed artwork or
commercial UI assets are included.

## Implemented token timing

| Hero | Local automatic effects |
| --- | --- |
| Gunslinger | Reload spends one token on a non-ultimate attack for half a fresh die roll, rounded up, in bonus damage. Persistent Bounty adds 1 damage and 1 CP to the attacker, including attacks that the defender later avoids. |
| Samurai | Honor spends all stacks for +2 damage with one or +5 with two. Shame removes all its stacks and subtracts 1 damage per stack, floored at zero. Back Strike spends one token before status mitigation to return half a fresh die roll, rounded up. |
| Vampire Lord | Blood Power spends four stacks for healing equal to resolved attack damage; otherwise it spends one for +2 damage. Bleed rolls once per stack in upkeep: 1–4 deals 1 damage, 5–6 removes that stack. Mesmerize checks once when the opponent confirms their dice: 5–6 rerolls their highest-numbered die, leftmost on ties, even if kept. |
| Seraph | Flight spends one token against incoming non-ultimate attack damage and rolls two dice; any 6 avoids it. Holy Presence deals 1 persistent damage per stack to the opponent during the owner's upkeep. Blinding Light checks before a non-ultimate offensive ability: 1 cancels the entire ability, 2–3 halves final attack damage rounded down, 4–6 does nothing. |

New attack modifiers do not change ultimate damage or spend tokens on an ultimate.
New defensive tokens do not prevent or retaliate against ultimate damage.
Normal and undefendable attacks share these token rules. Effects granted by an
attack settle after its damage and do not retroactively modify that attack.
Bleed resolves before Holy Presence in upkeep; lethal upkeep stops further effects
and income. Healing remains capped at 50 and CP at 15.

The existing per-player hidden decks, revision checks, round-review handshake and
seeded RNG persistence are unchanged. Existing version-2 saves need no migration.
The public hero catalog adds `season`, and pending attacks optionally carry
`lifesteal`; older attacks without that field settle normally.

## UI and checks

The picker has All / Season 1 / Season 2 filters and an independently scrollable
list. Selection preserves list position and uses an in-place confirmation. Hero
references, Help, Explain and token tooltips use the same server-supplied catalog.

Run `python -m unittest tests.test_dice_throne tests.test_dice_throne_heroes` for
the complete hero roster, 96 abilities, 66 unique bot pairings, token edge cases,
private decks, upgrades and JSON save/restore. Run
`node tests/dice_throne.browser.cjs` against a local server (configured through
`ROOM_TEST_URL`, `PLAYWRIGHT_MODULE` and `PYTHON` when needed) for the picker, hero
references, mobile/desktop layout and live two-player interactions.

Validation completed with 56 passing tests using the two game suites plus
`tests.test_frontend_style_assets`. Browser checks passed for 33 states at 320,
390, 768, 1024 and 1440px: all twelve hero references, season filters, preserved
scroll position, touch scrolling without selection, status tooltips, Help/Explain,
Esc, reduced motion and a live Gunslinger/Seraph room. Screenshots were visually
checked at mobile and desktop widths. Real-device Safari has not been tested.

Changed files: `game/dice_throne_data.py`, `game/dice_throne.py`,
`static/games/dice_throne.html`, `static/games/dice_throne.js`,
`static/games/dice_throne.css`, `static/game_assets.js`,
`tests/test_dice_throne_heroes.py`, `tests/dice_throne.browser.cjs`,
`designs/dice_throne_contract.json`, and this document. No new game registration
was added, so the existing game weight and development-order entry are unchanged.
