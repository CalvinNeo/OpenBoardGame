const assert = require('node:assert/strict');
const fs = require('node:fs');
const { execFileSync } = require('node:child_process');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');

const base = process.env.ROOM_TEST_URL || 'http://127.0.0.1:8784';
const output = 'build/tucano-ui';
fs.mkdirSync(output, { recursive: true });
const views = JSON.parse(execFileSync(process.env.PYTHON || 'python3', ['-c', `
import copy,json,random
from game.tucano import TucanoGame,FRUITS
random.seed(75)
names=['Calvin','VeryLongUnbrokenPlayerNameToCheckOverflow','名字很长的玩家用于检查手机界面','Robin']
players=[{'player_id':f'p{index}','name':name,'seat':index,'is_bot':False} for index,name in enumerate(names)]
state=TucanoGame.init_game({},players)
state['current_turn']='p0'
views={'opening':TucanoGame.get_public_view(state,'p0')}
fruits=list(FRUITS)
state['columns']=[
 [{'id':f'first{index}','type':'fruit','fruit':fruit} for index,fruit in enumerate(fruits[:4])],
 [{'id':f'second{index}','type':'fruit','fruit':fruit} for index,fruit in enumerate(fruits)]+[{'id':'flip','type':'toucan','toucan':'flip'}],
 [{'id':'give','type':'toucan','toucan':'give'},{'id':'joker','type':'joker','fruit':'joker'},{'id':'steal','type':'toucan','toucan':'steal'}],
]
for index,player in enumerate(state['players'].values()):
 player['face_up']={fruit:(fruit_index+index)%4+1 for fruit_index,fruit in enumerate(fruits)}
 player['jokers']=index%2
 player['protected']={'fig':index+2}
views['draft']=TucanoGame.get_public_view(state,'p0')
views['waiting']=TucanoGame.get_public_view(state,'p1')
views['spectator']=TucanoGame.get_public_view(state,'visitor')
for key,pending in [('give',['give']),('steal',['steal']),('flip',['flip']),('multiple',['give','steal','flip'])]:
 state['phase']='toucan'
 state['pending_toucans']=pending
 views[key]=TucanoGame.get_public_view(state,'p0')
state['pending_toucans']=['give']
state['players']['p0']['face_up']={}
views['skip']=TucanoGame.get_public_view(state,'p0')
views['empty']=copy.deepcopy(views['draft'])
views['empty']['columns'][1]=[]
views['finished']=copy.deepcopy(views['draft'])
views['finished'].update(game_over=True,phase='finished',winner=['p0','p2'],legal_actions=[],deck_count=0)
for index,player in enumerate(views['finished']['players']):
 player['score']=index*7-10
 player['score_breakdown']={fruit:{'count':count,'points':count*2} for fruit,count in player['face_up'].items()}
print(json.dumps(views))
`], { encoding: 'utf8' }));

async function render(page, key) {
    await page.evaluate(view => {
        tucanoOpenScores.clear();
        renderTucanoGameState({ room_id: roomId, game_type: 'tucano', view });
    }, views[key]);
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
}

async function checkLayout(page, label) {
    const result = await page.evaluate(() => {
        const problems = [];
        const visible = element => {
            const bounds = element.getBoundingClientRect();
            return bounds.width > 0 && bounds.height > 0 && getComputedStyle(element).visibility !== 'hidden';
        };
        const describe = element => element.id || `${element.className}: ${element.textContent.slice(0, 35)}`;
        const checkChildren = (parent, children) => {
            const container = parent.getBoundingClientRect();
            const boxes = children.filter(visible).map(element => ({ element, bounds: element.getBoundingClientRect() }));
            for (const { element, bounds } of boxes) {
                if (bounds.left < container.left - 1 || bounds.right > container.right + 1 || bounds.top < container.top - 1 || bounds.bottom > container.bottom + 1) {
                    problems.push(`Escapes parent: ${describe(element)}`);
                }
            }
            boxes.forEach((first, index) => {
                for (const second of boxes.slice(index + 1)) {
                    if (Math.min(first.bounds.right, second.bounds.right) - Math.max(first.bounds.left, second.bounds.left) > 1 && Math.min(first.bounds.bottom, second.bounds.bottom) - Math.max(first.bounds.top, second.bounds.top) > 1) {
                        problems.push(`Overlap: ${describe(first.element)} / ${describe(second.element)}`);
                    }
                }
            });
        };
        const root = document.getElementById('tucanoPanel');
        checkChildren(root, [...root.children].filter(element => !element.matches('.modal, .tucano-tooltip')));
        for (const parent of root.querySelectorAll('.tucano-columns, .tucano-players, .tucano-column, .tucano-player-card, .tucano-card, .tucano-fruit-card, .tucano-column-confirm, .tucano-pile-card-scroller, .tucano-status-grid, .tucano-player-heading, .tucano-score-scale')) {
            checkChildren(parent, [...parent.children]);
        }
        for (const element of root.querySelectorAll('.tucano-card *, .tucano-fruit-card *, .tucano-player-name, .tucano-score-details > summary')) {
            if (!visible(element)) continue;
            if (element.scrollWidth > element.clientWidth + 1 || element.scrollHeight > element.clientHeight + 1) {
                problems.push(`Clipped content: ${describe(element)}`);
            }
            if (element.childElementCount === 0 && element.textContent.trim()) {
                const range = document.createRange();
                range.selectNodeContents(element);
                const bounds = element.getBoundingClientRect();
                for (const text of range.getClientRects()) {
                    if (text.left < bounds.left - 1 || text.right > bounds.right + 1 || text.top < bounds.top - 2 || text.bottom > bounds.bottom + 2) {
                        problems.push(`Text outside element: ${describe(element)}`);
                    }
                }
            }
        }
        const header = root.closest('.game-panel').querySelector('.panel-header');
        checkChildren(header, [...header.children]);
        checkChildren(header.querySelector('.game-panel-title'), [...header.querySelector('.game-panel-title').children]);
        return { problems, viewport: innerWidth, pageWidth: document.documentElement.scrollWidth, height: root.getBoundingClientRect().height };
    });
    assert(result.pageWidth <= result.viewport, `${label}: horizontal page overflow ${JSON.stringify(result)}`);
    assert.deepEqual(result.problems, [], `${label}: layout violations`);
    return result;
}

async function tap(page, locator) {
    await locator.scrollIntoViewIfNeeded();
    const bounds = await locator.boundingBox();
    await page.touchscreen.tap(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2);
}

async function swipe(page, selector, horizontal) {
    const locator = page.locator(selector).first();
    await locator.scrollIntoViewIfNeeded();
    const bounds = await locator.boundingBox();
    const session = await page.context().newCDPSession(page);
    const start = { x: bounds.x + bounds.width * 0.7, y: bounds.y + bounds.height * 0.8 };
    await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [start] });
    for (const fraction of [0.2, 0.4, 0.6, 0.8, 1]) {
        await session.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: start.x - (horizontal ? 110 * fraction : 0), y: start.y - (horizontal ? 0 : 80 * fraction) }] });
    }
    await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await session.detach();
}

(async () => {
    const browser = await chromium.launch({ channel: process.env.BROWSER_CHANNEL || 'chrome', headless: true });
    const errors = [];
    const metrics = [];
    try {
        const context = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
        const page = await context.newPage();
        page.on('pageerror', error => errors.push(error.message));
        await page.route('https://fonts.googleapis.com/**', route => route.abort());
        await page.goto(base);
        await page.waitForFunction(() => typeof socket !== 'undefined' && socket.connected && cachedGameList);
        await page.evaluate(() => socket.emit('room:create', { name: 'Tucano UI QA', game_type: 'tucano' }));
        await page.waitForFunction(() => currentGameType === 'tucano' && isGameAssetsLoaded('tucano'));
        await page.evaluate(() => socket.emit('room:add_bot', { room_id: roomId }));
        await page.waitForFunction(() => currentRoomState.players.length === 2);
        await page.evaluate(() => socket.emit('room:ready', { room_id: roomId, ready: true }));
        await page.waitForFunction(() => !document.getElementById('startBtn').disabled);
        await page.locator('#startBtn').click();
        await page.waitForFunction(() => lastGameStatePayload?.game_type === 'tucano');
        const identity = await page.evaluate(() => ({ roomId, playerId }));
        await page.reload();
        await page.waitForFunction(() => isGameAssetsLoaded('tucano') && lastGameStatePayload?.game_type === 'tucano');
        assert.deepEqual(await page.evaluate(() => ({ roomId, playerId })), identity);
        assert.equal(await page.locator('#tucanoPanel').isVisible(), true);
        await page.evaluate(() => {
            currentRoomState.status = 'in_game';
            setRoomControlsCollapsed(true);
            window.tucanoTestActions = [];
            sendAction = action => tucanoTestActions.push(action);
        });

        for (const width of [320, 390, 1024, 1440]) {
            await page.setViewportSize({ width, height: width < 600 ? 844 : 1000 });
            for (const state of ['opening', 'draft', 'waiting', 'spectator', 'multiple', 'skip', 'empty', 'finished']) {
                await render(page, state);
                const result = await checkLayout(page, `${width}/${state}`);
                if (state === 'draft') {
                    metrics.push({ width, height: result.height });
                    if (width < 600) assert(result.height < 850, `${width}: mobile board is too tall (${result.height}px)`);
                    await page.locator('#tucanoPanel').screenshot({ path: `${output}/board-${width}.png` });
                }
            }
            await render(page, 'draft');
            await page.locator('.tucano-column-title').first().click();
            assert.equal(await page.locator('.tucano-column-confirm').count(), 1);
            await checkLayout(page, `${width}/confirmation`);
            await page.locator('.tucano-column-cancel-btn').click();
            await page.locator('.tucano-column-title').first().click();
            await page.locator('.tucano-column-confirm-btn').click();
            assert.deepEqual(await page.evaluate(() => tucanoTestActions.splice(0)), [{ type: 'draft_column', column: 0 }]);

            await render(page, 'give');
            await tap(page, page.locator('.tucano-player-card.self .tucano-fruit-card').first());
            assert.equal(await page.locator('.tucano-target-btn').count(), 3);
            await checkLayout(page, `${width}/give-targets`);
            if (width < 600) {
                assert.equal(await page.evaluate(() => {
                    const notice = document.getElementById('tucanoNotice').getBoundingClientRect();
                    const collections = document.querySelector('.tucano-collections').getBoundingClientRect();
                    const market = document.querySelector('.tucano-market').getBoundingClientRect();
                    return collections.bottom < market.top && collections.bottom - notice.top < innerHeight - 100;
                }), true, `${width}: toucan decisions must stay together`);
            }
            await page.locator('.tucano-target-btn').first().click();
            assert.deepEqual(await page.evaluate(() => tucanoTestActions.splice(0)), [{ type: 'resolve_toucan', toucan_index: 0, fruit: 'papaya', target_player: 'p1' }]);

            await render(page, 'draft');
            await page.locator('#tucanoHelpBtn').click();
            assert.equal(await page.locator('#tucanoHelpModal').isVisible(), true);
            assert.equal(await page.locator('#tucanoHelpModal').evaluate(element => {
                const content = element.querySelector('.modal-content').getBoundingClientRect();
                const body = element.querySelector('.modal-body');
                return content.left >= 0 && content.right <= innerWidth && content.top >= 0 && content.bottom <= innerHeight && body.scrollWidth <= body.clientWidth;
            }), true);
            await page.keyboard.press('Escape');
            assert.equal(await page.locator('#tucanoHelpModal').isVisible(), false);
            await page.locator('#tucanoExplainBtn').click();
            await tap(page, page.locator('.tucano-player-card.self .tucano-fruit-card').first());
            assert.equal(await page.locator('#tucanoExplainModal').isVisible(), true);
            assert.equal(await page.evaluate(() => tucanoTestActions.length), 0);
            await page.keyboard.press('Escape');
        }

        await page.setViewportSize({ width: 320, height: 844 });
        await render(page, 'draft');
        await page.locator('.tucano-column-title').first().click();
        await page.locator('#tucanoMarketTitle').click();
        assert.equal(await page.locator('.tucano-column-confirm').count(), 0);
        await page.locator('.tucano-column-title').first().click();
        await page.keyboard.press('Escape');
        assert.equal(await page.locator('.tucano-column-confirm').count(), 0);

        const secondPile = page.locator('.tucano-column').nth(1);
        await secondPile.locator('.tucano-pile-scroll-right').click();
        await page.waitForFunction(() => document.querySelectorAll('.tucano-card-list')[1].scrollLeft > 50);
        const pileScroll = await secondPile.locator('.tucano-card-list').evaluate(element => element.scrollLeft);
        assert.equal(await page.locator('.tucano-column-confirm').count(), 0);
        await secondPile.locator('.tucano-column-title').click();
        assert(await page.locator('.tucano-column').nth(1).locator('.tucano-card-list').evaluate(element => element.scrollLeft) >= pileScroll);
        await page.keyboard.press('Escape');
        await swipe(page, '.tucano-column .tucano-card-list', false);
        assert.equal(await page.locator('.tucano-column-confirm').count(), 0);

        await page.locator('#tucanoExplainBtn').click();
        await swipe(page, '.self .tucano-fruit-grid', true);
        assert.equal(await page.locator('#tucanoExplainModal').isVisible(), false);
        assert.equal(await page.locator('#tucanoExplainBtn').getAttribute('aria-pressed'), 'true');
        await tap(page, page.locator('#tucanoDeck'));
        assert.equal(await page.locator('#tucanoExplainModal').isVisible(), true);
        await page.keyboard.press('Escape');

        await render(page, 'give');
        await swipe(page, '.self .tucano-fruit-grid', true);
        assert.equal(await page.locator('.tucano-fruit-card.selected').count(), 0);
        assert.equal(await page.locator('.tucano-target-btn').count(), 0);
        assert(await page.locator('.self .tucano-fruit-grid').evaluate(element => element.scrollLeft) > 0);
        const collection = page.locator('.self .tucano-fruit-grid');
        await collection.evaluate(element => { element.scrollLeft = element.scrollWidth - element.clientWidth; });
        const collectionScroll = await collection.evaluate(element => element.scrollLeft);
        await tap(page, page.locator('.self .tucano-fruit-card').last());
        assert.equal(await page.locator('.self .tucano-fruit-grid').evaluate(element => element.scrollLeft), collectionScroll);
        await page.locator('.self .tucano-score-details > summary').click();
        assert.equal(await page.locator('.self .tucano-score-details').getAttribute('open'), '');
        await tap(page, page.locator('.self .tucano-fruit-card').last());
        assert.equal(await page.locator('.self .tucano-score-details').getAttribute('open'), '');

        await render(page, 'steal');
        await tap(page, page.locator('.tucano-player-card').nth(1).locator('.tucano-fruit-card').first());
        assert.equal(await page.evaluate(() => tucanoTestActions.splice(0)[0].type), 'resolve_toucan');
        await render(page, 'multiple');
        await page.locator('.tucano-toucan-choice').nth(2).click();
        await checkLayout(page, '320/multiple-selected');
        await page.locator('#tucanoFlipBtn').click();
        assert.deepEqual(await page.evaluate(() => tucanoTestActions.splice(0)), [{ type: 'resolve_toucan', toucan_index: 2 }]);
        await render(page, 'skip');
        await page.locator('#tucanoSkipBtn').click();
        assert.deepEqual(await page.evaluate(() => tucanoTestActions.splice(0)), [{ type: 'skip_toucan', toucan_index: 0 }]);

        await render(page, 'draft');
        await tap(page, page.locator('#tucanoDeck'));
        assert.equal(await page.locator('#tucanoTooltip').isVisible(), true);
        assert.match(await page.locator('#tucanoTooltip').textContent(), /Deck/);
        await tap(page, page.locator('#tucanoPhase'));
        assert.match(await page.locator('#tucanoTooltip').textContent(), /Phase/);
        await page.waitForFunction(() => document.getElementById('tucanoTooltip').classList.contains('hidden'), null, { timeout: 4000 });
        await tap(page, page.locator('.self .tucano-fruit-card').first());
        assert.equal(await page.locator('#tucanoTooltip').isVisible(), true);
        await tap(page, page.locator('.tucano-column-title').first());
        assert.equal(await page.locator('#tucanoTooltip').isVisible(), false);
        assert.equal(await page.locator('.tucano-column-confirm').count(), 1);

        await render(page, 'draft');
        await page.setViewportSize({ width: 1440, height: 1000 });
        await page.locator('.self .tucano-fruit-card').first().hover();
        assert.equal(await page.locator('#tucanoTooltip').isVisible(), true);
        await page.locator('#tucanoHelpBtn').click();
        await page.keyboard.press('Escape');
        await page.evaluate(() => setRoomControlsCollapsed(false));
        await checkLayout(page, '1440/RC-expanded');
        await page.evaluate(() => setRoomControlsCollapsed(true));
        await page.setViewportSize({ width: 390, height: 844 });
        await render(page, 'draft');
        await page.evaluate(() => setRoomControlsCollapsed(false));
        assert.equal(await page.locator('#roomControlsPanel').isVisible(), true);
        await page.evaluate(() => setRoomControlsCollapsed(true));
        for (const width of [320, 390]) {
            await page.setViewportSize({ width, height: 844 });
            await render(page, 'draft');
            await page.evaluate(() => {
                window.tucanoTestFontSizes = [...document.querySelectorAll('#tucanoPanel, #tucanoPanel *')].map(element => ({
                    element, original: element.style.fontSize, enlarged: parseFloat(getComputedStyle(element).fontSize) * 1.25,
                }));
                tucanoTestFontSizes.forEach(({ element, enlarged }) => { element.style.fontSize = `${enlarged}px`; });
            });
            await checkLayout(page, `${width}/enlarged-text`);
            await page.evaluate(() => {
                tucanoTestFontSizes.forEach(({ element, original }) => { element.style.fontSize = original; });
                delete window.tucanoTestFontSizes;
            });
        }
        await page.setViewportSize({ width: 390, height: 844 });
        await render(page, 'draft');
        await page.evaluate(() => window.scrollTo(0, 0));
        await page.screenshot({ path: `${output}/mobile-390.png` });

        const desktopContext = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
        const desktop = await desktopContext.newPage();
        desktop.on('pageerror', error => errors.push(error.message));
        await desktop.route('https://fonts.googleapis.com/**', route => route.abort());
        await desktop.goto(base);
        await desktop.waitForFunction(() => typeof socket !== 'undefined' && socket.connected && cachedGameList);
        await desktop.evaluate(() => socket.emit('room:create', { name: 'Tucano desktop QA', game_type: 'tucano' }));
        await desktop.waitForFunction(() => currentGameType === 'tucano' && isGameAssetsLoaded('tucano'));
        await desktop.evaluate(() => {
            setRoomControlsCollapsed(true);
            window.tucanoTestActions = [];
            sendAction = action => tucanoTestActions.push(action);
        });
        for (const width of [1024, 1440]) {
            await desktop.setViewportSize({ width, height: 1000 });
            for (const state of ['draft', 'waiting', 'give', 'steal', 'multiple', 'finished']) {
                await render(desktop, state);
                await checkLayout(desktop, `desktop-${width}/${state}`);
            }
            await render(desktop, 'draft');
            await desktop.locator('.self .tucano-fruit-card').first().hover();
            assert.equal(await desktop.locator('#tucanoTooltip').isVisible(), true);
            await desktop.locator('#tucanoExplainBtn').click();
            const disabledFruit = desktop.locator('.self .tucano-fruit-card').first();
            await disabledFruit.scrollIntoViewIfNeeded();
            const bounds = await disabledFruit.boundingBox();
            await desktop.mouse.click(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2);
            assert.equal(await desktop.locator('#tucanoExplainModal').isVisible(), true);
            assert.equal(await desktop.evaluate(() => tucanoTestActions.length), 0);
            await desktop.keyboard.press('Escape');
            await desktop.locator('.game-panel').screenshot({ path: `${output}/desktop-${width}.png` });
        }
        assert.deepEqual(errors, []);
        fs.writeFileSync(`${output}/results.json`, JSON.stringify({ metrics, errors }, null, 2));
        console.log(JSON.stringify({ metrics, errors }, null, 2));
    } finally {
        await browser.close();
    }
})().catch(error => { console.error(error); process.exitCode = 1; });
