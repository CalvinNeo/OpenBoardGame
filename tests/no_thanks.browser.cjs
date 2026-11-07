// Run against uvicorn; set ROOM_TEST_URL, PLAYWRIGHT_MODULE and PYTHON if needed.
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { execFileSync } = require('node:child_process');
const base = process.env.ROOM_TEST_URL || 'http://127.0.0.1:8784';
const output = process.env.NO_THANKS_OUTPUT || 'build/no-thanks-ui';
fs.mkdirSync(output, { recursive: true });
const views = JSON.parse(execFileSync(process.env.PYTHON || 'python', ['-c', `
import copy,json
from tests.test_no_thanks import make_state
from game.no_thanks import NoThanksGame as G
s=make_state(count=7,rounds=2)
s['current_turn']='p0'
v={'opening':G.get_public_view(s,'p0')}
s['current_card']=16
s['pot']=6
s['players']['p0'].update(cards=[8,13,14,15,17],chips=8)
s['players']['p1']['cards']=[20,21,22,23,24,25,26,27,28,29,30,31]
s['players']['p2']['cards']=[4,5,6]
s['player_meta']['p0']['name']='Calvin'
s['player_meta']['p1']['name']='VeryLongUnbrokenPlayerNameToCheckContainerOverflow'
s['player_meta']['p2']['name']='名字很长的玩家用于验证手机布局不会溢出'
s['history']=[{'type':'pass','player_id':'p1','card':16,'pot':i,'number':i} for i in range(1,61)]
v['playing']=G.get_public_view(s,'p0')
v['spectator']=G.get_public_view(s,'visitor')
v['waiting']=G.get_public_view(s,'p2')
s['current_turn']='p1'
v['long_waiting']=G.get_public_view(s,'p0')
s['current_turn']='p0'
s['players']['p0']['chips']=0
v['forced']=G.get_public_view(s,'p0')
s['players']['p0'].update(cards=list(range(3,26)),chips=8)
for pid in s['turn_order'][1:]: s['players'][pid]['cards']=[]
s['current_card']=35
s['deck']=[]
v['long_hand']=G.get_public_view(s,'p0')
s=make_state(rounds=2)
for _ in range(24): G.apply_action(s,s['current_turn'],{'type':'take'})
v['review']=G.get_public_view(s,'p0')
G.apply_action(s,'p0',{'type':'next_round'})
v['ready']=G.get_public_view(s,'p0')
for p in ['p1','p2']: G.apply_action(s,p,{'type':'next_round'})
for _ in range(24): G.apply_action(s,s['current_turn'],{'type':'take'})
v['finished']=G.get_public_view(s,'p0')
print(json.dumps(v))
`], {encoding: 'utf8'}));

async function render(page, key) {
  await page.evaluate(view => {
    renderNoThanksGameState({room_id: roomId, game_type: 'no_thanks', view});
  }, views[key]);
}
async function bounds(page, label) {
  const result = await page.evaluate(() => {
    const bad = [...document.querySelectorAll('#noThanksPanel *, #noThanksDialog *, #noThanksHeaderActions *, #mobileExplainSlot *')].filter(el => {
      const r = el.getBoundingClientRect();
      const style = getComputedStyle(el);
      return r.width > 0 && r.height > 0 && (r.left < -1 || r.right > innerWidth + 1 ||
        (el.clientWidth && el.scrollWidth > el.clientWidth + 1 && !['hidden', 'auto'].includes(style.overflowX)));
    }).map(el => `${el.id || el.className}: ${el.textContent.slice(0, 45)} client=${el.clientWidth} scroll=${el.scrollWidth}`);
    return {width: innerWidth, scroll: document.documentElement.scrollWidth, bad};
  });
  assert(result.scroll <= result.width, `${label}: page overflow ${JSON.stringify(result)}`);
  assert.deepEqual(result.bad, [], `${label}: container overflow`);
}
async function pointClick(page, locator, touch = false) {
  await locator.scrollIntoViewIfNeeded();
  const r = await locator.boundingBox();
  if (touch) await page.touchscreen.tap(r.x + r.width / 2, r.y + r.height / 2);
  else await page.mouse.click(r.x + r.width / 2, r.y + r.height / 2);
}

async function checkHeaderPlacement(page, mobile) {
  await page.waitForFunction(() => {
    const docked = matchMedia('(max-width: 900px)').matches ||
      document.getElementById('roomControlsPanel').classList.contains('collapsed') ||
      document.body.classList.contains('room-controls-desktop-popover');
    return document.getElementById('noThanksExplainBtn').parentElement.id ===
      (docked ? 'mobileExplainSlot' : 'noThanksHeaderActions');
  });
  assert.equal(await page.evaluate(() => matchMedia('(max-width: 900px)').matches), mobile);
  assert.equal(await page.locator('.game-panel-title h2').textContent(), 'No Thanks!');
  assert.equal(await page.locator('#noThanksPanel h2').count(), 0);
  assert.equal(await page.locator('#noThanksHelpBtn').evaluate(el => el.parentElement.id), 'noThanksHeaderActions');
  assert.equal(await page.locator('#noThanksHeaderActions').evaluate(el => !!el.parentElement.matches('.game-panel > .panel-header')), true);
  assert.equal(await page.locator('#noThanksPanel #noThanksHelpBtn, #noThanksPanel #noThanksExplainBtn').count(), 0);
  assert.equal(await page.locator('#noThanksExplainBtn').count(), 1);
  assert.equal(await page.locator('#noThanksHelpBtn').count(), 1);
  assert.equal(await page.locator('#noThanksExplainBtn').getAttribute('aria-label'), 'Explain');
  assert.equal(await page.locator('#noThanksHelpBtn').evaluate(el => getComputedStyle(el, '::before').content), '"?"');
  assert.equal(await page.locator('#noThanksExplainBtn').evaluate(el => getComputedStyle(el, '::before').borderTopStyle), 'solid');
  const title = await page.locator('.game-panel-title h2').boundingBox();
  const reconnect = await page.locator('#gameReconnectBtn').boundingBox();
  const help = await page.locator('#noThanksHelpBtn').boundingBox();
  assert(Math.abs(title.y + title.height / 2 - reconnect.y - reconnect.height / 2) < 3, 'Reconnect stays beside the title');
  assert(Math.abs(help.y + help.height / 2 - reconnect.y - reconnect.height / 2) < 3, 'Help stays on the same header row');
}

async function checkDecisionLayout(page, width) {
  const result = await page.evaluate(() => {
    const rect = selector => document.querySelector(selector).getBoundingClientRect();
    const card = rect('#noThanksCard');
    const hand = rect('#noThanksYourRuns');
    const actions = rect('.no-thanks-actions');
    const pass = rect('#noThanksPass');
    const take = rect('#noThanksTake');
    const offer = rect('.no-thanks-offer');
    const personal = rect('.no-thanks-personal');
    return {
      decisionHeight: actions.bottom - Math.min(card.top, hand.top),
      hasHandBeforeActions: hand.bottom <= actions.top,
      sameButtonRow: Math.abs(pass.top - take.top) < 1 && pass.right < take.left,
      targetsLargeEnough: Math.min(pass.height, take.height) >= 44,
      panelsSeparated: offer.bottom <= personal.top || offer.right <= personal.left,
      panelIsFrameless: getComputedStyle(document.getElementById('noThanksPanel')).borderTopWidth === '0px',
    };
  });
  assert(result.hasHandBeforeActions && result.sameButtonRow && result.targetsLargeEnough && result.panelsSeparated && result.panelIsFrameless,
    `${width}: decision layout ${JSON.stringify(result)}`);
  if (width <= 390) assert(result.decisionHeight < 460, `${width}: card, hand and actions fit together`);
}

async function swipe(page, locator) {
  await locator.scrollIntoViewIfNeeded();
  const rect = await locator.boundingBox();
  const client = await page.context().newCDPSession(page);
  const horizontal = rect.x + rect.width / 2;
  const vertical = rect.y + rect.height / 2;
  try {
    await client.send('Input.dispatchTouchEvent', {type: 'touchStart', touchPoints: [{x: horizontal, y: vertical}]});
    for (let step = 1; step <= 6; step++) {
      await client.send('Input.dispatchTouchEvent', {type: 'touchMove', touchPoints: [{x: horizontal, y: vertical - step * 16}]});
      await page.waitForTimeout(25);
    }
    await client.send('Input.dispatchTouchEvent', {type: 'touchEnd', touchPoints: []});
    await page.waitForTimeout(300);
  } finally {
    await client.detach();
  }
}

(async () => {
  const browser = await chromium.launch({channel: process.env.BROWSER_CHANNEL || 'chrome', headless: true});
  const errors = [];
  try {
    const context = await browser.newContext({viewport: {width: 1440, height: 1100}, hasTouch: true});
    const page = await context.newPage();
    page.on('pageerror', error => errors.push(error.message));
    await page.route('https://fonts.googleapis.com/**', route => route.abort());
    await page.goto(base);
    await page.waitForFunction(() => typeof socket !== 'undefined' && socket.connected && cachedGameList);
    assert.equal(await page.locator('#noThanksPanel').evaluate(el => el.children.length), 0);
    assert.equal(await page.locator('#noThanksHeaderActions').evaluate(el => el.children.length), 0);
    assert.equal(await page.locator('script[src*="games/no_thanks.js"]').count(), 0);
    await page.evaluate(() => socket.emit('room:create', {name: 'No Thanks QA', game_type: 'no_thanks'}));
    await page.waitForFunction(() => currentGameType === 'no_thanks' && isGameAssetsLoaded('no_thanks'));
    await page.evaluate(() => setRoomControlsCollapsed(false));
    await checkHeaderPlacement(page, false);
    assert.equal(await page.locator('#noThanksConfigBox').isVisible(), true);
    await page.locator('#noThanksRounds').selectOption('2');
    for (const count of [2, 3]) {
      await page.evaluate(() => socket.emit('room:add_bot', {room_id: roomId}));
      await page.waitForFunction(count => currentRoomState.players.length === count, count);
    }
    assert.equal(await page.locator('#noThanksRounds').inputValue(), '2');
    await page.evaluate(() => socket.emit('room:ready', {room_id: roomId, ready: true}));
    await page.waitForFunction(() => !document.getElementById('startBtn').disabled);
    await page.locator('#startBtn').click();
    await page.waitForFunction(() => lastGameStatePayload?.game_type === 'no_thanks' && lastGameStatePayload.view.current_turn === playerId);
    assert.equal(await page.evaluate(() => lastGameStatePayload.view.config.rounds), 2);
    assert.equal(await page.locator('#noThanksConfigBox').isVisible(), false);
    const card = await page.locator('#noThanksCardValue').textContent();
    const turn = await page.evaluate(() => lastGameStatePayload.view.turn_number);
    await page.locator('#noThanksTake').click();
    await page.waitForFunction(turn => lastGameStatePayload.view.turn_number === turn + 1, turn);
    assert.equal(await page.evaluate(() => lastGameStatePayload.view.current_turn), await page.evaluate(() => playerId));
    assert.notEqual(await page.locator('#noThanksCardValue').textContent(), card);
    await page.locator('#noThanksPass').click();
    await page.waitForFunction(turn => lastGameStatePayload.view.turn_number > turn + 2 && lastGameStatePayload.view.current_turn === playerId, turn);
    const before = await page.evaluate(() => ({room: roomId, turn: lastGameStatePayload.view.turn_number}));
    await page.reload();
    await page.waitForFunction(before => isGameAssetsLoaded('no_thanks') && lastGameStatePayload?.view.turn_number === before.turn, before);
    assert.equal(await page.evaluate(() => roomId), before.room);
    assert.equal(await page.locator('#noThanksPanel').isVisible(), true);
    await checkHeaderPlacement(page, false);
    await page.evaluate(() => { window.noThanksTestActions = []; sendAction = action => noThanksTestActions.push(action); });

    await render(page, 'playing');
    assert.equal(await page.locator('#noThanksDelta').textContent(), '-23');
    assert.equal(await page.locator('#noThanksProjection').textContent(), 'Net 30 → 7');
    assert.equal(await page.locator('.no-thanks-player').count(), 6);
    assert.equal(await page.locator('#noThanksYourRuns .no-thanks-run span').count(), 5);
    assert.equal(await page.locator('#noThanksYourCardCount').textContent(), '· 5');
    assert.equal(await page.locator('#noThanksMoveHistory').getAttribute('open'), null);
    assert.equal(await page.locator('#roomControlsPanel').evaluate(el => el.classList.contains('no-thanks-turn')), true);
    assert.equal(await page.locator('.no-thanks-player-scores').filter({hasText: '🔒'}).count(), 6);
    await bounds(page, 'desktop');
    await checkDecisionLayout(page, 1440);
    await page.locator('#noThanksPanel').screenshot({path: `${output}/desktop.png`});
    await page.locator('.game-panel').screenshot({path: `${output}/desktop-header.png`});
    await page.locator('#noThanksHelpBtn').click();
    assert.equal(await page.locator('#noThanksDialog').evaluate(el => el.open), true);
    assert.match(await page.locator('#noThanksDialogBody').textContent(), /仍由你行动/);
    await page.keyboard.press('Escape');
    assert.equal(await page.locator('#noThanksDialog').evaluate(el => el.open), false);

    // Both live controls and disabled controls explain without submitting actions.
    await page.locator('#noThanksExplainBtn').click();
    await page.locator('#noThanksTake').click();
    assert.match(await page.locator('#noThanksDialogBody').textContent(), /仍由你继续行动/);
    assert.equal(await page.evaluate(() => noThanksTestActions.length), 0);
    assert.equal(await page.locator('#noThanksExplainBtn').getAttribute('aria-pressed'), 'false');
    await page.locator('#noThanksDialogClose').click();
    await render(page, 'forced');
    assert.equal(await page.locator('#noThanksPass').isDisabled(), true);
    assert.equal(await page.locator('#noThanksPassLabel').textContent(), 'No chips left');
    await page.locator('#noThanksExplainBtn').click();
    await pointClick(page, page.locator('#noThanksPass'));
    assert.match(await page.locator('#noThanksDialogBody').textContent(), /没有筹码/);
    await page.keyboard.press('Escape');
    await page.locator('#noThanksExplainBtn').click();
    await page.evaluate(() => { window.noThanksProbeCount = 0; const button = document.createElement('button'); button.id = 'noThanksProbe'; button.textContent = 'Probe'; button.onclick = () => noThanksProbeCount++; document.getElementById('noThanksPanel').append(button); });
    await page.locator('#noThanksProbe').click();
    assert.equal(await page.evaluate(() => noThanksProbeCount), 0);
    await page.keyboard.press('Escape');
    await page.locator('#noThanksProbe').evaluate(el => el.remove());

    await page.locator('#noThanksExplainBtn').click();
    await page.locator('#noThanksRemaining').click();
    assert.match(await page.locator('#noThanksDialogTitle').textContent(), /Deck/);
    assert.match(await page.locator('#noThanksDialogBody').textContent(), /不包括桌面当前牌/);
    assert.equal(await page.evaluate(() => noThanksTestActions.length), 0);
    await page.keyboard.press('Escape');

    await render(page, 'opening');
    await page.locator('#noThanksPass').click();
    assert.deepEqual(await page.evaluate(() => noThanksTestActions), [{type: 'pass'}]);
    assert.equal(await page.locator('#noThanksTake').isDisabled(), true);
    assert.equal(await page.locator('#noThanksDecision').textContent(), 'Sending your move…');
    await page.evaluate(() => socket.listeners('system:error').forEach(handler => handler({message: 'QA error recovery'})));
    assert.equal(await page.locator('#noThanksTake').isEnabled(), true);
    assert.equal(await page.locator('#noThanksDecision').textContent(), 'Pay a chip or collect the offer.');
    await page.evaluate(() => setRoomFeedback());
    await page.locator('#noThanksTake').click();
    assert.deepEqual(await page.evaluate(() => noThanksTestActions), [{type: 'pass'}, {type: 'take'}]);

    await render(page, 'review');
    assert.equal(await page.locator('#noThanksReview').isVisible(), true);
    assert.equal(await page.locator('.no-thanks-offer').isVisible(), false);
    assert.equal(await page.locator('.no-thanks-player').count(), 3);
    assert.equal(await page.locator('#roomControlsPanel').evaluate(el => el.classList.contains('no-thanks-turn')), false);
    await page.locator('#noThanksNext').click();
    assert.deepEqual(await page.evaluate(() => noThanksTestActions.at(-1)), {type: 'next_round'});
    await render(page, 'ready');
    assert.equal(await page.locator('#noThanksNext').isDisabled(), true);
    assert.equal(await page.locator('#noThanksNext').textContent(), 'Ready ✓');
    await render(page, 'finished');
    assert.equal(await page.locator('#noThanksNext').isVisible(), false);
    assert.match(await page.locator('#noThanksResult').textContent(), /wins|win/);
    await page.locator('#noThanksPanel').screenshot({path: `${output}/finished.png`});

    await page.evaluate(() => setRoomControlsCollapsed(true));
    for (const width of [320, 390, 768, 1024, 1440]) {
      await page.setViewportSize({width, height: 950});
      await checkHeaderPlacement(page, width <= 900);
      for (const key of ['opening', 'playing', 'waiting', 'long_waiting', 'long_hand', 'spectator', 'review', 'ready', 'finished']) {
        await render(page, key);
        await bounds(page, `${width} ${key}`);
        if (key === 'spectator') {
          assert.equal(await page.locator('#noThanksPass').isDisabled(), true);
          assert.equal(await page.locator('#noThanksTake').isDisabled(), true);
          assert.equal(await page.locator('#noThanksYourChips').textContent(), '—');
          assert.equal(await page.locator('.no-thanks-personal').isVisible(), false);
          assert.equal(await page.locator('.no-thanks-actions').isVisible(), false);
          assert.equal(await page.locator('.no-thanks-player').count(), 7);
        }
        if (['opening', 'playing', 'long_hand'].includes(key)) await checkDecisionLayout(page, width);
        if (key === 'long_hand' && width <= 390) {
          const hand = await page.locator('#noThanksYourRuns').evaluate(el => {
            el.scrollTop = 36;
            return {scroll: el.scrollTop, height: el.clientHeight, content: el.scrollHeight};
          });
          assert(hand.height <= 90 && (hand.content <= hand.height || hand.scroll > 0), `Long hands scroll locally: ${JSON.stringify(hand)}`);
          if (width === 320) assert(hand.scroll > 0, 'The narrowest screen scrolls a long run');
          await render(page, 'long_hand');
          assert.equal(await page.locator('#noThanksYourRuns').evaluate(el => el.scrollTop), hand.scroll);
        }
        if (key === 'waiting') {
          assert.match(await page.locator('#noThanksDecision').textContent(), /passed 16/);
          assert.equal(await page.locator('#roomControlsPanel').evaluate(el => el.classList.contains('no-thanks-turn')), false);
        }
        if (['review', 'finished', 'spectator'].includes(key)) {
          await page.locator('.game-panel').screenshot({path: `${output}/${key}-${width}.png`});
        }
      }
      if (width <= 390) {
        await render(page, 'playing');
        await page.locator('#noThanksPanel').screenshot({path: `${output}/mobile-${width}.png`});
        await page.evaluate(() => window.scrollTo(0, 0));
        await page.screenshot({path: `${output}/mobile-header-${width}.png`});
        await page.locator('#noThanksHelpBtn').click();
        await bounds(page, `${width} help`);
        if (width === 390) await page.locator('#noThanksDialog').screenshot({path: `${output}/help.png`});
        await page.keyboard.press('Escape');
      } else {
        await render(page, 'playing');
        await page.locator('.game-panel').screenshot({path: `${output}/desktop-${width}.png`});
      }
    }
    for (const viewport of [{width: 320, height: 568}, {width: 390, height: 844}]) {
      await page.setViewportSize(viewport);
      await render(page, 'playing');
      await page.evaluate(() => { document.activeElement?.blur(); window.scrollTo(0, 0); });
      await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
      await bounds(page, `short screen ${viewport.width}`);
      const actions = await page.locator('.no-thanks-actions').boundingBox();
      assert(actions.y + actions.height <= viewport.height, `Both actions fit on ${viewport.width} × ${viewport.height}`);
      await page.screenshot({path: `${output}/compact-${viewport.width}.png`});
    }
    await page.setViewportSize({width: 390, height: 950});
    await checkHeaderPlacement(page, true);
    await page.reload();
    await page.waitForFunction(() => isGameAssetsLoaded('no_thanks') && lastGameStatePayload?.game_type === 'no_thanks');
    await checkHeaderPlacement(page, true);
    await page.evaluate(() => { window.noThanksTestActions = []; sendAction = action => noThanksTestActions.push(action); });
    await render(page, 'playing');
    await page.locator('#noThanksMoveHistory summary').click();
    const historyScroll = await page.locator('#noThanksLog').evaluate(el => {
      el.scrollTop = 100;
      return el.scrollTop;
    });
    assert(historyScroll > 0);
    assert(await page.locator('#noThanksLog').evaluate(el => el.clientHeight <= 160 && el.scrollHeight > el.clientHeight));
    await render(page, 'playing');
    assert.equal(await page.locator('#noThanksLog').evaluate(el => el.scrollTop), historyScroll);
    await page.locator('#noThanksMoveHistory summary').click();
    await page.evaluate(() => window.scrollTo(0, 0));
    const beforeSwipe = await page.evaluate(() => ({scroll: scrollY, actions: noThanksTestActions.length}));
    await swipe(page, page.locator('#noThanksCard'));
    assert(await page.evaluate(previous => scrollY > previous, beforeSwipe.scroll), 'Ordinary card swipes scroll the page');
    assert.equal(await page.locator('#noThanksTooltip').isVisible(), false);
    assert.equal(await page.locator('#noThanksDialog').evaluate(el => el.open), false);
    assert.equal(await page.evaluate(() => noThanksTestActions.length), beforeSwipe.actions);
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.locator('#noThanksExplainBtn').tap();
    await swipe(page, page.locator('#noThanksCard'));
    assert.equal(await page.locator('#noThanksExplainBtn').getAttribute('aria-pressed'), 'true');
    assert.equal(await page.locator('#noThanksDialog').evaluate(el => el.open), false);
    assert.equal(await page.evaluate(() => noThanksTestActions.length), beforeSwipe.actions);
    await page.keyboard.press('Escape');
    await page.evaluate(() => window.scrollTo(0, 0));
    await swipe(page, page.locator('#noThanksTake'));
    assert.equal(await page.evaluate(() => noThanksTestActions.length), beforeSwipe.actions);
    await render(page, 'forced');
    await page.locator('#noThanksExplainBtn').tap();
    await swipe(page, page.locator('#noThanksPass'));
    assert.equal(await page.locator('#noThanksExplainBtn').getAttribute('aria-pressed'), 'true');
    assert.equal(await page.locator('#noThanksDialog').evaluate(el => el.open), false);
    await page.keyboard.press('Escape');
    await render(page, 'playing');
    await page.locator('.no-thanks-player').last().scrollIntoViewIfNeeded();
    assert.equal(await page.locator('#roomControlsPanel').evaluate(el => getComputedStyle(el).position), 'fixed');
    const docked = await page.locator('#noThanksExplainBtn').boundingBox();
    assert(docked.y >= 0 && docked.y + docked.height < 100, 'Explain stays in the fixed mobile Room Controls bar when scrolling');
    await pointClick(page, page.locator('#noThanksPot'), true);
    assert.equal(await page.locator('#noThanksTooltip').isVisible(), true);
    assert.match(await page.locator('#noThanksTooltip').textContent(), /Pot/);
    await pointClick(page, page.locator('#noThanksRemaining'), true);
    assert.match(await page.locator('#noThanksTooltip').textContent(), /Deck/);
    await page.waitForTimeout(3200);
    assert.equal(await page.locator('#noThanksTooltip').isVisible(), false);
    await render(page, 'forced');
    await page.locator('#noThanksExplainBtn').tap();
    await pointClick(page, page.locator('#noThanksPass'), true);
    assert.match(await page.locator('#noThanksDialogBody').textContent(), /没有筹码/);
    await page.locator('#noThanksDialogClose').tap();

    await page.locator('#noThanksExplainBtn').tap();
    const collapsed = await page.locator('#roomControlsPanel').evaluate(el => el.classList.contains('collapsed'));
    await page.locator('#roomControlsToggleBtn').tap();
    assert.equal(await page.locator('#roomControlsPanel').evaluate(el => el.classList.contains('collapsed')), collapsed);
    await page.locator('#noThanksExplainBtn').tap();
    assert.equal(await page.locator('#noThanksExplainBtn').getAttribute('aria-pressed'), 'false');

    await page.setViewportSize({width: 1440, height: 1000});
    await page.locator('#noThanksRemaining').hover();
    assert.equal(await page.locator('#noThanksTooltip').isVisible(), true);
    assert.match(await page.locator('#noThanksTooltip').textContent(), /Deck/);
    await page.locator('#noThanksExplainBtn').click();
    await page.locator('#noThanksRemaining').focus();
    await page.keyboard.press('Enter');
    assert.match(await page.locator('#noThanksDialogTitle').textContent(), /Deck/);
    await page.keyboard.press('Escape');
    assert.equal(await page.locator('#noThanksRemaining').evaluate(el => document.activeElement === el), true);
    await page.setViewportSize({width: 390, height: 950});

    await page.evaluate(() => {
      setGamePanelVisibility('poison');
    });
    assert.notEqual(await page.locator('.game-panel').getAttribute('data-game-theme'), 'no_thanks');
    assert.equal(await page.locator('#roomControlsPanel').evaluate(el => el.classList.contains('no-thanks-turn')), false);
    assert.equal(await page.locator('#noThanksTooltip').isVisible(), false);
    assert.equal(await page.locator('#noThanksConfigBox').isVisible(), false);
    assert.equal(await page.locator('#noThanksDialog').evaluate(el => el.open), false);
    assert.equal(await page.locator('#noThanksHeaderActions').isVisible(), false);
    assert.equal(await page.locator('#noThanksExplainBtn').isVisible(), false);
    assert.equal(await page.locator('#mobileExplainSlot #noThanksExplainBtn').count(), 0);

    // Enter another actual game, then leave it. The old Explain button must not linger.
    await page.evaluate(() => socket.emit('room:create', {name: 'Header switch QA', game_type: 'poison'}));
    await page.waitForFunction(() => currentGameType === 'poison' && isGameAssetsLoaded('poison'));
    await page.waitForFunction(() => document.getElementById('mobileExplainSlot').querySelector('#poisonExplainBtn'));
    assert.equal(await page.locator('#noThanksHelpBtn').isVisible(), false);
    assert.equal(await page.locator('#noThanksExplainBtn').isVisible(), false);
    await page.evaluate(() => setRoomControlsCollapsed(false));
    await page.locator('#leaveBtn').click();
    await page.waitForFunction(() => !roomId);
    assert.equal(await page.locator('#mobileExplainSlot button').count(), 0);
    assert.deepEqual(errors, []);
    console.log(`No Thanks! browser checks passed; screenshots in ${output}`);
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exit(1); });
