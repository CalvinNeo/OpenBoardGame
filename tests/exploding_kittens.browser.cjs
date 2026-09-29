// Run against uvicorn, e.g. ROOM_TEST_URL=http://127.0.0.1:8145.
const {chromium} = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const {execFileSync} = require('node:child_process');
const base = process.env.ROOM_TEST_URL || 'http://127.0.0.1:8145';
const output = 'build/exploding-kittens-ui';
fs.mkdirSync(output, {recursive: true});
const fixtures = JSON.parse(execFileSync(process.env.PYTHON || 'python3', ['-c', `
import copy,json,importlib.util,sys
# UI fixtures depend only on this game, not other games' optional assets/imports.
spec=importlib.util.spec_from_file_location('game.exploding_kittens','game/exploding_kittens.py')
module=importlib.util.module_from_spec(spec)
sys.modules[spec.name]=module
spec.loader.exec_module(module)
from tests.test_exploding_kittens import make_state,cards,apply,play,settle
from game.exploding_kittens import ExplodingKittensGame as G
s=make_state(5)
s['players']['p0']['hand']=cards('attack','skip','favor','shuffle','see_future','defuse','nope',*(['tacocat']*3),*(['beard_cat']*3),*(['rainbow_cat']*3),*(['cattermelon']*3),*(['hairy_potato_cat']*3))
s['player_meta']['p1']['name']='VeryLongUnbrokenPlayerNameToCheckContainerOverflow'
s['player_meta']['p2']['name']='名字很长的玩家用于检查移动屏幕换行'
s['discard']=cards('skip','favor','nope')
v={'playing':G.get_public_view(s,'p0'),'waiting':G.get_public_view(s,'p1'),'spectator':G.get_public_view(s,'guest')}
play(s,'p0','attack')
v['reaction']=G.get_public_view(s,'p1')
v['reaction_nope']=G.get_public_view(s,'p0')
s=make_state(3)
s['players']['p0']['hand']=cards('see_future','defuse')
s['deck']=cards('exploding_kitten','attack','skip')
play(s,'p0','see_future');settle(s)
v['future']=G.get_public_view(s,'p0')
apply(s,'p0','continue');apply(s,'p0','draw')
v['defuse']=G.get_public_view(s,'p0')
apply(s,'p0','defuse')
v['reinsert']=G.get_public_view(s,'p0')
s=make_state(3)
s['players']['p0']['hand']=cards('favor')
play(s,'p0','favor',target_id='p1');settle(s)
v['favor']=G.get_public_view(s,'p1')
s=make_state(3)
s['players']['p0']['hand']=[]
s['deck']=cards('exploding_kitten','exploding_kitten')
apply(s,'p0','draw')
v['review']=G.get_public_view(s,'p0')
for p in s['turn_order']:apply(s,p,'next_round')
s['players']['p1']['hand']=[]
apply(s,'p1','draw')
v['finished']=G.get_public_view(s,'p2')
print(json.dumps(v))
`], {encoding: 'utf8', env: {...process.env, PYTHONDONTWRITEBYTECODE: '1'}}));

async function bounds(page, label) {
  const result = await page.evaluate(() => {
    const bad = [...document.querySelectorAll('#explodingKittensPanel *, #explodingKittensDialog *')].filter(el => {
      const r = el.getBoundingClientRect(), style = getComputedStyle(el);
      return r.width && r.height && (r.left < -1 || r.right > innerWidth + 1 ||
        (el.clientWidth && el.scrollWidth > el.clientWidth + 1 && !['hidden', 'auto', 'scroll'].includes(style.overflowX)));
    }).map(el => `${el.id || el.className}: ${el.textContent.slice(0, 60)} (${el.clientWidth}/${el.scrollWidth})`);
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
async function render(page, key) {
  await page.evaluate(view => renderExplodingKittensGameState({room_id: roomId, game_type: 'exploding_kittens', view}), fixtures[key]);
}

(async () => {
  const browser = await chromium.launch({channel: process.env.BROWSER_CHANNEL || 'chrome', headless: true});
  const errors = [], contexts = [], pages = [];
  try {
    for (let i = 0; i < 3; i++) {
      const context = await browser.newContext({viewport: {width: 1440, height: 1100}, hasTouch: true});
      const page = await context.newPage();
      contexts.push(context); pages.push(page);
      page.on('pageerror', error => errors.push(error.message));
      await page.route('https://fonts.googleapis.com/**', route => route.abort());
      await page.goto(base);
      await page.waitForFunction(() => typeof socket !== 'undefined' && socket.connected && cachedGameList);
    }
    const page = pages[0];
    assert.equal(await page.locator('#explodingKittensPanel').evaluate(el => el.children.length), 0);
    assert.equal(await page.locator('script[src*="games/exploding_kittens.js"]').count(), 0);
    await page.evaluate(() => socket.emit('room:create', {name: 'Calvin', game_type: 'exploding_kittens', config: {seed: 145}}));
    await page.waitForFunction(() => currentGameType === 'exploding_kittens' && isGameAssetsLoaded('exploding_kittens'));
    const room = await page.evaluate(() => roomId);
    for (let i = 1; i < 3; i++) {
      await pages[i].evaluate(({room, i}) => socket.emit('room:join', {room_id: room, name: ['Calvin', 'Mochi', 'Luna'][i]}), {room, i});
      await pages[i].waitForFunction(() => isGameAssetsLoaded('exploding_kittens'));
    }
    for (const p of pages) await p.evaluate(() => socket.emit('room:ready', {ready: true}));
    await page.waitForFunction(() => currentRoomState.players.length === 3 && currentRoomState.players.every(p => p.ready));
    await page.locator('#startBtn').click();
    for (const p of pages) await p.waitForFunction(() => lastGameStatePayload?.view.game_id === 'exploding_kittens');
    const ids = await Promise.all(pages.map(p => p.evaluate(() => playerId)));
    let actor = await page.evaluate(() => lastGameStatePayload.view.current_turn);
    let active = pages[ids.indexOf(actor)];
    const kind = await active.evaluate(() => lastGameStatePayload.view.hand.find(c => ['attack','skip','shuffle','see_future'].includes(c.kind))?.kind);
    assert(kind, 'seed should provide an action card');
    await active.locator(`#ekHand [data-kind="${kind}"]`).first().click();
    await active.locator('#ekPlay').click();
    await page.waitForFunction(() => lastGameStatePayload.view.phase === 'reaction');
    for (const p of pages) if (await p.locator('#ekPass').isEnabled()) await p.locator('#ekPass').click();
    await page.waitForFunction(() => lastGameStatePayload.view.phase !== 'reaction');
    if (await active.locator('#ekContinue').isVisible()) await active.locator('#ekContinue').click();
    const saved = await page.evaluate(() => ({room: roomId, player: playerId, revision: lastGameStatePayload.view.revision}));
    await page.reload();
    await page.waitForFunction(saved => isGameAssetsLoaded('exploding_kittens') && roomId === saved.room && playerId === saved.player && lastGameStatePayload?.view.revision === saved.revision, saved);
    // Finish a genuine multiplayer game through the rendered controls.
    for (let step = 0; step < 240; step++) {
      const state = await page.evaluate(() => ({phase: lastGameStatePayload.view.phase, turn: lastGameStatePayload.view.current_turn, revision: lastGameStatePayload.view.revision}));
      if (state.phase === 'game_over') break;
      if (state.phase === 'elimination_review') {
        for (const p of pages) if (await p.locator('#ekNext').isEnabled()) await p.locator('#ekNext').click();
      } else {
        active = pages[ids.indexOf(state.turn)];
        const id = {playing: 'ekDraw', defuse: 'ekDefuse', reinsert: 'ekReinsert', future: 'ekContinue'}[state.phase];
        assert(id, `unexpected real phase: ${state.phase}`);
        await active.locator(`#${id}`).click();
      }
      await page.waitForFunction(revision => lastGameStatePayload.view.revision > revision, state.revision);
    }
    assert.equal(await page.evaluate(() => lastGameStatePayload.view.game_over), true);
    console.log('PASS: real multiplayer play, reactions, full game, elimination review, reconnect');

    // Deterministic rendering fixtures for rare phases and worst-case layout.
    await page.evaluate(() => {window.ekTestActions = []; window.sendAction = action => window.ekTestActions.push(action);});
    await render(page, 'playing');
    await page.evaluate(() => document.getElementById('roomControlsPanel').classList.add('collapsed'));
    assert.equal(await page.locator('#roomControlsPanel').evaluate(el => getComputedStyle(el).borderTopColor), 'rgb(201, 67, 51)');
    await page.locator('#explodingKittensHelpBtn').click();
    assert(await page.locator('#ekDialogBody').innerText().then(text => text.includes('Defuse（🧯）')));
    await bounds(page, 'desktop help');
    await page.keyboard.press('Escape');
    assert.equal(await page.locator('#explodingKittensDialog').evaluate(el => el.open), false);
    await page.locator('#explodingKittensExplainBtn').click();
    await pointClick(page, page.locator('#ekPlay'));
    assert.equal(await page.locator('#ekDialogTitle').textContent(), 'Play Selected');
    assert.equal(await page.evaluate(() => window.ekTestActions.length), 0);
    await page.keyboard.press('Escape');
    await page.locator('#ekHand [data-kind="tacocat"]').nth(0).click();
    await page.locator('#ekHand [data-kind="tacocat"]').nth(1).click();
    assert.equal(await page.locator('#ekPlay').textContent(), 'Play Pair');
    await page.locator('#ekHand [data-kind="tacocat"]').nth(2).click();
    await page.locator('#ekRequest').selectOption('defuse');
    await page.locator('#ekPlay').click();
    const submitted = await page.evaluate(() => window.ekTestActions.at(-1));
    assert.equal(submitted.card_ids.length, 3);
    assert.equal(submitted.requested_kind, 'defuse');
    assert.equal(submitted.game_token, fixtures.playing.game_token);
    await render(page, 'waiting');
    await render(page, 'playing');
    await page.locator('#ekHand [data-kind="skip"]').click();
    await page.locator('.ek-heading h2').click();
    assert.equal(await page.locator('#ekHand .is-selected').count(), 0);
    await page.locator('#ekHand [data-kind="skip"]').click();
    await page.keyboard.press('Escape');
    assert.equal(await page.locator('#ekHand .is-selected').count(), 0);
    for (const width of [1440, 390, 320]) {
      await page.setViewportSize({width, height: width === 1440 ? 1100 : 900});
      for (const key of ['playing','reaction','future','favor','defuse','reinsert','review','finished','spectator']) {
        await render(page, key);
        await bounds(page, `${width} ${key}`);
      }
      await render(page, 'playing');
      const last = page.locator('#ekHand .ek-card').last();
      await last.scrollIntoViewIfNeeded();
      const scroll = await page.locator('#ekHand').evaluate(el => el.scrollTop);
      await last.click();
      assert.equal(await page.locator('#ekHand').evaluate(el => el.scrollTop), scroll, 'selection keeps hand scroll');
      await page.keyboard.press('Escape');
      await page.locator('#ekHand').evaluate(el => {el.scrollTop = 0;});
      await page.locator('#explodingKittensPanel').screenshot({path: `${output}/${width}.png`});
      if (width < 600) {
        await pointClick(page, page.locator('#ekDebt'), true);
        assert.equal(await page.locator('#ekTooltip').isVisible(), true);
        await page.waitForTimeout(3150);
        assert.equal(await page.locator('#ekTooltip').isVisible(), false);
        await page.locator('#explodingKittensExplainBtn').click();
        await page.keyboard.press('Escape');
        assert.equal(await page.locator('#explodingKittensExplainBtn').getAttribute('aria-pressed'), 'false');
      }
    }
    assert.deepEqual(errors, []);
    console.log('PASS: Help, disabled Explain, selection/combos, Esc, touch tips, 1440/390/320px layout');
    console.log(`Screenshots: ${output}`);
  } finally {
    for (const context of contexts) await context.close();
    await browser.close();
  }
})().catch(error => {console.error(error); process.exitCode = 1;});
