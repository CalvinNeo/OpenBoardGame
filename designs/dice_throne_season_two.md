# Dice Throne: Season Two additions

The roster now contains **16 heroes**: all eight Season One Rerolled heroes and
all eight Season Two heroes. The latest additions are **Artificer (工匠), Huntress
(女猎手), Tactician (战术家), and Cursed Pirate (诅咒海盗)**, joining Gunslinger
(枪手), Samurai (武士), Vampire Lord (吸血鬼领主), and Seraph (炽天使). Both seasons
can duel each other; duplicate hero choices remain illegal.

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
[Vampire Lord](https://dice-throne.rulepop.com/#hero/vampire-lord),
[Seraph](https://dice-throne.rulepop.com/#hero/seraph),
[Artificer](https://dice-throne.rulepop.com/#hero/artificer),
[Huntress](https://dice-throne.rulepop.com/#hero/huntress),
[Tactician](https://dice-throne.rulepop.com/#hero/tactician), and
[Cursed Pirate](https://dice-throne.rulepop.com/#hero/cursed-pirate) entries. No
printed artwork or commercial UI assets are included.

## Implemented token timing

| Hero | Local automatic effects |
| --- | --- |
| Gunslinger | Reload spends one token on a non-ultimate attack for half a fresh die roll, rounded up, in bonus damage. Persistent Bounty adds 1 damage and 1 CP to the attacker, including attacks that the defender later avoids. |
| Samurai | Honor spends all stacks for +2 damage with one or +5 with two. Shame removes all its stacks and subtracts 1 damage per stack, floored at zero. Back Strike spends one token before status mitigation to return half a fresh die roll, rounded up. |
| Vampire Lord | Blood Power spends four stacks for healing equal to resolved attack damage; otherwise it spends one for +2 damage. Bleed rolls once per stack in upkeep: 1–4 deals 1 damage, 5–6 removes that stack. Mesmerize checks once when the opponent confirms their dice: 5–6 rerolls their highest-numbered die, leftmost on ties, even if kept. |
| Seraph | Flight spends one token against incoming non-ultimate attack damage and rolls two dice; any 6 avoids it. Holy Presence deals 1 persistent damage per stack to the opponent during the owner's upkeep. Blinding Light checks before a non-ultimate offensive ability: 1 cancels the entire ability, 2–3 halves final attack damage rounded down, 4–6 does nothing. |
| Artificer | Starts with 2 Synth and Shock Bot. Each bot activation costs 1 Synth. Shock Bot adds 2 non-ultimate attack damage. Heal Bot heals 2 before remaining non-ultimate attack damage, after other status mitigation; fully prevented attacks spend no Synth. Nanobot detonates all opposing Nanites in the owner's upkeep for 2 persistent damage each. Nanites instead roll in their holder's upkeep: each 6 removes one. Bots are permanent companions and do not upgrade. |
| Huntress | Nyra starts with 6 HP, adding 1 non-ultimate attack damage while alive. Nyra's Bond spends one token to have living Nyra absorb up to her remaining HP after other damage mitigation. Nyra at 0 HP provides neither bonus nor protection, but healing revives her. Defensive companion healing resolves before Bond can absorb that attack. |
| Tactician | Tactical Advantage spends 3 tokens to make a normal attack undefendable; otherwise it spends 1 for +2 non-ultimate damage. Constrict leaves the initial roll free, charges 1 CP per reroll, and clears when dice are confirmed or offense is passed. Without CP, confirmation and passing remain available. |
| Cursed Pirate | Starts with 3 Cursed Doubloons and spends 1 at each own turn end. The next own upkeep after depletion permanently activates Cursed: +2 non-ultimate attack damage and 1 damage each upkeep. Wither persistently reduces non-ultimate damage by 1 per token. Parlay cancels one non-ultimate attack's damage but not its secondary effects. Powder Keg rolls during its holder's upkeep: 1–2 explodes for 4 damage and removes it, 3–5 stays, 6 transfers it to the opponent unless Cleanse blocks it. Duplicates cap at one rather than explode. |

New attack modifiers do not change ultimate damage or spend tokens on an ultimate.
New defensive tokens do not prevent or retaliate against ultimate damage.
Normal and undefendable attacks share these token rules. Effects granted by an
attack settle after its damage and do not retroactively modify that attack.
Own upkeep checks Pirate transformation, Nanite decay and Powder Keg first, then
resolves combined own persistent damage (including Curse, Keg, Poison, Burn and
Bleed), then Holy Presence, then Nanobot, then existing recovery and income.
Lethal damage stops subsequent effects and income. Player healing remains capped
at 50, Nyra at 6 and CP at 15. Pirate uses the same ability board in both forms;
printed bot upgrades, dual boards and optional token-spending modes are omitted.
Status-removal cards cannot remove companions, Blessing, Pirate coins or form.
Nyra's health is separate from status tokens and persists at zero until healed.

The existing per-player hidden decks, revision checks, round-review handshake and
seeded RNG persistence are unchanged. Existing version-2 saves need no migration.
The public hero catalog includes `season`, `passive`, `starting_statuses` and a
nullable companion definition; each public player has a nullable `companion`
with current health. The status catalog explicitly reports `removable`. Pending
attacks optionally carry `lifesteal`; older attacks without that field settle
normally. Companions and all expansion resources survive JSON save/restore;
private hand identities, draw orders and RNG state remain private.

## UI and checks

The picker has All / Season 1 / Season 2 filters and an independently scrollable
list. Selection preserves list position and uses an in-place confirmation. Hero
references, Help, Explain and token tooltips use the same server-supplied catalog.
Nyra has a compact health chip instead of enlarging the HP display. Constrict's
reroll button shows its CP cost or why it is disabled. The compact title/player
rows and feedback for rerolls that repeat a number are retained.

Run `python -m unittest tests.test_dice_throne tests.test_dice_throne_heroes` for
the complete hero roster, 128 abilities, 120 unique bot pairings, token edge cases,
private decks, upgrades and JSON save/restore. Run
`node tests/dice_throne.browser.cjs` against a local server (configured through
`ROOM_TEST_URL`, `PLAYWRIGHT_MODULE` and `PYTHON` when needed) for the picker, hero
references, mobile/desktop layout and live two-player interactions.

Validation completed with **74 passing tests** using both game suites plus
`tests.test_frontend_style_assets`. Browser checks passed for **44 states** at
320, 390, 768, 1024 and 1440px, all sixteen hero references, season filters,
preserved scroll position, touch scrolling without selection, status tooltips,
Help/Explain, Esc, reduced motion, Nyra health, paid/blocked rerolls, protected
Pirate token inputs, and a live Artificer/Huntress room with synchronized reroll
feedback. Screenshots were visually checked at 320, 390, 1024 and 1440px. Normal
hero summaries remain 57px high on mobile and 64px on desktop; status/companion
chips wrap as needed without horizontal overflow. JavaScript syntax, the JSON
contract and patch whitespace checks passed. Real-device Safari has not been
tested.

Changed files: `game/dice_throne_data.py`, `game/dice_throne.py`,
`static/games/dice_throne.js`, `static/games/dice_throne.css`,
`static/game_assets.js`, `static/index.html`,
`tests/test_dice_throne_heroes.py`, `tests/dice_throne.browser.cjs`,
`designs/dice_throne_contract.json`, and this document. No new game registration
was added, so the existing game weight and development-order entry are unchanged.
