# 问题1

- 行补牌规则有三种表述（捕获后立刻补、回合结束再补、补到“至少1张”或补到“3种不同”）。正式实现想用哪一种？
- 当某行为空时，玩家把牌打到该行，是否仍要“罚抽2张”？（因为另一端不存在、不会触发夹击）
- 夹击是否要求“中间必须有异类牌”？比如某行全是同一种鸟，或只有一张同类鸟：打出同类到另一端时，是一律视
为“未夹击并罚抽2”，还是也算夹击？
- 夹击后，玩家拿走的牌是否全部进手牌（非收藏区）？行上只保留“原匹配端 + 新打出的同类”，对顺序/方向是否有
显示需求？
- 成群（阶段B）与胜利判定的时机：是“每次成群后立即可能获胜”，还是“只在回合结束阶段C检查”？（伪代码与文字
描述有点不一致）
- “手牌为空重置”触发点：是回合结束时检查为空就触发，还是一旦阶段A打完就空也立刻触发？
- 初始“收藏区”那张牌：是否从牌库顶抽？是在发手牌前还是后？（影响牌序，想确认一下）

# 回答1

## 1. 行补牌规则 (Refill Logic)

**结论：采用“直到出现不同种类的鸟”规则。**

* **逻辑描述**：当某一行变为空时，必须立即从中央牌库顶一张接一张地翻牌并加入该行。
* **停止条件**：直到翻出的这张牌，与该行中**目前已有的牌**种类**不同**为止。
* **代码实现思路**：
    1.  翻第 1 张牌 -> 放入行（行内现在的种类是 A）。
    2.  继续翻下一张牌。
    3.  如果它是 A 类 -> 放入行，继续翻。
    4.  如果它是 B 类 (非 A) -> 放入行，**停止补牌**。
* **设计目的**：保证该行被填补后，至少有两种不同的鸟，从而让下一位玩家有机会通过打出 B 类鸟来夹击 A 类鸟，或者打出 A 类鸟来夹击 B 类鸟。如果只补 1 张，下一位玩家几乎无法进行有效互动。

## 2. 空行出牌 (Playing into Empty Row)

**结论：视为“未触发夹击”，必须执行“罚抽 2 张”。**

* **判定逻辑**：
    * 玩家将牌放入空行。
    * 检查另一端 -> 另一端不存在（Null）。
    * 判定：没有形成“两端同类”的结构。
    * 结果：牌留在行中，玩家执行强制抽牌（罚抽）。
* **注意**：结合第 1 点的补牌规则，这种情况通常只发生在“牌库抽干且弃牌堆不够重洗”的极端死局，或者上一玩家操作后行空了（但在标准流程中，行空了会立刻补牌，所以玩家几乎不会遇到面对空行出牌的情况。除非**补牌逻辑通过后，牌库彻底空了导致行无法补满**）。
    * *修正*：如果严格执行“行空立刻补牌”，玩家实际上**永远不会**在 Phase A 开始时面对空行。但代码必须处理牌库耗尽无法补牌的 Edge Case -> 此时按“未夹击”处理。

## 3. 夹击的判定标准 (Capture Validity)

**结论：中间必须有“异类牌”才算有效夹击，否则视为无效并罚抽。**

* **场景 A**：行内是 `[鹦鹉, 鹦鹉]`，玩家在另一端打出 `[鹦鹉]`。
    * 两端都是鹦鹉 -> 匹配成功。
    * 中间被夹住的牌 -> **0 张**。
    * **判定**：根据规则，玩家必须拿走中间所有的牌。既然没有牌可拿（Count = 0），则视为**未执行捕获**。
    * **结果**：新打出的鹦鹉并入该行（行变成 3 只鹦鹉），玩家**罚抽 2 张**。
* **场景 B**：行内是 `[鹦鹉, 麻雀, 鹦鹉]`。
    * 这在游戏中是不合法的行状态。行内永远是“一端是一种鸟，另一端是另一种，中间可能混杂”。
    * *更正*：行内的鸟会自动归类。正确的行结构通常是块状的，例如 `[鹦鹉, 鹦鹉, 麻雀, 麻雀]`。
    * 如果玩家打出 `[鹦鹉]` 在右侧（麻雀旁边） -> 不匹配 -> 罚抽。
    * 如果玩家打出 `[麻雀]` 在左侧（鹦鹉旁边） -> 不匹配 -> 罚抽。

**一句话逻辑**：`Captured_Count > 0` 才是有效夹击。如果 `Captured_Count == 0`，走罚抽流程。

## 4. 捕获后牌的去向与行序 (Destination & Order)

**结论：被夹住的牌进【手牌】，留下的牌合并。**

1.  **去向**：被夹在中间的所有异类鸟，全部进入玩家的**手牌 (Hand)**。**绝对不是**收藏区。收藏区只有在 Phase B（成群）时才能进入。
2.  **行序与方向**：
    * 假设行状态为：`[A, A, B, B, B]` (左A, 右B)。
    * 玩家在**右侧**打出 `[A]`。
    * 夹击成立：两端的 `A` 夹住了中间的 `B`。
    * 玩家拿走所有的 `B` 进手牌。
    * **合并**：场上剩下的牌是原有的 `[A, A]` 和新打出的 `[A]`。
    * **视觉处理**：它们合并在一起，变成 `[A, A, A]`。
    * **方向需求**：对于后续游戏逻辑，这 3 张 A 既是左端也是右端。当下一位玩家往左放或往右放时，接触的都是 A。

## 5. 胜利判定时机 (Winning Check Timing)

**结论：每次“成群”动作完成后，立即检查。**

* **流程**：
    1.  玩家执行 Phase B，展示鸟群，打出牌。
    2.  将得分鸟放入收藏区。
    3.  **立即检查**：收藏区是否满足“7种不同”或“2种 >= 3张”。
    4.  **若满足**：游戏**立即结束**，该玩家获胜（不需要等到回合结束，也不需要等其他人操作）。
    5.  **若不满足**：玩家若还有牌可成群，可继续执行 Phase B；否则进入 Phase C。

## 6. “手牌为空重置”触发点 (Empty Hand Reset)

**结论：仅在 Phase C (回合结束阶段) 检查。**

* 这是一个常见的误区，但在电子版实现中必须明确：
    * 如果玩家在 **Phase A** 打光了手牌（例如打出最后一张牌且没有触发夹击，被迫抽2张），他此时手牌不为空，游戏继续。
    * 如果玩家在 **Phase A** 打光手牌且成功夹击（拿回了中间的牌），手牌不为空，游戏继续。
    * 只有在 **Phase B**（成群）结束后，玩家手牌确实归零了。
    * 此时进入 **Phase C**：系统检测到 `Hand.Count == 0`。
    * **执行重置**：强制**其他所有玩家**弃掉手牌，重洗牌库，所有人发 8 张。
    * *关键点*：重置后，当前玩家的回合彻底结束，轮到下家（带着全新的 8 张牌）开始回合。

## 7. 初始“收藏区”设置 (Initial Collection)

**结论：发完手牌后，从牌库顶抽取。**

* **标准 Setup 序列**：
    1.  洗牌。
    2.  布置场地（4 行，满足去重规则）。
    3.  给每位玩家发 **8 张** 手牌。
    4.  **最后**，给每位玩家发 **1 张** 牌，**正面朝上** 放在其收藏区。
* **代码意义**：这个顺序保证了玩家获得的初始分是完全随机的，且不会占用手牌的 8 张配额。

---

## 汇总：核心逻辑伪代码修正

```typescript
// 针对回合结构的精确伪代码
function executeTurn(player) {
    // --- Phase A: Lay Birds (Mandatory) ---
    // 1. Player chooses bird type and side (Left/Right)
    // 2. Place cards
    // 3. Check surround
    let capturedCards = resolveSurround(row, player.playedCards);
    
    if (capturedCards.length > 0) {
        // Successful Capture
        player.hand.add(capturedCards);
        // The played cards merge with the matching end on the table
        mergeRowCards(row); 
        // Note: Do NOT draw 2 cards here
    } else {
        // No Capture (or 0 cards between match)
        drawCardsFromDeck(player, 2);
        // The played cards stay on the row
        row.addCards(player.playedCards);
    }
    
    // Check Refill IMMEDIATELY after Phase A action
    if (row.isEmpty()) {
        refillRowUntilDifferent(row);
    }

    // --- Phase B: Complete Flocks (Optional, Loopable) ---
    while (player.wantsToFlock()) {
        let flockType = player.chooseFlock();
        scoreBirds(player, flockType); // Move to collection
        
        // WIN CHECK IMMEDIATE
        if (checkWinCondition(player)) {
            endGame(winner = player);
            return;
        }
    }

    // --- Phase C: End of Turn Check ---
    if (player.hand.length === 0) {
        // THE RESET EVENT
        forceDiscardAllOtherPlayers();
        reshuffleDeck(); // Include discard pile
        dealCardsToAll(8);
        // Turn ends immediately after reset
    }
    
    // Pass turn to next player
}