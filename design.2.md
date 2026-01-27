# OpenBoardGame Design 2 (MVP)

## Why design.1 is insufficient
- Missing wire-level payloads for Socket.IO events (fields, required vs optional).
- No concrete room/game state transitions or error handling rules.
- CABO action flow lacks explicit phases and action preconditions.
- Deck composition and shuffle rules are unspecified.
- Bot integration is not defined (how to trigger, how to select actions).

This document defines concrete assumptions so we can implement an MVP that is
consistent with design.1 while keeping scope small and testable.

## Scope (MVP)
- One server process with in-memory rooms.
- Socket.IO for real-time actions and state sync.
- Single game module: CABO.
- Basic bots (random legal actions).
- Single-page HTML UI for create/join, ready/start, and core gameplay actions.

## File layout
- app.py: FastAPI + Socket.IO entrypoint and room management.
- game/cabo.py: CABO game logic and module interface.
- static/index.html, static/app.js, static/style.css: UI.
- requirements.txt.

## Data models

### Room
- room_id: string
- game_type: "cabo"
- status: "lobby" | "in_game" | "game_over"
- players: list of Player (seat order)
- state_version: int (increment on every state change)
- game_state: CABO state (only when in_game)

### Player
- player_id: string
- name: string
- seat: int (0..n-1)
- socket_id: string
- ready: bool
- connected: bool
- is_bot: bool

### Card
- value: int (0-13)
- choice: null | "peek" | "spy" | "swap"

### CABO state
- deck: list[Card]
- discard: list[Card]
- players: map[player_id] -> {
    hand: list[Card | null] (length 4)
    known: list[bool] (length 4, only for owner)
    public_known: list[bool] (length 4, known to all)
    score: int
    score_reset_used: bool
    initial_peek_done: bool
  }
- turn_order: list[player_id]
- current_turn: player_id
- phase: "initial_peek" | "turn" | "drawn" | "choice_pending" | "round_end"
- last_drawn: Card | null
- pending_choice: null | {type: "peek" | "spy" | "swap"}
- cabo_called_by: player_id | null
- cabo_turns_left: int
- config: {
    target_score: int (default 100)
    shooting_moon: bool (default false)
    score_reset: bool (default false)
    double_swap: bool (default false)
    deck_counts: map[value] -> count (default 4 each 0-13)
  }

Knowledge rules (MVP simplification): knowledge is attached to slots, not cards.
Whenever a slot is replaced or swapped, known/public_known is cleared for that
slot.

## Socket.IO events

### Client -> Server
- room:create {name, game_type}
- room:join {room_id, name}
- room:leave {room_id}
- room:ready {room_id, ready}
- room:start {room_id}
- room:add_bot {room_id, name?}
- game:action {room_id, action}

### Server -> Client
- system:error {message}
- system:info {message}
- room:state {room_id, players, status, game_type}
- game:state {room_id, state_version, view, events}

Events list is informational and may be empty in the MVP. The authoritative
view is always in game:state.

## CABO action schema

All actions include a type string.

- initial_peek {type:"initial_peek", slots:[int,int]}
- draw_deck {type:"draw_deck"}
- draw_discard {type:"draw_discard", slot:int}
- replace_card {type:"replace_card", slot:int}
- discard_drawn {type:"discard_drawn"}
- attempt_match {type:"attempt_match", slots:[int,...]}
- call_cabo {type:"call_cabo"}
- use_choice_action {type:"use_choice_action", choice_type:"peek"|"spy"|"swap",
  target:{player_id?, slot?, self_slot?}}

## CABO phases and rules

### initial_peek
- Each player chooses two distinct slots to peek once.
- After all players have completed, phase -> "turn" and current_turn is the
  first in turn_order.

### turn
- Current player chooses one of:
  - draw_deck (phase -> "drawn")
  - draw_discard (replace chosen slot, end turn)
  - call_cabo (end round after all other players take one more turn)

### drawn
- Player holds last_drawn and must choose:
  - replace_card (replace slot, end turn)
  - discard_drawn (discard; if choice card then phase -> "choice_pending")
  - attempt_match (2-4 slots): if all match value, discard those cards and
    keep last_drawn in first slot; otherwise reveal chosen slots (public_known)
    and discard last_drawn. End turn.

### choice_pending
- If last_drawn was choice and discarded, execute ability:
  - peek: reveal own slot to self (known)
  - spy: reveal other player's slot to self (known)
  - swap: swap own slot and another player's slot (clear knowledge)
- After ability, end turn.

### end of round
- When cabo_called_by is set, each other player takes one final turn.
- Then reveal all cards and score the round.
- Score rules (per design.1): lowest round score gets 0; others add their sum;
  cabo caller gets +5 if not lowest; ties handled per design.1.
- If shooting_moon enabled and a player has exactly two 12s and two 13s,
  they score 0 and others score 50 for the round.
- If score_reset enabled and total score == 100 for a player who has not used
  reset, set score to 50 and mark used.
- If any score >= target_score, game_over; otherwise start new round.

## Bot behavior (MVP)
- Bot uses random legal actions with simple heuristics:
  - During initial_peek: random two slots.
  - During turn: prefer draw_deck; sometimes draw_discard; never call_cabo.
  - During drawn: attempt_match if possible; otherwise replace or discard.
  - During choice_pending: random valid target.

## Error handling
- Invalid action -> system:error and no state change.
- All state changes increment state_version and broadcast game:state.

