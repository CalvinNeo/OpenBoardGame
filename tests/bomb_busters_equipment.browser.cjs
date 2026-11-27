const {chromium} = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const {execFileSync} = require('node:child_process');

const base = process.env.ROOM_TEST_URL || 'http://127.0.0.1:8782';
const output = 'build/bomb-busters-equipment';
const fixture = JSON.parse(execFileSync(process.env.PYTHON || 'python3', ['-c', `
import json
from game import bomb_busters_campaign as campaign
from game.bomb_busters import BombBustersGame as Game
from tests.test_bomb_busters_missions import make_mission, finish_setup
state = finish_setup(make_mission(9))
state['current_turn'] = 'p0'
state['campaign']['equipment'] = []
for index, kind in enumerate(('equal','not_equal','walkie_talkies','post_it','single_label','radar','stabilizer','triple_detector','super_detector','x_or_y','fast_pass','rewinder','batteries','coffee','grappling_hook')):
    card = campaign._equipment_card(kind, index)
    card['unlocked'] = True
    state['campaign']['equipment'].append(card)
rack = state['racks'][state['players']['p0']['rack_ids'][0]]
for wire in state['wires'].values():
    wire.pop('clue', None)
    wire['info_token_id'] = None
for token in state['info_tokens'].values():
    token['attached_wire_id'] = None
for index, wire_id in enumerate(rack['slots']):
    wire = state['wires'][wire_id]
    value = 3 if index in (5, 6) else 8 if index == 8 else 2
    wire.update(kind='blue', blue_value=value, sort_tick=value * 10)
state['campaign']['links'] = [{'wire_ids':rack['slots'][5:7], 'relation':'='}, {'wire_ids':rack['slots'][6:8], 'relation':'≠'}]
state['wires'][rack['slots'][5]]['clue'] = {'label':'3', 'negative':False}
state['wires'][rack['slots'][8]]['clue'] = {'label':'×1', 'negative':False}
state['campaign']['stabilized'] = 'p0'
state['campaign']['radar_value'] = 3
state['campaign']['radar'] = [{'rack_id':entry['rack_id'], 'has_value':entry['owner_id']=='p0'} for entry in state['racks'].values()]
state['campaign']['clue_notes'] = [{'player_id':'p0','label':'12','absent':True}]
state['players']['p1']['personal_detector_used'] = True
state['players']['p2']['personal_detector_used'] = True
print(json.dumps({'views':{viewer:Game.get_public_view(state,viewer) for viewer in ('p0','p1','spectator')}, 'own':rack['slots'], 'saved':Game.serialize(state)}))
`], {encoding: 'utf8', maxBuffer: 4 * 1024 * 1024}));

(async () => {
    fs.mkdirSync(output, {recursive: true});
    const browser = await chromium.launch({channel: 'chrome', headless: true});
    const errors = [];
    const measurements = [];
    const context = await browser.newContext({viewport: {width: 390, height: 844}, hasTouch: true, isMobile: true});
    const page = await context.newPage();
    page.setDefaultTimeout(12000);
    page.on('pageerror', error => errors.push(error.message));
    async function render(view = fixture.views.p0) {
        await page.evaluate(view => renderBombBustersGameState({view, state_version: ++window.bombBustersEquipmentVersion}), view);
    }
    const wire = wireId => page.locator(`.bomb-busters-wire-button[data-wire-id="${wireId}"]`);
    async function equipment(kind) {
        const name = fixture.views.p0.campaign.equipment.find(card => card.kind === kind).name;
        await page.locator('.bomb-busters-equipment-card').filter({hasText: name}).tap();
    }
    async function lastAction() {
        return page.evaluate(() => window.bombBustersEquipmentActions.at(-1));
    }
    try {
        await page.route('https://fonts.googleapis.com/**', route => route.abort());
        await page.goto(base);
        await page.waitForFunction(() => typeof socket !== 'undefined' && socket.connected && cachedGameList, null, {timeout: 60000});
        await page.evaluate(() => socket.emit('room:create', {name: 'Equipment QA', game_type: 'bomb_busters'}));
        await page.waitForFunction(() => roomSessionReady && isGameAssetsLoaded('bomb_busters'));
        await page.evaluate(() => {
            window.bombBustersEquipmentVersion = 100;
            window.bombBustersEquipmentActions = [];
            sendAction = action => window.bombBustersEquipmentActions.push(action);
            closeSettingsModal();
            setRoomControlsCollapsed(true);
        });
        for (const width of [320, 390, 1024, 1440]) {
            await page.setViewportSize({width, height: 844});
            for (const viewer of ['p0', 'p1', 'spectator']) {
                await render(fixture.views[viewer]);
                assert.equal(await page.locator('.bomb-busters-wire-link').count(), 4);
                assert.equal(await page.locator('.bomb-busters-player-annotations').count(), 1);
                assert.equal(await page.locator('.bomb-busters-radar-label').count(), fixture.views[viewer].racks.length);
                const measurement = await page.evaluate(() => {
                    const markers = [...document.querySelectorAll('.bomb-busters-wire-link')];
                    return {
                        overflow: document.documentElement.scrollWidth > innerWidth,
                        outside: markers.some(marker => {const box = marker.getBoundingClientRect();const slot = marker.closest('.bomb-busters-wire-slot').getBoundingClientRect();return box.left < slot.left - 1 || box.right > slot.right + 1;}),
                        overlap: markers.some(marker => marker.getBoundingClientRect().top < marker.closest('.bomb-busters-wire-slot').querySelector('button').getBoundingClientRect().bottom),
                        labels: markers.map(marker => marker.textContent),
                    };
                });
                assert.equal(measurement.overflow, false);
                assert.equal(measurement.outside, false);
                assert.equal(measurement.overlap, false);
                if (viewer !== 'p0') assert.equal(await wire(fixture.own[5]).locator('.bomb-busters-wire-label').textContent(), '?');
                measurements.push({width, viewer, ...measurement});
                await page.screenshot({path: `${output}/annotations-${width}-${viewer}.png`, fullPage: true});
            }
        }
        await page.setViewportSize({width: 390, height: 844});
        await render();
        const marker = page.locator('.bomb-busters-wire-link').first();
        await marker.tap();
        await page.locator('#bombBustersTooltip:not(.hidden)').waitFor();
        assert.match(await page.locator('#bombBustersTooltip').textContent(), /same cut value/);
        await page.keyboard.press('Escape');
        await page.locator('#bombBustersExplainBtn').tap();
        await marker.tap();
        await page.locator('.obg-explain-dialog[open]').waitFor();
        assert.match(await page.locator('.obg-explain-dialog').textContent(), /same cut value/);
        await page.keyboard.press('Escape');
        await render();
        assert.equal(await page.locator('.bomb-busters-wire-link').count(), 4, 'State refresh retains labels');

        for (const [kind, indexes] of [['equal', [5, 6]], ['not_equal', [6, 7]]]) {
            await render();
            await equipment(kind);
            await wire(fixture.own[indexes[0]]).tap();
            assert.equal(await page.locator('#bombBustersCampaignConfirm').isEnabled(), false);
            await wire(fixture.own[indexes[1]]).tap();
            assert.equal(await page.locator('#bombBustersCampaignConfirm').isEnabled(), true);
            await page.locator('#bombBustersCampaignConfirm').tap();
            assert.deepEqual((await lastAction()).wire_ids, indexes.map(index => fixture.own[index]));
        }
        await render();
        await equipment('equal');
        await wire(fixture.own[0]).tap();
        await wire(fixture.own[8]).tap();
        assert.equal(await page.locator('#bombBustersCampaignConfirm').isEnabled(), false, 'Invalid relation or non-adjacent wires cannot confirm');

        await render();
        await equipment('walkie_talkies');
        const teammate = page.locator('#bombBustersCampaignSelectionOptions select');
        await teammate.selectOption('p2');
        await wire(fixture.own[0]).tap();
        assert.equal(await page.locator('.bomb-busters-player-card:not(.is-self) .bomb-busters-wire-button:enabled').count(), 0, 'Offer cannot select the teammate return wire');
        assert.equal(await page.locator('#bombBustersCampaignConfirm').isEnabled(), true);
        await page.locator('#bombBustersCampaignConfirm').tap();
        assert.deepEqual(await lastAction(), {type: 'use_equipment', equipment_id: 'equipment-2', own_wire_id: fixture.own[0], recipient_id: 'p2'});
        for (const width of [320, 390, 1024, 1440]) {
            await page.setViewportSize({width, height: 844});
            await render();
            await equipment('walkie_talkies');
            await wire(fixture.own[0]).tap();
            const selection = page.locator('#bombBustersCampaignSelection');
            await selection.scrollIntoViewIfNeeded();
            const layout = await selection.evaluate(element => {
                const panel = element.getBoundingClientRect();
                const controls = [...element.querySelectorAll('button, select')].map(control => control.getBoundingClientRect());
                return {
                    overflow: document.documentElement.scrollWidth > innerWidth,
                    outside: controls.some(box => box.left < panel.left || box.right > panel.right),
                    overlap: controls.some((box, index) => controls.slice(index + 1).some(other =>
                        box.left < other.right && other.left < box.right && box.top < other.bottom && other.top < box.bottom)),
                };
            });
            assert.deepEqual(layout, {overflow: false, outside: false, overlap: false});
            await selection.screenshot({path: `${output}/walkie-${width}.png`});
        }
        await page.setViewportSize({width: 390, height: 844});

        for (const kind of ['single_label', 'triple_detector', 'super_detector', 'x_or_y']) {
            await render();
            await equipment(kind);
            await wire(fixture.own[0]).tap();
            const targets = fixture.views.p0.racks.filter(rack => rack.owner_id !== 'p0');
            if (kind === 'x_or_y') await wire(fixture.own[1]).tap();
            if (kind !== 'single_label') await wire(targets[0].slots[0].wire_id).tap();
            if (['triple_detector', 'super_detector'].includes(kind)) await wire(targets[1].slots[0].wire_id).tap();
            if (kind === 'triple_detector') await wire(targets[0].slots[1].wire_id).tap();
            assert.equal(await page.locator('#bombBustersCampaignConfirm').isEnabled(), false, `${kind} rejects duplicate values or cross-rack targets`);
        }

        for (const kind of ['post_it', 'single_label', 'radar', 'stabilizer', 'super_detector', 'triple_detector', 'x_or_y', 'fast_pass', 'rewinder', 'batteries', 'coffee', 'grappling_hook']) {
            await render();
            await equipment(kind);
            const target = fixture.views.p0.racks.find(rack => rack.owner_id === 'p1');
            if (['post_it', 'single_label'].includes(kind)) await wire(fixture.own[8]).tap();
            if (['super_detector', 'triple_detector', 'x_or_y'].includes(kind)) {
                await wire(fixture.own[0]).tap();
                if (kind === 'x_or_y') await wire(fixture.own[8]).tap();
                for (const slot of target.slots.slice(0, kind === 'triple_detector' ? 3 : 1)) await wire(slot.wire_id).tap();
            }
            if (kind === 'fast_pass') {
                await wire(fixture.own[0]).tap();
                await wire(fixture.own[1]).tap();
            }
            if (kind === 'batteries') {
                for (const player of fixture.views.p0.players.filter(player => player.personal_detector_used)) {
                    await page.locator('#bombBustersCampaignSelectionOptions button').getByText(player.name, {exact: true}).tap();
                }
            }
            if (kind === 'coffee') await page.locator('#bombBustersCampaignSelectionOptions select').selectOption('p2');
            if (kind === 'grappling_hook') await wire(target.slots[0].wire_id).tap();
            assert.equal(await page.locator('#bombBustersCampaignConfirm').isEnabled(), true, `${kind} can confirm a valid selection`);
            await page.locator('#bombBustersCampaignConfirm').tap();
            const action = await lastAction();
            assert.equal(action.type, 'use_equipment');
            if (['post_it', 'single_label'].includes(kind)) assert.equal(action.wire_id, fixture.own[8]);
            if (kind === 'radar') assert.equal(action.value, 1);
            if (kind === 'triple_detector') assert.equal(action.target_wire_ids.length, 3);
            if (kind === 'super_detector') assert.equal(action.target_wire_ids.length, target.slots.length);
            if (kind === 'x_or_y') assert.deepEqual(action.own_wire_ids, [fixture.own[0], fixture.own[8]]);
            if (kind === 'fast_pass') assert.deepEqual(action.wire_ids, fixture.own.slice(0, 2));
            if (kind === 'batteries') assert.deepEqual(action.player_ids, ['p1', 'p2']);
            if (kind === 'coffee') assert.equal(action.recipient_id, 'p2');
            if (kind === 'grappling_hook') {
                assert.equal(action.wire_id, target.slots[0].wire_id);
                assert.equal(action.rack_id, fixture.views.p0.racks.find(rack => rack.owner_id === 'p0').rack_id);
            }
        }
        const actions = await page.evaluate(() => window.bombBustersEquipmentActions);
        fs.writeFileSync(`${output}/actions.json`, JSON.stringify(actions, null, 2));
        const validation = execFileSync(process.env.PYTHON || 'python3', ['-c', `
import json, sys
from game.bomb_busters import BombBustersGame as Game
fixture = json.load(sys.stdin)
for action in fixture['actions']:
    state = Game.deserialize(fixture['saved'])
    _, error = Game.apply_action(state, 'p0', action)
    assert error is None, (action, error)
    if action['equipment_id'] == 'equipment-2':
        recipient = action['recipient_id']
        view = Game.get_public_view(state, recipient)
        choice = view['campaign']['decision']['choices'][0]['value']
        _, error = Game.apply_action(state, recipient, {'type':'mission_choice', 'choice':choice})
        assert error is None, error
        assert state['wires'][action['own_wire_id']]['owner_id'] == recipient
        assert state['wires'][choice]['owner_id'] == 'p0'
print('Server rules accepted all captured equipment actions and the Walkie-Talkies reply')
        `], {encoding: 'utf8', input: JSON.stringify({saved: fixture.saved, actions})});
        console.log(validation.trim());
        assert.deepEqual(errors, []);
        console.log(`PASS ${measurements.length} equipment annotation layouts, public viewer privacy, labels, radar, Stabilizer, tooltip/Explain and 15 equipment payloads`);
    } finally {
        fs.writeFileSync(`${output}/measurements.json`, JSON.stringify({measurements, errors}, null, 2));
        await context.close();
        await browser.close();
    }
})().catch(error => {console.error(error);process.exitCode = 1;});
