// Run against uvicorn; PLAYWRIGHT_MODULE may point to an existing installation.
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const base = process.env.ROOM_TEST_URL || 'http://127.0.0.1:8776';

(async () => {
    const browser = await chromium.launch({ channel: 'chrome', headless: true });
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.route('https://fonts.googleapis.com/**', route => route.abort());
    const tip = page.locator('#roomFeedbackTooltip');
    const status = page.locator('#roomActionStatus');
    const toggle = page.locator('#roomControlsToggleBtn');
    try {
        await page.goto(base);
        await page.waitForFunction(() => typeof socket !== 'undefined' && socket.connected && cachedGameList);
        await page.clock.install({ time: new Date('2026-10-14T00:00:00Z') });
        await page.clock.pauseAt(new Date('2026-10-14T00:00:01Z'));
        // Exercise the shared error path for every registered game without game logic or bots.
        const gameCount = await page.evaluate(() => {
            roomId = 'feedback-test';
            roomSessionReady = true;
            playerId = 'self';
            currentRoomState = {
                room_id: roomId, status: 'lobby', game_type: 'cabo', min_players: 1, max_players: 4,
                players: [{ player_id: playerId, name: 'Player', ready: true }],
            };
            setRoomFeedback('Previous lobby error', true);
            currentRoomState.status = 'in_game';
            updateRoomControlsForStatus('in_game');
            if (roomActionStatus.textContent || roomFeedbackMessage) throw new Error('Lobby feedback survived game start');
            for (const gameType of Object.keys(GAME_ASSETS)) {
                currentGameType = currentRoomState.game_type = gameType;
                socket.listeners('system:error').forEach(handler => handler({ message: `Invalid action: ${gameType}` }));
                if (!roomControlsPanel.classList.contains('collapsed')) throw new Error(`${gameType}: RC opened`);
                if (roomActionStatus.textContent || roomFeedbackMessage) throw new Error(`${gameType}: persistent feedback`);
                if (connectionInfo.textContent.includes('Invalid action')) throw new Error(`${gameType}: stale connection feedback`);
                if (roomFeedbackTooltip.textContent !== `Error: Invalid action: ${gameType}`) throw new Error(`${gameType}: missing tooltip`);
            }
            currentGameType = currentRoomState.game_type = 'cabo';
            document.getElementById('gameReconnectBtn').focus();
            return Object.keys(GAME_ASSETS).length;
        });
        assert.equal(await toggle.getAttribute('aria-expanded'), 'false');
        assert.equal(await tip.isVisible(), true);
        assert.equal(await page.locator('.main').evaluate(element => element.inert), false);

        // A replacement gets its own full second; a button refresh does not resurrect feedback.
        await page.clock.runFor(700);
        await page.evaluate(() => setRoomFeedback('Newest error', true));
        await page.clock.runFor(999);
        assert.equal(await tip.isVisible(), true);
        assert.equal(await tip.textContent(), 'Newest error');
        await page.clock.runFor(1);
        assert.equal(await tip.isVisible(), false);
        await page.evaluate(() => updateRoomActionButtons());
        assert.equal(await status.textContent(), '');
        assert.match(await page.locator('#log').textContent(), /Newest error/);

        await page.evaluate(() => {
            roomSessionReady = false;
            ensureRoomConnection();
        });
        assert.match(await tip.textContent(), /Reconnect/);
        assert.equal(await toggle.getAttribute('aria-expanded'), 'false');
        await page.evaluate(() => {
            roomSessionReady = true;
            pendingRoomRequest = { event: 'room:reopen', roomId };
            socket.listeners('system:error').forEach(handler => handler({ message: 'Cannot reopen yet' }));
        });
        assert.equal(await tip.textContent(), 'Error: Cannot reopen yet');
        assert.equal(await toggle.getAttribute('aria-expanded'), 'false');

        fs.mkdirSync('build/room-feedback', { recursive: true });
        for (const width of [320, 390, 1280]) {
            await page.setViewportSize({ width, height: 844 });
            await page.evaluate(() => setRoomFeedback('Error: This action is unavailable. Please choose another card.', true));
            const bounds = await tip.boundingBox();
            assert(bounds.x >= 0 && bounds.x + bounds.width <= width);
            assert(bounds.y >= 0 && bounds.y + bounds.height <= 844);
            assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
            assert.equal(await toggle.getAttribute('aria-expanded'), 'false');
            await page.screenshot({ path: `build/room-feedback/tooltip-${width}.png` });
        }
        await page.evaluate(() => {
            const dialog = document.createElement('dialog');
            dialog.id = 'feedbackTestDialog';
            dialog.textContent = 'Game action';
            document.body.appendChild(dialog);
            dialog.showModal();
            setRoomFeedback('Error: Try another action.', true);
        });
        assert.equal(await tip.evaluate(element => element.matches(':popover-open')), true, 'Tooltip appears in the top layer above game dialogs');
        assert.equal(await page.evaluate(() => document.activeElement.id), 'feedbackTestDialog', 'Feedback does not steal focus');
        await page.evaluate(() => document.getElementById('feedbackTestDialog').remove());

        await page.evaluate(() => {
            currentRoomState.status = 'game_over';
            setRoomFeedback('Results are still open.', true);
        });
        assert.equal(await status.textContent(), '');
        assert.equal(await toggle.getAttribute('aria-expanded'), 'false');
        await page.clock.runFor(1000);
        assert.equal(await tip.isVisible(), false);
        await page.evaluate(() => {
            currentRoomState.status = 'lobby';
            updateRoomControlsForStatus('lobby');
            setRoomFeedback('All players must be ready.', true);
        });
        assert.equal(await status.textContent(), 'All players must be ready.');
        assert.equal(await toggle.getAttribute('aria-expanded'), 'true');
        assert.equal(await tip.isVisible(), false);
        assert.deepEqual(errors, []);
        console.log(`${gameCount} registered games: transient errors, replacement timing, RC visibility, lobby feedback, dialogs, and responsive layout passed.`);
    } finally {
        await browser.close();
    }
})().catch(error => { console.error(error); process.exitCode = 1; });
