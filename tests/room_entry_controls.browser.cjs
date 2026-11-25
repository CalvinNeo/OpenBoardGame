const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const base = process.env.ROOM_TEST_URL || 'http://127.0.0.1:8766';
const output = 'build/room-entry-controls';

(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const contexts = [];
  const errors = [];
  const createdRooms = [];
  fs.mkdirSync(output, { recursive: true });

  async function newPage(name) {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true });
    contexts.push(context);
    await context.addInitScript(value => localStorage.setItem('openboardgame:name', value), name);
    const page = await context.newPage();
    page.on('pageerror', error => errors.push(error.message));
    await page.route('https://fonts.googleapis.com/**', route => route.abort());
    await page.goto(base);
    await page.waitForFunction(() => typeof socket !== 'undefined' && socket.connected && cachedGameList);
    await page.evaluate(() => {
      window.roomEntryRequests = [];
      socket.onAnyOutgoing((event, data) => {
        if (['room:leave', 'room:ready', 'room:join', 'room:reconnect'].includes(event)) {
          window.roomEntryRequests.push({ event, ...data });
        }
      });
    });
    return page;
  }

  async function openControls(page) {
    await page.evaluate(() => setRoomControlsCollapsed(false));
    await page.locator('#roomControlsBody').evaluate(element => Promise.all(element.getAnimations().map(animation => animation.finished)));
  }

  async function waitRoom(page, target) {
    await page.waitForFunction(expected => roomSessionReady && !pendingRoomRequest && roomId === expected
      && currentRoomState?.room_id === expected, target);
  }

  async function createRoom(page) {
    await openControls(page);
    await page.locator('#createBtn').click();
    await page.locator('#gameSearchInput').fill('cabo');
    const previous = await page.evaluate(() => roomId);
    await page.locator('[data-game-id="cabo"]').click();
    await page.waitForFunction(before => roomSessionReady && !pendingRoomRequest && roomId !== before, previous);
    const target = await page.evaluate(() => roomId);
    createdRooms.push(target);
    return target;
  }

  async function enterRoom(page, target) {
    await openControls(page);
    await page.locator(`[data-room-id="${target}"]`).getByRole('button', { name: 'Enter', exact: true }).click();
    await waitRoom(page, target);
  }

  async function waitReady(page, ready) {
    await page.waitForFunction(expected => !pendingRoomRequest
      && currentRoomState.players.find(player => player.player_id === playerId)?.ready === expected, ready);
  }

  async function leaveCount(page) {
    return page.evaluate(() => window.roomEntryRequests.filter(request => request.event === 'room:leave').length);
  }

  async function checkRememberedPreference(page, checked) {
    assert.equal(await page.evaluate(() => localStorage.getItem(AUTO_READY_KEY)), checked.toString());
    const reopened = await page.context().newPage();
    try {
      await reopened.route('https://fonts.googleapis.com/**', route => route.abort());
      await reopened.goto(base);
      await reopened.waitForFunction(() => typeof socket !== 'undefined' && socket.connected && cachedGameList);
      assert.equal(await reopened.locator('#autoReadyToggle').isChecked(), checked);
    } finally {
      await reopened.close();
    }
  }

  try {
    const host = await newPage('Entry controls host');
    const firstRoom = await createRoom(host);
    const secondHost = await newPage('Entry controls second host');
    const secondRoom = await createRoom(secondHost);
    const guest = await newPage('Entry controls guest');
    assert.equal(await guest.locator('#autoReadyToggle').isChecked(), true);
    await guest.locator('#autoReadyToggle').uncheck();
    await checkRememberedPreference(guest, false);
    await guest.reload();
    await guest.waitForFunction(() => typeof socket !== 'undefined' && socket.connected && cachedGameList);
    assert.equal(await guest.locator('#autoReadyToggle').isChecked(), false);
    await enterRoom(guest, firstRoom);
    await waitReady(guest, false);
    await guest.locator('#autoReadyToggle').check();
    await waitReady(guest, false);
    await enterRoom(guest, firstRoom);
    await waitReady(guest, true);
    await guest.locator('#autoReadyToggle').uncheck();
    await waitReady(guest, true);
    await guest.locator('#readyBtn').click();
    await waitReady(guest, false);
    const savedSeat = await newPage('Entry controls guest');
    await savedSeat.locator('#autoReadyToggle').uncheck();
    await enterRoom(savedSeat, secondRoom);
    const secondAuth = await savedSeat.evaluate(target => getRoomAuth(target), secondRoom);
    await guest.evaluate(({ target, auth }) => setRoomAuth(target, auth), { target: secondRoom, auth: secondAuth });
    await enterRoom(guest, secondRoom);
    await waitReady(guest, false);
    await guest.locator('#autoReadyToggle').check();
    await checkRememberedPreference(guest, true);
    await enterRoom(guest, firstRoom);
    await waitReady(guest, true);
    await guest.locator('#readyBtn').click();
    await waitReady(guest, false);
    await guest.reload();
    await waitRoom(guest, firstRoom);
    await guest.evaluate(() => {
      window.roomEntryRequests = [];
      socket.onAnyOutgoing((event, data) => window.roomEntryRequests.push({ event, ...data }));
    });
    assert.equal(await guest.locator('#autoReadyToggle').isChecked(), true);
    await waitReady(guest, false);
    await openControls(guest);
    await guest.locator('#joinBtn').click();
    await guest.locator('#roomIdInput').fill(secondRoom);
    await guest.locator('#joinRoomForm button[type=submit]').click();
    await waitRoom(guest, secondRoom);
    await waitReady(guest, true);

    const newcomer = await newPage('Auto ready new guest');
    assert.equal(await newcomer.locator('#autoReadyToggle').isChecked(), true);
    await enterRoom(newcomer, secondRoom);
    await waitReady(newcomer, true);
    console.log('Enter: default auto ready, remembered on/off across reload and reopened pages, join, reconnect, room ID and preserved manual readiness passed.');

    const beforeLeave = await leaveCount(guest);
    await guest.locator('#leaveBtn').click();
    assert.equal(await guest.locator('#leaveConfirmModal').isVisible(), true);
    assert.equal(await leaveCount(guest), beforeLeave);
    assert.equal(await guest.locator('#leaveConfirmCancelBtn').evaluate(element => element === document.activeElement), true);
    await guest.keyboard.press('Tab');
    assert.equal(await guest.locator('#leaveConfirmBtn').evaluate(element => element === document.activeElement), true);
    await guest.keyboard.press('Tab');
    assert.equal(await guest.locator('#leaveConfirmCancelBtn').evaluate(element => element === document.activeElement), true);
    await guest.keyboard.press('Shift+Tab');
    assert.equal(await guest.locator('#leaveConfirmBtn').evaluate(element => element === document.activeElement), true);
    await guest.keyboard.press('Escape');
    assert.equal(await guest.locator('#leaveConfirmModal').isVisible(), false);
    assert.equal(await guest.locator('#leaveBtn').evaluate(element => element === document.activeElement), true);
    await guest.locator('#leaveBtn').click();
    await guest.locator('#leaveConfirmCancelBtn').click();
    await guest.locator('#leaveBtn').click();
    await guest.locator('#leaveConfirmModal').click({ position: { x: 3, y: 3 } });
    assert.equal(await leaveCount(guest), beforeLeave);
    assert.equal(await guest.evaluate(() => roomId), secondRoom);

    await guest.locator('#readyBtn').click();
    await waitReady(guest, false);
    await guest.locator('#leaveBtn').click();
    await guest.evaluate(target => attemptJoinRoom(target), firstRoom);
    await waitRoom(guest, firstRoom);
    await guest.locator('#leaveConfirmBtn').click();
    assert.equal(await leaveCount(guest), beforeLeave);
    assert.equal(await guest.evaluate(() => roomId), firstRoom);

    for (const width of [320, 390, 1024, 1440]) {
      await guest.setViewportSize({ width, height: 900 });
      await openControls(guest);
      const geometry = await guest.evaluate(() => {
        const bounds = element => {
          const rect = element.getBoundingClientRect();
          return { left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom, width: rect.width };
        };
        const panel = document.getElementById('roomControlsPanel');
        const heading = document.querySelector('.room-list-heading h3');
        const checkbox = document.querySelector('.room-auto-ready');
        const controls = [...document.querySelectorAll('#roomListPanel > .panel-header button, .room-auto-ready, #roomPanel > .panel-header button, #autoSaveRow')]
          .filter(element => element.getClientRects().length);
        const rects = controls.map(bounds);
        return {
          pageOverflow: document.documentElement.scrollWidth > innerWidth,
          bodyOverflow: document.getElementById('roomControlsBody').scrollWidth > document.getElementById('roomControlsBody').clientWidth,
          overlapping: rects.some((rect, index) => rects.slice(index + 1).some(other => Math.min(rect.right, other.right) - Math.max(rect.left, other.left) > 1
            && Math.min(rect.bottom, other.bottom) - Math.max(rect.top, other.top) > 1)),
          outside: rects.some(rect => rect.left < bounds(panel).left || rect.right > bounds(panel).right),
          checkboxInline: Math.abs(bounds(heading).top - bounds(checkbox).top) < 8 && bounds(checkbox).left > bounds(heading).right,
          startWidth: bounds(document.getElementById('startBtn')).width,
          readyWidth: bounds(document.getElementById('readyBtn')).width,
        };
      });
      assert.equal(geometry.pageOverflow, false, `${width}px page overflow`);
      assert.equal(geometry.bodyOverflow, false, `${width}px controls overflow`);
      assert.equal(geometry.overlapping, false, `${width}px overlapping controls`);
      assert.equal(geometry.outside, false, `${width}px controls outside panel`);
      assert.equal(geometry.checkboxInline, true, `${width}px checkbox not next to Rooms`);
      assert(geometry.startWidth >= geometry.readyWidth * 2, `${width}px Start not widened`);
      assert.equal(await guest.getByRole('button', { name: 'Join Ready', exact: true }).count(), 0);
      assert.equal(await guest.locator('.room-reconnect-btn').count(), 0);
      await guest.screenshot({ path: `${output}/controls-${width}.png`, animations: 'disabled' });
      await guest.locator('#leaveBtn').click();
      const modalGeometry = await guest.locator('.leave-confirm-modal').boundingBox();
      assert(modalGeometry.x >= 0 && modalGeometry.x + modalGeometry.width <= width, `${width}px confirmation overflow`);
      await guest.screenshot({ path: `${output}/leave-${width}.png`, animations: 'disabled' });
      await guest.keyboard.press('Escape');
      console.log(`Room entry controls and confirmation: ${width}px passed.`);
    }

    await guest.locator('#leaveBtn').click();
    await guest.locator('#leaveConfirmBtn').click();
    await guest.waitForFunction(() => roomId === null && currentRoomState === null);
    assert.equal(await leaveCount(guest), beforeLeave + 1);
    assert.equal(await guest.locator('#leaveConfirmModal').isVisible(), false);
    assert.equal(await guest.evaluate(() => readRoomStorage(LAST_ROOM_ID_KEY)), null);
    assert.equal(await guest.locator('#createBtn').evaluate(element => element === document.activeElement), true);
    assert.deepEqual(errors, []);
    console.log('Leave Room: Cancel, backdrop, Escape, focus trap, changed-room guard and confirmed leave passed.');
  } finally {
    for (const context of contexts) {
      for (const page of context.pages()) {
        await page.evaluate(() => { if (socket.connected) socket.emit('room:leave', {}); }).catch(() => {});
      }
    }
    await Promise.all(contexts.map(context => context.close()));
    const cleanup = await browser.newPage();
    await cleanup.goto(base);
    await cleanup.waitForFunction(() => typeof socket !== 'undefined' && socket.connected);
    await cleanup.evaluate(targets => targets.forEach(room_id => socket.emit('room:delete', { room_id })), createdRooms);
    await browser.close();
  }
})().catch(error => { console.error(error); process.exit(1); });
