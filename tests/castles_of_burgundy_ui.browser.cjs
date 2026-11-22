const {chromium} = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const {execFileSync} = require('node:child_process');
const base = process.env.ROOM_TEST_URL || 'http://127.0.0.1:8766';
const fixtures = JSON.parse(execFileSync(process.env.PYTHON || 'python3', ['-m', 'tests.castles_of_burgundy_ui_fixtures'], {encoding: 'utf8'}));
const output = 'tmp/burgundy-ui';

(async () => {
  const browser = await chromium.launch({channel: 'chrome', headless: true});
  const errors = [];
  const context = await browser.newContext({viewport: {width: 1440, height: 1000}, hasTouch: true});
  const page = await context.newPage();
  page.on('pageerror', error => errors.push(error.message));
  const control = command => page.locator(`#burgundyPanel [data-burgundy="${command}"]:visible`);
  const show = async key => page.evaluate(payload => renderBurgundyGameState(payload), fixtures[key]);
  async function completeEstate(width) {
    const layout = await page.locator('.burgundy-map').evaluate(map => {
      const bounds = map.getBoundingClientRect();
      const estate = map.querySelector('.burgundy-estate');
      const cells = [...map.querySelectorAll('.burgundy-hex-slot')];
      return {
        count: cells.length,
        transform: getComputedStyle(estate).transform,
        clipped: cells.some(cell => {
          const box = cell.getBoundingClientRect();
          return box.left < bounds.left - 1 || box.right > bounds.right + 1 ||
            box.top < bounds.top - 1 || box.bottom > bounds.bottom + 1;
        })
      };
    });
    assert.deepEqual(layout, {count: 37, transform: 'none', clipped: false}, `complete estate ${width}`);
    assert.equal(await page.locator('#burgundyPanel [data-burgundy="zoom-in"], #burgundyPanel [data-burgundy="zoom-out"], #burgundyPanel [data-burgundy="fit"], #burgundyPanel [data-burgundy="origin"], .burgundy-map-tools').count(), 0);
    const legend = await page.locator('.burgundy-legend').evaluate(element => [...element.children].map(entry => {
      const kind = [...entry.classList].find(className => className.startsWith('burgundy-'));
      const cell = document.querySelector(`.burgundy-hex.${kind}`);
      return {text: getComputedStyle(entry).color, swatch: getComputedStyle(entry, '::before').backgroundColor, fill: getComputedStyle(cell).backgroundColor};
    }));
    assert.equal(new Set(legend.map(entry => entry.text)).size, 6);
    assert(legend.every(entry => entry.swatch === entry.fill), `legend matches estate colours ${width}`);
  }
  async function fits(label) {
    const overflow = await page.evaluate(() => {
      const offenders = [];
      if (document.documentElement.scrollWidth > innerWidth + 1) offenders.push('page');
      for (const element of document.querySelectorAll('#burgundyPanel button, #burgundyPanel h3, #burgundyPanel h4, .burgundy-confirm p')) {
        if (!element.getClientRects().length || element.closest('.burgundy-map')) continue;
        if (element.scrollWidth > element.clientWidth + 2) offenders.push(`${element.className}: ${element.textContent}`);
      }
      return offenders;
    });
    assert.deepEqual(overflow, [], label);
  }
  try {
    fs.mkdirSync(output, {recursive: true});
    await page.goto(base);
    await page.waitForFunction(() => typeof socket !== 'undefined' && socket.connected && cachedGameList);
    await page.evaluate(() => socket.emit('room:create', {name: 'Burgundy UI QA', game_type: 'castles_of_burgundy'}));
    await page.waitForFunction(() => roomSessionReady && isGameAssetsLoaded('castles_of_burgundy'));
    await page.evaluate(() => socket.emit('room:add_bot', {room_id: roomId}));
    await page.waitForFunction(() => currentRoomState.players.length === 2);
    await page.evaluate(() => socket.emit('room:ready', {room_id: roomId, ready: true}));
    await page.waitForFunction(() => !document.getElementById('startBtn').disabled);
    await page.evaluate(() => setRoomControlsCollapsed(false));
    await page.locator('#startBtn').click();
    await page.waitForFunction(() => lastGameStatePayload?.game_type === 'castles_of_burgundy');
    await page.waitForFunction(() => document.querySelector('#burgundyPanel [data-burgundy="tile"]:not(:disabled)'));
    const oldStorage = await page.evaluate(() => lastGameStatePayload.view.players.find(owner => owner.player_id === lastGameStatePayload.view.you).storage.length);
    await page.locator('#burgundyPanel [data-burgundy="tile"]:not(:disabled)').first().click();
    await control('confirm').click();
    await page.waitForFunction(previous => lastGameStatePayload.view.players.find(owner => owner.player_id === lastGameStatePayload.view.you).storage.length > previous, oldStorage);
    const room = await page.evaluate(() => roomId);
    await page.reload();
    await page.waitForFunction(() => isGameAssetsLoaded('castles_of_burgundy') && document.querySelector('.burgundy-map'));
    assert.equal(await page.evaluate(() => roomId), room);
    await page.evaluate(() => { window.burgundySubmitted = []; sendAction = action => burgundySubmitted.push(action); });

    for (const width of [320, 390, 1024, 1440]) {
      await page.setViewportSize({width, height: width < 800 ? 844 : 1000});
      await show('storage');
      if (width < 800) await control('tab').filter({hasText: 'Estate'}).click();
      await completeEstate(width);
      await fits(`estate ${width}`);
      await page.screenshot({path: `${output}/estate-${width}.png`, fullPage: true});
      if (width < 800) await control('tab').filter({hasText: 'Depots'}).click();
      await fits(`depots ${width}`);
      await page.screenshot({path: `${output}/depots-${width}.png`, fullPage: true});
      await page.locator('#burgundyPanel [data-burgundy="tile"]:not(:disabled)').first().click();
      assert.equal(await page.locator('.burgundy-depot .burgundy-confirm:visible').count(), 1);
      await fits(`local confirmation ${width}`);
      await page.screenshot({path: `${output}/confirm-${width}.png`, fullPage: true});
      await control('cancel').click();
      assert.equal(await page.locator('.burgundy-confirm').count(), 0);
      await show('four');
      await fits(`four players ${width}`);
      await show('finished');
      await fits(`final scoring ${width}`);
    }

    await page.setViewportSize({width: 390, height: 844});
    await show('other_die');
    await control('tab').filter({hasText: 'Estate'}).click();
    assert.equal(await page.locator('[data-burgundy="die"][data-die="0"]').getAttribute('aria-pressed'), 'true');
    assert.equal(await control('storage').isEnabled(), true);
    assert.match(await control('storage').innerText(), /Die 2/);
    await control('die').nth(1).click();
    assert.equal(await control('storage').locator('.burgundy-storage-status').count(), 0);
    await control('die').first().click();
    await control('storage').click();
    assert.equal(await page.locator('[data-burgundy="die"][data-die="1"]').getAttribute('aria-pressed'), 'true');
    assert.equal(await page.locator('.burgundy-hex.is-legal').count(), 1);
    await page.locator('.burgundy-hex.is-legal').click();
    await control('confirm').click();
    assert.deepEqual(await page.evaluate(() => burgundySubmitted.at(-1)), {type: 'place', die: 1, tile: 'test-ship', cell: 17});
    for (const [fixture, label] of [['no_workers', 'Need workers'], ['no_adjacent', 'No adjacent hex'], ['no_dice', 'No dice left']]) {
      await show(fixture);
      assert.equal(await control('storage').isDisabled(), true);
      assert.match(await control('storage').innerText(), new RegExp(label));
      await fits(`storage restriction ${fixture}`);
    }
    const disabledStorage = await control('storage').boundingBox();
    await page.touchscreen.tap(disabledStorage.x + disabledStorage.width / 2, disabledStorage.y + disabledStorage.height / 2);
    assert.match(await page.locator('#burgundyTooltip').innerText(), /Taking and placing a tile are separate actions/);
    await page.screenshot({path: `${output}/storage-restriction-390.png`, fullPage: true});
    await show('free_place');
    assert.equal(await control('storage').isEnabled(), true);
    await control('storage').click();
    await page.locator('.burgundy-hex.is-legal').first().click();
    await control('confirm').click();
    const freePlacement = await page.evaluate(() => burgundySubmitted.at(-1));
    assert.equal(freePlacement.type, 'place');
    assert.equal(Object.hasOwn(freePlacement, 'die'), false);

    await show('storage');
    if (await control('tab').count()) await control('tab').filter({hasText: 'Estate'}).click();
    await page.locator('#burgundyPanel [data-burgundy="storage"]:not(:disabled)').first().click();
    await page.locator('#burgundyPanel .burgundy-hex.is-legal').first().click();
    assert.equal(await page.locator('.burgundy-estate-section > .burgundy-confirm').count(), 1);
    await control('confirm').click();
    assert.equal(await page.evaluate(() => burgundySubmitted.at(-1).type), 'place');

    await show('initial');
    await control('sell').first().click();
    assert.equal(await page.locator('.burgundy-supplies .burgundy-confirm').count(), 1);
    await control('confirm').click();
    assert.equal(await page.evaluate(() => burgundySubmitted.at(-1).type), 'sell');

    await show('full');
    await control('tab').filter({hasText: 'Depots'}).click();
    await control('buy-mode').click();
    await page.locator('.burgundy-depot:not(.burgundy-black-depot) [data-burgundy="tile"]:not(:disabled)').first().click();
    assert.equal(await control('confirm').isDisabled(), true);
    await control('discard').first().click();
    await control('confirm').click();
    assert.equal(await page.evaluate(() => burgundySubmitted.at(-1).type), 'buy');
    assert(await page.evaluate(() => !!burgundySubmitted.at(-1).discard));
    await show('ship');
    await control('ship-depot').first().click();
    assert.equal(await page.locator('.burgundy-depot .burgundy-ship-choice').count(), 1);
    await fits('ship goods selection');
    await control('confirm').click();
    assert.equal(await page.evaluate(() => burgundySubmitted.at(-1).type), 'ship_goods');

    await show('review');
    assert.equal(await control('next').count(), 1);
    assert.equal(await page.locator('.burgundy-review.is-you').count(), 1);
    await control('next').click();
    assert.equal(await page.evaluate(() => burgundySubmitted.at(-1).type), 'next_round');
    await show('spectator');
    assert.equal(await page.locator('#burgundyPanel [data-burgundy="tile"]:not(:disabled)').count(), 0);

    await show('storage');
    await control('tab').filter({hasText: 'Estate'}).click();
    await page.locator('#burgundyPanel [data-burgundy="storage"]:not(:disabled)').first().click();
    const legalHex = await page.locator('.burgundy-hex.is-legal').first().boundingBox();
    const map = await page.locator('.burgundy-map').boundingBox();
    await page.mouse.move(legalHex.x + legalHex.width / 2, legalHex.y + legalHex.height / 2);
    await page.mouse.down();
    await page.mouse.move(map.x + map.width + 30, map.y + map.height / 2, {steps: 5});
    await page.mouse.up();
    assert.equal(await page.locator('.burgundy-hex.is-selected').count(), 0);
    await completeEstate(390);
    await page.waitForTimeout(450);

    const session = await context.newCDPSession(page);
    await page.locator('.burgundy-map').scrollIntoViewIfNeeded();
    const touchHex = await page.locator('.burgundy-hex.is-legal').first().boundingBox();
    const scrollBeforeMapDrag = await page.evaluate(() => scrollY);
    const touchStart = {x: touchHex.x + touchHex.width / 2, y: touchHex.y + touchHex.height / 2};
    await session.send('Input.dispatchTouchEvent', {type: 'touchStart', touchPoints: [touchStart]});
    for (const distance of [15, 30, 45, 60, 75]) {
      await session.send('Input.dispatchTouchEvent', {type: 'touchMove', touchPoints: [{x: touchStart.x, y: touchStart.y - distance}]});
    }
    await session.send('Input.dispatchTouchEvent', {type: 'touchEnd', touchPoints: []});
    await page.waitForFunction(previous => scrollY > previous, scrollBeforeMapDrag);
    assert.equal(await page.locator('.burgundy-hex.is-selected').count(), 0);
    assert.equal(await page.locator('.burgundy-estate-section > .burgundy-confirm').count(), 0);
    assert.equal(await page.locator('.burgundy-selection-hint').count(), 1);
    await completeEstate(390);
    await page.waitForTimeout(450);
    await page.locator('.burgundy-map').scrollIntoViewIfNeeded();
    const cancelMap = await page.locator('.burgundy-map').boundingBox();
    await session.send('Input.dispatchTouchEvent', {type: 'touchStart', touchPoints: [{x: cancelMap.x + cancelMap.width / 2, y: cancelMap.y + cancelMap.height / 2}]});
    await session.send('Input.dispatchTouchEvent', {type: 'touchCancel', touchPoints: []});
    assert.equal(await page.locator('.burgundy-hex.is-selected').count(), 0);
    await page.waitForTimeout(450);
    await page.locator('.burgundy-hex.is-legal').first().tap();
    assert.equal(await page.locator('.burgundy-hex.is-selected').count(), 1);
    await control('confirm').tap();
    assert.equal(await page.evaluate(() => burgundySubmitted.at(-1).type), 'place');

    const count = await page.evaluate(() => burgundySubmitted.length);
    await page.locator('#burgundyExplainBtn').click();
    const disabled = await page.locator('#burgundyPanel [data-burgundy="end"]:disabled').boundingBox();
    await page.mouse.click(disabled.x + disabled.width / 2, disabled.y + disabled.height / 2);
    await page.locator('.obg-explain-dialog[open]').waitFor();
    assert.equal(await page.evaluate(() => burgundySubmitted.length), count);
    await page.keyboard.press('Escape');
    await page.locator('#burgundyHelpBtn').click();
    const helpDialog = page.locator('[data-obg-help-game="castles_of_burgundy"]');
    await helpDialog.locator('[data-obg-help-lang="en"]').click();
    assert.match(await helpDialog.innerText(), /How you win/);
    await helpDialog.locator('[data-obg-help-tab="controls"]').click();
    assert.match(await helpDialog.innerText(), /complete estate automatically fits/);
    assert.doesNotMatch(await helpDialog.innerText(), /Origin|Zoom and drag/);
    await helpDialog.locator('[data-obg-help-tab="knowledge"]').click();
    assert.match(await helpDialog.innerText(), /Knowledge 26/);
    await helpDialog.locator('[data-obg-help-lang="zh"]').click();
    assert.match(await helpDialog.innerText(), /知识 26/);
    await page.keyboard.press('Escape');
    assert.equal(await helpDialog.evaluate(element => element.open), false);
    assert.equal(await page.locator('#burgundyHelpBtn').evaluate(element => document.activeElement === element), true);

    await page.locator('details[data-detail="log"] summary').click();
    await control('die').first().click();
    assert.equal(await page.locator('details[data-detail="log"]').evaluate(element => element.open), true);

    const legend = page.locator('.burgundy-legend [data-burgundy-tip]').first();
    await legend.tap();
    assert.equal(await page.locator('#burgundyTooltip').isVisible(), true);
    await page.waitForTimeout(3200);
    assert.equal(await page.locator('#burgundyTooltip').isVisible(), false);
    await control('die').first().tap();
    assert.equal(await page.locator('#burgundyTooltip').isVisible(), false);
    await page.evaluate(() => scrollTo(0, 0));
    const scrollStart = await page.evaluate(() => scrollY);
    await session.send('Input.dispatchTouchEvent', {type: 'touchStart', touchPoints: [{x: 200, y: 190}]});
    for (const position of [170, 150, 130, 110, 90]) {
      await session.send('Input.dispatchTouchEvent', {type: 'touchMove', touchPoints: [{x: 200, y: position}]});
    }
    await session.send('Input.dispatchTouchEvent', {type: 'touchEnd', touchPoints: []});
    await page.waitForFunction(previous => scrollY > previous, scrollStart);
    assert.deepEqual(errors, []);
    console.log('Passed: live take/reload, four widths with full estate and colour-matched legends, storage placement with alternate die/free bonus/restriction labels, four players/final scoring, local take/place/sell/buy/replace/ship confirmation, round pause, spectator, map swipe/scroll/cancel without selection, bilingual Help/focus, disabled Explain, touch tips, outside-map scrolling.');
  } catch (error) {
    await page.screenshot({path: `${output}/failure.png`, fullPage: true});
    throw error;
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
