# Bohnanza: Das Würfelspiel (电子版开发指南)

这份文档详细介绍了《Bohnanza: Das Würfelspiel》（2022年 AMIGO 5颗骰子版本）的规则与逻辑，旨在协助开发者将其数字化。

## 1. 游戏概述 (Game Overview)

* **玩家人数**: 2-5 人
* **获胜条件**: 首位获得 **10 金币 (Bohnentaler)** 的玩家立即获胜。
* **核心机制**: 骰子管理、推运 (Push-your-luck)、被动收益 (所有玩家在当前玩家的回合均可获胜)。

---

## 2. 游戏组件 (Components)

### 2.1 骰子 (Dice)
游戏共有 **5 颗** 6面骰子，分为两种颜色。骰子面代表不同的豆子。

* **豆子类型 (按稀有度排序)**:
    1.  🔵 **Blue** (Blaue Bohne) - 常见
    2.  🔥 **Fire** (Feuerbohne)
    3.  🤢 **Puff** (Saubohne / Broad Bean)
    4.  🦃 **Turkey** (Weinbrandbohne)
    5.  🏃 **Runner** (Brechbohne)
    6.  🥡 **Soy** (Sojabohne)
    7.  🌳 **Garden** (Gartenbohne) - 稀有

* **骰子分布数据 (用于代码定义)**:
    * **白骰子 (White Dice) x 3**: `[Blue, Fire, Puff, Turkey, Runner, Soy]` (无 Garden)
    * **黄骰子 (Yellow Dice) x 2**: `[Blue, Fire, Puff, Turkey, Runner, Garden]` (包含 Garden，替代了 Soy)

### 2.2 玩家面板 (Player Board / Card)
* **覆盖卡 (Cover Card)**: 每个玩家有一张用作“遮挡/计数器”的卡片，用于挡住自己任务卡上已完成的任务。
* **Bohnenfeld (豆田)**: 位于桌中央（或UI中心），用于存放当前玩家“锁定”的骰子。

### 2.3 任务卡 (Order Cards / Auftragskarten)
* 这是游戏的核心。每张卡正面有 **5 个任务 (Tasks)**，从下到上难度递增。
* **背面**: 金币图案 (1 Bohnentaler)。卡片本身既是任务也是钱。

---

## 3. 游戏流程 (Game Loop)

游戏按顺时针方向进行，当前轮到的玩家为**活跃玩家 (Active Player)**，其他人为**被动玩家 (Passive Players)**。

### 3.1 活跃玩家的回合结构

#### 阶段 A: 投掷与锁定 (Roll & Lock)
活跃玩家的目标是凑齐骰子来完成自己卡片上的任务。

1.  **初始投掷**: 活跃玩家投掷所有未锁定的骰子（第一掷为5颗）。
2.  **被动玩家检查 (Passive Check)**:
    * **此时此刻**，所有**被动玩家**检查场上**所有可见骰子**（包括刚投出的 + 之前锁定的）。
    * 如果骰子组合满足被动玩家任务卡上**当前未完成的最底层任务**，该玩家宣布“完成”，并移动遮挡卡，露出下一层任务。
    * *注意：被动玩家一回合内可以借此完成多个任务，只要每次投掷的结果都符合。*
3.  **锁定骰子 (Locking)**:
    * 活跃玩家**必须**至少将 1 颗刚投出的骰子放入“豆田” (锁定区)。
    * 玩家也可以选择锁定多颗，甚至全部。
    * 一旦锁定，骰子在本回合结束前不可再投。
4.  **继续或停止**:
    * 如果还有未锁定的骰子，玩家可以选择**继续投掷**剩余骰子（回到步骤 1）。
    * 如果玩家不想继续，或者所有5颗骰子都已锁定，则进入**结算阶段**。
    * *强制停止*: 如果玩家无法锁定任何骰子（例如规则变体限制，但在标准版中通常只要有骰子就能锁），或者所有骰子都在豆田里，回合强制结束。

#### 阶段 B: 活跃玩家结算 (Harvest)
当投掷阶段结束时，活跃玩家检查“豆田”中最终锁定的 5 颗骰子（不足5颗则按实际数量算，通常是投完为止）。

1.  **验证任务**: 对照自己任务卡，从下往上检查。
2.  **连续完成**: 活跃玩家利用这组最终骰子，可以一次性完成多个层级的任务。
    * *例如*: 骰子结果是 `[Blue, Blue, Fire, Fire, Soy]`。
    * 任务1: "2 Blue" -> 完成。
    * 任务2: "2 Fire" -> 完成。
    * 任务3: "1 Garden" -> 失败。
    * 玩家停在任务2。
3.  **记录进度**: 移动遮挡卡至最新完成的位置。

#### 阶段 C: 收割 (Refill / Scoring)
此阶段适用于所有玩家（如果在别人的回合完成了任务）。

1.  检查任务卡完成度：
    * 完成 **0-2** 个任务: 无奖励，卡片保留至下一回合继续用。
    * 完成 **3** 个任务: 获得 **1 金币**。
    * 完成 **4** 个任务: 获得 **2 金币**。
    * 完成 **5** (全部) 个任务: 获得 **3 金币**。
2.  **兑现**:
    * 如果玩家决定收割（或被迫收割，如已完成全部），将当前任务卡翻面（变为金币），放入得分堆。
    * 从牌堆抽取一张新的任务卡。
    * *策略点*: 如果只完成了3个，玩家可以选择不收割，留着卡片下回合继续做第4个任务以博取更高收益；但如果不收割，下回合必须完成第4个才能获得收益，否则这回合白费。
    * *注意*: 如果完成了全部5个，必须强制收割。

---

## 4. 任务卡生成逻辑 (Card Generation Logic)

为了电子版实现，建议不要硬编码所有卡片，而是构建一个**任务生成器 (Task Generator)**。每张卡包含 5 个 Level，难度由概率决定。

### 4.1 基础数据结构
```json
{
  "bean_types": ["Blue", "Fire", "Puff", "Turkey", "Runner", "Soy", "Garden"],
  "dice_pool": { "white": 3, "yellow": 2 }
}
```

### 4.2 任务类型 (Task Archetypes)
你需要实现以下几种逻辑检查函数：

1.  **Count (数量类)**: 需要 X 个特定类型的豆子。
    * *例*: `Require: 2x Fire`
2.  **Sum (总数类)**: 需要任意 X 个豆子，但这X个必须是同一类 (X-of-a-kind)。
    * *例*: `Require: 3x Any Same Bean`
3.  **Set (集合类)**: 需要特定的组合。
    * *例*: `Require: 1x Blue + 1x Fire`
    * *例*: `Require: 1x Puff + 1x Soy`
4.  **Exclusion (排除类)**: 骰子中不能包含特定豆子。
    * *例*: `No Blue Beans` (在5颗骰子中)
5.  **Pattern (模式类)**:
    * *Full House*: 3个A类 + 2个B类。
    * *Street*: 1 Blue, 1 Fire, 1 Puff, 1 Turkey, 1 Runner (大顺子/小顺子).

### 4.3 难度分级与生成算法 (Level Design)
生成卡片时，按照 Level 1 (最容易) 到 Level 5 (最难) 的概率模型填充。

**概率参考 (基于5颗骰子):**

* **Level 1 (极易)**:
    * 逻辑: `Count(1, [Blue/Fire])` 或 `Count(2, [Blue])`
    * 描述: 只要有1个火豆或2个蓝豆。
* **Level 2 (容易)**:
    * 逻辑: `Count(2, [Fire/Puff])` 或 `Set(1 Blue + 1 Turkey)`
* **Level 3 (中等 - 门槛级)**: *完成此级可得1金币*
    * 逻辑: `Count(3, [Blue])` 或 `Set(2 Fire + 1 Puff)`
    * 逻辑: `3-of-a-kind (Any)`
* **Level 4 (困难)**:
    * 逻辑: `Count(1, [Garden])` (因为Garden只有2/5的骰子有)
    * 逻辑: `Full House (3+2)`
    * 逻辑: `Set(1 Soy + 1 Runner + 1 Turkey)`
* **Level 5 (极难)**:
    * 逻辑: `4-of-a-kind`
    * 逻辑: `Count(2, [Garden])` (非常难，需要两颗黄骰子都中)
    * 逻辑: `Sequence (Blue, Fire, Puff, Turkey, Runner)`

### 4.4 伪代码实现示例 (Python-like)

```python
class Task:
    def check(self, rolled_dice):
        pass

class CountTask(Task):
    def __init__(self, target_bean, count):
        self.target = target_bean
        self.count = count
    def check(self, dice):
        return dice.count(self.target) >= self.count

def generate_card():
    card = []
    # Level 1: High probability
    card.append(CountTask("Blue", 2)) 
    # Level 2
    card.append(CountTask("Fire", 2))
    # Level 3 (Checkpoint)
    card.append(MixTask([("Blue", 1), ("Puff", 1), ("Turkey", 1)]))
    # Level 4
    card.append(CountTask("Soy", 2))
    # Level 5
    card.append(CountTask("Garden", 1)) 
    return card
```

## 5. UI/UX 关键点 (Digital Implementation Tips)

1.  **被动玩家提示**: 在活跃玩家每次投骰后，系统应自动高亮显示被动玩家是否满足了任务。这能极大加快游戏节奏，避免玩家手动核对。
2.  **锁定辅助**: 当活跃玩家点击骰子锁定时，实时显示“预览”：如果锁定这几颗，是否能满足当前任务？
3.  **概率显示 (可选)**: 既然是电子版，可以显示“再投一次获得所需豆子”的概率（例如：你需要Garden，提示玩家“仅黄骰子可出，概率 16%”）。
4.  **自动收割逻辑**: 当玩家完成3个或4个任务时，弹窗询问：“要现在收割拿钱，还是继续博取下一级？”。

## 6. 特殊规则处理

* **豆田填满**: 如果活跃玩家在投掷中没有任何骰子可锁（极为罕见，或者玩家自愿锁完），回合立即结束。
* **无缝结算**: 活跃玩家的结算是基于“最终状态”，而被动玩家的结算是基于“中间过程”。这是代码逻辑最容易出错的地方，请务必区分 `Event: OnRoll` (触发被动检查) 和 `Event: TurnEnd` (触发主动检查)。