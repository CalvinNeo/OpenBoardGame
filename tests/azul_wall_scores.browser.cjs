const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const base = process.env.ROOM_TEST_URL || 'http://127.0.0.1:8766';
const output = 'tmp/azul-wall-scores';
const widths = [320, 390, 1024, 1440];

async function checkLayout(page) {
  const issues = await page.evaluate(() => {
    const problems = [];
    if (document.documentElement.scrollWidth > innerWidth) problems.push('Page scrolls horizontally');
    for (const element of document.querySelectorAll('#azulPanel .azul-wall-cell')) {
      const cell = element.getBoundingClientRect();
      if (!cell.width || !cell.height) continue;
      if (cell.left < 0 || cell.right > innerWidth) problems.push('Wall tile outside viewport');
      const score = element.querySelector('.azul-wall-score');
      if (!score) continue;
      const label = score.getBoundingClientRect();
      if (label.left < cell.left || label.right > cell.right || label.top < cell.top || label.bottom > cell.bottom) {
        problems.push('Score outside its tile');
      }
      if (score.scrollWidth > score.clientWidth || score.scrollHeight > score.clientHeight) {
        problems.push('Score text overflows');
      }
      const style = getComputedStyle(score);
      if (style.color === style.backgroundColor) problems.push('Score has no contrast');
    }
    const buttons = ['gameReconnectBtn', 'azulHelpBtn'].map(id => document.getElementById(id).getBoundingClientRect());
    if (Math.abs(buttons[0].top + buttons[0].height / 2 - buttons[1].top - buttons[1].height / 2) > 3) {
      problems.push('Help and Reconnect wrap');
    }
    return problems;
  });
  assert.deepEqual(issues, []);
}

(async () => {
  fs.mkdirSync(output, { recursive: true });
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const errors = [];
  try {
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
    const page = await context.newPage();
    page.on('pageerror', error => errors.push(error.message));
    await page.route('https://fonts.googleapis.com/**', route => route.abort());
    await page.goto(base);
    await page.waitForFunction(() => typeof socket !== 'undefined' && socket.connected && cachedGameList);
    await page.evaluate(() => socket.emit('room:create', { name: 'Azul scoring QA', game_type: 'azul' }));
    await page.waitForFunction(() => roomSessionReady && currentGameType === 'azul' && isGameAssetsLoaded('azul'));
    await page.evaluate(() => socket.emit('room:add_bot', { room_id: roomId }));
    await page.waitForFunction(() => currentRoomState.players.length === 2);
    await page.evaluate(() => socket.emit('room:ready', { room_id: roomId, ready: true }));
    await page.waitForFunction(() => !document.getElementById('startBtn').disabled);
    await page.evaluate(() => setRoomControlsCollapsed(false));
    await page.locator('#startBtn').click();
    await page.waitForFunction(() => currentAzulView?.round === 1);

    for (let turn = 0; turn < 30; turn += 1) {
      await page.waitForFunction(() => currentAzulView?.round > 1 || currentAzulView?.legal_actions.includes('take_tiles'));
      if (await page.evaluate(() => currentAzulView.round > 1)) break;
      await page.evaluate(() => {
        const view = currentAzulView;
        const you = getAzulSelfPlayer(view);
        const sources = view.factories.map((tiles, index) => ({ tiles, source: 'factory', source_index: index }));
        sources.push({ tiles: view.center, source: 'center' });
        const candidates = [];
        for (const source of sources) {
          for (const color of new Set(source.tiles)) {
            const count = source.tiles.filter(tile => tile === color).length;
            for (let row = -1; row < 5; row += 1) {
              if (row >= 0 && !isAzulRowPlaceable(view, row, color)) continue;
              const free = row < 0 ? 0 : row + 1 - you.pattern_lines[row].count;
              const placed = Math.min(count, free);
              const value = placed * 2 - (count - placed) + (row >= 0 && count >= free ? 10 : 0);
              candidates.push({ value, action: { type: 'take_tiles', source: source.source, source_index: source.source_index, color, target_row: row } });
            }
          }
        }
        candidates.sort((first, second) => second.value - first.value);
        socket.emit('game:action', { room_id: roomId, action: candidates[0].action });
      });
      await page.waitForFunction(() => currentAzulView?.round > 1 || !currentAzulView?.legal_actions.includes('take_tiles'));
    }
    await page.waitForFunction(() => currentAzulView?.round > 1);
    const live = await page.evaluate(() => structuredClone(currentAzulView));
    assert(live.players.some(player => player.wall_scores.flat().some(score => score > 0)));
    for (const player of live.players) {
      assert.equal(player.wall_scores.flat().filter(score => score !== null).length, player.wall.flat().filter(Boolean).length);
    }
    await page.reload();
    await page.waitForFunction(() => typeof currentAzulView !== 'undefined' && currentAzulView?.round > 1);
    assert.deepEqual(await page.evaluate(() => currentAzulView.players.map(player => player.wall_scores)), live.players.map(player => player.wall_scores));
    await page.evaluate(() => {
      setRoomControlsCollapsed(true);
      window.azulQaActions = [];
      const emit = socket.emit.bind(socket);
      socket.emit = (event, payload, ...rest) => {
        if (event === 'game:action') window.azulQaActions.push(payload);
        return emit(event, payload, ...rest);
      };
    });

    const fixture = structuredClone(live);
    fixture.players = Array.from({ length: 4 }, (_, index) => ({
      ...structuredClone(live.players[index % 2]),
      player_id: index === 0 ? fixture.you : `azul-qa-${index}`,
      name: ['Alice', 'Bob', 'Charlie', 'Diana'][index],
      wall: Array.from({ length: 5 }, (_, row) => Array.from({ length: 5 }, (_, column) => row < 3 || column === 0)),
      wall_scores: Array.from({ length: 5 }, (_, row) => Array.from({ length: 5 }, (_, column) => {
        if (row === 0) return column + 1;
        if (row === 1) return column + 6;
        if (row === 2 && column > 0) return null;
        return column === 0 ? 4 : null;
      })),
    }));

    for (const width of widths) {
      await page.setViewportSize({ width, height: 1000 });
      await page.evaluate(view => {
        renderAzulGameState({ view });
        document.getElementById('azulPlayersDetails').open = true;
      }, fixture);
      const firstWall = page.locator('#azulPlayers .azul-wall-grid').first();
      assert.deepEqual(await firstWall.locator('.azul-wall-score').allTextContents(), ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '4', '?', '?', '?', '?', '4', '4']);
      assert.equal(await page.locator('#azulPlayers .azul-player-card').count(), 4);
      assert.equal(await page.locator('#azulPanel .azul-wall-cell:not(.filled) .azul-wall-score').count(), 0);
      assert.equal(await page.locator('#azulYourBoard .azul-wall-score').count(), 17);
      await checkLayout(page);
      await page.evaluate(() => hideAzulTip());
      await page.screenshot({ path: `${output}/layout-${width}.png`, fullPage: true });

      const scored = firstWall.locator('.azul-wall-cell').nth(9);
      await scored.hover();
      await page.locator('#azulTip').waitFor({ state: 'visible' });
      assert.match(await page.locator('#azulTip').textContent(), /Earned 10 points when placed, before floor penalties and end-game bonuses/);
      await page.evaluate(() => toggleAzulExplainMode());
      await scored.click();
      await page.locator('#azulExplainModal').waitFor({ state: 'visible' });
      assert.match(await page.locator('#azulExplainContent').textContent(), /Earned 10 points when placed/);
      assert.equal(await page.evaluate(() => azulExplainMode), false);
      await page.keyboard.press('Escape');
      await page.locator('#azulExplainModal').waitFor({ state: 'hidden' });
      await page.evaluate(() => showAzulHelpModal());
      assert.match(await page.locator('#azulHelpContent').textContent(), /Later connections do not change these numbers/);
      await page.keyboard.press('Escape');
      await page.locator('#azulHelpModal').waitFor({ state: 'hidden' });
      console.log(`Azul labels, layout, hover, Explain, Help and Escape: ${width}px`);
    }

    await page.evaluate(view => {
      view.players.forEach(player => { delete player.wall_scores; });
      renderAzulGameState({ view });
    }, structuredClone(fixture));
    const legacyLabels = await page.locator('#azulPlayers .azul-wall-score').allTextContents();
    assert(legacyLabels.length > 0 && legacyLabels.every(label => label === '?'));
    assert.equal(await page.evaluate(() => window.azulQaActions.length), 0);

    const touchContext = await browser.newContext({ viewport: { width: 390, height: 900 }, hasTouch: true, isMobile: true });
    const touchPage = await touchContext.newPage();
    touchPage.on('pageerror', error => errors.push(error.message));
    await touchPage.route('https://fonts.googleapis.com/**', route => route.abort());
    await touchPage.goto(base);
    await touchPage.waitForFunction(() => typeof socket !== 'undefined' && socket.connected && cachedGameList);
    await touchPage.evaluate(async view => {
      await ensureGameAssets('azul');
      document.getElementById('azulPanel').classList.remove('hidden');
      setRoomControlsCollapsed(true);
      renderAzulGameState({ view });
      document.getElementById('azulPlayersDetails').open = true;
    }, fixture);
    const touchWall = touchPage.locator('#azulPlayers .azul-wall-grid').first();
    await touchWall.locator('.azul-wall-cell').nth(0).tap();
    assert.match(await touchPage.locator('#azulTip').textContent(), /Earned 1 point when placed/);
    await touchWall.locator('.azul-wall-cell').nth(9).tap();
    assert.match(await touchPage.locator('#azulTip').textContent(), /Earned 10 points when placed/);
    await touchPage.locator('#azulTip').waitFor({ state: 'hidden', timeout: 4500 });
    await touchWall.locator('.azul-wall-cell').nth(11).tap();
    assert.match(await touchPage.locator('#azulTip').textContent(), /Placement score unavailable/);
    assert.deepEqual(errors, []);
    console.log('Live scoring, reload, all players, legacy saves, touch replacement and 3-second dismissal passed.');
  } finally {
    await browser.close();
  }
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
