// Run against a local server with a current Node and Playwright installation.
const {chromium} = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const {execFileSync} = require('node:child_process');
const base = process.env.ROOM_TEST_URL || 'http://127.0.0.1:8774';
const output = 'tmp/challengers-ui';
fs.mkdirSync(output, {recursive: true});
const fixtures = JSON.parse(execFileSync(process.env.PYTHON || 'python', ['-c', `
import json
from tests.test_challengers import new_game, battlefield, act
from game.challengers import ChallengersGame as G
s=new_game(8,seed=124,exclude_set='castle')
views={'draft':G.get_public_view(s,'p0')}
while s['players']['p0']['stage']!='trim':
 a=G.bot_move(s,'p0'); _,error=G.apply_action(s,'p0',a); assert not error,error
views['trim']=G.get_public_view(s,'p0')
s=battlefield({'draw':['juggler','cat','pig','pony','dog'],'bench':['talent','skeleton','ai']},{'field':['dragon'],'draw':['horse','dog'],'bench':['blacksmith','cat','pig','pony','parrot','spider']})
views['match']=G.get_public_view(s,'p0')
act(s,'p0','reveal'); views['choice']=G.get_public_view(s,'p0')
s=new_game(4)
while s['phase']!='round_end':
 for pid in s['order']:
  if s['phase']=='round_end': break
  a=G.bot_move(s,pid)
  if a:
   _,error=G.apply_action(s,pid,a); assert not error,error
views['review']=G.get_public_view(s,'p0')
views['spectator']=G.get_public_view(s,'visitor')
s=battlefield({'draw':['horse']},{'field':['champion']})
s['players']['p0']['fans']=10
act(s,'p0','reveal'); views['game_over']=G.get_public_view(s,'p0')
print(json.dumps(views))
`], {encoding: 'utf8', maxBuffer: 8 * 1024 * 1024}));

const control = (page, action) => page.locator(`#challengersPanel [data-ch-action="${action}"]`);
async function setup(page) {
  await page.route('https://fonts.googleapis.com/**', route => route.abort());
  await page.goto(base);
  await page.waitForFunction(() => typeof socket !== 'undefined' && socket.connected && cachedGameList);
}
async function render(page, key) {
  await page.evaluate(view => {
    clearChallengersState();
    playerId = view.you;
    roomSessionReady = true;
    renderRoomState({room_id: 'challengers-layout', game_type: 'challengers', status: 'in_game', host_id: 'p0', players: view.players, game_config: {}});
    setGamePanelVisibility('challengers');
    renderGameState({room_id: 'challengers-layout', game_type: 'challengers', view});
    syncRoomControlsExplainButton();
    window.challengersTestActions = [];
    window.scrollTo(0, 0);
  }, fixtures[key]);
  await page.locator('.ch-hero').waitFor({state: 'visible'});
}
async function bounds(page, label) {
  const issues = await page.evaluate(() => {
    const bad = [...document.querySelectorAll('#challengersPanel *, #challengersDialog[open] *')].filter(el => {
      const box = el.getBoundingClientRect();
      if (!box.width || !box.height || getComputedStyle(el).display === 'none') return false;
      return box.left < -1 || box.right > innerWidth + 1 ||
        (el.clientWidth && el.scrollWidth > el.clientWidth + 1 && !['auto', 'hidden', 'scroll'].includes(getComputedStyle(el).overflowX));
    }).map(el => `${el.className || el.id}: ${el.textContent.slice(0, 45)}`);
    return {pageOverflow: document.documentElement.scrollWidth > innerWidth, bad};
  });
  assert.deepEqual(issues, {pageOverflow: false, bad: []}, label);
}

(async () => {
  const browser = await chromium.launch({channel: process.env.BROWSER_CHANNEL || 'chrome', headless: true});
  const errors = [];
  try {
    const live = await browser.newPage({viewport: {width: 1366, height: 1000}});
    live.on('pageerror', error => errors.push(error.message));
    await setup(live);
    assert.equal(await live.locator('script[src*="games/challengers.js"]').count(), 0, 'Assets are deferred');
    await live.evaluate(() => socket.emit('room:create', {name: '林间队长', game_type: 'challengers', config: {seed: 124, exclude_set: 'castle'}}));
    await live.waitForFunction(() => currentGameType === 'challengers' && roomSessionReady && isGameAssetsLoaded('challengers'));
    await live.locator('#challengersConfigBox').waitFor({state: 'visible'});
    await live.evaluate(() => socket.emit('room:add_bot', {room_id: roomId}));
    await live.waitForFunction(() => currentRoomState.players.length === 2);
    await live.evaluate(() => { socket.emit('room:ready', {room_id: roomId, ready: true}); });
    await live.waitForFunction(() => currentRoomState.players.every(p => p.ready));
    await live.evaluate(() => emitRoomStart());
    await live.waitForFunction(() => lastGameStatePayload?.view?.game_id === 'challengers');
    await live.locator('.ch-card[data-ch-card]').first().click();
    await control(live, 'pick').click();
    await live.waitForFunction(() => lastGameStatePayload.view.picks_left < 2 || lastGameStatePayload.view.choice);
    // Complete one actual round through the controls, including bot dispatch.
    for (let i = 0; i < 180; i++) {
      const state = await live.evaluate(() => ({phase: lastGameStatePayload.view.phase, legal: lastGameStatePayload.view.legal_actions, choice: lastGameStatePayload.view.choice, revision: lastGameStatePayload.view.revision, over: lastGameStatePayload.view.game_over}));
      if (state.phase === 'round_end' || state.over) break;
      if (!state.legal.length) {
        await live.waitForFunction(() => lastGameStatePayload.view.legal_actions.length || lastGameStatePayload.view.game_over, {timeout: 15000});
        continue;
      }
      const type = state.legal[0];
      if (type === 'pick') { await live.locator('.ch-card[data-ch-card]').first().click(); await control(live, 'pick').click(); }
      if (type === 'choose_level') await control(live, 'level').first().click();
      if (type === 'ready') await control(live, 'ready').click();
      if (type === 'reveal') await control(live, 'reveal').click();
      if (type === 'resolve') {
        if (state.choice.optional || state.choice.min === 0) await control(live, 'skip').click();
        else {
          for (let j = 0; j < state.choice.min; j++) await live.locator('.ch-card[data-ch-card]').nth(j).click();
          await control(live, 'resolve').click();
        }
      }
      await live.waitForFunction(rev => lastGameStatePayload.view.revision !== rev || lastGameStatePayload.view.game_over, state.revision);
    }
    assert.equal(await live.evaluate(() => lastGameStatePayload.view.phase), 'round_end');
    await live.screenshot({path: `${output}/live-round-review.png`, fullPage: true});
    await live.waitForFunction(() => lastGameStatePayload.view.next_ready.length === 1);
    assert.equal(await live.evaluate(() => lastGameStatePayload.view.round), 1, 'Bot does not acknowledge for human');
    await control(live, 'next').click();
    await live.waitForFunction(() => lastGameStatePayload.view.round === 2);
    console.log('PASS real room: lazy assets, config, human + AI, card actions, round barrier');

    const page = await browser.newPage({viewport: {width: 1280, height: 900}});
    page.on('pageerror', error => errors.push(error.message));
    await setup(page);
    await page.evaluate(async () => { socket.disconnect(); await ensureGameAssets('challengers'); sendAction = action => challengersTestActions.push(action); });
    for (const width of [320, 360, 393, 768, 1024, 1440]) {
      await page.setViewportSize({width, height: 900});
      for (const key of Object.keys(fixtures)) { await render(page, key); await bounds(page, `${width}px ${key}`); }
    }
    console.log('PASS 42 responsive layouts');
    await page.setViewportSize({width: 1440, height: 1100});
    await render(page, 'draft');
    await page.screenshot({path: `${output}/desktop-draft.png`, fullPage: true});
    await render(page, 'match');
    await page.screenshot({path: `${output}/desktop-match.png`, fullPage: true});
    await page.locator('#challengersHelpBtn').click();
    await page.locator('#challengersDialog[open]').waitFor();
    assert.match(await page.locator('#challengersDialogBody').textContent(), /11/);
    await bounds(page, 'Help');
    await page.keyboard.press('Escape');
    await render(page, 'draft');
    assert.equal(await control(page, 'pick').isDisabled(), true);
    await page.locator('#challengersExplainBtn').click();
    const disabled = await control(page, 'pick').boundingBox();
    await page.mouse.click(disabled.x + disabled.width / 2, disabled.y + disabled.height / 2);
    await page.locator('#challengersDialog[open]').waitFor();
    assert.match(await page.locator('#challengersDialogBody').textContent(), /Pick/);
    assert.equal(await page.evaluate(() => challengersTestActions.length), 0);
    await page.keyboard.press('Escape');
    await page.locator('.ch-card[data-ch-card]').first().click();
    assert.equal(await control(page, 'pick').isEnabled(), true);
    await page.keyboard.press('Escape');
    assert.equal(await control(page, 'pick').isDisabled(), true);
    await render(page, 'choice');
    for (let i = 2; i >= 0; i--) await page.locator('.ch-card[data-ch-card]').nth(i).click();
    await control(page, 'resolve').click();
    const sent = await page.evaluate(() => challengersTestActions);
    assert.deepEqual(sent[0].card_ids, fixtures.choice.choice.cards.map(c => c.id).reverse());
    console.log('PASS Help, Escape, disabled Explain, selection and ordered effect payload');

    const mobile = await browser.newPage({viewport: {width: 393, height: 852}, isMobile: true, hasTouch: true});
    mobile.on('pageerror', error => errors.push(error.message));
    await setup(mobile);
    await mobile.evaluate(async () => { socket.disconnect(); await ensureGameAssets('challengers'); sendAction = action => challengersTestActions.push(action); });
    await render(mobile, 'match');
    await mobile.screenshot({path: `${output}/mobile-match.png`, fullPage: true});
    await mobile.locator('.ch-player-stats [data-ch-tip]').first().tap();
    await mobile.locator('#challengersTip').waitFor({state: 'visible'});
    await mobile.locator('#challengersTip').waitFor({state: 'hidden', timeout: 4000});
    await render(mobile, 'draft');
    await mobile.screenshot({path: `${output}/mobile-draft.png`, fullPage: true});
    await mobile.locator('.ch-card[data-ch-card]').first().tap();
    await bounds(mobile, 'Mobile selection');
    await control(mobile, 'pick').tap();
    assert.equal(await mobile.evaluate(() => challengersTestActions[0].type), 'pick');
    assert.deepEqual(errors, []);
    console.log('PASS touch controls, tooltip expiry, and zero browser errors');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
