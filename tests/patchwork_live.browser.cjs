const {chromium} = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict');
const base = process.env.ROOM_TEST_URL || 'http://127.0.0.1:8803';

(async () => {
    const browser = await chromium.launch({channel: process.env.BROWSER_CHANNEL || 'chrome', headless: true});
    const contexts = [];
    const pages = [];
    const errors = [];
    try {
        for (const name of ['Patchwork QA 1', 'Patchwork QA 2']) {
            const context = await browser.newContext({viewport: {width: pages.length ? 390 : 1440, height: 1000}, hasTouch: true});
            contexts.push(context);
            const page = await context.newPage();
            page.setDefaultTimeout(10000);
            page.on('pageerror', error => errors.push(error.message));
            await page.route('https://fonts.googleapis.com/**', route => route.abort());
            await page.goto(base);
            await page.waitForFunction(() => typeof socket !== 'undefined' && socket.connected);
            if (!pages.length) {
                assert.equal(await page.locator('#patchworkPanel').evaluate(node => node.children.length), 0);
                await page.evaluate(name => socket.emit('room:create', {name, game_type: 'patchwork'}), name);
            } else {
                const room = await pages[0].evaluate(() => roomId);
                await page.evaluate(({room, name}) => socket.emit('room:join', {room_id: room, name}), {room, name});
            }
            await page.waitForFunction(() => roomSessionReady && currentGameType === 'patchwork' && isGameAssetsLoaded('patchwork'));
            await page.evaluate(() => socket.emit('room:ready', {room_id: roomId, ready: true}));
            pages.push(page);
        }
        await pages[0].waitForFunction(() => currentRoomState.players.length === 2 && currentRoomState.players.every(player => player.ready));
        await pages[0].evaluate(() => socket.emit('room:start', {room_id: roomId}));
        await Promise.all(pages.map(page => page.waitForFunction(() => lastGameStatePayload?.view?.game_id === 'patchwork')));
        const ids = await Promise.all(pages.map(page => page.evaluate(() => playerId)));
        await pages[0].reload();
        await pages[0].waitForFunction(() => roomSessionReady && isGameAssetsLoaded('patchwork') && lastGameStatePayload?.view?.game_id === 'patchwork');
        assert.equal(await pages[0].evaluate(() => playerId), ids[0]);
        assert.equal(await pages[0].locator('script[src*="games/patchwork.js"]').count(), 1);
        await pages[0].evaluate(() => socket.disconnect());
        await pages[0].waitForFunction(() => !socket.connected);
        assert.equal(await pages[0].locator('#patchworkAdvanceBtn').isDisabled(), true);
        await pages[0].evaluate(() => socket.connect());
        await pages[0].waitForFunction(() => socket.connected && roomSessionReady && !document.getElementById('patchworkTurn').textContent.includes('Disconnected'));
        for (const page of pages) await page.evaluate(() => {
            setRoomControlsCollapsed(true);
            window.patchworkServerErrors = [];
            window.patchworkEvents = [];
            socket.on('system:error', data => window.patchworkServerErrors.push(data.message));
            socket.on('game:state', data => window.patchworkEvents.push(...(data.events || [])));
        });
        let bought = false;
        let bonusCount = 0;
        let actions = 0;
        while (actions < 130) {
            const state = await pages[0].evaluate(() => lastGameStatePayload.view);
            if (state.game_over) break;
            const actor = pages[ids.indexOf(state.current_turn)];
            await actor.waitForFunction(player => lastGameStatePayload.view.current_turn === player, state.current_turn);
            const own = state.players.find(player => player.player_id === state.current_turn);
            const affordable = state.selectable_patches.find(patchId => state.patch_defs[patchId].cost_buttons <= own.buttons);
            if (state.pending_special_patch) {
                const row = own.quilt_board.findIndex(cells => cells.includes(null));
                const column = own.quilt_board[row].indexOf(null);
                await actor.locator(`#patchworkYourBoard [data-row="${row}"][data-column="${column}"]`).click();
                await actor.locator('#patchworkConfirmBuyBtn').click();
                bonusCount++;
            } else if (!bought && affordable) {
                await actor.locator(`#patchworkMarket [data-patch-id="${affordable}"]`).click();
                await actor.locator('#patchworkYourBoard [data-row="4"][data-column="4"]').click();
                await actor.locator('#patchworkRotateBtn').click();
                await actor.locator('#patchworkFlipBtn').click();
                const cells = await actor.locator('#patchworkYourBoard .preview').evaluateAll(nodes => nodes.map(node => [Number(node.dataset.column), Number(node.dataset.row)]));
                await actor.locator('#patchworkConfirmBuyBtn').click();
                await actor.waitForFunction(({id, patch}) => lastGameStatePayload.view.players.find(player => player.player_id === id).placed_patches.some(entry => entry.patch_id === patch), {id: own.player_id, patch: affordable});
                const board = await actor.evaluate(id => lastGameStatePayload.view.players.find(player => player.player_id === id).quilt_board, own.player_id);
                for (const [column, row] of cells) assert.equal(board[row][column], affordable, 'server differs from preview');
                bought = true;
            } else {
                await actor.locator('#patchworkAdvanceBtn').click();
            }
            const previous = JSON.stringify(state.players.map(player => [player.buttons, player.time_position, player.placed_patches.length]));
            await Promise.all(pages.map(page => page.waitForFunction(previous => JSON.stringify(lastGameStatePayload.view.players.map(player => [player.buttons, player.time_position, player.placed_patches.length])) !== previous, previous)));
            actions++;
        }
        assert(bought, 'a real purchase must complete');
        assert(bonusCount >= 5, 'every leather reward must be placed');
        const final = await pages[0].evaluate(() => lastGameStatePayload.view);
        assert.equal(final.game_over, true);
        for (const player of final.players) assert.equal(final.scores[player.player_id], player.buttons - 2 * player.empty_spaces + (player.has_special_tile ? final.special_tile_bonus : 0));
        for (const page of pages) {
            assert.deepEqual(await page.evaluate(() => window.patchworkServerErrors), []);
            assert.equal(await page.locator('#patchworkAdvanceBtn').isDisabled(), true);
            assert.match(await page.locator('#patchworkNotice').innerText(), /Game over/);
            await page.locator('#patchworkPlayers [data-player-id]').last().click();
            assert.equal(await page.locator('#patchworkQuiltModal').evaluate(node => node.open), true);
            await page.keyboard.press('Escape');
        }
        assert.deepEqual(errors, []);
        console.log(`Patchwork live game passed: ${actions} actions, rotated/mirrored purchase, ${bonusCount} leather patches, finals, reload and reconnect.`);
    } finally {
        for (const page of pages) {
            await page.evaluate(() => { if (typeof socket !== 'undefined' && socket.connected && roomId) socket.emit('room:leave', {room_id: roomId}); }).catch(() => {});
        }
        for (const context of contexts) await context.close();
        await browser.close();
    }
})().catch(error => { console.error(error.stack || error); process.exitCode = 1; });
