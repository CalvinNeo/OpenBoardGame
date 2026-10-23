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
def act(player_id, action):
    _, error = Game.apply_action(s, player_id, action)
    assert error is None, (action, error)
save('buy')
act('p1', {'type':'buy_dice', 'count':7})
save('waiting')
save('bets', 'p2')
act('p2', {'type':'place_bet', 'bet_id':'pick_bust'})
save('bet_once', 'p2')
act('p2', {'type':'pass_bet'})
save('bet_passed', 'p2')
for player_id in Game.get_public_view(s, 'p1')['pending_bettors']:
    act(player_id, {'type':'pass_bet'})
save('await_roll')
act('p1', {'type':'roll'})
for die, face in zip(s['dice'], [1,1,'skull',3,4,4,5]):
    die['face'] = face
save('roll')
act('p1', {'type':'place_dice', 'level':1, 'die_ids':['die-1','die-2','die-3']})
save('press')
next_roll = copy.deepcopy(s)
_, error = Game.apply_action(next_roll, 'p1', {'type':'continue_roll'})
assert error is None, error
views['next_bets'] = Game.get_public_view(next_roll, 'p2')
reward_state = copy.deepcopy(next_roll)
reward_state['player_meta']['p6']['is_bot'] = False
_, error = Game.apply_action(reward_state, 'p3', {'type':'place_bet', 'bet_id':'busted_fowl'})
assert error is None, error
for player_id in Game.get_public_view(reward_state, 'p1')['pending_bettors']:
    _, error = Game.apply_action(reward_state, player_id, {'type':'pass_bet'})
    assert error is None, error
_, error = Game.apply_action(reward_state, 'p1', {'type':'roll'})
assert error is None, error
for die in reward_state['dice']:
    if die['zone'] == 'rolled':
        die['face'] = 3 if die['die_id'] == 'die-4' else 1
_, error = Game.apply_action(reward_state, 'p1', {'type':'place_dice', 'level':3, 'die_ids':['die-4']})
assert error is None, error
exhausted_state = copy.deepcopy(reward_state)
exhausted_state['players']['p1']['gears'] += exhausted_state['gear_supply'] - 3
exhausted_state['gear_supply'] = 3
_, error = Game.apply_action(exhausted_state, 'p1', {'type':'chicken_out'})
assert error is None, error
views['review_exhausted'] = Game.get_public_view(exhausted_state, 'p1')
_, error = Game.apply_action(reward_state, 'p1', {'type':'chicken_out'})
assert error is None, error
views['review_rewards'] = Game.get_public_view(reward_state, 'p1')
_, error = Game.apply_action(reward_state, 'p1', {'type':'next_turn'})
assert error is None, error
views['review_confirmed'] = Game.get_public_view(reward_state, 'p1')
act('p1', {'type':'chicken_out'})
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
    setRoomControlsCollapsed(true);
  }, views[key]);
}

async function bounds(page, label) {
  const result = await page.evaluate(() => {
    const bad = [...document.querySelectorAll('.emerald-skulls-game-panel > .panel-header *, #emeraldSkullsPanel *, .emerald-skulls-modal-content *, #emeraldSkullsTip')].filter(el => {
      if (!el.checkVisibility()) return false;
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

async function pointTap(page, locator) {
  await locator.scrollIntoViewIfNeeded();
  const box = await locator.boundingBox();
  await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
}

async function swipeUp(page, locator) {
  await locator.scrollIntoViewIfNeeded();
  const box = await locator.boundingBox();
  const clientX = box.x + box.width / 2;
  const clientY = box.y + box.height / 2;
  const touch = await page.context().newCDPSession(page);
  try {
    await touch.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: clientX, y: clientY }] });
    assert.equal(await page.locator('#emeraldSkullsTip').isVisible(), false, 'Touch down alone must not show a tooltip');
    for (const distance of [20, 40, 60, 80]) {
      await touch.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: clientX, y: clientY - distance }] });
    }
    await touch.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  } finally {
    await touch.detach();
  }
  assert.equal(await page.locator('#emeraldSkullsTip').isVisible(), false, 'Scrolling across information must not show a tooltip');
}

const reviewTipCases = [
  ['#emeraldSkullsResultTitle', /Chicken Out.*🐔/],
  ['#emeraldSkullsResultBody .is-tumbler strong', /Chicken Out.*🐔/],
  ['#emeraldSkullsResultBody .is-tumbler > span', /Gears.*⚙️.*实得.*应得.*Reroll cubes.*🟩.*1/],
  ['#emeraldSkullsResultBody .emerald-skulls-result-item:not(.is-tumbler) > span', /5\/5.*实得.*应得.*stack #1/],
  ['#emeraldSkullsReviewProgress', /已确认人数.*总人数/],
  ['#emeraldSkullsReadyList .is-ready', /已确认（✓）.*Next Turn/],
  ['#emeraldSkullsReadyList .emerald-skulls-ready-badge:not(.is-ready)', /尚未确认（○）.*Next Turn/],
  ['#emeraldSkullsLevel1 .is-wild', /Wild skull/],
  ['#emeraldSkullsBoard [data-level="3"] .emerald-skulls-level-label', /Nose.*👃.*🟩/],
];

(async () => {
  const browser = await chromium.launch({ channel: process.env.BROWSER_CHANNEL || 'chrome', headless: true });
  const errors = [];
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(base);
    await page.evaluate(() => ensureGameAssets('emerald_skulls'));
    await page.waitForFunction(() => typeof renderEmeraldSkullsGameState === 'function');
    await page.evaluate(() => {
      window.emeraldSkullsQAActions = [];
      sendAction = action => window.emeraldSkullsQAActions.push(action);
    });
    for (const width of [320, 360, 390, 393, 768, 1024, 1440]) {
      await page.setViewportSize({ width, height: 1000 });
      for (const key of ['buy', 'waiting', 'roll', 'bets', 'bet_once', 'bet_passed', 'next_bets', 'press', 'review', 'review_rewards', 'review_confirmed', 'review_exhausted', 'full', 'over']) {
        await render(page, key);
        await page.locator('#emeraldSkullsPlayerSection').evaluate((el, expanded) => { el.open = expanded; }, width > 940);
        await bounds(page, `${width}px ${key}`);
      }
      await page.locator('#emeraldSkullsPlayerSection').evaluate(el => { el.open = true; });
      await bounds(page, `${width}px expanded players`);
    }
    console.log('PASS layout: 98 viewport/phase combinations, expanded players, long names and seven dice');
    await render(page, 'waiting');
    assert.equal(await page.locator('#emeraldSkullsRollBtn').isDisabled(), true, 'Tumbler cannot roll before all gamblers decide');
    assert.match(await page.locator('#emeraldSkullsStatus').textContent(), /不会超时跳过/);
    assert.equal(await page.locator('.game-panel-title h2').textContent(), '💀 翡翠骰骨');
    assert.equal(await page.locator('#emeraldSkullsPanel h2').count(), 0, 'No nested game title');
    assert.equal(await page.locator('#emeraldSkullsPanel').evaluate(el => getComputedStyle(el).borderWidth), '0px', 'No nested frame');
    for (const bet of views.bets.betting_options) {
      const card = page.locator(`[data-bet-id="${bet.bet_id}"]`);
      assert.match(await card.locator('strong').textContent(), new RegExp(bet.name_zh));
      assert.equal(await card.locator('.emerald-skulls-bet-english').textContent(), bet.name);
    }
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
    await page.locator('.emerald-skulls-game-panel').screenshot({ path: `${output}/desktop.png` });
    await page.evaluate(() => setGamePanelVisibility('cabo'));
    assert.equal(await page.locator('.game-panel-title h2').textContent(), 'Game');
    assert.equal(await page.locator('.emerald-skulls-game-panel').count(), 0, 'Theme must not leak into other games');
    await render(page, 'roll');
    await page.evaluate(async () => {
      await ensureGameAssets('dice_throne');
      setGamePanelVisibility('dice_throne');
    });
    assert.equal(await page.locator('.game-panel-title h2').textContent(), 'Dice Throne');
    await page.evaluate(() => setGamePanelVisibility('cabo'));
    assert.equal(await page.locator('.game-panel-title h2').textContent(), 'Game', 'A subsequent game must not restore a stale Emerald Skulls title');
    await render(page, 'roll');
    console.log('PASS dice selection, Help, keyboard focus, disabled Explain and desktop tips');

    for (const width of [1024, 1440]) {
      await page.setViewportSize({ width, height: 1000 });
      await render(page, 'review_rewards');
      for (const [selector, expected] of reviewTipCases) {
        await page.locator(selector).first().hover();
        assert.match(await page.locator('#emeraldSkullsTip').textContent(), expected);
        assert.equal(await page.locator('#emeraldSkullsTip').isVisible(), true);
        await bounds(page, `${width}px review tooltip ${selector}`);
      }
      await page.locator('[data-bet-id="busted_fowl"] .emerald-skulls-bet-marker b').hover();
      assert.match(await page.locator('#emeraldSkullsTip').textContent(), /Player 3.*marker #1.*5 gears/);
      await page.locator('[data-bet-id="final_jewel"] .emerald-skulls-bet-vacancy').first().hover();
      assert.match(await page.locator('#emeraldSkullsTip').textContent(), /Marker #1.*gears/);
      await page.locator('#emeraldSkullsResultBody .is-tumbler > span').focus();
      assert.equal(await page.locator('#emeraldSkullsTip').isVisible(), true, 'Keyboard focus describes passive rewards');
      await page.keyboard.press('Escape');
      assert.equal(await page.locator('#emeraldSkullsTip').isVisible(), false);
      await page.locator('#emeraldSkullsNextBtn').hover();
      assert.equal(await page.locator('#emeraldSkullsTip').isVisible(), false, 'Actionable Next Turn must not show tips');
      await render(page, 'review_exhausted');
      await page.locator('#emeraldSkullsResultBody .emerald-skulls-result-item:not(.is-tumbler) > span').hover();
      assert.match(await page.locator('#emeraldSkullsTip').textContent(), /1\/5.*实得.*应得/);
      await page.locator('.emerald-skulls-pot-empty').hover();
      assert.match(await page.locator('#emeraldSkullsTip').textContent(), /⚙️.*实得.*应得/);
      await render(page, 'review_rewards');
      assert.equal(await page.locator('#emeraldSkullsTip').isVisible(), false, 'State changes dismiss stale tooltips');
      await page.locator('#emeraldSkullsResultBody .is-tumbler > span').hover();
      await page.screenshot({ path: `${output}/review-tip-desktop-${width}.png` });
    }
    assert.equal(await page.evaluate(() => emeraldSkullsQAActions.length), 0, 'Review tooltips must not dispatch actions');
    console.log('PASS desktop review rewards, result icons, readiness, locked board/bets, keyboard focus and partial payouts');

    const mobileContext = await browser.newContext({ viewport: { width: 390, height: 852 }, isMobile: true, hasTouch: true });
    const mobile = await mobileContext.newPage();
    mobile.on('pageerror', error => errors.push(error.message));
    await mobile.goto(base);
    await mobile.evaluate(() => ensureGameAssets('emerald_skulls'));
    await mobile.waitForFunction(() => typeof renderEmeraldSkullsGameState === 'function');
    await mobile.evaluate(() => { window.emeraldSkullsQAActions = []; sendAction = action => emeraldSkullsQAActions.push(action); });
    await render(mobile, 'roll');
    assert.equal(await mobile.locator('#emeraldSkullsTable').isVisible(), true);
    assert.equal(await mobile.locator('#emeraldSkullsPlayerSection').evaluate(el => el.open), false);
    await mobile.locator('#emeraldSkullsPlayerSection summary').tap();
    const resources = mobile.locator('.emerald-skulls-player-resources span');
    await resources.nth(0).tap();
    assert.match(await mobile.locator('#emeraldSkullsTip').textContent(), /Gears/);
    await resources.nth(1).tap();
    assert.match(await mobile.locator('#emeraldSkullsTip').textContent(), /Reroll cubes/);
    await mobile.locator('#emeraldSkullsTip').waitFor({ state: 'hidden', timeout: 4000 });
    await resources.nth(0).tap();
    const mobileDice = mobile.locator('#emeraldSkullsDiceTray button');
    await mobileDice.nth(0).tap();
    assert.equal(await mobile.locator('.emerald-skulls-die.is-selected').count(), 1);
    assert.equal(await mobile.locator('#emeraldSkullsTip').isVisible(), false, 'Selecting a die must dismiss tips without opening another');
    await mobileDice.nth(2).tap();
    assert.equal(await mobile.locator('.emerald-skulls-die.is-selected').count(), 2);
    assert.equal(await mobile.locator('#emeraldSkullsTip').isVisible(), false, 'Selecting a wild die must not show a tip');
    await mobile.locator('#emeraldSkullsBoard [data-level="1"] .emerald-skulls-empty-slot').tap();
    assert.deepEqual(await mobile.evaluate(() => emeraldSkullsQAActions.pop()), { type: 'place_dice', level: 1, die_ids: ['die-1', 'die-3'] });
    assert.equal(await mobile.locator('#emeraldSkullsTip').isVisible(), false, 'Placing dice must not show a tip');
    await render(mobile, 'buy');
    await mobile.locator('#emeraldSkullsBuyOptions button strong').first().tap();
    assert.deepEqual(await mobile.evaluate(() => emeraldSkullsQAActions.pop()), { type: 'buy_dice', count: 3 });
    assert.equal(await mobile.locator('#emeraldSkullsTip').isVisible(), false, 'Buying dice must not show a tip');
    await render(mobile, 'await_roll');
    await mobile.locator('#emeraldSkullsRollBtn').tap();
    assert.deepEqual(await mobile.evaluate(() => emeraldSkullsQAActions.pop()), { type: 'roll' });
    assert.equal(await mobile.locator('#emeraldSkullsTip').isVisible(), false, 'Rolling dice must not show a tip');
    await render(mobile, 'bets');
    await mobile.locator('[data-emerald-skulls-tab="bets"]').tap();
    assert.equal(await mobile.locator('#emeraldSkullsPassBetBtn').textContent(), '不下注');
    const bet = mobile.locator('.emerald-skulls-bet:not(:disabled)').first();
    await bet.locator('.emerald-skulls-bet-vacancy').first().tap();
    assert.equal(await mobile.evaluate(() => emeraldSkullsQAActions.pop().type), 'place_bet');
    assert.equal(await mobile.locator('#emeraldSkullsTip').isVisible(), false, 'Bet markers inside an actionable button must not show tips');
    await render(mobile, 'bet_once');
    assert.equal(await mobile.locator('#emeraldSkullsPassBetBtn').textContent(), '不再下注');
    await mobile.locator('#emeraldSkullsPassBetBtn').tap();
    assert.deepEqual(await mobile.evaluate(() => emeraldSkullsQAActions.pop()), { type: 'pass_bet' });
    assert.equal(await mobile.locator('#emeraldSkullsTip').isVisible(), false, 'Passing must not show a tooltip');
    await render(mobile, 'bet_passed');
    assert.equal(await mobile.locator('#emeraldSkullsPassBetBtn').isDisabled(), true);
    assert.equal(await mobile.locator('.emerald-skulls-bet:not(:disabled)').count(), 0);
    await mobile.locator('[data-emerald-skulls-tab="skull"]').tap();
    await render(mobile, 'next_bets');
    assert.equal(await mobile.locator('#emeraldSkullsBetting').isVisible(), true, 'A new roll reopens the betting tab');
    assert.equal(await mobile.locator('#emeraldSkullsPassBetBtn').isEnabled(), true);
    assert.equal(await mobile.locator('#emeraldSkullsBetPreview').isVisible(), true);
    await mobile.locator('#emeraldSkullsExplainBtn').tap();
    await mobile.locator('#emeraldSkullsPassBetBtn').tap();
    assert.match(await mobile.locator('#emeraldSkullsExplainContent').textContent(), /没有倒计时/);
    assert.equal(await mobile.evaluate(() => emeraldSkullsQAActions.length), 0);
    await mobile.keyboard.press('Escape');
    await render(mobile, 'press');
    await mobile.locator('[data-emerald-skulls-tab="skull"]').tap();
    await mobile.locator('#emeraldSkullsChickenBtn').tap();
    assert.deepEqual(await mobile.evaluate(() => emeraldSkullsQAActions.pop()), { type: 'chicken_out' });
    assert.equal(await mobile.locator('#emeraldSkullsTip').isVisible(), false, 'Action-button focus must not show a tip');
    await render(mobile, 'await_roll');
    await mobile.locator('#emeraldSkullsExplainBtn').tap();
    await mobile.locator('#emeraldSkullsRollBtn').tap();
    assert.equal(await mobile.locator('#emeraldSkullsExplainModal').isVisible(), true);
    assert.equal(await mobile.evaluate(() => emeraldSkullsQAActions.length), 0, 'Explain must describe a button without performing its action');
    await mobile.keyboard.press('Escape');
    await render(mobile, 'roll');
    await mobile.locator('#emeraldSkullsPlayerSection summary').tap();
    console.log('PASS mobile actions stay tip-free, including nested symbols and touch focus; Explain remains opt-in');
    await mobile.locator('.emerald-skulls-game-panel').screenshot({ path: `${output}/mobile-skull.png` });
    await mobile.locator('[data-emerald-skulls-tab="bets"]').tap();
    assert.equal(await mobile.locator('#emeraldSkullsTable').isVisible(), false);
    assert.equal(await mobile.locator('#emeraldSkullsBetting').isVisible(), true);
    await bounds(mobile, 'mobile bet tab');
    for (const width of [320, 390]) {
      await mobile.setViewportSize({ width, height: 852 });
      await render(mobile, 'next_bets');
      await bounds(mobile, `${width}px mobile bet preview`);
      await mobile.evaluate(() => { getSelection()?.removeAllRanges(); window.scrollTo(0, 0); });
      await mobile.screenshot({ path: `${output}/mobile-bets-${width}.png`, fullPage: true });
      await mobile.screenshot({ path: `${output}/mobile-viewport-${width}.png` });
    }
    await render(mobile, 'bets');
    const swipeTarget = mobile.locator('.emerald-skulls-bet').nth(4);
    await swipeUp(mobile, swipeTarget);
    assert.equal(await mobile.evaluate(() => emeraldSkullsQAActions.length), 0, 'Scrolling across a bet must not place it');
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
    console.log('PASS bilingual bets, explicit pass, reopening bets, touch scrolling, tabs, tips, review and scrollable log');

    for (const width of [320, 390]) {
      await mobile.setViewportSize({ width, height: 852 });
      await render(mobile, 'review_rewards');
      for (const [selector, expected] of reviewTipCases) {
        await pointTap(mobile, mobile.locator(selector).first());
        assert.match(await mobile.locator('#emeraldSkullsTip').textContent(), expected);
        assert.equal(await mobile.locator('#emeraldSkullsTip').isVisible(), true);
        await bounds(mobile, `${width}px review tooltip ${selector}`);
      }
      await mobile.locator('[data-emerald-skulls-tab="bets"]').tap();
      assert.equal(await mobile.locator('#emeraldSkullsTip').isVisible(), false, 'Switching tabs is an action, not a tooltip');
      const reviewBet = mobile.locator('[data-bet-id="busted_fowl"]');
      await pointTap(mobile, reviewBet.locator('.emerald-skulls-bet-marker b'));
      assert.match(await mobile.locator('#emeraldSkullsTip').textContent(), /Player 3.*marker #1.*5 gears/);
      await pointTap(mobile, reviewBet.locator('.emerald-skulls-bet-vacancy').first());
      assert.match(await mobile.locator('#emeraldSkullsTip').textContent(), /Marker #2.*gears/);
      await pointTap(mobile, reviewBet.locator('strong'));
      assert.match(await mobile.locator('#emeraldSkullsTip').textContent(), /爆仓怂鸡.*Busted Fowl/);
      await mobile.locator('#emeraldSkullsTip').waitFor({ state: 'hidden', timeout: 4000 });
      await swipeUp(mobile, reviewBet);
      await mobile.locator('[data-emerald-skulls-tab="skull"]').tap();
      const reward = mobile.locator('#emeraldSkullsResultBody .is-tumbler > span');
      await reward.tap();
      assert.equal(await mobile.locator('#emeraldSkullsTip').isVisible(), true);
      await swipeUp(mobile, reward);
      await reward.tap();
      await mobile.screenshot({ path: `${output}/review-tip-mobile-${width}.png` });
      await render(mobile, 'review_confirmed');
      assert.equal(await mobile.locator('#emeraldSkullsTip').isVisible(), false, 'Re-render dismisses stale reward tips');
      await pointTap(mobile, mobile.locator('#emeraldSkullsNextBtn'));
      assert.match(await mobile.locator('#emeraldSkullsTip').textContent(), /已确认（✓）.*Next Turn/);
      await render(mobile, 'review_exhausted');
      await mobile.locator('#emeraldSkullsResultBody .emerald-skulls-result-item:not(.is-tumbler) > span').tap();
      assert.match(await mobile.locator('#emeraldSkullsTip').textContent(), /1\/5.*实得.*应得/);
      await mobile.locator('.emerald-skulls-pot-empty').tap();
      assert.match(await mobile.locator('#emeraldSkullsTip').textContent(), /齿轮池.*⚙️.*实得/);
      assert.equal(await mobile.evaluate(() => emeraldSkullsQAActions.length), 0, 'Read-only review and disabled buttons must not perform actions');
      await render(mobile, 'review_rewards');
      await mobile.locator('#emeraldSkullsNextBtn').tap();
      assert.deepEqual(await mobile.evaluate(() => emeraldSkullsQAActions.pop()), { type: 'next_turn' });
      assert.equal(await mobile.locator('#emeraldSkullsTip').isVisible(), false, 'Confirming review stays tooltip-free');
    }
    console.log('PASS mobile review tips, latest-tap replacement, three-second dismiss, disabled controls and scroll gestures');

    const liveContexts = [];
    const livePages = [];
    try {
      for (const name of ['First Gambler', 'Second Gambler']) {
        const context = await browser.newContext({ viewport: { width: 390, height: 852 }, isMobile: true, hasTouch: true });
        liveContexts.push(context);
        const livePage = await context.newPage();
        livePages.push(livePage);
        livePage.on('pageerror', error => errors.push(error.message));
        await livePage.goto(base);
        await livePage.waitForFunction(() => typeof socket !== 'undefined' && socket.connected);
        await livePage.evaluate(playerName => {
          window.emeraldSkullsLiveName = playerName;
          window.emeraldSkullsLiveErrors = [];
          socket.on('system:error', data => emeraldSkullsLiveErrors.push(data.message));
        }, name);
      }
      const [first, second] = livePages;
      await first.evaluate(() => socket.emit('room:create', { name: emeraldSkullsLiveName, game_type: 'emerald_skulls', config: { seed: 'browser-live-7' } }));
      await first.waitForFunction(() => roomSessionReady && currentGameType === 'emerald_skulls');
      const liveRoom = await first.evaluate(() => roomId);
      await second.evaluate(room => socket.emit('room:join', { room_id: room, name: emeraldSkullsLiveName }), liveRoom);
      await second.waitForFunction(() => roomSessionReady && currentRoomState.players.length === 2);
      await second.evaluate(() => socket.emit('room:ready', { ready: true }));
      await first.waitForFunction(() => currentRoomState.players.every(player => player.ready));
      await first.evaluate(() => socket.emit('room:add_bot', { name: 'Waiting Tumbler' }));
      await first.waitForFunction(() => currentRoomState.players.length === 3);
      await first.evaluate(() => socket.emit('room:start', {}));
      for (const livePage of livePages) {
        await livePage.waitForFunction(() => lastGameStatePayload?.view.phase === 'await_roll' && isGameAssetsLoaded('emerald_skulls'));
        await livePage.evaluate(() => setRoomControlsCollapsed(true));
        assert.equal(await livePage.locator('#emeraldSkullsPassBetBtn').isEnabled(), true);
      }
      assert.equal(await first.evaluate(() => lastGameStatePayload.view.players.find(player => player.player_id === lastGameStatePayload.view.active_player_id).is_bot), true);
      const beforeWait = await first.evaluate(() => lastGameStatePayload.state_version);
      await first.waitForTimeout(5500);
      assert.equal(await first.evaluate(() => lastGameStatePayload.state_version), beforeWait, 'Old 4.5-second timeout must not advance the roll');
      assert.equal(await first.evaluate(() => lastGameStatePayload.view.roll_count), 0);
      await first.locator('#emeraldSkullsPassBetBtn').tap();
      await first.waitForFunction(() => !lastGameStatePayload.view.legal_actions.includes('pass_bet'));
      await second.waitForFunction(() => lastGameStatePayload.view.pending_bettors.length === 1);
      await first.reload();
      await first.waitForFunction(() => roomSessionReady && lastGameStatePayload?.view.phase === 'await_roll' && isGameAssetsLoaded('emerald_skulls'));
      assert.equal(await first.locator('#emeraldSkullsPassBetBtn').isDisabled(), true, 'Reconnect must preserve the explicit pass');
      await first.setViewportSize({ width: 320, height: 852 });
      await first.evaluate(() => { setRoomControlsCollapsed(true); window.scrollTo(0, 0); });
      await bounds(first, '320px live reconnected gambler');
      await first.screenshot({ path: `${output}/live-passed-320.png` });
      assert.equal(await second.locator('#emeraldSkullsPassBetBtn').isEnabled(), true, 'One player cannot pass for another');
      await second.locator('.emerald-skulls-bet:not(:disabled)').first().tap();
      await second.waitForFunction(() => lastGameStatePayload.view.players.find(player => player.player_id === lastGameStatePayload.view.you).bets.length === 1);
      await second.waitForTimeout(5500);
      assert.equal(await second.evaluate(() => lastGameStatePayload.view.roll_count), 0, 'One marker still requires a decision about the other');
      await second.evaluate(() => window.scrollTo(0, 0));
      await bounds(second, '390px live one-marker gambler');
      await second.screenshot({ path: `${output}/live-betting-390.png` });
      await second.locator('#emeraldSkullsPassBetBtn').tap();
      await second.waitForFunction(() => lastGameStatePayload?.view.roll_count >= 1);
      assert.equal(await second.evaluate(() => lastGameStatePayload.view.players.find(player => player.player_id === lastGameStatePayload.view.you).bets.length), 1);
      for (const livePage of livePages) {
        const liveErrors = await livePage.evaluate(() => window.emeraldSkullsLiveErrors || []);
        assert.deepEqual(liveErrors, []);
        await livePage.evaluate(() => new Promise(resolve => {
          socket.emit('room:leave', {}, () => { resetRoomState(); resolve(); });
        }));
      }
      await first.waitForFunction(() => !roomSessionReady);
      await second.waitForFunction(() => !roomSessionReady);
      const deleted = await first.evaluate(room => new Promise(resolve => {
        const onDeleted = result => {
          if (result.room_id !== room) return;
          socket.off('room:delete_result', onDeleted);
          resolve(result.ok);
        };
        socket.on('room:delete_result', onDeleted);
        socket.emit('room:delete', { room_id: room });
      }), liveRoom);
      assert.equal(deleted, true, 'Remove only the room created by this test');
      console.log('PASS live Socket.IO: two humans + bot, no timeout, one-marker wait, reconnect and roll after all pass');
    } finally {
      for (const context of liveContexts) await context.close();
    }
    assert.deepEqual(errors, []);
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
