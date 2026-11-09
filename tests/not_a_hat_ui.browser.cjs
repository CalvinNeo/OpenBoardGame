const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const base = process.env.ROOM_TEST_URL || 'http://127.0.0.1:8766';
const output = 'tmp/not-a-hat-ui-qa';
const WIDTHS = [[320, 844], [390, 844], [1024, 900], [1440, 950]];

async function settle(page) {
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
}

async function audit(page, width, label) {
  return page.evaluate(({ width, label }) => {
    const panel = document.getElementById('notAHatPanel');
    const clipped = [];
    panel.querySelectorAll('*').forEach(node => {
      if (!node.getClientRects().length) return;
      const style = getComputedStyle(node);
      if (style.overflow !== 'visible' || style.display === 'none') return;
      if (node.scrollWidth > node.clientWidth + 1 && node.clientWidth > 0) {
        clipped.push((node.className || node.tagName) + ' ' + node.scrollWidth + '>' + node.clientWidth);
      }
    });
    const boxes = selector => Array.from(panel.querySelectorAll(selector))
      .filter(node => node.getClientRects().length)
      .map(node => {
        const box = node.getBoundingClientRect();
        return { x: box.x, y: box.y, right: box.right, bottom: box.bottom, w: box.width, h: box.height };
      });
    const overlaps = list => {
      let count = 0;
      for (let i = 0; i < list.length; i += 1) {
        for (let j = i + 1; j < list.length; j += 1) {
          const a = list[i];
          const b = list[j];
          if (a.x < b.right - 1 && b.x < a.right - 1 && a.y < b.bottom - 1 && b.y < a.bottom - 1) count += 1;
        }
      }
      return count;
    };
    const rect = selector => {
      const node = document.querySelector(selector);
      if (!node || !node.getClientRects().length) return null;
      const box = node.getBoundingClientRect();
      return { x: box.x, y: box.y, width: box.width, height: box.height, bottom: box.bottom, right: box.right };
    };
    const seats = boxes('.nah-seat');
    const cards = boxes('.nah-card');
    const items = boxes('.nah-item');
    const root = rect('.nah-root');
    return {
      label,
      width,
      pageOverflow: document.documentElement.scrollWidth > window.innerWidth + 1,
      bodyOverflow: document.body.scrollWidth > window.innerWidth + 1,
      panelOverflow: panel.scrollWidth > panel.clientWidth + 1,
      clipped,
      seatOverlaps: overlaps(seats),
      cardOverlaps: overlaps(cards),
      seatCount: seats.length,
      cardCount: cards.length,
      itemCount: items.length,
      smallestSeat: seats.length ? Math.round(Math.min(...seats.map(s => s.w))) : 0,
      smallestCard: cards.length ? Math.round(Math.min(...cards.map(c => c.w))) : 0,
      title: document.querySelector('.game-panel-title h2').textContent,
      help: rect('#notAHatHelpBtn'),
      reconnect: rect('#gameReconnectBtn'),
      headerActionsVisible: (() => {
        const node = document.getElementById('notAHatHeaderActions');
        return !!node && getComputedStyle(node).display !== 'none';
      })(),
      explain: rect('#notAHatExplainBtn'),
      helpStyle: (() => {
        const node = document.getElementById('notAHatHelpBtn');
        const s = getComputedStyle(node);
        return { whiteSpace: s.whiteSpace };
      })(),
      reconnectStyle: (() => {
        const node = document.getElementById('gameReconnectBtn');
        const s = getComputedStyle(node);
        return { whiteSpace: s.whiteSpace };
      })(),
      explainStyle: (() => {
        const node = document.getElementById('notAHatExplainBtn');
        const s = getComputedStyle(node);
        return { whiteSpace: s.whiteSpace };
      })(),
      headerActions: rect('#notAHatHeaderActions'),
      board: rect('#notAHatBoard'),
      action: rect('#notAHatAction'),
      logbox: rect('.nah-logbox'),
      rootBottom: root ? Math.round(root.bottom) : 0,
      viewport: window.innerHeight,
      docHeight: document.documentElement.scrollHeight,
    };
  }, { width, label });
}

function mockPhases(base) {
  const players = base.view.players;
  const me = base.view.you;
  const other = players.find(p => p.player_id !== me) || players[0];
  const third = players.find(p => p.player_id !== me && p.player_id !== other.player_id) || other;
  const build = (patch, legal) => {
    const mock = JSON.parse(JSON.stringify(base));
    Object.assign(mock.view, patch);
    mock.view.legal_actions = legal;
    mock.events = [];
    return mock;
  };
  const faceDown = card => Object.assign({}, card, { face_up: false });
  const withStacks = mapper => players.map((p, index) => Object.assign({}, p, {
    stack: mapper(p, index),
  }));
  const item = key => base.view.items.find(entry => entry.key === key) || base.view.items[0];

  return {
    memorize: build({
      phase: 'memorize',
      game_over: false,
      ready: [other.player_id],
      giver: null,
      receiver: null,
      announced: null,
      pending: null,
      in_transit: null,
      players: withStacks(p => p.stack.map(c => Object.assign({}, c, { face_up: true }))),
    }, ['ready']),
    giving: build({
      phase: 'giving',
      game_over: false,
      ready: [],
      giver: me,
      receiver: null,
      announced: null,
      pending: null,
      in_transit: null,
      players: withStacks((p, index) => index === 0
        ? p.stack.map(faceDown)
        : p.stack.map(c => Object.assign({}, c, { face_up: index % 2 === 0 }))),
    }, ['give']),
    givingShop: build({
      phase: 'giving',
      game_over: false,
      ready: [],
      giver: me,
      receiver: null,
      announced: null,
      pending: { id: 900, dir: 'right', back: 'light', face_up: true, item: 'pizza' },
      in_transit: null,
      players: withStacks(p => p.stack.map(faceDown)),
    }, ['give']),
    receiving: build({
      phase: 'receiving',
      game_over: false,
      ready: [],
      giver: other.player_id,
      receiver: me,
      announced: 'hat',
      pending: null,
      in_transit: { id: 901, dir: 'left', back: 'dark', face_up: false },
      players: withStacks(p => p.stack.map(faceDown)),
    }, ['accept', 'refuse']),
    watching: build({
      phase: 'receiving',
      game_over: false,
      ready: [],
      giver: other.player_id,
      receiver: third.player_id,
      announced: 'rocket',
      pending: null,
      in_transit: { id: 902, dir: 'right', back: 'light', face_up: false },
      players: withStacks(p => p.stack.map(faceDown)),
    }, []),
    review: build({
      phase: 'review',
      game_over: false,
      ready: [other.player_id],
      giver: null,
      receiver: null,
      announced: null,
      pending: null,
      in_transit: null,
      last_refusal: {
        giver: other.player_id,
        receiver: me,
        announced: 'hat',
        actual: 'banana',
        honest: false,
        loser: other.player_id,
        penalties: {},
      },
      players: players.map((p, index) => Object.assign({}, p, {
        stack: p.stack.map(faceDown),
        penalties: index === 1 ? ['banana'] : [],
        penalty_count: index === 1 ? 1 : 0,
      })),
    }, ['continue']),
    gameover: build({
      phase: 'game_over',
      game_over: true,
      ready: [],
      giver: null,
      receiver: null,
      announced: null,
      pending: null,
      in_transit: null,
      winners: [me],
      scores: players.reduce((acc, p, index) => {
        acc[p.player_id] = index === 0 ? 0 : index;
        return acc;
      }, {}),
      players: players.map((p, index) => Object.assign({}, p, {
        stack: p.stack.map(faceDown),
        penalties: index === 0 ? [] : ['hat', 'cake', 'rocket'].slice(0, index),
        penalty_count: index === 0 ? 0 : index,
      })),
    }, []),
  };
}

(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 950 } });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => {
    if (message.type() === 'error' && !/Failed to load resource/.test(message.text())) {
      errors.push('console: ' + message.text());
    }
  });
  fs.mkdirSync(output, { recursive: true });

  try {
    await page.route('https://fonts.googleapis.com/**', route => route.abort());
    await page.goto(base);
    await page.waitForFunction(() => typeof socket !== 'undefined' && socket.connected && cachedGameList);
    await page.evaluate(() => socket.emit('room:create', { name: 'Hat UI QA', game_type: 'not_a_hat', config: {} }));
    await page.waitForFunction(() => roomSessionReady && currentGameType === 'not_a_hat');
    await page.waitForFunction(() => isGameAssetsLoaded('not_a_hat'));
    await page.evaluate(() => setRoomControlsCollapsed(false));

    for (let i = 0; i < 4; i += 1) {
      await page.evaluate(() => socket.emit('room:add_bot', { room_id: roomId }));
      await page.waitForFunction(count => currentRoomState.players.length === count, 2 + i);
    }
    await page.evaluate(() => socket.emit('room:ready', { room_id: roomId, ready: true }));
    await page.waitForFunction(() => !document.getElementById('startBtn').disabled);
    await page.locator('#startBtn').click();
    await page.waitForFunction(() => lastGameStatePayload?.game_type === 'not_a_hat' && lastGameStatePayload.view?.players?.length);
    await page.locator('#notAHatPanel').waitFor({ state: 'visible' });

    // --- Panel title, Help and Explain ---------------------------------
    assert.equal(await page.locator('.game-panel-title h2').textContent(), '🎩 似帽非帽');
    await page.locator('#notAHatHelpBtn').click();
    await page.locator('dialog.obg-help-dialog[open]').waitFor();
    const tabs = await page.locator('dialog.obg-help-dialog .obg-help-tab').count();
    assert(tabs >= 4, 'Help needs section tabs, saw ' + tabs);
    await page.screenshot({ path: output + '/help-1440px.png' });
    await page.keyboard.press('Escape');
    assert.equal(await page.locator('dialog.obg-help-dialog').evaluate(node => node.open), false, 'Esc did not close Help');

    await page.locator('#notAHatExplainBtn').click();
    assert.equal(await page.locator('#notAHatExplainBtn').getAttribute('aria-pressed'), 'true');
    const explained = await page.locator('#notAHatPanel .obg-has-explanation').count();
    assert(explained >= 6, 'Explain mode highlighted only ' + explained + ' nodes');
    await page.screenshot({ path: output + '/explain-1440px.png' });
    await page.locator('#notAHatBoard').click({ position: { x: 4, y: 4 } });
    await page.locator('dialog.obg-explain-dialog[open]').waitFor();
    assert.equal(await page.locator('#notAHatExplainBtn').getAttribute('aria-pressed'), 'false', 'Explain did not auto exit');
    await page.keyboard.press('Escape');

    // --- Live interaction: ready, then pick a gift ---------------------
    await page.locator('#notAHatAction button', { hasText: "I'm ready" }).click();
    await page.waitForFunction(() => lastGameStatePayload?.view?.phase !== 'memorize');

    const basePayload = await page.evaluate(() => JSON.parse(JSON.stringify(lastGameStatePayload)));
    const built = mockPhases(basePayload);
    // Freeze the live room so bot turns cannot re-render between assertions.
    await page.evaluate(() => socket.disconnect());
    await page.waitForTimeout(300);
    const reports = [];
    for (const [name, payload] of Object.entries(built)) {
      await page.evaluate(data => renderNotAHatGameState(data), payload);
      for (const [width, height] of WIDTHS) {
        await page.setViewportSize({ width, height });
        await settle(page);
        const report = await audit(page, width, name);
        reports.push(report);
        assert.equal(report.pageOverflow, false, name + ': page overflows horizontally at ' + width + 'px');
        assert.equal(report.bodyOverflow, false, name + ': body overflows horizontally at ' + width + 'px');
        assert.equal(report.panelOverflow, false, name + ': panel overflows horizontally at ' + width + 'px');
        assert.deepEqual(report.clipped, [], name + ': content clipped at ' + width + 'px');
        assert.equal(report.seatOverlaps, 0, name + ': seats overlap at ' + width + 'px');
        assert.equal(report.cardOverlaps, 0, name + ': cards overlap at ' + width + 'px');
        assert.equal(report.title, '🎩 似帽非帽', name + ': panel title lost at ' + width + 'px');
        assert.equal(report.helpStyle.whiteSpace, 'nowrap', name + ': Help wraps at ' + width + 'px');
        assert.equal(report.explainStyle.whiteSpace, 'nowrap', name + ': Explain wraps at ' + width + 'px');
        assert.equal(report.headerActionsVisible, true, name + ': header actions hidden at ' + width + 'px');
        const helpMid = report.help.y + report.help.height / 2;
        const reconnectMid = report.reconnect.y + report.reconnect.height / 2;
        assert(Math.abs(helpMid - reconnectMid) <= 6,
          name + ': Help left the Reconnect row at ' + width + 'px');
        assert(report.seatCount === 5, name + ': expected 5 seats at ' + width + 'px, saw ' + report.seatCount);
        assert(report.smallestSeat >= (width <= 360 ? 130 : 150),
          name + ': seat only ' + report.smallestSeat + 'px wide at ' + width + 'px');
        assert(report.smallestCard >= 34, name + ': card only ' + report.smallestCard + 'px wide at ' + width + 'px');
        assert(report.board.height >= 120, name + ': board collapsed at ' + width + 'px');
        await page.screenshot({ path: output + '/' + name + '-' + width + 'px.png', fullPage: true });
      }
    }

    // --- Picker behaviour at the narrowest phone ------------------------
    await page.evaluate(data => renderNotAHatGameState(data), built.giving);
    await page.setViewportSize({ width: 320, height: 844 });
    await settle(page);
    const giveBtn = page.locator('#notAHatGiveBtn');
    assert.equal(await giveBtn.isDisabled(), true, 'Give enabled without a pick');
    await page.locator('#notAHatPickerGrid .nah-item').first().click();
    assert.equal(await giveBtn.isDisabled(), false, 'Give still disabled after picking');
    assert.equal(await page.locator('#notAHatPickerGrid .nah-item.is-picked').count(), 1);
    assert((await page.locator('#notAHatPicked').textContent()).trim().length > 3, 'picked label empty');
    await page.screenshot({ path: output + '/picker-picked-320px.png' });
    // Tapping the same gift again clears it, so no Clear Selection button is needed.
    await page.locator('#notAHatPickerGrid .nah-item.is-picked').click();
    assert.equal(await page.locator('#notAHatPickerGrid .nah-item.is-picked').count(), 0, 're-tap did not clear the pick');
    assert.equal(await giveBtn.isDisabled(), true, 'Give stayed enabled after clearing');

    // Search and category filters must actually shrink the list.
    const allItems = await page.locator('#notAHatPickerGrid .nah-item:not(.is-filtered)').count();
    await page.locator('#notAHatPickerSearch').fill('hat');
    await settle(page);
    const hatItems = await page.locator('#notAHatPickerGrid .nah-item:not(.is-filtered)').count();
    assert(hatItems > 0 && hatItems < allItems, 'search did not filter: ' + hatItems + '/' + allItems);
    await page.locator('#notAHatPickerSearch').fill('');
    await page.locator('#notAHatPickerCats .nah-cat').nth(1).click();
    await settle(page);
    const catItems = await page.locator('#notAHatPickerGrid .nah-item:not(.is-filtered)').count();
    assert(catItems > 0 && catItems < allItems, 'category did not filter: ' + catItems + '/' + allItems);
    await page.locator('#notAHatPickerCats .nah-cat').first().click();
    await settle(page);
    assert.equal(await page.locator('#notAHatPickerGrid .nah-item:not(.is-filtered)').count(), allItems);

    // The picker scrolls inside itself rather than stretching the page.
    const pickerScroll = await page.locator('#notAHatPickerGrid').evaluate(node => ({
      scrollable: node.scrollHeight > node.clientHeight + 1,
      visibleRows: Math.round(node.clientHeight),
    }));
    assert.equal(pickerScroll.scrollable, true, 'picker grid is not scrollable at 320px');

    // --- Privacy: no face-down object reaches the DOM -------------------
    await page.evaluate(data => renderNotAHatGameState(data), built.receiving);
    await settle(page);
    const faceDownLeak = await page.evaluate(() => {
      const nodes = Array.from(document.querySelectorAll('#notAHatBoard .nah-card.is-down'));
      return nodes.map(node => node.textContent.trim()).filter(text => text && !/^[⬅➡️s]+$/.test(text));
    });
    assert.deepEqual(faceDownLeak, [], 'face-down cards rendered readable objects: ' + JSON.stringify(faceDownLeak));

    fs.writeFileSync(output + '/report.json', JSON.stringify(reports, null, 2));
    assert.deepEqual(errors, [], 'page errors: ' + errors.join(' | '));
    console.log('Not a Hat UI passed: ' + reports.length + ' width/phase combinations, screenshots in ' + output + '/');
  } finally {
    await browser.close();
  }
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
