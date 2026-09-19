# 掼蛋策略 benchmark

入口：`python3 scripts/benchmark_guandan.py`，只用 Python 标准库。改进分析见 [guandan_ai_review.md](guandan_ai_review.md)。

## 评测什么

两名 candidate 组成一队，对战两名 baseline。同一副牌打两次：candidate 分别坐 A 队（0、2）和 B 队（1、3），牌、级牌、先手保持一致。每对牌局是一个统计样本。每对还交替实际运行 A/B 的顺序。

- 主指标：每盘净升级收益。头游队的队友是二、三、四游，分别记 `+3/+2/+1`；输家记相反数。它与当前规则的升级方向一致，不使用 AI 自己的启发式估值。A级也记录未截断的名次收益。
- 辅助指标：团队头游胜率、相对 50% 的优势（百分点）、六种名次组合计数，以及按级牌分组的结果。
- 性能指标：决策实际耗时 mean/p95/max、最终方法、MCTS 尝试次数、预算耗尽次数、最终动作评分项出现次数。`chosen_component_firings` 仅覆盖最终动作解释，不能代表所有候选的规则覆盖率。
- 任何异常、非法动作、worker 超时、步数上限、半对牌局，整次报告标成 `failed`，不生成强度结论。不会把失败补成输局或丢弃后算胜率。

这是独立单局的团队强度评测，不覆盖连续升级、下一局进贡还贡、混合人类搭档或跨对手池泛化。击败某个 baseline 只说明对该对手的优势。

## 先冻结基线

```bash
python3 scripts/benchmark_guandan.py snapshot \
  --output .data/guandan_benchmark/baseline_v1
```

快照复制 `game/guandan.py`、`game/guandan_ai.py`、`game/memories.py` 并记录文件 SHA-256、git revision、这些文件是否有未提交改动。它冻结工作区的实际源码，包含未提交修改。输出目录必须不存在；快照被修改后校验会失败。

基线和候选分别在独立 Python 进程加载自己的模块，每盘重启，避免模块引用、全局缓存和随机数串线。裁判始终使用当前仓库规则。快照适用于兼容的状态/动作协议；规则协议发生变化时应新建评测版本，而不是把非法动作当成策略退步。

`auto` 对当前 `heuristic` 是搜索消融；`auto` 对**冻结版本的** `auto` 才是版本进步对比。`greedy` 和 `random` 是诊断对手：使用提示候选，不使用复杂动作评分；候选生成仍属于对应版本的源码，不是穷尽全部合法组合。两个诊断策略均优先一手出完。它们不是唯一验收标准。

## 运行

先检查交换队伍是否抵消牌运：

```bash
python3 scripts/benchmark_guandan.py run \
  --candidate greedy --baseline greedy --clock fixed \
  --pairs 3 --output .data/guandan_benchmark/selfcheck.json
```

相同策略、同一配置、`fixed` 时，每对的轨迹 hash 应相同，总胜率应为 50%，净收益为 0。还应使用冻结快照重复这个自检。

快速检查真实 AI 的完整运行链路（低预算，只作 smoke test）：

```bash
python3 scripts/benchmark_guandan.py run \
  --candidate auto --baseline heuristic \
  --baseline-root .data/guandan_benchmark/baseline_v1 \
  --pairs 3 --clock wall --think-ms 100 --trace \
  --output .data/guandan_benchmark/smoke.json
```

修改策略后，在实际产品预算下对冻结版本评测：

```bash
python3 scripts/benchmark_guandan.py run \
  --candidate auto --baseline auto \
  --baseline-root .data/guandan_benchmark/baseline_v1 \
  --pairs 100 --seed 20260919 --levels 2,7,14 \
  --clock wall --think-ms 2000 \
  --output .data/guandan_benchmark/candidate_vs_v1.json
```

正式验收可用 `--levels 2,3,4,5,6,7,8,9,10,11,12,13,14`，让牌局对数为级牌数量的倍数。100 对不是显著性的保证；所需样本取决于实际差距。当前 AI 每步可能消耗秒级时间，应先估算 smoke 的运行成本。

支持 `--candidate-root` 指定另一个源码目录/快照。参数消融使用 `--candidate-config path.json` / `--baseline-config path.json`，内容是已有 `bot_*` 配置项；未知项报错。模式和共享时间预算由命令行指定，不允许在配置文件里悄悄改成不等预算。默认 `wall` + 2000ms，与当前默认思考预算一致；`bot_think_overrun_ratio` 等额外预算设置也会完整写入报告，改变时需作为实验变量说明。

## 信息与复现边界

默认 `--information public`。裁判掌握完整状态，策略只收到：

1. 自己的真手牌、所有人的剩余张数/完成名次。
2. 已出牌、pass 历史、当前牌墩、公开已知归属。
3. 去掉开局/结束手牌及解释缓存后的公开历史。

现有 AI 接口要求其他玩家的 `hand` 仍然是牌对象列表，因此 adapter 根据未知牌池和公开已知归属，**每次决策独立生成一份虚拟分牌**。其他人的真实牌值不进入 adapter 的采样条件；置换隐藏手牌不会改变策略输入。双方使用同一适配方式。这是兼容旧接口的评测条件，不是已实现完善的 belief 模型，也不代表线上入口已经修好了信息泄漏。

`--information full` 保留原始全知状态，用于诊断现有服务端入口的表现。它必须单独解读，不能当作正常暗牌强度。

发牌、虚拟分牌、策略搜索使用分离的确定性随机流。worker 同时接管 AI 模块内无参数的 `random.Random()`，并固定 `PYTHONHASHSEED`，而不污染裁判随机数。同一局面、同一轮次、同一座位的随机流不随 candidate/baseline 身份变化。

- `--clock fixed`：将 AI 模块的计时器冻结，保留配置中的有限候选数、粒子数、深度与模拟次数限制。相同 Python/源码/配置/seed 的动作轨迹可复现；真实执行时延仍由 worker 外层计时。`--think-ms` 仍影响预算档位和快速路径，但不是实际限时。固定模式可能很慢，`--worker-timeout` 是防卡死保护，触发就使实验失败。
- `--clock wall`：走实际计时与截止机制。在相同时间预算比较线上表现，但固定种子不能消除 CPU 负载、缓存耗时和截止位置的差异。应独占机器负载，并重复预先指定的 seed 批次。

切勿把不同信息模式、时间模式、预算的结果合并。固定计算量与固定时间回答的是不同的问题。

## 报告与判断标准

`--output result.json` 会产生：

- `result.json`：版本/配置/环境、逐盘结果、总统计、按级牌分组和性能诊断。
- `result.games.jsonl`：每盘完成后立即写入的结果，含发牌和动作轨迹 hash。
- `result.trace.jsonl`：使用 `--trace` 时写每步动作、观察 hash、耗时及原有 `bot_explain`。可沿候选评分找退步局面；该文件可能较大。

输出不会覆盖已有文件。失败退出码为 1，正常完成为 0；`inconclusive` 是完成了实验但证据不足，不能当作“通过强度验收”。文件中的源码 hash 才是实际版本身份，git SHA 不足以标识未提交修改。运行中策略源码变化也会使报告失败。

置信区间以**一对交换对局**为重采样单位，满 30 对且有样本方差时使用 5,000 次 paired percentile bootstrap 的近似 95% 区间。统计采样也固定独立种子，不影响牌局随机流；保留同一对里的相关性，并利用实际方差衡量小幅改进。

少于 30 对或样本全部相同时退回双侧 95% Hoeffding 界，防止几个全胜或完全一致的样本得到虚假的零宽区间。无论哪种情况，都会额外输出保守的 `conservative_ci95`：

```text
pair_win   = (win_A + win_B) / 2              # [0, 1]
pair_score = (signed_points_A + signed_points_B) / 2  # [-3, 3]
radius     = (upper - lower) * sqrt(log(40) / (2 * number_of_pairs))
```

Hoeffding 界较保守，但不依赖分布近似。例如，保守胜率区间半宽要低于 5 个百分点，需要约 738 对牌。bootstrap 通常能利用较低的配对方差得到更有用的区间，但有限样本覆盖率只是近似，30 对是工具的最低启用门槛，不是统计充分性的证明。另有 pair-level 标准误供诊断，单对时为 null；每项指标记录实际使用的 `ci_method`。

`verdict` 以主指标净收益的区间为准：下界 > 0 为 `improved`，上界 < 0 为 `regressed`，否则 `inconclusive`。胜率 delta 是相对 50% 的直接对战优势，不是相对于共同对手的胜率差；1/2 与 1/4 都算赢，所以胜率与净收益应一起阅读。

这些区间针对预先定好的单次比较，不提供“不断看结果、一显著就停”或多轮调参的整体 95% 保证。使用开发 seed 调参、另一批固定且未参与调参的 seed 验收；多配置探索后，再用保留集确认。重要发布同时检查 `conservative_ci95` 或另作预注册验证。初次接入只验证机制，不宣称已经提升。

## 验证

```bash
python3 -m unittest tests.test_guandan_benchmark
```

测试覆盖所有 24 种名次排列的零和计分、成对统计、异常不计分、随机流隔离、源快照独立加载/篡改检测、公开信息不随真实暗牌置换改变、已知牌归属，以及相同策略交换队伍时的轨迹对称性。原有 `test_guandan_bot` / `test_guandan_reviewed_round` 等作为战术回归集继续保留，不能代替对战 benchmark。
