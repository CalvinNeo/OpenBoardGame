const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const base = process.env.ROOM_TEST_URL || 'http://127.0.0.1:8802';
const output = 'tmp/cockroach-poker-ui';
const widths = [320, 390, 1024, 1440];

async function layout(page, label) {
  await page.evaluate(() => window.scrollTo(0, 0));
  const issues = await page.evaluate(() => {
    const bad = [];
    for (const node of document.querySelectorAll('#cockroachPokerPanel *, .game-panel > .panel-header *, dialog[open] *')) {
      const box = node.getBoundingClientRect();
      if (!box.width || !box.height || node.closest('.hidden') || node.closest('dialog:not([open])')) continue;
      if (node.closest('details:not([open])') && !node.closest('summary')) continue;
      if (node.closest('svg')) continue;
      const style = getComputedStyle(node);
      if (box.left < -1 || box.right > innerWidth + 1) bad.push(`${node.id || node.className}: outside viewport`);
      if (node.clientWidth && node.scrollWidth > node.clientWidth + 2 && !['auto', 'scroll', 'hidden', 'clip'].includes(style.overflowX)) {
        bad.push(`${node.id || node.className}: content overflow ${node.scrollWidth}/${node.clientWidth}`);
      }
    }
    for (const selector of ['.cp-players', '.cp-hand', '.cp-claims', '.cp-targets', '.cp-decisions']) {
      const boxes = [...document.querySelector(selector).children].map(node => node.getBoundingClientRect()).filter(box => box.width && box.height);
      for (let first = 0; first < boxes.length; first += 1) {
        for (let second = first + 1; second < boxes.length; second += 1) {
          const left = boxes[first], right = boxes[second];
          if (Math.min(left.right, right.right) - Math.max(left.left, right.left) > 1
              && Math.min(left.bottom, right.bottom) - Math.max(left.top, right.top) > 1) bad.push(`${selector}: overlap`);
        }
      }
    }
    const header = ['gameReconnectBtn', 'cockroachPokerHelpBtn'].map(id => document.getElementById(id).getBoundingClientRect()).filter(box => box.width && box.height);
    if (header.length === 2 && Math.abs(header[0].top + header[0].height / 2 - header[1].top - header[1].height / 2) > 3) bad.push('Help/Reconnect line break');
    return { pageOverflow: document.documentElement.scrollWidth > innerWidth, bad };
  });
  await page.screenshot({ path: `${output}/${label}.png`, fullPage: true });
  assert.deepEqual(issues, { pageOverflow: false, bad: [] }, label);
}

async function waitPhase(page, phase) {
  await page.waitForFunction(phase => lastGameStatePayload?.game_type === 'cockroach_poker' && lastGameStatePayload.view.phase === phase, phase);
}

async function action(page, type, fields = {}) {
  await page.evaluate(({ type, fields }) => socket.emit('game:action', {
    action: { type, revision: lastGameStatePayload.view.revision, ...fields }
  }), { type, fields });
}

(async () => {
  fs.mkdirSync(output, { recursive: true });
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const contexts = [];
  const pages = [];
  const errors = [];
  async function client(name) {
    const context = await browser.newContext({ viewport: { width: 390, height: 900 }, hasTouch: true });
    contexts.push(context);
    const page = await context.newPage();
    pages.push(page);
    page.on('pageerror', error => errors.push(error.message));
    await page.route('https://fonts.googleapis.com/**', route => route.abort());
    await page.goto(base);
    await page.waitForFunction(() => typeof socket !== 'undefined' && socket.connected && cachedGameList);
    await page.evaluate(name => { window.cpTestName = name; }, name);
    return page;
  }
  try {
    const first = await client('Alice');
    assert.equal(await first.locator('#cockroachPokerPanel').evaluate(node => node.children.length), 0);
    assert.equal(await first.locator('script[src*="/cockroach_poker.js"]').count(), 0);
    assert.equal(await first.locator('link[href*="/cockroach_poker.css"]').count(), 0);
    await first.evaluate(() => socket.emit('room:create', { name: cpTestName, game_type: 'cockroach_poker' }));
    await first.waitForFunction(() => roomSessionReady && currentGameType === 'cockroach_poker' && isGameAssetsLoaded('cockroach_poker'));
    await first.locator('#cockroachPokerLobby').waitFor({ state: 'visible' });
    const room = await first.evaluate(() => roomId);
    const second = await client('Bob');
    const third = await client('Carol');
    for (const page of [second, third]) {
      await page.evaluate(room => socket.emit('room:join', { room_id: room, name: cpTestName }), room);
      await page.waitForFunction(() => roomSessionReady && currentGameType === 'cockroach_poker' && isGameAssetsLoaded('cockroach_poker'));
    }
    for (const page of pages) await page.evaluate(() => socket.emit('room:ready', { ready: true }));
    await first.waitForFunction(() => !document.getElementById('startBtn').disabled);
    await first.locator('#startBtn').click();
    for (const page of pages) await waitPhase(page, 'offer');
    const ids = await Promise.all(pages.map(page => page.evaluate(() => lastGameStatePayload.view.you)));
    const actorId = await first.evaluate(() => lastGameStatePayload.view.active_player);
    const actor = pages[ids.indexOf(actorId)];
    const receiver = pages.find(page => page !== actor);
    const receiverId = ids[pages.indexOf(receiver)];
    const finalReceiver = pages.find(page => page !== actor && page !== receiver);
    const finalId = ids[pages.indexOf(finalReceiver)];
    for (const page of pages) await page.evaluate(() => setRoomControlsCollapsed(true));
    const liveOffer = await actor.evaluate(() => structuredClone(lastGameStatePayload));
    const sixPlayer = structuredClone(liveOffer);
    for (let index = 3; index < 6; index += 1) {
      sixPlayer.view.players.push({ ...structuredClone(sixPlayer.view.players[0]),
        player_id: `layout-guest-${index}`, name: `Guest ${index + 1} with a long name 名字`, is_you: false, is_bot: true });
    }
    sixPlayer.view.targets = sixPlayer.view.players.filter(player => !player.is_you).map(player => player.player_id);
    for (const width of widths) {
      await actor.setViewportSize({ width, height: 900 });
      await actor.evaluate(payload => renderCockroachPokerGameState(payload), sixPlayer);
      await actor.locator('#cockroachPokerHand button').first().click();
      await layout(actor, `six-player-${width}`);
    }
    const spectator = structuredClone(sixPlayer);
    spectator.view.you = 'spectator';
    spectator.view.hand = [];
    spectator.view.hand_count = 0;
    spectator.view.legal_actions = [];
    spectator.view.players.forEach(player => { player.is_you = false; });
    await actor.evaluate(payload => renderCockroachPokerGameState(payload), spectator);
    assert.equal(await actor.locator('#cockroachPokerHand button').count(), 0);
    assert.equal(await actor.locator('#cockroachPokerDecisions button').count(), 0);
    await actor.evaluate(payload => renderCockroachPokerGameState(payload), liveOffer);
    for (const width of widths) {
      await actor.setViewportSize({ width, height: 900 });
      await actor.locator('#cockroachPokerHand button').first().click();
      await layout(actor, `offer-${width}`);
      await actor.keyboard.press('Escape');
      assert.equal(await actor.locator('#cockroachPokerHand [aria-pressed="true"]').count(), 0);
    }
    await actor.setViewportSize({ width: 390, height: 900 });
    await actor.locator('#cockroachPokerHand button').first().click();
    await actor.locator('#cockroachPokerClaims button').first().click();
    const receiverName = await receiver.evaluate(() => lastGameStatePayload.view.players.find(player => player.is_you).name);
    await actor.locator('#cockroachPokerTargets button').filter({ hasText: receiverName }).click();
    assert.equal(await actor.locator('#cockroachPokerSendBtn').isEnabled(), true);
    await actor.locator('#cockroachPokerSendBtn').click();
    await waitPhase(receiver, 'receive');
    assert.equal(await receiver.evaluate(() => lastGameStatePayload.view.pending.card), null);
    assert.equal(await receiver.locator('.cp-secret').count(), 0);
    assert.equal(await finalReceiver.evaluate(() => lastGameStatePayload.view.pending.card), null);
    await receiver.locator('#cockroachPokerDecisions button').filter({ hasText: 'Peek & pass' }).click();
    await waitPhase(receiver, 'pass');
    assert.ok(await receiver.evaluate(() => lastGameStatePayload.view.pending.card));
    assert.equal(await receiver.locator('.cp-secret').count(), 1);
    assert.equal(await finalReceiver.locator('.cp-secret').count(), 0);
    for (const width of widths) {
      await receiver.setViewportSize({ width, height: 900 });
      await layout(receiver, `peek-${width}`);
    }
    await receiver.reload();
    await receiver.waitForFunction(() => roomSessionReady && isGameAssetsLoaded('cockroach_poker') && lastGameStatePayload?.view?.phase === 'pass');
    assert.ok(await receiver.evaluate(() => lastGameStatePayload.view.pending.card));
    const actualKind = await receiver.evaluate(() => lastGameStatePayload.view.pending.card.kind);
    await action(receiver, 'pass', { target: finalId, claim: actualKind });
    await waitPhase(finalReceiver, 'receive');
    assert.deepEqual(await finalReceiver.locator('#cockroachPokerDecisions button').allTextContents(), ['True', 'False']);
    for (const width of widths) {
      await finalReceiver.setViewportSize({ width, height: 900 });
      await layout(finalReceiver, `receive-${width}`);
    }
    await finalReceiver.locator('#cockroachPokerDecisions button').filter({ hasText: 'True', exact: true }).click();
    for (const page of pages) await waitPhase(page, 'review');
    assert.equal(await first.evaluate(() => lastGameStatePayload.view.last_result.collector), receiverId);
    const review = await first.evaluate(() => structuredClone(lastGameStatePayload));
    for (const width of widths) {
      await first.setViewportSize({ width, height: 900 });
      await layout(first, `review-${width}`);
    }
    await action(first, 'continue');
    await second.waitForFunction(() => lastGameStatePayload.view.ready.length === 1);
    await action(second, 'continue');
    await third.waitForFunction(() => lastGameStatePayload.view.ready.length === 2);
    assert.equal(await third.evaluate(() => lastGameStatePayload.view.phase), 'review');
    await action(third, 'continue');
    for (const page of pages) await waitPhase(page, 'offer');
    assert.equal(await first.evaluate(() => lastGameStatePayload.view.active_player), receiverId);

    for (const width of widths) {
      await first.setViewportSize({ width, height: 900 });
      await first.locator('#cockroachPokerHelpBtn').click();
      const help = first.locator('dialog[data-obg-help-game="cockroach_poker"]');
      await help.waitFor({ state: 'visible' });
      for (const language of ['en', 'zh']) {
        await help.locator(`[data-obg-help-lang="${language}"]`).click();
        for (const tab of ['__basic', 'exchange', 'creatures', 'end']) {
          await help.locator(`[data-obg-help-tab="${tab}"]`).click();
          await layout(first, `help-${language}-${tab}-${width}`);
        }
      }
      await first.keyboard.press('Escape');
      await help.waitFor({ state: 'hidden' });
    }
    await first.setViewportSize({ width: 390, height: 900 });
    const beforeExplain = await first.evaluate(() => lastGameStatePayload.view.revision);
    await first.evaluate(() => {
      const payload = structuredClone(lastGameStatePayload);
      payload.view.legal_actions = [];
      renderCockroachPokerGameState(payload);
    });
    await first.locator('#cockroachPokerExplainBtn').click();
    const disabledCard = first.locator('#cockroachPokerHand button').first();
    assert.equal(await disabledCard.isDisabled(), true);
    const cardBox = await disabledCard.boundingBox();
    await first.mouse.click(cardBox.x + cardBox.width / 2, cardBox.y + cardBox.height / 2);
    const explanation = first.locator('dialog.obg-explain-dialog[open]');
    await explanation.waitFor({ state: 'visible' });
    assert.equal(await first.evaluate(() => lastGameStatePayload.view.revision), beforeExplain);
    await first.keyboard.press('Escape');
    await explanation.waitFor({ state: 'hidden' });
    await first.locator('#cockroachPokerExplainBtn').click();
    await first.locator('#cockroachPokerHelpBtn').click();
    await first.keyboard.press('Escape');
    assert.equal(await first.locator('#cockroachPokerExplainBtn').getAttribute('aria-pressed'), 'false');

    const final = structuredClone(review);
    final.view.phase = 'final_review';
    final.view.revision += 100;
    final.view.loser = final.view.players[0].player_id;
    final.view.loss_reason = 'same_kind';
    final.view.winners = final.view.players.slice(1).map(player => player.player_id);
    final.view.legal_actions = ['confirm'];
    final.view.players.forEach((player, index) => { player.name = `${['Alexandria', 'Bartholomew', 'Christabelle'][index]} an unusually long player name 名字`; });
    for (const width of widths) {
      await first.setViewportSize({ width, height: 900 });
      await first.evaluate(payload => renderCockroachPokerGameState(payload), final);
      await layout(first, `final-${width}`);
    }
    await first.setViewportSize({ width: 390, height: 900 });
    await first.locator('.cp-count').first().tap();
    await first.locator('#cockroachPokerTooltip').waitFor({ state: 'visible' });
    await first.waitForTimeout(3200);
    await first.locator('#cockroachPokerTooltip').waitFor({ state: 'hidden' });
    await first.evaluate(payload => renderCockroachPokerGameState(payload), liveOffer);
    await first.locator('#cockroachPokerHand button').first().click();
    await first.locator('#cockroachPokerExchange').click({ position: { x: 3, y: 3 } });
    assert.equal(await first.locator('#cockroachPokerHand [aria-pressed="true"]').count(), 0);
    await first.evaluate(() => {
      const node = document.querySelector('#cockroachPokerHand button');
      const options = { bubbles: true, pointerId: 17, pointerType: 'touch', clientX: 40, clientY: 200 };
      node.dispatchEvent(new PointerEvent('pointerdown', options));
      document.dispatchEvent(new PointerEvent('pointermove', { ...options, clientY: 240 }));
      document.dispatchEvent(new PointerEvent('pointerup', { ...options, clientY: 240 }));
      node.click();
    });
    assert.equal(await first.locator('#cockroachPokerHand [aria-pressed="true"]').count(), 0);
    await first.evaluate(() => showCockroachPokerHeaderActions(false));
    assert.equal(await first.locator('#cockroachPokerHand button').count(), 0);
    assert.equal(await first.locator('#cockroachPokerPlayers article').count(), 0);

    const solo = await client('Bluff tester');
    await solo.evaluate(() => socket.emit('room:create', { name: cpTestName, game_type: 'cockroach_poker' }));
    await solo.waitForFunction(() => roomSessionReady && isGameAssetsLoaded('cockroach_poker'));
    await solo.evaluate(() => socket.emit('room:add_bot', { name: 'Poker face' }));
    await solo.waitForFunction(() => currentRoomState.players.length === 2);
    await solo.evaluate(() => socket.emit('room:ready', { ready: true }));
    await solo.waitForFunction(() => !document.getElementById('startBtn').disabled);
    await solo.locator('#startBtn').click();
    await solo.waitForFunction(() => lastGameStatePayload?.game_type === 'cockroach_poker');
    const soloRoom = await solo.evaluate(() => roomId);
    let confirmedFinal = false;
    let judgments = 0;
    let botOffers = 0;
    for (let index = 0; index < 350; index += 1) {
      await solo.waitForFunction(() => lastGameStatePayload?.view?.game_over || lastGameStatePayload?.view?.legal_actions.length > 0);
      const current = await solo.evaluate(() => structuredClone(lastGameStatePayload.view));
      assert.equal(current.loss_limit, 5);
      if (current.game_over) break;
      if (current.legal_actions.includes('offer')) {
        await solo.locator('#cockroachPokerHand button').first().click();
        await solo.locator('#cockroachPokerClaims button').first().click();
        await solo.locator('#cockroachPokerTargets button').first().click();
        await solo.locator('#cockroachPokerSendBtn').click();
      } else if (current.legal_actions.includes('judge')) {
        judgments += 1;
        botOffers += 1;
        assert.equal(current.pending.card, null);
        assert.deepEqual(current.legal_actions, ['judge']);
        await solo.locator('#cockroachPokerDecisions button').filter({ hasText: 'True', exact: true }).click();
      } else if (current.legal_actions.includes('continue')) {
        await solo.locator('#cockroachPokerDecisions button').filter({ hasText: 'Next Round' }).click();
      } else if (current.legal_actions.includes('confirm')) {
        assert.equal(await solo.evaluate(() => currentRoomState.status), 'in_game');
        await solo.locator('#cockroachPokerFinal').waitFor({ state: 'visible' });
        await layout(solo, 'live-final-bot-390');
        confirmedFinal = true;
        await solo.locator('#cockroachPokerDecisions button').filter({ hasText: 'Confirm results' }).click();
      }
      await solo.waitForFunction(revision => lastGameStatePayload.view.revision > revision, current.revision);
    }
    assert.ok(confirmedFinal);
    assert.ok(judgments > 0 && botOffers > 0);
    await solo.waitForFunction(() => currentRoomState.status === 'game_over');
    assert.equal(await solo.locator('#cockroachPokerFinal .cp-final-row').count(), 2);
    await solo.evaluate(() => setRoomControlsCollapsed(true));
    await solo.locator('#cockroachPokerFinal button').filter({ hasText: 'Play Again' }).click();
    await solo.waitForFunction(() => currentRoomState.status === 'in_game' && !lastGameStatePayload.view.game_over);
    assert.equal(await solo.evaluate(() => roomId), soloRoom);
    assert.equal(await solo.locator('#cockroachPokerFinal').isHidden(), true);
    await solo.locator('#cockroachPokerExplainBtn').click();
    await solo.locator('#cockroachPokerLimit').click();
    await solo.locator('dialog.obg-explain-dialog[open]').waitFor({ state: 'visible' });
    await solo.evaluate(() => socket.emit('room:create', { name: 'Switch identity', game_type: 'cabo' }));
    await solo.waitForFunction(() => currentGameType === 'cabo' && isGameAssetsLoaded('cabo'));
    assert.equal(await solo.locator('#cockroachPokerHand button').count(), 0);
    assert.equal(await solo.locator('#cockroachPokerHeaderActions').isHidden(), true);
    assert.equal(await solo.locator('dialog.obg-explain-dialog[open]').count(), 0);
    assert.deepEqual(errors, []);
    console.log('Cockroach Poker: lazy assets, three clients, private peek/reconnect, pass/judge, six-player/spectator layouts, review gate, bilingual Help/Explain, tooltips, scrolling, full bot game/final confirmation/Play Again/switching and four widths passed.');
  } finally {
    for (const context of contexts) await context.close();
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
