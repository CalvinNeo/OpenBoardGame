// Run against a local application: ROOM_TEST_URL and PLAYWRIGHT_MODULE may override defaults.
const {chromium} = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const base = process.env.ROOM_TEST_URL || 'http://127.0.0.1:8000';
const output = process.env.BOOMERANG_UI_OUT || 'tmp/task104/icon-ui';
const widths = (process.env.BOOMERANG_UI_WIDTHS || '1440,1024,390,320').split(',').map(Number);

(async () => {
    const browser = await chromium.launch({channel: 'chrome', headless: true});
    const context = await browser.newContext({viewport: {width: 1440, height: 950}, hasTouch: true});
    const page = await context.newPage();
    const errors = [];
    const report = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => { if (message.type() === 'error') errors.push('console: ' + message.text()); });
    await page.route('https://fonts.googleapis.com/**', route => route.fulfill({status: 200, contentType: 'text/css', body: ''}));
    fs.mkdirSync(output, {recursive: true});

    const view = () => page.evaluate(() => lastGameStatePayload?.view);
    const signature = () => page.evaluate(() => JSON.stringify(lastGameStatePayload?.view));
    const actionCount = () => page.evaluate(() => window.boomerangQaActions.length);
    async function act(action) {
        const before = await signature();
        if (action.type === 'draft_card') {
            await page.locator(`[data-boomerang-card="${action.card_id}"] .boomerang-card-place`).click();
            await page.locator('[data-boomerang-action="confirm"]').click();
        } else if (action.type === 'choose_activity') {
            if (action.activity) {
                await page.locator(`[data-boomerang-activity="${action.activity}"]`).click();
                await page.locator('[data-boomerang-action="confirm_activity"]').click();
            } else await page.locator('[data-boomerang-action="skip"]').click();
        } else await page.locator('[data-boomerang-action="next"]').click();
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
                    headerWrapped: false,
                };
                const headerActions = [...document.querySelectorAll('.game-panel[data-game-theme="boomerang_australia"] > .panel-header button')].filter(element => element.getBoundingClientRect().width > 0);
                out.headerWrapped = headerActions.some(element => Math.abs(element.getBoundingClientRect().top - headerActions[0].getBoundingClientRect().top) > 2);
                const describe = el => el.tagName.toLowerCase() + '.' + (el.className || '').toString().split(' ').filter(Boolean).slice(0, 2).join('.');
                panel.querySelectorAll('*').forEach(el => {
                    const style = getComputedStyle(el);
                    if (el.clientWidth > 0 && el.scrollWidth > el.clientWidth + 1) {
                        out.clipped.push({el: describe(el), axis: 'x', over: el.scrollWidth - el.clientWidth, text: (el.textContent || '').trim().slice(0, 40)});
                    }
                    if (el.clientHeight > 0 && el.scrollHeight > el.clientHeight + 1 && ['hidden', 'auto', 'scroll'].includes(style.overflowY) && !el.matches('.boomerang-opponents, .boomerang-log ul, .boomerang-score-history')) {
                        out.clipped.push({el: describe(el), axis: 'y', over: el.scrollHeight - el.clientHeight, text: (el.textContent || '').trim().slice(0, 40)});
                    }
                });
                const boxes = [...panel.querySelectorAll('.boomerang-hand > *, .boomerang-tableau > *, .boomerang-players > *, .boomerang-stamps > *, .boomerang-activity-grid > *, .boomerang-region-list > *, .boomerang-used-activities > *, .boomerang-round-results > *, .boomerang-history-round > div > *, .boomerang-card-icons > *, .boomerang-card-top > *, .boomerang-card-region > *, .boomerang-confirm-buttons > *, .boomerang-activity-confirm > *')];
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
        await page.evaluate(() => {
            window.boomerangQaActions = [];
            const original = sendAction;
            sendAction = action => { window.boomerangQaActions.push(action); original(action); };
        });
        await page.evaluate(() => socket.emit('room:create', {name: 'Boomerang 长玩家名称 QA', game_type: 'boomerang_australia', config: {seed: 4242}}));
        await page.waitForFunction(() => roomSessionReady && currentGameType === 'boomerang_australia');
        await page.waitForFunction(() => isGameAssetsLoaded('boomerang_australia'));
        for (const count of [2, 3, 4]) {
            await page.evaluate(() => socket.emit('room:add_bot', {room_id: roomId}));
            await page.waitForFunction(n => currentRoomState?.players?.length === n, count);
        }
        await page.evaluate(() => socket.emit('room:ready', {room_id: roomId, ready: true}));
        await page.waitForFunction(() => !document.getElementById('startBtn').disabled);
        await page.evaluate(() => socket.emit('room:start', {room_id: roomId}));
        await page.waitForFunction(() => lastGameStatePayload?.view?.game_id === 'boomerang_australia');
        await page.waitForTimeout(300);

        await audit('01-draft-pick1');
        assert.equal(await page.locator('.boomerang-info').count(), 0, 'no repeated info buttons');
        assert.equal(await page.locator('.boomerang-play-area.boomerang-box').count(), 0, 'board has no nested panel');
        const cultureTips = page.locator('.is-activity[data-boomerang-tip*="原住民文化"]');
        for (const text of await cultureTips.allTextContents()) assert.equal(text, '🎨', 'culture has its own icon');
        await page.locator('.boomerang-hand .boomerang-card-place').first().click();
        await audit('01-selected');
        assert.equal(await page.locator('.boomerang-hand-area [data-boomerang-action="confirm"]').count(), 1, 'confirm stays within the hand');
        await page.locator('[data-boomerang-action="cancel"]').click();
        assert.equal(await page.locator('.boomerang-hand-confirm').count(), 0, 'cancel dismisses the selection');
        const firstCard = page.locator('.boomerang-hand .boomerang-card').first();
        await firstCard.focus();
        await page.keyboard.press('Enter');
        assert.equal(await page.locator('[data-boomerang-action="confirm"]').evaluate(element => element === document.activeElement), true, 'keyboard selection focuses Confirm');
        await page.keyboard.press('Escape');
        assert.equal(await firstCard.evaluate(element => element === document.activeElement), true, 'cancel returns focus to card');
        await page.setViewportSize({width: 390, height: 950});
        await firstCard.scrollIntoViewIfNeeded();
        const touchBounds = await firstCard.boundingBox();
        const touchClient = await context.newCDPSession(page);
        const touchX = touchBounds.x + touchBounds.width / 2;
        const touchY = touchBounds.y + touchBounds.height / 2;
        const beforeScroll = await actionCount();
        await touchClient.send('Input.dispatchTouchEvent', {type: 'touchStart', touchPoints: [{x: touchX, y: touchY}]});
        for (const offset of [15, 30, 50, 70]) await touchClient.send('Input.dispatchTouchEvent', {type: 'touchMove', touchPoints: [{x: touchX, y: touchY - offset}]});
        await touchClient.send('Input.dispatchTouchEvent', {type: 'touchEnd', touchPoints: []});
        await page.waitForTimeout(300);
        assert.equal(await page.locator('.boomerang-hand-confirm').count(), 0, 'touch scrolling never selects');
        assert.equal(await actionCount(), beforeScroll, 'touch scrolling never submits');
        await firstCard.locator('.boomerang-card-place').click();
        await page.locator('.boomerang-step').click();
        assert.equal(await page.locator('.boomerang-hand-confirm').count(), 0, 'empty space cancels');
        await until(v => v.phase === 'draft' && v.pick >= 3 && v.legal_actions.includes('draft_card'), 'pick3');
        await audit('02-draft-pick3');
        await until(v => v.phase === 'choose_activity' && v.legal_actions.includes('choose_activity'), 'choose_activity');
        await audit('03-choose-activity');
        assert.match(await page.locator('[data-boomerang-activity="culture"]').innerText(), /🎨/);
        const beforeActivity = await actionCount();
        await page.locator('[data-boomerang-activity="culture"]').click();
        await audit('03-activity-selected');
        await page.keyboard.press('Escape');
        assert.equal(await actionCount(), beforeActivity, 'activity selection does not submit');
        await until(v => v.phase === 'round_end' && v.legal_actions.includes('next_round'), 'round_end');
        await audit('04-round-end');
        const reviewedRound = (await view()).round;
        const reviewedRoom = await page.evaluate(() => roomId);
        await page.waitForTimeout(1000);
        assert.equal((await view()).phase, 'round_end', 'bots do not skip the human review');
        await page.reload();
        await page.waitForFunction(expectedRoom => roomSessionReady && roomId === expectedRoom && lastGameStatePayload?.view?.phase === 'round_end', reviewedRoom);
        assert.equal((await view()).round, reviewedRound, 'reload preserves review');
        await page.evaluate(() => {
            const original = sendAction;
            window.boomerangQaActions = [];
            sendAction = action => { window.boomerangQaActions.push(action); original(action); };
        });
        await until(v => v.round === 2 && v.phase === 'draft' && v.legal_actions.includes('draft_card'), 'round2');
        await audit('05-round2-draft');

        await page.setViewportSize({width: 390, height: 950});
        await page.waitForTimeout(200);
        // Selecting a card, then cancelling with Escape.
        await page.locator('#boomerangAustraliaPanel .boomerang-hand .boomerang-card-place').first().click();
        await page.waitForTimeout(200);
        assert.equal(await page.locator('#boomerangAustraliaPanel .boomerang-card.is-selected').count(), 1, 'card selection');
        await page.screenshot({path: output + '/06-selected-390.png', fullPage: true});
        await page.keyboard.press('Escape');
        await page.waitForTimeout(150);
        assert.equal(await page.locator('#boomerangAustraliaPanel .boomerang-card.is-selected').count(), 0, 'escape cancels selection');

        // Help dialog opens and closes with Escape.
        await page.locator('#boomerangAustraliaHelpBtn').click();
        await page.locator('#boomerangAustraliaDialog[open]').waitFor();
        await page.locator('[data-boomerang-language="en"]').click();
        assert.match(await page.locator('.boomerang-help-content').innerText(), /Aboriginal culture\(🎨\)/);
        for (const section of ['scoring', 'details', 'basics']) {
            await page.locator(`[data-boomerang-section="${section}"]`).click();
            assert.equal(await page.locator(`[data-boomerang-section="${section}"]`).getAttribute('aria-pressed'), 'true');
        }
        await page.locator('[data-boomerang-language="zh"]').click();
        for (const width of widths) {
            await page.setViewportSize({width, height: 950});
            assert.equal(await page.locator('#boomerangAustraliaDialog').evaluate(element => element.scrollWidth > element.clientWidth + 1), false, 'Help stays within the viewport');
            await page.screenshot({path: `${output}/07-help-${width}.png`});
        }
        await page.setViewportSize({width: 390, height: 950});
        await page.screenshot({path: output + '/07-help-390.png'});
        await page.keyboard.press('Escape');
        await page.waitForTimeout(150);

        assert.equal(await page.locator('#boomerangAustraliaDialog').evaluate(el => el.open), false, 'escape closes help');

        const beforeCardExplain = await actionCount();
        const explainedCard = (await view()).hand[0];
        await page.locator('#boomerangAustraliaExplainBtn').click();
        await page.locator(`[data-boomerang-card="${explainedCard.id}"] .boomerang-card-place`).click();
        await page.locator('#boomerangAustraliaDialog[open]').waitFor();
        assert.match(await page.locator('.boomerang-dialog-body').innerText(), new RegExp(explainedCard.name_zh));
        assert.equal(await actionCount(), beforeCardExplain, 'card Explain does not act');
        await page.keyboard.press('Escape');

        await until(v => v.phase === 'choose_activity' && v.legal_actions.includes('choose_activity'), 'second activity');
        await page.locator('#boomerangAustraliaExplainBtn').click();
        await page.waitForTimeout(200);
        assert.equal(await page.locator('#boomerangAustraliaPanel.is-explaining').count(), 1, 'explain mode on');
        await page.screenshot({path: output + '/08-explain-390.png', fullPage: true});
        const beforeExplain = await actionCount();
        const disabledBox = await page.locator('#boomerangAustraliaPanel button:disabled[data-boomerang-explain]').first().boundingBox();
        assert.ok(disabledBox, 'a disabled explainable control exists');
        await page.mouse.click(disabledBox.x + disabledBox.width / 2, disabledBox.y + disabledBox.height / 2);
        await page.locator('#boomerangAustraliaDialog[open]').waitFor();
        assert.equal(await actionCount(), beforeExplain, 'explain does not act');
        assert.equal(await page.locator('#boomerangAustraliaPanel.is-explaining').count(), 0, 'explain exits after use');
        await page.keyboard.press('Escape');
        await page.waitForTimeout(150);

        await page.setViewportSize({width: 390, height: 950});
        const firstTip = page.locator('.boomerang-used-activities > span').first();
        const secondTip = page.locator('.boomerang-used-activities > span').nth(1);
        const beforeTip = await actionCount();
        await firstTip.tap();
        assert.equal(await page.locator('.boomerang-tip').evaluate(element => !element.hidden), true, 'touch tooltip');
        await secondTip.tap();
        assert.equal(await page.locator('.boomerang-tip').innerText(), await secondTip.getAttribute('data-boomerang-tip'), 'latest touch tooltip wins');
        await page.waitForTimeout(3200);
        assert.equal(await page.locator('.boomerang-tip').evaluate(element => element.hidden), true, 'touch tooltip expires');
        assert.equal(await actionCount(), beforeTip, 'tips never submit');

        // Desktop hover shows a tooltip for a non-interactive icon.
        await page.setViewportSize({width: 1440, height: 950});
        await page.waitForTimeout(200);
        await page.locator('#boomerangAustraliaPanel .boomerang-symbol').first().hover();
        await page.waitForTimeout(200);
        assert.equal(await page.locator('.boomerang-tip').evaluate(el => !el.hidden), true, 'hover tooltip');
        await page.mouse.move(5, 5);
        await page.waitForTimeout(150);

        const skippedRound = (await view()).round;
        await page.locator('[data-boomerang-action="skip"]').click();
        await page.waitForFunction(round => lastGameStatePayload?.view?.round === round && lastGameStatePayload.view.phase === 'round_end', skippedRound);
        const skippedView = await view();
        assert.equal(skippedView.round_summary.find(score => score.player_id === skippedView.you)?.activity, null, 'Skip records no activity');

        await until(v => v.game_over === true, 'game_over');
        await audit('09-game-over');

        fs.writeFileSync(output + '/report.json', JSON.stringify({report, errors}, null, 2));
        const problems = report.filter(item => item.pageOverflow || item.panelOverflow || item.headerWrapped || item.clipped.length || item.overlaps.length);
        console.log(JSON.stringify({states: report.length, problems, errors}, null, 2));
        assert.equal(problems.length, 0, 'all layout audits pass');
        assert.deepEqual(errors, [], 'no browser errors');
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
