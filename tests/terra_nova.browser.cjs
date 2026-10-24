// Run against the local server. PLAYWRIGHT_MODULE may point to an existing install.
const {chromium} = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const base = process.env.ROOM_TEST_URL || 'http://127.0.0.1:8767';
const output = 'tmp/terra-nova-ui';
const widths = [320, 390, 1024, 1440];

(async () => {
    fs.mkdirSync(output, {recursive: true});
    const browser = await chromium.launch({channel: 'chrome', headless: true});
    const pages = [], contexts = [], errors = [];
    const completed = [];
    async function newPage(touch = false) {
        const context = await browser.newContext({viewport: {width: touch ? 390 : 1440, height: 1000}, hasTouch: touch, isMobile: touch});
        contexts.push(context);
        const page = await context.newPage();
        page.on('pageerror', error => errors.push(error.message));
        await page.route('https://fonts.googleapis.com/**', route => route.abort());
        await page.goto(base);
        await page.waitForFunction(() => typeof socket !== 'undefined' && socket.connected && cachedGameList);
        return page;
    }
    const state = page => page.evaluate(() => lastGameStatePayload.view);
    const version = page => page.evaluate(() => lastGameStatePayload.state_version);
    async function send(page, option) {
        const before = await version(page);
        await page.evaluate(action => sendAction(action), option.action || option);
        await page.waitForFunction(n => lastGameStatePayload.state_version > n, before);
        const next = await version(page);
        await Promise.all(pages.map(p => p.waitForFunction(n => lastGameStatePayload.state_version >= n, next)));
    }
    async function actor() {
        const current = (await state(pages[0])).current_turn;
        for (const page of pages) if ((await state(page)).you === current) return page;
        throw new Error('No actor');
    }
    async function layout(page, width, suffix) {
        await page.setViewportSize({width, height: width <= 390 ? 900 : 1000});
        await page.evaluate(() => {setRoomControlsCollapsed(true); document.activeElement?.blur();});
        const bad = await page.evaluate(() => {
            const panel = document.getElementById('terraNovaPanel'), bounds = panel.getBoundingClientRect();
            return [...panel.querySelectorAll('*')].filter(node => {
                const r = node.getBoundingClientRect();
                if (!node.checkVisibility() || !r.width || !r.height || node.closest('svg, .tn-sr-only')) return false;
                // Vertically clipped lists are intentional. Their children must still fit horizontally.
                return r.left < bounds.left - 2 || r.right > bounds.right + 2;
            }).map(node => ({tag: node.tagName, id: node.id, class: node.className}));
        });
        assert.deepEqual(bad, [], `${suffix}: panel overflow at ${width}`);
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, `${suffix}: page overflow at ${width}`);
        await page.locator('#terraNovaPanel').screenshot({path: `${output}/${suffix}-${width}.png`});
    }
    async function closeModal(page) {
        await page.keyboard.press('Escape');
        assert.equal(await page.locator('#terraNovaModal').isVisible(), false);
    }
    async function confirm(page, width, method) {
        await layout(page, width, 'choice');
        const list = page.locator('#terraNovaActions');
        await list.evaluate(node => {node.scrollTop = node.scrollHeight;});
        const option = list.locator('button:not(:disabled)').last();
        await option.scrollIntoViewIfNeeded();
        const before = await list.evaluate(node => node.scrollTop);
        const stageBefore = await page.locator('.tn-action-stage').boundingBox();
        const rev = await version(page);
        await option.click();
        assert.equal(await page.locator('.tn-confirm').isVisible(), true);
        const geometry = await page.locator('.tn-confirm').evaluate(node => {
            const s = node.closest('.tn-action-stage').getBoundingClientRect(), r = node.getBoundingClientRect();
            return {sameHeight: Math.abs(s.height - r.height) < 2, contained: r.left >= s.left - 1 && r.top >= s.top - 1 && r.right <= s.right + 1 && r.bottom <= s.bottom + 1,
                buttonsInside: [...node.querySelectorAll('button')].every(button => {const b = button.getBoundingClientRect(); return b.left >= r.left && b.right <= r.right && b.top >= r.top && b.bottom <= r.bottom + 1;})};
        });
        assert.equal(geometry.contained, true, `Confirmation is in place at ${width}`);
        assert.equal(geometry.buttonsInside, true, `Confirmation buttons fit at ${width}`);
        assert.ok(Math.abs((await page.locator('.tn-action-stage').boundingBox()).height - stageBefore.height) < 2, `No confirmation layout jump at ${width}`);
        assert.ok(Math.abs(await list.evaluate(node => node.scrollTop) - before) < 2, `List retains scroll position at ${width}`);
        await layout(page, width, 'confirmation');
        await page.locator('#terraNovaExplainBtn').click();
        assert.equal(await page.locator('.tn-confirm').isVisible(), true, 'Entering Explain preserves selection');
        await page.locator('.tn-confirm').evaluate(node => node.scrollIntoView({block: 'center', behavior: 'instant'}));
        const blank = await page.locator('.tn-confirm').evaluate(node => {
            const r = node.getBoundingClientRect();
            for (let y = Math.max(40, r.top + 8); y < Math.min(innerHeight - 8, r.bottom - 8); y += 8) {
                for (let x = r.left + 8; x < r.right - 8; x += 8) if (document.elementFromPoint(x, y) === node) return {x, y};
            }
            return null;
        });
        assert.ok(blank, 'Confirmation has a visible background');
        await page.mouse.click(blank.x, blank.y);
        assert.equal(await page.locator('#terraNovaModal').isVisible(), false, 'Confirmation background does not explain a covered card');
        assert.equal(await page.locator('#terraNovaExplainBtn').getAttribute('aria-pressed'), 'true');
        assert.equal(await page.locator('.tn-confirm').isVisible(), true);
        assert.equal(await version(page), rev);
        await page.keyboard.press('Escape');
        if (method === 'blank') await page.locator('#terraNovaStatus .tn-badge').first().click();
        else if (method === 'escape') await page.keyboard.press('Escape');
        else await page.locator('.tn-confirm button').filter({hasText: 'Cancel'}).click();
        assert.equal(await page.locator('.tn-confirm').count(), 0, `${method} cancels selection`);
        assert.equal(await version(page), rev, 'Cancellation sends no game action');
        assert.ok(Math.abs(await list.evaluate(node => node.scrollTop) - before) < 2, 'Cancel preserves list scroll position');
    }
    async function tips(page, touch) {
        const first = page.locator('.tn-player.tn-is-you .tn-resource').first();
        const second = page.locator('.tn-player.tn-is-you .tn-resource').nth(1);
        if (touch) await first.tap(); else await first.hover();
        assert.equal(await page.locator('.tn-tooltip').isVisible(), true);
        assert.match(await page.locator('.tn-tooltip').textContent(), /金币/);
        if (touch) await second.tap(); else await second.hover();
        assert.match(await page.locator('.tn-tooltip').textContent(), /航运/);
        await page.waitForTimeout(3150);
        assert.equal(await page.locator('.tn-tooltip').isVisible(), false);
    }
    async function touchGestures(page, width) {
        await page.setViewportSize({width, height: 900});
        await page.evaluate(() => setRoomControlsCollapsed(true));
        const cdp = await page.context().newCDPSession(page);
        try {
            const list = page.locator('#terraNovaActions');
            await list.locator('button:not(:disabled)').first().tap();
            const confirmation = page.locator('.tn-confirm');
            assert.equal(await confirmation.isVisible(), true);
            await confirmation.evaluate(node => node.scrollIntoView({block: 'center', behavior: 'instant'}));
            const start = await page.evaluate(() => ({x: document.getElementById('terraNovaPanel').getBoundingClientRect().left + 4, y: 400, scroll: scrollY}));
            await cdp.send('Input.dispatchTouchEvent', {type: 'touchStart', touchPoints: [{x: start.x, y: start.y, id: 1}]});
            for (let i = 1; i <= 8; i++) {
                await cdp.send('Input.dispatchTouchEvent', {type: 'touchMove', touchPoints: [{x: start.x, y: start.y + i * 16, id: 1}]});
                await page.waitForTimeout(25);
            }
            await cdp.send('Input.dispatchTouchEvent', {type: 'touchEnd', touchPoints: []});
            await page.waitForTimeout(250);
            assert.ok(Math.abs((await page.evaluate(() => scrollY)) - start.scroll) > 20, 'Outside-map touch scrolls page');
            assert.equal(await confirmation.isVisible(), true, 'Page swipe preserves selection');
            await page.keyboard.press('Escape');
            const map = page.locator('#terraNovaMapViewport');
            await map.evaluate(node => node.scrollIntoView({block: 'center', behavior: 'instant'}));
            const r = await map.boundingBox(), mapStart = {x: r.x + r.width / 2, y: r.y + r.height / 2};
            const before = await page.evaluate(() => ({scroll: scrollY, transform: document.getElementById('terraNovaMapLayer').getAttribute('transform')}));
            await cdp.send('Input.dispatchTouchEvent', {type: 'touchStart', touchPoints: [{...mapStart, id: 2}]});
            for (let i = 1; i <= 8; i++) {
                await cdp.send('Input.dispatchTouchEvent', {type: 'touchMove', touchPoints: [{x: mapStart.x + i * 9, y: mapStart.y - i * (r.height / 2 + 24) / 8, id: 2}]});
            }
            await cdp.send('Input.dispatchTouchEvent', {type: 'touchEnd', touchPoints: []});
            const after = await page.evaluate(() => ({scroll: scrollY, transform: document.getElementById('terraNovaMapLayer').getAttribute('transform'), dragging: document.getElementById('terraNovaMapViewport').classList.contains('tn-dragging'), selected: document.querySelectorAll('.tn-cell.tn-selected').length}));
            assert.equal(after.scroll, before.scroll, 'Map drag takes touch ownership');
            assert.notEqual(after.transform, before.transform, 'Map actually pans');
            assert.equal(after.dragging, false, 'Map gesture ends after pointerup outside the map');
            assert.equal(after.selected, 0, 'Map drag does not select a cell');
            await page.waitForTimeout(500);
            await page.locator('#terraNovaResetMap').tap();
            await map.evaluate(node => node.scrollIntoView({block: 'center', behavior: 'instant'}));
            const pinchBounds = await map.boundingBox(), cx = pinchBounds.x + pinchBounds.width / 2, cy = pinchBounds.y + pinchBounds.height / 2;
            await cdp.send('Input.dispatchTouchEvent', {type: 'touchStart', touchPoints: [{x: cx - 28, y: cy, id: 3}, {x: cx + 28, y: cy, id: 4}]});
            for (let i = 1; i <= 5; i++) await cdp.send('Input.dispatchTouchEvent', {type: 'touchMove', touchPoints: [{x: cx - 28 - i * 7, y: cy, id: 3}, {x: cx + 28 + i * 7, y: cy, id: 4}]});
            await cdp.send('Input.dispatchTouchEvent', {type: 'touchEnd', touchPoints: []});
            assert.ok(await page.locator('#terraNovaMapLayer').evaluate(node => Number(node.getAttribute('transform').match(/scale\(([^)]+)\)/)[1]) > 1), 'Two-finger pinch changes map scale');
            await cdp.send('Input.dispatchTouchEvent', {type: 'touchStart', touchPoints: [{x: cx, y: cy, id: 5}]});
            await cdp.send('Input.dispatchTouchEvent', {type: 'touchMove', touchPoints: [{x: cx + 35, y: cy + 20, id: 5}]});
            await cdp.send('Input.dispatchTouchEvent', {type: 'touchCancel', touchPoints: []});
            assert.equal(await map.evaluate(node => node.classList.contains('tn-dragging')), false, 'Cancelled touch ends dragging');
            assert.equal(await page.locator('.tn-cell.tn-selected').count(), 0, 'Pinch/cancel does not select cells');
            await page.locator('[data-tn-cell]').first().focus();
            await page.keyboard.press('Enter');
            assert.equal(await page.locator('.tn-cell.tn-selected').count(), 1, 'Keyboard selection works after a drag/cancel');
            await page.keyboard.press('Escape');
            await page.waitForTimeout(500);
            await page.locator('#terraNovaResetMap').tap();
        } finally {await cdp.detach();}
    }
    try {
        for (let i = 0; i < 4; i++) pages.push(await newPage(i === 0));
        const host = pages[0];
        assert.equal(await host.locator('script[src*="/terra_nova.js"]').count(), 0, 'Game script is lazy');
        assert.equal(await host.locator('#terraNovaPanel').evaluate(n => n.children.length), 0, 'Initial panel is empty');
        await host.evaluate(() => socket.emit('room:create', {name: 'ExplorerWithAVeryLongUnbrokenName0123456789', game_type: 'terra_nova', config: {seed: 106921}}));
        await host.waitForFunction(() => roomSessionReady && isGameAssetsLoaded('terra_nova'));
        await host.evaluate(() => setRoomControlsCollapsed(true));
        await host.locator('#terraNovaHelpBtn').click();
        assert.equal(await host.locator('[data-tn-help-faction]').count(), 10, 'Lobby Help contains all ten factions before a game state exists');
        assert.match(await host.locator('#terraNovaModalBody').textContent(), /1 级得 2 分.*2 级得 3 分.*3 级得 4 分/);
        await closeModal(host);
        completed.push('lobby Help contains complete faction and sailing rules');
        const room = await host.evaluate(() => roomId);
        for (let i = 1; i < 4; i++) {
            await pages[i].evaluate(({room, i}) => socket.emit('room:join', {room_id: room, name: `Explorer${i}LongName0123456789`}), {room, i});
            await pages[i].waitForFunction(() => roomSessionReady && isGameAssetsLoaded('terra_nova'));
        }
        for (const page of pages) await page.evaluate(() => socket.emit('room:ready', {ready: true}));
        await host.waitForFunction(() => !document.getElementById('startBtn').disabled);
        await host.evaluate(() => setRoomControlsCollapsed(false));
        await host.locator('#startBtn').click();
        await Promise.all(pages.map(page => page.waitForFunction(() => lastGameStatePayload?.view?.game_id === 'terra_nova')));
        await Promise.all(pages.map(page => page.evaluate(() => setRoomControlsCollapsed(true))));
        const rules = await host.evaluate(() => TERRA_NOVA_RULES), publicView = await state(host);
        for (const key of Object.keys(rules)) assert.deepEqual(rules[key], publicView[key], `Lobby Help ${key} matches server rules`);
        completed.push('real four-player room, lazy loading, initial state and lobby rule-data consistency');
        const first = await actor();
        await first.locator('#terraNovaHelpBtn').click();
        assert.equal(await first.locator('#terraNovaModal').isVisible(), true);
        const help = await first.locator('#terraNovaModalBody').textContent();
        for (const text of ['金币(💰)', '魔力(🟣)', '城镇', '终局', '十个种族', '奖励片完整效果']) assert.ok(help.includes(text), text);
        for (const width of widths) {
            await first.setViewportSize({width, height: 900});
            const spill = await first.locator('#terraNovaModalBody').evaluate(node => {
                const bounds = node.getBoundingClientRect();
                return [...node.querySelectorAll('*')].filter(child => {
                    const r = child.getBoundingClientRect();
                    return r.width && r.height && (r.left < bounds.left - 1 || r.right > bounds.right + 1 || child.clientWidth > 0 && child.scrollWidth > child.clientWidth + 2);
                }).map(child => ({tag: child.tagName, class: child.className}));
            });
            assert.deepEqual(spill, [], `Help including income tables fits at ${width}`);
            await first.locator('#terraNovaModal').screenshot({path: `${output}/help-${width}.png`});
        }
        await closeModal(first);
        for (const [index, width] of widths.entries()) await confirm(first, width, ['blank', 'escape', 'button', 'button'][index]);
        completed.push('320/390/1024/1440 layout, Help, in-place confirmation, cancel and list position');
        // First faction selection creates disabled cards for the next player.
        await send(first, (await state(first)).action_options[0]);
        await host.setViewportSize({width: 320, height: 900});
        await host.locator('#terraNovaExplainBtn').click();
        const factionList = host.locator('#terraNovaActions');
        await factionList.evaluate(node => {node.scrollTop = 0; node.scrollIntoView({block: 'center', behavior: 'instant'});});
        const factionBounds = await factionList.boundingBox();
        const scrollCdp = await host.context().newCDPSession(host);
        const scrollX = factionBounds.x + factionBounds.width / 2, scrollY = factionBounds.y + factionBounds.height - 20;
        await scrollCdp.send('Input.dispatchTouchEvent', {type: 'touchStart', touchPoints: [{x: scrollX, y: scrollY, id: 8}]});
        for (let i = 1; i <= 6; i++) await scrollCdp.send('Input.dispatchTouchEvent', {type: 'touchMove', touchPoints: [{x: scrollX, y: scrollY - i * 20, id: 8}]});
        await scrollCdp.send('Input.dispatchTouchEvent', {type: 'touchEnd', touchPoints: []});
        await scrollCdp.detach();
        assert.ok(await factionList.evaluate(node => node.scrollTop) > 20, 'Explain allows real touch scrolling of choices');
        assert.equal(await host.locator('#terraNovaModal').isVisible(), false, 'Explain scrolling does not open an explanation');
        assert.equal(await host.locator('#terraNovaExplainBtn').getAttribute('aria-pressed'), 'true');
        await host.keyboard.press('Escape');
        const next = await actor();
        await next.locator('#terraNovaExplainBtn').click();
        const disabled = next.locator('.tn-option:disabled').first();
        await disabled.scrollIntoViewIfNeeded();
        const box = await disabled.boundingBox();
        await next.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
        assert.equal(await next.locator('#terraNovaModal').isVisible(), true, 'Disabled target supports Explain');
        assert.equal(await next.locator('#terraNovaExplainBtn').getAttribute('aria-pressed'), 'false', 'Explain exits after target');
        await closeModal(next);
        await next.evaluate(() => {const button = document.createElement('button'); button.id = 'terraNovaTestNoExplain'; button.textContent = 'Unexplained'; button.addEventListener('click', () => {window.terraNovaUnexpectedClick = true;}); document.getElementById('terraNovaActionsPanel').append(button);});
        await next.locator('#terraNovaExplainBtn').click();
        await next.locator('#terraNovaTestNoExplain').click();
        assert.equal(await next.evaluate(() => !!window.terraNovaUnexpectedClick), false);
        assert.equal(await next.locator('#terraNovaModal').isVisible(), false, 'Unexplained target does not inherit parent explanation');
        await next.keyboard.press('Escape');
        await next.evaluate(() => document.getElementById('terraNovaTestNoExplain').remove());
        completed.push('Explain disabled, automatic exit, no-explanation interception and Esc');
        while ((await state(host)).phase !== 'action') {
            const page = await actor(), current = await state(page);
            const selected = current.action_options[0];
            await send(page, selected);
            if (selected.action.type === 'setup_house') {
                assert.equal(await host.locator(`[data-tn-cell="${selected.action.cell_id}"].tn-recent`).count(), 1, 'New public building is highlighted');
                assert.equal(await host.locator('#terraNovaRecentEvent').isVisible(), true, 'Latest public action stays visible');
            }
        }
        const acting = await actor();
        assert.equal(await acting.locator('#roomControlsPanel').evaluate(n => n.classList.contains('collapsed')), true);
        const reminder = page => page.evaluate(() => {
            const docked = document.body.classList.contains('room-controls-docked');
            const node = docked ? document.getElementById('roomControlsPanel') : document.querySelector('#roomControlsPanel .collapse-btn');
            return {docked, border: getComputedStyle(node).borderTopColor, panel: getComputedStyle(document.getElementById('roomControlsPanel')).borderTopColor};
        });
        // Desktop: the closed drawer's Show tab is the dock. Mobile: the collapsed top bar is.
        let dock = await reminder(acting);
        assert.equal(dock.docked, false);
        assert.equal(dock.border, 'rgb(196, 63, 70)', 'Desktop Show tab turns red on your turn');
        await acting.setViewportSize({width: 390, height: 900});
        await acting.evaluate(() => setRoomControlsCollapsed(true));
        dock = await reminder(acting);
        assert.equal(dock.docked, true);
        assert.equal(dock.border, 'rgb(196, 63, 70)', 'Collapsed mobile dock turns red on your turn');
        await acting.evaluate(() => setRoomControlsCollapsed(false));
        assert.equal((await reminder(acting)).panel, 'rgba(180, 200, 224, 0.65)', 'Open drawer keeps its normal frame');
        await acting.evaluate(() => setRoomControlsCollapsed(true));
        const waiting = pages.find(p => p !== acting);
        await waiting.setViewportSize({width: 390, height: 900});
        await waiting.evaluate(() => setRoomControlsCollapsed(true));
        assert.notEqual((await reminder(waiting)).border, 'rgb(196, 63, 70)', 'Waiting players get no reminder');
        await waiting.setViewportSize({width: 1440, height: 1000});
        for (const width of widths) await layout(acting, width, 'playing');
        for (const width of widths) {
            await acting.setViewportSize({width, height: 1000});
            const power = acting.locator('[data-tn-power-source="coins"]');
            assert.equal(await power.isDisabled(), false, 'Public coin action is available in the real initial position');
            await power.scrollIntoViewIfNeeded();
            const before = await acting.locator('.tn-shared-stage').boundingBox(), rev = await version(acting);
            await power.click();
            const confirmation = acting.locator('#terraNovaSharedConfirmation .tn-confirm');
            assert.equal(await confirmation.isVisible(), true);
            assert.equal(await acting.locator('#terraNovaConfirmation .tn-confirm').count(), 0, 'Shared action confirms in its own section');
            const after = await acting.locator('.tn-shared-stage').boundingBox(), overlay = await confirmation.boundingBox();
            assert.ok(Math.abs(before.height - after.height) < 1, 'Shared action adds no layout height');
            assert.ok(overlay.x >= after.x - 1 && overlay.y >= after.y - 1 && overlay.x + overlay.width <= after.x + after.width + 1 && overlay.y + overlay.height <= after.y + after.height + 1, 'Shared confirmation stays in place');
            await layout(acting, width, 'shared-confirmation');
            await confirmation.locator('button').filter({hasText: 'Cancel'}).click();
            assert.equal(await confirmation.count(), 0);
            assert.equal(await version(acting), rev, 'Shared cancel sends no action');
        }
        completed.push('shared power confirmation at four widths, overlay Explain interception, latest public action/building highlights');
        await pages[1].setViewportSize({width: 1440, height: 1000});
        await tips(pages[1], false);
        while ((await state(host)).current_turn !== (await state(host)).you) {
            const turnPage = await actor();
            const turnOptions = (await state(turnPage)).action_options;
            await send(turnPage, turnOptions.find(o => o.action.type === 'pass') || turnOptions.find(o => o.action.type === 'end_turn'));
        }
        await tips(host, true);
        for (const width of [320, 390]) await touchGestures(host, width);
        completed.push('hover/touch tips replace and expire, RC alert, real page scroll/map pan at 320/390');
        const beforeReload = await state(host);
        await host.reload();
        await host.waitForFunction(() => isGameAssetsLoaded('terra_nova') && lastGameStatePayload?.view?.game_id === 'terra_nova');
        assert.equal((await state(host)).phase, beforeReload.phase);
        assert.equal((await state(host)).current_turn, beforeReload.current_turn);
        assert.equal(await host.locator('script[src*="/terra_nova.js"]').count(), 1);
        assert.equal(await host.locator('.tn-cell').count(), beforeReload.board.length);
        completed.push('refresh replays first state once');
        let reviews = 0;
        while (!(await state(host)).game_over) {
            const current = await state(host);
            if (current.phase === 'round_end') {
                reviews++;
                for (const width of widths) if (reviews === 1) await layout(host, width, 'round-review');
                for (let i = 0; i < pages.length; i++) {
                    const page = pages[i], before = await version(page);
                    await page.locator('[data-tn-action="next_round"]').click();
                    assert.equal(await page.locator('.tn-confirm').count(), 0, 'Next Round needs no confirmation');
                    await page.waitForFunction(n => lastGameStatePayload.state_version > n, before);
                    await Promise.all(pages.map(p => p.waitForFunction(n => lastGameStatePayload.state_version >= n, before + 1)));
                    assert.equal(await page.evaluate(() => document.body.classList.contains('terra-nova-needs-action')), false, 'Ready clears own action reminder');
                    if (i < pages.length - 1) {
                        assert.equal((await state(host)).phase, 'round_end', 'Round waits for every player');
                        assert.equal((await state(host)).next_ready.length, i + 1);
                    }
                }
            } else {
                const page = await actor(), currentActor = await state(page);
                const choice = currentActor.action_options.find(o => o.action.type === 'pass') || currentActor.action_options.find(o => o.action.type === 'end_turn') || currentActor.action_options[0];
                await send(page, choice);
            }
        }
        assert.equal(reviews, 5);
        for (const width of widths) await layout(host, width, 'final');
        completed.push('five round reviews, no extra confirmation, all-player barrier and final results');
        await host.evaluate(() => setRoomControlsCollapsed(false));
        await host.locator('#leaveBtn').click();
        await host.waitForFunction(() => !currentRoomState);
        await host.evaluate(() => socket.emit('room:create', {name: 'Lobby reset', game_type: 'terra_nova'}));
        await host.waitForFunction(() => roomSessionReady && currentRoomState.status === 'lobby' && isGameAssetsLoaded('terra_nova'));
        assert.equal(await host.locator('#terraNovaPlayers').evaluate(node => node.childElementCount), 0, 'New lobby clears players from previous game');
        assert.equal(await host.locator('#terraNovaReview').textContent(), '', 'New lobby clears previous final results');
        assert.equal(await host.locator('#terraNovaRecentEvent').textContent(), '', 'New lobby clears previous activity');
        assert.equal(await host.evaluate(() => document.body.classList.contains('terra-nova-needs-action')), false);
        await host.evaluate(() => setRoomControlsCollapsed(true));
        await host.locator('#terraNovaHelpBtn').click();
        assert.equal(await host.locator('[data-tn-help-faction]').count(), 10);
        await closeModal(host);
        completed.push('touch scrolling in Explain, pinch/cancel/keyboard recovery, Ready alert reset, leave/re-enter clears stale state');
        assert.deepEqual(errors, []);
        fs.writeFileSync(`${output}/result.json`, JSON.stringify({ok: true, widths, completed, errors}, null, 2));
        console.log(JSON.stringify({ok: true, completed}));
    } catch (error) {
        fs.writeFileSync(`${output}/result.json`, JSON.stringify({ok: false, widths, completed, errors, failure: error.message}, null, 2));
        throw error;
    } finally {
        for (const context of contexts) await context.close();
        await browser.close();
    }
})().catch(error => {console.error(error); process.exitCode = 1;});
