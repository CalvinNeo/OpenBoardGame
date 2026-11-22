const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const base = process.env.ROOM_TEST_URL || 'http://127.0.0.1:8766';
const output = 'tmp/word-decode-ui';
fs.mkdirSync(output, { recursive: true });

function fixture(phase = 'guess', round = 1) {
  const players = ['p1', 'p2', 'p3'].map((player_id, seat) => ({
    player_id, seat, name: `Player ${seat + 1}`, score: 0, is_bot: false,
    submitted_hints: phase !== 'hint', submitted_guesses: false,
  }));
  return {
    game_id: 'word_decode', you: 'p1', round, phase, players,
    hints: phase === 'hint' ? null : { p1: ['中', '文'], p2: ['天', '果'], p3: ['花', '林'] },
    your_hidden_word: '字', config: { guess_time_limit_sec: 0 },
    legal_actions: phase === 'hint' ? ['submit_hints'] : ['submit_guesses'],
  };
}

async function render(page, view, reset = false) {
  await page.evaluate(({ view, reset }) => {
    if (reset) clearWordDecodeState();
    window.wordDecodeTestView = view;
    renderWordDecodeGameState({ view });
  }, { view, reset });
}

async function checkBounds(page, label) {
  const result = await page.evaluate(() => {
    const issues = [];
    for (const node of document.querySelectorAll('#wordDecodePanel, #wordDecodePanel *')) {
      const bounds = node.getBoundingClientRect();
      if (!node.getClientRects().length || !bounds.width || !bounds.height) continue;
      if (bounds.left < -1 || bounds.right > innerWidth + 1) issues.push(node.id || node.className);
    }
    for (const row of document.querySelectorAll('.word-decode-hint-row, .word-decode-guess-row')) {
      const children = [...row.children];
      for (let first = 0; first < children.length; first += 1) {
        for (let second = first + 1; second < children.length; second += 1) {
          const left = children[first].getBoundingClientRect();
          const right = children[second].getBoundingClientRect();
          if (Math.min(left.right, right.right) - Math.max(left.left, right.left) > 1
              && Math.min(left.bottom, right.bottom) - Math.max(left.top, right.top) > 1) {
            issues.push(`overlap: ${row.className}`);
          }
        }
      }
    }
    return { issues, overflow: document.documentElement.scrollWidth > innerWidth + 1 };
  });
  assert.deepEqual(result, { issues: [], overflow: false }, label);
}

async function startComposition(page, selector, value) {
  await page.locator(selector).focus();
  await page.locator(selector).evaluate((input, value) => {
    window.wordDecodeTestInput = input;
    input.dispatchEvent(new CompositionEvent('compositionstart', { bubbles: true }));
    input.value = value;
    input.dispatchEvent(new InputEvent('input', {
      bubbles: true, data: value, inputType: 'insertCompositionText', isComposing: true,
    }));
  }, value);
}

async function endComposition(page, selector, value) {
  await page.locator(selector).evaluate((input, value) => {
    input.value = value;
    input.dispatchEvent(new CompositionEvent('compositionend', { bubbles: true, data: value }));
  }, value);
}

async function testInput(page, selector, value, baseGuess) {
  await render(page, fixture(), true);
  await page.locator('#wordDecodeBaseGuess').fill(baseGuess);
  await startComposition(page, selector, 'shui');
  await page.evaluate(() => { window.wordDecodeTestActions = []; });
  assert.equal(await page.locator('#wordDecodeSubmitGuessesBtn').isDisabled(), true);
  await page.evaluate(() => {
    const view = structuredClone(window.wordDecodeTestView);
    view.players[2].submitted_guesses = true;
    renderWordDecodeGameState({ view });
    document.getElementById('wordDecodeSubmitGuessesBtn').dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });
  await page.waitForTimeout(650);
  assert.deepEqual(await page.evaluate(() => ({
    connected: window.wordDecodeTestInput.isConnected,
    focused: document.activeElement === window.wordDecodeTestInput,
    value: window.wordDecodeTestInput.value,
    actions: window.wordDecodeTestActions,
  })), { connected: true, focused: true, value: 'shui', actions: [] });
  await endComposition(page, selector, value);
  assert.equal(await page.locator('#wordDecodeSubmitGuessesBtn').isEnabled(), true);
  await page.waitForFunction(() => window.wordDecodeTestActions.some(action => action.type === 'update_guess_draft'));
  assert.deepEqual(await page.locator(selector).evaluate(input => ({
    same: input === window.wordDecodeTestInput, focused: document.activeElement === input,
    value: input.value, caret: input.selectionStart,
  })), { same: true, focused: true, value, caret: value.length });
  await page.locator('#wordDecodeSubmitGuessesBtn').click();
  const actions = await page.evaluate(() => window.wordDecodeTestActions);
  const expected = {
    base_guess: selector === '#wordDecodeBaseGuess' ? value : baseGuess,
    hidden_guesses: [{ target_player_id: 'p2', guess: selector === '#wordDecodeBaseGuess' ? '' : value },
      { target_player_id: 'p3', guess: '' }],
  };
  assert.deepEqual(actions, [
    { type: 'update_guess_draft', ...expected },
    { type: 'submit_guesses', ...expected },
  ]);
}

(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const errors = [];
  try {
    for (const width of [320, 390, 1024, 1440]) {
      const context = await browser.newContext({
        viewport: { width, height: width < 600 ? 844 : 1000 },
        isMobile: width < 600, hasTouch: width < 600,
      });
      const page = await context.newPage();
      page.on('pageerror', error => errors.push(error.message));
      await page.route('https://fonts.googleapis.com/**', route => route.abort());
      await page.goto(base);
      await page.waitForFunction(() => typeof socket !== 'undefined' && socket.connected && cachedGameList);
      await page.evaluate(async view => {
        await ensureGameAssets('word_decode');
        roomId = 'word-decode-ime-fixture';
        playerId = view.you;
        roomSessionReady = true;
        renderRoomState({
          room_id: roomId, game_type: 'word_decode', status: 'in_game', players: view.players,
          min_players: 3, max_players: 6, player_counts: [3, 4, 5, 6], game_config: view.config,
        });
        setGamePanelVisibility('word_decode');
        setRoomControlsCollapsed(true);
        window.wordDecodeTestActions = [];
        window.sendAction = action => {
          window.wordDecodeTestActions.push(action);
          if (action.type === 'update_guess_draft') renderWordDecodeGameState({ view: window.wordDecodeTestView });
        };
      }, fixture());

      for (const phase of ['hint', 'guess']) {
        await render(page, fixture(phase), true);
        await checkBounds(page, `${width}px ${phase}`);
        await page.screenshot({ path: `${output}/${phase}-${width}.png`, fullPage: true });
      }

      await testInput(page, '#wordDecodeGuessList input[data-target="p2"]', '水', '木');
      await testInput(page, '#wordDecodeBaseGuess', '水', '');

      await render(page, fixture(), true);
      const guessInput = page.locator('#wordDecodeGuessList input[data-target="p2"]');
      await guessInput.fill('春风');
      await guessInput.evaluate(input => {
        input.focus();
        input.setSelectionRange(1, 1);
        window.wordDecodeTestInput = input;
        renderWordDecodeGameState({ view: window.wordDecodeTestView });
      });
      await page.waitForFunction(() => window.wordDecodeTestActions.at(-1).type === 'update_guess_draft');
      assert.deepEqual(await guessInput.evaluate(input => ({
        same: input === window.wordDecodeTestInput, focused: input === document.activeElement,
        caret: input.selectionStart, value: input.value,
      })), { same: true, focused: true, caret: 1, value: '春风' });

      for (const selector of ['#wordDecodeHint1', '#wordDecodeHint2']) {
        await render(page, fixture('hint'), true);
        await page.locator('#wordDecodeHint1').fill('中');
        await page.locator('#wordDecodeHint2').fill('文');
        await startComposition(page, selector, 'shui');
        await render(page, fixture('hint'));
        assert.equal(await page.locator(selector).inputValue(), 'shui');
        assert.equal(await page.locator('#wordDecodeSubmitHintsBtn').isDisabled(), true);
        await endComposition(page, selector, '水');
        assert.equal(await page.locator('#wordDecodeSubmitHintsBtn').isEnabled(), true);
        await page.evaluate(() => { window.wordDecodeTestActions = []; });
        await page.locator('#wordDecodeSubmitHintsBtn').click();
        assert.deepEqual(await page.evaluate(() => window.wordDecodeTestActions), [{
          type: 'submit_hints', hints: selector === '#wordDecodeHint1' ? ['水', '文'] : ['中', '水'],
        }]);
      }

      await startComposition(page, '#wordDecodeHint2', 'shui');
      await render(page, fixture('guess'));
      assert.equal(await page.locator('#wordDecodeSubmitGuessesBtn').isEnabled(), true);
      await startComposition(page, '#wordDecodeBaseGuess', 'shui');
      await render(page, fixture('hint', 2));
      assert.equal(await page.locator('#wordDecodeHint1').inputValue(), '');
      assert.equal(await page.locator('#wordDecodeHint2').inputValue(), '');
      assert.equal(await page.evaluate(() => wordDecodeComposingInputs.size), 0);
      await render(page, fixture('guess', 2));
      await page.evaluate(() => { window.wordDecodeTestActions = []; });
      await page.locator('#wordDecodeSubmitGuessesBtn').click();
      assert.equal(await page.evaluate(() => window.wordDecodeTestActions[0].base_guess), '');

      await page.locator('#wordDecodeHelpBtn').click();
      await page.locator('#wordDecodeHelpModal').waitFor({ state: 'visible' });
      await page.keyboard.press('Escape');
      if (await page.locator('#wordDecodeHelpModal').isVisible()) {
        console.log(`${width}px: existing Help Escape issue; Close button used instead`);
        await page.locator('#wordDecodeHelpModalCloseBtn').click();
      }
      await page.locator('#wordDecodeExplainBtn').click();
      await page.locator('#wordDecodeSubmitGuessesBtn').click();
      await page.locator('#wordDecodeExplainModal').waitFor({ state: 'visible' });
      await page.keyboard.press('Escape');
      if (await page.locator('#wordDecodeExplainModal').isVisible()) {
        console.log(`${width}px: existing Explain Escape issue; Close button used instead`);
        await page.locator('#wordDecodeExplainModalCloseBtn').click();
      }
      await page.locator('#wordDecodeExplainBtn').click();
      await page.keyboard.press('Escape');
      assert.equal(await page.evaluate(() => wordDecodeExplainMode), false);
      await checkBounds(page, `${width}px after interactions`);
      console.log(`${width}px: composition, draft echo, focus/caret, submissions, reset passed; Help/Explain Close works`);
      await context.close();
    }
    assert.deepEqual(errors, []);
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
