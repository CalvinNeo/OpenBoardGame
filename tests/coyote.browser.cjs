const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { execFileSync } = require('node:child_process');

const base = process.env.ROOM_TEST_URL || 'http://127.0.0.1:8783';
const output = 'tmp/coyote-ui';
fs.mkdirSync(output, { recursive: true });
const fixtures = JSON.parse(execFileSync(process.env.PYTHON || 'python3', ['-c', `
import copy, json
from game.coyote import CoyoteGame as Game
from game.coyote_ai import _card
players = [{'player_id': f'p{index}', 'name': 'You' if index == 0 else f'Opponent {index}', 'seat': index, 'is_bot': index > 0} for index in range(6)]
state = Game.init_game({}, players)
for player, label in zip(state['players'].values(), ['5', '20', 'Max->0', '?', 'x2', '-5']):
    player['card'] = _card(label)
state['deck'] = [_card('10')]
views = {'opening': Game.get_public_view(state, 'p0')}
Game.apply_action(state, 'p0', {'type': 'bid', 'bid': 55})
state['current_turn'] = 'p0'
state['last_bidder'] = 'p5'
views['bidding'] = Game.get_public_view(state, 'p0')
Game.apply_action(state, 'p0', {'type': 'challenge'})
views['review'] = Game.get_public_view(state, 'p0')
Game.apply_action(state, 'p0', {'type': 'next_round'})
views['ready'] = Game.get_public_view(state, 'p0')
views['restored'] = Game.get_public_view(Game.deserialize(copy.deepcopy(Game.serialize(state))), 'p0')
for player_id in state['players']:
    if 'next_round' in Game.get_legal_actions(state, player_id):
        Game.apply_action(state, player_id, {'type': 'next_round'})
views['next'] = Game.get_public_view(state, 'p0')
views['spectator'] = Game.get_public_view(state, 'spectator')
large = Game.init_game({}, players + [{'player_id': f'p{index}', 'name': 'A very long opponent name ' * 3, 'seat': index, 'is_bot': True} for index in range(6, 10)])
large['players']['p2']['eliminated'] = True
large['players']['p2']['card'] = None
views['ten'] = Game.get_public_view(large, 'p0')
over = copy.deepcopy(state)
over.update(game_over=True, phase='game_over', winner='p0')
views['over'] = Game.get_public_view(over, 'p0')
print(json.dumps(views))
`], { encoding: 'utf8' }));

async function render(page, key) {
    await page.evaluate(view => {
        playerId = view.you;
        roomSessionReady = true;
        currentGameType = 'coyote';
        renderRoomState({ room_id: 'coyote-ui', game_type: 'coyote', status: view.game_over ? 'game_over' : 'in_game', players: view.players, game_config: {} });
        setGamePanelVisibility('coyote');
        renderGameState({ room_id: 'coyote-ui', game_type: 'coyote', view });
        setRoomControlsCollapsed(true);
        window.scrollTo(0, 0);
    }, fixtures[key]);
    await page.locator('#coyotePanel').waitFor({ state: 'visible' });
}

async function bounds(page, label) {
    const result = await page.evaluate(() => {
        const bad = [...document.querySelectorAll('#coyotePanel *, .game-panel > .panel-header *, .obg-help-dialog[open] *')].filter(element => {
            if (element.closest('#roomControlsPanel')) return false;
            const rect = element.getBoundingClientRect();
            if (!rect.width || !rect.height) return false;
            const style = getComputedStyle(element);
            return rect.left < -1 || rect.right > innerWidth + 1 ||
                (element.clientWidth && element.scrollWidth > element.clientWidth + 1 && !['auto', 'scroll', 'hidden'].includes(style.overflowX));
        }).map(element => `${element.id || element.className}: ${element.textContent.slice(0, 60)}`);
        return { overflow: document.documentElement.scrollWidth > innerWidth + 1, bad };
    });
    assert.deepEqual(result, { overflow: false, bad: [] }, label);
    const cards = await page.locator('.coyote-player').evaluateAll(elements => elements.map(element => {
        const rect = element.getBoundingClientRect();
        return { left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom };
    }));
    for (let first = 0; first < cards.length; first += 1) {
        for (let second = first + 1; second < cards.length; second += 1) {
            const left = cards[first];
            const right = cards[second];
            assert(!(left.left < right.right && left.right > right.left && left.top < right.bottom && left.bottom > right.top), `${label}: cards overlap`);
        }
    }
}

(async () => {
    const browser = await chromium.launch({ channel: 'chrome', headless: true });
    const errors = [];
    try {
        for (const [width, height] of [[320, 740], [390, 844], [1024, 900], [1440, 1000]]) {
            const context = await browser.newContext({ viewport: { width, height }, isMobile: width < 600, hasTouch: width < 600 });
            const page = await context.newPage();
            page.on('pageerror', error => errors.push(error.message));
            await page.route('https://fonts.googleapis.com/**', route => route.abort());
            await page.goto(base);
            await page.waitForFunction(() => typeof socket !== 'undefined' && socket.connected && cachedGameList);
            assert.equal(await page.locator('script[src*="games/coyote.js"]').count(), 0);
            await page.evaluate(() => ensureGameAssets('coyote'));
            await page.waitForFunction(() => isGameAssetsLoaded('coyote'));
            await page.evaluate(() => { window.coyoteTestActions = []; sendAction = action => window.coyoteTestActions.push(action); });
            for (const key of ['opening', 'bidding', 'review', 'ready', 'next', 'spectator', 'ten', 'over']) {
                await render(page, key);
                await bounds(page, `${width}: ${key}`);
                if (['bidding', 'review', 'ten'].includes(key)) await page.screenshot({ path: `${output}/${key}-${width}.png`, fullPage: true });
            }
            await render(page, 'opening');
            assert.equal(await page.locator('#coyoteChallengeBtn').isEnabled(), false);
            assert.equal(await page.locator('.coyote-card-face.is-hidden').count(), 1);
            const explain = page.locator('#coyoteExplainBtn');
            await explain.click();
            await page.locator('#coyoteChallengeBtn').click({ force: true });
            await page.locator('.obg-explain-dialog[open]').waitFor();
            assert.match(await page.locator('.obg-explain-text').innerText(), /质疑|Challenge/);
            assert.equal(await page.evaluate(() => coyoteTestActions.length), 0);
            await page.keyboard.press('Escape');
            await explain.click();
            await page.locator('#coyoteBidInput').click();
            await page.locator('.obg-explain-dialog[open]').waitFor();
            assert.equal(await page.evaluate(() => coyoteTestActions.length), 0);
            await page.keyboard.press('Escape');
            await page.locator('#coyoteHelpBtn').click();
            const help = page.locator('[data-obg-help-game="coyote"][open]');
            await help.locator('[data-obg-help-lang="en"]').click();
            assert.match(await help.locator('.obg-help-body').innerText(), /every opponent.*not your own/);
            await help.locator('[data-obg-help-tab="specials"]').click();
            assert.match(await help.locator('.obg-help-body').innerText(), /Max→0/);
            await bounds(page, `${width}: English Help`);
            await help.locator('[data-obg-help-lang="zh"]').click();
            await help.locator('[data-obg-help-tab="__basic"]').click();
            await bounds(page, `${width}: Chinese Help`);
            await page.keyboard.press('Escape');
            await render(page, 'bidding');
            await page.locator('#coyoteBidPlusBtn').click();
            assert.equal(await page.locator('#coyoteBidInput').inputValue(), '57');
            await page.locator('#coyoteBidMinusBtn').click();
            assert.equal(await page.locator('#coyoteBidInput').inputValue(), '56');
            await page.locator('#coyoteBidInput').fill('55.5');
            assert.equal(await page.locator('#coyoteBidBtn').isEnabled(), false);
            await page.locator('#coyoteBidInput').fill('58');
            await page.locator('#coyoteBidBtn').click();
            assert.deepEqual(await page.evaluate(() => coyoteTestActions.at(-1)), { type: 'bid', bid: 58 });
            await render(page, 'review');
            assert.equal(await page.locator('#coyoteBidBtn').isEnabled(), false);
            assert.equal(await page.locator('.coyote-reveal-chip.is-you').innerText(), 'You: 5');
            assert.match(await page.locator('#coyoteResultBody').innerText(), /Mystery.*10.*Max→0.*20.*×2/);
            await page.locator('#coyoteNextBtn').click();
            assert.deepEqual(await page.evaluate(() => coyoteTestActions.at(-1)), { type: 'next_round' });
            await render(page, 'ready');
            assert.equal(await page.locator('#coyoteNextBtn').isEnabled(), false);
            await render(page, 'restored');
            assert.equal(await page.locator('#coyoteNextBtn').innerText(), 'Ready ✓');
            await render(page, 'next');
            await page.locator('#coyoteHistory summary').click();
            assert.match(await page.locator('#coyoteHistoryBody').innerText(), /Your card was 5/);
            await render(page, 'bidding');
            const face = page.locator('.coyote-card-face.is-special').first();
            await face.click();
            assert.equal(await page.locator('#coyoteTooltip').isVisible(), true);
            await page.waitForFunction(() => document.getElementById('coyoteTooltip').classList.contains('hidden'), { timeout: 4500 });
            await render(page, 'spectator');
            assert.equal(await page.locator('.coyote-card-face.is-hidden').count(), 0);
            assert.equal(await page.locator('#coyoteBidBtn').isEnabled(), false);
            await page.evaluate(() => setGamePanelVisibility('kobayakawa'));
            assert.equal(await page.locator('#coyotePanel').isVisible(), false);
            assert.equal(await page.locator('#coyoteHelpBtn').isVisible(), false);
            console.log(`${width}px: layout, Help/Explain, bid controls, reveal, ready, tooltips and spectator passed`);
            await context.close();
        }
        const context = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
        const page = await context.newPage();
        const liveActions = [];
        const liveErrors = [];
        await page.exposeFunction('coyoteObserveState', data => {
            liveActions.push(...(data.events || []).filter(event => event.type === 'bot:action').map(event => event.payload.action.type));
        });
        await page.exposeFunction('coyoteObserveError', error => liveErrors.push(error));
        await page.addInitScript(() => document.addEventListener('DOMContentLoaded', () => {
            socket.on('game:state', data => window.coyoteObserveState(data));
            socket.on('system:error', error => window.coyoteObserveError(error));
        }));
        page.on('pageerror', error => errors.push(error.message));
        await page.goto(base);
        await page.waitForFunction(() => typeof socket !== 'undefined' && socket.connected);
        await page.locator('#createBtn').click();
        await page.locator('#nameInput').fill('Coyote QA');
        await page.locator('#playerNameForm button[type=submit]').click();
        await page.locator('#gameSearchInput').fill('Coyote');
        const item = page.locator('#gameList [data-game-id="coyote"]');
        assert.equal(await item.locator('.game-item-ai').innerText(), '🤖');
        await item.click();
        await page.waitForFunction(() => roomSessionReady && currentGameType === 'coyote' && isGameAssetsLoaded('coyote'));
        for (const count of [2, 3]) {
            await page.locator('#addBotBtn').click();
            await page.waitForFunction(expected => currentRoomState.players.length === expected, count);
        }
        await page.evaluate(() => {
            socket.emit('room:ready', { room_id: roomId, ready: true });
        });
        await page.waitForFunction(() => !document.getElementById('startBtn').disabled);
        await page.locator('#startBtn').click();
        let reloaded = false;
        for (let step = 0; step < 180; step += 1) {
            await page.waitForFunction(() => lastGameStatePayload?.game_type === 'coyote' &&
                (lastGameStatePayload.view.game_over || lastGameStatePayload.view.legal_actions.length > 0));
            const view = await page.evaluate(() => lastGameStatePayload.view);
            assert.equal('deck' in view, false);
            if (view.game_over) break;
            if (view.phase === 'round_end') {
                assert.equal(view.players.every(player => !player.card_hidden), true);
                const round = view.round;
                if (!reloaded) {
                    await page.reload();
                    await page.waitForFunction(expected => roomSessionReady && lastGameStatePayload?.view.phase === 'round_end' && lastGameStatePayload.view.round === expected, round);
                    reloaded = true;
                }
                await page.waitForFunction(() => lastGameStatePayload.view.round_ready.length === lastGameStatePayload.view.players.filter(player => player.is_bot).length);
                await page.waitForTimeout(200);
                assert.equal(await page.evaluate(() => lastGameStatePayload.view.round), round, 'Bots must wait for the human');
                await page.locator('#coyoteNextBtn').click();
                await page.waitForFunction(previous => lastGameStatePayload.view.round > previous || lastGameStatePayload.view.game_over, round);
            } else {
                assert.equal(view.players.find(player => player.player_id === view.you).card, null);
                const selector = view.legal_actions.includes('challenge') ? '#coyoteChallengeBtn' : '#coyoteBidBtn';
                await page.locator(selector).click();
                await page.waitForFunction(previous => JSON.stringify(lastGameStatePayload.view) !== previous, JSON.stringify(view));
            }
        }
        assert.equal(await page.evaluate(() => lastGameStatePayload.view.game_over), true);
        if (await page.evaluate(() => !document.getElementById('roomControlsPanel').classList.contains('collapsed'))) {
            await page.locator('#roomControlsCollapseBtn').click();
        }
        assert.equal(await page.locator('#coyoteResetBtn').isVisible(), true);
        await page.locator('#coyoteResetBtn').click();
        await page.waitForFunction(() => !lastGameStatePayload.view.game_over && lastGameStatePayload.view.round === 1);
        assert(liveActions.includes('bid'), 'Bots submit bids');
        assert(liveActions.includes('challenge'), 'Bots submit challenges');
        assert(liveActions.includes('next_round'), 'Bots confirm review');
        assert.deepEqual(liveErrors, [], 'Live server errors');
        console.log('Live room: AI badge, Add Bot, private cards, bot moves, review barrier, reconnect, full game and restart passed');
        await context.close();
        assert.deepEqual(errors, [], 'Browser errors');
    } finally {
        await browser.close();
    }
})().catch(error => { console.error(error); process.exitCode = 1; });
