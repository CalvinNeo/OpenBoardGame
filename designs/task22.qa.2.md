# 得分沙拉 - 108张卡牌生成器与完整规则补全

## 1. 之前遗留问题的确认 (Clarifications)

### 关于“最少 (Fewest)”的 0 数量与并列
* **规则**: 如果某位玩家没有该蔬菜（数量为 0），**视为数量为 0 参与比较**。
* **并列逻辑**:
    * 如果有玩家 A（0个）、玩家 B（0个）、玩家 C（2个）。
    * A 和 B **并列最少**。
    * A 和 B **都获得 7 分**。
    * *注：在某些极端规则下（如两人局），如果双方都是 0，通常双方都得分（因为都满足条件），或者该卡牌作废。但在电子版实现中，推荐“双方都得 7 分”以保持逻辑一致性 (`if my_count == min_count then score`)。*

---

## 2. 卡牌生成核心逻辑：循环群 (The Cyclic Group)

我们将 6 种蔬菜定义为一个有序数组，所有卡牌关系基于**索引偏移 (Offset)** 生成。

### 2.1 蔬菜索引映射
```javascript
const VEGGIES = [
  0: "Lettuce" (生菜),
  1: "Pepper"  (甜椒),
  2: "Tomato"  (番茄),
  3: "Carrot"  (胡萝卜),
  4: "Onion"   (洋葱),
  5: "Cabbage" (卷心菜)
];
// 辅助函数：获取偏移后的蔬菜
const getVeggie = (baseIndex, offset) => VEGGIES[(baseIndex + offset) % 6];
```

### 2.2 单一蔬菜的 18 张基础模板 (The 18-Card Template)
假设当前**卡牌背面**是 `BaseVeggie` (索引 `i`)，其**正面（得分规则）**的 18 张配置如下。
*请在代码中遍历 `i` 从 0 到 5，对每种蔬菜重复应用此模板。*

#### A组：简单权重 (3张)
*逻辑：鼓励收集本蔬菜，惩罚其他蔬菜。为了平衡，惩罚对象分布在不同的“距离”。*
* **Card 1**: `+2 Base` / `-1 getVeggie(i, 1)` (邻居1)
* **Card 2**: `+2 Base` / `-1 getVeggie(i, 2)` (邻居2)
* **Card 3**: `+2 Base` / `-1 getVeggie(i, 3)` (对面蔬菜)

#### B组：蔬菜组合求和 (3张)
*逻辑：每张 A 1分，每张 B 1分。*
* **Card 4 (双组合)**: `1/item Base` & `1/item getVeggie(i, 1)`
* **Card 5 (双组合)**: `1/item Base` & `1/item getVeggie(i, 2)`
* **Card 6 (三组合)**: `1/item Base` & `1/item getVeggie(i, 1)` & `1/item getVeggie(i, 2)`

#### C组：成套收集 (1张)
*逻辑：凑齐一套得 8 分。*
* **Card 7**: 每套 `(Base, getVeggie(i, 3), getVeggie(i, 4))` 得 8 分。
    * *注：这里特意选了 +3, +4 偏移，是为了让不同卡牌覆盖不同的蔬菜组合。*

#### D组：多样性 (2张) - 通用卡
*逻辑：不绑定具体蔬菜，增加通用性。*
* **Card 8**: 蔬菜种类 >= 3，得 5 分。
* **Card 9**: 蔬菜种类 = 6 (全套)，得 12 分。

#### E组：奇偶性 (2张)
* **Card 10**: `Base` 数量为 **偶数** 得 7 分 (奇数 3 分)。
* **Card 11**: `Base` 数量为 **奇数** 得 7 分 (偶数 3 分)。

#### F组：自身比较 (2张)
* **Card 12**: `Base` 数量 **最多**，得 10 分。
* **Card 13**: `Base` 数量 **最少**，得 7 分。

#### G组：阈值 (1张)
* **Card 14**: 每 2 个 `Base` 得 5 分。

#### H组：Cross-Veggie 交叉计分 (4张)
*这是你提到的重点。这些卡背面是 Base，但正面规则与 Base 弱相关或无关，迫使玩家为了分放弃 Base 资源。*

* **Card 15 (交叉阈值)**: 每 2 个 `getVeggie(i, 1)` 得 5 分。
    * *例子：背面生菜，正面是“每2个甜椒得5分”。*
* **Card 16 (交叉比较)**: `getVeggie(i, 1)` 数量 **最多**，得 10 分。
* **Card 17 (交叉惩罚)**: 每 2 个 `getVeggie(i, 2)` 得 5 分。
    * *注：为了填补分布，此处再次使用阈值模板，但针对不同的偏移量蔬菜。*
* **Card 18 (负权重交叉)**: `3/item getVeggie(i, 4)` / `-2/item Base`。
    * *例子：背面生菜，正面“每1个洋葱得3分，但每1个生菜扣2分”。这是极具策略性的弃牌卡。*

---

## 3. 完整生成代码示例 (Python Logic)

直接运行这段代码即可生成完整的 108 张卡牌数据结构。

```python
import json

VEGGIES = ["Lettuce", "Pepper", "Tomato", "Carrot", "Onion", "Cabbage"]

def get_veg(base_idx, offset):
    return VEGGIES[(base_idx + offset) % 6]

deck = []
card_id_counter = 1

for i, base_veg in enumerate(VEGGIES):
    # 为每种蔬菜生成 18 张卡
    
    # --- Group A: Simple Weights (+2/-1) ---
    # Card 1-3
    deck.append({ "id": card_id_counter, "back": base_veg, "type": "WEIGHT", "params": { base_veg: 2, get_veg(i, 1): -1 } }); card_id_counter+=1
    deck.append({ "id": card_id_counter, "back": base_veg, "type": "WEIGHT", "params": { base_veg: 2, get_veg(i, 2): -1 } }); card_id_counter+=1
    deck.append({ "id": card_id_counter, "back": base_veg, "type": "WEIGHT", "params": { base_veg: 2, get_veg(i, 3): -1 } }); card_id_counter+=1
    
    # --- Group B: Sums ---
    # Card 4-5 (Double)
    deck.append({ "id": card_id_counter, "back": base_veg, "type": "SUM", "targets": [base_veg, get_veg(i, 1)] }); card_id_counter+=1
    deck.append({ "id": card_id_counter, "back": base_veg, "type": "SUM", "targets": [base_veg, get_veg(i, 2)] }); card_id_counter+=1
    # Card 6 (Triple)
    deck.append({ "id": card_id_counter, "back": base_veg, "type": "SUM", "targets": [base_veg, get_veg(i, 1), get_veg(i, 2)] }); card_id_counter+=1
    
    # --- Group C: Set ---
    # Card 7
    deck.append({ "id": card_id_counter, "back": base_veg, "type": "SET", "targets": [base_veg, get_veg(i, 3), get_veg(i, 4)], "points": 8 }); card_id_counter+=1
    
    # --- Group D: Variety ---
    # Card 8-9
    deck.append({ "id": card_id_counter, "back": base_veg, "type": "VARIETY", "min_types": 3, "points": 5 }); card_id_counter+=1
    deck.append({ "id": card_id_counter, "back": base_veg, "type": "VARIETY", "min_types": 6, "points": 12 }); card_id_counter+=1
    
    # --- Group E: Parity ---
    # Card 10-11
    deck.append({ "id": card_id_counter, "back": base_veg, "type": "PARITY", "target": base_veg, "mode": "EVEN", "points": 7, "fallback": 3 }); card_id_counter+=1
    deck.append({ "id": card_id_counter, "back": base_veg, "type": "PARITY", "target": base_veg, "mode": "ODD", "points": 7, "fallback": 3 }); card_id_counter+=1
    
    # --- Group F: Comparison (Self) ---
    # Card 12-13
    deck.append({ "id": card_id_counter, "back": base_veg, "type": "COMPARE", "mode": "MOST", "target": base_veg, "points": 10 }); card_id_counter+=1
    deck.append({ "id": card_id_counter, "back": base_veg, "type": "COMPARE", "mode": "FEWEST", "target": base_veg, "points": 7 }); card_id_counter+=1
    
    # --- Group G: Threshold (Self) ---
    # Card 14
    deck.append({ "id": card_id_counter, "back": base_veg, "type": "THRESHOLD", "target": base_veg, "count": 2, "points": 5 }); card_id_counter+=1
    
    # --- Group H: Cross-Veggie (Others) ---
    # Card 15 (Threshold Other)
    deck.append({ "id": card_id_counter, "back": base_veg, "type": "THRESHOLD", "target": get_veg(i, 1), "count": 2, "points": 5 }); card_id_counter+=1
    # Card 16 (Most Other)
    deck.append({ "id": card_id_counter, "back": base_veg, "type": "COMPARE", "mode": "MOST", "target": get_veg(i, 1), "points": 10 }); card_id_counter+=1
    # Card 17 (Threshold Other 2)
    deck.append({ "id": card_id_counter, "back": base_veg, "type": "THRESHOLD", "target": get_veg(i, 2), "count": 2, "points": 5 }); card_id_counter+=1
    # Card 18 (Negative Weight Cross)
    deck.append({ "id": card_id_counter, "back": base_veg, "type": "WEIGHT", "params": { get_veg(i, 4): 3, base_veg: -2 } }); card_id_counter+=1

# print(json.dumps(deck, indent=2))
```

## 4. 最终数据结构说明
生成的 JSON 对象将完全覆盖所有情况，且保证了：
1.  **蔬菜分布均匀**: 每种蔬菜做背面的机会均等 (18次)。
2.  **得分机会均匀**: 每种蔬菜被记正分、负分、被比较的次数在整体上是平衡的。
3.  **Cross-Veggie 逻辑**: 明确了 Card 15-18 是如何引用 `offset +1`, `offset +2`, `offset +4` 的，这解决了你关于“具体公式”的疑问。

现在你拥有了开发《得分沙拉》所需的全部精确数据和逻辑。