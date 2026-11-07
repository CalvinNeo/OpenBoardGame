const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const base = process.env.ROOM_TEST_URL || 'http://127.0.0.1:8778';
const output = 'build/room-logout';

(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const contexts = [];
  const errors = [];
  fs.mkdirSync(output, { recursive: true });

  async function openControls(page) {
    if (await page.locator('#roomControlsPanel').evaluate(element => element.classList.contains('collapsed'))) {
      await page.locator('#roomControlsToggleBtn').click();
    }
  }

  async function newPage(context = null) {
    if (!context) {
      context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
      contexts.push(context);
    }
    const page = await context.newPage();
    page.on('pageerror', error => errors.push(error.message));
    await page.route('https://fonts.googleapis.com/**', route => route.abort());
    await page.goto(base);
    await page.waitForFunction(() => socket.connected && cachedGameList);
    await openControls(page);
    return page;
  }

  async function createRoom(page, name) {
    await openControls(page);
    await page.locator('#createBtn').click();
    await page.locator('#nameInput').fill(name);
    await page.locator('#playerNameForm button[type=submit]').click();
    await page.locator('#gameSearchInput').fill('cabo');
    await page.locator('[data-game-id="cabo"]').click();
    await page.waitForFunction(() => roomSessionReady && !pendingRoomRequest);
    return page.evaluate(() => ({ room: roomId, player: playerId, sid: socket.id }));
  }

  async function openLogout(page) {
    await page.locator('#settingsBtn').click();
    await page.locator('#logoutBtn').click();
  }

  async function waitLoggedOut(page) {
    await page.waitForFunction(() => socket.connected && !pendingLogoutRequest && !roomId && !playerId && !playerName);
    assert.deepEqual(await page.evaluate(() => [ROOM_AUTH_KEY, NAME_STORAGE_KEY, LAST_ROOM_ID_KEY]
      .map(key => readRoomStorage(key))), [null, null, null]);
    assert.equal(await page.locator('#connectionInfo').textContent(), 'logged out');
  }

  async function assertModalFits(page) {
    assert.deepEqual(await page.locator('#logoutModal').evaluate(modal => {
      const content = modal.querySelector('.modal-content');
      const bounds = content.getBoundingClientRect();
      return {
        inside: bounds.left >= 0 && bounds.right <= innerWidth && bounds.top >= 0 && bounds.bottom <= innerHeight,
        pageOverflow: document.documentElement.scrollWidth > innerWidth,
        overflowing: [...content.querySelectorAll('*')].filter(element => element.getClientRects().length
          && element.scrollWidth > element.clientWidth + 1).map(element => element.id || element.className),
      };
    }), { inside: true, pageOverflow: false, overflowing: [] });
  }

  try {
    const page = await newPage();
    const identity = await createRoom(page, 'Logout regression');
    await page.reload();
    await page.waitForFunction(() => roomSessionReady && !pendingRoomRequest);
    assert.equal(await page.evaluate(() => roomId), identity.room);
    await page.evaluate(() => {
      window.logoutTestEmit = socket.emit;
      socket.emit = function (event, ...args) {
        if (event === 'room:logout') {
          window.logoutTestCallback = args.at(-1);
          window.logoutTestPayload = args[0];
          return this;
        }
        return window.logoutTestEmit.call(this, event, ...args);
      };
    });
    await openLogout(page);
    await page.locator('#logoutConfirmBtn').click();
    assert.equal(await page.evaluate(() => roomId), identity.room);
    assert.notEqual(await page.evaluate(() => readRoomStorage(ROOM_AUTH_KEY)), null);
    assert.equal(await page.locator('#connectionInfo').textContent(), 'Logging out...');
    assert.equal(await page.locator('#logoutCancelBtn').isDisabled(), true);
    for (const width of [320, 390, 1024, 1440]) {
      await page.setViewportSize({ width, height: width < 500 ? 844 : 900 });
      await assertModalFits(page);
      await page.screenshot({ path: `${output}/pending-${width}.png` });
    }
    await page.keyboard.press('Escape');
    assert.equal(await page.locator('#logoutModal').isVisible(), true);
    await page.evaluate(() => window.logoutTestCallback(new Error('simulated acknowledgement timeout')));
    await page.waitForFunction(() => socket.connected && !pendingLogoutRequest);
    assert.match(await page.locator('#logoutError').textContent(), /not confirmed/);
    assert.notEqual(await page.evaluate(() => readRoomStorage(ROOM_AUTH_KEY)), null);
    for (const width of [320, 390, 1024, 1440]) {
      await page.setViewportSize({ width, height: width < 500 ? 844 : 900 });
      await assertModalFits(page);
      await page.screenshot({ path: `${output}/timeout-${width}.png` });
    }
    await page.evaluate(() => { socket.emit = window.logoutTestEmit; });
    const beforeLogoutSid = await page.evaluate(() => socket.id);
    await page.locator('#logoutConfirmBtn').click();
    await waitLoggedOut(page);
    assert.notEqual(await page.evaluate(() => socket.id), beforeLogoutSid);
    await page.waitForFunction(room => !currentRoomList.some(entry => entry.room_id === room), identity.room);
    await page.reload();
    await page.waitForFunction(() => socket.connected && cachedGameList);
    assert.equal(await page.evaluate(() => roomId), null);
    console.log('Refresh, delayed acknowledgement, timeout/retry, and anonymous reconnect passed at 320/390/1024/1440px.');

    const missingStateIdentity = await createRoom(page, 'Missing room state');
    await page.evaluate(() => {
      window.logoutLateIdentity = { room_id: roomId, player_id: playerId,
        reconnect_token: getRoomAuth(roomId).reconnect_token, name: playerName };
      window.logoutLateRoomState = currentRoomState;
      resetRoomState();
    });
    assert.equal(await page.evaluate(() => roomId), null);
    await openLogout(page);
    await page.locator('#logoutConfirmBtn').click();
    await waitLoggedOut(page);
    await page.waitForFunction(room => !currentRoomList.some(entry => entry.room_id === room), missingStateIdentity.room);
    await page.evaluate(() => {
      for (const listener of socket.listeners('system:info')) listener(window.logoutLateIdentity);
      for (const listener of socket.listeners('room:state')) listener(window.logoutLateRoomState);
    });
    await waitLoggedOut(page);
    assert.equal(await page.evaluate(() => currentRoomState), null);
    console.log('Missing UI room state still logs out the server session; late identity and room messages cannot restore it.');

    const sharedIdentity = await createRoom(page, 'Shared logout');
    const secondTab = await newPage(page.context());
    await secondTab.waitForFunction(() => roomSessionReady && !pendingRoomRequest);
    const activeSid = await secondTab.evaluate(() => socket.id);
    await openLogout(page);
    await page.locator('#logoutConfirmBtn').click();
    await Promise.all([waitLoggedOut(page), waitLoggedOut(secondTab)]);
    assert.notEqual(await secondTab.evaluate(() => socket.id), activeSid);
    await secondTab.waitForFunction(room => !currentRoomList.some(entry => entry.room_id === room), sharedIdentity.room);
    console.log('Logout from a replaced tab clears the active authenticated connection and both tabs.');

    const gameIdentity = await createRoom(page, 'In-game logout');
    await page.locator('#addBotBtn').click();
    await page.waitForFunction(() => !pendingRoomRequest);
    await page.locator('#startBtn').click();
    await page.waitForFunction(() => currentRoomState?.status === 'in_game' && !pendingRoomRequest);
    await page.reload();
    await page.waitForFunction(() => roomSessionReady && !pendingRoomRequest);
    await openLogout(page);
    await page.locator('#logoutConfirmBtn').click();
    await waitLoggedOut(page);
    await page.waitForFunction(room => currentRoomList.find(entry => entry.room_id === room)?.players
      .some(player => player.name === 'In-game logout' && !player.connected), gameIdentity.room);
    const cleared = await page.evaluate(() => ({ roomId, playerId, lastGameStatePayload, auth: readRoomStorage(ROOM_AUTH_KEY) }));
    assert.deepEqual(cleared, { roomId: null, playerId: null, lastGameStatePayload: null, auth: null });
    console.log('In-game logout keeps the seat offline and clears identity without restoring it after refresh.');
    assert.deepEqual(errors, []);
    console.log('All logout browser regressions passed.');
  } finally {
    await Promise.all(contexts.map(context => context.close()));
    await browser.close();
  }
})().catch(error => { console.error(error); process.exit(1); });
