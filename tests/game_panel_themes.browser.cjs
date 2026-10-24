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
    {id: 'bohnanza_dice', prefix: 'bohnanzaDice', target: '[data-bohnanza-dice-explain="dice"]:visible'},
    {id: 'catan_starfarers', prefix: 'catanStarfarers', target: '[data-catan-starfarers-explain="status"]:visible', reopen: true},
    {id: 'castles_of_burgundy', help: '[data-burgundy="help"]', explain: '[data-burgundy="explain"]', target: '[data-burgundy="player"]:visible', modal: '.burgundy-dialog', reopen: true},
    {id: 'gaia_project', prefix: 'gaiaProject', target: 'button[data-gaia-explain]:visible', modal: '.gaia-modal'},
    {id: 'take_time', prefix: 'takeTime', target: 'button[data-tt-explain]:visible', surface: '.take-time-shell', modal: '#takeTimeDialog'},
    {id: 'eternal_decks', prefix: 'eternalDecks', target: 'button[data-ed-explain]:visible', surface: '.eternal-decks-shell', modal: '#eternalDecksDialog'},
    {id: 'maskmen', prefix: 'maskmen', target: '#maskmenSeason', modal: '#maskmenDialog'},
    {id: 'power_grid', prefix: 'powerGrid', target: '#powerGridRound', modal: '#powerGridDialog'},
    {id: 'a_feast_for_odin', prefix: 'odin', target: '.od-season [data-od-explain]', surface: '.od-root', modal: '#odinDialog', reopen: true},
    {id: 'moshimo_yusha', prefix: 'moshimoYusha', target: '#myConfirm', modal: '#moshimoYushaDialog'},
    {id: 'colt_express', prefix: 'coltExpress', target: '.ce-ticket', surface: '.ce-surface', modal: '#coltExpressDialog', reopen: true},
    {id: 'the_crew', prefix: 'theCrew', target: '#theCrewMission', modal: '#theCrewDialog', color: 'rgb(19, 34, 63)', reopen: true},
    {id: 'the_crew', caseName: 'the_crew-deep-sea', config: {edition: 2}, prefix: 'theCrew', target: '#theCrewMission', modal: '#theCrewDialog', color: 'rgb(16, 60, 70)', reopen: true},
    {id: 'cheaty_mages', prefix: 'cheatyMages', target: '.cm-fighter-select:visible', surface: '.cm-surface', modal: '#cheatyMagesDialog', reopen: true},
    {id: 'ponzi_scheme', prefix: 'ponziScheme', target: 'button[data-ps-explain]:visible', surface: '.ponzi-scheme-shell', modal: '#ponziSchemeDialog', reopen: true},
    {id: 'kronologic', prefix: 'kronologic', target: '#kronologicTimeModeBtn', surface: '.kronologic-game-shell', reopen: true},
    {id: 'wriggle_roulette', prefix: 'wriggleRoulette', target: '[data-wriggle-roulette-explain="bag"]', reopen: true},
    {id: 'criminal_dance', prefix: 'criminalDance', target: '#criminalDancePanel [data-criminal-dance-explain-key="status"]', surface: '.criminal-dance-surface', reopen: true},
    {id: 'hive', help: '#hiveHelp', explain: '#hiveExplain', target: '#hiveFit', modal: '#hiveDialog', reopen: true},
    {id: 'las_vegas', prefix: 'lasVegas', target: '.lv-round-marker [data-lv-explain]', surface: '.lv-surface', modal: '#lasVegasDialog', reopen: true},
    {id: 'las_vegas', caseName: 'las_vegas-royale', config: {edition: 'royale'}, prefix: 'lasVegas', target: '.lv-round-marker [data-lv-explain]', surface: '.lv-surface', modal: '#lasVegasDialog', reopen: true},
    {id: 'night_of_the_ninja', prefix: 'nightNinja', target: '[data-nn-action="draft"]', surface: '.nn-surface', modal: '#nightNinjaDialog', reopen: true},
    {id: 'love_letter', prefix: 'loveLetter', target: '.ll-card:visible', surface: '.ll-surface', modal: '#loveLetterDialog', reopen: true},
    {id: 'spirit_island', playerCount: 4, prefix: 'spiritIsland', target: '.si-spirit-choice:visible', surface: '.si-shell', modal: '.spirit-island-dialog', reopen: true},
    {id: 'cryptid', prefix: 'cryptid', target: '[data-cryptid-action="in"]', surface: '.cryptid-shell', modal: '#cryptidDialog', reopen: true},
];
const selectedGames = process.env.GAME_PANEL_GAMES?.split(',');

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
        await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
        const measurement = await page.evaluate(({id, surface}) => {
            const assets = GAME_ASSETS[id];
            const outer = document.querySelector('.game-panel');
            const panel = document.getElementById(assets.panel);
            const roots = [panel, ...(surface ? [panel.querySelector(surface)] : [])];
            const frame = node => {
                const style = getComputedStyle(node);
                let dockClearance = '0px';
                if (node === panel && id === 'eternal_decks' && panel.classList.contains('eternal-decks-has-dock')) {
                    dockClearance = style.getPropertyValue('--ed-dock-height').trim() || '90px';
                }
                if (node === panel && id === 'carcassonne' && innerWidth <= 720 && panel.matches('.carc-can-place.carc-panel-visible')) {
                    dockClearance = '82px';
                }
                return {
                    id: node.id || node.className,
                    border: [style.borderTopWidth, style.borderRightWidth, style.borderBottomWidth, style.borderLeftWidth],
                    padding: [style.paddingTop, style.paddingRight, style.paddingBottom, style.paddingLeft],
                    radius: style.borderRadius,
                    background: style.backgroundColor,
                    image: style.backgroundImage,
                    shadow: style.boxShadow,
                    dockClearance,
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
                outerColor: getComputedStyle(outer).backgroundColor,
            };
        }, game);
        assert.equal(measurement.theme, game.id);
        assert.equal(measurement.title, measurement.expectedTitle);
        assert.equal(measurement.pageOverflow, false, `${game.id} page overflow at ${width}`);
        assert.equal(measurement.outerOverflow, false, `${game.id} outer overflow at ${width}`);
        assert.equal(measurement.panelOverflow, false, `${game.id} panel overflow at ${width}`);
        if (game.color) assert.equal(measurement.outerColor, game.color, `${game.caseName || game.id} edition theme`);
        assert(measurement.outerBackground !== 'none' || !['rgba(0, 0, 0, 0)', 'rgb(255, 255, 255)'].includes(measurement.outerColor), `${game.id} theme belongs on Game`);
        for (const root of measurement.roots) {
            assert.deepEqual(root.border, ['0px', '0px', '0px', '0px'], `${game.id} inner border: ${root.id}`);
            assert.deepEqual(root.padding, ['0px', '0px', root.dockClearance, '0px'], `${game.id} inner padding: ${root.id}`);
            assert.equal(root.radius, '0px', `${game.id} inner radius: ${root.id}`);
            assert.equal(root.background, 'rgba(0, 0, 0, 0)', `${game.id} inner background: ${root.id}`);
            assert.equal(root.image, 'none', `${game.id} inner image: ${root.id}`);
            assert.equal(root.shadow, 'none', `${game.id} inner shadow: ${root.id}`);
        }
        await page.screenshot({path: `${output}/${game.caseName || game.id}-${width}.png`, fullPage: true});
        results.push({game: game.caseName || game.id, width, title: measurement.title});
    }

    async function mapInteraction(page, game, mobile) {
        const spirit = game.id === 'spirit_island';
        const map = page.locator(spirit ? '.si-island' : '.cryptid-map');
        const selected = page.locator(spirit ? '.si-land.is-selected' : '.cryptid-cell.is-selected');
        const activate = async locator => mobile ? locator.tap() : locator.click();
        const fit = page.locator(spirit ? '[data-si-action="map-fit"]' : '[data-cryptid-action="fit"]');
        const zoom = page.locator(spirit ? '[data-si-action="zoom-in"]' : '[data-cryptid-action="in"]');
        await activate(fit);
        const fitted = await map.getAttribute('viewBox');
        if (spirit) {
            await activate(page.locator('.si-land-number').first());
            assert.equal(await selected.count(), 1, 'Spirit Island map tap selects a land');
            await page.keyboard.press('Escape');
            assert.equal(await selected.count(), 0, 'Escape cancels land selection');
        }
        await activate(zoom);
        const zoomed = await map.getAttribute('viewBox');
        assert.notEqual(zoomed, fitted, `${game.id} zoom remains functional`);
        assert.equal(await map.evaluate(node => getComputedStyle(node).touchAction), 'none');
        await map.evaluate(node => node.scrollIntoView({block: 'center', behavior: 'instant'}));
        const bounds = await map.boundingBox();
        const horizontal = bounds.x + bounds.width / 2;
        const vertical = Math.min(page.viewportSize().height - 60, Math.max(100, bounds.y + bounds.height / 2));
        const scroll = await page.evaluate(() => scrollY);
        if (mobile) {
            const session = await page.context().newCDPSession(page);
            await session.send('Input.dispatchTouchEvent', {type: 'touchStart', touchPoints: [{x: horizontal, y: vertical, id: 1}]});
            await session.send('Input.dispatchTouchEvent', {type: 'touchMove', touchPoints: [{x: horizontal + 35, y: vertical - 30, id: 1}]});
            await session.send('Input.dispatchTouchEvent', {type: 'touchEnd', touchPoints: []});
            assert.notEqual(await map.getAttribute('viewBox'), zoomed, `${game.id} touch pans the map`);
            const panned = await map.getAttribute('viewBox');
            await session.send('Input.dispatchTouchEvent', {type: 'touchStart', touchPoints: [{x: horizontal - 22, y: vertical, id: 1}, {x: horizontal + 22, y: vertical, id: 2}]});
            await session.send('Input.dispatchTouchEvent', {type: 'touchMove', touchPoints: [{x: horizontal - 45, y: vertical, id: 1}, {x: horizontal + 45, y: vertical, id: 2}]});
            await session.send('Input.dispatchTouchEvent', {type: 'touchEnd', touchPoints: []});
            assert.notEqual(await map.getAttribute('viewBox'), panned, `${game.id} pinch zooms the map`);
            await session.detach();
        } else {
            await page.mouse.move(horizontal, vertical);
            await page.mouse.down();
            await page.mouse.move(bounds.x - 6, vertical + 24, {steps: 6});
            await page.mouse.up();
            assert.notEqual(await map.getAttribute('viewBox'), zoomed, `${game.id} drag ends outside the map`);
        }
        assert.equal(await page.evaluate(() => scrollY), scroll, `${game.id} map gestures do not scroll the page`);
        assert.equal(await map.evaluate(node => node.classList.contains('is-dragging')), false);
        assert.equal(await selected.count(), 0, `${game.id} dragging must not select a location`);
        await activate(fit);
    }

    async function interact(page, game, mobile) {
        const activate = async locator => mobile ? locator.tap() : locator.click();
        const help = page.locator(game.help || `#${game.prefix}HelpBtn`);
        const explainSelector = game.explain || `#${game.prefix}ExplainBtn`;
        const explain = page.locator(explainSelector);
        const helpModal = page.locator(game.modal || `#${game.prefix}HelpModal`);
        const explainModal = page.locator(game.modal || `#${game.prefix}ExplainModal`);
        const before = await page.evaluate(() => lastGameStatePayload.state_version);
        await activate(help);
        await helpModal.waitFor({state: 'visible'});
        await page.keyboard.press('Escape');
        await helpModal.waitFor({state: 'hidden'});
        for (let attempt = 0; attempt < (game.reopen ? 2 : 1); attempt += 1) {
            await activate(explain);
            const target = page.locator(game.target).first();
            await target.evaluate(node => node.scrollIntoView({block: 'center', behavior: 'instant'}));
            await page.waitForFunction(selector => {
                const node = document.querySelector(selector);
                return node && (node.classList.contains('active') || node.classList.contains('is-selected') || node.getAttribute('aria-pressed') === 'true');
            }, explainSelector);
            const bounds = await target.boundingBox();
            assert(bounds, `${game.id} explanation target is visible`);
            const horizontal = bounds.x + bounds.width / 2;
            const vertical = bounds.y + bounds.height / 2;
            if (mobile) await page.touchscreen.tap(horizontal, vertical);
            else await page.mouse.click(horizontal, vertical);
            await explainModal.waitFor({state: 'visible'});
            if (game.reopen && attempt === 0) await activate(explainModal.locator('button').first());
            else await page.keyboard.press('Escape');
            await explainModal.waitFor({state: 'hidden'});
            if (await explain.evaluate(node => node.classList.contains('active') || node.classList.contains('is-selected') || node.getAttribute('aria-pressed') === 'true')) {
                await activate(explain);
            }
        }
        assert.equal(await page.evaluate(() => lastGameStatePayload.state_version), before, `${game.id} Explain must not make a move`);
        if (game.id === 'love_letter' && await page.locator('.ll-card:enabled').count()) {
            await activate(page.locator('.ll-card:enabled').first());
            assert.equal(await page.locator('.ll-card.is-selected').count(), 1);
            await activate(page.locator('.ll-round'));
            assert.equal(await page.locator('.ll-card.is-selected').count(), 0, 'Round label remains a blank-space cancellation target');
            await activate(page.locator('.ll-card:enabled').first());
            await page.keyboard.press('Escape');
            assert.equal(await page.locator('.ll-card.is-selected').count(), 0);
        }
        if (game.id === 'cryptid') {
            for (const kind of ['notes', 'clue']) {
                await activate(page.locator(`[data-cryptid-action="${kind}"]`));
                await helpModal.waitFor({state: 'visible'});
                const bounds = await helpModal.boundingBox();
                assert(bounds && bounds.x >= 0 && bounds.x + bounds.width <= page.viewportSize().width + 1, `${kind} dock stays inside the viewport`);
                assert.equal(await helpModal.getAttribute('data-kind'), kind);
                await page.keyboard.press('Escape');
                await helpModal.waitFor({state: 'hidden'});
            }
            await mapInteraction(page, game, mobile);
        }
        if (game.id === 'spirit_island' && game.caseName === 'spirit_island-map') await mapInteraction(page, game, mobile);
        assert.equal(await page.evaluate(() => lastGameStatePayload.state_version), before, `${game.id} preview and navigation must not submit a move`);
        if (mobile && game.id === 'kronologic') {
            const dock = page.locator('#kronologicNotebookDockBtn');
            const notebook = page.locator('#kronologicNotebookSection');
            await activate(dock);
            await notebook.waitFor({state: 'visible'});
            await activate(page.locator('[data-notebook-time="2"]'));
            assert.equal(await page.locator('[data-notebook-time="2"]').getAttribute('aria-pressed'), 'true');
            const bounds = await notebook.boundingBox();
            assert(bounds && bounds.x >= 0 && bounds.x + bounds.width <= page.viewportSize().width, 'Notebook stays inside the viewport');
            await page.keyboard.press('Escape');
            await notebook.waitFor({state: 'hidden'});
            await activate(dock);
            await activate(page.locator('#kronologicNotebookCloseBtn'));
            await notebook.waitFor({state: 'hidden'});
            assert.equal(await page.evaluate(() => lastGameStatePayload.state_version), before, 'Browsing notebook times must not make a move');
        }
    }

    try {
        const desktop = await newPage();
        const mobile = await newPage(true);
        const peers = [desktop, mobile, await newPage(), await newPage()];
        for (const game of games.filter(game => !selectedGames || selectedGames.includes(game.id))) {
            const caseName = game.caseName || game.id;
            console.log(`Checking ${caseName}`);
            let playing = [];
            try {
                const count = game.playerCount || await desktop.evaluate(id => Math.max(2, cachedGameList.find(game => game.game_id === id).min_players), game.id);
                playing = peers.slice(0, count);
                await desktop.evaluate(({id, config}) => socket.emit('room:create', {name: 'Frame QA 1', game_type: id, config}), game);
                await desktop.waitForFunction(id => roomSessionReady && currentGameType === id && isGameAssetsLoaded(id), game.id);
                if (game.id === 'las_vegas') {
                    const setup = await desktop.locator('#lasVegasSetup').evaluate(node => {
                        const style = getComputedStyle(node);
                        return [style.backgroundColor, style.backgroundImage, style.borderWidth, style.borderRadius, style.padding];
                    });
                    assert.deepEqual(setup, ['rgba(0, 0, 0, 0)', 'none', '0px', '0px', '0px'], 'Las Vegas lobby has no nested frame');
                    assert.equal(await desktop.locator('#lasVegasEdition').inputValue(), game.config?.edition || 'classic');
                }
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
                if (game.id === 'kronologic') {
                    assert.equal(await desktop.locator('#kronologicCaseTitle').textContent(), await desktop.evaluate(() => lastGameStatePayload.view.case.title), 'Current case title is preserved');
                }
                for (const [page, width] of [[desktop, 1440], [desktop, 1024], [mobile, 390], [mobile, 320]]) {
                    await layout(page, game, width);
                }
                await desktop.setViewportSize({width: 1440, height: 1000});
                await interact(desktop, game, false);
                await interact(mobile, game, true);
                if (game.id === 'spirit_island') {
                    for (const page of playing) {
                        await page.evaluate(() => setRoomControlsCollapsed(true));
                        await page.locator('.si-spirit-choice:enabled').first().click();
                        await page.locator('[data-si-action="confirm"]').click();
                        await page.waitForFunction(() => lastGameStatePayload.view.players.find(player => player.id === playerId)?.spirit_id);
                    }
                    for (const page of playing) await page.waitForFunction(() => lastGameStatePayload.view.phase === 'growth');
                    const mapGame = {...game, caseName: 'spirit_island-map', target: '[data-si-action="zoom-in"]'};
                    for (const [page, width] of [[desktop, 1440], [desktop, 1024], [mobile, 390], [mobile, 320]]) await layout(page, mapGame, width);
                    await desktop.setViewportSize({width: 1440, height: 1000});
                    await interact(desktop, mapGame, false);
                    await interact(mobile, mapGame, true);
                    console.log('PASS spirit_island-map: four-player map, four widths, pan, pinch, selection, Help/Explain');
                }
                console.log(`PASS ${caseName}: four widths, Help/Explain, Escape`);
            } catch (error) {
                failures.push({game: caseName, error: error.stack});
                console.error(`FAIL ${caseName}: ${error.message}`);
                await desktop.screenshot({path: `${output}/${caseName}-failure.png`, fullPage: true});
            } finally {
                for (const page of [...playing].reverse()) await leave(page);
                assert.equal(await desktop.locator('.game-panel-title h2').textContent(), 'Game');
                assert.equal(await desktop.locator('.game-panel').getAttribute('data-game-theme'), null);
                assert.equal(await desktop.locator('.game-panel').evaluate(node => getComputedStyle(node).backgroundImage), 'none');
            }
        }
        await desktop.evaluate(async () => {
            for (const id of ['cabo', 'dice_throne', 'emerald_skulls', 'poison', 'guandan', 'for_sale']) await ensureGameAssets(id);
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
