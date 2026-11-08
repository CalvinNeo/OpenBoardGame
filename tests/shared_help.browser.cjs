/* Verifies the shared Help/Explain widgets against designs/task40.md.
 * Usage: ROOM_TEST_URL=http://127.0.0.1:8000 node tests/shared_help.browser.cjs
 */
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict');

const base = process.env.ROOM_TEST_URL || 'http://127.0.0.1:8000';

// Self-contained fixture: loads the real shared module + stylesheet and the real
// skull Help/Explain config extracted from the game script.
const fixture = `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8">
<link rel="stylesheet" href="${base}/static/style.css?v=app_v148">
</head><body>
<div id="skullPanel">
  <button id="skullHelpBtn" type="button">Help</button>
  <button id="skullExplainBtn" type="button" aria-pressed="false">Explain</button>
  <button id="skullPlayBtn" data-skull-explain="play_card">Play Card</button>
  <button id="skullStartBidBtn" data-skull-explain="start_bid" disabled>Start Bid</button>
  <button id="skullPlainBtn">No Explanation</button>
</div>
<script src="${base}/static/games/shared_help.js?v=1"></script>
<script>
  window.__plainClicks = 0;
  window.__playClicks = 0;
  document.getElementById('skullPlainBtn').addEventListener('click', () => { window.__plainClicks++; });
  document.getElementById('skullPlayBtn').addEventListener('click', () => { window.__playClicks++; });

  window.__help = obgCreateHelp({
    gameId: 'skull',
    title: { zh: '骷髅与玫瑰 · Skull', en: 'Skull' },
    basic: {
      win:  { zh: '率先赢下两轮的玩家获得整局胜利。', en: 'The first player to win two rounds wins the game.' },
      turn: { zh: '轮到你时打出一张牌。', en: 'On your turn you play one card.' },
      key:  { zh: '猜出场上藏着多少张玫瑰(🌹)。', en: 'Guess how many roses (🌹) are hidden.' }
    },
    sections: [
      { id: 'a', label: { zh: '牌与目标', en: 'Cards' }, html: { zh: '<p>中文A</p>', en: '<p>English A</p>' } },
      { id: 'b', label: { zh: '放牌阶段', en: 'Playing' }, html: { zh: '<p>中文B</p>', en: '<p>English B</p>' } },
      { id: 'c', label: { zh: '竞价阶段', en: 'Bidding' }, html: { zh: '<p>中文C</p>', en: '<p>English C</p>' } }
    ]
  });
  window.__explain = obgCreateExplain({
    gameId: 'skull',
    attribute: 'data-skull-explain',
    explanations: {
      play_card: { zh: '把选中的手牌扣到自己的牌堆上。', en: 'Place the selected card on your pile.' },
      start_bid: { zh: '开口竞价。', en: 'Open the bidding.' }
    },
    button: document.getElementById('skullExplainBtn'),
    root: () => document.getElementById('skullPanel'),
    bypass: ['#skullHelpBtn', '#skullExplainBtn']
  });
  document.getElementById('skullHelpBtn').addEventListener('click', () => window.__help.open());
  document.getElementById('skullExplainBtn').addEventListener('click', () => window.__explain.toggle());
</script>
</body></html>`;

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.route('**/fixture.html', (route) =>
    route.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: fixture }));
  await page.goto(`${base}/fixture.html`, { waitUntil: 'networkidle' });

  const results = [];
  const check = (name, ok, detail = '') => {
    results.push({ name, ok, detail });
    console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ' :: ' + detail : ''}`);
  };

  // R1: bilingual toggle
  await page.click('#skullHelpBtn');
  await page.waitForSelector('.obg-help-dialog[open]');
  const zhTitle = await page.textContent('.obg-help-title');
  check('R1 default language is Chinese', zhTitle.includes('骷髅与玫瑰'), zhTitle);
  await page.click('[data-obg-help-lang="en"]');
  const enTitle = await page.textContent('.obg-help-title');
  check('R1 switches to English', enTitle === 'Skull', enTitle);
  await page.click('[data-obg-help-lang="zh"]');
  check('R1 switches back to Chinese',
    (await page.textContent('.obg-help-title')).includes('骷髅与玫瑰'));

  // R3: three basic sentences
  const basicLabels = await page.$$eval('.obg-help-basic-row dt', (n) => n.map((e) => e.textContent.trim()));
  check('R3 has three basic rows', basicLabels.length === 3, basicLabels.join(' | '));

  // R6: tabs when >= 3 sections
  const tabs = await page.$$eval('.obg-help-tab', (n) => n.map((e) => e.textContent.trim()));
  check('R6 renders tabs for >=3 sections', tabs.length === 4, tabs.join(' | '));
  await page.click('[data-obg-help-tab="c"]');
  const activeText = await page.textContent('.obg-help-section[data-obg-help-section="c"]');
  check('R6 tab switches section', activeText.includes('中文C'), activeText);

  // Switching tabs must not reset the tab strip scroll position (mobile)
  await page.setViewportSize({ width: 320, height: 720 });
  await page.waitForTimeout(150);
  const stripState = await page.evaluate(() => {
    const strip = document.querySelector('.obg-help-tabs');
    strip.scrollLeft = strip.scrollWidth;
    return { overflow: strip.scrollWidth - strip.clientWidth, left: strip.scrollLeft };
  });
  await page.waitForTimeout(150);
  const tabsNow = await page.$$('.obg-help-tab');
  await tabsNow[tabsNow.length - 1].click();
  await page.waitForTimeout(200);
  const afterSwitch = await page.evaluate(() => ({
    left: document.querySelector('.obg-help-tabs').scrollLeft,
    active: document.querySelector('.obg-help-tab.is-active')?.textContent.trim(),
  }));
  check('Tab strip keeps its scroll position after switching',
    Math.abs(afterSwitch.left - stripState.left) < 5,
    `${Math.round(stripState.left)} -> ${Math.round(afterSwitch.left)}`);
  check('Last tab stays selected after switching',
    afterSwitch.active === '竞价阶段', afterSwitch.active);
  // Language switch must also preserve it
  await page.click('[data-obg-help-lang="en"]');
  await page.waitForTimeout(200);
  const afterLang = await page.evaluate(() => ({
    left: document.querySelector('.obg-help-tabs').scrollLeft,
    active: document.querySelector('.obg-help-tab.is-active')?.textContent.trim(),
  }));
  check('Tab strip keeps position after language switch',
    Math.abs(afterLang.left - stripState.left) < 5,
    `${Math.round(afterLang.left)}`);
  check('Active tab survives language switch', afterLang.active === 'Bidding', afterLang.active);
  await page.click('[data-obg-help-lang="zh"]');
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.waitForTimeout(150);

  // Esc closes help
  await page.keyboard.press('Escape');
  await page.waitForTimeout(150);
  check('Esc closes Help dialog', !(await page.isVisible('.obg-help-dialog[open]')));

  // Close button must actually close the dialog
  await page.click('#skullHelpBtn');
  await page.waitForSelector('.obg-help-dialog[open]');
  await page.click('.obg-help-close');
  await page.waitForTimeout(200);
  check('Close button closes Help dialog', !(await page.isVisible('.obg-help-dialog[open]')));

  // Mobile sizing: readable text and no horizontal overflow at 320px
  await page.setViewportSize({ width: 320, height: 720 });
  await page.click('#skullHelpBtn');
  await page.waitForSelector('.obg-help-dialog[open]');
  const mobile = await page.evaluate(() => {
    const dialog = document.querySelector('.obg-help-dialog');
    const content = document.querySelector('.obg-help-content');
    const close = document.querySelector('.obg-help-close');
    return {
      fontSize: parseFloat(getComputedStyle(content).fontSize),
      closeHeight: close.getBoundingClientRect().height,
      widthRatio: dialog.getBoundingClientRect().width / window.innerWidth,
    };
  });
  check('Mobile body text is at least 15px', mobile.fontSize >= 15, mobile.fontSize + 'px');
  check('Mobile close button is a comfortable target', mobile.closeHeight >= 40,
    Math.round(mobile.closeHeight) + 'px');
  check('Mobile dialog uses most of the width', mobile.widthRatio >= 0.9,
    Math.round(mobile.widthRatio * 100) + '%');
  await page.keyboard.press('Escape');
  await page.waitForTimeout(150);
  await page.setViewportSize({ width: 1280, height: 900 });

  // Explain: explained control gets dashed outline + help cursor
  await page.click('#skullExplainBtn');
  await page.waitForTimeout(100);
  const styled = await page.$eval('#skullPlayBtn', (el) => {
    const s = getComputedStyle(el);
    return { cursor: s.cursor, outline: s.outlineStyle, cls: el.className };
  });
  check('Explain marks explained control', styled.cls.includes('obg-has-explanation'), styled.cls);
  check('Explain sets help cursor', styled.cursor === 'help', styled.cursor);
  check('Explain sets dashed outline', styled.outline === 'dashed', styled.outline);

  // A drag (scroll gesture) must never open an explanation
  const playBox = await page.$eval('#skullPlayBtn', (el) => {
    const r = el.getBoundingClientRect();
    return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
  });
  await page.mouse.move(playBox.x, playBox.y);
  await page.mouse.down();
  await page.mouse.move(playBox.x, playBox.y + 60, { steps: 8 });
  await page.mouse.up();
  await page.waitForTimeout(200);
  check('Dragging does not open an explanation',
    !(await page.isVisible('.obg-explain-dialog[open]')));
  check('Explain stays active after a drag',
    await page.evaluate(() => document.body.classList.contains('obg-explaining')));

  // A clean tap on the same control must explain
  await page.mouse.click(playBox.x, playBox.y);
  await page.waitForTimeout(200);
  check('Tapping opens the explanation',
    await page.isVisible('.obg-explain-dialog[open]'));
  await page.keyboard.press('Escape');
  await page.waitForTimeout(150);

  // Unexplained control must NOT be marked
  await page.click('#skullExplainBtn');
  await page.waitForTimeout(100);
  const plainCls = await page.$eval('#skullPlainBtn', (el) => el.className);
  check('Unexplained control unmarked', !plainCls.includes('obg-has-explanation'), plainCls);

  // Clicking an unexplained control must not fire its handler
  await page.click('#skullPlainBtn');
  await page.waitForTimeout(100);
  const plainClicks = await page.evaluate(() => window.__plainClicks);
  check('Explain blocks unexplained control action', plainClicks === 0, 'clicks=' + plainClicks);

  // Disabled control stays explainable
  const disabledBox = await page.$eval('#skullStartBidBtn', (el) => {
    const r = el.getBoundingClientRect();
    return { x: r.x + r.width / 2, y: r.y + r.height / 2, disabled: el.disabled };
  });
  check('Fixture control is disabled', disabledBox.disabled === true);
  await page.mouse.click(disabledBox.x, disabledBox.y);
  await page.waitForTimeout(200);
  const explainOpen = await page.isVisible('.obg-explain-dialog[open]');
  const explainText = explainOpen ? await page.textContent('.obg-explain-text') : '';
  check('Disabled control is explainable', explainOpen && explainText.includes('开口竞价'), explainText);
  check('Explain auto-exits after explaining',
    !(await page.evaluate(() => window.__explain.isActive())));

  // Real action must not fire while explaining
  await page.click('#skullExplainBtn');
  await page.waitForTimeout(100);
  await page.click('#skullPlayBtn');
  await page.waitForTimeout(150);
  const playClicks = await page.evaluate(() => window.__playClicks);
  const explainDialogOpen = await page.isVisible('.obg-explain-dialog[open]');
  check('Explained click shows explanation instead of acting', playClicks === 0 && explainDialogOpen,
    'clicks=' + playClicks + ' dialog=' + explainDialogOpen);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(100);

  // Esc exits explain mode
  await page.click('#skullExplainBtn');
  await page.waitForTimeout(100);
  check('Explain re-enters', await page.evaluate(() => window.__explain.isActive()));
  await page.keyboard.press('Escape');
  await page.waitForTimeout(150);
  check('Esc exits Explain mode', !(await page.evaluate(() => window.__explain.isActive())));

  // Mobile layout: no horizontal overflow at 320px
  await page.setViewportSize({ width: 320, height: 720 });
  await page.click('#skullHelpBtn');
  await page.waitForSelector('.obg-help-dialog[open]');
  const overflow = await page.evaluate(() =>
    document.documentElement.scrollWidth - document.documentElement.clientWidth);
  check('No horizontal overflow at 320px', overflow <= 1, 'overflow=' + overflow);

  check('No page errors', errors.length === 0, errors.join(' | '));

  await browser.close();
  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
  process.exit(failed.length ? 1 : 0);
})();
