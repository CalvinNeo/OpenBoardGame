// Run against uvicorn; set ROOM_TEST_URL, PLAYWRIGHT_MODULE and PYTHON if needed.
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { execFileSync } = require('node:child_process');

const base = process.env.ROOM_TEST_URL || 'http://127.0.0.1:8792';
const output = 'build/kronologic-notebook';
fs.mkdirSync(output, { recursive: true });

const fixtures = JSON.parse(execFileSync(process.env.PYTHON || 'python', ['-c', `
import copy, json
from tests.test_kronologic_game import _state
from game.kronologic import KronologicGame as G

def ready_all(state):
    for pid in list(state["turn_order"]):
        pdata = state["players"].get(pid)
        if pdata and pdata.get("status") == "active":
            G.apply_action(state, pid, {"type": "ready_next_turn"})

PLANS = {
    "early": [("time", "grand_hall", 2), ("character", "backstage", None)],
    "midgame": [
        ("time", "grand_hall", 2),
        ("time", "archive", 3),
        ("character", "backstage", None),
        ("time", "orchestra_pit", 4),
        ("character", "rehearsal", None),
    ],
    "deep": [
        ("time", "grand_hall", 2),
        ("time", "archive", 3),
        ("character", "backstage", None),
        ("time", "orchestra_pit", 4),
        ("character", "rehearsal", None),
        ("time", "dressing_room", 5),
        ("character", "grand_hall", None),
        ("time", "rehearsal", 6),
        ("character", "orchestra_pit", None),
        ("time", "backstage", 3),
    ],
}

out = {}
for label, plan in PLANS.items():
    state = _state(count=3, language="zh")
    for query_type, location_id, time in plan:
        action = {"type": "ask", "query_type": query_type, "location_id": location_id}
        if query_type == "time":
            action["time"] = time
        else:
            action["character_id"] = "courier"
        _, error = G.apply_action(state, state["active_player_id"], action)
        if error:
            continue
        if state.get("phase") in ("clue_review", "accusation_review"):
            ready_all(state)
    out[label] = {"view": G.get_public_view(state, "p1"), "truth": copy.deepcopy(state["case"]["paths"])}
print(json.dumps(out))
`], { encoding: 'utf8', maxBuffer: 8 * 1024 * 1024 }));

async function openGame(browser, { width, height }) {
  const context = await browser.newContext({
    viewport: { width, height },
    deviceScaleFactor: 2,
    hasTouch: width < 700,
    isMobile: width < 700,
  });
  const page = await context.newPage();
  page.setDefaultTimeout(15000);
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.route('https://fonts.googleapis.com/**', (route) => route.abort());
  await page.goto(base);
  await page.waitForFunction(() => typeof socket !== 'undefined' && socket.connected && cachedGameList);
  await page.evaluate(() => ensureGameAssets('kronologic'));
  await page.evaluate(() => ensureGameAssets('kronologic'));
  await page.waitForFunction(() => isGameAssetsLoaded('kronologic'));
  return { context, page, errors };
}

async function render(page, view) {
  await page.evaluate((value) => {
    clearKronologicState();
    playerId = value.you;
    roomSessionReady = true;
    renderRoomState({
      room_id: 'kronologic-notebook',
      game_type: 'kronologic',
      status: 'in_game',
      host_id: 'p1',
      players: value.players,
      game_config: {},
    });
    setGamePanelVisibility('kronologic');
    renderGameState({ room_id: 'kronologic-notebook', game_type: 'kronologic', view: value });
    setRoomControlsCollapsed(true);
    window.scrollTo(0, 0);
  }, view);
  await page.locator('#kronologicPanel').waitFor({ state: 'visible' });
  await page.waitForTimeout(250);
}

async function bounds(page, label) {
  const result = await page.evaluate(() => {
    const bad = [...document.querySelectorAll('#kronologicPanel *, #kronologicNotebookSection *')]
      .filter((element) => {
        const box = element.getBoundingClientRect();
        if (!box.width || !box.height || !element.checkVisibility({ checkVisibilityCSS: true })) return false;
        const style = getComputedStyle(element);
        const outside = box.left < -1 || box.right > innerWidth + 1;
        const clipped = element.clientWidth && element.scrollWidth > element.clientWidth + 1 &&
          !['auto', 'scroll', 'hidden', 'clip'].includes(style.overflowX) &&
          !element.matches('input, select, option');
        return outside || clipped;
      })
      .map((element) => `${element.id || element.className}: ${element.textContent.slice(0, 40)}`);
    return { width: innerWidth, scroll: document.documentElement.scrollWidth, bad };
  });
  assert(result.scroll <= result.width, `${label}: page overflow ${JSON.stringify(result)}`);
  assert.deepEqual(result.bad, [], `${label}: container overflow`);
}

async function readNotebook(page) {
  return page.evaluate(() => [...document.querySelectorAll('#kronologicNotebook .kronologic-note-person')].map((cell) => ({
    character: cell.dataset.noteCharacter,
    location: cell.dataset.noteLocation,
    mark: cell.dataset.noteMark,
    auto: cell.dataset.noteAuto === '1',
  })));
}

async function selectTime(page, time) {
  await page.locator(`#kronologicNotebookTimes button[data-notebook-time="${time}"]`).click();
  await page.waitForTimeout(80);
}

(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });

  // 1. Auto-filled marks must never contradict the hidden solution.
  {
    const { context, page, errors } = await openGame(browser, { width: 1024, height: 900 });
    for (const [label, fixture] of Object.entries(fixtures)) {
      await render(page, fixture.view);
      let autoTotal = 0;
      for (let time = 1; time <= 6; time += 1) {
        await selectTime(page, time);
        const cells = await readNotebook(page);
        assert.equal(cells.length, 36, `${label} time ${time}: every room shows every character`);
        autoTotal += cells.filter((cell) => cell.auto).length;
        cells.forEach((cell) => {
          const actual = fixture.truth[cell.character][time - 1];
          const present = actual === cell.location;
          if (cell.mark === 'confirmed') {
            assert(present, `${label}: confirmed ${cell.character} at ${cell.location} time ${time} but truth is ${actual}`);
          } else if (cell.mark === 'excluded') {
            assert(!present, `${label}: excluded ${cell.character} at ${cell.location} time ${time} but truth is ${actual}`);
          } else {
            assert.equal(cell.mark, 'unknown', `${label}: unexpected mark ${cell.mark}`);
          }
        });
      }
      assert(autoTotal >= 60, `${label}: expected auto-filled cells, got ${autoTotal}`);
      console.log(`${label}: ${autoTotal} auto-filled cells across 6 time slots, all consistent with the solution`);
    }

    // 2. Count notes pick up public totals automatically.
    await render(page, fixtures.deep.view);
    const counts = await page.evaluate(() => [...document.querySelectorAll('#kronologicCountGrid select')].map((select) => ({
      location: select.dataset.countLocation,
      auto: select.dataset.countAuto === '1',
      value: select.value,
    })));
    assert(counts.some((item) => item.auto), 'count notes must auto-fill from public totals');
    console.log(`count notes: ${counts.filter((item) => item.auto).length}/${counts.length} auto-filled`);

    // 3. Manual taps always win over the auto layer.
    await selectTime(page, 4);
    const override = await page.evaluate(() => {
      const cell = document.querySelector('#kronologicNotebook .kronologic-note-person[data-note-auto="1"]');
      if (!cell) return null;
      const selector = '#kronologicNotebook .kronologic-note-person[data-note-character="' + cell.dataset.noteCharacter +
        '"][data-note-location="' + cell.dataset.noteLocation + '"]';
      const before = cell.dataset.noteMark;
      cell.click();
      const after = document.querySelector(selector);
      return { before, after: after.dataset.noteMark, auto: after.dataset.noteAuto };
    });
    assert(override, 'expected an auto-filled cell at time 4');
    assert.notEqual(override.before, override.after, 'tapping an auto cell must change it');
    assert.equal(override.auto, '0', 'a tapped cell must become a manual mark');
    console.log(`manual override: auto ${override.before} -> manual ${override.after}`);

    // 4. A stored manual mark must win over a contradicting auto conclusion.
    await selectTime(page, 4);
    const target = await page.evaluate(() => {
      const cell = document.querySelector('#kronologicNotebook .kronologic-note-person[data-note-auto="1"][data-note-mark="excluded"]');
      return cell ? { character: cell.dataset.noteCharacter, location: cell.dataset.noteLocation } : null;
    });
    assert(target, 'expected an auto-excluded cell at time 4');
    const contested = structuredClone(fixtures.deep.view);
    contested.your_notes.marks[`4|${target.location}|${target.character}`] = 'confirmed';
    await render(page, contested);
    await selectTime(page, 4);
    const winner = await page.evaluate((cell) => {
      const found = document.querySelector('#kronologicNotebook .kronologic-note-person[data-note-character="' + cell.character +
        '"][data-note-location="' + cell.location + '"]');
      return { mark: found.dataset.noteMark, auto: found.dataset.noteAuto };
    }, target);
    assert.equal(winner.mark, 'confirmed', 'manual mark must beat the auto conclusion');
    assert.equal(winner.auto, '0', 'a contested cell must render as manual');
    console.log('manual mark beats auto conclusion on a contested cell');

    assert.deepEqual(errors, [], 'no page errors on desktop');
    await render(page, fixtures.deep.view);
    await selectTime(page, 4);
    await page.screenshot({ path: `${output}/desktop-auto-time4.png`, fullPage: false });
    await context.close();
  }

  // 5. Desktop widths stay clean and keep the notebook inline.
  for (const width of [1024, 1440]) {
    const { context, page, errors } = await openGame(browser, { width, height: 900 });
    await render(page, fixtures.midgame.view);
    const layout = await page.evaluate(() => ({
      dockVisible: document.getElementById('kronologicNotebookDockBtn').checkVisibility(),
      notebookVisible: document.getElementById('kronologicNotebookSection').checkVisibility(),
      autoHint: !!document.querySelector('.kronologic-notebook-auto-hint')?.textContent?.trim(),
    }));
    assert.equal(layout.dockVisible, false, `${width}: notebook dock is mobile only`);
    assert.equal(layout.notebookVisible, true, `${width}: notebook stays inline`);
    assert.equal(layout.autoHint, true, `${width}: auto-fill legend is shown`);
    await bounds(page, `desktop ${width}`);
    await page.screenshot({ path: `${output}/desktop-${width}.png` });
    assert.deepEqual(errors, [], `no page errors at ${width}`);
    await context.close();
  }

  // 6. Mobile dock must stay narrow and the drawer must open without overflow.
  for (const width of [320, 390]) {
    const { context, page, errors } = await openGame(browser, { width, height: 780 });
    await render(page, fixtures.midgame.view);
    const dock = await page.evaluate(() => {
      const button = document.getElementById('kronologicNotebookDockBtn');
      const box = button.getBoundingClientRect();
      return {
        visible: button.checkVisibility(),
        width: box.width,
        height: box.height,
        right: box.right,
        viewport: innerWidth,
      };
    });
    assert.equal(dock.visible, true, `${width}: notebook dock must be reachable`);
    assert(dock.width <= 38, `${width}: dock width ${dock.width} must stay narrow`);
    assert(dock.height <= 66, `${width}: dock height ${dock.height} must stay compact`);
    assert(Math.abs(dock.right - dock.viewport) < 1, `${width}: dock must hug the right edge`);
    assert(dock.height >= 44, `${width}: dock must remain tappable`);
    await bounds(page, `mobile ${width} collapsed`);

    await page.locator('#kronologicNotebookDockBtn').click();
    await page.waitForTimeout(320);
    const drawer = await page.evaluate(() => {
      const section = document.getElementById('kronologicNotebookSection');
      const box = section.getBoundingClientRect();
      const cells = [...document.querySelectorAll('#kronologicNotebook .kronologic-note-person')];
      return {
        open: section.classList.contains('is-open'),
        left: box.left,
        right: box.right,
        viewport: innerWidth,
        cells: cells.length,
        autoCells: cells.filter((cell) => cell.dataset.noteAuto === '1').length,
      };
    });
    assert.equal(drawer.open, true, `${width}: notebook drawer opens`);
    assert(drawer.left >= 0 && drawer.right <= drawer.viewport + 1, `${width}: drawer stays on screen`);
    assert.equal(drawer.cells, 36, `${width}: drawer shows the full grid`);
    await bounds(page, `mobile ${width} drawer`);
    await page.screenshot({ path: `${output}/mobile-${width}.png` });

    await page.locator('#kronologicNotebookCloseBtn').click();
    await page.waitForTimeout(320);
    const closed = await page.evaluate(() => document.getElementById('kronologicNotebookSection').classList.contains('is-open'));
    assert.equal(closed, false, `${width}: drawer closes again`);
    assert.deepEqual(errors, [], `no page errors at ${width}`);
    console.log(`mobile ${width}: dock ${dock.width}x${dock.height}, drawer ok`);
    await context.close();
  }

  await browser.close();
  console.log('kronologic notebook QA passed');
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
