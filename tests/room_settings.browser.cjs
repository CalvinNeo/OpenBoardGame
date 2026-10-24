// Run against uvicorn; PLAYWRIGHT_MODULE may point to an existing installation.
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const base = process.env.ROOM_TEST_URL || 'http://127.0.0.1:8780';
const output = 'build/room-settings';

(async () => {
    const browser = await chromium.launch({ channel: 'chrome', headless: true });
    const contexts = [];
    const errors = [];
    fs.mkdirSync(output, { recursive: true });

    async function newPage(viewport, setup) {
        const context = await browser.newContext({ viewport, isMobile: viewport.width < 901, hasTouch: viewport.width < 901 });
        contexts.push(context);
        const page = await context.newPage();
        page.on('pageerror', error => errors.push(error.message));
        await page.route('https://fonts.googleapis.com/**', route => route.abort());
        if (setup) await setup(page);
        await page.goto(base);
        await page.waitForFunction(() => typeof socket !== 'undefined' && socket.connected && cachedGameList);
        return page;
    }

    async function assertFits(page, selector) {
        const layout = await page.locator(selector).evaluate(element => {
            const rect = element.getBoundingClientRect();
            return {
                inViewport: rect.left >= 0 && rect.right <= innerWidth && rect.top >= 0 && rect.bottom <= innerHeight,
                pageOverflow: document.documentElement.scrollWidth > innerWidth,
                contentOverflow: element.scrollWidth > element.clientWidth,
            };
        });
        assert.deepEqual(layout, { inViewport: true, pageOverflow: false, contentOverflow: false });
    }

    async function openSettings(page) {
        await page.locator('#settingsBtn').click();
        await page.locator('#settingsModal').waitFor({ state: 'visible' });
        assert.equal(await page.locator('#settingsBtn').getAttribute('aria-expanded'), 'true');
    }

    async function installAudioRecorder(page) {
        await page.addInitScript(() => {
            window.audioTest = { created: 0, starts: 0, stops: [], resumes: [], mode: 'running' };
            window.AudioContext = class {
                constructor() {
                    audioTest.created++;
                    audioTest.context = this;
                    this.state = 'running';
                    this.currentTime = 10;
                    this.destination = {};
                }
                resume() {
                    if (audioTest.mode === 'reject') return Promise.reject(new Error('Audio blocked'));
                    return new Promise(resolve => audioTest.resumes.push(() => { this.state = 'running'; resolve(); }));
                }
                createOscillator() {
                    return {
                        frequency: { setValueAtTime() {} }, connect() {}, disconnect() {},
                        start() { audioTest.starts++; },
                        stop(time) { audioTest.stops.push(time); this.onended(); },
                    };
                }
                createGain() {
                    return { gain: { setValueAtTime() {}, linearRampToValueAtTime() {} }, connect() {}, disconnect() {} };
                }
            };
        });
    }

    async function prepareTurnEvents(page, game = 'cabo', room = 'sound-test') {
        await page.evaluate(({ game, room }) => {
            playerId = 'self';
            roomId = room;
            currentGameType = game;
            roomSessionReady = true;
            currentRoomState = { room_id: room, game_type: game, status: 'in_game', players: [] };
        }, { game, room });
    }

    // Use the actual Socket.IO listener; no game assets need to finish loading for an alert.
    async function turnEvent(page, view, payload = {}) {
        await page.evaluate(({ view, payload }) => {
            const data = { room_id: roomId, game_type: currentGameType, room_status: 'in_game', view, ...payload };
            socket.listeners('game:state').forEach(handler => handler(data));
        }, { view, payload });
    }

    try {
        for (const viewport of [{ width: 320, height: 568 }, { width: 390, height: 844 },
            { width: 1024, height: 768 }, { width: 1440, height: 900 }]) {
            const page = await newPage(viewport);
            const toggle = page.locator('#disableDoubleTapZoomToggle');
            const soundToggle = page.getByRole('checkbox', { name: 'Play a sound on my turn' });
            const skipValidationToggle = page.locator('#skipValidationToggle');
            const copyStateBtn = page.locator('#copyStateBtn');
            const copyActLogBtn = page.locator('#copyActLogBtn');
            assert.equal(await page.locator('#connectionPanel').count(), 0);
            assert.equal(await page.locator('#settingsModal #skipValidationToggle').count(), 1);
            assert.equal(await page.locator('#settingsModal #copyStateBtn').count(), 1);
            assert.equal(await page.locator('#settingsModal #copyActLogBtn').count(), 1);
            assert.equal(await page.locator('#logPanel #skipValidationToggle').count(), 0);
            assert.equal(await page.locator('#logPanel #copyStateBtn').count(), 0);
            assert.equal(await page.locator('#logPanel #copyActLogBtn').count(), 0);
            assert.equal(await page.locator('#logPanel #logCloseBtn').count(), 1);
            for (const collapsed of [false, true]) {
                await page.evaluate(collapsed => setRoomControlsCollapsed(collapsed), collapsed);
                await assertFits(page, '#settingsBtn');
                await page.screenshot({ path: `${output}/rc-${viewport.width}-${collapsed ? 'collapsed' : 'expanded'}.png` });
                await openSettings(page);
                assert.equal(await page.locator('#roomControlsToggleBtn').getAttribute('aria-expanded'), String(!collapsed));
                assert.equal(await toggle.isChecked(), true);
                assert.equal(await soundToggle.isChecked(), false, 'Turn sound is opt-in');
                assert.equal(await skipValidationToggle.isChecked(), false, 'Skip Validation is off by default');
                await assertFits(page, '.settings-tools');
                await assertFits(page, '.settings-tool-actions');
                assert.equal(await copyStateBtn.isVisible(), true);
                assert.equal(await copyActLogBtn.isVisible(), true);
                await assertFits(page, '.settings-content');
                await page.screenshot({ path: `${output}/settings-${viewport.width}.png` });
                assert.equal(await page.evaluate(() => document.activeElement.id), 'settingsCloseBtn');
                await page.keyboard.press('Shift+Tab');
                assert.equal(await page.evaluate(() => document.activeElement.id), 'logoutBtn');
                await page.keyboard.press('Tab');
                assert.equal(await page.evaluate(() => document.activeElement.id), 'settingsCloseBtn');
                await page.keyboard.press('Escape');
                assert.equal(await page.locator('#settingsModal').isVisible(), false);
                assert.equal(await page.evaluate(() => document.activeElement.id), 'settingsBtn');
                assert.equal(await page.locator('.container').evaluate(element => element.inert), false);
                assert.equal(await page.locator('#roomControlsToggleBtn').getAttribute('aria-expanded'), String(!collapsed));
            }
            await openSettings(page);
            await toggle.uncheck();
            await soundToggle.check();
            assert.equal(await page.evaluate(() => localStorage.getItem('openboardgame:turn_sound')), 'true');
            await page.locator('#settingsCloseBtn').click();
            await page.reload();
            await page.waitForFunction(() => typeof socket !== 'undefined' && socket.connected && cachedGameList);
            await openSettings(page);
            assert.equal(await toggle.isChecked(), false, 'Preference survives reload');
            assert.equal(await soundToggle.isChecked(), true, 'Sound preference survives reload');
            await page.waitForFunction(() => roomTurnSoundContext?.state === 'running');
            await soundToggle.uncheck();
            assert.equal(await page.evaluate(() => localStorage.getItem('openboardgame:turn_sound')), 'false');
            assert.equal(await page.locator('.settings-content').evaluate(element => getComputedStyle(element).touchAction), 'auto');
            await toggle.check();
            assert.equal(await page.locator('.settings-content').evaluate(element => getComputedStyle(element).touchAction), 'manipulation');
            await page.locator('#settingsModal').click({ position: { x: 2, y: 2 } });
            assert.equal(await page.locator('#settingsModal').isVisible(), false);

            await openSettings(page);
            await page.locator('#logOpenBtn').click();
            assert.equal(await page.locator('#settingsModal').isVisible(), false);
            assert.equal(await page.locator('#logPanel').isVisible(), true);
            assert.equal(await page.evaluate(() => document.activeElement.id), 'logCloseBtn');
            await assertFits(page, '#logPanel');
            await page.keyboard.press('Escape');
            assert.equal(await page.locator('#logPanel').isVisible(), false);
            assert.equal(await page.evaluate(() => document.activeElement.id), 'settingsBtn');

            await openSettings(page);
            await page.locator('#logoutBtn').click();
            assert.equal(await page.locator('#settingsModal').isVisible(), false);
            assert.equal(await page.locator('#logoutModal').isVisible(), true);
            await page.locator('#logoutCancelBtn').click();
            assert.equal(await page.evaluate(() => document.activeElement.id), 'settingsBtn');
            console.log(`Settings: ${viewport.width}px, expanded/collapsed RC, focus, dismiss, reload, Log and Logout passed.`);
            await page.close();
        }

        const mobile = await newPage({ width: 390, height: 844 });
        await mobile.evaluate(() => setRoomControlsCollapsed(true));
        await openSettings(mobile);
        await mobile.evaluate(() => {
            window.settingsTapCount = 0;
            document.getElementById('settingsModalTitle').addEventListener('click', () => window.settingsTapCount++);
        });
        const title = await mobile.locator('#settingsModalTitle').boundingBox();
        const cdp = await mobile.context().newCDPSession(mobile);
        await mobile.touchscreen.tap(title.x + title.width / 2, title.y + title.height / 2);
        await mobile.touchscreen.tap(title.x + title.width / 2, title.y + title.height / 2);
        await mobile.waitForFunction(() => window.settingsTapCount === 2);
        assert.equal(await mobile.evaluate(() => visualViewport.scale), 1, 'Repeated touch taps must not zoom the page');
        await mobile.locator('#settingsCloseBtn').click();
        await cdp.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 2 });
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ id: 0, x: 130, y: 380 }, { id: 1, x: 230, y: 380 }] });
        for (let step = 1; step <= 20; step++) {
            await cdp.send('Input.dispatchTouchEvent', {
                type: 'touchMove', touchPoints: [{ id: 0, x: 130 - step * 3, y: 380 }, { id: 1, x: 230 + step * 3, y: 380 }],
            });
            await mobile.waitForTimeout(16);
        }
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
        await mobile.waitForFunction(() => visualViewport.scale > 1.1);
        await cdp.send('Emulation.setPageScaleFactor', { pageScaleFactor: 1 });
        await mobile.evaluate(() => {
            const content = document.createElement('div');
            content.style.height = '1800px';
            document.querySelector('.main').appendChild(content);
        });
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ id: 0, x: 195, y: 650 }] });
        for (let step = 1; step <= 20; step++) {
            await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ id: 0, x: 195, y: 650 - step * 10 }] });
            await mobile.waitForTimeout(16);
        }
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
        await mobile.waitForFunction(() => scrollY > 50);
        console.log('Touch emulation: rapid taps arrive without zoom; pinch zoom and page scrolling still work.');
        await mobile.reload();
        await mobile.waitForFunction(() => typeof socket !== 'undefined' && socket.connected && cachedGameList);
        await mobile.evaluate(() => ensureGameAssets('hive'));
        assert.equal(await mobile.locator('.hive-board').evaluate(element => getComputedStyle(element).touchAction), 'none', 'Custom map gestures retain control');
        await openSettings(mobile);
        await mobile.locator('#disableDoubleTapZoomToggle').uncheck();
        await mobile.evaluate(() => ensureGameAssets('draw_guess'));
        assert.equal(await mobile.locator('#drawGuessCanvas').evaluate(element => getComputedStyle(element).touchAction), 'none', 'Drawing gestures retain control');
        await mobile.locator('#settingsCloseBtn').click();
        assert.equal(await mobile.locator('html').evaluate(element => getComputedStyle(element).touchAction), 'auto');

        const privatePage = await newPage({ width: 390, height: 844 }, page => page.addInitScript(() => {
            Storage.prototype.getItem = () => { throw new DOMException('Unavailable', 'SecurityError'); };
            Storage.prototype.setItem = () => { throw new DOMException('Unavailable', 'QuotaExceededError'); };
        }));
        await openSettings(privatePage);
        assert.equal(await privatePage.locator('#disableDoubleTapZoomToggle').isChecked(), true);
        assert.equal(await privatePage.locator('#turnSoundToggle').isChecked(), false);
        await privatePage.locator('#turnSoundToggle').check();
        await privatePage.locator('#disableDoubleTapZoomToggle').uncheck();
        await privatePage.locator('#settingsCloseBtn').click();
        await openSettings(privatePage);
        assert.equal(await privatePage.locator('#disableDoubleTapZoomToggle').isChecked(), false);
        assert.equal(await privatePage.locator('#turnSoundToggle').isChecked(), true, 'Sound also works without storage');

        const soundPage = await newPage({ width: 390, height: 844 }, installAudioRecorder);
        const mine = { you: 'self', current_turn: 'self', legal_actions: ['draw_deck'] };
        const waiting = { you: 'self', current_turn: 'other', legal_actions: [] };
        const count = () => soundPage.evaluate(() => audioTest.starts);
        await prepareTurnEvents(soundPage);
        await turnEvent(soundPage, mine);
        assert.equal(await count(), 0, 'Disabled by default even on your turn');
        assert.equal(await soundPage.evaluate(() => audioTest.created), 0, 'No audio context while disabled');
        await openSettings(soundPage);
        await soundPage.locator('#turnSoundToggle').check();
        assert.equal(await soundPage.evaluate(() => audioTest.created), 1);
        await turnEvent(soundPage, mine);
        assert.equal(await count(), 0, 'Enabling does not replay an already observed turn');
        await turnEvent(soundPage, waiting);
        await turnEvent(soundPage, mine);
        assert.equal(await count(), 1);
        await turnEvent(soundPage, { ...mine, phase: 'drawn', legal_actions: ['replace_card'] }, { state_version: 20 });
        await turnEvent(soundPage, mine);
        assert.equal(await count(), 1, 'State changes within the same turn stay quiet');
        await turnEvent(soundPage, waiting);
        await turnEvent(soundPage, mine);
        assert.equal(await count(), 2, 'Next turn rings once');
        assert.equal(await soundPage.evaluate(() => audioTest.stops.every(time => time > 10 && time < 10.2)), true);
        await soundPage.locator('#turnSoundToggle').uncheck();
        await turnEvent(soundPage, waiting);
        await turnEvent(soundPage, mine);
        assert.equal(await count(), 2, 'Turning sound off takes effect immediately');
        await soundPage.locator('#turnSoundToggle').check();

        const variants = [
            ['age_of_war', { current_player: 'self', legal_actions: ['roll'] }],
            ['bohnanza_dice', { active_player_id: 'self', legal_actions: ['roll'] }],
            ['fake_artist', { current_turn: { player_id: 'self' }, actions: ['submit_stroke'] }],
            ['forest_shuffle', { current_turn: 'self' }],
            ['acquire', { current_turn: 'other', pending: { current_player: 'self' } }],
            ['gaia_project', { current_turn: 'self', options: [{ action: { type: 'build' } }] }],
            ['six_nimmt', { legal_actions: ['play_card'] }],
            ['aidixit', { phase: 'vote', storyteller_id: 'other', voted: false }],
            ['cyber_pictures', { phase: 'guessing', guessed: false }],
        ];
        for (const [game, view] of variants) {
            await prepareTurnEvents(soundPage, game);
            const before = await count();
            await turnEvent(soundPage, { you: 'self', ...view });
            await turnEvent(soundPage, { you: 'self', ...view });
            assert.equal(await count(), before + 1, `${game}: one alert for the first actionable snapshot`);
        }
        await prepareTurnEvents(soundPage, 'the_crew');
        const beforeCrew = await count();
        await turnEvent(soundPage, { you: 'self', current_turn: 'other', legal_actions: ['communicate'] });
        assert.equal(await count(), beforeCrew, 'Optional communication alone is not a turn');
        await turnEvent(soundPage, { you: 'self', current_turn: 'helper', legal_actions: ['play', 'communicate'] });
        assert.equal(await count(), beforeCrew + 1, 'A controlled helper can require the player to act');

        await prepareTurnEvents(soundPage);
        await turnEvent(soundPage, waiting);
        const beforeIgnored = await count();
        await turnEvent(soundPage, { ...mine, you: null });
        await turnEvent(soundPage, mine, { room_status: 'lobby' });
        await turnEvent(soundPage, mine, { room_status: 'game_over' });
        await turnEvent(soundPage, { ...mine, game_over: true });
        await turnEvent(soundPage, mine, { room_id: 'old-room' });
        await turnEvent(soundPage, mine, { game_type: 'skull' });
        assert.equal(await count(), beforeIgnored, 'Spectating, finished games and stale room events stay quiet');

        // A blocked resume must not play a stale notification when it finally resolves.
        for (const cancel of ['wait', 'mute', 'leave', 'disconnect']) {
            await prepareTurnEvents(soundPage);
            await turnEvent(soundPage, waiting);
            await soundPage.evaluate(() => { audioTest.context.state = 'suspended'; });
            const before = await count();
            await turnEvent(soundPage, mine);
            assert.equal(await count(), before);
            if (cancel === 'wait') await turnEvent(soundPage, waiting);
            if (cancel === 'mute') await soundPage.locator('#turnSoundToggle').uncheck();
            if (cancel === 'leave') await soundPage.evaluate(() => resetRoomState());
            if (cancel === 'disconnect') await soundPage.evaluate(() => socket.listeners('disconnect').forEach(handler => handler('test')));
            await soundPage.evaluate(() => audioTest.resumes.splice(0).forEach(resume => resume()));
            assert.equal(await count(), before, `${cancel}: cancels a delayed chime`);
            await soundPage.locator('#turnSoundToggle').check();
        }
        await prepareTurnEvents(soundPage);
        const beforeReconnect = await count();
        await turnEvent(soundPage, mine);
        await turnEvent(soundPage, mine);
        assert.equal(await count(), beforeReconnect + 1, 'Reconnecting to a turn rings once');

        await turnEvent(soundPage, waiting);
        await soundPage.evaluate(() => { audioTest.context.state = 'suspended'; audioTest.mode = 'reject'; });
        await turnEvent(soundPage, mine);
        await soundPage.keyboard.press('Tab');
        assert.equal(await count(), beforeReconnect + 1, 'Rejected autoplay is harmless');

        const noAudioPage = await newPage({ width: 390, height: 844 }, page => page.addInitScript(() => {
            window.AudioContext = undefined;
            window.webkitAudioContext = undefined;
        }));
        await openSettings(noAudioPage);
        await noAudioPage.locator('#turnSoundToggle').check();
        await prepareTurnEvents(noAudioPage);
        await turnEvent(noAudioPage, mine);
        assert.equal(await noAudioPage.locator('#turnSoundToggle').isChecked(), true);
        assert.deepEqual(errors, []);
        console.log('Game assets, gestures, storage, turn alerts, deduplication, cancellation and unsupported audio passed.');
    } finally {
        await Promise.all(contexts.map(context => context.close()));
        await browser.close();
    }
})().catch(error => { console.error(error); process.exit(1); });
