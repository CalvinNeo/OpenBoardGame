(() => {
  "use strict";
  const byId = suffix => document.getElementById(`natsumemo${suffix}`);
  const panel = byId("Panel"), dialog = byId("Dialog"), tooltip = byId("Tooltip");
  const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const roles = {boy: "👦 男孩", girl: "👧 女孩"};
  let view = null, selectedDay = null, allocations = {}, shownWeek = 1, pending = false;
  let explaining = false, suppressClick = false, tipTimer, pendingTimer, suppressTimer, previousFocus;
  let signature = null;
  const explanations = {
    weeks: ["四周的暑假", "Week（🗓️，周）：共四周，每周最多提议六次活动；没人参加也计一次。周末自动安排学习会和作业，所有人确认后继续。"],
    calendar: ["Calendar · 日历（🗓️）", "活动占用连续的 1–3 天，不得跨周或覆盖已有约定。提议者必须有空，仍可选择不参加。格内图标表示活动，末日的数字是本次充实度（⭐）；点击或悬停可看具体活动。"],
    activity: ["Activity · 活动", "按当前卡片的条件给每名参与者结算。先秘密提交 Join 或 Skip，全员提交后统一揭晓。独自参加时优先用单人条件；家庭活动不受其他参与者影响。"],
    role: ["Character · 角色", "男孩（👦）与女孩（👧）是游戏角色，与玩家现实身份无关。某些活动比较角色组合。线上开局将两种角色人数保持平衡；点击角色即锁定选择。"],
    propose: ["Propose · 发起约定", "选择本周一段连续空档，再点击 Propose。日程冲突会自动使该玩家无法参加。你的提议不会替你自动选择 Join。空白处或 Esc 可以取消日期选择。"],
    respond: ["Join / Skip · 秘密决定", "Join（🙋）占用这次活动的全部日期；Skip（🏠）保留空档。所有有空的玩家，包括发起者，都秘密选择，全部提交后同时揭晓。提交后不能更改。"],
    contest: ["Dice · 秘密选点（🎲）", "桌游活动中，参加者秘密选择 1–6 点，全部锁定后一起揭晓。唯一最高者得最多分；并列最高者得较少分，其他参加者按牌面得分。这里是选点，不是随机掷骰。"],
    hearts: ["Friendship · 好感度（❤️）", "活动所得爱心（❤️）必须秘密分给本次同行的其他玩家。两颗可以给同一人，也可分给两人。期末分别比较大家给每位朋友的爱心，最多的给予者得 10 分，并列各得 5 分；零爱心并列同样按并列处理。线上允许继续记录超过纸张十格的爱心。"],
    homework: ["Homework · 暑假作业（✏️）", "作业进度是秘密信息。期末必须完成 25 页，每缺一页扣 10 分；第 26–30 页每页加 2 分。完成全部 30 页获得预习达人称号（🏅）。额外作业不再增加页数。"],
    study: ["Study · 周三学习会（📚）", "每周活动结束后，周三没有安排的人自动参加学习会。其他空日逐日掷骰写作业。前三周：1 点得 3 分与偷懒称号，2–5 点写 2 页，6 点写 3 页。第四周：1–2 点得 5 分与超级偷懒称号，3–5 点写 3 页，6 点写 4 页。具体骰子和页数只对本人显示。"],
    titles: ["Titles · 称号（🏅）", "不同称号只记录一次。期末称号分等于不同称号数量的平方，例如 4 个称号得 16 分。"],
    score: ["Memories · 充实度（⭐）", "日历和玩家行显示活动、学习会与偷懒获得的公开分数。最终总分还会加作业奖惩、称号分及好感度奖励。最高总分获胜，并列共享胜利。"],
    next: ["Next Round · 继续", "先看清本次结果。每位玩家都点击 Next Round 后才继续下一次活动或下一周；第四周确认后揭晓秘密日记并结算。机器人不会跳过真人确认。"],
  };
  const help = `<h3>写下一个充实的夏天</h3><p>3–6 人，共四周。轮流发起活动，在充实度（⭐）、好感度（❤️）、称号（🏅）和作业（✏️）之间安排时间。最终总分最高者获胜，同分共享胜利。</p>
    <h3>角色与约定</h3><p>选择游戏中的男孩（👦）或女孩（👧），与现实身份无关。线上按两种角色人数相差不超过一人确认。首位发起者随机确定，每周首位发起者向下一座轮转。</p><p>每周九张活动牌，最多提议六次。当前发起者选择本周连续空日，点击 <strong>Propose</strong>。不能跨周或覆盖日程。活动放不下时自动放回牌堆底找下一张，整叠都放不下则跳过该发起者。全员都无法安排时直接学习。</p>
    <h3>同时决定，同游留下回忆</h3><p>有空的玩家秘密点击 <strong>Join（🙋）</strong> 或 <strong>Skip（🏠）</strong>，发起者也可以不去。全部提交后统一揭晓，没人参加仍消耗一次提议。每位参加者按活动牌人数／角色组合／参加次数等条件得分，单人适用卡上的单人效果。家庭旅行等独立活动不计算同行人数。</p><p>爱心（❤️）分给同游的其他玩家，两颗可集中或分开。点击 + / − 后用 <strong>Confirm</strong> 锁定。秘密日记（🔒）仅本人可见，期末才公开。所有人分配完成后展示回顾，全员 <strong>Next Round</strong> 后继续。</p>
    <h3>Dice · 骰子（🎲）</h3><p>桌游（🎲）由各参加者秘密选择 1–6 点；全部锁定后揭晓，按唯一最高、并列最高和其他人分别计分。电玩（🎮）由系统为各参加者随机掷骰，再比较最高点。抓虫（🪲）各自随机掷骰按牌面计分，独自抓虫也掷骰。独自参加桌游或电玩直接使用单人效果。</p>
    <h3>周末学习与作业</h3><p>周三空闲者自动参加学习会（📚）。前三周多人各得 3 分、2 页作业、1 颗爱心；独自学习得 0 分、3 页作业。第四周多人各得 2 分、3 页作业、1 颗爱心；独自学习得 0 分、4 页作业。</p><p>剩余空日成为作业日（✏️），系统逐日掷骰。前三周：⚀ 得 3 分和偷懒称号；⚁–⚄ 完成 2 页；⚅ 完成 3 页。第四周按官方勘误：⚀–⚁ 得 5 分和超级偷懒称号；⚂–⚄ 完成 3 页；⚅ 完成 4 页。本人可在 <strong>Study results</strong> 查看骰子与页数。每周结果都须全员确认。</p>
    <h3>期末结算</h3><p>活动总分（⭐）加三项：① 作业（✏️）少于 25 页每缺一页 −10；第 26–30 页每页 +2；完成 30 页获得预习达人。② 称号（🏅）数量平方，同称号不重复。③ 对每位朋友，比较其他玩家给他的爱心（❤️）：唯一最多的给予者 +10，并列最多各 +5，包括零颗并列。</p>
    <h3>线上操作</h3><p>点击周标签回顾旧日历。日历小格悬停或点击显示活动详情；手机提示三秒后关闭。Explain 再点目标可解释，灰色按钮也可用；Esc 退出解释、关闭弹窗或取消日期。断线后使用原座位重连。机器人只读取自己的日记和公开日程。</p><p>线上适配：角色保持均衡；爱心继续记录，不受纸上十个印刷格限制；活动与周末均增加全员回顾确认。</p>
    <p><a href="http://www.cosaic.co.jp/games/ntmm.html" target="_blank" rel="noopener noreferrer">Publisher & errata</a> · <a href="https://juegosrollandwrite.com/wp-content/uploads/2019/12/Natsumemo_-_Rules_translation_v2.pdf" target="_blank" rel="noopener noreferrer">Rules reference</a></p>`;

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
    node.dataset.nmExplain = key;
    node.dataset.nmTip = message || explanations[key][1];
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
        line.append(el("span", "", `${name(row.player_id)}${row.player_id === view.you ? " · You" : ""}${study}${result.dice?.[row.player_id] ? ` · 🎲 ${result.dice[row.player_id]}` : ""}`), el("strong", "", `⭐ +${row.points}`)); area.append(line);
        if (row.titles?.length) area.append(el("small", "", row.titles.map(id => `🏅 ${view.titles[id]}`).join(" · ")));
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
    if (explaining || !can(kind)) return;
    const action = {type: kind, game_token: view.game_token, step: view.step, ...extra};
    pending = true; clearTimeout(pendingTimer); hideTip(); render();
    pendingTimer = setTimeout(() => { pending = false; render(); }, 3000);
    sendAction(action);
  }
  byId("Next").addEventListener("click", () => dispatch("next_round"));
  function hideTip() { clearTimeout(tipTimer); tooltip.classList.add("hidden"); }
  function showTip(target, autoHide = false) {
    if (!target || explaining || dialog.open) return;
    const message = target.dataset.nmTip || explanations[target.dataset.nmExplain]?.[1];
    if (!message) return;
    clearTimeout(tipTimer); tooltip.textContent = message; tooltip.classList.remove("hidden");
    const rect = target.getBoundingClientRect(), box = tooltip.getBoundingClientRect();
    tooltip.style.left = `${Math.max(12, Math.min(rect.left, innerWidth - box.width - 12))}px`;
    tooltip.style.top = `${rect.bottom + box.height + 18 < innerHeight ? rect.bottom + 7 : Math.max(12, rect.top - box.height - 7)}px`;
    if (autoHide) tipTimer = setTimeout(hideTip, 3000);
  }
  function setExplain(value) {
    explaining = value; panel.classList.toggle("nm-explaining", value);
    byId("ExplainBtn").setAttribute("aria-pressed", String(value)); hideTip();
  }
  function showDialog(title, body, html = false) {
    previousFocus = document.activeElement; hideTip(); text("DialogTitle", title);
    if (html) byId("DialogBody").innerHTML = body;
    else byId("DialogBody").replaceChildren(el("p", "", body));
    if (!dialog.open) dialog.showModal(); byId("DialogClose").focus();
  }
  function explain(target) {
    const entry = explanations[target?.dataset.nmExplain];
    if (!entry) return;
    const detail = target.dataset.nmExplain === "activity" && view?.card ? `${view.card.name}：${view.card.description}\n\n${entry[1]}` : target.dataset.nmTip || entry[1];
    setExplain(false); showDialog(entry[0], detail);
  }
  byId("HelpBtn").addEventListener("click", () => { setExplain(false); showDialog("暑假日记 · Natsumemo", help, true); });
  byId("ExplainBtn").addEventListener("click", () => setExplain(!explaining));
  byId("DialogClose").addEventListener("click", () => dialog.close());
  dialog.addEventListener("close", () => { if (previousFocus?.isConnected) previousFocus.focus(); });
  dialog.addEventListener("click", event => {
    const rect = dialog.getBoundingClientRect();
    if (event.target === dialog && (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom)) dialog.close();
  });
  const exempt = target => target.closest("#natsumemoHelpBtn, #natsumemoExplainBtn, #natsumemoDialog");
  document.addEventListener("pointerdown", event => {
    suppressClick = false;
    if (!explaining || panel.classList.contains("hidden") || exempt(event.target)) return;
    event.preventDefault(); event.stopImmediatePropagation();
    const direct = event.target.closest("[data-nm-explain]");
    const target = direct || [...panel.querySelectorAll("[data-nm-explain]")].find(node => {
      const rect = node.getBoundingClientRect();
      return rect.width && rect.height && event.clientX >= rect.left && event.clientX <= rect.right && event.clientY >= rect.top && event.clientY <= rect.bottom;
    });
    suppressClick = true; clearTimeout(suppressTimer);
    suppressTimer = setTimeout(() => { suppressClick = false; }, 750); explain(target);
  }, true);
  document.addEventListener("click", event => {
    if (suppressClick) { suppressClick = false; event.preventDefault(); event.stopImmediatePropagation(); return; }
    if (!explaining || panel.classList.contains("hidden") || exempt(event.target)) return;
    event.preventDefault(); event.stopImmediatePropagation(); explain(event.target.closest("[data-nm-explain]"));
  }, true);
  document.addEventListener("keydown", event => {
    if (panel.classList.contains("hidden")) return;
    if (event.key === "Escape") { setExplain(false); hideTip(); if (view) deselect(); }
    if (!explaining || exempt(event.target) || !["Enter", " "].includes(event.key)) return;
    event.preventDefault(); event.stopImmediatePropagation(); explain(event.target.closest("[data-nm-explain]"));
  }, true);
  document.addEventListener("click", event => {
    if (view && !panel.classList.contains("hidden") && !dialog.open && !event.target.closest("button, input, select, dialog, summary, a, [data-nm-explain]")) deselect();
  });
  panel.addEventListener("pointerover", event => { if (event.pointerType === "mouse") showTip(event.target.closest("[data-nm-explain]")); });
  panel.addEventListener("pointerout", event => { if (event.pointerType === "mouse") hideTip(); });
  panel.addEventListener("focusin", event => showTip(event.target.closest("[data-nm-explain]")));
  panel.addEventListener("focusout", hideTip);
  panel.addEventListener("click", event => { const target = event.target.closest("[data-nm-explain]"); if (target && !target.closest("button")) showTip(target, true); });
  document.addEventListener("scroll", hideTip, true); window.addEventListener("resize", hideTip); window.addEventListener("blur", hideTip);
  function clearState() {
    view = null; signature = null; selectedDay = null; allocations = {}; pending = false;
    clearTimeout(pendingTimer); clearTimeout(suppressTimer); suppressClick = false;
    setExplain(false); hideTip(); if (dialog.open) dialog.close();
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
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", sync, {once: true}); else sync();
})();
