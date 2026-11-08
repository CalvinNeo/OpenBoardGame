const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const base = process.env.ROOM_TEST_URL || 'http://127.0.0.1:8766';
const output = 'build/bomb-busters-ui/after';

function makeView(playerCount, preset, viewer, phase = 'playing') {
    const ownSeat = 1;
    const blueMax = preset === 'short' ? 6 : 12;
    const yellowPositions = preset === 'short' ? [] : preset === 'high-risk' ? [1.1, 4.1, 8.1, 11.1] : [1.1, 11.1];
    const redPositions = preset === 'short' ? [] : preset === 'high-risk' ? [2.5, 7.5, 10.5] : [10.5];
    const players = Array.from({length: playerCount}, (_, index) => ({
        player_id: index === ownSeat ? viewer : `teammate-${index}`,
        name: index === ownSeat ? 'Your wires' : `Teammate ${index + 1}`,
        seat: index,
        is_captain: index === ownSeat,
        is_bot: index === playerCount - 1 && index !== ownSeat,
        personal_detector_used: false,
        remaining_count: 0,
    }));
    const racks = players.flatMap((player, index) => Array.from({length: playerCount === 2 || playerCount === 3 && index === ownSeat ? 2 : 1}, (_, rackIndex) => ({
        rack_id: `${player.player_id}-${rackIndex}`,
        owner_id: player.player_id,
        rack_index: rackIndex,
        slots: [],
    })));
    const pool = Array.from({length: blueMax * 4}, (_, index) => ({kind: 'blue', blue_value: Math.floor(index / 4) + 1, sort_label: String(Math.floor(index / 4) + 1)}));
    for (const position of yellowPositions) pool.push({kind: 'yellow', sort_label: String(position)});
    for (const position of redPositions) pool.push({kind: 'red', sort_label: String(position)});
    pool.forEach((wire, index) => racks[index % racks.length].slots.push(wire));
    racks.forEach(rack => {
        rack.slots.sort((first, second) => Number(first.sort_label) - Number(second.sort_label));
        rack.slots = rack.slots.map((wire, slotIndex) => {
            const publicWire = {
                wire_id: `${rack.rack_id}-wire-${slotIndex}`,
                slot_index: slotIndex,
                status: phase === 'mission_result' ? wire.kind === 'red' ? 'secured' : 'cut' : 'uncut',
                hidden: rack.owner_id !== viewer && phase !== 'mission_result',
                public_info: slotIndex === 0 ? String(wire.blue_value) : null,
            };
            return publicWire.hidden ? publicWire : {...publicWire, ...wire};
        });
    });
    players.forEach(player => {
        player.remaining_count = racks.filter(rack => rack.owner_id === player.player_id).reduce((count, rack) => count + rack.slots.filter(wire => wire.status === 'uncut').length, 0);
    });
    const ownWires = racks.filter(rack => rack.owner_id === viewer).flatMap(rack => rack.slots);
    return {
        you: viewer,
        players,
        racks,
        phase,
        current_turn: viewer,
        captain_id: viewer,
        practice: {name: `${preset === 'high-risk' ? 'High Risk' : preset === 'short' ? 'Short' : 'Standard'} Practice`},
        mission_number: 1,
        attempt_number: 1,
        initial_info_player_id: viewer,
        initial_info_candidate_wire_ids: ownWires.filter(wire => wire.kind === 'blue').map(wire => wire.wire_id),
        current_responder_id: phase === 'awaiting_detector_choice' ? viewer : null,
        pending_choice_wire_ids: ownWires.slice(0, 2).map(wire => wire.wire_id),
        pending_choice_purpose: 'cut',
        legal_actions: phase === 'initial_info' ? ['place_initial_info'] : phase === 'awaiting_detector_choice' ? ['resolve_detector_choice'] : phase === 'mission_result' ? ['continue_mission'] : ['dual_cut', 'double_detector_cut'],
        legal_solo_sets: [],
        public_color_markers: {
            yellow: yellowPositions.map(position => ({sort_label: String(position)})),
            red: redPositions.map(position => ({sort_label: String(position)})),
        },
        detonator: {mistake_limit: playerCount, mistakes_used: 1},
        in_play_blue_counts: Object.fromEntries(Array.from({length: blueMax}, (_, index) => [String(index + 1), 4])),
        cut_blue_counts: {},
        validation_complete: {},
        public_activity: Array.from({length: 24}, (_, index) => ({message: `Teammate ${(index % playerCount) + 1} completed a public action.`})),
        last_result: phase === 'mission_result' ? {result: 'success', reason: 'all_wires_cleared', mistakes_used: 1, completed_blue_values: Array.from({length: blueMax}, (_, index) => index + 1)} : null,
        result_ready_ids: [],
    };
}

(async () => {
    fs.mkdirSync(output, {recursive: true});
    const browser = await chromium.launch({channel: 'chrome', headless: true});
    const errors = [];
    const measurements = [];
    const contexts = [];
    let dialogCount = 0;

    async function newPage(mobile) {
        const context = await browser.newContext({viewport: {width: mobile ? 390 : 1440, height: 844}, hasTouch: mobile, isMobile: mobile});
        contexts.push(context);
        const page = await context.newPage();
        page.setDefaultTimeout(12000);
        page.on('pageerror', error => errors.push(error.message));
        page.on('dialog', async dialog => { dialogCount += 1; await dialog.accept(); });
        await page.route('https://fonts.googleapis.com/**', route => route.abort());
        await page.goto(base);
        await page.waitForFunction(() => typeof socket !== 'undefined' && socket.connected && cachedGameList);
        await page.evaluate(() => socket.emit('room:create', {name: 'Bomb Busters UI QA', game_type: 'bomb_busters'}));
        await page.waitForFunction(() => roomSessionReady && isGameAssetsLoaded('bomb_busters'));
        await page.evaluate(() => {
            window.bombBustersTestActions = [];
            window.bombBustersTestVersion = 100;
            sendAction = action => window.bombBustersTestActions.push(action);
            setRoomControlsCollapsed(true);
            syncRoomControlsExplainButton();
        });
        return page;
    }

    async function render(page, view) {
        await page.evaluate(view => {
            renderBombBustersGameState({view, state_version: ++window.bombBustersTestVersion});
        }, view);
        await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    }

    async function measure(page, label, width) {
        const measurement = await page.evaluate(() => {
            const frame = element => {
                const bounds = element.getBoundingClientRect();
                return {left: bounds.left, right: bounds.right, top: bounds.top, bottom: bounds.bottom, width: bounds.width, height: bounds.height};
            };
            const wires = [...document.querySelectorAll('.bomb-busters-wire-button')];
            const collisions = wires.flatMap(wire => {
                const face = frame(wire.querySelector('.bomb-busters-wire-label'));
                const slot = frame(wire.querySelector('.bomb-busters-slot-number'));
                const info = wire.querySelector('.bomb-busters-info-token');
                const icon = wire.querySelector('.bomb-busters-wire-icon');
                const box = frame(wire);
                const overlapping = face.top < slot.bottom - 1 || info && face.bottom > frame(info).top + 1 || icon && face.top < frame(icon).bottom - 1;
                return overlapping || face.left < box.left || face.right > box.right ? [wire.getAttribute('aria-label')] : [];
            });
            const rackSection = document.querySelector('.bomb-busters-racks-section');
            return {
                pageOverflow: document.documentElement.scrollWidth > innerWidth,
                panelOverflow: document.getElementById('bombBustersPanel').scrollWidth > document.getElementById('bombBustersPanel').clientWidth,
                panel: frame(document.querySelector('.game-panel')),
                rackSection: frame(rackSection),
                rackPadding: getComputedStyle(rackSection).padding,
                action: frame(document.getElementById('bombBustersActionDock')),
                firstWire: frame(wires[0]),
                minimumWidth: Math.min(...wires.map(wire => frame(wire).width)),
                minimumHeight: Math.min(...wires.map(wire => frame(wire).height)),
                collisions,
                columns: getComputedStyle(document.querySelector('.bomb-busters-rack-slots')).gridTemplateColumns.split(' ').length,
                help: frame(document.getElementById('bombBustersHelpBtn')),
                reconnect: frame(document.getElementById('gameReconnectBtn')),
                detonator: frame(document.getElementById('bombBustersDetonator')),
                markers: frame(document.querySelector('.bomb-busters-markers')),
                selfFirst: document.querySelector('.bomb-busters-player-card').classList.contains('is-self'),
            };
        });
        assert.equal(measurement.pageOverflow, false, `${label}: page overflow at ${width}`);
        assert.equal(measurement.panelOverflow, false, `${label}: panel overflow at ${width}`);
        assert.equal(measurement.selfFirst, true);
        assert.equal(measurement.rackPadding, '0px');
        assert(measurement.minimumWidth >= 44, `${label}: wire target too narrow at ${width}`);
        assert(measurement.minimumHeight >= 44);
        assert.deepEqual(measurement.collisions, [], `${label}: wire labels overlap at ${width}`);
        assert(Math.abs(measurement.help.top + measurement.help.height / 2 - measurement.reconnect.top - measurement.reconnect.height / 2) < 2, 'Help and Reconnect stay on the same line');
        assert.equal(measurement.detonator.top, measurement.markers.top);
        assert(measurement.detonator.right < measurement.markers.left);
        if (measurement.action.height) assert(measurement.action.bottom <= measurement.rackSection.top, 'Actions sit directly before the racks');
        if (width <= 390) {
            assert(measurement.columns >= (width === 320 ? 6 : 7), 'Use the available mobile width');
            assert(measurement.firstWire.bottom < 480, 'The first wire is visible without scrolling');
            assert(measurement.panel.height < (width === 320 ? 1500 : 1300), `${label}: mobile layout is too tall`);
        }
        measurements.push({label, width, ...measurement});
        await page.screenshot({path: `${output}/${label}-${width}.png`, fullPage: true});
    }

    try {
        const desktop = await newPage(false);
        const mobile = await newPage(true);
        for (const [playerCount, preset] of [[2, 'short'], [2, 'standard'], [3, 'standard'], [5, 'high-risk']]) {
            for (const width of [320, 390, 1024, 1440]) {
                const page = width <= 390 ? mobile : desktop;
                await page.setViewportSize({width, height: width <= 390 ? 844 : 950});
                const viewer = await page.evaluate(() => playerId);
                await render(page, makeView(playerCount, preset, viewer));
                await page.evaluate(() => window.scrollTo(0, 0));
                await measure(page, `${playerCount}-players-${preset}`, width);
                assert.equal(await page.locator('#bombBustersIntel').getAttribute('open'), null);
                assert.equal(await page.locator('#bombBustersActivityDetails').getAttribute('open'), null);
                assert.equal(await page.locator('.is-hidden-wire [data-bomb-busters-tip]').count(), 0);
                assert.equal(await page.locator('.is-hidden-wire.is-blue, .is-hidden-wire.is-yellow, .is-hidden-wire.is-red').count(), 0, 'Hidden wires have no private color classes');
                assert((await page.locator('.is-hidden-wire .bomb-busters-wire-label').allTextContents()).every(label => label === '?'), 'Teammate faces stay hidden');
                for (const rack of await page.locator('.bomb-busters-rack').all()) {
                    const slots = await rack.locator('.bomb-busters-slot-number').allTextContents();
                    assert.deepEqual(slots, slots.map((_, index) => `#${index + 1}`), 'Slot order stays fixed');
                }
            }
        }

        await mobile.setViewportSize({width: 390, height: 844});
        const viewer = await mobile.evaluate(() => playerId);
        const view = makeView(3, 'standard', viewer);
        await render(mobile, view);
        await mobile.locator('#bombBustersIntel > summary').tap();
        await mobile.locator('.bomb-busters-validation-cell').first().tap();
        await mobile.locator('#bombBustersTooltip:not(.hidden)').waitFor();
        assert.match(await mobile.locator('#bombBustersTooltip').textContent(), /Blue 1/);
        await mobile.keyboard.press('Escape');
        await render(mobile, view);
        assert.equal(await mobile.locator('#bombBustersIntel').evaluate(element => element.open), true, 'State updates preserve disclosure state');
        await mobile.locator('#bombBustersIntel > summary').tap();
        await mobile.locator('#bombBustersActivityDetails > summary').tap();
        assert.equal(await mobile.locator('#bombBustersActivity').evaluate(element => element.scrollHeight > element.clientHeight), true, 'Activity is independently scrollable');
        await mobile.locator('#bombBustersActivityDetails > summary').tap();

        await mobile.locator('#bombBustersDetonator').tap();
        await mobile.locator('#bombBustersTooltip:not(.hidden)').waitFor();
        assert.match(await mobile.locator('#bombBustersTooltip').textContent(), /Detonator/);
        await mobile.locator('.bomb-busters-marker-row').first().tap();
        assert.match(await mobile.locator('#bombBustersTooltip').textContent(), /Yellow sorting/);
        await mobile.locator('#bombBustersTooltip').waitFor({state: 'hidden', timeout: 4200});

        const ownWire = mobile.locator('.is-self .bomb-busters-wire-button.is-blue').first();
        const targetWire = mobile.locator('.bomb-busters-player-card:not(.is-self) .bomb-busters-wire-button').first();
        const selectedOwn = mobile.locator('.is-selected-own');
        const confirm = mobile.locator('#bombBustersWirePopoverConfirmBtn');
        await ownWire.tap();
        assert.equal(await selectedOwn.count(), 1);
        assert.equal(await confirm.isEnabled(), false);
        assert.equal(await mobile.locator('#bombBustersTooltip').isVisible(), false, 'Interactive wires do not open a tooltip');
        await mobile.locator('#bombBustersWirePopoverCancelBtn').tap();
        assert.equal(await selectedOwn.count(), 0);
        await ownWire.tap();
        await mobile.keyboard.press('Escape');
        assert.equal(await selectedOwn.count(), 0);
        await ownWire.tap();
        await mobile.locator('#bombBustersStatus').tap();
        assert.equal(await selectedOwn.count(), 0);

        await ownWire.tap();
        await targetWire.scrollIntoViewIfNeeded();
        const scrollBefore = await mobile.evaluate(() => scrollY);
        await targetWire.tap();
        assert(Math.abs(await mobile.evaluate(() => scrollY) - scrollBefore) <= 2, 'Selecting a target does not reset scroll');
        assert.equal(await confirm.isEnabled(), true);
        assert.equal(await mobile.evaluate(() => window.bombBustersTestActions.length), 0, 'Selection never submits an action');
        const expectedDuo = {type: 'dual_cut', own_wire_id: await ownWire.getAttribute('data-wire-id'), target_wire_id: await targetWire.getAttribute('data-wire-id')};
        const popover = await mobile.locator('#bombBustersWirePopover').boundingBox();
        const roomBar = await mobile.locator('#roomControlsPanel').boundingBox();
        assert(popover.y >= roomBar.y + roomBar.height && popover.y + popover.height <= 844, 'Confirmation avoids Room Control and viewport edges');
        await confirm.tap();
        assert.deepEqual(await mobile.evaluate(() => window.bombBustersTestActions.at(-1)), expectedDuo);

        await render(mobile, view);
        await mobile.locator('#bombBustersDetectorBtn').tap();
        await ownWire.tap();
        const targetRack = mobile.locator('.bomb-busters-player-card:not(.is-self) .bomb-busters-rack').first();
        await targetRack.locator('.bomb-busters-wire-button').nth(0).tap();
        assert.equal(await confirm.isEnabled(), false);
        await targetRack.locator('.bomb-busters-wire-button').nth(1).tap();
        assert.equal(await confirm.isEnabled(), true);
        assert.equal(await mobile.locator('.is-selected-target').count(), 2);
        await confirm.tap();
        assert.equal(await mobile.evaluate(() => window.bombBustersTestActions.at(-1).type), 'double_detector_cut');

        for (const phase of ['initial_info', 'awaiting_detector_choice', 'mission_result']) {
            const phaseView = makeView(3, 'standard', viewer, phase);
            await render(mobile, phaseView);
            await mobile.evaluate(() => window.scrollTo(0, 0));
            await measure(mobile, phase, 390);
            if (phase === 'mission_result') {
                assert.equal(await mobile.locator('#bombBustersActionDock').isVisible(), false);
                await mobile.locator('#bombBustersContinueBtn').tap();
                assert.equal(await mobile.evaluate(() => window.bombBustersTestActions.at(-1).type), 'continue_mission');
                assert.equal(await mobile.locator('#bombBustersResult').isVisible(), true, 'Mission review stays visible while waiting');
            } else {
                await ownWire.tap();
                assert.equal(await confirm.isEnabled(), true);
                await confirm.tap();
                assert.equal(await mobile.evaluate(() => window.bombBustersTestActions.at(-1).type), phase === 'initial_info' ? 'place_initial_info' : 'resolve_detector_choice');
            }
        }

        const waiting = makeView(5, 'high-risk', viewer);
        waiting.current_turn = waiting.players[0].player_id;
        waiting.legal_actions = [];
        waiting.players.forEach(player => { player.name = 'A-very-long-player-name-用于检查姓名不溢出'; });
        await render(mobile, waiting);
        await mobile.evaluate(() => window.scrollTo(0, 0));
        await measure(mobile, 'waiting-long-names', 390);
        assert.equal(await mobile.locator('#bombBustersActionDock').isVisible(), false, 'Waiting does not duplicate a disabled action area');
        await mobile.locator('#bombBustersHelpBtn').tap();
        await mobile.locator('#bombBustersHelpModal').waitFor({state: 'visible'});
        await mobile.keyboard.press('Escape');
        await mobile.locator('#bombBustersHelpModal').waitFor({state: 'hidden'});
        const actionsBeforeExplain = await mobile.evaluate(() => window.bombBustersTestActions.length);
        for (const [selector, title] of [
            ['.is-self .bomb-busters-wire-button .bomb-busters-wire-label', 'Your Wire'],
            ['.is-self .bomb-busters-info-token', 'Info Token'],
        ]) {
            await mobile.locator('#bombBustersExplainBtn').tap();
            const target = mobile.locator(selector).first();
            await target.scrollIntoViewIfNeeded();
            const bounds = await target.boundingBox();
            await mobile.touchscreen.tap(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2);
            await mobile.locator('#bombBustersExplainModal').waitFor({state: 'visible'});
            assert.equal(await mobile.locator('#bombBustersExplainContent h3').textContent(), title);
            await mobile.keyboard.press('Escape');
        }
        assert.equal(await mobile.evaluate(() => window.bombBustersTestActions.length), actionsBeforeExplain, 'Explain works on disabled wires and their Info tokens without sending actions');

        const desktopViewer = await desktop.evaluate(() => playerId);
        await render(desktop, makeView(2, 'standard', desktopViewer));
        await desktop.locator('#bombBustersDetonator').hover();
        await desktop.locator('#bombBustersTooltip:not(.hidden)').waitFor();
        await desktop.keyboard.press('Escape');
        await desktop.locator('#bombBustersIntel > summary').focus();
        await desktop.keyboard.press('Enter');
        assert.equal(await desktop.locator('#bombBustersIntel').evaluate(element => element.open), true, 'Disclosures support keyboard navigation');
        assert.equal(dialogCount, 0, 'Mobile confirmations and Next Bomb need no second confirmation');
        assert.deepEqual(errors, [], 'No browser errors');
        console.log(`PASS ${measurements.length} compact layouts, 2/3/5 players, disclosures, tooltips, wire confirmations, detector, result pause, keyboard and long names`);
    } finally {
        fs.writeFileSync(`${output}/measurements.json`, JSON.stringify({measurements, errors}, null, 2));
        for (const context of contexts) await context.close();
        await browser.close();
    }
})().catch(error => { console.error(error); process.exitCode = 1; });
