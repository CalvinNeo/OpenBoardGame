const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const base = process.env.ROOM_TEST_URL || 'http://127.0.0.1:8778';
const output = 'build/room-access-key';

function encodeAccessKey(payload) {
  return `obg2:${Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url')}`;
}

function decodeAccessKey(key) {
  assert.match(key, /^obg2:[A-Za-z0-9_-]+$/);
  return JSON.parse(Buffer.from(key.slice(5), 'base64url').toString('utf8'));
}

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
      permissions: ['clipboard-read', 'clipboard-write'],
    });
    contexts.push(context);
    const page = await context.newPage();
    page.on('pageerror', error => errors.push(error.message));
    await page.route('https://fonts.googleapis.com/**', route => route.abort());
    await page.goto(base);
    await page.waitForFunction(() => typeof socket !== 'undefined' && socket.connected && cachedGameList);
    await page.evaluate(() => {
      window.accessKeyTestEvents = [];
      socket.onAnyOutgoing(event => window.accessKeyTestEvents.push(event));
    });
    return page;
  }

  async function openControls(page) {
    if (await page.locator('#roomControlsPanel').evaluate(element => element.classList.contains('collapsed'))) {
      await page.locator('#roomControlsToggleBtn').click();
    }
  }

  async function openKeyEntry(page, room = null) {
    await openControls(page);
    if (room) {
      await page.locator('#joinBtn').click();
      await page.locator('#roomIdInput').fill(room);
      await page.locator('#joinRoomForm button[type=submit]').click();
    } else {
      await page.locator('#createBtn').click();
    }
    await page.locator('#playerAccessKeyModeBtn').click();
    assert.equal(await page.locator('#nameInput').isVisible(), false);
    assert.equal(await page.locator('#accessKeyInput').getAttribute('type'), 'password');
  }

  async function getIdentity(page) {
    return page.evaluate(() => ({ room: roomId, player: playerId, name: playerName,
      seat: currentRoomState.players.find(player => player.player_id === playerId).seat }));
  }

  async function createAnotherRoom(page) {
    await openControls(page);
    await page.locator('#createBtn').click();
    await page.locator('#gameSearchInput').fill('cabo');
    const previousRoom = await page.evaluate(() => roomId);
    await page.locator('[data-game-id="cabo"]').click();
    await page.waitForFunction(previous => roomSessionReady && !pendingRoomRequest && roomId !== previous, previousRoom);
    return getIdentity(page);
  }

  async function switchSavedRoom(page, identity, byRoomId = false) {
    await openControls(page);
    if (byRoomId) {
      await page.locator('#joinBtn').click();
      await page.locator('#roomIdInput').fill(identity.room);
      await page.locator('#joinRoomForm button[type=submit]').click();
    } else {
      await page.locator(`[data-room-id="${identity.room}"]`).getByRole('button', { name: 'Reconnect', exact: true }).click();
    }
    await page.waitForFunction(expected => roomSessionReady && !pendingRoomRequest
      && roomId === expected.room && playerId === expected.player, identity);
    assert.deepEqual(await getIdentity(page), identity);
  }

  async function submitKey(page, key, identity) {
    await page.locator('#accessKeyInput').fill(`  ${key}  `);
    await page.locator('#playerNameForm button[type=submit]').click();
    await page.waitForFunction(expected => roomSessionReady && !pendingRoomRequest
      && roomId === expected.room && playerId === expected.player, identity);
    await page.locator('#playerNameModal').waitFor({ state: 'hidden' });
    assert.equal(await page.locator('#accessKeyInput').inputValue(), '');
    assert.equal(await page.evaluate(() => playerName), identity.name);
    assert.equal(await page.evaluate(() => currentRoomState.players.find(player => player.player_id === playerId).seat), identity.seat);
    assert.equal(await page.evaluate(() => window.accessKeyTestEvents.some(event => ['room:create', 'room:join'].includes(event))), false);
    assert.equal(await page.evaluate(value => Object.values(localStorage).some(stored => stored.includes(value)), key), false);
  }

  async function openLogout(page) {
    await page.locator('#settingsBtn').click();
    await page.locator('#logoutBtn').click();
  }

  async function copyAndLogout(page) {
    await page.bringToFront();
    await openControls(page);
    await openLogout(page);
    await page.locator('#logoutCopyBtn').click();
    await page.waitForFunction(() => !playerId && !roomId && !playerName && socket.connected);
    assert.equal(await page.locator('#logoutModal').isVisible(), false);
    assert.deepEqual(await page.evaluate(() => [ROOM_AUTH_KEY, NAME_STORAGE_KEY, LAST_ROOM_ID_KEY].map(key => readRoomStorage(key))), [null, null, null]);
    return page.evaluate(() => navigator.clipboard.readText());
  }

  async function assertModalFits(page, selector) {
    const layout = await page.locator(selector).evaluate(modal => {
      const content = modal.querySelector('.modal-content');
      const bounds = content.getBoundingClientRect();
      const overflowing = [...content.querySelectorAll('*:not(input):not(textarea)')].filter(element => element.getClientRects().length
        && element.scrollWidth > element.clientWidth + 1).map(element => element.id || element.className);
      return {
        inside: bounds.left >= 0 && bounds.right <= innerWidth && bounds.top >= 0 && bounds.bottom <= innerHeight,
        pageOverflow: document.documentElement.scrollWidth > innerWidth,
        overflowing,
      };
    });
    assert.deepEqual(layout, { inside: true, pageOverflow: false, overflowing: [] });
  }

  try {
    const host = await newPage();
    const returning = await newPage(true);
    await host.locator('#createBtn').click();
    await host.locator('#nameInput').fill('Transfer player 棋手 🎲');
    await host.locator('#playerNameForm button[type=submit]').click();
    await host.locator('#gameSearchInput').fill('cabo');
    await host.locator('[data-game-id="cabo"]').click();
    await host.waitForFunction(() => roomSessionReady && !pendingRoomRequest);
    const identity = await host.evaluate(() => ({ room: roomId, player: playerId, name: playerName,
      seat: currentRoomState.players.find(player => player.player_id === playerId).seat }));

    for (const viewport of [{ width: 320, height: 568 }, { width: 390, height: 844 },
      { width: 1024, height: 768 }, { width: 1440, height: 900 }]) {
      await host.setViewportSize(viewport);
      await openControls(host);
      await openLogout(host);
      assert.equal(await host.locator('#logoutModal button').count(), 3);
      await assertModalFits(host, '#logoutModal');
      await host.screenshot({ path: `${output}/logout-${viewport.width}.png` });
      await host.keyboard.press('Shift+Tab');
      assert.equal(await host.evaluate(() => document.activeElement.id), 'logoutCopyBtn');
      await host.keyboard.press('Tab');
      assert.equal(await host.evaluate(() => document.activeElement.id), 'logoutCancelBtn');
      await host.keyboard.press('Escape');
      assert.equal(await host.evaluate(() => document.activeElement.id), 'settingsBtn');
      assert.equal(await host.evaluate(() => roomId), identity.room);

      await returning.setViewportSize(viewport);
      await openKeyEntry(returning);
      await assertModalFits(returning, '#playerNameModal');
      await returning.screenshot({ path: `${output}/access-key-${viewport.width}.png` });
      await returning.locator('#accessKeyInput').fill('invalid-key');
      await returning.locator('#playerNameForm button[type=submit]').click();
      assert.match(await returning.locator('#playerNameError').textContent(), /complete access key/);
      await assertModalFits(returning, '#playerNameModal');
      await returning.locator('#playerNameCancelBtn').click();
      assert.equal(await returning.locator('#accessKeyInput').inputValue(), '');
    }
    await returning.setViewportSize({ width: 390, height: 844 });
    assert.equal(await returning.evaluate(() => window.accessKeyTestEvents.includes('room:reconnect')), false);

    await openKeyEntry(returning);
    await returning.locator('#accessKeyInput').fill('obg1:missing-room:player:token');
    await returning.evaluate(() => socket.disconnect());
    await returning.locator('#playerNameForm button[type=submit]').click();
    assert.match(await returning.locator('#playerNameError').textContent(), /Connect to the server/);
    await returning.waitForFunction(() => socket.connected);
    await returning.evaluate(() => {
      window.accessKeyTestOriginalEmit = socket.emit;
      socket.emit = function(event, ...args) {
        if (event === 'room:reconnect') {
          window.accessKeyTestReconnectAck = args[args.length - 1];
          return this;
        }
        return window.accessKeyTestOriginalEmit.call(this, event, ...args);
      };
    });
    await returning.locator('#playerNameForm button[type=submit]').click();
    assert.equal(await returning.locator('#playerNameForm button[type=submit]').isDisabled(), true);
    assert.equal(await returning.locator('#playerNameModeBtn').isDisabled(), true);
    await returning.evaluate(() => window.accessKeyTestReconnectAck(new Error('Timed out')));
    assert.match(await returning.locator('#playerNameError').textContent(), /No response from the server/);
    assert.equal(await returning.locator('#playerNameForm button[type=submit]').isDisabled(), false);
    await returning.locator('#playerNameForm button[type=submit]').click();
    await returning.keyboard.press('Escape');
    await returning.waitForFunction(() => socket.connected && !pendingRoomRequest);
    await returning.evaluate(() => {
      window.accessKeyTestReconnectAck(new Error('Late response'));
      socket.emit = window.accessKeyTestOriginalEmit;
    });
    assert.equal(await returning.locator('#playerNameModal').isVisible(), false);
    assert.equal(await returning.locator('#accessKeyInput').inputValue(), '');
    assert.equal(await returning.evaluate(() => !roomId && !playerId && !playerName && !readRoomStorage(ROOM_AUTH_KEY)), true);

    await openLogout(host);
    await host.locator('#logoutCancelBtn').click();
    assert.equal(await host.evaluate(() => roomSessionReady), true);
    await openLogout(host);
    await host.locator('#logoutModal').click({ position: { x: 2, y: 2 } });
    assert.equal(await host.locator('#logoutModal').isVisible(), false);

    await host.evaluate(() => {
      window.accessKeyTestWrite = navigator.clipboard.writeText;
      window.accessKeyTestExec = document.execCommand;
      navigator.clipboard.writeText = async () => { throw new Error('Clipboard denied'); };
      document.execCommand = () => false;
    });
    await openLogout(host);
    await host.locator('#logoutCopyBtn').click();
    await host.locator('#logoutError').waitFor();
    assert.match(await host.locator('#logoutError').textContent(), /still logged in/);
    assert.equal(await host.evaluate(() => roomSessionReady && Boolean(getRoomAuth(roomId))), true);
    await host.locator('#logoutCancelBtn').click();

    await host.evaluate(() => {
      navigator.clipboard.writeText = () => new Promise(resolve => { window.accessKeyTestFinishCopy = resolve; });
    });
    await openLogout(host);
    await host.locator('#logoutCopyBtn').click();
    assert.equal(await host.locator('#logoutConfirmBtn').isDisabled(), true);
    await host.keyboard.press('Escape');
    await host.evaluate(async () => {
      window.accessKeyTestFinishCopy();
      await Promise.resolve();
      await Promise.resolve();
      navigator.clipboard.writeText = window.accessKeyTestWrite;
      document.execCommand = window.accessKeyTestExec;
    });
    assert.equal(await host.evaluate(() => roomSessionReady), true);
    console.log('Dialogs: four viewport widths, focus, cancellation, offline/timeout recovery and clipboard failure passed.');

    const key = await copyAndLogout(host);
    const credentials = decodeAccessKey(key);
    assert.deepEqual(Object.keys(credentials.rooms), [identity.room]);
    assert.equal(credentials.rooms[identity.room].name, identity.name);
    const legacyKey = `obg1:${identity.room}:${identity.player}:${credentials.rooms[identity.room].reconnect_token}`;
    await returning.waitForFunction(room => {
      const summary = currentRoomList.find(candidate => candidate.room_id === room);
      return summary?.players.length === 1 && summary.players[0].connected === false;
    }, identity.room);
    await openKeyEntry(returning);
    await returning.locator('#accessKeyInput').fill(encodeAccessKey({
      ...credentials, rooms: { [identity.room]: { ...credentials.rooms[identity.room], reconnect_token: 'wrong-token' } },
    }));
    await returning.locator('#playerNameForm button[type=submit]').click();
    await returning.locator('#playerNameError').waitFor();
    assert.match(await returning.locator('#playerNameError').textContent(), /Could not restore your saved seats/);
    assert.equal(await returning.evaluate(() => !playerId && !playerName && !readRoomStorage(ROOM_AUTH_KEY)), true);
    await returning.locator('#accessKeyInput').fill(encodeAccessKey({
      last_room_id: 'missing-transfer-room', rooms: { 'missing-transfer-room': credentials.rooms[identity.room] },
    }));
    await returning.locator('#playerNameForm button[type=submit]').click();
    await returning.waitForFunction(() => document.getElementById('playerNameError').textContent.includes('no longer exists'));
    await submitKey(returning, key, identity);
    assert.equal(await returning.evaluate(() => currentRoomState.players.length), 1);
    assert.equal(await returning.locator('#createRoomModal').isVisible(), false);
    assert.equal(await returning.locator('#log').textContent().then(text => text.includes(key)), false);
    console.log('Lobby: copy/logout retains the sole seat; Create Room access-key entry restores it without creating a player or room.');

    const partner = await newPage();
    await partner.locator('#joinBtn').click();
    await partner.locator('#roomIdInput').fill(identity.room);
    await partner.locator('#joinRoomForm button[type=submit]').click();
    await partner.locator('#nameInput').fill('Transfer partner');
    await partner.locator('#playerNameForm button[type=submit]').click();
    await partner.waitForFunction(() => roomSessionReady && !pendingRoomRequest);
    await partner.locator('#readyBtn').click();
    await returning.waitForFunction(() => currentRoomState.players.length === 2 && currentRoomState.players.every(player => player.ready));
    await returning.locator('#startBtn').click();
    await returning.waitForFunction(() => lastGameStatePayload?.view?.phase === 'initial_peek');
    await returning.evaluate(() => sendAction({ type: 'initial_peek', slots: [0, 1] }));
    await returning.waitForFunction(() => lastGameStatePayload.view.players.find(player => player.player_id === playerId).initial_peek_done);
    const gameView = await returning.evaluate(() => lastGameStatePayload.view);
    const gameKey = await copyAndLogout(returning);
    assert.equal(gameKey, key);
    await host.evaluate(() => { window.accessKeyTestEvents = []; });
    await openKeyEntry(host, identity.room);
    await submitKey(host, gameKey, identity);
    await host.waitForFunction(() => lastGameStatePayload?.view?.players.some(player => player.player_id === playerId && player.initial_peek_done));
    assert.deepEqual(await host.evaluate(() => lastGameStatePayload.view), gameView);
    assert.equal(await host.evaluate(() => currentRoomState.players.length), 2);
    await host.reload();
    await host.waitForFunction(expected => roomSessionReady && playerId === expected.player && roomId === expected.room, identity);
    assert.deepEqual(await host.evaluate(() => lastGameStatePayload.view), gameView);
    console.log('In-game: Join Room access-key entry restores the same player, seat, hand knowledge and game state; reload still reconnects.');

    await openKeyEntry(returning);
    await submitKey(returning, legacyKey, identity);
    await returning.waitForFunction(() => lastGameStatePayload?.view?.players.some(player => player.player_id === playerId && player.initial_peek_done));
    assert.deepEqual(await returning.evaluate(() => lastGameStatePayload.view), gameView);
    await copyAndLogout(returning);
    await switchSavedRoom(host, identity);

    const secondIdentity = await createAnotherRoom(host);
    await host.locator('#addBotBtn').click();
    await host.waitForFunction(() => !pendingRoomRequest && currentRoomState.players.length === 2);
    await host.locator('#startBtn').click();
    await host.waitForFunction(expected => currentRoomState?.status === 'in_game'
      && lastGameStatePayload?.room_id === expected.room && lastGameStatePayload.view.phase === 'initial_peek', secondIdentity);
    const thirdIdentity = await createAnotherRoom(host);
    const allIdentities = [identity, secondIdentity, thirdIdentity];
    const expectedRooms = allIdentities.map(player => player.room).sort();
    const multiRoomKey = await copyAndLogout(host);
    const multiRoomCredentials = decodeAccessKey(multiRoomKey);
    assert.deepEqual(Object.keys(multiRoomCredentials.rooms).sort(), expectedRooms);
    assert.equal(multiRoomCredentials.last_room_id, thirdIdentity.room);
    await openKeyEntry(returning, identity.room);
    await submitKey(returning, multiRoomKey, identity);
    assert.deepEqual(await returning.evaluate(() => Object.keys(loadRoomAuthMap()).sort()), expectedRooms);
    for (const savedIdentity of allIdentities) {
      assert.equal(await returning.locator(`[data-room-id="${savedIdentity.room}"] .room-reconnect-btn`).count(), 1);
    }
    await switchSavedRoom(returning, thirdIdentity, true);
    await returning.locator('#readyBtn').click();
    await returning.waitForFunction(() => !pendingRoomRequest && !currentRoomState.players[0].ready);
    await switchSavedRoom(returning, secondIdentity);
    await openControls(returning);
    await returning.locator(`[data-room-id="${thirdIdentity.room}"]`).getByRole('button', { name: 'Join Ready', exact: true }).click();
    await returning.waitForFunction(expected => roomSessionReady && !pendingRoomRequest
      && roomId === expected.room && currentRoomState.players[0].ready, thirdIdentity);
    assert.deepEqual(await getIdentity(returning), thirdIdentity);
    assert.equal(await returning.evaluate(() => currentRoomState.players.length), 1);
    await switchSavedRoom(returning, identity);
    await returning.waitForFunction(expected => lastGameStatePayload?.room_id === expected.room, identity);
    assert.deepEqual(await returning.evaluate(() => lastGameStatePayload.view), gameView);
    await returning.reload();
    await returning.waitForFunction(expected => roomSessionReady && playerId === expected.player && roomId === expected.room, identity);
    assert.deepEqual(await returning.evaluate(() => Object.keys(loadRoomAuthMap()).sort()), expectedRooms);
    await switchSavedRoom(returning, thirdIdentity);
    const staleLatestKey = await copyAndLogout(returning);
    await partner.waitForFunction(target => currentRoomList.find(room => room.room_id === target)?.players.every(player => !player.connected), thirdIdentity.room);
    await partner.evaluate(target => socket.emit('room:delete', { room_id: target }), thirdIdentity.room);
    await partner.waitForFunction(target => !currentRoomList.some(room => room.room_id === target), thirdIdentity.room);
    const fresh = await newPage();
    await openKeyEntry(fresh);
    const fallbackRoomId = Object.keys(decodeAccessKey(staleLatestKey).rooms).reverse().find(room => room !== thirdIdentity.room);
    const fallbackIdentity = allIdentities.find(player => player.room === fallbackRoomId);
    await submitKey(fresh, staleLatestKey, fallbackIdentity);
    assert.deepEqual(await fresh.evaluate(() => Object.keys(loadRoomAuthMap()).sort()), [identity.room, secondIdentity.room].sort());
    await switchSavedRoom(fresh, identity);
    await fresh.waitForFunction(expected => lastGameStatePayload?.room_id === expected.room, identity);
    assert.deepEqual(await fresh.evaluate(() => lastGameStatePayload.view), gameView);
    await fresh.evaluate(auth => {
      setRoomAuth('unavailable-saved-room', auth);
      attemptJoinRoom('unavailable-saved-room');
    }, credentials.rooms[identity.room]);
    await fresh.waitForFunction(() => !pendingRoomRequest && !getRoomAuth('unavailable-saved-room'));
    assert.equal(await fresh.evaluate(() => roomSessionReady), true);
    assert.deepEqual(await getIdentity(fresh), identity);
    assert.deepEqual(await fresh.evaluate(() => lastGameStatePayload.view), gameView);
    console.log('Multiple rooms: one key restores every seat; requested-room selection, switching lobbies, reload, legacy keys and an expired latest room passed.');

    const malformedPayloads = [
      { rooms: {}, last_room_id: identity.room },
      { rooms: [], last_room_id: identity.room },
      { rooms: credentials.rooms, last_room_id: 'not-in-key' },
      { rooms: { [identity.room]: { ...credentials.rooms[identity.room], name: 123 } }, last_room_id: identity.room },
      { rooms: { [identity.room]: { ...credentials.rooms[identity.room], reconnect_token: '../invalid' } }, last_room_id: identity.room },
      { rooms: Object.fromEntries([['__proto__', credentials.rooms[identity.room]]]), last_room_id: '__proto__' },
    ];
    for (const malformed of malformedPayloads) {
      assert.equal(await fresh.evaluate(value => parsePlayerAccessKey(value), encodeAccessKey(malformed)), null);
    }
    assert.equal(await fresh.evaluate(() => parsePlayerAccessKey('obg2:!invalid')), null);
    assert.equal(await fresh.evaluate(() => parsePlayerAccessKey('x'.repeat(PLAYER_ACCESS_KEY_MAX_LENGTH + 1))), null);
    const manyRooms = Object.fromEntries(Array.from({ length: 40 }, (_, index) => [`saved-room-${index}`, credentials.rooms[identity.room]]));
    const longKey = encodeAccessKey({ rooms: manyRooms, last_room_id: 'saved-room-0' });
    assert(longKey.length > 2048);
    assert.equal(await fresh.evaluate(value => Object.keys(parsePlayerAccessKey(value).rooms).length, longKey), 40);
    await openKeyEntry(returning);
    await returning.locator('#accessKeyInput').fill(longKey);
    assert.equal((await returning.locator('#accessKeyInput').inputValue()).length, longKey.length);
    await assertModalFits(returning, '#playerNameModal');
    await returning.keyboard.press('Escape');
    console.log('Key validation: Unicode names, long multi-room keys, malformed data, reserved keys and oversized input passed.');

    const plain = await newPage();
    await openLogout(plain);
    assert.equal(await plain.locator('#logoutCopyBtn').isDisabled(), true);
    await plain.locator('#logoutConfirmBtn').click();
    await plain.locator('#createBtn').click();
    await plain.locator('#nameInput').fill('Plain logout');
    await plain.locator('#playerNameForm button[type=submit]').click();
    await plain.locator('#gameSearchInput').fill('cabo');
    await plain.locator('[data-game-id="cabo"]').click();
    await plain.waitForFunction(() => roomSessionReady && !pendingRoomRequest);
    const plainRoom = await plain.evaluate(() => roomId);
    await openLogout(plain);
    await plain.locator('#logoutConfirmBtn').click();
    await plain.waitForFunction(previousRoom => !roomId && !currentRoomList.some(room => room.room_id === previousRoom), plainRoom);
    assert.equal(await plain.evaluate(() => readRoomStorage(ROOM_AUTH_KEY)), null);

    await plain.evaluate(() => {
      Storage.prototype.setItem = () => { throw new DOMException('Unavailable', 'QuotaExceededError'); };
      navigator.clipboard.writeText = async () => { throw new Error('Clipboard API unavailable'); };
    });
    await plain.locator('#createBtn').click();
    await plain.locator('#nameInput').fill('Clipboard fallback');
    await plain.locator('#playerNameForm button[type=submit]').click();
    await plain.locator('#gameSearchInput').fill('cabo');
    await plain.locator('[data-game-id="cabo"]').click();
    await plain.waitForFunction(() => roomSessionReady && !pendingRoomRequest);
    const fallbackRoom = await plain.evaluate(() => roomId);
    const fallbackKey = await copyAndLogout(plain);
    assert.equal(decodeAccessKey(fallbackKey).last_room_id, fallbackRoom);
    console.log('Clipboard fallback and unavailable browser storage still allow copying the existing reconnect credentials.');
    console.log('Regular username entry and Confirm logout retain their original behavior; no account or access-key storage added.');
    assert.deepEqual(errors, []);
    console.log('All room access-key browser regressions passed.');
  } finally {
    await Promise.all(contexts.map(context => context.close()));
    await browser.close();
  }
})().catch(error => { console.error(error); process.exit(1); });
