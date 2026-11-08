(() => {
  "use strict";
  const panel = document.getElementById("nightNinjaPanel");
  const surface = document.getElementById("nnSurface");
  const header = document.getElementById("nightNinjaHeaderActions");
  const helpButton = document.getElementById("nightNinjaHelpBtn");
  const explainButton = document.getElementById("nightNinjaExplainBtn");
  const dialog = document.getElementById("nightNinjaDialog");
  const tip = document.getElementById("nnTooltip");
  const phases = ["spy", "mystic", "trickster", "blind_assassin", "shinobi"];
  const phaseNames = {spy: "👁️ 密探", mystic: "🔮 秘术师", trickster: "🎭 百变者", blind_assassin: "🗡️ 盲刺客", shinobi: "🥷 上忍", house_reveal: "🌅 揭晓"};
  const effects = {
    spy: ["查看一人身份", "密探 (👁️ Spy)：查看另一人的家族与位阶，只有你能看见结果。"],
    mystic: ["身份与忍者牌", "秘术师 (🔮 Mystic)：查看另一人的家族与位阶，以及其手中随机一张尚未亮出的忍者牌。"],
    shapeshifter: ["秘密交换身份", "换形师 (🔀 Shapeshifter)：看两人的身份，可秘密交换或保持。目标可包含自己或死者；被选中的人不能自由重看身份，不论是否交换都会标记为不确定。"],
    gravedigger: ["从暗弃牌中取一张", "掘墓人 (🪦 Gravedigger)：随机查看两张暗弃牌，选择一张立即发动或保留到适当阶段。镜僧、殉道者和幕后主使必须保留到各自时机。"],
    troublemaker: ["查看并可公开身份", "捣乱者 (📣 Troublemaker)：查看另一人身份，可选择公开给所有人，或保持秘密。"],
    spirit_merchant: ["查看并交换荣誉", "灵魂商人 (⚖️ Spirit Merchant)：查看另一人的身份或一枚荣誉 (🌟)，之后可交换双方各一枚荣誉；不必交换刚看过的那枚。"],
    thief: ["公开身份并偷荣誉", "盗贼 (💰 Thief)：先公开自己的身份，再从荣誉 (🌟) 枚数比你多的玩家处取一枚。比较枚数，不比较隐藏分数；没有目标时只公开身份。"],
    judge: ["无法反击的刺杀", "判官 (⚔️ Judge)：先公开自己的身份，再杀死一名存活玩家。镜僧 (🪞) 与殉道者 (🌟) 不能响应。"],
    blind_assassin: ["直接刺杀一人", "盲刺客 (🗡️ Blind Assassin)：选择一名存活玩家并刺杀，对方可以使用镜僧或殉道者响应。"],
    shinobi: ["查看身份后决定刺杀", "上忍 (🥷 Shinobi)：选择存活玩家，秘密查看身份后决定刺杀或放过。可查看自己，用于重新确认被换形师影响后的身份。"],
    mirror_monk: ["反杀刺客，自己存活", "镜僧 (🪞 Mirror Monk)：被盲刺客 (🗡️) 或上忍 (🥷) 刺杀时亮出，自己不死，改为杀死刺客。反杀不会再触发镜僧或殉道者。"],
    martyr: ["死亡时获得荣誉", "殉道者 (🌟 Martyr)：被盲刺客 (🗡️) 或上忍 (🥷) 刺杀时亮出，获得一枚荣誉 (🌟) 后死亡。"],
    mastermind: ["存活即决定胜方", "幕后主使 (🧠 Mastermind)：夜晚结束时若仍存活，可以亮出，让自己当前所属家族获胜。浪人 (🟠) 亮出则两家都不得分，浪人自己仍因存活得到荣誉。"],
  };
  const details = {
    house: "家族：仙鹤 (🟢) 与莲花 (🔴) 每轮重新分配；1 是大当家、2 是二当家，数字越小位阶越高。浪人 (🟠) 独立行动，存活即获得荣誉。身份不确定时显示的是原先记忆，不代表真实当前身份。",
    honor: "荣誉 (🌟 Honor)：每枚值 2、3 或 4 分，面值仅本人知道，枚数公开。轮末达到 10 分者中最高分获胜，同分共享胜利。本线上版采用三个面值等概率独立抽取；官方规则未注明实体配比。",
    draft: "先从三张忍者牌中选择一张，其余传给左邻；再从收到的两张中选一张，剩余暗弃。全部玩家完成后一起进入下一步。",
    reveal: "选择要在当前阶段亮出的全部忍者牌，再按 Reveal Selected；不使用可按 Pass。全员提交后同时亮牌，按 1–6 顺序执行；跳过的牌不能在更晚阶段再用。",
    target: "选择本张忍者牌的目标，再按 Confirm Target。换形师需要两名不同玩家；刺杀只能选择存活者。",
    decide: "根据私有情报完成这张牌的选择。秘密信息不会出现在公共日志中，确认后继续结算下一张牌。",
    react: "你正被刺杀。镜僧 (🪞) 反杀刺客，殉道者 (🌟) 获得荣誉后死亡，Accept 则接受死亡。响应只允许本人操作，死亡暂不公开身份。",
    next: "Next Round 表示你已看完结果；所有席位（包括死者）都确认后才开始下一轮。真人断线需重连确认，机器人只确认自己。",
    player: "玩家席位：💀 表示本轮死亡，🂠 是未亮出忍者牌的数量，🌟 是荣誉枚数，✓ 表示已提交当前选择。死者不再主动行动，但所属家族获胜时仍能得荣誉。",
    notes: "私有情报 (🔒)：保存本轮看过的身份和忍者牌，仅你可见。换形师可能改变身份，相关记录会标为不确定；忍者牌只是查看时的记录。",
    table: "已亮出的忍者牌按使用顺序记录。Queued 等待结算，Acting 正在选择，Done 已完成，Cancelled 表示持有者先死亡，效果取消。",
    result: "比较双方存活成员位阶，从最高位开始逐项比较，胜方全员得荣誉。完全平手则仅存活者得荣誉。浪人存活独立得一枚，幕后主使可覆盖一般胜负。线上轮末同时公开死者身份供复盘。",
    phase: "夜晚顺序：密探 (👁️) → 秘术师 (🔮) → 百变者 (🎭) → 盲刺客 (🗡️) → 上忍 (🥷)。每阶段同时亮牌，再按编号从 1 到 6 结算。",
  };
  let view = null, selected = [], targets = [], mode = "house", tokenIndex = 0, ownIndex = 0;
  let signature = null, busy = false, busyTimer = null, tipTimer = null, returnFocus = null;
  const esc = text => String(text ?? "").replace(/[&<>"']/g, ch => ({"&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"}[ch]));
  const name = pid => view?.players.find(p => p.player_id === pid)?.name || "—";
  const card = id => view?.catalog.find(c => c.id === id);
  const cardLabel = id => { const c = card(id); return c ? `${c.emoji} ${c.zh}${c.rank ? ` · ${c.rank}` : ""}` : "No card"; };
  const houseLabel = h => h ? `${{crane:"🟢 仙鹤",lotus:"🔴 莲花",ronin:"🟠 浪人"}[h.clan]}${h.rank ? ` · ${["", "大当家", "二当家", "三当家", "四当家", "五当家"][h.rank]}` : ""}` : "🎭 Hidden";
  const explanation = key => effects[key]?.[1] || details[key] || "";
  const info = (text, key, extra = "") => `<span tabindex="0" data-nn-tip="${esc(explanation(key))}" data-nn-explain="${key}" ${extra}>${esc(text)}</span>`;
  const houseChip = h => info(houseLabel(h), "house", `class="nn-house nn-house-${h?.clan || "hidden"}"`);
  const allowed = type => !busy && view?.legal_actions.includes(type) && (typeof socket === "undefined" || socket.connected);
  const activeKind = () => card(view?.active?.card_id)?.kind;
  const button = (label, action, key, enabled = true, style = "") => `<button type="button" data-nn-action="${action}" data-nn-explain="${key}" class="${style}" ${!enabled || busy ? "disabled" : ""}>${esc(label)}</button>`;

  function clearSelection() { selected = []; targets = []; mode = "house"; tokenIndex = 0; ownIndex = 0; }
  function hideTip() { tip.hidden = true; clearTimeout(tipTimer); }
  function showTip(el, temporary = false) {
    if (!el?.dataset.nnTip || nightNinjaExplainWidget?.isActive() || nightNinjaHelpWidget?.isOpen()) return;
    hideTip(); tip.textContent = el.dataset.nnTip; tip.hidden = false;
    const r = el.getBoundingClientRect(), t = tip.getBoundingClientRect();
    tip.style.left = `${Math.max(8, Math.min(r.left, innerWidth - t.width - 8))}px`;
    tip.style.top = `${Math.max(8, Math.min(r.top - t.height - 8 > 8 ? r.top - t.height - 8 : r.bottom + 8, innerHeight - t.height - 8))}px`;
    if (temporary) tipTimer = setTimeout(hideTip, 3000);
  }
  const NN_EXPLAIN = {
    spy: { zh: effects.spy[1], en: "Spy (👁️): look at another player's clan and rank. Only you see the result." },
    mystic: { zh: effects.mystic[1], en: "Mystic (🔮): look at another player's clan and rank, plus one random Ninja card still hidden in their hand." },
    shapeshifter: { zh: effects.shapeshifter[1], en: "Shapeshifter (🔀): look at two players' identities and secretly swap them or leave them alone. The targets may include yourself or the dead, a chosen player cannot freely re-check their identity, and they are marked uncertain whether or not you swap." },
    gravedigger: { zh: effects.gravedigger[1], en: "Gravedigger (🪦): look at two random face-down discards and either play one immediately or hold it for the right phase. Mirror Monk, Martyr and Mastermind must be held for their own timing." },
    troublemaker: { zh: effects.troublemaker[1], en: "Troublemaker (📣): look at another player's identity and either reveal it to everyone or keep it secret." },
    spirit_merchant: { zh: effects.spirit_merchant[1], en: "Spirit Merchant (⚖️): look at another player's identity or one honor token (🌟), then optionally swap one token each way. You need not swap the token you just looked at." },
    thief: { zh: effects.thief[1], en: "Thief (💰): reveal your own identity first, then take one token from a player holding more honor tokens (🌟) than you. Counts are compared, not hidden scores, and with no valid target you only reveal." },
    judge: { zh: effects.judge[1], en: "Judge (⚔️): reveal your own identity first, then kill one living player. Mirror Monk (🪞) and Martyr (🌟) cannot respond." },
    blind_assassin: { zh: effects.blind_assassin[1], en: "Blind Assassin (🗡️): choose a living player and assassinate them. The target may respond with Mirror Monk or Martyr." },
    shinobi: { zh: effects.shinobi[1], en: "Shinobi (🥷): choose a living player, secretly check their identity, then decide to kill or spare. You may inspect yourself to re-confirm an identity changed by the Shapeshifter." },
    mirror_monk: { zh: effects.mirror_monk[1], en: "Mirror Monk (🪞): reveal when assassinated by the Blind Assassin (🗡️) or Shinobi (🥷), survive, and kill the assassin instead. That counter-kill never triggers Mirror Monk or Martyr again." },
    martyr: { zh: effects.martyr[1], en: "Martyr (🌟): reveal when assassinated by the Blind Assassin (🗡️) or Shinobi (🥷), gain one honor token (🌟), then die." },
    mastermind: { zh: effects.mastermind[1], en: "Mastermind (🧠): if you are still alive when the night ends you may reveal yourself and make your current clan win. A revealed Ronin (🟠) blocks both clans instead, while the Ronin still gains honor for surviving." },
    house: { zh: details.house, en: "Clans: Crane (🟢) and Lotus (🔴) are reassigned every round, where 1 is the boss and 2 the second, so a lower number is a higher rank. The Ronin (🟠) acts alone and gains honor for surviving. When an identity is uncertain the display shows your earlier memory, not the true current identity." },
    honor: { zh: details.honor, en: "Honor (🌟): each token is worth 2, 3 or 4 points, only you know the value and the count is public. At the end of a round whoever among those at 10 points scores highest wins, and a tie is shared. This online build draws the three values independently with equal probability because the official rules do not state a physical distribution." },
    draft: { zh: details.draft, en: "Draft: pick one of three Ninja cards and pass the rest to your left, then pick one of the two you receive and discard the other face down. Everyone moves on together once all players are done." },
    reveal: { zh: details.reveal, en: "Reveal: select every Ninja card you want to play this phase and press Reveal Selected, or press Pass to play nothing. All cards flip at once and resolve in order from 1 to 6, and a card you skip cannot be used in a later phase." },
    target: { zh: details.target, en: "Target: choose the target for this Ninja card and press Confirm Target. The Shapeshifter needs two different players, and an assassination may only target a living player." },
    decide: { zh: details.decide, en: "Decide: finish this card's choice using your private information. Secret information never appears in the public log, and the next card resolves once you confirm." },
    react: { zh: details.react, en: "React: you are being assassinated. Mirror Monk (🪞) kills the assassin instead, Martyr (🌟) gains honor and then dies, and Accept takes the death. Only you may respond, and the death does not reveal identities yet." },
    next: { zh: details.next, en: "Next Round means you have read the result, and the next round starts only once every seat including the dead has confirmed. A disconnected human must reconnect to confirm while bots confirm only for themselves." },
    player: { zh: details.player, en: "Player seat: 💀 means dead this round, 🂠 is the number of unrevealed Ninja cards, 🌟 is the honor token count and ✓ means the current choice is submitted. The dead no longer act but still gain honor when their clan wins." },
    notes: { zh: details.notes, en: "Private intel (🔒): stores the identities and Ninja cards you have seen this round and is visible only to you. The Shapeshifter may change an identity so those records are marked uncertain, and Ninja cards are only a record of what you saw." },
    table: { zh: details.table, en: "Revealed Ninja cards are listed in the order they were used. Queued is waiting to resolve, Acting is choosing right now, Done is finished and Cancelled means the holder died first so the effect was voided." },
    result: { zh: details.result, en: "Compare the ranks of each side's surviving members from the highest rank down, and every member of the winning side gains honor. A complete tie gives honor only to the survivors. A surviving Ronin gains one token independently and the Mastermind can override the normal outcome. This online build reveals the dead players' identities at the end of the round for review." },
    phase: { zh: details.phase, en: "Night order: Spy (👁️), Mystic (🔮), Trickster (🎭), Blind Assassin (🗡️), Shinobi (🥷). Every phase reveals cards at the same time and then resolves them in number order from 1 to 6." },
    dialog_close: { zh: "关闭当前对话框并回到牌桌。", en: "Close the current dialog and return to the table." }
  };
  const nnCards = lang => Object.keys(effects).map(key => {
    const text = lang === "en" ? NN_EXPLAIN[key].en : effects[key][1];
    const cut = lang === "en" ? text.indexOf(": ") : text.indexOf("：");
    const head = cut < 0 ? text : text.slice(0, cut);
    const body = cut < 0 ? "" : text.slice(cut + (lang === "en" ? 2 : 1));
    return `<div class="nn-help-card"><strong>${esc(head)}</strong><p>${esc(body)}</p></div>`;
  }).join("");
  const NIGHT_NINJA_HELP_CONFIG = {
    gameId: "night_of_the_ninja",
    title: { zh: "忍者杀 · Night of the Ninja", en: "Night of the Ninja" },
    basic: {
      win: {
        zh: "为家族争胜，也为自己积累荣誉(🌟)。轮末达到 10 分的玩家中分数最高者获胜，同分共享胜利。",
        en: "Win for your clan while collecting honor (🌟) for yourself. At the end of a round the highest scorer among those at 10 points wins, and a tie is shared."
      },
      turn: {
        zh: "每轮先传牌选牌，夜晚再按密探(👁️)、秘术师(🔮)、百变者(🎭)、盲刺客(🗡️)、上忍(🥷)五个阶段同时亮牌并按编号结算，你只在自己需要行动时做选择。",
        en: "Each round you draft cards, then the night runs through the Spy (👁️), Mystic (🔮), Trickster (🎭), Blind Assassin (🗡️) and Shinobi (🥷) phases where everyone reveals at once and cards resolve in number order, and you only act when a choice is yours."
      },
      key: {
        zh: "你的身份每轮重新分配而且可能被换形师(🔀)悄悄改掉，所以关键是分清哪些情报仍然可靠，并让家族的存活成员位阶压过对方。",
        en: "Your identity is reassigned every round and the Shapeshifter (🔀) may quietly change it, so the real skill is telling which intel is still trustworthy and making your clan's surviving ranks beat the other side."
      }
    },
    sections: [
      {
        id: "identity",
        label: { zh: "身份与胜利", en: "Identity and victory" },
        html: { zh: `<p>${esc(details.house)}</p><p>${esc(details.honor)}</p>`, en: `<p>${esc(NN_EXPLAIN.house.en)}</p><p>${esc(NN_EXPLAIN.honor.en)}</p>` }
      },
      {
        id: "night",
        label: { zh: "选牌与夜晚", en: "Draft and night" },
        html: {
          zh: `<p>${esc(details.draft)}</p><p>${esc(details.phase)}</p><p>${esc(details.reveal)}</p><p>33 张牌：密探、秘术师、百变者、盲刺客、上忍各 6 张，各阶段的编号从 1 到 6。另有镜僧、殉道者、幕后主使各 1 张。每轮重新使用全副牌。</p>`,
          en: `<p>${esc(NN_EXPLAIN.draft.en)}</p><p>${esc(NN_EXPLAIN.phase.en)}</p><p>${esc(NN_EXPLAIN.reveal.en)}</p><p>There are 33 cards: six each of Spy, Mystic, Trickster, Blind Assassin and Shinobi, numbered 1 to 6 within their phase, plus one each of Mirror Monk, Martyr and Mastermind. The full deck is reused every round.</p>`
        }
      },
      {
        id: "cards",
        label: { zh: "忍者牌图鉴", en: "Ninja card catalogue" },
        html: { zh: nnCards("zh"), en: nnCards("en") }
      },
      {
        id: "death",
        label: { zh: "死亡与轮末", en: "Death and round end" },
        html: {
          zh: `<p>${esc(details.player)}</p><p>${esc(details.result)}</p><p>${esc(details.next)}</p><p>只在轮末检查是否达到 10 分，不在偷取或殉道时提前结束。没有存活者且未达到胜利分数时，没有人获得轮末荣誉，继续下一轮。</p>`,
          en: `<p>${esc(NN_EXPLAIN.player.en)}</p><p>${esc(NN_EXPLAIN.result.en)}</p><p>${esc(NN_EXPLAIN.next.en)}</p><p>The 10 point check happens only at the end of a round and never early on a theft or a martyrdom. If nobody survives and nobody has reached the winning score, no end of round honor is awarded and play continues.</p>`
        }
      },
      {
        id: "online",
        label: { zh: "线上操作与信息", en: "Online notes" },
        html: {
          zh: `<p>${esc(details.notes)}</p><p>${esc(details.table)}</p><p>点选牌与目标后确认，点击空白处或按 Esc 取消未提交的选择。非操作图标支持悬停或触屏点击提示，手机提示三秒后消失。</p><p>规则依据 Brotherwise Games 官方规则书与 FAQ。线上适配：荣誉 2、3、4 等概率独立抽取，轮末公开所有身份供复盘，同时行动与反应使用明确提交而不设抢答倒计时。标准多人版，不包含双人变体。</p>`,
          en: `<p>${esc(NN_EXPLAIN.notes.en)}</p><p>${esc(NN_EXPLAIN.table.en)}</p><p>Select cards and targets, then confirm, and click blank space or press Esc to drop an unsubmitted choice. Non-interactive icons can be hovered or tapped for a tip, and a tip on a phone disappears after three seconds.</p><p>Rules follow the official Brotherwise Games rulebook and FAQ. Online adaptations: honor values 2, 3 and 4 are drawn independently with equal probability, all identities are revealed at the end of the round for review, and simultaneous actions and reactions use explicit submissions with no countdown race. This is the standard multiplayer game without the two player variant.</p>`
        }
      }
    ]
  };
  let nightNinjaHelpWidget = null;
  let nightNinjaExplainWidget = null;
  function initNightNinjaHelpExplain() {
    if (nightNinjaHelpWidget || typeof window.obgCreateHelp !== "function") return;
    nightNinjaHelpWidget = window.obgCreateHelp(NIGHT_NINJA_HELP_CONFIG);
    nightNinjaExplainWidget = window.obgCreateExplain({
      gameId: "night_of_the_ninja",
      attribute: "data-nn-explain",
      explanations: NN_EXPLAIN,
      button: explainButton,
      root: () => panel,
      bypass: ["#nightNinjaHelpBtn", "#nightNinjaExplainBtn", "#nnDialogClose"]
    });
    helpButton?.addEventListener("click", () => {
      nightNinjaExplainWidget?.exit();
      nightNinjaHelpWidget.open();
    });
    explainButton?.addEventListener("click", () => nightNinjaExplainWidget?.toggle());
  }
  function renderCards(cards, selectable) {
    return `<div class="nn-cards" data-nn-scroll="cards">${cards.map(c => `<button type="button" class="nn-card ${selected.includes(c.id) ? "is-selected" : ""}" data-nn-card="${c.id}" data-kind="${c.kind}" data-nn-explain="${c.kind}" aria-pressed="${selected.includes(c.id)}" ${!selectable(c) || busy ? "disabled" : ""}>
      <span class="nn-card-top"><b>${c.rank || "✦"}</b><small>${c.phase === "special" ? "SPECIAL" : esc(phaseNames[c.phase])}</small></span><span class="nn-card-icon" aria-hidden="true">${c.emoji}</span><strong>${esc(c.zh)}</strong><small>${esc(c.name)}</small><span class="nn-card-caption">${esc(effects[c.kind][0])}</span></button>`).join("")}</div>`;
  }
  function tokenSelect(id, label, count, current, own = false) {
    return `<div class="nn-field"><label for="${id}">${label}</label><select id="${id}" data-nn-explain="honor" ${!count || busy ? "disabled" : ""}>${count ? Array.from({length:count}, (_, i) => `<option value="${i}" ${current === i ? "selected" : ""}>Token ${i+1}${own ? ` · 🌟 ${view.honor[i]}` : " · 🌟 ?"}</option>`).join("") : '<option>No tokens</option>'}</select></div>`;
  }
  function renderDecision() {
    const legal = view.legal_actions[0], pending = view.pending;
    const submitted = view.submitted.includes(view.you);
    if (view.phase === "round_end" || view.phase === "game_over") return renderResult();
    let html = `<div class="nn-heading-row"><h3>${view.phase === "draft" ? `DRAFT · PICK ${view.draft_step} OF 2` : "YOUR NEXT MOVE"}</h3><span>${view.active ? esc(cardLabel(view.active.card_id)) : esc(phaseNames[view.night_phase])}</span></div>`;
    if (legal === "draft") {
      html += renderCards(view.packet, () => allowed("draft"));
      html += `<div class="nn-actions">${button("Keep Selected", "draft", "draft", selected.length === 1 && allowed("draft"), "nn-primary")}</div>`;
    } else if (legal === "reveal") {
      html += `<p class="nn-muted">Select cards for this phase, or pass.</p>`;
      html += renderCards(view.hand, c => allowed("reveal") && c.phase === view.night_phase);
      html += `<div class="nn-actions">${button(selected.length ? "Reveal Selected" : "Pass", "reveal", "reveal", allowed("reveal"), "nn-primary")}</div>`;
    } else if (legal === "target") {
      const kind = activeKind(), target = view.players.find(p => p.player_id === targets[0]);
      html += `<p class="nn-muted">${kind === "shapeshifter" ? "Select two players." : "Select a player."}</p><div class="nn-targets">${view.players.map(p => `<button type="button" data-nn-target="${esc(p.player_id)}" data-nn-explain="target" aria-pressed="${targets.includes(p.player_id)}" ${!view.targets.includes(p.player_id) || busy ? "disabled" : ""}>${esc(p.name)}${p.player_id === view.you ? " · You" : ""}${!p.alive ? " 💀" : ""}</button>`).join("")}</div>`;
      if (kind === "spirit_merchant") html += `<div class="nn-field"><label for="nnMode">Inspect</label><select id="nnMode" data-nn-explain="spirit_merchant"><option value="house" ${mode === "house" ? "selected" : ""}>🎭 House</option><option value="honor" ${mode === "honor" ? "selected" : ""}>🌟 Honor token</option></select></div>`;
      const needsToken = kind === "thief" || (kind === "spirit_merchant" && mode === "honor");
      if (needsToken) html += tokenSelect("nnToken", "Their token", target?.honor_count || 0, tokenIndex);
      html += `<div class="nn-actions">${button("Confirm Target", "target", "target", allowed("target") && targets.length === (kind === "shapeshifter" ? 2 : 1) && (!needsToken || target?.honor_count > 0), "nn-primary")}</div>`;
    } else if (legal === "decide") {
      const kind = pending.kind;
      if (pending.observations || pending.seen_honor !== undefined) html += `<div class="nn-peek"><b>${info("🔒 Private Intel", "notes")}</b>${(pending.observations || []).map(n => `<p>${esc(name(n.target))}<br>${houseChip(n.house)}</p>`).join("")}${pending.seen_card !== undefined ? `<p>${info(cardLabel(pending.seen_card), card(pending.seen_card)?.kind || "notes")}</p>` : ""}${pending.seen_honor !== undefined ? `<p>${esc(name(pending.targets[0]))} · Token ${pending.seen_index+1} · ${info(`🌟 ${pending.seen_honor}`, "honor")}</p>` : ""}</div>`;
      if (kind === "gravedigger" && pending.options.length) html += renderCards(pending.options.map(card), () => allowed("decide"));
      if (kind === "spirit_merchant") {
        html += tokenSelect("nnOwnToken", "Your token", view.honor.length, ownIndex, true);
        html += tokenSelect("nnToken", "Their token", view.players.find(p => p.player_id === pending.targets[0]).honor_count, tokenIndex);
      }
      const choices = {spy: [["Continue", "continue"]], mystic: [["Continue", "continue"]], shinobi: [["Spare", "spare"], ["Kill", "kill"]], shapeshifter: [["Keep Houses", "keep"], ["Swap Houses", "swap"]], troublemaker: [["Keep Secret", "conceal"], ["Reveal House", "reveal"]], spirit_merchant: [["Keep Tokens", "keep"], ["Swap Tokens", "swap"]], gravedigger: pending.options?.length ? [["Keep for Later", "hold"], ["Play Now", "play"]] : [["Continue", "continue"]]}[kind];
      html += `<div class="nn-actions">${choices.map(([label, choice]) => {
        let enabled = allowed("decide");
        if (kind === "gravedigger" && pending.options.length) enabled &&= selected.length === 1 && (choice !== "play" || card(selected[0]).phase !== "special");
        if (kind === "spirit_merchant" && choice === "swap") enabled &&= view.honor.length > 0 && view.players.find(p => p.player_id === pending.targets[0]).honor_count > 0;
        return button(label, `decide:${choice}`, kind, enabled, choice === "kill" ? "nn-danger" : "nn-primary");
      }).join("")}</div>`;
    } else if (legal === "react") {
      html += `<div class="nn-peek">${esc(name(pending.attacker))} → ${esc(name(view.you))}<br>Choose your response.</div>`;
      html += `<div class="nn-actions">${button("🪞 Mirror Monk", "react:mirror_monk", "mirror_monk", view.hand.some(c => c.kind === "mirror_monk"))}${button("🌟 Martyr", "react:martyr", "martyr", view.hand.some(c => c.kind === "martyr"))}${button("Accept", "react:accept", "react", true, "nn-danger")}</div>`;
    } else if (legal === "mastermind") {
      html += `<p class="nn-muted">The night is over. Reveal a surviving Mastermind, or continue.</p><div class="nn-actions">${button("Continue", "mastermind:no", "result", true)}${button("🧠 Reveal Mastermind", "mastermind:yes", "mastermind", view.hand.some(c => c.kind === "mastermind"), "nn-primary")}</div>`;
    } else {
      html += `<p class="nn-muted">${submitted ? "Submitted. Waiting for the table." : view.current_turn ? `${esc(name(view.current_turn))} is resolving ${esc(cardLabel(view.active?.card_id))}.` : "Waiting for the table."}</p>`;
      if (view.hand.length) html += renderCards(view.hand, () => false);
      if (view.phase === "draft" && submitted) html += renderCards(view.packet, () => false);
    }
    return html;
  }
  function renderResult() {
    const s = view.round_summary;
    const winner = view.game_over ? view.winner.map(name).join(" / ") : s.winning_clan === "ronin" ? "浪人阻止两家获胜" : s.winning_clan ? `${houseLabel({clan:s.winning_clan,rank:0})} 获胜` : "家族平手";
    return `<h3>${view.game_over ? "GAME OVER" : "ROUND REVIEW"}</h3><strong>${esc(winner)}</strong><p class="nn-muted">${s.reason === "mastermind" ? "🧠 幕后主使决定胜负" : s.reason === "tie" ? "仅存活者获得荣誉" : "以存活成员位阶决胜"}</p>${view.players.map(p => `<div class="nn-result-row ${p.player_id === view.you ? "is-you" : ""}"><span>${esc(p.name)}${p.player_id === view.you ? " · You" : ""}<br>${p.alive ? "Alive" : "💀 Fallen"}</span><span>${houseChip(p.house)}</span><span>${info(`🌟 ${s.token_delta[p.player_id] >= 0 ? "+" : ""}${s.token_delta[p.player_id]}`, "honor")}${view.game_over ? `<br>${p.score} points` : ""}</span></div>`).join("")}${!view.game_over ? `<div class="nn-actions">${button(view.next_ready.includes(view.you) ? `Waiting · ${view.next_ready.length}/${view.players.length}` : "Next Round", "next_round", "next", allowed("next_round"), "nn-primary")}</div>` : ""}`;
  }
  function status() {
    if (view.game_over) return "Game over · final scores revealed";
    if (view.phase === "round_end") return `Round review · ${view.next_ready.length}/${view.players.length} ready`;
    if (view.legal_actions.length) return `Your move · ${view.phase === "draft" ? `choose card ${view.draft_step} of 2` : view.phase === "react" ? "respond to the assassination" : view.phase === "reveal" ? "reveal cards or pass" : view.phase === "mastermind" ? "confirm the house reveal" : "resolve your Ninja card"}`;
    if (view.current_turn) return `${name(view.current_turn)} · ${view.phase === "react" ? "responding to an assassination" : `resolving ${cardLabel(view.active?.card_id)}`}`;
    return `Waiting for ${view.players.filter(p => !view.submitted.includes(p.player_id) && (p.alive || view.phase === "draft")).map(p => p.name).join(", ")}`;
  }
  function render() {
    if (!view) return;
    const positions = Object.fromEntries([...surface.querySelectorAll("[data-nn-scroll]")].map(el => [el.dataset.nnScroll, el.scrollTop]));
    const logOpen = surface.querySelector("details")?.open || false;
    const review = ["round_end", "game_over"].includes(view.phase);
    surface.innerHTML = `
      <div class="nn-steps">${phases.map((p, i) => `<div class="nn-step ${view.night_phase === p && view.phase !== "draft" ? "is-current" : ""}" data-nn-explain="phase" data-nn-tip="${esc(details.phase)}" tabindex="0">${i+1} · ${phaseNames[p]}</div>`).join("")}</div>
      <div class="nn-status ${view.legal_actions.length ? "is-yours" : ""}" role="status" aria-live="polite"><span class="nn-night">Night <b>${view.round}</b></span><span>${esc(status())}${busy ? " · Sending…" : ""}</span></div>
      <div class="nn-players" data-nn-scroll="players">${view.players.map(p => `<article class="nn-player ${p.player_id === view.you ? "is-you" : ""} ${p.player_id === view.current_turn ? "is-active" : ""} ${!p.alive ? "is-dead" : ""}" data-nn-explain="player"><div class="nn-player-name"><strong>${esc(p.name)}</strong>${p.player_id === view.you ? "<small>You</small>" : ""}</div><div class="nn-player-line">${info(p.alive ? `🂠 ${p.hand_count}` : "💀 Fallen", "player")}${info(`🌟 ${p.honor_count}`, "honor")}${(review ? view.next_ready.includes(p.player_id) : view.submitted.includes(p.player_id)) ? info("✓ Ready", "player") : ""}</div>${p.house ? `<div class="nn-player-line">${houseChip(p.house)}</div>` : ""}</article>`).join("")}</div>
      <div class="nn-columns"><main><section class="nn-box ${review ? "nn-result" : ""}" ${review ? 'data-nn-explain="result"' : ""}>${renderDecision()}</section>
      <section class="nn-box"><h3>ON THE TABLE</h3><div class="nn-played" data-nn-scroll="played" data-nn-explain="table">${view.table.length ? view.table.map(e => `<p><span>${esc(name(e.player_id))}</span>${info(cardLabel(e.card_id), card(e.card_id).kind)}<small>${esc(e.status)}</small></p>`).join("") : '<p class="nn-muted">No cards revealed yet.</p>'}</div></section></main>
      <aside class="nn-sidebar"><section class="nn-box"><h3>YOUR HOUSE</h3><div class="nn-identity">${houseChip(view.your_house)}</div>${view.house_uncertain ? '<p class="nn-muted">⚠️ Previous identity · may have changed</p>' : ""}<div class="nn-score">${info(`🌟 ${view.score}`, "honor")} <small>/ 10 points</small></div><div class="nn-tokens">${view.honor.map(n => info(`🌟 ${n}`, "honor", 'class="nn-token"')).join("")}</div></section>
      <section class="nn-box nn-intel"><h3>${info("🔒 PRIVATE INTEL", "notes")}</h3><div class="nn-notes" data-nn-scroll="notes" data-nn-explain="notes">${view.notes.length ? view.notes.slice().reverse().map(n => `<div class="nn-note">${esc(name(n.target))} · ${houseChip(n.house)}${n.ninja_card ? `<br>${info(cardLabel(n.ninja_card), card(n.ninja_card).kind)}` : ""}<small>${n.uncertain ? "Identity may have changed" : "Observed this round"}</small></div>`).join("") : '<p class="nn-muted">No observations yet.</p>'}</div></section>
      <section class="nn-box"><details ${logOpen ? "open" : ""}><summary>Recent moves</summary><div class="nn-log" data-nn-scroll="log">${view.log.slice().reverse().map(e => `<p><small>Night ${e.round}</small> · ${esc(e.text)}</p>`).join("")}</div></details></section></aside></div>`;
    surface.querySelectorAll("[data-nn-scroll]").forEach(el => { el.scrollTop = positions[el.dataset.nnScroll] || 0; });
    document.body.classList.toggle("nn-needs-action", !panel.classList.contains("hidden") && view.legal_actions.length > 0);
  }
  function submit(fields) {
    if (busy) return;
    busy = true; hideTip(); render();
    sendAction({...fields, game_token:view.game_token, window_id:view.window_id});
    busyTimer = setTimeout(() => { busy = false; render(); }, 5000);
  }
  surface.addEventListener("click", event => {
    if (!view || busy) return;
    const el = event.target.closest("button");
    if (el && !el.disabled) {
      if (el.dataset.nnCard) {
        const id = el.dataset.nnCard;
        selected = selected.includes(id) ? selected.filter(c => c !== id) : view.phase === "reveal" ? [...selected, id] : [id];
        render();
      } else if (el.dataset.nnTarget) {
        const id = el.dataset.nnTarget;
        targets = targets.includes(id) ? targets.filter(p => p !== id) : activeKind() === "shapeshifter" ? [...targets.slice(-1), id] : [id];
        tokenIndex = 0; render();
      } else if (el.dataset.nnAction) {
        const [type, choice] = el.dataset.nnAction.split(":");
        const a = {type};
        if (type === "draft") a.card_id = selected[0];
        if (type === "reveal") a.card_ids = selected;
        if (type === "target") {
          a.targets = targets;
          if (activeKind() === "spirit_merchant") a.mode = mode;
          if (activeKind() === "thief" || (activeKind() === "spirit_merchant" && mode === "honor")) a.token_index = tokenIndex;
        }
        if (type === "decide") {
          a.choice = choice;
          if (view.pending.kind === "gravedigger" && view.pending.options.length) a.card_id = selected[0];
          if (view.pending.kind === "spirit_merchant" && choice === "swap") { a.own_index = ownIndex; a.token_index = tokenIndex; }
        }
        if (type === "react") a.choice = choice;
        if (type === "mastermind") a.reveal = choice === "yes";
        submit(a);
      }
      return;
    }
    const hint = event.target.closest("[data-nn-tip]");
    if (hint) showTip(hint, true);
    else if (!event.target.closest("button, select, input, label, .nn-field")) { clearSelection(); hideTip(); render(); }
  });
  surface.addEventListener("change", event => {
    if (event.target.id === "nnMode") { mode = event.target.value; tokenIndex = 0; render(); }
    if (event.target.id === "nnToken") tokenIndex = Number(event.target.value);
    if (event.target.id === "nnOwnToken") ownIndex = Number(event.target.value);
  });
  document.addEventListener("keydown", event => {
    if (panel.classList.contains("hidden")) return;
    if (event.key === "Escape") { nightNinjaExplainWidget?.exit(); hideTip(); if (!dialog.open && !busy) { clearSelection(); render(); } }
  }, true);
  surface.addEventListener("pointerover", e => { if (e.pointerType === "mouse") showTip(e.target.closest("[data-nn-tip]")); });
  surface.addEventListener("pointerout", e => { if (e.pointerType === "mouse") hideTip(); });
  surface.addEventListener("focusin", e => showTip(e.target.closest("[data-nn-tip]")));
  surface.addEventListener("focusout", hideTip);
  document.getElementById("nnDialogClose").addEventListener("click", () => dialog.close());
  dialog.addEventListener("close", () => { if (returnFocus?.isConnected) returnFocus.focus(); });
  dialog.addEventListener("click", event => {
    if (event.target !== dialog) return;
    const r = dialog.getBoundingClientRect();
    if (event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom) dialog.close();
  });
  window.addEventListener("resize", hideTip);
  window.addEventListener("blur", hideTip);
  document.addEventListener("scroll", hideTip, true);
  function clearState() {
    view = null; signature = null; busy = false; clearTimeout(busyTimer); clearSelection(); nightNinjaExplainWidget?.exit(); hideTip();
    document.body.classList.remove("nn-needs-action");
    if (dialog.open) dialog.close();
    surface.innerHTML = '<div class="nn-waiting">Waiting to start</div>';
  }
  window.renderNightNinjaGameState = data => {
    if (data?.view?.game_id !== "night_of_the_ninja" || currentGameType !== "night_of_the_ninja") return;
    if (data.room_id && currentRoomState?.room_id !== data.room_id) return;
    const next = `${data.room_id}:${data.view.game_token}:${data.view.window_id}:${data.view.you}`;
    if (next !== signature) { clearSelection(); hideTip(); }
    if (next !== signature || view?.revision !== data.view.revision) { busy = false; clearTimeout(busyTimer); }
    signature = next; view = data.view; render();
  };
  window.showNightNinjaHeaderActions = visible => { header.style.display = visible ? "flex" : "none"; if (!visible) clearState(); };
  function syncRoom(state) { if (state?.game_type !== "night_of_the_ninja" || state.status === "lobby") clearState(); }
  function sync() {
    socket.on("room:state", syncRoom);
    socket.on("system:error", () => { busy = false; clearTimeout(busyTimer); render(); });
    socket.on("disconnect", () => { busy = false; clearTimeout(busyTimer); render(); });
    socket.on("connect", render);
    if (typeof currentRoomState !== "undefined") syncRoom(currentRoomState);
    if (typeof lastGameStatePayload !== "undefined" && lastGameStatePayload?.game_type === "night_of_the_ninja") window.renderNightNinjaGameState(lastGameStatePayload);
  }
  initNightNinjaHelpExplain();
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", sync, {once:true});
  else sync();
})();
