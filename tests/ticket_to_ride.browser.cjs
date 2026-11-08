// Run with a local server; PLAYWRIGHT_MODULE may point to an existing installation.
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { execFileSync } = require('node:child_process');
const base = process.env.ROOM_TEST_URL || 'http://127.0.0.1:8766';
const output = 'tmp/ticket-to-ride-ui';
fs.mkdirSync(output, { recursive: true });
const views = JSON.parse(execFileSync(process.env.PYTHON || 'python3', ['-c', `
import copy, json
from game.ticket_to_ride import TicketToRideGame as Game, score_game
from game.ticket_to_ride_data import CARD_COLORS, LOCOMOTIVE

def roster(names):
    return [{'player_id': 'p' + str(i), 'name': n, 'seat': i, 'is_bot': False} for i, n in enumerate(names)]

views = {}
def save(key, state, viewer='p0'):
    views[key] = Game.get_public_view(state, viewer)

def finish_setup(state):
    for pid in list(state['seat_order']):
        if not state['players'][pid]['ready']:
            _, error = Game.apply_action(state, pid, {'type': 'keep_tickets',
                'revision': state['revision'],
                'tickets': state['players'][pid]['pending_tickets'][:2]})
            assert error is None, error
    return state

state = Game.init_game({'seed': 'ui'}, roster(['Alex', 'Beatrice', 'Celine', 'Dominic']))
save('setup', state)

waiting = copy.deepcopy(state)
first = waiting['seat_order'][0]
_, error = Game.apply_action(waiting, first, {'type': 'keep_tickets',
    'revision': waiting['revision'], 'tickets': waiting['players'][first]['pending_tickets'][:2]})
assert error is None, error
save('setup_waiting', waiting)

finish_setup(state)
state['current_turn'] = state['seat_order'][0]
save('turn', state)

rich = copy.deepcopy(state)
me = rich['current_turn']
assert me == rich['seat_order'][0], me
hand = dict.fromkeys(list(CARD_COLORS) + [LOCOMOTIVE], 0)
hand.update({'red': 6, 'blue': 5, 'green': 4, 'yellow': 3, 'white': 3, 'black': 2, LOCOMOTIVE: 4})
rich['players'][me]['hand'] = hand
save('claim', rich)

drawing = copy.deepcopy(rich)
drawing['stage'] = 'drawing'
drawing['draws_left'] = 1
save('drawing', drawing)

others = copy.deepcopy(rich)
others['current_turn'] = [p for p in others['seat_order'] if p != me][0]
save('waiting', others)

mid = copy.deepcopy(rich)
mid['stage'] = 'choosing_tickets'
mid['players'][me]['pending_tickets'] = mid['ticket_deck'][:3]
mid['ticket_deck'] = mid['ticket_deck'][3:]
save('tickets', mid)

final = copy.deepcopy(rich)
for index, pid in enumerate(final['seat_order']):
    player = final['players'][pid]
    player['routes'] = ['seattle--portland--0', 'portland--san-francisco--0',
                        'san-francisco--los-angeles--0'][: 1 + index % 3]
    player['route_points'] = 20 + 11 * index
    player['trains'] = 45 - 9 * (index + 1)
    player['tickets'] = ['seattle--los-angeles', 'seattle--new-york'][: 1 + index % 2]
    for route in player['routes']:
        final['claimed'][route] = pid
final['phase'] = 'final_round'
score_game(final)
save('over', final)

names = copy.deepcopy(rich)
names['player_meta']['p0']['name'] = 'AlexandertheGreatWithAnExtremelyLongName'
names['player_meta']['p1']['name'] = '非常非常长的玩家名字用于移动端布局验收'
save('long_names', names)

duo = Game.init_game({'seed': 'duo'}, roster(['Alex', 'Beatrice']))
finish_setup(duo)
duo['current_turn'] = duo['seat_order'][0]
duo['players'][duo['current_turn']]['hand'] = dict(hand)
save('two_players', duo)

five = Game.init_game({'seed': 'five'}, roster(['Alex', 'Beatrice', 'Celine', 'Dominic', 'Evelyn']))
finish_setup(five)
five['current_turn'] = five['seat_order'][0]
five['players'][five['current_turn']]['hand'] = dict(hand)
save('five_players', five)
print(json.dumps(views))
`], { encoding: 'utf8' }));

async function render(page, key) {
  await page.evaluate(view => {
    currentGameType = 'ticket_to_ride';
    setGamePanelVisibility('ticket_to_ride');
    renderTicketToRideGameState({ view });
    setRoomControlsCollapsed(true);
  }, views[key]);
}

async function bounds(page, label) {
  const issues = await page.evaluate(() => {
    const issues = [];
    if (document.documentElement.scrollWidth > innerWidth + 1) issues.push('page horizontal overflow');
    const roots = '#ticketToRidePanel *, .game-panel > .panel-header, .ttr-dialog[open], .ttr-dialog[open] *, .obg-help-dialog[open], .obg-help-dialog[open] *';
    for (const node of document.querySelectorAll(roots)) {
      if (!node.checkVisibility()) continue;
      const box = node.getBoundingClientRect();
      if (box.width < 1 || box.height < 1) continue;
      if (box.left < -1 || box.right > innerWidth + 1) issues.push(`${node.id || node.className} outside viewport`);
      const style = getComputedStyle(node);
      if (node.scrollWidth > node.clientWidth + 2 && style.overflowX === 'visible') {
        issues.push(`${node.id || node.className} content overflow`);
      }
    }
    const pairs = [
      ['#ticketToRideMapFrame', '.ttr-workstation'],
      ['.ttr-market-section', '.ttr-action-section'],
      ['.ttr-hand-section', '.ttr-tickets-section'],
      ['#ticketToRideReview', '.ttr-players-section'],
      ['.ttr-players-section', '.ttr-log'],
      ['#ticketToRideStats', '.ttr-board'],
    ];
    for (const [firstSelector, secondSelector] of pairs) {
      const first = document.querySelector(firstSelector);
      const second = document.querySelector(secondSelector);
      if (!first || !second || !first.checkVisibility() || !second.checkVisibility()) continue;
      const a = first.getBoundingClientRect();
      const b = second.getBoundingClientRect();
      const overlapX = Math.min(a.right, b.right) - Math.max(a.left, b.left);
      const overlapY = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
      if (overlapX > 1 && overlapY > 1) issues.push(`${firstSelector} overlaps ${secondSelector}`);
    }
    // Only Reconnect and Help share the panel header: a collapsed Room Control
    // docks the game's Explain button into its own bar by design.
    const header = ['#gameReconnectBtn', '#ticketToRideHelpBtn']
      .map(selector => document.querySelector(selector))
      .filter(Boolean)
      .map(node => node.getBoundingClientRect());
    for (let i = 1; i < header.length; i++) {
      if (Math.abs(header[0].top - header[i].top) > 10) issues.push('header buttons wrap');
    }
    return issues;
  });
  assert.deepEqual(issues, [], label);
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
    assert.equal(await page.locator('#ticketToRidePanel').evaluate(node => node.children.length), 0);
    assert.equal(await page.locator('#ticketToRideHeaderActions').evaluate(node => node.children.length), 0);
    assert.equal(await page.locator('script[src*="games/ticket_to_ride.js"]').count(), 0);
    await page.evaluate(() => ensureGameAssets('ticket_to_ride'));
    await page.waitForFunction(() => isGameAssetsLoaded('ticket_to_ride'));
    assert.equal(await page.locator('script[src*="games/ticket_to_ride.js"]').count(), 1);
    await page.evaluate(() => {
      window.ticketToRideTestActions = [];
      sendAction = action => ticketToRideTestActions.push(action);
    });

    for (const width of [320, 390, 1024, 1440]) {
      await page.setViewportSize({ width, height: width < 500 ? 844 : 1000 });
      for (const key of Object.keys(views)) {
        await render(page, key);
        await page.evaluate(() => { if (document.getElementById('ticketToRideDialog').open) document.getElementById('ticketToRideDialog').close(); });
        await bounds(page, `${width}px ${key}`);
      }
      // The ticket draft dialog is a modal, so it is checked on its own.
      await render(page, 'setup');
      await page.waitForSelector('.ttr-dialog[open] .ttr-ticket-choice');
      await bounds(page, `${width}px setup dialog`);
      await page.screenshot({ path: `${output}/setup-dialog-${width}.png`, fullPage: true });
      await page.evaluate(() => document.getElementById('ticketToRideDialog').close());

      await render(page, 'claim');
      await page.screenshot({ path: `${output}/claim-${width}.png`, fullPage: true });
      await render(page, 'over');
      await page.screenshot({ path: `${output}/over-${width}.png`, fullPage: true });
      await render(page, 'turn');
      await page.screenshot({ path: `${output}/turn-${width}.png`, fullPage: true });
    }

    // Route selection: click an affordable route and confirm the overlay appears.
    for (const width of [390, 1440]) {
      await page.setViewportSize({ width, height: width < 500 ? 844 : 1000 });
      await render(page, 'claim');
      const route = await page.evaluate(() => {
        const group = document.querySelector('#ticketToRideMap .ttr-route.is-claimable');
        return group ? group.dataset.route : null;
      });
      assert.ok(route, `${width}px has an affordable route on the map`);
      const point = await page.evaluate(id => {
        const group = document.querySelector(`#ticketToRideMap .ttr-route[data-route="${id}"]`);
        if (!group) return null;
        const box = group.getBoundingClientRect();
        return { x: box.left + box.width / 2, y: box.top + box.height / 2 };
      }, route);
      assert.ok(point, `${width}px route group has a box`);
      await page.mouse.click(point.x, point.y);
      await page.waitForSelector('#ticketToRideRouteOverlay:not(.hidden)');
      await bounds(page, `${width}px route selected`);
      const payment = await page.locator('.ttr-payment-chip').count();
      assert.ok(payment > 0, `${width}px offers a payment option`);
      await page.screenshot({ path: `${output}/route-selected-${width}.png`, fullPage: true });
      const before = await page.evaluate(() => ticketToRideTestActions.length);
      await page.locator('#ticketToRideRouteOverlay button', { hasText: 'Claim' }).click();
      await page.waitForFunction(count => ticketToRideTestActions.length > count, before);
      const action = await page.evaluate(() => ticketToRideTestActions.at(-1));
      assert.equal(action.type, 'claim_route');
      assert.equal(action.route, route);
      assert.ok(Object.values(action.cards).reduce((a, b) => a + b, 0) > 0);
      // Clicking empty map space clears the selection without a Clear button.
      await page.locator('#ticketToRideMap').click({ position: { x: 4, y: 4 } });
      await page.waitForFunction(() => document.getElementById('ticketToRideRouteOverlay').classList.contains('hidden'));
      // The stubbed sender never answers, so replay a different snapshot to clear
      // the in-flight guard exactly like a real server update would.
      await render(page, 'waiting');
    }

    // Card market: two face-up picks, and a locomotive may not be the second.
    await page.setViewportSize({ width: 1440, height: 1000 });
    await render(page, 'claim');
    let before = await page.evaluate(() => ticketToRideTestActions.length);
    await page.locator('#ticketToRideMarket .ttr-card').first().click();
    await page.waitForFunction(count => ticketToRideTestActions.length > count, before);
    assert.equal((await page.evaluate(() => ticketToRideTestActions.at(-1))).type, 'draw_card');

    await render(page, 'drawing');
    const blocked = await page.evaluate(() => {
      const cards = [...document.querySelectorAll('#ticketToRideMarket .ttr-card')];
      const wild = cards.find(card => card.classList.contains('ttr-card--locomotive'));
      return wild ? wild.disabled : null;
    });
    if (blocked !== null) assert.equal(blocked, true, 'a face-up locomotive is blocked as the second card');

    // Help: bilingual toggle, basics block and section tabs (task40 R1/R3/R6).
    await render(page, 'turn');
    await page.locator('#ticketToRideHelpBtn').click();
    await page.waitForSelector('.obg-help-dialog[open]');
    const help = page.locator('.obg-help-dialog[open]');
    assert.ok((await help.innerText()).includes('铁路环游'));
    assert.ok((await help.innerText()).includes('基本规则'));
    assert.ok(await page.locator('.obg-help-dialog[open] .obg-help-tab').count() >= 3, 'help renders section tabs');
    assert.ok(await page.locator('.obg-help-dialog[open] .obg-help-basic-row').count() === 3, 'help renders the three basics');
    await page.locator('.obg-help-dialog[open] [data-obg-help-lang="en"]').click();
    assert.ok((await help.innerText()).includes('How you win'), 'help switches to English');
    await page.locator('.obg-help-dialog[open] [data-obg-help-lang="zh"]').click();
    assert.ok((await help.innerText()).includes('靠什么赢'), 'help switches back to Chinese');
    await bounds(page, 'help dialog open');
    await page.screenshot({ path: `${output}/help-1440.png`, fullPage: true });
    await page.keyboard.press('Escape');
    await page.waitForFunction(() => !document.querySelector('.obg-help-dialog[open]'));

    // Explain mode comes from the shared widget.
    await page.locator('#ticketToRideExplainBtn').click();
    await page.waitForFunction(() => document.body.classList.contains('obg-explaining'));
    await page.locator('#ticketToRideStats .ttr-stat').first().click();
    await page.waitForSelector('.obg-explain-dialog[open]');
    assert.ok((await page.locator('.obg-explain-dialog[open]').innerText()).length > 10);
    await page.keyboard.press('Escape');

    // Touch drag on the map must not scroll the page or select a route.
    await page.setViewportSize({ width: 390, height: 844 });
    await render(page, 'claim');
    const mapBox = await page.locator('#ticketToRideMap').boundingBox();
    const session = await page.context().newCDPSession(page);
    const startY = mapBox.y + mapBox.height / 2;
    await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: mapBox.x + mapBox.width / 2, y: startY }] });
    for (const distance of [20, 45, 70, 95]) {
      await session.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: mapBox.x + mapBox.width / 2, y: startY - distance }] });
    }
    await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await session.detach();
    assert.equal(await page.evaluate(() => scrollY), 0, 'map drag does not scroll the page');
    assert.ok(await page.evaluate(() => document.getElementById('ticketToRideRouteOverlay').classList.contains('hidden')),
      'map drag does not select a route');

    assert.deepEqual(errors, [], 'no page errors');
    console.log('ticket_to_ride UI checks passed');
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exit(1); });
