// Run against uvicorn; set ROOM_TEST_URL, PLAYWRIGHT_MODULE and PYTHON if needed.
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { execFileSync } = require('node:child_process');
const base = process.env.ROOM_TEST_URL || 'http://127.0.0.1:8791';
const output = process.env.WITCH_CAULDRON_OUTPUT || 'build/witch-cauldron-ui';
fs.mkdirSync(output, { recursive: true });
const widths = (process.env.WITCH_CAULDRON_WIDTHS || '1440,1024,390,320').split(',').map(Number);

const views = JSON.parse(execFileSync(process.env.PYTHON || 'python3', ['-c', `
import json, random
from game.witch_cauldron import WitchCauldronGame as G

NAMES = ["Calvin", "VeryLongUnbrokenPlayerNameToCheckOverflow", "名字很长的玩家用于验证手机布局不会溢出", "Witch Four", "Witch Five", "Witch Six", "Witch Seven"]

def players(count):
    return [{"player_id": f"p{i}", "name": NAMES[i], "seat": i} for i in range(count)]

def act(state, pid, action):
    action = dict(action, round=state["round"])
    _, err = G.apply_action(state, pid, action)
    assert err is None, (action, err)

s = G.init_game({"seed": 5}, players(4))
v = {"setup": G.get_public_view(s, "p0")}

for pid in s["turn_order"]:
    act(s, pid, {"type": "setup_pick", "card_id": s["players"][pid]["hand"][0]})
v["draft"] = G.get_public_view(s, "p0")
v["draft_wait"] = G.get_public_view(s, "p1") if False else None

order = s["circle_order"]
act(s, order[0], {"type": "draft_pick", "card_id": s["display"][0]})
v["draft_other_turn"] = G.get_public_view(s, "p1" if order[0] != "p1" else "p2")
for pid in order[1:]:
    act(s, pid, {"type": "draft_pick", "card_id": s["display"][0]})
v["play"] = G.get_public_view(s, order[0])

act(s, order[0], {"type": "play_card", "card_id": s["players"][order[0]]["hand"][0], "target": order[1], "face_up": True})
v["play_wait"] = G.get_public_view(s, order[1] if order[0] != order[1] else order[2])

# Finish the round quickly: everyone plays into their own cauldron.
guard = 0
while s["stage"] in ("draft", "play") and guard < 200:
    guard += 1
    if s["stage"] == "draft":
        pid = s["circle_order"][s["turn_index"]]
        if not s["display"]:
            break
        act(s, pid, {"type": "draft_pick", "card_id": s["display"][0]})
    else:
        pid = s["circle_order"][s["turn_index"]]
        hand = s["players"][pid]["hand"]
        if not hand:
            break
        card = hand[0]
        from game.witch_cauldron import card_of
        info = card_of(card)
        act(s, pid, {"type": "play_card", "card_id": card, "target": pid,
                     "face_up": bool(info.get("must_reveal") or info.get("reveal_to_others"))})
v["add"] = G.get_public_view(s, "p0")

for pid in [p for p in s["turn_order"] if s["players"][p]["alive"]]:
    hand = s["players"][pid]["hand"]
    act(s, pid, {"type": "add_card", "card_id": hand[0] if hand else None})
v["swap"] = G.get_public_view(s, "p0")

for pid in [p for p in s["turn_order"] if s["players"][p]["alive"]]:
    act(s, pid, {"type": "swap", "partner": None})
v["drink"] = G.get_public_view(s, "p0")

for pid in [p for p in s["turn_order"] if s["players"][p]["alive"]]:
    forced = any(__import__("game.witch_cauldron", fromlist=["card_of"]).card_of(e["card"])["id"] == "oath"
                 for e in s["players"][pid]["cauldron"])
    act(s, pid, {"type": "drink", "drink": True if forced or s["players"][pid]["refused"] else pid != "p0"})
v["scoring"] = G.get_public_view(s, "p0")

# Chameleon stage: rebuild a cauldron that holds the tail.
c = G.init_game({"seed": 11}, players(4))
for pid in c["turn_order"]:
    act(c, pid, {"type": "setup_pick", "card_id": c["players"][pid]["hand"][0]})
c["players"]["p0"]["cauldron"] = [
    {"card": "r3.0", "face_up": True, "by": "p0", "seq": 0},
    {"card": "b2.0", "face_up": True, "by": "p0", "seq": 1},
    {"card": "chameleon.0", "face_up": True, "by": "p0", "seq": 2},
]
c["stage"] = "drink"
c["pending_drink"] = {}
for pid in c["turn_order"]:
    act(c, pid, {"type": "drink", "drink": True})
v["chameleon"] = G.get_public_view(c, "p0")

# A crowded seven player table with seals, markers and a full cauldron.
k = G.init_game({"seed": 3}, players(7))
for pid in k["turn_order"]:
    act(k, pid, {"type": "setup_pick", "card_id": k["players"][pid]["hand"][0]})
k["players"]["p0"]["cauldron"] = [
    {"card": "r1.0", "face_up": True, "by": "p0", "seq": 0},
    {"card": "r2.0", "face_up": True, "by": "p1", "seq": 1},
    {"card": "r3.0", "face_up": False, "by": "p2", "seq": 2},
    {"card": "b1.0", "face_up": True, "by": "p0", "seq": 3},
    {"card": "b2.0", "face_up": False, "by": "p3", "seq": 4},
    {"card": "n0.0", "face_up": True, "by": "p0", "seq": 5},
    {"card": "lid.0", "face_up": True, "by": "p4", "seq": 6},
    {"card": "tendril.0", "face_up": True, "by": "p0", "seq": 7},
]
k["players"]["p0"]["known"] = {"p0": {"4": "b2.0"}}
k["players"]["p1"]["explosions"] = 1
k["players"]["p2"]["poisons"] = 1
k["players"]["p3"]["refused"] = True
k["players"]["p4"]["score_pile"] = ["r1.1", "r1.2", "b1.1"]
k["players"]["p4"]["total"] = 3
k["players"]["p5"]["alive"] = False
k["stage"] = "play"
k["circle_order"] = ["p0", "p1", "p2", "p3", "p4", "p6"]
k["turn_index"] = 0
v["crowded"] = G.get_public_view(k, "p0")

# A finished game.
f = G.init_game({"seed": 21}, players(3))
rng = random.Random(2)
for _ in range(4000):
    if f["game_over"]:
        break
    movers = [pid for pid in f["turn_order"] if G.get_legal_actions(f, pid)]
    if not movers:
        break
    pid = rng.choice(movers)
    legal = G.get_legal_actions(f, pid)
    view = G.get_public_view(f, pid)
    kind = legal[0]
    from game.witch_cauldron import card_of
    if kind == "draft_pick":
        act(f, pid, {"type": kind, "card_id": view["display"][0]["instance"]})
    elif kind == "play_card":
        targets = [p["player_id"] for p in view["players"] if p["alive"] and not p["sealed"]]
        card = view["hand"][0]
        target = targets[0] if targets else None
        act(f, pid, {"type": kind, "card_id": card["instance"], "target": target, "face_up": True})
    elif kind == "add_card":
        me = next(p for p in view["players"] if p["player_id"] == pid)
        act(f, pid, {"type": kind, "card_id": None if me["sealed"] or not view["hand"] else view["hand"][0]["instance"]})
    elif kind == "swap":
        act(f, pid, {"type": kind, "partner": None})
    elif kind == "drink":
        me = next(p for p in view["players"] if p["player_id"] == pid)
        forced = any(e["card"] and e["card"]["id"] == "oath" for e in me["cauldron"])
        act(f, pid, {"type": kind, "drink": True if forced or me["refused"] else True})
    elif kind == "chameleon":
        act(f, pid, {"type": kind, "color": "red"})
    elif kind == "setup_pick":
        act(f, pid, {"type": kind, "card_id": view["hand"][0]["instance"]})
    else:
        act(f, pid, {"type": "next_round"})
v["game_over"] = G.get_public_view(f, "p0")
v.pop("draft_wait", None)
print(json.dumps(v))
`], {encoding: 'utf8', cwd: process.env.REPO_DIR || '.'}));

async function render(page, key) {
  await page.evaluate(view => {
    renderWitchCauldronGameState({room_id: roomId, game_type: 'witch_cauldron', view});
  }, views[key]);
  await page.waitForTimeout(120);
}

async function audit(page, label, width) {
  await page.setViewportSize({width, height: 900});
  await page.waitForTimeout(160);
  const result = await page.evaluate(() => {
    const panel = document.getElementById('witchCauldronPanel');
    const bad = [];
    const overlaps = [];
    panel.querySelectorAll('*').forEach(el => {
      const style = getComputedStyle(el);
      if (style.display === 'none' || style.visibility === 'hidden') return;
      const r = el.getBoundingClientRect();
      if (r.width <= 0 || r.height <= 0) return;
      if (r.left < -1 || r.right > window.innerWidth + 1) {
        bad.push((el.className || el.tagName) + ' outside viewport ' + Math.round(r.left) + '..' + Math.round(r.right));
      }
      if (el.clientWidth && el.scrollWidth > el.clientWidth + 1 && !['auto', 'scroll', 'hidden'].includes(style.overflowX)) {
        bad.push((el.className || el.tagName) + ' clipped x ' + el.scrollWidth + '>' + el.clientWidth);
      }
    });
    const pots = [...panel.querySelectorAll('.witch-cauldron-pot')];
    for (let i = 0; i < pots.length; i += 1) {
      for (let j = i + 1; j < pots.length; j += 1) {
        const a = pots[i].getBoundingClientRect();
        const b = pots[j].getBoundingClientRect();
        if (a.left < b.right - 1 && b.left < a.right - 1 && a.top < b.bottom - 1 && b.top < a.bottom - 1) {
          overlaps.push('pot ' + i + ' overlaps pot ' + j);
        }
      }
    }
    const tray = panel.querySelector('.witch-cauldron-tray');
    const board = panel.querySelector('.witch-cauldron-board');
    if (tray && board) {
      const t = tray.getBoundingClientRect();
      const d = board.getBoundingClientRect();
      if (d.left < t.right - 1 && t.left < d.right - 1 && d.top < t.bottom - 1 && t.top < d.bottom - 1) {
        overlaps.push('board overlaps tray');
      }
    }
    return {
      pageOverflow: document.documentElement.scrollWidth > window.innerWidth + 1,
      pageScroll: document.documentElement.scrollWidth,
      inner: window.innerWidth,
      bad, overlaps,
    };
  });
  assert.equal(result.pageOverflow, false, label + '@' + width + ': page overflows horizontally ' + JSON.stringify(result));
  assert.deepEqual(result.bad, [], label + '@' + width + ': element overflow ' + JSON.stringify(result.bad));
  assert.deepEqual(result.overlaps, [], label + '@' + width + ': overlapping blocks ' + JSON.stringify(result.overlaps));
  await page.screenshot({path: output + '/' + label + '-' + width + '.png', fullPage: true});
}

(async () => {
  const browser = await chromium.launch({channel: process.env.BROWSER_CHANNEL || 'chrome', headless: true});
  const errors = [];
  try {
    const context = await browser.newContext({viewport: {width: 1440, height: 1000}, hasTouch: true});
    const page = await context.newPage();
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => {
      if (message.type() !== 'error') return;
      const text = message.text();
      if (text.includes('Failed to load resource')) return;   // this test aborts the Google Fonts request
      errors.push('console: ' + text);
    });
    await page.route('https://fonts.googleapis.com/**', route => route.abort());
    await page.goto(base);
    await page.waitForFunction(() => typeof socket !== 'undefined' && socket.connected && cachedGameList);
    assert.equal(await page.locator('script[src*="games/witch_cauldron.js"]').count(), 0, 'lazy: script not on the home page');
    await page.evaluate(() => socket.emit('room:create', {name: 'Witch Cauldron QA', game_type: 'witch_cauldron'}));
    await page.waitForFunction(() => currentGameType === 'witch_cauldron' && isGameAssetsLoaded('witch_cauldron'));
    await page.waitForFunction(() => typeof renderWitchCauldronGameState === 'function');
    assert.equal(await page.locator('.game-panel-title h2').textContent(), '🫕 女巫坩埚');
    assert.equal(await page.locator('#witchCauldronHelpBtn').isVisible(), true);
    assert.equal(await page.locator('#witchCauldronExplainBtn').isVisible(), true);

    const keys = ['setup', 'draft', 'draft_other_turn', 'play', 'play_wait', 'add', 'swap', 'drink', 'chameleon', 'scoring', 'crowded', 'game_over'];
    for (const key of keys) {
      await render(page, key);
      for (const width of widths) await audit(page, key, width);
    }

    // Help: bilingual, tabbed, and Esc closes it.
    await page.setViewportSize({width: 1024, height: 900});
    await render(page, 'play');
    await page.locator('#witchCauldronHelpBtn').click();
    await page.waitForSelector('#witchCauldronDialog[open]');
    assert.equal(await page.locator('.witch-cauldron-tab').count(), 5, 'help has five tabs');
    assert.match(await page.locator('.witch-cauldron-dialog-body').textContent(), /红色药材\(🔴\)/, 'help names icons in parentheses');
    await page.locator('.witch-cauldron-tab').nth(3).click();
    assert.match(await page.locator('.witch-cauldron-dialog-body').textContent(), /噬火巨龙鳞\(🐉\)/);
    await page.locator('.witch-cauldron-lang').click();
    assert.match(await page.locator('.witch-cauldron-dialog-body').textContent(), /Fire-Eater Scale \(🐉\)/);
    await page.keyboard.press('Escape');
    await page.waitForFunction(() => !document.getElementById('witchCauldronDialog').open);

    // Explain mode never performs a game action.
    await page.locator('#witchCauldronExplainBtn').click();
    await page.locator('.witch-cauldron-status').click();
    await page.waitForSelector('#witchCauldronDialog[open]');
    assert.match(await page.locator('.witch-cauldron-dialog-body').textContent(), /差值/);
    await page.keyboard.press('Escape');
    await page.waitForFunction(() => !document.getElementById('witchCauldronDialog').open);
    await page.keyboard.press('Escape');

    // Selecting a card then a cauldron opens the in-place face up / face down choice.
    await render(page, 'play');
    const before = await page.evaluate(() => JSON.stringify(lastGameStatePayload?.view));
    await page.locator('.witch-cauldron-hand .witch-cauldron-card').first().click();
    assert.equal(await page.locator('.witch-cauldron-hand .witch-cauldron-card.is-selected').count(), 1);
    await page.locator('.witch-cauldron-pot.is-target').first().click();
    assert.equal(await page.locator('.witch-cauldron-mask').count(), 1, 'in-place confirmation appears on the cauldron');
    await page.screenshot({path: output + '/confirm-mask.png'});
    await page.keyboard.press('Escape');
    await page.waitForTimeout(120);
    assert.equal(await page.locator('.witch-cauldron-mask').count(), 0, 'Esc cancels the selection');
    assert.equal(await page.evaluate(() => JSON.stringify(lastGameStatePayload?.view)), before, 'no action was sent');

    // Mobile tooltip: tapping an icon shows a hint that disappears on its own.
    await page.setViewportSize({width: 390, height: 844});
    await render(page, 'crowded');
    const token = page.locator('.witch-cauldron-token').first();
    await token.tap();
    assert.equal(await page.locator('.witch-cauldron-tip').isVisible(), true, 'tap shows the tip');
    await page.waitForTimeout(3200);
    assert.equal(await page.locator('.witch-cauldron-tip').isVisible(), false, 'tip auto hides after three seconds');

    assert.deepEqual(errors, [], 'no page errors: ' + JSON.stringify(errors));
    console.log('witch_cauldron UI OK · screenshots in ' + output);
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exit(1); });
