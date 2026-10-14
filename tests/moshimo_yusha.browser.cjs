// Run against a local server with PLAYWRIGHT_MODULE pointing to Playwright.
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const { execFileSync } = require("node:child_process");
const base = process.env.ROOM_TEST_URL || "http://127.0.0.1:8151";
const output = "build/moshimo-yusha-ui";
fs.mkdirSync(output, { recursive: true });
const fixtures = JSON.parse(
    execFileSync(
        process.env.PYTHON || "python3",
        [
            "-c",
            `
import json,copy
from tests.test_moshimo_yusha import make_state,prepare,apply,confirm_all
from game.moshimo_yusha import MoshimoYushaGame as G,_score_match
s=make_state(7)
s['players']['p1']['name']='LongUnbrokenPlayerNameForMobileOverflowVerification'
s['players']['p2']['name']='名字非常长的玩家用于移动端布局检查'
v={'setup':G.get_public_view(s,'p0'),'spectator':G.get_public_view(s,'guest')}
for pid in s['turn_order']:apply(s,pid,'discard',card_ids=[1,2])
v['setup_review']=G.get_public_view(s,'p0')
confirm_all(s)
v['playing']=G.get_public_view(s,'p0')
for i,pid in enumerate(s['turn_order']):apply(s,pid,'play',card_id=7 if i==0 else 3)
v['passing']=G.get_public_view(s,'p0')
for pid in s['turn_order']:apply(s,pid,'pass_card',card_id=5)
v['review']=G.get_public_view(s,'p0')
for pid in s['turn_order']:s['players'][pid]['hand']=[6]
_score_match(s)
v['match_review']=G.get_public_view(s,'p0')
_score_match(s)
v['finished']=G.get_public_view(s,'p0')
print(json.dumps(v))
`,
        ],
        { encoding: "utf8" },
    ),
);

async function bounds(page, label) {
    const result = await page.evaluate(() => {
        const bad = [...document.querySelectorAll("#moshimoYushaPanel *, #moshimoYushaDialog *")]
            .filter((el) => {
                const r = el.getBoundingClientRect(),
                    s = getComputedStyle(el);
                return (
                    r.width &&
                    r.height &&
                    (r.left < -1 ||
                        r.right > innerWidth + 1 ||
                        (el.clientWidth &&
                            el.scrollWidth > el.clientWidth + 1 &&
                            !["auto", "scroll", "hidden"].includes(s.overflowX)))
                );
            })
            .map(
                (el) =>
                    `${el.id || el.className}: ${el.textContent.slice(0, 40)} (${el.clientWidth}/${el.scrollWidth})`,
            );
        return { width: innerWidth, scroll: document.documentElement.scrollWidth, bad };
    });
    assert(result.scroll <= result.width, `${label}: page overflow ${JSON.stringify(result)}`);
    assert.deepEqual(result.bad, [], `${label}: container overflow`);
}
async function render(page, key) {
    await page.evaluate(
        (view) =>
            renderMoshimoYushaGameState({ room_id: roomId, game_type: "moshimo_yusha", view }),
        fixtures[key],
    );
}
async function pointClick(page, locator, touch = false) {
    await locator.scrollIntoViewIfNeeded();
    const r = await locator.boundingBox();
    if (touch) await page.touchscreen.tap(r.x + r.width / 2, r.y + r.height / 2);
    else await page.mouse.click(r.x + r.width / 2, r.y + r.height / 2);
}
async function choose(page, ids) {
    const revision = await page.evaluate(() => lastGameStatePayload.view.revision);
    for (const id of ids)
        await page.locator(`#myHand [aria-label^="${id} "]:not(.is-selected)`).first().click();
    await page.locator("#myConfirm").click();
    await page.waitForFunction((rev) => lastGameStatePayload.view.revision > rev, revision);
}
async function nextAll(pages) {
    const old = await pages[0].evaluate(() => lastGameStatePayload.view.window_id);
    for (const [i, page] of pages.entries()) {
        await page.locator("#myNext").click();
        if (i < pages.length - 1)
            assert.equal(await page.evaluate(() => lastGameStatePayload.view.window_id), old);
    }
    for (const p of pages)
        await p.waitForFunction((w) => lastGameStatePayload.view.window_id > w, old);
}
(async () => {
    const browser = await chromium.launch({ channel: "chrome", headless: true });
    const contexts = [],
        pages = [],
        errors = [];
    async function newPage() {
        const context = await browser.newContext({
            viewport: { width: 1440, height: 1100 },
            hasTouch: true,
        });
        const p = await context.newPage();
        contexts.push(context);
        pages.push(p);
        p.on("pageerror", (e) => errors.push(e.message));
        await p.route("https://fonts.googleapis.com/**", (r) => r.abort());
        await p.goto(base);
        await p.waitForFunction(
            () => typeof socket !== "undefined" && socket.connected && cachedGameList,
        );
        return p;
    }
    try {
        for (let i = 0; i < 3; i++) await newPage();
        const page = pages[0],
            group = pages.slice();
        assert.equal(
            await page.locator("#moshimoYushaPanel").evaluate((el) => el.children.length),
            0,
        );
        assert.equal(await page.locator('script[src*="games/moshimo_yusha.js"]').count(), 0);
        await page.evaluate(() =>
            socket.emit("room:create", {
                name: "Hero",
                game_type: "moshimo_yusha",
                config: { seed: 151 },
            }),
        );
        await page.waitForFunction(() => isGameAssetsLoaded("moshimo_yusha"));
        await page.locator("#moshimoYushaHelpBtn").click();
        assert((await page.locator("#myDialogBody").innerText()).includes("异世界勇者"));
        await page.keyboard.press("Escape");
        const room = await page.evaluate(() => roomId);
        for (let i = 1; i < 3; i++) {
            await pages[i].evaluate(
                ({ room, i }) => socket.emit("room:join", { room_id: room, name: `Player ${i}` }),
                { room, i },
            );
            await pages[i].waitForFunction(() => isGameAssetsLoaded("moshimo_yusha"));
        }
        for (const p of group) await p.evaluate(() => socket.emit("room:ready", { ready: true }));
        await page.waitForFunction(
            () =>
                currentRoomState.players.length === 3 &&
                currentRoomState.players.every((p) => p.ready),
        );
        await page.locator("#startBtn").click();
        for (const p of group)
            await p.waitForFunction(() => lastGameStatePayload?.view.phase === "setup_discard");
        await choose(page, [1, 2]);
        const saved = await page.evaluate(() => ({
            room: roomId,
            player: playerId,
            window: lastGameStatePayload.view.window_id,
        }));
        await page.reload();
        await page.waitForFunction(
            (s) =>
                roomId === s.room &&
                playerId === s.player &&
                isGameAssetsLoaded("moshimo_yusha") &&
                lastGameStatePayload?.view.window_id === s.window,
            saved,
        );
        assert(await page.locator("#myConfirm").isDisabled());
        assert.equal(await page.locator("#myHand .my-card").count(), 5);
        for (const p of group.slice(1)) await choose(p, [1, 2]);
        for (const p of group)
            await p.waitForFunction(() => lastGameStatePayload.view.phase === "setup_review");
        await nextAll(group);
        for (const [i, p] of group.entries()) await choose(p, [[7], [3], [4]][i]);
        for (const p of group)
            await p.waitForFunction(() => lastGameStatePayload.view.phase === "pass_cards");
        for (const [i, p] of group.entries()) await choose(p, [[3], [4], [5]][i]);
        await page.waitForFunction(() => lastGameStatePayload.view.phase === "round_review");
        assert((await page.locator("#myExchange").innerText()).includes("Received"));
        assert.equal(await page.locator('#myHand [aria-label^="5 "]').count(), 2);
        await nextAll(group);
        for (const round of [
            [5, 7, 7],
            [5, 5, 3],
            [4, 3, 4],
        ]) {
            for (const [i, p] of group.entries()) await choose(p, [round[i]]);
            for (const p of group)
                await p.waitForFunction(() => lastGameStatePayload.view.phase === "round_review");
            await nextAll(group);
        }
        assert.equal(await page.evaluate(() => lastGameStatePayload.view.phase), "match_review");
        assert.equal(await page.locator("#myFinalRows .my-review-row").count(), 3);
        await nextAll(group);
        assert.equal(await page.evaluate(() => lastGameStatePayload.view.match_number), 2);
        for (const p of group) await choose(p, [1, 2]);
        await nextAll(group);
        for (const cid of [3, 4, 5, 7]) {
            for (const p of group) await choose(p, [cid]);
            await nextAll(group);
        }
        assert.equal(await page.evaluate(() => lastGameStatePayload.view.phase), "game_over");
        assert.equal(await page.evaluate(() => lastGameStatePayload.view.winner_ids.length), 3);
        console.log(
            "PASS real multiplayer: private discard, reload, four rounds, lone/multiple Jester, duplicate hands, all-player reviews, reset and shared victory",
        );

        const solo = await newPage();
        await solo.evaluate(() =>
            socket.emit("room:create", { name: "Solo", game_type: "moshimo_yusha" }),
        );
        await solo.waitForFunction(() => isGameAssetsLoaded("moshimo_yusha"));
        await solo.evaluate(() => socket.emit("room:ready", { ready: true }));
        await solo.locator("#startBtn").click();
        await solo.waitForFunction(() => lastGameStatePayload?.view.phase === "setup_discard");
        assert.equal(
            await solo.evaluate(
                () => lastGameStatePayload.view.players.filter((p) => p.is_senate).length,
            ),
            2,
        );
        await choose(solo, [1, 2]);
        await nextAll([solo]);
        await choose(solo, [7]);
        await solo.waitForFunction(() => lastGameStatePayload.view.phase === "round_review");
        await nextAll([solo]);
        console.log("PASS real solo game with two Senate seats and automated draws");

        await page.evaluate(() => {
            window.myTestActions = [];
            window.sendAction = (a) => window.myTestActions.push(a);
        });
        await render(page, "setup");
        await page.evaluate(() => setRoomControlsCollapsed(true));
        assert(
            await page.locator("body").evaluate((el) => el.classList.contains("my-needs-action")),
        );
        assert.equal(
            await page
                .locator("#roomControlsPanel")
                .evaluate((el) => getComputedStyle(el).borderTopColor),
            "rgb(189, 75, 75)",
        );
        await page.locator("#moshimoYushaHelpBtn").click();
        await bounds(page, "desktop help");
        await page.keyboard.press("Escape");
        assert.equal(await page.locator("#moshimoYushaDialog").evaluate((el) => el.open), false);
        await page.locator("#moshimoYushaExplainBtn").click();
        await pointClick(page, page.locator("#myConfirm"));
        assert.equal(await page.locator("#moshimoYushaDialog").evaluate((el) => el.open), true);
        assert.equal(await page.evaluate(() => myTestActions.length), 0);
        await page.keyboard.press("Escape");
        await page.locator("#myHand .my-card").first().click();
        await page.locator(".my-brand h2").click();
        assert.equal(await page.locator(".my-card.is-selected").count(), 0);
        await page.locator("#myHand .my-card").first().click();
        await page.keyboard.press("Escape");
        assert.equal(await page.locator(".my-card.is-selected").count(), 0);
        await page.locator("#moshimoYushaExplainBtn").click();
        await page.evaluate(() => {
            const b = document.createElement("button");
            b.id = "myUnexplained";
            b.textContent = "Unexplained";
            b.onclick = () => myTestActions.push("unwanted");
            document.getElementById("moshimoYushaPanel").append(b);
        });
        await page.locator("#myUnexplained").click();
        assert.equal(await page.evaluate(() => myTestActions.length), 0);
        await page.keyboard.press("Escape");
        await page.locator("#myUnexplained").evaluate((el) => el.remove());
        for (const width of [1440, 390, 320]) {
            await page.setViewportSize({ width, height: width === 1440 ? 1100 : 900 });
            for (const key of Object.keys(fixtures)) {
                await render(page, key);
                await bounds(page, `${width} ${key}`);
            }
            await render(page, "setup");
            const last = page.locator("#myHand .my-card").last();
            await last.scrollIntoViewIfNeeded();
            const top = await page.locator("#myHand").evaluate((el) => el.scrollTop);
            await last.click();
            assert.equal(await page.locator("#myHand").evaluate((el) => el.scrollTop), top);
            const second = page.locator("#myHand .my-card").nth(5);
            await second.scrollIntoViewIfNeeded();
            const secondTop = await page.locator("#myHand").evaluate((el) => el.scrollTop);
            await second.click();
            assert.equal(await page.locator(".my-card.is-selected").count(), 2);
            assert.equal(await page.locator("#myHand").evaluate((el) => el.scrollTop), secondTop);
            await page.keyboard.press("Escape");
            await page.locator("#moshimoYushaHelpBtn").click();
            await bounds(page, `${width} help`);
            await page.keyboard.press("Escape");
            const gold = page.locator(".my-gold").first();
            await gold.hover();
            assert.equal(await page.locator("#myTooltip").isVisible(), true);
            if (width < 600) {
                await pointClick(page, gold, true);
                assert.equal(await page.locator("#myTooltip").isVisible(), true);
                await pointClick(page, page.locator(".my-faith").first(), true);
                assert((await page.locator("#myTooltip").innerText()).includes("Faith"));
                await page.waitForTimeout(3150);
                assert.equal(await page.locator("#myTooltip").isVisible(), false);
            }
            await page.locator("#myHand").evaluate((el) => (el.scrollTop = 0));
            await page.evaluate(() => window.scrollTo(0, 0));
            await page.screenshot({ path: `${output}/${width}.png`, fullPage: true });
            await render(page, "review");
            await page.screenshot({ path: `${output}/${width}-review.png`, fullPage: true });
        }
        await page.evaluate(() => socket.disconnect());
        assert(await page.locator("#myNext").isDisabled());
        assert((await page.locator("#myStatus").innerText()).includes("Disconnected"));
        await page.evaluate(() => socket.connect());
        await page.waitForFunction(() => socket.connected);
        await page.evaluate(() => setRoomControlsCollapsed(false));
        await page.locator("#leaveBtn").click();
        await page.waitForFunction(() => !currentRoomState);
        await page.evaluate(() =>
            socket.emit("room:create", { name: "New table", game_type: "moshimo_yusha" }),
        );
        await page.waitForFunction(() => currentRoomState?.status === "lobby");
        assert.equal(await page.locator("#myProgress").innerText(), "");
        assert.equal(await page.locator("#myHandTitle").innerText(), "Your hand");
        assert.equal(await page.locator("#myHand .my-card").count(), 0);
        assert.equal(await page.locator('script[src*="games/moshimo_yusha.js"]').count(), 1);
        assert.equal(
            await page.locator("body").evaluate((el) => el.classList.contains("my-needs-action")),
            false,
        );
        assert.deepEqual(errors, []);
        console.log(
            "PASS lazy loading, Help/Explain, disabled controls, Esc, blank deselection, stable scroll, tooltips, all phases at 1440/390/320, disconnect and leave",
        );
    } catch (error) {
        console.error("Browser errors:", errors);
        for (const [i, page] of pages.entries()) {
            console.error(
                "Page",
                i,
                await page.evaluate(() => ({
                    phase: lastGameStatePayload?.view.phase,
                    legal: lastGameStatePayload?.view.legal_actions,
                    html: document.getElementById("moshimoYushaPanel")?.innerText.slice(0, 1500),
                })),
            );
            await page.screenshot({ path: `${output}/failure-${i}.png`, fullPage: true });
        }
        throw error;
    } finally {
        for (const c of contexts) await c.close();
        await browser.close();
    }
})().catch((e) => {
    console.error(e);
    process.exitCode = 1;
});
