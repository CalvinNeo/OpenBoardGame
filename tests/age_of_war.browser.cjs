const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { execFileSync } = require('node:child_process');

const base = process.env.ROOM_TEST_URL || 'http://127.0.0.1:8779';
const output = 'tmp/age-of-war-ui';
fs.mkdirSync(output, { recursive: true });
const fixtures = JSON.parse(execFileSync(process.env.PYTHON || 'python3', ['-c', `
import copy, json
from game.age_of_war import AgeOfWarGame as G, CASTLE_ORDER, _castle_lines
players = [{'player_id': f'p{index}', 'name': 'You' if index == 0 else f'Bot {index}', 'is_bot': index > 0, 'seat': index} for index in range(6)]
state = G.init_game({}, players)
views = {'start': G.get_public_view(state, 'p0')}
state['dice_pool'] = ['I1', 'I2', 'I3', 'A', 'A', 'C', 'D']
views['select'] = G.get_public_view(state, 'p0')
small_supply = copy.deepcopy(state)
small_supply['central_castles'] = list(CASTLE_ORDER[-3:])
views['small_supply'] = G.get_public_view(small_supply, 'p0')
state.update(phase='assign', target={'type':'central', 'castle_id':'kiyosu'}, target_lines=_castle_lines('kiyosu', False))
views['assign'] = G.get_public_view(state, 'p0')
views['spectator'] = G.get_public_view(state, 'visitor')
state['players']['p1']['castles'] = list(CASTLE_ORDER[:9])
state['players']['p1']['locked_clans'] = ['tokugawa', 'oda', 'mori']
state['central_castles'] = list(CASTLE_ORDER[9:])
state.update(phase='select_target', target=None, target_lines=[])
views['owned'] = G.get_public_view(state, 'p0')
state.update(phase='assign', target={'type':'player', 'castle_id':'matsuyama', 'defender_id':'p1'}, target_lines=_castle_lines('matsuyama', True))
views['bonus'] = G.get_public_view(state, 'p0')
state.update(phase='game_over', game_over=True, winner=['p1'])
views['over'] = G.get_public_view(state, 'p0')
print(json.dumps(views))
`], { encoding: 'utf8' }));

async function render(page, key) {
  await page.evaluate(view => {
    playerId = view.you;
    roomSessionReady = true;
    currentGameType = 'age_of_war';
    renderRoomState({ room_id: 'age-ui', game_type: 'age_of_war', status: 'in_game', host_id: 'p0', players: view.players, game_config: {} });
    setGamePanelVisibility('age_of_war');
    renderGameState({ game_type: 'age_of_war', view });
    setRoomControlsCollapsed(true);
    window.scrollTo(0, 0);
  }, fixtures[key]);
  await page.locator('#ageOfWarPanel').waitFor({ state: 'visible' });
}

async function bounds(page, label) {
  const result = await page.evaluate(() => {
    const bad = [...document.querySelectorAll('#ageOfWarPanel *, #ageOfWarHelpModal:not(.hidden) *, #ageOfWarExplainModal:not(.hidden) *')].filter(element => {
      const rect = element.getBoundingClientRect();
      if (!rect.width || !rect.height) return false;
      const style = getComputedStyle(element);
      return rect.left < -1 || rect.right > innerWidth + 1 ||
        (element.clientWidth && element.scrollWidth > element.clientWidth + 1 && !['auto', 'scroll', 'hidden'].includes(style.overflowX));
    }).map(element => `${element.id || element.className}: ${element.textContent.slice(0, 60)}`);
    return { overflow: document.documentElement.scrollWidth > innerWidth, bad };
  });
  assert.deepEqual(result, { overflow: false, bad: [] }, label);
}

(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const errors = [];
  try {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 }, hasTouch: true });
    page.on('pageerror', error => errors.push(error.message));
    await page.route('https://fonts.googleapis.com/**', route => route.abort());
    await page.goto(base);
    await page.waitForFunction(() => typeof socket !== 'undefined' && socket.connected && cachedGameList);
    assert.equal(await page.locator('script[src*="games/age_of_war.js"]').count(), 0);
    await page.evaluate(() => ensureGameAssets('age_of_war'));
    await page.waitForFunction(() => isGameAssetsLoaded('age_of_war'));
    await page.evaluate(() => { window.ageOfWarTestActions = []; sendAction = action => window.ageOfWarTestActions.push(action); });
    for (const [width, height] of [[320, 668], [390, 844], [1024, 900], [1440, 1000]]) {
      await page.setViewportSize({ width, height });
      for (const key of ['start', 'select', 'small_supply', 'assign', 'bonus', 'owned', 'spectator', 'over']) {
        await render(page, key);
        await bounds(page, `${width}: ${key}`);
        assert.equal(await page.locator('#ageOfWarCentral .age-of-war-castle-card:not([hidden])').count(), fixtures[key].central_castles.length);
      }
      await render(page, 'assign');
      await page.locator('.age-of-war-line.fillable').first().click();
      await page.locator('#ageOfWarPlaceDiceBtn').waitFor({ state: 'visible' });
      await bounds(page, `${width}: selection`);
      const battle = await page.locator('.age-of-war-battle').boundingBox();
      await page.screenshot({ path: `${output}/assign-${width}.png`, fullPage: true });
      assert(battle.y + battle.height <= height, `${width}: dice and confirmation fit in viewport ${JSON.stringify(battle)}`);
      await page.keyboard.press('Escape');
      await render(page, 'select');
      const cards = page.locator('#ageOfWarCentral .age-of-war-castle-card:visible');
      assert.equal(await cards.count(), 14);
      assert.equal(await page.locator('.age-of-war-pager').count(), 0);
      const supply = page.locator('.age-of-war-supply-scroll');
      assert(await supply.evaluate(element => element.scrollHeight <= element.clientHeight + 1), `${width}: castles have no nested vertical scrolling`);
      if (width <= 640) {
        const columns = await page.locator('#ageOfWarCentral').evaluate(element => getComputedStyle(element).gridTemplateColumns.split(' ').length);
        assert.equal(columns, width < 380 ? 2 : 3);
        if (width === 390) {
          const last = await cards.last().boundingBox();
          assert(last.y + last.height <= height, `390: all 14 castles use the phone viewport ${JSON.stringify(last)}`);
        }
        await cards.last().scrollIntoViewIfNeeded();
        const dice = await page.locator('#ageOfWarDice').boundingBox();
        const last = await cards.last().boundingBox();
        assert(dice.y >= 0 && dice.y + dice.height < last.y, `${width}: docked dice stay visible above the last castle`);
        await cards.last().click();
        await bounds(page, `${width}: last castle confirmation`);
        assert.equal(await page.locator('.age-of-war-confirm').count(), 1);
        await page.screenshot({ path: `${output}/scrolled-confirmation-${width}.png` });
        await page.keyboard.press('Escape');
        await page.evaluate(() => window.scrollTo(0, 0));
      }
      await page.screenshot({ path: `${output}/select-${width}.png`, fullPage: true });
      const firstCard = page.locator('#ageOfWarCentral .age-of-war-castle-card:visible').first();
      const before = await page.evaluate(() => ageOfWarTestActions.length);
      await firstCard.click();
      assert.equal(await page.evaluate(() => ageOfWarTestActions.length), before);
      await firstCard.getByRole('button', { name: 'Cancel', exact: true }).click();
      await firstCard.click();
      await firstCard.getByRole('button', { name: 'Attack', exact: true }).click();
      assert.equal(await page.evaluate(() => ageOfWarTestActions.at(-1).type), 'select_target');
      await bounds(page, `${width}: confirmation`);
      await page.screenshot({ path: `${output}/confirmation-${width}.png`, fullPage: true });
      await page.keyboard.press('Escape');
      await render(page, 'small_supply');
      assert.equal(await page.locator('#ageOfWarCentral .age-of-war-castle-card:visible').count(), 3);
      await page.screenshot({ path: `${output}/small-supply-${width}.png`, fullPage: true });
      await render(page, 'owned');
      await page.locator('#ageOfWarPlayersTab').click();
      await bounds(page, `${width}: player castles`);
      assert.equal(await page.locator('#ageOfWarPlayers .age-of-war-castle-card:visible').count(), 9);
      assert.equal(await page.locator('#ageOfWarCentral').isVisible(), false);
      await page.screenshot({ path: `${output}/players-${width}.png`, fullPage: true });
      await page.locator('#ageOfWarCentralTab').click();
      await render(page, 'assign');
      if (width <= 640) {
        assert.equal(await page.locator('.age-of-war-supply').isVisible(), false);
        await page.locator('#ageOfWarBrowseBtn').click();
        assert.equal(await page.locator('#ageOfWarCentral .age-of-war-castle-card:visible').count(), 14);
        assert.equal(await page.locator('#ageOfWarDice .age-of-war-die').count(), 7);
        await page.locator('#ageOfWarBrowseBtn').click();
        assert.equal(await page.locator('.age-of-war-supply').isVisible(), false);
      }
    }
    await page.setViewportSize({ width: 390, height: 844 });
    await render(page, 'assign');
    await page.locator('[data-line-index="0"]').click();
    await page.locator('#ageOfWarPlaceDiceBtn').click();
    assert.equal(await page.evaluate(() => ageOfWarTestActions.at(-1).type), 'fill_line');
    await page.locator('[data-die-index="0"]').click();
    await page.locator('#ageOfWarDiscardBtn').click();
    assert.deepEqual(await page.evaluate(() => ageOfWarTestActions.at(-1)), { type: 'discard_die', die_index: 0 });
    const beforeExplain = await page.evaluate(() => ageOfWarTestActions.length);
    await page.locator('#ageOfWarExplainBtn').click();
    await page.locator('#ageOfWarDiscardBtn').click({ force: true });
    await page.locator('#ageOfWarExplainModal').waitFor({ state: 'visible' });
    assert.equal(await page.evaluate(() => ageOfWarTestActions.length), beforeExplain);
    await page.keyboard.press('Escape');
    await page.locator('#ageOfWarExplainBtn').click();
    await page.locator('[data-line-index="0"]').click();
    await page.locator('#ageOfWarExplainModal').waitFor({ state: 'visible' });
    assert.match(await page.locator('#ageOfWarExplainContent').innerText(), /Daimyo/);
    await page.keyboard.press('Escape');
    await page.locator('.age-of-war-score').first().tap();
    await page.locator('#ageOfWarSymbolHint').waitFor({ state: 'visible' });
    await page.locator('.age-of-war-score').nth(1).tap();
    assert.match(await page.locator('#ageOfWarSymbolHint').innerText(), /castles/);
    await page.locator('#ageOfWarSymbolHint').waitFor({ state: 'hidden', timeout: 5000 });
    await page.locator('[data-die-index="0"]').tap();
    assert.equal(await page.locator('#ageOfWarSymbolHint').isVisible(), false);
    await page.keyboard.press('Escape');
    await page.locator('#ageOfWarBrowseBtn').click();
    await page.locator('#ageOfWarPlayersTab').click();
    await page.locator('#ageOfWarHelpBtn').click();
    await page.locator('#ageOfWarHelpChineseBtn').click();
    assert.match(await page.locator('#ageOfWarHelpContent').innerText(), /如何获胜/);
    await page.locator('#ageOfWarHelpDetailsBtn').click();
    assert.match(await page.locator('#ageOfWarHelpContent').innerText(), /步兵/);
    await bounds(page, 'Chinese Help');
    await page.screenshot({ path: `${output}/help-390.png`, fullPage: true });
    await page.keyboard.press('Escape');
    assert.equal(await page.locator('#ageOfWarHelpModal').isVisible(), false);
    await render(page, 'select');
    await page.locator('#ageOfWarCentralTab').click();
    const card = page.locator('#ageOfWarCentral .age-of-war-castle-card:visible').first();
    await card.dispatchEvent('pointerdown', { pointerType: 'touch', clientX: 100, clientY: 500 });
    await card.dispatchEvent('pointermove', { pointerType: 'touch', clientX: 100, clientY: 420 });
    await card.dispatchEvent('pointerup', { pointerType: 'touch', clientX: 100, clientY: 420 });
    await card.dispatchEvent('click');
    assert.equal(await page.locator('.age-of-war-confirm').count(), 0);
    const lastCard = page.locator('#ageOfWarCentral .age-of-war-castle-card:visible').last();
    await lastCard.scrollIntoViewIfNeeded();
    const scrollBefore = await page.evaluate(() => window.scrollY);
    await lastCard.click();
    assert.equal(await page.evaluate(() => window.scrollY), scrollBefore);
    await page.keyboard.press('Escape');

    const live = await browser.newPage({ viewport: { width: 390, height: 844 } });
    live.on('pageerror', error => errors.push(error.message));
    await live.route('https://fonts.googleapis.com/**', route => route.abort());
    await live.goto(base);
    await live.waitForFunction(() => typeof socket !== 'undefined' && socket.connected && cachedGameList);
    await live.evaluate(() => socket.emit('room:create', { name: 'Age of War QA', game_type: 'age_of_war' }));
    await live.waitForFunction(() => roomSessionReady && isGameAssetsLoaded('age_of_war'));
    await live.evaluate(() => socket.emit('room:add_bot', { room_id: roomId }));
    await live.waitForFunction(() => currentRoomState.players.length === 2);
    await live.evaluate(() => socket.emit('room:ready', { room_id: roomId, ready: true }));
    await live.waitForFunction(() => !document.getElementById('startBtn').disabled);
    await live.locator('#startBtn').click();
    await live.waitForFunction(() => lastGameStatePayload?.view?.game_id === 'age_of_war');
    await live.evaluate(() => {
      window.ageOfWarBotActions = [];
      socket.on('game:state', data => {
        for (const event of data.events || []) {
          if (event.type === 'bot:action') window.ageOfWarBotActions.push(event.payload.action.type);
        }
      });
    });
    await live.locator('#ageOfWarRollBtn').click();
    await live.waitForFunction(() => lastGameStatePayload.view.dice_pool.length === 7);
    await live.locator('#ageOfWarCentral .age-of-war-castle-card:visible').first().click();
    await live.getByRole('button', { name: 'Attack', exact: true }).click();
    await live.waitForFunction(() => lastGameStatePayload.view.phase === 'assign');
    const room = await live.evaluate(() => roomId);
    await live.reload();
    await live.waitForFunction(() => isGameAssetsLoaded('age_of_war') && lastGameStatePayload?.view?.phase === 'assign');
    assert.equal(await live.evaluate(() => roomId), room);
    assert.equal(await live.locator('.age-of-war-die').count(), 7);
    await live.evaluate(() => {
      window.ageOfWarBotActions = [];
      socket.on('game:state', data => {
        for (const event of data.events || []) {
          if (event.type === 'bot:action') window.ageOfWarBotActions.push(event.payload.action.type);
        }
      });
    });
    for (let remaining = 7; remaining > 0; remaining--) {
      await live.locator('[data-die-index="0"]').click();
      await live.locator('#ageOfWarDiscardBtn').click();
      if (remaining === 1) break;
      await live.waitForFunction(count => lastGameStatePayload.view.phase === 'roll' && lastGameStatePayload.view.dice_remaining === count, remaining - 1);
      await live.locator('#ageOfWarRollBtn').click();
      await live.waitForFunction(count => lastGameStatePayload.view.phase === 'assign' && lastGameStatePayload.view.dice_pool.length === count, remaining - 1);
    }
    await live.waitForFunction(() => lastGameStatePayload.view.current_player === playerId && lastGameStatePayload.view.phase === 'select_target' && window.ageOfWarBotActions.length > 0);
    const botActions = await live.evaluate(() => window.ageOfWarBotActions);
    assert(botActions.includes('roll'));
    assert(botActions.includes('select_target'));
    assert(botActions.some(action => ['fill_line', 'discard_die'].includes(action)));
    await bounds(live, 'Live bot turn');
    await live.evaluate(() => {
      socket.emit('room:leave', { room_id: roomId });
      resetRoomState();
    });
    await live.waitForFunction(() => !currentRoomState);
    assert.deepEqual(errors, []);
    console.log('Age of War UI passed: 320 / 390 / 1024 / 1440, all 14 castles without pagination or nested scrolling, docked dice, six players, target confirmation, dice placement/discard, Help, Explain, Escape, swipe guard, live bot turn and reconnect.');
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
