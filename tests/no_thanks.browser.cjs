// Run against uvicorn; set ROOM_TEST_URL, PLAYWRIGHT_MODULE and PYTHON if needed.
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { execFileSync } = require('node:child_process');
const base = process.env.ROOM_TEST_URL || 'http://127.0.0.1:8784';
const output = 'build/no-thanks-ui';
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
s['players']['p0']['chips']=0
v['forced']=G.get_public_view(s,'p0')
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
    const bad = [...document.querySelectorAll('#noThanksPanel *, #noThanksDialog *')].filter(el => {
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
    assert.equal(await page.locator('script[src*="games/no_thanks.js"]').count(), 0);
    await page.evaluate(() => socket.emit('room:create', {name: 'No Thanks QA', game_type: 'no_thanks'}));
    await page.waitForFunction(() => currentGameType === 'no_thanks' && isGameAssetsLoaded('no_thanks'));
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
    await page.evaluate(() => { window.noThanksTestActions = []; sendAction = action => noThanksTestActions.push(action); });

    await render(page, 'playing');
    assert.equal(await page.locator('#noThanksDelta').textContent(), '-23');
    assert.equal(await page.locator('.no-thanks-player').count(), 7);
    assert.equal(await page.locator('.no-thanks-player-scores').filter({hasText: '🔒'}).count(), 6);
    await bounds(page, 'desktop');
    await page.locator('#noThanksPanel').screenshot({path: `${output}/desktop.png`});
    await page.locator('#noThanksHelp').click();
    assert.equal(await page.locator('#noThanksDialog').evaluate(el => el.open), true);
    assert.match(await page.locator('#noThanksDialogBody').textContent(), /仍由你行动/);
    await page.keyboard.press('Escape');
    assert.equal(await page.locator('#noThanksDialog').evaluate(el => el.open), false);

    // Both live controls and disabled controls explain without submitting actions.
    await page.locator('#noThanksExplain').click();
    await page.locator('#noThanksTake').click();
    assert.match(await page.locator('#noThanksDialogBody').textContent(), /仍由你继续行动/);
    assert.equal(await page.evaluate(() => noThanksTestActions.length), 0);
    assert.equal(await page.locator('#noThanksExplain').getAttribute('aria-pressed'), 'false');
    await page.locator('#noThanksDialogClose').click();
    await render(page, 'forced');
    assert.equal(await page.locator('#noThanksPass').isDisabled(), true);
    await page.locator('#noThanksExplain').click();
    await pointClick(page, page.locator('#noThanksPass'));
    assert.match(await page.locator('#noThanksDialogBody').textContent(), /没有筹码/);
    await page.keyboard.press('Escape');
    await page.locator('#noThanksExplain').click();
    await page.evaluate(() => { window.noThanksProbeCount = 0; const button = document.createElement('button'); button.id = 'noThanksProbe'; button.textContent = 'Probe'; button.onclick = () => noThanksProbeCount++; document.getElementById('noThanksPanel').append(button); });
    await page.locator('#noThanksProbe').click();
    assert.equal(await page.evaluate(() => noThanksProbeCount), 0);
    await page.keyboard.press('Escape');
    await page.locator('#noThanksProbe').evaluate(el => el.remove());

    await render(page, 'opening');
    await page.locator('#noThanksPass').click();
    assert.deepEqual(await page.evaluate(() => noThanksTestActions), [{type: 'pass'}]);
    assert.equal(await page.locator('#noThanksTake').isDisabled(), true);
    await page.evaluate(() => socket.listeners('system:error').forEach(handler => handler({message: 'QA error recovery'})));
    assert.equal(await page.locator('#noThanksTake').isEnabled(), true);
    await page.locator('#noThanksTake').click();
    assert.deepEqual(await page.evaluate(() => noThanksTestActions), [{type: 'pass'}, {type: 'take'}]);

    await render(page, 'review');
    assert.equal(await page.locator('#noThanksReview').isVisible(), true);
    await page.locator('#noThanksNext').click();
    assert.deepEqual(await page.evaluate(() => noThanksTestActions.at(-1)), {type: 'next_round'});
    await render(page, 'ready');
    assert.equal(await page.locator('#noThanksNext').isDisabled(), true);
    assert.equal(await page.locator('#noThanksNext').textContent(), 'Ready ✓');
    await render(page, 'finished');
    assert.equal(await page.locator('#noThanksNext').isVisible(), false);
    assert.match(await page.locator('#noThanksResult').textContent(), /wins|win/);
    await page.locator('#noThanksPanel').screenshot({path: `${output}/finished.png`});

    for (const width of [320, 390, 768, 1440]) {
      await page.setViewportSize({width, height: 950});
      for (const key of ['opening', 'playing', 'waiting', 'spectator', 'review', 'ready', 'finished']) {
        await render(page, key);
        await bounds(page, `${width} ${key}`);
        if (key === 'spectator') {
          assert.equal(await page.locator('#noThanksPass').isDisabled(), true);
          assert.equal(await page.locator('#noThanksTake').isDisabled(), true);
          assert.equal(await page.locator('#noThanksYourChips').textContent(), '—');
        }
      }
      if (width <= 390) {
        await render(page, 'playing');
        await page.locator('#noThanksPanel').screenshot({path: `${output}/mobile-${width}.png`});
        await page.locator('#noThanksHelp').click();
        await bounds(page, `${width} help`);
        if (width === 390) await page.locator('#noThanksDialog').screenshot({path: `${output}/help.png`});
        await page.keyboard.press('Escape');
      }
    }
    await page.setViewportSize({width: 390, height: 950});
    await render(page, 'playing');
    await pointClick(page, page.locator('#noThanksPot'), true);
    assert.equal(await page.locator('#noThanksTooltip').isVisible(), true);
    assert.match(await page.locator('#noThanksTooltip').textContent(), /Pot/);
    await pointClick(page, page.locator('#noThanksRemaining'), true);
    assert.match(await page.locator('#noThanksTooltip').textContent(), /Deck/);
    await page.waitForTimeout(3200);
    assert.equal(await page.locator('#noThanksTooltip').isVisible(), false);
    await render(page, 'forced');
    await page.locator('#noThanksExplain').tap();
    await pointClick(page, page.locator('#noThanksPass'), true);
    assert.match(await page.locator('#noThanksDialogBody').textContent(), /没有筹码/);
    await page.locator('#noThanksDialogClose').tap();

    await page.evaluate(() => {
      setGamePanelVisibility('cabo');
    });
    assert.equal(await page.locator('#noThanksTooltip').isVisible(), false);
    assert.equal(await page.locator('#noThanksConfigBox').isVisible(), false);
    assert.equal(await page.locator('#noThanksDialog').evaluate(el => el.open), false);
    assert.deepEqual(errors, []);
    console.log(`No Thanks! browser checks passed; screenshots in ${output}`);
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exit(1); });
