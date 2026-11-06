const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const root = path.resolve(__dirname, '..');
const output = path.join(root, 'build/project-l-ui');
const views = JSON.parse(execFileSync(process.env.PYTHON || 'python3', ['-m', 'tests.project_l_fixtures'], { cwd: root, encoding: 'utf8' }));
fs.mkdirSync(output, { recursive: true });
const server = http.createServer((request, response) => {
    const url = new URL(request.url, 'http://localhost');
    if (url.pathname === '/api/games') {
        response.setHeader('Content-Type', 'application/json');
        response.end(JSON.stringify([{ game_id: 'project_l', name: 'Project L', min_players: 2, max_players: 4 }]));
        return;
    }
    const file = path.resolve(root, url.pathname === '/' ? 'static/index.html' : `.${decodeURIComponent(url.pathname)}`);
    if (!file.startsWith(root + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) {
        response.writeHead(404).end();
        return;
    }
    response.setHeader('Content-Type', ({ '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.svg': 'image/svg+xml' })[path.extname(file)] || 'application/octet-stream');
    response.end(fs.readFileSync(file));
});

async function render(page, name, { reset = true, view = views[name] } = {}) {
    await page.evaluate(({ view, reset }) => {
        socket.connected = true;
        roomSessionReady = true;
        playerId = view.you;
        if (reset) {
            clearProjectLState();
            window.projectLQaActions.length = 0;
        }
        const room = { room_id: 'project-l-browser-qa', game_type: 'project_l', status: view.game_over ? 'game_over' : 'in_game', host_id: 'p0', players: view.players.map(player => ({ ...player, ready: true, connected: true })), game_config: {} };
        renderRoomState(room);
        lastGameStatePayload = { room_id: room.room_id, game_type: room.game_type, view };
        renderGameState(lastGameStatePayload);
        setRoomControlsCollapsed(true);
    }, { view, reset });
}

async function bounds(page, label) {
    const result = await page.evaluate(() => {
        const nodes = [...document.querySelectorAll('#projectLPanel *, .project-l-modal:not(.hidden) *, .game-panel[data-game-theme="project_l"] > .panel-header *')];
        const issues = nodes.filter(node => {
            if (!node.checkVisibility() || node.closest('.room-controls-layer')) return false;
            const box = node.getBoundingClientRect();
            const style = getComputedStyle(node);
            return box.width && box.height && style.display !== 'contents' && (box.left < -1 || box.right > innerWidth + 1 ||
                node.clientWidth && node.scrollWidth > node.clientWidth + 1 && !['auto', 'hidden', 'clip'].includes(style.overflowX));
        }).map(node => `${node.id || node.className}: ${node.clientWidth}/${node.scrollWidth}`);
        const sections = [...document.querySelectorAll('.project-l-workspace, .project-l-market, .project-l-secondary')].map(node => node.getBoundingClientRect());
        const overlaps = sections.flatMap((first, index) => sections.slice(index + 1).filter(second =>
            Math.min(first.right, second.right) - Math.max(first.left, second.left) > 1 &&
            Math.min(first.bottom, second.bottom) - Math.max(first.top, second.top) > 1)).length;
        const shapes = [...document.querySelectorAll('.project-l-puzzle-grid, .project-l-piece-grid, .project-l-mini-grid')].filter(node => {
            if (!node.checkVisibility()) return false;
            const box = node.getBoundingClientRect();
            const parent = node.parentElement.getBoundingClientRect();
            return box.left < parent.left - 1 || box.right > parent.right + 1 || box.top < parent.top - 1 || box.bottom > parent.bottom + 1;
        }).map(node => node.className);
        const header = document.querySelector('.game-panel > .panel-header').getBoundingClientRect();
        const reconnect = document.getElementById('gameReconnectBtn').getBoundingClientRect();
        const help = document.getElementById('projectLHelpBtn').getBoundingClientRect();
        return { width: innerWidth, scrollWidth: document.documentElement.scrollWidth, issues, overlaps, shapes, headerHeight: header.height, headerAligned: Math.abs(help.top - reconnect.top) < 12 };
    });
    assert(result.scrollWidth <= result.width, `${label}: document overflow ${JSON.stringify(result)}`);
    assert.deepEqual(result.issues, [], `${label}: element overflow`);
    assert.equal(result.overlaps, 0, `${label}: section overlap`);
    assert.deepEqual(result.shapes, [], `${label}: shape clipping`);
    assert(result.headerAligned, `${label}: header wrapped ${JSON.stringify(result)}`);
}

const actions = page => page.evaluate(() => window.projectLQaActions);
const piece = (page, pieceId) => page.locator(`#projectLInventory [data-piece-id="${pieceId}"]`);
const square = (page, cardId, row, column) => page.locator(`[data-project-l-key="cell-${cardId}-${row}-${column}"]`);

async function swipe(page, locator) {
    await locator.scrollIntoViewIfNeeded();
    const box = await locator.boundingBox();
    const session = await page.context().newCDPSession(page);
    const point = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
    await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ ...point, id: 1 }] });
    for (const distance of [12, 24, 48, 72]) await session.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: point.x, y: point.y - distance, id: 1 }] });
    await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await session.detach();
    await page.waitForTimeout(350);
}

(async () => {
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    let browser;
    try {
        browser = await chromium.launch({ channel: process.env.BROWSER_CHANNEL || 'chrome', headless: true });
        const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, hasTouch: true });
        page.setDefaultTimeout(8000);
        const errors = [];
        page.on('pageerror', error => errors.push(error.message));
        await page.route('https://fonts.googleapis.com/**', route => route.abort());
        await page.goto(`http://127.0.0.1:${server.address().port}`);
        await page.waitForFunction(() => typeof socket !== 'undefined');
        assert.equal(await page.locator('#projectLPanel').evaluate(node => node.children.length), 0);
        assert.equal(await page.locator('script[src*="games/project_l.js"]').count(), 0);
        await page.evaluate(async () => {
            socket.disconnect();
            socket.connected = true;
            await ensureGameAssets('project_l');
            window.projectLQaActions = [];
            sendAction = action => window.projectLQaActions.push(action);
        });
        for (const width of [320, 390, 1024, 1440]) {
            await page.setViewportSize({ width, height: width < 600 ? 844 : 1000 });
            for (const name of Object.keys(views)) {
                await render(page, name);
                await bounds(page, `${width} ${name}`);
                assert.equal(await page.locator('.game-panel-title h2').innerText(), 'Project L');
            }
            await render(page, 'full');
            await page.screenshot({ path: path.join(output, `${width}-full.png`), fullPage: true });
            await page.locator('.project-l-details').last().locator('summary').click();
            await bounds(page, `${width} completed expanded`);
            await page.locator('.project-l-details').last().locator('summary').click();
            await page.locator('#projectLHelpBtn').click();
            await bounds(page, `${width} Help`);
            await page.keyboard.press('Escape');
            assert(await page.locator('#projectLHelpModal').isHidden());
            assert(await page.locator('#projectLHelpBtn').evaluate(node => node === document.activeElement));
            await piece(page, 'L3_V').click();
            await page.locator('#projectLUpgradeBtn').click();
            await bounds(page, `${width} upgrade`);
            assert.equal(await page.locator('#projectLUpgradeOptions button').count(), 6);
            await page.keyboard.press('Escape');
            await render(page, 'placement');
            await page.locator('#projectLMarketWhite .project-l-card-face').first().click();
            await bounds(page, `${width} market confirmation`);
            assert.equal((await actions(page)).length, 0);
            await page.locator('#projectLCancelMarketBtn').click();
            assert(await page.locator('#projectLMarketConfirmation').isHidden());
            await piece(page, 'L2_I').click();
            await square(page, 1, 0, 0).click();
            await bounds(page, `${width} placement confirmation`);
            assert.equal(await page.locator('#projectLPlaceBtn').isEnabled(), true);
            await page.screenshot({ path: path.join(output, `${width}-placement.png`), fullPage: true });
            await page.locator('#projectLPlaceBtn').click();
            assert.deepEqual((await actions(page)).at(-1), { type: 'place_piece', puzzle_index: 0, piece_id: 'L2_I', row: 0, col: 0, rotation: 0, flip: false });
        }
        await page.setViewportSize({ width: 390, height: 844 });
        await render(page, 'placement');
        await page.locator('#projectLMarketWhite .project-l-card-face').first().dblclick();
        assert.equal((await actions(page)).length, 0);
        await page.waitForTimeout(320);
        await page.locator('#projectLTakeMarketBtn').click();
        assert.deepEqual((await actions(page)).at(-1), { type: 'take_puzzle', source: 'market', deck: 'white', index: 0 });

        await render(page, 'placement');
        await piece(page, 'L1_I').click();
        await square(page, 1, 0, 0).click();
        await page.locator('#projectLQueueMasterBtn').click();
        assert(await square(page, 1, 0, 0).isDisabled());
        assert.equal(await page.locator('#projectLMasterQueue .project-l-queue-item').count(), 1);
        await square(page, 2, 0, 0).click();
        await page.locator('#projectLQueueMasterBtn').click();
        assert(await piece(page, 'L1_I').isDisabled());
        await page.locator('#projectLUseMasterBtn').click();
        const master = (await actions(page)).at(-1);
        assert.equal(master.type, 'master_action');
        assert.equal(master.placements.length, 2);
        assert(master.placements.every(entry => !Object.hasOwn(entry, 'cardId')));

        await render(page, 'placement');
        await piece(page, 'L1_I').click();
        await square(page, 1, 0, 0).click();
        await page.locator('#projectLQueueMasterBtn').click();
        const opponentUpdate = structuredClone(views.placement);
        opponentUpdate.players[1].name = 'Updated opponent';
        await render(page, 'placement', { reset: false, view: opponentUpdate });
        assert.equal(await page.locator('#projectLMasterQueue .project-l-queue-item').count(), 1);
        await page.locator('#projectLMasterQueue button').click();
        assert.equal(await piece(page, 'L1_I').innerText().then(text => text.includes('×2')), true);
        await square(page, 1, 0, 0).click();
        await page.locator('#projectLQueueMasterBtn').click();
        await render(page, 'waiting', { reset: false });
        assert(await page.locator('#projectLMasterSection').isHidden());
        assert.equal(await page.locator('#projectLActivePuzzles .queued').count(), 0);

        await render(page, 'blank_origin');
        await piece(page, 'L3_V').click();
        await page.locator('#projectLRotateRightBtn').click();
        await page.locator('#projectLRotateRightBtn').click();
        const blankCardId = views.blank_origin.players[0].active_puzzles[0].card_id;
        assert(await square(page, blankCardId, 0, 0).evaluate(node => node.classList.contains('off-origin')));
        await square(page, blankCardId, 0, 0).click();
        assert(await page.locator('#projectLPlaceBtn').isEnabled());
        await page.locator('#projectLPlaceBtn').click();
        assert.deepEqual((await actions(page)).at(-1), { type: 'place_piece', puzzle_index: 0, piece_id: 'L3_V', row: 0, col: 0, rotation: 180, flip: false });

        await render(page, 'occupied');
        await piece(page, 'L2_I').click();
        await square(page, 1, 0, 0).click();
        assert(await page.locator('#projectLPlaceBtn').isDisabled());
        assert(await page.locator('#projectLActivePuzzles .invalid').count() > 0);
        await page.locator('#projectLExplainBtn').click();
        const disabled = await page.locator('#projectLPlaceBtn').boundingBox();
        await page.mouse.click(disabled.x + disabled.width / 2, disabled.y + disabled.height / 2);
        assert(await page.locator('#projectLExplainModal').isVisible());
        assert.equal((await actions(page)).length, 0);
        assert.equal(await page.locator('#projectLExplainBtn').getAttribute('aria-pressed'), 'false');
        await page.keyboard.press('Escape');

        await render(page, 'placement');
        await page.locator('#projectLExplainBtn').click();
        await page.locator('#projectLTakeLevel1Btn').click();
        assert(await page.locator('#projectLExplainModal').isVisible());
        assert.equal((await actions(page)).length, 0);
        await page.keyboard.press('Escape');
        await page.locator('#projectLExplainBtn').click();
        await page.locator('#projectLMarketWhite .project-l-card-face').first().click();
        assert(await page.locator('#projectLExplainModal').isVisible());
        assert(await page.locator('#projectLMarketConfirmation').isHidden());
        await page.keyboard.press('Escape');
        await page.locator('#projectLExplainBtn').click();
        const collapsed = await page.locator('.project-l-details').last().getAttribute('open');
        await page.locator('.project-l-details').last().locator('summary').click();
        assert.equal(await page.locator('.project-l-details').last().getAttribute('open'), collapsed);
        assert.equal(await page.locator('#projectLExplainBtn').getAttribute('aria-pressed'), 'true');
        await page.keyboard.press('Escape');

        await render(page, 'placement');
        await piece(page, 'L3_V').click();
        await square(page, 1, 0, 0).click();
        const original = await page.locator('#projectLActivePuzzles .ghost').evaluateAll(nodes => nodes.map(node => `${node.dataset.row},${node.dataset.column}`));
        for (let turn = 0; turn < 4; turn += 1) await page.locator('#projectLPlacementRotateRightBtn').click();
        assert.deepEqual(await page.locator('#projectLActivePuzzles .ghost').evaluateAll(nodes => nodes.map(node => `${node.dataset.row},${node.dataset.column}`)), original);
        await page.locator('#projectLPlacementFlipBtn').click();
        await page.locator('#projectLPlacementFlipBtn').click();
        assert.deepEqual(await page.locator('#projectLActivePuzzles .ghost').evaluateAll(nodes => nodes.map(node => `${node.dataset.row},${node.dataset.column}`)), original);
        await page.keyboard.press('Escape');
        assert.equal(await page.locator('#projectLInventory .selected').count(), 0);

        await render(page, 'placement');
        await swipe(page, piece(page, 'L1_I'));
        assert.equal(await page.locator('#projectLInventory .selected').count(), 0);
        await swipe(page, page.locator('#projectLMarketWhite .project-l-card-face').first());
        assert(await page.locator('#projectLMarketConfirmation').isHidden());
        assert.equal((await actions(page)).length, 0);
        await piece(page, 'L1_I').tap();
        await swipe(page, square(page, 1, 0, 0));
        assert(await page.locator('#projectLPlacementConfirmation').isHidden());
        await page.locator('.project-l-workspace h3').first().click();
        assert.equal(await page.locator('#projectLInventory .selected').count(), 0);
        await page.locator('[data-project-l-tip]').first().tap();
        assert(await page.locator('#projectLTooltip').isVisible());
        await page.locator('[data-project-l-tip]').nth(1).tap();
        assert.match(await page.locator('#projectLTooltip').innerText(), /Master Action/);
        await page.waitForTimeout(3100);
        assert(await page.locator('#projectLTooltip').isHidden());
        await piece(page, 'L1_I').tap();
        assert(await page.locator('#projectLTooltip').isHidden());

        await render(page, 'full');
        await page.locator('.project-l-details').last().locator('summary').click();
        await page.locator('#projectLPlayers').evaluate(node => { node.scrollTop = 80; });
        await page.evaluate(() => scrollTo(0, 150));
        const beforeScroll = await page.evaluate(() => ({ page: scrollY, players: document.getElementById('projectLPlayers').scrollTop }));
        await page.locator('#projectLInventory [data-piece-id="L4_I"]').evaluate(node => node.click());
        assert.deepEqual(await page.evaluate(() => ({ page: scrollY, players: document.getElementById('projectLPlayers').scrollTop })), beforeScroll);
        await page.locator('.project-l-details').last().locator('summary').click();

        for (const width of [320, 390, 768, 1024, 1440]) {
            await page.setViewportSize({ width, height: 1000 });
            await render(page, 'full');
            await page.evaluate(() => setRoomControlsCollapsed(false));
            await bounds(page, `${width} expanded Room Control`);
            await page.evaluate(() => setRoomControlsCollapsed(true));
        }
        await page.setViewportSize({ width: 390, height: 844 });

        await render(page, 'waiting');
        await piece(page, 'L1_I').click();
        assert(await page.locator('#projectLUpgradeBtn').isDisabled());
        assert(await page.locator('#projectLTakeLevel1Btn').isDisabled());
        assert.equal(await page.locator('body').evaluate(node => node.classList.contains('project-l-turn-active')), false);
        await render(page, 'finishing');
        await piece(page, 'L1_I').click();
        await square(page, 1, 0, 0).click();
        await page.locator('#projectLFinishingPlaceBtn').click();
        assert.equal((await actions(page)).at(-1).type, 'finishing_place');
        await page.locator('#projectLFinishingDoneBtn').click();
        assert.equal((await actions(page)).at(-1).type, 'finishing_done');
        await render(page, 'game_over');
        assert.match(await page.locator('#projectLWinner').innerText(), /Alex/);
        assert.match(await page.locator('#projectLPlayers .project-l-player').first().innerText(), /★ 16/);
        assert.equal(await page.evaluate(() => window.projectLInjected), undefined);
        await page.evaluate(() => showProjectLHeaderActions(false));
        assert.equal(await page.locator('body').evaluate(node => node.classList.contains('project-l-turn-active')), false);
        assert.equal(await page.evaluate(() => typeof window.findButtonAtPoint), 'undefined');
        assert.equal(await page.evaluate(() => typeof window.updateExplainModeClasses), 'undefined');
        assert.deepEqual(errors, []);
        console.log(`Project L browser checks passed: 320, 390, 1024, 1440 px; ${Object.keys(views).length} states; actions, previews, Master plan, Help/Explain, touch and results.`);
    } finally {
        await browser?.close();
        await new Promise(resolve => server.close(resolve));
    }
})().catch(error => { console.error(error); process.exitCode = 1; });
