# Task 88 — Bomb Busters（炸弹克星）实现方案

## 1. 任务结论

在 OpenBoardGame 中新增 Hisashi Hayashi 的合作推理游戏 `Bomb Busters`（《炸弹克星》），内部游戏 ID 使用 `bomb_busters`。

本游戏必须分成两个清楚标识的交付层级：

1. **Core Practice（首版，可直接实现）**
   - 支持 2–5 人。
   - 实现蓝色、黄色、红色电线，初始公开信息，Duo Cut、Solo Cut、Reveal Red Wires、引爆器、个人 Double Detector、胜负、Bot、断线重连和房间存档。
   - 使用本项目自行设计的练习预设，不冒充商业版 Mission 1–66。
   - 暂不启用共享 Equipment cards，因为公开规则只说明使用框架，并没有给出完整可靠的 12 张卡牌文本。
2. **Verified Mission Pack（后续，数据门槛）**
   - 在取得合法持有并双人复核的任务卡、共享装备卡和 Surprise Box 组件转录后，再实现官方 1–66 任务。
   - 任务数据和未来任务秘密只保存在服务端，不能打包进前端脚本。
   - 音频任务必须拥有可提交或可合法调用的音频授权；不能从商品页下载后直接纳入仓库。

首版不能把猜测出来的任务参数标为官方内容。房间配置和 Help 中都要明确显示：

```text
Core Practice · Original practice setup · Shared equipment disabled
```

整体实现必须满足：

- 服务端权威管理洗牌、分架、排序、隐藏线值、公开信息标记、剪线、引爆器、行动顺序和胜负。
- 每个客户端只收到自己有权看到的电线正面；浏览器状态包、事件、日志和 Bot 广播都不能泄露其他玩家的线值。
- 严格遵守 `FRONTEND.md`：颜色与 Emoji 辅助阅读、非游戏内容 UI 使用英文、无页面横向滚动、移动端紧凑、空白处取消选择、弹窗支持 Esc。
- 完整遵守 `designs/task40.md` 的 Help / Explain 行为，尤其是 Explain 模式拦截正常按钮功能、disabled 按钮仍可解释。
- 一次任务成功或失败后停留在结果阶段；所有真人确认后才开始下一枚炸弹或重试，Bot 自动确认。
- 不复制商业版 Logo、角色插画、任务卡、装备卡、线路板、图标、字体、音效或规则书版式。视觉只使用 Emoji、CSS、文字与自制几何图案。

## 2. 游戏识别、规则版本与资料来源

### 2.1 识别信息

- 英文名：`Bomb Busters`
- 中文名：《炸弹克星》
- 设计者：Hisashi Hayashi
- 美术：Dominique Ferland（Dom2D）
- 首发年份：2024
- 玩家人数：2–5 人
- 单次任务时长：约 20–40 分钟
- 类型：合作、逻辑推理、受限交流、隐藏信息、任务制
- BoardGameGeek ID：`413246`
- BGG 页面：<https://boardgamegeek.com/boardgame/413246/bomb-busters>
- Pegasus 英文产品页：<https://pegasusna.com/Bomb-Busters/PNA51280.USA>
- 官方英文规则书：<https://www.cocktailgames.com/wp-content/uploads/2023/10/BombBusters_rules_EN.pdf>
- Pegasus 英文 FAQ（文件正文日期 2025-07-11）：<https://cdn.pegasus.de/public/media/28/6f/b3/1767819082/Bomb%20Busters%20FAQ%202025-0711.pdf>

截至 2026-09-16，BGG 页面显示复杂度约为 `2.01 / 5`。正式实现时仍应把 BGG URL 加入 `scripts/bgg_weight_scrape.py` 后重新抓取，并将当次结果写入 `static/room.js`；本文数值不是永久常量。

### 2.2 已确认的核心规则

以下内容已由官方英文规则书和 FAQ 交叉确认：

- 蓝线共有 48 条，数字 `1–12` 各 4 条。
- 黄线共有 11 条，排序值为 `1.1–11.1`；红线共有 11 条，排序值为 `1.5–11.5`。
- 黄线和红线的小数只用于开局排序。行动期间黄线统一视为 `YELLOW`，红线统一视为 `RED`。
- 玩家看得到自己的线值，看不到队友的线值；所有电线在各自线架上按排序值从左到右排列。
- 2 人时每人 2 个线架；3 人时队长 2 个、其他人各 1 个；4–5 人每人 1 个。
- 即使一名玩家有 2 个线架，两个线架仍合称一手牌，但开局只放 1 个 Info token。
- 每名玩家开局依次选一条自己的蓝线，公开一个与其数字相同的 Info token；开局不能使用黄色 Info token。
- 普通 Duo Cut 必须以自己确实拥有的一条蓝线或黄线为声明依据，并指向队友的一条具体未剪电线。
- 猜中时剪掉双方一条同值电线；猜错蓝线或黄线时引爆器前进一格，并在被指电线上公开真实 Info token。
- 普通 Duo Cut 指中红线时立刻失败，不经过普通扣错流程。
- 玩家可以故意选择很可能猜错的位置，只要其声明值确实来自自己的一条线；数字版不能把“必须高概率正确”写成规则。
- Solo Cut 只能一次剪掉当前游戏中剩余的该值全部电线，而且数量必须正好是 2 或 4；自己拥有 3 条同值线时不能 Solo Cut。
- 两个线架中的线可以共同组成一次合法 Solo Cut。
- 当玩家剩下的所有未处理电线都是红线时，可以执行 Reveal Red Wires，将它们安全公开并移出手牌。
- 玩家手牌为空后跳过其回合；若只剩一名玩家有线，该玩家可以连续行动。
- 所有人线架为空时任务成功。
- 引爆器到达骷髅，或普通剪线直接碰到红线时任务失败。
- 失败重试时更换队长；连续任务之间队长也向左轮换。
- 个人 Double Detector 每名玩家每次任务只能使用一次。
- Double Detector 只能声明蓝色数字 `1–12`，不能声明 `YELLOW` 或 `RED`。
- Double Detector 选择同一名队友同一个线架上的 2 条线；两条不要求相邻。
- 其中至少一条匹配时成功，只剪目标中的一条匹配线。
- 两条都匹配时由被指玩家选择剪哪一条，不能借此说明“两条都匹配”。
- 两条都不匹配时引爆器前进，被指玩家选择其中一条放 Info token。
- Double Detector 失败且两条都是红线时爆炸；只有一条红线时不爆炸，必须给另一条非红线放 Info token。
- 每个数字有 2 个 Info token，另有 2 个黄色 Info token；若所需 token 都被未剪电线占用，实体规则允许口头公开真实值并由大家记忆。
- 每个蓝色数字的 4 条线全部剪完后放置 Validation token。
- 共享 Equipment card 在对应数字已有 2 条蓝线被剪后解锁，每张只能使用一次；但具体 12 张卡牌效果必须来自卡面资料。

### 2.3 数字版明确裁定

公开规则没有规定所有网络实现细节，首版统一如下：

- 座位号升序定义为顺时针，`left` 是下一个座位。
- 第一枚练习炸弹随机选队长；之后每次新炸弹或失败重试都将队长顺时针移动一席。
- 发牌按“队长开始的玩家顺序、每名玩家的线架顺序”组成 rack 顺序，逐轮向 rack 发 1 条，直到发完；各 rack 最终数量差不超过 1。
- 每个 rack 独立排序，不能先把一名玩家的两架线混排后再拆分。
- 排序键使用整数刻度，避免浮点误差：蓝 `n -> n*10`、黄 `n.1 -> n*10+1`、红 `n.5 -> n*10+5`。
- 普通剪线不会压缩剩余位置。每条线保留原 rack 和 slot，剪掉后原位置显示正面结果，以保持排序推理所需的空间信息。
- 首版练习模式的引爆器错误额度等于玩家人数；每次普通错误减 1，降到 0 立即失败。
- 普通 Duo Cut 由玩家先选择自己的线，再选择目标线；服务端以自己的线推导声明值，不允许客户端任意输入数字。
- 这样既允许故意选择一个可能错误的目标，又杜绝“误报一个自己没有的数字”这种实体操作错误。
- Info token 所在线被剪后，其 token 自动回到供应区。实体版在需要时本来也允许回收已无作用的 token，因此提前自动回收不改变可用性。
- 如果同值 token 全被仍未剪的线占用，服务端只发一次公开 `spoken_info` 事件和 live-region 提示，不把该值永久写进可回看的日志；这保留实体版的记忆要求。
- 任务成功或失败后公开全部剩余线，生成结果快照；新任务重新洗线，不能利用上一局的分布。
- 练习预设不保存跨房间账号进度；房间保存只恢复当前任务和本房间内完成记录。
- 断线不会自动托管或替玩家选择线；玩家重连后继续。Bot 的待选择步骤可由 Bot 自己完成。

这些裁定必须写入 Help 的 `Digital Notes`，不能作为隐藏规则。

## 3. 数据与授权边界

### 3.1 当前无法可靠获取或不可直接提交的资源

公开规则书足以实现核心系统，但不足以完整重现商业版 66 个任务。以下资料是正式任务包的硬门槛：

1. Mission 1–8 每张正面的设置数据、背面的特殊规则，以及 2 人设置差异。
2. 五个 Surprise Box 中 Mission 9–66 的全部任务卡、规则贴纸和额外组件。
3. 12 张共享 Equipment card 的完整名称、解锁数字、效果、使用时点和组合限制。
4. 任务专用 Number cards、Constraint / Restraint cards、Oxygen tokens、机器人、顺序卡等组件的完整数据。
5. Mission 19、30、42、54、66 的完整音频与对应时序规则。
6. Mission 66 standee、移动轨道、限制条件和特殊行动的完整定义。
7. 官方任务叙事、角色名、角色插画、反派插画、奖杯和进度表文案。
8. 商业版 Logo、板图、线牌图、卡面、图标、牌背、字体、音效和动画。

FAQ 会提到部分任务和部分装备的边界案例，但这些片段不能替代完整卡面。实现者不得根据 FAQ 反推、拼凑或猜测缺失效果后宣称“完整 66 任务”。

### 3.2 合法数据转录要求

若后续取得合法实体组件或发行方授权资料：

- 由一人转录，一人逐项复核。
- 原始照片或扫描只在本地核对，不提交仓库。
- 仓库只保存实现所需的结构化规则数据和自行改写的短说明。
- 每个任务记录 `source_edition`、`source_language`、`verified_by`、`verified_at` 和数据版本。
- 不完整数据包不得被默认加载，也不得注册为可选官方任务。
- 校验失败时服务端拒绝启动该任务，不用猜测默认值静默补齐。

### 3.3 首版原创练习预设

为保证没有商业任务数据时仍可完整开发和游玩，首版提供三个明确标为原创的预设：

| 预设 ID | UI 名称 | 蓝线 | 黄线 | 红线 | 共享装备 |
| --- | --- | ---: | ---: | ---: | --- |
| `short_practice` | Short Practice | `1–6` 各 4 条，共 24 | 0 | 0 | Off |
| `standard_practice` | Standard Practice | `1–12` 各 4 条，共 48 | 随机 2 | 随机 1 | Off |
| `high_risk_practice` | High Risk Practice | `1–12` 各 4 条，共 48 | 随机 4 | 随机 3 | Off |

所有练习预设：

- 包含个人 Double Detector。
- 黄线/红线实际排序值在对应 11 条中无放回随机抽取，并在公共面板上显示为确定候选。
- 不使用“1 out of 2/3”之类只知道候选、不知道实际是否入场的官方任务机制。
- 黄色数量只取偶数，确保核心 Solo/Duo 规则下不会遗留无法处理的单条黄线。
- UI 永久显示 `Original Practice`，不得命名为 Mission 1、Mission 2 或官方 Training。

## 4. 商业素材与自制视觉边界

### 4.1 禁止直接复用

不得从规则书、BGG、商品页、实体扫描、视频或 Tabletop Simulator 模组中提取并提交：

- 官方封面、Logo 和特殊标题字体。
- 官方角色、反派、炸弹、线路板、钳子和线架插画。
- 任务卡、装备卡、角色卡和组件照片。
- 官方图标、规则书页面、背景纹理、音效或音频任务文件。
- Surprise Box 的美术、开箱内容图和叙事文本。

### 4.2 自制视觉方向

- 蓝线：`🔵 BLUE 7`，蓝色实线和细点纹。
- 黄线：`🟡 YELLOW`，黄色虚线和斜纹；自己的牌额外显示私密排序值，例如 `4.1`。
- 红线：`🔴 RED`，红色交叉纹和 `DANGER`；自己的牌额外显示私密排序值，例如 `4.5`。
- 隐藏线：`❔ Hidden wire`，深灰牌背、自制电路纹和明确 slot 编号。
- 已剪线：`✂️` 加正面值。
- 已安全揭示红线：`🛡️ RED secured`，与“剪中红线爆炸”在视觉上区分。
- 初始/错误信息：`ℹ️ 7` 或 `ℹ️ YELLOW`。
- 验证完成：`✅ 7 ×4`。
- 引爆器：`🟢 / 🟡 / 🟠 / 🔴 / 💀` 的 CSS 分段条，不复制实体转盘。
- 队长：`🧭 Captain`，不用官方角色卡。

颜色、文字、Emoji 和纹理必须同时表达状态，不能只依赖红黄蓝色差。

## 5. 组件与电子版数据模型

### 5.1 电线模板

```text
Blue:
  values 1..12
  4 copies per value
  match key = blue:<value>

Yellow:
  private sort values 1.1..11.1
  1 copy per sort value
  match key during play = yellow

Red:
  private sort values 1.5..11.5
  1 copy per sort value
  match key during play = red
```

不要用浮点数保存小数值。建议实例结构：

```python
WireInstance = {
    "wire_id": "opaque-random-id",
    "kind": "blue | yellow | red",
    "blue_value": 7,          # 仅 blue；其他为 None
    "sort_tick": 70,          # blue 7=70, yellow 7.1=71, red 7.5=75
    "owner_id": "p2",
    "rack_id": "rack-p2-1",
    "slot_index": 4,
    "status": "uncut | cut | secured",
    "info_token": None,
}
```

`wire_id` 必须与线值无关。不能使用 `blue-7-03` 这类可被前端或日志反推出秘密的 ID；可以在洗牌后分配随机 UUID，或在随机排列后分配无语义序号。

### 5.2 线架

```python
RackState = {
    "rack_id": "rack-p2-1",
    "owner_id": "p2",
    "rack_index": 0,
    "slots": [wire_id, ...],
}
```

- `slots` 顺序在标准剪线期间固定。
- 已剪/已揭示线仍保留 slot 占位，用于展示公开正面和维持排序线索。
- “手牌为空”指该玩家所有 rack 中都没有 `status == uncut` 的线，而不是 `slots` 数组为空。
- 后续 Walkie-Talkies 等换线装备必须有独立的移动与重新排序规则；在拿到完整卡面前不实现。

### 5.3 Info token

供应区包含：

```text
number 1..12: each 2
yellow: 2
```

状态保存 token 实例而非只存一个布尔值，以便验证稀缺性：

```python
InfoToken = {
    "token_id": "info-7-a",
    "label": "7 | yellow",
    "attached_wire_id": None,
}
```

红线没有 Info token。普通 Duo Cut 指中红线直接失败；Double Detector 的“一红一非红”失败只给非红线放 token。

### 5.4 Validation token

- 标准蓝线每个数字目标数为 4。
- 当 `cut_blue_counts[value] == in_play_blue_counts[value] == 4` 时放置该数字的 Validation token。
- `short_practice` 只显示 1–6 的进度，7–12 标为 `Not in play`，不能误标为已验证。
- 黄线和红线不使用数字 Validation token。

### 5.5 组件守恒

任意进行中状态必须满足：

```text
所有 rack slot 中的 wire_id
= 本次任务的全部 in-play wire_id
```

每条 in-play 电线始终存在于一个 rack slot，只是状态在 `uncut / cut / secured` 之间变化。另需验证：

- 所有 `wire_id` 唯一。
- 每个 wire 的 `owner_id / rack_id / slot_index` 与 rack 反向索引一致。
- 每个 Info token 至多附着在一条未剪线上。
- 每条线至多附着一个 Info token。
- `cut` 红线只允许出现在失败结果快照，不允许在继续中的正常状态出现。
- `secured` 只允许用于红线。
- 蓝线剪线数不会超过该数字入场数。

## 6. 核心玩法

### 6.1 目标

全队合作清空所有线架：

- 蓝线必须与同数字蓝线成对剪断。
- 黄线彼此都视为同值 `YELLOW`，也要通过 Duo/Solo Cut 处理。
- 红线绝不能作为普通剪线目标；当某玩家只剩红线时，将它们安全揭示。
- 在引爆器耗尽前清空全部线架则成功。

### 6.2 设置

1. 读取并严格校验练习预设或已验证任务定义。
2. 按玩家人数建立 rack：
   - 2 人：每人 2 个。
   - 3 人：队长 2 个，其他人各 1 个。
   - 4–5 人：每人 1 个。
3. 构造本任务蓝线池。
4. 随机抽取任务所需黄线和红线；公共面板显示入场的小数候选位置，但不显示它们被发给谁。
5. 将全部入场线面朝下洗混。
6. 从队长开始按 rack 顺序轮流发线，直到发完。
7. 每个 rack 单独按 `sort_tick` 升序排序并固定 slot。
8. 设置引爆器错误额度。
9. 重置所有个人 Double Detector 为可用。
10. 从队长开始，玩家依次放置 1 个初始数字 Info token。
11. 所有人完成初始信息后，由队长开始第一回合。

### 6.3 初始 Info token

当前选择玩家必须：

1. 选择自己任一 rack 中一条未剪蓝线；
2. 优先分配该数字仍可用的 Info token；
3. 若同值两个 token 都附着在未剪线上，则按 FAQ 使用一次性 `spoken_info`，不能因此卡住设置；
4. 有 token 时永久公开附着到该 slot，直到该线被剪；
5. 每名玩家只选择一次，即使拥有两个 rack 也不增加次数。

黄线、红线不能用于初始信息。若一个经过验证的未来任务可能让玩家没有可选蓝线，任务定义必须明确提供替代规则；核心引擎不能自行猜测。

### 6.4 一个正常回合

行动玩家必须完成以下一种：

1. `Duo Cut`
2. `Solo Cut`
3. `Reveal Red Wires`

个人 Double Detector 是 Duo Cut 的一次性变体，不额外占一个独立回合。

动作完整结算后：

1. 归还被剪线上的 Info token；
2. 更新蓝线剪线数和 Validation token；
3. 检查任务成功/失败；
4. 若未结束，跳过所有已经没有未处理电线的玩家；
5. 把回合交给顺时针下一名仍有线的玩家。

### 6.5 Duo Cut

客户端选择：

- 自己的一条未剪蓝线或黄线；
- 一名队友的一条具体未剪线。

服务端从自己的线推导声明：

```text
own blue 7  -> “Is this BLUE 7?”
own yellow  -> “Is this YELLOW?”
own red     -> 非法
```

结算：

```text
目标 match_key == 自己 match_key
  -> 成功，双方所选线都变为 cut

目标是 red
  -> 立即任务失败，reason = red_wire

其他不匹配
  -> 引爆器错误额度 -1
  -> 尝试给目标线放真实值 Info token
  -> 错误额度为 0 时任务失败，reason = detonator
```

猜错时：

- 自己选择的是哪一个具体 slot 不能向其他玩家公开。
- 自己的线保持未剪，也不新增公开标记。
- 目标 slot 是公开的，因为实体玩家已经指向它。
- 声明值是公开的，因为实体玩家已经说出它。

成功时双方被剪 slot 和正面值都公开。

### 6.6 Solo Cut

服务端根据行动玩家提交的 wire IDs 重新计算，不信任客户端的“可 Solo”判断。

合法条件：

- 所选线全部属于行动玩家，可跨两个 rack。
- 所选线全部未剪且 `match_key` 相同。
- `match_key` 是一个蓝色数字或 `yellow`，不能是 `red`。
- 当前全场该 `match_key` 的所有未剪线都在这组选择中。
- 选择数量正好是 2 或 4。

特别边界：

- 自己有 3 条同值线，别处还有第 4 条：不能 Solo。
- 自己有 3 条同值线，别处没有：仍不能 Solo。
- 已剪 2 条，自己持有剩余 2 条：可以。
- 一条在线架 A、一条在线架 B：可以。
- 黄线只要满足“全场剩余全部在自己手中”且数量为 2 或 4，也可以。

合法 Solo Cut 一次性公开并剪掉整组，然后结束回合。

### 6.7 Reveal Red Wires

只有当行动玩家至少还有 1 条未剪线，且其所有未剪线都是红线时可用。

- 一次性把该玩家所有剩余红线设为 `secured`。
- 公开其实际排序值和原 slot。
- 不减少引爆器。
- 不计为剪线，不解锁 Validation 或 Equipment。
- 完成后按正常流程检查任务成功并推进回合。

### 6.8 个人 Double Detector

每名玩家每次任务可在自己的 Duo Cut 中使用一次：

1. 选择自己一条未剪蓝线；黄线和红线不可用。
2. 选择同一名队友、同一个 rack 上的两条不同未剪线。
3. 两条目标不要求相邻。
4. 提交后立刻消耗本次个人能力，无论成功或失败。

结算分支：

```text
至少一条目标蓝线匹配声明值
  -> 成功
  -> 若恰好一条匹配，剪该线和自己的线
  -> 若两条都匹配，进入 awaiting_detector_choice
     由目标玩家秘密选择剪哪一条；只公开最终被剪线

没有匹配，且两条目标都是红线
  -> 立即失败，reason = red_wire

没有匹配，且恰好一条是红线
  -> 引爆器 -1
  -> 不公开哪条是红线
  -> 自动给唯一非红线放真实 Info token

没有匹配，且两条都非红线
  -> 引爆器 -1
  -> 进入 awaiting_detector_choice
  -> 目标玩家选择其中一条放真实 Info token
```

待目标玩家选择期间：

- 原行动玩家和其他玩家都不能继续行动。
- `current_responder_id` 是唯一拥有响应动作的人。
- 响应完成前不能推进回合或重复扣引爆器。
- 断线重连后恢复同一个待选择状态。
- 若响应者是 Bot，Bot 自动选择；真人不由服务端代选。

### 6.9 Info token 耗尽

建议纯函数：

```text
allocate_info(label, target_wire):
  1. 使用供应区中同 label 的 token
  2. 若没有，回收已 cut/secured 线上的同 label token
  3. 若仍没有，返回 spoken_info(label, target_wire)，不创建永久 token
```

`spoken_info` 是一次性公开事件：

- 当前在线客户端显示明显但短暂的文字提示。
- 屏幕阅读器通过 live region 朗读。
- 不进入长期滚动日志。
- 不进入之后的公共状态快照。
- 服务端内部审计可以记录，但 `get_public_view` 永远不下发。

若目标线本来已经附有显示其真实值的 Info token，错误仍照常推进引爆器，但不再消耗第二个 token，也不产生多余的 spoken info。Double Detector 的响应者可以按实体规则从允许目标中选择；选择一条已经有正确 token 的线时不会额外公开信息。

### 6.10 任务结束与暂停

成功条件：所有玩家都没有 `uncut` 线。

失败条件：

- 普通 Duo Cut 指中红线。
- Double Detector 两个目标都是红线且没有匹配。
- 引爆器错误额度降到 0。
- 后续任务定义明确声明的额外失败条件。

进入 `mission_result` 后：

- 冻结所有剪线动作。
- 公开全部剩余线和实际红/黄排序值。
- 显示成功/失败原因、使用的错误数、各数字剪线进度和关键行动摘要。
- 显示 `Ready X / N`，每名真人只确认一次。
- Bot 自动加入 ready 集合。
- 失败时按钮为 `Retry Mission`；练习成功时为 `Next Bomb`；正式任务成功时为 `Next Mission`。
- 所有真人确认之前，绝不重洗、换队长或清掉结果。

## 7. 状态机

### 7.1 首版阶段

```text
initial_info
  ↓ 每名玩家依次放置 1 个初始 Info token
playing
  ↓ Double Detector 需要目标玩家选择
awaiting_detector_choice
  ↓ 响应完成
playing
  ↓ 成功或失败
mission_result
  ↓ 所有玩家确认
initial_info（新练习炸弹或失败重试）
```

完整任务包可以扩展：

```text
mission_briefing
mission_setup_choice
mission_special_response
campaign_complete
```

但不能让客户端根据 UI 自行跳阶段。`phase` 和 `pending_resolution` 始终由服务端决定。

### 7.2 建议状态结构

```python
state = {
    "game_id": "bomb_busters",
    "phase": "initial_info",
    "mode": "practice",
    "practice_preset": "standard_practice",
    "mission_pack_version": None,
    "mission_id": None,
    "attempt_number": 1,
    "player_meta": {...},
    "turn_order": [player_id, ...],
    "captain_id": "p1",
    "current_turn": None,
    "initial_info_order": [player_id, ...],
    "initial_info_cursor": 0,
    "players": {
        player_id: {
            "rack_ids": [...],
            "personal_detector_used": False,
            "initial_info_placed": False,
            "result_ready": False,
        },
    },
    "racks": {rack_id: RackState, ...},
    "wires": {wire_id: WireInstance, ...},
    "in_play_wire_ids": [...],
    "public_color_markers": {
        "yellow": [{"sort_tick": 21, "certainty": "certain"}],
        "red": [{"sort_tick": 65, "certainty": "certain"}],
    },
    "info_tokens": {...},
    "validation_complete": {value: bool for value in 1..12},
    "cut_blue_counts": {value: count for value in 1..12},
    "detonator": {
        "mistake_limit": 4,
        "mistakes_used": 0,
        "remaining": 4,
    },
    "pending_resolution": None,
    "shared_equipment": [],
    "mission_modifiers": [],
    "public_activity": [],
    "private_audit": [],
    "last_result": None,
    "mission_history": [],
    "result_ready_ids": [],
    "rng_seed": "server-only",
    "rng_counter": 0,
    "game_over": False,
}
```

### 7.3 确定性随机

- 队长、红黄线抽取、洗牌和发牌使用模块内部的确定性 RNG helper。
- 保存 `rng_seed` 和 `rng_counter`，不要序列化 Python `random.Random` 对象。
- `serialize -> deserialize` 后继续任务，后续随机结果与未重连路径一致。
- seed、counter、完整线池顺序和未来任务数据永远不进入公共视图。
- 测试可通过内部 fixture 固定 seed；房间 UI 不提供 seed 文本输入。

## 8. 动作协议

所有动作继续走通用 `game:action`，不新增 Bomb Busters 专用 Socket.IO handler。

### 8.1 `place_initial_info`

```json
{
  "type": "place_initial_info",
  "wire_id": "w-opaque"
}
```

校验：

- 当前阶段为 `initial_info`。
- 提交者正是当前初始信息选择者。
- wire 属于提交者、未剪、为蓝线。
- 提交者此前没有放过初始信息。

若该数字没有实体 token 可分配，动作仍合法，但只产生一次性 `spoken_info`。

### 8.2 `dual_cut`

```json
{
  "type": "dual_cut",
  "own_wire_id": "w-own",
  "target_wire_id": "w-target"
}
```

校验：

- 当前阶段为 `playing`，提交者是当前玩家。
- own wire 属于提交者、未剪、不是红线。
- target wire 属于另一名玩家且未剪。
- 两个 ID 不同。
- 整个动作在一次 `apply_action` 中原子结算。

### 8.3 `double_detector_cut`

```json
{
  "type": "double_detector_cut",
  "own_wire_id": "w-own-blue",
  "target_wire_ids": ["w-target-a", "w-target-b"]
}
```

额外校验：

- own wire 必须是蓝线。
- 两个目标不同，属于同一名队友的同一个 rack。
- 两个目标均未剪。
- 提交者本次任务尚未使用个人能力。
- 数组恰好 2 项且 `uniqueItems: true`。

### 8.4 `resolve_detector_choice`

```json
{
  "type": "resolve_detector_choice",
  "wire_id": "w-target-a"
}
```

校验：

- 当前阶段为 `awaiting_detector_choice`。
- 提交者等于 `pending_resolution.responder_id`。
- wire 在允许选择集合中。
- 若是成功分支，只允许选择匹配线。
- 若是失败分支，只允许选择规则允许放 Info token 的非红线。
- 响应只完成之前已经结算到一半的动作，不再次扣引爆器或再次消耗能力。

### 8.5 `solo_cut`

```json
{
  "type": "solo_cut",
  "wire_ids": ["w-a", "w-b"]
}
```

Schema 允许 2–4 项，但服务端只接受长度 2 或 4，并重新验证“全场剩余该值全部在此集合”。

### 8.6 `reveal_red_wires`

```json
{
  "type": "reveal_red_wires"
}
```

服务端自行找出该玩家全部未剪线；客户端不提交红线 ID，避免遗漏或伪造子集。

### 8.7 `continue_mission`

```json
{
  "type": "continue_mission"
}
```

- 只在 `mission_result` 可用。
- 重复提交幂等。
- Bot 自动提交。
- 未全员确认只更新 ready 状态。
- 最后一名确认者触发一次性的新任务初始化。

### 8.8 `play_again`

仅供未来 `campaign_complete` 使用：

```json
{
  "type": "play_again"
}
```

同样采用全员确认，不允许一名玩家立即清掉所有人的最终结果。

### 8.9 共享装备动作

首版 schema 不加入模糊的：

```json
{"type": "use_equipment", "params": {"anything": "..."}}
```

取得完整装备数据后，每种不同交互形态使用严格动作类型和字段，例如交换、多人响应、多个目标或两个声明值。不能用任意 JSON 逃避校验，也不能让玩家在 UI 中手写 JSON。

## 9. 核心解析与原子性

### 9.1 推荐纯函数

```text
build_wire_pool(preset_or_mission)
allocate_racks(player_count, captain_id)
deal_and_sort_wires(wire_ids, rack_order, rng)
wire_match_key(wire)
available_info_token(label)
validate_solo_set(state, player_id, wire_ids)
resolve_dual_cut(state, actor_id, own_wire_id, target_wire_id)
resolve_double_detector(state, actor_id, own_wire_id, target_wire_ids)
complete_pending_detector_choice(state, responder_id, wire_id)
return_attached_info_token(state, wire_id)
refresh_validation_tokens(state)
advance_to_next_player_with_wires(state)
check_mission_end(state)
build_mission_summary(state)
assert_state_invariants(state)
```

### 9.2 一次剪线的结算顺序

成功动作按以下顺序执行：

1. 再次验证阶段、行动者和所有 wire 状态。
2. 计算匹配结果，不先改状态。
3. 若需要目标玩家选择，写入完整 `pending_resolution` 后停止。
4. 确定最终线后，一次性修改双方 wire 状态。
5. 回收被剪线上的 Info token。
6. 更新蓝线计数、Validation 和已验证装备解锁状态。
7. 执行当前任务 `after_cut` hook。
8. 检查任务结束。
9. 若未结束，推进当前玩家。
10. 生成只包含公开信息的事件。

任何异常都不能留下“一条已剪、另一条没剪”或“已经扣错但 pending 丢失”的中间态。

### 9.3 重复与并发动作

- 已剪 wire 再提交时安全拒绝。
- 非当前玩家动作拒绝。
- `awaiting_detector_choice` 期间所有非响应动作拒绝。
- 同一个 pending choice 完成后清空 nonce；重复响应拒绝，不重复剪线。
- `continue_mission` 重复提交幂等，不重复洗牌。
- 每个任务结算设置 `result_committed=True`，成功/失败摘要只生成一次。
- 必要时在动作中加入公开的 `turn_nonce`；不能依赖客户端按钮 disabled 作为并发保护。

## 10. 完整任务包扩展架构

### 10.1 任务定义

正式数据建议保存在服务端目录：

```text
game/assets/bomb_busters/manifest.json
game/assets/bomb_busters/missions_01_08.json
game/assets/bomb_busters/missions_09_19.json
...
```

定义示意：

```json
{
  "mission_id": "official-01",
  "official": true,
  "source_edition": "verified-edition-id",
  "setup": {
    "blue_pool": {"mode": "explicit", "values": {}},
    "yellow_selection": {},
    "red_selection": {},
    "equipment_ids": [],
    "detonator_rule": "by_player_count",
    "player_count_overrides": {}
  },
  "modifiers": [],
  "success_conditions": ["all_racks_empty"],
  "failure_conditions": ["red_cut", "detonator_zero"],
  "requires_components": [],
  "verified": true
}
```

这里的空对象只是 schema 示意，不是允许提交的正式数据。正式校验器必须验证每种选择模式的完整字段。

### 10.2 Modifier registry

不要把 66 个任务写成一个巨型 `if mission_id == ...`。定义有限的规则 hook：

```text
on_setup
legal_actions
before_cut
after_cut
after_failed_cut
before_turn_advance
after_turn_advance
mission_end_check
extend_public_view
```

常见变化用数据化 modifier；真正独特的任务才用独立 handler。每个 handler：

- 有明确输入输出。
- 不能直接读取客户端对象。
- 有单独正反测试。
- 声明其可能引入的隐藏字段和公开字段。
- 声明与 Equipment 的执行顺序。

### 10.3 Surprise 与防剧透

- 未解锁任务定义不进入 `get_public_view`。
- 前端脚本不包含全任务列表、特殊规则文本或组件数据。
- 当前任务只下发已经在实体桌面上应当公开的设置和规则。
- 未来任务标题也不要提前暴露，除非合法组件明确公开。
- 开箱/解锁界面只用自制 `📦 New tools unlocked` 视觉，不复制盒面。
- 房间存档保存已解锁范围；首版不做跨账号全球进度。

### 10.4 音频任务

Mission 19、30、42、54、66 不能只把官方 URL 写死后自动播放：

- 需要确认允许数字版使用与分发。
- 需要完整时序、失败条件和断线恢复规则。
- 音频不得自动播放，必须有显式 `Play Mission Audio`。
- 必须提供字幕或等价文本，满足无声环境和无障碍使用。
- 多客户端应由服务端时间戳同步，而不是各自从 0 开始。
- 在上述条件满足前，对应任务保持不可注册状态。

## 11. 公共视图、隐藏信息与事件

### 11.1 当前玩家自己的线

查看者可以收到自己每条线的：

- opaque `wire_id`
- rack 与 slot
- `kind`
- 蓝色数字或红/黄色私密排序值
- 状态
- 已附着 Info token

### 11.2 队友未剪线

查看者只能收到：

```json
{
  "wire_id": "opaque-id",
  "rack_id": "rack-p2-1",
  "slot_index": 4,
  "status": "uncut",
  "hidden": true,
  "public_info": "7"
}
```

以下字段不得出现，即使值为调试用途：

- `kind`
- `blue_value`
- `sort_tick`
- `match_key`
- 服务端概率或候选真值
- 未确定的红黄候选实际入场结果

已 `cut` 或 `secured` 的线可以向所有人公开正面。

### 11.3 公共状态

所有人可见：

- 任务/练习名称和原创标记。
- 队长、当前玩家、当前响应者。
- 玩家、rack、固定 slot 数量和已处理数量。
- 初始/错误 Info token。
- 已剪或已安全揭示的线。
- 蓝线每个数字的 `0–4` 剪线进度和 Validation。
- 本任务公开的红黄排序候选。
- 引爆器剩余额度。
- 个人 Double Detector 是否已使用，但不能提前显示某玩家打算何时使用。
- 已公开的共享装备状态（未来）。
- 当前公开任务规则。
- 结果 ready 状态。

### 11.4 事件必须天然安全

当前 `app.py` 会把同一份 `events` 发给所有客户端，因此事件不能依赖 per-view 过滤。

失败的普通 Duo Cut 事件可以包含：

- 行动者。
- 声明值。
- 公开目标 wire ID。
- 引爆器变化。
- 新 Info token 或一次性 spoken info。

不能包含：

- 行动者所选自己的具体 wire ID。
- 目标红/黄的私密排序值，除非任务已经结束。
- Double Detector 失败时哪一条是红线。
- 未剪目标的真实值。

### 11.5 Bot 广播的额外风险

`app.py::_maybe_run_bots` 会构造 `bot:action`，当前 `_public_bot_action` 对大多数游戏直接返回原动作。Bomb Busters 的 Bot 动作包含 `own_wire_id`，若失败时原样广播，会泄露 Bot 自己哪一个 slot 对应声明值。

因此实现时必须修改 `app.py::_public_bot_action`：

- 对 `bomb_busters` 只返回公开声明、目标 slot、是否使用公开装备等字段。
- 删除 `own_wire_id`、未公开选择、Bot 推理候选和内部评分。
- 为此增加 room-session 级隐私测试。

### 11.6 日志与受限交流

详细历史会替玩家承担记忆，不符合本游戏的受限交流设计。首版采用：

- 当前状态面板永久显示实体桌面上本来就持续存在的 Info token、已剪线和 Validation。
- live region 与 toast 朗读/显示刚刚发生的公开动作。
- 可滚动 `Team Activity` 只记录低敏摘要，例如 `Mina attempted a cut. Detonator -1.`。
- 不长期记录失败目标的声明值与 slot 组合。
- `spoken_info` 不进入可回看日志。
- 服务端 `private_audit` 仅用于保存一致性和调试，不进入客户端。
- 任务结果阶段可以公开完整最终分布，但新任务开始时清空。

## 12. Bot 方案

### 12.1 公平性硬要求

Bot 运行在服务器上，技术上能访问完整 state，但策略不得读取队友隐藏真值。

实现方式：

1. `bot_move` 先调用与真人相同的 `get_public_view(state, bot_id)`。
2. Bot 只使用该 view、自己的线值和公开历史。
3. 推理 helper 接收经过脱敏的 view，不能接收完整 `state["wires"]`。
4. 测试构造两个“Bot 公共视图完全相同、对手真实线值不同”的状态，固定 Bot RNG 后应产生相同决策。

### 12.2 基础策略

行动优先级：

1. 若所有剩余线为红线，`reveal_red_wires`。
2. 若存在确定合法的 Solo Cut，优先剪掉。
3. 根据已剪数量、自己的线、公开 Info token、红黄公共位置和 rack 排序约束，为每个目标 slot 建立候选 domain。
4. 若存在成功概率 100% 的普通 Duo Cut，执行。
5. 若 Double Detector 未用且两个同 rack 目标能显著提高成功概率，使用 Double Detector。
6. 否则选择风险最低的合法普通 Duo Cut；剩余错误额度为 1 时提高保守阈值。
7. 不把隐藏真值用于“避开红线”。

初始信息策略：

- 只在仍有 token 的蓝线上选择。
- 优先公开靠近 rack 中间、能明显拆分排序候选的值。
- 次优先公开自己重复较多、便于之后剪线的值。

Double Detector 待选择策略：

- Bot 作为目标玩家时可以使用自己的真实线值，因为玩家本来就看得到自己的线。
- 两条都匹配时随机或按公开信息价值选择剪哪条，不能通过事件暗示另一条也匹配。
- 两条都不匹配时选择能最大化公共信息的非红目标放 token。

### 12.3 Bot 完整性

- Bot 能处理 `initial_info`、正常回合、`awaiting_detector_choice` 和 `mission_result`。
- 全 Bot 房间可以自动完成一个练习任务或明确失败，不会卡住。
- Bot action 带 400–900ms 小延迟即可，不做长时间搜索。
- 进度回调不是必需；若加入，detail 只能写 `Evaluating public clues`，不能输出候选真值。

## 13. 前端方案（严格遵守 FRONTEND.md）

### 13.1 文件和全局命名

主要逻辑放入：

```text
static/games/bomb_busters.js
```

所有浏览器全局符号必须带游戏独有前缀：

```text
renderBombBustersGameState
bombBustersCurrentView
bombBustersSelectedOwnWireId
bombBustersSelectedTargetWireIds
showBombBustersHeaderActions
```

不能创建 `selectedWire`、`renderRack`、`showHelp` 这类通用全局名。可以使用 IIFE 或模块私有局部名减少全局污染。

`static/app.js` 只负责：

- panel 显隐。
- `game_type === "bomb_busters"` 的 render dispatch。
- Help / Explain 顶栏入口显隐。

游戏交互和渲染不能堆进 `app.js`。

### 13.2 房间配置

使用一个英文下拉框，不允许输入 JSON：

```text
Practice Setup
  Short Practice
  Standard Practice
  High Risk Practice
```

旁边显示只读说明：

```text
Original practice setups. Shared equipment is not included.
```

控件与 label 在空间允许时同排。移动端下拉框与简短说明可以换行，但不得超出屏幕。

### 13.3 桌面布局

```text
┌──────────────────────────────────────────────────────────────┐
│ Bomb Busters · Standard Practice · Alice's turn   Help ?   │
│ 🧭 Alice   Detonator 🟢 3/4   BLUE 1..12 progress           │
├──────────────────────────────────────────────────────────────┤
│ Public markers: 🟡 2.1 7.1 · 🔴 5.5                        │
├───────────────────────────────┬──────────────────────────────┤
│ Team racks                    │ Validation / Equipment       │
│ Bob rack 1:  ❔ ❔ ℹ️7 ❔   │ 1 2 3 4 5 6 ... 12         │
│ Chen rack 1: ❔ ✂️4 ❔ ❔   │ Personal Detector: Ready    │
│ ...                           │ Team Activity (scrollable)   │
├───────────────────────────────┴──────────────────────────────┤
│ Your rack(s): 🔵1 🔵2 🟡2.1 🔴2.5 ...                     │
│ Action summary / Confirm Cut / Solo Cut / Reveal Red Wires  │
└──────────────────────────────────────────────────────────────┘
```

- 根容器 `max-width: 100%; min-width: 0; overflow-x: clip`。
- 主区使用 CSS Grid，所有 grid child 设置 `min-width: 0`。
- 右栏有合理最大宽度；窄屏自动移到下方。
- 日志设置 `max-height` 与 `overflow-y: auto`，不能无限撑高页面。
- 结果阶段使用正常文档流中的 summary panel，不用覆盖全桌面的永久浮层。
- 只允许真正的 modal 覆盖页面；普通板块不能互相覆盖。

### 13.4 线架组件

- 每名玩家卡片显示姓名、队长、当前回合、线数和个人能力状态。
- 2 个 rack 必须分开显示为 `Rack A` / `Rack B`，不能合并成一个排序序列。
- rack 中每个 slot 都是语义化 `button`，有固定 slot 编号和 `aria-label`。
- 已剪线保留在原 slot 的下方/前方区域，不让剩余线自动左移。
- 队友未剪线只显示牌背、slot 和公开 token。
- 自己的未剪线显示颜色、匹配值和私密排序值。
- hover、title、dataset、CSS class 和 DOM attribute 都不能包含队友秘密值。
- disabled 目标仍要能被 Explain 的 `pointerdown` 坐标检测解释。

桌面可用较密的单行 rack；如果宽度不足，按固定阅读顺序换成多行网格。页面本身绝不横向滚动。

### 13.5 选择与剪线交互

普通 Duo Cut：

1. 点击自己一条蓝/黄线，显示 `Declare BLUE 7` 或 `Declare YELLOW`。
2. 点击一名队友的一条目标线。
3. 操作条显示完整摘要：`Cut BLUE 7 with Bob · Rack A · Slot 5`。
4. 桌面端点击 `Confirm Duo Cut`；移动端在目标线上方出现就地浮层，点击 `Confirm` 后发送动作。

Double Detector：

1. 点击 `Use Double Detector`。
2. 只能选择自己的蓝线。
3. 只能在同一个队友 rack 中选择 2 个目标。
4. 摘要明确显示该能力将被消耗。
5. 点击 `Confirm Detector Cut`。

选择行为：

- 再点已选元素可取消它。
- 点击游戏板空白处取消整个本地选择。
- 按 Esc 取消未提交的本地选择。
- 不提供 `Clear Selection` 按钮。
- 移动端选线后显示带 `Confirm` / `Cancel` 的上下文浮层；`Cancel` 只撤销当前未提交选择，不是常驻清空按钮。
- 服务端状态版本变化后，若选中 wire 已不合法，自动清掉选择并给出简短提示。
- 不能在第一次点击目标时立刻发送高风险动作，避免移动端误触。

### 13.6 初始信息界面

- 当前选择者自己的可用蓝线显示轻微虚线提示。
- 点击线后显示 `Share BLUE 7`。
- 已被同值两个 token 占满的蓝线仍可选，但显示 `No token available · clue will be announced once`。
- 其他玩家只看到 `Alice is choosing an initial clue…`，不能看到她当前 hover/临时选择。
- 提交后对应 token 出现在所有人的同一 slot 前。

### 13.7 Solo Cut 与红线揭示

- 选择自己的同值线时，若服务端 public view 给出一个合法 Solo set，显示 `Solo Cut 2 × BLUE 9`。
- 客户端可高亮整组，但服务端仍重新验证。
- 不要给拥有 3 条同值线的玩家显示可用 Solo Cut。
- 只剩红线时显示明显的 `Secure Red Wires`，使用 `🛡️` 而不是剪刀图标。
- 红线和危险失败按钮的文字不能只靠红色表达风险。

### 13.8 引爆器与反馈

- 状态条显示 `Mistakes: 1 / 4` 和 `Remaining: 3`，避免只显示抽象转盘。
- 错误后短暂脉冲 `🟠 Detonator advanced`。
- 指中红线时显示克制的 CSS 警报，不使用闪烁频闪。
- `prefers-reduced-motion: reduce` 时取消震动、脉冲和位移动画。
- 不自动播放声音；首版不需要音频素材。

### 13.9 结果页

显示：

- `Mission Defused` 或 `Bomb Exploded`。
- 失败原因。
- 最终全部 rack 与线值。
- 使用错误数。
- 完成的蓝线数字。
- 每名玩家是否使用个人能力。
- `Ready X / N` 和每名玩家 `Ready / Waiting`。
- `Next Bomb` 或 `Retry Mission`。

结果页不能自动消失。玩家仍能查看最终 rack 分布，直到所有人确认。

### 13.10 移动端

在 320px、375px 和 430px 宽度重点检查：

- 页面级 `scrollWidth == clientWidth`，无横向滚动。
- 顶部状态最多两到三行，信息按重要性折叠。
- 每个 rack 用 4–6 列自适应网格换行，slot 阅读顺序从左到右、从上到下。
- 两个 rack 始终分开，有清楚标题。
- 线按钮最小触控目标约 44px。
- 选线后使用锚定在该线正上方的临时确认浮层，显示动作摘要、`Confirm` 和 `Cancel`；浮层随滚动重新定位，锚点离开视口时隐藏，不能成为遮住棋盘的常驻栏。
- 选择尚未完整时 `Confirm` 禁用；选择完成后 `Confirm` 直接提交，不再叠加浏览器原生确认框。
- 底部 action dock 仍提供 Double Detector、Solo Cut 等模式入口，但普通剪线不需要滚动到 dock 才能确认。
- Validation 和 Team Activity 可折叠，默认保留当前玩家和引爆器。
- modal 距屏幕边缘有 padding，内部过长时纵向滚动。
- 长玩家名截断或换行，不能挤出页面。

### 13.11 英文 UI 文案

所有实际非游戏 UI 使用英文。建议主要文案：

```text
Core Practice
Original Practice
Shared Equipment: Off
Captain
Your Turn
Choose an initial clue
Share Clue
Declare BLUE 7
Declare YELLOW
Confirm Duo Cut
Use Double Detector
Confirm Detector Cut
Solo Cut
Secure Red Wires
Waiting for Bob to choose a wire…
Detonator Advanced
Mission Defused
Bomb Exploded
Retry Mission
Next Bomb
Ready 3/4
Team Activity
Digital Notes
```

方案文档可以中文；实际页面不要出现中英混杂的系统按钮。

## 14. Help 与 Explain（遵守 task40.md）

### 14.1 Help

Help 弹窗至少覆盖：

- 合作目标和三种线。
- 蓝线 `1–12` 各 4 条。
- 红黄小数只用于排序。
- 不同人数的 rack 分配。
- 每个 rack 独立排序、两个 rack 合称一手。
- 初始 Info token。
- Duo Cut 成功、普通失败和红线立即失败。
- Yellow Duo/Solo Cut。
- Solo Cut 只能 2 或 4 条，3 条不合法。
- Reveal Red Wires。
- Double Detector 的同 rack 两目标规则、两红/一红边界和不能声明黄色。
- Info token 稀缺与 spoken info。
- Validation token。
- 引爆器和胜负。
- 玩家没线后的跳过规则。
- 受限交流：不能透露自己线值、暗示位置、公开讨论推理结论或用日志代替记忆。
- `Core Practice` 与官方任务的区别。
- 结算后全员确认。
- 数字版裁定。

Help 从标题栏始终可用；点击背景、`Close` 或 Esc 关闭。内容过长时 modal body 纵向滚动，不撑出视口。

### 14.2 Explain

Explain 至少覆盖：

- 自己的线。
- 队友隐藏线。
- Info token。
- Validation tracker。
- 引爆器。
- `Share Clue`。
- `Confirm Duo Cut`。
- `Use Double Detector`。
- `Confirm Detector Cut`。
- `Solo Cut`。
- `Secure Red Wires`。
- `Retry Mission` / `Next Bomb`。

严格行为：

- 只有有解释的按钮/线 tile 添加虚线框和问号光标。
- Explain 开启时用 capture listener 拦截全部游戏点击，不能选线或发送动作。
- Help、Explain 自身和 modal 关闭按钮不被误拦截。
- disabled 按钮用 `pointerdown` 加坐标命中，仍可查看解释。
- 展示一次解释后退出 Explain。
- Esc 退出 Explain。
- 游戏切换时 `showBombBustersHeaderActions(showBombBusters)` 正确显隐，并清掉 Explain 状态。

## 15. 仓库落点

### 15.1 新增文件

```text
game/bomb_busters.py
game/assets/bomb_busters/practice_presets.json
static/games/bomb_busters.js
tests/test_bomb_busters_game.py
```

若以后加入已验证正式任务，再新增：

```text
game/bomb_busters_missions.py
game/bomb_busters_equipment.py
game/assets/bomb_busters/manifest.json
game/assets/bomb_busters/missions_*.json
tests/test_bomb_busters_missions.py
```

### 15.2 修改文件

```text
game/__init__.py
game/definitions.py
game/dev_order.json
scripts/bgg_weight_scrape.py
static/index.html
static/app.js
static/room.js
static/style.css
app.py                         # 仅用于脱敏 bomb_busters 的 bot:action
tests/test_room_session.py     # Bot 事件隐私集成测试
```

`static/games/shared.js` 只有在确实抽出通用 modal/helper 时才修改；不要为了单个游戏扩大公共 API。

### 15.3 注册定义

在 `game/definitions.py`：

- 导入并注册 `BombBustersGame`。
- `game_id="bomb_busters"`。
- `name="Bomb Busters"`。
- `min_players=2`。
- `max_players=5`。
- `turn_mode="turn"`。
- action schema 包含本文首版七类动作，全部 `additionalProperties: false`。
- config schema 只允许：

```json
{
  "practice_preset": {
    "type": "string",
    "enum": ["short_practice", "standard_practice", "high_risk_practice"]
  }
}
```

不允许客户端提交 seed、任务 JSON、线值或装备定义。

### 15.4 房间列表和 BGG 权重

- 在 `scripts/bgg_weight_scrape.py` 的 `GAME_URLS` 加入：

```python
"bomb_busters": "https://boardgamegeek.com/boardgame/413246/bomb-busters"
```

- 运行脚本获取当时 `averageweight`。
- 更新 `static/room.js` 的 `GAME_WEIGHT`；截至本文核对值为约 `2.01`。
- 新增注册后运行 `python scripts/gen_dev_order.py`，不要手写猜测的 dev order。

### 15.5 不新增专用 Socket.IO handler

现有通用流程已经提供：

- `init_game`
- `get_legal_actions`
- `apply_action`
- `get_public_view`
- `bot_move`
- `serialize / deserialize`

因此不应在 `app.py` 新增 `on_bomb_busters_*` handler。`app.py` 的唯一必要游戏特例是对 Bot 原始动作做公开字段脱敏；若后续重构为通用 per-game sanitizer，应保持向后兼容。

## 16. 模块接口

```python
class BombBustersGame:
    game_id = "bomb_busters"
    min_players = 2
    max_players = 5

    @staticmethod
    def init_game(config: Optional[Dict], players: List[Dict]) -> Dict: ...

    @staticmethod
    def get_legal_actions(state: Dict, player_id: str) -> List[str]: ...

    @staticmethod
    def apply_action(
        state: Dict,
        player_id: str,
        action: Dict,
    ) -> Tuple[List[Dict], Optional[str]]: ...

    @staticmethod
    def get_public_view(state: Dict, viewer_id: str) -> Dict: ...

    @staticmethod
    def bot_move(state: Dict, bot_id: str) -> Optional[Dict]: ...

    @staticmethod
    def serialize(state: Dict) -> Dict: ...

    @staticmethod
    def deserialize(payload: Dict) -> Dict: ...
```

`get_legal_actions` 返回动作类型；公共视图另给出安全的结构化提示：

```text
legal_solo_sets
can_reveal_red
can_use_double_detector
initial_info_candidate_wire_ids
pending_choice_wire_ids（仅 responder 可见）
```

客户端可以用这些提示优化按钮，但服务端仍要完整复验。

## 17. 测试计划

### 17.1 组件和预设

- 蓝线 1–12 各 4 条，共 48。
- 黄线 `1.1–11.1` 各 1 条。
- 红线 `1.5–11.5` 各 1 条。
- sort tick 顺序正确，例如 `4 < 4.1 < 4.5 < 5`。
- 三个 practice preset 数量准确。
- 黄色数量为偶数。
- opaque ID 不包含 kind 或 value。
- 数据文件未知字段、重复 ID、缺字段时启动失败。

### 17.2 rack 分配、发牌与排序

- 2 人每人 2 rack。
- 3 人只有队长 2 rack。
- 4–5 人每人 1 rack。
- rack 数量差不超过 1。
- 每个 rack 独立排序。
- 两个 rack 没有被合并排序。
- 队长轮换后发牌 rack order 正确。
- wire/rack 双向索引和组件守恒成立。

### 17.3 初始信息

- 从队长开始按座位顺序。
- 每人只能放一次。
- 两个 rack 仍只能放一次。
- 只能选自己的未剪蓝线。
- 黄/红线拒绝。
- token 供应正确减少。
- 已占满同值两个 token 后仍可完成初始信息，并生成一次性 spoken info。
- 所有人完成前不进入 playing。

### 17.4 普通 Duo Cut

- 蓝色同值成功，双方线同时 cut。
- 蓝色不同值错误，引爆器减 1，目标得到真实 token。
- 蓝对黄、黄对蓝错误。
- 黄对黄成功，不比较私密小数。
- 目标红线立即失败。
- own wire 是红线时动作拒绝。
- 猜错不公开 own wire slot。
- 猜错不改变 own wire。
- 成功后回收双方原有 Info token。
- 已剪 wire、自己作为目标、非当前玩家动作均拒绝。

### 17.5 Solo Cut

- 完整 4 条全在自己手中可剪。
- 已剪 2 条、剩余 2 条全在自己手中可剪。
- 两条跨自己两个 rack 可剪。
- 3 条永远不可 Solo。
- 仍有同值线在队友手中时不可 Solo。
- 选择遗漏、混值、重复 ID、已剪 ID 均拒绝。
- 黄线 2/4 条满足条件时可剪。
- 红线不可 Solo。

### 17.6 Reveal Red Wires

- 只剩 1 条或多条红线时合法。
- 仍有任何蓝/黄线时非法。
- 全部红线一次性 secured。
- 不扣引爆器、不增加蓝线剪线数。
- 最后一名玩家 secure 后可触发成功。

### 17.7 Double Detector

- 只能用自己的蓝线声明。
- 目标必须同玩家同 rack、恰好两条且不重复。
- 非相邻目标合法。
- 恰好一条匹配时剪正确一条。
- 两条都匹配进入 responder 选择，不能提前公开“两条都对”。
- 两条都不匹配且都非红，扣 1 后 responder 选一条放 token。
- 一红一非红不爆炸，只允许非红线得到 token。
- 两红立即失败。
- 无论成功失败能力只消耗一次。
- pending 期间其他动作拒绝。
- pending 响应重复提交不重复扣错或剪线。
- 断线序列化后 pending 完整恢复。

### 17.8 Info token、Validation 与引爆器

- 每个数字 2 个 token、黄色 2 个。
- 被剪线 token 自动回收。
- 无 token 时生成一次性 spoken info，不创建第三个 token。
- 已有正确 Info token 的目标再次被猜错时不重复分配 token，但仍正常扣除错误额度。
- spoken info 不出现在后续公共 view 和长期日志。
- 蓝线 4 条全剪后 Validation 完成且只触发一次。
- 黄/红线不推进 Validation。
- 错误额度与玩家人数一致。
- 最后一次错误原子进入失败结果。
- 失败后不能继续动作。

### 17.9 回合与结果暂停

- 队长开始第一回合。
- 空手玩家自动跳过。
- 只剩一名有线玩家时可连续行动。
- 所有 rack 无 uncut 线时成功只结算一次。
- 结果阶段公开剩余线。
- 未全员 ready 不开始下一枚炸弹。
- 重复 ready 幂等。
- Bot 自动 ready。
- 最后一名真人 ready 后只初始化一次。
- 失败重试和下一枚炸弹都正确轮换队长。

### 17.10 公共视图和隐私

- 玩家看得到自己的全部正面。
- 看不到队友未剪线的 kind、value、sort tick 或 match key。
- cut/secured 线对所有人公开。
- 非 responder 看不到 pending 的合法真实选择集合中隐藏语义。
- RNG seed、完整洗牌顺序、private audit 不下发。
- 普通失败事件不含 own wire ID。
- Double Detector 一红一非红事件不说明哪条红。
- `bot:action` 不含 own wire ID 或私密推理。
- 保存文件可包含权威状态，但 API public view 不能返回保存载荷。

可增加递归敏感键断言，并对序列化后的实际 JSON 字符串搜索秘密值。

### 17.11 Bot

- Bot 能选合法初始信息。
- Bot 优先合法 Solo 和 Reveal Red。
- Bot 普通剪线与 detector 目标始终合法。
- Bot 可响应 pending choice。
- 固定公开 view 时，改变对手隐藏真值不改变 Bot 决策。
- Bot 不能利用 partial candidate 的实际抽取结果。
- 全 Bot 2–5 人局不会卡阶段。

### 17.12 序列化与恢复

- round-trip 后 rack slot、wire 状态、token、pending、队长和 RNG 连续性一致。
- 重连玩家恢复自己的正面，不获得队友正面。
- `mission_result` 恢复后仍停留，不自动洗牌。
- 恢复后重复旧动作仍被状态校验拒绝。

### 17.13 前端人工检查

- 320px、375px、430px、768px 和桌面宽度无页面横向滚动。
- 2 人双 rack、3 人队长双 rack 和 5 人多 rack 都不重叠。
- slot 换行后阅读顺序清楚，剪线后位置不压缩。
- 队友 DOM 不含隐藏值、隐藏 class 或泄密 tooltip。
- 点击空白和 Esc 可取消选择。
- 没有 `Clear Selection`。
- 确认前不会误发剪线动作。
- Help 弹窗可滚动并支持背景/Esc 关闭。
- Explain 只标记有解释控件，不触发正常动作。
- disabled 按钮/线 tile 可以解释。
- Team Activity 可滚动，不无限增高。
- Reduced Motion 生效。
- 所有非游戏 UI 文案为英文。

## 18. 验证命令

```bash
python scripts/gen_dev_order.py
python scripts/bgg_weight_scrape.py
python -m unittest tests.test_bomb_busters_game
python -m unittest tests.test_room_session
python -m unittest tests.test_frontend_script_names
python -m unittest tests.test_game_dev_order
python -m unittest tests.test_game_names
python -m unittest
```

`bgg_weight_scrape.py` 依赖网络；网络失败要在 PR 中记录，但不能用它掩盖其他测试失败。

浏览器至少手动完成：

- 2 人 `Short Practice`。
- 3 人队长双 rack 的 `Standard Practice`。
- 5 人 `High Risk Practice`。
- 一次普通错误、一次引爆器失败、一次直接红线失败。
- 一次 Yellow Duo Cut 和一次 Yellow Solo Cut。
- Double Detector 的单匹配、双匹配、一红一非红、两红四个分支。
- 一次 Info token 耗尽 spoken info。
- 结果页等待全员确认。
- 在 initial info、pending detector 和 mission result 三个阶段分别刷新/重连。
- 混合真人/Bot 和全 Bot 房间。

## 19. 推荐实施顺序

1. 建立练习预设数据、严格校验器和 opaque wire 实例。
2. 实现 rack 分配、发牌、独立排序、固定 slot 和状态守恒。
3. 实现 initial info 阶段与 Info token 供应。
4. 实现普通 Duo Cut、引爆器、Validation 和回合跳过。
5. 实现 Solo Cut、Reveal Red Wires 和任务结束。
6. 实现 Double Detector 的 pending response 状态机。
7. 实现 public view、事件脱敏、serialize/deserialize 和结果全员确认。
8. 修改 `app.py::_public_bot_action` 并补 Bot 事件隐私测试。
9. 实现只依赖公开 view 的 Bot。
10. 注册游戏、更新房间配置、生成 `dev_order.json` 和抓取 BGG weight。
11. 实现 `static/games/bomb_busters.js` 的完整交互。
12. 实现响应式 CSS、自制视觉、Help、Explain 和无障碍状态。
13. 跑单测、全量测试和多尺寸人工检查。
14. 只有在合法数据完成转录与复核后，才开始共享装备与官方任务包。

不要先做 66 个任务的空壳按钮，也不要把未验证任务数据写成 `TODO` 后默认上线。先把隐藏信息、原子剪线和结果暂停做正确。

## 20. 完成标准

### 20.1 Core Practice 完成标准

只有同时满足以下条件，首版才算完成：

- 2–5 人三个原创练习预设完整可玩，并明确标识非官方任务。
- rack 数量、独立排序、初始 Info token 和队长顺序正确。
- 蓝、黄、红线及其所有核心边界正确。
- 普通 Duo Cut、Solo Cut、Reveal Red Wires 和 Double Detector 均由服务端权威校验。
- 引爆器、Info token 稀缺、Validation、胜负和空手跳过均有测试。
- 结果阶段严格等待所有真人确认。
- 断线重连、保存恢复和 pending response 不重复结算。
- 任何公共 view、事件、日志、DOM 或 Bot 广播都不泄露隐藏线值。
- Bot 只按公开 view 推理并能完成全部阶段。
- 不包含商业版美术、任务文本、装备卡面或音频。
- `static/games/bomb_busters.js` 承担主要前端逻辑，所有全局名有独有前缀。
- UI 使用 Emoji、文字、颜色和纹理共同表达状态。
- Help / Explain 符合 `designs/task40.md`。
- 无 Clear Selection；空白和 Esc 可取消；modal 支持 Esc。
- 320px 起无页面横向滚动，日志可滚动，板块不重叠。
- 所有非游戏 UI 为英文。
- `python -m unittest` 全部通过，`game/dev_order.json` 已由脚本刷新。

### 20.2 官方 66 任务完成标准

不能把 Core Practice 完成误写成“完整 Bomb Busters Campaign”。官方任务包只有在以下条件全部满足后才可标记完成：

- Mission 1–66、全部人数修正、共享装备和额外组件已合法转录并双人复核。
- 官方 FAQ 的所有相关 errata 已映射到数据或测试。
- 12 张共享 Equipment card 均有严格动作 schema、时序和组合测试。
- 未解锁内容不会通过前端 bundle、public view 或事件剧透。
- 五个音频任务具有合法音频来源、字幕、同步和恢复方案。
- 每个任务至少有设置测试、成功路径、失败路径和人数差异测试。
- 数据 manifest 完整，任何缺项都会拒绝注册而非静默降级。
- UI 和 README 清楚区分商业规则兼容性、数据版本和授权边界。
