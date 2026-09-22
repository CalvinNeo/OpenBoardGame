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
  async function caboStyleCounts(page) {
    return page.evaluate(() => {
      const counts = [];
      function visit(rules) {
        for (const rule of rules) {
          if (/\bobg-game-cabo-/.test(rule.media?.mediaText || '')) counts.push(rule.cssRules.length);
          else if (rule.cssRules) visit(rule.cssRules);
        }
      }
      visit(document.getElementById('coreStyles').sheet.cssRules);
      return counts;
    });
  }
  try {
    const page = await newPage();
    const initial = await page.evaluate(() => {
      const resources = [performance.getEntriesByType('navigation')[0], ...performance.getEntriesByType('resource')]
        .filter(entry => entry.name.startsWith(location.origin) && !entry.name.includes('/socket.io/'));
      return {count: resources.length, encoded: resources.reduce((n, e) => n + e.encodedBodySize, 0), decoded: resources.reduce((n, e) => n + e.decodedBodySize, 0), urls: resources.map(e => e.name)};
    });
    assert.deepEqual(initial.urls.filter(url => /\/static\/games\//.test(url)).map(url => new URL(url).pathname), ['/static/games/shared.js']);
    assert.deepEqual(initial.urls.filter(url => /\/static\/games\/[^?]+\.css(?:\?|$)/.test(url)), []);
    assert.equal(await page.locator('#caboPanel').evaluate(node => node.children.length), 0);
    assert(initial.encoded < 150000, JSON.stringify(initial));
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

    let styleAttempts = 0;
    const failedStyles = await newPage(p => p.route('**/static/games/cabo.css?*', route => {
      styleAttempts++;
      if (styleAttempts === 1) return route.abort();
      if (styleAttempts === 2) return route.fulfill({contentType: 'text/html', body: '<!doctype html><html><body>Fallback page</body></html>'});
      return route.continue();
    }));
    await create(failedStyles, 'cabo');
    for (const attempt of [1, 2]) {
      await failedStyles.locator('#gameAssetsRetryBtn').waitFor({state: 'visible'});
      assert.equal(styleAttempts, attempt);
      const counts = await caboStyleCounts(failedStyles);
      assert(counts.length > 0, 'Cabo must reserve its original stylesheet positions.');
      assert(counts.every(count => count === 0), 'Failed CSS responses must not install partial styles.');
      assert.equal(await failedStyles.evaluate(() => isGameAssetsLoaded('cabo')), false);
      assert.equal(await failedStyles.locator('#startBtn').isDisabled(), true);
      await failedStyles.locator('#gameAssetsRetryBtn').click();
      if (attempt === 1) await failedStyles.waitForFunction(() => gameAssetErrors.has('cabo'));
    }
    await ready(failedStyles, 'cabo');
    const installedCounts = await caboStyleCounts(failedStyles);
    assert(installedCounts.every(count => count > 0));
    await failedStyles.evaluate(() => ensureGameAssets('cabo'));
    assert.equal(styleAttempts, 3);
    assert.deepEqual(await caboStyleCounts(failedStyles), installedCounts);
    assert.equal(await failedStyles.locator('script[src*="/cabo.js"]').count(), 1);
    console.log('Failed CSS and HTML fallback retry without partial styles or duplicate installation.');

    const gameProbeRules = `
      .lazy-css-cascade-probe {
        color: rgb(4, 5, 6);
        background-color: rgb(10, 20, 30);
        outline: 1px solid black;
        --lazy-css-border: rgb(12, 34, 56);
        border: 3px solid var(--lazy-css-border);
        border-left: 5px solid rgb(65, 43, 21);
      }
      .lazy-css-cascade-probe { outline-width: 7px; }
    `;
    const cascade = await newPage(p => p.route('**/static/games/cabo.css?*', async route => {
      const response = await route.fetch();
      const source = await response.text();
      const body = source.replace(/(@media\s+all,\s*obg-game-cabo-[\w-]+\s*\{)/, `$1\n${gameProbeRules}`);
      assert.notEqual(body, source, 'Cabo stylesheet must contain a cascade position marker.');
      await route.fulfill({response, body});
    }));
    await cascade.evaluate(() => {
      const sheet = document.getElementById('coreStyles').sheet;
      const position = Array.from(sheet.cssRules).findIndex(rule => /\bobg-game-cabo-/.test(rule.media?.mediaText || ''));
      if (position < 0) throw new Error('Cabo stylesheet position is missing.');
      sheet.insertRule('#lazyCssCascadeProbe { color: rgb(1, 2, 3); }', position);
      sheet.insertRule('.lazy-css-cascade-probe { background-color: rgb(9, 8, 7); }', position + 2);
      const probe = document.createElement('div');
      probe.id = 'lazyCssCascadeProbe';
      probe.className = 'lazy-css-cascade-probe';
      document.body.appendChild(probe);
    });
    await create(cascade, 'cabo');
    await ready(cascade, 'cabo');
    const cascadeStyle = await cascade.locator('#lazyCssCascadeProbe').evaluate(node => {
      const style = getComputedStyle(node);
      return {
        color: style.color, background: style.backgroundColor, outline: style.outlineWidth,
        borders: ['Top', 'Right', 'Bottom', 'Left'].map(side => [style[`border${side}Width`], style[`border${side}Style`], style[`border${side}Color`]]),
      };
    });
    assert.deepEqual(cascadeStyle, {
      color: 'rgb(1, 2, 3)', background: 'rgb(9, 8, 7)', outline: '7px',
      borders: [
        ['3px', 'solid', 'rgb(12, 34, 56)'],
        ['3px', 'solid', 'rgb(12, 34, 56)'],
        ['3px', 'solid', 'rgb(12, 34, 56)'],
        ['5px', 'solid', 'rgb(65, 43, 21)'],
      ],
    });
    console.log('Lazy CSS preserves specificity, shared rule order, fragment order, and variable border shorthands.');

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
