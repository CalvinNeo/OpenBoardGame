# 《方鸟》游戏规则与开发指南

## 1. 游戏概述 (Game Overview)

* **玩家人数**：2-5 人
* **游戏目标**：收集鸟类，率先达成获胜条件。
* **核心机制**：手牌管理、成套收集、"三明治"夹击机制。

## 2. 基础数据配置 (Data Configuration)

### 2.1 卡牌种类 (Bird Species)
游戏共有 8 种鸟类，总计 110 张卡牌。每种鸟类有不同的**总数量**和**成群阈值**（小群/大群）。

| 鸟类名称 (ID) | 总数量 (Count) | 小群阈值 (Small Flock) | 大群阈值 (Big Flock) | 稀有度 |
| :--- | :---: | :---: | :---: | :--- |
| **火烈鸟 (Flamingo)** | 7 | 2 | 3 | 极稀有 |
| **猫头鹰 (Owl)** | 10 | 3 | 4 | 稀有 |
| **大嘴鸟 (Toucan)** | 10 | 3 | 4 | 稀有 |
| **鸭子 (Duck)** | 10 | 3 | 4 | 稀有 |
| **鹈鹕 (Pelican)** | 10 | 3 | 4 | 稀有 |
| **鹦鹉 (Parrot)** | 13 | 4 | 6 | 普通 |
| **麻雀 (Sparrow)** | 16 | 4 | 6 | 普通 |
| **喜鹊 (Magpie)** | 20 | 5 | 7 | 常见 |

> **开发注**：
> * `Small Flock`：打出 >= 该数量的牌，可保留 1 张作为分数。
> * `Big Flock`：打出 >= 该数量的牌，可保留 2 张作为分数。

### 2.2 游戏区域 (Game State)

1.  **中央牌库 (Deck)**：包含所有未使用的卡牌。
2.  **弃牌堆 (Discard Pile)**：存放被弃掉的卡牌。
3.  **场地区域 (The Fence)**：
    * 由 **4 行 (Rows)** 组成。
    * 每行存放若干张鸟类卡牌。
4.  **玩家区域 (Player State)**：
    * **手牌 (Hand)**：玩家手中持有的牌（不公开，但通常知道数量）。
    * **收藏区 (Collection)**：玩家已得分的鸟类（公开）。

---

## 3. 游戏初始化 (Setup Phase)

1.  **洗牌**：将所有 110 张卡牌洗混形成牌库。
2.  **布置场地**：
    * 在场地区域的 4 行中，每行从牌库翻出 **3 张** 卡牌。
    * **特殊去重规则**：在初始化时，如果某一行出现了重复种类的鸟，必须持续从牌库抽牌并覆盖在该行，直到该行展示出 **3 种完全不同** 的鸟类为止。所有被覆盖的（重复的）鸟类放入弃牌堆。
    * *开发逻辑*：`While (unique_species_count < 3) { draw_card(); if (is_duplicate) discard(); else add_to_row(); }`
3.  **分发手牌**：
    * 每位玩家分发 **8 张** 手牌。
    * 每位玩家获得 **1 张** 额外的牌正面朝上放入自己的**收藏区**（作为初始分数）。
4.  **起始玩家**：随机决定。

---

## 4. 游戏流程 (Turn Structure)

游戏按顺时针方向进行，直到有人获胜。每位玩家的回合包含以下步骤：

### 阶段 A：出牌 (Lay Birds) - **强制行动**

玩家必须从手牌中选择 **一种** 鸟类，并将手牌中 **所有** 该种类的鸟打出。

1.  **选择位置**：玩家选择场地中的 **某一行**，并将牌放在该行的 **左侧** 或 **右侧**。
2.  **判定夹击 (Surround & Capture)**：
    * 检查放置位置的 **另一端** 的鸟类种类。
    * **情况 1：触发夹击 (Match Found)**
        * 如果刚打出的鸟类与该行另一端的鸟类 **相同**。
        * **执行捕获**：玩家拿走这两组同类鸟之间 **所有** 的卡牌（即被夹在中间的牌），放入自己的 **手牌**。
        * **并入**：将刚才打出的牌与另一端同类的牌合并，留在该行中（如果行空了，可能触发补牌，但在CuBirds中，留下的牌通常就构成了新的一行）。
    * **情况 2：未触发夹击 (No Match)**
        * 如果刚打出的鸟类与另一端的鸟类 **不同**。
        * 玩家将这些牌留在那一端。
        * **强制抽牌**：玩家必须选择从牌库顶摸 **2 张** 卡牌加入手牌（若牌库不足，有多少摸多少）。

> **场地维护逻辑 (Row Maintenance)**：
> * 如果在捕获后，某一行 **变空了** (0 张牌)，必须立即从牌库顶翻牌填充该行，直到该行拥有卡牌（通常补到和初始设置类似，或者直到出现不同种类的鸟，但在标准规则中，如果一行空了，通常是翻牌直到有牌）。
> * *标准规则修正*：如果某行在玩家回合结束时为空，应从牌库翻出卡牌填补，直到该行有不同种类的鸟（类似于Setup，但通常只补牌直到非空即可，具体视房规，建议实现为：补牌直到该行有不少于1张牌）。

### 阶段 B：成群 (Complete a Flock) - **可选行动**

在阶段 A 结束后，玩家可以检查自己的手牌，看是否能组成“鸟群”来得分。

1.  **展示**：玩家展示手牌中 **所有** 某一种类的鸟（必须全部展示）。
2.  **判断阈值**：
    * **数量 >= 大群阈值 (Big Flock)**：玩家将其中 **2 张** 放入**收藏区**（得分），其余该种类的牌放入**弃牌堆**。
    * **数量 >= 小群阈值 (Small Flock)**：玩家将其中 **1 张** 放入**收藏区**（得分），其余该种类的牌放入**弃牌堆**。
    * **数量 < 小群阈值**：无法成群，行动失败（通常玩家不会选择执行此操作）。
3.  **限制**：此阶段可以多次执行（针对不同种类的鸟），只要玩家手牌满足条件。

### 阶段 C：回合结束检查 (End of Turn Check)

* **如果当前玩家的手牌为空**：
    * 所有 **其他玩家** 必须立即弃掉所有手牌。
    * 将弃牌堆洗入牌库（如果需要）。
    * 所有玩家（包括当前玩家）从牌库重新抽取 **8 张** 牌。
    * 当前玩家的回合结束，游戏继续。
* **如果当前玩家手牌不为空**：
    * 回合直接结束，轮到下家。

---

## 5. 胜利条件 (Winning Conditions)

在每位玩家回合结束时，检查其**收藏区**。如果满足以下任一条件，该玩家立即获胜：

1.  **七彩鸟 (Diversity Victory)**：收藏区拥有 **7 种** 不同的鸟类（每种至少 1 张）。
2.  **双三鸟 (Majority Victory)**：收藏区拥有 **2 种** 不同的鸟类，且这两种鸟类的数量都 **>= 3 张**。

---

## 6. 电子版实现伪代码 (Implementation Pseudo-code)

### 6.1 数据结构

```typescript
enum BirdType { Flamingo, Owl, Toucan, Duck, Pelican, Parrot, Sparrow, Magpie }

interface BirdConfig {
    id: BirdType;
    totalCount: number;
    smallFlock: number;
    bigFlock: number;
}

interface Card {
    id: string; // unique GUID
    type: BirdType;
}

interface Row {
    cards: Card[]; // Ordered list, index 0 is Left, index length-1 is Right
}

interface Player {
    id: string;
    hand: Card[];
    collection: Map<BirdType, number>; // Count of banked birds
}

interface GameState {
    rows: Row[4];
    deck: Card[];
    discardPile: Card[];
    players: Player[];
    currentPlayerIndex: number;
}
```

### 6.2 核心逻辑函数

#### `playCards(player, birdType, rowIndex, side)`
```typescript
function playCards(player, birdType, rowIndex, side) {
    // 1. Validate
    const cardsToPlay = player.hand.filter(c => c.type === birdType);
    if (cardsToPlay.length === 0) throw Error("Player doesn't have this bird");

    // 2. Remove from hand
    player.hand = player.hand.filter(c => c.type !== birdType);

    const row = rows[rowIndex];
    
    // 3. Check Surround Logic
    let captured = false;
    let targetBirdType = null;
    
    // 获取该行另一端的鸟
    if (row.cards.length > 0) {
        if (side === 'LEFT') {
            targetBirdType = row.cards[row.cards.length - 1].type; // Right end
        } else {
            targetBirdType = row.cards[0].type; // Left end
        }
    }

    // Determine Capture
    if (targetBirdType === birdType) {
        captured = true;
        // Logic: Take all cards *between* the new cards and the matching end
        // Since we are sandwiching, we take everything currently in the row
        // And place the newly played cards + the matching end card(s) back?
        // NO, the rule is: Take cards strictly BETWEEN the matching species.
        
        // Correct Algorithm:
        // 1. Identify the block of matching birds at the far end.
        // 2. Player takes all cards that are NOT that matching species.
        // 3. The newly played cards join the matching species at the far end.
        
        const collectedCards = row.cards.filter(c => c.type !== birdType);
        player.hand.push(...collectedCards);
        
        // Row now consists of: Only the matching birds (original + new)
        // Note: In CuBirds, usually the enclosed cards are taken, 
        // and the surrounding birds merge.
        // Simplified: Clear row, put back (Old Matching + New Playing).
        const oldMatching = row.cards.filter(c => c.type === birdType);
        row.cards = [...oldMatching, ...cardsToPlay]; 
        
    } else {
        // No Capture
        if (side === 'LEFT') {
            row.cards.unshift(...cardsToPlay);
        } else {
            row.cards.push(...cardsToPlay);
        }
        
        // Penalty Draw
        drawCardsFromDeck(player, 2);
    }
    
    // 4. Refill Row Check
    if (row.cards.length === 0) {
        refillRowUntilValid(row);
    }
}
```

#### `bankBirds(player, birdType)`
```typescript
function bankBirds(player, birdType) {
    const handCount = countBirdsInHand(player, birdType);
    const config = getBirdConfig(birdType);
    
    let keepCount = 0;
    
    if (handCount >= config.bigFlock) {
        keepCount = 2;
    } else if (handCount >= config.smallFlock) {
        keepCount = 1;
    } else {
        throw Error("Not enough birds to flock");
    }
    
    // Execute
    // 1. Remove all birds of this type from hand
    removeAllFromHand(player, birdType);
    
    // 2. Add keepCount to Collection
    addToCollection(player, birdType, keepCount);
    
    // 3. Put (handCount - keepCount) into Discard Pile
    addToDiscard(birdType, handCount - keepCount);
    
    checkWinCondition(player);
}
```

#### `checkEmptyHand(player)`
```typescript
function checkEmptyHand(player) {
    if (player.hand.length === 0) {
        // Deal 8 cards to EVERYONE
        game.players.forEach(p => {
            discardHand(p);
            drawCardsFromDeck(p, 8);
        });
        // Note: Deck reshuffle logic needed if deck runs out
    }
}
```

## 7. 边缘情况与注意事项 (Edge Cases)

1.  **牌库耗尽**：任何时候若牌库不足以抽牌，立即将弃牌堆洗混成为新牌库。
2.  **单一种类填满行**：如果某行只有一种鸟类（例如全是鹦鹉），玩家打出鹦鹉。此时没有“中间”的牌可拿。规则视为没有触发夹击（因为没有异类鸟被夹），玩家将牌加入该行并强制摸 2 张牌。
3.  **同时达成胜利条件**：若玩家同时满足“7种不同”和“2种3张”，显示获胜即可，无优先顺序区别。
4.  **手牌为空重置**：这是游戏节奏转换的关键点，开发时务必添加明显的UI动画（如“Deal!”），因为这会打断其他玩家的规划。