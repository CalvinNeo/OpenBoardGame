const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { execFileSync } = require('node:child_process');

const base = process.env.ROOM_TEST_URL || 'http://127.0.0.1:8766';
const output = 'tmp/twelve-rivers-ui';
const errors = [];
const fixtures = JSON.parse(execFileSync(process.env.PYTHON || 'python3', ['-c', `
import json
from game.twelve_rivers import TwelveRiversGame as Game, current_actor
from tests.test_twelve_rivers import make_state, place, act
views = {}
for count in (2, 3, 4):
    state = make_state(count, seed='portrait-ui')
    actor = current_actor(state)
    state['players'][actor]['hand']['banner'] = 6
    views[str(count)] = Game.get_public_view(state, actor)
state = make_state(2, seed='collection-ui')
while state['phase'] == 'exploration':
    space = next(space for space in Game.get_public_view(state, current_actor(state))['board']['spaces']
                 if space not in state['placements'] and '#' in space)
    place(state, current_actor(state), space)
views['river'] = Game.get_public_view(state, current_actor(state))
state = make_state(2, seed='sea-ui')
for space in ('sea', 'v1', 'v2', 'v3', 'v4', 'v5'):
    place(state, current_actor(state), space)
views['sea'] = Game.get_public_view(state, current_actor(state))
while state['phase'] != 'round_end':
    actor = current_actor(state)
    if state['stage'] == 'village':
        act(state, 'befriend', pid=actor, index=0)
    elif state['stage'] == 'sea':
        act(state, 'take_sea_pearls', pid=actor, take=[])
    elif state['stage'] == 'deliver':
        actor = next(pid for pid in state['seat_order'] if not state['players'][pid]['deliver_done'])
        act(state, 'deliver', pid=actor, moves=[])
views['review'] = Game.get_public_view(state, state['seat_order'][0])
print(json.dumps(views))
`], { encoding: 'utf8' }));
let revision = 2000;

async function render(page, fixture = fixtures['4']) {
  await page.evaluate(view => {
    playerId = view.you;
    renderRoomState({ room_id: roomId, game_type: 'twelve_rivers', status: 'in_game',
      host_id: view.you, players: view.players, game_config: {} });
    setGamePanelVisibility('twelve_rivers');
    renderTwelveRiversGameState({ room_id: roomId, game_type: 'twelve_rivers', view });
    setRoomControlsCollapsed(true);
    window.scrollTo(0, 0);
  }, { ...fixture, revision: revision++ });
}

async function open(page) {
  page.on('pageerror', error => errors.push(error.stack || error.message));
  await page.route('https://fonts.googleapis.com/**', route => route.abort());
  await page.goto(base);
  await page.waitForFunction(() => typeof socket !== 'undefined' && socket.connected && cachedGameList);
  await page.evaluate(() => socket.emit('room:create', { name: 'Twelve Rivers UI QA', game_type: 'twelve_rivers' }));
  await page.waitForFunction(() => roomSessionReady && isGameAssetsLoaded('twelve_rivers'));
  await page.evaluate(() => {
    window.twelveRiversTestActions = [];
    window.sendAction = action => twelveRiversTestActions.push(action);
  });
  await render(page);
}

async function bounds(page, label) {
  const result = await page.evaluate(() => {
    const frame = document.getElementById('twelveRiversMapFrame').getBoundingClientRect();
    const visible = [...document.querySelectorAll('#twelveRiversMapFrame *')].filter(node => {
      const box = node.getBoundingClientRect();
      return box.width && box.height && getComputedStyle(node).visibility !== 'hidden';
    });
    const clipped = visible.filter(node => {
      const box = node.getBoundingClientRect();
      return box.left < frame.left - 1 || box.right > frame.right + 1
        || box.top < frame.top - 1 || box.bottom > frame.bottom + 1;
    }).map(node => node.className);
    const tooSmall = [...document.querySelectorAll('#twelveRiversMapFrame .tr12-slot')]
      .filter(node => node.getBoundingClientRect().width < 28).length;
    const overflowing = visible.filter(node => node.clientWidth && node.scrollWidth > node.clientWidth + 1)
      .map(node => node.className);
    return { overflow: document.documentElement.scrollWidth > innerWidth,
      clipped, tooSmall, overflowing, left: frame.left, right: innerWidth - frame.right };
  });
  assert.equal(result.overflow, false, label + ': page overflow');
  assert.deepEqual(result.clipped, [], label + ': clipped board elements');
  assert.deepEqual(result.overflowing, [], label + ': overflowing contents');
  assert.equal(result.tooSmall, 0, label + ': slots shrink below native size');
  assert(result.left >= 8 && result.right >= 8, label + ': missing screen padding');
  return result;
}

async function interactions(page, mobile) {
  assert.equal(await page.locator('#twelveRiversMapFrame svg').count(), 0);
  assert.equal(await page.locator('#twelveRiversZoomIn, #twelveRiversFit, #twelveRiversOrigin').count(), 0);
  const slot = page.locator('.tr12-slot.open').first();
  await slot.click();
  await page.locator('.tr12-slot-card').waitFor();
  await bounds(page, 'selected slot');
  await page.locator('#twelveRiversDockBtn').click();
  await page.locator('#twelveRiversDock').waitFor({ state: 'visible' });
  const banner = page.locator('#twelveRiversHand .tr12-card').first();
  for (let index = 0; index < 3; index += 1) {
    if (mobile) await banner.tap();
    else await banner.click();
  }
  assert.equal(await page.locator('.tr12-slot-card button').first().isDisabled(), false);
  if (mobile) assert.equal(await page.locator('#twelveRiversTooltip').isVisible(), false);
  if (mobile) await page.locator('#twelveRiversDockClose').click();
  await page.locator('.tr12-slot-card button').first().click();
  assert.equal(await page.evaluate(() => twelveRiversTestActions.at(-1).pay.banner), 3);
  await render(page);
  await page.locator('.tr12-slot.open').last().click();
  await bounds(page, 'last village slot');
  await page.keyboard.press('Escape');
  assert.equal(await page.locator('.tr12-slot-card').count(), 0);
  await page.locator('.tr12-slot.open').first().focus();
  await page.keyboard.press('Enter');
  assert.equal(await page.locator('.tr12-slot-card').count(), 1);
  await page.keyboard.press('Escape');
  await page.locator('#twelveRiversHelpBtn').click();
  await page.locator('.obg-help-dialog[open]').waitFor();
  await page.keyboard.press('Escape');
  await page.locator('#twelveRiversExplainBtn').click();
  await page.locator('#twelveRiversMapFrame .tr12-cost').first().click();
  await page.locator('.obg-explain-dialog[open]').waitFor();
  assert.equal(await page.locator('#twelveRiversExplainBtn').getAttribute('aria-pressed'), 'false');
  await page.keyboard.press('Escape');
  await render(page, fixtures.review);
  await page.locator('#twelveRiversNext').click();
  assert.equal(await page.evaluate(() => twelveRiversTestActions.at(-1).type), 'next_round');
  await render(page, fixtures.river);
  await bounds(page, 'river collection');
  const pearl = page.locator('.tr12-stretch button.tr12-board-pearl').first();
  if (await pearl.count()) {
    await pearl.click();
    assert.equal(await page.locator('.tr12-stretch button.tr12-board-pearl[aria-pressed="true"]').count(), 1);
    await page.locator('.tr12-slot-card button').click();
    assert.equal(await page.evaluate(() => twelveRiversTestActions.at(-1).take.length), 1);
  }
  await render(page, fixtures.sea);
  await bounds(page, 'sea collection');
  await page.locator('#twelveRiversSeaPearls button').first().click();
  await page.locator('.tr12-slot-card button').click();
  assert.equal(await page.evaluate(() => twelveRiversTestActions.at(-1).type), 'take_sea_pearls');
}

async function touchChecks(page, context) {
  await render(page);
  const target = await page.locator('.tr12-slot.open').first().boundingBox();
  const point = {x: target.x + target.width / 2, y: target.y + target.height / 2};
  const session = await context.newCDPSession(page);
  const before = await page.evaluate(() => scrollY);
  await session.send('Input.dispatchTouchEvent', {type: 'touchStart', touchPoints: [point]});
  await session.send('Input.dispatchTouchEvent', {type: 'touchMove',
    touchPoints: [{x: point.x, y: point.y - 90}]});
  await session.send('Input.dispatchTouchEvent', {type: 'touchEnd', touchPoints: []});
  await page.waitForFunction(start => scrollY > start, before);
  assert.equal(await page.locator('.tr12-slot-card').count(), 0);
  await page.evaluate(() => scrollTo(0, 0));
  await page.locator('.tr12-slot.open').first().tap();
  assert.equal(await page.locator('.tr12-slot-card').count(), 1);
  await page.keyboard.press('Escape');
  const fresh = await page.locator('.tr12-slot.open').first().boundingBox();
  const cancelPoint = {x: fresh.x + 14, y: fresh.y + 14};
  await session.send('Input.dispatchTouchEvent', {type: 'touchStart', touchPoints: [cancelPoint]});
  await session.send('Input.dispatchTouchEvent', {type: 'touchCancel', touchPoints: []});
  assert.equal(await page.locator('.tr12-slot-card').count(), 0);
  await page.locator('.tr12-slot.open').first().tap();
  assert.equal(await page.locator('.tr12-slot-card').count(), 1);
  await page.keyboard.press('Escape');
}

async function stressChecks(page, width) {
  const spaces = await page.locator('.tr12-slot.open').evaluateAll(nodes => nodes.map(node => node.dataset.space));
  for (const space of spaces) {
    await page.locator('.tr12-slot[data-space="' + space + '"]').click();
    assert.equal(await page.locator('.tr12-slot-card').getAttribute('data-anchor-space'), space);
    await bounds(page, 'space ' + space);
    await page.keyboard.press('Escape');
  }
  const busy = structuredClone(fixtures['4']);
  for (const [index, colors] of Object.entries(busy.pools)) {
    busy.pools[index] = Array.from({length: 12}, (_, count) => ['green', 'blue', 'pink', 'purple', 'white'][count % 5]);
  }
  for (const spot of Object.keys(busy.fairy_spots)) busy.fairy_spots[spot] = Array(10).fill('wind');
  busy.sea = Array.from({length: 65}, (_, index) => ['green', 'blue', 'pink', 'purple', 'white'][index % 5]);
  await render(page, busy);
  await bounds(page, 'crowded pearl pools and fairy stacks');
  await page.screenshot({path: output + '/' + width + '-crowded.png', fullPage: true});
  await render(page, fixtures['3']);
  await bounds(page, 'three-player layout');
}

(async () => {
  fs.mkdirSync(output, { recursive: true });
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  try {
    for (const width of [320, 390, 1024, 1440]) {
      const mobile = width < 900;
      const context = await browser.newContext({ viewport: { width, height: mobile ? 844 : 1000 },
        isMobile: mobile, hasTouch: mobile });
      try {
        const page = await context.newPage();
        await open(page);
        await page.screenshot({ path: `${output}/${width}.png`, fullPage: true });
        await bounds(page, String(width));
        await interactions(page, mobile);
        if (mobile) await touchChecks(page, context);
        await render(page);
        await stressChecks(page, width);
        await render(page, fixtures['2']);
        await bounds(page, `${width} two players`);
        if (mobile) {
          await page.setViewportSize({ width: 844, height: width });
          await bounds(page, `${width} landscape`);
          await page.setViewportSize({ width, height: 844 });
          await bounds(page, `${width} portrait restored`);
        }
        console.log(`${width}px: padded native grid, placement/payment, camp, Help/Explain, collection and round pause passed`);
      } finally { await context.close(); }
    }
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
