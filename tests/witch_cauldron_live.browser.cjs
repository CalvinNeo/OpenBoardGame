// Two real players play a full Witch's Cauldron round through the socket layer.
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict');
const base = process.env.ROOM_TEST_URL || 'http://127.0.0.1:8797';

(async () => {
  const browser = await chromium.launch({channel: 'chrome', headless: true});
  const errors = [];
  const contexts = [];
  async function newPage(name) {
    const context = await browser.newContext({viewport: {width: 1280, height: 900}});
    contexts.push(context);
    const page = await context.newPage();
    page.on('pageerror', e => errors.push(name + ': ' + e.message));
    page.on('console', m => {
      if (m.type() !== 'error') return;
      if (m.text().includes('Failed to load resource')) return;
      errors.push(name + ' console: ' + m.text());
    });
    await page.route('https://fonts.googleapis.com/**', r => r.abort());
    await page.goto(base);
    await page.waitForFunction(() => typeof socket !== 'undefined' && socket.connected && cachedGameList);
    return page;
  }
  try {
    const host = await newPage('host');
    const guest = await newPage('guest');
    await host.evaluate(() => socket.emit('room:create', {name: 'Cauldron Host', game_type: 'witch_cauldron'}));
    await host.waitForFunction(() => roomSessionReady && isGameAssetsLoaded('witch_cauldron'));
    const roomId = await host.evaluate(() => roomId);
    await guest.evaluate(id => socket.emit('room:join', {room_id: id, name: 'Cauldron Guest'}), roomId);
    await guest.waitForFunction(() => roomSessionReady && isGameAssetsLoaded('witch_cauldron'));
    for (const page of [host, guest]) await page.evaluate(() => socket.emit('room:ready', {ready: true}));
    await host.waitForFunction(() => !document.getElementById('startBtn').disabled);
    await host.evaluate(() => setRoomControlsCollapsed(false));
    await host.locator('#startBtn').click();
    for (const page of [host, guest]) {
      await page.waitForFunction(() => lastGameStatePayload?.view?.stage === 'setup', null, {timeout: 20000});
    }

    const view = page => page.evaluate(() => lastGameStatePayload?.view);
    const sig = page => page.evaluate(() => JSON.stringify(lastGameStatePayload?.view));

    // Setup: click the first hand card, then confirm it as the soup base.
    for (const page of [host, guest]) {
      await page.locator('.witch-cauldron-hand .witch-cauldron-card').first().click();
      await page.locator('[data-wc-setup]').click();
    }
    for (const page of [host, guest]) {
      await page.waitForFunction(() => lastGameStatePayload?.view?.stage === 'draft', null, {timeout: 20000});
    }
    assert.equal((await view(host)).display.length, 3, 'two players reveal three cards');

    // Play one whole round through the UI.
    for (let guard = 0; guard < 300; guard += 1) {
      const current = await view(host);
      if (!current || current.stage === 'scoring' || current.stage === 'game_over') break;
      const pages = [host, guest];
      let acted = false;
      for (const page of pages) {
        const v = await view(page);
        const legal = v?.legal_actions || [];
        if (legal.includes('draft_pick')) {
          const before = await sig(page);
          await page.locator('.witch-cauldron-display .witch-cauldron-card').first().click();
          await page.waitForFunction(prev => JSON.stringify(lastGameStatePayload?.view) !== prev, before, {timeout: 20000});
          acted = true;
        } else if (legal.includes('play_card')) {
          const before = await sig(page);
          await page.locator('.witch-cauldron-hand .witch-cauldron-card').first().click();
          await page.locator('.witch-cauldron-pot.is-target').first().click();
          await page.locator('[data-wc-play="up"]').click();
          await page.waitForFunction(prev => JSON.stringify(lastGameStatePayload?.view) !== prev, before, {timeout: 20000});
          acted = true;
        } else if (legal.includes('add_card')) {
          const before = await sig(page);
          await page.locator('[data-wc-add="drop"]').click();
          await page.waitForFunction(prev => JSON.stringify(lastGameStatePayload?.view) !== prev, before, {timeout: 20000});
          acted = true;
        } else if (legal.includes('swap')) {
          const before = await sig(page);
          await page.locator('[data-wc-swap=""]').click();
          await page.waitForFunction(prev => JSON.stringify(lastGameStatePayload?.view) !== prev, before, {timeout: 20000});
          acted = true;
        } else if (legal.includes('drink')) {
          const before = await sig(page);
          await page.locator('[data-wc-drink="yes"]').click();
          await page.waitForFunction(prev => JSON.stringify(lastGameStatePayload?.view) !== prev, before, {timeout: 20000});
          acted = true;
        } else if (legal.includes('chameleon')) {
          const before = await sig(page);
          await page.locator('[data-wc-cham="red"]').click();
          await page.waitForFunction(prev => JSON.stringify(lastGameStatePayload?.view) !== prev, before, {timeout: 20000});
          acted = true;
        }
      }
      if (!acted) await host.waitForTimeout(250);
    }

    const scored = await view(host);
    assert.equal(scored.stage, 'scoring', 'the round reaches the scoring review');
    assert.equal(scored.round_summary.length, 2, 'both witches are scored');
    await host.screenshot({path: 'build/witch-cauldron-ui/live-scoring.png', fullPage: true});

    for (const page of [host, guest]) {
      const before = await sig(page);
      await page.locator('[data-wc-next]').click();
      await page.waitForFunction(prev => JSON.stringify(lastGameStatePayload?.view) !== prev, before, {timeout: 20000});
    }
    const next = await view(host);
    assert.equal(next.round, 2, 'both confirmations start round two');
    assert.equal(next.stage, 'setup', 'round two opens with a fresh soup base');
    await host.screenshot({path: 'build/witch-cauldron-ui/live-round2.png', fullPage: true});

    assert.deepEqual(errors, [], 'no page errors: ' + JSON.stringify(errors));
    console.log('live two player round OK');
  } finally {
    for (const context of contexts) await context.close();
    await browser.close();
  }
})().catch(error => { console.error(error); process.exit(1); });
