const {chromium} = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const {execFileSync} = require('node:child_process');

const base = process.env.ROOM_TEST_URL || 'http://127.0.0.1:8782';
const output = 'build/bomb-busters-failure';
const fixtures = JSON.parse(execFileSync(process.env.PYTHON || 'python3', ['-c', `
import json
from game.bomb_busters import BombBustersGame as Game
from tests.test_bomb_busters_missions import make_mission, finish_setup, rig, blue
result = {}
for reason in ('red_wire', 'detonator', 'special_cut', 'timer', 'miss', 'success'):
    state = finish_setup(make_mission(13 if reason == 'special_cut' else 10 if reason == 'timer' else 9))
    target = {'owner_id':'p1','kind':'red','sort_tick':35} if reason == 'red_wire' else blue('p1',3 if reason == 'success' else 4)
    specs = [blue('p0',3),target] if reason == 'success' else [blue('p0',3),target,blue('p2',5)]
    wires = rig(state,'p0',specs)
    state['player_meta']['p0']['name'] = 'Alex · Final wire cutter'
    if reason == 'detonator':
        state['detonator'].update(mistakes_used=2,remaining=1)
    action = {'type':'dual_cut','own_wire_id':wires[0]['wire_id'],'target_wire_id':wires[1]['wire_id']}
    if reason == 'special_cut':
        action = {'type':'special_cut','wire_ids':[wire['wire_id'] for wire in wires]}
    if reason == 'timer':
        state['campaign']['clock']['deadline'] = 0
    events,error = Game.apply_action(state,'p0',action)
    assert error is None,error
    result[reason] = {'events':events,'views':{viewer:Game.get_public_view(state,viewer) for viewer in ('p0','p1','spectator')}}
print(json.dumps(result))
`], {encoding: 'utf8', maxBuffer: 4 * 1024 * 1024}));

(async () => {
    fs.mkdirSync(output, {recursive: true});
    const browser = await chromium.launch({channel: 'chrome', headless: true});
    const errors = [];
    const measurements = [];
    try {
        for (const width of [320, 390, 1024, 1440]) {
            const context = await browser.newContext({viewport: {width, height: 844}, hasTouch: width < 500, isMobile: width < 500});
            const page = await context.newPage();
            page.on('pageerror', error => errors.push(error.message));
            await page.route('https://fonts.googleapis.com/**', route => route.abort());
            await page.goto(base);
            await page.waitForFunction(() => typeof socket !== 'undefined' && socket.connected && cachedGameList);
            await page.evaluate(() => socket.emit('room:create', {name: 'Failure effect QA', game_type: 'bomb_busters'}));
            await page.waitForFunction(() => roomSessionReady && isGameAssetsLoaded('bomb_busters'));
            await page.evaluate(() => {
                closeSettingsModal();
                setRoomControlsCollapsed(true);
                window.bombBustersNormalSplashes = 0;
                window.obgPlayPoopSplash = () => {window.bombBustersNormalSplashes += 1;};
            });
            let version = 100;
            async function render(reason, viewer = 'p0', events = fixtures[reason].events, stateVersion = ++version) {
                await page.evaluate(data => renderBombBustersGameState(data), {view: fixtures[reason].views[viewer], events, state_version: stateVersion});
                return stateVersion;
            }
            const effect = page.locator('#bombBustersFailureEffect');
            for (const [index, viewer] of ['p0', 'p1', 'spectator'].entries()) {
                const stateVersion = await render(index === 1 ? 'detonator' : 'red_wire', viewer);
                await effect.waitFor({state: 'visible'});
                assert.equal(await effect.locator('.bomb-busters-failure-name').textContent(), 'Alex · Final wire cutter');
                assert.equal(await effect.locator('.bomb-busters-failure-rain > span').count(), 21);
                assert.equal(await page.evaluate(() => bombBustersNormalSplashes), 0, 'Fatal cut replaces rather than queues the normal splash');
                for (const time of [600, 3200]) {
                    const geometry = await effect.evaluate((element, time) => {
                        element.getAnimations({subtree: true}).forEach(animation => {animation.pause();animation.currentTime = time;});
                        const stage = element.querySelector('.bomb-busters-failure-stage').getBoundingClientRect();
                        const name = element.querySelector('.bomb-busters-failure-name').getBoundingClientRect();
                        const pile = element.querySelector('.bomb-busters-failure-pile').getBoundingClientRect();
                        const person = element.querySelector('.bomb-busters-failure-person').getBoundingClientRect();
                        return {
                            overflow: document.documentElement.scrollWidth > innerWidth,
                            outside: stage.left < 0 || stage.right > innerWidth || stage.top < 0 || stage.bottom > innerHeight,
                            nameOverlap: name.top < pile.bottom,
                            buried: pile.top <= person.top && pile.bottom >= person.bottom,
                            pointerEvents: getComputedStyle(element).pointerEvents,
                        };
                    }, time);
                    assert.equal(geometry.overflow, false);
                    assert.equal(geometry.outside, false);
                    assert.equal(geometry.nameOverlap, false);
                    assert.equal(geometry.pointerEvents, 'none');
                    if (time === 3200) assert.equal(geometry.buried, true, 'Pile covers the entire character');
                    measurements.push({width, viewer, time, ...geometry});
                    if (viewer === 'p0') await page.screenshot({path: `${output}/${width}-${time}.png`});
                }
                await page.keyboard.press('Escape');
                await effect.waitFor({state: 'hidden'});
                await render(index === 1 ? 'detonator' : 'red_wire', viewer, fixtures[index === 1 ? 'detonator' : 'red_wire'].events, stateVersion);
                assert.equal(await effect.isVisible(), false, 'Duplicate final event does not replay');
            }
            await render('special_cut');
            assert.equal(await effect.isVisible(), true);
            await page.evaluate(() => clearBombBustersState());
            assert.equal(await effect.isVisible(), false);
            for (const reason of ['timer', 'success', 'miss']) {
                await render(reason);
                assert.equal(await effect.isVisible(), false, `${reason} does not trigger a burial`);
            }
            await render('red_wire', 'p0', []);
            assert.equal(await effect.isVisible(), false, 'Reconnection without a new event does not replay');
            await page.emulateMedia({reducedMotion: 'reduce'});
            await render('detonator');
            assert.equal(await effect.isVisible(), true);
            assert.equal(await effect.evaluate(element => element.classList.contains('is-reduced')), true);
            assert.equal(await effect.evaluate(element => element.getAnimations({subtree: true}).length), 0);
            await page.screenshot({path: `${output}/${width}-reduced.png`});
            await effect.waitFor({state: 'hidden', timeout: 3000});
            await page.emulateMedia({reducedMotion: 'no-preference'});
            await render('red_wire');
            assert.equal(await effect.isVisible(), true);
            await effect.waitFor({state: 'hidden', timeout: 6000});
            await render('red_wire');
            await page.evaluate(() => showBombBustersHeaderActions(false));
            assert.equal(await effect.isVisible(), false, 'Switching away cancels the effect');
            await context.close();
        }
        const liveContexts = [];
        try {
            const pages = [];
            for (const name of ['Live failure host', 'Live failure guest']) {
                const context = await browser.newContext({viewport: {width: 390, height: 844}, hasTouch: true, isMobile: true});
                liveContexts.push(context);
                const page = await context.newPage();
                pages.push(page);
                page.on('pageerror', error => errors.push(error.message));
                await page.route('https://fonts.googleapis.com/**', route => route.abort());
                await page.goto(base);
                await page.waitForFunction(() => typeof socket !== 'undefined' && socket.connected && cachedGameList);
                if (pages.length === 1) await page.evaluate(name => socket.emit('room:create', {name, game_type: 'bomb_busters'}), name);
                else {
                    const room = await pages[0].evaluate(() => currentRoomState.room_id);
                    await page.evaluate(({room, name}) => socket.emit('room:join', {room_id: room, name}), {room, name});
                }
                await page.waitForFunction(() => roomSessionReady && isGameAssetsLoaded('bomb_busters'));
                await page.evaluate(() => {closeSettingsModal();setRoomControlsCollapsed(true);socket.emit('room:ready', {ready: true});});
            }
            const host = pages[0];
            await host.waitForFunction(() => currentRoomState.players.length === 2 && currentRoomState.players.every(player => player.ready));
            const started = await host.evaluate(() => new Promise(resolve => socket.emit('bomb_busters:select_mission', {
                room_id: currentRoomState.room_id, status: currentRoomState.status,
                state_version: lastGameStatePayload?.state_version, mission_id: 25,
            }, resolve)));
            assert.equal(started.ok, true);
            for (const page of pages) await page.waitForFunction(() => lastGameStatePayload?.view.campaign?.id === 25);
            for (let index = 0; index < 4; index += 1) {
                const view = await host.evaluate(() => lastGameStatePayload.view);
                if (view.phase !== 'initial_info') break;
                const actor = (await pages[0].evaluate(() => lastGameStatePayload.view.you)) === view.initial_info_player_id ? pages[0] : pages[1];
                const version = await host.evaluate(() => lastGameStatePayload.state_version);
                await actor.evaluate(() => sendAction({type: 'place_initial_info', wire_id: lastGameStatePayload.view.initial_info_candidate_wire_ids[0]}));
                await host.waitForFunction(version => lastGameStatePayload.state_version > version, version);
            }
            const expected = await host.evaluate(() => {
                const view = lastGameStatePayload.view;
                return view.players.find(player => player.player_id === view.current_turn);
            });
            const remaining = await host.evaluate(() => lastGameStatePayload.view.detonator.remaining);
            for (let index = 0; index < remaining; index += 1) {
                const view = await host.evaluate(() => lastGameStatePayload.view);
                const actor = (await pages[0].evaluate(() => lastGameStatePayload.view.you)) === view.current_turn ? pages[0] : pages[1];
                const version = await host.evaluate(() => lastGameStatePayload.state_version);
                await actor.evaluate(() => sendAction({type: 'mission_choice', choice: 'speech_mistake'}));
                await host.waitForFunction(version => lastGameStatePayload.state_version > version, version);
            }
            const actorId = await host.evaluate(() => lastGameStatePayload.view.last_result.failed_by);
            assert.equal(actorId, expected.player_id);
            for (const page of pages) {
                await page.locator('#bombBustersFailureEffect').waitFor({state: 'visible'});
                assert.equal(await page.locator('.bomb-busters-failure-name').textContent(), expected.name);
                assert.equal(await page.evaluate(() => lastGameStatePayload.view.last_result.failed_by), actorId);
                await page.keyboard.press('Escape');
            }
            await host.reload();
            await host.waitForFunction(() => roomSessionReady && lastGameStatePayload?.view.phase === 'mission_result');
            assert.equal(await host.locator('#bombBustersFailureEffect').isVisible(), false);
        } finally {
            for (const context of liveContexts) await context.close();
        }
        assert.deepEqual(errors, []);
        console.log('PASS 4 widths, 3 viewers, falling/buried frames, attribution, fatal-event priority, deduplication, reconnect, Escape, cleanup, reduced motion and live two-client final penalty');
    } finally {
        fs.writeFileSync(`${output}/measurements.json`, JSON.stringify({measurements, errors}, null, 2));
        await browser.close();
    }
})().catch(error => {console.error(error);process.exitCode = 1;});
