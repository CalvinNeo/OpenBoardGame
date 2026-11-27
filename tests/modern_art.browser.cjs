const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { execFileSync } = require('node:child_process');
const base = process.env.ROOM_TEST_URL || 'http://127.0.0.1:8806';
const output = 'tmp/modern-art-ui';
const widths = [320, 390, 1024, 1440];
const fixtures = JSON.parse(execFileSync('python3', ['tests/modern_art_ui_fixtures.py'], { encoding: 'utf8' }));

async function layout(page, label) {
  await page.evaluate(() => { window.scrollTo(0, 0); document.activeElement?.blur(); });
  const issues = await page.evaluate(() => {
    const bad = [];
    for (const node of document.querySelectorAll('#modernArtPanel *, .game-panel > .panel-header *, dialog[open] *')) {
      const box = node.getBoundingClientRect();
      if (!box.width || !box.height || node.closest('.hidden,svg,dialog:not([open])')) continue;
      if (node.closest('details:not([open])') && !node.closest('summary')) continue;
      const style = getComputedStyle(node);
      if (box.left < -1 || box.right > innerWidth + 1) bad.push(`${node.id || node.className}: outside viewport`);
      if (node.clientWidth && node.scrollWidth > node.clientWidth + 2 && !['auto', 'scroll', 'hidden', 'clip'].includes(style.overflowX)) bad.push(`${node.id || node.className}: text overflow`);
    }
    for (const selector of ['.ma-market', '.ma-hand', '.ma-players', '.ma-bid-controls', '.ma-buttons', '.ma-selection']) {
      const boxes = [...document.querySelectorAll(`${selector} > *`)].map(node => node.getBoundingClientRect()).filter(box => box.width && box.height);
      for (let first = 0; first < boxes.length; first += 1) for (let second = first + 1; second < boxes.length; second += 1) {
        const left = boxes[first], right = boxes[second];
        if (Math.min(left.right, right.right) - Math.max(left.left, right.left) > 1 && Math.min(left.bottom, right.bottom) - Math.max(left.top, right.top) > 1) bad.push(`${selector}: overlap`);
      }
    }
    const header = ['gameReconnectBtn', 'modernArtHelpBtn'].map(id => document.getElementById(id).getBoundingClientRect()).filter(box => box.width && box.height);
    if (header.length === 2 && Math.abs(header[0].top + header[0].height / 2 - header[1].top - header[1].height / 2) > 3) bad.push('Help/Reconnect line break');
    return { pageOverflow: document.documentElement.scrollWidth > innerWidth, bad };
  });
  await page.screenshot({ path: `${output}/${label}.png`, fullPage: true });
  assert.deepEqual(issues, { pageOverflow: false, bad: [] }, label);
}

async function expandedHand(page, room, width) {
  await page.evaluate(({ room, view }) => renderModernArtGameState({ room_id: room, game_type: 'modern_art', view }), { room, view: fixtures['long-hand'] });
  const hand = page.locator('#modernArtHand');
  const cards = hand.locator('[data-ma-card]');
  assert.equal(await cards.count(), 22);
  const dimensions = await hand.evaluate(node => ({
    height: node.clientHeight,
    content: node.scrollHeight,
    overflow: getComputedStyle(node).overflowY,
    clipped: [...node.querySelectorAll('[data-ma-card]')].some(card => card.getBoundingClientRect().bottom > node.getBoundingClientRect().bottom + 1)
  }));
  assert.equal(dimensions.clipped, false, `all paintings fit the expanded hand at ${width}px`);
  assert.ok(dimensions.content <= dimensions.height + 1, `no internal hand scroll at ${width}px`);
  assert.ok(!['auto', 'scroll', 'hidden', 'clip'].includes(dimensions.overflow), `hand stays in document flow at ${width}px`);
  await layout(page, `long-hand-${width}`);
  for (const index of [0, 10, 21]) {
    const card = cards.nth(index);
    await card.scrollIntoViewIfNeeded();
    const before = await page.evaluate(() => window.scrollY);
    const beforeTop = await card.evaluate(node => node.getBoundingClientRect().top);
    await card.click();
    const after = await page.evaluate(() => window.scrollY);
    assert.ok(Math.abs(after - before) <= 1, `selecting painting ${index} keeps page position at ${width}px`);
    assert.ok(Math.abs(await card.evaluate(node => node.getBoundingClientRect().top) - beforeTop) <= 1, 'selected painting does not move');
    const proximity = await page.evaluate(() => {
      const controls = document.getElementById('modernArtSelection').getBoundingClientRect();
      const selected = [...document.querySelectorAll('#modernArtHand .ma-selected')].at(-1).getBoundingClientRect();
      return { gap: controls.top - selected.bottom, width: controls.width, cardWidth: selected.width };
    });
    assert.ok(proximity.gap >= 0 && proximity.gap <= 10, 'confirmation follows the selected row without covering paintings');
    assert.ok(proximity.width >= proximity.cardWidth * 2, 'confirmation uses the row width');
    await page.screenshot({ path: `${output}/long-hand-selected-${index}-${width}.png`, fullPage: true });
    await page.keyboard.press('Escape');
    assert.equal(await page.locator('#modernArtSelection').isVisible(), false);
    assert.ok(Math.abs(await page.evaluate(() => window.scrollY) - before) <= 1, 'deselection keeps page position');
  }
  await cards.nth(8).scrollIntoViewIfNeeded();
  await cards.nth(8).click();
  await page.locator('#modernArtSelection button').filter({ hasText: 'Cancel' }).click();
  assert.equal(await page.locator('#modernArtSelection').isVisible(), false);
  await cards.nth(8).click();
  await page.locator('#modernArtHandSection .ma-caption').click();
  assert.equal(await page.locator('#modernArtSelection').isVisible(), false, 'blank hand space cancels');
  await page.evaluate(() => window.scrollTo(0, 0));
  const scrollRange = await page.evaluate(() => document.documentElement.scrollHeight - innerHeight);
  if (scrollRange > 30) {
    await cards.first().scrollIntoViewIfNeeded();
    await cards.first().hover();
    const scrollBefore = await page.evaluate(() => window.scrollY);
    await page.mouse.wheel(0, 180);
    await page.waitForFunction(before => window.scrollY > before + 30, scrollBefore);
  } else {
    assert.ok(await cards.last().evaluate(node => node.getBoundingClientRect().bottom <= innerHeight), 'a hand that fits needs no scrolling');
  }
  assert.equal(await hand.evaluate(node => node.scrollTop), 0, 'wheel over the hand scrolls the page, never an inner area');
  assert.equal(await page.locator('#modernArtSelection').isVisible(), false, 'wheel does not select paintings');
  await hand.locator('[data-ma-card="lite_metal-double-0"]').click();
  await hand.locator('[data-ma-card="lite_metal-open-0"]').click();
  assert.equal(await hand.locator('.ma-selected').count(), 2, 'double selection survives page scrolling');
  assert.equal(await page.locator('#modernArtSelection').innerText(), '2 selected\nOffer lot\nCancel');
  await page.evaluate(({ room, view }) => renderModernArtGameState({ room_id: room, game_type: 'modern_art', view }), { room, view: fixtures['long-hand'] });
  assert.equal(await hand.locator('.ma-selected').count(), 2, 'same-step updates preserve the selected lot');
  await page.setViewportSize({ width: width <= 390 ? 1024 : 390, height: 900 });
  await layout(page, `long-hand-resized-${width}`);
  const rowGap = await page.evaluate(() => document.getElementById('modernArtSelection').getBoundingClientRect().top
    - document.querySelector('[data-ma-card="lite_metal-open-0"]').getBoundingClientRect().bottom);
  assert.ok(rowGap >= 0 && rowGap <= 10, 'confirmation follows the latest selected row after resizing');
  await page.keyboard.press('Escape');
  await page.setViewportSize({ width, height: 900 });
}

(async () => {
  fs.mkdirSync(output, { recursive: true });
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const contexts = [], pages = [], errors = [];
  async function client(name) {
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, hasTouch: name === 'Carol', isMobile: name === 'Carol' });
    contexts.push(context);
    const page = await context.newPage();
    page.on('pageerror', error => errors.push(error.message));
    await page.route('https://fonts.googleapis.com/**', route => route.abort());
    await page.goto(base);
    await page.waitForFunction(() => typeof socket !== 'undefined' && socket.connected && cachedGameList);
    await page.evaluate(name => { window.maTestName = name; }, name);
    pages.push(page);
    return page;
  }
  try {
    const first = await client('Alice');
    assert.equal(await first.locator('script[src*="/modern_art.js"]').count(), 0);
    await first.evaluate(() => socket.emit('room:create', { name: maTestName, game_type: 'modern_art' }));
    await first.waitForFunction(() => roomSessionReady && currentGameType === 'modern_art' && isGameAssetsLoaded('modern_art'));
    await first.locator('#modernArtLobby').waitFor({ state: 'visible' });
    const room = await first.evaluate(() => roomId);
    for (const name of ['Bob', 'Carol']) {
      const page = await client(name);
      await page.evaluate(room => socket.emit('room:join', { room_id: room, name: maTestName }), room);
      await page.waitForFunction(() => roomSessionReady && isGameAssetsLoaded('modern_art'));
    }
    for (const page of pages) await page.evaluate(() => socket.emit('room:ready', { ready: true }));
    await first.waitForFunction(() => !document.getElementById('startBtn').disabled);
    if (!await first.locator('#startBtn').isVisible()) await first.locator('#roomControlsToggleBtn').click();
    await first.locator('#startBtn').click();
    for (const page of pages) await page.waitForFunction(() => lastGameStatePayload?.game_type === 'modern_art' && lastGameStatePayload.view.phase === 'offer');
    for (const page of pages) await page.evaluate(() => setRoomControlsCollapsed(true));
    const original = await first.evaluate(() => structuredClone(lastGameStatePayload));
    const touch = pages[2];
    const touchOriginal = await touch.evaluate(() => structuredClone(lastGameStatePayload));
    for (const width of [320, 390]) {
      await touch.setViewportSize({ width, height: 900 });
      await touch.evaluate(({ room, view }) => renderModernArtGameState({ room_id: room, game_type: 'modern_art', view }), { room, view: fixtures['long-hand'] });
      await touch.locator('#modernArtHand button').first().tap();
      assert.equal(await touch.locator('#modernArtSelection').isVisible(), true, `touch selects a card at ${width}px`);
      await layout(touch, `touch-${width}`);
      await touch.locator('#modernArtSelection button').filter({ hasText: 'Cancel' }).tap();
      await touch.locator('#modernArtCash').tap();
      assert.equal(await touch.locator('#modernArtTooltip').isVisible(), true);
      await touch.waitForTimeout(3100);
      assert.equal(await touch.locator('#modernArtTooltip').isVisible(), false);
      const touchCard = touch.locator('#modernArtHand button').first();
      await touchCard.scrollIntoViewIfNeeded();
      const box = await touchCard.boundingBox();
      const beforeSwipe = await touch.evaluate(() => window.scrollY);
      const cdp = await touch.context().newCDPSession(touch);
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: box.x + box.width / 2, y: box.y + box.height / 2 }] });
      for (let step = 1; step <= 5; step += 1) {
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: box.x + box.width / 2, y: box.y + box.height / 2 - step * 28 }] });
        await touch.waitForTimeout(35);
      }
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
      await cdp.detach();
      await touch.waitForFunction(before => window.scrollY > before + 30, beforeSwipe);
      assert.equal(await touch.locator('#modernArtHand').evaluate(node => node.scrollTop), 0, 'native swipe scrolls the document');
      assert.equal(await touch.locator('#modernArtSelection').isVisible(), false, 'native touch scrolling does not select');
      await touch.waitForTimeout(450);
    }
    await touch.evaluate(payload => renderModernArtGameState(payload), touchOriginal);
    for (const width of widths) {
      await first.setViewportSize({ width, height: 900 });
      await expandedHand(first, room, width);
      for (const [label, view] of Object.entries(fixtures)) {
        await first.evaluate(({ room, view }) => renderModernArtGameState({ room_id: room, game_type: 'modern_art', view }), { room, view });
        if (label === 'five-players') await first.locator('#modernArtHand button').first().click();
        if (label === 'auction-end') assert.equal(await first.locator('.ma-revealed-bids .ma-you').count(), 1);
        await layout(first, `${label}-${width}`);
      }
      await first.evaluate(payload => renderModernArtGameState(payload), original);
      await first.locator('#modernArtHelpBtn').click();
      const help = first.locator('dialog.obg-help-dialog[open]');
      await help.locator('[data-obg-help-lang="en"]').click();
      await help.locator('[data-obg-help-tab="auctions"]').click();
      await layout(first, `help-en-${width}`);
      await help.locator('[data-obg-help-lang="zh"]').click();
      await layout(first, `help-zh-${width}`);
      await first.keyboard.press('Escape');
      assert.equal(await first.locator('dialog[open]').count(), 0);
    }
    await first.setViewportSize({ width: 390, height: 900 });
    await first.evaluate(({ room, view }) => renderModernArtGameState({ room_id: room, game_type: 'modern_art', view }), { room, view: fixtures.open });
    const disabled = first.locator('#modernArtHand button').first();
    assert.equal(await disabled.isDisabled(), true);
    await first.locator('#modernArtExplainBtn').click();
    await disabled.scrollIntoViewIfNeeded();
    const disabledBox = await disabled.boundingBox();
    await first.mouse.click(disabledBox.x + disabledBox.width / 2, disabledBox.y + disabledBox.height / 2);
    await first.locator('dialog.obg-explain-dialog[open]').waitFor();
    await first.keyboard.press('Escape');
    await first.evaluate(payload => renderModernArtGameState(payload), original);
    await first.locator('#modernArtHand button').first().click();
    await first.locator('#modernArtConfirmBtn').waitFor({ state: 'visible' });
    await first.keyboard.press('Escape');
    assert.equal(await first.locator('#modernArtSelection').isVisible(), false);
    await first.locator('#modernArtCash').click();
    assert.equal(await first.locator('#modernArtTooltip').isVisible(), true);
    await first.waitForTimeout(3100);
    assert.equal(await first.locator('#modernArtTooltip').isVisible(), false);
    const hand = first.locator('#modernArtHand');
    await hand.scrollIntoViewIfNeeded();
    await hand.evaluate(node => {
      const card = node.querySelector('button'), box = card.getBoundingClientRect();
      card.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerId: 1, clientX: box.x + 10, clientY: box.y + 10 }));
      card.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, pointerId: 1, clientX: box.x + 10, clientY: box.y + 80 }));
      card.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, pointerId: 1, clientX: box.x + 10, clientY: box.y + 80 }));
      card.click();
    });
    assert.equal(await first.locator('#modernArtSelection').isVisible(), false, 'scroll does not select');
    await first.waitForTimeout(450);
    await first.evaluate(({ room, view }) => renderModernArtGameState({ room_id: room, game_type: 'modern_art', view }), { room, view: fixtures['five-players'] });
    await hand.locator('[data-ma-card]').nth(4).click();
    assert.equal(await hand.evaluate(node => node.scrollTop), 0, 'selection never creates an internal hand scroller');
    await first.setViewportSize({ width: 1024, height: 900 });
    await first.evaluate(payload => renderModernArtGameState(payload), original);
    const ids = await Promise.all(pages.map(page => page.evaluate(() => lastGameStatePayload.view.you)));
    const state = () => first.evaluate(() => structuredClone(lastGameStatePayload.view));
    async function send(playerId, type, fields = {}) {
      const before = await state();
      const page = pages[ids.indexOf(playerId)];
      await page.evaluate(({ type, fields }) => {
        const view = lastGameStatePayload.view;
        socket.emit('game:action', { action: { type, game_token: view.game_token, round: view.round, step: view.step, ...fields } });
      }, { type, fields });
      await Promise.all(pages.map(page => page.waitForFunction(revision => lastGameStatePayload.view.revision > revision, before.revision)));
    }
    const cardId = original.view.hand.find(cardId => original.view.card_catalog[cardId].kind === 'sealed') || original.view.hand.find(cardId => original.view.card_catalog[cardId].kind !== 'double');
    await first.locator(`[data-ma-card="${cardId}"]`).click();
    await first.locator('#modernArtConfirmBtn').click();
    await first.waitForFunction(() => lastGameStatePayload.view.phase !== 'offer');
    const seen = new Set();
    for (let turn = 0; turn < 3000; turn += 1) {
      const view = await state();
      seen.add(view.phase);
      if (view.game_over) break;
      let moved = false;
      for (const playerId of ids) {
        const own = await pages[ids.indexOf(playerId)].evaluate(() => lastGameStatePayload.view);
        const actions = own.legal_actions, auction = own.auction;
        if (!actions.length) continue;
        if (actions.includes('next_round')) await send(playerId, 'next_round');
        else if (actions.includes('offer')) {
          const card = own.hand.find(cardId => own.card_catalog[cardId].kind !== 'double') || own.hand[0];
          await send(playerId, 'offer', { cards: [card] });
        } else if (actions.includes('add')) {
          const card = own.hand.find(cardId => own.card_catalog[cardId].artist === own.card_catalog[auction.cards[0]].artist && own.card_catalog[cardId].kind !== 'double');
          await send(playerId, 'add', { card });
        } else if (actions.includes('set_price')) await send(playerId, 'set_price', { amount: Math.min(8, own.cash) });
        else if (actions.includes('buy')) await send(playerId, 'buy');
        else if (actions.includes('bid') && (own.phase === 'sealed' || auction.high_bid < 3)) await send(playerId, 'bid', { amount: Math.min(own.cash, own.phase === 'sealed' ? 2 : auction.high_bid + 1) });
        else if (actions.includes('pass')) await send(playerId, 'pass');
        else continue;
        moved = true;
        break;
      }
      assert.equal(moved, true, `Game makes progress in ${view.phase}`);
    }
    assert.equal((await state()).game_over, true);
    assert.equal((await state()).final_results.length, 3);
    await layout(first, 'live-final');
    await first.reload();
    await first.waitForFunction(() => roomSessionReady && lastGameStatePayload?.view?.game_over && isGameAssetsLoaded('modern_art'));
    assert.equal((await state()).hand.length, (await state()).players.find(player => player.player_id === ids[0]).hand_count);
    const token = (await state()).game_token;
    await first.locator('#modernArtPlayAgainBtn').click();
    await first.waitForFunction(token => lastGameStatePayload.view.game_token !== token && lastGameStatePayload.view.phase === 'offer', token);
    assert.equal((await state()).cash, 100);
    await first.evaluate(() => socket.emit('room:create', { name: 'Alice', game_type: 'cabo' }));
    await first.waitForFunction(() => currentGameType === 'cabo' && isGameAssetsLoaded('cabo'));
    assert.equal(await first.locator('#modernArtPanel').isVisible(), false);
    assert.equal(await first.locator('#modernArtHeaderActions').isVisible(), false);
    assert.deepEqual(errors, []);
    console.log(`Modern Art browser passed: ${widths.join('/')}px, ${Object.keys(fixtures).length} states, Help/Explain/Escape/tooltips/touch, full game/reconnect. Phases: ${[...seen].join(', ')}`);
  } finally {
    for (const context of contexts) await context.close();
    await browser.close();
  }
})().catch(error => { console.error(error); process.exit(1); });
