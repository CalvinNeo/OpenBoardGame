const {chromium} = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const {execFileSync} = require('node:child_process');

const base = process.env.ROOM_TEST_URL || 'http://127.0.0.1:8766';
const output = 'build/bomb-busters-campaign';
const views = JSON.parse(execFileSync(process.env.PYTHON || 'python3', ['-c', `
import json
from game.bomb_busters import BombBustersGame
from tests.test_bomb_busters_game import make_players
result = {}
for count in (2, 3, 5):
    for mission in (9, 22, 29, 31, 46, 49, 61, 63, 65):
        if count == 2 and mission == 65:
            continue
        state = BombBustersGame.init_game({"seed": "campaign-layout", "mission_id": mission}, make_players(count))
        for viewer in ("p0", "p1", "spectator"):
            result[f"{count}-{mission}-{viewer}"] = BombBustersGame.get_public_view(state, viewer)
print(json.dumps(result))
`], {encoding: 'utf8', maxBuffer: 8 * 1024 * 1024}));

(async () => {
    fs.mkdirSync(output, {recursive: true});
    const browser = await chromium.launch({channel: 'chrome', headless: true});
    const context = await browser.newContext({viewport: {width: 390, height: 844}, hasTouch: true});
    const page = await context.newPage();
    const errors = [];
    const measurements = [];
    page.on('pageerror', error => errors.push(error.message));
    page.setDefaultTimeout(12000);

    async function render(view) {
        await page.evaluate(view => {
            renderBombBustersGameState({view, state_version: ++window.bombBustersCampaignTestVersion});
        }, view);
    }

    async function actions() {
        return page.evaluate(() => window.bombBustersCampaignTestActions);
    }

    async function measure(width, label) {
        const measurement = await page.evaluate(() => {
            const root = document.getElementById('bombBustersCampaign');
            const equipment = document.getElementById('bombBustersEquipment');
            const rootBounds = root.getBoundingClientRect();
            const visible = [...root.querySelectorAll('span, strong, select, button')].filter(element => element.getClientRects().length);
            const controls = [...document.querySelectorAll('#bombBustersMissionChoices select, #bombBustersMissionChoices button')];
            const boxes = controls.map(element => element.getBoundingClientRect());
            const answer = document.querySelector('#bombBustersMissionChoices .bomb-busters-mission-answer');
            const selectBounds = answer?.querySelector('select').getBoundingClientRect();
            const confirmBounds = answer?.querySelector('button').getBoundingClientRect();
            return {
                overflow: document.documentElement.scrollWidth > innerWidth || root.scrollWidth > root.clientWidth,
                outside: visible.some(element => {
                    const bounds = element.getBoundingClientRect();
                    return bounds.left < rootBounds.left - 1 || bounds.right > rootBounds.right + 1;
                }),
                controlOverlap: boxes.some((first, firstIndex) => boxes.some((second, secondIndex) => firstIndex < secondIndex && first.left < second.right && first.right > second.left && first.top < second.bottom && first.bottom > second.top)),
                smallControl: boxes.some(bounds => bounds.height < 44),
                answerWrap: Boolean(selectBounds && Math.abs(selectBounds.top - confirmBounds.top) > 1),
                missionHeight: equipment.getBoundingClientRect().top - rootBounds.top,
            };
        });
        assert.equal(measurement.overflow, false, `${width} ${label}: overflow`);
        assert.equal(measurement.outside, false, `${width} ${label}: outside`);
        assert.equal(measurement.controlOverlap, false, `${width} ${label}: overlapping controls`);
        assert.equal(measurement.smallControl, false, `${width} ${label}: touch targets`);
        assert.equal(measurement.answerWrap, false, `${width} ${label}: confirm stays beside the choice`);
        measurements.push({width, label, ...measurement});
        return measurement;
    }

    try {
        await page.route('https://fonts.googleapis.com/**', route => route.abort());
        await page.goto(base);
        await page.waitForFunction(() => typeof socket !== 'undefined' && socket.connected && cachedGameList);
        await page.evaluate(() => socket.emit('room:create', {name: 'Bomb Busters Campaign QA', game_type: 'bomb_busters'}));
        await page.waitForFunction(() => roomSessionReady && isGameAssetsLoaded('bomb_busters'));
        await page.evaluate(() => {
            window.bombBustersCampaignTestVersion = 100;
            window.bombBustersCampaignTestActions = [];
            sendAction = action => window.bombBustersCampaignTestActions.push(action);
            setRoomControlsCollapsed(true);
        });
        const equipment = page.locator('#bombBustersEquipment');
        await render(views['3-46-p0']);
        assert.equal(await equipment.evaluate(element => element.open), true);
        await equipment.locator('summary').click();
        await render(views['3-46-p0']);
        assert.equal(await equipment.evaluate(element => element.open), false, 'State updates preserve deliberate collapse');
        await render({...views['3-46-p0'], attempt_number: 2});
        assert.equal(await equipment.evaluate(element => element.open), true, 'New attempts default open');
        await equipment.locator('summary').click();
        await render(views['3-49-p0']);
        assert.equal(await equipment.evaluate(element => element.open), true, 'New missions default open');
        await equipment.locator('summary').click();
        await page.evaluate(() => clearBombBustersState());
        await render(views['3-49-p0']);
        assert.equal(await equipment.evaluate(element => element.open), true, 'Reconnect/reset defaults open');

        for (const count of [2, 3, 5]) {
            for (const viewer of ['p0', 'p1', 'spectator']) {
                const view = structuredClone(views[`${count}-22-${viewer}`]);
                view.players.forEach(player => { player.name = `Seat ${player.seat} · ${player.player_id}`; });
                await render(view);
                const ownSeat = view.players.findIndex(player => player.player_id === viewer);
                if (ownSeat < 0) {
                    assert.equal(await page.locator('#bombBustersNeighbors span').count(), 0);
                    assert.equal(await page.locator('.bomb-busters-rack-neighbor').count(), 0);
                    continue;
                }
                const left = view.players[(ownSeat + 1) % count];
                const right = view.players[(ownSeat + count - 1) % count];
                assert.equal(await page.locator('#bombBustersNeighbors .bomb-busters-neighbor-left').textContent(), `← Left · ${left.name}`);
                assert.equal(await page.locator('#bombBustersNeighbors .bomb-busters-neighbor-right').textContent(), `Right · ${right.name} →`);
                const rackDirections = await page.locator('.bomb-busters-rack-neighbor').allTextContents();
                assert.deepEqual(rackDirections.sort(), count === 2 ? ['← Your left & right →'] : ['Your right →', '← Your left'].sort());
                assert((await page.locator('.bomb-busters-rack-neighbor').first().getAttribute('data-bomb-busters-tip')).includes(left.name));
            }
        }

        for (const width of [320, 390, 1024, 1440]) {
            await page.setViewportSize({width, height: 844});
            for (const mission of [9, 22, 29, 31, 46, 49, 61, 63, 65]) {
                const view = structuredClone(views[`5-${mission}-p1`]);
                if (mission === 22) {
                    view.phase = 'mission_decision';
                    view.campaign.decision = {kind: 'bonus_clue', player_id: view.you, choices: Array.from({length: 12}, (_, index) => ({value: index + 1, label: String(index + 1)}))};
                }
                await render(view);
                const measurement = await measure(width, `mission-${mission}`);
                if (mission === 22) {
                    assert(measurement.missionHeight <= 130, `${width}: long choices stay compact`);
                    assert.equal(await page.locator('#bombBustersMissionChoices select').count(), 1);
                    assert.equal(await page.locator('#bombBustersMissionChoices button').count(), 1);
                    const recipient = view.players[2];
                    assert((await page.locator('#bombBustersMissionChoices strong').textContent()).includes(`← Left: ${recipient.name}`));
                    assert.equal((await actions()).length, 0);
                    await page.locator('#bombBustersMissionChoices select').selectOption({value: '7'});
                    assert.equal((await actions()).length, 0, 'Selecting does not submit');
                    await page.locator('#bombBustersMissionChoices button').click();
                    assert.deepEqual((await actions()).at(-1), {type: 'mission_choice', choice: 8});
                    await page.evaluate(() => { window.bombBustersCampaignTestActions = []; });
                    await render(view);
                    await page.mouse.move(0, 0);
                    await page.screenshot({path: `${output}/${width}-mission-22.png`});
                }
                if (mission === 49) {
                    view.phase = 'playing';
                    view.current_turn = view.you;
                    view.campaign.decision = null;
                    await render(view);
                    const options = await page.locator('#bombBustersOxygenRecipient option').allTextContents();
                    assert(options.some(text => text.includes(`${view.players[2].name} · ← Left`)));
                    assert(options.some(text => text.includes(`${view.players[0].name} · Right →`)));
                    await measure(width, 'oxygen-recipients');
                }
            }
            const initial = structuredClone(views['3-22-p0']);
            initial.phase = 'initial_info';
            initial.initial_info_player_id = initial.you;
            initial.campaign.decision = null;
            initial.campaign.initial_label_choices = ['1', '2', '3', '4', 'yellow'];
            await render(initial);
            await page.locator('#bombBustersMissionChoices select').selectOption('4');
            await page.locator('#bombBustersMissionChoices button').click();
            assert.deepEqual((await actions()).at(-1), {type: 'place_initial_info', label: 'yellow'});
            await page.evaluate(() => { window.bombBustersCampaignTestActions = []; });
            await measure(width, 'initial-absent-clue');

            const longNames = structuredClone(views['5-63-p0']);
            longNames.players.forEach(player => { player.name = `${player.player_id} Very Long Player Name 很长的玩家姓名`; });
            await render(longNames);
            await measure(width, 'long-names');
            await page.mouse.move(0, 0);
            await page.screenshot({path: `${output}/${width}-oxygen-long-names.png`});
        }

        const privateDecision = structuredClone(views['3-31-p1']);
        privateDecision.phase = 'mission_setup';
        privateDecision.campaign.decision = {kind: 'constraint', player_id: 'p0', choices: []};
        await render(privateDecision);
        assert.equal(await page.locator('#bombBustersMissionChoices button, #bombBustersMissionChoices select').count(), 0, 'Private choices remain unavailable to other viewers');

        const stringDecision = structuredClone(views['3-31-p0']);
        stringDecision.phase = 'mission_setup';
        stringDecision.campaign.decision = {kind: 'constraint', player_id: 'p0', choices: ['A', 'B', 'C', 'D', 'E'].map(value => ({value, label: `${value} · Constraint description`}))};
        await render(stringDecision);
        await page.locator('#bombBustersMissionChoices select').selectOption({value: '3'});
        await page.locator('#bombBustersMissionChoices button').click();
        assert.deepEqual((await actions()).at(-1), {type: 'mission_choice', choice: 'D'});
        await page.evaluate(() => { window.bombBustersCampaignTestActions = []; });
        await render(stringDecision);
        await page.locator('#bombBustersExplainBtn').click();
        await page.locator('#bombBustersMissionChoices select').click();
        await page.locator('.obg-explain-dialog').waitFor({state: 'visible'});
        assert((await page.locator('.obg-explain-text').textContent()).includes('private options'));
        assert.equal((await actions()).length, 0);
        await page.keyboard.press('Escape');

        const decision = structuredClone(views['3-22-p0']);
        decision.phase = 'mission_decision';
        decision.campaign.decision = {kind: 'sequence_side', player_id: 'p0', choices: [{value: 'left', label: 'Left'}, {value: 'right', label: 'Right'}]};
        await render(decision);
        assert.equal(await page.locator('#bombBustersMissionChoices select').count(), 0);
        assert(!(await page.locator('#bombBustersMissionChoices strong').textContent()).includes('← Left:'));
        await page.locator('#bombBustersMissionChoices button').first().click();
        assert.deepEqual((await actions()).at(-1), {type: 'mission_choice', choice: 'left'});
        await page.evaluate(() => { window.bombBustersCampaignTestActions = []; });

        await page.locator('#bombBustersExplainBtn').click();
        await page.locator('#bombBustersNeighbors .bomb-busters-neighbor-left').click();
        await page.locator('.obg-explain-dialog').waitFor({state: 'visible'});
        assert((await page.locator('.obg-explain-text').textContent()).includes('table seating'));
        assert.equal((await actions()).length, 0);
        await page.keyboard.press('Escape');
        await page.locator('#bombBustersNeighbors .bomb-busters-neighbor-left').tap();
        await page.locator('#bombBustersTooltip').waitFor({state: 'visible'});
        assert((await page.locator('#bombBustersTooltip').textContent()).includes('table seating'));
        await page.locator('#bombBustersTooltip').waitFor({state: 'hidden', timeout: 5000});
        await page.locator('#bombBustersNeighbors .bomb-busters-neighbor-right').hover();
        await page.locator('#bombBustersTooltip').waitFor({state: 'visible'});
        assert((await page.locator('#bombBustersTooltip').textContent()).includes('Right'));
        assert.deepEqual(errors, []);
        fs.writeFileSync(`${output}/measurements.json`, JSON.stringify(measurements, null, 2));
        console.log(`PASS: ${measurements.length} campaign layouts, seating, equipment defaults, compact decisions, typed payloads, Explain and tooltip`);
    } finally {
        await context.close();
        await browser.close();
    }
})().catch(error => { console.error(error); process.exitCode = 1; });
