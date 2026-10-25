const {chromium} = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const {execFileSync} = require('node:child_process');

const root = path.resolve(__dirname, '..');
const output = path.join(root, 'build/patchwork-ui');
const {views, orientations} = JSON.parse(execFileSync(process.env.PYTHON || 'python', ['-m', 'tests.patchwork_fixtures'], {cwd: root, encoding: 'utf8'}));
fs.mkdirSync(output, {recursive: true});
const server = http.createServer((request, response) => {
    const url = new URL(request.url, 'http://localhost');
    if (url.pathname === '/api/games') {
        response.setHeader('Content-Type', 'application/json');
        response.end(JSON.stringify([{game_id: 'patchwork', name: 'Patchwork', min_players: 2, max_players: 2}]));
        return;
    }
    const file = path.resolve(root, url.pathname === '/' ? 'static/index.html' : `.${decodeURIComponent(url.pathname)}`);
    if (!file.startsWith(root + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) {
        response.writeHead(404).end();
        return;
    }
    response.setHeader('Content-Type', ({'.css': 'text/css; charset=utf-8', '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.svg': 'image/svg+xml'})[path.extname(file)] || 'application/octet-stream');
    response.end(fs.readFileSync(file));
});

async function render(page, name, {reset = true, view = views[name]} = {}) {
    await page.evaluate(({view, reset}) => {
        socket.connected = true;
        roomSessionReady = true;
        playerId = view.you;
        if (reset) { clearPatchworkState(); window.patchworkQaActions.length = 0; }
        const room = {room_id: 'patchwork-browser-qa', game_type: 'patchwork', status: view.game_over ? 'game_over' : 'in_game', host_id: 'p0', players: view.players.map(player => ({...player, ready: true, connected: true})), game_config: {}};
        renderRoomState(room);
        lastGameStatePayload = {room_id: room.room_id, game_type: room.game_type, view};
        renderGameState(lastGameStatePayload);
        setRoomControlsCollapsed(true);
    }, {view, reset});
}

async function bounds(page, label) {
    const result = await page.evaluate(() => {
        const nodes = [...document.querySelectorAll('#patchworkPanel *, .patchwork-dialog[open] *, .game-panel[data-game-theme="patchwork"] > .panel-header *')];
        const issues = nodes.filter(node => {
            if (node.closest('.room-controls-layer')) return false;
            if (!node.checkVisibility()) return false;
            const rect = node.getBoundingClientRect();
            const style = getComputedStyle(node);
            return rect.width && rect.height && style.display !== 'contents' &&
                (rect.left < -1 || rect.right > innerWidth + 1 ||
                (node.clientWidth && node.scrollWidth > node.clientWidth + 1 && !['auto', 'hidden'].includes(style.overflowX)));
        }).map(node => `${node.id || node.className}: ${node.clientWidth}/${node.scrollWidth}`);
        const sections = [...document.querySelectorAll('.patchwork-market-panel, .patchwork-quilt-panel, .patchwork-side-column')].map(node => node.getBoundingClientRect());
        const overlaps = sections.flatMap((first, index) => sections.slice(index + 1).filter(second =>
            Math.min(first.right, second.right) - Math.max(first.left, second.left) > 1 &&
            Math.min(first.bottom, second.bottom) - Math.max(first.top, second.top) > 1));
        const shapeOverflow = [...document.querySelectorAll('.patchwork-market-image .patchwork-shape, .patchwork-preview .patchwork-shape')].filter(node => {
            if (!node.checkVisibility()) return false;
            const shape = node.getBoundingClientRect();
            const container = node.parentElement.getBoundingClientRect();
            return shape.left < container.left - 1 || shape.right > container.right + 1 || shape.top < container.top - 1 || shape.bottom > container.bottom + 1;
        }).length;
        return {width: innerWidth, scrollWidth: document.documentElement.scrollWidth, issues, overlaps: overlaps.length, shapeOverflow};
    });
    assert(result.scrollWidth <= result.width, `${label}: page overflow ${JSON.stringify(result)}`);
    assert.deepEqual(result.issues, [], `${label}: element overflow`);
    assert.equal(result.overlaps, 0, `${label}: section overlap`);
    assert.equal(result.shapeOverflow, 0, `${label}: clipped patch shape`);
}

const count = page => page.evaluate(() => window.patchworkQaActions.length);
const latest = page => page.evaluate(() => window.patchworkQaActions.at(-1));
const preview = page => page.locator('#patchworkYourBoard .preview').evaluateAll(nodes => nodes.map(node => [Number(node.dataset.column), Number(node.dataset.row)]));
const ordered = cells => cells.map(cell => cell.join(',')).sort();

async function closeExplain(page) {
    await page.keyboard.press('Escape');
    await page.waitForFunction(() => !document.getElementById('patchworkExplainModal').open);
    await page.waitForTimeout(650);
}

async function swipe(page, locator) {
    await locator.scrollIntoViewIfNeeded();
    const rect = await locator.boundingBox();
    const session = await page.context().newCDPSession(page);
    const point = {x: rect.x + rect.width / 2, y: rect.y + rect.height / 2};
    await session.send('Input.dispatchTouchEvent', {type: 'touchStart', touchPoints: [{...point, id: 1}]});
    for (const distance of [12, 26, 42, 60]) await session.send('Input.dispatchTouchEvent', {type: 'touchMove', touchPoints: [{x: point.x, y: point.y - distance, id: 1}]});
    await session.send('Input.dispatchTouchEvent', {type: 'touchEnd', touchPoints: []});
    await session.detach();
    await page.waitForTimeout(650);
}

(async () => {
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    let browser;
    try {
        browser = await chromium.launch({channel: process.env.BROWSER_CHANNEL || 'chrome', headless: true});
        const page = await browser.newPage({viewport: {width: 1440, height: 1000}, hasTouch: true});
        page.setDefaultTimeout(8000);
        const errors = [];
        page.on('pageerror', error => errors.push(error.message));
        await page.route('https://fonts.googleapis.com/**', route => route.abort());
        await page.goto(`http://127.0.0.1:${server.address().port}`);
        await page.waitForFunction(() => typeof socket !== 'undefined');
        assert.equal(await page.locator('#patchworkPanel').evaluate(node => node.children.length), 0);
        assert.equal(await page.locator('script[src*="games/patchwork.js"]').count(), 0);
        await page.evaluate(async () => {
            socket.disconnect();
            socket.connected = true;
            await ensureGameAssets('patchwork');
            window.patchworkQaActions = [];
            sendAction = action => window.patchworkQaActions.push(action);
        });
        await render(page, 'placement');
        assert.match(await page.locator('.game-panel-title h2').innerText(), /拼布艺术/);
        assert.equal(await page.evaluate(() => typeof window.transformed), 'undefined');

        for (const width of [320, 390, 1024, 1440]) {
            await page.setViewportSize({width, height: width < 600 ? 844 : 1000});
            for (const name of Object.keys(views)) {
                await render(page, name);
                await bounds(page, `${width} ${name}`);
                assert.equal(await page.evaluate(() => !!window.patchworkInjected), false);
            }
            await render(page, 'placement');
            assert.equal(await page.locator('#patchworkMarket .selectable').count(), 3);
            assert.equal(await page.locator('#patchworkUpcomingMarket .upcoming').count(), 30);
            assert.equal(await page.locator('#patchworkYourBoard .patchwork-board-cell').count(), 81);
            assert.equal(await page.evaluate(() => document.body.classList.contains('patchwork-turn-active')), true);
            await page.evaluate(() => window.scrollTo(0, 0));
            await page.screenshot({path: path.join(output, `${width}-start.png`), fullPage: true});
            await page.locator('#patchworkMarket [data-patch-id="patch_28"]').click();
            await page.locator('#patchworkYourBoard [data-row="4"][data-column="4"]').click();
            await bounds(page, `${width} selected`);
            assert.equal(await page.locator('#patchworkConfirmBuyBtn').isEnabled(), true);
            const centered = await preview(page);
            assert.equal(await page.locator('#patchworkMoveUpBtn').isEnabled(), true);
            await page.locator('#patchworkMoveRightBtn').click();
            assert.deepEqual(ordered(await preview(page)), ordered(centered.map(([column, row]) => [column + 1, row])), 'right nudge moves the preview one cell');
            await page.locator('#patchworkMoveLeftBtn').click();
            await page.locator('#patchworkMoveUpBtn').click();
            assert.deepEqual(ordered(await preview(page)), ordered(centered.map(([column, row]) => [column, row - 1])), 'up nudge moves the preview one cell');
            await page.locator('#patchworkMoveDownBtn').click();
            assert.deepEqual(ordered(await preview(page)), ordered(centered), 'down nudge restores the preview');
            await page.evaluate(() => window.scrollTo(0, 0));
            await page.screenshot({path: path.join(output, `${width}-placement.png`), fullPage: true});
            await page.locator('#patchworkUpcomingDetails summary').click();
            await page.locator('#patchworkTimeDetails').evaluate(node => { node.open = true; });
            await bounds(page, `${width} details`);
            assert.equal(await page.locator('#patchworkTrack .patchwork-track-space').count(), 54);
            await page.locator('#patchworkPlayers [data-player-id="p1"]').click();
            await bounds(page, `${width} opponent dialog`);
            assert.equal(await page.locator('#patchworkQuiltModalBoard .patchwork-board-cell').count(), 81);
            await page.keyboard.press('Escape');
            if (width >= 1024) {
                await page.evaluate(() => setRoomControlsCollapsed(false));
                await bounds(page, `${width} RC expanded`);
                await page.evaluate(() => setRoomControlsCollapsed(true));
            }
        }
        console.log(`${Object.keys(views).length} states and details passed at 320/390/1024/1440.`);

        await render(page, 'placement');
        await page.locator('#patchworkHelpBtn').click();
        assert.match(await page.locator('#patchworkHelpContent').innerText(), /7×7/);
        await page.keyboard.press('Escape');
        assert.equal(await page.locator('#patchworkHelpBtn').evaluate(node => node === document.activeElement), true);
        await page.locator('#patchworkExplainBtn').click();
        const disabled = await page.locator('#patchworkRotateBtn').boundingBox();
        await page.mouse.click(disabled.x + disabled.width / 2, disabled.y + disabled.height / 2);
        assert.equal(await page.locator('#patchworkExplainModal').evaluate(node => node.open), true);
        assert.equal(await count(page), 0);
        await closeExplain(page);
        await page.locator('#patchworkExplainBtn').click();
        await page.locator('#patchworkAdvanceBtn').focus();
        await page.keyboard.press('Enter');
        assert.equal(await count(page), 0);
        assert.equal(await page.locator('#patchworkExplainModal').evaluate(node => node.open), true);
        await closeExplain(page);
        await page.evaluate(() => {
            const button = document.createElement('button');
            button.id = 'patchworkQaUnknown';
            button.textContent = 'Unknown';
            button.onclick = () => { window.patchworkQaUnknownClicked = true; };
            document.getElementById('patchworkPanel').append(button);
        });
        await page.locator('#patchworkExplainBtn').click();
        await page.locator('#patchworkQaUnknown').click();
        assert.equal(await page.evaluate(() => !!window.patchworkQaUnknownClicked), false);
        await page.keyboard.press('Escape');
        await page.locator('#patchworkQaUnknown').evaluate(node => node.remove());

        for (const patchId of ['patch_28', 'patch_16', 'patch_31']) {
            for (const mirror of [false, true]) {
                for (const turns of [0, 1, 2, 3]) {
                    await render(page, 'placement');
                    await page.locator(`#patchworkMarket [data-patch-id="${patchId}"]`).click();
                    await page.locator('#patchworkYourBoard [data-row="4"][data-column="4"]').click();
                    if (mirror) await page.locator('#patchworkFlipBtn').click();
                    for (let turn = 0; turn < turns; turn++) {
                        const before = await preview(page);
                        await page.locator('#patchworkRotateBtn').click();
                        assert.deepEqual(ordered(await preview(page)), ordered(before.map(([column, row]) => [8 - row, column])), 'clockwise rotation about stable pivot');
                    }
                    const cells = await preview(page);
                    await page.locator('#patchworkConfirmBuyBtn').click();
                    const action = await latest(page);
                    assert.equal(action.type, 'buy_patch');
                    assert.deepEqual(ordered(cells), ordered(orientations[patchId][`${action.rotation}:${action.flip}`].map(([column, row]) => [column + action.x, row + action.y])), 'preview matches server orientation');
                    await page.locator('#patchworkConfirmBuyBtn').dispatchEvent('click');
                    await render(page, 'placement', {reset: false});
                    await page.locator('#patchworkAdvanceBtn').dispatchEvent('click');
                    assert.equal(await count(page), 1, 'duplicate action or identical snapshot unlocked the action');
                }
            }
        }
        await render(page, 'placement');
        await page.locator('#patchworkMarket [data-patch-id="patch_28"]').click();
        await page.locator('#patchworkYourBoard [data-row="4"][data-column="4"]').click();
        const initial = await preview(page);
        for (let turn = 0; turn < 4; turn++) await page.locator('#patchworkRotateBtn').click();
        assert.deepEqual(ordered(await preview(page)), ordered(initial));
        await page.locator('#patchworkRotateBtn').click();
        const turned = await preview(page);
        await page.locator('#patchworkFlipBtn').click();
        assert.deepEqual(ordered(await preview(page)), ordered(turned.map(([column, row]) => [8 - column, row])), 'horizontal flip after rotation');
        await page.locator('#patchworkFlipBtn').click();
        assert.deepEqual(ordered(await preview(page)), ordered(turned));
        const focus = await page.evaluate(() => document.activeElement.id);
        await render(page, 'placement', {reset: false});
        assert.equal(await page.evaluate(() => document.activeElement.id), focus);
        await page.locator('#patchworkYourBoard [data-row="0"][data-column="0"]').click();
        assert.equal(await page.locator('#patchworkConfirmBuyBtn').isDisabled(), true);
        await page.locator('#patchworkQuiltTitle').click();
        assert.equal(await page.locator('#patchworkMarket .selected').count(), 0);
        for (const name of ['occupied', 'no_cash']) {
            await render(page, name);
            await page.locator('#patchworkMarket [data-patch-id="patch_28"]').click();
            await page.locator('#patchworkYourBoard [data-row="4"][data-column="4"]').click();
            assert.equal(await page.locator('#patchworkConfirmBuyBtn').isDisabled(), true);
        }
        await render(page, 'bonus_patch');
        await page.locator('#patchworkYourBoard [data-row="4"][data-column="4"]').dispatchEvent('click');
        assert.equal(await count(page), 0);
        assert.equal(await page.locator('#patchworkConfirmBuyBtn').isDisabled(), true);
        await page.locator('#patchworkYourBoard [data-row="0"][data-column="0"]').click();
        assert.equal(await count(page), 0);
        await page.locator('#patchworkConfirmBuyBtn').click();
        assert.deepEqual(await latest(page), {type: 'place_bonus_patch', x: 0, y: 0});
        await page.locator('#patchworkYourBoard [data-row="0"][data-column="1"]').dispatchEvent('click');
        assert.equal(await count(page), 1);
        for (const name of ['waiting', 'spectator', 'bonus_waiting', 'bonus_spectator', 'game_over']) {
            await render(page, name);
            assert.equal(await page.locator('#patchworkAdvanceBtn').isDisabled(), true);
            await page.locator('#patchworkAdvanceBtn').dispatchEvent('click');
            assert.equal(await count(page), 0);
        }
        console.log('Orientation parity, pivot, affordability, overlap, bonus confirmation and submission locks passed.');

        await render(page, 'placement');
        await page.locator('#patchworkAdvanceBtn').click();
        await page.evaluate(() => socket.listeners('system:error').forEach(callback => callback({message: 'QA action rejected'})));
        assert.match(await page.locator('#patchworkError').innerText(), /QA action rejected/);
        assert.equal(await page.locator('#patchworkAdvanceBtn').isEnabled(), true);
        await render(page, 'placement');
        await page.evaluate(() => {
            socket.connected = false;
            socket.listeners('disconnect').forEach(callback => callback('test'));
        });
        assert.equal(await page.locator('#patchworkAdvanceBtn').isDisabled(), true);
        await page.evaluate(() => { socket.connected = true; roomSessionReady = false; socket.listeners('connect').forEach(callback => callback()); });
        assert.equal(await page.locator('#patchworkAdvanceBtn').isDisabled(), true);
        await render(page, 'placement', {reset: false});
        assert.equal(await page.locator('#patchworkAdvanceBtn').isEnabled(), true);
        await render(page, 'after_purchase', {reset: false});
        assert.match(await page.locator('#patchworkActivity').innerText(), /购买/);

        await page.setViewportSize({width: 390, height: 844});
        await render(page, 'placement');
        await swipe(page, page.locator('#patchworkMarket .selectable').first());
        assert.equal(await page.locator('#patchworkMarket .selected').count(), 0);
        await page.locator('#patchworkMarket .selectable').first().tap();
        await swipe(page, page.locator('#patchworkYourBoard'));
        assert.equal(await page.locator('#patchworkYourBoard .preview').count(), 0);
        assert.equal(await page.locator('#patchworkMarket .selected').count(), 1);
        await page.locator('#patchworkWallet [data-patchwork-tip]').first().tap();
        assert.equal(await page.locator('#patchworkTooltip').isVisible(), true);
        await page.locator('#patchworkWallet [data-patchwork-tip]').nth(1).tap();
        assert.match(await page.locator('#patchworkTooltip').innerText(), /收入/);
        await page.waitForTimeout(3100);
        assert.equal(await page.locator('#patchworkTooltip').isVisible(), false);
        await page.locator('#patchworkMarket .selectable').nth(1).tap();
        assert.equal(await page.locator('#patchworkTooltip').isVisible(), false);
        await page.locator('#patchworkUpcomingDetails summary').tap();
        await page.locator('#patchworkUpcomingMarket').evaluate(node => { node.scrollTop = 180; });
        await render(page, 'placement', {reset: false});
        assert.equal(await page.locator('#patchworkUpcomingMarket').evaluate(node => node.scrollTop), 180);
        await page.locator('#patchworkExplainBtn').tap();
        await swipe(page, page.locator('#patchworkMarket .selectable').first());
        assert.equal(await page.locator('#patchworkExplainModal').evaluate(node => node.open), false);
        await page.keyboard.press('Escape');
        await page.evaluate(() => { showPatchworkHeaderActions(false); });
        assert.equal(await page.evaluate(() => document.body.classList.contains('patchwork-turn-active')), false);
        assert.equal(await page.locator('#patchworkTooltip').isVisible(), false);

        const retry = await browser.newPage({viewport: {width: 390, height: 844}});
        let attempts = 0;
        await retry.route('**/static/games/patchwork.css?*', route => ++attempts === 1 ? route.abort() : route.continue());
        await retry.goto(`http://127.0.0.1:${server.address().port}`);
        await retry.waitForFunction(() => typeof socket !== 'undefined');
        await retry.evaluate(async () => {
            socket.disconnect();
            try { await ensureGameAssets('patchwork'); } catch {}
        });
        assert.equal(await retry.locator('script[src*="games/patchwork.js"]').count(), 0);
        await retry.evaluate(() => ensureGameAssets('patchwork'));
        assert.equal(attempts, 2);
        assert.equal(await retry.locator('script[src*="games/patchwork.js"]').count(), 1);
        assert.equal(await retry.locator('#patchworkYourBoard').count(), 1);
        assert.deepEqual(errors, []);
        console.log('Help/Explain, tooltips, real touch swipes, error/reconnect, activity, cleanup and lazy retry passed.');
    } finally {
        await browser?.close();
        await new Promise(resolve => server.close(resolve));
    }
})().catch(error => { console.error(error.stack || error); process.exitCode = 1; });
