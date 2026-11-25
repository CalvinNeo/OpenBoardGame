const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { execFileSync } = require('node:child_process');
const base = process.env.ROOM_TEST_URL || 'http://127.0.0.1:8799';
const output = 'tmp/rummikub-ui';
fs.mkdirSync(output, { recursive: true });
const fixtures = JSON.parse(execFileSync(process.env.PYTHON || 'python3', ['-c', `
import copy, json
from game.rummikub import RummikubGame as Game, TILES
from tests.test_rummikub import fixture, players, tile, act
state = fixture([[tile('red', 10), tile('blue', 10), tile('orange', 10), tile('black', 13)], [tile('black', 1)]])
views = {'opening': Game.get_public_view(state, 'p0')}
old = [tile('blue', number) for number in range(1, 7)]
state = fixture([[tile('blue', 7), tile('red', 12), tile('orange', 12), tile('black', 12)], [tile('black', 1)]], [old], opened=True)
views['rearrange'] = Game.get_public_view(state, 'p0')
state['config']['joker_rule'] = 'free'
views['free'] = Game.get_public_view(state, 'p0')
state = fixture([[tile('red', 10), tile('blue', 10), tile('orange', 10)], ['joker_0', tile('black', 4)]], rounds=2)
act(state, 'commit', table=[state['players']['p0']['hand'][:]])
views['review'] = Game.get_public_view(state, 'p0')
act(state, 'next_round')
views['ready'] = Game.get_public_view(state, 'p0')
state['game_over'] = True
state['phase'] = 'game_over'
state['winner'] = ['p0']
views['finished'] = Game.get_public_view(state, 'p0')
state = Game.init_game({'seed': 5}, players(4))
state['table'] = [[tile(color, number) for number in range(1, 14)] for color in ('red', 'blue', 'orange', 'black')]
used = set(tile for meld in state['table'] for tile in meld)
state['players']['p0']['hand'] = [tile for tile in TILES if tile not in used]
state['players']['p0']['opened'] = True
for player in list(state['players'].values())[1:]: player['hand'] = []
state['pool'] = []
for meta in state['player_meta'].values(): meta['name'] = 'VeryLongUnbrokenPlayerNameForResponsiveAcceptance'
views['crowded'] = Game.get_public_view(state, 'p0')
views['spectator'] = Game.get_public_view(state, 'visitor')
print(json.dumps(views))
`], { encoding: 'utf8' }));

(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const errors = [];
  const contexts = [];
  async function pageAt(width = 390, mobile = false) {
    const context = await browser.newContext({ viewport: { width, height: 900 }, isMobile: mobile, hasTouch: mobile });
    contexts.push(context);
    const page = await context.newPage();
    page.on('pageerror', error => errors.push(error.message));
    await page.route('https://fonts.googleapis.com/**', route => route.abort());
    await page.goto(base);
    await page.waitForFunction(() => typeof socket !== 'undefined' && socket.connected && cachedGameList);
    return page;
  }
  async function load(page) {
    await page.evaluate(async () => {
      await ensureGameAssets('rummikub');
      currentGameType = 'rummikub';
      setGamePanelVisibility('rummikub');
      setRoomControlsCollapsed(true);
      window.rummikubTestActions = [];
      sendAction = action => {
        window.rummikubTestActions.push(action);
        if (action.type === 'preview' || action.type === 'reset') {
          const next = structuredClone(window.rummikubFixture);
          next.draft = action.type === 'preview' ? action.table : null;
          queueMicrotask(() => renderRummikubGameState({ room_id: window.rummikubFixtureRoom, game_type: 'rummikub', view: next }));
        }
      };
    });
  }
  async function show(page, key) {
    await page.evaluate(({ view, key }) => {
      window.rummikubFixture = view;
      window.rummikubFixtureRoom = key;
      renderRummikubGameState({ room_id: key, game_type: 'rummikub', view });
      window.rummikubTestActions.length = 0;
    }, { view: fixtures[key], key });
  }
  async function noOverflow(page, label) {
    const faults = await page.evaluate(() => {
      const problems = [];
      if (document.documentElement.scrollWidth > innerWidth + 1) problems.push('page horizontal overflow');
      const panel = document.getElementById('rummikubPanel');
      const bounds = panel.getBoundingClientRect();
      for (const node of panel.querySelectorAll('button, .rummikub-player, .rummikub-meld, .rummikub-rack, .rummikub-table')) {
        if (!node.getClientRects().length) continue;
        const rect = node.getBoundingClientRect();
        if (rect.left < bounds.left - 1 || rect.right > bounds.right + 1) problems.push(node.className + ' outside panel');
        if (node.scrollWidth > node.clientWidth + 2 && !node.classList.contains('rummikub-tile')) problems.push(node.className + ' content overflow');
      }
      const help = document.getElementById('rummikubHelpBtn').getBoundingClientRect();
      const reconnect = document.getElementById('gameReconnectBtn').getBoundingClientRect();
      if (Math.abs(help.top - reconnect.top) > 8) problems.push('Help/Reconnect wrapped');
      const melds = document.getElementById('rummikubMelds');
      if (melds.scrollHeight > melds.clientHeight + 1) problems.push('table has internal scrolling');
      const area = document.getElementById('rummikubRackArea');
      if (area.classList.contains('is-docked')) {
        const dock = area.getBoundingClientRect();
        if (getComputedStyle(area).position !== 'fixed' || Math.abs(dock.bottom - innerHeight) > 1) problems.push('rack is not docked at viewport bottom');
        if (parseFloat(getComputedStyle(panel).paddingBottom) < dock.height) problems.push('dock has no reserved page space');
      }
      for (const button of panel.querySelectorAll('.rummikub-tools button, .rummikub-sort button, .rummikub-meld-meta button, #rummikubRackToggle')) {
        if (button.getClientRects().length && button.getBoundingClientRect().height > 26) problems.push('oversized control');
      }
      if (area.classList.contains('is-docked')) {
        const title = document.getElementById('rummikubRackTitle').getBoundingClientRect();
        const toggle = document.getElementById('rummikubRackToggle').getBoundingClientRect();
        if (Math.abs((title.top + title.height / 2) - (toggle.top + toggle.height / 2)) > 2) problems.push('rack caption wraps');
      }
      const tools = [...panel.querySelectorAll('.rummikub-tools button')].filter(button => button.getClientRects().length);
      if (tools.length && tools.some(button => Math.abs(button.getBoundingClientRect().top - tools[0].getBoundingClientRect().top) > 1)) problems.push('dock controls wrap');
      return problems;
    });
    assert.deepEqual(faults, [], label);
  }
  async function highlights(page, width) {
    async function update(view, room = 'highlight-fixture') {
      await page.evaluate(({ view, room }) => {
        window.rummikubFixture = view;
        window.rummikubFixtureRoom = room;
        renderRummikubGameState({ room_id: room, view });
      }, { view, room });
    }
    const initial = structuredClone(fixtures.rearrange);
    await update(initial);
    assert.equal(await page.locator('.rummikub-tile.is-drawn, .rummikub-tile.is-added, .rummikub-tile.is-changed').count(), 0);
    const drawn = structuredClone(initial);
    drawn.turn += 1;
    drawn.current_player = 'p1';
    drawn.legal_actions = [];
    drawn.players[0].hand.push('blue_7_1');
    drawn.players[0].count += 1;
    drawn.pool_count -= 1;
    await update(drawn);
    assert.equal(await page.locator('#rummikubRack .is-drawn').count(), 1);
    assert.equal(await page.locator('#rummikubRack .is-drawn').getAttribute('data-tile'), 'blue_7_1');
    assert.match(await page.locator('#rummikubRack .is-drawn').getAttribute('aria-label'), /Most recently drawn/);
    assert.equal(await page.locator('#rummikubRack [data-tile="blue_7_0"]').evaluate(node => node.classList.contains('is-drawn')), false);
    await page.locator('#rummikubSortNumber').click();
    await page.locator('#rummikubRackToggle').click();
    await update(drawn);
    await page.locator('#rummikubRackToggle').click();
    assert.equal(await page.locator('#rummikubRack .is-drawn').count(), 1);
    await noOverflow(page, `${width} drawn tile`);
    await page.screenshot({ path: `${output}/${width}-drawn.png`, fullPage: true });
    const trial = structuredClone(drawn);
    trial.draft = [trial.table[0].slice(0, 3), trial.table[0].slice(3), ['red_8_0', 'blue_8_0', 'black_8_0']];
    await update(trial);
    assert.equal(await page.locator('#rummikubMelds .is-added').count(), 3);
    assert.equal(await page.locator('#rummikubMelds .is-changed').count(), 6);
    assert.equal(await page.locator('#rummikubRack .is-drawn').count(), 1);
    assert.match(await page.locator('#rummikubMelds [data-tile="blue_4_0"]').getAttribute('title'), /was Meld 1, position 4; now Meld 2, position 1/);
    assert.match(await page.locator('#rummikubChanges').innerText(), /Gold: 3 added/);
    await noOverflow(page, `${width} changed table`);
    await page.screenshot({ path: `${output}/${width}-highlights.png`, fullPage: true });
    await page.locator('#rummikubExplainBtn').click();
    const changed = await page.locator('#rummikubMelds [data-tile="blue_4_0"]').boundingBox();
    await page.mouse.click(changed.x + changed.width / 2, changed.y + changed.height / 2);
    assert.match(await page.locator('.obg-explain-dialog[open]').innerText(), /was Meld 1|原为牌组 1/);
    await page.keyboard.press('Escape');
    const committed = structuredClone(trial);
    committed.table = committed.draft;
    committed.draft = null;
    committed.turn += 1;
    committed.current_player = 'p0';
    committed.legal_actions = initial.legal_actions;
    await update(committed);
    await update(committed);
    assert.equal(await page.locator('#rummikubMelds .is-changed').count(), 6);
    assert.equal(await page.locator('#rummikubMelds .is-added').count(), 3);
    await page.locator('#rummikubSortColor').click();
    await page.locator('#rummikubRack [data-tile="blue_7_1"]').click();
    assert.equal(await page.locator('#rummikubRack .is-drawn.is-selected').count(), 1);
    await page.locator('#rummikubNew').click();
    assert.equal(await page.locator('#rummikubRack .is-drawn').count(), 0);
    await page.locator('#rummikubUndo').click();
    assert.equal(await page.locator('#rummikubRack .is-drawn').count(), 1);
    await page.locator('#rummikubRack [data-tile="blue_7_1"]').click();
    await page.locator('#rummikubNew').click();
    await page.locator('#rummikubReset').click();
    assert.equal(await page.locator('#rummikubMelds .is-added').count(), 3);
    const extended = structuredClone(committed);
    extended.draft = [committed.table[0], [...committed.table[1], 'blue_7_0'], committed.table[2]];
    await update(extended);
    assert.equal(await page.locator('#rummikubMelds .is-added').count(), 1);
    assert.equal(await page.locator('#rummikubMelds .is-changed').count(), 0);
    await update(committed);
    assert.equal(await page.locator('#rummikubMelds .is-changed').count(), 6);
    const secondDraw = structuredClone(committed);
    secondDraw.turn += 1;
    secondDraw.players[0].hand.push('joker_1');
    secondDraw.players[0].count += 1;
    await update(secondDraw);
    assert.equal(await page.locator('#rummikubRack .is-drawn').getAttribute('data-tile'), 'joker_1');
    const spectator = structuredClone(secondDraw);
    spectator.you = 'visitor';
    spectator.players.forEach(player => { player.hand = null; });
    spectator.legal_actions = [];
    await update(spectator);
    assert.equal(await page.locator('.rummikub-tile.is-drawn, .rummikub-tile.is-changed, .rummikub-tile.is-added').count(), 0);
    await update(spectator, 'another-room');
    const spectatorTrial = structuredClone(spectator);
    spectatorTrial.draft = [...spectator.table, ['red_3_0', 'blue_3_1', 'black_3_0']];
    await update(spectatorTrial, 'another-room');
    assert.equal(await page.locator('#rummikubMelds .is-added').count(), 3);
    await update(secondDraw);
    assert.equal(await page.locator('#rummikubRack .is-drawn').count(), 0);
    const newRound = structuredClone(secondDraw);
    newRound.round += 1;
    newRound.players[0].hand.push('red_1_1');
    await update(newRound);
    assert.equal(await page.locator('.rummikub-tile.is-drawn, .rummikub-tile.is-changed, .rummikub-tile.is-added').count(), 0);
    const jokerTable = structuredClone(initial);
    jokerTable.table = [['blue_1_0', 'blue_2_0', 'joker_0']];
    await update(jokerTable, 'joker-highlights');
    const jokerTrial = structuredClone(jokerTable);
    jokerTrial.draft = [['blue_1_0', 'blue_2_0', 'blue_3_0', 'joker_0']];
    await update(jokerTrial, 'joker-highlights');
    assert.equal(await page.locator('#rummikubMelds .is-added').getAttribute('data-tile'), 'blue_3_0');
    assert.equal(await page.locator('#rummikubMelds .is-changed').getAttribute('data-tile'), 'joker_0');
    await update(jokerTable, 'joker-highlights');
    assert.equal(await page.locator('#rummikubChanges').isVisible(), false);
    const reordered = structuredClone(initial);
    reordered.table.push(['red_9_0', 'orange_9_0', 'black_9_0']);
    await update(reordered, 'reordered-highlights');
    reordered.draft = reordered.table.slice().reverse().map(meld => meld.slice().reverse());
    await update(reordered, 'reordered-highlights');
    assert.equal(await page.locator('#rummikubMelds .is-changed, #rummikubMelds .is-added').count(), 0);
    console.log(`PASS ${width}px: exact drawn tile, sorting/collapse persistence, remote trial/commit, split/extend/joker changes, undo/reset, spectator and room/round/viewer cleanup`);
  }
  try {
    for (const width of [320, 390, 1024, 1440]) {
      const page = await pageAt(width, width < 600);
      await load(page);
      for (const key of ['opening', 'rearrange', 'free', 'crowded', 'review', 'finished', 'spectator']) {
        await show(page, key);
        await noOverflow(page, `${width} ${key}`);
        await page.screenshot({ path: `${output}/${width}-${key}.png`, fullPage: true });
      }
      await highlights(page, width);
      await show(page, 'opening');
      assert.equal(await page.locator('#rummikubRackToggle').getAttribute('aria-expanded'), 'true');
      const openHeight = await page.locator('#rummikubRackArea').evaluate(node => node.getBoundingClientRect().height);
      await page.locator('#rummikubRack [data-tile="red_10_0"]').click();
      await page.locator('#rummikubRackToggle').click();
      assert.equal(await page.locator('#rummikubRackBody').isVisible(), false);
      assert.equal(await page.locator('#rummikubRackToggle').getAttribute('aria-expanded'), 'false');
      assert.equal(await page.locator('#rummikubRackArea').evaluate(node => node.getBoundingClientRect().height < 50), true);
      assert.equal(await page.evaluate(() => rummikubTestActions.length), 0);
      await page.evaluate(() => renderRummikubGameState({ room_id: rummikubFixtureRoom, view: rummikubFixture }));
      assert.equal(await page.locator('#rummikubRackToggle').getAttribute('aria-expanded'), 'false');
      await noOverflow(page, `${width} collapsed dock`);
      await page.screenshot({ path: `${output}/${width}-collapsed.png`, fullPage: true });
      await page.locator('#rummikubRackToggle').click();
      assert.equal(await page.locator('#rummikubRackBody').isVisible(), true);
      assert.equal(await page.locator('#rummikubRackArea').evaluate(node => node.getBoundingClientRect().height), openHeight);
      assert.equal(await page.locator('#rummikubRack [data-tile="red_10_0"]').getAttribute('aria-pressed'), 'true');
      await page.keyboard.press('Escape');
      await page.locator('#rummikubExplainBtn').click();
      await page.locator('#rummikubRackToggle').click();
      assert.equal(await page.locator('.obg-explain-dialog[open]').count(), 1);
      assert.equal(await page.locator('#rummikubRackToggle').getAttribute('aria-expanded'), 'true');
      await page.keyboard.press('Escape');
      await show(page, 'free');
      assert.match(await page.locator('#rummikubRule').innerText(), /Free/);
      await page.locator('#rummikubExplainBtn').click();
      await page.locator('#rummikubRule').click();
      assert.match(await page.locator('.obg-explain-dialog[open]').innerText(), /Free rearrangement|自由重排/);
      await page.keyboard.press('Escape');
      const compactTile = await page.locator('#rummikubMelds .rummikub-tile').first().boundingBox();
      const rackTile = await page.locator('#rummikubRack .rummikub-tile').first().boundingBox();
      assert(compactTile.width <= 32 && compactTile.height <= 44);
      assert(compactTile.width < rackTile.width && compactTile.height < rackTile.height);
      await show(page, 'opening');
      await page.locator('#rummikubHelpBtn').click();
      await page.locator('.obg-help-dialog[open] [data-obg-help-lang="en"]').click();
      assert.match(await page.locator('.obg-help-dialog[open]').innerText(), /Empty your rack/);
      await page.locator('.obg-help-dialog[open] [data-obg-help-tab="highlights"]').click();
      assert.match(await page.locator('.obg-help-dialog[open]').innerText(), /blue dashed borders/);
      await page.locator('.obg-help-dialog[open] [data-obg-help-lang="zh"]').click();
      assert.match(await page.locator('.obg-help-dialog[open]').innerText(), /蓝色虚线/);
      await page.keyboard.press('Escape');
      assert.equal(await page.locator('dialog[open]').count(), 0);
      await page.locator('#rummikubExplainBtn').click();
      await page.keyboard.press('Escape');
      assert.equal(await page.locator('#rummikubExplainBtn').getAttribute('aria-pressed'), 'false');
      await page.locator('#rummikubExplainBtn').click();
      const disabled = await page.locator('#rummikubCommit').boundingBox();
      await page.mouse.click(disabled.x + disabled.width / 2, disabled.y + disabled.height / 2);
      assert.equal(await page.locator('.obg-explain-dialog[open]').count(), 1);
      assert.equal(await page.evaluate(() => rummikubTestActions.length), 0);
      await page.keyboard.press('Escape');
      const selected = ['red_10_0', 'blue_10_0', 'orange_10_0'];
      for (const tile of selected) await page.locator(`#rummikubRack [data-tile="${tile}"]`).click();
      await page.locator('#rummikubNew').click();
      assert.equal(await page.locator('#rummikubMelds .rummikub-tile').count(), 3);
      assert.equal(await page.locator('#rummikubRack .rummikub-tile').count(), 1);
      assert.equal((await page.evaluate(() => rummikubTestActions.at(-1))).type, 'preview');
      await page.locator('#rummikubUndo').click();
      assert.equal(await page.locator('#rummikubRack .rummikub-tile').count(), 4);
      await page.locator('#rummikubRack [data-tile="red_10_0"]').click();
      await page.locator('.rummikub-empty').click();
      assert.equal(await page.locator('.rummikub-tile.is-selected').count(), 0);
      for (const tile of selected) await page.locator(`#rummikubRack [data-tile="${tile}"]`).click();
      await page.locator('#rummikubNew').click();
      await page.locator('#rummikubCommit').click();
      const committed = await page.evaluate(() => rummikubTestActions.at(-1));
      assert.equal(committed.type, 'commit');
      assert.deepEqual(new Set(committed.table[0]), new Set(selected));
      await show(page, 'rearrange');
      await page.locator('#rummikubRack [data-tile="blue_7_0"]').click();
      await page.locator('[data-add="0"]').click();
      assert.equal(await page.locator('#rummikubMelds .rummikub-tile').count(), 7);
      await page.locator('#rummikubMelds [data-tile="blue_7_0"]').click();
      await page.locator('#rummikubReturn').click();
      assert.equal(await page.locator('#rummikubRack [data-tile="blue_7_0"]').count(), 1);
      await page.locator('#rummikubRack [data-tile="red_12_0"]').click();
      await page.keyboard.press('Escape');
      assert.equal(await page.locator('.rummikub-tile.is-selected').count(), 0);
      await show(page, 'review');
      await page.locator('#rummikubPool').click();
      assert.equal(await page.locator('#rummikubTooltip').isVisible(), true);
      await page.locator('.rummikub-player').first().click();
      assert.match(await page.locator('#rummikubTooltip').innerText(), /Player 0/);
      await page.waitForTimeout(3100);
      assert.equal(await page.locator('#rummikubTooltip').isVisible(), false);
      await page.locator('#rummikubNext').click();
      assert.equal((await page.evaluate(() => rummikubTestActions.at(-1))).type, 'next_round');
      await show(page, 'ready');
      assert.equal(await page.locator('#rummikubNext').isDisabled(), true);
      await show(page, 'crowded');
      const rackPosition = await page.locator('#rummikubRack').evaluate(node => {
        node.scrollTop = 90;
        return node.scrollTop;
      });
      await page.locator('#rummikubRackToggle').focus();
      await page.keyboard.press('Enter');
      assert.equal(await page.locator('#rummikubRackToggle').getAttribute('aria-expanded'), 'false');
      await page.evaluate(() => renderRummikubGameState({ room_id: rummikubFixtureRoom, view: rummikubFixture }));
      await page.keyboard.press('Enter');
      assert.equal(await page.locator('#rummikubRack').evaluate(node => node.scrollTop), rackPosition);
      await page.evaluate(() => window.scrollTo(0, 0));
      const boardPoint = await page.locator('#rummikubMelds .rummikub-tile').first().boundingBox();
      await page.mouse.move(boardPoint.x + 12, boardPoint.y + 20);
      await page.mouse.wheel(0, 150);
      if (await page.evaluate(() => document.documentElement.scrollHeight > innerHeight)) await page.waitForFunction(() => window.scrollY > 0);
      assert.equal(await page.locator('.rummikub-tile.is-selected').count(), 0);
      const touch = await page.context().newCDPSession(page);
      const tileBox = await page.locator('#rummikubRack .rummikub-tile').first().boundingBox();
      await touch.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: tileBox.x + 12, y: tileBox.y + 20 }] });
      await touch.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: tileBox.x + 12, y: tileBox.y - 90 }] });
      await touch.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
      assert.equal(await page.locator('.rummikub-tile.is-selected').count(), 0);
      await touch.detach();
      await page.evaluate(() => window.scrollTo(0, 250));
      const dockBottom = await page.locator('#rummikubRackArea').evaluate(node => node.getBoundingClientRect().bottom);
      assert.equal(Math.round(dockBottom), 900);
      await page.locator('#rummikubRack').evaluate(node => {
        node.scrollTop = 0;
        node.addEventListener('pointerdown', () => { window.rummikubClickScroll = window.scrollY; }, { once: true });
      });
      await page.locator('#rummikubRack .rummikub-tile').first().click();
      assert.equal(await page.evaluate(() => window.scrollY), await page.evaluate(() => window.rummikubClickScroll));
      await page.locator('#rummikubMelds .rummikub-tile').last().scrollIntoViewIfNeeded();
      await noOverflow(page, `${width} dock after scrolling`);
      await page.screenshot({ path: `${output}/${width}-bottom-dock.png` });
      await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
      const lastLog = await page.locator('.rummikub-log').boundingBox();
      const dockTop = await page.locator('#rummikubRackArea').evaluate(node => node.getBoundingClientRect().top);
      assert(lastLog.y + lastLog.height <= dockTop, 'bottom dock covers the final content');
      await page.evaluate(() => setGamePanelVisibility(null));
      assert.equal(await page.locator('.rummikub-rack-area.is-docked').count(), 0);
      await page.evaluate(() => setGamePanelVisibility('rummikub'));
      console.log(`PASS ${width}px: collapsible dock, keyboard and scroll restoration, compact tiles/controls, rule Explain, page-only scrolling, cleanup and gameplay`);
    }

    const first = await pageAt(390, true);
    const second = await pageAt(1024);
    await first.evaluate(() => socket.emit('room:create', { name: 'Alice', game_type: 'rummikub', config: { seed: 4 } }));
    await first.waitForFunction(() => currentGameType === 'rummikub' && roomSessionReady && isGameAssetsLoaded('rummikub'));
    const room = await first.evaluate(() => roomId);
    await second.evaluate(room_id => socket.emit('room:join', { room_id, name: 'Bob' }), room);
    await second.waitForFunction(() => currentGameType === 'rummikub' && roomSessionReady && isGameAssetsLoaded('rummikub'));
    assert.equal(await first.locator('#rummikubConfigBox').isVisible(), true);
    assert.equal(await first.locator('#rummikubJokerRule').inputValue(), 'classic');
    assert.equal(await first.locator('#rummikubPanel #rummikubJokerRule').count(), 0);
    await first.screenshot({ path: `${output}/390-lobby-config.png`, fullPage: true });
    await first.setViewportSize({ width: 320, height: 900 });
    const configFits = await first.locator('#rummikubConfigBox').evaluate(node => {
      const bounds = node.getBoundingClientRect();
      return bounds.left >= 0 && bounds.right <= innerWidth && node.scrollWidth <= node.clientWidth + 1;
    });
    assert.equal(configFits, true, '320px room configuration overflows');
    await first.screenshot({ path: `${output}/320-lobby-config.png`, fullPage: true });
    await first.setViewportSize({ width: 390, height: 900 });
    await first.locator('#rummikubJokerRule').selectOption('free');
    await first.locator('#rummikubRounds').selectOption('2');
    await first.evaluate(() => socket.emit('room:ready', { ready: true }));
    await second.evaluate(() => socket.emit('room:ready', { ready: true }));
    await first.waitForFunction(() => !document.getElementById('startBtn').disabled);
    await first.evaluate(() => emitRoomStart());
    await first.waitForFunction(() => lastGameStatePayload?.view?.game_id === 'rummikub');
    await second.waitForFunction(() => lastGameStatePayload?.view?.game_id === 'rummikub');
    assert.equal(await first.evaluate(() => lastGameStatePayload.view.rounds), 2);
    assert.equal(await first.evaluate(() => lastGameStatePayload.view.joker_rule), 'free');
    assert.equal(await second.evaluate(() => lastGameStatePayload.view.joker_rule), 'free');
    assert.equal(await first.locator('#rummikubConfigBox').isVisible(), false);
    assert.equal(await first.locator('#rummikubRack .rummikub-tile').count(), 14);
    assert.equal(await second.locator('#rummikubRack .rummikub-tile').count(), 14);
    await first.locator('#rummikubRack .rummikub-tile').first().click();
    await first.locator('#rummikubNew').click();
    await second.waitForFunction(() => lastGameStatePayload.view.draft?.[0]?.length === 1);
    assert.equal(await second.locator('#rummikubMelds .rummikub-tile').count(), 1);
    assert.equal(await second.locator('#rummikubMelds .is-added').count(), 1);
    assert.equal(await second.evaluate(() => lastGameStatePayload.view.players.find(player => player.player_id !== lastGameStatePayload.view.you).hand), null);
    await first.reload();
    await first.waitForFunction(() => lastGameStatePayload?.view?.draft?.[0]?.length === 1 && document.querySelector('#rummikubMelds .rummikub-tile'));
    assert.equal(await first.locator('#rummikubRack .rummikub-tile').count(), 13);
    assert.equal(await first.evaluate(() => lastGameStatePayload.view.joker_rule), 'free');
    assert.equal(await first.locator('#rummikubRackToggle').getAttribute('aria-expanded'), 'true');
    await first.locator('#rummikubReset').click();
    await second.waitForFunction(() => lastGameStatePayload.view.draft === null);
    await first.locator('#rummikubDraw').click();
    await second.waitForFunction(() => lastGameStatePayload.view.turn === 2);
    await first.waitForFunction(() => lastGameStatePayload.view.turn === 2);
    assert.equal(await first.locator('#rummikubRack .rummikub-tile').count(), 15);
    assert.equal(await first.locator('#rummikubRack .is-drawn').count(), 1);
    assert.equal(await second.locator('#rummikubRack .is-drawn').count(), 0);
    assert.equal(await second.locator('#rummikubDraw').isEnabled(), true);
    await first.screenshot({ path: `${output}/live-first.png`, fullPage: true });
    await second.screenshot({ path: `${output}/live-second.png`, fullPage: true });
    console.log('PASS live two-client room: lazy loading, configuration, ready/start, hidden racks, trial broadcast, reload/reconnect, reset, draw/turn handoff');
    await second.locator('#rummikubDraw').click();
    await first.waitForFunction(() => lastGameStatePayload.view.turn === 3);
    await second.waitForFunction(() => lastGameStatePayload.view.turn === 3);
    assert.equal(await first.locator('#rummikubRack .is-drawn').count(), 1);
    assert.equal(await second.locator('#rummikubRack .is-drawn').count(), 1);
    const openingMelds = [
      ['red_13_1', 'orange_13_0', 'black_13_0'],
      ['orange_7_1', 'orange_8_0', 'orange_9_1'],
      ['blue_4_1', 'orange_4_1', 'black_4_1']
    ];
    for (let index = 0; index < openingMelds.length; index += 1) {
      for (const tile of openingMelds[index]) await first.locator(`#rummikubRack [data-tile="${tile}"]`).click();
      await first.locator('#rummikubNew').click();
      await first.waitForFunction(count => lastGameStatePayload.view.draft?.length === count, index + 1);
    }
    await first.locator('#rummikubCommit').click();
    await first.waitForFunction(() => lastGameStatePayload.view.turn === 4);
    await second.waitForFunction(() => lastGameStatePayload.view.turn === 4);
    assert.equal(await first.locator('#rummikubRack .rummikub-tile').count(), 6);
    assert.equal(await second.locator('#rummikubMelds .rummikub-tile').count(), 9);
    assert.equal(await second.locator('#rummikubMelds .is-added').count(), 9);
    assert.equal(await first.evaluate(() => lastGameStatePayload.view.players.find(player => player.player_id === lastGameStatePayload.view.you).opened), true);
    const botPage = await pageAt(390, true);
    await botPage.evaluate(() => socket.emit('room:create', { name: 'Human', game_type: 'rummikub', config: { seed: 4 } }));
    await botPage.waitForFunction(() => currentGameType === 'rummikub' && roomSessionReady && isGameAssetsLoaded('rummikub'));
    await botPage.evaluate(() => socket.emit('room:add_bot', {}));
    await botPage.waitForFunction(() => currentRoomState.players.length === 2);
    await botPage.evaluate(() => socket.emit('room:ready', { ready: true }));
    await botPage.waitForFunction(() => !document.getElementById('startBtn').disabled);
    await botPage.evaluate(() => emitRoomStart());
    await botPage.waitForFunction(() => lastGameStatePayload?.view?.turn === 1);
    await botPage.locator('#rummikubDraw').click();
    await botPage.waitForFunction(() => lastGameStatePayload.view.turn >= 3, null, { timeout: 20000 });
    console.log('PASS live opening commit and human/bot turn cycle');
    assert.deepEqual(errors, []);
  } finally {
    await Promise.all(contexts.map(context => context.close()));
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
