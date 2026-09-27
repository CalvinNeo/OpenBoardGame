// Run against uvicorn; override ROOM_TEST_URL, PLAYWRIGHT_MODULE, PYTHON as needed.
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { execFileSync } = require('node:child_process');
const base = process.env.ROOM_TEST_URL || 'http://127.0.0.1:8767';
const output = 'build/hive-ui';
fs.mkdirSync(output, { recursive: true });
const views = JSON.parse(execFileSync(process.env.PYTHON || 'python', ['-c', `
import copy,json
from tests.test_hive import make_state,tactical_state,put
from game.hive import HiveGame as G,legal_moves
s=make_state()
v={'opening':G.get_public_view(s,'w')}
s=tactical_state()
s['players']['w']['name']='WillowVeryLongNameWithoutAnySpaces'
s['players']['b']['name']='Bramble AI'
put(s,'w','beetle',(0,0))
v['playing']=G.get_public_view(s,'w')
v['waiting']=G.get_public_view(s,'b')
v['spectator']=G.get_public_view(s,'visitor')
G.apply_action(s,'w',{'type':'move','piece_id':'white-ant-1','to':[1,0]})
v['over']=G.get_public_view(s,'w')
s=make_state()
for _ in range(6):
    a=next(a for a in legal_moves(s) if a.get('piece')!='queen')
    G.apply_action(s,s['current_turn'],a)
v['deadline']=G.get_public_view(s,'w')
print(json.dumps(v))
`], { encoding: 'utf8' }));

async function bounds(page, label) {
  const result = await page.evaluate(() => {
    const bad = [...document.querySelectorAll('#hivePanel *, #hiveDialog *')].filter(el => {
      if (el.closest('svg') || el.tagName === 'DIALOG') return false;
      const r = el.getBoundingClientRect();
      const style = getComputedStyle(el);
      return r.width && r.height && (r.left < -1 || r.right > innerWidth + 1 ||
        (el.clientWidth && el.scrollWidth > el.clientWidth + 1 && !['hidden', 'auto'].includes(style.overflowX)));
    }).map(el => `${el.id || el.className}: ${el.textContent.slice(0, 60)} ${JSON.stringify(el.getBoundingClientRect())} client=${el.clientWidth} scroll=${el.scrollWidth}`);
    return { width: innerWidth, scroll: document.documentElement.scrollWidth, bad };
  });
  assert(result.scroll <= result.width, `${label}: page overflow ${JSON.stringify(result)}`);
  assert.deepEqual(result.bad, [], `${label}: container overflow`);
}
async function render(page, key) {
  await page.evaluate(view => {
    currentGameType = 'hive';
    setGamePanelVisibility('hive');
    renderHiveGameState({room_id: roomId, view});
    document.getElementById('hiveFit').click();
  }, views[key]);
}
async function pointClick(page, locator) {
  await locator.scrollIntoViewIfNeeded();
  const r = await locator.boundingBox();
  await page.mouse.click(r.x + r.width / 2, r.y + r.height / 2);
}

(async () => {
  const browser = await chromium.launch({ channel: process.env.BROWSER_CHANNEL || 'chrome', headless: true });
  const errors = [];
  try {
    const context = await browser.newContext({viewport: {width: 1440, height: 1000}});
    const page = await context.newPage();
    page.on('pageerror', error => errors.push(error.message));
    await page.route('https://fonts.googleapis.com/**', route => route.abort());
    await page.goto(base);
    await page.waitForFunction(() => typeof socket !== 'undefined' && socket.connected && cachedGameList);
    assert.equal(await page.locator('#hivePanel').evaluate(el => el.children.length), 0);
    assert.equal(await page.locator('script[src*="games/hive.js"]').count(), 0);
    await page.evaluate(() => socket.emit('room:create', {name: 'Hive QA', game_type: 'hive'}));
    await page.waitForFunction(() => currentGameType === 'hive' && isGameAssetsLoaded('hive'));
    await page.locator('#hiveDifficulty').selectOption('easy');
    await page.locator('#hiveTournament').check();
    await page.evaluate(() => socket.emit('room:add_bot', {room_id: roomId}));
    await page.waitForFunction(() => currentRoomState.players.length === 2);
    await page.evaluate(() => socket.emit('room:ready', {room_id: roomId, ready: true}));
    await page.waitForFunction(() => !document.getElementById('startBtn').disabled);
    await page.locator('#startBtn').click();
    await page.waitForFunction(() => lastGameStatePayload?.game_type === 'hive');
    assert.equal(await page.evaluate(() => lastGameStatePayload.view.config.tournament_opening), true);
    assert.equal(await page.locator('[data-hive-piece="queen"]').isDisabled(), true);
    await page.locator('[data-hive-piece="spider"]').click();
    await page.locator('#hiveTiles [data-hive-cell="0,0"]').click();
    assert.equal(await page.locator('#hiveConfirm').isEnabled(), true);
    await page.locator('#hiveConfirm').click();
    await page.waitForFunction(() => lastGameStatePayload?.view.ply === 2, {timeout: 15000});
    const rid = await page.evaluate(() => roomId);
    await page.reload();
    await page.waitForFunction(() => isGameAssetsLoaded('hive') && lastGameStatePayload?.view.ply === 2);
    assert.equal(await page.evaluate(() => roomId), rid);
    assert.equal(await page.locator('#hivePanel').isVisible(), true);
    await page.evaluate(() => { window.hiveTestActions = []; sendAction = action => hiveTestActions.push(action); });
    await render(page, 'playing');
    await bounds(page, 'desktop');
    await page.locator('#hivePanel').screenshot({path: `${output}/desktop.png`});
    await page.locator('#hiveHelp').click();
    assert.equal(await page.locator('#hiveDialog').evaluate(el => el.open), true);
    assert.match(await page.locator('#hiveDialogBody').textContent(), /三次/);
    await page.keyboard.press('Escape');
    assert.equal(await page.locator('#hiveDialog').evaluate(el => el.open), false);

    // Disabled controls still explain; clicking them must never emit an action.
    await page.locator('#hiveExplain').click();
    await pointClick(page, page.locator('#hivePass'));
    assert.match(await page.locator('#hiveDialogBody').textContent(), /cannot pass voluntarily/);
    assert.equal(await page.locator('#hiveExplain').getAttribute('aria-pressed'), 'false');
    await page.locator('#hiveDialogClose').click();
    assert.equal(await page.locator('#hiveDialog').evaluate(el => el.open), false);
    assert.equal(await page.evaluate(() => hiveTestActions.length), 0);
    // Non-explainable actions (including room actions) are swallowed.
    await page.locator('#hiveExplain').click();
    await page.evaluate(() => { window.hiveUnexplained = 0; const b=document.createElement('button'); b.id='hiveProbe'; b.textContent='Probe'; b.onclick=()=>hiveUnexplained++; document.getElementById('hivePanel').append(b); });
    await page.locator('#hiveProbe').click();
    assert.equal(await page.evaluate(() => hiveUnexplained), 0);
    await page.keyboard.press('Escape');
    await page.locator('#hiveProbe').evaluate(el => el.remove());

    await render(page, 'deadline');
    assert.equal(await page.locator('[data-hive-piece="ant"]').isDisabled(), true);
    assert.equal(await page.locator('[data-hive-piece="queen"]').isEnabled(), true);
    await page.locator('[data-hive-piece="queen"]').click();
    const landing = page.locator('#hiveTiles [data-hive-cell]:has(.hive-target)').first();
    await landing.click();
    await page.keyboard.press('Escape');
    assert.equal(await page.locator('#hiveConfirm').isDisabled(), true);
    await page.locator('[data-hive-piece="queen"]').click();
    await landing.click();
    // Drag beyond the board then release; the selection must not be committed.
    const before = await page.locator('#hiveBoard').getAttribute('viewBox');
    const rect = await page.locator('#hiveBoard').boundingBox();
    await page.mouse.move(rect.x + rect.width / 2, rect.y + rect.height / 2);
    await page.mouse.down();
    await page.mouse.move(rect.x + rect.width + 30, rect.y + 30, {steps: 8});
    await page.mouse.up();
    assert.notEqual(await page.locator('#hiveBoard').getAttribute('viewBox'), before);
    assert.equal(await page.locator('#hiveBoard').evaluate(el => el.classList.contains('hive-panning')), false);
    assert.equal(await page.evaluate(() => hiveTestActions.length), 0);
    await page.locator('#hiveConfirm').click();
    assert.equal(await page.evaluate(() => hiveTestActions.length), 1);

    for (const width of [320, 393, 768, 1440]) {
      await page.setViewportSize({width, height: 900});
      for (const key of ['playing', 'spectator', 'over']) {
        await render(page, key);
        await bounds(page, `${width} ${key}`);
      }
      if (width === 393) {
        await render(page, 'playing');
        await page.screenshot({path: `${output}/mobile.png`, fullPage: true});
        await render(page, 'over');
        assert.equal(await page.locator('#hiveResult').isVisible(), true);
        assert.equal(await page.locator('#hiveTiles .hive-tile').count(), views.over.board.length);
        await page.screenshot({path: `${output}/finished.png`, fullPage: true});
        await page.locator('#hiveHelp').click();
        await bounds(page, 'mobile help');
        await page.locator('#hiveDialog').screenshot({path: `${output}/help.png`});
        await page.keyboard.press('Escape');
      }
    }

    // Real touch events: tap preview, drag within its surface, and a tooltip
    // that refreshes to the newest icon and expires after three seconds.
    const touchContext = await browser.newContext({viewport: {width: 393, height: 852}, isMobile: true, hasTouch: true});
    const touchPage = await touchContext.newPage();
    touchPage.on('pageerror', error => errors.push(error.message));
    await touchPage.route('https://fonts.googleapis.com/**', route => route.abort());
    await touchPage.goto(base);
    await touchPage.waitForFunction(() => typeof socket !== 'undefined' && socket.connected);
    await touchPage.evaluate(() => socket.emit('room:create', {name: 'Touch QA', game_type: 'hive'}));
    await touchPage.waitForFunction(() => isGameAssetsLoaded('hive'));
    await touchPage.evaluate(() => { window.hiveTestActions=[]; sendAction = action => hiveTestActions.push(action); });
    await render(touchPage, 'opening');
    await touchPage.locator('[data-hive-piece="ant"]').tap();
    await touchPage.locator('#hiveTiles [data-hive-cell="0,0"]').tap();
    assert.equal(await touchPage.locator('#hiveConfirm').isEnabled(), true);
    assert.equal(await touchPage.locator('#hiveBoard').evaluate(el => getComputedStyle(el).touchAction), 'none');
    await render(touchPage, 'spectator');
    await touchPage.locator('.hive-player-stock span').first().tap();
    assert.match(await touchPage.locator('#hiveTooltip').textContent(), /Queen Bee/);
    await touchPage.locator('.hive-player-stock span').nth(1).tap();
    assert.match(await touchPage.locator('#hiveTooltip').textContent(), /Beetle/);
    await touchPage.locator('#hiveTooltip').waitFor({state: 'hidden', timeout: 4000});
    const cdp = await touchContext.newCDPSession(touchPage);
    await touchPage.locator('#hiveBoard').scrollIntoViewIfNeeded();
    const r = await touchPage.locator('#hiveBoard').boundingBox();
    const startY = await touchPage.evaluate(() => scrollY);
    const touch = (x,y) => [{x,y,id:1}];
    await cdp.send('Input.dispatchTouchEvent', {type:'touchStart',touchPoints:touch(r.x+r.width/2,r.y+r.height/2)});
    await cdp.send('Input.dispatchTouchEvent', {type:'touchMove',touchPoints:touch(r.x+r.width/2+40,r.y+r.height/2-45)});
    await cdp.send('Input.dispatchTouchEvent', {type:'touchEnd',touchPoints:[]});
    assert.equal(await touchPage.evaluate(() => scrollY), startY);
    assert.equal(await touchPage.locator('#hiveBoard').evaluate(el => el.classList.contains('hive-panning')), false);
    assert.equal(await touchPage.evaluate(() => hiveTestActions.length), 0);
    await bounds(touchPage, 'real mobile');
    // Leaving clears old pieces, and late packets cannot restore another room.
    await touchPage.evaluate(lateView => {
      const previous = currentRoomState.room_id;
      showHiveHeaderActions(false);
      currentRoomState = {...currentRoomState, room_id: 'different-hive-room'};
      renderHiveGameState({room_id: previous, view: lateView});
    }, views.playing);
    assert.equal(await touchPage.locator('#hiveTiles .hive-tile').count(), 0);
    assert.deepEqual(errors, []);
    console.log('Hive browser checks passed: lazy loading, real bot game, reconnect, preview, Explain, desktop/mobile bounds, touch, and final board.');
  } finally { await browser.close(); }
})().catch(error => {console.error(error); process.exitCode = 1;});
