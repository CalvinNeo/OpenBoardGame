(() => {
  "use strict";

  const element = (suffix) => document.getElementById(`bombBustersMission${suffix}`);
  const button = element("PickerBtn");
  const dialog = element("Picker");
  const select = element("PickerSelect");
  const preview = element("PickerPreview");
  const notice = element("PickerNotice");
  const error = element("PickerError");
  const start = element("PickerStart");
  const retry = element("PickerRetry");
  const languageButton = element("PickerLanguage");
  let view = null;
  let version = null;
  let context = null;
  let request = null;
  let catalog = null;
  let busy = false;
  let language = "zh";

  function room() {
    return typeof currentRoomState !== "undefined" && currentRoomState?.game_type === "bomb_busters" ? currentRoomState : null;
  }

  function connected() {
    return typeof socket !== "undefined" && socket.connected && typeof roomSessionReady !== "undefined" && roomSessionReady;
  }

  function isHost() {
    return room()?.host_player_id === (typeof playerId !== "undefined" ? playerId : null);
  }

  function blockReason() {
    const current = room();
    if (!current || !connected()) return "Reconnect to this room before starting a mission.";
    if (!isHost()) return "Only the host can start a mission. Everyone can browse the descriptions.";
    if (current.players.length < 2 || current.players.length > 5) return "Bomb Busters requires 2 to 5 players.";
    if (current.status === "lobby" && current.players.some((player) => !player.ready && !player.is_bot)) return "All players must be ready before starting.";
    if (!["lobby", "in_game", "game_over"].includes(current.status)) return "Wait for the room to finish preparing.";
    if (current.status !== "lobby" && version === null) return "Wait for the current game state.";
    return "";
  }

  function update() {
    const mission = catalog?.missions.find((entry) => entry.id === Number(select.value));
    preview.replaceChildren();
    if (mission) {
      const title = document.createElement("h3");
      title.textContent = `${mission.id}. ${mission.title[language]}`;
      const goal = document.createElement("p");
      goal.textContent = mission.summary[language];
      const rules = document.createElement("p");
      rules.textContent = mission.rules[language];
      preview.append(title, goal, rules);
      if (mission.audio_companion) {
        const audio = document.createElement("p");
        audio.textContent = language === "zh" ? "🎧 本关需要外部官方录音，并由玩家操作音频伴随控件。" : "🎧 Requires the external official recording and manual audio companion controls.";
        preview.appendChild(audio);
      }
      if (!mission.supported) {
        const warning = document.createElement("p");
        warning.textContent = `Requires ${mission.min_players}–5 players. This room has ${room()?.players.length || 0}.`;
        preview.appendChild(warning);
      }
    } else {
      preview.textContent = request ? "Loading mission descriptions…" : "Mission descriptions are unavailable. Retry to load them.";
    }
    const reason = blockReason();
    notice.textContent = reason || (room()?.status === "lobby"
      ? "Start the selected mission with everyone in this room. Browsing reveals later-mission rules."
      : "Starting redeals the wires and resets this attempt. Everyone stays in this room. Browsing reveals later-mission rules.");
    start.textContent = busy ? "Starting…" : room()?.status === "lobby" ? "Start Mission" : "Restart Mission";
    start.disabled = busy || Boolean(reason) || !mission?.supported;
    select.disabled = busy || !catalog;
    languageButton.textContent = language === "zh" ? "English" : "中文";
    if (catalog) {
      for (const option of select.options) {
        const entry = catalog.missions.find((item) => item.id === Number(option.value));
        option.textContent = `${entry.id}. ${entry.title[language]}${entry.supported ? "" : ` (${entry.min_players}–5 players)`}`;
      }
    }
  }

  async function load() {
    request?.abort();
    const controller = new AbortController();
    request = controller;
    catalog = null;
    error.textContent = "";
    retry.classList.add("hidden");
    update();
    const count = Math.max(2, Math.min(5, room()?.players.length || 3));
    try {
      const response = await fetch(`/api/bomb_busters/missions?player_count=${count}`, {signal: controller.signal});
      if (!response.ok) throw new Error("Mission descriptions could not be loaded.");
      const result = await response.json();
      if (result.player_count !== count || !Array.isArray(result.missions) || result.missions.length !== 66) throw new Error("Invalid mission catalog.");
      if (request !== controller || !dialog.open) return;
      catalog = result;
      select.replaceChildren(...catalog.missions.map((mission) => {
        const option = document.createElement("option");
        option.value = mission.id;
        return option;
      }));
      select.value = String(view?.campaign?.id || room()?.game_config?.mission_id || 1);
    } catch (failure) {
      if (failure.name === "AbortError" || request !== controller) return;
      error.textContent = "Mission descriptions could not be loaded. Please retry.";
      retry.classList.remove("hidden");
    } finally {
      if (request === controller) {
        request = null;
        update();
      }
    }
  }

  function sync() {
    if (!room()) {
      button.classList.add("hidden");
      if (dialog.open) dialog.close();
      return;
    }
    if (dialog.open) {
      if (context && (context.roomId !== room().room_id || context.status !== room().status || context.count !== room().players.length || context.version !== version)) {
        dialog.close();
      } else {
        update();
      }
    }
  }

  button?.addEventListener("click", () => {
    if (!room() || dialog.open) return;
    context = {roomId: room().room_id, status: room().status, count: room().players.length, version};
    language = typeof window.obgHelpLang === "function" ? window.obgHelpLang() : "zh";
    busy = false;
    dialog.showModal();
    load();
  });
  element("PickerClose")?.addEventListener("click", () => dialog.close());
  dialog?.addEventListener("close", () => {
    request?.abort();
    request = null;
    context = null;
    button.focus({preventScroll: true});
  });
  dialog?.addEventListener("click", (event) => {
    const bounds = dialog.getBoundingClientRect();
    if (event.target === dialog && (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom)) dialog.close();
  });
  select?.addEventListener("change", update);
  languageButton?.addEventListener("click", () => {
    language = language === "zh" ? "en" : "zh";
    update();
  });
  retry?.addEventListener("click", load);
  start?.addEventListener("click", () => {
    if (busy || start.disabled || blockReason() || !context) return;
    const selectedContext = context;
    busy = true;
    error.textContent = "";
    update();
    socket.timeout(15000).emit("bomb_busters:select_mission", {
      room_id: context.roomId, status: context.status, state_version: context.version, mission_id: Number(select.value),
    }, (failure, result) => {
      if (context !== selectedContext) return;
      busy = false;
      if (!failure && result?.ok) {
        dialog.close();
      } else {
        error.textContent = failure ? "No response. Reconnect before trying again." : result?.message || "Could not start the mission.";
        update();
      }
    });
  });

  if (typeof socket !== "undefined") {
    socket.on("room:state", sync);
    socket.on("connect", sync);
    socket.on("disconnect", sync);
  }
  window.bombBustersMissionPickerUI = {
    sync: (nextView, nextVersion) => { view = nextView; version = nextVersion; sync(); },
    clear: () => { view = null; version = null; if (dialog.open) dialog.close(); },
    show: (visible) => {
      const reconnect = document.getElementById("gameReconnectBtn");
      if (button && reconnect && button.previousElementSibling !== reconnect) reconnect.after(button);
      button?.classList.toggle("hidden", !visible);
      if (!visible && dialog.open) dialog.close();
    },
  };
})();
