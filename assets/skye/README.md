# Isle of Skye tile catalog

`tile_definitions.json` is the runtime source of truth for the 73 base-game
landscape tiles. `tile_manifest_draft.json` remains the source-image inventory;
gameplay must not infer terrain, roads, or icons from its filenames.

Catalog fields use these conventions:

- `edges`: north/east/south/west terrain codes (`P`, `M`, `W`).
- `roads`: road exits in north/east/south/west notation.
- `road_kind`: `bridge` when the printed road crosses water; otherwise `road`.
- `joins`: equal-terrain, non-adjacent edges that belong to one printed area.
- `internal`: fully enclosed printed areas that touch no tile edge.
- `icons`: exact icon counts plus the edge/internal area containing the icon.
  Scroll icons also carry their final-scoring type.

Regenerate the schematic, non-commercial SVG set after every catalog change:

```sh
python3 -B scripts/gen_skye_tile_svgs.py
```

Then open `tile_svg_review.html` and check edge terrain, area topology, every
road exit, icon count, and scroll type. The current catalog has completed two
manual visual passes; an independent reviewer should still sign it off before
marking individual tiles as final. Do not add third-party source artwork to the
repository without confirmed reuse rights.
