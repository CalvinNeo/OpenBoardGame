const {chromium} = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const {execFileSync} = require('node:child_process');
const base = process.env.ROOM_TEST_URL || 'http://127.0.0.1:8797';
const output = 'tmp/codenames-ui';
fs.mkdirSync(output, {recursive: true});
const views = JSON.parse(execFileSync(process.env.PYTHON || 'python3', ['-c', `
import copy, json
from game.codenames import CodenamesGame as Game
from tests.test_codenames import players, start_game, actor, action
state = Game.init_game({}, players(8))
views = {'setup': Game.get_public_view(state, 'person-0')}
state = start_game(8)
def snapshot(key, viewer): views[key] = Game.get_public_view(state, viewer)
master = actor(state, 'spymaster')
operative = actor(state, 'operative')
snapshot('clue', master)
snapshot('waiting', operative)
Game.apply_action(state, master, action(state, 'clue', word='联想', number=2))
snapshot('guess', operative)
snapshot('master', master)
snapshot('spectator', 'visitor')
neutral = next(index for index, card in enumerate(state['board']) if card['identity'] == 'neutral')
Game.apply_action(state, operative, action(state, 'guess', index=neutral))
snapshot('turn_end', operative)
Game.apply_action(state, operative, action(state, 'next_round'))
snapshot('ready', operative)
for player_id in state['players']:
    if player_id != operative: Game.apply_action(state, player_id, action(state, 'next_round'))
snapshot('next_clue', actor(state, 'spymaster'))
Game.apply_action(state, actor(state, 'spymaster'), action(state, 'clue', word='联想', number='unlimited'))
assassin = next(index for index, card in enumerate(state['board']) if card['identity'] == 'assassin')
Game.apply_action(state, actor(state, 'operative'), action(state, 'guess', index=assassin))
snapshot('result', operative)
for player_id in state['players']: Game.apply_action(state, player_id, action(state, 'confirm_result'))
snapshot('game_over', operative)
state = start_game(8, 'en')
Game.apply_action(state, actor(state, 'spymaster'), action(state, 'clue', word='Association', number=0))
snapshot('english', actor(state, 'operative'))
snapshot('english_key', actor(state, 'spymaster'))
views['long_names'] = copy.deepcopy(views['result'])
for member in views['long_names']['players']: member['name'] = 'VeryLongUnbrokenPlayerNameForResponsiveLayout' + member['player_id']
views['long_names']['history'] *= 30
print(json.dumps(views))
`], {encoding: 'utf8'}));

async function fixture(page, key) {
  await page.evaluate(async view => {
    showCodenamesHeaderActions(false);
    roomId = 'codenames-fixture';
    playerId = view.you;
    roomSessionReady = true;
    renderRoomState({room_id: roomId, game_type: 'codenames', status: view.game_over ? 'game_over' : 'in_game',
      players: view.players, min_players: 4, max_players: 8, game_config: {}});
    await ensureGameAssets('codenames');
    setGamePanelVisibility('codenames');
    lastGameStatePayload = {room_id: roomId, game_type: 'codenames', view};
    renderGameState(lastGameStatePayload);
    setRoomControlsCollapsed(true);
    window.codenamesTestActions = [];
    window.scrollTo(0, 0);
  }, views[key]);
}

async function layout(page, label) {
  const result = await page.evaluate(() => {
    const issues = [];
    const selectors = '#codenamesPanel *, .game-panel > .panel-header, .game-panel > .panel-header *';
    for (const node of document.querySelectorAll(selectors)) {
      if (!node.getClientRects().length || node.closest('[hidden]')) continue;
      const bounds = node.getBoundingClientRect();
      const style = getComputedStyle(node);
      if (!bounds.width || !bounds.height || style.position === 'fixed') continue;
      if (bounds.left < -1 || bounds.right > innerWidth + 1) issues.push(`viewport: ${node.id || node.className}`);
      if (node.clientWidth && node.scrollWidth > node.clientWidth + 1 && !['auto', 'scroll', 'hidden', 'clip'].includes(style.overflowX) && !node.matches('input,select')) issues.push(`text: ${node.id || node.className}`);
    }
    for (const selector of ['.cn-board', '.cn-masthead', '.cn-scores', '.cn-score', '.cn-clue-form', '.cn-role-choices', '.cn-setup-controls', '.cn-teams', '.cn-section-heading', '.cn-selection', '.cn-turn-controls', '.game-panel > .panel-header']) {
      for (const parent of document.querySelectorAll(selector)) {
        const children = [...parent.children].filter(node => node.getClientRects().length && !node.closest('[hidden]'));
        for (let first = 0; first < children.length; first += 1) {
          for (let second = first + 1; second < children.length; second += 1) {
            const left = children[first].getBoundingClientRect();
            const right = children[second].getBoundingClientRect();
            if (Math.min(left.right, right.right) - Math.max(left.left, right.left) > 1 && Math.min(left.bottom, right.bottom) - Math.max(left.top, right.top) > 1) issues.push(`overlap: ${selector}`);
          }
        }
      }
    }
    return {overflow: document.documentElement.scrollWidth > innerWidth, issues};
  });
  if (result.overflow || result.issues.length) await page.screenshot({path: `${output}/failure.png`, fullPage: true});
  assert.deepEqual(result, {overflow: false, issues: []}, label);
}

async function checkFixtures(browser) {
  const context = await browser.newContext({viewport: {width: 1440, height: 1000}});
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(base);
  await page.waitForFunction(() => typeof socket !== 'undefined' && socket.connected && cachedGameList);
  assert.equal(await page.evaluate(() => performance.getEntriesByType('resource').some(entry => entry.name.includes('/games/codenames.'))), false);
  await page.evaluate(async () => {
    await ensureGameAssets('codenames');
    const original = socket.emit.bind(socket);
    socket.emit = (event, payload, ...rest) => {
      if (event === 'game:action') { window.codenamesTestActions.push(payload.action); return socket; }
      return original(event, payload, ...rest);
    };
  });
  for (const width of [320, 390, 1024, 1440]) {
    await page.setViewportSize({width, height: width < 600 ? 844 : 1000});
    for (const key of Object.keys(views)) {
      await fixture(page, key);
      await layout(page, `${width}px ${key}`);
      if (['setup', 'clue', 'guess', 'master', 'result', 'english'].includes(key)) await page.screenshot({path: `${output}/${width}-${key}.png`, fullPage: true});
    }
    await page.locator('#codenamesHelpBtn').click();
    for (const language of ['zh', 'en']) {
      await page.locator(`[data-obg-help-lang="${language}"]`).click();
      const tabs = page.locator('dialog[open] [data-obg-help-tab]');
      for (let index = 0; index < await tabs.count(); index += 1) {
        await tabs.nth(index).click();
        const dialogIssues = await page.locator('dialog[open]').evaluate(dialog => {
          const bounds = dialog.getBoundingClientRect();
          return {outside: bounds.left < 0 || bounds.right > innerWidth || bounds.top < 0 || bounds.bottom > innerHeight + 1,
            overflow: dialog.scrollWidth > dialog.clientWidth + 1};
        });
        assert.deepEqual(dialogIssues, {outside: false, overflow: false}, `${width}px ${language} Help tab ${index}`);
      }
      await page.screenshot({path: `${output}/${width}-help-${language}.png`, fullPage: true});
    }
    await page.keyboard.press('Escape');
  }
  await page.setViewportSize({width: 390, height: 844});
  await fixture(page, 'guess');
  assert.equal(await page.locator('.cn-card[data-identity="hidden"]').count(), 25);
  await page.locator('.cn-card').first().click();
  assert.equal(await page.locator('.cn-selected').count(), 1);
  await layout(page, 'selection');
  assert.equal(await page.evaluate(() => codenamesTestActions.length), 0);
  await page.keyboard.press('Escape');
  assert.equal(await page.locator('.cn-selected').count(), 0);
  await page.locator('.cn-card').first().click();
  await page.locator('#codenamesCancelGuess').click();
  assert.equal(await page.locator('.cn-selected').count(), 0);
  await page.locator('.cn-card').first().click();
  await page.locator('#codenamesConfirmGuess').click();
  assert.equal(await page.evaluate(() => codenamesTestActions.length), 1);
  assert.equal(await page.evaluate(() => codenamesTestActions[0].type), 'guess');
  await fixture(page, 'guess');
  await page.locator('#codenamesExplainBtn').click();
  const disabled = page.locator('#codenamesEndTurn');
  await disabled.scrollIntoViewIfNeeded();
  const bounds = await disabled.boundingBox();
  await page.mouse.click(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2);
  await page.locator('dialog[open]').waitFor();
  assert.equal(await page.evaluate(() => codenamesTestActions.length), 0);
  await page.keyboard.press('Escape');
  await page.locator('#codenamesHelpBtn').click();
  await page.locator('dialog[open]').waitFor();
  await page.locator('[data-obg-help-lang="en"]').click();
  await layout(page, 'help English');
  await page.locator('[data-obg-help-lang="zh"]').click();
  await page.keyboard.press('Escape');
  assert.equal(await page.locator('dialog[open]').count(), 0);
  await fixture(page, 'clue');
  assert.equal(await page.locator('.cn-card:not([data-identity="hidden"])').count(), 25);
  await page.locator('#codenamesClueWord').fill('联想');
  await page.locator('#codenamesSendClue').click();
  assert.equal(await page.evaluate(() => codenamesTestActions[0].type), 'clue');
  await fixture(page, 'turn_end');
  await page.locator('#codenamesNext').click();
  assert.equal(await page.evaluate(() => codenamesTestActions[0].type), 'next_round');
  await fixture(page, 'result');
  await page.locator('#codenamesNext').click();
  assert.equal(await page.evaluate(() => codenamesTestActions[0].type), 'confirm_result');
  await fixture(page, 'setup');
  await page.locator('#codenamesLanguage').selectOption('en');
  assert.equal(await page.evaluate(() => codenamesTestActions[0].language), 'en');
  await fixture(page, 'spectator');
  assert.equal(await page.locator('.cn-card[aria-disabled="false"]').count(), 0);
  await fixture(page, 'guess');
  await page.evaluate(() => showCodenamesHeaderActions(false));
  assert.equal(await page.locator('#codenamesBoard').textContent(), '');
  assert.deepEqual(errors, []);
  await context.close();
}

async function checkLive(browser) {
  const contexts = [];
  const pages = [];
  try {
    for (const name of ['Alex', 'Morgan', 'Jamie', 'Riley']) {
      const context = await browser.newContext({viewport: {width: 1024, height: 900}});
      contexts.push(context);
      const page = await context.newPage();
      pages.push(page);
      await page.goto(base);
      await page.waitForFunction(() => typeof socket !== 'undefined' && socket.connected && cachedGameList);
      if (pages.length === 1) await page.evaluate(name => socket.emit('room:create', {name, game_type: 'codenames', auto_save: true}), name);
      else {
        const code = await pages[0].evaluate(() => roomId);
        await page.evaluate(({name, code}) => socket.emit('room:join', {name, room_id: code}), {name, code});
      }
      await page.waitForFunction(() => currentRoomState?.game_type === 'codenames');
      await page.evaluate(() => socket.emit('room:ready', {ready: true}));
    }
    await pages[0].waitForFunction(() => currentRoomState.players.length === 4 && currentRoomState.players.every(member => member.ready));
    await pages[0].evaluate(() => socket.emit('room:auto_save', {auto_save: true}));
    await pages[0].waitForFunction(() => currentRoomState.auto_save);
    await pages[0].evaluate(() => socket.emit('room:start', {}));
    await pages[0].waitForFunction(() => lastGameStatePayload?.view?.phase === 'setup');
    await pages[0].locator('#codenamesBegin').click();
    for (const page of pages) await page.waitForFunction(() => lastGameStatePayload?.view?.phase === 'clue');
    const metadata = await Promise.all(pages.map(page => page.evaluate(() => ({you: playerId, view: lastGameStatePayload.view}))));
    const masterIndex = metadata.findIndex(entry => entry.view.legal_actions.includes('clue'));
    const team = metadata[masterIndex].view.active_team;
    const operativeIndex = metadata.findIndex(entry => entry.view.players.some(member => member.player_id === entry.you && member.team === team && member.role === 'operative'));
    const master = pages[masterIndex];
    const operative = pages[operativeIndex];
    assert.equal((await operative.evaluate(() => lastGameStatePayload.view.board.filter(card => card.identity !== null).length)), 0);
    await master.locator('#codenamesClueWord').fill('联想');
    await master.locator('#codenamesSendClue').click();
    await operative.waitForFunction(() => lastGameStatePayload.view.phase === 'guess');
    const assassin = await master.evaluate(() => lastGameStatePayload.view.board.findIndex(card => card.identity === 'assassin'));
    await operative.locator(`[data-cn-index="${assassin}"]`).click();
    await operative.locator('#codenamesConfirmGuess').click();
    for (const page of pages) await page.waitForFunction(() => lastGameStatePayload.view.phase === 'result');
    const code = await master.evaluate(() => roomId);
    const saveResponse = await master.request.get(`${base}/api/room/save?source_room_id=${code}`);
    assert.equal(saveResponse.status(), 403);
    await operative.reload();
    await operative.waitForFunction(() => lastGameStatePayload?.view?.phase === 'result');
    for (const page of pages) {
      await page.waitForFunction(() => lastGameStatePayload.view.legal_actions.includes('confirm_result'));
      await page.locator('#codenamesNext').click();
    }
    await master.waitForFunction(() => currentRoomState.status === 'game_over');
    assert.equal((await master.request.get(`${base}/api/room/save?source_room_id=${code}`)).status(), 200);
    await pages[0].evaluate(() => socket.emit('room:start', {}));
    await pages[0].waitForFunction(() => lastGameStatePayload.view.phase === 'setup');
    assert.equal(await pages[0].locator('#codenamesBoard').textContent(), '');
  } finally {
    for (const context of contexts) await context.close();
  }
}

async function checkTouch(browser) {
  for (const width of [320, 390]) {
    const context = await browser.newContext({viewport: {width, height: 844}, isMobile: true, hasTouch: true, deviceScaleFactor: 1});
    const page = await context.newPage();
    await page.goto(base);
    await page.waitForFunction(() => typeof socket !== 'undefined' && socket.connected && cachedGameList);
    await page.evaluate(async () => {
      await ensureGameAssets('codenames');
      const original = socket.emit.bind(socket);
      socket.emit = (event, payload, ...rest) => {
        if (event === 'game:action') { window.codenamesTestActions.push(payload.action); return socket; }
        return original(event, payload, ...rest);
      };
    });
    await fixture(page, 'guess');
    await layout(page, `touch ${width}`);
    const client = await context.newCDPSession(page);
    const firstCard = await page.locator('.cn-card').first().boundingBox();
    const point = {x: firstCard.x + firstCard.width / 2, y: firstCard.y + firstCard.height / 2};
    await client.send('Input.dispatchTouchEvent', {type: 'touchStart', touchPoints: [point]});
    await client.send('Input.dispatchTouchEvent', {type: 'touchMove', touchPoints: [{x: point.x, y: point.y - 65}]});
    await client.send('Input.dispatchTouchEvent', {type: 'touchEnd', touchPoints: []});
    assert.equal(await page.locator('.cn-selected').count(), 0);
    assert.equal(await page.evaluate(() => codenamesTestActions.length), 0);
    await page.locator('.cn-card').first().tap();
    assert.equal(await page.locator('.cn-selected').count(), 1);
    await page.locator('#codenamesHeadline').tap();
    assert.equal(await page.locator('.cn-selected').count(), 0);
    await page.locator('#codenamesKeyLabel').tap();
    assert.equal(await page.locator('#codenamesTooltip').isVisible(), true);
    await page.waitForFunction(() => document.getElementById('codenamesTooltip').hidden, {timeout: 4500});
    await fixture(page, 'master');
    await page.locator('.cn-card').first().scrollIntoViewIfNeeded();
    const passiveCard = await page.locator('.cn-card').first().boundingBox();
    await page.touchscreen.tap(passiveCard.x + passiveCard.width / 2, passiveCard.y + passiveCard.height / 2);
    assert.equal(await page.locator('#codenamesTooltip').isVisible(), true);
    assert.equal(await page.evaluate(() => codenamesTestActions.length), 0);
    await page.screenshot({path: `${output}/${width}-touch.png`, fullPage: true});
    await page.keyboard.press('Escape');
    await context.close();
  }
}

(async () => {
  const browser = await chromium.launch({channel: 'chrome', headless: true});
  try {
    await checkFixtures(browser);
    await checkLive(browser);
    await checkTouch(browser);
    console.log('Codenames: 320/390/1024/1440px fixtures, mobile touch/scroll/tooltips, Help/Explain, selection, private views, live 4-player game, reconnect, save protection, and replay passed.');
  } finally {
    await browser.close();
  }
})().catch(error => {console.error(error); process.exitCode = 1;});
