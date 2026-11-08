const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const base = process.env.ROOM_TEST_URL || 'http://127.0.0.1:8147';
const root = path.resolve(__dirname, '..');
const output = path.join(root, 'build', 'the-mind-ui');
const widths = [320, 390, 1024, 1440];
const shots = ['playing', 'round_end', 'big_hand', 'long_names'];
fs.mkdirSync(output, { recursive: true });

const views = JSON.parse(execFileSync(process.env.PYTHON || 'python3', ['-m', 'tests.the_mind_ui'],
  { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }));

const CONTAINERS = ['.game-panel > .panel-header', '.tm-bar', '.tm-seats', '.tm-seat', '.tm-felt', '.tm-felt-info',
  '.tm-row', '.tm-notice', '.tm-action', '.tm-btnrow', '.tm-hand', '.tm-review', '.tm-review-row',
  '.tm-body', '.tm-main', '.tm-side', '.tm-subhead'];

async function prepare(page) {
  await page.route('https://fonts.googleapis.com/**', route => route.abort());
  await page.goto(base);
  await page.waitForFunction(() => typeof socket !== 'undefined' && socket.connected && cachedGameList);
  await page.evaluate(async () => {
    await ensureGameAssets('the_mind');
    window.theMindTestActions = [];
    window.sendAction = fields => window.theMindTestActions.push(fields);
  });
}

async function render(page, key) {
  await page.evaluate(view => {
    playerId = view.you;
    roomSessionReady = true;
    renderRoomState({
      room_id: 'the-mind-ui', game_type: 'the_mind',
      status: view.game_over ? 'game_over' : 'in_game',
      players: view.players, host_id: 'p0', min_players: 2, max_players: 4, game_config: {}
    });
    renderGameState({ game_type: 'the_mind', room_id: 'the-mind-ui', view });
    setRoomControlsCollapsed(true);
    window.theMindTestActions.length = 0;
    window.scrollTo(0, 0);
  }, views[key]);
  await page.locator('#theMindPanel').waitFor({ state: 'visible' });
}

async function bounds(page, label) {
  const issues = await page.evaluate(containers => {
    const problems = [];
    if (document.documentElement.scrollWidth > innerWidth) problems.push('page horizontal overflow');
    const scope = '#theMindPanel, #theMindPanel *, .game-panel > .panel-header, .game-panel > .panel-header *,'
      + ' #theMindDialog[open], #theMindDialog[open] *';
    for (const node of document.querySelectorAll(scope)) {
      if (!node.checkVisibility()) continue;
      // Common room controls are re-parented into an open dialog; they are not part of this game.
      if (node.closest('#roomControlsPanel, .room-controls-layer')) continue;
      const box = node.getBoundingClientRect();
      if (!box.width || !box.height) continue;
      const style = getComputedStyle(node);
      if (style.position === 'fixed') continue;
      const name = node.id || node.className || node.tagName;
      if (box.left < -1 || box.right > innerWidth + 1) problems.push(name + ' outside viewport');
      if (node.clientWidth > 0 && node.scrollWidth > node.clientWidth + 1 && style.overflowX === 'visible') {
        problems.push(name + ' content overflow ' + node.scrollWidth + '/' + node.clientWidth);
      }
    }
    for (const selector of containers) {
      for (const parent of document.querySelectorAll(selector)) {
        const children = [...parent.children]
          .filter(node => node.checkVisibility() && getComputedStyle(node).position !== 'fixed');
        for (let first = 0; first < children.length; first += 1) {
          for (let second = first + 1; second < children.length; second += 1) {
            const left = children[first].getBoundingClientRect();
            const right = children[second].getBoundingClientRect();
            if (Math.min(left.right, right.right) - Math.max(left.left, right.left) > 1
                && Math.min(left.bottom, right.bottom) - Math.max(left.top, right.top) > 1) {
              problems.push('overlap in ' + selector);
            }
          }
        }
      }
    }
    return problems;
  }, CONTAINERS);
  if (issues.length) await page.screenshot({ path: path.join(output, 'layout-failure.png'), fullPage: true });
  assert.deepEqual(issues, [], label);
}

async function clickDisabled(page, locator) {
  await locator.scrollIntoViewIfNeeded();
  const box = await locator.boundingBox();
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
}

async function testFixtures(browser, errors) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const page = await context.newPage();
  page.on('pageerror', error => errors.push(error.message));
  await prepare(page);
  const actions = () => page.evaluate(() => window.theMindTestActions);

  await render(page, 'playing');
  const frame = await page.evaluate(() => {
    const panel = document.querySelector('.game-panel');
    const surface = document.getElementById('tmSurface');
    const buttons = ['gameReconnectBtn', 'theMindHelpBtn', 'theMindExplainBtn'].map(id => document.getElementById(id));
    return {
      title: panel.querySelector('.game-panel-title h2').textContent,
      panelBackground: getComputedStyle(panel).backgroundColor,
      surfaceBorder: getComputedStyle(surface).borderTopWidth,
      surfaceBackground: getComputedStyle(surface).backgroundColor,
      labels: buttons.map(node => node && node.textContent.trim()),
      wraps: buttons.map(node => node && getComputedStyle(node).whiteSpace),
      explainCount: document.querySelectorAll('#theMindExplainBtn').length
    };
  });
  assert.match(frame.title, /心意相通/);
  assert.notEqual(frame.panelBackground, 'rgb(255, 255, 255)');
  assert.equal(frame.surfaceBorder, '0px', 'no extra frame inside the game panel');
  assert.equal(frame.surfaceBackground, 'rgba(0, 0, 0, 0)');
  assert.deepEqual(frame.labels, ['Reconnect', 'Help', 'Explain']);
  assert.deepEqual(frame.wraps, ['nowrap', 'nowrap', 'nowrap'], 'Help and Reconnect never wrap');
  assert.equal(frame.explainCount, 1, 'Explain exists once, docked or in the header');

  const chrome = await page.evaluate(() => ({
    clear: [...document.querySelectorAll('#theMindPanel button')].some(node => /clear/i.test(node.textContent)),
    markers: document.querySelectorAll('#theMindPanel .tm-info, #theMindPanel [data-tm-info]').length,
    text: document.getElementById('theMindPanel').innerText
  }));
  assert.equal(chrome.clear, false, 'no Clear Selection button');
  assert.equal(chrome.markers, 0, 'no per-block info markers');
  for (const secret of ['71', '73', '61', '63', '67']) {
    assert.equal(chrome.text.includes(secret), false, 'leaked private card ' + secret);
  }
  assert.equal(chrome.text.includes('92'), true, 'own hand is visible');
  assert.match(chrome.text, /RECENT PLAYS/);
  assert.match(chrome.text, /DISCARDED/);

  await render(page, 'focus');
  const ready = page.locator('#theMindPanel button[data-tm-action="ready"]');
  assert.equal(await ready.count(), 1);
  await ready.click();
  assert.deepEqual(await actions(), [{ type: 'ready', game_token: views.focus.game_token, window_id: views.focus.window_id }]);
  assert.equal(await ready.isDisabled(), true, 'locks while the action is in flight');
  await page.evaluate(() => socket.listeners('system:error').forEach(handler => handler({ message: 'Test rejection' })));
  assert.equal(await ready.isDisabled(), false, 'a rejection re-enables the action');

  await render(page, 'focus_waiting');
  assert.equal(await page.locator('#theMindPanel button[data-tm-action="ready"]').count(), 0);
  assert.match(await page.locator('#theMindPanel').innerText(), /Waiting for Morgan/);

  await render(page, 'playing');
  const play = page.locator('#theMindPanel button[data-tm-action="play"]');
  assert.match(await play.innerText(), /Play 7/);
  await play.click();
  assert.deepEqual(await actions(), [{
    type: 'play', card: 7, game_token: views.playing.game_token, window_id: views.playing.window_id
  }]);

  await render(page, 'star_vote');
  await page.locator('#theMindPanel button[data-tm-action="vote_star:yes"]').click();
  assert.equal((await actions())[0].agree, true);
  await render(page, 'star_vote');
  await page.locator('#theMindPanel button[data-tm-action="vote_star:no"]').click();
  assert.equal((await actions())[0].agree, false);
  await render(page, 'star_vote_voted');
  assert.match(await page.locator('#theMindPanel').innerText(), /Your vote is recorded/);

  await render(page, 'mistake');
  assert.match(await page.locator('#theMindPanel .tm-notice').innerText(), /Mistake/);
  assert.equal(await page.locator('#theMindPanel .tm-notice .tm-chip.tm-missed').count(), 2);
  await render(page, 'star_used');
  assert.equal(await page.locator('#theMindPanel .tm-notice .tm-chip.tm-starred').count(), 2);

  await render(page, 'round_end');
  assert.equal(await page.locator('#theMindPanel .tm-review-row.tm-self').count(), 1);
  assert.match(await page.locator('#theMindPanel .tm-reward').innerText(), /Throwing star/);
  await page.locator('#theMindPanel button[data-tm-action="next_round"]').click();
  assert.equal((await actions())[0].type, 'next_round');
  assert.equal(await page.locator('#theMindDialog').evaluate(node => node.open), false, 'Next Round has no confirmation');
  await render(page, 'round_end_confirmed');
  assert.equal(await page.locator('#theMindPanel button[data-tm-action="next_round"]').isDisabled(), true);
  assert.match(await page.locator('#theMindPanel').innerText(), /1\/2 confirmed/);
  await render(page, 'round_end_life');
  assert.match(await page.locator('#theMindPanel .tm-reward').innerText(), /Life/);

  await render(page, 'game_over_win');
  assert.match(await page.locator('#theMindPanel .tm-banner').innerText(), /wins/);
  await render(page, 'game_over_lose');
  assert.match(await page.locator('#theMindPanel .tm-banner').innerText(), /ran out of lives/);

  await render(page, 'playing');
  assert.equal(await page.locator('#theMindPanel .tm-logbox').evaluate(node => node.open), false, 'log starts collapsed');
  await page.locator('#theMindPanel .tm-logbox > summary').click();
  assert.equal(await page.locator('#theMindPanel .tm-logbox').evaluate(node => node.open), true);
  const logBox = await page.locator('#theMindPanel .tm-log').evaluate(node => ({ scroll: node.scrollHeight, client: node.clientHeight }));
  assert(logBox.client <= 260, 'log stays bounded');
  await bounds(page, 'open log');
  await render(page, 'playing');
  assert.equal(await page.locator('#theMindPanel .tm-logbox').evaluate(node => node.open), true, 'log stays open across updates');

  await render(page, 'playing');
  await page.locator('#theMindPanel .tm-stat').nth(1).hover();
  assert.equal(await page.locator('#tmTooltip').isVisible(), true);
  assert.match(await page.locator('#tmTooltip').innerText(), /Lives/);
  await page.mouse.move(2, 2);
  await page.waitForFunction(() => document.getElementById('tmTooltip').hidden);
  await page.locator('#theMindPanel .tm-pile').hover();
  assert.match(await page.locator('#tmTooltip').innerText(), /Open pile/);
  await page.mouse.move(2, 2);

  await render(page, 'playing');
  await page.locator('#theMindExplainBtn').click();
  assert.equal(await page.locator('#theMindExplainBtn').getAttribute('aria-pressed'), 'true');
  await page.locator('#theMindPanel .tm-pile').click();
  await page.locator('#theMindDialog[open]').waitFor();
  assert.match(await page.locator('#tmDialogBody').innerText(), /Open pile/);
  assert.equal(await page.locator('#theMindExplainBtn').getAttribute('aria-pressed'), 'false');
  assert.deepEqual(await actions(), []);
  await page.keyboard.press('Escape');
  assert.equal(await page.locator('#theMindDialog').evaluate(node => node.open), false);

  await render(page, 'round_end_confirmed');
  await page.locator('#theMindExplainBtn').click();
  const disabled = page.locator('#theMindPanel button[data-tm-action="next_round"]');
  assert.equal(await disabled.isDisabled(), true);
  await clickDisabled(page, disabled);
  await page.locator('#theMindDialog[open]').waitFor();
  assert.match(await page.locator('#tmDialogBody').innerText(), /Next Round/);
  assert.deepEqual(await actions(), []);
  await page.keyboard.press('Escape');

  await page.evaluate(() => {
    const node = document.createElement('button');
    node.id = 'tmTestPlain';
    node.textContent = 'Test action';
    node.onclick = () => { window.tmTestFired = true; };
    document.getElementById('theMindPanel').appendChild(node);
  });
  await page.locator('#theMindExplainBtn').click();
  await page.locator('#tmTestPlain').click();
  assert.equal(await page.evaluate(() => Boolean(window.tmTestFired)), false, 'explain blocks plain buttons');
  assert.equal(await page.locator('#theMindExplainBtn').getAttribute('aria-pressed'), 'true');
  await page.keyboard.press('Escape');
  await page.locator('#tmTestPlain').evaluate(node => node.remove());

  await page.locator('#theMindHelpBtn').click();
  await page.locator('#theMindDialog[open]').waitFor();
  const help = await page.locator('#tmDialogBody').innerText();
  assert.match(help, /Life \(❤️\)/);
  assert.match(help, /Throwing star \(🌟\)/);
  assert.match(help, /Ready \(🖐️\)/);
  assert.match(help, /Stop \(⏸️\)/);
  await page.keyboard.press('Escape');
  assert.equal(await page.locator('#theMindDialog').evaluate(node => node.open), false);
  assert.equal(await page.evaluate(() => document.activeElement.id), 'theMindHelpBtn', 'focus returns after Help');

  for (const width of widths) {
    await page.setViewportSize({ width, height: width < 600 ? 844 : 1000 });
    for (const key of Object.keys(views)) {
      await render(page, key);
      await bounds(page, width + 'px ' + key);
      assert.equal(await page.locator('#theMindPanel img').count(), 0, key + ' escaped player names');
      if (shots.includes(key)) {
        await page.locator('#theMindPanel').screenshot({ path: path.join(output, key + '-' + width + '.png') });
      }
    }
    await page.locator('#theMindHelpBtn').click();
    await page.locator('#theMindDialog[open]').waitFor();
    await bounds(page, width + 'px Help');
    await page.screenshot({ path: path.join(output, 'help-' + width + '.png') });
    await page.keyboard.press('Escape');
  }

  await page.setViewportSize({ width: 1440, height: 1000 });
  await render(page, 'playing');
  await page.evaluate(async () => {
    renderRoomState({ room_id: 'other', game_type: 'chromino', status: 'lobby', players: [], game_config: {} });
    await ensureGameAssets('chromino');
    setGamePanelVisibility('chromino');
  });
  assert.equal(await page.locator('#theMindPanel').isVisible(), false);
  assert.equal(await page.locator('#theMindDialog').evaluate(node => node.open), false);
  assert.equal(await page.evaluate(() => document.body.classList.contains('tm-needs-action')), false);
  await context.close();
}

async function testTouch(browser, errors) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const page = await context.newPage();
  page.on('pageerror', error => errors.push(error.message));
  await prepare(page);
  await render(page, 'playing');

  await page.locator('#theMindPanel .tm-stat').nth(2).tap();
  assert.equal(await page.locator('#tmTooltip').isVisible(), true);
  assert.match(await page.locator('#tmTooltip').innerText(), /Throwing stars/);
  await page.waitForFunction(() => document.getElementById('tmTooltip').hidden, null, { timeout: 4500 });

  await page.locator('#theMindExplainBtn').tap();
  const target = page.locator('#theMindPanel button[data-tm-action="play"]');
  await target.scrollIntoViewIfNeeded();
  const box = await target.boundingBox();
  const cdp = await context.newCDPSession(page);
  const start = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [start] });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: start.x, y: start.y - 80 }] });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  assert.equal(await page.locator('#theMindDialog').evaluate(node => node.open), false, 'a scroll gesture never explains');
  assert.deepEqual(await page.evaluate(() => window.theMindTestActions), []);

  await target.tap();
  await page.locator('#theMindDialog[open]').waitFor();
  assert.match(await page.locator('#tmDialogBody').innerText(), /lowest card/);
  assert.deepEqual(await page.evaluate(() => window.theMindTestActions), []);
  await page.locator('#tmDialogClose').tap();
  await bounds(page, 'touch after explain');
  await context.close();
}

async function testLive(browser, errors) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const page = await context.newPage();
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(base);
  await page.waitForFunction(() => typeof socket !== 'undefined' && socket.connected && cachedGameList);
  assert.equal(await page.evaluate(() => performance.getEntriesByType('resource')
    .some(entry => entry.name.includes('/games/the_mind.'))), false, 'the home page loads no The Mind assets');
  await page.evaluate(() => socket.emit('room:create', { name: 'Alex', game_type: 'the_mind' }));
  await page.waitForFunction(() => roomSessionReady && currentGameType === 'the_mind');
  await page.waitForFunction(() => isGameAssetsLoaded('the_mind'), null, { timeout: 15000 });
  await page.evaluate(() => socket.emit('room:add_bot', {}));
  await page.waitForFunction(() => currentRoomState.players.length === 2);
  await page.evaluate(() => socket.emit('room:ready', { ready: true }));
  await page.waitForFunction(() => !document.getElementById('startBtn').disabled);
  if (!await page.locator('#startBtn').isVisible()) await page.locator('#roomControlsToggleBtn').click();
  await page.locator('#startBtn').click();
  await page.waitForFunction(() => isGameAssetsLoaded('the_mind') && lastGameStatePayload?.view?.phase === 'focus');
  assert.equal(await page.locator('#roomControlsPanel').evaluate(node => node.classList.contains('collapsed')), true);
  assert.equal(await page.evaluate(() => document.body.classList.contains('tm-needs-action')), true);
  assert.match(await page.evaluate(() => document.querySelector('.game-panel-title h2').textContent), /心意相通/);

  await page.locator('#theMindPanel button[data-tm-action="ready"]').click();
  await page.waitForFunction(() => lastGameStatePayload.view.phase === 'playing');
  await page.locator('#theMindPanel button[data-tm-action="play"]').click();
  await page.waitForFunction(() => lastGameStatePayload.view.hand.length === 0);
  const afterPlay = await page.evaluate(() => lastGameStatePayload.view.phase);
  if (afterPlay === 'playing') {
    await page.locator('#theMindPanel button[data-tm-action="request_star"]').click();
    await page.waitForFunction(() => lastGameStatePayload.view.phase === 'star_vote');
  }
  await page.waitForFunction(() => lastGameStatePayload.view.phase === 'round_end', null, { timeout: 25000 });
  await bounds(page, 'live round end 390px');
  await page.screenshot({ path: path.join(output, 'live-round-end-390.png'), fullPage: true });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await bounds(page, 'live round end 1440px');
  await page.screenshot({ path: path.join(output, 'live-round-end-1440.png'), fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });

  await page.locator('#theMindPanel button[data-tm-action="next_round"]').click();
  await page.waitForFunction(() => lastGameStatePayload.view.level === 2 && lastGameStatePayload.view.phase === 'focus');
  await page.reload();
  await page.waitForFunction(() => roomSessionReady && isGameAssetsLoaded('the_mind') && lastGameStatePayload?.view?.level === 2);
  assert.equal(await page.locator('#theMindPanel .tm-card').count(), 2, 'the private hand survives a reload');
  await page.locator('#theMindPanel button[data-tm-action="ready"]').click();
  await page.waitForFunction(() => lastGameStatePayload.view.phase === 'playing');
  await bounds(page, 'live playing after reload');

  if (!await page.locator('#leaveBtn').isVisible()) await page.locator('#roomControlsToggleBtn').click();
  await page.locator('#leaveBtn').click();
  await page.waitForFunction(() => !roomId);
  assert.equal(await page.locator('#theMindPanel').isVisible(), false);
  assert.equal(await page.evaluate(() => document.body.classList.contains('tm-needs-action')), false);
  await context.close();
}

(async () => {
  const browser = await chromium.launch({ channel: process.env.BROWSER_CHANNEL || 'chrome', headless: true });
  const errors = [];
  try {
    await testFixtures(browser, errors);
    await testTouch(browser, errors);
    await testLive(browser, errors);
    assert.deepEqual(errors, []);
    console.log('The Mind: themed panel without a nested frame, compact seats/rail/felt, recent plays and face-up'
      + ' discards, collapsible bounded log, private hands, Ready/Play/Stop/star/Next Round flows, Help/Explain/Esc,'
      + ' hover and three-second tap tooltips, scroll-versus-tap, ' + Object.keys(views).length
      + ' views at 320/390/1024/1440px, and a live bot room with reload and leave passed.');
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
