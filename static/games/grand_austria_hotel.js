(() => {
  "use strict";
  const panel = document.getElementById("grandAustriaPanel");
  const root = document.getElementById("grandAustriaRoot");
  const header = document.getElementById("grandAustriaHeaderActions");
  const helpBtn = document.getElementById("grandAustriaHelpBtn");
  const explainBtn = document.getElementById("grandAustriaExplainBtn");
  const dialog = document.getElementById("grandAustriaDialog");
  const tip = document.getElementById("grandAustriaTip");
  const icons = {strudel:"🥐", cake:"🍰", wine:"🍷", coffee:"☕", red:"🔴", blue:"🔵", yellow:"🟡", green:"🟢"};
  const foodNames = {strudel:"苹果卷", cake:"蛋糕", wine:"葡萄酒", coffee:"咖啡"};
  const colorNames = {red:"红色市民", blue:"蓝色贵族", yellow:"黄色艺术家", green:"绿色游客"};
  const actionNames = {1:"🥐🍰 餐点", 2:"🍷☕ 饮品", 3:"🛏️ 准备房间", 4:"💰👑 金钱与声望", 5:"🧑‍🍳 雇用员工"};
  const diceFaces = ["⚀", "⚁", "⚂", "⚃", "⚄", "⚅"];
  const phases = {setup_guest:"开局 · 免费选择客人", setup_rooms:"开局 · 准备三间房", turn:"营业中", emperor:"皇帝结算", round_end:"本轮回顾", game_over:"最终成绩"};
  const staffTimings = {
    round: {label:"🔁 每轮一次", text:"每轮一次(🔁)：雇用当轮即可在自己的回合使用，每轮最多一次；下一轮恢复。"},
    once: {label:"⚡ 立即一次", text:"立即一次(⚡)：雇用时立即结算一次，之后不会再次触发。"},
    permanent: {label:"∞ 永久生效", text:"永久生效(∞)：雇用后持续生效，每次满足卡牌写明的条件时触发。"},
    end: {label:"🏁 终局计分", text:"终局计分(🏁)：第七轮皇帝事件之后，按卡牌条件计算额外分数(⭐)。"},
  };
  const explanations = {
    dice:"骰子(🎲)：取走前同点数骰子的数量决定强度，每次只移走一颗。① 苹果卷(🥐)不少于蛋糕(🍰)；② 葡萄酒(🍷)不少于咖啡(☕)；③ 准备房间(🛏️)；④ 分配克朗(💰)与皇帝进度(👑)；⑤ 按强度优惠雇用一位员工(🧑‍🍳)。⑥ 付 1 克朗模拟其他行动，强度看六点组。每次主行动可另付 1 克朗强化一次。",
    guest:"客人：每回合主行动前可招揽一人，咖啡厅最多三人。市场左至右费用为 3／2／1／0／0 克朗(💰)。点卡牌后，在该区域的半透明蒙版中查看订单、奖励和费用，再点 Recruit。红(🔴)、蓝(🔵)、黄(🟡)客人需同色空房；绿(🟢)游客可住任何颜色。点已完成订单的客人，再点房间办理入住。",
    room:"酒店房间(🛏️)：虚线为未准备，钥匙(🔑)为空房，行李(🧳)为已入住。准备须与已有房间正交相邻，首次从左下角开始。第 1–4 层分别花 0／1／2／3 克朗(💰)；右上角房间另有准备奖励分(⭐)。入住需完成订单且颜色匹配。相同组号的房间全满触发奖励。",
    serve:"送餐：新获得的餐点可免费分配给客人，余下收入厨房。已有厨房餐点每付 1 克朗(💰)最多送三份，可以分给不同客人；Chief Waiter 让厨房送餐免费。已送出的餐点不可移回。订单完成后仍需点选客人和空房才能入住。",
    staff:"员工(🧑‍🍳)：手牌秘密，雇用后公开。每轮一次(🔁)、立即一次(⚡)、永久生效(∞)、终局计分(🏁)四类时机在卡牌标签中标明。五点行动只雇用一人，折扣超过费用不返还克朗(💰)。每轮能力雇用当轮即可使用。",
    objective:"目标(🎯)：在自己的回合达成条件后可认领；前三位依次获得 15／10／5 分(⭐)，每人每张至多一次。皇帝结算期间不能认领。",
    emperor:"声望／皇帝轨(👑)：第 3／5／7 轮，先按轨道格下方的分数(⭐)得分，再退 3／5／7 格。退格后位置 ≥3 获奖励(🎁)，1–2 中立(➖)，0 受罚(⚠️)。轨道上的编号棋子对应玩家。营业时底色预示按当前位置退格后的结果，轮末则显示结算后区域。实物惩罚必须优先足额支付，无法执行才扣分；Conference Manager 可付 1 克朗(💰)免罚。到 13 格后，多出的进度每格得 1 分。轮末回顾分别显示轨道得分和奖惩的实际增减。",
    pass:"Pass：只有本回合还未进行任何操作时可选。保留未用回合，等其余人完成或通过后弃一骰并重投。无骰即结束本轮；不要把 Pass 当作 End Turn。",
    end:"End Turn：完成本次骰子主行动且处理完所有奖励后结束回合。结束前可继续入住、送餐、使用员工和认领目标。",
    next:"Next Round：本轮所有结算已完成，点击即确认已读，不再二次确认。每个席位都须确认后才进入下一轮，掉线玩家也需重新连接并确认；机器人自动确认。第七轮确认后结束游戏。",
    confirm:"提交蒙版中的当前选项。费用、数量、房间颜色及奖励均由服务器验证。点击空白、Cancel 或 Esc 可取消选择。",
    cancel:"Cancel 取消当前选择，不会执行任何游戏行动。也可点蒙版周围的空白或按 Esc。",
    reward:"完成当前奖励选择后才能继续回合。多个奖励可自行选择处理顺序。Skip 放弃当前可选奖励；抽三选一的剩余员工须按自己选择的次序放回牌库底。",
    inspect:"查看这个玩家的公开酒店、资源、咖啡厅和已雇用员工；对手员工手牌始终隐藏。",
  };
  const GAH_EXPLAIN = {
    dice: { zh: explanations.dice, en: "Dice (🎲): the number of dice showing that face left when you take one sets the strength, and you only remove a single die. ① strudel (🥐) at least as many as cake (🍰), ② wine (🍷) at least as many as coffee (☕), ③ prepare rooms (🛏️), ④ split kroner (💰) and emperor progress (👑), ⑤ hire one staff (🧑‍🍳) at a discount equal to the strength, ⑥ pay 1 kroner to copy another action with the strength read from the six group. Each main action may also be boosted once for 1 kroner." },
    guest: { zh: explanations.guest, en: "Guests: before your main action each turn you may recruit one, and the cafe holds at most three. Market slots cost 3, 2, 1, 0 and 0 kroner (💰) from left to right. Click a card to see its order, reward and cost in the translucent overlay of that area, then press Recruit. Red (🔴), blue (🔵) and yellow (🟡) guests need a vacant room of their colour while green (🟢) tourists accept any colour. Click a guest with a completed order, then a room, to check in." },
    room: { zh: explanations.room, en: "Hotel rooms (🛏️): a dashed outline is unprepared, a key (🔑) is vacant and luggage (🧳) is occupied. A new room must touch an existing one orthogonally and the first starts from the bottom left corner. Floors 1 to 4 cost 0, 1, 2 and 3 kroner (💰), and rooms in the top right corner carry a preparation bonus (⭐). Checking in needs a completed order and a matching colour, and filling every room of one group triggers its bonus." },
    serve: { zh: explanations.serve, en: "Serving: newly gained food may be handed to guests for free and the rest goes to the kitchen. Food already in the kitchen costs 1 kroner (💰) per action to serve up to three portions, which may go to different guests, and the Chief Waiter makes kitchen serving free. Served food can never be taken back, and a finished order still needs you to click the guest and a vacant room to check in." },
    staff: { zh: explanations.staff, en: "Staff (🧑‍🍳): your hand is secret and a hired card becomes public. The four timings, once per round (🔁), immediately once (⚡), permanent (∞) and end game scoring (🏁), are printed on the card label. A five point action hires only one staff member, a discount larger than the cost never refunds kroner (💰), and a once per round ability can be used the same round you hire it." },
    objective: { zh: explanations.objective, en: "Objectives (🎯): claim one on your own turn once its condition is met. The first three claimants score 15, 10 and 5 points (⭐), each player may claim a given objective once, and no objective may be claimed during emperor scoring." },
    emperor: { zh: explanations.emperor, en: "Prestige and the emperor track (👑): in rounds 3, 5 and 7 you first score the points (⭐) printed under your track space, then retreat 3, 5 and 7 spaces. After retreating a position of 3 or more earns a reward (🎁), 1 or 2 is neutral (➖) and 0 triggers a penalty (⚠️). The numbered tokens on the track are the players. During business the background predicts the outcome after retreating from your current position, while the round review shows the settled zone. A physical penalty must be paid in full first and only costs points if it cannot be performed, and the Conference Manager lets you pay 1 kroner (💰) to avoid it. Past space 13 each extra step scores 1 point, and the round review lists the track points and the actual reward or penalty separately." },
    pass: { zh: explanations.pass, en: "Pass: available only while you have done nothing at all this turn. You keep your unused turn and, once everyone else has finished or passed, discard one die and reroll. Running out of dice ends the round, and Pass is not the same as End Turn." },
    end: { zh: explanations.end, en: "End Turn: finish this dice main action and end the turn once every reward is resolved. Before ending you may still check guests in, serve food, use staff and claim objectives." },
    next: { zh: explanations.next, en: "Next Round: every settlement for this round is done and pressing it confirms you have read the result with no second confirmation. Every seat must confirm before the next round begins, including a disconnected player who must reconnect, while bots confirm on their own. The game ends after round seven is confirmed." },
    confirm: { zh: explanations.confirm, en: "Submit the current choice in the overlay. Costs, counts, room colours and rewards are all validated by the server, and clicking blank space, pressing Cancel or Esc cancels the selection." },
    cancel: { zh: explanations.cancel, en: "Cancel drops the current selection without performing any game action, and you can also click the blank area around the overlay or press Esc." },
    reward: { zh: explanations.reward, en: "You can only continue your turn once the current reward choice is resolved. Several rewards may be handled in any order you like, Skip gives up the current optional reward, and the staff you did not pick from a draw of three go back to the bottom of the deck in the order you choose." },
    inspect: { zh: explanations.inspect, en: "Look at this player's public hotel, resources, cafe and hired staff, while an opponent's staff hand always stays hidden." },
    tip: { zh: "这是一个说明标记，它标出界面上的一个数值或图例。鼠标悬停或轻点可以查看该元素此刻的具体含义。", en: "This is an information marker pointing at a figure or a legend on the board. Hover or tap it to see what that element means right now." },
    dialog_close: { zh: "关闭当前对话框并回到酒店。", en: "Close the current dialog and return to the hotel." }
  };
  const gahKeyByText = Object.fromEntries(Object.entries(explanations).map(([key, value]) => [value, key]));
  const gahPassiveKey = description => gahKeyByText[description] || "tip";
  let view = null, selected = null, selectedGuest = null, selectedFace = null, inspected = null;
  let selectionContext = null;
  let dieTarget = 1, dieBoost = false, dieSplit = 0, dieTiming = "after";
  let pendingSend = false, pendingTimer, tipTimer, suppressedUntil = 0, returnFocus;
  const esc = value => String(value ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;"}[c]));

  const GAH_HELP_CONFIG = {
    gameId: "grand_austria_hotel",
    title: { zh: "奥地利大饭店 · Grand Austria Hotel", en: "Grand Austria Hotel" },
    basic: {
      win: {
        zh: "经营七轮酒店。第七轮皇帝事件后按已入住房楼层、终局员工、剩余克朗与厨房餐点计分，扣掉未入住客人的罚分，最高分获胜。",
        en: "Run a hotel for seven rounds. After the round seven emperor event you score occupied rooms by floor, end game staff, remaining kroner and kitchen food, subtract the penalty for guests who never checked in, and the highest score wins."
      },
      turn: {
        zh: "轮到你时先取一颗行动骰(🎲)执行主行动，可以在主行动前招揽一位客人，行动后处理奖励、入住、送餐、使用员工和认领目标，最后 End Turn。",
        en: "On your turn you take one action die (🎲) for your main action, you may recruit a guest before it, and afterwards you resolve rewards, check guests in, serve food, use staff and claim objectives before pressing End Turn."
      },
      key: {
        zh: "骰子数量就是行动强度而且每轮只有那么多，所以真正的规划在于用有限的强点数去滚出房间组连锁、皇帝轨位置和员工折扣的组合。",
        en: "The dice count is the action strength and there are only so many each round, so real planning means spending those limited strong results on room group chains, emperor track position and staff discounts at the same time."
      }
    },
    sections: [
      {
        id: "overview",
        label: { zh: "经营七轮", en: "Seven rounds" },
        html: {
          zh: "<p>2 到 4 位玩家。起手 10 克朗(💰)、苹果卷(🥐)、蛋糕(🍰)、葡萄酒(🍷)、咖啡(☕)各一份和六张员工。逆顺序免费选客，再从左下角开始准备三房。每轮两次回合，顺序如 A→B→B→A，轮末起始玩家顺移。</p>",
          en: "<p>For 2 to 4 players. You start with 10 kroner (💰), one each of strudel (🥐), cake (🍰), wine (🍷) and coffee (☕), and six staff cards. Guests are picked free in reverse order and then you prepare three rooms starting from the bottom left corner. Each round gives two turns in an order like A, B, B, A, and the starting player rotates at the end of the round.</p>"
        }
      },
      {
        id: "actions",
        label: { zh: "招客与主行动", en: "Guests and actions" },
        html: { zh: `<p>${esc(explanations.guest)}</p><p>${esc(explanations.dice)}</p>`, en: `<p>${esc(GAH_EXPLAIN.guest.en)}</p><p>${esc(GAH_EXPLAIN.dice.en)}</p>` }
      },
      {
        id: "kitchen",
        label: { zh: "厨房、房间与奖励", en: "Kitchen, rooms and rewards" },
        html: { zh: `<p>${esc(explanations.serve)}</p><p>${esc(explanations.room)}</p><p>${esc(explanations.reward)}</p>`, en: `<p>${esc(GAH_EXPLAIN.serve.en)}</p><p>${esc(GAH_EXPLAIN.room.en)}</p><p>${esc(GAH_EXPLAIN.reward.en)}</p>` }
      },
      {
        id: "groups",
        label: { zh: "房间组与员工", en: "Room groups and staff" },
        html: {
          zh: `<p>房间组号 A 到 J 表示分组。整组全部入住时，蓝(🔵)得 2／5／9／15 分(⭐)，红(🔴)得 1／3／6／10 克朗(💰)，黄(🟡)得 1／3／6／10 皇帝进度(👑)，分别对应一组 1 到 4 间。</p><p>${esc(explanations.staff)}</p>`,
          en: `<p>The room letters A to J mark the groups. Filling a whole group scores 2, 5, 9 or 15 points (⭐) for blue (🔵), 1, 3, 6 or 10 kroner (💰) for red (🔴) and 1, 3, 6 or 10 emperor progress (👑) for yellow (🟡), matching groups of 1 to 4 rooms.</p><p>${esc(GAH_EXPLAIN.staff.en)}</p>`
        }
      },
      {
        id: "timings",
        label: { zh: "员工的四种时机", en: "The four staff timings" },
        html: { zh: `<p>${esc(Object.values(staffTimings).map(t => t.text).join(" "))}</p>`, en: "<p>Once per round (🔁): hire it and use it on your own turn the same round, at most once per round, refreshed next round.</p><p>Immediately once (⚡): it resolves once at the moment you hire it and never triggers again.</p><p>Permanent (∞): it stays in effect and triggers every time the condition written on the card is met.</p><p>End game scoring (🏁): after the round seven emperor event it adds points (⭐) according to the condition on the card.</p>" }
      },
      {
        id: "emperor",
        label: { zh: "目标与皇帝", en: "Objectives and emperor" },
        html: {
          zh: `<p>${esc(explanations.objective)}</p><p>${esc(explanations.emperor)} 克朗(💰)上限 20，溢出丢弃。皇帝轨各位置的结算分依次为 0／1／2／3／3／4／4／5／6／6／7／7／8／9。</p>`,
          en: `<p>${esc(GAH_EXPLAIN.objective.en)}</p><p>${esc(GAH_EXPLAIN.emperor.en)} Kroner (💰) are capped at 20 and anything above that is discarded, and the scoring values along the emperor track are 0, 1, 2, 3, 3, 4, 4, 5, 6, 6, 7, 7, 8 and 9.</p>`
        }
      },
      {
        id: "turns",
        label: { zh: "通过与轮末", en: "Passing and round end" },
        html: { zh: `<p>${esc(explanations.pass)}</p><p>${esc(explanations.end)}</p><p>${esc(explanations.next)}</p>`, en: `<p>${esc(GAH_EXPLAIN.pass.en)}</p><p>${esc(GAH_EXPLAIN.end.en)}</p><p>${esc(GAH_EXPLAIN.next.en)}</p>` }
      },
      {
        id: "final",
        label: { zh: "终局", en: "Final scoring" },
        html: {
          zh: "<p>第七轮皇帝事件后：已入住房按楼层得 1／2／3／4 分，计算终局员工，剩余每克朗及每份厨房餐点各得 1 分，每位未入住客人扣 5 分。最高分获胜，同分比剩余克朗与厨房餐点总数，再同分共同获胜。</p>",
          en: "<p>After the round seven emperor event, each occupied room scores 1, 2, 3 or 4 points by floor, end game staff are counted, every remaining kroner and every kitchen food scores 1 point, and every guest who never checked in costs 5 points. The highest score wins, ties go to the larger total of remaining kroner and kitchen food, and a remaining tie is shared.</p>"
        }
      },
      {
        id: "version",
        label: { zh: "版本与操作", en: "Version and controls" },
        html: {
          zh: "<p>采用 2021 修订基础版和标准酒店，随机员工起手。无扩展、非对称酒店或员工轮抽。机器人只看公开信息和自己的员工手牌。</p><p>点选卡牌、房间或骰子后，在原区域的半透明蒙版内确认行动，点击空白、Cancel 或 Esc 取消。Next Round、Pass、End Turn、送餐、Skip、收入厨房、Claim 和工具栏的每轮员工按钮都是点击直接执行。Help 打开规则，Explain 之后点选控件查看解释，禁用控件也可查看。</p>",
          en: "<p>This uses the 2021 revised base game with the standard hotel and a random starting staff hand, without expansions, asymmetric hotels or a staff draft. Bots read only public information and their own staff hand.</p><p>After clicking a card, a room or a die you confirm the action inside the translucent overlay of that same area, and blank space, Cancel or Esc cancels it. Next Round, Pass, End Turn, serving, Skip, storing to the kitchen, Claim and the per round staff buttons in the toolbar all execute immediately when clicked. Help opens the rules and Explain lets you tap any control, disabled ones included, for a description.</p>"
        }
      }
    ]
  };
  let gahHelpWidget = null;
  let gahExplainWidget = null;
  function initGahHelpExplain() {
    if (gahHelpWidget || typeof window.obgCreateHelp !== "function") return;
    gahHelpWidget = window.obgCreateHelp(GAH_HELP_CONFIG);
    gahExplainWidget = window.obgCreateExplain({
      gameId: "grand_austria_hotel",
      attribute: "data-gah-explain",
      explanations: GAH_EXPLAIN,
      button: explainBtn,
      root: () => root,
      bypass: ["#grandAustriaHelpBtn", "#grandAustriaExplainBtn", "#grandAustriaClose"]
    });
    helpBtn?.addEventListener("click", () => {
      gahExplainWidget?.exit();
      gahHelpWidget.open();
    });
    explainBtn?.addEventListener("click", () => gahExplainWidget?.toggle());
  }
  const own = () => view?.players.find(p => p.player_id === view.you);
  const name = pid => view?.players.find(p => p.player_id === pid)?.name || "Spectator";
  const card = gid => view.catalog.guests[gid];
  const moves = type => view.moves.filter(move => move.type === type);
  const moveIndex = move => view.moves.indexOf(move);
  const same = (a,b) => JSON.stringify(a) === JSON.stringify(b);
  const btn = (text, action, why, disabled=false, attrs="") => `<button type="button" data-gah-action="${action}" data-gah-explain="${why}" ${disabled ? "disabled" : ""} ${attrs}>${text}</button>`;
  const passive = (text, description, cls="") => `<span class="${cls}" tabindex="0" title="${esc(description)}" data-gah-tip="${esc(description)}" data-gah-explain="${gahPassiveKey(description)}">${text}</span>`;
  const foodText = items => Object.entries(items || {}).filter(([,n]) => n).map(([key,n]) => `${icons[key]} ${n}`).join(" · ");

  function effectText(e) {
    const n = e.count || 1;
    const names = {money:`💰 +${n}`, emperor:`👑 +${n}`, vp:`⭐ +${n}`, staff_vp:`🧑‍🍳 每人 +${n}⭐`, draw:`🃏 抽 ${n} 张员工`,
      food:foodText(e.items), any_food:`🍽️ 任意餐点 ×${n}`, occupy:`🧳 额外入住 ×${n}`, complete:"🍽️ 完成一位客人订单",
      guest:`🛎️ 免费招客 ×${n}`, extra_die:"🎲 额外骰子行动"};
    if (e.kind === "prepare") return `🛏️ 准备 ${n} 房${e.discount >= 9 ? " · 免费" : e.discount ? ` · 每房优惠 ${e.discount}💰` : " · 原价"}${e.max_floor === 1 ? " · 底两层" : ""}${e.occupy ? "并入住" : ""}`;
    if (e.kind === "hire") return `${e.offer ? "🃏 抽三选一" : "🧑‍🍳 雇员"} ×${n}${e.discount >= 9 ? " · 免费" : ` · 优惠 ${e.discount}💰`}`;
    return names[e.kind] || "奖励";
  }
  const rewardText = guest => guest.effects.map(effectText).join("；") || "无额外奖励";

  function moveText(m) {
    const p = view.pending || {};
    const room = "room" in m ? `${Math.floor(m.room/5)+1}${m.room%5+1}` : "";
    const staffName = m.staff ? view.catalog.staff[m.staff].name : "";
    const names = {recruit:`招揽 ${card(view.market[m.slot])?.name || ""}`, take_guest:`免费招揽 ${card(view.market[m.slot])?.name || ""}`,
      prepare:`🛏️ 准备 ${room} 房`, occupy:`🧳 入住 ${room} 房`, check_in:`${card(m.guest)?.name || ""} → ${room} 房`,
      serve:"Kitchen → Serve", use_staff:`🔁 ${staffName}`, claim:"🎯 认领目标", pass:"Pass", end_turn:"End Turn", next_round:"Next Round",
      store_food:"📦 余下餐点收入厨房", hire:`雇用 ${staffName} · 💰 ${m.staff ? Math.max(0, view.catalog.staff[m.staff].cost-(p.discount||0)) : 0}`,
      return_staff:`放回牌库底 · ${staffName}`, remove_staff:`移除 ${staffName}`, remove_room:`移除 ${room} 房`,
      complete:`完成 ${card(m.guest)?.name || ""} 的订单`, avoid_penalty:"💰 支付 1 · 免除惩罚", accept_penalty:"接受皇帝惩罚", skip:"Skip"};
    if (m.type === "gain_food" || m.type === "serve_item") return `${icons[m.food]} ${foodNames[m.food]} → ${m.guest ? card(m.guest).name : "厨房"}`;
    if (m.type === "resolve") return effectText(p.effects[m.effect]);
    if (m.type === "dice" || m.type === "bonus_die") return diceDescription(m);
    return names[m.type] || m.type;
  }

  function strength(m) {
    const staff = m.type === "bonus_die" ? [] : own()?.staff || [];
    return view.dice[m.face-1] + Number(m.boost) + Number([1,2].includes(m.face) && staff.includes("13")) + Number(m.face === 6 && staff.includes("17")) + (m.face === 5 && staff.includes("18") ? 2 : 0);
  }
  function diceDescription(m) {
    const n = strength(m);
    if (m.action === 1) return `🥐 ${n-m.split} · 🍰 ${m.split}`;
    if (m.action === 2) return `🍷 ${n-m.split} · ☕ ${m.split}`;
    if (m.action === 3) return `🛏️ 准备至多 ${n} 间房`;
    if (m.action === 4) return own()?.staff.includes("15") && m.face === 4 && m.type !== "bonus_die" ? `💰 +${n} · 👑 +${n}` : `💰 +${n-m.split} · 👑 +${m.split}`;
    return `🧑‍🍳 雇用一人 · 优惠 ${n}💰`;
  }

  function guestHTML(gid, guest=null, slot=null) {
    if (!gid) return '<div class="gah-empty">—</div>';
    const g = card(gid);
    const order = Object.entries(g.order).map(([key,n]) => {
      const served = guest?.served[key] || 0;
      return passive(`${icons[key]}${guest ? `${served}/${n}` : n}`, `${foodNames[key]}(${icons[key]}) ${guest ? `已送 ${served}，需要 ${n}` : `需要 ${n}`}`, served >= n ? "gah-served" : "");
    }).join("");
    const active = slot !== null ? selected?.slot === slot && ["recruit","take_guest"].includes(selected.type) : selectedGuest === gid;
    const body = `<span class="gah-card-top">${icons[g.color]} <span>⭐ ${g.vp}</span></span><strong class="gah-card-name">${esc(g.name)}</strong><span class="gah-order">${order}</span><span class="gah-card-reward">${esc(rewardText(g))}</span>`;
    const button = btn(body, slot !== null ? "market" : "guest", "guest", false, `class="gah-card gah-${g.color}${active ? " gah-selected" : ""}" data-guest="${gid}" ${slot === null ? "" : `data-slot="${slot}"`} aria-label="${esc(`${g.name} · ${colorNames[g.color]} · ${g.vp} 分`)}"`);
    return slot === null ? button : `<div>${button}<span class="gah-card-cost">💰 ${view.phase === "setup_guest" || moves("take_guest").length || own()?.staff.includes("25") ? 0 : [3,2,1,0,0][slot]}</span></div>`;
  }

  function statsHTML(p) {
    return `<span class="gah-player-stats"><span>⭐ ${p.score}</span><span>💰 ${p.money}</span><span>👑 ${p.emperor}</span><span>🧳 ${p.rooms.filter(x=>x===2).length}</span></span>`;
  }

  function hotelHTML(p) {
    const active = p.player_id === view.you;
    const rows = [3,2,1,0].map(floor => `<div class="gah-floor"><div class="gah-floor-label">${passive(`${floor+1}F<span>💰${floor}</span>`, `第 ${floor+1} 层：准备房间通常花 ${floor} 克朗(💰)，已入住房终局得 ${floor+1} 分(⭐)。`)}</div>${[0,1,2,3,4].map(col => {
      const rid = floor*5+col, room = view.catalog.rooms[rid], status = p.rooms[rid];
      const matching = active && view.moves.some(m => m.room === rid && (m.type !== "check_in" || m.guest === selectedGuest));
      return btn(`<span class="gah-room-number">${floor+1}${col+1}</span><span class="gah-room-symbol">${status === 2 ? "🧳" : status === 1 ? "🔑" : icons[room.color]}</span><small>${String.fromCharCode(65+room.group)}${room.bonus && !status ? ` · ⭐${room.bonus}` : ""}</small>`, "room", "room", false,
        `class="gah-room gah-${room.color} ${status === 0 ? "gah-unprepared" : status === 2 ? "gah-occupied" : ""} ${matching ? "gah-available" : ""} ${selected?.room === rid ? "gah-selected" : ""}" data-room="${rid}" aria-label="Room ${floor+1}${col+1}, ${room.color}, ${["unprepared","vacant","occupied"][status]}, group ${String.fromCharCode(65+room.group)}"`);
    }).join("")}</div>`).join("");
    return `<div class="gah-hotel"><div class="gah-hotel-title">✦ ${esc(p.name)} · HOTEL ✦</div>${rows}<div class="gah-groups">${passive("🔵 2 / 5 / 9 / 15 ⭐", "同组蓝色房间全部入住：按组内 1／2／3／4 间获得 2／5／9／15 分。")}${passive("🔴 1 / 3 / 6 / 10 💰", "同组红色房间全部入住：按组内 1／2／3／4 间获得 1／3／6／10 克朗。")}${passive("🟡 1 / 3 / 6 / 10 👑", "同组黄色房间全部入住：按组内 1／2／3／4 间前进 1／3／6／10 皇帝格。")}</div></div>`;
  }

  function staffCardHTML(sid, player, move=null) {
    const s = view.catalog.staff[sid], timing = staffTimings[s.timing];
    const used = player.used_staff.includes(sid);
    const chosen = selected?.staff === sid;
    const cost = move?.type === "hire" ? Math.max(0, s.cost-(view.pending?.discount||0)) : s.cost;
    const attrs = `class="gah-staff-select" data-staff="${sid}" ${move ? `data-index="${moveIndex(move)}"` : ""}`;
    const body = `<strong>${esc(s.name)}</strong><span>💰 ${cost}${move?.type === "hire" && cost !== s.cost ? ` <del>${s.cost}</del>` : ""}</span><small>${esc(s.text)}</small>`;
    return `<article class="gah-staff-card ${chosen ? "gah-selected" : ""}" data-gah-explain="staff" data-staff="${sid}">
      ${btn(body, move ? "move" : "staff", "staff", false, attrs)}
      <div class="gah-staff-meta">${passive(timing.label, timing.text, `gah-staff-timing gah-timing-${s.timing}`)}${used ? '<span class="gah-staff-used">本轮已用</span>' : ""}</div></article>`;
  }

  function staffHTML(p, hand) {
    const ids = hand ? p.hand : p.staff;
    if (hand && p.player_id !== view.you) return `<p class="gah-small">🃏 ${p.hand_count} hidden cards</p>`;
    return selectionHost(`<div class="gah-staff-list" data-gah-scroll="${hand ? "hand" : "staff"}">${ids.map(sid=>staffCardHTML(sid,p)).join("") || '<p class="gah-small">No staff yet.</p>'}</div>`, hand ? "hand" : "staff");
  }

  function selectionHost(content, context) {
    const active = selectionContext === context && (selected || selectedGuest || selectedFace !== null);
    return `<div class="gah-selection-host" data-gah-selection-host="${context}"><div class="gah-selection-content" ${active ? "inert" : ""}>${content}</div>${active ? selectionOverlay() : ""}</div>`;
  }

  function selectionOverlay() {
    const controls = selectedFace !== null ? diceEditor() : "";
    let description = "", title = "Confirm selection", label = "Confirm";
    if (selected) {
      description = `<p>${esc(moveText(selected))}</p>`;
      label = {recruit:"Recruit", take_guest:"Recruit", hire:"Hire", use_staff:"Use", prepare:"Prepare", occupy:"Occupy", check_in:"Check In", claim:"Claim", return_staff:"Return", remove_staff:"Remove", remove_room:"Remove"}[selected.type] || "Confirm";
      if (["recruit","take_guest"].includes(selected.type)) {
        const g = card(view.market[selected.slot]);
        const cost = selected.type === "take_guest" || view.phase === "setup_guest" || own()?.staff.includes("25") ? 0 : [3,2,1,0,0][selected.slot];
        title = "Recruit guest";
        description += `<p class="gah-selection-meta">${icons[g.color]} · ${foodText(g.order)} · ⭐ ${g.vp} · 💰 ${cost}</p><p class="gah-small">${esc(rewardText(g))}</p>`;
      }
      if (selected.staff) {
        const s = view.catalog.staff[selected.staff];
        title = selected.type === "hire" ? "Hire staff" : "Staff action";
        description += `${passive(staffTimings[s.timing].label, staffTimings[s.timing].text, `gah-staff-timing gah-timing-${s.timing}`)}<p class="gah-small">${esc(s.text)}</p>`;
      }
      if (selected.type === "prepare") {
        const r = view.catalog.rooms[selected.room];
        const cost = own()?.staff.includes({blue:"9",red:"10",yellow:"11"}[r.color]) ? 0 : Math.max(0,r.floor-(view.pending?.discount||0));
        description += `<p class="gah-selection-meta">💰 ${cost}${r.bonus ? ` · ⭐ +${r.bonus}` : ""}</p>`;
      }
    } else if (selectedGuest) {
      title = "Check in guest";
      description = `<p>${esc(card(selectedGuest).name)}</p><p class="gah-small">Select a highlighted room in your hotel.</p>`;
    }
    return `<div class="gah-selection-overlay" role="group" aria-label="${title}"><div class="gah-selection-sheet">
      <strong class="gah-selection-title">${title}</strong>${description}${controls}<div class="gah-selection-actions">
      ${selected ? btn(label,"confirm","confirm",false,'class="gah-primary"') : ""}${btn("Cancel","cancel","cancel")}</div></div></div>`;
  }

  function diceEditor() {
    let options = view.moves.filter(m => ["dice","bonus_die"].includes(m.type) && m.face === selectedFace);
    if (!options.length) return '<p class="gah-small">This die is unavailable.</p>';
    if (!options.some(m=>m.action===dieTarget)) dieTarget=options[0].action;
    if (!options.some(m=>m.boost===dieBoost && m.action===dieTarget)) dieBoost=false;
    let filtered = options.filter(m=>m.action===dieTarget && m.boost===dieBoost);
    if (!filtered.some(m=>m.split===dieSplit)) dieSplit=filtered[0].split;
    if (!filtered.some(m=>m.timing===dieTiming)) dieTiming=filtered[0].timing;
    selected=filtered.find(m=>m.split===dieSplit && m.timing===dieTiming) || filtered[0];
    const splits=[...new Set(filtered.map(m=>m.split))];
    return `<div class="gah-command-row">${selectedFace === 6 ? `<label>Action <select id="grandAustriaDieTarget" data-gah-explain="dice">${[1,2,3,4,5].map(n=>`<option value="${n}" ${n===dieTarget?"selected":""}>${actionNames[n]}</option>`).join("")}</select></label>` : ""}
      ${options[0].type !== "bonus_die" ? `<label data-gah-explain="dice"><input id="grandAustriaBoost" type="checkbox" ${dieBoost?"checked":""} ${options.some(m=>m.boost)?"":"disabled"}> Boost · 💰1 → +1</label>` : ""}
      ${splits.length>1 ? `<label>Allocation <select id="grandAustriaSplit" data-gah-explain="dice">${splits.map(n=>`<option value="${n}" ${n===dieSplit?"selected":""}>${diceDescription({...selected,split:n})}</option>`).join("")}</select></label>` : ""}
      ${options.some(m=>m.timing==="before") ? `<label>Staff timing <select id="grandAustriaTiming" data-gah-explain="staff"><option value="before" ${dieTiming==="before"?"selected":""}>Before action</option><option value="after" ${dieTiming==="after"?"selected":""}>After action</option></select></label>` : ""}</div>`;
  }

  function commandHTML() {
    const isActor=view.pending ? view.pending.owner===view.you : view.current_turn===view.you;
    let title=isActor ? phases[view.phase] : `Waiting for ${name(view.pending?.owner || view.current_turn)}`;
    let body="";
    const p=view.pending;
    if (["round_end","game_over"].includes(view.phase)) title=view.phase==="game_over" ? "Game Over" : "Review · 等待全员确认";
    if (pendingSend) return '<div class="gah-command"><div class="gah-command-title" role="status">Sending…</div></div>';
    if (isActor && p) {
      const titles={bundle:"选择奖励处理顺序",food:`分配新餐点 · ${foodText(p.items)}`,any_food:`选择餐点 · 还可选 ${p.count} 份`, service:`厨房送餐 · 还可送 ${p.count} 份`,prepare:`🛏️ 准备房间 · 还可准备 ${p.count} 间`,occupy:`🧳 点选空房 · 还可入住 ${p.count} 间`,hire:"🧑‍🍳 选择要雇用的员工",guest:"🛎️ 点选市场客人 · 免费",complete:"🍽️ 选择要完成订单的客人",extra_die:"🎲 选择奖励骰子行动",return_offer:"选择放回牌库底的顺序",return_hand:"选择退回的员工手牌",remove_room:"选择要移除的最高楼层房间",remove_staff:"选择要移除的终局员工",penalty:"👑 皇帝惩罚"};
      title=titles[p.kind] || "处理奖励";
      if (["prepare","occupy","remove_room"].includes(p.kind)) body='<p class="gah-small">Select a highlighted room, then confirm on the overlay.</p>';
      else if (p.kind === "guest") body='<p class="gah-small">Select a guest from the queue, then Recruit.</p>';
      else if (p.kind !== "extra_die") {
        body=`<div class="gah-options" data-gah-scroll="options">${view.moves.filter(m=>m.type!=="skip").map(m=>m.staff ? staffCardHTML(m.staff,own(),m) : btn(esc(moveText(m)),m.type==="store_food"?"direct":"move","reward",false,`data-index="${moveIndex(m)}" class="${same(m,selected)?"gah-selected":""}"`)).join("")}</div>`;
      }
      const skip=moves("skip")[0];
      if (skip) body+=`<div class="gah-command-row">${btn("Skip","direct","reward",false,`data-index="${moveIndex(skip)}"`)}</div>`;
      const emperor=(view.emperor_review || []).find(r=>r.player_id===view.you&&!r.resolved);
      if (emperor) body=emperorReportHTML(emperor)+body;
    } else if (isActor && view.phase === "setup_guest") body='<p class="gah-small">Select one guest from the queue. No cost.</p>';
    else if (isActor && view.phase === "turn") {
      body=`<div class="gah-command-row">${["serve","end_turn","pass"].map(type=>{
        const m=moves(type)[0];
        return btn({serve:"Kitchen → Serve",end_turn:"End Turn",pass:"Pass"}[type],"direct",{serve:"serve",end_turn:"end",pass:"pass"}[type],!m,`data-index="${m?moveIndex(m):-1}"`);
      }).join("")}${moves("use_staff").map(m=>btn(`🔁 ${esc(view.catalog.staff[m.staff].name)}`,"direct","staff",false,`data-index="${moveIndex(m)}"`)).join("")}</div>`;
      if (selectedGuest && !selected) body+='<p class="gah-small">Select a highlighted vacant room to check in.</p>';
    }
    return `<div class="gah-command" aria-live="polite"><div class="gah-command-title">${esc(title)}</div>${selectionHost(body,"command")}</div>`;
  }

  function emperorEventHTML(index) {
    const round=[3,5,7][index], tile=view.catalog.emperors[view.emperors[index]];
    const [reward,penalty]=tile.text.split(" / ");
    return `<div class="gah-emperor-event"><strong>第 ${round} 轮 · 退 ${round} 格</strong><div class="gah-emperor-event-parts">${passive(`🎁 ${esc(reward)}`,`奖励(🎁)：第 ${round} 轮退格后位置至少为 3 时获得。${reward}。`,"gah-emperor-reward")}${passive(`⚠️ ${esc(penalty)}`,`惩罚(⚠️)：第 ${round} 轮退格后在 0 格时执行。${penalty}。`,"gah-emperor-penalty")}</div></div>`;
  }

  function emperorHTML() {
    const rounds=[3,5,7], reviewing=["round_end","game_over"].includes(view.phase);
    const scoredNow=rounds.includes(view.round)&&(reviewing||view.phase==="emperor");
    const index=scoredNow ? rounds.indexOf(view.round) : rounds.findIndex(r=>r>=view.round);
    const eventRound=rounds[index], retreat=scoredNow?0:eventRound;
    const settling=view.phase==="emperor";
    const tokens=players=>players.map(pl=>{
      const seat=view.players.indexOf(pl);
      return `<b class="gah-emperor-token gah-seat-${seat}">${seat+1}</b>`;
    }).join("");
    const points=view.catalog.emperor_points || [0,1,2,3,3,4,4,5,6,6,7,7,8,9];
    const cells=points.map((vp,position)=>{
      const players=view.players.filter(pl=>pl.emperor===position), after=Math.max(0,position-retreat);
      const outcome=after===0?"penalty":after<3?"neutral":"reward";
      const label={penalty:"⚠️ 惩罚",neutral:"➖ 中立",reward:"🎁 奖励"}[outcome];
      const tip=`声望(👑) ${position} 格，结算得分(⭐) ${vp}。${settling?"":scoredNow?`结算后区域：${label}。`:`按当前位置，第 ${eventRound} 轮退格后为 ${after}，${label}。`}${players.length?`此处玩家：${players.map(pl=>pl.name).join("、")}。`:""}`;
      return `<div class="gah-emperor-cell ${settling?"":`gah-zone-${outcome}`}" tabindex="0" title="${esc(tip)}" data-gah-tip="${esc(tip)}" data-gah-explain="tip" data-position="${position}" aria-label="${esc(tip)}"><strong>${position}</strong><small>⭐${vp}</small><span class="gah-emperor-tokens">${tokens(players)}</span></div>`;
    }).join("");
    return `<section class="gah-box gah-emperor-panel"><div class="gah-heading"><h3>${passive("👑 声望轨道",explanations.emperor)}</h3><span class="gah-small">${settling?`第 ${view.round} 轮结算中`:scoredNow?`第 ${view.round} 轮结算后`:`下次结算：第 ${eventRound} 轮`}</span></div><div class="gah-emperor-track">${cells}</div>
      <div class="gah-emperor-legend">${view.players.map(pl=>passive(`${tokens([pl])}<span>${esc(pl.name)} · ${pl.emperor}</span>`,`${pl.name}：声望(👑) ${pl.emperor}，轨道结算分(⭐) ${points[pl.emperor]}。`,"gah-emperor-player")).join("")}${passive(settling?"退格后：0 ⚠️ · 1–2 ➖ · ≥3 🎁":scoredNow?"底色：结算后区域":"底色：按当前位置预测奖惩",explanations.emperor,"gah-small")}</div>
      ${emperorEventHTML(index)}<details class="gah-emperor-future" id="grandAustriaEmperorEvents"><summary>All emperor events · 3 / 5 / 7</summary><div class="gah-emperor-event-list">${rounds.map((_,i)=>i===index?"":emperorEventHTML(i)).join("")}</div></details></section>`;
  }

  function emperorReportHTML(report) {
    if(!report)return "";
    const names={score:"⭐ 分数",money:"💰 克朗",emperor:"👑 声望",kitchen:"🍽️ 厨房餐点",served:"🍽️ 已送餐点",hand:"🃏 手牌",staff:"🧑‍🍳 员工",vacant:"🔑 空房",occupied:"🧳 入住房"};
    const labels={reward:"🎁 获得奖励",neutral:"➖ 中立",penalty:report.avoided?"🛡️ 已免罚":"⚠️ 皇室惩罚"};
    const tile=view.catalog.emperors[report.tile], rule=report.outcome==="neutral"?"本次不触发奖励或惩罚":tile.text.split(" / ")[report.outcome==="reward"?0:1];
    const changes=Object.entries(report.changes || {}).map(([key,n])=>`${names[key]} ${n>0?"+":"−"}${Math.abs(n)}`).join(" · ");
    const actual=report.resolved ? (changes || "资源未变化") : "等待完成选择";
    return `<div class="gah-emperor-report gah-outcome-${report.avoided?"neutral":report.outcome}" data-emperor-player="${esc(report.player_id)}"><div>${passive(`👑 ${report.position_before} → ${report.position_after_retreat} · ⭐ +${report.track_points}`,`第 ${report.round} 轮：先获得 ${report.track_points} 分(⭐)，再退 ${report.round} 格，从声望(👑) ${report.position_before} 到 ${report.position_after_retreat}。`)}</div><strong>${labels[report.outcome]}</strong><div class="gah-small">${esc(rule)}</div>${report.outcome!=="neutral"?`<div class="gah-emperor-actual">${report.resolved?"实际结算：":""}${esc(actual)}</div>`:""}</div>`;
  }

  function reviewHTML() {
    if (!["round_end","game_over"].includes(view.phase)) return "";
    const result=view.result;
    const rows=result?.ranking || view.review;
    const m=moves("next_round")[0];
    const content=`<div class="gah-heading"><h3>${result ? `🏆 ${result.winners.map(pid=>esc(name(pid))).join(" · ")}` : `第 ${view.round} 轮结算`}</h3>${view.phase!=="game_over" ? btn(view.next_ready.includes(view.you)?"Ready ✓":"Next Round","direct","next",!m||pendingSend,`data-index="${m?moveIndex(m):-1}" class="gah-primary"`) : ""}</div>
      <div class="gah-review-grid">${rows.map(r=>`<div class="gah-review-player"><strong>${esc(name(r.player_id))}</strong><div>⭐ ${r.score} ${result?"":`(${r.delta>=0?"+":""}${r.delta})`} ${view.next_ready.includes(r.player_id)?"✓":""}</div>${emperorReportHTML((view.emperor_review || []).find(e=>e.player_id===r.player_id))}${r.breakdown?`<dl>${Object.entries(r.breakdown).map(([k,v])=>`<dt>${{during_game:"对局得分",staff:"🧑‍🍳 员工",rooms:"🧳 楼层",resources:"💰 餐点与克朗",waiting_guests:"🛎️ 未入住客人"}[k]}</dt><dd>${v}</dd>`).join("")}</dl>`:""}</div>`).join("")}</div>
      ${view.phase!=="game_over"?`<p class="gah-small">Ready ${view.next_ready.length} / ${view.players.length}</p>`:""}`;
    return `<section class="gah-review">${content}</section>`;
  }

  function render() {
    if (!view) return;
    const opened=[...root.querySelectorAll("details[open]")].map(e=>e.id);
    const scrolled=[...root.querySelectorAll("[data-gah-scroll]")].map(e=>[e.dataset.gahScroll,e.scrollTop]);
    const focusId=document.activeElement?.id;
    const p=view.players.find(item=>item.player_id===inspected) || own() || view.players[0];
    const actor=view.pending?.owner || view.current_turn;
    const selectedOwn=p.player_id===view.you;
    const html=`<div class="gah-round"><strong>ROUND ${view.round} / 7</strong><span>${esc(phases[view.phase])}</span></div>
      <div class="gah-players">${view.players.map(pl=>btn(`<span class="gah-player-name"><strong>${esc(pl.name)}</strong><span>${pl.player_id===view.you?"You ":""}${pl.is_bot?"🤖":""}${pl.player_id===actor?" ⏳":""}</span></span>${statsHTML(pl)}`,"inspect","inspect",false,`class="gah-player ${pl.player_id===actor?"gah-active":""} ${p.player_id===pl.player_id?"gah-selected":""}" data-player="${esc(pl.player_id)}"`)).join("")}</div>
      ${reviewHTML()}
      ${emperorHTML()}
      <div class="gah-shared"><section class="gah-box"><div class="gah-heading"><h3>🎲 行动骰</h3>${passive("数量 = 基础强度",explanations.dice,"gah-small")}</div>${selectionHost(`<div class="gah-dice">${view.dice.map((count,i)=>{
        const available=view.moves.some(m=>["dice","bonus_die"].includes(m.type)&&m.face===i+1);
        return btn(`<span class="gah-die-face">${diceFaces[i]}</span><span class="gah-die-icons">${["🥐🍰","🍷☕","🛏️","💰👑","🧑‍🍳","✨"][i]}</span><span class="gah-die-count">× ${count}</span>`,"die","dice",!available,`class="gah-die ${selectedFace===i+1?"gah-selected":""}" data-face="${i+1}" aria-label="Die ${i+1}, ${count} available"`);
      }).join("")}</div>`,"dice")}</section><section class="gah-box"><div class="gah-heading"><h3>🛎️ 客人队列</h3>${passive(`🃏 ${view.guest_deck_count}`,"客人牌库剩余张数，顺序隐藏。","gah-small")}</div>${selectionHost(`<div class="gah-market">${view.market.map((gid,i)=>guestHTML(gid,null,i)).join("")}</div>`,"market")}</section></div>
      ${commandHTML()}
      <div class="gah-layout"><section class="gah-box"><div class="gah-heading"><h3>🛏️ 酒店</h3>${passive("🔑 空房 · 🧳 入住",explanations.room,"gah-small")}</div>${selectionHost(hotelHTML(p),"hotel")}</section>
      <section class="gah-box"><div class="gah-heading"><h3>☕ 咖啡厅 & 厨房</h3>${passive(`🃏 ${p.hand_count}`,"员工手牌数量。只有自己可查看自己的手牌。","gah-small")}</div><div class="gah-kitchen">${Object.entries(p.kitchen).map(([key,n])=>`<div class="gah-resource">${passive(`<b>${icons[key]} ${n}</b><span>${foodNames[key]}</span>`,`${foodNames[key]}(${icons[key]})：厨房库存。新餐点先免费分配；已有库存须使用送餐行动。`)}</div>`).join("")}</div>
      ${selectionHost(`<div class="gah-cafe">${[0,1,2].map(i=>p.cafe[i]?guestHTML(p.cafe[i].id,p.cafe[i]):'<div class="gah-empty" aria-label="Empty cafe table">🪑</div>').join("")}</div>`,"cafe")}
      <details class="gah-staff" id="grandAustriaHand"><summary>🃏 ${selectedOwn?"Your staff":"Staff hand"} · ${p.hand_count}</summary>${staffHTML(p,true)}</details>
      <details class="gah-staff" id="grandAustriaStaff"><summary>🧑‍🍳 In play · ${p.staff.length}${selectedOwn&&moves("use_staff").length?` · 🔁 ${moves("use_staff").length} available`:""}</summary>${staffHTML(p,false)}</details></section></div>
      <div class="gah-public">${view.objectives.map(oid=>{
        const m=moves("claim").find(x=>x.objective===oid), claimers=view.claims[oid];
        return `<section class="gah-box"><div class="gah-goal"><div class="gah-goal-text">${passive(`🎯 ${esc(view.catalog.objectives[oid].text)}`,explanations.objective)}<div class="gah-small">${[15,10,5].map((score,i)=>`${claimers[i]?esc(name(claimers[i])):"—"} ${score}⭐`).join(" · ")}</div></div>${btn(claimers.includes(view.you)?"Claimed ✓":"Claim","direct","objective",!m||pendingSend,`data-index="${m?moveIndex(m):-1}"`)}</div></section>`;
      }).join("")}</div>
      <details class="gah-log" id="grandAustriaLog"><summary>Activity log · ${view.log.length}</summary><ol>${view.log.slice().reverse().map(line=>`<li>${esc(line)}</li>`).join("")}</ol></details>`;
    root.innerHTML=html;
    opened.forEach(id=>{const el=document.getElementById(id);if(el)el.open=true;});
    scrolled.forEach(([key,top])=>{const el=root.querySelector(`[data-gah-scroll="${key}"]`);if(el)el.scrollTop=top;});
    if (focusId) document.getElementById(focusId)?.focus({preventScroll:true});
  }

  function resetSelection() { selected=null; selectedGuest=null; selectedFace=null; selectionContext=null; hideTip(); }
  function openDialog(title,content,html=false) {
    returnFocus=document.activeElement;
    document.getElementById("grandAustriaDialogTitle").textContent=title;
    document.getElementById("grandAustriaDialogBody").innerHTML=html?content:`<p>${esc(content)}</p>`;
    if(!dialog.open)dialog.showModal();
  }
  function showTip(target) {
    if(!target?.dataset.gahTip)return;
    clearTimeout(tipTimer);tip.textContent=target.dataset.gahTip;tip.hidden=false;
    const r=target.getBoundingClientRect();
    tip.style.left=`${Math.max(12,Math.min(r.left,window.innerWidth-tip.offsetWidth-12))}px`;
    tip.style.top=`${Math.max(12,Math.min(r.bottom+8,window.innerHeight-tip.offsetHeight-12))}px`;
    tipTimer=setTimeout(hideTip,3000);
  }
  function hideTip(){tip.hidden=true;clearTimeout(tipTimer);}
  function submit(action=selected) {
    if(!action||pendingSend||!view.moves.some(m=>same(m,action)))return;
    pendingSend=true;resetSelection();render();sendAction(action);
    clearTimeout(pendingTimer);pendingTimer=setTimeout(()=>{pendingSend=false;render();},7000);
  }
  root.addEventListener("click",event=>{
    const button=event.target.closest("[data-gah-action]");
    if(!button){const t=event.target.closest("[data-gah-tip]");if(t)showTip(t);return;}
    if(button.disabled||pendingSend)return;
    const action=button.dataset.gahAction;
    if(action==="confirm"){submit();return;}
    if(action==="direct"){
      const move=view.moves[Number(button.dataset.index)];
      if(move)submit(move);
      return;
    }
    if(action==="cancel"){resetSelection();render();return;}
    if(action==="inspect"){inspected=button.dataset.player;resetSelection();render();return;}
    selectionContext=button.closest("[data-gah-selection-host]")?.dataset.gahSelectionHost || "command";
    selectedFace=null;
    if(action!=="room"&&action!=="guest")selectedGuest=null;
    if(action==="move")selected=view.moves[Number(button.dataset.index)]||null;
    if(action==="die"){
      selectedFace=Number(button.dataset.face);dieTarget=Math.min(5,selectedFace);dieBoost=false;dieSplit=0;dieTiming="after";selectedGuest=null;
    }
    if(action==="market"){
      const slot=Number(button.dataset.slot);
      selected=view.moves.find(m=>["recruit","take_guest"].includes(m.type)&&m.slot===slot)||null;
      if(!selected){const g=card(button.dataset.guest);openDialog(g.name,`${colorNames[g.color]}(${icons[g.color]}) · ${foodText(g.order)} · ⭐ ${g.vp}。${rewardText(g)}`);return;}
    }
    if(action==="guest"){
      selectedGuest=button.dataset.guest;selected=null;
      if(!moves("check_in").some(m=>m.guest===selectedGuest)){
        const g=card(selectedGuest);openDialog(g.name,`${foodText(g.order)} · ⭐ ${g.vp}。${rewardText(g)}`);return;
      }
    }
    if(action==="room"){
      const rid=Number(button.dataset.room);
      selected=view.moves.find(m=>m.room===rid&&(m.type!=="check_in"||m.guest===selectedGuest))||null;
      if(!selected || inspected && inspected!==view.you){selected=null;openDialog(`Room ${Math.floor(rid/5)+1}${rid%5+1}`,explanations.room);return;}
    }
    if(action==="staff"){
      const sid=button.dataset.staff;
      selected=view.moves.find(m=>m.staff===sid)||null;
      if(!selected){const s=view.catalog.staff[sid];openDialog(s.name,`💰 ${s.cost} · ${staffTimings[s.timing].text} ${s.text}`);return;}
    }
    render();
    root.querySelector(".gah-selection-overlay")?.scrollIntoView({block:"nearest"});
    if(event.detail===0)root.querySelector('.gah-selection-overlay [data-gah-action="confirm"]')?.focus({preventScroll:true});
  });
  root.addEventListener("change",event=>{
    if(event.target.id==="grandAustriaDieTarget")dieTarget=Number(event.target.value);
    if(event.target.id==="grandAustriaBoost")dieBoost=event.target.checked;
    if(event.target.id==="grandAustriaSplit")dieSplit=Number(event.target.value);
    if(event.target.id==="grandAustriaTiming")dieTiming=event.target.value;
    render();
  });
  root.addEventListener("pointerover",e=>{if(e.pointerType!=="touch"&&!gahExplainWidget?.isActive())showTip(e.target.closest("[data-gah-tip]"));});
  root.addEventListener("pointerout",hideTip);
  root.addEventListener("focusin",e=>{if(!gahExplainWidget?.isActive())showTip(e.target.closest("[data-gah-tip]"));});
  document.addEventListener("scroll",hideTip,true);window.addEventListener("resize",hideTip);
  root.addEventListener("pointerdown",e=>{
    if(e.target.closest("button,input,select,summary,a,[data-gah-tip],.gah-selection-sheet")||(!selected&&!selectedGuest&&selectedFace===null))return;
    resetSelection();render();
  });
  document.getElementById("grandAustriaClose").addEventListener("click",()=>dialog.close());
  dialog.addEventListener("close",()=>{suppressedUntil=0;hideTip();if(returnFocus?.isConnected)returnFocus.focus();});
  dialog.addEventListener("click",e=>{const r=dialog.getBoundingClientRect();if(e.target===dialog&&(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom))dialog.close();});
  const active=()=>!!view&&!panel.classList.contains("hidden");
  document.addEventListener("keydown",e=>{
    if(!active())return;
    if(e.key==="Escape"){hideTip();gahExplainWidget?.exit();if(!dialog.open){resetSelection();render();}}
  },true);
  function clearState(){view=null;inspected=null;pendingSend=false;clearTimeout(pendingTimer);resetSelection();gahExplainWidget?.exit();root.innerHTML="";if(dialog.open)dialog.close();}
  window.renderGrandAustriaGameState=data=>{
    const next=data?.view;if(!next||next.game_id!=="grand_austria_hotel")return;
    if(view?.revision!==next.revision){resetSelection();pendingSend=false;clearTimeout(pendingTimer);}
    view=next;if(!next.players.some(p=>p.player_id===inspected))inspected=own()?.player_id||next.players[0].player_id;render();
  };
  window.showGrandAustriaHeaderActions=visible=>{
    header.style.display=visible?"flex":"none";
    helpBtn.classList.toggle("hidden",!visible);explainBtn.classList.toggle("hidden",!visible);
    if(!visible)clearState();
    if(typeof syncRoomControlsExplainButton==="function")syncRoomControlsExplainButton();
  };
  window.clearGrandAustriaState=clearState;
  function connect(){
    if(typeof socket!=="undefined"){
      socket.on("system:error",()=>{if(pendingSend){pendingSend=false;clearTimeout(pendingTimer);render();}});
      socket.on("room:state",state=>{if(state.game_type!=="grand_austria_hotel"||state.status==="lobby")clearState();});
    }
    if(typeof currentRoomState!=="undefined"&&currentRoomState?.game_type==="grand_austria_hotel"){
      if(typeof lastGameStatePayload!=="undefined"&&lastGameStatePayload?.game_type==="grand_austria_hotel")window.renderGrandAustriaGameState(lastGameStatePayload);
    }
  }
  initGahHelpExplain();
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",connect,{once:true});else connect();
})();
