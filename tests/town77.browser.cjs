const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const base = process.env.ROOM_TEST_URL || 'http://127.0.0.1:8797';
const output = 'tmp/town77-qa';

(async () => {
  fs.mkdirSync(output, { recursive: true });
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.route('https://fonts.googleapis.com/**', route => route.abort());
  try {
    await page.goto(base);
    await page.waitForFunction(() => typeof socket !== 'undefined' && socket.connected && cachedGameList);
    assert(await page.evaluate(() => cachedGameList.some(game => game.game_id === 'town77' && game.has_strategic_ai)));
    assert.equal(await page.locator('script[src*="/games/town77.js"]').count(), 0);
    await page.evaluate(() => socket.emit('room:create', { name: 'Rooftop Architect With A Long Name', game_type: 'town77', config: { seed: 17 } }));
    await page.waitForFunction(() => roomSessionReady && isGameAssetsLoaded('town77'));
    await page.evaluate(() => socket.emit('room:ready', { ready: true }));
    await page.waitForFunction(() => !document.getElementById('startBtn').disabled);
    await page.locator('#startBtn').click();
    await page.waitForFunction(() => lastGameStatePayload?.game_type === 'town77');
    await page.locator('#town77Table').waitFor({ state: 'visible' });
    assert.equal(await page.locator('.town77-cell').count(), 49);
    assert.equal(await page.locator('.town77-tile').count(), 3);
    assert.deepEqual(await page.evaluate(() => lastGameStatePayload.view.piles.map(pile => pile.count)), [17, 16, 16]);

    async function checkLayout(label) {
      for (const width of [320, 390, 1024, 1440]) {
        await page.setViewportSize({ width, height: width < 500 ? 844 : 1000 });
        await page.locator('#town77Board').scrollIntoViewIfNeeded();
        const layout = await page.evaluate(() => {
          const board = document.getElementById('town77Board').getBoundingClientRect();
          const controls = [...document.querySelectorAll('#town77Panel button, #town77HeaderActions button, #gameReconnectBtn')];
          return {
            width: innerWidth, scroll: document.documentElement.scrollWidth,
            board: { left: board.left, right: board.right, width: board.width, height: board.height },
            clipped: controls.filter(button => {
              const rect = button.getBoundingClientRect();
              return rect.width && rect.height && (button.scrollWidth > button.clientWidth + 1 || button.scrollHeight > button.clientHeight + 1);
            }).map(button => button.getAttribute('aria-label') || button.textContent),
            header: ['town77HelpBtn', 'gameReconnectBtn'].map(id => {
              const rect = document.getElementById(id).getBoundingClientRect();
              return { left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom };
            })
          };
        });
        assert(layout.scroll <= width + 1, `${label} page overflow ${JSON.stringify(layout)}`);
        assert(layout.board.left >= 0 && layout.board.right <= width + 1, `${label} board bounds ${JSON.stringify(layout)}`);
        assert(Math.abs(layout.board.width - layout.board.height) < 3, `${label} board not square ${JSON.stringify(layout)}`);
        assert.deepEqual(layout.clipped, [], `${label} clipped controls at ${width}`);
        assert(layout.header.every(rect => rect.left >= 0 && rect.right <= width + 1));
        assert(layout.header.every(rect => rect.top < layout.header[0].bottom && rect.bottom > layout.header[0].top), `Header wrapped at ${width}`);
        await page.screenshot({ path: `${output}/${label}-${width}.png`, fullPage: true });
      }
    }
    await checkLayout('solo');
    await page.setViewportSize({ width: 390, height: 844 });
    await page.locator('#town77HelpBtn').click();
    await page.locator('.obg-help-dialog[open]').waitFor();
    await page.locator('.obg-help-dialog[open]').getByRole('button', { name: 'EN', exact: true }).click();
    assert((await page.locator('.obg-help-dialog[open]').innerText()).includes('How you win'));
    await page.locator('.obg-help-dialog[open]').getByRole('tab', { name: 'Solo', exact: true }).click();
    assert((await page.locator('.obg-help-dialog[open]').innerText()).includes('17, 16, and 16'));
    await page.keyboard.press('Escape');
    assert.equal(await page.locator('.obg-help-dialog[open]').count(), 0);

    await page.locator('.town77-tile').first().scrollIntoViewIfNeeded();
    const tileBounds = await page.locator('.town77-tile').first().boundingBox();
    await page.dispatchEvent('.town77-tile', 'pointerdown', { pointerId: 9, pointerType: 'touch', clientX: tileBounds.x + 10, clientY: tileBounds.y + 10 });
    await page.dispatchEvent('body', 'pointermove', { pointerId: 9, pointerType: 'touch', clientX: tileBounds.x + 10, clientY: tileBounds.y - 60 });
    await page.dispatchEvent('body', 'pointerup', { pointerId: 9, pointerType: 'touch' });
    await page.locator('.town77-tile').first().dispatchEvent('click');
    assert.equal(await page.locator('.town77-tile.is-selected').count(), 0);
    await page.locator('.town77-tile').first().tap();
    assert.equal(await page.locator('.town77-tile.is-selected').count(), 1);
    await page.locator('#town77Hint').tap();
    assert.equal(await page.locator('.town77-tile.is-selected').count(), 0);

    await page.locator('#town77Supply').tap();
    await page.locator('#town77Tooltip').waitFor({ state: 'visible' });
    await page.locator('#town77Built').tap();
    assert((await page.locator('#town77Tooltip').innerText()).includes('seven-by-seven'));
    await page.locator('#town77Tooltip').waitFor({ state: 'hidden', timeout: 4500 });

    const before = await page.evaluate(() => JSON.stringify(lastGameStatePayload.view));
    await page.locator('#town77ExplainBtn').click();
    await page.locator('#town77Place').evaluate(button => {
      const rect = button.getBoundingClientRect();
      return { x: rect.x, y: rect.y };
    });
    await page.locator('.town77-tile').first().click();
    await page.locator('.obg-explain-dialog[open]').waitFor();
    assert.equal(await page.evaluate(() => JSON.stringify(lastGameStatePayload.view)), before);
    await page.keyboard.press('Escape');
    await page.locator('.town77-tile').first().tap();
    await page.locator('.town77-cell.is-legal').first().tap();
    assert.equal(await page.locator('.town77-cell.is-preview').count(), 1);
    assert.equal(await page.evaluate(() => lastGameStatePayload.view.score), 0);
    await page.screenshot({ path: `${output}/preview-390.png`, fullPage: true });
    await page.locator('[data-town77-move="1,0"]').click();
    assert(await page.locator('#town77Place').isDisabled());
    await page.locator('#town77ExplainBtn').click();
    await page.locator('#town77Place').click({ force: true });
    await page.locator('.obg-explain-dialog[open]').waitFor();
    assert.equal(await page.evaluate(() => lastGameStatePayload.view.score), 0);
    await page.keyboard.press('Escape');
    assert.equal(await page.locator('.town77-cell.is-preview').count(), 0);
    await page.locator('.town77-tile').first().tap();
    await page.locator('.town77-cell.is-legal').first().tap();
    await page.locator('#town77Place').click();
    await page.waitForFunction(() => lastGameStatePayload.view.score === 1);
    await page.locator('#town77Board').scrollIntoViewIfNeeded();
    await page.mouse.move(10, 10);
    await page.screenshot({ path: `${output}/solo-built-390.png`, fullPage: true });
    await page.reload();
    await page.locator('#town77Table').waitFor({ state: 'visible' });
    assert.equal(await page.evaluate(() => lastGameStatePayload.view.score), 1);

    await page.evaluate(() => socket.emit('room:create', { name: 'Architect', game_type: 'town77', config: { seed: 17 } }));
    await page.waitForFunction(() => currentRoomState?.status === 'lobby' && isGameAssetsLoaded('town77'));
    await page.evaluate(() => socket.emit('room:add_bot', {}));
    await page.waitForFunction(() => currentRoomState.players.length === 2);
    await page.evaluate(() => socket.emit('room:ready', { ready: true }));
    await page.waitForFunction(() => !document.getElementById('startBtn').disabled);
    await page.locator('#startBtn').click();
    await page.waitForFunction(() => lastGameStatePayload?.view?.solo === false);
    assert.equal(await page.locator('.town77-tile').count(), 4);
    assert(await page.evaluate(() => lastGameStatePayload.view.players.filter(player => player.player_id !== lastGameStatePayload.view.you).every(player => player.hand === null)));
    await checkLayout('multiplayer');
    await page.setViewportSize({ width: 390, height: 844 });
    const move = await page.evaluate(() => lastGameStatePayload.view.legal_placements[0]);
    await page.locator(`[data-town77-tile="${move.tile}"]`).tap();
    await page.locator(`[data-town77-cell="${move.x},${move.y}"]`).tap();
    await page.locator('#town77Place').click();
    await page.waitForFunction(() => lastGameStatePayload.view.phase === 'discard');
    await page.locator('.town77-tile').first().tap();
    assert(await page.locator('#town77DiscardPreview').isVisible());
    await page.screenshot({ path: `${output}/discard-390.png`, fullPage: true });
    await page.locator('#town77Discard').click();
    await page.waitForFunction(() => lastGameStatePayload.view.players.find(player => player.player_id === lastGameStatePayload.view.you).remaining === 3);
    await page.waitForFunction(() => lastGameStatePayload.view.current_turn === lastGameStatePayload.view.you);
    assert(await page.evaluate(() => lastGameStatePayload.view.players.some(player => player.player_id !== lastGameStatePayload.view.you && player.placed > 0)));

    for (let step = 0; step < 160; step += 1) {
      const current = await page.evaluate(() => ({ view: lastGameStatePayload.view, version: lastGameStatePayload.state_version }));
      const view = current.view;
      if (['final_review', 'game_over'].includes(view.phase)) break;
      if (view.current_turn !== view.you) {
        await page.waitForFunction(() => lastGameStatePayload.view.current_turn === lastGameStatePayload.view.you || ['final_review', 'game_over'].includes(lastGameStatePayload.view.phase));
        continue;
      }
      const action = view.legal_actions.includes('discard') ? { type: 'discard', tile: view.hand[0] }
        : view.legal_placements[0] || { type: 'pass' };
      await page.evaluate(action => sendAction(action), action);
      await page.waitForFunction(version => lastGameStatePayload.state_version > version, current.version);
    }
    await page.locator('#town77Results').waitFor({ state: 'visible' });
    await checkLayout('results');
    assert(await page.locator('#startBtn').isDisabled());
    await page.locator('#town77Results button').click();
    await page.waitForFunction(() => currentRoomState.status === 'game_over');
    assert(await page.evaluate(() => lastGameStatePayload.view.results_ready));

    await page.evaluate(() => socket.emit('room:create', { name: 'Exchange Architect', game_type: 'town77', config: { seed: 13 } }));
    await page.waitForFunction(() => currentRoomState?.status === 'lobby' && currentRoomState.players.length === 1);
    await page.evaluate(() => socket.emit('room:add_bot', {}));
    await page.waitForFunction(() => currentRoomState.players.length === 2);
    await page.evaluate(() => socket.emit('room:ready', { ready: true }));
    await page.waitForFunction(() => !document.getElementById('startBtn').disabled);
    await page.locator('#startBtn').click();
    await page.locator('#town77ExchangeBox').waitFor({ state: 'visible' });
    await page.locator('#town77ExchangeBox summary').click();
    const beforeExchange = await page.evaluate(() => JSON.stringify(lastGameStatePayload.view.hand));
    await page.locator('.town77-exchange-option').first().tap();
    assert.equal(await page.evaluate(() => JSON.stringify(lastGameStatePayload.view.hand)), beforeExchange);
    await page.screenshot({ path: `${output}/exchange-390.png`, fullPage: true });
    await page.locator('#town77Exchange').click();
    await page.waitForFunction(() => lastGameStatePayload.view.history.some(entry => entry.type === 'exchange'));
    assert.equal(await page.evaluate(() => lastGameStatePayload.view.hand.length), 4);
    assert.equal(await page.evaluate(() => lastGameStatePayload.view.phase), 'place');
    await page.locator('#town77ExplainBtn').click();
    await page.keyboard.press('Escape');
    assert.equal(await page.locator('#town77ExplainBtn').getAttribute('aria-pressed'), 'false');
    assert.deepEqual(errors, []);
    console.log('Town 77 browser acceptance passed: 320, 390, 1024, 1440; solo, multiplayer, AI, selection, move, discard, Help, Explain, reconnect, results.');
  } catch (error) {
    await page.screenshot({ path: `${output}/failure.png`, fullPage: true });
    throw error;
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
