# 狼人杀 (Werewolf) 游戏规则与逻辑规范文档

本文档旨在为开发“狼人杀”电子版（App/Web/小程序）提供核心逻辑支撑。内容涵盖角色定义、游戏流程状态机、交互逻辑及胜负判定。

---

## 1. 游戏基础配置 (Game Config)

在开发前，需定义游戏的基本参数：
* **阵营 (Factions):** 好人阵营 (Good)、狼人阵营 (Werewolves)、第三方 (Third Party - 选做)。
* **状态 (Player Status):** 存活 (Alive)、死亡 (Dead)、离线 (Offline)。
* **死亡类型:** 吞噬 (Eaten)、毒杀 (Poisoned)、枪杀 (Shot)、放逐 (Banished)、殉情 (Love-suicide)。

---

## 2. 角色详解 (Role Definitions)

电子版需要为每个角色赋予属性（`Attributes`）和技能（`Skills`）。

### 2.1 狼人阵营
| 角色 | 技能逻辑 | 夜间行动优先级 |
| :--- | :--- | :--- |
| **狼人 (Werewolf)** | **夜间袭击：** 所有狼人共享一个语音频道/聊天室。每晚可指定一名玩家进行杀害。多数票决定袭击目标，平票则随机或重选。 | **P1** (通常最先睁眼，或在守卫之后) |
| **狼王 (Wolf King)** | **被动技能：** 出局时（被刀除外）可以发动技能带走一人。**限制：** 被毒杀不能发动技能。 | 同狼人 |
| **白狼王 (White Wolf King)** | **自爆带人：** 白天发言阶段可随时自爆，直接进入黑夜，并带走一名玩家。 | 同狼人 |

### 2.2 好人阵营 - 神职 (Gods)
| 角色 | 技能逻辑 | 夜间行动优先级 |
| :--- | :--- | :--- |
| **预言家 (Seer)** | **查验：** 每晚查验一名玩家身份。系统返回结果：`Good` (好人) 或 `Bad` (狼人)。 | **P3** (通常在女巫之后) |
| **女巫 (Witch)** | **解药：** 若有人被狼刀，系统提示“今晚TA死了”，可救活（全场仅1次）。<br>**毒药：** 可毒杀一人（全场仅1次）。<br>**限制：** 同一晚不能双药齐开。通常规则下，女巫不可自救（或仅第一夜可自救）。 | **P2** (在狼人之后) |
| **猎人 (Hunter)** | **亡语：** 死亡时可开枪带走一人。<br>**限制：** 被毒杀不能发动技能。系统需判断死亡原因决定是否弹出发动技能窗口。 | 无 (被动) |
| **守卫 (Guard)** | **守护：** 每晚守护一名玩家，免受狼刀伤害。<br>**限制：** 不能连续两晚守护同一人。**特殊结算：** 守卫与解药同在（同守同救）判定为死亡。 | **P0** (通常最早睁眼) |
| **白痴 (Idiot)** | **免死：** 白天被投票放逐时，翻牌亮明身份，免除死亡，但在后续游戏中失去投票权，只能发言。 | 无 (被动) |
| **骑士 (Knight)** | **决斗：** 白天发言阶段可随时翻牌指定一人决斗。若对方是狼，狼死，直接入夜；若对方是好人，骑士死，继续发言。 | 无 (主动-白天) |

### 2.3 好人阵营 - 平民 (Villagers)
* **技能：** 无特殊技能。
* **逻辑：** 仅参与白天的发言和投票。

---

## 3. 游戏流程状态机 (Game Loop State Machine)

游戏主循环分为：`Setup` -> `Night Loop` -> `Day Loop` -> `Check Win` -> `End`.

### 3.1 初始阶段 (Setup)
1.  **分配身份：** 随机将角色列表分配给 `PlayerID`。
2.  **初始化变量：**
    * `DayCount = 1`
    * `SheriffID = None` (警长ID)
    * `AlivePlayers = [All IDs]`
    * `WitchInventory = {Save: 1, Poison: 1}`

### 3.2 夜间阶段 (Night Phase)
系统按优先级唤醒角色。非当前行动角色的客户端显示“等待中...”。

1.  **守卫阶段：**
    * 输入：`TargetID`
    * 校验：`TargetID != LastProtectedID`
    * 输出：记录 `ProtectedID`
2.  **狼人阶段：**
    * 输入：狼人团队投票 `TargetID`
    * 输出：记录 `WolfKillID`
3.  **女巫阶段：**
    * 显示：若 `WolfKillID` 存在，显示该ID（具体规则视配置而定，有些规则不显示）。
    * 输入：使用解药 (`Action: Save`) 或 使用毒药 (`Action: Poison, Target: ID`) 或 跳过。
    * 逻辑：若 `Action == Save` 且 `WitchInventory[Save] > 0`，则标记 `Healed = True`。
4.  **预言家阶段：**
    * 输入：`TargetID`
    * 输出：显示 `Good` 或 `Bad` (需注意：妖狐等第三方可能显示Good但实际非好人，此处主要区分狼/非狼)。
5.  **其他角色：** 猎人查看自己开枪状态等。

### 3.3 天亮结算逻辑 (Dawn Resolution) - **核心算法**
在进入白天前，系统需后台计算死亡名单：

```pseudo
List<Player> DeadList = [];

// 1. 处理狼刀
if (WolfKillID != null) {
    if (Healed) {
        // 被女巫救了
        if (ProtectedID == WolfKillID) {
            // 同守同救 -> 奶穿 -> 死亡
            DeadList.add(WolfKillID);
            DeathReason[WolfKillID] = "MilkPierce"; // 奶穿
        } else {
            // 平安夜
        }
    } else if (ProtectedID == WolfKillID) {
        // 守卫守护成功 -> 平安夜
    } else {
        // 确实被刀死
        DeadList.add(WolfKillID);
        DeathReason[WolfKillID] = "Eaten";
    }
}

// 2. 处理女巫毒药
if (PoisonTargetID != null) {
    DeadList.add(PoisonTargetID);
    DeathReason[PoisonTargetID] = "Poisoned";
}

// 3. 处理猎人/狼王状态
foreach (player in DeadList) {
    player.isAlive = false;
    if (player.Role == Hunter && player.DeathReason == "Poisoned") {
        player.CanShoot = false;
    } else if (player.Role == Hunter) {
        player.CanShoot = true;
    }
    // ... 狼王同理
}
```

### 3.4 白天阶段 (Day Phase)

1.  **公布死讯 (Announcement)：**
    * 若 `DeadList` 为空，显示“昨晚是平安夜”。
    * 否则，显示死亡名单（通常不公布具体死因，只说谁死了）。
2.  **亡语 (Death Rattle)：**
    * 仅“夜间死亡”且“首夜”（部分规则）或“特定角色”可发表遗言。
    * **技能发动：** 此时检测猎人/狼王是否发动技能带人。若带人，被带者死亡，无遗言。
3.  **警长竞选 (Election) - 仅第一天：**
    * **上警：** 玩家选择是否竞选。
    * **发言：** 竞选玩家依次发言。
    * **退水：** 发言结束后可退出。
    * **投票：** 未竞选玩家投票。票数最高者当选，获得 1.5 票权。
4.  **正常发言 (Discussion)：**
    * 从死者左/右或警长指定顺序开始发言。
    * 系统需控制麦克风权限和倒计时。
5.  **投票放逐 (Voting)：**
    * 所有存活玩家投票（除白痴翻牌后）。
    * **计票：** 普通玩家1票，警长1.5票。
    * **平票处理：** 平票玩家PK发言 -> 再次投票 -> 若仍平票则无人出局（直接入夜）。
6.  **放逐结算：**
    * 最高票者死亡。
    * 发表遗言。
    * 若是猎人/狼王/白痴，触发相应技能。
    * 若警长死亡，需选择移交警徽或撕毁警徽。

---

## 4. 胜利条件判定 (Winning Conditions)

每当有玩家死亡或身份发生变化时，立即运行此检查函数。

### 4.1 屠边局 (Side-Kill) - 最流行规则
* **狼人胜利：**
    * 所有 **神职 (Gods)** 死亡 `OR`
    * 所有 **平民 (Villagers)** 死亡。
* **好人胜利：**
    * 所有 **狼人 (Werewolves)** 死亡。

### 4.2 屠城局 (Full-Kill)
* **狼人胜利：** 除狼人外所有玩家死亡。
* **好人胜利：** 所有狼人死亡。

---

## 5. 电子版特殊功能建议

1.  **笔记功能 (Note-taking)：** 允许玩家标记其他人的身份猜测（如：标为金水、查杀、铁狼），仅自己可见。
2.  **复盘记录 (Game Log)：** 游戏结束后，展示完整的时间轴：
    * *Day 1 Night: 狼人刀了 3号，女巫救了 3号，预言家验了 5号(狼)...*
3.  **防作弊 (Anti-Cheat)：**
    * 夜间阶段屏蔽非行动玩家的屏幕和声音。
    * 随机延迟（防止通过操作时长猜测身份）。
