const {chromium} = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const {execFileSync} = require('node:child_process');
const base = process.env.ROOM_TEST_URL || 'http://127.0.0.1:8773';

(async () => {
  const browser = await chromium.launch({channel: 'chrome', headless: true});
  const contexts = [];
  const pages = [];
  const errors = [];
  const snapshots = 'tmp/werewolf-ui';
  fs.mkdirSync(snapshots, {recursive: true});
  async function waitPhase(page, phase) {
    await page.waitForFunction(expected => lastGameStatePayload?.view?.phase === expected, phase);
  }
  async function clickAction(page, kind) {
    const revision = await page.evaluate(() => lastGameStatePayload.view.revision);
    await page.locator(`[data-ww-action="${kind}"]`).click();
    await page.waitForFunction(previous => lastGameStatePayload.view.revision > previous, revision);
  }
  async function overflow(page) {
    return page.evaluate(() => {
      const surface = document.getElementById('werewolfSurface');
      const offenders = [...surface.querySelectorAll('*')].filter(element => {
        const rect = element.getBoundingClientRect();
        const style = getComputedStyle(element);
        return rect.width > 0 && (rect.right > innerWidth + 1 || rect.left < -1
          || (element.clientWidth && element.scrollWidth > element.clientWidth + 1 && !['auto', 'scroll', 'hidden'].includes(style.overflowX)));
      }).map(element => element.className || element.tagName);
      return {page: document.documentElement.scrollWidth > innerWidth, offenders};
    });
  }
  try {
    for (let index = 0; index < 6; index++) {
      const context = await browser.newContext({viewport: {width: 390, height: 844}, hasTouch: true});
      contexts.push(context);
      const page = await context.newPage();
      pages.push(page);
      page.on('pageerror', error => errors.push(error.message));
      await page.goto(base);
      await page.waitForFunction(() => typeof socket !== 'undefined' && socket.connected);
      if (!index) {
        await page.locator('#createBtn').click();
        if (await page.locator('#playerNameModal').isVisible()) {
          await page.locator('#nameInput').fill('席位 1');
          await page.locator('#playerNameForm button[type=submit]').click();
        }
        await page.locator('#gameSearchInput').fill('werewolf');
        await page.locator('[data-game-id="werewolf"]').click();
        await page.waitForFunction(() => roomSessionReady && currentGameType === 'werewolf' && !pendingRoomRequest);
      } else {
        const room = await pages[0].evaluate(() => roomId);
        await page.evaluate(({room, index}) => socket.emit('room:join', {room_id: room, name: '席位 ' + (index + 1)}), {room, index});
        await page.waitForFunction(() => roomSessionReady && currentGameType === 'werewolf');
      }
    }
    const host = pages[0];
    for (const page of pages) {
      await page.evaluate(() => socket.emit('room:ready', {room_id: roomId, ready: true}));
    }
    await host.waitForFunction(() => currentRoomState.players.length === 6 && currentRoomState.players.every(player => player.ready));
    await host.locator('#startBtn').click();
    await waitPhase(host, 'setup');
    assert.equal(await host.locator('[data-ww-option="allow_wolf_self_attack"]').inputValue(), 'false');
    for (const width of [320, 390, 1024, 1440]) {
      await host.setViewportSize({width, height: 900});
      await host.evaluate(() => setRoomControlsCollapsed(true));
      assert.deepEqual(await overflow(host), {page: false, offenders: []}, 'setup ' + width);
      await host.locator('.game-panel').screenshot({path: `${snapshots}/setup-${width}.png`});
    }
    await clickAction(host, 'deal');
    for (const page of pages) {
      await waitPhase(page, 'identity');
      assert.equal(await page.locator('.ww-role').count(), 0);
      await page.locator('[data-ww-action="reveal"]').click();
      assert.equal(await page.locator('.ww-role').count(), 1);
      await page.locator('[data-ww-action="reveal"]').click();
      await clickAction(page, 'ready');
    }
    await waitPhase(host, 'night');
    let views = await Promise.all(pages.map(page => page.evaluate(() => lastGameStatePayload.view)));
    const wolves = views.map((view, index) => view.own.role === 'werewolf' ? index : -1).filter(index => index >= 0);
    const victimIndex = views.findIndex(view => view.own.role === 'villager');
    const victim = views[victimIndex].you;
    for (const wolfIndex of wolves) {
      const page = pages[wolfIndex];
      await page.waitForFunction(() => lastGameStatePayload.view.legal_actions.includes('wolf_vote'));
      for (const teammate of views[wolfIndex].wolf_team) {
        assert.equal(await page.locator(`[data-ww-player="${teammate.player_id}"]`).isDisabled(), true);
      }
      await page.locator(`[data-ww-player="${victim}"]`).click();
      assert.equal(await page.locator('.ww-selected').count(), 1);
      await clickAction(page, 'confirm');
      assert.equal(await page.locator('[data-ww-action="confirm"]').count(), 0);
    }
    const witchIndex = views.findIndex(view => view.own.role === 'witch');
    const witch = pages[witchIndex];
    await witch.waitForFunction(() => lastGameStatePayload.view.legal_actions.includes('witch'));
    await witch.locator('[data-ww-action="reveal"]').click();
    assert.match(await witch.locator('.ww-private').innerText(), /今晚刀口：席位/);
    await clickAction(witch, 'save');
    const seerIndex = views.findIndex(view => view.own.role === 'seer');
    const seer = pages[seerIndex];
    await seer.waitForFunction(() => lastGameStatePayload.view.legal_actions.includes('inspect'));
    await seer.locator(`[data-ww-player="${views[wolves[0]].you}"]`).click();
    await clickAction(seer, 'confirm');
    for (const page of pages) await waitPhase(page, 'dawn_review');
    assert.equal(await witch.locator('.ww-role').count(), 0, 'phase change covers private data');
    assert.equal(await host.evaluate(() => lastGameStatePayload.view.last_deaths.length), 0);
    for (const page of pages) await clickAction(page, 'next_round');
    await waitPhase(host, 'discussion');
    for (const width of [320, 390, 1024, 1440]) {
      await host.setViewportSize({width, height: 900});
      assert.deepEqual(await overflow(host), {page: false, offenders: []}, 'discussion ' + width);
      await host.locator('.game-panel').screenshot({path: `${snapshots}/table-${width}.png`});
    }
    await host.locator('#werewolfHelpBtn').click();
    assert.equal(await host.locator('dialog[open]').count(), 1);
    await host.locator('[data-obg-help-lang="en"]').click();
    assert.match(await host.locator('dialog[open]').innerText(), /How you win/);
    await host.locator('[data-obg-help-lang="zh"]').click();
    await host.keyboard.press('Escape');
    assert.equal(await host.locator('dialog[open]').count(), 0);
    await host.locator('#werewolfExplainBtn').click();
    const disabledSeat = host.locator('.ww-seat:disabled').first();
    const bounds = await disabledSeat.boundingBox();
    await host.mouse.click(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2);
    assert.equal(await host.locator('dialog[open]').count(), 1, 'disabled seats explainable');
    await host.keyboard.press('Escape');
    const before = await host.evaluate(() => lastGameStatePayload.view.revision);
    await host.locator('#werewolfExplainBtn').click();
    await host.locator('[data-ww-action="end_speech"]').click();
    assert.equal(await host.locator('dialog[open]').count(), 1);
    assert.equal(await host.evaluate(() => lastGameStatePayload.view.revision), before, 'Explain never hands over');
    await host.keyboard.press('Escape');
    for (const page of pages) await clickAction(page, 'end_speech');
    await waitPhase(host, 'vote');
    for (const page of pages) await clickAction(page, 'pass');
    await waitPhase(host, 'dusk_review');
    for (const page of pages.slice(0, -1)) await clickAction(page, 'next_round');
    assert.equal(await host.evaluate(() => lastGameStatePayload.view.phase), 'dusk_review');
    await clickAction(pages[5], 'next_round');
    await waitPhase(host, 'night');
    assert.equal(await host.evaluate(() => lastGameStatePayload.view.day), 2);
    const reconnect = pages[5];
    const oldPlayer = await reconnect.evaluate(() => lastGameStatePayload.view.you);
    await reconnect.reload();
    await reconnect.waitForFunction(() => roomSessionReady && lastGameStatePayload?.view?.phase === 'night');
    assert.equal(await reconnect.evaluate(() => lastGameStatePayload.view.you), oldPlayer);
    assert.equal(await reconnect.locator('.ww-role').count(), 0);
    await host.setViewportSize({width: 390, height: 844});
    await host.locator('.ww-phase').scrollIntoViewIfNeeded();
    const phaseBounds = await host.locator('.ww-phase').boundingBox();
    await host.touchscreen.tap(phaseBounds.x + 10, phaseBounds.y + 10);
    assert.equal(await host.locator('#werewolfTooltip').isVisible(), true);
    await host.waitForFunction(() => document.getElementById('werewolfTooltip').hidden, {timeout: 5000});
    await host.locator('#werewolfExplainBtn').click();
    const dragSeat = host.locator('.ww-seat').first();
    await dragSeat.scrollIntoViewIfNeeded();
    const dragBounds = await dragSeat.boundingBox();
    await host.mouse.move(dragBounds.x + 15, dragBounds.y + 15);
    await host.mouse.down();
    await host.mouse.move(dragBounds.x + 15, dragBounds.y + 60, {steps: 6});
    await host.mouse.up();
    assert.equal(await host.locator('dialog[open]').count(), 0, 'scroll gesture does not explain');
    await host.keyboard.press('Escape');
    await host.evaluate(() => socket.emit('room:create', {name: 'Self-attack host', game_type: 'werewolf'}));
    await host.waitForFunction(() => currentRoomState?.status === 'lobby' && currentRoomState.players.length === 1);
    const selfAttackRoom = await host.evaluate(() => roomId);
    for (let index = 1; index < pages.length; index++) {
      await pages[index].evaluate(({room, index}) => socket.emit('room:join', {room_id: room, name: 'Wolf test ' + index}),
        {room: selfAttackRoom, index});
      await pages[index].waitForFunction(room => roomId === room && roomSessionReady, selfAttackRoom);
    }
    for (const page of pages) await page.evaluate(() => socket.emit('room:ready', {room_id: roomId, ready: true}));
    await host.waitForFunction(() => currentRoomState.players.length === 6 && currentRoomState.players.every(player => player.ready));
    await host.evaluate(() => setRoomControlsCollapsed(false));
    await host.locator('#startBtn').click();
    await waitPhase(host, 'setup');
    await host.locator('[data-ww-option="allow_wolf_self_attack"]').selectOption('true');
    await host.locator('#werewolfExplainBtn').click();
    await host.locator('[data-ww-option="allow_wolf_self_attack"]').click();
    assert.match(await host.locator('dialog[open]').innerText(), /狼人自刀|Wolf self-attacks/);
    await host.keyboard.press('Escape');
    assert.equal(await host.locator('[data-ww-option="allow_wolf_self_attack"]').inputValue(), 'true');
    await host.locator('#werewolfHelpBtn').click();
    await host.locator('[data-obg-help-lang="en"]').click();
    assert.match(await host.locator('dialog[open]').innerText(), /Wolf self-attacks are disabled by default/);
    await host.keyboard.press('Escape');
    for (const width of [320, 390, 1024, 1440]) {
      await host.setViewportSize({width, height: 900});
      assert.deepEqual(await overflow(host), {page: false, offenders: []}, 'self-attack setup ' + width);
      await host.locator('.game-panel').screenshot({path: `${snapshots}/self-attack-setup-${width}.png`});
    }
    await host.reload();
    await host.waitForFunction(() => roomSessionReady && lastGameStatePayload?.view?.phase === 'setup');
    await host.locator('[data-ww-option="allow_wolf_self_attack"]').selectOption('true');
    await clickAction(host, 'deal');
    for (const page of pages) {
      await waitPhase(page, 'identity');
      assert.equal(await page.evaluate(() => lastGameStatePayload.view.allow_wolf_self_attack), true);
      assert.match(await page.locator('.ww-identity').innerText(), /允许狼人自刀/);
      await clickAction(page, 'ready');
    }
    await waitPhase(host, 'night');
    const selfAttackViews = await Promise.all(pages.map(page => page.evaluate(() => lastGameStatePayload.view)));
    const selfAttackWolves = selfAttackViews.map((view, index) => view.own.role === 'werewolf' ? index : -1).filter(index => index >= 0);
    const selfAttackTarget = selfAttackViews[selfAttackWolves[0]].you;
    const selfAttacker = pages[selfAttackWolves[0]];
    await selfAttacker.setViewportSize({width: 320, height: 900});
    await selfAttacker.locator(`[data-ww-player="${selfAttackTarget}"]`).click();
    assert.equal(await selfAttacker.locator('.ww-selected').count(), 1);
    assert.deepEqual(await overflow(selfAttacker), {page: false, offenders: []}, 'self-attack confirmation');
    await selfAttacker.locator('.game-panel').screenshot({path: `${snapshots}/self-attack-confirm-320.png`});
    await clickAction(selfAttacker, 'confirm');
    const wolfTeammate = pages[selfAttackWolves[1]];
    await wolfTeammate.locator(`[data-ww-player="${selfAttackTarget}"]`).click();
    await clickAction(wolfTeammate, 'confirm');
    const selfAttackWitch = pages[selfAttackViews.findIndex(view => view.own.role === 'witch')];
    await selfAttackWitch.waitForFunction(() => lastGameStatePayload.view.legal_actions.includes('witch'));
    assert.equal(await selfAttackWitch.evaluate(() => lastGameStatePayload.view.victim), selfAttackTarget);
    await clickAction(selfAttackWitch, 'witch-pass');
    const selfAttackSeer = pages[selfAttackViews.findIndex(view => view.own.role === 'seer')];
    await selfAttackSeer.waitForFunction(() => lastGameStatePayload.view.legal_actions.includes('inspect'));
    await selfAttackSeer.locator(`[data-ww-player="${selfAttackTarget}"]`).click();
    await clickAction(selfAttackSeer, 'confirm');
    await waitPhase(selfAttacker, 'last_words');
    await clickAction(selfAttacker, 'end_speech');
    await waitPhase(host, 'dawn_review');
    assert.equal(await host.evaluate(target => lastGameStatePayload.view.players.find(player => player.player_id === target).alive,
      selfAttackTarget), false);
    await host.reload();
    await host.waitForFunction(() => roomSessionReady && lastGameStatePayload?.view?.phase === 'dawn_review');
    assert.equal(await host.evaluate(() => lastGameStatePayload.view.allow_wolf_self_attack), true);
    const fixtures = JSON.parse(execFileSync(process.env.PYTHON || 'python3', ['-c', `
import copy, json
from tests.test_werewolf import make_state
from game.werewolf import WerewolfGame as Game, _deaths, _phase, _speeches
roles = ['werewolf', 'wolf_king', 'white_wolf', 'werewolf', 'seer', 'witch', 'hunter', 'guard', 'idiot', 'knight'] + ['villager'] * 6
state = make_state(roles)
for index, player in enumerate(state['players'].values()):
    player['name'] = '长名字玩家Player' + str(index + 1)
_speeches(state)
views = {'sixteen': Game.get_public_view(state, 'p0')}
for role in ('guard', 'seer', 'witch', 'knight', 'white_wolf'):
    current = copy.deepcopy(state)
    actor = next(player_id for player_id in current['turn_order'] if current['players'][player_id]['role'] == role)
    if role in ('guard', 'seer', 'witch'):
        current.update(night_step={'guard': 0, 'witch': 2, 'seer': 3}[role], night_actors=[actor],
                       night={'guard': None, 'kill': 'p10', 'poison': None, 'saved': False})
        _phase(current, 'night')
    views[role] = Game.get_public_view(current, actor)
current = copy.deepcopy(state)
_deaths(current, {'p6': 'eaten'}, 'dawn_review', ['p6'])
views['hunter'] = Game.get_public_view(current, 'p6')
print(json.dumps(views))
`], {encoding: 'utf8'}));
    for (const [key, fixture] of Object.entries(fixtures)) {
      await host.evaluate(view => renderWerewolfGameState({room_id: roomId, game_type: 'werewolf', view}), fixture);
      if (['witch', 'guard', 'seer'].includes(key)) await host.locator('[data-ww-action="reveal"]').click();
      if (key === 'witch') await host.locator('[data-ww-action="mode-poison"]').click();
      if (key === 'knight') await host.locator('[data-ww-action="mode-duel"]').click();
      if (key === 'white_wolf') await host.locator('[data-ww-action="mode-explode"]').click();
      if (key !== 'sixteen') await host.locator('.ww-seat:not(:disabled)').last().click();
      for (const width of [320, 390, 1024, 1440]) {
        await host.setViewportSize({width, height: 900});
        assert.deepEqual(await overflow(host), {page: false, offenders: []}, key + ' ' + width);
        await host.locator('.game-panel').screenshot({path: `${snapshots}/${key}-${width}.png`});
      }
    }
    const botContext = await browser.newContext({viewport: {width: 390, height: 844}, hasTouch: true});
    contexts.push(botContext);
    const botHost = await botContext.newPage();
    botHost.on('pageerror', error => errors.push(error.message));
    await botHost.goto(base);
    await botHost.waitForFunction(() => typeof socket !== 'undefined' && socket.connected);
    await botHost.locator('#createBtn').click();
    await botHost.locator('#nameInput').fill('Debug host');
    await botHost.locator('#playerNameForm button[type=submit]').click();
    await botHost.locator('#gameSearchInput').fill('werewolf');
    await botHost.locator('[data-game-id="werewolf"]').click();
    await botHost.waitForFunction(() => roomSessionReady && currentGameType === 'werewolf' && !pendingRoomRequest);
    for (let count = 2; count <= 6; count++) {
      await botHost.locator('#addBotBtn').click();
      await botHost.waitForFunction(expected => currentRoomState.players.length === expected && !pendingRoomRequest, count);
    }
    assert.equal(await botHost.evaluate(() => currentRoomState.players.filter(player => player.is_bot && player.ready).length), 5);
    if (!await botHost.evaluate(() => currentRoomState.players.find(player => player.player_id === playerId).ready)) {
      await botHost.locator('#readyBtn').click();
    }
    await botHost.waitForFunction(() => currentRoomState.players.every(player => player.ready) && !pendingRoomRequest);
    await botHost.locator('#startBtn').click();
    await waitPhase(botHost, 'setup');
    assert.match(await botHost.locator('.ww-banner').innerText(), /支持调试机器人/);
    for (const width of [320, 390, 1024, 1440]) {
      await botHost.setViewportSize({width, height: 900});
      assert.deepEqual(await overflow(botHost), {page: false, offenders: []}, 'bot setup ' + width);
      await botHost.locator('.game-panel').screenshot({path: `${snapshots}/bots-setup-${width}.png`});
    }
    await botHost.evaluate(() => {
      window.werewolfBotActivity = [];
      socket.on('game:state', payload => {
        window.werewolfBotActivity.push(...(payload.events || []).filter(event => event.type === 'bot:action'));
        if (payload.bot_status?.player_id || payload.bot_status?.running) window.werewolfBotActivity.push(payload.bot_status);
      });
      socket.on('game:bot_progress', payload => {
        if (payload.bot_status?.player_id || payload.bot_status?.running) window.werewolfBotActivity.push(payload.bot_status);
      });
    });
    await clickAction(botHost, 'deal');
    await botHost.waitForFunction(() => lastGameStatePayload.view.phase === 'identity' && lastGameStatePayload.view.ready.length === 5);
    await clickAction(botHost, 'ready');
    for (let step = 0; step < 30; step++) {
      await botHost.waitForFunction(() => lastGameStatePayload.view.legal_actions.some(kind => !['explode', 'duel'].includes(kind)));
      const state = await botHost.evaluate(() => lastGameStatePayload.view);
      if (state.phase === 'dawn_review') break;
      if (state.legal_actions.includes('end_speech')) await clickAction(botHost, 'end_speech');
      else if (state.legal_actions.includes('witch')) await clickAction(botHost, 'witch-pass');
      else if (state.legal_actions.includes('inspect') || state.legal_actions.includes('wolf_vote')) {
        const wolfVote = state.legal_actions.includes('wolf_vote');
        const target = state.players.find(player => player.alive && player.player_id !== state.you
          && (!wolfVote || !state.wolf_team.some(wolf => wolf.player_id === player.player_id)));
        await botHost.locator(`[data-ww-player="${target.player_id}"]`).click();
        await clickAction(botHost, 'confirm');
      } else await clickAction(botHost, 'pass');
    }
    await botHost.waitForFunction(() => lastGameStatePayload.view.phase === 'dawn_review' && lastGameStatePayload.view.ready.length === 5);
    const botReview = await botHost.evaluate(() => lastGameStatePayload.view);
    assert.equal(botReview.ready.includes(botReview.you), false, 'bots wait for the human review');
    assert.deepEqual(await botHost.evaluate(() => window.werewolfBotActivity), []);
    await botHost.reload();
    await botHost.waitForFunction(() => roomSessionReady && lastGameStatePayload?.view?.phase === 'dawn_review');
    assert.equal(await botHost.evaluate(() => lastGameStatePayload.view.you), botReview.you);
    assert.equal(await botHost.evaluate(() => lastGameStatePayload.view.revision), botReview.revision);
    for (const width of [320, 390, 1024, 1440]) {
      await botHost.setViewportSize({width, height: 900});
      assert.deepEqual(await overflow(botHost), {page: false, offenders: []}, 'bot review ' + width);
      await botHost.locator('.game-panel').screenshot({path: `${snapshots}/bots-review-${width}.png`});
    }
    await botHost.locator('#werewolfHelpBtn').click();
    await botHost.locator('[data-obg-help-lang="en"]').click();
    await botHost.locator('[data-obg-help-tab="privacy"]').click();
    assert.match(await botHost.locator('dialog[open]').innerText(), /Bots are for debugging only/);
    await botHost.keyboard.press('Escape');
    await clickAction(botHost, 'next_round');
    await botHost.waitForFunction(() => lastGameStatePayload.view.phase !== 'dawn_review');
    assert.deepEqual(errors, []);
    console.log('PASS: six humans, five debug bots, configurable wolf self-attacks and teammate attacks, lazy loading, private roles, wolf ballot, Witch save, Seer check, speech handover, secret voting, human review barrier, reconnect, bilingual Help/Escape, disabled Explain, touch tooltip, scroll protection and 320/390/1024/1440 layouts including 16 seats and special skills.');
  } finally {
    for (const context of contexts) await context.close();
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
