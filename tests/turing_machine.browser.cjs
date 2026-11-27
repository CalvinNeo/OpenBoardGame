const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const base = process.env.ROOM_TEST_URL || 'http://127.0.0.1:8766';
const output = process.env.TURING_UI_OUTPUT || 'tmp/turing-machine-ui';

async function checkLayout(page, label) {
  await page.evaluate(() => { document.activeElement?.blur(); window.scrollTo(0, 0); });
  const issues = await page.evaluate(() => {
    const problems = [];
    if (document.documentElement.scrollWidth > innerWidth) problems.push('page overflow');
    for (const node of document.querySelectorAll('#turingMachinePanel *, .game-panel > .panel-header *, dialog[open] *')) {
      const bounds = node.getBoundingClientRect();
      if (!bounds.width || !bounds.height || node.closest('.hidden')) continue;
      if (node.closest('details:not([open])') && !node.closest('summary')) continue;
      if (bounds.left < -1 || bounds.right > innerWidth + 1) problems.push(`${node.id || node.className}: outside viewport`);
      const style = getComputedStyle(node);
      if (node.clientWidth && node.scrollWidth > node.clientWidth + 2 && !['hidden', 'clip', 'auto', 'scroll'].includes(style.overflowX)) problems.push(`${node.id || node.className}: text overflow`);
    }
    for (const selector of ['.tm-status-bar', '.tm-layout', '.tm-code-buttons', '.tm-note-chip-row', '.tm-verifier-grid', '.tm-section-heading', '.tm-console-footer', '.tm-console-buttons', '.tm-verifier-footer', '.tm-player-grid']) {
      for (const parent of document.querySelectorAll(selector)) {
        if (!parent.getBoundingClientRect().width || parent.closest('.hidden')) continue;
        const boxes = [...parent.children].filter(node => !(selector === '.tm-layout' && node.matches('.tm-notebook') && getComputedStyle(node).position === 'fixed')).map(node => node.getBoundingClientRect()).filter(box => box.width && box.height);
        for (let first = 0; first < boxes.length; first += 1) for (let second = first + 1; second < boxes.length; second += 1) {
          const left = boxes[first], right = boxes[second];
          if (Math.min(left.right, right.right) - Math.max(left.left, right.left) > 1 && Math.min(left.bottom, right.bottom) - Math.max(left.top, right.top) > 1) problems.push(`${selector}: overlap`);
        }
      }
    }
    const header = ['gameReconnectBtn', 'turingMachineHelpBtn'].map(id => document.getElementById(id).getBoundingClientRect());
    if (Math.abs(header[0].top + header[0].height / 2 - header[1].top - header[1].height / 2) > 3) problems.push('Help/Reconnect wrapped');
    return problems;
  });
  await page.screenshot({ path: `${output}/${label}.png`, fullPage: true });
  assert.deepEqual(issues, [], label);
}

(async () => {
  fs.mkdirSync(output, { recursive: true });
  const browser = await chromium.launch({ channel: process.env.BROWSER_CHANNEL || 'chrome', headless: true });
  const contexts = [], clients = [], errors = [];
  async function client(name, touch = false) {
    const context = await browser.newContext({ viewport: { width: touch ? 390 : 1440, height: 900 }, hasTouch: touch, isMobile: touch });
    contexts.push(context);
    const page = await context.newPage();
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(base);
    await page.waitForFunction(() => typeof socket !== 'undefined' && socket.connected && cachedGameList);
    await page.evaluate(name => { window.turingTestName = name; }, name);
    clients.push(page);
    return page;
  }
  async function expandedRoom(page) {
    await page.evaluate(() => { if (typeof setRoomControlsCollapsed === 'function') setRoomControlsCollapsed(false); });
  }
  async function loadFixture(page, view) {
    await page.evaluate(view => renderTuringMachineGameState({ game_type: 'turing_machine', view }), view);
  }
  try {
    const first = await client('Ada Lovelace');
    assert.equal(await first.locator('#turingMachinePanel').evaluate(node => node.childElementCount), 0);
    assert.equal(await first.locator('script[src*="/turing_machine.js"]').count(), 0);
    await first.evaluate(() => socket.emit('room:create', { name: turingTestName, game_type: 'turing_machine' }));
    await first.waitForFunction(() => roomSessionReady && isGameAssetsLoaded('turing_machine'));
    const room = await first.evaluate(() => roomId);
    const second = await client('Grace Hopper', true);
    await second.evaluate(room => socket.emit('room:join', { room_id: room, name: turingTestName }), room);
    await second.waitForFunction(() => roomSessionReady && isGameAssetsLoaded('turing_machine'));
    for (const page of clients) await page.evaluate(() => socket.emit('room:ready', { room_id: roomId, ready: true }));
    await first.waitForFunction(() => !document.getElementById('startBtn').disabled);
    await expandedRoom(first);
    await first.evaluate(() => {
      turingMachineSourceSelect.value = 'preset';
      updateTuringMachineConfigRowsFromSource();
    });
    assert.equal(await first.locator('#turingMachineConfigBox').getAttribute('aria-hidden'), 'false');
    await first.evaluate(() => emitRoomStart());
    for (const page of clients) await page.waitForFunction(() => currentTuringMachineView?.criteria_cards?.length > 0);
    assert.equal(await first.locator('#turingMachineConfigBox').getAttribute('aria-hidden'), 'true');
    assert.equal(await first.locator('#turingMachinePanel select[id$="Select"]').count(), 0);
    const original = await first.evaluate(() => structuredClone(currentTuringMachineView));
    for (const width of [1440, 1024, 390, 320]) {
      await first.setViewportSize({ width, height: 900 });
      await checkLayout(first, `playing-${width}`);
      if (width < 761) await first.locator('#turingMachineNotebookToggle').click();
      await checkLayout(first, `notebook-${width}`);
      if (await first.locator('#turingMachineDeductionToggle').getAttribute('aria-expanded') === 'false') await first.locator('#turingMachineDeductionToggle').click();
      if (await first.locator('#turingMachineClueHistoryToggle').getAttribute('aria-expanded') === 'false') await first.locator('#turingMachineClueHistoryToggle').click();
      await checkLayout(first, `expanded-${width}`);
      if (width < 761) await first.locator('#turingMachineNotebookClose').click();
      await first.locator('#turingMachineGuessBtn').click();
      await checkLayout(first, `confirmation-${width}`);
      await first.keyboard.press('Escape');
      await first.locator('#turingMachineHelpBtn').click();
      const help = first.locator('[data-obg-help-game="turing_machine"]');
      await help.waitFor({ state: 'visible' });
      assert.equal(await help.locator('[role="tab"]').count(), 4);
      for (const language of ['en', 'zh']) {
        await first.evaluate(language => window.obgHelpSetLang(language), language);
        for (let tab = 0; tab < 4; tab += 1) {
          await help.locator('[role="tab"]').nth(tab).click();
          await checkLayout(first, `help-${language}-${tab}-${width}`);
        }
      }
      await first.keyboard.press('Escape');
      assert.equal(await help.isVisible(), false);
    }
    await first.setViewportSize({ width: 1440, height: 900 });
    await first.evaluate(() => window.obgHelpSetLang('en'));
    await first.locator('#turingMachineExplainBtn').click();
    const nextBounds = await first.locator('#turingMachineEndRoundBtn').boundingBox();
    await first.mouse.click(nextBounds.x + nextBounds.width / 2, nextBounds.y + nextBounds.height / 2);
    await first.locator('.obg-explain-dialog[open]').waitFor();
    assert.equal(await first.evaluate(() => currentTuringMachineView.round), 1);
    await first.keyboard.press('Escape');
    await first.locator('#turingMachineExplainBtn').click();
    await first.locator('.tm-verifier-slot').first().click();
    assert((await first.locator('.obg-explain-text').innerText()).includes(original.criteria_cards[0].title));
    await first.keyboard.press('Escape');
    await first.locator('#turingMachineExplainBtn').click();
    await first.keyboard.press('Escape');
    assert.equal(await first.locator('#turingMachineExplainBtn').getAttribute('aria-pressed'), 'false');
    await first.locator('#turingMachineGuessBtn').click();
    await first.locator('#turingMachineCancelBtn').click();
    assert.equal(await first.locator('#turingMachineConfirmation').isVisible(), false);
    await first.locator('#turingMachineGuessBtn').click();
    await first.keyboard.press('Escape');
    assert.equal(await first.locator('#turingMachineConfirmation').isVisible(), false);
    await first.locator('#turingMachineGuessBtn').click();
    await first.locator('.tm-section-heading').first().click();
    assert.equal(await first.locator('#turingMachineConfirmation').isVisible(), false);
    await first.locator('#turingMachineExplainBtn').click();
    await first.locator('#turingMachineClueHistoryToggle').click();
    assert.equal(await first.locator('#turingMachineClueHistoryToggle').getAttribute('aria-expanded'), 'true');
    await first.keyboard.press('Escape');
    await first.locator('.tm-verifier-variant').first().hover();
    assert.equal(await first.locator('#turingMachineTooltip').isVisible(), true);
    await first.mouse.move(0, 0);
    await first.locator('.tm-code-column[data-slot="yellow"] button').nth(1).click();
    await first.locator('.tm-code-column[data-slot="blue"] button').nth(2).click();
    await first.locator('.tm-code-column[data-slot="purple"] button').nth(3).click();
    await first.locator('#turingMachineUseCodeBtn').click();
    await first.waitForFunction(() => currentTuringMachineView.current_round.proposal?.join('') === '234');
    await first.locator('.tm-code-column[data-slot="yellow"] button').nth(4).click();
    assert.equal(await first.evaluate(() => currentTuringMachineView.current_round.proposal.join('')), '234');
    await first.locator('.tm-verifier-footer button').first().click();
    await first.waitForFunction(() => currentTuringMachineView.current_round.tests.length === 1);
    await first.locator('#turingMachineVerifierNoteA').selectOption('0');
    await first.waitForFunction(() => currentTuringMachineView.notes.variant_marks.A[0] === 'confirm');
    await first.locator('.tm-note-chip').first().click();
    await first.waitForFunction(() => currentTuringMachineView.notes.digit_marks.yellow[0] === 'exclude');
    for (const mark of ['keep', 'confirm', 'unknown']) {
      await first.locator('.tm-note-chip').first().click();
      await first.waitForFunction(mark => currentTuringMachineView.notes.digit_marks.yellow[0] === mark, mark);
    }
    assert.equal(await first.locator('#turingMachineVerifierNoteA').inputValue(), '0');
    assert.equal(await second.evaluate(() => currentTuringMachineView.notes.digit_marks.yellow[0]), 'unknown');
    await first.locator('#turingMachineEndRoundBtn').click();
    await first.waitForFunction(() => currentTuringMachineView.current_round.ended);
    assert.equal(await first.evaluate(() => currentTuringMachineView.round), 1);
    assert.equal(await first.locator('#turingMachineEndRoundBtn').innerText(), 'Waiting…');
    await second.locator('#turingMachineUseCodeBtn').tap();
    await second.locator('#turingMachineEndRoundBtn').tap();
    for (const page of clients) await page.waitForFunction(() => currentTuringMachineView.round === 2);
    await second.locator('#turingMachineNotebookToggle').tap();
    for (const collapsed of [false, true, false]) {
      await second.evaluate(collapsed => setRoomControlsCollapsed(collapsed), collapsed);
      assert.equal(await second.locator('#turingMachineExplainBtn:visible').count(), 1);
    }
    await second.evaluate(() => setRoomControlsCollapsed(true));
    const touch = await second.context().newCDPSession(second);
    const markBefore = await second.evaluate(() => JSON.stringify(currentTuringMachineView.notes));
    const chipBounds = await second.locator('.tm-note-chip').first().boundingBox();
    await touch.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: chipBounds.x + 15, y: chipBounds.y + 15 }] });
    await touch.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: chipBounds.x + 15, y: chipBounds.y - 55 }] });
    await touch.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await second.waitForTimeout(1000);
    assert.equal(await second.evaluate(() => JSON.stringify(currentTuringMachineView.notes)), markBefore);
    const scrollArea = second.locator('.tm-notebook-body');
    await second.locator('#turingMachineDeductionToggle').tap();
    await scrollArea.evaluate(node => { node.scrollTop = 190; });
    const select = second.locator('#turingMachineVerifierNoteE');
    await select.scrollIntoViewIfNeeded();
    await select.focus();
    await second.locator('#turingMachineNotes').evaluate(node => node.addEventListener('change', () => {
      window.turingTestScrollAtChange = document.querySelector('.tm-notebook-body').scrollTop;
    }, { once: true, capture: true }));
    await select.selectOption('0');
    await second.waitForFunction(() => currentTuringMachineView.notes.variant_marks.E[0] === 'confirm');
    await second.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    const scrollBefore = await second.evaluate(() => window.turingTestScrollAtChange);
    const scrollAfter = await scrollArea.evaluate(node => node.scrollTop);
    assert(Math.abs(scrollAfter - scrollBefore) < 3, `note update retains notebook scroll: ${scrollBefore} -> ${scrollAfter}`);
    await second.locator('#turingMachineNotebookClose').tap();
    await second.locator('.tm-verifier-variant').first().tap();
    assert.equal(await second.locator('#turingMachineTooltip').isVisible(), true);
    await second.locator('.tm-verifier-variant').nth(1).tap();
    assert((await second.locator('#turingMachineTooltip').innerText()).includes('B:'));
    await second.waitForTimeout(3200);
    assert.equal(await second.locator('#turingMachineTooltip').isVisible(), false);
    await second.locator('.tm-code-btn').first().tap();
    assert.equal(await second.locator('#turingMachineTooltip').isVisible(), false);
    await first.reload();
    await first.waitForFunction(() => roomSessionReady && typeof currentTuringMachineView !== 'undefined' && currentTuringMachineView?.round === 2);
    assert.equal(await first.locator('#turingMachineVerifierNoteA').inputValue(), '0');
    const live = await first.evaluate(() => structuredClone(currentTuringMachineView));
    const stress = structuredClone(live);
    stress.players = Array.from({ length: 6 }, (_, index) => ({ ...live.players[index % 2], name: `Long player name ${index} – 测试完整姓名`, question_count: 120 + index, rounds_completed: 40 }));
    stress.scenario_name = 'LongScenarioNameWithoutSpaces'.repeat(8);
    stress.share_seed = '1234567890'.repeat(8);
    stress.criteria_cards[0].variants[0].label = 'An unusually long verifier option that must wrap rather than overflow its own card';
    stress.criteria_cards[0].variants[0].description = stress.criteria_cards[0].variants[0].label;
    stress.clue_history = Array.from({ length: 120 }, (_, index) => ({ round: index + 1, slot: 'A', proposal: [1, 2, 3], result: index % 2 === 0 }));
    stress.public_log = Array.from({ length: 100 }, (_, index) => ({ message: `Round ${index}: a long public event with several players and checks.` }));
    for (const width of [320, 390, 1024, 1440]) {
      await first.setViewportSize({ width, height: 900 });
      await loadFixture(first, stress);
      await first.locator('.tm-session-details summary').click();
      await checkLayout(first, `stress-${width}`);
      await first.locator('.tm-session-details summary').click();
      const finished = { ...stress, phase: 'game_over', solution: [2, 3, 4], winners: stress.players.slice(0, 2).map(player => player.name), legal_actions: ['update_notes'], players: stress.players.map((player, index) => ({ ...player, status: index < 2 ? 'solved' : 'eliminated', solved_at_round: index < 2 ? 3 : null, solved_at_question_count: index < 2 ? 5 : null })) };
      await loadFixture(first, finished);
      await checkLayout(first, `finished-${width}`);
    }
    await loadFixture(first, { ...live, mode: 'expert', deduction: null });
    assert.equal(await first.locator('#turingMachineDeductionPanel').isVisible(), false);
    await loadFixture(first, live);
    await first.locator('#turingMachineGiveUpBtn').click();
    await first.locator('#turingMachineConfirmBtn').click();
    await second.locator('#turingMachineGuessBtn').tap();
    assert.equal(await second.evaluate(() => currentTuringMachineView.guess_history.length), 0);
    await second.locator('#turingMachineConfirmBtn').tap();
    for (const page of clients) await page.waitForFunction(() => currentTuringMachineView.phase === 'game_over');
    assert.equal(await first.locator('#turingMachineSolutionRow').isVisible(), true);
    assert.deepEqual(errors, []);
    console.log('PASS turing_machine: responsive layouts, bilingual Help, Explain, notes, touch, lock/test, round barrier, reconnect, endgame');
  } finally {
    for (const context of contexts) await context.close();
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
