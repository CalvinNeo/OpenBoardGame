// Run against uvicorn; PLAYWRIGHT_MODULE can point to an existing installation.
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const base = process.env.ROOM_TEST_URL || 'http://127.0.0.1:8780';
const output = 'build/room-controls-dock';

(async () => {
    const browser = await chromium.launch({ channel: 'chrome', headless: true });
    const context = await browser.newContext({ viewport: { width: 1024, height: 768 } });
    const page = await context.newPage();
    page.setDefaultTimeout(10000);
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.route('https://fonts.googleapis.com/**', route => route.abort());
    fs.mkdirSync(output, { recursive: true });
    const panel = page.locator('#roomControlsPanel');
    const toggle = page.locator('#roomControlsToggleBtn');

    async function bounds() {
        return panel.evaluate(element => {
            const r = element.getBoundingClientRect();
            return {
                x: r.x, y: r.y, width: r.width, height: r.height,
                vw: document.documentElement.clientWidth, vh: document.documentElement.clientHeight,
            };
        });
    }

    function withinViewport(r) {
        assert(r.x >= -1 && r.y >= -1, JSON.stringify(r));
        assert(r.x + r.width <= r.vw + 1 && r.y + r.height <= r.vh + 1, JSON.stringify(r));
    }

    function onEdge(r, side) {
        withinViewport(r);
        const gap = { left: r.x, right: r.vw - r.x - r.width, top: r.y, bottom: r.vh - r.y - r.height }[side];
        assert(Math.abs(gap) < 1, side + ': ' + JSON.stringify(r));
    }

    async function topmost(selector = '#roomControlsToggleBtn') {
        await page.waitForFunction(selector => {
            const element = document.querySelector(selector);
            const r = element.getBoundingClientRect();
            return element.contains(document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2));
        }, selector);
    }

    async function assertRoomControlPopupAbove(selector) {
        const result = await page.locator(selector).evaluate((popup) => {
            const panel = document.querySelector('#roomControlsPanel');
            const panelRect = panel.getBoundingClientRect();
            const popupRect = popup.getBoundingClientRect();
            const overlapLeft = Math.max(panelRect.left, popupRect.left);
            const overlapRight = Math.min(panelRect.right, popupRect.right);
            const overlapTop = Math.max(panelRect.top, popupRect.top);
            const overlapBottom = Math.min(panelRect.bottom, popupRect.bottom);
            const x = (overlapLeft + overlapRight) / 2;
            const y = (overlapTop + overlapBottom) / 2;
            const hit = x < overlapRight && y < overlapBottom ? document.elementFromPoint(x, y) : null;
            return {
                popupParent: popup.parentElement?.className,
                popupZ: getComputedStyle(popup).zIndex,
                panelZ: getComputedStyle(panel).zIndex,
                hitPopup: Boolean(hit && popup.contains(hit)),
            };
        });
        assert.equal(result.popupParent, 'room-controls-layer', `${selector} stays in the RC top layer`);
        assert(Number(result.popupZ) > Number(result.panelZ), `${selector} must be above the RC panel`);
        assert.equal(result.hitPopup, true, `${selector} must receive hit testing above the RC panel`);
    }

    async function dragTo(side, fraction) {
        const start = await bounds();
        const vertical = side === 'left' || side === 'right';
        const destination = vertical
            ? { x: side === 'left' ? 1 : start.vw - 1, y: start.vh * fraction }
            : { x: start.vw * fraction, y: side === 'top' ? 1 : start.vh - 1 };
        await page.mouse.move(start.x + start.width / 2, start.y + start.height / 2);
        await page.mouse.down();
        await page.mouse.move(start.vw * 0.4, start.vh * 0.45, { steps: 5 });
        const moving = await bounds();
        assert(Math.abs(moving.x + moving.width / 2 - start.vw * 0.4) < 1, 'Drag follows the mouse horizontally: ' + JSON.stringify({ side, start, moving }));
        assert(Math.abs(moving.y + moving.height / 2 - start.vh * 0.45) < 1, 'Drag follows the mouse vertically: ' + JSON.stringify({ side, start, moving }));
        await page.mouse.move(destination.x, destination.y, { steps: 5 });
        withinViewport(await bounds());
        await page.mouse.up();
        const docked = await bounds();
        onEdge(docked, side);
        const size = vertical ? docked.height : docked.width;
        const length = vertical ? docked.vh : docked.vw;
        const expected = Math.max(0, Math.min(length - size, length * fraction - size / 2));
        assert(Math.abs((vertical ? docked.y : docked.x) - expected) < 1, 'Drop preserves the position along ' + side);
        assert.equal(await toggle.getAttribute('aria-expanded'), 'false', 'Dragging must not click Show RC');
        assert.equal(await page.locator('#settingsModal').isVisible(), false, 'Dragging must not click Settings');
        return docked;
    }

    try {
        await page.goto(base);
        await page.waitForFunction(() => typeof socket !== 'undefined' && socket.connected && cachedGameList);
        for (const viewport of [{ width: 1024, height: 768 }, { width: 1440, height: 900 }]) {
            await page.setViewportSize(viewport);
            await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
            for (const side of ['left', 'right', 'top', 'bottom']) {
                for (const fraction of [0.25, 0.75]) {
                    const docked = await dragTo(side, fraction);
                    await toggle.click();
                    onEdge(await bounds(), side);
                    await topmost();
                    await toggle.click();
                    const restored = await bounds();
                    assert(Math.abs(restored.x - docked.x) < 1 && Math.abs(restored.y - docked.y) < 1, 'Show/Hide preserves the dock location');
                }
            }
            for (const side of ['left', 'right', 'top', 'bottom']) {
                await dragTo(side, side === 'left' || side === 'bottom' ? 0 : 1);
                await toggle.click();
                onEdge(await bounds(), side);
                await toggle.click();
            }
            await dragTo('right', 0.7);
            const beforeReload = await bounds();
            await page.reload();
            await page.waitForFunction(() => socket.connected && cachedGameList);
            const afterReload = await bounds();
            onEdge(afterReload, 'right');
            assert(Math.abs(beforeReload.y - afterReload.y) < 1, 'Both side and position survive reload');
            console.log('Dock positions, corners, Show/Hide, and reload: ' + viewport.width + ' passed');
        }

        // The grip is near the edge, so a drop must not recenter under the mouse.
        await dragTo('left', 0.4);
        const grip = await page.locator('#roomControlsDragHandle').boundingBox();
        const beforeGrip = await bounds();
        await page.mouse.move(grip.x + grip.width / 2, grip.y + grip.height / 2);
        await page.mouse.down();
        await page.mouse.move(grip.x + grip.width / 2, grip.y + grip.height / 2 + 140, { steps: 5 });
        await page.mouse.up();
        assert(Math.abs((await bounds()).y - beforeGrip.y - 140) < 1, 'Dropping from the grip does not jump');

        await dragTo('right', 0.7);
        await page.setViewportSize({ width: 1024, height: 768 });
        await page.waitForFunction(() => {
            const r = document.getElementById('roomControlsPanel').getBoundingClientRect();
            return Math.abs(r.y + r.height / 2 - document.documentElement.clientHeight * 0.7) < 1;
        });
        await page.evaluate(() => {
            const main = document.querySelector('.main');
            main.style.minHeight = '2200px';
            document.querySelector('.container').style.transform = 'translateX(12px)';
            window.scrollTo(0, 700);
        });
        onEdge(await bounds(), 'right');
        await dragTo('bottom', 0.7);
        onEdge(await bounds(), 'bottom');
        await page.evaluate(() => {
            document.querySelector('.main').style.removeProperty('min-height');
            document.querySelector('.container').style.removeProperty('transform');
            window.scrollTo(0, 0);
        });

        // A full-screen document overlay must not obscure or intercept RC.
        await page.evaluate(() => {
            const overlay = document.createElement('div');
            overlay.id = 'dock-test-overlay';
            overlay.style.cssText = 'position:fixed;inset:0;z-index:2147483647;background:#1234';
            document.body.append(overlay);
        });
        await topmost();
        await toggle.click();
        await topmost('#createBtn');
        await toggle.click();
        await page.evaluate(() => document.getElementById('dock-test-overlay').remove());

        // Use a real game's native Help dialog to cover browser top-layer stacking.
        await dragTo('left', 0.6);
        await toggle.click();
        await page.locator('#createBtn').click();
        await page.evaluate(() => setRoomControlsCollapsed(true));
        await page.locator('#nameInput').fill('Desktop dock regression');
        await page.locator('#playerNameForm button[type=submit]').click();
        await page.waitForFunction(() => !document.querySelector('#createRoomModal').classList.contains('hidden'));
        await assertRoomControlPopupAbove('#createRoomModal');
        await page.locator('#createRoomModalCloseBtn').click();
        await page.locator('#settingsBtn').click();
        await page.locator('#logOpenBtn').click();
        await assertRoomControlPopupAbove('#logPanel');
        await page.locator('#logCloseBtn').click();
        await toggle.click();
        await page.locator('#createBtn').click();
        await page.locator('#gameSearchInput').fill('No Thanks');
        await page.locator('[data-game-id="no_thanks"]').click();
        await page.waitForFunction(() => roomSessionReady && isGameAssetsLoaded('no_thanks') && !pendingRoomRequest);
        await page.evaluate(() => setRoomControlsCollapsed(false));
        for (let i = 0; i < 2; i++) {
            await page.locator('#addBotBtn').click();
            await page.waitForFunction(() => !pendingRoomRequest);
        }
        await page.locator('#startBtn').click();
        await page.waitForFunction(() => currentRoomState?.status === 'in_game');
        await page.locator('#noThanksHelpBtn').click();
        await page.waitForFunction(() => document.getElementById('noThanksDialog').matches(':modal'));
        await topmost();
        await toggle.click();
        await topmost('#createBtn');
        withinViewport(await bounds());
        await page.screenshot({ path: output + '/desktop-1024-rc-above-help.png' });
        await toggle.click();
        await page.locator('#settingsBtn').click();
        await topmost('#settingsCloseBtn');
        await assertRoomControlPopupAbove('#settingsModal');
        await page.locator('#settingsCloseBtn').click();
        await page.keyboard.press('Escape');
        await page.waitForFunction(() => !document.getElementById('noThanksDialog').open);
        await topmost();

        // A subsequently opened manual popover also stays below the dock.
        await page.evaluate(() => {
            const popup = document.createElement('div');
            popup.id = 'dock-test-popover';
            popup.popover = 'manual';
            popup.style.cssText = 'position:fixed;inset:0;margin:0;width:auto;height:auto;background:#1234';
            document.body.append(popup);
            popup.showPopover();
        });
        await topmost();
        await toggle.click();
        await topmost('#createBtn');
        await toggle.click();
        await page.evaluate(() => document.getElementById('dock-test-popover').remove());

        await page.setViewportSize({ width: 1440, height: 900 });
        await dragTo('bottom', 0.72);
        await page.screenshot({ path: output + '/desktop-1440-dock.png' });
        for (const width of [320, 390]) {
            await page.setViewportSize({ width, height: 844 });
            await page.waitForFunction(() => !document.querySelector('.room-controls-layer'));
            assert.equal(await panel.evaluate(e => e.parentElement.className), 'sidebar');
            const r = await bounds();
            assert.equal(r.y, 0);
            assert.equal(r.x, 4);
            assert.equal(r.width, width - 8);
            await toggle.click();
            withinViewport(await bounds());
            await page.keyboard.press('Escape');
        }
        assert.deepEqual(errors, []);
        console.log('Grip, resize, scrolling, stacking, native Help, Settings, and mobile restoration passed.');
    } finally {
        await context.close();
        await browser.close();
    }
})().catch(error => { console.error(error); process.exit(1); });
