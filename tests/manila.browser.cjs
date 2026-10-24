const {chromium} = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const {execFileSync} = require('node:child_process');

const root = path.resolve(__dirname, '..');
const output = path.join(root, 'build/manila-ui');
const views = JSON.parse(execFileSync(process.env.PYTHON || 'python', ['-m', 'tests.manila_fixtures'], {cwd: root, encoding: 'utf8'}));
fs.mkdirSync(output, {recursive: true});
const server = http.createServer((request, response) => {
    const url = new URL(request.url, 'http://localhost');
    if (url.pathname === '/api/games') {
        response.setHeader('Content-Type', 'application/json');
        response.end(JSON.stringify([{game_id: 'manila', name: 'Manila', min_players: 3, max_players: 5}]));
        return;
    }
    const file = path.resolve(root, url.pathname === '/' ? 'static/index.html' : `.${decodeURIComponent(url.pathname)}`);
    if (!file.startsWith(root + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) {
        response.writeHead(404).end();
        return;
    }
    response.setHeader('Content-Type', ({'.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8'})[path.extname(file)] || 'application/octet-stream');
    response.end(fs.readFileSync(file));
});

async function render(page, name, {reset = true, view = views[name], config = {}} = {}) {
    await page.evaluate(({view, reset, config}) => {
        socket.connected = true;
        if (reset) clearManilaState();
        playerId = view.you;
        roomSessionReady = true;
        const room = {room_id: 'manila-browser-qa', game_type: 'manila', status: view.game_over ? 'game_over' : 'in_game', host_id: 'p0', players: view.players.map(player => ({...player, ready: true, connected: true})), game_config: config};
        renderRoomState(room);
        lastGameStatePayload = {room_id: room.room_id, game_type: 'manila', view};
        renderGameState(lastGameStatePayload);
        setRoomControlsCollapsed(true);
    }, {view, reset, config});
}

async function actionCount(page) { return page.evaluate(() => window.manilaQaActions.length); }
async function lastAction(page) { return page.evaluate(() => window.manilaQaActions.at(-1)); }
async function bounds(page, label) {
    const result = await page.evaluate(() => {
        const nodes = [...document.querySelectorAll('#manilaPanel *, .manila-dialog[open] *, .game-panel[data-game-theme="manila"] > .panel-header *')];
        const issues = nodes.filter(node => {
            if (!node.checkVisibility()) return false;
            const rect = node.getBoundingClientRect();
            const style = getComputedStyle(node);
            if (!rect.width || !rect.height || style.display === 'contents') return false;
            return rect.left < -1 || rect.right > innerWidth + 1 ||
                (node.clientWidth && node.scrollWidth > node.clientWidth + 1 && !['auto', 'hidden'].includes(style.overflowX));
        }).map(node => `${node.id || node.className} (${node.clientWidth}/${node.scrollWidth}): ${node.textContent.slice(0, 45)}`);
        const panels = [...document.querySelectorAll('.manila-waterfront, .manila-action-panel, .manila-facilities')].map(node => node.getBoundingClientRect());
        const overlaps = panels.flatMap((first, index) => panels.slice(index + 1).filter(second =>
            Math.min(first.right, second.right) - Math.max(first.left, second.left) > 1 &&
            Math.min(first.bottom, second.bottom) - Math.max(first.top, second.top) > 1));
        return {width: innerWidth, scrollWidth: document.documentElement.scrollWidth, issues, overlaps: overlaps.length};
    });
    assert(result.scrollWidth <= result.width, `${label}: page overflow ${JSON.stringify(result)}`);
    assert.deepEqual(result.issues, [], `${label}: element overflow`);
    assert.equal(result.overlaps, 0, `${label}: section overlap`);
}

async function blank(page) {
    await page.locator('#manilaSeaTitle').click();
    assert.equal(await page.locator('.manila-confirm').count(), 0);
}

async function dismissExplanation(page) {
    await page.keyboard.press('Escape');
    await page.waitForFunction(() => !document.getElementById('manilaExplainModal').open);
    await page.waitForTimeout(680);
}

async function swipe(page, locator) {
    await locator.scrollIntoViewIfNeeded();
    const rect = await locator.boundingBox();
    const session = await page.context().newCDPSession(page);
    const position = {x: rect.x + rect.width / 2, y: rect.y + rect.height / 2};
    await session.send('Input.dispatchTouchEvent', {type: 'touchStart', touchPoints: [{...position, id: 1}]});
    for (const distance of [12, 28, 48, 72]) {
        await session.send('Input.dispatchTouchEvent', {type: 'touchMove', touchPoints: [{x: position.x, y: position.y - distance, id: 1}]});
    }
    await session.send('Input.dispatchTouchEvent', {type: 'touchEnd', touchPoints: []});
    await session.detach();
    await page.waitForTimeout(750);
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
        assert.equal(await page.locator('#manilaPanel').evaluate(node => node.children.length), 0);
        assert.equal(await page.locator('script[src*="games/manila.js"]').count(), 0);
        await page.evaluate(async () => {
            socket.disconnect();
            socket.connected = true;
            await ensureGameAssets('manila');
            window.manilaQaActions = [];
            sendAction = action => window.manilaQaActions.push(action);
        });
        await render(page, 'placement');
        assert.match(await page.locator('.game-panel-title h2').innerText(), /Manila/);
        assert.equal(await page.locator('#manilaPanel .manila-ship').count(), 3);
        assert.equal(await page.locator('#manilaPanel .manila-market-card').count(), 4);
        assert.equal(await page.locator('#manilaCycleModal').count(), 0);
        assert.equal(await page.evaluate(() => typeof window.getCargoMeta), 'undefined');
        assert.equal(await page.evaluate(() => document.body.classList.contains('manila-turn-active')), true);
        await page.locator('#manilaHelpBtn').click();
        assert.equal(await page.locator('#manilaHelpModal').evaluate(node => node.open), true);
        assert.match(await page.locator('#manilaHelpBody').innerText(), /Next Round/);
        await bounds(page, 'Help desktop');
        await page.keyboard.press('Escape');
        assert.equal(await page.locator('#manilaHelpModal').evaluate(node => node.open), false);
        assert.equal(await page.locator('#manilaHelpBtn').evaluate(node => document.activeElement === node), true);

        let count = await actionCount(page);
        await page.locator('[data-manila-op="seat"][data-cargo="nutmeg"]').first().click();
        assert.equal(await actionCount(page), count);
        assert.equal(await page.locator('.manila-ship[data-cargo="nutmeg"] .manila-confirm').count(), 1);
        await page.locator('[data-manila-op="cancel"]').click();
        assert.equal(await page.locator('.manila-confirm').count(), 0);
        await page.locator('[data-manila-op="seat"][data-cargo="nutmeg"]').first().click();
        await blank(page);
        await page.locator('[data-manila-op="seat"][data-cargo="nutmeg"]').first().click();
        await page.locator('[data-manila-op="confirm"]').click();
        assert.deepEqual(await lastAction(page), {type: 'place_worker', location: {type: 'ship', cargo: 'nutmeg', seat: 1}});
        assert.equal(await page.locator('[data-manila-op="pass"]').isDisabled(), true);
        await render(page, 'placement', {reset: false});
        assert.equal(await page.locator('[data-manila-op="pass"]').isDisabled(), true);
        await page.evaluate(() => socket.emitEvent(['system:error', {message: 'slot occupied'}]));
        assert.equal(await page.locator('[data-manila-op="pass"]').isDisabled(), false);
        assert.match(await page.locator('#manilaError').innerText(), /slot occupied/);

        for (const [type, slot, location] of [
            ['port', 'B', {type: 'port', slot: 'B'}], ['shipyard', 'A', {type: 'shipyard', slot: 'A'}],
            ['pilot', 'big', {type: 'pilot', size: 'big'}], ['pilot', 'small', {type: 'pilot', size: 'small'}],
            ['pirate', 'pirate', {type: 'pirate'}], ['insurance', 'broker', {type: 'insurance'}],
        ]) {
            await render(page, 'placement');
            await page.locator(`[data-manila-op="investment"][data-location="${type}"][data-slot="${slot}"]`).click();
            await page.locator('[data-manila-op="confirm"]').click();
            assert.deepEqual(await lastAction(page), {type: 'place_worker', location});
        }
        await render(page, 'placement');
        await page.locator('[data-manila-op="pass"]').click();
        assert.deepEqual(await lastAction(page), {type: 'pass'});

        await render(page, 'auction');
        await page.locator('#manilaBidInput').fill('5.5');
        assert.equal(await page.locator('#manilaBidSubmit').isDisabled(), true);
        await page.locator('#manilaBidInput').fill('10000');
        assert.equal(await page.locator('#manilaBidSubmit').isDisabled(), true);
        await page.locator('#manilaBidInput').fill('8');
        await render(page, 'auction', {reset: false});
        assert.equal(await page.locator('#manilaBidInput').inputValue(), '8');
        await page.locator('#manilaBidSubmit').click();
        assert.deepEqual(await lastAction(page), {type: 'bid', amount: 8});
        await render(page, 'auction');
        await page.locator('[data-manila-op="pass-bid"]').click();
        assert.deepEqual(await lastAction(page), {type: 'pass_bid'});

        await render(page, 'buy');
        count = await actionCount(page);
        await page.locator('[data-manila-op="buy"][data-cargo="nutmeg"]').click();
        assert.equal(await actionCount(page), count);
        assert.equal(await page.locator('#manilaMarket .manila-confirm').count(), 1);
        await page.locator('[data-manila-op="confirm"]').click();
        assert.deepEqual(await lastAction(page), {type: 'buy_stock', cargo: 'nutmeg'});
        await render(page, 'buy');
        await page.locator('[data-manila-op="skip-buy"]').click();
        assert.deepEqual(await lastAction(page), {type: 'skip_buy'});

        await render(page, 'payment', {config: {loan_amount: 9, loan_repay: 13}});
        assert.equal(await page.locator('#manilaFinance').evaluate(node => node.open), true);
        await page.locator('[data-manila-op="pledge"][data-cargo="silk"]').click();
        assert.match(await page.locator('.manila-confirm-note').innerText(), /9.*13/);
        await page.locator('[data-manila-op="confirm"]').click();
        assert.deepEqual(await lastAction(page), {type: 'pledge_stock', cargo: 'silk'});

        await render(page, 'cargo');
        count = await actionCount(page);
        for (const cargo of ['nutmeg', 'ginseng', 'jade']) await page.locator(`[data-manila-op="cargo"][data-cargo="${cargo}"]`).click();
        assert.equal(await page.locator('.manila-ship').count(), 3);
        assert.equal(await page.locator('[data-manila-op="cargo"][data-cargo="silk"]').isDisabled(), true);
        await render(page, 'cargo', {reset: false});
        assert.equal(await page.locator('.manila-market-card.is-selected').count(), 3);
        assert.equal(await actionCount(page), count);
        await page.locator('[data-manila-op="cargo"][data-cargo="jade"]').click();
        assert.equal(await page.locator('[data-manila-op="cargo-confirm"]').isDisabled(), true);
        await page.locator('[data-manila-op="cargo"][data-cargo="jade"]').click();
        await page.locator('[data-manila-op="cargo-confirm"]').click();
        assert.deepEqual(await lastAction(page), {type: 'select_cargo', cargo: ['nutmeg', 'ginseng', 'jade']});

        await render(page, 'positions');
        await page.locator('[data-manila-op="position"][data-cargo="nutmeg"][data-delta="1"]').click();
        assert.equal(await page.locator('[data-manila-op="positions-confirm"]').isDisabled(), true);
        await render(page, 'positions', {reset: false});
        assert.equal(await page.locator('.manila-ship[data-cargo="nutmeg"] output').innerText(), '4');
        await page.locator('[data-manila-op="position"][data-cargo="jade"][data-delta="-1"]').click();
        await page.locator('[data-manila-op="positions-confirm"]').click();
        assert.deepEqual(await lastAction(page), {type: 'set_positions', positions: [4, 3, 2]});

        await render(page, 'pilot_big');
        count = await actionCount(page);
        await page.locator('[data-manila-op="pilot"][data-cargo="nutmeg"][data-delta="1"]').click();
        await page.locator('[data-manila-op="pilot"][data-cargo="ginseng"][data-delta="-1"]').click();
        assert.equal(await actionCount(page), count);
        assert.equal(await page.locator('[data-manila-op="pilot"][data-cargo="jade"][data-delta="1"]').isDisabled(), true);
        await page.locator('[data-manila-op="pilot-confirm"]').click();
        assert.deepEqual(await lastAction(page), {type: 'pilot_split', size: 'big', cargo_a: 'nutmeg', delta_a: 1, cargo_b: 'ginseng', delta_b: -1});
        await render(page, 'pilot_big');
        await page.locator('[data-manila-op="pilot"][data-cargo="jade"][data-delta="1"]').click();
        await page.locator('[data-manila-op="pilot"][data-cargo="jade"][data-delta="1"]').click();
        await page.locator('[data-manila-op="pilot-confirm"]').click();
        assert.deepEqual(await lastAction(page), {type: 'pilot_move', size: 'big', cargo: 'jade', delta: 2});
        await render(page, 'pilot_small');
        await page.locator('[data-manila-op="pilot-confirm"]').click();
        assert.deepEqual(await lastAction(page), {type: 'pilot_move', size: 'small', cargo: 'nutmeg', delta: 0});
        await render(page, 'pilot_waiting');
        assert.equal(await page.locator('[data-manila-op="pilot"]:enabled').count(), 0);

        await render(page, 'pirate_board');
        await page.locator('[data-manila-op="pirate"][data-cargo="nutmeg"]').click();
        await page.locator('[data-manila-op="confirm"]').click();
        assert.deepEqual(await lastAction(page), {type: 'pirate_action', mode: 'board', cargo: 'nutmeg'});
        await render(page, 'pirate_full');
        assert.equal(await page.locator('[data-manila-op="pirate"][data-cargo="nutmeg"]').isDisabled(), true);
        await page.locator('[data-manila-op="pirate-skip"]').click();
        assert.deepEqual(await lastAction(page), {type: 'pirate_action', mode: 'skip'});
        await render(page, 'pirate_plunder');
        assert.equal(await page.locator('[data-manila-op="pirate-skip"]').count(), 0);
        await page.locator('[data-manila-op="pirate"][data-cargo="jade"]').click();
        await page.locator('[data-manila-op="destination"][data-result="shipyard"]').click();
        await page.locator('[data-manila-op="confirm"]').click();
        assert.deepEqual(await lastAction(page), {type: 'pirate_action', mode: 'plunder', cargo: 'jade', result: 'shipyard'});

        await render(page, 'review');
        assert.match(await page.locator('.manila-result-card').first().innerText(), /YOU/);
        count = await actionCount(page);
        await page.locator('[data-manila-op="next-round"]').click();
        assert.equal(await page.locator('.manila-confirm').count(), 0);
        assert.equal(await actionCount(page), count + 1);
        assert.deepEqual(await lastAction(page), {type: 'next_round'});
        await render(page, 'ready', {reset: false});
        assert.equal(await page.locator('[data-manila-op="next-round"]').isDisabled(), true);
        assert.match(await page.locator('#manilaReview').innerText(), /2 \/ 5 Ready/);
        await render(page, 'finished');
        assert.equal(await page.locator('[data-manila-op="next-round"]').count(), 0);
        assert.match(await page.locator('#manilaReview').innerText(), /Calvin.*Sora/);

        await render(page, 'no_cash');
        count = await actionCount(page);
        await page.locator('#manilaExplainBtn').click();
        const disabledSeat = page.locator('[data-manila-op="seat"]').first();
        await disabledSeat.scrollIntoViewIfNeeded();
        const disabledBounds = await disabledSeat.boundingBox();
        await page.mouse.click(disabledBounds.x + disabledBounds.width / 2, disabledBounds.y + disabledBounds.height / 2);
        assert.equal(await actionCount(page), count);
        assert.equal(await page.locator('#manilaExplainModal').evaluate(node => node.open), true);
        assert.match(await page.locator('#manilaExplainBody').innerText(), /船成功入港/);
        assert.equal(await page.evaluate(() => document.body.classList.contains('manila-explaining')), false);
        await dismissExplanation(page);
        await page.locator('#manilaExplainBtn').click();
        await page.keyboard.press('Escape');
        assert.equal(await page.evaluate(() => document.body.classList.contains('manila-explaining')), false);
        await render(page, 'placement');
        count = await actionCount(page);
        await page.locator('#manilaExplainBtn').click();
        await page.evaluate(() => {
            const probe = document.createElement('button');
            probe.id = 'manilaQaUnexplained';
            probe.textContent = 'Unexplained control';
            probe.onclick = () => { window.manilaUnexplainedFired = true; };
            document.getElementById('manilaActionBody').appendChild(probe);
        });
        await page.locator('#manilaQaUnexplained').click();
        assert.equal(await page.evaluate(() => window.manilaUnexplainedFired), undefined);
        await page.keyboard.press('Escape');
        await page.waitForTimeout(680);
        await page.evaluate(() => document.getElementById('manilaQaUnexplained').remove());
        await page.locator('#manilaExplainBtn').click();
        await page.locator('[data-manila-op="pass"]').focus();
        await page.keyboard.press('Enter');
        assert.equal(await page.locator('#manilaExplainModal').evaluate(node => node.open), true);
        assert.equal(await actionCount(page), count);
        await dismissExplanation(page);

        await render(page, 'placement');
        await page.locator('#manilaWallet [data-manila-explain="cash"]').hover();
        assert.equal(await page.locator('#manilaTooltip').isVisible(), true);
        assert.match(await page.locator('#manilaTooltip').innerText(), /现金/);
        await page.locator('[data-manila-op="seat"]').first().hover();
        assert.equal(await page.locator('#manilaTooltip').isVisible(), false);
        await page.evaluate(() => { socket.connected = false; socket.emitEvent(['disconnect']); });
        assert.equal(await page.locator('[data-manila-op="pass"]').isDisabled(), true);
        assert.match(await page.locator('#manilaTurn').innerText(), /Disconnected/);
        await page.evaluate(() => { socket.connected = true; socket.emitEvent(['connect']); });
        assert.equal(await page.locator('[data-manila-op="pass"]').isDisabled(), true);
        await page.evaluate(() => socket.emitEvent(['system:info', {room_id: roomId, player_id: playerId, reconnect_token: 'manila-qa-token'}]));
        assert.equal(await page.locator('[data-manila-op="pass"]').isDisabled(), false);

        for (const width of [320, 390, 1024, 1440]) {
            await page.setViewportSize({width, height: 1000});
            for (const name of Object.keys(views)) {
                await render(page, name);
                await bounds(page, `${width}px ${name}`);
            }
            await render(page, 'long_names');
            await page.locator('#manilaPlayersDetails > summary').click();
            await bounds(page, `${width}px expanded players`);
            assert.equal(await page.evaluate(() => window.manilaInjected), undefined);
            await render(page, 'placement');
            await page.locator('[data-manila-op="seat"]').first().click();
            await bounds(page, `${width}px seat confirmation`);
            await blank(page);
            await page.locator('[data-manila-op="investment"][data-location="port"]').first().click();
            await bounds(page, `${width}px facility confirmation`);
            await blank(page);
            await page.locator('#manilaHelpBtn').click();
            await bounds(page, `${width}px Help`);
            await page.keyboard.press('Escape');
            await render(page, 'review');
            await page.locator('.manila-result-card details').first().locator('summary').click();
            await bounds(page, `${width}px ledger`);
            if (width >= 1024) {
                await render(page, 'placement');
                await page.evaluate(() => setRoomControlsCollapsed(false));
                await bounds(page, `${width}px sidebar expanded`);
                await page.evaluate(() => setRoomControlsCollapsed(true));
            }
        }

        await page.setViewportSize({width: 390, height: 844});
        await render(page, 'cargo');
        count = await actionCount(page);
        await swipe(page, page.locator('[data-manila-op="cargo"]').first());
        assert.equal(await page.locator('.manila-market-card.is-selected').count(), 0);
        assert.equal(await actionCount(page), count);
        await page.locator('[data-manila-op="cargo"]').first().tap();
        assert.equal(await page.locator('.manila-market-card.is-selected').count(), 1);
        await blank(page);
        assert.equal(await page.locator('.manila-market-card.is-selected').count(), 0);
        await render(page, 'placement');
        await page.locator('#manilaWallet [data-manila-explain="cash"]').tap();
        assert.match(await page.locator('#manilaTooltip').innerText(), /现金/);
        await page.locator('#manilaWallet [data-manila-explain="workers"]').tap();
        assert.match(await page.locator('#manilaTooltip').innerText(), /工人/);
        await page.waitForTimeout(3150);
        assert.equal(await page.locator('#manilaTooltip').isVisible(), false);
        await swipe(page, page.locator('[data-manila-op="seat"]').first());
        assert.equal(await page.locator('.manila-confirm').count(), 0);
        await render(page, 'no_cash');
        await page.locator('#manilaExplainBtn').tap();
        await swipe(page, page.locator('[data-manila-op="seat"]').first());
        assert.equal(await page.locator('#manilaExplainModal').evaluate(node => node.open), false);
        assert.equal(await page.evaluate(() => document.body.classList.contains('manila-explaining')), true);
        const touchDisabled = page.locator('[data-manila-op="seat"]').first();
        await touchDisabled.scrollIntoViewIfNeeded();
        const touchBounds = await touchDisabled.boundingBox();
        await page.touchscreen.tap(touchBounds.x + touchBounds.width / 2, touchBounds.y + touchBounds.height / 2);
        assert.equal(await page.locator('#manilaExplainModal').evaluate(node => node.open), true);
        await bounds(page, '390px touch Explain');
        await dismissExplanation(page);
        await render(page, 'pilot_big');
        const lowerPilot = page.locator('[data-manila-op="pilot"][data-cargo="jade"][data-delta="1"]');
        await lowerPilot.scrollIntoViewIfNeeded();
        const scrollBefore = await page.evaluate(() => scrollY);
        await lowerPilot.tap();
        assert(Math.abs(await page.evaluate(() => scrollY) - scrollBefore) < 5, 'Pilot selection must not jump to the top');
        await render(page, 'placement');
        await page.locator('[data-manila-op="seat"]').first().tap();
        assert.equal(await page.locator('.manila-confirm').count(), 1);
        assert.equal(await page.locator('#manilaTooltip').isVisible(), false);
        await bounds(page, '390px touch confirmation');
        await page.screenshot({path: path.join(output, 'mobile-confirm.png'), fullPage: true});
        await blank(page);
        await render(page, 'placement');
        await page.evaluate(() => scrollTo(0, 0));
        await page.screenshot({path: path.join(output, 'mobile-390.png'), fullPage: true});
        await page.setViewportSize({width: 320, height: 780});
        await render(page, 'placement');
        await page.screenshot({path: path.join(output, 'mobile-320.png'), fullPage: true});
        await page.setViewportSize({width: 1440, height: 1000});
        await render(page, 'placement');
        await page.mouse.move(1400, 20);
        await page.screenshot({path: path.join(output, 'desktop-1440.png'), fullPage: true});
        await render(page, 'review');
        await page.screenshot({path: path.join(output, 'desktop-review.png'), fullPage: true});
        await page.evaluate(() => {
            currentGameType = 'cabo';
            setGamePanelVisibility('cabo');
        });
        assert.equal(await page.locator('#manilaPanel').isVisible(), false);
        assert.equal(await page.evaluate(() => document.body.classList.contains('manila-turn-active')), false);
        assert.equal(await page.locator('.manila-dialog[open]').count(), 0);
        assert.deepEqual(errors, []);
        console.log(`PASS: Manila ${Object.keys(views).length} states × 4 widths; auction, stocks, cargo, positions, all placements, pilots, pirates, pledges, ready barrier, Help/Explain, touch, errors, reconnect and lazy loading.`);
    } finally {
        await browser?.close();
        await new Promise(resolve => server.close(resolve));
    }
})().catch(error => { console.error(error); process.exitCode = 1; });
