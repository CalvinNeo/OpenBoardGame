// Layout acceptance for 大家来找茬 (find_diff), the independent time trial.
// Renders synthetic views at desktop and phone widths and audits the panel for
// overflow, overlap, clipped text and page-wide horizontal scroll.
//
//   ROOM_TEST_URL=http://127.0.0.1:8792 //   PLAYWRIGHT_MODULE=/Users/minimax/pw-tools/node_modules/playwright-core //   node tests/find_diff.browser.cjs
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const base = process.env.ROOM_TEST_URL || 'http://127.0.0.1:8766';
const output = path.join(root, 'tmp/find_diff_ui');

// Build the synthetic round out of a real level so the browser composes real
// patches: the whole point of the client-side composition is that it lines up.
const MANIFEST = JSON.parse(fs.readFileSync(
  path.join(root, '.find_diff/manifest.json'), 'utf8'));
const REAL = MANIFEST.levels[0];
const REAL_SLOTS = [0, 1, 2];
const PREFIX = '/static/find_diff/';

function levelPayload(slots) {
  return {
    id: REAL.id,
    title: REAL.title,
    a_url: PREFIX + REAL.a,
    base_size: MANIFEST.size,
    patches: slots.map((slot, index) => ({
      slot: index,
      url: PREFIX + REAL.diffs[slot].patch,
      at: REAL.diffs[slot].at,
      size: REAL.diffs[slot].size,
    })),
    total: slots.length,
  };
}

const WIDTHS = [
  { name: 'desktop-1440', width: 1440, height: 900 },
  { name: 'desktop-1024', width: 1024, height: 768 },
  { name: 'phone-390', width: 390, height: 844 },
  { name: 'phone-320', width: 320, height: 568 },
];

const BOXES = REAL_SLOTS.map((slot) => REAL.diffs[slot].box);

const PLAYERS = [
  { player_id: 'p1', name: 'Ann', is_bot: false },
  { player_id: 'p2', name: 'Bob', is_bot: false },
  { player_id: 'p3', name: 'A very long player name here', is_bot: false },
];

function makeView(caseName) {
  const finishedMe = caseName === 'finished';
  const done = caseName === 'results' || caseName === 'game_over';
  const found = BOXES.slice(0, 2).map((box, index) => ({
    slot: index,
    box,
    name: 'obj' + index,
    kind: 'flip',
  }));
  const view = {
    game_id: 'find_diff',
    stage: done ? (caseName === 'game_over' ? 'game_over' : 'results') : 'racing',
    config: { levels: 5, diffs: 3, total_seconds: 600 },
    levels_total: 5,
    diffs_per_level: 3,
    started_ms: Date.now() - 83000,
    deadline_ms: Date.now() + 517000,
    server_now_ms: Date.now(),
    you: {
      level_index: finishedMe || done ? 5 : 2,
      finished: finishedMe || done,
      elapsed_ms: (finishedMe || done) ? 83400 : null,
      misses: 2,
      splits: [12000, 28000],
      cooldown_until_ms: 0,
      found: finishedMe || done ? [] : found,
      remaining: finishedMe || done ? 0 : 1,
      level: finishedMe || done ? null : levelPayload(REAL_SLOTS),
    },
    players: PLAYERS.map((p, index) => ({
      player_id: p.player_id,
      name: p.name,
      is_bot: false,
      levels_done: done ? 5 : (index === 1 ? 3 : 2),
      found: done ? 15 : (index === 1 ? 9 : 6),
      total: 15,
      level_found: done ? 0 : (index === 1 ? 0 : 2),
      misses: index,
      finished: done || index === 1,
      elapsed_ms: (done || index === 1) ? 90000 + index * 4000 : null,
    })),
    legal_actions: done ? ['continue'] : ['guess'],
    continue_ready: [],
    rematch_ready: [],
    continue_target: 3,
    game_over: caseName === 'game_over',
    winners: ['p1'],
    log: [
      { at_ms: Date.now(), message: 'Ann 全部完成，用时 83.4 秒' },
      { at_ms: Date.now(), message: 'Bob 点错了，锁定 2 秒' },
    ],
    miss_cooldown_ms: 2000,
  };
  if (done) {
    view.ranking = view.players
      .map((p, index) => ({
        player_id: p.player_id,
        name: p.name,
        is_bot: false,
        finished: true,
        elapsed_ms: p.elapsed_ms,
        levels_done: 5,
        found: 15,
        total: 15,
        misses: p.misses,
        splits: [12000, 28000, 44000, 61000, 83400],
        place: index + 1,
      }))
      .sort((a, b) => a.elapsed_ms - b.elapsed_ms)
      .map((row, index) => ({ ...row, place: index + 1 }));
    const second = MANIFEST.levels[1];
    view.review = [REAL, second].map((lv, index) => ({
      index,
      id: lv.id,
      title: lv.title,
      a_url: PREFIX + lv.a,
      base_size: MANIFEST.size,
      patches: REAL_SLOTS.map((slot, i) => ({
        slot: i,
        url: PREFIX + lv.diffs[slot].patch,
        at: lv.diffs[slot].at,
        size: lv.diffs[slot].size,
      })),
      diffs: REAL_SLOTS.map((slot, i) => ({
        slot: i, box: lv.diffs[slot].box,
        name: lv.diffs[slot].name, kind: lv.diffs[slot].kind,
      })),
    }));
  }
  return view;
}

const CASES = ['racing', 'finished', 'results', 'game_over'];

async function render(page, caseName) {
  await page.evaluate((view) => {
    clearFindDiffState();
    renderFindDiffGameState({ game_type: 'find_diff', view });
    window.scrollTo(0, 0);
  }, makeView(caseName));
  if (caseName === 'racing') {
    await page.waitForFunction(() => {
      const a = document.getElementById('findDiffImageA');
      const b = document.getElementById('findDiffImageB');
      return a && b && a.complete && b.complete && a.naturalWidth > 0;
    }, { timeout: 15000 }).catch(() => {});
  }
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(resolve)));
}

async function audit(page) {
  return page.evaluate(() => {
    const panel = document.getElementById('findDiffPanel');
    const visible = (node) => node.checkVisibility({ checkVisibilityCSS: true });
    const rect = (node) => {
      const b = node.getBoundingClientRect();
      return { left: b.left, right: b.right, top: b.top, bottom: b.bottom, width: b.width, height: b.height };
    };
    const overflow = [];
    const overlap = [];
    const clipped = [];
    const small = [];
    for (const node of panel.querySelectorAll('*')) {
      if (!visible(node)) continue;
      const style = getComputedStyle(node);
      const box = rect(node);
      const label = node.id || String(node.className);
      if (node.clientWidth && node.scrollWidth > node.clientWidth + 2
        && style.overflowX !== 'auto' && style.textOverflow !== 'ellipsis') {
        overflow.push(label);
      }
      if (node.matches('button') && box.height < 28) small.push(label + ':' + Math.round(box.height));
      if (!node.children.length && node.textContent.trim() && style.textOverflow !== 'ellipsis') {
        const range = document.createRange();
        range.selectNodeContents(node);
        const text = range.getBoundingClientRect();
        if (text.right > box.right + 2 || text.left < box.left - 2) clipped.push(label);
      }
    }
    for (const selector of ['.find-diff-status', '.find-diff-scores', '.find-diff-stage',
      '.find-diff-result-actions', '.find-diff-rank']) {
      for (const parent of panel.querySelectorAll(selector)) {
        const kids = Array.from(parent.children).filter(visible);
        for (let i = 0; i < kids.length; i += 1) {
          for (let j = i + 1; j < kids.length; j += 1) {
            const a = rect(kids[i]);
            const b = rect(kids[j]);
            if (a.left < b.right - 1 && b.left < a.right - 1
              && a.top < b.bottom - 1 && b.top < a.bottom - 1) {
              overlap.push((kids[i].id || kids[i].className) + '/' + (kids[j].id || kids[j].className));
            }
          }
        }
      }
    }
    const stage = document.getElementById('findDiffStage');
    const stageShown = visible(stage);
    const imgA = document.getElementById('findDiffImageA');
    const frameA = imgA.closest('.find-diff-frame');
    // Compare against the frame's content box; getBoundingClientRect includes
    // the 1px border, which would otherwise read as a 4px letterbox.
    const letterbox = stageShown
      ? Math.abs(rect(imgA).width - frameA.clientWidth)
        + Math.abs(rect(imgA).height - frameA.clientHeight)
      : 0;
    return {
      pageOverflow: document.documentElement.scrollWidth > window.innerWidth + 1,
      overflow,
      overlap,
      clipped,
      small,
      stageShown,
      letterbox,
      marks: document.querySelectorAll('#findDiffMarksA .find-diff-mark').length,
      patches: Array.from(document.querySelectorAll('#findDiffPatchesB img')).map((img) => {
        const host = document.getElementById('findDiffPatchesB').getBoundingClientRect();
        const box = img.getBoundingClientRect();
        return {
          loaded: img.complete && img.naturalWidth > 0,
          insideFrame: box.left >= host.left - 1 && box.right <= host.right + 1
            && box.top >= host.top - 1 && box.bottom <= host.bottom + 1,
          w: Math.round(box.width), h: Math.round(box.height),
        };
      }),
      patchesOnA: document.querySelectorAll('.find-diff-frame:first-child .find-diff-patches img').length,
      tags: document.querySelectorAll('#findDiffMarksA .find-diff-tag').length,
      rankRows: document.querySelectorAll('.find-diff-rank li').length,
      reviewItems: document.querySelectorAll('.find-diff-review-item').length,
      reviewPics: document.querySelectorAll('.find-diff-review-item .find-diff-review-pic').length,
      reviewPatched: document.querySelectorAll(
        '.find-diff-review-pair > .find-diff-review-pic:last-child img[style*="position:absolute"]').length,
      reviewTags: Array.from(document.querySelectorAll('.find-diff-review-tag'))
        .map((n) => n.textContent),
      resultShown: visible(document.getElementById('findDiffResult')),
      docHeight: document.documentElement.scrollHeight,
      viewportHeight: window.innerHeight,
    };
  });
}

// A cold cache with staggered responses is where a patch-by-patch reveal would
// show up. Nothing about the picture may be visible until every piece is in.
async function slowLoadCheck(browser, failures) {
  const context = await browser.newContext({
    viewport: { width: 1024, height: 768 },
    deviceScaleFactor: 1,
  });
  const page = await context.newPage();
  let patchHits = 0;
  await page.route('**/static/find_diff/*_p*.png', async (route) => {
    patchHits += 1;
    await new Promise((resolve) => setTimeout(resolve, 600));
    await route.continue();
  });
  await page.route('**/static/find_diff/*_a.jpg', async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 250));
    await route.continue();
  });

  await page.goto(base, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => typeof ensureGameAssets === 'function' && typeof socket !== 'undefined', { timeout: 20000 });
  await page.evaluate(() => ensureGameAssets('find_diff'));
  await page.waitForFunction(() => document.getElementById('findDiffImageA') !== null, { timeout: 15000 });
  await page.evaluate(() => {
    document.getElementById('findDiffPanel').classList.remove('hidden');
    if (typeof setRoomControlsCollapsed === 'function') setRoomControlsCollapsed(true);
  });

  // Deliberately not render(): that helper waits for the pictures to finish,
  // which is exactly the window this probe needs to observe.
  await page.evaluate((view) => {
    clearFindDiffState();
    renderFindDiffGameState({ game_type: 'find_diff', view });
  }, makeView('racing'));

  const samples = [];
  for (let i = 0; i < 10; i += 1) {
    samples.push(await page.evaluate(() => {
      const stage = document.getElementById('findDiffStage');
      const a = document.getElementById('findDiffImageA');
      const b = document.getElementById('findDiffImageB');
      return {
        loading: stage.classList.contains('is-loading'),
        patches: document.querySelectorAll('#findDiffPatchesB img').length,
        baseSrc: a.getAttribute('src'),
        bSrc: b.getAttribute('src'),
        noteShown: !document.getElementById('findDiffLoading').hidden,
        framesVisible: getComputedStyle(a.closest('.find-diff-frame')).visibility,
      };
    }));
    await new Promise((resolve) => setTimeout(resolve, 120));
  }

  const midFlight = samples.filter((s) => s.loading);
  const partial = midFlight.filter((s) => s.patches > 0 || s.baseSrc || s.bSrc);
  const notHidden = midFlight.filter((s) => s.framesVisible !== 'hidden');
  const noNote = midFlight.filter((s) => !s.noteShown);

  console.log('=== slow-load probe ===');
  console.log('patch responses served: ' + patchHits);
  console.log('samples: ' + samples.length + ', mid-flight: ' + midFlight.length);
  console.log(JSON.stringify(samples, null, 1));

  if (patchHits < 3) failures.push('slow-load: patches were served from cache, probe is meaningless');
  if (!midFlight.length) failures.push('slow-load: never caught the loading state');
  if (partial.length) {
    failures.push('slow-load: ' + partial.length + ' mid-flight sample(s) already showed part of the picture');
  }
  if (notHidden.length) failures.push('slow-load: frames were visible while loading');
  if (noNote.length) failures.push('slow-load: loading note was hidden while loading');

  const settled = await page.waitForFunction(() => {
    const stage = document.getElementById('findDiffStage');
    return !stage.classList.contains('is-loading')
      && document.querySelectorAll('#findDiffPatchesB img').length === 3;
  }, { timeout: 20000 }).then(() => true).catch(() => false);
  if (!settled) failures.push('slow-load: never settled into the fully loaded state');
  await page.screenshot({ path: path.join(output, 'slow-load-settled.png') });
  await context.close();
}

(async () => {
  fs.mkdirSync(output, { recursive: true });
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const failures = [];
  for (const size of WIDTHS) {
    const context = await browser.newContext({
      viewport: { width: size.width, height: size.height },
      deviceScaleFactor: 1,
    });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', (err) => errors.push(String(err)));
    page.on('console', (msg) => {
      if (msg.type() !== 'error') return;
      if ((msg.location()?.url || '').includes('favicon')) return;
      errors.push(msg.text());
    });
    page.on('response', (res) => {
      if (res.status() === 404 && !res.url().endsWith('/favicon.ico')) errors.push('404 ' + res.url());
    });
    await page.goto(base, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => typeof ensureGameAssets === 'function' && typeof socket !== 'undefined', { timeout: 20000 });
    await page.evaluate(() => ensureGameAssets('find_diff'));
    await page.waitForFunction(() => document.getElementById('findDiffImageA') !== null, { timeout: 15000 });
    await page.evaluate(() => {
      document.getElementById('findDiffPanel').classList.remove('hidden');
      if (typeof setRoomControlsCollapsed === 'function') setRoomControlsCollapsed(true);
    });

    for (const caseName of CASES) {
      await render(page, caseName);
      const report = await audit(page);
      const tag = size.name + '-' + caseName;
      await page.screenshot({ path: path.join(output, tag + '.png'), fullPage: false });
      console.log('\n=== ' + tag + ' ===');
      console.log(JSON.stringify(report));
      if (report.pageOverflow) failures.push(tag + ': page scrolls horizontally');
      if (report.overflow.length) failures.push(tag + ': overflow ' + report.overflow.join(','));
      if (report.overlap.length) failures.push(tag + ': overlap ' + report.overlap.join(','));
      if (report.clipped.length) failures.push(tag + ': clipped text ' + report.clipped.join(','));
      if (report.small.length) failures.push(tag + ': tiny buttons ' + report.small.join(','));
      if (report.letterbox > 1) failures.push(tag + ': picture does not fill frame');
      if (caseName === 'racing') {
        if (!report.stageShown) failures.push(tag + ': board hidden while racing');
        if (report.marks !== 2) failures.push(tag + ': expected 2 marks, got ' + report.marks);
        if (report.tags !== 2) failures.push(tag + ': expected 2 tags, got ' + report.tags);
        if (report.patches.length !== 3) {
          failures.push(tag + ': expected 3 stacked patches, got ' + report.patches.length);
        }
        if (report.patches.some((p) => !p.loaded)) failures.push(tag + ': a patch failed to load');
        if (report.patches.some((p) => !p.insideFrame)) {
          failures.push(tag + ': a patch sits outside its frame');
        }
        if (report.patches.some((p) => p.w < 2 || p.h < 2)) {
          failures.push(tag + ': a patch collapsed to nothing');
        }
        if (report.patchesOnA !== 0) failures.push(tag + ': the clean frame must carry no patches');
        if (report.resultShown) failures.push(tag + ': result panel should stay hidden');
      } else {
        if (report.stageShown) failures.push(tag + ': board should be hidden');
        if (!report.resultShown) failures.push(tag + ': result panel should be visible');
      }
      if ((caseName === 'results' || caseName === 'game_over') && report.rankRows !== 3) {
        failures.push(tag + ': expected 3 ranking rows, got ' + report.rankRows);
      }
      if (caseName === 'results' || caseName === 'game_over') {
        if (report.reviewItems !== 2) {
          failures.push(tag + ': expected 2 review entries, got ' + report.reviewItems);
        }
        // both A and B must be shown for every entry
        if (report.reviewPics !== report.reviewItems * 2) {
          failures.push(tag + ': review shows ' + report.reviewPics + ' pictures for '
            + report.reviewItems + ' entries, expected A and B for each');
        }
        if (report.reviewPatched !== report.reviewItems * 3) {
          failures.push(tag + ': B side of the review is missing its patches ('
            + report.reviewPatched + ')');
        }
        const tags = report.reviewTags.join(',');
        if (tags !== 'A,B,A,B') failures.push(tag + ': review labels were ' + tags);
      }
    }
    if (errors.length) failures.push(size.name + ': console/page errors ' + errors.slice(0, 3).join(' | '));
    await context.close();
  }
  await slowLoadCheck(browser, failures);
  await browser.close();
  if (failures.length) {
    console.error('\nFAILURES:\n' + failures.map((f) => ' - ' + f).join('\n'));
    process.exit(1);
  }
  console.log('\nfind_diff layout acceptance passed; screenshots in ' + output);
})().catch((err) => { console.error(err); process.exit(1); });
