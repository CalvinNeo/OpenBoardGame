# Task 90 — Kronologic: Paris 1920（时空神探：巴黎 1920）实现方案

## 1. 任务结论

在 OpenBoardGame 中新增 `Kronologic: Paris 1920`，内部游戏 ID 使用 `kronologic`，中文名使用《时空神探：巴黎 1920》。

首版范围：

- 支持 1–4 人；1 人使用独立调查评分，2–4 人使用竞速推理规则。
- 实现 6 名人物、6 个地点、6 个时段、相邻地点强制移动、地点 + 时段询问、地点 + 人物询问、公开线索、个人私密线索、无额外私密信息时的立即再行动、秘密提交答案、同时答题、答错淘汰、全员答错和共同获胜。
- 提供 5 个固定、经过程序校验的 `original-compatible-v1` 原创兼容案件；不复制商业版 3 个场景、15 个案件的故事、起始布局、行动轨迹、答案、卡面表格或插画。
- 服务端权威保存案件真相、未公开线索、每位玩家的私密线索、个人笔记、答题内容与结果；每个客户端只收到自己有权查看的内容。
- 支持 Bot、断线重连、房间存档、Play Again 和确定性案件数据。
- 创建房间时可选择 `中文` 或 `English`，默认中文；所选语言写入服务端状态，并统一控制案件故事、人物/地点名、阶段、操作、线索、日志、Help、Explain 与结算界面，重连后保持不变。
- 每次询问后进入 `clue_review`，所有仍在场的真人点击 **Ready for Next Turn** 后才继续；Bot 自动确认。这样既保留实体规则中的记笔记时间，也满足 `FRONTEND.md` 的轮次停顿要求。
- 严格遵守 `FRONTEND.md`：主要逻辑放在 `static/games/kronologic.js`，暴露到全局的名称全部带 `kronologic` 前缀；使用 Emoji、文字、颜色和纹理共同表达；无横向页面滚动；移动端紧凑；点击空白取消询问选择；Esc 关闭弹窗/退出 Explain；实现 `designs/task40.md` 的完整 Help / Explain 行为。
- 不使用商业 Logo、封面、巴黎歌剧院平面图、人物插画、地点卡、穿孔板、规则书版式或字体。首版使用原创剧院地点、人物与 CSS 几何图。

## 2. 游戏识别、来源与版本边界

### 2.1 基本信息

- 英文名：`Kronologic: Paris 1920`
- 中文发行名：《时空神探：巴黎 1920》
- 设计者：Fabien Gridel、Yoann Levet
- 美术：Arch Apolar、Yann Valeani
- 出版：Origames、Super Meeple
- 玩家人数：1–4 人（官方规则包含单人模式）
- 时长：约 30 分钟
- 年龄：10+
- BoardGameGeek ID：`402111`
- BGG：<https://boardgamegeek.com/boardgame/402111/kronologic-paris-1920>
- Origames 官方产品页：<https://www.origames.fr/produit/kronologic-paris-1920/>
- Origames 官方法文规则：<https://www.origames.fr/wp-content/uploads/2023/12/KRO1920_Regles.pdf>
- Hachette 官方英文产品页：<https://www.hachetteboardgames.com/products/kronologic>

截至 2026-09-17，BGG 显示 Weight 约为 `2.05 / 5`。落地时将 BGG URL 加入 `scripts/bgg_weight_scrape.py` 并运行脚本，再把当次结果写入 `static/room.js`；本文数值不是永久常量。

### 2.2 已确认的官方核心规则

- 每个案件围绕 6 名人物、6 个地点、6 个时段展开。
- 案件给出全部或部分人物在时段 1 的公开起始位置。
- 除案件特殊规则另有说明外，每个人物在相邻时段间必须移动到一个有通道连接的相邻地点，不能连续两个时段停在同一地点。
- 回合中只能把一个地点与一个时段，或一个地点与一个人物组合；不能直接询问“人物 + 时段”。
- `地点 + 时段`：所有人得知该时段该地点的人数；当前调查员额外私密得知其中一名人物。
- `地点 + 人物`：所有人得知该人物在 6 个时段中到过该地点几次；当前调查员额外私密得知其中一个具体时段。
- 若一次询问没有给当前调查员带来比其他人更多的信息，当前调查员在所有人记完笔记后立即再行动。
- 玩家可在认为已经解开案件时停止调查并秘密回答全部问题。答对者获胜；答错者淘汰，但不能把正确答案泄露给其他人。
- 多名玩家可以在同一个答题时机提交答案并共同获胜；所有人答错则全体失败。
- 单人游戏同时获得公开与私密信息，并按使用的询问次数评定成绩。

### 2.3 数字版明确裁定

实体规则没有定义网络并发、重连和数据投影，首版统一如下：

- 座位号升序视为顺时针。先手使用服务端随机源选择并写入公开日志。
- 首版所有原创案件公开 6 名人物在时段 1 的位置；时段 1 之后每一步严格沿原创地图的一条边移动。
- 同一询问永远返回同一个私密值。若候选不止一个，案件加载时用案件 ID、地点和选择项生成稳定顺序，避免刷新、重连或重复询问时改变答案。
- 公开计数为 `0` 或 `6` 时，私密值不会提供额外信息，标记 `bonus_turn=true`；完成线索查看确认后仍由原玩家行动。其他计数总会提供一个实际人物或时段。
- 允许重复询问同一组合；UI 会显示已问次数，但不擅自禁止实体规则允许的低效行动。
- 每次询问后进入 `clue_review`。所有未淘汰真人都确认后才切换到下一回合；Bot 自动确认。等待名单必须公开显示。
- 任意未淘汰玩家只能在自己的行动阶段发起 `Make Accusation`。发起者必须提交答案；其他未淘汰玩家随后选择 `Join with Answer` 或 `Decline`。
- 服务端等所有人响应后一次性校验，校验前不向任何客户端暴露对错。只要至少一人答对，所有同批答对者共同获胜并结束案件；答错者不获胜。
- 若本批无人答对，所有提交错误答案的人淘汰，选择 Decline 的玩家继续。结果进入确认停顿，幸存真人确认后从发起者的下一名幸存玩家继续。
- 若无人幸存，案件失败并公开完整轨迹与答案。
- 单人模式提交错误答案即失败；提交正确答案后按案件内的询问次数阈值授予 Gold / Silver / Bronze。
- 个人结构化笔记保存在服务端，因此断线重连和房间存档不会丢失；笔记修改不是回合行动，不改变当前玩家。
- 公开事件中只能写公开计数、谁获得了私密线索、确认状态与胜负；禁止把私密值塞进广播 `events`。

## 3. 内容与素材边界

### 3.1 不可直接复用

不得从规则书、商品页、BGG、实体扫描或 Tabletop Simulator 模组中提取并提交：

- 商业版 Logo、封面、标题字体、人物或地点插画。
- 巴黎歌剧院官方游戏地图、房间图标、通道布局与笔记纸版式。
- 6 张人物穿孔板、6 张时段穿孔板、90 张地点卡的正反面图或数值表。
- 3 个商业场景、15 个商业案件及扩展案件的故事、特殊规则、初始位置、行动轨迹、问题和答案。
- 官方卡背、信封、屏风、解答页、宣传图与产品摄影。

规则机制可以实现，但首版 UI 和案件内容必须自行设计。

### 3.2 首版原创兼容包

新增 `game/assets/kronologic_cases.json`，顶层元数据：

```json
{
  "schema_version": 1,
  "catalog_id": "original-compatible-v1",
  "catalog_status": "original-compatible",
  "commercial_scenarios_included": false,
  "cases": []
}
```

首版包含 5 个固定案件，难度从 1 到 3 星递进。共同目标模板为原创的“密封乐谱交接”：一名指定人物在时段 2–6 中恰好有一次只与另一人同处一室，玩家需要找出另一人、地点和时段。故事、角色、地点、路径和答案均为项目原创，不使用商业案件数据。

UI 和 Help 固定显示：

```text
Original Case Pack · Not the commercial scenarios
```

后续如取得明确授权的数据包，应使用新的 `catalog_id`，保留来源、版本与复核信息；不能静默替换本包或把原创案件改标为官方案件。

## 4. 原创组件设计

### 4.1 人物

人物同时使用 Emoji、本地化角色名、本地化短代号和不同 CSS 纹理，不能只靠颜色区分：

| ID | 英文显示 / 代号 | 中文显示 / 代号 | 辅助纹理 |
| --- | --- | --- | --- |
| `archivist` | 📚 Archivist / AR | 📚 档案管理员 / 档 | 横线 |
| `conductor` | 🎼 Conductor / CO | 🎼 指挥家 / 指 | 斜线 |
| `engineer` | 🧰 Engineer / EN | 🧰 工程师 / 工 | 点阵 |
| `patron` | 🎩 Patron / PA | 🎩 赞助人 / 赞 | 菱格 |
| `singer` | 🎤 Singer / SI | 🎤 歌唱家 / 歌 | 波纹 |
| `courier` | ✉️ Courier / CU | ✉️ 信使 / 信 | 交叉线 |

### 4.2 地点与原创地图

| ID | 显示 |
| --- | --- |
| `grand_hall` | ✨ Grand Hall |
| `archive` | 📚 Archive |
| `rehearsal` | 🎼 Rehearsal Room |
| `backstage` | 🎭 Backstage |
| `dressing_room` | 🪞 Dressing Room |
| `orchestra_pit` | 🎻 Orchestra Pit |

无向边：

```text
Grand Hall — Archive
Grand Hall — Rehearsal Room
Grand Hall — Backstage
Archive — Dressing Room
Rehearsal Room — Orchestra Pit
Backstage — Dressing Room
Backstage — Orchestra Pit
```

该图与商业版歌剧院图无关。前端使用响应式 CSS / 内联 SVG 几何线条绘制，不引入图片素材。

### 4.3 时段

时段统一显示为 `🕐 Time 1` 到 `🕕 Time 6`。时段 1 的公开位置直接写入所有人的笔记初始状态；询问仍可选择时段 1。

## 5. 案件数据与校验

### 5.1 案件结构

```json
{
  "case_id": "sealed-score-01",
  "title": "The Missing Cue",
  "difficulty": 1,
  "story": "...",
  "anchor_character_id": "archivist",
  "paths": {
    "archivist": ["archive", "grand_hall", "rehearsal", "orchestra_pit", "backstage", "dressing_room"]
  },
  "solo_thresholds": {"gold_max": 8, "silver_max": 13}
}
```

`paths` 的索引 0–5 对应 Time 1–6。答案由路径计算，不在同一文件中重复手填，避免答案与轨迹漂移。

### 5.2 启动校验

加载目录时必须拒绝以下数据：

- 顶层 schema、catalog 状态或案件数量错误。
- 案件 ID 重复、标题为空、难度或单人阈值非法。
- 人物不是固定 6 人、路径不是恰好 6 个合法地点。
- 相邻时段停在原地，或移动不在地图边集合内。
- 时段 1 缺失公开位置。
- 指定人物在 Time 2–6 没有或有多于一次“房间总人数恰好为 2”的会面，导致答案不存在或不唯一。
- 两个案件的完整路径签名完全相同。
- 任何询问的公开计数与路径不一致，或私密值不属于真实候选。

生成工具 `scripts/gen_kronologic_cases.py` 只用于生成和验证固定目录；开局不临时随机生成真相。生产目录受版本控制，保证测试、存档和复盘稳定。

## 6. 询问解析器

### 6.1 地点 + 时段

输入：`location_id`, `time=1..6`。

```text
occupants = 所有 path[time - 1] == location_id 的人物
public_count = len(occupants)
private_character_id = stable_pick(occupants)，但 count 为 0 或 6 时为 null
bonus_turn = public_count in {0, 6}
```

公开文字示例：`📣 2 people were in 🎼 Rehearsal Room at 🕒 Time 3.`

仅询问者看到：`🔒 🎤 Singer was one of them.`

### 6.2 地点 + 人物

输入：`location_id`, `character_id`。

```text
times = 所有 path[index] == location_id 的 index + 1
public_count = len(times)
private_time = stable_pick(times)，但 count 为 0 或 6 时为 null
bonus_turn = public_count in {0, 6}
```

公开文字示例：`📣 ✉️ Courier visited 🎭 Backstage 2 times.`

仅询问者看到：`🔒 One visit was at 🕓 Time 4.`

### 6.3 稳定私密值

`stable_pick` 不使用 Python 进程随机哈希。对 `catalog_id | case_id | query_type | location_id | selector_id` 做 SHA-256，取整数模候选长度。相同案件、相同问题在存档恢复、服务器重启和不同 Python 版本下必须返回相同值。

## 7. 状态机

```text
investigation
  ├─ ask ───────────────> clue_review ── all ready ──> investigation
  └─ start_accusation ──> accusation_collect
                              ├─ any correct ────────> case_result (game over)
                              ├─ all eliminated ─────> case_result (game over)
                              └─ survivors ──────────> accusation_review
                                                        └─ all ready ─> investigation
```

核心状态：

```python
{
    "version": 1,
    "config": {...},
    "case": {"case_id": ..., "paths": ...},       # 服务端秘密
    "phase": "investigation",
    "active_player_id": "p1",
    "turn_number": 1,
    "pending_next_player_id": None,
    "bonus_turn": False,
    "review_ready": [],
    "public_clues": [],
    "players": {
        "p1": {
            "status": "active | eliminated | winner",
            "private_clues": [],
            "notes": {...},
            "question_count": 0,
            "accusation_response": None
        }
    },
    "accusation": None,
    "winners": [],
    "game_over": False,
    "public_log": []
}
```

所有历史数组设置上限，防止重复询问或笔记更新导致存档无界增长：公开日志 120 条、公开线索 96 条、每人私密线索 96 条。

## 8. 动作协议与合法性

### 8.1 游戏动作

- `ask`
  - 字段：`query_type`, `location_id`, `time` 或 `character_id`。
  - 仅 `investigation` 阶段的当前未淘汰玩家可用。
  - `query_type=time` 禁止携带 `character_id`；`query_type=character` 禁止携带 `time`。
- `start_accusation`
  - 字段：`character_id`, `location_id`, `time`。
  - 仅当前玩家可用；答案先保存，不能立刻验证或返回对错。
- `join_accusation`
  - 同一答案字段；仅 `accusation_collect` 中尚未响应的其他未淘汰玩家可用。
- `decline_accusation`
  - 无额外字段；发起者不可 Decline。
- `ready_next_turn`
  - 仅 `clue_review` 或 `accusation_review` 可用；重复点击幂等。
- `set_note_mark`
  - 字段：`time`, `location_id`, `character_id`, `mark`。
  - `mark` 只允许 `unknown | possible | excluded | confirmed`。
  - 活跃或淘汰玩家均可维护自己的笔记；只写自己的数据，不推进回合。
- `set_note_count`
  - 字段：`query_type`, `location_id`, `time/character_id`, `count`。
  - `count` 允许 `null` 或整数 0–6；不接受自由文本。
- `play_again`
  - 仅游戏结束后使用，沿用当前设置重新开局；随机案件配置应避免紧接着重复同一案件。

所有 schema 使用 `additionalProperties: false`，字符串 ID 使用 enum 或严格 pattern；服务端仍需做状态级校验，不能只依赖 JSON Schema。

### 8.2 回合与淘汰

- 寻找下一玩家时跳过 `eliminated`。
- `bonus_turn` 的询问者只要仍 active，下一玩家仍是自己。
- 淘汰者不再阻塞 `ready_next_turn` 与答题收集，但仍能查看已有线索和个人笔记。
- Bot 的 ready 动作即时完成；Bot 不应制造人为延迟。

## 9. 隐私与防泄漏

`get_public_view(state, viewer_id)` 是唯一网络投影入口：

- 所有人可见：案件标题/故事/难度、原创包标记、地图、人物、时段 1 公开位置、公开线索、当前阶段、当前玩家、确认名单、玩家状态、问题计数、公开日志。
- 仅本人可见：自己的私密线索、结构化笔记、自己当前尚未结算的答题内容、自己答错后的私密结果。
- 游戏结束前绝不可见：`paths`、计算答案、未询问线索矩阵、其他玩家的私密线索/笔记/答案、Bot 的私密推理状态。
- 游戏结束后公开完整 6 × 6 轨迹与标准答案，便于复盘。
- `events` 只发送公开事件。私密线索通过每玩家不同的 `view` 返回。
- `serialize` 可保存完整服务器状态；`deserialize` 必须重新校验 schema 版本、目录 ID 和案件 ID，不能信任被编辑的存档。

新增专门的泄漏测试：将每位玩家 view 深度序列化为 JSON，断言其中不出现其他玩家的私密值、笔记、答案或秘密路径片段。

## 10. Bot 设计

Bot 必须像真人一样只使用公开线索和自己的私密线索，不能读取答案后伪装推理。

实现方式：

1. 预生成每名人物从公开 Time 1 起点出发的全部合法 6 步路径。
2. 用公开计数、Bot 私密具体值和移动约束维护候选世界/候选答案集合。
3. 依次确认案件主角的到访次数、可能会面时段的地点人数，再补问可能对象；所有选择只依赖 Bot 可见投影，并排除自己已经问过的组合。
4. 当候选答案只剩 1 个时，在自己的回合发起答题；进入他人答题窗口时，只有候选答案唯一才 Join，否则 Decline。
5. 合法路径按公开起点预生成并缓存；固定询问顺序与候选约束保证 Bot 回合有界、可复现。
6. 路径候选只在服务端按 Bot 自己的可见线索即时计算，`get_public_view` 不返回。

测试必须通过给 Bot 注入两个只有秘密路径不同、但其可见线索完全相同的状态，断言它选择同一动作，证明没有偷看答案。

## 11. 前端交互

### 11.1 桌面布局

桌面使用两列、移动端改为单列：

- 左侧：案件标题/状态、当前行动者、原创地图、地点选择、询问组合器与动作按钮。
- 右侧：最新线索、结构化 Notebook、按询问绑定的公开/私密线索历史、玩家状态。

地图节点是可访问的 `<button>`，通道是无交互的 CSS / SVG 线。节点显示 Emoji、地点名和 Time 1 的公开起始人物，不复制商业地图。

### 11.2 询问组合器

1. 点击一个地点。
2. 在 `Time` / `Character` 两个紧凑 Tab 中选一种。
3. 选择一个时段或人物。
4. 点击 `Ask`。

选中的地点和选择项在同一摘要条显示，例如：

```text
🎼 Rehearsal Room + 🕒 Time 3
```

不提供 `Clear Selection` 按钮；再次点击已选项、点击组合器周围空白或按 Esc 都可取消。Explain 模式下这些正常行为必须被拦截。

### 11.3 Notebook

- Time 1–6 用可换行的 3 × 2 / 6 列 Tab，不制造水平滚动。
- 当前时段显示 6 个地点卡，每张卡包含 6 个人物小筹码。
- 点击人物筹码循环 `· unknown → ○ possible → ✕ excluded → ★ confirmed → ·`；状态同时用文字、符号、纹理和 `aria-label` 表达。
- `Counts` 折叠区使用紧凑的 0–6 选择器记录地点人数和人物到访次数，不让用户输入 JSON 或自由格式数据。
- Time 1 的公开初始位置自动标为 confirmed，但玩家仍可改笔记；游戏真相不依赖笔记。
- 线索历史以每次询问为一张组合卡：公开数量在上、对应私密行紧随其下；本人提问时显示具体细节，其他玩家提问时保留锁定占位，二者不再分栏脱节。
- 线索历史限制高度并纵向滚动。
- 宽度不超过 620px 时，Notebook 从文档流中收进右侧 Dock；点击 `笔记 / Notebook` 滑出，点击 `收起 / Hide`、遮罩或按 Esc 收回。打开后键盘焦点留在抽屉内，关闭后回到触发按钮；桌面布局保持内嵌 Notebook。

### 11.4 线索停顿

询问后显示醒目的结果区：

- 所有人看到 `📣 Shared` 计数。
- 仅询问者看到 `🔒 Private` 具体值；其他人只看到“某玩家收到一条私密线索”。
- 若获得再行动，显示 `↻ Bonus turn after everyone is ready`。
- `Ready for Next Turn` 与等待名单同屏；按钮在确认后变为 `Ready ✓`。

### 11.5 答题弹窗

- 使用三个选择器/筹码组选择人物、地点、时段，不要求输入文本或 JSON。
- 发起者按钮为 `Submit & Invite Others`；其他玩家为 `Join with Answer` / `Decline`。
- 弹窗支持 Esc，但发起者已提交后不能撤回；关闭只隐藏弹窗，顶部阶段条仍可重新打开。
- 收集完成前不显示任何人的答案或对错。

### 11.6 视觉与移动端

- 背景使用深蓝剧院夜色，卡片用暖金/酒红点缀，但所有文字满足对比度。
- 人物和地点都同时显示 Emoji 与名称；选中、排除、确认不能只靠颜色。
- 所有容器 `min-width: 0`，文字允许换行；页面 `overflow-x: clip`，禁止横向页面滚动。
- 低于 720px 时单列；地图节点和按钮缩放但最小点击目标保持约 44px。
- 手机地图通过减少地图区和节点的 padding、缩短画布高度来收紧，不再下调地点名与起始人物字号。
- 主操作按钮两列紧凑排列，空间不足再换行；输入控件与说明同行。
- 日志和线索区内部滚动，不让整个页面无限增长。

## 12. Help / Explain（严格遵守 task40）

### 12.1 Help

Header 提供 `Help`，内容至少包括：

- Goal
- Public Setup
- Movement Rule
- Ask a Place + Time
- Ask a Place + Character
- Shared vs Private Clues
- Bonus Turn
- Ready for Next Turn
- Make / Join / Decline an Accusation
- Wrong Answer and Elimination
- Solo Rating
- Notebook Marks
- Digital Notes（网络裁定、隐私、重连）
- Content Notice（原创案件包，不是商业案件）

### 12.2 Explain

Header 提供 `Explain`。映射至少覆盖：

- 地点节点
- Time / Character Tab
- 选择筹码
- Ask
- Make Accusation
- Join with Answer
- Decline
- Ready for Next Turn
- Notebook 标记
- Public / Private Clue 历史

实现要求：

- 进入 Explain 后，仅有解释的按钮添加虚线轮廓和问号光标。
- 捕获阶段拦截所有普通按钮行为；无解释按钮也不能触发原功能。
- disabled 按钮仍能通过 `pointerdown` + 坐标命中显示解释。
- 点击一个有解释的目标后显示说明并退出 Explain。
- Explain、Help 与弹窗关闭按钮不被错误拦截。
- Esc 退出 Explain；Help / Explain / Answer modal 点击 backdrop 或 Esc 关闭，并恢复焦点。

## 13. 后端接口与文件改动

新增：

- `game/kronologic.py`：状态机、案件加载/校验、询问、答案、投影、Bot、序列化。
- `game/assets/kronologic_cases.json`：5 个原创兼容案件。
- `scripts/gen_kronologic_cases.py`：确定性生成/验证工具。
- `static/games/kronologic.js`：所有主要前端状态、渲染、交互、Help / Explain。
- `tests/test_kronologic_game.py`：规则、隐私、Bot、序列化测试。

修改：

- `game/__init__.py`：导出 `KronologicGame`。
- `game/definitions.py`：导入、action/config schema、注册。
- `static/index.html`：游戏选项、配置区、游戏 Panel、Help / Explain / Answer modal、脚本标签。
- `static/app.js`：只添加游戏 Panel 切换、state 路由和 header actions 调用。
- `static/games/shared.js`：收集开局配置，并接入房间状态切换时的配置显示与状态清理钩子。
- `static/style.css`：全部样式放在 `.kronologic-*` / `#kronologicPanel` 作用域内。
- `static/room.js`：`GAME_WEIGHT.kronologic` 与离开房间时的配置/状态重置。
- `app.py`：Bot 事件只公开动作类型，避免广播 Bot 的私密答案或询问参数。
- `scripts/bgg_weight_scrape.py`：BGG URL。
- `game/dev_order.json`：运行 `python scripts/gen_dev_order.py` 更新。

`static/games/kronologic.js` 使用 IIFE；只暴露集成所需的 `renderKronologicGameState`、`clearKronologicState`、`updateKronologicConfigRow`、`getKronologicRoomConfig`、`showKronologicHeaderActions` 等带唯一前缀的函数。

## 14. 配置

Lobby 配置保持紧凑：

- `Game Language`: `中文` / `English`（默认 `中文`）
- `Case Source`: `Recommended Random` / `Choose Case`
- `Difficulty`: `Any` / `★` / `★★` / `★★★`（仅 Random）
- `Case`: 固定案件列表（仅 Choose Case）
- `Seed`: 可选，最长 80 字符（仅 Random；用于可复现选案和先手）

配置 schema：

```python
{
    "language": "zh | en",
    "case_source": "random | preset",
    "difficulty": "any | 1 | 2 | 3",
    "case_id": "sealed-score-01 | ...",
    "seed": "string | integer"
}
```

服务端根据 source 忽略不相关字段，但 schema 仍限制类型和长度。随机模式只从固定目录选择，不在运行时创造未经验证的案件。

## 15. 测试计划

`tests/test_kronologic_game.py` 至少覆盖：

1. 目录恰好 5 个原创案件、ID 唯一、元数据正确。
2. 每条路径长度、Time 1、强制移动与地图邻接合法。
3. 每个案件目标答案唯一。
4. 两类询问的公开计数正确，私密值属于真实候选且跨初始化稳定。
5. count 0/6 给 bonus turn，其他计数不给。
6. 非当前玩家、错误阶段、错误 ID、混合 selector 字段全部拒绝且不改变状态。
7. 询问后进入 review，未全员 ready 不推进；全员 ready 后正确换人/奖励同人再行动。
8. 私密线索只出现在询问者 view，其他 view 与广播事件无泄漏。
9. 笔记只对本人可见，重连投影和 serialize/deserialize 后保留。
10. 发起答题不立即泄露结果；其他人可 Join 或 Decline。
11. 同批多个正确答案共同获胜；错误提交者不获胜。
12. 全批错误时提交者淘汰，Decline 的玩家继续；全员淘汰则失败。
13. 单人正确/错误与 Gold/Silver/Bronze 阈值。
14. 游戏结束才公开完整路径与答案。
15. Bot 不读取不可见秘密、能询问、ready、Join/Decline 并在候选唯一时答题。
16. 存档反序列化拒绝版本/目录/案件不匹配。
17. public log / clue history 达到上限后正确截断。
18. `play_again` 产生干净状态。
19. 语言默认值、非法语言拒绝、中英文投影、日志、案件目录文案和序列化均正确。

同时运行：

```bash
python -m unittest tests.test_kronologic_game
python -m unittest tests.test_frontend_script_names
python -m unittest tests.test_game_names
python -m unittest tests.test_game_dev_order
python -m unittest
```

前端人工 QA：

- 桌面与 360px 宽手机均无横向页面滚动、面板不重叠。
- 空白处和 Esc 能取消选择；不存在 Clear Selection 按钮。
- Help / Explain 的 disabled 按钮解释、点击拦截、Esc 和焦点恢复正确。
- 不同浏览器会话看到的私密线索不同且互不泄漏。
- 断线重连后当前阶段、Ready 状态、私密历史和笔记恢复。
- 线索历史很长时只在面板内部滚动。
- 手机端地图文字不小于桌面断点下限；右侧 Notebook Dock 可用点击、遮罩、Hide 和 Esc 完整开关，且页面无横向滚动。

## 16. 验收标准

- `kronologic` 可从房间列表创建，1–4 人可开局，Bot 可完整推进游戏。
- Room 面板可选择中英文且默认中文；同一房间内所有玩家看到一致语言，断线重连与 Play Again 不丢失设置。
- 5 个原创案件均能正常游玩，Help 明确说明不是商业案件。
- 两类询问、私密投影、奖励回合、全员确认、批量答题、淘汰与胜负均符合本文规则。
- 任一进行中客户端 payload 不含案件路径、答案或他人的私密数据。
- 结束后可查看完整轨迹并 Play Again。
- 前端主要逻辑独立在 `static/games/kronologic.js`，所有全局名有游戏前缀。
- 满足 `FRONTEND.md` 与 `designs/task40.md`，移动端无水平滚动，所有长日志可滚动；公开/私密线索按 `clue_id` 绑定展示，手机 Notebook 可从右侧 Dock 唤出和收回。
- 新增测试和全量现有测试通过；未改坏用户工作区中与本任务无关的 Ark Nova 等改动。
