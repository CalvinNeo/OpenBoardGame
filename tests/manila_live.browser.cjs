const {chromium} = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict');
const base = process.env.ROOM_TEST_URL || 'http://127.0.0.1:8797';

async function current(page) {
    return page.evaluate(() => lastGameStatePayload?.view);
}

async function changed(page, before) {
    await page.waitForFunction(before => JSON.stringify(lastGameStatePayload?.view) !== before, JSON.stringify(before));
}

(async () => {
    const browser = await chromium.launch({channel: process.env.BROWSER_CHANNEL || 'chrome', headless: true});
    const contexts = [];
    const pages = [];
    const errors = [];
    try {
        for (const name of ['Harbor QA', 'Navigator QA', 'Merchant QA']) {
            const context = await browser.newContext({viewport: {width: pages.length ? 390 : 1440, height: 1000}, hasTouch: true});
            contexts.push(context);
            const page = await context.newPage();
            page.on('pageerror', error => errors.push(error.message));
            await page.route('https://fonts.googleapis.com/**', route => route.abort());
            await page.goto(base);
            await page.waitForFunction(() => typeof socket !== 'undefined' && socket.connected);
            if (!pages.length) {
                assert.equal(await page.locator('#manilaPanel').evaluate(node => node.children.length), 0);
                await page.evaluate(name => socket.emit('room:create', {name, game_type: 'manila'}), name);
            } else {
                const room = await pages[0].evaluate(() => roomId);
                await page.evaluate(({name, room}) => socket.emit('room:join', {name, room_id: room}), {name, room});
            }
            await page.waitForFunction(() => roomSessionReady && currentGameType === 'manila' && isGameAssetsLoaded('manila'));
            await page.evaluate(() => {
                window.manilaServerErrors = [];
                socket.on('system:error', data => window.manilaServerErrors.push(data.message));
                socket.emit('room:ready', {room_id: roomId, ready: true});
                setRoomControlsCollapsed(true);
            });
            pages.push(page);
        }
        const ids = await Promise.all(pages.map(page => page.evaluate(() => playerId)));
        await pages[0].waitForFunction(() => currentRoomState.players.length === 3 && currentRoomState.players.every(player => player.ready));
        await pages[0].evaluate(() => socket.emit('room:start', {room_id: roomId}));
        await Promise.all(pages.map(page => page.waitForFunction(() => lastGameStatePayload?.view?.phase === 'auction')));
        let state = await current(pages[0]);
        for (let turn = 0; turn < 2; turn++) {
            const actor = pages[ids.indexOf(state.current_player)];
            await actor.locator('[data-manila-op="pass-bid"]').click();
            await changed(pages[0], state);
            state = await current(pages[0]);
        }
        assert.equal(state.phase, 'harbormaster_buy');
        const captain = pages[ids.indexOf(state.harbormaster)];
        await captain.locator('[data-manila-op="skip-buy"]').click();
        await captain.waitForFunction(() => lastGameStatePayload.view.phase === 'harbormaster_cargo');
        for (const cargo of ['nutmeg', 'ginseng', 'jade']) await captain.locator(`[data-manila-op="cargo"][data-cargo="${cargo}"]`).click();
        await captain.locator('[data-manila-op="cargo-confirm"]').click();
        await captain.waitForFunction(() => lastGameStatePayload.view.phase === 'harbormaster_position');
        await captain.locator('[data-manila-op="positions-confirm"]').click();
        await Promise.all(pages.map(page => page.waitForFunction(() => lastGameStatePayload.view.phase === 'placement')));

        await pages[0].reload();
        await pages[0].waitForFunction(() => roomSessionReady && isGameAssetsLoaded('manila') && lastGameStatePayload?.view?.phase === 'placement');
        assert.equal(await pages[0].evaluate(() => playerId), ids[0]);
        await pages[0].evaluate(() => {
            window.manilaServerErrors = [];
            socket.on('system:error', data => window.manilaServerErrors.push(data.message));
            setRoomControlsCollapsed(true);
        });
        assert.equal(await pages[0].locator('.manila-ship').count(), 3);
        assert.equal(await pages[0].locator('script[src*="games/manila.js"]').count(), 1);
        await pages[0].evaluate(() => socket.disconnect());
        await pages[0].waitForFunction(() => !socket.connected);
        assert.match(await pages[0].locator('#manilaTurn').innerText(), /Disconnected/);
        await pages[0].evaluate(() => socket.connect());
        await pages[0].waitForFunction(() => socket.connected && roomSessionReady);
        await pages[0].waitForFunction(() => !document.getElementById('manilaTurn').textContent.includes('Disconnected'));

        state = await current(pages[0]);
        for (let turn = 0; turn < 9; turn++) {
            assert.equal(state.phase, 'placement');
            const actor = pages[ids.indexOf(state.current_player)];
            if (turn === 0) {
                await actor.locator('[data-manila-op="seat"][data-cargo="ginseng"]').first().click();
                await actor.locator('[data-manila-op="confirm"]').click();
            } else {
                await actor.locator('[data-manila-op="pass"]').click();
            }
            await changed(pages[0], state);
            state = await current(pages[0]);
        }
        assert.equal(state.phase, 'round_end');
        await Promise.all(pages.map(page => page.waitForFunction(() => lastGameStatePayload.view.phase === 'round_end')));
        const firstRound = state.round;
        for (let index = 0; index < 2; index++) {
            await pages[index].locator('[data-manila-op="next-round"]').click();
            await pages[0].waitForFunction(id => lastGameStatePayload.view.players.find(player => player.player_id === id)?.round_ready, ids[index]);
            assert.equal((await current(pages[0])).round, firstRound);
            assert.equal((await current(pages[0])).phase, 'round_end');
            assert.equal(await pages[index].locator('[data-manila-op="next-round"]').isDisabled(), true);
        }
        await pages[2].locator('[data-manila-op="next-round"]').click();
        await Promise.all(pages.map(page => page.waitForFunction(round => lastGameStatePayload.view.round === round + 1 && lastGameStatePayload.view.phase === 'auction', firstRound)));
        for (const page of pages) assert.deepEqual(await page.evaluate(() => window.manilaServerErrors), []);
        assert.deepEqual(errors, []);
        console.log('PASS: three real clients, lazy entry, auction/setup, paid placement, three movements, all-player ready barrier, second voyage, page reload and Socket.IO reconnect.');
    } finally {
        await Promise.all(contexts.map(context => context.close()));
        await browser.close();
    }
})().catch(error => { console.error(error); process.exitCode = 1; });
