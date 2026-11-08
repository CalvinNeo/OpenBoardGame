const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const base = process.env.ROOM_TEST_URL || 'http://127.0.0.1:8778';
const output = 'build/room-reconnect';

(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const contexts = [];
  const errors = [];
  fs.mkdirSync(output, { recursive: true });

  async function newPage(mobile = false) {
    const context = await browser.newContext({
      viewport: mobile ? { width: 390, height: 844 } : { width: 1440, height: 900 },
      isMobile: mobile,
      hasTouch: mobile,
    });
    contexts.push(context);
    const page = await context.newPage();
    page.on('pageerror', error => errors.push(error.message));
    await page.route('https://fonts.googleapis.com/**', route => route.abort());
    await page.goto(base);
    await page.waitForFunction(() => typeof socket !== 'undefined' && socket.connected && cachedGameList);
    await page.evaluate(() => {
      window.reconnectTestRequests = [];
      socket.onAnyOutgoing((event, data) => {
        if (event === 'room:reconnect') window.reconnectTestRequests.push(data.room_id);
      });
    });
    return page;
  }

  async function openControls(page) {
    if (await page.locator('#roomControlsPanel').evaluate(element => element.classList.contains('collapsed'))) {
      await page.locator('#roomControlsToggleBtn').click();
    }
    await page.locator('#roomControlsBody').evaluate(element => Promise.all(element.getAnimations().map(animation => animation.finished)));
  }

  async function closeControls(page) {
    if (!await page.locator('#roomControlsPanel').evaluate(element => element.classList.contains('collapsed'))) {
      await page.locator('#roomControlsToggleBtn').click();
    }
  }

  async function waitRoom(page, target) {
    await page.waitForFunction(expected => roomSessionReady && !pendingRoomRequest && roomId === expected
      && currentRoomState?.room_id === expected && lastGameStatePayload?.room_id === expected, target);
  }

  async function switchRoom(page, target, icon = false) {
    await openControls(page);
    const row = page.locator(`[data-room-id="${target}"]`);
    const button = icon ? row.locator('.room-reconnect-btn') : row.getByRole('button', { name: 'Reconnect', exact: true });
    assert.equal(await button.isEnabled(), true);
    await button.click();
    await waitRoom(page, target);
  }

  async function sendActionFor(page, type, fields = {}) {
    const revision = await page.evaluate(({ type, fields }) => {
      const view = lastGameStatePayload.view;
      sendAction({ type, game_token: view.game_token, round_number: view.round_number,
        turn_number: view.turn_number, ...fields });
      return view.revision;
    }, { type, fields });
    await page.waitForFunction(before => lastGameStatePayload.view.revision > before, revision);
  }

  async function holdRoomList(page) {
    await page.waitForFunction(() => roomListRequests.size === 0);
    await page.evaluate(() => {
      window.reconnectTestListHandler = socket.listeners('room:list')[0];
      window.reconnectTestHeldLists = [];
      window.reconnectTestHoldList = data => window.reconnectTestHeldLists.push(data);
      socket.off('room:list', window.reconnectTestListHandler);
      socket.on('room:list', window.reconnectTestHoldList);
    });
  }

  async function releaseRoomList(page) {
    await page.evaluate(() => {
      socket.off('room:list', window.reconnectTestHoldList);
      socket.on('room:list', window.reconnectTestListHandler);
      for (const data of window.reconnectTestHeldLists) window.reconnectTestListHandler(data);
      window.reconnectTestHeldLists = [];
    });
  }

  async function openKeyEntry(page, target) {
    await openControls(page);
    await page.locator('#joinBtn').click();
    await page.locator('#roomIdInput').fill(target);
    await page.locator('#joinRoomForm button[type=submit]').click();
    await page.locator('#playerAccessKeyModeBtn').click();
  }

  async function checkLayout(page, width, oldRoomId, newRoomId) {
    await page.setViewportSize({ width, height: width < 500 ? 844 : 900 });
    await switchRoom(page, oldRoomId);
    await switchRoom(page, newRoomId, true);
    await openControls(page);
    await page.locator(`[data-room-id="${newRoomId}"]`).scrollIntoViewIfNeeded();
    assert.equal(await page.locator('#roomList').evaluate(list => list.scrollWidth > list.clientWidth + 1), false);
    await page.screenshot({ path: `${output}/room-list-${width}.png` });
    await closeControls(page);
    assert.deepEqual(await page.evaluate(() => {
      const reconnect = document.getElementById('gameReconnectBtn');
      const bounds = reconnect.getBoundingClientRect();
      return {
        pageOverflow: document.documentElement.scrollWidth > innerWidth,
        buttonFits: bounds.width > 0 && bounds.left >= 0 && bounds.right <= innerWidth
          && reconnect.scrollWidth <= reconnect.clientWidth + 1,
        enabled: !reconnect.disabled,
      };
    }), { pageOverflow: false, buttonFits: true, enabled: true }, `Layout at ${width}px`);
    const target = await page.evaluate(() => { roomSessionReady = false; return roomId; });
    await page.locator('#gameReconnectBtn').click();
    await waitRoom(page, target);
    await page.screenshot({ path: `${output}/reconnect-${width}.png` });
  }

  try {
    const host = await newPage();
    const returning = await newPage(true);
    const partner = await newPage();
    const players = [host, returning, partner];
    await host.evaluate(() => socket.emit('room:create', {
      name: 'Reconnect host', game_type: 'startups', config: { rounds: 1, seed: 136 },
    }));
    await host.waitForFunction(() => roomSessionReady && isGameAssetsLoaded('startups'));
    const oldRoomId = await host.evaluate(() => roomId);
    for (const [index, page] of [returning, partner].entries()) {
      await page.evaluate(({ target, name }) => socket.emit('room:join', { room_id: target, name }),
        { target: oldRoomId, name: index === 0 ? 'yz' : 'Reconnect partner' });
      await page.waitForFunction(() => roomSessionReady && isGameAssetsLoaded('startups'));
    }
    await host.evaluate(() => socket.emit('room:auto_save', { auto_save: true }));
    await host.waitForFunction(() => currentRoomState.auto_save);
    for (const page of players) await page.evaluate(() => socket.emit('room:ready', { ready: true }));
    await host.waitForFunction(() => !document.getElementById('startBtn').disabled);
    await openControls(host);
    await host.locator('#startBtn').click();
    await Promise.all(players.map(page => waitRoom(page, oldRoomId)));
    const identities = await Promise.all(players.map(page => page.evaluate(() => playerId)));
    const original = await returning.evaluate(() => ({ auth: getRoomAuth(roomId), key: buildPlayerAccessKey(),
      seat: currentRoomState.players.find(player => player.player_id === playerId).seat }));

    for (let step = 0; step < 200; step++) {
      const current = await host.evaluate(() => lastGameStatePayload.view);
      if (current.game_over) break;
      const actor = players[identities.indexOf(current.current_turn)];
      const view = await actor.evaluate(() => lastGameStatePayload.view);
      if (view.phase === 'take') {
        if (view.legal_actions.includes('draw')) await sendActionFor(actor, 'draw');
        else await sendActionFor(actor, 'take_market', { card_id: view.legal_market_ids[0] });
      } else {
        await sendActionFor(actor, 'invest', { card_id: view.hand[0].id });
      }
      const revision = await actor.evaluate(() => lastGameStatePayload.view.revision);
      await Promise.all(players.map(page => page.waitForFunction(expected => lastGameStatePayload.view.revision >= expected, revision)));
    }
    assert.equal(await host.evaluate(() => lastGameStatePayload.view.game_over), true);
    const oldView = await returning.evaluate(() => lastGameStatePayload.view);
    await returning.evaluate(() => socket.disconnect());
    await host.waitForFunction(expected => currentRoomState.players.some(player => player.player_id === expected && !player.connected), identities[1]);
    await host.evaluate(() => socket.emit('room:reopen', {}));
    await host.waitForFunction(previous => roomSessionReady && roomId !== previous
      && currentRoomState?.room_id === roomId && lastGameStatePayload?.room_id === roomId, oldRoomId);
    const newRoomId = await host.evaluate(() => roomId);
    assert.equal(await returning.evaluate(target => getRoomAuth(target), newRoomId), null);
    await returning.evaluate(() => socket.connect());
    await waitRoom(returning, oldRoomId);
    await returning.waitForFunction(target => Boolean(getRoomAuth(target)), newRoomId);
    assert.deepEqual(await returning.evaluate(() => lastGameStatePayload.view), oldView);
    assert.equal(await returning.evaluate(() => readRoomStorage(LAST_ROOM_ID_KEY)), oldRoomId);
    await switchRoom(returning, newRoomId);
    const newView = await returning.evaluate(() => lastGameStatePayload.view);
    assert.equal(newView.game_over, false);
    for (const target of [oldRoomId, newRoomId, oldRoomId, newRoomId]) {
      await switchRoom(returning, target, true);
      assert.equal(await returning.evaluate(() => playerId), identities[1]);
      assert.equal(await returning.evaluate(() => currentRoomState.players.find(player => player.player_id === playerId).seat), original.seat);
      assert.deepEqual(await returning.evaluate(() => lastGameStatePayload.view), target === oldRoomId ? oldView : newView);
    }
    console.log('Offline across a finished Startups game and reopen: both rooms reconnect independently with unchanged seat and game state.');

    await holdRoomList(returning);
    await returning.evaluate(({ oldRoomId, newRoomId, auth }) => {
      saveRoomAuthMap({ [oldRoomId]: auth });
      writeRoomStorage(LAST_ROOM_ID_KEY, newRoomId);
      roomSessionReady = false;
      updateGameReconnectButton();
      renderRoomList(currentRoomList);
      requestRoomList();
    }, { oldRoomId, newRoomId, auth: original.auth });
    await returning.waitForFunction(() => window.reconnectTestHeldLists.some(data => data.request_id != null));
    assert.equal(await returning.locator('#gameReconnectBtn').isDisabled(), true);
    await openControls(returning);
    assert.equal(await returning.locator(`[data-room-id="${newRoomId}"]`).getByRole('button', { name: 'Join', exact: true }).isDisabled(), true);
    await releaseRoomList(returning);
    await returning.waitForFunction(target => Boolean(getRoomAuth(target)), newRoomId);
    assert.equal(await returning.evaluate(() => roomId), newRoomId);
    assert.equal(await returning.evaluate(() => readRoomStorage(LAST_ROOM_ID_KEY)), newRoomId);
    assert.equal(await returning.locator('#gameReconnectBtn').isEnabled(), true);
    await closeControls(returning);
    await returning.locator('#gameReconnectBtn').click();
    await waitRoom(returning, newRoomId);
    assert.equal(await returning.evaluate(() => window.reconnectTestRequests.at(-1)), newRoomId);
    for (const width of [320, 390, 1024, 1440]) await checkLayout(returning, width, oldRoomId, newRoomId);

    await holdRoomList(returning);
    await returning.evaluate(() => { socket.disconnect(); socket.connect(); });
    await returning.waitForFunction(() => window.reconnectTestHeldLists.some(data => data.request_id != null));
    const beforeResume = await returning.evaluate(() => window.reconnectTestRequests.length);
    await returning.locator('#gameReconnectBtn').click();
    await waitRoom(returning, newRoomId);
    await releaseRoomList(returning);
    assert.equal(await returning.evaluate(() => window.reconnectTestRequests.length), beforeResume + 1);
    assert.equal(await returning.evaluate(() => roomId), newRoomId);
    await returning.reload();
    await waitRoom(returning, newRoomId);
    assert.deepEqual(await returning.evaluate(() => lastGameStatePayload.view), newView);
    console.log('Missing per-room credentials unlock both buttons; top Reconnect and reload keep the displayed room at 320/390/1024/1440px.');

    const imported = await newPage();
    await openKeyEntry(imported, newRoomId);
    await imported.locator('#accessKeyInput').fill(original.key);
    await imported.locator('#playerNameForm button[type=submit]').click();
    await waitRoom(imported, newRoomId);
    assert.deepEqual(await imported.evaluate(() => window.reconnectTestRequests), [newRoomId]);
    assert.equal(await imported.evaluate(() => playerId), identities[1]);
    await switchRoom(imported, oldRoomId);
    await switchRoom(imported, newRoomId);

    const stranger = await newPage();
    assert.equal(await stranger.locator(`[data-room-id="${newRoomId}"] .room-reconnect-btn`).count(), 0);
    const rejected = await stranger.evaluate(async ({ target, auth }) => {
      const wrong = { player_id: auth.player_id, reconnect_token: 'wrong-token', name: 'yz' };
      const nameOnly = await requestRoomList({ [target]: { name: 'yz' } });
      const invalid = await requestRoomList({ [target]: wrong });
      return [nameOnly.room_auth, invalid.room_auth, loadRoomAuthMap()];
    }, { target: oldRoomId, auth: original.auth });
    assert.deepEqual(rejected, [{}, {}, {}]);
    console.log('An older access key opens the explicitly requested reopened room; names and invalid tokens grant no access.');

    await openKeyEntry(stranger, 'unrelated-room');
    await stranger.locator('#accessKeyInput').fill(original.key);
    await stranger.locator('#playerNameForm button[type=submit]').click();
    await stranger.waitForFunction(() => document.getElementById('playerNameError').textContent.includes('does not contain a seat'));
    assert.deepEqual(await stranger.evaluate(() => window.reconnectTestRequests), []);
    assert.equal(await stranger.evaluate(() => readRoomStorage(ROOM_AUTH_KEY)), null);
    await stranger.keyboard.press('Escape');

    await openKeyEntry(stranger, newRoomId);
    await stranger.locator('#accessKeyInput').fill(original.key);
    await holdRoomList(stranger);
    await stranger.locator('#playerNameForm button[type=submit]').click();
    await stranger.waitForFunction(() => window.reconnectTestHeldLists.some(data => data.request_id != null));
    await stranger.keyboard.press('Escape');
    await releaseRoomList(stranger);
    assert.equal(await stranger.evaluate(() => !roomId && !playerId && !readRoomStorage(ROOM_AUTH_KEY)), true);
    assert.deepEqual(await stranger.evaluate(() => window.reconnectTestRequests), []);

    await imported.waitForFunction(() => roomListRequests.size === 0);
    await openControls(imported);
    await imported.locator('#settingsBtn').click();
    await imported.locator('#logoutBtn').click();
    await holdRoomList(imported);
    await imported.evaluate(() => { requestRoomList(); });
    await imported.waitForFunction(() => window.reconnectTestHeldLists.some(data => data.request_id != null && Object.keys(data.room_auth).length));
    await imported.locator('#logoutConfirmBtn').click();
    await imported.waitForFunction(() => socket.connected && roomLogoutRequested && !pendingLogoutRequest && !roomId && !playerId);
    await releaseRoomList(imported);
    assert.equal(await imported.evaluate(() => readRoomStorage(ROOM_AUTH_KEY)), null);
    assert.equal(await imported.locator('#gameReconnectBtn').isDisabled(), true);
    assert.equal(await imported.locator(`[data-room-id="${newRoomId}"] .room-reconnect-btn`).count(), 0);
    assert.equal(await imported.evaluate(() => roomId), null);
    console.log('Canceled import and late discovery replies after logout do not restore credentials or join any room.');
    assert.deepEqual(errors, []);
    console.log('All multi-room reconnect browser regressions passed.');
  } finally {
    for (const context of contexts) await context.close();
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
