const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const base = process.env.ROOM_TEST_URL || 'http://127.0.0.1:8766';
const output = 'tmp/scout-ui';
const scoutCard = (current, back) => ({ id: `${current}-${back}`, values: [current, back], face_up: 'a', current, back });
const hand = [6, 7, 8, 2, 2, 4, 5, 6, 9, 4, 10, 2].map((value, index) => scoutCard(value, value === 1 + index % 9 ? 10 : 1 + index % 9));
const players = Array.from({ length: 5 }, (_, index) => ({
  player_id: `p${index}`, name: ['Alice', 'Beatrice', 'Charlie', 'Dan', 'Evelyn'][index],
  score: index * 3 - 2, hand_count: 12 - index, captured_count: index,
  scout_points: index, scout_tokens_left: 3, scout_and_show_available: true, hand_ready: true,
}));
const playing = {
  game_id: 'scout', you: 'p0', phase: 'playing', variant: 'base', round: 1, total_rounds: 5,
  current_turn: 'p0', start_player: 'p1', players, your_hand: hand, legal_actions: ['show', 'scout', 'scout_and_show'],
  active_set: { owner_player_id: 'p1', owner_name: 'Beatrice', combo_type: 'run', length: 3, rank_value: 5, values: [3, 4, 5], cards: [scoutCard(3, 8), scoutCard(4, 9), scoutCard(5, 10)] },
  initial_hand_options: null, last_round_summary: null, game_over: false, winner: null,
};
const opening = {
  ...playing, phase: 'choose_orientation', active_set: null, your_hand: [], legal_actions: ['ready_hand'],
  initial_hand_options: { keep: hand, flip: [...hand].reverse().map(card => scoutCard(card.back, card.current)) },
  players: players.map(player => ({ ...player, hand_ready: player.player_id !== 'p0' })),
};
const summary = {
  round: 1, winner: 'p1', winner_name: 'Beatrice', reason: 'empty_hand', reason_label: 'Empty hand', variant: 'base',
  players: players.map(player => ({ ...player, name: player.name, round_points: player.score, total_score: player.score, winner: player.player_id === 'p1' })),
};

async function load(page) {
  await page.route('https://fonts.googleapis.com/**', route => route.abort());
  await page.goto(base);
  await page.waitForFunction(() => typeof socket !== 'undefined' && socket.connected && cachedGameList);
  await page.evaluate(() => socket.emit('room:create', { name: 'Scout UI QA', game_type: 'scout', config: { seed: 57 } }));
  await page.waitForFunction(() => roomSessionReady && isGameAssetsLoaded('scout'));
}

async function render(page, view) {
  await page.evaluate(view => {
    clearScoutSelection();
    scoutOpeningRound = null;
    scoutOpeningFlip = null;
    playerId = view.you;
    renderRoomState({ room_id: roomId, game_type: 'scout', status: 'in_game', host_id: 'p0', players: view.players, game_config: {} });
    setGamePanelVisibility('scout');
    renderScoutGameState({ view, events: [] });
    setRoomControlsCollapsed(true);
    window.scrollTo(0, 0);
  }, view);
}

async function bounds(page, label) {
  const issues = await page.evaluate(() => {
    const elements = [...document.querySelectorAll('#scoutPanel *, .game-panel > .panel-header *, .obg-help-dialog[open] *')];
    const bad = elements.filter(element => {
      const box = element.getBoundingClientRect();
      const style = getComputedStyle(element);
      if (!box.width || !box.height || element.closest('details:not([open])') && !element.matches('summary')) return false;
      return box.left < -1 || box.right > innerWidth + 1 || element.clientWidth && element.scrollWidth > element.clientWidth + 2 && !['auto', 'scroll', 'hidden', 'clip'].includes(style.overflowX);
    }).map(element => `${element.id || element.className}: ${element.textContent.slice(0, 40)}`);
    return { overflow: document.documentElement.scrollWidth > innerWidth, bad };
  });
  assert.deepEqual(issues, { overflow: false, bad: [] }, label);
}

async function captureActions(page) {
  await page.evaluate(() => {
    window.scoutTestActions = [];
    const original = socket.emit.bind(socket);
    socket.emit = (event, ...args) => event === 'game:action' ? scoutTestActions.push(args[0].action) : original(event, ...args);
  });
}

async function interactionChecks(page) {
  await render(page, playing);
  assert.equal(await page.locator('#scoutActiveSet button').count(), 2);
  assert.equal(await page.locator('#scoutActiveSet .scout-card').nth(1).evaluate(node => node.tagName), 'DIV');
  await page.locator('#scoutHand .scout-card').nth(0).click();
  await page.locator('#scoutHand .scout-card').nth(1).click();
  await page.locator('#scoutHand .scout-card').nth(2).click();
  assert.equal(await page.locator('#scoutHand .selected').count(), 3);
  assert.equal(await page.locator('#scoutShowBtn').isEnabled(), true);
  await page.locator('#scoutShowBtn').click();
  assert.deepEqual(await page.evaluate(() => scoutTestActions.at(-1)), { type: 'show', start_index: 0, end_index: 2 });
  await page.locator('#scoutHand').click({ position: { x: 2, y: 2 } });
  assert.equal(await page.locator('#scoutHand .selected').count(), 0);

  await page.locator('#scoutActiveSet button').first().click({ position: { x: 14, y: 60 } });
  await page.locator('#scoutHand .scout-gap-btn').nth(2).click();
  assert.equal(await page.locator('#scoutHand .scout-gap-btn.selected').count(), 1);
  assert.equal(await page.locator('#scoutScoutBtn').isEnabled(), true);
  if (!await page.locator('#scoutPreviewSection').evaluate(node => node.open)) await page.locator('#scoutPreviewSection summary').click();
  assert.equal(await page.locator('#scoutPreviewArea').isVisible(), true);
  assert.equal(await page.locator('#scoutPreviewArea .ghost .scout-card-current').textContent(), '8');
  await bounds(page, 'Scout insertion and preview');
  await page.screenshot({ path: `${output}/insertion-${page.viewportSize().width}.png`, fullPage: true });
  await page.locator('#scoutScoutBtn').click();
  assert.deepEqual(await page.evaluate(() => scoutTestActions.at(-1)), { type: 'scout', take_side: 'left', insert_index: 2, insert_face: 'b' });
  await page.locator('#scoutScoutShowBtn').click();
  assert.equal(await page.evaluate(() => scoutTestActions.at(-1).type), 'scout_and_show');

  await render(page, { ...playing, your_scout_and_show_pending: true, legal_actions: ['show', 'finish_scout_and_show'] });
  assert.equal(await page.locator('#scoutScoutShowBtn').textContent(), 'Finish Turn');
  await page.locator('#scoutScoutShowBtn').click();
  assert.equal(await page.evaluate(() => scoutTestActions.at(-1).type), 'finish_scout_and_show');

  await render(page, playing);
  await page.locator('#scoutHelpBtn').click();
  await page.locator('[data-obg-help-lang="en"]').click();
  await page.locator('[data-obg-help-tab="__basic"]').click();
  assert.equal(await page.locator('.obg-help-basic-row').count(), 3);
  assert.equal(await page.locator('.obg-help-tab').count(), 4);
  await page.locator('[data-obg-help-tab="scout"]').click();
  await bounds(page, 'Help dialog');
  await page.keyboard.press('Escape');
  assert.equal(await page.locator('.obg-help-dialog[open]').count(), 0);
  await page.locator('#scoutExplainBtn').click();
  await page.locator('.scout-table-details summary').click();
  assert.equal(await page.locator('.scout-table-details').evaluate(node => node.open), false);
  assert.equal(await page.evaluate(() => scoutExplainMode), true);
  const disabled = await page.locator('#scoutShowBtn').boundingBox();
  await page.mouse.click(disabled.x + disabled.width / 2, disabled.y + disabled.height / 2);
  assert.equal(await page.locator('.obg-explain-dialog[open]').count(), 1);
  assert.equal(await page.evaluate(() => scoutExplainMode), false);
  await page.keyboard.press('Escape');
  await page.locator('#scoutExplainBtn').click();
  await page.locator('#scoutActiveSet button').first().click();
  assert.match(await page.locator('.obg-explain-text').textContent(), /Current value 3.*Opposite face 8/);
  assert.equal(await page.locator('#scoutHand .scout-gap-btn').count(), 0);
  await page.keyboard.press('Escape');
  await page.locator('#scoutExplainBtn').click();
  await page.keyboard.press('Escape');
  assert.equal(await page.evaluate(() => scoutExplainMode), false);

  await render(page, { ...opening, round: 2, last_round_summary: summary });
  assert.equal(await page.locator('#scoutNextRoundBtn').isDisabled(), true);
  const before = await page.evaluate(() => scoutTestActions.length);
  await page.locator('#scoutOpening button').last().click();
  assert.equal(await page.evaluate(() => scoutTestActions.length), before);
  assert.equal(await page.locator('#scoutNextRoundBtn').isEnabled(), true);
  await page.locator('#scoutNextRoundBtn').click();
  assert.deepEqual(await page.evaluate(() => scoutTestActions.at(-1)), { type: 'ready_hand', flip: true });

  await render(page, playing);
  const selected = await page.locator('#scoutHand .scout-card').first().boundingBox();
  await page.evaluate(({ x, y }) => {
    const card = document.querySelector('#scoutHand .scout-card');
    card.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerId: 7, clientX: x, clientY: y }));
    document.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, pointerId: 7, clientX: x, clientY: y + 80 }));
    document.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, pointerId: 7, clientX: x, clientY: y + 80 }));
    card.dispatchEvent(new MouseEvent('click', { bubbles: true, detail: 1 }));
  }, selected);
  assert.equal(await page.locator('#scoutHand .selected').count(), 0);
}

async function liveRoundCheck(browser) {
  const contexts = await Promise.all([browser.newContext(), browser.newContext()]);
  try {
    const host = await contexts[0].newPage();
    const guest = await contexts[1].newPage();
    await load(host);
    const room = await host.evaluate(() => roomId);
    await guest.goto(base);
    await guest.waitForFunction(() => typeof socket !== 'undefined' && socket.connected);
    await guest.evaluate(room => socket.emit('room:join', { room_id: room, name: 'Guest' }), room);
    await guest.waitForFunction(() => roomSessionReady && isGameAssetsLoaded('scout'));
    for (const page of [host, guest]) await page.evaluate(() => socket.emit('room:ready', { room_id: roomId, ready: true }));
    await host.waitForFunction(() => !document.getElementById('startBtn').disabled);
    await host.evaluate(() => setRoomControlsCollapsed(false));
    await host.locator('#startBtn').click();
    for (const page of [host, guest]) {
      await page.waitForFunction(() => currentScoutView?.phase === 'choose_orientation');
      await page.locator('#scoutOpening button').first().click();
    }
    for (const page of [host, guest]) await page.waitForFunction(() => currentScoutView.phase === 'playing');
    const identities = await Promise.all([host.evaluate(() => playerId), guest.evaluate(() => playerId)]);
    for (let step = 0; step < 200; step += 1) {
      const view = await host.evaluate(() => currentScoutView);
      if (view.round === 2) break;
      const actor = view.current_turn === identities[0] ? host : guest;
      await actor.waitForFunction(() => currentScoutView.current_turn === playerId);
      const move = await actor.evaluate(() => {
        const best = scoutBestShowMove(currentScoutView.your_hand, currentScoutView.active_set);
        if (best) return { type: 'show', start_index: best.start, end_index: best.end };
        return { type: 'scout', take_side: 'left', insert_index: 0, insert_face: 'a' };
      });
      const previous = await actor.evaluate(() => JSON.stringify(currentScoutView));
      await actor.evaluate(move => sendAction(move), move);
      await actor.waitForFunction(previous => JSON.stringify(currentScoutView) !== previous, previous);
    }
    for (const page of [host, guest]) await page.waitForFunction(() => currentScoutView.round === 2 && currentScoutView.phase === 'choose_orientation');
    await host.locator('#scoutOpening button').first().click();
    await host.locator('#scoutNextRoundBtn').click();
    await host.waitForFunction(() => !currentScoutView.initial_hand_options);
    assert.equal(await host.evaluate(() => currentScoutView.phase), 'choose_orientation');
    await guest.locator('#scoutOpening button').last().click();
    assert.equal(await guest.evaluate(() => currentScoutView.phase), 'choose_orientation');
    await guest.locator('#scoutNextRoundBtn').click();
    for (const page of [host, guest]) await page.waitForFunction(() => currentScoutView.round === 2 && currentScoutView.phase === 'playing');
    await host.reload();
    await host.waitForFunction(() => isGameAssetsLoaded('scout') && currentScoutView?.round === 2);
    console.log('PASS live two-player actions, all-player round barrier and reconnect replay');
  } finally {
    for (const context of contexts) await context.close();
  }
}

(async () => {
  fs.mkdirSync(output, { recursive: true });
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const errors = [];
  try {
    const page = await browser.newPage();
    page.on('pageerror', error => errors.push(error.message));
    await load(page);
    await captureActions(page);
    for (const width of [320, 390, 1024, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      const states = {
        opening,
        playing,
        waiting: { ...playing, current_turn: 'p2', legal_actions: [] },
        duel: { ...playing, variant: 'duel', total_rounds: 2, players: players.slice(0, 2), legal_actions: ['show', 'scout'] },
        review: { ...opening, round: 2, last_round_summary: summary },
        over: { ...playing, phase: 'game_over', game_over: true, winner: ['p1'], last_round_summary: summary, legal_actions: [] },
        spectator: { ...playing, you: 'visitor', your_hand: [], legal_actions: [] },
        long: { ...playing, players: players.map(player => ({ ...player, name: '很长的玩家名字ABCDEFGHIJKLMNOPQRSTUVWXYZ' })), active_set: { ...playing.active_set, owner_name: '很长的玩家名字ABCDEFGHIJKLMNOPQRSTUVWXYZ' } },
      };
      for (const [key, view] of Object.entries(states)) {
        await render(page, view);
        await bounds(page, `${width}px ${key}`);
        if (['opening', 'playing', 'review', 'long'].includes(key)) await page.screenshot({ path: `${output}/${key}-${width}.png`, fullPage: true });
      }
      await interactionChecks(page);
      console.log(`PASS ${width}px layout, selection, Scout, special, Help, Explain, round review and scroll guard`);
    }
    const touch = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
    const mobile = await touch.newPage();
    await load(mobile);
    await render(mobile, playing);
    await mobile.locator('#scoutPlayers .scout-player-stats span').first().tap();
    assert.equal(await mobile.locator('#scoutTooltip').isVisible(), true);
    await mobile.locator('#scoutPlayers .scout-player-stats span').nth(1).tap();
    assert.match(await mobile.locator('#scoutTooltip').textContent(), /Captures/);
    await mobile.waitForTimeout(3200);
    assert.equal(await mobile.locator('#scoutTooltip').isVisible(), false);
    await mobile.locator('#scoutHand .scout-card').first().tap();
    assert.equal(await mobile.locator('#scoutTooltip').isVisible(), false);
    await render(mobile, playing);
    const touchPoint = await mobile.locator('#scoutHand .scout-card').first().boundingBox();
    const session = await touch.newCDPSession(mobile);
    await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: touchPoint.x + 20, y: touchPoint.y + 20 }] });
    for (let step = 1; step <= 8; step += 1) {
      await session.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: touchPoint.x + 20, y: touchPoint.y + 20 - step * 20 }] });
    }
    await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await mobile.waitForTimeout(250);
    assert.equal(await mobile.locator('#scoutHand .selected').count(), 0);
    assert.ok(await mobile.evaluate(() => scrollY > 0), 'swiping cards preserves normal page scrolling');
    await touch.close();
    await liveRoundCheck(browser);
    assert.deepEqual(errors, []);
    console.log('PASS touch tooltips, three-second dismissal, action isolation and browser errors');
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exit(1); });
