(() => {
  "use strict";

  let bombBustersCampaignView = null;
  let bombBustersCampaignSend = null;
  let bombBustersCampaignRefresh = null;
  let bombBustersCampaignSelection = null;
  let bombBustersCampaignVersion = null;
  let bombBustersCampaignTimer = null;

  const bombBustersCampaignElement = (suffix) => document.getElementById(`bombBusters${suffix}`);
  const bombBustersCampaignWires = () => (bombBustersCampaignView?.racks || []).flatMap((rack) => rack.slots.map((wire) => ({...wire, rack})));
  const bombBustersCampaignPlayerName = (playerId) => bombBustersCampaignView?.players.find((player) => player.player_id === playerId)?.name || playerId;
  const bombBustersCampaignIsTurn = () => bombBustersCampaignView?.phase === "playing" && bombBustersCampaignView.current_turn === bombBustersCampaignView.you;

  function bombBustersCampaignButton(label, callback, explanation = "") {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = label;
    button.dataset.bombBustersExplain = "campaign";
    button.dataset.bombBustersExplanation = explanation || label;
    button.addEventListener("click", callback);
    return button;
  }

  function bombBustersCampaignSelect(label, values, selected, onChange) {
    const wrapper = document.createElement("label");
    wrapper.className = "bomb-busters-campaign-field";
    const caption = document.createElement("span");
    caption.textContent = label;
    const select = document.createElement("select");
    values.forEach((entry) => {
      const option = document.createElement("option");
      const value = typeof entry === "object" ? entry.value : entry;
      option.value = value;
      option.textContent = typeof entry === "object" ? entry.label : String(entry);
      option.selected = String(value) === String(selected);
      select.appendChild(option);
    });
    select.addEventListener("change", () => onChange(select.value));
    wrapper.append(caption, select);
    return wrapper;
  }

  function bombBustersCampaignPopulateMissions() {
    const select = bombBustersCampaignElement("MissionSelect");
    if (!select || select.dataset.ready) return;
    select.dataset.ready = "true";
    select.replaceChildren();
    [[1, 8, "Training · 01–08"], [9, 19, "Box 1 · 09–19"], [20, 30, "Box 2 · 20–30"],
      [31, 42, "Box 3 · 31–42"], [43, 54, "Box 4 · 43–54"], [55, 66, "Final Box · 55–66"]].forEach(([first, last, label]) => {
      const group = document.createElement("optgroup");
      group.label = label;
      for (let number = first; number <= last; number += 1) {
        const option = document.createElement("option");
        option.value = number;
        option.textContent = `${String(number).padStart(2, "0")}${[19, 30, 42, 54, 66].includes(number) ? " · 🎧 Audio companion" : ""}${[34, 65].includes(number) ? " · 3–5 players" : ""}`;
        group.appendChild(option);
      }
      select.appendChild(group);
    });
    const practice = document.createElement("option");
    practice.value = "practice";
    practice.textContent = "Original Practice · 3 setups";
    select.appendChild(practice);
    select.value = "1";
    select.addEventListener("change", () => {
      bombBustersCampaignElement("PracticeRow").hidden = select.value !== "practice";
    });
  }

  function bombBustersCampaignOpenSelection(kind, card = null) {
    bombBustersCampaignSelection = {kind, card, wireIds: [], value: 1, label: "1", recipientId: "", playerIds: [],
      rackId: "", constraint: "A", numberCards: []};
    bombBustersCampaignRenderSelection();
    bombBustersCampaignRefresh?.();
  }

  function bombBustersCampaignReset() {
    bombBustersCampaignSelection = null;
    bombBustersCampaignElement("CampaignSelection")?.classList.add("hidden");
    bombBustersCampaignRefresh?.();
  }

  function bombBustersCampaignSelectable(rack, wire) {
    const selection = bombBustersCampaignSelection;
    if (!selection) return false;
    const own = rack.owner_id === bombBustersCampaignView.you;
    const kind = selection.card?.kind || selection.kind;
    if (kind === "special") return wire.status === "uncut";
    if (["equal", "not_equal"].includes(kind)) return own && !wire.reversed && !wire.unsorted;
    if (kind === "single_label") return own && !wire.hidden && wire.kind === "blue" && !wire.reversed;
    if (kind === "post_it") return own && !wire.hidden && wire.kind === "blue" && !wire.reversed && (wire.status === "uncut" || [24, 40].includes(bombBustersCampaignView.campaign.id));
    if (kind === "grappling_hook") return !own && wire.status === "uncut" && !wire.reversed && !wire.unsorted;
    if (["walkie_talkies", "fast_pass"].includes(kind)) return wire.status === "uncut" && !wire.reversed && !wire.unsorted && (kind !== "fast_pass" || own);
    if (["triple_detector", "super_detector", "x_or_y"].includes(kind)) return wire.status === "uncut" && !wire.reversed && !wire.unsorted && (!own || !wire.hidden && (kind === "x_or_y" || wire.kind === "blue"));
    return false;
  }

  function bombBustersCampaignSelectWire(rack, wire) {
    if (!bombBustersCampaignSelectable(rack, wire)) return;
    const selection = bombBustersCampaignSelection;
    const ids = selection.wireIds;
    const index = ids.indexOf(wire.wire_id);
    if (index >= 0) ids.splice(index, 1);
    else ids.push(wire.wire_id);
    bombBustersCampaignRenderSelection();
    bombBustersCampaignRefresh?.();
  }

  function bombBustersCampaignRenderSelection() {
    const root = bombBustersCampaignElement("CampaignSelection");
    if (!root) return;
    const selection = bombBustersCampaignSelection;
    root.classList.toggle("hidden", !selection);
    if (!selection) return;
    const publicState = bombBustersCampaignView.campaign;
    const kind = selection.card?.kind || selection.kind;
    bombBustersCampaignElement("CampaignSelectionTitle").textContent = selection.card?.name || (kind === "special" ? publicState.special_action?.label : kind === "guess_link" ? "Identify the weakest link" : "Mission choice");
    const selected = bombBustersCampaignWires().filter((wire) => selection.wireIds.includes(wire.wire_id));
    bombBustersCampaignElement("CampaignSelectionSummary").textContent = selected.length
      ? selected.map((wire) => `${bombBustersCampaignPlayerName(wire.rack.owner_id)} · ${String.fromCharCode(65 + wire.rack.rack_index)} #${wire.slot_index + 1}`).join(" · ")
      : ["rewinder", "stabilizer", "radar", "batteries", "coffee"].includes(kind) ? selection.card.description : "Choose wires directly on the racks, then confirm here.";
    const options = bombBustersCampaignElement("CampaignSelectionOptions");
    options.replaceChildren();
    if (kind === "radar") options.appendChild(bombBustersCampaignSelect("Number", Array.from({length: 12}, (_, index) => index + 1), selection.value, (value) => { selection.value = Number(value); }));
    if (["coffee", "guess_link"].includes(kind)) {
      const players = bombBustersCampaignView.players.filter((player) => player.remaining_count).map((player) => ({value: player.player_id, label: player.name || player.player_id}));
      if (!selection.recipientId) selection.recipientId = players[0]?.value || "";
      options.appendChild(bombBustersCampaignSelect("Player", players, selection.recipientId, (value) => { selection.recipientId = value; }));
    }
    if (kind === "guess_link") options.appendChild(bombBustersCampaignSelect("Constraint", Object.keys(publicState.constraint_texts).slice(0, 5).map((key) => ({value: key, label: `${key} · ${publicState.constraint_texts[key]}`})), selection.constraint, (value) => { selection.constraint = value; }));
    if (kind === "batteries") {
      bombBustersCampaignView.players.filter((player) => player.personal_detector_used && !player.personal_detector_disabled).forEach((player) => {
        const button = bombBustersCampaignButton(player.name || player.player_id, () => {
          const index = selection.playerIds.indexOf(player.player_id);
          if (index >= 0) selection.playerIds.splice(index, 1);
          else if (selection.playerIds.length < 2) selection.playerIds.push(player.player_id);
          bombBustersCampaignRenderSelection();
        }, "Recharge this player's used personal detector.");
        button.setAttribute("aria-pressed", selection.playerIds.includes(player.player_id) ? "true" : "false");
        options.appendChild(button);
      });
    }
    if (["grappling_hook"].includes(kind)) {
      const racks = bombBustersCampaignView.racks.filter((rack) => rack.owner_id === bombBustersCampaignView.you).map((rack) => ({value: rack.rack_id, label: `Rack ${String.fromCharCode(65 + rack.rack_index)}`}));
      if (!selection.rackId) selection.rackId = racks[0]?.value || "";
      options.appendChild(bombBustersCampaignSelect("Receive on", racks, selection.rackId, (value) => { selection.rackId = value; }));
    }
    if (publicState.id === 47) bombBustersCampaignRenderNumberPayment(options);
    const confirm = bombBustersCampaignElement("CampaignConfirm");
    let ready = true;
    if (kind === "special") ready = selection.wireIds.length === publicState.special_action.count;
    else if (["equal", "not_equal", "walkie_talkies", "fast_pass"].includes(kind)) ready = selection.wireIds.length === 2;
    else if (["post_it", "single_label", "grappling_hook"].includes(kind)) ready = selection.wireIds.length === 1;
    else if (["triple_detector", "super_detector", "x_or_y"].includes(kind)) {
      const own = selected.filter((wire) => wire.rack.owner_id === bombBustersCampaignView.you);
      const targets = selected.filter((wire) => wire.rack.owner_id !== bombBustersCampaignView.you);
      ready = kind === "x_or_y" ? own.length === 2 && targets.length === 1 : own.length === 1 && (kind === "super_detector" ? targets.length >= 1 : targets.length === 3);
    } else if (kind === "batteries") ready = selection.playerIds.length >= 1;
    confirm.disabled = !ready;
  }

  function bombBustersCampaignRenderNumberPayment(root) {
    const selection = bombBustersCampaignSelection;
    const publicState = bombBustersCampaignView.campaign;
    const field = document.createElement("div");
    field.className = "bomb-busters-number-payment";
    const label = document.createElement("strong");
    label.textContent = "Spend two Number cards";
    field.appendChild(label);
    publicState.number_cards.forEach((number) => {
      const button = bombBustersCampaignButton(String(number), () => {
        const index = selection.numberCards.indexOf(number);
        if (index >= 0) selection.numberCards.splice(index, 1);
        else if (selection.numberCards.length < 2) selection.numberCards.push(number);
        bombBustersCampaignRenderSelection();
      }, "Choose two cards whose sum or difference is the wire value.");
      button.setAttribute("aria-pressed", selection.numberCards.includes(number) ? "true" : "false");
      field.appendChild(button);
    });
    root.appendChild(field);
  }

  function bombBustersCampaignConfirmSelection() {
    const selection = bombBustersCampaignSelection;
    if (!selection) return;
    const kind = selection.card?.kind || selection.kind;
    const selected = bombBustersCampaignWires().filter((wire) => selection.wireIds.includes(wire.wire_id));
    const own = selected.filter((wire) => wire.rack.owner_id === bombBustersCampaignView.you);
    const targets = selected.filter((wire) => wire.rack.owner_id !== bombBustersCampaignView.you);
    let action = {type: "use_equipment", equipment_id: selection.card?.id};
    if (kind === "special") action = {type: "special_cut", wire_ids: [...selection.wireIds]};
    else if (kind === "guess_link") action = {type: "mission_choice", choice: "guess_link", player_id: selection.recipientId, constraint: selection.constraint};
    else if (["equal", "not_equal", "walkie_talkies", "fast_pass"].includes(kind)) action.wire_ids = [...selection.wireIds];
    else if (["post_it", "single_label", "grappling_hook"].includes(kind)) {
      action.wire_id = selection.wireIds[0];
      if (kind === "grappling_hook") action.rack_id = selection.rackId;
    } else if (["triple_detector", "super_detector"].includes(kind)) {
      action.own_wire_id = own[0]?.wire_id;
      action.target_wire_ids = kind === "super_detector"
        ? bombBustersCampaignWires().filter((wire) => wire.rack.rack_id === targets[0]?.rack.rack_id && wire.status === "uncut" && !wire.reversed && !wire.unsorted).map((wire) => wire.wire_id)
        : targets.map((wire) => wire.wire_id);
    } else if (kind === "x_or_y") {
      action.own_wire_ids = own.map((wire) => wire.wire_id);
      action.target_wire_id = targets[0]?.wire_id;
    } else if (kind === "radar") action.value = selection.value;
    else if (kind === "batteries") action.player_ids = [...selection.playerIds];
    else if (kind === "coffee") action.recipient_id = selection.recipientId;
    if (selection.numberCards.length === 2) action.number_cards = [...selection.numberCards];
    bombBustersCampaignSend?.(action);
  }

  function bombBustersCampaignRender(view, send, refresh, version) {
    bombBustersCampaignView = view;
    bombBustersCampaignSend = send;
    bombBustersCampaignRefresh = refresh;
    const root = bombBustersCampaignElement("Campaign");
    if (!root) return;
    root.classList.toggle("hidden", !view.campaign);
    if (bombBustersCampaignTimer) window.clearInterval(bombBustersCampaignTimer);
    bombBustersCampaignTimer = null;
    if (!view.campaign) return;
    if (version !== bombBustersCampaignVersion) {
      bombBustersCampaignSelection = null;
      bombBustersCampaignVersion = version;
    }
    const publicState = view.campaign;
    const status = bombBustersCampaignElement("MissionState");
    status.replaceChildren();
    const addStatus = (text, explanation = text) => {
      const badge = document.createElement("span");
      badge.textContent = text;
      badge.dataset.bombBustersTip = explanation;
      badge.dataset.bombBustersExplain = "campaign";
      badge.dataset.bombBustersExplanation = explanation;
      status.appendChild(badge);
    };
    if (publicState.sequence.length) addStatus(`↔ ${publicState.sequence.join(" → ")}`, `Priority line, ${publicState.sequence_side} end active. ${publicState.sequence_threshold} wires required before the next number.`);
    if (publicState.forced_value) addStatus(`🎯 ${publicState.forced_value}`, "This is the current mission number, not a revealed teammate wire.");
    if (publicState.danger_number) addStatus(`🔴 Blue ${publicState.danger_number}`, "All four wires of this blue number behave as dangerous red wires.");
    if (publicState.special_player) addStatus(`⚠️ ${bombBustersCampaignPlayerName(publicState.special_player)}`, "This player has the special role described in this mission's Help.");
    if (publicState.shared_constraint) addStatus(`📋 ${publicState.shared_constraint}`, publicState.constraint_texts[publicState.shared_constraint]);
    if (publicState.your_constraint) addStatus(`You: ${publicState.your_constraint}${publicState.you_are_weakest_link === false ? " (inactive)" : ""}`, publicState.constraint_texts[publicState.your_constraint]);
    if (publicState.nano) addStatus(`🤖 Nano ${publicState.nano.line ? publicState.nano.line[publicState.nano.position] : publicState.nano.position}${publicState.nano.direction > 0 ? " →" : " ←"}${publicState.reserve_count ? ` · ${publicState.reserve_count} held` : ""}`, "Nano's position, direction and number of hidden reserve wires. See this mission's Help for movement rules.");
    if (publicState.oxygen && Object.keys(publicState.oxygen).length) Object.entries(publicState.oxygen).forEach(([player, amount]) => addStatus(`🫧 ${bombBustersCampaignPlayerName(player)} ${amount}`, "This player's available oxygen. A cut must pay its mission-specific cost first."));
    if ([44, 54, 63].includes(publicState.id)) addStatus(`🫧 Reserve ${publicState.oxygen_reserve}`, "Oxygen in the shared reserve.");
    if (publicState.reward_numbers.length) addStatus(`↶ ${publicState.reward_numbers.join(" · ")}`, "Validating one of these values rewinds the detonator one step.");
    if (publicState.number_cards.length) addStatus(`🔢 ${publicState.number_cards.join(" · ")}`, "Currently available Number cards for this mission.");
    Object.entries(publicState.number_hands).forEach(([player, numbers]) => addStatus(`${bombBustersCampaignPlayerName(player)}: ${numbers.join(" · ")}`, "Mission Number cards. Private hands are only sent to their owner."));
    if (publicState.bunker) addStatus(`🏰 Floor ${publicState.bunker.floor + 1} · ${publicState.bunker.position.join(",")}`, "Your position in the bunker. Move after each cut toward a matching constraint. Audio instructions use companion controls.");
    const clock = document.createElement("span");
    if (publicState.clock && view.phase !== "mission_result") {
      status.appendChild(clock);
      const updateClock = () => {
        const remaining = Math.max(0, Math.ceil(publicState.clock.deadline - Date.now() / 1000));
        clock.textContent = `⏱ ${Math.floor(remaining / 60)}:${String(remaining % 60).padStart(2, "0")}`;
        if (!remaining && view.you === view.captain_id) send({type: "mission_choice", choice: "timer_expired"});
      };
      updateClock();
      bombBustersCampaignTimer = window.setInterval(updateClock, 1000);
    }
    const choices = bombBustersCampaignElement("MissionChoices");
    choices.replaceChildren();
    if (publicState.decision) {
      const heading = document.createElement("strong");
      heading.textContent = `${publicState.decision.kind.replaceAll("_", " ")} · ${bombBustersCampaignPlayerName(publicState.decision.player_id)}`;
      choices.appendChild(heading);
      publicState.decision.choices.forEach((entry) => choices.appendChild(bombBustersCampaignButton(entry.label, () => send({type: "mission_choice", choice: entry.value}), "Resolve the mission choice shown here. Your private options are not sent to other players.")));
    }
    if (publicState.can_claim_turn) choices.appendChild(bombBustersCampaignButton("✂️ Snip! Take Turn", () => send({type: "mission_choice", choice: "claim_turn"}), "Volunteer to act now. Consecutive turns are forbidden with more than two active players."));
    if (view.phase === "initial_info" && view.initial_info_player_id === view.you) {
      if (publicState.id === 22) publicState.initial_label_choices.forEach((label) => choices.appendChild(bombBustersCampaignButton(`No ${label}`, () => send({type: "place_initial_info", label}), "Announce a value absent from your hand.")));
      else if (publicState.initial_negative) {
        choices.appendChild(bombBustersCampaignSelect("False clue", publicState.initial_label_choices, "1", () => {}));
        choices.lastElementChild.querySelector("select").id = "bombBustersNegativeLabel";
      }
    }
    if (bombBustersCampaignIsTurn()) {
      if (publicState.special_action) choices.appendChild(bombBustersCampaignButton(publicState.special_action.label, () => bombBustersCampaignOpenSelection("special"), "Select the indicated number of rack wires, then confirm. A wrong special selection may explode the bomb."));
      if (view.legal_actions.includes("mission_choice")) choices.appendChild(bombBustersCampaignButton("Pass", () => send({type: "mission_choice", choice: "pass"}), "Skip only where mission rules permit it. Some missions charge one detonator step."));
      if (publicState.id === 34 && publicState.you_are_weakest_link === false) choices.appendChild(bombBustersCampaignButton("Identify Weakest Link", () => bombBustersCampaignOpenSelection("guess_link"), "Guess both the secret player and their constraint. A wrong guess costs one detonator step."));
      if (publicState.id === 61) choices.appendChild(bombBustersCampaignButton("Replace Constraint −1", () => send({type: "mission_choice", choice: "replace_constraint"}), "Spend one detonator step to draw a random replacement constraint F–L."));
      if (publicState.id === 32 && view.you === view.captain_id) choices.appendChild(bombBustersCampaignButton("Next Constraint", () => send({type: "mission_choice", choice: "change_constraint"}), "Replace the shared constraint with the next card."));
      if (publicState.id === 47) {
        const cards = publicState.number_cards.map((value) => ({value, label: String(value)}));
        ["FirstNumber", "SecondNumber"].forEach((suffix, index) => {
          const field = bombBustersCampaignSelect(index ? "Second card" : "First card", cards, cards[index]?.value, () => {});
          field.querySelector("select").id = `bombBusters${suffix}`;
          choices.appendChild(field);
        });
      }
      if (publicState.id === 49) {
        const recipients = view.players.filter((player) => player.player_id !== view.you && player.remaining_count).map((player) => ({value: player.player_id, label: player.name || player.player_id}));
        const field = bombBustersCampaignSelect("Give oxygen to", recipients, recipients[0]?.value, () => {});
        field.querySelector("select").id = "bombBustersOxygenRecipient";
        choices.appendChild(field);
      }
      if (view.racks.some((rack) => rack.owner_id === view.you && rack.slots.some((wire) => wire.reversed && wire.hidden && wire.status === "uncut"))) {
        const field = bombBustersCampaignSelect("Reversed declaration", [...Array.from({length: 12}, (_, index) => String(index + 1)), "yellow"], "1", () => {});
        field.querySelector("select").id = "bombBustersReversedDeclaration";
        choices.appendChild(field);
      }
    }
    publicState.challenges.forEach((challenge) => addStatus(`🏆 ${challenge.id}`, challenge.text));
    if (publicState.challenge_numbers.length) addStatus(`🏆 Numbers ${publicState.challenge_numbers.join(" + ")}`, "Challenge 8 requires these to be the first two validated numbers.");
    if (publicState.radar.length) publicState.radar.forEach((entry) => {
      const rack = view.racks.find((candidate) => candidate.rack_id === entry.rack_id);
      addStatus(`📡 ${bombBustersCampaignPlayerName(rack?.owner_id)} ${String.fromCharCode(65 + (rack?.rack_index || 0))}: ${entry.has_value ? "Yes" : "No"}`, `Whether this rack has an uncut ${publicState.radar_value}.`);
    });
    publicState.clue_notes.forEach((note) => addStatus(`${bombBustersCampaignPlayerName(note.player_id)} ${note.absent ? "≠" : "ℹ"} ${note.label}`, "A public clue beside the rack, rather than attached to a particular wire."));
    const equipment = bombBustersCampaignElement("EquipmentCards");
    equipment.replaceChildren();
    bombBustersCampaignElement("EquipmentCount").textContent = `${publicState.equipment.filter((card) => card.unlocked && !card.used).length} ready`;
    publicState.equipment.forEach((card) => {
      const button = bombBustersCampaignButton(`${card.hidden ? "🔒" : card.used ? "✓" : card.unlocked ? "🧰" : "🔒"} ${card.name}${card.hidden ? "" : ` · ${card.value || "🟡"}${card.extra_value ? ` + ${card.extra_value}` : ""}`}`, () => bombBustersCampaignOpenSelection("equipment", card), card.description || "The equipment's identity remains hidden until this mission reveals it.");
      button.disabled = !card.can_use;
      button.className = "bomb-busters-equipment-card";
      equipment.appendChild(button);
    });
    bombBustersCampaignElement("Equipment").classList.toggle("hidden", publicState.equipment.length === 0);
    bombBustersCampaignRenderCompanion(view);
    bombBustersCampaignRenderSelection();
  }

  function bombBustersCampaignRenderCompanion(view) {
    const publicState = view.campaign;
    const root = bombBustersCampaignElement("Companion");
    root.classList.toggle("hidden", !publicState.audio_companion);
    const controls = bombBustersCampaignElement("CompanionControls");
    controls.replaceChildren();
    if (!publicState.audio_companion || view.you !== view.captain_id || view.phase !== "playing") return;
    const instruction = (label, choice, extra = {}) => controls.appendChild(bombBustersCampaignButton(label, () => bombBustersCampaignSend({type: "mission_choice", choice, ...extra}), "Apply only an instruction just announced by the external official recording. Everyone sees this change."));
    instruction("Detonator −1", "audio_detonator", {amount: -1});
    instruction("Detonator +1", "audio_detonator", {amount: 1});
    instruction("Reveal Number", "audio_number");
    if ([42, 66].includes(publicState.id)) {
      const field = bombBustersCampaignSelect("Constraint", [{value: "none", label: "None"}, ...Object.entries(publicState.constraint_texts).map(([value, text]) => ({value, label: `${value} · ${text}`}))], "none", () => {});
      controls.appendChild(field);
      controls.appendChild(bombBustersCampaignButton("Apply Constraint", () => bombBustersCampaignSend({type: "mission_choice", choice: "audio_constraint", constraint: field.querySelector("select").value}), "Apply the constraint announced by the recording."));
    }
    if (publicState.id === 54) {
      const recipients = view.players.map((player) => ({value: player.player_id, label: player.name || player.player_id}));
      const field = bombBustersCampaignSelect("Player", recipients, recipients[0]?.value, () => {});
      controls.appendChild(field);
      controls.appendChild(bombBustersCampaignButton("Add Reserve Red", () => {
        const playerId = field.querySelector("select").value;
        const rack = view.racks.find((candidate) => candidate.owner_id === playerId);
        bombBustersCampaignSend({type: "mission_choice", choice: "audio_red", player_id: playerId, rack_id: rack.rack_id});
      }, "Deal one hidden red reserve wire to the selected player's rack when the recording instructs it."));
      controls.appendChild(bombBustersCampaignButton("Give Oxygen +1", () => bombBustersCampaignSend({type: "mission_choice", choice: "audio_oxygen", player_id: field.querySelector("select").value, amount: 1}), "Transfer one oxygen from reserve to the selected player when announced."));
    }
    if (publicState.id === 66) instruction("Change Bunker Floor", "audio_floor");
    instruction("Recording: Failure", "audio_failure");
    instruction("Recording: Success", "audio_success");
  }

  function bombBustersCampaignDecorateAction(action) {
    if (!bombBustersCampaignView?.campaign) return action;
    const result = {...action};
    if (result.type === "place_initial_info" && bombBustersCampaignView.campaign.initial_negative) result.label = bombBustersCampaignElement("NegativeLabel")?.value || "1";
    if (["dual_cut", "double_detector_cut", "solo_cut", "use_equipment"].includes(result.type)) {
      if (bombBustersCampaignView.campaign.id === 47 && !result.number_cards) result.number_cards = [Number(bombBustersCampaignElement("FirstNumber")?.value), Number(bombBustersCampaignElement("SecondNumber")?.value)];
      if (bombBustersCampaignView.campaign.id === 49) result.recipient_id = bombBustersCampaignElement("OxygenRecipient")?.value;
      const own = bombBustersCampaignWires().find((wire) => wire.wire_id === result.own_wire_id);
      if (own?.reversed) result.declaration = bombBustersCampaignElement("ReversedDeclaration")?.value || "1";
    }
    return result;
  }


  bombBustersCampaignPopulateMissions();
  bombBustersCampaignElement("CampaignConfirm")?.addEventListener("click", bombBustersCampaignConfirmSelection);
  bombBustersCampaignElement("CampaignCancel")?.addEventListener("click", bombBustersCampaignReset);
  document.addEventListener("keydown", (event) => { if (event.key === "Escape" && bombBustersCampaignSelection) bombBustersCampaignReset(); });
  document.addEventListener("click", (event) => {
    if (!bombBustersCampaignSelection || !bombBustersCampaignElement("Panel")?.contains(event.target)) return;
    if (!event.target.closest("button, select, label, input, summary, .bomb-busters-campaign-selection, .bomb-busters-wire-slot")) bombBustersCampaignReset();
  });
  window.bombBustersCampaignUI = {
    render: bombBustersCampaignRender, reset: bombBustersCampaignReset,
    hasSelection: () => Boolean(bombBustersCampaignSelection),
    isSelected: (wireId) => Boolean(bombBustersCampaignSelection?.wireIds.includes(wireId)),
    selectable: bombBustersCampaignSelectable, selectWire: bombBustersCampaignSelectWire,
    decorateAction: bombBustersCampaignDecorateAction,
  };
})();
