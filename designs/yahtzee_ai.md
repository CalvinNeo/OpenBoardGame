# Yahtzee: selectable dynamic-programming AI

## Source and scope

- [Bilibili Chinese version: 我解出了快艇骰子](https://www.bilibili.com/video/BV15yYT6wEuu/)
- [Ballpark Figures: I Solved Yahtzee*](https://www.youtube.com/watch?v=DOgb5wrb7mM), especially 05:23–10:05 (backward induction and state compression).
- [Author's accompanying explanation](https://ballparkfigures.substack.com/p/yahtzee).

The new strategy implements the video's central objective: maximize expected
final points across the entire remaining game. It is a full scorecard dynamic
program, not a collection of the video's human-play heuristics or a one-turn
greedy search. Like the main solver discussed in the video, it does not optimize
the probability of beating particular opponents. Opponents' scores do not affect
its decisions.

The existing game rules are authoritative. In particular, five identical dice
qualify for Full House, and Joker scoring and the extra 100 points are available
only when the Yahtzee box already contains 50. The video describes Joker scoring
even after a zero in that box; this implementation deliberately retains the
repository's existing behavior instead of changing the game rules.

## Room selection and compatibility

In a Yahtzee room, **Bot AI** offers:

- **Classic (original)** (`classic`): the unchanged random reroll / immediate
  highest-score bot. This remains the default, including for old saves with no
  strategy setting.
- **Strategic (DP)** (`dynamic_programming`): the new full-game planner.

The choice applies to all bots and is submitted with Start Game. During a game
the active choice is displayed but disabled. The config is serialized in game
state, included in the public view, and retained by reopen/load. The selector
does not reset on ordinary lobby updates such as adding a bot or changing seats.
As with other room settings, an unsubmitted lobby selection is local until the
game starts.

## Recurrence

The state at the beginning of a turn is `(open_mask, upper, bonus_active)`:

- `open_mask`: 13 bits, in `CATEGORY_ORDER`, indicating unfilled boxes.
- `upper`: upper-section subtotal capped at 63.
- `bonus_active`: whether Yahtzee was filled with 50, enabling future Jokers.

Previously earned lower-section points and bonuses are sunk rewards and need not
be part of the state. Let `V(s)` be expected additional points from state `s`.
For each full dice hand `d`, the final-roll value is:

```
F0(s, d) = max over legal scoring boxes c:
    category_points(d, c)
    + repeat_yahtzee_bonus(d, s)
    + newly_earned_upper_bonus(s, c)
    + V(state_after_scoring(s, d, c))
```

For one and then two remaining rerolls:

```
Fr(s, d) = max over all submultisets k of d:
    E[Fr-1(s, k + fresh_dice)]
V(s) = E[F2(s, initial_five_dice)]
V(no_open_boxes) = 0
```

Keeping all five includes the option of stopping. The runtime scores immediately
when rerolling offers no improvement. The game engine supplies legal categories,
scores and Joker restrictions; there is no second implementation of these rules
in the numeric solver.

There are 252 unordered full rolls and 462 hands containing zero through five
dice. Expectations are computed by adding one independent fair die at a time to
the 210 partial hands. This preserves the unequal probabilities of full rolls
without enumerating 7,776 ordered rolls for each decision. All possible keeps
are evaluated, including releasing previously locked dice.

`scripts/yahtzee_policy_solver.cpp` computes `V` offline in increasing mask order.
Removing a box always leads to a smaller mask. Unreachable upper bonuses share
the zero-subtotal value. All other states are enumerated without pruning or
heuristic cutoffs. The solve uses float64; the exported table uses float32, so
decisions indistinguishable within storage rounding can differ in a very close
tie. The opening expectation under the local rules is **254.498570606**.

## Runtime and asset

`game/yahtzee_ai.py` loads the table lazily and solves just the current turn in
Python. Table and bounded turn caches are shared across rooms. The bot returns
ordinary `toggle_lock`, `roll` and `score` actions; planning does not mutate game
state, inspect future rolls, or consume random numbers. Existing locked copies
of a desired face are reused, preventing unnecessary lock toggles.

`game/assets/yahtzee_policy.bin.gz` is about 1.67 MiB compressed and contains:

1. Eight ASCII bytes `OBGYDP01`.
2. 1,048,576 little-endian IEEE-754 float32 values, indexed by
   `(open_mask * 64 + upper) * 2 + bonus_active`.

The decompressed numeric table occupies 4 MiB. A bonus-active state with an open
Yahtzee box is impossible; those slots duplicate the inactive value. Terminal
values are zero because bonuses are awarded on the transitions that earn them.
The adjacent JSON records category order, entry count and the uncompressed
SHA-256. It is tested alongside numerical Bellman consistency.

Regenerate after any scoring/category/reroll rule change:

```sh
python3 scripts/build_yahtzee_policy.py
```

This offline step uses the game's existing Python environment and a C++17
compiler (`CXX`, or `--compiler`). It exports dice scores and Joker constraints from `game/yahtzee.py`
to the native kernel, writes little-endian data on either host byte order, and
fixes gzip metadata for reproducibility. There are no added server dependencies,
runtime subprocesses, compilation, downloads or background table generation.

## Validation

```sh
python3 -m unittest tests.test_yahtzee_game tests.test_yahtzee_ai tests.test_yahtzee_room
python3 scripts/benchmark_yahtzee_ai.py --games 300 --seed 20260929 --output tmp/yahtzee-ai/benchmark.json
```

Coverage includes independent ordered-dice expectation checks, brute-force
endgame choices, analytic Chance/upper-box values, sampled full-game Bellman
equations, all 252 rolls in opening and Joker endgames, upper-bonus thresholds,
all Joker modes, lock convergence, original-bot behavior, config validation,
save round-trips, room start/reopen and complete four-player games.

On the fixed 300-game sample per strategy, Classic averaged **109.073** points
(median 106), and Strategic averaged **258.503** (median 247). Strategic's
standard error was 3.809 points; this sample mean is not the theoretical
expectation or a head-to-head win rate. The original bot's random decisions use
a separate seeded stream from dice. Each strategy gets the same set of dice
seeds, although its keep choices change how that stream is consumed.

On the development machine, Strategic's decision time averaged 0.304 ms,
with a 2.483 ms 95th percentile and 50.439 ms maximum during that benchmark.
These timings include cached lock actions and vary with hardware and load.

Browser verification covered selecting either strategy, preserving a pending
choice while adding bots/changing seats, running a Strategic bot turn, refreshing
an active game, the original default in a new room, and 320 px / 1280 px layouts.
No horizontal overflow or browser console errors were observed.

The full repository suite ran 2,304 tests with eight failures in unchanged
modules: two Ark Nova building-picker text assertions, one Ark Nova map5a
generated-data mismatch, one Guandan reviewed-round expectation, and four Halli
Galli flip/ring assertions. No Yahtzee tests failed. The additional upper-bonus
analytic regression was also run separately after that suite started.
