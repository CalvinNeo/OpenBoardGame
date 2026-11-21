const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const base = process.env.ROOM_TEST_URL || 'http://127.0.0.1:8778';

(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.route('https://fonts.googleapis.com/**', route => route.abort());
  try {
    await page.goto(base);
    await page.waitForFunction(() => typeof socket !== 'undefined' && socket.connected && cachedGameList);
    await page.evaluate(() => socket.emit('room:create', { name: 'Flip 7 QA', game_type: 'flip7' }));
    await page.waitForFunction(() => roomSessionReady && isGameAssetsLoaded('flip7'));
    await page.evaluate(() => socket.emit('room:add_bot', { room_id: roomId }));
    await page.waitForFunction(() => currentRoomState.players.length === 2);
    await page.evaluate(() => socket.emit('room:ready', { room_id: roomId, ready: true }));
    await page.waitForFunction(() => !document.getElementById('startBtn').disabled);
    await page.locator('#startBtn').click();
    await page.waitForFunction(() => lastGameStatePayload?.game_type === 'flip7');
    await page.locator('#flip7Panel').waitFor({ state: 'visible' });
    assert.equal(await page.locator('#flip7HelpBtn').count(), 1);
    fs.mkdirSync('tmp/flip7-qa/screenshots', { recursive: true });

    const snapshot = await page.evaluate(() => JSON.parse(JSON.stringify(lastGameStatePayload)));
    await page.evaluate(() => {
      window.flip7QaSent = [];
      window.flip7QaOriginalSend = sendAction;
      sendAction = action => window.flip7QaSent.push(action);
    });

    async function fixture(phase = 'playing') {
      await page.evaluate(({ payload, phase }) => {
        const view = payload.view;
        const self = view.players.find(player => player.player_id === view.you);
        const rival = view.players.find(player => player.player_id !== view.you);
        self.name = 'Alexandria the extraordinary card collector';
        self.tableau = [0, 2, 4, 6, 8, 10].map(value => ({ type: 'number', value, label: String(value) }));
        self.tableau.push({ type: 'modifier', multiplier: 2, label: '×2' });
        self.tableau.push({ type: 'modifier', points: 10, label: '+10' });
        self.tableau.push({ type: 'action', action: 'second_chance', label: 'Second Chance' });
        self.numbers_count = 6;
        self.potential_score = 70;
        self.score = 123;
        self.status = 'active';
        self.round_score = null;
        self.busted = false;
        rival.tableau = [{ type: 'number', value: 12, label: '12' }];
        rival.numbers_count = 1;
        rival.status = 'active';
        rival.potential_score = 12;
        view.phase = phase;
        view.current_turn = view.you;
        view.legal_actions = phase === 'playing' ? ['flip', 'stay'] : phase === 'round_end' ? ['next_round'] : [];
        view.game_over = phase === 'game_over';
        view.winner = phase === 'game_over' ? [view.you] : null;
        view.pending_action = phase === 'action_target' ? {
          actor_id: view.you, action: 'freeze', label: 'Freeze', eligible_targets: view.players.map(player => player.player_id)
        } : null;
        if (phase === 'action_target') view.legal_actions = ['choose_target'];
        view.round_ready = [];
        view.last_round_summary = {
          round: 9, reason: 'all_done', round_scores: { [view.you]: 70, [rival.player_id]: 0 },
          total_scores: { [view.you]: 193, [rival.player_id]: 120 },
          breakdowns: { [rival.player_id]: { busted: true } },
          flips: { [view.you]: self.tableau, [rival.player_id]: [...rival.tableau, ...rival.tableau] }
        };
        renderFlip7GameState(payload);
      }, { payload: JSON.parse(JSON.stringify(snapshot)), phase });
    }

    await fixture();
    for (const width of [320, 390, 1024, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      await page.evaluate(() => document.activeElement?.blur());
      await page.locator('.game-panel').scrollIntoViewIfNeeded();
      const layout = await page.evaluate(() => {
        const rectangle = id => document.getElementById(id).getBoundingClientRect();
        const help = rectangle('flip7HelpBtn');
        const reconnect = rectangle('gameReconnectBtn');
        const explain = rectangle('flip7ExplainBtn');
        return {
          overflow: document.documentElement.scrollWidth > innerWidth,
          headerAligned: Math.abs(help.top - reconnect.top) < 6,
          headerContained: explain.right <= innerWidth && reconnect.left >= 0,
          spills: [...document.querySelectorAll('#flip7Panel .flip7-card, #flip7Panel .flip7-player, #flip7Panel button')]
            .filter(node => node.scrollWidth > node.clientWidth + 1).map(node => node.className)
        };
      });
      assert.equal(layout.overflow, false, JSON.stringify({ width, layout }));
      assert.equal(layout.headerAligned, true, JSON.stringify({ width, layout }));
      assert.equal(layout.headerContained, true, JSON.stringify({ width, layout }));
      assert.deepEqual(layout.spills, [], JSON.stringify({ width, layout }));
      await page.screenshot({ path: `tmp/flip7-qa/screenshots/playing-${width}.png`, fullPage: true });
    }

    await page.setViewportSize({ width: 390, height: 844 });
    await page.locator('#flip7HelpBtn').click();
    await page.locator('dialog.obg-help-dialog[open]').waitFor();
    await page.locator('[data-obg-help-lang="en"]').click();
    await page.locator('[data-obg-help-tab="actions"]').click();
    assert.match(await page.locator('.obg-help-body').innerText(), /Second Chance\(🛡\)/);
    await page.locator('[data-obg-help-lang="zh"]').click();
    assert.match(await page.locator('.obg-help-body').innerText(), /连.*三张/);
    await page.keyboard.press('Escape');
    assert.equal(await page.locator('dialog[open]').count(), 0);

    await fixture('action_target');
    const before = await page.evaluate(() => flip7QaSent.length);
    await page.locator('#flip7ExplainBtn').click();
    await page.locator('#flip7FlipBtn').dispatchEvent('pointerdown', { isPrimary: true, button: 0, pointerId: 2, clientX: 0, clientY: 0 });
    await page.locator('#flip7FlipBtn').evaluate(element => {
      const box = element.getBoundingClientRect();
      for (const type of ['pointerdown', 'pointerup']) element.dispatchEvent(new PointerEvent(type, {
        bubbles: true, isPrimary: true, pointerId: 3, button: 0, clientX: box.left + 8, clientY: box.top + 8
      }));
    });
    await page.locator('dialog.obg-explain-dialog[open]').waitFor();
    assert.equal(await page.evaluate(() => flip7QaSent.length), before);
    await page.keyboard.press('Escape');
    await page.locator('#flip7Players .flip7-target-button').last().click();
    assert.equal(await page.evaluate(() => flip7QaSent.at(-1).type), 'choose_target');

    await fixture();
    const firstCard = page.locator('#flip7Players .flip7-card').first();
    await page.locator('#flip7ExplainBtn').click();
    await firstCard.click();
    await page.locator('dialog.obg-explain-dialog[open]').waitFor();
    assert.match(await page.locator('.obg-explain-text').innerText(), /数字 0/);
    await page.keyboard.press('Escape');
    await firstCard.scrollIntoViewIfNeeded();
    await firstCard.tap();
    await page.locator('#flip7Tooltip').waitFor({ state: 'visible' });
    await page.waitForFunction(() => document.getElementById('flip7Tooltip').classList.contains('hidden'), null, { timeout: 5000 });
    await firstCard.evaluate(element => {
      const box = element.getBoundingClientRect();
      for (const [type, offset] of [['pointerdown', 0], ['pointermove', 35], ['pointerup', 35]]) element.dispatchEvent(new PointerEvent(type, {
        bubbles: true, pointerType: 'touch', isPrimary: true, pointerId: 4, clientX: box.left + 5, clientY: box.top + 5 + offset
      }));
    });
    assert.equal(await page.locator('#flip7Tooltip').isVisible(), false);
    await page.locator('#flip7StayBtn').click();
    assert.equal(await page.evaluate(() => flip7QaSent.at(-1).type), 'stay');

    await fixture('round_end');
    assert.equal(await page.locator('#flip7Results').evaluate(element => element.open), true);
    assert.match(await page.locator('#flip7LastRound').innerText(), /\+70/);
    assert.match(await page.locator('#flip7LastRound').innerText(), /Busted/);
    await page.locator('#flip7NextRoundBtn').click();
    assert.equal(await page.evaluate(() => flip7QaSent.at(-1).type), 'next_round');
    await page.screenshot({ path: 'tmp/flip7-qa/screenshots/round-end-390.png', fullPage: true });
    await page.evaluate(() => {
      const payload = JSON.parse(JSON.stringify(lastGameStatePayload));
      payload.view.you = 'spectator';
      payload.view.legal_actions = [];
      payload.view.pending_action = null;
      renderFlip7GameState(payload);
    });
    assert.equal(await page.locator('#flip7Players .flip7-player.self').count(), 0);
    assert.equal(await page.locator('#flip7FlipBtn').isVisible(), false);
    await fixture('game_over');
    assert.match(await page.locator('#flip7Status').innerText(), /Winner:/);
    assert.equal(await page.locator('#flip7NextRoundBtn').isVisible(), false);

    await page.evaluate(() => { sendAction = flip7QaOriginalSend; });
    await page.reload();
    await page.waitForFunction(() => isGameAssetsLoaded('flip7') && lastGameStatePayload?.game_type === 'flip7');
    assert.equal(await page.locator('#flip7HelpBtn').count(), 1);
    assert.equal(await page.locator('#flip7Panel').isVisible(), true);
    for (let step = 0; step < 30; step++) {
      await page.waitForFunction(() => currentFlip7View?.phase === 'round_end' || currentFlip7View?.legal_actions?.length);
      if (await page.evaluate(() => currentFlip7View.phase === 'round_end')) break;
      const version = await page.evaluate(() => lastGameStatePayload.state_version);
      await page.evaluate(() => {
        const legal = currentFlip7View.legal_actions;
        if (legal.includes('choose_target')) sendAction({ type: 'choose_target', target_player_id: currentFlip7View.pending_action.eligible_targets[0] });
        else if (legal.includes('stay')) sendAction({ type: 'stay' });
      });
      await page.waitForFunction(version => lastGameStatePayload.state_version !== version, version);
    }
    await page.waitForFunction(() => currentFlip7View.phase === 'round_end' && currentFlip7View.round_ready.length === 1);
    const pausedRound = await page.evaluate(() => currentFlip7View.round);
    assert.equal(await page.locator('#flip7NextRoundBtn').isEnabled(), true);
    await page.locator('#flip7NextRoundBtn').click();
    await page.waitForFunction(round => currentFlip7View.round === round + 1, pausedRound);
    assert.equal(await page.evaluate(() => currentFlip7View.round_ready.length), 0);
    assert.deepEqual(errors, []);
    console.log('Flip 7: live bot room/start/reload/round acknowledgment, four widths, Help/Escape, disabled Explain, target selection, touch tips/scroll, bank, round summary/continue, and winner passed.');
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exit(1); });
