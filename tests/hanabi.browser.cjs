// UI checks with real public-view fixtures and a local static server; no game server required.
// Set PLAYWRIGHT_MODULE, PYTHON and BROWSER_CHANNEL when needed.
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const { execFileSync } = require('node:child_process');
const root = path.resolve(__dirname, '..');
const output = path.join(root, 'build', 'hanabi-ui');
fs.mkdirSync(output, { recursive: true });
const views = JSON.parse(execFileSync(process.env.PYTHON || 'python', ['-c', `
import copy, json, random, runpy
Game = runpy.run_path('game/hanabi.py')['HanabiGame']
random.seed(7)
players = [{'player_id': f'p{i}', 'name': name, 'seat': i, 'connected': True} for i, name in enumerate(['Alex', 'River', 'Kai', 'Mira', 'Robin'])]
s = Game.init_game({}, players[:3])
s['current_turn'] = 'p0'
s['clue_tokens'] = 5
s['tableau'] = {'red': 1, 'yellow': 2, 'green': 1, 'blue': 0, 'white': 3}
s['players']['p1']['hand'] = [{'color': c, 'rank': r} for c, r in [('red', 2), ('yellow', 3), ('green', 1), ('blue', 2), ('white', 5)]]
s['players']['p0']['knowledge'][0].update(known_color='red', known_rank=1, not_colors=['yellow', 'green', 'blue', 'white'], not_ranks=[2, 3, 4, 5])
s['players']['p0']['knowledge'][1].update(not_colors=['red', 'blue'], not_ranks=[1, 5])
s['discard_pile'] = [{'color': 'red', 'rank': 5}, {'color': 'blue', 'rank': 1}]
s['log'] = ['River hinted Alex: Red.', 'Alex played White 3.', 'Kai discarded Blue 1.']
views = {}
def save(key, state=s, viewer='p0'):
    views[key] = Game.get_public_view(state, viewer)
save('playing')
save('waiting', viewer='p1')
save('spectator', viewer='visitor')
for key, clues in [('full', 8), ('empty_clues', 0)]:
    state = copy.deepcopy(s)
    state['clue_tokens'] = clues
    save(key, state)
for key, reason in [('defeat', 'defeat'), ('perfect', 'perfect'), ('finished', 'deck_exhausted')]:
    state = copy.deepcopy(s)
    state.update(game_over=True, phase='game_over', end_reason=reason)
    if key == 'perfect': state['tableau'] = {color: 5 for color in state['tableau']}
    if key == 'defeat': state['fuse_tokens'] = 0
    save(key, state)
state = copy.deepcopy(s)
state.update(deck=[], final_rounds_remaining=2)
save('final', state)
state = copy.deepcopy(s)
for data in state['players'].values(): data['hand'], data['knowledge'] = [], []
save('no_cards', state)
for count in [2, 5]:
    state = Game.init_game({}, players[:count])
    state['current_turn'] = 'p0'
    save(f'players{count}', state)
state = copy.deepcopy(s)
for meta in state['player_meta'].values(): meta['name'] = 'LongPlayerName' * 12
state['log'] = [('LongPlayerName' * 12) + ' hinted a teammate.' for _ in range(50)]
state['current_turn'] = 'p2'
save('long', state)
print(json.dumps(views))
`], { cwd: root, encoding: 'utf8' }));

const server = http.createServer((request, response) => {
    const url = new URL(request.url, 'http://localhost');
    if (url.pathname === '/api/games') {
        response.setHeader('Content-Type', 'application/json');
        response.end(JSON.stringify([{ game_id: 'hanabi', name: 'Hanabi', min_players: 2, max_players: 5 }]));
        return;
    }
    const file = path.resolve(root, url.pathname === '/' ? 'static/index.html' : `.${decodeURIComponent(url.pathname)}`);
    if (!file.startsWith(root + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) {
        response.writeHead(404).end();
        return;
    }
    response.setHeader('Content-Type', ({ '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml' })[path.extname(file)] || 'application/octet-stream');
    response.end(fs.readFileSync(file));
});

async function prepare(page, base) {
    await page.route('https://fonts.googleapis.com/**', route => route.abort());
    await page.goto(base);
    await page.waitForFunction(() => typeof socket !== 'undefined');
    await page.evaluate(async () => {
        socket.disconnect();
        await ensureGameAssets('hanabi');
        window.hanabiTestActions = [];
        sendAction = action => hanabiTestActions.push(action);
    });
}
async function render(page, key = 'playing') {
    await page.evaluate(view => {
        clearHanabiState();
        playerId = view.you;
        roomSessionReady = true;
        renderRoomState({ room_id: 'hanabi-ui-preview', game_type: 'hanabi', status: 'in_game', players: view.players, host_id: 'p0', game_config: {} });
        renderGameState({ game_type: 'hanabi', room_id: 'hanabi-ui-preview', view });
        syncRoomControlsExplainButton();
        hanabiTestActions.length = 0;
        window.scrollTo(0, 0);
    }, views[key]);
    await page.locator('#hanabiPanel').waitFor({ state: 'visible' });
}
async function bounds(page, label) {
    const issues = await page.evaluate(() => {
        const bad = [...document.querySelectorAll('#hanabiPanel *')].filter(node => {
            const rect = node.getBoundingClientRect();
            const style = getComputedStyle(node);
            if (!node.checkVisibility() || !rect.width || !rect.height || style.opacity === '0' || node.classList.contains('hanabi-sr-only')) return false;
            return rect.left < -1 || rect.right > innerWidth + 1 ||
                (node.clientWidth > 0 && node.scrollWidth > node.clientWidth + 1 && !['auto', 'hidden'].includes(style.overflowX));
        }).map(node => `${node.id || node.className}: ${node.textContent.slice(0, 55)}`);
        return { overflow: document.documentElement.scrollWidth > innerWidth, bad };
    });
    if (issues.overflow || issues.bad.length) await page.screenshot({ path: path.join(output, 'layout-failure.png'), fullPage: true });
    assert.deepEqual(issues, { overflow: false, bad: [] }, label);
}
const actions = page => page.evaluate(() => hanabiTestActions);
const ownCards = page => page.locator('#hanabiHand .hanabi-card');
async function explain(page, selector) {
    await page.locator('#hanabiExplainBtn').click();
    const target = page.locator(selector);
    await target.scrollIntoViewIfNeeded();
    const box = await target.boundingBox();
    await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
    await page.locator('#hanabiDialog[open]').waitFor();
    assert.equal(await page.locator('#hanabiExplainBtn').getAttribute('aria-pressed'), 'false');
}

(async () => {
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const base = `http://127.0.0.1:${server.address().port}`;
    let browser;
    const errors = [];
    try {
        browser = await chromium.launch({ channel: process.env.BROWSER_CHANNEL || 'chrome', headless: true });
        const desktop = await browser.newPage({ viewport: { width: 1280, height: 900 } });
        desktop.on('pageerror', error => errors.push(error.message));
        await prepare(desktop, base);
        for (const width of [320, 360, 393, 600, 768, 900, 1024, 1280, 1600]) {
            await desktop.setViewportSize({ width, height: 852 });
            for (const key of Object.keys(views)) {
                await render(desktop, key);
                await bounds(desktop, `${width}px ${key}`);
                await desktop.evaluate(() => document.querySelectorAll('#hanabiPanel details').forEach(node => { node.open = true; }));
                await bounds(desktop, `${width}px ${key}, details open`);
                if (key !== 'spectator' && key !== 'no_cards') {
                    const tops = await ownCards(desktop).evaluateAll(cards => cards.map(card => Math.round(card.getBoundingClientRect().top)));
                    assert.equal(new Set(tops).size, 1, 'All cards must stay on one row');
                }
            }
        }
        console.log(`PASS layouts: 9 widths × ${Object.keys(views).length} public views, details open/closed`);
        await desktop.setViewportSize({ width: 1280, height: 900 });
        await render(desktop);
        await desktop.screenshot({ path: path.join(output, 'desktop.png'), fullPage: true });
        await desktop.locator('[data-hanabi-explain="clues"]').hover();
        assert.equal(await desktop.locator('#hanabiTooltip').isVisible(), true);
        await desktop.mouse.move(1, 1);
        assert.equal(await desktop.locator('#hanabiTooltip').isVisible(), false);

        const mobile = await browser.newPage({ viewport: { width: 393, height: 852 }, isMobile: true, hasTouch: true });
        mobile.on('pageerror', error => errors.push(error.message));
        await prepare(mobile, base);
        await render(mobile);
        await mobile.screenshot({ path: path.join(output, 'mobile.png'), fullPage: true });
        assert.equal(await mobile.locator('#hanabiPanel .hanabi-card').count(), 15);
        assert.equal(await mobile.locator('#hanabiClearSelection').count(), 0);
        assert.equal(await mobile.locator('#hanabiTargetHand .hanabi-clue-match').count(), 1);
        await mobile.locator('input[name="hanabiClueType"][value="rank"]').check();
        await mobile.locator('input[name="hanabiClueValue"][value="2"]').check();
        assert.equal(await mobile.locator('#hanabiTargetHand .hanabi-clue-match').count(), 2);
        await mobile.locator('#hanabiClueBtn').tap();
        assert.deepEqual(await actions(mobile), [{ type: 'give_clue', target_player_id: 'p1', clue_type: 'rank', value: 2 }]);
        await render(mobile);
        await mobile.locator('#hanabiTargetSelect').selectOption('p2');
        const clue = await mobile.locator('input[name="hanabiClueValue"]:checked').inputValue();
        assert.equal(await mobile.locator('#hanabiTargetHand .hanabi-card').count(), 5);
        await mobile.locator('#hanabiClueBtn').tap();
        assert.deepEqual(await actions(mobile), [{ type: 'give_clue', target_player_id: 'p2', clue_type: 'color', value: clue }]);

        await render(mobile);
        await ownCards(mobile).nth(1).tap();
        assert.equal(await mobile.locator('#hanabiPlayBtn').isEnabled(), true);
        await mobile.locator('#hanabiHandTitle').tap();
        assert.equal(await mobile.locator('#hanabiHand .selected').count(), 0);
        await ownCards(mobile).nth(1).tap();
        await mobile.locator('#hanabiDiscardBtn').tap();
        assert.deepEqual(await actions(mobile), [{ type: 'discard', card_index: 1 }]);
        await render(mobile);
        await ownCards(mobile).nth(1).tap();
        await mobile.locator('#hanabiPlayBtn').tap();
        assert.deepEqual(await actions(mobile), [{ type: 'play', card_index: 1 }]);

        await render(mobile);
        await ownCards(mobile).first().tap();
        await mobile.locator('#hanabiPlayBtn').tap();
        assert.equal(await mobile.locator('#hanabiConfirmActions').isVisible(), true);
        await bounds(mobile, 'failed-play dialog');
        await mobile.keyboard.press('Escape');
        assert.deepEqual(await actions(mobile), []);
        await mobile.locator('#hanabiPlayBtn').tap();
        await mobile.locator('#hanabiConfirmPlay').tap();
        assert.deepEqual(await actions(mobile), [{ type: 'play', card_index: 0 }]);

        await render(mobile, 'full');
        await ownCards(mobile).first().tap();
        assert.equal(await mobile.locator('#hanabiDiscardBtn').isDisabled(), true);
        await explain(mobile, '#hanabiDiscardBtn');
        assert.match(await mobile.locator('#hanabiDialogBody').textContent(), /eight clues/);
        assert.deepEqual(await actions(mobile), []);
        await mobile.keyboard.press('Escape');
        await mobile.locator('#hanabiHelpBtn').tap();
        await bounds(mobile, 'mobile help');
        await mobile.screenshot({ path: path.join(output, 'mobile-help.png') });
        await mobile.keyboard.press('Escape');
        assert.equal(await mobile.locator('#hanabiDialog').isVisible(), false);
        await mobile.locator('#hanabiExplainBtn').tap();
        await mobile.keyboard.press('Escape');
        assert.equal(await mobile.locator('#hanabiExplainBtn').getAttribute('aria-pressed'), 'false');
        await mobile.evaluate(() => {
            const button = document.createElement('button');
            button.id = 'hanabiTestUnexplained';
            button.textContent = 'Test control';
            button.onclick = () => hanabiTestActions.push('unexpected');
            document.getElementById('hanabiPanel').appendChild(button);
        });
        await mobile.locator('#hanabiExplainBtn').tap();
        await mobile.locator('#hanabiTestUnexplained').tap();
        assert.equal(await mobile.locator('#hanabiExplainBtn').getAttribute('aria-pressed'), 'true');
        assert.equal(await mobile.locator('#hanabiTestUnexplained').evaluate(node => getComputedStyle(node).cursor), 'pointer');
        assert.deepEqual(await actions(mobile), []);
        await mobile.keyboard.press('Escape');
        await mobile.locator('#hanabiTestUnexplained').evaluate(node => node.remove());

        // Real touch hit testing must explain disabled buttons without invoking their actions.
        await render(mobile, 'empty_clues');
        await mobile.locator('#hanabiExplainBtn').tap();
        await mobile.locator('#hanabiClueBtn').scrollIntoViewIfNeeded();
        const disabledClue = await mobile.locator('#hanabiClueBtn').boundingBox();
        await mobile.touchscreen.tap(disabledClue.x + disabledClue.width / 2, disabledClue.y + disabledClue.height / 2);
        await mobile.locator('#hanabiDialog[open]').waitFor();
        assert.match(await mobile.locator('#hanabiDialogBody').textContent(), /clue token/);
        assert.deepEqual(await actions(mobile), []);
        await mobile.keyboard.press('Escape');

        await render(mobile);
        await mobile.locator('[data-hanabi-explain="clues"]').tap();
        assert.match(await mobile.locator('#hanabiTooltip').textContent(), /Clues/);
        await mobile.locator('[data-hanabi-explain="fuses"]').tap();
        assert.match(await mobile.locator('#hanabiTooltip').textContent(), /Fuses/);
        await mobile.waitForFunction(() => document.getElementById('hanabiTooltip').hidden, null, { timeout: 4000 });
        await render(mobile, 'waiting');
        await ownCards(mobile).first().tap();
        assert.equal(await mobile.locator('#hanabiPlayBtn').isDisabled(), true);
        assert.equal(await mobile.locator('#hanabiClueBtn').isDisabled(), true);
        await render(mobile, 'spectator');
        assert.equal(await mobile.locator('#hanabiOwnSection').isVisible(), false);
        assert.equal(await mobile.locator('#hanabiClueBtn').isDisabled(), true);
        await render(mobile, 'defeat');
        assert.match(await mobile.locator('#hanabiResult').textContent(), /0 Points.*Current Board/);
        assert.equal(await mobile.locator('#hanabiHand button').count(), 0);
        await mobile.locator('#hanabiHelpBtn').tap();
        await mobile.evaluate(() => setGamePanelVisibility(null));
        assert.equal(await mobile.locator('#hanabiDialog').isVisible(), false);
        assert.equal(await mobile.locator('#mobileExplainSlot #hanabiExplainBtn').count(), 0);
        await mobile.evaluate(() => setGamePanelVisibility('hanabi'));
        assert.equal(await mobile.locator('#hanabiExplainBtn').count(), 1);
        for (const viewport of [{ width: 320, height: 568 }, { width: 667, height: 375 }]) {
            await mobile.setViewportSize(viewport);
            await render(mobile);
            await bounds(mobile, `touch ${viewport.width}px`);
            await mobile.locator('#hanabiHelpBtn').tap();
            await bounds(mobile, `help ${viewport.width}px`);
            const modal = await mobile.locator('#hanabiDialog').boundingBox();
            assert(modal.height <= viewport.height - 24);
            await mobile.keyboard.press('Escape');
        }
        await desktop.setViewportSize({ width: 1280, height: 900 });
        await render(desktop);
        await ownCards(desktop).nth(1).focus();
        await desktop.keyboard.press('Enter');
        assert.equal(await desktop.locator('#hanabiHand .selected').count(), 1);
        await desktop.keyboard.press('Escape');
        assert.equal(await desktop.locator('#hanabiHand .selected').count(), 0);
        assert.deepEqual(errors, []);
        console.log('PASS touch actions, clue preview, selection, disabled Explain, Help/Esc, tooltips, spectators, ending and cleanup');
        console.log(`Screenshots: ${output}`);
    } finally {
        if (browser) await browser.close();
        await new Promise(resolve => server.close(resolve));
    }
})().catch(error => { console.error(error); process.exitCode = 1; });
