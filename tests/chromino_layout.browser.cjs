const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const base = process.env.ROOM_TEST_URL || 'http://127.0.0.1:8766';
const output = 'tmp/chromino-layout-qa';

(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 950 }, hasTouch: true });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  fs.mkdirSync(output, { recursive: true });

  try {
    await page.route('https://fonts.googleapis.com/**', route => route.abort());
    await page.goto(base);
    await page.waitForFunction(() => typeof socket !== 'undefined' && socket.connected && cachedGameList);
    await page.evaluate(() => socket.emit('room:create', { name: 'Chromino layout QA', game_type: 'chromino', config: {} }));
    await page.waitForFunction(() => roomSessionReady && currentGameType === 'chromino');
    await page.waitForFunction(() => isGameAssetsLoaded('chromino'));
    await page.evaluate(() => setRoomControlsCollapsed(false));
    await page.evaluate(() => socket.emit('room:ready', { room_id: roomId, ready: true }));
    await page.waitForFunction(() => !document.getElementById('startBtn').disabled);
    await page.locator('#startBtn').click();
    await page.waitForFunction(() => lastGameStatePayload?.game_type === 'chromino');
    await page.locator('#chrominoPanel').waitFor({ state: 'visible' });
    await page.locator('#chrominoHelpBtn').click();
    const helpDialog = page.locator('dialog[data-obg-help-game="chromino"]');
    await helpDialog.waitFor({ state: 'visible' });
    await helpDialog.locator('[data-obg-help-lang="en"]').click();
    assert.equal(await helpDialog.locator('.obg-help-title').textContent(), 'Chromino');
    await helpDialog.locator('[data-obg-help-tab="colours"]').click();
    assert.match(await helpDialog.locator('[data-obg-help-section="colours"]').textContent(), /Chameleon \(★\)/);
    await helpDialog.locator('[data-obg-help-lang="zh"]').click();
    assert.match(await helpDialog.locator('.obg-help-title').textContent(), /三色拼图/);
    await page.keyboard.press('Escape');
    assert.equal(await helpDialog.evaluate(dialog => dialog.open), false);

    await page.evaluate(() => {
      const mock = JSON.parse(JSON.stringify(lastGameStatePayload));
      mock.view.legal_actions = ['place'];
      mock.view.legal_placements = [{ type: 'place', tile_id: mock.view.hand[0].tile_id, rotation: 0, x: 1, y: 1 }];
      renderChrominoGameState(mock);
    });
    await page.locator('#chrominoHand .chromino-hand-tile:not(:disabled)').first().click();
    await page.locator('[data-chromino-center="1,1"]').click();
    assert.equal(await page.locator('#chrominoConfirm').isEnabled(), true);
    await page.locator('#chrominoRotate').click();
    assert.match(await page.locator('#chrominoSelection').textContent(), /^90°/);
    assert.equal(await page.locator('#chrominoConfirm').isDisabled(), true);
    await page.keyboard.press('Escape');
    assert.equal(await page.locator('.chromino-hand-tile.is-selected').count(), 0);

    await page.locator('#chrominoHand .chromino-hand-tile:not(:disabled)').first().click();
    await page.locator('[data-chromino-center="1,1"]').click();
    await page.evaluate(() => {
      window.chrominoQaActions = [];
      sendAction = action => window.chrominoQaActions.push(action);
    });
    await page.locator('#chrominoConfirm').click();
    const sentMove = await page.evaluate(() => window.chrominoQaActions[0]);
    assert.deepEqual(sentMove, {
      type: 'place', tile_id: await page.locator('.chromino-hand-tile.is-selected').getAttribute('data-chromino-tile'),
      rotation: 0, x: 1, y: 1,
    });

    await page.evaluate(() => {
      const mock = JSON.parse(JSON.stringify(lastGameStatePayload));
      mock.view.phase = 'playing';
      mock.view.revision += 1;
      mock.view.legal_actions = ['draw'];
      mock.view.legal_placements = [];
      renderChrominoGameState(mock);
    });

    for (const [width, height] of [[320, 844], [390, 844], [1024, 900], [1440, 950]]) {
      await page.setViewportSize({ width, height });
      await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));

      const layout = await page.evaluate(() => {
        const rect = selector => {
          const { x, y, width, height } = document.querySelector(selector).getBoundingClientRect();
          return { x, y, width, height, bottom: y + height, right: x + width };
        };
        const styles = selector => {
          const element = document.querySelector(selector);
          return { whiteSpace: getComputedStyle(element).whiteSpace, flexWrap: getComputedStyle(element).flexWrap };
        };
        return {
          pageOverflow: document.documentElement.scrollWidth > innerWidth,
          panelOverflow: document.getElementById('chrominoPanel').scrollWidth > document.getElementById('chrominoPanel').clientWidth,
          title: document.querySelector('.game-panel-title h2').textContent,
          header: styles('.game-panel[data-game-theme="chromino"] > .panel-header'),
          caption: rect('.game-panel[data-game-theme="chromino"] > .panel-header'),
          headerActions: rect('#chrominoHeaderActions'),
          reconnect: { ...rect('#gameReconnectBtn'), ...styles('#gameReconnectBtn') },
          help: { ...rect('#chrominoHelpBtn'), ...styles('#chrominoHelpBtn') },
          explain: { ...rect('#chrominoExplainBtn'), ...styles('#chrominoExplainBtn') },
          turn: rect('#chrominoTurn'),
          rotate: rect('#chrominoRotate'),
          confirm: rect('#chrominoConfirm'),
          board: rect('#chrominoBoard'),
          playArea: rect('.chromino-play-area'),
          player: rect('.chromino-player'),
          playerName: rect('.chromino-player-name'),
          playerMeta: rect('.chromino-player-meta'),
          hand: rect('#chrominoHand'),
          rack: rect('.chromino-rack-area'),
          tiles: Array.from(document.querySelectorAll('.chromino-hand-tile')).map(element => {
            const button = element.getBoundingClientRect();
            const tile = element.querySelector('.chromino-tile').getBoundingClientRect();
            return {
              height: button.height, label: element.getAttribute('aria-label'),
              fits: tile.left >= button.left && tile.right <= button.right && tile.top >= button.top && tile.bottom <= button.bottom,
            };
          }),
          draw: { ...rect('#chrominoDraw'), hidden: document.getElementById('chrominoDraw').classList.contains('hidden') },
          hintExists: !!document.getElementById('chrominoHint'),
        };
      });

      assert.equal(layout.pageOverflow, false, `page overflow at ${width}px`);
      assert.equal(layout.panelOverflow, false, `Chromino panel overflow at ${width}px`);
      assert.doesNotMatch(layout.title, /\p{Script=Han}/u);
      assert.equal(layout.header.flexWrap, 'nowrap');
      assert(layout.caption.height <= 38, `caption too tall at ${width}px: ${layout.caption.height}`);
      assert(layout.player.height <= 30, `player strip too tall at ${width}px: ${layout.player.height}`);
      assert(Math.abs((layout.playerName.y + layout.playerName.height / 2) - (layout.playerMeta.y + layout.playerMeta.height / 2)) <= 2, `player caption wrapped at ${width}px`);
      assert(Math.abs((layout.headerActions.y + layout.headerActions.height / 2) - (layout.help.y + layout.help.height / 2)) <= 2, `Help left the title row at ${width}px`);
      assert.equal(await page.locator('.chromino-topline').count(), 0);
      assert.equal(await page.locator('.chromino-edition').count(), 0);
      assert.equal(layout.reconnect.whiteSpace, 'nowrap');
      assert.equal(layout.help.whiteSpace, 'nowrap');
      assert.equal(layout.explain.whiteSpace, 'nowrap');
      assert(Math.abs((layout.turn.y + layout.turn.height / 2) - (layout.rotate.y + layout.rotate.height / 2)) <= 2, `Round and Rotate separated at ${width}px`);
      assert(Math.abs((layout.turn.y + layout.turn.height / 2) - (layout.confirm.y + layout.confirm.height / 2)) <= 2, `Round and Confirm separated at ${width}px`);
      assert(layout.board.height >= height - (width <= 760 ? 390 : 220) - 1, `board too short at ${width}px: ${layout.board.height}`);
      assert.equal(await page.locator('.chromino-hand-tile .chromino-hand-label').count(), 0);
      assert(layout.tiles.every(tile => tile.height >= 44 && tile.height <= 48 && tile.fits && tile.label), `hand tiles clipped or oversized at ${width}px`);
      if (width <= 760) {
        assert(layout.hand.height <= 107, `hand too tall at ${width}px: ${layout.hand.height}`);
        assert(layout.rack.y >= layout.playArea.bottom, `rack overlaps the board controls at ${width}px`);
        assert(layout.draw.bottom <= height, `Draw is outside the viewport at ${width}px`);
      } else {
        assert(layout.rack.width <= 230, `rack too wide at ${width}px: ${layout.rack.width}`);
        assert(layout.rack.x > layout.board.right, `rack overlaps the board at ${width}px`);
      }
      assert.equal(layout.draw.hidden, false);
      assert(layout.draw.y >= layout.hand.bottom - 1, `Draw is not after hand at ${width}px`);
      assert.equal(layout.hintExists, false);

      await page.screenshot({ path: `${output}/${width}px.png`, fullPage: true });

      await page.locator('#chrominoHelpBtn').click();
      await helpDialog.waitFor({ state: 'visible' });
      assert.equal(await helpDialog.evaluate(dialog => dialog.scrollWidth <= dialog.clientWidth), true, `Help overflow at ${width}px`);
      await page.keyboard.press('Escape');
    }

    await page.locator('#chrominoZoomIn').click();
    const zoomedIn = await page.locator('#chrominoBoard').getAttribute('viewBox');
    await page.locator('#chrominoZoomOut').click();
    assert(Number((await page.locator('#chrominoBoard').getAttribute('viewBox')).split(' ')[2]) > Number(zoomedIn.split(' ')[2]));
    await page.locator('#chrominoFit').click();
    const boardBounds = await page.locator('#chrominoBoard').boundingBox();
    const originalCamera = await page.locator('#chrominoBoard').getAttribute('viewBox');
    await page.mouse.move(boardBounds.x + 20, boardBounds.y + 30);
    await page.mouse.down();
    await page.mouse.move(boardBounds.x + boardBounds.width + 15, boardBounds.y + 80, { steps: 8 });
    await page.mouse.up();
    assert.notEqual(await page.locator('#chrominoBoard').getAttribute('viewBox'), originalCamera);
    assert.equal(await page.locator('#chrominoBoard').evaluate(board => board.classList.contains('chromino-panning')), false);
    const releasedCamera = await page.locator('#chrominoBoard').getAttribute('viewBox');
    await page.mouse.move(boardBounds.x + 30, boardBounds.y + 90);
    assert.equal(await page.locator('#chrominoBoard').getAttribute('viewBox'), releasedCamera);
    await page.locator('#chrominoFit').click();

    await page.evaluate(() => window.scrollTo(0, 0));
    await page.locator('#chrominoExplainBtn').click();
    assert.equal(await page.locator('#chrominoConfirm').isDisabled(), true);
    const disabledConfirm = await page.locator('#chrominoConfirm').boundingBox();
    await page.mouse.click(disabledConfirm.x + disabledConfirm.width / 2, disabledConfirm.y + disabledConfirm.height / 2);
    await page.locator('.obg-explain-dialog[open]').waitFor();
    assert.equal(await page.locator('#chrominoExplainBtn').getAttribute('aria-pressed'), 'false');
    assert.equal(await page.evaluate(() => window.chrominoQaActions.length), 1);
    await page.keyboard.press('Escape');

    await page.setViewportSize({ width: 390, height: 844 });
    await page.reload();
    await page.waitForFunction(() => isGameAssetsLoaded('chromino') && lastGameStatePayload?.game_type === 'chromino');
    await page.evaluate(() => {
      const mock = JSON.parse(JSON.stringify(lastGameStatePayload));
      mock.view.revision += 2;
      mock.view.legal_actions = ['place'];
      mock.view.legal_placements = [{ type: 'place', tile_id: mock.view.hand[0].tile_id, rotation: 0, x: 1, y: 1 }];
      renderChrominoGameState(mock);
    });
    await page.locator('#chrominoHand').scrollIntoViewIfNeeded();
    const touchSession = await context.newCDPSession(page);
    const handBounds = await page.locator('#chrominoHand').boundingBox();
    const touchX = handBounds.x + 25;
    const touchY = handBounds.y + handBounds.height - 12;
    await touchSession.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: touchX, y: touchY }] });
    for (const distance of [12, 25, 40, 60]) {
      await touchSession.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: touchX, y: touchY - distance }] });
      await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    }
    await touchSession.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    assert.equal(await page.locator('.chromino-hand-tile.is-selected').count(), 0);
    await page.waitForFunction(() => document.getElementById('chrominoHand').scrollTop > 0);
    await page.locator('#chrominoHand').evaluate(hand => { hand.scrollTop = 0; });
    await page.locator('#chrominoHand .chromino-hand-tile:not(:disabled)').first().tap();
    assert.equal(await page.locator('.chromino-hand-tile.is-selected').count(), 1);
    await page.keyboard.press('Escape');

    for (const width of [320, 390, 1024, 1440]) {
      await page.setViewportSize({ width, height: 950 });
      await page.evaluate(() => {
        const mock = JSON.parse(JSON.stringify(lastGameStatePayload));
        const firstPlayer = mock.view.players[0];
        mock.view.revision += 3;
        mock.view.current_turn = 'chromino-layout-other';
        mock.view.legal_actions = [];
        mock.view.legal_placements = [];
        mock.view.players = Array.from({ length: 8 }, (unused, index) => ({
          ...firstPlayer, player_id: index === 0 ? mock.view.you : index === 1 ? 'chromino-layout-other' : `layout-${index}`,
          name: `Player ${index + 1} with a very long name to check truncation`,
          hand_count: index % 2 ? 1 : 8, last_tile: index % 2 ? mock.view.hand[0] : null,
        }));
        renderChrominoGameState(mock);
      });
      assert.doesNotMatch(await page.locator('#chrominoHand').textContent(), /In hand/);
      assert.equal(await page.locator('.chromino-hand-tile .chromino-hand-label').count(), 0);
      assert.equal(await page.locator('.chromino-hand-tile:not(:disabled)').count(), 0);
      assert.equal(await page.evaluate(() => {
        const players = document.getElementById('chrominoPlayers');
        return document.documentElement.scrollWidth <= innerWidth && players.scrollWidth <= players.clientWidth;
      }), true, `eight-player overflow at ${width}px`);
      assert.equal(await page.locator('.chromino-player').evaluateAll(players => players.every(player => {
        const bounds = player.getBoundingClientRect();
        const name = player.querySelector('.chromino-player-name').getBoundingClientRect();
        const meta = player.querySelector('.chromino-player-meta').getBoundingClientRect();
        return name.right <= meta.left && meta.right <= bounds.right && meta.bottom <= bounds.bottom;
      })), true, `player names overlap revealed tiles at ${width}px`);
    }

    await page.reload();
    await page.waitForFunction(() => isGameAssetsLoaded('chromino') && lastGameStatePayload?.game_type === 'chromino');
    assert.equal(await page.locator('script[src*="/chromino.js"]').count(), 1);
    assert.equal(await page.locator('link[href*="/chromino.css"]').count(), 1);
    assert.equal(await page.locator('.chromino-hand-tile .chromino-hand-label').count(), 0);
    assert.deepEqual(errors, []);
    console.log('Chromino compact layout, eight-player captions, touch scrolling, placement, Help/Explain, zoom/pan, and reload passed at 320, 390, 1024, and 1440px.');
  } finally {
    await browser.close();
  }
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
