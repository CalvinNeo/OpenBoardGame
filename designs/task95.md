# Task 95 — Maskmen（面具人）实现方案

## 1. 任务结论

在 OpenBoardGame 中新增 Oink Games 的攀爬／跑牌游戏 `Maskmen`，内部游戏 ID 使用 `maskmen`，中文名使用《面具人》。

首版锁定 Oink Games 英文规则 v1.1 对应的 60 张牌版本，完整实现：

- 2–6 人、6 种摔角手、每种 10 张牌。
- 随游戏过程建立的摔角手强弱关系，以及无法比较时形成的分支关系。
- 主持人领牌、已知更强时同张数跟牌、强弱未知时多 1 张跟牌、弃权后退出本轮。
- 出完牌顺序、赛季计分、4 赛季多人赛、双人先赢 3 个赛季。
- Bot、断线重连、房间存档、Play Again 和服务端权威洗牌。
- 每个小轮结束后的 `round_review`；所有真人点击 **Next Round** 后才清台并开始下一轮，Bot 自动确认。
- 每个非最终赛季结束后的 `season_review`；所有真人点击 **Next Season** 后才重新洗牌发牌，Bot 自动确认。最终赛季停留在完整结果页。

首版明确不包含：

- 早期 48 张牌版的 `10 / 9 / 8` 手牌数和自选赛季数规则。
- `Disney Villains / Unknown Order` 的角色、卡图、名称或任何联动素材。
- 预先固定强弱顺序、累计牌数动态改强弱等非官方变体。
- 任何商业版 Logo、摔角手插画、面具造型、卡背、腰带计分物、规则书版式或商业字体。

实现必须满足仓库约束：

- 前端主要逻辑放在 `static/games/maskmen.js`；所有浏览器全局名称使用 `maskmen` 或 `Maskmen` 独有前缀。
- 严格遵守 `FRONTEND.md` 和 `designs/task40.md`：Help / Explain、disabled 控件可解释、Esc 退出、点击空白取消选择、Emoji + 颜色 + 文字 + 形状联合编码、移动端紧凑布局、日志内部滚动、页面无横向滚动。
- 所有与游戏内容无关的 UI 使用英文；操作按钮使用 **Play Cards**、**Pass**、**Next Round**、**Next Season**、**Play Again** 等英文标签。
- 服务端保存手牌、未发牌、洗牌状态和全部规则判定；客户端只发送结构化动作，不能自行判定强弱或推算未来发牌。

## 2. 游戏识别、资料来源与版本边界

### 2.1 基本信息

- 英文名：`Maskmen`
- 中文名：《面具人》
- 设计者：Jun Sasaki、Taiki Shinzawa
- 出版：Oink Games
- 首次发行：2014 年
- 玩家人数：2–6 人
- 官方时长：约 20 分钟
- 官方年龄：9+
- BoardGameGeek ID：`159581`
- Oink Games 官方产品页：<https://oinkgames.com/en/games/analog/maskmen/>
- Oink Games 英文规则 v1.1 镜像：<https://content.cmpl.org/bg/Maskmen.pdf>
- BoardGameGeek：<https://boardgamegeek.com/boardgame/159581/maskmen>

截至方案编写时，BGG 显示 Weight `1.78 / 5`。正式实现时仍按仓库约定把 BGG URL 加入 `scripts/bgg_weight_scrape.py`，运行脚本取得当时数值，再以两位小数写入 `static/room.js`；本文数值不作为永久常量。

### 2.2 采用的规则版本

本方案以规则书 v1.1 的组件和发牌表为准：

| 玩家数 | 每人起始手牌 | 本赛季未发出的牌 |
| ---: | ---: | ---: |
| 2 | 15 | 30 |
| 3 | 15 | 15 |
| 4 | 15 | 0 |
| 5 | 12 | 0 |
| 6 | 10 | 0 |

牌组固定为 6 种摔角手、每种 10 张，共 60 张。2–3 人局未发出的牌留在服务端，牌种和顺序不公开；新赛季把全部 60 张牌重新混洗。

早期版本常见的是 48 张牌、每种 8 张，并使用 `2–4 人每人 10 张 / 5 人 9 张 / 6 人 8 张`。该版本不能与本方案混用，测试也必须用 60 张总量守恒锁定版本。

### 2.3 商业素材边界

可以实现公开规则机制、组件数量和功能性文字，但不得提交或临摹：

- 官方六名摔角手的脸、面具、卡面构图、Strength Marker 或腰带计分物。
- Maskmen / Oink Games Logo、商品封面、规则书截图、扫描件或官方宣传图。
- `Disney Villains / Unknown Order` 的任何角色、名称、轮廓或卡图。
- 从商品照片、视频、Tabletop Simulator 模组或其他数字版裁切的素材。

视觉采用原创“霓虹擂台转播”方向：深蓝黑背景、暖白卡面、荧光边框和原创 CSS 几何面具。六种摔角手必须同时使用颜色、Emoji、英文文字和不同几何纹样区分，不能只依赖颜色：

| `wrestler_id` | 显示建议 | 原创纹样 |
| --- | --- | --- |
| `orange` | `🟠 Orange` | 斜纹 |
| `pink` | `🌸 Pink` | 圆点 |
| `steel` | `⚫ Steel` | 网格 |
| `blue` | `💧 Blue` | 波纹 |
| `purple` | `🔮 Purple` | 菱形 |
| `green` | `🍀 Green` | 折线 |

这些名称只是数字版功能标签，不为角色添加可能与商业版冲突的姓名或背景故事。

## 3. 已确认的完整规则

### 3.1 名词

- **Game**：完整一局。3–6 人固定 4 个 Season；2 人先赢 3 个 Season。
- **Season**：一次完整发牌到只剩 1 人仍有手牌的过程。每个新 Season 都重置强弱关系。
- **Round**：由 Host 领牌开始，到除 1 人外都 Pass 为止。规则书中的 Round 相当于一墩／一次擂台。
- **Host**：一轮的领牌者。
- **Debuted**：某种摔角手在当前 Season 至少被打出过一次。
- **Known stronger**：根据当前关系图可以直接或传递推出 A 强于 B。
- **Unknown relation**：A 与 B 之间两个方向都不可达；这不是“同强度”。

界面与 Help 必须明确区分 Season 和 Round，避免把中文都翻成“轮”导致误解。

### 3.2 开局与发牌

1. 服务端建立 60 张牌并洗牌。
2. 按玩家座次轮流发到对应手牌数；牌种只对持有者可见。
3. 清空上个 Season 的强弱关系、已登场集合、弃权状态和完成顺序。
4. 第一 Season 的首位 Host 由服务端随机选择并写入日志，替代无法在线验证的“最近看过职业摔角的人”。
5. 后续 Season 由上一 Season 的最后一名，也就是唯一仍有手牌的玩家担任首位 Host。

### 3.3 强弱关系是严格偏序，不是单一排名

六种摔角手的关系用有向无环图表示，边方向为“更强 → 更弱”。

若依次确认：

```text
Green > Pink > Blue
Orange > Pink
```

则服务端可以传递推出 `Green > Blue` 和 `Orange > Blue`，但不能推出 `Green` 与 `Orange` 谁更强。两者仍为不可比较关系，前端不能因为它们处于同一视觉高度就显示为平手。

关系查询统一使用：

```text
same      candidate == previous
stronger  candidate 可达 previous
weaker    previous 可达 candidate
unknown   两个方向都不可达
```

新关系只会在以“未知关系 +1 张”出牌时加入 `candidate -> previous`。加入前再次检查两点不能相同、不能已有反向可达路径，保证图永远无环。

服务端保存玩家实际建立的比较边；公共视图另外给出传递闭包和用于绘图的传递约简。规则判定只能使用服务端计算结果，不能信任客户端回传的 relation。

### 3.4 Host 领牌

每个 Round 开始时，Host 必须选择手中一种摔角手领牌，不能 Pass：

- 如果该摔角手本 Season 从未登场，只能打出 1 张。
- 如果该摔角手本 Season 已经登场，可以打出 1–3 张，但不能超过自己持有数。
- 一次出牌只能包含同一种摔角手。

Host 领牌没有被比较对象，因此不会仅凭领牌建立任何强弱关系；它只会把新摔角手加入 `debuted_wrestler_ids`。

### 3.5 后续玩家的合法动作

设上一手为摔角手 `previous`、张数为 `n`。轮到的玩家可以出牌或 Pass。

出牌规则：

1. **已知更强**：若 `candidate > previous` 已经能从关系图推出，必须恰好打出 `n` 张 candidate，不多也不少。
2. **强弱未知**：若 candidate 与 previous 无法比较，必须恰好打出 `n + 1` 张 candidate，并确认 `candidate > previous`。
3. **禁止**：不能打同一种摔角手，不能打已知更弱的摔角手，不能打超过 3 张，不能少于或多于上述精确张数。
4. 如果上一手已经是 3 张，未知关系不能再跟牌；只有已知更强且手中至少有 3 张时才能继续。

Pass 规则：

- 玩家即使有合法牌也可以选择 **Pass**。
- 一旦 Pass，本 Round 后续都不能重新加入。
- 已经出完手牌的玩家离开当前 Season 的行动顺序，也不计入本 Round 的“未 Pass 玩家”。

服务端必须为当前玩家枚举完整 `legal_plays`，例如：

```json
[
  {
    "wrestler_id": "green",
    "count": 2,
    "relation": "known_stronger",
    "establishes_edge": null
  },
  {
    "wrestler_id": "orange",
    "count": 3,
    "relation": "unknown",
    "establishes_edge": ["orange", "purple"]
  }
]
```

前端只把该列表用作可视化和动作构造；`apply_action` 仍须从当前服务端状态重新计算一次合法性，防止过期状态或伪造请求。

### 3.6 Round 结束与下一位 Host

每次出牌或 Pass 后按以下顺序检查：

1. 若刚出牌的玩家手牌变为 0，立刻记录其 Season 完成名次。
2. 若只剩 1 名玩家仍有手牌，立即结束 Season。
3. 否则，若当前仍有手牌且尚未 Pass 的玩家只剩 1 名，结束 Round。
4. 否则把回合交给顺时针下一名仍有手牌且尚未 Pass 的玩家。

Round 结束时：

- 唯一没有 Pass、且仍有手牌的玩家成为下一 Round 的 Host。
- 这也处理了“最后出牌者刚好出完手牌”的边界：该玩家已经退出 Season，顺时针找到的剩余未 Pass 玩家担任 Host。
- 当前 Round 的牌进入已打出区，保留为公开历史；`previous_play` 清空。
- 生成不可变 `last_round_summary`，包含出牌序列、新增关系、出完牌玩家、下一 Host 和每人剩余手牌数。
- 进入 `round_review`。所有真人提交 **Next Round**，Bot 自动提交；全部确认后才重置 Pass 集合并由新 Host 领牌。

Review 期间不接受出牌或 Pass。重复确认必须幂等，不得推进两次。

### 3.7 Season 结束与计分

完成顺序在玩家打出最后一张牌时立即确定，不等待当前 Round 的其他动作：

- 第 1 名：`+2` 分，并获得一个 `first_place_count`。
- 第 2 名：`+1` 分。
- 中间名次：`0` 分。
- 唯一没有出完手牌的最后一名：`-1` 分。

只剩一名玩家有手牌时 Season 立即结束，不再要求剩余玩家继续 Pass。服务端生成 `last_season_summary`，其中同时保留最后一个 Round 的出牌过程、完整名次、分数变化和强弱关系最终图，然后进入 `season_review`。

3–6 人局：

- 固定进行 4 个 Season。
- 先比较总分。
- 同分时比较 `first_place_count`，更多者胜。
- 若仍同分，官方规则写为“最后一轮的获胜者”。数字版在并列候选中比较第 4 Season 的完成名次，名次更靠前者胜；这样即使该 Season 的总冠军不在总分并列集合内，也能得到确定结果。

2 人局：

- 不固定 Season 数量；每个 Season 首位出完牌者获得 1 个 `season_win`。
- 首位取得 3 个 `season_win` 的玩家立即赢得整局，最多进行 5 个 Season。
- 界面以 `🏆 0/3` 显示进度，不用多人局总分决定胜负。

非最终 Season 的所有真人点击 **Next Season** 后才重新洗牌；Bot 自动确认。最终 Season 结束后直接进入稳定的 `game_over` 结果页，不会自动重开。

### 3.8 公开与私密信息

公开信息：

- Season / Round、Host、当前行动者、Pass／已完成状态。
- 每名玩家的手牌总数、完成名次、分数／双人胜场。
- 当前 Round 的每次公开出牌、张数、由该动作建立的新关系。
- 当前完整强弱关系图和所有已经公开过的 Round 摘要。
- 未发牌总数，但不公开其牌种。

私密信息：

- 每名玩家自己手中六种摔角手的数量。
- 2–3 人局未发出牌的牌种和顺序。
- 后续 Season 的洗牌结果、服务端 seed 和 RNG 状态。

旁观者和其他玩家只收到 `hand_count`，不能从 DOM、Socket.IO 事件、日志、错误消息或 Bot 调试字段中看到具体手牌。

## 4. 服务端设计

新增 `game/maskmen.py`，实现 `MaskmenGame` 的 `init_game`、`get_legal_actions`、`apply_action`、`get_public_view`、`bot_move`、`serialize` 和 `deserialize`。

### 4.1 常量

```python
WRESTLER_IDS = ("orange", "pink", "steel", "blue", "purple", "green")
CARDS_PER_WRESTLER = 10
MAX_PLAY_COUNT = 3
HAND_SIZE_BY_PLAYER_COUNT = {2: 15, 3: 15, 4: 15, 5: 12, 6: 10}
MULTIPLAYER_SEASONS = 4
DUEL_WINS_TO_GAME = 3
```

牌只按种类计数，不需要给 60 张功能完全相同的牌创建客户端可见 ID。洗牌时服务端使用包含 10 个每种 `wrestler_id` 的列表，逐张发牌，以保证随机分布与实体版一致。

### 4.2 状态结构

下例只展开 `p1` 的玩家字段，其余玩家使用相同结构：

```python
{
    "version": 1,
    "game_id": "maskmen",
    "config": {
        "server_seed": "server-only",
        "rng_counter": 0,
        "match_number": 1
    },
    "turn_order": ["p1", "p2", "p3", "p4"],
    "player_meta": {"p1": {"name": "A", "seat": 0, "is_bot": False}},
    "player_count": 4,
    "mode": "standard",
    "phase": "playing",
    "season_number": 1,
    "round_number": 1,
    "host_player_id": "p1",
    "current_player_id": "p1",
    "players": {
        "p1": {
            "hand": {
                "orange": 2,
                "pink": 1,
                "steel": 3,
                "blue": 2,
                "purple": 4,
                "green": 3
            },
            "score": 0,
            "first_place_count": 0,
            "season_wins": 0,
            "finish_rank": null
        }
    },
    "undealt_cards": [],
    "played_counts": {
        "orange": 0,
        "pink": 0,
        "steel": 0,
        "blue": 0,
        "purple": 0,
        "green": 0
    },
    "debuted_wrestler_ids": [],
    "strength_edges": [],
    "previous_play": null,
    "round_plays": [],
    "passed_player_ids": [],
    "season_finish_order": [],
    "review_ready_player_ids": [],
    "pending_transition": null,
    "last_round_summary": null,
    "last_season_summary": null,
    "season_history": [],
    "activity": [],
    "game_over": false,
    "winner_ids": [],
    "rematch_ready_player_ids": []
}
```

`mode` 在 2 人局为 `duel`，3–6 人局为 `standard`。外部 config schema 只允许可选测试字段 `seed`，不允许客户端提交 `server_seed` 或 RNG counter；正常房间由服务端生成不可预测 seed。`server_seed`、RNG 状态和 `undealt_cards` 永不进入公共视图。Play Again 增加 `match_number` 并派生新的洗牌流，不能原样重复上一局牌序。

### 4.3 强弱图辅助函数

至少实现以下纯函数并直接单测：

- `_reachable(edges, stronger_id, weaker_id)`：最多 6 个节点，可用 DFS／BFS。
- `_relation(edges, candidate_id, previous_id)`：返回 `same / stronger / weaker / unknown`。
- `_add_strength_edge(edges, stronger_id, weaker_id)`：拒绝自环和反向路径，返回规范化去重边集。
- `_transitive_closure(edges)`：供合法性和公共说明使用。
- `_transitive_reduction(edges)`：只供前端绘图，避免把所有传递边画成线团。
- `_enumerate_legal_plays(state, player_id)`：返回每个合法 `wrestler_id + count + relation`。
- `_next_eligible_player(state, from_player_id)`：顺时针跳过已完成和已 Pass 玩家。

边集序列化前按 `WRESTLER_IDS` 的稳定顺序排序，保证存档、测试和重连后的图布局一致。

### 4.4 动作

- `play_cards {wrestler_id, count}`
- `pass`
- `next_round`
- `next_season`
- `play_again`

对应 schema：

```json
{
  "type": "object",
  "properties": {
    "type": {"const": "play_cards"},
    "wrestler_id": {
      "type": "string",
      "enum": ["orange", "pink", "steel", "blue", "purple", "green"]
    },
    "count": {"type": "integer", "minimum": 1, "maximum": 3}
  },
  "required": ["type", "wrestler_id", "count"],
  "additionalProperties": false
}
```

其余动作也都使用 `additionalProperties: false`。业务层必须再次校验：

- 玩家身份、phase、是否轮到该玩家。
- 手牌是否足够、玩家是否已完成或已 Pass。
- Host 领牌规则、跟牌关系和精确张数。
- review 动作是否对应当前 review phase，是否已经确认。
- game_over 后除 `play_again` 外拒绝所有动作。

### 4.5 状态推进

`play_cards` 的原子处理顺序：

1. 从当前服务端状态重新枚举合法出牌。
2. 扣除手牌并增加 `played_counts`。
3. 必要时加入新强弱边；更新 debuted 集合。
4. 追加公开 `round_plays` 和经过脱敏的 activity。
5. 若手牌清零，立刻写入唯一 `finish_rank`。
6. 依次检查 Season 结束、Round 结束、正常换手。

`pass` 的原子处理顺序：

1. 验证不是 Host 的首个动作、玩家尚未 Pass 且仍有手牌。
2. 加入 `passed_player_ids`。
3. 检查 Round 是否结束，否则换到下一位 eligible 玩家。

Round / Season review 的待执行转移保存在 `pending_transition`，而不是由最后一个客户端自行构造。最后一个确认到达时，服务端只执行一次预先保存的转移。

### 4.6 公共视图

`get_public_view` 返回：

- 基础状态：mode、phase、Season、Round、Host、当前玩家。
- 玩家公开信息：名称、座次、是否 Bot、手牌总数、Pass、完成名次、分数、第一名次数、双人胜场、review ready。
- `your_hand`：仅本人获得六种牌的数量；旁观者为空。
- `legal_actions` 和本人专属的 `legal_plays`。
- `previous_play`、`round_plays`、已登场摔角手。
- `strength_closure`、`display_edges` 和每对摔角手的可访问说明。
- Round / Season 摘要、确认进度、活动日志、游戏结果。

公共 `config` 不返回 seed。错误文本只说明动作无效的公开原因，例如 `That wrestler is known to be weaker`，不能附带其他玩家手牌或未发牌详情。

### 4.7 不变量与反损坏校验

每次动作后、deserialize 后至少验证：

- 六种牌各满足 `所有手牌 + played_counts + undealt_cards = 10`。
- 所有手牌计数为非负整数，手牌总数与公开 `hand_count` 一致。
- `strength_edges` 只含合法 wrestler ID、无重复、无自环、无环。
- `previous_play` 若存在，张数为 1–3，且等于 `round_plays` 最后一项。
- `passed_player_ids`、完成顺序、ready 集合都无重复且属于本局玩家。
- 完成名次连续且与 `season_finish_order` 一致；已完成玩家手牌恰好为 0。
- `playing` phase 必须有合法 current player；review phase 不得有 current player 动作。
- 3–6 人最多 4 个 Season；2 人胜者达到 3 胜时必须 game over。

损坏存档应在 deserialize 时明确拒绝，不能静默修补出一局不同的游戏。

## 5. Bot 设计

Bot 只读取自己的手牌和公共强弱图，不读取其他玩家的牌种或未发牌。

决策流程：

1. 枚举服务端合法动作；能一次出完手牌时优先出完。
2. 优先减少更多手牌，但会为同一合法张数比较出牌后的关系价值。
3. 建立新关系时，优先让自己剩余较多的摔角手处在更强位置。
4. 已知更强的多个候选中，优先使用自己持有较少、较难再组合的牌种。
5. 若没有合法出牌只能 Pass；有合法牌时可用固定、可复现的小概率策略性 Pass，避免 Bot 永远机械跟牌。
6. 所有相同评分选项按稳定 ID 排序后用服务端 RNG 打破，测试 seed 下可复现。
7. `round_review`、`season_review` 和 Play Again 确认由 Bot 自动提交。

Bot 的合法性仍由 `apply_action` 校验；Bot 不能直接改 state。

## 6. 前端与交互

### 6.1 页面结构

在现有游戏页中新增：

- 顶部状态条：`Season 2/4` 或 `🏆 First to 3`、Round、Host、Turn。
- 玩家状态区：名称、手牌数、分数／胜场、`Passed`、`Finished #1`、review ready。
- 中央 **Strength Map**：六个原创面具节点和有向边；强者在上、弱者在下，不可比较节点明确显示为独立分支。
- **Current Bout**：本 Round 按顺序排列的公开出牌，显示玩家、摔角手、张数与 `Known stronger` / `New relation`。
- **Your Hand**：按六种摔角手分组的卡堆，显示图标、英文名、纹样和数量。
- 操作坞：只显示当前阶段需要的 **Play Cards**、**Pass** 或 review 按钮。
- Review 卡：本 Round 新关系、出完牌者、剩余手牌、下一 Host；Season 结束时再显示计分与排名。
- 内部可滚动的 **Game Log**，记录公开动作，不记录具体私密手牌。

桌面端使用“Strength Map + Current Bout”为主栏、“Players + Log”为侧栏；手牌和操作坞横跨底部。小于 `820px` 改为单栏，小于 `520px` 缩短卡面但保留至少 44px 点击目标。所有容器设置 `min-width: 0`，长玩家名截断并保留 title，页面禁止横向滚动。

### 6.2 Strength Map

Strength Map 使用原生 SVG 连线加 HTML／SVG 节点，不引入图形库：

- 只绘制服务端给出的 `display_edges`，箭头方向和 `Stronger` 标签明确。
- 节点垂直层级由 DAG 最长路径计算；同层节点不标为相等，而显示 `Unrelated branches` 提示。
- 点击／点按节点只用于选择手牌或查看说明，不在客户端修改关系。
- 屏幕阅读器获得等价列表，例如 `Green is stronger than Pink and Blue; relation to Orange unknown`。
- 移动端把节点压成最多两列的竖向图，SVG 使用 `viewBox` 等比缩放，不产生横向滚动。

### 6.3 手牌选择与出牌

- 当前玩家点击一个可用摔角手卡堆后，该堆显示半透明选中层和合法张数按钮。
- 若该摔角手只有一种合法张数，直接选中该数量；仍需点击 **Play Cards** 确认，避免误触即出牌。
- 选中层同时显示结果预览，例如 `Play 3 · establishes Orange > Purple`。
- 点击卡堆和操作坞之外的空白区域取消选择，不添加 **Clear Selection** 按钮。
- 选中层可有 **Cancel**，Esc 也取消当前选择；这是卡牌上的就地操作，不是额外常驻清除按钮。
- 不合法卡堆保持可见但置灰，并提供公开原因：`Need 3 cards`、`Known weaker`、`Already passed`、`Wait for your turn`。
- **Pass** 使用次级危险样式，点击后弹出轻量确认层 `You cannot rejoin this round`；Esc 关闭。

不提供输入框、下拉 JSON 或自由文本动作。

### 6.4 Review 交互

`round_review` 保留完整盘面并在操作坞显示：

```text
Round complete · Next Host: Alex
Ready 2/4
[Next Round]
```

玩家确认后按钮变为 `Waiting for others…`，但 Strength Map、Current Bout 和 Log 仍可查看。所有真人确认前不能清空盘面。

`season_review` 显示：

- 完成顺序和 `+2 / +1 / 0 / -1`。
- 总分或双人 `🏆 x/3`。
- 本 Season 最终强弱图。
- 下一 Season Host。
- **Next Season** 或最终结果。

### 6.5 Help

Help 弹窗至少包含：

1. 目标、Game / Season / Round 的区别。
2. 60 张牌版的各人数手牌数。
3. Host 首次登场只能 1 张、已登场可领 1–3 张。
4. 已知更强同张数、未知关系多 1 张、最多 3 张。
5. Pass 后本 Round 不能回来。
6. 分支强弱图示例，明确“不可比较 ≠ 同强度”。
7. Round / Season 的结束条件和下一 Host。
8. 多人计分、双人先赢 3 个 Season、并列处理。
9. 当前实现采用 60 张牌版，不含旧版和 Disney 版。

Help 使用英文功能性重述，不复制规则书页面或长段原文。弹窗有 `role="dialog"`、焦点回收、Close 按钮和 Esc 关闭。

### 6.6 Explain

Explain 模式为以下元素提供说明：

- Season / Round / Host / Turn。
- 玩家手牌数、Pass、Finish、分数／胜场。
- Strength Map 节点、箭头和不可比较分支。
- Current Bout 与上一手张数。
- 每个手牌堆、合法张数、关系预览。
- **Play Cards**、**Pass**、**Next Round**、**Next Season**、**Play Again**。
- Review ready 进度和 Game Log。

严格按 `designs/task40.md` 实现：

- 只有带解释的元素加 `.has-explanation`、虚线轮廓和问号光标，不能让整个页面变问号。
- 捕获阶段拦截 Explain 模式下的正常操作；无解释控件也不能触发原功能。
- 使用捕获阶段 `pointerdown` + 坐标命中支持 disabled 按钮解释。
- 查看一次解释后自动退出；Esc 退出 Explain 或关闭最上层弹窗。
- Help、Explain 本身和当前解释弹窗的 Close 不被错误拦截。

## 7. 注册与集成

- `game/maskmen.py`：新增完整游戏状态机。
- `game/__init__.py`：导出 `MaskmenGame`。
- `game/definitions.py`：导入并注册 `GameDefinition`，英文名 `Maskmen`，中文名 `面具人`，2–6 人，`turn_mode="turn"`；新增严格 action/config schema。
- `game/tags.py`：标签使用 `filler`、`trick_taking`。虽然 Maskmen 不是传统吃墩，仓库该标签说明明确包含 climbing card play。
- `game/dev_order.json`：运行 `python scripts/gen_dev_order.py` 生成，不手改顺序。
- `scripts/bgg_weight_scrape.py`：加入 `https://boardgamegeek.com/boardgame/159581/maskmen`。
- `static/room.js`：写入脚本抓取到的两位小数 Weight。
- `static/index.html`：新增 Maskmen 面板、Help / Explain 弹窗、header actions 和 `/static/games/maskmen.js` 脚本。
- `static/app.js`：只增加全局面板切换、状态分发和 header actions 调用；游戏渲染与事件放在独立脚本。
- `static/games/maskmen.js`：使用 IIFE 保存私有状态；确需全局暴露的入口统一使用 `maskmen` 前缀。
- `static/style.css`：所有样式以 `.maskmen-` 命名空间开头，不污染其他游戏。

## 8. 测试方案

新增 `tests/test_maskmen_game.py`，至少覆盖：

### 8.1 初始化与牌守恒

- 2–6 人可初始化，其他人数拒绝。
- 每种摔角手恰好 10 张，总计 60 张。
- `15 / 15 / 15 / 12 / 10` 手牌表和 2–3 人未发牌数量。
- 固定 seed 的发牌与首位 Host 可复现；公共视图不泄漏 seed 或未发牌牌种。
- Play Again 使用新 RNG 流，不重复上一局牌序。

### 8.2 领牌与跟牌

- 未登场摔角手由 Host 领牌时只能 1 张。
- 已登场摔角手由 Host 领牌时允许 1–3 张且受手牌数限制。
- 已知更强只能同张数；多 1 或少 1 都拒绝。
- 未知关系只能多 1 张，并建立正确方向的边。
- 同摔角手、已知更弱、超过 3 张、手牌不足都拒绝。
- 上一手 3 张时，只允许已知更强的 3 张组合。

### 8.3 偏序图

- 直接关系、传递关系和未知关系判定。
- `Green > Pink > Blue` 与 `Orange > Pink` 时，Green / Orange 保持不可比较。
- 重复边幂等，自环和成环被拒绝。
- 传递约简不改变可达关系，序列化顺序稳定。
- 重连前后合法出牌集合完全一致。

### 8.4 Pass、Round 与 Host

- Pass 后本 Round 不能再行动，下一 Round 恢复。
- 除一人外均 Pass 时进入 `round_review`，不是立即清台。
- 所有真人确认且 Bot 自动确认后才开始下一 Round。
- 最后出牌者出完手牌时，由剩余未 Pass 玩家成为下一 Host。
- 已完成玩家和已 Pass 玩家都会被顺时针换手跳过。
- 重复 `next_round` 不会推进两次。

### 8.5 Season、计分与终局

- 玩家打出最后一张时立即获得唯一完成名次。
- 同一 Round 可依动作顺序产生多个完成者。
- 只剩 1 人有牌时立即进入 `season_review`。
- 3–6 人正确发放 `+2 / +1 / 0 / -1`，最后一名成为下一 Season 首位 Host。
- 4 个 Season 后按总分、第一名次数、最后 Season 完成名次决胜。
- 2 人首位取得 3 个 Season 胜场时结束，最多 5 个 Season。
- Season review 需要所有真人确认；Bot 自动确认。
- game over 后只接受 Play Again；所有真人确认、Bot 自动确认后重开，保留玩家和 Bot 席位但清空局内状态。

### 8.6 隐私、Bot 与存档

- 玩家只能看到自己的六种手牌数量，其他人只显示总数。
- 旁观视图、事件、错误、日志和 review 摘要不泄漏私密牌种。
- Bot 在每个可行动状态返回合法动作，在 review 自动确认。
- serialize / deserialize 往返保持所有公开和私密状态。
- 损坏的牌总量、循环强弱图、重复完成名次和非法 phase 被拒绝。

运行：

```bash
python -m unittest tests.test_maskmen_game
python -m unittest tests.test_game_dev_order tests.test_game_names tests.test_game_tags tests.test_frontend_script_names
```

纯 CSS／HTML 调整不额外运行逻辑测试；如果修改了 `app.js` 的全局分发，则运行相关全局测试。

## 9. 前端人工验收

至少在约 `1280px` 桌面、`768px` 平板和 `390px` 手机视口检查：

- Strength Map 的分支和箭头清晰，不把不可比较显示成平手。
- 六种牌不用只看颜色也能区分；高对比模式下文字和纹样仍可读。
- 选择牌堆、切换张数、空白取消、Cancel 和 Esc 行为正确。
- 禁用卡堆显示清楚原因，Explain 仍能命中 disabled 按钮。
- Pass 确认层可用 Esc 关闭，确认后无法在本 Round 重新加入。
- Round 结束后盘面保留到所有真人点击 Next Round。
- Season 结束后排名、分数变化、最终强弱图和下一 Host 可复核。
- 长玩家名截断，Game Log 内部滚动，任何视口都无板块重叠和页面横向滚动。
- 重连到 playing、round_review、season_review 和 game_over 都能完整恢复。

## 10. 建议实现顺序

1. 先实现偏序图纯函数与对应单测。
2. 实现 60 张牌发牌、出牌／Pass 状态机和牌守恒断言。
3. 实现 Round / Season review、计分、双人模式和终局。
4. 实现公共视图、隐私测试、存档和 Bot。
5. 完成注册、tags、dev order 和 BGG Weight。
6. 创建 `static/games/maskmen.js`、面板和命名空间样式。
7. 完成 Help / Explain、移动端和人工验收。

## 11. 完成定义

只有同时满足以下条件才算完成：

- 60 张牌版 2–6 人规则、分支强弱关系、多人／双人赛制全部可玩。
- 服务端不信任客户端规则判定，任何视图和事件都不泄漏隐藏牌。
- 每个 Round 和非最终 Season 都按 `FRONTEND.md` 停留等待所有真人确认；最终 Season 停留在不会自动推进的结果页。
- Bot、断线重连、存档、Play Again 可用。
- Help / Explain 完整符合 `designs/task40.md`。
- 桌面与手机无横向滚动、重叠或依赖颜色才能识别的问题。
- 不包含商业素材，新增测试和全局注册测试全部通过。
