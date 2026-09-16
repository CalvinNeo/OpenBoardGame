(() => {
  "use strict";

  let bombBustersView = null;
  let bombBustersStateVersion = null;
  let bombBustersSelectedOwnWireId = null;
  let bombBustersSelectedTargetWireIds = [];
  let bombBustersSelectedSoloWireIds = [];
  let bombBustersActionMode = "duo";
  let bombBustersPendingAction = false;
  let bombBustersPendingTimer = null;
  let bombBustersExplainMode = false;
  let bombBustersPopoverAnchorWireId = null;
  let bombBustersPopoverFrame = null;

  const bombBustersPanelEl = document.getElementById("bombBustersPanel");
  const bombBustersHeaderActionsEl = document.getElementById("bombBustersHeaderActions");
  const bombBustersHelpBtnEl = document.getElementById("bombBustersHelpBtn");
  const bombBustersExplainBtnEl = document.getElementById("bombBustersExplainBtn");
  const bombBustersHelpModalEl = document.getElementById("bombBustersHelpModal");
  const bombBustersHelpCloseBtnEl = document.getElementById("bombBustersHelpCloseBtn");
  const bombBustersHelpContentEl = document.getElementById("bombBustersHelpContent");
  const bombBustersExplainModalEl = document.getElementById("bombBustersExplainModal");
  const bombBustersExplainCloseBtnEl = document.getElementById("bombBustersExplainCloseBtn");
  const bombBustersExplainContentEl = document.getElementById("bombBustersExplainContent");
  const bombBustersPresetLabelEl = document.getElementById("bombBustersPresetLabel");
  const bombBustersMissionLabelEl = document.getElementById("bombBustersMissionLabel");
  const bombBustersCaptainLabelEl = document.getElementById("bombBustersCaptainLabel");
  const bombBustersTurnLabelEl = document.getElementById("bombBustersTurnLabel");
  const bombBustersStatusEl = document.getElementById("bombBustersStatus");
  const bombBustersDetonatorEl = document.getElementById("bombBustersDetonator");
  const bombBustersMarkersEl = document.getElementById("bombBustersMarkers");
  const bombBustersRacksEl = document.getElementById("bombBustersRacks");
  const bombBustersValidationEl = document.getElementById("bombBustersValidation");
  const bombBustersDetectorStatusEl = document.getElementById("bombBustersDetectorStatus");
  const bombBustersActivityEl = document.getElementById("bombBustersActivity");
  const bombBustersActionDockEl = document.getElementById("bombBustersActionDock");
  const bombBustersActionModeEl = document.getElementById("bombBustersActionMode");
  const bombBustersActionSummaryEl = document.getElementById("bombBustersActionSummary");
  const bombBustersSoloOptionsEl = document.getElementById("bombBustersSoloOptions");
  const bombBustersShareClueBtnEl = document.getElementById("bombBustersShareClueBtn");
  const bombBustersConfirmDuoBtnEl = document.getElementById("bombBustersConfirmDuoBtn");
  const bombBustersDetectorBtnEl = document.getElementById("bombBustersDetectorBtn");
  const bombBustersConfirmDetectorBtnEl = document.getElementById("bombBustersConfirmDetectorBtn");
  const bombBustersConfirmSoloBtnEl = document.getElementById("bombBustersConfirmSoloBtn");
  const bombBustersResolveBtnEl = document.getElementById("bombBustersResolveBtn");
  const bombBustersSecureRedBtnEl = document.getElementById("bombBustersSecureRedBtn");
  const bombBustersResultEl = document.getElementById("bombBustersResult");
  const bombBustersResultTitleEl = document.getElementById("bombBustersResultTitle");
  const bombBustersResultDetailEl = document.getElementById("bombBustersResultDetail");
  const bombBustersReadyListEl = document.getElementById("bombBustersReadyList");
  const bombBustersContinueBtnEl = document.getElementById("bombBustersContinueBtn");
  const bombBustersLiveRegionEl = document.getElementById("bombBustersLiveRegion");
  const bombBustersWirePopoverEl = document.getElementById("bombBustersWirePopover");
  const bombBustersWirePopoverTextEl = document.getElementById("bombBustersWirePopoverText");
  const bombBustersWirePopoverConfirmBtnEl = document.getElementById("bombBustersWirePopoverConfirmBtn");
  const bombBustersWirePopoverCancelBtnEl = document.getElementById("bombBustersWirePopoverCancelBtn");

  const BOMB_BUSTERS_EXPLANATIONS = {
    own_wire: {
      title: "Your Wire",
      body: "You can see this wire's face. Select an uncut BLUE or YELLOW wire to make a Duo Cut declaration. A RED wire can never be declared.",
    },
    hidden_wire: {
      title: "Teammate Wire",
      body: "This face is hidden from you. Its fixed rack position and any attached Info token are public clues. Select one only after choosing your declaration wire.",
    },
    revealed_wire: {
      title: "Processed Wire",
      body: "A cut or safely secured wire stays in its original slot with its face visible, preserving the rack's sorting clues.",
    },
    info: {
      title: "Info Token",
      body: "This public clue gives the wire's true BLUE number or marks it as YELLOW. Only two tokens of each label exist at a time.",
    },
    validation: {
      title: "Validation Tracker",
      body: "A BLUE number validates after all four copies in the setup have been cut. Values outside this practice setup are marked N/A.",
    },
    detonator: {
      title: "Detonator",
      body: "An incorrect non-red attempt spends one mistake. Reaching zero remaining mistakes explodes the bomb; selecting a RED target explodes it immediately.",
    },
    share: {
      title: "Share Clue",
      body: "During setup, attach one numbered Info token to one of your BLUE wires. If both matching tokens are occupied, the clue is announced once instead.",
    },
    duo: {
      title: "Confirm Duo Cut",
      body: "Use your selected BLUE number or YELLOW wire as the declaration and test one teammate wire. A match cuts both; a miss advances the detonator.",
    },
    detector: {
      title: "Use Double Detector",
      body: "Once per bomb, declare with one of your BLUE wires and test two wires from the same teammate rack. The ability is spent whether it succeeds or misses.",
    },
    detector_confirm: {
      title: "Confirm Detector Cut",
      body: "Submit the selected BLUE declaration and exactly two targets from one teammate rack. The targets do not need to be adjacent.",
    },
    solo: {
      title: "Solo Cut",
      body: "Cut every remaining wire of one match held by you, but only when exactly two or four remain. Three matching wires can never be Solo Cut.",
    },
    secure: {
      title: "Secure Red Wires",
      body: "When every uncut wire left in your hand is RED, reveal and secure all of them without using the cutters or advancing the detonator.",
    },
    resolve: {
      title: "Detector Choice",
      body: "You own both tested wires, so privately choose one of the allowed slots. The server reveals only the result required by the detector rule.",
    },
    continue: {
      title: "Continue After Review",
      body: "Confirm after reviewing the final rack layout. The next bomb or retry starts only when every human player is ready; bots are ready automatically.",
    },
  };

  const BOMB_BUSTERS_HELP_HTML = `
    <div class="bomb-busters-rules">
      <p class="bomb-busters-practice-note"><strong>Core Practice · Original practice setup · Shared equipment disabled.</strong> This implementation uses original practice setups, not the commercial game's numbered missions.</p>
      <h3>Goal and wires</h3>
      <p>Work together to process every wire before the detonator runs out. BLUE wires are numbered 1–12 with four copies of each number. YELLOW wires all match one another. RED wires are dangerous and never match a cut declaration.</p>
      <p>The decimal shown on your own YELLOW or RED wire is only its private sorting position. For example, 4.1 sorts after BLUE 4, and 4.5 sorts after that. It is not a cut value.</p>
      <h3>Racks and setup clues</h3>
      <p>Each rack is sorted independently and slots never move. With two players, everyone has two racks. With three, the Captain has two racks and the others have one. With four or five, everyone has one rack. Two racks still count as one hand.</p>
      <p>Starting with the Captain, each player shares one Info token on one of their BLUE wires. There are two tokens for every BLUE number and two YELLOW tokens. If both copies are occupied, the clue is announced once and must be remembered.</p>
      <h3>Your turn</h3>
      <p><strong>Duo Cut:</strong> choose one of your uncut BLUE or YELLOW wires, then one teammate wire. A matching pair is cut. A non-red miss spends one detonator step and gives the target its true Info token. Targeting RED explodes the bomb immediately.</p>
      <p><strong>Solo Cut:</strong> if every remaining wire of one BLUE number or YELLOW match is in your hand, you may cut the whole set only when exactly two or four remain. A set of three is never legal, even across two racks.</p>
      <p><strong>Secure RED:</strong> if all of your remaining wires are RED, reveal and secure all of them safely. Players with empty hands are skipped; the last player with wires may take consecutive turns.</p>
      <h3>Double Detector</h3>
      <p>Once per bomb, use one of your BLUE wires to test exactly two different wires on the same teammate rack; they need not be adjacent. YELLOW cannot be declared with the detector.</p>
      <p>If one target matches, it is cut with your wire. If both match, their owner privately chooses which one is cut. If neither matches, the detonator advances and the owner chooses one non-red target for an Info token. Two RED targets explode immediately; with one RED target, the only non-red target receives the clue without naming the RED slot.</p>
      <h3>Validation, communication, and results</h3>
      <p>Cutting all four copies of a BLUE number completes its Validation marker. You may discuss public clues, but do not reveal your private wire faces, hint at their positions, or use a detailed log to replace memory.</p>
      <p>The mission succeeds when no uncut wires remain. It fails on a RED cut or when the detonator reaches zero. Final faces remain visible until every human chooses Next Bomb or Retry Mission.</p>
      <h3>Digital Notes</h3>
      <p>Seats increase clockwise. The first Captain is selected by the server, then the Captain moves one seat after every success or retry. Wires are dealt around the rack order and every rack is sorted separately. Cut wires remain in place; attached Info tokens return to the supply when their wire is cut.</p>
      <p>The mistake limit equals the number of players. The server derives every declaration from the acting player's selected wire, validates all Solo sets again, and keeps teammate faces and random setup data private. On phones, a wire action is confirmed in the floating card above the selected wire. Clicking blank board space or pressing Esc cancels an unsubmitted selection.</p>
    </div>
  `;

  function bombBustersSetModal(modal, visible, returnFocus) {
    if (!modal) return;
    modal.classList.toggle("hidden", !visible);
    modal.setAttribute("aria-hidden", visible ? "false" : "true");
    if (visible) {
      const first = modal.querySelector("button, [href], input, select, textarea, [tabindex]:not([tabindex='-1'])");
      if (first) window.setTimeout(() => first.focus(), 0);
    } else if (returnFocus) {
      returnFocus.focus();
    }
  }

  function bombBustersFindPlayer(view, playerId) {
    return (view && view.players || []).find((player) => player.player_id === playerId) || null;
  }

  function bombBustersPlayerName(view, playerId) {
    const player = bombBustersFindPlayer(view, playerId);
    return (player && (player.name || player.player_id)) || playerId || "-";
  }

  function bombBustersHasAction(actionType) {
    return Boolean(
      bombBustersView &&
      Array.isArray(bombBustersView.legal_actions) &&
      bombBustersView.legal_actions.includes(actionType)
    );
  }

  function bombBustersAllWires(view) {
    return (view && view.racks || []).flatMap((rack) => rack.slots || []);
  }

  function bombBustersFindWire(view, wireId) {
    return bombBustersAllWires(view).find((wire) => wire.wire_id === wireId) || null;
  }

  function bombBustersFindRack(view, wireId) {
    return (view && view.racks || []).find((rack) =>
      (rack.slots || []).some((wire) => wire.wire_id === wireId)
    ) || null;
  }

  function bombBustersWireFaceLabel(wire) {
    if (!wire || wire.hidden) return "Hidden wire";
    if (wire.kind === "blue") return `BLUE ${wire.blue_value}`;
    if (wire.kind === "yellow") return `YELLOW ${wire.sort_label}`;
    return `RED ${wire.sort_label}`;
  }

  function bombBustersDeclarationLabel(wire) {
    if (!wire || wire.hidden) return "wire";
    return wire.kind === "blue" ? `BLUE ${wire.blue_value}` : wire.kind === "yellow" ? "YELLOW" : "RED";
  }

  function bombBustersRackLabel(rack) {
    return `Rack ${String.fromCharCode(65 + Number(rack && rack.rack_index || 0))}`;
  }

  function bombBustersResetSelection(render = true) {
    bombBustersSelectedOwnWireId = null;
    bombBustersSelectedTargetWireIds = [];
    bombBustersSelectedSoloWireIds = [];
    bombBustersActionMode = "duo";
    bombBustersPopoverAnchorWireId = null;
    if (render && bombBustersView) bombBustersRenderInteractive(bombBustersView);
  }

  function bombBustersUsesWirePopover() {
    return window.matchMedia
      ? window.matchMedia("(max-width: 620px)").matches
      : window.innerWidth <= 620;
  }

  function bombBustersSelectedAction(view) {
    if (!view || bombBustersPendingAction) return null;
    if (
      view.phase === "initial_info" &&
      bombBustersHasAction("place_initial_info") &&
      bombBustersSelectedOwnWireId
    ) {
      return {
        action: {type: "place_initial_info", wire_id: bombBustersSelectedOwnWireId},
        explainKey: "share",
        label: "Share initial clue",
      };
    }
    if (
      view.phase === "awaiting_detector_choice" &&
      bombBustersHasAction("resolve_detector_choice") &&
      bombBustersSelectedTargetWireIds.length === 1
    ) {
      return {
        action: {type: "resolve_detector_choice", wire_id: bombBustersSelectedTargetWireIds[0]},
        explainKey: "resolve",
        label: "Confirm detector choice",
      };
    }
    if (view.phase !== "playing" || view.current_turn !== view.you) return null;
    if (
      bombBustersActionMode === "detector" &&
      bombBustersHasAction("double_detector_cut") &&
      bombBustersSelectedOwnWireId &&
      bombBustersSelectedTargetWireIds.length === 2
    ) {
      return {
        action: {
          type: "double_detector_cut",
          own_wire_id: bombBustersSelectedOwnWireId,
          target_wire_ids: [...bombBustersSelectedTargetWireIds],
        },
        explainKey: "detector_confirm",
        label: "Confirm detector cut",
      };
    }
    if (
      bombBustersActionMode === "solo" &&
      bombBustersHasAction("solo_cut") &&
      [2, 4].includes(bombBustersSelectedSoloWireIds.length)
    ) {
      return {
        action: {type: "solo_cut", wire_ids: [...bombBustersSelectedSoloWireIds]},
        explainKey: "solo",
        label: "Confirm Solo Cut",
      };
    }
    if (
      bombBustersActionMode === "duo" &&
      bombBustersHasAction("dual_cut") &&
      bombBustersSelectedOwnWireId &&
      bombBustersSelectedTargetWireIds.length === 1
    ) {
      return {
        action: {
          type: "dual_cut",
          own_wire_id: bombBustersSelectedOwnWireId,
          target_wire_id: bombBustersSelectedTargetWireIds[0],
        },
        explainKey: "duo",
        label: "Confirm Duo Cut",
      };
    }
    return null;
  }

  function bombBustersHideWirePopover() {
    if (bombBustersPopoverFrame) {
      window.cancelAnimationFrame(bombBustersPopoverFrame);
      bombBustersPopoverFrame = null;
    }
    if (!bombBustersWirePopoverEl) return;
    bombBustersWirePopoverEl.classList.remove("is-open");
    bombBustersWirePopoverEl.setAttribute("aria-hidden", "true");
    bombBustersWirePopoverEl.style.removeProperty("left");
    bombBustersWirePopoverEl.style.removeProperty("top");
    bombBustersWirePopoverEl.style.removeProperty("visibility");
  }

  function bombBustersPositionWirePopover() {
    bombBustersPopoverFrame = null;
    if (
      !bombBustersUsesWirePopover() ||
      !bombBustersWirePopoverEl ||
      !bombBustersWirePopoverEl.classList.contains("is-open") ||
      !bombBustersPopoverAnchorWireId ||
      !bombBustersPanelEl
    ) return;
    const anchor = Array.from(
      bombBustersPanelEl.querySelectorAll(".bomb-busters-wire-button[data-wire-id]")
    ).find((button) => button.dataset.wireId === bombBustersPopoverAnchorWireId);
    if (!anchor) {
      bombBustersHideWirePopover();
      return;
    }
    const anchorRect = anchor.getBoundingClientRect();
    if (anchorRect.bottom <= 0 || anchorRect.top >= window.innerHeight) {
      bombBustersWirePopoverEl.style.visibility = "hidden";
      return;
    }
    const popoverRect = bombBustersWirePopoverEl.getBoundingClientRect();
    const viewportWidth = document.documentElement.clientWidth;
    const edge = 8;
    const gap = 10;
    let placement = "above";
    let top = anchorRect.top - popoverRect.height - gap;
    if (top < edge) {
      placement = "below";
      top = Math.min(window.innerHeight - popoverRect.height - edge, anchorRect.bottom + gap);
    }
    const idealLeft = anchorRect.left + anchorRect.width / 2 - popoverRect.width / 2;
    const left = Math.max(edge, Math.min(viewportWidth - popoverRect.width - edge, idealLeft));
    const arrowLeft = Math.max(14, Math.min(popoverRect.width - 14, anchorRect.left + anchorRect.width / 2 - left));
    bombBustersWirePopoverEl.dataset.placement = placement;
    bombBustersWirePopoverEl.style.left = `${Math.round(left)}px`;
    bombBustersWirePopoverEl.style.top = `${Math.max(edge, Math.round(top))}px`;
    bombBustersWirePopoverEl.style.setProperty("--bomb-busters-popover-arrow-left", `${Math.round(arrowLeft)}px`);
    bombBustersWirePopoverEl.style.visibility = "visible";
  }

  function bombBustersScheduleWirePopoverPosition() {
    if (!bombBustersWirePopoverEl || !bombBustersWirePopoverEl.classList.contains("is-open")) return;
    if (bombBustersPopoverFrame) window.cancelAnimationFrame(bombBustersPopoverFrame);
    bombBustersPopoverFrame = window.requestAnimationFrame(bombBustersPositionWirePopover);
  }

  function bombBustersRenderWirePopover(view) {
    const hasSelection = Boolean(
      bombBustersSelectedOwnWireId ||
      bombBustersSelectedTargetWireIds.length ||
      bombBustersSelectedSoloWireIds.length
    );
    if (
      !bombBustersUsesWirePopover() ||
      !bombBustersWirePopoverEl ||
      !bombBustersPopoverAnchorWireId ||
      !hasSelection ||
      view.phase === "mission_result"
    ) {
      bombBustersHideWirePopover();
      return;
    }
    const selection = bombBustersSelectedAction(view);
    if (bombBustersWirePopoverTextEl) {
      bombBustersWirePopoverTextEl.textContent = bombBustersActionSummaryEl && bombBustersActionSummaryEl.textContent
        ? bombBustersActionSummaryEl.textContent
        : "Complete your wire selection.";
    }
    if (bombBustersWirePopoverConfirmBtnEl) {
      bombBustersWirePopoverConfirmBtnEl.disabled = !selection;
      bombBustersWirePopoverConfirmBtnEl.dataset.bombBustersExplain = selection
        ? selection.explainKey
        : bombBustersActionMode === "detector" ? "detector_confirm" : "duo";
      bombBustersWirePopoverConfirmBtnEl.setAttribute(
        "aria-label",
        selection ? selection.label : "Confirm unavailable until the selection is complete"
      );
    }
    bombBustersWirePopoverEl.classList.add("is-open");
    bombBustersWirePopoverEl.setAttribute("aria-hidden", "false");
    bombBustersWirePopoverEl.style.visibility = "hidden";
    bombBustersRefreshExplainTargets();
    bombBustersScheduleWirePopoverPosition();
  }

  function bombBustersDispatch(action) {
    if (bombBustersPendingAction || typeof sendAction !== "function") return;
    bombBustersPendingAction = true;
    if (bombBustersPendingTimer) window.clearTimeout(bombBustersPendingTimer);
    bombBustersPendingTimer = window.setTimeout(() => {
      bombBustersPendingAction = false;
      bombBustersPendingTimer = null;
      if (bombBustersView) bombBustersRenderInteractive(bombBustersView);
    }, 1800);
    sendAction(action);
    if (bombBustersView) bombBustersRenderInteractive(bombBustersView);
  }

  function bombBustersSetExplainMode(enabled) {
    bombBustersExplainMode = Boolean(enabled);
    document.body.classList.toggle("bomb-busters-explain-mode", bombBustersExplainMode);
    if (bombBustersExplainBtnEl) {
      bombBustersExplainBtnEl.setAttribute("aria-pressed", bombBustersExplainMode ? "true" : "false");
    }
    document.querySelectorAll("[data-bomb-busters-explain]").forEach((element) => {
      const key = element.dataset.bombBustersExplain;
      element.classList.toggle("has-explanation", bombBustersExplainMode && Boolean(BOMB_BUSTERS_EXPLANATIONS[key]));
    });
  }

  function bombBustersRefreshExplainTargets() {
    if (!bombBustersExplainMode) return;
    document.querySelectorAll("[data-bomb-busters-explain]").forEach((element) => {
      if (BOMB_BUSTERS_EXPLANATIONS[element.dataset.bombBustersExplain]) {
        element.classList.add("has-explanation");
      }
    });
  }

  function bombBustersShowExplanation(key) {
    const explanation = BOMB_BUSTERS_EXPLANATIONS[key];
    if (!explanation || !bombBustersExplainContentEl) return;
    bombBustersExplainContentEl.innerHTML = "";
    const title = document.createElement("h3");
    title.textContent = explanation.title;
    const body = document.createElement("p");
    body.textContent = explanation.body;
    bombBustersExplainContentEl.append(title, body);
    bombBustersSetModal(bombBustersExplainModalEl, true);
  }

  function bombBustersFindDisabledExplainTargetAtPoint(x, y) {
    if (!bombBustersPanelEl) return null;
    const targets = bombBustersPanelEl.querySelectorAll("[data-bomb-busters-explain]:disabled");
    for (const target of targets) {
      const rect = target.getBoundingClientRect();
      if (
        rect.width > 0 && rect.height > 0 &&
        x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom
      ) {
        return target;
      }
    }
    return null;
  }

  function bombBustersWireIsSelectable(view, rack, wire) {
    if (!view || !wire || wire.status !== "uncut" || bombBustersPendingAction) return false;
    const isOwn = rack.owner_id === view.you;
    if (view.phase === "initial_info") {
      return isOwn && (view.initial_info_candidate_wire_ids || []).includes(wire.wire_id);
    }
    if (view.phase === "awaiting_detector_choice") {
      return isOwn && (view.pending_choice_wire_ids || []).includes(wire.wire_id);
    }
    if (view.phase !== "playing" || view.current_turn !== view.you) return false;
    if (isOwn) {
      if (bombBustersActionMode === "detector") return wire.kind === "blue";
      return wire.kind === "blue" || wire.kind === "yellow";
    }
    if (!bombBustersSelectedOwnWireId || bombBustersActionMode === "solo") return false;
    if (bombBustersActionMode === "detector" && bombBustersSelectedTargetWireIds.length) {
      const firstRack = bombBustersFindRack(view, bombBustersSelectedTargetWireIds[0]);
      return Boolean(firstRack && firstRack.rack_id === rack.rack_id);
    }
    return true;
  }

  function bombBustersHandleWireClick(rack, wire) {
    if (!bombBustersView || !bombBustersWireIsSelectable(bombBustersView, rack, wire)) return;
    const isOwn = rack.owner_id === bombBustersView.you;
    if (bombBustersView.phase === "initial_info") {
      bombBustersSelectedOwnWireId = bombBustersSelectedOwnWireId === wire.wire_id ? null : wire.wire_id;
    } else if (bombBustersView.phase === "awaiting_detector_choice") {
      bombBustersSelectedTargetWireIds = bombBustersSelectedTargetWireIds[0] === wire.wire_id ? [] : [wire.wire_id];
    } else if (isOwn) {
      bombBustersSelectedOwnWireId = bombBustersSelectedOwnWireId === wire.wire_id ? null : wire.wire_id;
      bombBustersSelectedTargetWireIds = [];
      bombBustersSelectedSoloWireIds = [];
      if (bombBustersActionMode === "solo") bombBustersActionMode = "duo";
    } else if (bombBustersActionMode === "detector") {
      const index = bombBustersSelectedTargetWireIds.indexOf(wire.wire_id);
      if (index >= 0) {
        bombBustersSelectedTargetWireIds.splice(index, 1);
      } else if (bombBustersSelectedTargetWireIds.length < 2) {
        bombBustersSelectedTargetWireIds.push(wire.wire_id);
      }
    } else {
      bombBustersSelectedTargetWireIds = bombBustersSelectedTargetWireIds[0] === wire.wire_id ? [] : [wire.wire_id];
    }
    bombBustersPopoverAnchorWireId = bombBustersSelectedTargetWireIds.length
      ? bombBustersSelectedTargetWireIds[bombBustersSelectedTargetWireIds.length - 1]
      : bombBustersSelectedOwnWireId || bombBustersSelectedSoloWireIds[0] || null;
    bombBustersRenderInteractive(bombBustersView);
  }

  function bombBustersMakeWireSlot(view, rack, wire) {
    const slot = document.createElement("div");
    slot.className = "bomb-busters-wire-slot";
    const button = document.createElement("button");
    button.type = "button";
    button.className = "bomb-busters-wire-button";
    button.dataset.wireId = wire.wire_id;
    const isOwn = rack.owner_id === view.you;
    const isProcessed = wire.status !== "uncut";
    if (wire.hidden) {
      button.classList.add("is-hidden-wire");
      button.dataset.bombBustersExplain = "hidden_wire";
    } else if (isProcessed) {
      button.classList.add("is-revealed-wire", `is-${wire.kind}`);
      button.dataset.bombBustersExplain = "revealed_wire";
    } else {
      button.classList.add("is-own-wire", `is-${wire.kind}`);
      button.dataset.bombBustersExplain = "own_wire";
    }
    if (wire.status === "cut") button.classList.add("is-cut");
    if (wire.status === "secured") button.classList.add("is-secured");
    if (bombBustersSelectedOwnWireId === wire.wire_id) button.classList.add("is-selected-own");
    if (bombBustersSelectedTargetWireIds.includes(wire.wire_id)) button.classList.add("is-selected-target");
    if (bombBustersSelectedSoloWireIds.includes(wire.wire_id)) button.classList.add("is-selected-solo");

    const slotNumber = document.createElement("span");
    slotNumber.className = "bomb-busters-slot-number";
    slotNumber.textContent = `#${Number(wire.slot_index) + 1}`;
    const icon = document.createElement("span");
    icon.className = "bomb-busters-wire-icon";
    const label = document.createElement("strong");
    label.className = "bomb-busters-wire-label";
    const detail = document.createElement("span");
    detail.className = "bomb-busters-wire-detail";

    if (wire.hidden) {
      icon.textContent = "❔";
      label.textContent = "Hidden";
      detail.textContent = "wire";
    } else if (wire.kind === "blue") {
      icon.textContent = wire.status === "cut" ? "✂️" : "🔵";
      label.textContent = `BLUE ${wire.blue_value}`;
      detail.textContent = wire.status === "cut" ? "cut" : "number wire";
    } else if (wire.kind === "yellow") {
      icon.textContent = wire.status === "cut" ? "✂️" : "🟡";
      label.textContent = "YELLOW";
      detail.textContent = `${wire.sort_label} · ${wire.status === "cut" ? "cut" : "private sort"}`;
    } else {
      icon.textContent = wire.status === "secured" ? "🛡️" : wire.status === "cut" ? "💥" : "🔴";
      label.textContent = wire.status === "secured" ? "RED secured" : "RED DANGER";
      detail.textContent = `${wire.sort_label} · ${wire.status === "uncut" ? "private sort" : wire.status}`;
    }
    button.append(slotNumber, icon, label, detail);
    button.disabled = !bombBustersWireIsSelectable(view, rack, wire);
    button.setAttribute(
      "aria-label",
      `${bombBustersRackLabel(rack)} slot ${Number(wire.slot_index) + 1}: ${bombBustersWireFaceLabel(wire)}${wire.public_info ? `, Info ${wire.public_info}` : ""}`
    );
    button.addEventListener("click", () => bombBustersHandleWireClick(rack, wire));
    slot.appendChild(button);

    if (wire.public_info) {
      const info = document.createElement("button");
      info.type = "button";
      info.className = "bomb-busters-info-token";
      info.dataset.bombBustersExplain = "info";
      info.textContent = `ℹ️ ${wire.public_info === "yellow" ? "YELLOW" : wire.public_info}`;
      info.setAttribute("aria-label", `Info token: ${wire.public_info}`);
      info.addEventListener("click", () => bombBustersHandleWireClick(rack, wire));
      slot.appendChild(info);
    }
    return slot;
  }

  function bombBustersRenderRacks(view) {
    if (!bombBustersRacksEl) return;
    bombBustersRacksEl.innerHTML = "";
    const players = view.players || [];
    players.forEach((player) => {
      const card = document.createElement("article");
      card.className = "bomb-busters-player-card";
      if (player.player_id === view.you) card.classList.add("is-self");
      if (player.player_id === view.current_turn) card.classList.add("is-current");
      if (player.player_id === view.current_responder_id) card.classList.add("is-responder");

      const heading = document.createElement("div");
      heading.className = "bomb-busters-player-heading";
      const name = document.createElement("strong");
      name.textContent = player.name || player.player_id;
      const badges = document.createElement("div");
      badges.className = "bomb-busters-badges";
      const badgeTexts = [];
      if (player.is_captain) badgeTexts.push("🧭 Captain");
      if (player.player_id === view.you) badgeTexts.push("You");
      if (player.is_bot) badgeTexts.push("Bot");
      if (player.player_id === view.current_turn) badgeTexts.push("Turn");
      badgeTexts.push(player.personal_detector_used ? "Detector used" : "Detector ready");
      badgeTexts.forEach((text) => {
        const badge = document.createElement("span");
        badge.textContent = text;
        badges.appendChild(badge);
      });
      const count = document.createElement("span");
      count.className = "bomb-busters-wire-count";
      count.textContent = `${player.remaining_count} uncut`;
      heading.append(name, badges, count);
      card.appendChild(heading);

      (view.racks || []).filter((rack) => rack.owner_id === player.player_id).forEach((rack) => {
        const rackSection = document.createElement("section");
        rackSection.className = "bomb-busters-rack";
        const rackTitle = document.createElement("h4");
        rackTitle.textContent = bombBustersRackLabel(rack);
        const slots = document.createElement("div");
        slots.className = "bomb-busters-rack-slots";
        (rack.slots || []).forEach((wire) => slots.appendChild(bombBustersMakeWireSlot(view, rack, wire)));
        rackSection.append(rackTitle, slots);
        card.appendChild(rackSection);
      });
      bombBustersRacksEl.appendChild(card);
    });
    bombBustersRefreshExplainTargets();
  }

  function bombBustersRenderDetonator(view) {
    if (!bombBustersDetonatorEl) return;
    const detonator = view.detonator || {};
    const limit = Number(detonator.mistake_limit || 0);
    const used = Number(detonator.mistakes_used || 0);
    bombBustersDetonatorEl.innerHTML = "";
    const heading = document.createElement("div");
    heading.className = "bomb-busters-detonator-heading";
    const title = document.createElement("h3");
    title.textContent = "🧨 Detonator";
    const count = document.createElement("strong");
    count.textContent = `Remaining ${Math.max(0, limit - used)} / ${limit}`;
    heading.append(title, count);
    const track = document.createElement("div");
    track.className = "bomb-busters-detonator-track";
    track.setAttribute("aria-hidden", "true");
    for (let index = 0; index < limit; index += 1) {
      const segment = document.createElement("span");
      segment.className = index < used ? "is-spent" : "is-safe";
      segment.textContent = index < used ? "⚠️" : "●";
      track.appendChild(segment);
    }
    const caption = document.createElement("span");
    caption.textContent = `Mistakes: ${used} / ${limit}`;
    bombBustersDetonatorEl.append(heading, track, caption);
  }

  function bombBustersRenderMarkers(view) {
    if (!bombBustersMarkersEl) return;
    bombBustersMarkersEl.innerHTML = "";
    const groups = [
      ["yellow", "🟡"],
      ["red", "🔴"],
    ];
    groups.forEach(([kind, emoji]) => {
      const row = document.createElement("div");
      row.className = "bomb-busters-marker-row";
      const label = document.createElement("strong");
      label.textContent = `${emoji} ${kind.toUpperCase()}`;
      const values = document.createElement("span");
      const markers = view.public_color_markers && view.public_color_markers[kind] || [];
      values.textContent = markers.length ? markers.map((marker) => marker.sort_label).join(" · ") : "None in play";
      row.append(label, values);
      bombBustersMarkersEl.appendChild(row);
    });
  }

  function bombBustersRenderValidation(view) {
    if (!bombBustersValidationEl) return;
    bombBustersValidationEl.innerHTML = "";
    for (let value = 1; value <= 12; value += 1) {
      const key = String(value);
      const inPlay = Number(view.in_play_blue_counts && view.in_play_blue_counts[key] || 0);
      const cut = Number(view.cut_blue_counts && view.cut_blue_counts[key] || 0);
      const complete = Boolean(view.validation_complete && view.validation_complete[key]);
      const cell = document.createElement("button");
      cell.type = "button";
      cell.disabled = true;
      cell.dataset.bombBustersExplain = "validation";
      cell.className = "bomb-busters-validation-cell";
      if (!inPlay) cell.classList.add("is-out");
      if (complete) cell.classList.add("is-complete");
      cell.textContent = inPlay ? `${complete ? "✅" : "🔵"} ${value} · ${cut}/${inPlay}` : `${value} · N/A`;
      bombBustersValidationEl.appendChild(cell);
    }
  }

  function bombBustersRenderActivity(view) {
    if (!bombBustersActivityEl) return;
    bombBustersActivityEl.innerHTML = "";
    const activity = view.public_activity || [];
    if (!activity.length) {
      bombBustersActivityEl.textContent = "No actions yet.";
      return;
    }
    activity.slice().reverse().forEach((item) => {
      const row = document.createElement("div");
      row.className = "bomb-busters-activity-row";
      row.textContent = item.message || "Team action completed.";
      bombBustersActivityEl.appendChild(row);
    });
  }

  function bombBustersRenderSoloOptions(view) {
    if (!bombBustersSoloOptionsEl) return;
    bombBustersSoloOptionsEl.innerHTML = "";
    if (view.phase !== "playing" || view.current_turn !== view.you) return;
    (view.legal_solo_sets || []).forEach((wireIds) => {
      const first = bombBustersFindWire(view, wireIds[0]);
      const button = document.createElement("button");
      button.type = "button";
      button.className = "bomb-busters-solo-option";
      button.dataset.bombBustersExplain = "solo";
      button.textContent = `Solo Cut ${wireIds.length} × ${bombBustersDeclarationLabel(first)}`;
      button.disabled = bombBustersPendingAction;
      if (
        bombBustersSelectedSoloWireIds.length === wireIds.length &&
        wireIds.every((wireId) => bombBustersSelectedSoloWireIds.includes(wireId))
      ) {
        button.classList.add("is-selected");
      }
      button.addEventListener("click", () => {
        bombBustersActionMode = "solo";
        bombBustersSelectedOwnWireId = null;
        bombBustersSelectedTargetWireIds = [];
        bombBustersSelectedSoloWireIds = [...wireIds];
        bombBustersPopoverAnchorWireId = wireIds[0] || null;
        bombBustersRenderInteractive(view);
      });
      bombBustersSoloOptionsEl.appendChild(button);
    });
  }

  function bombBustersSetButtonState(button, visible, enabled) {
    if (!button) return;
    button.classList.toggle("hidden", !visible);
    button.disabled = !enabled || bombBustersPendingAction;
  }

  function bombBustersRenderActions(view) {
    if (!bombBustersActionDockEl || !bombBustersActionSummaryEl) return;
    const phase = view.phase;
    const isTurn = phase === "playing" && view.current_turn === view.you;
    const ownWire = bombBustersFindWire(view, bombBustersSelectedOwnWireId);
    const targetWires = bombBustersSelectedTargetWireIds.map((wireId) => bombBustersFindWire(view, wireId)).filter(Boolean);
    bombBustersActionDockEl.classList.toggle("hidden", phase === "mission_result");

    bombBustersSetButtonState(bombBustersShareClueBtnEl, phase === "initial_info", bombBustersHasAction("place_initial_info") && Boolean(ownWire));
    bombBustersSetButtonState(bombBustersConfirmDuoBtnEl, isTurn && bombBustersActionMode === "duo", bombBustersHasAction("dual_cut") && Boolean(ownWire) && targetWires.length === 1);
    bombBustersSetButtonState(bombBustersDetectorBtnEl, isTurn && bombBustersActionMode !== "solo", bombBustersHasAction("double_detector_cut"));
    bombBustersSetButtonState(bombBustersConfirmDetectorBtnEl, isTurn && bombBustersActionMode === "detector", bombBustersHasAction("double_detector_cut") && Boolean(ownWire) && targetWires.length === 2);
    bombBustersSetButtonState(bombBustersConfirmSoloBtnEl, isTurn && bombBustersActionMode === "solo", bombBustersHasAction("solo_cut") && [2, 4].includes(bombBustersSelectedSoloWireIds.length));
    bombBustersSetButtonState(bombBustersResolveBtnEl, phase === "awaiting_detector_choice", bombBustersHasAction("resolve_detector_choice") && targetWires.length === 1);
    bombBustersSetButtonState(bombBustersSecureRedBtnEl, isTurn, bombBustersHasAction("reveal_red_wires"));

    if (phase === "initial_info") {
      if (bombBustersActionModeEl) bombBustersActionModeEl.textContent = "Initial Info";
      bombBustersActionSummaryEl.textContent = ownWire
        ? `Share ${bombBustersDeclarationLabel(ownWire)} as your initial clue.`
        : view.initial_info_player_id === view.you
          ? "Choose one of your BLUE wires, then confirm Share Clue."
          : `Waiting for ${bombBustersPlayerName(view, view.initial_info_player_id)} to choose an initial clue…`;
      return;
    }
    if (phase === "awaiting_detector_choice") {
      if (bombBustersActionModeEl) bombBustersActionModeEl.textContent = "Detector Response";
      const purpose = view.pending_choice_purpose === "cut" ? "cut" : "receive an Info token";
      bombBustersActionSummaryEl.textContent = view.current_responder_id === view.you
        ? targetWires.length
          ? `Confirm slot #${Number(targetWires[0].slot_index) + 1} to ${purpose}.`
          : `Choose one highlighted wire to ${purpose}.`
        : `Waiting for ${bombBustersPlayerName(view, view.current_responder_id)} to choose a wire…`;
      return;
    }
    if (!isTurn) {
      if (bombBustersActionModeEl) bombBustersActionModeEl.textContent = "Waiting";
      bombBustersActionSummaryEl.textContent = `Waiting for ${bombBustersPlayerName(view, view.current_turn)} to act…`;
      return;
    }
    if (bombBustersActionMode === "detector") {
      if (bombBustersActionModeEl) bombBustersActionModeEl.textContent = "Double Detector";
      if (!ownWire) {
        bombBustersActionSummaryEl.textContent = "Choose one of your BLUE wires as the detector declaration.";
      } else if (targetWires.length < 2) {
        bombBustersActionSummaryEl.textContent = `Declare ${bombBustersDeclarationLabel(ownWire)} · choose ${2 - targetWires.length} more wire${targetWires.length === 1 ? "" : "s"} on one teammate rack.`;
      } else {
        const rack = bombBustersFindRack(view, targetWires[0].wire_id);
        bombBustersActionSummaryEl.textContent = `Test ${bombBustersDeclarationLabel(ownWire)} against ${bombBustersPlayerName(view, rack.owner_id)} · ${bombBustersRackLabel(rack)} · slots ${targetWires.map((wire) => Number(wire.slot_index) + 1).join(" & ")}.`;
      }
    } else if (bombBustersActionMode === "solo") {
      if (bombBustersActionModeEl) bombBustersActionModeEl.textContent = "Solo Cut";
      const first = bombBustersFindWire(view, bombBustersSelectedSoloWireIds[0]);
      bombBustersActionSummaryEl.textContent = first
        ? `Solo Cut ${bombBustersSelectedSoloWireIds.length} × ${bombBustersDeclarationLabel(first)}.`
        : "Choose an available Solo Cut set.";
    } else {
      if (bombBustersActionModeEl) bombBustersActionModeEl.textContent = "Duo Cut";
      if (!ownWire) {
        bombBustersActionSummaryEl.textContent = "Choose one of your BLUE or YELLOW wires.";
      } else if (!targetWires.length) {
        bombBustersActionSummaryEl.textContent = `Declare ${bombBustersDeclarationLabel(ownWire)} · choose one teammate wire.`;
      } else {
        const rack = bombBustersFindRack(view, targetWires[0].wire_id);
        bombBustersActionSummaryEl.textContent = `Cut ${bombBustersDeclarationLabel(ownWire)} with ${bombBustersPlayerName(view, rack.owner_id)} · ${bombBustersRackLabel(rack)} · slot ${Number(targetWires[0].slot_index) + 1}.`;
      }
    }
  }

  function bombBustersRenderResult(view) {
    if (!bombBustersResultEl) return;
    const show = view.phase === "mission_result" && view.last_result;
    bombBustersResultEl.classList.toggle("hidden", !show);
    if (!show) return;
    const result = view.last_result;
    const success = result.result === "success";
    bombBustersResultEl.classList.toggle("is-success", success);
    bombBustersResultEl.classList.toggle("is-failure", !success);
    if (bombBustersResultTitleEl) bombBustersResultTitleEl.textContent = success ? "Mission Defused" : "Bomb Exploded";
    const reasonLabels = {
      all_wires_cleared: "Every wire was processed safely.",
      red_wire: "A RED wire triggered the bomb.",
      detonator: "The detonator ran out of safe steps.",
    };
    if (bombBustersResultDetailEl) {
      const completed = (result.completed_blue_values || []).length
        ? ` Validated BLUE: ${(result.completed_blue_values || []).join(", ")}.`
        : "";
      bombBustersResultDetailEl.textContent = `${reasonLabels[result.reason] || "Mission complete."} Mistakes used: ${result.mistakes_used}.${completed}`;
    }
    if (bombBustersReadyListEl) {
      bombBustersReadyListEl.innerHTML = "";
      const ready = new Set(view.result_ready_ids || []);
      const summary = document.createElement("strong");
      summary.textContent = `Ready ${ready.size} / ${(view.players || []).length}`;
      bombBustersReadyListEl.appendChild(summary);
      (view.players || []).forEach((player) => {
        const row = document.createElement("span");
        row.textContent = `${player.name || player.player_id}: ${ready.has(player.player_id) ? "Ready ✓" : "Waiting"}`;
        bombBustersReadyListEl.appendChild(row);
      });
    }
    if (bombBustersContinueBtnEl) {
      bombBustersContinueBtnEl.textContent = success ? "Next Bomb" : "Retry Mission";
      bombBustersContinueBtnEl.disabled = !bombBustersHasAction("continue_mission") || bombBustersPendingAction;
    }
  }

  function bombBustersRenderDetectorStatus(view) {
    if (!bombBustersDetectorStatusEl) return;
    const me = bombBustersFindPlayer(view, view.you);
    bombBustersDetectorStatusEl.textContent = me && me.personal_detector_used
      ? "Used for this bomb"
      : "Ready · one use this bomb";
    bombBustersDetectorStatusEl.classList.toggle("is-used", Boolean(me && me.personal_detector_used));
  }

  function bombBustersRenderStatus(view) {
    if (!bombBustersStatusEl) return;
    if (view.phase === "initial_info") {
      bombBustersStatusEl.textContent = view.initial_info_player_id === view.you
        ? "Choose an initial BLUE clue."
        : `${bombBustersPlayerName(view, view.initial_info_player_id)} is choosing an initial clue…`;
    } else if (view.phase === "awaiting_detector_choice") {
      bombBustersStatusEl.textContent = view.current_responder_id === view.you
        ? "The Double Detector needs your private choice."
        : `Waiting for ${bombBustersPlayerName(view, view.current_responder_id)} to choose a wire…`;
    } else if (view.phase === "mission_result") {
      bombBustersStatusEl.textContent = "Review the final rack layout, then confirm when ready.";
    } else {
      bombBustersStatusEl.textContent = view.current_turn === view.you
        ? "Your turn · choose a safe action."
        : `${bombBustersPlayerName(view, view.current_turn)} is deciding…`;
    }
  }

  function bombBustersRenderInteractive(view) {
    bombBustersRenderRacks(view);
    bombBustersRenderSoloOptions(view);
    bombBustersRenderActions(view);
    bombBustersRenderResult(view);
    bombBustersRenderWirePopover(view);
    bombBustersRefreshExplainTargets();
  }

  function bombBustersAnnounceEvents(events) {
    if (!bombBustersLiveRegionEl || !Array.isArray(events) || !events.length) return;
    const messages = [];
    events.forEach((event) => {
      const payload = event.payload || {};
      if (event.type === "bomb_busters:spoken_info") {
        messages.push(`Spoken clue: ${payload.label === "yellow" ? "YELLOW" : `BLUE ${payload.label}`}. Remember it; no token was available.`);
      } else if (event.type === "bomb_busters:duo_miss" || event.type === "bomb_busters:detector_miss") {
        messages.push("Detonator advanced.");
      } else if (event.type === "bomb_busters:red_wire") {
        messages.push("Red wire. The bomb exploded.");
      } else if (event.type === "bomb_busters:validation_complete") {
        messages.push(`BLUE ${payload.blue_value} validated.`);
      }
    });
    if (messages.length) {
      bombBustersLiveRegionEl.textContent = "";
      window.setTimeout(() => {
        bombBustersLiveRegionEl.textContent = messages.join(" ");
      }, 20);
    }
  }

  function bombBustersRenderGameState(data) {
    const view = data && data.view;
    if (!view) return;
    const nextVersion = data.state_version;
    if (bombBustersStateVersion !== null && nextVersion !== bombBustersStateVersion) {
      bombBustersResetSelection(false);
    }
    bombBustersStateVersion = nextVersion;
    bombBustersPendingAction = false;
    if (bombBustersPendingTimer) window.clearTimeout(bombBustersPendingTimer);
    bombBustersPendingTimer = null;
    bombBustersView = view;
    if (typeof currentGameType !== "undefined" && currentGameType !== "bomb_busters") {
      currentGameType = "bomb_busters";
      setGamePanelVisibility("bomb_busters");
    }

    if (bombBustersPresetLabelEl) bombBustersPresetLabelEl.textContent = view.practice && view.practice.name || "Core Practice";
    if (bombBustersMissionLabelEl) {
      const attempt = Number(view.attempt_number || 1);
      bombBustersMissionLabelEl.textContent = `${view.mission_number || 1}${attempt > 1 ? ` · Attempt ${attempt}` : ""}`;
    }
    if (bombBustersCaptainLabelEl) bombBustersCaptainLabelEl.textContent = `🧭 Captain ${bombBustersPlayerName(view, view.captain_id)}`;
    if (bombBustersTurnLabelEl) {
      if (view.phase === "playing") {
        bombBustersTurnLabelEl.textContent = view.current_turn === view.you ? "Your Turn" : `${bombBustersPlayerName(view, view.current_turn)}'s turn`;
      } else if (view.phase === "initial_info") {
        bombBustersTurnLabelEl.textContent = "Initial clues";
      } else if (view.phase === "awaiting_detector_choice") {
        bombBustersTurnLabelEl.textContent = "Detector response";
      } else {
        bombBustersTurnLabelEl.textContent = "Mission review";
      }
    }
    bombBustersRenderStatus(view);
    bombBustersRenderDetonator(view);
    bombBustersRenderMarkers(view);
    bombBustersRenderValidation(view);
    bombBustersRenderDetectorStatus(view);
    bombBustersRenderActivity(view);
    bombBustersRenderInteractive(view);
    bombBustersAnnounceEvents(data.events || []);
  }

  function bombBustersClearState() {
    bombBustersView = null;
    bombBustersStateVersion = null;
    bombBustersPendingAction = false;
    if (bombBustersPendingTimer) window.clearTimeout(bombBustersPendingTimer);
    bombBustersPendingTimer = null;
    bombBustersResetSelection(false);
    bombBustersHideWirePopover();
    bombBustersSetExplainMode(false);
    bombBustersSetModal(bombBustersHelpModalEl, false);
    bombBustersSetModal(bombBustersExplainModalEl, false);
    [bombBustersRacksEl, bombBustersValidationEl, bombBustersActivityEl, bombBustersSoloOptionsEl, bombBustersReadyListEl].forEach((element) => {
      if (element) element.innerHTML = "";
    });
    if (bombBustersStatusEl) bombBustersStatusEl.textContent = "Waiting for game state…";
    if (bombBustersResultEl) bombBustersResultEl.classList.add("hidden");
  }

  function bombBustersShowHeaderActions(show) {
    if (bombBustersHeaderActionsEl) bombBustersHeaderActionsEl.style.display = show ? "flex" : "none";
    if (!show) {
      bombBustersResetSelection(false);
      bombBustersSetExplainMode(false);
      bombBustersSetModal(bombBustersHelpModalEl, false);
      bombBustersSetModal(bombBustersExplainModalEl, false);
    }
  }

  if (bombBustersHelpContentEl) bombBustersHelpContentEl.innerHTML = BOMB_BUSTERS_HELP_HTML;
  if (bombBustersShareClueBtnEl) bombBustersShareClueBtnEl.dataset.bombBustersExplain = "share";
  if (bombBustersConfirmDuoBtnEl) bombBustersConfirmDuoBtnEl.dataset.bombBustersExplain = "duo";
  if (bombBustersDetectorBtnEl) bombBustersDetectorBtnEl.dataset.bombBustersExplain = "detector";
  if (bombBustersConfirmDetectorBtnEl) bombBustersConfirmDetectorBtnEl.dataset.bombBustersExplain = "detector_confirm";
  if (bombBustersConfirmSoloBtnEl) bombBustersConfirmSoloBtnEl.dataset.bombBustersExplain = "solo";
  if (bombBustersResolveBtnEl) bombBustersResolveBtnEl.dataset.bombBustersExplain = "resolve";
  if (bombBustersSecureRedBtnEl) bombBustersSecureRedBtnEl.dataset.bombBustersExplain = "secure";
  if (bombBustersContinueBtnEl) bombBustersContinueBtnEl.dataset.bombBustersExplain = "continue";

  if (bombBustersHelpBtnEl) {
    bombBustersHelpBtnEl.addEventListener("click", () => bombBustersSetModal(bombBustersHelpModalEl, true));
  }
  if (bombBustersExplainBtnEl) {
    bombBustersExplainBtnEl.addEventListener("click", () => bombBustersSetExplainMode(!bombBustersExplainMode));
  }
  if (bombBustersHelpCloseBtnEl) {
    bombBustersHelpCloseBtnEl.addEventListener("click", () => bombBustersSetModal(bombBustersHelpModalEl, false, bombBustersHelpBtnEl));
  }
  if (bombBustersExplainCloseBtnEl) {
    bombBustersExplainCloseBtnEl.addEventListener("click", () => bombBustersSetModal(bombBustersExplainModalEl, false));
  }
  [bombBustersHelpModalEl, bombBustersExplainModalEl].forEach((modal) => {
    if (!modal) return;
    modal.addEventListener("click", (event) => {
      if (event.target === modal) {
        bombBustersSetModal(modal, false, modal === bombBustersHelpModalEl ? bombBustersHelpBtnEl : null);
      }
    });
  });

  if (bombBustersShareClueBtnEl) {
    bombBustersShareClueBtnEl.addEventListener("click", () => {
      if (!bombBustersHasAction("place_initial_info") || !bombBustersSelectedOwnWireId) return;
      bombBustersDispatch({type: "place_initial_info", wire_id: bombBustersSelectedOwnWireId});
    });
  }
  if (bombBustersConfirmDuoBtnEl) {
    bombBustersConfirmDuoBtnEl.addEventListener("click", () => {
      if (!bombBustersHasAction("dual_cut") || !bombBustersSelectedOwnWireId || bombBustersSelectedTargetWireIds.length !== 1) return;
      if (!window.confirm(`${bombBustersActionSummaryEl.textContent} Confirm this cut?`)) return;
      bombBustersDispatch({
        type: "dual_cut",
        own_wire_id: bombBustersSelectedOwnWireId,
        target_wire_id: bombBustersSelectedTargetWireIds[0],
      });
    });
  }
  if (bombBustersDetectorBtnEl) {
    bombBustersDetectorBtnEl.addEventListener("click", () => {
      if (!bombBustersHasAction("double_detector_cut")) return;
      bombBustersActionMode = bombBustersActionMode === "detector" ? "duo" : "detector";
      bombBustersSelectedOwnWireId = null;
      bombBustersSelectedTargetWireIds = [];
      bombBustersSelectedSoloWireIds = [];
      bombBustersRenderInteractive(bombBustersView);
    });
  }
  if (bombBustersConfirmDetectorBtnEl) {
    bombBustersConfirmDetectorBtnEl.addEventListener("click", () => {
      if (!bombBustersHasAction("double_detector_cut") || !bombBustersSelectedOwnWireId || bombBustersSelectedTargetWireIds.length !== 2) return;
      if (!window.confirm(`${bombBustersActionSummaryEl.textContent} The detector will be spent. Continue?`)) return;
      bombBustersDispatch({
        type: "double_detector_cut",
        own_wire_id: bombBustersSelectedOwnWireId,
        target_wire_ids: [...bombBustersSelectedTargetWireIds],
      });
    });
  }
  if (bombBustersConfirmSoloBtnEl) {
    bombBustersConfirmSoloBtnEl.addEventListener("click", () => {
      if (!bombBustersHasAction("solo_cut") || ![2, 4].includes(bombBustersSelectedSoloWireIds.length)) return;
      if (!window.confirm(`${bombBustersActionSummaryEl.textContent} Confirm this cut?`)) return;
      bombBustersDispatch({type: "solo_cut", wire_ids: [...bombBustersSelectedSoloWireIds]});
    });
  }
  if (bombBustersResolveBtnEl) {
    bombBustersResolveBtnEl.addEventListener("click", () => {
      if (!bombBustersHasAction("resolve_detector_choice") || bombBustersSelectedTargetWireIds.length !== 1) return;
      bombBustersDispatch({type: "resolve_detector_choice", wire_id: bombBustersSelectedTargetWireIds[0]});
    });
  }
  if (bombBustersSecureRedBtnEl) {
    bombBustersSecureRedBtnEl.addEventListener("click", () => {
      if (!bombBustersHasAction("reveal_red_wires")) return;
      if (!window.confirm("Reveal and safely secure all of your remaining RED wires?")) return;
      bombBustersDispatch({type: "reveal_red_wires"});
    });
  }
  if (bombBustersContinueBtnEl) {
    bombBustersContinueBtnEl.addEventListener("click", () => {
      if (!bombBustersHasAction("continue_mission")) return;
      bombBustersDispatch({type: "continue_mission"});
    });
  }
  if (bombBustersWirePopoverConfirmBtnEl) {
    bombBustersWirePopoverConfirmBtnEl.addEventListener("click", () => {
      const selection = bombBustersSelectedAction(bombBustersView);
      if (!selection) return;
      bombBustersDispatch(selection.action);
    });
  }
  if (bombBustersWirePopoverCancelBtnEl) {
    bombBustersWirePopoverCancelBtnEl.addEventListener("click", () => bombBustersResetSelection(true));
  }

  window.addEventListener("resize", () => {
    if (bombBustersView) bombBustersRenderWirePopover(bombBustersView);
  });
  window.addEventListener("scroll", bombBustersScheduleWirePopoverPosition, {capture: true, passive: true});

  document.addEventListener(
    "click",
    (event) => {
      if (
        !bombBustersExplainMode ||
        typeof currentGameType === "undefined" ||
        currentGameType !== "bomb_busters"
      ) return;
      const exceptions = [bombBustersHelpBtnEl, bombBustersExplainBtnEl, bombBustersHelpCloseBtnEl, bombBustersExplainCloseBtnEl];
      const clickedButton = event.target.closest("button");
      if (clickedButton && exceptions.includes(clickedButton)) return;
      const insideGame = bombBustersPanelEl && bombBustersPanelEl.contains(event.target);
      if (!insideGame) return;
      event.preventDefault();
      event.stopPropagation();
      const target = event.target.closest("[data-bomb-busters-explain]");
      const key = target && target.dataset.bombBustersExplain;
      if (key && BOMB_BUSTERS_EXPLANATIONS[key]) {
        bombBustersShowExplanation(key);
        bombBustersSetExplainMode(false);
      }
    },
    true
  );

  document.addEventListener(
    "pointerdown",
    (event) => {
      if (
        !bombBustersExplainMode ||
        typeof currentGameType === "undefined" ||
        currentGameType !== "bomb_busters"
      ) return;
      const target = bombBustersFindDisabledExplainTargetAtPoint(event.clientX, event.clientY);
      if (!target) return;
      event.preventDefault();
      event.stopPropagation();
      bombBustersShowExplanation(target.dataset.bombBustersExplain);
      bombBustersSetExplainMode(false);
    },
    true
  );

  document.addEventListener("pointerdown", (event) => {
    if (
      bombBustersExplainMode ||
      !bombBustersView ||
      typeof currentGameType === "undefined" ||
      currentGameType !== "bomb_busters" ||
      !bombBustersPanelEl ||
      !bombBustersPanelEl.contains(event.target)
    ) return;
    const hasSelection = bombBustersSelectedOwnWireId || bombBustersSelectedTargetWireIds.length || bombBustersSelectedSoloWireIds.length;
    if (!hasSelection) return;
    if (event.target.closest("button, .bomb-busters-wire-slot, .bomb-busters-wire-popover")) return;
    bombBustersResetSelection(true);
  });

  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") return;
    if (bombBustersExplainMode) bombBustersSetExplainMode(false);
    const hasSelection = bombBustersSelectedOwnWireId || bombBustersSelectedTargetWireIds.length || bombBustersSelectedSoloWireIds.length;
    if (hasSelection) bombBustersResetSelection(true);
    if (bombBustersHelpModalEl && !bombBustersHelpModalEl.classList.contains("hidden")) {
      bombBustersSetModal(bombBustersHelpModalEl, false, bombBustersHelpBtnEl);
    }
    if (bombBustersExplainModalEl && !bombBustersExplainModalEl.classList.contains("hidden")) {
      bombBustersSetModal(bombBustersExplainModalEl, false);
    }
  });

  window.clearBombBustersState = bombBustersClearState;
  window.renderBombBustersGameState = bombBustersRenderGameState;
  window.showBombBustersHeaderActions = bombBustersShowHeaderActions;
})();
