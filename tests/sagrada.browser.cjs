const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const { execFileSync } = require('node:child_process');
const root = path.resolve(__dirname, '..');
const output = path.join(root, 'build', 'sagrada-ui');
fs.mkdirSync(output, { recursive: true });
const views = JSON.parse(execFileSync(process.env.PYTHON || 'python3', ['-c', `
import json
from game.sagrada import SagradaGame as Game
from tests.test_sagrada_game import SagradaGameTests
tester = SagradaGameTests()
views = {}
def save(key, state, player_id):
    views[key] = Game.get_public_view(state, player_id)
state, player_id = tester.fixture('grinding_stone')
save('draft', state, player_id)
tester.apply(state, player_id, {'type': 'place_die', 'die_id': 'fixture-red', 'row': 0, 'col': 0})
save('auto_end', state, player_id)
state, player_id = tester.fixture('eglomise_brush')
tester.apply(state, player_id, {'type': 'place_die', 'die_id': 'fixture-red', 'row': 0, 'col': 0})
save('tool_choice', state, player_id)
tester.use_tool(state, player_id, 'eglomise_brush', moves=[{'from_row': 0, 'from_col': 0, 'to_row': 0, 'to_col': 1}])
save('tool_end', state, player_id)
state, player_id = tester.fixture('flux_brush')
tester.use_tool(state, player_id, 'flux_brush', die_id='fixture-red')
save('pending', state, player_id)
tester.apply(state, player_id, {'type': 'resolve_tool', 'row': 0, 'col': 0})
save('resolved', state, player_id)
state, player_id = tester.fixture('flux_remover')
tester.use_tool(state, player_id, 'flux_remover', die_id='fixture-red')
save('pending_remover', state, player_id)
tester.apply(state, player_id, {'type': 'resolve_tool', 'row': 0, 'col': 0, 'value': 6})
save('resolved_remover', state, player_id)
state, player_id = tester.fixture('grinding_stone')
state['pool'] = state['pool'][:1]
for row in state['players'][player_id]['grid']:
    for cell in row:
        cell['restriction'] = {'color': 'blue'}
save('blocked', state, player_id)
state, player_id = tester.fixture('running_pliers')
tester.apply(state, player_id, {'type': 'place_die', 'die_id': 'fixture-red', 'row': 0, 'col': 0})
save('running_choice', state, player_id)
state = tester.started()
tester.apply(state, state['current_turn'], {'type': 'end_turn'})
player_id = state['current_turn']
state['players'][player_id].update(grid=tester.empty_grid(), favor_tokens=0)
save('consecutive_before', state, player_id)
tester.apply(state, player_id, {'type': 'place_die', 'die_id': state['pool'][0]['id'], 'row': 0, 'col': 0})
save('consecutive_after', state, player_id)
state, player_id = tester.fixture('grinding_stone', second_turn=True)
tester.apply(state, player_id, {'type': 'place_die', 'die_id': 'fixture-red', 'row': 0, 'col': 0})
save('review', state, player_id)
state = Game.init_game({'seed': 7}, tester.players())
save('setup', state, 'p1')
state = tester.final_scoring_fixture()
tester.finish_fixture(state)
save('final', state, 'p1')
print(json.dumps(views))
`], { cwd: root, encoding: 'utf8' }));

const server = http.createServer((request, response) => {
    const url = new URL(request.url, 'http://localhost');
    if (url.pathname === '/api/games') {
        response.setHeader('Content-Type', 'application/json');
        response.end(JSON.stringify([{ game_id: 'sagrada', name: 'Sagrada', min_players: 2, max_players: 4 }]));
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
        await ensureGameAssets('sagrada');
        window.sagradaTestActions = [];
        sendAction = action => sagradaTestActions.push(action);
    });
}

async function render(page, key, reset = true) {
    await page.evaluate(({ view, reset }) => {
        playerId = view.you;
        roomSessionReady = true;
        renderRoomState({ room_id: 'sagrada-ui-preview', game_type: 'sagrada', status: 'in_game', players: view.players, host_id: 'p1', game_config: {} });
        renderGameState({ game_type: 'sagrada', room_id: 'sagrada-ui-preview', view });
        setRoomControlsCollapsed(true);
        if (reset) sagradaTestActions.length = 0;
        window.scrollTo(0, 0);
    }, { view: views[key], reset });
    await page.locator('#sagradaPanel').waitFor({ state: 'visible' });
}

async function bounds(page, label) {
    const issues = await page.evaluate(() => {
        const problems = [];
        if (document.documentElement.scrollWidth > innerWidth) problems.push('page horizontal overflow');
        for (const node of document.querySelectorAll('#sagradaPanel *, .sagrada-modal *')) {
            if (!node.checkVisibility()) continue;
            const box = node.getBoundingClientRect();
            if (!box.width || !box.height) continue;
            if (box.left < -1 || box.right > innerWidth + 1) problems.push(`${node.id || node.className} outside viewport`);
            if (node.clientWidth > 0 && node.scrollWidth > node.clientWidth + 2 && getComputedStyle(node).overflowX === 'visible') problems.push(`${node.id || node.className} content overflow`);
        }
        const cards = [...document.querySelectorAll('.sagrada-layout > *')].filter(node => node.checkVisibility());
        for (const [index, first] of cards.entries()) {
            for (const second of cards.slice(index + 1)) {
                const firstBox = first.getBoundingClientRect();
                const secondBox = second.getBoundingClientRect();
                if (Math.min(firstBox.right, secondBox.right) - Math.max(firstBox.left, secondBox.left) > 1 && Math.min(firstBox.bottom, secondBox.bottom) - Math.max(firstBox.top, secondBox.top) > 1) problems.push(`${first.className} overlaps ${second.className}`);
            }
        }
        return problems;
    });
    if (issues.length) await page.screenshot({ path: path.join(output, 'layout-failure.png'), fullPage: true });
    assert.deepEqual(issues, [], label);
}

const actions = page => page.evaluate(() => sagradaTestActions);
const cell = (page, row, col) => page.locator(`#sagradaBoard [data-row="${row}"][data-col="${col}"]`);

(async () => {
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const base = `http://127.0.0.1:${server.address().port}`;
    let browser;
    const errors = [];
    try {
        browser = await chromium.launch({ channel: process.env.BROWSER_CHANNEL || 'chrome', headless: true });
        const desktop = await browser.newPage({ viewport: { width: 1440, height: 900 } });
        desktop.on('pageerror', error => errors.push(error.message));
        await prepare(desktop, base);
        await render(desktop, 'draft');
        assert.equal(await desktop.locator('#sagradaPlaceBtn').count(), 0);
        assert.equal(await desktop.locator('#sagradaBoard button:enabled').count(), 0);
        await desktop.locator('#sagradaPool button').first().click();
        assert.deepEqual(await actions(desktop), []);
        assert.equal(await cell(desktop, 1, 1).isDisabled(), true);
        await cell(desktop, 1, 1).evaluate(node => node.click());
        assert.deepEqual(await actions(desktop), []);
        await cell(desktop, 0, 0).dblclick();
        assert.deepEqual(await actions(desktop), [{ type: 'place_die', die_id: 'fixture-red', row: 0, col: 0, revision: views.draft.revision }]);
        assert.equal(await desktop.locator('#sagradaBoard button:enabled, #sagradaPool button:enabled').count(), 0);
        await render(desktop, 'auto_end', false);
        assert.equal(await desktop.locator('#sagradaSkipBtn').isDisabled(), true);
        assert.equal((await actions(desktop)).length, 1);

        await render(desktop, 'draft');
        await desktop.locator('#sagradaPool button').first().click();
        await cell(desktop, 0, 0).focus();
        await desktop.keyboard.press('Enter');
        assert.deepEqual(await actions(desktop), [{ type: 'place_die', die_id: 'fixture-red', row: 0, col: 0, revision: views.draft.revision }]);

        await render(desktop, 'draft');
        await desktop.locator('.sagrada-tool').click();
        await desktop.locator('#sagradaPool button').first().click();
        await cell(desktop, 0, 0).click();
        assert.deepEqual(await actions(desktop), []);
        await desktop.getByRole('button', { name: 'Use tool', exact: true }).click();
        assert.deepEqual(await actions(desktop), [{ type: 'use_tool', tool_id: 'grinding_stone', die_id: 'fixture-red', row: 0, col: 0, revision: views.draft.revision }]);

        await render(desktop, 'tool_choice');
        assert.match(await desktop.locator('#sagradaPoolHint').textContent(), /Draft complete.*use a tool or End turn/);
        assert.equal(await desktop.locator('#sagradaSkipBtn').isEnabled(), true);
        await desktop.locator('.sagrada-tool').click();
        await cell(desktop, 0, 0).click();
        await cell(desktop, 0, 1).click();
        assert.deepEqual(await actions(desktop), []);
        await desktop.getByRole('button', { name: 'Use tool', exact: true }).click();
        assert.deepEqual(await actions(desktop), [{ type: 'use_tool', tool_id: 'eglomise_brush', moves: [{ from_row: 0, from_col: 0, to_row: 0, to_col: 1 }], revision: views.tool_choice.revision }]);
        await render(desktop, 'tool_end', false);
        assert.equal(await desktop.locator('#sagradaSkipBtn').isDisabled(), true);
        assert.equal((await actions(desktop)).length, 1);

        await render(desktop, 'tool_choice');
        await desktop.locator('#sagradaSkipBtn').click();
        assert.deepEqual(await actions(desktop), [{ type: 'end_turn', revision: views.tool_choice.revision }]);
        await render(desktop, 'pending');
        assert.equal(await desktop.locator('#sagradaSkipBtn').isDisabled(), true);
        await cell(desktop, 0, 0).click();
        assert.deepEqual(await actions(desktop), [{ type: 'resolve_tool', row: 0, col: 0, revision: views.pending.revision }]);
        await render(desktop, 'resolved', false);
        assert.equal(await desktop.locator('#sagradaSkipBtn').isDisabled(), true);
        assert.equal((await actions(desktop)).length, 1);

        await render(desktop, 'pending_remover');
        assert.equal(await desktop.locator('#sagradaBoard button:enabled').count(), 0);
        await desktop.locator('#sagradaToolControls select').selectOption('6');
        assert.deepEqual(await actions(desktop), []);
        await cell(desktop, 0, 0).click();
        assert.deepEqual(await actions(desktop), [{ type: 'resolve_tool', row: 0, col: 0, value: 6, revision: views.pending_remover.revision }]);
        await render(desktop, 'resolved_remover', false);
        assert.equal(await desktop.locator('#sagradaSkipBtn').isDisabled(), true);
        assert.equal((await actions(desktop)).length, 1);

        await render(desktop, 'consecutive_before');
        await desktop.locator('#sagradaPool button').first().click();
        await cell(desktop, 0, 0).click();
        await render(desktop, 'consecutive_after', false);
        assert.equal((await actions(desktop)).length, 1);
        assert.equal(await desktop.locator('#sagradaSkipBtn').isEnabled(), true);
        assert.equal(await desktop.locator('#sagradaBoard button:enabled').count(), 0);
        assert.equal(await desktop.locator('#sagradaPool .selected, #sagradaBoard .selected').count(), 0);

        await render(desktop, 'blocked');
        assert.match(await desktop.locator('#sagradaPoolHint').textContent(), /No actions left/);
        await render(desktop, 'tool_choice');
        await desktop.locator('#sagradaHelpBtn').click();
        assert.match(await desktop.locator('#sagradaHelpContent').textContent(), /turn ends automatically/);
        assert.match(await desktop.locator('#sagradaHelpContent').textContent(), /click a highlighted cell to place it immediately/);
        await desktop.keyboard.press('Escape');
        assert.equal(await desktop.locator('#sagradaHelpModal').isVisible(), false);
        await render(desktop, 'auto_end');
        await desktop.locator('#sagradaExplainBtn').click();
        const disabled = desktop.locator('#sagradaSkipBtn');
        assert.equal(await disabled.isDisabled(), true);
        await disabled.scrollIntoViewIfNeeded();
        const box = await disabled.boundingBox();
        await desktop.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
        assert.match(await desktop.locator('#sagradaExplainContent').textContent(), /ends automatically/);
        assert.deepEqual(await actions(desktop), []);
        await desktop.keyboard.press('Escape');

        for (const keyboard of [false, true]) {
            await render(desktop, 'draft');
            await desktop.locator('#sagradaPool button').first().click();
            await desktop.locator('#sagradaExplainBtn').click();
            if (keyboard) {
                await cell(desktop, 0, 0).focus();
                await desktop.keyboard.press('Enter');
            } else {
                await cell(desktop, 0, 0).click();
            }
            assert.equal(await desktop.locator('#sagradaExplainModal').isVisible(), true);
            assert.match(await desktop.locator('#sagradaExplainContent').textContent(), /Click to place this die immediately/);
            assert.deepEqual(await actions(desktop), []);
            await desktop.keyboard.press('Escape');
        }

        for (const width of [320, 390, 1024, 1440]) {
            await desktop.setViewportSize({ width, height: 900 });
            await desktop.mouse.move(1, 1);
            for (const key of Object.keys(views)) {
                await render(desktop, key);
                await bounds(desktop, `${width}px ${key}`);
                if (key === 'draft') await desktop.locator('#sagradaPanel').screenshot({ path: path.join(output, `draft-${width}.png`) });
                if (key === 'tool_choice') await desktop.locator('#sagradaPanel').screenshot({ path: path.join(output, `tools-${width}.png`) });
            }
        }
        const mobile = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
        mobile.on('pageerror', error => errors.push(error.message));
        await prepare(mobile, base);
        await render(mobile, 'draft');
        await mobile.locator('#sagradaPool button').first().tap();
        await cell(mobile, 0, 0).scrollIntoViewIfNeeded();
        const touchBox = await cell(mobile, 0, 0).boundingBox();
        const touchSession = await mobile.context().newCDPSession(mobile);
        const touchX = touchBox.x + touchBox.width / 2;
        const touchY = touchBox.y + touchBox.height / 2;
        await touchSession.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: touchX, y: touchY }] });
        for (const distance of [20, 45, 90]) {
            await touchSession.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: touchX, y: touchY - distance }] });
        }
        await touchSession.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
        await touchSession.detach();
        assert.deepEqual(await actions(mobile), []);
        await cell(mobile, 0, 0).tap();
        assert.deepEqual(await actions(mobile), [{ type: 'place_die', die_id: 'fixture-red', row: 0, col: 0, revision: views.draft.revision }]);
        await render(mobile, 'auto_end', false);
        assert.equal((await actions(mobile)).length, 1);
        assert.equal(await mobile.locator('#sagradaSkipBtn').isDisabled(), true);
        await render(mobile, 'review');
        await mobile.locator('#sagradaNextRoundBtn').tap();
        assert.deepEqual(await actions(mobile), [{ type: 'next_round', revision: views.review.revision }]);
        await render(mobile, 'tool_choice');
        await mobile.locator('#sagradaHelpBtn').tap();
        await bounds(mobile, 'mobile help');
        await mobile.screenshot({ path: path.join(output, 'mobile-help.png') });
        await mobile.keyboard.press('Escape');
        assert.equal(await mobile.locator('#sagradaHelpModal').isVisible(), false);
        assert.deepEqual(errors, []);
        console.log(`PASS: click-to-place, duplicate protection, keyboard placement, tool confirmation, both pending tool results, touch scroll/tap, automatic handoff, consecutive turns, manual pass, round review, Help/Explain and ${Object.keys(views).length} views at 320/390/1024/1440px.`);
    } finally {
        if (browser) await browser.close();
        server.closeAllConnections();
        await new Promise(resolve => server.close(resolve));
    }
})().catch(error => { console.error(error); process.exitCode = 1; });
