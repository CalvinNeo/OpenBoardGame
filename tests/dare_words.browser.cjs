const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const base = process.env.ROOM_TEST_URL || 'http://127.0.0.1:8766';
const output = 'tmp/dare-words-modes';
fs.mkdirSync(output, { recursive: true });

(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const errors = [];
  const results = [];
  async function openPage(width, name) {
    const context = await browser.newContext({
      viewport: { width, height: width < 500 ? 844 : 900 },
      isMobile: width < 500,
      hasTouch: width < 500,
    });
    const page = await context.newPage();
    page.on('pageerror', error => errors.push(error.message));
    await page.route('https://fonts.googleapis.com/**', route => route.abort());
    await page.goto(base);
    await page.waitForFunction(() => typeof socket !== 'undefined' && socket.connected && cachedGameList);
    return { context, page, name };
  }
  async function waitFlips(pages, flips) {
    for (const page of pages) {
      await page.waitForFunction(count => lastGameStatePayload?.view?.flips === count, flips);
    }
  }
  async function sendAction(page, type) {
    await page.evaluate(type => {
      const view = lastGameStatePayload.view;
      socket.emit('game:action', { action: { type, game_token: view.game_token, window_id: view.window_id } });
    }, type);
  }
  async function checkLayout(page, crowded = false) {
    const layout = await page.evaluate(() => {
      const rect = identifier => {
        const bounds = document.getElementById(identifier).getBoundingClientRect();
        return { left: bounds.left, right: bounds.right, top: bounds.top, bottom: bounds.bottom, height: bounds.height };
      };
      const row = document.getElementById('dareWordsRow');
      return {
        width: innerWidth, documentWidth: document.documentElement.scrollWidth,
        panel: rect('dareWordsPanel'), row: rect('dareWordsRow'),
        flip: rect('dareWordsFlipBtn'), finish: rect('dareWordsFinishBtn'), claim: rect('dareWordsClaimBtn'),
        rowHeight: row.clientHeight, rowContent: row.scrollHeight,
      };
    });
    assert.ok(layout.documentWidth <= layout.width + 1, JSON.stringify(layout));
    assert.ok(layout.panel.left >= 0 && layout.panel.right <= layout.width + 1, JSON.stringify(layout));
    assert.ok(layout.row.bottom <= layout.flip.top + 1, JSON.stringify(layout));
    assert.ok(layout.flip.bottom <= layout.claim.top + 1, JSON.stringify(layout));
    if (layout.finish.height) {
      const separated = layout.finish.left >= layout.flip.right || layout.finish.top >= layout.flip.bottom;
      assert.ok(separated, JSON.stringify(layout));
    }
    if (crowded) {
      assert.ok(layout.rowContent > layout.rowHeight, JSON.stringify(layout));
      assert.ok(layout.row.height <= 370, JSON.stringify(layout));
    }
  }
  async function playMode(width, mode) {
    const host = await openPage(width, 'Ann');
    const guest = await openPage(width, 'Ben');
    const pages = [host.page, guest.page];
    try {
      await host.page.evaluate(name => socket.emit('room:create', { name, game_type: 'dare_words' }), host.name);
      await host.page.waitForFunction(() => roomSessionReady && isGameAssetsLoaded('dare_words'));
      const identifier = await host.page.evaluate(() => roomId);
      await guest.page.evaluate(({ identifier, name }) => socket.emit('room:join', { room_id: identifier, name }),
        { identifier, name: guest.name });
      await guest.page.waitForFunction(() => roomSessionReady && isGameAssetsLoaded('dare_words'));
      for (const page of pages) {
        await page.evaluate(identifier => socket.emit('room:ready', { room_id: identifier, ready: true }), identifier);
      }
      await host.page.waitForFunction(() => !document.getElementById('startBtn').disabled);
      await host.page.evaluate(() => {
        if (document.getElementById('roomControlsPanel').classList.contains('collapsed')) {
          document.getElementById('roomControlsToggleBtn').click();
        }
      });
      await host.page.selectOption('#dareWordsDeckSelect', mode);
      await host.page.selectOption('#dareWordsMinCharsSelect', '5');
      assert.deepEqual(await host.page.evaluate(() => getDareWordsConfig()), { deck_size: mode, min_chars: 5 });
      await host.page.screenshot({ path: `${output}/${width}-${mode}-config.png`, fullPage: true });
      await host.page.click('#startBtn');
      for (const page of pages) {
        await page.waitForFunction(mode => lastGameStatePayload?.view?.deck_size === mode
          && lastGameStatePayload.view.phase === 'flipping', mode);
      }
      const initial = await host.page.evaluate(() => ({
        view: lastGameStatePayload.view,
        counter: document.getElementById('dareWordsDeckCount').textContent,
        config: document.getElementById('dareWordsDeckSelect').value,
        locked: document.getElementById('dareWordsDeckSelect').disabled,
        finishHidden: document.getElementById('dareWordsFinishBtn').hidden,
      }));
      assert.equal(initial.config, mode);
      assert.ok(initial.locked);
      assert.equal(initial.view.deck_total, mode === 'endless' ? null : 200);
      assert.equal(initial.finishHidden, mode !== 'endless');
      assert.ok(initial.counter.includes(mode === 'endless' ? '∞' : '/ 200'));
      await checkLayout(host.page);
      await host.page.click('#dareWordsHelpBtn');
      const help = host.page.locator('dialog[data-obg-help-game="dare_words"]');
      await help.locator('[data-obg-help-lang="zh"]').click();
      await help.locator('[data-obg-help-tab="flow"]').click();
      assert.match(await help.innerText(), /Extended 共 200 张/);
      assert.match(await help.innerText(), /Endless 无尽模式/);
      await help.locator('[data-obg-help-lang="en"]').click();
      await help.locator('[data-obg-help-tab="flow"]').click();
      assert.match(await help.innerText(), /Extended with 200/);
      assert.match(await help.innerText(), /Endless/);
      await help.locator('[data-obg-help-tab="ending"]').click();
      assert.match(await help.innerText(), /Endless never ends/);
      await host.page.keyboard.press('Escape');
      await host.page.waitForFunction(() => !document.querySelector('dialog[open]'));
      await host.page.click('#dareWordsExplainBtn');
      await host.page.click('#dareWordsFlipBtn');
      await host.page.waitForSelector('.obg-explain-dialog[open]');
      assert.equal(await host.page.evaluate(() => lastGameStatePayload.view.flips), 0);
      await host.page.keyboard.press('Escape');
      for (let index = 0; index < 6; index += 1) {
        await pages[index % 2].click('#dareWordsFlipBtn');
        await waitFlips(pages, index + 1);
      }
      await host.page.locator('#dareWordsRow .dare-words-card').nth(0).click();
      await host.page.locator('#dareWordsRow .dare-words-card').nth(0).click();
      assert.equal(await host.page.locator('#dareWordsPhrase .dare-words-pick').count(), 0);
      for (let index = 0; index < 4; index += 1) {
        await host.page.locator('#dareWordsRow .dare-words-card').nth(index).click();
      }
      assert.ok(await host.page.locator('#dareWordsClaimBtn').isDisabled());
      await host.page.locator('#dareWordsRow .dare-words-card').nth(4).click();
      assert.ok(await host.page.locator('#dareWordsClaimBtn').isEnabled());
      await host.page.click('#dareWordsClaimBtn');
      await guest.page.waitForFunction(() => lastGameStatePayload.view.phase === 'voting');
      assert.ok(await guest.page.locator('#dareWordsFinishBtn').isHidden());
      await guest.page.click('#dareWordsAcceptBtn');
      for (const page of pages) await page.waitForFunction(() => lastGameStatePayload.view.phase === 'reveal');
      assert.match(await host.page.locator('#dareWordsResultScore').innerText(), /\+5/);
      await checkLayout(host.page);
      await host.page.click('#dareWordsNextBtn');
      assert.equal(await host.page.evaluate(() => lastGameStatePayload.view.phase), 'reveal');
      await guest.page.click('#dareWordsNextBtn');
      for (const page of pages) await page.waitForFunction(() => lastGameStatePayload.view.phase === 'flipping');
      const limit = mode === 'endless' ? 201 : 200;
      for (let flips = 6; flips < limit; flips += 1) {
        await sendAction(pages[flips % 2], 'flip');
        await waitFlips(pages, flips + 1);
      }
      const end = await host.page.evaluate(() => lastGameStatePayload.view);
      assert.equal(end.deck_remaining, mode === 'endless' ? 99 : 0);
      assert.equal(end.game_over, false);
      assert.equal(end.row.length, limit - 5);
      assert.equal(end.players.find(player => player.is_you).score, 5);
      assert.equal(end.row.length, new Set(end.row.map(card => card.card_id)).size);
      assert.ok(!('initial_deck' in end));
      await checkLayout(host.page, true);
      await host.page.locator('#dareWordsRow').scrollIntoViewIfNeeded();
      if (width < 500) {
        const gesture = await host.page.locator('#dareWordsRow').evaluate(element => {
          element.scrollTop = 0;
          const bounds = element.getBoundingClientRect();
          return { x: bounds.left + 30, y: bounds.bottom - 30, pageScroll: scrollY };
        });
        const session = await host.context.newCDPSession(host.page);
        await session.send('Input.dispatchTouchEvent', {
          type: 'touchStart', touchPoints: [{ x: gesture.x, y: gesture.y }],
        });
        for (let step = 1; step <= 10; step += 1) {
          await session.send('Input.dispatchTouchEvent', {
            type: 'touchMove', touchPoints: [{ x: gesture.x, y: gesture.y - step * 12 }],
          });
        }
        await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
        await host.page.waitForFunction(() => document.getElementById('dareWordsRow').scrollTop > 50);
        assert.equal(await host.page.locator('#dareWordsPhrase .dare-words-pick').count(), 0);
        assert.equal(await host.page.evaluate(() => scrollY), gesture.pageScroll);
        await session.detach();
        await host.page.locator('#dareWordsRow').evaluate(async element => {
          let previous = element.scrollTop;
          let stableFrames = 0;
          while (stableFrames < 12) {
            await new Promise(requestAnimationFrame);
            const current = element.scrollTop;
            stableFrames = current === previous ? stableFrames + 1 : 0;
            previous = current;
          }
        });
      }
      await host.page.evaluate(() => { document.getElementById('dareWordsRow').scrollTop = 500; });
      const scrollBefore = await host.page.locator('#dareWordsRow').evaluate(element => element.scrollTop);
      await host.page.evaluate(() => {
        const row = document.getElementById('dareWordsRow');
        const bounds = row.getBoundingClientRect();
        const card = [...row.children].find(element => {
          const candidate = element.getBoundingClientRect();
          return candidate.top >= bounds.top && candidate.bottom <= bounds.bottom;
        });
        card.click();
      });
      assert.equal(await host.page.locator('#dareWordsRow').evaluate(element => element.scrollTop), scrollBefore);
      assert.equal(await host.page.locator('#dareWordsPhrase .dare-words-pick').count(), 1);
      await host.page.locator('#dareWordsPhrase .dare-words-pick').click();
      await host.page.screenshot({ path: `${output}/${width}-${mode}-crowded.png`, fullPage: true });
      await guest.page.click('#dareWordsFinishBtn');
      for (const page of pages) await page.waitForFunction(() => lastGameStatePayload.view.phase === 'game_over');
      assert.equal(await host.page.locator('#dareWordsResultPhrase').innerText(),
        mode === 'endless' ? '无尽模式已结束' : '牌堆已空');
      await host.page.click('#dareWordsNextBtn');
      await host.page.waitForFunction(mode => lastGameStatePayload.view.phase === 'flipping'
        && lastGameStatePayload.view.deck_size === mode && lastGameStatePayload.view.flips === 0, mode);
      results.push(`${width}px ${mode}: settings, Help/Explain/Escape, claims, pause, large row, finish/replay passed`);
    } finally {
      await host.context.close();
      await guest.context.close();
    }
  }
  try {
    for (const width of [320, 390, 1024, 1440]) {
      for (const mode of ['extended', 'endless']) await playMode(width, mode);
    }
    assert.deepEqual(errors, []);
    console.log(results.join('\n'));
    console.log(`PASS: ${results.length} real two-player flows; no page errors; screenshots in ${output}`);
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
