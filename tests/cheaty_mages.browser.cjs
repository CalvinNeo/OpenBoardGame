const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { execFileSync } = require('node:child_process');

const base = process.env.ROOM_TEST_URL || 'http://127.0.0.1:8766';
const output = 'tmp/cheaty-mages-ui';
fs.mkdirSync(output, { recursive: true });
const fixtures = JSON.parse(execFileSync(process.env.PYTHON || 'python3', ['-c', `
import copy, json, random
from game.cheaty_mages import CheatyMagesGame as Game, _finish_round
from tests.test_cheaty_mages import CheatyMagesTest, players
random.seed(115)
helper = CheatyMagesTest()
views = {}
for count in (3, 4, 6):
    state = Game.init_game({}, players(count))
    state['current_turn'] = 'p0'
    views[f'betting{count}'] = Game.get_public_view(state, 'p0')
state = helper.scene(4)
for key in ('fireball', 'strengthen', 'amnesia', 'recall', 'alteration', 'imitation', 'dimension_door'):
    helper.give(state, 'p0', key)
views['casting'] = Game.get_public_view(state, 'p0')
helper.attach(state, 1, 'might', hidden=True)
helper.attach(state, 1, 'haste', hidden=True)
helper.attach(state, 2, 'weaken')
helper.attach(state, 3, 'mana_boost', hidden=True)
helper.effect(state, 'prismatic_ray')
state['players']['p0']['bets'] = [1, 3]
views['spells'] = Game.get_public_view(state, 'p0')
views['spectator'] = Game.get_public_view(state, 'spectator')
state['player_meta']['p1']['name'] = 'VeryLongUnbrokenPlayerNameToCheckOverflow'
state['player_meta']['p2']['name'] = '名字很长的玩家用于验证手机布局不会溢出'
views['longNames'] = Game.get_public_view(state, 'p0')
_finish_round(state)
views['review'] = Game.get_public_view(state, 'p0')
for pid in state['turn_order']:
    helper.act(state, pid, 'next_round')
views['refill'] = Game.get_public_view(state, 'p0')
views['refillWaiting'] = Game.get_public_view(state, 'p1')
for round_number in (2, 3):
    while state['phase'] == 'refill':
        helper.act(state, state['current_turn'], 'discard', cards=[])
    views[f'bettingRound{round_number}'] = Game.get_public_view(state, state['current_turn'])
    while state['phase'] == 'betting':
        helper.act(state, state['current_turn'], 'bet', slots=[2])
    while state['phase'] == 'casting':
        helper.act(state, state['current_turn'], 'pass')
    if round_number == 2:
        for pid in state['turn_order']:
            helper.act(state, pid, 'next_round')
        views['refillRound3'] = Game.get_public_view(state, state['current_turn'])
state = helper.scene(3)
helper.cast(state, 'amnesia', 'p1', player_id='p0')
views['discard'] = Game.get_public_view(state, 'p0')
state = helper.scene(6)
for key in ('fireball', 'strengthen', 'amnesia', 'recall', 'alteration', 'imitation', 'dimension_door'):
    helper.give(state, 'p0', key)
for key in ('might', 'haste', 'weaken', 'mana_boost', 'fireball', 'healing', 'magic_missile', 'regeneration'):
    helper.attach(state, 1, key, hidden=key in ('might', 'haste'))
state['players']['p1']['passed'] = True
state['players']['p2']['passed'] = True
views['crowded'] = Game.get_public_view(state, 'p0')
views['waiting'] = Game.get_public_view(state, 'p1')
state = helper.scene(3)
state['round'] = state['total_rounds']
_finish_round(state)
for pid in state['turn_order']:
    helper.act(state, pid, 'next_round')
views['gameOver'] = Game.get_public_view(state, 'p0')
print(json.dumps(views))
`], { encoding: 'utf8' }));

const errors = [];
const metrics = [];
async function render(page, name) {
  await page.evaluate(view => {
    playerId = view.you;
    renderRoomState({ room_id: roomId, game_type: 'cheaty_mages', status: 'in_game',
      host_id: view.you, players: view.players, game_config: {} });
    setGamePanelVisibility('cheaty_mages');
    renderCheatyMagesGameState({ room_id: roomId, view });
    setRoomControlsCollapsed(true);
    window.scrollTo(0, 0);
  }, fixtures[name]);
  await page.keyboard.press('Escape');
}

async function verifyLiveRounds(browser) {
  const contexts = [];
  const pages = [];
  try {
    for (const width of [320, 390, 1440]) {
      const context = await browser.newContext({ viewport: { width, height: 1000 }, hasTouch: width < 640 });
      contexts.push(context);
      const page = await context.newPage();
      pages.push(page);
      page.on('pageerror', error => errors.push(error.message));
      await page.route('https://fonts.googleapis.com/**', route => route.abort());
      await page.goto(base);
      await page.waitForFunction(() => typeof socket !== 'undefined' && socket.connected && cachedGameList);
    }
    await pages[0].evaluate(() => socket.emit('room:create', { name: 'Mage round QA 0', game_type: 'cheaty_mages' }));
    await pages[0].waitForFunction(() => roomSessionReady && isGameAssetsLoaded('cheaty_mages'));
    const room = await pages[0].evaluate(() => roomId);
    for (let index = 1; index < pages.length; index += 1) {
      await pages[index].evaluate(({ room, index }) => socket.emit('room:join', {
        room_id: room, name: `Mage round QA ${index}`,
      }), { room, index });
      await pages[index].waitForFunction(() => roomSessionReady && isGameAssetsLoaded('cheaty_mages'));
    }
    for (const page of pages) await page.evaluate(() => socket.emit('room:ready', { ready: true }));
    await pages[0].waitForFunction(() => !document.getElementById('startBtn').disabled);
    await pages[0].locator('#startBtn').click();
    for (const page of pages) {
      await page.waitForFunction(() => lastGameStatePayload?.view?.phase === 'betting');
      await page.evaluate(() => setRoomControlsCollapsed(true));
    }
    const pageByPlayer = new Map();
    for (const page of pages) pageByPlayer.set(await page.evaluate(() => lastGameStatePayload.view.you), page);
    let previousJudge = null;
    for (const roundNumber of [1, 2, 3]) {
      for (const page of pages) {
        await page.waitForFunction(round => lastGameStatePayload?.view?.round === round &&
          lastGameStatePayload.view.phase === 'betting', roundNumber);
        const view = await page.evaluate(() => lastGameStatePayload.view);
        assert.notEqual(view.judge.id, previousJudge);
        assert.deepEqual(view.your_bets, []);
        assert.equal(view.players.every(player => !player.bet_ready && !player.passed), true);
      }
      for (const phase of ['betting', 'casting']) {
        for (let index = 0; index < pages.length; index += 1) {
          const view = await pages[0].evaluate(() => lastGameStatePayload.view);
          assert.equal(view.phase, phase);
          const actor = pageByPlayer.get(view.current_turn);
          await actor.waitForFunction(turn => lastGameStatePayload?.view?.turn === turn, view.turn);
          if (phase === 'betting') {
            await actor.locator(`[data-cm-fighter="${roundNumber}"]`).click();
            await actor.locator('[data-cm-action="bet"]').click();
          } else {
            await actor.locator('[data-cm-action="pass"]').click();
          }
          for (const page of pages) await page.waitForFunction(turn => lastGameStatePayload?.view?.turn > turn, view.turn);
        }
      }
      for (const page of pages) await page.waitForFunction(() => lastGameStatePayload?.view?.phase === 'round_end');
      previousJudge = await pages[0].evaluate(() => lastGameStatePayload.view.judge.id);
      for (let index = 0; index < pages.length; index += 1) {
        await pages[index].locator('[data-cm-action="next_round"]').click();
        if (index < pages.length - 1) {
          await pages[index].waitForFunction(() => lastGameStatePayload.view.next_ready.includes(lastGameStatePayload.view.you));
          assert.equal(await pages[index].evaluate(() => lastGameStatePayload.view.phase), 'round_end');
        }
      }
      if (roundNumber === 3) {
        for (const page of pages) await page.waitForFunction(() => lastGameStatePayload?.view?.game_over);
        continue;
      }
      for (const page of pages) {
        await page.waitForFunction(() => lastGameStatePayload?.view?.phase === 'refill');
        const view = await page.evaluate(() => lastGameStatePayload.view);
        assert.equal(view.round, roundNumber + 1);
        assert.notEqual(view.judge.id, previousJudge);
        assert.equal(view.players.every(player => !player.bet_ready && !player.passed), true);
      }
      if (roundNumber === 1) {
        const actorId = await pages[0].evaluate(() => lastGameStatePayload.view.current_turn);
        const actor = pageByPlayer.get(actorId);
        await actor.reload();
        await actor.waitForFunction(() => roomSessionReady && isGameAssetsLoaded('cheaty_mages') &&
          lastGameStatePayload?.view?.phase === 'refill');
        assert.equal(await actor.evaluate(() => lastGameStatePayload.view.round), 2);
        await actor.evaluate(() => setRoomControlsCollapsed(true));
      }
      for (let index = 0; index < pages.length; index += 1) {
        const view = await pages[0].evaluate(() => lastGameStatePayload.view);
        const actor = pageByPlayer.get(view.current_turn);
        await actor.waitForFunction(turn => lastGameStatePayload?.view?.turn === turn, view.turn);
        await actor.locator('[data-cm-action="discard"]').click();
        for (const page of pages) await page.waitForFunction(turn => lastGameStatePayload?.view?.turn > turn, view.turn);
      }
    }
  } finally {
    for (const page of pages) await page.evaluate(() => socket.emit('room:leave', {})).catch(() => {});
    for (const context of contexts) await context.close();
  }
}

async function bounds(page, label) {
  const result = await page.evaluate(() => {
    const panel = document.querySelector('#cheatyMagesPanel');
    const header = document.querySelector('.game-panel > .panel-header');
    const game = document.querySelector('.game-panel').getBoundingClientRect();
    const outside = [...panel.querySelectorAll('button, [data-cm-tip], strong')].filter(element => {
      const rect = element.getBoundingClientRect();
      return rect.width && rect.height && (rect.left < game.left - 1 || rect.right > game.right + 1);
    }).map(element => element.className || element.tagName);
    const controls = ['#gameReconnectBtn', '#cheatyMagesHelpBtn', '#cheatyMagesExplainBtn']
      .map(selector => document.querySelector(selector).getBoundingClientRect());
    return {
      overflow: document.documentElement.scrollWidth > innerWidth,
      outside,
      headerHeight: header.getBoundingClientRect().height,
      controls: controls.map(rect => ({x: rect.x, y: rect.y, width: rect.width, height: rect.height})),
      controlsAligned: Math.abs(controls[0].top - controls[1].top) < 8,
      explainDocked: !!document.querySelector('#mobileExplainSlot #cheatyMagesExplainBtn'),
      arenaHeight: Math.round(panel.querySelector('.cm-arena').getBoundingClientRect().height),
      surfaceHeight: Math.round(panel.getBoundingClientRect().height),
      handTop: Math.round(panel.querySelector('.cm-hand')?.getBoundingClientRect().top || 0)
    };
  });
  assert.equal(result.overflow, false, `${label}: page overflow`);
  assert.deepEqual(result.outside, [], `${label}: game element overflow`);
  assert.equal(result.controlsAligned, true, `${label}: header controls wrap ${JSON.stringify(result)}`);
  metrics.push({ label, ...result });
  return result;
}

(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true });
  const page = await context.newPage();
  page.on('pageerror', error => errors.push(error.message));
  await page.route('https://fonts.googleapis.com/**', route => route.abort());
  try {
    await page.goto(base);
    await page.waitForFunction(() => typeof socket !== 'undefined' && socket.connected && cachedGameList);
    await page.evaluate(() => socket.emit('room:create', { name: 'Cheaty Mages UI QA', game_type: 'cheaty_mages' }));
    await page.waitForFunction(() => roomSessionReady && isGameAssetsLoaded('cheaty_mages'));
    await page.evaluate(() => {
      window.cheatyMagesTestActions = [];
      window.sendAction = action => cheatyMagesTestActions.push(action);
    });
    for (const width of [320, 390, 1024, 1440]) {
      await page.setViewportSize({ width, height: width < 640 ? 844 : 1000 });
      for (const name of Object.keys(fixtures)) {
        await render(page, name);
        const result = await bounds(page, `${width}-${name}`);
        if (width < 640 && name === 'casting') {
          assert(result.arenaHeight <= 270, 'Empty mobile arena should fit in 270px');
          assert(result.handTop < 660, 'Mobile hand should be near the arena');
        }
        if (['betting6', 'casting', 'spells', 'review', 'refill', 'refillWaiting', 'bettingRound2', 'bettingRound3'].includes(name)) {
          await page.screenshot({ path: `${output}/${width}-${name}.png`, fullPage: true });
        }
      }
    }
    for (const width of [320, 390]) {
      await page.setViewportSize({ width, height: 844 });
      for (const name of ['crowded', 'spells']) {
        await render(page, name);
        await page.locator('.cm-card:not(:disabled)').first().tap();
        await page.locator('[data-cm-fighter="2"]').tap();
        if (await page.locator('[data-cm-choice="face_down"]').count()) {
          await page.locator('[data-cm-choice="face_down"]').first().tap();
        }
        await bounds(page, `${width}-${name}-selection`);
        assert.equal(await page.locator('[data-cm-action="commit"]').isEnabled(), true);
        await page.locator('.cm-hand-selection').scrollIntoViewIfNeeded();
        const before = await page.evaluate(() => scrollY);
        await page.locator('[data-cm-choice="target"]').last().tap();
        const after = await page.evaluate(() => scrollY);
        assert(Math.abs(after - before) < 8, 'Changing targets must not jump the page');
        await page.screenshot({ path: `${output}/${width}-${name}-selection.png`, fullPage: true });
      }
    }
    await page.setViewportSize({ width: 390, height: 844 });
    await render(page, 'betting3');
    await page.locator('[data-cm-fighter="1"]').tap();
    await page.locator('[data-cm-fighter="3"]').tap();
    assert.equal(await page.locator('.cm-fighter-select[aria-pressed="true"]').count(), 2);
    await page.locator('[data-cm-action="bet"]').tap();
    assert.deepEqual(await page.evaluate(() => cheatyMagesTestActions.at(-1).slots), [1, 3]);

    await render(page, 'casting');
    await page.locator('.cm-card').first().tap();
    await page.locator('[data-cm-fighter="2"]').tap();
    await page.locator('[data-cm-action="commit"]').tap();
    assert.equal(await page.evaluate(() => cheatyMagesTestActions.at(-1).type), 'cast');
    assert.equal(await page.evaluate(() => cheatyMagesTestActions.at(-1).target), 2);

    await render(page, 'spells');
    await page.locator('[data-cm-mode="peek"]').tap();
    await page.locator('.cm-card:not(:disabled)').first().tap();
    await page.locator('[data-cm-choice="target"]').first().tap();
    await page.locator('[data-cm-action="commit"]').tap();
    assert.equal(await page.evaluate(() => cheatyMagesTestActions.at(-1).type), 'peek');

    await render(page, 'spells');
    const imitation = fixtures.spells.your_hand.find(card => card.key === 'imitation');
    await page.locator(`[data-cm-card="${imitation.id}"]`).tap();
    await page.locator('[data-cm-choice="from_slot"]').first().tap();
    await page.locator('[data-cm-choice="to_slot"]').first().tap();
    await page.locator('[data-cm-action="commit"]').tap();
    assert.equal(await page.evaluate(() => cheatyMagesTestActions.at(-1).from_slot), 1);

    await render(page, 'casting');
    await page.locator('[data-cm-action="pass"]').tap();
    assert.equal(await page.evaluate(() => cheatyMagesTestActions.at(-1).type), 'pass');
    await render(page, 'discard');
    await page.locator('.cm-card:not(:disabled)').first().tap();
    await page.locator('[data-cm-action="discard"]').tap();
    assert.equal(await page.evaluate(() => cheatyMagesTestActions.at(-1).cards.length), 1);
    await render(page, 'refill');
    assert.match(await page.locator('.cm-status').innerText(), /Your turn · Refresh hand, then bet again/);
    assert.notEqual(fixtures.refill.judge.id, fixtures.review.judge.id);
    assert.equal(fixtures.refill.round, 2);
    assert.equal(await page.locator('.cm-fighter.is-bet').count(), 0);
    assert.equal(await page.locator('.cm-player').filter({ hasText: 'Pass' }).count(), 0);
    assert.equal(await page.locator('.cm-hand-area').evaluate(area =>
      area.querySelector('.cm-bet-bar').compareDocumentPosition(area.querySelector('.cm-hand')) & Node.DOCUMENT_POSITION_FOLLOWING), 4);
    await page.locator('[data-cm-action="discard"]').tap();
    assert.deepEqual(await page.evaluate(() => cheatyMagesTestActions.at(-1).cards), []);
    await render(page, 'refillWaiting');
    assert.match(await page.locator('.cm-status').innerText(), /Waiting for .+ to refresh hand/);
    assert.equal(await page.locator('[data-cm-action="discard"]').count(), 0);
    for (const roundNumber of [2, 3]) {
      await render(page, `bettingRound${roundNumber}`);
      assert.match(await page.locator('.cm-status').innerText(), /Your turn · Place your secret bet/);
      assert.equal(await page.locator('.cm-fighter.is-bet').count(), 0);
      assert.equal(await page.locator('[data-cm-action="bet"]').isDisabled(), true);
      await page.locator('[data-cm-fighter="2"]').tap();
      await page.locator('[data-cm-action="bet"]').tap();
      assert.deepEqual(await page.evaluate(() => cheatyMagesTestActions.at(-1)),
        fixtures[`bettingRound${roundNumber}`].legal_moves.find(move => move.type === 'bet' && move.slots.length === 1 && move.slots[0] === 2));
    }
    await render(page, 'review');
    await page.locator('[data-cm-action="next_round"]').tap();
    assert.equal(await page.evaluate(() => cheatyMagesTestActions.at(-1).type), 'next_round');

    await render(page, 'betting3');
    const count = await page.evaluate(() => cheatyMagesTestActions.length);
    await page.locator('#cheatyMagesExplainBtn').tap();
    await page.locator('.cm-card:disabled').first().dispatchEvent('pointerdown', { pointerType: 'touch' });
    await page.waitForSelector('#cheatyMagesDialog[open]');
    assert.equal(await page.evaluate(() => cheatyMagesTestActions.length), count);
    await page.keyboard.press('Escape');
    await page.locator('#cheatyMagesHelpBtn').tap();
    for (const language of ['en', 'zh']) {
      await page.locator(`[data-cm-help-lang="${language}"]`).click();
      for (let section = 0; section < 5; section += 1) {
        await page.locator(`[data-cm-help-tab="${section}"]`).click();
        assert((await page.locator('#cheatyMagesHelpContent').innerText()).length > 100);
      }
    }
    await page.screenshot({ path: `${output}/390-help.png`, fullPage: true });
    await page.keyboard.press('Escape');
    assert.equal(await page.locator('#cheatyMagesDialog').evaluate(dialog => dialog.open), false);
    await page.locator('.cm-fighter-stats [data-cm-tip]').first().tap();
    assert.equal(await page.locator('#cheatyMagesTooltip').isVisible(), true);
    await page.locator('.cm-fighter-stats [data-cm-tip]').nth(1).tap();
    assert.match(await page.locator('#cheatyMagesTooltip').innerText(), /赏金/);
    await page.waitForTimeout(3200);
    assert.equal(await page.locator('#cheatyMagesTooltip').isVisible(), false);

    await render(page, 'casting');
    await page.locator('.cm-card').first().dispatchEvent('pointerdown', { pointerType: 'touch', clientX: 70, clientY: 700 });
    await page.locator('.cm-card').first().dispatchEvent('pointermove', { pointerType: 'touch', clientX: 70, clientY: 650 });
    await page.locator('.cm-card').first().dispatchEvent('pointerup', { pointerType: 'touch', clientX: 70, clientY: 650 });
    await page.locator('.cm-card').first().dispatchEvent('click', { detail: 1 });
    assert.equal(await page.locator('.cm-card.is-selected').count(), 0, 'A swipe must not select a card');
    await page.locator('.cm-card').first().tap();
    assert.equal(await page.locator('.cm-card.is-selected').count(), 1);
    await page.keyboard.press('Escape');
    assert.equal(await page.locator('.cm-card.is-selected').count(), 0);
    await page.locator('.cm-card').first().tap();
    await page.locator('.cm-hand-area').click({ position: {x: 2, y: 2} });
    assert.equal(await page.locator('.cm-card.is-selected').count(), 0, 'Blank space cancels selection');
    await page.locator('.cm-history summary').tap();
    assert.equal(await page.locator('.cm-history').evaluate(details => details.open), true);
    await page.setViewportSize({width: 1440, height: 1000});
    await render(page, 'casting');
    await page.locator('.cm-fighter-stats [data-cm-tip]').first().hover();
    assert.equal(await page.locator('#cheatyMagesTooltip').isVisible(), true);
    await verifyLiveRounds(browser);
    assert.deepEqual(errors, []);
    fs.writeFileSync(`${output}/metrics.json`, JSON.stringify(metrics, null, 2));
    console.log(JSON.stringify({ scenes: metrics.length, liveRounds: 3, reconnectedDuringRefill: true,
      errors, screenshots: output, metrics }, null, 2));
  } catch (error) {
    await page.screenshot({ path: `${output}/failure.png`, fullPage: true });
    throw error;
  } finally {
    await page.evaluate(() => socket.emit('room:leave', {})).catch(() => {});
    await browser.close();
  }
})().catch(error => { console.error(error); process.exit(1); });
