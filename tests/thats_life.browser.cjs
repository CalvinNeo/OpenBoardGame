const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const base = process.env.ROOM_TEST_URL || 'http://127.0.0.1:8783';
const output = 'tmp/thats-life/compact';
const widths = [320, 390, 1024, 1440];

async function layout(page, label) {
  await page.evaluate(() => document.fonts.ready);
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  const issues = await page.evaluate(() => {
    const bad = [];
    const elements = document.querySelectorAll('#thatsLifePanel *, dialog[open] *');
    for (const element of elements) {
      const box = element.getBoundingClientRect();
      if (!box.width || !box.height || element.closest('.hidden, dialog:not([open])')) continue;
      if (element.closest('details:not([open])') && !element.closest('summary')) continue;
      const style = getComputedStyle(element);
      if (box.left < -1 || box.right > innerWidth + 1) bad.push(`${element.className}: outside viewport`);
      if (element.clientWidth && element.scrollWidth > element.clientWidth + 2
          && !['auto', 'scroll', 'hidden', 'clip'].includes(style.overflowX)) bad.push(`${element.className}: content overflow ${element.scrollWidth}/${element.clientWidth} ${element.textContent.slice(0, 35)}`);
    }
    for (const selector of ['#thatsLifeTrack', '#thatsLifePlayers', '.tl-occupants']) {
      for (const container of document.querySelectorAll(selector)) {
        const boxes = [...container.children].map(element => element.getBoundingClientRect());
        for (let first = 0; first < boxes.length; first += 1) {
          for (let second = first + 1; second < boxes.length; second += 1) {
            const left = boxes[first], right = boxes[second];
            if (Math.min(left.right, right.right) - Math.max(left.left, right.left) > 1
                && Math.min(left.bottom, right.bottom) - Math.max(left.top, right.top) > 1) bad.push(`${selector}: overlapping items`);
          }
        }
      }
    }
    const header = ['gameReconnectBtn', 'thatsLifeHelpBtn'].map(identifier => document.getElementById(identifier).getBoundingClientRect());
    if (Math.abs(header[0].top + header[0].height / 2 - header[1].top - header[1].height / 2) > 3) bad.push('Help/Reconnect wrapping');
    for (const element of document.querySelectorAll('#thatsLifePanel button.tl-piece')) {
      const box = element.getBoundingClientRect();
      if (box.width < 39 || box.height < 39) bad.push('undersized pawn target');
    }
    return { overflow: document.documentElement.scrollWidth > innerWidth, bad };
  });
  if (issues.overflow || issues.bad.length) await page.screenshot({ path: `${output}/failure.png`, fullPage: true });
  assert.deepEqual(issues, { overflow: false, bad: [] }, label);
}

async function renderFixture(page, view) {
  await page.evaluate(view => renderThatsLifeGameState({ game_type: 'thats_life', room_id: roomId, view }), view);
}

(async () => {
  fs.mkdirSync(output, { recursive: true });
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const hostContext = await browser.newContext({ viewport: { width: 390, height: 900 }, hasTouch: true });
  const guestContext = await browser.newContext();
  const host = await hostContext.newPage(), guest = await guestContext.newPage();
  const errors = [];
  host.on('pageerror', error => errors.push(error.message));
  try {
    for (const page of [host, guest]) {
      await page.goto(base);
      await page.waitForFunction(() => typeof socket !== 'undefined' && socket.connected && cachedGameList);
    }
    assert.equal(await host.locator('#thatsLifePanel').evaluate(element => element.childElementCount), 0);
    await host.evaluate(() => socket.emit('room:create', { name: 'Compact host', game_type: 'thats_life' }));
    await host.waitForFunction(() => roomSessionReady && currentGameType === 'thats_life' && isGameAssetsLoaded('thats_life'));
    for (const width of widths) {
      await host.setViewportSize({ width, height: 900 });
      await host.evaluate(() => setRoomControlsCollapsed(true));
      await layout(host, `Lobby ${width}`);
    }
    const room = await host.evaluate(() => roomId);
    await guest.evaluate(room => socket.emit('room:join', { room_id: room, name: 'Compact guest' }), room);
    await guest.waitForFunction(() => roomSessionReady && currentGameType === 'thats_life');
    await guest.evaluate(() => socket.emit('room:ready', { room_id: roomId, ready: true }));
    await host.evaluate(() => setRoomControlsCollapsed(false));
    await host.waitForFunction(() => currentRoomState.players.length === 2 && !document.getElementById('startBtn').disabled);
    await host.locator('#startBtn').click();
    await host.waitForFunction(() => lastGameStatePayload?.game_type === 'thats_life');
    await host.evaluate(() => setRoomControlsCollapsed(true));
    const measurements = [];
    for (const width of widths) {
      await host.setViewportSize({ width, height: 900 });
      await layout(host, `Initial ${width}`);
      const size = await host.locator('#thatsLifePanel').evaluate(element => ({ height: Math.round(element.getBoundingClientRect().height), bottom: Math.round(element.getBoundingClientRect().bottom) }));
      measurements.push({ width, ...size });
      assert.ok(size.bottom < 900, `Initial board should fit at ${width}: ${JSON.stringify(size)}`);
      await host.screenshot({ path: `${output}/initial-${width}.png`, fullPage: true });
    }
    await host.setViewportSize({ width: 390, height: 900 });
    await host.locator('#thatsLifeRoll').click();
    await host.waitForFunction(() => lastGameStatePayload.view.phase === 'move');
    const rolled = await host.evaluate(() => structuredClone(lastGameStatePayload.view));
    assert.equal(await host.locator('#thatsLifeTooltip').isVisible(), false);
    await host.locator('#thatsLifeStart button.tl-piece').click();
    assert.equal(await host.locator('.tl-confirm').count(), 1);
    assert.equal(await host.locator('.tl-destination').count(), 1);
    for (const width of widths) {
      await host.setViewportSize({ width, height: 900 });
      await layout(host, `Confirm ${width}`);
    }
    await host.keyboard.press('Escape');
    assert.equal(await host.locator('.tl-confirm').count(), 0);
    await host.locator('#thatsLifeStart button.tl-piece').click();
    await host.locator('.tl-course > .tl-caption h3').click();
    assert.equal(await host.locator('.tl-confirm').count(), 0);
    await host.locator('#thatsLifeStart button.tl-piece').click();
    await host.locator('.tl-confirm button', { hasText: 'Move' }).click();
    await host.waitForFunction(() => lastGameStatePayload.view.history.length === 1);
    const actual = await host.evaluate(() => structuredClone(lastGameStatePayload.view));
    await host.reload();
    await host.waitForFunction(() => lastGameStatePayload?.game_type === 'thats_life' && isGameAssetsLoaded('thats_life'));
    assert.equal(await host.evaluate(() => lastGameStatePayload.view.history.length), 1);
    await host.evaluate(() => setRoomControlsCollapsed(true));

    const crowded = structuredClone(rolled);
    for (let index = 2; index < 6; index += 1) {
      const playerId = `qa-player-${index}`;
      crowded.players.push({ ...structuredClone(crowded.players[0]), player_id: playerId, name: `A deliberately long player name ${index}`, tiles: [], score: index, converted_ids: [] });
      crowded.pieces.push({ id: `qa-pawn-${index}`, kind: 'pawn', owner: playerId, position: 'start', number: 1 });
    }
    const source = crowded.track[9].id;
    const mover = crowded.pieces.find(piece => piece.owner === crowded.you);
    mover.position = source;
    for (const piece of crowded.pieces) {
      if (piece.kind === 'pawn' && piece.owner !== crowded.you) piece.position = source;
    }
    const guard = crowded.pieces.find(piece => piece.position === source && piece.kind === 'guard');
    crowded.move_options = [{ piece_id: mover.id, from: source, to: crowded.track[13].id, collect: null },
      { piece_id: guard.id, from: source, to: crowded.track[13].id, collect: null }];
    for (const width of widths) {
      await host.setViewportSize({ width, height: 900 });
      await renderFixture(host, crowded);
      await layout(host, `Six players and crowded tile ${width}`);
      await host.locator(`button[data-piece-id="${mover.id}"]`).click();
      await layout(host, `Crowded tile confirmation ${width}`);
      assert.equal(await host.locator('#thatsLifeTrack').evaluate(element => {
        const columns = getComputedStyle(element).gridTemplateColumns.split(/\s+/).length;
        const previousTile = element.querySelector('.tl-confirm').previousElementSibling;
        return (Number(previousTile.querySelector('.tl-order').textContent) % columns) === 0;
      }), true, 'Confirmation follows a complete row without gaps');
      await host.screenshot({ path: `${output}/crowded-${width}.png`, fullPage: true });
    }

    await host.setViewportSize({ width: 390, height: 900 });
    await renderFixture(host, rolled);
    await host.locator('#thatsLifeHelpBtn').click();
    const help = host.locator('dialog[data-obg-help-game="thats_life"]');
    await help.waitFor({ state: 'visible' });
    for (const language of ['en', 'zh']) {
      await help.locator(`[data-obg-help-lang="${language}"]`).click();
      for (const section of ['movement', 'scoring', 'icons']) {
        await help.locator(`[data-obg-help-tab="${section}"]`).click();
        await layout(host, `Help ${language} ${section}`);
      }
    }
    await host.keyboard.press('Escape');
    await host.locator('#thatsLifeExplainBtn').click();
    const disabledRoll = host.locator('#thatsLifeRoll');
    assert.equal(await disabledRoll.isDisabled(), true);
    const rollBox = await disabledRoll.boundingBox();
    await host.mouse.click(rollBox.x + rollBox.width / 2, rollBox.y + rollBox.height / 2);
    await host.locator('dialog.obg-explain-dialog[open]').waitFor();
    assert.equal(await host.locator('#thatsLifeExplainBtn').getAttribute('aria-pressed'), 'false');
    await host.keyboard.press('Escape');
    await host.locator('#thatsLifeExplainBtn').click();
    await host.keyboard.press('Escape');
    assert.equal(await host.locator('#thatsLifeExplainBtn').getAttribute('aria-pressed'), 'false');
    await host.locator('.tl-player').first().click();
    await host.locator('#thatsLifePileDialog[open]').waitFor();
    assert.equal(await host.locator('#thatsLifeTooltip').isVisible(), false);
    await host.keyboard.press('Escape');

    const firstValue = host.locator('.tl-tile .tl-value').first();
    await firstValue.tap();
    await host.locator('#thatsLifeTooltip:not(.hidden)').waitFor();
    await host.waitForFunction(() => document.getElementById('thatsLifeTooltip').classList.contains('hidden'), { timeout: 5000 });
    const piece = host.locator('#thatsLifeStart button.tl-piece');
    await piece.dispatchEvent('pointerdown', { pointerId: 9, pointerType: 'touch', isPrimary: true, clientX: 50, clientY: 120, button: 0, bubbles: true });
    await piece.dispatchEvent('pointermove', { pointerId: 9, pointerType: 'touch', clientX: 50, clientY: 170, bubbles: true });
    await piece.dispatchEvent('pointerup', { pointerId: 9, pointerType: 'touch', clientX: 50, clientY: 170, bubbles: true });
    await piece.dispatchEvent('click');
    assert.equal(await host.locator('.tl-confirm').count(), 0);
    await piece.click();
    assert.equal(await host.locator('.tl-confirm').count(), 1);
    await host.keyboard.press('Escape');
    await host.setViewportSize({ width: 320, height: 700 });
    await renderFixture(host, crowded);
    const touchPiece = host.locator(`button[data-piece-id="${mover.id}"]`);
    await touchPiece.scrollIntoViewIfNeeded();
    const touchBox = await touchPiece.boundingBox();
    const protocol = await hostContext.newCDPSession(host);
    const start = { x: touchBox.x + touchBox.width / 2, y: touchBox.y + touchBox.height / 2 };
    await protocol.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [start] });
    for (const distance of [20, 45, 80]) {
      await protocol.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: start.x, y: start.y - distance }] });
    }
    await protocol.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await host.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    assert.equal(await host.locator('.tl-confirm').count(), 0, 'Native touch scrolling must not select a pawn');
    await protocol.detach();

    const collection = structuredClone(actual);
    collection.players[0].tiles = collection.track.slice(1, -1);
    collection.players[0].converted_ids = [collection.players[0].tiles[0].id];
    await renderFixture(host, collection);
    await host.locator('.tl-player').first().click();
    assert.equal(await host.locator('#thatsLifePile .tl-tile').count(), 32);
    await layout(host, 'Full collected tile dialog');
    await host.keyboard.press('Escape');

    const summary = structuredClone(crowded);
    summary.phase = 'round_summary'; summary.current_turn = null; summary.move_options = [];
    summary.config.rounds = 2; summary.legal_actions = ['next_round'];
    summary.round_summary = summary.players.map(player => ({ player_id: player.player_id, score: player.score, total_score: player.score }));
    for (const width of widths) {
      await host.setViewportSize({ width, height: 900 });
      await renderFixture(host, summary);
      await layout(host, `Round summary ${width}`);
    }
    summary.phase = 'game_over'; summary.game_over = true; summary.legal_actions = [];
    summary.winner_ids = [summary.players[0].player_id];
    await renderFixture(host, summary);
    assert.equal(await host.locator('#thatsLifeNext').isVisible(), false);
    await layout(host, 'Final results');
    await renderFixture(host, actual);
    assert.equal(await host.locator('script[src*="/thats_life.js"]').count(), 1);
    assert.deepEqual(errors, []);
    console.log(JSON.stringify({ measurements, checked: 'lobby, initial, six players, crowded tiles, complete-row confirmation, blank cancellation, Escape, live move, reload, bilingual Help, disabled Explain, full player collection, touch tooltip, synthetic swipe guard, native touch scrolling, round summary, final results' }, null, 2));
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exit(1); });
