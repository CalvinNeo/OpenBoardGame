# 掼蛋策略 benchmark

入口：`python3 scripts/benchmark_guandan.py`，只用 Python 标准库。历次改进、关键复盘与评测结果统一见 [guandan_ai_review.md](guandan_ai_review.md)。

## 评测什么

两名 candidate 组成一队，对战两名 baseline。同一副牌打两次：candidate 分别坐 A 队（0、2）和 B 队（1、3），牌、级牌、先手保持一致。每对牌局是一个统计样本。每对还交替实际运行 A/B 的顺序。

- 主指标：每盘净升级收益。头游队的队友是二、三、四游，分别记 `+3/+2/+1`；输家记相反数。它与当前规则的升级方向一致，不使用 AI 自己的启发式估值。A级也记录未截断的名次收益。
- 辅助指标：团队头游胜率、相对 50% 的优势（百分点）、六种名次组合计数，以及按级牌分组的结果。
- 性能指标：决策实际耗时 mean/p95/max、最终方法、MCTS 尝试次数、预算耗尽次数、最终动作评分项出现次数。`chosen_component_firings` 仅覆盖最终动作解释，不能代表所有候选的规则覆盖率。
- 任何异常、非法动作、worker 超时、步数上限、半对牌局，整次报告标成 `failed`，不生成强度结论。不会把失败补成输局或丢弃后算胜率。

这是独立单局的团队强度评测，不覆盖连续升级、下一局进贡还贡、混合人类搭档或跨对手池泛化。击败某个 baseline 只说明对该对手的优势。

## 用 Git commit 固定基线

下方历史命令示例基线为 `68e62abe6b9213ea69d85df044c86732edffd5ad`；2026-10-19 各批固定对手是 `d6d39f243d23f5e2a0da09722bfd6d6a9ccef1ff`，完整结果见主报告。使用 `--baseline-ref` 指定 commit、tag 或分支；启动时将其解析成完整 commit ID，后续只读取这个不可变 ID，即使分支移动也不会切换版本。

实现使用只读 `git cat-file blob COMMIT:path`，把 `game/guandan.py`、`game/guandan_ai.py`、`game/memories.py`，以及该版本存在的 `game/guandan_trick.py`／`game/guandan_endgame.py` 的字节直接加载到独立进程内存。**不 checkout、不建 worktree、不复制历史源码文件**。报告记录请求的 ref、实际 commit ID 和全部源码 SHA-256；`snapshot` 复制命令已移除。

候选默认读取当前工作区（包括未提交修改）；`--candidate-ref` 可对称指定历史版本。因此，同一个仓库即可运行“工作区改进 vs 某 commit”或“commit vs commit”。基线和候选分别在独立 Python 进程加载自己的模块，每盘重启；模块只允许使用已捕获的 `game.*` 依赖，缺失依赖直接报错，不会回退到工作区或 `.pyc`。worker 启动时返回实际加载字节的 hash，与报告版本核对。

裁判使用 runner 启动时捕获的规则源码；从冻结候选目录启动时，裁判也是该冻结版本，不能理解为持续读取变化中的工作区。此机制适用于兼容的状态/动作协议；规则协议发生变化时应新建评测版本，而不是把非法动作当成策略退步。

`auto` 对当前 `heuristic` 是搜索消融；`auto` 对**冻结版本的** `auto` 才是版本进步对比。`greedy` 和 `random` 是诊断对手：使用提示候选，不使用复杂动作评分；候选生成仍属于对应版本的源码，不是穷尽全部合法组合。两个诊断策略均优先一手出完。它们不是唯一验收标准。

## 运行

先检查交换队伍是否抵消牌运：

```bash
python3 scripts/benchmark_guandan.py run \
  --candidate greedy --baseline greedy --clock fixed \
  --pairs 3 --output .data/guandan_benchmark/selfcheck.json
```

相同策略、同一配置、`fixed` 时，每对的轨迹 hash 应相同，总胜率应为 50%，净收益为 0。这是对称性自检，不是强度提升证据。可同时给两侧指定相同的 commit，验证 Git 加载路径。

快速检查真实 AI 的完整运行链路（低预算，只作 smoke test）：

```bash
python3 scripts/benchmark_guandan.py run \
  --candidate auto --baseline heuristic \
  --baseline-ref 68e62abe6b9213ea69d85df044c86732edffd5ad \
  --pairs 3 --clock wall --think-ms 100 --trace \
  --output .data/guandan_benchmark/smoke.json
```

修改策略后，对固定 commit 评测：

```bash
python3 scripts/benchmark_guandan.py run \
  --candidate auto --baseline auto \
  --baseline-ref 68e62abe6b9213ea69d85df044c86732edffd5ad \
  --pairs 100 --seed 20260919 --levels 2,7,14 \
  --clock wall --think-ms 2000 \
  --output .data/guandan_benchmark/candidate_vs_v1.json
```

正式验收可用 `--levels 2,3,4,5,6,7,8,9,10,11,12,13,14`，让牌局对数为级牌数量的倍数。100 对不是显著性的保证；所需样本取决于实际差距。当前 AI 每步可能消耗秒级时间，应先估算 smoke 的运行成本。

`--candidate-root` / `--baseline-root` 可指定另一个仓库，默认均为当前仓库；ref 相对于对应仓库解析。不传 ref 则使用对应工作区。

`--pair-start N` 可从全局第 N 对开始（0 起算）。它保留原索引对应的 seed、级牌和 A/B 运行顺序，例如 `--pair-start 28 --pairs 2` 对应完整 30 对任务的最后两对。分段报告不会自动合并：合并前必须核对两侧实际源码 hash、规则、配置、信息/时间模式和不重不漏的牌局索引；不能用重新抽牌替换失败牌局。

参数消融使用 `--candidate-config path.json` / `--baseline-config path.json`，内容是已有 `bot_*` 配置项；未知项报错。模式和共享时间预算由命令行指定，不允许在配置文件里悄悄改成不等预算。CLI 默认 `wall` + 2000ms，线上默认思考目标为 6000ms；正式对照应显式传入 `--think-ms 6000`。`bot_think_overrun_ratio` 等额外预算设置也会完整写入报告，改变时需作为实验变量说明。需要可复现的固定计算量时使用 `--clock fixed`，并将相同的有限搜索预算配置同时传给两侧。例如：

```bash
python3 scripts/benchmark_guandan.py run \
  --candidate auto --baseline auto \
  --baseline-ref 68e62abe6b9213ea69d85df044c86732edffd5ad \
  --candidate-config designs/guandan_benchmark_fixed_budget.json \
  --baseline-config designs/guandan_benchmark_fixed_budget.json \
  --pairs 100 --seed 20260919 --levels 2,7,14 \
  --clock fixed --think-ms 2000 \
  --output .data/guandan_benchmark/fixed_candidate_vs_baseline.json
```

MCTS 有 deadline 且 `bot_search_use_remaining_budget=true` 时，原有效模拟次数是目标层访问预算，另加 `目标深度 × 固定面板世界数 × 初始根候选数` 次中间层访问；无 deadline 或关闭该选项时保留旧总次数上限。`--clock fixed` 仍提供 deadline，故也采用这个有限扩展；同一 `bot_mcts_sims` 数字跨版本不保证相同计算量。

这里的 [固定预算示例](guandan_benchmark_fixed_budget.json) 是有限宽度/深度的开发配置，不修改游戏默认参数；冻结时钟后真实单步耗时可能明显超过 `think-ms`。先用 1 对估算成本，再决定完整评测的计算量。

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

输出不会覆盖已有文件。失败退出码为 1，正常完成为 0；`inconclusive` 是完成了实验但证据不足，不能当作“通过强度验收”。文件中的源码 hash 才是实际版本身份，git SHA 不足以标识未提交修改。运行中工作区策略或裁判源码变化会使报告失败；Git 基线不受未提交修改或分支移动影响。

工作区源码字节未变、只新增 commit 导致 HEAD 改变时不应失败；工作区握手以来源类型和文件 hash 为准。使用 Git commit 模式时仍额外核对不可变 commit ID。

### 性能与整墩诊断

`diagnostics.candidate`／`diagnostics.baseline` 保留旧字段，并增加以下诊断（schema 2 的兼容性扩展）：

- `latency_ms`：worker 外层实测决策耗时，含 mean、p50、p95、p99、max；分位数用 nearest-rank。
- `budgeted_decisions`／`over_budget`／`over_budget_rate`：仅以解释中有 `timing.budget_ms` 的决策为分母，比较实测耗时与该目标预算。它不等于 `hard_deadline_reached`；允许 overrun 的配置也可能超过目标预算。旧解释缺少预算时不虚构分母，无样本为 null。
- `trick_boundary.statuses`／`reasons`：完整、不完整、关闭等面板状态，以及 deadline 等未完成原因。`attempted` 只计 complete 和 incomplete，`completion_rate` 为 complete / attempted；它不是所有领牌或所有决策的覆盖率，没有尝试时为 null。
- `trick_boundary.latency_ms`：报告了耗时的面板的 mean／p50／p95／p99／max，包括未完成面板。面板上限和整次决策预算不同；步骤间截止检查不是单个 Python 调用的强制抢占。
- `proposed_changes`：完整面板的新首选不同于旧参考动作的次数，shadow 也计入。`applied`：完整面板采用新评分的次数，可能仍选原动作。`actual_changes`：已采用新评分且最终动作不同于旧参考动作的次数；比较忽略同一组实体牌 ID 的顺序。不完整面板永不计作采用或改选。

这些计数帮助定位“没有时间完成”“完成但无分歧”“提出分歧但未采用”，不等同于策略收益。`--clock fixed` 会冻结内部时钟，因此面板耗时、完成率和截止标记不能作为真实预算验收；worker 外层耗时虽真实，也只能说明固定计算量成本。预算验收须单独用 `--clock wall`、一致预算和不受并行测试干扰的运行。

`comparison=independent_confirmation_v1` 的面板在初筛提出可信改选后，还会在同一总预算内另取独立世界复核。逐步 trace 的 `trick_boundary.verification` 区分 `not_needed`、`complete`、`incomplete`；完整时包含 `passed`、复核的成对差值和两个动作的记录。`requested_worlds` 是初选样本数，复核自身另记 `requested_worlds`，不能把两阶段总轨迹数误写为原来的 4×4。顶层 `status=complete` 包括“复核完成但未通过”，而复核超时使整面板 incomplete、不得采用部分结果。顶层候选值／排名保留初选尺度，不混入复核分数，也不在复核样本中重新选优；这仍不是校准后的统计显著性声明。

### 运行中用户调整样本量

2026-10-15 v3 验收原计划 120 对／240 局，用户在完成 138 局时明确要求仅 180 局。监督进程在第 90 对完整结束后中断原 runner，保留原始中断报告；新报告 `tmp/guandan-strength-iteration-20261014/search-evidence-full-90.json` 只含完整索引 0–89，并重放核验全部动作、结算、初始牌与轨迹哈希，重算保留局的全部诊断。`sample_amendment` 明确记录原样本量、用户要求、原报告指纹与中断原因。不可把此改动写成开跑前固定 90 对，也不可把任意失败／残缺报告改成成功。该次 180 局净收益 −0.0111/局、配对区间跨零、符号翻转 p=0.89246，未推广。

### 强度统计

2026-10-15 的实验性 `game/guandan_endgame.py` 也纳入可选运行时快照、源码指纹和固定时钟；冻结旧 commit 不存在此文件时不会从工作区补入。当前 `bot_exact_endgame_enabled=true`、`bot_exact_endgame_public_only=true`；默认关闭的是独立的整墩替换实验。最新未定归属全手出完采样候选未启用。启用时逐步解释的 `method_details.exact_endgame` 记录初选／独立确认、完成世界、节点与中断原因，`method=exact_endgame` 才表示最终采用。汇总的 `diagnostics.<side>.exact_endgame` 单独记录状态、原因、complete / (complete + incomplete)、采用与实际改牌次数、采样数、重复世界复用次数、节点和面板延迟。完成但保留原动作计入采用，不计入改牌；超范围／确定最高团队收益的跳过不进入完成率分母。中断世界已经访问的节点计入计算量，未完成收益不进入候选排名。初选和确认仍独立抽样，抽中相同实体分配时仅复用确定性的求解值，不删除样本或伪造额外样本。

它不是 `trick_boundary` 面板，不能用后者的完成率代替精确搜索完成率。默认关闭高耗的正式续打 shadow 只减少无效计算，不等于棋力提升。正在运行的隔离旧快照不含新增诊断时，应从完整 trace 汇总，不能把缺字段当作零次调用。

`bot_exact_endgame_public_only=true` 将实验接管限制在公开归属已确定的局面：自己的牌、公开已出牌和已知归属足以唯一确定剩余分配，且完整实体分区校验通过。此时只求解一个确定世界，`scope=public_determined_endgame`、`solver=exact_public_v1`，解释采用 `proven_terminal`。`reason=publicly_proven_change` 表示相对参考动作严格提高最坏情况团队终局值，`publicly_optimal_reference` 表示参考已经最优；平手保留参考。`verification` 为 `not_needed/public_hands_determined`，不是省略随机样本的独立确认。归属不确定直接 `skipped/unresolved_hidden_ownership`，仍走当前 auto；不能把服务端可见的暗牌当作公开确定。

单个确定残局的最优值并不能证明完整对战平均更强：对手可能不按最坏情况应对，证明分支也可能很少出现。公开证明 v2、后续 v5 及最新候选各批结果统一见 [主报告](guandan_ai_review.md)；不能把历史“默认关闭”描述套到当前已启用的公开残局流程。

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

本轮另用 `tmp/guandan-strength-iteration-20261014/paired_sign_flip.py REPORT` 计算双侧精确配对符号翻转检验：以每对两局净分之和为单位，在对内策略标签可交换的零假设下计算绝对总差值至少等于观测值的概率。脚本要求预定批次完整、每对同一初始牌局且包含 A／B 两个席位；通过整数分布动态规划避免指数枚举。它是配对均值和 bootstrap 区间的补充，不把几次全正的局部改选当作总体显著，也不修复反复调参／多轮验收产生的选择偏差。

## 验证

```bash
python3 -m unittest tests.test_guandan_benchmark tests.test_guandan_benchmark_diagnostics
```

测试覆盖所有 24 种名次排列的零和计分、成对统计、异常不计分、随机流隔离、Git blob 独立加载/分支移动/禁止混入工作区依赖/源码变化检测、公开信息不随真实暗牌置换改变、已知牌归属，以及相同策略交换队伍时的轨迹对称性。Git 测试使用极小的合成仓库，不复制真实基线源码。原有 `test_guandan_bot` / `test_guandan_reviewed_round` 等作为战术回归集继续保留，不能代替对战 benchmark。

诊断专项另覆盖空样本／旧解释兼容、p50／p95／p99、实测超预算，以及 shadow 建议、完整采用和实际改选的分离计数。
