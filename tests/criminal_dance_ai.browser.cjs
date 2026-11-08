const {chromium} = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const base = process.env.ROOM_TEST_URL || 'http://127.0.0.1:8789';
const output = path.resolve('tmp/criminal-dance-ai');

(async () => {
    const browser = await chromium.launch({channel: 'chrome', headless: true});
    const errors = [];
    fs.mkdirSync(output, {recursive: true});
    try {
        for (const width of [320, 390, 1024, 1440]) {
            const context = await browser.newContext({viewport: {width, height: 1000}, hasTouch: width < 700, isMobile: width < 700});
            const page = await context.newPage();
            page.setDefaultTimeout(12000);
            page.on('pageerror', error => errors.push(error.message));
            await page.route('https://fonts.googleapis.com/**', route => route.abort());
            await page.goto(base);
            await page.waitForFunction(() => typeof socket !== 'undefined' && socket.connected && cachedGameList);
            await page.evaluate(() => socket.emit('room:create', {name: 'Criminal AI QA', game_type: 'criminal_dance'}));
            await page.waitForFunction(() => roomSessionReady && currentGameType === 'criminal_dance' && isGameAssetsLoaded('criminal_dance'));
            assert.equal(await page.evaluate(() => cachedGameList.find(game => game.game_id === 'criminal_dance').has_strategic_ai), true);
            await page.evaluate(() => {
                window.criminalDanceQaActions = [];
                window.sendAction = action => window.criminalDanceQaActions.push(action);
                const players = [
                    {player_id: playerId, name: 'You', seat: 0, score: 0, hand_count: 2, hand: [], is_accomplice: false, private_log: [], private_clues: [], you: true},
                    {player_id: 'qa-bot-1', name: 'Bot 1', seat: 1, score: 0, hand_count: 0, hand: [], is_accomplice: false, private_log: [], private_clues: [], you: false},
                    {player_id: 'qa-bot-2', name: 'Bot 2', seat: 2, score: 0, hand_count: 0, hand: [], is_accomplice: false, private_log: [], private_clues: [], you: false},
                ];
                renderRoomState({...currentRoomState, status: 'in_game', players: players.map(player => ({...player, is_bot: !player.you, ready: true, connected: true}))});
                setRoomControlsCollapsed(true);
                window.criminalDanceQaView = {
                    game_id: 'criminal_dance', you: playerId, round_number: 1,
                    current_player_id: playerId, current_player_name: 'You', players,
                    discard: [], played: [], winner_ids: [], game_over: false, match_over: false,
                    last_summary: '', round_ready_player_ids: [], round_waiting_player_ids: [], legal_actions: ['play_card'],
                    config: {enable_boy: true, enable_chief: false, scoring_enabled: true, detective_activation_rule: 'always', dog_fail_behavior: 'give_to_target'},
                };
            });
            for (const cardType of ['dog', 'witness', 'trade']) {
                await page.evaluate(cardType => {
                    const view = window.criminalDanceQaView;
                    view.players[0].hand = [{id: 'qa-criminal', type: 'criminal'}, {id: `qa-${cardType}`, type: cardType}];
                    view.playable_cards = [view.players[0].hand[1]];
                    renderCriminalDanceGameState({room_id: roomId, game_type: 'criminal_dance', view, events: []});
                }, cardType);
                const card = page.locator(`#criminalDanceHand [data-card-id="qa-${cardType}"]`);
                assert.equal(await card.getAttribute('aria-disabled'), 'false');
                if (width < 700) await card.tap();
                else await card.click();
                const play = page.locator('#criminalDanceControls').getByRole('button', {name: 'Play Card', exact: true});
                assert.equal(await play.isEnabled(), true);
                assert.equal(await page.locator('#criminalDanceTarget').count(), 0);
                assert.equal(await page.locator('#criminalDanceTradeCard').count(), 0);
                assert.match(await page.locator('#criminalDanceControls').innerText(), /No other player has cards\. No effect\./);
                if (width < 700) await play.tap();
                else await play.click();
                assert.deepEqual(await page.evaluate(() => window.criminalDanceQaActions.at(-1)), {type: 'play_card', card_id: `qa-${cardType}`});
                assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
                assert.equal(await page.locator('#criminalDancePanel').evaluate(element => element.scrollWidth > element.clientWidth + 1), false);
            }
            await page.screenshot({path: path.join(output, `no-target-${width}.png`), fullPage: true});
            await page.evaluate(() => {
                const view = window.criminalDanceQaView;
                view.players[1].hand_count = 1;
                view.players[0].hand = [{id: 'qa-criminal', type: 'criminal'}, {id: 'qa-active-trade', type: 'trade'}];
                view.playable_cards = [view.players[0].hand[1]];
                renderCriminalDanceGameState({room_id: roomId, game_type: 'criminal_dance', view, events: []});
            });
            await page.locator('#criminalDanceHand [data-card-id="qa-active-trade"]').click();
            assert.equal(await page.locator('#criminalDanceTarget').inputValue(), 'qa-bot-1');
            assert.equal(await page.locator('#criminalDanceTarget option').count(), 1);
            assert.equal(await page.locator('#criminalDanceTradeCard').inputValue(), 'qa-criminal');
            await page.locator('#criminalDanceControls').getByRole('button', {name: 'Play Card', exact: true}).click();
            assert.deepEqual(await page.evaluate(() => window.criminalDanceQaActions.at(-1)), {
                type: 'play_card', card_id: 'qa-active-trade', target_player_id: 'qa-bot-1', your_card_id: 'qa-criminal',
            });
            await page.locator('#criminalDanceHelpBtn').click();
            assert.match(await page.locator('#criminalDanceHelpContent').innerText(), /everyone else has no cards/);
            await page.keyboard.press('Escape');
            assert.equal(await page.locator('#criminalDanceHelpModal').isVisible(), false);
            await page.evaluate(async () => { await socket.emitWithAck('room:leave', {room_id: roomId}); });
            await context.close();
            console.log(`PASS ${width}: no-target Dog/Witness/Trade, normal Trade, Help/Escape, no overflow`);
        }
        assert.deepEqual(errors, []);
    } finally {
        await browser.close();
    }
})().catch(error => {
    console.error(error);
    process.exitCode = 1;
});
