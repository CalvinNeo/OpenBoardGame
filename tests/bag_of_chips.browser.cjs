const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { execFileSync } = require('node:child_process');

const base = process.env.ROOM_TEST_URL || 'http://127.0.0.1:8786';
const output = 'tmp/bag-of-chips/browser';
const widths = [320, 390, 1024, 1440];

async function layout(page, label) {
  await page.evaluate(() => document.fonts.ready);
  const issues = await page.evaluate(() => {
    const bad = [];
    for (const node of document.querySelectorAll('#bagOfChipsPanel *, dialog[open] *')) {
      const box = node.getBoundingClientRect();
      if (!box.width || !box.height || node.closest('.hidden, dialog:not([open])')) continue;
      if (node.closest('details:not([open])') && !node.closest('summary')) continue;
      const style = getComputedStyle(node);
      if (box.left < -1 || box.right > innerWidth + 1) bad.push(`viewport: ${node.className}`);
      if (node.clientWidth && node.scrollWidth > node.clientWidth + 2
          && !['auto', 'scroll', 'hidden', 'clip'].includes(style.overflowX)) {
        bad.push(`overflow: ${node.className} ${node.scrollWidth}/${node.clientWidth}`);
      }
    }
    for (const selector of ['.boc-hand', '.boc-draws', '.boc-draw-chips', '.boc-players', '.boc-counts', '.boc-result-heading', '.boc-result-card']) {
      for (const container of document.querySelectorAll(selector)) {
        const boxes = [...container.children].map(node => node.getBoundingClientRect()).filter(box => box.width && box.height);
        for (let first = 0; first < boxes.length; first += 1) {
          for (let second = first + 1; second < boxes.length; second += 1) {
            if (Math.min(boxes[first].right, boxes[second].right) - Math.max(boxes[first].left, boxes[second].left) > 2
                && Math.min(boxes[first].bottom, boxes[second].bottom) - Math.max(boxes[first].top, boxes[second].top) > 2) bad.push(`overlap: ${selector}`);
          }
        }
      }
    }
    const header = ['gameReconnectBtn', 'bagOfChipsHelpBtn'].map(id => document.getElementById(id).getBoundingClientRect());
    if (Math.abs(header[0].top + header[0].height / 2 - header[1].top - header[1].height / 2) > 3) bad.push('Help/Reconnect wrapping');
    return { horizontalScroll: document.documentElement.scrollWidth > innerWidth, bad };
  });
  if (issues.horizontalScroll || issues.bad.length) await page.screenshot({ path: `${output}/failure-${label.replace(/\W/g, '-')}.png`, fullPage: true });
  assert.deepEqual(issues, { horizontalScroll: false, bad: [] }, label);
}

async function accept(page, type) {
  await page.waitForFunction(type => lastGameStatePayload?.view.legal_actions.includes(type), type);
  await page.locator(`[data-boc-do="${type}"]`).click();
  await page.waitForFunction(type => !lastGameStatePayload.view.legal_actions.includes(type), type);
}

async function choose(page, amount, preserveSpecial = true) {
  const previousStep = await page.evaluate(() => lastGameStatePayload.view.step);
  const choices = await page.evaluate(({ amount, preserveSpecial }) => {
    const view = lastGameStatePayload.view;
    const hand = view.players.find(player => player.player_id === view.you).hand;
    const candidates = preserveSpecial ? hand.filter(card => !card.special) : hand;
    return candidates.slice(0, amount).map(card => card.id);
  }, { amount, preserveSpecial });
  for (const card of choices) await page.locator(`[data-boc-card="${card}"]`).click();
  await page.locator('#bagOfChipsCommitBtn').click();
  await page.waitForFunction(previousStep => lastGameStatePayload.view.step !== previousStep
    || lastGameStatePayload.view.players.find(player => player.player_id === lastGameStatePayload.view.you).submitted, previousStep);
}

(async () => {
  fs.mkdirSync(output, { recursive: true });
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const errors = [];
  const hostContext = await browser.newContext({ viewport: { width: 390, height: 900 }, hasTouch: true });
  const guestContext = await browser.newContext({ viewport: { width: 1024, height: 900 } });
  const host = await hostContext.newPage();
  const guest = await guestContext.newPage();
  try {
    for (const page of [host, guest]) {
      page.on('pageerror', error => errors.push(error.message));
      await page.goto(base);
      await page.waitForFunction(() => typeof socket !== 'undefined' && socket.connected && cachedGameList);
    }
    assert.equal(await host.locator('#bagOfChipsPanel').evaluate(node => node.childElementCount), 0);
    assert.equal(await host.locator('script[src*="/bag_of_chips.js"]').count(), 0);
    await host.evaluate(() => socket.emit('room:create', { name: 'Crispy Alice', game_type: 'bag_of_chips' }));
    await host.waitForFunction(() => roomSessionReady && currentGameType === 'bag_of_chips' && isGameAssetsLoaded('bag_of_chips'));
    await host.evaluate(() => setRoomControlsCollapsed(true));
    for (const width of widths) {
      await host.setViewportSize({ width, height: 900 });
      await layout(host, `lobby-${width}`);
    }
    const room = await host.evaluate(() => roomId);
    await guest.evaluate(room => socket.emit('room:join', { room_id: room, name: 'Crunchy Bob' }), room);
    await guest.waitForFunction(() => roomSessionReady && isGameAssetsLoaded('bag_of_chips'));
    for (const page of [host, guest]) await page.evaluate(() => socket.emit('room:ready', { ready: true }));
    await host.waitForFunction(() => currentRoomState.players.length === 2 && currentRoomState.players.every(player => player.ready));
    await host.evaluate(() => socket.emit('room:start', { config: { seed: 23 } }));
    for (const page of [host, guest]) {
      await page.waitForFunction(() => lastGameStatePayload?.game_type === 'bag_of_chips');
      await page.evaluate(() => setRoomControlsCollapsed(true));
    }
    for (const width of widths) {
      await host.setViewportSize({ width, height: 900 });
      await layout(host, `initial-${width}`);
      await host.screenshot({ path: `${output}/initial-${width}.png`, fullPage: true });
    }
    assert.equal(await host.evaluate(() => 'seed' in currentRoomState.game_config), false);
    assert.equal(await host.evaluate(() => lastGameStatePayload.view.players.find(player => player.player_id !== lastGameStatePayload.view.you).hand.length), 0);

    await host.setViewportSize({ width: 390, height: 900 });
    await host.locator('#bagOfChipsHelpBtn').click();
    await host.locator('dialog[open] [data-obg-help-lang="en"]').click();
    assert.match(await host.locator('dialog[open]').innerText(), /How you win/);
    for (const section of ['flow', 'cards', 'scoring']) {
      await host.locator(`[data-obg-help-tab="${section}"]`).click();
      await layout(host, `help-${section}`);
    }
    await host.locator('dialog[open] [data-obg-help-lang="zh"]').click();
    assert.match(await host.locator('dialog[open]').innerText(), /特殊牌/);
    await host.keyboard.press('Escape');
    assert.equal(await host.locator('dialog[open]').count(), 0);

    await host.locator('.boc-card').first().click();
    assert.equal(await host.locator('.boc-card.is-selected').count(), 1);
    assert.equal(await host.locator('#bagOfChipsCommitBtn').isDisabled(), true);
    await host.locator('#bagOfChipsExplainBtn').click();
    await host.locator('#bagOfChipsCommitBtn').dispatchEvent('pointerdown', { isPrimary: true, pointerId: 1, button: 0, clientX: (await host.locator('#bagOfChipsCommitBtn').boundingBox()).x + 10, clientY: (await host.locator('#bagOfChipsCommitBtn').boundingBox()).y + 10 });
    await host.locator('#bagOfChipsCommitBtn').dispatchEvent('pointerup', { isPrimary: true, pointerId: 1, button: 0, clientX: (await host.locator('#bagOfChipsCommitBtn').boundingBox()).x + 10, clientY: (await host.locator('#bagOfChipsCommitBtn').boundingBox()).y + 10 });
    assert.equal(await host.locator('dialog[open]').count(), 1);
    assert.equal(await host.evaluate(() => lastGameStatePayload.view.phase), 1);
    await host.keyboard.press('Escape');
    await host.locator('#bagOfChipsExplainBtn').click();
    const selectedCard = host.locator('.boc-card').first();
    await selectedCard.click();
    assert.equal(await host.locator('dialog[open]').count(), 1);
    assert.match(await host.locator('dialog[open]').innerText(), /fourteen|color|chips/i);
    await host.keyboard.press('Escape');
    assert.equal(await host.locator('.boc-card.is-selected').count(), 0);

    const firstCard = host.locator('.boc-card').first();
    const cardBox = await firstCard.boundingBox();
    await firstCard.dispatchEvent('pointerdown', { clientX: cardBox.x + 20, clientY: cardBox.y + 20 });
    await firstCard.dispatchEvent('pointermove', { clientX: cardBox.x + 20, clientY: cardBox.y + 70 });
    await firstCard.dispatchEvent('click');
    assert.equal(await host.locator('.boc-card.is-selected').count(), 0);
    await firstCard.click();
    await host.locator('.boc-caption h3').first().click();
    assert.equal(await host.locator('.boc-card.is-selected').count(), 0);
    await host.locator('.boc-count').first().tap();
    assert.equal(await host.locator('#bagOfChipsTooltip').isVisible(), true);
    await host.waitForTimeout(3150);
    assert.equal(await host.locator('#bagOfChipsTooltip').isVisible(), false);

    await firstCard.click();
    await host.locator('.boc-card').nth(1).click();
    for (const width of widths) {
      await host.setViewportSize({ width, height: 900 });
      await layout(host, `confirm-${width}`);
    }
    await choose(guest, 2);
    assert.equal(await host.locator('.boc-card.is-selected').count(), 2);
    await host.locator('#bagOfChipsCommitBtn').click();
    await host.waitForFunction(() => lastGameStatePayload.view.phase === 2);
    await host.reload();
    await host.waitForFunction(() => lastGameStatePayload?.game_type === 'bag_of_chips' && isGameAssetsLoaded('bag_of_chips') && lastGameStatePayload.view.phase === 2);
    assert.equal(await host.locator('.boc-card').count(), 4);
    await host.evaluate(() => setRoomControlsCollapsed(true));
    for (const page of [host, guest]) await choose(page, 1);
    await host.waitForFunction(() => lastGameStatePayload.view.stage === 'place');
    for (const width of widths) {
      await host.setViewportSize({ width, height: 900 });
      await layout(host, `place-${width}`);
    }
    for (const page of [host, guest]) await choose(page, 1);
    await host.waitForFunction(() => lastGameStatePayload.view.stage === 'reveal');
    assert.equal(await host.evaluate(() => lastGameStatePayload.view.drawn.length), 13);
    for (const width of widths) {
      await host.setViewportSize({ width, height: 900 });
      await layout(host, `reveal-${width}`);
    }
    await accept(host, 'reveal_last');
    assert.equal(await host.evaluate(() => lastGameStatePayload.view.drawn.length), 13);
    await accept(guest, 'reveal_last');
    await host.waitForFunction(() => lastGameStatePayload.view.summary);
    const summary = await host.evaluate(() => structuredClone(lastGameStatePayload));
    assert.equal(summary.view.drawn.length, 14);
    assert.equal(await host.locator('.boc-result-card').count(), 6);
    for (const width of widths) {
      await host.setViewportSize({ width, height: 900 });
      await layout(host, `results-${width}`);
      await host.screenshot({ path: `${output}/results-${width}.png`, fullPage: true });
    }
    await host.locator('#bagOfChipsExplainBtn').click();
    await host.locator('.boc-result-card').first().click();
    assert.match(await host.locator('dialog[open]').innerText(), /Negative objective|Positive objective/);
    await host.keyboard.press('Escape');

    const fixtures = JSON.parse(execFileSync('python3', ['-c', `
import json
from game.bag_of_chips import BagOfChipsGame,OBJECTIVES,_settle
from tests.test_bag_of_chips import score_fixture
state=score_fixture(6)
for index,meta in enumerate(state['player_meta'].values()): meta['name']='Long player name '+str(index)+' with extra characters'
_settle(state)
result=BagOfChipsGame.get_public_view(state,'player-0')
state['players']['player-0']['rewards']=4
state['players']['player-0'].update(negative=1,positive=[25,26])
_settle(state)
final=BagOfChipsGame.get_public_view(state,'player-0')
print(json.dumps({'result':result,'final':final,'cards':list(OBJECTIVES.values())}))
`], { encoding: 'utf8' }));
    for (const [fixtureName, fixture] of Object.entries({ crowded: fixtures.result, final: fixtures.final })) {
      await host.evaluate(view => renderBagOfChipsGameState({ game_type: 'bag_of_chips', room_id: roomId, view }), fixture);
      for (const width of widths) {
        await host.setViewportSize({ width, height: 900 });
        await layout(host, `${fixtureName}-${width}`);
      }
    }
    for (let offset = 0; offset < fixtures.cards.length; offset += 6) {
      const fixture = structuredClone(summary.view);
      fixture.stage = 'discard'; fixture.phase = 1; fixture.summary = null;
      fixture.legal_actions = ['discard'];
      fixture.players.find(player => player.player_id === fixture.you).hand = fixtures.cards.slice(offset, offset + 6);
      await host.evaluate(view => renderBagOfChipsGameState({ game_type: 'bag_of_chips', room_id: roomId, view }), fixture);
      await host.setViewportSize({ width: 320, height: 900 });
      await layout(host, `all-cards-${offset}`);
    }
    await host.evaluate(payload => renderBagOfChipsGameState(payload), summary);
    await accept(host, 'next_round');
    assert.equal(await host.evaluate(() => lastGameStatePayload.view.round), 1);
    await accept(guest, 'next_round');
    await host.waitForFunction(() => lastGameStatePayload.view.round === 2);
    for (let turn = 0; turn < 200; turn += 1) {
      const state = await host.evaluate(() => ({ stage: lastGameStatePayload.view.stage, round: lastGameStatePayload.view.round }));
      if (state.stage === 'final_review') break;
      for (const page of [host, guest]) {
        if (state.stage === 'discard') {
          const phase = await page.evaluate(() => lastGameStatePayload.view.phase);
          await choose(page, phase === 1 ? 2 : 1);
        } else if (state.stage === 'place') await choose(page, 1);
        else if (state.stage === 'reveal') await accept(page, 'reveal_last');
        else if (state.stage === 'round_over') await accept(page, 'next_round');
      }
    }
    await host.waitForFunction(() => lastGameStatePayload.view.stage === 'final_review');
    assert.equal(await host.locator('[data-boc-do="play_again"]').count(), 0);
    await accept(host, 'confirm_end');
    assert.equal(await host.evaluate(() => lastGameStatePayload.view.game_over), false);
    await accept(guest, 'confirm_end');
    await host.waitForFunction(() => lastGameStatePayload.view.game_over);
    await accept(host, 'play_again');
    await host.waitForFunction(() => lastGameStatePayload.view.stage === 'discard' && lastGameStatePayload.view.round === 1);
    assert.equal(await host.evaluate(() => lastGameStatePayload.view.history.length), 0);
    await host.evaluate(() => socket.emit('room:create', { name: 'Solo human', game_type: 'bag_of_chips' }));
    await host.waitForFunction(previous => roomSessionReady && roomId !== previous && currentRoomState.status === 'lobby', room);
    await host.evaluate(() => socket.emit('room:add_bot', { name: 'Crunch Bot' }));
    await host.waitForFunction(() => currentRoomState.players.length === 2);
    await host.evaluate(() => socket.emit('room:ready', { ready: true }));
    await host.evaluate(() => socket.emit('room:start', { config: { seed: 33 } }));
    await host.waitForFunction(() => lastGameStatePayload?.room_id === roomId && lastGameStatePayload.view.stage === 'discard');
    for (let turn = 0; turn < 200; turn += 1) {
      const current = await host.evaluate(() => ({ stage: lastGameStatePayload.view.stage, phase: lastGameStatePayload.view.phase, step: lastGameStatePayload.view.step }));
      if (current.stage === 'final_review') break;
      if (current.stage === 'discard') await choose(host, current.phase === 1 ? 2 : 1);
      else if (current.stage === 'place') await choose(host, 1);
      else if (current.stage === 'reveal') await accept(host, 'reveal_last');
      else if (current.stage === 'round_over') await accept(host, 'next_round');
      await host.waitForFunction(step => lastGameStatePayload.view.step !== step, current.step);
    }
    await host.waitForFunction(() => lastGameStatePayload.view.stage === 'final_review');
    await accept(host, 'confirm_end');
    await host.waitForFunction(() => currentRoomState.status === 'game_over' && lastGameStatePayload.view.game_over);
    await accept(host, 'play_again');
    await host.waitForFunction(() => currentRoomState.status === 'in_game' && lastGameStatePayload.view.round === 1);
    assert.deepEqual(errors, []);
    fs.writeFileSync(`${output}/acceptance.json`, JSON.stringify({ widths, errors, checks: ['lazy load', 'lobby', 'all card types', 'selection cancellation', 'scroll intent', 'private submissions', 'selection preservation', 'Help bilingual tabs', 'Explain disabled controls', 'tooltip timeout', 'reconnect', '13th/14th reveal gate', 'round review', 'six long names', 'final review', 'Play Again', 'live bot game and final room status'] }, null, 2));
    console.log('PASS Bag of Chips: four widths, human and bot multiplayer lifecycle, Help/Explain, privacy, touch and reconnect');
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
