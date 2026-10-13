// Run against uvicorn; PLAYWRIGHT_MODULE may point to an existing installation.
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const base = process.env.ROOM_TEST_URL || 'http://127.0.0.1:8774';
const output = 'build/room-controls-drawer';

(async () => {
    const browser = await chromium.launch({ channel: 'chrome', headless: true });
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.route('https://fonts.googleapis.com/**', route => route.abort());
    fs.mkdirSync(output, { recursive: true });
    const toggle = page.locator('#roomControlsToggleBtn');
    const collapse = page.locator('#roomControlsCollapseBtn');
    const body = page.locator('#roomControlsBody');
    async function setOpen(open) {
        if ((await toggle.getAttribute('aria-expanded') === 'true') !== open) {
            await (open ? toggle : collapse).click();
        }
        await page.waitForFunction(open => document.body.classList.contains('room-controls-drawer-open') === open, open);
    }
    async function geometry() {
        return page.evaluate(() => {
            const panel = document.getElementById('roomControlsPanel');
            const game = document.querySelector('.game-panel');
            const body = document.getElementById('roomControlsBody');
            const rect = element => {
                const r = element.getBoundingClientRect();
                return { x: r.x, y: r.y, width: r.width, height: r.height, bottom: r.bottom };
            };
            return {
                panel: rect(panel), game: rect(game), body: rect(body),
                overflow: document.documentElement.scrollWidth > innerWidth,
                bodyOverflow: body.scrollWidth > body.clientWidth,
                padding: getComputedStyle(game).paddingLeft,
                glass: getComputedStyle(panel).backdropFilter,
                inert: document.querySelector('.main').inert,
            };
        });
    }
    try {
        await page.goto(base);
        await page.waitForFunction(() => typeof socket !== 'undefined' && socket.connected && cachedGameList);
        await page.locator('#createBtn').click();
        await page.locator('#nameInput').fill('Crystal drawer mobile player');
        await page.locator('#playerNameForm button[type=submit]').click();
        await page.locator('#gameSearchInput').fill('citadels');
        await page.locator('[data-game-id="citadels"]').click();
        await page.waitForFunction(() => roomSessionReady && isGameAssetsLoaded('citadels') && !pendingRoomRequest);
        for (let i = 0; i < 3; i++) {
            await page.locator('#addBotBtn').click();
            await page.waitForFunction(() => !pendingRoomRequest);
        }
        await page.locator('#startBtn').click();
        await page.waitForFunction(() => currentRoomState?.status === 'in_game' && lastGameStatePayload?.game_type === 'citadels');
        assert.equal(await toggle.getAttribute('aria-expanded'), 'false', 'Starting a game closes the drawer');

        for (const viewport of [{ width: 320, height: 568 }, { width: 390, height: 844 }, { width: 430, height: 932 }, { width: 844, height: 390 }, { width: 900, height: 700 }]) {
            await page.setViewportSize(viewport);
            await setOpen(false);
            const closed = await geometry();
            assert.equal(closed.overflow, false);
            assert.equal(closed.panel.y, 0);
            assert.equal(closed.panel.x, 4);
            assert.equal(closed.game.x, 4);
            assert.equal(closed.game.width, viewport.width - 8);
            assert.equal(closed.padding, '6px');
            assert(closed.game.y >= closed.panel.bottom);
            assert(closed.panel.height <= 38, 'Collapsed bar stays compact');
            assert.equal(closed.inert, false);
            assert.equal(await collapse.isVisible(), false);
            assert.equal(await toggle.evaluate(element => getComputedStyle(element).fontSize), '0px', 'No Show or Hide label in the mobile bar');
            assert.equal((await page.locator('#mobileExplainSlot > button').boundingBox()).width, 64);
            await setOpen(true);
            await body.evaluate(element => Promise.all(element.getAnimations().map(animation => animation.finished)));
            const opened = await geometry();
            assert.equal(opened.game.y, closed.game.y, 'Opening the drawer must not move Game');
            assert.equal(opened.panel.y, 0);
            assert(opened.panel.height > closed.panel.height);
            assert(opened.panel.bottom <= viewport.height - 8);
            assert.equal(opened.overflow, false);
            assert.equal(opened.bodyOverflow, false);
            assert.equal(opened.inert, true);
            assert.equal(await toggle.evaluate(element => getComputedStyle(element).fontSize), '0px', 'No top Hide label while expanded');
            const toggleRect = await toggle.boundingBox();
            assert(toggleRect.y + toggleRect.height <= opened.body.y, 'Top bar toggle must not cover drawer controls');
            const collapseRect = await collapse.boundingBox();
            assert(collapseRect.y >= opened.body.bottom);
            assert(collapseRect.y + collapseRect.height <= opened.panel.bottom);
            assert.match(opened.glass, /blur/);
            if (viewport.width === 320) {
                await page.screenshot({ path: `${output}/mobile-320-expanded.png` });
            }
            if (viewport.width === 390) {
                await page.screenshot({ path: `${output}/mobile-expanded.png` });
                await setOpen(false);
                await page.screenshot({ path: `${output}/mobile-collapsed.png` });
            }
            if (viewport.height === 390) {
                await body.evaluate(element => { element.scrollTop = element.scrollHeight; });
                assert(await body.evaluate(element => element.scrollTop > 0), 'Landscape drawer scrolls internally');
                assert.equal((await collapse.boundingBox()).y, collapseRect.y, 'Bottom collapse control stays visible while the body scrolls');
                await page.screenshot({ path: `${output}/landscape-expanded.png` });
            }
            await page.keyboard.press('Escape');
            assert.equal(await toggle.getAttribute('aria-expanded'), 'false');
            console.log(`Top drawer: ${viewport.width} × ${viewport.height} passed`);
        }

        await page.setViewportSize({ width: 390, height: 844 });
        await setOpen(true);
        await page.locator('#roomControlsPanel button:visible').first().focus();
        await page.keyboard.press('Shift+Tab');
        assert(await page.evaluate(() => roomControlsPanel.contains(document.activeElement)));
        await page.keyboard.press('Tab');
        assert.equal(await page.evaluate(() => document.activeElement.id), await page.locator('#roomControlsPanel button:visible').first().getAttribute('id'));
        await page.mouse.click(2, 200);
        assert.equal(await toggle.getAttribute('aria-expanded'), 'false', 'Outside tap closes the drawer');

        await setOpen(true);
        await page.locator('#createBtn').click();
        await page.locator('#createRoomModal').waitFor({ state: 'visible' });
        await page.keyboard.press('Escape');
        assert.equal(await page.locator('#createRoomModal').isVisible(), false);
        assert.equal(await toggle.getAttribute('aria-expanded'), 'true', 'Escape closes the foreground modal first');
        await page.keyboard.press('Escape');
        assert.equal(await toggle.getAttribute('aria-expanded'), 'false');

        const explain = page.locator('#mobileExplainSlot > button');
        assert.equal(await explain.count(), 1);
        await explain.click();
        assert.equal(await toggle.getAttribute('aria-expanded'), 'false', 'Explain must not open the collapsed bar');
        await page.locator('#citadelsExplainModal').waitFor({ state: 'visible' });
        await page.keyboard.press('Escape');
        await setOpen(true);
        await explain.click();
        assert.equal(await toggle.getAttribute('aria-expanded'), 'false', 'Explain exposes the game');
        assert.equal(await page.locator('.main').evaluate(element => element.inert), false);
        await page.keyboard.press('Escape');

        // Tapping the title or outer padding toggles the drawer in both directions.
        for (const point of [{ x: 16, y: 17 }, { x: 6, y: 2 }, { x: 200, y: 32 }]) {
            await page.touchscreen.tap(point.x, point.y);
            assert.equal(await toggle.getAttribute('aria-expanded'), 'true', `Bar tap ${JSON.stringify(point)}`);
            await page.touchscreen.tap(point.x, point.y);
            assert.equal(await toggle.getAttribute('aria-expanded'), 'false', `Expanded bar tap ${JSON.stringify(point)}`);
        }
        await toggle.focus();
        await page.keyboard.press('Enter');
        assert.equal(await toggle.getAttribute('aria-expanded'), 'true');
        assert.equal(await page.evaluate(() => document.activeElement.id), 'roomControlsCollapseBtn');
        await page.keyboard.press('Space');
        assert.equal(await toggle.getAttribute('aria-expanded'), 'false');
        assert.equal(await page.evaluate(() => document.activeElement.id), 'roomControlsToggleBtn');

        await page.evaluate(() => window.scrollTo(0, 160));
        const scrolledY = await page.evaluate(() => scrollY);
        await toggle.click();
        assert.equal(await page.evaluate(() => scrollY), scrolledY, 'Opening preserves page scroll');
        await page.keyboard.press('Escape');
        assert.equal(await page.evaluate(() => scrollY), scrolledY, 'Closing preserves page scroll');

        for (const width of [901, 1280]) {
            await page.setViewportSize({ width, height: 900 });
            await page.waitForFunction(() => document.querySelector('#mobileExplainSlot').childElementCount === 0);
            await page.evaluate(() => setRoomControlsCollapsed(false));
            assert.equal(await page.locator('.main').evaluate(element => element.inert), false);
            assert.equal(await page.locator('#roomControlsBackdrop').isVisible(), false);
            assert.equal(await page.locator('#roomControlsPanel').evaluate(element => getComputedStyle(element).position), 'static');
            assert.equal(await page.locator('#mobileExplainSlot > button').count(), 0);
            assert.equal(await collapse.isVisible(), false);
            if (width === 1280) await page.screenshot({ path: `${output}/desktop-expanded.png` });
            await toggle.click();
            assert(await page.evaluate(() => document.body.classList.contains('room-controls-drawer-closed')));
            assert.equal((await geometry()).overflow, false);
        }
        await page.setViewportSize({ width: 390, height: 844 });
        await page.reload();
        await page.waitForFunction(() => roomSessionReady && lastGameStatePayload?.game_type === 'citadels');
        assert.equal(await toggle.getAttribute('aria-expanded'), 'false');
        await page.emulateMedia({ reducedMotion: 'reduce' });
        await setOpen(true);
        assert.equal(await body.evaluate(element => getComputedStyle(element).animationName), 'none');
        assert.deepEqual(errors, []);
        console.log('Focus, outside tap, Escape, modal stacking, Explain, desktop, reload, and reduced motion passed.');
    } finally {
        await context.close();
        await browser.close();
    }
})().catch(error => { console.error(error); process.exit(1); });
