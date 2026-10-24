const {chromium} = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const {execFileSync} = require('node:child_process');

const root = path.resolve(__dirname, '..');
const output = path.join(root, 'build/patchwork-ui');
const python = process.env.PYTHON || 'python';
const views = JSON.parse(execFileSync(python, ['-m', 'tests.patchwork_fixtures'], {cwd: root, encoding: 'utf8'}));

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
    const types = {'.css': 'text/css; charset=utf-8', '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.json': 'application/json'};
    response.setHeader('Content-Type', types[path.extname(file)] || 'application/octet-stream');
    response.end(fs.readFileSync(file));
});

async function render(page, key, viewer = 'p0') {
    const view = structuredClone(views[key]);
    view.you = viewer;
    await page.evaluate(async ({view}) => {
        socket.connected = true;
        playerId = view.you;
        roomSessionReady = true;
        const room = {
            room_id: 'patchwork-browser-qa',
            game_type: 'patchwork',
            status: view.game_over ? 'game_over' : 'in_game',
            host_id: 'p0',
            players: view.players.map(player => ({...player, ready: true, connected: true})),
            game_config: {},
        };
        renderRoomState(room);
        lastGameStatePayload = {room_id: room.room_id, game_type: room.game_type, view};
        renderGameState(lastGameStatePayload);
        setRoomControlsCollapsed(true);
    }, {view});
}

async function bounds(page, label) {
    const result = await page.evaluate(() => {
        const rootNode = document.querySelector('#patchworkPanel');
        const nodes = [...rootNode.querySelectorAll('*')].filter(node => {
            if (!node.checkVisibility()) return false;
            if (node.closest('.patchwork-market-mobile')) return false;
            const rect = node.getBoundingClientRect();
            const style = getComputedStyle(node);
            return rect.width && rect.height && style.display !== 'contents' &&
                (rect.left < -1 || rect.right > innerWidth + 1 ||
                (node.clientWidth && node.scrollWidth > node.clientWidth + 1 && !['auto', 'hidden'].includes(style.overflowX)));
        }).map(node => `${node.id || node.className}: ${node.clientWidth}/${node.scrollWidth}`);
        const sections = [...rootNode.querySelectorAll('.patchwork-main-column, .patchwork-side-column, .patchwork-action-strip')]
            .map(node => node.getBoundingClientRect());
        const overlaps = sections.flatMap((first, index) => sections.slice(index + 1).filter(second =>
            Math.min(first.right, second.right) - Math.max(first.left, second.left) > 1 &&
            Math.min(first.bottom, second.bottom) - Math.max(first.top, second.top) > 1));
        return {width: innerWidth, scrollWidth: document.documentElement.scrollWidth, issues: nodes, overlaps: overlaps.length};
    });
    assert(result.scrollWidth <= result.width, `${label}: page overflow ${JSON.stringify(result)}`);
    assert.deepEqual(result.issues, [], `${label}: element overflow`);
    assert.equal(result.overlaps, 0, `${label}: section overlap`);
}

(async () => {
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    let browser;
    try {
        browser = await chromium.launch({channel: process.env.BROWSER_CHANNEL || 'chrome', headless: true});
        const page = await browser.newPage({viewport: {width: 1440, height: 1000}, hasTouch: true});
        const errors = [];
        page.on('pageerror', error => errors.push(error.message));
        await page.route('https://fonts.googleapis.com/**', route => route.abort());
        await page.goto(`http://127.0.0.1:${server.address().port}`);
        await page.waitForFunction(() => typeof socket !== 'undefined');
        await page.evaluate(async () => {
            socket.disconnect();
            socket.connected = true;
            await ensureGameAssets('patchwork');
            window.patchworkQaActions = [];
            sendAction = action => window.patchworkQaActions.push(action);
        });

        for (const width of [320, 390, 1024, 1440]) {
            await page.setViewportSize({width, height: width < 600 ? 844 : 1000});
            await render(page, 'start');
            await bounds(page, `${width} start`);
            await page.locator('#patchworkPanel').screenshot({path: path.join(output, `${width}-start.png`)});
            assert.equal(await page.locator('.patchwork-market-card').count(), 33);
            assert.equal(await page.locator('.patchwork-market-card.selectable').count(), 3);
            assert.equal(await page.locator('#patchworkYourBoard .patchwork-board-cell').count(), 81);
            assert.equal(await page.locator('#patchworkMarketMobile').evaluate(node => getComputedStyle(node).overflowX), 'auto');
        }

        await render(page, 'start');
        await page.locator('#patchworkHelpBtn').click();
        assert.equal(await page.locator('#patchworkHelpModal').evaluate(node => !node.classList.contains('hidden')), true);
        assert.match(await page.locator('#patchworkHelpContent').innerText(), /Advance/);
        await page.keyboard.press('Escape');
        assert.equal(await page.locator('#patchworkHelpModal').evaluate(node => node.classList.contains('hidden')), true);

        await page.locator('#patchworkExplainBtn').click();
        assert.equal(await page.locator('#patchworkMarketMobile [data-patchwork-explain]').first().evaluate(node => node.classList.contains('has-explanation')), true);
        await page.locator('#patchworkAdvanceBtn').click();
        assert.equal(await page.evaluate(() => window.patchworkQaActions.length), 0);
        await page.locator('#patchworkAdvanceBtn').dispatchEvent('pointerdown');
        assert.equal(await page.locator('#patchworkExplainModal').evaluate(node => !node.classList.contains('hidden')), true);
        await page.keyboard.press('Escape');

        await page.locator('.patchwork-market-card.selectable').first().click();
        assert.equal(await page.locator('#patchworkTransformActions').evaluate(node => !node.hidden), true);
        await page.locator('#patchworkYourBoard .patchwork-board-cell').first().click();
        await bounds(page, 'placement preview');
        assert.equal(await page.locator('.patchwork-placement-actions').evaluate(node => !node.hidden), true);
        await page.locator('#patchworkRotateBtn').click();
        await page.locator('#patchworkFlipBtn').click();
        await page.locator('#patchworkConfirmBuyBtn').click();
        assert.equal(await page.evaluate(() => window.patchworkQaActions.length), 1);
        await page.evaluate(() => { window.patchworkQaActions.length = 0; });
        await page.locator('#patchworkYourBoard .patchwork-board-cell').nth(80).click();
        assert.equal(await page.locator('#patchworkConfirmBuyBtn').isDisabled(), true);
        await page.keyboard.press('Escape');
        assert.equal(await page.locator('.patchwork-placement-actions').evaluate(node => node.hidden), true);

        await render(page, 'bonus_patch');
        await bounds(page, 'bonus patch');
        assert.equal(await page.locator('.patchwork-board-cell.bonus-target').count(), 81);
        await page.locator('#patchworkYourBoard .patchwork-board-cell').first().click();
        assert.deepEqual(await page.evaluate(() => window.patchworkQaActions.at(-1)), {type: 'place_bonus_patch', x: 0, y: 0});

        await render(page, 'game_over');
        await bounds(page, 'game over');
        assert.match(await page.locator('#patchworkNotice').innerText(), /GAME OVER/);
        assert.equal(await page.locator('#patchworkAdvanceBtn').isDisabled(), true);
        assert.equal(await page.locator('.patchwork-player-card').count(), 2);
        assert.deepEqual(errors, []);
        console.log(`Patchwork UI QA passed at 320, 390, 1024, 1440 px`);
    } finally {
        await browser?.close();
        await new Promise(resolve => server.close(resolve));
    }
})().catch(error => {
    console.error(error.stack || error);
    process.exitCode = 1;
});
