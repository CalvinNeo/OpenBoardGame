# Ark Nova — Map 0 audit

Map 0 is represented by `designs/ark_nova/map0.source.json`. The runtime JSON
and SVG are generated from that file so the visual board cannot silently drift
away from the game rules.

## Audited layout

- 58 hexes in 9 staggered, flat-top columns: `6 / 7 / 6 / 7 / 6 / 7 / 6 / 7 / 6`.
- 39 land/building spaces, 10 water spaces, and 9 rock spaces.
- Water and rock are not buildable, but both count for animal adjacency
  requirements.
- `G3` and `H3` may only be covered after the Build Action card has been
  upgraded to side II.
- Covering every land/building space gains 7 appeal.

## Placement bonuses

| Cells | Effect |
| --- | --- |
| `B2`, `C3`, `D7` | Take 1 card within reputation range, or draw 1 from the deck |
| `H2`, `I4` | Gain 5 money |
| `E3` | Gain 10 money |
| `E1`, `D5`, `F6` | Gain 1 X-token |
| `A5`, `H6` | Gain 2 appeal |
| `F4` | After finishing the current action, move any Action card to slot 1 |

The two `2` bonuses are **appeal**, not reputation. The official Icon Overview
distinguishes appeal with a ticket shape and reputation with a mortarboard.

## Conservation rewards

The four violet rewards are gained immediately when uncovered and again during
income at every break: take a card, build a free size-2 standard enclosure,
gain 5 money, or gain 1 conservation point. The three yellow rewards are
one-time immediate effects: gain an association worker, 12 money, or 3
X-tokens.

## Provenance

The grid was transcribed from Steam Workshop item `2630864749` and checked
against the clearer Map 0 asset referenced by item `2953525089`. Symbol meanings
were checked against Capstone Games' official rulebook and Icon Overview. No
Workshop raster image is included in the repository or embedded in the SVG.
