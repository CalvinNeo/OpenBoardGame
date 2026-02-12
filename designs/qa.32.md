# 问题1
- 旧“小早川”被替换后，是否必须进入弃牌堆并公开（用于记牌），还是仅从游戏中移除不计入弃牌记录？
- 结算时“最小手牌玩家加成”默认唯一（因为牌唯一），是否需要防御式处理“多人同为最小值”的情况，还是可以假设永不发生？
- 下注阶段若有人已 0 筹码：在“破产制”模式下是立即结束游戏，还是仍允许继续仅能 Pass？
- 如果启用“回合制”，0 筹码玩家是否继续参与行动阶段（但只能 Pass），还是直接视为淘汰？
- 起始玩家标记在首局如何决定（随机、上一局赢家、固定座位）？
- 若全员 Pass，是否完全不亮牌、只累积奖池（我理解是这样，但想确认）

# 解答1
# 《小早川》规则细节与边界情况说明 (开发补充文档)

本文档针对电子版开发中可能遇到的边界逻辑问题进行明确定义。基于官方规则（Oink Games 版）及电子化通用处理方案。

---

## 1. 旧“小早川”被替换后的去向
**结论：必须进入弃牌堆并公开。**

* **规则逻辑**：在《小早川》中，记牌（Card Counting）是核心策略。玩家需要通过查看弃牌堆来推算剩余卡牌的分布。
* **开发实现**：
    * 当玩家执行 **Action B (重置小早川)** 时，原来的小早川卡牌应从 `currentKobayakawa` 槽位移动到 `discardPile` 列表中。
    * **UI 表现**：UI 必须有一个区域显示“弃牌历史”，旧的小早川卡牌应出现在这里，且**面朝上**供所有玩家随时查看。

## 2. “最小手牌”的唯一性校验
**结论：在标准规则下是唯一的，无需处理“多人同值”，但建议添加异常检测。**

* **数学逻辑**：游戏仅有一套卡牌（1-15），每张卡牌数值唯一。因此，场上所有玩家的手牌数值必定互不相同。`min(activePlayers.hand)` 永远只会返回唯一的 1 名玩家。
* **开发建议 (Defensive Programming)**：
    * 虽然逻辑上不可能发生，但在代码中应保留“防御性断言”。
    * 如果检测到 `min_player_count > 1`，说明发生了严重的 **GameState Corruption**（如发牌算法出错、牌库数据污染），此时应抛出 Fatal Error 而不是尝试结算。

## 3. 0 筹码 (Zero Tokens) 的处理逻辑

* **规则**：根据 Oink Games 官方说明书，当任意玩家在回合结束时破产（0 筹码），或者回合开始时无法支付入场费（如下注阶段没钱下注），游戏**立即结束**。
* **结算**：此时拥有最多筹码的玩家直接获胜。


## 4. 起始玩家 (First Player) 决定机制
* **首局**：完全随机（`Random.Range(0, playerCount)`）。
* **后续回合**：
    * **标准规则**：上一局的赢家（拿走奖池的人）成为下一局的起始玩家。
    * **流局（全员 Pass）的情况**：起始玩家标记**顺时针**传递给下一位玩家。

## 5. 全员 Pass (All Pass) 的结算逻辑
**结论：完全不亮牌，直接进入下一回合。**

* **流程**：
    1.  所有玩家选择 Pass。
    2.  **不执行** Showdown（比大小）阶段。没有人展示手牌（保护隐私策略）。
    3.  **不分配** 奖池。本回合大家投入的筹码（如果有盲注规则，或者是上一轮留下的）全部留在中央。
    4.  **清理**：收回所有卡牌，重新洗牌（包含刚才的手牌、小早川、弃牌），进入下一回合。
    5.  **战略意义**：奖池变大，下一轮的竞争会更激烈。

---

## 6. 完善后的数据结构参考 (C# 风格)

```csharp
public class KobayakawaGame
{
    // ... 基础属性 ...

    public void ReplaceKobayakawa(Player player)
    {
        // 1. 抽一张新牌
        int newCard = DrawCard();
        
        // 2. 旧的小早川进入公开弃牌堆 (关键点)
        DiscardPile.Add(CurrentKobayakawa);
        
        // 3. 更新当前小早川
        CurrentKobayakawa = newCard;
        
        // 4. 记录日志 (供前端显示)
        GameLog.Add($"{player.Name} replaced the Kobayakawa.");
    }

    public void ResolveShowdown()
    {
        var activePlayers = Players.Where(p => p.Status == PlayerStatus.Fight).ToList();

        // 边界处理：全员 Pass
        if (activePlayers.Count == 0)
        {
            GameLog.Add("All players passed. Pot carries over.");
            NextRound(winner: null); // 奖池保留
            return;
        }

        // 正常结算
        int minHandValue = activePlayers.Min(p => p.HandCard);
        
        // 校验唯一性 (防御式编程)
        var minHolders = activePlayers.Where(p => p.HandCard == minHandValue).ToList();
        if (minHolders.Count != 1) 
        {
            throw new Exception("CRITICAL ERROR: Duplicate hand cards detected!");
        }

        // ... 后续计算逻辑 ...
    }
}
```