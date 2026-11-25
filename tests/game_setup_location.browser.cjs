const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const base = process.env.ROOM_TEST_URL || 'http://127.0.0.1:8793';
const output = 'tmp/game-setup-location';
const games = [
  { id: 'las_vegas', prefix: 'lasVegas', config: { edition: 'royale', neutral_dice: false }, choices: { Edition: 'royale' } },
  { id: 'machi_koro', prefix: 'machiKoro', config: { edition: 'harbor', market: 'all' }, choices: { Edition: 'harbor', Market: 'all' } },
  { id: 'for_northwood', prefix: 'forNorthwood', config: { setup: 'standard', goal: 18 }, choices: { Setup: 'standard', Goal: '18' } },
  { id: 'thats_life', prefix: 'thatsLife', config: { setup: 'random', rounds: 3 }, choices: { Setup: 'random', Rounds: '3' } },
];

async function openControls(page) {
  await page.evaluate(() => setRoomControlsCollapsed(false));
  await page.locator('#roomControlsBody').evaluate(element => Promise.all(element.getAnimations().map(animation => animation.finished)));
}

(async () => {
  fs.mkdirSync(output, { recursive: true });
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const errors = [];
  try {
    for (const game of games) {
      const context = await browser.newContext({ viewport: { width: 390, height: 900 }, hasTouch: true });
      const page = await context.newPage();
      page.on('pageerror', error => errors.push(error.message));
      await page.route('https://fonts.googleapis.com/**', route => route.abort());
      await page.goto(base);
      await page.waitForFunction(() => typeof socket !== 'undefined' && socket.connected && cachedGameList);
      assert.equal(await page.locator(`#${game.prefix}ConfigBox`).evaluate(element => element.childElementCount), 0);
      await page.evaluate(gameId => socket.emit('room:create', { name: 'Setup host', game_type: gameId }), game.id);
      await page.waitForFunction(gameId => roomSessionReady && currentGameType === gameId && isGameAssetsLoaded(gameId), game.id);
      await openControls(page);
      assert.equal(await page.locator(`#roomPanel #gameConfigSection #${game.prefix}ConfigBox`).count(), 1);
      assert.equal(await page.locator(`#${game.prefix}Panel select, #${game.prefix}Panel input`).count(), 0);
      if (game.id === 'las_vegas') {
        await page.locator('#lasVegasNeutralDice').check();
        await page.evaluate(() => socket.emit('room:ready', { room_id: roomId, ready: false }));
        await page.waitForFunction(() => currentRoomState.players.some(player => player.player_id === playerId && !player.ready));
        assert.equal(await page.locator('#lasVegasNeutralDice').isChecked(), true);
        for (const width of [320, 390, 1024, 1440]) {
          await page.setViewportSize({ width, height: 1000 });
          await openControls(page);
          const bounds = await page.locator('#lasVegasNeutralOption').evaluate(element => {
            const input = element.querySelector('input').getBoundingClientRect();
            const label = element.querySelector('label').getBoundingClientRect();
            return { sameLine: input.top < label.bottom && label.top < input.bottom, fits: label.right <= innerWidth };
          });
          assert.deepEqual(bounds, { sameLine: true, fits: true });
          await page.screenshot({ path: `${output}/las_vegas-classic-${width}.png`, fullPage: true });
        }
      }
      for (const [suffix, value] of Object.entries(game.choices)) await page.locator(`#${game.prefix}${suffix}`).selectOption(value);
      const selected = await page.locator(`#${game.prefix}ConfigBox select`).evaluateAll(elements => elements.map(element => element.value));
      if (game.id === 'las_vegas') assert.equal(await page.locator('#lasVegasNeutralOption').isVisible(), false);
      await page.evaluate(() => socket.emit('room:ready', { room_id: roomId, ready: true }));
      await page.waitForFunction(() => currentRoomState.players.some(player => player.player_id === playerId && player.ready));
      assert.deepEqual(await page.locator(`#${game.prefix}ConfigBox select`).evaluateAll(elements => elements.map(element => element.value)), selected);

      for (const width of [320, 390, 1024, 1440]) {
        await page.setViewportSize({ width, height: 1000 });
        await openControls(page);
        const box = page.locator(`#${game.prefix}ConfigBox`);
        await box.scrollIntoViewIfNeeded();
        assert.equal(await box.isVisible(), true);
        const issues = await box.evaluate(element => {
          const failures = [];
          for (const node of [element, ...element.querySelectorAll('*')]) {
            const bounds = node.getBoundingClientRect();
            if (!bounds.width || !bounds.height || node.closest('.hidden')) continue;
            if (bounds.left < -1 || bounds.right > innerWidth + 1) failures.push(`${node.id || node.tagName}: outside viewport`);
            if (node.clientWidth && node.scrollWidth > node.clientWidth + 2) failures.push(`${node.id || node.tagName}: content overflow`);
          }
          if (document.documentElement.scrollWidth > innerWidth + 1) failures.push('Page overflow');
          return failures;
        });
        assert.deepEqual(issues, [], `${game.id} at ${width}px`);
        await page.screenshot({ path: `${output}/${game.id}-${width}.png`, fullPage: true });
      }

      const credentials = await page.evaluate(() => ({ room_id: roomId, ...getRoomAuth(roomId) }));
      const otherContext = await browser.newContext();
      const other = await otherContext.newPage();
      await other.goto(base);
      await other.waitForFunction(() => typeof socket !== 'undefined' && socket.connected);
      await other.evaluate(() => socket.emit('room:create', { name: 'Other room', game_type: 'cabo' }));
      await other.waitForFunction(() => roomSessionReady && currentGameType === 'cabo');
      const otherCredentials = await other.evaluate(() => ({ room_id: roomId, ...getRoomAuth(roomId) }));
      await page.evaluate(auth => socket.emit('room:reconnect', auth), otherCredentials);
      await page.waitForFunction(() => currentGameType === 'cabo' && roomSessionReady);
      assert.equal(await page.locator(`#${game.prefix}ConfigBox`).isVisible(), false);
      await page.evaluate(auth => socket.emit('room:reconnect', auth), credentials);
      await page.waitForFunction(gameId => roomSessionReady && currentGameType === gameId, game.id);
      await otherContext.close();
      await openControls(page);
      assert.equal(await page.locator(`#${game.prefix}ConfigBox`).isVisible(), true);
      for (const [suffix, value] of Object.entries(game.choices)) await page.locator(`#${game.prefix}${suffix}`).selectOption(value);
      if (game.id !== 'for_northwood') {
        await page.evaluate(() => socket.emit('room:add_bot', { room_id: roomId }));
        await page.waitForFunction(() => currentRoomState.players.length === 2);
      }
      await page.evaluate(() => {
        window.setupStartRequests = [];
        socket.onAnyOutgoing((event, payload) => { if (event === 'room:start') window.setupStartRequests.push(payload); });
        socket.emit('room:ready', { room_id: roomId, ready: true });
      });
      await page.waitForFunction(() => !document.getElementById('startBtn').disabled);
      await page.locator('#startBtn').click();
      await page.waitForFunction(gameId => currentRoomState.status === 'in_game' && lastGameStatePayload?.game_type === gameId, game.id);
      assert.deepEqual(await page.evaluate(() => window.setupStartRequests.at(-1).config), game.config);
      const actualConfig = await page.evaluate(() => lastGameStatePayload.view.config);
      for (const [key, value] of Object.entries(game.config)) assert.deepEqual(actualConfig[key], value);
      await openControls(page);
      assert.equal(await page.locator(`#${game.prefix}ConfigBox`).isVisible(), false);
      await page.reload();
      await page.waitForFunction(gameId => roomSessionReady && currentGameType === gameId && lastGameStatePayload?.game_type === gameId && isGameAssetsLoaded(gameId), game.id);
      await openControls(page);
      assert.equal(await page.locator(`#${game.prefix}ConfigBox`).isVisible(), false);
      assert.equal(await page.locator(`#${game.prefix}Panel select, #${game.prefix}Panel input`).count(), 0);
      await page.evaluate(gameId => socket.emit('room:create', { name: 'Leave setup', game_type: gameId }), game.id);
      await page.waitForFunction(gameId => currentRoomState?.status === 'lobby' && currentGameType === gameId, game.id);
      await openControls(page);
      assert.equal(await page.locator(`#${game.prefix}ConfigBox`).isVisible(), true);
      if (game.id === 'las_vegas') {
        await page.locator('#lasVegasNeutralDice').check();
        for (let count = 2; count <= 5; count += 1) {
          await page.evaluate(() => socket.emit('room:add_bot', { room_id: roomId }));
          await page.waitForFunction(expected => currentRoomState.players.length === expected, count);
        }
        assert.equal(await page.locator('#lasVegasNeutralDice').isChecked(), false);
        assert.equal(await page.locator('#lasVegasNeutralDice').isDisabled(), true);
      }
      await page.locator('#leaveBtn').click();
      await page.locator('#leaveConfirmBtn').click();
      await page.waitForFunction(() => !roomId);
      assert.equal(await page.locator(`#${game.prefix}ConfigBox`).isVisible(), false);
      await context.close();
    }
    assert.deepEqual(errors, []);
    console.log('PASS: four games configure only in Room; four widths, lazy load, Ready, room switching, start payloads, reload, leave and neutral-dice limits.');
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
