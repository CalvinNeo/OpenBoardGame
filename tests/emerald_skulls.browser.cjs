// Run with a local uvicorn server and Playwright. Override ROOM_TEST_URL,
// PLAYWRIGHT_MODULE, PYTHON or BROWSER_CHANNEL for your environment.
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { execFileSync } = require('node:child_process');
const base = process.env.ROOM_TEST_URL || 'http://127.0.0.1:8765';
const output = 'tmp/emerald-skulls-ui';
fs.mkdirSync(output, { recursive: true });
const views = JSON.parse(execFileSync(process.env.PYTHON || 'python3', ['-c', `
import copy, json
from game.emerald_skulls import EmeraldSkullsGame as Game
from tests.test_emerald_skulls_game import make_players
players = make_players(6, ('p2','p3','p4','p5','p6'))
players[0]['name'] = 'AlexandertheGreatVeryLongName'
players[1]['name'] = 'Emerald Bot'
s = Game.init_game({'seed':'browser-fixtures'}, players)
s['active_player_id'] = 'p1'
s['players']['p1']['gears'] = 20
s['gear_supply'] -= 20
views = {}
def save(key, viewer='p1'):
    views[key] = Game.get_public_view(s, viewer)
save('buy')
Game.apply_action(s, 'p1', {'type':'buy_dice', 'count':7})
save('bets', 'p2')
Game.apply_action(s, 'p1', {'type':'roll'})
for die, face in zip(s['dice'], [1,1,'skull',3,4,4,5]):
    die['face'] = face
save('roll')
Game.apply_action(s, 'p1', {'type':'place_dice', 'level':1, 'die_ids':['die-1','die-2','die-3']})
save('press')
Game.apply_action(s, 'p1', {'type':'chicken_out'})
save('review')
full = copy.deepcopy(views['review'])
for die in full['dice']:
    die.update(zone='board', level=1, face=1)
full['activity'] = [{'sequence':i, 'message':'Long game log message ' + ('abcdef' * 18)} for i in range(1,101)]
views['full'] = full
over = copy.deepcopy(full)
over.update(game_over=True, phase='game_over', winner_ids=['p1'], legal_actions=['play_again'])
views['over'] = over
print(json.dumps(views))
`], { encoding: 'utf8' }));

async function render(page, key) {
  await page.evaluate(view => {
    currentGameType = 'emerald_skulls';
    setGamePanelVisibility('emerald_skulls');
    renderEmeraldSkullsGameState({ view });
  }, views[key]);
}

async function bounds(page, label) {
  const result = await page.evaluate(() => {
    const bad = [...document.querySelectorAll('#emeraldSkullsPanel *, .emerald-skulls-modal-content *')].filter(el => {
      const r = el.getBoundingClientRect();
      return r.width && r.height && (r.left < -1 || r.right > innerWidth + 1 ||
        (el.clientWidth && el.scrollWidth > el.clientWidth + 1 && !['hidden', 'auto'].includes(getComputedStyle(el).overflowX)));
    }).map(el => `${el.className || el.id}: ${el.textContent.slice(0, 60)}`);
    for (const card of document.querySelectorAll('.emerald-skulls-bet-card')) {
      const label = card.querySelector('.emerald-skulls-card-number').getBoundingClientRect();
      for (const heading of card.querySelectorAll('button strong')) {
        const r = heading.getBoundingClientRect();
        if (r.width && label.bottom > r.top && label.top < r.bottom && label.left < r.right && label.right > r.left) {
          bad.push('Card number overlaps a bet heading');
        }
      }
    }
    return { width: innerWidth, scroll: document.documentElement.scrollWidth, bad };
  });
  assert(result.scroll <= result.width, `${label}: page overflow ${JSON.stringify(result)}`);
  assert.deepEqual(result.bad, [], `${label}: container overflow`);
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
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(base);
    await page.waitForFunction(() => typeof renderEmeraldSkullsGameState === 'function');
    await page.evaluate(() => {
      window.emeraldSkullsQAActions = [];
      sendAction = action => window.emeraldSkullsQAActions.push(action);
    });
    for (const width of [320, 360, 393, 768, 1024, 1440]) {
      await page.setViewportSize({ width, height: 1000 });
      for (const key of ['buy', 'roll', 'bets', 'press', 'review', 'full', 'over']) {
        await render(page, key);
        await bounds(page, `${width}px ${key}`);
      }
    }
    console.log('PASS layout: 42 viewport/phase combinations, long names, seven dice and six players');
    await render(page, 'roll');
    const dice = page.locator('#emeraldSkullsDiceTray button');
    await dice.nth(0).click();
    await dice.nth(1).click();
    assert.equal(await page.locator('.emerald-skulls-die.is-selected').count(), 2);
    await page.locator('#emeraldSkullsSelectionHint').click();
    assert.equal(await page.locator('.emerald-skulls-die.is-selected').count(), 0);
    await dice.nth(0).click();
    await dice.nth(2).click();
    await page.locator('#emeraldSkullsBoard [data-level="1"]').click();
    assert.deepEqual(await page.evaluate(() => emeraldSkullsQAActions.pop()), { type: 'place_dice', level: 1, die_ids: ['die-1', 'die-3'] });
    await render(page, 'roll');
    await page.locator('#emeraldSkullsHelpBtn').click();
    await page.locator('#emeraldSkullsHelpModal').waitFor({ state: 'visible' });
    await bounds(page, 'Help dialog');
    await page.keyboard.press('Tab');
    assert.equal(await page.locator('#emeraldSkullsHelpCloseBtn').evaluate(el => el === document.activeElement), true);
    await page.keyboard.press('Escape');
    assert.equal(await page.locator('#emeraldSkullsHelpModal').isVisible(), false);
    await page.locator('#emeraldSkullsExplainBtn').click();
    assert.equal(await page.locator('#emeraldSkullsRerollBtn').isDisabled(), true);
    await pointClick(page, page.locator('#emeraldSkullsRerollBtn'));
    await page.locator('#emeraldSkullsExplainModal').waitFor({ state: 'visible' });
    assert.match(await page.locator('#emeraldSkullsExplainContent').textContent(), /reroll cube.*🟩/i);
    assert.equal(await page.locator('#emeraldSkullsExplainBtn').getAttribute('aria-pressed'), 'false');
    assert.equal(await page.evaluate(() => emeraldSkullsQAActions.length), 0);
    await page.locator('#emeraldSkullsExplainCloseBtn').focus();
    await page.keyboard.press('Enter');
    assert.equal(await page.locator('#emeraldSkullsExplainModal').isVisible(), false);
    await page.evaluate(() => {
      const button = document.createElement('button');
      button.id = 'emeraldSkullsUnknown';
      button.textContent = 'No explanation';
      button.onclick = () => emeraldSkullsQAActions.push('unexpected');
      document.getElementById('emeraldSkullsActionDock').appendChild(button);
    });
    await page.locator('#emeraldSkullsExplainBtn').click();
    await page.locator('#emeraldSkullsUnknown').click();
    assert.equal(await page.evaluate(() => emeraldSkullsQAActions.length), 0);
    assert.equal(await page.locator('#emeraldSkullsExplainModal').isVisible(), false);
    await page.keyboard.press('Escape');
    await page.locator('#emeraldSkullsUnknown').evaluate(el => el.remove());
    await page.locator('.emerald-skulls-player-resources span').first().hover();
    await page.locator('#emeraldSkullsTip').waitFor({ state: 'visible' });
    assert.match(await page.locator('#emeraldSkullsTip').textContent(), /Gears/);
    await page.keyboard.press('Escape');
    await page.locator('#emeraldSkullsPanel').screenshot({ path: `${output}/desktop.png` });
    console.log('PASS dice selection, Help, keyboard focus, disabled Explain and desktop tips');

    const mobileContext = await browser.newContext({ viewport: { width: 393, height: 852 }, isMobile: true, hasTouch: true });
    const mobile = await mobileContext.newPage();
    mobile.on('pageerror', error => errors.push(error.message));
    await mobile.goto(base);
    await mobile.waitForFunction(() => typeof renderEmeraldSkullsGameState === 'function');
    await mobile.evaluate(() => { window.emeraldSkullsQAActions = []; sendAction = action => emeraldSkullsQAActions.push(action); });
    await render(mobile, 'roll');
    assert.equal(await mobile.locator('#emeraldSkullsTable').isVisible(), true);
    const resources = mobile.locator('.emerald-skulls-player-resources span');
    await resources.nth(0).tap();
    assert.match(await mobile.locator('#emeraldSkullsTip').textContent(), /Gears/);
    await resources.nth(1).tap();
    assert.match(await mobile.locator('#emeraldSkullsTip').textContent(), /Reroll cubes/);
    await mobile.locator('#emeraldSkullsTip').waitFor({ state: 'hidden', timeout: 4000 });
    await mobile.locator('#emeraldSkullsPanel').screenshot({ path: `${output}/mobile-skull.png` });
    await mobile.locator('[data-emerald-skulls-tab="bets"]').tap();
    assert.equal(await mobile.locator('#emeraldSkullsTable').isVisible(), false);
    assert.equal(await mobile.locator('#emeraldSkullsBetting').isVisible(), true);
    await bounds(mobile, 'mobile bet tab');
    await mobile.locator('#emeraldSkullsPanel').screenshot({ path: `${output}/mobile-bets.png` });
    await render(mobile, 'review');
    assert.equal(await mobile.locator('#emeraldSkullsResult').isVisible(), true);
    assert.equal(await mobile.locator('#emeraldSkullsTable').isVisible(), true);
    await render(mobile, 'full');
    await mobile.locator('.emerald-skulls-log-card summary').tap();
    assert.equal(await mobile.locator('#emeraldSkullsLog').evaluate(el => el.scrollHeight > el.clientHeight), true);
    await bounds(mobile, 'full board and expanded log');
    for (const modalButton of ['Help', 'Explain']) {
      await mobile.locator(`#emeraldSkulls${modalButton}Btn`).tap();
      if (modalButton === 'Explain') await mobile.locator('#emeraldSkullsNextBtn').tap();
      await bounds(mobile, `mobile ${modalButton}`);
      await mobile.keyboard.press('Escape');
    }
    assert.deepEqual(errors, []);
    console.log('PASS mobile tabs, latest touch tip, three-second dismiss, review and scrollable log');
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
