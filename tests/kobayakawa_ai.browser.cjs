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
                await page.locator('#playerCountFilter').selectOption('3');
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
                        currentKobayakawaView.legal_actions.length > 0));
                    const view = await page.evaluate(() => currentKobayakawaView);
                    assert.equal(view.players.filter(player => player.is_bot).length, 2);
                    assert.equal('deck' in view, false);
                    assert(view.players.every(player => !('hand' in player) && !('drawn_card' in player)));
                    if (view.game_over) break;
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
                console.log(`${width}px: AI badge, search/filter, Add Bot, private hands and two-round game passed`);
            } finally {
                await context.close();
            }
        }
        assert.deepEqual(errors, [], 'Browser errors');
    } finally {
        await browser.close();
    }
})().catch(error => { console.error(error); process.exitCode = 1; });
