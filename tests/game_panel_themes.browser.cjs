const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const base = process.env.ROOM_TEST_URL || 'http://127.0.0.1:8766';
const output = 'build/game-panel-themes';
const games = [
    {id: 'guandan', prefix: 'guandan', target: '#guandanPlayBtn'},
    {id: 'century_spice_road', prefix: 'century', target: '[data-century-explain]:visible'},
    {id: 'in_a_grove', prefix: 'inAGrove', target: 'button[data-in-a-grove-explain]:visible'},
    {id: 'wandering_towers', prefix: 'wanderingTowers', target: '.wandering-cell:visible'},
    {id: 'splendor_pokemon', prefix: 'pokemonSplendor', target: '.pokemon-market-card:visible'},
    {id: 'carcassonne', prefix: 'carc', target: '#carcSkipMeepleBtn', surface: '.carc-game-shell'},
    {id: 'poison', prefix: 'poison', target: '#poisonPanel [data-poison-explanation]:visible'},
    {id: 'for_sale', prefix: 'forSale', target: '.fs-property:visible', surface: '.fs-surface', modal: '#forSaleDialog'},
    {id: 'terra_nova', prefix: 'terraNova', target: '[data-tn-explain="map"]:visible', modal: '#terraNovaModal'},
];

(async () => {
    fs.mkdirSync(output, {recursive: true});
    const browser = await chromium.launch({channel: 'chrome', headless: true});
    const contexts = [];
    const errors = [];
    const results = [];
    const failures = [];

    async function newPage(mobile = false) {
        const context = await browser.newContext({viewport: {width: mobile ? 390 : 1440, height: 1000}, hasTouch: mobile, isMobile: mobile});
        contexts.push(context);
        const page = await context.newPage();
        page.setDefaultTimeout(12000);
        page.on('pageerror', error => errors.push(error.message));
        await page.route('https://fonts.googleapis.com/**', route => route.abort());
        await page.goto(base);
        await page.waitForFunction(() => typeof socket !== 'undefined' && socket.connected && cachedGameList);
        return page;
    }

    async function leave(page) {
        await page.evaluate(async () => {
            if (roomId) await socket.emitWithAck('room:leave', {room_id: roomId});
            resetRoomState();
        });
    }

    async function layout(page, game, width) {
        await page.setViewportSize({width, height: 1000});
        await page.evaluate(() => {
            setRoomControlsCollapsed(true);
            syncRoomControlsExplainButton();
            document.activeElement?.blur();
        });
        const measurement = await page.evaluate(({id, surface}) => {
            const assets = GAME_ASSETS[id];
            const outer = document.querySelector('.game-panel');
            const panel = document.getElementById(assets.panel);
            const roots = [panel, ...(surface ? [panel.querySelector(surface)] : [])];
            const frame = node => {
                const style = getComputedStyle(node);
                return {
                    id: node.id || node.className,
                    border: [style.borderTopWidth, style.borderRightWidth, style.borderBottomWidth, style.borderLeftWidth],
                    padding: [style.paddingTop, style.paddingRight, style.paddingBottom, style.paddingLeft],
                    radius: style.borderRadius,
                    background: style.backgroundColor,
                    image: style.backgroundImage,
                    shadow: style.boxShadow,
                };
            };
            return {
                theme: outer.dataset.gameTheme,
                title: outer.querySelector('.game-panel-title h2').textContent,
                expectedTitle: assets.panelTitle,
                pageOverflow: document.documentElement.scrollWidth > innerWidth + 1,
                outerOverflow: outer.scrollWidth > outer.clientWidth + 1,
                panelOverflow: panel.scrollWidth > panel.clientWidth + 1,
                roots: roots.map(frame),
                outerBackground: getComputedStyle(outer).backgroundImage,
            };
        }, game);
        assert.equal(measurement.theme, game.id);
        assert.equal(measurement.title, measurement.expectedTitle);
        assert.equal(measurement.pageOverflow, false, `${game.id} page overflow at ${width}`);
        assert.equal(measurement.outerOverflow, false, `${game.id} outer overflow at ${width}`);
        assert.equal(measurement.panelOverflow, false, `${game.id} panel overflow at ${width}`);
        assert.notEqual(measurement.outerBackground, 'none', `${game.id} theme belongs on Game`);
        for (const root of measurement.roots) {
            assert.deepEqual(root.border, ['0px', '0px', '0px', '0px'], `${game.id} inner border: ${root.id}`);
            assert.deepEqual(root.padding, ['0px', '0px', '0px', '0px'], `${game.id} inner padding: ${root.id}`);
            assert.equal(root.radius, '0px', `${game.id} inner radius: ${root.id}`);
            assert.equal(root.background, 'rgba(0, 0, 0, 0)', `${game.id} inner background: ${root.id}`);
            assert.equal(root.image, 'none', `${game.id} inner image: ${root.id}`);
            assert.equal(root.shadow, 'none', `${game.id} inner shadow: ${root.id}`);
        }
        await page.screenshot({path: `${output}/${game.id}-${width}.png`, fullPage: true});
        results.push({game: game.id, width, title: measurement.title});
    }

    async function interact(page, game, mobile) {
        const activate = async locator => mobile ? locator.tap() : locator.click();
        const help = page.locator(`#${game.prefix}HelpBtn`);
        const explain = page.locator(`#${game.prefix}ExplainBtn`);
        const helpModal = page.locator(game.modal || `#${game.prefix}HelpModal`);
        const explainModal = page.locator(game.modal || `#${game.prefix}ExplainModal`);
        const before = await page.evaluate(() => lastGameStatePayload.state_version);
        await activate(help);
        await helpModal.waitFor({state: 'visible'});
        await page.keyboard.press('Escape');
        await helpModal.waitFor({state: 'hidden'});
        await activate(explain);
        const target = page.locator(game.target).first();
        await target.evaluate(node => node.scrollIntoView({block: 'center', behavior: 'instant'}));
        await page.waitForFunction(selector => {
            const node = document.querySelector(selector);
            return node && (node.classList.contains('active') || node.getAttribute('aria-pressed') === 'true');
        }, `#${game.prefix}ExplainBtn`);
        const bounds = await target.boundingBox();
        assert(bounds, `${game.id} explanation target is visible`);
        const horizontal = bounds.x + bounds.width / 2;
        const vertical = bounds.y + bounds.height / 2;
        if (mobile) await page.touchscreen.tap(horizontal, vertical);
        else await page.mouse.click(horizontal, vertical);
        await explainModal.waitFor({state: 'visible'});
        await page.keyboard.press('Escape');
        await explainModal.waitFor({state: 'hidden'});
        if (await explain.evaluate(node => node.classList.contains('active') || node.getAttribute('aria-pressed') === 'true')) {
            await activate(explain);
        }
        assert.equal(await page.evaluate(() => lastGameStatePayload.state_version), before, `${game.id} Explain must not make a move`);
    }

    try {
        const desktop = await newPage();
        const mobile = await newPage(true);
        const peers = [desktop, mobile, await newPage(), await newPage()];
        for (const game of games) {
            console.log(`Checking ${game.id}`);
            let playing = [];
            try {
                const count = await desktop.evaluate(id => Math.max(2, cachedGameList.find(game => game.game_id === id).min_players), game.id);
                playing = peers.slice(0, count);
                await desktop.evaluate(id => socket.emit('room:create', {name: 'Frame QA 1', game_type: id}), game.id);
                await desktop.waitForFunction(id => roomSessionReady && currentGameType === id && isGameAssetsLoaded(id), game.id);
                const room = await desktop.evaluate(() => roomId);
                for (let index = 1; index < playing.length; index += 1) {
                    await playing[index].evaluate(({room, index}) => socket.emit('room:join', {room_id: room, name: `Frame QA ${index + 1}`}), {room, index});
                    await playing[index].waitForFunction(id => roomSessionReady && currentGameType === id && isGameAssetsLoaded(id), game.id);
                }
                for (const page of playing) await page.evaluate(() => socket.emit('room:ready', {room_id: roomId, ready: true}));
                await desktop.waitForFunction(() => !document.getElementById('startBtn').disabled);
                await desktop.evaluate(() => socket.emit('room:start', {room_id: roomId}));
                for (const page of playing) {
                    await page.waitForFunction(id => lastGameStatePayload?.game_type === id && lastGameStatePayload.view, game.id);
                }
                for (const [page, width] of [[desktop, 1440], [desktop, 1024], [mobile, 390], [mobile, 320]]) {
                    await layout(page, game, width);
                }
                await desktop.setViewportSize({width: 1440, height: 1000});
                await interact(desktop, game, false);
                await interact(mobile, game, true);
                console.log(`PASS ${game.id}: four widths, Help/Explain, Escape`);
            } catch (error) {
                failures.push({game: game.id, error: error.stack});
                console.error(`FAIL ${game.id}: ${error.message}`);
                await desktop.screenshot({path: `${output}/${game.id}-failure.png`, fullPage: true});
            } finally {
                for (const page of [...playing].reverse()) await leave(page);
                assert.equal(await desktop.locator('.game-panel-title h2').textContent(), 'Game');
                assert.equal(await desktop.locator('.game-panel').getAttribute('data-game-theme'), null);
                assert.equal(await desktop.locator('.game-panel').evaluate(node => getComputedStyle(node).backgroundImage), 'none');
            }
        }
        await desktop.evaluate(async () => {
            for (const id of ['cabo', 'dice_throne', 'emerald_skulls']) await ensureGameAssets(id);
        });
        const transitions = ['poison', 'cabo', 'emerald_skulls', 'dice_throne', 'guandan', 'emerald_skulls', 'for_sale', 'dice_throne', 'cabo', null];
        for (const id of transitions) {
            const actual = await desktop.evaluate(id => {
                setGamePanelVisibility(id);
                const outer = document.querySelector('.game-panel');
                return {theme: outer.dataset.gameTheme || null, title: outer.querySelector('.game-panel-title h2').textContent};
            }, id);
            const expected = await desktop.evaluate(id => ({theme: GAME_ASSETS[id]?.panelTitle ? id : null, title: GAME_ASSETS[id]?.panelTitle || (id === 'dice_throne' ? 'Dice Throne' : id === 'emerald_skulls' ? '💀 翡翠骰骨' : 'Game')}), id);
            assert.deepEqual(actual, expected, `Theme transition to ${id}`);
        }
        assert.deepEqual(errors, [], 'Browser errors');
        assert.deepEqual(failures, [], 'Game theme regressions');
        console.log(`PASS ${results.length} layout checks and legacy theme transitions`);
    } finally {
        fs.writeFileSync(`${output}/results.json`, JSON.stringify({results, failures, errors}, null, 2));
        for (const context of contexts) await context.close();
        await browser.close();
    }
})().catch(error => { console.error(error); process.exitCode = 1; });
