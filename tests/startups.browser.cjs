// Local browser QA: PLAYWRIGHT_MODULE points to an existing Playwright install.
const {chromium} = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const base = process.env.ROOM_TEST_URL || 'http://127.0.0.1:8767';
const output = 'tmp/startups-qa';

(async () => {
  const browser = await chromium.launch({channel: 'chrome', headless: true});
  const errors = [], contexts = [], pages = [];
  fs.mkdirSync(output, {recursive: true});
  async function newPage(options = {}) {
    const context = await browser.newContext({viewport: {width: 1440, height: 1000}, ...options});
    contexts.push(context);
    const page = await context.newPage();
    page.on('pageerror', error => errors.push(error.message));
    await page.route('https://fonts.googleapis.com/**', route => route.abort());
    await page.goto(base);
    await page.waitForFunction(() => typeof socket !== 'undefined' && socket.connected && cachedGameList);
    return page;
  }
  async function state(page) { return page.evaluate(() => lastGameStatePayload.view); }
  async function send(page, type, fields = {}) {
    const before = await state(page);
    await page.evaluate(({type, fields}) => {
      const v = lastGameStatePayload.view;
      sendAction({type, game_token: v.game_token, round_number: v.round_number, turn_number: v.turn_number, ...fields});
    }, {type, fields});
    await page.waitForFunction(revision => lastGameStatePayload.view.revision > revision, before.revision);
  }
  async function waitRevision(revision) {
    await Promise.all(pages.map(page => page.waitForFunction(r => lastGameStatePayload.view.revision >= r, revision)));
  }
  async function actor() {
    const view = await state(pages[0]);
    return pages.find((page, index) => view.players[index].player_id === view.current_turn);
  }
  async function layout(page, width, suffix) {
    await page.setViewportSize({width, height: width > 500 ? 1000 : 900});
    await page.evaluate(() => document.activeElement?.blur());
    const bad = await page.evaluate(() => {
      const panel = document.getElementById('startupsPanel'), bounds = panel.getBoundingClientRect();
      return [...panel.querySelectorAll('*')].filter(node => {
        const r = node.getBoundingClientRect();
        return r.width && r.height && !node.closest('#startupsTooltip') && (r.left < bounds.left - 2 || r.right > bounds.right + 2);
      }).map(node => ({tag: node.tagName, id: node.id, class: node.className}));
    });
    assert.deepEqual(bad, [], `Panel overflow at ${width}`);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, `Page overflow at ${width}`);
    await page.locator('#startupsPanel').screenshot({path: `${output}/${suffix}-${width}.png`});
  }
  try {
    for (let i = 0; i < 3; i++) pages.push(await newPage());
    const host = pages[0];
    assert.equal(await host.locator('script[src*="/startups.js"]').count(), 0);
    await host.evaluate(() => socket.emit('room:create', {name: 'Investor Alice · LongNameForLayoutTesting', game_type: 'startups', config: {rounds: 4, seed: 136}}));
    await host.waitForFunction(() => roomSessionReady && isGameAssetsLoaded('startups'));
    const room = await host.evaluate(() => roomId);
    for (let i = 1; i < 3; i++) {
      await pages[i].evaluate(({room, i}) => socket.emit('room:join', {room_id: room, name: `Investor ${i}`}), {room, i});
      await pages[i].waitForFunction(() => roomSessionReady && isGameAssetsLoaded('startups'));
    }
    for (const page of pages) await page.evaluate(() => socket.emit('room:ready', {ready: true}));
    await host.waitForFunction(() => !document.getElementById('startBtn').disabled);
    assert.equal(await host.locator('#startupsRounds').inputValue(), '4');
    await host.locator('#startBtn').click();
    await Promise.all(pages.map(page => page.waitForFunction(() => lastGameStatePayload?.view?.game_id === 'startups')));
    await host.locator('#startupsHelpBtn').click();
    assert.equal(await host.locator('#startupsDialog').evaluate(node => node.open), true);
    assert.match(await host.locator('#startupsDialogBody').textContent(), /1 枚资本/);
    await host.keyboard.press('Escape');
    assert.equal(await host.locator('#startupsDialog').evaluate(node => node.open), false);
    const first = await actor();
    const beforeExplain = (await state(first)).revision;
    await first.locator('#startupsExplainBtn').click();
    const disabled = await first.locator('#startupsHand button').first().boundingBox();
    await first.mouse.click(disabled.x + disabled.width / 2, disabled.y + disabled.height / 2);
    assert.equal(await first.locator('#startupsDialog').evaluate(node => node.open), true);
    assert.equal((await state(first)).revision, beforeExplain);
    await first.keyboard.press('Escape');
    await first.locator('#startupsDraw').click();
    await first.waitForFunction(() => lastGameStatePayload.view.phase === 'place');
    await waitRevision((await state(first)).revision);
    for (const page of pages) assert.equal((await state(page)).hand.length, page === first ? 4 : 3);
    await first.locator('#startupsHand button').first().click();
    assert.equal(await first.locator('#startupsHandSelection').isVisible(), true);
    await first.keyboard.press('Escape');
    assert.equal(await first.locator('#startupsHandSelection').isVisible(), false);
    await first.locator('#startupsHand button').first().click();
    await first.locator('#startupsDiscard').click();
    await first.waitForFunction(() => lastGameStatePayload.view.phase === 'take');
    await waitRevision((await state(first)).revision);
    const second = await actor();
    await second.locator('#startupsMarket button').first().click();
    await second.locator('#startupsTake').click();
    await second.waitForFunction(() => lastGameStatePayload.view.phase === 'place');
    const v = await state(second), same = v.hand.find(c => c.company === v.taken_company);
    await second.locator(`#startupsHand button[data-card-id="${same.id}"]`).click();
    assert.equal(await second.locator('#startupsDiscard').isDisabled(), true);
    await second.locator('#startupsExplainBtn').click();
    const noDiscard = await second.locator('#startupsDiscard').boundingBox();
    await second.mouse.click(noDiscard.x + noDiscard.width / 2, noDiscard.y + noDiscard.height / 2);
    assert.match(await second.locator('#startupsDialogBody').textContent(), /同公司/);
    await second.keyboard.press('Escape');
    await second.locator(`#startupsHand button[data-card-id="${same.id}"]`).click();
    await second.locator('#startupsInvest').click();
    await second.waitForFunction(() => lastGameStatePayload.view.phase === 'take');
    await waitRevision((await state(second)).revision);
    for (let i = 0; i < 6; i++) {
      const page = await actor(), current = await state(page);
      if (current.phase === 'take') {
        if (current.legal_actions.includes('draw')) await send(page, 'draw');
        else await send(page, 'take_market', {card_id: current.legal_market_ids[0]});
      } else {
        const id = current.legal_discard_ids[0];
        await send(page, id ? 'discard' : 'invest', {card_id: id || current.hand[0].id});
      }
      await waitRevision((await state(page)).revision);
    }
    for (const width of [1440, 390, 320]) await layout(host, width, 'playing');
    await host.locator('#startupsDeck').click();
    assert.equal(await host.locator('#startupsTooltip').isVisible(), true);
    await host.locator('#startupsCapital').click();
    assert.match(await host.locator('#startupsTooltip').textContent(), /资本/);
    await host.waitForTimeout(3150);
    assert.equal(await host.locator('#startupsTooltip').isVisible(), false);
    const beforeReload = await state(host);
    await host.reload();
    await host.waitForFunction(() => isGameAssetsLoaded('startups') && lastGameStatePayload?.view?.game_id === 'startups');
    assert.deepEqual((await state(host)).hand, beforeReload.hand);
    assert.equal((await state(host)).revision, beforeReload.revision);
    assert.equal(await host.locator('script[src*="/startups.js"]').count(), 1);
    console.log('Lazy loading, live actions, private hands, Help, disabled Explain, Esc, tips, reload and 1440/390/320 layouts passed.');
    let reviewed = 0;
    for (let step = 0; step < 800; step++) {
      const current = await state(host);
      if (current.game_over) break;
      if (current.phase === 'round_review') {
        reviewed++;
        await send(host, 'next_round');
        await host.waitForTimeout(100);
        assert.equal((await state(host)).phase, 'round_review');
        assert.equal((await state(host)).ready.length, 1);
        await waitRevision((await state(host)).revision);
        await send(pages[1], 'next_round');
        await waitRevision((await state(pages[1])).revision);
        await send(pages[2], 'next_round');
        await waitRevision((await state(pages[2])).revision);
      } else {
        const page = await actor(), actorView = await state(page);
        if (actorView.phase === 'take') {
          if (actorView.legal_actions.includes('draw')) await send(page, 'draw');
          else await send(page, 'take_market', {card_id: actorView.legal_market_ids[0]});
        } else await send(page, 'invest', {card_id: actorView.hand[0].id});
        await waitRevision((await state(page)).revision);
      }
    }
    assert.equal((await state(host)).game_over, true);
    assert.equal((await state(host)).score_history.length, 4);
    assert.equal(reviewed, 3);
    for (const width of [1440, 390, 320]) await layout(host, width, 'results');
    console.log('Four-round game, all-player review barrier and final settlement passed.');
    const botPage = await newPage();
    await botPage.evaluate(() => socket.emit('room:create', {name: 'Bot practice', game_type: 'startups'}));
    await botPage.waitForFunction(() => roomSessionReady && isGameAssetsLoaded('startups'));
    for (let count = 2; count <= 3; count++) {
      await botPage.evaluate(() => socket.emit('room:add_bot', {}));
      await botPage.waitForFunction(n => currentRoomState.players.length === n, count);
    }
    await botPage.evaluate(() => socket.emit('room:ready', {ready: true}));
    await botPage.waitForFunction(() => !document.getElementById('startBtn').disabled);
    await botPage.locator('#startBtn').click();
    await botPage.waitForFunction(() => lastGameStatePayload?.view?.game_id === 'startups');
    for (let i = 0; i < 140; i++) {
      await botPage.waitForFunction(() => lastGameStatePayload.view.game_over || lastGameStatePayload.view.legal_actions.length, null, {timeout: 20000});
      const current = await state(botPage);
      if (current.game_over) break;
      if (current.phase === 'take') {
        if (current.legal_actions.includes('draw')) await send(botPage, 'draw');
        else await send(botPage, 'take_market', {card_id: current.legal_market_ids[0]});
      } else await send(botPage, 'invest', {card_id: current.hand[0].id});
    }
    assert.equal((await state(botPage)).game_over, true);
    console.log('Real room with two server bots completed.');
    const dense = [];
    for (let i = 0; i < 7; i++) dense.push(await newPage({hasTouch: true, isMobile: true, viewport: {width: 320, height: 900}}));
    await dense[0].evaluate(() => socket.emit('room:create', {name: 'InvestorWithAVeryLongUnbrokenName0123456789', game_type: 'startups'}));
    await dense[0].waitForFunction(() => roomSessionReady && isGameAssetsLoaded('startups'));
    const denseRoom = await dense[0].evaluate(() => roomId);
    for (let i = 1; i < 7; i++) {
      await dense[i].evaluate(({room, i}) => socket.emit('room:join', {room_id: room, name: `Investor${i}WithAVeryLongUnbrokenName0123456789`}), {room: denseRoom, i});
      await dense[i].waitForFunction(() => roomSessionReady && isGameAssetsLoaded('startups'));
    }
    for (const page of dense) await page.evaluate(() => socket.emit('room:ready', {ready: true}));
    await dense[0].waitForFunction(() => !document.getElementById('startBtn').disabled);
    await dense[0].locator('#startBtn').tap();
    await Promise.all(dense.map(page => page.waitForFunction(() => lastGameStatePayload?.view?.game_id === 'startups')));
    const densityView = await state(dense[0]);
    const mobile = dense[densityView.players.findIndex(player => player.player_id === densityView.current_turn)];
    await mobile.locator('#startupsDraw').tap();
    await mobile.waitForFunction(() => lastGameStatePayload.view.phase === 'place');
    await layout(mobile, 320, 'seven-players-four-cards');
    await mobile.locator('#startupsDeck').tap();
    assert.equal(await mobile.locator('#startupsTooltip').isVisible(), true);
    await mobile.locator('#startupsCapital').tap();
    assert.match(await mobile.locator('#startupsTooltip').textContent(), /资本/);
    await mobile.waitForTimeout(3150);
    assert.equal(await mobile.locator('#startupsTooltip').isVisible(), false);
    await mobile.locator('#startupsExplainBtn').tap();
    await mobile.locator('#startupsDraw').scrollIntoViewIfNeeded();
    const disabledDraw = await mobile.locator('#startupsDraw').boundingBox();
    await mobile.touchscreen.tap(disabledDraw.x + disabledDraw.width / 2, disabledDraw.y + disabledDraw.height / 2);
    assert.equal(await mobile.locator('#startupsDialog').evaluate(node => node.open), true);
    await mobile.locator('#startupsDialogClose').tap();
    await mobile.locator('#startupsHand button').first().tap();
    await mobile.locator('#startupsHandTitle').tap();
    assert.equal(await mobile.locator('#startupsHandSelection').isVisible(), false);
    console.log('Seven players, long names, four cards and real touch tooltips / disabled Explain / blank-area cancellation passed at 320 px.');
    assert.deepEqual(errors, []);
    fs.writeFileSync(`${output}/result.json`, JSON.stringify({ok: true, errors, rounds: 4, reviewBarriers: reviewed, viewports: [1440, 390, 320], botRoomCompleted: true, sevenPlayerTouch: true}, null, 2));
  } finally {
    for (const context of contexts) await context.close();
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
