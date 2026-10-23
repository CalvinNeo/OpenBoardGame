# Emerald Skulls AI and interface

The room's **Add Bot** control uses `EmeraldSkullsGame.bot_move`, backed by
`game/emerald_skulls_ai.py`. No model download, API key or extra dependency is required.

## Decision policy

- The strategy accepts `get_public_view` output only. It never reads the match
  seed or advances the game's RNG, and thinking does not mutate the state.
- All legal placement combinations are enumerated by ordinary/wild face counts,
  respecting the current floor, eye capacity and gem capacity.
- Each candidate receives 64 simulated continuations with common random numbers.
  Buying subtracts the purchase cost; reroll decisions account for the added die,
  saved cubes and the two-nose-pick limit. Payouts are capped by the remaining pot.
- Terminal outcomes reuse the game's authoritative payout and bet predicates.
  Cubes have a diminishing estimated future value. They are retained as a payout
  tiebreaker when the pot is exhausted.
- Betting uses 256 simulations, estimates the payout for the next slot, and
  accounts for existing stacks, card order and the pot remaining after tumbler
  payments. A bot keeps its marker when none of the simulated outcomes can pay.
- The rollout policy is a heuristic, with a 36-step safety bound. This is an
  approximate Monte Carlo player, not an exhaustive optimal solver or a model of
  an individual human's habits.

Before every roll, both human and bot tumblers wait until each gambler has used
both markers or explicitly submitted `pass_bet`. There is no betting timeout.
Passing preserves unused markers and existing bets; continuing, spending a cube,
or picking the nose opens a fresh betting window for remaining markers. Bots
explicitly pass when no available bet can pay, so all-bot games keep moving.
Human actions invalidate pending bot decisions through the existing room
state-version check. Review and rematch confirmation rules remain in effect.

## Interface

The game uses the outer Game panel directly, with a single 翡翠骰骨 heading.
The desktop table shows the skull and bets alongside each other. Narrow screens
offer **Skull & Dice / Bets** views, selected for the current decision. The Bets
view includes a compact board/hand preview and an explicit 不下注 / 不再下注
button. All eight bet names retain English below their Chinese names. Players
collapse into a resource summary on mobile without hiding the current decision.
Results and payout choices appear above the board, and the log is collapsible.
Dice use pip symbols, and bets/resources include emoji and short descriptions.
Desktop hover and keyboard focus show tips; touch tips replace the previous tip
and disappear after three seconds. Help contains the full rules. Explain blocks
game actions and supports disabled controls; dialogs support Esc and keep focus.

## Validation

```sh
python3 -m unittest tests.test_emerald_skulls_game tests.test_emerald_skulls_ai tests.test_frontend_style_assets
python3 -m uvicorn app:app --host 127.0.0.1 --port 8765
node tests/emerald_skulls.browser.cjs
```

The browser script accepts `PLAYWRIGHT_MODULE`, `ROOM_TEST_URL`, `PYTHON` and
`BROWSER_CHANNEL`. It checks 77 combinations of 11 game states and viewport
widths 320, 360, 390, 393, 768, 1024 and 1440, plus expanded player lists. Checks
cover bilingual names, seven dice, long names, six players, explicit passing,
reopened betting, touch scrolling without accidental bets, game-title/theme
cleanup, dice selection, Help/Explain, keyboard dismissal, tabs, tips and logs.
It also creates a temporary Socket.IO room with two humans and a bot tumbler:
waiting beyond the former 4.5-second deadline does not advance the game, passing
survives reconnection, one placed marker still waits for a second decision, and
the bot rolls only after both humans finish. Screenshots are written under
`tmp/emerald-skulls-ui/`.

The explicit-betting update passes 31 game/AI tests and two style-asset tests,
including complete two- and six-bot games. JavaScript syntax checks and
`git diff --check` also pass. Browser coverage uses desktop Chrome and emulated
mobile touch, not physical iOS/Android devices or Safari/Firefox. The separate
generic `tests/game_assets.browser.cjs` passes create/start/reload and game
switching, but its Cabo retry scenario is blocked by the Room Controls header
covering the Retry button; that unrelated shared-UI issue is not changed here.

The initial AI implementation passed 26 Python tests, complete two- and six-bot games, and
a live room check with a human and two bots. In a 12-seed, alternating-seat
two-player comparison against the previous bot, the new policy won 12 games.
Both policies were allowed to place their bets before each roll. This small,
deterministic comparison is a regression check, not a general win-rate estimate.
