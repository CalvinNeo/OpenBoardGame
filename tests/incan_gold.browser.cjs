const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { execFileSync } = require('node:child_process');

const base = process.env.ROOM_TEST_URL || 'http://127.0.0.1:8778';
const output = 'build/incan-gold-ui';
fs.mkdirSync(output, { recursive: true });
const view = JSON.parse(execFileSync(process.env.PYTHON || 'python3', ['-c', `
import json
from game.incan_gold import IncanGoldGame as Game
players = [dict(player_id=f'p{index}', name=name, seat=index, is_bot=index > 0) for index, name in enumerate([
    'Ada', 'Explorer Alexandria', '陈小明', 'Indiana', 'Lara', 'Sam', 'Riley', 'Morgan',
])]
state = Game.init_game({}, players)
state['path_cards'] = [
    {'type': 'treasure', 'value': 11, 'remainder': 3},
    {'type': 'hazard', 'hazard': 'snake'},
    {'type': 'treasure', 'value': 17, 'remainder': 1},
    {'type': 'artifact', 'value': 5},
    {'type': 'hazard', 'hazard': 'fire'},
    {'type': 'treasure', 'value': 9, 'remainder': 1},
]
state['deck'] = state['deck'][:25]
state['hazard_counts'] = {'snake': 1, 'fire': 1}
state['last_decisions'] = {player['player_id']: 'continue' for player in players}
for player in state['players'].values():
    player.update(banked_gems=12, hand_gems=4, artifact_count=1, artifact_points=5)
print(json.dumps(Game.get_public_view(state, 'p0')))
`], { encoding: 'utf8' }));

async function render(page, changes = {}) {
  await page.evaluate((state) => {
    currentGameType = 'incan_gold';
    setGamePanelVisibility('incan_gold');
    renderIncanGoldGameState({ view: state, events: [] });
  }, { ...structuredClone(view), ...changes });
}

async function checkBounds(page, label) {
  const result = await page.evaluate(() => {
    const panel = document.getElementById('incanGoldPanel').getBoundingClientRect();
    const bad = [...document.querySelectorAll('#incanGoldPanel *, .game-panel > .panel-header button')]
      .filter(element => element.getClientRects().length && getComputedStyle(element).display !== 'none')
      .filter(element => {
        const bounds = element.getBoundingClientRect();
        return bounds.left < -1 || bounds.right > innerWidth + 1
          || (panel.left <= bounds.left && element.scrollWidth > element.clientWidth + 2
            && !element.matches('button') && getComputedStyle(element).overflowX === 'visible');
      }).map(element => element.id || element.className);
    const reconnect = document.getElementById('gameReconnectBtn').getBoundingClientRect();
    const help = document.getElementById('incanGoldHelpBtn').getBoundingClientRect();
    return { bad, width: innerWidth, scroll: document.documentElement.scrollWidth,
      headerAligned: Math.abs(reconnect.top - help.top) < 12 };
  });
  assert.deepEqual(result.bad, [], `${label}: overflow`);
  assert.ok(result.scroll <= result.width, `${label}: page overflow`);
  assert.ok(result.headerAligned, `${label}: header wrapped`);
}

(async () => {
  const browser = await chromium.launch({ channel: process.env.BROWSER_CHANNEL || 'chrome', headless: true });
  const errors = [];
  try {
    for (const width of [1440, 1024, 390, 320]) {
      const context = await browser.newContext({ viewport: { width, height: width > 600 ? 1000 : 844 }, hasTouch: width < 600 });
      const page = await context.newPage();
      page.on('pageerror', error => errors.push(error.message));
      await page.route('https://fonts.googleapis.com/**', route => route.abort());
      await page.goto(base);
      await page.waitForFunction(() => typeof socket !== 'undefined' && socket.connected && cachedGameList);
      await page.evaluate(() => socket.emit('room:create', { name: 'Incan QA', game_type: 'incan_gold' }));
      await page.waitForFunction(() => currentGameType === 'incan_gold' && isGameAssetsLoaded('incan_gold'));
      if (width === 390) {
        await page.evaluate(() => socket.emit('room:add_bot', {}));
        await page.waitForFunction(() => currentRoomState.players.length === 2);
        await page.evaluate(() => socket.emit('room:add_bot', {}));
        await page.waitForFunction(() => currentRoomState.players.length === 3);
        await page.evaluate(() => socket.emit('room:ready', { ready: true }));
        await page.waitForFunction(() => currentRoomState.players.every(player => player.ready));
        await page.evaluate(() => socket.emit('room:start', {}));
        await page.waitForFunction(() => currentIncanGoldView?.phase === 'decision');
        for (let round = 1; round <= 5; round += 1) {
          await page.locator('#incanGoldLeaveBtn').click();
          await page.waitForFunction(() => ['round_end', 'game_over'].includes(currentIncanGoldView?.phase), { timeout: 15000 });
          if (round < 5) {
            await page.waitForFunction(() => currentIncanGoldView.next_round_ready.length === 2);
            assert.equal(await page.evaluate(() => currentIncanGoldView.round), round);
            await page.locator('#incanGoldNextRoundBtn').click();
            await page.waitForFunction(expected => currentIncanGoldView.round === expected && currentIncanGoldView.phase === 'decision', round + 1);
          }
        }
        assert.equal(await page.locator('#incanGoldPlayAgainBtn').isVisible(), true);
        assert.equal(await page.locator('#incanGoldScoreboard').isVisible(), true);
        assert.equal(await page.locator('#incanGoldScoreboardRows .incan-gold-score-row').count(), 3);
        await page.evaluate(() => hideIncanGoldTooltip());
        await page.locator('#incanGoldScoreboard').screenshot({ path: `${output}/390-live-scoreboard.png` });
        await page.keyboard.press('Escape');
        assert.equal(await page.locator('#incanGoldScoreboard').isVisible(), false);
        await page.locator('.game-panel').screenshot({ path: `${output}/390-live-game-over.png` });
        await page.locator('#incanGoldPlayAgainBtn').click();
        await page.waitForFunction(() => currentIncanGoldView.round === 1 && currentIncanGoldView.phase === 'decision');
        await page.evaluate(() => { socket.emit('room:leave', {}); resetRoomState(); });
        await page.waitForFunction(() => !currentRoomState);
        await page.evaluate(() => socket.emit('room:create', { name: 'Incan UI QA', game_type: 'incan_gold' }));
        await page.waitForFunction(() => currentRoomState?.game_type === 'incan_gold');
        console.log('PASS live Socket.IO: human + 2 AI, five rounds, human review gate, rematch');
      }
      await page.evaluate(() => {
        window.incanTestActions = [];
        sendAction = action => incanTestActions.push(action);
        setRoomControlsCollapsed(true);
      });
      await render(page);
      await checkBounds(page, `${width} decision`);
      assert.equal(await page.locator('#incanGoldContinueBtn').isVisible(), true);
      assert.equal(await page.locator('#incanGoldLeaveBtn').isVisible(), true);
      assert.equal(await page.locator('#incanGoldNextRoundBtn').isVisible(), false);
      assert.equal(await page.locator('#incanGoldPlayAgainBtn').isVisible(), false);
      await page.screenshot({ path: `${output}/${width}-decision.png`, fullPage: true });
      await page.locator('#incanGoldContinueBtn').click();
      assert.deepEqual(await page.evaluate(() => incanTestActions.pop()), { type: 'decide', choice: 'continue' });
      await page.locator('#incanGoldLeaveBtn').click();
      assert.deepEqual(await page.evaluate(() => incanTestActions.pop()), { type: 'decide', choice: 'leave' });

      await render(page, { your_decision: 'continue', legal_actions: [] });
      assert.equal(await page.locator('.incan-gold-actions button:visible').count(), 0);
      assert.match(await page.locator('#incanGoldStatus').innerText(), /locked/);
      const campPlayers = structuredClone(view.players);
      campPlayers[0].status = 'in_camp';
      await render(page, { players: campPlayers, legal_actions: [] });
      assert.match(await page.locator('#incanGoldStatus').innerText(), /Safe in camp/);
      await render(page, { you: 'spectator', legal_actions: [] });
      assert.equal(await page.locator('.incan-gold-actions button:visible').count(), 0);

      const roundEnd = { phase: 'round_end', legal_actions: ['next_round'], round_end: { reason: 'hazard', hazard: 'snake', artifacts_removed: 1 }, next_round_ready: ['p1', 'p2'] };
      await render(page, roundEnd);
      assert.equal(await page.locator('#incanGoldNextRoundBtn').isVisible(), true);
      assert.equal(await page.locator('#incanGoldPlayAgainBtn').isVisible(), false);
      assert.equal(await page.locator('#incanGoldContinueBtn').isVisible(), false);
      await page.locator('#incanGoldNextRoundBtn').click();
      assert.deepEqual(await page.evaluate(() => incanTestActions.pop()), { type: 'next_round' });
      await checkBounds(page, `${width} round review`);
      await page.locator('.game-panel').screenshot({ path: `${output}/${width}-round-end.png` });
      await render(page, { ...roundEnd, legal_actions: [], next_round_ready: ['p0', 'p1', 'p2'] });
      assert.equal(await page.locator('#incanGoldNextRoundBtn').isVisible(), false);
      assert.match(await page.locator('#incanGoldStatus').innerText(), /Waiting for other/);

      const gameOver = { ...roundEnd, phase: 'game_over', game_over: true, round: 5, legal_actions: ['play_again'], winner: ['p0', 'p1'] };
      await render(page, gameOver);
      assert.equal(await page.locator('#incanGoldNextRoundBtn').isVisible(), false);
      assert.equal(await page.locator('#incanGoldPlayAgainBtn').isVisible(), true);

      // The final scoreboard opens itself once the whole game is over.
      const scoreboard = page.locator('#incanGoldScoreboard');
      assert.equal(await scoreboard.isVisible(), true);
      assert.equal(await page.locator('#incanGoldScoreboardRows .incan-gold-score-row').count(), view.players.length);
      const ranked = await page.$$eval('#incanGoldScoreboardRows .incan-gold-score-row', rows => rows.map(row => ({
        rank: Number(row.querySelector('.incan-gold-score-rank').textContent),
        total: Number(row.querySelector('.incan-gold-score-total').textContent),
      })));
      ranked.forEach((entry, index) => {
        assert.ok(entry.total >= 0, 'negative total');
        if (index) assert.ok(ranked[index - 1].total >= entry.total, 'scoreboard is not sorted by total');
        assert.equal(entry.rank, 1, 'tied players must share rank 1');
      });
      assert.equal(await page.locator('#incanGoldScoreboardRows .incan-gold-score-row.is-winner').count(), 2);
      assert.equal(await page.locator('#incanGoldScoreboardRows .incan-gold-score-row.is-you').count(), 1);
      assert.match(await page.locator('#incanGoldScoreboardNote').innerText(), /Shared win/);
      await checkBounds(page, `${width} scoreboard`);
      await scoreboard.screenshot({ path: `${output}/${width}-scoreboard.png` });

      // Esc dismisses it, and a dismissed board never comes back for that game.
      await page.keyboard.press('Escape');
      assert.equal(await scoreboard.isVisible(), false);
      await render(page, gameOver);
      assert.equal(await scoreboard.isVisible(), false);
      await page.locator('#incanGoldPlayAgainBtn').click();
      assert.deepEqual(await page.evaluate(() => incanTestActions.pop()), { type: 'play_again' });
      await checkBounds(page, `${width} game over`);
      await page.locator('.game-panel').screenshot({ path: `${output}/${width}-game-over.png` });
      await render(page);
      assert.equal(await page.locator('#incanGoldPlayAgainBtn').isVisible(), false);

      // The shared widgets render real <dialog> elements, not the legacy #incanGoldGuide template.
      const helpDialog = page.locator('dialog.obg-help-dialog[data-obg-help-game="incan_gold"]');
      const explainDialog = page.locator('dialog.obg-explain-dialog');

      await page.locator('#incanGoldHelpBtn').click();
      assert.equal(await helpDialog.isVisible(), true);
      await helpDialog.screenshot({ path: `${output}/${width}-help.png` });
      await page.keyboard.press('Escape');
      assert.equal(await helpDialog.isVisible(), false);
      await page.locator('#incanGoldExplainBtn').click();
      await page.locator('#incanGoldLeaveBtn').click();
      assert.equal(await explainDialog.isVisible(), true);
      assert.equal(await page.evaluate(() => incanTestActions.length), 0);
      await page.keyboard.press('Escape');

      await page.evaluate(() => { document.getElementById('incanGoldLeaveBtn').disabled = true; });
      await page.locator('#incanGoldExplainBtn').click();
      const disabledBounds = await page.locator('#incanGoldLeaveBtn').boundingBox();
      await page.mouse.click(disabledBounds.x + disabledBounds.width / 2, disabledBounds.y + disabledBounds.height / 2);
      assert.equal(await explainDialog.isVisible(), true);
      await page.keyboard.press('Escape');
      await render(page);
      await page.locator('#incanGoldExplainBtn').click();
      await page.locator('#incanGoldPath .incan-gold-card').first().click();
      assert.equal(await explainDialog.isVisible(), true);
      await page.keyboard.press('Escape');

      await page.locator('#incanGoldPath .incan-gold-card').first().click();
      assert.equal(await page.locator('#incanGoldTooltip').isVisible(), true);
      await page.locator('#incanGoldPath .incan-gold-card').nth(1).click();
      assert.match(await page.locator('#incanGoldTooltip').innerText(), /Snake/);
      await page.waitForFunction(() => document.getElementById('incanGoldTooltip').hidden, null, { timeout: 4500 });
      await page.locator('.incan-gold-history summary').click();
      assert.equal(await page.locator('#incanGoldRemovedHazards').isVisible(), true);
      await checkBounds(page, `${width} expanded history`);

      const longPlayers = structuredClone(view.players);
      longPlayers[1].name = 'AnExtremelyLongExplorerNameWithoutAnySpaces'.repeat(2);
      await render(page, { players: longPlayers, path: [...view.path, ...view.path, ...view.path, ...view.path] });
      await checkBounds(page, `${width} stress`);
      await page.locator('.game-panel').screenshot({ path: `${output}/${width}-stress.png` });
      await page.evaluate(() => clearIncanGoldState());
      assert.equal(await page.locator('.incan-gold-actions button:visible').count(), 0);
      await render(page);
      await page.locator('#incanGoldExplainBtn').click();
      await page.evaluate(() => setGamePanelVisibility('cabo'));
      assert.equal(await page.locator('body.incan-gold-explaining').count(), 0);
      await context.close();
      console.log(`PASS ${width}px: actions, phase changes, help, explain, tooltip, overflow`);
    }
    assert.deepEqual(errors, []);
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
