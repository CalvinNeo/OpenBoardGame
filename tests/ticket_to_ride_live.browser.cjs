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
      socket.on('system:error', payload => ttrSystemErrors.push(payload));
    });
    await page.evaluate(() => socket.emit('room:start', { room_id: roomId, config: {} }));

    // The draft dialog opens by itself; keep the preselected tickets.
    // The draft is inline in the ticket panel: tick the offered tickets and keep.
    await page.waitForSelector('#ticketToRideTickets .ttr-ticket-choice');
    assert.equal(await page.locator('#ticketToRideTickets .ttr-ticket.is-offer').count(), 3);
    await waitRoomIdle(page);
    await page.locator('#ticketToRideTickets .ttr-choice-row button').click();
    // Wait for the server to confirm the draft, otherwise the loop below can act
    // on the pre-submit snapshot.
    await page.waitForFunction(() => {
      const v = window.currentTicketToRideView;
      const me = v && v.players.find(p => p.player_id === v.you);
      return Boolean(me && me.ready);
    });

    let steps = 0;
    let shots = 0;
    let retries = 0;
    while (steps < 400) {
      await page.waitForFunction(() => {
        const v = window.currentTicketToRideView;
        return v && (v.game_over || v.legal_actions.length > 0);
      }, null, { timeout: 30000 });
      const state = await page.evaluate(() => window.currentTicketToRideView);
      assert.equal(state.players.filter(p => p.is_bot).length, 2);
      assert.ok(!('deck' in state), 'the deck order is never sent to the client');
      if (state.game_over) break;
      assert.ok(state.players.every(p => p.player_id === state.you || (p.hand === null && p.tickets === null)),
        'other hands and tickets stay hidden until scoring');
      // The snapshot can go stale between the wait and the read while the other
      // seats are still drafting, so simply re-check on the next pass.
      if (!state.legal_actions.length) { retries += 1; if (retries > 15) throw new Error('stalled waiting for a turn'); continue; }

      if (shots < 2 && steps > 6) {
        await page.screenshot({ path: `${output}/live-${shots}.png`, fullPage: true });
        shots += 1;
      }

      await waitRoomIdle(page);
      const legal = state.legal_actions;
      if (legal.includes('keep_tickets')) {
        await page.waitForSelector('#ticketToRideTickets .ttr-choice-row button');
        await page.locator('#ticketToRideTickets .ttr-choice-row button').click();
      } else if (legal.includes('claim_route') && await page.evaluate(() =>
        Boolean(document.querySelector('#ticketToRideMap .ttr-route.is-claimable')))) {
        const route = await page.evaluate(() =>
          document.querySelector('#ticketToRideMap .ttr-route.is-claimable').dataset.route);
        // Centre the route first: the collapsed Room Control docks a bar over the
        // top of the screen, so anything parked at the top is not clickable.
        const point = await page.evaluate(id => {
          const g = document.querySelector(`#ticketToRideMap .ttr-route[data-route="${id}"]`);
          g.scrollIntoView({block: 'center', inline: 'center'});
          const b = g.getBoundingClientRect();
          return { x: b.left + b.width / 2, y: b.top + b.height / 2 };
        }, route);
        assert.ok(point.y > 40 && point.y < 980, 'the route is clear of the room chrome');
        await page.mouse.click(point.x, point.y);
        // A fresh snapshot can land between the read and the click and take the
        // turn away, so treat a missing panel as "retry on the next pass".
        const panel = await page.waitForSelector('#ticketToRideRouteOverlay:not(.hidden)', { timeout: 6000 })
          .catch(() => null);
        if (!panel) { retries += 1; if (retries > 15) throw new Error('stalled opening the claim panel'); continue; }
        await page.locator('#ticketToRideRouteOverlay button', { hasText: 'Claim' }).click();
      } else if (legal.includes('draw_card')) {
        await page.locator('#ticketToRideMarket .ttr-card--deck').click();
      } else if (legal.includes('draw_tickets')) {
        await page.locator('#ticketToRideTicketAction').click();
      } else if (legal.includes('pass')) {
        await page.evaluate(() => sendAction({ type: 'pass', revision: currentTicketToRideView.revision }));
      } else {
        throw new Error('unhandled legal actions: ' + JSON.stringify(legal));
      }
      const before = JSON.stringify(state);
      try {
        await page.waitForFunction(previous => JSON.stringify(window.currentTicketToRideView) !== previous,
          before, { timeout: 15000 });
      } catch (error) {
        // The snapshot went stale before the click landed; re-read and retry.
        retries += 1;
        if (retries > 15) throw new Error('stalled waiting for the state to change');
        continue;
      }
      steps += 1;
      retries = 0;
      if (steps % 10 === 0) console.log('  ...' + steps + ' turns played');
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
