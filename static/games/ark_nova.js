(() => {
  "use strict";

  const ARK_NOVA_GAME_TYPE = "ark_nova";
  const ARK_NOVA_MAP_URL = "/static/assets/ark_nova/map0.svg?v=map0_v2";
  const ARK_NOVA_PLAYER_COLORS = ["#f59e0b", "#38bdf8", "#f472b6", "#a3e635"];
  const ARK_NOVA_CONTINENTS = ["africa", "americas", "asia", "australia", "europe"];

  const ARK_NOVA_ACTIONS = {
    cards: { name: "Cards", icon: "🗂️", color: "cyan", description: "Advance Break, then draw cards or Snap one card from the display." },
    build: { name: "Build", icon: "🔨", color: "orange", description: "Place one or more legal buildings on your Map 0 zoo board." },
    animals: { name: "Animals", icon: "🐾", color: "green", description: "Play animal cards into suitable empty enclosures and resolve their abilities." },
    association: { name: "Association", icon: "🤝", color: "blue", description: "Assign workers to reputation, partner zoo, university, or conservation tasks." },
    sponsors: { name: "Sponsors", icon: "🏛️", color: "pink", description: "Play sponsor cards, or advance Break to gain money." },
  };

  const ARK_NOVA_BUILDINGS = {
    standard_enclosure: { name: "Standard enclosure", icon: "⬡", variable: true, size: 1, color: "#d39b42" },
    kiosk: { name: "Kiosk", icon: "💰", size: 1, color: "#f5c542" },
    pavilion: { name: "Pavilion", icon: "🎪", size: 1, color: "#df8f6e" },
    petting_zoo: { name: "Petting zoo", icon: "🐐", size: 3, color: "#7bbf6a" },
    reptile_house: { name: "Reptile house", icon: "🦎", size: 5, color: "#46a987" },
    large_bird_aviary: { name: "Large bird aviary", icon: "🪶", size: 5, color: "#6aaed6" },
  };

  const ARK_NOVA_ICON_LABELS = {
    africa: ["🌍", "Africa"],
    americas: ["🌎", "Americas"],
    america: ["🌎", "Americas"],
    asia: ["🌏", "Asia"],
    australia: ["🦘", "Australia"],
    europe: ["🏰", "Europe"],
    predator: ["🐾", "Predator"],
    herbivore: ["🦌", "Herbivore"],
    bird: ["🪶", "Bird"],
    reptile: ["🦎", "Reptile"],
    primate: ["🐒", "Primate"],
    bear: ["🐻", "Bear"],
    petting_zoo: ["🐐", "Petting zoo animal"],
    science: ["🔬", "Science"],
    research: ["🔬", "Research"],
    water: ["💧", "Water"],
    rock: ["🪨", "Rock"],
  };

  const ARK_NOVA_EXPLANATIONS = {
    action_card: "Choose one Action card. Its slot plus committed X-tokens determines the action strength. After the action, it moves to slot 1.",
    x_tokens: "Spend X-tokens before an action to increase its strength, up to strength 5.",
    cards_draw: "Use the Cards action to draw from the deck. The number drawn and discarded depends on action strength and upgrade side.",
    cards_snap: "Snap takes one card from any display folder. It is only available at the strengths printed on your Cards action.",
    build_type: "Choose the building type, then select its complete footprint on Map 0. The server validates adjacency, terrain, cost, and upgrade restrictions.",
    rotate_footprint: "Rotate the selected hex footprint 60° clockwise around the first selected cell.",
    queue_building: "Add the selected footprint to this action. Upgraded Build may contain multiple different buildings within total strength.",
    confirm_build: "Submit every queued building, committed X-tokens, and exact Map 0 cell IDs.",
    animal_card: "Select an Animal card from your hand, or from the display when your upgraded action and reputation allow it.",
    animal_enclosure: "Each animal needs an eligible enclosure with sufficient empty capacity and any required water or rock adjacency.",
    sponsor_card: "Select Sponsor cards whose combined strength fits this action. Upgraded Sponsors may also use cards in reputation range.",
    association_task: "Queue a different Association task. Their total strength may not exceed the action strength; repeated tasks can require extra workers.",
    donation: "After at least one task with upgraded Association, pay the next visible donation amount for 1 conservation point.",
    gain_x: "Take 1 X-token instead of performing the selected Action card, then move that Action card to slot 1.",
    confirm_action: "Submit the current action plan. Disabled controls can still be inspected while Explain mode is active.",
    card_info: "Open the complete text, requirements, rewards, icons, and abilities available for this card.",
    pending_choice: "Resolve the highlighted effect before continuing. The permitted number of selections is shown above the options.",
    keep_cards: "At setup, select exactly four of your eight cards to keep. The other four are discarded.",
    undo: "Remove the most recently queued item without changing confirmed game state.",
  };

  const ARK_NOVA_HELP_HTML = `
    <div class="arkn-help-grid">
      <section><h4>Goal</h4><p>Build a modern zoo. Raise <strong>🎟 Appeal</strong> and <strong>🌿 Conservation</strong>; when the two scoring markers meet or cross, the end game begins.</p></section>
      <section><h4>Your turn</h4><p>Choose exactly one Action card. Its slot is its base strength. You may add X-tokens, then the used card moves to slot 1 and the crossed cards shift right.</p></section>
      <section><h4>🗂️ Cards</h4><p>Advance Break, then draw cards. At sufficient strength you can Snap one card from any display folder.</p></section>
      <section><h4>🔨 Build</h4><p>Buildings cost 2 money per hex. The first touches an edge; later buildings touch your zoo. Water, rock, occupied spaces, kiosk distance, and Build II spaces restrict placement.</p></section>
      <section><h4>🐾 Animals</h4><p>Pay the card cost and place each animal into a suitable empty enclosure. Check card requirements, habitat size, and water or rock adjacency before playing.</p></section>
      <section><h4>🤝 Association</h4><p>Use active workers for reputation, partner zoos, universities, and conservation projects. Upgraded Association can combine different tasks and donate once.</p></section>
      <section><h4>🏛️ Sponsors</h4><p>Play Sponsor cards within the available strength, or advance Break and gain money. Sponsors can have immediate, ongoing, income, and end-game effects.</p></section>
      <section><h4>Break</h4><p>When the Break marker reaches its limit, finish the current action, reduce hands to their limits, refresh the display and association board, return workers, and collect income.</p></section>
      <section><h4>Map 0</h4><p>Select a building and click its full hex footprint. Orange outlines are your current footprint; colored hexes are occupied. Click empty surrounding space or press Esc to cancel a draft.</p></section>
      <section><h4>Explain mode</h4><p>Choose <strong>Explain</strong>, then select any dashed control—even a disabled one—to learn what it does. Esc exits the mode.</p></section>
    </div>`;

  const ARK_NOVA_MAP_INFO_HTML = `
    <div class="arkn-map-info-grid">
      <section><h4>Complete Map 0</h4><p>Cover all 39 buildable land hexes to gain <strong>7 appeal</strong>. Water and rock normally cannot be covered, but they count for adjacency.</p></section>
      <section><h4>Placement bonuses</h4><p>Bonus hexes can grant a card, money, an X-token, appeal, or move an Action card to slot 1 after the current action finishes.</p></section>
      <section><h4>Build II spaces</h4><p>The marked G3 and H3 hexes require the Build action upgraded to side II.</p></section>
      <section><h4>Conservation rewards</h4><p>The reward strip to the left belongs to your zoo board. Purple rewards repeat at each Break; yellow rewards resolve once.</p></section>
      <section><h4>Map controls</h4><p>Select a building in Plan action, then click its complete connected footprint. Orange outlines show the current draft; occupied hexes use the building color.</p></section>
      <section><h4>X-token storage</h4><p>Your current supply is shown beside the Map info button and in your player summary. You may store up to 5 X-tokens.</p></section>
      <div class="arkn-map-info-legend" aria-label="Map 0 terrain legend">
        <span><i class="arkn-legend-land"></i>Buildable land</span>
        <span><i class="arkn-legend-water"></i>Water</span>
        <span><i class="arkn-legend-rock"></i>Rock</span>
        <span><i class="arkn-legend-choice"></i>Selected footprint</span>
      </div>
    </div>`;

  let arkNovaCurrentData = null;
  let arkNovaView = null;
  let arkNovaLastContextKey = "";
  let arkNovaExplainMode = false;
  let arkNovaMapDocument = null;
  let arkNovaEventLog = [];
  let arkNovaEventKeys = new Set();
  let arkNovaCardLookup = new Map();
  let arkNovaPendingOptions = [];

  const arkNovaUi = {
    selectedAction: null,
    xTokens: 0,
    actionMode: "draw",
    selectedCards: new Set(),
    buildType: "standard_enclosure",
    buildSize: 1,
    buildCells: [],
    buildQueue: [],
    animalEnclosures: new Map(),
    associationDraft: { task: "reputation", continent: "africa", university_id: "", project_id: "", slot: 3, project_card_id: "", release_animal_id: "" },
    associationQueue: [],
    donate: false,
    pendingSelection: new Set(),
  };

  function arkNovaEscape(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function arkNovaAsArray(value) {
    if (Array.isArray(value)) return value;
    if (value && typeof value === "object") return Object.values(value);
    return [];
  }

  function arkNovaNumber(value, fallback = 0) {
    const number = Number(value);
    return Number.isFinite(number) ? number : fallback;
  }

  function arkNovaTitle(value) {
    return String(value || "-")
      .replaceAll("_", " ")
      .replace(/\b\w/g, (letter) => letter.toUpperCase());
  }

  function arkNovaCardId(card) {
    if (card && typeof card === "object") return String(card.id ?? card.card_id ?? card.uid ?? "");
    return card == null ? "" : String(card);
  }

  function arkNovaCardObject(value) {
    if (value && typeof value === "object") return value.card && typeof value.card === "object" ? { ...value.card, ...value } : value;
    const id = arkNovaCardId(value);
    return arkNovaCardLookup.get(id) || { id };
  }

  function arkNovaCardName(card) {
    const normalized = arkNovaCardObject(card);
    if (typeof normalized.name === "string") return normalized.name;
    if (normalized.name && typeof normalized.name === "object") {
      return normalized.name.zh || normalized.name.en || Object.values(normalized.name)[0] || `Card ${arkNovaCardId(normalized)}`;
    }
    return normalized.name_zh || normalized.name_en || normalized.title || `Card ${arkNovaCardId(normalized)}`;
  }

  function arkNovaCardEnglishName(card) {
    const normalized = arkNovaCardObject(card);
    if (normalized.name && typeof normalized.name === "object") return normalized.name.en || "";
    return normalized.name_en || "";
  }

  function arkNovaCardType(card) {
    const value = arkNovaCardObject(card).card_type || arkNovaCardObject(card).type || "unknown";
    if (value === "conservation") return "conservation_project";
    if (value === "sponsor") return "sponsor";
    if (value === "animal") return "animal";
    return String(value);
  }

  function arkNovaPlayers(view = arkNovaView) {
    return arkNovaAsArray(view && view.players);
  }

  function arkNovaPlayerId(player) {
    return String(player && (player.player_id ?? player.id ?? player.pid) || "");
  }

  function arkNovaYou(view = arkNovaView) {
    if (!view) return null;
    const yourId = String(view.you ?? view.player_id ?? "");
    return arkNovaPlayers(view).find((player) => arkNovaPlayerId(player) === yourId)
      || (view.you_player && typeof view.you_player === "object" ? view.you_player : null);
  }

  function arkNovaPlayerName(player) {
    return player && (player.name || player.player_name || player.username) || "Player";
  }

  function arkNovaTrack(player, key) {
    if (!player) return 0;
    if (player.tracks && player.tracks[key] != null) return arkNovaNumber(player.tracks[key]);
    return arkNovaNumber(player[key]);
  }

  function arkNovaResource(player, key) {
    if (!player) return 0;
    if (player.resources && player.resources[key] != null) return arkNovaNumber(player.resources[key]);
    const aliases = {
      x_tokens: ["x_tokens", "x", "x_token_count"],
      money: ["money", "coins", "cash"],
      workers: ["available_workers", "workers", "association_workers"],
    };
    const candidates = aliases[key] || [key];
    for (const candidate of candidates) {
      if (player[candidate] != null && typeof player[candidate] !== "object") return arkNovaNumber(player[candidate]);
    }
    return 0;
  }

  function arkNovaDisplay(view = arkNovaView) {
    return arkNovaAsArray(view && (view.display || view.market || view.card_display || view.display_cards));
  }

  function arkNovaHand(view = arkNovaView) {
    return arkNovaAsArray(view && (view.your_hand || view.hand || (arkNovaYou(view) || {}).hand));
  }

  function arkNovaProjects(view = arkNovaView) {
    return arkNovaAsArray(view && (view.projects || view.conservation_projects || view.public_projects));
  }

  function arkNovaCurrentPlayerId(view = arkNovaView) {
    if (!view) return "";
    const value = view.current_player ?? view.current_turn ?? view.active_player;
    if (value && typeof value === "object") return arkNovaPlayerId(value);
    return String(value ?? "");
  }

  function arkNovaIsMyTurn(view = arkNovaView) {
    if (!view) return false;
    return String(view.you ?? view.player_id ?? "") === arkNovaCurrentPlayerId(view);
  }

  function arkNovaLegalTypes(view = arkNovaView) {
    const raw = view && (view.legal_actions || view.available_actions || view.actions);
    if (Array.isArray(raw)) {
      return new Set(raw.map((item) => typeof item === "string" ? item : item && (item.type || item.action)).filter(Boolean));
    }
    if (raw && typeof raw === "object") {
      return new Set(Object.entries(raw).filter(([, allowed]) => !!allowed).map(([type]) => type));
    }
    return new Set();
  }

  function arkNovaHasLegalActionsField(view = arkNovaView) {
    return !!view && (
      Object.hasOwn(view, "legal_actions")
      || Object.hasOwn(view, "available_actions")
      || Object.hasOwn(view, "actions")
    );
  }

  function arkNovaCan(actionType, view = arkNovaView) {
    if (!view || view.game_over) return false;
    const pending = view.pending_choice || view.pending;
    if (pending && actionType !== "resolve_choice" && actionType !== "keep_initial_cards") return false;
    const legal = arkNovaLegalTypes(view);
    if (arkNovaHasLegalActionsField(view)) return legal.has(actionType);
    if (actionType === "resolve_choice") {
      const owner = pending && pending.player_id;
      return !!pending && (!owner || String(owner) === String(view.you ?? view.player_id ?? ""));
    }
    return arkNovaIsMyTurn(view);
  }

  function arkNovaLog(message) {
    if (typeof window.log === "function") window.log(message);
  }

  function arkNovaSend(action) {
    if (!action || typeof action !== "object") return;
    if (typeof window.sendAction === "function") {
      window.sendAction(action);
      return;
    }
    arkNovaLog("Game action is unavailable");
  }

  function arkNovaSetModalVisible(modal, visible) {
    if (!modal) return;
    modal.classList.toggle("hidden", !visible);
    modal.setAttribute("aria-hidden", String(!visible));
    if (visible) {
      const focusTarget = modal.querySelector("button, [href], input, select, [tabindex]:not([tabindex='-1'])");
      if (focusTarget) window.setTimeout(() => focusTarget.focus(), 0);
    }
  }

  function arkNovaEnsureShell() {
    let panel = document.getElementById("arkNovaPanel");
    if (!panel) {
      const panelBody = document.querySelector(".game-panel > .panel-body") || document.querySelector(".game-panel") || document.body;
      panel = document.createElement("div");
      panel.id = "arkNovaPanel";
      panel.className = "hidden arkn-shell";
      panel.setAttribute("aria-label", "Ark Nova game board");
      panelBody.appendChild(panel);
    }

    if (!panel.dataset.arkNovaMounted) {
      panel.dataset.arkNovaMounted = "true";
      panel.innerHTML = `
        <div id="arkNovaStatus" class="arkn-status" aria-live="polite"></div>
        <div id="arkNovaPending" class="arkn-pending-wrap"></div>
        <div class="arkn-public-board">
          <section class="arkn-surface arkn-tracks-surface" aria-labelledby="arkNovaTracksTitle">
            <div class="arkn-section-heading"><h3 id="arkNovaTracksTitle">Public tracks</h3><span id="arkNovaBreakStatus" class="arkn-kicker"></span></div>
            <div id="arkNovaTracks"></div>
          </section>
          <section class="arkn-surface arkn-display-surface" aria-labelledby="arkNovaDisplayTitle">
            <div class="arkn-section-heading"><h3 id="arkNovaDisplayTitle">Card display</h3><span class="arkn-kicker">Folders 1–6</span></div>
            <div id="arkNovaDisplay" class="arkn-card-row"></div>
          </section>
          <section class="arkn-surface arkn-project-surface" aria-labelledby="arkNovaProjectsTitle">
            <div class="arkn-section-heading"><h3 id="arkNovaProjectsTitle">Conservation & Association</h3><span class="arkn-kicker">Shared board</span></div>
            <div id="arkNovaProjects"></div>
          </section>
        </div>
        <section class="arkn-player-strip-surface arkn-surface" aria-labelledby="arkNovaPlayersTitle">
          <div class="arkn-section-heading"><h3 id="arkNovaPlayersTitle">Zoos</h3><span id="arkNovaTurnHint" class="arkn-kicker"></span></div>
          <div id="arkNovaPlayers" class="arkn-player-strip"></div>
        </section>
        <div class="arkn-workspace">
          <section class="arkn-surface arkn-zoo-surface" aria-labelledby="arkNovaMapTitle">
            <div class="arkn-section-heading">
              <h3 id="arkNovaMapTitle">Your zoo · Map 0</h3>
              <div class="arkn-map-tools">
                <span id="arkNovaMapXStorage" class="arkn-map-x-storage" data-arkn-explain="x_tokens" title="Stored X-tokens"></span>
                <button type="button" class="arkn-map-info-button" data-arkn-command="map-info" data-arkn-explain-bypass aria-label="Show Map 0 information">ⓘ Map info</button>
              </div>
            </div>
            <div class="arkn-map-frame">
              <object id="arkNovaMapObject" class="arkn-map-object" type="image/svg+xml" data="${ARK_NOVA_MAP_URL}" aria-label="Interactive Map 0 zoo board"></object>
              <div id="arkNovaMapLoading" class="arkn-map-loading">Loading Map 0…</div>
            </div>
            <div id="arkNovaBuildings" class="arkn-building-list"></div>
          </section>
          <aside class="arkn-command-column">
            <section class="arkn-surface arkn-actions-surface" aria-labelledby="arkNovaActionsTitle">
              <div class="arkn-section-heading"><h3 id="arkNovaActionsTitle">Action cards</h3><span id="arkNovaPower" class="arkn-kicker"></span></div>
              <div id="arkNovaActionCards" class="arkn-action-rack"></div>
            </section>
            <section class="arkn-surface arkn-composer-surface" aria-labelledby="arkNovaComposerTitle">
              <div class="arkn-section-heading"><h3 id="arkNovaComposerTitle">Plan action</h3><span class="arkn-kicker">Server validated</span></div>
              <div id="arkNovaComposer"></div>
            </section>
          </aside>
        </div>
        <div class="arkn-lower-grid">
          <section class="arkn-surface arkn-cards-surface" aria-labelledby="arkNovaHandTitle">
            <div class="arkn-section-heading"><h3 id="arkNovaHandTitle">Your cards</h3><span id="arkNovaHandCount" class="arkn-kicker"></span></div>
            <div id="arkNovaHandChoice"></div>
            <div id="arkNovaHand" class="arkn-card-row arkn-card-row-hand"></div>
            <div class="arkn-played-heading">Played cards</div>
            <div id="arkNovaPlayed" class="arkn-card-row arkn-card-row-played"></div>
          </section>
          <section class="arkn-surface arkn-log-surface" aria-labelledby="arkNovaLogTitle">
            <div class="arkn-section-heading"><h3 id="arkNovaLogTitle">Event log</h3><span class="arkn-kicker">Newest first</span></div>
            <ol id="arkNovaLog" class="arkn-event-log"></ol>
          </section>
        </div>
        <div id="arkNovaToast" class="arkn-toast" role="status" aria-live="polite"></div>`;
      panel.addEventListener("click", arkNovaHandlePanelClick);
      panel.addEventListener("change", arkNovaHandlePanelChange);
      const mapObject = panel.querySelector("#arkNovaMapObject");
      if (mapObject) mapObject.addEventListener("load", arkNovaOnMapLoad);
    }

    let header = document.getElementById("arkNovaHeaderActions");
    if (!header) {
      const panelHeader = document.querySelector(".game-panel > .panel-header");
      if (panelHeader) {
        header = document.createElement("div");
        header.id = "arkNovaHeaderActions";
        header.className = "panel-header-actions arkn-header-actions";
        header.style.display = "none";
        header.innerHTML = `
          <button id="arkNovaHelpBtn" class="arkn-header-btn" type="button" data-arkn-explain-bypass>Help</button>
          <button id="arkNovaExplainBtn" class="arkn-header-btn" type="button" data-arkn-explain-bypass aria-pressed="false">Explain</button>`;
        panelHeader.appendChild(header);
      }
    }

    let modal = document.getElementById("arkNovaModal");
    if (!modal) {
      modal = document.createElement("section");
      modal.id = "arkNovaModal";
      modal.className = "modal hidden arkn-modal";
      modal.setAttribute("aria-hidden", "true");
      modal.setAttribute("role", "dialog");
      modal.setAttribute("aria-modal", "true");
      modal.setAttribute("aria-labelledby", "arkNovaModalTitle");
      modal.innerHTML = `
        <div class="modal-card arkn-modal-card">
          <div class="modal-header">
            <h3 id="arkNovaModalTitle">Ark Nova</h3>
            <button id="arkNovaModalCloseBtn" type="button" data-arkn-explain-bypass>Close</button>
          </div>
          <div id="arkNovaModalBody" class="modal-body arkn-modal-body"></div>
        </div>`;
      document.body.appendChild(modal);
      modal.addEventListener("click", (event) => {
        if (event.target === modal) arkNovaCloseModal();
      });
      modal.querySelector("#arkNovaModalCloseBtn").addEventListener("click", arkNovaCloseModal);
    }

    if (header && !header.dataset.arkNovaBound) {
      header.dataset.arkNovaBound = "true";
      const help = header.querySelector("#arkNovaHelpBtn");
      const explain = header.querySelector("#arkNovaExplainBtn");
      if (help) help.addEventListener("click", () => arkNovaOpenModal("How to play", ARK_NOVA_HELP_HTML, "help"));
      if (explain) explain.addEventListener("click", arkNovaToggleExplainMode);
    }
    return panel;
  }

  function arkNovaOpenModal(title, html, kind = "detail") {
    arkNovaEnsureShell();
    const modal = document.getElementById("arkNovaModal");
    const titleNode = document.getElementById("arkNovaModalTitle");
    const body = document.getElementById("arkNovaModalBody");
    if (!modal || !titleNode || !body) return;
    modal.dataset.kind = kind;
    titleNode.textContent = title;
    body.innerHTML = html;
    arkNovaSetModalVisible(modal, true);
  }

  function arkNovaCloseModal() {
    arkNovaSetModalVisible(document.getElementById("arkNovaModal"), false);
  }

  function arkNovaToast(message) {
    const toast = document.getElementById("arkNovaToast");
    if (!toast) return;
    toast.textContent = message;
    toast.classList.add("is-visible");
    window.clearTimeout(arkNovaToast.timeout);
    arkNovaToast.timeout = window.setTimeout(() => toast.classList.remove("is-visible"), 2400);
  }

  function arkNovaPlayerColor(index) {
    return ARK_NOVA_PLAYER_COLORS[index % ARK_NOVA_PLAYER_COLORS.length];
  }

  function arkNovaIndexCards(view) {
    const groups = [
      arkNovaDisplay(view), arkNovaHand(view), arkNovaProjects(view),
      arkNovaAsArray(view && view.card_catalog), arkNovaAsArray(view && view.cards),
      arkNovaAsArray(view && view.your_final_cards),
    ];
    arkNovaPlayers(view).forEach((player) => {
      groups.push(arkNovaAsArray(player.played_animals));
      groups.push(arkNovaAsArray(player.played_sponsors));
      groups.push(arkNovaAsArray(player.played_projects));
    });
    groups.flat().forEach((entry) => {
      const card = arkNovaCardObject(entry);
      const id = arkNovaCardId(card);
      if (id) arkNovaCardLookup.set(id, { ...(arkNovaCardLookup.get(id) || {}), ...card });
    });
  }

  function arkNovaIconMarkup(rawIcon) {
    const tag = typeof rawIcon === "string" ? rawIcon : rawIcon && (rawIcon.tag || rawIcon.type || rawIcon.icon);
    if (!tag) return "";
    const count = typeof rawIcon === "object" ? arkNovaNumber(rawIcon.count, 1) : 1;
    const normalized = String(tag).toLowerCase();
    const meta = ARK_NOVA_ICON_LABELS[normalized] || ["◆", arkNovaTitle(normalized)];
    return `<span class="arkn-icon-chip" title="${arkNovaEscape(meta[1])}"><span aria-hidden="true">${meta[0]}</span>${count > 1 ? `<b>×${count}</b>` : ""}<span class="sr-only">${arkNovaEscape(meta[1])}</span></span>`;
  }

  function arkNovaCardSummary(card) {
    const normalized = arkNovaCardObject(card);
    if (normalized.description_zh) return normalized.description_zh;
    if (normalized.raw && normalized.raw.effect_zh) return normalized.raw.effect_zh;
    const abilities = arkNovaAsArray(normalized.abilities);
    if (abilities.length) return abilities.map((ability) => ability.text_zh || ability.name_zh || ability.ability).filter(Boolean).join("；");
    const effects = arkNovaAsArray(normalized.effects);
    if (effects.length) return effects.map((effect) => effect.text_zh || effect.description_zh || effect.kind).filter(Boolean).join("；");
    return normalized.text_zh || normalized.summary_zh || "Card details available during play.";
  }

  function arkNovaRewardMarkup(card) {
    const normalized = arkNovaCardObject(card);
    const reward = normalized.printed_rewards || normalized.rewards || {};
    const chunks = [];
    const appeal = arkNovaNumber(reward.appeal ?? normalized.appeal);
    const conservation = arkNovaNumber(reward.conservation ?? normalized.conservation);
    const reputation = arkNovaNumber(reward.reputation ?? normalized.reputation);
    if (appeal) chunks.push(`<span title="Appeal">🎟 ${appeal}</span>`);
    if (conservation) chunks.push(`<span title="Conservation">🌿 ${conservation}</span>`);
    if (reputation) chunks.push(`<span title="Reputation">🎓 ${reputation}</span>`);
    return chunks.join("");
  }

  function arkNovaCardMarkup(rawCard, options = {}) {
    const card = arkNovaCardObject(rawCard);
    const id = arkNovaCardId(card);
    const type = arkNovaCardType(card);
    const pendingChoiceIndex = Number.isInteger(options.pendingChoiceIndex) ? options.pendingChoiceIndex : null;
    const selected = pendingChoiceIndex == null
      ? arkNovaUi.selectedCards.has(id)
      : arkNovaUi.pendingSelection.has(pendingChoiceIndex);
    const selectable = !!options.selectable || pendingChoiceIndex != null;
    const isHandCard = options.zone === "hand";
    const cost = card.play && card.play.base_money_cost != null ? card.play.base_money_cost : card.base_money_cost;
    const strength = card.play && (card.play.minimum_action_strength ?? card.play.strength ?? card.play.minimum_action_level_from_card_condition);
    const size = card.animal_size ?? card.size;
    const icons = arkNovaAsArray(card.icons).map(arkNovaIconMarkup).join("");
    const englishName = arkNovaCardEnglishName(card);
    const classes = ["arkn-card", `arkn-card-${arkNovaEscape(type)}`, selected ? "is-selected" : "", selectable ? "is-selectable" : ""].filter(Boolean).join(" ");
    const folder = options.folder != null ? `<span class="arkn-folder" title="Display folder ${options.folder}">${options.folder}</span>` : "";
    const hidden = !id && card.hidden;
    if (hidden) return `<div class="arkn-card arkn-card-back" aria-label="Hidden card"><span>ARK</span><b>NOVA</b></div>`;
    const mainInteraction = pendingChoiceIndex != null
      ? `data-arkn-pending-card-index="${pendingChoiceIndex}" data-arkn-explain="pending_choice" aria-pressed="${selected}"`
      : selectable
        ? `data-arkn-card-select data-zone="${arkNovaEscape(options.zone || "")}" data-arkn-explain="${type === "animal" ? "animal_card" : type === "sponsor" ? "sponsor_card" : "card_info"}" aria-pressed="${selected}"`
      : isHandCard
        ? `disabled aria-label="${arkNovaEscape(arkNovaCardName(card))}. Use the information button for card details."`
        : `data-arkn-card-info="${arkNovaEscape(id)}" data-arkn-explain="card_info"`;
    return `
      <article class="${classes}" data-card-id="${arkNovaEscape(id)}" data-card-type="${arkNovaEscape(type)}">
        ${folder}
        <button type="button" class="arkn-card-main" ${mainInteraction}>
          <span class="arkn-card-topline"><span class="arkn-card-id">#${arkNovaEscape(id || "—")}</span><span class="arkn-card-kind">${arkNovaEscape(arkNovaTitle(type))}</span></span>
          <strong class="arkn-card-name">${arkNovaEscape(arkNovaCardName(card))}</strong>
          ${englishName && englishName !== arkNovaCardName(card) ? `<span class="arkn-card-en">${arkNovaEscape(englishName)}</span>` : ""}
          <span class="arkn-card-stats">
            ${cost != null ? `<span title="Money cost">💰 ${arkNovaEscape(cost)}</span>` : ""}
            ${strength != null ? `<span title="Required strength">⚡ ${arkNovaEscape(strength)}</span>` : ""}
            ${size != null ? `<span title="Enclosure size">⬡ ${arkNovaEscape(size)}</span>` : ""}
            ${arkNovaRewardMarkup(card)}
          </span>
          <span class="arkn-card-icons">${icons}</span>
          <span class="arkn-card-text">${arkNovaEscape(arkNovaCardSummary(card))}</span>
        </button>
        <button type="button" class="arkn-card-info" data-arkn-card-info="${arkNovaEscape(id)}" data-arkn-explain="card_info" aria-label="View ${arkNovaEscape(arkNovaCardName(card))} details">i</button>
      </article>`;
  }

  function arkNovaDetailRows(object) {
    if (!object || typeof object !== "object") return "";
    return Object.entries(object).filter(([, value]) => value != null && value !== "" && (!Array.isArray(value) || value.length)).map(([key, value]) => {
      let rendered;
      if (Array.isArray(value)) rendered = value.map((item) => typeof item === "object" ? (item.text_zh || item.name_zh || item.ability || item.tag || JSON.stringify(item)) : item).join(" · ");
      else if (typeof value === "object") rendered = JSON.stringify(value);
      else rendered = String(value);
      return `<dt>${arkNovaEscape(arkNovaTitle(key))}</dt><dd>${arkNovaEscape(rendered)}</dd>`;
    }).join("");
  }

  function arkNovaShowCardDetail(id) {
    const card = arkNovaCardLookup.get(String(id));
    if (!card) {
      arkNovaOpenModal(`Card #${id}`, `<p>This card is hidden or its catalog data is not present in the current view.</p>`, "card");
      return;
    }
    const icons = arkNovaAsArray(card.icons).map(arkNovaIconMarkup).join("");
    const abilityRows = [...arkNovaAsArray(card.abilities), ...arkNovaAsArray(card.effects)].map((ability) => `
      <li><strong>${arkNovaEscape(ability.name_zh || arkNovaTitle(ability.ability || ability.kind || ability.timing))}</strong><span>${arkNovaEscape(ability.text_zh || ability.description_zh || "")}</span></li>`).join("");
    const html = `
      <article class="arkn-detail-card arkn-detail-${arkNovaEscape(arkNovaCardType(card))}">
        <div class="arkn-detail-heading"><span>#${arkNovaEscape(arkNovaCardId(card))}</span><strong>${arkNovaEscape(arkNovaCardName(card))}</strong><em>${arkNovaEscape(arkNovaCardEnglishName(card))}</em></div>
        <div class="arkn-detail-icons">${icons}${arkNovaRewardMarkup(card)}</div>
        <p>${arkNovaEscape(arkNovaCardSummary(card))}</p>
        ${abilityRows ? `<h4>Abilities & effects</h4><ul class="arkn-effect-list">${abilityRows}</ul>` : ""}
        <dl class="arkn-detail-list">
          ${arkNovaDetailRows(card.play)}
          ${card.animal_size != null ? `<dt>Animal size</dt><dd>${arkNovaEscape(card.animal_size)}</dd>` : ""}
          ${arkNovaDetailRows(card.placement)}
        </dl>
      </article>`;
    arkNovaOpenModal(arkNovaCardName(card), html, "card");
  }

  function arkNovaStatusMarkup(view) {
    const players = arkNovaPlayers(view);
    const currentId = arkNovaCurrentPlayerId(view);
    const current = players.find((player) => arkNovaPlayerId(player) === currentId);
    const phase = arkNovaTitle(view.phase || view.stage || "waiting");
    const round = view.round ?? view.break_count;
    const deck = view.deck_count ?? view.deck_remaining ?? (view.deck && view.deck.length);
    const chips = [
      `<span class="arkn-status-chip arkn-status-phase"><b>${arkNovaEscape(phase)}</b></span>`,
      `<span class="arkn-status-chip"><small>Turn</small><b>${arkNovaEscape(current ? arkNovaPlayerName(current) : currentId || "—")}</b></span>`,
      round != null ? `<span class="arkn-status-chip"><small>Breaks</small><b>${arkNovaEscape(round)}</b></span>` : "",
      deck != null ? `<span class="arkn-status-chip"><small>Deck</small><b>${arkNovaEscape(deck)}</b></span>` : "",
      view.game_over ? `<span class="arkn-status-chip arkn-status-over"><b>Final scoring</b></span>` : "",
    ];
    return `<div class="arkn-brand"><span class="arkn-brand-mark" aria-hidden="true">AN</span><span><strong>Ark Nova</strong><small>Map 0</small></span></div><div class="arkn-status-chips">${chips.join("")}</div>`;
  }

  function arkNovaTrackMarkup(view, key, label, icon, maximum) {
    const markers = arkNovaPlayers(view).map((player, index) => {
      const value = arkNovaTrack(player, key);
      const position = Math.max(0, Math.min(100, value / maximum * 100));
      return `<span class="arkn-track-marker" style="--arkn-marker:${arkNovaPlayerColor(index)};left:${position}%" title="${arkNovaEscape(arkNovaPlayerName(player))}: ${value}"><span>${arkNovaEscape(String(arkNovaPlayerName(player)).slice(0, 1).toUpperCase())}</span></span>`;
    }).join("");
    return `<div class="arkn-track-row"><div class="arkn-track-name"><span aria-hidden="true">${icon}</span><b>${label}</b><small>0–${maximum}</small></div><div class="arkn-track-rail">${markers}<span class="arkn-track-start">0</span><span class="arkn-track-end">${maximum}</span></div></div>`;
  }

  function arkNovaRenderTracks(view) {
    const container = document.getElementById("arkNovaTracks");
    if (!container) return;
    const breakPosition = arkNovaNumber(view.break_position ?? view.break_track);
    const breakLimit = Math.max(1, arkNovaNumber(view.break_limit ?? view.break_track_limit, 15));
    container.innerHTML = `
      <div class="arkn-tracks">
        ${arkNovaTrackMarkup(view, "appeal", "Appeal", "🎟", 113)}
        ${arkNovaTrackMarkup(view, "conservation", "Conservation", "🌿", 40)}
        ${arkNovaTrackMarkup(view, "reputation", "Reputation", "🎓", 15)}
      </div>
      <div class="arkn-break-track" aria-label="Break marker ${breakPosition} of ${breakLimit}">
        <span><b>☕ Break</b><small>${breakPosition} / ${breakLimit}</small></span>
        <div class="arkn-progress"><i style="width:${Math.max(0, Math.min(100, breakPosition / breakLimit * 100))}%"></i></div>
      </div>`;
    const breakStatus = document.getElementById("arkNovaBreakStatus");
    if (breakStatus) breakStatus.textContent = `${Math.max(0, breakLimit - breakPosition)} spaces to Break`;
  }

  function arkNovaRenderDisplay(view) {
    const container = document.getElementById("arkNovaDisplay");
    if (!container) return;
    const cards = arkNovaDisplay(view);
    const selectedAction = arkNovaUi.selectedAction;
    const selectable = arkNovaIsMyTurn(view) && !view.pending_choice && ["cards", "animals", "sponsors"].includes(selectedAction);
    container.innerHTML = cards.length ? cards.map((card, index) => arkNovaCardMarkup(card, { selectable, zone: "display", folder: index + 1 })).join("") : `<div class="arkn-empty">The display is empty.</div>`;
  }

  function arkNovaSupplyItems(raw, fallbackLabel) {
    if (!raw) return `<span class="arkn-supply-chip is-empty">${fallbackLabel}: —</span>`;
    if (Array.isArray(raw)) return raw.map((item) => {
      const value = typeof item === "object" ? (item.name || item.id || item.type || JSON.stringify(item)) : item;
      const available = typeof item !== "object" || item.available !== false;
      return `<span class="arkn-supply-chip ${available ? "" : "is-empty"}">${arkNovaEscape(value)}</span>`;
    }).join("");
    if (typeof raw === "object") return Object.entries(raw).map(([key, value]) => `<span class="arkn-supply-chip ${arkNovaNumber(value, value ? 1 : 0) ? "" : "is-empty"}">${arkNovaEscape(arkNovaTitle(key))} <b>${arkNovaEscape(typeof value === "object" ? value.count ?? "" : value)}</b></span>`).join("");
    return `<span class="arkn-supply-chip">${arkNovaEscape(raw)}</span>`;
  }

  function arkNovaRenderProjects(view) {
    const container = document.getElementById("arkNovaProjects");
    if (!container) return;
    const projects = arkNovaProjects(view);
    const supply = view.association_supply || view.association || {};
    const projectMarkup = projects.length ? projects.map((entry) => {
      const card = arkNovaCardObject(entry);
      const supporters = arkNovaAsArray(entry.supporters || entry.support || entry.slots).map((slot) => {
        const player = arkNovaPlayers(view).find((candidate) => arkNovaPlayerId(candidate) === String(slot.player_id ?? slot.player ?? ""));
        return `<span>${arkNovaEscape(player ? arkNovaPlayerName(player) : slot.player_name || slot.player_id || "Open")} · ${arkNovaEscape(slot.slot ?? slot.position ?? "")}</span>`;
      }).join("");
      return `<div class="arkn-project-card">${arkNovaCardMarkup(card, { selectable: arkNovaUi.selectedAction === "association" && arkNovaIsMyTurn(view), zone: "project" })}<div class="arkn-supporters">${supporters || "<span>Open support slots</span>"}</div></div>`;
    }).join("") : `<div class="arkn-empty">No conservation projects are visible.</div>`;
    container.innerHTML = `
      <div class="arkn-project-row">${projectMarkup}</div>
      <div class="arkn-association-supply">
        <div><b>Partner zoos</b><div>${arkNovaSupplyItems(supply.partner_zoos || supply.partnerZoos, "Partner zoos")}</div></div>
        <div><b>Universities</b><div>${arkNovaSupplyItems(supply.universities, "Universities")}</div></div>
        <div><b>Donations</b><div>${arkNovaSupplyItems(supply.donations || supply.donation_slots, "Donations")}</div></div>
      </div>`;
  }

  function arkNovaRenderPlayers(view) {
    const container = document.getElementById("arkNovaPlayers");
    if (!container) return;
    const currentId = arkNovaCurrentPlayerId(view);
    const youId = String(view.you ?? view.player_id ?? "");
    container.innerHTML = arkNovaPlayers(view).map((player, index) => {
      const id = arkNovaPlayerId(player);
      const finalScore = view.scores && (view.scores[id] ?? view.scores[arkNovaPlayerName(player)]);
      return `<article class="arkn-player ${id === currentId ? "is-current" : ""} ${id === youId ? "is-you" : ""}" style="--arkn-player:${arkNovaPlayerColor(index)}">
        <div class="arkn-player-name"><i></i><strong>${arkNovaEscape(arkNovaPlayerName(player))}</strong>${id === youId ? "<small>You</small>" : ""}${id === currentId ? "<span>Active</span>" : ""}</div>
        <div class="arkn-player-resources">
          <span title="Money">💰 <b>${arkNovaResource(player, "money")}</b></span>
          <span title="Appeal">🎟 <b>${arkNovaTrack(player, "appeal")}</b></span>
          <span title="Conservation">🌿 <b>${arkNovaTrack(player, "conservation")}</b></span>
          <span title="Reputation">🎓 <b>${arkNovaTrack(player, "reputation")}</b></span>
          <span title="X-tokens">✕ <b>${arkNovaResource(player, "x_tokens")}</b></span>
          <span title="Available workers">♟ <b>${arkNovaResource(player, "workers")}</b></span>
          <span title="Cards in hand">🂠 <b>${arkNovaNumber(player.hand_count ?? (player.hand && player.hand.length))}</b></span>
          ${finalScore != null ? `<span title="Final score">🏁 <b>${arkNovaEscape(finalScore)}</b></span>` : ""}
        </div>
      </article>`;
    }).join("") || `<div class="arkn-empty">Waiting for players.</div>`;
    const current = arkNovaPlayers(view).find((player) => arkNovaPlayerId(player) === currentId);
    const hint = document.getElementById("arkNovaTurnHint");
    if (hint) hint.textContent = view.game_over ? "Game complete" : arkNovaIsMyTurn(view) ? "Your turn" : `Waiting for ${current ? arkNovaPlayerName(current) : "another zoo"}`;
  }

  function arkNovaActionCards(player) {
    const source = player && (player.action_cards || player.actions || player.action_rack);
    if (source && !Array.isArray(source) && typeof source === "object") {
      return Object.entries(source).map(([id, entry], index) => typeof entry === "object" ? { id, ...entry } : { id, slot: arkNovaNumber(entry, index + 1) });
    }
    const raw = arkNovaAsArray(source);
    if (raw.length) return raw.map((entry, index) => typeof entry === "string" ? { id: entry, slot: index + 1 } : entry);
    return Object.keys(ARK_NOVA_ACTIONS).map((id, index) => ({ id, slot: index + 1, upgraded: false }));
  }

  function arkNovaActionId(card) {
    return String(card && (card.id || card.action || card.type || card.name) || "").toLowerCase();
  }

  function arkNovaSelectedActionCard(view = arkNovaView) {
    return arkNovaActionCards(arkNovaYou(view)).find((card) => arkNovaActionId(card) === arkNovaUi.selectedAction) || null;
  }

  function arkNovaActionUpgraded(actionId, view = arkNovaView) {
    const card = arkNovaActionCards(arkNovaYou(view)).find((entry) => arkNovaActionId(entry) === actionId);
    return !!(card && (card.upgraded || card.level === 2 || card.side === "II"));
  }

  function arkNovaBaseStrength(view = arkNovaView) {
    const card = arkNovaSelectedActionCard(view);
    return Math.max(1, Math.min(5, arkNovaNumber(card && (card.slot ?? card.position ?? card.strength), 1)));
  }

  function arkNovaActionStrength(view = arkNovaView) {
    return Math.min(5, arkNovaBaseStrength(view) + arkNovaUi.xTokens);
  }

  function arkNovaRenderActions(view) {
    const container = document.getElementById("arkNovaActionCards");
    if (!container) return;
    const canChoose = arkNovaIsMyTurn(view) && !view.pending_choice && !view.game_over;
    const actions = arkNovaActionCards(arkNovaYou(view)).slice().sort((a, b) => arkNovaNumber(a.slot ?? a.position) - arkNovaNumber(b.slot ?? b.position));
    container.innerHTML = actions.map((card) => {
      const id = arkNovaActionId(card);
      const meta = ARK_NOVA_ACTIONS[id] || { name: arkNovaTitle(id), icon: "⚡", color: "gray", description: "Game action" };
      const slot = Math.max(1, Math.min(5, arkNovaNumber(card.slot ?? card.position ?? card.strength, 1)));
      const upgraded = !!(card.upgraded || card.level === 2 || card.side === "II");
      const selected = arkNovaUi.selectedAction === id;
      return `<div class="arkn-action-wrap" style="--arkn-order:${slot}">
        <span class="arkn-slot-number">${slot}</span>
        <button type="button" class="arkn-action-card arkn-action-${arkNovaEscape(meta.color)} ${selected ? "is-selected" : ""}" data-arkn-action-card="${arkNovaEscape(id)}" data-arkn-explain="action_card" aria-pressed="${selected}" ${canChoose ? "" : "disabled"}>
          <span class="arkn-action-icon" aria-hidden="true">${meta.icon}</span><strong>${arkNovaEscape(meta.name)}</strong><small>Side ${upgraded ? "II" : "I"}</small>
          ${upgraded ? "<i>UPGRADED</i>" : ""}
        </button>
      </div>`;
    }).join("");
    const power = document.getElementById("arkNovaPower");
    if (power) power.textContent = arkNovaUi.selectedAction ? `Strength ${arkNovaActionStrength(view)}` : "Choose an action";
  }

  function arkNovaPlayerMap(player) {
    return player && (player.map || player.zoo_map || player.board) || {};
  }

  function arkNovaBuildings(player = arkNovaYou()) {
    const map = arkNovaPlayerMap(player);
    const direct = arkNovaAsArray(map.buildings || (player && player.buildings));
    if (direct.length) return direct.map((building, index) => ({ id: building.id || building.building_id || `building-${index + 1}`, ...building }));
    const occupancy = map.occupancy;
    if (!occupancy || typeof occupancy !== "object") return [];
    const grouped = new Map();
    Object.entries(occupancy).forEach(([cell, raw]) => {
      const value = raw && typeof raw === "object" ? raw : { id: raw };
      const id = String(value.id || value.building_id || value.type || `cell-${cell}`);
      if (!grouped.has(id)) grouped.set(id, { id, building_type: value.building_type || value.type || "building", cells: [] });
      grouped.get(id).cells.push(cell);
    });
    return [...grouped.values()];
  }

  function arkNovaBuildingType(building) {
    return String(building && (building.building_type || building.type || building.kind) || "building");
  }

  function arkNovaBuildingCells(building) {
    return arkNovaAsArray(building && (building.cells || building.hexes || building.occupied_cells)).map(String);
  }

  function arkNovaEnclosures(view = arkNovaView) {
    return arkNovaBuildings(arkNovaYou(view)).filter((building) => {
      const type = arkNovaBuildingType(building);
      return type.includes("enclosure") || ["petting_zoo", "reptile_house", "large_bird_aviary"].includes(type);
    });
  }

  function arkNovaRenderBuildings(view) {
    const container = document.getElementById("arkNovaBuildings");
    const xStorage = document.getElementById("arkNovaMapXStorage");
    if (!container) return;
    const buildings = arkNovaBuildings(arkNovaYou(view));
    if (xStorage) {
      const mapDefinition = view.map_definition || view.map || {};
      const limit = Math.max(1, arkNovaNumber(mapDefinition.x_token_limit, 5));
      xStorage.innerHTML = `<span aria-hidden="true">✕</span><small>X-tokens</small><b>${arkNovaResource(arkNovaYou(view), "x_tokens")} / ${limit}</b>`;
    }
    container.innerHTML = buildings.length ? buildings.map((building) => {
      const type = arkNovaBuildingType(building);
      const meta = ARK_NOVA_BUILDINGS[type] || { name: arkNovaTitle(type), icon: "⬡" };
      const animal = building.animal || building.animal_id || building.occupant;
      return `<span class="arkn-building-chip"><b>${meta.icon} ${arkNovaEscape(meta.name)}</b><small>${arkNovaBuildingCells(building).join(", ") || `${building.size || "?"} hex`}${animal ? ` · 🐾 #${arkNovaEscape(animal)}` : ""}</small></span>`;
    }).join("") : `<div class="arkn-empty arkn-empty-inline">No buildings yet. Your first building must touch the zoo edge.</div>`;
  }

  function arkNovaMapCellType(cellId) {
    if (!arkNovaMapDocument) return null;
    const cell = arkNovaMapDocument.querySelector(`[data-cell-id="${CSS.escape(String(cellId))}"]`);
    return cell && cell.dataset;
  }

  function arkNovaOccupiedCells(view = arkNovaView) {
    const occupied = new Map();
    arkNovaBuildings(arkNovaYou(view)).forEach((building) => {
      arkNovaBuildingCells(building).forEach((cell) => occupied.set(cell, building));
    });
    arkNovaUi.buildQueue.forEach((building, index) => {
      building.cells.forEach((cell) => occupied.set(cell, { ...building, id: `draft-${index}` }));
    });
    return occupied;
  }

  function arkNovaPendingMapChoice(view = arkNovaView) {
    const pending = view && (view.pending_choice || view.pending);
    if (!pending) return null;
    const type = String(pending.type || pending.kind || pending.choice_type || "");
    return ["place_free_enclosure", "place_unique_building"].includes(type) ? pending : null;
  }

  function arkNovaPendingMapSize(pending) {
    if (!pending) return 0;
    const footprint = pending.footprint || (pending.building && pending.building.footprint) || (pending.unique_building && pending.unique_building.footprint);
    const footprintSize = Array.isArray(footprint)
      ? footprint.length
      : footprint && typeof footprint === "object"
        ? arkNovaNumber(footprint.cell_count ?? footprint.size, arkNovaAsArray(footprint.cells).length)
        : 0;
    return Math.max(1, arkNovaNumber(
      pending.size
      ?? pending.enclosure_size
      ?? pending.footprint_size
      ?? pending.required_cells
      ?? pending.cell_count
      ?? (pending.building && pending.building.size)
      ?? footprintSize,
      1,
    ));
  }

  function arkNovaOnMapLoad(event) {
    const object = event.currentTarget;
    try {
      arkNovaMapDocument = object.contentDocument;
    } catch (_error) {
      arkNovaMapDocument = null;
    }
    const loading = document.getElementById("arkNovaMapLoading");
    if (loading) loading.classList.toggle("hidden", !!arkNovaMapDocument);
    if (!arkNovaMapDocument) return;
    arkNovaMapDocument.querySelectorAll("[data-cell-id]").forEach((cell) => {
      cell.addEventListener("click", () => arkNovaHandleMapCell(cell.dataset.cellId));
      cell.addEventListener("keydown", (keyEvent) => {
        if (keyEvent.key === "Enter" || keyEvent.key === " ") {
          keyEvent.preventDefault();
          arkNovaHandleMapCell(cell.dataset.cellId);
        }
      });
    });
    arkNovaApplyMapState();
  }

  function arkNovaApplyMapState() {
    if (!arkNovaMapDocument || !arkNovaView) return;
    const occupied = arkNovaOccupiedCells(arkNovaView);
    const drafting = (arkNovaUi.selectedAction === "build" && arkNovaCan("build")) || !!arkNovaPendingMapChoice();
    const selected = new Set(arkNovaUi.buildCells);
    const queuedCells = new Set(arkNovaUi.buildQueue.flatMap((building) => building.cells));
    arkNovaMapDocument.querySelectorAll("[data-cell-id]").forEach((cell) => {
      const id = cell.dataset.cellId;
      const polygon = cell.querySelector(".ark-nova-map0-hex");
      cell.classList.remove("is-valid", "is-selected", "is-covered");
      if (polygon) {
        if (!polygon.dataset.arkNovaFill) polygon.dataset.arkNovaFill = polygon.getAttribute("fill") || "";
        polygon.setAttribute("fill", polygon.dataset.arkNovaFill);
        polygon.removeAttribute("fill-opacity");
      }
      if (occupied.has(id)) {
        cell.classList.add("is-covered");
        const building = occupied.get(id);
        const meta = ARK_NOVA_BUILDINGS[arkNovaBuildingType(building)] || { color: "#7e8c85" };
        if (polygon) {
          polygon.setAttribute("fill", meta.color);
          polygon.setAttribute("fill-opacity", queuedCells.has(id) ? ".68" : ".9");
        }
      } else if (drafting && cell.dataset.buildable === "true") {
        cell.classList.add("is-valid");
      }
      if (selected.has(id)) cell.classList.add("is-selected");
    });
  }

  function arkNovaHandleMapCell(cellId) {
    const pendingMap = arkNovaPendingMapChoice();
    const normalBuild = arkNovaUi.selectedAction === "build" && arkNovaCan("build");
    if (arkNovaExplainMode || (!pendingMap && !normalBuild)) return;
    const data = arkNovaMapCellType(cellId);
    if (!data || data.buildable !== "true") {
      arkNovaToast("That Map 0 hex cannot be built on.");
      return;
    }
    if (arkNovaOccupiedCells().has(cellId) && !arkNovaUi.buildCells.includes(cellId)) {
      arkNovaToast("That hex is already occupied.");
      return;
    }
    const index = arkNovaUi.buildCells.indexOf(cellId);
    if (index >= 0) arkNovaUi.buildCells.splice(index, 1);
    else {
      const limit = pendingMap ? arkNovaPendingMapSize(pendingMap) : Infinity;
      if (arkNovaUi.buildCells.length >= limit) {
        arkNovaToast(`Select exactly ${limit} footprint hex${limit === 1 ? "" : "es"}.`);
        return;
      }
      arkNovaUi.buildCells.push(cellId);
    }
    arkNovaApplyMapState();
    arkNovaRenderComposer(arkNovaView);
    if (pendingMap) arkNovaRenderPending(arkNovaView);
  }

  function arkNovaCellToAxial(cellId) {
    const match = /^([A-I])(\d+)$/.exec(String(cellId));
    if (!match) return null;
    const q = match[1].charCodeAt(0) - 65;
    const row = Number(match[2]);
    return { q, r: row - 1 - Math.ceil(q / 2) };
  }

  function arkNovaAxialToCell(q, r) {
    if (!Number.isInteger(q) || q < 0 || q > 8) return null;
    const row = r + 1 + Math.ceil(q / 2);
    const maximum = q % 2 === 0 ? 6 : 7;
    if (!Number.isInteger(row) || row < 1 || row > maximum) return null;
    return `${String.fromCharCode(65 + q)}${row}`;
  }

  function arkNovaRotateFootprint() {
    if (arkNovaUi.buildCells.length < 2) {
      arkNovaToast("Select at least two hexes to rotate a footprint.");
      return;
    }
    const pivot = arkNovaCellToAxial(arkNovaUi.buildCells[0]);
    const rotated = arkNovaUi.buildCells.map((cellId) => {
      const cell = arkNovaCellToAxial(cellId);
      if (!cell || !pivot) return null;
      const q = cell.q - pivot.q;
      const r = cell.r - pivot.r;
      return arkNovaAxialToCell(pivot.q + q + r, pivot.r - q);
    });
    const occupied = arkNovaOccupiedCells();
    if (rotated.some((id) => !id || !arkNovaMapCellType(id) || arkNovaMapCellType(id).buildable !== "true" || occupied.has(id))) {
      arkNovaToast("The rotated footprint does not fit on the board.");
      return;
    }
    arkNovaUi.buildCells = rotated;
    arkNovaApplyMapState();
    arkNovaRenderComposer(arkNovaView);
    if (arkNovaPendingMapChoice()) arkNovaRenderPending(arkNovaView);
  }

  function arkNovaChoiceOptions(pending) {
    return arkNovaAsArray(pending && (pending.options || pending.choices || pending.allowed_values || pending.card_ids || pending.candidates));
  }

  function arkNovaHandDiscardChoice(view = arkNovaView) {
    const pending = view && (view.pending_choice || view.pending);
    if (!pending || String(pending.type || pending.kind || "").toLowerCase() !== "discard_cards") return null;
    const owner = pending.player_id;
    const viewer = view && (view.you ?? view.player_id);
    if (owner != null && viewer != null && String(owner) !== String(viewer)) return null;
    const handIds = new Set(arkNovaHand(view).map(arkNovaCardId));
    const options = arkNovaChoiceOptions(pending);
    if (!options.length || options.some((option) => !handIds.has(String(arkNovaPendingOptionValue(option))))) return null;
    return pending;
  }

  function arkNovaRenderHand(view) {
    const handNode = document.getElementById("arkNovaHand");
    const choiceNode = document.getElementById("arkNovaHandChoice");
    const playedNode = document.getElementById("arkNovaPlayed");
    if (!handNode || !choiceNode || !playedNode) return;
    const hand = arkNovaHand(view);
    const selectedAction = arkNovaUi.selectedAction;
    const phase = String(view.phase || "");
    const setup = phase.includes("keep") || arkNovaCan("keep_initial_cards");
    const discardChoice = arkNovaHandDiscardChoice(view);
    const selectable = !discardChoice && (setup || (["animals", "sponsors", "association"].includes(selectedAction) && arkNovaIsMyTurn(view) && !view.pending_choice));
    const discardOptions = discardChoice ? arkNovaChoiceOptions(discardChoice) : [];
    const optionIndexByCard = new Map(discardOptions.map((option, index) => [String(arkNovaPendingOptionValue(option)), index]));
    handNode.innerHTML = hand.length ? hand.map((card) => {
      const cardId = arkNovaCardId(card);
      const pendingChoiceIndex = optionIndexByCard.has(cardId) ? optionIndexByCard.get(cardId) : null;
      return arkNovaCardMarkup(card, { selectable, zone: "hand", pendingChoiceIndex });
    }).join("") : `<div class="arkn-empty">Your hand is empty.</div>`;
    if (discardChoice) {
      const { minimum, maximum } = arkNovaPendingBounds(discardChoice);
      const selectedCount = arkNovaUi.pendingSelection.size;
      const valid = selectedCount >= minimum && selectedCount <= maximum;
      const target = minimum === maximum ? String(minimum) : `${minimum}–${maximum}`;
      choiceNode.innerHTML = `<div class="arkn-hand-choice" role="group" aria-labelledby="arkNovaHandChoiceTitle">
        <div><strong id="arkNovaHandChoiceTitle">${arkNovaEscape(discardChoice.prompt || `Discard ${target} card(s)`)}</strong><small>Choose directly from your cards below. Use <i>i</i> only to inspect details.</small></div>
        <output aria-live="polite"><b>${selectedCount}</b> / ${target} selected</output>
        <div class="arkn-hand-choice-actions"><button type="button" class="arkn-confirm" data-arkn-command="resolve-choice" data-arkn-explain="pending_choice" ${valid && arkNovaCan("resolve_choice") ? "" : "disabled"}>Discard selected</button>${discardChoice.allow_skip || minimum === 0 ? `<button type="button" data-arkn-command="skip-choice">Skip</button>` : ""}</div>
      </div>`;
    } else choiceNode.innerHTML = "";
    const you = arkNovaYou(view) || {};
    const played = [
      ...arkNovaAsArray(you.played_animals).map((card) => ({ card, zone: "Animals" })),
      ...arkNovaAsArray(you.played_sponsors).map((card) => ({ card, zone: "Sponsors" })),
      ...arkNovaAsArray(you.played_projects).map((card) => ({ card, zone: "Projects" })),
    ];
    playedNode.innerHTML = played.length ? played.map((entry) => `<div class="arkn-played-card"><span>${entry.zone}</span>${arkNovaCardMarkup(entry.card)}</div>`).join("") : `<div class="arkn-empty">No cards played yet.</div>`;
    const count = document.getElementById("arkNovaHandCount");
    if (count) count.textContent = `${hand.length} card${hand.length === 1 ? "" : "s"}`;
  }

  function arkNovaXControl(view) {
    const available = arkNovaResource(arkNovaYou(view), "x_tokens");
    const maximum = Math.max(0, Math.min(available, 5 - arkNovaBaseStrength(view)));
    if (arkNovaUi.xTokens > maximum) arkNovaUi.xTokens = maximum;
    return `<div class="arkn-x-control" data-arkn-explain="x_tokens">
      <span><b>Commit X-tokens</b><small>${available} available · max ${maximum}</small></span>
      <div><button type="button" data-arkn-command="x-minus" aria-label="Use one fewer X-token" ${arkNovaUi.xTokens <= 0 ? "disabled" : ""}>−</button><output>${arkNovaUi.xTokens}</output><button type="button" data-arkn-command="x-plus" aria-label="Use one more X-token" ${arkNovaUi.xTokens >= maximum ? "disabled" : ""}>+</button></div>
    </div>`;
  }

  function arkNovaSelectedCardObjects(zone) {
    const source = zone === "display" ? arkNovaDisplay() : arkNovaHand();
    return source.map(arkNovaCardObject).filter((card) => arkNovaUi.selectedCards.has(arkNovaCardId(card)));
  }

  function arkNovaSelectedCardsForType(type) {
    return [...arkNovaSelectedCardObjects("hand"), ...arkNovaSelectedCardObjects("display")].filter((card) => arkNovaCardType(card) === type);
  }

  function arkNovaBuildingQueueMarkup() {
    if (!arkNovaUi.buildQueue.length) return `<div class="arkn-empty arkn-empty-inline">No buildings queued.</div>`;
    return `<ol class="arkn-plan-list">${arkNovaUi.buildQueue.map((building) => {
      const meta = ARK_NOVA_BUILDINGS[building.building_type] || { name: arkNovaTitle(building.building_type), icon: "⬡" };
      return `<li><span>${meta.icon}</span><b>${arkNovaEscape(meta.name)}</b><small>${building.cells.join(", ")}</small></li>`;
    }).join("")}</ol>`;
  }

  function arkNovaRenderCardsComposer(view) {
    const snapCard = arkNovaSelectedCardObjects("display")[0];
    const selectedDisplay = arkNovaSelectedCardObjects("display");
    const upgraded = arkNovaActionUpgraded("cards", view);
    return `${arkNovaXControl(view)}
      <div class="arkn-segmented" role="group" aria-label="Cards action mode">
        <button type="button" class="${arkNovaUi.actionMode === "draw" ? "is-active" : ""}" data-arkn-mode="draw" data-arkn-explain="cards_draw">Draw</button>
        <button type="button" class="${arkNovaUi.actionMode === "snap" ? "is-active" : ""}" data-arkn-mode="snap" data-arkn-explain="cards_snap">Snap display card</button>
      </div>
      <div class="arkn-plan-summary">${arkNovaUi.actionMode === "snap" ? (snapCard ? `Snap <b>${arkNovaEscape(arkNovaCardName(snapCard))}</b>` : "Select one display card above.") : selectedDisplay.length ? `Take ${selectedDisplay.map((card) => `<b>${arkNovaEscape(arkNovaCardName(card))}</b>`).join(", ")} from reputation range; draw any remainder from the deck.` : upgraded ? "Optionally select cards in reputation range, or draw from the deck." : "Draw from the deck according to the final action strength."}</div>
      ${arkNovaComposerFooter("cards", arkNovaUi.actionMode !== "snap" || !!snapCard)}`;
  }

  function arkNovaRenderBuildComposer(view) {
    const meta = ARK_NOVA_BUILDINGS[arkNovaUi.buildType] || ARK_NOVA_BUILDINGS.standard_enclosure;
    const required = meta.variable ? Math.max(1, arkNovaUi.buildSize) : meta.size;
    const footprintReady = arkNovaUi.buildCells.length === required;
    return `${arkNovaXControl(view)}
      <div class="arkn-form-grid">
        <label data-arkn-explain="build_type"><span>Building</span><select id="arkNovaBuildType">${Object.entries(ARK_NOVA_BUILDINGS).map(([id, definition]) => `<option value="${id}" ${id === arkNovaUi.buildType ? "selected" : ""}>${definition.icon} ${arkNovaEscape(definition.name)}</option>`).join("")}</select></label>
        ${meta.variable ? `<label><span>Size</span><select id="arkNovaBuildSize">${[1, 2, 3, 4, 5].map((size) => `<option value="${size}" ${size === arkNovaUi.buildSize ? "selected" : ""}>${size} hex${size === 1 ? "" : "es"}</option>`).join("")}</select></label>` : `<div class="arkn-fixed-field"><span>Footprint</span><b>${required} hexes</b></div>`}
      </div>
      <div class="arkn-map-draft"><span><b>Selected footprint</b><small>${arkNovaUi.buildCells.length} / ${required} hexes</small></span><output>${arkNovaUi.buildCells.join(" · ") || "Select hexes on Map 0"}</output></div>
      <div class="arkn-inline-actions">
        <button type="button" data-arkn-command="rotate-build" data-arkn-explain="rotate_footprint" ${arkNovaUi.buildCells.length < 2 ? "disabled" : ""}>↻ Rotate</button>
        <button type="button" data-arkn-command="queue-build" data-arkn-explain="queue_building" ${footprintReady ? "" : "disabled"}>Add building</button>
        <button type="button" class="arkn-quiet" data-arkn-command="undo-build" data-arkn-explain="undo" ${arkNovaUi.buildQueue.length ? "" : "disabled"}>Undo queued</button>
      </div>
      ${arkNovaBuildingQueueMarkup()}
      ${arkNovaComposerFooter("build", arkNovaUi.buildQueue.length > 0, "Build queued plan", "confirm_build")}`;
  }

  function arkNovaAnimalPlanMarkup(view) {
    const animals = arkNovaSelectedCardsForType("animal");
    const enclosures = arkNovaEnclosures(view);
    if (!animals.length) return `<div class="arkn-empty arkn-empty-inline">Select Animal cards from your hand or eligible display folders.</div>`;
    return `<div class="arkn-animal-plan">${animals.map((card) => {
      const id = arkNovaCardId(card);
      const selectedEnclosure = arkNovaUi.animalEnclosures.get(id) || "";
      return `<label data-arkn-explain="animal_enclosure"><span><b>🐾 ${arkNovaEscape(arkNovaCardName(card))}</b><small>#${arkNovaEscape(id)}</small></span><select data-arkn-enclosure-for="${arkNovaEscape(id)}"><option value="">Choose enclosure</option>${enclosures.map((building) => `<option value="${arkNovaEscape(building.id)}" ${String(building.id) === selectedEnclosure ? "selected" : ""}>${arkNovaEscape(arkNovaTitle(arkNovaBuildingType(building)))} · ${arkNovaBuildingCells(building).join(", ")}</option>`).join("")}</select></label>`;
    }).join("")}</div>`;
  }

  function arkNovaRenderAnimalsComposer(view) {
    const animals = arkNovaSelectedCardsForType("animal");
    const ready = animals.length > 0 && animals.every((card) => arkNovaUi.animalEnclosures.get(arkNovaCardId(card)));
    return `${arkNovaXControl(view)}<p class="arkn-composer-help">Select Animal cards, then assign each one to an enclosure.</p>${arkNovaAnimalPlanMarkup(view)}${arkNovaComposerFooter("animals", ready)}`;
  }

  function arkNovaSupplyOptions(raw, defaults = []) {
    const items = arkNovaAsArray(raw);
    const source = items.length ? items : defaults;
    return source.map((item) => {
      const id = typeof item === "object" ? item.id || item.type || item.name : item;
      const label = typeof item === "object" ? item.name || arkNovaTitle(item.type || item.id) : arkNovaTitle(item);
      return `<option value="${arkNovaEscape(id)}">${arkNovaEscape(label)}</option>`;
    }).join("");
  }

  function arkNovaAssociationFields(view) {
    const draft = arkNovaUi.associationDraft;
    const supply = view.association_supply || view.association || {};
    const partnerZoos = arkNovaAsArray(supply.available_partner_zoos).length
      ? arkNovaAsArray(supply.available_partner_zoos)
      : ARK_NOVA_CONTINENTS;
    const universities = arkNovaAsArray(supply.available_universities).length
      ? supply.available_universities
      : supply.universities;
    if (draft.task === "partner_zoo") return `<label><span>Continent</span><select id="arkNovaAssociationContinent">${partnerZoos.map((continent) => `<option value="${arkNovaEscape(continent)}" ${draft.continent === continent ? "selected" : ""}>${arkNovaEscape(arkNovaTitle(continent))}</option>`).join("")}</select></label>`;
    if (draft.task === "university") return `<label><span>University</span><select id="arkNovaAssociationUniversity"><option value="">Choose university</option>${arkNovaSupplyOptions(universities, ["university_reputation", "university_science", "university_hand_limit"])}</select></label>`;
    if (draft.task === "support_project") return `<label><span>Project</span><select id="arkNovaAssociationProject"><option value="">Choose project</option>${arkNovaProjects(view).map((entry) => {
      const card = arkNovaCardObject(entry);
      return `<option value="${arkNovaEscape(arkNovaCardId(card))}" ${String(draft.project_id) === arkNovaCardId(card) ? "selected" : ""}>${arkNovaEscape(arkNovaCardName(card))}</option>`;
    }).join("")}</select></label><label><span>Support slot</span><select id="arkNovaAssociationSlot">${[1, 2, 3].map((slot) => `<option value="${slot}" ${Number(draft.slot) === slot ? "selected" : ""}>${slot}</option>`).join("")}</select></label>`;
    return `<div class="arkn-fixed-field"><span>Task reward</span><b>🎓 +2 reputation</b></div>`;
  }

  function arkNovaAssociationQueueMarkup() {
    if (!arkNovaUi.associationQueue.length) return `<div class="arkn-empty arkn-empty-inline">No association tasks queued.</div>`;
    return `<ol class="arkn-plan-list">${arkNovaUi.associationQueue.map((task) => `<li><span>♟</span><b>${arkNovaEscape(arkNovaTitle(task.task))}</b><small>${arkNovaEscape(task.continent || task.university_id || task.project_id || "")}</small></li>`).join("")}</ol>`;
  }

  function arkNovaRenderAssociationComposer(view) {
    const draft = arkNovaUi.associationDraft;
    return `${arkNovaXControl(view)}
      <div class="arkn-form-grid arkn-association-form" data-arkn-explain="association_task">
        <label><span>Task</span><select id="arkNovaAssociationTask"><option value="reputation" ${draft.task === "reputation" ? "selected" : ""}>🎓 Gain 2 reputation</option><option value="partner_zoo" ${draft.task === "partner_zoo" ? "selected" : ""}>🌍 Take partner zoo</option><option value="university" ${draft.task === "university" ? "selected" : ""}>🏫 Take university</option><option value="support_project" ${draft.task === "support_project" ? "selected" : ""}>🌿 Support project</option></select></label>
        ${arkNovaAssociationFields(view)}
      </div>
      <div class="arkn-inline-actions"><button type="button" data-arkn-command="queue-association" data-arkn-explain="association_task">Add task</button><button type="button" class="arkn-quiet" data-arkn-command="undo-association" data-arkn-explain="undo" ${arkNovaUi.associationQueue.length ? "" : "disabled"}>Undo task</button></div>
      ${arkNovaAssociationQueueMarkup()}
      <label class="arkn-check-row" data-arkn-explain="donation"><input id="arkNovaDonate" type="checkbox" ${arkNovaUi.donate ? "checked" : ""}><span><b>Donate after tasks</b><small>Requires upgraded Association</small></span></label>
      ${arkNovaComposerFooter("association", arkNovaUi.associationQueue.length > 0)}`;
  }

  function arkNovaRenderSponsorsComposer(view) {
    const sponsors = arkNovaSelectedCardsForType("sponsor");
    return `${arkNovaXControl(view)}
      <div class="arkn-segmented" role="group" aria-label="Sponsors action mode"><button type="button" class="${arkNovaUi.actionMode === "play" ? "is-active" : ""}" data-arkn-mode="play" data-arkn-explain="sponsor_card">Play cards</button><button type="button" class="${arkNovaUi.actionMode === "break" ? "is-active" : ""}" data-arkn-mode="break">Break for money</button></div>
      <div class="arkn-plan-summary">${arkNovaUi.actionMode === "break" ? "Advance Break by final strength and gain money." : sponsors.length ? `Play ${sponsors.map((card) => `<b>${arkNovaEscape(arkNovaCardName(card))}</b>`).join(", ")}` : "Select Sponsor cards from your hand or eligible display folders."}</div>
      ${arkNovaComposerFooter("sponsors", arkNovaUi.actionMode === "break" || sponsors.length > 0)}`;
  }

  function arkNovaComposerFooter(actionType, ready, label, explanation = "confirm_action") {
    const action = ARK_NOVA_ACTIONS[actionType] || {};
    const canSubmit = ready && arkNovaCan(actionType);
    const gainX = arkNovaCan("gain_x");
    return `<div class="arkn-composer-footer">
      <button type="button" class="arkn-confirm" data-arkn-command="submit-action" data-arkn-explain="${explanation}" ${canSubmit ? "" : "disabled"}>${arkNovaEscape(label || `Confirm ${action.name || arkNovaTitle(actionType)}`)}</button>
      <button type="button" class="arkn-gain-x" data-arkn-command="gain-x" data-arkn-explain="gain_x" ${gainX ? "" : "disabled"}>✕ Take X instead</button>
    </div>`;
  }

  function arkNovaRenderSetupComposer(view) {
    const selected = [...arkNovaUi.selectedCards];
    return `<div class="arkn-setup-plan"><span><b>Choose your opening hand</b><small>${selected.length} / 4 selected</small></span><p>Select exactly four cards below. Your two final scoring cards remain private.</p></div><button type="button" class="arkn-confirm arkn-full-button" data-arkn-command="keep-cards" data-arkn-explain="keep_cards" ${selected.length === 4 && arkNovaCan("keep_initial_cards") ? "" : "disabled"}>Keep selected cards</button>`;
  }

  function arkNovaRenderComposer(view) {
    const container = document.getElementById("arkNovaComposer");
    if (!container) return;
    const phase = String(view.phase || "");
    if (phase.includes("keep") || arkNovaCan("keep_initial_cards")) {
      container.innerHTML = arkNovaRenderSetupComposer(view);
      return;
    }
    if (phase === "setup") {
      container.innerHTML = `<div class="arkn-waiting"><span>🂠</span><strong>Waiting for opening hands</strong><p>Every zoo must keep four cards before the first action begins.</p></div>`;
      return;
    }
    if (view.game_over) {
      const winnerIds = arkNovaAsArray(view.winner || view.winners).map(String);
      const winnerNames = winnerIds.map((id) => {
        const player = arkNovaPlayers(view).find((candidate) => arkNovaPlayerId(candidate) === id);
        return player ? arkNovaPlayerName(player) : id;
      });
      container.innerHTML = `<div class="arkn-game-over"><span>🏁</span><strong>${winnerNames.length ? `Winner: ${arkNovaEscape(winnerNames.join(", "))}` : "Final scoring"}</strong><p>Appeal, conservation threshold, final scoring cards, and end-game effects determine the result.</p></div>`;
      return;
    }
    if (view.pending_choice || view.pending) {
      container.innerHTML = `<div class="arkn-waiting"><span>✦</span><strong>Resolve the highlighted choice</strong><p>Other actions are paused until this effect is complete.</p></div>`;
      return;
    }
    if (!arkNovaIsMyTurn(view)) {
      container.innerHTML = `<div class="arkn-waiting"><span>⏳</span><strong>Another zoo is acting</strong><p>You can inspect cards, Map 0, tracks, and Explain controls while you wait.</p></div>`;
      return;
    }
    if (!arkNovaUi.selectedAction) {
      container.innerHTML = `<div class="arkn-waiting"><span>⚡</span><strong>Choose an Action card</strong><p>Cards farther to the right are stronger. Select one above to plan the turn.</p></div>`;
      return;
    }
    const renderers = {
      cards: arkNovaRenderCardsComposer,
      build: arkNovaRenderBuildComposer,
      animals: arkNovaRenderAnimalsComposer,
      association: arkNovaRenderAssociationComposer,
      sponsors: arkNovaRenderSponsorsComposer,
    };
    container.innerHTML = renderers[arkNovaUi.selectedAction] ? renderers[arkNovaUi.selectedAction](view) : `<div class="arkn-empty">This action is not available.</div>`;
  }

  function arkNovaPendingOptionValue(option) {
    if (option && typeof option === "object") {
      if (Object.hasOwn(option, "value")) return option.value;
      if (Object.hasOwn(option, "id")) return option.id;
      if (Object.hasOwn(option, "card_id")) return option.card_id;
    }
    return option;
  }

  function arkNovaPendingOptionLabel(option) {
    if (option && typeof option === "object") return option.label || option.name || option.text || option.card_name || option.id || option.card_id || JSON.stringify(option.value ?? option);
    return String(option);
  }

  function arkNovaPendingBounds(pending) {
    const minimum = Math.max(0, arkNovaNumber(pending.min ?? pending.minimum ?? pending.min_choices, 1));
    const maximum = Math.max(minimum, arkNovaNumber(pending.max ?? pending.maximum ?? pending.max_choices, 1));
    return { minimum, maximum };
  }

  function arkNovaRenderPending(view) {
    const container = document.getElementById("arkNovaPending");
    if (!container) return;
    const pending = view.pending_choice || view.pending;
    if (!pending) {
      container.innerHTML = "";
      arkNovaPendingOptions = [];
      arkNovaUi.pendingSelection.clear();
      return;
    }
    const pendingMap = arkNovaPendingMapChoice(view);
    if (pendingMap) {
      arkNovaPendingOptions = [];
      const required = arkNovaPendingMapSize(pendingMap);
      const ready = arkNovaUi.buildCells.length === required;
      container.innerHTML = `<section class="arkn-pending arkn-surface" aria-labelledby="arkNovaPendingTitle">
        <div class="arkn-pending-copy"><span>⬡</span><div><h3 id="arkNovaPendingTitle">${arkNovaEscape(pending.prompt || (String(pending.type).includes("unique") ? "Place unique building" : "Place free enclosure"))}</h3><p>Select the complete footprint directly on Map 0. ${arkNovaEscape(pending.detail || pending.description || "Terrain, occupancy, adjacency, and shape are validated when confirmed.")}</p></div></div>
        <div class="arkn-map-draft"><span><b>Selected footprint</b><small>${arkNovaUi.buildCells.length} / ${required} hexes</small></span><output>${arkNovaUi.buildCells.join(" · ") || "Select hexes on Map 0"}</output></div>
        <div class="arkn-pending-actions"><button type="button" data-arkn-command="rotate-build" data-arkn-explain="rotate_footprint" ${arkNovaUi.buildCells.length < 2 ? "disabled" : ""}>↻ Rotate</button><button type="button" class="arkn-confirm" data-arkn-command="resolve-choice" data-arkn-explain="pending_choice" ${ready && arkNovaCan("resolve_choice") ? "" : "disabled"}>Confirm footprint</button>${pending.allow_skip ? `<button type="button" data-arkn-command="skip-choice">Skip</button>` : ""}</div>
      </section>`;
      return;
    }
    arkNovaPendingOptions = arkNovaChoiceOptions(pending);
    if (arkNovaHandDiscardChoice(view)) {
      container.innerHTML = "";
      return;
    }
    const { minimum, maximum } = arkNovaPendingBounds(pending);
    const selectedCount = arkNovaUi.pendingSelection.size;
    const valid = selectedCount >= minimum && selectedCount <= maximum;
    const optionMarkup = arkNovaPendingOptions.length ? arkNovaPendingOptions.map((option, index) => {
      const selected = arkNovaUi.pendingSelection.has(index);
      const disabled = option && typeof option === "object" && option.disabled;
      return `<button type="button" class="arkn-choice-option ${selected ? "is-selected" : ""}" data-arkn-choice-index="${index}" data-arkn-explain="pending_choice" aria-pressed="${selected}" ${disabled ? "disabled" : ""}><strong>${arkNovaEscape(arkNovaPendingOptionLabel(option))}</strong>${option && option.detail ? `<small>${arkNovaEscape(option.detail)}</small>` : ""}</button>`;
    }).join("") : `<div class="arkn-empty arkn-empty-inline">Waiting for available options…</div>`;
    container.innerHTML = `<section class="arkn-pending arkn-surface" aria-labelledby="arkNovaPendingTitle">
      <div class="arkn-pending-copy"><span>✦</span><div><h3 id="arkNovaPendingTitle">${arkNovaEscape(pending.prompt || pending.label || arkNovaTitle(pending.type || "Resolve choice"))}</h3><p>Select ${minimum === maximum ? minimum : `${minimum}–${maximum}`} option${maximum === 1 ? "" : "s"}. ${arkNovaEscape(pending.detail || pending.description || "This effect must resolve before play continues.")}</p></div></div>
      <div class="arkn-choice-options">${optionMarkup}</div>
      <div class="arkn-pending-actions"><button type="button" class="arkn-confirm" data-arkn-command="resolve-choice" data-arkn-explain="pending_choice" ${valid && arkNovaCan("resolve_choice") ? "" : "disabled"}>Confirm choice</button>${pending.allow_skip || minimum === 0 ? `<button type="button" data-arkn-command="skip-choice">Skip</button>` : ""}</div>
    </section>`;
  }

  function arkNovaEventText(event) {
    if (typeof event === "string") return event;
    if (!event || typeof event !== "object") return "Game updated";
    const payload = event.payload || event.data || {};
    const actor = event.player_name || payload.name || payload.player_name || "";
    const type = event.message || event.text || event.type || event.event || "Game updated";
    const action = payload.action && (payload.action.type || payload.action.action);
    return [actor, arkNovaTitle(action || type)].filter(Boolean).join(" · ");
  }

  function arkNovaCaptureEvents(data, view) {
    const events = [...arkNovaAsArray(data && data.events), ...arkNovaAsArray(view && (view.events || view.log || view.history))];
    events.forEach((event) => {
      let key;
      try { key = JSON.stringify(event); } catch (_error) { key = String(event); }
      if (arkNovaEventKeys.has(key)) return;
      arkNovaEventKeys.add(key);
      arkNovaEventLog.push({ text: arkNovaEventText(event), time: event && (event.time || event.timestamp) });
    });
    if (arkNovaEventLog.length > 100) arkNovaEventLog = arkNovaEventLog.slice(-100);
    if (arkNovaEventKeys.size > 300) arkNovaEventKeys = new Set(events.map((event) => {
      try { return JSON.stringify(event); } catch (_error) { return String(event); }
    }));
  }

  function arkNovaRenderLog() {
    const container = document.getElementById("arkNovaLog");
    if (!container) return;
    const items = arkNovaEventLog.slice().reverse();
    container.innerHTML = items.length ? items.map((item) => `<li><i></i><span>${arkNovaEscape(item.text)}</span>${item.time ? `<time>${arkNovaEscape(item.time)}</time>` : ""}</li>`).join("") : `<li class="arkn-log-empty">Actions and triggered effects will appear here.</li>`;
  }

  function arkNovaRenderFinalCards(view) {
    const cards = arkNovaAsArray(view.your_final_cards || view.final_scoring_cards);
    if (!cards.length) return;
    cards.forEach((card) => {
      const normalized = arkNovaCardObject(card);
      const id = arkNovaCardId(normalized);
      if (id) arkNovaCardLookup.set(id, normalized);
    });
  }

  function arkNovaContextKey(view) {
    return [view.phase, arkNovaCurrentPlayerId(view), view.pending_choice && (view.pending_choice.choice_id || view.pending_choice.id || view.pending_choice.type), view.turn_number].join("|");
  }

  function arkNovaResetDraft(options = {}) {
    arkNovaUi.xTokens = 0;
    arkNovaUi.actionMode = "draw";
    arkNovaUi.selectedCards.clear();
    arkNovaUi.buildCells = [];
    arkNovaUi.buildQueue = [];
    arkNovaUi.animalEnclosures.clear();
    arkNovaUi.associationQueue = [];
    arkNovaUi.donate = false;
    arkNovaUi.pendingSelection.clear();
    if (!options.keepAction) arkNovaUi.selectedAction = null;
  }

  function arkNovaReconcileDraft(view) {
    const key = arkNovaContextKey(view);
    if (arkNovaLastContextKey && key !== arkNovaLastContextKey) arkNovaResetDraft();
    arkNovaLastContextKey = key;
    const handIds = new Set(arkNovaHand(view).map(arkNovaCardId));
    const displayIds = new Set(arkNovaDisplay(view).map(arkNovaCardId));
    [...arkNovaUi.selectedCards].forEach((id) => {
      if (!handIds.has(id) && !displayIds.has(id) && !arkNovaProjects(view).some((card) => arkNovaCardId(arkNovaCardObject(card)) === id)) arkNovaUi.selectedCards.delete(id);
    });
  }

  function arkNovaRenderAll(data) {
    const panel = arkNovaEnsureShell();
    const view = data && (data.view || data.state || data.game) || data;
    if (!view || typeof view !== "object") throw new Error("Ark Nova game view is missing");
    arkNovaCurrentData = data;
    arkNovaView = view;
    arkNovaIndexCards(view);
    arkNovaRenderFinalCards(view);
    arkNovaReconcileDraft(view);
    panel.classList.remove("hidden");
    document.getElementById("arkNovaStatus").innerHTML = arkNovaStatusMarkup(view);
    arkNovaRenderPending(view);
    arkNovaRenderTracks(view);
    arkNovaRenderDisplay(view);
    arkNovaRenderProjects(view);
    arkNovaRenderPlayers(view);
    arkNovaRenderActions(view);
    arkNovaRenderBuildings(view);
    arkNovaRenderHand(view);
    arkNovaRenderComposer(view);
    arkNovaCaptureEvents(data, view);
    arkNovaRenderLog();
    arkNovaApplyMapState();
  }

  function arkNovaRerenderInteractive() {
    if (!arkNovaView) return;
    arkNovaRenderDisplay(arkNovaView);
    arkNovaRenderProjects(arkNovaView);
    arkNovaRenderActions(arkNovaView);
    arkNovaRenderHand(arkNovaView);
    arkNovaRenderComposer(arkNovaView);
    arkNovaApplyMapState();
  }

  function arkNovaToggleSelectedCard(id, zone, type) {
    if (!id || !arkNovaView) return;
    const phase = String(arkNovaView.phase || "");
    const setup = phase.includes("keep") || arkNovaCan("keep_initial_cards");
    if (setup) {
      if (zone !== "hand") return;
      if (!arkNovaUi.selectedCards.has(id) && arkNovaUi.selectedCards.size >= 4) {
        arkNovaToast("Choose exactly four opening cards.");
        return;
      }
    } else if (arkNovaUi.selectedAction === "cards") {
      if (zone !== "display") return;
      if (arkNovaUi.actionMode === "snap") {
        arkNovaUi.selectedCards.clear();
      } else {
        if (!arkNovaActionUpgraded("cards")) {
          arkNovaToast("Upgrade Cards before taking display cards during a normal draw.");
          return;
        }
        const drawByStrength = { 1: 1, 2: 2, 3: 2, 4: 3, 5: 4 };
        const maximum = drawByStrength[arkNovaActionStrength()] || 1;
        if (!arkNovaUi.selectedCards.has(id) && arkNovaUi.selectedCards.size >= maximum) {
          arkNovaToast(`This action can take at most ${maximum} card${maximum === 1 ? "" : "s"}.`);
          return;
        }
      }
    } else if (arkNovaUi.selectedAction === "animals") {
      if (type !== "animal") {
        arkNovaToast("The Animals action can only play Animal cards.");
        return;
      }
    } else if (arkNovaUi.selectedAction === "sponsors") {
      if (type !== "sponsor") {
        arkNovaToast("The Sponsors action can only play Sponsor cards.");
        return;
      }
    } else if (arkNovaUi.selectedAction === "association") {
      if (type !== "conservation_project") {
        arkNovaToast("Select a conservation project for this task.");
        return;
      }
      arkNovaUi.selectedCards.clear();
      arkNovaUi.associationDraft.project_id = id;
      arkNovaUi.associationDraft.task = "support_project";
    } else return;
    if (arkNovaUi.selectedCards.has(id)) {
      arkNovaUi.selectedCards.delete(id);
      arkNovaUi.animalEnclosures.delete(id);
    } else arkNovaUi.selectedCards.add(id);
    arkNovaRerenderInteractive();
  }

  function arkNovaQueueBuilding() {
    const meta = ARK_NOVA_BUILDINGS[arkNovaUi.buildType] || ARK_NOVA_BUILDINGS.standard_enclosure;
    const size = meta.variable ? arkNovaUi.buildSize : meta.size;
    if (arkNovaUi.buildCells.length !== size) return;
    arkNovaUi.buildQueue.push({ building_type: arkNovaUi.buildType, ...(meta.variable ? { size } : {}), cells: [...arkNovaUi.buildCells] });
    arkNovaUi.buildCells = [];
    arkNovaRerenderInteractive();
  }

  function arkNovaQueueAssociation() {
    const draft = { task: arkNovaUi.associationDraft.task };
    if (draft.task === "partner_zoo") draft.continent = arkNovaUi.associationDraft.continent;
    if (draft.task === "university") {
      if (!arkNovaUi.associationDraft.university_id) return arkNovaToast("Choose a university.");
      draft.university_id = arkNovaUi.associationDraft.university_id;
    }
    if (draft.task === "support_project") {
      if (!arkNovaUi.associationDraft.project_id) return arkNovaToast("Choose a conservation project.");
      draft.project_id = arkNovaUi.associationDraft.project_id;
      draft.slot = arkNovaNumber(arkNovaUi.associationDraft.slot, 3);
      if (arkNovaUi.associationDraft.project_card_id) draft.project_card_id = arkNovaUi.associationDraft.project_card_id;
      if (arkNovaUi.associationDraft.release_animal_id) draft.release_animal_id = arkNovaUi.associationDraft.release_animal_id;
    }
    if (arkNovaUi.associationQueue.some((task) => task.task === draft.task)) return arkNovaToast("Each Association task can only be queued once in an action.");
    arkNovaUi.associationQueue.push(draft);
    arkNovaRerenderInteractive();
  }

  function arkNovaSubmitAction() {
    if (!arkNovaView || !arkNovaUi.selectedAction) return;
    const type = arkNovaUi.selectedAction;
    const x_tokens = arkNovaUi.xTokens;
    let action;
    if (type === "cards") {
      action = { type, x_tokens, mode: arkNovaUi.actionMode };
      if (arkNovaUi.actionMode === "snap") {
        const card = arkNovaSelectedCardObjects("display")[0];
        if (!card) return;
        action.display_card_id = arkNovaCardId(card);
      } else {
        const selectedDisplay = arkNovaSelectedCardObjects("display");
        if (selectedDisplay.length) action.market_card_ids = selectedDisplay.map(arkNovaCardId);
      }
    } else if (type === "build") {
      if (!arkNovaUi.buildQueue.length) return;
      action = { type, x_tokens, buildings: arkNovaUi.buildQueue.map((building) => ({ ...building, cells: [...building.cells] })) };
    } else if (type === "animals") {
      const animals = arkNovaSelectedCardsForType("animal");
      if (!animals.length || animals.some((card) => !arkNovaUi.animalEnclosures.get(arkNovaCardId(card)))) return;
      const displayIds = new Set(arkNovaDisplay().map(arkNovaCardId));
      action = { type, x_tokens, plays: animals.map((card) => ({ card_id: arkNovaCardId(card), enclosure_id: arkNovaUi.animalEnclosures.get(arkNovaCardId(card)), source: displayIds.has(arkNovaCardId(card)) ? "display" : "hand" })) };
    } else if (type === "association") {
      if (!arkNovaUi.associationQueue.length) return;
      action = { type, x_tokens, tasks: arkNovaUi.associationQueue.map((task) => ({ ...task })), donate: !!arkNovaUi.donate };
    } else if (type === "sponsors") {
      action = { type, x_tokens, mode: arkNovaUi.actionMode };
      if (arkNovaUi.actionMode === "play") {
        const sponsors = arkNovaSelectedCardsForType("sponsor");
        if (!sponsors.length) return;
        action.card_ids = sponsors.map(arkNovaCardId);
      }
    }
    if (!action || !arkNovaCan(type)) return;
    arkNovaSend(action);
  }

  function arkNovaResolveChoice(skip = false) {
    const pending = arkNovaView && (arkNovaView.pending_choice || arkNovaView.pending);
    if (!pending) return;
    const pendingMap = arkNovaPendingMapChoice();
    if (!skip && pendingMap) {
      arkNovaSend({ type: "resolve_choice", choice_id: pending.choice_id || pending.id || pending.type, selection: { cells: [...arkNovaUi.buildCells] } });
      return;
    }
    const values = [...arkNovaUi.pendingSelection].sort((a, b) => a - b).map((index) => arkNovaPendingOptionValue(arkNovaPendingOptions[index]));
    const { maximum } = arkNovaPendingBounds(pending);
    const selection = skip ? null : maximum === 1 ? values[0] : values;
    arkNovaSend({ type: "resolve_choice", choice_id: pending.choice_id || pending.id || pending.type, selection });
  }

  function arkNovaHandleCommand(command) {
    if (!arkNovaView) return;
    if (command === "map-info") return arkNovaOpenModal("Map 0 information", ARK_NOVA_MAP_INFO_HTML, "map-info");
    if (command === "x-minus") arkNovaUi.xTokens = Math.max(0, arkNovaUi.xTokens - 1);
    else if (command === "x-plus") arkNovaUi.xTokens += 1;
    else if (command === "rotate-build") return arkNovaRotateFootprint();
    else if (command === "queue-build") return arkNovaQueueBuilding();
    else if (command === "undo-build") arkNovaUi.buildQueue.pop();
    else if (command === "queue-association") return arkNovaQueueAssociation();
    else if (command === "undo-association") arkNovaUi.associationQueue.pop();
    else if (command === "submit-action") return arkNovaSubmitAction();
    else if (command === "gain-x") {
      if (arkNovaUi.selectedAction && arkNovaCan("gain_x")) arkNovaSend({ type: "gain_x", action_card: arkNovaUi.selectedAction });
      return;
    } else if (command === "keep-cards") {
      if (arkNovaUi.selectedCards.size === 4 && arkNovaCan("keep_initial_cards")) arkNovaSend({ type: "keep_initial_cards", card_ids: [...arkNovaUi.selectedCards] });
      return;
    } else if (command === "resolve-choice") return arkNovaResolveChoice(false);
    else if (command === "skip-choice") return arkNovaResolveChoice(true);
    arkNovaRerenderInteractive();
  }

  function arkNovaTogglePendingChoiceIndex(index) {
    const pending = arkNovaView && (arkNovaView.pending_choice || arkNovaView.pending);
    if (!pending || !Number.isInteger(index)) return;
    arkNovaPendingOptions = arkNovaChoiceOptions(pending);
    if (index < 0 || index >= arkNovaPendingOptions.length) return;
    const { maximum } = arkNovaPendingBounds(pending);
    if (arkNovaUi.pendingSelection.has(index)) arkNovaUi.pendingSelection.delete(index);
    else {
      if (maximum === 1) arkNovaUi.pendingSelection.clear();
      if (arkNovaUi.pendingSelection.size < maximum) arkNovaUi.pendingSelection.add(index);
    }
    arkNovaRenderPending(arkNovaView);
    arkNovaRenderHand(arkNovaView);
  }

  function arkNovaHandlePanelClick(event) {
    const target = event.target instanceof Element ? event.target : null;
    if (!target || arkNovaExplainMode) return;
    const info = target.closest("[data-arkn-card-info]");
    if (info) return arkNovaShowCardDetail(info.dataset.arknCardInfo);
    const pendingCard = target.closest("[data-arkn-pending-card-index]");
    if (pendingCard) return arkNovaTogglePendingChoiceIndex(Number(pendingCard.dataset.arknPendingCardIndex));
    const actionCard = target.closest("[data-arkn-action-card]");
    if (actionCard) {
      const id = actionCard.dataset.arknActionCard;
      if (id !== arkNovaUi.selectedAction) {
        arkNovaResetDraft();
        arkNovaUi.selectedAction = id;
        arkNovaUi.actionMode = id === "sponsors" ? "play" : "draw";
      } else arkNovaResetDraft();
      return arkNovaRerenderInteractive();
    }
    const cardButton = target.closest("[data-arkn-card-select]");
    if (cardButton) {
      const cardNode = cardButton.closest("[data-card-id]");
      return arkNovaToggleSelectedCard(cardNode && cardNode.dataset.cardId, cardButton.dataset.zone, cardNode && cardNode.dataset.cardType);
    }
    const mode = target.closest("[data-arkn-mode]");
    if (mode) {
      arkNovaUi.actionMode = mode.dataset.arknMode;
      arkNovaUi.selectedCards.clear();
      return arkNovaRerenderInteractive();
    }
    const choice = target.closest("[data-arkn-choice-index]");
    if (choice) return arkNovaTogglePendingChoiceIndex(Number(choice.dataset.arknChoiceIndex));
    const command = target.closest("[data-arkn-command]");
    if (command) return arkNovaHandleCommand(command.dataset.arknCommand);
    if (!target.closest("button, input, select, label, .arkn-card, .arkn-map-frame")) {
      arkNovaUi.selectedCards.clear();
      arkNovaUi.buildCells = [];
      arkNovaUi.pendingSelection.clear();
      arkNovaRerenderInteractive();
      arkNovaRenderPending(arkNovaView);
    }
  }

  function arkNovaHandlePanelChange(event) {
    const target = event.target;
    if (!(target instanceof HTMLInputElement || target instanceof HTMLSelectElement)) return;
    if (target.id === "arkNovaBuildType") {
      arkNovaUi.buildType = target.value;
      const meta = ARK_NOVA_BUILDINGS[target.value];
      if (meta && !meta.variable) arkNovaUi.buildSize = meta.size;
      arkNovaUi.buildCells = [];
    } else if (target.id === "arkNovaBuildSize") {
      arkNovaUi.buildSize = arkNovaNumber(target.value, 1);
      arkNovaUi.buildCells = [];
    } else if (target.dataset.arknEnclosureFor) {
      arkNovaUi.animalEnclosures.set(target.dataset.arknEnclosureFor, target.value);
    } else if (target.id === "arkNovaAssociationTask") {
      arkNovaUi.associationDraft.task = target.value;
    } else if (target.id === "arkNovaAssociationContinent") {
      arkNovaUi.associationDraft.continent = target.value;
    } else if (target.id === "arkNovaAssociationUniversity") {
      arkNovaUi.associationDraft.university_id = target.value;
    } else if (target.id === "arkNovaAssociationProject") {
      arkNovaUi.associationDraft.project_id = target.value;
    } else if (target.id === "arkNovaAssociationSlot") {
      arkNovaUi.associationDraft.slot = arkNovaNumber(target.value, 3);
    } else if (target.id === "arkNovaDonate") {
      arkNovaUi.donate = target.checked;
    }
    arkNovaRerenderInteractive();
  }

  function arkNovaToggleExplainMode() {
    arkNovaExplainMode = !arkNovaExplainMode;
    document.body.classList.toggle("arkn-explain-mode", arkNovaExplainMode);
    document.querySelectorAll("[data-arkn-explain]").forEach((control) => control.classList.toggle("has-explanation", arkNovaExplainMode));
    const button = document.getElementById("arkNovaExplainBtn");
    if (button) {
      button.classList.toggle("active", arkNovaExplainMode);
      button.setAttribute("aria-pressed", String(arkNovaExplainMode));
    }
  }

  function arkNovaExitExplainMode() {
    if (!arkNovaExplainMode) return;
    arkNovaExplainMode = false;
    document.body.classList.remove("arkn-explain-mode");
    document.querySelectorAll("[data-arkn-explain]").forEach((control) => control.classList.remove("has-explanation"));
    const button = document.getElementById("arkNovaExplainBtn");
    if (button) {
      button.classList.remove("active");
      button.setAttribute("aria-pressed", "false");
    }
  }

  function arkNovaExplainedControlAt(x, y) {
    const controls = document.querySelectorAll("#arkNovaPanel [data-arkn-explain], #arkNovaHeaderActions [data-arkn-explain]");
    for (const control of controls) {
      const rect = control.getBoundingClientRect();
      if (x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom) return control;
    }
    return null;
  }

  function arkNovaHandleExplainPointer(event) {
    if (!arkNovaExplainMode) return;
    const target = event.target instanceof Element ? event.target : null;
    if (target && target.closest("[data-arkn-explain-bypass]")) return;
    const control = arkNovaExplainedControlAt(event.clientX, event.clientY);
    if (control) {
      event.preventDefault();
      event.stopPropagation();
      const key = control.dataset.arknExplain;
      const text = ARK_NOVA_EXPLANATIONS[key] || "This control is part of the current game action.";
      arkNovaExitExplainMode();
      arkNovaOpenModal(arkNovaTitle(key), `<div class="arkn-explanation"><span>?</span><p>${arkNovaEscape(text)}</p></div>`, "explain");
      return;
    }
    if (target && target.closest("button")) {
      event.preventDefault();
      event.stopPropagation();
    }
  }

  function arkNovaHandleExplainClick(event) {
    if (!arkNovaExplainMode) return;
    const target = event.target instanceof Element ? event.target : null;
    if (target && target.closest("[data-arkn-explain-bypass]")) return;
    if (target && target.closest("button")) {
      event.preventDefault();
      event.stopPropagation();
    }
  }

  function arkNovaHandleKeydown(event) {
    if (event.key !== "Escape") return;
    const modal = document.getElementById("arkNovaModal");
    if (modal && !modal.classList.contains("hidden")) {
      arkNovaCloseModal();
      return;
    }
    if (arkNovaExplainMode) {
      arkNovaExitExplainMode();
      return;
    }
    arkNovaUi.selectedCards.clear();
    arkNovaUi.buildCells = [];
    arkNovaUi.pendingSelection.clear();
    arkNovaRerenderInteractive();
    if (arkNovaView) arkNovaRenderPending(arkNovaView);
  }

  function clearArkNovaState() {
    arkNovaCurrentData = null;
    arkNovaView = null;
    arkNovaLastContextKey = "";
    arkNovaEventLog = [];
    arkNovaEventKeys.clear();
    arkNovaCardLookup.clear();
    arkNovaResetDraft();
    arkNovaExitExplainMode();
    arkNovaCloseModal();
    const panel = arkNovaEnsureShell();
    panel.querySelectorAll("#arkNovaStatus, #arkNovaPending, #arkNovaTracks, #arkNovaDisplay, #arkNovaProjects, #arkNovaPlayers, #arkNovaActionCards, #arkNovaComposer, #arkNovaBuildings, #arkNovaHandChoice, #arkNovaHand, #arkNovaPlayed, #arkNovaLog").forEach((node) => { node.innerHTML = ""; });
    arkNovaApplyMapState();
  }

  function showArkNovaHeaderActions(show) {
    arkNovaEnsureShell();
    const header = document.getElementById("arkNovaHeaderActions");
    if (header) header.style.display = show ? "flex" : "none";
    if (!show) arkNovaExitExplainMode();
  }

  function renderArkNovaGameState(data) {
    const panel = arkNovaEnsureShell();
    panel.classList.remove("hidden");
    showArkNovaHeaderActions(true);
    try {
      arkNovaRenderAll(data);
    } catch (error) {
      console.error("Ark Nova frontend render failed", error);
      const status = document.getElementById("arkNovaStatus");
      const composer = document.getElementById("arkNovaComposer");
      if (status) {
        status.innerHTML = `<div class="arkn-brand"><span class="arkn-brand-mark" aria-hidden="true">AN</span><span><strong>Ark Nova</strong><small>Map 0</small></span></div><div class="arkn-status-chips"><span class="arkn-status-chip arkn-status-over"><b>View unavailable</b></span></div>`;
      }
      if (composer) {
        composer.innerHTML = `<div class="arkn-waiting"><span>!</span><strong>The latest game view could not be displayed</strong><p>Wait for the next update or refresh this page. Your confirmed game state is safe on the server.</p></div>`;
      }
    }
  }

  window.clearArkNovaState = clearArkNovaState;
  window.showArkNovaHeaderActions = showArkNovaHeaderActions;
  window.renderArkNovaGameState = renderArkNovaGameState;
  window.ensureArkNovaPanel = arkNovaEnsureShell;

  document.addEventListener("pointerdown", arkNovaHandleExplainPointer, true);
  document.addEventListener("click", arkNovaHandleExplainClick, true);
  document.addEventListener("keydown", arkNovaHandleKeydown);
  arkNovaEnsureShell();
})();
