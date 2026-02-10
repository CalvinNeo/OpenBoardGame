# 6 nimmt! (谁是牛头王) - 游戏逻辑设计文档

本文档详细描述了《6 nimmt!》的游戏规则与逻辑，旨在作为开发电子版游戏的可以直接参考的需求文档。

## 1. 游戏基础配置 (Game Config)

### 1.1 卡牌定义
游戏包含 **104张** 唯一的卡牌，编号为 **1 到 104**。
每张卡牌拥有两个属性：
1.  **数值 (Value)**: 1-104 (用于排序和比大小)。
2.  **牛头数/罚分 (Bullheads/Penalty)**: 基于数值计算，规则如下：
    * **数值为 55**: 7 个牛头。
    * **数值为 11 的倍数** (11, 22, 33, 44, 66, 77, 88, 99): 5 个牛头。
    * **数值为 10 的倍数** (10, 20, 30, 40, 50, 60, 70, 80, 90, 100): 3 个牛头。
    * **数值为 5 的倍数** (5, 15, 25... 排除上述情况): 2 个牛头。
    * **其他所有数字**: 1 个牛头。

### 1.2 游戏人数
* 支持 2 到 10 人。

### 1.3 胜利条件
* 游戏通常进行若干局。
* 当任意一名玩家的总罚分达到或超过 **66分** 时，游戏结束。
* 此时总罚分最少的玩家获胜。

---

## 2. 游戏状态数据结构 (Data Structures)

为了实现电子版，需要维护以下核心状态：

```json
{
  "players": [
    {
      "id": "player_1",
      "hand": [], // 当前手牌 (List of Cards)
      "score": 0, // 总罚分
      "selectedCard": null, // 本回合选中的牌
      "state": "WAITING_FOR_INPUT" // 状态: 选牌中, 选行中, 等待中
    }
  ],
  "rows": [
    // 游戏盘面始终有4行
    { "id": 0, "cards": [] }, 
    { "id": 1, "cards": [] },
    { "id": 2, "cards": [] },
    { "id": 3, "cards": [] }
  ],
  "deck": [], // 剩余牌堆 (发牌后通常为空，除非支持变体规则)
  "currentTurnState": "SELECTION_PHASE" // 当前回合阶段
}
```

---

## 3. 游戏初始化 (Initialization)

1.  **洗牌**: 创建 1-104 的卡牌数组并随机打乱。
2.  **发牌**: 每位玩家分发 **10张** 牌作为手牌。
3.  **排面初始化**:
    * 从牌堆中再翻开 **4张** 牌。
    * 将这4张牌分别作为 **4个行 (Rows)** 的起始牌。
    * *注意*: 这里的4张牌若有牛头数不计入任何玩家得分。

---

## 4. 核心游戏循环 (Game Loop)

每一局游戏包含 **10个回合** (因为每人10张手牌)。
每回合包含以下三个阶段：

### 阶段一：同步出牌 (Simultaneous Selection)
1.  所有玩家从手牌中选择 **1张** 牌。
2.  选定后，该牌在逻辑上标记为“已打出”，但在UI上对其他玩家不可见（面朝下）。
3.  当所有玩家都确认选牌后，进入阶段二。

### 阶段二：结算排序 (Reveal & Sort)
1.  翻开所有玩家打出的牌。
2.  将这些牌按 **数值从小到大** 进行排序。
    * *示例*: 玩家A出12，玩家B出4，玩家C出60。
    * *处理顺序*: 玩家B(4) -> 玩家A(12) -> 玩家C(60)。

### 阶段三：放置卡牌逻辑 (Placement Logic) - **核心算法**

按排序后的顺序，依次处理每一张玩家打出的牌 (`play_card`)。对于每一张牌，执行以下判断逻辑：

#### 逻辑 A: 寻找合法行 (Find Valid Rows)
遍历盘面上的 4 行，找到满足以下条件的所有行：
* **条件**: `row.last_card.value < play_card.value`
* (即：行尾的牌必须比打出的牌小)

#### 逻辑 B: 自动放置 (Automatic Placement)
* **情况 1: 存在至少一个合法行**
    * 在所有合法行中，选择差值最小的一行。
    * **算法**: 找到 `min(play_card.value - row.last_card.value)` 的行。
    * **判定**:
        * 如果该行目前的卡牌数量 **< 5**：
            * 将 `play_card` 追加到该行末尾。
            * *回合结束，处理下一张牌。*
        * 如果该行目前的卡牌数量 **== 5** (即这第6张牌)：
            * **触发“牛头王” (6 nimmt!) 事件**:
                1.  该行现有的 5 张牌被移除。
                2.  计算这 5 张牌的牛头总数，加到该玩家的 `score` 中。
                3.  这 5 张牌进入弃牌堆（不再使用）。
                4.  `play_card` 成为该行新的 **第1张** 牌。

* **情况 2: 不存在合法行 (所有行的尾牌都比打出的牌大)**
    * 这种情况通常发生在玩家打出的牌非常小。
    * **触发“主动吃牌” (Player Choice) 事件**:
        1.  游戏逻辑暂停，请求该玩家输入。
        2.  玩家必须在 4 行中 **任意选择一行**。
        3.  被选中行的 **所有卡牌** 被移除。
        4.  计算被移除卡牌的牛头总数，加到该玩家的 `score` 中。
        5.  `play_card` 成为该行新的 **第1张** 牌。
        6.  *策略提示*: 玩家通常会选择牛头总数最少的一行来吃。

---

## 5. 局末与游戏结束结算

### 5.1 局末 (End of Round)
* 当 10 回合结束后（手牌为空），一局结束。
* 检查所有玩家的 `score`。

### 5.2 游戏结束判定 (Game Over)
* 如果 **任意玩家** `score >= 66`：
    * 游戏彻底结束。
    * 按分数排序，分数 **最低** 者为冠军。
* 如果 **无人** `score >= 66`：
    * 保留当前分数。
    * 重新洗牌（包括所有弃牌和之前的牌），开始新的一局 (Go to Section 3)。

---

## 6. 伪代码参考 (Pseudo-code Implementation)

```python
def process_turn(played_cards):
    # played_cards 是一个列表: [{player: p1, card: c1}, {player: p2, card: c2}...]
    
    # 1. 排序：从小到大
    sorted_plays = sort_by_card_value(played_cards)

    # 2. 依次处理
    for play in sorted_plays:
        card = play.card
        player = play.player
        
        # 寻找合适的行
        valid_rows = []
        for row in game_board.rows:
            if row.last_card.value < card.value:
                valid_rows.append(row)
        
        if len(valid_rows) > 0:
            # 规则：放入差值最小的行
            target_row = get_row_with_smallest_diff(valid_rows, card)
            
            if len(target_row.cards) == 5:
                # 规则：第6张牌，吃掉前5张
                player.score += calculate_bullheads(target_row.cards)
                target_row.cards = [card] # 重置该行
                log(f"{player.name} 放置第6张牌，吃了 {target_row.id} 行")
            else:
                # 正常追加
                target_row.cards.append(card)
        
        else:
            # 规则：牌太小，无法放入任何行
            # 必须由玩家选择一行吃掉 (UI交互)
            chosen_row_index = wait_for_player_decision(player)
            target_row = game_board.rows[chosen_row_index]
            
            player.score += calculate_bullheads(target_row.cards)
            target_row.cards = [card] # 重置该行
            log(f"{player.name} 牌太小，主动吃了 {target_row.id} 行")

```

## 7. 特殊情况与UI提示需求

1.  **卡牌信息展示**:
    * 在电子版中，务必在卡牌UI上直观显示其牛头数（例如：牌面画有相应数量的牛头图标）。
2.  **选择行提示**:
    * 当触发“主动吃牌”逻辑时，UI应高亮显示4个行，并显示每行当前的牛头总数，辅助玩家决策。
3.  **动画顺序**:
    * 必须严格按照卡牌数值从小到大的顺序播放动画，不能同时结算，因为前一张牌的结算结果（如清空了一行）会直接改变后一张牌的放置环境。

## 8. 常见FAQ (开发注意事项)

* **Q: 如果两张牌数值一样怎么办？**
    * A: 既然一副牌1-104不重复，这种情况不会发生。如果实现了“双副牌变体”，则先打出的先结算（或视为并列，需额外定义规则）。标准版无需考虑。
* **Q: 玩家能否查看已吃掉的弃牌堆？**
    * A: 规则上通常不公开弃牌堆详情，只显示每个玩家当前的罚分总数。
* **Q: 104号牌一定是第6张吗？**
    * A: 不一定。如果某一行的最后一张是 103，那么 104 可以安全地放在它后面成为第2、3、4、5张。只有当该行已有5张时，104才会触发吃牌。