// UI checks only. Run against uvicorn with PLAYWRIGHT_MODULE and PYTHON as needed.
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { execFileSync } = require('node:child_process');
const base = process.env.ROOM_TEST_URL || 'http://127.0.0.1:8781';
const output = 'tmp/the-gang-ui';
fs.mkdirSync(output, { recursive: true });
const views = JSON.parse(execFileSync(process.env.PYTHON || 'python', ['-c', `
import json, random
from copy import deepcopy
from game.the_gang import TheGangGame as G, _lock_round
random.seed(41)
players = [{"player_id": "p"+str(i), "name": name, "seat": i} for i, name in enumerate(["Alex", "Morgan", "Jamie", "Riley", "Casey", "Sam"])]
s = G.init_game({"mode": "normal"}, players)
v = {"preflop": G.get_public_view(s, "p0")}
for phase in ("flop", "turn", "river"):
    G.apply_action(s, "p0", {"type": "reveal_next"})
    if phase == "flop": v["reveal_waiting"] = G.get_public_view(s, "p0")
    for p in players[1:]: G.apply_action(s, p["player_id"], {"type": "reveal_next"})
    v[phase] = G.get_public_view(s, "p0")
v["spectator"] = G.get_public_view(s, "visitor")
G.apply_action(s, "p0", {"type": "toggle_ready"})
v["ready"] = G.get_public_view(s, "p0")
for p in players[1:]: G.apply_action(s, p["player_id"], {"type": "toggle_ready"})
v["locking"] = G.get_public_view(s, "p0")
v["locking"]["lock_at_ms"] = v["locking"]["server_time_ms"] + 60000
_lock_round(s)
v["showdown"] = G.get_public_view(s, "p0")
G.apply_action(s, "p0", {"type": "next_round"})
v["next_waiting"] = G.get_public_view(s, "p0")
v["game_over"] = deepcopy(v["showdown"])
v["game_over"].update(phase="game_over", game_over=True, lives=0, legal_actions=["play_again"])
v["expert"] = deepcopy(v["river"])
v["expert"].update(mode="expert", mission={"id": "qa", "desc": "The strongest player must have a straight or better."})
v["novice"] = deepcopy(v["river"])
v["novice"]["mode"] = "novice"
v["novice"]["players"][0]["hand_odds"] = 0.63
v["long_names"] = deepcopy(v["showdown"])
v["long_names"]["players"][0]["name"] = "VeryLongUnbrokenPlayerNameToCheckContainerOverflow"
v["long_names"]["players"][1]["name"] = "名字很长的玩家用于验证手机布局不会溢出"
v["no_tokens"] = deepcopy(v["river"])
v["no_tokens"]["tokens"] = 0
v["no_tokens"]["legal_actions"].remove("spy")
print(json.dumps(v))
`], { encoding: 'utf8' }));

async function render(page, key) {
    await page.evaluate(view => {
        clearGangState();
        playerId = view.you;
        roomSessionReady = true;
        renderRoomState({ room_id: 'gang-layout', game_type: 'the_gang', status: 'in_game', host_id: 'p0', players: view.players, game_config: {} });
        setGamePanelVisibility('the_gang');
        renderGameState({ room_id: 'gang-layout', game_type: 'the_gang', view });
        setRoomControlsCollapsed(true);
        window.gangTestActions = [];
        window.scrollTo(0, 0);
    }, views[key]);
}

async function bounds(page, label) {
    const issues = await page.evaluate(() => {
        const bad = [...document.querySelectorAll('#theGangPanel *, #gangHelpModal:not(.hidden) *, #gangExplainModal:not(.hidden) *')].filter(el => {
            const rect = el.getBoundingClientRect();
            if (!rect.width || !rect.height || el.classList.contains('sr-only')) return false;
            if (el.tagName === 'OPTION') return false;
            const style = getComputedStyle(el);
            return rect.left < -1 || rect.right > innerWidth + 1 ||
                (el.clientWidth && el.scrollWidth > el.clientWidth + 1 && !['auto', 'hidden', 'scroll'].includes(style.overflowX));
        }).map(el => `${el.id || el.className}: ${el.textContent.slice(0, 55)}`);
        const panels = ['.gang-table', '.gang-rank-panel', '.gang-crew', '.gang-summary'].map(selector => document.querySelector(selector)).filter(el => el.getClientRects().length);
        for (let i = 0; i < panels.length; i++) for (let j = i + 1; j < panels.length; j++) {
            const a = panels[i].getBoundingClientRect(), b = panels[j].getBoundingClientRect();
            if (Math.min(a.right, b.right) - Math.max(a.left, b.left) > 1 && Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > 1) bad.push('Overlapping panels');
        }
        return { overflow: document.documentElement.scrollWidth > innerWidth, bad };
    });
    assert.deepEqual(issues, { overflow: false, bad: [] }, label);
}

async function pointClick(page, locator) {
    await locator.scrollIntoViewIfNeeded();
    const box = await locator.boundingBox();
    await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
}

async function exerciseLiveRoom(browser) {
    const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.route('https://fonts.googleapis.com/**', route => route.abort());
    async function botsReady(phase) {
        await page.waitForFunction(expected => {
            const view = lastGameStatePayload?.view;
            return view?.phase === expected && view.players.filter(player => player.is_bot).length === 3 &&
                view.players.filter(player => player.is_bot).every(player => expected === 'river' ? player.ready : player.reveal_ready);
        }, phase, { timeout: 30000 });
    }
    try {
        await page.goto(base);
        await page.waitForFunction(() => typeof socket !== 'undefined' && socket.connected && cachedGameList);
        await page.evaluate(() => socket.emit('room:create', { name: 'Gang QA', game_type: 'the_gang' }));
        await page.waitForFunction(() => currentGameType === 'the_gang' && isGameAssetsLoaded('the_gang'));
        for (let count = 2; count <= 4; count++) {
            await page.evaluate(() => socket.emit('room:add_bot', { room_id: roomId }));
            await page.waitForFunction(expected => currentRoomState.players.length === expected, count);
        }
        await page.evaluate(() => socket.emit('room:ready', { room_id: roomId, ready: true }));
        await page.waitForFunction(() => !document.getElementById('startBtn').disabled);
        await page.locator('#startBtn').click();
        await botsReady('preflop');
        assert.equal(await page.locator('#gangRanking select:enabled').count(), 4);
        const ownIndex = await page.evaluate(() => lastGameStatePayload.view.ranking.indexOf(playerId));
        const direction = ownIndex > 0 ? -1 : 1;
        await page.locator('.gang-slot').nth(ownIndex).locator('.gang-move').nth(direction < 0 ? 0 : 1).click();
        await page.waitForFunction(index => lastGameStatePayload.view.ranking.indexOf(playerId) === index, ownIndex + direction);
        const humanOrder = await page.evaluate(() => lastGameStatePayload.view.ranking);
        await botsReady('preflop');
        assert.deepEqual(await page.evaluate(() => lastGameStatePayload.view.ranking), humanOrder);
        assert.equal(await page.locator('#gangRevealBtn').isEnabled(), true);
        for (const next of ['flop', 'turn', 'river']) {
            await page.locator('#gangRevealBtn').click();
            await botsReady(next);
        }
        await page.locator('#gangReadyBtn').click();
        await page.waitForFunction(() => lastGameStatePayload.view.phase === 'showdown', null, { timeout: 10000 });
        assert.equal(await page.locator('#gangRoundSummary').isVisible(), true);
        await page.waitForFunction(() => lastGameStatePayload.view.players.filter(player => player.is_bot).every(player => player.next_ready));
        assert.equal(await page.evaluate(() => lastGameStatePayload.view.phase), 'showdown');
        await page.locator('#gangNextRoundBtn').click();
        await botsReady('preflop');
        // A reload also restores the new legal actions and the bots' settled decisions.
        await page.reload();
        await botsReady('preflop');
        await page.waitForFunction(() => isGameAssetsLoaded('the_gang'));
        assert.equal(await page.locator('#gangRanking select:enabled').count(), 4);
        assert.deepEqual(errors, []);
        await page.evaluate(() => new Promise(resolve => socket.emit('room:leave', { room_id: roomId }, resolve)));
        console.log('PASS: live human + three bots, preflop reorder, all streets, showdown pause and reconnect.');
    } finally {
        await context.close();
    }
}

(async () => {
    const browser = await chromium.launch({ channel: 'chrome', headless: true });
    const errors = [];
    const context = await browser.newContext({ viewport: { width: 1440, height: 1080 }, hasTouch: true });
    const page = await context.newPage();
    page.on('pageerror', error => errors.push(error.message));
    await page.route('https://fonts.googleapis.com/**', route => route.abort());
    try {
        await exerciseLiveRoom(browser);
        await page.goto(base);
        await page.waitForFunction(() => typeof socket !== 'undefined' && socket.connected && cachedGameList);
        assert.equal(await page.locator('#theGangPanel').evaluate(el => el.children.length), 0);
        await page.evaluate(() => ensureGameAssets('the_gang'));
        await page.evaluate(() => { window.sendAction = action => window.gangTestActions.push(action); });
        for (const width of [320, 360, 393, 768, 1024, 1440]) {
            await page.setViewportSize({ width, height: 1080 });
            for (const key of Object.keys(views)) {
                await render(page, key);
                await bounds(page, `${width}px / ${key}`);
            }
        }
        await render(page, 'river');
        await page.locator('#theGangPanel').screenshot({ path: `${output}/desktop.png` });
        assert.equal(await page.locator('#gangYourHand .gang-card').count(), 2);
        assert.equal(await page.locator('#gangPlayers .is-facedown:visible').count(), 10);
        await page.locator('.gang-slot').nth(1).getByRole('button', { name: 'Move Morgan up one rank' }).click();
        assert.deepEqual(await page.evaluate(() => gangTestActions.pop()), { type: 'move_rank', player_id: 'p1', to_index: 0 });
        await page.locator('#gangRanking select').nth(2).selectOption('p0');
        assert.deepEqual(await page.evaluate(() => gangTestActions.pop()), { type: 'move_rank', player_id: 'p0', to_index: 2 });
        await page.locator('#gangReadyBtn').click();
        assert.deepEqual(await page.evaluate(() => gangTestActions.pop()), { type: 'toggle_ready' });
        await page.locator('#gangSpyTargetSelect').selectOption('p2');
        await page.locator('#gangSpyBtn').click();
        assert.deepEqual(await page.evaluate(() => gangTestActions.pop()), { type: 'spy', target_player_id: 'p2' });

        await render(page, 'preflop');
        assert.equal(await page.locator('#gangCommunity .is-placeholder').count(), 5);
        assert.equal(await page.locator('#gangRanking select:enabled').count(), 6);
        await page.locator('.gang-slot').first().getByRole('button', { name: 'Move Alex down one rank' }).click();
        assert.deepEqual(await page.evaluate(() => gangTestActions.pop()), { type: 'move_rank', player_id: 'p0', to_index: 1 });
        await page.locator('#gangMulliganBtn').click();
        assert.deepEqual(await page.evaluate(() => gangTestActions.pop()), { type: 'mulligan' });
        await page.locator('#gangRevealBtn').click();
        assert.deepEqual(await page.evaluate(() => gangTestActions.pop()), { type: 'reveal_next' });
        await render(page, 'reveal_waiting');
        assert.equal(await page.locator('#gangRevealBtn').isDisabled(), true);
        assert.match(await page.locator('#gangActionHint').textContent(), /Waiting for 5/);
        await render(page, 'ready');
        assert.equal(await page.locator('#gangReadyBtn').getAttribute('aria-pressed'), 'true');
        assert.equal(await page.locator('#gangRanking select:enabled').count(), 6);

        await render(page, 'expert');
        assert.equal(await page.locator('.gang-card.highlight').count(), 0);
        assert.equal(await page.locator('#gangHandOdds').isVisible(), false);
        assert.equal(await page.locator('#gangMissionRow').isVisible(), true);
        await render(page, 'novice');
        assert.match(await page.locator('#gangHandOdds').textContent(), /63%/);
        await render(page, 'showdown');
        assert.equal(await page.locator('#gangRoundSummary').isVisible(), true);
        await page.locator('#gangNextRoundBtn').click();
        assert.deepEqual(await page.evaluate(() => gangTestActions.pop()), { type: 'next_round' });
        assert.equal(await page.locator('#gangRoundSummary').isVisible(), true);
        await page.locator('#theGangPanel').screenshot({ path: `${output}/showdown.png` });
        await render(page, 'next_waiting');
        assert.equal(await page.locator('#gangNextRoundBtn').isDisabled(), true);
        await render(page, 'game_over');
        await page.locator('#gangPlayAgainBtn').click();
        assert.deepEqual(await page.evaluate(() => gangTestActions.pop()), { type: 'play_again' });

        await render(page, 'no_tokens');
        await page.locator('#gangExplainBtn').click();
        await pointClick(page, page.locator('#gangSpyBtn'));
        assert.equal(await page.locator('#gangExplainModal').isVisible(), true);
        assert.match(await page.locator('#gangExplainContent').textContent(), /random hole card/);
        assert.equal(await page.locator('#gangExplainBtn').getAttribute('aria-pressed'), 'false');
        assert.deepEqual(await page.evaluate(() => gangTestActions), []);
        // A disabled button may omit its click event; the next keyboard activation still works.
        await page.keyboard.press('Enter');
        assert.equal(await page.locator('#gangExplainModal').isVisible(), false);
        await page.locator('#gangExplainBtn').click();
        await page.evaluate(() => { const b = document.createElement('button'); b.id = 'gangProbe'; b.textContent = 'Probe'; b.onclick = () => gangTestActions.push('bad'); gangPanel.append(b); });
        await page.locator('#gangProbe').click();
        assert.deepEqual(await page.evaluate(() => gangTestActions), []);
        await page.keyboard.press('Escape');
        await page.locator('#gangProbe').evaluate(el => el.remove());
        await page.locator('#gangExplainBtn').click();
        await pointClick(page, page.locator('#gangReadyBtn'));
        assert.deepEqual(await page.evaluate(() => gangTestActions), []);
        await page.keyboard.press('Escape');
        await page.locator('#gangExplainBtn').click();
        await page.locator('#gangReadyBtn').focus();
        await page.keyboard.press('Enter');
        assert.equal(await page.locator('#gangExplainModal').isVisible(), true);
        assert.deepEqual(await page.evaluate(() => gangTestActions), []);
        await page.keyboard.press('Escape');
        await page.locator('#gangHelpBtn').click();
        assert.equal(await page.locator('#gangHelpModal').isVisible(), true);
        await bounds(page, 'Help');
        await page.keyboard.press('Escape');
        assert.equal(await page.locator('#gangHelpModal').isVisible(), false);

        await page.setViewportSize({ width: 393, height: 852 });
        await render(page, 'river');
        await page.screenshot({ path: `${output}/mobile.png`, fullPage: true });
        const card = page.locator('#gangYourHand .gang-card').first();
        await card.tap();
        assert.equal(await page.locator('#gangTooltip').isVisible(), true);
        const firstTip = await page.locator('#gangTooltip').textContent();
        await page.locator('#gangYourHand .gang-card').nth(1).tap();
        assert.notEqual(await page.locator('#gangTooltip').textContent(), firstTip);
        await page.waitForTimeout(3200);
        assert.equal(await page.locator('#gangTooltip').isVisible(), false);
        await page.locator('#gangHelpBtn').click();
        await bounds(page, 'Mobile Help');
        await page.keyboard.press('Escape');

        await render(page, 'spectator');
        assert.equal(await page.locator('#gangYourHand .gang-card').count(), 0);
        assert.equal(await page.locator('#gangRanking select:enabled').count(), 0);
        assert.equal(await page.locator('#gangTools').isVisible(), false);
        // Spectator countdowns must not emit player actions.
        await page.evaluate(() => updateGangTimers({ ...currentGangView, lock_at_ms: Date.now() - 1, server_time_ms: Date.now() }));
        assert.deepEqual(await page.evaluate(() => gangTestActions), []);
        await render(page, 'river');
        await page.evaluate(() => updateGangTimers({ ...currentGangView, lock_at_ms: Date.now() - 1, server_time_ms: Date.now() }));
        await page.waitForTimeout(600);
        assert.deepEqual(await page.evaluate(() => gangTestActions), [{ type: 'lock_in' }]);
        assert.deepEqual(errors, []);
        console.log(`PASS: ${Object.keys(views).length * 6} responsive phase layouts, action payloads, privacy, countdowns, Help/Explain and touch tips.`);
    } finally {
        await browser.close();
    }
})().catch(error => { console.error(error); process.exitCode = 1; });
