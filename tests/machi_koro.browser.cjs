const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const base = process.env.ROOM_TEST_URL || 'http://127.0.0.1:8787';
const output = 'tmp/machi_koro/qa';

(async () => {
  fs.mkdirSync(output, { recursive: true });
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const errors = [];
  const contexts = [];
  async function newPage() {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true });
    contexts.push(context);
    const page = await context.newPage();
    page.on('pageerror', error => errors.push(error.message));
    await page.route('https://fonts.googleapis.com/**', route => route.abort());
    await page.goto(base);
    await page.waitForFunction(() => typeof socket !== 'undefined' && socket.connected && cachedGameList);
    return page;
  }
  async function resolveIncome(page) {
    for (let index = 0; index < 15; index += 1) {
      const phase = await page.evaluate(() => lastGameStatePayload.view.phase);
      if (phase !== 'income') return;
      await page.locator('#machiKoroChoiceContent button').first().click();
      await page.waitForTimeout(100);
    }
    throw new Error('Income did not resolve');
  }
  try {
    const page = await newPage();
    assert(await page.evaluate(() => cachedGameList.some(game => game.game_id === 'machi_koro' && game.has_strategic_ai)));
    assert.equal(await page.locator('script[src*="machi_koro.js"]').count(), 0);
    await page.evaluate(() => socket.emit('room:create', { name: 'Mayor One', game_type: 'machi_koro', config: { seed: 17 } }));
    await page.waitForFunction(() => roomSessionReady && isGameAssetsLoaded('machi_koro'));
    assert.equal(await page.locator('#machiKoroEdition').inputValue(), 'all');
    await page.locator('#machiKoroMarket').selectOption('all');
    const room = await page.evaluate(() => currentRoomState.room_id);
    const second = await newPage();
    await second.evaluate(roomId => socket.emit('room:join', { name: 'Mayor Two', room_id: roomId }), room);
    await second.waitForFunction(() => roomSessionReady && isGameAssetsLoaded('machi_koro'));
    await second.evaluate(() => socket.emit('room:ready', { ready: true }));
    await page.evaluate(() => socket.emit('room:ready', { ready: true }));
    await page.waitForFunction(() => !document.getElementById('startBtn').disabled);
    await page.locator('#startBtn').click();
    await page.waitForFunction(() => lastGameStatePayload?.game_type === 'machi_koro');
    await page.locator('#machiKoroTable').waitFor({ state: 'visible' });
    assert.equal(await page.locator('.mk-card').count(), 39);
    assert.equal(await page.locator('.mk-landmark').count(), 6);
    assert.equal(await page.locator('#machiKoroHelpBtn').count(), 1);
    for (const width of [320, 390, 1024, 1440]) {
      await page.setViewportSize({ width, height: width < 500 ? 844 : 1000 });
      await page.locator('#machiKoroTable').scrollIntoViewIfNeeded();
      await page.waitForTimeout(60);
      const layout = await page.evaluate(() => {
        const panel = document.getElementById('machiKoroPanel').getBoundingClientRect();
        const controls = [...document.querySelectorAll('#machiKoroPanel button')].filter(button => {
          const bounds = button.getBoundingClientRect();
          return bounds.width && bounds.height && (button.scrollWidth > button.clientWidth + 1 || button.scrollHeight > button.clientHeight + 1);
        }).map(button => button.textContent);
        const collisions = [...document.querySelectorAll('.mk-card-footer')].filter(footer => {
          const [left, right] = footer.children;
          return left.getBoundingClientRect().right > right.getBoundingClientRect().left - 2;
        }).map(footer => footer.textContent);
        return { width: innerWidth, scroll: document.documentElement.scrollWidth, left: panel.left, right: panel.right, controls, collisions,
          diceHeight: document.querySelector('.mk-dice-row').getBoundingClientRect().height,
          landmarkHeight: document.getElementById('machiKoroLandmarks').getBoundingClientRect().height,
          filterHeight: document.getElementById('machiKoroFilters').getBoundingClientRect().height,
          cardHeight: document.querySelector('.mk-card').getBoundingClientRect().height };
      });
      assert(layout.scroll <= width + 1, `Page overflow: ${JSON.stringify(layout)}`);
      assert(layout.left >= 0 && layout.right <= width + 1, `Panel overflow at ${width}`);
      assert.deepEqual(layout.controls, [], `Clipped controls at ${width}`);
      assert.deepEqual(layout.collisions, [], `Card labels overlap at ${width}`);
      assert(layout.diceHeight <= 48, `Roll toolbar is too tall at ${width}: ${layout.diceHeight}`);
      assert(await page.locator('#machiKoroDice').isHidden(), 'No placeholder die before rolling');
      if (width < 500) {
        assert(layout.landmarkHeight <= 105, `Landmarks are too tall at ${width}: ${layout.landmarkHeight}`);
        assert(layout.cardHeight <= 110, `Market cards are too tall at ${width}: ${layout.cardHeight}`);
        assert(layout.filterHeight <= 34, `Market filters should fit one row at ${width}`);
        console.log(`Compact ${width}px: roll ${layout.diceHeight}px, landmarks ${layout.landmarkHeight}px, card ${layout.cardHeight}px.`);
      }
      await page.screenshot({ path: `${output}/machi-koro-${width}.png`, fullPage: true });
    }
    await page.setViewportSize({ width: 390, height: 844 });
    await page.locator('#machiKoroHelpBtn').click();
    await page.locator('.obg-help-dialog[open]').waitFor();
    await page.locator('[data-obg-help-lang="en"]').click();
    assert(await page.locator('.obg-help-dialog[open]').innerText().then(text => text.includes('Win by')));
    await page.locator('[data-obg-help-tab="millionaires"]').click();
    assert(await page.locator('.obg-help-dialog[open]').innerText().then(text => text.includes('Renovation Company')));
    await page.locator('[data-obg-help-lang="zh"]').click();
    assert(await page.locator('.obg-help-dialog[open]').innerText().then(text => text.includes('豪华街')));
    await page.keyboard.press('Escape');
    assert.equal(await page.locator('.obg-help-dialog[open]').count(), 0);
    await page.locator('#machiKoroExplainBtn').click();
    const disabled = page.locator('[data-mk-landmark="airport"]');
    const disabledBounds = await disabled.boundingBox();
    await page.mouse.click(disabledBounds.x + disabledBounds.width / 2, disabledBounds.y + disabledBounds.height / 2);
    await page.locator('.obg-explain-dialog[open]').waitFor();
    assert.equal(await page.evaluate(() => lastGameStatePayload.view.phase), 'roll');
    await page.keyboard.press('Escape');
    await page.locator('#machiKoroTurnButtons button').first().click();
    await page.waitForFunction(() => lastGameStatePayload.view.phase !== 'roll');
    await resolveIncome(page);
    assert.equal(await page.evaluate(() => lastGameStatePayload.view.phase), 'build');
    await page.locator('#machiKoroDice').tap();
    await page.locator('#machiKoroTooltip').waitFor({ state: 'visible' });
    await page.waitForTimeout(3100);
    assert(await page.locator('#machiKoroTooltip').isHidden());
    await page.setViewportSize({ width: 320, height: 844 });
    await page.locator('#machiKoroMarketGrid').scrollIntoViewIfNeeded();
    const marketBounds = await page.locator('#machiKoroMarketGrid').boundingBox();
    const session = await page.context().newCDPSession(page);
    const touchX = marketBounds.x + marketBounds.width / 2;
    const touchY = Math.min(780, marketBounds.y + 200);
    await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: touchX, y: touchY }] });
    for (let step = 1; step <= 6; step += 1) {
      await session.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: touchX, y: touchY - step * 18 }] });
    }
    await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await page.waitForTimeout(300);
    assert.equal(await page.locator('.mk-confirm').count(), 0, 'Scrolling must not select a card');
    assert(await page.locator('#machiKoroMarketGrid').evaluate(element => element.scrollTop > 0));
    await page.locator('#machiKoroMarketGrid').evaluate(element => { element.scrollTop = 0; });
    await page.setViewportSize({ width: 390, height: 844 });
    const coins = await page.evaluate(() => lastGameStatePayload.view.players.find(player => player.player_id === playerId).coins);
    await page.locator('[data-mk-card="wheat_field"]').click();
    await page.locator('.mk-confirm').waitFor();
    await page.locator('.mk-confirm button').last().click();
    assert.equal(await page.locator('.mk-confirm').count(), 0);
    await page.locator('[data-mk-card="wheat_field"]').click();
    await page.locator('.mk-confirm .mk-primary').click();
    await page.waitForFunction(() => lastGameStatePayload.view.current_turn !== playerId);
    const ownCards = await page.evaluate(() => lastGameStatePayload.view.players.find(player => player.player_id === playerId));
    assert.equal(ownCards.coins, coins - 1);
    assert.equal(ownCards.cards.filter(card => card.id === 'wheat_field').length, 2);
    await second.waitForFunction(() => lastGameStatePayload?.view.current_turn === playerId);
    await second.locator('#machiKoroTurnButtons button').first().click();
    await second.waitForFunction(() => lastGameStatePayload.view.phase !== 'roll');
    await resolveIncome(second);
    await second.locator('#machiKoroTurnButtons button').filter({ hasText: 'Build nothing' }).click();
    await page.waitForFunction(() => lastGameStatePayload.view.phase === 'round_summary');
    await page.locator('#machiKoroSummary button').click();
    assert.equal(await page.evaluate(() => lastGameStatePayload.view.phase), 'round_summary');
    await second.waitForFunction(() => lastGameStatePayload.view.phase === 'round_summary');
    await second.locator('#machiKoroSummary button').click();
    await page.waitForFunction(() => lastGameStatePayload.view.round_number === 2);
    const beforeReload = await page.evaluate(() => ({ turn: lastGameStatePayload.view.turn_number, dice: lastGameStatePayload.view.dice }));
    await page.reload();
    await page.waitForFunction(() => roomSessionReady && lastGameStatePayload?.game_type === 'machi_koro' && isGameAssetsLoaded('machi_koro'));
    assert.deepEqual(await page.evaluate(() => ({ turn: lastGameStatePayload.view.turn_number, dice: lastGameStatePayload.view.dice })), beforeReload);
    await page.locator('.mk-player').last().click();
    assert(await page.locator('#machiKoroCity').getAttribute('open') !== null);
    const snapshot = await page.evaluate(() => structuredClone(lastGameStatePayload));
    await page.evaluate(payload => {
      const current = payload.view.players.find(player => player.player_id === payload.view.you);
      payload.view.current_turn = payload.view.you;
      payload.view.phase = 'choose';
      payload.view.legal_actions = ['choose'];
      payload.view.pending = { kind: 'business_center', choices: [{ skip: true }, ...current.cards.map(card => ({ give: card.uid, target: payload.view.players[1].player_id, take: payload.view.players[1].cards[0].uid }))] };
      renderMachiKoroGameState(payload);
    }, structuredClone(snapshot));
    assert.equal(await page.locator('#machiKoroChoiceContent select').count(), 3);
    for (const width of [320, 390, 1024, 1440]) {
      await page.setViewportSize({ width, height: width < 500 ? 844 : 1000 });
      await page.locator('#machiKoroChoice').scrollIntoViewIfNeeded();
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
      await page.screenshot({ path: `${output}/trade-${width}.png`, fullPage: true });
    }
    await page.evaluate(payload => renderMachiKoroGameState(payload), snapshot);
    await page.evaluate(payload => {
      payload.view.phase = 'build';
      payload.view.current_turn = payload.view.you;
      payload.view.legal_actions = ['buy', 'build', 'pass'];
      payload.view.players.find(player => player.player_id === payload.view.you).coins = 100;
      renderMachiKoroGameState(payload);
    }, structuredClone(snapshot));
    await page.locator('#machiKoroMarketGrid').evaluate(element => { element.scrollTop = 450; });
    const later = page.locator('[data-mk-card="vineyard"]');
    await later.scrollIntoViewIfNeeded();
    const marketScroll = await page.locator('#machiKoroMarketGrid').evaluate(element => element.scrollTop);
    await later.click();
    assert.equal(await page.locator('#machiKoroMarketGrid').evaluate(element => element.scrollTop), marketScroll, 'Selection must preserve market scroll');
    await page.keyboard.press('Escape');
    await page.locator('[data-mk-landmark="harbor"]').click();
    assert.equal(await page.locator('.mk-landmark .mk-confirm').count(), 1);
    for (const width of [320, 390, 1024, 1440]) {
      await page.setViewportSize({ width, height: width < 500 ? 844 : 1000 });
      const confirmation = await page.locator('.mk-landmark .mk-confirm').evaluate(overlay => {
        const bounds = overlay.getBoundingClientRect();
        const buttons = [...overlay.querySelectorAll('button')].map(button => button.getBoundingClientRect());
        return {
          clipped: [...overlay.querySelectorAll('button, strong')].some(node => node.scrollWidth > node.clientWidth + 1 || node.scrollHeight > node.clientHeight + 1),
          contained: buttons.every(button => button.left >= bounds.left && button.right <= bounds.right && button.top >= bounds.top && button.bottom <= bounds.bottom),
          overlap: buttons[0].right > buttons[1].left,
          bounds: bounds.toJSON(), buttons: buttons.map(bounds => bounds.toJSON())
        };
      });
      assert(!confirmation.clipped && confirmation.contained && !confirmation.overlap, `Landmark confirmation clipped at ${width}: ${JSON.stringify(confirmation)}`);
    }
    await page.locator('#machiKoroRound').click();
    assert.equal(await page.locator('.mk-confirm').count(), 0, 'Blank space cancels the selection');
    for (const phase of ['roll', 'reroll', 'harbor', 'invest']) {
      const payload = structuredClone(snapshot);
      payload.view.current_turn = payload.view.you;
      payload.view.phase = phase;
      payload.view.legal_actions = { roll: ['roll'], reroll: ['reroll', 'keep'], harbor: ['harbor'], invest: ['invest'] }[phase];
      payload.view.dice = phase === 'roll' ? [] : [5, 6];
      payload.view.total = phase === 'roll' ? null : 11;
      payload.view.players.find(player => player.player_id === payload.view.you).landmarks = ['train_station', 'radio_tower', 'harbor'];
      await page.evaluate(payload => renderMachiKoroGameState(payload), payload);
      for (const width of [320, 390, 1024, 1440]) {
        await page.setViewportSize({ width, height: width < 500 ? 844 : 1000 });
        await page.locator('.mk-dice-row').scrollIntoViewIfNeeded();
        const toolbar = await page.locator('.mk-dice-row').evaluate(element => ({
          height: element.getBoundingClientRect().height,
          overflow: element.scrollWidth > element.clientWidth + 1,
          clipped: [...element.querySelectorAll('button')].some(button => button.scrollWidth > button.clientWidth + 1 || button.scrollHeight > button.clientHeight + 1)
        }));
        assert(toolbar.height <= 48, `${phase} toolbar too tall at ${width}: ${JSON.stringify(toolbar)}`);
        assert(!toolbar.overflow && !toolbar.clipped, `${phase} toolbar clipped at ${width}`);
        await page.screenshot({ path: `${output}/${phase}-${width}.png`, fullPage: true });
      }
    }
    await page.evaluate(payload => {
      payload.view.current_turn = payload.view.players.find(player => player.player_id !== payload.view.you).player_id;
      payload.view.phase = 'reroll';
      payload.view.legal_actions = [];
      payload.view.dice = [5, 6];
      payload.view.total = 11;
      renderMachiKoroGameState(payload);
    }, structuredClone(snapshot));
    assert(await page.locator('#machiKoroTurnButtons').isHidden(), 'No disabled action row on another player\'s turn');
    assert(await page.locator('#machiKoroMessage').innerText().then(text => text.startsWith('Waiting for')));
    const crowded = structuredClone(snapshot);
    for (let index = crowded.view.players.length; index < 5; index += 1) {
      crowded.view.players.push({ ...structuredClone(crowded.view.players[0]), player_id: `layout-${index}`, name: `A very long mayor name ${index}`, coins: 123, investment: 123 });
    }
    await page.evaluate(payload => renderMachiKoroGameState(payload), crowded);
    for (const width of [320, 390]) {
      await page.setViewportSize({ width, height: 844 });
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `Five-city overflow at ${width}`);
    }
    await page.evaluate(payload => renderMachiKoroGameState(payload), snapshot);
    const botPage = await newPage();
    await botPage.evaluate(() => socket.emit('room:create', { name: 'Bot QA', game_type: 'machi_koro', config: { seed: 9 } }));
    await botPage.waitForFunction(() => roomSessionReady && isGameAssetsLoaded('machi_koro'));
    await botPage.evaluate(() => socket.emit('room:add_bot', {}));
    await botPage.waitForFunction(() => currentRoomState.players.length === 2);
    await botPage.evaluate(() => socket.emit('room:ready', { ready: true }));
    await botPage.waitForFunction(() => !document.getElementById('startBtn').disabled);
    await botPage.locator('#startBtn').click();
    await botPage.waitForFunction(() => lastGameStatePayload?.game_type === 'machi_koro');
    assert.equal(await botPage.locator('.mk-card').count(), 10);
    await botPage.locator('#machiKoroTurnButtons button').first().click();
    await botPage.waitForFunction(() => lastGameStatePayload.view.phase !== 'roll');
    await resolveIncome(botPage);
    await botPage.locator('#machiKoroTurnButtons button').filter({ hasText: 'Build nothing' }).click();
    await botPage.waitForFunction(() => lastGameStatePayload.view.phase === 'round_summary', null, { timeout: 15000 });
    await botPage.waitForFunction(() => lastGameStatePayload.view.ready.length === 1);
    await botPage.locator('#machiKoroSummary button').click();
    await botPage.waitForFunction(() => lastGameStatePayload.view.round_number === 2);
    assert.deepEqual(errors, []);
    console.log('Machi Koro browser QA passed: 320/390/1024/1440, compact roll/reroll/harbor/invest toolbars, mobile card/landmark heights, five-city layout, Help languages/tabs/Escape, disabled Explain, tooltip timeout, buy/cancel, two-player round pause, reload/reconnect, city inspection, trade selectors, touch scrolling without selection, preserved scroll, local landmark confirmation, blank cancellation, bot turns, ten-type variable market.');
  } finally {
    await Promise.all(contexts.map(context => context.close()));
    await browser.close();
  }
})().catch(error => { console.error(error); process.exit(1); });
