// Run from the repository root. PYTHON and PLAYWRIGHT_MODULE may select runtimes.
const {chromium} = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const assert = require('node:assert/strict');
const {execFileSync} = require('node:child_process');
const root = path.resolve(__dirname, '..');
const python = process.env.PYTHON || 'python';
const views = JSON.parse(execFileSync(python, ['-m', 'tests.las_vegas_royale_fixtures'], {cwd: root, encoding: 'utf8'}));
const output = path.join(root, 'build/las-vegas-royale-qa');
fs.mkdirSync(output, {recursive: true});
const server = http.createServer((req, res) => {
    const url = new URL(req.url, 'http://localhost');
    if (url.pathname === '/api/games') {
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify([{game_id: 'las_vegas', name: 'Las Vegas', min_players: 2, max_players: 5}]));
        return;
    }
    const file = path.resolve(root, url.pathname === '/' ? 'static/index.html' : `.${decodeURIComponent(url.pathname)}`);
    if (!file.startsWith(root + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) { res.writeHead(404).end(); return; }
    res.setHeader('Content-Type', ({'.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css'})[path.extname(file)] || 'application/octet-stream');
    res.end(fs.readFileSync(file));
});
async function render(page, key) {
    await page.evaluate(({view, key}) => {
        playerId = view.you;
        roomSessionReady = true;
        const room = {room_id: `royale-${key}`, game_type: 'las_vegas', status: 'in_game', players: view.players, host_id: 'p0', game_config: view.config};
        renderRoomState(room);
        renderGameState({room_id: room.room_id, game_type: 'las_vegas', view});
    }, {view: views[key], key});
}
async function lastAction(page) { return page.evaluate(() => vegasActions.at(-1)); }
(async () => {
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    let browser;
    try {
        browser = await chromium.launch({channel: process.env.BROWSER_CHANNEL || 'chrome', headless: true});
        const page = await browser.newPage({viewport: {width: 1280, height: 1000}});
        const errors = [];
        page.on('pageerror', error => errors.push(error.message));
        await page.route('https://fonts.googleapis.com/**', route => route.abort());
        await page.goto(`http://127.0.0.1:${server.address().port}`);
        await page.waitForFunction(() => typeof socket !== 'undefined');
        await page.evaluate(async () => {
            socket.disconnect();
            await ensureGameAssets('las_vegas');
            window.vegasActions = [];
            sendAction = action => vegasActions.push(action);
            const room = {room_id: 'royale-lobby', game_type: 'las_vegas', status: 'lobby', players: [], game_config: {}};
            renderRoomState(room);
            socket.emitEvent(['room:state', room]);
        });
        await page.locator('#lasVegasEdition').selectOption('royale');
        assert.equal(await page.locator('#roomPanel #lasVegasEdition').count(), 1);
        assert.equal(await page.locator('#lasVegasPanel select').count(), 0);
        assert.deepEqual(await page.evaluate(() => getLasVegasConfig()), {edition: 'royale', neutral_dice: false});
        const start = await page.evaluate(() => {
            const original = ensureRoomConnection, originalRequest = sendRoomRequest;
            let request;
            ensureRoomConnection = () => true;
            sendRoomRequest = (event, payload) => { request = {event, payload}; };
            try { emitRoomStart(); } finally { ensureRoomConnection = original; sendRoomRequest = originalRequest; }
            return request;
        });
        assert.equal(start.event, 'room:start');
        assert.deepEqual(start.payload.config, {edition: 'royale', neutral_dice: false});
        assert.equal(await page.locator('#lasVegasNeutralOption').isVisible(), false);
        await page.locator('#lasVegasHelpBtn').click();
        assert.match(await page.locator('#lasVegasDialogBody').innerText(), /16 种玩法/);
        await page.locator('[data-lv-language="en"]').click();
        assert.match(await page.locator('#lasVegasHelpSection').innerText(), /Win by having/);
        await page.locator('[data-lv-help-tab="tiles"]').click();
        assert.equal(await page.locator('#lasVegasHelpSection h3').count(), 16);
        assert.match(await page.locator('#lasVegasHelpSection').innerText(), /Biggy counts twice/);
        await page.locator('[data-lv-language="zh"]').click();
        await page.locator('[data-lv-help-tab="basics"]').click();
        await page.keyboard.press('Escape');
        await render(page, 'playing');
        assert.equal(await page.locator('.lv-log-box').getAttribute('open'), null);
        assert.equal(await page.locator('.lv-wallet').getAttribute('open'), null);
        assert.equal(await page.locator('.lv-roll-tray, .lv-sidebar').count(), 0);
        assert.match(await page.locator('.lv-big-badge').innerText(), /大骰/);
        assert.equal(await page.locator('.lv-roll-group[data-lv-face="6"]').isDisabled(), true);
        await page.locator('.lv-roll-group[data-lv-face="1"]').click();
        assert.equal(await page.locator('.lv-casino.is-selected [data-lv-action="place"]').count(), 1);
        assert.match(await page.locator('.lv-casino').first().locator('.lv-dice-count').innerText(), /4🎲/);
        await page.locator('[data-lv-action="place"]').click();
        assert.deepEqual(await lastAction(page), {type: 'place', round: 1, turn: 1, face: 1});
        await render(page, 'playing');
        await page.locator('[data-lv-action="royale_pass"]').click();
        assert.equal((await lastAction(page)).type, 'royale_pass');
        for (const key of ['lucky_punch', 'lucky_guess', 'fifty_fifty', 'no_entry', 'knockout', 'block_it', 'handicap', 'double_down', 'nice_dice', 'my_choice', 'black_pick']) {
            await render(page, key);
            const decision = views[key].decision;
            await page.locator('[data-lv-option]').first().click();
            assert.deepEqual(await lastAction(page), {type: 'royale_choose', round: 1, turn: 1, decision: decision.id, option: decision.options[0].id});
        }
        await render(page, 'black_split');
        assert.equal(await page.locator('[data-lv-option]').isDisabled(), true);
        await page.locator('[data-lv-token="0"]').click();
        await page.locator('[data-lv-token="3"]').click();
        await page.locator('[data-lv-option]').click();
        assert.equal((await lastAction(page)).option, '9');
        await render(page, 'black_waiting');
        assert.equal(await page.locator('[data-lv-token], [data-lv-option]').count(), 0);
        assert.match(await page.locator('.lv-controls').innerText(), /等待 Mira/);
        assert.match(await page.locator('.lv-note-status').first().innerText(), /已发放/);
        await render(page, 'spectator');
        assert.equal(await page.locator('.lv-wallet').count(), 0);
        assert.equal(await page.locator('[data-lv-action="royale_pass"]').count(), 0);
        for (const width of [320, 390, 600, 768, 1024, 1440]) {
            await page.setViewportSize({width, height: 1000});
            for (const key of Object.keys(views)) {
                await render(page, key);
                const issues = await page.evaluate(() => [...document.querySelectorAll('#lasVegasPanel *')].filter(node => {
                    const r = node.getBoundingClientRect(), s = getComputedStyle(node);
                    return node.checkVisibility() && r.width && r.height && (r.left < -1 || r.right > innerWidth + 1 ||
                        (node.clientWidth && node.scrollWidth > node.clientWidth + 1 && !['auto', 'hidden'].includes(s.overflowX)));
                }).map(node => `${node.className}: ${node.textContent.slice(0, 35)}`));
                assert.deepEqual(issues, [], `${width}px ${key}`);
                assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false, `${width}px ${key} page overflow`);
                const playerHeights = await page.locator('.lv-player-heading').evaluateAll(nodes => nodes.map(node => node.getBoundingClientRect().height));
                assert.ok(playerHeights.every(height => height < 28), `${width}px ${key} player headings wrap: ${playerHeights}`);
            }
            await render(page, 'playing');
            await page.locator('#lasVegasHelpBtn').click();
            for (const language of ['en', 'zh']) {
                await page.locator(`[data-lv-language="${language}"]`).click();
                for (const tab of ['basics', 'rules', 'controls', 'tiles']) {
                    await page.locator(`[data-lv-help-tab="${tab}"]`).click();
                    assert.equal(await page.locator('#lasVegasDialog').evaluate(node => node.scrollWidth > node.clientWidth + 1), false, `${width}px Help ${language}/${tab}`);
                }
            }
            await page.keyboard.press('Escape');
            const header = await page.locator('.game-panel[data-game-theme="las_vegas"] > .panel-header').evaluate(node => {
                const box = node.getBoundingClientRect();
                return {width: box.width, overflow: node.scrollWidth > node.clientWidth + 1};
            });
            assert.equal(header.overflow, false, `${width}px header`);
            if ([320, 390, 1024, 1440].includes(width)) {
                await page.locator('.lv-roll-group[data-lv-face="1"]').click();
                const metrics = await page.evaluate(() => {
                    const bounds = selector => document.querySelector(selector).getBoundingClientRect();
                    const board = bounds('.lv-casinos');
                    const panel = bounds('.game-panel[data-game-theme="las_vegas"]');
                    const confirm = bounds('[data-lv-action="place"]');
                    const selected = bounds('.lv-casino.is-selected');
                    return {width: innerWidth, panelHeight: Math.ceil(panel.height), boardHeight: Math.ceil(board.height), boardTop: Math.ceil(board.top), boardBottom: Math.ceil(board.bottom), confirmTop: Math.ceil(confirm.top - selected.top)};
                });
                assert.ok(metrics.panelHeight < (width < 500 ? 760 : 580), `${width}px compact height: ${JSON.stringify(metrics)}`);
                assert.ok(metrics.boardTop < 275, `${width}px board should start near the top`);
                assert.ok(metrics.confirmTop < 155, `${width}px confirmation should be beside the selection`);
                fs.writeFileSync(path.join(output, `metrics-${width}.json`), JSON.stringify(metrics, null, 2));
                await page.screenshot({path: path.join(output, `board-${width}.png`), fullPage: true});
                await render(page, 'crowded');
                await page.locator('.lv-wallet > summary').click();
                assert.equal(await page.locator('.lv-wallet-notes > span').count(), 2);
                await page.evaluate(() => { document.activeElement?.blur(); window.scrollTo(0, 0); });
                await page.screenshot({path: path.join(output, `crowded-${width}.png`), fullPage: true});
                await page.locator('.lv-wallet > summary').click();
            }
        }
        await page.setViewportSize({width: 1440, height: 1000});
        await render(page, 'playing');
        await page.screenshot({path: path.join(output, 'desktop.png'), fullPage: true});
        await page.locator('#lasVegasExplainBtn').click();
        await page.locator('.lv-tile h4 > span').first().click();
        assert.ok((await page.locator('#lasVegasDialogBody').innerText()).length > 25);
        await page.keyboard.press('Escape');
        await render(page, 'playing');
        await page.locator('.lv-wallet > summary').click();
        await page.locator('.lv-roll-group[data-lv-face="1"]').click();
        assert.equal(await page.locator('.lv-wallet').getAttribute('open'), '');
        await page.locator('.lv-wallet > summary').click();
        await page.locator('.lv-log-box > summary').click();
        assert.equal(await page.locator('.lv-log-box').getAttribute('open'), '');
        await page.locator('.lv-roll-group[data-lv-face="1"]').click();
        assert.equal(await page.locator('.lv-log-box').getAttribute('open'), '');
        await page.keyboard.press('Escape');
        assert.equal(await page.locator('.lv-casino.is-selected').count(), 0);
        await page.locator('#lasVegasExplainBtn').click();
        const disabledBox = await page.locator('.lv-roll-group[data-lv-face="6"]').boundingBox();
        const beforeExplain = await page.evaluate(() => vegasActions.length);
        await page.mouse.click(disabledBox.x + disabledBox.width / 2, disabledBox.y + disabledBox.height / 2);
        assert.equal(await page.locator('#lasVegasDialog').evaluate(node => node.open), true);
        assert.equal(await page.evaluate(() => vegasActions.length), beforeExplain);
        await page.keyboard.press('Escape');
        await page.locator('#lasVegasExplainBtn').click();
        await page.locator('.lv-banknotes [data-lv-tip]').first().click();
        assert.match(await page.locator('#lasVegasDialogBody').innerText(), /50,000/);
        await page.keyboard.press('Escape');
        await render(page, 'black_split');
        await page.screenshot({path: path.join(output, 'secret-split.png'), fullPage: true});
        await page.setViewportSize({width: 390, height: 852});
        await render(page, 'playing');
        await page.screenshot({path: path.join(output, 'mobile.png'), fullPage: true});
        await render(page, 'final');
        assert.match(await page.locator('.lv-final').innerText(), /3 轮奖金/);
        await render(page, 'settled');
        await page.screenshot({path: path.join(output, 'settled-390.png'), fullPage: true});
        await page.locator('[data-lv-action="next"]').click();
        assert.equal((await lastAction(page)).type, 'next_round');
        for (const edition of ['classic', 'neutral']) {
            await render(page, `${edition}_playing`);
            assert.equal(await page.locator('.lv-tile').count(), 0);
            assert.equal(await page.locator('[data-lv-action="royale_pass"]').count(), 0);
            await page.locator('.lv-roll-group').first().click();
            await page.locator('.lv-casino.is-selected [data-lv-action="place"]').click();
            assert.equal((await lastAction(page)).type, 'place');
            await page.locator('#lasVegasHelpBtn').click();
            await page.locator('[data-lv-language="en"]').click();
            await page.locator('[data-lv-help-tab="basics"]').click();
            assert.match(await page.locator('#lasVegasHelpSection').innerText(), /4 rounds/);
            assert.equal(await page.locator('[data-lv-help-tab="tiles"]').count(), 0);
            await page.keyboard.press('Escape');
        }
        const mobile = await browser.newContext({viewport: {width: 390, height: 844}, isMobile: true, hasTouch: true});
        const touchPage = await mobile.newPage();
        touchPage.on('pageerror', error => errors.push(error.message));
        await touchPage.goto(`http://127.0.0.1:${server.address().port}`);
        await touchPage.evaluate(async () => {
            socket.disconnect();
            await ensureGameAssets('las_vegas');
            window.vegasActions = [];
            sendAction = action => vegasActions.push(action);
        });
        await render(touchPage, 'playing');
        await touchPage.locator('.lv-roll-group[data-lv-face="1"]').tap();
        assert.equal(await touchPage.locator('.lv-casino.is-selected').count(), 1);
        await touchPage.locator('.lv-casino.is-selected [data-lv-action="place"]').tap();
        assert.equal((await lastAction(touchPage)).face, 1);
        assert.equal(await touchPage.locator('#lasVegasTooltip').isVisible(), false);
        await render(touchPage, 'playing');
        await touchPage.locator('.lv-player .lv-identity').last().tap();
        assert.match(await touchPage.locator('#lasVegasTooltip').innerText(), /LongPlayerName<&>/);
        await touchPage.locator('.lv-banner').tap();
        await touchPage.locator('.lv-status [data-lv-tip]').tap();
        assert.equal(await touchPage.locator('#lasVegasTooltip').isVisible(), true);
        const oldTip = await touchPage.locator('#lasVegasTooltip').innerText();
        await touchPage.locator('.lv-round-marker [data-lv-tip]').tap();
        assert.notEqual(await touchPage.locator('#lasVegasTooltip').innerText(), oldTip);
        await touchPage.waitForTimeout(3200);
        assert.equal(await touchPage.locator('#lasVegasTooltip').isVisible(), false);
        await touchPage.locator('.lv-banknotes [data-lv-tip]').first().tap();
        assert.match(await touchPage.locator('#lasVegasTooltip').innerText(), /50,000/);
        const noteBox = await touchPage.locator('.lv-roll-group[data-lv-face="1"]').boundingBox();
        const scrollSession = await mobile.newCDPSession(touchPage);
        const scrollX = noteBox.x + noteBox.width / 2, scrollY = noteBox.y + noteBox.height / 2;
        await scrollSession.send('Input.dispatchTouchEvent', {type: 'touchStart', touchPoints: [{x: scrollX, y: scrollY}]});
        await scrollSession.send('Input.dispatchTouchEvent', {type: 'touchMove', touchPoints: [{x: scrollX, y: scrollY - 60}]});
        await scrollSession.send('Input.dispatchTouchEvent', {type: 'touchEnd', touchPoints: []});
        assert.equal(await touchPage.locator('.lv-casino.is-selected').count(), 0);
        await touchPage.locator('#lasVegasExplainBtn').tap();
        const touchBox = await touchPage.locator('.lv-roll-group[data-lv-face="6"]').boundingBox();
        const touchSession = await mobile.newCDPSession(touchPage);
        const touchX = touchBox.x + touchBox.width / 2, touchY = touchBox.y + touchBox.height / 2;
        await touchSession.send('Input.dispatchTouchEvent', {type: 'touchStart', touchPoints: [{x: touchX, y: touchY}]});
        await touchSession.send('Input.dispatchTouchEvent', {type: 'touchMove', touchPoints: [{x: touchX, y: touchY - 75}]});
        await touchSession.send('Input.dispatchTouchEvent', {type: 'touchEnd', touchPoints: []});
        assert.equal(await touchPage.locator('#lasVegasDialog').evaluate(node => node.open), false);
        assert.equal(await touchPage.locator('#lasVegasExplainBtn').getAttribute('aria-pressed'), 'true');
        await touchPage.locator('.lv-status [data-lv-tip]').tap();
        assert.equal(await touchPage.locator('#lasVegasDialog').evaluate(node => node.open), true);
        assert.equal(await touchPage.locator('#lasVegasExplainBtn').getAttribute('aria-pressed'), 'false');
        assert.deepEqual(await touchPage.evaluate(() => vegasActions), [{type: 'place', round: 1, turn: 1, face: 1}]);
        await mobile.close();
        assert.deepEqual(errors, []);
        console.log(`PASS: Classic/neutral/Royale, actions, Biggy, secrets, payouts, bilingual Help, disabled Explain, log, cancellation, touch scroll/tooltips; 6 widths × ${Object.keys(views).length} views.`);
    } finally {
        await browser?.close();
        await new Promise(resolve => server.close(resolve));
    }
})().catch(error => { console.error(error); process.exitCode = 1; });
