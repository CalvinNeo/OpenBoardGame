# Task 78: 《香料之路》规则与电子版实现规格

## 游戏识别

- 中文名：《香料之路》
- 英文名：`Century: Spice Road`
- 作者：Emerson Matsuuchi
- 出版：Plan B Games / Next Move Games
- 人数：2-5 人
- 时长：约 30-45 分钟
- 类型：手牌构筑、资源转换、开放市场、合约换分

本文目标不是复刻规则书原文，而是把规则整理成足够实现电子版的状态机说明。已核对的公开来源：

- 官方英文规则书 PDF：`https://cdn.svc.asmodee.net/production-nextmove/uploads/sites/4/2024/06/EN-Century-Spice-Road-Rules_2024_compressed.pdf`
- RulesPal 规则页：`https://www.rulespal.com/century-spice-road/rulebook`
- 1jour-1jeu 规则书下载页：`https://en.1jour-1jeu.com/cardgame/2017-century-spice-road/files`
- I Play Red 组件与规则概述：`https://iplayred.dk/games/century-spice-road/walkthrough`

## 无法获取的游戏资源

以下资源无法从公开规则中完整、合法、结构化地取得，电子版开发时需要自行补充、授权、重绘或用占位内容替代：

1. **官方完整商人牌数据表**
   - 规则书只说明商人牌类型和解析方式，没有提供 43 张非起始商人牌的完整列表。
   - 已从 Tabletop Simulator Workshop 模组 `2436905576` 提取到一份非官方结构化牌表，见 `designs/century_spice_road/extracted/century_spice_road_tts_cards.json`。
   - 这份 TTS 牌表可用于实现和测试，但不是出版社发布的官方机器可读数据，正式使用前建议用实体牌或授权资料校对。
2. **官方完整分数牌数据表**
   - 规则书只说明分数牌花费与分值的使用方式，没有提供 36 张分数牌的完整列表。
   - 已从同一个 TTS 模组提取到 36 张分数牌的非官方结构化数据。
   - 若要求完全复刻实体基础版，仍应进行人工校对。
3. **牌面美术与图标**
   - 商人牌、分数牌、牌背、商队牌、起始玩家标记等原始美术受版权保护。
   - 电子版应使用自制 UI、颜色块、Emoji 或授权素材，不应直接复制商业牌面。
4. **金属币、碗、方块等实体材质图**
   - 这些视觉素材不是规则必需项，可用简单图形或 Emoji 替代。
5. **本地化文本**
   - 牌面名称本身对规则无影响；如果需要中文牌名、教程或 Help/Explain 文案，需要自行撰写。
6. **扩展与促销牌**
   - 本文只覆盖基础版《Century: Spice Road》，不包含 Golem Edition 换皮牌组、Big Box 组合规则、促销牌或其他 Century 系列联动规则。

## 核心玩法概览

玩家扮演香料商队，通过打出手牌获得或转换香料，再用香料购买分数牌。每回合当前玩家必须选择 1 个行动：

- `play`：打出 1 张手牌并执行其效果。
- `acquire`：从 6 张公开商人牌市场中获得 1 张新商人牌。
- `rest`：收回自己之前打出的所有商人牌。
- `claim`：支付香料获得 1 张公开分数牌。

游戏没有传统弃牌洗牌系统。玩家的“牌组”就是自己的手牌和已打出区。打出的牌会留在已打出区，直到玩家选择 `rest` 才一起回手。核心节奏来自“多打几张牌继续攒资源”与“花一回合休息取回引擎”的取舍。

## 资源与价值顺序

香料有 4 种，从低到高：

| 资源 ID | 中文 | 英文 | 建议显示 | 等级 |
|---|---|---|---|---:|
| `yellow` | 姜黄 | Turmeric | 🟨 | 0 |
| `red` | 藏红花 | Saffron | 🟥 | 1 |
| `green` | 豆蔻 | Cardamom | 🟩 | 2 |
| `brown` | 肉桂 | Cinnamon | 🟫 | 3 |

升级只允许沿等级上升 1 格：`yellow -> red -> green -> brown`。`brown` 不能再升级。

实体版方块数量为 105 个：黄 34、红 30、绿 21、棕 20。不过规则指定香料供应不受实体数量限制，耗尽时可用替代物。因此电子版应把公共供应视为无限，不需要因为库存不足拒绝动作。

每名玩家的商队容量为 10 个香料。玩家可以在一次行动中临时超过 10 个，但在该玩家回合结束时必须弃掉任意香料直到不超过 10 个。

## 组件

### 商人牌

商人牌分两类：

- 10 张起始商人牌：每名玩家拿 1 张 `Create 2` 和 1 张 `Upgrade 2`；多余起始牌移出游戏。
- 43 张普通商人牌：洗混为商人牌堆，公开 6 张形成商人市场。

商人牌有 3 种规则类型：

```text
MerchantCard:
  id: string
  type: spice | upgrade | trade
  gain?: SpiceCounts
  upgrade_steps?: integer
  trade_in?: SpiceCounts
  trade_out?: SpiceCounts
```

建议把起始牌也建成同一结构：

```text
starter_create_2:
  type: spice
  gain: { yellow: 2 }

starter_upgrade_2:
  type: upgrade
  upgrade_steps: 2
```

#### `spice` 生产牌

打出后从供应获得牌面指定数量和颜色的香料，放入当前玩家商队。

实现时不需要玩家选择，除非牌面本身是可选效果。基础规则中的生产牌按牌面固定获得。

#### `upgrade` 升级牌

打出后最多执行 `upgrade_steps` 次单步升级。每次升级都由玩家选择自己商队中的 1 个非最高级香料，将其变为下一级更高级香料。

规则要点：

- 升级次数是“最多”，不是必须用完。
- 可以连续升级同一个香料。例如 `yellow` 用 2 次升级变成 `green`。
- 不能把 `brown` 继续升级。
- 如果玩家没有可升级香料，也可以打出该牌，效果为 0 次升级。

电子版交互建议：

- 玩家选择要升级的香料按钮，每点一次立即预览资源变化。
- 提供 `Done` 按钮结束升级。
- 如果没有可升级项，自动结束该牌效果。

#### `trade` 交易牌

打出后，玩家可以把 `trade_in` 中列出的香料交回供应，并获得 `trade_out` 中列出的香料。只要玩家还能支付输入成本，就可以在同一次打牌行动中重复执行任意次数。

规则要点：

- 交易次数可以是 0 次、1 次或多次。
- 每次交易都必须完整支付 `trade_in`。
- 每次交易都完整获得 `trade_out`。
- 多次交易必须连续作为同一张牌的效果完成，不能先做别的行动再回来继续交易。
- 交易后可能超过 10 个香料，容量检查只在回合结束时处理。

电子版可以把交易次数作为一个整数选择：

```text
max_times = min(
  floor(player.spices[color] / trade_in[color])
  for each color with trade_in[color] > 0
)
allowed_times = 0..max_times
```

玩家确认 `times` 后：

```text
for each color:
  player.spices[color] -= trade_in[color] * times
  player.spices[color] += trade_out[color] * times
```

### 分数牌

分数牌共 36 张。洗混为分数牌堆，公开 5 张形成分数市场。

```text
PointCard:
  id: string
  cost: SpiceCounts
  points: integer
```

玩家通过 `claim` 行动支付 `cost`，拿走该分数牌。分数牌在玩家面前保存到游戏结束，建议电子版对所有人公开分值和已获得张数。

### 奖励币

- 金币：10 枚，每枚 3 分。
- 银币：10 枚，每枚 1 分。

游戏设置时：

- 左起第 1 张分数牌上方放 `2 * player_count` 枚金币。
- 左起第 2 张分数牌上方放 `2 * player_count` 枚银币。

获得奖励币规则：

- 如果玩家认领左起第 1 张分数牌，并且金币堆非空，拿 1 枚金币。
- 如果玩家认领左起第 2 张分数牌，并且银币堆非空，拿 1 枚银币。
- 当金币堆被拿空后，把剩余银币堆移动到左起第 1 张分数牌上方。
- 银币堆移动后，左起第 2 张分数牌不再有银币奖励。

实现上不要把奖励币绑定到具体卡牌 ID，而应绑定到市场槽位：

```text
bonus_slots:
  gold_slot: 0 if gold_remaining > 0 else null
  silver_slot: 1 while gold_remaining > 0 else 0
```

更简单的状态写法：

```text
gold_remaining = 2 * player_count
silver_remaining = 2 * player_count

function bonus_for_claimed_index(index):
  if gold_remaining > 0 and index == 0:
    gold_remaining -= 1
    if gold_remaining == 0:
      # UI 上银币堆显示移动到 index 0
    return gold
  if gold_remaining == 0 and silver_remaining > 0 and index == 0:
    silver_remaining -= 1
    return silver
  if gold_remaining > 0 and silver_remaining > 0 and index == 1:
    silver_remaining -= 1
    return silver
  return none
```

### 商队牌

每名玩家 1 张商队牌。规则上商队牌只提供：

- 香料容量上限：10。
- 起始玩家标记：随机发给某位玩家。

电子版不需要实体商队牌图，只要记录起始玩家和容量即可。

## 初始化

输入：

```text
player_count: 2..5
players: Player[]
merchant_deck_data: MerchantCard[]
point_deck_data: PointCard[]
random_seed?: string
```

流程：

1. 校验玩家人数为 2-5。
2. 建立 4 种香料供应，供应视为无限。
3. 洗混 36 张分数牌，形成 `point_deck`。
4. 从 `point_deck` 顶部翻开 5 张，形成 `point_market[0..4]`，左侧为索引 0。
5. 设置 `gold_remaining = player_count * 2`。
6. 设置 `silver_remaining = player_count * 2`。
7. 给每名玩家发起始手牌：
   - `starter_create_2`
   - `starter_upgrade_2`
8. 将多余起始商人牌移出游戏，不进入商人牌堆。
9. 洗混 43 张普通商人牌，形成 `merchant_deck`。
10. 从 `merchant_deck` 顶部翻开 6 张，形成 `merchant_market[0..5]`，左侧为索引 0。
11. 随机确定起始玩家。
12. 按回合顺位发初始香料：
    - 第 1 位：3 黄。
    - 第 2 位：4 黄。
    - 第 3 位：4 黄。
    - 第 4 位：3 黄、1 红。
    - 第 5 位：3 黄、1 红。
13. 所有玩家初始：
    - `played_cards = []`
    - `claimed_points = []`
    - `gold = 0`
    - `silver = 0`
14. 进入 `player_turn` 阶段，当前玩家为起始玩家。

## 游戏状态建议

```text
GameState:
  phase:
    setup
    player_turn
    resolving_card
    discard_to_limit
    game_over

  players: PlayerState[]
  current_player_index: integer
  first_player_index: integer
  turn_number: integer

  merchant_deck: MerchantCard[]
  merchant_market: MarketMerchantSlot[6]
  point_deck: PointCard[]
  point_market: PointCard[5]

  gold_remaining: integer
  silver_remaining: integer
  end_triggered: boolean
  end_trigger_player_index: integer | null
  final_player_index: integer | null

  pending_resolution:
    card_id?: string
    upgrade_steps_remaining?: integer
    trade_times_selected?: integer
    discard_needed?: integer
```

```text
PlayerState:
  id: string
  name: string
  hand: MerchantCard[]
  played_cards: MerchantCard[]
  spices: SpiceCounts
  claimed_points: PointCard[]
  gold: integer
  silver: integer
```

```text
SpiceCounts:
  yellow: integer
  red: integer
  green: integer
  brown: integer
```

```text
MarketMerchantSlot:
  card: MerchantCard
  spices_on_card: SpiceCounts
```

## 回合行动

当前玩家回合开始时，系统生成合法行动列表。

```text
legal_actions(player):
  actions = []
  if player.hand is not empty:
    actions.append(play)
  if merchant_market has at least 1 card:
    for each market index i:
      if total_spices(player.spices) >= i:
        actions.append(acquire(i))
  if player.played_cards is not empty:
    actions.append(rest)
  for each point index i:
    if can_pay(player.spices, point_market[i].cost):
      actions.append(claim(i))
  return actions
```

注意：规则中玩家回合必须执行 1 个行动。如果玩家没有已打出牌，`rest` 通常没有意义，也不应作为合法行动。基础局面下玩家总会至少有一种合法行动。

### 行动 A：打出商人牌 `play`

前置条件：

- 选择的 `card_id` 必须在当前玩家 `hand` 中。

执行：

1. 从 `hand` 移除该牌。
2. 将该牌加入 `played_cards`。
3. 按牌的 `type` 解析效果：
   - `spice`：立即增加指定香料。
   - `upgrade`：进入升级选择流程。
   - `trade`：进入交易次数选择流程。
4. 效果全部完成后，进入回合结束容量检查。

#### 升级牌解析

```text
resolve_upgrade(player, steps):
  while steps > 0 and player has any spice below brown:
    wait player choose one color in [yellow, red, green]
    player.spices[color] -= 1
    player.spices[next_color(color)] += 1
    steps -= 1
    player may choose Done early
```

客户端应允许玩家提前结束，不应强迫用完次数。

#### 交易牌解析

```text
resolve_trade(player, card, times):
  assert 0 <= times <= max_trade_times(player.spices, card.trade_in)
  for color in spices:
    player.spices[color] -= card.trade_in[color] * times
    player.spices[color] += card.trade_out[color] * times
```

如果 `times = 0`，该牌仍然被打出并进入已打出区。

### 行动 B：获得商人牌 `acquire`

前置条件：

- 目标索引 `i` 在 `merchant_market` 范围内。
- 当前玩家香料总数至少为 `i`，因为需要在其左侧每张牌上放 1 个任意香料。
- 玩家必须为左侧每个槽位选择 1 个要支付的香料颜色。

执行：

1. 对每个 `j` in `[0, i - 1]`：
   - 从玩家商队移除 1 个所选香料。
   - 把该香料放到 `merchant_market[j].spices_on_card`。
2. 取走目标槽位 `merchant_market[i].card`，加入玩家 `hand`。
3. 目标槽位上已有的所有香料加入玩家商队。
4. 市场补位：
   - 移除索引 `i` 的槽位。
   - 右侧牌向左滑动。
   - 如果 `merchant_deck` 非空，从牌堆顶补 1 张到最右侧，新槽位 `spices_on_card` 为空。
   - 如果 `merchant_deck` 为空，市场长度减少。通常实体牌堆足够支撑游戏，但电子版应允许牌堆耗尽。
5. 进入回合结束容量检查。

重要细节：

- 左起第 1 张商人牌免费，`i = 0` 时无需支付香料。
- 获得的商人牌进入手牌，可以在之后自己的回合打出；本回合不能继续行动。
- 拿牌时目标牌上的香料先加入商队，再做容量检查。
- 支付香料可以是任意颜色，不需要与被获得牌或左侧牌相关。

### 行动 C：休息 `rest`

前置条件：

- 当前玩家 `played_cards` 非空。

执行：

1. 将 `played_cards` 中所有牌移回 `hand`。
2. 清空 `played_cards`。
3. 进入回合结束容量检查。

休息不会获得香料，也不会刷新市场。

### 行动 D：认领分数牌 `claim`

前置条件：

- 目标索引 `i` 在 `point_market` 范围内。
- 当前玩家拥有目标分数牌 `cost` 所需全部香料。

执行：

1. 从玩家商队扣除目标分数牌的 `cost`。
2. 把该分数牌从 `point_market[i]` 移到玩家 `claimed_points`。
3. 根据目标索引发放奖励币：
   - 金币未空且 `i == 0`：玩家 `gold += 1`，`gold_remaining -= 1`。
   - 金币未空且 `i == 1` 且银币未空：玩家 `silver += 1`，`silver_remaining -= 1`。
   - 金币已空且 `i == 0` 且银币未空：玩家 `silver += 1`，`silver_remaining -= 1`。
4. 市场补位：
   - 移除索引 `i` 的分数牌。
   - 右侧牌向左滑动。
   - 如果 `point_deck` 非空，从牌堆顶补 1 张到最右侧。
   - 如果 `point_deck` 为空，市场长度减少。
5. 检查游戏结束触发：
   - 2-3 人局：任一玩家获得第 6 张分数牌时触发。
   - 4-5 人局：任一玩家获得第 5 张分数牌时触发。
6. 进入回合结束容量检查。

注意：一次回合只能认领 1 张分数牌。即使支付后仍能支付其他分数牌，也必须等下一回合。

## 回合结束

每个行动解析完后，必须执行统一回合结束流程。

```text
end_turn(player):
  if total_spices(player.spices) > 10:
    phase = discard_to_limit
    discard_needed = total_spices(player.spices) - 10
    wait player choose spices to discard
  finalize_turn()
```

弃香料流程：

```text
discard_to_limit(player, discard_counts):
  assert discard_counts <= player.spices by color
  assert total(discard_counts) == total_spices(player.spices) - 10
  player.spices -= discard_counts
  finalize_turn()
```

`finalize_turn()`：

1. 如果游戏结束已经触发，并且当前玩家是本轮最后一名应行动的玩家，则进入 `game_over`。
2. 否则 `current_player_index = next_player(current_player_index)`。
3. `turn_number += 1`。
4. 进入 `player_turn`。

## 游戏结束

触发条件：

- 2-3 人局：某名玩家认领第 6 张分数牌。
- 4-5 人局：某名玩家认领第 5 张分数牌。

触发后不立刻结束，而是完成当前轮，使所有玩家拥有相同回合数。实现方法：

```text
on_end_trigger(trigger_player):
  end_triggered = true
  end_trigger_player_index = trigger_player.index
  final_player_index = previous_player(first_player_index)
```

因为每轮从 `first_player_index` 开始，当前轮最后行动者是起始玩家的右手边玩家，即 `previous_player(first_player_index)`。当 `final_player_index` 完成其回合后结束游戏。

如果触发者正好是 `final_player_index`，则该玩家回合结束后立即结算。

## 计分

每名玩家总分：

```text
score =
  sum(card.points for card in claimed_points)
  + gold * 3
  + silver * 1
  + count_non_yellow_spices(spices) * 1
```

黄香料不计分；红、绿、棕每个各 1 分。

胜者为最高分玩家。若平手，按规则由“最后行动的平手玩家”获胜。实现时可按最终回合顺序逆序检查平手玩家：

```text
tie_break_order = players ordered from final_player_index backward to next_player(final_player_index)
winner = first player in tie_break_order whose score == max_score
```

也可以记录每名玩家最后一次行动的 `turn_number`，平手时取 `last_turn_number` 最大者。

## 合法性校验细节

### 香料支付

```text
can_pay(spices, cost):
  for color in [yellow, red, green, brown]:
    if spices[color] < cost[color]:
      return false
  return true
```

### 商人牌购买成本

购买第 `i` 张商人牌需要支付 `i` 个香料，分别放到索引 `< i` 的每张牌上。支付选择必须逐个绑定市场槽位，以便 UI 正确显示每张牌上积累的香料。

```text
AcquirePayment:
  target_index: integer
  payments:
    - slot_index: 0
      color: yellow
    - slot_index: 1
      color: red
```

校验：

- `len(payments) == target_index`
- `payments.slot_index` 恰好覆盖 `0..target_index-1`
- 玩家对应颜色香料足够支付总量

### 市场补位方向

两个市场都使用同一补位逻辑：

- 玩家拿走某个索引的牌。
- 该索引右侧所有牌向左移动。
- 从牌堆顶补到最右侧。

这意味着新牌永远出现在最贵/最右的位置；旧牌会逐渐向左变便宜。

### 手牌公开性

实体版中玩家手牌通常对自己可见、对其他玩家隐藏；已打出牌公开；商队香料公开；已认领分数牌可面朝下但分数总量通常可以追踪。

电子版建议：

- 自己：显示完整手牌、已打出牌、香料、分数牌。
- 他人：隐藏手牌具体内容，只显示手牌数量；显示已打出牌、香料、金币银币、已认领分数牌数量和公开分值。
- 如果想降低记忆负担，可以把所有已认领分数牌公开。

## 数据文件建议

由于官方机器可读牌表仍不可得，建议把牌表与规则引擎分离。当前仓库已有一份从 TTS 脚本化模组提取的非官方牌表：

- JSON：`designs/century_spice_road/extracted/century_spice_road_tts_cards.json`
- 人工校对表：`designs/century_spice_road/extracted/century_spice_road_tts_cards.md`
- 原始 TTS 保存文件：`designs/century_spice_road/tabletop_simulator/`

提取来源为 Steam Workshop `2436905576`，标题 `Century: Spice Road [Fully Scripted by Korjak]`。该模组的 Lua 脚本把每张卡的规则数据编码在卡牌昵称/名称中，字段顺序为：

```text
points
cost.yellow
cost.red
cost.green
cost.brown
gain.yellow
gain.red
gain.green
gain.brown
upgrade_steps
```

示例：分数牌编码 `12111100000` 表示 `points = 12`，花费 `yellow = 1, red = 1, green = 1, brown = 1`；商人牌编码 `200002000` 表示花费 `yellow = 2`，获得 `red = 2`。

```text
game/century_spice_road_data.py
  STARTER_CARDS
  MERCHANT_CARDS
  POINT_CARDS

game/century_spice_road.py
  state dataclasses
  setup
  legal_actions
  apply_action
  scoring
```

牌表格式示例：

```python
STARTER_CARDS = [
    {
        "id": "starter_create_2",
        "type": "spice",
        "gain": {"yellow": 2, "red": 0, "green": 0, "brown": 0},
    },
    {
        "id": "starter_upgrade_2",
        "type": "upgrade",
        "upgrade_steps": 2,
    },
]

MERCHANT_CARDS = [
    {
        "id": "m001",
        "type": "spice",
        "gain": {"yellow": 1, "red": 1, "green": 0, "brown": 0},
    },
    {
        "id": "m002",
        "type": "trade",
        "trade_in": {"yellow": 2, "red": 0, "green": 0, "brown": 0},
        "trade_out": {"yellow": 0, "red": 0, "green": 1, "brown": 0},
    },
]

POINT_CARDS = [
    {
        "id": "p001",
        "cost": {"yellow": 2, "red": 0, "green": 2, "brown": 0},
        "points": 8,
    },
]
```

## 前端实现建议

### 主界面区域

建议布局：

1. 顶部：玩家顺位、当前玩家、高亮回合状态、金币/银币剩余。
2. 中部上方：5 张分数牌市场，每张显示需求香料、分值、槽位奖励币。
3. 中部下方：6 张商人牌市场，每张显示效果、购买成本位置、牌上积累的香料。
4. 底部：当前玩家手牌和已打出牌。
5. 侧边或底部折叠区：所有玩家商队、已得分数牌、金币银币、手牌数量。
6. 右侧：日志与 Help/Explain。

### 香料显示

按照 `FRONTEND.md`，建议使用颜色块或 Emoji：

- 🟨 黄
- 🟥 红
- 🟩 绿
- 🟫 棕
- 🪙 金币
- ⚪ 银币

香料数量可以显示为 `🟨×3`。为避免移动端拥挤，可用紧凑 badge。

### 操作交互

- 打牌：点击手牌后显示可执行效果；生产牌可直接确认，升级/交易牌进入选择器。
- 升级：显示 4 种香料按钮，仅可点可升级颜色；显示剩余升级次数；`Done` 结束。
- 交易：显示 `-输入 -> +输出`，用 stepper 选择次数，范围 `0..max_times`。
- 买商人牌：点击市场牌；若需支付香料，弹出逐槽位支付选择；左侧每张牌旁显示将放置的香料。
- 认领分数牌：点击可支付的分数牌；确认后扣资源拿牌。
- 容量超限：行动后如超过 10，强制弹出弃香料选择，完成前不能进入下一玩家。

### Help 和 Explain

Help 应覆盖：

- 四种行动的含义。
- 商人市场为什么左边免费、右边更贵。
- 交易牌可以重复执行。
- 回合结束才检查 10 个香料上限。
- 游戏结束触发和计分方式。

Explain 应能解释当前玩家为什么某个动作可用或不可用，例如：

- “不能认领这张分数牌：缺少 🟩×1、🟫×1。”
- “不能购买第 5 张商人牌：需要支付 4 个香料，你只有 3 个。”
- “这张交易牌最多可执行 2 次，因为你只有 🟨×5，而每次需要 🟨×2。”
- “你现在有 12 个香料，必须弃掉 2 个后结束回合。”

## 推荐测试用例

### 初始化

- 2、3、4、5 人局均能正确初始化。
- 分数市场 5 张，商人市场 6 张。
- 金币和银币初始数量均为 `2 * player_count`。
- 起始玩家 3 黄；第 2、3 位 4 黄；第 4、5 位 3 黄 1 红。

### 打牌

- `Create 2` 增加 2 黄。
- `Upgrade 2` 可以把 1 黄升成 1 绿。
- `Upgrade 2` 可以把 2 个黄分别升成 2 个红。
- `Upgrade 2` 可以只执行 0 或 1 次。
- 交易牌可以执行 0 次。
- 交易牌可以按最大次数重复执行。

### 获得商人牌

- 购买最左牌免费。
- 购买第 4 张需要在左侧 3 张牌上各放 1 个香料。
- 拿走有香料的商人牌时，牌上香料进入玩家商队。
- 市场补位方向正确，新牌进入最右侧。

### 认领分数牌

- 资源不足时不能认领。
- 认领后正确扣除香料并获得分数牌。
- 认领第 1 张获得金币；认领第 2 张获得银币。
- 金币耗尽后，银币奖励移动到第 1 张。
- 一回合不能认领多张分数牌。

### 容量上限

- 行动中可以超过 10 个香料。
- 回合结束时必须弃到 10 个。
- 弃置颜色由玩家选择。

### 游戏结束与计分

- 2-3 人局第 6 张分数牌触发结束。
- 4-5 人局第 5 张分数牌触发结束。
- 触发后补完当前轮。
- 金币 3 分，银币 1 分，非黄香料每个 1 分。
- 平手时最后行动的平手玩家获胜。

## 实现风险

最大风险不是规则流程，而是 TTS 牌表的权威性和版权边界。当前已提取到可实现用的 43 张普通商人牌、36 张分数牌和起始牌数据，但它们来自玩家制作的 TTS 模组，不是官方数据文件。牌面美术和贴图 URL 只可作为校对线索，不应直接用于生产 UI。建议开发顺序：

1. 先实现规则引擎、市场、四种行动、计分。
2. 用 TTS 提取牌表跑通全流程。
3. 用实体牌或授权资料校对 TTS 牌表。
4. 使用自制或授权美术替代 TTS/官方扫描贴图。
5. 再做动画、Help/Explain 和移动端优化。
