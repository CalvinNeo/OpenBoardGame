const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const base = process.env.ROOM_TEST_URL || 'http://127.0.0.1:8766';
const output = 'tmp/take_time_campaign_qa';
fs.mkdirSync(output, { recursive: true });

async function checkLayout(page, label) {
  const bounds = await page.evaluate(() => {
    const reconnect = document.getElementById('gameReconnectBtn').getBoundingClientRect();
    const levels = document.getElementById('takeTimeClocksBtn').getBoundingClientRect();
    const help = document.getElementById('takeTimeHelpBtn').getBoundingClientRect();
    return { fits: document.documentElement.scrollWidth <= innerWidth, right: levels.left >= reconnect.right, sameRow: levels.top < reconnect.bottom && reconnect.top < levels.bottom && help.top < reconnect.bottom && reconnect.top < help.bottom };
  });
  assert.deepEqual(bounds, { fits: true, right: true, sameRow: true }, label);
  const overflow = await page.locator('#takeTimePanel').evaluate(panel => [...panel.querySelectorAll('*')].filter(element => {
    if (!element.checkVisibility() || !element.clientWidth) return false;
    return element.scrollWidth > element.clientWidth + 2 && !/auto|scroll/.test(getComputedStyle(element).overflowX);
  }).map(element => element.className || element.tagName));
  assert.deepEqual(overflow, [], `${label}: content overflow`);
}

async function checkHelpLayout(page, label) {
  const issues = await page.locator('[data-obg-help-game="take_time"]').evaluate(dialog => {
    const rect = dialog.getBoundingClientRect();
    const problems = [];
    if (rect.left < 0 || rect.right > innerWidth || rect.top < 0 || rect.bottom > innerHeight) problems.push('dialog bounds');
    if (document.documentElement.scrollWidth > innerWidth) problems.push('page overflow');
    for (const element of dialog.querySelectorAll('*')) {
      if (element.checkVisibility() && element.clientWidth && element.scrollWidth > element.clientWidth + 2 && !/auto|scroll/.test(getComputedStyle(element).overflowX) && getComputedStyle(element).textOverflow !== 'ellipsis') {
        problems.push(element.className || element.tagName);
      }
    }
    const tabs = [...dialog.querySelectorAll('[role="tab"]')].map(tab => tab.getBoundingClientRect());
    tabs.forEach((rect, index) => {
      if (tabs.slice(index + 1).some(other => rect.left < other.right && other.left < rect.right && rect.top < other.bottom && other.top < rect.bottom)) problems.push('overlapping tabs');
    });
    return problems;
  });
  assert.deepEqual(issues, [], label);
}

async function checkLevelHelpCatalog(page, other) {
  const help = page.locator('[data-obg-help-game="take_time"]');
  const body = help.locator('.obg-help-body');
  const expected = {
    awakening_1: [/no sum cap/, /exactly one solar/, /exactly 3 cards/],
    official_1_2: [/8 to 12, inclusive/, /exactly 3 cards/],
    official_1_3: [/Placement 1 must go to segment 3/, /Placement 2 must go to segment 2/, /20 to 30/],
    official_1_4: [/closest to 9/, /Ties are allowed/, /exactly one lunar/],
    official_2_1: [/No card may have value 1, 2, 3/, /individual card values, not the sum/],
    official_2_4: [/No face-up cards/, /even with retry bonuses/],
    official_3_2: [/Split the 2 lowest cards/, /actual final card must go to segment 4/],
    official_3_4: [/lowest solar card/, /highest lunar card/, /closest to 6/],
    official_4_1: [/Highest first/, /your own current hand/, /Placement 1 must go to segment 2/],
    official_4_2: [/Lowest first/, /highest-valued card on the entire clock/],
    official_4_3: [/Leftmost first/, /fixed dealt hand order/],
    official_5_4: [/one solar.*one lunar/, /Placement 2 must go to segment 5/, /Placement 3 must go to segment 2/],
    official_6_4: [/Order their differences/, /still use sums/, /closest to 14/],
    official_7_1: [/immediately draws one replacement/, /No card may have value 7, 8, 9/],
    official_7_2: [/actual final card must go to segment 4/, /need not be card 12/],
    official_7_3: [/lowest solar card/, /highest lunar card/, /draw one replacement/],
    official_8_1: [/rules, not the placed cards/, /Direct placement is blocked/, /16 to 20/],
    official_8_4: [/printed hand rotates with the clock/, /counterclockwise/],
    official_9_1: [/must equal segment 3's sum/],
    official_9_2: [/absolute difference from segment 6's sum.*at least 2/],
    official_9_3: [/Split the 2 lowest cards/, /must equal segment 1's sum/, /must equal segment 4's sum/],
    official_9_4: [/largest of all six sums.*must not exceed 4/],
    official_10_1: [/first-card hand in segment 6/, /independent of the sum hand/],
    official_10_3: [/first-card hand in segment 4/, /actual final card must go to segment 5/],
    official_10_4: [/first-card hand in segment 2/, /currently blocks segments 3 and 6/],
    open_sky: [/no additional segment conditions/],
    first_and_last: [/Placement 12 must go to segment 6/],
    silent_night: [/No face-up cards/],
    differences: [/Order their differences/, /exactly 2 cards/]
  };
  await page.locator('#takeTimeHelpBtn').click();
  await help.locator('[data-obg-help-tab="current_level"]').click();
  const catalog = await page.evaluate(() => lastGameStatePayload.view.catalog);
  for (const clock of catalog) {
    await other.evaluate(clockId => sendAction({ type: 'select_clock', clock_id: clockId }), clock.id);
    await page.waitForFunction(clockId => lastGameStatePayload.view.clock.id === clockId, clock.id);
    for (const language of ['zh', 'en']) {
      await help.locator(`[data-obg-help-lang="${language}"]`).click();
      assert.equal(await body.locator('h3').first().innerText(), clock.name);
      const content = await body.innerText();
      if (language === 'en') {
        assert.doesNotMatch(content.slice(clock.name.length), /[\u3400-\u9fff]/, `${clock.id}: untranslated rule`);
        for (const pattern of expected[clock.id] || []) assert.match(content, pattern, clock.id);
      } else {
        assert.match(content, /本关整体规则/);
        assert.match(content, /各时段特殊规则/);
      }
      for (const width of [320, 390, 1024, 1440]) {
        await page.setViewportSize({ width, height: width < 400 ? 844 : 1000 });
        await checkHelpLayout(page, `${clock.id} Help ${language} ${width}`);
        if (['official_5_4', 'official_8_4', 'official_10_4'].includes(clock.id) && [320, 1440].includes(width)) {
          await page.screenshot({ path: `${output}/help-${clock.id}-${language}-${width}.png` });
        }
      }
    }
  }
  await page.keyboard.press('Escape');
  assert.equal(await help.evaluate(dialog => dialog.open), false);
  console.log(`Checked ${catalog.length * 8} bilingual current-level Help layouts`);
}

(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const errors = [];
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(base);
    await page.waitForFunction(() => typeof socket !== 'undefined' && socket.connected);
    await page.evaluate(() => socket.emit('room:create', { name: 'Alice', game_type: 'take_time' }));
    await page.waitForFunction(() => roomSessionReady && currentGameType === 'take_time' && isGameAssetsLoaded('take_time'));
    const room = await page.evaluate(() => roomId);
    const otherContext = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
    const other = await otherContext.newPage();
    other.on('pageerror', error => errors.push(error.message));
    await other.goto(base);
    await other.waitForFunction(() => typeof socket !== 'undefined' && socket.connected);
    await other.evaluate(room => socket.emit('room:join', { room_id: room, name: 'Bob' }), room);
    await other.waitForFunction(() => roomSessionReady && currentGameType === 'take_time' && isGameAssetsLoaded('take_time'));
    for (const participant of [page, other]) await participant.evaluate(() => socket.emit('room:ready', { ready: true }));
    await page.waitForFunction(() => !document.getElementById('startBtn').disabled);
    await page.evaluate(() => socket.emit('room:start', {}));
    await page.waitForFunction(() => lastGameStatePayload?.view.phase === 'setup');
    assert.equal(await page.locator('#takeTimePanel [data-tt-clock]').count(), 51);
    await page.locator('#takeTimeHelpBtn').click();
    await page.locator('[data-obg-help-lang="en"]').click();
    await page.locator('[data-obg-help-tab="current_level"]').click();
    assert.match(await page.locator('.obg-help-body').innerText(), /Choose a clock in Levels first/);
    await page.keyboard.press('Escape');
    for (const width of [320, 390, 1024, 1440]) {
      await page.setViewportSize({ width, height: 1000 });
      await checkLayout(page, `setup ${width}`);
      await page.screenshot({ path: `${output}/setup-${width}.png`, fullPage: true });
    }
    await page.locator('[data-tt-clock="official_8_1"]').click();
    await page.waitForFunction(() => lastGameStatePayload.view.phase === 'discussion');
    await other.waitForFunction(() => lastGameStatePayload.view.clock.id === 'official_8_1');
    for (const width of [320, 390, 1024, 1440]) {
      await page.setViewportSize({ width, height: 1000 });
      await checkLayout(page, `discussion ${width}`);
      await page.locator('#takeTimeClocksBtn').click();
      assert.equal(await page.locator('#takeTimeDialog [data-tt-clock]').count(), 51);
      await checkLayout(page, `picker ${width}`);
      await page.screenshot({ path: `${output}/picker-${width}.png` });
      await page.keyboard.press('Escape');
      assert.equal(await page.locator('#takeTimeDialog').evaluate(dialog => dialog.open), false);
    }
    await page.locator('#takeTimeHelpBtn').click();
    await page.locator('[data-obg-help-game="take_time"] [data-obg-help-lang="en"]').click();
    await page.locator('[data-obg-help-tab="advanced"]').click();
    assert.match(await page.locator('.obg-help-body').innerText(), /Intrusion/);
    await page.keyboard.press('Escape');
    await page.locator('#takeTimeExplainBtn').click({ force: true });
    await page.locator('#takeTimeClocksBtn').click();
    await page.locator('.obg-explain-dialog[open]').waitFor();
    assert.equal(await page.locator('#takeTimeDialog').evaluate(dialog => dialog.open), false);
    await page.keyboard.press('Escape');
    await page.reload();
    await page.waitForFunction(() => roomSessionReady && lastGameStatePayload?.view.clock.id === 'official_8_1' && isGameAssetsLoaded('take_time'));
    await other.locator('#takeTimeClocksBtn').tap();
    await other.locator('#takeTimeDialog [data-tt-clock="official_10_4"]').tap();
    await page.waitForFunction(() => lastGameStatePayload.view.clock.id === 'official_10_4');
    for (const participant of [page, other]) await participant.locator('[data-tt-action="ready"]').click();
    await page.waitForFunction(() => lastGameStatePayload.view.phase === 'placement');
    await page.locator('#takeTimeClocksBtn').click();
    assert.equal(await page.locator('#takeTimeDialog [data-tt-clock]:not(:disabled)').count(), 0);
    await page.keyboard.press('Escape');
    await page.locator('#takeTimeHelpBtn').click();
    await page.locator('[data-obg-help-tab="current_level"]').click();
    await page.locator('.obg-help-content').evaluate(content => { content.scrollTop = 160; });
    const helpScroll = await page.locator('.obg-help-content').evaluate(content => content.scrollTop);
    const aliceId = await page.evaluate(() => playerId);
    for (let turn = 0; turn < 12; turn += 1) {
      const current = await page.evaluate(() => lastGameStatePayload.view.current_turn);
      const participant = !current || current === aliceId ? page : other;
      await participant.waitForFunction(() => lastGameStatePayload.view.legal_actions.includes('place'));
      const previous = await participant.evaluate(() => lastGameStatePayload.state_version);
      await participant.evaluate(() => {
        const view = lastGameStatePayload.view;
        sendAction({ type: 'place', card_id: view.legal_card_ids[0], segment: view.legal_segments[0], face_up: false });
      });
      await page.waitForFunction(previous => lastGameStatePayload.state_version > previous, previous);
      await other.waitForFunction(previous => lastGameStatePayload.state_version > previous, previous);
      const secondHand = await page.evaluate(() => lastGameStatePayload.view.second_hand);
      assert.match(await page.locator('.obg-help-body').innerText(), new RegExp(`currently blocks segments ${secondHand + 1} and ${(secondHand + 3) % 6 + 1}`));
      assert.equal(await page.locator('.obg-help-content').evaluate(content => content.scrollTop), helpScroll);
    }
    await page.keyboard.press('Escape');
    assert.equal(await page.evaluate(() => lastGameStatePayload.view.phase), 'round_end');
    await page.locator('#takeTimeClocksBtn').click();
    await page.locator('#takeTimeDialog [data-tt-clock="official_6_2"]').click();
    await other.waitForFunction(() => lastGameStatePayload.view.pending_clock === 'official_6_2');
    await page.locator('[data-tt-action="next"]').click();
    await other.waitForFunction(() => lastGameStatePayload.view.next_ready.length === 1);
    assert.equal(await other.evaluate(() => lastGameStatePayload.view.phase), 'round_end');
    await other.locator('[data-tt-action="next"]').tap();
    await page.waitForFunction(() => lastGameStatePayload.view.clock.id === 'official_6_2' && lastGameStatePayload.view.phase === 'discussion');
    await checkLevelHelpCatalog(page, other);
    if (process.env.TAKE_TIME_FIXTURES) {
      const fixtures = JSON.parse(fs.readFileSync(process.env.TAKE_TIME_FIXTURES));
      await page.evaluate(() => socket.disconnect());
      for (const width of [320, 390, 1024, 1440]) {
        await page.setViewportSize({ width, height: 1000 });
        for (const [name, view] of Object.entries(fixtures)) {
          await page.evaluate(({ name, view }) => renderTakeTimeGameState({ room_id: 'layout', state_version: name, view }), { name, view });
          await checkLayout(page, `${width} ${name}`);
        }
      }
      await page.locator('#takeTimeHelpBtn').click();
      await page.locator('[data-obg-help-tab="current_level"]').click();
      for (const phase of ['discussion', 'review']) {
        const view = fixtures[`official_8_1-${phase}`];
        await page.evaluate(view => renderTakeTimeGameState({ room_id: 'rotation-help', state_version: view.rotation, view }), view);
        const rotatingSegment = phase === 'discussion' ? 6 : 1;
        const blockedSegment = phase === 'discussion' ? 2 : 3;
        const rules = page.locator('[data-obg-help-section="current_level"] li');
        assert.match(await rules.filter({ has: page.locator('strong', { hasText: `Segment ${rotatingSegment}` }) }).innerText(), /rotate the printed rules one segment clockwise/);
        assert.match(await rules.filter({ has: page.locator('strong', { hasText: `Segment ${blockedSegment}` }) }).innerText(), /Direct placement is blocked/);
      }
      await page.keyboard.press('Escape');
      console.log(`Checked ${Object.keys(fixtures).length * 4} campaign layouts`);
    }
    await page.locator('#takeTimeHelpBtn').click();
    await page.evaluate(() => clearTakeTimeState());
    assert.equal(await page.locator('[data-obg-help-game="take_time"]').evaluate(dialog => dialog.open), false);
    await page.locator('#takeTimeHelpBtn').click();
    assert.match(await page.locator('.obg-help-body').innerText(), /Choose a clock in Levels first/);
    await page.keyboard.press('Escape');
    assert.deepEqual(errors, []);
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exit(1); });
