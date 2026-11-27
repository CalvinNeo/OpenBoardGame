const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const base = process.env.ROOM_TEST_URL || 'http://127.0.0.1:8766';
const output = 'tmp/ponzi-layout';
const fixtures = JSON.parse(execFileSync(process.env.PYTHON || 'python3', ['-m', 'tests.ponzi_scheme_ui_fixtures'], {
    cwd: path.join(__dirname, '..'), encoding: 'utf8',
}));

(async () => {
    fs.mkdirSync(output, { recursive: true });
    const browser = await chromium.launch({ channel: 'chrome', headless: true });
    const errors = [];
    const measurements = [];
    const contexts = [];
    async function newPage(mobile = false) {
        const context = await browser.newContext({ viewport: { width: mobile ? 390 : 1440, height: 900 }, hasTouch: mobile, isMobile: mobile });
        contexts.push(context);
        const page = await context.newPage();
        page.setDefaultTimeout(12000);
        page.on('pageerror', error => errors.push(error.message));
        await page.route('https://fonts.googleapis.com/**', route => route.abort());
        await page.goto(base);
        await page.waitForFunction(() => typeof socket !== 'undefined' && socket.connected);
        return page;
    }
    async function render(page, key) {
        await page.evaluate(view => {
            clearPonziSchemeState();
            renderPonziSchemeGameState({ view });
            document.getElementById('ponziSchemePanel').classList.remove('hidden');
        }, fixtures[key]);
    }
    async function measure(page, label, width) {
        const bounds = await page.evaluate(() => {
            const panel = document.getElementById('ponziSchemePanel');
            const visible = element => element.checkVisibility() && element.clientWidth;
            const overflow = [...panel.querySelectorAll('*')].filter(element => visible(element)
                && element.scrollWidth > element.clientWidth + 2
                && !/auto|scroll/.test(getComputedStyle(element).overflowX)).map(element => element.className || element.tagName);
            const outside = [...panel.querySelectorAll('*')].filter(element => {
                const rect = element.getBoundingClientRect();
                return visible(element) && (rect.left < -1 || rect.right > innerWidth + 1);
            }).map(element => element.className || element.tagName);
            const sections = [...panel.querySelectorAll('.ponzi-scheme-cash, .ponzi-scheme-review, .ponzi-scheme-market, .ponzi-scheme-portfolios, .ponzi-scheme-history')].filter(element => element.checkVisibility());
            const overlaps = sections.flatMap((element, index) => sections.slice(index + 1).filter(other => {
                const first = element.getBoundingClientRect();
                const second = other.getBoundingClientRect();
                return first.left < second.right - 1 && first.right > second.left + 1 && first.top < second.bottom - 1 && first.bottom > second.top + 1;
            }).map(other => `${element.className} / ${other.className}`));
            const reconnect = document.getElementById('gameReconnectBtn').getBoundingClientRect();
            const help = document.getElementById('ponziSchemeHelpBtn').getBoundingClientRect();
            return { overflow, outside, overlaps, fits: document.documentElement.scrollWidth <= innerWidth,
                header: help.top < reconnect.bottom && help.bottom > reconnect.top,
                height: Math.round(panel.getBoundingClientRect().height) };
        });
        assert.deepEqual(bounds.overflow, [], `${label} ${width}: overflow`);
        assert.deepEqual(bounds.outside, [], `${label} ${width}: outside viewport`);
        assert.deepEqual(bounds.overlaps, [], `${label} ${width}: overlapping sections`);
        assert.equal(bounds.fits, true, `${label} ${width}: page width`);
        assert.equal(bounds.header, true, `${label} ${width}: Help/Reconnect row`);
        measurements.push({ label, width, height: bounds.height });
    }
    const action = (page, name) => page.locator(`#ponziSchemePanel [data-ps-action="${name}"]`);
    async function selectedCard(page) {
        await action(page, 'industry').first().click();
        await page.locator('[data-ps-action="card"]:not(:disabled)').first().click();
    }
    try {
        const pages = [await newPage(), await newPage(true), await newPage()];
        const [page, mobile, other] = pages;
        await page.evaluate(() => socket.emit('room:create', { name: 'Alice', game_type: 'ponzi_scheme' }));
        await page.waitForFunction(() => roomSessionReady && isGameAssetsLoaded('ponzi_scheme'));
        const room = await page.evaluate(() => roomId);
        for (const [participant, name] of [[mobile, 'Bob'], [other, 'Catherine']]) {
            await participant.evaluate(({ room, name }) => socket.emit('room:join', { room_id: room, name }), { room, name });
            await participant.waitForFunction(() => roomSessionReady && isGameAssetsLoaded('ponzi_scheme'));
        }
        for (const participant of pages) await participant.evaluate(() => socket.emit('room:ready', { ready: true }));
        await page.waitForFunction(() => !document.getElementById('startBtn').disabled);
        await page.evaluate(() => socket.emit('room:start', {}));
        await page.waitForFunction(() => lastGameStatePayload?.view.phase === 'funding');
        await selectedCard(page);
        await page.locator('#ponziSchemeConfirm').click();
        await mobile.waitForFunction(() => lastGameStatePayload?.view.current_turn === playerId);
        await action(mobile, 'pass').click();
        await other.waitForFunction(() => lastGameStatePayload?.view.current_turn === playerId);
        await action(other, 'pass').click();
        await mobile.waitForFunction(() => lastGameStatePayload?.view.phase === 'market_remove');
        await action(mobile, 'card').first().click();
        await mobile.locator('#ponziSchemeConfirm').click();
        for (const participant of pages) {
            await participant.waitForFunction(() => lastGameStatePayload?.view.phase === 'round_end');
            assert.equal(await participant.locator('.ponzi-scheme-review [data-ps-action="next"]').count(), 1);
            await action(participant, 'next').click();
        }
        await page.waitForFunction(() => lastGameStatePayload?.view.round === 2 && lastGameStatePayload.view.phase === 'funding');
        for (const participant of [page, mobile]) await participant.evaluate(() => {
            window.ponziSchemeTestActions = [];
            sendAction = action => window.ponziSchemeTestActions.push(action);
            setRoomControlsCollapsed(true);
            syncRoomControlsExplainButton();
        });
        for (const width of [320, 390, 1024, 1440]) {
            const participant = width < 600 ? mobile : page;
            await participant.setViewportSize({ width, height: 900 });
            for (const key of Object.keys(fixtures)) {
                await render(participant, key);
                await measure(participant, key, width);
                if (['initial', 'trading', 'offer', 'review', 'game_over', 'stress'].includes(key)) {
                    await participant.screenshot({ path: `${output}/${key}-${width}.png`, fullPage: true });
                }
            }
            await render(participant, 'trading');
            await participant.locator('[data-ps-details="market"] > summary').click();
            assert.equal(await participant.locator('[data-ps-details="market"]').evaluate(element => element.open), true);
            await measure(participant, 'expanded-market', width);
            await action(participant, 'target').first().click();
            assert.equal(await participant.locator('[data-ps-details="market"]').evaluate(element => element.open), true);
            await measure(participant, 'selected-trade', width);
            await participant.screenshot({ path: `${output}/selected-trade-${width}.png`, fullPage: true });
            await participant.locator('#ponziSchemeHelpBtn').click();
            await participant.keyboard.press('Escape');
            assert.equal(await participant.locator('[data-obg-help-game="ponzi_scheme"]').evaluate(dialog => dialog.open), false);
            await render(participant, 'funding');
            await action(participant, 'industry').first().click();
            await participant.locator('[data-ps-action="card"]:not(:disabled)').first().click();
            assert.equal(await participant.locator('.ponzi-scheme-market-row #ponziSchemeConfirm').count(), 1);
            await measure(participant, 'selected', width);
            const distance = await participant.locator('.ponzi-scheme-market-row:has(#ponziSchemeConfirm)').evaluate(row => {
                return row.querySelector('#ponziSchemeConfirm').getBoundingClientRect().top - row.querySelector('.ponzi-scheme-market-cards').getBoundingClientRect().bottom;
            });
            assert(distance >= 0 && distance < 70, `confirmation next to selected row at ${width}`);
            await participant.screenshot({ path: `${output}/selected-${width}.png`, fullPage: true });
        }
        await render(page, 'basic_trading');
        await action(page, 'target').first().click();
        await action(page, 'industry').first().click();
        await page.locator('#ponziSchemeOfferAmount').fill('25');
        await page.locator('#ponziSchemeConfirm').click();
        assert.deepEqual(await page.evaluate(() => ponziSchemeTestActions.at(-1)), { type: 'offer_trade', target: 'bob', industry: 'transport', amount: 25 });
        await render(page, 'pass_only');
        assert.equal(await action(page, 'pass').count(), 1);
        await render(page, 'offer');
        await action(page, 'buy').click();
        assert.deepEqual(await page.evaluate(() => ponziSchemeTestActions.at(-1)), { type: 'respond_trade', response: 'buy' });
        await render(page, 'sell_only');
        assert.equal(await action(page, 'buy').isDisabled(), true);
        await action(page, 'sell').click();
        assert.equal(await page.evaluate(() => ponziSchemeTestActions.at(-1).response), 'sell');
        await render(page, 'trading');
        await action(page, 'luxury').first().click();
        await page.keyboard.press('Escape');
        assert.equal(await page.locator('#ponziSchemeDialog').evaluate(dialog => dialog.open), false);
        await action(page, 'luxury').first().click();
        await page.locator('[data-ps-action="confirm-luxury"]').click();
        assert.equal(await page.evaluate(() => ponziSchemeTestActions.at(-1).type), 'buy_luxury');
        await render(page, 'funding');
        await page.locator('#ponziSchemeHelpBtn').click();
        await page.locator('[data-obg-help-game="ponzi_scheme"] [data-obg-help-lang="en"]').click();
        await page.keyboard.press('Escape');
        assert.equal(await page.locator('[data-obg-help-game="ponzi_scheme"]').evaluate(dialog => dialog.open), false);
        const beforeExplain = await page.evaluate(() => ponziSchemeTestActions.length);
        await page.evaluate(() => ponziSchemeExplainWidget.enter());
        const confirmBounds = await page.locator('#ponziSchemeConfirm').boundingBox();
        await page.mouse.click(confirmBounds.x + confirmBounds.width / 2, confirmBounds.y + confirmBounds.height / 2);
        assert.equal(await page.locator('.obg-explain-dialog').evaluate(dialog => dialog.open), true);
        assert.equal(await page.evaluate(() => ponziSchemeExplainWidget.isActive()), false);
        assert.equal(await page.evaluate(() => ponziSchemeTestActions.length), beforeExplain);
        await page.keyboard.press('Escape');
        await selectedCard(page);
        const marketBounds = await page.locator('.ponzi-scheme-market').boundingBox();
        await page.mouse.click(marketBounds.x + marketBounds.width + 10, marketBounds.y + 50);
        assert.equal(await page.locator('.ponzi-scheme-market .is-selected').count(), 0);
        await render(page, 'stress');
        await page.locator('[data-ps-details="debt-alice"] summary').click();
        await page.locator('[data-ps-details="history"] summary').click();
        await action(page, 'industry').first().click();
        assert.equal(await page.locator('[data-ps-details="debt-alice"]').evaluate(element => element.open), true);
        assert.equal(await page.locator('[data-ps-details="history"]').evaluate(element => element.open), true);
        await measure(page, 'expanded-stress', 1440);
        await render(mobile, 'stress');
        await mobile.locator('[data-ps-details="debt-alice"] summary').click();
        await mobile.locator('[data-ps-details="history"] summary').click();
        await measure(mobile, 'expanded-stress', 390);
        await render(mobile, 'funding');
        await mobile.setViewportSize({ width: 390, height: 900 });
        const card = mobile.locator('[data-ps-action="card"]:not(:disabled)').first();
        await card.scrollIntoViewIfNeeded();
        const cardBounds = await card.boundingBox();
        const session = await mobile.context().newCDPSession(mobile);
        const horizontal = cardBounds.x + cardBounds.width / 2;
        const vertical = cardBounds.y + cardBounds.height / 2;
        await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: horizontal, y: vertical, id: 1 }] });
        for (let step = 1; step <= 5; step += 1) await session.send('Input.dispatchTouchEvent', {
            type: 'touchMove', touchPoints: [{ x: horizontal, y: vertical - step * 12, id: 1 }],
        });
        await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
        assert.equal(await mobile.locator('.ponzi-scheme-market .is-selected').count(), 0);
        await session.detach();
        await mobile.locator('.ponzi-scheme-bears').tap();
        assert.equal(await mobile.locator('#ponziSchemeImmediateTip').isVisible(), true);
        await mobile.waitForTimeout(3200);
        assert.equal(await mobile.locator('#ponziSchemeImmediateTip').isVisible(), false);
        assert.deepEqual(errors, []);
        fs.writeFileSync(`${output}/measurements.json`, JSON.stringify(measurements, null, 2));
        console.log(`PASS: real three-player round, ${measurements.length} layout checks, contextual confirmation, trade, luxury, Help/Explain, details and touch gestures.`);
    } finally {
        for (const context of contexts) await context.close();
        await browser.close();
    }
})().catch(error => { console.error(error); process.exitCode = 1; });
