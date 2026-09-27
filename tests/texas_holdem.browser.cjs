// UI + live multiplayer checks. Set PLAYWRIGHT_MODULE, PYTHON, ROOM_TEST_URL as needed.
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
const output = path.join(root, 'build', 'texas-holdem-ui');
const base = process.env.ROOM_TEST_URL || 'http://127.0.0.1:8893';
fs.mkdirSync(output, { recursive: true });
const fixtures = JSON.parse(execFileSync(process.env.PYTHON || 'python', ['-c', [
    'import copy, json, random, runpy',
    "m = runpy.run_path('game/texas_holdem.py')",
    "G = m['TexasHoldemGame']",
    'random.seed(12)',
    "players = [{'player_id': f'p{i}', 'name': name, 'seat': i, 'is_bot': False} for i, name in enumerate(['Alex', 'River', 'Mira', 'Calvin', 'Jules', 'Kai', 'Sam', 'Robin', 'Luca', 'Sky'])]",
    's = G.init_game({}, players[:6])',
    'v = {}',
    "def save(key, state=s, who=None): v[key] = G.get_public_view(state, who or state['current_turn'] or 'p2')",
    "save('preflop')",
    "while s['phase'] == 'preflop':",
    "    pid = s['current_turn']; legal = G.get_legal_actions(s, pid)",
    "    G.apply_action(s, pid, {'type': 'check' if 'check' in legal else 'call'})",
    "save('bet')",
    "G.apply_action(s, s['current_turn'], {'type': 'bet', 'amount': 80})",
    "save('raise')",
    "save('waiting', who='p1')",
    "save('spectator', who='visitor')",
    "short = copy.deepcopy(s); short['players'][short['current_turn']]['chips'] = 25; save('short', short)",
    "folded = copy.deepcopy(s); folded['players']['p0']['status'] = 'folded'; save('folded', folded, 'p0')",
    "allin = copy.deepcopy(s); allin['players']['p0'].update(status='all_in', chips=0); save('allin', allin, 'p0')",
    "while s['phase'] != 'hand_end':",
    "    pid = s['current_turn']; legal = G.get_legal_actions(s, pid)",
    "    G.apply_action(s, pid, {'type': 'check' if 'check' in legal else 'call'})",
    "save('result')",
    "G.apply_action(s, 'p2', {'type': 'next_hand'}); save('ready')",
    "busted = copy.deepcopy(s); busted['players']['p0']['chips'] = 0; save('rebuy', busted, 'p0')",
    "for count in [2, 10]:",
    "    state = G.init_game({}, players[:count]); save(f'players{count}', state)",
    "state = G.init_game({}, players[:3])",
    "for pid, data in state['players'].items(): data.update(chips=900, total_bet=100, current_bet=100)",
    "state['community_cards'] = [{'rank': r, 'suit': 'S'} for r in range(10, 15)]",
    "m['_resolve_showdown'](state); save('split', state)",
    "state = G.init_game({}, players[:3])",
    "for i, (pid, data) in enumerate(state['players'].items()): data.update(chips=1000 - (i+1)*100, total_bet=(i+1)*100, current_bet=(i+1)*100)",
    "state['community_cards'] = [{'rank': r, 'suit': suit} for r, suit in [(2, 'H'), (3, 'S'), (7, 'D'), (8, 'S'), (14, 'C')]]",
    "m['_resolve_showdown'](state); save('sidepots', state)",
    "v['long'] = copy.deepcopy(v['raise'])",
    "for player in v['long']['players']: player['name'] = 'VeryLongPlayerName' * 7; player['chips'] = 123456789012",
    "print(json.dumps(v))",
].join('\n')], { cwd: root, encoding: 'utf8', env: { ...process.env, PYTHONIOENCODING: 'utf-8' } }));

(async () => {
    const browser = await chromium.launch({ channel: process.env.BROWSER_CHANNEL || 'chrome', headless: true });
    const errors = [];
    async function newPage(options = {}) {
        const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, ...options });
        page.on('pageerror', error => errors.push(error.message));
        await page.route('https://fonts.googleapis.com/**', route => route.abort());
        await page.goto(base);
        await page.waitForFunction(() => typeof socket !== 'undefined' && socket.connected);
        return page;
    }
    async function prepare(page) {
        await page.evaluate(async () => {
            await ensureGameAssets('texas_holdem');
            window.texasTestActions = [];
            sendAction = action => texasTestActions.push(action);
            ensureRoomConnection = () => true;
        });
    }
    async function fixture(page, key = 'raise', reset = true) {
        await page.evaluate(({ view, reset }) => {
            if (reset) clearTexasHoldemState();
            playerId = view.you;
            roomSessionReady = true;
            renderRoomState({ room_id: 'texas-ui-preview', game_type: 'texas_holdem', status: 'in_game', players: view.players, host_id: view.you, game_config: {} });
            renderGameState({ room_id: 'texas-ui-preview', game_type: 'texas_holdem', view });
            texasTestActions.length = 0;
            window.scrollTo(0, 0);
        }, { view: fixtures[key], reset });
        await page.locator('#texasHoldemPanel').waitFor({ state: 'visible' });
    }
    async function bounds(page, label) {
        const result = await page.evaluate(() => {
            const issues = [...document.querySelectorAll('#texasHoldemPanel *')].filter(node => {
                if (!node.checkVisibility()) return false;
                const r = node.getBoundingClientRect();
                const s = getComputedStyle(node);
                if (!r.width || !r.height || s.display === 'inline') return false;
                return r.left < -1 || r.right > innerWidth + 1 ||
                    (node.clientWidth > 0 && node.scrollWidth > node.clientWidth + 2 && !['auto', 'hidden'].includes(s.overflowX));
            }).map(node => ({ id: node.id || node.className, text: node.textContent.slice(0, 35), client: node.clientWidth, scroll: node.scrollWidth }));
            const cards = [...document.querySelectorAll('#texasHoldemPanel .texas-card')].filter(n => n.checkVisibility());
            const overlaps = cards.filter(card => {
                const r = card.getBoundingClientRect();
                const children = [...card.children].map(n => n.getBoundingClientRect());
                return children.some(c => c.right > r.right + 1 || c.left < r.left - 1 || c.bottom > r.bottom + 1) ||
                    (children.length === 2 && children[0].bottom > children[1].top + 1);
            }).map(card => card.textContent);
            return { pageOverflow: document.documentElement.scrollWidth > innerWidth, issues, overlaps };
        });
        if (result.pageOverflow || result.issues.length || result.overlaps.length) await page.screenshot({ path: path.join(output, 'layout-failure.png'), fullPage: true });
        assert.deepEqual(result, { pageOverflow: false, issues: [], overlaps: [] }, label);
    }
    const actions = page => page.evaluate(() => texasTestActions);
    try {
        const desktop = await newPage();
        assert.equal(await desktop.locator('#texasHelpBtn').count(), 0, 'game markup loads on demand');
        await prepare(desktop);
        for (const width of [320, 360, 393, 600, 768, 1024, 1280, 1440]) {
            await desktop.setViewportSize({ width, height: 1000 });
            for (const key of Object.keys(fixtures)) {
                await fixture(desktop, key);
                await bounds(desktop, width + 'px ' + key);
            }
        }
        console.log('PASS responsive layout: 8 widths × ' + Object.keys(fixtures).length + ' public views');
        await desktop.setViewportSize({ width: 1440, height: 1000 });
        await fixture(desktop);
        await desktop.screenshot({ path: path.join(output, 'desktop.png'), fullPage: true });
        assert.equal(await desktop.locator('#texasCommunityCards .texas-card').count(), 5);
        assert.equal(await desktop.locator('#texasCommunityCards .texas-card-empty').count(), 2);
        assert.equal(await desktop.locator('.texas-player-card .texas-card-back:visible').count(), 10, 'opponent card backs remain visible');
        await desktop.locator('[data-texas-preset="pot"]').click();
        assert.equal(await desktop.locator('#texasBetInput').inputValue(), '300', 'pot raise includes the call');
        assert.deepEqual(await actions(desktop), [], 'selecting a preset does not act');
        assert.match(await desktop.locator('#texasBetHint').innerText(), /Adds 💰 300.*Leaves 💰 690/);
        await desktop.locator('#texasRaiseBtn').click();
        await desktop.locator('#texasRaiseBtn').evaluate(button => button.click());
        assert.deepEqual(await actions(desktop), [{ type: 'raise', amount: 300 }], 'pending action cannot be sent twice');
        await fixture(desktop);
        for (const invalid of ['', '159', '990.5', '991', '-1']) {
            await desktop.locator('#texasBetInput').fill(invalid);
            assert(await desktop.locator('#texasRaiseBtn').isDisabled());
            assert.equal(await desktop.locator('#texasBetInput').getAttribute('aria-invalid'), 'true');
        }
        await desktop.locator('#texasBetInput').fill('200');
        await fixture(desktop, 'raise', false);
        assert.equal(await desktop.locator('#texasBetInput').inputValue(), '200', 'same-state updates preserve amount');
        await desktop.locator('#texasBetRange').fill('240');
        assert.equal(await desktop.locator('#texasBetInput').inputValue(), '240');
        await fixture(desktop, 'short');
        assert.match(await desktop.locator('#texasCallBtn').innerText(), /Call 💰 25 · All-in/);
        assert(await desktop.locator('#texasRaiseBtn').isDisabled());
        await desktop.locator('#texasCallBtn').click();
        assert.deepEqual(await actions(desktop), [{ type: 'call' }]);
        await fixture(desktop, 'waiting');
        await desktop.locator('#texasExplainBtn').click();
        const disabled = await desktop.locator('#texasRaiseBtn').boundingBox();
        await desktop.mouse.click(disabled.x + disabled.width / 2, disabled.y + disabled.height / 2);
        assert(await desktop.locator('#texasDialog').evaluate(node => node.open), 'disabled buttons support Explain');
        assert.equal(await desktop.locator('#texasDialogTitle').innerText(), 'Raise to (💰)');
        assert.deepEqual(await actions(desktop), []);
        assert.equal(await desktop.locator('#texasExplainBtn').getAttribute('aria-pressed'), 'false');
        await desktop.keyboard.press('Escape');
        await fixture(desktop);
        await desktop.locator('#texasExplainBtn').click();
        await desktop.locator('#texasAllInBtn').click();
        assert.deepEqual(await actions(desktop), [], 'Explain never commits all-in');
        await desktop.keyboard.press('Escape');
        await desktop.locator('#texasHelpBtn').click();
        await bounds(desktop, 'help dialog');
        await desktop.screenshot({ path: path.join(output, 'help.png'), fullPage: true });
        await desktop.keyboard.press('Escape');
        await desktop.locator('[data-texas-explain="pot"]').hover();
        assert(await desktop.locator('#texasTooltip').isVisible());
        await desktop.mouse.move(1, 1);
        assert(!await desktop.locator('#texasTooltip').isVisible());
        await fixture(desktop, 'result');
        await desktop.screenshot({ path: path.join(output, 'result.png'), fullPage: true });
        await desktop.locator('#texasNextHandBtn').click();
        assert.deepEqual(await actions(desktop), [{ type: 'next_hand' }]);
        assert(!await desktop.locator('#texasDialog').evaluate(node => node.open), 'no extra Next Hand confirmation');
        await fixture(desktop, 'ready');
        assert(await desktop.locator('#texasNextHandBtn').isDisabled());
        assert.match(await desktop.locator('#texasReadyStatus').innerText(), /1 \/ 6 ready/);
        await fixture(desktop, 'rebuy');
        await desktop.locator('#texasRebuyBtn').click();
        assert.deepEqual(await actions(desktop), [{ type: 'rebuy' }]);
        console.log('PASS betting, pending actions, readiness, Help and Explain');

        const mobile = await newPage({ viewport: { width: 393, height: 852 }, isMobile: true, hasTouch: true });
        await prepare(mobile);
        await fixture(mobile);
        await mobile.screenshot({ path: path.join(output, 'mobile.png'), fullPage: true });
        await mobile.locator('#texasYourHand .texas-card').first().tap();
        const firstTip = await mobile.locator('#texasTooltip').innerText();
        await mobile.locator('#texasYourHand .texas-card').nth(1).tap();
        assert.notEqual(await mobile.locator('#texasTooltip').innerText(), firstTip);
        await mobile.waitForFunction(() => document.getElementById('texasTooltip').hidden, { timeout: 4000 });
        await mobile.locator('#texasExplainBtn').tap();
        await mobile.locator('#texasBetInput').tap();
        assert(await mobile.locator('#texasDialog').evaluate(node => node.open));
        assert.deepEqual(await actions(mobile), []);
        await mobile.keyboard.press('Escape');
        await mobile.locator('#texasHelpBtn').tap();
        await bounds(mobile, 'mobile help');
        await mobile.keyboard.press('Escape');
        await fixture(mobile, 'split');
        await bounds(mobile, 'split pot mobile');
        await mobile.screenshot({ path: path.join(output, 'mobile-result.png'), fullPage: true });
        console.log('PASS mobile tooltips, replacement, auto-dismiss and dialogs');

        // Two independent clients exercise real server actions from deal to showdown.
        const a = await newPage();
        const b = await newPage();
        await a.evaluate(() => socket.emit('room:create', { name: 'Texas QA Alice', game_type: 'texas_holdem' }));
        await a.waitForFunction(() => roomSessionReady && isGameAssetsLoaded('texas_holdem'));
        const rid = await a.evaluate(() => roomId);
        await b.evaluate(rid => socket.emit('room:join', { name: 'Texas QA Bob', room_id: rid }), rid);
        await b.waitForFunction(() => currentRoomState?.players.length === 2 && isGameAssetsLoaded('texas_holdem'));
        for (const page of [a, b]) await page.evaluate(() => socket.emit('room:ready', { ready: true }));
        await a.waitForFunction(() => currentRoomState.players.every(p => p.ready));
        await a.evaluate(() => socket.emit('room:start', {}));
        await a.waitForFunction(() => lastGameStatePayload?.view.phase === 'preflop');
        const playerPages = {};
        for (const page of [a, b]) {
            await page.waitForFunction(() => lastGameStatePayload?.view.phase === 'preflop');
            playerPages[await page.evaluate(() => playerId)] = page;
        }
        let raiseMade = false;
        for (let i = 0; i < 30; i++) {
            const before = await a.evaluate(() => JSON.stringify(lastGameStatePayload.view));
            const state = await a.evaluate(() => lastGameStatePayload.view);
            if (state.phase === 'hand_end') break;
            const page = playerPages[state.current_turn];
            await page.waitForFunction(pid => lastGameStatePayload.view.current_turn === pid, state.current_turn);
            if (!raiseMade) {
                await page.locator('[data-texas-preset="min"]').click();
                await page.locator('#texasRaiseBtn').click();
                raiseMade = true;
            } else {
                const check = await page.evaluate(() => lastGameStatePayload.view.legal_actions.includes('check'));
                await page.locator(check ? '#texasCheckBtn' : '#texasCallBtn').click();
            }
            await a.waitForFunction(before => JSON.stringify(lastGameStatePayload.view) !== before, before);
        }
        await a.waitForFunction(() => lastGameStatePayload.view.phase === 'hand_end');
        await b.waitForFunction(() => lastGameStatePayload.view.phase === 'hand_end');
        const firstHand = await a.evaluate(() => lastGameStatePayload.view.hand_number);
        await a.locator('#texasNextHandBtn').click();
        await a.waitForFunction(() => lastGameStatePayload.view.next_hand_ready.length === 1);
        assert.equal(await a.evaluate(() => lastGameStatePayload.view.phase), 'hand_end');
        await b.reload();
        await b.waitForFunction(() => isGameAssetsLoaded('texas_holdem') && lastGameStatePayload?.view.phase === 'hand_end');
        assert.match(await b.locator('#texasReadyStatus').innerText(), /1 \/ 2 ready/);
        await b.locator('#texasNextHandBtn').click();
        await a.waitForFunction(n => lastGameStatePayload.view.hand_number === n + 1, firstHand);
        assert.equal(await a.evaluate(() => lastGameStatePayload.view.phase), 'preflop');
        await a.evaluate(() => setGamePanelVisibility('cabo'));
        assert(!await a.locator('#texasHoldemPanel').isVisible());
        assert(!await a.locator('#texasDialog').evaluate(node => node.open));
        assert.deepEqual(errors, [], 'no browser runtime errors');
        console.log('PASS live deal, raise, call, check, showdown, unanimous readiness and reload');
    } finally {
        await browser.close();
    }
})().catch(error => { console.error(error); process.exitCode = 1; });
