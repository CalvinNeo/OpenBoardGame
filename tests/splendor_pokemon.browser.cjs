const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { execFileSync } = require('node:child_process');

const base = process.env.ROOM_TEST_URL || 'http://127.0.0.1:8766';
const output = process.env.POKEMON_SPLENDOR_OUTPUT || 'tmp/splendor-pokemon-ui';
fs.mkdirSync(output, { recursive: true });
const fixtures = JSON.parse(execFileSync(process.env.PYTHON || 'python3', ['-c', `
import copy,json,random
from game.splendor_pokemon import PokemonSplendorGame as Game,_clone_card
from game.pokemon_splendor_data import TIER_DECKS,REGULAR_COLORS,TOKEN_COLORS
random.seed(38)
roster=[{'player_id':f'p{index}','name':['Trainer','River','Clover','Nova'][index],'seat':index,'is_bot':False} for index in range(4)]
state=Game.init_game({},roster)
state['current_turn']='p0'
state['starting_player']='p0'
state['turn_order']=['p0','p1','p2','p3']
for tier in ('lv1','lv2','lv3'):
 state['market'][tier]=[_clone_card(card) for card in TIER_DECKS[tier][:4]]
state['players']['p0']['tokens']={color:1 for color in TOKEN_COLORS}
state['players']['p0']['bonuses']={color:5 for color in REGULAR_COLORS}
state['players']['p0']['reserved']=[_clone_card(TIER_DECKS['lv2'][4])]
state['players']['p0']['captured']=[_clone_card(card) for card in TIER_DECKS['lv1'][5:9]]
state['players']['p1']['captured']=[_clone_card(card) for card in TIER_DECKS['lv1'][9:16]]
state['players']['p1']['score']=6
views={'turn':Game.get_public_view(state,'p0')}
crowded=copy.deepcopy(state)
crowded['player_meta']['p0']['name']='VeryLongUnbrokenTrainerName训练家用于检查布局'
crowded['player_meta']['p1']['name']='AnotherExtremelyLongPlayerNameWithoutSpaces'
crowded['players']['p0']['captured']=[_clone_card(card) for card in TIER_DECKS['lv1'][:24]]
views['crowded']=Game.get_public_view(crowded,'p0')
excess=copy.deepcopy(state)
excess['players']['p0']['tokens']={color:(2 if color!='purple' else 0) for color in TOKEN_COLORS}
views['limit']=Game.get_public_view(excess,'p0')
discard=copy.deepcopy(excess)
discard['phase']='discard_tokens'
discard['players']['p0']['tokens']['purple']=2
views['discard']=Game.get_public_view(discard,'p0')
base_card=next(card for card in TIER_DECKS['lv1'] if card['name_en']=='Bulbasaur')
target_card=next(card for card in TIER_DECKS['lv2'] if card['name_en']=='Ivysaur')
evolution=copy.deepcopy(state)
evolution['phase']='evolution'
evolution['players']['p0']['captured']=[_clone_card(base_card)]
evolution['market']['lv2'][0]=_clone_card(target_card)
views['evolution']=Game.get_public_view(evolution,'p0')
reserved_evolution=copy.deepcopy(evolution)
reserved_evolution['market']['lv2']=[_clone_card(card) for card in TIER_DECKS['lv2'] if card['name_en']!='Ivysaur'][:4]
reserved_evolution['players']['p0']['reserved']=[_clone_card(target_card)]
views['reservedEvolution']=Game.get_public_view(reserved_evolution,'p0')
short=copy.deepcopy(state)
short['players']['p0']['bonuses']={color:0 for color in REGULAR_COLORS}
short['players']['p0']['tokens']={color:0 for color in TOKEN_COLORS}
views['unaffordable']=Game.get_public_view(short,'p0')
empty=copy.deepcopy(state)
empty['market']['lv1']=[]
empty['decks']['lv1']=[]
views['empty']=Game.get_public_view(empty,'p0')
views['spectator']=Game.get_public_view(state,'visitor')
waiting=copy.deepcopy(state)
waiting['current_turn']='p1'
views['waiting']=Game.get_public_view(waiting,'p0')
final=copy.deepcopy(state)
final['final_round']['active']=True
views['finalRound']=Game.get_public_view(final,'p0')
final['game_over']=True
final['phase']='game_over'
final['winner']=['p0','p1']
views['gameOver']=Game.get_public_view(final,'p0')
print(json.dumps(views))
`], { encoding: 'utf8' }));

const errors = [];
const metrics = [];

async function render(page, name) {
  await page.evaluate(view => {
    clearPokemonSplendorState();
    playerId = view.you;
    renderRoomState({ room_id: roomId, game_type: 'splendor_pokemon', status: 'in_game',
      host_id: view.you, players: view.players, game_config: {} });
    setGamePanelVisibility('splendor_pokemon');
    renderPokemonSplendorGameState({ room_id: roomId, game_type: 'splendor_pokemon', view });
    setRoomControlsCollapsed(true);
    window.scrollTo(0, 0);
  }, fixtures[name]);
}

async function bounds(page, label) {
  const result = await page.evaluate(() => {
    const game = document.querySelector('.game-panel').getBoundingClientRect();
    const scopes = ['#pokemonSplendorPanel', '#pokemonSplendorTokenModal:not(.hidden)', '.obg-help-dialog[open]'];
    const overflow = scopes.flatMap(selector => [...document.querySelectorAll(`${selector} *`)])
      .filter(element => {
        const rect = element.getBoundingClientRect();
        if (!rect.width || !rect.height || element.closest('.room-controls-layer') || element.closest('details:not([open])') && !element.closest('summary')) return false;
        const style = getComputedStyle(element);
        return rect.left < -1 || rect.right > innerWidth + 1 ||
          element.clientWidth > 0 && element.scrollWidth > element.clientWidth + 1 && !['auto', 'hidden', 'clip', 'scroll'].includes(style.overflowX);
      }).map(element => ({ id: element.id, className: element.getAttribute('class'), text: element.textContent.slice(0, 50), width: element.clientWidth, scroll: element.scrollWidth }));
    const reconnect = document.getElementById('gameReconnectBtn').getBoundingClientRect();
    const help = document.getElementById('pokemonSplendorHelpBtn').getBoundingClientRect();
    const market = document.querySelector('.pokemon-market').getBoundingClientRect();
    const panel = document.getElementById('pokemonSplendorPanel').getBoundingClientRect();
    return {
      width: innerWidth, pageWidth: document.documentElement.scrollWidth, overflow,
      headerAligned: Math.abs(reconnect.top - help.top) < 6,
      marketHeight: Math.round(market.height), panelHeight: Math.round(panel.height),
      gameWidth: Math.round(game.width),
      visibleCards: [...document.querySelectorAll('.pokemon-market-card')].filter(card => card.getClientRects().length > 0).length,
    };
  });
  assert.equal(result.pageWidth <= result.width, true, `${label}: page overflow ${JSON.stringify(result)}`);
  assert.deepEqual(result.overflow, [], `${label}: element overflow ${JSON.stringify(result.overflow)}`);
  assert.equal(result.headerAligned, true, `${label}: Help and Reconnect wrap`);
  metrics.push({ label, ...result });
  return result;
}

async function marketCard(page, tier = 'Lv1', index = 0) {
  return page.locator(`#pokemonSplendorMarket${tier} .pokemon-card-select-trigger`).nth(index);
}

async function lastAction(page) {
  return page.evaluate(() => pokemonSplendorTestActions.at(-1));
}

async function touchGesture(page, locator) {
  const box = await locator.boundingBox();
  const point = { pointerId: 71, pointerType: 'touch', isPrimary: true, button: 0, clientX: box.x + box.width / 2, clientY: box.y + box.height / 2 };
  await locator.dispatchEvent('pointerdown', point);
  await locator.dispatchEvent('pointermove', { ...point, clientY: point.clientY - 45 });
  await locator.dispatchEvent('pointerup', { ...point, clientY: point.clientY - 45 });
  await locator.dispatchEvent('click', { detail: 1 });
}

(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  const page = await context.newPage();
  page.on('pageerror', error => errors.push(error.message));
  await page.route('https://fonts.googleapis.com/**', route => route.abort());
  try {
    await page.goto(base);
    await page.waitForFunction(() => typeof socket !== 'undefined' && socket.connected && cachedGameList);
    assert.equal(await page.locator('script[src*="games/splendor_pokemon.js"]').count(), 0);
    assert.equal(await page.locator('#pokemonSplendorPanel').evaluate(panel => panel.children.length), 0);
    await page.evaluate(() => socket.emit('room:create', { name: 'Pokemon Splendor UI QA', game_type: 'splendor_pokemon' }));
    await page.waitForFunction(() => roomSessionReady && isGameAssetsLoaded('splendor_pokemon'));
    await page.evaluate(() => {
      window.pokemonSplendorTestActions = [];
      window.sendAction = action => pokemonSplendorTestActions.push(action);
    });
    for (const width of [320, 390, 1024, 1440]) {
      await page.setViewportSize({ width, height: width < 600 ? 844 : 1000 });
      for (const name of Object.keys(fixtures)) {
        await render(page, name);
        const result = await bounds(page, `${width}-${name}`);
        if (name === 'turn') {
          assert.equal(result.visibleCards, width < 981 ? 4 : 14);
          assert.equal(result.marketHeight < (width < 981 ? 360 : 780), true, `${width}: market is not compact`);
        }
        if (['turn', 'evolution', 'crowded', 'gameOver'].includes(name)) {
          await page.screenshot({ path: `${output}/${width}-${name}.png`, fullPage: true });
        }
      }
      await render(page, 'turn');
      if (width < 981) {
        await page.locator('[data-pokemon-tier="all"]').click();
        await bounds(page, `${width}-all-tiers`);
        assert.equal(await page.locator('.pokemon-market-card:visible').count(), 14);
        await page.locator('[data-pokemon-tier="lv1"]').click();
      }
      await page.locator('#pokemonSplendorTakeTokensBtn').click();
      await bounds(page, `${width}-token-dialog`);
      await page.locator('#pokemonSplendorTokenDockBtn').click();
      assert.equal(await page.locator('#pokemonSplendorTokenModal').getAttribute('aria-modal'), 'false');
      await bounds(page, `${width}-token-docked`);
      await page.screenshot({ path: `${output}/${width}-docked.png`, fullPage: true });
      await page.keyboard.press('Escape');
      await render(page, 'limit');
      await (await marketCard(page)).click();
      await page.getByRole('button', { name: 'Reserve', exact: true }).click();
      await bounds(page, `${width}-reservation-return`);
      await page.keyboard.press('Escape');
      await page.locator('#pokemonSplendorHelpBtn').click();
      await page.locator('[data-obg-help-game="splendor_pokemon"] [data-obg-help-lang="en"]').click();
      await bounds(page, `${width}-help-en`);
      await page.locator('[data-obg-help-tab="symbols"]').click();
      await bounds(page, `${width}-help-symbols`);
      await page.locator('[data-obg-help-game="splendor_pokemon"] [data-obg-help-lang="zh"]').click();
      await bounds(page, `${width}-help-zh`);
      await page.keyboard.press('Escape');
    }

    await page.setViewportSize({ width: 390, height: 844 });
    await render(page, 'turn');
    await (await marketCard(page)).click();
    assert.equal(await page.locator('.pokemon-card-action-layer').count(), 1);
    await page.getByRole('button', { name: 'Catch', exact: true }).click();
    assert.deepEqual(await lastAction(page), { type: 'buy_market', tier: 'lv1', index: 0 });
    await (await marketCard(page)).click();
    await page.getByRole('button', { name: 'Cancel', exact: true }).click();
    assert.equal(await page.locator('.pokemon-card.selected').count(), 0);
    await (await marketCard(page)).click();
    await page.locator('.pokemon-market-column > .pokemon-section-heading h3').click();
    assert.equal(await page.locator('.pokemon-card.selected').count(), 0);
    await (await marketCard(page)).click();
    await page.keyboard.press('Escape');
    assert.equal(await page.locator('.pokemon-card.selected').count(), 0);
    await touchGesture(page, await marketCard(page));
    assert.equal(await page.locator('.pokemon-card.selected').count(), 0, 'Swipe must not select a card');

    await page.locator('#pokemonSplendorTakeTokensBtn').click();
    for (const color of ['Red', 'Blue', 'Yellow']) await page.getByRole('button', { name: `Add ${color} token`, exact: true }).click();
    await page.locator('#pokemonSplendorConfirmThreeBtn').click();
    assert.deepEqual(await lastAction(page), { type: 'take_tokens', colors: ['red', 'blue', 'yellow'] });
    await page.locator('#pokemonSplendorTakeTokensBtn').click();
    await page.getByRole('button', { name: 'Add Red token', exact: true }).click();
    await page.getByRole('button', { name: 'Add Red token', exact: true }).click();
    assert.equal(await page.locator('#pokemonSplendorConfirmTwoBtn').isEnabled(), true);
    await page.locator('#pokemonSplendorConfirmTwoBtn').click();
    assert.deepEqual(await lastAction(page), { type: 'take_tokens_same', color: 'red' });

    await render(page, 'limit');
    await (await marketCard(page)).click();
    await page.getByRole('button', { name: 'Reserve', exact: true }).click();
    assert.equal(await page.locator('#pokemonSplendorPendingConfirmBtn').isDisabled(), true);
    await page.getByRole('button', { name: 'Return one more Master token', exact: true }).click();
    await page.locator('#pokemonSplendorPendingConfirmBtn').click();
    assert.deepEqual(await lastAction(page), { type: 'reserve_market', tier: 'lv1', index: 0, discard: { purple: 1 } });
    await page.locator('#pokemonSplendorReserveDeckBtn').click();
    await page.locator('.pokemon-reserve-option').nth(1).click();
    await page.getByRole('button', { name: 'Return one more Master token', exact: true }).click();
    await page.locator('#pokemonSplendorPendingConfirmBtn').click();
    assert.deepEqual(await lastAction(page), { type: 'reserve_deck', tier: 'lv2', discard: { purple: 1 } });
    await page.locator('#pokemonSplendorTakeTokensBtn').click();
    for (const color of ['Red', 'Blue', 'Yellow']) await page.getByRole('button', { name: `Add ${color} token`, exact: true }).click();
    assert.equal(await page.locator('#pokemonSplendorConfirmThreeBtn').isDisabled(), true);
    for (const color of ['Red', 'Blue', 'Yellow']) await page.getByRole('button', { name: `Return one more ${color} token`, exact: true }).click();
    await page.locator('#pokemonSplendorConfirmThreeBtn').click();
    assert.deepEqual(await lastAction(page), { type: 'take_tokens', colors: ['red', 'blue', 'yellow'], discard: { red: 1, blue: 1, yellow: 1 } });

    await render(page, 'discard');
    await page.locator('#pokemonSplendorDiscardBtn').click();
    for (let count = 0; count < 2; count += 1) await page.getByRole('button', { name: 'Return one more Master token', exact: true }).click();
    await page.locator('#pokemonSplendorPendingConfirmBtn').click();
    assert.deepEqual(await lastAction(page), { type: 'discard_tokens', tokens: { purple: 2 } });

    await render(page, 'turn');
    await page.locator('#pokemonSplendorReserved .pokemon-card-select-trigger').first().click();
    await page.getByRole('button', { name: 'Catch', exact: true }).click();
    assert.deepEqual(await lastAction(page), { type: 'buy_reserved', reserved_index: 0 });

    await render(page, 'evolution');
    await page.locator('#pokemonSplendorMarketLv2 .pokemon-card-select-trigger').first().click();
    await page.getByRole('button', { name: 'Evolve', exact: true }).click();
    assert.equal((await lastAction(page)).type, 'evolve');
    assert.equal((await lastAction(page)).base_id, fixtures.evolution.evolution_options[0].base_id);
    await render(page, 'reservedEvolution');
    await page.locator('#pokemonSplendorReserved .pokemon-card-select-trigger').first().click();
    await page.getByRole('button', { name: 'Evolve', exact: true }).click();
    assert.equal((await lastAction(page)).target_id, fixtures.reservedEvolution.evolution_options[0].target_id);
    await page.locator('#pokemonSplendorSkipEvolveBtn').click();
    assert.deepEqual(await lastAction(page), { type: 'skip_evolution' });

    await render(page, 'unaffordable');
    await (await marketCard(page)).click();
    assert.equal(await page.getByRole('button', { name: 'Catch', exact: true }).isDisabled(), true);
    await page.locator('#pokemonSplendorExplainBtn').click();
    const before = await page.evaluate(() => pokemonSplendorTestActions.length);
    const disabled = await page.getByRole('button', { name: 'Catch', exact: true }).boundingBox();
    await page.mouse.click(disabled.x + disabled.width / 2, disabled.y + disabled.height / 2);
    await page.locator('.obg-explain-dialog[open]').waitFor();
    assert.match(await page.locator('.obg-explain-text').textContent(), /Cost|cost|费用/);
    assert.equal(await page.evaluate(() => pokemonSplendorTestActions.length), before);
    assert.equal(await page.locator('#pokemonSplendorExplainBtn').getAttribute('aria-pressed'), 'false');
    await page.keyboard.press('Escape');
    await page.locator('#pokemonSplendorExplainBtn').click();
    await touchGesture(page, await marketCard(page));
    assert.equal(await page.locator('.obg-explain-dialog[open]').count(), 0, 'Explain must ignore scrolling');
    await page.keyboard.press('Escape');

    await render(page, 'turn');
    const tooltipTarget = page.locator('.pokemon-player-score').first();
    await tooltipTarget.tap();
    assert.equal(await page.locator('#pokemonSplendorTooltip').isVisible(), true);
    await page.locator('.pokemon-first-player-badge').first().tap();
    assert.match(await page.locator('#pokemonSplendorTooltip').textContent(), /Kanto/);
    await page.waitForTimeout(3150);
    assert.equal(await page.locator('#pokemonSplendorTooltip').isVisible(), false);
    await page.locator('#pokemonSplendorTakeTokensBtn').tap();
    assert.equal(await page.locator('#pokemonSplendorTooltip').isVisible(), false, 'Interactive taps must not show tooltips');
    await page.keyboard.press('Escape');

    await render(page, 'crowded');
    await page.locator('#pokemonSplendorCapturedSection summary').click();
    await page.locator('#pokemonSplendorCaptured').evaluate(container => { container.scrollTop = 100; });
    const scrollTop = await page.locator('#pokemonSplendorCaptured').evaluate(container => container.scrollTop);
    await (await marketCard(page)).click();
    assert.equal(await page.locator('#pokemonSplendorCaptured').evaluate(container => container.scrollTop), scrollTop, 'Selection must preserve collection scroll');
    await page.keyboard.press('Escape');
    await page.locator('.pokemon-player details summary').first().click();
    await page.evaluate(view => renderPokemonSplendorGameState({ view }), fixtures.crowded);
    assert.equal(await page.locator('.pokemon-player details').first().evaluate(details => details.open), true, 'Remote updates must preserve collection disclosure');

    const desktop = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
    const mousePage = await desktop.newPage();
    mousePage.on('pageerror', error => errors.push(error.message));
    await mousePage.route('https://fonts.googleapis.com/**', route => route.abort());
    await mousePage.goto(base);
    await mousePage.waitForFunction(() => typeof ensureGameAssets === 'function' && socket.connected);
    await mousePage.evaluate(async () => { await ensureGameAssets('splendor_pokemon'); });
    await render(mousePage, 'turn');
    await mousePage.locator('.pokemon-player-score').first().hover();
    assert.equal(await mousePage.locator('#pokemonSplendorTooltip').isVisible(), true);
    await desktop.close();

    const liveContext = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const live = await liveContext.newPage();
    live.on('pageerror', error => errors.push(error.message));
    await live.route('https://fonts.googleapis.com/**', route => route.abort());
    try {
      await live.goto(base);
      await live.waitForFunction(() => typeof socket !== 'undefined' && socket.connected && cachedGameList);
      await live.evaluate(() => socket.emit('room:create', { name: 'Pokemon Splendor Live QA', game_type: 'splendor_pokemon' }));
      await live.waitForFunction(() => roomSessionReady && isGameAssetsLoaded('splendor_pokemon'));
      await live.evaluate(() => socket.emit('room:add_bot', {}));
      await live.waitForFunction(() => currentRoomState.players.length === 2 && !document.getElementById('startBtn').disabled);
      await live.locator('#startBtn').click();
      await live.waitForFunction(() => lastGameStatePayload?.game_type === 'splendor_pokemon' && lastGameStatePayload.view.current_turn === lastGameStatePayload.view.you, null, { timeout: 60000 });
      const identity = await live.evaluate(() => ({ room: roomId, player: playerId }));
      const legalCards = await live.locator('.pokemon-market-card').count();
      assert.equal(legalCards, 14);
      await live.locator('#pokemonSplendorTakeTokensBtn').click();
      await live.getByRole('button', { name: 'Add Red token', exact: true }).click();
      await live.getByRole('button', { name: 'Add Red token', exact: true }).click();
      await live.locator('#pokemonSplendorConfirmTwoBtn').click();
      await live.waitForFunction(() => lastGameStatePayload.view.players.find(player => player.player_id === playerId).tokens.red === 2);
      await live.reload();
      await live.waitForFunction(() => isGameAssetsLoaded('splendor_pokemon') && lastGameStatePayload?.view?.you === playerId);
      assert.deepEqual(await live.evaluate(() => ({ room: roomId, player: playerId })), identity);
      assert.equal(await live.locator('#pokemonSplendorPanel').isVisible(), true);
      assert.equal(await live.locator('#pokemonSplendorReserved .pokemon-card-empty').evaluate(card => card.getBoundingClientRect().height <= 40), true, 'Empty reservations must not take a full card height');
      await bounds(live, '390-live-reload');
      await live.screenshot({ path: `${output}/390-live-reload.png`, fullPage: true });
    } finally {
      await live.evaluate(() => socket.emit('room:leave', {})).catch(() => {});
      await liveContext.close();
    }

    assert.deepEqual(errors, []);
    fs.writeFileSync(`${output}/metrics.json`, JSON.stringify(metrics, null, 2));
    console.log(JSON.stringify({ scenes: metrics.length, errors, screenshots: output, metrics }, null, 2));
  } catch (error) {
    console.error('Page errors:', errors);
    console.error('Asset state:', await page.evaluate(() => ({
      errors: typeof gameAssetErrors === 'undefined' ? [] : [...gameAssetErrors].map(([game, error]) => [game, error.message]),
      progress: typeof gameAssetProgress === 'undefined' ? [] : [...gameAssetProgress],
    })).catch(() => null));
    await page.screenshot({ path: `${output}/failure.png`, fullPage: true });
    throw error;
  } finally {
    await page.evaluate(() => socket.emit('room:leave', {})).catch(() => {});
    await browser.close();
  }
})().catch(error => { console.error(error); process.exit(1); });
