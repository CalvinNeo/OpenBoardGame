const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const base = process.env.ROOM_TEST_URL || 'http://127.0.0.1:8766';
const output = path.join(root, 'tmp/hot-streak-ui-20261110');
const fixtures = JSON.parse(execFileSync(process.env.PYTHON || 'python3', [
  path.join(__dirname, 'hot_streak_ui_fixtures.py'),
], { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }));

async function render(page, name, reset = true) {
  await page.evaluate(({ view, reset }) => {
    if (reset) clearHotStreakState();
    window.__hotStreakActions = [];
    window.__hotStreakView = view;
    renderHotStreakGameState({ game_type: 'hot_streak', view });
    window.scrollTo(0, 0);
  }, { view: fixtures[name], reset });
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(resolve)));
}

async function audit(page, name, width) {
  const metrics = await page.evaluate(() => {
    const root = document.getElementById('hotStreakPanel');
    const visible = node => node.checkVisibility({ checkVisibilityCSS: true });
    const rect = node => {
      const box = node.getBoundingClientRect();
      return { left: box.left, right: box.right, top: box.top, bottom: box.bottom, width: box.width, height: box.height };
    };
    const overflow = [];
    const overlap = [];
    const tooSmall = [];
    const clippedText = [];
    for (const node of root.querySelectorAll('*')) {
      if (!visible(node)) continue;
      const style = getComputedStyle(node);
      const box = rect(node);
      const label = node.id || String(node.className);
      if (node.clientWidth && node.scrollWidth > node.clientWidth + 2
        && style.overflowX !== 'auto' && style.textOverflow !== 'ellipsis') {
        overflow.push(label);
      }
      const compactTrackToggle = node.id === 'hotStreakTrackToggle'
        && document.getElementById('hotStreakTrackBody').hidden
        && matchMedia('(hover: hover) and (pointer: fine)').matches;
      if (node.matches('button, summary') && box.height < (compactTrackToggle ? 27 : 43)) tooSmall.push(label);
      if (!node.children.length && node.textContent.trim() && style.textOverflow !== 'ellipsis') {
        const range = document.createRange();
        range.selectNodeContents(node);
        const text = range.getBoundingClientRect();
        if (text.right > box.right + 2 || text.left < box.left - 2) clippedText.push(label);
      }
    }
    for (const selector of ['.hot-streak-layout', '.hot-streak-ticket-grid', '.hot-streak-hand', '.hot-streak-podium', '.hot-streak-track-controls']) {
      for (const parent of root.querySelectorAll(selector)) {
        const children = Array.from(parent.children).filter(visible);
        for (let first = 0; first < children.length; first += 1) {
          for (let second = first + 1; second < children.length; second += 1) {
            const left = rect(children[first]);
            const right = rect(children[second]);
            if (left.left < right.right - 1 && right.left < left.right - 1
              && left.top < right.bottom - 1 && right.top < left.bottom - 1) {
              overlap.push(`${children[first].id || children[first].className}/${children[second].id || children[second].className}`);
            }
          }
        }
      }
    }
    const help = rect(document.getElementById('hotStreakHelpBtn'));
    const reconnect = rect(document.getElementById('gameReconnectBtn'));
    const track = rect(document.getElementById('hotStreakTrackViewport'));
    const tickets = rect(document.getElementById('hotStreakTicketSection'));
    const trackControls = rect(document.querySelector('.hot-streak-track-controls'));
    const trackCollapsed = document.getElementById('hotStreakTrackBody').hidden;
    const touch = matchMedia('(pointer: coarse)').matches;
    return {
      pageOverflow: document.documentElement.scrollWidth > innerWidth + 1,
      panelOverflow: root.scrollWidth > root.clientWidth + 1,
      overflow, overlap, tooSmall, clippedText,
      headerAligned: Math.abs(help.top + help.height / 2 - reconnect.top - reconnect.height / 2) < 3,
      height: root.clientHeight, track, tickets, trackControls, trackCollapsed, touch,
    };
  });
  assert.equal(metrics.pageOverflow, false, `${width}/${name}: page overflow`);
  assert.equal(metrics.panelOverflow, false, `${width}/${name}: panel overflow`);
  for (const key of ['overflow', 'overlap', 'tooSmall', 'clippedText']) {
    assert.deepEqual(metrics[key], [], `${width}/${name}: ${key}`);
  }
  assert(metrics.headerAligned, `${width}/${name}: Help and Reconnect must stay on one line`);
  assert(metrics.trackControls.height <= 44, `${width}/${name}: track controls must not wrap to a second row`);
  if (metrics.trackCollapsed && !metrics.touch) {
    assert(metrics.trackControls.height <= 28, `${width}/${name}: collapsed track must stay compact on desktop`);
  }
  if (width >= 1024 && !metrics.trackCollapsed) {
    assert(metrics.track.height <= 240, `${width}/${name}: horizontal track must scale to its actual width`);
  }
  if (width <= 390 && name.startsWith('betting_')) {
    assert(metrics.tickets.top < 200, `${width}/${name}: betting must start in the first screen`);
  }
  if (width <= 390 && name === 'racing') {
    assert(metrics.track.top < 300 && metrics.track.bottom < 700, `${width}: the whole fitted track must be visible`);
  }
  return metrics;
}

async function tapDisabled(page, selector) {
  const target = page.locator(selector).first();
  await target.scrollIntoViewIfNeeded();
  const box = await target.boundingBox();
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
}

async function interactions(page, width) {
  await render(page, 'betting_self');
  assert.equal(await page.locator('#hotStreakPlayersSection').getAttribute('open'), null);
  assert.equal(await page.locator('#hotStreakHand .hot-streak-race-card').count(), fixtures.betting_self.your_hand.length);
  assert.equal(await page.locator('#hotStreakSubmitBtn').isVisible(), false);
  await page.locator('#hotStreakTrackToggle').click();
  assert.equal(await page.locator('#hotStreakTrackTools').isVisible(), true);
  await audit(page, 'track_preview_open', width);
  await page.locator('#hotStreakTrackToggle').click();
  assert.equal(await page.locator('#hotStreakTrackTools').isVisible(), false);
  await audit(page, 'track_preview_closed', width);
  const firstTicket = page.locator('#hotStreakTickets .hot-streak-ticket').first();
  await firstTicket.click();
  assert.equal(await page.locator('#hotStreakTicketMask').isVisible(), true);
  assert.equal(await page.locator('#hotStreakTicketMask').evaluate(node => node.parentElement.id), 'hotStreakTickets');
  await audit(page, 'confirm', width);
  await page.screenshot({ path: path.join(output, `${width}-ticket-confirm.png`), fullPage: true });
  await page.keyboard.press('Escape');
  assert.equal(await page.locator('#hotStreakTicketMask').isVisible(), false);
  assert.equal(await firstTicket.evaluate(node => node === document.activeElement), true);
  await firstTicket.click();
  await page.locator('#hotStreakTicketHint').click();
  assert.equal(await page.locator('#hotStreakTicketMask').isVisible(), false);
  await firstTicket.click();
  await page.locator('#hotStreakConfirmModes .is-safe').click();
  assert.deepEqual(await page.evaluate(() => window.__hotStreakActions), [
    { type: 'draft_ticket', stack_id: fixtures.betting_self.ticket_stacks[0].stack_id, mode: 'safe' },
  ]);

  await render(page, 'betting_race3_double');
  await page.locator('.hot-streak-ticket:not(:disabled)').first().click();
  assert.equal(await page.locator('#hotStreakDoubleOptions input').count(), 2);
  assert.equal(await page.locator('#hotStreakConfirmModes .is-risky').isDisabled(), true);
  await page.locator('#hotStreakDoubleOptions input[value="new"]').check();
  await audit(page, 'double', width);
  await page.screenshot({ path: path.join(output, `${width}-double-confirm.png`), fullPage: true });
  await page.locator('#hotStreakConfirmModes .is-risky').click();
  assert.equal(await page.evaluate(() => window.__hotStreakActions[0].double_bet_id), 'new');
  await render(page, 'betting_race3_double');
  await page.locator('.hot-streak-ticket:not(:disabled)').first().click();
  const oldBet = await page.locator('#hotStreakDoubleOptions input').first().getAttribute('value');
  await page.locator('#hotStreakDoubleOptions input').first().check();
  await page.locator('#hotStreakConfirmModes .is-safe').click();
  assert.equal(await page.evaluate(() => window.__hotStreakActions[0].double_bet_id), oldBet);

  await render(page, 'card_selection_two');
  const cards = page.locator('#hotStreakHand .hot-streak-race-card');
  await cards.nth(1).click();
  assert.equal(await page.locator('#hotStreakSubmitBtn').isDisabled(), true);
  const originalScroll = await page.evaluate(() => scrollY);
  await page.evaluate(() => {
    window.__hotStreakFocusedCard = document.activeElement;
    renderHotStreakGameState({ view: window.__hotStreakView });
  });
  assert.equal(await page.evaluate(() => window.__hotStreakFocusedCard === document.activeElement), true);
  assert.equal(await page.evaluate(() => scrollY), originalScroll);
  await cards.nth(2).click();
  assert.equal(await page.locator('#hotStreakSubmitBtn').isEnabled(), true);
  assert.equal(await page.locator('#hotStreakHand [aria-pressed="true"]').count(), 2);
  await page.locator('#hotStreakSubmitBtn').click();
  assert.deepEqual(await page.evaluate(() => window.__hotStreakActions[0].card_ids), fixtures.card_selection_two.your_hand.slice(1, 3).map(card => card.instance_id));
  await page.locator('#hotStreakHandHint').click();
  assert.equal(await page.locator('#hotStreakHand [aria-pressed="true"]').count(), 0);
  await render(page, 'card_submitted');
  assert.equal(await page.locator('.hot-streak-race-card-status').count(), fixtures.card_submitted.your_submitted_cards.length);
  assert.equal(await page.locator('#hotStreakSubmitBtn').isVisible(), false);

  await render(page, 'betting_self');
  await page.locator('#hotStreakHelpBtn').click();
  const help = page.locator('.obg-help-dialog:not(.obg-explain-dialog)[open]');
  await help.waitFor();
  await help.locator('[data-obg-help-lang="en"]').click();
  await help.locator('[data-obg-help-tab="cards"]').click();
  assert.match(await help.textContent(), /fall down/);
  await help.locator('[data-obg-help-lang="zh"]').click();
  assert.match(await help.textContent(), /倒地/);
  await page.keyboard.press('Escape');
  assert.equal(await help.count(), 0);
  await render(page, 'betting_other');
  await page.locator('#hotStreakExplainBtn').click();
  await tapDisabled(page, '#hotStreakTickets .hot-streak-ticket');
  await page.locator('.obg-explain-dialog[open]').waitFor();
  assert.match(await page.locator('.obg-explain-dialog[open]').textContent(), /Blaze/);
  assert.equal(await page.evaluate(() => window.__hotStreakActions.length), 0);
  await page.keyboard.press('Escape');
  await page.locator('#hotStreakExplainBtn').click();
  await page.keyboard.press('Escape');
  assert.equal(await page.locator('#hotStreakExplainBtn').getAttribute('aria-pressed'), 'false');

  await render(page, 'racing');
  if (width >= 1024) {
    await page.locator('.hot-streak-racer').first().hover();
    assert.equal(await page.locator('.hot-streak-tip').isVisible(), true);
    await page.locator('[data-hot-streak-zoom="in"]').hover();
    assert.equal(await page.locator('.hot-streak-tip').isVisible(), false);
  }
  await page.locator('[data-hot-streak-zoom="in"]').click();
  const viewport = page.locator('#hotStreakTrackViewport');
  assert(await viewport.evaluate(node => node.scrollWidth > node.clientWidth));
  await viewport.focus();
  const initialScroll = await viewport.evaluate(node => node.scrollLeft);
  await page.keyboard.press('ArrowRight');
  assert(await viewport.evaluate(node => node.scrollLeft) > initialScroll);
  await viewport.scrollIntoViewIfNeeded();
  const box = await viewport.boundingBox();
  await page.mouse.move(box.x + box.width * 0.7, box.y + box.height * 0.6);
  await page.mouse.down();
  await page.mouse.move(box.x + 10, box.y + 15, { steps: 6 });
  await page.mouse.move(box.x - 5, box.y - 10);
  await page.mouse.up();
  assert.equal(await viewport.evaluate(node => node.classList.contains('is-dragging')), false);
  assert(await viewport.evaluate(node => node.scrollLeft > 0 || node.scrollTop > 0));
  await page.locator('[data-hot-streak-zoom="fit"]').click();
  assert.equal(await viewport.evaluate(node => node.scrollLeft + node.scrollTop), 0);
  await page.locator('[data-hot-streak-zoom="origin"]').click();
  assert(await page.locator('#hotStreakTrack').evaluate(node => Number(node.style.getPropertyValue('--hs-zoom')) >= 1));
  await page.locator('[data-hot-streak-zoom="fit"]').click();
  await page.locator('#hotStreakLogToggle').click();
  assert.equal(await page.locator('#hotStreakLog').isVisible(), true);
  assert(await page.locator('#hotStreakLog').evaluate(node => node.clientHeight <= 200 && node.scrollHeight > node.clientHeight));
  await page.locator('#hotStreakLog').evaluate(node => { node.scrollTop = 0; });
  await page.evaluate(() => renderHotStreakGameState({ view: window.__hotStreakView }));
  assert.equal(await page.locator('#hotStreakLog').evaluate(node => node.scrollTop), 0);
  await page.locator('#hotStreakLogToggle').click();
  assert.equal(await page.locator('#hotStreakLog').isVisible(), false);

  await render(page, 'race_result');
  assert.equal(await page.locator('.hot-streak-payout-player[open]').count(), 1);
  await page.locator('.hot-streak-payout-player:not(.is-self) summary').first().click();
  await page.evaluate(() => renderHotStreakGameState({ view: window.__hotStreakView }));
  assert.equal(await page.locator('.hot-streak-payout-player[open]').count(), 2);
  await page.locator('#hotStreakNextRaceBtn').click();
  assert.deepEqual(await page.evaluate(() => window.__hotStreakActions), [{ type: 'next_round' }]);
  assert.equal(await page.locator('dialog[open]').count(), 0);
  await render(page, 'race_ready');
  assert.equal(await page.locator('#hotStreakNextRaceBtn').isDisabled(), true);
  await render(page, 'game_over');
  await page.locator('#hotStreakPlayAgainBtn').click();
  assert.deepEqual(await page.evaluate(() => window.__hotStreakActions), [{ type: 'play_again' }]);
}

async function touchChecks(page) {
  await render(page, 'card_selection_two');
  const session = await page.context().newCDPSession(page);
  const card = await page.locator('#hotStreakHand .hot-streak-race-card').first().boundingBox();
  const start = { x: card.x + card.width / 2, y: card.y + card.height / 2 };
  await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [start] });
  for (let step = 1; step <= 5; step += 1) {
    await session.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: start.x, y: start.y - step * 18 }] });
  }
  await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  assert.equal(await page.locator('#hotStreakHand .selected').count(), 0, 'scrolling must not select a card');
  await page.locator('#hotStreakHand .hot-streak-race-card').first().tap();
  assert.equal(await page.locator('#hotStreakHand .selected').count(), 1);
  assert.equal(await page.locator('.hot-streak-tip:visible').count(), 0);
  await render(page, 'racing');
  await page.locator('.hot-streak-racer').first().tap();
  assert.equal(await page.locator('.hot-streak-tip').isVisible(), true);
  await page.locator('.hot-streak-racer').nth(1).tap();
  const racer = await page.locator('.hot-streak-racer').nth(1).getAttribute('aria-label');
  assert.equal(await page.locator('.hot-streak-tip').textContent(), racer);
  await page.waitForFunction(() => document.querySelector('.hot-streak-tip').hidden, null, { timeout: 4000 });
  await page.locator('[data-hot-streak-zoom="in"]').tap();
  const viewport = page.locator('#hotStreakTrackViewport');
  const box = await viewport.boundingBox();
  const pageScroll = await page.evaluate(() => scrollY);
  const trackScroll = await viewport.evaluate(node => node.scrollLeft + node.scrollTop);
  await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: box.x + box.width / 2, y: box.y + box.height / 2 }] });
  for (let step = 1; step <= 5; step += 1) {
    await session.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: box.x + box.width / 2 - step * 20, y: box.y + box.height / 2 - step * 20 }] });
  }
  await session.send('Input.dispatchTouchEvent', { type: 'touchCancel', touchPoints: [] });
  assert.equal(await page.evaluate(() => scrollY), pageScroll);
  assert.equal(await viewport.evaluate(node => node.classList.contains('is-dragging')), false);
  assert(await viewport.evaluate(node => node.scrollLeft + node.scrollTop) > trackScroll);
  assert.equal(await page.locator('.hot-streak-tip').isVisible(), false);
  await page.locator('#hotStreakBalance').tap();
  assert.equal(await page.locator('.hot-streak-tip').isVisible(), true);
  await session.detach();
}

(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const errors = [];
  const report = [];
  fs.mkdirSync(output, { recursive: true });
  try {
    for (const width of [320, 390, 1024, 1440]) {
      const context = await browser.newContext({ viewport: { width, height: width < 500 ? 844 : 950 }, hasTouch: width < 500, isMobile: width < 500 });
      const page = await context.newPage();
      page.on('pageerror', error => errors.push(error.message));
      await page.route('https://fonts.googleapis.com/**', route => route.abort());
      await page.goto(base);
      await page.waitForFunction(() => typeof ensureGameAssets === 'function' && typeof socket !== 'undefined');
      await page.evaluate(async () => {
        socket.disconnect();
        await ensureGameAssets('hot_streak');
        currentGameType = 'hot_streak';
        setGamePanelVisibility('hot_streak');
        setRoomControlsCollapsed(true);
        window.sendAction = action => window.__hotStreakActions.push(action);
      });
      for (const name of Object.keys(fixtures)) {
        await render(page, name);
        report.push({ width, name, ...await audit(page, name, width) });
        await page.screenshot({ path: path.join(output, `${width}-${name}.png`), fullPage: true });
      }
      await interactions(page, width);
      await render(page, 'betting_eight_long');
      await page.locator('#hotStreakPlayersSection summary').click();
      await audit(page, 'expanded_players', width);
      await page.evaluate(() => setRoomControlsCollapsed(false));
      await audit(page, 'room_controls_open', width);
      for (const name of ['racing_folded', 'card_selection_two', 'race_result']) {
        await render(page, name);
        await audit(page, `room_controls_open_${name}`, width);
      }
      await page.screenshot({ path: path.join(output, `${width}-room-controls-open.png`), fullPage: true });
      await page.evaluate(() => setRoomControlsCollapsed(true));
      if (width === 390) await touchChecks(page);
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await render(page, 'racing');
      assert.equal(await page.locator('.hot-streak-racer').first().evaluate(node => getComputedStyle(node).animationName), 'none');
      const scriptCount = await page.locator('script[src*="/games/hot_streak.js"]').count();
      await page.evaluate(() => {
        clearHotStreakState();
        currentGameType = null;
        setGamePanelVisibility(null);
      });
      assert.equal(await page.locator('#hotStreakPanel').isVisible(), false);
      await page.evaluate(async () => {
        await ensureGameAssets('hot_streak');
        currentGameType = 'hot_streak';
        setGamePanelVisibility('hot_streak');
      });
      await render(page, 'betting_self');
      assert.equal(await page.locator('script[src*="/games/hot_streak.js"]').count(), scriptCount);
      assert.equal(await page.locator('#hotStreakPanel').isVisible(), true);
      await audit(page, 'reload_cached_assets', width);
      await context.close();
      console.log(`Hot Streak ${width}px: ${Object.keys(fixtures).length} states, layout and interactions passed`);
    }
    assert.deepEqual(errors, []);
    fs.writeFileSync(path.join(output, 'report.json'), JSON.stringify(report, null, 2));
    console.log(`Hot Streak UI: ${report.length} state/viewport combinations passed`);
  } finally {
    await browser.close();
  }
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
