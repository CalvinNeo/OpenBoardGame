const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { execFileSync } = require('node:child_process');

const base = process.env.ROOM_TEST_URL || 'http://127.0.0.1:8766';
const output = 'tmp/bubble-shooter-ui';
const errors = [];
const fixtures = JSON.parse(execFileSync(process.env.PYTHON || 'python3', ['-c', `
import json
from tests.test_bubble_shooter import make_state, blank
from game.bubble_shooter import BubbleShooterGame as Game

def view(state):
    return Game.get_public_view(state, 'p0')

def act(state, action):
    _, error = Game.apply_action(state, 'p0', action)
    assert error is None, error
    return view(state)

state = make_state(seed=7, count=2, endless_push_interval=0)
views = {'initial': view(state)}
views['wall'] = act(state, {'type': 'shoot', 'angle': 70})
state = make_state(seed=7, count=2, endless_push_interval=0)
blank(state['boards']['p0'], {(0, 0): 'green', (0, 5): 'red', (1, 5): 'red', (2, 6): 'blue', (3, 6): 'yellow'})
state['boards']['p0']['queue'] = ['red', 'blue', 'yellow']
views['clear_before'] = view(state)
views['clear_after'] = act(state, {'type': 'shoot', 'angle': -78})
state = make_state(seed=7, count=2, endless_push_interval=0)
views['hammer'] = act(state, {'type': 'use_item', 'item': 'hammer', 'row': 0, 'col': 5})
state = make_state(seed=7, count=2, endless_push_interval=0)
state['boards']['p0']['queue'] = ['bomb', 'blue', 'yellow']
views['bomb_before'] = view(state)
views['bomb_after'] = act(state, {'type': 'shoot', 'angle': 0})
state = make_state(seed=7, count=2, endless_push_interval=4)
for angle in [0, 25, -25]:
    act(state, {'type': 'shoot', 'angle': angle})
views['push_before'] = view(state)
views['push_after'] = act(state, {'type': 'shoot', 'angle': 0})
print(json.dumps(views))
`], { encoding: 'utf8' }));

async function open(page) {
  page.on('pageerror', error => errors.push(error.message));
  await page.route('https://fonts.googleapis.com/**', route => route.abort());
  await page.goto(base);
  await page.waitForFunction(() => typeof socket !== 'undefined' && socket.connected && cachedGameList);
  assert.equal(await page.locator('script[src*="/bubble_shooter.js"], link[href*="/bubble_shooter.css"]').count(), 0);
  await page.evaluate(() => socket.emit('room:create', { name: 'Bubble Shooter UI QA', game_type: 'bubble_shooter' }));
  await page.waitForFunction(() => roomSessionReady && isGameAssetsLoaded('bubble_shooter'));
  assert.equal(await page.locator('script[src*="/bubble_shooter.js"]').count(), 1);
  assert.equal(await page.locator('link[href*="/bubble_shooter.css"]').count(), 1);
}

async function setupFixtures(page) {
  await page.evaluate(() => {
    window.bsTestActions = [];
    window.bsScene = 0;
    window.bsSeenEffects = [];
    sendAction = action => bsTestActions.push(action);
    const selectors = ['.bs-trail', '.bs-impact.is-wall', '.bs-impact.is-blast', '.bs-bubble.is-bump', '.bs-bubble.is-pop', '.bs-bubble.is-fall', '.bs-score-float', '.bs-launcher.is-firing', '.bs-board.is-shake'];
    new MutationObserver(() => {
      selectors.forEach(selector => {
        if (!bsSeenEffects.includes(selector) && document.querySelector(selector)) bsSeenEffects.push(selector);
      });
    }).observe(document.getElementById('bsBoard'), { subtree: true, childList: true, attributes: true, attributeFilter: ['class', 'hidden'] });
  });
}

async function render(page, view, reset = true) {
  await page.evaluate(({ view, reset }) => {
    if (reset) {
      window.bsScene += 1;
      window.bsTestActions = [];
      window.bsSeenEffects = [];
      playerId = view.you;
      renderRoomState({
        room_id: roomId, game_type: 'bubble_shooter', status: 'in_game', host_id: view.you,
        players: view.ranking.map(entry => ({ ...entry, ready: true, connected: true })), game_config: {}
      });
      setGamePanelVisibility('bubble_shooter');
      setRoomControlsCollapsed(true);
    }
    renderBubbleShooterGameState({ room_id: 'bubble-qa-' + window.bsScene, game_type: 'bubble_shooter', view });
    if (reset) window.scrollTo(0, 0);
  }, { view, reset });
}

async function settled(page) {
  await page.waitForFunction(() => !document.getElementById('bsFireBtn').disabled);
}

async function assertGrid(page, view) {
  const expected = view.grid.flatMap((row, rowIndex) => row.flatMap((value, colIndex) => value == null ? [] : [`${rowIndex},${colIndex}:${value}`])).sort();
  const actual = await page.locator('#bsLayer .bs-bubble').evaluateAll(nodes => nodes.map(node => {
    const color = [...node.classList].find(value => /^is-(red|orange|yellow|green|blue|purple|bomb|rainbow)$/.test(value));
    return `${node.dataset.bsRow},${node.dataset.bsCol}:${color.slice(3)}`;
  }).sort());
  assert.deepEqual(actual, expected);
}

async function assertLayout(page, label) {
  const layout = await page.evaluate(() => {
    const selectors = ['#bsBoard', '.bs-run', '.bs-side', '.bs-loadout', '.bs-controls', '.bs-tools', '#bsFireBtn', '#bsAngleInput', '#bsHammerBtn', '#bsAimBtn', '.game-panel > .panel-header'];
    const bad = selectors.filter(selector => {
      const node = document.querySelector(selector);
      const rect = node.getBoundingClientRect();
      return rect.left < -1 || rect.right > innerWidth + 1 || node.scrollWidth > node.clientWidth + 2;
    });
    const board = document.getElementById('bsBoard').getBoundingClientRect();
    const fire = document.getElementById('bsFireBtn').getBoundingClientRect();
    const items = document.querySelector('.bs-board-items').getBoundingClientRect();
    const reconnect = document.getElementById('gameReconnectBtn').getBoundingClientRect();
    const help = document.getElementById('bubbleShooterHelpBtn').getBoundingClientRect();
    return {
      overflow: document.documentElement.scrollWidth > innerWidth,
      bad,
      boardVisible: board.top >= 0 && board.bottom <= innerHeight,
      fireVisible: fire.bottom <= innerHeight,
      itemsOutside: items.left >= board.right || items.top >= board.bottom,
      headerOneLine: Math.abs((help.top + help.height / 2) - (reconnect.top + reconnect.height / 2)) < 5
    };
  });
  assert.deepEqual(layout, { overflow: false, bad: [], boardVisible: true, fireVisible: true, itemsOutside: true, headerOneLine: true }, label);
}

async function pointerChecks(page) {
  await render(page, fixtures.initial);
  await page.locator('#bsRightBtn').click();
  assert.equal(await page.locator('#bsAngleValue').textContent(), '+0.5°');
  await page.locator('#bsLeftBtn').click();
  assert.equal(await page.locator('#bsAngleValue').textContent(), '0°');
  await page.locator('#bsAngleInput').fill('35.5');
  assert.equal(await page.locator('#bsAngleValue').textContent(), '+35.5°');
  assert.equal(await page.evaluate(() => bsTestActions.length), 0);
  await page.evaluate(() => { document.getElementById('bsFireBtn').click(); document.getElementById('bsFireBtn').click(); });
  assert.deepEqual(await page.evaluate(() => bsTestActions), [{ type: 'shoot', angle: 35.5 }]);
  assert.equal(await page.locator('#bsFireBtn').isDisabled(), true);
  await page.evaluate(() => socket.listeners('system:error').at(-1)({ message: 'Rejected shot' }));
  assert.equal(await page.locator('#bsFireBtn').isEnabled(), true);

  await render(page, fixtures.initial);
  const board = await page.locator('#bsBoard').boundingBox();
  await page.mouse.move(board.x + board.width / 2, board.y + board.height * .65);
  await page.mouse.down();
  await page.mouse.move(board.x - 6, board.y + board.height * .5);
  await page.mouse.up();
  assert.equal(await page.evaluate(() => bsTestActions.length), 0);
  await page.mouse.click(board.x + board.width / 2, board.y + board.height * .65);
  assert.equal(await page.evaluate(() => bsTestActions.length), 1);

  await render(page, fixtures.initial);
  await page.locator('#bsBoard').focus();
  await page.keyboard.press('Shift+ArrowRight');
  assert.equal(await page.locator('#bsAngleValue').textContent(), '+0.5°');
  await page.keyboard.press('Space');
  assert.equal(await page.evaluate(() => bsTestActions[0].type), 'shoot');
  await render(page, fixtures.initial);
  await page.locator('#bsHammerBtn').click();
  assert.equal(await page.locator('#bsFireBtn').isDisabled(), true);
  await page.keyboard.press('Escape');
  assert.equal(await page.locator('#bsFireBtn').isEnabled(), true);

  await page.locator('#bsSoundBtn').click();
  assert.equal(await page.locator('#bsSoundBtn').getAttribute('aria-pressed'), 'true');
  await page.locator('#bsSoundBtn').click();
  assert.equal(await page.evaluate(() => localStorage.getItem('bsSoundEnabled')), 'false');
  await render(page, fixtures.initial);
}

async function effectsChecks(page) {
  await render(page, fixtures.initial);
  await render(page, fixtures.wall, false);
  await page.locator('.bs-trail').first().waitFor();
  await page.screenshot({ path: `${output}/flight.png` });
  await settled(page);
  await assertGrid(page, fixtures.wall);
  const seen = await page.evaluate(() => bsSeenEffects);
  for (const selector of ['.bs-trail', '.bs-impact.is-wall', '.bs-launcher.is-firing', '.bs-bubble.is-bump']) assert(seen.includes(selector), selector);

  await render(page, fixtures.clear_before);
  await render(page, fixtures.clear_after, false);
  await page.locator('.bs-bubble.is-fall').first().waitFor();
  await page.screenshot({ path: `${output}/collision.png` });
  await settled(page);
  await assertGrid(page, fixtures.clear_after);
  for (const selector of ['.bs-bubble.is-pop', '.bs-bubble.is-fall', '.bs-score-float']) assert((await page.evaluate(() => bsSeenEffects)).includes(selector), selector);

  await render(page, fixtures.bomb_before);
  await render(page, fixtures.bomb_after, false);
  await settled(page);
  assert((await page.evaluate(() => bsSeenEffects)).includes('.bs-impact.is-blast'));
  await assertGrid(page, fixtures.bomb_after);

  await render(page, fixtures.initial);
  await render(page, fixtures.hammer, false);
  await settled(page);
  await assertGrid(page, fixtures.hammer);

  await render(page, fixtures.push_before);
  await render(page, fixtures.push_after, false);
  await settled(page);
  assert((await page.evaluate(() => bsSeenEffects)).includes('.bs-board.is-shake'));
  await assertGrid(page, fixtures.push_after);

  await render(page, fixtures.initial);
  await render(page, fixtures.wall, false);
  await page.locator('.bs-fly:not([hidden])').waitFor();
  await page.locator('.bs-score').nth(1).click();
  assert.equal(await page.locator('#bsFireBtn').isDisabled(), true);
  assert.equal(await page.locator('#bsAngleInput').isDisabled(), true);
  assert.equal(await page.locator('#bsHammerBtn').isDisabled(), true);
  assert.equal(await page.locator('#bsFly').isVisible(), false);
  await page.locator('#bsBackBtn').click();
  await assertGrid(page, fixtures.wall);
  await page.waitForTimeout(650);
  await assertGrid(page, fixtures.wall);
  assert.equal(await page.locator('#bsFireBtn').isEnabled(), true);

  await render(page, fixtures.initial);
  await render(page, fixtures.wall, false);
  await page.locator('.bs-fly:not([hidden])').waitFor();
  await render(page, fixtures.initial, false);
  await page.waitForTimeout(650);
  await assertGrid(page, fixtures.initial);
  assert.equal(await page.locator('#bsFly').isVisible(), false);
  assert.equal(await page.locator('#bsFireBtn').isEnabled(), true);

  await page.emulateMedia({ reducedMotion: 'reduce' });
  await render(page, fixtures.clear_before);
  await render(page, fixtures.clear_after, false);
  await settled(page);
  await assertGrid(page, fixtures.clear_after);
  assert.equal(await page.locator('#bsEffects').evaluate(node => node.childElementCount), 0);
  assert.equal(await page.locator('#bsFly').isVisible(), false);
  await page.emulateMedia({ reducedMotion: 'no-preference' });
}

async function helpChecks(page) {
  await render(page, fixtures.initial);
  await page.locator('#bubbleShooterHelpBtn').click();
  await page.locator('.obg-help-dialog[open]').waitFor();
  await page.locator('[data-obg-help-lang="en"]').click();
  await page.locator('[data-obg-help-tab="controls"]').click();
  assert.match(await page.locator('.obg-help-content').textContent(), /slider only aims/);
  await page.keyboard.press('Escape');
  await settled(page);
  assert.equal(await page.locator('#bsFireBtn').isEnabled(), true);
  await page.locator('#bubbleShooterExplainBtn').click({ force: true });
  assert.equal(await page.locator('#bsFireBtn').isDisabled(), true);
  const fire = await page.locator('#bsFireBtn').boundingBox();
  await page.mouse.click(fire.x + fire.width / 2, fire.y + fire.height / 2);
  await page.locator('.obg-explain-dialog[open]').waitFor();
  assert.match(await page.locator('.obg-explain-text').textContent(), /loaded bubble/);
  assert.equal(await page.evaluate(() => bsTestActions.length), 0);
  await page.keyboard.press('Escape');
}

async function standingsChecks(page) {
  const view = structuredClone(fixtures.initial);
  view.player_count = 8;
  view.combo = 5;
  view.score = 123456;
  view.boards.p0.combo = 5;
  view.boards.p0.score = 123456;
  view.ranking = Array.from({ length: 8 }, (_, index) => ({
    ...view.ranking[0], player_id: `p${index}`, name: `Player ${index} with a very long display name`,
    rank: index + 1, seat: index, score: 123456 - index, out: false
  }));
  for (const player of view.ranking) view.boards[player.player_id] = structuredClone(view.boards.p0);
  for (const width of [320, 390]) {
    await page.setViewportSize({ width, height: 844 });
    await render(page, view);
    await assertLayout(page, `Eight players ${width}`);
    const out = structuredClone(view);
    out.board_out = true;
    out.boards.p0.board_out = true;
    out.legal_actions = [];
    await render(page, out, false);
    assert.equal(await page.locator('#bsOverlay').isVisible(), true);
    await page.locator('.bs-score').nth(1).click();
    assert.equal(await page.locator('#bsOverlay').isVisible(), false);
    await page.locator('#bsBackBtn').click();
    assert.equal(await page.locator('#bsOverlay').isVisible(), true);
    out.game_over = true;
    out.winner_ids = ['p0'];
    await render(page, out, false);
    assert.equal(await page.locator('.bs-overlay-row').count(), 8);
    assert.equal(await page.locator('.bs-overlay-card').evaluate(node => node.scrollWidth > node.clientWidth), false);
    await page.screenshot({ path: `${output}/results-${width}.png`, fullPage: true });
    await page.locator('.bs-overlay-actions button').click();
    assert.deepEqual(await page.evaluate(() => bsTestActions), [{ type: 'play_again' }]);
  }
}

async function touchChecks(browser, width) {
  const context = await browser.newContext({ viewport: { width, height: 844 }, hasTouch: true, isMobile: true });
  const page = await context.newPage();
  try {
    await open(page);
    await setupFixtures(page);
    await render(page, fixtures.initial);
    await assertLayout(page, `Touch ${width}`);
    const session = await context.newCDPSession(page);
    const board = await page.locator('#bsBoard').boundingBox();
    const origin = { x: board.x + board.width / 2, y: board.y + board.height * .68 };
    const touch = (type, points) => session.send('Input.dispatchTouchEvent', { type, touchPoints: points });
    await touch('touchStart', [origin]);
    await touch('touchMove', [{ x: 3, y: origin.y - 35 }]);
    await touch('touchEnd', []);
    assert.equal(await page.evaluate(() => bsTestActions.length), 0);
    await touch('touchStart', [origin]);
    await touch('touchMove', [{ x: origin.x + 30, y: origin.y - 35 }]);
    await touch('touchCancel', []);
    assert.equal(await page.evaluate(() => bsTestActions.length), 0);
    await touch('touchStart', [origin]);
    await touch('touchMove', [{ x: origin.x + 30, y: origin.y - 35 }]);
    await touch('touchEnd', []);
    assert.equal(await page.evaluate(() => bsTestActions.length), 1);
    assert.equal(await page.evaluate(() => scrollY), 0);

    await render(page, fixtures.initial);
    await page.locator('#bsHammerBtn').tap();
    const bubble = { x: board.x + board.width * .5, y: board.y + board.width * .433 / 11 };
    await touch('touchStart', [bubble]);
    await touch('touchMove', [{ x: bubble.x + 35, y: bubble.y + 35 }]);
    await touch('touchEnd', []);
    assert.equal(await page.evaluate(() => bsTestActions.length), 0);
    await page.touchscreen.tap(bubble.x, bubble.y);
    assert.deepEqual(await page.evaluate(() => bsTestActions[0]), { type: 'use_item', item: 'hammer', row: 0, col: 5 });

    await render(page, fixtures.initial);
    const slider = await page.locator('#bsAngleInput').boundingBox();
    await touch('touchStart', [{ x: slider.x + slider.width / 2, y: slider.y + slider.height / 2 }]);
    await touch('touchMove', [{ x: slider.x + slider.width * .8, y: slider.y + slider.height / 2 }]);
    await touch('touchEnd', []);
    assert.equal(await page.evaluate(() => bsTestActions.length), 0);
    await page.locator('#bsFireBtn').tap();
    assert.equal(await page.evaluate(() => bsTestActions.length), 1);

    await render(page, fixtures.initial);
    await page.locator('#bsStats').tap();
    await page.locator('#bsTip').waitFor({ state: 'visible' });
    await page.locator('#bsQueue').tap();
    assert.match(await page.locator('#bsTip').textContent(), /队列|queue/i);
    await page.locator('#bsTip').waitFor({ state: 'hidden', timeout: 4000 });
    await page.locator('.bs-history summary').tap();
    await page.setViewportSize({ width, height: 640 });
    await page.evaluate(() => window.scrollTo(0, 0));
    const beforeScroll = await page.evaluate(() => scrollY);
    const tools = await page.locator('.bs-tools').boundingBox();
    await touch('touchStart', [{ x: width / 2, y: tools.y + tools.height / 2 }]);
    await touch('touchMove', [{ x: width / 2, y: tools.y - 110 }]);
    await touch('touchEnd', []);
    await page.waitForTimeout(150);
    assert((await page.evaluate(() => scrollY)) > beforeScroll, 'The area outside the board scrolls normally');
    assert.equal(await page.evaluate(() => bsTestActions.length), 0);
    await page.setViewportSize({ width, height: 844 });
    await page.evaluate(() => { document.querySelector('.bs-history').open = false; window.scrollTo(0, 0); });
    await page.screenshot({ path: `${output}/touch-${width}.png`, fullPage: true });
    console.log(`Touch ${width}: aim, cancel, hammer, slider, hints and outside scroll passed.`);
  } finally {
    await page.evaluate(() => socket.emit('room:leave', { room_id: roomId })).catch(() => {});
    await context.close();
  }
}

async function liveChecks(browser) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  try {
    await open(page);
    await page.evaluate(() => socket.emit('room:ready', { room_id: roomId, ready: true }));
    await page.waitForFunction(() => !document.getElementById('startBtn').disabled);
    await page.evaluate(() => emitRoomStart());
    await page.waitForFunction(() => lastGameStatePayload?.game_type === 'bubble_shooter');
    await page.evaluate(() => setRoomControlsCollapsed(true));
    await page.locator('#bsRightBtn').click();
    await page.evaluate(() => { document.getElementById('bsFireBtn').click(); document.getElementById('bsFireBtn').click(); });
    await page.waitForFunction(() => lastGameStatePayload.view.shots === 1);
    await settled(page);
    assert.equal(await page.evaluate(() => lastGameStatePayload.view.last_shot.angle), .5);
    await page.locator('#bsAimBtn').click();
    await page.waitForFunction(() => lastGameStatePayload.view.aim_left > 0);
    assert.equal(await page.locator('#bsGhost').isVisible(), true);
    await page.reload();
    await page.waitForFunction(() => isGameAssetsLoaded('bubble_shooter') && lastGameStatePayload?.view?.shots === 1);
    await settled(page);
    await assertGrid(page, await page.evaluate(() => lastGameStatePayload.view));
    await page.locator('#bsRestartBtn').click();
    await page.waitForFunction(() => lastGameStatePayload.view.shots === 0);
    await settled(page);
    console.log('Live play, one-shot lock, aim power-up, reload/reconnect and restart passed.');
  } finally {
    await page.evaluate(() => socket.emit('room:leave', { room_id: roomId })).catch(() => {});
    await context.close();
  }
}

(async () => {
  fs.mkdirSync(output, { recursive: true });
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const page = await context.newPage();
  try {
    await open(page);
    await setupFixtures(page);
    for (const [width, height] of [[1440, 1000], [1024, 900], [390, 844], [320, 740]]) {
      await page.setViewportSize({ width, height });
      await render(page, fixtures.initial);
      await assertLayout(page, `Layout ${width}`);
      await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
      await page.screenshot({ path: `${output}/layout-${width}.png`, fullPage: true });
    }
    await page.setViewportSize({ width: 1024, height: 900 });
    await pointerChecks(page);
    await effectsChecks(page);
    await helpChecks(page);
    await standingsChecks(page);
    console.log('Four widths, pointer/keyboard, replay effects, cancellation, reduced motion and Help/Explain passed.');
    await touchChecks(browser, 320);
    await touchChecks(browser, 390);
    await liveChecks(browser);
    assert.deepEqual(errors, []);
    console.log(`Bubble Shooter UI passed. Screenshots: ${output}`);
  } finally {
    await page.evaluate(() => socket.emit('room:leave', { room_id: roomId })).catch(() => {});
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
