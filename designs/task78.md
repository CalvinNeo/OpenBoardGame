# Task 78: 《上流社会》规则与电子版实现规格

## 游戏识别

- 中文名：《上流社会》
- 英文名：`High Society`
- 作者：Reiner Knizia
- 首版：Ravensburger，1995
- 常见新版：Osprey Games，2018
- 人数：3-5 人
- 时长：约 15-30 分钟
- 类型：拍卖、固定面额金钱手牌、风险管理、分数倍率、最低现金淘汰

本文目标不是复刻规则书原文，而是把规则整理成足够实现电子版的状态机说明。已核对的公开来源：

- Osprey Games 2018 英文规则书 PDF：`https://www.ospreypublishing.com/media/1fohbutt/hisoc_rulebook_for_web.pdf`
- Reiner Knizia / Ravensburger 1995 英文规则 PDF：`https://www.convivium.org.uk/knizia/HighSociety.pdf`
- UltraBoardGames 规则页：`https://www.ultraboardgames.com/high-society/game-rules.php`

## 无法获取的游戏资源

以下资源无法从公开规则中完整、合法、结构化地取得，电子版开发时需要自行补充、授权、重绘或用占位内容替代：

1. **官方牌面美术**
   - 16 张地位牌、55 张金钱牌、牌背、盒面和图标插画均受版权保护。
   - 电子版应使用自制 UI、文字牌、Emoji、颜色块或授权素材，不应直接复制商业牌面。
2. **Osprey 2018 版每张牌的主题名称与完整视觉呈现**
   - 公开规则能确认牌的功能类别和值，但没有提供可机器读取的完整牌面数据表。
   - 规则实现只需要数值与效果，不依赖具体奢侈品名称。
3. **各版本的外观差异资源**
   - 旧版叫 `Possession / Title / Misfortune`，新版叫 `Luxury / Prestige / Disgrace`，规则基本一致，但牌面名称、背景颜色、插画和货币视觉会因版本不同而变化。
   - 本文以 Osprey 2018 的术语为主，并在必要处标注旧版等价术语。
4. **本地化文本与教学文案**
   - 官方中文译名、牌名、Help、Explain、日志文本需要自行撰写。
5. **音频与动效**
   - 出价、流拍、弃钱、结算等音效和动画不是规则必需项，需要自行设计。

## 核心玩法概览

所有玩家拥有相同的一组 11 张金钱牌。每轮翻开 1 张地位牌并围绕它拍卖：

- 如果是正向牌，玩家竞价争取获得它。
- 如果是负向牌，玩家竞价避免获得它。

金钱牌是一次性资源。赢得正向牌或在负向牌中没有先退出的玩家，会把自己本轮打出的金钱弃掉并永久失去。主动退出的玩家通常拿回自己本轮打出的金钱。

游戏结束时，先比较每名玩家手中剩余金钱总额。剩余金钱最少的玩家全部被淘汰，不能获胜。未被淘汰的玩家再按地位牌计算分数，最高分获胜。

## 组件

### 金钱牌

共有 5 套金钱牌，每套 11 张，每名玩家使用同色的一整套。旧版英文规则列出的面额如下，电子版可直接使用这些整数：

| card_id | value |
|---|---:|
| `money_1000` | 1000 |
| `money_2000` | 2000 |
| `money_3000` | 3000 |
| `money_4000` | 4000 |
| `money_6000` | 6000 |
| `money_8000` | 8000 |
| `money_10000` | 10000 |
| `money_12000` | 12000 |
| `money_15000` | 15000 |
| `money_20000` | 20000 |
| `money_25000` | 25000 |

实现要点：

- 玩家手牌中的金钱牌对自己可见。
- 其他玩家只应看到该玩家剩余金钱牌张数，不应看到具体面额。
- 本轮已打出的金钱牌在桌面上公开显示，所有人都能看到面额和总额。
- 已支付或被弃掉的金钱牌永久移出游戏，建议背面朝下进入 `spent_money`，其他玩家不应看到弃牌具体面额。
- 玩家不能找零，不能拆分面额，不能把已打出的金钱牌替换成别的组合；若要提高本轮出价，只能追加新的手牌。

### 地位牌

共有 16 张地位牌，洗混成一个牌堆。

```text
StatusCard:
  id: string
  type: luxury | prestige | disgrace
  value?: integer
  effect?: double | discard_luxury | minus_5 | halve
  is_end_marker: boolean
```

#### 奢侈牌 / `luxury`

10 张，数值为 1-10。获得后公开放在玩家面前，游戏结束时提供等于牌面数值的基础地位分。

```text
luxury_1  value 1
luxury_2  value 2
...
luxury_10 value 10
```

只有这些数值为 1-10 的牌才算“奢侈牌”。这点会影响 `faux_pas` 的弃牌效果。

#### 声望牌 / `prestige`

3 张，每张使拥有者的结算地位分翻倍。获得后公开放在玩家面前。

```text
prestige_1 effect double is_end_marker true
prestige_2 effect double is_end_marker true
prestige_3 effect double is_end_marker true
```

多张声望牌连乘：

- 1 张：乘以 2
- 2 张：乘以 4
- 3 张：乘以 8

#### 丑闻牌 / `disgrace`

3 张，属于负向牌，拍卖方式不同。

| id | 新版名称 | 旧版等价 | effect | is_end_marker |
|---|---|---|---|---|
| `faux_pas` | Faux Pas | Theft | 弃掉 1 张奢侈牌 | false |
| `passe` | Passe / Passé | Gambling Debt | 结算时 -5 | false |
| `scandale` | Scandale | Scandal | 结算时最终分减半 | true |

`scandale` 与 3 张 `prestige` 都是游戏结束标记牌。只要第 4 张结束标记牌被翻开，游戏立即结束，不对这张刚翻开的牌进行拍卖。

## 初始化

输入：

```text
player_count: 3..5
players: Player[]
random_seed?: string
```

流程：

1. 校验玩家人数为 3-5。
2. 给每名玩家一套完整的 11 张金钱牌，放入其秘密手牌。
3. 创建 16 张地位牌并洗混，形成 `status_deck`。
4. 所有玩家初始状态：
   - `hand_money = full_money_set`
   - `table_money = []`
   - `status_cards = []`
   - `pending_faux_pas = false`
   - `spent_money_total` 可以只做日志统计，不参与规则。
5. 随机或由房主指定起始玩家 `start_player_id`。
6. 进入 `reveal_status` 阶段。

## 游戏状态建议

```text
GameState:
  phase:
    setup
    reveal_status
    normal_auction
    disgrace_auction
    resolve_round
    game_over

  players: PlayerState[]
  status_deck: StatusCard[]
  current_status_card: StatusCard | null
  start_player_id: player_id
  active_player_id: player_id | null
  auction_active_players: set<player_id>
  current_high_bid: integer
  current_high_bidder_id: player_id | null
  end_marker_revealed_count: integer
  round_number: integer
  log: Event[]

PlayerState:
  id: player_id
  name: string
  hand_money: MoneyCard[]
  table_money: MoneyCard[]
  spent_money_count: integer
  status_cards: StatusCard[]
  pending_faux_pas: boolean
  eliminated: boolean
  final_money_total?: integer
  final_status_score?: number
```

`end_marker_revealed_count` 必须统计已经翻开的结束标记牌，包括刚翻开但因触发游戏结束而不会拍卖的那张。

## 每轮流程

### 1. 翻开地位牌

```text
current_status_card = status_deck.pop_top()
if current_status_card.is_end_marker:
  end_marker_revealed_count += 1

if end_marker_revealed_count == 4:
  current_status_card = null or keep_as_unauctioned
  phase = game_over
  run_final_scoring()
else if current_status_card.type == disgrace:
  setup_disgrace_auction()
else:
  setup_normal_auction()
```

游戏结束触发点非常重要：第 4 张结束标记牌一翻开就立刻结束，不允许玩家为它竞拍，也不把它给任何玩家。

### 2. 普通拍卖：争取正向牌

适用于 `luxury` 和 `prestige`。

初始化：

```text
phase = normal_auction
auction_active_players = all players
active_player_id = start_player_id
current_high_bid = 0
current_high_bidder_id = null
clear all player.table_money
```

当前玩家可执行 2 种动作：

```text
ActionBid:
  type: bid
  money_card_ids: string[]

ActionPass:
  type: pass
```

#### 普通拍卖合法出价

玩家选择 1 张或多张自己手中的金钱牌，追加到自己的 `table_money`。

合法性：

```text
player_id == active_player_id
player_id in auction_active_players
money_card_ids all in player.hand_money
money_card_ids is not empty
new_total = sum(player.table_money) + sum(selected_money)
new_total > current_high_bid
```

执行：

```text
move selected_money from hand_money to table_money
current_high_bid = new_total
current_high_bidder_id = player_id
advance active_player_id clockwise to next player in auction_active_players
```

规则细节：

- 玩家可以多次出价，只要每次轮到他时追加金钱后总额超过当前最高出价。
- 已打出的金钱不能撤回、替换或拆开。
- 如果玩家手中没有任何组合能使自己的桌面总额超过当前最高出价，就只能 `pass`。

#### 普通拍卖 Pass

执行：

```text
move player.table_money back to player.hand_money
remove player_id from auction_active_players

if size(auction_active_players) == 1:
  winner_id = only remaining player
  resolve_normal_auction(winner_id)
else:
  advance active_player_id clockwise to next player in auction_active_players
```

注意：如果所有其他玩家都依次 Pass，最后剩下的玩家即使还没有出过价，也获得这张牌且不支付金钱。这是“所有人都不愿意出价时，最后仍未退出的人免费获得牌”的情况。

### 3. 普通拍卖结算

```text
function resolve_normal_auction(winner_id):
  give current_status_card to winner.status_cards
  discard winner.table_money face-down to spent pile
  clear winner.table_money
  for each non-winner:
    assert player.table_money is empty

  if winner.pending_faux_pas and current_status_card.type == luxury:
    discard current_status_card from winner.status_cards
    winner.pending_faux_pas = false
    discard faux_pas marker/effect

  start_player_id = winner_id
  current_status_card = null
  phase = reveal_status
```

`pending_faux_pas` 的处理只在玩家“下一次获得奢侈牌”时触发，不影响获得声望牌。

### 4. 负向拍卖：避免丑闻牌

适用于 `faux_pas`、`passe`、`scandale`。

负向拍卖与普通拍卖的核心区别：

- 玩家不是争取获得牌，而是花钱避免拿到它。
- 一旦任意玩家 Pass，本轮立即结束。
- Pass 的玩家拿回自己的本轮出价，并获得这张负向牌。
- 其他所有玩家把自己本轮桌面上的金钱弃掉。

初始化：

```text
phase = disgrace_auction
auction_active_players = all players
active_player_id = start_player_id
current_high_bid = 0
current_high_bidder_id = null
clear all player.table_money
```

出价合法性与普通拍卖相同：

```text
new_total = sum(player.table_money) + sum(selected_money)
new_total > current_high_bid
```

出价执行后，轮到左侧下一名玩家。这里不需要移除任何玩家，因为负向拍卖只会因第一次 Pass 结束。

#### 负向拍卖 Pass

```text
function disgrace_pass(taker_id):
  move taker.table_money back to taker.hand_money
  for each player except taker:
    discard player.table_money face-down to spent pile
    clear player.table_money

  give current_status_card to taker.status_cards or apply immediate effect
  apply_disgrace_if_needed(taker_id, current_status_card)
  start_player_id = taker_id
  current_status_card = null
  phase = reveal_status
```

这意味着起始玩家可以在负向牌翻开后立刻 Pass，直接拿走负向牌且无人支付金钱。也意味着某些玩家在该负向拍卖中可能还没有行动，本轮就已经结束。

### 5. 丑闻牌效果

#### `faux_pas`

获得后立即处理：

```text
function apply_faux_pas(player):
  luxury_cards = player.status_cards where type == luxury
  if luxury_cards not empty:
    prompt player to choose one luxury card
    discard chosen luxury card from game
    discard faux_pas card from player.status_cards
  else:
    player.pending_faux_pas = true
    keep faux_pas visible as pending marker
```

当 `pending_faux_pas == true` 的玩家以后获得任意 `luxury` 牌时：

```text
discard that newly gained luxury card
player.pending_faux_pas = false
discard faux_pas card from player.status_cards
```

实现细节：

- `faux_pas` 只能弃掉 `luxury_1` 到 `luxury_10`。
- 不能弃掉 `prestige`、`passe`、`scandale`。
- 如果玩家已有多张奢侈牌，选择权属于获得 `faux_pas` 的玩家。
- 如果玩家没有奢侈牌，后续获得的第一张奢侈牌会被自动弃掉；不应让玩家选择保留新牌而弃旧牌，因为旧牌当时不存在。

#### `passe`

获得后公开留在玩家面前。游戏结束计分时，在奢侈牌基础分之后扣 5 分。

#### `scandale`

获得后公开留在玩家面前。游戏结束计分时，在加总、扣 5、声望翻倍之后，把分数减半。

## 结算顺序

游戏结束时执行：

1. 所有玩家公开手中剩余金钱牌。
2. 计算每名玩家 `final_money_total = sum(hand_money)`。
3. 找出最小 `final_money_total`。
4. 所有等于最小值的玩家 `eliminated = true`，不能获胜。
5. 对所有玩家计算 `final_status_score`，便于展示；但只有未淘汰玩家参与胜负比较。
6. 未淘汰玩家中，`final_status_score` 最高者获胜。
7. 若分数平局，比较剩余金钱总额，高者获胜。
8. 若仍平局：
   - Osprey 2018 规则：比较单张最高奢侈牌，高者获胜。
   - 1995 英文规则：仍平局则并列获胜。
   - 建议电子版默认采用 Osprey 2018：再比较最高单张奢侈牌；若仍相同，则并列获胜。

### 分数算法

```text
function score_player(player):
  score = sum(card.value for card in player.status_cards where card.type == luxury)

  if player has passe:
    score -= 5

  prestige_count = count(card.type == prestige)
  score *= 2 ** prestige_count

  if player has scandale:
    score /= 2

  return score
```

分数可能出现负数或 `.5` 小数。例如基础分 1，扣 5 后为 -4，再被 `scandale` 减半为 -2。规则没有要求向上或向下取整，因此电子版应保留精确数值。若希望 UI 简洁，可以用整数或一位小数显示。

### 计分示例

玩家拥有：

- 奢侈牌：`3`、`9`
- `passe`
- 2 张 `prestige`
- `scandale`

计算：

```text
base = 3 + 9 = 12
after_passe = 12 - 5 = 7
after_prestige = 7 * 2 * 2 = 28
after_scandale = 28 / 2 = 14
```

最终地位分为 14。

## 合法动作汇总

### `bid`

```text
{
  "type": "bid",
  "money_card_ids": ["money_4000", "money_8000"]
}
```

只在 `normal_auction` 或 `disgrace_auction` 阶段可用。

校验：

- 必须是当前行动玩家。
- 选择的金钱牌必须都在玩家手牌中。
- 至少选择 1 张。
- 选择后自己的桌面总额必须严格大于 `current_high_bid`。

执行：

- 选中的金钱从手牌移到桌面。
- 更新最高出价。
- 轮到下一名玩家。

### `pass`

```text
{
  "type": "pass"
}
```

普通拍卖：

- 玩家拿回自己的桌面金钱。
- 玩家退出本轮。
- 如果只剩 1 名玩家，该玩家赢得地位牌。

负向拍卖：

- 本轮立即结束。
- Pass 玩家拿回自己的桌面金钱并获得负向牌。
- 其他玩家弃掉桌面金钱。

### `choose_faux_pas_discard`

```text
{
  "type": "choose_faux_pas_discard",
  "luxury_card_id": "luxury_4"
}
```

只在玩家获得 `faux_pas` 且已有至少 1 张奢侈牌时需要。

校验：

- 只能选择自己面前的 `luxury` 牌。
- 不能选择声望牌或其他负向牌。

## 回合推进与暂停要求

根据仓库 `FRONTEND.md`，每一轮结束后需要暂停，让所有人查看状态，所有玩家点击 `Next Round` 后才继续下一轮。

建议实现：

```text
phase = round_summary
next_ready_player_ids = set()

after resolve_normal_auction or disgrace_pass:
  show:
    - 本轮翻开的地位牌
    - 获得者或负向牌承担者
    - 本轮支付/退回结果
    - 当前所有玩家公开地位牌
    - 每名玩家剩余金钱牌张数
  wait until all connected players clicked Next Round
  phase = reveal_status
```

游戏结束时不需要 `Next Round`，直接展示最终金钱公开、淘汰、分数和胜者。

## 电子版 UI 建议

### 玩家视角

当前玩家应看到：

- 自己的 11 张金钱牌中尚未花掉的牌，按面额排序。
- 自己本轮已打出的金钱牌与总额。
- 当前最高出价。
- 当前地位牌。
- 所有玩家公开的地位牌。
- 所有玩家剩余金钱牌张数。

其他玩家应看到：

- 当前行动玩家是谁。
- 每名玩家本轮桌面公开出价。
- 每名玩家剩余金钱牌张数。
- 不显示其他玩家手中具体金钱面额。

### 出价交互

建议使用可点击的金钱牌按钮：

- 点击金钱牌加入本次追加出价预览。
- 点击已选牌取消本次追加选择。
- 显示 `new_total` 与 `minimum_required = current_high_bid + 1`。
- `Bid` 按钮只有在 `new_total > current_high_bid` 时可用。
- `Pass` 始终可用。

不要要求玩家输入 JSON 或手动输入金额，因为金钱是固定面额牌，合法性取决于具体牌而不是任意数字。

### 信息隐藏

必须隐藏：

- 其他玩家手中的具体金钱牌。
- 已支付弃牌堆里的具体面额。

可以公开：

- 玩家已获得地位牌。
- 本轮桌面上每名玩家当前打出的金钱牌。
- 每名玩家手牌剩余张数。
- 游戏结束后的所有剩余金钱牌。

## AI / 自动玩家建议

如果需要机器人，最小可用策略：

### 普通拍卖

估值：

```text
if luxury:
  value_score = luxury.value
if prestige:
  current_base = sum(luxury values) - passe_penalty
  value_score = max(2, current_base * (2 ** prestige_count))
```

出价上限可以按以下因素调整：

- 自己剩余金钱总额相对其他玩家是否危险。
- 当前正向牌对自己的边际分值。
- 已翻开的结束标记数量，越接近结束越保守。
- 是否存在 `pending_faux_pas`，若是则奢侈牌价值应视为 0 或很低。

### 负向拍卖

负向牌损失估值：

- `faux_pas`：若已有高值奢侈牌，损失约等于可弃牌中的最低值或未来第一张奢侈牌预期值；若没有奢侈牌且游戏接近结束，损失可能很低。
- `passe`：基础损失 5，之后会被声望牌放大，也会被 `scandale` 减半。
- `scandale`：损失约为当前最终分的一半，对高分玩家非常危险。

机器人应避免花到成为最少剩余金钱的状态。这个约束比单张牌价值更重要。

## 边界情况

1. **第 4 张结束标记是 `scandale`**
   - 游戏立即结束，没人获得这张 `scandale`。
2. **普通拍卖无人出价**
   - 当只剩 1 名未 Pass 玩家时，该玩家免费获得牌。
3. **负向拍卖起始玩家直接 Pass**
   - 起始玩家获得负向牌，所有人都不支付金钱。
4. **负向拍卖中有人 Pass 前，其他玩家已出价**
   - Pass 玩家拿回自己的桌面钱。
   - 其他玩家的桌面钱全部弃掉。
5. **玩家没有足够金钱超过当前出价**
   - 不能出价，只能 Pass。
6. **玩家手牌为空**
   - 不能出价，只能 Pass。
7. **`faux_pas` 遇到没有奢侈牌的玩家**
   - 标记 `pending_faux_pas = true`，后续第一张获得的奢侈牌自动弃掉。
8. **被 `faux_pas` 弃掉的牌**
   - 返回盒子/移出游戏，不进入任何玩家得分。
9. **最低剩余金钱多人并列**
   - 所有这些玩家都被淘汰。
10. **所有未淘汰玩家都不存在**
   - 正常 3-5 人游戏中不可能，因为最低金钱玩家被淘汰后，若所有人金钱完全相同，则所有玩家都会被淘汰。规则写法确实允许“玩家或玩家们”最低者出局。
   - 电子版需要处理这个极端情况：建议显示“所有玩家都因并列最少金钱被淘汰，无人获胜”或按房规宣布最高分者胜。默认应忠实规则：无人获胜。

## 推荐数据定义

```text
MONEY_VALUES = [1000, 2000, 3000, 4000, 6000, 8000, 10000, 12000, 15000, 20000, 25000]

STATUS_CARDS = [
  { id: "luxury_1", type: "luxury", value: 1, is_end_marker: false },
  { id: "luxury_2", type: "luxury", value: 2, is_end_marker: false },
  { id: "luxury_3", type: "luxury", value: 3, is_end_marker: false },
  { id: "luxury_4", type: "luxury", value: 4, is_end_marker: false },
  { id: "luxury_5", type: "luxury", value: 5, is_end_marker: false },
  { id: "luxury_6", type: "luxury", value: 6, is_end_marker: false },
  { id: "luxury_7", type: "luxury", value: 7, is_end_marker: false },
  { id: "luxury_8", type: "luxury", value: 8, is_end_marker: false },
  { id: "luxury_9", type: "luxury", value: 9, is_end_marker: false },
  { id: "luxury_10", type: "luxury", value: 10, is_end_marker: false },
  { id: "prestige_1", type: "prestige", effect: "double", is_end_marker: true },
  { id: "prestige_2", type: "prestige", effect: "double", is_end_marker: true },
  { id: "prestige_3", type: "prestige", effect: "double", is_end_marker: true },
  { id: "faux_pas", type: "disgrace", effect: "discard_luxury", is_end_marker: false },
  { id: "passe", type: "disgrace", effect: "minus_5", is_end_marker: false },
  { id: "scandale", type: "disgrace", effect: "halve", is_end_marker: true }
]
```

## 测试用例建议

1. **普通拍卖追加出价**
   - 玩家先出 4000，之后只能追加手牌；不能撤回 4000 改成 6000。
2. **普通拍卖免费获得**
   - A、B 先后 Pass，3 人局中 C 免费获得当前正向牌。
3. **普通拍卖支付**
   - 获胜者桌面金钱进入弃牌；已 Pass 玩家桌面金钱回手。
4. **负向拍卖第一人 Pass**
   - 当前起始玩家获得负向牌；无人弃钱。
5. **负向拍卖弃掉其他人桌面钱**
   - A 出 4000，B 出 6000，C Pass；C 拿牌并拿回自己的钱，A/B 桌面钱弃掉。
6. **`faux_pas` 立即弃牌**
   - 玩家已有 `luxury_8` 和 `luxury_3`，获得 `faux_pas` 后可选择弃其中一张奢侈牌，`faux_pas` 自身也弃掉。
7. **`faux_pas` 延迟弃牌**
   - 玩家无奢侈牌时获得 `faux_pas`，之后获得 `prestige` 不触发，之后获得 `luxury_5` 自动弃掉。
8. **第 4 张结束标记**
   - 翻开第 4 张 `prestige/scandale` 标记时立即结束，不把该牌给任何人。
9. **最低金钱淘汰**
   - 最高分玩家若剩余金钱最少，仍被淘汰。
10. **并列最低全部淘汰**
   - 两名玩家同为最低金钱，两人都不能获胜。
11. **Osprey 平局规则**
   - 未淘汰玩家分数相同，先比剩余金钱，再比最高单张奢侈牌。

## 实现优先级

1. 先实现纯逻辑状态机：
   - 洗牌
   - 翻牌
   - 普通拍卖
   - 负向拍卖
   - 三种负向牌效果
   - 游戏结束和计分
2. 再实现前端：
   - 自己金钱牌按钮
   - 当前地位牌
   - 玩家公开地位区
   - 出价/Pass 控件
   - 每轮暂停和 `Next Round`
   - 终局计分面板
3. 最后补充：
   - Help / Explain
   - AI
   - 动画、音效、自制牌面美术

