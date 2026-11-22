const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const base = process.env.ROOM_TEST_URL || 'http://127.0.0.1:8766';
const output = 'tmp/subtext';

(async () => {
  fs.mkdirSync(output, { recursive: true });
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const errors = [];
  let page;
  try {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, hasTouch: true });
    page = await context.newPage();
    page.on('pageerror', error => errors.push(error.message));
    await page.route('https://fonts.googleapis.com/**', route => route.abort());
    await page.goto(base);
    await page.waitForFunction(() => typeof socket !== 'undefined' && socket.connected && cachedGameList);
    assert.equal(await page.locator('script[src*="/subtext.js"]').count(), 0);
    await page.evaluate(() => socket.emit('room:create', { name: 'Subtext layout QA', game_type: 'subtext' }));
    await page.waitForFunction(() => roomSessionReady && isGameAssetsLoaded('subtext'));
    const secondContext = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const second = await secondContext.newPage();
    second.on('pageerror', error => errors.push(error.message));
    await second.route('https://fonts.googleapis.com/**', route => route.abort());
    await second.goto(base);
    await second.waitForFunction(() => typeof socket !== 'undefined' && socket.connected && cachedGameList);
    await second.evaluate(activeRoom => socket.emit('room:join', { room_id: activeRoom, name: 'Subtext second reviewer' }), await page.evaluate(() => roomId));
    await second.waitForFunction(() => roomSessionReady && isGameAssetsLoaded('subtext'));
    for (let count = 3; count <= 8; count += 1) {
      await page.evaluate(() => socket.emit('room:add_bot', { room_id: roomId }));
      await page.waitForFunction(expected => currentRoomState.players.length === expected, count);
    }
    await second.evaluate(() => socket.emit('room:ready', { room_id: roomId, ready: true }));
    await page.evaluate(() => {
      setRoomControlsCollapsed(false);
      socket.emit('room:ready', { room_id: roomId, ready: true });
    });
    await page.waitForFunction(() => !document.getElementById('startBtn').disabled);
    await page.locator('#startBtn').click();
    await page.locator('#subtextDrawingArea').waitFor({ state: 'visible' });
    await page.waitForFunction(() => lastGameStatePayload?.view.drawing_progress.done === 6);

    async function submitSecondDrawing() {
      await second.waitForFunction(() => lastGameStatePayload?.view.legal_actions.includes('submit_drawing'));
      await second.evaluate(() => sendAction({ type: 'submit_drawing', drawing: [[[0.2, 0.3], [0.6, 0.7]]] }));
    }

    async function submitSecondGuess() {
      await second.waitForFunction(() => lastGameStatePayload?.view.legal_actions.includes('submit_guess'));
      await second.evaluate(() => sendAction({ type: 'submit_guess', slot_id: lastGameStatePayload.view.candidates[0].slot_id }));
    }

    await submitSecondDrawing();

    async function checkLayout(stage, width) {
      await page.setViewportSize({ width, height: width < 500 ? 844 : 900 });
      await page.evaluate(() => {
        setRoomControlsCollapsed(true);
        scrollTo(0, 0);
      });
      await page.waitForFunction(() => innerWidth <= 900
        ? !document.body.classList.contains('room-controls-drawer-closed')
        : document.body.classList.contains('room-controls-drawer-closed'));
      await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
      const layout = await page.evaluate(() => {
        const bounds = selector => {
          const rect = document.querySelector(selector).getBoundingClientRect();
          return { top: rect.top, right: rect.right, bottom: rect.bottom, left: rect.left, width: rect.width, height: rect.height };
        };
        const grid = document.getElementById('subtextCandidateGrid');
        const help = bounds('#subtextHelpBtn');
        const reconnect = bounds('#gameReconnectBtn');
        const clippedButtons = [...document.querySelectorAll('#subtextPanel button')].filter(button => {
          const rect = button.getBoundingClientRect();
          return rect.width && rect.height && (button.scrollWidth > button.clientWidth + 1 || button.scrollHeight > button.clientHeight + 1);
        }).map(button => button.textContent);
        return {
          overflow: document.documentElement.scrollWidth > innerWidth,
          panel: bounds('#subtextPanel'), canvas: bounds('#subtextCanvas'),
          grid: bounds('#subtextCandidateGrid'), dealer: bounds('.subtext-dealer-drawing'),
          actions: bounds('.subtext-guess-actions'),
          columns: getComputedStyle(grid).gridTemplateColumns.split(' ').length,
          scoreboardOpen: document.querySelector('.subtext-scoreboard').open,
          headerAligned: Math.min(help.bottom, reconnect.bottom) > Math.max(help.top, reconnect.top),
          clippedButtons,
        };
      });
      assert.equal(layout.overflow, false, `${stage} ${width}: page overflow`);
      assert.equal(layout.scoreboardOpen, false, 'scores should not reserve board space');
      assert.equal(layout.headerAligned, true, 'Help and Reconnect stay on one line');
      assert.deepEqual(layout.clippedButtons, [], `${stage} ${width}: clipped controls`);
      if (stage === 'drawing') {
        if (width >= 1024) assert(layout.canvas.width > 760, 'desktop canvas must exceed its old 640px cap');
        else assert(layout.canvas.width >= layout.panel.width - 3, 'mobile canvas fills the panel');
        assert(layout.canvas.top - layout.panel.top < 150, `compact metadata keeps drawing near the top: ${JSON.stringify(layout)}`);
      } else if (stage === 'guessing') {
        assert(layout.grid.height >= (width < 500 ? 280 : 360), 'candidates get usable scrolling height');
        assert.equal(layout.columns, width < 360 ? 1 : width <= 1100 ? 2 : 3);
        assert(layout.actions.bottom <= (width < 500 ? 844 : 900), `guess submission remains on screen: ${JSON.stringify(layout)}`);
        if (width >= 1024) assert(layout.dealer.right <= layout.grid.left, 'reference and candidates stay side by side');
        else assert(layout.dealer.bottom <= layout.grid.top, 'mobile reference stays above candidates');
      }
      await page.screenshot({ path: `${output}/${stage}-${width}.png`, fullPage: true });
      console.log(stage, width, JSON.stringify(layout));
    }

    for (const width of [320, 390, 1024, 1440]) await checkLayout('drawing', width);
    await page.locator('.subtext-scoreboard summary').click();
    assert.equal(await page.locator('.subtext-player-card').count(), 8);
    await page.locator('.subtext-scoreboard summary').click();

    await page.locator('#subtextExplainBtn').click();
    const undo = await page.locator('#subtextUndoBtn').boundingBox();
    await page.mouse.click(undo.x + undo.width / 2, undo.y + undo.height / 2);
    await page.locator('.obg-explain-dialog[open]').waitFor({ state: 'visible' });
    assert.equal(await page.locator('#subtextSubmitDrawingBtn').isDisabled(), true);
    await page.keyboard.press('Escape');

    async function sketch() {
      const canvas = await page.locator('#subtextCanvas').boundingBox();
      await page.mouse.move(canvas.x + canvas.width * 0.3, canvas.y + canvas.height * 0.3);
      await page.mouse.down();
      await page.mouse.move(canvas.x + canvas.width * 0.7, canvas.y + canvas.height * 0.6, { steps: 8 });
      await page.mouse.up();
    }
    await sketch();
    assert.equal(await page.locator('#subtextUndoBtn').isEnabled(), true);
    await page.locator('#subtextUndoBtn').click();
    assert.equal(await page.locator('#subtextSubmitDrawingBtn').isDisabled(), true);
    await sketch();
    await page.locator('#subtextResetBtn').click();
    assert.equal(await page.locator('#subtextSubmitDrawingBtn').isDisabled(), true);
    await sketch();
    await page.locator('#subtextSubmitDrawingBtn').click();
    await page.locator('#subtextDrawingConfirm').waitFor({ state: 'visible' });
    await page.keyboard.press('Escape');
    assert.equal(await page.locator('#subtextDrawingConfirm').isVisible(), false);
    assert.equal(await page.locator('#subtextSubmitDrawingBtn').isEnabled(), true);
    await page.locator('#subtextSubmitDrawingBtn').click();
    await page.locator('#subtextConfirmDrawingBtn').click();
    await page.locator('#subtextGuessingArea').waitFor({ state: 'visible' });
    assert.equal(await page.locator('#subtextCandidateGrid .subtext-drawing-card').count(), 7);
    for (const width of [320, 390, 1024, 1440]) await checkLayout('guessing', width);

    await page.setViewportSize({ width: 390, height: 844 });
    const grid = page.locator('#subtextCandidateGrid');
    const touch = await context.newCDPSession(page);
    const firstDrawing = await grid.locator('.subtext-choice').first().boundingBox();
    const touchPoint = { x: firstDrawing.x + firstDrawing.width / 2, y: firstDrawing.y + firstDrawing.height / 2 };
    await touch.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [touchPoint] });
    for (let step = 1; step <= 8; step += 1) {
      await touch.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: touchPoint.x, y: touchPoint.y - step * 10 }] });
    }
    await touch.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    assert.equal(await page.locator('#subtextSelectedGuess').textContent(), 'Choose a drawing', 'swiping must not select a candidate');
    await touch.detach();
    await grid.evaluate(element => { element.scrollTop = element.scrollHeight; });
    await grid.locator('.subtext-choice').last().click();
    const selection = await page.locator('#subtextSelectedGuess').textContent();
    const scrollTop = await grid.evaluate(element => element.scrollTop);
    await grid.locator('.subtext-zoom-btn').last().click();
    await page.locator('#subtextPreviewDialog').waitFor({ state: 'visible' });
    await page.keyboard.press('Escape');
    assert.equal(await page.locator('#subtextSelectedGuess').textContent(), selection);
    assert.equal(await grid.evaluate(element => element.scrollTop), scrollTop);
    await page.locator('#subtextHelpBtn').click();
    await page.locator('.obg-help-dialog[open] [data-obg-help-lang="en"]').click();
    await page.locator('.obg-help-dialog[open] [data-obg-help-tab="round"]').click();
    await page.locator('.obg-help-dialog[open] [data-obg-help-lang="zh"]').click();
    await page.keyboard.press('Escape');
    assert.equal(await page.locator('#subtextSelectedGuess').textContent(), selection);
    await page.evaluate(() => renderSubtextGameState(lastGameStatePayload));
    assert.equal(await grid.evaluate(element => element.scrollTop), scrollTop);
    assert.equal(await page.locator('#subtextSelectedGuess').textContent(), selection);
    await page.locator('#subtextSubmitGuessBtn').click();
    await submitSecondGuess();
    await page.locator('#subtextResultArea').waitFor({ state: 'visible' });
    for (const width of [320, 390, 1024, 1440]) await checkLayout('reveal', width);
    assert.equal(await page.locator('#subtextNextRoundBtn').isEnabled(), true);
    assert.equal(await page.evaluate(() => lastGameStatePayload.view.phase), 'round_result');
    await page.locator('#subtextNextRoundBtn').click();
    await second.waitForFunction(() => lastGameStatePayload?.view.legal_actions.includes('next_round'));
    await second.locator('#subtextNextRoundBtn').click();
    await page.waitForFunction(() => lastGameStatePayload?.view.round === 2 && lastGameStatePayload.view.phase === 'drawing');
    await page.reload();
    await page.locator('#subtextDrawingArea').waitFor({ state: 'visible' });
    assert.equal(await page.locator('.subtext-scoreboard').evaluate(element => element.open), false);

    for (let round = 2; round <= 8; round += 1) {
      await page.waitForFunction(expected => lastGameStatePayload?.view.round === expected && lastGameStatePayload.view.phase === 'drawing', round);
      await submitSecondDrawing();
      await page.evaluate(() => sendAction({ type: 'submit_drawing', drawing: [[[0.1, 0.2], [0.7, 0.6]]] }));
      await page.waitForFunction(() => lastGameStatePayload?.view.phase === 'guessing');
      await submitSecondGuess();
      await page.evaluate(() => sendAction({ type: 'submit_guess', slot_id: lastGameStatePayload.view.candidates[0].slot_id }));
      await page.waitForFunction(() => ['round_result', 'game_over'].includes(lastGameStatePayload?.view.phase));
      if (round < 8) {
        await second.evaluate(() => sendAction({ type: 'next_round' }));
        await page.evaluate(() => sendAction({ type: 'next_round' }));
      }
    }
    assert.equal(await page.locator('#subtextPlayAgainStatus').textContent(), 'Ready 6/8');
    assert.equal(await page.locator('#subtextPlayAgainBtn').textContent(), 'Ready');
    const finalScores = await page.locator('#subtextResultTableBody').textContent();
    const winner = await page.locator('#subtextWinnerText').textContent();
    for (const width of [320, 390, 1024, 1440]) await checkLayout('game-over', width);
    await page.locator('#subtextPlayAgainBtn').click();
    await page.waitForFunction(() => lastGameStatePayload?.view.next_round_progress.done === 7);
    assert.equal(await page.evaluate(() => lastGameStatePayload.view.phase), 'game_over');
    assert.equal(await page.locator('#subtextPlayAgainBtn').textContent(), 'Ready ✓');
    assert.equal(await page.locator('#subtextPlayAgainBtn').isDisabled(), true);
    assert.equal(await page.locator('#subtextResultTableBody').textContent(), finalScores);
    assert.equal(await page.locator('#subtextWinnerText').textContent(), winner);
    for (const width of [320, 390, 1024, 1440]) await checkLayout('game-over-ready', width);
    await page.reload();
    await page.locator('#subtextGameOverActions').waitFor({ state: 'visible' });
    assert.equal(await page.locator('#subtextPlayAgainBtn').isDisabled(), true);
    assert.equal(await page.locator('#subtextPlayAgainStatus').textContent(), 'Ready 7/8');
    await second.waitForFunction(() => lastGameStatePayload?.view.phase === 'game_over' && lastGameStatePayload.view.next_round_progress.done === 7);
    await second.evaluate(() => setRoomControlsCollapsed(true));
    assert.equal(await second.locator('#subtextPlayAgainBtn').isEnabled(), true);
    await second.locator('#subtextPlayAgainBtn').click();
    await page.waitForFunction(() => lastGameStatePayload?.view.game_index === 2 && lastGameStatePayload.view.phase === 'drawing');
    assert.equal(await page.evaluate(() => lastGameStatePayload.view.round), 1);
    assert.equal(await page.evaluate(() => lastGameStatePayload.view.total_rounds), 8);
    assert.equal(await page.evaluate(() => lastGameStatePayload.view.players.every(player => player.score === 0)), true);
    assert.deepEqual(errors, []);
    console.log('Subtext browser: four widths, drawing and selection, eight rounds, two human Ready barrier, final-score preservation, ready reconnect and new eight-round game passed.');
  } finally {
    if (page) await page.evaluate(() => socket.emit('room:leave', { room_id: roomId })).catch(() => {});
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
