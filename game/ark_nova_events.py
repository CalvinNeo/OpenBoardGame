"""Recipient-specific event views for Ark Nova's hidden cards."""

from __future__ import annotations

import copy
from typing import Any, Dict, List, Mapping, Sequence


def filter_ark_nova_events(events: Sequence[Mapping[str, Any]], viewer_id: str) -> List[Dict[str, Any]]:
    """Copy events while retaining private card identities only for their owner.

    Core events have a namespaced type and payload; effect events are flat.
    Explicitly revealed cards, display acquisitions and discards remain public.
    Bot plans are private even when part of the plan has already been played:
    the corresponding successful card events announce those public cards.
    """
    visible = copy.deepcopy(list(events))
    for event in visible:
        kind = str(event.get("type", "")).removeprefix("ark_nova:")
        payload = event.get("payload", event)
        if not isinstance(payload, dict):
            continue
        effect_ref = payload.get("effect_ref")
        owner_id = payload.get("player_id")
        if owner_id is None and isinstance(effect_ref, Mapping):
            owner_id = effect_ref.get("player_id")
        if owner_id == viewer_id:
            continue

        if kind == "bot:action":
            action = payload.get("action", {})
            payload["action"] = {"type": action.get("type")} if isinstance(action, Mapping) else {}
        elif kind == "cards":
            payload["draw_count"] = len(payload.pop("drawn", []))
        elif kind in {"cards_drawn", "cards_tucked"}:
            payload["count"] = len(payload.pop("card_ids", []))
        elif kind in {"final_scoring_card_kept", "base_project_taken"}:
            payload.pop("card_id", None)
        elif kind == "pilfering" and payload.get("target_player_id") != viewer_id:
            payload["card_count"] = int(bool(payload.pop("card_id", None)))

        # Diagnostic effect references can carry an entire private pending
        # choice, including its options and revealed/final-card candidates.
        if isinstance(effect_ref, dict):
            effect_ref.pop("metadata", None)
    return visible
