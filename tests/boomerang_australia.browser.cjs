// Run against a local application: ROOM_TEST_URL and PLAYWRIGHT_MODULE may override defaults.
const {chromium} = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const base = process.env.ROOM_TEST_URL || 'http://127.0.0.1:8000';
const output = process.env.BOOMERANG_UI_OUT || 'build/boomerang-australia-ui';
const widths = (process.env.BOOMERANG_UI_WIDTHS || '1440,1024,390,320').split(',').map(Number);

(async () => {
    const browser = await chromium.launch({channel: 'chrome', headless: true});
    const context = await browser.newContext({viewport: {width: 1440, height: 950}});
    const page = await context.newPage();
    const errors = [];
    const report = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => { if (message.type() === 'error') errors.push('console: ' + message.text()); });
    await page.route('https://fonts.googleapis.com/**', route => route.abort());
    fs.mkdirSync(output, {recursive: true});

    const view = () => page.evaluate(() => lastGameStatePayload?.view);
    const signature = () => page.evaluate(() => JSON.stringify(lastGameStatePayload?.view));
    async function act(action) {
        const before = await signature();
        await page.evaluate(a => sendAction(a), action);
        await page.waitForFunction(prev => JSON.stringify(lastGameStatePayload?.view) !== prev, before, {timeout: 20000});
        await page.waitForTimeout(120);
    }
    async function step(current) {
        if (current.legal_actions.includes('draft_card')) return act({type: 'draft_card', card_id: current.hand[0].id, round: current.round, pick: current.pick});
        if (current.legal_actions.includes('choose_activity')) {
            const option = (current.activity_options || []).find(item => !item.used);
            return act({type: 'choose_activity', activity: option ? option.id : null, round: current.round});
        }
        if (current.legal_actions.includes('next_round')) return act({type: 'next_round', round: current.round});
        await page.waitForTimeout(350);
    }
    async function until(predicate, label) {
        for (let guard = 0; guard < 400; guard++) {
            const current = await view();
            if (predicate(current)) return current;
            await step(current);
        }
        throw new Error('until timeout: ' + label);
    }
    async function audit(name) {
        for (const width of widths) {
            await page.setViewportSize({width, height: 950});
            await page.waitForTimeout(200);
            const metrics = await page.evaluate(() => {
                const panel = document.getElementById('boomerangAustraliaPanel');
                const out = {
                    pageOverflow: document.documentElement.scrollWidth > window.innerWidth + 1,
                    panelOverflow: panel.scrollWidth > panel.clientWidth + 1,
                    clipped: [],
                    overlaps: [],
                    pageHeight: document.documentElement.scrollHeight,
                };
                const describe = el => el.tagName.toLowerCase() + '.' + (el.className || '').toString().split(' ').filter(Boolean).slice(0, 2).join('.');
                panel.querySelectorAll('*').forEach(el => {
                    const style = getComputedStyle(el);
                    if (el.clientWidth > 0 && el.scrollWidth > el.clientWidth + 1) {
                        out.clipped.push({el: describe(el), axis: 'x', over: el.scrollWidth - el.clientWidth, text: (el.textContent || '').trim().slice(0, 40)});
                    }
                    if (el.clientHeight > 0 && el.scrollHeight > el.clientHeight + 1 && ['hidden', 'auto', 'scroll'].includes(style.overflowY)) {
                        out.clipped.push({el: describe(el), axis: 'y', over: el.scrollHeight - el.clientHeight, text: (el.textContent || '').trim().slice(0, 40)});
                    }
                });
                const boxes = [...panel.querySelectorAll('.boomerang-hand > *, .boomerang-tableau > *, .boomerang-players > *, .boomerang-stamps > *, .boomerang-activity-grid > *, .boomerang-region-list > *, .boomerang-used-activities > *, .boomerang-round-results > *, .boomerang-history-round > div > *')];
                for (let i = 0; i < boxes.length; i++) {
                    for (let j = i + 1; j < boxes.length; j++) {
                        if (boxes[i].parentElement !== boxes[j].parentElement) continue;
                        const a = boxes[i].getBoundingClientRect(), b = boxes[j].getBoundingClientRect();
                        const ox = Math.min(a.right, b.right) - Math.max(a.left, b.left);
                        const oy = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
                        if (ox > 1 && oy > 1) out.overlaps.push({a: describe(boxes[i]), b: describe(boxes[j]), ox: Math.round(ox), oy: Math.round(oy)});
                    }
                }
                return out;
            });
            report.push({name, width, ...metrics});
            await page.screenshot({path: output + '/' + name + '-' + width + '.png', fullPage: true});
        }
        await page.setViewportSize({width: 1440, height: 950});
        await page.waitForTimeout(150);
    }

    try {
        await page.goto(base);
        await page.waitForFunction(() => typeof socket !== 'undefined' && socket.connected && cachedGameList);
        await page.evaluate(() => socket.emit('room:create', {name: 'Boomerang QA', game_type: 'boomerang_australia', config: {seed: 4242}}));
        await page.waitForFunction(() => roomSessionReady && currentGameType === 'boomerang_australia');
        await page.waitForFunction(() => isGameAssetsLoaded('boomerang_australia'));
        for (const count of [2, 3]) {
            await page.evaluate(() => socket.emit('room:add_bot', {room_id: roomId}));
            await page.waitForFunction(n => currentRoomState?.players?.length === n, count);
        }
        await page.evaluate(() => socket.emit('room:ready', {room_id: roomId, ready: true}));
        await page.waitForFunction(() => !document.getElementById('startBtn').disabled);
        await page.evaluate(() => socket.emit('room:start', {room_id: roomId}));
        await page.waitForFunction(() => lastGameStatePayload?.view?.game_id === 'boomerang_australia');
        await page.waitForTimeout(300);

        await audit('01-draft-pick1');
        await until(v => v.phase === 'draft' && v.pick >= 3 && v.legal_actions.includes('draft_card'), 'pick3');
        await audit('02-draft-pick3');
        await until(v => v.phase === 'choose_activity' && v.legal_actions.includes('choose_activity'), 'choose_activity');
        await audit('03-choose-activity');
        await until(v => v.phase === 'round_end' && v.legal_actions.includes('next_round'), 'round_end');
        await audit('04-round-end');
        await until(v => v.round === 2 && v.phase === 'draft' && v.legal_actions.includes('draft_card'), 'round2');
        await audit('05-round2-draft');

        await page.setViewportSize({width: 390, height: 950});
        await page.waitForTimeout(200);
        // Selecting a card, then cancelling with Escape.
        await page.locator('#boomerangAustraliaPanel .boomerang-hand .boomerang-card').first().click();
        await page.waitForTimeout(200);
        assert.equal(await page.locator('#boomerangAustraliaPanel .boomerang-card.is-selected').count(), 1, 'card selection');
        await page.screenshot({path: output + '/06-selected-390.png', fullPage: true});
        await page.keyboard.press('Escape');
        await page.waitForTimeout(150);
        assert.equal(await page.locator('#boomerangAustraliaPanel .boomerang-card.is-selected').count(), 0, 'escape cancels selection');

        // Help dialog opens and closes with Escape.
        await page.locator('#boomerangAustraliaHelpBtn').click();
        await page.locator('#boomerangAustraliaDialog[open]').waitFor();
        await page.screenshot({path: output + '/07-help-390.png'});
        await page.keyboard.press('Escape');
        await page.waitForTimeout(150);
        assert.equal(await page.locator('#boomerangAustraliaDialog').evaluate(el => el.open), false, 'escape closes help');

        // Explain mode highlights targets and explains a disabled control without acting.
        await page.locator('#boomerangAustraliaExplainBtn').click();
        await page.waitForTimeout(200);
        assert.equal(await page.locator('#boomerangAustraliaPanel.is-explaining').count(), 1, 'explain mode on');
        await page.screenshot({path: output + '/08-explain-390.png', fullPage: true});
        const beforeExplain = await signature();
        const disabledBox = await page.locator('#boomerangAustraliaPanel button:disabled[data-boomerang-explain]').first().boundingBox();
        assert.ok(disabledBox, 'a disabled explainable control exists');
        await page.mouse.click(disabledBox.x + disabledBox.width / 2, disabledBox.y + disabledBox.height / 2);
        await page.locator('#boomerangAustraliaDialog[open]').waitFor();
        assert.equal(await signature(), beforeExplain, 'explain does not act');
        assert.equal(await page.locator('#boomerangAustraliaPanel.is-explaining').count(), 0, 'explain exits after use');
        await page.keyboard.press('Escape');
        await page.waitForTimeout(150);

        // Desktop hover shows a tooltip for a non-interactive icon.
        await page.setViewportSize({width: 1440, height: 950});
        await page.waitForTimeout(200);
        await page.locator('#boomerangAustraliaPanel .boomerang-symbol').first().hover();
        await page.waitForTimeout(200);
        assert.equal(await page.locator('.boomerang-tip').evaluate(el => !el.hidden), true, 'hover tooltip');
        await page.mouse.move(5, 5);
        await page.waitForTimeout(150);

        await until(v => v.game_over === true, 'game_over');
        await audit('09-game-over');

        fs.writeFileSync(output + '/report.json', JSON.stringify({report, errors}, null, 2));
        const problems = report.filter(item => item.pageOverflow || item.panelOverflow || item.clipped.length || item.overlaps.length);
        console.log(JSON.stringify({states: report.length, problems, errors}, null, 2));
    } catch (error) {
        console.error('FAILED', error.message);
        await page.screenshot({path: output + '/failure.png', fullPage: true}).catch(() => {});
        fs.writeFileSync(output + '/report.json', JSON.stringify({report, errors}, null, 2));
        console.error(JSON.stringify({report, errors}, null, 2));
        process.exitCode = 1;
    } finally {
        await browser.close();
    }
})();
