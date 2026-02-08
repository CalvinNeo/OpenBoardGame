# 《纸牌帮》(The Gang) 电子版设计细则补充 (Design Spec Addendum)

针对您提出的关键实现细节，以下是具体的规则定义与逻辑补全。这些设定旨在平衡游戏性与程序实现的严谨度。

## 1. 平局处理 (Tie-Breaker Logic)

在德州扑克规则下，若出现绝对平局（Split Pot，即5张最佳手牌完全一致，花色不分大小），电子版采用 **“任意互换顺序算正确” (Interchangeable Rank)** 的逻辑，保持界面 UI 统一。

* **排名轨道表现**：
    * 轨道插槽依然是线性的 `1, 2, 3... N`（物理插槽数量不变）。
    * UI **不**合并插槽。
* **判定逻辑**：
    * 若玩家 A、B、C 的牌力完全相同，且他们的实际排名应为前三名。
    * 那么，A、B、C 占据插槽 `[1, 2, 3]` 的任意排列组合（如 A在2，B在1，C在3）均判定为 **正确**。
    * 系统后台将这三个插槽标记为“等价集合 (Equivalent Set)”。
* **示例**：
    * 正确顺序：Player A (Full House) > Player B (Flush) = Player C (Flush)
    * 轨道正确摆法：
        * `1:A, 2:B, 3:C` (Pass)
        * `1:A, 2:C, 3:B` (Pass)
        * `1:B...` (Fail)

## 2. 新手模式判定 (Novice Mode Tolerance)

为了降低挫败感，“相邻就算对”采用 **每位玩家独立判定 (Per-Player Fuzzy Logic)**。

* **判定口径**：每位玩家允许的误差范围是 `±1`。
    * 若某玩家真实排名是 `3`，则他被放置在 `2`, `3`, `4` 位置均算该玩家“Pass”。
* **通关条件**：**所有**玩家都必须通过上述判定，才算本局胜利。
* **平局冲突**：
    * 在新手模式下，平局逻辑优先于相邻逻辑。即先处理平局（视为同一位置），再计算 ±1。
    * *极简方案*：直接比较索引差值的绝对值 `abs(predicted_index - actual_index) <= 1`。

## 3. 尝试机会 (Lives / Attempts)

采用 **整局共享 + 有限回复** 机制，模拟 Roguelike 或传统街机模式。

* **默认配置**：
    * 初始生命值：**3** 点（全队共享）。
    * 重置机制：过关 **不重置**。这迫使玩家在后期关卡更加谨慎。
    * 失败惩罚：判定失败一次，扣除 **1** 点生命，并 **重新开始当前关卡**（重新发牌）。
    * Game Over：生命归零，游戏结束，统计最终得分/关卡数。
* **回复机制 (Bonus)**：
    * 每通过 **5** 个关卡（或特定的 Boss 关卡），奖励 **1** 点生命（上限不超过 5）。

## 4. 辅助资源：重置与提示 (Tokens)

为了增加策略维度，建议启用以下代币系统。

* **资源池**：全队共享，初始 **2** 个“万能代币 (Wild Token)”。
* **功能与消耗**：
    1.  **重置手牌 (Mulligan)**：
        * *消耗*：1 代币。
        * *时机*：仅在“翻牌圈 (Flop)”之前（即刚发底牌时）。
        * *效果*：所有玩家弃掉底牌，重新发牌（洗牌不重置）。
    2.  **窥视 (Spy)**：
        * *消耗*：1 代币。
        * *时机*：任意下注轮。
        * *效果*：指定一名玩家，随机翻开他的一张底牌（对全员可见）。
* **获取方式**：完美通关（即没有任何玩家位置摆错，且未使用容错机制）时，有概率（如 50%）获得 1 个代币。

## 5. 专家模式：任务卡系统 (Mission Cards)

专家模式的核心在于“限制”。需要建立一个 **JSON 任务库**。

* **机制**：
    * 每关开始时，随机抽取 1 张任务卡。
    * 任务是 **强制性** 的。若排名正确但未满足任务条件，视为失败（扣血）。
* **数据结构设计 (Task Database)**：
    ```json
    [
      {
        "id": "M001",
        "desc": "赢家必须拥有顺子或更强牌力",
        "condition": "rank_1.hand_strength >= STRAIGHT"
      },
      {
        "id": "M002",
        "desc": "最后一名不能持有任何对子 (仅高牌)",
        "condition": "rank_last.hand_type == HIGH_CARD"
      },
      {
        "id": "M003",
        "desc": "排名第 1 和第 2 的玩家必须花色相同 (指底牌至少有一张同色)",
        "condition": "compare_suits(rank_1.hole_cards, rank_2.hole_cards)"
      }
    ]
    ```
* **刷新**：每局自动刷新，不可拒绝。

## 6. UI 交互细节 (UI/UX)

* **撤销与确认**：
    * **锁定前**：玩家可以随意拖拽、撤回。
    * **确认机制**：所有玩家必须点击“Ready”。一旦某玩家点击 Ready，他的棋子在其他人屏幕上显示为“已锁定（灰色/加锁图标）”，但他自己仍可取消 Ready 进行修改。
    * **全局锁定**：当所有人都 Ready，触发 3 秒倒计时，倒计时结束后进入结算，**不可撤销**。
* **超时处理**：
    * 若设置了回合时间（如 60秒），时间到时：
        * **不自动锁定**（防止未操作完导致的意外排列）。
        * **自动判定失败** 或 **随机锁定**（建议判定失败，迫使玩家注意时间）。
        * *友好设计*：超时前 10 秒全屏红光闪烁 + 音效倒数。

## 7. 牌型评估细节 (Hand Evaluation Standards)

必须严格遵循标准德州扑克规则，杜绝歧义。

* **A-2-3-4-5 顺子 (The Wheel)**：
    * **算顺子**。
    * **大小**：这是 **最小** 的顺子（5 High Straight）。比 2-3-4-5-6 顺子小。
* **踢脚牌 (Kicker) 判定**：
    * **严格执行 5 张比牌法**。
    * *场景*：公共牌 `K-K-10-8-2`。
        * 玩家A底牌：`A-Q` -> 牌型：`K-K-A-Q-10` (一对K, A-Q-10 踢脚)。
        * 玩家B底牌：`A-9` -> 牌型：`K-K-A-10-9` (一对K, A-10-9 踢脚)。
        * **结果**：玩家 A 胜（第四张牌 Q > 9）。
    * *场景2 (公共牌本身很大)*：公共牌 `A-K-Q-J-9` (同花顺面除外)。
        * 玩家A底牌：`2-3`。最佳5张：公共牌本身。
        * 玩家B底牌：`4-5`。最佳5张：公共牌本身。
        * **结果**：**平局**。底牌不起作用，共享名次。

---

### 附：核心判定伪代码更新 (Updated Logic)

```python
def check_win_condition(actual_ranks, player_ranks, mode="NORMAL"):
    """
    actual_ranks: list of sets, e.g., [{P1}, {P2, P3}, {P4}] 
                  (P2 and P3 are tied for 2nd place)
    player_ranks: list of player_ids submitted by users, e.g., [P1, P3, P2, P4]
    """
    
    # 转换用户输入为带索引的映射: {P1:0, P3:1, P2:2, P4:3}
    user_index_map = {pid: idx for idx, pid in enumerate(player_ranks)}
    
    current_rank_idx = 0
    
    for rank_set in actual_ranks:
        # rank_set 是真实排名在当前档位的玩家集合 (处理平局)
        # 例如 P2, P3 并列第2，那么他们在用户排列中必须占据 index 1 和 2
        
        # 1. 检查这些玩家是否在用户排列中占据了对应的连续位置
        target_indices = range(current_rank_idx, current_rank_idx + len(rank_set))
        
        for player_id in rank_set:
            user_pos = user_index_map[player_id]
            
            if mode == "NOVICE":
                # 新手模式：允许位置误差 +/- 1
                # 注意：对于并列情况，只要落在目标区间扩宽的范围内即可
                min_valid = min(target_indices) - 1
                max_valid = max(target_indices) + 1
                if not (min_valid <= user_pos <= max_valid):
                    return False
            else:
                # 正常/专家模式：必须精确落在目标索引区间内
                if user_pos not in target_indices:
                    return False
        
        current_rank_idx += len(rank_set)
        
    return True
```
