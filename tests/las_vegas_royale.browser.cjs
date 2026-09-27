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
        await page.keyboard.press('Escape');
        await render(page, 'playing');
        assert.match(await page.locator('.lv-big-badge').innerText(), /大骰/);
        assert.equal(await page.locator('.lv-roll-group[data-lv-face="6"]').isDisabled(), true);
        await page.locator('.lv-roll-group[data-lv-face="1"]').click();
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
        for (const width of [320, 360, 393, 600, 768, 1024, 1280, 1600]) {
            await page.setViewportSize({width, height: 1000});
            for (const key of Object.keys(views)) {
                await render(page, key);
                const issues = await page.evaluate(() => [...document.querySelectorAll('#lasVegasPanel *')].filter(node => {
                    const r = node.getBoundingClientRect(), s = getComputedStyle(node);
                    return node.checkVisibility() && r.width && r.height && (r.left < -1 || r.right > innerWidth + 1 ||
                        (node.clientWidth && node.scrollWidth > node.clientWidth + 1 && !['auto', 'hidden'].includes(s.overflowX)));
                }).map(node => `${node.className}: ${node.textContent.slice(0, 35)}`));
                assert.deepEqual(issues, [], `${width}px ${key}`);
            }
        }
        await page.setViewportSize({width: 1280, height: 1000});
        await render(page, 'playing');
        await page.screenshot({path: path.join(output, 'desktop.png'), fullPage: true});
        await page.locator('#lasVegasExplainBtn').click();
        await page.locator('.lv-tile h4 > span').first().click();
        assert.ok((await page.locator('#lasVegasDialogBody').innerText()).length > 25);
        await page.keyboard.press('Escape');
        await render(page, 'black_split');
        await page.screenshot({path: path.join(output, 'secret-split.png'), fullPage: true});
        await page.setViewportSize({width: 393, height: 852});
        await render(page, 'playing');
        await page.screenshot({path: path.join(output, 'mobile.png'), fullPage: true});
        await render(page, 'final');
        assert.match(await page.locator('.lv-final').innerText(), /3 轮奖金/);
        assert.deepEqual(errors, []);
        console.log(`PASS: Royale configuration, actions, Biggy preview, closure, secrets, payouts, Help/Explain; 8 widths × ${Object.keys(views).length} views.`);
    } finally {
        await browser?.close();
        await new Promise(resolve => server.close(resolve));
    }
})().catch(error => { console.error(error); process.exitCode = 1; });
