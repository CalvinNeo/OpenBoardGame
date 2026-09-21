// Run against a local `uvicorn app:app --port 8765` with Playwright installed.
// PLAYWRIGHT_MODULE can point to an existing Playwright installation.
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const base = process.env.ROOM_TEST_URL || 'http://127.0.0.1:8765';
const viewport = { width: 393, height: 852 };

(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const errors = [];
  const contexts = [];
  async function newPage(setup) {
    const context = await browser.newContext({ viewport, isMobile: true, hasTouch: true });
    contexts.push(context);
    const page = await context.newPage();
    page.on('pageerror', error => errors.push(error.message));
    if (setup) await setup(page);
    await page.goto(base);
    await page.waitForFunction(() => typeof socket !== 'undefined' && socket.connected);
    return page;
  }
  async function create(page, game) {
    await page.locator('#createBtn').click();
    if (await page.locator('#playerNameModal').isVisible()) {
      await page.locator('#nameInput').fill('Mobile regression');
      await page.locator('#playerNameForm button[type=submit]').click();
    }
    await page.locator('#gameSearchInput').fill(game);
    await page.locator(`[data-game-id="${game}"]`).click();
    await page.waitForFunction(id => roomSessionReady && currentGameType === id && !pendingRoomRequest, game);
  }
  async function addBots(page, count) {
    for (let i = 0; i < count; i++) {
      await page.locator('#addBotBtn').click();
      await page.waitForFunction(() => !pendingRoomRequest);
    }
  }
  try {
    const page = await newPage();
    const bytes = await page.evaluate(() => {
      const resources = performance.getEntriesByType('resource').filter(entry => /\/static\//.test(entry.name));
      return resources.reduce((sum, entry) => ({ encoded: sum.encoded + entry.encodedBodySize, decoded: sum.decoded + entry.decodedBodySize }), {encoded: 0, decoded: 0});
    });
    assert(bytes.encoded < bytes.decoded / 2, JSON.stringify(bytes));
    console.log('Compressed static bytes:', bytes);
    await create(page, 'citadels');
    assert.equal(await page.locator('#startBtn').isDisabled(), true);
    assert.match(await page.locator('#roomActionStatus').textContent(), /at least 2 players/);
    await addBots(page, 3);
    const room = await page.evaluate(() => roomId);
    await page.context().setOffline(true);
    await page.waitForFunction(() => !socket.connected);
    assert.equal(await page.locator('#addBotBtn').isDisabled(), true);
    assert.equal(await page.locator('#startBtn').isDisabled(), true);
    await page.evaluate(() => document.getElementById('addBotBtn').click());
    await page.context().setOffline(false);
    await page.waitForFunction(() => socket.connected && roomSessionReady && !pendingRoomRequest);
    assert.equal(await page.evaluate(() => roomId), room);
    assert.equal(await page.evaluate(() => currentRoomState.players.length), 4);
    await page.reload();
    await page.waitForFunction(() => roomSessionReady && !pendingRoomRequest);
    assert.equal(await page.evaluate(() => roomId), room);
    await page.locator('#startBtn').click();
    await page.waitForFunction(() => currentRoomState.status === 'in_game' && lastGameStatePayload?.game_type === 'citadels');
    assert.equal(await page.locator('#citadelsPanel').isVisible(), true);
    assert.equal(await page.locator('#downloadMemoriesBtn').isDisabled(), true);
    for (const width of [320, 393, 1280]) {
      await page.setViewportSize({width, height: 852});
      await page.evaluate(() => setRoomControlsCollapsed(false));
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    }
    fs.mkdirSync('tmp/room-controls-ui', { recursive: true });
    await page.setViewportSize(viewport);
    await page.locator('#roomPanel').screenshot({ path: 'tmp/room-controls-ui/fixed-room-mobile.png' });
    console.log('Citadels: create, 3 bots, offline recovery, reload recovery, start, mobile layout passed.');

    // Expired saves and HTML fallback responses must never navigate or download.
    const originalUrl = page.url();
    const downloads = [];
    page.on('download', download => downloads.push(download.suggestedFilename()));
    await page.evaluate(() => downloadSaveFile('missing-file'));
    assert.match(await page.locator('#roomActionStatus').textContent(), /Download failed/);
    await page.route('**/api/room/save?*', route => route.fulfill({status: 200, contentType: 'text/html', body: '<!doctype html><html>Home</html>'}));
    await page.evaluate(() => downloadSaveFile('missing-file'));
    assert.match(await page.locator('#roomActionStatus').textContent(), /did not return a download file/);
    assert.equal(page.url(), originalUrl);
    assert.deepEqual(downloads, []);
    await page.unroute('**/api/room/save?*');
    await page.route('**/api/room/save?*', route => route.fulfill({status: 200, contentType: 'application/json', headers: {'Content-Disposition': 'attachment; filename=document.json'}, body: '<!doctype html><html>Home</html>'}));
    await page.evaluate(() => downloadSaveFile('test'));
    assert.match(await page.locator('#roomActionStatus').textContent(), /valid JSON save/);
    assert.deepEqual(downloads, []);
    await page.unroute('**/api/room/save?*');
    await page.route('**/api/room/save?*', route => route.fulfill({status: 200, contentType: 'application/json', headers: {'Content-Disposition': 'attachment; filename=room.json'}, body: '{"room_id":"test"}'}));
    const saved = page.waitForEvent('download');
    await page.evaluate(() => downloadSaveFile('test'));
    assert.equal((await saved).suggestedFilename(), 'room.json');
    assert.equal(page.url(), originalUrl);
    console.log('Downloads: 404 and HTML rejected; JSON download preserves the game page.');

    let attempts = 0;
    const picker = await newPage(async p => {
      await p.route('**/api/games', route => {
        attempts++;
        return attempts === 1 ? route.fulfill({status: 503, contentType: 'application/json', body: '{}'}) : route.continue();
      });
    });
    await picker.locator('#createBtn').click();
    await picker.locator('#nameInput').fill('Retry regression');
    await picker.locator('#playerNameForm button[type=submit]').click();
    if (await picker.locator('#gameListRetryBtn').isVisible()) await picker.locator('#gameListRetryBtn').click();
    await picker.locator('[data-game-id=citadels]').waitFor();
    assert.equal(attempts, 2);
    await picker.locator('#gameSearchInput').fill('Citadels');
    assert.equal(attempts, 2);
    console.log('Game list: recovers from failed request; filters reuse one cached response.');

    const privatePage = await newPage(p => p.addInitScript(() => {
      Storage.prototype.setItem = () => { throw new DOMException('Unavailable', 'QuotaExceededError'); };
    }));
    await create(privatePage, 'citadels');
    await addBots(privatePage, 1);
    await privatePage.locator('#startBtn').click();
    await privatePage.waitForFunction(() => currentRoomState.status === 'in_game');
    console.log('Unavailable browser storage does not break room creation or starting.');

    const decryptoPage = await newPage();
    await create(decryptoPage, 'decrypto');
    await addBots(decryptoPage, 3);
    await decryptoPage.waitForFunction(() => decryptoPacksLoaded && decryptoBotStrategiesLoaded);
    await decryptoPage.locator('#startBtn').click();
    await decryptoPage.waitForFunction(() => currentDecryptoView?.legal_actions.includes('submit_clues'));
    for (let i = 1; i <= 3; i++) await decryptoPage.locator(`#decryptoClue${i}`).fill(`clue ${i}`);
    await decryptoPage.locator('#decryptoSubmitCluesBtn').click();
    await decryptoPage.waitForFunction(() => currentDecryptoView?.round > 1, null, {timeout: 30000});
    const began = Date.now();
    assert.equal((await decryptoPage.request.get(`${base}/api/games`)).status(), 200);
    assert(Date.now() - began < 2000);
    await decryptoPage.reload();
    await decryptoPage.waitForFunction(() => roomSessionReady && currentDecryptoView?.round > 1);
    console.log('Decrypto: 3 bots and submitted clues resolve; server and reload remain responsive.');
    assert.deepEqual(errors, []);
    console.log('All room browser regressions passed.');
  } finally {
    await Promise.all(contexts.map(context => context.close()));
    await browser.close();
  }
})().catch(error => { console.error(error); process.exit(1); });
