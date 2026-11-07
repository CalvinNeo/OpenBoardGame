const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { execFileSync } = require('node:child_process');
const base = process.env.ROOM_TEST_URL || 'http://127.0.0.1:8793';
const output = 'tmp/word-sync-ui';
fs.mkdirSync(output, { recursive: true });
const views = JSON.parse(execFileSync(process.env.PYTHON || 'python3', ['-c', `
import copy, json
from game.word_sync import WordSyncGame as Game
from tests.test_word_sync import players, action
state = Game.init_game({}, players(8))
names = ['Alex', 'Morgan', 'Jamie', 'Riley', 'Casey', 'Sam', 'Robin', 'Taylor']
for index, name in enumerate(names): state['players']['p'+str(index)]['name'] = name
views = {'guess': Game.get_public_view(state, 'p0')}
def play(player_id, kind='submit_word', **fields):
    assert Game.apply_action(state, player_id, action(state, kind, **fields))[1] is None
def snapshot(key, viewer='p0'): views[key] = Game.get_public_view(state, viewer)
play('p1', word='月亮')
snapshot('other_locked')
play('p0', word='月亮')
snapshot('own_locked')
snapshot('spectator', 'visitor')
for index, word in enumerate(['海', '山', '红', '蓝', '树', '花'], 2): play('p'+str(index), word=word)
snapshot('reveal')
play('p0', 'next_round')
snapshot('ready')
for index in range(1, 8): play('p'+str(index), 'next_round')
snapshot('matched_waiting')
snapshot('round_two', 'p2')
for index, word in enumerate(['海岸', '海岸', '天空', '天空', '森林', '果园'], 2): play('p'+str(index), word=word)
snapshot('second_reveal')
for index in range(8): play('p'+str(index), 'next_round')
play('p6', word='森林')
play('p7', word='森林')
snapshot('game_over')
views['long_names'] = copy.deepcopy(views['reveal'])
for member in views['long_names']['players']: member['name'] = 'VeryLongUnbrokenPlayerNameForResponsiveLayout' + member['player_id']
for team in views['long_names']['teams']: team['history'][0]['words'] = ['ABCDEFGHIJKLMNOPQRSTUVWXYZ'[:24], '<img src=x onerror=1>']
state = Game.init_game({}, players(2))
snapshot('two_players')
for number in range(35):
    play('p0', word='月亮')
    play('p1', word='星星')
    play('p0', 'next_round')
    play('p1', 'next_round')
snapshot('long_history')
state = Game.init_game({'mode': 'free_for_all'}, players(6))
for index, name in enumerate(['Alex', 'Morgan', 'Jamie', 'Riley', 'Casey', 'Sam']):
    state['players']['p' + str(index)]['name'] = name
snapshot('ffa_guess')
play('p1', word='月亮')
snapshot('ffa_other_locked')
play('p0', word='云')
snapshot('ffa_own_locked')
for index, word in enumerate(['海', '山', '红', '蓝'], 2): play('p' + str(index), word=word)
snapshot('ffa_reveal')
for index in range(6): play('p' + str(index), 'next_round')
snapshot('ffa_round_two', 'p2')
play('p0', word='月亮')
play('p3', word='月亮')
play('p1', word='海')
play('p2', word='山')
play('p4', word='红')
play('p5', word='蓝')
snapshot('ffa_game_over')
views['ffa_spectator'] = Game.get_public_view(state, 'visitor')
views['ffa_long_names'] = copy.deepcopy(views['ffa_game_over'])
for member in views['ffa_long_names']['players']:
    member['name'] = 'VeryLongUnbrokenPlayerNameForResponsiveLayout' + member['player_id']
for team in views['ffa_long_names']['teams']:
    team['history'][-1]['words'] = ['ABCDEFGHIJKLMNOPQRSTUVWXYZ'[:24], '<img src=x onerror=1>']
print(json.dumps(views))
`], { encoding: 'utf8' }));

async function checkBounds(page, label) {
  const result = await page.evaluate(() => {
    const issues = [];
    const selectors = '#wordSyncPanel, #wordSyncPanel *, .game-panel > .panel-header, .game-panel > .panel-header *, #wordSyncDialog[open], #wordSyncDialog[open] > .ws-dialog-heading, #wordSyncDialog[open] > .ws-dialog-heading *, #wordSyncDialog[open] > #wordSyncDialogBody, #wordSyncDialog[open] > #wordSyncDialogBody *';
    for (const node of document.querySelectorAll(selectors)) {
      const rect = node.getBoundingClientRect();
      if (!node.getClientRects().length || !rect.width || !rect.height || node.closest('[hidden]') || node.matches('input')) continue;
      const style = getComputedStyle(node);
      if (rect.left < -1 || rect.right > innerWidth + 1) issues.push(`viewport: ${node.id || node.className}`);
      if (node.clientWidth && node.scrollWidth > node.clientWidth + 1 && !['auto', 'scroll', 'hidden', 'clip'].includes(style.overflowX)) {
        issues.push(`text: ${node.id || node.className} (${node.scrollWidth}/${node.clientWidth})`);
      }
    }
    for (const selector of ['.ws-layout', '.ws-pair', '.ws-teams', '.ws-team-pair', '.ws-input-row', '.ws-heading', '.game-panel > .panel-header', '.ws-review']) {
      for (const parent of document.querySelectorAll(selector)) {
        const children = [...parent.children].filter(node => node.getClientRects().length && getComputedStyle(node).position !== 'fixed');
        for (let first = 0; first < children.length; first += 1) {
          for (let second = first + 1; second < children.length; second += 1) {
            const left = children[first].getBoundingClientRect();
            const right = children[second].getBoundingClientRect();
            if (Math.min(left.right, right.right) - Math.max(left.left, right.left) > 1
                && Math.min(left.bottom, right.bottom) - Math.max(left.top, right.top) > 1) issues.push(`overlap: ${selector}`);
          }
        }
      }
    }
    return { overflow: document.documentElement.scrollWidth > innerWidth, issues };
  });
  if (result.overflow || result.issues.length) {
    await page.screenshot({path: `${output}/failure.png`, fullPage: true});
    console.log(label, JSON.stringify(await page.locator('.game-panel > .panel-header').evaluate(node => ({width: node.clientWidth,
      children: [...node.querySelectorAll('*')].filter(child => child.getClientRects().length).map(child => ({id: child.id || child.className, rect: child.getBoundingClientRect().toJSON(), scroll: child.scrollWidth, client: child.clientWidth}))}))));
  }
  assert.deepEqual(result, { overflow: false, issues: [] }, label);
}

async function renderFixture(page, key, reset = true) {
  await page.evaluate(async ({ view, reset }) => {
    if (reset) showWordSyncHeaderActions(false);
    roomId = 'word-sync-fixture';
    playerId = view.you;
    roomSessionReady = true;
    const room = {room_id: roomId, game_type: 'word_sync', status: view.game_over ? 'game_over' : 'in_game',
      players: view.players, min_players: 2, max_players: 10,
      player_counts: [2, 3, 4, 5, 6, 7, 8, 9, 10], game_config: {mode: view.mode}};
    renderRoomState(room);
    await ensureGameAssets('word_sync');
    setGamePanelVisibility('word_sync');
    lastGameStatePayload = {room_id: roomId, game_type: 'word_sync', view};
    renderGameState(lastGameStatePayload);
    setRoomControlsCollapsed(true);
    if (reset) window.wordSyncTestActions = [];
    window.scrollTo(0, 0);
  }, { view: views[key], reset });
}

async function clickDisabled(page, locator) {
  await locator.scrollIntoViewIfNeeded();
  const bounds = await locator.boundingBox();
  await page.mouse.click(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2);
}

async function testFixtures(browser, errors) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const page = await context.newPage();
  page.on('pageerror', error => errors.push(error.message));
  await page.route('https://fonts.googleapis.com/**', route => route.abort());
  await page.goto(base);
  await page.waitForFunction(() => typeof socket !== 'undefined' && socket.connected && cachedGameList);
  assert.equal(await page.evaluate(() => performance.getEntriesByType('resource').some(entry => entry.name.includes('/games/word_sync.'))), false);
  await page.evaluate(async () => {
    await ensureGameAssets('word_sync');
    window.wordSyncTestActions = [];
    window.sendAction = fields => window.wordSyncTestActions.push(fields);
  });
  for (const width of [320, 390, 1024, 1440]) {
    await page.setViewportSize({ width, height: width < 600 ? 844 : 1000 });
    for (const fixture of ['guess', 'own_locked', 'spectator', 'reveal', 'ready', 'matched_waiting', 'round_two', 'game_over', 'long_names', 'two_players',
      'ffa_guess', 'ffa_own_locked', 'ffa_spectator', 'ffa_reveal', 'ffa_round_two', 'ffa_game_over', 'ffa_long_names']) {
      await renderFixture(page, fixture);
      await checkBounds(page, `${width}px ${fixture}`);
      assert.equal(await page.locator('#wordSyncPanel img').count(), 0);
      if (['guess', 'reveal', 'game_over', 'ffa_guess', 'ffa_reveal', 'ffa_game_over'].includes(fixture)) {
        await page.screenshot({path: `${output}/${fixture}-${width}.png`, fullPage: true});
      }
    }
    await page.locator('#wordSyncHelpBtn').click();
    await page.locator('#wordSyncDialog[open]').waitFor();
    await checkBounds(page, `${width}px Help`);
    await page.keyboard.press('Escape');
    assert.equal(await page.locator('#wordSyncDialog').evaluate(node => node.open), false);
  }
  await renderFixture(page, 'guess');
  await page.locator('#wordSyncWord').fill('private draft');
  await renderFixture(page, 'other_locked', false);
  assert.equal(await page.locator('#wordSyncWord').inputValue(), 'private draft');
  assert.equal(await page.evaluate(() => document.activeElement.id), 'wordSyncWord');
  assert(!await page.locator('#wordSyncPair').innerText().then(text => text.includes('月亮')));
  await page.locator('#wordSyncWord').dispatchEvent('compositionstart');
  await page.locator('#wordSyncWord').press('Enter');
  assert.equal(await page.evaluate(() => window.wordSyncTestActions.length), 0);
  await page.locator('#wordSyncWord').dispatchEvent('compositionend');
  await page.locator('#wordSyncWord').fill('x'.repeat(25));
  await page.locator('#wordSyncSubmit').click();
  assert.equal(await page.evaluate(() => window.wordSyncTestActions.length), 0);
  assert.match(await page.locator('#wordSyncError').innerText(), /24/);
  await page.locator('#wordSyncWord').fill('ocean');
  await page.locator('#wordSyncSubmit').click();
  assert.equal(await page.evaluate(() => window.wordSyncTestActions.length), 1);
  assert.equal(await page.locator('#wordSyncSubmit').isDisabled(), true);
  await renderFixture(page, 'other_locked', false);
  assert.equal(await page.locator('#wordSyncSubmit').isDisabled(), true);
  await page.evaluate(() => socket.listeners('system:error').forEach(handler => handler({message: 'Test rejection'})));
  assert.equal(await page.locator('#wordSyncSubmit').isDisabled(), false);
  assert.equal(await page.locator('#wordSyncWord').inputValue(), 'ocean');

  await renderFixture(page, 'guess');
  await page.locator('#wordSyncExplainBtn').click();
  assert.equal(await page.locator('#wordSyncExplainBtn').getAttribute('aria-pressed'), 'true');
  await clickDisabled(page, page.locator('#wordSyncSubmit'));
  await page.locator('#wordSyncDialog[open]').waitFor();
  assert.match(await page.locator('#wordSyncDialogBody').innerText(), /cannot be changed/);
  assert.equal(await page.locator('#wordSyncExplainBtn').getAttribute('aria-pressed'), 'false');
  assert.equal(await page.evaluate(() => window.wordSyncTestActions.length), 0);
  await page.keyboard.press('Escape');
  await page.evaluate(() => {
    const button = document.createElement('button');
    button.id = 'wordSyncTestNoExplanation';
    button.textContent = 'Test action';
    button.onclick = () => { window.wordSyncTestUnexpected = true; };
    document.getElementById('wordSyncPanel').appendChild(button);
  });
  await page.locator('#wordSyncExplainBtn').click();
  await page.locator('#wordSyncTestNoExplanation').click();
  assert.equal(await page.evaluate(() => Boolean(window.wordSyncTestUnexpected)), false);
  assert.equal(await page.locator('#wordSyncExplainBtn').getAttribute('aria-pressed'), 'true');
  await page.keyboard.press('Escape');
  await page.locator('#wordSyncTestNoExplanation').evaluate(node => node.remove());
  await page.locator('#wordSyncRound').hover();
  assert.equal(await page.locator('#wordSyncTooltip').isVisible(), true);
  await page.locator('#wordSyncWord').click();
  assert.equal(await page.locator('#wordSyncTooltip').isVisible(), false);

  await renderFixture(page, 'reveal');
  await page.locator('#wordSyncNext').click();
  assert.equal(await page.evaluate(() => window.wordSyncTestActions[0].type), 'next_round');
  assert.equal(await page.locator('#wordSyncDialog').evaluate(node => node.open), false);
  await renderFixture(page, 'ready', false);
  assert.equal(await page.locator('#wordSyncNext').isDisabled(), true);
  await renderFixture(page, 'long_history');
  await page.locator('#wordSyncHistory summary').click();
  assert.equal(await page.locator('#wordSyncHistoryRows').evaluate(node => node.scrollHeight > node.clientHeight && node.clientHeight <= 250), true);
  await checkBounds(page, 'bounded history');
  await renderFixture(page, 'ffa_game_over');
  await page.locator('#wordSyncHistory summary').click();
  assert.equal(await page.locator('#wordSyncHistoryRows .ws-chip').count(), 12);
  assert.equal(await page.locator('#wordSyncHistoryRows .ws-chip-match').count(), 2);
  assert.equal(await page.locator('#wordSyncHistoryRows img').count(), 0);
  await checkBounds(page, 'free-for-all history');
  await page.setViewportSize({width: 320, height: 844});
  await checkBounds(page, 'free-for-all history 320px');
  await page.screenshot({path: `${output}/ffa-history-320.png`, fullPage: true});
  await page.setViewportSize({width: 1440, height: 1000});
  await page.locator('#wordSyncHistory summary').click();
  await page.locator('#wordSyncHelpBtn').click();
  await page.evaluate(async () => {
    renderRoomState({room_id: 'other', game_type: 'chromino', status: 'lobby', players: [], game_config: {}});
    await ensureGameAssets('chromino');
    setGamePanelVisibility('chromino');
  });
  assert.equal(await page.locator('#wordSyncDialog').evaluate(node => node.open), false);
  assert.equal(await page.locator('#wordSyncPanel').isVisible(), false);
  assert.equal(await page.evaluate(() => document.body.classList.contains('ws-needs-action') || document.body.classList.contains('ws-explaining')), false);
  await renderFixture(page, 'guess');
  assert.equal(await page.locator('#wordSyncWord').inputValue(), '');
  await context.close();
}

async function testTouch(browser, errors) {
  const context = await browser.newContext({viewport: {width: 390, height: 844}, isMobile: true, hasTouch: true});
  const page = await context.newPage();
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(base);
  await page.waitForFunction(() => typeof socket !== 'undefined' && socket.connected);
  await page.evaluate(async () => {
    await ensureGameAssets('word_sync');
    window.sendAction = fields => window.wordSyncTestActions.push(fields);
  });
  await renderFixture(page, 'reveal');
  await page.locator('#wordSyncRound').tap();
  assert.equal(await page.locator('#wordSyncTooltip').isVisible(), true);
  await page.locator('#wordSyncProgress').tap();
  assert.match(await page.locator('#wordSyncTooltip').innerText(), /Matched teams/);
  await page.waitForFunction(() => document.getElementById('wordSyncTooltip').hidden, null, {timeout: 4500});
  await page.locator('#wordSyncExplainBtn').tap();
  const target = page.locator('#wordSyncNext');
  await target.scrollIntoViewIfNeeded();
  const bounds = await target.boundingBox();
  const cdp = await context.newCDPSession(page);
  const start = {x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2};
  await cdp.send('Input.dispatchTouchEvent', {type: 'touchStart', touchPoints: [start]});
  await cdp.send('Input.dispatchTouchEvent', {type: 'touchMove', touchPoints: [{x: start.x, y: start.y - 70}]});
  await cdp.send('Input.dispatchTouchEvent', {type: 'touchEnd', touchPoints: []});
  assert.equal(await page.locator('#wordSyncDialog').evaluate(node => node.open), false);
  assert.equal(await page.evaluate(() => window.wordSyncTestActions.length), 0);
  await target.tap();
  await page.locator('#wordSyncDialog[open]').waitFor();
  assert.equal(await page.evaluate(() => window.wordSyncTestActions.length), 0);
  await page.locator('#wordSyncDialogClose').tap();
  await checkBounds(page, 'touch after explain');
  await context.close();
}

async function testLive(browser, errors) {
  const contexts = [];
  const pages = [];
  for (let index = 0; index < 4; index += 1) {
    const context = await browser.newContext({viewport: {width: index ? 1024 : 390, height: 900}});
    contexts.push(context);
    const page = await context.newPage();
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(base);
    await page.waitForFunction(() => typeof socket !== 'undefined' && socket.connected && cachedGameList);
    pages.push(page);
  }
  const host = pages[0];
  await host.evaluate(() => socket.emit('room:create', {name: 'Alex', game_type: 'word_sync'}));
  await host.waitForFunction(() => roomSessionReady && currentGameType === 'word_sync');
  assert.equal(await host.evaluate(() => isGameAssetsLoaded('word_sync')), false);
  assert.equal(await host.locator('#gameAssetsStatus').isVisible(), false);
  const room = await host.evaluate(() => roomId);
  for (let index = 1; index < 4; index += 1) {
    await pages[index].evaluate(({room, index}) => socket.emit('room:join', {room_id: room, name: ['Alex', 'Morgan', 'Jamie', 'Riley'][index]}), {room, index});
    await pages[index].waitForFunction(() => roomSessionReady && currentGameType === 'word_sync');
    assert.equal(await pages[index].evaluate(() => isGameAssetsLoaded('word_sync')), false);
  }
  for (const page of pages) await page.evaluate(() => socket.emit('room:ready', {ready: true}));
  await host.waitForFunction(() => !document.getElementById('startBtn').disabled);
  await host.locator('#startBtn').click();
  for (const page of pages) await page.waitForFunction(() => isGameAssetsLoaded('word_sync') && lastGameStatePayload?.view?.phase === 'guess');
  assert.equal(await host.locator('#roomControlsPanel').evaluate(node => node.classList.contains('collapsed')), true);
  assert.equal(await host.evaluate(() => document.body.classList.contains('ws-needs-action')), true);
  await host.locator('#wordSyncWord').fill('月亮');
  await pages[1].locator('#wordSyncWord').fill('月亮');
  await pages[1].locator('#wordSyncSubmit').click();
  await host.waitForFunction(() => lastGameStatePayload.view.players[1].submitted);
  assert.equal(await host.locator('#wordSyncWord').inputValue(), '月亮');
  assert(!await host.locator('#wordSyncPair').innerText().then(text => text.includes('月亮')));
  await host.locator('#wordSyncSubmit').click();
  await host.waitForFunction(() => lastGameStatePayload.view.your_word === '月亮');
  assert.equal(await host.locator('#wordSyncForm').isVisible(), false);
  assert.equal(await pages[2].evaluate(() => JSON.stringify(lastGameStatePayload).includes('月亮')), false);
  await host.evaluate(() => socket.disconnect());
  await host.waitForFunction(() => !socket.connected && !roomSessionReady);
  assert.equal(await host.evaluate(() => document.body.classList.contains('ws-needs-action')), false);
  await host.evaluate(() => socket.connect());
  await host.waitForFunction(() => roomSessionReady && lastGameStatePayload?.view?.your_word === '月亮');
  await host.reload();
  await host.waitForFunction(() => roomSessionReady && isGameAssetsLoaded('word_sync') && lastGameStatePayload?.view?.your_word === '月亮');
  assert.equal(await host.evaluate(() => roomId), room);
  assert.equal(await host.locator('#wordSyncForm').isVisible(), false);
  for (const [index, word] of [[2, '海'], [3, '山']]) {
    await pages[index].locator('#wordSyncWord').fill(word);
    await pages[index].locator('#wordSyncSubmit').click();
  }
  for (const page of pages) await page.waitForFunction(() => lastGameStatePayload?.view?.phase === 'reveal');
  assert.match(await host.locator('#wordSyncTeams').innerText(), /月亮/);
  for (const page of pages.slice(0, 3)) await page.locator('#wordSyncNext').click();
  await host.waitForFunction(() => lastGameStatePayload.view.next_ready.length === 3);
  assert.equal(await host.evaluate(() => lastGameStatePayload.view.phase), 'reveal');
  await pages[3].locator('#wordSyncNext').click();
  for (const page of pages) await page.waitForFunction(() => lastGameStatePayload?.view?.round === 2);
  assert.equal(await host.locator('#wordSyncForm').isVisible(), false);
  for (const page of pages.slice(2)) {
    await page.locator('#wordSyncWord').fill('海岸');
    await page.locator('#wordSyncSubmit').click();
  }
  for (const page of pages) await page.waitForFunction(() => lastGameStatePayload?.view?.game_over);
  const final = await host.evaluate(() => lastGameStatePayload.view);
  assert.deepEqual(final.standings.map(row => row.rounds), [1, 2]);
  assert.deepEqual(final.winning_team_ids, ['team-1']);
  if (await host.locator('#roomControlsCollapseBtn').isVisible()) await host.locator('#roomControlsCollapseBtn').click();
  assert.match(await host.locator('#wordSyncTitle').innerText(), /Team 1 wins/);
  await checkBounds(host, 'live final mobile');
  await host.screenshot({path: `${output}/live-finished-390.png`, fullPage: true});
  // Game options live in the lobby, so free-for-all starts from a fresh room.
  for (const page of pages) await page.evaluate(room => socket.emit('room:leave', {room_id: room}), room);
  await host.evaluate(() => socket.emit('room:create', {name: 'Alex', game_type: 'word_sync'}));
  await host.waitForFunction(() => roomSessionReady && currentGameType === 'word_sync' && currentRoomState.status === 'lobby');
  const ffaRoom = await host.evaluate(() => roomId);
  assert.notEqual(ffaRoom, room);
  for (let index = 1; index < 4; index += 1) {
    await pages[index].evaluate(({ffaRoom, index}) => socket.emit('room:join', {room_id: ffaRoom, name: ['Alex', 'Morgan', 'Jamie', 'Riley'][index]}), {ffaRoom, index});
    await pages[index].waitForFunction(() => roomSessionReady && currentGameType === 'word_sync');
  }
  if (!await host.locator('#wordSyncModeSelect').isVisible()) await host.locator('#roomControlsToggleBtn').click();
  await host.locator('#wordSyncModeSelect').waitFor({state: 'visible'});
  assert.equal(await host.locator('#wordSyncModeSelect').inputValue(), 'team');
  await host.locator('#wordSyncModeSelect').selectOption('free_for_all');
  for (const page of pages) await page.evaluate(() => socket.emit('room:ready', {ready: true}));
  await host.waitForFunction(() => !document.getElementById('startBtn').disabled);
  await host.locator('#startBtn').click();
  for (const page of pages) await page.waitForFunction(() => lastGameStatePayload?.view?.mode === 'free_for_all' && lastGameStatePayload.view.phase === 'guess');
  assert.equal(await pages[2].evaluate(() => currentRoomState.game_config.mode), 'free_for_all');
  await host.locator('#wordSyncWord').fill('海');
  await host.locator('#wordSyncSubmit').click();
  await pages[1].locator('#wordSyncWord').fill('海');
  await pages[1].locator('#wordSyncSubmit').click();
  await pages[2].locator('#wordSyncWord').fill('山');
  await pages[2].locator('#wordSyncSubmit').click();
  await pages[3].waitForFunction(() => lastGameStatePayload?.view?.players?.filter(member => member.submitted).length === 3);
  assert.equal(await pages[3].evaluate(() => JSON.stringify(lastGameStatePayload).includes('海')), false);
  assert.match(await pages[3].locator('#wordSyncStatus').innerText(), /3 \/ 4 words locked/);
  assert.match(await pages[3].locator('#wordSyncTeams').innerText(), /🔒 Locked/);
  await pages[3].locator('#wordSyncWord').fill('云');
  await pages[3].locator('#wordSyncSubmit').click();
  for (const page of pages) await page.waitForFunction(() => lastGameStatePayload?.view?.game_over);
  const freeForAll = await host.evaluate(() => lastGameStatePayload.view);
  assert.equal(freeForAll.winner.length, 2);
  assert.deepEqual(freeForAll.winning_team_ids, ['team-1', 'team-2']);
  assert.equal(await host.locator('#wordSyncTitle').innerText(), 'Alex + Morgan win!');
  assert.equal(await pages[2].locator('#wordSyncTitle').innerText(), 'Alex + Morgan win!');
  assert.match(await host.locator('#wordSyncTeams').innerText(), /🏆/);
  assert.match(await pages[2].locator('#wordSyncStatus').innerText(), /Nobody wrote your word/);
  await checkBounds(host, 'live free-for-all final');
  if (await host.locator('#roomControlsCollapseBtn').isVisible()) await host.locator('#roomControlsCollapseBtn').click();
  await host.screenshot({path: `${output}/live-ffa-390.png`, fullPage: true});

  await host.evaluate(() => socket.emit('room:create', {name: 'Practice', game_type: 'word_sync'}));
  await host.waitForFunction(previous => roomId !== previous && currentRoomState.status === 'lobby', room);
  await host.evaluate(() => socket.emit('room:add_bot', {}));
  await host.waitForFunction(() => currentRoomState.players.length === 2);
  await host.evaluate(() => socket.emit('room:ready', {ready: true}));
  await host.waitForFunction(() => !document.getElementById('startBtn').disabled);
  if (!await host.locator('#startBtn').isVisible()) await host.locator('#roomControlsToggleBtn').click();
  await host.locator('#startBtn').click();
  await host.waitForFunction(() => lastGameStatePayload?.view?.phase === 'guess' && lastGameStatePayload.view.players[1].submitted);
  assert.equal(await host.evaluate(() => JSON.stringify(lastGameStatePayload).includes('星星')), false);
  await host.locator('#wordSyncWord').fill('星星');
  await host.locator('#wordSyncSubmit').click();
  await host.waitForFunction(() => lastGameStatePayload?.view?.game_over);
  assert.equal(await host.evaluate(() => lastGameStatePayload.view.round), 1);

  // Team mode blocks an odd roster in the lobby; free-for-all takes the same room.
  const practiceRoom = await host.evaluate(() => roomId);
  await host.evaluate(() => socket.emit('room:create', {name: 'Odd', game_type: 'word_sync'}));
  await host.waitForFunction(previous => roomId !== previous && currentRoomState.status === 'lobby', practiceRoom);
  for (const total of [2, 3]) {
    await host.evaluate(() => socket.emit('room:add_bot', {}));
    await host.waitForFunction(count => currentRoomState.players.length === count, total);
  }
  await host.evaluate(() => socket.emit('room:ready', {ready: true}));
  if (!await host.locator('#wordSyncModeSelect').isVisible()) await host.locator('#roomControlsToggleBtn').click();
  await host.locator('#wordSyncModeSelect').waitFor({state: 'visible'});
  assert.match(await host.evaluate(() => getRoomStartReason()), /^Team mode needs 2 \/ 4 \/ 6 \/ 8 \/ 10 players\./);
  assert.equal(await host.locator('#startBtn').isDisabled(), true);
  await host.locator('#wordSyncModeSelect').selectOption('free_for_all');
  assert.equal(await host.evaluate(() => getRoomStartReason()), '');
  assert.equal(await host.locator('#startBtn').isDisabled(), false);
  await host.locator('#startBtn').click();
  await host.waitForFunction(() => lastGameStatePayload?.view?.mode === 'free_for_all' && lastGameStatePayload.view.phase === 'guess');
  assert.equal(await host.evaluate(() => lastGameStatePayload.view.players.length), 3);
  assert.equal(await host.evaluate(() => lastGameStatePayload.view.teams.length), 3);
  for (const context of contexts) await context.close();
}

async function startLoadingRoom(page) {
  await page.evaluate(() => socket.emit('room:create', {name: 'Loading QA', game_type: 'word_sync'}));
  await page.waitForFunction(() => roomSessionReady && currentGameType === 'word_sync');
  assert.equal(await page.evaluate(() => isGameAssetsLoaded('word_sync')), false);
  assert.equal(await page.locator('#gameAssetsStatus').isVisible(), false);
  await page.evaluate(() => socket.emit('room:add_bot', {}));
  await page.waitForFunction(() => currentRoomState.players.length === 2);
  await page.evaluate(() => socket.emit('room:ready', {ready: true}));
  await page.waitForFunction(() => !document.getElementById('startBtn').disabled);
  assert.equal(await page.evaluate(() => performance.getEntriesByType('resource').filter(entry => entry.name.includes('/games/word_sync.')).length), 0);
  await page.locator('#startBtn').click();
  await page.waitForFunction(() => currentRoomState.status === 'in_game');
}

async function testStartupLoading(browser, errors) {
  const context = await browser.newContext({viewport: {width: 390, height: 844}});
  const page = await context.newPage();
  page.on('pageerror', error => errors.push(error.message));
  const waiting = new Map();
  const requests = [];
  await page.route('**/static/games/word_sync.*', async route => {
    const extension = new URL(route.request().url()).pathname.split('.').pop();
    requests.push(extension);
    await new Promise(resolve => waiting.set(extension, resolve));
    if (extension === 'js') {
      const response = await route.fetch();
      await route.fulfill({response, body: 'window.wordSyncStartupExecutions = (window.wordSyncStartupExecutions || 0) + 1;\n' + await response.text()});
    } else await route.continue();
  });
  try {
    await page.goto(base);
    await page.waitForFunction(() => typeof socket !== 'undefined' && socket.connected && cachedGameList);
    await startLoadingRoom(page);
    await page.waitForFunction(() => gameAssetProgress.get('word_sync')?.total === 3);
    assert.deepEqual(requests.sort(), ['css', 'html']);
    assert.equal(await page.locator('#gameAssetsPercent').innerText(), '0%');
    for (const width of [320, 390, 1024, 1440]) {
      await page.setViewportSize({width, height: width < 600 ? 844 : 1000});
      const bounds = await page.locator('#gameAssetsStatus').evaluate(node => {
        const rect = node.getBoundingClientRect();
        return {overflow: document.documentElement.scrollWidth > innerWidth,
          inside: rect.left >= 0 && rect.right <= innerWidth,
          textFits: [...node.querySelectorAll('*')].every(child => !child.clientWidth || child.scrollWidth <= child.clientWidth + 1)};
      });
      assert.deepEqual(bounds, {overflow: false, inside: true, textFits: true});
      await page.screenshot({path: `${output}/startup-${width}.png`, fullPage: true});
    }
    waiting.get('html')();
    await page.waitForFunction(() => document.getElementById('gameAssetsProgress').getAttribute('aria-valuenow') === '33');
    assert.match(await page.locator('#gameAssetsMessage').innerText(), /1 \/ 3 files ready/);
    waiting.get('css')();
    await page.waitForFunction(() => document.getElementById('gameAssetsProgress').getAttribute('aria-valuenow') === '66');
    assert.match(await page.locator('#gameAssetsMessage').innerText(), /Loading game logic/);
    await page.clock.install();
    await page.clock.runFor(15100);
    await page.locator('#gameAssetsRetryBtn').waitFor({state: 'visible'});
    assert.match(await page.locator('#gameAssetsMessage').innerText(), /timed out/);
    assert.equal(await page.locator('#gameAssetsStatus').getAttribute('aria-busy'), 'false');
    await page.locator('#gameAssetsRetryBtn').click();
    await page.waitForFunction(() => !gameAssetErrors.has('word_sync') && gameAssetProgress.get('word_sync')?.completed === 2);
    assert.equal(requests.filter(extension => extension === 'js').length, 1);
    waiting.get('js')();
    await page.waitForFunction(() => isGameAssetsLoaded('word_sync'));
    assert.equal(await page.evaluate(() => window.wordSyncStartupExecutions), 1);
    assert.equal(await page.locator('#gameAssetsStatus').isVisible(), false);
    assert.equal(await page.locator('#wordSyncWord').isVisible(), true);
    assert.equal(await page.evaluate(() => gameAssetProgress.get('word_sync').completed), 3);
    assert.equal(await page.locator('script[src*="/word_sync.js"]').count(), 1);
  } finally {
    for (const release of waiting.values()) release();
    await context.close();
  }

  const retryContext = await browser.newContext({viewport: {width: 390, height: 844}});
  const retryPage = await retryContext.newPage();
  retryPage.on('pageerror', error => errors.push(error.message));
  let attempts = 0;
  await retryPage.route('**/static/games/word_sync.html?*', route => {
    attempts += 1;
    return attempts === 1 ? route.fulfill({status: 503, body: 'Unavailable'}) : route.continue();
  });
  try {
    await retryPage.goto(base);
    await retryPage.waitForFunction(() => typeof socket !== 'undefined' && socket.connected && cachedGameList);
    await startLoadingRoom(retryPage);
    await retryPage.locator('#gameAssetsRetryBtn').waitFor({state: 'visible'});
    await retryPage.locator('#gameAssetsRetryBtn').click();
    await retryPage.waitForFunction(() => isGameAssetsLoaded('word_sync'));
    assert.equal(attempts, 2);
    assert.equal(await retryPage.locator('#wordSyncWord').isVisible(), true);
    assert.equal(await retryPage.locator('#wordSyncWord').count(), 1);
    const currentRoom = await retryPage.evaluate(() => roomId);
    await retryPage.reload();
    await retryPage.waitForFunction(() => roomSessionReady && isGameAssetsLoaded('word_sync') && lastGameStatePayload?.view?.game_id === 'word_sync');
    assert.equal(await retryPage.evaluate(() => roomId), currentRoom);
  } finally {
    await retryContext.close();
  }

  const leavingContext = await browser.newContext({viewport: {width: 390, height: 844}});
  const leaving = await leavingContext.newPage();
  leaving.on('pageerror', error => errors.push(error.message));
  let releaseScript;
  const heldScript = new Promise(resolve => {releaseScript = resolve;});
  await leaving.route('**/static/games/word_sync.js?*', async route => {
    await heldScript;
    await route.continue();
  });
  try {
    await leaving.goto(base);
    await leaving.waitForFunction(() => typeof socket !== 'undefined' && socket.connected && cachedGameList);
    await startLoadingRoom(leaving);
    await leaving.waitForFunction(() => gameAssetProgress.get('word_sync')?.completed === 2);
    await leaving.locator('#roomControlsToggleBtn').click();
    await leaving.locator('#leaveBtn').click();
    await leaving.waitForFunction(() => !roomId);
    releaseScript();
    await leaving.waitForFunction(() => isGameAssetsLoaded('word_sync'));
    assert.equal(await leaving.evaluate(() => currentRoomState), null);
    assert.equal(await leaving.locator('#wordSyncPanel').isVisible(), false);
    assert.equal(await leaving.locator('#gameAssetsStatus').isVisible(), false);
  } finally {
    releaseScript();
    await leavingContext.close();
  }
}

(async () => {
  const browser = await chromium.launch({channel: 'chrome', headless: true});
  const errors = [];
  try {
    await testStartupLoading(browser, errors);
    await testFixtures(browser, errors);
    await testTouch(browser, errors);
    await testLive(browser, errors);
    assert.deepEqual(errors, []);
    console.log('Word Sync: deferred startup, real file progress, timeout/retry without duplicate scripts, 320/390/1024/1440px, team and free-for-all layouts, hidden words, input/IME, reveal/ready/results, Help/Explain/Esc, touch/scroll, history, room switch, mode switch, reconnect and live bots passed.');
  } finally {
    await browser.close();
  }
})().catch(error => {console.error(error); process.exitCode = 1;});
