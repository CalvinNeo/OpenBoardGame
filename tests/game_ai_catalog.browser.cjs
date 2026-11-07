const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const base = process.env.ROOM_TEST_URL || 'http://127.0.0.1:8786';
const output = 'build/game-ai-catalog';

(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const errors = [];
  fs.mkdirSync(output, { recursive: true });
  try {
    for (const width of [320, 390, 1024, 1440]) {
      const context = await browser.newContext({
        viewport: { width, height: 900 },
        isMobile: width < 600,
        hasTouch: width < 600,
      });
      try {
        const page = await context.newPage();
        page.on('pageerror', error => errors.push(error.message));
        await page.goto(base);
        await page.waitForFunction(() => typeof socket !== 'undefined' && socket.connected);
        if (!(await page.locator('#createBtn').isVisible())) {
          await page.locator('#roomControlsToggleBtn').click();
        }
        await page.locator('#createBtn').click();
        if (await page.locator('#playerNameModal').isVisible()) {
          await page.locator('#nameInput').fill('AI catalog QA');
          await page.locator('#playerNameForm button[type=submit]').click();
        }
        await page.locator('#gameList [data-game-id="abraca_what"]').waitFor();
        const catalog = await (await page.request.get(`${base}/api/games`)).json();
        const markers = await page.locator('#gameList .game-item').evaluateAll(items => items.map(item => ({
          gameId: item.dataset.gameId,
          robots: [...item.querySelectorAll('.game-item-ai')].map(marker => marker.textContent),
          label: item.getAttribute('aria-label'),
        })));
        assert.equal(markers.length, catalog.length);
        for (const game of catalog) {
          const item = markers.find(marker => marker.gameId === game.game_id);
          assert.deepEqual(item.robots, game.has_strategic_ai ? ['🤖'] : [], `${width}: ${game.game_id}`);
          assert.equal(item.label.includes('Strategic AI available'), game.has_strategic_ai);
        }
        assert.equal(catalog.find(game => game.game_id === 'abraca_what').has_strategic_ai, true);
        assert.equal(catalog.find(game => game.game_id === 'felix').has_strategic_ai, true);
        assert.equal(catalog.find(game => game.game_id === 'six_nimmt').has_strategic_ai, true);
        assert.equal(catalog.find(game => game.game_id === 'hanabi').has_strategic_ai, false);

        const bounds = await page.evaluate(() => {
          const modal = document.querySelector('.create-room-modal');
          const modalRect = modal.getBoundingClientRect();
          const bad = [];
          for (const item of document.querySelectorAll('#gameList .game-item')) {
            const itemRect = item.getBoundingClientRect();
            const marker = item.querySelector('.game-item-ai');
            if (itemRect.left < -1 || itemRect.right > innerWidth + 1 || item.scrollWidth > item.clientWidth + 1) {
              bad.push(item.dataset.gameId);
            }
            if (marker) {
              const markerRect = marker.getBoundingClientRect();
              const textRect = item.querySelector('.game-item-name-text').getBoundingClientRect();
              const nameRect = item.querySelector('.game-item-name').getBoundingClientRect();
              const metaRect = item.querySelector('.game-item-meta').getBoundingClientRect();
              if (markerRect.left < textRect.right - 1 || markerRect.right > nameRect.right + 1 ||
                  markerRect.right > metaRect.left + 1 || markerRect.right > itemRect.right + 1) {
                bad.push(`${item.dataset.gameId}: marker overlaps or clips`);
              }
            }
          }
          return {
            bad,
            modalFits: modalRect.left >= -1 && modalRect.right <= innerWidth + 1,
            pageFits: document.documentElement.scrollWidth <= innerWidth,
          };
        });
        assert.equal(bounds.modalFits, true, `${width}: modal width`);
        assert.equal(bounds.pageFits, true, `${width}: page width`);
        assert.deepEqual(bounds.bad, [], `${width}: game rows`);
        await page.screenshot({ path: `${output}/catalog-${width}.png` });

        await page.locator('#gameSearchInput').fill('菲力猫');
        const felixItem = page.locator('#gameList [data-game-id="felix"]');
        assert.equal(await page.locator('#gameList .game-item').count(), 1);
        assert.equal(await felixItem.locator('.game-item-ai').textContent(), '🤖');
        assert.match(await felixItem.getAttribute('aria-label'), /Strategic AI available/);
        await page.locator('#gameSortSelect').selectOption('difficulty_desc');
        await page.locator('#playerCountFilter').selectOption('3');
        assert.equal(await felixItem.locator('.game-item-ai').textContent(), '🤖');
        await page.screenshot({ path: `${output}/felix-${width}.png` });

        await page.locator('#gameSearchInput').fill('Abraca');
        assert.equal(await page.locator('#gameList .game-item').count(), 1);
        assert.equal(await page.locator('#gameList .game-item-ai').textContent(), '🤖');
        await page.locator('#gameSortSelect').selectOption('difficulty_desc');
        await page.locator('#playerCountFilter').selectOption('2');
        assert.equal(await page.locator('#gameList .game-item-ai').textContent(), '🤖');
        await page.screenshot({ path: `${output}/abraca-${width}.png` });
        await page.keyboard.press('Escape');
        assert.equal(await page.locator('#createRoomModal').isVisible(), false);

        if (!(await page.locator('#createBtn').isVisible())) {
          await page.locator('#roomControlsToggleBtn').click();
        }
        await page.locator('#createBtn').click();
        await page.locator('#gameSearchInput').fill('Abraca');
        await page.locator('#gameList [data-game-id="abraca_what"]').click();
        await page.waitForFunction(() => currentGameType === 'abraca_what' && roomId);
        if (width === 390) {
          await page.evaluate(() => {
            window.abracaCatalogBotActions = [];
            socket.on('game:state', payload => {
              for (const event of payload.events || []) {
                if (event.type === 'bot:action') abracaCatalogBotActions.push(event.payload.action);
              }
            });
            socket.emit('room:add_bot', { room_id: roomId });
          });
          await page.waitForFunction(() => currentRoomState.players.length === 2);
          await page.evaluate(() => socket.emit('room:ready', { room_id: roomId, ready: true }));
          await page.waitForFunction(() => currentRoomState.players.every(player => player.ready));
          await page.evaluate(() => socket.emit('room:start', { room_id: roomId }));
          await page.waitForFunction(() => currentAbracaView?.phase === 'wait_use');
          await page.locator('#abracaSpellBtn7').click();
          await page.locator('#abracaCastBtn').click();
          await page.waitForFunction(() => ['wait_draw', 'wait_goon'].includes(currentAbracaView?.phase));
          await page.locator('#abracaEndTurnBtn').click();
          await page.waitForFunction(() => abracaCatalogBotActions.length > 0 &&
            currentAbracaView?.current_turn === playerId && currentAbracaView?.phase === 'wait_use');
          const actions = await page.evaluate(() => abracaCatalogBotActions);
          assert(actions.some(action => action.type === 'cast_spell'));
          assert(await page.evaluate(() => currentAbracaView.players.find(player =>
            player.player_id === playerId).hand.every(card => card.hidden && card.spell === undefined)));
          await page.reload();
          await page.waitForFunction(() => roomSessionReady && currentAbracaView?.phase === 'wait_use');
          assert.equal(await page.evaluate(() => currentAbracaView.players.filter(player => player.is_bot).length), 1);
          console.log('Live human/Bot turn, private hand and reload/reconnect passed');
        }
        console.log(`${width}px: catalog badges, accessibility labels, layout, search, sort, filter, Escape and room creation passed`);
      } finally {
        await context.close();
      }
    }
    assert.deepEqual(errors, [], 'Browser errors');
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
