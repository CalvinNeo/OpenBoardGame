(() => {
    "use strict";

    const panel = document.getElementById("takeTimePanel");
    const header = document.getElementById("takeTimeHeaderActions");
    const helpButton = document.getElementById("takeTimeHelpBtn");
    const explainButton = document.getElementById("takeTimeExplainBtn");
    const dialog = document.getElementById("takeTimeDialog");
    const dialogTitle = document.getElementById("takeTimeDialogTitle");
    const dialogBody = document.getElementById("takeTimeDialogBody");
    const dialogClose = document.getElementById("takeTimeDialogClose");
    const configBox = document.getElementById("takeTimeConfigBox");
    let view = null;
    let version = null;
    let selectedCard = null;
    let selectedSegment = null;
    let pending = false;
    let pendingTimer = null;
    let returnFocus = null;
    let planOpen = false;
    let logOpen = false;
    let tipAnchor = null;
    let tipTimer = null;
    let tipHideTimer = null;
    let touchStart = null;
    let inputKind = "mouse";
    const tip = document.createElement("div");
    tip.id = "takeTimeImmediateTip";
    tip.className = "take-time-tooltip";
    tip.hidden = true;
    document.body.append(tip);

    const explanations = {
        card: ["Your cards", "太阳 Solar(☀️) 和月亮 Lunar(🌙) 各有 1–12；未知数值(?) 在 Ready 前隐藏。点击选择一张自己的牌，再选择时段。暗置后仍可查看自己的牌；仅自己可见(🔒)，公开可见(👁)。灰色牌暂时不可出，可能尚未轮到你，或本关要求先出最大／最小牌。"],
        sector: ["Clock segment", "从指针起点(🧭 / START) 开始，按顺时针序号(↻) 比较六个时段。每段至少一张，总和(Σ)可以相等；差值(Δ)关比较两张牌的大数减小数。颜色、数量、目标等条件在揭牌时判定。通过(✓)、未通过(✕)只在结算后显示。"],
        ready: ["Ready", "先讨论(💬)并商量目标。Ready 会让你看见自己的手牌并保持静默(🤫)，不能撤销；全员准备后才允许出牌。第一个人 Ready 后公共目标(🎯)锁定。"],
        down: ["Place face down", "暗置(🔒)：将选中的手牌放到选中的时段，立即结束你的回合。队友能看到牌背颜色、是谁出的和出牌顺序(#)，不能看到数值。已放的牌不能移动。"],
        up: ["Place face up", "明置(👁)：花一个全队共享的明牌额度，将选中的牌公开放置。基础额度等于人数，重试最多获得额外 3 次。禁止明牌(🙈)的静夜练习即使有奖励也不能明置。"],
        plan: ["Shared target", "公共目标(🎯)：讨论时用增加(+)／减少(−)约定各段的大致目标。目标只是参考，不参与胜负。首位玩家 Ready 后锁定。自由指针关卡的目标按起点顺序显示。"],
        hand: ["Clock hand", "指针起点(🧭 / START) 决定顺时针序号(↻)。普通钟盘从时段 1 开始。自由指针练习可在看牌前选择起点；结算会尝试所有起点，保留原位置或找到可通过的位置。这里只改变比较起点，不旋转牌或规则。"],
        next: ["Next Round", "确认你已经看完揭牌结果。所有玩家都确认后，才执行显示的重试、下一关、跳过或结束。机器人只确认自己；有人掉线时会继续等待。"],
        choice: ["Continue choice", "重试(🔁 Retry)保留失败奖励；跳过(✉️ Skip to Regrets)将本关记入遗憾封套并重置奖励，主路线结束后会重新挑战。下一关(→ Next Clock)前往下一个钟盘；End Journey 结束路线。修改继续方式会清空已有确认。"],
        reserve: ["Two-player reserve", "备用牌(✉️ Reserve)：两人局各有两张未查看的牌。双方各出完两张（全队第 4 张落下）后，同时加入手牌。未知数值(?)连本人也不能提前看到。"],
        quota: ["Face-up allowance", "明牌额度(👁)：已使用次数／全队总额度。太阳(☀️)和月亮(🌙)牌共用额度。通常总额度等于人数，重试奖励最多 +3；禁止明牌(🙈)的关卡始终为 0。"],
        regrets: ["Regrets", "遗憾封套(✉️ Regrets)记录跳过的钟盘数量；主路线完成后会依次重访。它与两人局的备用牌(✉️ Reserve)用途不同。"],
        players: ["Players", "讨论中(💬 Planning)、已准备并保持静默(🤫 Ready)、当前出牌者(▶ Playing)、已确认继续(✓ Ready)。机器人(🤖)也只确认自己的回合。牌背太阳(☀️)／月亮(🌙)颜色公开，备用牌(✉️)显示剩余数量。"],
        metric: ["Clock values", "总和(Σ)是时段中所有牌的数值相加；差值(Δ)是两张牌的大数减小数。从起点(🧭)顺时针(↻)比较，后一段必须大于等于(≥)前一段，允许相等。上限(≤)始终约束总和；无上限(∞)表示本关不限制总和。"],
        checks: ["Revealed checks", "通过(✓)与未通过(✕)表示揭牌后的条件判定。未通过的条件直接列出；展开 Passed checks 可以查看已通过的条件。所有人确认 Next Round 后才继续。"],
        rules: ["Clock rules", "禁止明牌(🙈)：只能暗置。先出最大(⬆️)／最小(⬇️)：每次从自己的当前手牌中选最大／最小值。自由指针(🧭)：可改变比较起点。具体数量、颜色、区间和落点要求见各时段。"],
    };

    const hints = {
        card: "太阳 Solar(☀️)／月亮 Lunar(🌙)各有 1–12。未知(?)在 Ready 后可见；选一张牌和一个时段，再确认放置。",
        players: "讨论(💬) → 静默(🤫) → 出牌(▶)。确认继续(✓)，机器人(🤖)。牌背太阳(☀️)／月亮(🌙)公开，备用牌(✉️)暂不看。",
        metric: "总和(Σ)：牌值相加；差值(Δ)：大数减小数。顺时针(↻)非递减，可相等。上限(≤)约束总和；∞ 表示无上限。",
        quota: "明牌(👁)：已用／总额度，全队共享。重试最多 +3；禁止明牌(🙈)时为 0。",
        reserve: "备用牌(✉️ Reserve)：两人局各 2 张；全队放完第 4 张后加入手牌，此前数值(?)保密。",
        regrets: "遗憾封套(✉️ Regrets)：跳过的钟盘数；完成主路线后会重新挑战。",
        plan: "公共目标(🎯)仅供参考，不参与胜负。+／− 调整数值；首位玩家 Ready 后锁定。",
        hand: "起点(🧭 / START)决定顺时针(↻)比较顺序。看牌前可调整；结算也会尝试其他起点。",
        rules: "禁明牌(🙈)；先出手中最大(⬆️)／最小(⬇️)；自由指针(🧭)可改变起点。",
    };

    const TAKE_TIME_HELP_CONFIG = {
        gameId: "take_time",
        title: { zh: "Take Time · 时光共度", en: "Take Time" },
        basic: {
            win: {
                zh: "这是一款全队合作游戏，你们要一起把 12 张牌放进六个时段，让每一段都满足钟盘上的全部条件，走完路线上的每一个钟盘就算赢。",
                en: "This is a cooperative game. Together you place twelve cards into six segments so that every segment satisfies all of its clock conditions, and you win by clearing every clock on the route."
            },
            turn: {
                zh: "讨论阶段按下 Ready 才会看到自己的手牌，放牌阶段轮到你时选一张手牌和一个时段，再决定暗置还是明置。",
                en: "Press Ready in the discussion phase to look at your own hand, and on your turn in the placement phase choose one card plus one segment, then decide face down or face up."
            },
            key: {
                zh: "只有你自己知道暗置牌的数字，所以真正的难点是用讨论和有限的全队明牌额度(👁)把信息传给队友。",
                en: "Only you know the value of a card you place face down, so the real challenge is passing that information to your team through discussion and a small shared face-up allowance (👁)."
            }
        },
        sections: [
            {
                id: "flow",
                label: { zh: "一关的流程", en: "Round flow" },
                html: {
                    zh: "<p>每一关都从讨论阶段(💬)开始。所有玩家都按下 Ready 之后进入放牌阶段，第一张牌任何人都可以先放，之后按座位顺序轮流。</p>"
                        + "<p>放满 12 张牌后自动揭牌，全队进入回顾阶段。所有玩家都按下 Next Round 之后，才会执行你们选定的继续方式。</p>"
                        + "<p>只要还有人没确认，任何人都能改选继续方式。一旦有人改选，已经按下的确认会全部清空。</p>",
                    en: "<p>Every clock starts with a discussion phase (💬). Once every player has pressed Ready the placement phase begins. Anyone may place the first card, and play then continues in seat order.</p>"
                        + "<p>When the twelfth card lands the clock is revealed and the team enters the review phase. The continuation you picked only happens after every player presses Next Round.</p>"
                        + "<p>As long as somebody has not confirmed yet, anyone may change the continuation. Changing it clears every confirmation made so far.</p>"
                }
            },
            {
                id: "cards",
                label: { zh: "牌与手牌", en: "Cards and hands" },
                html: {
                    zh: "<p>牌堆共 24 张，太阳(☀️)和月亮(🌙)各有 1 到 12。每一关只随机发 12 张，牌背颜色对所有人公开。</p>"
                        + "<p>两人局每人 4 张手牌外加 2 张备用牌(✉️)，三人局每人 4 张，四人局每人 3 张。</p>"
                        + "<p>两人局在全队放下第 4 张牌之后，双方同时拿起备用牌(✉️)。在那之前备用牌(✉️)连本人都看不到数字。</p>"
                        + "<p>按下 Ready 之前你的手牌显示为未知数值(?)，Ready 之后数字只有你自己看得见。</p>",
                    en: "<p>The deck holds 24 cards. Solar (☀️) and lunar (🌙) each run from 1 to 12. Only twelve cards are dealt per clock, and the colour on every card back is public.</p>"
                        + "<p>In a two player game each player holds 4 cards plus 2 reserve cards (✉️). Three players get 4 cards each and four players get 3 cards each.</p>"
                        + "<p>In a two player game both players pick up their reserve cards (✉️) at the same time, right after the fourth card of the team lands. Until then nobody, not even the owner, may look at them.</p>"
                        + "<p>Before you press Ready your hand shows unknown values (?). After Ready only you can see the numbers.</p>"
                }
            },
            {
                id: "placing",
                label: { zh: "暗置与明置", en: "Face down and face up" },
                html: {
                    zh: "<p>暗置(🔒)把选中的手牌扣在选中的时段，数字只有你自己知道。队友只能看到牌背颜色、出牌人和放置顺序(#)。已经放下的牌不能再移动。</p>"
                        + "<p>明置(👁)花掉一次全队共享的明牌额度(👁)，把牌正面朝上放好，所有玩家都能看到数字。</p>"
                        + "<p>额度总数通常等于玩家人数。失败之后重试会累积额外额度，最多 3 次。禁止明牌(🙈)的关卡额度始终为 0。</p>"
                        + "<p>点击空白处或按 Esc 可以取消还没提交的选牌。</p>",
                    en: "<p>Face down (🔒) puts the selected card on the selected segment with only you knowing its value. Teammates see the card back colour, who played it and the placement order (#). A placed card can never be moved again.</p>"
                        + "<p>Face up (👁) spends one shared face-up allowance (👁) and places the card so that every player can read the number.</p>"
                        + "<p>The allowance normally equals the number of players. Failing a clock earns extra allowance for the retry, up to three extra. A clock that forbids face-up cards (🙈) always has zero.</p>"
                        + "<p>Click an empty area or press Esc to cancel a selection you have not submitted.</p>"
                }
            },
            {
                id: "reveal",
                label: { zh: "揭牌与判定", en: "Reveal and checks" },
                html: {
                    zh: "<p>每个时段至少要有一张牌。</p>"
                        + "<p>从指针起点(🧭)开始按顺时针(↻)比较，后一个时段的总和(Σ)必须大于等于(≥)前一个，允许相等。</p>"
                        + "<p>上限(≤)约束每个时段的总和(Σ)。官方入门关没有上限(∞)。</p>"
                        + "<p>差值(Δ)关每个时段必须两张牌，比较的是大数减小数。</p>"
                        + "<p>还要满足钟盘上写出的颜色、数量、区间、最接近和极值条件。判定结果用通过(✓)与未通过(✕)标出，结算前不会替你预检隐藏的数字。</p>",
                    en: "<p>Every segment needs at least one card.</p>"
                        + "<p>Starting from the clock hand (🧭) and moving clockwise (↻), the sum (Σ) of each segment must be greater than or equal to (≥) the one before it. Equal values are allowed.</p>"
                        + "<p>The cap (≤) limits the sum (Σ) of each segment. The official introductory clock has no cap (∞).</p>"
                        + "<p>On a difference clock (Δ) every segment holds exactly two cards and the comparison uses the larger number minus the smaller one.</p>"
                        + "<p>The clock also lists colour, count, range, closest and extreme conditions. Results appear as passed (✓) or failed (✕). Nothing is checked for you before the reveal.</p>"
                }
            },
            {
                id: "clocks",
                label: { zh: "钟盘与特殊规则", en: "Clocks and special rules" },
                html: {
                    zh: "<p>路线一共 12 个钟盘。第一个是官方入门的苏醒，其余 11 个是本项目的原创练习配置。当前钟盘会把条件直接写在界面上。</p>"
                        + "<p>禁止明牌(🙈)表示这一关只能暗置。先出最大(⬆️)和先出最小(⬇️)表示每次都要从自己当前手牌里选最大或最小的牌。</p>"
                        + "<p>自由指针(🧭)允许你在看牌之前选择比较起点。结算时如果所选起点不成立，会自动改用第一个可行的起点。</p>"
                        + "<p>有些钟盘规定第几张牌必须落在哪个时段。公共目标(🎯)只是讨论时的参考数值，不参与胜负判定，并在第一位玩家按下 Ready 后锁定。</p>",
                    en: "<p>The route holds twelve clocks. The first one is the official introduction, Awakening, and the other eleven are original practice configurations written for this project. The current clock prints its conditions on screen.</p>"
                        + "<p>No face-up (🙈) means this clock only allows face down cards. Highest first (⬆️) and lowest first (⬇️) mean you must always play the largest or smallest card in your current hand.</p>"
                        + "<p>A movable hand (🧭) lets you choose the starting segment before you look at your cards. If your choice turns out to be impossible at scoring time, the first workable start is used instead.</p>"
                        + "<p>Some clocks dictate which segment a given placement must go to. The shared target (🎯) is only a reference for discussion, never part of the result, and it locks as soon as the first player presses Ready.</p>"
                }
            },
            {
                id: "retry",
                label: { zh: "失败与遗憾", en: "Failing and regrets" },
                html: {
                    zh: "<p>六个时段的判定全部通过才算成功，任何一段没通过就是失败。</p>"
                        + "<p>失败后可以重试(🔁)。每一次失败都让下一次重试多一次明牌额度(👁)，最多 3 次。</p>"
                        + "<p>也可以跳过(✉️)，把这一关放进遗憾封套(✉️)。主路线走完之后会依次重访这些关卡。</p>"
                        + "<p>通关或者跳过都会清空累积的额外额度。End Journey 可以随时结束本次路线。</p>",
                    en: "<p>You succeed only when all six segments pass. A single failing segment means the clock is failed.</p>"
                        + "<p>After a failure you may retry (🔁). Every failure grants one extra face-up allowance (👁) for the next attempt, up to three extra.</p>"
                        + "<p>You may also skip (✉️), which files the clock into the regrets envelope (✉️). Those clocks are revisited one by one after the main route ends.</p>"
                        + "<p>Clearing or skipping a clock resets the accumulated bonus. End Journey closes the route at any time.</p>"
                }
            }
        ]
    };

    const TAKE_TIME_EXPLAIN = {
        card: { zh: "你的手牌。太阳(☀️)和月亮(🌙)各有 1 到 12，未知数值(?)在按下 Ready 之前隐藏。点击选中一张自己的牌，再选一个时段。", en: "Your hand. Solar (☀️) and lunar (🌙) each run from 1 to 12, and unknown values (?) stay hidden until you press Ready. Click one of your cards to select it, then pick a segment." },
        sector: { zh: "钟盘上的六个时段。从指针起点(🧭 / START)开始按顺时针(↻)编号比较。每段至少一张，总和(Σ)允许相等。颜色、数量和目标条件在揭牌时判定。", en: "The six segments of the clock. They are compared clockwise (↻) starting from the clock hand (🧭 / START). Each needs at least one card and equal sums (Σ) are allowed. Colour, count and target conditions are judged at the reveal." },
        ready: { zh: "先讨论(💬)并商量目标。按下 Ready 才会看见自己的手牌，并且此后保持静默(🤫)，不能撤销。全员准备后才允许出牌，第一位玩家按下 Ready 后公共目标(🎯)锁定。", en: "Discuss (💬) and agree on a plan first. Ready reveals your own hand and starts the silence (🤫), and it cannot be undone. Cards may only be placed once everyone is ready, and the shared target (🎯) locks when the first player presses Ready." },
        down: { zh: "暗置(🔒)。把选中的手牌扣到选中的时段，并立即结束你的回合。队友能看到牌背颜色、出牌人和放置顺序(#)，看不到数值。已放的牌不能移动。", en: "Face down (🔒). Place the selected card on the selected segment and end your turn at once. Teammates see the card back colour, the player and the placement order (#), but never the value. Placed cards cannot be moved." },
        up: { zh: "明置(👁)。花掉一次全队共享的明牌额度(👁)，把选中的牌公开放置。额度通常等于人数，重试最多额外获得 3 次。禁止明牌(🙈)的关卡即使有额度也不能明置。", en: "Face up (👁). Spend one shared face-up allowance (👁) to place the selected card in the open. The allowance normally equals the player count and a retry grants at most three extra. A clock that forbids face-up cards (🙈) never allows it." },
        plan: { zh: "公共目标(🎯)。讨论时用加号(+)和减号(−)约定各段的大致目标。目标只是参考，不参与胜负，并在首位玩家按下 Ready 后锁定。", en: "Shared target (🎯). Use plus (+) and minus (−) during discussion to agree on a rough value per segment. It is a reference only, never part of the result, and it locks when the first player presses Ready." },
        hand: { zh: "指针起点(🧭 / START)决定顺时针(↻)的比较顺序。普通钟盘从时段 1 开始，自由指针关卡可以在看牌前选择起点，结算时也会尝试其他起点。", en: "The clock hand (🧭 / START) decides where the clockwise (↻) comparison begins. A normal clock starts at segment 1, while a movable hand clock lets you choose the start before looking at your cards and also tries other starts at scoring time." },
        next: { zh: "确认你已经看完揭牌结果。所有玩家都确认之后，才会执行显示的重试、跳过、下一关或结束。有人改选继续方式时，已有确认会被清空。", en: "Confirm that you have read the reveal. The displayed retry, skip, next clock or end only happens once every player has confirmed. Changing the continuation clears the confirmations already given." },
        choice: { zh: "选择继续方式。重试(🔁)保留失败得到的奖励额度。跳过(✉️)把本关记入遗憾封套(✉️)并重置奖励，主路线结束后会重新挑战。下一关(→)前往下一个钟盘。End Journey 结束本次路线。", en: "Choose how to continue. Retry (🔁) keeps the bonus earned by failing. Skip (✉️) files this clock into the regrets envelope (✉️) and resets the bonus, and you meet the clock again after the main route. Next clock (→) moves on. End Journey closes the route." },
        reserve: { zh: "备用牌(✉️)。两人局每人两张未查看的牌，全队放下第 4 张牌之后同时加入手牌。未知数值(?)连本人也不能提前看到。", en: "Reserve cards (✉️). In a two player game each player holds two unseen cards that join the hand together once the fourth card of the team lands. Their unknown values (?) stay hidden even from the owner." },
        quota: { zh: "明牌额度(👁)。已使用次数与全队总额度，太阳(☀️)和月亮(🌙)共用。总额度通常等于人数，重试奖励最多 +3，禁止明牌(🙈)的关卡为 0。", en: "Face-up allowance (👁), shown as used out of the team total and shared by solar (☀️) and lunar (🌙) cards. The total normally equals the player count, a retry adds at most three, and a no face-up clock (🙈) is always zero." },
        regrets: { zh: "遗憾封套(✉️)记录被跳过的钟盘数量，主路线完成之后会依次重访。它与两人局的备用牌(✉️)用途不同。", en: "The regrets envelope (✉️) counts the clocks you skipped, and they are revisited one by one after the main route. It has nothing to do with the two player reserve cards (✉️)." },
        players: { zh: "所有玩家的状态。讨论中(💬)、已准备并保持静默(🤫)、当前出牌者(▶)、已确认继续(✓)。牌背的太阳(☀️)和月亮(🌙)颜色公开，备用牌(✉️)显示剩余数量。", en: "The state of every player: discussing (💬), ready and silent (🤫), currently playing (▶) or confirmed to continue (✓). Card back colours solar (☀️) and lunar (🌙) are public, and reserve cards (✉️) show how many are left." },
        metric: { zh: "钟盘数值。总和(Σ)是时段内所有牌相加，差值(Δ)是两张牌的大数减小数。从起点(🧭)顺时针(↻)比较，后一段必须大于等于(≥)前一段，允许相等。上限(≤)约束总和，无上限(∞)表示本关不限制总和。", en: "Clock values. The sum (Σ) adds every card in a segment and the difference (Δ) is the larger number minus the smaller one. Compared clockwise (↻) from the start (🧭), each segment must be greater than or equal to (≥) the previous one, and equal values are fine. The cap (≤) limits the sum and no cap (∞) means this clock does not limit it." },
        checks: { zh: "揭牌后的条件判定。通过(✓)与未通过(✕)标出每个条件，未通过的直接列出，展开 Passed checks 可以查看已经通过的条件。", en: "The conditions judged after the reveal. Passed (✓) and failed (✕) mark every condition. Failed ones are listed directly and expanding Passed checks shows the ones that succeeded." },
        rules: { zh: "本关的特殊规则。禁止明牌(🙈)表示只能暗置。先出最大(⬆️)和先出最小(⬇️)表示每次从自己的手牌里选最大或最小的值。自由指针(🧭)可以改变比较起点。", en: "The special rules of this clock. No face-up (🙈) means face down only. Highest first (⬆️) and lowest first (⬇️) mean you always play the largest or smallest value in your hand. A movable hand (🧭) can change the starting segment." },
        dialog_close: { zh: "关闭当前对话框。对话框也可以按 Esc 或者点击外部区域关闭。", en: "Close the current dialog. You can also press Esc or click outside the dialog to dismiss it." },
    };

    let takeTimeHelpWidget = null;
    let takeTimeExplainWidget = null;

    function initTakeTimeHelpExplain() {
        if (takeTimeHelpWidget || typeof window.obgCreateHelp !== "function") return;
        takeTimeHelpWidget = window.obgCreateHelp(TAKE_TIME_HELP_CONFIG);
        takeTimeExplainWidget = window.obgCreateExplain({
            gameId: "take_time",
            attribute: "data-tt-explain",
            explanations: TAKE_TIME_EXPLAIN,
            button: explainButton,
            root: () => panel,
            bypass: ["#takeTimeHelpBtn", "#takeTimeExplainBtn"],
            onChange: active => { if (active) hideTip(); }
        });
        helpButton?.addEventListener("click", () => {
            takeTimeExplainWidget?.exit();
            takeTimeHelpWidget.open();
        });
        explainButton?.addEventListener("click", () => takeTimeExplainWidget?.toggle());
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", initTakeTimeHelpExplain);
    } else {
        initTakeTimeHelpExplain();
    }

    const explaining = () => Boolean(takeTimeExplainWidget?.isActive());

    function esc(value) {
        return String(value ?? "").replace(/[&<>"']/g, character => ({"&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"}[character]));
    }

    function button(text, action, explanation, disabled = false, extra = "") {
        return `<button type="button" data-tt-action="${action}" data-tt-explain="${explanation}" ${disabled ? "disabled" : ""} ${extra}>${text}</button>`;
    }

    function info(text, description, explanation, extra = "") {
        if (description === explanations[explanation]?.[1]) description = hints[explanation] || description;
        return `<button type="button" class="take-time-info" data-tt-tip="${esc(description)}" data-tt-explain="${explanation}" ${extra}>${text}</button>`;
    }

    function infoIcon(description, explanation, label) {
        return info("ⓘ", description, explanation, `aria-label="${esc(label)}"`);
    }

    function segmentDescription(index) {
        const labels = view.clock.segments[index].labels;
        return `时段 ${index + 1}：${labels.length ? labels.join("；") : "至少一张牌"}。太阳(☀️)，月亮(🌙)。起点(🧭 / START)开始，按顺时针序号(↻)比较；允许相等。`;
    }

    function available(action) {
        return !pending && Boolean(view?.legal_actions.includes(action));
    }

    function playerName(id) {
        return view?.players.find(player => player.player_id === id)?.name || "Player";
    }

    function cardHTML(card, small = false) {
        const face = card.value == null ? "?" : card.value;
        const icon = card.color === "solar" ? "☀️" : "🌙";
        const marker = card.owner ? (card.face_up || view.result ? "👁" : card.value != null ? "🔒" : "") : "";
        const content = `<span>${icon}</span><strong>${face}</strong>${marker ? `<small>${marker}</small>` : ""}`;
        if (small) {
            const label = `${card.color === "solar" ? "太阳 Solar(☀️)" : "月亮 Lunar(🌙)"} · ${face === "?" ? "未知数值(?)" : face}${card.owner ? ` · ${playerName(card.owner)} · 放置顺序 #${card.order}` : " · 备用牌(✉️ Reserve)"}${marker === "🔒" ? " · 仅自己可见(🔒)" : marker === "👁" ? " · 公开可见(👁)" : " · 数值尚未公开"}`;
            return `<button type="button" class="take-time-mini ${card.color}" data-tt-tip="${esc(label)}" data-tt-explain="card" aria-label="${esc(label)}">${content}</button>`;
        }
        const disabled = !available("place") || !view.legal_card_ids.includes(card.id);
        return button(content, "card", "card", disabled,
            `class="take-time-card ${card.color} ${selectedCard === card.id ? "selected" : ""}" data-card="${esc(card.id)}" aria-pressed="${selectedCard === card.id}" aria-label="${esc(`${icon} ${face}`)}"`);
    }

    function boardHTML() {
        const start = view.result?.hand_segment ?? view.hand_segment;
        const sectors = view.board.map((cards, index) => {
            const result = view.result?.segments[index];
            const order = (index - start + 6) % 6 + 1;
            const labels = view.clock.segments[index].labels;
            const selected = selectedSegment === index;
            const disabled = !available("place") || !view.legal_segments.includes(index);
            const total = result ? info(`${view.clock.metric === "difference" ? `Δ ${result.value} · Σ ${result.sum}` : `Σ ${result.sum}`} ${result.passed ? "✓" : "✕"}`, `${explanations.metric[1]} ${result.passed ? "通过(✓)" : "未通过(✕)"}`, "metric", 'data-tt-total="true"')
                : `<span class="take-time-count">${cards.length} ${cards.length === 1 ? "card" : "cards"}</span>`;
            const passed = result?.checks.filter(check => check.passed) || [];
            const failed = result?.checks.filter(check => !check.passed) || [];
            const checks = result ? `<div class="take-time-checks">${failed.map(check => `<span class="fail">✕ ${esc(check.label)}</span>`).join("")}${passed.length ? `<details><summary data-tt-explain="checks">✓ ${passed.length} passed checks</summary>${passed.map(check => `<span class="pass">✓ ${esc(check.label)}</span>`).join("")}</details>` : ""}</div>` : "";
            return `<div class="take-time-sector take-time-sector-${index} ${selected ? "selected" : ""} ${result ? result.passed ? "passed" : "failed" : ""}">
                <div class="take-time-sector-heading">${button(`<strong>${index === start ? "🧭" : ""} ${index + 1}</strong><small>${order === 1 ? "START" : `↻ ${order}`}</small>`, "sector", "sector", disabled, `data-segment="${index}" aria-pressed="${selected}" aria-label="Select segment ${index + 1}, ${cards.length} cards"`)}${infoIcon(segmentDescription(index), "sector", `Segment ${index + 1} rules and order`)}</div>
                <span class="take-time-sector-rules">${labels.length ? labels.map(label => `<span>${esc(label)}</span>`).join("") : "至少一张"}</span>
                <span class="take-time-pile">${cards.map(card => cardHTML(card, true)).join("") || '<span class="take-time-empty">＋</span>'}</span>
                ${total}${checks}
            </div>`;
        }).join("");
        return `<div class="take-time-clock" aria-label="Six clock segments, clockwise from the hand">${sectors}
            <div class="take-time-clock-center"><div class="take-time-dial" aria-hidden="true"><span>🕰️</span></div><strong>${view.clock.metric === "difference" ? "DIFFERENCES" : "TAKE TIME"}</strong>
            <span>${view.placed_count} / 12 cards</span>${info(`↻ ${view.clock.metric === "difference" ? "Δ 差值" : "Σ 总和"}递增 · 可相等`, explanations.metric[1], "metric")}
            ${info(view.clock.cap === null ? "∞ 无总和上限" : `Σ ≤ ${view.clock.cap}`, explanations.metric[1], "metric")}</div></div>`;
    }

    function playersHTML() {
        return view.players.map(player => {
            const own = player.player_id === view.you;
            const status = view.phase === "discussion" ? player.ready ? "🤫 Ready" : "💬 Planning"
                : view.result ? player.next_ready ? "✓ Ready" : "Reviewing"
                : player.player_id === view.current_turn ? "▶ Playing" : `${player.hand.length} in hand`;
            return `<div class="take-time-player ${player.player_id === view.current_turn ? "active" : ""}">
                <div><strong>${esc(player.name)}${own ? " · You" : ""}${player.is_bot ? " 🤖" : ""}</strong><small>${status}</small></div>
                ${info(`${player.hand.map(card => card.color === "solar" ? "☀️" : "🌙").join(" ") || "0 cards"}${player.reserve.length ? ` · ✉️ ${player.reserve.length}` : ""}`, explanations.players[1], "players", 'aria-label="Card backs and player status"')}</div>`;
        }).join("");
    }

    function planHTML() {
        const locked = !available("set_plan");
        return `<details class="take-time-details take-time-plan" data-detail="plan" ${planOpen ? "open" : ""}><summary data-tt-explain="plan">Shared plan ${locked ? "· Locked" : "· Optional"}</summary>
            <div class="take-time-plan-label">${info("🎯 Targets", explanations.plan[1], "plan")}<span>Optional reference</span></div><div class="take-time-plan-grid">${view.targets.map((target, index) => {
                const segment = (index + view.hand_segment) % 6;
                return `<div class="take-time-plan-cell"><span>Segment ${segment + 1}</span><div>${button("−", "plan", "plan", locked || target <= 0, `data-index="${index}" data-delta="-1" aria-label="Lower target ${segment + 1}"`)}<strong>${target}</strong>${button("+", "plan", "plan", locked || target >= 36, `data-index="${index}" data-delta="1" aria-label="Raise target ${segment + 1}"`)}</div></div>`;
            }).join("")}</div>${view.clock.movable_hand ? `<div class="take-time-hand-picker"><span>Clock hand ${infoIcon(explanations.hand[1], "hand", "Clock hand and starting segment")}</span>${[0, 1, 2, 3, 4, 5].map(index => button(String(index + 1), "hand", "hand", !available("set_hand"), `data-segment="${index}" aria-pressed="${view.hand_segment === index}"`)).join("")}</div>` : ""}</details>`;
    }

    function actionHTML() {
        const own = view.players.find(player => player.player_id === view.you);
        if (!own) return '<p class="take-time-notice">Spectating · Private card values are hidden.</p>';
        if (view.result) {
            const choices = {retry: "🔁 Retry", advance: "→ Next Clock", skip: "✉️ Skip to Regrets", finish: "End Journey"};
            if (view.game_over) {
                return `<div class="take-time-result-title">${view.journey_complete ? "🏆 Journey complete" : "Journey ended"}</div><p>${view.completed.length} / ${view.itinerary.length} clocks passed${view.journey_complete ? "." : ` · ${view.itinerary.length - view.completed.length} unfinished.`}</p>`;
            }
            const waiting = view.players.filter(player => !player.next_ready).map(player => player.name).join(", ");
            return `<div class="take-time-result-title">${view.result.success ? "✅ Test passed" : "🔎 Try again"}</div>
                <p>${view.result.success ? "已满足本关所有条件。" : `查看钟盘上的红色条件。重试奖励 +${view.bonus}${view.clock.no_face_up ? "；本关仍禁止明牌" : " 次明牌"}。`}</p>
                ${view.result.hand_segment !== view.result.planned_hand ? `<p>🧭 结算起点调整为时段 ${view.result.hand_segment + 1}。</p>` : ""}
                <div class="take-time-choice-row">${view.next_choices.map(choice => button(choices[choice], "choice", "choice", !available("choose_next"), `data-choice="${choice}" aria-pressed="${view.next_choice === choice}"`)).join("")}</div>
                <p class="take-time-next-summary">Continue: <strong>${choices[view.next_choice]}</strong></p>
                ${button(`Next Round · ${view.next_ready.length}/${view.players.length}`, "next", "next", !available("next_round"), 'class="take-time-primary take-time-next"')}
                <p class="take-time-waiting">${own.next_ready ? "Your confirmation is saved. " : "Review the revealed cards before continuing. "}${waiting ? `Waiting: ${esc(waiting)}` : ""}</p>`;
        }
        const handTitle = `<h3>Your hand ${infoIcon(explanations.card[1], "card", "Card colors, hidden values and selection")}</h3>`;
        const reserve = own.reserve.length ? `<div class="take-time-reserve">${info(`✉️ Reserve · ${own.reserve.length}`, explanations.reserve[1], "reserve")}${own.reserve.map(card => cardHTML(card, true)).join("")}</div>` : "";
        if (view.phase === "discussion") {
            return `${handTitle}<p class="take-time-hand-status">${own.ready ? "🤫 Keep silent · Waiting for everyone" : "💬 Discuss together before looking"}</p>
                <div class="take-time-hand">${own.hand.map(card => cardHTML(card)).join("")}</div>${reserve}
                ${button(own.ready ? "Ready · Waiting" : "Ready · Look at cards", "ready", "ready", !available("ready"), 'class="take-time-primary take-time-next"')}`;
        }
        const selected = own.hand.find(card => card.id === selectedCard);
        const canPlace = available("place") && selected && selectedSegment !== null;
        const quota = view.face_up_limit - view.face_up_used;
        const description = selected ? `${selected.color === "solar" ? "☀️" : "🌙"} ${selected.value}${selectedSegment !== null ? ` → Segment ${selectedSegment + 1}` : " · Choose a segment"}`
            : selectedSegment !== null ? `Segment ${selectedSegment + 1} · Choose a card` : "Choose a card, then a segment";
        return `${handTitle}<div class="take-time-hand">${own.hand.map(card => cardHTML(card)).join("")}</div>${reserve}
            <p class="take-time-selection" aria-live="polite">${description}</p><div class="take-time-place-actions">
            ${button("🔒 Place face down", "down", "down", !canPlace, 'class="take-time-primary"')}
            ${button(`👁 Place face up · ${quota}`, "up", "up", !canPlace || quota <= 0)}</div>
            <p class="take-time-hint">${pending ? "Sending…" : available("place") ? "Click empty space or press Esc to cancel." : "Waiting for your turn."}</p>`;
    }

    function render() {
        if (!view || !panel) return;
        hideTip();
        const own = view.players.some(player => player.player_id === view.you);
        let status;
        if (view.game_over) status = "Journey ended";
        else if (view.result) status = "⏸ Review the revealed clock";
        else if (view.phase === "discussion") status = "💬 Discuss before looking";
        else if (!view.current_turn) status = "🤫 Anyone may play first";
        else status = view.current_turn === view.you ? "▶ Your turn · Keep silent" : `🤫 ${playerName(view.current_turn)}'s turn`;
        const rules = [];
        if (view.clock.no_face_up) rules.push("🙈 禁止明牌");
        if (view.clock.play_order !== "any") rules.push(view.clock.play_order === "highest" ? "⬆️ 每次出手中最大牌" : "⬇️ 每次出手中最小牌");
        if (view.clock.movable_hand) rules.push("🧭 自由指针");
        if (view.clock.metric === "difference") rules.push("每段两张 · 按差值排序");
        const origin = view.clock.source === "official_1_1" ? "Official · Chapter 1 / Clock 1" : "Original practice";
        panel.innerHTML = `<div class="take-time-shell"><div class="take-time-title-row"><div><span class="take-time-eyebrow">A MOMENT, TOGETHER</span><h2>${esc(view.clock.name)}</h2><span class="take-time-origin">${origin}</span></div><div class="take-time-progress"><strong>${view.completed.length}<small> / ${view.itinerary.length}</small></strong><span>clocks passed</span></div></div>
            <div class="take-time-status"><strong role="status">${info(esc(status), explanations.players[1], "players")}</strong><span>Attempt ${view.attempt} · ${info(`👁 ${view.face_up_used}/${view.face_up_limit}`, explanations.quota[1], "quota", 'aria-label="Face-up allowance used and total"')}</span></div>
            ${rules.length ? `<div class="take-time-clock-rules">${rules.map(rule => info(rule, explanations.rules[1], "rules")).join("")}</div>` : ""}
            <div class="take-time-layout ${view.result ? "is-review" : ""}"><section class="take-time-board-area">${boardHTML()}<div class="take-time-legend">${info("☀️ Solar", "太阳 Solar(☀️)：1–12 的浅色牌，牌背颜色公开。", "card")}${info("🌙 Lunar", "月亮 Lunar(🌙)：1–12 的深色牌，牌背颜色公开。", "card")}${info("🔒 Only you", "仅自己可见(🔒)：暗置的牌只有出牌者知道数字；结算时向全员公开。", "down")}${info("👁 Public", "公开可见(👁)：所有玩家都能看到数字。", "up")}</div></section>
            <section class="take-time-action-box">${actionHTML()}</section><div class="take-time-players">${playersHTML()}</div>${planHTML()}</div>
            <div class="take-time-footer">${info(`✉️ Regrets · ${view.regrets.length}`, explanations.regrets[1], "regrets")}<span>${own ? "🤝 Win or learn together" : "Spectator"}</span></div>
            <details class="take-time-details" data-detail="log" ${logOpen ? "open" : ""}><summary>Activity</summary><ol class="take-time-log">${view.log.slice().reverse().map(line => `<li>${esc(line)}</li>`).join("")}</ol></details>
            </div>`;
        panel.querySelectorAll("details[data-detail]").forEach(details => details.addEventListener("toggle", () => {
            if (details.dataset.detail === "plan") planOpen = details.open;
            else logOpen = details.open;
        }));
    }

    function clearSelection() {
        if (selectedCard === null && selectedSegment === null) return;
        selectedCard = null;
        selectedSegment = null;
        render();
    }

    function hideTip() {
        window.clearTimeout(tipTimer);
        window.clearTimeout(tipHideTimer);
        tipAnchor?.removeAttribute("aria-describedby");
        tipAnchor = null;
        tip.hidden = true;
    }

    function showTip(target, touch = false) {
        if (!target?.isConnected || explaining() || dialog.open) return;
        hideTip();
        tipAnchor = target;
        tip.textContent = target.dataset.ttTip;
        tip.classList.toggle("is-touch", touch);
        tip.setAttribute("role", touch ? "status" : "tooltip");
        target.setAttribute("aria-describedby", tip.id);
        tip.hidden = false;
        const anchor = target.getBoundingClientRect();
        const rect = tip.getBoundingClientRect();
        const width = window.visualViewport?.width || innerWidth;
        const height = window.visualViewport?.height || innerHeight;
        const left = touch ? (width - rect.width) / 2 : anchor.left;
        const top = touch
            ? anchor.top > height / 2 ? 12 : height - rect.height - 12
            : anchor.top > rect.height + 16 ? anchor.top - rect.height - 8 : anchor.bottom + 8;
        tip.style.left = `${Math.max(12, Math.min(width - rect.width - 12, left)) + (window.visualViewport?.offsetLeft || 0)}px`;
        tip.style.top = `${Math.max(12, Math.min(height - rect.height - 12, top)) + (window.visualViewport?.offsetTop || 0)}px`;
        if (touch) tipTimer = window.setTimeout(hideTip, 3000);
    }

    function openDialog(title, content, html = false) {
        hideTip();
        returnFocus = document.activeElement;
        dialogTitle.textContent = title;
        if (html) dialogBody.innerHTML = content;
        else dialogBody.textContent = content;
        if (!dialog.open) dialog.showModal();
        dialogClose.focus();
    }

    function submit(action) {
        if (pending || !view || typeof sendAction !== "function") return;
        pending = true;
        selectedCard = null;
        selectedSegment = null;
        render();
        sendAction(action);
        window.clearTimeout(pendingTimer);
        pendingTimer = window.setTimeout(() => { pending = false; render(); }, 6000);
    }

    panel.addEventListener("click", event => {
        if (event.target.closest("summary, .take-time-checks")) return;
        const target = event.target.closest("[data-tt-action]")
            || event.target.closest(".take-time-sector")?.querySelector('[data-tt-action="sector"]');
        if (!target || target.disabled || explaining()) return;
        const kind = target.dataset.ttAction;
        if (kind === "card") {
            selectedCard = selectedCard === target.dataset.card ? null : target.dataset.card;
            render();
        } else if (kind === "sector") {
            const segment = Number(target.dataset.segment);
            selectedSegment = selectedSegment === segment ? null : segment;
            render();
        } else if (kind === "ready") submit({type: "ready"});
        else if (kind === "next") submit({type: "next_round"});
        else if (kind === "choice") submit({type: "choose_next", choice: target.dataset.choice});
        else if (kind === "plan") {
            const index = Number(target.dataset.index);
            submit({type: "set_plan", segment: index, target: view.targets[index] + Number(target.dataset.delta)});
        } else if (kind === "hand") submit({type: "set_hand", segment: Number(target.dataset.segment)});
        else if ((kind === "down" || kind === "up") && selectedCard && selectedSegment !== null) {
            submit({type: "place", card_id: selectedCard, segment: selectedSegment, face_up: kind === "up"});
        }
    });

    dialogClose.addEventListener("click", () => dialog.close());
    dialog.addEventListener("click", event => {
        if (event.target !== dialog) return;
        const box = dialog.getBoundingClientRect();
        if (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom) dialog.close();
    });
    dialog.addEventListener("close", () => { if (returnFocus?.isConnected) returnFocus.focus(); });

    document.addEventListener("pointerdown", event => {
        if (explaining() || !view || !panel.contains(event.target)) return;
        if (event.target.closest("button, input, select, summary, a, .take-time-hand-picker, .take-time-sector")) return;
        clearSelection();
    });
    document.addEventListener("keydown", event => {
        if (event.key === "Tab") inputKind = "keyboard";
        if (event.key !== "Escape" || panel.classList.contains("hidden")) return;
        if (dialog.open) return;
        if (!tip.hidden) { hideTip(); return; }
        takeTimeExplainWidget?.exit();
        clearSelection();
    });

    document.addEventListener("pointerover", event => {
        if (event.pointerType === "touch" || event.pointerType === "pen" || explaining()) return;
        if (tip.contains(event.target) || tipAnchor?.contains(event.target)) window.clearTimeout(tipHideTimer);
        const target = event.target.closest("#takeTimePanel [data-tt-tip]");
        if (target && target !== tipAnchor) { inputKind = "mouse"; showTip(target); }
    });
    document.addEventListener("pointerout", event => {
        if (inputKind === "touch" || !tipAnchor) return;
        if ((tipAnchor.contains(event.target) || tip.contains(event.target))
            && !tipAnchor.contains(event.relatedTarget) && !tip.contains(event.relatedTarget)) {
            tipHideTimer = window.setTimeout(hideTip, 150);
        }
    });
    document.addEventListener("focusin", event => {
        const target = event.target.closest("#takeTimePanel [data-tt-tip]");
        if (target && inputKind !== "touch") showTip(target);
    });
    document.addEventListener("focusout", event => {
        if (inputKind !== "touch" && tipAnchor?.contains(event.target)) hideTip();
    });
    document.addEventListener("pointerdown", event => {
        if (explaining() || panel.classList.contains("hidden")) return;
        inputKind = ["touch", "pen"].includes(event.pointerType) ? "touch" : "mouse";
        const target = event.target.closest("#takeTimePanel [data-tt-tip]");
        if (target && inputKind === "touch") {
            touchStart = {id: event.pointerId, target, x: event.clientX, y: event.clientY, moved: false};
        } else if (!target && !tip.contains(event.target)) hideTip();
    }, true);
    document.addEventListener("pointermove", event => {
        if (touchStart?.id === event.pointerId
            && Math.hypot(event.clientX - touchStart.x, event.clientY - touchStart.y) > 10) {
            touchStart.moved = true;
            hideTip();
        }
    }, true);
    document.addEventListener("pointerup", event => {
        if (!touchStart || touchStart.id !== event.pointerId) return;
        const start = touchStart;
        touchStart = null;
        if (!start.moved && start.target.isConnected && !explaining()) showTip(start.target, true);
    }, true);
    document.addEventListener("pointercancel", () => { touchStart = null; }, true);
    document.addEventListener("click", event => {
        const target = event.target.closest("#takeTimePanel [data-tt-tip]");
        if (!target || explaining()) return;
        event.preventDefault();
        event.stopImmediatePropagation();
        if (inputKind !== "touch" || event.detail === 0) showTip(target);
    }, true);
    document.addEventListener("scroll", () => {
        if (touchStart) touchStart.moved = true;
        if (inputKind !== "touch") hideTip();
    }, true);
    window.addEventListener("resize", hideTip);
    window.visualViewport?.addEventListener("resize", hideTip);

    function clearState() {
        view = null;
        version = null;
        selectedCard = null;
        selectedSegment = null;
        pending = false;
        planOpen = false;
        logOpen = false;
        touchStart = null;
        window.clearTimeout(pendingTimer);
        takeTimeExplainWidget?.exit();
        if (dialog.open) dialog.close();
        panel.innerHTML = "";
    }

    window.renderTakeTimeGameState = data => {
        if (!data?.view) return;
        const nextVersion = `${data.room_id}:${data.state_version}`;
        if (version !== nextVersion) { selectedCard = null; selectedSegment = null; }
        version = nextVersion;
        view = data.view;
        pending = false;
        window.clearTimeout(pendingTimer);
        render();
    };
    window.showTakeTimeHeaderActions = visible => {
        header.style.display = visible ? "flex" : "none";
        if (!visible) clearState();
    };
    window.clearTakeTimeState = clearState;
    window.getTakeTimeConfig = () => ({start_clock: document.getElementById("takeTimeStartClock").value});
    window.updateTakeTimeConfigRow = () => {
        const visible = currentGameType === "take_time" && currentRoomState?.status === "lobby";
        configBox.classList.toggle("hidden", !visible);
        configBox.setAttribute("aria-hidden", String(!visible));
    };
    if (typeof socket !== "undefined") socket.on("system:error", () => {
        if (pending) { pending = false; window.clearTimeout(pendingTimer); render(); }
    });
})();
