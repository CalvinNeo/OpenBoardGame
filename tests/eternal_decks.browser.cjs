// Run against a local server. Set PLAYWRIGHT_MODULE, ROOM_TEST_URL and PYTHON as needed.
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { execFileSync } = require('node:child_process');
const base = process.env.ROOM_TEST_URL || 'http://127.0.0.1:8766';
const output = 'tmp/eternal-decks-ui';
fs.mkdirSync(output, { recursive: true });
const views = JSON.parse(execFileSync(process.env.PYTHON || 'python3', ['-c', `
import copy, json
from game.eternal_decks import EternalDecksGame as Game
from game.eternal_decks_data import ETERNALS
players = [{'player_id': f'p{i}', 'name': name, 'seat': i} for i, name in enumerate(['Alex', 'River', 'Kai', 'Mira'])]
s = Game.init_game({'seed': 99}, players)
views = {'setup': Game.get_public_view(s, 'p0')}
def number(value, color, cid):
    return {'id': cid, 'kind': 'number', 'number': value, 'colors': color.split('_')}
def ability(eid):
    return {'id': 'ability-' + eid, 'kind': 'ability', 'colors': [], 'source': eid, 'ability': ETERNALS[eid]['ability']}
s['phase'] = 'playing'
s['current_turn'] = 'p0'
s['players']['p0']['hand'] = [number(5, 'red', 'red-5'), number(7, 'blue', 'blue-7'), {'id': 'rare', 'kind': 'rare', 'colors': []}]
s['rows'][0]['cards'] = [number(2, 'green', 'field-0')]
s['rows'][1]['cards'] = [number(8, 'blue', 'field-1')]
s['rows'][2]['cards'] = [number(3, 'red', 'field-2')]
s['rows'][0]['sleeping'].remove('A1')
s['revived'] = [{'id': 'A1', 'owner': 'p0', 'jewel': None}]
s['river'] = [number(8, 'yellow', 'river-0')]
s['players']['p0']['discs'][0] = {'position': 9, 'seq': 2}
def save(key, state=s, viewer='p0'):
    views[key] = Game.get_public_view(state, viewer)
save('playing')
save('waiting', viewer='p1')
save('spectator', viewer='visitor')
dual = copy.deepcopy(s)
dual['players']['p0']['hand'] = [number(5, 'green_red', 'dual'), number(1, 'red', 'blocked'), ability('B2')]
save('dual', dual)
long = copy.deepcopy(s)
long['player_meta']['p0']['name'] = 'LongPlayerName' * 8
long['players']['p0']['hand'] = [number(i % 9 + 1, 'red_green', f'long-{i}') for i in range(15)]
for row in long['rows']:
    row['sleeping'] = []
    row['cards'] = [number(i + 1, 'red_green', f'full-{i}') for i in range(7)]
    row['closed'] = True
for p in long['players'].values():
    for d in p['discs']:
        d['position'] = 0
save('long', long)
for phase in ['revival', 'camp_choice', 'discussion', 'round_end', 'game_over']:
    state = copy.deepcopy(s)
    state['phase'] = phase
    state['pending_row'] = 1
    if phase == 'discussion':
        state['hands_revealed'] = True
    if phase == 'round_end':
        state['turn_notes'] = ['Review the completed turn together.']
        state['review_cards'] = [{'label': 'Field', 'cards': s['players']['p0']['hand']}]
    if phase == 'game_over':
        state['game_over'] = True
        state['result'] = {'success': True, 'reason': 'Four stars collected.'}
    save(phase, state)
print(json.dumps(views))
`], { encoding: 'utf8' }));

async function prepare(page) {
    await page.route('https://fonts.googleapis.com/**', route => route.abort());
    await page.goto(base);
    await page.waitForFunction(() => typeof socket !== 'undefined');
    await page.evaluate(async () => {
        socket.disconnect();
        await ensureGameAssets('eternal_decks');
        window.eternalDecksActions = [];
        sendAction = action => eternalDecksActions.push(action);
    });
}

async function render(page, key = 'playing') {
    await page.evaluate(view => {
        clearEternalDecksState();
        playerId = view.you;
        roomSessionReady = true;
        renderRoomState({room_id: 'ed-ui-preview', game_type: 'eternal_decks', status: 'in_game', players: view.players, host_id: 'p0', game_config: {}});
        setGamePanelVisibility('eternal_decks');
        renderGameState({game_type: 'eternal_decks', room_id: 'ed-ui-preview', view});
        syncRoomControlsExplainButton();
        eternalDecksActions.length = 0;
        window.scrollTo(0, 0);
    }, views[key]);
    await page.locator('.eternal-decks-shell').waitFor({state: 'visible'});
}

async function bounds(page, label) {
    const issues = await page.evaluate(() => {
        const bad = [...document.querySelectorAll('#eternalDecksPanel *, #eternalDecksDialog[open] *')].filter(el => {
            const r = el.getBoundingClientRect();
            if (!r.width || !r.height || getComputedStyle(el).opacity === '0') return false;
            return r.left < -1 || r.right > innerWidth + 1 ||
                (el.clientWidth && el.scrollWidth > el.clientWidth + 1 && !['auto', 'hidden'].includes(getComputedStyle(el).overflowX));
        }).map(el => `${el.className || el.id}: ${el.textContent.slice(0, 70)}`);
        return {pageOverflow: document.documentElement.scrollWidth > innerWidth, bad};
    });
    assert.deepEqual(issues, {pageOverflow: false, bad: []}, label);
}

const action = (page, name) => page.locator(`#eternalDecksPanel [data-ed-action="${name}"]`);
const space = (page, position) => page.locator(`#eternalDecksPanel [data-position="${position}"]`);
const cards = page => action(page, 'card');
const isOpen = page => action(page, 'drawer').getAttribute('aria-expanded');
async function sent(page) { return page.evaluate(() => eternalDecksActions); }

(async () => {
    const browser = await chromium.launch({channel: process.env.BROWSER_CHANNEL || 'chrome', headless: true});
    const errors = [];
    try {
        const desktop = await browser.newPage({viewport: {width: 1280, height: 900}});
        desktop.on('pageerror', error => errors.push(error.message));
        await prepare(desktop);
        for (const width of [320, 360, 393, 760, 768, 1280]) {
            await desktop.setViewportSize({width, height: 852});
            for (const key of Object.keys(views)) {
                await render(desktop, key);
                await bounds(desktop, `${width}px ${key}`);
                if (key !== 'spectator') {
                    await action(desktop, 'drawer').click();
                    await bounds(desktop, `${width}px ${key} expanded`);
                }
            }
        }
        console.log('PASS responsive layouts: 6 widths × 11 phases/fixtures, dock open and closed');

        const mobile = await browser.newPage({viewport: {width: 393, height: 852}, isMobile: true, hasTouch: true});
        mobile.on('pageerror', error => errors.push(error.message));
        await prepare(mobile);
        await render(mobile);
        assert.equal(await isOpen(mobile), 'false');
        assert.doesNotMatch(await mobile.locator('#eternalDecksPanel').textContent(), /your hand/i);
        await mobile.screenshot({path: `${output}/mobile-board.png`});
        await space(mobile, 1).tap();
        assert.equal(await isOpen(mobile), 'true');
        await cards(mobile).filter({hasText: '5'}).tap();
        assert.equal(await action(mobile, 'confirm').isEnabled(), true);
        await mobile.screenshot({path: `${output}/mobile-play.png`});
        await action(mobile, 'confirm').tap();
        assert.deepEqual(await sent(mobile), [{type: 'place', card_id: 'red-5', row: 0, orientation: 'normal'}]);
        assert.equal(await isOpen(mobile), 'false');

        await render(mobile, 'dual');
        await space(mobile, 1).tap();
        await action(mobile, 'card').filter({hasText: '5'}).tap();
        assert.match(await action(mobile, 'rotate').textContent(), /Rotated/);
        await action(mobile, 'rotate').tap();
        assert.equal(await action(mobile, 'confirm').isDisabled(), true);
        await action(mobile, 'card').filter({hasText: '1'}).tap();
        assert.equal(await action(mobile, 'confirm').isDisabled(), true);
        await mobile.keyboard.press('Escape');
        assert.equal(await isOpen(mobile), 'false');

        await render(mobile);
        await space(mobile, 0).tap();
        assert.equal(await mobile.locator('[data-mode="play"]').isDisabled(), true);
        await action(mobile, 'disc').nth(1).tap();
        assert.deepEqual(await sent(mobile), [{type: 'move_disc', disc: 1, position: 0, seq: 1}]);
        await render(mobile);
        await space(mobile, 9).tap();
        await action(mobile, 'return-disc').first().tap();
        assert.deepEqual(await sent(mobile), [{type: 'move_disc', disc: 0, position: -1, seq: 3}]);
        await render(mobile, 'waiting');
        await space(mobile, 25).tap();
        await action(mobile, 'disc').first().tap();
        assert.deepEqual(await sent(mobile), [{type: 'move_disc', disc: 0, position: 25, seq: 1}]);
        await render(mobile);
        await space(mobile, 1).tap();
        await mobile.locator('[data-mode="disc"]').tap();
        await bounds(mobile, 'mobile disc choices');
        await mobile.screenshot({path: `${output}/mobile-discs.png`});

        await render(mobile);
        await action(mobile, 'give').tap();
        await cards(mobile).first().tap();
        await action(mobile, 'target').first().tap();
        await action(mobile, 'confirm').tap();
        assert.deepEqual(await sent(mobile), [{type: 'give', card_id: 'red-5', target: 'p1'}]);
        await render(mobile);
        await action(mobile, 'jewels').tap();
        await mobile.locator('[data-recipe="any_2"]').tap();
        await cards(mobile).nth(0).tap();
        await cards(mobile).nth(1).tap();
        await action(mobile, 'confirm').tap();
        assert.deepEqual(await sent(mobile), [{type: 'generate', recipe: 'any_2', target: 'A1', card_ids: ['blue-7', 'red-5']}]);
        await render(mobile);
        await space(mobile, 22).tap();
        await cards(mobile).first().tap();
        await action(mobile, 'confirm').tap();
        assert.deepEqual(await sent(mobile), [{type: 'river', card_id: 'red-5'}]);
        await render(mobile, 'dual');
        await action(mobile, 'drawer').tap();
        await cards(mobile).last().tap();
        await mobile.locator('[data-mode="ability"]').tap();
        await action(mobile, 'confirm').tap();
        assert.deepEqual(await sent(mobile), [{type: 'ability', card_id: 'ability-B2', options: {}}]);
        for (const [width, height] of [[844, 390], [568, 320]]) {
            await mobile.setViewportSize({width, height});
            await render(mobile, 'dual');
            await space(mobile, 15).tap();
            await cards(mobile).first().tap();
            await bounds(mobile, `${width}×${height} landscape drawer`);
            await mobile.waitForFunction(() => {
                const space = document.querySelector('.eternal-decks-slot.is-selected').getBoundingClientRect();
                const dock = document.querySelector('.eternal-decks-dock').getBoundingClientRect();
                return space.bottom < dock.top && dock.top >= 0 && dock.bottom <= innerHeight;
            });
        }
        await mobile.setViewportSize({width: 393, height: 852});
        console.log('PASS destination-first play, illegal cards, rotation, discs/return/out-of-turn, give, jewels, river and ability');

        await render(mobile);
        await mobile.locator('[data-ed-action="eternal"][data-eternal="C1"]').tap();
        const tip = mobile.locator('#eternalDecksDialog .eternal-decks-toast');
        const deck = mobile.locator('#eternalDecksDialogBody .eternal-decks-card');
        await deck.nth(0).tap();
        assert.match(await tip.textContent(), /双色牌.*翻转/);
        assert.match(await tip.getAttribute('class'), /is-visible/);
        await deck.nth(1).tap();
        assert.match(await tip.textContent(), /蓝色.*数字 3（普通牌）/);
        await deck.nth(6).tap();
        assert.match(await tip.textContent(), /Rare.*女巫/);
        await deck.nth(7).tap();
        assert.match(await tip.textContent(), /美杜莎.*能力牌.*河流奖励顶/);
        await bounds(mobile, 'mobile card tooltip in modal');
        await mobile.screenshot({path: `${output}/mobile-card-tip.png`});
        await mobile.waitForFunction(() => !document.querySelector('#eternalDecksDialog .eternal-decks-toast').classList.contains('is-visible'), null, {timeout: 4500});
        await mobile.keyboard.press('Escape');
        assert.equal(await mobile.locator('#eternalDecksDialog').isVisible(), false);

        await desktop.setViewportSize({width: 1280, height: 900});
        await render(desktop);
        await desktop.locator('[data-ed-action="eternal"][data-eternal="B2"]').click();
        await desktop.locator('#eternalDecksDialogBody .eternal-decks-card').last().hover();
        assert.match(await desktop.locator('#eternalDecksDialog .eternal-decks-toast').textContent(), /骷髅.*恢复一颗/);
        assert.match(await desktop.locator('#eternalDecksDialog .eternal-decks-toast').getAttribute('class'), /is-visible/);
        await desktop.screenshot({path: `${output}/desktop-card-tip.png`});
        await desktop.keyboard.press('Escape');
        await desktop.locator('#eternalDecksHelpBtn').click();
        assert.match(await desktop.locator('#eternalDecksDialogBody').textContent(), /Communication discs/);
        await desktop.keyboard.press('Escape');
        await space(desktop, 0).click();
        await desktop.locator('#eternalDecksExplainBtn').click();
        const disabled = desktop.locator('[data-mode="play"]');
        const box = await disabled.boundingBox();
        await desktop.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
        assert.equal(await desktop.locator('#eternalDecksDialog').isVisible(), true);
        assert.equal((await sent(desktop)).length, 0);
        await desktop.keyboard.press('Escape');
        await desktop.keyboard.press('Escape');
        await desktop.screenshot({path: `${output}/desktop-board.png`});
        console.log('PASS modal card descriptions, latest-tap tooltip replacement, 3-second dismissal, desktop hover, Help and disabled Explain');
        assert.deepEqual(errors, [], 'Browser JavaScript errors');
    } finally {
        await browser.close();
    }
})().catch(error => { console.error(error); process.exitCode = 1; });
