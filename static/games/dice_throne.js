(() => {
  "use strict";
  const root = document.querySelector(".dice-throne-shell");
  if (!root) return;
  const $ = id => document.getElementById(`diceThrone${id}`);
  let view = null;
  let pending = false;
  let selected = null;
  let explainMode = false;
  let tipTimer = null;
  let focusBeforeDialog = null;
  let pointerStart = null;
  let blockedPointer = false;
  let suppressUntil = 0;
  const activity = [];
  const activityLegend = "Public activity: Health (❤️), Combat Points (⚡), Cards (🃏), Damage (🗡️). Dice symbols: Sword (⚔️), Heart (❤️), Power (💪), Arrow (🏹), Foot (👣), Moon (🌙).";

  // One vocabulary for the board, Help, Explain and icon tooltips.
  const terms = {
    health: ["Health", "❤️", "Your remaining life. A hero at 0 Health is knocked out."],
    cp: ["Combat Points", "⚡", "CP pays for abilities and cards; maximum 15. Sell a card to gain 1 CP."],
    card: ["Cards", "🃏", "Your hand is private. Only the opponent's hand count is public; maximum 6 cards."],
    sword: ["Sword", "⚔️", "Barbarian die symbol, used in attack patterns."],
    heart: ["Heart", "❤️", "Barbarian die symbol, used by Fortitude and Thick Skin."],
    power: ["Power", "💪", "Barbarian die symbol, used in heavy attacks."],
    arrow: ["Arrow", "🏹", "Moon Elf die symbol, used in ranged attacks."],
    foot: ["Foot", "👣", "Moon Elf die symbol, used in Covered Shot and defense."],
    moon: ["Moon", "🌙", "Moon Elf die symbol, used in magical attacks."],
    stun: ["Stun", "💫", "A visible status token. Its extra-attack effect is not yet resolved in this edition."],
    concussion: ["Concussion", "💥", "A visible status token. Its income-skip effect is not yet resolved in this edition."],
    targeted: ["Targeted", "🎯", "Adds 2 to the next incoming damage, then consumes one token."],
    entangle: ["Entangle", "🪢", "A visible status token. Its roll-reduction effect is not yet resolved in this edition."],
    blind: ["Blind", "🙈", "A visible status token. Its attack-failure effect is not yet resolved in this edition."],
    evasive: ["Evasive", "💨", "Automatically absorbs the next normal damage and consumes one token. Does not absorb ultimate or undefendable damage."],
    damage: ["Damage", "🗡️", "Reduces the defender's Health after the response is resolved."],
    heal: ["Healing", "💚", "Restores your Health, up to 50."],
    defense: ["Defense", "🛡️", "Resolve your hero's defensive roll before incoming damage, or pass to take the attack."],
    ultimate: ["Ultimate", "👑", "A five-symbol ability. This edition still offers a defensive response; it does not fully implement official ultimate rules."],
    upgrade: ["Upgrade", "⬆️", "An ability upgrade recorded on your hero. Upgraded effects are not fully resolved in this edition."],
    dice: ["Dice", "🎲", "Roll five dice, up to three times. Keep individual dice between rolls."],
    kept: ["Kept", "🔒", "This die will stay unchanged on your next roll. Click it again to release it."],
    main: ["Main", "🧭", "Printed card timing: main phase."],
    roll: ["Roll", "🎲", "Printed card timing: roll phase."],
    instant: ["Instant", "✨", "Printed card timing: instant."],
  };
  const heroes = {
    barbarian: {name: "Barbarian", icon: "🪓", subtitle: "Strength & resilience", faces: ["sword", "heart", "power"]},
    moon_elf: {name: "Moon Elf", icon: "🌙", subtitle: "Precision & evasion", faces: ["arrow", "foot", "moon"]},
  };
  const phases = {
    choose_hero: "Choose a hero", main_1: "Main I", offensive_roll: "Offensive roll",
    targeting: "Choose an ability", defensive_roll: "Defense", main_2: "Main II",
    round_review: "Round review", game_over: "Game over",
  };
  const abilityCatalog = {
  "smack": {
    "name": "Smack",
    "condition": {
      "counts": {
        "sword": 3
      }
    },
    "description": "3+ swords: deal 4/6/8 damage for 3/4/5 swords.",
    "damage_type": "normal"
  },
  "sturdy_blow": {
    "name": "Sturdy Blow",
    "condition": {
      "counts": {
        "sword": 2,
        "power": 2
      }
    },
    "description": "2 swords + 2 powers: deal 4 undefendable damage.",
    "damage_type": "undefendable"
  },
  "mighty_blow": {
    "name": "Mighty Blow",
    "condition": {
      "straight": 4
    },
    "description": "Small straight (4 consecutive values): deal 9 damage.",
    "damage_type": "normal"
  },
  "crit_bash": {
    "name": "Crit Bash",
    "condition": {
      "counts": {
        "power": 4
      }
    },
    "description": "4+ powers: deal 5 undefendable damage and inflict Stun.",
    "damage_type": "undefendable"
  },
  "fortitude": {
    "name": "Fortitude",
    "condition": {
      "counts": {
        "heart": 3
      }
    },
    "description": "3/4/5 hearts: heal 4/5/6.",
    "damage_type": "normal"
  },
  "overpower": {
    "name": "Overpower",
    "condition": {
      "counts": {
        "sword": 3,
        "power": 2
      }
    },
    "description": "3 swords + 2 powers: roll 3 dice for their sum as damage; 14+ also Concussion.",
    "damage_type": "normal"
  },
  "reckless": {
    "name": "Reckless",
    "condition": {
      "straight": 5
    },
    "description": "Large straight: deal 15 damage and take 4 undefendable return damage.",
    "damage_type": "normal"
  },
  "rage": {
    "name": "Rage",
    "condition": {
      "counts": {
        "power": 5
      }
    },
    "description": "5 powers: deal 15 ultimate damage and inflict Stun.",
    "damage_type": "ultimate"
  },
  "longbow": {
    "name": "Longbow",
    "condition": {
      "counts": {
        "arrow": 3
      }
    },
    "description": "3+ arrows: deal 4/5/7 damage for 3/4/5 arrows.",
    "damage_type": "normal"
  },
  "demising_shot": {
    "name": "Demising Shot",
    "condition": {
      "counts": {
        "arrow": 3,
        "moon": 2
      }
    },
    "description": "3 arrows + 2 moons: deal 4 damage and inflict Targeted.",
    "damage_type": "normal"
  },
  "entangling_shot": {
    "name": "Entangling Shot",
    "condition": {
      "straight": 4
    },
    "description": "Small straight: deal 7 damage and inflict Entangle.",
    "damage_type": "normal"
  },
  "eclipse": {
    "name": "Eclipse",
    "condition": {
      "counts": {
        "moon": 4
      }
    },
    "description": "4+ moons: deal 7 damage and inflict Blind, Entangle and Targeted.",
    "damage_type": "normal"
  },
  "covered_shot": {
    "name": "Covered Shot",
    "condition": {
      "counts": {
        "arrow": 2,
        "foot": 3
      }
    },
    "description": "2 arrows + 3 feet: deal 7 damage and gain Evasive.",
    "damage_type": "normal"
  },
  "exploding_arrow": {
    "name": "Exploding Arrow",
    "condition": {
      "counts": {
        "arrow": 1,
        "moon": 3
      }
    },
    "description": "1 arrow + 3 moons: roll 5 dice; base 3 damage +1 per arrow/foot, destroy 1 CP per moon, and inflict Blind.",
    "damage_type": "normal"
  },
  "blinding_shot": {
    "name": "Blinding Shot",
    "condition": {
      "straight": 5
    },
    "description": "Large straight: deal 8 damage, inflict Blind and gain Evasive.",
    "damage_type": "normal"
  },
  "lunar_eclipse": {
    "name": "Lunar Eclipse",
    "condition": {
      "counts": {
        "moon": 5
      }
    },
    "description": "5 moons: deal 12 ultimate damage, inflict Blind, Entangle and Targeted, and gain Evasive.",
    "damage_type": "ultimate"
  }
};
  const wordKeys = {
    health: "health", cp: "cp", "combat points": "cp", cards: "card", card: "card",
    sword: "sword", swords: "sword", heart: "heart", hearts: "heart", power: "power", powers: "power",
    arrow: "arrow", arrows: "arrow", foot: "foot", feet: "foot", moon: "moon", moons: "moon",
    stun: "stun", concussion: "concussion", targeted: "targeted", entangle: "entangle",
    blind: "blind", evasive: "evasive", damage: "damage", heal: "heal", healing: "heal",
    ultimate: "ultimate", upgrade: "upgrade", upgrades: "upgrade", dice: "dice", die: "dice",
  };
  const wordPattern = new RegExp(`\\b(${Object.keys(wordKeys).sort((a, b) => b.length - a.length).join("|")})\\b`, "gi");
  const named = key => `${terms[key][0]} (${terms[key][1]})`;
  const heroName = id => heroes[id] ? `${heroes[id].name} (${heroes[id].icon})` : "Hero not chosen";
  const labelPlayer = id => view?.players?.find(player => player.player_id === id)?.name || id || "Player";
  const ownPlayer = () => view?.players?.find(player => player.player_id === view.you);
  const legal = type => Boolean(view && !pending && view.legal_actions?.includes(type));
  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = text;
    return node;
  }
  function describe(node, title, body, tooltip = false) {
    node.dataset.dtExplain = title;
    node.dataset.dtDescription = body;
    if (tooltip) node.dataset.dtTip = `${title} — ${body}`;
    return node;
  }
  function token(key, text) {
    const term = terms[key];
    return describe(el("span", `dt-token dt-tone-${key}`, text || `${term[1]} ${term[0]}`), named(key), term[2], true);
  }
  function richText(node, text) {
    let offset = 0;
    for (const match of String(text || "").matchAll(wordPattern)) {
      node.append(document.createTextNode(text.slice(offset, match.index)));
      node.append(token(wordKeys[match[0].toLowerCase()]));
      offset = match.index + match[0].length;
    }
    node.append(document.createTextNode(String(text || "").slice(offset)));
    return node;
  }
  function namedText(text) {
    return String(text || "").replace(wordPattern, word => named(wordKeys[word.toLowerCase()]));
  }
  function button(text, className, action, description) {
    const node = el("button", className, text);
    node.type = "button";
    if (description) describe(node, text, description);
    node.addEventListener("click", event => {
      event.stopPropagation();
      action();
    });
    return node;
  }
  function send(action) {
    if (!legal(action.type)) return;
    hideTip();
    action.revision = view.revision;
    pending = true;
    selected = null;
    render();
    if (typeof sendAction === "function") sendAction(action);
    else if (typeof socket !== "undefined") socket.emit("game:action", {room_id: typeof roomId !== "undefined" ? roomId : null, action});
  }
  function openDialog(title, content) {
    hideTip();
    const dialog = $("Dialog");
    focusBeforeDialog = document.activeElement;
    $("DialogTitle").textContent = title;
    $("DialogBody").replaceChildren(typeof content === "string" ? el("p", "", content) : content);
    if (!dialog.open) dialog.showModal();
    $("DialogClose").focus();
  }
  function setExplain(value) {
    explainMode = value;
    root.classList.toggle("dt-explaining", value);
    $("ExplainBtn").setAttribute("aria-pressed", String(value));
    $("ExplainNotice").classList.toggle("hidden", !value);
    hideTip();
  }
  function showTip(node, temporary = false) {
    if (!node?.dataset.dtTip || explainMode) return;
    clearTimeout(tipTimer);
    const box = $("Tooltip");
    box.textContent = node.dataset.dtTip;
    box.classList.remove("hidden");
    const rect = node.getBoundingClientRect();
    const bounds = box.getBoundingClientRect();
    box.style.left = `${Math.max(8, Math.min(innerWidth - bounds.width - 8, rect.left))}px`;
    box.style.top = `${rect.bottom + bounds.height + 16 < innerHeight ? rect.bottom + 6 : Math.max(8, rect.top - bounds.height - 6)}px`;
    if (temporary) tipTimer = setTimeout(hideTip, 3000);
  }
  function hideTip() {
    clearTimeout(tipTimer);
    $("Tooltip").classList.add("hidden");
  }
  function requirement(id) {
    const node = el("div", "dt-requirement");
    const condition = abilityCatalog[id]?.condition || {};
    if (condition.straight) {
      node.append(token("dice", `🎲 ${condition.straight}-straight`));
    } else {
      Object.entries(condition.counts || {}).forEach(([key, count]) => node.append(token(key, `${terms[key][1]} ×${count}`)));
    }
    return node;
  }
  function conditionText(id) {
    const condition = abilityCatalog[id]?.condition || {};
    if (condition.straight) return `${condition.straight} consecutive values on Dice (🎲). Availability is checked by the game; this view shows symbols only.`;
    return Object.entries(condition.counts || {}).map(([key, count]) => `${count} ${named(key)}`).join(" + ");
  }
  function helpContent() {
    const content = el("div", "dt-rules");
    function section(title, text) {
      const node = el("section", "dt-rule-section");
      node.append(el("h3", "", title), el("p", "", text));
      content.append(node);
      return node;
    }
    section("The duel", `Choose different heroes: ${heroName("barbarian")} or ${heroName("moon_elf")}. Start at 50 ${named("health")}, 2 ${named("cp")} and 4 ${named("card")}. Knock your opponent down to 0 Health (❤️) to end the duel. The Winner (🏆) and final board stay visible.`);
    section("This digital edition", "This is a simplified two-hero implementation. Ability and card descriptions retain their printed reference text; several card effects, upgrades and status effects are not yet fully resolved. The sections below describe the available controls and current turn flow. Do not treat this edition as a complete implementation of the official rules.");
    section("1 · Main I", `Select a Card (🃏), then Play and choose a target, or Sell for 1 Combat Point (⚡). Costs appear in the upper corner. Start rolling when ready. Printed Main (🧭), Roll (🎲) and Instant (✨) timing labels are references: the current edition permits card play during Main I, Main II and ability selection.`);
    section("2 · Roll → attack", `Roll five Dice (🎲) up to three times. Click a die to mark it Kept (🔒); click again to release it. Confirm at least one roll to choose a matching ability you can afford. Its upper corner is the Combat Points (⚡) cost, its middle row is the required pattern, and its lower text is the printed effect. Select a highlighted ability and confirm the target. Skip attack continues to Main II when you cannot or do not want to use an ability.`);
    section("3 · Defense", `The defender chooses Defense (🛡️) or Pass. Barbarian (🪓) rolls three dice and restores 2 Health (❤️) per Heart (❤️) before taking damage. Moon Elf (🌙) rolls five dice, returns one Damage (🗡️) per pair of Arrow (🏹) symbols, and prevents half incoming damage rounded down with at least two Foot (👣) symbols. Current defense is also offered for undefendable and Ultimate (👑) attacks.`);
    section("4 · Main II → review", `Play or sell Cards (🃏), then Finish turn. Each completed turn pauses for Round review. Both players must click Next Round; a Bot confirms automatically. Once both are ready, both players gain 1 Combat Point (⚡) and draw 1 Card (🃏). CP is capped at 15; drawing stops at 6 cards. A depleted deck is refilled from discards.`);
    const legend = section("Symbols & colors", "The same symbols, names and colors are used on the board, in tooltips and in Explain.");
    const grid = el("div", "dt-legend");
    Object.keys(terms).forEach(key => {
      const item = el("div", "dt-legend-item");
      item.append(token(key, named(key)), el("p", "", namedText(terms[key][2])));
      grid.append(item);
    });
    legend.append(grid);
    for (const [id, hero] of Object.entries(heroes)) {
      const details = el("details", "dt-rule-section");
      details.append(el("summary", "", `${heroName(id)} · ability reference`));
      const ids = id === "barbarian" ? Object.keys(abilityCatalog).slice(0, 8) : Object.keys(abilityCatalog).slice(8);
      ids.forEach(key => {
        const ability = abilityCatalog[key];
        const entry = el("div", "dt-rule-ability");
        entry.append(el("strong", "", ability.name), el("p", "", `Pattern: ${conditionText(key)}`), richText(el("p"), ability.description));
        details.append(entry);
      });
      content.append(details);
    }
    section("Controls", "Help opens these rules. Explain lets you inspect a die, resource, status, card, ability or disabled control without taking an action. It blocks other controls until you inspect a target or press Esc. Hover a static icon on desktop or tap it on a phone for a three-second tooltip; the latest tap replaces the previous tip. Click empty space or Cancel to deselect a card. Scrolling preserves the selection. Esc closes the dialog or cancels the selection. Battle log holds the public actions observed since you joined; opponent card identities are never shown.");
    return content;
  }
  function renderHeroPicker() {
    const choosing = view.phase === "choose_hero";
    $("HeroPicker").classList.toggle("hidden", !choosing);
    if (!choosing) return;
    const list = $("HeroChoices");
    list.replaceChildren();
    Object.entries(heroes).forEach(([id, hero]) => {
      const node = button("", `dt-hero-card dt-${id}`, () => send({type: "choose_hero", hero: id}));
      node.dataset.hero = id;
      node.append(el("span", "dt-avatar", hero.icon), el("strong", "", hero.name), el("small", "", hero.subtitle));
      const faces = el("div", "dt-requirement");
      hero.faces.forEach(key => faces.append(token(key)));
      node.append(faces);
      describe(node, heroName(id), `Choose ${heroName(id)}. Its symbols are ${hero.faces.map(named).join(", ")}. Start with Health (❤️) 50 and Combat Points (⚡) 2.`);
      node.disabled = !legal("choose_hero") || view.players.some(player => player.player_id !== view.you && player.hero === id);
      node.classList.toggle("selected", ownPlayer()?.hero === id);
      list.append(node);
    });
  }
  function renderPlayers() {
    const list = $("Players");
    list.replaceChildren();
    const players = [...view.players].sort((a, b) => Number(b.player_id === view.you) - Number(a.player_id === view.you));
    players.forEach(player => {
      const hero = heroes[player.hero];
      const card = el("article", `dt-player dt-${player.hero}${player.player_id === view.you ? " dt-you" : ""}${player.player_id === view.current_player ? " dt-turn" : ""}`);
      const head = el("div", "dt-player-head");
      const identity = el("div", "dt-player-identity");
      const avatar = describe(el("span", "dt-avatar", hero?.icon || "🎲"), heroName(player.hero), hero?.subtitle || "Choose a hero", true);
      identity.append(el("h3", "dt-hero-name", hero?.name || "Choose a hero"), el("div", "dt-player-name", player.name));
      head.append(avatar, identity);
      const badges = el("div", "dt-badges");
      if (player.player_id === view.you) badges.append(el("span", "dt-badge", "You"));
      if (player.is_bot) badges.append(el("span", "dt-badge", "Bot"));
      if (player.player_id === view.current_player) badges.append(el("span", "dt-badge", "Acting"));
      const health = describe(el("div", "dt-health"), named("health"), terms.health[2], true);
      const number = el("div", "dt-health-value");
      number.append(el("span", "", "❤️"), el("strong", "", player.health), el("small", "", `/ ${player.max_health || 50}`));
      const bar = el("div", "dt-health-bar");
      const fill = el("span");
      fill.style.width = `${Math.max(0, Math.min(100, player.health / (player.max_health || 50) * 100))}%`;
      bar.append(fill);
      health.append(number, bar);
      const meta = el("div", "dt-player-meta");
      meta.append(token("cp", `⚡ ${player.combat_points} CP`), token("card", `🃏 ${player.hand_count ?? 0}`));
      if (player.upgrades?.length) meta.append(token("upgrade", `⬆️ ${player.upgrades.length}`));
      const statuses = el("div", "dt-statuses");
      (player.statuses || []).forEach(status => {
        if (terms[status.id]) statuses.append(token(status.id, `${terms[status.id][1]} ${terms[status.id][0]} ×${status.stacks}`));
      });
      card.append(head, badges, health, meta, statuses);
      list.append(card);
    });
  }
  function renderDice() {
    const area = $("Dice");
    area.replaceChildren();
    for (let index = 0; index < 5; index++) {
      const die = view.dice[index];
      const key = die?.face;
      const term = terms[key];
      const node = button("", `dt-die dt-face-${key || "empty"}${die?.kept ? " kept" : ""}${!die ? " empty" : ""}`, () => send({type: "toggle_keep", index}));
      node.dataset.index = index;
      node.setAttribute("aria-pressed", String(Boolean(die?.kept)));
      node.setAttribute("aria-label", `Die ${index + 1}: ${term ? named(key) : "not rolled"}${die?.kept ? ", Kept (🔒)" : ""}`);
      node.append(el("span", "dt-die-symbol", term?.[1] || "🎲"), el("span", "dt-die-label", term?.[0] || "—"), el("span", "dt-keep", die?.kept ? "🔒 Kept" : ""));
      describe(node, `Die ${index + 1}${term ? ` · ${named(key)}` : " (🎲)"}`, `${term ? named(key) + ". " : ""}Click to keep or release this die before rolling again. Kept (🔒) dice stay unchanged. You can roll up to three times.`);
      node.disabled = !die || !legal("toggle_keep");
      area.append(node);
    }
    $("RollCount").textContent = `${view.roll_count} / 3 rolls`;
    const actor = view.pending_attack?.attacker || view.current_player;
    $("DiceHint").textContent = view.phase === "offensive_roll" ? actor === view.you ? "Tap dice to keep them between rolls." : `${labelPlayer(actor)} is rolling…` : "Five dice. One decisive ability.";
    $("RollBtn").disabled = !legal("roll");
    $("RollBtn").textContent = view.roll_count ? "🎲 Roll again" : "🎲 Roll dice";
    $("ConfirmBtn").disabled = !legal("confirm_roll") || !view.dice.length;
    $("EndBtn").disabled = !legal("end_phase");
    $("EndBtn").textContent = view.phase === "main_2" ? "Finish turn →" : "Start rolling →";
    const main = ["main_1", "main_2"].includes(view.phase);
    $("RollZone").querySelector(".dt-roll-actions").classList.toggle("hidden", !main && !["offensive_roll", "targeting"].includes(view.phase));
    $("EndBtn").classList.toggle("hidden", !main);
    $("RollBtn").classList.toggle("hidden", main);
    $("ConfirmBtn").classList.toggle("hidden", main);
    $("PassBtn").classList.toggle("hidden", view.phase !== "targeting");
    $("PassBtn").disabled = !legal("pass");
  }
  function chooseSelection(value, node) {
    selected = value;
    const top = node?.getBoundingClientRect().top;
    renderAbilities();
    renderHand();
    if (top != null) {
      const replacement = root.querySelector(`[data-dt-selection="${value.kind}-${value.index}"]`);
      if (replacement) window.scrollBy(0, replacement.getBoundingClientRect().top - top);
    }
  }
  function cancelSelection() {
    selected = null;
    renderAbilities();
    renderHand();
  }
  function targets(kind, id, target) {
    const box = el("div", "dt-target-choice");
    const players = view.players.filter(player => target === "self" ? player.player_id === view.you : target === "opponent" ? player.player_id !== view.you : true);
    players.forEach(player => {
      const label = `Play → ${player.player_id === view.you ? "You" : player.name}`;
      const action = {type: kind, target: player.player_id};
      action[kind === "use_ability" ? "ability_id" : "card_id"] = id;
      box.append(button(kind === "use_ability" ? `Use → ${player.name}` : label, "dt-primary", () => send(action), `Confirm this ${kind === "use_ability" ? "ability" : "Card (🃏)"} on ${player.name}. Its Combat Points (⚡) cost is paid immediately.`));
    });
    return box;
  }
  function renderAbilities() {
    const list = $("AbilityList");
    const oldScroll = list.scrollTop;
    list.replaceChildren();
    $("Abilities").classList.toggle("hidden", !view.abilities.length);
    const usable = view.abilities.filter(ability => ability.available && legal("use_ability")).length;
    $("AbilityHint").textContent = view.phase === "targeting" ? usable ? `${usable} ready · ${view.abilities.length} abilities` : "No ready ability · you can skip" : "Confirm your roll to choose";
    view.abilities.forEach((ability, index) => {
      const active = selected?.kind === "ability" && selected.index === index;
      const canUse = ability.available && legal("use_ability");
      const card = el("article", `dt-ability${canUse ? " available" : ""}${active ? " selected" : ""}${abilityCatalog[ability.id]?.damage_type === "ultimate" ? " dt-ultimate" : ""}`);
      card.dataset.dtSelection = `ability-${index}`;
      const trigger = button("", "dt-ability-trigger", () => active ? cancelSelection() : chooseSelection({kind: "ability", id: ability.id, index}, card));
      trigger.disabled = !canUse;
      trigger.setAttribute("aria-expanded", String(active));
      const head = el("div", "dt-ability-head");
      head.append(el("strong", "", ability.name), el("span", "dt-cost", `⚡ ${ability.cost}`));
      const description = ability.description.replace(/^[^:]+:\s*/, "");
      trigger.append(head, requirement(ability.id), richText(el("div", "dt-effect"), description), el("span", "dt-availability", canUse ? "Ready · select" : view.phase === "offensive_roll" ? "Preview" : "Unavailable"));
      describe(trigger, `${ability.name}${abilityCatalog[ability.id]?.damage_type === "ultimate" ? " · Ultimate (👑)" : ""}`, `Pattern: ${conditionText(ability.id)}. Cost: ${ability.cost} ${named("cp")}. Printed effect: ${namedText(ability.description)} ${canUse ? "Select, then confirm the target." : "Unavailable until it is your ability phase and both the pattern and cost are met."}`);
      card.append(trigger);
      if (active) {
        const confirm = el("div", "dt-inline-confirm");
        confirm.append(targets("use_ability", ability.id, ability.target), button("Cancel", "dt-secondary", cancelSelection, "Cancel this local selection without taking an action."));
        card.append(confirm);
      }
      list.append(card);
    });
    list.scrollTop = oldScroll;
  }
  function renderHand() {
    const hand = $("Hand");
    const oldScroll = hand.scrollTop;
    hand.replaceChildren();
    const cards = view.your_hand || [];
    $("HandCount").textContent = `${cards.length} / 6 · private`;
    cards.forEach((card, index) => {
      const id = card.id || card.cardid;
      const active = selected?.kind === "card" && selected.index === index;
      const node = el("article", `dt-card${active ? " selected" : ""}`);
      node.dataset.dtSelection = `card-${index}`;
      const trigger = button("", "dt-card-trigger", () => active ? cancelSelection() : chooseSelection({kind: "card", id, index, targeting: false}, node));
      trigger.setAttribute("aria-expanded", String(active));
      const head = el("div", "dt-card-head");
      head.append(el("strong", "", card.name), el("span", "dt-cost", `⚡ ${card.cost}`));
      const foot = el("div", "dt-card-foot");
      foot.append(token(card.timing in terms ? card.timing : "main"), el("span", "dt-target", card.target === "self" ? "You" : card.target === "opponent" ? "Opponent" : "Either hero"));
      trigger.append(head, richText(el("p", "dt-card-effect"), card.description), foot);
      describe(trigger, `Card (🃏) · ${card.name}`, `Cost: ${card.cost} ${named("cp")}. Printed timing: ${named(card.timing in terms ? card.timing : "main")}. Printed effect: ${namedText(card.description)} Select for Play or Sell. Sell gains 1 Combat Point (⚡). Some printed effects are not yet resolved; see Help.`);
      node.append(trigger);
      if (active) {
        const confirm = el("div", "dt-inline-confirm");
        if (selected.targeting) {
          confirm.append(targets("play_card", id, card.target));
        } else {
          const play = button("Play", "dt-primary", () => {
            if (card.target) chooseSelection({...selected, targeting: true}, node);
            else send({type: "play_card", card_id: id});
          }, `Play this Card (🃏) for ${card.cost} Combat Points (⚡), then choose its target.`);
          play.disabled = !legal("play_card") || (ownPlayer()?.combat_points || 0) < card.cost;
          const sell = button("Sell · +1 ⚡", "dt-secondary", () => send({type: "sell_card", card_id: id}), "Discard this Card (🃏) and gain 1 Combat Point (⚡). Available in a main phase.");
          sell.disabled = !legal("sell_card");
          confirm.append(play, sell);
        }
        confirm.append(button("Cancel", "dt-secondary", cancelSelection, "Cancel this local selection without taking an action."));
        node.append(confirm);
      }
      hand.append(node);
    });
    if (!cards.length) hand.append(el("p", "dt-empty", "No cards in hand"));
    hand.scrollTop = oldScroll;
  }
  function renderResponse() {
    const attack = view.pending_attack;
    $("Response").classList.toggle("hidden", !attack || view.phase !== "defensive_roll");
    if (!attack) return;
    $("ResponseTitle").textContent = attack.defender === view.you ? "🛡️ Your defense" : `🛡️ ${labelPlayer(attack.defender)} is defending`;
    $("ResponseText").replaceChildren();
    richText($("ResponseText"), `${abilityCatalog[attack.ability_id]?.name || "Attack"} · ${attack.damage} ${attack.damage_type} damage`);
    const actions = $("ResponseActions");
    actions.replaceChildren();
    if (attack.defender !== view.you) return;
    const defend = button("🛡️ Defend", "dt-primary", () => send({type: "defend"}), `${named("defense")}: ${ownPlayer()?.hero === "barbarian" ? "Thick Skin rolls three Dice (🎲) and heals 2 Health (❤️) per Heart (❤️)." : "Missed Me rolls five Dice (🎲), returns Damage (🗡️) per pair of Arrow (🏹), and prevents half incoming damage with two Foot (👣)."}`);
    defend.disabled = !legal("defend");
    const pass = button("Pass", "dt-secondary", () => send({type: "pass"}), "Skip Defense (🛡️) and take the pending Damage (🗡️).");
    pass.disabled = !legal("pass");
    actions.append(defend, pass);
  }
  function renderReview() {
    $("Review").classList.toggle("hidden", view.phase !== "round_review");
    const rows = $("ReviewRows");
    rows.replaceChildren();
    (view.round_review || []).forEach(entry => rows.append(el("div", `dt-review-row${entry.player_id === view.you ? " self" : ""}`, `${labelPlayer(entry.player_id)} · ${entry.text}`)));
    activity.slice(-3).forEach(text => rows.append(describe(el("div", "dt-review-row", text), "Battle activity", activityLegend, true)));
    $("Ready").textContent = `${view.next_round_ready.length} / ${view.players.length} ready`;
    $("NextBtn").disabled = !legal("next_round");
    $("NextBtn").textContent = view.next_round_ready.includes(view.you) ? "Ready · waiting" : "Next Round →";
    $("GameOver").classList.toggle("hidden", !view.game_over);
    if (view.game_over) {
      $("Winner").replaceChildren(describe(el("h3", "", `🏆 ${view.winner.length ? view.winner.map(labelPlayer).join(" & ") : "Draw"}`), "Winner (🏆)", "The duel has ended. Final Health (❤️) and Combat Points (⚡) remain visible.", true));
      $("FinalRows").replaceChildren(...view.players.map(player => {
        const row = el("div", "dt-final-row", `${player.name} · `);
        row.append(token("health", `❤️ ${player.health}`), token("cp", `⚡ ${player.combat_points}`));
        return row;
      }));
    }
  }
  function render() {
    if (!view) return;
    hideTip();
    renderHeroPicker();
    $("Arena").classList.toggle("hidden", view.phase === "choose_hero");
    $("Round").textContent = `Round ${view.round}`;
    $("Phase").textContent = phases[view.phase] || "Waiting";
    const prompts = {choose_hero: "Choose your hero to enter the duel.", main_1: "Play cards or start rolling.", offensive_roll: "Roll, keep your best dice, then confirm.", targeting: "Choose a ready ability or skip the attack.", defensive_roll: "An attack is incoming. Choose your response.", main_2: "Play cards or finish your turn.", round_review: "Review the turn, then ready up.", game_over: "The duel is complete."};
    const hasAction = !view.game_over && Boolean(view.legal_actions?.length);
    $("Status").textContent = pending ? "Sending your action…" : hasAction ? prompts[view.phase] : view.phase === "round_review" ? "Ready · waiting for the other player." : view.game_over ? prompts.game_over : `Waiting for ${labelPlayer(view.current_player)}…`;
    root.classList.toggle("dt-has-action", hasAction);
    document.body.classList.toggle("dt-needs-action", hasAction);
    root.querySelectorAll("[data-dt-phase]").forEach(node => node.classList.toggle("active", node.dataset.dtPhase === view.phase));
    $("Activity").textContent = activity.at(-1) || "The arena is ready.";
    describe($("Activity"), "Battle activity", activityLegend, true);
    renderPlayers();
    renderDice();
    renderAbilities();
    renderHand();
    renderResponse();
    renderReview();
    $("Log").replaceChildren(...activity.slice(-40).map(text => describe(el("li", "", text), "Battle activity", activityLegend, true)));
  }
  function recordChanges(previous, next) {
    const who = id => next.players.find(player => player.player_id === id)?.name || "Player";
    if (!previous || next.revision < previous.revision) activity.length = 0;
    if (!previous || next.revision === previous.revision) return;
    if (next.roll_count !== previous.roll_count && next.roll_count > 0) {
      activity.push(`${who(next.current_player)} rolled ${next.dice.map(die => terms[die.face]?.[1] || "🎲").join(" ")} · ${next.roll_count}/3`);
    }
    if (next.pending_attack && !previous.pending_attack) {
      activity.push(`${who(next.pending_attack.attacker)} used ${abilityCatalog[next.pending_attack.ability_id]?.name || "an ability"} · 🗡️ ${next.pending_attack.damage}`);
    }
    next.players.forEach(player => {
      const old = previous.players.find(item => item.player_id === player.player_id);
      if (old && old.health !== player.health) activity.push(`${player.name} · ❤️ ${old.health} → ${player.health}`);
      if (old && old.hand_count !== player.hand_count) activity.push(`${player.name} · 🃏 ${old.hand_count} → ${player.hand_count} cards`);
      if (old && old.combat_points !== player.combat_points) activity.push(`${player.name} · ⚡ ${old.combat_points} → ${player.combat_points} CP`);
    });
    if (next.phase !== previous.phase) activity.push(`${next.current_player ? who(next.current_player) + " · " : ""}${phases[next.phase]}`);
    if (activity.length > 40) activity.splice(0, activity.length - 40);
  }
  function explainTarget(event) {
    const direct = event.target.closest?.("[data-dt-explain]");
    if (direct && root.contains(direct)) return direct;
    return [...root.querySelectorAll("[data-dt-explain]")].reverse().find(node => {
      const rect = node.getBoundingClientRect();
      return rect.width && rect.height && event.clientX >= rect.left && event.clientX <= rect.right && event.clientY >= rect.top && event.clientY <= rect.bottom;
    });
  }
  function exempt(target) {
    return target.closest?.("#diceThroneHelpBtn,#diceThroneExplainBtn,#diceThroneDialog");
  }
  function showExplanation(node) {
    setExplain(false);
    openDialog(node.dataset.dtExplain, node.dataset.dtDescription);
  }
  // Capture the whole document, including controls moved into the shared header.
  document.addEventListener("pointerdown", event => {
    // A fresh deliberate press must not be suppressed by the previous gesture.
    suppressUntil = 0;
    if (!explainMode || exempt(event.target)) return;
    blockedPointer = true;
    event.preventDefault();
    event.stopImmediatePropagation();
    const node = explainTarget(event);
    if (node) showExplanation(node);
  }, true);
  document.addEventListener("pointerup", event => {
    if (!blockedPointer) return;
    blockedPointer = false;
    suppressUntil = performance.now() + 500;
    event.preventDefault();
    event.stopImmediatePropagation();
  }, true);
  document.addEventListener("pointercancel", () => { blockedPointer = false; });
  document.addEventListener("click", event => {
    if (performance.now() < suppressUntil) {
      event.preventDefault();
      event.stopImmediatePropagation();
      return;
    }
    if (!explainMode || exempt(event.target)) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    const node = explainTarget(event);
    if (node) showExplanation(node);
  }, true);
  document.addEventListener("keydown", event => {
    if (event.key === "Escape") {
      setExplain(false);
      hideTip();
      if (selected) cancelSelection();
      if ($("Dialog").open) $("Dialog").close();
    } else if (explainMode && ["Enter", " "].includes(event.key) && !exempt(event.target)) {
      event.preventDefault();
      event.stopImmediatePropagation();
      const node = explainTarget(event);
      if (node) showExplanation(node);
    }
  }, true);
  root.addEventListener("pointerdown", event => {
    pointerStart = {x: event.clientX, y: event.clientY, moved: false, scrolled: false};
  });
  document.addEventListener("pointermove", event => {
    if (pointerStart && Math.hypot(event.clientX - pointerStart.x, event.clientY - pointerStart.y) > 8) pointerStart.moved = true;
  }, {passive: true});
  root.addEventListener("click", event => {
    const deliberate = !pointerStart || (!pointerStart.moved && !pointerStart.scrolled);
    const staticIcon = event.target.closest("[data-dt-tip]");
    if (deliberate && staticIcon && !staticIcon.closest("button") && (event.pointerType === "touch" || matchMedia("(hover: none)").matches)) showTip(staticIcon, true);
    if (deliberate && selected && !event.target.closest("button,[data-dt-tip],details,summary,.dt-inline-confirm")) cancelSelection();
    pointerStart = null;
  });
  root.addEventListener("pointerover", event => {
    if (event.pointerType === "mouse") showTip(event.target.closest("[data-dt-tip]"));
  });
  root.addEventListener("pointerout", event => { if (event.pointerType === "mouse") hideTip(); });
  document.addEventListener("scroll", () => {
    hideTip();
    if (pointerStart) pointerStart.scrolled = true;
  }, {capture: true, passive: true});
  window.addEventListener("resize", hideTip);
  const actionHelp = {
    RollBtn: ["Roll Dice (🎲)", "Roll up to three times. Kept (🔒) dice remain unchanged while the others roll again."],
    ConfirmBtn: ["Confirm roll", "Keep the current Dice (🎲) result and move to ability selection. Roll at least once first."],
    EndBtn: ["Continue the turn", "Main I continues to rolling Dice (🎲). Main II ends the turn and opens the shared review."],
    PassBtn: ["Skip attack", "Continue to Main II without using an ability or spending Combat Points (⚡)."],
    NextBtn: ["Next Round", "Confirm the round review. Both players must be ready; Bots confirm automatically. No second confirmation is needed."],
  };
  Object.entries(actionHelp).forEach(([id, text]) => describe($(id), ...text));
  [["RollBtn", "roll"], ["ConfirmBtn", "confirm_roll"], ["EndBtn", "end_phase"], ["PassBtn", "pass"], ["NextBtn", "next_round"]].forEach(([id, type]) => $(id).addEventListener("click", () => send({type})));
  $("HelpBtn").addEventListener("click", () => { setExplain(false); openDialog("Dice Throne · Help", helpContent()); });
  $("ExplainBtn").addEventListener("click", () => setExplain(!explainMode));
  $("DialogClose").addEventListener("click", () => $("Dialog").close());
  $("Dialog").addEventListener("close", () => { if (focusBeforeDialog?.isConnected) focusBeforeDialog.focus({preventScroll: true}); });
  window.renderDiceThroneGameState = data => {
    if (!data?.view || (data.view.game_id && data.view.game_id !== "dice_throne")) return;
    if (view?.revision !== data.view.revision) selected = null;
    recordChanges(view, data.view);
    view = data.view;
    pending = false;
    render();
  };
  window.showDiceThroneHeaderActions = show => {
    $("HeaderActions").style.display = show ? "flex" : "none";
    if (!show) {
      view = null;
      selected = null;
      pending = false;
      activity.length = 0;
      setExplain(false);
      document.body.classList.remove("dt-needs-action");
      if ($("Dialog").open) $("Dialog").close();
    } else if (typeof lastGameStatePayload !== "undefined" && lastGameStatePayload?.game_type === "dice_throne") window.renderDiceThroneGameState(lastGameStatePayload);
  };
  function sync() {
    if (typeof socket !== "undefined") {
      socket.on("system:error", () => { pending = false; render(); });
      socket.on("disconnect", () => { pending = false; render(); });
    }
    if (typeof lastGameStatePayload !== "undefined" && lastGameStatePayload?.game_type === "dice_throne") window.renderDiceThroneGameState(lastGameStatePayload);
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", sync, {once: true});
  else sync();
})();
