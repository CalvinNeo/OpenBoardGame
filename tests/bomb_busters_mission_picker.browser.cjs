const {chromium} = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const base = process.env.ROOM_TEST_URL || 'http://127.0.0.1:8779';
const output = 'build/bomb-busters-mission-picker';

(async () => {
    fs.mkdirSync(output, {recursive: true});
    const browser = await chromium.launch({channel: 'chrome', headless: true});
    const errors = [];
    const measurements = [];
    const contexts = [];
    async function newPage(mobile) {
        const context = await browser.newContext({viewport: {width: mobile ? 390 : 1440, height: 844}, hasTouch: mobile, isMobile: mobile});
        contexts.push(context);
        const page = await context.newPage();
        page.setDefaultTimeout(15000);
        page.on('pageerror', error => errors.push(error.message));
        await page.route('https://fonts.googleapis.com/**', route => route.abort());
        await page.goto(base);
        await page.waitForFunction(() => typeof socket !== 'undefined' && socket.connected && cachedGameList, null, {timeout: 60000});
        return page;
    }

    async function open(page) {
        await page.locator('#bombBustersMissionPickerBtn').click();
        await page.locator('#bombBustersMissionPicker[open]').waitFor();
        await page.waitForFunction(() => document.querySelectorAll('#bombBustersMissionPickerSelect option').length === 66 && !document.getElementById('bombBustersMissionPickerSelect').disabled);
    }

    async function select(page, mission) {
        await page.locator('#bombBustersMissionPickerSelect').selectOption(String(mission));
        await page.waitForFunction(mission => document.querySelector('#bombBustersMissionPickerPreview h3')?.textContent.startsWith(`${mission}.`), mission);
    }

    try {
        const host = await newPage(true);
        await host.evaluate(() => socket.emit('room:create', {name: 'Mission picker host', game_type: 'bomb_busters'}));
        await host.waitForFunction(() => roomSessionReady && isGameAssetsLoaded('bomb_busters'));
        const roomId = await host.evaluate(() => currentRoomState.room_id);
        const guest = await newPage(false);
        await guest.evaluate(roomId => socket.emit('room:join', {name: 'Mission picker guest', room_id: roomId}), roomId);
        await guest.waitForFunction(() => roomSessionReady && isGameAssetsLoaded('bomb_busters'));
        await host.waitForFunction(() => currentRoomState.players.length === 2);
        for (const page of [host, guest]) await page.evaluate(() => { closeSettingsModal(); setRoomControlsCollapsed(true); obgHelpSetLang('zh'); });
        await open(host);
        assert.equal(await host.locator('#bombBustersMissionPickerStart').isEnabled(), false, 'Lobby readiness is required');
        await host.keyboard.press('Escape');
        await guest.evaluate(() => socket.emit('room:ready', {ready: true}));
        await host.waitForFunction(() => currentRoomState.players.every(player => player.ready));
        for (const page of [host, guest]) await page.evaluate(() => { setRoomControlsCollapsed(true); obgHelpSetLang('zh'); });
        for (const width of [320, 390, 1024, 1440]) {
            const page = width < 500 ? host : guest;
            await page.setViewportSize({width, height: 844});
            await open(page);
            await select(page, 66);
            for (const language of ['zh', 'en']) {
                if (language === 'en') await page.locator('#bombBustersMissionPickerLanguage').click();
                const measurement = await page.evaluate(() => {
                    const bounds = selector => {const box = document.querySelector(selector).getBoundingClientRect();return {left: box.left, right: box.right, top: box.top, bottom: box.bottom};};
                    const dialog = document.getElementById('bombBustersMissionPicker');
                    return {overflow: document.documentElement.scrollWidth > innerWidth || dialog.scrollWidth > dialog.clientWidth,
                        reconnect: bounds('#gameReconnectBtn'), picker: bounds('#bombBustersMissionPickerBtn'),
                        help: bounds('#bombBustersHelpBtn'), modal: bounds('#bombBustersMissionPicker'),
                        close: bounds('#bombBustersMissionPickerClose'), start: bounds('#bombBustersMissionPickerStart'),
                        previous: document.getElementById('bombBustersMissionPickerBtn').previousElementSibling.id};
                });
                assert.equal(measurement.overflow, false);
                assert.equal(measurement.previous, 'gameReconnectBtn');
                assert(measurement.picker.left >= measurement.reconnect.right);
                assert(Math.abs(measurement.picker.top + measurement.picker.bottom - measurement.reconnect.top - measurement.reconnect.bottom) < 2, JSON.stringify(measurement));
                assert(measurement.help.left >= measurement.picker.right, 'Header controls do not overlap');
                assert(measurement.modal.left >= 0 && measurement.modal.right <= width);
                assert(measurement.close.top >= 0 && measurement.start.bottom <= 844);
                measurements.push({width, language, ...measurement});
                await page.screenshot({path: `${output}/picker-${width}-${language}.png`, fullPage: true});
            }
            await page.keyboard.press('Escape');
            assert.equal(await page.locator('#bombBustersMissionPickerBtn').evaluate(element => element === document.activeElement), true);
        }
        await open(guest);
        await select(guest, 9);
        assert.equal(await guest.locator('#bombBustersMissionPickerStart').isEnabled(), false);
        assert.match(await guest.locator('#bombBustersMissionPickerNotice').textContent(), /Only the host/);
        await guest.keyboard.press('Escape');

        await open(host);
        await select(host, 34);
        assert.equal(await host.locator('#bombBustersMissionPickerStart').isEnabled(), false);
        assert.match(await host.locator('#bombBustersMissionPickerPreview').textContent(), /Requires 3/);
        await select(host, 9);
        await host.locator('#bombBustersMissionPickerStart').click();
        await host.waitForFunction(() => lastGameStatePayload?.view.campaign?.id === 9);
        await host.locator('#bombBustersMissionPicker').waitFor({state: 'hidden'});
        const identities = await host.evaluate(() => currentRoomState.players.map(player => player.player_id));
        await open(host);
        await select(host, 22);
        await host.locator('#bombBustersMissionPickerClose').click();
        assert.equal(await host.evaluate(() => lastGameStatePayload.view.campaign.id), 9, 'Cancel leaves the mission unchanged');
        await open(host);
        await select(host, 22);
        await host.locator('#bombBustersMissionPickerStart').click();
        await host.waitForFunction(() => lastGameStatePayload?.view.campaign?.id === 22);
        assert.equal(await host.evaluate(() => currentRoomState.room_id), roomId);
        assert.deepEqual(await host.evaluate(() => currentRoomState.players.map(player => player.player_id)), identities);
        await host.reload();
        await host.waitForFunction(() => roomSessionReady && lastGameStatePayload?.view.campaign?.id === 22, null, {timeout: 60000});
        await open(host);
        await host.evaluate(() => {
            const data = structuredClone(lastGameStatePayload);
            data.state_version += 1;
            renderBombBustersGameState(data);
        });
        await host.locator('#bombBustersMissionPicker').waitFor({state: 'hidden'});
        await host.evaluate(() => renderBombBustersGameState(lastGameStatePayload));
        await host.locator('#bombBustersExplainBtn').click();
        await host.locator('#bombBustersMissionPickerBtn').click();
        await host.locator('.obg-explain-dialog[open]').waitFor();
        assert.equal(await host.locator('#bombBustersMissionPicker').evaluate(element => element.open), false, 'Explain does not open the picker');
        await host.keyboard.press('Escape');

        await host.route('**/api/bomb_busters/missions?*', route => route.abort());
        await host.locator('#bombBustersMissionPickerBtn').click();
        await host.locator('#bombBustersMissionPickerRetry').waitFor({state: 'visible'});
        assert.equal(await host.locator('#bombBustersMissionPickerStart').isEnabled(), false);
        await host.unroute('**/api/bomb_busters/missions?*');
        await host.locator('#bombBustersMissionPickerRetry').click();
        await host.waitForFunction(() => !document.getElementById('bombBustersMissionPickerSelect').disabled);
        await host.keyboard.press('Escape');
        await open(host);
        await host.evaluate(() => window.bombBustersMissionPickerUI.show(false));
        assert.equal(await host.locator('#bombBustersMissionPicker').evaluate(element => element.open), false);
        assert.equal(await host.locator('#bombBustersMissionPickerBtn').isVisible(), false, 'Other games do not keep the Missions button');
        await host.evaluate(() => window.bombBustersMissionPickerUI.show(true));
        assert.deepEqual(errors, []);
        console.log(`PASS mission picker: ${measurements.length} layouts, host permissions, readiness, unsupported missions, restart, cancel, reconnect, Explain and retry`);
    } finally {
        fs.writeFileSync(`${output}/measurements.json`, JSON.stringify({measurements, errors}, null, 2));
        for (const context of contexts) await context.close();
        await browser.close();
    }
})().catch(error => {console.error(error);process.exitCode = 1;});
