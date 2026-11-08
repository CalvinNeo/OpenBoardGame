// Live end-to-end check against a real server: create a room, add bots, and
// play a whole game through the actual UI.
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const base = process.env.ROOM_TEST_URL || 'http://127.0.0.1:8766';
const output = 'tmp/ticket-to-ride-live';
fs.mkdirSync(output, { recursive: true });

// sendAction() is a no-op while a room request is still in flight, so every
// interaction has to wait for the room to go quiet first.
async function waitRoomIdle(page) {
  await page.waitForFunction(() =>
    typeof socket !== 'undefined' && socket.connected && roomSessionReady && !pendingRoomRequest);
}

(async () => {
  const browser = await chromium.launch({ channel: process.env.BROWSER_CHANNEL || 'chrome', headless: true });
  const errors = [];
  const systemErrors = [];
  try {
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
    const page = await context.newPage();
    page.on('pageerror', error => errors.push(error.message));
    await page.route('https://fonts.googleapis.com/**', route => route.abort());
    await page.goto(base);
    await page.waitForFunction(() => typeof socket !== 'undefined' && socket.connected);

    if (!(await page.locator('#createBtn').isVisible())) {
      await page.locator('#roomControlsToggleBtn').click();
    }
    await page.locator('#createBtn').click();
    if (await page.locator('#playerNameModal').isVisible()) {
      await page.locator('#nameInput').fill('Ticket QA');
      await page.locator('#playerNameForm button[type=submit]').click();
    }
    await page.locator('#gameSearchInput').fill('铁路环游');
    const item = page.locator('#gameList [data-game-id="ticket_to_ride"]');
    await item.waitFor();
    assert.equal(await item.locator('.game-item-ai').textContent(), '🤖', 'catalog marks the strategic bot');
    assert.match(await item.getAttribute('aria-label'), /Strategic AI available/);
    assert.match(await item.innerText(), /1\.82/, 'catalog shows the BGG weight');

    await item.click();
    await page.waitForFunction(() => roomSessionReady && currentGameType === 'ticket_to_ride');
    await page.waitForFunction(() => isGameAssetsLoaded('ticket_to_ride'));

    if (!(await page.locator('#addBotBtn').isVisible())) {
      await page.locator('#roomControlsToggleBtn').click();
    }
    for (const count of [2, 3]) {
      await page.locator('#addBotBtn').click();
      await page.waitForFunction(expected => currentRoomState.players.length === expected, count);
    }
    await page.evaluate(() => {
      window.ttrSystemErrors = [];
      window.ttrSent = [];
      socket.on('system:error', payload => ttrSystemErrors.push(payload));
      const real = window.sendAction;
      window.sendAction = action => {
        ttrSent.push({ action: JSON.parse(JSON.stringify(action)),
          conn: { connected: socket.connected, ready: roomSessionReady, room: !!roomId,
                  pendingRoom: !!pendingRoomRequest, logout: !!pendingLogoutRequest,
                  recovery: !!pendingAccessKeyRecovery } });
        return real(action);
      };
      window.ttrStates = [];
      socket.on('game:state', payload => {
        const v = payload && payload.view;
        if (!v) return;
        const me = v.players.find(p => p.player_id === v.you);
        ttrStates.push({ rev: v.revision, phase: v.phase, ready: me && me.ready,
                         pend: me && me.pending_tickets ? me.pending_tickets.length : null });
      });
      window.ttrEmits = [];
      const realEmit = socket.emit.bind(socket);
      socket.emit = (name, payload) => {
        if (name === 'game:action') ttrEmits.push(JSON.parse(JSON.stringify(payload)));
        return realEmit(name, payload);
      };
    });
    await page.evaluate(() => socket.emit('room:start', { room_id: roomId, config: {} }));

    // The draft dialog opens by itself; keep the preselected tickets.
    await page.waitForSelector('.ttr-dialog[open] .ttr-ticket-choice');
    await waitRoomIdle(page);
    await page.locator('.ttr-dialog[open] .ttr-dialog-actions button').click();
    await page.waitForFunction(() => !document.getElementById('ticketToRideDialog').open);

    let steps = 0;
    let shots = 0;
    while (steps < 400) {
      await page.waitForFunction(() => {
        const v = window.currentTicketToRideView;
        return v && (v.game_over || v.legal_actions.length > 0);
      }, null, { timeout: 30000 });
      const state = await page.evaluate(() => window.currentTicketToRideView);
      assert.equal(state.players.filter(p => p.is_bot).length, 2);
      assert.ok(!('deck' in state), 'the deck order is never sent to the client');
      assert.ok(state.players.every(p => p.player_id === state.you || (p.hand === null && p.tickets === null)),
        'other hands and tickets stay hidden');
      if (state.game_over) break;
      // The snapshot can go stale between the wait and the read while the other
      // seats are still drafting, so simply re-check on the next pass.
      if (!state.legal_actions.length) continue;

      if (shots < 2 && steps > 6) {
        await page.screenshot({ path: `${output}/live-${shots}.png`, fullPage: true });
        shots += 1;
      }

      await waitRoomIdle(page);
      const legal = state.legal_actions;
      if (process.env.TTR_DEBUG) {
        console.log('STEP', steps, 'phase', state.phase, 'stage', state.stage, 'legal', JSON.stringify(legal),
          'dialog', await page.evaluate(() => document.getElementById('ticketToRideDialog')?.open),
          'you', state.you, JSON.stringify(state.players.map(p => ({ id: p.player_id, bot: p.is_bot, ready: p.ready, pend: p.pending_tickets ? p.pending_tickets.length : null, tk: p.ticket_count }))),
          'sent', JSON.stringify(await page.evaluate(() => ttrSent)),
          'errs', JSON.stringify(await page.evaluate(() => ttrSystemErrors)),
          'emits', JSON.stringify(await page.evaluate(() => ttrEmits)),
          'states', JSON.stringify(await page.evaluate(() => ttrStates)));
      }
      if (legal.includes('keep_tickets')) {
        await page.waitForSelector('.ttr-dialog[open] .ttr-dialog-actions button');
        await page.locator('.ttr-dialog[open] .ttr-dialog-actions button').click();
      } else if (legal.includes('claim_route')) {
        const route = await page.evaluate(() =>
          document.querySelector('#ticketToRideMap .ttr-route.is-claimable')?.dataset.route);
        assert.ok(route, 'a claimable route is highlighted on the map');
        const point = await page.evaluate(id => {
          const g = document.querySelector(`#ticketToRideMap .ttr-route[data-route="${id}"]`);
          const b = g.getBoundingClientRect();
          return { x: b.left + b.width / 2, y: b.top + b.height / 2 };
        }, route);
        await page.mouse.click(point.x, point.y);
        await page.waitForSelector('#ticketToRideRouteOverlay:not(.hidden)');
        await page.locator('#ticketToRideRouteOverlay button', { hasText: 'Claim' }).click();
      } else if (legal.includes('draw_card')) {
        await page.locator('#ticketToRideMarket .ttr-card--deck').click();
      } else if (legal.includes('draw_tickets')) {
        await page.locator('#ticketToRideAction button', { hasText: 'Draw Tickets' }).click();
      } else if (legal.includes('pass')) {
        await page.evaluate(() => sendAction({ type: 'pass', revision: currentTicketToRideView.revision }));
      } else {
        throw new Error('unhandled legal actions: ' + JSON.stringify(legal));
      }
      const before = JSON.stringify(state);
      await page.waitForFunction(previous => JSON.stringify(window.currentTicketToRideView) !== previous,
        before, { timeout: 30000 });
      steps += 1;
    }

    const final = await page.evaluate(() => window.currentTicketToRideView);
    assert.ok(final.game_over, 'the game reaches a scored finish');
    assert.ok(final.winner_ids.length > 0);
    assert.ok(final.final_results.every(r => typeof r.total === 'number'));
    await page.screenshot({ path: `${output}/live-final.png`, fullPage: true });
    assert.deepEqual(await page.evaluate(() => ttrSystemErrors), [], 'no server-side rejections');
    assert.deepEqual(errors, [], 'no page errors');
    console.log(`ticket_to_ride live game finished in ${steps} human turns`);
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exit(1); });
