const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const base = process.env.ROOM_TEST_URL || 'http://127.0.0.1:8786';
const output = 'build/kobayakawa-ai';
const actionSelectors = {
    draw_card: '#kobayakawaDrawBtn',
    replace_kobayakawa: '#kobayakawaReplaceBtn',
    keep_drawn: '#kobayakawaKeepDrawnBtn',
    discard_drawn: '#kobayakawaDiscardDrawnBtn',
    fight: '#kobayakawaFightBtn',
    pass: '#kobayakawaPassBtn',
    next_round: '#kobayakawaNextBtn',
};

async function listen(page) {
    await page.evaluate(() => {
        window.kobayakawaAiActions = [];
        window.kobayakawaAiErrors = [];
        socket.on('system:error', payload => kobayakawaAiErrors.push(payload));
        socket.on('game:state', payload => {
            for (const event of payload.events || []) {
                if (event.type === 'bot:action') kobayakawaAiActions.push(event.payload.action.type);
            }
        });
    });
}

async function checkLayout(page, width, label) {
    const failures = await page.evaluate(() => {
        const panel = document.getElementById('kobayakawaPanel');
        const failures = [];
        if (document.documentElement.scrollWidth > innerWidth + 1) failures.push('page overflow');
        for (const element of panel.querySelectorAll('section, button, .kobayakawa-number-card, .kobayakawa-player-card, .kobayakawa-summary-item')) {
            const rect = element.getBoundingClientRect();
            if (!rect.width || !rect.height) continue;
            if (rect.left < -1 || rect.right > innerWidth + 1 || element.scrollWidth > element.clientWidth + 1) {
                failures.push(element.id || element.className || element.tagName);
            }
        }
        const help = document.getElementById('kobayakawaHelpBtn').getBoundingClientRect();
        const reconnect = document.getElementById('gameReconnectBtn').getBoundingClientRect();
        if (Math.abs(help.top + help.height / 2 - reconnect.top - reconnect.height / 2) > 2) failures.push('header wraps');
        return failures;
    });
    assert.deepEqual(failures, [], `${width}px ${label}: layout`);
}

async function checkPresentation(page, width, finalView) {
    if (!await page.locator('#roomControlsPanel').evaluate(panel => panel.classList.contains('collapsed'))) {
        await page.locator('#roomControlsToggleBtn').click();
    }
    await page.evaluate(() => {
        window.kobayakawaQaSent = [];
        window.kobayakawaQaSendAction = sendAction;
        sendAction = action => kobayakawaQaSent.push(action);
        const players = Array.from({ length: 6 }, (_, index) => ({
            player_id: `qa${index}`, name: index === 0 ? 'You' : index === 1 ? 'VeryLongUnbrokenPlayerNameForLayoutChecks' : `Player ${index + 1}`,
            tokens: index === 0 ? 6 : index === 1 ? 3 : 4, is_bot: false, action_done: false, bet_choice: null,
        }));
        window.kobayakawaQaView = {
            game_id: 'kobayakawa', you: 'qa0', phase: 'action', round: 1, current_turn: 'qa1', start_player: 'qa0',
            kobayakawa: 3, pot: 0, deck_count: 8, discard_pile: [], your_hand: 2, your_drawn: null, players,
            legal_actions: [], last_round_summary: null, winner: null, game_over: false,
            reserve: 8, round_reward: 1, final_round: false, fight_cost: 1,
        };
        renderKobayakawaGameState({ view: kobayakawaQaView });
    });
    await checkLayout(page, width, 'six players and long name');
    await page.locator('#kobayakawaHelpBtn').click();
    const help = page.locator('dialog.obg-help-dialog[open]');
    await help.locator('[data-obg-help-lang=en]').click();
    await help.locator('[data-obg-help-tab=ending]').click();
    assert.match(await help.textContent(), /strength bonus is not a token reward/);
    await help.locator('[data-obg-help-lang=zh]').click();
    assert.match(await help.textContent(), /牌力加成不是筹码奖励/);
    await page.keyboard.press('Escape');
    assert.equal(await help.count(), 0);
    await page.locator('#kobayakawaExplainBtn').click();
    const disabledDraw = await page.locator('#kobayakawaDrawBtn').boundingBox();
    await page.mouse.click(disabledDraw.x + disabledDraw.width / 2, disabledDraw.y + disabledDraw.height / 2);
    await page.locator('dialog.obg-explain-dialog[open]').waitFor();
    assert.deepEqual(await page.evaluate(() => kobayakawaQaSent), []);
    await page.keyboard.press('Escape');
    await page.locator('#kobayakawaExplainBtn').click();
    await page.locator('#kobayakawaCard').click();
    assert.match(await page.locator('dialog.obg-explain-dialog[open]').textContent(), /3/);
    await page.keyboard.press('Escape');
    const tooltipTarget = page.locator('.kobayakawa-pot').first();
    if (width < 600) await tooltipTarget.tap();
    else await tooltipTarget.hover();
    assert.equal(await page.locator('#kobayakawaTooltip').isVisible(), true);
    await page.waitForFunction(() => document.getElementById('kobayakawaTooltip').classList.contains('hidden'));
    await page.evaluate(() => {
        Object.assign(kobayakawaQaView, { current_turn: 'qa0', your_drawn: 15, legal_actions: ['keep_drawn', 'discard_drawn'] });
        renderKobayakawaGameState({ view: kobayakawaQaView });
    });
    await checkLayout(page, width, 'two-card choice');
    await page.screenshot({ path: `${output}/choice-${width}.png`, fullPage: true });
    await page.evaluate(() => {
        Object.assign(kobayakawaQaView, {
            phase: 'betting', your_drawn: null, round: 7, reserve: 2,
            round_reward: 2, final_round: true, fight_cost: 2, legal_actions: ['fight', 'pass'],
        });
        renderKobayakawaGameState({ view: kobayakawaQaView });
    });
    await checkLayout(page, width, 'final round');
    assert.equal(await page.locator('#kobayakawaReserve').textContent(), '2');
    assert.match(await page.locator('#kobayakawaFightBtn').textContent(), /−2/);
    assert.equal(await page.locator('#kobayakawaReward').textContent(), 'Winner +2');
    await page.mouse.move(0, 0);
    await page.keyboard.press('Escape');
    await page.screenshot({ path: `${output}/final-bet-${width}.png`, fullPage: true });
    await page.evaluate(() => {
        kobayakawaQaView.fight_cost = 1;
        renderKobayakawaGameState({ view: kobayakawaQaView });
    });
    assert.match(await page.locator('#kobayakawaFightBtn').textContent(), /−1/);
    await page.evaluate(() => {
        Object.assign(kobayakawaQaView, {
            round: 1, reserve: 7, round_reward: 1, final_round: false, fight_cost: 1, review_id: 1,
            phase: 'round_end', current_turn: null, your_drawn: null, round_ready: ['qa1', 'qa2'], legal_actions: ['next_round'],
            last_round_summary: {
                round: 1, result: 'showdown', winner: 'qa0', pot: 2, kobayakawa: 3, reserve_reward: 1,
                fighters: [{ player_id: 'qa0', hand: 2, final_score: 5, got_bonus: true }, { player_id: 'qa1', hand: 4, final_score: 4, got_bonus: false }],
                tokens: kobayakawaQaView.players.map((player, index) => ({
                    player_id: player.player_id, before: 4, paid: index < 2 ? 1 : 0, received: index === 0 ? 2 : 0,
                    reward: index === 0 ? 1 : 0, after: player.tokens,
                })),
            },
        });
        renderKobayakawaGameState({ view: kobayakawaQaView });
    });
    await checkLayout(page, width, 'settlement');
    assert.match(await page.locator('.kobayakawa-summary-item.winner').textContent(), /Strength: 2 \+ 3 bonus = 5/);
    assert.match(await page.locator('.kobayakawa-summary-item.winner').textContent(), /Tokens: 4 − 1 bet \+ 2 pot \+ 1 reward = 6 \(net \+2\)/);
    await page.screenshot({ path: `${output}/settlement-${width}.png`, fullPage: true });
    await page.locator('#kobayakawaNextBtn').click();
    assert.deepEqual(await page.evaluate(() => kobayakawaQaSent), [{ type: 'next_round', round: 1, review_id: 1 }]);
    assert.equal(await page.locator('#kobayakawaNextBtn').isDisabled(), true);
    await page.evaluate(() => {
        Object.assign(kobayakawaQaView, { you: 'spectator', legal_actions: [], your_hand: null });
        renderKobayakawaGameState({ view: kobayakawaQaView });
    });
    assert.equal(await page.locator('#kobayakawaNextBtn').isDisabled(), true);
    await page.evaluate(view => {
        sendAction = kobayakawaQaSendAction;
        renderKobayakawaGameState({ view });
    }, finalView);
}

(async () => {
    const browser = await chromium.launch({ channel: 'chrome', headless: true });
    const errors = [];
    fs.mkdirSync(output, { recursive: true });
    try {
        for (const width of [320, 390, 1024, 1440]) {
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
                    await page.locator('#nameInput').fill('Kobayakawa QA');
                    await page.locator('#playerNameForm button[type=submit]').click();
                }
                await page.locator('#gameSearchInput').fill('小早川');
                const item = page.locator('#gameList [data-game-id="kobayakawa"]');
                await item.waitFor();
                assert.equal(await page.locator('#gameList .game-item').count(), 1);
                assert.equal(await item.locator('.game-item-ai').textContent(), '🤖');
                assert.match(await item.getAttribute('aria-label'), /Strategic AI available/);
                await page.locator('#gameSortSelect').selectOption('difficulty_desc');
                await page.locator('#gameFilterDetails > summary').click();
                await page.locator('#playerCountFilter').selectOption('3');
                await page.locator('#gameFilterDetails > summary').click();
                const catalogFits = await item.evaluate(element => {
                    const row = element.getBoundingClientRect();
                    const badge = element.querySelector('.game-item-ai').getBoundingClientRect();
                    const text = element.querySelector('.game-item-name-text').getBoundingClientRect();
                    const meta = element.querySelector('.game-item-meta').getBoundingClientRect();
                    return row.left >= -1 && row.right <= innerWidth + 1 &&
                        element.scrollWidth <= element.clientWidth + 1 &&
                        badge.left >= text.right - 1 && badge.right <= meta.left + 1;
                });
                assert.equal(catalogFits, true, `${width}: catalog badge fits`);
                await page.screenshot({ path: `${output}/catalog-${width}.png` });
                await page.keyboard.press('Escape');
                assert.equal(await page.locator('#createRoomModal').isVisible(), false);
                await page.locator('#createBtn').click();
                await page.locator('#gameSearchInput').fill('Kobayakawa');
                await item.click();
                await page.waitForFunction(() => roomSessionReady && currentGameType === 'kobayakawa');
                await page.waitForFunction(() => isGameAssetsLoaded('kobayakawa'));
                if (!(await page.locator('#addBotBtn').isVisible())) {
                    await page.locator('#roomControlsToggleBtn').click();
                }
                for (const count of [2, 3]) {
                    await page.locator('#addBotBtn').click();
                    await page.waitForFunction(expected => currentRoomState.players.length === expected, count);
                }
                assert.equal(await page.locator('#startBtn').isEnabled(), true);
                await listen(page);
                await page.evaluate(() => socket.emit('room:start', {
                    room_id: roomId, config: { end_mode: 'rounds', round_limit: 2 },
                }));
                const botActions = [];
                for (let step = 0; step < 20; step += 1) {
                    await page.waitForFunction(() => typeof currentKobayakawaView !== 'undefined' &&
                        currentKobayakawaView && (currentKobayakawaView.game_over ||
                        (currentKobayakawaView.legal_actions.length > 0 &&
                         (currentKobayakawaView.phase !== 'round_end' || currentKobayakawaView.round_ready.length === 2))));
                    const view = await page.evaluate(() => currentKobayakawaView);
                    assert.equal(view.players.filter(player => player.is_bot).length, 2);
                    assert.equal('deck' in view, false);
                    assert(view.players.every(player => !('hand' in player) && !('drawn_card' in player)));
                    if (view.game_over) break;
                    if (view.phase === 'round_end') {
                        assert.equal(view.round, 1);
                        assert.equal(view.current_turn, null);
                        assert.equal(view.round_ready.length, 2);
                        assert(view.last_round_summary.tokens.every(balance => balance.after ===
                            view.players.find(player => player.player_id === balance.player_id).tokens));
                        await checkLayout(page, width, 'live round end');
                        await page.waitForTimeout(350);
                        assert.equal(await page.evaluate(() => currentKobayakawaView.phase), 'round_end');
                        if (width === 390) {
                            botActions.push(...await page.evaluate(() => kobayakawaAiActions));
                            await page.reload();
                            await page.waitForFunction(() => roomSessionReady && typeof currentKobayakawaView !== 'undefined' && currentKobayakawaView?.phase === 'round_end');
                            assert.deepEqual(await page.evaluate(() => currentKobayakawaView.last_round_summary), view.last_round_summary);
                            await listen(page);
                        }
                    }
                    if (step === 0) {
                        const fits = await page.locator('#kobayakawaPanel').evaluate(panel =>
                            panel.scrollWidth <= panel.clientWidth + 1 &&
                            document.documentElement.scrollWidth <= innerWidth + 1);
                        assert.equal(fits, true, `${width}: game fits`);
                        await page.screenshot({ path: `${output}/game-${width}.png`, fullPage: true });
                    }
                    const action = view.legal_actions[0];
                    await page.locator(actionSelectors[action]).click();
                    await page.waitForFunction(previous => JSON.stringify(currentKobayakawaView) !== previous,
                        JSON.stringify(view));
                    if (width === 390 && step === 0 && action === 'draw_card') {
                        const drawn = await page.evaluate(() => currentKobayakawaView.your_drawn);
                        botActions.push(...await page.evaluate(() => kobayakawaAiActions));
                        assert.deepEqual(await page.evaluate(() => kobayakawaAiErrors), []);
                        await page.reload();
                        await page.waitForFunction(() => roomSessionReady &&
                            typeof currentKobayakawaView !== 'undefined' && currentKobayakawaView?.your_drawn != null);
                        assert.equal(await page.evaluate(() => currentKobayakawaView.your_drawn), drawn);
                        await listen(page);
                    }
                }
                const finalView = await page.evaluate(() => currentKobayakawaView);
                assert.equal(finalView.game_over, true);
                assert.equal(finalView.round, 2);
                botActions.push(...await page.evaluate(() => kobayakawaAiActions));
                assert(botActions.some(action => ['draw_card', 'replace_kobayakawa'].includes(action)));
                assert(botActions.some(action => ['fight', 'pass'].includes(action)));
                assert.deepEqual(await page.evaluate(() => kobayakawaAiErrors), []);
                await checkPresentation(page, width, finalView);
                console.log(`${width}px: two-round game, review/reconnect, token ledger, Help/Explain, tooltips and six-player layouts passed`);
            } finally {
                await context.close();
            }
        }
        assert.deepEqual(errors, [], 'Browser errors');
    } finally {
        await browser.close();
    }
})().catch(error => { console.error(error); process.exitCode = 1; });
