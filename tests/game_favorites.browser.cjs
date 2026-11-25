const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const base = process.env.ROOM_TEST_URL || 'http://127.0.0.1:8766';
const output = 'tmp/game-favorites';
const favoritesKey = 'openboardgame:favorite_games';

(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const errors = [];
  fs.mkdirSync(output, { recursive: true });

  async function openPicker(page) {
    await page.evaluate(() => setRoomControlsCollapsed(false));
    await page.locator('#roomControlsBody').evaluate(element => Promise.all(element.getAnimations().map(animation => animation.finished)));
    await page.locator('#createBtn').click();
    await page.waitForFunction(() => cachedGameList && !gameListEl.classList.contains('hidden'));
  }

  async function openFilter(page) {
    if (!await page.locator('#gameFilterDetails').getAttribute('open').then(value => value !== null)) {
      await page.locator('#gameFilterDetails > summary').click();
    }
  }

  async function expectGames(page, expected) {
    await page.waitForFunction(ids => {
      const actual = [...document.querySelectorAll('#gameList .game-item')].map(item => item.dataset.gameId).sort();
      return JSON.stringify(actual) === JSON.stringify(ids);
    }, [...expected].sort());
  }

  async function importBackup(page, backup) {
    await page.evaluate(text => navigator.clipboard.writeText(text), typeof backup === 'string' ? backup : JSON.stringify(backup));
    await page.locator('#favoriteGamesImportBtn').click();
    await page.waitForFunction(() => !favoriteGamesImportBtn.disabled);
  }

  async function checkLayout(page, width, screenshot) {
    const result = await page.evaluate(() => {
      const modal = [...document.querySelectorAll('section.modal:not(.hidden)')].at(-1);
      const content = modal.querySelector('.modal-content');
      const bounds = content.getBoundingClientRect();
      const failures = [];
      for (const entry of document.querySelectorAll('.game-list-entry')) {
        const item = entry.querySelector('.game-item');
        const favorite = entry.querySelector('.game-favorite-btn');
        const name = entry.querySelector('.game-item-name');
        const meta = entry.querySelector('.game-item-meta');
        const entryBounds = entry.getBoundingClientRect();
        const itemBounds = item.getBoundingClientRect();
        const favoriteBounds = favorite.getBoundingClientRect();
        if (favoriteBounds.left < itemBounds.right - 1 || favoriteBounds.right > entryBounds.right + 1
          || name.getBoundingClientRect().right > meta.getBoundingClientRect().left + 1
          || entry.scrollWidth > entry.clientWidth + 1) failures.push(item.dataset.gameId);
      }
      const filter = document.querySelector('#gameFilterDetails[open] .game-filter-options');
      const filterBounds = filter?.getBoundingClientRect();
      if (filter) {
        for (const chip of filter.querySelectorAll('.game-type-filter-chip')) {
          const chipBounds = chip.getBoundingClientRect();
          if (chipBounds.left < filterBounds.left || chipBounds.right > filterBounds.right
            || chip.scrollWidth > chip.clientWidth + 1) failures.push(`Filter chip ${chip.dataset.tagId}`);
        }
      }
      return {
        fits: bounds.left >= 0 && bounds.right <= innerWidth + 1 && bounds.top >= 0 && bounds.bottom <= innerHeight + 1,
        pageFits: document.documentElement.scrollWidth <= innerWidth,
        filterFits: !filterBounds || filterBounds.left >= bounds.left && filterBounds.right <= bounds.right
          && filterBounds.bottom <= bounds.bottom && filter.scrollWidth <= filter.clientWidth + 1,
        filterWidth: filterBounds?.width,
        failures,
      };
    });
    assert.equal(result.fits, true, `${width}: dialog fits`);
    assert.equal(result.pageFits, true, `${width}: no page horizontal scroll`);
    assert.equal(result.filterFits, true, `${width}: filter fits`);
    if (result.filterWidth) {
      assert(result.filterWidth >= (width < 640 ? width - 48 : 500), `${width}: filters use the wider layout`);
    }
    assert.deepEqual(result.failures, [], `${width}: card contents do not overlap`);
    await page.screenshot({ path: `${output}/${screenshot}-${width}.png` });
  }

  try {
    for (const width of [320, 390, 1024, 1440]) {
      const context = await browser.newContext({ viewport: { width, height: 900 }, isMobile: width < 640, hasTouch: width < 640, permissions: ['clipboard-read', 'clipboard-write'] });
      await context.addInitScript(() => {
        localStorage.setItem('openboardgame:name', 'Favorites tester');
      });
      const page = await context.newPage();
      page.on('pageerror', error => errors.push(error.message));
      await page.route('https://fonts.googleapis.com/**', route => route.abort());
      try {
        await page.goto(base);
        await page.waitForFunction(() => typeof socket !== 'undefined' && socket.connected && cachedGameList);
        await page.evaluate(() => {
          window.favoriteCreateRequests = [];
          socket.onAnyOutgoing((event, payload) => {
            if (event === 'room:create') window.favoriteCreateRequests.push(payload);
          });
        });
        await openPicker(page);
        await checkLayout(page, width, 'picker');
        const favorite = page.locator('[data-favorite-game-id="cabo"]');
        await favorite.click();
        await favorite.press('Space');
        assert.equal(await favorite.getAttribute('aria-pressed'), 'false');
        await favorite.press('Enter');
        assert.equal(await favorite.getAttribute('aria-pressed'), 'true');
        assert.deepEqual(await page.evaluate(() => JSON.parse(localStorage.getItem('openboardgame:favorite_games'))), ['cabo']);
        assert.equal(await page.evaluate(() => window.favoriteCreateRequests.length), 0, 'Starring never creates a room');

        if (width < 640) {
          await page.locator('#gameList').evaluate(element => { element.scrollTop = 0; });
          const swipeTarget = await page.locator('.game-favorite-btn').nth(5).boundingBox();
          const touchSession = await context.newCDPSession(page);
          const touchPoint = { x: swipeTarget.x + swipeTarget.width / 2, y: swipeTarget.y + swipeTarget.height / 2 };
          const beforeSwipe = await page.evaluate(() => localStorage.getItem('openboardgame:favorite_games'));
          await touchSession.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [touchPoint] });
          for (let step = 1; step <= 6; step += 1) {
            await touchSession.send('Input.dispatchTouchEvent', {
              type: 'touchMove', touchPoints: [{ ...touchPoint, y: touchPoint.y - step * 20 }],
            });
          }
          await touchSession.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
          await page.waitForFunction(() => gameListEl.scrollTop > 0);
          assert.equal(await page.evaluate(() => localStorage.getItem('openboardgame:favorite_games')), beforeSwipe, 'Swiping over stars only scrolls');
          await touchSession.detach();
        }

        await page.locator('#gameList').evaluate(element => { element.scrollTop = element.scrollHeight / 2; });
        const visibleFavorite = page.locator('.game-favorite-btn').filter({ visible: true });
        assert(await visibleFavorite.count() > 0);
        const scrollResult = await page.evaluate(() => {
          const container = gameListEl.getBoundingClientRect();
          const button = [...gameListEl.querySelectorAll('.game-favorite-btn')].find(element => {
            const bounds = element.getBoundingClientRect();
            return bounds.top >= container.top && bounds.bottom <= container.bottom;
          });
          const before = gameListEl.scrollTop;
          button.click();
          const after = gameListEl.scrollTop;
          button.click();
          return { before, after, final: gameListEl.scrollTop };
        });
        assert.equal(scrollResult.before, scrollResult.after);
        assert.equal(scrollResult.before, scrollResult.final);

        await openFilter(page);
        await checkLayout(page, width, 'filter');
        await page.locator('#favoriteGamesFilter').check();
        await expectGames(page, ['cabo']);
        assert.equal(await page.locator('#gameFilterCount').textContent(), '1');
        await page.locator('#playerCountFilter').selectOption('11+');
        await expectGames(page, []);
        assert.equal(await page.locator('#gameListEmpty').isVisible(), true);
        await page.locator('#playerCountFilter').selectOption('2');
        await expectGames(page, ['cabo']);
        assert.equal(await page.locator('#gameFilterCount').textContent(), '2');
        await page.keyboard.press('Escape');
        assert.equal(await page.locator('#gameFilterDetails').getAttribute('open'), null);
        assert.equal(await page.locator('#createRoomModal').isVisible(), true);
        await page.locator('#gameSearchInput').fill('not-a-game');
        await expectGames(page, []);
        await page.locator('#gameSearchInput').fill('cabo');
        await expectGames(page, ['cabo']);
        await page.locator('#gameSortSelect').selectOption('difficulty_desc');
        await expectGames(page, ['cabo']);
        await openFilter(page);
        assert.equal(await page.locator('#gameFilterDetails #gameTypeFilters').isVisible(), true);
        const tagId = await page.evaluate(() => cachedGameList.find(game => game.game_id === 'cabo').tags[0].id);
        await page.locator(`[data-tag-id="${tagId}"]`).click();
        await expectGames(page, ['cabo']);
        assert.equal(await page.locator('#gameFilterCount').textContent(), '3');
        await page.locator(`[data-tag-id="${tagId}"]`).click();
        assert.equal(await page.locator('#gameFilterCount').textContent(), '2');
        await page.locator(`[data-tag-id="${tagId}"]`).click();
        await checkLayout(page, width, 'combined-filters');
        await page.keyboard.press('Escape');
        await page.locator('[data-favorite-game-id="cabo"]').click();
        await expectGames(page, []);
        assert.equal(await page.locator('#gameFilterDetails > summary').evaluate(element => element === document.activeElement), true);
        await page.keyboard.press('Escape');

        await page.locator('#settingsBtn').click();
        await checkLayout(page, width, 'settings');
        const backup = { type: 'openboardgame:favorites', version: 1, game_ids: ['cabo', 'azul', 'cabo', 'future_game'] };
        await importBackup(page, backup);
        assert.match(await page.locator('#favoriteGamesStatus').textContent(), /Imported 3 new favorites/);
        const saved = await page.evaluate(() => localStorage.getItem('openboardgame:favorite_games'));
        await importBackup(page, backup);
        assert.match(await page.locator('#favoriteGamesStatus').textContent(), /Imported 0 new favorites/);
        await importBackup(page, { ...backup, game_ids: ['splendor'] });
        assert.match(await page.locator('#favoriteGamesStatus').textContent(), /Imported 1 new favorites/);
        const merged = await page.evaluate(() => localStorage.getItem('openboardgame:favorite_games'));
        for (const invalid of ['', '{', { unrelated: true }, { ...backup, version: 2 }, { ...backup, game_ids: ['<script>'] }, { ...backup, game_ids: [null] }, 'x'.repeat(1048577)]) {
          await importBackup(page, invalid);
          assert.match(await page.locator('#favoriteGamesStatus').textContent(), /Import failed:/);
          assert.equal(await page.evaluate(() => localStorage.getItem('openboardgame:favorite_games')), merged);
        }
        await importBackup(page, { ...backup, game_ids: [] });
        assert.equal(await page.evaluate(() => localStorage.getItem('openboardgame:favorite_games')), merged);
        await page.locator('#favoriteGamesExportBtn').click();
        await page.waitForFunction(() => !favoriteGamesExportBtn.disabled);
        assert.match(await page.locator('#favoriteGamesStatus').textContent(), /Copied 4 favorite games to clipboard/);
        const exported = await page.evaluate(async () => JSON.parse(await navigator.clipboard.readText()));
        assert.deepEqual(exported, { type: backup.type, version: 1, game_ids: ['azul', 'cabo', 'future_game', 'splendor'] });
        await page.evaluate(() => {
          window.favoritesTestExecCommand = document.execCommand;
          Object.defineProperty(navigator, 'clipboard', { configurable: true, value: {
            readText: async () => { throw new DOMException('Permission denied', 'NotAllowedError'); },
            writeText: async () => { throw new DOMException('Permission denied', 'NotAllowedError'); },
          } });
          document.execCommand = () => false;
        });
        await page.locator('#favoriteGamesImportBtn').click();
        await page.waitForFunction(() => !favoriteGamesImportBtn.disabled);
        assert.match(await page.locator('#favoriteGamesStatus').textContent(), /Import failed: Allow clipboard access/);
        assert.equal(await page.evaluate(() => localStorage.getItem('openboardgame:favorite_games')), merged);
        await page.locator('#favoriteGamesExportBtn').click();
        await page.waitForFunction(() => !favoriteGamesExportBtn.disabled);
        assert.match(await page.locator('#favoriteGamesStatus').textContent(), /Backup failed:/);
        await page.evaluate(() => {
          Object.defineProperty(navigator, 'clipboard', { configurable: true, value: undefined });
        });
        await page.locator('#favoriteGamesImportBtn').click();
        await page.waitForFunction(() => !favoriteGamesImportBtn.disabled);
        assert.match(await page.locator('#favoriteGamesStatus').textContent(), /requires HTTPS or localhost/);
        await page.evaluate(() => {
          delete navigator.clipboard;
          document.execCommand = window.favoritesTestExecCommand;
        });
        await page.locator('#settingsCloseBtn').focus();
        await page.keyboard.press('Shift+Tab');
        assert.equal(await page.locator('#logoutBtn').evaluate(element => element === document.activeElement), true);
        await page.keyboard.press('Tab');
        assert.equal(await page.locator('#settingsCloseBtn').evaluate(element => element === document.activeElement), true);
        await page.keyboard.press('Escape');

        await page.reload();
        await page.waitForFunction(() => typeof socket !== 'undefined' && socket.connected && cachedGameList);
        await openPicker(page);
        assert.equal(await page.locator('[data-favorite-game-id="cabo"]').getAttribute('aria-pressed'), 'true');
        assert.equal(await page.locator('#favoriteGamesFilter').isChecked(), false);
        await openFilter(page);
        await page.locator('#favoriteGamesFilter').check();
        await expectGames(page, ['azul', 'cabo', 'splendor']);
        await page.keyboard.press('Escape');
        const otherTab = await context.newPage();
        await otherTab.goto(base);
        await otherTab.evaluate(key => localStorage.setItem(key, JSON.stringify(['cabo'])), favoritesKey);
        await expectGames(page, ['cabo']);
        await otherTab.evaluate(key => localStorage.removeItem(key), favoritesKey);
        await expectGames(page, []);
        await otherTab.close();
        await page.keyboard.press('Escape');
        await page.evaluate(value => localStorage.setItem('openboardgame:favorite_games', value), saved);
        await page.evaluate(() => clearStoredName());
        assert.equal(await page.evaluate(() => localStorage.getItem('openboardgame:favorite_games')), saved);
        await page.locator('#settingsBtn').click();
        await page.locator('#logoutBtn').click();
        await page.locator('#logoutConfirmBtn').click();
        await page.waitForFunction(() => !pendingLogoutRequest && logoutModal.classList.contains('hidden') && socket.connected);
        assert.equal(await page.evaluate(() => localStorage.getItem('openboardgame:favorite_games')), saved);

        await page.evaluate(key => {
          localStorage.setItem(key, '{broken');
          saveStoredName('Storage tester');
        }, favoritesKey);
        await openPicker(page);
        assert.equal(await page.locator('[data-favorite-game-id="cabo"]').getAttribute('aria-pressed'), 'false');
        await page.evaluate(() => { Storage.prototype.setItem = () => { throw new DOMException('Quota exceeded', 'QuotaExceededError'); }; });
        await page.locator('[data-favorite-game-id="cabo"]').click();
        assert.equal(await page.locator('[data-favorite-game-id="cabo"]').getAttribute('aria-pressed'), 'true');
        await openFilter(page);
        await page.locator('#favoriteGamesFilter').check();
        await expectGames(page, ['cabo']);
        await page.keyboard.press('Escape');
        await page.keyboard.press('Escape');
        await page.locator('#settingsBtn').click();
        assert.match(await page.locator('#favoriteGamesStatus').textContent(), /this tab only/);
        console.log(`${width}px: favorites, filters, backup/import, persistence, identity isolation, keyboard, touch scrolling and layout passed`);
      } finally {
        await context.close();
      }
    }
    assert.deepEqual(errors, [], 'Browser errors');
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
