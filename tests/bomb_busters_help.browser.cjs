const {chromium} = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const {execFileSync} = require('node:child_process');

const base = process.env.ROOM_TEST_URL || 'http://127.0.0.1:8766';
const output = 'build/bomb-busters-help';
const views = JSON.parse(execFileSync(process.env.PYTHON || 'python3', ['-c', `
import json
from game.bomb_busters import BombBustersGame
from game.bomb_busters_help import get_mission_help
from tests.test_bomb_busters_game import make_players
result = {}
for mission in (None, 19, 46, 57, 66):
    config = {"seed": "help-layout"}
    if mission is not None:
        config["mission_id"] = mission
    state = BombBustersGame.init_game(config, make_players(3))
    result[str(mission)] = BombBustersGame.get_public_view(state, "p0")
result["help"] = {str(number): get_mission_help(number) for number in range(1, 67)}
print(json.dumps(result))
`], {encoding: 'utf8'}));

(async () => {
    fs.mkdirSync(output, {recursive: true});
    const browser = await chromium.launch({channel: 'chrome', headless: true});
    const context = await browser.newContext({viewport: {width: 390, height: 844}, hasTouch: true});
    const page = await context.newPage();
    const errors = [];
    const measurements = [];
    const missionRequests = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('request', request => {
        if (request.url().includes('/api/bomb_busters/missions/')) missionRequests.push(request.url());
    });
    page.setDefaultTimeout(12000);

    async function render(view) {
        await page.evaluate(view => {
            renderBombBustersGameState({view, state_version: ++window.bombBustersHelpTestVersion});
        }, view);
    }

    async function measure(width, language, section) {
        const measurement = await page.evaluate(() => {
            const dialog = document.querySelector('.obg-help-dialog[data-obg-help-game="bomb_busters"]');
            const box = dialog.getBoundingClientRect();
            const heading = dialog.querySelector('.obg-help-head');
            const title = heading.querySelector('.obg-help-title').getBoundingClientRect();
            const languages = heading.querySelector('.obg-help-lang').getBoundingClientRect();
            const close = heading.querySelector('.obg-help-close').getBoundingClientRect();
            const content = dialog.querySelector('.obg-help-content');
            const tabs = dialog.querySelector('.obg-help-tabs');
            return {
                pageOverflow: document.documentElement.scrollWidth > innerWidth,
                dialogOverflow: dialog.scrollWidth > dialog.clientWidth,
                contentOverflow: content.scrollWidth > content.clientWidth,
                insideViewport: box.left >= 0 && box.right <= innerWidth && box.top >= 0 && box.bottom <= innerHeight,
                titleBeforeLanguage: title.right <= languages.left,
                languageBeforeClose: languages.right <= close.left,
                closeVisible: close.top >= box.top && close.bottom <= box.bottom,
                activeTabs: tabs.querySelectorAll('[aria-selected="true"]').length,
                tabOverflow: tabs.scrollWidth > tabs.clientWidth,
                browserOverflow: [...dialog.querySelectorAll('.bomb-busters-help-browser-fields')].some(element => element.scrollWidth > element.clientWidth),
                dialogWidth: box.width,
                dialogHeight: box.height,
            };
        });
        for (const key of ['pageOverflow', 'dialogOverflow', 'contentOverflow', 'tabOverflow', 'browserOverflow']) {
            assert.equal(measurement[key], false, `${width} ${language} ${section}: ${key}`);
        }
        for (const key of ['insideViewport', 'titleBeforeLanguage', 'languageBeforeClose', 'closeVisible']) {
            assert.equal(measurement[key], true, `${width} ${language} ${section}: ${key}`);
        }
        assert.equal(measurement.activeTabs, 1);
        measurements.push({width, language, section, ...measurement});
    }

    try {
        await page.route('https://fonts.googleapis.com/**', route => route.abort());
        await page.goto(base);
        await page.waitForFunction(() => typeof socket !== 'undefined' && socket.connected && cachedGameList);
        await page.evaluate(() => socket.emit('room:create', {name: 'Bomb Busters Help QA', game_type: 'bomb_busters'}));
        await page.waitForFunction(() => roomSessionReady && isGameAssetsLoaded('bomb_busters'));
        await page.evaluate(() => {
            window.bombBustersHelpTestVersion = 100;
            window.bombBustersHelpTestActions = [];
            sendAction = action => window.bombBustersHelpTestActions.push(action);
            setRoomControlsCollapsed(true);
            obgHelpSetLang('zh');
        });
        await render(views.None);
        const dialog = page.locator('.obg-help-dialog[data-obg-help-game="bomb_busters"]');
        await page.locator('#bombBustersHelpBtn').click();
        await dialog.waitFor({state: 'visible'});
        assert.equal(await dialog.locator('.obg-help-basic-row').count(), 3);
        assert.equal(await dialog.locator('[data-obg-help-tab]').count(), 6);
        assert.equal(await page.locator('#bombBustersHelpModal, #bombBustersExplainModal').count(), 0);

        for (const width of [320, 390, 1024, 1440]) {
            await page.setViewportSize({width, height: width < 600 ? 740 : 900});
            for (const language of ['zh', 'en']) {
                await dialog.locator(`[data-obg-help-lang="${language}"]`).click();
                for (const section of ['__basic', 'wires', 'cuts', 'equipment', 'mission', 'controls']) {
                    await dialog.locator(`[data-obg-help-tab="${section}"]`).click();
                    assert.equal(await dialog.locator(`[data-obg-help-section="${section}"]`).count(), 1);
                    await measure(width, language, section);
                }
                await dialog.locator('[data-obg-help-tab="__basic"]').click();
                assert.equal(await dialog.locator('.obg-help-basic-row').count(), 3);
                await page.screenshot({path: `${output}/${width}-${language}-basics.png`});
                await dialog.locator('[data-obg-help-tab="equipment"]').click();
                await page.screenshot({path: `${output}/${width}-${language}-equipment.png`});
                await dialog.locator('.obg-help-content').evaluate(element => { element.scrollTop = element.scrollHeight; });
                assert.equal(await dialog.locator('.obg-help-close').isVisible(), true);
                await dialog.locator('.obg-help-close').click();
                await dialog.waitFor({state: 'hidden'});
                assert.equal(await page.locator('#bombBustersHelpBtn').evaluate(element => element === document.activeElement), true);
                await page.locator('#bombBustersHelpBtn').click();
            }
        }

        await dialog.locator('[data-obg-help-tab="mission"]').click();
        assert((await dialog.locator('.obg-help-body').textContent()).includes('Original Practice'));
        await page.keyboard.press('Escape');
        await dialog.waitFor({state: 'hidden'});

        for (const number of [19, 46, 57, 66]) {
            await render(views[number]);
            await page.locator('#bombBustersHelpBtn').click();
            await dialog.locator('[data-obg-help-tab="mission"]').click();
            for (const language of ['zh', 'en']) {
                await dialog.locator(`[data-obg-help-lang="${language}"]`).click();
                const body = await dialog.locator('.obg-help-body').textContent();
                assert(body.includes(language === 'zh' ? `第 ${number} 关` : `Mission ${number}`));
                assert(body.includes(views[number].campaign[language === 'zh' ? 'rules_zh' : 'rules']));
                assert.equal(await dialog.locator('[data-bomb-busters-help-part]').count(), 5);
                assert(body.includes(views[number].campaign.help.sections[4].text[language]));
                assert.equal(await dialog.locator('[data-obg-help-tab="mission"]').getAttribute('aria-selected'), 'true');
                assert.equal(await dialog.locator('[data-obg-help-lang="' + language + '"]').getAttribute('aria-pressed'), 'true');
            }
            await page.keyboard.press('Escape');
        }
        assert.deepEqual(missionRequests, []);

        await render(views['46']);
        await page.locator('#bombBustersHelpBtn').click();
        await dialog.locator('[data-obg-help-tab="mission"]').click();
        const missionSelect = dialog.locator('[data-bomb-busters-help-mission-select]');
        const playerSelect = dialog.locator('[data-bomb-busters-help-player-select]');
        assert.equal(await missionSelect.isVisible(), false);
        await dialog.locator('.bomb-busters-help-browser > summary').click();
        assert.equal(await missionSelect.locator('option').count(), 66);
        assert.equal(await missionSelect.inputValue(), '46');

        for (let number = 1; number <= 66; number += 1) {
            await missionSelect.selectOption(String(number));
            await dialog.locator('[data-bomb-busters-help-part="example"]').waitFor({state: 'visible'});
            for (const language of ['zh', 'en']) {
                await dialog.locator(`[data-obg-help-lang="${language}"]`).click();
                assert.equal(await missionSelect.inputValue(), String(number));
                const detail = await dialog.locator('.bomb-busters-help-detail').textContent();
                assert(detail.includes(views.help[number].title[language]));
                for (const section of views.help[number].sections) {
                    assert(detail.includes(section.text[language]), `Mission ${number} ${language}: missing ${section.id}`);
                }
            }
        }

        for (const width of [320, 390, 1024, 1440]) {
            await page.setViewportSize({width, height: width < 600 ? 740 : 900});
            for (const language of ['zh', 'en']) {
                await dialog.locator(`[data-obg-help-lang="${language}"]`).click();
                await dialog.locator('.obg-help-content').evaluate(element => { element.scrollTop = 0; });
                await measure(width, language, 'mission-66-browser');
                assert.equal(await missionSelect.isVisible(), true);
                await page.screenshot({path: `${output}/${width}-${language}-mission-66.png`});
            }
        }

        await missionSelect.selectOption('34');
        await playerSelect.selectOption('2');
        await dialog.locator('.bomb-busters-help-warning').waitFor({state: 'visible'});
        assert((await dialog.locator('.bomb-busters-help-warning').textContent()).includes('at least 3'));
        await missionSelect.selectOption('4');
        await dialog.locator('[data-bomb-busters-help-part="example"]').waitFor({state: 'visible'});
        assert((await dialog.locator('[data-bomb-busters-help-part="setup"]').textContent()).includes('4 from 4 candidates'));
        await playerSelect.selectOption('5');
        await dialog.locator('[data-bomb-busters-help-part="example"]').waitFor({state: 'visible'});
        assert((await dialog.locator('[data-bomb-busters-help-part="setup"]').textContent()).includes('2 from 2 candidates'));
        await dialog.locator('[data-bomb-busters-help-current]').click();
        assert.equal(await missionSelect.inputValue(), '46');
        assert.equal(await playerSelect.inputValue(), '3');
        assert((await dialog.locator('.bomb-busters-help-detail').textContent()).includes(views.help['46'].title.en));

        await missionSelect.selectOption('22');
        await dialog.locator('[data-bomb-busters-help-part="example"]').waitFor({state: 'visible'});
        const failedUrl = '**/api/bomb_busters/missions/22/help?player_count=4';
        await page.route(failedUrl, route => route.fulfill({status: 503, body: 'temporarily unavailable'}));
        await playerSelect.selectOption('4');
        await dialog.locator('[data-bomb-busters-help-retry]').waitFor({state: 'visible'});
        await page.unroute(failedUrl);
        await dialog.locator('[data-bomb-busters-help-retry]').click();
        await dialog.locator('[data-bomb-busters-help-part="example"]').waitFor({state: 'visible'});
        assert((await dialog.locator('.bomb-busters-help-detail').textContent()).includes(views.help['22'].title.en));

        const delayedUrl = '**/api/bomb_busters/missions/9/help?player_count=4';
        let releaseDelayed;
        let markDelayedStarted;
        const delayedStarted = new Promise(resolve => { markDelayedStarted = resolve; });
        await page.route(delayedUrl, async route => {
            markDelayedStarted();
            await new Promise(resolve => { releaseDelayed = resolve; });
            await route.fulfill({json: {...views.help['9'], player_count: 4, setup_players: 4}}).catch(() => {});
        });
        await missionSelect.selectOption('9');
        await delayedStarted;
        await missionSelect.selectOption('16');
        await dialog.locator('[data-bomb-busters-help-part="example"]').waitFor({state: 'visible'});
        releaseDelayed();
        await page.unroute(delayedUrl);
        assert.equal(await missionSelect.inputValue(), '16');
        assert((await dialog.locator('.bomb-busters-help-detail').textContent()).includes(views.help['16'].title.en));
        await page.keyboard.press('Escape');
        await page.locator('#bombBustersHelpBtn').click();
        assert.equal(await missionSelect.isVisible(), false);
        assert((await dialog.locator('.bomb-busters-help-detail').textContent()).includes(views.help['46'].title.en));
        await page.keyboard.press('Escape');

        await render(views['46']);
        await page.locator('#bombBustersEquipment > summary').click();
        const equipment = page.locator('#bombBustersEquipmentCards .bomb-busters-equipment-card').first();
        assert.equal(await equipment.isVisible(), true);
        const equipmentDescription = await equipment.getAttribute('data-bomb-busters-explanation');
        assert(equipmentDescription);
        await page.locator('#bombBustersExplainBtn').click();
        await equipment.scrollIntoViewIfNeeded();
        const equipmentBounds = await equipment.boundingBox();
        await page.touchscreen.tap(equipmentBounds.x + equipmentBounds.width / 2, equipmentBounds.y + equipmentBounds.height / 2);
        await page.locator('.obg-explain-dialog').waitFor({state: 'visible'});
        assert.equal(await page.locator('.obg-explain-text').textContent(), equipmentDescription);
        assert.equal(await page.locator('#bombBustersExplainBtn').getAttribute('aria-pressed'), 'false');
        await page.keyboard.press('Escape');

        await render(views.None);
        await page.locator('#bombBustersHelpBtn').click();
        await dialog.locator('[data-obg-help-lang="zh"]').click();
        await page.keyboard.press('Escape');
        await page.locator('#bombBustersExplainBtn').click();
        const disabled = page.locator('#bombBustersShareClueBtn');
        assert.equal(await disabled.isVisible(), true);
        assert.equal(await disabled.isDisabled(), true);
        await disabled.scrollIntoViewIfNeeded();
        const bounds = await disabled.boundingBox();
        await page.touchscreen.tap(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2);
        await page.locator('.obg-explain-dialog').waitFor({state: 'visible'});
        assert((await page.locator('.obg-explain-text').textContent()).includes('开局选择自己的可用电线'));
        await page.keyboard.press('Escape');
        await page.locator('#bombBustersHelpBtn').click();
        await dialog.waitFor({state: 'visible'});
        await page.evaluate(() => showBombBustersHeaderActions(false));
        await dialog.waitFor({state: 'hidden'});
        assert.deepEqual(await page.evaluate(() => window.bombBustersHelpTestActions), []);
        assert.deepEqual(errors, []);
        console.log(`PASS ${measurements.length} Help layouts, all 66 bilingual mission guides, 4 widths, player-count previews, spoiler opt-in, retry, current-mission reset, equipment and disabled Explain, Close/Esc/focus and game switching`);
    } finally {
        fs.writeFileSync(`${output}/measurements.json`, JSON.stringify({measurements, errors}, null, 2));
        await context.close();
        await browser.close();
    }
})().catch(error => { console.error(error); process.exitCode = 1; });
