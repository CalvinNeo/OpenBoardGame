// UI checks only. Run against a local server with PLAYWRIGHT_MODULE and PYTHON as needed.
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { execFileSync } = require('node:child_process');
const base = process.env.ROOM_TEST_URL || 'http://127.0.0.1:8775';
const output = 'tmp/lost-code-ui';
fs.mkdirSync(output, { recursive: true });
const fixtures = JSON.parse(execFileSync(process.env.PYTHON || 'python', ['-c', `
import json, random
from game.lost_code import LostCodeGame as G
random.seed(24)
players = [{"player_id": "p"+str(i), "name": ["Alex", "Morgan", "Jamie", "Riley"][i], "seat": i} for i in range(4)]
views = {}
for mode in ("standard", "intro", "x_race"):
    state = G.init_game({"mode": mode, "deadly_shortcut": True, "curse_of_temple": True}, players)
    for step in range(500):
        phase = state["phase"]
        actor = state["current_actor"] or "p0"
        views.setdefault(mode + "_" + phase, G.get_public_view(state, actor))
        if phase == "choose_wheels":
            views.setdefault("spectator", G.get_public_view(state, "visitor"))
        if state["game_over"]: break
        action = G.bot_move(state, actor)
        if action is None: raise RuntimeError("Missing fixture action")
        _, error = G.apply_action(state, actor, action)
        if error: raise RuntimeError(error)
print(json.dumps(views))
`], { encoding: 'utf8', maxBuffer: 8 * 1024 * 1024 }));
const symbols = fixtures.standard_choose_wheels.active_symbols;
// A deterministic UI fixture also covers the optional expansion prompt.
fixtures.standard_offer_shortcut_token = {
  ...structuredClone(fixtures.standard_modify_die), phase: 'offer_shortcut_token',
  legal_actions: ['pass_shortcut', 'take_shortcut'], shortcut_offer: { symbol: symbols[0] },
  phase_detail: 'Choose shortcut numbers, or pass.',
};
fixtures.final_locked = structuredClone(fixtures.standard_final_guess_submit);
fixtures.final_locked.players.find(player => player.you).shortcut_commits[symbols[0]] = [1, 4];
fixtures.long_names = structuredClone(fixtures.x_race_choose_wheels);
fixtures.long_names.players[1].name = 'VeryLongUnbrokenPlayerNameThatMustWrapAcrossTheAvailableSpace';
fixtures.long_names.players[2].name = '名字很长的玩家用于验证窄屏中文排版';
fixtures.long_names.players[0].score = -12;
fixtures.empty_piles = structuredClone(fixtures.standard_exchange_stones);
fixtures.empty_piles.draw_pile_counts[symbols[0]] = 0;
fixtures.empty_piles.draw_pile_counts[symbols[1]] = 0;

async function render(page, key) {
  await page.evaluate(view => {
    clearLostCodeState();
    playerId = view.you;
    roomSessionReady = true;
    renderRoomState({ room_id: 'lost-code-layout', game_type: 'lost_code', status: 'in_game', host_id: view.you, players: view.players, game_config: {} });
    setGamePanelVisibility('lost_code');
    renderGameState({ room_id: 'lost-code-layout', game_type: 'lost_code', view });
    setRoomControlsCollapsed(true);
    window.lostCodeTestActions = [];
    window.scrollTo(0, 0);
  }, fixtures[key]);
  await page.locator('.lost-code-action-card').waitFor({ state: 'visible' });
}
async function bounds(page, label) {
  const issues = await page.evaluate(() => {
    const bad = [...document.querySelectorAll('#lostCodePanel *, .lost-code-modal:not(.hidden) *')].filter(el => {
      const box = el.getBoundingClientRect();
      if (!box.width || !box.height || getComputedStyle(el).display === 'none') return false;
      return box.left < -1 || box.right > innerWidth + 1 ||
        (el.clientWidth && el.scrollWidth > el.clientWidth + 1 && !['auto', 'hidden', 'scroll'].includes(getComputedStyle(el).overflowX));
    }).map(el => (el.className || el.id) + ': ' + el.textContent.slice(0, 50));
    const dock = document.getElementById('lostCodeCluesBtn');
    if (dock?.getClientRects().length && document.getElementById('lostCodeCluesModal').classList.contains('hidden')) {
      const tab = dock.getBoundingClientRect();
      for (const control of document.querySelectorAll('#lostCodeControls button, #lostCodeControls select')) {
        const box = control.getBoundingClientRect();
        if (Math.min(box.right, tab.right) > Math.max(box.left, tab.left) && Math.min(box.bottom, tab.bottom) > Math.max(box.top, tab.top)) bad.push('Clues dock overlaps a game control.');
      }
    }
    return { pageOverflow: document.documentElement.scrollWidth > innerWidth, bad };
  });
  assert.deepEqual(issues, { pageOverflow: false, bad: [] }, label);
}
(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const errors = [];
  const context = await browser.newContext({ viewport: { width: 393, height: 852 }, isMobile: true, hasTouch: true });
  const page = await context.newPage();
  page.on('pageerror', error => errors.push(error.message));
  await page.route('https://fonts.googleapis.com/**', route => route.abort());
  try {
    await page.goto(base);
    await page.waitForFunction(() => typeof socket !== 'undefined' && socket.connected && cachedGameList);
    await page.evaluate(() => ensureGameAssets('lost_code'));
    await page.evaluate(() => { window.sendAction = action => window.lostCodeTestActions.push(action); });
    const phases = ['standard_roll_dice', 'standard_modify_die', 'standard_offer_shortcut_token', 'standard_choose_wheels', 'standard_exchange_stones', 'standard_final_guess_submit', 'standard_game_over', 'intro_choose_wheels', 'x_race_choose_wheels', 'final_locked', 'long_names', 'empty_piles', 'spectator'];
    for (const width of [320, 360, 393, 768, 1024, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      for (const phase of phases) {
        assert(fixtures[phase], 'Missing fixture: ' + phase);
        await render(page, phase);
        await bounds(page, width + 'px / ' + phase);
      }
    }
    console.log('All 13 UI states fit at 320, 360, 393, 768, 1024 and 1440px.');

    await page.setViewportSize({ width: 393, height: 852 });
    await render(page, 'standard_choose_wheels');
    await page.locator('[data-lost-code-wheel="W7"]').click();
    const cell = page.getByRole('button', { name: 'Choose range 6 to 15', exact: true });
    await cell.scrollIntoViewIfNeeded();
    const scroll = await page.evaluate(() => scrollY);
    await cell.tap();
    assert.equal(await page.evaluate(() => scrollY), scroll, 'Range selection must not move the page.');
    assert.equal(await page.locator('.lost-code-range-cell.in-range').count(), 10);
    assert.equal(await page.locator('.lost-code-range-preview strong').innerText(), '6–15');
    await page.getByRole('button', { name: 'Submit guess', exact: true }).click();
    assert.deepEqual(await page.evaluate(() => lostCodeTestActions), [{ type: 'submit_guess', wheel_id: 'W7', min: 6, max: 15 }]);
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({ path: output + '/mobile-range.png', fullPage: true });

    await page.locator('#lostCodeCluesBtn').click();
    assert.equal(await page.locator('#lostCodeCluesDockHost .lost-code-log-table').count(), 1);
    await page.locator('#lostCodeDiscardDetails summary').click();
    await bounds(page, 'Mobile clue drawer');
    const firstSymbol = page.locator('#lostCodeCluesDockHost thead [data-lost-code-tip]').first();
    await firstSymbol.tap();
    assert.match(await page.locator('#lostCodeTooltip').innerText(), /Blue bird/);
    await page.locator('#lostCodeCluesDockHost thead [data-lost-code-tip]').nth(1).tap();
    assert.match(await page.locator('#lostCodeTooltip').innerText(), /Yellow jaguar/);
    await page.waitForTimeout(3100);
    assert.equal(await page.locator('#lostCodeTooltip').isVisible(), false);
    await page.screenshot({ path: output + '/mobile-clues.png', fullPage: true });
    await page.keyboard.press('Escape');
    assert.equal(await page.locator('#lostCodeCluesHome .lost-code-log-table').count(), 1);
    assert.equal(await page.locator('#lostCodeCluesBtn').getAttribute('aria-expanded'), 'false');

    await render(page, 'standard_choose_wheels');
    await page.locator('[data-lost-code-wheel="W7"]').click();
    await page.evaluate(() => toggleLostCodeExplainMode());
    const disabled = page.locator('.lost-code-range-cell').first();
    await disabled.scrollIntoViewIfNeeded();
    const box = await disabled.boundingBox();
    await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
    assert.equal(await page.locator('#lostCodeExplainModal').isVisible(), true);
    assert.match(await page.locator('#lostCodeExplainContent').innerText(), /Disabled centers/);
    assert.deepEqual(await page.evaluate(() => lostCodeTestActions), []);
    assert.equal(await page.evaluate(() => lostCodeExplainMode), false);
    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: 'Choose range 6 to 15', exact: true }).tap();
    await page.evaluate(() => toggleLostCodeExplainMode());
    await page.getByRole('button', { name: 'Submit guess', exact: true }).tap();
    assert.equal(await page.locator('#lostCodeExplainModal').isVisible(), true);
    assert.deepEqual(await page.evaluate(() => lostCodeTestActions), [], 'Explain must not submit the guess.');
    await page.keyboard.press('Escape');

    await render(page, 'standard_offer_shortcut_token');
    const numbers = page.locator('.lost-code-number-options button');
    await numbers.nth(1).tap();
    const selectedNode = await numbers.nth(1).evaluate(el => { el.dataset.testIdentity = 'retained'; return el.dataset.testIdentity; });
    await numbers.nth(3).tap();
    assert.equal(await numbers.nth(1).getAttribute('data-test-identity'), selectedNode, 'Multi-select must retain DOM nodes.');
    await numbers.nth(4).tap();
    await numbers.nth(5).tap();
    assert.equal(await page.locator('.lost-code-number-options .selected').count(), 3);
    await page.getByRole('button', { name: /Take token ·/ }).tap();
    assert.deepEqual(await page.evaluate(() => lostCodeTestActions[0]), { type: 'take_shortcut', guesses: [1, 3, 4] });

    await render(page, 'final_locked');
    const selects = page.locator('.lost-code-final-row select');
    await selects.first().selectOption('4');
    await selects.nth(1).selectOption('6');
    await page.evaluate(() => renderLostCodeGameState({ room_id: 'lost-code-layout', game_type: 'lost_code', view: currentLostCodeView }));
    assert.equal(await selects.first().inputValue(), '4', 'Room refresh must preserve final drafts.');
    assert.equal(await selects.nth(1).inputValue(), '6');
    await page.screenshot({ path: output + '/mobile-final.png', fullPage: true });
    await page.getByRole('button', { name: 'Submit final guesses', exact: true }).tap();
    const action = await page.evaluate(() => lostCodeTestActions[0]);
    assert.equal(action.type, 'submit_final_guesses');
    assert.equal(Object.hasOwn(action.guesses, symbols[0]), false, 'Locked shortcut must stay locked.');
    assert.deepEqual(action.guesses[symbols[1]], [4, 6]);

    await page.evaluate(() => openLostCodeHelpModal());
    await page.locator('#lostCodeHelpLangEnBtn').click();
    assert.match(await page.locator('#lostCodeHelpContent').innerText(), /Blue bird.*🐦/);
    await bounds(page, 'English help at mobile width');
    await page.keyboard.press('Escape');
    assert.equal(await page.locator('#lostCodeHelpModal').isVisible(), false);
    await page.setViewportSize({ width: 1440, height: 1000 });
    await render(page, 'standard_choose_wheels');
    await page.screenshot({ path: output + '/desktop-range.png', fullPage: true });

    const desktop = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    desktop.on('pageerror', error => errors.push(error.message));
    await desktop.route('https://fonts.googleapis.com/**', route => route.abort());
    await desktop.goto(base);
    await desktop.waitForFunction(() => typeof socket !== 'undefined' && socket.connected && cachedGameList);
    await desktop.evaluate(() => ensureGameAssets('lost_code'));
    await render(desktop, 'standard_choose_wheels');
    await desktop.locator('.lost-code-log-table thead [data-lost-code-tip]').first().hover();
    assert.match(await desktop.locator('#lostCodeTooltip').innerText(), /Blue bird/);
    await desktop.locator('#lostCodeExplainBtn').click();
    await desktop.locator('#lostCodeClueTitle').click();
    assert.equal(await desktop.locator('#lostCodeExplainModal').isVisible(), true);
    await desktop.keyboard.press('Escape');
    await bounds(desktop, 'Desktop mouse hover and area Explain');

    const live = await browser.newPage({ viewport: { width: 393, height: 852 }, isMobile: true, hasTouch: true });
    live.on('pageerror', error => errors.push(error.message));
    await live.route('https://fonts.googleapis.com/**', route => route.abort());
    await live.goto(base);
    await live.waitForFunction(() => typeof socket !== 'undefined' && socket.connected && cachedGameList);
    await live.evaluate(() => socket.emit('room:create', { name: 'Lost Code UI check', game_type: 'lost_code' }));
    await live.waitForFunction(() => roomSessionReady && isGameAssetsLoaded('lost_code'));
    assert.equal(await live.locator('#lostCodePhase').innerText(), 'Lobby');
    await live.evaluate(() => socket.emit('room:add_bot', { room_id: roomId }));
    await live.waitForFunction(() => currentRoomState.players.length === 2);
    await live.evaluate(() => {
      socket.emit('room:ready', { room_id: roomId, ready: true });
      setRoomControlsCollapsed(false);
    });
    await live.waitForFunction(() => !document.getElementById('startBtn').disabled);
    await live.locator('#startBtn').click();
    await live.waitForFunction(() => lastGameStatePayload?.game_type === 'lost_code' && currentLostCodeView);
    await live.evaluate(() => setRoomControlsCollapsed(true));
    assert.equal(await live.locator('.lost-code-log-table tbody tr').count(), 4);
    assert.equal(await live.locator('.lost-code-log-table tbody tr.is-you td').first().innerText(), '?');
    assert.equal(await live.locator('#lostCodeTokenDetails').isVisible(), false);
    await bounds(live, 'Live mobile room');
    const liveRoom = await live.evaluate(() => roomId);
    await live.reload();
    await live.waitForFunction(() => isGameAssetsLoaded('lost_code') && currentLostCodeView);
    assert.equal(await live.evaluate(() => roomId), liveRoom);
    assert.equal(await live.locator('.lost-code-log-table tbody tr').count(), 4);
    await live.evaluate(() => setRoomControlsCollapsed(true));
    await live.screenshot({ path: output + '/mobile-live.png', fullPage: true });
    await live.locator('#lostCodeHelpBtn').click();
    await live.keyboard.press('Escape');
    assert.equal(await live.locator('#lostCodeHelpModal').isVisible(), false);
    await live.evaluate(() => { socket.emit('room:leave', { room_id: roomId }); });
    assert.deepEqual(errors, [], 'No browser errors.');
    console.log('Range submission, drawer, timed tooltips, disabled-button Explain, shortcut selection, final drafts and Help passed.');
    console.log('Live room creation, start, private values, neutral logs and reload passed.');
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
