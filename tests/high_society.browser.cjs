const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { execFileSync } = require('node:child_process');
const base = process.env.ROOM_TEST_URL || 'http://127.0.0.1:8768';
const output = 'tmp/high-society-ui';
fs.mkdirSync(output, { recursive: true });
const views = JSON.parse(execFileSync(process.env.PYTHON || 'python3', ['-c', `
import copy, json, random
from game.high_society import HighSocietyGame as Game, STATUS_CARDS, _finalize_game
random.seed(79)
players = [{'player_id': 'p' + str(index), 'name': name, 'seat': index, 'is_bot': False} for index, name in enumerate(['Alex', 'Beatrice', 'Celine', 'Dominic', 'Evelyn'])]
state = Game.init_game({}, players)
state.update(phase='normal_auction', current_turn='p0', start_player='p0', current_status=copy.deepcopy(STATUS_CARDS[7]), current_high_bid=0, current_high_bidder=None)
views = {}
def save(key, viewer='p0'):
    views[key] = Game.get_public_view(state, viewer)
save('normal')
state['players']['p0']['hand_money'].remove(4000)
state['players']['p0']['table_money'] = [4000]
state['players']['p1']['hand_money'].remove(6000)
state['players']['p1']['table_money'] = [6000]
state.update(current_high_bid=6000, current_high_bidder='p1')
save('raise')
state['current_turn'] = 'p1'
save('waiting')
save('spectator', 'spectator')
state['active_players'].remove('p0')
save('passed')
state['active_players'].append('p0')
state['current_turn'] = 'p0'
state['phase'] = 'disgrace_auction'
state['current_status'] = next(copy.deepcopy(card) for card in STATUS_CARDS if card['id'] == 'faux_pas')
state['players']['p0']['status_cards'] = [copy.deepcopy(STATUS_CARDS[2]), copy.deepcopy(STATUS_CARDS[7])]
save('disgrace')
_, error = Game.apply_action(state, 'p0', {'type': 'pass'})
assert error is None
save('faux')
_, error = Game.apply_action(state, 'p0', {'type': 'choose_faux_pas_discard', 'card_id': 'luxury_3'})
assert error is None
save('summary')
_, error = Game.apply_action(state, 'p0', {'type': 'next_round'})
assert error is None
save('ready')
for player_id in ['p1','p2','p3','p4']:
    _, error = Game.apply_action(state, player_id, {'type': 'next_round'})
    assert error is None
save('next')
state['player_meta']['p0']['name'] = 'AlexandertheGreatWithAnExtremelyLongUnbrokenName'
state['player_meta']['p1']['name'] = '非常非常长的玩家名字用于移动端布局验收'
state['players']['p0']['status_cards'] = copy.deepcopy(STATUS_CARDS)
state['end_marker_revealed_count'] = 3
state.update(phase='normal_auction', current_turn='p0', current_high_bid=0, current_high_bidder=None)
save('crowded')
state['players']['p0']['hand_money'] = []
save('empty')
state['end_marker_revealed_count'] = 4
_finalize_game(state, next(copy.deepcopy(card) for card in STATUS_CARDS if card['id'] == 'scandale'))
save('over')
print(json.dumps(views))
`], { encoding: 'utf8' }));

async function render(page, key) {
  await page.evaluate(view => {
    currentGameType = 'high_society';
    setGamePanelVisibility('high_society');
    renderHighSocietyGameState({ view });
    setRoomControlsCollapsed(true);
  }, views[key]);
}

async function bounds(page, label) {
  const issues = await page.evaluate(() => {
    const nodes = document.querySelectorAll('.game-panel[data-game-theme="high_society"] > .panel-header *, #highSocietyPanel *, .high-society-modal *');
    return [...nodes].filter(node => {
      if (!node.checkVisibility()) return false;
      const box = node.getBoundingClientRect();
      return box.width && box.height && (box.left < -1 || box.right > innerWidth + 1 || (node.clientWidth && node.scrollWidth > node.clientWidth + 1));
    }).map(node => `${node.id || node.className}: ${node.textContent.slice(0, 70)}`);
  });
  assert.deepEqual(issues, [], label);
  const header = await page.evaluate(() => {
    const help = document.getElementById('highSocietyHelpBtn').getBoundingClientRect();
    const reconnect = document.getElementById('gameReconnectBtn').getBoundingClientRect();
    return Math.abs(help.top + help.height / 2 - reconnect.top - reconnect.height / 2);
  });
  assert.ok(header < 3, `${label}: Help and Reconnect share a row`);
  const overlaps = await page.evaluate(() => {
    const pairs = [['.high-society-current', '.high-society-actions'], ['.high-society-table', '#highSocietyPlayers'], ['#highSocietyHand', '#highSocietyBidControls']];
    const overlapping = [];
    for (const [firstSelector, secondSelector] of pairs) {
      const first = document.querySelector(firstSelector);
      const second = document.querySelector(secondSelector);
      if (!first.checkVisibility() || !second.checkVisibility()) continue;
      const firstBox = first.getBoundingClientRect();
      const secondBox = second.getBoundingClientRect();
      if (Math.min(firstBox.right, secondBox.right) - Math.max(firstBox.left, secondBox.left) > 1 && Math.min(firstBox.bottom, secondBox.bottom) - Math.max(firstBox.top, secondBox.top) > 1) overlapping.push([firstSelector, secondSelector]);
    }
    return overlapping;
  });
  assert.deepEqual(overlaps, [], `${label}: no panel overlap`);
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
    await page.waitForFunction(() => socket.connected);
    await page.evaluate(() => ensureGameAssets('high_society'));
    await page.evaluate(() => {
      window.highSocietyQAActions = [];
      sendAction = action => highSocietyQAActions.push(action);
    });
    for (const width of [320, 390, 1024, 1440]) {
      await page.setViewportSize({ width, height: width < 500 ? 844 : 1000 });
      for (const key of Object.keys(views)) {
        await render(page, key);
        await bounds(page, `${width}px ${key}`);
      }
      await render(page, 'normal');
      await page.screenshot({ path: `${output}/normal-${width}.png`, fullPage: true });
      await page.locator('#highSocietyHelpBtn').click();
      await bounds(page, `${width}px help`);
      await page.keyboard.press('Escape');
      assert.equal(await page.locator('#highSocietyHelpModal').isVisible(), false);
      await page.evaluate(() => setRoomControlsCollapsed(false));
      await bounds(page, `${width}px expanded RC`);
      await page.evaluate(() => setRoomControlsCollapsed(true));
      for (const key of ['faux', 'summary', 'over', 'crowded']) {
        await render(page, key);
        await page.screenshot({ path: `${output}/${key}-${width}.png`, fullPage: true });
      }
    }
    console.log('PASS layout: 4 widths × 13 states, long names, full collections, Help, header alignment');

    await render(page, 'raise');
    await page.locator('.high-society-money-card[data-value="1000"]').click();
    assert.equal(await page.locator('#highSocietyBidBtn').isDisabled(), true);
    await page.locator('.high-society-money-card[data-value="2000"]').click();
    assert.match(await page.locator('#highSocietySelectedTotal').textContent(), /\$4,000 \+ \$3,000 → \$7,000/);
    assert.equal(await page.locator('#highSocietyBidBtn').isEnabled(), true);
    assert.equal(await page.locator('.high-society-money-card[data-value="2000"]').evaluate(node => node === document.activeElement), true);
    await page.locator('#highSocietyBidBtn').click();
    assert.deepEqual(await page.evaluate(() => highSocietyQAActions.at(-1)), { type: 'bid', money_values: [1000, 2000] });
    assert.equal(await page.locator('#highSocietyBidBtn').isDisabled(), true);
    assert.equal(await page.locator('#highSocietyPassBtn').isDisabled(), true);
    await page.evaluate(() => socket.listeners('system:error').forEach(listener => listener({ message: 'QA rejected action' })));
    assert.equal(await page.locator('#highSocietyBidBtn').isEnabled(), true);
    await page.locator('#highSocietyActionHint').click();
    assert.equal(await page.locator('.high-society-money-card.selected').count(), 0);
    await render(page, 'normal');
    await page.locator('.high-society-money-card').first().click();
    await render(page, 'waiting');
    assert.equal(await page.locator('.high-society-money-card.selected').count(), 0);
    assert.equal(await page.locator('.high-society-money-card:enabled').count(), 0);
    console.log('PASS bidding: additive total, invalid bid, focus, empty-space deselect, pending lock, error recovery, turn reset');

    const beforeExplain = await page.evaluate(() => highSocietyQAActions.length);
    await page.locator('#highSocietyExplainBtn').click();
    const disabledBid = await page.locator('#highSocietyBidBtn').boundingBox();
    await page.mouse.click(disabledBid.x + 15, disabledBid.y + 15);
    assert.equal(await page.locator('#highSocietyExplainModal').isVisible(), true);
    assert.match(await page.locator('#highSocietyExplainContent').textContent(), /Money/);
    await page.keyboard.press('Escape');
    await render(page, 'normal');
    await page.locator('#highSocietyExplainBtn').click();
    await page.locator('#highSocietyPassBtn').click();
    assert.equal(await page.locator('#highSocietyExplainModal').isVisible(), true);
    assert.equal(await page.evaluate(() => highSocietyQAActions.length), beforeExplain);
    await page.keyboard.press('Escape');
    await page.locator('#highSocietyExplainBtn').click();
    await page.locator('.high-society-money-card').first().click();
    assert.equal(await page.locator('.high-society-money-card.selected').count(), 0);
    await page.keyboard.press('Escape');
    assert.equal(await page.locator('#highSocietyExplainBtn').getAttribute('aria-pressed'), 'false');
    console.log('PASS Explain: disabled/enabled controls, money, no action leakage, Esc');

    await render(page, 'faux');
    await page.locator('.high-society-faux-choice').first().click();
    assert.equal(await page.evaluate(() => highSocietyQAActions.length), beforeExplain);
    assert.equal(await page.locator('#highSocietyDiscardConfirm').isVisible(), true);
    await page.locator('#highSocietyCancelBtn').click();
    assert.equal(await page.locator('#highSocietyDiscardConfirm').isVisible(), false);
    await page.locator('.high-society-faux-choice').first().click();
    await page.locator('#highSocietyDiscardBtn').click();
    assert.deepEqual(await page.evaluate(() => highSocietyQAActions.at(-1)), { type: 'choose_faux_pas_discard', card_id: 'luxury_3' });
    await render(page, 'summary');
    assert.match(await page.locator('#highSocietyNoticeBody').textContent(), /Luxury 3 was discarded/);
    await page.locator('#highSocietyNextBtn').click();
    assert.deepEqual(await page.evaluate(() => highSocietyQAActions.at(-1)), { type: 'next_round' });
    await render(page, 'ready');
    assert.equal(await page.locator('#highSocietyNextBtn').isDisabled(), true);
    await render(page, 'next');
    assert.equal(await page.locator('#highSocietyNotice').isVisible(), false);
    await render(page, 'over');
    assert.equal(await page.locator('.high-society-result-row').count(), 5);
    assert.equal(await page.locator('.high-society-result-row.eliminated').count(), 1);
    assert.match(await page.locator('#highSocietyNoticeBody').textContent(), /Fourth timer: Scandale · not auctioned/);
    await page.locator('.high-society-player-card.self .high-society-card-list').evaluate(node => { node.scrollTop = node.scrollHeight; });
    await page.locator('.high-society-player-card.self .high-society-card-face').last().hover();
    assert.match(await page.locator('#highSocietyTooltip').textContent(), /Scandale/);
    console.log('PASS Faux Pas confirmation/cancel, review readiness, stale-summary removal, final elimination');

    const mobileContext = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
    const mobile = await mobileContext.newPage();
    mobile.on('pageerror', error => errors.push(error.message));
    await mobile.goto(base);
    await mobile.waitForFunction(() => socket.connected);
    await mobile.evaluate(() => ensureGameAssets('high_society'));
    await mobile.evaluate(() => { window.highSocietyQAActions = []; sendAction = action => highSocietyQAActions.push(action); });
    await render(mobile, 'normal');
    await swipe(mobile, mobile.locator('.high-society-money-card').first());
    assert.equal(await mobile.locator('.high-society-money-card.selected').count(), 0);
    await mobile.locator('.high-society-money-card').first().tap();
    assert.equal(await mobile.locator('.high-society-money-card.selected').count(), 1);
    assert.equal(await mobile.locator('#highSocietyTooltip').isVisible(), false);
    await mobile.locator('#highSocietyTimerTrack').tap();
    assert.equal(await mobile.locator('#highSocietyTooltip').isVisible(), true);
    await mobile.locator('#highSocietyCurrentCard').tap();
    assert.match(await mobile.locator('#highSocietyTooltip').textContent(), /Luxury/);
    await mobile.waitForTimeout(3100);
    assert.equal(await mobile.locator('#highSocietyTooltip').isVisible(), false);
    await swipe(mobile, mobile.locator('#highSocietyCurrentCard'));
    assert.equal(await mobile.locator('#highSocietyTooltip').isVisible(), false);
    await render(mobile, 'waiting');
    await mobile.locator('#highSocietyExplainBtn').tap();
    await swipe(mobile, mobile.locator('#highSocietyBidBtn'));
    assert.equal(await mobile.locator('#highSocietyExplainModal').isVisible(), false);
    const mobileBid = await mobile.locator('#highSocietyBidBtn').boundingBox();
    await mobile.touchscreen.tap(mobileBid.x + mobileBid.width / 2, mobileBid.y + mobileBid.height / 2);
    assert.equal(await mobile.locator('#highSocietyExplainModal').isVisible(), true);
    await mobile.keyboard.press('Escape');
    await render(mobile, 'normal');
    await mobile.evaluate(() => window.scrollTo(0, 0));
    const bottom = await mobile.locator('#highSocietyPassBtn').boundingBox();
    assert.ok(bottom.y + bottom.height <= 844, 'Auction, hand and actions fit in the mobile viewport');
    await mobile.screenshot({ path: `${output}/touch-390.png`, fullPage: true });
    await mobile.evaluate(() => setGamePanelVisibility('cabo'));
    assert.equal(await mobile.evaluate(() => document.body.classList.contains('high-society-needs-action')), false);
    console.log('PASS mobile: swipe vs tap, static tips/replacement/3s expiry, disabled Explain, viewport fit, switch cleanup');
    const liveContexts = [];
    const livePages = [];
    for (const playerName of ['HS Host', 'HS Guest', 'HS Third']) {
      const liveContext = await browser.newContext({ viewport: { width: 390, height: 844 } });
      liveContexts.push(liveContext);
      const livePage = await liveContext.newPage();
      livePages.push(livePage);
      livePage.on('pageerror', error => errors.push(error.message));
      await livePage.goto(base);
      await livePage.waitForFunction(() => socket.connected);
      await livePage.evaluate(playerName => {
        window.highSocietyLiveName = playerName;
        window.highSocietyLiveErrors = [];
        socket.on('system:error', data => highSocietyLiveErrors.push(data.message));
      }, playerName);
    }
    const host = livePages[0];
    await host.evaluate(() => socket.emit('room:create', { name: highSocietyLiveName, game_type: 'high_society' }));
    await host.waitForFunction(() => roomSessionReady && isGameAssetsLoaded('high_society'));
    const liveRoomId = await host.evaluate(() => roomId);
    for (const guest of livePages.slice(1)) {
      await guest.evaluate(room => socket.emit('room:join', { room_id: room, name: highSocietyLiveName }), liveRoomId);
      await guest.waitForFunction(() => roomSessionReady && isGameAssetsLoaded('high_society'));
      await guest.evaluate(() => socket.emit('room:ready', { ready: true }));
    }
    await host.waitForFunction(() => currentRoomState.players.length === 3 && currentRoomState.players.every(player => player.ready));
    await host.evaluate(() => socket.emit('room:start', {}));
    for (const livePage of livePages) {
      await livePage.waitForFunction(() => lastGameStatePayload?.view?.round === 1 && document.querySelectorAll('.high-society-money-card').length === 11);
      await livePage.evaluate(() => setRoomControlsCollapsed(true));
    }
    let bidder;
    for (const livePage of livePages) {
      if (await livePage.evaluate(() => lastGameStatePayload.view.you === lastGameStatePayload.view.current_turn)) bidder = livePage;
    }
    await bidder.locator('.high-society-money-card[data-value="1000"]').click();
    await bidder.locator('#highSocietyBidBtn').click();
    for (const livePage of livePages) {
      await livePage.waitForFunction(() => document.getElementById('highSocietyHighBid').textContent === '$1,000');
    }
    for (let turn = 0; turn < 4; turn += 1) {
      const snapshot = await host.evaluate(() => ({ phase: lastGameStatePayload.view.phase, player: lastGameStatePayload.view.current_turn, version: lastGameStatePayload.state_version }));
      if (snapshot.phase === 'round_summary') break;
      let actingPage;
      for (const livePage of livePages) {
        if (await livePage.evaluate(player => lastGameStatePayload.view.you === player, snapshot.player)) actingPage = livePage;
      }
      assert.ok(actingPage, 'Current player has a live browser session');
      await actingPage.waitForFunction(version => lastGameStatePayload.state_version >= version && !document.getElementById('highSocietyPassBtn').disabled, snapshot.version);
      await actingPage.locator('#highSocietyPassBtn').click();
      for (const livePage of livePages) await livePage.waitForFunction(version => lastGameStatePayload.state_version > version, snapshot.version);
    }
    for (const livePage of livePages) await livePage.waitForFunction(() => lastGameStatePayload.view.phase === 'round_summary');
    for (const livePage of livePages.slice(0, 2)) {
      await livePage.locator('#highSocietyNextBtn').click();
      await livePage.waitForFunction(() => lastGameStatePayload.view.next_ready.includes(lastGameStatePayload.view.you));
    }
    assert.equal(await host.evaluate(() => lastGameStatePayload.view.phase), 'round_summary', 'Wait for every player');
    await livePages[2].locator('#highSocietyNextBtn').click();
    for (const livePage of livePages) await livePage.waitForFunction(() => lastGameStatePayload.view.round === 2);
    assert.equal(await host.locator('#highSocietyNotice').isVisible(), false);
    await host.evaluate(() => socket.disconnect());
    assert.equal(await host.locator('#highSocietyPassBtn').isDisabled(), true);
    assert.match(await host.locator('#highSocietyActionHint').textContent(), /Disconnected/);
    await host.evaluate(() => socket.connect());
    await host.waitForFunction(() => roomSessionReady && socket.connected && lastGameStatePayload?.view?.round === 2);
    await host.reload();
    await host.waitForFunction(() => roomSessionReady && isGameAssetsLoaded('high_society') && document.getElementById('highSocietyRound').textContent === '2');
    assert.equal(await host.locator('.high-society-player-card').count(), 3);
    for (const livePage of livePages) assert.deepEqual(await livePage.evaluate(() => window.highSocietyLiveErrors || []), []);
    console.log('PASS live: 3 clients, lazy load, public bid sync, all-player review gate, next round, disconnect/reconnect, page reload');
    for (const liveContext of liveContexts) await liveContext.close();
    assert.deepEqual(errors, [], 'No browser errors');
    await mobileContext.close();
    await context.close();
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
