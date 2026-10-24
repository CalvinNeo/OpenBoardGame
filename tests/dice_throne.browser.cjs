const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { execFileSync } = require('node:child_process');
const base = process.env.ROOM_TEST_URL || 'http://127.0.0.1:8786';
const output = 'tmp/dice-throne-ui';
fs.mkdirSync(output, { recursive: true });
const fixtures = JSON.parse(execFileSync(process.env.PYTHON || 'python', ['-c', `
import copy, json
from game.dice_throne import DiceThroneGame as Game
from game.dice_throne_data import HEROES

players = [{"player_id": "p0", "name": "Alice", "seat": 0}, {"player_id": "p1", "name": "Morgan", "seat": 1}]
state = Game.init_game({"seed": 163}, players)
views = {"choose_hero": Game.get_public_view(state, "p0")}

def act(player_id, action_type, **fields):
    _, error = Game.apply_action(state, player_id, dict(fields, type=action_type, revision=state["revision"]))
    if error:
        raise RuntimeError(error)

act("p0", "choose_hero", hero="barbarian")
act("p1", "choose_hero", hero="moon_elf")
state["players"]["p0"]["hand"] = ["getting_paid", "double_up", "what_status", "get_outta_here", "six_it", "so_wild"]
state["players"]["p0"]["combat_points"] = 8
views["main_1"] = Game.get_public_view(state, "p0")
act("p0", "end_phase")
views["unrolled"] = Game.get_public_view(state, "p0")
act("p0", "roll")
state["dice"] = [{"value": value, "face": HEROES["barbarian"]["dice_faces"][value - 1]} for value in [1, 1, 1, 4, 6]]
views["rolled"] = Game.get_public_view(state, "p0")
views["opponent"] = Game.get_public_view(state, "p1")
views["spectator"] = Game.get_public_view(state, "visitor")
kept_state = copy.deepcopy(state)
kept_state["kept"] = [True] * 5
views["all_kept"] = Game.get_public_view(kept_state, "p0")
kept_state["kept"][2] = False
views["one_unkept"] = Game.get_public_view(kept_state, "p0")
act("p0", "confirm_roll")
views["targeting"] = Game.get_public_view(state, "p0")
act("p0", "use_ability", ability_id="smack", target="p1")
views["defense"] = Game.get_public_view(state, "p1")
views["defense_wait"] = Game.get_public_view(state, "p0")
act("p1", "defend")
views["defense_result"] = Game.get_public_view(state, "p0")
act("p0", "end_phase")
views["review"] = Game.get_public_view(state, "p0")
state["phase"] = "game_over"
state["game_over"] = True
state["winner"] = ["p0"]
state["players"]["p1"]["health"] = 0
views["game_over"] = Game.get_public_view(state, "p0")
for hero_id, hero in HEROES.items():
    state = Game.init_game({"seed": 163}, players)
    act("p0", "choose_hero", hero=hero_id)
    act("p1", "choose_hero", hero="moon_elf" if hero_id == "barbarian" else "barbarian")
    act("p0", "end_phase")
    act("p0", "roll")
    state["dice"] = [{"value": value, "face": hero["dice_faces"][value - 1]} for value in [1, 2, 3, 5, 6]]
    state["kept"][0] = True
    views["hero_" + hero_id] = Game.get_public_view(state, "p0")
    if hero_id == "cursed_pirate":
        state["phase"] = "main_1"
        state["players"]["p0"]["hand"] = ["get_outta_here"]
        state["players"]["p0"]["statuses"]["wither"] = 2
        views["pirate_clean"] = Game.get_public_view(state, "p0")
print(json.dumps(views))
`], { encoding: 'utf8', maxBuffer: 8 * 1024 * 1024 }));
fixtures.long_names = structuredClone(fixtures.rolled);
fixtures.long_names.players[0].name = 'VeryLongUnbrokenPlayerNameThatMustNotOverlapAnyAdjacentControls';
fixtures.long_names.players[1].name = '名字很长的玩家用于验证手机端排版';
fixtures.long_names.players[0].statuses = Object.keys(fixtures.long_names.status_catalog).slice(0, 6).map(id => ({ id, stacks: 3 }));
fixtures.long_names.players[0].upgrades = ['one', 'two', 'three'];
fixtures.long_names.current_player = 'p1';
fixtures.long_names.legal_actions = [];
fixtures.long_log = structuredClone(fixtures.review);
fixtures.long_log.log = Array.from({ length: 50 }, (_, index) => ({ player_id: 'p0', text: `Public action ${index + 1} · rolled Dice (🎲).` }));
fixtures.upgraded = structuredClone(fixtures.rolled);
fixtures.upgraded.players.forEach(player => {
    player.upgrades = [`${fixtures.upgraded.hero_catalog[player.hero].abilities[0].id}_3`];
});
for (const [hero, statuses] of Object.entries({ gunslinger: ['reload', 'bounty'], samurai: ['honor', 'shame', 'back_strike'], vampire_lord: ['blood_power', 'bleed', 'mesmerize'], seraph: ['flight', 'holy_presence', 'blinding_light'], artificer: ['synth', 'shock_bot', 'heal_bot', 'nanobot'], huntress: ['nyras_bond', 'bleed'], tactician: ['tactical_advantage', 'constrict'], cursed_pirate: ['cursed', 'wither', 'powder_keg'] })) {
    fixtures[`statuses_${hero}`] = structuredClone(fixtures[`hero_${hero}`]);
    fixtures[`statuses_${hero}`].players.find(player => player.player_id === 'p0').statuses = statuses.map(id => ({ id, stacks: fixtures.rolled.status_catalog[id].limit }));
}
fixtures.huntress_inactive = structuredClone(fixtures.statuses_huntress);
fixtures.huntress_inactive.players.find(player => player.player_id === 'p0').companion.health = 0;
fixtures.constrict_no_cp = structuredClone(fixtures.statuses_tactician);
fixtures.constrict_no_cp.players.find(player => player.player_id === 'p0').combat_points = 0;
fixtures.constrict_no_cp.legal_actions = fixtures.constrict_no_cp.legal_actions.filter(action => action !== 'roll');

async function render(page, key) {
    await page.evaluate(view => {
        showDiceThroneHeaderActions(false);
        lastGameStatePayload = null;
        playerId = view.you;
        roomSessionReady = true;
        renderRoomState({ room_id: 'dice-throne-layout', game_type: 'dice_throne', status: 'in_game', host_id: 'p0', players: view.players, game_config: {} });
        setGamePanelVisibility('dice_throne');
        renderGameState({ room_id: 'dice-throne-layout', game_type: 'dice_throne', view });
        setRoomControlsCollapsed(true);
        window.diceThroneTestActions = [];
        window.scrollTo(0, 0);
    }, fixtures[key]);
    await page.locator('#diceThronePanel').waitFor({ state: 'visible' });
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
}

async function bounds(page, label) {
    const issues = await page.evaluate(() => {
        const bad = [...document.querySelectorAll('.dt-game-panel > .panel-header *, #diceThronePanel *, #diceThroneDialog[open] *')].filter(node => {
            const box = node.getBoundingClientRect();
            const style = getComputedStyle(node);
            if (!box.width || !box.height || style.display === 'none') return false;
            return box.left < -1 || box.right > innerWidth + 1 ||
                (node.clientWidth && node.scrollWidth > node.clientWidth + 1 && !['auto', 'hidden', 'scroll', 'clip'].includes(style.overflowX));
        }).map(node => `${node.id || node.className}: ${node.textContent.slice(0, 55)}`);
        const regions = ['.dt-turnbar', '#diceThroneStatus', '#diceThronePlayers', '.dt-battle-grid', '#diceThroneLogPanel'];
        const boxes = regions.map(selector => document.querySelector(selector).getBoundingClientRect()).filter(box => box.height);
        for (let index = 1; index < boxes.length; index++) {
            if (boxes[index].top < boxes[index - 1].bottom - 1) bad.push('Main regions overlap.');
        }
        return { pageOverflow: document.documentElement.scrollWidth > innerWidth, bad };
    });
    assert.deepEqual(issues, { pageOverflow: false, bad: [] }, label);
}

async function geometry(page) {
    return page.evaluate(() => {
        const panel = document.querySelector('.game-panel').getBoundingClientRect();
        const players = document.getElementById('diceThronePlayers').getBoundingClientRect();
        const header = document.querySelector('.dt-game-panel > .panel-header').getBoundingClientRect();
        const tray = document.getElementById('diceThroneRollZone').getBoundingClientRect();
        const decisions = document.getElementById('diceThroneDecisions').getBoundingClientRect();
        return {
            panelHeight: Math.round(panel.height), headerHeight: Math.round(header.height), playersHeight: Math.round(players.height),
            trayHeight: Math.round(tray.height), decisionsTop: Math.round(decisions.top - panel.top),
            decisionsHeight: Math.round(decisions.height), panelBottom: Math.round(panel.bottom),
            viewportHeight: innerHeight, sideBySide: Math.abs(tray.top - decisions.top) < 1,
        };
    });
}

async function actions(page, expected) {
    assert.deepEqual(await page.evaluate(() => diceThroneTestActions), expected);
}

async function rerollFeedback(page) {
    await render(page, 'all_kept');
    assert.equal(await page.locator('#diceThroneRollBtn').isDisabled(), true);
    assert.match(await page.locator('#diceThroneRollBtn').innerText(), /All kept/);
    assert.equal(await page.locator('#diceThroneConfirmBtn').isEnabled(), true);
    await page.locator('#diceThroneRollBtn').evaluate(node => node.click());
    await actions(page, []);
    await page.locator('.dt-die').nth(2).tap();
    await actions(page, [{ type: 'toggle_keep', index: 2, revision: fixtures.all_kept.revision }]);

    await render(page, 'one_unkept');
    assert.match(await page.locator('#diceThroneRollBtn').innerText(), /Roll again · 1/);
    await page.locator('#diceThroneRollBtn').tap();
    await actions(page, [{ type: 'roll', revision: fixtures.one_unkept.revision }]);
    assert.equal(await page.locator('.dt-die.dt-rolling').count(), 1);
    assert.equal(await page.locator('.dt-die.kept.dt-rolling').count(), 0);
    assert.equal(await page.locator('#diceThroneDice').getAttribute('aria-busy'), 'true');
    assert.equal(await page.locator('#diceThroneRollBtn').isDisabled(), true);
    await page.locator('#diceThroneRollBtn').evaluate(node => node.click());
    await actions(page, [{ type: 'roll', revision: fixtures.one_unkept.revision }]);
    const repeated = structuredClone(fixtures.one_unkept);
    repeated.revision += 1;
    repeated.roll_count += 1;
    const result = await page.evaluate(view => {
        renderDiceThroneGameState({ view });
        return {
            animated: [...document.querySelectorAll('.dt-rerolled')].map(node => Number(node.dataset.index)),
            values: [...document.querySelectorAll('.dt-die .dt-die-value')].map(node => Number(node.textContent)),
            message: document.getElementById('diceThroneStatus').textContent,
        };
    }, repeated);
    assert.deepEqual(result.animated, [2], 'Even identical results animate only the rerolled die.');
    assert.deepEqual(result.values, repeated.dice.map(die => die.value));
    assert.match(result.message, /You rolled 1 die · 4 kept/);
    assert.equal(await page.locator('#diceThroneRollCount').innerText(), '2 / 3 rolls');
    assert.equal(await page.locator('#diceThroneDice').getAttribute('aria-busy'), 'false');
    assert.equal(await page.locator('.dt-rolling').count(), 0);
    await bounds(page, 'Identical reroll feedback');
    await page.waitForFunction(() => !document.querySelector('.dt-rerolled'));
    await page.evaluate(view => renderDiceThroneGameState({ view }), repeated);
    assert.equal(await page.locator('.dt-rerolled').count(), 0, 'Duplicate updates do not replay a roll.');

    await page.emulateMedia({ reducedMotion: 'reduce' });
    await render(page, 'unrolled');
    await page.locator('#diceThroneRollBtn').tap();
    assert.equal(await page.locator('.dt-rolling').count(), 5);
    assert.equal(await page.locator('.dt-rolling .dt-die-symbol').first().evaluate(node => getComputedStyle(node).animationName), 'none');
    await page.evaluate(() => socket.emitReserved('system:error', { message: 'Test rejection' }));
    assert.equal(await page.locator('.dt-rolling').count(), 0);
    assert.equal(await page.locator('#diceThroneRollBtn').isEnabled(), true);
    const reducedResult = await page.evaluate(view => {
        renderDiceThroneGameState({ view });
        return {
            animation: getComputedStyle(document.querySelector('.dt-rerolled')).animationName,
            message: document.getElementById('diceThroneStatus').textContent,
        };
    }, fixtures.rolled);
    assert.equal(reducedResult.animation, 'none');
    assert.match(reducedResult.message, /You rolled 5 dice · 0 kept/);
    await page.emulateMedia({ reducedMotion: 'no-preference' });

    for (const role of ['opponent', 'spectator']) {
        await render(page, role);
        const next = structuredClone(fixtures[role]);
        next.revision += 1;
        next.roll_count += 1;
        const animated = await page.evaluate(view => {
            renderDiceThroneGameState({ view });
            return document.querySelectorAll('.dt-rerolled').length;
        }, next);
        assert.equal(animated, 5, `${role} sees the reroll too.`);
        assert.equal(await page.locator('#diceThroneRollBtn').isDisabled(), true);
        await actions(page, []);
    }
}

async function touchScroll(page, selector) {
    const box = await page.locator(selector).boundingBox();
    const session = await page.context().newCDPSession(page);
    const point = { x: box.x + box.width * .65, y: box.y + box.height * .65 };
    await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [point] });
    for (let step = 1; step <= 6; step++) {
        await session.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: point.x, y: point.y - step * 12 }] });
        await page.waitForTimeout(30);
    }
    await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await page.waitForTimeout(200);
    await session.detach();
}

async function heroReferences(page, width) {
    await render(page, 'choose_hero');
    for (const [heroId, hero] of Object.entries(fixtures.choose_hero.hero_catalog)) {
        const trigger = page.locator(`#diceThroneHeroChoices .dt-hero-name-button[data-hero="${heroId}"]`);
        await trigger.click();
        await page.locator('#diceThroneDialog[open]').waitFor();
        assert.equal(await page.locator('.dt-reference-face').count(), 6);
        assert.deepEqual(await page.locator('.dt-reference-value').allTextContents(), ['1', '2', '3', '4', '5', '6']);
        assert.deepEqual(await page.locator('.dt-reference-symbol').allTextContents(), hero.dice_faces.map(face => hero.symbol_icons[face]));
        assert.equal(await page.locator('.dt-reference-ability').count(), hero.abilities.length);
        assert.match(await page.locator('.dt-reference-defense').innerText(), new RegExp(hero.defense.name));
        if (hero.passive) assert((await page.locator('.dt-reference-passive').innerText()).includes(hero.passive.split('（')[0]));
        for (const ability of hero.abilities) {
            const entry = page.locator(`[data-dt-ability="${ability.id}"]`);
            assert.equal(await entry.locator('h4').innerText(), ability.name);
            assert.equal(await entry.locator('.dt-reference-effect').innerText(), ability.description.replace(/\bCP\b/g, 'Combat Points (⚡)'));
            const pattern = await entry.locator('.dt-requirement').innerText();
            if (ability.condition.straight) assert(pattern.includes(`${ability.condition.straight}-straight`));
            for (const [symbol, count] of Object.entries(ability.condition.counts || {})) {
                assert(pattern.includes(`${hero.symbol_icons[symbol]} ×${count}`));
            }
        }
        await bounds(page, `${width}px / ${heroId} reference`);
        const layout = await page.locator('#diceThroneDialog').evaluate(dialog => {
            const box = dialog.getBoundingClientRect();
            const header = dialog.querySelector('.dt-dialog-head').getBoundingClientRect();
            const body = dialog.querySelector('#diceThroneDialogBody');
            const faces = [...dialog.querySelectorAll('.dt-reference-face')].map(node => node.getBoundingClientRect().top);
            const columns = getComputedStyle(dialog.querySelector('.dt-reference-abilities')).gridTemplateColumns.split(' ').length;
            const entries = [...dialog.querySelectorAll('.dt-reference-ability')].map(node => node.getBoundingClientRect());
            const overlap = entries.some((entry, index) => entries.slice(index + 1).some(other =>
                Math.min(entry.right, other.right) - Math.max(entry.left, other.left) > 1 &&
                Math.min(entry.bottom, other.bottom) - Math.max(entry.top, other.top) > 1));
            return { inside: box.top >= 0 && box.bottom <= innerHeight, headerAboveBody: header.bottom <= body.getBoundingClientRect().top,
                singleDiceRow: faces.every(top => Math.abs(top - faces[0]) < 1), columns, overlap, height: box.height };
        });
        assert(layout.inside && layout.headerAboveBody && layout.singleDiceRow && !layout.overlap, JSON.stringify(layout));
        assert.equal(layout.columns, width <= 560 ? 1 : 2);
        if (width >= 1024) assert(layout.height < 650, 'Desktop reference must remain compact.');
        if (['barbarian', 'treant', 'vampire_lord', 'seraph', 'artificer', 'huntress', 'tactician', 'cursed_pirate'].includes(heroId)) {
            await page.screenshot({ path: `${output}/${width}-hero-${heroId}.png`, fullPage: true });
        }
        await page.keyboard.press('Escape');
        await page.waitForFunction(() => document.activeElement?.classList.contains('dt-hero-name-button'));
        await actions(page, []);
    }
    await render(page, 'upgraded');
    for (const player of fixtures.upgraded.players) {
        await page.locator(`#diceThronePlayers .dt-hero-name-button[data-hero="${player.hero}"]`).click();
        const abilityId = fixtures.upgraded.hero_catalog[player.hero].abilities[0].id;
        const entry = page.locator(`[data-dt-ability="${abilityId}"]`);
        assert.equal(await entry.locator('.dt-reference-heading .dt-token').innerText(), '⬆️ 3');
        assert.match(await entry.locator('.dt-reference-upgrade').innerText(), /\+2/);
        await bounds(page, `${width}px / upgraded ${player.hero}`);
        await page.locator('#diceThroneDialogClose').click();
    }
    await render(page, 'spectator');
    await page.locator('#diceThronePlayers .dt-hero-name-button').last().click();
    assert.equal(await page.locator('.dt-reference-ability').count(), 8);
    await page.keyboard.press('Escape');
}

async function interactions(page) {
    await page.setViewportSize({ width: 320, height: 640 });
    await render(page, 'choose_hero');
    await page.locator('.dt-hero-trigger').first().tap();
    await bounds(page, 'Hero confirmation');
    await page.getByRole('button', { name: 'Choose hero', exact: true }).tap();
    await actions(page, [{ type: 'choose_hero', hero: 'barbarian', revision: fixtures.choose_hero.revision }]);

    await render(page, 'unrolled');
    await page.locator('#diceThroneExplainBtn').tap();
    assert.equal(await page.locator('#diceThroneExplainBtn').getAttribute('aria-pressed'), 'true');
    const disabledButton = await page.locator('#diceThroneConfirmBtn').boundingBox();
    await page.touchscreen.tap(disabledButton.x + disabledButton.width / 2, disabledButton.y + disabledButton.height / 2);
    await page.locator('#diceThroneDialog[open]').waitFor();
    assert.match(await page.locator('#diceThroneDialogTitle').innerText(), /Confirm roll/);
    assert.equal(await page.locator('#diceThroneExplainBtn').getAttribute('aria-pressed'), 'false');
    await actions(page, []);
    await bounds(page, 'Disabled-control explanation');
    await page.keyboard.press('Escape');
    assert.equal(await page.locator('#diceThroneDialog').getAttribute('open'), null);
    await page.locator('#diceThroneExplainBtn').tap();
    await page.keyboard.press('Escape');
    assert.equal(await page.locator('#diceThroneExplainBtn').getAttribute('aria-pressed'), 'false');
    await page.locator('#diceThroneHelpBtn').tap();
    await bounds(page, 'Help dialog');
    assert.match(await page.locator('#diceThroneDialogBody').innerText(), /Health.*❤️/);
    await page.keyboard.press('Escape');

    await render(page, 'main_1');
    await page.locator('#diceThroneEndBtn').tap();
    await actions(page, [{ type: 'end_phase', revision: fixtures.main_1.revision }]);
    for (const [selector, type] of [['#diceThroneRollBtn', 'roll'], ['#diceThroneConfirmBtn', 'confirm_roll']]) {
        await render(page, 'rolled');
        await page.locator(selector).tap();
        await actions(page, [{ type, revision: fixtures.rolled.revision }]);
    }
    await render(page, 'rolled');
    await page.locator('.dt-die').first().tap();
    await actions(page, [{ type: 'toggle_keep', index: 0, revision: fixtures.rolled.revision }]);

    await render(page, 'targeting');
    await page.locator('.dt-ability.available .dt-ability-trigger').first().tap();
    await bounds(page, 'Ability confirmation');
    await actions(page, []);
    await page.getByRole('button', { name: 'Use ability', exact: true }).tap();
    await actions(page, [{ type: 'use_ability', target: 'p1', ability_id: 'smack', revision: fixtures.targeting.revision }]);

    await render(page, 'main_1');
    await page.locator('.dt-card-trigger').first().tap();
    await bounds(page, 'Inline card confirmation');
    await actions(page, []);
    await page.locator('.dt-turnbar').click({ position: { x: 2, y: 2 } });
    assert.equal(await page.locator('.dt-card.selected').count(), 0, 'Blank space cancels selection.');
    await page.locator('.dt-card-trigger').first().tap();
    await page.getByRole('button', { name: /^Play ·/ }).tap();
    await actions(page, [{ type: 'play_card', card_id: 'getting_paid', target: 'p0', revision: fixtures.main_1.revision }]);

    await render(page, 'rolled');
    const position = await page.evaluate(() => scrollY);
    await page.locator('#diceThroneAbilitiesTab').focus();
    await page.keyboard.press('ArrowRight');
    assert.equal(await page.locator('#diceThroneHandTab').getAttribute('aria-selected'), 'true');
    assert.equal(await page.evaluate(() => scrollY), position, 'Tab navigation preserves page position.');
    await touchScroll(page, '#diceThroneHand');
    assert.equal(await page.locator('.dt-card.selected').count(), 0, 'Scrolling does not select a card.');
    await actions(page, []);
    const listPosition = await page.locator('#diceThroneHand').evaluate(node => node.scrollTop);
    assert(listPosition > 0, 'The hand scrolls inside its panel.');
    await page.locator('#diceThroneAbilitiesTab').tap();
    await page.locator('#diceThroneHandTab').tap();
    assert(Math.abs(await page.locator('#diceThroneHand').evaluate(node => node.scrollTop) - listPosition) < 1, 'Tabs preserve list position.');
    await page.locator('.dt-card-trigger').last().tap();
    assert.equal(await page.locator('.dt-detail-confirm').count(), 1);
    await bounds(page, 'Expanded card confirmation');
    await page.getByLabel('Die', { exact: true }).selectOption('0');
    await page.getByLabel('New value', { exact: true }).selectOption('6');
    await page.getByRole('button', { name: /^Play ·/ }).tap();
    await actions(page, [{ type: 'play_card', card_id: 'so_wild', target: 'p0', index: 0, value: 6, revision: fixtures.rolled.revision }]);

    await render(page, 'rolled');
    await page.locator('.dt-player .dt-tone-cp').first().tap();
    assert.match(await page.locator('#diceThroneTooltip').innerText(), /Combat Points/);
    await page.locator('.dt-health-value').first().tap();
    assert.match(await page.locator('#diceThroneTooltip').innerText(), /Health/);
    await page.locator('#diceThroneTooltip').waitFor({ state: 'hidden', timeout: 4000 });
    await page.locator('.dt-player .dt-hero-name-button').first().tap();
    assert.equal(await page.locator('.dt-reference-face').count(), 6);
    assert.equal(await page.locator('.dt-reference-ability').count(), 8);
    assert.equal(await page.locator('#diceThroneTooltip').isVisible(), false);
    await bounds(page, 'Hero dice reference');
    await page.locator('.dt-reference-face').first().tap();
    assert.match(await page.locator('#diceThroneTooltip').innerText(), /Face 1/);
    assert.equal(await page.locator('#diceThroneTooltip').evaluate(node => node.parentElement.id), 'diceThroneDialog');
    await page.locator('.dt-reference-face').last().tap();
    assert.match(await page.locator('#diceThroneTooltip').innerText(), /Face 6/);
    await page.locator('#diceThroneTooltip').waitFor({ state: 'hidden', timeout: 4000 });
    const headerTop = await page.locator('.dt-dialog-head').evaluate(node => node.getBoundingClientRect().top);
    await touchScroll(page, '#diceThroneDialogBody');
    assert(await page.locator('#diceThroneDialogBody').evaluate(node => node.scrollTop) > 0);
    assert.equal(await page.locator('#diceThroneTooltip').isVisible(), false, 'Scrolling must not open a tooltip.');
    assert.equal(await page.locator('.dt-dialog-head').evaluate(node => node.getBoundingClientRect().top), headerTop);
    await page.keyboard.press('Escape');
    await page.waitForFunction(() => document.getElementById('diceThroneTooltip').parentElement.id === 'diceThronePanel');
    await page.locator('.dt-player .dt-hero-name-button').last().tap();
    assert.equal(await page.locator('#diceThroneDialogBody').evaluate(node => node.scrollTop), 0);
    await page.locator('#diceThroneDialogClose').tap();
    await page.locator('#diceThroneHelpBtn').tap();
    assert.equal(await page.locator('#diceThroneDialog.dt-hero-dialog').count(), 0, 'Hero layout must not leak into Help.');
    await page.keyboard.press('Escape');

    await render(page, 'long_log');
    await page.locator('#diceThroneLogPanel summary').tap();
    assert.equal(await page.locator('#diceThroneLog li').count(), 40);
    assert(await page.locator('#diceThroneLog').evaluate(node => node.clientHeight <= 150 && node.scrollHeight > node.clientHeight));
    await bounds(page, 'Expanded battle log');
    await page.locator('#diceThroneLogPanel summary').tap();
    await page.locator('#diceThroneNextBtn').tap();
    await actions(page, [{ type: 'next_round', revision: fixtures.long_log.revision }]);
    assert.equal(await page.locator('#diceThroneDialog').getAttribute('open'), null, 'Next Round needs no extra confirmation.');

    await page.evaluate(async () => { await ensureGameAssets('cabo'); setGamePanelVisibility('cabo'); });
    assert.equal(await page.locator('.game-panel-title h2').innerText(), 'Game');
    assert.equal(await page.locator('.dt-game-panel').count(), 0);
    assert.equal(await page.locator('#diceThronePanel').isVisible(), false);
    await page.evaluate(() => { showDiceThroneHeaderActions(false); setGamePanelVisibility('dice_throne'); });
    assert.equal(await page.locator('.game-panel-title h2').innerText(), 'Dice Throne');
    assert.equal(await page.locator('script[src*="/dice_throne.js"]').count(), 1);
}

async function seasonTwoPicker(page, width) {
    const seasonTwo = ['gunslinger', 'samurai', 'vampire_lord', 'seraph', 'artificer', 'huntress', 'tactician', 'cursed_pirate'];
    await render(page, 'choose_hero');
    assert.equal(await page.locator('.dt-hero-card').count(), 16);
    await page.locator('[data-dt-season="2"]').click();
    assert.equal(await page.locator('[data-dt-season="2"]').getAttribute('aria-pressed'), 'true');
    assert.equal(await page.locator('[data-dt-season="all"]').getAttribute('aria-pressed'), 'false');
    assert.equal(await page.locator('#diceThroneHeroCount').innerText(), '8 / 16 heroes');
    assert.deepEqual(await page.locator('.dt-hero-card').evaluateAll(nodes => nodes.map(node => node.dataset.hero)), seasonTwo);
    await bounds(page, `${width}px / Season Two picker`);
    await page.mouse.move(0, 0);
    await page.locator('.dt-hero-filters').evaluate(node => Promise.all(node.getAnimations({ subtree: true }).map(animation => animation.finished)));
    await page.screenshot({ path: `${output}/${width}-season-two.png`, fullPage: true });
    await page.locator('.dt-hero-card[data-hero="cursed_pirate"]').scrollIntoViewIfNeeded();
    await page.screenshot({ path: `${output}/${width}-season-two-new.png`, fullPage: true });
    for (const hero of seasonTwo) {
        await page.locator(`.dt-hero-card[data-hero="${hero}"] .dt-hero-trigger`).click();
        assert.equal(await page.locator('.dt-hero-card.selected').count(), 1);
        await bounds(page, `${width}px / ${hero} confirmation`);
        await page.getByRole('button', { name: 'Cancel', exact: true }).click();
        await actions(page, []);
    }
    await page.locator('[data-dt-season="1"]').click();
    assert.equal(await page.locator('.dt-hero-card').count(), 8);
    await page.locator('[data-dt-season="all"]').click();
    assert.equal(await page.locator('.dt-hero-card').count(), 16);
    if (width <= 390) {
        await touchScroll(page, '#diceThroneHeroChoices');
        assert.equal(await page.locator('.dt-hero-card.selected').count(), 0, 'Scrolling the hero list does not choose a hero.');
        assert((await page.locator('#diceThroneHeroChoices').evaluate(node => node.scrollTop)) > 0);
        await page.locator('.dt-hero-card[data-hero="cursed_pirate"] .dt-hero-trigger').scrollIntoViewIfNeeded();
        const before = await page.locator('#diceThroneHeroChoices').evaluate(node => node.scrollTop);
        await page.locator('.dt-hero-card[data-hero="cursed_pirate"] .dt-hero-trigger').tap();
        assert(Math.abs(await page.locator('#diceThroneHeroChoices').evaluate(node => node.scrollTop) - before) <= 1, 'Hero confirmation preserves list position.');
        await page.getByRole('button', { name: 'Cancel', exact: true }).tap();
        assert(Math.abs(await page.locator('#diceThroneHeroChoices').evaluate(node => node.scrollTop) - before) <= 1, 'Cancel preserves list position.');
    }
    await page.locator('[data-dt-season="2"]').click();
    await page.locator('.dt-hero-card[data-hero="gunslinger"] .dt-hero-trigger').click();
    await page.getByRole('button', { name: 'Choose hero', exact: true }).click();
    await actions(page, [{ type: 'choose_hero', hero: 'gunslinger', revision: fixtures.choose_hero.revision }]);
    await render(page, 'choose_hero');
    const taken = structuredClone(fixtures.choose_hero);
    taken.players.find(player => player.player_id !== taken.you).hero = 'gunslinger';
    taken.revision += 1;
    await page.evaluate(view => renderDiceThroneGameState({ view }), taken);
    await page.locator('[data-dt-season="2"]').click();
    assert.equal(await page.locator('.dt-hero-card[data-hero="gunslinger"] .dt-hero-trigger').isDisabled(), true);
    await actions(page, []);
    for (const hero of seasonTwo) {
        await render(page, `hero_${hero}`);
        await bounds(page, `${width}px / ${hero} combat`);
        await render(page, `statuses_${hero}`);
        for (const token of await page.locator('.dt-you .dt-statuses .dt-token').all()) {
            await token.tap();
            assert.equal(await page.locator('#diceThroneTooltip').isVisible(), true);
            assert((await page.locator('#diceThroneTooltip').innerText()).includes(await token.getAttribute('data-dt-explain')));
            await bounds(page, `${width}px / ${hero} status tooltip`);
        }
        await page.locator('.dt-you .dt-hero-name-button').click();
        await page.keyboard.press('Escape');
        await page.mouse.move(0, 0);
        await page.screenshot({ path: `${output}/${width}-combat-${hero}.png`, fullPage: true });
    }
}

async function newHeroInteractions(page) {
    await render(page, 'hero_huntress');
    assert.match(await page.locator('.dt-companion').innerText(), /Nyra 6\/6/);
    await page.locator('.dt-companion').tap();
    assert.match(await page.locator('#diceThroneTooltip').innerText(), /奈拉/);
    await render(page, 'huntress_inactive');
    assert.match(await page.locator('.dt-companion-inactive').innerText(), /Nyra 0\/6/);
    await render(page, 'statuses_tactician');
    assert.match(await page.locator('#diceThroneRollBtn').innerText(), /1⚡/);
    await render(page, 'constrict_no_cp');
    assert.equal(await page.locator('#diceThroneRollBtn').isDisabled(), true);
    assert.match(await page.locator('#diceThroneRollBtn').innerText(), /Need 1 CP/);
    assert.equal(await page.locator('#diceThroneConfirmBtn').isEnabled(), true);
    await render(page, 'pirate_clean');
    await page.locator('.dt-card').filter({ hasText: 'Get That Outta Here' }).locator('.dt-card-trigger').tap();
    await page.getByLabel('Target', { exact: true }).selectOption('p0');
    const choices = await page.getByLabel('Status', { exact: true }).locator('option').evaluateAll(nodes => nodes.map(node => node.value));
    assert(choices.includes('wither'));
    assert(!choices.includes('cursed_doubloon'));
    await actions(page, []);
    await page.getByLabel('Status', { exact: true }).selectOption('wither');
    await page.getByRole('button', { name: 'Play · 1 ⚡', exact: true }).tap();
    await actions(page, [{ type: 'play_card', card_id: 'get_outta_here', target: 'p0', status: 'wither', revision: fixtures.pirate_clean.revision }]);
    console.log('Companion health, defeated Nyra, Constrict cost and protected Pirate token inputs passed.');
}

async function desktop(browser) {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await context.newPage();
    await page.route('https://fonts.googleapis.com/**', route => route.abort());
    try {
        await page.goto(base);
        await page.waitForFunction(() => typeof socket !== 'undefined' && socket.connected && cachedGameList);
        await page.evaluate(() => ensureGameAssets('dice_throne'));
        await page.evaluate(() => { window.sendAction = action => window.diceThroneTestActions.push(action); });
        for (const width of [1024, 1440]) {
            await page.setViewportSize({ width, height: 900 });
            await render(page, 'rolled');
            await page.evaluate(() => setRoomControlsCollapsed(false));
            await bounds(page, `${width}px / desktop with Room Controls`);
            assert((await geometry(page)).sideBySide, 'Desktop with Room Controls keeps dice alongside decisions.');
            await page.locator('.dt-player .dt-tone-cp').first().hover();
            assert.match(await page.locator('#diceThroneTooltip').innerText(), /Combat Points/);
            await page.locator('#diceThroneRollBtn').hover();
            assert.equal(await page.locator('#diceThroneTooltip').isVisible(), false);
            await page.locator('#diceThroneHelpBtn').click();
            await bounds(page, `${width}px / desktop Help`);
            await page.keyboard.press('Escape');
            await page.evaluate(() => setRoomControlsCollapsed(true));
            await page.screenshot({ path: `${output}/${width}-desktop.png`, fullPage: true });
            await page.locator('.dt-player .dt-hero-name-button').first().click();
            await page.locator('.dt-reference-face').first().hover();
            assert.match(await page.locator('#diceThroneTooltip').innerText(), /Face 1/);
            await bounds(page, `${width}px / hero tooltip`);
            await page.locator('.dt-reference-ability .dt-token').first().hover();
            assert.match(await page.locator('#diceThroneTooltip').innerText(), /Sword/);
            await page.locator('#diceThroneDialogClose').click();
        }
    } finally {
        await context.close();
    }
}

async function liveRerolls(browser) {
    const contexts = [];
    const pages = [];
    const errors = [];
    try {
        for (let index = 0; index < 2; index++) {
            const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
            contexts.push(context);
            const page = await context.newPage();
            pages.push(page);
            page.on('pageerror', error => errors.push(error.message));
            await page.route('https://fonts.googleapis.com/**', route => route.abort());
            await page.goto(base);
            await page.waitForFunction(() => typeof socket !== 'undefined' && socket.connected && cachedGameList);
            await page.evaluate(() => {
                window.diceThroneLiveErrors = [];
                window.diceThroneLiveRolls = [];
                socket.on('system:error', error => window.diceThroneLiveErrors.push(error));
                socket.on('game:state', data => {
                    if (!data.view?.roll_count) return;
                    window.diceThroneLiveRolls.push({
                        rollCount: data.view.roll_count,
                        message: document.getElementById('diceThroneStatus').textContent,
                        animated: [...document.querySelectorAll('.dt-rerolled')].map(node => Number(node.dataset.index)),
                        dice: data.view.dice,
                    });
                });
            });
        }
        const [host, guest] = pages;
        await host.evaluate(() => socket.emit('room:create', { name: 'Reroll Alice', game_type: 'dice_throne', config: { seed: 163 } }));
        await host.waitForFunction(() => roomSessionReady && isGameAssetsLoaded('dice_throne'));
        const room = await host.evaluate(() => roomId);
        await guest.evaluate(room_id => socket.emit('room:join', { room_id, name: 'Reroll Bob' }), room);
        await guest.waitForFunction(() => roomSessionReady && isGameAssetsLoaded('dice_throne'));
        for (const page of pages) await page.evaluate(() => socket.emit('room:ready', { room_id: roomId, ready: true }));
        await host.waitForFunction(() => !document.getElementById('startBtn').disabled);
        await host.evaluate(() => socket.emit('room:start', { room_id: roomId }));
        for (const [index, page] of pages.entries()) {
            await page.waitForFunction(() => lastGameStatePayload?.view?.phase === 'choose_hero');
            await page.evaluate(() => setRoomControlsCollapsed(true));
            await page.locator('[data-dt-season="2"]').tap();
            const hero = index ? 'huntress' : 'artificer';
            await page.locator(`.dt-hero-card[data-hero="${hero}"] .dt-hero-trigger`).tap();
            await page.getByRole('button', { name: 'Choose hero', exact: true }).tap();
            await page.waitForFunction(hero => lastGameStatePayload.view.players.some(player => player.hero === hero), hero);
        }
        for (const page of pages) {
            await page.waitForFunction(() => lastGameStatePayload?.view?.phase === 'main_1');
            await page.evaluate(() => setRoomControlsCollapsed(true));
            assert.match(await page.locator('.dt-companion').innerText(), /Nyra 6\/6/);
        }
        const active = await host.evaluate(() => lastGameStatePayload.view.current_player === playerId) ? host : guest;
        await active.locator('#diceThroneEndBtn').tap();
        await active.waitForFunction(() => lastGameStatePayload.view.phase === 'offensive_roll');
        await active.locator('#diceThroneRollBtn').tap();
        for (const page of pages) await page.waitForFunction(() => lastGameStatePayload.view.roll_count === 1);
        const firstDice = await active.evaluate(() => lastGameStatePayload.view.dice);
        for (let index = 0; index < 5; index++) {
            await active.locator('.dt-die').nth(index).tap();
            await active.waitForFunction(index => lastGameStatePayload.view.dice[index].kept, index);
        }
        assert.equal(await active.locator('#diceThroneRollBtn').isDisabled(), true);
        assert.equal(await active.evaluate(() => lastGameStatePayload.view.roll_count), 1);
        assert.equal(await active.evaluate(() => lastGameStatePayload.view.legal_actions.includes('roll')), false);
        await active.locator('.dt-die').nth(2).tap();
        await active.waitForFunction(() => !lastGameStatePayload.view.dice[2].kept);
        assert.match(await active.locator('#diceThroneRollBtn').innerText(), /Roll again · 1/);
        await active.locator('#diceThroneRollBtn').tap();
        for (const page of pages) {
            await page.waitForFunction(() => lastGameStatePayload.view.roll_count === 2);
            const roll = await page.evaluate(() => window.diceThroneLiveRolls.find(item => item.rollCount === 2));
            assert.deepEqual(roll.animated, [2], 'Live updates animate the one rerolled die for both players.');
            assert.match(roll.message, /rolled 1 die · 4 kept/);
            for (const index of [0, 1, 3, 4]) assert.equal(roll.dice[index].value, firstDice[index].value);
            assert.deepEqual(await page.evaluate(() => window.diceThroneLiveErrors), []);
            await bounds(page, 'Live reroll');
        }
        assert.deepEqual(errors, []);
        console.log('Live Season Two room: filtered hero selection, roll, keep all, release one, reroll and synchronized feedback passed.');
    } finally {
        for (const page of pages) {
            await page.evaluate(() => { if (roomId) socket.emit('room:leave', { room_id: roomId }); }).catch(() => {});
        }
        for (const context of contexts) await context.close();
    }
}

(async () => {
    const browser = await chromium.launch({ channel: 'chrome', headless: true });
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
    const page = await context.newPage();
    const errors = [];
    const measurements = {};
    page.on('pageerror', error => errors.push(error.message));
    await page.route('https://fonts.googleapis.com/**', route => route.abort());
    try {
        await page.goto(base);
        await page.waitForFunction(() => typeof socket !== 'undefined' && socket.connected && cachedGameList);
        await page.evaluate(() => ensureGameAssets('dice_throne'));
        await page.evaluate(() => { window.sendAction = action => window.diceThroneTestActions.push(action); });
        for (const viewport of [{ width: 320, height: 640 }, { width: 390, height: 844 }, { width: 768, height: 900 }, { width: 1024, height: 768 }, { width: 1440, height: 900 }]) {
            await page.setViewportSize(viewport);
            for (const phase of Object.keys(fixtures)) {
                await render(page, phase);
                await bounds(page, `${viewport.width}px / ${phase}`);
            }
            await render(page, 'rolled');
            measurements[viewport.width] = await geometry(page);
            assert(measurements[viewport.width].headerHeight <= 30, 'The title stays a compact single row.');
            assert(measurements[viewport.width].playersHeight <= 65, 'Normal hero summaries stay compact.');
            await page.mouse.move(0, 0);
            await page.screenshot({ path: `${output}/${viewport.width}-combat.png`, fullPage: true });
            assert.equal(await page.locator('.game-panel-title h2').innerText(), 'Dice Throne');
            assert.equal(await page.locator('#diceThronePanel > .dice-throne-shell, .dice-throne-titlebar').count(), 0);
            assert.equal(await page.locator('#diceThronePanel').evaluate(node => getComputedStyle(node).borderTopWidth), '0px');
            assert.equal(await page.locator('#diceThronePanel').evaluate(node => getComputedStyle(node).paddingTop), '0px');
            assert.equal(await page.locator('#diceThroneLogPanel details').getAttribute('open'), null);
            if (viewport.width >= 1024) assert(measurements[viewport.width].sideBySide, 'Desktop dice and decisions must share a row.');
            if (viewport.width <= 390) assert(measurements[viewport.width].panelBottom <= viewport.height, 'Normal mobile combat must fit the viewport.');
            await heroReferences(page, viewport.width);
            await seasonTwoPicker(page, viewport.width);
        }
        fs.writeFileSync(`${output}/measurements.json`, JSON.stringify(measurements, null, 2));
        console.log(JSON.stringify(measurements, null, 2));
        await interactions(page);
        await page.setViewportSize({ width: 390, height: 844 });
        await rerollFeedback(page);
        await newHeroInteractions(page);
        await desktop(browser);
        await liveRerolls(browser);
        assert.deepEqual(errors, [], 'Browser console errors');
        console.log(`${Object.keys(fixtures).length} states fit at 320, 390, 768, 1024 and 1440px.`);
        console.log('Touch scrolling, selection, card inputs, dice controls, Help/Explain, Esc, tooltips, round review and game switching passed.');
        console.log('All sixteen hero references, season filters, scroll-preserving selection, six dice faces, every ability, opponent upgrades, spectators, modal tooltips and compact layouts passed.');
        console.log('Reroll counts, all-kept guard, repeated-result feedback, spectators, reduced motion and error recovery passed.');
    } catch (error) {
        await page.screenshot({ path: `${output}/failure.png`, fullPage: true });
        throw error;
    } finally {
        await browser.close();
    }
})().catch(error => { console.error(error); process.exitCode = 1; });
