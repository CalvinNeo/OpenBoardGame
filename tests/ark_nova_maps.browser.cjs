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
      page.on('console', message => {
        if (message.type() === 'error' && message.text().includes('Ark Nova frontend render failed')) errors.push(message.text());
      });
      await page.route('https://fonts.googleapis.com/**', route => route.abort());
      await page.goto(base);
      await page.waitForFunction(() => typeof socket !== 'undefined' && socket.connected && cachedGameList);
      await page.evaluate(() => {
        window.arkNovaQaErrors = [];
        socket.on('system:error', error => window.arkNovaQaErrors.push(error));
      });
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
    assert.equal(await alice.locator('#arkNovaMapMode').inputValue(), 'choose', 'ready updates preserve the chosen mode');
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
      await alice.locator('[data-arkn-command="preview-map"]').click();
      assert.match(await alice.locator('#arkNovaModalTitle').innerText(), /Silver Lake/);
      await alice.locator('#arkNovaModal .arkn-map-preview img').evaluate(image => image.decode());
      assert.equal(await alice.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, `preview overflow at ${width}`);
      await alice.locator('#arkNovaModal .arkn-modal-card').screenshot({ path: `tmp/ark-nova-maps/qa/preview-${width}.png` });
      await alice.keyboard.press('Escape');
    }
    await alice.locator('#arkNovaHelpBtn').click();
    assert.match(await alice.locator('#arkNovaModal').innerText(), /Maps 1A–6A/);
    await alice.keyboard.press('Escape');
    await alice.locator('#arkNovaExplainBtn').click();
    await alice.locator('[data-arkn-map-id="map1a"]').click();
    assert.match(await alice.locator('#arkNovaModal').innerText(), /independently/);
    assert.equal(await alice.locator('[data-arkn-map-id="map3a"]').getAttribute('aria-pressed'), 'true');
    await alice.keyboard.press('Escape');
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
    await alice.keyboard.press('Escape');

    // A new game exercises the harbor action with real server state.
    for (const page of pages) {
      await page.evaluate(() => socket.emit('room:leave', { room_id: roomId }));
      await page.evaluate(() => resetRoomState());
    }
    await alice.evaluate(() => socket.emit('room:create', { name: 'Harbor Alice', game_type: 'ark_nova', config: { map_mode: 'choose', seed: 17 } }));
    await alice.waitForFunction(() => roomSessionReady && currentRoomState?.status === 'lobby');
    assert.equal(await alice.locator('#arkNovaMapMode').inputValue(), 'choose', 'room config initializes the selector');
    const harborRoom = await alice.evaluate(() => roomId);
    await bob.evaluate(room_id => socket.emit('room:join', { room_id, name: 'Outdoor Bob' }), harborRoom);
    await bob.waitForFunction(room_id => roomSessionReady && roomId === room_id, harborRoom);
    for (const page of pages) await page.evaluate(() => socket.emit('room:ready', { room_id: roomId, ready: true }));
    await alice.waitForFunction(() => !document.getElementById('startBtn').disabled);
    await alice.locator('#startBtn').click();
    for (const [page, map] of [[alice, 'map4a'], [bob, 'map2a']]) {
      await page.locator(`[data-arkn-map-id="${map}"]`).click();
      await page.locator('[data-arkn-command="choose-map"]').click();
    }
    for (const page of pages) {
      await page.waitForFunction(() => lastGameStatePayload?.view?.phase === 'setup');
      await page.evaluate(() => sendAction({ type: 'keep_initial_cards', card_ids: lastGameStatePayload.view.your_hand.slice(0, 4).map(card => card.id) }));
    }
    await alice.waitForFunction(() => lastGameStatePayload?.view?.phase === 'action');
    assert.equal(await alice.locator('#arkNovaHarbor').isVisible(), false);
    await alice.evaluate(() => sendAction({ type: 'build', buildings: [{ building_type: 'standard_enclosure', size: 1, cells: ['A6'] }] }));
    await alice.locator('#arkNovaHarbor').waitFor({ state: 'visible' });
    const harborBefore = await alice.evaluate(() => {
      const view = lastGameStatePayload.view;
      const you = view.players.find(player => player.player_id === view.you);
      return { money: you.money, hand: view.your_hand.length, actions: you.action_cards };
    });
    for (const width of [1440, 393, 320]) {
      await alice.setViewportSize({ width, height: 1000 });
      assert.equal(await alice.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, `harbor overflow at ${width}`);
      await alice.locator('#arkNovaHarbor').screenshot({ path: `tmp/ark-nova-maps/qa/harbor-${width}.png` });
    }
    await alice.locator('[data-arkn-command="use-harbor"]').click();
    await alice.waitForFunction(() => !lastGameStatePayload.view.legal_actions.includes('use_harbor'));
    const harborAfter = await alice.evaluate(() => {
      const view = lastGameStatePayload.view;
      const you = view.players.find(player => player.player_id === view.you);
      return { money: you.money, hand: view.your_hand.length, actions: you.action_cards };
    });
    assert.equal(harborAfter.money, harborBefore.money + 3);
    assert.equal(harborAfter.hand, harborBefore.hand - 1);
    assert.deepEqual(harborAfter.actions, harborBefore.actions, 'harbor does not move an action card');
    assert.equal(await alice.locator('#arkNovaHarbor').isVisible(), false);
    await bob.waitForFunction(() => lastGameStatePayload?.view?.current_player === playerId);
    await bob.evaluate(() => sendAction({ type: 'gain_x', action_card: 'cards' }));
    await alice.waitForFunction(() => lastGameStatePayload?.view?.current_player === playerId);
    await alice.evaluate(() => sendAction({ type: 'gain_x', action_card: 'cards' }));
    await alice.locator('#arkNovaPending button', { hasText: 'Finish turn' }).click();
    await alice.waitForFunction(() => lastGameStatePayload?.view?.current_player !== playerId);
    assert.equal(await alice.evaluate(() => lastGameStatePayload.view.your_hand.length), harborAfter.hand, 'finishing does not discard a card');

    // Render a controlled public view to verify Outdoor Areas' extra capacity
    // in the animal picker without altering the server's game or hidden cards.
    await bob.evaluate(() => {
      const data = structuredClone(lastGameStatePayload);
      const view = data.view;
      view.current_player = view.current_turn = view.you;
      view.legal_actions = ['animals', 'gain_x'];
      const you = view.players.find(player => player.player_id === view.you);
      you.map.buildings = ['E4', 'A1'].map((cell, index) => ({ id: `capacity-${index}`, building_type: 'standard_enclosure', size: 1, capacity: 1, cells: [cell], occupied: false, occupied_by: [] }));
      you.map.occupancy = { E4: 'capacity-0', A1: 'capacity-1' };
      you.money = 100;
      view.your_hand = [{ id: 'capacity-animal', type: 'animal', name: { en: 'Capacity animal', zh: 'Capacity animal' }, enclosure_options: [{ type: 'standard', required_spaces: 3 }], placement: {}, conditions_met: true, abilities: [], icons: {} }];
      renderArkNovaGameState(data);
    });
    await bob.locator('[data-arkn-action-card="animals"]').click();
    await bob.locator('#arkNovaHand [data-arkn-card-select]').click();
    const enclosures = bob.locator('[data-arkn-enclosure-for="capacity-animal"]');
    assert.deepEqual(await enclosures.locator('option').evaluateAll(options => options.map(option => option.value)), ['', 'capacity-0']);
    await enclosures.selectOption('capacity-0');
    assert.equal(await bob.locator('[data-arkn-command="submit-action"]').isEnabled(), true);
    assert.match(await bob.locator('#arkNovaBuildings').innerText(), /capacity 3/);
    await bob.evaluate(() => renderArkNovaGameState(lastGameStatePayload));
    assert.deepEqual(errors, []);
    console.log('PASS: default Map 0, independent map choices, preview, Help/Explain, reconnect, per-player maps, harbor sale, outdoor capacity, desktop/mobile layouts.');
  } catch (error) {
    for (const [index, page] of pages.entries()) {
      console.error(`Page ${index}:`, await page.evaluate(() => ({
        room: roomId,
        phase: lastGameStatePayload?.view?.phase,
        you: lastGameStatePayload?.view?.you,
        current: lastGameStatePayload?.view?.current_player,
        maps: lastGameStatePayload?.view?.players.map(player => [player.name, player.map.id]),
        pending: lastGameStatePayload?.view?.pending_choice,
        legal: lastGameStatePayload?.view?.legal_actions,
        errors: window.arkNovaQaErrors,
      })));
    }
    console.error('Browser errors:', errors);
    throw error;
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
