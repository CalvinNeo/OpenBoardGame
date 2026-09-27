# Las Vegas Royale

Room configuration: `edition: "royale"`. Omitted edition retains the existing
2012 Classic rules and saved-game format. Royale uses the same room, reconnect,
save, spectator and bot infrastructure. Start a new game to change editions.

Reference: [Ravensburger / alea 26918 English rules, 2019](https://www.ravensburger.org/spielanleitungen/ecm/Spielanleitungen/26918%20%20anl%202362054.pdf?ossl=pds_text_Spielanleitung),
with the German edition consulted for penalty timing and tile interactions.

- Three rounds, 7 small dice and one Biggy per player, 2 new chips each round.
  Biggy is one physical die but has strength two in casino rankings.
- Six pairs drawn from the 90-note deck are ordered by total, then highest note;
  24 notes are reserved for rounds 2 and 3. Remaining notes are the bonus bank.
- Each round selects three distinct double-sided boards and a random side of
  each, assigned to casinos 1–3. All 16 published sides are implemented.
- Two-player games include one independently ranked neutral set, separate from
  the gray dice used by Block It / Handicap.
- Secret Lucky Punch and Black Box choices are persisted server-side. Views and
  action broadcasts omit secret values. Another player's pending decision changes
  the active actor so bots and reconnects continue the same sequence.
- Prime Time resolves before casino payouts. Black Box and other bonus payouts
  complete before Bad Luck penalties. All players review and confirm every round,
  including the final round. Unused chips count toward the final total/tiebreak.

## Digital edge conventions

The manual does not describe a roll containing only a closed casino's number.
The digital implementation offers a free pass in that case, retaining the dice
for the next turn; it cannot strand the active player without a legal action.

Bonus payments are recorded as their printed award denomination. The digital
bank does not impose a physical note/chip supply limit. Bad Luck deducts cash
first, then chips only if necessary, retaining exact cash change (including
$10K/$20K) without creating pass chips. These conventions are disclosed in Help.
Round earnings show the change in total assets, including bonus income, fines
and spent chips, measured after the round's initial two-chip grant.

Run `python -m unittest tests.test_las_vegas tests.test_las_vegas_royale tests.test_las_vegas_integration`.
Browser checks: `node tests/las_vegas_royale.browser.cjs` (Playwright required;
`PLAYWRIGHT_MODULE` and `PYTHON` can select local runtimes).
