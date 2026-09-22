// Run with a local server; PLAYWRIGHT_MODULE may point to an existing installation.
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const base = process.env.ROOM_TEST_URL || 'http://127.0.0.1:8766';

(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const contexts = [];
  const errors = [];
  async function newPage(setup) {
    const context = await browser.newContext({ viewport: { width: 393, height: 852 } });
    contexts.push(context);
    const page = await context.newPage();
    page.on('pageerror', error => errors.push(error.message));
    await page.route('https://fonts.googleapis.com/**', route => route.abort());
    if (setup) await setup(page);
    await page.goto(base);
    await page.waitForFunction(() => typeof socket !== 'undefined' && socket.connected && cachedGameList);
    return page;
  }
  async function create(page, game) {
    await page.evaluate(game => socket.emit('room:create', {name: 'Lazy assets QA', game_type: game}), game);
    await page.waitForFunction(game => roomSessionReady && currentGameType === game, game);
  }
  async function ready(page, game) {
    await page.waitForFunction(game => isGameAssetsLoaded(game), game);
    await page.waitForFunction(() => !document.getElementById('gameAssetsStatus').offsetHeight);
  }
  try {
    const page = await newPage();
    const initial = await page.evaluate(() => {
      const resources = [performance.getEntriesByType('navigation')[0], ...performance.getEntriesByType('resource')]
        .filter(entry => entry.name.startsWith(location.origin) && !entry.name.includes('/socket.io/'));
      return {count: resources.length, encoded: resources.reduce((n, e) => n + e.encodedBodySize, 0), decoded: resources.reduce((n, e) => n + e.decodedBodySize, 0), urls: resources.map(e => e.name)};
    });
    assert.deepEqual(initial.urls.filter(url => /\/static\/games\//.test(url)).map(url => new URL(url).pathname), ['/static/games/shared.js']);
    assert.equal(await page.locator('#caboPanel').evaluate(node => node.children.length), 0);
    assert(initial.encoded < 250000, JSON.stringify(initial));
    console.log('Initial page:', JSON.stringify(initial));
    await create(page, 'citadels');
    await ready(page, 'citadels');
    await page.evaluate(() => socket.emit('room:add_bot', {room_id: roomId}));
    await page.waitForFunction(() => currentRoomState.players.length === 2);
    await page.evaluate(() => socket.emit('room:ready', {room_id: roomId, ready: true}));
    await page.waitForFunction(() => !document.getElementById('startBtn').disabled);
    await page.locator('#startBtn').click();
    await page.waitForFunction(() => lastGameStatePayload?.game_type === 'citadels');
    await page.locator('#citadelsPanel').waitFor({state: 'visible'});
    const room = await page.evaluate(() => roomId);
    await page.reload();
    await page.waitForFunction(() => isGameAssetsLoaded('citadels') && lastGameStatePayload?.game_type === 'citadels');
    assert.equal(await page.evaluate(() => roomId), room);
    assert.equal(await page.locator('#citadelsPanel').isVisible(), true);
    for (const width of [320, 393, 1280]) {
      await page.setViewportSize({width, height: 852});
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    }
    fs.mkdirSync('tmp/lazy-loading', {recursive: true});
    await page.setViewportSize({width: 393, height: 852});
    await page.screenshot({path: 'tmp/lazy-loading/citadels-mobile.png', fullPage: true});
    await page.evaluate(() => setRoomControlsCollapsed(false));
    await page.locator('#leaveBtn').click();
    await page.waitForFunction(() => !currentRoomState);
    await create(page, 'cabo');
    await ready(page, 'cabo');
    assert.equal(await page.locator('#citadelsPanel').isVisible(), false);
    assert.equal(await page.locator('#caboPanel').isVisible(), true);
    await page.evaluate(() => setRoomControlsCollapsed(false));
    await page.locator('#leaveBtn').click();
    await create(page, 'citadels');
    await ready(page, 'citadels');
    assert.equal(await page.locator('script[src*="/citadels.js"]').count(), 1);
    console.log('Live create/start/reload, leave/switch/re-enter, and responsive layout passed.');

    let markupAttempts = 0;
    const failed = await newPage(p => p.route('**/static/games/cabo.html?*', route => {
      markupAttempts++;
      return markupAttempts === 1 ? route.fulfill({status: 503, body: 'Unavailable'}) : route.continue();
    }));
    await create(failed, 'cabo');
    await failed.locator('#gameAssetsRetryBtn').waitFor({state: 'visible'});
    assert.equal(await failed.locator('#startBtn').isDisabled(), true);
    await failed.locator('#gameAssetsRetryBtn').click();
    await ready(failed, 'cabo');
    assert.equal(markupAttempts, 2);
    assert.equal(await failed.locator('#peekBtn').count(), 1);
    console.log('Failed HTML request retries and initializes once.');

    let entryAttempts = 0;
    const partial = await newPage(p => p.route('**/static/games/rebel_princess.js?*', route => {
      entryAttempts++;
      return entryAttempts === 1 ? route.abort() : route.continue();
    }));
    await create(partial, 'rebel_princess');
    await partial.locator('#gameAssetsRetryBtn').waitFor({state: 'visible'});
    await partial.locator('#gameAssetsRetryBtn').click();
    await ready(partial, 'rebel_princess');
    assert.equal(entryAttempts, 2);
    assert.equal(await partial.locator('script[src*="/rebel_princess_hints.js"]').count(), 1);
    console.log('Partial script failure reuses loaded dependencies without duplicate execution.');

    let release;
    const paused = new Promise(resolve => {release = resolve;});
    const delayed = await newPage(p => p.route('**/static/games/cabo.html?*', async route => {
      await paused;
      await route.continue();
    }));
    await create(delayed, 'cabo');
    await delayed.locator('#gameAssetsStatus').waitFor({state: 'visible'});
    await delayed.locator('#leaveBtn').click();
    await delayed.waitForFunction(() => !roomId);
    release();
    await delayed.waitForFunction(() => isGameAssetsLoaded('cabo'));
    assert.equal(await delayed.evaluate(() => currentRoomState), null);
    assert.equal(await delayed.locator('#caboPanel').isVisible(), false);
    assert.equal(await delayed.locator('#gameAssetsStatus').isVisible(), false);
    console.log('Leaving while assets load does not restore a stale room.');
    assert.deepEqual(errors, []);
    console.log('All asset loading browser regressions passed.');
  } finally {
    await Promise.all(contexts.map(context => context.close()));
    await browser.close();
  }
})().catch(error => {console.error(error); process.exitCode = 1;});
