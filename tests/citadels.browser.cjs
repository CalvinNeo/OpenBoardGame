const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const base = process.env.ROOM_TEST_URL || 'http://127.0.0.1:8766';
const output = 'tmp/citadels-ui';
const district = (index, cost = 2) => ({
  id: `district-${index}`, name_cn: ['市场', '庄园', '城塞', '大学', '修道院'][index % 5],
  name_en: ['Market', 'Manor', 'Keep', 'University', 'Monastery'][index % 5],
  color: ['green', 'yellow', 'red', 'purple', 'blue'][index % 5], cost,
  text: index % 5 === 3 ? '计分时额外 +2。' : '',
});
const players = Array.from({ length: 6 }, (unused, index) => ({
  player_id: `p${index}`, name: index === 2 ? 'A very long player name for layout testing' : `Player ${index + 1}`,
  gold: 4 + index, hand_count: 5, city_count: 5, city: Array.from({ length: 5 }, (unused, card) => district(index * 5 + card)),
  has_crown: index === 0, revealed_roles: index === 1 ? [{ rank: 4, name_cn: '国王' }] : [], hidden_role_count: 1,
}));
const playing = {
  game_id: 'citadels', you: 'p0', phase: 'turn', round: 4, max_rank: 9, character_mode: 'queen9',
  crown_holder: 'p0', crown_holder_name: 'Player 1', current_turn_player: 'p0', winning_city_size: 8,
  current_turn_role: { rank: 3, name_cn: '魔术师', step: 'main', builds_used: 0, build_limit: 1 },
  players, your_roles: [{ rank: 3, name_cn: '魔术师', revealed: true }],
  your_hand: Array.from({ length: 16 }, (unused, index) => district(50 + index, index === 0 ? 6 : 2)),
  legal_actions: ['build', 'magician_redraw', 'magician_swap', 'end_turn'], action_options: {},
  recent_log: Array.from({ length: 30 }, (unused, index) => `Public event ${index + 1}: Player 2 built a district.`),
  draft_face_up_removed: [{ rank: 9, name_cn: '皇后' }],
};

async function render(page, view) {
  await page.evaluate(view => {
    playerId = view.you;
    renderRoomState({ room_id: roomId, game_type: 'citadels', status: 'in_game', host_id: 'p0', players: view.players, game_config: {} });
    setGamePanelVisibility('citadels');
    renderCitadelsGameState({ game_type: 'citadels', view });
    setRoomControlsCollapsed(true);
    window.scrollTo(0, 0);
  }, view);
}

async function bounds(page, label) {
  const issues = await page.evaluate(() => {
    const elements = [...document.querySelectorAll('#citadelsPanel *, .game-panel > .panel-header *, .obg-help-dialog[open] *')];
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
  await page.evaluate(() => { citadelsTestActions.length = 0; });
  const hand = page.locator('#citadelsHand');
  await render(page, { ...playing, players: players.map(player => ({ ...player, city: [], city_count: 0 })) });
  await hand.getByRole('button', { name: 'Build', exact: true }).nth(1).click();
  assert.equal(await page.evaluate(() => citadelsTestActions.length), 0);
  await page.locator('.citadels-confirmation').getByRole('button', { name: 'Cancel', exact: true }).click();
  assert.equal(await page.locator('.citadels-confirmation').count(), 0);
  await hand.getByRole('button', { name: 'Build', exact: true }).nth(1).click();
  await page.keyboard.press('Escape');
  assert.equal(await page.locator('.citadels-confirmation').count(), 0);
  await hand.getByRole('button', { name: 'Build', exact: true }).nth(1).click();
  await page.locator('.citadels-confirmation').getByRole('button', { name: 'Confirm', exact: true }).click();
  assert.deepEqual(await page.evaluate(() => citadelsTestActions.at(-1)), { type: 'build', card_id: 'district-51' });

  const actionCount = await page.evaluate(() => citadelsTestActions.length);
  await page.locator('#citadelsExplainBtn').click();
  const disabled = hand.getByRole('button', { name: 'Build', exact: true }).first();
  const box = await disabled.boundingBox();
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  await page.locator('.obg-explain-dialog[open]').waitFor();
  assert.match(await page.locator('.obg-explain-text').textContent(), /Need 2 more gold/);
  assert.equal(await page.evaluate(() => citadelsTestActions.length), actionCount);
  await page.keyboard.press('Escape');
  await page.locator('#citadelsExplainBtn').click();
  await page.keyboard.press('Escape');
  assert.equal(await page.locator('#citadelsExplainBtn').getAttribute('aria-pressed'), 'false');

  await hand.getByRole('button', { name: 'Select for Redraw', exact: true }).nth(10).scrollIntoViewIfNeeded();
  const before = await page.evaluate(() => scrollY);
  const handScroll = await hand.evaluate(node => node.scrollTop);
  await hand.getByRole('button', { name: 'Select for Redraw', exact: true }).nth(10).click();
  assert.equal(await hand.getByRole('button', { name: 'Selected', exact: true }).count(), 1);
  assert(Math.abs(await page.evaluate(() => scrollY) - before) < 3);
  assert(Math.abs(await hand.evaluate(node => node.scrollTop) - handScroll) < 3);
  await hand.getByRole('button', { name: 'Selected', exact: true }).click();
  assert.equal(await hand.getByRole('button', { name: 'Selected', exact: true }).count(), 0);
  await hand.getByRole('button', { name: 'Select for Redraw', exact: true }).nth(10).click();
  await page.locator('#citadelsPanel .citadels-section-heading h3').first().click();
  assert.equal(await hand.getByRole('button', { name: 'Selected', exact: true }).count(), 0);

  const redraw = hand.getByRole('button', { name: 'Select for Redraw', exact: true }).first();
  await redraw.scrollIntoViewIfNeeded();
  const redrawBox = await redraw.boundingBox();
  await page.mouse.move(redrawBox.x + 5, redrawBox.y + 5);
  await page.mouse.down();
  await page.mouse.move(redrawBox.x + 5, redrawBox.y + 24, { steps: 4 });
  await page.mouse.up();
  assert.equal(await hand.getByRole('button', { name: 'Selected', exact: true }).count(), 0);
  await page.locator('#citadelsExplainBtn').click();
  await page.mouse.move(redrawBox.x + 5, redrawBox.y + 5);
  await page.mouse.down();
  await page.mouse.move(redrawBox.x + 5, redrawBox.y + 24, { steps: 4 });
  await page.mouse.up();
  assert.equal(await page.locator('.obg-explain-dialog[open]').count(), 0);
  assert.equal(await page.locator('#citadelsExplainBtn').getAttribute('aria-pressed'), 'true');
  await page.keyboard.press('Escape');

  await page.locator('#citadelsHelpBtn').click();
  const help = page.locator('dialog[data-obg-help-game="citadels"]');
  await help.locator('[data-obg-help-lang="en"]').click();
  await help.locator('[data-obg-help-tab="__basic"]').click();
  assert.match(await help.textContent(), /How you win/);
  for (const tab of ['flow', 'roles', 'score']) {
    await help.locator(`[data-obg-help-tab="${tab}"]`).click();
    await bounds(page, `Help ${tab}`);
  }
  await help.locator('[data-obg-help-lang="zh"]').click();
  assert.match(await help.textContent(), /计分与紫卡/);
  await page.keyboard.press('Escape');
  await page.locator('#citadelsRoleTrack .citadels-track-role').first().click();
  await page.locator('#citadelsTooltip').waitFor({ state: 'visible' });
  await page.waitForTimeout(3100);
  assert.equal(await page.locator('#citadelsTooltip').isVisible(), false);

  const draft = { ...playing, phase: 'draft', legal_actions: ['draft_character'], current_turn_role: null, current_drafter: 'p0',
    action_options: { draft_roles: [{ rank: 7, name_cn: '建筑师' }, { rank: 4, name_cn: '国王' }] } };
  await render(page, draft);
  await page.locator('#citadelsActions').getByRole('button', { name: /7. 建筑师/ }).click();
  await bounds(page, 'Draft confirmation');
  await page.locator('.citadels-confirmation').getByRole('button', { name: 'Confirm', exact: true }).click();
  assert.deepEqual(await page.evaluate(() => citadelsTestActions.at(-1)), { type: 'draft_character', rank: 7 });

  await render(page, { ...playing, legal_actions: ['choose_draw'],
    current_turn_role: { ...playing.current_turn_role, step: 'choose_draw', draw_offer: [district(80), district(81)] } });
  await page.locator('#citadelsActions').getByRole('button', { name: 'Keep This' }).first().click();
  await bounds(page, 'Keep confirmation');
  await page.locator('.citadels-confirmation').getByRole('button', { name: 'Confirm', exact: true }).click();
  assert.deepEqual(await page.evaluate(() => citadelsTestActions.at(-1)), { type: 'choose_draw', card_id: 'district-80' });

  await render(page, { ...playing, legal_actions: ['destroy_district', 'end_turn'],
    action_options: { destroy_targets: [{ player_id: 'p1', district_id: 'district-5', destroy_cost: 1 }] } });
  await page.getByRole('button', { name: 'Destroy · 💰 1', exact: true }).click();
  await bounds(page, 'Destroy confirmation');
  await page.locator('.citadels-confirmation').getByRole('button', { name: 'Confirm', exact: true }).click();
  assert.deepEqual(await page.evaluate(() => citadelsTestActions.at(-1)), { type: 'destroy_district', target_player_id: 'p1', district_id: 'district-5' });

  await render(page, { ...playing, phase: 'round_end', legal_actions: ['next_round'],
    next_round_progress: { done: 1, total: 6 }, next_round_ready_player_ids: ['p1'],
    last_round_summary: { round: 4, players: players.map(player => ({ ...player, city_value: 10,
      roles: [{ rank: 4, name_cn: '国王', acted: true }], actions: [{ type: 'build', text: 'Built 市场.' }] })) } });
  await page.locator('#citadelsNextRoundBtn').click();
  assert.deepEqual(await page.evaluate(() => citadelsTestActions.at(-1)), { type: 'next_round' });
  assert.equal(await page.locator('.citadels-confirmation').count(), 0);
}

async function touchChecks(browser, width) {
  const context = await browser.newContext({ viewport: { width, height: 844 }, isMobile: true, hasTouch: true });
  const page = await context.newPage();
  await page.route('https://fonts.googleapis.com/**', route => route.abort());
  await page.goto(base);
  await page.waitForFunction(() => typeof socket !== 'undefined' && socket.connected && cachedGameList);
  await page.evaluate(() => socket.emit('room:create', { name: 'Citadels touch QA', game_type: 'citadels' }));
  await page.waitForFunction(() => roomSessionReady && isGameAssetsLoaded('citadels'));
  await render(page, playing);
  const role = page.locator('#citadelsRoleTrack .citadels-track-role');
  await role.first().tap();
  assert.match(await page.locator('#citadelsTooltip').textContent(), /Assassin/);
  await role.nth(1).tap();
  assert.match(await page.locator('#citadelsTooltip').textContent(), /Thief/);
  await page.waitForTimeout(3100);
  assert.equal(await page.locator('#citadelsTooltip').isVisible(), false);

  const hand = page.locator('#citadelsHand');
  const select = hand.getByRole('button', { name: 'Select for Redraw', exact: true }).first();
  await select.tap();
  assert.equal(await hand.getByRole('button', { name: 'Selected', exact: true }).count(), 1);
  await hand.getByRole('button', { name: 'Selected', exact: true }).tap();
  const box = await select.boundingBox();
  const session = await context.newCDPSession(page);
  const start = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
  await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [start] });
  for (const offset of [15, 35, 65, 95]) {
    await session.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: start.x, y: start.y - offset }] });
  }
  await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await page.waitForTimeout(350);
  assert.equal(await hand.getByRole('button', { name: 'Selected', exact: true }).count(), 0);
  assert(await hand.evaluate(node => node.scrollTop) > 0);
  await bounds(page, `Touch ${width}`);
  await page.screenshot({ path: `${output}/touch-${width}.png`, fullPage: true });
  await page.evaluate(() => socket.emit('room:leave', { room_id: roomId }));
  await context.close();
  console.log(`Citadels ${width}px touch: tap, tooltip and swipe passed`);
}

async function liveChecks(browser) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  await page.route('https://fonts.googleapis.com/**', route => route.abort());
  await page.goto(base);
  await page.waitForFunction(() => typeof socket !== 'undefined' && socket.connected && cachedGameList);
  await page.evaluate(() => socket.emit('room:create', { name: 'Citadels reconnect QA', game_type: 'citadels' }));
  await page.waitForFunction(() => roomSessionReady && isGameAssetsLoaded('citadels'));
  await page.evaluate(() => socket.emit('room:add_bot', { room_id: roomId }));
  await page.waitForFunction(() => currentRoomState.players.length === 2);
  await page.evaluate(() => socket.emit('room:ready', { room_id: roomId, ready: true }));
  await page.waitForFunction(() => !document.getElementById('startBtn').disabled);
  await page.evaluate(() => socket.emit('room:start', { room_id: roomId }));
  await page.waitForFunction(() => lastGameStatePayload?.game_type === 'citadels');
  const originalRoom = await page.evaluate(() => roomId);
  await page.reload();
  await page.waitForFunction(() => isGameAssetsLoaded('citadels') && lastGameStatePayload?.game_type === 'citadels');
  assert.equal(await page.evaluate(() => roomId), originalRoom);
  assert.equal(await page.locator('#citadelsPanel').isVisible(), true);
  assert.equal(await page.locator('#citadelsRoleTrack .citadels-track-role').count(), 8);
  await bounds(page, 'Live start and reconnect');
  await page.evaluate(() => socket.emit('room:leave', { room_id: roomId }));
  await context.close();
  console.log('Citadels live create/start/reload/reconnect passed');
}

(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const errors = [];
  try {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const page = await context.newPage();
    page.on('pageerror', error => errors.push(error.message));
    await page.route('https://fonts.googleapis.com/**', route => route.abort());
    await page.goto(base);
    await page.waitForFunction(() => typeof socket !== 'undefined' && socket.connected && cachedGameList);
    await page.evaluate(() => socket.emit('room:create', { name: 'Citadels UI QA', game_type: 'citadels' }));
    await page.waitForFunction(() => roomSessionReady && isGameAssetsLoaded('citadels'));
    await page.evaluate(() => {
      window.citadelsTestActions = [];
      const original = socket.emit.bind(socket);
      socket.emit = (event, ...args) => event === 'game:action' ? citadelsTestActions.push(args[0].action) : original(event, ...args);
    });
    fs.mkdirSync(output, { recursive: true });
    for (const width of [320, 390, 1024, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      await render(page, playing);
      await bounds(page, `Main ${width}`);
      await page.screenshot({ path: `${output}/main-${width}.png`, fullPage: true });
      await interactions(page);
      await bounds(page, `Recap ${width}`);
      await page.screenshot({ path: `${output}/recap-${width}.png`, fullPage: true });
      console.log(`Citadels ${width}px: layout and interactions passed`);
    }
    assert.deepEqual(errors, []);
    await page.evaluate(() => socket.emit('room:leave', { room_id: roomId }));
    await touchChecks(browser, 320);
    await touchChecks(browser, 390);
    await liveChecks(browser);
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
