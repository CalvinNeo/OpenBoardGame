const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const base = process.env.ROOM_TEST_URL || 'http://127.0.0.1:8784';
const output = 'build/abraca-what-ui';
const baseline = process.env.ABRACA_BASELINE === '1';
fs.mkdirSync(output, { recursive: true });

function makeView(overrides = {}) {
  return {
    game_id: 'abraca_what', you: 'p0', phase: 'wait_goon', round: 2,
    current_turn: 'p0', deck_count: 7, secret_pool_count: 4,
    discard_total: 5, discard_counts: [0, 0, 1, 0, 1, 1, 2, 0],
    min_spell: 2, legal_actions: ['cast_spell', 'end_turn'],
    allowed_spells: [2, 3, 4, 5, 6, 7], winner: [], game_over: false,
    config: { target_score: 8 }, round_result: null,
    last_action: { player_id: 'p0', spell_type: 2, success: true, dice: 2 },
    players: ['Alex', 'Nova', 'Sage', 'Luna', 'Kai'].map((name, index) => ({
      player_id: `p${index}`, name, seat: index, is_bot: index > 1,
      hp: 6 - index, score: index, secret_count: index === 0 ? 2 : 0,
      hand: Array.from({ length: 5 }, (_, card) => index === 0
        ? { hidden: true }
        : { spell: (index + card) % 8, number: (index + card) % 8 + 1 }),
      ...(index === 0 ? { secret_cards: [{ spell: 4, number: 5 }, { spell: 7, number: 8 }] } : {}),
    })),
    ...overrides,
  };
}

async function render(page, overrides = {}) {
  await page.evaluate(view => {
    renderAbracaGameState({ room_id: roomId, game_type: 'abraca_what', view });
  }, makeView(overrides));
}

async function checkBounds(page, label) {
  const result = await page.evaluate(() => {
    const bad = [...document.querySelectorAll('#abracaPanel *, #abracaHelpModal *, #abracaExplainModal *')]
      .filter(element => {
        const rect = element.getBoundingClientRect();
        const style = getComputedStyle(element);
        return rect.width > 0 && rect.height > 0 && (rect.left < -1 || rect.right > innerWidth + 1 ||
          (element.clientWidth && element.scrollWidth > element.clientWidth + 1 &&
            !['auto', 'hidden'].includes(style.overflowX)));
      }).map(element => `${element.id || element.className}: ${element.textContent.slice(0, 55)}`);
    const overlaps = [...document.querySelectorAll('#abracaPlayers .player-header')].filter(header => {
      const name = header.querySelector('.player-name').getBoundingClientRect();
      const badges = header.querySelector('.player-badges').getBoundingClientRect();
      return name.right > badges.left + 1;
    }).length;
    return {
      width: innerWidth, scroll: document.documentElement.scrollWidth, bad, overlaps,
      height: Math.round(document.getElementById('abracaPanel').getBoundingClientRect().height),
    };
  });
  if (!baseline) {
    assert.equal(result.scroll <= result.width, true, `${label}: page overflow`);
    assert.deepEqual(result.bad, [], `${label}: content overflow`);
    assert.equal(result.overlaps, 0, `${label}: player name overlaps stats`);
  }
  return result;
}

async function activate(page, selector, mobile) {
  const target = page.locator(selector);
  if (mobile) await target.tap();
  else await target.click();
}

async function pointActivate(page, selector, mobile) {
  const target = page.locator(selector);
  await target.scrollIntoViewIfNeeded();
  const rect = await target.boundingBox();
  const clientX = rect.x + rect.width / 2;
  const clientY = rect.y + rect.height / 2;
  if (mobile) await page.touchscreen.tap(clientX, clientY);
  else await page.mouse.click(clientX, clientY);
}

async function swipe(page, selector) {
  await page.locator(selector).scrollIntoViewIfNeeded();
  const rect = await page.locator(selector).boundingBox();
  const session = await page.context().newCDPSession(page);
  const clientX = rect.x + rect.width / 2;
  const clientY = Math.min(rect.y + rect.height / 2, 600);
  await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: clientX, y: clientY }] });
  for (const offset of [15, 35, 60, 85]) {
    await session.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: clientX, y: clientY - offset }] });
    await page.waitForTimeout(30);
  }
  await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await session.detach();
  await page.waitForTimeout(150);
}

async function panelScreenshot(page, name) {
  await page.evaluate(() => {
    window.getSelection()?.removeAllRanges();
    const panel = document.querySelector('.game-panel');
    window.scrollTo(0, Math.max(0, panel.getBoundingClientRect().top + scrollY - 44));
  });
  await page.locator('.game-panel').screenshot({ path: `${output}/${name}.png` });
}

async function checkLiveSession(browser, errors) {
  const contexts = [];
  try {
    for (const width of [390, 1024]) {
      const context = await browser.newContext({ viewport: { width, height: 900 }, hasTouch: width === 390, isMobile: width === 390 });
      contexts.push(context);
    }
    const pages = await Promise.all(contexts.map(context => context.newPage()));
    for (const page of pages) {
      page.on('pageerror', error => errors.push(error.message));
      await page.route('https://fonts.googleapis.com/**', route => route.abort());
      await page.goto(base);
      await page.waitForFunction(() => typeof socket !== 'undefined' && socket.connected && cachedGameList);
      assert.equal(await page.locator('script[src*="/abraca_what.js"]').count(), 0);
    }
    await pages[0].evaluate(() => socket.emit('room:create', { name: 'Abraca host', game_type: 'abraca_what' }));
    await pages[0].waitForFunction(() => roomSessionReady && isGameAssetsLoaded('abraca_what'));
    const createdRoom = await pages[0].evaluate(() => roomId);
    await pages[1].evaluate(room => socket.emit('room:join', { room_id: room, name: 'Abraca guest' }), createdRoom);
    for (const page of pages) {
      await page.waitForFunction(() => roomSessionReady && currentRoomState.players.length === 2 && isGameAssetsLoaded('abraca_what'));
      await page.evaluate(() => socket.emit('room:ready', { room_id: roomId, ready: true }));
    }
    await pages[0].waitForFunction(() => currentRoomState.players.every(player => player.ready));
    await pages[0].evaluate(() => socket.emit('room:start', { room_id: roomId }));
    for (const page of pages) {
      await page.waitForFunction(() => lastGameStatePayload?.game_type === 'abraca_what' && currentAbracaView?.players.length === 2);
      await page.evaluate(() => setRoomControlsCollapsed(true));
      assert.equal(await page.locator('.abraca-card-hidden').count(), 5);
      await checkBounds(page, 'Live initial hand');
    }
    const actor = await pages[0].evaluate(() => currentAbracaView.current_turn);
    const activePage = await pages[0].evaluate(() => playerId) === actor ? pages[0] : pages[1];
    const activeMobile = activePage === pages[0];
    await activate(activePage, '#abracaSpellBtn7', activeMobile);
    assert.equal(await activePage.locator('#abracaCastConfirm').isVisible(), true);
    await activate(activePage, '#abracaCastBtn', activeMobile);
    for (const page of pages) {
      await page.waitForFunction(() => currentAbracaView.last_action?.spell_type === 7);
      assert.match(await page.locator('#abracaActivitySummary').textContent(), /Potion/);
    }
    await pages[0].reload();
    await pages[0].waitForFunction(() => isGameAssetsLoaded('abraca_what') && currentAbracaView?.last_action?.spell_type === 7);
    assert.equal(await pages[0].evaluate(() => roomId), createdRoom);
    assert.equal(await pages[0].locator('#abracaSpellButtons button').count(), 8);
    assert.equal(await pages[0].locator('script[src*="/abraca_what.js"]').count(), 1);
    console.log('Live two-player cast and reload/reconnect passed.');
  } finally {
    await Promise.all(contexts.map(context => context.close()));
  }
}

async function checkAssetRetry(browser, errors) {
  for (const extension of ['html', 'css', 'js']) {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
    try {
      const page = await context.newPage();
      page.on('pageerror', error => errors.push(error.message));
      await page.route('https://fonts.googleapis.com/**', route => route.abort());
      let attempts = 0;
      await page.route(`**/static/games/abraca_what.${extension}?*`, route => {
        attempts++;
        return attempts === 1 ? route.fulfill({ status: 503, body: 'Unavailable' }) : route.continue();
      });
      await page.goto(base);
      await page.waitForFunction(() => typeof socket !== 'undefined' && socket.connected && cachedGameList);
      await page.evaluate(() => socket.emit('room:create', { name: 'Abraca retry', game_type: 'abraca_what' }));
      await page.locator('#gameAssetsRetryBtn').waitFor({ state: 'visible' });
      await page.evaluate(() => setRoomControlsCollapsed(true));
      assert.equal(await page.locator('#startBtn').isDisabled(), true);
      await page.locator('#gameAssetsRetryBtn').tap();
      await page.waitForFunction(() => isGameAssetsLoaded('abraca_what') && !document.getElementById('gameAssetsStatus').offsetHeight);
      assert.equal(attempts, 2, `${extension} retries once`);
      assert.equal(await page.locator('#abracaSpellButtons').count(), 1);
      assert.equal(await page.locator('script[src*="/abraca_what.js"]').count(), 1);
      await render(page);
      await checkBounds(page, `${extension} retry`);
    } finally {
      await context.close();
    }
  }
  console.log('Abraca markup, stylesheet and script retry passed.');
}

async function checkInteractions(page, width) {
  const mobile = width <= 390;
  const confirmation = page.locator('#abracaCastConfirm');
  const explanation = page.locator('#abracaExplainModal');
  const tooltip = page.locator('#abracaTooltip');
  const actionCount = () => page.evaluate(() => abracaTestActions.length);
  assert.equal(await page.locator('#abracaSpellButtons button').count(), 8);
  assert.equal(await page.locator('#abracaSpellBtn2 .abraca-spell-used').textContent(), '1 / 3');
  assert.equal(await page.locator('#abracaSpellBtn0').isDisabled(), true);
  assert.equal(await page.locator('#abracaRollBtn').isVisible(), false);
  assert.equal(await page.locator('#abracaSecretBtn').isVisible(), false);
  assert.equal(await page.locator('#abracaNextRoundBtn').isVisible(), false);
  const endTurn = await page.locator('#abracaEndTurnBtn').boundingBox();
  const actionHint = await page.locator('#abracaActionHint').boundingBox();
  const actionHeading = await page.locator('.abraca-action-heading').boundingBox();
  assert(endTurn.width < 110, 'End Turn stays compact instead of spanning the panel');
  assert(endTurn.height >= (mobile ? 44 : 40), 'End Turn retains a comfortable touch target');
  assert(actionHint.x + actionHint.width <= endTurn.x, 'End Turn sits to the right of the hint');
  assert(actionHint.y >= endTurn.y && actionHint.y + actionHint.height <= endTurn.y + endTurn.height,
    'End Turn and the action hint share one row');
  assert(endTurn.y >= actionHeading.y && endTurn.y + endTurn.height <= actionHeading.y + actionHeading.height,
    'End Turn stays inside the Actions heading');
  assert.equal(await page.locator('#abracaTurnActions').isVisible(), false, 'End Turn leaves no empty action row');

  await activate(page, '#abracaSpellBtn2', mobile);
  assert.equal(await confirmation.isVisible(), true);
  assert.equal(await actionCount(), 0, 'Selection must not cast');
  assert.equal(await tooltip.isVisible(), false, 'Action buttons do not show tooltips');
  await checkBounds(page, `${width}px confirmation`);
  await page.locator('#abracaSpells').screenshot({ path: `${output}/confirm-${width}.png` });
  await activate(page, '#abracaCancelCastBtn', mobile);
  assert.equal(await confirmation.isVisible(), false);
  await activate(page, '#abracaSpellBtn4', mobile);
  await activate(page, '#abracaCastBtn', mobile);
  assert.deepEqual(await page.evaluate(() => abracaTestActions), [{ type: 'cast_spell', spell_type: 4 }]);
  await activate(page, '#abracaSpellBtn3', mobile);
  await page.locator('#abracaPanel > h3').click();
  assert.equal(await confirmation.isVisible(), false, 'Blank-area cancellation');
  await activate(page, '#abracaSpellBtn2', mobile);
  await page.keyboard.press('Escape');
  assert.equal(await confirmation.isVisible(), false);
  await activate(page, '#abracaSpellBtn2', mobile);
  await render(page, { phase: 'wait_dice', legal_actions: ['roll_dice'], allowed_spells: [] });
  assert.equal(await confirmation.isVisible(), false, 'Changed phase invalidates selection');
  assert.equal(await page.locator('#abracaRollBtn').isVisible(), true);
  assert.equal(await page.locator('#abracaEndTurnBtn').isVisible(), false);
  await activate(page, '#abracaRollBtn', mobile);
  await render(page, { phase: 'wait_see', legal_actions: ['take_secret'], allowed_spells: [] });
  await activate(page, '#abracaSecretBtn', mobile);
  await render(page, { phase: 'wait_draw', legal_actions: ['end_turn'], allowed_spells: [] });
  await activate(page, '#abracaEndTurnBtn', mobile);
  assert.deepEqual(await page.evaluate(() => abracaTestActions.slice(-3)), [
    { type: 'roll_dice' }, { type: 'take_secret' }, { type: 'end_turn' },
  ]);
  await render(page);

  await activate(page, '#abracaHelpBtn', mobile);
  assert.equal(await page.locator('#abracaHelpModal').isVisible(), true);
  assert.match(await page.locator('#abracaHelpContent').textContent(), /Health \(❤️\)/);
  assert.match(await page.locator('#abracaHelpContent').textContent(), /Ancient Dragon \(🐉\)/);
  await checkBounds(page, `${width}px Help`);
  await page.keyboard.press('Tab');
  assert.equal(await page.evaluate(() => document.activeElement.id), 'abracaHelpModalCloseBtn');
  await page.keyboard.press('Escape');
  assert.equal(await page.locator('#abracaHelpModal').isVisible(), false);

  const beforeExplain = await actionCount();
  await activate(page, '#abracaExplainBtn', mobile);
  await activate(page, '#abracaEndTurnBtn', mobile);
  assert.equal(await explanation.isVisible(), true, 'Relocated End Turn still explains');
  assert.match(await page.locator('#abracaExplainContent').textContent(), /End Turn/);
  await page.keyboard.press('Escape');
  await activate(page, '#abracaExplainBtn', mobile);
  await page.locator('#abracaSpellBtn2').focus();
  await page.keyboard.press('Enter');
  assert.equal(await explanation.isVisible(), true, 'Keyboard Explain');
  assert.equal(await confirmation.isVisible(), false);
  assert.equal(await page.locator('#abracaExplainBtn').getAttribute('aria-pressed'), 'false');
  await page.keyboard.press('Escape');
  await activate(page, '#abracaExplainBtn', mobile);
  await pointActivate(page, '#abracaSpellBtn0', mobile);
  assert.equal(await explanation.isVisible(), true, 'Disabled buttons explain');
  assert.match(await page.locator('#abracaExplainContent').textContent(), /Ancient Dragon/);
  await checkBounds(page, `${width}px Explain`);
  await page.keyboard.press('Escape');
  await activate(page, '#abracaExplainBtn', mobile);
  await activate(page, '#abracaSpellBtn2', mobile);
  assert.equal(await explanation.isVisible(), true, 'Pointer Explain');
  await page.keyboard.press('Escape');
  await activate(page, '#abracaExplainBtn', mobile);
  await page.locator('#abracaActivity summary').click();
  assert.equal(await page.locator('#abracaActivity').getAttribute('open'), null, 'Explain blocks unrelated controls');
  await page.keyboard.press('Escape');
  assert.equal(await actionCount(), beforeExplain, 'Explain must never submit actions');

  const health = '#abracaPlayers .player-card:first-child .abraca-hp';
  if (mobile) await activate(page, health, true);
  else await page.locator(health).hover();
  assert.equal(await tooltip.isVisible(), true);
  assert.match(await tooltip.textContent(), /Health/);
  await checkBounds(page, `${width}px tooltip`);
  await activate(page, '#abracaPlayers .player-card:first-child .badge:first-child', mobile);
  assert.match(await tooltip.textContent(), /Score/, 'Newest tip replaces old tip');
  await page.waitForTimeout(3100);
  assert.equal(await tooltip.isVisible(), false, 'Tooltip expires after three seconds');

  await activate(page, '#abracaExplainBtn', mobile);
  await activate(page, health, mobile);
  assert.equal(await explanation.isVisible(), true, 'Symbols explain');
  assert.match(await page.locator('#abracaExplainContent').textContent(), /Health/);
  await page.keyboard.press('Escape');

  if (mobile) {
    const beforeSwipe = await actionCount();
    await swipe(page, '#abracaSpellBtn2');
    assert.equal(await confirmation.isVisible(), false, 'Scrolling must not select');
    assert.equal(await actionCount(), beforeSwipe);
    await activate(page, '#abracaSpellBtn2', true);
    await swipe(page, '#abracaCastConfirm');
    assert.equal(await confirmation.isVisible(), true, 'Scrolling keeps the current selection');
    assert.equal(await actionCount(), beforeSwipe);
    await page.keyboard.press('Escape');
    await activate(page, '#abracaExplainBtn', true);
    await swipe(page, '#abracaSpellBtn0');
    assert.equal(await explanation.isVisible(), false, 'Scrolling must not explain');
    assert.equal(await page.locator('#abracaExplainBtn').getAttribute('aria-pressed'), 'true');
    await page.keyboard.press('Escape');
  }

  const longPlayers = makeView().players.map((player, index) => ({
    ...player,
    name: index === 0 ? 'VeryLongUnbrokenPlayerNameToCheckMobileContainerOverflow' : '这是一位使用较长昵称的玩家用于检查换行',
  }));
  longPlayers[0].secret_cards = Array.from({ length: 12 }, (_, index) => ({ spell: index % 8, number: index % 8 + 1 }));
  longPlayers[0].secret_count = 12;
  await render(page, { players: longPlayers });
  await page.locator('#abracaActivity summary').click();
  await checkBounds(page, `${width}px long names and secrets`);
  await panelScreenshot(page, `long-names-${width}`);
  await render(page, { current_turn: 'p1', legal_actions: [], allowed_spells: [] });
  assert.equal(await page.locator('#abracaSpellButtons button:enabled').count(), 0);
  assert.equal(await page.locator('#abracaActionHint').textContent(), 'Watching the current turn');
  assert.equal(await page.locator('#abracaEndTurnBtn').isDisabled(), true);
  await activate(page, '#abracaExplainBtn', mobile);
  await pointActivate(page, '#abracaEndTurnBtn', mobile);
  assert.equal(await explanation.isVisible(), true, 'Disabled End Turn still explains');
  await page.keyboard.press('Escape');
  await render(page, { you: 'spectator', legal_actions: [], allowed_spells: [] });
  assert.equal(await page.locator('#abracaSpellButtons button:enabled').count(), 0);

  const result = { type: 'empty_hand', actor_id: 'p0', add_scores: { p0: 3, p1: 1, p2: 1, p3: 1, p4: 1 } };
  await render(page, { phase: 'round_end', round_result: result, legal_actions: ['start_next_round'], allowed_spells: [] });
  assert.equal(await page.locator('#abracaRoundNotice').isVisible(), true);
  const beforeNext = await actionCount();
  await activate(page, '#abracaNextRoundBtn', mobile);
  assert.equal(await actionCount(), beforeNext + 1, 'Next Round sends immediately');
  assert.equal(await confirmation.isVisible(), false);
  await checkBounds(page, `${width}px round result`);
  await render(page, { round: 3, phase: 'wait_use', legal_actions: ['cast_spell'], allowed_spells: [0, 1, 2, 3, 4, 5, 6, 7] });
  assert.equal(await page.locator('#abracaRoundNotice').isVisible(), false, 'Old results move to Activity');
  assert.match(await page.locator('#abracaRoundResult').textContent(), /Round 2/);
  await activate(page, '#abracaSpellBtn0', mobile);
  await checkBounds(page, `${width}px longest spell confirmation`);
  await page.keyboard.press('Escape');
  await render(page, { phase: 'game_over', game_over: true, winner: ['p0'], round_result: result, legal_actions: [], allowed_spells: [] });
  assert.equal(await page.locator('#abracaNewGameBtn').isVisible(), true);
  assert.equal(await page.locator('#abracaNextRoundBtn').isVisible(), false);
  await checkBounds(page, `${width}px game over`);

  await page.evaluate(() => clearAbracaState());
  assert.equal(await page.locator('#abracaSpellButtons button').count(), 8, 'Clearing keeps the controls');
  assert.equal(await page.locator('#abracaSpellButtons button:enabled').count(), 0);
  await render(page);
  if (mobile) {
    await page.setViewportSize({ width, height: 568 });
    await checkBounds(page, `${width}×568 short screen`);
    await activate(page, '#abracaHelpBtn', true);
    await checkBounds(page, `${width}×568 Help`);
    const dialog = await page.locator('.abraca-help-modal').boundingBox();
    assert(dialog.y >= 0 && dialog.y + dialog.height <= 568, 'Short-screen Help stays in view');
    await page.keyboard.press('Escape');
    await activate(page, '#abracaSpellBtn2', true);
    await checkBounds(page, `${width}×568 confirmation`);
    await activate(page, '#abracaCancelCastBtn', true);
    await page.setViewportSize({ width, height: 844 });
  }
}

(async () => {
  const browser = await chromium.launch({ channel: process.env.BROWSER_CHANNEL || 'chrome', headless: true });
  const errors = [];
  const measurements = {};
  try {
    for (const width of [320, 390, 1024, 1440]) {
      const context = await browser.newContext({
        viewport: { width, height: width <= 390 ? 844 : 900 },
        isMobile: width <= 390, hasTouch: width <= 390,
      });
      const page = await context.newPage();
      page.on('pageerror', error => errors.push(error.message));
      await page.route('https://fonts.googleapis.com/**', route => route.abort());
      await page.goto(base);
      await page.waitForFunction(() => typeof socket !== 'undefined' && socket.connected && cachedGameList);
      await page.evaluate(() => socket.emit('room:create', { name: 'Abraca UI QA', game_type: 'abraca_what' }));
      await page.waitForFunction(() => currentGameType === 'abraca_what' && isGameAssetsLoaded('abraca_what'));
      await page.evaluate(() => {
        window.abracaTestActions = [];
        sendAction = action => abracaTestActions.push(action);
        setRoomControlsCollapsed(true);
      });
      await render(page);
      await page.locator('#abracaPanel').scrollIntoViewIfNeeded();
      measurements[width] = await checkBounds(page, `${width}px`);
      await panelScreenshot(page, `${baseline ? 'before' : 'after'}-${width}`);
      if (!baseline) {
        if (width <= 390) assert(measurements[width].height < 660, 'Inline End Turn reduces five-player mobile height');
        await checkInteractions(page, width);
      }
      await context.close();
    }
    if (!baseline) {
      await checkLiveSession(browser, errors);
      await checkAssetRetry(browser, errors);
    }
    assert.deepEqual(errors, [], 'Browser errors');
    fs.writeFileSync(`${output}/${baseline ? 'before' : 'after'}-measurements.json`, JSON.stringify(measurements, null, 2));
    console.log(JSON.stringify(measurements, null, 2));
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
