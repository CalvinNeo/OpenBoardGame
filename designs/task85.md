# Task 85: 《画外之意》（Subtext）规则与电子版实现规格

## 游戏识别与命名说明

- 用户需求名：《话外之意》。
- 繁体中文版常见正式名：《画外之意》。
- 英文名：`Subtext`。
- 作者：Wolfgang Warsch。
- 首版年份：2019。
- 出版：Edition Spielwiese；英文版由 Stronghold Games 发行。
- 玩家人数：4-8 人。
- 游戏时长：20-40 分钟。
- 类型：同时绘画、隐性交流、猜同伴、派对游戏。
- BoardGameGeek：`https://boardgamegeek.com/boardgame/265684/subtext`。
- BGG 当前复杂度约为 `1.29 / 5`，实现后应以脚本实时抓取值为准。

本文将需求中的《话外之意》识别为 `Subtext`。为避免和 `Crosstalk`（常见中文名《言下之意》）混淆，代码统一使用 `subtext` 作为游戏 ID，界面名称使用 `Subtext`，Help 中注明中文名《画外之意》。

本文不是规则书原文翻译，而是面向 OpenBoardGame 的状态机、隐私边界、前端交互和测试规格。规则已对照以下资料：

- 出版社产品页：`https://edition-spielwiese.de/en/spiel/subtext/`
- 2019 英文规则书 PDF：`https://cdn.1j1ju.com/medias/c8/12/74-subtext-rulebook.pdf`
- 中文版介绍及中文规则下载入口：`https://wobgames.net/shop/subtext-%E7%95%AB%E5%A4%96%E4%B9%8B%E6%84%8F/`
- BGG 游戏条目：`https://boardgamegeek.com/boardgame/265684/subtext`

## 无法直接复用的资源

### 官方题目牌

实体版包含 115 张题目牌，每张有 5 个不同栏位的词语，共涉及 575 个题目栏位。公开规则书只能确认牌组结构、少量教学示例和难度关系，不能提供可合法复用的完整结构化题库。

电子版必须使用自行编写、取得授权或明确可再分发的题库，不能从扫描图、TTS 模组或商业牌面批量抄录官方词语。初版数据要求见“题库设计”一节。

### 官方美术与版式

游戏版图、角色棋子、猜测标记、分数标记、题目牌、牌背、盒面和插画均受版权保护。电子版使用自制 UI、Emoji、纯色标记和浏览器 Canvas，不复制商业素材。

### 自动识别违规绘画

规则禁止在画中使用字母和数字，也禁止绘画阶段通过说话交流。浏览器无法可靠判断一组自由曲线是否构成文字，也无法控制玩家在外部语音软件中的交流。

初版采取以下边界：

- 绘图输入只允许自由手绘轨迹，不提供文字、图形、贴纸或上传图片工具。
- Help 和绘图区持续提示“不要写字母或数字，不要交流题目”。
- 服务端校验轨迹格式、大小和坐标，但不做 OCR，也不因为误判自动处罚。
- 若以后加入举报或房主裁定，应作为房规扩展，不改变基础状态机。

### 智能机器人绘画

仓库现有机器人可以用简单模板完成流程，但无法像真人一样稳定理解抽象词并设计“只有同伴能懂”的间接提示。初版机器人定位为联机流程和自动化测试辅助，不承诺真人级策略。

## 核心玩法

每轮有一名玩家担任主持人 `Dealer`。主持人先秘密看到一个目标词，然后系统把包含该目标词的题目牌与若干干扰题目牌混合，发给其余玩家。

因此每轮必然满足：

- 主持人和另外恰好一名玩家看到同一个词。
- 这名玩家称为同伴 `Partner`。
- 主持人不知道谁是同伴。
- 同伴在看到主持人的画之前，也不会由系统告知自己是同伴。
- 其他玩家各自看到不同的干扰词。

所有玩家根据自己的词画一个提示。理想提示不能太直接，否则所有人都会认出同伴；也不能太隐晦，否则主持人与同伴可能无法相认。

画完后，主持人的画单独展示，其余玩家的画按 `A-G` 编号。所有玩家，包括主持人与同伴，都秘密选择一张他们认为和主持人表达同一词语的画。全部提交后同时揭晓并计分。

游戏在规定轮数后结束，总分最高者获胜；并列最高者共同获胜。

## 实体组件及电子版映射

| 实体组件 | 数量 | 电子版映射 |
|---|---:|---|
| 游戏版图 | 1 | 主持人画作区、候选画作网格、计分榜 |
| 题目牌 | 115 | 自制 `subtext_words.json` |
| 数字牌 | 5 | 房间配置 `word_column: 1..5` |
| 猜测标记 | 56，每色 7 枚 | 私密的 `submit_guess(slot_id)` |
| 玩家棋子 | 8 | 玩家列表与分数 |
| 分数标记 | 8 | 整数 `score` |
| 铅笔和画纸 | 每人一份 | 响应式 Canvas 与标准化轨迹数据 |

实体计分轨道只显示有限范围，超过 12 或 24 分时借助分数标记。电子版直接保存非负整数总分，不需要模拟绕圈或翻分数标记。

## 游戏设置

### 人数与轮数

标准轮数取决于玩家人数：

| 玩家数 | 每名玩家担任主持次数 | 总轮数 |
|---:|---:|---:|
| 4 | 2 | 8 |
| 5 | 2 | 10 |
| 6 | 1 | 6 |
| 7 | 1 | 7 |
| 8 | 1 | 8 |

计算方式：

```text
dealer_cycles = 2 if player_count in [4, 5] else 1
total_rounds = player_count * dealer_cycles
```

初始主持人随机决定，之后严格按座位顺时针轮换。4、5 人局完成一整圈后，再以同样顺序进行第二圈。

### 选择题目栏位

实体版开局选择 5 张数字牌中的一张，整局只使用题目牌上对应栏位的词。规则建议第一次游戏使用第 1 栏，第 5 栏尤其困难。

电子版在房间中提供：

```text
Word Set:
  I   Intro
  II  Easy
  III Standard
  IV  Hard
  V   Expert
```

配置字段为 `word_column: 1..5`，默认 `1`。这个选择整局固定，不能中途改变。

### 初始化流程

1. 校验玩家数为 4-8。
2. 加载并校验自制题库。
3. 读取所选 `word_column`，建立本局题目牌 ID 列表。
4. 洗牌形成 `word_deck`，本局用过的题目牌不放回。
5. 随机选择第一名主持人并记录 `first_dealer_index`。
6. 所有玩家分数设为 0。
7. 设置 `round = 1`、`total_rounds` 和 `game_index = 1`。
8. 调用 `start_round()` 产生本轮主持人、同伴、词语分配和空白绘图状态。

## 题库设计

### 推荐文件格式

新增 `game/assets/subtext_words.json`。为了保留实体版“同一张牌有 5 个栏位”的结构，建议格式如下：

```json
{
  "version": 1,
  "cards": [
    {
      "id": "subtext_custom_001",
      "words": {
        "1": {"text": "自制入门词", "bot_template": "object"},
        "2": {"text": "自制简单词", "bot_template": "place"},
        "3": {"text": "自制标准词", "bot_template": "action"},
        "4": {"text": "自制困难词", "bot_template": "event"},
        "5": {"text": "自制抽象词", "bot_template": "abstract"}
      }
    }
  ]
}
```

`bot_template` 是可选的自制机器人提示元数据，不发送给客户端。

### 数量要求

一轮会消耗 `player_count - 1` 张不同题目牌：1 张目标牌和 `player_count - 2` 张干扰牌。标准局各人数的最大消耗为：

| 玩家数 | 总轮数 | 每轮耗牌 | 全局耗牌 |
|---:|---:|---:|---:|
| 4 | 8 | 3 | 24 |
| 5 | 10 | 4 | 40 |
| 6 | 6 | 5 | 30 |
| 7 | 7 | 6 | 42 |
| 8 | 8 | 7 | 56 |

因此自制题库至少需要 56 张完整的五栏题目牌，推荐补足 115 张以接近实体版容量。若所选栏位的有效牌少于本局所需数量，`init_game` 必须拒绝开始并返回明确错误，不能在同一局中静默重洗导致题目重复。

### 内容分层建议

- `I`：具体物体、动物、食物、常见动作，适合第一次游戏。
- `II`：地点、职业、组合物件、日常场景。
- `III`：事件、活动、关系和可多角度联想的名词。
- `IV`：习惯、文化概念、复杂场景和不容易直接画出的词。
- `V`：抽象概念、时代、情绪或需要强联想的题目。

初版应避免依赖特定国家知识的冷门人名、品牌和缩写。每个栏位内的词语经过 `strip + Unicode casefold + 空白归一化` 后必须唯一，避免目标词与干扰词意外完全相同。

现有 `fake_artist_words.json` 和 `draw_guess_prompts.py` 可以作为自制词汇覆盖范围的参考，但不能直接把所有词塞进同一级别：它们以“容易直接画出来”为目标，而本游戏需要从具体到抽象的五档联想难度。

## 每轮秘密发词

设玩家数为 `N`，本轮主持人为 `dealer_id`。

1. 从 `word_deck` 取出 1 张作为 `target_card`。
2. 主持人读取 `target_card.words[word_column].text` 并记为 `target_word`。
3. 再从牌堆取 `N - 2` 张作为干扰牌。
4. 从除主持人外的 `N - 1` 名玩家中均匀随机选择 1 名同伴。
5. 给同伴分配 `target_word`。
6. 洗混干扰牌，并给其余 `N - 2` 人各分配 1 个不同干扰词。
7. 主持人的私有词同样为 `target_word`，但视图中绝不能出现 `partner_id`。

等价伪代码：

```text
target = draw_one_card()
decoys = draw_cards(N - 2)
non_dealers = all_players_except(dealer_id)
partner_id = random_choice(non_dealers)

secret_words[dealer_id] = target.word[column]
secret_words[partner_id] = target.word[column]

shuffle(decoys)
for player_id, card in zip(non_dealers without partner_id, decoys):
  secret_words[player_id] = card.word[column]
```

服务端要保证本轮只有主持人与同伴的标准化词语相同。如果自制数据仍出现重复，应重新抽干扰牌或直接让题库校验失败。

## 绘画阶段

### 基础规则

所有玩家同时为自己的私有词绘制一个提示，包括主持人。

- 不允许写字母或数字。
- 绘画阶段不能通过说话、聊天或手势解释题目。
- 可以直接画词语本身，但通常会让太多人猜中，战略上很差，并非程序应禁止的动作。
- 每名玩家每轮只提交一张画。
- 提交后锁定，不能撤回或修改。
- 所有人提交前，其他人的画都不可见。

游戏没有官方强制倒计时，初版不加入绘画超时，也不需要修改 `app.py` 的定时调度器。

### 轨迹格式

不直接接受任意图片或 SVG。客户端把黑色自由手绘线条序列化为归一化坐标，服务端保存结构化轨迹：

```text
Drawing = Stroke[]
Stroke = Point[]
Point = [x, y]   # x、y 均为 0.0..1.0
```

建议限制：

```text
1 <= stroke_count <= 100
1 <= points_per_stroke <= 300
total_points <= 4000
all coordinates are finite numbers in [0, 1]
```

单点轨迹渲染为圆点。客户端每移动约 2-3 CSS 像素才记录新点，并把坐标保留到最多 4 位小数，防止移动端生成过大的 Socket.IO 消息。

这种格式的优点：

- 不接受外部上传图片，减少题外信息与恶意内容入口。
- 服务端能严格限制大小。
- 所有玩家统一使用白底、黑线和相同线宽，减少身份和设备差异。
- Download Memories 可把经过校验的轨迹安全重建为 SVG，而不嵌入客户端提供的 HTML。

### 同步提交与本地草稿

绘画是同时行动。其他玩家每次提交都会触发新的 `game:state`，因此前端不能在每次收到状态时重置当前玩家尚未提交的 Canvas。

前端应保存：

```text
subtextLocalRoundKey = game_index + ":" + round
subtextLocalStrokes
subtextUndoStack
```

只有在以下情况才清空本地草稿：

- 收到不同的 `game_index/round`。
- 当前玩家的提交已被服务端确认。
- 玩家主动点击 `Reset Canvas`。
- 离开当前游戏面板。

刷新或断线发生在提交前时，本地未发送草稿可能丢失；提交成功后的轨迹由服务端保存，重连后可以恢复只读预览。

### 阶段转换

每次合法提交只广播“某玩家已经提交”的状态，不包含其词语或轨迹。

```text
if every player has submitted a drawing:
  slot_order = shuffled(all player ids except dealer_id)
  assign A, B, C ... to slot_order
  phase = "guessing"
```

主持人的画固定显示在独立区域。其他 `N - 1` 张画进入候选区，4 人局使用 `A-C`，8 人局使用 `A-G`。

## 猜测阶段

### 展示规则

所有客户端看到相同的主持人画作和相同顺序的候选槽位。猜测阶段仍不展示：

- 同伴身份。
- 候选画作者姓名。
- 其他玩家的私有词。
- 其他玩家已经选择的槽位。

候选画作者本人会在自己的客户端看到一个仅本地可见的 `Yours` 标记，以便像实体游戏中一样认出自己的画。主持人不会看到作者标记。

### 提交猜测

每名玩家都必须选择一个候选槽位，包括主持人与同伴。

```text
submit_guess(slot_id)
```

- `slot_id` 必须是当前轮有效的 `A-G` 槽位。
- 非主持玩家可以选择自己的画；同伴要正确得分，实际上必须选中自己的槽位。
- 点击画作只做本地选择与高亮，不立刻提交。
- 点击 `Submit Guess` 后才向服务端提交并锁定。
- 提交后不能更换，避免最后提交者因自动揭晓获得额外修改机会。
- 点击候选网格空白处或按 `Esc` 可以取消尚未提交的本地选择，不增加 `Clear Selection` 按钮。
- 服务端可以公开“谁已提交”的布尔状态和总人数，但不能提前公开选择内容。

当所有人都提交后，服务端原子地进入 `round_result` 并计分。

## 计分

设：

```text
partner_slot = slot assigned to partner_id
correct[player_id] = votes[player_id] == partner_slot
correct_count = number of correct guesses
wrong_count = player_count - correct_count
```

### 主持人与同伴

主持人与同伴只有在两人都猜对时才得分：

```text
if correct[dealer_id] and correct[partner_id]:
  round_points[dealer_id] = wrong_count
  round_points[partner_id] = wrong_count
else:
  round_points[dealer_id] = 0
  round_points[partner_id] = 0
```

注意：即使主持人猜对而同伴猜错，或同伴猜对而主持人猜错，两人都得 0 分。

### 其他玩家

既不是主持人也不是同伴的玩家，只有猜对时得分：

```text
if correct[player_id]:
  round_points[player_id] = wrong_count + 1
else:
  round_points[player_id] = 0
```

额外的 1 分补偿了普通玩家没有共享目标词的难度。

### 边界示例

#### 6 人局，3 人猜对

若主持人、同伴和 1 名普通玩家猜对，则 `wrong_count = 3`：

- 主持人：3 分。
- 同伴：3 分。
- 猜对的普通玩家：4 分。
- 其余玩家：0 分。

#### 所有人都猜对

`wrong_count = 0`：

- 主持人和同伴各得 0 分。
- 每名普通玩家各得 1 分。

这不是程序异常，而是规则刻意惩罚过于明显的提示。

#### 主持人或同伴没有相认

主持人与同伴都得 0 分。仍有猜对的普通玩家时，每人照常获得 `wrong_count + 1` 分；普通玩家的得分不依赖主持人与同伴是否相认。

#### 所有人都猜错

无人得分。

## 回合揭晓与下一轮暂停

计分后进入 `round_result`。按照仓库的每轮交互要求，不能自动开始下一轮。

揭晓页至少显示：

- 本轮目标词。
- 主持人和同伴。
- 每个 `A-G` 槽位的画作者。
- 每名玩家选择了哪个槽位、是否猜对。
- `wrong_count`。
- 每名玩家本轮得分和累计分。
- 所有本轮画作。

除最后一轮外，每名玩家都有：

```text
next_round
```

玩家点击后进入 `next_round_ready` 集合。UI 显示 `Ready 3/6` 和每名玩家的准备状态。只有所有玩家都准备后才：

1. 保存本轮历史快照。
2. 清空当前词语、绘画、槽位、猜测和准备状态。
3. `round += 1`。
4. 按座位顺序设置下一名主持人。
5. 调用 `start_round()`。

机器人自动执行 `next_round`，真人必须主动点击。

最后一轮揭晓后直接进入 `game_over`，最终页同时保留最后一轮明细，不再出现 `Next Round`。

## 游戏结束

标准轮数完成后：

```text
max_score = max(player.score)
winner_ids = [pid for pid if player.score == max_score]
```

- 最高分玩家获胜。
- 最高分并列时共同获胜，没有额外决胜条件。
- `Play Again` 使用相同 `word_column` 开新局，所有分数归零、题目牌重新洗牌、第一主持人重新随机，并递增 `game_index`。

## 推荐服务端状态

```text
GameState:
  game_id: "subtext"
  game_index: integer
  phase: drawing | guessing | round_result | game_over
  config:
    word_column: 1..5
    seed?: string | integer

  rng_seed: string
  rng_counter: integer
  word_deck: card_id[]
  used_card_ids: card_id[]

  turn_order: player_id[]
  first_dealer_index: integer
  dealer_id: player_id
  partner_id: player_id
  round: integer
  total_rounds: integer

  players:
    player_id:
      score: integer
      is_bot: boolean

  secret_assignments:
    player_id:
      card_id: string
      word: string

  drawings:
    player_id: Drawing | null

  slot_order: player_id[]
  slot_by_player: map<player_id, "A".."G">
  votes: map<player_id, slot_id>
  next_round_ready: player_id[]

  last_round_summary: RoundSummary | null
  round_history: RoundSummary[]
  winner_ids: player_id[]
  game_over: boolean
  player_meta: map<player_id, metadata>
  game_start_time: timestamp
```

`seed` 只用于确定性测试或复现；正常开局由服务端产生不可预测的 `rng_seed`。客户端视图和实时事件都不能包含 `rng_seed`、`rng_counter`、未来牌堆或未揭晓的秘密分配。

不要把 Python `random.Random` 对象直接放进状态。可实现 `_next_rng(state, purpose)`，以 `rng_seed + rng_counter + purpose` 派生一次性 RNG 并递增计数，使存档加载后的后续随机结果可复现。

## RoundSummary

```text
RoundSummary:
  round: integer
  dealer_id: player_id
  partner_id: player_id
  target_word: string
  partner_slot: slot_id
  wrong_count: integer
  slots:
    - slot_id
      player_id
      drawing
  guesses:
    player_id:
      slot_id
      correct
  round_points: map<player_id, integer>
  scores_after_round: map<player_id, integer>
```

当前轮开始后，上一轮完整秘密分配不必继续留在顶层状态；需要复盘的公开结果进入 `round_history`。干扰词可保存在仅服务端历史中供 Download Memories 使用，但实时 `last_round_summary` 默认只揭晓目标词，以贴近实体规则。

## 合法行动与 Action Schema

新增 `SUBTEXT_ACTION_SCHEMA`：

```text
submit_drawing:
  type: "submit_drawing"
  strokes: Stroke[]

submit_guess:
  type: "submit_guess"
  slot_id: "A".."G"

next_round:
  type: "next_round"

play_again:
  type: "play_again"
```

新增 `SUBTEXT_CONFIG_SCHEMA`：

```text
word_column: integer, minimum 1, maximum 5, default handled by module
seed: optional integer or non-empty string, max length 80
additionalProperties: false
```

### `submit_drawing` 校验

- 当前阶段必须是 `drawing`。
- 玩家必须存在且尚未提交。
- `strokes` 必须符合 JSON Schema。
- 服务端再次校验总笔画数、总点数、每笔点数、有限数值和坐标范围。
- 不接受客户端自报的玩家 ID、词语、颜色、作者名或完成状态。
- 重复提交返回 `drawing already submitted`，不能覆盖原图。

### `submit_guess` 校验

- 当前阶段必须是 `guessing`。
- 玩家尚未提交猜测。
- `slot_id` 必须在本轮 `slot_by_player.values()` 中。
- 玩家可以选择自己的槽位。
- 不接受客户端传入 `partner_id`、正确与否或分数。
- 重复提交返回 `guess already submitted`。

### `next_round` 校验

- 当前阶段必须是 `round_result`。
- 当前轮不能是最后一轮。
- 玩家尚未准备。
- 只有所有玩家都在准备集合中时才开始下一轮。

### `play_again` 校验

- 只能在 `game_over` 执行。
- 完整重置比分、牌堆、历史和所有当前轮秘密数据。
- 保留合法的房间配置和玩家座位信息。

## `get_legal_actions`

```text
if phase == drawing and own drawing is null:
  ["submit_drawing"]

if phase == guessing and player has not voted:
  ["submit_guess"]

if phase == round_result and player is not ready:
  ["next_round"]

if phase == game_over:
  ["play_again"]
```

所有其他情况返回空列表。客户端按钮状态只用于提示，服务端必须独立执行同样校验。

## 分客户端公开视图

### 所有阶段都可公开

- 游戏 ID、阶段、轮数、总轮数和所选 Word Set。
- 主持人的玩家 ID、姓名和座位。
- 所有玩家姓名、座位、机器人标记和累计分。
- 每名玩家是否已经提交当前阶段动作。
- 当前查看者的合法行动。

### `drawing`

只向查看者公开：

- `your_word`。
- 自己已提交后的 `your_drawing`，用于重连恢复。
- 全体玩家的 `drawing_submitted: true/false`。

绝不能公开：

- `partner_id`。
- 任何其他玩家的词。
- 任何其他玩家的轨迹。
- 目标牌与干扰牌身份。

### `guessing`

公开：

- 主持人的画。
- `A-G` 候选画作。
- 查看者自己的候选画上有 `is_yours: true`。
- 查看者自己的私有词。
- 各玩家是否已提交猜测。

绝不能公开：

- 候选画作者 ID 或姓名。
- 同伴槽位。
- 他人的猜测槽位。
- 正确人数或错误人数。

### `round_result` 与 `game_over`

公开完整 `last_round_summary`，包括同伴、槽位作者、所有猜测和得分。`game_over` 额外公开 `winner_ids`。

## 隐私实现检查表

`get_public_view` 是本游戏最重要的边界。实现和评审时逐项检查：

- 主持人的视图中没有 `partner_id` 或能直接推导同伴的卡牌 ID。
- 非主持人的视图中没有“你是同伴”布尔值。
- 绘画阶段不会因为别人的 Socket.IO 更新泄露画作。
- 猜测阶段候选项没有作者字段，只有本人可见的 `is_yours`。
- 猜测提交事件没有 `slot_id`。
- `events` 只发送不含秘密的阶段通知与提交状态。
- 日志在揭晓前不记录秘密词、同伴或猜测内容。
- Download Memories 在游戏进行中不能成为旁路泄密接口。

## 推荐事件

不新增独立 Socket.IO handler，继续走通用 `game:action` 和 `game:state`。

`apply_action` 可返回以下无秘密事件：

```text
subtext:round_started
subtext:drawing_submitted      { player_id }
subtext:guessing_started
subtext:guess_submitted        { player_id }
subtext:round_scored
subtext:next_round_ready       { player_id }
subtext:game_over
subtext:play_again
```

`subtext:drawing_submitted` 不能附带轨迹，`subtext:guess_submitted` 不能附带槽位。

## 机器人行为

为了让有机器人座位的房间不会卡死，`SubtextGame.bot_move` 至少支持：

- `drawing`：根据机器人自己的私有词生成合法的归一化轨迹。
- `guessing`：只分析猜测阶段已经公开的主持人画和候选画，返回一个有效槽位。
- `round_result`：自动 `next_round`。
- `game_over`：不自动重开。

建议的无模型初版：

1. 对词语或题库中的 `bot_template` 做稳定哈希，选择圆形、房屋、树、人物、箭头组合等自制模板。
2. 以玩家 ID 为盐加入轻微旋转、缩放和抖动，使同词画作相似但不完全相同。
3. 猜测时比较公开轨迹的笔画数、包围盒、重心和线段方向直方图，选择与主持人画最接近的候选项。
4. 平局时随机选择。

机器人猜测逻辑不得直接读取 `partner_id`、`partner_slot` 或其他玩家的秘密词来作答。建议把决策函数设计成只接收 `SubtextGame.get_public_view(state, bot_id)` 的结果，从接口上隔离答案。若初版不实现图形相似度，可以明确采用随机合法槽位作为降级方案。

## 前端布局与交互

### 房间配置

新增 `subtextConfigBox`，只在大厅且当前游戏为 `subtext` 时展示。

- 标题：`Subtext`。
- 单行放置 `Word Set` 标签与 `I-V` 下拉框。
- 默认 `I (Intro)`。
- 不暴露调试用随机种子。

### 顶部状态

紧凑显示：

```text
Round 3/8   Phase: Drawing   Dealer: Alice   ✏️ Submitted 2/4
```

游戏内容可使用中文词语；房间、状态、按钮等非游戏内容遵守 `FRONTEND.md`，使用英文。

### 绘画阶段

- 私有词卡置于最醒目位置，使用 `🔒 Your Word` 标识。
- 词卡下方反复提示 `Draw a hint. No letters or numbers.`。
- 画布固定内部比例 `4:3`，CSS 宽度为 `min(100%, 640px)`。
- 只使用黑色画笔和统一线宽。
- 提供 `Undo`、`Reset Canvas`、`Submit Drawing`。
- `Submit Drawing` 在没有有效轨迹时禁用。
- 提交前显示一次轻量确认，说明提交后不能修改；不要使用浏览器原生阻塞式 `confirm`。
- 提交后用只读缩略图和 `Submitted ✓` 取代可编辑画布。
- 玩家列表显示每人 `Drawing…` 或 `Submitted ✓`，不显示画作。

### 猜测阶段

- 主持人的画固定放在顶部大卡片中，标题 `Dealer's Drawing`。
- 候选画作使用统一尺寸的 `A-G` 卡片网格。
- 当前玩家自己的卡片显示小型 `Yours` 徽标，其他人没有作者信息。
- 点击卡片设置 `aria-pressed` 和明显的边框高亮。
- `Submit Guess` 与已选槽位同行显示，在移动端也避免占满多行。
- 猜测提交后锁定网格，显示 `Guess submitted ✓` 和全员提交进度。

### 回合揭晓

- 高亮正确的同伴画作与主持人画作。
- 在每张候选画上显示作者名、是否为 Partner 和收到的猜测者。
- 计分表显示 `Player / Guess / Correct / Round / Total`。
- 分数区或记录区过长时必须可以滚动。
- `Next Round` 显示全员准备进度，只有点击者自己的按钮进入已准备状态。
- 最终页显示冠军或并列冠军，并保留最后一轮回顾。

### 移动端

- 画布应充分利用屏幕宽度，不能因为固定 640 像素而横向溢出。
- 为 Canvas 设置 `touch-action: none`，使用 Pointer Events 统一鼠标、触摸和触控笔。
- 候选图默认两列；窄屏降为一列，不缩成难以辨认的小图。
- `Undo` 与 `Reset Canvas` 同行，`Submit Drawing` 可独占下一行。
- 画作详情 Modal 支持点击遮罩和 `Esc` 退出。

## Help 与 Explain

必须完整遵守 `designs/task40.md`。

### Help

Help 对话框说明：

- 主持人和一名未知同伴拥有同一个词。
- 所有人同时画间接提示。
- 禁止字母、数字和讨论题目。
- 所有人猜哪张画属于同伴。
- 主持人与同伴必须双双猜对才得分。
- 普通玩家猜对获得 `错误人数 + 1` 分。
- 标准轮数和并列胜利。

### Explain

至少为以下控件提供说明：

- `Undo`
- `Reset Canvas`
- `Submit Drawing`
- `Submit Guess`
- `Next Round`
- `Play Again`

解释模式使用捕获阶段拦截按钮功能；已经 disabled 的按钮仍可通过 `pointerdown + 坐标检测` 查看说明。进入解释模式时还要暂停 Canvas 的指针输入，防止用户在查看说明时意外画线。点击有说明的控件后自动退出，按 `Esc` 也可退出。

## Download Memories

新增 `build_memories_html`，使用 `game.memories` 中的共享 HTML 工具。

已完成轮次可包含：

- 主持人、同伴和目标词。
- 全部画作。
- 槽位与作者映射。
- 全部猜测。
- 本轮分数与累计分。
- 最终排行榜。

轨迹由服务端转成安全 SVG：只生成固定白底、固定黑色 `<path>` 和 `<circle>`，所有数字来自已校验坐标，不拼接客户端 HTML。

游戏尚在进行时：

- 可以导出已经揭晓的历史轮次。
- 当前 `drawing` 或 `guessing` 轮不得输出同伴、他人私有词、未公开画作、未揭晓猜测或未来题目牌。
- 当前轮未揭晓内容应显示为 `Round in progress`。

这项限制必须单独测试，避免 Memories 下载成为绕过 `get_public_view` 的作弊入口。

## 代码落点

### 后端

新增：

- `game/subtext.py`
- `game/assets/subtext_words.json`
- `tests/test_subtext_game.py`

修改：

- `game/definitions.py`
  - 导入 `SubtextGame`。
  - 添加 `SUBTEXT_ACTION_SCHEMA` 和 `SUBTEXT_CONFIG_SCHEMA`。
  - 以 `turn_mode="simultaneous"` 注册。
- `game/dev_order.json`
  - 注册后运行 `python scripts/gen_dev_order.py`，不要手工猜序号。
- `scripts/bgg_weight_scrape.py`
  - `GAME_URLS["subtext"] = "https://boardgamegeek.com/boardgame/265684/subtext"`。

`SubtextGame` 实现仓库统一接口：

```text
game_id = "subtext"
min_players = 4
max_players = 8

init_game(config, players)
get_legal_actions(state, player_id)
apply_action(state, player_id, action)
get_public_view(state, viewer_id)
bot_move(state, bot_id)
serialize(state)
deserialize(payload)
download_memories(state, room_id=None)
```

不需要新增专用 Socket.IO 事件或 `app.py` 计时任务。

### 前端

新增：

- `static/games/subtext.js`

修改：

- `static/index.html`
  - 游戏下拉框增加 `Subtext`。
  - 增加配置卡、Help/Explain 按钮、游戏面板和两个 Modal。
  - 加载 `/static/games/subtext.js`。
- `static/app.js`
  - 缓存 `subtextPanel`。
  - 在 `setGamePanelVisibility` 中切换面板和 Header Actions。
  - 在 `game:state` 分发处调用 `renderSubtextGameState(data)`。
  - 游戏切换时调用 `clearSubtextState()`。
- `static/games/shared.js`
  - `emitRoomStart()` 中读取 `subtextWordColumnSelect` 并发送 `{word_column}`。
  - 在共享配置可见性刷新流程中调用 `updateSubtextConfigRow()`。
- `static/room.js`
  - `GAME_WEIGHT.subtext = 1.29`，最终值以抓取脚本结果为准。
  - 新建房间时把 Word Set 恢复为默认值。
- `static/style.css`
  - 增加 `subtext-` 前缀的画布、候选网格、词卡、玩家状态、计分表、Modal 和移动端样式。

浏览器全局中的变量和函数统一使用 `subtext` 或 `Subtext` 前缀。可以用 IIFE 隐藏内部帮助函数，只向 `window` 暴露仓库需要调用的少量入口，例如：

```text
renderSubtextGameState
clearSubtextState
showSubtextHeaderActions
updateSubtextConfigRow
```

## 测试计划

### 规则与状态机单元测试

1. `4/5/6/7/8` 人局分别得到 `8/10/6/7/8` 个标准轮次。
2. 每轮恰好消耗 `N - 1` 张题目牌，整局不重复使用卡牌。
3. 每轮恰好两人拿到目标词：主持人和一名非主持玩家。
4. 所有干扰词彼此不同，且不等于目标词。
5. 主持人按座位顺序轮换；4、5 人局每人恰好主持两次。
6. 未全部提交绘画时保持 `drawing`；最后一人提交后进入 `guessing`。
7. 候选槽位数量为 `N - 1`，每名非主持玩家恰好出现一次，主持人不在候选槽位中。
8. 非法坐标、NaN/Infinity、过多笔画、过多点、空画和重复提交被拒绝。
9. 未全部提交猜测时保持 `guessing`；最后一人提交后只结算一次。
10. 无效槽位和重复猜测被拒绝。

### 计分测试

11. 主持人与同伴都猜对时，各得 `wrong_count`。
12. 两人中任意一人猜错时，两人都得 0 分。
13. 普通玩家猜对时得 `wrong_count + 1`。
14. 普通玩家猜错时得 0 分。
15. 所有人猜对时主持人与同伴得 0，普通玩家各得 1。
16. 所有人猜错时所有人得 0。
17. 多轮累计分正确，不会重复应用同一轮得分。

### 隐私测试

18. `drawing` 阶段每个玩家只能看到自己的词和自己已提交的画。
19. 主持人视图没有同伴 ID、同伴槽位或目标卡 ID。
20. 非主持玩家视图没有 `is_partner` 字段。
21. `guessing` 阶段候选画没有作者 ID；只有作者自己的视图出现 `is_yours`。
22. 揭晓前其他玩家的猜测槽位不会出现在视图和事件中。
23. `round_result` 后才公开同伴、作者映射和猜测明细。
24. 进行中的 Memories 导出不会泄露当前轮秘密。

### 回合与结束测试

25. 一名玩家点击 `next_round` 不会提前开下一轮。
26. 所有人点击后才开下一轮，并清空画作、槽位、猜测与准备状态。
27. 最后一轮后进入 `game_over`，不再提供 `next_round`。
28. 最高分玩家正确获胜；同分时返回多个 `winner_ids`。
29. `play_again` 重置比分与历史，保留 Word Set，递增 `game_index`。
30. 序列化再反序列化后可继续当前阶段，隐藏信息和随机计数器不丢失。

### 机器人与前端测试

31. 机器人在每个可行动阶段都返回符合 Schema 的动作，不会卡住同时行动阶段。
32. 机器人猜测不读取同伴真值作为答案。
33. 收到其他玩家提交状态时，本地未提交 Canvas 不会被清空。
34. 鼠标、触摸和触控笔都能绘画；页面不会随手指绘画滚动。
35. 移动端候选图不横向溢出，画作仍可辨认。
36. Help、Explain、disabled 按钮解释、遮罩点击和 `Esc` 行为符合 `task40.md`。
37. `tests/test_frontend_script_names.py` 保持通过。

## 验证命令

```bash
python scripts/gen_dev_order.py
python scripts/bgg_weight_scrape.py
python -m unittest tests.test_subtext_game
python -m unittest tests.test_frontend_script_names
python -m unittest tests.test_game_dev_order
python -m unittest
```

前端还需手工验证 4 人和 8 人房间各一局，至少覆盖一个手机窄屏和一个桌面宽屏。

## 推荐实施顺序

1. 先完成自制题库格式、校验器、确定性 RNG 和秘密发词测试。
2. 实现 `SubtextGame` 状态机、公开视图和计分，并先把隐私测试跑绿。
3. 加入注册、Action/Config Schema、开发顺序和 BGG Weight。
4. 实现独立的 `subtext.js`、Canvas 本地草稿、候选画网格和结果页。
5. 按 `task40.md` 补齐 Help/Explain，再完成响应式 CSS。
6. 实现机器人降级行为和安全的 Memories 导出。
7. 跑完整单元测试，并执行多人、多设备和断线重连手工验收。

## 完成标准

- 4-8 人均能按标准轮数完整游玩。
- 每轮只有主持人与一名未知同伴共享目标词。
- 所有画在全员提交前保持秘密，所有猜测在全员提交前保持秘密。
- 计分覆盖主持人/同伴双重成功条件及普通玩家额外 1 分。
- 每轮结算后全员确认才进入下一轮。
- 最终并列胜利处理正确。
- Canvas 在移动端可用，实时状态更新不会清除本地草稿。
- Help/Explain、英文通用 UI、滚动区域和 `Esc` 行为符合前端规范。
- 未使用官方题库或商业美术，所有随附词语和图形来源清楚。
- 单元测试、前端脚本命名测试和开发顺序测试全部通过。
