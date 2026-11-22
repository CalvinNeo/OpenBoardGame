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

* **2026-11-22 校正**：当前采用 4 枚起始筹码、8 枚公共储备的七轮版。零筹码者在派奖后淘汰，不会让整局立即结束。只剩一位有筹码者可提前结束；`end_mode=bankrupt` 仅作为旧房间显式房规保留。
* **末轮**：下注 2 枚，只有 1 枚可全押。普通轮赢家额外拿 1 枚公共储备，末轮拿剩余 2 枚，不能只退回自己的下注。


## 4. 起始玩家 (First Player) 决定机制
* **首局**：完全随机（`Random.Range(0, playerCount)`）。
* **后续回合**：
    * **标准规则**：上一局的赢家（拿走奖池的人）成为下一局的起始玩家。
    * **流局（全员 Pass）的情况**：起始玩家标记**顺时针**传递给下一位玩家。

## 5. 全员 Pass (All Pass) 的结算逻辑
**结论：完全不亮牌，保留公共储备，确认后重发同一计奖轮次。**

* **流程**：
    1.  所有玩家选择 Pass。
    2.  **不执行** Showdown（比大小）阶段。没有人展示手牌（保护隐私策略）。
    3.  **不分配** 奖池，不扣公共储备。不存在大小盲，正常全员 Pass 时下注底池为零。
    4.  **清理**：全员确认后收牌重洗，起始玩家转交下家，重发同一计奖轮次；独立结算编号阻止上次重发的迟到确认。
    5.  **数字版约定**：规则摘要未明确全员 Pass 的细节，采用重发以保证七轮奖励完整，避免公共储备凭空销毁。

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
