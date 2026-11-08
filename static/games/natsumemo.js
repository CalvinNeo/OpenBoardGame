(() => {
  "use strict";
  const byId = suffix => document.getElementById(`natsumemo${suffix}`);
  const panel = byId("Panel"), tooltip = byId("Tooltip");
  const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const roles = {boy: "👦 男孩", girl: "👧 女孩"};
  let view = null, selectedDay = null, allocations = {}, shownWeek = 1, pending = false;
  let tipTimer, pendingTimer;
  let signature = null;
  let natsumemoHelpWidget = null, natsumemoExplainWidget = null;

  const NATSUMEMO_HELP_CONFIG = {
    gameId: "natsumemo",
    title: { zh: "暑假日记 · Natsumemo", en: "Natsumemo" },
    basic: {
      win: {
        zh: "暑假结束时总分最高的玩家获胜，总分把活动充实度(⭐)、暑假作业(✏️)、称号(🏅)和好感度(❤️)四项相加，同分的人共享胜利。",
        en: "The player with the highest final total wins. That total adds activity memories (⭐), summer homework (✏️), titles (🏅) and friendship (❤️), and tied players share the victory."
      },
      turn: {
        zh: "每周由当前发起者挑一段连续空日提议活动，其余有空的玩家秘密选择 Join(🙋) 或 Skip(🏠)，全员揭晓后按活动牌结算并分配爱心(❤️)。",
        en: "Each week the current speaker proposes an activity on a run of free days, everyone with free time secretly picks Join (🙋) or Skip (🏠), and once all choices are revealed the card is scored and hearts (❤️) are handed out."
      },
      key: {
        zh: "你要在四周的有限时间里塞进高分活动，同时经营同行关系，好在期末为每位朋友比拼爱心(❤️)时抢下那 10 分。",
        en: "You have to fit the highest scoring activities into four short weeks while building the friendships that decide who wins the ten point heart (❤️) contest for each friend."
      }
    },
    sections: [
      {
        id: "roles",
        label: { zh: "角色与开局", en: "Roles and setup" },
        html: {
          zh: "<p>三到六位玩家一起度过四周暑假。每人先点击男孩(👦)或女孩(👧)锁定游戏角色，这与现实身份无关，两种角色的人数会保持相差不超过一人。</p>"
            + "<p>首位发起者随机决定，之后每周的首位发起者向下一个座位轮转。每周有九张活动牌，最多提议六次活动。</p>",
          en: "<p>Three to six players spend four weeks of summer together. Everyone first clicks boy (👦) or girl (👧) to lock a game character, which has nothing to do with real identity, and the two roles are kept within one of each other.</p>"
            + "<p>The first speaker is chosen at random and the opening speaker rotates one seat every week. Each week holds nine activity cards and allows at most six proposals.</p>"
        }
      },
      {
        id: "propose",
        label: { zh: "发起约定", en: "Proposing" },
        html: {
          zh: "<p>轮到你发起时，在日历上点选本周的一段连续空日，再按 Propose。活动会占一到三天，既不能跨周，也不能盖住已有安排。</p>"
            + "<p>如果当前活动牌在你这周放不下，系统会自动把它放回牌堆底并翻下一张。整叠牌都放不下时就跳过你，轮到下一位发起者。</p>"
            + "<p>提议只定下日期，不会替你自动选择参加。点空白处或按 Esc 可以取消已选的日期。</p>",
          en: "<p>When it is your turn to propose, click a run of free days in this week's calendar and press Propose. An activity takes one to three days, may not cross into another week and may not cover an existing plan.</p>"
            + "<p>If the current card does not fit anywhere in your week it goes back to the bottom of the deck and the next one is drawn. When no card fits at all the turn passes to the next speaker.</p>"
            + "<p>A proposal only fixes the date and never signs you up. Click empty space or press Esc to clear the selected day.</p>"
        }
      },
      {
        id: "respond",
        label: { zh: "同时决定", en: "Secret decisions" },
        html: {
          zh: "<p>日期定下后，所有这几天有空的玩家，包括发起者，都秘密点击 Join(🙋) 或 Skip(🏠)。Join 会占掉这次活动的全部日期，Skip 保留空档。</p>"
            + "<p>日程冲突的玩家自动记为不参加。所有人提交后同时揭晓，提交之后不能更改。即使没人参加，这次提议也会被消耗掉。</p>"
            + "<p>每位参加者按活动牌上的人数、角色组合或参加次数等条件得分，独自参加时改用卡上的单人效果，家庭旅行这类独立活动不受同行人数影响。</p>",
          en: "<p>Once the date is set, every player who is free on those days, the speaker included, secretly presses Join (🙋) or Skip (🏠). Join books every day of the activity while Skip keeps them free.</p>"
            + "<p>Players with a scheduling conflict are marked as absent automatically. All answers are revealed together and cannot be changed, and the proposal is spent even when nobody joins.</p>"
            + "<p>Every participant scores according to the head count, role mix or repeat visits printed on the card. A solo participant uses the card's solo effect instead, and independent activities such as the family trip ignore how many people came.</p>"
        }
      },
      {
        id: "dice",
        label: { zh: "骰子与结算", en: "Dice and scoring" },
        html: {
          zh: "<p>桌游(🎲)活动由参加者各自秘密选择 1 到 6 点，全部锁定后一起揭晓，再按唯一最高、并列最高和其他人三档分别计分。</p>"
            + "<p>电玩(🎮)由系统为每位参加者随机掷骰后比较点数。抓虫(🪲)各自随机掷骰并按牌面直接计分，独自抓虫也会掷骰。</p>"
            + "<p>独自参加桌游或电玩时直接使用卡上的单人效果，不再比点。揭晓后的骰点会显示在结果栏里。</p>",
          en: "<p>In a board game (🎲) every participant secretly picks a value from 1 to 6, all picks are revealed together, and the single highest, the tied highest and everyone else each score their own tier.</p>"
            + "<p>Video games (🎮) are rolled by the system for each participant and then compared. Bug catching (🪲) rolls separately for everyone and scores straight from the card, and a solo bug catcher still rolls.</p>"
            + "<p>Joining a board game or a video game alone uses the card's solo effect with no comparison at all. The revealed dice are shown in the result panel.</p>"
        }
      },
      {
        id: "hearts",
        label: { zh: "爱心与日记", en: "Hearts and diary" },
        html: {
          zh: "<p>活动中得到的爱心(❤️)必须秘密分给这次同行的其他玩家。两颗可以都给同一个人，也可以分开给两个人。</p>"
            + "<p>用 + 和 − 调整数量，再按 Confirm 锁定。你的秘密日记(🔒)只有自己看得到，期末才会公开。</p>"
            + "<p>线上版不受纸上十个印刷格的限制，可以继续累加爱心(❤️)。</p>",
          en: "<p>Hearts (❤️) earned in an activity must be given in secret to the other people who came along. Two hearts may both go to one friend or be split between two.</p>"
            + "<p>Adjust the amount with + and − and press Confirm to lock it in. Your private diary (🔒) is visible only to you until the end of the summer.</p>"
            + "<p>The online version is not limited by the ten printed boxes on the paper sheet, so hearts (❤️) keep accumulating.</p>"
        }
      },
      {
        id: "study",
        label: { zh: "学习与作业", en: "Study and homework" },
        html: {
          zh: "<p>每周活动结束后，周三仍然空着的玩家自动参加学习会(📚)。前三周多人各得 3 分、2 页作业和 1 颗爱心(❤️)，独自学习得 0 分和 3 页作业。</p>"
            + "<p>第四周多人各得 2 分、3 页作业和 1 颗爱心(❤️)，独自学习得 0 分和 4 页作业。</p>"
            + "<p>剩下的空日变成作业日(✏️)，系统逐日掷骰。前三周掷到 1 点得 3 分和偷懒虫称号，2 到 5 点完成 2 页，6 点完成 3 页。</p>"
            + "<p>第四周按官方勘误改成 1 到 2 点得 5 分和超级偷懒虫称号，3 到 5 点完成 3 页，6 点完成 4 页。骰点和页数只对本人显示。</p>",
          en: "<p>After the weekly activities anyone still free on Wednesday joins the study session (📚). In the first three weeks a group earns 3 points, 2 pages and 1 heart (❤️) each, while studying alone earns 0 points and 3 pages.</p>"
            + "<p>In week four a group earns 2 points, 3 pages and 1 heart (❤️) each, and studying alone earns 0 points and 4 pages.</p>"
            + "<p>Every remaining free day becomes a homework day (✏️) and the system rolls one die per day. In the first three weeks a 1 gives 3 points and the slacker title, 2 to 5 complete 2 pages and a 6 completes 3 pages.</p>"
            + "<p>Week four follows the official errata, where 1 to 2 give 5 points and the super slacker title, 3 to 5 complete 3 pages and a 6 completes 4 pages. Dice and pages are shown only to their owner.</p>"
        }
      },
      {
        id: "final",
        label: { zh: "期末结算", en: "Final scoring" },
        html: {
          zh: "<p>活动充实度(⭐)之外还要加三项。第一项是暑假作业(✏️)，少于 25 页时每缺一页扣 10 分，第 26 到 30 页每页加 2 分，完成全部 30 页还能拿到预习达人称号(🏅)。</p>"
            + "<p>第二项是称号(🏅)分，等于不同称号数量的平方，例如四个不同称号就是 16 分，重复的称号只记一次。</p>"
            + "<p>第三项是好感度(❤️)，对每位朋友比较其他玩家给他的爱心数量，唯一最多的给予者得 10 分，并列最多各得 5 分，全都是零颗时同样按并列处理。</p>",
          en: "<p>Three more items are added to the activity memories (⭐). The first is summer homework (✏️), where every page short of 25 costs 10 points, pages 26 to 30 are worth 2 points each, and finishing all 30 pages also grants the prepared student title (🏅).</p>"
            + "<p>The second is the title (🏅) score, which is the number of different titles squared, so four different titles are worth 16 points and duplicates count only once.</p>"
            + "<p>The third is friendship (❤️). For each friend the hearts given by everyone else are compared, the single biggest giver scores 10, tied givers score 5 each, and an all zero tie is treated the same way.</p>"
        }
      },
      {
        id: "online",
        label: { zh: "线上操作", en: "Playing online" },
        html: {
          zh: "<p>点击 W1 到 W4 的周标签可以回看以前的日历。日历小格悬停或点击会显示活动详情，手机上的提示三秒后自动消失。</p>"
            + "<p>每次活动结算和每周结算都会停下来，等所有人按 Next Round 才继续，机器人不会替真人跳过确认。断线后用原来的座位重连就能回到游戏。</p>"
            + "<p><a href=\"http://www.cosaic.co.jp/games/ntmm.html\" target=\"_blank\" rel=\"noopener noreferrer\">Publisher and errata</a> · <a href=\"https://juegosrollandwrite.com/wp-content/uploads/2019/12/Natsumemo_-_Rules_translation_v2.pdf\" target=\"_blank\" rel=\"noopener noreferrer\">Rules reference</a></p>",
          en: "<p>The W1 to W4 tabs let you look back at earlier calendars. Hovering or tapping a calendar cell shows what happened there, and the hint fades after three seconds on phones.</p>"
            + "<p>Play pauses after every activity and every week until everyone presses Next Round, and bots never confirm for a human. If you disconnect, rejoin with your original seat to return to the game.</p>"
            + "<p><a href=\"http://www.cosaic.co.jp/games/ntmm.html\" target=\"_blank\" rel=\"noopener noreferrer\">Publisher and errata</a> · <a href=\"https://juegosrollandwrite.com/wp-content/uploads/2019/12/Natsumemo_-_Rules_translation_v2.pdf\" target=\"_blank\" rel=\"noopener noreferrer\">Rules reference</a></p>"
        }
      }
    ]
  };

  const NATSUMEMO_EXPLAIN = {
    weeks: {
      zh: "暑假一共四周，每周最多提议六次活动，没有人参加也会计一次。每周活动结束后自动安排学习会(📚)和作业日(✏️)，所有人确认后才进入下一周。",
      en: "The summer lasts four weeks and each week allows at most six proposals, counting even the ones nobody joins. Study (📚) and homework days (✏️) are arranged automatically at the end of a week, and play moves on once everyone confirms."
    },
    calendar: {
      zh: "日历(🗓️)上的活动占一到三天的连续空档，不能跨周也不能盖住已有安排。格内图标表示活动，最后一天的数字是这次活动的充实度(⭐)。",
      en: "Activities on the calendar (🗓️) take one to three consecutive free days and may not cross a week or cover an existing plan. The icon shows the activity and the number on its last day is the memories (⭐) it earned."
    },
    activity: {
      zh: "当前活动牌决定每位参加者拿多少分。所有人先秘密提交 Join(🙋) 或 Skip(🏠)，全员提交后统一揭晓，独自参加时改用卡上的单人效果。",
      en: "The current activity card decides what every participant scores. Everyone submits Join (🙋) or Skip (🏠) in secret first, all choices are revealed together, and a solo participant uses the card's solo effect instead."
    },
    role: {
      zh: "男孩(👦)与女孩(👧)只是游戏里的角色，和玩家的现实身份无关，有些活动会比较角色组合。线上开局会让两种角色的人数保持平衡，点击角色即锁定选择。",
      en: "Boy (👦) and girl (👧) are only in-game characters unrelated to the real players, and some activities compare role mixes. Online play keeps both roles balanced and clicking a role locks your choice."
    },
    propose: {
      zh: "选择本周一段连续空日后再按 Propose。日程冲突的玩家会自动无法参加，而你自己仍然可以选择 Skip(🏠)。点空白处或按 Esc 可以取消日期选择。",
      en: "Pick a run of free days this week and then press Propose. Players with a scheduling conflict are excluded automatically, while you may still choose Skip (🏠) yourself. Click empty space or press Esc to clear the date."
    },
    respond: {
      zh: "Join(🙋) 会占掉这次活动的全部日期，Skip(🏠) 则保留空档。所有有空的玩家包括发起者都秘密选择，全部提交后同时揭晓，提交之后不能更改。",
      en: "Join (🙋) books every day of this activity while Skip (🏠) keeps them free. Every player with free time, the speaker included, chooses in secret and all answers are revealed together with no changes allowed afterwards."
    },
    contest: {
      zh: "桌游(🎲)活动里参加者各自秘密选择 1 到 6 点，全部锁定后一起揭晓。唯一最高者拿最多分，并列最高者拿较少分，其余参加者按牌面得分。这里是选点而不是随机掷骰。",
      en: "In a board game (🎲) every participant secretly picks a value from 1 to 6 and all picks are revealed together. The single highest scores the most, a tied highest scores less and everyone else scores as printed. You choose the value instead of rolling."
    },
    dice: {
      zh: "这是活动揭晓后显示的骰点(🎲)。桌游(🎲)由参加者秘密选点，电玩(🎮)和抓虫(🪲)由系统随机掷骰，对应分数按当前活动牌计算。",
      en: "These are the dice (🎲) shown after the activity is revealed. Board games (🎲) use secret picks while video games (🎮) and bug catching (🪲) are rolled by the system, and the score follows the current activity card."
    },
    hearts: {
      zh: "活动得到的爱心(❤️)必须秘密分给这次同行的其他玩家，两颗可以给同一个人也可以分开。期末对每位朋友比较大家给出的爱心数量，唯一最多的给予者得 10 分，并列最多各得 5 分。",
      en: "Hearts (❤️) earned in an activity must be given in secret to the others who came along, and two hearts may go to one friend or be split. At the end each friend is compared, where the single biggest giver scores 10 and tied givers score 5 each."
    },
    homework: {
      zh: "作业进度是秘密信息。期末必须完成 25 页，每缺一页扣 10 分，第 26 到 30 页每页加 2 分，完成全部 30 页还能拿到预习达人称号(🏅)。",
      en: "Homework progress is secret. At the end you need 25 pages, every missing page costs 10 points, pages 26 to 30 are worth 2 points each, and finishing all 30 pages grants the prepared student title (🏅)."
    },
    study: {
      zh: "每周活动结束后周三没有安排的人自动参加学习会(📚)，其余空日逐日掷骰写作业。前三周 1 点得 3 分和偷懒虫称号，2 到 5 点写 2 页，6 点写 3 页。第四周按勘误改成 1 到 2 点得 5 分和超级偷懒虫称号，3 到 5 点写 3 页，6 点写 4 页。",
      en: "After the weekly activities anyone still free on Wednesday joins the study session (📚) and every other free day is rolled for homework. In the first three weeks a 1 gives 3 points and the slacker title, 2 to 5 write 2 pages and a 6 writes 3 pages, while week four uses the errata of 1 to 2 for 5 points and the super slacker title, 3 to 5 for 3 pages and 6 for 4 pages."
    },
    titles: {
      zh: "称号(🏅)每种只记录一次。期末的称号分等于不同称号数量的平方，例如拿到四个不同称号就是 16 分。",
      en: "Each title (🏅) is recorded only once. The final title score is the number of different titles squared, so four different titles are worth 16 points."
    },
    score: {
      zh: "充实度(⭐)是活动、学习会和偷懒获得的公开分数。最终总分还会加上作业奖惩、称号(🏅)分和好感度(❤️)奖励，最高总分获胜，并列时共享胜利。",
      en: "Memories (⭐) are the public points earned from activities, study sessions and slacking. The final total also adds homework rewards and penalties, title (🏅) points and friendship (❤️) awards, and the highest total wins with ties sharing the victory."
    },
    next: {
      zh: "先看清本次结果。每位玩家都点击 Next Round 之后才会继续下一次活动或下一周，第四周确认后揭晓秘密日记(🔒)并结算总分，机器人不会跳过真人确认。",
      en: "Take in the result first. Play only continues after every player presses Next Round, and after week four the private diaries (🔒) are revealed and scored. Bots never confirm on behalf of a human."
    }
  };

  const nmLang = () => (typeof window.obgHelpLang === "function" && window.obgHelpLang() === "en" ? "en" : "zh");
  const nmText = entry => typeof entry === "string" ? entry : (entry?.[nmLang()] ?? entry?.zh ?? "");
  // Cards, calendar cells and title lists need their own explanation, so the
  // generated text is registered as an extra key instead of replacing a shared one.
  const nmDynamicKeys = new Map();
  let nmDynamicSeq = 0;
  function nmDynamicKey(key, message) {
    const id = key + "|" + message;
    let dynamic = nmDynamicKeys.get(id);
    if (!dynamic) {
      dynamic = key + "_d" + (++nmDynamicSeq);
      nmDynamicKeys.set(id, dynamic);
      NATSUMEMO_EXPLAIN[dynamic] = message;
    }
    return dynamic;
  }

  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = text;
    return node;
  }
  const text = (suffix, value) => { byId(suffix).textContent = value; };
  const name = pid => view?.players.find(player => player.player_id === pid)?.name || pid || "—";
  const own = () => view?.players.find(player => player.player_id === view.you);
  const can = kind => !!view && !pending && socket.connected && view.legal_actions.includes(kind);
  function tip(node, key, message) {
    node.dataset.nmExplain = message ? nmDynamicKey(key, message) : key;
    if (message) node.dataset.nmTip = message;
    else delete node.dataset.nmTip;
    if (node.tagName !== "BUTTON") node.tabIndex = 0;
    return node;
  }
  function button(label, kind, onClick, enabled = true, primary = false) {
    const node = tip(el("button", primary ? "nm-primary" : "", label), kind);
    node.type = "button"; node.disabled = !enabled;
    node.addEventListener("click", onClick);
    return node;
  }
  function range(day, duration) { return duration > 1 ? `${days[day]} – ${days[day + duration - 1]}` : days[day]; }
  function renderCalendar() {
    const tabs = byId("Weeks"); tabs.replaceChildren();
    for (let week = 1; week <= 4; week++) {
      const node = button(`W${week}`, "weeks", () => { shownWeek = week; renderCalendar(); }, week <= view.week);
      node.setAttribute("aria-pressed", String(week === shownWeek)); tabs.append(node);
    }
    const calendar = byId("Calendar"); calendar.replaceChildren();
    const headings = el("div", "nm-day-headings");
    days.forEach(day => headings.append(el("span", "", day))); calendar.append(headings);
    for (const player of view.players) {
      const row = el("div", `nm-player${player.player_id === view.you ? " is-you" : ""}`);
      const heading = el("div", "nm-player-heading"), who = el("div", "nm-player-name");
      who.append(el("strong", "", player.name));
      const status = [player.player_id === view.you ? "You" : "", player.is_bot ? "Bot" : "", player.player_id === view.speaker ? "Speaker" : "", view.ready.includes(player.player_id) ? "Ready ✓" : ""].filter(Boolean).join(" · ");
      who.append(el("small", "", status));
      const stats = el("div", "nm-player-stats");
      stats.append(tip(el("span", "", roles[player.role]), "role"), tip(el("span", "", `⭐ ${player.week_scores.reduce((a, b) => a + b, 0)}`), "score"), tip(el("span", "", `🏅 ${player.titles.length}`), "titles", player.titles.map(id => view.titles[id]).join(" · ") || "尚未获得称号（🏅）。"));
      heading.append(who, stats); row.append(heading);
      const grid = el("div", "nm-days");
      player.calendar[shownWeek - 1].forEach((cell, day) => {
        const selectable = can("propose") && player.player_id === view.you && shownWeek === view.week;
        let node = selectable ? button("", "propose", () => { selectedDay = selectedDay === day ? null : day; renderCalendar(); renderControls(); }, view.legal_days.includes(day)) : el("div", "");
        node.className = `nm-day${cell ? ` is-${cell.kind}` : " is-empty"}`;
        const start = selectedDay ?? view.proposed_day;
        if (shownWeek === view.week && start != null && view.card && day >= start && day < start + view.card.days && !["week_review", "game_over"].includes(view.phase)) node.classList.add("is-proposed");
        node.append(el("span", "nm-day-icon", cell?.emoji || (day === 2 ? "·" : "—")), el("small", "", cell ? cell.points == null ? "↔" : `+${cell.points}` : days[day]));
        const detail = cell ? `Week ${shownWeek} · ${range(cell.start, cell.duration)} · ${cell.emoji} ${cell.name}${cell.points != null ? ` · ⭐ ${cell.points}` : ""}` : `${days[day]}：空闲${day === 2 ? "，若保持空闲将参加学习会（📚）" : "，未安排时成为作业日（✏️）"}。`;
        tip(node, selectable ? "propose" : "calendar", detail); node.setAttribute("aria-label", detail); grid.append(node);
      });
      row.append(grid); calendar.append(row);
    }
  }
  function renderControls() {
    const area = byId("Controls"), scroll = area.scrollTop; area.replaceChildren();
    const hint = value => area.append(el("p", "nm-control-hint", value));
    if (view.phase === "setup") {
      hint("点击锁定游戏角色，所有人选好后开始暑假。");
      const group = el("div", "nm-action-pair");
      for (const role of ["boy", "girl"]) group.append(button(roles[role], "role", () => dispatch("choose_role", {role}), can("choose_role") && view.role_choices.includes(role)));
      area.append(group);
      if (!can("choose_role")) hint("Waiting for the other players…");
    } else if (view.phase === "propose") {
      hint(can("propose") ? "Select a start day, then propose." : `${name(view.speaker)} is choosing a date.`);
      const picker = el("div", "nm-date-picker");
      for (let day = 0; day < 7; day++) {
        const node = button(days[day], "propose", () => { selectedDay = selectedDay === day ? null : day; shownWeek = view.week; renderCalendar(); renderControls(); }, can("propose") && view.legal_days.includes(day));
        node.setAttribute("aria-pressed", String(selectedDay === day)); picker.append(node);
      }
      area.append(picker, button(selectedDay == null ? "Propose" : `Propose · ${range(selectedDay, view.card.days)}`, "propose", () => dispatch("propose", {day: selectedDay}), can("propose") && selectedDay != null, true));
    } else if (view.phase === "respond") {
      const pair = el("div", "nm-action-pair");
      pair.append(button("🙋 Join", "respond", () => dispatch("respond", {attend: true}), can("respond"), true), button("🏠 Skip", "respond", () => dispatch("respond", {attend: false}), can("respond")));
      area.append(pair);
      hint(view.private?.choice == null ? `Secret choices · ${view.submitted.length} / ${view.players.length}` : `${view.private.choice ? "Join" : "Skip"} locked · ${view.submitted.length} / ${view.players.length}`);
    } else if (view.phase === "contest") {
      hint(`🎲 Secret choices · ${view.dice_submitted.length} / ${view.contest_players.length}`);
      const picker = el("div", "nm-dice-picker");
      for (let value = 1; value <= 6; value++) {
        const node = button(["⚀", "⚁", "⚂", "⚃", "⚄", "⚅"][value - 1], "contest", () => dispatch("choose_die", {value}), can("choose_die"));
        node.setAttribute("aria-label", `Choose ${value}`); picker.append(node);
      }
      area.append(picker);
      if (view.private?.die) hint(`Locked · ${view.private.die}`);
      else if (!can("choose_die")) hint("Waiting for the participants…");
    } else if (view.phase === "allocate") {
      const allocation = view.private?.pending;
      if (allocation) {
        const total = Object.values(allocations).reduce((a, b) => a + b, 0);
        hint(`❤️ Allocate privately · ${total} / ${allocation.amount}`);
        const list = el("div", "nm-allocation");
        for (const pid of allocation.recipients) {
          const row = el("div", "nm-allocation-row"), value = allocations[pid] || 0;
          row.append(el("span", "", name(pid)), button("−", "hearts", () => { allocations[pid] = value - 1; renderControls(); }, can("allocate") && value > 0), el("output", "", value), button("+", "hearts", () => { allocations[pid] = value + 1; renderControls(); }, can("allocate") && total < allocation.amount));
          row.querySelectorAll("button").forEach((node, index) => node.setAttribute("aria-label", `${index ? "Add heart to" : "Remove heart from"} ${name(pid)}`));
          list.append(row);
        }
        area.append(list, button("Confirm", "hearts", () => dispatch("allocate", {hearts: allocations}), can("allocate") && total === allocation.amount, true));
      } else hint("Waiting for private diaries…");
    }
    area.scrollTop = scroll;
  }
  function renderDiary() {
    const data = view.private; byId("Diary").classList.toggle("hidden", !data);
    if (!data) return;
    text("Homework", `✏️ ${data.homework} / 25`);
    const bonus = data.homework < 25 ? -10 * (25 - data.homework) : 2 * (data.homework - 25);
    text("HomeworkScore", `If summer ended now: ${bonus > 0 ? "+" : ""}${bonus}`);
    const pages = byId("Pages"); pages.replaceChildren();
    for (let i = 1; i <= 30; i++) pages.append(el("span", `${i <= data.homework ? "is-filled" : ""}${i > 25 ? " is-bonus" : ""}`, i));
    const hearts = byId("Hearts"); hearts.replaceChildren();
    for (const [pid, count] of Object.entries(data.hearts)) {
      const row = tip(el("div", "nm-friend"), "hearts"); row.append(el("span", "", name(pid)), el("span", "", `❤️ ${count}`)); hearts.append(row);
    }
    const titles = byId("Titles"); titles.replaceChildren();
    own().titles.forEach(id => titles.append(tip(el("span", "nm-title", `🏅 ${view.titles[id]}`), "titles")));
    const study = byId("Study"), scroll = study.scrollTop; study.replaceChildren();
    data.study_results.forEach((record, index) => {
      study.append(tip(el("div", "", `W${index + 1} · 📚 ${record.study_pages} 页`), "study"));
      record.rolls.forEach(roll => study.append(tip(el("div", "", `${days[roll.day]} · ${["⚀", "⚁", "⚂", "⚃", "⚄", "⚅"][roll.die - 1]} · ✏️ +${roll.homework} · ⭐ +${roll.points}`), "study")));
    });
    study.scrollTop = scroll;
  }
  function renderResult() {
    const result = view.result, area = byId("Result"); area.replaceChildren(); area.classList.toggle("hidden", !result);
    if (result) {
      area.append(el("strong", "", result.kind === "study" ? `Week ${view.week} · 学习结算` : `同行 ${result.participants.length} 人`));
      if (!result.rows.length) area.append(el("span", "", "Nobody joined this activity."));
      result.rows.forEach(row => {
        const line = el("div", `nm-result-row${row.player_id === view.you ? " is-you" : ""}`);
        const study = result.kind === "study" ? (result.participants.includes(row.player_id) ? " · 📚 学习会" : " · ✏️ 作业") : "";
        const who = el("span", "nm-result-name");
        who.append(el("span", "", `${name(row.player_id)}${row.player_id === view.you ? " · You" : ""}`));
        if (study) who.append(tip(el("small", "", study), "study"));
        if (result.dice?.[row.player_id]) who.append(tip(el("span", "", `🎲 ${result.dice[row.player_id]}`), "dice"));
        if (row.titles?.length) who.append(tip(el("small", "", row.titles.map(id => `🏅 ${view.titles[id]}`).join(" · ")), "titles"));
        line.append(who, tip(el("strong", "", `⭐ +${row.points}`), "score")); area.append(line);
      });
      if (result.kind === "event") view.players.filter(player => !result.participants.includes(player.player_id)).forEach(player => {
        const line = el("div", `nm-result-row${player.player_id === view.you ? " is-you" : ""}`);
        line.append(el("span", "", `${player.name}${player.player_id === view.you ? " · You" : ""}`), el("span", "", "🏠 未参加")); area.append(line);
      });
    }
    const reviewing = ["event_review", "week_review"].includes(view.phase);
    byId("Review").classList.toggle("hidden", !reviewing);
    text("Ready", `Ready · ${view.ready.length} / ${view.players.length}`);
    byId("Next").disabled = !can("next_round");
    text("Next", view.ready.includes(view.you) ? "Waiting for everyone…" : "Next Round");
    const history = byId("History"), scroll = history.scrollTop; history.replaceChildren();
    view.history.slice().reverse().forEach(item => history.append(el("li", "", `W${item.week} · ${item.emoji || "📚"} ${item.name} · ${item.participants.map(name).join(" / ") || "Nobody"}`))); history.scrollTop = scroll;
  }
  function renderFinal() {
    byId("Final").classList.toggle("hidden", !view.game_over);
    if (!view.game_over) return;
    text("Winner", `🏆 ${view.winner_ids.map(name).join(" · ")}`);
    const scores = byId("Scores"); scores.replaceChildren();
    for (const row of view.scores) {
      const card = el("article", `nm-scorecard${view.winner_ids.includes(row.player_id) ? " is-winner" : ""}`);
      card.append(el("strong", "", name(row.player_id)), el("span", "nm-score-total", row.total));
      for (const [key, label, why] of [["activities", "⭐ 充实度", "score"], ["homework", "✏️ 作业", "homework"], ["titles", "🏅 称号", "titles"], ["hearts", "❤️ 好感", "hearts"]]) {
        const line = tip(el("div", "nm-score-row"), why); line.append(el("span", "", label), el("span", "", row[key])); card.append(line);
      }
      scores.append(card);
    }
    const awards = byId("Awards"); awards.replaceChildren();
    view.heart_contests.forEach(contest => awards.append(el("p", "", `${name(contest.target)} ← ${Object.entries(contest.amounts).map(([pid, amount]) => `${name(pid)} ❤️ ${amount}`).join(" · ")} → ${contest.winners.map(name).join(" / ")} +${contest.points}`)));
  }
  function render() {
    if (!view) return;
    document.getElementById("roomControlsPanel")?.classList.toggle("natsumemo-needs-action", socket.connected && !pending && view.legal_actions.length > 0);
    const statuses = {setup: "选择你的暑假角色", propose: `${name(view.speaker)} · 发起一个约定`, respond: "一起去吗？秘密决定", contest: "桌游时间 · 秘密选择骰点", allocate: "把回忆写进秘密日记", event_review: "约定揭晓 · 留住这一刻", week_review: `第 ${view.week} 周结束 · 看看这周的收获`, game_over: "暑假结束 · 我们的夏日回忆"};
    text("Status", socket.connected ? statuses[view.phase] : "Disconnected · Reconnecting…");
    text("Progress", `Week ${view.week} / 4 · ${view.event_number} / 6`);
    text("EventName", view.card?.name || "准备放暑假"); text("Emoji", view.card?.emoji || "🌻");
    text("CardLabel", view.result?.kind === "study" ? "THE QUIET DAYS COUNT, TOO" : `WEEK ${view.week} · SUMMER PLANS`);
    text("Duration", view.card ? `${view.card.days} day${view.card.days > 1 ? "s" : ""}` : "");
    text("Date", view.proposed_day == null || !view.card ? "" : range(view.proposed_day, view.card.days));
    text("Rule", view.card?.description || "四周的夏天，等我们一起填满。");
    renderCalendar(); renderControls(); renderDiary(); renderResult(); renderFinal();
  }
  function deselect() { if (selectedDay == null) return; selectedDay = null; renderCalendar(); renderControls(); }
  function dispatch(kind, extra = {}) {
    if (!can(kind)) return;
    const action = {type: kind, game_token: view.game_token, step: view.step, ...extra};
    pending = true; clearTimeout(pendingTimer); hideTip(); render();
    pendingTimer = setTimeout(() => { pending = false; render(); }, 3000);
    sendAction(action);
  }
  byId("Next").addEventListener("click", () => dispatch("next_round"));
  function hideTip() { clearTimeout(tipTimer); tooltip.classList.add("hidden"); }
  function showTip(target, autoHide = false) {
    if (!target || natsumemoExplainWidget?.isActive()) return;
    const message = target.dataset.nmTip || nmText(NATSUMEMO_EXPLAIN[target.dataset.nmExplain]);
    if (!message) return;
    clearTimeout(tipTimer); tooltip.textContent = message; tooltip.classList.remove("hidden");
    const rect = target.getBoundingClientRect(), box = tooltip.getBoundingClientRect();
    tooltip.style.left = `${Math.max(12, Math.min(rect.left, innerWidth - box.width - 12))}px`;
    tooltip.style.top = `${rect.bottom + box.height + 18 < innerHeight ? rect.bottom + 7 : Math.max(12, rect.top - box.height - 7)}px`;
    if (autoHide) tipTimer = setTimeout(hideTip, 3000);
  }
  function initNatsumemoHelpExplain() {
    if (natsumemoHelpWidget || typeof window.obgCreateHelp !== "function") return;
    natsumemoHelpWidget = window.obgCreateHelp(NATSUMEMO_HELP_CONFIG);
    natsumemoExplainWidget = window.obgCreateExplain({
      gameId: "natsumemo",
      attribute: "data-nm-explain",
      explanations: NATSUMEMO_EXPLAIN,
      button: byId("ExplainBtn"),
      root: () => panel,
      bypass: ["#natsumemoHelpBtn", "#natsumemoExplainBtn"]
    });
    byId("HelpBtn").addEventListener("click", () => {
      natsumemoExplainWidget?.exit();
      natsumemoHelpWidget.open();
    });
    byId("ExplainBtn").addEventListener("click", () => natsumemoExplainWidget?.toggle());
  }
  document.addEventListener("keydown", event => {
    if (panel.classList.contains("hidden")) return;
    if (event.key === "Escape") { hideTip(); if (view) deselect(); }
  }, true);
  document.addEventListener("click", event => {
    if (view && !panel.classList.contains("hidden") && !event.target.closest("button, input, select, dialog, summary, a, [data-nm-explain]")) deselect();
  });
  panel.addEventListener("pointerover", event => { if (event.pointerType === "mouse") showTip(event.target.closest("[data-nm-explain]")); });
  panel.addEventListener("pointerout", event => { if (event.pointerType === "mouse") hideTip(); });
  panel.addEventListener("focusin", event => showTip(event.target.closest("[data-nm-explain]")));
  panel.addEventListener("focusout", hideTip);
  panel.addEventListener("click", event => { const target = event.target.closest("[data-nm-explain]"); if (target && !target.closest("button")) showTip(target, true); });
  document.addEventListener("scroll", hideTip, true); window.addEventListener("resize", hideTip); window.addEventListener("blur", hideTip);
  function clearState() {
    view = null; signature = null; selectedDay = null; allocations = {}; pending = false;
    clearTimeout(pendingTimer);
    natsumemoExplainWidget?.exit(); hideTip();
    document.getElementById("roomControlsPanel")?.classList.remove("natsumemo-needs-action");
    ["Calendar", "Controls", "Result", "Hearts", "Titles", "Pages", "Study", "History", "Scores", "Awards", "Weeks"].forEach(id => byId(id).replaceChildren());
    ["Review", "Result", "Final", "Diary"].forEach(id => byId(id).classList.add("hidden"));
    text("Status", "Waiting to start"); text("Progress", "Week —"); text("EventName", "准备放暑假"); text("Rule", ""); text("Date", ""); text("Duration", "");
  }
  window.renderNatsumemoGameState = data => {
    if (data?.view?.game_id !== "natsumemo" || currentGameType !== "natsumemo" || data.room_id && data.room_id !== currentRoomState?.room_id) return;
    const incoming = data.view, nextSignature = JSON.stringify([data.room_id, incoming.game_token, incoming.revision, incoming.you]);
    if (signature === nextSignature) return;
    if (!view || view.game_token !== incoming.game_token || view.step !== incoming.step) { selectedDay = null; allocations = {}; }
    if (!view || view.game_token !== incoming.game_token || view.week !== incoming.week) shownWeek = incoming.week;
    signature = nextSignature; view = incoming; pending = false; clearTimeout(pendingTimer); hideTip(); render();
  };
  window.showNatsumemoHeaderActions = visible => {
    byId("HeaderActions").style.display = visible ? "flex" : "none";
    if (!visible) clearState();
  };
  function sync() {
    socket.on("room:state", state => { if (state.game_type === "natsumemo" && state.status === "lobby") clearState(); });
    socket.on("system:error", () => { pending = false; clearTimeout(pendingTimer); render(); });
    socket.on("disconnect", () => { pending = false; clearTimeout(pendingTimer); hideTip(); render(); });
    socket.on("connect", render);
    if (typeof currentRoomState !== "undefined" && currentRoomState?.game_type === "natsumemo" && currentRoomState.status === "lobby") clearState();
    if (typeof lastGameStatePayload !== "undefined" && lastGameStatePayload?.game_type === "natsumemo") window.renderNatsumemoGameState(lastGameStatePayload);
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", initNatsumemoHelpExplain, {once: true}); else initNatsumemoHelpExplain();
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", sync, {once: true}); else sync();
})();
