(() => {
    "use strict";

    const panel = document.getElementById("lasVegasPanel");
    const content = document.getElementById("lasVegasContent");
    const header = document.getElementById("lasVegasHeaderActions");
    const helpButton = document.getElementById("lasVegasHelpBtn");
    const explainButton = document.getElementById("lasVegasExplainBtn");
    const dialog = document.getElementById("lasVegasDialog");
    const closeButton = document.getElementById("lasVegasDialogClose");
    const tip = document.getElementById("lasVegasTooltip");
    const setup = document.getElementById("lasVegasSetup");
    const neutralCheckbox = document.getElementById("lasVegasNeutralDice");
    const editionSelect = document.getElementById("lasVegasEdition");
    if (!panel || !content || !header || !helpButton || !explainButton || !dialog) return;

    const explanations = {
        edition: "Classic 是 2012 基础版：4 轮、8 小骰。Royale 是豪华版：3 轮、7 小骰加 1 大骰、筹码，以及每轮随机分配到 1–3 号赌场的三块小游戏板。",
        casino: "赌场(🎰)分别对应骰子点数 1–6。把选定点数的全部骰子(🎲)放到对应赌场。每轮各赌场至少提供 $50,000 的钞票(💵)；按最终骰子排名，每个有效参与者最多取得一张钞票。",
        roll: "Roll Dice 掷出你所有剩余的骰子(🎲)，包括白骰变体中的白骰(⚪)。每回合只能掷一次，然后必须选择一个掷出的点数。",
        place: "Place Dice 将所选点数的全部骰子(🎲)放入对应赌场(🎰)，同点白骰(⚪)也必须一起放。可以只放白骰；不能留下相同点数的骰子。选中后可预览放置后的奖金，确认后轮到下一位。",
        face: "选择一个本次掷出的点数，再点击 Place Dice 确认。所有该点数的骰子(🎲)，包括白骰(⚪)，都必须一起放置。点击空白处或按 Esc 取消尚未提交的选择。",
        dice: "骰子(🎲)：每人每轮拥有 8 枚自己的骰子。每回合掷出全部剩余骰子，选择一个点数全部放入同号赌场。颜色对应玩家，骰子数量决定赌场排名。",
        neutral: "白骰(⚪)是独立的中立参与者，所有玩家放出的白骰合并计数，并且参与平手与排名。中立方拿到的奖金回到牌库底。2 人每人加 4 枚白骰；3／4 人每人加 2 枚。3 人局每轮先自动投放另外 2 枚白骰。",
        money: "钞票(💵)的面额为 $10,000–$90,000，共 54 张。每轮按赌场顺序发到各自至少 $50,000。结算时，骰子数最多的有效参与者拿最高面额的一张，依此类推。K 表示千美元。",
        prize: "奖池合计(💵)是这个赌场所有钞票的总额，每位有效参与者最多拿一张。例如 $90K + $30K 合计 $120K，只有一人获奖时，他拿 $90K，剩下的 $30K 回收。K 表示千美元。投骰期间奖池金额不变，轮末才发钱；结算后的原奖池仅用于回顾。",
        ties: "平手取消(✕)：同一赌场里，骰子数量相同的所有参与者都取消领奖资格，包括低位平手和白骰(⚪)。剩下的参与者按骰子数从多到少领奖；无人领取的钞票(💵)回到牌库底。",
        payout: "奖金预览(💵)按当前盘面的骰子数计算；选中点数后，该赌场显示放置后的预计结果。每张钞票旁标明预计由谁领取，所有人用完骰子前仍可能改变。轮末才正式支付，每位有效参与者每个赌场最多拿一张钞票。已发放表示钞票已经计入获奖玩家的累计奖金。",
        returned: "回收(↩)：没有有效玩家领取的钞票(💵)，以及中立方白骰(⚪)取得的钞票，都会在轮末回到牌库底。预计回收仍可能随骰子排名变化；已回收表示本轮已经结算，保留的钞票仅用于回顾，不再可领取。",
        player: "玩家栏显示剩余骰子(🎲)、持有钞票(💵)张数和当前行动者。赢得的钞票面朝下保存，其他人的金额在终局前保密。玩家颜色仅用于辨认，姓名始终同时显示。",
        private: "私有奖金(🔒)：只有你能查看自己的钞票(💵)面额和累计金额。其他玩家只能看到张数；已公开的历史收入仍可在 Activity 中查看。",
        next: "Next Round 表示你已看完本轮结算。所有席位分别确认后才能继续，第四轮也需要全员确认后进入终局。机器人(🤖)只确认自身，断线真人需重连确认。",
        total: "胜者(🏆)为 4 轮后累计奖金(💵)最多的玩家；金额相同则钞票张数更多者胜，再相同则并列获胜。",
        bot: "机器人(🤖)只根据自己的公开视图选择行动，不读取其他人的私有钞票或未来牌库；轮末只确认自己的席位。",
        round: "整场共 4 轮，每轮所有人重新取得自己的 8 枚骰子(🎲)。首轮先手随机，之后每轮先手按座位轮转；用完骰子的玩家自动跳过。",
        log: "Activity 保留已经公开的掷骰、放置和奖金分配记录，不公开未来牌库。此区域可以单独滚动。",
    };
    const classicExplanations = {...explanations};
    const royaleExplanations = {
        casino: "每个赌场固定两张钞票(💵)，每轮按两张合计由低到高分配给赌场 1–6。向 1–3 号赌场正常投骰后，执行对应小游戏。每位有效参与者最多拿一张钞票。",
        dice: "每人每轮 7 小骰 + 1 大骰(🎲×2)。大骰掷出一个点数，放置时是一枚实体骰，但赌场及 Double Down 排名时计为两枚。酒吧容量和奖励格仍按一枚计算。",
        roll: "Roll Dice 掷出全部剩余骰子，选择一个点数全部投放。掷出后也可支付 1 枚筹码(🪙)跳过本回合，保留骰子到下回合重新掷。",
        place: "投放全部同点数骰子，再执行该赌场的小游戏。大骰在排名中计两枚。预览仅计算投放后赌场奖金，之后的小游戏可能再次改变盘面。",
        face: "选择一个本次掷出的、未被封锁的点数，再点击 Place Dice。该点数的大骰与小骰必须一起投放。",
        money: "Royale 使用 90 张 $30K–$100K 钞票。每个赌场每轮两张，小游戏奖金另由银行发放。私有总额包含现金及每枚 $10K 的剩余筹码；筹码不是钞票。",
        neutral: "2 人 Royale 每轮自动掷出一套中立骰(⚪)，包含 7 小骰及 1 大骰。它们与灰骰(⬜)属于两个不同的虚拟玩家，分别参与平手和排名，所得钞票回银行。",
        gray: "小游戏中的灰骰(⬜)合并为一个虚拟玩家，参与排名、平手和 Power Play 多数判定。它与 2 人局的中立骰(⚪)分开计算，奖金回银行。",
        chips: "筹码(🪙)：每轮增加 2 枚，未花掉的保留。掷骰后支付 1 枚可以跳过本回合。终局每枚值 $10K。小游戏的 $10K／$20K 奖励以 1／2 枚筹码发放。",
        private: "你的总资产(🔒)包括私有钞票(💵)和剩余筹码(🪙)，每枚筹码按 $10K 计。其他人的现金面额和总额在终局前保密；筹码数量公开。",
        next: "所有人点击 Next Round 后开始下一轮。Royale 共 3 轮，第 3 轮也需全员确认后展示最终排名。",
        total: "3 轮后钞票总额加剩余筹码（每枚 $10K）最高者胜；平手时比较钞票张数加筹码枚数，再平手则并列。",
        round: "Royale 共 3 轮，每轮重新获得 7 小骰、1 大骰及 2 筹码，1–3 号赌场重抽小游戏板。首轮随机先手；以后由最高号赌场的大钞获奖者先手，无人获奖则向低号查找。",
        closed: "⛔ 赌场封锁期间不能添加或取回骰子，包括小游戏效果。若本次只掷出被封锁的点数，线上版本允许免费跳过本回合。",
        tile_lucky_punch: "激活后秘密藏 1／2／3 枚标记，左手边下一位玩家猜数量。猜错时，你分别获得 2🪙／$30K／$40K；猜中则无奖励。双方选择结束前秘密不会公开。",
        tile_jackpot: "激活后掷两枚黑骰：对子或合计 7 点即赢得当前奖池，奖池重置 $30K；否则奖池增加 $10K，最高 $80K。",
        tile_prime_time: "轮末发钱前，本赌场的大钞获奖者掷两枚黑骰，可选择放置 0、1 或 2 枚到对应赌场，之后作为自己的骰子参与结算。可以拆分对子，不触发小游戏。",
        tile_fifty_fifty: "先掷两枚黑骰，选择下一次总点数更大或更小。每猜中一次提高奖励：1🪙 → $30K → $40K → $60K。可随时领取当前奖励；猜错或总点数相同则本次奖励归零。",
        tile_high_five: "激活时，第一个在本赌场达到至少 5 枚计数的玩家取得标记（大骰算 2）。标记不会被夺走，轮末领取 $100K。",
        tile_bad_luck: "轮末骰子计数最少的所有玩家（包括 0 枚，大骰算 2）各支付 $50K。先结算奖金，再交罚金；资产不足则付清全部，筹码也按 $10K 支付。",
        tile_pay_day: "激活时，每个拥有自己骰子的赌场提供 $10K。小游戏板上的骰子不算。1／2 个赌场奖励 1／2🪙，3–6 个赌场奖励 $30K–$60K。",
        tile_power_play: "激活时若你在本赌场独占骰子数量第一，则获得标记。持有者可在自己的回合掷骰前选择 Power Play，直接将一枚剩余骰子转到任意点数投放，并触发目标小游戏。失去独占多数时交回标记。",
        tile_no_entry: "激活后可封锁除本赌场以外的一个赌场，禁止添加或移除骰子。每次移动封锁标记，奖励轨道前进一格：2🪙、空、$30K、空、1🪙、空，然后循环。可保持原封锁，但不前进也不领奖。",
        tile_knockout: "激活时取回酒吧里自己的全部骰子；其他每位玩家若酒吧中不足 2 枚，需从剩余骰子中选 1 枚放入酒吧。大骰占一个位置。酒吧的骰子不能参与轮末排名。",
        tile_block_it: "从尚未使用的 1、1、2、2、3 枚灰骰组中选一组，全部投到任意未封锁赌场。灰骰作为一个独立虚拟玩家参与排名及平手。",
        tile_handicap: "开轮在赌场 1–3 各放 1 灰骰、4–6 各放 2 灰骰。激活时可移除一枚未封锁赌场的灰骰，选择一个空奖励：1🪙（2 格）、$30K（3 格）或调整自己骰子（4 格）。调整可将剩余骰子转点数投放或取回赌场骰子，不触发小游戏，也不能操作小游戏板上的骰子。",
        tile_black_box: "轮末本赌场大钞获奖者的左手玩家，将 $60K、$20K、$20K、$0、$0、$0 六枚标记秘密分成两堆，每堆至少一枚。获奖者只看到数量，选一堆领取总额；$20K 以 2🪙 支付。",
        tile_double_down: "激活后可将本赌场任意数量的自己的骰子移至额外赌局（包括以前回合的骰子）。轮末独立排名，同数全部取消，前两名获 $60K／$30K，大骰算两枚。其他效果不能移动该板上的骰子。",
        tile_nice_dice: "激活后可把一枚刚掷出且还未投放的骰子，或一枚刚投放到本赌场的骰子，放入同点数奖励格。原占位骰子移到同号赌场，不触发小游戏；若该赌场封锁则不能替换。轮末 1／2 点格奖 1／2🪙，3–6 点格奖 $30K–$60K，大骰只领一份。",
        tile_my_choice: "激活后掷两枚黑骰并选一个结果：1 = 1🪙；2 = 2🪙；3 = $30K；4 = 激活另一小游戏；5 = 转一枚剩余骰子到任意赌场或取回一枚赌场骰子（不触发小游戏）；6 = 一枚剩余骰子占据 $60K 金色奖励格，原占位骰子还给主人。",
    };
    const tileNames = {lucky_punch: "Lucky Punch · 猜拳", jackpot: "Jackpot · 累积大奖", prime_time: "Prime Time · 黄金时段", fifty_fifty: "Fifty Fifty · 猜大小", high_five: "High Five · 五骰大奖", bad_luck: "Bad Luck · 厄运", pay_day: "Pay Day · 发薪日", power_play: "Power Play · 强势行动", no_entry: "No Entry! · 禁止入内", knockout: "Knockout? · 出局酒吧", block_it: "Block It! · 灰骰阻挡", handicap: "Handicap · 移除障碍", black_box: "Black Box · 神秘盒", double_down: "Double Down · 另开赌局", nice_dice: "Nice Dice · 骰子奖励", my_choice: "My Choice · 我的选择"};
    const pipPositions = [[], [4], [0, 8], [0, 4, 8], [0, 2, 6, 8], [0, 2, 4, 6, 8], [0, 2, 3, 5, 6, 8]];
    let view = null, selected = null, signature = null, configSignature = null;
    let pending = false, pendingTimer = null, explaining = false, tipTimer = null;
    let returnFocus = null, suppressUntil = 0, blackMask = 0, lobbyPlayers = 0;
    const esc = value => String(value ?? "").replace(/[&<>"']/g, ch => ({"&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"}[ch]));
    const money = value => `$${(Number(value) || 0).toLocaleString("en-US")}`;
    const shortMoney = value => `$${(Number(value) || 0) / 1000}K`;
    const sum = values => values.reduce((total, value) => total + value, 0);
    const player = id => view?.players.find(item => item.player_id === id);
    const royale = () => view ? view.edition === "royale" : editionSelect?.value === "royale";
    const playerName = id => id === "__neutral__" ? (royale() ? "中立骰" : "白骰") : id === "__gray__" ? "灰骰" : player(id)?.name || "—";
    const playerColor = id => id === "__neutral__" ? "neutral" : id === "__gray__" ? "gray" : Math.max(0, Math.min(4, Number(player(id)?.color) || 0));
    const syncExplanations = () => Object.assign(explanations, classicExplanations, royale() ? royaleExplanations : {});
    const allowed = action => !pending && (view?.legal_actions || []).includes(action);
    const info = (html, key, text = "") => `<span tabindex="0" data-lv-tip="${esc(text || explanations[key])}" data-lv-explain="${key}">${html}</span>`;
    const dice = (face, color = "neutral", extra = "") => `<span class="lv-die lv-color-${color} ${extra}" aria-hidden="true">${Array.from({length: 9}, (_, index) => `<i class="${pipPositions[face]?.includes(index) ? "is-pip" : ""}"></i>`).join("")}</span>`;
    const rollCount = face => (view?.roll?.own || []).filter(value => value === face).length + (view?.roll?.neutral || []).filter(value => value === face).length;

    function hideTip() {
        tip.hidden = true;
        clearTimeout(tipTimer);
    }

    function showTip(anchor, temporary = false) {
        if (explaining || dialog.open || !anchor?.dataset.lvTip) return;
        hideTip();
        tip.textContent = anchor.dataset.lvTip;
        tip.hidden = false;
        const box = anchor.getBoundingClientRect(), size = tip.getBoundingClientRect();
        tip.style.left = `${Math.max(8, Math.min(box.left, innerWidth - size.width - 8))}px`;
        const top = box.top - size.height - 8 > 8 ? box.top - size.height - 8 : box.bottom + 8;
        tip.style.top = `${Math.max(8, Math.min(top, innerHeight - size.height - 8))}px`;
        if (temporary) tipTimer = setTimeout(hideTip, 3000);
    }

    function setExplain(enabled) {
        explaining = enabled;
        panel.classList.toggle("lv-explaining", enabled);
        explainButton.setAttribute("aria-pressed", String(enabled));
        explainButton.title = enabled ? "Choose an item to explain · Esc to exit" : "Explain";
        hideTip();
    }

    function openDialog(title, html) {
        hideTip();
        returnFocus = document.activeElement;
        document.getElementById("lasVegasDialogTitle").textContent = title;
        document.getElementById("lasVegasDialogBody").innerHTML = html;
        if (!dialog.open) dialog.showModal();
        closeButton.focus();
    }

    function openHelp() {
        setExplain(false);
        if (royale()) {
            openDialog("Help · Las Vegas Royale", `<p>豪华版支持 2–5 人，共 3 轮，每轮在 1、2、3 号赌场各启用一块随机小游戏板。8 块双面板共 16 种玩法，同一块板的两面不会同时出现。</p>
                <h3>骰子、筹码和奖池</h3><p>${explanations.dice} ${explanations.chips}</p><p>${explanations.casino} 两张总额相同时，大钞面额较高的组合放到较高编号赌场。每回合 Roll Dice → 选择点数 → Place Dice。也可在掷出后使用 Pass。</p>
                <h3>结算与胜利</h3><p>${classicExplanations.ties} ${explanations.neutral} ${explanations.total} ${explanations.next}</p>
                <p>${explanations.round} 玩家颜色对应骰子，🎲×2 表示大骰，🪙 表示筹码，⬜ 表示灰骰。小游戏先完成当前选择，再继续下一位玩家；秘密选择仅对操作者可见。</p>
                ${Object.entries(tileNames).map(([id, name]) => `<h3>${esc(name)}</h3><p>${esc(explanations[`tile_${id}`])}</p>`).join("")}
                <h3>线上边界处理</h3><p>${explanations.closed} 银行奖金按面额记账，不受实体钞票数量限制；罚金找零保留为现金，不转换成可用于 Pass 的筹码。</p>
                <h3>Controls</h3><p>Help 查看全部规则；Explain 后点选元素查看解释。悬停、聚焦或手机轻点信息可查看提示。确认后才提交选择；Esc 可取消未提交的赌场选择或关闭弹窗。</p>`);
            return;
        }
        openDialog("Help · 拉斯维加斯", `
            <p>在 6 个赌场(🎰)投放骰子(🎲)，争取钞票(💵)。玩 4 轮，累计奖金最多者获胜。采用 Ravensburger / alea 2012 基础版规则，支持 2–5 人。</p>
            <h3>准备与回合</h3><p>每人每轮 8 枚自己的骰子，首轮先手随机，以后每轮先手按座位轮转。54 张钞票洗混：$10,000／$40,000／$50,000 各 6 张，$20,000／$30,000 各 8 张，$60,000／$70,000／$80,000／$90,000 各 5 张。每轮按赌场 1–6 顺序发钞票，直到各赌场至少有 $50,000。</p>
            <p>轮到你时，Roll Dice 掷出全部剩余骰子，选择一个点数，再用 Place Dice 把该点数的全部骰子放入同号赌场。不能只放一部分，也不能重新掷骰或跳过。轮到下一位仍有骰子的玩家，直至所有人放完。</p>
            <h3>平手与领奖</h3><p>${explanations.ties} 有效参与者按骰子数从多到少，依次取得赌场剩余最高面额的一张钞票，直到钞票或参与者用完。例如骰子数为 5、3、3、1 时，两个 3 同时取消资格，5 和 1 依次领奖。</p>
            <p>${explanations.prize} 每张钞票下方显示预计归属；结算后改为已发放或已回收，等待所有人确认后才发下一轮的新钞票。</p>
            <p>钞票面朝下保留，自己可查看面额和总额，其他人只见张数。公开领取奖金的历史仍可查看。${explanations.next} ${explanations.total}</p>
            <h3>可选白骰变体 · 2–4 人</h3><p>${explanations.neutral} 白骰与自己的骰子一起掷，同点数必须一起放；允许只放白骰。白骰不属于投放它的玩家，所有白骰合并成一个中立参与者。</p>
            <h3>图标与 Controls</h3><p>骰子(🎲)表示剩余数量，钞票(💵)表示奖金，私有奖金(🔒)只对自己可见，平手取消(✕)不能领奖，回收(↩)表示回牌库，胜者(🏆)表示最终第一名。K 表示千美元。${explanations.bot}</p>
            <p>选择掷骰区的点数或相应赌场，再点击 Place Dice。点击空白处或按 Esc 取消未提交的点数。Help 查看规则；Explain 后点选虚线元素查看解释，禁用按钮也支持。鼠标悬停、键盘聚焦或手机点击信息可查看提示；手机提示 3 秒后消失。Esc 或点击弹窗外侧可关闭弹窗。</p>`);
    }

    function projectedCasino(casino) {
        if (selected !== casino.face || !allowed("place")) return casino;
        const counts = {...casino.dice};
        counts[view.you] = (counts[view.you] || 0) + (royale() ? sum(view.roll_pieces.filter(d => d.face === selected).map(d => d.big ? 2 : 1)) : view.roll.own.filter(face => face === selected).length);
        const neutral = casino.neutral_dice + view.roll.neutral.filter(face => face === selected).length;
        const participants = Object.entries(counts).filter(([, count]) => count > 0);
        if (neutral > 0) participants.push(["__neutral__", neutral]);
        if (casino.gray_dice > 0) participants.push(["__gray__", casino.gray_dice]);
        const ties = participants.filter(([, count]) => participants.filter(([, other]) => count === other).length > 1).map(([id]) => id);
        const ranked = participants.filter(([id]) => !ties.includes(id)).sort((a, b) => b[1] - a[1]);
        const notes = casino.banknotes.slice().sort((a, b) => b - a);
        return {...casino, dice: counts, neutral_dice: neutral, tied_players: ties, payouts: ranked.slice(0, notes.length).map(([id, count], index) => ({player_id: id, dice: count, amount: notes[index]}))};
    }

    function renderCasino(original) {
        const settled = view.phase === "round_end" || view.game_over;
        const snapshot = view.round_summary?.casinos.find(item => item.face === original.face);
        const casino = settled && snapshot ? snapshot : projectedCasino(original);
        const preview = selected === casino.face && allowed("place");
        const canSelect = allowed("place") && !original.closed && rollCount(casino.face) > 0;
        const occupants = view.players.filter(item => casino.dice[item.player_id] > 0).map(item => [item.player_id, casino.dice[item.player_id]]);
        if (casino.neutral_dice > 0) occupants.push(["__neutral__", casino.neutral_dice]);
        if (casino.gray_dice > 0) occupants.push(["__gray__", casino.gray_dice]);
        occupants.sort((a, b) => b[1] - a[1]);
        const notes = casino.banknotes.slice().sort((a, b) => b - a);
        const totalTip = `${notes.length} 张钞票(💵)，合计 ${money(sum(notes))}；每人最多领取一张。K 表示千美元。${settled ? "本轮已结算，这里保留原奖池供回顾。" : "轮末才发放奖金，投骰期间奖池金额不变。"}`;
        return `<article class="lv-casino ${preview ? "is-selected" : ""} ${original.closed ? "is-closed" : ""}">
            ${original.closed ? `<div class="lv-closed">${info("⛔ 已封锁", "closed")}</div>` : ""}
            <div class="lv-casino-heading"><button type="button" class="lv-casino-select" data-lv-face="${casino.face}" data-lv-explain="casino" aria-label="Casino ${casino.face}${canSelect ? ', select dice' : ''}" aria-pressed="${preview}" ${!canSelect ? "disabled" : ""}>${dice(casino.face)}<span><small>CASINO</small><b>${String(casino.face).padStart(2, "0")}</b></span></button><div class="lv-prize">${info(`<small>${settled ? "原奖池" : "奖池合计"}</small><strong>${shortMoney(sum(notes))}</strong>`, "prize", totalTip)}</div></div>
            <div class="lv-banknotes">${notes.map((note, index) => {
                // Match by rank, not amount: equal-value banknotes may have different recipients.
                const payout = casino.payouts[index];
                const awarded = payout && !!player(payout.player_id);
                const status = awarded ? (settled ? "已发放" : "预计领取") : settled ? "已回收" : payout ? "预计回收" : "暂无人领取";
                const recipient = awarded ? playerName(payout.player_id) : payout ? `${playerName(payout.player_id)} ${payout.player_id === "__gray__" ? "⬜" : "⚪"}` : "";
                const detail = `这是一张 ${money(note)} 的钞票(💵)。${status}${recipient ? `：${recipient}` : ""}。${settled ? "本轮已结算，这里保留分配记录。" : "轮末才正式结算，每位有效参与者最多拿一张；无人领取或白骰取得的钞票回牌库底。"}`;
                const destination = awarded ? `<span class="lv-player-dot lv-color-${playerColor(payout.player_id)}" aria-hidden="true"></span>` : "↩";
                return info(`<span class="lv-banknote ${awarded ? "is-awarded" : "is-returned"}"><b class="lv-note-amount">💵 ${shortMoney(note)}</b><span class="lv-note-status">${status}</span>${recipient ? `<span class="lv-note-recipient">${destination}<span>${esc(recipient)}</span></span>` : ""}</span>`, awarded ? "payout" : "returned", detail);
            }).join("")}</div>
            <div class="lv-casino-label">${preview ? "放置后 · 预计奖金" : settled ? "已结算 · 实得奖金" : "当前排名 · 预计奖金"}${info("每人最多 1 张", "prize")}</div>
            <div class="lv-occupants">${occupants.map(([id, count]) => {
                const tied = casino.tied_players.includes(id), payout = casino.payouts.find(item => item.player_id === id);
                const bigCount = (casino.pieces || []).filter(d => d.player_id === id && d.big).length;
                return `<div class="lv-occupant ${tied ? "is-tied" : ""}"><span class="lv-player-dot lv-color-${playerColor(id)}" aria-hidden="true"></span><span class="lv-occupant-name">${esc(playerName(id))}</span>${info(`<b class="lv-dice-count">${count}🎲${bigCount ? " · 含大骰" : ""}</b>`, id === "__neutral__" ? "neutral" : id === "__gray__" ? "gray" : "dice")}<span class="lv-payout">${tied ? info("✕ 平手", "ties") : payout ? info(`${!player(id) ? "↩ " : ""}${shortMoney(payout.amount)}`, !player(id) ? "returned" : "payout") : info("—", "payout", "有效参与者超过钞票(💵)张数，因此当前没有可分配奖金。")}</span></div>`;
            }).join("") || `<div class="lv-empty-casino">${settled ? "本轮无人投骰" : "等待骰子入场"}</div>`}</div>
            ${settled && snapshot?.returned.length ? `<div class="lv-returned">${info(`↩ 回收 ${snapshot.returned.map(shortMoney).join(" · ")}`, "returned")}</div>` : ""}
            ${royale() ? renderTile(casino.face) : ""}
        </article>`;
    }

    function renderTile(face) {
        const tile = view.tiles.find(t => t.face === face);
        if (!tile) return "";
        let body = "";
        const pieces = view.tile_pieces;
        const diceRow = tile.last_roll.length ? `<div class="lv-extra-dice">${tile.last_roll.map(n => dice(n)).join("")}<span>合计 ${sum(tile.last_roll)}</span></div>` : "";
        const held = location => pieces.filter(d => d.location === location);
        const holder = location => held(location).map(d => `${esc(playerName(d.player_id))}${d.big ? " · 大骰" : ""}`).join(" / ") || "空位";
        if (tile.id === "jackpot") body = `<b>🎰 ${shortMoney(tile.jackpot)}</b>${diceRow}`;
        if (tile.id === "fifty_fifty") body = `${diceRow}<div class="lv-track">${["$0", "1🪙", "$30K", "$40K", "$60K"].map((label, i) => `<span class="${tile.track === i ? "is-current" : ""}">${label}</span>`).join("")}</div>`;
        if (["high_five", "power_play"].includes(tile.id)) body = `<strong>${tile.owner ? esc(playerName(tile.owner)) : "标记待领取"}</strong><span>${tile.id === "high_five" ? "轮末奖励 💵 $100K" : "⚡ 可指定一枚骰子投放"}</span>`;
        if (tile.id === "no_entry") body = `<strong>${view.closed_casino ? `⛔ 赌场 ${view.closed_casino}` : "尚未封锁"}</strong><div class="lv-track">${["○", "2🪙", "○", "$30K", "○", "1🪙"].map((label, i) => `<span class="${tile.track === i ? "is-current" : ""}">${label}</span>`).join("")}</div>`;
        if (tile.id === "block_it") body = `<div class="lv-track">${tile.groups.map(n => `<span>${n ? `${n}⬜` : "✓"}</span>`).join("")}</div>`;
        if (tile.id === "handicap") body = `<span>剩余奖励：${tile.spaces.chip} × 1🪙</span><span>${tile.spaces.cash} × $30K · ${tile.spaces.move} × 调整骰子</span>`;
        if (["double_down", "knockout"].includes(tile.id)) body = `<div class="lv-tile-players">${view.players.map(p => {
            const own = held(tile.id).filter(d => d.player_id === p.player_id);
            return `<span>${esc(p.name)} <b>${tile.id === "double_down" ? sum(own.map(d => d.big ? 2 : 1)) : own.length}🎲</b></span>`;
        }).join("")}</div><span>${tile.id === "double_down" ? "独立派奖 · $60K / $30K" : "最多 2 枚实体骰 / 人"}</span>`;
        if (tile.id === "nice_dice") body = `<div class="lv-reward-slots">${[1, 2, 3, 4, 5, 6].map(n => `<div><b>🎲${n} · ${n < 3 ? `${n}🪙` : `$${n * 10}K`}</b><span>${holder(`nice:${n}`)}</span></div>`).join("")}</div>`;
        if (tile.id === "my_choice") body = `${diceRow}<div class="lv-golden-slot"><b>💵 $60K</b><span>${holder("golden")}</span></div>`;
        if (tile.id === "prime_time") body = `${diceRow}<span>轮末大钞得主 · 可加 0–2 骰</span>`;
        if (tile.id === "black_box") body = "<span>轮末大钞得主 · 二选一秘密奖励</span>";
        if (tile.id === "lucky_punch") body = "<span>✊ 1 / 2 / 3 · 猜错可得奖励</span>";
        if (tile.id === "bad_luck") body = "<span>骰子最少者 · 轮末罚 💸 $50K</span>";
        if (tile.id === "pay_day") body = "<span>每个有己方骰子的赌场 · $10K</span>";
        return `<section class="lv-tile"><h4>${info(esc(tile.name), `tile_${tile.id}`)}</h4><div class="lv-tile-state">${body}${tile.last_result ? `<small>${esc(tile.last_result)}</small>` : ""}</div></section>`;
    }

    function renderDecision() {
        const choice = view.decision, tile = view.tiles.find(t => t.face === choice.face);
        const titles = {lucky_hide: "Secret Choice · 秘密藏标记", lucky_guess: "Your Guess · 猜标记数量", black_split: "Secret Split · 秘密分成两盒", black_pick: "Choose a Box · 选一个盒子", fifty_fifty: "Higher or Lower · 猜大小", prime_time: "Bonus Dice · 轮末加骰", knockout: "Knockout · 选择送入酒吧的骰子", power: "Power Play · 指定投放", manipulate: "Adjust Dice · 调整骰子", activate_other: "Choose a Tile · 激活小游戏", golden: "Golden Slot · 放置奖励骰"};
        const canChoose = allowed("royale_choose");
        let options = `<p class="lv-muted">等待 ${esc(playerName(choice.actor))} 完成选择${["black_split", "lucky_hide"].includes(choice.kind) ? " 🔒" : ""}</p>`;
        if (canChoose && choice.kind === "black_split") {
            const count = choice.tokens.filter((_, i) => blackMask & (1 << i)).length;
            options = `<p class="lv-muted">选入盒 A，其余自动放入盒 B。两盒都至少一枚；对方只看到数量。</p><div class="lv-secret-tokens">${choice.tokens.map((value, i) => `<button type="button" class="lv-option ${blackMask & (1 << i) ? "is-selected" : ""}" data-lv-token="${i}" aria-pressed="${!!(blackMask & (1 << i))}">${shortMoney(value)}<small>盒 ${blackMask & (1 << i) ? "A" : "B"}</small></button>`).join("")}</div><div class="lv-action-line"><span>A: ${count} · B: ${6 - count}</span><button type="button" class="lv-primary" data-lv-option="${blackMask}" ${count < 1 || count > 5 ? "disabled" : ""}>Confirm Split</button></div>`;
        } else if (canChoose) {
            options = `${choice.total !== null ? `<p class="lv-choice-label">当前总点数 <b>${choice.total}</b> · 可领取 ${choice.reward === 10000 ? "1🪙" : shortMoney(choice.reward)}</p>` : ""}<div class="lv-options">${choice.options.map(o => `<button type="button" class="lv-option" data-lv-option="${esc(o.id)}">${esc(o.label)}</button>`).join("")}</div>`;
        }
        return `<section class="lv-box lv-controls"><div class="lv-section-heading"><h3>${titles[choice.kind] || "Choose an Action"}</h3>${info(`🎰 ${choice.face}`, `tile_${tile.id}`)}</div><div class="lv-decision-caption">${esc(tile.name)} · ${esc(playerName(choice.actor))}</div>${options}</section>`;
    }

    function renderControls() {
        if (view.phase === "round_end" || view.game_over) return "";
        if (view.decision) return renderDecision();
        const hasRoll = view.phase === "place";
        const own = player(view.you);
        return `<section class="lv-box lv-controls"><div class="lv-section-heading"><h3>${hasRoll ? "Choose Your Dice" : "Your Next Move"}</h3>${info(`${view.current_turn === view.you ? "Your turn" : esc(playerName(view.current_turn))}`, "round")}</div>
            ${hasRoll ? `<div class="lv-roll-tray">${[1, 2, 3, 4, 5, 6].filter(face => rollCount(face)).map(face => {
                const ownCount = view.roll.own.filter(value => value === face).length;
                const neutralCount = view.roll.neutral.filter(value => value === face).length;
                const big = royale() && view.roll_pieces.some(d => d.face === face && d.big);
                const closed = royale() && view.closed_casino === face;
                return `<button type="button" class="lv-roll-group ${selected === face ? "is-selected" : ""}" data-lv-face="${face}" data-lv-explain="face" aria-label="点数 ${face}，${ownCount} 枚玩家骰子${big ? '，含一枚大骰' : ''}，${neutralCount} 枚白骰${closed ? '，已封锁' : ''}" aria-pressed="${selected === face}" ${!allowed("place") || closed ? "disabled" : ""}>${dice(face, playerColor(view.current_turn))}<span class="lv-roll-counts">${ownCount ? `<b>${ownCount}🎲</b>` : ""}${big ? '<b class="lv-big-badge">含大骰 ×2</b>' : ""}${neutralCount ? `<b class="lv-neutral-count">${neutralCount}⚪</b>` : ""}${closed ? "⛔" : ""}</span></button>`;
            }).join("")}</div>` : `<div class="lv-roll-rest">${dice(5, playerColor(view.current_turn))}<div><strong>${view.current_turn === view.you ? `${(own?.remaining || 0) + (own?.neutral_remaining || 0)} 枚骰子待掷` : "轮流投骰，争夺奖金"}</strong><span>${view.config.neutral_dice ? "彩色骰子与白骰一起掷出" : "每次掷出全部剩余骰子"}</span></div></div>`}
            <div class="lv-action-line"><span class="lv-choice-label">${selected !== null ? `已选 ${selected} 点 · 放置 ${rollCount(selected)} 枚` : hasRoll ? (allowed("place") ? "选择一个点数" : "等待玩家选择点数") : own ? "🎲 你的幸运回合" : "Spectating"}</span><button type="button" class="lv-primary" data-lv-action="${hasRoll ? "place" : "roll"}" data-lv-explain="${hasRoll ? "place" : "roll"}" ${hasRoll ? (!allowed("place") || selected === null ? "disabled" : "") : (!allowed("roll") ? "disabled" : "")}>${pending ? "Sending…" : hasRoll ? "Place Dice" : "Roll Dice"}</button></div>
            ${allowed("royale_pass") ? `<div class="lv-secondary-action"><span>${info(`${own.chips}🪙`, "chips")}</span><button type="button" class="lv-option" data-lv-action="royale_pass" data-lv-explain="${allowed("place") ? "chips" : "closed"}">${allowed("place") ? "Pass · 支付 1🪙" : "Pass · 无法投放，免费跳过"}</button></div>` : ""}
            ${allowed("royale_power") ? '<div class="lv-secondary-action"><button type="button" class="lv-option" data-lv-action="royale_power" data-lv-explain="tile_power_play">Power Play · 指定一枚骰子</button></div>' : ""}
        </section>`;
    }

    function renderReview() {
        if (view.phase !== "round_end" || !view.round_summary) return "";
        const own = view.round_summary.earnings.find(item => item.player_id === view.you);
        return `<section class="lv-box lv-review"><div class="lv-section-heading"><h3>Round ${view.round} · Payouts</h3>${info("💵 已结算", "payout")}</div><div class="lv-earnings">${view.round_summary.earnings.map(row => `<div class="lv-earning"><span class="lv-player-dot lv-color-${playerColor(row.player_id)}" aria-hidden="true"></span><span>${esc(playerName(row.player_id))}</span><strong>${money(row.amount)}</strong></div>`).join("")}</div>
            <div class="lv-review-note">${own ? `${royale() ? "本轮净增（含筹码消耗及小游戏）" : "本轮收入"} ${money(own.amount)}` : "赌场保留本轮最终分配"}${view.round_summary.neutral_returned ? ` · ${royale() ? "中立方" : "白骰"}回收 ${money(view.round_summary.neutral_returned)}` : ""}</div>
            <div class="lv-action-line"><span>Ready <b>${view.next_ready.length} / ${view.players.length}</b></span><button type="button" class="lv-primary" data-lv-action="next" data-lv-explain="next" ${!allowed("next_round") ? "disabled" : ""}>${pending ? "Sending…" : view.next_ready.includes(view.you) ? "Waiting…" : "Next Round"}</button></div></section>`;
    }

    function renderFinal() {
        if (!view.game_over) return "";
        const winners = view.final_results.filter(item => item.rank === 1);
        return `<section class="lv-box lv-final"><span class="lv-eyebrow">THE NIGHT BELONGS TO</span><h3>${info("🏆", "total")} ${esc(winners.map(item => playerName(item.player_id)).join(" / "))}</h3><p>${winners.length > 1 ? "并列获胜" : "大赢家"} · ${view.total_rounds} 轮奖金全部结算</p><div class="lv-rankings">${view.final_results.map(row => `<div class="lv-rank-row ${row.rank === 1 ? "is-winner" : ""}"><b class="lv-rank">${row.rank}</b><span>${esc(playerName(row.player_id))}<small>${row.banknote_count} 张钞票${royale() ? ` · ${row.chips}🪙` : ""}</small></span><strong>${info(money(row.total), "total")}</strong></div>`).join("")}</div></section>`;
    }

    function renderPlayers() {
        return `<section class="lv-box"><div class="lv-section-heading"><h3>At the Table</h3>${info(`${view.players.length} players`, "player")}</div><div class="lv-players">${view.players.map(item => {
            const current = !view.game_over && ["roll", "place", "royale_choice"].includes(view.phase) && item.player_id === view.current_turn;
            const status = view.game_over ? "Final" : view.phase === "round_end" ? view.next_ready.includes(item.player_id) ? "Ready" : "Reviewing" : current ? "Playing" : item.remaining + item.neutral_remaining === 0 ? "Done" : "Waiting";
            return `<article class="lv-player ${current ? "is-current" : ""}"><div class="lv-player-heading"><span class="lv-player-dot lv-color-${playerColor(item.player_id)}" aria-hidden="true"></span><strong>${esc(item.name)}${item.player_id === view.you ? " <small>You</small>" : ""}</strong>${item.is_bot ? info("🤖", "bot") : ""}<span class="lv-player-status">${status}</span></div><div class="lv-player-stats">${info(`${item.remaining}🎲${item.big_remaining ? " · 含大骰" : ""}`, "dice")}${view.config.neutral_dice ? info(`${item.neutral_remaining}⚪`, "neutral") : ""}${royale() ? info(`${item.chips}🪙`, "chips") : ""}${info(`💵 ${item.banknote_count} 张`, "money")}${item.total !== null ? info(money(item.total), item.player_id === view.you ? "private" : "total") : info("🔒", "private")}</div></article>`;
        }).join("")}</div></section>`;
    }

    function renderWallet() {
        if (!player(view.you)) return "";
        return `<section class="lv-box lv-wallet"><div class="lv-section-heading"><h3>Your Winnings</h3>${info("🔒 Private", "private")}</div><strong class="lv-wallet-total">${info(money(view.your_total), "private")}</strong>${royale() ? `<p class="lv-muted">现金 ${money(view.your_cash)} + ${player(view.you).chips}🪙</p>` : ""}<div class="lv-wallet-notes">${view.your_banknotes.length ? view.your_banknotes.slice().sort((a, b) => b - a).map(note => info(`<span class="lv-banknote">💵 ${shortMoney(note)}</span>`, "money")).join("") : '<span class="lv-muted">奖金将在这里积累</span>'}</div></section>`;
    }

    function statusText() {
        if (view.game_over) return "对局结束 · 查看最终排名";
        if (pending) return "Sending…";
        if (view.decision) return `${view.decision.actor === view.you ? "请完成" : `等待 ${playerName(view.decision.actor)} 完成`}赌场 ${view.decision.face} 的小游戏选择`;
        if (view.phase === "round_end") return view.next_ready.includes(view.you) ? "已确认 · 等待所有人查看结算" : "本轮结算完成 · 查看各赌场分配后点击 Next Round";
        if (view.current_turn !== view.you) return `等待 ${playerName(view.current_turn)} ${view.phase === "roll" ? "掷骰" : "选择点数"}`;
        return view.phase === "roll" ? "轮到你了 · 掷出所有剩余骰子" : "选择一个点数 · 查看奖金预览后确认放置";
    }

    function render() {
        if (!view) return;
        const scroll = content.querySelector(".lv-log")?.scrollTop || 0;
        content.innerHTML = `<div class="lv-surface"><div class="lv-banner"><div><span class="lv-eyebrow">SIX CASINOS. ONE LUCKY NIGHT.</span><h2>拉斯维加斯 <small>Las Vegas${royale() ? " Royale" : ""}</small></h2></div><div class="lv-round-marker">${info(`<span>ROUND</span><b>${view.round}<small> / ${view.total_rounds}</small></b>`, "round")}</div></div>
            <div class="lv-status" role="status" aria-live="polite"><span>${esc(statusText())}</span>${info(royale() ? "✨ 豪华版 · 随机小游戏" : view.config.neutral_dice ? "⚪ 白骰变体" : "🎲 基础模式", royale() ? "edition" : view.config.neutral_dice ? "neutral" : "dice")}</div>
            <div class="lv-layout"><div class="lv-main">${renderFinal()}${renderReview()}${renderControls()}<section class="lv-board"><div class="lv-section-heading"><h3>The Strip <small>六大赌场</small></h3>${info(view.phase === "round_end" || view.game_over ? "Final payouts" : "💵 Payout preview", "payout")}</div><div class="lv-casinos">${view.casinos.map(renderCasino).join("")}</div></section></div><aside class="lv-sidebar">${renderPlayers()}${renderWallet()}<section class="lv-box lv-log-box"><div class="lv-section-heading"><h3>Activity</h3>${info("Public log", "log")}</div><div class="lv-log">${view.log.slice().reverse().map(entry => `<p>${typeof entry === "string" ? esc(entry) : `${entry.round ? `<small>${info(`R${entry.round}`, "round", `R 表示 Round：这条记录发生在第 ${entry.round} 轮。整场共 4 轮。`)}</small>` : ""}<span>${esc(entry.text || entry.message || "")}</span>`}</p>`).join("") || '<p class="lv-muted">No activity yet.</p>'}</div></section></aside></div></div>`;
        content.querySelector(".lv-log").scrollTop = scroll;
    }

    function submit(action) {
        if (pending) return;
        pending = true;
        hideTip();
        render();
        clearTimeout(pendingTimer);
        pendingTimer = setTimeout(() => { pending = false; render(); }, 5000);
        sendAction(action);
    }

    function selectFace(face) {
        if (!allowed("place") || !rollCount(face) || view.closed_casino === face) return;
        selected = selected === face ? null : face;
        hideTip();
        render();
        content.querySelector(`.lv-roll-group[data-lv-face="${face}"]`)?.focus({preventScroll: true});
    }

    panel.addEventListener("click", event => {
        if (explaining || dialog.contains(event.target)) return;
        const button = event.target.closest("button");
        if (button && !button.disabled && view) {
            if (button.dataset.lvFace) selectFace(Number(button.dataset.lvFace));
            const action = button.dataset.lvAction;
            if (action === "roll" && allowed("roll")) submit({type: "roll", round: view.round, turn: view.turn});
            if (action === "place" && selected !== null && allowed("place")) submit({type: "place", round: view.round, turn: view.turn, face: selected});
            if (action === "next" && allowed("next_round")) submit({type: "next_round", round: view.round});
            if (["royale_pass", "royale_power"].includes(action) && allowed(action)) submit({type: action, round: view.round, turn: view.turn});
            if (button.dataset.lvToken !== undefined && allowed("royale_choose") && view.decision.kind === "black_split") {
                blackMask ^= 1 << Number(button.dataset.lvToken);
                render();
                content.querySelector(`[data-lv-token="${button.dataset.lvToken}"]`)?.focus({preventScroll: true});
            }
            if (button.dataset.lvOption !== undefined && allowed("royale_choose")) submit({type: "royale_choose", round: view.round, turn: view.turn, decision: view.decision.id, option: button.dataset.lvOption});
            return;
        }
        const anchor = event.target.closest("[data-lv-tip]");
        if (anchor) showTip(anchor, true);
    });

    function explainAt(event) {
        const control = event.target.closest("button, input, select, a");
        let element = control ? (control.matches("[data-lv-explain]") ? control : null) : event.target.closest("[data-lv-explain]");
        if (event.type === "pointerdown") {
            const disabled = [...panel.querySelectorAll(":disabled[data-lv-explain]")].find(item => {
                const rect = item.getBoundingClientRect();
                return rect.width > 0 && rect.height > 0 && event.clientX >= rect.left && event.clientX <= rect.right && event.clientY >= rect.top && event.clientY <= rect.bottom;
            });
            if (disabled) element = disabled;
        }
        event.preventDefault();
        event.stopImmediatePropagation();
        if (element && explanations[element.dataset.lvExplain]) {
            const detail = explanations[element.dataset.lvExplain];
            setExplain(false);
            if (event.type === "pointerdown") suppressUntil = performance.now() + 700;
            openDialog("Explain", `<p>${esc(detail)}</p>`);
        }
    }

    document.addEventListener("pointerdown", event => {
        if (!explaining || event.target.closest("#lasVegasHelpBtn, #lasVegasExplainBtn, #lasVegasDialog")) return;
        explainAt(event);
    }, true);
    document.addEventListener("click", event => {
        if (performance.now() < suppressUntil) {
            suppressUntil = 0; event.preventDefault(); event.stopImmediatePropagation(); return;
        }
        if (!explaining || event.target.closest("#lasVegasHelpBtn, #lasVegasExplainBtn, #lasVegasDialog")) return;
        explainAt(event);
    }, true);
    document.addEventListener("click", event => {
        if (!view || selected === null || pending || explaining || dialog.open || !panel.getClientRects().length) return;
        if (event.target.closest("button, input, select, a, label, [data-lv-tip], #lasVegasDialog")) return;
        selected = null; hideTip(); render();
    });
    panel.addEventListener("pointerover", event => { if (event.pointerType === "mouse") showTip(event.target.closest("[data-lv-tip]")); });
    panel.addEventListener("pointerout", event => { if (event.pointerType === "mouse") hideTip(); });
    panel.addEventListener("focusin", event => showTip(event.target.closest("[data-lv-tip]")));
    panel.addEventListener("focusout", hideTip);
    panel.addEventListener("keydown", event => {
        if ((event.key === "Enter" || event.key === " ") && event.target.matches("[data-lv-tip]")) {
            event.preventDefault();
            if (explaining) explainAt(event);
            else showTip(event.target, true);
        }
    });
    document.addEventListener("keydown", event => {
        if (event.key !== "Escape" || !panel.getClientRects().length) return;
        setExplain(false); hideTip();
        if (!dialog.open && selected !== null && !pending) { selected = null; render(); }
    });
    helpButton.addEventListener("click", openHelp);
    explainButton.addEventListener("click", () => setExplain(!explaining));
    closeButton.addEventListener("click", () => dialog.close());
    dialog.addEventListener("click", event => {
        if (event.target !== dialog) return;
        const rect = dialog.getBoundingClientRect();
        if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) dialog.close();
    });
    dialog.addEventListener("close", () => { if (returnFocus?.isConnected) returnFocus.focus({preventScroll: true}); });
    window.addEventListener("resize", hideTip);
    window.addEventListener("blur", hideTip);
    document.addEventListener("scroll", hideTip, true);

    function syncSetup() {
        const isRoyale = editionSelect.value === "royale";
        document.getElementById("lasVegasNeutralOption").hidden = isRoyale;
        neutralCheckbox.disabled = isRoyale || lobbyPlayers > 4;
        if (lobbyPlayers > 4) neutralCheckbox.checked = false;
        neutralCheckbox.dataset.lvExplain = "neutral";
        document.getElementById("lasVegasSetupHint").textContent = isRoyale ? "3 轮 · 7 小骰 + 1 大骰 · 每轮 2🪙 · 赌场 1–3 随机小游戏" : lobbyPlayers > 4 ? "5 人使用基础模式 · 白骰变体限 2–4 人" : "每人 8 枚骰子 · 4 轮争夺赌场奖金";
        syncExplanations();
    }
    editionSelect.addEventListener("change", syncSetup);
    window.getLasVegasConfig = () => ({edition: editionSelect.value, neutral_dice: editionSelect.value === "classic" && neutralCheckbox.checked});

    function syncRoom(state) {
        if (!state || state.game_type !== "las_vegas") return;
        const lobby = state.status === "lobby";
        setup.hidden = !lobby;
        if (lobby) {
            view = null; selected = null; signature = null; content.innerHTML = "";
            pending = false; clearTimeout(pendingTimer);
        }
        const nextConfigSignature = JSON.stringify([state.room_id, state.game_config?.edition, !!state.game_config?.neutral_dice]);
        if (configSignature !== nextConfigSignature) {
            neutralCheckbox.checked = !!state.game_config?.neutral_dice;
            editionSelect.value = state.game_config?.edition === "royale" ? "royale" : "classic";
        }
        configSignature = nextConfigSignature;
        lobbyPlayers = state.players?.length || 0;
        syncSetup();
    }

    window.renderLasVegasGameState = data => {
        const next = data?.view;
        if (!next || next.game_id !== "las_vegas") return;
        const nextSignature = JSON.stringify([data.room_id, next.you, next.round, next.turn, next.phase, next.decision?.id]);
        if (signature !== nextSignature) { selected = null; blackMask = 0; hideTip(); }
        signature = nextSignature;
        view = next;
        editionSelect.value = next.edition === "royale" ? "royale" : "classic";
        syncExplanations();
        neutralCheckbox.checked = !!next.config.neutral_dice;
        if (selected !== null && !rollCount(selected)) selected = null;
        pending = false;
        clearTimeout(pendingTimer);
        setup.hidden = true;
        render();
    };
    window.showLasVegasHeaderActions = visible => {
        header.style.display = visible ? "flex" : "none";
        if (!visible) {
            view = null; selected = null; signature = null; configSignature = null; pending = false; suppressUntil = 0;
            clearTimeout(pendingTimer);
            setExplain(false); hideTip();
            if (dialog.open) dialog.close();
            content.innerHTML = "";
            setup.hidden = true;
        }
    };

    function connectEvents() {
        if (typeof socket === "undefined") return;
        socket.on("system:error", () => {
            if (pending) { pending = false; clearTimeout(pendingTimer); render(); }
        });
        socket.on("room:state", syncRoom);
        if (typeof currentRoomState !== "undefined") syncRoom(currentRoomState);
        if (typeof lastGameStatePayload !== "undefined" && lastGameStatePayload?.game_type === "las_vegas" && typeof currentRoomState !== "undefined" && currentRoomState?.status !== "lobby" && currentRoomState?.room_id === lastGameStatePayload.room_id) window.renderLasVegasGameState(lastGameStatePayload);
    }
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", connectEvents, {once: true});
    else connectEvents();
})();
