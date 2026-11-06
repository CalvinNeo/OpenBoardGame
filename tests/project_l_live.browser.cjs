const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict');
const base = process.env.ROOM_TEST_URL || 'http://127.0.0.1:8817';

function transformed(shape, rotation, flip) {
    let result = shape.map(row => flip ? row.slice().reverse() : row.slice());
    for (let turn = 0; turn < rotation / 90; turn += 1) {
        const previous = result;
        result = previous[0].map((unused, column) => previous.map(row => row[column]).reverse());
    }
    return result;
}

function position(view, puzzle, pieceId, rotation = 0, flip = false) {
    const definition = view.puzzle_defs[puzzle.card_id];
    const shape = transformed(view.piece_defs[pieceId].shape, rotation, flip);
    const occupied = new Set();
    puzzle.placed.forEach(placement => {
        transformed(view.piece_defs[placement.piece_id].shape, placement.rotation, placement.flip).forEach((row, rowIndex) => row.forEach((value, column) => {
            if (value) occupied.add(`${rowIndex + placement.row},${column + placement.col}`);
        }));
    });
    for (let row = 0; row + shape.length <= definition.height; row += 1) {
        for (let column = 0; column + shape[0].length <= definition.width; column += 1) {
            if (shape.every((line, rowOffset) => line.every((value, columnOffset) => !value ||
                definition.grid[row + rowOffset][column + columnOffset] && !occupied.has(`${row + rowOffset},${column + columnOffset}`)))) {
                return { row, column };
            }
        }
    }
    return null;
}

(async () => {
    const browser = await chromium.launch({ channel: process.env.BROWSER_CHANNEL || 'chrome', headless: true });
    const contexts = [];
    const pages = [];
    const errors = [];
    try {
        for (const name of ['Project L QA Alex', 'Project L QA Robin']) {
            const context = await browser.newContext({ viewport: { width: pages.length ? 390 : 1440, height: 1000 }, hasTouch: true });
            contexts.push(context);
            const page = await context.newPage();
            page.setDefaultTimeout(12000);
            page.on('pageerror', error => errors.push(error.message));
            await page.route('https://fonts.googleapis.com/**', route => route.abort());
            await page.goto(base);
            await page.waitForFunction(() => typeof socket !== 'undefined' && socket.connected);
            if (!pages.length) {
                await page.evaluate(name => socket.emit('room:create', { name, game_type: 'project_l' }), name);
            } else {
                const room = await pages[0].evaluate(() => roomId);
                await page.evaluate(({ room, name }) => socket.emit('room:join', { room_id: room, name }), { room, name });
            }
            await page.waitForFunction(() => roomSessionReady && currentGameType === 'project_l' && isGameAssetsLoaded('project_l'));
            await page.evaluate(() => socket.emit('room:ready', { room_id: roomId, ready: true }));
            pages.push(page);
        }
        await pages[0].waitForFunction(() => !document.getElementById('startBtn').disabled);
        await pages[0].evaluate(() => setRoomControlsCollapsed(false));
        await pages[0].locator('#startBtn').click();
        for (const page of pages) {
            await page.waitForFunction(() => lastGameStatePayload?.view?.phase === 'main');
            await page.evaluate(() => {
                setRoomControlsCollapsed(true);
                window.projectLServerErrors = [];
                socket.on('system:error', data => window.projectLServerErrors.push(data.message));
            });
        }
        const playerIds = await Promise.all(pages.map(page => page.evaluate(() => playerId)));
        const initial = await pages[0].evaluate(() => lastGameStatePayload.view);
        const actorId = initial.current_turn;
        const actor = pages[playerIds.indexOf(actorId)];
        const opponent = pages[1 - playerIds.indexOf(actorId)];
        const opponentId = playerIds[1 - playerIds.indexOf(actorId)];

        async function changed(page, callback) {
            const before = await page.evaluate(() => JSON.stringify([lastGameStatePayload.view.current_turn, lastGameStatePayload.view.ap_remaining, lastGameStatePayload.view.players]));
            await callback();
            await Promise.all(pages.map(peer => peer.waitForFunction(before => JSON.stringify([lastGameStatePayload.view.current_turn, lastGameStatePayload.view.ap_remaining, lastGameStatePayload.view.players]) !== before, before)));
        }

        let chosen = null;
        for (const deck of ['white', 'black']) {
            initial.market[deck].forEach((cardId, index) => {
                const puzzle = { card_id: cardId, placed: [] };
                const target = position(initial, puzzle, 'L3_V', 180, true);
                if (!chosen && target && initial.puzzle_defs[cardId].grid.flat().filter(Boolean).length >= 6) chosen = { deck, index, cardId, target };
            });
        }
        assert(chosen, 'market must offer a puzzle for the rotated placement');
        await changed(actor, async () => {
            await actor.locator(`#projectLMarket${chosen.deck === 'white' ? 'White' : 'Black'} .project-l-card-face`).nth(chosen.index).click();
            await actor.waitForTimeout(320);
            await actor.locator('#projectLTakeMarketBtn').click();
        });
        await changed(actor, async () => {
            await actor.locator('#projectLInventory [data-piece-id="L2_I"]').click();
            await actor.locator('#projectLUpgradeBtn').click();
            await actor.locator('#projectLUpgradeOptions [data-piece-id="L3_V"]').click();
        });
        await changed(actor, async () => {
            await actor.locator('#projectLInventory [data-piece-id="L3_V"]').click();
            await actor.locator('#projectLRotateRightBtn').click();
            await actor.locator('#projectLRotateRightBtn').click();
            await actor.locator('#projectLFlipBtn').click();
            await actor.locator(`[data-project-l-key="cell-${chosen.cardId}-${chosen.target.row}-${chosen.target.column}"]`).click();
            assert(await actor.locator('#projectLPlaceBtn').isEnabled());
            await actor.locator('#projectLPlaceBtn').click();
        });
        let view = await actor.evaluate(() => lastGameStatePayload.view);
        let own = view.players.find(player => player.player_id === actorId);
        assert.deepEqual(own.active_puzzles[0].placed[0], { piece_id: 'L3_V', row: chosen.target.row, col: chosen.target.column, rotation: 180, flip: true });
        assert.equal(view.current_turn, opponentId);
        assert.match(await opponent.locator('.project-l-opponent-puzzles').innerText(), /3\//);
        for (let action = 0; action < 3; action += 1) await changed(opponent, () => opponent.locator('#projectLTakeLevel1Btn').click());
        await changed(actor, async () => {
            await actor.locator('#projectLMarketWhite .project-l-card-face').first().click();
            await actor.waitForTimeout(320);
            await actor.locator('#projectLTakeMarketBtn').click();
        });
        await changed(actor, () => actor.locator('#projectLTakeLevel1Btn').click());
        view = await actor.evaluate(() => lastGameStatePayload.view);
        own = view.players.find(player => player.player_id === actorId);
        await actor.locator('#projectLInventory [data-piece-id="L1_I"]').click();
        for (const puzzle of own.active_puzzles) {
            const target = position(view, puzzle, 'L1_I');
            assert(target);
            await actor.locator(`[data-project-l-key="cell-${puzzle.card_id}-${target.row}-${target.column}"]`).click();
            await actor.locator('#projectLQueueMasterBtn').click();
        }
        assert.equal(await actor.locator('#projectLMasterQueue .project-l-queue-item').count(), 2);
        await changed(actor, () => actor.locator('#projectLUseMasterBtn').click());
        view = await actor.evaluate(() => lastGameStatePayload.view);
        own = view.players.find(player => player.player_id === actorId);
        assert.equal(own.active_puzzles[0].placed.length, 2);
        assert.equal(own.active_puzzles[1].placed.length, 1);
        assert.equal(view.current_turn, opponentId);
        assert(await actor.locator('#projectLMasterSection').isHidden());

        const room = await actor.evaluate(() => roomId);
        await actor.reload();
        await actor.waitForFunction(room => roomSessionReady && roomId === room && lastGameStatePayload?.view?.players?.length === 2 && isGameAssetsLoaded('project_l'), room);
        assert.equal(await actor.locator('#projectLActivePuzzles .project-l-puzzle-card').count(), 2);
        await actor.evaluate(() => socket.disconnect());
        await actor.locator('#gameReconnectBtn').click();
        await actor.waitForFunction(() => socket.connected && roomSessionReady && lastGameStatePayload?.view?.players?.length === 2);
        assert(await actor.locator('#projectLPanel').isVisible());
        await actor.locator('#projectLHelpBtn').click();
        assert(await actor.locator('#projectLHelpModal').isVisible());
        await actor.keyboard.press('Escape');
        assert.deepEqual(await opponent.evaluate(() => window.projectLServerErrors), []);
        assert.deepEqual(errors, []);
        console.log('Project L live UI passed: two clients, take, upgrade, rotated/mirrored placement, two-puzzle Master Action, turn handoff, opponent progress, reload and reconnect.');
    } finally {
        for (const page of pages) await page.evaluate(() => { if (typeof socket !== 'undefined' && socket.connected && roomId) socket.emit('room:leave', { room_id: roomId }); }).catch(() => {});
        for (const context of contexts) await context.close();
        await browser.close();
    }
})().catch(error => { console.error(error.stack || error); process.exitCode = 1; });
