# 问题1
- 游戏结束时机：是否必须打完整个10回合再检查 score >= 66？文档 1.3/5.2 和 5.1 的描述有点冲突。
- 结算平局：若最终最低分有多人并列，算并列胜利还是需要额外规则打破平局？
- 新一局洗牌：是直接重建 1–104 重新洗牌，还是需要维护弃牌堆再洗回？（实现上两者都可，想确认规则期望。）
- “牌太小需选行”交互：当某张牌触发“主动吃牌”，是否强制暂停全局等待该玩家选择，其他玩家/动画都要等（严格顺序）？
- 超时/掉线处理：如果玩家迟迟不选行或不出牌，是否需要默认策略（如自动选最小牛头行/超时弃权）？

# 解答1

## 1. 游戏结束判定时机 (Game End Trigger)

* **结论**: **必须打完完整的一局（即 10 个回合/每人出完 10 张牌）后，再进行分值检测。**
* **详细逻辑**:
    1.  虽然某个玩家可能在第 3 回合分数就超过了 66 分，但游戏**不会**立即中止。
    2.  必须等所有玩家打完手中的 10 张牌。
    3.  本局结算完毕后，检查所有玩家的总分。
    4.  若此时有人分数 $\ge 66$，则游戏宣告结束；否则，重新发牌开始新的一局。
* **原因**: 后续回合可能会发生其他玩家吃到更多分数的情况，改变最终排名的相对顺位。

## 2. 平局处理 (Tie-Breaking)

* **结论**: **允许并列胜利 (Shared Victory)。**
* **详细逻辑**:
    * 当游戏结束时，分数最低的玩家获胜。
    * 如果有多名玩家分数相同且均为最低（例如玩家 A 和玩家 B 都是 12 分），则他们**共同获胜**。
    * 无需引入额外的踢球/决胜局规则。

## 3. 新一局洗牌逻辑 (Reshuffling)

* **结论**: **完全重置 (Full Reset)**。
* **详细逻辑**:
    * 每一局（Round）开始前，逻辑上视作一副全新的牌。
    * **实现方式**: 直接重建包含 1-104 的数组，重新洗牌 (Shuffle)。
    * **不需要**维护上一局的“弃牌堆”概念。上一局的所有牌（包括手牌、盘面牌、玩家吃进分数的牌）全部回收混在一起洗。

## 4. “牌太小需选行”的交互阻塞性 (Blocking Interaction)

* **结论**: **严格阻塞 (Strictly Blocking)**。
* **详细逻辑**:
    * 这是游戏逻辑最关键的依赖点。
    * **场景**: 假设当前结算顺序是 玩家A(牌值2) -> 玩家B(牌值50)。
    * 当 玩家A 触发“选行吃牌”时，游戏状态必须**暂停**，等待 玩家A 完成选择。
    * **为什么不能并行？**: 
        * 假设 玩家A 选择了吃掉第 3 行（此时第3行变成了 `[2]`）。
        * 轮到 玩家B(50) 结算时，他原本可能只能放第 1 行，但现在因为第 3 行变成了 `2`，他的 `50` 可能变成放入第 3 行（因为 $50 > 2$ 且差值可能更小）。
    * **实现提示**: 服务器端需维护一个状态机，处于 `WAITING_FOR_ROW_SELECTION` 状态时，挂起后续卡牌的结算循环，直到收到 socket 消息或超时。

## 5. 超时/掉线托管策略 (Timeout/Auto-Play Strategy)

为了保证多人游戏的流畅性，建议实现以下托管逻辑：

### 5.1 选牌阶段超时 (Selection Phase Timeout)
* **策略**: **随机出牌**。
* **逻辑**: 从当前手牌中 `Math.random()` 选一张打出。
* *理由*: 此时无法判断最优解，随机出牌是对掉线玩家的惩罚（可能导致后续无法接牌），也是对其他玩家的公平。

### 5.2 选行阶段超时 (Row Selection Timeout)
* **策略**: **最优解保护 (Best Move / Min Damage)**。
* **逻辑**: 自动选择当前盘面上**牛头总数最少** (Min Sum of Bullheads) 的那一行吃掉。
* *理由*: 
    1.  这通常是人类玩家的理性选择。
    2.  如果随机选行，极大概率会选中高分行，导致该玩家瞬间爆炸，直接结束游戏，这会破坏其他想继续玩的玩家的体验（Game throwing）。
    3.  选最小分行是对局面的最小干涉。

---

## 6. 修正后的伪代码片段 (Refined Pseudo-code)

针对阻塞逻辑的伪代码更新：

```python
def resolve_turn_logic(sorted_plays):
    for play in sorted_plays:
        card = play.card
        player = play.player
        
        valid_rows = find_valid_rows(card)
        
        if valid_rows:
            # ... (自动放置逻辑，同前文) ...
            target_row = find_best_fit(valid_rows, card)
            execute_placement(target_row, card, player)
        else:
            # === 阻塞点 ===
            # 向前端发送事件：请该玩家选择行
            notify_player_to_choose_row(player)
            
            # 设置计时器，若超时则执行 auto_pick_row(player)
            # 这里的 return 意味着函数执行暂停，
            # 需要等待回调(Callback)或基于事件驱动继续执行后续的 loop
            return "WAITING_FOR_USER_INPUT" 

def on_player_row_selected(player, row_index):
    # 玩家（或超时逻辑）选好行后的回调
    game_board.rows[row_index].clear_and_set_first(player.current_card)
    player.score += calculated_penalty
    
    # 继续处理 sorted_plays 中剩余的牌
    resume_turn_logic()
```