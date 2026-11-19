const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { execFileSync } = require('node:child_process');

const base = process.env.ROOM_TEST_URL || 'http://127.0.0.1:8766';
const output = 'tmp/bohnanza-dice-ui';
const errors = [];
const fixtures = JSON.parse(execFileSync(process.env.PYTHON || 'python3', ['-c', `
import json
from game.bohnanza_dice import BohnanzaDiceGame as Game, ORDER_LIBRARY
from tests.test_bohnanza_dice import make_players
views = {}
for count in (2, 5):
    state = Game.init_game({'seed': 'bohnanza-ui'}, make_players(count))
    actor = state['active_player_id']
    views[str(count)] = Game.get_public_view(state, actor)
    Game.apply_action(state, actor, {'type': 'roll'})
    views['roll'] = Game.get_public_view(state, actor)
views['orders'] = list(ORDER_LIBRARY.values())
print(json.dumps(views))
`], { encoding: 'utf8' }));

async function render(page, view) {
  await page.evaluate(view => {
    playerId = view.you;
    currentGameType = 'bohnanza_dice';
    renderRoomState({ room_id: 'bohnanza-ui', game_type: 'bohnanza_dice', status: 'in_game',
      host_id: view.you, players: view.players, game_config: {} });
    setGamePanelVisibility('bohnanza_dice');
    showBohnanzaDiceHeaderActions(true);
    renderBohnanzaDiceGameState({ view });
    setRoomControlsCollapsed(true);
  }, view);
}

async function bounds(page, label) {
  const result = await page.evaluate(() => {
    const rows = [...document.querySelectorAll('.bohnanza-dice-order-row')].filter(row => row.offsetHeight);
    const clipped = rows.filter(row => {
      const box = row.getBoundingClientRect();
      return row.scrollWidth > row.clientWidth + 1 || [...row.querySelectorAll('span, b, strong')].some(node => {
        const child = node.getBoundingClientRect();
        return child.width && (child.left < box.left - 1 || child.right > box.right + 1
          || child.top < box.top - 1 || child.bottom > box.bottom + 1);
      });
    }).map(row => row.getAttribute('aria-label'));
    const overlaps = [];
    rows.forEach(row => {
      const boxes = [...row.children].map(node => node.getBoundingClientRect());
      boxes.slice(1).forEach((box, index) => {
        if (box.left < boxes[index].right - 1) overlaps.push(row.getAttribute('aria-label'));
      });
    });
    const buttons = ['bohnanzaDiceHelpBtn', 'bohnanzaDiceExplainBtn', 'gameReconnectBtn']
      .map(id => document.getElementById(id)).filter(node => node && node.offsetHeight)
      .map(node => ({ text: node.textContent.trim(), top: node.getBoundingClientRect().top,
        height: node.getBoundingClientRect().height }));
    return { overflow: document.documentElement.scrollWidth > innerWidth, clipped, overlaps, buttons,
      players: document.querySelector('.bohnanza-dice-players').getBoundingClientRect().width,
      rowWidth: rows[0]?.getBoundingClientRect().width };
  });
  assert.equal(result.overflow, false, `${label}: page overflow`);
  assert.deepEqual(result.clipped, [], `${label}: clipped order content`);
  assert.deepEqual(result.overlaps, [], `${label}: overlapping order columns`);
  assert(result.buttons.every(button => button.height < 50), `${label}: wrapped header buttons`);
  const help = result.buttons.find(button => button.text === 'Help');
  const reconnect = result.buttons.find(button => button.text === 'Reconnect');
  assert(help && reconnect && Math.abs(help.top - reconnect.top) < 4, `${label}: Help/Reconnect wrap`);
  return result;
}

async function helpChecks(page) {
  await page.locator('#bohnanzaDiceHelpBtn').click();
  const modal = page.locator('#bohnanzaDiceHelpModal');
  await modal.waitFor({ state: 'visible' });
  assert.match(await page.locator('#bohnanzaDiceHelpContent').innerText(), /如何获胜/);
  await page.locator('[data-bohnanza-dice-help-language="en"]').click();
  assert.match(await page.locator('#bohnanzaDiceHelpContent').innerText(), /How you win/);
  for (const section of ['orders', 'dice', 'harvest', 'digital']) {
    await page.locator(`[data-bohnanza-dice-help-section="${section}"]`).click();
    assert((await page.locator('#bohnanzaDiceHelpContent').innerText()).length > 100);
    const fits = await modal.evaluate(node => {
      const box = node.querySelector('.modal-content').getBoundingClientRect();
      const header = node.querySelector('.modal-header');
      const title = header.querySelector('h2').getBoundingClientRect();
      const close = header.querySelector('button').getBoundingClientRect();
      return box.left >= 0 && box.right <= innerWidth && box.top >= 0 && box.bottom <= innerHeight
        && title.right <= close.left && close.right <= box.right;
    });
    assert(fits, `Help section ${section} exceeds viewport`);
  }
  await page.locator('[data-bohnanza-dice-help-language="zh"]').click();
  await page.locator('[data-bohnanza-dice-help-section="basics"]').click();
  await page.locator('#bohnanzaDiceHelpCloseBtn').focus();
  await page.keyboard.press('Shift+Tab');
  assert.equal(await page.evaluate(() => document.activeElement.dataset.bohnanzaDiceHelpSection), 'digital');
  await page.keyboard.press('Tab');
  assert.equal(await page.evaluate(() => document.activeElement.id), 'bohnanzaDiceHelpCloseBtn');
  await page.keyboard.press('Escape');
  assert.equal(await modal.isVisible(), false);
}

async function interactions(page, mobile) {
  const first = page.locator('.bohnanza-dice-player.is-self');
  const toggle = first.locator('.bohnanza-dice-cover-toggle');
  await toggle.click();
  assert.equal(await toggle.getAttribute('aria-expanded'), 'true');
  await bounds(page, 'expanded cover');
  await render(page, fixtures['5']);
  assert.equal(await first.locator('.bohnanza-dice-cover-toggle').getAttribute('aria-expanded'), 'true');
  await first.locator('.bohnanza-dice-cover-toggle').click();
  const row = first.locator('.is-current .bohnanza-dice-order-row').last();
  if (mobile) await row.tap();
  else await row.hover();
  await page.locator('#bohnanzaDiceTooltip').waitFor({ state: 'visible' });
  assert.match(await page.locator('#bohnanzaDiceTooltip').innerText(), /Need:/);
  if (mobile) {
    const other = first.locator('.is-current .bohnanza-dice-order-row').nth(1);
    await other.tap();
    assert.match(await page.locator('#bohnanzaDiceTooltip').innerText(), /Order 3/);
    await page.locator('#bohnanzaDiceTooltip').waitFor({ state: 'hidden', timeout: 4000 });
  }
  await page.keyboard.press('Escape');
  await page.locator('#bohnanzaDiceExplainBtn').click();
  await row.click();
  await page.locator('#bohnanzaDiceExplainModal').waitFor({ state: 'visible' });
  assert.match(await page.locator('#bohnanzaDiceExplainContent').innerText(), /Need:/);
  assert.equal(await page.locator('#bohnanzaDiceExplainBtn').getAttribute('aria-pressed'), 'false');
  await page.keyboard.press('Escape');
  await page.locator('#bohnanzaDiceExplainBtn').click();
  const actionsBefore = await page.evaluate(() => window.bohnanzaDiceTestActions.length);
  await page.locator('#bohnanzaDiceSaveBtn').scrollIntoViewIfNeeded();
  const button = await page.locator('#bohnanzaDiceSaveBtn').boundingBox();
  await page.mouse.click(button.x + button.width / 2, button.y + button.height / 2);
  await page.locator('#bohnanzaDiceExplainModal').waitFor({ state: 'visible' });
  await page.keyboard.press('Escape');
  assert.equal(await page.evaluate(() => window.bohnanzaDiceTestActions.length), actionsBefore);
  await helpChecks(page);

  await render(page, fixtures.roll);
  const dice = page.locator('.bohnanza-dice-die:visible:not(:disabled)');
  await dice.first().click();
  assert.equal(await dice.first().getAttribute('aria-pressed'), 'true');
  await page.locator('#bohnanzaDiceSaveBtn').click();
  assert.equal(await page.evaluate(() => window.bohnanzaDiceTestActions.at(-1).type), 'save_dice');
  await render(page, fixtures.roll);
  await dice.first().click();
  await page.locator('#bohnanzaDicePlayersHeading').click();
  assert.equal(await dice.first().getAttribute('aria-pressed'), 'false');
  if (mobile) {
    const tray = await page.locator('.bohnanza-dice-mobile-lane').boundingBox();
    assert(tray.width > 200);
    const lines = await dice.evaluateAll(nodes => nodes.map(node => node.getBoundingClientRect().top));
    assert(lines.every(top => Math.abs(top - lines[0]) < 2), 'mobile dice wrap');
    const session = await page.context().newCDPSession(page);
    await first.locator('.is-current .bohnanza-dice-order-row').first().scrollIntoViewIfNeeded();
    const box = await first.locator('.is-current .bohnanza-dice-order-row').first().boundingBox();
    const point = { x: box.x + box.width / 2, y: Math.min(box.y + box.height / 2, 750) };
    await page.keyboard.press('Escape');
    await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [point] });
    for (let step = 1; step <= 6; step += 1) {
      await session.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: point.x, y: point.y - step * 18 }] });
    }
    await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    assert.equal(await page.locator('#bohnanzaDiceTooltip').isVisible(), false, 'scroll opens tooltip');
    await session.detach();
  }
}

async function catalogChecks(page) {
  for (let offset = 0; offset < fixtures.orders.length; offset += 5) {
    const view = JSON.parse(JSON.stringify(fixtures['2']));
    const orders = fixtures.orders.slice(offset, offset + 5);
    view.players = [view.players.find(player => player.player_id === view.you)];
    view.players[0].top_card.orders_bottom_to_top = orders;
    await render(page, view);
    await bounds(page, `catalog ${offset}`);
    const counts = await page.locator('.is-current .bohnanza-dice-order-row').evaluateAll(rows => rows.reverse().map(row =>
      [...row.querySelectorAll('.bohnanza-dice-order-group')].map(group =>
        [...group.querySelectorAll('.bohnanza-dice-order-slot')].reduce((total, slot) => total + Number(slot.dataset.count), 0))));
    assert.deepEqual(counts, orders.map(order => order.alternatives.map(branch => branch.slots.length)), 'grouped counts change required dice');
  }
}

(async () => {
  fs.mkdirSync(output, { recursive: true });
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  try {
    for (const width of [320, 390, 1024, 1440]) {
      const context = await browser.newContext({ viewport: { width, height: 960 }, isMobile: width < 720, hasTouch: width < 720 });
      const page = await context.newPage();
      page.on('pageerror', error => errors.push(error.message));
      await page.route('https://fonts.googleapis.com/**', route => route.abort());
      await page.goto(base);
      await page.waitForFunction(() => typeof socket !== 'undefined' && socket.connected && cachedGameList);
      await page.evaluate(async () => {
        await ensureGameAssets('bohnanza_dice');
        window.bohnanzaDiceTestActions = [];
        window.sendAction = action => window.bohnanzaDiceTestActions.push(action);
      });
      await render(page, fixtures['5']);
      console.log(`${width}px`, await bounds(page, `${width}px five players`));
      await page.locator('.bohnanza-dice-player.is-self').evaluate(node => node.scrollIntoView({ block: 'start' }));
      await page.screenshot({ path: `${output}/${width}.png` });
      await interactions(page, width < 720);
      await catalogChecks(page);
      const completed = JSON.parse(JSON.stringify(fixtures['2']));
      completed.players.forEach(player => { player.completed_count = 3; });
      completed.players[0].name = 'A very long player name to verify ellipsis without pushing the score or the card';
      await render(page, completed);
      await bounds(page, `${width}px completed and long name`);
      assert.equal(await page.locator('.is-current .bohnanza-dice-order-row.is-complete').count(), 6);
      await page.locator('#bohnanzaDiceHelpBtn').click();
      await page.locator('[data-bohnanza-dice-help-section="orders"]').click();
      await page.screenshot({ path: `${output}/${width}-help.png` });
      await page.keyboard.press('Escape');
      await context.close();
    }
    assert.deepEqual(errors, [], 'browser errors');
    console.log('Bohnanza Dice: four widths, all 55 conditions, covers, tips, Help, Explain, and dice interactions passed.');
  } finally {
    await browser.close();
  }
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
