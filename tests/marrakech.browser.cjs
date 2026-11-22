const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const base = process.env.ROOM_TEST_URL || 'http://127.0.0.1:8787';
const output = 'tmp/marrakech-qa';

(async () => {
  fs.mkdirSync(output, { recursive: true });
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const errors = [];
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true });
  const page = await context.newPage();
  page.on('pageerror', error => errors.push(error.message));
  await page.route('https://fonts.googleapis.com/**', route => route.abort());
  try {
    await page.goto(base);
    await page.waitForFunction(() => typeof socket !== 'undefined' && socket.connected && cachedGameList);
    assert(await page.evaluate(() => cachedGameList.some(game => game.game_id === 'marrakech' && game.has_strategic_ai)));
    await page.evaluate(() => socket.emit('room:create', { name: 'Marrakech QA', game_type: 'marrakech', config: { seed: 17 } }));
    await page.waitForFunction(() => roomSessionReady && isGameAssetsLoaded('marrakech'));
    await page.evaluate(() => socket.emit('room:add_bot', {}));
    await page.waitForFunction(() => currentRoomState.players.length === 2);
    await page.evaluate(() => socket.emit('room:ready', { ready: true }));
    await page.waitForFunction(() => !document.getElementById('startBtn').disabled);
    await page.locator('#startBtn').click();
    await page.waitForFunction(() => lastGameStatePayload?.game_type === 'marrakech');
    await page.locator('#marrakechTable').waitFor({ state: 'visible' });
    assert.equal(await page.locator('.marrakech-cell').count(), 49);
    assert.equal(await page.locator('#marrakechHelpBtn').count(), 1);
    assert.equal(await page.locator('#marrakechZoomIn, #marrakechZoomOut, #marrakechFit, #marrakechOrigin, .marrakech-zoom').count(), 0);
    assert.equal(await page.locator('#marrakechRugsLeft').innerText(), '▰ 48 rugs left');
    assert.deepEqual(await page.locator('.marrakech-player-rugs').allTextContents(), ['▰ 24 rugs left', '▰ 24 rugs left']);

    for (const width of [320, 390, 1024, 1440]) {
      await page.setViewportSize({ width, height: width < 500 ? 844 : 1000 });
      await page.locator('#marrakechBoard').scrollIntoViewIfNeeded();
      await page.waitForTimeout(80);
      const dimensions = await page.evaluate(() => {
        const panel = document.getElementById('marrakechPanel').getBoundingClientRect();
        const viewport = document.getElementById('marrakechViewport');
        const world = document.getElementById('marrakechWorld').getBoundingClientRect();
        return {
          width: innerWidth, scroll: document.documentElement.scrollWidth, panelLeft: panel.left, panelRight: panel.right,
          boardFits: viewport.scrollWidth <= viewport.clientWidth + 1 && viewport.scrollHeight <= viewport.clientHeight + 1 && world.height <= innerHeight,
          clipped: [...document.querySelectorAll('#marrakechPanel button:not(.marrakech-cell)')].filter(button => {
            const rect = button.getBoundingClientRect();
            return rect.width && rect.height && (button.scrollWidth > button.clientWidth + 1 || button.scrollHeight > button.clientHeight + 1);
          }).map(button => button.textContent)
        };
      });
      assert(dimensions.scroll <= width + 1, `Page overflow at ${width}: ${JSON.stringify(dimensions)}`);
      assert(dimensions.panelLeft >= 0 && dimensions.panelRight <= width + 1);
      assert(dimensions.boardFits, `Board does not fit at ${width}`);
      assert.deepEqual(dimensions.clipped, [], `Clipped controls at ${width}`);
      await page.screenshot({ path: `${output}/marrakech-${width}.png`, fullPage: true });
    }
    await page.setViewportSize({ width: 390, height: 844 });
    await page.locator('#marrakechHelpBtn').click();
    await page.locator('.obg-help-dialog[open]').waitFor();
    assert(await page.locator('.obg-help-dialog[open]').innerText());
    await page.keyboard.press('Escape');
    assert.equal(await page.locator('.obg-help-dialog[open]').count(), 0);
    await page.locator('#marrakechExplainBtn').click();
    await page.locator('#marrakechRoll').click({ force: true });
    await page.locator('.obg-explain-dialog[open]').waitFor();
    assert.equal(await page.evaluate(() => lastGameStatePayload.view.phase), 'orient');
    await page.keyboard.press('Escape');

    await page.locator('.marrakech-direction').first().click();
    await page.locator('#marrakechRoll').click();
    await page.waitForFunction(() => lastGameStatePayload.view.phase === 'roll');
    await page.locator('#marrakechRoll').click();
    await page.waitForFunction(() => lastGameStatePayload.view.phase === 'place');
    const pair = await page.evaluate(() => lastGameStatePayload.view.legal_placements[0].map(cell => cell.join(',')));
    const first = page.locator(`[data-marrakech-cell="${pair[0]}"]`);
    const second = page.locator(`[data-marrakech-cell="${pair[1]}"]`);
    const beforePlacement = await page.evaluate(() => JSON.stringify(lastGameStatePayload.view));
    await page.screenshot({ path: `${output}/marrakech-choose-first.png`, fullPage: true });
    await first.tap();
    assert.equal(await page.locator('.marrakech-cell.is-preview').count(), 0);
    assert.equal(await page.locator('.marrakech-cell.is-anchor').count(), 1);
    assert(await page.locator('.marrakech-cell.is-endpoint').count() > 0);
    assert.equal(await page.locator('#marrakechPlace').isDisabled(), true);
    assert.match(await page.locator('#marrakechPlacementHint').innerText(), /marked 2/);
    await page.screenshot({ path: `${output}/marrakech-choose-second.png`, fullPage: true });
    await second.tap();
    assert.equal(await page.locator('.marrakech-cell.is-preview').count(), 2);
    assert.equal(await page.locator('#marrakechRugPreview').count(), 1);
    assert.equal(await page.locator('#marrakechPlace').isDisabled(), false);
    assert.equal(await page.evaluate(() => JSON.stringify(lastGameStatePayload.view)), beforePlacement);
    assert.equal(await page.locator('#marrakechRugsLeft').innerText(), '▰ 48 rugs left');
    const alternate = page.locator('.marrakech-cell.is-endpoint:not(.is-preview)').first();
    if (await alternate.count()) {
      await alternate.tap();
      assert.equal(await page.locator('.marrakech-cell.is-preview').count(), 2);
      assert.equal(await first.getAttribute('aria-pressed'), 'true');
    }
    for (const width of [320, 390, 1024, 1440]) {
      await page.setViewportSize({ width, height: width < 500 ? 844 : 1000 });
      await page.locator('#marrakechPlacement').scrollIntoViewIfNeeded();
      await page.waitForTimeout(80);
      const dimensions = await page.evaluate(() => {
        const board = document.getElementById('marrakechBoard').getBoundingClientRect();
        const preview = document.getElementById('marrakechRugPreview').getBoundingClientRect();
        const confirm = document.getElementById('marrakechSelection').getBoundingClientRect();
        const cells = [...document.querySelectorAll('.marrakech-cell.is-preview')].map(cell => cell.getBoundingClientRect());
        return {
          scroll: document.documentElement.scrollWidth,
          previewInside: preview.left >= board.left && preview.right <= board.right && preview.top >= board.top && preview.bottom <= board.bottom,
          previewLeft: preview.left, cellsLeft: Math.min(...cells.map(cell => cell.left)),
          previewWidth: preview.width, cellsWidth: Math.max(...cells.map(cell => cell.right)) - Math.min(...cells.map(cell => cell.left)),
          controlsBelow: confirm.top >= board.bottom,
          clipped: [...document.querySelectorAll('#marrakechSelection button')].filter(button => {
            const bounds = button.getBoundingClientRect();
            return bounds.width && bounds.height && (button.scrollWidth > button.clientWidth + 1 || button.scrollHeight > button.clientHeight + 1);
          }).map(button => button.textContent)
        };
      });
      assert(dimensions.scroll <= width + 1, `Placement overflow at ${width}`);
      assert(dimensions.previewInside, `Preview outside the board at ${width}`);
      assert(dimensions.controlsBelow, `Confirmation overlaps the board at ${width}`);
      assert(Math.abs(dimensions.previewLeft - dimensions.cellsLeft) <= 1);
      assert(Math.abs(dimensions.previewWidth - dimensions.cellsWidth) <= 1);
      assert.deepEqual(dimensions.clipped, []);
      await page.screenshot({ path: `${output}/marrakech-placement-${width}.png`, fullPage: true });
    }
    await page.setViewportSize({ width: 390, height: 844 });
    await page.locator('#marrakechAdjust summary').click();
    await page.locator('#marrakechRotate').click();
    assert.equal(await page.locator('.marrakech-cell.is-preview').count(), 2);
    await page.locator('[data-marrakech-shift="1,0"]').click();
    assert.equal(await page.locator('.marrakech-cell.is-preview').count(), 2);
    await page.locator('#marrakechCancel').click();
    assert.equal(await page.locator('.marrakech-cell.is-preview').count(), 0);
    await first.tap();
    await page.keyboard.press('Escape');
    assert.equal(await page.locator('.marrakech-cell.is-anchor').count(), 0);
    await first.tap();
    await first.tap();
    assert.equal(await page.locator('.marrakech-cell.is-anchor').count(), 0);
    await first.tap();
    await page.locator('#marrakechPlacementHint').tap();
    assert.equal(await page.locator('.marrakech-cell.is-anchor').count(), 0);
    await first.tap();
    const assam = await page.evaluate(() => `${lastGameStatePayload.view.assam.x},${lastGameStatePayload.view.assam.y}`);
    await page.locator(`[data-marrakech-cell="${assam}"]`).tap();
    assert.equal(await page.locator('.marrakech-cell.is-anchor').count(), 1);
    assert.equal(await page.locator('.marrakech-cell.is-preview').count(), 0);
    assert.match(await page.locator('#marrakechPlacementHint').innerText(), /cannot join/);
    await second.focus();
    await page.keyboard.press('Enter');
    assert.equal(await page.locator('.marrakech-cell.is-preview').count(), 2);
    await page.keyboard.press('Escape');

    const viewport = page.locator('#marrakechViewport');
    const bounds = await viewport.boundingBox();
    await page.mouse.move(bounds.x + bounds.width - 30, bounds.y + 100);
    await page.mouse.down();
    await page.mouse.move(bounds.x + 30, bounds.y + 100, { steps: 8 });
    await page.mouse.move(bounds.x - 10, bounds.y + 100);
    await page.mouse.up();
    assert.equal(await page.locator('.marrakech-cell.is-preview').count(), 0);
    assert.equal(await viewport.evaluate(element => element.scrollLeft), 0);
    assert.equal(await viewport.evaluate(element => element.scrollTop), 0);
    await first.tap();
    await second.tap();
    await page.locator('#marrakechPlace').click();
    await page.waitForFunction(() => lastGameStatePayload.view.turn_number >= 2);
    await page.waitForFunction(() => lastGameStatePayload.view.current_turn === lastGameStatePayload.view.you && lastGameStatePayload.view.phase === 'orient');
    assert(await page.evaluate(() => lastGameStatePayload.view.history.length >= 4));
    assert.equal(await page.locator('#marrakechRugsLeft').innerText(), '▰ 46 rugs left');
    assert.deepEqual(await page.locator('.marrakech-player-rugs').allTextContents(), ['▰ 23 rugs left', '▰ 23 rugs left']);
    await page.reload();
    await page.waitForFunction(() => lastGameStatePayload?.game_type === 'marrakech' && document.querySelectorAll('.marrakech-cell').length === 49);
    assert.equal(await page.evaluate(() => lastGameStatePayload.view.phase), 'orient');
    assert.equal(await page.locator('#marrakechRugsLeft').innerText(), '▰ 46 rugs left');
    await page.evaluate(() => {
      const payload = structuredClone(lastGameStatePayload);
      const view = payload.view;
      view.assam = { x: 3, y: 3, direction: 0 };
      view.board = Array.from({ length: 7 }, () => Array(7).fill(null));
      const opponent = view.players.find(player => player.player_id !== view.you).player_id;
      view.board[2][3] = { owner: opponent, color: 'teal', rug_id: 800 };
      view.board[1][3] = { owner: opponent, color: 'teal', rug_id: 800 };
      view.board[2][4] = { owner: opponent, color: 'violet', rug_id: 801 };
      view.board[1][4] = { owner: opponent, color: 'violet', rug_id: 801 };
      view.phase = 'place';
      view.current_turn = view.you;
      view.next_color = 'coral';
      view.legal_actions = ['place'];
      view.legal_placements = [];
      for (let row = 0; row < 7; row += 1) for (let column = 0; column < 7; column += 1) {
        for (const [deltaX, deltaY] of [[1, 0], [0, 1]]) {
          const cells = [[column, row], [column + deltaX, row + deltaY]];
          if (cells.some(([cellX, cellY]) => cellX > 6 || cellY > 6 || (cellX === 3 && cellY === 3))) continue;
          if (!cells.some(([cellX, cellY]) => Math.abs(cellX - 3) + Math.abs(cellY - 3) === 1)) continue;
          const oldRugs = cells.map(([cellX, cellY]) => view.board[cellY][cellX]);
          if (oldRugs[0] && oldRugs[1] && oldRugs[0].rug_id === oldRugs[1].rug_id) continue;
          view.legal_placements.push(cells);
        }
      }
      renderMarrakechGameState(payload);
    });
    const occupiedFirst = page.locator('[data-marrakech-cell="3,2"]');
    const occupiedSecond = page.locator('[data-marrakech-cell="4,2"]');
    await occupiedFirst.tap();
    assert.equal(await page.locator('.marrakech-cell.is-endpoint').count(), 2);
    assert.equal(await page.locator('[data-marrakech-cell="3,1"].is-endpoint').count(), 0);
    await occupiedSecond.tap();
    const previewColor = await page.locator('#marrakechRugPreview').evaluate(element => getComputedStyle(element).backgroundColor);
    assert.equal(previewColor, 'rgb(189, 81, 67)');
    await page.locator('[data-marrakech-cell="2,2"]').tap();
    assert.equal(await occupiedFirst.getAttribute('aria-pressed'), 'true');
    assert.equal(await occupiedSecond.getAttribute('aria-pressed'), 'false');
    assert.equal(await page.locator('[data-marrakech-cell="2,2"]').getAttribute('aria-pressed'), 'true');
    await page.locator('[data-marrakech-cell="4,3"]').tap();
    assert.equal(await page.locator('.marrakech-cell.is-preview').count(), 0);
    assert.equal(await page.locator('[data-marrakech-cell="4,3"].is-anchor').count(), 1);
    await page.locator('#marrakechCancel').click();
    await page.locator('#marrakechExplainBtn').click();
    await occupiedFirst.tap();
    await page.locator('.obg-explain-dialog[open]').waitFor();
    assert.equal(await page.locator('.marrakech-cell.is-anchor').count(), 0);
    await page.keyboard.press('Escape');
    await occupiedFirst.tap();
    await occupiedSecond.tap();
    await page.screenshot({ path: `${output}/marrakech-cover-preview.png`, fullPage: true });
    await page.locator('#marrakechCancel').click();
    const mobileClient = await context.newCDPSession(page);
    await page.setViewportSize({ width: 390, height: 600 });
    await page.evaluate(() => window.scrollTo(0, 0));
    const boardBounds = await page.locator('#marrakechBoard').boundingBox();
    const startX = boardBounds.x + boardBounds.width / 2;
    const startY = Math.min(boardBounds.y + boardBounds.height - 30, 560);
    const scrollBefore = await page.evaluate(() => window.scrollY);
    await mobileClient.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: startX, y: startY }] });
    for (let step = 1; step <= 8; step += 1) {
      await mobileClient.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: startX, y: startY - step * 18 }] });
      await page.waitForTimeout(20);
    }
    await mobileClient.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    assert.equal(await page.locator('.marrakech-cell.is-anchor').count(), 0);
    await page.waitForFunction(previous => window.scrollY > previous + 20, scrollBefore);
    assert.equal(await viewport.evaluate(element => element.scrollTop), 0);
    assert.equal(await viewport.evaluate(element => element.scrollLeft), 0);
    await mobileClient.detach();
    for (const supplies of [[15, 15, 15], [12, 12, 12, 12], [0, 7, 12], [0, 7], [0, 0]]) {
      await page.evaluate(supplies => {
        const payload = structuredClone(lastGameStatePayload);
        const template = payload.view.players[0];
        payload.view.players = supplies.map((rugs, index) => ({
          ...template, player_id: `supply-${index}`, name: `Merchant ${index + 1}`,
          colors: [['coral'], ['gold'], ['teal'], ['violet']][index],
          rugs_left: rugs, eliminated: index === 0 && rugs === 0
        }));
        payload.view.you = 'supply-0';
        payload.view.current_turn = supplies.length === 2 ? null : 'supply-0';
        payload.view.phase = supplies.length === 2 ? 'game_over' : 'orient';
        payload.view.game_over = supplies.length === 2;
        payload.view.winner = supplies.length === 2 ? ['supply-1'] : [];
        payload.view.legal_actions = [];
        payload.view.legal_placements = [];
        renderMarrakechGameState(payload);
      }, supplies);
      assert.equal(await page.locator('#marrakechRugsLeft').innerText(), `▰ ${supplies.reduce((total, rugs) => total + rugs, 0)} rugs left`);
      assert.deepEqual(await page.locator('.marrakech-player-rugs').allTextContents(), supplies.map(rugs => `▰ ${rugs} rugs left`));
      if (supplies.length === 4) {
        for (const width of [320, 390, 1024, 1440]) {
          await page.setViewportSize({ width, height: width < 500 ? 844 : 1000 });
          await page.locator('#marrakechRugsLeft').scrollIntoViewIfNeeded();
          const layout = await page.evaluate(() => ({
            pageWidth: document.documentElement.scrollWidth,
            clipped: [...document.querySelectorAll('#marrakechRugsLeft, .marrakech-player-rugs')].filter(node => {
              const bounds = node.getBoundingClientRect();
              const parent = node.parentElement.getBoundingClientRect();
              return bounds.left < parent.left - 1 || bounds.right > parent.right + 1 || node.scrollWidth > node.clientWidth + 1;
            }).map(node => node.textContent)
          }));
          assert(layout.pageWidth <= width + 1, `Rug count overflows at ${width}`);
          assert.deepEqual(layout.clipped, [], `Rug count clipped at ${width}`);
          await page.screenshot({ path: `${output}/marrakech-rugs-left-${width}.png`, fullPage: true });
        }
      }
    }
    await page.setViewportSize({ width: 390, height: 844 });
    await page.locator('#marrakechRugsLeft').tap();
    await page.locator('#marrakechTooltip').waitFor({ state: 'visible' });
    assert.match(await page.locator('#marrakechTooltip').innerText(), /whole unplaced rugs|待放地毯/);
    await page.locator('#marrakechTooltip').waitFor({ state: 'hidden' });
    await page.locator('#marrakechExplainBtn').click();
    await page.locator('#marrakechRugsLeft').tap();
    await page.locator('.obg-explain-dialog[open]').waitFor();
    assert.match(await page.locator('.obg-explain-dialog[open]').innerText(), /whole unplaced rugs|待放地毯/);
    await page.keyboard.press('Escape');
    assert.deepEqual(errors, []);
    console.log('Marrakech browser: four widths, total/per-player rug supplies, placement/reconnect updates, 2/3/4-player counts, zero/early-end counts, tooltips/Explain, full-board fit, page scrolling and placement interactions passed.');
  } finally {
    await context.close();
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
