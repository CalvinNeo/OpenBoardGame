const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const base = process.env.ROOM_TEST_URL || 'http://127.0.0.1:8188';
const output = 'tmp/aidixit-ui-qa';
const WIDTHS = [[320, 844], [390, 844], [1024, 900], [1440, 950]];

async function settle(page) {
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
}

async function auditLayout(page, width, label) {
  return page.evaluate(({ width, label }) => {
    const panel = document.getElementById('aidixitPanel');
    const clipped = [];
    panel.querySelectorAll('*').forEach(node => {
      if (!node.getClientRects().length) return;
      const style = getComputedStyle(node);
      if (style.overflow !== 'visible' || style.display === 'none') return;
      if (node.scrollWidth > node.clientWidth + 1 && node.clientWidth > 0) {
        clipped.push(`${node.className || node.tagName} ${node.scrollWidth}>${node.clientWidth}`);
      }
    });
    const cards = Array.from(panel.querySelectorAll('.aidixit-card')).map(node => {
      const box = node.getBoundingClientRect();
      return { x: box.x, y: box.y, right: box.right, bottom: box.bottom, w: box.width, h: box.height };
    });
    let overlaps = 0;
    for (let i = 0; i < cards.length; i += 1) {
      for (let j = i + 1; j < cards.length; j += 1) {
        const a = cards[i];
        const b = cards[j];
        if (a.x < b.right - 1 && b.x < a.right - 1 && a.y < b.bottom - 1 && b.y < a.bottom - 1) overlaps += 1;
      }
    }
    const rect = selector => {
      const node = document.querySelector(selector);
      if (!node) return null;
      const box = node.getBoundingClientRect();
      return { x: box.x, y: box.y, width: box.width, height: box.height, bottom: box.bottom, right: box.right };
    };
    const style = selector => {
      const node = document.querySelector(selector);
      return node ? { whiteSpace: getComputedStyle(node).whiteSpace, flexWrap: getComputedStyle(node).flexWrap } : null;
    };
    return {
      label,
      width,
      pageOverflow: document.documentElement.scrollWidth > window.innerWidth + 1,
      panelOverflow: panel.scrollWidth > panel.clientWidth + 1,
      bodyOverflow: document.body.scrollWidth > window.innerWidth + 1,
      clipped,
      overlaps,
      cardCount: cards.length,
      smallestCard: cards.length ? Math.round(Math.min(...cards.map(c => c.w))) : 0,
      title: document.querySelector('.game-panel-title h2').textContent,
      headerActions: rect('#aidixitHeaderActions'),
      headerActionsVisible: getComputedStyle(document.getElementById('aidixitHeaderActions')).display !== 'none',
      help: rect('#aidixitHelpBtn'),
      explain: rect('#aidixitExplainBtn'),
      reconnect: rect('#gameReconnectBtn'),
      reconnectStyle: style('#gameReconnectBtn'),
      helpStyle: style('#aidixitHelpBtn'),
      explainStyle: style('#aidixitExplainBtn'),
      prompt: rect('#aidixitPromptBox'),
      scores: rect('#aidixitPlayers'),
      hand: rect('#aidixitHand'),
      meta: rect('.aidixit-meta'),
      handBottom: rect('#aidixitHand') ? rect('#aidixitHand').bottom : 0,
      poolTop: rect('#aidixitPool') ? rect('#aidixitPool').y : 0,
    };
  }, { width, label });
}

(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 950 } });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => {
    // The Google Fonts request is aborted on purpose to keep the run offline.
    if (message.type() === 'error' && !/Failed to load resource/.test(message.text())) {
      errors.push(`console: ${message.text()}`);
    }
  });
  fs.mkdirSync(output, { recursive: true });

  try {
    await page.route('https://fonts.googleapis.com/**', route => route.abort());
    await page.goto(base);
    await page.waitForFunction(() => typeof socket !== 'undefined' && socket.connected && cachedGameList);
    await page.evaluate(() => socket.emit('room:create', { name: 'AI Dixit UI QA', game_type: 'aidixit', config: {} }));
    await page.waitForFunction(() => roomSessionReady && currentGameType === 'aidixit');
    await page.waitForFunction(() => isGameAssetsLoaded('aidixit'));
    await page.evaluate(() => setRoomControlsCollapsed(false));

    for (let i = 0; i < 2; i += 1) {
      await page.evaluate(() => socket.emit('room:add_bot', { room_id: roomId }));
      await page.waitForFunction(count => currentRoomState.players.length === count, 2 + i);
    }
    await page.evaluate(() => socket.emit('room:ready', { room_id: roomId, ready: true }));
    await page.waitForFunction(() => !document.getElementById('startBtn').disabled);
    await page.locator('#startBtn').click();
    await page.waitForFunction(() => lastGameStatePayload?.game_type === 'aidixit' && lastGameStatePayload.view?.hand?.length);
    await page.locator('#aidixitPanel').waitFor({ state: 'visible' });

    // --- Header, Help and Explain -------------------------------------
    assert.equal(await page.locator('#aidixitHeaderActions').isVisible(), true, 'header actions hidden');
    assert.equal(await page.locator('.game-panel-title h2').textContent(), '🖼️ AI 画物语');
    await page.locator('#aidixitHelpBtn').click();
    await page.locator('dialog.obg-help-dialog[open]').waitFor();
    const tabCount = await page.locator('dialog.obg-help-dialog .obg-help-tab').count();
    assert(tabCount >= 4, `Help needs section tabs, saw ${tabCount}`);
    await page.screenshot({ path: `${output}/help-1440px.png` });
    await page.keyboard.press('Escape');
    assert.equal(await page.locator('dialog.obg-help-dialog').evaluate(node => node.open), false, 'Esc did not close Help');

    await page.locator('#aidixitExplainBtn').click();
    assert.equal(await page.locator('#aidixitExplainBtn').getAttribute('aria-pressed'), 'true');
    const explained = await page.locator('#aidixitPanel .obg-has-explanation').count();
    assert(explained > 5, `Explain mode highlighted only ${explained} nodes`);
    await page.screenshot({ path: `${output}/explain-1440px.png` });
    await page.locator('#aidixitPromptBox').click();
    await page.locator('dialog.obg-explain-dialog[open]').waitFor();
    assert.equal(await page.locator('#aidixitExplainBtn').getAttribute('aria-pressed'), 'false', 'Explain did not auto exit');
    await page.keyboard.press('Escape');

    // --- In-place confirmation ----------------------------------------
    const mockStory = await page.evaluate(() => {
      const mock = JSON.parse(JSON.stringify(lastGameStatePayload));
      mock.view.phase = 'story';
      mock.view.clue = null;
      mock.view.game_over = false;
      mock.view.storyteller_id = mock.view.you;
      mock.view.storyteller_name = mock.view.players[0].name;
      mock.view.submitted = false;
      mock.view.voted = false;
      mock.events = [];
      renderAidixitGameState(mock);
      return mock.view.you;
    });
    assert.ok(mockStory);
    assert.equal(await page.locator('#aidixitComposer').isVisible(), true, 'clue composer hidden for storyteller');
    await page.locator('#aidixitHand .aidixit-card').first().click();
    const overlay = page.locator('#aidixitHand .aidixit-card-overlay');
    assert.equal(await overlay.count(), 1, 'no in-place confirmation overlay');
    assert.equal(await overlay.locator('.is-primary').isDisabled(), true, 'confirm enabled without a clue');
    assert.equal(await overlay.locator('.aidixit-overlay-hint').isVisible(), true, 'missing clue hint');
    await page.locator('#aidixitClueInput').fill('a lonely lighthouse');
    assert.equal(await overlay.locator('.is-primary').isDisabled(), false, 'confirm still disabled after typing');
    await page.screenshot({ path: `${output}/confirm-story-1440px.png` });
    await overlay.locator('.is-ghost').click();
    assert.equal(await page.locator('#aidixitHand .aidixit-card-overlay').count(), 0, 'Cancel left the overlay');

    // Deselect by tapping empty space instead of a Clear Selection button.
    await page.locator('#aidixitHand .aidixit-card').first().click();
    assert.equal(await page.locator('.aidixit-card-overlay').count(), 1);
    await page.locator('#aidixitRoot').click({ position: { x: 3, y: 3 } });
    assert.equal(await page.locator('.aidixit-card-overlay').count(), 0, 'empty space did not clear the selection');
    await page.locator('#aidixitHand .aidixit-card').first().click();
    await page.keyboard.press('Escape');
    assert.equal(await page.locator('.aidixit-card-overlay').count(), 0, 'Esc did not clear the selection');

    // The confirmation shade must stay usable on the narrowest phones.
    for (const [width, height] of [[320, 844], [390, 844]]) {
      await page.setViewportSize({ width, height });
      await settle(page);
      await page.locator('#aidixitHand .aidixit-card').first().click();
      const shade = page.locator('#aidixitHand .aidixit-card-overlay');
      const box = await shade.evaluate(node => {
        const card = node.closest('.aidixit-card').getBoundingClientRect();
        const shadeBox = node.getBoundingClientRect();
        const buttons = Array.from(node.querySelectorAll('button')).map(button => {
          const b = button.getBoundingClientRect();
          return { text: button.textContent, w: Math.round(b.width), h: Math.round(b.height), fits: b.right <= shadeBox.right + 1 && b.bottom <= shadeBox.bottom + 1 };
        });
        return {
          cardWidth: Math.round(card.width),
          shadeFits: shadeBox.right <= card.right + 1 && shadeBox.bottom <= card.bottom + 1,
          shadeScroll: node.scrollHeight > node.clientHeight + 1,
          buttons,
        };
      });
      assert.equal(box.shadeFits, true, `confirmation shade spills outside the card at ${width}px`);
      assert.equal(box.shadeScroll, false, `confirmation shade content overflows at ${width}px`);
      box.buttons.forEach(button => {
        assert(button.w >= 60 && button.h >= 28, `${button.text} touch target is ${button.w}x${button.h} at ${width}px`);
        assert.equal(button.fits, true, `${button.text} escapes the shade at ${width}px`);
      });
      await page.screenshot({ path: `${output}/confirm-story-${width}px.png` });
      await page.locator('#aidixitRoot').click({ position: { x: 3, y: 3 } });
      await page.setViewportSize({ width: 1440, height: 950 });
      await settle(page);
    }

    // --- Zoom ----------------------------------------------------------
    await page.locator('#aidixitHand .aidixit-zoom-btn').first().click();
    assert.equal(await page.locator('#aidixitZoomModal').isVisible(), true, 'zoom modal did not open');
    await page.keyboard.press('Escape');
    assert.equal(await page.locator('#aidixitZoomModal').isVisible(), false, 'Esc did not close the zoom modal');

    // --- Every phase at every width -----------------------------------
    const phases = await page.evaluate(() => {
      const base = JSON.parse(JSON.stringify(lastGameStatePayload));
      const players = base.view.players;
      const hand = base.view.hand;
      const guesser = players[1].player_id;
      const build = patch => {
        const mock = JSON.parse(JSON.stringify(base));
        Object.assign(mock.view, patch);
        mock.events = [];
        return mock;
      };
      const pool = hand.slice(0, 4).map(card => ({ card_id: card.card_id, image_url: card.image_url }));
      const votesByCard = {};
      votesByCard[pool[1].card_id] = [
        { player_id: players[2].player_id, name: players[2].name, color: players[2].color },
      ];
      votesByCard[pool[2].card_id] = [
        { player_id: players[3] ? players[3].player_id : players[0].player_id, name: players[3] ? players[3].name : players[0].name, color: players[3] ? players[3].color : players[0].color },
      ];
      return {
        story: build({ phase: 'story', clue: null, game_over: false, last_result: null }),
        submit: build({
          phase: 'submit',
          clue: 'a lonely lighthouse',
          storyteller_id: players[2].player_id,
          storyteller_name: players[2].name,
          submitted: false,
          game_over: false,
        }),
        vote: build({
          phase: 'vote',
          clue: 'a lonely lighthouse',
          storyteller_id: guesser,
          storyteller_name: players[1].name,
          pool_cards: pool,
          your_submission: pool[0].card_id,
          votes_by_card: votesByCard,
          voted: false,
          game_over: false,
        }),
        result: build({
          phase: 'story',
          round: 2,
          clue: null,
          storyteller_id: guesser,
          storyteller_name: players[1].name,
          game_over: false,
          last_result: {
            case: 'partial',
            storyteller_id: players[2].player_id,
            story_card: pool[1].card_id,
            clue: 'a lonely lighthouse',
            correct_voters: [players[0].player_id],
            vote_counts: { [pool[1].card_id]: 1, [pool[2].card_id]: 1, [pool[3].card_id]: 0, [pool[0].card_id]: 0 },
            scores_delta: {
              [players[0].player_id]: 3,
              [players[1].player_id]: 0,
              [players[2].player_id]: 3,
            },
            pool_cards: pool.map(card => card.card_id),
            votes_by_card: votesByCard,
          },
        }),
        gameover: build({
          phase: 'game_over',
          game_over: true,
          winner: [players[0].player_id],
          clue: null,
        }),
      };
    });

    const reports = [];
    for (const [name, payload] of Object.entries(phases)) {
      await page.evaluate(data => renderAidixitGameState(data), payload);
      for (const [width, height] of WIDTHS) {
        await page.setViewportSize({ width, height });
        await settle(page);
        const report = await auditLayout(page, width, name);
        reports.push(report);
        assert.equal(report.pageOverflow, false, `${name}: page overflows horizontally at ${width}px`);
        assert.equal(report.bodyOverflow, false, `${name}: body overflows horizontally at ${width}px`);
        assert.equal(report.panelOverflow, false, `${name}: panel overflows horizontally at ${width}px`);
        assert.deepEqual(report.clipped, [], `${name}: content clipped at ${width}px`);
        assert.equal(report.overlaps, 0, `${name}: ${report.overlaps} cards overlap at ${width}px`);
        assert.equal(report.headerActionsVisible, true, `${name}: header actions hidden at ${width}px`);
        assert.equal(report.reconnectStyle.whiteSpace, 'nowrap', `${name}: Reconnect wraps at ${width}px`);
        assert.equal(report.helpStyle.whiteSpace, 'nowrap', `${name}: Help wraps at ${width}px`);
        assert.equal(report.explainStyle.whiteSpace, 'nowrap', `${name}: Explain wraps at ${width}px`);
        const helpMid = report.help.y + report.help.height / 2;
        const reconnectMid = report.reconnect.y + report.reconnect.height / 2;
        assert(Math.abs(helpMid - reconnectMid) <= 4, `${name}: Help left the title row at ${width}px`);
        assert(report.smallestCard === 0 || report.smallestCard >= 88, `${name}: card only ${report.smallestCard}px wide at ${width}px`);
        assert.equal(report.title, '🖼️ AI 画物语', `${name}: panel title lost at ${width}px`);
        await page.screenshot({ path: `${output}/${name}-${width}px.png`, fullPage: true });
      }
    }

    // Phone screens should keep the hand and the scoreboard together.
    const vote320 = reports.find(item => item.label === 'vote' && item.width === 320);
    assert(vote320.scores.bottom <= vote320.prompt.bottom + 260, 'scoreboard drifted far from the prompt at 320px');

    // While voting the pool is the subject, so it must sit above the hand.
    for (const width of WIDTHS.map(item => item[0])) {
      const report = reports.find(item => item.label === 'vote' && item.width === width);
      assert(report.poolTop < report.hand.y, `pool is not above the hand during voting at ${width}px`);
    }

    fs.writeFileSync(`${output}/report.json`, JSON.stringify(reports, null, 2));
    assert.deepEqual(errors, [], `page errors: ${errors.join(' | ')}`);
    console.log(`AI Dixit UI passed: ${reports.length} width/phase combinations, screenshots in ${output}/`);
  } finally {
    await browser.close();
  }
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
