# Guandan AI Notes

## Current Bot Modes

Guandan currently supports three bot modes in Room config:

- `auto`
  Uses the existing search stack.
  Early and mid game mainly rely on heuristic + MCTS.
  Endgame can switch to minimax.

- `heuristic`
  Forces heuristic decision making only.
  This is useful for debugging and ablation.

- `nn`
  Uses the trained neural network checkpoint to score candidate actions.
  If the checkpoint cannot be loaded, it falls back to heuristic.

Room UI:

- In the Guandan room config card, choose `Bot Mode`.
- If `NN` is selected, choose a checkpoint from the `NN Checkpoint` dropdown.
- The dropdown is populated from `assets/guandan/checkpoints`.

Checkpoint API:

- Frontend fetches `/api/guandan/checkpoints`.
- Supported file suffixes are `.pt`, `.pth`, `.ckpt`, `.bin`.


## Current Checkpoint Location

Default checkpoint path:

```text
assets/guandan/checkpoints/guandan_nn.pt
```

Any checkpoint placed under:

```text
assets/guandan/checkpoints/
```

should appear in the Room dropdown after refresh.


## How To Train The First Model

Training entry:

```bash
python3 -m game.guandan_nn_train --help
```

Requirements:

- `torch` must be installed in the Python environment used for training.
- Example device values:
  - Apple Silicon: `--device mps`
  - NVIDIA CUDA: `--device cuda`
  - CPU fallback: `--device cpu`

### Smoke Test

Use this first to confirm training runs end to end:

```bash
python3 -m game.guandan_nn_train \
  --teacher heuristic \
  --bootstrap-episodes 8 \
  --epochs 1 \
  --save-checkpoint assets/guandan/checkpoints/guandan_nn_smoke.pt
```

### First Usable Model

Recommended starting command:

```bash
python3 -m game.guandan_nn_train \
  --teacher bot \
  --bootstrap-episodes 200 \
  --epochs 6 \
  --self-play-iterations 3 \
  --self-play-episodes 24 \
  --self-play-epochs 2 \
  --batch-size 64 \
  --save-checkpoint assets/guandan/checkpoints/guandan_nn_v1.pt \
  --device mps
```

Adjust `--device` based on machine.


## Current Training Script Behavior

Training script file:

```text
game/guandan_nn_train.py
```

Current pipeline:

1. Generate bootstrap examples from a teacher.
2. Re-score many training decisions with a lightweight search pass.
3. Train a policy-value network on those examples.
4. Run self-play data generation.
5. During self-play, the default mode is now `model_search`, not plain greedy NN moves.
6. Build policy targets directly from the search visit distribution.
7. Continue training on the expanded dataset.
8. Save a checkpoint.

Current reanalysis behavior:

- default `--policy-target-source search`
- if candidate count is small and the state looks like endgame, use minimax scores
- if candidate count is small and the state passes the normal MCTS gate, use low-budget MCTS scores
- otherwise fall back to heuristic scores

This means the policy target is no longer just “what the teacher picked”.
It is now usually a soft distribution built from search-improved candidate scores when search is cheap enough.

Self-play search behavior:

- bootstrap can still use `bot` / `heuristic` / `random`
- self-play now defaults to `--self-play-policy search`
- the current NN supplies priors and leaf values
- root search runs a lightweight PUCT-style bandit over legal actions
- rollout decisions are also chosen by the current NN
- training target is the normalized visit distribution from that search

Loss behavior:

- ordinary heuristic/bootstrap samples still use a mixed hard-target + soft-target loss
- search-reanalysis samples lean more toward the soft target
- `model_search` self-play samples now heavily weight the visit-distribution target instead of mainly imitating the single sampled move

This is still lighter than full AlphaZero, but it is an actual self-improving loop now:

- teacher only bootstraps the first model
- later policy targets can come from NN-guided search instead of teacher labels

Teacher options:

- `bot`
- `heuristic`
- `random`

Important flags:

- `--bootstrap-episodes`
- `--bootstrap-cache`
- `--epochs`
- `--self-play-iterations`
- `--self-play-episodes`
- `--self-play-epochs`
- `--self-play-cache-dir`
- `--batch-size`
- `--save-checkpoint`
- `--load-checkpoint`
- `--dataset-in`
- `--dataset-out`
- `--teacher-mix`
- `--temperature`
- `--policy-target-source`
- `--reanalysis-candidate-cap`
- `--reanalysis-mcts-sims`
- `--reanalysis-mcts-depth`
- `--reanalysis-mcts-tree-ply`
- `--reanalysis-mcts-reply-width`
- `--reanalysis-mcts-risk-lambda`
- `--reanalysis-minimax-depth`
- `--reanalysis-minimax-width`
- `--self-play-policy`
- `--model-search-sims`
- `--model-search-depth`
- `--model-search-c-puct`
- `--model-search-dirichlet-alpha`
- `--model-search-dirichlet-epsilon`
- `--model-search-rollout-temperature`
- `--quiet`

Cache behavior:

- `--bootstrap-cache path.jsonl`
  If the file exists, bootstrap examples are loaded and bootstrap generation is skipped.
  If the file does not exist, bootstrap examples are generated once and then saved there.

- `--self-play-cache-dir some_dir`
  Each self-play iteration is cached separately as:
  `self_play_iter_001.jsonl`, `self_play_iter_002.jsonl`, ...
  If an iteration cache already exists, collection for that iteration is skipped and the cached examples are reused.

This is useful when:

- bootstrap generation is expensive and you want to reuse it across many training runs
- a long self-play training job is interrupted
- you want to rerun only the optimization/training part without regenerating the same data


## Current Progress Output

The training script now prints progress by default.

It reports:

- bootstrap progress by episode
- current example count
- elapsed time
- ETA
- per-epoch train loss / policy loss / value loss / accuracy
- self-play collection progress
- checkpoint save path

To disable progress logs:

```bash
python3 -m game.guandan_nn_train ... --quiet
```


## Current NN Design

Current inference/training code is still relatively simple.

### Input Style

The model uses hand-engineered features:

- `state_features`
- `action_features`

It does not yet encode raw cards as token sequences with a dedicated card encoder.

### Network Shape

The network is a small policy-value MLP:

- state encoder
- action encoder
- joint interaction block
- policy head
- value head

This is lightweight and easy to train, but it is still much closer to a structured tabular model than to a modern card-game neural policy.

### Training Targets

Current training is now based on:

- teacher-generated trajectories
- search-improved soft targets over candidate actions
- round outcome style value targets

This still inherits some teacher bias in the bootstrap stage, but once self-play starts, the label source can shift toward the NN-guided search policy rather than teacher choices.

Search target source selection:

- `heuristic`
  Always build policy targets from heuristic candidate scores.

- `search`
  Prefer search-based candidate scores when the branch factor is small enough.
  Endgame uses minimax more often.
  Midgame uses a small MCTS pass when the normal MCTS gate says the state is worth searching.

### Inference Usage

Current `nn` mode scores candidate actions and picks the top result.

It does not yet serve as a full AlphaZero-style search prior/value model inside MCTS.


## Current Limitations

The current NN is useful as an experimental path, but it has several clear limits:

- It learns mostly from teacher behavior, so it can inherit teacher mistakes.
- `Pass` and low-information actions may be overrepresented in training data.
- The value target is still coarse.
- The model input is not yet rich enough to represent card structure naturally.
- The NN is not yet deeply integrated with MCTS.
- There is not yet a stable benchmark suite for comparing versions.


## Recommended Next Steps

These are ordered by expected engineering value, not by novelty.

### Priority 1: Build A Stable Benchmark Set

Before making the network more complex, build a benchmark of bad cases.

Suggested categories:

- too eager to `Pass`
- over-bombing
- breaking strong structure
- suppressing partner incorrectly
- bad opening leads
- wasting control cards

Reason:

- Without a stable benchmark, it is hard to tell whether a new model is actually stronger or just different.


### Priority 2: Improve Training Targets

Current target quality is still the main bottleneck.

Recommended improvements:

- train on top-k search preferences instead of only the single chosen action
- store a soft target distribution over candidate actions
- keep richer search scores, not only the winner
- refine value targets beyond a single coarse outcome

Better value targets can include:

- team finish quality
- estimated turns to go out
- initiative/control retention
- preservation of key control cards

Reason:

- This usually improves strength more than simply increasing hidden size.


### Priority 3: Rebalance The Dataset

The dataset should not be dominated by easy or low-signal decisions.

Suggested reweighting:

- upweight cases where `Pass` is wrong
- upweight anti-bomb discipline cases
- upweight anti-fragmentation cases
- upweight partner-coordination cases
- downweight trivial forced actions

Reason:

- Many current AI problems are really data distribution problems.


### Priority 4: Upgrade The Input Representation

Move from flat handcrafted vectors toward card-aware encoders.

Possible upgrades:

- encode hand cards as card tokens
- encode current trick cards as tokens
- encode seen cards / memory cards as tokens
- encode candidate action cards as tokens
- use a small DeepSets or lightweight Transformer style architecture

Also explicitly encode structural membership:

- whether a card belongs to a pair
- whether it belongs to a triple
- whether it participates in a straight
- whether it participates in a bomb
- whether playing it breaks the best decomposition

Reason:

- Guandan is highly structure-sensitive.
- Flat aggregate features are often not expressive enough.


### Priority 5: Move Toward Real NN + Search Integration

Longer term, the better route is:

- use policy head as MCTS prior
- use value head for leaf evaluation
- train on search-improved policy targets

That is much closer to AlphaZero style training than the current setup.

Current state is better described as:

- teacher/self-play data collection
- plus search-improved policy targets
- plus NN-guided self-play search

not yet true AlphaZero-style training.


### Priority 6: Build League Evaluation

Evaluate every new checkpoint against:

- previous NN checkpoints
- heuristic bot
- auto bot
- selected fixed benchmark states

Track:

- win rate
- team finish quality
- benchmark pass rate
- benchmark mistake categories

Reason:

- Self-play alone can drift.
- A league prevents silent regressions.


## What Not To Do First

These are probably not the highest-value first moves:

- blindly making the network much bigger
- adding many more layers first
- adding complicated RL losses before fixing targets
- chasing a larger model before building benchmark coverage

Reason:

- The current bottleneck is more in data quality, targets, and evaluation than in raw parameter count.


## Suggested Roadmap

### v2

- benchmark suite
- top-k soft targets
- dataset reweighting

### v3

- richer value heads
- stronger structural features
- better checkpoint-vs-checkpoint evaluation

### v4

- card-token encoder
- NN-guided MCTS
- search-improved training targets


## Short Summary

If only one next step should be chosen, the best order is:

1. build benchmark cases
2. improve labels and value targets
3. rebalance the dataset
4. then upgrade the model architecture

That is likely to improve actual playing strength more than simply scaling the current network.
