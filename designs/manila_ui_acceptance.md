# Manila UI acceptance — 2026-10-24

## Scope

Rebuild the Manila browser UI without changing the server rules, action protocol,
game registration, or the existing BGG weight (2.04).

Changed files:

- `static/games/manila.html`: board-first template, inline phase actions, native Help/Explain dialogs, collapsible finance and players.
- `static/games/manila.css`: harbor palette, responsive lanes and investments, local confirmation, mobile and desktop turn alerts; retains `obg-game-manila-1`.
- `static/games/manila.js`: scoped IIFE, phase rendering, draft previews, confirmation, accessible guidance, error/reconnect handling and published-action feedback.
- `static/game_assets.js`: Manila title and asset cache versions only.
- `static/index.html`: loader cache version and removal of the obsolete Manila cycle-modal placeholder only.
- `tests/manila_fixtures.py`: 27 deterministic public-view fixtures generated through the existing Manila implementation.
- `tests/manila.browser.cjs`: standalone static-server UI regression and screenshots.
- `tests/manila_live.browser.cjs`: three real browser clients against a local server, including a separate deferred-style retry check.
- `designs/manila_ui_acceptance.md`: this record.

Other concurrent working-tree edits were left intact. No commercial images,
external UI libraries, global stylesheet changes, or server-rule changes were added.
The tiny lane marker is an inline original SVG; cargo and resource icons retain
emoji and text labels.

## Interaction changes

- Auction and setup are inline instead of automatically opening a blocking modal.
- Four market cards show prices and private holdings; three colored lanes show
  positions, recent dice, occupants, costs, and potential cargo returns.
- Ship/facility investments, stock purchases, pledges, and pirate actions confirm
  next to their target. Cancel, Escape, or a blank-area click dismisses a draft.
- Cargo selection toggles in place. Starting positions and pilot movement preview
  on the lanes without sending until Confirm. Repeated state snapshots preserve
  drafts and focused controls; a change of turn/phase invalidates stale selections.
- Pass and Next Round submit directly. A pending action cannot be submitted twice;
  a server error releases the lock and displays the error. Disconnected clients
  remain disabled until room identity is restored, not merely until transport connects.
- Mobile harbor investments repeat cash/workers and compact ship positions so
  players do not need to scroll back to the top to compare an investment.
- Public bids, placements and ship movement are shown while other players act.
- Round settlement retains the board and per-player income/expense details,
  highlights YOU, and shows all ready states. The next voyage waits for everyone.
- Help and Explain work with Escape, focus restoration, disabled controls,
  keyboard input and touch. Explain blocks controls with no explanation as well.
- Static information supports hover/focus and replaceable, three-second touch
  tooltips. Interactive controls do not show informational touch tooltips.
- Touch movement and cancellation suppress accidental selection; selecting a
  lower pilot control does not jump to the top. No draggable map is introduced.
- Collapsed Room Controls highlights the active player's turn on both desktop
  and mobile. Players and detailed ledgers are collapsible and height-bounded.

## Verification

Environment: installed Chrome controlled by Playwright, Node 24, existing Python
3.12 environment at `.venv/hive312/Scripts/python.exe`.

### Passed

- `node --check static/games/manila.js`
- `node --check tests/manila.browser.cjs`
- `node --check tests/manila_live.browser.cjs`
- `python -m unittest tests.test_frontend_style_assets` — 2 checks passed.
- `node tests/manila.browser.cjs` — 27 states at **320, 390, 1024, 1440 px**;
  page/container overflow and section overlap checks, long names and escaped HTML,
  spectator privacy, insufficient cash/workers, auction validation, purchases,
  cargo/position drafts, all placement locations, both pilot modes, boarding,
  plunder destinations, pledges with custom loan values, settlement and finals.
  Also exercises Help, disabled-control Explain, keyboard Explain, touch scrolling,
  tooltip replacement/timeout, inline confirmation, stale-state submission locks,
  error recovery, room identity recovery and game-switch cleanup.
- `node tests/manila_live.browser.cjs` — three real clients complete auction,
  setup, a paid placement, three movements, settlement, and the next voyage;
  one/two ready players cannot advance the round. Reload, Socket.IO reconnect,
  lazy loading and failed Manila stylesheet retry pass without duplicate initialization.
- Desktop 1024/1440 px checked with Room Controls both collapsed and expanded.
- `git diff --check` on the changed frontend files.
- Visual review of desktop, 320/390 px mobile, inline-confirmation and round-result
  screenshots; fixed lane-marker and investment-cost overflow during iteration.

Screenshot output (generated, git-ignored):

- `build/manila-ui/desktop-1440.png`
- `build/manila-ui/desktop-1024-sidebar.png`
- `build/manila-ui/mobile-390.png`
- `build/manila-ui/mobile-320.png`
- `build/manila-ui/mobile-confirm.png`
- `build/manila-ui/desktop-review.png`

To run the standalone UI test, set `PYTHON` to a working project Python and
`PLAYWRIGHT_MODULE` if Playwright is not installed in the default Node search path.
For the live test, start `uvicorn app:app --host 127.0.0.1 --port 8797` and optionally
set `ROOM_TEST_URL`. No test server is needed for `manila.browser.cjs`.

### Incomplete / retained limitations

- The existing shared `tests/game_assets.browser.cjs` passed its live
  create/start/reload, game switching and responsive checks, then timed out at
  line 98: the expanded mobile Room Controls drawer intercepts the Cabo asset
  retry button. That unrelated shared test was not changed. The dedicated Manila
  retry check collapses the drawer through its existing interface and passes.
- Safari, Firefox, physical mobile devices, assistive technology and a full
  multiplayer game through terminal scoring were not exercised. Final states
  and tied winners are covered by public-view fixtures, not a complete live game.
- Mobile uses a vertical board to keep three ships and all investment locations
  readable; it is intentionally not compressed into a single viewport. Nearby
  ship/resource summaries and local confirmation avoid decision-related round trips.
- Position/cargo/pilot drafts are local until confirmation because the existing
  protocol publishes committed actions only. Other players see phase progress,
  public bids, placements and movement, not unsubmitted private drafts.
- The current public view does not include stock-bank quantities. The UI shows
  price/affordability, while the server validates sold-out purchases and returns
  an inline error. No hidden stock information is inferred from opponents.
- Per `DEV_GUIDE.md`, no game-rule unit suite was run for this UI-only change.
