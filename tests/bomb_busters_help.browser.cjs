const {chromium} = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const {execFileSync} = require('node:child_process');

const base = process.env.ROOM_TEST_URL || 'http://127.0.0.1:8766';
const output = 'build/bomb-busters-help';
const views = JSON.parse(execFileSync(process.env.PYTHON || 'python3', ['-c', `
import json
from game.bomb_busters import BombBustersGame
from tests.test_bomb_busters_game import make_players
result = {}
for mission in (None, 19, 46, 57, 66):
    config = {"seed": "help-layout"}
    if mission is not None:
        config["mission_id"] = mission
    state = BombBustersGame.init_game(config, make_players(3))
    result[str(mission)] = BombBustersGame.get_public_view(state, "p0")
print(json.dumps(result))
`], {encoding: 'utf8'}));

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
                dialogWidth: box.width,
                dialogHeight: box.height,
            };
        });
        for (const key of ['pageOverflow', 'dialogOverflow', 'contentOverflow', 'tabOverflow']) {
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
                assert.equal(await dialog.locator('[data-obg-help-tab="mission"]').getAttribute('aria-selected'), 'true');
                assert.equal(await dialog.locator('[data-obg-help-lang="' + language + '"]').getAttribute('aria-pressed'), 'true');
            }
            await page.keyboard.press('Escape');
        }

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
        console.log(`PASS ${measurements.length} Help layouts, 4 widths, 6 tabs, both languages, dynamic mission rules and equipment Explain, Close/Esc/focus, disabled Explain and game switching`);
    } finally {
        fs.writeFileSync(`${output}/measurements.json`, JSON.stringify({measurements, errors}, null, 2));
        await context.close();
        await browser.close();
    }
})().catch(error => { console.error(error); process.exitCode = 1; });
