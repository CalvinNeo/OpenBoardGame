from math import comb
from typing import Dict, List, Optional, Sequence, Tuple


SEARCH_CAST_LIMIT = 5


class _TurnPlanner:
    def __init__(self, view: Dict, spell_counts: Sequence[int]) -> None:
        self.players = view["players"]
        self.own_index = next(
            index for index, player in enumerate(self.players) if player["player_id"] == view["you"]
        )
        own = self.players[self.own_index]
        self.health = tuple(player["hp"] for player in self.players)
        self.secret_pool = view["secret_pool_count"]
        self.target_score = view.get("config", {}).get("target_score", 8)
        self.cycle_value = 0.08 if view["deck_count"] else 0.25
        self.opponent_weights = {
            index: 1.0 + player["score"] / max(1, self.target_score)
            for index, player in enumerate(self.players)
            if index != self.own_index
        }

        unseen = [count - discarded for count, discarded in zip(spell_counts, view["discard_counts"])]
        for index, player in enumerate(self.players):
            cards = player.get("secret_cards", []) if index == self.own_index else player["hand"]
            for card in cards:
                unseen[card["spell"]] -= 1

        history = view.get("turn_spells", [])
        last_action = view.get("last_action") or {}
        if not history and last_action.get("success") and last_action.get("player_id") == view["you"]:
            history = [last_action["spell_type"]]
        required = [0] * len(spell_counts)
        for spell in history:
            required[spell] += 1
            unseen[spell] += 1
        self.initial_casts = tuple(required)
        self.initial_cast_count = sum(required)
        self.hand_size = len(own["hand"]) + self.initial_cast_count
        self.unseen = tuple(max(0, count) for count in unseen)
        self.combinations = [
            tuple(comb(count, taken) for taken in range(min(count, self.hand_size) + 1))
            for count in self.unseen
        ]
        self.weight_cache: Dict[Tuple[int, ...], int] = {}
        self.value_cache: Dict[Tuple, float] = {}

    def _weight(self, required: Tuple[int, ...]) -> int:
        if required in self.weight_cache:
            return self.weight_cache[required]
        if sum(required) > self.hand_size or any(
            minimum > count for minimum, count in zip(required, self.unseen)
        ):
            return 0
        if self.hand_size == sum(self.unseen):
            return 1
        coefficients = [1] + [0] * self.hand_size
        for minimum, combinations in zip(required, self.combinations):
            updated = [0] * (self.hand_size + 1)
            for taken in range(minimum, len(combinations)):
                ways = combinations[taken]
                for total in range(self.hand_size - taken + 1):
                    updated[total + taken] += coefficients[total] * ways
            coefficients = updated
        result = coefficients[self.hand_size]
        self.weight_cache[required] = result
        return result

    def _secrets(self, required: Tuple[int, ...]) -> List[int]:
        secrets = [player["secret_count"] for player in self.players]
        secrets[self.own_index] += min(self.secret_pool, required[3] - self.initial_casts[3])
        return secrets

    def _opponent_average(self, values: Sequence[float]) -> float:
        return sum(values[index] * weight for index, weight in self.opponent_weights.items()) / max(
            1.0, sum(self.opponent_weights.values())
        )

    def _position_value(self, required: Tuple[int, ...], health: Tuple[int, ...]) -> float:
        secrets = self._secrets(required)
        values = [
            0.3 * hp - 0.6 / hp + secret * (0.5 + hp / 12)
            for hp, secret in zip(health, secrets)
        ]
        progress = self.cycle_value * (sum(required) - self.initial_cast_count)
        return values[self.own_index] - 0.65 * self._opponent_average(values) + progress

    def _round_value(self, result: str, required: Tuple[int, ...], health: Tuple[int, ...]) -> float:
        gains = self._secrets(required)
        for index, hp in enumerate(health):
            if hp <= 0:
                gains[index] = 0
            elif index == self.own_index and result != "self_death":
                gains[index] += 3
            elif result in ("kill", "self_death"):
                gains[index] += 1
        value = gains[self.own_index] - 0.65 * self._opponent_average(gains)
        candidates = [
            index for index, player in enumerate(self.players)
            if player["score"] + gains[index] >= self.target_score
        ]
        if candidates:
            best_gain = max(gains[index] for index in candidates)
            winners = [index for index in candidates if gains[index] == best_gain]
            return value + (24.0 / len(winners) if self.own_index in winners else -24.0)
        return value - (1.5 if result == "self_death" else 0.0)

    def _failure_value(self, spell: int, required: Tuple[int, ...], health: Tuple[int, ...]) -> float:
        outcomes = []
        for damage in (1, 2, 3) if spell == 0 else (1,):
            damaged = list(health)
            damaged[self.own_index] = max(0, damaged[self.own_index] - damage)
            if damaged[self.own_index] == 0:
                outcomes.append(self._round_value("self_death", required, tuple(damaged)))
            else:
                outcomes.append(self._position_value(required, tuple(damaged)))
        return sum(outcomes) / len(outcomes)

    def _success_value(self, spell: int, required: Tuple[int, ...], health: Tuple[int, ...]) -> float:
        outcomes = []
        for roll in (1, 2, 3) if spell in (0, 2) else (1,):
            updated = list(health)
            targets = []
            damage = 1
            healing = 0
            left = (self.own_index - 1) % len(self.players)
            right = (self.own_index + 1) % len(self.players)
            if spell in (0, 1):
                targets = list(self.opponent_weights)
                damage = roll if spell == 0 else 1
                healing = 1 if spell == 1 else 0
            elif spell == 2:
                healing = roll
            elif spell == 4:
                targets = list({left, right})
            elif spell == 5:
                targets = [left]
            elif spell == 6:
                targets = [right]
            elif spell == 7:
                healing = 1
            updated[self.own_index] = min(6, updated[self.own_index] + healing)
            for target in targets:
                updated[target] = max(0, updated[target] - damage)
            next_health = tuple(updated)
            if any(updated[target] == 0 for target in targets):
                outcomes.append(self._round_value("kill", required, next_health))
            elif sum(required) == self.hand_size:
                outcomes.append(self._round_value("empty_hand", required, next_health))
            else:
                outcomes.append(self._search(required, next_health, spell))
        return sum(outcomes) / len(outcomes)

    def _cast_value(self, spell: int, required: Tuple[int, ...], health: Tuple[int, ...]) -> float:
        next_casts = list(required)
        next_casts[spell] += 1
        next_required = tuple(next_casts)
        weight = self._weight(required)
        probability = self._weight(next_required) / weight if weight else 0.0
        failure = self._failure_value(spell, required, health) if probability < 1.0 else 0.0
        success = self._success_value(spell, next_required, health) if probability else 0.0
        return probability * success + (1.0 - probability) * failure

    def _search(self, required: Tuple[int, ...], health: Tuple[int, ...], minimum: int) -> float:
        key = (required, health, minimum)
        if key in self.value_cache:
            return self.value_cache[key]
        best = self._position_value(required, health)
        if sum(required) - self.initial_cast_count < SEARCH_CAST_LIMIT:
            for spell in range(minimum, len(self.unseen)):
                if required[spell] < self.unseen[spell]:
                    best = max(best, self._cast_value(spell, required, health))
        self.value_cache[key] = best
        return best

    def choose(self, allowed_spells: Sequence[int], can_stop: bool) -> Optional[Dict]:
        action = {"type": "end_turn"} if can_stop else None
        best = self._position_value(self.initial_casts, self.health) if can_stop else float("-inf")
        for spell in allowed_spells:
            value = self._cast_value(spell, self.initial_casts, self.health)
            if value > best + 1e-9:
                best = value
                action = {"type": "cast_spell", "spell_type": spell}
        return action


def choose_action(view: Dict, spell_counts: Sequence[int]) -> Optional[Dict]:
    if view.get("game_over") or view.get("you") != view.get("current_turn"):
        return None
    if not any(player["player_id"] == view.get("you") for player in view.get("players", [])):
        return None
    legal = view.get("legal_actions", [])
    for action_type in ("start_next_round", "roll_dice", "take_secret"):
        if action_type in legal:
            return {"type": action_type}
    if "cast_spell" not in legal:
        return {"type": "end_turn"} if "end_turn" in legal else None
    return _TurnPlanner(view, spell_counts).choose(view.get("allowed_spells", []), "end_turn" in legal)
