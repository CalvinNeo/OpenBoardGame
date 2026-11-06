const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { execFileSync } = require('node:child_process');
const base = process.env.ROOM_TEST_URL || 'http://127.0.0.1:8766';
const output = 'tmp/six-nimmt-ui';
fs.mkdirSync(output, {recursive: true});
const views = JSON.parse(execFileSync(process.env.PYTHON || 'python3', ['-c', `
import copy, json, time
from tests.test_six_nimmt import card, make_state
from game.six_nimmt import SixNimmtGame as Game
state = make_state(10)
state['rows'] = [[card(value) for value in row] for row in [[11, 22, 33, 44, 55], [61, 65], [77], [88, 90, 99, 100, 103]]]
state['players']['p0']['hand'] = [card(value) for value in [1, 5, 10, 15, 25, 45, 56, 66, 91, 104]]
state['player_meta']['p0']['name'] = 'Alex'
state['player_meta']['p1']['name'] = 'VeryLongPlayerName' * 6
state['players']['p1']['score'] = 125
state['pending_timeout'] = {'type': 'selection', 'at_ms': int(time.time() * 1000) + 30000}
views = {'selection': Game.get_public_view(state, 'p0'), 'spectator': Game.get_public_view(state, 'spectator')}
locked = copy.deepcopy(state)
Game.apply_action(locked, 'p0', {'type': 'select_card', 'value': 56})
views['locked'] = Game.get_public_view(locked, 'p0')
choice = copy.deepcopy(state)
choice.update(phase='row_choice', waiting_for={'player_id': 'p0', 'card': card(1)}, pending_timeout=None)
choice['last_reveal_order'] = [{'player_id': 'p0', 'card': card(1)}, {'player_id': 'p1', 'card': card(56)}]
views['choice'] = Game.get_public_view(choice, 'p0')
views['waiting'] = Game.get_public_view(choice, 'p2')
summary = copy.deepcopy(state)
summary.update(phase='turn_summary', summary_pending={'type': 'next_turn'}, pending_timeout=None)
summary['last_turn_summary'] = {'round': 1, 'turn': 1, 'placements': [
    {'player_id': f'p{index}', 'card': card(index + 1), 'row_index': index % 4,
     'took_row': index == 0, 'penalty': 27 if index == 0 else 0,
     'taken_cards': [card(value) for value in [11, 22, 33, 44, 55]] if index == 0 else []}
    for index in range(10)]}
summary['last_reveal_order'] = [{'player_id': f'p{index}', 'card': card(index + 1)} for index in range(10)]
views['summary'] = Game.get_public_view(summary, 'p0')
summary['summary_ack'] = {'p0': True}
views['acked'] = Game.get_public_view(summary, 'p0')
views['summarySpectator'] = Game.get_public_view(summary, 'spectator')
summary.update(phase='game_over', game_over=True, winners=['p0', 'p2'])
views['gameover'] = Game.get_public_view(summary, 'p0')
print(json.dumps(views))
`], {encoding: 'utf8'}));

async function prepare(page) {
    await page.route('https://fonts.googleapis.com/**', route => route.abort());
    await page.goto(base);
    await page.waitForFunction(() => typeof socket !== 'undefined');
    await page.evaluate(async () => {
        socket.disconnect();
        await ensureGameAssets('six_nimmt');
        window.sixNimmtActions = [];
        sendAction = action => sixNimmtActions.push(action);
        ensureRoomConnection = () => true;
    });
}

async function render(page, key, reset = true) {
    await page.evaluate(({view, reset}) => {
        if (reset) clearSixNimmtState();
        playerId = view.you;
        roomSessionReady = true;
        renderRoomState({room_id: 'six-ui', game_type: 'six_nimmt', status: view.game_over ? 'game_over' : 'in_game', players: view.players, game_config: {}});
        setGamePanelVisibility('six_nimmt');
        renderGameState({game_type: 'six_nimmt', room_id: 'six-ui', view});
        setRoomControlsCollapsed(true);
        syncRoomControlsExplainButton();
        if (reset) sixNimmtActions.length = 0;
        window.scrollTo(0, 0);
    }, {view: views[key], reset});
    await page.locator('#sixNimmtTable').waitFor({state: 'visible'});
}

async function bounds(page, label) {
    const result = await page.evaluate(() => {
        const bad = [...document.querySelectorAll('#sixNimmtPanel *, .game-panel > .panel-header *')].filter(element => {
            const rect = element.getBoundingClientRect();
            if (!rect.width || !rect.height) return false;
            const style = getComputedStyle(element);
            return rect.left < -1 || rect.right > innerWidth + 1 || (element.clientWidth && element.scrollWidth > element.clientWidth + 2 && !['auto', 'hidden'].includes(style.overflowX));
        }).map(element => `${element.id || element.className}: ${element.textContent.slice(0, 55)}`);
        return {overflow: document.documentElement.scrollWidth > innerWidth, bad};
    });
    assert.deepEqual(result, {overflow: false, bad: []}, label);
}

async function actions(page) { return page.evaluate(() => sixNimmtActions); }

(async () => {
    const browser = await chromium.launch({channel: 'chrome', headless: true});
    const errors = [];
    try {
        const page = await browser.newPage({viewport: {width: 1440, height: 960}});
        page.on('pageerror', error => errors.push(error.message));
        await prepare(page);
        for (const width of [320, 390, 1024, 1440]) {
            await page.setViewportSize({width, height: width < 500 ? 844 : 960});
            for (const key of ['selection', 'locked', 'choice', 'waiting', 'spectator', 'summary', 'acked', 'summarySpectator', 'gameover']) {
                await render(page, key);
                await bounds(page, `${width} ${key}`);
                if (key === 'summary') {
                    const footer = await page.locator('#sixNimmtSummaryNextBtn').boundingBox();
                    assert(footer.y >= 0 && footer.y + footer.height <= page.viewportSize().height, 'Next Round stays in view without scrolling');
                }
                if (['selection', 'choice', 'summary'].includes(key)) await page.screenshot({path: `${output}/${key}-${width}.png`, fullPage: true});
            }
            await render(page, 'selection');
            await page.locator('#sixNimmtHelpBtn').click();
            await bounds(page, `${width} Help`);
            await page.keyboard.press('Escape');
            assert.equal(await page.locator('#sixNimmtGuide').evaluate(element => element.open), false);
        }
        await page.setViewportSize({width: 390, height: 844});
        await render(page, 'selection');
        await page.locator('[data-sn-card="56"]').click();
        assert.deepEqual(await actions(page), []);
        assert.equal(await page.locator('.sn-row.is-preview').count(), 1);
        assert.equal(await page.locator('#sixNimmtPlayBtn').isEnabled(), true);
        await page.locator('#sixNimmtBoardHeading').click();
        assert.equal(await page.locator('#sixNimmtPlayBtn').isDisabled(), true);
        await page.locator('[data-sn-card="56"]').click();
        await render(page, 'selection', false);
        assert.equal(await page.locator('[data-sn-card="56"]').getAttribute('aria-pressed'), 'true');
        await page.locator('#sixNimmtPlayBtn').click();
        assert.deepEqual(await actions(page), [{type: 'select_card', value: 56}]);
        await render(page, 'selection', false);
        assert.equal(await page.locator('#sixNimmtPlayBtn').isDisabled(), true);
        await render(page, 'locked', false);
        assert.match(await page.locator('#sixNimmtSelectionHint').innerText(), /锁定 56/);

        await render(page, 'choice');
        await page.locator('[data-sn-row="0"]').click();
        assert.deepEqual(await actions(page), []);
        await bounds(page, 'selected row confirmation');
        await page.locator('[data-sn-cancel-row]').click();
        assert.equal(await page.locator('[data-sn-take]').count(), 0);
        await page.locator('[data-sn-row="1"]').focus();
        await page.keyboard.press('Enter');
        await page.locator('[data-sn-take="1"]').click();
        assert.deepEqual(await actions(page), [{type: 'choose_row', row_index: 1}]);

        await render(page, 'summary');
        await page.keyboard.press('Escape');
        assert.deepEqual(await actions(page), []);
        assert.equal(await page.locator('#sixNimmtSummaryModal').evaluate(element => element.open), false);
        await render(page, 'summary', false);
        assert.equal(await page.locator('#sixNimmtSummaryModal').evaluate(element => element.open), false);
        await page.locator('#sixNimmtShowSummaryBtn').click();
        assert.equal(await page.locator('.sn-summary-item.is-you').count(), 1);
        await page.locator('#sixNimmtSummaryHideBtn').click();
        assert.deepEqual(await actions(page), []);
        await page.locator('#sixNimmtDockNextBtn').click();
        assert.deepEqual(await actions(page), [{type: 'ack_turn_summary'}]);
        await render(page, 'acked', false);
        assert.equal(await page.locator('#sixNimmtDockNextBtn').isDisabled(), true);

        await render(page, 'selection');
        await page.locator('#sixNimmtExplainBtn').click();
        const disabled = await page.locator('#sixNimmtPlayBtn').boundingBox();
        await page.mouse.click(disabled.x + disabled.width / 2, disabled.y + disabled.height / 2);
        assert.equal(await page.locator('#sixNimmtGuide').evaluate(element => element.open), true);
        assert.deepEqual(await actions(page), []);
        await page.keyboard.press('Escape');
        await page.locator('#sixNimmtExplainBtn').click();
        await page.locator('[data-sn-card="56"]').click();
        assert.equal(await page.locator('#sixNimmtGuide').evaluate(element => element.open), true);
        assert.deepEqual(await actions(page), []);
        await page.keyboard.press('Escape');

        await page.locator('#sixNimmtExplainBtn').click();
        await page.evaluate(() => {
            const button = document.createElement('button');
            button.id = 'sixNimmtUnexplainedProbe';
            button.textContent = 'Unexplained action';
            button.addEventListener('click', () => sixNimmtActions.push({type: 'unexpected'}));
            document.getElementById('sixNimmtPanel').prepend(button);
        });
        await page.locator('#sixNimmtUnexplainedProbe').click();
        assert.equal(await page.locator('#sixNimmtExplainBtn').getAttribute('aria-pressed'), 'true');
        assert.deepEqual(await actions(page), []);
        await page.locator('#sixNimmtUnexplainedProbe').evaluate(element => element.remove());
        await page.keyboard.press('Escape');
        assert.equal(await page.locator('#sixNimmtExplainBtn').getAttribute('aria-pressed'), 'false');
        await page.locator('#sixNimmtExplainBtn').click();
        await page.locator('.sn-goal').focus();
        await page.keyboard.press('Enter');
        assert.equal(await page.locator('#sixNimmtGuide').evaluate(element => element.open), true);
        await page.keyboard.press('Escape');

        await render(page, 'summary');
        await page.mouse.click(2, 2);
        assert.equal(await page.locator('#sixNimmtSummaryModal').evaluate(element => element.open), false);
        assert.deepEqual(await actions(page), []);
        await page.locator('#sixNimmtShowSummaryBtn').click();
        await page.locator('#sixNimmtSummaryHideBtn').click();
        await render(page, 'selection');

        const touch = await browser.newPage({viewport: {width: 390, height: 844}, isMobile: true, hasTouch: true});
        touch.on('pageerror', error => errors.push(error.message));
        await prepare(touch);
        await render(touch, 'selection');
        const bull = touch.locator('.sn-goal');
        await bull.tap();
        assert.equal(await touch.locator('#sixNimmtTooltip').isVisible(), true);
        await touch.locator('#sixNimmtRows .sn-danger').first().tap();
        assert.match(await touch.locator('#sixNimmtTooltip').textContent(), /第六张/);
        await touch.waitForTimeout(3200);
        assert.equal(await touch.locator('#sixNimmtTooltip').isVisible(), false);
        await touch.locator('[data-sn-card="56"]').tap();
        assert.equal(await touch.locator('#sixNimmtTooltip').isVisible(), false);
        await touch.keyboard.press('Escape');
        const target = touch.locator('[data-sn-card="56"]');
        await target.dispatchEvent('pointerdown', {pointerId: 8, isPrimary: true, pointerType: 'touch', clientX: 100, clientY: 500});
        await target.dispatchEvent('pointermove', {pointerId: 8, isPrimary: true, pointerType: 'touch', clientX: 100, clientY: 420});
        await target.dispatchEvent('pointerup', {pointerId: 8, isPrimary: true, pointerType: 'touch', clientX: 100, clientY: 420});
        await target.dispatchEvent('click', {detail: 1});
        assert.equal(await target.getAttribute('aria-pressed'), 'false');
        assert.deepEqual(await actions(touch), []);
        await touch.locator('#sixNimmtHelpBtn').tap();
        await touch.locator('#sixNimmtGuide .sn-card[data-bulls="7"]').tap();
        assert.equal(await touch.locator('#sixNimmtTooltip').isVisible(), true);
        assert.equal(await touch.locator('#sixNimmtTooltip').evaluate(element => element.parentNode.id), 'sixNimmtGuide');
        await touch.keyboard.press('Escape');
        await touch.evaluate(() => setGamePanelVisibility('cabo'));
        assert.equal(await touch.locator('#sixNimmtPanel').isVisible(), false);
        assert.equal(await touch.evaluate(() => document.body.classList.contains('sn-action-needed')), false);

        const live = await browser.newPage({viewport: {width: 390, height: 844}});
        live.on('pageerror', error => errors.push(error.message));
        await live.route('https://fonts.googleapis.com/**', route => route.abort());
        await live.goto(base);
        await live.waitForFunction(() => typeof socket !== 'undefined' && socket.connected && cachedGameList);
        await live.evaluate(() => {
            window.sixNimmtLiveEvents = [];
            socket.on('game:state', payload => sixNimmtLiveEvents.push(...(payload.events || [])));
            socket.emit('room:create', {name: 'Six QA', game_type: 'six_nimmt', config: {selection_timeout_sec: 0, row_choice_timeout_sec: 0}});
        });
        await live.waitForFunction(() => roomSessionReady && isGameAssetsLoaded('six_nimmt'));
        await live.evaluate(() => socket.emit('room:add_bot', {room_id: roomId}));
        await live.waitForFunction(() => currentRoomState.players.length === 2);
        await live.locator('#startBtn').click();
        await live.waitForFunction(() => lastGameStatePayload?.view?.phase === 'selection');
        await live.locator('#sixNimmtHand [data-sn-card]').first().click();
        await live.locator('#sixNimmtPlayBtn').click();
        await live.waitForFunction(() => ['row_choice', 'turn_summary'].includes(lastGameStatePayload?.view?.phase));
        if (await live.evaluate(() => lastGameStatePayload.view.legal_actions.includes('choose_row'))) {
            await live.locator('[data-sn-row="0"]').click();
            await live.locator('[data-sn-take="0"]').click();
        }
        await live.waitForFunction(() => lastGameStatePayload.view.phase === 'turn_summary' && lastGameStatePayload.view.summary_ack.length === 1);
        const liveEvents = await live.evaluate(() => sixNimmtLiveEvents);
        assert(liveEvents.some(event => event.type === 'bot:action'));
        for (const event of liveEvents) {
            if (event.type === 'six_nimmt:select') assert.deepEqual(Object.keys(event.payload), ['player_id']);
            if (event.type === 'bot:action' && event.payload.action.type === 'select_card') assert.deepEqual(event.payload.action, {type: 'select_card'});
        }
        await live.locator('#sixNimmtSummaryHideBtn').click();
        const room = await live.evaluate(() => roomId);
        await live.reload();
        await live.waitForFunction(() => isGameAssetsLoaded('six_nimmt') && lastGameStatePayload?.view?.phase === 'turn_summary');
        assert.equal(await live.evaluate(() => roomId), room);
        assert.equal(await live.locator('#sixNimmtSummaryModal').evaluate(element => element.open), true);
        await live.locator('#sixNimmtSummaryNextBtn').click();
        await live.waitForFunction(() => lastGameStatePayload.view.turn === 2 && lastGameStatePayload.view.phase === 'selection');
        assert.equal(await live.locator('#sixNimmtHand [data-sn-card]').count(), 9);
        await bounds(live, 'live room after reconnect and Next Round');

        assert.deepEqual(errors, []);
        console.log('PASS: 320/390/1024/1440px; all phases; Help/Explain; confirmation; docking; privacy; touch scroll; game switch; live bots, reconnect and Next Round.');
    } finally {
        await browser.close();
    }
})().catch(error => { console.error(error); process.exitCode = 1; });
