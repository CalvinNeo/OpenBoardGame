const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { execFileSync } = require('node:child_process');
const base = process.env.ROOM_TEST_URL || 'http://127.0.0.1:8776';
const output = 'tmp/felix-ui';
fs.mkdirSync(output, { recursive: true });
const views = JSON.parse(execFileSync(process.env.PYTHON || 'python3', ['-c', `
import copy, json, random
from game.felix import FelixGame as Game, _begin_choose_card, _build_card_set, _resolve_round_win
random.seed(81)
players = [{'player_id': 'p' + str(index), 'name': name, 'seat': index, 'is_bot': False} for index, name in enumerate(['Alex', 'Beatrice', 'Celine', 'Dominic', 'Evelyn'])]
views = {}
def save(key, state, viewer='p0'):
    views[key] = Game.get_public_view(state, viewer)
def choose_all(state):
    while state['phase'] == 'choose_card':
        player = state['current_turn']
        _, error = Game.apply_action(state, player, {'type': 'choose_card', 'card_id': state['players'][player]['hand'][0]['id']})
        assert error is None, error
def act(state, action):
    _, error = Game.apply_action(state, state['current_turn'], action)
    assert error is None, error
state = Game.init_game({}, players)
state.update(start_player='p0', round=0)
_begin_choose_card(state)
save('choose', state)
save('spectator_choose', state, 'spectator')
one_card = copy.deepcopy(state)
one_card['round'] = 9
for player in one_card['players'].values():
    player['hand'] = player['hand'][-1:]
save('choose_one', one_card)
waiting = copy.deepcopy(state)
act(waiting, {'type': 'choose_card', 'card_id': waiting['players']['p0']['hand'][0]['id']})
save('choose_waiting', waiting)
choose_all(state)
save('auction', state)
save('spectator', state, 'spectator')
act(state, {'type': 'bid', 'amount': 2})
save('waiting', state)
act(state, {'type': 'bid', 'amount': 3})
for index in range(3):
    act(state, {'type': 'pass'})
save('raise', state)
empty = copy.deepcopy(state)
empty['players']['p0']['mice'] = 0
save('empty', empty)
act(state, {'type': 'pass'})
save('summary', state)
_, error = Game.apply_action(state, 'p0', {'type': 'next_round'})
assert error is None, error
save('ready', state)
last = Game.init_game({}, players)
last.update(start_player='p1', round=0)
_begin_choose_card(last)
choose_all(last)
for index in range(4):
    act(last, {'type': 'pass'})
save('last_chance', last)
zero = copy.deepcopy(last)
zero['players']['p0']['mice'] = 0
save('last_chance_empty', zero)
act(last, {'type': 'pass'})
save('no_sale', last)
crowded = copy.deepcopy(state)
crowded['player_meta']['p0']['name'] = 'AlexandertheGreatWithAnExtremelyLongUnbrokenName'
crowded['player_meta']['p1']['name'] = '非常非常长的玩家名字用于移动端布局验收'
save('long_names', crowded)
crowded['round'] = 9
for player in crowded['players'].values():
    player['won_cards'] = _build_card_set(player['color']) * 3
    player['hand'] = []
_resolve_round_win(crowded, 'p0', 2)
save('over', crowded)
for count in [3, 4]:
    smaller = Game.init_game({}, players[:count])
    smaller.update(start_player='p0', round=0)
    _begin_choose_card(smaller)
    save('choose_' + str(count), smaller)
    choose_all(smaller)
    save('auction_' + str(count), smaller)
print(json.dumps(views))
`], { encoding: 'utf8' }));

async function render(page, key) {
  await page.evaluate(view => {
    currentGameType = 'felix';
    setGamePanelVisibility('felix');
    renderFelixGameState({ view });
    setRoomControlsCollapsed(true);
  }, views[key]);
}

async function bounds(page, label) {
  const issues = await page.evaluate(() => {
    const issues = [];
    if (document.documentElement.scrollWidth > innerWidth + 1) issues.push('page horizontal overflow');
    for (const node of document.querySelectorAll('#felixPanel *, .game-panel > .panel-header, .felix-dialog[open], .felix-dialog[open] *')) {
      if (!node.checkVisibility()) continue;
      const box = node.getBoundingClientRect();
      if (box.width < 1 || box.height < 1) continue;
      if (box.left < -1 || box.right > innerWidth + 1) issues.push(`${node.id || node.className} outside viewport`);
      const style = getComputedStyle(node);
      if (node.scrollWidth > node.clientWidth + 2 && style.overflowX === 'visible') issues.push(`${node.id || node.className} content overflow`);
      if (node.classList.contains('felix-card')) {
        for (const child of node.children) {
          const childBox = child.getBoundingClientRect();
          if (childBox.top < box.top - 1 || childBox.bottom > box.bottom + 1 || childBox.left < box.left - 1 || childBox.right > box.right + 1) issues.push('card content outside card');
        }
      }
    }
    for (const [firstSelector, secondSelector] of [['.felix-sack', '.felix-hand-section'], ['.felix-play-area', '.felix-player-section'], ['#felixTableSlots', '#felixAuction'], ['#felixNotice', '.felix-play-area']]) {
      const first = document.querySelector(firstSelector);
      const second = document.querySelector(secondSelector);
      if (!first.checkVisibility() || !second.checkVisibility()) continue;
      const firstBox = first.getBoundingClientRect();
      const secondBox = second.getBoundingClientRect();
      if (Math.min(firstBox.right, secondBox.right) - Math.max(firstBox.left, secondBox.left) > 1 && Math.min(firstBox.bottom, secondBox.bottom) - Math.max(firstBox.top, secondBox.top) > 1) issues.push(`${firstSelector} overlaps ${secondSelector}`);
    }
    const buttons = ['#gameReconnectBtn', '#felixHelpBtn'].map(selector => document.querySelector(selector).getBoundingClientRect());
    if (Math.abs(buttons[0].top - buttons[1].top) > 10) issues.push('header buttons wrap');
    return issues;
  });
  assert.deepEqual(issues, [], label);
}

async function pointClick(page, locator) {
  await locator.scrollIntoViewIfNeeded();
  const box = await locator.boundingBox();
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
}

async function swipe(page, locator) {
  await locator.scrollIntoViewIfNeeded();
  const box = await locator.boundingBox();
  const clientX = box.x + box.width / 2;
  const clientY = box.y + box.height / 2;
  const session = await page.context().newCDPSession(page);
  await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: clientX, y: clientY }] });
  for (const distance of [15, 35, 60, 85]) {
    await session.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: clientX, y: clientY - distance }] });
  }
  await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await session.detach();
  await page.evaluate(() => new Promise(resolve => {
    let lastScroll = scrollY;
    let stableFrames = 0;
    function checkScroll() {
      stableFrames = scrollY === lastScroll ? stableFrames + 1 : 0;
      lastScroll = scrollY;
      if (stableFrames >= 10) resolve();
      else requestAnimationFrame(checkScroll);
    }
    requestAnimationFrame(checkScroll);
  }));
}

(async () => {
  const browser = await chromium.launch({ channel: process.env.BROWSER_CHANNEL || 'chrome', headless: true });
  const errors = [];
  try {
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
    const page = await context.newPage();
    page.on('pageerror', error => errors.push(error.message));
    await page.route('https://fonts.googleapis.com/**', route => route.abort());
    await page.goto(base);
    await page.waitForFunction(() => typeof socket !== 'undefined' && socket.connected);
    assert.equal(await page.locator('#felixPanel').evaluate(node => node.children.length), 0);
    assert.equal(await page.locator('#felixHeaderActions').evaluate(node => node.children.length), 0);
    assert.equal(await page.locator('script[src*="games/felix.js"]').count(), 0);
    await page.evaluate(() => ensureGameAssets('felix'));
    await page.evaluate(() => { window.felixTestActions = []; sendAction = action => felixTestActions.push(action); });
    for (const width of [320, 390, 1024, 1440]) {
      await page.setViewportSize({ width, height: width < 500 ? 844 : 1000 });
      for (const key of Object.keys(views)) {
        await render(page, key);
        await bounds(page, `${width}px ${key}`);
      }
      for (const key of ['choose', 'auction', 'last_chance', 'summary', 'over']) {
        await render(page, key);
        await page.screenshot({ path: `${output}/${key}-${width}.png`, fullPage: true });
      }
      await render(page, 'choose_one');
      await page.locator('#felixHand button').click();
      await bounds(page, `${width}px last card confirmation`);
      await page.screenshot({ path: `${output}/last-card-${width}.png`, fullPage: true });
      await page.locator('#felixCancelBtn').click();
      await page.locator('#felixHelpBtn').click();
      assert.equal(await page.locator('#felixHelpModal').evaluate(node => node.open), true);
      await bounds(page, `${width}px help`);
      await page.screenshot({ path: `${output}/help-${width}.png`, fullPage: true });
      await page.keyboard.press('Escape');
      assert.equal(await page.locator('#felixHelpModal').evaluate(node => node.open), false);
      await page.evaluate(() => setRoomControlsCollapsed(false));
      await bounds(page, `${width}px expanded RC`);
      await page.evaluate(() => setRoomControlsCollapsed(true));
    }
    await render(page, 'choose');
    const handCard = page.locator('#felixHand button').first();
    const cardId = await handCard.getAttribute('data-card-id');
    await handCard.click();
    assert.equal(await page.locator('#felixSelection').isVisible(), true);
    assert.equal(await page.evaluate(() => felixTestActions.length), 0);
    const selectedScroll = await page.evaluate(() => scrollY);
    await page.evaluate(view => renderFelixGameState({ view }), views.choose);
    assert.equal(await page.locator('#felixSelection').isVisible(), true);
    assert.equal(await page.evaluate(() => scrollY), selectedScroll);
    await page.locator('#felixCancelBtn').click();
    assert.equal(await page.locator('#felixSelection').isVisible(), false);
    await handCard.click();
    await page.locator('.felix-hand-section h3').click();
    assert.equal(await page.locator('#felixSelection').isVisible(), false);
    await handCard.click();
    await page.keyboard.press('Escape');
    assert.equal(await page.locator('#felixSelection').isVisible(), false);
    await handCard.click();
    await page.locator('#felixPlayBtn').click();
    assert.deepEqual(await page.evaluate(() => felixTestActions), [{ type: 'choose_card', card_id: cardId }]);
    assert.equal(await page.locator('#felixPlayBtn').isDisabled(), true);
    await page.evaluate(() => document.getElementById('felixPlayBtn').click());
    assert.equal(await page.evaluate(() => felixTestActions.length), 1);
    await render(page, 'auction');
    for (const amount of ['', '0', '1.5', '16', '-1']) {
      await page.locator('#felixBidInput').fill(amount);
      assert.equal(await page.locator('#felixBidBtn').isDisabled(), true, amount);
    }
    await page.locator('#felixBidInput').fill('15');
    assert.equal(await page.locator('#felixBidUpBtn').isDisabled(), true);
    await page.locator('#felixBidInput').fill('1');
    assert.equal(await page.locator('#felixBidDownBtn').isDisabled(), true);
    await page.locator('#felixBidUpBtn').click();
    assert.equal(await page.locator('#felixBidInput').inputValue(), '2');
    await page.locator('#felixBidBtn').click();
    assert.deepEqual(await page.evaluate(() => felixTestActions.at(-1)), { type: 'bid', amount: 2 });
    await page.evaluate(() => document.getElementById('felixBidBtn').click());
    assert.equal(await page.evaluate(() => felixTestActions.length), 2);
    await render(page, 'last_chance');
    assert.equal(await page.locator('#felixBidEntry').isVisible(), false);
    await page.locator('#felixBuyOneBtn').click();
    assert.deepEqual(await page.evaluate(() => felixTestActions.at(-1)), { type: 'buy_for_one' });
    await render(page, 'summary');
    await page.locator('#felixNextBtn').click();
    assert.deepEqual(await page.evaluate(() => felixTestActions.at(-1)), { type: 'next_round' });
    await render(page, 'ready');
    assert.equal(await page.locator('#felixNextBtn').isDisabled(), true);
    assert.match(await page.locator('#felixReady').textContent(), /1\/5 ready/);
    assert.match(await page.locator('#felixActionHint').textContent(), /You are ready/);
    const beforeExplain = await page.evaluate(() => felixTestActions.length);
    await render(page, 'auction');
    await page.locator('#felixExplainBtn').click();
    await page.locator('#felixBidBtn').click();
    assert.equal(await page.locator('#felixExplainModal').evaluate(node => node.open), true);
    assert.match(await page.locator('#felixExplainContent').textContent(), /Only the winner pays/);
    assert.equal(await page.locator('#felixExplainBtn').getAttribute('aria-pressed'), 'false');
    await page.keyboard.press('Escape');
    await render(page, 'empty');
    assert.equal(await page.locator('#felixBidBtn').isDisabled(), true);
    await page.locator('#felixExplainBtn').click();
    await pointClick(page, page.locator('#felixBidBtn'));
    assert.equal(await page.locator('#felixExplainModal').evaluate(node => node.open), true);
    await page.keyboard.press('Escape');
    await render(page, 'choose_waiting');
    await page.locator('#felixExplainBtn').click();
    await pointClick(page, handCard);
    assert.match(await page.locator('#felixExplainContent').textContent(), /Select it, then confirm/);
    await page.keyboard.press('Escape');
    await render(page, 'over');
    await page.locator('#felixExplainBtn').click();
    await page.locator('.felix-collection summary').first().click();
    assert.equal(await page.locator('.felix-collection').first().getAttribute('open'), null);
    assert.equal(await page.locator('#felixExplainBtn').getAttribute('aria-pressed'), 'true');
    await page.keyboard.press('Escape');
    await page.locator('.felix-collection summary').first().click();
    assert.notEqual(await page.locator('.felix-collection').first().getAttribute('open'), null);
    await bounds(page, 'expanded final collection');
    assert.equal(await page.evaluate(() => felixTestActions.length), beforeExplain);
    await render(page, 'auction');
    await page.locator('#felixBalance').hover();
    assert.equal(await page.locator('#felixTooltip').isVisible(), true);
    assert.match(await page.locator('#felixTooltip').textContent(), /your money/);
    await page.locator('#felixBidBtn').hover();
    assert.equal(await page.locator('#felixTooltip').isVisible(), false);
    await page.locator('#felixBalance').click();
    await page.locator('.felix-slot-position').first().click();
    assert.match(await page.locator('#felixTooltip').textContent(), /reveals first/);
    await page.waitForFunction(() => document.getElementById('felixTooltip').classList.contains('hidden'), null, { timeout: 4000 });
    await render(page, 'choose');
    assert.equal(await page.evaluate(() => document.body.classList.contains('felix-needs-action')), true);
    await render(page, 'choose_waiting');
    assert.equal(await page.evaluate(() => document.body.classList.contains('felix-needs-action')), false);
    await page.evaluate(() => { setGamePanelVisibility(null); currentGameType = null; });
    assert.equal(await page.locator('#felixHelpBtn').isVisible(), false);
    assert.equal(await page.evaluate(() => document.body.classList.contains('felix-needs-action')), false);
    const touchContext = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
    const touchPage = await touchContext.newPage();
    touchPage.on('pageerror', error => errors.push(error.message));
    await touchPage.route('https://fonts.googleapis.com/**', route => route.abort());
    await touchPage.goto(base);
    await touchPage.waitForFunction(() => socket.connected);
    await touchPage.evaluate(async () => {
      await ensureGameAssets('felix');
      window.felixTestActions = [];
      sendAction = action => felixTestActions.push(action);
    });
    await render(touchPage, 'choose');
    await swipe(touchPage, touchPage.locator('#felixHand button').first());
    assert.equal(await touchPage.locator('#felixSelection').isVisible(), false);
    assert.equal(await touchPage.evaluate(() => felixTestActions.length), 0);
    await touchPage.locator('#felixHand button').first().tap();
    assert.equal(await touchPage.locator('#felixSelection').isVisible(), true);
    assert.equal(await touchPage.locator('#felixTooltip').isVisible(), false);
    await bounds(touchPage, 'touch confirmation');
    await touchPage.screenshot({ path: `${output}/confirmation-390.png`, fullPage: true });
    await touchPage.locator('#felixCancelBtn').tap();
    await touchPage.locator('#felixBalance').tap();
    assert.equal(await touchPage.locator('#felixTooltip').isVisible(), true);
    await touchPage.locator('.felix-slot-position').first().tap();
    assert.match(await touchPage.locator('#felixTooltip').textContent(), /reveals first/);
    await touchPage.waitForFunction(() => document.getElementById('felixTooltip').classList.contains('hidden'), null, { timeout: 4000 });
    await touchPage.locator('#felixExplainBtn').tap();
    await swipe(touchPage, touchPage.locator('#felixHand button').first());
    assert.equal(await touchPage.locator('#felixExplainModal').evaluate(node => node.open), false);
    assert.equal(await touchPage.locator('#felixExplainBtn').getAttribute('aria-pressed'), 'true');
    await touchPage.locator('#felixHand button').first().tap();
    assert.equal(await touchPage.locator('#felixExplainModal').evaluate(node => node.open), true);
    assert.equal(await touchPage.evaluate(() => felixTestActions.length), 0);
    await touchPage.locator('#felixExplainCloseBtn').tap();
    await render(touchPage, 'empty');
    await touchPage.locator('#felixExplainBtn').tap();
    await touchPage.locator('#felixBidBtn').scrollIntoViewIfNeeded();
    const disabledBid = await touchPage.locator('#felixBidBtn').boundingBox();
    await touchPage.touchscreen.tap(disabledBid.x + disabledBid.width / 2, disabledBid.y + disabledBid.height / 2);
    assert.equal(await touchPage.locator('#felixExplainModal').evaluate(node => node.open), true);
    assert.equal(await touchPage.evaluate(() => felixTestActions.length), 0);
    await touchPage.locator('#felixExplainCloseBtn').tap();
    await touchContext.close();
    const liveContexts = [];
    const livePages = [];
    for (const name of ['Felix host', 'Felix guest', 'Felix third']) {
      const liveContext = await browser.newContext({ viewport: { width: 390, height: 844 } });
      liveContexts.push(liveContext);
      const livePage = await liveContext.newPage();
      livePages.push(livePage);
      livePage.on('pageerror', error => errors.push(error.message));
      await livePage.route('https://fonts.googleapis.com/**', route => route.abort());
      await livePage.goto(base);
      await livePage.waitForFunction(() => socket.connected);
      if (livePages.length === 1) {
        await livePage.evaluate(name => socket.emit('room:create', { name, game_type: 'felix' }), name);
      } else {
        const room = await livePages[0].evaluate(() => roomId);
        await livePage.evaluate(({ room, name }) => socket.emit('room:join', { room_id: room, name }), { room, name });
      }
      await livePage.waitForFunction(() => roomSessionReady && isGameAssetsLoaded('felix'));
      await livePage.evaluate(() => socket.emit('room:ready', { room_id: roomId, ready: true }));
    }
    const host = livePages[0];
    await host.waitForFunction(() => !document.getElementById('startBtn').disabled);
    await host.evaluate(() => socket.emit('room:start', { room_id: roomId }));
    await host.waitForFunction(() => lastGameStatePayload?.game_type === 'felix');
    const playerPages = new Map();
    for (const livePage of livePages) playerPages.set(await livePage.evaluate(() => playerId), livePage);
    let reviewedRounds = 0;
    let reloaded = false;
    for (let actionIndex = 0; actionIndex < 120; actionIndex += 1) {
      const state = await host.evaluate(() => lastGameStatePayload.view);
      if (state.game_over) break;
      if (state.phase === 'round_summary') {
        reviewedRounds += 1;
        await host.locator('#felixNextBtn').click();
        await host.waitForFunction(() => lastGameStatePayload.view.next_ready.includes(playerId));
        if (!reloaded) {
          const room = await host.evaluate(() => roomId);
          await host.reload();
          await host.waitForFunction(() => isGameAssetsLoaded('felix') && lastGameStatePayload?.view.next_ready.includes(playerId));
          assert.equal(await host.evaluate(() => roomId), room);
          assert.equal(await host.locator('#felixNextBtn').isDisabled(), true);
          assert.equal(await host.locator('#felixHeaderActions').count(), 1);
          reloaded = true;
        }
        await livePages[1].locator('#felixNextBtn').click();
        await host.waitForFunction(() => lastGameStatePayload.view.next_ready.length === 2);
        assert.equal(await host.evaluate(() => lastGameStatePayload.view.round), state.round);
        assert.equal(await host.evaluate(() => lastGameStatePayload.view.phase), 'round_summary');
        await livePages[2].locator('#felixNextBtn').click();
        await host.waitForFunction(round => lastGameStatePayload.view.round === round + 1, state.round);
        continue;
      }
      const actor = playerPages.get(state.current_turn);
      assert(actor, `known actor in ${state.phase}`);
      await actor.waitForFunction(({ phase, round }) => lastGameStatePayload?.view.phase === phase && lastGameStatePayload.view.round === round && lastGameStatePayload.view.current_turn === playerId, state);
      if (state.phase === 'choose_card') {
        await actor.locator('#felixHand button').first().click();
        await actor.locator('#felixPlayBtn').click();
      } else if (state.phase === 'auction') {
        if (state.current_bid === 0 && state.round % 2 === 1) await actor.locator('#felixBidBtn').click();
        else await actor.locator('#felixPassBtn').click();
      } else if (state.phase === 'last_chance') {
        await actor.locator(state.round === 2 ? '#felixPassBtn' : '#felixBuyOneBtn').click();
      } else {
        assert.fail(`unexpected phase ${state.phase}`);
      }
      await host.waitForFunction(previous => {
        const current = lastGameStatePayload.view;
        return current.phase !== previous.phase || current.current_turn !== previous.current_turn || current.current_bid !== previous.current_bid || current.round !== previous.round;
      }, state);
    }
    await host.waitForFunction(() => lastGameStatePayload.view.game_over);
    assert.equal(reviewedRounds, 8);
    assert.equal(await host.locator('#felixNextBtn').isVisible(), false);
    assert.equal(await host.locator('.felix-result-row').count(), 3);
    await host.evaluate(() => { setRoomControlsCollapsed(true); window.scrollTo(0, 0); });
    await bounds(host, 'live three-player final');
    await host.screenshot({ path: `${output}/live-final-390.png`, fullPage: true });
    for (const liveContext of liveContexts) await liveContext.close();
    assert.deepEqual(errors, []);
    console.log('Felix: four widths, actions, Explain, touch gestures, reload and nine-round live game passed');
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
