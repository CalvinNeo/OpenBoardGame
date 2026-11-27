const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { execFileSync } = require('node:child_process');
const base = process.env.ROOM_TEST_URL || 'http://127.0.0.1:8793';
const output = 'tmp/bohnanza-ui';
const fixtures = JSON.parse(execFileSync(process.env.PYTHON || 'python3', ['tests/bohnanza_ui_fixtures.py'], { encoding: 'utf8' }));

async function layout(page, label) {
  await page.evaluate(() => { window.scrollTo(0, 0); document.activeElement?.blur(); });
  const result = await page.evaluate(() => {
    const bad = [];
    for (const node of document.querySelectorAll('#bohnanzaPanel *, .game-panel > .panel-header *, dialog[open] *')) {
      const box = node.getBoundingClientRect();
      if (!box.width || !box.height || node.closest('.hidden, dialog:not([open])')) continue;
      if (node.closest('details:not([open])') && !node.closest('summary')) continue;
      if (node.closest('.bn-hand, .bn-trade-cards, #bohnanzaPending') && !node.matches('.bn-hand, .bn-trade-cards, #bohnanzaPending')) continue;
      const style = getComputedStyle(node);
      if (box.left < -1 || box.right > innerWidth + 1) bad.push(`${node.id || node.className}: outside viewport`);
      if (node.clientWidth && node.scrollWidth > node.clientWidth + 2 && !['auto', 'scroll', 'hidden', 'clip'].includes(style.overflowX)) bad.push(`${node.id || node.className}: text overflow ${node.clientWidth}/${node.scrollWidth}`);
    }
    for (const selector of ['.bn-fields', '.bn-main', '.bn-want', '.bn-counter', '.bn-player-header', '.bn-dialog-footer']) {
      for (const parent of document.querySelectorAll(selector)) {
        if (!parent.getBoundingClientRect().width || parent.closest('.hidden, dialog:not([open])')) continue;
        const boxes = [...parent.children].map(node => node.getBoundingClientRect()).filter(box => box.width && box.height);
        for (let first = 0; first < boxes.length; first += 1) for (let second = first + 1; second < boxes.length; second += 1) {
          const left = boxes[first], right = boxes[second];
          if (Math.min(left.right, right.right) - Math.max(left.left, right.left) > 1 && Math.min(left.bottom, right.bottom) - Math.max(left.top, right.top) > 1) bad.push(`${selector}: overlap`);
        }
      }
    }
    const header = ['gameReconnectBtn', 'bohnanzaHelpBtn'].map(id => document.getElementById(id).getBoundingClientRect()).filter(box => box.width && box.height);
    if (header.length === 2 && Math.abs(header[0].top + header[0].height / 2 - header[1].top - header[1].height / 2) > 3) bad.push('Help/Reconnect wrapped');
    return { pageOverflow: document.documentElement.scrollWidth > innerWidth, bad };
  });
  await page.screenshot({ path: `${output}/${label}.png`, fullPage: true });
  assert.deepEqual(result, { pageOverflow: false, bad: [] }, label);
}

(async () => {
  fs.mkdirSync(output, { recursive: true });
  const browser = await chromium.launch({ channel: process.env.BROWSER_CHANNEL || 'chrome', headless: true });
  const contexts = [], pages = [], errors = [];
  async function client(name, touch = false) {
    const context = await browser.newContext({ viewport: { width: 1440, height: 960 }, hasTouch: touch, isMobile: touch });
    contexts.push(context);
    const page = await context.newPage();
    page.on('pageerror', error => errors.push(error.message));
    await page.route('https://fonts.googleapis.com/**', route => route.abort());
    await page.goto(base);
    await page.waitForFunction(() => typeof socket !== 'undefined' && socket.connected && cachedGameList);
    await page.evaluate(name => { window.bnTestName = name; }, name);
    pages.push(page);
    return page;
  }
  async function render(page, label) {
    await page.evaluate(view => {
      window.renderBohnanzaGameState({ room_id: roomId, game_type: 'bohnanza', view });
    }, fixtures[label]);
  }
  try {
    const first = await client('Alice');
    assert.equal(await first.locator('#bohnanzaPanel').evaluate(node => node.children.length), 0);
    assert.equal(await first.locator('script[src*="/bohnanza.js"]').count(), 0);
    await first.evaluate(() => socket.emit('room:create', { name: bnTestName, game_type: 'bohnanza' }));
    await first.waitForFunction(() => roomSessionReady && isGameAssetsLoaded('bohnanza'));
    const room = await first.evaluate(() => roomId);
    for (const name of ['Bao', 'Clara']) {
      const page = await client(name, name === 'Clara');
      await page.evaluate(room => socket.emit('room:join', { room_id: room, name: bnTestName }), room);
      await page.waitForFunction(() => roomSessionReady && isGameAssetsLoaded('bohnanza'));
    }
    for (const page of pages) await page.evaluate(() => socket.emit('room:ready', { ready: true }));
    await first.waitForFunction(() => !document.getElementById('startBtn').disabled);
    if (!await first.locator('#startBtn').isVisible()) await first.evaluate(() => setRoomControlsCollapsed(false));
    await first.locator('#startBtn').click();
    for (const page of pages) await page.waitForFunction(() => lastGameStatePayload?.game_type === 'bohnanza' && lastGameStatePayload.view.phase === 'plant_hand');
    await first.locator('#bohnanzaHand button').first().click();
    await first.locator('#bohnanzaFields button').filter({ hasText: 'Plant here' }).first().click();
    await first.waitForFunction(() => lastGameStatePayload.view.planted === 1);
    await first.locator('#bohnanzaMarketButtons button').click();
    await first.waitForFunction(() => lastGameStatePayload.view.phase === 'trade');
    await first.locator('#bohnanzaPlayers button').filter({ hasText: 'Trade' }).first().click();
    await first.locator('#bohnanzaGive button').first().click();
    await first.locator('#bohnanzaSendOffer').click();
    const second = pages[1];
    await second.locator('#bohnanzaOfferDialog').waitFor({ state: 'visible' });
    await second.locator('#bohnanzaOfferButtons button').filter({ hasText: 'Accept' }).click();
    await first.waitForFunction(() => !lastGameStatePayload.view.offer && lastGameStatePayload.view.players.some(player => player.pending.length));
    await first.locator('#bohnanzaMarketButtons button').filter({ hasText: 'End trading' }).click();
    await first.waitForFunction(() => lastGameStatePayload.view.phase === 'plant_traded');
    for (let step = 0; step < 6; step += 1) {
      let found = false;
      for (const page of pages) {
        const pending = await page.locator('#bohnanzaPending button').count();
        if (!pending) continue;
        found = true;
        await page.locator('#bohnanzaPending button').first().click();
        const plant = page.locator('#bohnanzaFields button').filter({ hasText: 'Plant here' });
        assert(await plant.count() > 0);
        const revision = await page.evaluate(() => lastGameStatePayload.view.revision);
        await plant.first().click();
        await page.waitForFunction(revision => lastGameStatePayload.view.revision > revision, revision);
      }
      if (!found) break;
    }
    await first.waitForFunction(() => lastGameStatePayload.view.phase === 'draw');
    await first.locator('#bohnanzaHandButtons button').click();
    await first.waitForFunction(() => lastGameStatePayload.view.turn_number === 2);
    const saved = await first.evaluate(() => ({ room: roomId, revision: lastGameStatePayload.view.revision }));
    await first.reload();
    await first.waitForFunction(saved => isGameAssetsLoaded('bohnanza') && roomId === saved.room && lastGameStatePayload?.view.revision === saved.revision, saved);
    console.log('Live create/join/start/plant/gift/accept/grow/draw/reconnect passed');
    for (const page of pages) await page.evaluate(() => setRoomControlsCollapsed(true));
    await first.evaluate(() => {
      window.bnTestActions = [];
      window.bnOriginalEmit = socket.emit.bind(socket);
      socket.emit = (event, payload, ...rest) => event === 'game:action' ? bnTestActions.push(payload.action) : bnOriginalEmit(event, payload, ...rest);
    });
    for (const width of [320, 390, 1024, 1440]) {
      await first.setViewportSize({ width, height: 960 });
      for (const label of ['plant', 'trade', 'received', 'review', 'final', 'spectator', 'ended', 'three-fields']) {
        await render(first, label);
        await layout(first, `${label}-${width}`);
      }
      await render(first, 'trade');
      await first.locator('#bohnanzaFields button').first().click();
      await layout(first, `harvest-${width}`);
      await first.locator('#bohnanzaFields .bn-confirm button').filter({ hasText: 'Cancel' }).click();
      await first.locator('#bohnanzaPlayers button').first().click();
      await first.locator('#bohnanzaGive button').first().click();
      const scroll = await first.locator('#bohnanzaGive').evaluate(node => { node.scrollLeft = 160; return node.scrollLeft; });
      await first.locator('#bohnanzaGive button').nth(3).click();
      assert(await first.locator('#bohnanzaGive').evaluate(node => node.scrollLeft) >= scroll - 5, 'selection preserves horizontal scroll');
      await first.locator('#bohnanzaWant button[aria-label="Request more Blue Bean"]').click();
      await layout(first, `composer-${width}`);
      await first.keyboard.press('Escape');
      assert.equal(await first.locator('#bohnanzaTradeDialog').isVisible(), false);
      await render(first, 'incoming');
      await first.locator('#bohnanzaOfferDialog').waitFor({ state: 'visible' });
      const accept = first.locator('#bohnanzaOfferButtons button').filter({ hasText: 'Accept' });
      assert.equal(await accept.isDisabled(), true);
      await first.locator('#bohnanzaOfferBody button').first().click();
      assert.equal(await accept.isDisabled(), false);
      await layout(first, `offer-${width}`);
      await first.locator('#bohnanzaOfferDock').click();
      assert.equal(await first.locator('#bohnanzaOfferDialog').isVisible(), false);
      await first.locator('#bohnanzaOfferReturn').click();
      await first.keyboard.press('Escape');
      await render(first, 'trade');
      await first.locator('#bohnanzaHelpBtn').click();
      for (const language of ['en', 'zh']) {
        await first.locator(`[data-obg-help-lang="${language}"]`).click();
        for (const section of ['__basic', 'growing', 'deals', 'beans', 'ending']) {
          await first.locator(`[data-obg-help-tab="${section}"]`).click();
          await layout(first, `help-${language}-${section}-${width}`);
        }
      }
      await first.keyboard.press('Escape');
    }
    await first.setViewportSize({ width: 390, height: 900 });
    await render(first, 'plant');
    const before = await first.evaluate(() => bnTestActions.length);
    await first.locator('#bohnanzaExplainBtn').click();
    const disabled = first.locator('#bohnanzaMarketButtons button:disabled').first();
    await disabled.scrollIntoViewIfNeeded();
    const box = await disabled.boundingBox();
    await first.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
    await first.locator('.obg-explain-dialog[open]').waitFor();
    assert.equal(await first.evaluate(() => bnTestActions.length), before);
    await first.keyboard.press('Escape');
    await first.locator('#bohnanzaHand button').first().click();
    assert.equal(await first.locator('#bohnanzaFields button').filter({ hasText: 'Plant here' }).count(), 1);
    await first.locator('#bohnanzaStatus').click();
    assert.equal(await first.locator('#bohnanzaHand .is-selected').count(), 0);
    await render(first, 'ended');
    await first.locator('#bohnanzaReview button').filter({ hasText: 'Play Again' }).click();
    assert.equal(await first.evaluate(() => bnTestActions.at(-1).type), 'play_again');
    await render(first, 'plant');
    await first.evaluate(() => socket.disconnect());
    assert.equal(await first.locator('#bohnanzaHand button').count(), 0, 'disconnected hand is not interactive');
    assert.equal(await first.locator('#bohnanzaFields button:enabled').count(), 0);
    await first.evaluate(() => socket.connect());
    await first.waitForFunction(() => socket.connected);
    const touch = pages[2];
    for (const width of [320, 390]) {
      await touch.setViewportSize({ width, height: 900 });
      await render(touch, 'three-fields');
      await touch.locator('#bohnanzaGold').tap();
      assert.equal(await touch.locator('#bohnanzaTooltip').isVisible(), true);
      await touch.waitForTimeout(3100);
      assert.equal(await touch.locator('#bohnanzaTooltip').isVisible(), false);
      await touch.locator('#bohnanzaHand button').first().scrollIntoViewIfNeeded();
      const rect = await touch.locator('#bohnanzaHand button').first().boundingBox();
      const session = await touch.context().newCDPSession(touch);
      await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: rect.x + 35, y: rect.y + 50 }] });
      await session.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: rect.x + 35, y: rect.y - 60 }] });
      await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
      await session.detach();
      assert.equal(await touch.locator('#bohnanzaHand .is-selected').count(), 0);
      await layout(touch, `touch-${width}`);
    }
    assert.deepEqual(errors, []);
    console.log('Bohnanza: 320/390/1024/1440 layouts, dialogs, bilingual Help, disabled Explain, selection, tooltip and touch checks passed');
  } finally {
    for (const context of contexts) await context.close();
    await browser.close();
  }
})().catch(error => { console.error(error); process.exit(1); });
