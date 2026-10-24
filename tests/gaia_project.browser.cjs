// Run against uvicorn; override ROOM_TEST_URL, PLAYWRIGHT_MODULE, PYTHON as needed.
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { execFileSync } = require('node:child_process');
const base = process.env.ROOM_TEST_URL || 'http://127.0.0.1:8767';
const output = 'build/gaia-project-ui';
fs.mkdirSync(output, { recursive: true });
const views = JSON.parse(execFileSync(process.env.PYTHON || 'python3', ['-c', `
import json
from game.gaia_project import GaiaProjectGame as G, _actor
players=[dict(player_id=c, name=n, seat=i) for i,(c,n) in enumerate([('a','Ada Lovelace'),('b','Bot Taklons'),('c','Carmen'),('d','Dmitri')])]
s=G.init_game({'seed': 7}, players)
s['player_meta']['b']['is_bot']=True
for pid,f in zip(s['seat_order'],['terrans','taklons','xenos','ivits']):
    assert G.apply_action(s,pid,{'type':'choose_faction','faction':f})[1] is None
v={'faction':G.get_public_view(s,'a')}
steps=0
while not s['game_over'] and steps<600:
    pid=_actor(s)
    if s['phase']=='booster' and 'booster' not in v:
        v['booster']=G.get_public_view(s,pid)
        v['booster_waiting']=G.get_public_view(s,'a')
    if s['phase']=='round_end':
        for p in s['seat_order']:
            if p not in s['ready']:
                G.apply_action(s,p,{'type':'next_round'})
        steps+=1
        continue
    a=G.bot_move(s,pid)
    if a is None: break
    err=G.apply_action(s,pid,a)[1]
    assert err is None,(a,err)
    steps+=1
    if s['round']==2 and s['phase']=='action' and 'action' not in v and s['current_turn']=='a' and not s['pending']:
        v['action']=G.get_public_view(s,'a')
        v['waiting']=G.get_public_view(s,'c')
    if s['round']==4 and s['phase']=='action' and 'late' not in v and s['current_turn']=='a' and not s['pending']:
        v['late']=G.get_public_view(s,'a')
v['over']=G.get_public_view(s,'a')
print(json.dumps(v))
`], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }));

async function bounds(page, label) {
  const result = await page.evaluate(() => {
    const bad = [...document.querySelectorAll('#gaiaProjectPanel *')].filter(el => {
      if (el.closest('svg')) return false;
      const r = el.getBoundingClientRect();
      const style = getComputedStyle(el);
      if (!r.width || !r.height) return false;
      if (r.left < -1 || r.right > innerWidth + 1) return true;
      return el.clientWidth && el.scrollWidth > el.clientWidth + 1 && !['hidden', 'auto', 'scroll'].includes(style.overflowX);
    }).map(el => `${el.tagName}.${el.className}: ${el.textContent.slice(0, 50)} right=${Math.round(el.getBoundingClientRect().right)} client=${el.clientWidth} scroll=${el.scrollWidth}`);
    return { width: innerWidth, scroll: document.documentElement.scrollWidth, bad };
  });
  assert(result.scroll <= result.width, `${label}: page overflow ${JSON.stringify(result)}`);
  assert.deepEqual(result.bad, [], `${label}: container overflow`);
}
async function render(page, key, tab) {
  await page.evaluate(([view, tab]) => {
    currentGameType = 'gaia_project';
    setGamePanelVisibility('gaia_project');
    renderGaiaProjectGameState({room_id: roomId, state_version: Math.random(), view});
    if (tab) document.querySelector(`[data-gaia-tab="${tab}"]`).click();
  }, [views[key], tab || '']);
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
    await page.evaluate(() => socket.emit('room:create', {name: 'Gaia QA', game_type: 'gaia_project'}));
    await page.waitForFunction(() => currentGameType === 'gaia_project' && isGameAssetsLoaded('gaia_project'));
    await page.evaluate(() => { window.gaiaTestActions = []; sendAction = action => gaiaTestActions.push(action); });

    for (const width of [1440, 1024, 390, 320]) {
      await page.setViewportSize({width, height: width > 600 ? 1000 : 844});
      await page.evaluate(() => { if (typeof setRoomControlsCollapsed === 'function') setRoomControlsCollapsed(true); });
      await page.waitForFunction(() => !document.body.classList.contains('room-controls-drawer-open'));
      if (width === 1440) {
        await render(page, 'booster', '');
        await bounds(page, `${width} booster floating`);
        await page.locator('#gaiaProjectPanel').screenshot({path: `${output}/${width}-booster-floating.png`});
        assert.equal(await page.locator('.gaia-booster-layer-floating').count(), 1);
        assert.equal(await page.locator('.gaia-booster-card').count(), views.booster.options.filter(o => o.action.type === 'choose_booster').length);
        assert.equal(await page.locator('.gaia-controls').count(), 0);
        await page.locator('[data-gaia-command="booster-help"]').click();
        assert.equal(await page.locator('.gaia-modal').count(), 1);
        await page.keyboard.press('Escape');
        assert.equal(await page.locator('.gaia-modal').count(), 0);
        assert.equal(await page.locator('.gaia-booster-layer-floating').count(), 1);
        await page.locator('[data-gaia-command="booster-explain"]').click();
        assert.equal(await page.locator('#gaiaProjectPanel.gaia-explaining').count(), 1);
        await page.keyboard.press('Escape');
        assert.equal(await page.locator('#gaiaProjectPanel.gaia-explaining').count(), 0);
        const firstBooster = page.locator('.gaia-booster-card').first();
        const firstBoosterId = await firstBooster.getAttribute('data-gaia-booster');
        await firstBooster.click();
        assert.equal(await page.locator('.gaia-booster-card.selected').getAttribute('data-gaia-booster'), firstBoosterId);
        assert.equal(await page.locator('[data-gaia-command="confirm-booster"]').count(), 1);
        await page.locator('[data-gaia-command="toggle-booster-dock"]').click();
        await bounds(page, `${width} booster docked`);
        await page.locator('#gaiaProjectPanel').screenshot({path: `${output}/${width}-booster-docked.png`});
        assert.equal(await page.locator('.gaia-booster-layer-docked').count(), 1);
        assert.equal(await page.locator('.gaia-booster-grid').count(), 0);
        await page.locator('[data-gaia-tab="research"]').click();
        assert.equal(await page.locator('.gaia-tabs [data-gaia-tab="research"].active').count(), 1);
        await page.locator('[data-gaia-command="toggle-booster-dock"]').click();
        assert.equal(await page.locator('.gaia-booster-layer-floating').count(), 1);
        assert.equal(await page.locator('.gaia-booster-card.selected').getAttribute('data-gaia-booster'), firstBoosterId);
        await page.locator('[data-gaia-command="confirm-booster"]').click();
        assert.deepEqual(await page.evaluate(() => gaiaTestActions.pop()), {type: 'choose_booster', booster: firstBoosterId});
        await render(page, 'booster_waiting', '');
        assert.equal(await page.locator('.gaia-booster-layer').count(), 0);
        await page.keyboard.press('Escape');
      } else {
        await render(page, 'booster', '');
        await bounds(page, `${width} booster floating`);
        await page.locator('#gaiaProjectPanel').screenshot({path: `${output}/${width}-booster.png`});
        if (width === 390) {
          await page.locator('.gaia-booster-card').first().evaluate(card => {
            const init = {bubbles: true, isPrimary: true, button: 0, pointerId: 91, pointerType: 'touch', clientX: 20, clientY: 20};
            card.dispatchEvent(new PointerEvent('pointerdown', init));
            card.dispatchEvent(new PointerEvent('pointermove', {...init, clientX: 20, clientY: 60}));
            card.dispatchEvent(new PointerEvent('pointerup', {...init, clientX: 20, clientY: 60}));
            card.dispatchEvent(new MouseEvent('click', {bubbles: true, detail: 1}));
          });
          assert.equal(await page.locator('.gaia-booster-card.selected').count(), 0);
        }
        await page.keyboard.press('Escape');
        await bounds(page, `${width} booster docked by escape`);
        assert.equal(await page.locator('.gaia-booster-layer-docked').count(), 1);
      }
      for (const [key, tab] of [['action', 'galaxy'], ['action', 'research'], ['action', 'technology'], ['action', 'players'], ['late', 'galaxy'], ['over', 'players']]) {
        await render(page, key, tab);
        await bounds(page, `${width} ${key} ${tab}`);
        if (tab === 'players') {
          const players = views[key].players.length;
          assert.equal(await page.locator('.gaia-player-board').count(), players);
          assert.equal(await page.locator('.gaia-building-group-iii').count(), players);
          assert.equal(await page.locator('.gaia-dashboard .gaia-income-total').count(), 1);
          assert.equal(await page.locator('.gaia-player-card-self .gaia-income-panel').count(), 0);
          assert.equal(await page.locator('.gaia-dashboard .gaia-status-booster').count(), 1);
          assert.equal(await page.locator('.gaia-dashboard .gaia-status-federations').count(), 1);
          assert.equal(await page.locator('.gaia-dashboard .gaia-status-tech').count(), 1);
          assert.equal(await page.locator('.gaia-player-card-self .gaia-status-item').count(), 0);
          assert.equal(await page.locator('.gaia-building-ability').count(), players * 3);
        }
        await page.locator('#gaiaProjectPanel').screenshot({path: `${output}/${width}-${key}-${tab}.png`});
      }
      // Confirm card with cost tokens: pick the first legal planet option.
      await render(page, 'action', 'galaxy');
      const legal = await page.locator('.gaia-hex.available').first();
      if (await legal.count()) {
        await legal.evaluate(el => el.dispatchEvent(new MouseEvent('click', {bubbles: true})));
        const option = page.locator('.gaia-controls [data-gaia-option]').first();
        if (await option.count()) {
          await option.click();
          await bounds(page, `${width} confirm`);
          await page.locator('.gaia-controls').screenshot({path: `${output}/${width}-confirm.png`});
        }
      }
      await page.keyboard.press('Escape');
      // Federation builder: shows token radios.
      await render(page, 'late', 'galaxy');
      const fed = page.locator('.gaia-federation-button');
      if (await fed.count()) {
        await fed.click();
        await bounds(page, `${width} federation`);
        await page.locator('.gaia-controls').screenshot({path: `${output}/${width}-federation.png`});
        await page.keyboard.press('Escape');
      }
      await page.locator('#gaiaProjectHelpBtn').click();
      await page.locator('.gaia-dialog').screenshot({path: `${output}/${width}-help.png`});
      await page.keyboard.press('Escape');
      assert.equal(await page.locator('.gaia-modal').count(), 0);
    }
    // Free-action conversions render as token → token rows.
    await render(page, 'action', 'galaxy');
    await page.locator('.gaia-action-group summary', {hasText: 'Free Actions'}).click();
    await page.locator('.gaia-controls').screenshot({path: `${output}/1440-free-actions.png`});
    assert((await page.locator('.gaia-action-group .gaia-option .gaia-tk').count()) > 0);
    // Hover hint shows the token name with the physical description.
    await page.setViewportSize({width: 1440, height: 1000});
    await render(page, 'action', 'galaxy');
    await page.locator('.gaia-dashboard-resources [data-gaia-hint-key="credits"]').first().hover();
    await page.waitForSelector('#gaiaInlineHint');
    assert.match(await page.locator('#gaiaInlineHint').textContent(), /信用点 · 黄色圆片/);
    assert.equal(await page.evaluate(() => gaiaTestActions.length), 0);
    assert.deepEqual(errors, []);
    console.log('gaia_project browser checks passed');
  } finally {
    await browser.close();
  }
})();
