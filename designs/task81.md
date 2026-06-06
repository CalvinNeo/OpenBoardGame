# Task 81: 《袋中菲力猫》规则与电子版实现规格

## 游戏识别

- 中文常见名：《袋中菲力猫》《菲力猫》
- 英文名：`Felix: The Cat in the Sack`，部分版本名为 `Felicity: The Cat in the Sack`
- 德文原名：`Filou - Die Katze im Sack`
- 作者：Friedemann Friese
- 首版年份：2007
- 人数：3-5 人
- 时长：约 20-30 分钟
- 类型：同时暗出牌、信息逐步公开、升价拍卖、诈唬、风险评估

本文目标不是复刻规则书原文，而是把规则整理成足够实现电子版的状态机说明。已核对的公开来源：

- 英文规则 PDF：`https://world-of-board-games.com.sg/docs/Filou.pdf`
- UltraBoardGames 规则页：`https://www.ultraboardgames.com/felicity-the-cat-in-the-sack/game-rules.php`
- 繁体中文介绍与规则摘要：`https://www.phantasia.tw/bg/home/328`
- BoardGameGeek 版本页用于确认中文版本名：`https://boardgamegeek.com/boardgameversion/80868/chinese-felix-edition`

## 无法获取的游戏资源

以下资源无法从公开规则中完整、合法、结构化地取得，电子版开发时需要自行补充、授权、重绘或用占位内容替代：

1. **官方牌面美术**
   - 50 张动物牌的插画、牌背、盒面、说明书版式与图标均受版权保护。
   - 电子版应使用自制猫/狗/兔图标、文字牌、颜色块或授权素材，不应直接复制商业牌面。
2. **官方中文规则书全文**
   - 商品页称中文版本内含繁体中文、简体中文规则说明书，但公开页面只提供摘要和部分流程，不提供可复用的完整规则书文本。
   - 本文以英文规则为准，自行整理中文实现规格。
3. **各发行版本的准确视觉差异**
   - 不同版本可能使用 `Felix`、`Felicity`、`Filou` 等命名，牌面角色与版式不同。
   - 规则实现只依赖卡牌类型、数值和效果，不依赖具体人物形象。
4. **起始玩家标记物造型**
   - 规则只要求有起始玩家标记；商品图中的实体造型不能直接复刻。
   - 电子版可用通用“袋子”或“起始玩家”标记替代。
5. **音效、动效、教学文本**
   - 出价、弃拍、翻牌、狗赶猫、结算等表现资源不是规则必需项，需要自行设计。

## 核心玩法概览

每名玩家有同构的一套 10 张动物牌：好猫、坏猫、兔子、大狗、小狗。游戏开始时，每套牌会被左手边玩家随机移除 1 张，所以每名玩家实际只用 9 张牌打完 9 轮。

每轮所有玩家各暗出 1 张牌，形成“袋中内容”。随后玩家围绕这些暗牌进行升价拍卖。拍卖过程中，玩家可以继续出更高价，也可以退出。每当有人退出，他拿回自己本轮已出价的钱，并从桌面最低的可用“老鼠牌”上拿走补偿老鼠；同时翻开下一张暗牌，让剩余竞拍者获得更多信息。

最后仍未退出的玩家支付自己的最终出价，获得袋中剩余动物牌。好猫是正分，坏猫是负分，兔子 0 分，狗会在得标前赶走某张猫。9 轮结束后，玩家把自己拍到的猫分加上剩余老鼠钱，最高者获胜。

## 组件

### 动物牌

共有 5 套颜色不同、内容相同的动物牌。每名玩家使用一套。

```text
AnimalCard:
  id: string
  owner_color: string
  kind: cat | rabbit | big_dog | small_dog
  value: integer | null
```

每套 10 张：

| id | kind | value | 说明 |
|---|---|---:|---|
| `cat_-8` | `cat` | -8 | 坏猫，负分 |
| `cat_-5` | `cat` | -5 | 坏猫，负分 |
| `cat_3` | `cat` | 3 | 好猫，正分 |
| `cat_5` | `cat` | 5 | 好猫，正分 |
| `cat_8` | `cat` | 8 | 好猫，正分 |
| `cat_11` | `cat` | 11 | 好猫，正分 |
| `cat_15` | `cat` | 15 | 好猫，正分 |
| `rabbit_0` | `rabbit` | 0 | 兔子，0 分，不算猫 |
| `big_dog` | `big_dog` | null | 大狗，赶走猫后自己也移出游戏 |
| `small_dog` | `small_dog` | null | 小狗，赶走猫后自己也移出游戏 |

实现要点：

- 动物牌有所属颜色，用于回放和 UI，但结算只看牌种和数值。
- 被起始设置移除的牌、被狗赶走的牌、狗牌本身都进入 `removed_cards`，不再参与得分。
- 得标者获得的牌放入 `won_cards`，不回到手牌。
- 出过的牌不回收。每名玩家 9 张手牌正好对应 9 轮。

### 老鼠钱

老鼠既是拍卖货币，也是游戏结束分数。

```text
MouseMoney:
  unit values are 1 and 5 in the physical game
```

电子版可以只记录整数余额：

```text
Player.mice: integer
Bank.mice: integer
```

实体配件为 76 点老鼠钱：68 个 1 值黑色筹码，8 个 5 值绿色筹码。玩家可以随时与银行换零钱，所以电子版无需追踪具体面额。

### 老鼠牌

老鼠牌是桌面上的退出补偿格。

```text
MouseCard:
  value: 2 | 3 | 4 | 6
  mice_on_card: integer
  active: boolean
```

不同人数使用的老鼠牌：

- 5 人：使用 `2, 3, 4, 6`。
- 4 人：使用 `2, 4, 6`，不使用 `3`。
- 3 人：只使用 `3, 6`，另有一套虚拟玩家牌。

### 袋中猫牌与起始玩家标记

- `cat_in_the_sack` 是桌面定位牌，放在老鼠牌最左侧。它本身没有效果。
- 起始玩家标记由最近一轮得标者获得，并决定下一轮第一个暗出牌和第一个行动的玩家。
- 若一轮所有人都退出导致无人得标，下一轮仍由同一名起始玩家开始。

## 初始化

输入：

```text
player_count: 3..5
players: Player[]
random_seed?: string
```

通用流程：

1. 校验玩家人数为 3-5。
2. 给每名玩家分配一套完整的 10 张动物牌。
3. 每名玩家的左手边玩家从该玩家的 10 张牌中随机抽 1 张，面朝下移出游戏。
   - 电子版可由系统随机执行。
   - 被移除牌对所有玩家保密，包括牌的原主人。
4. 每名玩家获得 15 点老鼠钱。
5. 随机或由房主指定起始玩家。
6. 按玩家人数设置银行与老鼠牌：
   - 5 人：银行 33 点；桌面老鼠牌为 `2, 3, 4, 6`。
   - 4 人：银行 27 点；桌面老鼠牌为 `2, 4, 6`。
   - 3 人：银行 21 点；桌面老鼠牌为 `3, 6`；额外设置一套虚拟玩家牌。
7. 将每张启用的老鼠牌补满到其牌面数值。例如 `6` 号老鼠牌上放 6 点老鼠钱。
8. 进入第 1 轮。

注意：银行初始值是扣除玩家初始资金和不用筹码后的规则值。银行余额会随得标者支付出价而增加，也会随补老鼠牌而减少。

## 游戏状态建议

```text
GameState:
  phase:
    setup
    choose_card
    reveal_first
    auction
    resolve_round
    refill_mouse_cards
    game_over
  round_index: 1..9
  start_player_id: string
  current_turn_player_id: string | null
  active_bidders: set[player_id]
  current_bid: integer
  current_bidder_id: string | null
  table_slots: TableSlot[]
  mouse_cards: MouseCard[]
  bank_mice: integer
  players: Player[]
  removed_cards: AnimalCard[]
  log: Event[]
```

```text
Player:
  id: string
  name: string
  color: string
  hand: AnimalCard[]
  chosen_card_id: string | null
  won_cards: AnimalCard[]
  mice: integer
  round_bid: integer
  passed: boolean
```

```text
TableSlot:
  index: integer
  source: player | dummy
  player_id?: string
  card: AnimalCard
  face_up: boolean
  position_label: cat_in_sack | mouse_2 | mouse_3 | mouse_4 | mouse_6
```

## 每轮流程

一局固定 9 轮。每轮分为暗出牌、翻第一张牌、竞价、结算、补老鼠牌。

### 1. 暗出牌

从起始玩家开始，按顺时针顺序，每名玩家从手牌中选择 1 张牌，面朝下放到桌面对应位置。

桌面位置：

- 第一张放在 `cat_in_the_sack` 下方。
- 后续玩家依序放在从左到右的老鼠牌下方。
- 5 人局会形成 5 张牌：袋中猫位、2、3、4、6。
- 4 人局会形成 4 张牌：袋中猫位、2、4、6。
- 3 人局见“三人规则”。

电子版实现：

```text
for player in turn_order_from(start_player):
  wait for player to choose exactly 1 card from hand
  remove it from hand
  create face_down TableSlot
```

所有玩家都出牌后，进入翻第一张牌阶段。

### 2. 翻第一张牌

将最左侧的第一张牌翻开。通常这是起始玩家的牌；三人局中最左侧是虚拟玩家牌。

然后从起始玩家开始竞价。

### 3. 竞价

竞价是公开升价拍卖。行动玩家只能二选一：

1. **出价 / 加价**
   - 出价必须大于当前最高出价。
   - 第一次有效出价必须至少为 1。
   - 玩家不能出超过自己当前拥有的老鼠钱。
   - 玩家本轮的 `round_bid` 设为自己的当前总出价。实体规则中玩家把这笔钱放在面前，电子版只需冻结这部分钱。
2. **退出 / Pass**
   - 玩家退出后本轮不能再竞价。
   - 玩家拿回本轮冻结的出价，即 `round_bid` 清零，不损失老鼠。
   - 玩家从仍有老鼠的最低数值老鼠牌上拿走全部老鼠。
   - 然后翻开桌面上下一张仍未翻开的牌。

竞价顺序：

- 从起始玩家开始，按顺时针循环。
- 已退出的玩家跳过。
- 若行动回到已经出过价的玩家，他必须继续加价到更高，或者退出。
- 当只剩 1 名未退出玩家时，竞价结束。

伪代码：

```text
while count(active_bidders) > 1:
  player = next_active_player()
  action = wait_for_bid_or_pass(player)

  if action.type == "bid":
    require action.amount > current_bid
    require action.amount <= player.mice
    player.round_bid = action.amount
    current_bid = action.amount
    current_bidder_id = player.id

  if action.type == "pass":
    player.round_bid = 0
    player.passed = true
    active_bidders.remove(player.id)
    award_lowest_available_mouse_card(player)
    reveal_next_face_down_slot_if_any()
```

### 4. 退出补偿

当玩家退出时，选择“桌面仍可领取的最低数值老鼠牌”，把上面的所有老鼠钱拿走。

实现要点：

- 不是玩家自由选择；一定是最低数值且仍在本轮可用的老鼠牌。
- 被拿走后该老鼠牌本轮为 0。
- 退出玩家拿到补偿后本轮不再行动。
- 如果本轮因为银行不足而没有补老鼠牌，或者对应老鼠牌已为空，退出玩家可能拿不到补偿。
- 退出时总是翻开下一张未翻牌，除非已经没有未翻牌。

```text
award_lowest_available_mouse_card(player):
  for card in mouse_cards sorted by value:
    if card.mice_on_card > 0:
      player.mice += card.mice_on_card
      card.mice_on_card = 0
      return
  return no_reward
```

### 5. 特殊情况：所有人都想退出

如果从一开始到最后一名玩家之前，所有行动玩家都退出，最后一名玩家必须先看到完整信息：

- 4/5 人局：翻开最后一张未翻牌。
- 3 人局：翻开剩余两张未翻牌。

然后最后一名玩家可以选择：

- 以 1 点老鼠钱买下整袋牌。
- 也退出。

若最后一名玩家也退出：

- 本轮桌面所有动物牌全部移出游戏。
- 不产生得标者。
- 起始玩家不变。
- 下一轮开始前不补充老鼠牌上的钱。
- 已经被退出玩家拿走的老鼠补偿保留，不回退。

实现建议：

```text
if count(active_bidders) == 1 and current_bid == 0:
  reveal_all_remaining_required_slots()
  last = only_active_bidder
  action = wait_for_buy_for_one_or_pass(last)
  if action == buy:
    current_bid = 1
    current_bidder_id = last.id
    resolve_round(winner=last)
  else:
    discard_table_cards()
    keep_start_player()
    skip_refill_mouse_cards = true
```

### 6. 得标与支付

当只剩一名未退出玩家且已有有效出价时，该玩家得标：

1. 得标者支付 `current_bid` 给银行。
2. 得标者的老鼠钱减少 `current_bid`。
3. 银行老鼠钱增加 `current_bid`。
4. 翻开所有尚未翻开的桌面牌。
5. 按狗牌规则处理桌面动物。
6. 得标者获得剩余桌面动物牌，放入 `won_cards`。
7. 得标者获得起始玩家标记，成为下一轮起始玩家。
8. 清空本轮桌面与玩家 `round_bid`、`passed` 状态。

```text
winner.mice -= current_bid
bank_mice += current_bid
resolve_dogs()
winner.won_cards.extend(remaining_table_cards)
start_player_id = winner.id
```

## 狗牌规则

狗牌只在得标后、得标者拿牌前结算。

### 没有狗

得标者获得桌面所有动物牌。

### 正好 1 张大狗

大狗赶走 1 张猫，然后大狗自己也移出游戏。

优先级：

1. 若桌面有正分猫，赶走数值最高的正分猫。
2. 若没有正分猫，赶走数值最低的负分猫。
3. 若没有任何猫，只移出大狗。

被赶走的猫与大狗都进入 `removed_cards`，不得分。

### 正好 1 张小狗

小狗赶走 1 张猫，然后小狗自己也移出游戏。

优先级：

1. 若桌面有负分猫，赶走数值最低的负分猫，即更糟的坏猫，例如 `-8` 优先于 `-5`。
2. 若没有负分猫，赶走数值最低的正分猫。
3. 若没有任何猫，只移出小狗。

被赶走的猫与小狗都进入 `removed_cards`，不得分。

### 2 张或更多狗

若桌面有 2 张或更多狗，无论大小组合如何，所有狗互相追逐而不影响猫：

- 移出所有狗。
- 不赶走任何猫。
- 得标者获得所有剩余猫与兔子。

### 同值猫的处理

基础牌组中同一袋内可能出现不同玩家出的同值猫。若狗需要赶走的目标有多个同值候选，只移出其中 1 张。电子版可使用稳定规则：

- 优先移出桌面位置最靠左的候选牌。

这不会影响得分总量，只影响日志和可视化。

## 补充老鼠牌

正常得标结算后，进入下一轮前，把每张启用老鼠牌补到其牌面数值。

规则中的表述是“重新放上对应数量的老鼠”。实现上应视为从银行给空/不足的老鼠牌补足到牌面值，而不是在现有基础上额外叠加。

```text
for card in mouse_cards:
  needed = card.value - card.mice_on_card
  if needed > 0:
    bank_mice -= needed
    card.mice_on_card += needed
```

特殊银行不足规则：

- 若一轮结束时银行没有足够的钱把所有启用老鼠牌都补到牌面值，则本轮不在任何老鼠牌上放钱。
- 下一轮中，退出玩家从老鼠牌得不到补偿；只有得标者能获得袋中动物牌。

实现建议先计算总需求：

```text
needed_total = sum(max(0, card.value - card.mice_on_card) for card in mouse_cards)
if bank_mice >= needed_total:
  refill all cards to face value
else:
  set all mouse_cards.mice_on_card = 0
```

如果上一轮出现“所有人都退出、无人得标”，不执行补充老鼠牌。老鼠牌保持被退出玩家拿走后的状态进入下一轮。

## 三人规则

三人局在通用规则基础上有以下变化。

### 初始化变化

1. 只使用 `3` 和 `6` 两张老鼠牌。
2. 银行初始为 21 点。
3. 取第 4 套无人使用的动物牌作为虚拟玩家牌组。
4. 虚拟玩家牌组洗牌后，随机移除 1 张面朝下出游戏。
5. 剩余 9 张虚拟玩家牌面朝下放在 `cat_in_the_sack` 位置下方，作为虚拟玩家牌堆。

### 每轮桌面牌

三人局每轮仍形成 4 张桌面牌：

1. 最左侧：虚拟玩家牌堆顶 1 张，放在 `cat_in_the_sack` 下方。
2. 起始玩家暗出 1 张。
3. 下一名玩家暗出 1 张。
4. 再下一名玩家暗出 1 张。

### 翻牌与竞价变化

每轮竞价开始前，先翻开虚拟玩家的牌。

随后由起始玩家开始竞价。每当有玩家退出：

- 翻开起始玩家的牌，使剩余两名玩家看到 2 张明牌、2 张暗牌。
- 当只剩 1 名玩家未退出时，翻开最后两张暗牌，让最后玩家看到完整内容。

更通用的实现方式：

```text
3-player reveal plan:
  auction_start: reveal slot 0 dummy card
  after first pass: reveal slot 1 start player's card
  when only one active bidder remains: reveal all remaining slots
```

三人局仍然按正常狗牌规则、支付、得分和起始玩家转移。

## 游戏结束与计分

第 9 轮结束后，所有玩家手牌都为空，游戏结束。

每名玩家得分：

```text
score = sum(card.value for card in won_cards if card.kind == cat) + player.mice
```

细节：

- 正分猫加分。
- 负分猫扣分。
- 兔子 0 分。
- 狗不进入得分区；狗在结算时移出游戏。
- 剩余老鼠钱每 1 点 = 1 分。
- 被开局随机移除的牌、被狗赶走的牌、无人得标时丢弃的牌都不计分。

胜负：

- 总分最高者获胜。
- 若总分平手，比较猫牌分总和更高者获胜。
- 若仍平手，规则未给出进一步裁定；电子版建议并列胜利。

```text
cat_score = sum(cat values)
mouse_score = player.mice
total_score = cat_score + mouse_score
```

## 合法行动校验

### 暗出牌阶段

玩家合法行动：

```text
choose_card(card_id)
```

校验：

- 必须轮到该玩家选择，或采用同时选择 UI 后由服务器按顺序落位。
- `card_id` 必须在玩家手牌中。
- 每轮每名玩家只能出 1 张。
- 已选择后不可更改，除非房间规则允许撤回且所有人尚未提交。

### 竞价阶段

玩家合法行动：

```text
bid(amount)
pass()
```

`bid(amount)` 校验：

- 玩家必须仍在 `active_bidders`。
- `amount` 为整数。
- `amount >= 1`。
- `amount > current_bid`。
- `amount <= player.mice`。

`pass()` 校验：

- 玩家必须仍在 `active_bidders`。
- 退出后本轮不可再行动。

特殊最后玩家 `buy_for_one_or_pass`：

- 只有当所有其他玩家都已退出且当前最高出价仍为 0 时出现。
- 买下需要 `player.mice >= 1`。
- 若玩家没有老鼠钱，只能退出。

## 信息隐藏

电子版必须区分公开信息与私有信息。

公开信息：

- 玩家姓名、颜色、剩余手牌数量。
- 每名玩家当前老鼠钱可以按规则保持秘密；如果 UI 简化为公开，需要在房间设置中说明这是变体。
- 桌面已翻开的动物牌。
- 老鼠牌上的老鼠数量。
- 当前最高出价与当前最高出价者。
- 已退出玩家。
- 每名玩家已赢得牌的数量可以公开；已赢得牌面是否公开可按实体习惯处理为面朝下。

私有信息：

- 玩家自己的手牌。
- 每名玩家开局被随机移除的牌。
- 桌面尚未翻开的暗牌。
- 玩家老鼠钱在官方规则中是秘密信息。

实现建议：

- 服务器保存完整状态。
- 给每个客户端发送裁剪视图。
- 日志中不要提前泄露暗牌。
- 游戏结束时可以公开所有被移除牌与历史暗牌，用于复盘。

## 推荐服务器事件

```text
client -> server:
  felix_choose_card(room_id, card_id)
  felix_bid(room_id, amount)
  felix_pass(room_id)
  felix_buy_for_one(room_id)
  felix_decline_buy(room_id)

server -> clients:
  felix_state(state_view)
  felix_card_chosen(player_id)
  felix_card_revealed(slot_index, card)
  felix_bid_placed(player_id, amount)
  felix_player_passed(player_id, mouse_reward)
  felix_round_resolved(summary)
  felix_game_over(scores)
```

## 最小可玩 UI

桌面区域：

- 顶部显示轮数 `1/9`、当前阶段、当前行动玩家。
- 中央从左到右显示袋中猫位和老鼠牌位。
- 每个位置下方显示动物牌，暗牌显示背面，明牌显示类型和数值。
- 老鼠牌显示本轮可领取的补偿数量。

玩家区域：

- 自己的手牌可点击选择。
- 每名玩家显示：名称、颜色、剩余手牌数、是否已退出、当前出价。
- 自己显示准确老鼠余额；其他玩家若遵守官方规则则隐藏为“秘密”。
- 得分区显示已赢得牌堆，默认只显示张数，游戏结束再展开。

竞价控件：

- 数字输入或加减按钮，最小值为 `current_bid + 1`。
- `Bid` 按钮。
- `Pass` 按钮。
- 最后一名且无人出价时显示 `1 点买下` 和 `Pass`。

结算表现：

- 翻开所有牌。
- 高亮狗牌效果。
- 高亮被赶走的猫与移出的狗。
- 将剩余牌移动到得标者得分区。
- 更新起始玩家标记。

## 测试用例建议

1. **4 人初始化**
   - 每名玩家 9 张手牌。
   - 银行 27 点扣除补老鼠牌后余额正确。
   - 老鼠牌为 `2,4,6`，没有 `3`。
2. **5 人初始化**
   - 老鼠牌为 `2,3,4,6`。
   - 每名玩家 9 张手牌。
3. **3 人初始化**
   - 老鼠牌为 `3,6`。
   - 虚拟玩家牌堆 9 张。
   - 每轮包含虚拟玩家牌和 3 名玩家牌。
4. **正常竞价**
   - 出价必须严格大于当前价。
   - 不能超过自己的老鼠余额。
   - 只剩 1 名未退出玩家时结算。
5. **退出补偿**
   - 第一名退出者拿最低可用老鼠牌。
   - 第二名退出者拿下一张最低可用老鼠牌。
   - 退出者拿回本轮出价。
6. **无人先出价**
   - 前面玩家都退出后，最后玩家看到全部牌。
   - 最后玩家可 1 点买下。
   - 最后玩家也退出时，桌面牌移出游戏，起始玩家不变且不补老鼠牌。
7. **大狗效果**
   - 有正分猫时赶走最高正分猫。
   - 无正分猫时赶走最低负分猫。
   - 无猫时只移出大狗。
8. **小狗效果**
   - 有负分猫时赶走最低负分猫。
   - 无负分猫时赶走最低正分猫。
   - 无猫时只移出小狗。
9. **多狗效果**
   - 两张或更多狗只移出所有狗，不赶走猫。
10. **银行不足补牌**
   - 若银行不足以补满所有老鼠牌，所有老鼠牌进入下一轮时均为 0。
11. **第 9 轮结束**
   - 触发游戏结束。
   - 总分为猫分加老鼠余额。
   - 平手时猫分更高者胜。

## 可直接使用的核心结算伪代码

```text
resolve_dogs(table_cards):
  dogs = [c for c in table_cards if c.kind in ["big_dog", "small_dog"]]
  cats = [c for c in table_cards if c.kind == "cat"]

  if len(dogs) == 0:
    return table_cards, []

  if len(dogs) >= 2:
    remaining = [c for c in table_cards if c not in dogs]
    removed = dogs
    return remaining, removed

  dog = dogs[0]
  removed = [dog]
  remaining = [c for c in table_cards if c != dog]

  if cats:
    if dog.kind == "big_dog":
      positive = [c for c in cats if c.value > 0]
      if positive:
        target = max(positive, key=lambda c: (c.value, -c.slot_index))
      else:
        target = min(cats, key=lambda c: (c.value, c.slot_index))
    else:
      negative = [c for c in cats if c.value < 0]
      if negative:
        target = min(negative, key=lambda c: (c.value, c.slot_index))
      else:
        target = min(cats, key=lambda c: (c.value, c.slot_index))

    remaining.remove(target)
    removed.append(target)

  return remaining, removed
```

说明：这里用 `slot_index` 作为同值目标的稳定决胜。实际数据结构中如果没有 `slot_index`，可以在桌面槽位对象上取位置。

