const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const root = path.resolve(__dirname, '..');
const output = process.env.WITCHS_BREW_SCREENSHOTS;
const view = JSON.parse(execFileSync(process.env.PYTHON || 'python3', ['-c', `
import json
from game.witchs_brew import WitchsBrewGame
from tests.test_witchs_brew_game import players
state = WitchsBrewGame.init_game({}, players(3))
state['disabled_roles'] = ['alchemist', 'witch']
state['spell_deck'] = ['magus', 'copia', 'optio', 'herba', 'lupus', 'serpens', 'sanatio', 'strix']
state['shelf_stored']['gold_shelf']['gold'] = 1
print(json.dumps(WitchsBrewGame.get_public_view(state, 'p0')))
`], { cwd: root, encoding: 'utf8' }));

const fixture = `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<link rel="stylesheet" href="/static/style.css">
<link rel="stylesheet" href="/static/games/witchs_brew.css">
</head><body><main style="max-width:1200px;margin:auto;padding:8px">
<section class="panel"><div class="panel-header"><h2>🧪 女巫的佳酿</h2>
<div class="panel-header-actions" id="witchsBrewHeaderActions"></div><button>Reconnect</button></div>
<div id="witchsBrewPanel" class="witchs-brew-panel"></div></section></main>
${fs.readFileSync(path.join(root, 'static/games/witchs_brew.html'), 'utf8')}
<script>
document.querySelectorAll('template[data-game-target]').forEach(template => {
  document.getElementById(template.dataset.gameTarget).append(template.content.cloneNode(true));
});
var currentGameType = 'witchs_brew';
window.sentActions = [];
function sendAction(action) { sentActions.push(action); }
</script>
<script src="/static/games/shared_help.js"></script>
<script src="/static/games/witchs_brew.js"></script></body></html>`;

(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const errors = [];
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true });
  const page = await context.newPage();
  page.setDefaultTimeout(10000);
  page.on('pageerror', error => errors.push(error.message));
  await page.route('http://witchs-brew.test/**', route => {
    const pathname = new URL(route.request().url()).pathname;
    if (pathname === '/') {
      return route.fulfill({ contentType: 'text/html; charset=utf-8', body: fixture });
    }
    assert(pathname.startsWith('/static/'));
    return route.fulfill({ path: path.join(root, pathname) });
  });

  async function render(next = view) {
    await page.evaluate(next => renderWitchsBrewGameState({ view: next }), next);
  }

  async function language(next) {
    await page.locator('#witchsBrewHelpBtn').click();
    const help = page.locator('[data-obg-help-game="witchs_brew"]');
    await help.locator(`[data-obg-help-lang="${next}"]`).click();
    await page.keyboard.press('Escape');
  }

  async function explain(selector, disabled = false) {
    const target = page.locator(selector);
    await target.scrollIntoViewIfNeeded();
    await page.locator('#witchsBrewExplainBtn').click();
    await target.scrollIntoViewIfNeeded();
    assert(await target.evaluate(node => node.classList.contains('obg-has-explanation')), selector);
    if (disabled) {
      const box = await target.boundingBox();
      await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
    } else {
      await target.tap();
    }
    const dialog = page.locator('.obg-explain-dialog[open]');
    await dialog.waitFor();
    assert.equal(await page.locator('#witchsBrewExplainBtn').getAttribute('aria-pressed'), 'false');
    return dialog.locator('.obg-explain-text').innerText();
  }

  async function close() {
    await page.keyboard.press('Escape');
    assert.equal(await page.locator('.obg-explain-dialog[open]').count(), 0);
  }

  async function measure(width, name) {
    const result = await page.evaluate(() => {
      const dialog = document.querySelector('.obg-explain-dialog[open]');
      const content = dialog.querySelector('.obg-help-content');
      const box = dialog.getBoundingClientRect();
      const closeBox = dialog.querySelector('.obg-help-close').getBoundingClientRect();
      return {
        pageOverflow: document.documentElement.scrollWidth > innerWidth,
        dialogOverflow: dialog.scrollWidth > dialog.clientWidth,
        contentOverflow: content.scrollWidth > content.clientWidth,
        inViewport: box.left >= 0 && box.right <= innerWidth && box.top >= 0 && box.bottom <= innerHeight,
        closeVisible: closeBox.top >= box.top && closeBox.bottom <= box.bottom,
        wrapsLines: getComputedStyle(dialog.querySelector('.obg-explain-text')).whiteSpace === 'pre-line'
      };
    });
    assert.deepEqual(result, {
      pageOverflow: false, dialogOverflow: false, contentOverflow: false,
      inViewport: true, closeVisible: true, wrapsLines: true
    }, `${width} ${name}`);
    if (output) await page.screenshot({ path: path.join(output, `${width}-${name}.png`) });
  }

  try {
    if (output) fs.mkdirSync(output, { recursive: true });
    await page.goto('http://witchs-brew.test/');
    await render();
    const roles = Object.keys(view.role_defs);
    for (const lang of ['zh', 'en']) {
      await language(lang);
      for (const role of roles) {
        const disabled = view.disabled_roles.includes(role);
        const text = await explain(`#witchsBrewHand [data-wb-explain="role_${role}${disabled ? '_disabled' : ''}"]`, disabled);
        assert(text.includes(lang === 'zh' ? '完整行动 (F)' : 'Full action (F)'), role);
        assert(text.includes(lang === 'zh' ? '恩惠 (V)' : 'Favor (V)'), role);
        assert(text.includes(view.role_defs[role].emoji), role);
        assert.equal(await page.evaluate(() => witchsBrewSelectedRoles.size), 0);
        if (disabled) assert(text.includes(lang === 'zh' ? '本大轮被禁用' : 'disabled for the current set'));
        if (role === 'warlock') assert(text.includes('Magus'));
        if (role === 'wizard') assert(text.includes(lang === 'zh' ? '不是获得 2 个金块' : 'not a gold reward'));
        await close();
      }
      for (const width of [320, 390, 1024, 1440]) {
        await page.setViewportSize({ width, height: width < 600 ? 844 : 1000 });
        for (const role of ['warlock', 'begging_monk', 'wizard']) {
          await explain(`#witchsBrewHand [data-wb-explain="role_${role}"]`);
          await measure(width, `${lang}-${role}`);
          await close();
        }
      }
    }

    await language('zh');
    await page.setViewportSize({ width: 390, height: 844 });
    for (const stack of ['copper', 'iron', 'silver']) {
      const text = await explain(`[data-wb-explain="cauldron_${stack}"]`);
      assert(text.includes('终局计 2 分'));
      assert(text.includes('不是获得金块'));
      await close();
    }
    for (const shelf of ['gold_shelf', 'ingredient_shelf']) {
      const text = await explain(`[data-wb-explain="shelf_${shelf}"]`);
      assert(text.includes(shelf === 'gold_shelf' ? '当前已存 1，还差 2' : '当前已存 0，还差 3'));
      assert(text.includes('向下取整'));
      await close();
    }

    await page.locator('.wb-ref > summary').click();
    await page.locator('.wb-ref-sub > summary').filter({ hasText: 'Spell book order' }).click();
    for (const spell of Object.keys(view.spell_defs)) {
      const text = await explain(`#witchsBrewSpellList [data-wb-explain="spell_${spell}"]`);
      assert(text.includes(view.spell_defs[spell].name));
      assert(text.includes('仅术士'));
      if (['magus', 'sanatio', 'strix'].includes(spell)) assert(text.includes('任意材料 × 1'));
      await close();
    }
    await page.locator('.wb-ref-sub > summary').filter({ hasText: 'All twelve roles' }).click();
    assert((await explain('#witchsBrewRoleList [data-wb-explain="role_assistant"]')).includes('总共 3 个'));
    await close();
    await page.locator('.wb-ref-sub > summary').filter({ hasText: 'Cauldron stacks' }).click();
    assert((await explain('[data-wb-explain="reference_copper_2"]')).includes('不能越过前面的牌'));
    await close();
    await page.locator('.wb-ref-sub > summary').filter({ hasText: 'Shelf stacks' }).click();
    assert((await explain('[data-wb-explain="reference_gold_shelf_2"]')).includes('当前积累不属于这张牌'));
    await close();

    const changed = JSON.parse(JSON.stringify(view));
    changed.cauldrons.copper.shift();
    changed.cauldrons.copper.shift();
    changed.spell = 'herba';
    changed.phase = 'resolve_action';
    changed.active_role = 'warlock';
    changed.current_player = 'p0';
    changed.pending_action = { player_id: 'p0', role: 'warlock', strength: 'full' };
    await render(changed);
    assert((await explain('.wb-stage-role')).includes('Herba'));
    await close();
    const wizard = await page.evaluate(() => WITCHS_BREW_EXPLAIN.role_wizard.zh);
    assert(wizard.includes('蛇毒(⚪) × 1 + 狼血(🔴) × 1') || wizard.includes('狼血(🔴) × 1 + 蛇毒(⚪) × 1'));
    assert((await explain('#witchsBrewSpell .wb-spell-card')).includes('支付 1 个草药'));
    await close();

    changed.cauldrons.copper = [];
    await render(changed);
    assert((await explain('[data-wb-explain="cauldron_copper"]')).includes('牌堆已空'));
    await close();
    assert((await page.evaluate(() => WITCHS_BREW_EXPLAIN.role_wizard.zh)).includes('牌堆已空'));

    const collected = JSON.parse(JSON.stringify(view));
    const raven = collected.cauldrons.iron.splice(4, 1)[0];
    collected.players[0].potions = [raven];
    await render(collected);
    const won = await explain(`[data-wb-explain="won_${raven.id}"]`);
    assert(won.includes('终局计 4 分'));
    assert(won.includes('带乌鸦'));
    await close();

    await render();
    await page.locator('#witchsBrewExplainBtn').click();
    await page.keyboard.press('Escape');
    assert.equal(await page.locator('#witchsBrewExplainBtn').getAttribute('aria-pressed'), 'false');
    const keeper = page.locator('#witchsBrewHand [data-wb-explain="role_wolf_keeper"]');
    await keeper.tap();
    assert.equal(await page.evaluate(() => witchsBrewSelectedRoles.has('wolf_keeper')), true);
    assert.equal(await page.evaluate(() => sentActions.length), 0);
    assert.deepEqual(errors, []);
    console.log('PASS: 12 bilingual roles, 8 spells, 5 public stacks, reference/stage cards, live costs, disabled cards, no accidental actions, Escape, and 24 dialog layouts at 320/390/1024/1440px');
  } finally {
    await browser.close();
  }
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
