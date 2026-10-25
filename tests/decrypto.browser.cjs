const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const { execFileSync } = require("node:child_process");
const base = process.env.ROOM_TEST_URL || "http://127.0.0.1:8787";
const output = "tmp/decrypto-ui";
fs.mkdirSync(output, { recursive: true });

const fixtures = JSON.parse(execFileSync(process.env.PYTHON || "python", ["-c", `
import copy, json, random
from game.decrypto import DecryptoGame as Game
random.seed(27)
players = [{"player_id": "p" + str(index + 1), "seat": index, "name": name}
           for index, name in enumerate(["Alice", "Bob", "Cara", "Dan"])]
state = Game.init_game(None, players)
state["teams"]["white"]["keywords"] = ["海洋", "水果", "时钟", "星球"]
state["teams"]["black"]["keywords"] = ["高山", "森林", "草原", "火焰"]
views = {}
def save(name, viewer):
    views[name] = copy.deepcopy(Game.get_public_view(state, viewer))
def act(player, action, **values):
    _, error = Game.apply_action(state, player, {"type": action, **values})
    if error: raise RuntimeError(error)
state["round_data"]["white"]["code"] = [1, 2, 3]
state["round_data"]["black"]["code"] = [2, 3, 4]
save("encryption", "p1")
save("encryption_waiting", "p2")
act("p1", "submit_clues", clues=["海浪", "果汁", "秒针"])
save("clues_submitted", "p1")
act("p3", "submit_clues", clues=["林海", "平原", "炊烟"])
save("first_guess", "p2")
act("p2", "submit_decrypt", guess=[1, 2, 3])
act("p4", "submit_decrypt", guess=[2, 3, 4])
save("round_one", "p2")
for player in players: act(player["player_id"], "next_round")
state["round_data"]["white"]["code"] = [1, 2, 3]
state["round_data"]["black"]["code"] = [4, 2, 1]
act("p2", "submit_clues", clues=["蓝色", "果园", "正点"])
act("p4", "submit_clues", clues=["宇宙", "树叶", "山顶"])
save("guessing", "p1")
save("black_guessing", "p3")
save("encryptor_guessing", "p2")
save("spectator_guessing", "observer")
act("p1", "submit_decrypt", guess=[1, 2, 3])
act("p3", "submit_decrypt", guess=[4, 1, 2])
act("p1", "submit_intercept", guess=[4, 2, 1])
save("partial_intercept", "p1")
act("p3", "submit_intercept", guess=[1, 3, 2])
save("round_end", "p1")
save("spectator", "observer")
act("p1", "next_round")
save("ready", "p1")
for player in players[1:]: act(player["player_id"], "next_round")
save("next_encryption", "p1")
state["game_over"] = True
state["phase"] = "game_over"
state["winner"] = "white"
save("game_over", "p1")
for count in (6, 8):
    members = [{"player_id": "group_" + str(index), "seat": index, "name": "Player " + str(index + 1)} for index in range(count)]
    group_state = Game.init_game(None, members)
    views["players_" + str(count)] = Game.get_public_view(group_state, "group_0")
print(json.dumps(views))
`], { encoding: "utf8", maxBuffer: 4 * 1024 * 1024 }));

fixtures.long_content = structuredClone(fixtures.guessing);
fixtures.long_content.players.forEach((player) => {
  player.name = `${player.player_id}LongUnbrokenPlayerNameThatMustWrapAtSmallWidths`;
});
for (const team of Object.values(fixtures.long_content.teams)) {
  team.players = fixtures.long_content.players.filter((player) => player.team_id === team.team_id);
  team.current_clues = ["一个非常长的线索用于确认手机文字不会超出容器", "Supercalifragilisticexpialidocious", "<img src=x onerror=alert(1)>"];
  team.history = Array.from({ length: 8 }, (_, index) => ({
    round: index + 1,
    code: [1, 2, 3],
    clues: [`很长的历史线索用来检查截断${index}`, `Supercalifragilisticexpialidocious${index}`, "🌊🌊🌊🌊🌊🌊🌊🌊🌊🌊🌊🌊"],
    clues_by: team.players[index % 2].player_id,
  }));
  team.history_by_keyword = {};
}
fixtures.long_content.teams.white.keywords = ["LongSecretKeywordThatMustWrap", "一个很长的关键词确保正常换行", "Clock", "Planet"];
fixtures.long_results = structuredClone(fixtures.round_end);
fixtures.long_results.teams.white.keywords = [...fixtures.long_content.teams.white.keywords];
fixtures.long_results.last_round_summary.teams.white.clues = ["短", "ThisIsAnExtremelyLongUnbrokenClueThatMustWrapAcrossSeveralLines", "😀🌊😀🌊😀🌊"];
fixtures.long_results.last_round_summary.teams.black.clues = ["短", "很多很多的文字用于检查正确与错误的顺序能否始终逐行对齐", "山顶"];
fixtures.legacy_review = structuredClone(fixtures.round_end);
fixtures.legacy_final = structuredClone(fixtures.game_over);
fixtures.legacy_spectator = structuredClone(fixtures.spectator);
for (const name of ["legacy_review", "legacy_final", "legacy_spectator"]) {
  fixtures[name].teams.black.keywords = ["高山", "森林", "草原", "火焰"];
}
fixtures.legacy_spectator.teams.white.keywords = ["海洋", "水果", "时钟", "星球"];

async function render(page, name) {
  await page.evaluate((view) => {
    clearDecryptoState();
    playerId = view.you;
    roomSessionReady = true;
    renderRoomState({ room_id: "decrypto-layout", game_type: "decrypto", status: view.game_over ? "game_over" : "in_game", host_id: "p1", players: view.players, game_config: {} });
    setGamePanelVisibility("decrypto");
    renderGameState({ room_id: "decrypto-layout", game_type: "decrypto", view });
    setRoomControlsCollapsed(true);
    window.decryptoTestActions = [];
    window.scrollTo(0, 0);
  }, fixtures[name]);
  await page.locator("#decryptoPanel").waitFor({ state: "visible" });
}

async function bounds(page, label) {
  const result = await page.evaluate(() => {
    const issues = [...document.querySelectorAll("#decryptoPanel *, #decryptoHelpModal *, #decryptoExplainModal *")]
      .filter((element) => {
        const box = element.getBoundingClientRect();
        if (!box.width || !box.height || !element.checkVisibility()) return false;
        const style = getComputedStyle(element);
        const outsideViewport = box.left < -1 || box.right > innerWidth + 1;
        const contentOverflow = element.clientWidth && element.scrollWidth > element.clientWidth + 1 &&
          !["auto", "scroll", "hidden", "clip"].includes(style.overflowX) && !element.matches("input, select, option");
        return outsideViewport || contentOverflow;
      }).map((element) => `${element.id || element.className || element.tagName}: ${element.textContent.slice(0, 45)}`);
    const dock = document.getElementById("decryptoReviewBtn");
    const historyDock = document.getElementById("decryptoHistoryDock");
    const historyButton = document.getElementById("decryptoHistoryBtn");
    const history = document.getElementById("decryptoHistory");
    if (historyDock.checkVisibility()) {
      const box = historyDock.getBoundingClientRect();
      const bottomOffset = Number.parseFloat(getComputedStyle(historyDock).bottom);
      if (getComputedStyle(historyDock).position !== "fixed" || Math.abs(box.bottom - (innerHeight - bottomOffset)) > 1 || box.top < 0) issues.push("History must dock inside the bottom viewport edge");
      const expanded = historyButton.getAttribute("aria-expanded") === "true";
      if (expanded !== history.checkVisibility()) issues.push("History visibility must match aria-expanded");
      if (!expanded && box.height > 52) issues.push("Collapsed History must remain a narrow tab");
      if (expanded && box.height > Math.min(innerHeight * 0.48, 460) + 1) issues.push("History must stay within its height limit");
      const main = document.querySelector(".decrypto-main").getBoundingClientRect();
      const workspace = document.querySelector(".decrypto-workspace").getBoundingClientRect();
      if (Math.abs(main.width - workspace.width) > 1) issues.push("History must not reserve an empty board column");
    }
    if (dock.checkVisibility() && !document.body.classList.contains("decrypto-dialog-open")) {
      const tab = dock.getBoundingClientRect();
      if (getComputedStyle(dock).position !== "fixed" || Math.abs(tab.right - innerWidth) > 1 || tab.top < 0 || tab.bottom > innerHeight) issues.push("Review must dock inside the right viewport edge");
      for (const control of document.querySelectorAll(".decrypto-main button, .decrypto-main select, .decrypto-main input, #decryptoHistory")) {
        if (!control.checkVisibility()) continue;
        const box = control.getBoundingClientRect();
        if (Math.min(box.right, tab.right) > Math.max(box.left, tab.left) && Math.min(box.bottom, tab.bottom) > Math.max(box.top, tab.top)) issues.push("Review dock overlaps " + control.id);
      }
      const workspace = document.querySelector("#decryptoPanel .decrypto-workspace");
      const top = workspace.getBoundingClientRect().top;
      dock.style.display = "none";
      if (Math.abs(workspace.getBoundingClientRect().top - top) > 1) issues.push("Review dock must not occupy a layout row");
      dock.style.removeProperty("display");
    }
    for (const row of document.querySelectorAll(".decrypto-result-table tbody tr")) {
      const actual = row.cells[row.cells.length - 2]?.querySelector(".decrypto-sequence-item");
      const guess = row.cells[row.cells.length - 1]?.querySelector(".decrypto-sequence-item");
      if (actual && guess && row.checkVisibility() && Math.abs(actual.getBoundingClientRect().top - guess.getBoundingClientRect().top) > 1) issues.push("Result positions do not align");
    }
    if (innerWidth <= 720) {
      const teams = document.getElementById("decryptoTeams");
      const keywordRow = teams.querySelector(":scope > .decrypto-keywords");
      if (keywordRow) {
        const box = keywordRow.getBoundingClientRect();
        const teamBox = teams.getBoundingClientRect();
        if (Math.abs(box.width - teamBox.width) > 1) issues.push("Own keywords must span both team summaries");
        const words = [...keywordRow.children].map((word) => word.getBoundingClientRect());
        if (words.length !== 4 || words.some((word) => Math.abs(word.top - words[0].top) > 1)) issues.push("Four keywords must share one row");
      }
      for (const card of teams.querySelectorAll(":scope > .decrypto-team")) {
        const last = [...card.children].filter((child) => child.checkVisibility()).at(-1);
        if (last && card.getBoundingClientRect().bottom - last.getBoundingClientRect().bottom > 8) issues.push("Team summary has empty keyword space");
      }
      for (const head of document.querySelectorAll(".decrypto-history-table thead")) {
        if (head.getBoundingClientRect().height > 20) issues.push("History number row is too tall");
      }
    }
    return { pageOverflow: document.documentElement.scrollWidth > innerWidth, issues };
  });
  assert.deepEqual(result, { pageOverflow: false, issues: [] }, label);
}

(async () => {
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  const errors = [];
  const context = await browser.newContext({ viewport: { width: 390, height: 900 }, isMobile: true, hasTouch: true });
  const page = await context.newPage();
  page.on("pageerror", (error) => errors.push(error.message));
  await page.route("https://fonts.googleapis.com/**", (route) => route.abort());
  try {
    await page.goto(base);
    await page.waitForFunction(() => typeof socket !== "undefined" && socket.connected && cachedGameList);
    assert.equal(await page.locator('script[src*="/decrypto.js"]').count(), 0);
    await page.evaluate(() => ensureGameAssets("decrypto"));
    await page.evaluate(() => { window.sendAction = (action) => window.decryptoTestActions.push(action); });
    await page.evaluate(() => ensureGameAssets("decrypto"));
    assert.equal(await page.locator('script[src*="/decrypto.js"]').count(), 1);

    for (const width of [320, 390, 1024, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      for (const name of Object.keys(fixtures)) {
        await render(page, name);
        await bounds(page, `${width}px / ${name}`);
        const hasReview = await page.locator("#decryptoSummary").isVisible();
        if (hasReview) await page.locator("#decryptoReviewCloseBtn").click();
        await page.locator("#decryptoHistoryBtn").click();
        await bounds(page, `${width}px / ${name} / open history`);
        if (width <= 720 && ["encryption", "guessing", "black_guessing"].includes(name)) {
          const compact = await page.evaluate(() => {
            const inlineLegends = [...document.querySelectorAll(".decrypto-history-heading")].every((heading) => {
              const title = heading.querySelector(".decrypto-team-header").getBoundingClientRect();
              return [...heading.querySelectorAll(".decrypto-player")].every((badge) => {
                const box = badge.getBoundingClientRect();
                return Math.abs((box.top + box.bottom) / 2 - (title.top + title.bottom) / 2) < 2;
              });
            });
            const teamHeight = document.getElementById("decryptoTeams").getBoundingClientRect().height;
            return { inlineLegends, teamHeight };
          });
          assert(compact.inlineLegends, `${width}px / ${name}: history title and player colors must share a row`);
          assert(compact.teamHeight <= 120, `${width}px / ${name}: team summaries and keywords should stay compact (${compact.teamHeight}px)`);
        }
        if (name === "guessing") {
          await page.screenshot({ path: `${output}/history-${width}.png`, fullPage: true });
        }
        await page.locator("#decryptoHistoryBtn").click();
        if (hasReview) await page.locator("#decryptoReviewBtn").click();
        if (["guessing", "round_end"].includes(name)) {
          await page.screenshot({ path: `${output}/${name}-${width}.png`, fullPage: true });
        }
      }
    }
    console.log(`All ${Object.keys(fixtures).length} states fit at 320, 390, 1024 and 1440px, including 6/8 players and long names. Mobile history headings share a row, number rows stay below 20px, and team cards have no empty keyword area.`);

    await render(page, "round_end");
    const resultRows = await page.locator(".decrypto-result-table tbody").evaluateAll((rows) => rows.map((row) => ({
      actor: row.dataset.decryptoActorTeam,
      target: row.dataset.decryptoTargetTeam,
      action: row.dataset.decryptoAction,
      outcome: row.querySelector(".decrypto-result-badge").textContent,
      orders: [...row.querySelectorAll(".decrypto-sequence-code")].map((element) => element.textContent),
      wrong: row.querySelectorAll(".decrypto-sequence-item.is-wrong").length,
    })));
    assert.deepEqual(resultRows, [
      { actor: "white", target: "white", action: "decrypt", outcome: "✓ Correct", orders: ["1 → 2 → 3", "1 → 2 → 3"], wrong: 0 },
      { actor: "white", target: "black", action: "intercept", outcome: "✓ Correct", orders: ["4 → 2 → 1", "4 → 2 → 1"], wrong: 0 },
      { actor: "black", target: "black", action: "decrypt", outcome: "✗ Wrong", orders: ["4 → 2 → 1", "4 → 1 → 2"], wrong: 2 },
      { actor: "black", target: "white", action: "intercept", outcome: "✗ Wrong", orders: ["1 → 2 → 3", "1 → 3 → 2"], wrong: 2 },
    ]);
    const summaryText = await page.locator("#decryptoSummaryBody").innerText();
    for (const word of ["海洋", "水果", "时钟", "蓝色", "宇宙", "树叶", "山顶"]) assert(summaryText.includes(word));
    for (const secret of ["高山", "森林", "草原", "火焰"]) assert(!summaryText.includes(secret), "Opponent keyword leaked: " + secret);
    assert.equal(await page.locator(".decrypto-result-table.decrypto-own-team").count(), 1);

    const colors = await page.evaluate(() => {
      const playerColors = Object.fromEntries([...document.querySelectorAll("#decryptoTeams .decrypto-player")].map((element) => [element.dataset.decryptoPlayer, getComputedStyle(element).backgroundColor]));
      const clues = [...document.querySelectorAll("#decryptoHistory .decrypto-history-clue")];
      return { values: Object.values(playerColors), authors: [...new Set(clues.map((clue) => clue.dataset.decryptoPlayer))].sort(), matches: clues.every((clue) => getComputedStyle(clue).backgroundColor === playerColors[clue.dataset.decryptoPlayer]) };
    });
    assert.equal(new Set(colors.values).size, 4);
    assert.deepEqual(colors.authors, ["p1", "p2", "p3", "p4"]);
    assert(colors.matches);
    await page.locator("#decryptoNextRoundBtn").click();
    assert.deepEqual(await page.evaluate(() => decryptoTestActions), [{ type: "next_round" }]);
    await render(page, "ready");
    assert.equal(await page.locator("#decryptoNextRoundBtn").isDisabled(), true);
    assert.match(await page.locator("#decryptoReadyStatus").innerText(), /1\/4 ready/);
    for (const name of ["round_end", "game_over", "legacy_review", "legacy_final", "legacy_spectator"]) {
      await render(page, name);
      const content = await page.locator("#decryptoPanel").textContent();
      const attributes = await page.locator("#decryptoPanel [data-decrypto-tip]").evaluateAll((elements) => elements.map((element) => element.dataset.decryptoTip).join(" "));
      const secrets = name === "legacy_spectator" ? ["海洋", "水果", "时钟", "星球", "高山", "森林", "草原", "火焰"] : ["高山", "森林", "草原", "火焰"];
      for (const secret of secrets) {
        assert(!content.includes(secret), `${name}: secret visible in markup: ${secret}`);
        assert(!attributes.includes(secret), `${name}: secret visible in a tooltip: ${secret}`);
      }
    }
    console.log("Four player colors and all four actor/target result rows are correct; hidden words remain private.");

    await page.setViewportSize({ width: 390, height: 900 });
    await render(page, "guessing");
    assert.deepEqual(await page.locator("#decryptoInterceptSelect1 option").allTextContents(), ["-", "1", "2. 林海", "3. 平原", "4. 炊烟"]);
    await page.locator("#decryptoInterceptSelect1").selectOption("4");
    await page.locator("#decryptoInterceptSelect2").selectOption("2");
    assert.equal(await page.locator('#decryptoInterceptSelect3 option[value="4"]').isDisabled(), true);
    assert.equal(await page.locator("#decryptoHistoryBtn").getAttribute("aria-expanded"), "false");
    assert.equal(await page.locator("#decryptoHistory").isVisible(), false);
    assert.equal(await page.locator("#decryptoReference #decryptoHistory").count(), 0);
    assert.equal(await page.locator("#decryptoHistoryDock #decryptoHistory").count(), 1);
    const encryptor = page.locator("#decryptoTeams .decrypto-encryptor").first();
    await encryptor.tap();
    assert.match(await page.locator("#decryptoTooltip").innerText(), /Bob.*Encryptor/);
    assert.equal(await encryptor.locator(".decrypto-player-role").isVisible(), false);
    await page.keyboard.press("Escape");
    await page.locator("#decryptoHistoryBtn").tap();
    assert.equal(await page.evaluate(() => document.body.classList.contains("decrypto-dialog-open")), false);
    await bounds(page, "390px bottom history dock");
    const clues = page.locator("#decryptoHistory .decrypto-history-clue");
    await clues.first().tap();
    assert.match(await page.locator("#decryptoTooltip").innerText(), /Alice.*Round 1/);
    await clues.nth(3).tap();
    assert.match(await page.locator("#decryptoTooltip").innerText(), /Cara.*Round 1/);
    await page.waitForTimeout(3100);
    assert.equal(await page.locator("#decryptoTooltip").isVisible(), false);
    await page.screenshot({ path: `${output}/history-390.png`, fullPage: true });
    await page.keyboard.press("Escape");
    assert.equal(await page.locator("#decryptoHistory").isVisible(), false);
    assert.equal(await page.locator("#decryptoHistoryBtn").getAttribute("aria-expanded"), "false");
    assert.equal(await page.locator("#decryptoInterceptSelect1").inputValue(), "4");
    assert.equal(await page.locator("#decryptoInterceptSelect2").inputValue(), "2");
    await page.locator("#decryptoInterceptSelect3").selectOption("1");
    await page.locator("#decryptoSubmitInterceptBtn").click();
    assert.deepEqual(await page.evaluate(() => decryptoTestActions), [{ type: "submit_intercept", guess: [4, 2, 1] }]);

    await render(page, "partial_intercept");
    assert.equal(await page.locator("#decryptoInterceptSelect1").inputValue(), "4");
    assert.equal(await page.locator("#decryptoInterceptSelect1").isDisabled(), true);
    assert.match(await page.locator("#decryptoStatusBody").innerText(), /opponent team intercept/);
    await render(page, "long_content");
    const labels = await page.locator("#decryptoInterceptSelect1 option").allTextContents();
    for (const label of labels.slice(1)) {
      const preview = label.includes(". ") ? label.split(". ")[1] : "";
      assert(Array.from(preview).length <= 10, label);
    }
    assert(labels[1].endsWith("…"));
    assert.equal(labels[4], "4");
    assert.equal(await page.locator("#decryptoPanel img").count(), 0);
    assert.equal(await page.evaluate(() => trimDecryptoPreview("  a  b   ")), "a b");
    assert.equal(await page.evaluate(() => Array.from(trimDecryptoPreview("🌊".repeat(12))).length), 10);
    await page.locator("#decryptoHistoryBtn").tap();
    const historyCell = page.locator("#decryptoHistory .decrypto-history-clue").first();
    const touchPoint = await historyCell.boundingBox();
    const session = await context.newCDPSession(page);
    const touchX = touchPoint.x + touchPoint.width / 2;
    const touchY = touchPoint.y + Math.min(20, touchPoint.height / 2);
    await session.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: touchX, y: touchY }] });
    for (const distance of [15, 35, 60, 90]) {
      await session.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: touchX, y: touchY - distance }] });
      await page.waitForTimeout(25);
    }
    await session.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
    assert.equal(await page.locator("#decryptoTooltip").isVisible(), false);
    await session.detach();
    const historyScroll = await page.locator("#decryptoHistory").evaluate((element) => {
      element.scrollTop = 120;
      return element.scrollTop;
    });
    assert(historyScroll > 0, "Long history must scroll inside the dock");
    await page.evaluate(() => renderDecryptoGameState({ view: currentDecryptoView }));
    assert.equal(await page.locator("#decryptoHistory").evaluate((element) => element.scrollTop), historyScroll);
    await page.keyboard.press("Escape");
    await page.evaluate(() => renderDecryptoGameState({ view: currentDecryptoView }));
    await page.locator("#decryptoHistoryBtn").focus();
    await page.keyboard.press("Enter");
    assert.equal(await page.locator("#decryptoHistory").evaluate((element) => element.scrollTop), historyScroll);
    await page.keyboard.press("Tab");
    assert.equal(await page.evaluate(() => document.activeElement.id), "decryptoHistory");
    await page.keyboard.press("Escape");
    assert.equal(await page.evaluate(() => document.activeElement.id), "decryptoHistoryBtn");
    console.log("Bottom History supports keyboard toggling, Esc and touch scrolling; updates preserve its scroll position and intercept selections.");

    await render(page, "next_encryption");
    await page.locator("#decryptoClue1").fill("保留草稿");
    await page.locator("#decryptoHistoryBtn").tap();
    await page.evaluate(() => renderDecryptoGameState({ view: currentDecryptoView }));
    assert.equal(await page.locator("#decryptoClue1").inputValue(), "保留草稿");
    await page.locator("#decryptoHelpBtn").click();
    await page.keyboard.press("Escape");
    assert.equal(await page.locator("#decryptoHistory").isVisible(), true, "Esc closes Help before History");
    await page.locator("#decryptoExplainBtn").click();
    await page.keyboard.press("Escape");
    assert.equal(await page.locator("#decryptoHistory").isVisible(), true, "Esc exits Explain before History");
    await page.locator("#decryptoReviewBtn").click();
    await page.keyboard.press("Escape");
    assert.equal(await page.locator("#decryptoHistory").isVisible(), true, "Esc closes Review before History");
    await page.keyboard.press("Escape");
    assert.equal(await page.locator("#decryptoClue1").inputValue(), "保留草稿");
    await page.locator("#decryptoExplainBtn").click();
    await page.locator("#decryptoHistoryBtn").tap();
    assert.match(await page.locator("#decryptoExplainContent").innerText(), /bottom history dock/);
    assert.equal(await page.locator("#decryptoHistory").isVisible(), false, "Explain must not toggle the dock");
    await page.keyboard.press("Escape");
    await page.locator("#decryptoHistoryBtn").tap();
    await page.evaluate(() => setGamePanelVisibility(null));
    assert.equal(await page.locator("#decryptoHistoryDock").isVisible(), false);
    await page.evaluate(() => setGamePanelVisibility("decrypto"));
    assert.equal(await page.locator("#decryptoHistoryBtn").isVisible(), true);
    assert.equal(await page.locator("#decryptoHistory").isVisible(), false);
    await page.evaluate(() => clearDecryptoState());
    assert.equal(await page.locator("#decryptoHistoryDock").isVisible(), false);

    await render(page, "guessing");
    await page.locator("#decryptoExplainBtn").click();
    const disabled = page.locator("#decryptoSubmitDecryptBtn");
    await disabled.scrollIntoViewIfNeeded();
    const box = await disabled.boundingBox();
    await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
    assert.equal(await page.locator("#decryptoExplainModal").isVisible(), true);
    assert.match(await page.locator("#decryptoExplainContent").innerText(), /Submit Decrypt/);
    assert.deepEqual(await page.evaluate(() => decryptoTestActions), []);
    await page.keyboard.press("Escape");
    await page.locator("#decryptoDecryptSelect1").selectOption("1");
    await page.locator("#decryptoDecryptSelect2").selectOption("2");
    await page.locator("#decryptoDecryptSelect3").selectOption("3");
    await page.locator("#decryptoExplainBtn").click();
    await page.locator("#decryptoSubmitDecryptBtn").tap();
    assert.equal(await page.locator("#decryptoExplainModal").isVisible(), true);
    assert.deepEqual(await page.evaluate(() => decryptoTestActions), []);
    await page.keyboard.press("Escape");
    await page.locator("#decryptoSubmitDecryptBtn").tap();
    assert.deepEqual(await page.evaluate(() => decryptoTestActions), [{ type: "submit_decrypt", guess: [1, 2, 3] }]);
    await page.locator("#decryptoExplainBtn").click();
    await page.evaluate(() => {
      const button = document.createElement("button");
      button.id = "decryptoUnexplainedTest";
      button.textContent = "Unexplained";
      button.onclick = () => decryptoTestActions.push({ type: "unexpected" });
      document.getElementById("decryptoDecryptArea").appendChild(button);
      button.click();
      button.remove();
    });
    assert.equal(await page.locator("#decryptoExplainModal").isVisible(), false);
    assert.deepEqual(await page.evaluate(() => decryptoTestActions), [{ type: "submit_decrypt", guess: [1, 2, 3] }]);
    await page.keyboard.press("Escape");

    for (const width of [320, 390, 1024, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      await render(page, "round_end");
      assert.equal(await page.locator("#decryptoSummary").isVisible(), true);
      await bounds(page, `${width}px automatic round review`);
      await page.locator("#decryptoReviewExplainBtn").click();
      await page.locator("#decryptoSummaryBody caption").first().click();
      assert.match(await page.locator("#decryptoExplainContent").innerText(), /Round Results/);
      await bounds(page, `${width}px Explain`);
      await page.keyboard.press("Escape");
      assert.equal(await page.locator("#decryptoSummary").isVisible(), true);
      await page.keyboard.press("Escape");
      assert.equal(await page.locator("#decryptoSummary").isVisible(), false);
      assert.deepEqual(await page.evaluate(() => decryptoTestActions), [], "Closing review must not confirm readiness.");
      await page.evaluate(() => renderDecryptoGameState({ view: currentDecryptoView }));
      assert.equal(await page.locator("#decryptoSummary").isVisible(), false, "An unchanged state must not reopen a dismissed review.");
      await page.locator("#decryptoHelpBtn").click();
      await bounds(page, `${width}px Help`);
      await page.keyboard.press("Escape");
      assert.equal(await page.locator("#decryptoHelpModal").isVisible(), false);
      await page.locator("#decryptoReviewBtn").click();
      assert.equal(await page.locator("#decryptoSummary").isVisible(), true);
      assert.equal(await page.locator("#decryptoReviewBtn").getAttribute("aria-expanded"), "true");
      await page.locator("#decryptoReviewCloseBtn").click();
      assert.equal(await page.locator("#decryptoReviewBtn").getAttribute("aria-expanded"), "false");
      assert.equal(await page.locator("#decryptoReviewBtn").getAttribute("aria-label"), "Last Round Review · 2");
      assert.equal(await page.locator("#decryptoHistory").isVisible(), false);
      assert.equal(await page.locator("#decryptoHistoryBtn").isVisible(), true);
    }
    await render(page, "game_over");
    assert.equal(await page.locator("#decryptoNextRoundBtn").isVisible(), false);
    assert.equal(await page.locator("#decryptoSummary").isVisible(), true);
    await page.evaluate(() => setGamePanelVisibility(null));
    assert.equal(await page.evaluate(() => document.body.classList.contains("decrypto-needs-action")), false);
    assert.equal(await page.locator("#decryptoSummary").isVisible(), false);

    const desktopContext = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const desktop = await desktopContext.newPage();
    desktop.on("pageerror", (error) => errors.push(error.message));
    await desktop.route("https://fonts.googleapis.com/**", (route) => route.abort());
    await desktop.goto(base);
    await desktop.waitForFunction(() => typeof socket !== "undefined" && socket.connected && cachedGameList);
    await desktop.evaluate(() => ensureGameAssets("decrypto"));
    await render(desktop, "round_end");
    await desktop.locator("#decryptoReviewCloseBtn").click();
    await desktop.locator("#decryptoHistoryBtn").click();
    await desktop.locator("#decryptoHistory .decrypto-history-clue").first().hover();
    assert.match(await desktop.locator("#decryptoTooltip").innerText(), /Alice.*Round 1/);
    await desktop.mouse.move(1, 1);
    assert.equal(await desktop.locator("#decryptoTooltip").isVisible(), false);
    for (const side of ["left", "right", "top", "bottom"]) {
      await desktop.evaluate((side) => applyRoomControlsDockSide(side), side);
      await bounds(desktop, `1440px History with ${side} room controls`);
      const roomControlsAccessible = await desktop.locator("#roomControlsToggleBtn").evaluate((button) => {
        const box = button.getBoundingClientRect();
        return button.contains(document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2));
      });
      assert(roomControlsAccessible, "Room controls must stay above History");
      if (side === "bottom") {
        const historyBox = await desktop.locator("#decryptoHistoryDock").boundingBox();
        const controlsBox = await desktop.locator("#roomControlsPanel").boundingBox();
        assert(historyBox.y + historyBox.height <= controlsBox.y, "Bottom room controls need their own space");
        await desktop.screenshot({ path: `${output}/history-room-controls-1440.png`, fullPage: true });
      }
    }
    await desktopContext.close();

    const liveContexts = [];
    const livePages = [];
    const serverErrors = [];
    let liveRoomId = null;
    for (const name of ["Decrypto Alice", "Decrypto Bob", "Decrypto Cara", "Decrypto Dan"]) {
      const liveContext = await browser.newContext({ viewport: { width: 1024, height: 900 } });
      liveContexts.push(liveContext);
      const livePage = await liveContext.newPage();
      livePages.push(livePage);
      livePage.on("pageerror", (error) => errors.push(error.message));
      await livePage.route("https://fonts.googleapis.com/**", (route) => route.abort());
      await livePage.goto(base);
      await livePage.waitForFunction(() => typeof socket !== "undefined" && socket.connected && cachedGameList);
      await livePage.evaluate(() => {
        window.decryptoServerErrors = [];
        socket.on("system:error", (payload) => decryptoServerErrors.push(payload));
      });
      await livePage.evaluate(({ name, room }) => {
        socket.emit(room ? "room:join" : "room:create", room ? { name, room_id: room } : { name, game_type: "decrypto" });
      }, { name, room: liveRoomId });
      await livePage.waitForFunction(() => roomSessionReady && currentGameType === "decrypto" && isGameAssetsLoaded("decrypto"));
      if (!liveRoomId) liveRoomId = await livePage.evaluate(() => roomId);
      await livePage.evaluate(() => socket.emit("room:ready", { ready: true }));
    }
    const host = livePages[0];
    await host.waitForFunction(() => currentRoomState.players.length === 4 && currentRoomState.players.every((player) => player.ready));
    await host.evaluate(() => socket.emit("room:start", {}));
    await Promise.all(livePages.map((livePage) => livePage.waitForFunction(() => typeof currentDecryptoView !== "undefined" && currentDecryptoView?.phase === "encryption")));
    const codes = new Map();
    for (const livePage of livePages) {
      const view = await livePage.evaluate(() => currentDecryptoView);
      if (!view.is_encryptor) continue;
      codes.set(view.team_id, view.current_code);
      for (const [index, clue] of ["清晨", "阳光", "旅程"].entries()) {
        await livePage.locator(`#decryptoClue${index + 1}`).fill(clue);
      }
      await livePage.locator("#decryptoSubmitCluesBtn").click();
    }
    await Promise.all(livePages.map((livePage) => livePage.waitForFunction(() => currentDecryptoView.phase === "guessing")));
    for (const livePage of livePages) {
      const view = await livePage.evaluate(() => currentDecryptoView);
      if (view.is_encryptor) continue;
      for (const [index, number] of codes.get(view.team_id).entries()) {
        await livePage.locator(`#decryptoDecryptSelect${index + 1}`).selectOption(String(number));
      }
      await livePage.locator("#decryptoSubmitDecryptBtn").click();
    }
    await Promise.all(livePages.map((livePage) => livePage.waitForFunction(() => currentDecryptoView.phase === "round_end")));
    for (const livePage of livePages.slice(0, 3)) {
      await livePage.locator("#decryptoNextRoundBtn").click();
      await livePage.waitForFunction(() => currentDecryptoView.next_round_ready.includes(currentDecryptoView.you));
    }
    await livePages[3].waitForFunction(() => currentDecryptoView.next_round_ready.length === 3);
    assert.equal(await livePages[3].evaluate(() => currentDecryptoView.round), 1);
    await host.reload();
    await host.waitForFunction(() => roomSessionReady && typeof currentDecryptoView !== "undefined" && currentDecryptoView?.phase === "round_end");
    assert.equal(await host.locator("#decryptoNextRoundBtn").isDisabled(), true);
    assert.equal(await host.evaluate(() => currentDecryptoView.next_round_ready.length), 3);
    await livePages[3].locator("#decryptoNextRoundBtn").click();
    await Promise.all(livePages.map((livePage) => livePage.waitForFunction(() => currentDecryptoView.round === 2 && currentDecryptoView.phase === "encryption")));
    for (const livePage of livePages) {
      serverErrors.push(...await livePage.evaluate(() => window.decryptoServerErrors || []));
      assert.equal(await livePage.locator("#decryptoSummary").isVisible(), false);
      await livePage.evaluate(() => new Promise((resolve) => socket.emit("room:leave", {}, resolve)));
    }
    await Promise.all(liveContexts.map((liveContext) => liveContext.close()));
    assert.deepEqual(serverErrors, []);
    console.log("Four live clients submit clues/decrypt, wait for all confirmations, reconnect during review, then start round 2 through server schema validation.");

    assert.deepEqual(errors, []);
    console.log("Help, Explain on disabled/enabled/unexplained controls, Esc, touch scrolling, desktop hover, round confirmation and game switching passed.");
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
