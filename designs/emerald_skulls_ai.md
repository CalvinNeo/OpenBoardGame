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

Bot tumblers yield to bot gamblers that want to wager before rolling, regardless
of room seat order. When a human gambler has markers left, the roll delay is
4.5 seconds. Human actions invalidate pending bot decisions through the existing
room state-version check. The existing review and rematch confirmation rules
remain in effect.

## Interface

The desktop table shows the skull and bets alongside each other. Narrow screens
offer **Skull & Dice / Bets** views, initially selected for the player's role.
Results and payout choices appear above the board, and the log is collapsible.
Dice use pip symbols, and bets/resources include emoji and short descriptions.
Desktop hover and keyboard focus show tips; touch tips replace the previous tip
and disappear after three seconds. Help contains the full rules. Explain blocks
game actions and supports disabled controls; dialogs support Esc and keep focus.

## Validation

```sh
python3 -m unittest tests.test_emerald_skulls_game tests.test_emerald_skulls_ai
python3 -m uvicorn app:app --host 127.0.0.1 --port 8765
node tests/emerald_skulls.browser.cjs
```

The browser script accepts `PLAYWRIGHT_MODULE`, `ROOM_TEST_URL`, `PYTHON` and
`BROWSER_CHANNEL`. It checks mobile/desktop bounds, six-player and full-board
layouts, selection, Help/Explain, keyboard dismissal, tabs, touch tips and logs.
Screenshots are written under `tmp/emerald-skulls-ui/`.

The implementation passed 26 Python tests, complete two- and six-bot games, and
a live room check with a human and two bots. In a 12-seed, alternating-seat
two-player comparison against the previous bot, the new policy won 12 games.
Both policies were allowed to place their bets before each roll. This small,
deterministic comparison is a regression check, not a general win-rate estimate.
