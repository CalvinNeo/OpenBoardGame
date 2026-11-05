const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const base = process.env.ROOM_TEST_URL || 'http://127.0.0.1:8766';
const output = 'tmp/chromino-layout-qa';

(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 950 } });
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
    await page.locator('#chrominoDialog[open]').waitFor();
    await page.keyboard.press('Escape');
    assert.equal(await page.locator('#chrominoDialog').evaluate(dialog => dialog.open), false);

    await page.evaluate(() => {
      const mock = JSON.parse(JSON.stringify(lastGameStatePayload));
      mock.view.legal_actions = ['place'];
      mock.view.legal_placements = [{ tile_id: mock.view.hand[0].tile_id, rotation: 0, x: 1, y: 1 }];
      renderChrominoGameState(mock);
    });
    await page.locator('#chrominoHand .chromino-hand-tile:not(:disabled)').first().click();
    await page.locator('[data-chromino-center="1,1"]').click();
    assert.equal(await page.locator('#chrominoConfirm').isEnabled(), true);
    await page.locator('#chrominoRotate').click();
    assert.match(await page.locator('#chrominoSelection').textContent(), /^90°/);
    assert.equal(await page.locator('#chrominoConfirm').isDisabled(), true);

    await page.evaluate(() => {
      const mock = JSON.parse(JSON.stringify(lastGameStatePayload));
      mock.view.phase = 'play';
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
          headerActions: rect('#chrominoHeaderActions'),
          reconnect: { ...rect('#gameReconnectBtn'), ...styles('#gameReconnectBtn') },
          help: { ...rect('#chrominoHelpBtn'), ...styles('#chrominoHelpBtn') },
          explain: { ...rect('#chrominoExplainBtn'), ...styles('#chrominoExplainBtn') },
          turn: rect('#chrominoTurn'),
          rotate: rect('#chrominoRotate'),
          confirm: rect('#chrominoConfirm'),
          board: rect('#chrominoBoard'),
          hand: rect('#chrominoHand'),
          draw: { ...rect('#chrominoDraw'), hidden: document.getElementById('chrominoDraw').classList.contains('hidden') },
          hintExists: !!document.getElementById('chrominoHint'),
        };
      });

      assert.equal(layout.pageOverflow, false, `page overflow at ${width}px`);
      assert.equal(layout.panelOverflow, false, `Chromino panel overflow at ${width}px`);
      assert.doesNotMatch(layout.title, /\p{Script=Han}/u);
      assert.equal(layout.header.flexWrap, 'nowrap');
      assert(Math.abs((layout.headerActions.y + layout.headerActions.height / 2) - (layout.help.y + layout.help.height / 2)) <= 2, `Help left the title row at ${width}px`);
      assert.equal(await page.locator('.chromino-topline').count(), 0);
      assert.equal(await page.locator('.chromino-edition').count(), 0);
      assert.equal(layout.reconnect.whiteSpace, 'nowrap');
      assert.equal(layout.help.whiteSpace, 'nowrap');
      assert.equal(layout.explain.whiteSpace, 'nowrap');
      assert(Math.abs((layout.turn.y + layout.turn.height / 2) - (layout.rotate.y + layout.rotate.height / 2)) <= 2, `Round and Rotate separated at ${width}px`);
      assert(Math.abs((layout.turn.y + layout.turn.height / 2) - (layout.confirm.y + layout.confirm.height / 2)) <= 2, `Round and Confirm separated at ${width}px`);
      assert(layout.board.height >= (width <= 760 ? 300 : 320), `board too short at ${width}px: ${layout.board.height}`);
      assert.equal(layout.draw.hidden, false);
      assert(layout.draw.y >= layout.hand.bottom - 1, `Draw is not after hand at ${width}px`);
      assert.equal(layout.hintExists, false);

      await page.screenshot({ path: `${output}/${width}px.png`, fullPage: true });
    }
    assert.deepEqual(errors, []);
    console.log('Chromino responsive layout passed at 320, 390, 1024, and 1440px.');
  } finally {
    await browser.close();
  }
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
