(() => {
  "use strict";

  let hotStreakView = null;
  let hotStreakSelectedCards = new Set();
  let hotStreakPendingStack = null;
  let hotStreakPendingDouble = null;
  let hotStreakAdvanceTimer = null;
  let hotStreakFallbackTimer = null;
  let hotStreakScheduledStep = null;
  let hotStreakHelpWidget = null;
  let hotStreakExplainWidget = null;
  let hotStreakDoubleDialog = null;
  let hotStreakTipNode = null;
  let hotStreakTipTimer = null;
  let hotStreakPointerType = "mouse";
  let hotStreakLogOpen = false;
  let hotStreakTrackOpen = null;
  let hotStreakTrackPhase = null;

  const byId = (id) => document.getElementById(id);

  const hotStreakPanel = byId("hotStreakPanel");
  const hotStreakHeaderActions = byId("hotStreakHeaderActions");
  const hotStreakHelpBtn = byId("hotStreakHelpBtn");
  const hotStreakExplainBtn = byId("hotStreakExplainBtn");
  const hotStreakRaceLabel = byId("hotStreakRaceLabel");
  const hotStreakPhaseLabel = byId("hotStreakPhaseLabel");
  const hotStreakTurnLabel = byId("hotStreakTurnLabel");
  const hotStreakNoticeToggle = byId("hotStreakNoticeToggle");
  const hotStreakDataNotice = byId("hotStreakDataNotice");
  const hotStreakPlayersSection = byId("hotStreakPlayersSection");
  const hotStreakPlayers = byId("hotStreakPlayers");
  const hotStreakPlayersSummary = byId("hotStreakPlayersSummary");
  const hotStreakTicketSection = byId("hotStreakTicketSection");
  const hotStreakTicketHint = byId("hotStreakTicketHint");
  const hotStreakTickets = byId("hotStreakTickets");
  const hotStreakTicketMask = byId("hotStreakTicketMask");
  const hotStreakConfirmTitle = byId("hotStreakConfirmTitle");
  const hotStreakConfirmModes = byId("hotStreakConfirmModes");
  const hotStreakConfirmCancel = byId("hotStreakConfirmCancel");
  const hotStreakDraftProgress = byId("hotStreakDraftProgress");
  const hotStreakHandSection = byId("hotStreakHandSection");
  const hotStreakHand = byId("hotStreakHand");
  const hotStreakHandHint = byId("hotStreakHandHint");
  const hotStreakSubmissionProgress = byId("hotStreakSubmissionProgress");
  const hotStreakSubmitBtn = byId("hotStreakSubmitBtn");
  const hotStreakTrackSection = byId("hotStreakTrackSection");
  const hotStreakTrackToggle = byId("hotStreakTrackToggle");
  const hotStreakTrackBody = byId("hotStreakTrackBody");
  const hotStreakTrackStatus = byId("hotStreakTrackStatus");
  const hotStreakSwerveKey = byId("hotStreakSwerveKey");
  const hotStreakTrack = byId("hotStreakTrack");
  const hotStreakCurrentCard = byId("hotStreakCurrentCard");
  const hotStreakStandings = byId("hotStreakStandings");
  const hotStreakStandingsList = byId("hotStreakStandingsList");
  const hotStreakResult = byId("hotStreakResult");
  const hotStreakResultTitle = byId("hotStreakResultTitle");
  const hotStreakResultBody = byId("hotStreakResultBody");
  const hotStreakReadyProgress = byId("hotStreakReadyProgress");
  const hotStreakContinueBtn = byId("hotStreakContinueBtn");
  const hotStreakNextRaceBtn = byId("hotStreakNextRaceBtn");
  const hotStreakPlayAgainBtn = byId("hotStreakPlayAgainBtn");
  const hotStreakSideBetSection = byId("hotStreakSideBetSection");
  const hotStreakSideBet = byId("hotStreakSideBet");
  const hotStreakSideResult = byId("hotStreakSideResult");
  const hotStreakSideEvidence = byId("hotStreakSideEvidence");
  const hotStreakPoolSection = byId("hotStreakPoolSection");
  const hotStreakPoolCount = byId("hotStreakPoolCount");
  const hotStreakPool = byId("hotStreakPool");
  const hotStreakLogPanel = byId("hotStreakLogPanel");
  const hotStreakLogToggle = byId("hotStreakLogToggle");
  const hotStreakLogCount = byId("hotStreakLogCount");
  const hotStreakLog = byId("hotStreakLog");

  const HOT_STREAK_PHASE_LABELS = {
    betting: "Betting",
    card_selection: "Pick Cards",
    race_countdown: "Starting",
    racing: "Racing",
    race_result: "Results",
    game_over: "Game Over",
  };

  const HOT_STREAK_HELP_CONFIG = {
    gameId: "hot_streak",
    title: { zh: "火热连胜 · Hot Streak", en: "Hot Streak" },
    basic: {
      win: {
        zh: "三场比赛结束后，手里现金(💵)最多的玩家获胜，现金相同则并列获胜。",
        en: "After three races the player holding the most cash (💵) wins, and equal fortunes share the win.",
      },
      turn: {
        zh: "每一场你先按蛇形顺序拿两张下注票(🎟️)，再从手牌里秘密投入比赛牌(🃏)，然后比赛会自动一张张翻开跑完。",
        en: "Each race you first take two betting tickets (🎟️) in a snake draft, then secretly add a race card (🃏) from your hand, and the race then plays out card by card on its own.",
      },
      key: {
        zh: "重点是用公开牌池(🗂️)推断哪位角色会跑出好名次，并在安全(🛡️)与冒险(🔥)之间押对赔率。",
        en: "The key is reading the public race pool (🗂️) to judge which racer will place well, and picking the right odds between Safe (🛡️) and Risky (🔥).",
      },
    },
    sections: [
      {
        id: "setup",
        label: { zh: "准备", en: "Setup" },
        html: {
          zh: `<p>游戏共进行三场比赛，每位玩家开局拿到现金(💵)10 元。每场比赛使用固定的 18 张比赛牌(🃏)：公开的基础牌堆(🗂️)加上每位玩家秘密投入的牌。</p>
<p>2 人局有三点不同：每人手牌 4 张、每场拿 3 张下注票(🎟️)、每场秘密投入 2 张比赛牌(🃏)。</p>
<p>第一场的首位玩家随机决定，之后每场的首位玩家按座位顺时针移动一位。</p>`,
          en: `<p>The game runs three races and every player starts with cash (💵) 10. Each race uses exactly 18 race cards (🃏): the public base deck (🗂️) plus the cards players secretly contribute.</p>
<p>A two-player game differs in three ways: four cards in hand, three betting tickets (🎟️) per race, and two race cards (🃏) contributed per race.</p>
<p>The first player of race one is random, and the starting seat moves one place clockwise after every race.</p>`,
        },
      },
      {
        id: "betting",
        label: { zh: "下注", en: "Betting" },
        html: {
          zh: `<p>可选的票堆共 6 个：4 个角色，加上当前边注(🎲)的成立(✅ YES)与不成立(❌ NO)。每个票堆有 3 层，只有拿走顶层才会露出下一层。</p>
<p>拿票时必须同时决定安全(🛡️)还是冒险(🔥)。安全(🛡️)回报较低但输钱少，冒险(🔥)回报更高，猜错时可能倒扣现金(💵)。</p>
<p>角色票按最终名次(🥇🥈🥉)赔付，边注票则看这场比赛的边注(🎲)是否成立。</p>
<p>第三场拿到自己的第二张票时，必须指定本场的一张票加倍，收益与罚款都会翻倍。</p>`,
          en: `<p>There are six ticket stacks: the four racers, plus YES (✅) and NO (❌) for the current side bet (🎲). Each stack has three layers and the next one only shows after the top ticket is taken.</p>
<p>Taking a ticket locks in Safe (🛡️) or Risky (🔥) at the same moment. Safe (🛡️) pays less but rarely costs you, while Risky (🔥) pays more and can take cash (💵) away when you guess wrong.</p>
<p>Racer tickets pay by finishing place (🥇🥈🥉), and side tickets pay on whether the side bet (🎲) comes true.</p>
<p>In race three, the moment you take your second ticket you must double one of your tickets, which doubles both the reward and the penalty.</p>`,
        },
      },
      {
        id: "cards",
        label: { zh: "比赛牌", en: "Race Cards" },
        html: {
          zh: `<p>数字让角色沿当前朝向移动，负数则反向移动。转向(↩️)会调换朝向，倒地(💫)会让角色摔倒，恢复牌会先让它站起并面向前方。</p>
<p>星位(⭐)牌让角色移动到朝向方向的下一个星位(⭐)，每条星位(⭐)横跨四条跑道，终点线后还有一个星位(⭐)。倒地的角色遇到任何移动都只爬 1 格。</p>
<p>绿色全体牌同时作用于所有还在场上的角色，它们之间不会相撞，并且不会冲过终点线。</p>
<p>侧滑方向以角色自身朝向为准：Blaze(🐻)与 Dash(🌭)向右，Ripple(🐟)与 Comet(👑)向左，所以背向跑的角色在画面上会朝相反方向换道。</p>`,
          en: `<p>Numbers move a racer along its current facing and negative numbers move it backwards. Turn around (↩️) flips the facing, fall down (💫) knocks a racer over, and a recover card stands it up facing forward before it moves.</p>
<p>A star (⭐) card moves the racer to the next star (⭐) along its facing. Every star row (⭐) crosses all four lanes and one row sits just past the finish line. A fallen racer only crawls one space no matter which card it draws.</p>
<p>Green all-racer cards resolve at the same time for everyone still racing, they never cause collisions between racers, and they stop before the finish line.</p>
<p>Swerve directions are relative to the racer's own facing: Blaze (🐻) and Dash (🌭) go right, Ripple (🐟) and Comet (👑) go left, so a backward racer changes lanes the opposite way on screen.</p>`,
        },
      },
      {
        id: "racing",
        label: { zh: "比赛过程", en: "Racing" },
        html: {
          zh: `<p>比赛牌(🃏)洗混后先烧掉 3 张，然后逐张公开结算。撞到站立的角色会把它撞倒(💥)，撞到已经倒地的角色会直接淘汰(🚫)。</p>
<p>离开跑道两侧、向后跑出后沿，或者赛道折叠时被折掉，都会让角色出局(🚫)并立刻拿到当前最差的名次。</p>
<p>四个角色中有三个已经确定名次时比赛立刻结束，剩下的角色自动获得最后的名次。</p>
<p>如果 18 张牌全部翻完仍未分出名次，赛道后沿会向前折叠一次，被折掉的角色出局(🚫)，然后 18 张牌重新洗混并再烧 3 张。</p>`,
          en: `<p>The race deck (🃏) is shuffled, three cards are burned, and then every card is revealed and resolved one at a time. Running into a standing racer knocks it down (💥), and running into a fallen racer knocks it out (🚫).</p>
<p>Leaving the track sideways, running off the back edge, or standing in the folded area all disqualify a racer (🚫), which immediately takes the worst place still open.</p>
<p>Once three of the four racers have a place the race ends at once and the last racer takes the remaining place.</p>
<p>If all 18 cards are used without a result, the rear edge folds forward, racers caught behind it are disqualified (🚫), and all 18 cards are shuffled again with three more burned.</p>`,
        },
      },
      {
        id: "scoring",
        label: { zh: "结算", en: "Scoring" },
        html: {
          zh: `<p>每张票单独算出收益或罚款，先把这一场的全部金额相加，再让现金(💵)最低停在 0。数字版采用这一裁定，避免结算顺序影响结果。</p>
<p>并列出局时，这几名角色共享一段名次，下注按其中较差的名次赔付。</p>
<p>第一、二场结束后会停在结果页，所有玩家都点击 Next Race 才会开始下一场。第三场结束后现金(💵)最多的玩家获胜。</p>`,
          en: `<p>Every ticket is scored on its own, the whole race is summed first, and only then is the cash (💵) floor of 0 applied. This digital version uses that ruling so the order of tickets never changes the result.</p>
<p>When racers are knocked out at the same moment they share a range of places, and bets pay on the worse place in that range.</p>
<p>After races one and two the game waits on the result page until every player clicks Next Race. After race three the richest player in cash (💵) wins.</p>`,
        },
      },
    ],
  };

  const HOT_STREAK_EXPLAIN = {
    race: {
      zh: "当前是第几场比赛。三场比赛全部结束后，现金(💵)最多的玩家获胜。",
      en: "Which of the three races is running. The player with the most cash (💵) after all three races wins.",
    },
    phase: {
      zh: "当前阶段：下注、选牌、比赛、结算。不同阶段能做的操作不同。",
      en: "The current phase: betting, choosing cards, racing or scoring. Each phase allows different actions.",
    },
    turn: {
      zh: "轮到谁行动，或当前比赛的进度。下注阶段显示正在选票的玩家。",
      en: "Whose turn it is, or how far the race has run. During betting it names the player currently picking a ticket.",
    },
    notice: {
      zh: "数据来源说明。星位(⭐)与侧滑方向依据官方第二印刷版规则书，其余组件数值仍为原型兼容数据。",
      en: "Data provenance. Star rows (⭐) and swerve directions follow the official second-printing rulebook, while the remaining component values are still prototype-compatible.",
    },
    players: {
      zh: "所有玩家的现金(💵)与已拿到的票。绿色代表安全(🛡️)，红色代表冒险(🔥)，金边代表第三场加倍。",
      en: "Every player's cash (💵) and the tickets they hold. Green means Safe (🛡️), red means Risky (🔥), and a gold ring marks a race-three double.",
    },
    betting: {
      zh: "六个票堆：四个角色，加上边注(🎲)的成立(✅ YES)与不成立(❌ NO)。每堆只剩顶层可选，数字是各名次(🥇🥈🥉)的赔付。",
      en: "Six ticket stacks: the four racers plus YES (✅) and NO (❌) for the side bet (🎲). Only the top ticket of each stack is available and the numbers are the payouts per place (🥇🥈🥉).",
    },
    ticket: {
      zh: "拿走这个票堆的顶层票。点一下会在原地弹出安全(🛡️)与冒险(🔥)两个选项，选定后立即锁定。",
      en: "Take the top ticket of this stack. Tapping it opens Safe (🛡️) and Risky (🔥) right on the spot, and the choice locks in immediately.",
    },
    mode: {
      zh: "安全(🛡️)回报较低但输钱少，冒险(🔥)回报更高但猜错会倒扣现金(💵)。这个选择与票一起锁定。",
      en: "Safe (🛡️) pays less but rarely costs you, while Risky (🔥) pays more and takes cash (💵) away on a miss. The choice locks in with the ticket.",
    },
    cancel: {
      zh: "取消这次选票，不会拿走任何票。点击周围空白处或按 Esc 同样可以取消。",
      en: "Cancel this pick without taking a ticket. Clicking the empty area around it or pressing Esc does the same.",
    },
    double: {
      zh: "第三场拿到第二张票时，必须指定本场的一张票加倍，收益与罚款都会翻倍。",
      en: "When you take your second ticket in race three you must pick one of your tickets to double, which doubles both reward and penalty.",
    },
    hand: {
      zh: "你的秘密手牌。选中的牌会被投入这一场的比赛牌堆(🃏)，其他玩家只会知道你提交了，看不到牌面。",
      en: "Your secret hand. The selected card joins this race's deck (🃏) and other players only learn that you submitted, never which card.",
    },
    submit: {
      zh: "把选中的比赛牌(🃏)锁进牌堆。3 到 8 人局交 1 张，2 人局交 2 张，提交后不能更改。",
      en: "Lock the selected race cards (🃏) into the deck. Games with 3-8 players submit one card and two-player games submit two, and the choice cannot be changed.",
    },
    track: {
      zh: "四条跑道的赛道。斜纹区域(🚫)是已折叠的部分，浅色区是最终直道，粗线是终点线，绿色格是终点后的星位(⭐)。",
      en: "The four-lane track. The striped area (🚫) is folded away, the lighter band is the final stretch, the thick line is the finish, and the green cell is the star (⭐) beyond it.",
    },
    track_toggle: {
      zh: "展开或收起赛道。下注阶段赛道暂时用不上，收起可以留出空间给下注票(🎟️)。",
      en: "Expand or collapse the track. During betting the track is not needed yet, so collapsing it leaves room for the betting tickets (🎟️).",
    },
    swerve: {
      zh: "每个角色的固定侧滑方向，以角色自身朝向为准。背向跑的角色在画面上会朝相反方向换道。",
      en: "Each racer's fixed swerve direction, measured against its own facing. A backward racer changes lanes the opposite way on screen.",
    },
    standings: {
      zh: "四个角色当前的状态：已冲线的名次(🥇🥈🥉)、还在跑的位置，以及出局(🚫)的原因。",
      en: "The state of all four racers: the places already claimed (🥇🥈🥉), where the rest are still running, and why any racer is out (🚫).",
    },
    side: {
      zh: "本场的公开边注(🎲)。成立(✅ YES)与不成立(❌ NO)的票都在这里结算，结果会在条件达成或比赛结束时锁定。",
      en: "The public side bet (🎲) for this race. YES (✅) and NO (❌) tickets both pay here, and the result locks when the condition happens or the race ends.",
    },
    pool: {
      zh: "选票前就已经公开的比赛牌(🃏)。用它们推断哪位角色更可能拿到好名次，秘密投入的牌不在这里。",
      en: "The race cards (🃏) that are public before betting. Use them to judge which racer is likely to place well; secret contributions are not shown here.",
    },
    log: {
      zh: "比赛的完整文字记录，可以折叠或展开。",
      en: "The full text record of the race, which you can collapse or expand.",
    },
    continue: {
      zh: "手动推进下一张比赛牌(🃏)。正常情况下比赛会自动播放，按钮只在播放卡住时出现。",
      en: "Manually reveal the next race card (🃏). Playback is automatic, so this button only appears when the race stalls.",
    },
    next: {
      zh: "看完本场结果后标记准备就绪，所有玩家都点击后才会开始下一场。",
      en: "Mark yourself ready after reading the result. The next race starts only after every player is ready.",
    },
    again: {
      zh: "用同样的玩家重新开始一局三场的比赛。",
      en: "Start a fresh three-race game with the same players.",
    },
  };

  /* ------------------------------------------------------------------ *
   * Small helpers
   * ------------------------------------------------------------------ */

  function hotStreakFindPlayer(view, playerId) {
    return (view.players || []).find((player) => player.player_id === playerId) || null;
  }

  function hotStreakPlayerName(view, playerId) {
    const player = hotStreakFindPlayer(view, playerId);
    return (player && player.name) || playerId || "-";
  }

  function hotStreakFindRacer(view, racerId) {
    return (view.racers || []).find((racer) => racer.racer_id === racerId) || null;
  }

  function hotStreakTargetLabel(view, target) {
    if (target === "yes") return "✅ YES";
    if (target === "no") return "❌ NO";
    const racer = hotStreakFindRacer(view, target);
    return racer ? `${racer.icon} ${racer.name}` : target;
  }

  function hotStreakHasAction(actionType) {
    return Boolean(
      hotStreakView &&
        Array.isArray(hotStreakView.legal_actions) &&
        hotStreakView.legal_actions.includes(actionType)
    );
  }

  function hotStreakMoney(value) {
    const amount = Number(value || 0);
    return `${amount < 0 ? "−" : ""}💵${Math.abs(amount)}`;
  }

  function hotStreakPayoutCells(payout) {
    if (!payout) return [];
    if (Object.prototype.hasOwnProperty.call(payout, "correct")) {
      return [
        { label: "✅", value: payout.correct },
        { label: "✕", value: payout.incorrect },
      ];
    }
    return [
      { label: "🥇", value: payout["1"] },
      { label: "🥈", value: payout["2"] },
      { label: "🥉", value: payout["3"] },
    ];
  }

  function hotStreakPayoutText(payout) {
    return hotStreakPayoutCells(payout)
      .map((cell) => `${cell.label}${hotStreakMoney(cell.value)}`)
      .join(" ");
  }

  function hotStreakRankBadge(rank) {
    return { 1: "🥇", 2: "🥈", 3: "🥉" }[Number(rank)] || `#${rank}`;
  }

  function hotStreakSetHidden(element, hidden) {
    if (element) element.hidden = Boolean(hidden);
  }

  /* ------------------------------------------------------------------ *
   * Help & Explain (shared widgets, designs/task40.md)
   * ------------------------------------------------------------------ */

  function initHotStreakHelpExplain() {
    if (hotStreakHelpWidget || typeof window.obgCreateHelp !== "function") return;
    hotStreakHelpWidget = window.obgCreateHelp(HOT_STREAK_HELP_CONFIG);
    hotStreakExplainWidget = window.obgCreateExplain({
      gameId: "hot_streak",
      attribute: "data-hot-streak-explain",
      explanations: HOT_STREAK_EXPLAIN,
      button: hotStreakExplainBtn,
      root: () => hotStreakPanel,
      bypass: ["#hotStreakHelpBtn", "#hotStreakExplainBtn"]
    });
    hotStreakHelpBtn?.addEventListener("click", () => {
      hotStreakExplainWidget?.exit();
      hotStreakHelpWidget.open();
    });
    hotStreakExplainBtn?.addEventListener("click", () => hotStreakExplainWidget?.toggle());
  }

  /* ------------------------------------------------------------------ *
   * Floating tooltips (hover on desktop, tap for 3s on touch)
   * ------------------------------------------------------------------ */

  function hotStreakHideTip() {
    if (hotStreakTipTimer) window.clearTimeout(hotStreakTipTimer);
    hotStreakTipTimer = null;
    if (hotStreakTipNode) hotStreakTipNode.hidden = true;
  }

  function hotStreakShowTip(target, text, autoHide) {
    if (!text || hotStreakExplainWidget?.isActive()) return;
    if (!hotStreakTipNode) {
      hotStreakTipNode = document.createElement("div");
      hotStreakTipNode.className = "hot-streak-tip";
      hotStreakTipNode.hidden = true;
      document.body.appendChild(hotStreakTipNode);
    }
    if (hotStreakTipTimer) window.clearTimeout(hotStreakTipTimer);
    hotStreakTipNode.textContent = text;
    hotStreakTipNode.hidden = false;
    const box = target.getBoundingClientRect();
    const size = hotStreakTipNode.getBoundingClientRect();
    let left = box.left + box.width / 2 - size.width / 2;
    left = Math.max(6, Math.min(left, window.innerWidth - size.width - 6));
    let top = box.top - size.height - 8;
    if (top < 6) top = box.bottom + 8;
    hotStreakTipNode.style.left = `${Math.round(left)}px`;
    hotStreakTipNode.style.top = `${Math.round(top)}px`;
    if (autoHide) hotStreakTipTimer = window.setTimeout(hotStreakHideTip, 3000);
  }

  function hotStreakTipText(node) {
    const key = node.getAttribute("data-hot-streak-tip");
    const dynamic = node.getAttribute("data-hot-streak-tip-text");
    if (dynamic) return dynamic;
    return hotStreakStaticTips[key] || null;
  }

  const hotStreakStaticTips = {
    race: "Race counter: three races decide the winner.",
    phase: "Current phase of this race.",
    turn: "Whose turn it is right now.",
  };

  document.addEventListener("pointerdown", (event) => {
    hotStreakPointerType = event.pointerType || "mouse";
  }, true);

  document.addEventListener("pointerover", (event) => {
    if (event.pointerType && event.pointerType !== "mouse") return;
    const node = event.target.closest?.("[data-hot-streak-tip]");
    if (!node || !hotStreakPanel?.contains(node)) return;
    hotStreakShowTip(node, hotStreakTipText(node), false);
  });

  document.addEventListener("pointerout", (event) => {
    if (event.pointerType && event.pointerType !== "mouse") return;
    const node = event.target.closest?.("[data-hot-streak-tip]");
    if (node) hotStreakHideTip();
  });

  document.addEventListener("click", (event) => {
    if (hotStreakPointerType === "mouse") return;
    const node = event.target.closest?.("[data-hot-streak-tip]");
    if (!node || !hotStreakPanel?.contains(node)) {
      hotStreakHideTip();
      return;
    }
    if (node.closest("button, a, input, select")) return;
    hotStreakShowTip(node, hotStreakTipText(node), true);
  }, true);

  window.addEventListener("scroll", hotStreakHideTip, true);

  /* ------------------------------------------------------------------ *
   * Rendering
   * ------------------------------------------------------------------ */

  function hotStreakRenderStatus(view) {
    if (hotStreakRaceLabel) hotStreakRaceLabel.textContent = `Race ${view.race_number} of ${view.race_total || 3}`;
    if (hotStreakPhaseLabel) {
      hotStreakPhaseLabel.textContent = HOT_STREAK_PHASE_LABELS[view.phase] || view.phase || "-";
    }
    if (hotStreakTurnLabel) {
      const submission = view.submission_progress || {};
      const text = view.phase === "betting"
        ? `${hotStreakPlayerName(view, view.current_drafter)}'s pick`
        : view.phase === "card_selection"
          ? `${submission.done || 0}/${submission.total || 0} submitted`
          : view.phase === "racing" || view.phase === "race_countdown"
            ? `Step ${view.step_index}`
            : view.phase === "race_result"
              ? "Review the results"
              : "Game over";
      hotStreakTurnLabel.textContent = text;
    }
    const prototype = view.catalog_status === "prototype";
    hotStreakSetHidden(hotStreakNoticeToggle, !prototype);
    if (!prototype) hotStreakSetHidden(hotStreakDataNotice, true);
  }

  function hotStreakRenderPlayers(view) {
    if (!hotStreakPlayers) return;
    hotStreakPlayers.innerHTML = "";
    (view.players || []).forEach((player) => {
      const card = document.createElement("article");
      card.className = "hot-streak-player";
      if (player.player_id === view.you) card.classList.add("self");
      if (player.player_id === view.current_drafter) card.classList.add("current");

      const heading = document.createElement("div");
      heading.className = "hot-streak-player-heading";
      const name = document.createElement("strong");
      name.textContent = player.name || player.player_id;
      const money = document.createElement("span");
      money.textContent = `💵 ${player.money}`;
      heading.append(name, money);

      const bets = document.createElement("div");
      bets.className = "hot-streak-player-bets";
      const betList = player.bets || [];
      betList.forEach((bet) => {
        const chip = document.createElement("span");
        chip.className = `hot-streak-bet-chip is-${bet.mode}${bet.doubled ? " is-doubled" : ""}`;
        chip.textContent = `${hotStreakTargetLabel(view, bet.target)} ${bet.mode === "risky" ? "🔥" : "🛡️"}${bet.doubled ? " ×2" : ""}`;
        chip.setAttribute("data-hot-streak-tip", "");
        chip.setAttribute("data-hot-streak-tip-text",
          `${player.name}: ${hotStreakTargetLabel(view, bet.target)} · ${bet.mode === "risky" ? "Risky" : "Safe"}${bet.doubled ? " · doubled x2" : ""}`);
        bets.appendChild(chip);
      });
      if (!betList.length) {
        const empty = document.createElement("span");
        empty.className = "hot-streak-player-status";
        empty.textContent = "No tickets yet";
        bets.appendChild(empty);
      }

      const status = document.createElement("div");
      status.className = "hot-streak-player-status";
      if (view.phase === "card_selection") {
        status.textContent = player.submitted ? `Submitted ${player.submitted_count} ✓` : "Choosing a card…";
      } else if (view.phase === "race_result") {
        status.textContent = player.ready ? "Ready ✓" : "Reviewing…";
      } else if (player.is_bot) {
        status.textContent = "🤖 Bot";
      }

      card.append(heading, bets, status);
      hotStreakPlayers.appendChild(card);
    });

    if (hotStreakPlayersSummary) {
      const richest = (view.players || []).reduce(
        (best, player) => (Number(player.money) > Number(best?.money ?? -1) ? player : best),
        null
      );
      hotStreakPlayersSummary.textContent = richest ? `Lead 💵${richest.money}` : "-";
    }
  }

  function hotStreakRenderTickets(view) {
    if (!hotStreakTickets) return;
    const canDraft = hotStreakHasAction("draft_ticket") && view.current_drafter === view.you;
    hotStreakTickets.innerHTML = "";
    (view.ticket_stacks || []).forEach((stack) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "hot-streak-ticket";
      if (stack.stack_id === "yes" || stack.stack_id === "no") {
        button.classList.add("is-side-ticket", `is-${stack.stack_id}`);
      }
      if (!stack.top) button.classList.add("is-empty");
      button.dataset.hotStreakExplain = "ticket";
      button.disabled = !canDraft || !stack.top;
      button.setAttribute("role", "listitem");
      button.setAttribute("aria-label",
        `${stack.label} ticket stack, ${stack.remaining} left${stack.top ? "" : ", empty"}`);

      const head = document.createElement("span");
      head.className = "hot-streak-ticket-head";
      const name = document.createElement("span");
      name.className = "hot-streak-ticket-name";
      name.textContent = `${stack.icon} ${stack.label}`;
      const count = document.createElement("span");
      count.className = "hot-streak-ticket-count";
      count.textContent = `${stack.remaining} left`;
      head.append(name, count);
      button.appendChild(head);

      if (stack.top) {
        const binary = Object.prototype.hasOwnProperty.call(stack.top.safe || {}, "correct");
        const pays = document.createElement("span");
        pays.className = `hot-streak-ticket-pays${binary ? " is-binary" : ""}`;
        [["safe", "🛡️"], ["risky", "🔥"]].forEach(([mode, icon]) => {
          const label = document.createElement("span");
          label.className = `hot-streak-pay-label is-${mode}`;
          label.textContent = icon;
          pays.appendChild(label);
          hotStreakPayoutCells(stack.top[mode]).forEach((cell) => {
            const value = document.createElement("span");
            value.className = `hot-streak-pay${Number(cell.value) < 0 ? " is-loss" : ""}`;
            value.textContent = `${cell.label}${hotStreakMoney(cell.value)}`;
            pays.appendChild(value);
          });
        });
        button.appendChild(pays);
      } else {
        const empty = document.createElement("span");
        empty.className = "hot-streak-player-status";
        empty.textContent = "Stack empty";
        button.appendChild(empty);
      }

      button.addEventListener("click", () => hotStreakOpenTicketConfirm(stack));
      hotStreakTickets.appendChild(button);
    });

    if (hotStreakDraftProgress) {
      const progress = view.draft_progress || {};
      hotStreakDraftProgress.textContent = `${progress.done || 0}/${progress.total || 0}`;
    }
    if (hotStreakTicketHint) {
      hotStreakTicketHint.textContent = canDraft
        ? "Take a ticket, then choose Safe or Risky."
        : `Waiting for ${hotStreakPlayerName(view, view.current_drafter)} to pick a ticket…`;
    }
  }

  function hotStreakRenderPool(view) {
    if (!hotStreakPool) return;
    const cards = Array.isArray(view.base_race_cards) ? view.base_race_cards : [];
    const groups = new Map();
    cards.forEach((card) => {
      const key = card.template_id || card.instance_id;
      const existing = groups.get(key);
      if (existing) existing.count += 1;
      else groups.set(key, { card, count: 1 });
    });

    hotStreakPool.innerHTML = "";
    if (hotStreakPoolCount) {
      hotStreakPoolCount.textContent = `${cards.length} card${cards.length === 1 ? "" : "s"}`;
    }
    if (!cards.length) {
      const empty = document.createElement("p");
      empty.className = "hot-streak-hint";
      empty.textContent = "No public cards available.";
      hotStreakPool.appendChild(empty);
      return;
    }

    groups.forEach(({ card, count }) => {
      const item = document.createElement("article");
      item.className = `hot-streak-pool-card${card.target === "all" ? " is-everyone" : ""}`;
      item.setAttribute("role", "listitem");

      const target = document.createElement("span");
      target.className = "hot-streak-pool-target";
      target.textContent = `${card.target_icon} ${card.target_name}`;
      const label = document.createElement("strong");
      label.textContent = card.label;
      const meta = document.createElement("span");
      meta.className = "hot-streak-pool-meta";
      const details = [];
      if (card.starting) details.push("Starter");
      if (count > 1) details.push(`×${count}`);
      meta.textContent = details.join(" · ") || "Public";
      item.setAttribute("data-hot-streak-tip", "");
      item.setAttribute("data-hot-streak-tip-text",
        `${card.target_name}: ${card.label}${count > 1 ? ` (${count} copies)` : ""}`);
      item.append(target, label, meta);
      hotStreakPool.appendChild(item);
    });
  }

  function hotStreakRenderHand(view) {
    if (!hotStreakHand) return;
    const hand = Array.isArray(view.your_hand) ? view.your_hand : [];
    const available = new Set(hand.map((card) => card.instance_id));
    hotStreakSelectedCards = new Set(
      Array.from(hotStreakSelectedCards).filter((cardId) => available.has(cardId))
    );
    const canSubmit = hotStreakHasAction("submit_race_cards");
    const required = Number((view.submission_progress || {}).required_per_player || 1);

    hotStreakHand.innerHTML = "";
    hand.forEach((card) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "hot-streak-race-card";
      button.dataset.hotStreakExplain = "hand";
      button.disabled = !canSubmit;
      if (hotStreakSelectedCards.has(card.instance_id)) button.classList.add("selected");
      const target = document.createElement("span");
      target.className = "hot-streak-race-card-target";
      target.textContent = `${card.target_icon} ${card.target_name}`;
      const effect = document.createElement("strong");
      effect.textContent = card.label;
      button.append(target, effect);
      button.addEventListener("click", () => {
        if (hotStreakSelectedCards.has(card.instance_id)) {
          hotStreakSelectedCards.delete(card.instance_id);
        } else {
          if (hotStreakSelectedCards.size >= required) hotStreakSelectedCards.clear();
          hotStreakSelectedCards.add(card.instance_id);
        }
        hotStreakRenderHand(hotStreakView);
      });
      hotStreakHand.appendChild(button);
    });

    const me = hotStreakFindPlayer(view, view.you);
    if (hotStreakHandHint) {
      hotStreakHandHint.textContent = me && me.submitted
        ? "Submitted. Your choice is locked."
        : `Choose ${required} race card${required === 1 ? "" : "s"}. Tap the empty area to deselect.`;
    }
    if (hotStreakSubmissionProgress) {
      const progress = view.submission_progress || {};
      hotStreakSubmissionProgress.textContent = `${progress.done || 0}/${progress.total || 0}`;
    }
    if (hotStreakSubmitBtn) {
      hotStreakSubmitBtn.textContent = required === 1 ? "Submit Card" : `Submit ${required} Cards`;
      hotStreakSubmitBtn.disabled = !canSubmit || hotStreakSelectedCards.size !== required;
    }
  }

  function hotStreakRenderSwerveKey(view) {
    if (!hotStreakSwerveKey) return;
    hotStreakSwerveKey.innerHTML = "";
    const label = document.createElement("strong");
    label.textContent = "Swerve · relative to facing";
    const chips = document.createElement("span");
    chips.className = "hot-streak-swerve-chips";
    (view.racers || []).forEach((racer) => {
      const chip = document.createElement("span");
      const direction = racer.swerve === "left" ? "Left" : "Right";
      chip.textContent = `${racer.icon} ${direction}`;
      chip.setAttribute("data-hot-streak-tip", "");
      chip.setAttribute("data-hot-streak-tip-text",
        `${racer.name} swerves ${direction.toLowerCase()} relative to its current facing.`);
      chips.appendChild(chip);
    });
    hotStreakSwerveKey.append(label, chips);
  }

  function hotStreakRenderTrack(view) {
    if (!hotStreakTrack) return;
    const track = view.track || {};
    const laneCount = Number(track.lane_count || 4);
    const finish = Number(track.finish_position || 13);
    const positions = finish + 1;
    const backEdge = Number(view.track_back_edge || 0);
    const finalStretch = Number(track.final_stretch_start || 10);
    const starsByLane = track.star_positions_by_lane || {};

    hotStreakTrack.innerHTML = "";
    hotStreakTrack.style.setProperty("--hs-positions", String(positions));
    hotStreakTrack.style.setProperty("--hs-lanes", String(laneCount));

    const byCell = new Map();
    (view.racers || []).forEach((racer) => {
      if (racer.status !== "active") return;
      const key = `${racer.lane}:${racer.position}`;
      if (!byCell.has(key)) byCell.set(key, []);
      byCell.get(key).push(racer);
    });

    const fragment = document.createDocumentFragment();
    for (let lane = 0; lane < laneCount; lane += 1) {
      const stars = new Set((starsByLane[String(lane)] || []).map(Number));
      for (let position = 0; position < positions; position += 1) {
        const cell = document.createElement("div");
        cell.className = "hot-streak-track-cell";
        cell.dataset.lane = String(lane);
        cell.style.setProperty("--hs-lane", String(lane));
        cell.style.setProperty("--hs-pos", String(position));
        cell.setAttribute("role", "gridcell");

        const isStar = stars.has(position);
        if (position < backEdge) cell.classList.add("folded");
        if (position >= finalStretch && position < finish) cell.classList.add("final-stretch");
        if (position === finish - 1) cell.classList.add("finish-edge");
        if (position === finish) cell.classList.add("post-finish");

        const label = position === finish
          ? `Lane ${lane + 1}, star beyond the finish line`
          : `Lane ${lane + 1}, space ${position + 1}`;
        cell.setAttribute("aria-label", `${label}${isStar ? ", star" : ""}`);

        if (isStar) {
          const star = document.createElement("span");
          star.className = "hot-streak-track-star";
          star.textContent = "⭐";
          star.setAttribute("aria-hidden", "true");
          cell.appendChild(star);
          cell.setAttribute("data-hot-streak-tip", "");
          cell.setAttribute("data-hot-streak-tip-text", `${label} · star row ⭐`);
        }

        const markers = byCell.get(`${lane}:${position}`) || [];
        if (markers.length > 1) cell.classList.add("is-multi");
        markers.forEach((racer) => {
          const marker = document.createElement("span");
          marker.className = `hot-streak-racer is-${racer.pattern || "plain"}`;
          if (racer.fallen) marker.classList.add("fallen");
          if (racer.facing === "backward") marker.classList.add("backward");
          marker.textContent = racer.icon;
          const tip = `${racer.name} · ${label}`
            + `${racer.fallen ? " · fallen 💫" : ""}`
            + `${racer.facing === "backward" ? " · facing backward ↩️" : ""}`
            + ` · swerves ${racer.swerve}`;
          marker.setAttribute("data-hot-streak-tip", "");
          marker.setAttribute("data-hot-streak-tip-text", tip);
          marker.setAttribute("aria-label", tip);
          cell.appendChild(marker);
        });
        fragment.appendChild(cell);
      }
    }
    hotStreakTrack.appendChild(fragment);

    if (hotStreakTrackStatus) {
      const folded = backEdge > 0 ? ` · folded to ${backEdge}` : "";
      hotStreakTrackStatus.textContent = `Cycle ${view.race_cycle || 1}${folded}`;
    }
  }

  function hotStreakRenderStandings(view) {
    if (!hotStreakStandingsList) return;
    hotStreakStandingsList.innerHTML = "";
    const order = { finished: 0, active: 1, dq: 2 };
    const racers = (view.racers || []).slice().sort((left, right) => {
      const group = (order[left.status] ?? 3) - (order[right.status] ?? 3);
      if (group !== 0) return group;
      if (left.status === "active") return Number(right.position) - Number(left.position);
      return Number(left.rank_start || 9) - Number(right.rank_start || 9);
    });

    racers.forEach((racer) => {
      const item = document.createElement("div");
      item.className = "hot-streak-standing";
      if (racer.status === "finished") item.classList.add("is-done");
      if (racer.status === "dq") item.classList.add("is-out");

      const rank = document.createElement("span");
      rank.className = "hot-streak-standing-rank";
      if (racer.status === "finished") {
        rank.textContent = racer.rank_start === racer.rank_end
          ? hotStreakRankBadge(racer.rank_start)
          : `#${racer.rank_start}–${racer.rank_end}`;
      } else if (racer.status === "dq") {
        rank.textContent = "🚫";
      } else {
        rank.textContent = racer.fallen ? "💫" : "🏃";
      }

      const name = document.createElement("span");
      name.className = "hot-streak-standing-name";
      name.textContent = `${racer.icon} ${racer.name}`;

      const detail = document.createElement("span");
      detail.className = "hot-streak-mini-status";
      if (racer.status === "finished") detail.textContent = "Finished";
      else if (racer.status === "dq") detail.textContent = String(racer.dq_reason || "out").replaceAll("_", " ");
      else detail.textContent = `L${Number(racer.lane) + 1}·${Number(racer.position) + 1}`;

      item.append(rank, name, detail);
      hotStreakStandingsList.appendChild(item);
    });
  }

  function hotStreakRenderCurrentCard(view) {
    if (!hotStreakCurrentCard) return;
    hotStreakCurrentCard.innerHTML = "";
    const racing = view.phase === "racing" || view.phase === "race_countdown";
    hotStreakSetHidden(hotStreakCurrentCard, !racing);
    if (!racing) return;

    if (view.phase === "race_countdown") {
      const countdown = document.createElement("strong");
      countdown.className = "hot-streak-countdown";
      countdown.textContent = view.countdown > 0 ? String(view.countdown) : "GO!";
      hotStreakCurrentCard.appendChild(countdown);
      return;
    }

    if (view.current_card) {
      const icon = document.createElement("span");
      icon.className = "hot-streak-current-card-icon";
      icon.textContent = view.current_card.target_icon;
      const copy = document.createElement("div");
      const eyebrow = document.createElement("span");
      eyebrow.className = "hot-streak-card-eyebrow";
      eyebrow.textContent = `Cycle ${view.race_cycle} · Card ${(view.revealed_cards || []).length}`;
      const title = document.createElement("strong");
      title.textContent = view.current_card.label;
      copy.append(eyebrow, title);
      hotStreakCurrentCard.append(icon, copy);
      return;
    }

    hotStreakCurrentCard.textContent = "Waiting for the next card…";
  }

  function hotStreakRenderSideBet(view) {
    const bet = view.current_side_bet || {};
    if (hotStreakSideBet) hotStreakSideBet.textContent = bet.label || "-";
    const tracker = view.side_bet_tracker || {};
    if (hotStreakSideResult) {
      hotStreakSideResult.classList.remove("is-yes", "is-no");
      if (tracker.resolved) {
        hotStreakSideResult.textContent = tracker.result ? "YES ✓" : "NO ✕";
        hotStreakSideResult.classList.add(tracker.result ? "is-yes" : "is-no");
      } else {
        hotStreakSideResult.textContent = "Pending";
      }
    }
    if (hotStreakSideEvidence) {
      const evidence = tracker.evidence;
      const racers = (evidence && (evidence.racer_ids || [])) || [];
      if (tracker.resolved && racers.length) {
        const names = racers.map((id) => {
          const racer = hotStreakFindRacer(view, id);
          return racer ? `${racer.icon} ${racer.name}` : id;
        });
        hotStreakSideEvidence.textContent = `Locked by: ${names.join(", ")}`;
        hotStreakSideEvidence.hidden = false;
      } else {
        hotStreakSideEvidence.hidden = true;
      }
    }
  }

  function hotStreakLogMessage(view, entry) {
    const racerName = (racerId) => {
      const racer = hotStreakFindRacer(view, racerId);
      return racer ? `${racer.icon} ${racer.name}` : racerId;
    };
    switch (entry.type) {
      case "race_ready":
        return `Race ${entry.race} deck is ready.`;
      case "card":
        return `🃏 ${entry.card ? entry.card.label : "Card revealed"}`;
      case "move":
      case "all_move":
        return `${racerName(entry.racer_id)} moves from ${Number(entry.from) + 1} to ${Number(entry.to) + 1}.`;
      case "fall":
        return `${racerName(entry.racer_id)} falls down 💫.`;
      case "recover":
        return `${racerName(entry.racer_id)} recovers and faces forward.`;
      case "turn":
        return `${racerName(entry.racer_id)} turns ${entry.facing === "backward" ? "backward" : "forward"} ↩️.`;
      case "swerve":
        return entry.out_of_bounds
          ? `${racerName(entry.racer_id)} swerves ${entry.direction || "sideways"} off the track 🚫.`
          : `${racerName(entry.racer_id)} swerves ${entry.direction || "sideways"} to lane ${Number(entry.to_lane) + 1}.`;
      case "knockdown":
        return `${racerName(entry.mover_id)} knocks ${racerName(entry.racer_id)} down 💥.`;
      case "dq":
        return `${racerName(entry.racer_id)} is disqualified: ${String(entry.reason || "dq").replaceAll("_", " ")} 🚫.`;
      case "finish":
        return `${racerName(entry.racer_id)} claims place ${entry.rank} ${hotStreakRankBadge(entry.rank)}.`;
      case "fold":
        return `The rear edge folds to space ${Number(entry.cutoff) + 1}.`;
      case "side_bet_hit":
        return "The side bet locks to YES ✓.";
      case "no_effect":
        return `${racerName(entry.racer_id)} is already out; no effect.`;
      default:
        return null;
    }
  }

  function hotStreakRenderLog(view) {
    if (!hotStreakLog) return;
    const messages = (view.race_log || [])
      .map((entry) => hotStreakLogMessage(view, entry))
      .filter(Boolean)
      .slice(-80);
    if (hotStreakLogCount) hotStreakLogCount.textContent = String(messages.length);
    hotStreakLog.innerHTML = "";
    if (!messages.length) {
      hotStreakLog.textContent = "The race log will appear here.";
      return;
    }
    messages.forEach((message) => {
      const line = document.createElement("div");
      line.className = "hot-streak-log-line";
      line.textContent = message;
      hotStreakLog.appendChild(line);
    });
    hotStreakLog.scrollTop = hotStreakLog.scrollHeight;
  }

  function hotStreakRenderResults(view) {
    if (!hotStreakResult || !hotStreakResultBody) return;
    const visible = view.phase === "race_result" || view.phase === "game_over";
    hotStreakSetHidden(hotStreakResult, !visible);
    hotStreakResultBody.innerHTML = "";
    if (!visible) return;

    const summary = view.last_race_summary;
    if (hotStreakResultTitle) {
      hotStreakResultTitle.textContent = view.game_over
        ? "🏆 Final Results"
        : `🏁 Race ${summary ? summary.race_number : view.race_number} Results`;
    }
    if (!summary) return;

    const podium = document.createElement("div");
    podium.className = "hot-streak-podium";
    Object.values(summary.racers || {})
      .sort((left, right) => Number(left.payout_rank || 9) - Number(right.payout_rank || 9))
      .forEach((result) => {
        const racer = hotStreakFindRacer(view, result.racer_id) || {};
        const row = document.createElement("div");
        row.className = "hot-streak-result-row";
        if (Number(result.rank_start) === 1) row.classList.add("is-first");
        const badge = result.rank_start === result.rank_end
          ? hotStreakRankBadge(result.rank_start)
          : `#${result.rank_start}–${result.rank_end}`;
        row.textContent = `${badge} ${racer.icon || "🏃"} ${racer.name || result.racer_id}`
          + (result.status === "dq" ? ` · 🚫 ${String(result.dq_reason || "").replaceAll("_", " ")}` : "");
        podium.appendChild(row);
      });
    hotStreakResultBody.appendChild(podium);

    const side = document.createElement("div");
    side.className = "hot-streak-result-side";
    const hit = summary.side_bet_result && summary.side_bet_result.result;
    side.textContent = `🎲 Side Bet: ${hit ? "YES ✓" : "NO ✕"}`;
    hotStreakResultBody.appendChild(side);

    const payouts = document.createElement("div");
    payouts.className = "hot-streak-payouts";
    (view.players || []).forEach((player) => {
      const result = (summary.payouts || {})[player.player_id];
      if (!result) return;
      const row = document.createElement("div");
      row.className = "hot-streak-payout-player";
      if (player.player_id === view.you) row.classList.add("is-self");

      const head = document.createElement("div");
      head.className = "hot-streak-payout-head";
      const name = document.createElement("strong");
      name.textContent = player.player_id === view.you ? `${player.name} (you)` : player.name;
      const delta = document.createElement("span");
      delta.textContent = `${hotStreakMoney(result.money_before)} ${result.net >= 0 ? "＋" : "−"} ${hotStreakMoney(Math.abs(result.net))} → ${hotStreakMoney(result.money_after)}`;
      head.append(name, delta);
      row.appendChild(head);

      (result.tickets || []).forEach((ticket) => {
        const line = document.createElement("span");
        line.className = "hot-streak-payout-ticket";
        line.textContent = `${hotStreakTargetLabel(view, ticket.bet.target)} · ${ticket.hit ? "Hit ✓" : "Miss ✕"} · ${hotStreakMoney(ticket.delta)}${ticket.multiplier === 2 ? " ×2" : ""}`;
        row.appendChild(line);
      });
      payouts.appendChild(row);
    });
    hotStreakResultBody.appendChild(payouts);

    if (view.game_over) {
      const winners = document.createElement("div");
      winners.className = "hot-streak-winners";
      const names = (view.winner_ids || []).map((playerId) => hotStreakPlayerName(view, playerId));
      winners.textContent = `${names.length > 1 ? "Joint Winners" : "Winner"}: ${names.join(" & ")} 🏆`;
      hotStreakResultBody.appendChild(winners);
    }
  }

  function hotStreakUpdateActions(view) {
    const racing = view.phase === "race_countdown" || view.phase === "racing";
    if (hotStreakContinueBtn) {
      hotStreakContinueBtn.disabled = !hotStreakHasAction("advance_race");
      if (!racing) hotStreakContinueBtn.hidden = true;
    }
    if (hotStreakNextRaceBtn) {
      const show = view.phase === "race_result";
      hotStreakNextRaceBtn.hidden = !show;
      const me = hotStreakFindPlayer(view, view.you);
      hotStreakNextRaceBtn.disabled = !hotStreakHasAction("next_round");
      hotStreakNextRaceBtn.textContent = me && me.ready ? "Ready ✓" : "Next Race";
    }
    if (hotStreakPlayAgainBtn) {
      hotStreakPlayAgainBtn.hidden = view.phase !== "game_over";
      hotStreakPlayAgainBtn.disabled = !hotStreakHasAction("play_again");
    }
    if (hotStreakReadyProgress) {
      if (view.game_over) {
        hotStreakReadyProgress.textContent = "Game over";
      } else {
        const progress = view.next_round_progress || {};
        hotStreakReadyProgress.textContent = `Ready ${progress.done || 0}/${progress.total || 0}`;
      }
    }
  }

  function hotStreakApplyTrackOpen(view) {
    if (!hotStreakTrackBody || !hotStreakTrackToggle) return;
    const phase = view.phase;
    if (phase !== hotStreakTrackPhase) {
      hotStreakTrackPhase = phase;
      hotStreakTrackOpen = null;
    }
    if (hotStreakTrackOpen === null) {
      const wide = (hotStreakPanel?.clientWidth || 0) >= 560;
      const racing = phase === "racing" || phase === "race_countdown";
      const drafting = phase === "betting" || phase === "card_selection";
      hotStreakTrackOpen = racing || (drafting && wide);
    }
    hotStreakTrackBody.hidden = !hotStreakTrackOpen;
    hotStreakTrackToggle.setAttribute("aria-expanded", String(hotStreakTrackOpen));
  }

  function hotStreakUpdateVisibility(view) {
    const phase = view.phase;
    hotStreakSetHidden(hotStreakTicketSection, phase !== "betting");
    hotStreakSetHidden(hotStreakHandSection, phase !== "card_selection");
    hotStreakSetHidden(hotStreakPoolSection, phase !== "betting" && phase !== "card_selection");
    hotStreakSetHidden(hotStreakStandings, !(phase === "racing" || phase === "race_countdown"
      || phase === "race_result" || phase === "game_over"));
    const logVisible = phase === "racing" || phase === "race_countdown"
      || phase === "race_result" || phase === "game_over";
    hotStreakSetHidden(hotStreakLogPanel, !logVisible);
    hotStreakApplyTrackOpen(view);
    if (hotStreakSideBetSection) {
      hotStreakSideBetSection.hidden = phase === "game_over";
    }
  }

  /* ------------------------------------------------------------------ *
   * Ticket confirmation (in place, no separate action area)
   * ------------------------------------------------------------------ */

  function hotStreakNeedsDouble(view) {
    const me = hotStreakFindPlayer(view, view.you);
    return Boolean(
      view.race_number === 3 &&
        view.current_drafter === view.you &&
        me && Array.isArray(me.bets) && me.bets.length === 1
    );
  }

  function hotStreakCloseConfirm() {
    hotStreakPendingStack = null;
    if (hotStreakTicketMask) hotStreakTicketMask.hidden = true;
  }

  function hotStreakOpenTicketConfirm(stack) {
    if (!hotStreakView || !hotStreakHasAction("draft_ticket") || !stack || !stack.top) return;
    hotStreakPendingStack = stack;
    hotStreakPendingDouble = null;
    if (hotStreakNeedsDouble(hotStreakView)) {
      hotStreakOpenDoubleDialog();
      return;
    }
    if (!hotStreakConfirmTitle || !hotStreakConfirmModes || !hotStreakTicketMask) return;
    hotStreakConfirmTitle.textContent = `${stack.icon} ${stack.label} · Tier ${stack.top.tier}`;
    hotStreakConfirmModes.innerHTML = "";
    [["safe", "🛡️ Safe"], ["risky", "🔥 Risky"]].forEach(([mode, text]) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = `hot-streak-mode-button is-${mode}`;
      button.dataset.hotStreakExplain = "mode";
      const title = document.createElement("strong");
      title.textContent = text;
      const payout = document.createElement("span");
      payout.textContent = hotStreakPayoutText(stack.top[mode]);
      button.append(title, payout);
      button.addEventListener("click", () => hotStreakTakeTicket(mode));
      hotStreakConfirmModes.appendChild(button);
    });
    hotStreakTicketMask.hidden = false;
    hotStreakConfirmModes.querySelector("button")?.focus();
  }

  function hotStreakTakeTicket(mode) {
    if (!hotStreakPendingStack || !hotStreakView) return;
    const action = {
      type: "draft_ticket",
      stack_id: hotStreakPendingStack.stack_id,
      mode,
    };
    if (hotStreakNeedsDouble(hotStreakView)) {
      if (!hotStreakPendingDouble) return;
      action.double_bet_id = hotStreakPendingDouble;
    }
    sendAction(action);
    hotStreakCloseConfirm();
    hotStreakCloseDoubleDialog();
    hotStreakPendingDouble = null;
  }

  function hotStreakBuildDoubleDialog() {
    if (hotStreakDoubleDialog) return hotStreakDoubleDialog;
    const dialog = document.createElement("dialog");
    dialog.className = "hot-streak-dialog";
    dialog.innerHTML = '<div class="hot-streak-dialog-body"></div>';
    document.body.appendChild(dialog);
    hotStreakDoubleDialog = dialog;
    return dialog;
  }

  function hotStreakCloseDoubleDialog() {
    if (hotStreakDoubleDialog?.open) hotStreakDoubleDialog.close();
  }

  function hotStreakOpenDoubleDialog() {
    const stack = hotStreakPendingStack;
    if (!stack || !hotStreakView) return;
    const dialog = hotStreakBuildDoubleDialog();
    const body = dialog.querySelector(".hot-streak-dialog-body");
    body.innerHTML = "";

    const heading = document.createElement("h3");
    heading.textContent = `${stack.icon} ${stack.label} · Tier ${stack.top.tier}`;
    body.appendChild(heading);

    const box = document.createElement("fieldset");
    box.className = "hot-streak-double-box";
    box.dataset.hotStreakExplain = "double";
    const legend = document.createElement("legend");
    legend.textContent = "Race 3 · choose the ticket to double";
    box.appendChild(legend);

    const me = hotStreakFindPlayer(hotStreakView, hotStreakView.you);
    const choices = (me?.bets || []).map((bet) => ({
      id: bet.bet_id,
      label: `${hotStreakTargetLabel(hotStreakView, bet.target)} · ${bet.mode === "risky" ? "🔥 Risky" : "🛡️ Safe"}`,
    }));
    choices.forEach((choice) => {
      const label = document.createElement("label");
      label.className = "hot-streak-radio-label";
      const input = document.createElement("input");
      input.type = "radio";
      input.name = "hot-streak-double";
      input.value = choice.id;
      input.addEventListener("change", () => {
        hotStreakPendingDouble = choice.id;
      });
      label.append(input, document.createTextNode(choice.label));
      box.appendChild(label);
    });
    body.appendChild(box);

    const modes = document.createElement("div");
    modes.className = "hot-streak-mode-actions";
    [["safe", "🛡️ Safe"], ["risky", "🔥 Risky"]].forEach(([mode, text]) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = `hot-streak-mode-button is-${mode}`;
      button.dataset.hotStreakExplain = "mode";
      const title = document.createElement("strong");
      title.textContent = text;
      const payout = document.createElement("span");
      payout.textContent = hotStreakPayoutText(stack.top[mode]);
      button.append(title, payout);
      button.addEventListener("click", () => {
        if (!hotStreakPendingDouble) {
          const error = document.createElement("p");
          error.className = "hot-streak-modal-error";
          error.textContent = "Choose which ticket to double first.";
          body.insertBefore(error, modes);
          return;
        }
        hotStreakTakeTicket(mode);
      });
      modes.appendChild(button);
    });
    body.appendChild(modes);

    const cancel = document.createElement("button");
    cancel.type = "button";
    cancel.className = "hot-streak-confirm-cancel";
    cancel.dataset.hotStreakExplain = "cancel";
    cancel.textContent = "✕ Cancel";
    cancel.addEventListener("click", () => {
      hotStreakCloseDoubleDialog();
      hotStreakPendingStack = null;
      hotStreakPendingDouble = null;
    });
    body.appendChild(cancel);

    dialog.showModal();
  }

  /* ------------------------------------------------------------------ *
   * Race playback
   * ------------------------------------------------------------------ */

  function hotStreakScheduleAdvance(view) {
    if (hotStreakAdvanceTimer) window.clearTimeout(hotStreakAdvanceTimer);
    if (hotStreakFallbackTimer) window.clearTimeout(hotStreakFallbackTimer);
    hotStreakAdvanceTimer = null;
    hotStreakFallbackTimer = null;
    hotStreakScheduledStep = null;
    if (hotStreakContinueBtn) hotStreakContinueBtn.hidden = true;
    if (!hotStreakHasAction("advance_race")) return;

    const step = Number(view.step_index || 0);
    const key = `${view.game_index}:${view.race_number}:${step}`;
    hotStreakScheduledStep = key;
    const players = Array.isArray(view.players) ? view.players : [];
    const botWillDrive = players.some((player) => player.is_bot);
    const humanDriver = players.find((player) => !player.is_bot);
    if (!botWillDrive && humanDriver && humanDriver.player_id === view.you) {
      const delay = view.phase === "race_countdown" ? 650 : 950;
      hotStreakAdvanceTimer = window.setTimeout(() => {
        if (!hotStreakView || hotStreakScheduledStep !== key) return;
        sendAction({ type: "advance_race", expected_step_index: step });
      }, delay);
    }
    hotStreakFallbackTimer = window.setTimeout(() => {
      if (hotStreakContinueBtn && hotStreakScheduledStep === key) {
        hotStreakContinueBtn.hidden = false;
      }
    }, 3000);
  }

  /* ------------------------------------------------------------------ *
   * Entry points
   * ------------------------------------------------------------------ */

  function hotStreakRenderGameState(data) {
    const view = data && data.view;
    if (!view) return;
    hotStreakView = view;
    if (typeof currentGameType !== "undefined" && currentGameType !== "hot_streak") {
      currentGameType = "hot_streak";
      setGamePanelVisibility("hot_streak");
    }
    if (hotStreakPanel) hotStreakPanel.dataset.phase = view.phase || "";
    hotStreakRenderStatus(view);
    hotStreakRenderPlayers(view);
    hotStreakRenderTickets(view);
    hotStreakRenderPool(view);
    hotStreakRenderHand(view);
    hotStreakRenderSwerveKey(view);
    hotStreakRenderTrack(view);
    hotStreakRenderStandings(view);
    hotStreakRenderCurrentCard(view);
    hotStreakRenderSideBet(view);
    hotStreakRenderLog(view);
    hotStreakRenderResults(view);
    hotStreakUpdateActions(view);
    hotStreakUpdateVisibility(view);
    hotStreakScheduleAdvance(view);
    hotStreakExplainWidget?.refresh();
  }

  function hotStreakClearState() {
    hotStreakView = null;
    hotStreakSelectedCards.clear();
    hotStreakPendingStack = null;
    hotStreakPendingDouble = null;
    hotStreakScheduledStep = null;
    hotStreakTrackOpen = null;
    hotStreakTrackPhase = null;
    if (hotStreakAdvanceTimer) window.clearTimeout(hotStreakAdvanceTimer);
    if (hotStreakFallbackTimer) window.clearTimeout(hotStreakFallbackTimer);
    hotStreakAdvanceTimer = null;
    hotStreakFallbackTimer = null;
    [hotStreakPlayers, hotStreakSwerveKey, hotStreakTrack, hotStreakPool,
      hotStreakTickets, hotStreakHand, hotStreakLog, hotStreakStandingsList,
      hotStreakResultBody].forEach((element) => {
      if (element) element.innerHTML = "";
    });
    if (hotStreakCurrentCard) hotStreakCurrentCard.innerHTML = "";
    hotStreakCloseConfirm();
    hotStreakCloseDoubleDialog();
    hotStreakHideTip();
    hotStreakExplainWidget?.exit();
    hotStreakHelpWidget?.close();
  }

  function hotStreakShowHeaderActions(show) {
    if (hotStreakHeaderActions) hotStreakHeaderActions.style.display = show ? "flex" : "none";
    if (!show) hotStreakExplainWidget?.exit();
  }

  /* ------------------------------------------------------------------ *
   * Wiring
   * ------------------------------------------------------------------ */

  initHotStreakHelpExplain();

  hotStreakNoticeToggle?.addEventListener("click", () => {
    const open = hotStreakDataNotice.hidden;
    hotStreakDataNotice.hidden = !open;
    hotStreakNoticeToggle.setAttribute("aria-expanded", String(open));
  });

  hotStreakTrackToggle?.addEventListener("click", () => {
    hotStreakTrackOpen = hotStreakTrackBody.hidden;
    hotStreakTrackBody.hidden = !hotStreakTrackOpen;
    hotStreakTrackToggle.setAttribute("aria-expanded", String(hotStreakTrackOpen));
  });

  hotStreakLogToggle?.addEventListener("click", () => {
    hotStreakLogOpen = !hotStreakLogOpen;
    hotStreakLog.hidden = !hotStreakLogOpen;
    hotStreakLogToggle.setAttribute("aria-expanded", String(hotStreakLogOpen));
    if (hotStreakLogOpen) hotStreakLog.scrollTop = hotStreakLog.scrollHeight;
  });

  hotStreakSubmitBtn?.addEventListener("click", () => {
    if (!hotStreakHasAction("submit_race_cards")) return;
    sendAction({ type: "submit_race_cards", card_ids: Array.from(hotStreakSelectedCards) });
  });

  hotStreakContinueBtn?.addEventListener("click", () => {
    if (!hotStreakView || !hotStreakHasAction("advance_race")) return;
    sendAction({ type: "advance_race", expected_step_index: Number(hotStreakView.step_index || 0) });
  });

  hotStreakNextRaceBtn?.addEventListener("click", () => sendAction({ type: "next_round" }));
  hotStreakPlayAgainBtn?.addEventListener("click", () => sendAction({ type: "play_again" }));

  hotStreakConfirmCancel?.addEventListener("click", hotStreakCloseConfirm);
  hotStreakTicketMask?.addEventListener("click", (event) => {
    if (event.target === hotStreakTicketMask) hotStreakCloseConfirm();
  });

  hotStreakHandSection?.addEventListener("click", (event) => {
    if (event.target === hotStreakHandSection || event.target === hotStreakHand
      || event.target === hotStreakHandHint) {
      hotStreakSelectedCards.clear();
      if (hotStreakView) hotStreakRenderHand(hotStreakView);
    }
  });

  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") return;
    if (hotStreakTicketMask && !hotStreakTicketMask.hidden) hotStreakCloseConfirm();
    hotStreakHideTip();
  });

  window.clearHotStreakState = hotStreakClearState;
  window.renderHotStreakGameState = hotStreakRenderGameState;
  window.showHotStreakHeaderActions = hotStreakShowHeaderActions;
})();
