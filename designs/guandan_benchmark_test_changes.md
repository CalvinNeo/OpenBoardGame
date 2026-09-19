# Guandan benchmark 测试变更说明

本文核对基线 commit `68e62abe6b9213ea69d85df044c86732edffd5ad` 到当前工作区的 `tests/test_guandan_benchmark.py` 完整差异，只说明 benchmark 测试；其他 AI 战术测试的改动不在本文范围内。

原文件有 13 个测试。本次 **12 个旧测试完全保留，删除 1 个依赖源码复制快照的旧测试，新增 5 个 Git 加载测试，合计 17 个**。没有重命名旧测试，没有删除或放宽任何旧计分、统计、隐藏信息隔离、动作合法性、可复现性测试的断言。

变更原因来自用户的明确约束：比较当前版本与指定 commit 时，不切换当前仓库、不复制基线掼蛋源码。旧测试调用 `snapshot_policy()` 复制真实源码，其测试对象和操作方式均属于本次移除的快照工作流，需要改成 Git blob 直接加载的验证。这不是根据 AI 对战输赢调整测试预期。

## 唯一删除的旧测试

`GuandanBenchmarkTests.test_frozen_worker_is_independent_of_live_policy_and_checks_hashes` **已删除，未改名**。它由下面五个具名测试共同替代，不是一对一改名。

旧测试先复制真实仓库的三份运行源码到临时目录，再给复制的 `guandan.py` 追加一个总是 `pass` 的 `bot_move`。原有保障与替代关系如下：

| 旧测试的操作与断言 | 原本保证什么 | 为何改变 | 新的对应保障 |
| --- | --- | --- | --- |
| `snapshot_policy(REPO_ROOT, root)` | 能把当前实际源码冻结成独立文件快照 | 用户明确不希望复制基线源码；生产入口也已移除 `snapshot` 命令 | 合成 Git 仓库提交极小的假模块，worker 从指定 commit 的 blob 直接加载；真实基线不被复制 |
| 修改快照后，`source_identity(root)` 报 `checksum` 错误 | manifest 中登记的 hash 与磁盘快照不一致时拒绝使用 | Git 版本不再以可编辑的快照目录或 manifest 为身份；继续保留该断言会要求已移除的接口 | `test_worker_rejects_source_change_before_game` 验证“记录身份后、加载前”工作区源码改变必失败；Git 版本则固定 commit，分支移动仍保持原身份 |
| 删除旧 manifest、重建身份，再运行 frozen worker，动作恰好是 `pass` | worker 加载独立版本，不是偷偷使用当前 live 策略 | 不再复制或修改真实策略；固定 `pass` 本身也不能区分真实 AI 是否恰好选择 pass | `test_git_blob_workers_ignore_worktree_edits_without_checkout_or_copies` 同时运行 Git 与工作区 worker，分别精确断言依赖模块返回 `old-ai/old-memory` 和 `new-ai/new-memory` |
| 快照与当前源码的 `source_sha256` 不相等 | 改过的版本具有不同源码身份 | 新 fixture 直接检查 frozen worker 返回的完整身份与预先记录值相等，而非只检查两个摘要不同 | 新测试验证身份一致、来源类型正确、依赖行为不同；另有加载前修改检测、分支移动不改变固定版本的检查 |

**有意取消的旧契约**是“编辑复制快照并使用 manifest 重新封存”。新工具不再提供该功能，因此没有保留 manifest 篡改报错的具体接口和错误文本。保留的是实验更需要的保障：实际执行源码必须对应登记版本，工作区改变不能污染固定的 Git 基线。Git 对象不变性由 Git 的内容寻址机制提供；测试没有尝试手工破坏 `.git/objects`。

## 新增测试与具体断言

新增类为 `GitPolicySourceTests`。fixture 中的三份文件只是十余行假策略和两个字符串常量，不含从真实 Guandan 文件复制的内容。`subprocess` 新导入仅用于这个临时仓库的 Git 操作。提交的测试用户名和邮箱通过单次命令的 `-c` 参数传入，不改用户 Git 配置。

| 新测试 | 具体断言 | 相比旧测试新增或保留的保障 |
| --- | --- | --- |
| `test_git_blob_workers_ignore_worktree_edits_without_checkout_or_copies` | Git worker 返回 `old-ai/old-memory`，工作区 worker 返回 `new-ai/new-memory`；Git worker 完整身份等于预期，live 身份为 `worktree`；运行前后 HEAD、Git status、三份工作区文件字节均相同；临时仓库没有 `__pycache__` | 保留独立版本执行与源码身份检查；新增依赖模块一起隔离、当前 checkout/文件不受影响、没有落地字节码的验证 |
| `test_resolved_commit_stays_pinned_after_branch_moves` | 在临时仓库新增提交使 HEAD 改变；先前完整 commit ID 的身份仍相同，worker 仍返回旧依赖版本 | 不仅处理未提交修改，也防止把可移动分支名作为后续 worker 的版本来源 |
| `test_uncaptured_imports_never_fall_back_to_worktree` | 临时仓库确有 `game/worktree_only.py`，但 Git 与工作区模式尝试导入它都报 `policy dependency not captured: game.worktree_only` | 明确验证缺失于捕获集合的 `game.*` 模块不会悄悄从工作区补入 |
| `test_worker_rejects_source_change_before_game` | 先读取工作区身份，再修改依赖模块；创建带预期身份的 worker 时必须报 `source changed before loading` | 保留旧 hash 一致性检查的意图，并覆盖真正可能造成一份报告混入两个版本的启动前时间窗口 |
| `test_unresolved_or_invalid_refs_fail_explicitly` | 直接把未解析的 `HEAD` 交给底层源码加载接口时报“必须是完整 commit ID”；不存在的 ref 无法解析 | 防止底层加载路径接受会移动的 ref 或静默退回当前版本 |

边界：第一个测试通过运行前后状态检查验证没有遗留的 checkout/文件修改，也通过读源码审计确认加载实现只读 `git cat-file`、在内存编译。它没有安装文件系统审计器来证明运行期间绝无任何临时系统调用。对“三个已登记模块以外的资产、模型文件”也没有作额外覆盖；这些不在当前 `auto/heuristic/greedy/random` 运行契约内。

## 逐项保留的旧测试

以下 12 个旧测试的函数名、输入构造和所有断言均未更改，无需替代断言。

| 旧测试 | 原保障及当前保留内容 | 本次状态 |
| --- | --- | --- |
| `test_deal_seed_does_not_change_global_randomness` | 相同 seed 得相同牌局，不同 seed 得不同牌局；不污染全局 RNG；级牌与初始记忆一致 | 原样保留 |
| `test_public_observation_is_invariant_to_hidden_hand_permutation` | 置换其他人的真实暗牌不改变观察；初始/最终手牌、解释缓存及新增私有字段中的秘密不泄漏；自己手牌保留，108 张牌不重不漏 | 原样保留 |
| `test_public_cards_and_known_owners_survive_masking` | 已出牌不会重新落入手牌；公开亮牌归属和出牌历史保留 | 原样保留 |
| `test_outcomes_match_all_finish_orders_and_are_zero_sum` | 穷举 24 种结束顺序，升级分值匹配队友名次；两队净分相反且胜负互补 | 原样保留 |
| `test_pair_statistics_do_not_treat_mirrored_games_as_independent` | 样本数按对计；对称结果为 50%/0 并保持不确定区间；半对牌局或一对内发牌 hash 不同必须报错 | 原样保留 |
| `test_small_sample_all_wins_is_not_evidence_of_improvement` | 单个全胜样本不能得到显著提升，标准误为 null；大量正收益样本能够缩窄保守区间 | 原样保留 |
| `test_internal_random_instances_are_seeded` | AI 内部无参 `Random()` 也可复现；显式指定 seed 的语义保持不变 | 原样保留 |
| `test_bootstrap_is_repeatable_and_preserves_conservative_interval` | bootstrap 可重复且不污染全局 RNG；输出实际方法、近似区间和保守区间；恒定样本回退保守界 | 原样保留 |
| `test_search_policy_replays_with_fixed_clock_in_isolated_workers` | 真实 AI 在独立 worker 中执行 minimax，动作合法，同 seed/固定时钟得到相同动作 | 原样保留 |
| `test_identical_seeded_policies_have_identical_mirrored_trajectories` | 相同策略随机动作一致；同牌换队后的动作轨迹相同，净分相反，胜负互补 | 原样保留 |
| `test_invalid_actions_and_truncation_fail_instead_of_becoming_losses` | 非法动作和超过步数上限直接失败，不补记为输局 | 原样保留 |
| `test_failed_run_writes_failure_report_without_a_summary` | 失败运行仍保存失败报告及原因，且不给出强度统计结论 | 原样保留 |

## 验证记录

Git 加载改动完成后执行 `python3 -m unittest tests.test_guandan_benchmark`，17 项通过。这里记录的是该次已执行结果；本文本身不改变或代替最终全套测试结果。

另按指定命令完成真实基线 commit 对同 commit 的 greedy 自检：2 对／4 盘，级牌 2、7，seed `730099`，fixed。结果保存在 `.data/guandan_benchmark/commit_68e62ab/git_loader_selfcheck.json`：两对各自的发牌和动作轨迹 hash 完全一致，胜率 50%、净收益 0。它补充验证真实 Guandan 模块的 Git 加载路径；其用途是加载与对称性自检，不能作为 AI 强度提升证据。

## 续跑机制补充：新增四项，不改已有断言

实际验收跑完 28 对后，仓库 HEAD 从 `68e62ab` 变成 `27c9cb2`，但策略源码字节完全相同。原握手额外比较工作区 HEAD，误判版本变化。工作区版本身份应由文件 hash 决定；Git commit 模式仍必须验证固定 commit ID。

新增以下四项后共 21 项全部通过，前述 17 项原样保留：

- `test_worktree_worker_accepts_same_bytes_after_commit_changes_head`：提交工作区使 HEAD 变化，确认文件 hash 不变且 worker 仍接受原预期字节身份。
- `test_git_worker_still_requires_expected_commit_revision`：Git 模式传错误预期 commit ID 仍须拒绝；真实字节变化的旧拒绝测试也保留。
- `test_pair_start_preserves_global_deals_and_results_across_split_runs`：真实 greedy 完整跑两对，与按全局索引拆成两个单对运行，全部 records 必须逐项相同，包括 seed、级牌、A/B 运行顺序和动作轨迹。
- `test_negative_pair_start_is_rejected`：非法负索引必须在运行前拒绝。
