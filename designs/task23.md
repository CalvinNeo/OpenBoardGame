# 《纸牌帮》(The Gang) 电子版开发设计文档 (Game Design Document)

## 1. 游戏概述 (Game Overview)

**类型**：合作类、德州扑克变体、逻辑推理  
**玩家人数**：3-6人 (电子版推荐支持此范围)  
**核心目标**：玩家作为各种“专家”组成帮派，通过协作打开金库。在不交流具体手牌信息的情况下，玩家必须根据公共牌和自己的底牌，准确判断自己在所有玩家中的牌力排名。

---

## 2. 基础组件与数据结构 (Components & Data Structures)

若要实现电子版，需定义以下核心对象：

### 2.1 卡牌 (Card)
* **牌库**：标准 52 张扑克牌 (去掉大小王)。
* **属性**：
    * `Suit` (花色): Spades, Hearts, Diamonds, Clubs
    * `Rank` (点数): 2, 3, 4, 5, 6, 7, 8, 9, 10, J, Q, K, A
    * `Value` (比较值): 2=2 ... A=14

### 2.2 游戏区域 (Zones)
* **底牌区 (Hole Cards)**：每个玩家私有的 2 张牌（仅自己可见）。
* **公共牌区 (Community Cards)**：即“桌面”，最终会有 5 张牌（全员可见）。
* **排名轨道 (Ranking Track)**：
    * 这是一个线性插槽区域，长度等于玩家人数。
    * 插槽位置代表牌力排名：`1st` (最强) 到 `Last` (最弱)。
    * **对象**：每个玩家拥有一个对应的“角色指示物/头像”。

### 2.3 资源 (Resources)
* **解锁尝试机会 (Attempts/Lives)**：类似生命值，通常有 3 次机会。
* **重置代币 (Reroll/Hint Tokens)**：用于特殊操作（如重发手牌、查看队友等，视具体规则变体而定）。

---

## 3. 牌型判定逻辑 (Hand Evaluation Logic)

这是电子版的核心算法。系统必须能够计算 7 张牌（2 张底牌 + 5 张公共牌）中的最佳 5 张组合。

**牌力大小顺序 (由大到小)**：
1.  **皇家同花顺 (Royal Flush)**: 同花色 A-K-Q-J-10。
2.  **同花顺 (Straight Flush)**: 同花色连续 5 张。
3.  **四条 (Four of a Kind)**: 4 张同点数 + 1 张杂牌。
4.  **葫芦 (Full House)**: 3 张同点数 + 2 张同点数。
5.  **同花 (Flush)**: 5 张同花色 (非连续)。
6.  **顺子 (Straight)**: 5 张连续点数 (非同花)。
7.  **三条 (Three of a Kind)**: 3 张同点数 + 2 张杂牌。
8.  **两对 (Two Pair)**: 2 对 + 1 张杂牌。
9.  **一对 (One Pair)**: 1 对 + 3 张杂牌。
10. **高牌 (High Card)**: 无上述牌型，比单张最大。

**平局处理 (Tie-Breaker) 算法**：
在德州扑克规则中，必须严格处理平局。
* *例子*：如果两个玩家都是“一对”，比对子的大小；如果对子一样大，比剩下的“踢脚牌” (Kicker) 的大小（按顺序比）。
* **绝对平局**：如果在《纸牌帮》中出现两名玩家最好的 5 张牌完全相同（花色不分大小），则他们在排名轨道上**共享同一个位置**，或者位置可以互换（规则判定为“正确”）。*电子版建议实现为：允许并列，或任意顺序皆判为正确。*

---

## 4. 游戏流程 (Game Loop)

游戏由多个“关卡” (Level) 组成。每个关卡即为一局牌。

### 阶段 0: 发牌 (Deal)
1.  洗牌。
2.  向每位玩家发 2 张底牌（UI显示：玩家看自己的牌，其他玩家显示牌背）。
3.  剩余牌堆作为公共牌库。

### 阶段 1: 翻牌圈 (The Flop)
1.  **系统动作**：发 3 张公共牌，面朝上。
2.  **玩家行动**：
    * 所有玩家此时可根据 (2张底牌 + 3张公共牌) 估算自己的牌力。
    * **交互**：玩家可以将自己的“指示物”拖拽到“排名轨道”上。
    * *限制*：禁止文字/语音交流。只能通过移动指示物表达意图。
    * *逻辑*：如果你觉得自己牌很好，放在靠前的位置；很差，放在靠后。
    * *冲突解决*：玩家可以移动队友的指示物（表示“我觉得你比我强/弱”），但这通常是高风险行为。

### 阶段 2: 转牌圈 (The Turn)
1.  **系统动作**：发第 4 张公共牌。
2.  **玩家行动**：
    * 牌局局势变化。玩家重新评估牌力。
    * 继续调整“排名轨道”上的指示物顺序。

### 阶段 3: 河牌圈 (The River)
1.  **系统动作**：发第 5 张 (最后一张) 公共牌。
2.  **玩家行动**：
    * 这是最后调整机会。
    * 玩家必须达成一致的最终顺序。
    * **锁定 (Commit)**：当所有玩家点击“确认”或倒计时结束，顺序被锁定。

### 阶段 4: 结算 (Showdown & Resolution)
1.  **亮牌**：系统翻开所有玩家的底牌。
2.  **计算**：系统计算每位玩家的最佳 5 张牌，并得出实际牌力数值 (Hand Strength Score)。
3.  **验证**：
    * 系统生成一个“正确排名列表” (Correct Rank List)。
    * 对比玩家摆放的“预测排名列表” (Player Rank List)。
4.  **判定结果**：
    * **完全匹配**：任务成功，进入下一关。
    * **不匹配**：任务失败，扣除 1 次尝试机会。如果机会归零，游戏结束 (Game Over)。

---

## 5. 电子版特有功能与UI设计 (UI/UX Implementation)

为了让游戏体验流畅，电子版应包含以下辅助功能：

### 5.1 视觉辅助 (Visual Aids)
由于不需要像真实德州扑克那样诈唬，电子版应帮助玩家减轻计算负担（根据难度设置可选）：
* **当前牌型提示**：在玩家手牌旁显示“目前你拥有一对”或“听同花 (Flush Draw)”等提示。
* **公共牌高亮**：当公共牌与玩家底牌形成组合时，进行高亮显示。

### 5.2 排名交互 (Ranking Interface)
* **拖拽区**：屏幕中央横置一条槽，标记 1, 2, 3... N。
* **实时反馈**：当玩家A移动玩家B的棋子时，玩家B的屏幕应有动画提示（如震动或闪烁），模拟线下桌游中“甚至拿起了你的棋子”的紧张感。

### 5.3 沟通限制系统 (Communication Constraints)
* **聊天禁用**：在游戏进行中禁用文本/语音。
* **表情包 (Emotes)**：仅允许使用非特定的表情（如“思考中”、“自信”、“犹豫”），严禁包含数字或花色的表情。

---

## 6. 难度与变体 (Difficulty Levels)

为了增加重玩性，代码应支持配置参数：

1.  **新手模式**：
    * 允许“平局”容错（只要位置相邻就算对）。
    * 显示牌力概率百分比。
2.  **专家模式**：
    * 完全禁止辅助提示。
    * 增加“必须满足特定条件”的任务卡（例如：排名第一的人必须是用“顺子”赢的，否则算输）。

## 7. 伪代码示例 (Pseudocode Logic)

```python
class GameRound:
    def resolve_round(self, players, community_cards, ranking_track):
        actual_scores = []
        
        # 1. 计算每位玩家的绝对牌力值
        for player in players:
            best_hand = PokerEngine.get_best_hand(player.hole_cards, community_cards)
            score = best_hand.calculate_score() # 返回一个可比较的整数或元组
            actual_scores.append({
                'player_id': player.id, 
                'score': score
            })
            
        # 2. 排序生成正确答案 (分数高的排前面)
        # 注意处理平局逻辑
        correct_order = sorted(actual_scores, key=lambda x: x['score'], reverse=True)
        
        # 3. 对比玩家提交的顺序
        player_submission = ranking_track.get_current_order() # 返回玩家ID列表
        
        # 4. 判定
        for i in range(len(players)):
            expected_id = correct_order[i]['player_id']
            actual_id = player_submission[i]
            
            # 处理平局情况下的特殊逻辑：如果两个玩家分数完全相同，他们的相对位置可以互换
            if expected_id != actual_id:
                if not self.is_tie(expected_id, actual_id, actual_scores):
                    return "FAILURE"
                    
        return "SUCCESS"
```
