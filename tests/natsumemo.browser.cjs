const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { execFileSync } = require('node:child_process');

const base = process.env.ROOM_TEST_URL || 'http://127.0.0.1:8766';
const output = 'tmp/natsumemo-ui';
const errors = [];
const fixtures = JSON.parse(execFileSync(process.env.PYTHON || 'python3', ['-c', `
import json
from tests.test_natsumemo import game, start, respond, finish, submit
from game.natsumemo import NatsumemoGame as Game, _study
def allocate(state):
    for pid in list(state['pending_hearts']):
        pending = state['pending_hearts'][pid]
        submit(state, pid, 'allocate', hearts={pending['recipients'][0]: pending['amount']})
state = game(6)
start(state)
speaker = state['speaker']
views = {'propose': Game.get_public_view(state, speaker)}
submit(state, speaker, 'propose', day=0)
views['respond'] = Game.get_public_view(state, speaker)
for pid in state['turn_order']:
    submit(state, pid, 'respond', attend=True)
views['allocate'] = Game.get_public_view(state, speaker)
allocate(state)
views['review'] = Game.get_public_view(state, speaker)
finish(state)
views['final'] = Game.get_public_view(state, speaker)
state = game(6)
start(state, 'w2_boardgames')
respond(state, state['turn_order'])
views['contest'] = Game.get_public_view(state, speaker)
state = game(6)
start(state)
_study(state)
allocate(state)
views['week_review'] = Game.get_public_view(state, speaker)
for view in views.values():
    for player in view['players']:
        if player['player_id'] != speaker:
            player['name'] = 'A very long player name for calendar layout testing'
print(json.dumps(views))
`], { encoding: 'utf8' }));
let revision = 1000;

async function open(page) {
  page.on('pageerror', error => errors.push(error.message));
  await page.route('https://fonts.googleapis.com/**', route => route.abort());
  await page.goto(base);
  await page.waitForFunction(() => typeof socket !== 'undefined' && socket.connected && cachedGameList);
  await page.evaluate(() => socket.emit('room:create', { name: 'Natsumemo UI QA', game_type: 'natsumemo' }));
  await page.waitForFunction(() => roomSessionReady && isGameAssetsLoaded('natsumemo'));
}

async function render(page, view) {
  await page.evaluate(view => {
    playerId = view.you;
    renderRoomState({ room_id: roomId, game_type: 'natsumemo', status: 'in_game', host_id: view.you, players: view.players, game_config: {} });
    setGamePanelVisibility('natsumemo');
    renderNatsumemoGameState({ room_id: roomId, game_type: 'natsumemo', view });
    setRoomControlsCollapsed(true);
    window.scrollTo(0, 0);
  }, { ...view, revision: revision++ });
}

async function bounds(page, label) {
  const issues = await page.evaluate(() => {
    const elements = [...document.querySelectorAll('#natsumemoPanel *, .game-panel > .panel-header *, .obg-help-dialog[open] *')];
    const bad = elements.filter(element => {
      const box = element.getBoundingClientRect();
      const style = getComputedStyle(element);
      if (!box.width || !box.height || element.closest('details:not([open])') && !element.matches('summary')) return false;
      if (element.closest('dialog:not([open])')) return false;
      return box.left < -1 || box.right > innerWidth + 1 || element.clientWidth && element.scrollWidth > element.clientWidth + 2 && !['auto', 'scroll', 'hidden', 'clip'].includes(style.overflowX);
    }).map(element => `${element.id || element.className}: ${element.textContent.slice(0, 45)}`);
    return { overflow: document.documentElement.scrollWidth > innerWidth, bad };
  });
  assert.deepEqual(issues, { overflow: false, bad: [] }, label);
}

async function interactions(page) {
  const own = page.locator('.nm-player.is-you');
  await own.locator('button.nm-day').first().click();
  assert.equal(await own.locator('.nm-plan-confirm').count(), 1);
  assert.equal(await page.locator('#natsumemoTooltip').isVisible(), false);
  await page.keyboard.press('Escape');
  assert.equal(await own.locator('.nm-plan-confirm').count(), 0);
  await own.locator('button.nm-day').first().click();
  await page.locator('.nm-intro').click();
  assert.equal(await own.locator('.nm-plan-confirm').count(), 0);
  await own.locator('button.nm-day').first().click();
  await own.getByRole('button', { name: 'Propose', exact: true }).click();
  assert.equal(await page.evaluate(() => natsumemoTestActions.at(-1).type), 'propose');
  await render(page, fixtures.propose);
  await page.locator('#natsumemoHelpBtn').click();
  const help = page.locator('dialog[data-obg-help-game="natsumemo"]');
  await help.waitFor({ state: 'visible' });
  await help.locator('[data-obg-help-lang="en"]').click();
  await help.locator('[data-obg-help-tab="final"]').click();
  assert.match(await help.innerText(), /25/);
  await bounds(page, 'English Help');
  await help.locator('[data-obg-help-lang="zh"]').click();
  await page.keyboard.press('Escape');
  await page.locator('#natsumemoExplainBtn').click();
  const disabled = page.locator('#natsumemoWeeks button').last();
  await disabled.scrollIntoViewIfNeeded();
  const box = await disabled.boundingBox();
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  await page.locator('.obg-explain-dialog[open]').waitFor();
  assert.equal(await page.locator('#natsumemoExplainBtn').getAttribute('aria-pressed'), 'false');
  await page.keyboard.press('Escape');
  await page.locator('#natsumemoExplainBtn').click();
  await page.locator('#settingsBtn').click();
  assert.equal(await page.locator('#settingsOverlay').isVisible(), false);
  await page.keyboard.press('Escape');
  await render(page, fixtures.respond);
  await page.locator('#natsumemoControls').getByRole('button', { name: '🙋 Join', exact: true }).click();
  assert.equal(await page.evaluate(() => natsumemoTestActions.at(-1).attend), true);
  await render(page, fixtures.contest);
  await page.locator('#natsumemoControls').getByRole('button', { name: 'Choose 6', exact: true }).click();
  assert.equal(await page.evaluate(() => natsumemoTestActions.at(-1).value), 6);
  await render(page, fixtures.allocate);
  const plus = page.locator('.nm-allocation-row button').nth(1);
  const before = await page.evaluate(() => scrollY);
  await plus.click();
  assert.equal(await page.locator('.nm-allocation-row output').first().textContent(), '1');
  assert(Math.abs(await page.evaluate(() => scrollY) - before) < 250);
  await page.locator('#natsumemoControls').getByRole('button', { name: 'Confirm', exact: true }).click();
  assert.equal(await page.evaluate(() => natsumemoTestActions.at(-1).type), 'allocate');
  await render(page, fixtures.review);
  await page.locator('#natsumemoNext').click();
  assert.equal(await page.evaluate(() => natsumemoTestActions.at(-1).type), 'next_round');
}

async function touchChecks(browser, width) {
  const context = await browser.newContext({ viewport: { width, height: 844 }, isMobile: true, hasTouch: true });
  const page = await context.newPage();
  await open(page);
  await render(page, fixtures.propose);
  assert.equal(await page.locator('#natsumemoFriends').getAttribute('open'), null);
  const target = page.locator('.nm-player.is-you button.nm-day').first();
  await target.scrollIntoViewIfNeeded();
  const box = await target.boundingBox();
  const session = await context.newCDPSession(page);
  const point = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
  await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [point] });
  await session.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: point.x, y: point.y - 65 }] });
  await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  assert.equal(await page.locator('.nm-plan-confirm').count(), 0);
  await target.tap();
  assert.equal(await page.locator('.nm-plan-confirm').count(), 1);
  assert.equal(await page.locator('#natsumemoTooltip').isVisible(), false);
  await page.locator('#natsumemoProgress').tap();
  await page.locator('#natsumemoTooltip').waitFor({ state: 'visible' });
  await page.locator('.nm-legend [data-nm-explain="study"]').tap();
  assert.match(await page.locator('#natsumemoTooltip').textContent(), /学习会/);
  await page.locator('#natsumemoTooltip').waitFor({ state: 'hidden', timeout: 4000 });
  await page.locator('#natsumemoFriends > summary').tap();
  assert.equal(await page.locator('#natsumemoOtherCalendars .nm-player').count(), 5);
  await bounds(page, `Touch ${width}`);
  await page.screenshot({ path: `${output}/touch-${width}.png`, fullPage: true });
  await page.evaluate(() => socket.emit('room:leave', { room_id: roomId }));
  await context.close();
}

async function liveChecks(browser) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  await open(page);
  for (const count of [2, 3]) {
    await page.evaluate(() => socket.emit('room:add_bot', { room_id: roomId }));
    await page.waitForFunction(count => currentRoomState.players.length === count, count);
  }
  await page.evaluate(() => socket.emit('room:ready', { room_id: roomId, ready: true }));
  await page.waitForFunction(() => !document.getElementById('startBtn').disabled);
  await page.evaluate(() => socket.emit('room:start', { room_id: roomId }));
  await page.waitForFunction(() => lastGameStatePayload?.view?.phase === 'setup');
  const originalRoom = await page.evaluate(() => roomId);
  await page.reload();
  await page.waitForFunction(() => isGameAssetsLoaded('natsumemo') && lastGameStatePayload?.view?.phase === 'setup');
  assert.equal(await page.evaluate(() => roomId), originalRoom);
  await page.locator('#natsumemoControls button:enabled').first().click();
  await page.waitForFunction(() => lastGameStatePayload?.view?.phase !== 'setup');
  await page.waitForFunction(() => lastGameStatePayload?.view?.legal_actions?.length);
  await bounds(page, 'Live reload');
  for (let step = 0; step < 240; step++) {
    await page.waitForFunction(() => lastGameStatePayload?.view?.game_over || lastGameStatePayload?.view?.legal_actions?.length, null, { timeout: 20000 });
    const view = await page.evaluate(() => lastGameStatePayload.view);
    if (view.game_over) break;
    if (view.legal_actions.includes('propose')) {
      await page.locator('.nm-player.is-you button.nm-day:enabled').first().click();
      await page.locator('.nm-plan-confirm').getByRole('button', { name: 'Propose', exact: true }).click();
    } else if (view.legal_actions.includes('respond')) {
      await page.locator('#natsumemoControls').getByRole('button', { name: '🙋 Join', exact: true }).click();
    } else if (view.legal_actions.includes('choose_die')) {
      await page.getByRole('button', { name: 'Choose 6', exact: true }).click();
    } else if (view.legal_actions.includes('allocate')) {
      for (let heart = 0; heart < view.private.pending.amount; heart++) {
        await page.locator('.nm-allocation-row button[aria-label^="Add heart to"]:enabled').first().click();
      }
      await page.locator('#natsumemoControls').getByRole('button', { name: 'Confirm', exact: true }).click();
    } else {
      await page.locator('#natsumemoNext').click();
    }
    await page.waitForFunction(previous => lastGameStatePayload.view.revision !== previous, view.revision);
  }
  assert.equal(await page.evaluate(() => lastGameStatePayload.view.game_over), true);
  await bounds(page, 'Live final');
  await page.screenshot({ path: `${output}/live-final-390.png`, fullPage: true });
  await page.evaluate(() => socket.emit('room:leave', { room_id: roomId }));
  await context.close();
}

(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  try {
    fs.mkdirSync(output, { recursive: true });
    const page = await browser.newPage({ viewport: { width: 390, height: 900 } });
    await open(page);
    await page.evaluate(() => {
      window.natsumemoTestActions = [];
      const original = socket.emit.bind(socket);
      socket.emit = (event, ...args) => event === 'game:action' ? natsumemoTestActions.push(args[0].action) : original(event, ...args);
    });
    for (const width of [320, 390, 1024, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      await render(page, fixtures.propose);
      await bounds(page, `Propose ${width}`);
      await page.screenshot({ path: `${output}/propose-${width}.png`, fullPage: true });
      await interactions(page);
      for (const phase of ['review', 'week_review', 'final']) {
        await render(page, fixtures[phase]);
        await page.locator('#natsumemoFriends').evaluate(node => { node.open = true; });
        await bounds(page, `${phase} ${width}`);
        if (phase === 'review') assert.equal(await page.locator('.nm-player.is-you .nm-day.is-conflict').count(), 0);
        if (phase === 'final') assert.match(await page.locator('#natsumemoStudyHint').textContent(), /Summer complete/);
        await page.screenshot({ path: `${output}/${phase}-${width}.png`, fullPage: true });
      }
      console.log(`Natsumemo ${width}px: six-player layout, selection, allocation, Help, Explain and review passed`);
    }
    await page.evaluate(() => socket.emit('room:leave', { room_id: roomId }));
    await touchChecks(browser, 320);
    await touchChecks(browser, 390);
    await liveChecks(browser);
    assert.deepEqual(errors, []);
    console.log('Touch scrolling/tooltips and a complete live game with start/reload/reconnect passed without JavaScript errors.');
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
