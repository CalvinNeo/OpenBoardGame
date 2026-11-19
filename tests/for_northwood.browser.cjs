const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const base = process.env.ROOM_TEST_URL || 'http://127.0.0.1:8766';
const output = 'tmp/for-northwood-ui';
const widths = [320, 390, 1024, 1440];

async function layout(page, label) {
  const issues = await page.evaluate(() => {
    const bad = [];
    const elements = document.querySelectorAll('#forNorthwoodPanel *, .game-panel > .panel-header *, dialog[open].obg-help-dialog *');
    for (const node of elements) {
      const box = node.getBoundingClientRect();
      if (!box.width || !box.height || node.closest('dialog:not([open])')) continue;
      if (node.closest('details:not([open])') && !node.closest('summary')) continue;
      if (node.closest('.hidden')) continue;
      const style = getComputedStyle(node);
      if (box.left < -1 || box.right > innerWidth + 1) bad.push(`${node.id || node.className}: outside viewport`);
      if (node.clientWidth && node.scrollWidth > node.clientWidth + 2 && !['auto', 'scroll', 'hidden', 'clip'].includes(style.overflowX)) {
        bad.push(`${node.id || node.className}: content overflow ${node.scrollWidth}/${node.clientWidth}`);
      }
    }
    for (const selector of ['.nw-fiefs', '.nw-allies', '.nw-hand']) {
      const cards = [...document.querySelector(selector).children].map(node => node.getBoundingClientRect());
      for (let first = 0; first < cards.length; first += 1) {
        for (let second = first + 1; second < cards.length; second += 1) {
          const left = cards[first], right = cards[second];
          if (Math.min(left.right, right.right) - Math.max(left.left, right.left) > 1
              && Math.min(left.bottom, right.bottom) - Math.max(left.top, right.top) > 1) bad.push(`${selector}: overlapping cards`);
        }
      }
    }
    const headerButtons = ['gameReconnectBtn', 'forNorthwoodHelpBtn'].map(id => document.getElementById(id).getBoundingClientRect()).filter(box => box.width && box.height);
    const centers = headerButtons.map(box => box.top + box.height / 2);
    if (Math.max(...centers) - Math.min(...centers) > 3) bad.push('Help/Reconnect are not on one line');
    return { pageOverflow: document.documentElement.scrollWidth > innerWidth, bad };
  });
  if (issues.pageOverflow || issues.bad.length) {
    await page.screenshot({ path: `${output}/failure-${label.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}.png`, fullPage: true });
  }
  assert.deepEqual(issues, { pageOverflow: false, bad: [] }, label);
}

async function waitPhase(page, phase) {
  await page.waitForFunction(phase => lastGameStatePayload?.game_type === 'for_northwood' && lastGameStatePayload.view.phase === phase, phase);
}

async function fakeRender(page, view) {
  await page.evaluate(view => {
    renderForNorthwoodGameState({ game_type: 'for_northwood', room_id: roomId, view });
    window.scrollTo(0, 0);
  }, view);
}

(async () => {
  fs.mkdirSync(output, { recursive: true });
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const context = await browser.newContext({ viewport: { width: 390, height: 900 }, hasTouch: true });
  const page = await context.newPage();
  const errors = [];
  const systemErrors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.route('https://fonts.googleapis.com/**', route => route.abort());
  try {
    await page.goto(base);
    await page.waitForFunction(() => typeof socket !== 'undefined' && socket.connected && cachedGameList);
    assert.equal(await page.locator('#forNorthwoodPanel').evaluate(node => node.children.length), 0);
    assert.equal(await page.locator('script[src*="/for_northwood.js"]').count(), 0);
    await page.evaluate(() => {
      socket.on('system:error', data => { window.northwoodTestSystemErrors = [...(window.northwoodTestSystemErrors || []), data.message]; });
      socket.emit('room:create', { name: 'Northwood browser QA', game_type: 'for_northwood' });
    });
    await page.waitForFunction(() => roomSessionReady && currentGameType === 'for_northwood' && isGameAssetsLoaded('for_northwood'));
    await page.locator('#forNorthwoodLobby').waitFor({ state: 'visible' });
    await page.locator('#forNorthwoodSetup').selectOption('standard');
    await page.locator('#forNorthwoodGoal').selectOption('18');
    await page.evaluate(() => setRoomControlsCollapsed(false));
    await page.locator('#startBtn').click();
    await waitPhase(page, 'choose_fief');
    assert.deepEqual(await page.evaluate(() => lastGameStatePayload.view.config), { setup: 'standard', goal: 18 });
    await page.evaluate(() => setRoomControlsCollapsed(true));
    const credentials = await page.evaluate(() => ({ room_id: roomId, ...getRoomAuth(roomId) }));

    for (const width of widths) {
      await page.setViewportSize({ width, height: 900 });
      await page.evaluate(() => window.scrollTo(0, 0));
      await layout(page, `Live choose-fief ${width}`);
      await page.screenshot({ path: `${output}/choose-${width}.png`, fullPage: true });
    }

    await page.setViewportSize({ width: 390, height: 900 });
    await page.locator('#forNorthwoodHelpBtn').click();
    const help = page.locator('dialog[data-obg-help-game="for_northwood"]');
    await help.waitFor({ state: 'visible' });
    await help.locator('[data-obg-help-lang="en"]').click();
    await help.locator('[data-obg-help-tab="visits"]').click();
    for (const icon of ['🌲', '🍂', '🏆']) assert.ok((await help.innerText()).includes(icon));
    await help.locator('[data-obg-help-lang="zh"]').click();
    for (const icon of ['🌲', '🍂', '🏆']) assert.ok((await help.innerText()).includes(icon));
    await help.locator('[data-obg-help-lang="en"]').click();
    await help.locator('[data-obg-help-tab="characters"]').click();
    assert.equal(await help.locator('dt').count(), 24);
    await layout(page, 'English full ability reference');
    await help.locator('[data-obg-help-lang="zh"]').click();
    assert.equal(await help.locator('dt').count(), 24);
    await page.keyboard.press('Escape');
    await help.waitFor({ state: 'hidden' });

    await page.locator('#forNorthwoodExplainBtn').click();
    const disabledDeck = await page.locator('#forNorthwoodDeckBtn').boundingBox();
    await page.mouse.click(disabledDeck.x + disabledDeck.width / 2, disabledDeck.y + disabledDeck.height / 2);
    await page.locator('.obg-explain-text').waitFor({ state: 'visible' });
    assert.equal(await page.locator('#forNorthwoodExplainBtn').getAttribute('aria-pressed'), 'false');
    assert.match(await page.locator('.obg-explain-text').innerText(), /牌库|deck/);
    await page.keyboard.press('Escape');
    await page.locator('#forNorthwoodExplainBtn').click();
    await page.keyboard.press('Escape');
    assert.equal(await page.locator('#forNorthwoodExplainBtn').getAttribute('aria-pressed'), 'false');

    const statusBox = await page.locator('#forNorthwoodStars').boundingBox();
    await page.touchscreen.tap(statusBox.x + statusBox.width / 2, statusBox.y + statusBox.height / 2);
    await page.locator('#forNorthwoodTooltip').waitFor({ state: 'visible' });
    await page.locator('#forNorthwoodTooltip').waitFor({ state: 'hidden', timeout: 4500 });

    const fief = page.locator('#forNorthwoodFiefs button').nth(4);
    await fief.click();
    assert.equal(await page.evaluate(() => lastGameStatePayload.view.phase), 'choose_fief');
    await page.locator('#forNorthwoodFiefConfirm button').filter({ hasText: /^Visit$/ }).click();
    await waitPhase(page, 'prepare');
    await page.locator('#forNorthwoodDialogueControls button').click();
    await waitPhase(page, 'before_trick');
    await page.locator('#forNorthwoodDeckBtn').click();
    await waitPhase(page, 'respond');
    const reconnectSnapshot = await page.evaluate(() => ({ hand: lastGameStatePayload.view.hand, statement: lastGameStatePayload.view.statement }));
    await page.reload();
    await page.waitForFunction(room => roomSessionReady && roomId === room && isGameAssetsLoaded('for_northwood') && lastGameStatePayload?.view?.phase === 'respond', credentials.room_id);
    assert.deepEqual(await page.evaluate(() => ({ hand: lastGameStatePayload.view.hand, statement: lastGameStatePayload.view.statement })), reconnectSnapshot);
    for (const width of widths) {
      await page.setViewportSize({ width, height: 900 });
      await page.evaluate(() => { setRoomControlsCollapsed(true); window.scrollTo(0, 0); });
      await layout(page, `Respond after reconnect ${width}`);
      await page.screenshot({ path: `${output}/respond-${width}.png`, fullPage: true });
    }
    await page.locator('#forNorthwoodHand button:not(:disabled)').first().click();
    await page.locator('#forNorthwoodHandConfirm .nw-primary').click();
    await page.waitForFunction(() => ['trick_review', 'visit_review'].includes(lastGameStatePayload.view.phase));
    const reviewVersion = await page.evaluate(() => lastGameStatePayload.state_version);
    await page.waitForTimeout(250);
    assert.equal(await page.evaluate(() => lastGameStatePayload.state_version), reviewVersion);
    await page.locator('#forNorthwoodDiscardBtn').click();
    await page.locator('#forNorthwoodPileDialog').waitFor({ state: 'visible' });
    await layout(page, 'Discard pile modal');
    await page.keyboard.press('Escape');
    await page.locator('#forNorthwoodPileDialog').waitFor({ state: 'hidden' });

    const liveView = await page.evaluate(() => structuredClone(lastGameStatePayload.view));
    const sample = structuredClone(liveView);
    sample.phase = 'before_trick';
    sample.legal_actions = ['reveal', 'use_ability'];
    sample.ability_used = false;
    sample.pending = null;
    sample.statement = null;
    sample.last_trick = null;
    sample.current_fief = 4;
    sample.trump = 'leaves';
    sample.stars = 9;
    sample.active_allies = ['jack_claws', 'jack_flowers', 'jack_eyes', 'jack_leaves'].map(character => ({ character, exhausted: false, borrowed_from: null }));
    sample.fiefs = sample.fiefs.map((fief, index) => ({ ...fief, status: index < 3 ? 'friendly' : index === 7 ? 'lost' : 'unvisited', spent: index === 0 }));
    sample.hand = ['claws_1', 'claws_8', 'flowers_2', 'flowers_7', 'eyes_3', 'eyes_6', 'leaves_4', 'leaves_5'];
    sample.hand_count = sample.hand.length;
    sample.score = ['flowers_1', 'eyes_2'];
    sample.discard = ['eyes_8', 'leaves_8'];
    sample.known_top = ['claws_3', 'flowers_3', 'eyes_4'];
    sample.history = [
      { fief: 0, target: 0, score: 0, stars: 4, success: true },
      { fief: 1, target: 1, score: 1, stars: 3, success: true },
      { fief: 2, target: 2, score: 2, stars: 2, success: true },
      { fief: 7, target: 7, score: 6, stars: 0, success: false }
    ];
    sample.log = Array.from({ length: 80 }, (unused, index) => `Dialogue ${index + 1}: the envoy and the ruler discuss the forest.`);
    await page.evaluate(() => {
      window.northwoodOriginalSendAction = sendAction;
      window.northwoodRecordedActions = [];
      window.sendAction = action => northwoodRecordedActions.push(action);
    });

    for (const width of widths) {
      await page.setViewportSize({ width, height: 900 });
      await fakeRender(page, sample);
      await layout(page, `Mixed fiefs, known deck, allies ${width}`);
      await page.screenshot({ path: `${output}/table-${width}.png`, fullPage: true });
    }

    await page.setViewportSize({ width: 390, height: 900 });
    await fakeRender(page, sample);
    await page.locator('#forNorthwoodAllies button').nth(2).click();
    assert.equal(await page.locator('#forNorthwoodTooltip').isVisible(), false);
    await layout(page, 'Ally ability inline confirmation');
    assert.match(await page.locator('#forNorthwoodAllyConfirm').innerText(), /Draw two/);
    await page.locator('#forNorthwoodAllyConfirm .nw-primary').click();
    assert.deepEqual(await page.evaluate(() => northwoodRecordedActions.at(-1)), { type: 'use_ability', slot: 2 });

    const multi = { ...structuredClone(sample), phase: 'ability', legal_actions: ['ability_cards'], pending: { kind: 'discard_two', count: 2, eligible: sample.hand } };
    await fakeRender(page, multi);
    const chosen = page.locator('#forNorthwoodHand button');
    const handBefore = await page.locator('#forNorthwoodHand').evaluate(node => ({ top: node.scrollTop, first: node.firstElementChild.dataset.nwCard }));
    await chosen.nth(5).click();
    await chosen.nth(1).click();
    assert.deepEqual(await page.locator('#forNorthwoodHand').evaluate(node => ({ top: node.scrollTop, first: node.firstElementChild.dataset.nwCard })), handBefore);
    await page.locator('#forNorthwoodHandConfirm .nw-primary').click();
    assert.deepEqual(await page.evaluate(() => northwoodRecordedActions.at(-1)), { type: 'ability_cards', cards: ['eyes_6', 'claws_8'] });
    await fakeRender(page, multi);
    await page.locator('#forNorthwoodHand button').first().click();
    await page.locator('.nw-hand-section .nw-caption h3').click();
    assert.equal(await page.locator('#forNorthwoodHand .nw-selected').count(), 0);
    assert.equal(await page.locator('#forNorthwoodHandConfirm').isVisible(), false);

    const prepare = { ...structuredClone(sample), phase: 'prepare', legal_actions: ['substitute', 'return_ally', 'start_visit'] };
    await fakeRender(page, prepare);
    await page.locator('#forNorthwoodFiefs button').nth(1).click();
    await page.locator('#forNorthwoodAllies button').nth(0).click();
    await page.locator('#forNorthwoodAllyConfirm .nw-primary').click();
    assert.deepEqual(await page.evaluate(() => northwoodRecordedActions.at(-1)), { type: 'substitute', slot: 0, fief: 1 });
    prepare.active_allies[0] = { character: prepare.fiefs[1].ruler, exhausted: false, borrowed_from: 1 };
    prepare.borrowed = [1];
    await fakeRender(page, prepare);
    await page.locator('#forNorthwoodAllies button').nth(0).click();
    await page.locator('#forNorthwoodAllyConfirm .nw-primary').click();
    assert.deepEqual(await page.evaluate(() => northwoodRecordedActions.at(-1)), { type: 'return_ally', slot: 0 });

    const pendingCases = [
      { kind: 'sum_drawn', total: 12, eligible: sample.hand },
      { kind: 'forced', count: 3, eligible: sample.hand.slice(0, 3), pile: 'score' },
      { kind: 'exchange_top', count: 1, eligible: sample.hand, revealed: 'eyes_8' },
      { kind: 'cycle', count: 1, eligible: sample.hand, remaining: 4 },
      { kind: 'baron_swap', count: 1, eligible: sample.hand, pile: 'discard', optional: true },
      { kind: 'name_suit', suits: Object.keys(sample.suits) },
      { kind: 'draw_until', last_draw: 'eyes_1' },
      { kind: 'refresh', slots: [1, 2] },
      { kind: 'swap_ruler', fiefs: [3, 5, 6] },
      { kind: 'move_visit', fiefs: [3, 5] },
      { kind: 'parity_discard', count: 1, eligible: sample.hand }
    ];
    for (const width of widths) {
      await page.setViewportSize({ width, height: 900 });
      for (const pending of pendingCases) {
        const actions = pending.eligible ? ['ability_cards', ...(pending.optional ? ['ability_decision'] : [])]
          : [({ name_suit: 'ability_suit', draw_until: 'ability_decision', refresh: 'ability_ally', swap_ruler: 'ability_fief', move_visit: 'ability_fief' })[pending.kind]];
        await fakeRender(page, { ...structuredClone(sample), phase: 'ability', pending, legal_actions: actions });
        await layout(page, `${pending.kind} ${width}`);
      }
      const huge = { ...structuredClone(multi), hand: Object.keys(sample.cards), hand_count: 32 };
      huge.pending = { kind: 'forced', count: 32, pile: 'discard', eligible: huge.hand };
      await fakeRender(page, huge);
      await layout(page, `32-card scrollable hand ${width}`);
      const handBounds = await page.locator('#forNorthwoodHand').evaluate(node => ({ height: node.clientHeight, scroll: node.scrollHeight }));
      assert(handBounds.height <= 332, JSON.stringify(handBounds));
      await page.locator('#forNorthwoodHand').evaluate(node => { node.scrollTop = 90; });
      const scrollBefore = await page.locator('#forNorthwoodHand').evaluate(node => node.scrollTop);
      await page.locator('#forNorthwoodHand button').nth(width < 760 ? 8 : 16).click();
      assert.equal(await page.locator('#forNorthwoodHand').evaluate(node => node.scrollTop), scrollBefore);
      await page.locator('#forNorthwoodHandConfirm .nw-cancel').click();
      assert.equal(await page.locator('#forNorthwoodHand .nw-selected').count(), 0);
    }

    await page.setViewportSize({ width: 390, height: 900 });
    const scrollable = { ...structuredClone(multi), hand: Object.keys(sample.cards), hand_count: 32 };
    scrollable.pending = { kind: 'forced', count: 32, pile: 'discard', eligible: scrollable.hand };
    await fakeRender(page, scrollable);
    await page.locator('#forNorthwoodHand').evaluate(node => { node.scrollTop = 0; });
    await page.locator('#forNorthwoodHand').scrollIntoViewIfNeeded();
    const touchBox = await page.locator('#forNorthwoodHand').boundingBox();
    const startY = Math.min(650, touchBox.y + 70);
    const touchX = touchBox.x + 28;
    const cdp = await context.newCDPSession(page);
    await cdp.send('Input.synthesizeScrollGesture', {
      x: touchX, y: startY, yDistance: -150, xDistance: 0, gestureSourceType: 'touch', speed: 400
    });
    await page.waitForFunction(() => document.getElementById('forNorthwoodHand').scrollTop > 0, null, { timeout: 3000 });
    await cdp.detach();
    assert.equal(await page.locator('#forNorthwoodHand .nw-selected').count(), 0);
    assert.equal(await page.locator('#forNorthwoodHandConfirm').isVisible(), false);
    assert(await page.locator('#forNorthwoodHand').evaluate(node => node.scrollTop) > 0);

    const exhausted = structuredClone(sample);
    exhausted.active_allies[0].exhausted = true;
    await fakeRender(page, exhausted);
    await page.locator('#forNorthwoodExplainBtn').click();
    const exhaustedBox = await page.locator('#forNorthwoodAllies button').first().boundingBox();
    const actionCount = await page.evaluate(() => northwoodRecordedActions.length);
    await page.mouse.click(exhaustedBox.x + exhaustedBox.width / 2, exhaustedBox.y + exhaustedBox.height / 2);
    await page.locator('.obg-explain-text').waitFor({ state: 'visible' });
    assert.match(await page.locator('.obg-explain-text').innerText(), /耗竭|exhausted/);
    assert.equal(await page.evaluate(() => northwoodRecordedActions.length), actionCount);
    await page.keyboard.press('Escape');

    const results = { ...structuredClone(sample), phase: 'visit_review', pending: null, legal_actions: ['next_round'] };
    for (const width of widths) {
      await page.setViewportSize({ width, height: 900 });
      await fakeRender(page, results);
      await layout(page, `Visit result ${width}`);
      await fakeRender(page, { ...structuredClone(results), phase: 'game_over', game_over: true, winner: [sample.player_id], legal_actions: [] });
      await layout(page, `Final result ${width}`);
    }

    await page.evaluate(() => { window.sendAction = northwoodOriginalSendAction; });
    await fakeRender(page, liveView);
    await page.evaluate(() => socket.emit('room:create', { name: 'Switch QA', game_type: 'cabo' }));
    await page.waitForFunction(() => currentGameType === 'cabo' && isGameAssetsLoaded('cabo'));
    assert.equal(await page.locator('#forNorthwoodPanel').isVisible(), false);
    await page.evaluate(credentials => socket.emit('room:reconnect', credentials), credentials);
    await page.waitForFunction(room => roomId === room && currentGameType === 'for_northwood' && lastGameStatePayload?.room_id === room, credentials.room_id);
    await page.locator('#forNorthwoodTable').waitFor({ state: 'visible' });
    assert.equal(await page.locator('script[src*="/for_northwood.js"]').count(), 1);
    assert.equal(await page.locator('#forNorthwoodHelpBtn').count(), 1);
    let finalPause = false;
    for (let step = 0; step < 300; step += 1) {
      const snapshot = await page.evaluate(() => ({ view: lastGameStatePayload.view, version: lastGameStatePayload.state_version }));
      if (snapshot.view.game_over) break;
      if (snapshot.view.phase === 'visit_review' && snapshot.view.history.length === 8) {
        finalPause = true;
        await page.waitForTimeout(150);
        assert.equal(await page.evaluate(() => lastGameStatePayload.state_version), snapshot.version);
        await page.locator('#forNorthwoodDialogueControls .nw-primary').click();
      } else {
        const action = await page.evaluate(() => {
          const view = lastGameStatePayload.view;
          let action;
          if (view.phase === 'choose_fief') action = { type: 'choose_fief', fief: view.fiefs.findIndex(fief => fief.status === 'unvisited') };
          else if (view.phase === 'prepare') action = { type: 'start_visit' };
          else if (view.phase === 'before_trick') action = { type: 'reveal' };
          else if (view.phase === 'respond') action = { type: 'play', card: view.legal_cards[0] };
          else if (view.phase === 'trick_review') action = { type: 'next_trick' };
          else if (view.phase === 'visit_review') action = { type: 'next_round' };
          if (action) socket.emit('game:action', { room_id: roomId, action });
          return action;
        });
        assert(action, `Unhandled live phase ${snapshot.view.phase}`);
      }
      await page.waitForFunction(version => lastGameStatePayload.state_version > version, snapshot.version);
    }
    assert(finalPause);
    assert.equal(await page.evaluate(() => lastGameStatePayload.view.phase), 'game_over');
    assert.equal(await page.evaluate(() => lastGameStatePayload.view.history.length), 8);
    assert.equal(await page.evaluate(() => currentRoomState.status), 'game_over');
    systemErrors.push(...await page.evaluate(() => window.northwoodTestSystemErrors || []));
    assert.deepEqual(systemErrors, []);
    assert.deepEqual(errors, []);
    console.log('PASS: lazy loading, live start/config, four widths, bilingual Help, 24 abilities, disabled Explain, Escape, touch tooltip, card order, substitutions, multi-step choices, long-hand scrolling, touch-scroll cancellation, pauses, reload/reconnect, game switching and a complete eight-visit game.');
    console.log(`Screenshots: ${output}`);
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
