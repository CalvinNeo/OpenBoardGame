const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const base = process.env.ROOM_TEST_URL || 'http://127.0.0.1:8787';
const output = 'build/in-a-grove-ai';

async function listen(page) {
    await page.evaluate(() => {
        window.inAGroveAiActions = [];
        window.inAGroveAiErrors = [];
        socket.on('system:error', payload => inAGroveAiErrors.push(payload));
        socket.on('game:state', payload => {
            for (const event of payload.events || []) {
                if (event.type === 'bot:action') inAGroveAiActions.push(event.payload.action);
            }
        });
    });
}

function checkPrivacy(view) {
    assert.equal('victim' in view, false);
    assert.equal('removed_tiles' in view, false);
    assert(view.players.every(player => !('own_tile' in player) && !('passed_tile' in player)));
    assert.equal(view.your_tiles.length, view.players.length === 2 ? 1 : 2);
    if (!view.game_over && view.phase !== 'round_end') {
        for (const suspect of view.suspects) {
            assert.equal(suspect.label !== null, view.current_turn === view.you && view.peeked_indexes.includes(suspect.index));
        }
    }
}

(async () => {
    const browser = await chromium.launch({ channel: 'chrome', headless: true });
    const errors = [];
    fs.mkdirSync(output, { recursive: true });
    try {
        for (const [width, playerCount] of [[320, 2], [390, 3], [1024, 4], [1440, 5]]) {
            for (const mode of ['choose_one', 'both']) {
                const context = await browser.newContext({
                    viewport: { width, height: 900 }, isMobile: width < 600, hasTouch: width < 600,
                });
                try {
                    const page = await context.newPage();
                    page.on('pageerror', error => errors.push(error.message));
                    await page.goto(base);
                    await page.waitForFunction(() => typeof socket !== 'undefined' && socket.connected);
                    if (!(await page.locator('#createBtn').isVisible())) {
                        await page.locator('#roomControlsToggleBtn').click();
                    }
                    await page.locator('#createBtn').click();
                    if (await page.locator('#playerNameModal').isVisible()) {
                        await page.locator('#nameInput').fill('Bamboo AI QA');
                        await page.locator('#playerNameForm button[type=submit]').click();
                    }
                    await page.locator('#gameSearchInput').fill('竹林之中');
                    const item = page.locator('#gameList [data-game-id="in_a_grove"]');
                    await item.waitFor();
                    assert.equal(await page.locator('#gameList .game-item').count(), 1);
                    assert.equal(await item.locator('.game-item-ai').textContent(), '🤖');
                    assert.match(await item.getAttribute('aria-label'), /Strategic AI available/);
                    await page.locator('#gameSortSelect').selectOption('difficulty_desc');
                    await page.locator('#playerCountFilter').selectOption(String(playerCount));
                    assert.equal(await item.evaluate(element => {
                        const row = element.getBoundingClientRect();
                        const badge = element.querySelector('.game-item-ai').getBoundingClientRect();
                        const text = element.querySelector('.game-item-name-text').getBoundingClientRect();
                        const meta = element.querySelector('.game-item-meta').getBoundingClientRect();
                        return row.left >= -1 && row.right <= innerWidth + 1 &&
                            element.scrollWidth <= element.clientWidth + 1 &&
                            badge.left >= text.right - 1 && badge.right <= meta.left + 1;
                    }), true, `${width}: AI badge fits`);
                    await page.screenshot({ path: `${output}/catalog-${width}-${mode}.png` });
                    await page.keyboard.press('Escape');
                    assert.equal(await page.locator('#createRoomModal').isVisible(), false);
                    await page.locator('#createBtn').click();
                    await page.locator('#gameSearchInput').fill('In a Grove');
                    await item.click();
                    await page.waitForFunction(() => roomSessionReady && currentGameType === 'in_a_grove');
                    await page.waitForFunction(() => isGameAssetsLoaded('in_a_grove'));
                    if (!(await page.locator('#addBotBtn').isVisible())) {
                        await page.locator('#roomControlsToggleBtn').click();
                    }
                    for (let count = 2; count <= playerCount; count += 1) {
                        await page.locator('#addBotBtn').click();
                        await page.waitForFunction(expected => currentRoomState.players.length === expected, count);
                    }
                    await page.locator('#inAGroveInspectionModeSelect').selectOption(mode);
                    await listen(page);
                    await page.locator('#startBtn').click();
                    const botActions = [];
                    let reconnected = false;
                    let inspectedLayout = false;
                    for (let step = 0; step < 24; step += 1) {
                        await page.waitForFunction(() => currentInAGroveView &&
                            (currentInAGroveView.game_over || currentInAGroveView.legal_actions.length > 0));
                        const view = await page.evaluate(() => currentInAGroveView);
                        assert.equal(view.config.inspection_mode, mode);
                        assert.equal(view.players.filter(player => player.is_bot).length, playerCount - 1);
                        checkPrivacy(view);
                        if (view.game_over) break;
                        if (!inspectedLayout) {
                            assert.equal(await page.locator('#inAGrovePanel').evaluate(panel =>
                                panel.scrollWidth <= panel.clientWidth + 1 &&
                                document.documentElement.scrollWidth <= innerWidth + 1), true, `${width}: game fits`);
                            await page.screenshot({ path: `${output}/game-${width}-${mode}.png`, fullPage: true });
                            await page.locator('#inAGroveHelpBtn').click();
                            assert.equal(await page.locator('#inAGroveHelpModal').isVisible(), true);
                            await page.keyboard.press('Escape');
                            assert.equal(await page.locator('#inAGroveHelpModal').isVisible(), false);
                            inspectedLayout = true;
                        }
                        if (view.phase === 'peek') {
                            const indexes = view.suspects.filter(suspect => !suspect.blocked)
                                .slice(0, view.peek_count).map(suspect => suspect.index);
                            for (const index of indexes) await page.locator(`#inAGroveSuspect${index}`).click();
                            assert(await page.evaluate(() => currentInAGroveView.suspects.every(suspect => suspect.label === null)));
                            await page.locator('#inAGrovePeekBtn').click();
                        } else if (view.phase === 'bet') {
                            if (width === 390 && !reconnected) {
                                botActions.push(...await page.evaluate(() => inAGroveAiActions));
                                assert.deepEqual(await page.evaluate(() => inAGroveAiErrors), []);
                                await page.reload();
                                await page.waitForFunction(() => roomSessionReady &&
                                    typeof currentInAGroveView !== 'undefined' && currentInAGroveView?.phase === 'bet');
                                const restored = await page.evaluate(() => currentInAGroveView);
                                assert.deepEqual(restored.peeked_indexes, view.peeked_indexes);
                                assert.deepEqual(restored.your_tiles, view.your_tiles);
                                assert.deepEqual(restored.suspects, view.suspects);
                                await listen(page);
                                reconnected = true;
                            }
                            await page.locator('#inAGroveSuspect0').click();
                            await page.locator('#inAGroveBetBtn').click();
                        } else {
                            assert.equal(view.phase, 'round_end');
                            await page.waitForFunction(() => currentInAGroveView.players
                                .filter(player => player.is_bot).every(player => player.round_ready));
                            assert.equal(await page.evaluate(() => currentInAGroveView.round), view.round);
                            assert.equal(await page.evaluate(() => currentInAGroveView.players
                                .find(player => player.player_id === currentInAGroveView.you).round_ready), false);
                            await page.locator('#inAGroveNextRoundBtn').click();
                        }
                        await page.waitForFunction(previous =>
                            currentInAGroveView.round !== previous.round ||
                            currentInAGroveView.phase !== previous.phase ||
                            currentInAGroveView.current_turn !== previous.current_turn,
                        { round: view.round, phase: view.phase, current_turn: view.current_turn });
                    }
                    const finalView = await page.evaluate(() => currentInAGroveView);
                    assert.equal(finalView.game_over, true);
                    assert(finalView.round <= 7);
                    botActions.push(...await page.evaluate(() => inAGroveAiActions));
                    for (const actionType of ['peek_suspects', 'place_bet', 'next_round']) {
                        assert(botActions.some(action => action.type === actionType), actionType);
                    }
                    for (const action of botActions) {
                        assert(Object.keys(action).every(key => ['type', 'suspect_index', 'suspect_indexes'].includes(key)));
                    }
                    assert.deepEqual(await page.evaluate(() => inAGroveAiErrors), []);
                    console.log(`${width}px, ${playerCount} players, ${mode}: AI badge, Add Bot, privacy, full game and round confirmation passed`);
                } finally {
                    await context.close();
                }
            }
        }
        assert.deepEqual(errors, [], 'Browser errors');
    } finally {
        await browser.close();
    }
})().catch(error => { console.error(error); process.exitCode = 1; });
