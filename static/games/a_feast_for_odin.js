(() => {
    "use strict";
    const panel = document.getElementById("odinPanel");
    const root = document.getElementById("odinRoot");
    const header = document.getElementById("odinHeaderActions");
    const help = document.getElementById("odinHelpBtn");
    const explain = document.getElementById("odinExplainBtn");
    const dialog = document.getElementById("odinDialog");
    const tip = document.getElementById("odinTip");
    const colors = {orange:"#cb8c36", red:"#b55e55", green:"#519677", blue:"#538fa7", silver:"#899fa4", ore:"#526d85", wood:"#92724d", stone:"#818580"};
    const playerColors = ["#d6b367", "#7ec4b3", "#8fadd9", "#cc96ac"];
    const groups = {build:"🏠 建造", hunt:"🏹 狩猎", market:"🌾 生产", craft:"🔨 工艺", trade:"🔄 交易", sail:"⛵ 航海", occupation:"📜 职业"};
    const phases = {action:"行动阶段", prepare:"准备收入", feast:"宴会", round_end:"本轮回顾", final_placement:"最终摆放", game_over:"终局"};
    const ODIN_EXPLAIN = {
        home: { zh: "家园(🏡)：可放绿色货物(🟩)、蓝色货物(🟦)、矿石(🔷)和银币(🪙)。不同绿块不能正交相邻。每个未盖 −1 格扣 1 分，空白格不扣分。", en: "Home board (🏡): accepts green goods (🟩), blue goods (🟦), ore (🔷) and silver (🪙). Two different green tiles may never touch orthogonally. Every uncovered −1 square costs 1 point, while blank squares cost nothing." },
        income: { zh: "收入(🪙)：每条收入轨最小未盖数字即本轮收入。覆盖数字时，它左下的整个区域必须已填满，奖励图标视作已填。末轮收入正常发到库存，计分时不重复加一次。", en: "Income (🪙): the lowest uncovered number on each income track is your income for the round. To cover a number the whole area below and left of it must already be filled, with bonus icons counting as filled. Final round income is paid into your stock normally and is never counted twice at scoring." },
        bonus: { zh: "包围奖励(🎁)：图标周围八方向的现有格都盖满后，每轮宴会后获得奖励。边缘只检查存在的格。盖掉图标会失去奖励，末轮没有奖励。", en: "Surrounded bonus (🎁): once every existing square in the eight directions around the icon is covered you gain the reward after each feast. Edges only check the squares that exist, covering the icon loses the reward, and there is no reward in the final round." },
        house: { zh: "房屋(🏠)：接受橙(🟧)、红(🟥)、绿(🟩)、蓝(🟦)货物及银币(🪙)，不接受矿石(🔷)。不同橙块不能邻接，红块同理，绿色可相邻。长屋的柱子不能盖。棚屋储存木材(🪵)与石头(🪨)。", en: "Houses (🏠): accept orange (🟧), red (🟥), green (🟩) and blue (🟦) goods plus silver (🪙), but never ore (🔷). Two different orange tiles may not touch and the same goes for red, while green may touch. The pillars of a long house can never be covered, and sheds store wood (🪵) and stone (🪨)." },
        workers: { zh: "工人(🧑‍🌾)：每轮加 1 名，行动花费 1 到 4 名。同一行动格一轮只可占用一次。三工人列先抽职业(📜)，四工人列可在行动前或后打出一张职业。最后放工人的玩家下轮先手。", en: "Workers (🧑‍🌾): you gain 1 each round and an action costs 1 to 4 of them. Each action space may only be taken once per round. A three worker column draws an occupation (📜) first, while a four worker column lets you play one occupation before or after the action. Whoever places their workers last goes first next round." },
        ships: { zh: "船只：捕鲸艇(🛶)3 银币、商船(⛵)5 银币、长船(🚢)8 银币，可随时购买。船坞最多 3 小船、4 大船。行动外可把矿石(🔷)装船，捕鲸艇限 1 额外矿，长船限 3。船不因普通行动消耗。", en: "Ships: a whaling boat (🛶) costs 3 silver, a knarr (⛵) 5 and a longship (🚢) 8, and they can be bought at any time. The harbour holds at most 3 small and 4 large ships. Outside an action you may load ore (🔷) onto ships, with 1 extra ore on a whaling boat and 3 on a longship, and ships are never spent by ordinary actions." },
        migration: { zh: "移民(🧳)：支付当前轮数的银币(🪙)，将一艘商船(⛵)或长船(🚢)翻面，失去这艘船及装矿但不失工人。每次永久减少 3 格供餐。商船移民值 18 分，长船值 21 分。", en: "Emigration (🧳): pay silver (🪙) equal to the current round number to flip a knarr (⛵) or longship (🚢), losing that ship and its ore but never your workers. Each emigration permanently shortens your feast table by 3 spaces. A knarr is worth 18 points and a longship 21." },
        feast: { zh: "宴会(🍽️)：橙红食物与银币覆盖桌长，不同橙块不能挨着，红块同理。每种长条食物最多一次横放，其余竖放，正方形方向相同。不可超出桌长，空格每格 −3 分。Auto Feed 自动规划并完成供餐。", en: "Feast (🍽️): orange and red food plus silver cover the length of the table, where two different orange tiles may not touch and the same goes for red. Each long food may be laid horizontally at most once and vertically otherwise, squares all share one orientation, nothing may exceed the table, and every empty space costs −3 points. Auto Feed plans and completes the meal for you." },
        upgrade: { zh: "货物升级(⬆️)：按同尺寸橙→红→绿→蓝，牲畜也可升级。同一组升级中每块最多用一次，新得到的块不能在这一组再次升级。海外贸易需要商船(⛵)，付 1 银币(🪙)，每种绿货至多一块翻蓝。", en: "Upgrading goods (⬆️): move through orange, red, green and blue at the same size, and livestock can be upgraded too. Within one upgrade group each tile may be used once and a tile you just gained cannot be upgraded again in that group. Overseas trading needs a knarr (⛵) and 1 silver (🪙), and flips at most one tile of each green good to blue." },
        mountain: { zh: "山地(⛰️)：从选定条左边连续拿资源，末端 2 银币(🪙)算一项。3+2 等行动必须选择不同山地。每轮末每条移除最左资源并增加一条新山地。", en: "Mountain strips (⛰️): take resources consecutively from the left of the chosen strip, where the 2 silver (🪙) at the end counts as one item. An action such as 3+2 must use different strips. At the end of each round the leftmost resource of every strip is removed and a new strip is added." },
        dice: { zh: "骰子(🎲)：可掷最多 3 次，职业可改变。狩猎、设陷阱、捕鲸求低，用木材(🪵)或对应武器补足。突袭、劫掠求高，用石头(🪨)或长剑(⚔️)加点。失败获得资源与武器，部分行动退回工人。低骰修正为 0 时必须成功。", en: "Dice (🎲): you may roll up to 3 times unless an occupation changes that. Hunting, snaring and whaling want a low roll and use wood (🪵) or the matching weapon to fill the gap, while raiding and pillaging want a high roll and use stone (🪨) or a long sword (⚔️) to add. A failure still grants resources and weapons and some actions return workers, and a low roll modified to 0 always succeeds." },
        occupation: { zh: "职业(📜)：手牌秘密，打出后公开并生效，只有已打出的牌计分。此版本精选 32 种效果，8 种起始牌各一，24 种后续职业各两张，同名效果叠加。", en: "Occupations (📜): your hand is secret, a played card becomes public and takes effect, and only played cards score. This build uses 32 selected effects, one of each of the 8 starting cards and two of each of the 24 later occupations, and identical effects stack." },
        next: { zh: "Next Round：确认已查看本轮收入、繁殖、宴会和奖励。所有玩家都确认后进入下一轮，AI 自动确认。", en: "Next Round: confirm that you have reviewed this round's income, breeding, feast and bonuses. The next round begins once every player confirms, and AI players confirm on their own." },
        ready: { zh: "Ready：完成收入前的拼板并锁定，所有人 Ready 后一起发收入。最终摆放阶段用 Finish，所有人完成后才计分。", en: "Ready: finish your board before income and lock it in, and income is paid to everyone at once once all are ready. The final placement phase uses Finish, and scoring happens only when everyone is done." },
        version: { zh: "基础机制数字适配：61 个行动格、7 或 6 轮、单人及 AI。32 种精选职业，未含全部 190 张卡及扩展。岛屿采用矩形轮廓和简化收入轨，特殊板块轮廓与山地序列采用本地数据，保留基础分值与负分总数，非逐格复刻。石屋布局亦为数字适配。", en: "A digital adaptation of the base mechanics: 61 action spaces, 7 or 6 rounds, solo and AI play. It uses 32 selected occupations rather than all 190 cards and expansions. Islands use rectangular outlines and simplified income tracks, and special board outlines and mountain sequences use local data, keeping the base point values and total penalties without reproducing every square. The stone house layout is likewise a digital adaptation." },
        placement: { zh: "放置：先选库存货物，Rotate 旋转、Flip 镜像，再点棋盘格预览，Confirm 提交。不能越界、重叠或收回。点空白、Cancel 或 Esc 取消，R 与 F 可旋转翻转。", en: "Placement: pick a good from your stock, use Rotate and Flip, then click a board square to preview and Confirm to submit. Nothing may cross the edge, overlap or be taken back. Click blank space, press Cancel or Esc to cancel, and R and F rotate and flip." },
        pass: { zh: "Pass：结束本轮工人放置，剩余工人不能再派出。本轮仍可在收入前拼板。", en: "Pass: end your worker placement for this round so no further workers may be sent out, though you may still adjust your boards before income." },
        end_turn: { zh: "End Turn：完成这次主行动，把行动机会交给下一位玩家。", en: "End Turn: finish this main action and hand the turn to the next player." },
        score: { zh: "分数(⭐)：船、移民、岛屿、房屋、家畜、已打职业、剩余银币和皇冠，减未覆盖负分与宴会罚分。并列共同获胜，显示的是当前预估分数。", en: "Score (⭐): ships, emigrations, islands, houses, livestock, played occupations, remaining silver and crowns, minus uncovered penalties and feast penalties. A tie is a shared win, and the figure shown is your current projected score." },
        action_space: { zh: "行动格：占用它需要花费格上标注的工人(🧑‍🌾)数量，效果显示在下方。同一格每轮只能被占用一次。", en: "Action space: taking it costs the number of workers (🧑‍🌾) shown on the space and its effects are listed below. Each space may only be taken once per round." },
        move_option: { zh: "可选行动：这是当前步骤的一个合法选择，选中后在下方确认。具体效果见旁边的提示。", en: "Available move: one legal choice for the current step, which you confirm below once selected. The exact effect is described in the tip beside it." },
        cell_empty: { zh: "空白格：不属于任何板块轮廓，不扣分也不能放置货物。", en: "Empty square: outside every board outline, so it costs nothing and cannot hold goods." },
        cell_negative: { zh: "负分格(−1⭐)：盖住它就不会扣分，留在外面则每格扣 1 分。", en: "Penalty square (−1⭐): covering it avoids the penalty, while leaving it exposed costs 1 point each." },
        cell_income: { zh: "收入格：盖住这个数字就提高收入，但必须先填满它左下方的整个区域。", en: "Income square: covering this number raises your income, but the whole area below and left of it must be filled first." },
        cell_bonus: { zh: "包围奖励格(🎁)：周围八方向都盖满后，每轮宴会后获得图标上的奖励。", en: "Bonus square (🎁): once all eight directions around it are covered you gain the pictured reward after each feast." },
        cell_filled: { zh: "已放置的货物：放置后不能收回，也不能被其他货物覆盖。", en: "A good already placed here: it can never be taken back and nothing else may cover it." },
        occupation_card: { zh: "职业牌(📜)：手牌秘密，打出后公开生效并计分。牌面直接写明效果。", en: "Occupation card (📜): your hand is secret, and a played card becomes public, takes effect and scores. The card text states its effect directly." },
        payment: { zh: "支付方式：选择用哪些货物支付这次行动，确认后才会提交。", en: "Payment: choose which goods pay for this action, and nothing is submitted until you confirm." },
        island_silver: { zh: "岛屿银币(🪙)：尚未被领取的岛在指定轮次翻面或累积银币，探索者领取。翻面会清除积累的银币。", en: "Island silver (🪙): an unclaimed island either flips at the stated round or accumulates silver for whoever explores it, and flipping clears the silver gathered so far." },
        harvest: { zh: "收获(🌾)：本轮开始时自动获得对应等级的橙色农产品。", en: "Harvest (🌾): at the start of the round you automatically gain the orange farm good of the matching level." },
        sheep: { zh: "绵羊(🐑)：普通数量加怀孕数量。两只普通羊隔轮繁殖，怀孕羊下次产一只羊。普通 2 分，怀孕 3 分。", en: "Sheep (🐑): the normal count plus the pregnant count. Two normal sheep breed every other round, and a pregnant sheep produces one lamb next time. Normal sheep are worth 2 points and pregnant ones 3." },
        cattle: { zh: "牛(🐄)：普通数量加怀孕数量，繁殖规则同羊。普通牛 3 分，怀孕牛 4 分。", en: "Cattle (🐄): the normal count plus the pregnant count, breeding like sheep. Normal cattle are worth 3 points and pregnant ones 4." },
        resource: { zh: "资源库存(🪙)：银币、木材、石头与矿石的数量，随时可用于行动和放置。", en: "Resource stock (🪙): how much silver, wood, stone and ore you hold, available at any time for actions and placement." },
        material_store: { zh: "储存格：棚屋用来存放木材(🪵)与石头(🪨)，每格未填扣 1 分。", en: "Storage slot: sheds hold wood (🪵) and stone (🪨) here, and every unfilled slot costs 1 point." },
        board_tab: { zh: "板块切换：查看这位玩家的不同板块，例如拼板、港湾、探索与职业。", en: "Board tab: switch between this player's boards such as the home board, harbour, exploration and occupations." },
        group_tab: { zh: "行动分类：切换查看建造、狩猎、生产、工艺、交易、航海与职业行动。", en: "Action category: switch between build, hunt, market, craft, trade, sail and occupation actions." },
        explore: { zh: "探索(🧭)：出海探索岛屿需要对应等级的船只，探索后岛屿归你并参与计分。", en: "Exploration (🧭): reaching an island requires a ship of the matching tier, and once explored the island is yours and counts for scoring." },
        dialog_close: { zh: "关闭当前对话框并回到棋盘。", en: "Close the current dialog and return to the board." }
    };
    const why = key => ODIN_EXPLAIN[key]?.zh || key;
    let view = null, room = null, inspected = null, tab = "home", boardIndex = 0, group = "trade";
    let selectedGood = null, rotation = 0, flipped = false, anchor = null, selectedMove = null;
    let pendingSend = false, tipTimer = null, sendTimer = null, restoreFocus = null;
    const esc = value => String(value ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;"}[c]));
    const player = pid => view?.players.find(p => p.player_id === pid);
    const own = () => player(view?.you);
    const name = pid => player(pid)?.name || "—";
    const good = key => view.catalog.goods[key] || view.catalog.weapons[key] || {name:key, icon:"🏠"};
    const goodName = key => `${good(key).name}(${good(key).icon})`;
    const goodText = items => Object.entries(items || {}).filter(([, n]) => n).map(([g, n]) => `${good(g).icon} ${n}`).join(" · ") || "—";
    const fullGoods = items => Object.entries(items || {}).filter(([, n]) => n).map(([g, n]) => `${goodName(g)} ×${n}`).join("，") || "无";
    const moves = type => view.moves.filter(m => m.type === type);
    const pending = () => view.pending[0];
    const button = (label, action, key, disabled = false, attrs = "", tip = "") => `<button type="button" data-od-action="${esc(action)}" data-od-explain="${esc(key)}" ${tip ? `data-od-tip="${esc(tip)}" tabindex="0"` : ""} ${disabled || pendingSend ? "disabled" : ""} ${attrs}>${label}</button>`;
    const passive = (label, key, cls = "od-token") => `<span tabindex="0" class="${cls}" title="${esc(why(key))}" data-od-tip="${esc(why(key))}" data-od-explain="${esc(key)}">${label}</span>`;
    const mini = key => {
        const d = good(key);
        return `<span class="od-mini" aria-hidden="true" style="--mini-cols:${d.width};--mini-rows:${d.height};--od-tile:${colors[d.color]}">${d.cells.map(([x, y]) => `<i style="grid-column:${x+1};grid-row:${y+1}"></i>`).join("")}</span>`;
    };
    const moveIndex = move => view.moves.indexOf(move);
    function effectText(e) {
        if (e.kind === "gain") return goodText(e.items);
        if (e.kind === "exchange") return `${goodText(e.cost)} → ${goodText(e.reward)}`;
        if (e.kind === "choice") return e.options.map(effectText).join(" / ");
        if (e.kind === "ship") return `${goodText(e.cost)} → ${view.catalog.ships[e.ship].icon}`;
        if (e.kind === "build") return `${goodText(e.cost)} → ${view.catalog.boards[e.building].name}`;
        if (e.kind === "mountain") return `⛰️ ${e.counts.join("+")}`;
        if (e.kind === "upgrade") return `${"⬆️".repeat(e.steps)} ${e.count} 份`;
        if (e.kind === "produce") return `${good(e.animal).icon} → ${good(e.good).icon} ${e.fixed || "≤3"}`;
        return {settlement:"🏠 + ⛵ / 🚢", wood_ore:`🪵 ${view.players.length} + 🔷 1`, forge:"🔷 1 → 🔨 奇珍", overseas:"🪙 1 · 🟩 → 🟦", special_sale:"🪙 → 奇珍 ≤2", hunt:`🎲 ${({hunt:"狩猎", snare:"设陷阱", whale:"捕鲸", raid:"突袭", pillage:"劫掠"})[e.mode]}`, explore:`🧭 ${e.tier} 级探索`, emigrate:`🪙 ${view.round} → 🧳`, convert_whaler:"🛶 → ⛵", draw:`📜 +${e.count}`, occupation:`📜 打出 ≤${e.count}`, paid_occupation:"🪨 / 🔷 → 📜 + 🪙", weapons:`⚔️ +${e.count}`, timing:"📜 职业时机"}[e.kind] || e.kind;
    }
    function actionExplanation(key) {
        const a = view.catalog.actions[key];
        const context = {build:"ships", hunt:"dice", market:"feast", craft:"upgrade", trade:"upgrade", sail:"ships", occupation:"occupation"}[a.group];
        return `${a.name}：花费 ${a.workers} 工人(🧑‍🌾)。${a.effects.map(effectText).join("；")}。${a.ship ? `需要${view.catalog.ships[a.ship].name}(${view.catalog.ships[a.ship].icon}) ${a.ships || 1} 艘。` : ""}${why(context)}${a.workers === 3 ? " 三工人列先抽一张职业(📜)。" : a.workers === 4 ? " 四工人列可前后打出一张职业(📜)。" : ""}`;
    }
    function moveText(m) {
        const p = own(), e = pending();
        if (m.type === "occupy") return view.catalog.actions[m.copy || m.space].name;
        if (m.type === "accept") return effectText(e);
        if (m.type === "choose") return m.index !== undefined ? effectText(e.options[m.index]) : view.catalog.boards[m.option]?.name || m.option;
        if (m.type === "take_mountain") return `⛰️ ${m.index+1} · 取 ${m.count} 项`;
        if (m.type === "upgrade") return `${good(m.good).icon} ${good(m.good).name} ${"⬆️".repeat(e.steps)}`;
        if (m.type === "take_good") return `${good(m.good).icon} ${good(m.good).name}${e.kind === "special_sale" ? ` · 🪙 ${good(m.good).price}` : ""}`;
        if (m.type === "explore") return `🧭 ${view.catalog.boards[view.islands[m.index].kind].name}`;
        if (m.type === "buy_ship") return `${view.catalog.ships[m.ship].icon} ${view.catalog.ships[m.ship].name} · 🪙 ${view.catalog.ships[m.ship].cost}`;
        if (["arm", "emigrate", "convert_whaler"].includes(m.type)) return `${{arm:"🔷 装矿", emigrate:"🧳 移民", convert_whaler:"⛵ 换成商船"}[m.type]} · ${view.catalog.ships[p.ships[m.index].kind].icon} ${m.index+1}`;
        if (["play_occupation", "tutor"].includes(m.type)) return `📜 ${view.catalog.occupations[m.card.split(":")[0]].name}${m.type === "tutor" ? " · 🪙 1" : ""}`;
        if (m.type === "pay_occupation") return `${good(m.good).icon} 1 → 📜 + 🪙`;
        if (m.type === "timing") return {before:"Play before action", after:"Play after action", skip:"Skip occupation"}[m.option];
        if (m.type === "succeed") return m.good ? `${good(m.good).icon} ${good(m.good).name}` : "Claim rewards";
        if (m.type === "serve") return `${good(m.good).icon} ${good(m.good).name} · ${m.wide ? "横放" : "竖放"} ${m.wide ? Math.max(good(m.good).width, good(m.good).height) : Math.min(good(m.good).width, good(m.good).height)} 格`;
        if (m.type === "store") return `${good(m.good).icon} → ${view.catalog.boards[p.boards[m.board].kind].name}`;
        if (m.type === "profession_trade") return `📜 ${view.catalog.occupations[m.card.split(":")[0]].name} · 交易 ${m.index+1}${m.option ? "（怀孕牛）" : ""}`;
        if (m.type === "shop") return `${good(m.good).icon} ⬆️ · 🪙 1`;
        return {pass:"Pass", end_turn:"End Turn", ready:view.phase === "final_placement" ? "Finish" : "Ready", next_round:"Next Round", skip:"Skip", reroll:"Roll again", fail:"Take compensation", serve_gap:"Leave a gap (−3⭐)", auto_feast:"Auto Feed", finish_feast:"Finish Feast", no_mead:"No Mead · 🪙 +1"}[m.type] || m.type;
    }
    function moveExplanation(m) {
        if (m.type === "occupy") return actionExplanation(m.copy || m.space);
        if (m.card) return view.catalog.occupations[m.card.split(":")[0]].text;
        const key = {next_round:"next", store:"house", serve:"feast", serve_gap:"feast", auto_feast:"feast", finish_feast:"feast", no_mead:"feast", buy_ship:"ships", arm:"ships", emigrate:"migration", convert_whaler:"ships", take_mountain:"mountain", reroll:"dice", fail:"dice", succeed:"dice", take_good:"upgrade", pay_occupation:"occupation", timing:"occupation"}[m.type] || m.type;
        return `${moveText(m)}。${why(key)}${m.payment ? ` 支付 ${fullGoods(m.payment)}。` : ""}`;
    }
    const MOVE_KEYS = {next_round:"next", store:"house", serve:"feast", serve_gap:"feast", auto_feast:"feast", finish_feast:"feast", no_mead:"feast", buy_ship:"ships", arm:"ships", emigrate:"migration", convert_whaler:"ships", take_mountain:"mountain", reroll:"dice", fail:"dice", succeed:"dice", take_good:"upgrade", pay_occupation:"occupation", timing:"occupation", pass:"pass", end_turn:"end_turn", ready:"ready", occupy:"action_space", explore:"explore", upgrade:"upgrade", play_occupation:"occupation", tutor:"occupation", profession_trade:"occupation", shop:"upgrade"};
    const moveKey = m => MOVE_KEYS[m.type] || "move_option";
    const moveButton = (m, label = null, attrs = "") => button(esc(label || moveText(m)), `move:${moveIndex(m)}`, moveKey(m), false, attrs, moveExplanation(m));
    const familyKey = m => JSON.stringify(Object.fromEntries(Object.entries(m).filter(([k]) => !["revision", "payment"].includes(k))));
    function optionList(list) {
        const unique = new Map();
        list.forEach(m => { if (!unique.has(familyKey(m))) unique.set(familyKey(m), m); });
        return `<div class="od-options">${[...unique.values()].map(m => moveButton(m)).join("")}</div>`;
    }
    function selectionHtml() {
        const m = view.moves[selectedMove];
        if (!m) return "";
        const family = view.moves.filter(n => familyKey(n) === familyKey(m));
        return `<div class="od-selection" data-od-selection><strong>${esc(moveText(m))}</strong>${m.payment ? `<p>Payment · ${esc(goodText(m.payment))}</p>` : ""}${family.length > 1 ? `<div class="od-row">${family.map(n => button(esc(goodText(n.payment)), `payment:${moveIndex(n)}`, "payment", false, `aria-pressed="${n === m}"`, `支付 ${fullGoods(n.payment)}`)).join("")}</div>` : ""}<div class="od-row">${button("Confirm", "confirm", moveKey(m), false, 'class="od-primary"', moveExplanation(m))}${button("Cancel", "cancel", "placement", false, "", "取消尚未提交的选择。")}</div></div>`;
    }
    function transformed(key, turns = rotation, flip = flipped) {
        let cells = good(key).cells.map(([x, y]) => [flip ? -x : x, y]);
        for (let i = 0; i < turns; i++) cells = cells.map(([x, y]) => [-y, x]);
        const minX = Math.min(...cells.map(c => c[0])), minY = Math.min(...cells.map(c => c[1]));
        return cells.map(([x, y]) => [x-minX, y-minY]);
    }
    function geometry() {
        const p = player(inspected), b = p.boards[boardIndex], data = view.catalog.boards[b.kind];
        const occupied = new Map();
        b.tiles.forEach((tile, i) => tile.cells.forEach(([x, y]) => occupied.set(`${x},${y}`, {good:tile.good, index:i, first:tile.cells[0][0] === x && tile.cells[0][1] === y})));
        return {p, b, data, occupied, layout:new Set(data.cells.map(c => c.join(","))), symbols:new Map(data.bonuses.map(v => [`${v.x},${v.y}`, v]))};
    }
    function preview(position = anchor) {
        if (!selectedGood || !position) return {cells:[], error:null};
        const {p, data, occupied, layout, symbols} = geometry();
        const d = good(selectedGood), color = d.color;
        const cells = transformed(selectedGood).map(([x, y]) => [x+position.x, y+position.y]);
        const ids = new Set(cells.map(c => c.join(",")));
        let error = null;
        if (inspected !== view.you || !view.can_place || !p.stock[selectedGood]) error = "Placement unavailable";
        const woodHouse = p.occupations.some(c => view.catalog.occupations[c.split(":")[0]].wood_house);
        const allowed = data.kind === "house" ? ["orange", "red", "green", "blue", "silver", ...(woodHouse ? ["wood"] : [])] : ["green", "blue", "silver", "ore"];
        if (!allowed.includes(color) || data.kind === "shed") error = "该货物不能放在这块板上";
        if (cells.some(c => !layout.has(c.join(",")))) error = "越出边缘或覆盖柱子";
        if (cells.some(c => occupied.has(c.join(",")))) error = "不能与已放货物重叠";
        const restricted = data.kind === "house" ? ["orange", "red"] : ["green"];
        if (restricted.includes(color) && cells.some(([x,y]) => [[x-1,y],[x+1,y],[x,y-1],[x,y+1]].some(c => occupied.has(c.join(",")) && good(occupied.get(c.join(",")).good).color === color))) error = "这种颜色的不同板块不能共边";
        const covered = new Set([...occupied.keys(), ...symbols.keys(), ...ids]);
        data.tracks.forEach(track => track.steps.forEach(step => {
            if (ids.has(`${step.x},${step.y}`) && data.cells.some(([x,y]) => x >= step.origin[0] && x <= step.x && y >= step.y && y <= step.origin[1] && !covered.has(`${x},${y}`))) error = "先填满收入数字左下方区域";
        }));
        return {cells, error};
    }
    function paintGhost(position) {
        const check = preview(position), cells = new Set(check.cells.map(c => c.join(",")));
        root.querySelectorAll(".od-cell[data-od-cell]").forEach(el => {
            const active = cells.has(el.dataset.odCell);
            el.classList.toggle("od-ghost", active && !check.error);
            el.classList.toggle("od-invalid", active && !!check.error);
        });
    }
    function boardHtml() {
        const {p, b, data, occupied, layout, symbols} = geometry();
        const negative = new Set(data.negative.map(c => c.join(","))), income = new Map();
        data.tracks.forEach(track => track.steps.forEach(step => income.set(`${step.x},${step.y}`, step.value)));
        const cells = [];
        for (let y = 0; y < data.height; y++) for (let x = 0; x < data.width; x++) {
            const key = `${x},${y}`, tile = occupied.get(key), symbol = symbols.get(key);
            if (!layout.has(key)) { cells.push('<div class="od-cell od-sea" aria-hidden="true"></div>'); continue; }
            let label = negative.has(key) ? "−1" : "", cls = negative.has(key) ? "od-negative" : "", style = "", cellKey = negative.has(key) ? "cell_negative" : "cell_empty", description = negative.has(key) ? "未盖负分格(−1⭐)。" : "空白格，不扣分。";
            if (income.has(key)) { label = String(income.get(key)); cls = "od-income"; cellKey = "cell_income"; description = `收入数字 ${label}。${why("income")}`; }
            if (symbol) { label = Object.keys(symbol.goods).map(g => good(g).icon).join(""); cls = "od-bonus"; cellKey = "cell_bonus"; description = `${fullGoods(symbol.goods)}。${why("bonus")}`; }
            if (tile) {
                label = tile.first ? good(tile.good).icon : "";
                cls = "od-filled"; cellKey = "cell_filled";
                const edge = (dx,dy) => occupied.get(`${x+dx},${y+dy}`)?.index === tile.index ? 0 : 1;
                style = `--od-tile:${colors[good(tile.good).color]};--od-t:${edge(0,-1)}px;--od-r:${edge(1,0)}px;--od-b:${edge(0,1)}px;--od-l:${edge(-1,0)}px`;
                description = `${goodName(tile.good)}，已放置，不能收回。`;
            }
            cells.push(button(esc(label), `cell:${x}:${y}`, cellKey, !selectedGood || !view.can_place || inspected !== view.you,
                `class="od-cell ${cls}" data-od-cell="${key}" aria-label="${esc(`${x+1}, ${y+1} · ${description}`)}" style="${style}"`, description));
        }
        const controls = `<div class="od-board-tabs">${p.boards.map((other, i) => button(esc(view.catalog.boards[other.kind].name), `board:${i}`, "board_tab", false, `aria-pressed="${boardIndex === i}"`, "查看此板块。")).join("")}</div>`;
        const store = view.moves.filter(m => m.type === "store" && m.board === boardIndex);
        const materials = Object.entries(data.materials).map(([g,n]) => passive(`${good(g).icon} ${b.materials[g]}/${n}`, "material_store")).join("");
        return `${controls}<div class="od-title"><h3>${esc(data.name)}</h3>${passive(`⭐ ${data.points || "家园"}`, data.kind === "home" ? "home" : "score")}</div>${data.cells.length ? `<div class="od-grid-wrap"><div class="od-grid" style="--od-cols:${data.width}" aria-label="${esc(data.name)}">${cells.join("")}</div></div>` : ""}${materials ? `<div class="od-row">${materials}</div>${optionList(store)}` : ""}<div class="od-legend">${passive("🟩 ↔ 🟩 ×", data.kind === "house" ? "house" : "home")}${passive("🪙 收入", "income")}${passive("🎁 包围奖励", "bonus")}</div>${placementHtml()}${inventoryHtml()}`;
    }
    function placementHtml() {
        if (!selectedGood) return "";
        const check = preview();
        return `<div class="od-placement"><strong>${good(selectedGood).icon} ${esc(good(selectedGood).name)} · ${anchor ? `${anchor.x+1}, ${anchor.y+1}` : "Select a square"}</strong><div class="od-row">${button("↻ Rotate", "rotate", "placement", false, "", "旋转所选货物 90 度。快捷键 R。")}${button("↔ Flip", "flip", "placement", false, "", "镜像所选货物。快捷键 F。")}${button("Cancel", "cancel", "placement")}</div>${check.error ? `<p class="od-invalid-text" role="status">${esc(check.error)}</p>` : ""}${button("Confirm placement", "place", "placement", !anchor || !!check.error, 'class="od-primary"')}</div>`;
    }
    function inventoryHtml() {
        const p = player(inspected);
        const stock = Object.entries(p.stock).filter(([, n]) => n > 0);
        return `<div class="od-title od-stock-head"><h3>货物库存</h3>${passive("🟧 → 🟥 → 🟩 → 🟦", "upgrade")}</div><div class="od-inventory">${stock.map(([g, n]) => {
            const d = good(g), description = `${goodName(g)}：${d.width}×${d.height}，${d.cells.length} 格。${why("placement")}`;
            return button(`${mini(g)}<span>${esc(d.name)}<br><small>${d.width}×${d.height}</small></span><b>${n}</b>`, `good:${g}`, "placement", inspected !== view.you || !view.can_place,
                `class="od-good ${g === selectedGood ? "od-selected" : ""}" style="--od-tile:${colors[d.color]}" aria-pressed="${g === selectedGood}"`, description);
        }).join("") || '<p class="od-muted">Empty supply</p>'}</div>`;
    }
    function harborHtml() {
        const p = player(inspected);
        return `<div class="od-title"><h3>港湾</h3>${passive("🛶 ≤3 · ⛵🚢 ≤4", "ships")}</div><div class="od-card-list">${p.ships.map((s,i) => `<div class="od-ship"><span>${passive(view.catalog.ships[s.kind].icon, "ships", "")}</span><div><strong>${esc(view.catalog.ships[s.kind].name)}</strong><p>${passive(`🔷 ${s.ore}/${view.catalog.ships[s.kind].capacity}`, "ships")} ${passive(`⭐ ${view.catalog.ships[s.kind].points}`, "score")}</p>${inspected === view.you ? view.moves.filter(m => m.type === "arm" && m.index === i).map(m => moveButton(m)).join("") : ""}</div></div>`).join("") || '<p class="od-muted">尚无船只</p>'}</div><div class="od-title od-stock-head"><h3>Purchase ships</h3></div>${inspected === view.you ? optionList(moves("buy_ship")) : ""}<div class="od-title od-stock-head"><h3>移民</h3>${passive(`🧳 ${p.emigrations.length} · −${p.emigrations.length*3} 格`, "migration")}</div><div class="od-row">${p.emigrations.map(k => passive(`${view.catalog.ships[k].icon} ⭐ ${k === "knarr" ? 18 : 21}`, "migration")).join("")}</div><div class="od-title od-stock-head"><h3>武器</h3></div><div class="od-row">${Object.entries(p.weapons).map(([k,n]) => passive(`${good(k).icon} ${n}`, "dice")).join("")}</div>`;
    }
    function islandsHtml() {
        return `<div class="od-title"><h3>探索海域</h3>${passive("🧭 数字布局", "version")}</div><div class="od-card-list">${view.islands.map((island,i) => {
            const b = view.catalog.boards[island.kind], negative = new Set(b.negative.map(c => c.join(",")));
            const m = moves("explore").find(n => n.index === i);
            return `<div class="od-island"><strong>${esc(b.name)}</strong><div class="od-island-preview" style="--island-cols:${b.width}" aria-hidden="true">${b.cells.map(c => `<i class="${negative.has(c.join(",")) ? "od-island-penalty" : ""}"></i>`).join("")}</div><div class="od-row">${passive(`⭐ ${b.points} / −${b.negative.length}`, "score")}${passive(`🪙 ${island.silver}`, "island_silver")}</div><small>${island.owner ? esc(name(island.owner)) : `🧑‍🌾 ${b.tier} · ${b.tier === 1 ? "🛶 / ⛵ / 🚢" : b.tier === 2 ? "⛵ / 🚢" : "🚢"}`}</small>${m ? moveButton(m) : ""}</div>`;
        }).join("")}</div><div class="od-mountains"><h3>山地</h3>${view.mountains.map(m => `<div class="od-mountain">${passive(`⛰️ ${m.id+1} →`, "mountain")}${m.items.map(g => passive(g === "silver2" ? "🪙 2" : good(g).icon, "mountain")).join("")}</div>`).join("")}</div>`;
    }
    function jobsHtml() {
        const p = player(inspected);
        const cards = (p.hand || []).map(c => [c, false]).concat(p.occupations.map(c => [c, true]));
        return `<div class="od-title"><h3>职业</h3>${passive(`📜 ${p.hand_count} 手牌 · ${p.occupations.length} 已打`, "occupation")}</div><div class="od-card-list">${cards.map(([c, played]) => {
            const d = view.catalog.occupations[c.split(":")[0]];
            const list = view.moves.filter(m => m.card === c);
            return `<div class="od-job" tabindex="0" data-od-explain="occupation_card" data-od-tip="${esc(d.text)}"><div class="od-job-head"><strong>📜 ${esc(d.name)}</strong><b>⭐ ${d.points}</b></div><p>${esc(d.text)}</p><small>${esc(d.number)} · ${played ? "In play" : "Private hand"}</small>${list.map(m => moveButton(m)).join("")}</div>`;
        }).join("") || '<p class="od-muted">手牌只对本人可见</p>'}</div>`;
    }
    function feastHtml() {
        if (view.phase !== "feast") return "";
        const p = own();
        if (!p) return "";
        const used = p.feast.reduce((n,t) => n+t.width,0), seats = [];
        p.feast.forEach(t => {
            seats.push(`<div class="od-seat od-served" style="grid-column:span ${t.width};--od-tile:${t.good === "gap" ? "#995f54" : colors[good(t.good).color]}" data-od-tip="${esc(t.good === "gap" ? "缺粮 −3 分(⭐)" : goodName(t.good))}">${t.good === "gap" ? "−3" : good(t.good).icon}</div>`);
        });
        for (let i = used; i < p.feast_length; i++) seats.push('<div class="od-seat">·</div>');
        const done = view.feast_done.includes(view.you);
        return `<div class="od-feast"><div class="od-title"><h3>🍽️ 宴会 · ${used}/${p.feast_length}</h3>${passive(`🧳 −${p.emigrations.length*3}`, "migration")}</div><div class="od-table" style="--seats:${Math.max(1,p.feast_length)}">${seats.join("")}</div>${done ? '<p class="od-muted">Waiting for other players…</p>' : `${optionList(moves("serve"))}<div class="od-controls">${view.moves.filter(m => ["auto_feast", "finish_feast", "serve_gap", "no_mead"].includes(m.type)).map(m => moveButton(m, null, m.type === "auto_feast" ? 'class="od-primary"' : "")).join("")}</div>`}</div>`;
    }
    function consoleHtml() {
        const mine = view.current_turn === view.you, p = own();
        const selected = selectionHtml();
        if (!p) return '<h3>Spectating</h3><p class="od-muted">可以查看公开棋盘、港湾与职业。</p>';
        if (view.phase === "round_end" || view.phase === "game_over") return `<h3>${view.phase === "game_over" ? "Game over" : "Round complete"}</h3><p class="od-muted">${view.phase === "game_over" ? "最终分数已在上方列出。" : "查看上方结算后确认继续。"}</p>`;
        if (["prepare", "final_placement"].includes(view.phase)) {
            const m = moves("ready")[0];
            return `<h3>${view.phase === "prepare" ? "Income preparation" : "Final placement"}</h3><p class="od-muted">${view.phase === "prepare" ? "完成货物拼板后准备发放收入。" : "完成最后拼板与房屋填充后计分。"}</p>${selected}<div class="od-controls">${m ? moveButton(m, null, 'class="od-primary"') : '<p class="od-muted">Waiting for other players…</p>'}</div>${optionList(moves("store"))}`;
        }
        if (view.phase === "feast") return `<h3>Feast planning</h3><p class="od-muted">选择上方食物供餐；或 Auto Feed 自动安排。</p>${selected}`;
        if (mine && pending()) {
            const e = pending();
            let dice = "";
            if (e.kind === "dice") {
                const high = ["raid", "pillage"].includes(e.mode);
                dice = `<div class="od-dice"><div class="od-die">${e.roll}</div><div><strong>🎲 d${e.sides} · roll ${e.rolls}</strong><p class="od-muted">${high ? "高点数" : "低点数"} · 船只修正 ${high ? "+" : "−"}${e.boost}</p></div></div>`;
            }
            return `<h3 class="od-turn-label">Your action</h3><div class="od-pending-title">${esc(e.kind === "dice" ? "狩猎与劫掠" : effectText(e))}</div>${dice}${selected}${optionList(view.moves.filter(m => !["skip", "fail", "reroll"].includes(m.type)))}<div class="od-controls">${view.moves.filter(m => ["skip", "fail", "reroll"].includes(m.type)).map(m => moveButton(m)).join("")}</div>`;
        }
        const active = mine && view.active;
        const cards = Object.entries(view.catalog.actions).filter(([,a]) => a.group === group).map(([key,a]) => {
            const m = moves("occupy").find(n => n.space === key), occupied = view.occupied[key];
            return button(`<div class="od-action-top"><strong>${esc(a.name)}</strong><span class="od-worker-cost">🧑‍🌾 ${a.workers}</span></div><small>${esc(a.effects.map(effectText).join(" · "))}</small>${occupied ? `<span class="od-occupied">${esc(name(occupied.player_id))}</span>` : ""}`, m ? `move:${moveIndex(m)}` : "none", {build:"ships", hunt:"dice", market:"feast", craft:"upgrade", trade:"upgrade", sail:"ships", occupation:"occupation"}[a.group] || "action_space", !m, 'class="od-action"', actionExplanation(key));
        });
        return `<div class="od-title"><h3 class="od-turn-label">${mine ? active ? "Action complete" : "Your turn" : `${esc(name(view.current_turn))} · 行动中`}</h3>${passive(`🧑‍🌾 ${p.workers}`, "workers")}</div>${selected}<nav class="od-groups" aria-label="Action categories">${Object.entries(groups).map(([k,label]) => button(label, `group:${k}`, "group_tab", false, `aria-pressed="${group === k}"`, `查看${label}行动。`)).join("")}</nav><div class="od-action-list">${cards.join("")}</div>${optionList(moves("occupy").filter(m => m.copy))}<div class="od-controls">${button("Pass", "direct:pass", "pass", !moves("pass").length)}${button("End Turn", "direct:end_turn", "end_turn", !moves("end_turn").length, 'class="od-primary"')}</div>`;
    }
    function reviewHtml() {
        if (!["round_end", "final_placement", "game_over"].includes(view.phase)) return "";
        const labels = {ships:"船只", emigration:"移民", islands:"探索", houses:"房屋", animals:"家畜", occupations:"职业", silver:"银币", crown:"皇冠", uncovered:"未盖格", penalties:"宴会罚分", total:"总分"};
        const result = view.phase === "game_over";
        const m = moves("next_round")[0];
        const rows = result ? view.result.scores : view.review;
        return `<section class="od-review"><div class="od-title"><h3>${result ? "Game over" : `Round ${view.round} · 回顾`}</h3>${result ? passive(`🏆 ${esc(view.result.winners.map(name).join(" / "))}`, "score") : passive(`${view.ready.length}/${view.players.length} ready`, "next")}</div><div class="od-review-cards">${rows.map(r => `<div class="od-review-player"><strong>${esc(name(r.player_id))}</strong>${result ? `<div class="od-score-lines">${Object.entries(labels).map(([k,label]) => `<span>${label}</span><b>${r[k]}</b>`).join("")}</div>` : `${passive(`🪙 +${r.income} · 缺粮 −${r.penalties*3}⭐`, "income")}<span>繁殖：${Object.entries(r.breeding).map(([g,k]) => `${good(g).icon} ${k === "birth" ? "+1" : "怀孕"}`).join(" · ") || "—"}</span><span>奖励：${esc(goodText(r.bonus))}</span>`}</div>`).join("")}</div>${m ? moveButton(m, null, 'class="od-primary"') : !result && view.phase === "round_end" ? '<span class="od-muted">Waiting for other players…</span>' : ""}</section>`;
    }
    function render() {
        if (!view) return;
        const p = player(inspected) || view.players[0];
        inspected = p.player_id;
        boardIndex = Math.min(boardIndex, p.boards.length-1);
        const scrolls = [...root.querySelectorAll(".od-inventory,.od-action-list,.od-options,.od-card-list,.od-log")].map(el => [el.className, el.scrollTop]);
        const focused = root.contains(document.activeElement) ? document.activeElement.dataset.odAction : null;
        const turn = view.current_turn === view.you && view.pending.length > 0;
        root.classList.toggle("od-pending", turn);
        const resources = ["silver", "wood", "stone", "ore"].map(g => passive(`${good(g).icon} ${p.stock[g] || 0}`, "resource")).join("");
        const harvest = view.catalog.harvest[view.round-1];
        root.innerHTML = `<header class="od-hero"><div class="od-season"><strong>Round ${view.round} / ${view.rounds}</strong><span>${phases[view.phase]}</span>${passive(harvest ? `🌾 收获 ${harvest}` : "🌾 无收获", "harvest")}</div></header>
            <div class="od-players ${view.players.length === 1 ? "od-single" : ""}" style="--od-players:${view.players.length}">${view.players.map((other,i) => button(`<span class="od-player-name">${other.player_id === view.first_player ? "🫎 " : ""}${esc(other.name)}${other.is_bot ? " · AI" : ""}</span><span class="od-score">${other.projected.total}⭐</span><small>🧑‍🌾 ${other.workers} · 🪙 ${other.stock.silver || 0} · 收入 ${other.income}</small>`, `player:${i}`, "score", false, `class="od-player ${other.player_id === view.current_turn ? "od-turn" : ""}" style="--od-player:${playerColors[i]}" aria-pressed="${inspected === other.player_id}"`)).join("")}</div>
            <div class="od-resources">${resources}${passive(`🪙 收入 ${p.income}`, "income")}${passive(`🍽️ ${p.feast_length} 格`, "feast")}${passive(`🐑 ${p.stock.sheep || 0}+${p.stock.pregnant_sheep || 0}`, "sheep")}${passive(`🐄 ${p.stock.cattle || 0}+${p.stock.pregnant_cattle || 0}`, "cattle")}</div>
            ${feastHtml()}${reviewHtml()}<div class="od-layout"><section class="od-panel"><nav class="od-tabs" aria-label="Player board">${[["home","🏡 拼板"],["harbor","⛵ 港湾"],["islands","🧭 探索"],["jobs","📜 职业"]].map(([k,label]) => button(label, `tab:${k}`, "board_tab", false, `aria-pressed="${tab === k}"`, `查看${label}。`)).join("")}</nav><div class="od-board-body">${({home:boardHtml, harbor:harborHtml, islands:islandsHtml, jobs:jobsHtml})[tab]()}</div></section><aside class="od-console" aria-label="Actions">${consoleHtml()}</aside></div>
            <footer class="od-footer"><details><summary>Game Log</summary><div class="od-log">${view.log.slice().reverse().map(e => `<p>R${e.round} ${esc(e.player_id ? name(e.player_id)+" · " : "")}${esc(e.text)}</p>`).join("")}</div></details>${passive("数字适配 · 精选职业", "version")}</footer>`;
        scrolls.forEach(([cls, top]) => { const el = root.getElementsByClassName(cls)[0]; if (el) el.scrollTop = top; });
        if (focused) [...root.querySelectorAll("[data-od-action]")].find(el => el.dataset.odAction === focused)?.focus({preventScroll:true});
        if (tab === "home" && anchor) paintGhost(anchor);
    }
    function cancelSelection() { selectedMove = null; selectedGood = null; anchor = null; }
    function send(move) {
        if (!move || pendingSend || !view || typeof socket === "undefined") return;
        pendingSend = true;
        selectedMove = null; anchor = null; hideTip(); render();
        socket.emit("game:action", {action:move});
        clearTimeout(sendTimer);
        sendTimer = setTimeout(() => { pendingSend = false; render(); }, 5000);
    }
    const directTypes = new Set(["pass","end_turn","ready","next_round","skip","reroll","auto_feast","finish_feast","no_mead"]);
    root.addEventListener("click", event => {
        const control = event.target.closest("[data-od-action]");
        if (!control) {
            const target = event.target.closest("[data-od-tip]");
            if (target) showTip(target); else { cancelSelection(); render(); }
            return;
        }
        if (control.disabled) return;
        const [type, value, extra] = control.dataset.odAction.split(":");
        if (type === "tab") { tab = value; cancelSelection(); }
        else if (type === "player") { inspected = view.players[Number(value)].player_id; boardIndex = 0; cancelSelection(); }
        else if (type === "board") { boardIndex = Number(value); anchor = null; }
        else if (type === "group") { group = value; selectedMove = null; }
        else if (type === "good") { selectedGood = selectedGood === value ? null : value; anchor = null; rotation = 0; flipped = false; selectedMove = null; }
        else if (type === "cell") { anchor = {x:Number(value), y:Number(extra)}; }
        else if (type === "rotate") { rotation = (rotation+1)%4; }
        else if (type === "flip") { flipped = !flipped; }
        else if (type === "cancel") { cancelSelection(); }
        else if (type === "place") {
            if (anchor && !preview().error) send({type:"place", revision:view.revision, board:boardIndex, good:selectedGood, x:anchor.x, y:anchor.y, rotation, flip:flipped});
            return;
        } else if (type === "payment") { selectedMove = Number(value); }
        else if (type === "confirm") { send(view.moves[selectedMove]); return; }
        else if (type === "direct") { send(moves(value)[0]); return; }
        else if (type === "move") {
            const m = view.moves[Number(value)];
            if (!m) return;
            if (directTypes.has(m.type)) { send(m); return; }
            selectedMove = Number(value);
            render();
            root.querySelector("[data-od-selection]")?.scrollIntoView({block:"nearest", behavior:"smooth"});
            return;
        }
        render();
    });
    root.addEventListener("pointerover", event => {
        const target = event.target.closest("[data-od-tip]");
        if (target && event.pointerType !== "touch") showTip(target);
        const cell = event.target.closest("[data-od-cell]");
        if (cell && selectedGood && !anchor && event.pointerType !== "touch") {
            const [x,y] = cell.dataset.odCell.split(",").map(Number);
            paintGhost({x,y});
        }
    });
    root.addEventListener("pointerout", event => {
        if (event.pointerType === "touch") return;
        if (!event.target.closest("[data-od-tip]")?.contains(event.relatedTarget)) hideTip();
        if (selectedGood && !anchor && !event.relatedTarget?.closest?.(".od-grid")) paintGhost(null);
    });
    function hideTip() { tip.hidden = true; clearTimeout(tipTimer); }
    function showTip(target) {
        clearTimeout(tipTimer);
        tip.textContent = target.dataset.odTip;
        tip.hidden = false;
        const rect = target.getBoundingClientRect();
        tip.style.left = `${Math.max(12, Math.min(rect.left, innerWidth-tip.offsetWidth-12))}px`;
        tip.style.top = `${Math.max(12, Math.min(rect.bottom+8, innerHeight-tip.offsetHeight-12))}px`;
        tipTimer = setTimeout(hideTip, 3000);
    }
    const ODIN_HELP_CONFIG = {
        gameId: "a_feast_for_odin",
        title: { zh: "奥丁的盛宴 · A Feast for Odin", en: "A Feast for Odin" },
        basic: {
            win: {
                zh: "经营维京家园，用货物填盖负分格并提高收入。终局把船、移民、岛屿、房屋、家畜、职业、银币和皇冠相加，减去未覆盖负分与宴会罚分，最高者获胜。",
                en: "Run a Viking homestead, covering penalty squares with goods and raising your income. At the end you add ships, emigrations, islands, houses, livestock, occupations, silver and crowns, subtract uncovered penalties and feast penalties, and the highest score wins."
            },
            turn: {
                zh: "每轮获得一名新工人和收获，轮流把工人放到行动格上执行行动，最后放工人的玩家下轮先手。全员 Ready 后一起发收入和繁殖，再供餐、发奖励并回顾。",
                en: "Each round brings a new worker and a harvest, then players take turns placing workers on action spaces, and whoever places last goes first next round. Once everyone is Ready, income and breeding are paid together, followed by the feast, bonuses and the review."
            },
            key: {
                zh: "工人永远不够用，所以真正的取舍在于用有限的三四点工人去拿能反复升级的货物链，还是先补上家园里那些会持续扣分的负分格。",
                en: "Workers are always scarce, so the real decision is whether to spend your three or four workers on a chain of goods you can keep upgrading, or to patch the penalty squares on your home board that keep costing you points."
            }
        },
        sections: [
            {
                id: "scope",
                label: { zh: "版本范围", en: "Scope" },
                html: { zh: `<p>${esc(why("version"))}</p>`, en: "<p>A digital adaptation of the base mechanics with 61 action spaces, 7 or 6 rounds, and solo and AI play. It uses 32 selected occupations rather than all 190 cards and expansions. Islands use rectangular outlines and simplified income tracks, and special board outlines and mountain sequences use local data, keeping the base point values and total penalties without reproducing every square. The stone house layout is likewise a digital adaptation.</p>" }
            },
            {
                id: "flow",
                label: { zh: "目标与流程", en: "Goal and flow" },
                html: {
                    zh: "<p>经营维京家园，获得货物来填盖负分格并提高收入。标准局 7 轮，短局 6 轮。每轮新增工人、收获、探索板翻面、抽武器，轮流行动，最后放工人的玩家下轮先手。全员 Ready 后发收入并繁殖，再供餐、发奖励、回顾。所有人 Next Round 才继续。</p>",
                    en: "<p>Run a Viking homestead, gathering goods to cover penalty squares and raise your income. A standard game lasts 7 rounds and a short one 6. Each round adds a worker, a harvest, an exploration flip and a weapon draw, then players act in turn and whoever placed workers last goes first next round. Once everyone is Ready, income and breeding are paid, followed by the feast, bonuses and the review, and play continues only after everyone presses Next Round.</p>"
                }
            },
            {
                id: "workers",
                label: { zh: "工人行动", en: "Worker actions" },
                html: {
                    zh: `<p>${esc(why("workers"))} 可以主动 Pass。四人局有两个随机列的模仿格，只能复制别人已占的行动。单人时上轮行动保持占用，再下一轮释放。</p>`,
                    en: "<p>You gain 1 worker each round and an action costs 1 to 4 of them, each action space may only be taken once per round, a three worker column draws an occupation first and a four worker column lets you play one before or after, and whoever places last goes first next round. You may also pass voluntarily. In a four player game two random columns are copy spaces that may only copy an action someone else already took, and in solo play last round's actions stay occupied and free up the round after.</p>"
                }
            },
            {
                id: "home",
                label: { zh: "家园与货物", en: "Home and goods" },
                html: {
                    zh: `<p>${esc(why("home"))}</p><p>${esc(why("placement"))}</p><p>${esc(why("income"))}</p><p>${esc(why("bonus"))}</p>`,
                    en: "<p>The home board accepts green goods, blue goods, ore and silver, two different green tiles may never touch orthogonally, every uncovered −1 square costs 1 point and blank squares cost nothing.</p><p>To place, pick a good from your stock, use Rotate and Flip, click a board square to preview and Confirm to submit. Nothing may cross the edge, overlap or be taken back, and blank space, Cancel or Esc cancels while R and F rotate and flip.</p><p>The lowest uncovered number on each income track is your income for the round, and to cover a number the whole area below and left of it must already be filled with bonus icons counting as filled. Final round income is paid normally and never counted twice at scoring.</p><p>Once every existing square in the eight directions around a bonus icon is covered you gain the reward after each feast, edges only check squares that exist, covering the icon loses the reward and there is none in the final round.</p>"
                }
            },
            {
                id: "houses",
                label: { zh: "房屋", en: "Houses" },
                html: {
                    zh: `<p>${esc(why("house"))} 棚屋 8 分、石屋 10 分、长屋 17 分。建筑供应分别 3、3、5 座。</p>`,
                    en: "<p>Houses accept orange, red, green and blue goods plus silver but never ore, two different orange tiles may not touch and the same goes for red while green may touch, the pillars of a long house can never be covered, and sheds store wood and stone. A shed is worth 8 points, a stone house 10 and a long house 17, with a supply of 3, 3 and 5 buildings respectively.</p>"
                }
            },
            {
                id: "produce",
                label: { zh: "生产与贸易", en: "Producing and trading" },
                html: {
                    zh: `<p>${esc(why("upgrade"))}</p><p>${esc(why("mountain"))} 橙色依次为豌豆(🫛)、亚麻(🌿)、蚕豆(🫘)、谷物(🌾)、卷心菜(🥬)、水果(🍎)。</p>`,
                    en: "<p>Upgrading moves through orange, red, green and blue at the same size and livestock can be upgraded too, each tile may be used once within an upgrade group and a freshly gained tile cannot be upgraded again in that group, and overseas trading needs a knarr and 1 silver to flip at most one tile of each green good to blue.</p><p>On a mountain strip you take resources consecutively from the left with the 2 silver at the end counting as one item, an action such as 3+2 must use different strips, and at the end of each round the leftmost resource of every strip is removed and a new strip is added. The orange goods in order are peas (🫛), flax (🌿), beans (🫘), grain (🌾), cabbage (🥬) and fruit (🍎).</p>"
                }
            },
            {
                id: "adventure",
                label: { zh: "冒险与武器", en: "Adventure and weapons" },
                html: {
                    zh: `<p>${esc(why("dice"))} 狩猎使用弓箭(🏹)，陷阱使用陷阱(🪤)，捕鲸使用长矛(🔱)。捕鲸艇每艘预印 1 矿，劫掠只用装矿最多的长船，突袭不加装矿。失败时狩猎与突袭不退工人，陷阱与劫掠退 1，捕鲸退 2。</p>`,
                    en: "<p>You may roll up to 3 times unless an occupation changes that. Hunting, snaring and whaling want a low roll and use wood or the matching weapon to fill the gap, while raiding and pillaging want a high roll and use stone or a long sword to add. A failure still grants resources and weapons and a low roll modified to 0 always succeeds. Hunting uses the bow (🏹), snaring the trap (🪤) and whaling the spear (🔱). Each whaling boat comes with 1 ore printed on it, pillaging only uses the longship carrying the most ore, and raiding adds no ore. On a failure hunting and raiding return no workers, snaring and pillaging return 1, and whaling returns 2.</p>"
                }
            },
            {
                id: "ships",
                label: { zh: "船只、探索与移民", en: "Ships, exploration and emigration" },
                html: {
                    zh: `<p>${esc(why("ships"))}</p><p>近海探索需任意船，二级探索需大船，美洲探索需长船，船只保留。未领岛在指定轮次翻面或累积银币。</p><p>${esc(why("migration"))}</p>`,
                    en: "<p>A whaling boat costs 3 silver, a knarr 5 and a longship 8, and they can be bought at any time. The harbour holds at most 3 small and 4 large ships, you may load ore onto ships outside an action with 1 extra ore on a whaling boat and 3 on a longship, and ships are never spent by ordinary actions.</p><p>Coastal exploration needs any ship, the second tier needs a large ship and the Americas need a longship, and the ships are kept. An unclaimed island either flips at the stated round or accumulates silver.</p><p>Emigration costs silver equal to the current round number and flips a knarr or longship, losing that ship and its ore but never your workers, and each one permanently shortens your feast table by 3 spaces. A knarr is worth 18 points and a longship 21.</p>"
                }
            },
            {
                id: "livestock",
                label: { zh: "家畜与宴会", en: "Livestock and feast" },
                html: {
                    zh: `<p>羊(🐑)普通与怀孕分别值 2 分和 3 分，牛(🐄)值 3 分和 4 分。已有怀孕母畜时翻回普通并生一只，否则至少两只普通畜时令一只怀孕。</p><p>${esc(why("feast"))} No Mead 职业承诺后不能再供应蜂蜜酒，若要把这枚银币用于宴会，应先点击该选项。</p>`,
                    en: "<p>Normal and pregnant sheep (🐑) are worth 2 and 3 points, and cattle (🐄) 3 and 4. A pregnant animal flips back to normal and gives birth, and otherwise at least two normal animals make one pregnant.</p><p>At the feast, orange and red food plus silver cover the length of the table, two different orange tiles may not touch and the same goes for red, each long food may be laid horizontally at most once and vertically otherwise, squares all share one orientation, nothing may exceed the table and every empty space costs −3 points. Auto Feed plans and completes the meal for you. After committing to the No Mead occupation you can no longer serve mead, so click that option first if you want to spend that silver on the feast.</p>"
                }
            },
            {
                id: "occupations",
                label: { zh: "职业", en: "Occupations" },
                html: {
                    zh: `<p>${esc(why("occupation"))} 手牌可在职业标签查看，牌上直接展示效果。前后打职业、支付方式、升级目标、山地数量等均用按钮选择。</p>`,
                    en: "<p>Your hand is secret, a played card becomes public and takes effect, and only played cards score. This build uses 32 selected effects, one of each of the 8 starting cards and two of each of the 24 later occupations, and identical effects stack. Your hand is visible under the occupations tab and each card states its effect directly, while timing, payment, upgrade targets and mountain counts are all chosen with buttons.</p>"
                }
            },
            {
                id: "scoring",
                label: { zh: "结算", en: "Scoring" },
                html: {
                    zh: `<p>${esc(why("score"))} 最后一轮不发包围奖励，宴会后保留最终摆放，末轮已发收入包含在剩余银币中，不能再重复计分。</p>`,
                    en: "<p>Your score adds ships, emigrations, islands, houses, livestock, played occupations, remaining silver and crowns, then subtracts uncovered penalties and feast penalties, a tie is a shared win and the figure shown is your current projection. The final round grants no surrounded bonuses, the final placement is kept after the feast, and the income already paid in the last round is part of your remaining silver and is never counted twice.</p>"
                }
            },
            {
                id: "controls",
                label: { zh: "界面操作", en: "Controls" },
                html: {
                    zh: "<p>无交互图标可悬停或点击显示提示，3 秒消失。Explain 后点目标查看说明，禁用按钮也支持，其他操作被暂时拦截。Esc 退出解释、弹窗或选择。Help 与 Explain 不会提交游戏操作。</p>",
                    en: "<p>Non-interactive icons can be hovered or clicked for a tip that disappears after 3 seconds. In Explain mode you tap a target to read its description, disabled buttons included, and other actions are blocked meanwhile. Esc leaves Explain, closes a dialog or clears a selection, and neither Help nor Explain ever submits a game action.</p>"
                }
            }
        ]
    };
    let odinHelpWidget = null;
    let odinExplainWidget = null;
    function initOdinHelpExplain() {
        if (odinHelpWidget || typeof window.obgCreateHelp !== "function") return;
        odinHelpWidget = window.obgCreateHelp(ODIN_HELP_CONFIG);
        odinExplainWidget = window.obgCreateExplain({
            gameId: "a_feast_for_odin",
            attribute: "data-od-explain",
            explanations: ODIN_EXPLAIN,
            button: explain,
            root: () => root,
            bypass: ["#odinHelpBtn", "#odinExplainBtn", "#odinClose"]
        });
        help?.addEventListener("click", () => {
            odinExplainWidget?.exit();
            odinHelpWidget.open();
        });
        explain?.addEventListener("click", () => odinExplainWidget?.toggle());
    }
    document.getElementById("odinClose").addEventListener("click", () => dialog.close());
    dialog.addEventListener("close", () => { hideTip(); if (restoreFocus?.isConnected) restoreFocus.focus({preventScroll:true}); });
    dialog.addEventListener("click", event => {
        const r = dialog.getBoundingClientRect();
        if (event.target === dialog && (event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom)) dialog.close();
    });
    const activePanel = () => view && !panel.classList.contains("hidden");
    document.addEventListener("keydown", event => {
        if (!activePanel()) return;
        if (event.key === "Escape") { odinExplainWidget?.exit(); hideTip(); if (!dialog.open) { cancelSelection(); render(); } return; }
        if (selectedGood && !dialog.open && !event.target.matches("input,select,textarea")) {
            if (event.key.toLowerCase() === "r") { rotation = (rotation+1)%4; render(); }
            if (event.key.toLowerCase() === "f") { flipped = !flipped; render(); }
        }
    }, true);
    function clearState() {
        view = null; room = null; inspected = null; tab = "home"; boardIndex = 0;
        cancelSelection(); pendingSend = false; clearTimeout(sendTimer); odinExplainWidget?.exit(); root.innerHTML = "";
        if (dialog.open) dialog.close();
    }
    window.renderOdinGameState = data => {
        const next = data?.view;
        if (next?.game_id !== "a_feast_for_odin") return;
        if (room !== data.room_id) { cancelSelection(); inspected = null; boardIndex = 0; }
        if (room !== data.room_id || view?.revision !== next.revision) {
            selectedMove = null; anchor = null; pendingSend = false; clearTimeout(sendTimer);
        }
        room = data.room_id; view = next;
        if (!player(inspected)) inspected = own()?.player_id || next.players[0].player_id;
        if (selectedGood && (!own()?.stock[selectedGood] || !view.can_place)) selectedGood = null;
        render();
    };
    window.showOdinHeaderActions = visible => {
        header.style.display = visible ? "flex" : "none";
        if (!visible) clearState();
        if (typeof syncRoomControlsExplainButton === "function") syncRoomControlsExplainButton();
    };
    window.clearOdinState = clearState;
    window.getOdinConfig = () => ({rounds:view?.rounds || Number(document.getElementById("odinRounds").value)});
    let configRoom = null;
    function syncConfig(state) {
        const box = document.getElementById("odinConfigBox"), select = document.getElementById("odinRounds");
        const visible = state?.game_type === "a_feast_for_odin" && state.status === "lobby";
        box.classList.toggle("hidden", !visible);
        box.setAttribute("aria-hidden", String(!visible));
        select.disabled = !visible;
        if (visible && configRoom !== state.room_id) select.value = String(state.game_config?.rounds || 7);
        configRoom = visible ? state.room_id : null;
    }
    function connect() {
        if (typeof socket !== "undefined") {
            socket.on("system:error", () => { if (pendingSend) { pendingSend = false; clearTimeout(sendTimer); render(); } });
            socket.on("room:state", state => {
                syncConfig(state);
                if (state.game_type !== "a_feast_for_odin" || state.status === "lobby") clearState();
            });
        }
        if (typeof currentRoomState !== "undefined") syncConfig(currentRoomState);
        if (typeof currentRoomState !== "undefined" && currentRoomState?.game_type === "a_feast_for_odin" && typeof lastGameStatePayload !== "undefined" && lastGameStatePayload?.game_type === "a_feast_for_odin") window.renderOdinGameState(lastGameStatePayload);
    }
    initOdinHelpExplain();
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", connect, {once:true}); else connect();
})();
