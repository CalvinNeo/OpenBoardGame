// Run against a local test server with PLAYWRIGHT_MODULE and ROOM_TEST_URL.
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const base = process.env.ROOM_TEST_URL || 'http://127.0.0.1:8873';

(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const errors = [];
  const pages = [];
  try {
    for (let index = 0; index < 2; index += 1) {
      const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
      const page = await context.newPage();
      page.on('pageerror', error => errors.push(error.message));
      await page.route('https://fonts.googleapis.com/**', route => route.abort());
      await page.goto(base);
      await page.waitForFunction(() => typeof socket !== 'undefined' && socket.connected && cachedGameList);
      pages.push(page);
    }
    const [alice, bob] = pages;
    await alice.evaluate(() => socket.emit('room:create', { name: 'Map Alice', game_type: 'ark_nova' }));
    await alice.waitForFunction(() => roomSessionReady && isGameAssetsLoaded('ark_nova'));
    assert.equal(await alice.locator('#arkNovaMapMode').inputValue(), 'map0');
    const room = await alice.evaluate(() => roomId);
    await bob.evaluate(room_id => socket.emit('room:join', { room_id, name: 'Map Bob' }), room);
    await bob.waitForFunction(() => roomSessionReady && isGameAssetsLoaded('ark_nova'));
    for (const page of pages) await page.evaluate(() => socket.emit('room:ready', { room_id: roomId, ready: true }));
    await alice.waitForFunction(() => !document.getElementById('startBtn').disabled);
    await alice.locator('#startBtn').click();
    await alice.waitForFunction(() => lastGameStatePayload?.view?.phase === 'setup');
    assert.equal(await alice.evaluate(() => lastGameStatePayload.view.players.every(player => player.map.id === 'map0')), true);
    assert.equal(await alice.locator('#arkNovaMapSelection').isVisible(), false);
    // A second room exercises the user-facing map-mode setting.
    for (const page of pages) {
      await page.evaluate(() => socket.emit('room:leave', { room_id: roomId }));
      await page.evaluate(() => resetRoomState());
    }
    await alice.evaluate(() => socket.emit('room:create', { name: 'Map Alice', game_type: 'ark_nova' }));
    await alice.waitForFunction(() => roomSessionReady && currentRoomState?.status === 'lobby');
    const choiceRoom = await alice.evaluate(() => roomId);
    await bob.evaluate(room_id => socket.emit('room:join', { room_id, name: 'Map Bob' }), choiceRoom);
    await bob.waitForFunction(room_id => roomSessionReady && roomId === room_id, choiceRoom);
    await alice.locator('#arkNovaMapMode').selectOption('choose');
    for (const page of pages) await page.evaluate(() => socket.emit('room:ready', { room_id: roomId, ready: true }));
    await alice.waitForFunction(() => !document.getElementById('startBtn').disabled);
    await alice.locator('#startBtn').click();
    for (const page of pages) await page.waitForFunction(() => lastGameStatePayload?.view?.phase === 'choose_map');
    assert.equal(await alice.locator('[data-arkn-map-id]').count(), 7);
    assert.equal(await alice.locator('#arkNovaHand').isVisible(), false);
    await alice.locator('[data-arkn-map-id="map3a"]').click();
    assert.equal(await alice.locator('[data-arkn-map-id="map3a"]').getAttribute('aria-pressed'), 'true');
    fs.mkdirSync('tmp/ark-nova-maps/qa', { recursive: true });
    for (const width of [1440, 393, 320]) {
      await alice.setViewportSize({ width, height: 1000 });
      assert.equal(await alice.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, `selection overflow at ${width}`);
      await alice.locator('#arkNovaMapSelection').screenshot({ path: `tmp/ark-nova-maps/qa/selection-${width}.png` });
    }
    await alice.locator('[data-arkn-command="choose-map"]').click();
    await alice.waitForFunction(() => !lastGameStatePayload.view.legal_actions.includes('choose_map'));
    await alice.reload();
    await alice.waitForFunction(() => isGameAssetsLoaded('ark_nova') && lastGameStatePayload?.view?.map_definition?.id === 'map3a');
    assert.equal(await alice.locator('[data-arkn-map-id="map3a"]').getAttribute('aria-pressed'), 'true');
    await bob.locator('[data-arkn-map-id="map6a"]').click();
    await bob.locator('[data-arkn-command="choose-map"]').click();
    for (const page of pages) {
      await page.waitForFunction(() => lastGameStatePayload?.view?.phase === 'setup');
      await page.evaluate(() => sendAction({ type: 'keep_initial_cards', card_ids: lastGameStatePayload.view.your_hand.slice(0, 4).map(card => card.id) }));
    }
    await alice.waitForFunction(() => lastGameStatePayload?.view?.phase === 'action');
    await alice.waitForFunction(() => document.querySelector('#arkNovaMapObject')?.contentDocument?.querySelector('[data-cell-id="E1"]'));
    assert.match(await alice.locator('#arkNovaMapTitle').innerText(), /Silver Lake/);
    assert.match(await alice.locator('#arkNovaMapObject').getAttribute('data'), /map3a\.svg/);
    for (const width of [1440, 393, 320]) {
      await alice.setViewportSize({ width, height: 1000 });
      assert.equal(await alice.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, `game overflow at ${width}`);
      await alice.locator('.arkn-zoo-surface').screenshot({ path: `tmp/ark-nova-maps/qa/silver-lake-${width}.png` });
    }
    await alice.locator('[data-arkn-command="map-info"]').click();
    assert.match(await alice.locator('#arkNovaModal').innerText(), /Silver Lake/);
    await alice.keyboard.press('Escape');
    assert.equal(await alice.locator('#arkNovaModal').isVisible(), false);
    const mapFrame = alice.frames().find(frame => frame.url().includes('/map3a.svg'));
    assert.ok(mapFrame, 'the Silver Lake SVG has a loaded document');
    await mapFrame.locator('[data-cell-id="E1"]').click();
    assert.match(await alice.locator('#arkNovaToast').innerText(), /Gain 2 money/);
    await mapFrame.locator('[data-reward-id="determination"]').click();
    assert.match(await alice.locator('#arkNovaToast').innerText(), /additional action/i);
    await alice.waitForFunction(() => !document.getElementById('arkNovaToast').classList.contains('is-visible'));
    await alice.locator('#arkNovaExplainBtn').click();
    await mapFrame.locator('[data-cell-id="E1"]').click();
    assert.match(await alice.locator('#arkNovaModal').innerText(), /Gain 2 money/);
    assert.equal(await alice.locator('#arkNovaExplainBtn').getAttribute('aria-pressed'), 'false');
    await alice.keyboard.press('Escape');
    // The opponent view must load its own SVG and map rules.
    const opponent = await alice.evaluate(() => lastGameStatePayload.view.players.find(player => player.player_id !== playerId).player_id);
    await alice.locator(`[data-arkn-view-zoo="${opponent}"]`).click();
    await alice.waitForFunction(() => document.getElementById('arkNovaMapObject').data.includes('map6a.svg'));
    assert.match(await alice.locator('#arkNovaMapTitle').innerText(), /Research Institute/);
    await alice.locator('[data-arkn-command="map-info"]').click();
    assert.match(await alice.locator('#arkNovaModal').innerText(), /ignore one condition/i);
    assert.deepEqual(errors, []);
    console.log('PASS: default Map 0, independent map choices, previews, reconnect, per-player maps, map info, desktop/mobile layouts.');
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
