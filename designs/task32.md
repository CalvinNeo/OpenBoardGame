# 《小早川》 (Kobayakawa) 游戏规则说明书

本文档旨在详细阐述桌游《小早川》的规则逻辑，内容的详细程度足以支持电子版游戏的逻辑开发。

---

## 1. 游戏概述 (Game Overview)

* **类型**：聚会 / 吹牛 / 轻策略 / 凑数值
* **人数**：3 - 6 人
* **核心机制**：每位玩家手持一张牌，桌中央有一张公共牌“小早川”。结算时，手牌数值与“小早川”相加（仅限持有最小手牌的玩家），总数最大者获胜。

## 2. 基础组件与数据结构 (Components & Data)

### 2.1 卡牌 (Cards)
* **数量**：15 张
* **数值**：1 到 15（每种数值各 1 张，无花色区别）。
* **电子版属性**：`List<int> deck = [1, 2, ..., 15]`。

### 2.2 奖章/筹码 (Medals/Tokens)
* **用途**：用于下注和计分。
* **初始设置**：每位玩家开始时拥有 4 枚奖章。
* **电子版属性**：`Dictionary<PlayerID, int> playerTokens`。

### 2.3 标记 (Markers)
* **起始玩家标记 (First Player Marker)**：指示当前回合谁先行动。

---

## 3. 游戏流程 (Game Loop)

游戏由若干个**回合 (Round)** 组成，直到满足游戏结束条件。

### 3.1 回合准备 (Round Setup)

1.  **洗牌**：将 15 张牌重新洗混，构成牌库。
2.  **发牌**：每位玩家发 1 张牌作为**手牌**（隐藏信息）。
3.  **设置小早川**：从牌库顶翻开 1 张牌置于桌面中央，这张牌称为**“小早川” (Kobayakawa)**（公开信息）。
4.  **余牌**：剩余卡牌作为抽牌堆（面朝下）。

### 3.2 行动阶段 (Action Phase)

从起始玩家开始，按顺时针方向，每位玩家**必须**执行以下 **A** 或 **B** 两个行动中的**一个**：

#### 行动 A：抽牌换手 (Draw and Discard)
1.  从牌库顶抽 1 张牌。
2.  现在玩家手中有 2 张牌。
3.  玩家选择其中 1 张**面朝上**弃掉（置于即使弃牌堆，公开展示），保留另 1 张作为新手牌。
    * *逻辑目的*：优化自己的手牌，同时通过弃牌向对手释放（或误导）信号。

#### 行动 B：重置小早川 (Replace Kobayakawa)
1.  从牌库顶抽 1 张牌。
2.  直接将这张牌**面朝上**覆盖在当前的“小早川”牌上，成为新的“小早川”。
3.  原来的“小早川”被压在下面或移入弃牌堆（不再生效）。
    * *逻辑目的*：改变公共加值，打乱场上局势（例如原本是 15，换成 1）。

> **注意**：每位玩家在行动阶段只能操作一次。所有玩家行动完毕后，进入下注阶段。

### 3.3 下注阶段 (Betting Phase)

从起始玩家开始，按顺时针方向，玩家需根据手牌和场上的“小早川”决定是否参与由于最终对决（战斗）。

* **选项 1：战斗 (Fight)**
    * 玩家从自己的筹码中拿出一枚放入中央奖池。
    * 状态标记为 `Active`。
* **选项 2：撤退 (Pass)**
    * 玩家不支付筹码，直接放弃本回合。
    * 状态标记为 `Inactive`。
    * *注*：如果玩家手中没有筹码，通常规则下他必须选择“撤退”（除非这是最后一搏，视具体房规而定，标准规则通常意味着没筹码就输了）。

### 3.4 结算阶段 (Showdown Phase)

仅针对所有选择“战斗”的玩家进行结算。

#### 3.4.1 计算最终点数 (Calculate Final Score)
1.  **识别持有最小手牌的玩家**：
    * 检查所有 `Active` 玩家的手牌。
    * 找出其中数值**最小**的那张手牌。
    * 持有该最小手牌的玩家，获得“小早川”的加成。
2.  **计算公式**：
    * 如果玩家持有 `Active` 玩家中的最小手牌：`最终点数 = 手牌数值 + 小早川数值`。
    * 其他 `Active` 玩家：`最终点数 = 手牌数值`。

#### 3.4.2 判定胜负 (Determine Winner)
* **比较**：比较所有 `Active` 玩家的`最终点数`。
* **获胜**：点数最大者获胜。
* **平局判定 (Tie-Breaker)**：
    * 如果`最终点数`相同，比较**手牌数值**（不含加成）。
    * 手牌数值大者获胜。
    * *逻辑解释*：因为卡牌 1-15 只有一套，手牌绝对不重复。例如：玩家A手牌 15（总分15），玩家B手牌 3 + 小早川 12（总分15）。此时玩家A获胜，因为 15 > 3。

#### 3.4.3 奖惩 (Reward)
* **赢家**：拿走中央奖池中的所有筹码（包含本回合大家下注的 + 上回合可能遗留的）。
* **特殊情况**：
    * 如果只有 1 名玩家选择“战斗”，无需亮牌，该玩家直接获胜，拿走奖池。

### 3.5 回合结束与清理
1.  如果所有玩家都放弃，筹码留在奖池中累积到下回合。
2.  起始玩家标记传给下一位玩家（顺时针）。
3.  检查游戏结束条件。

---

## 4. 游戏结束条件 (Game End)

通常有两种结束方式，开发时可选其一或允许设置：

1.  **破产制**：当任意玩家输光所有筹码时，游戏立即结束。此时拥有最多筹码的玩家获胜。
2.  **回合制**：进行固定回合数（如 7 回合）。结束后筹码最多者获胜。

---

## 5. 算法逻辑伪代码 (Pseudo-code Logic)

以下是核心结算逻辑的伪代码参考：

```python
def resolve_round(active_players, kobayakawa_card):
    """
    active_players: list of objects {id, hand_card_value}
    kobayakawa_card: int
    """
    
    if not active_players:
        return None # No winner, pot carries over
        
    if len(active_players) == 1:
        return active_players[0].id # Automatic winner
    
    # 1. Find the minimum hand card value amongst fighters
    min_hand_value = 16 # Max possible is 15
    for player in active_players:
        if player.hand_card_value < min_hand_value:
            min_hand_value = player.hand_card_value
            
    # 2. Calculate final scores
    winning_player = None
    max_final_score = -1
    
    for player in active_players:
        final_score = player.hand_card_value
        
        # Apply Kobayakawa bonus
        if player.hand_card_value == min_hand_value:
            final_score += kobayakawa_card
            
        player.final_score = final_score # Store for UI display
        
        # 3. Determine Winner & Handle Ties
        if final_score > max_final_score:
            max_final_score = final_score
            winning_player = player
        elif final_score == max_final_score:
            # Tie-breaker: Higher raw hand card wins
            if player.hand_card_value > winning_player.hand_card_value:
                winning_player = player
                
    return winning_player.id
```

---

## 6. 开发细节提示 (Implementation Notes)

### AI 策略建议 (若开发单机版)
* **保守型 AI**：手牌 < 7 且小早川 < 5 时倾向于 Abandon。
* **激进型 AI**：手牌 1-3 时，如果小早川 > 10，必定 Fight。
* **计算型 AI**：记录已打出的牌（弃牌堆是公开的）。如果 15 已经出现在弃牌堆或作为前任小早川，那么持有 14 的胜率极大提升。

### UI/UX 建议
* **弃牌堆显示**：玩家需要随时查看已打出的牌（记牌是策略核心），UI 应提供“查看弃牌记录”的列表。
* **小早川高亮**：结算时，应有动画特效连接“小早川牌”和“最小手牌玩家”，表明合体加成。
* **数值提示**：在玩家做决策时，可动态提示当前的胜率估算（仅限辅助模式）。
