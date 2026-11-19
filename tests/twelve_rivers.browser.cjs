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
for count in (2, 4):
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
  page.on('pageerror', error => errors.push(error.message));
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
    const map = document.getElementById('twelveRiversMap');
    const clippedSlots = [...map.querySelectorAll('.tr12-slot, text')].filter(node => {
      const box = node.getBoundingClientRect();
      return box.left < frame.left - 1 || box.right > frame.right + 1
        || box.top < frame.top - 1 || box.bottom > frame.bottom + 1;
    }).length;
    const card = document.querySelector('.tr12-slot-card')?.getBoundingClientRect();
    return {
      overflow: document.documentElement.scrollWidth > innerWidth,
      clippedSlots,
      clippedCard: !!card && (card.left < frame.left || card.right > frame.right
        || card.top < frame.top || card.bottom > frame.bottom),
      orientation: document.getElementById('twelveRiversMapFrame').dataset.orientation,
    };
  });
  assert.equal(result.overflow, false, label + ': page overflow');
  assert.equal(result.clippedSlots, 0, label + ': Fit clips board slots');
  assert.equal(result.clippedCard, false, label + ': confirmation clipped');
  return result;
}

async function interactions(page, mobile) {
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
  const before = await page.locator('#twelveRiversMap').getAttribute('viewBox');
  await page.locator('#twelveRiversZoomIn').click();
  assert.notEqual(await page.locator('#twelveRiversMap').getAttribute('viewBox'), before);
  assert.equal(await page.locator('.tr12-slot-card').count(), 1);
  await page.locator('#twelveRiversFit').click();
  await bounds(page, 'Fit with selection');
  await page.locator('#twelveRiversOrigin').click();
  const native = (await page.locator('#twelveRiversMap').getAttribute('viewBox')).split(' ').map(Number);
  const frame = await page.locator('#twelveRiversMapFrame').boundingBox();
  assert(Math.abs(native[2] - frame.width) < 1);
  await page.locator('#twelveRiversFit').click();
  await page.keyboard.press('Escape');
  assert.equal(await page.locator('.tr12-slot-card').count(), 0);
  await page.locator('#twelveRiversHelpBtn').click();
  await page.locator('.obg-help-dialog[open]').waitFor();
  await page.keyboard.press('Escape');
  await page.locator('#twelveRiversExplainBtn').click();
  await page.locator('#twelveRiversFit').click();
  await page.locator('.obg-explain-dialog[open]').waitFor();
  assert.equal(await page.locator('#twelveRiversExplainBtn').getAttribute('aria-pressed'), 'false');
  await page.keyboard.press('Escape');
  await render(page, fixtures.review);
  await page.locator('#twelveRiversNext').click();
  assert.equal(await page.evaluate(() => twelveRiversTestActions.at(-1).type), 'next_round');
  await render(page, fixtures.river);
  await bounds(page, 'river collection');
  await render(page, fixtures.sea);
  await bounds(page, 'sea collection');
}

async function dragChecks(page, context) {
  await render(page);
  await page.locator('#twelveRiversZoomIn').click();
  const frame = await page.locator('#twelveRiversMapFrame').boundingBox();
  const session = await context.newCDPSession(page);
  const point = { x: frame.x + frame.width / 2, y: frame.y + frame.height / 2 };
  const before = await page.locator('#twelveRiversMap').getAttribute('viewBox');
  const scroll = await page.evaluate(() => scrollY);
  await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [point] });
  await session.send('Input.dispatchTouchEvent', { type: 'touchMove',
    touchPoints: [{ x: point.x + 30, y: point.y - 70 }] });
  await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  assert.notEqual(await page.locator('#twelveRiversMap').getAttribute('viewBox'), before);
  assert.equal(await page.locator('.tr12-slot-card').count(), 0);
  assert.equal(await page.evaluate(() => scrollY), scroll);
  assert.equal(await page.locator('#twelveRiversMapFrame').evaluate(node => node.classList.contains('dragging')), false);
  await page.locator('#twelveRiversFit').click();
  await page.locator('.tr12-slot.open').first().click();
  assert.equal(await page.locator('.tr12-slot-card').count(), 1);
  await page.keyboard.press('Escape');
  await page.mouse.move(point.x, point.y);
  await page.mouse.down();
  await page.mouse.move(frame.x + frame.width + 20, frame.y - 20, { steps: 10 });
  await page.mouse.up();
  assert.equal(await page.locator('#twelveRiversMapFrame').evaluate(node => node.classList.contains('dragging')), false);
  await page.locator('#twelveRiversFit').click();
  await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [point] });
  await session.send('Input.dispatchTouchEvent', { type: 'touchMove',
    touchPoints: [{ x: point.x + 25, y: point.y + 40 }] });
  await session.send('Input.dispatchTouchEvent', { type: 'touchCancel', touchPoints: [] });
  assert.equal(await page.locator('#twelveRiversMapFrame').evaluate(node => node.classList.contains('dragging')), false);
  const outside = { x: 5, y: 150 };
  const scrollBefore = await page.evaluate(() => scrollY);
  await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [outside] });
  await session.send('Input.dispatchTouchEvent', { type: 'touchMove',
    touchPoints: [{ x: outside.x, y: outside.y - 100 }] });
  await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await page.waitForFunction(before => scrollY > before, scrollBefore);
  await page.evaluate(() => scrollTo(0, 0));
  await page.locator('#twelveRiversFit').click();
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
        const result = await bounds(page, String(width));
        assert.equal(result.orientation, mobile ? 'portrait' : 'landscape');
        await page.screenshot({ path: `${output}/${width}.png`, fullPage: true });
        await interactions(page, mobile);
        if (mobile) await dragChecks(page, context);
        await render(page, fixtures['2']);
        await bounds(page, `${width} two players`);
        if (mobile) {
          await page.setViewportSize({ width: 844, height: width });
          await page.waitForFunction(() => document.getElementById('twelveRiversMapFrame').dataset.orientation === 'landscape');
          await bounds(page, `${width} landscape`);
          await page.setViewportSize({ width, height: 844 });
          await page.waitForFunction(() => document.getElementById('twelveRiversMapFrame').dataset.orientation === 'portrait');
          await bounds(page, `${width} portrait restored`);
        }
        console.log(`${width}px: layout, placement/payment, zoom/Fit/1:1, camp, Help/Explain, collection and round pause passed`);
      } finally { await context.close(); }
    }
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
