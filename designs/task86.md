# Task 86 — Hot Streak（火热连胜）实现方案

## 1. 任务结论

在 OpenBoardGame 中新增 `Hot Streak`（中文常见译名：火热连胜），内部游戏 ID 使用 `hot_streak`。

> **当前实现状态（2026-09-16）**：规则引擎、Bot、响应式前端、Help/Explain、测试与游戏注册均已实现并可完整游玩。当前组件表明确标记为 `prototype-compatible-v1`；牌张分布、赛道坐标、票面赔率和 Side Bet 文案尚未由合法持有的第二印刷版实体组件双人复核，因此不宣称与商业版组件完全一致。复核后只需替换数据文件并更新校验元数据，状态机与前端无需改写。

本任务的首版范围是标准 **2–8 人、3 场比赛**规则。官方另有 9 人以上的派对变体，但它使用不同的下注、奖金池和换牌流程，不应混入标准模式；首版暂不实现，见「后续范围」。

实现目标：

- 服务端权威地管理抽牌、秘密手牌、秘密投入牌、下注、移动、淘汰、结算和回合切换。
- 所有客户端只接收自己有权看到的信息，不能通过状态包、事件或重连恢复窥视未来牌序和其他玩家手牌。
- 比赛过程逐张公开并动画播放，而不是客户端一次性拿到完整未来结果。
- 严格遵守 `FRONTEND.md`：英文非游戏 UI、无横向页面滚动、移动端可用、Help/Explain 完整、弹窗支持 Esc、空白处取消选择、每场结算后所有玩家确认才进入下一场。
- 不复用商业版 Logo、插画、卡面、票面、钞票或赛道美术。视觉全部由 Emoji、CSS 颜色、纹理、文字和简单几何图形自制。

## 2. 规则版本、资料来源与数据可信度

### 2.1 识别信息

- 英文名：Hot Streak
- 中文常见译名：火热连胜 / 火熱連勝
- 设计者：Jon Perry、Alex Hague、James Nathan Spencer、Justin Vickers
- 官方产品页：<https://www.cmyk.games/products/hot-streak>
- BGG：<https://boardgamegeek.com/boardgame/446497/hot-streak>
- 第二印刷版规则书镜像：<https://gamers-hq.de/media/pdf/dc/37/cf/Hot_Streak_rulebook_2nd_printing.pdf>
- 在线规则整理：<https://www.rulespal.com/hot-streak/rulebook>
- 快速设置说明：<https://static1.squarespace.com/static/5a354c24ace8643e5c9ba8ad/t/6862c0981ddc6e40641a403b/1751302296904/QuickSetupGuide_HotStreak.pdf>

资料只用于确认玩法机制。仓库中不得保存从上述网页或规则书截取的商业图片。

### 2.2 上线前数据门槛

公开规则足以确定流程，但以下数据与实体组件强相关，照片存在透视、遮挡和版本差异，不能靠猜测上线：

1. 第二印刷版 53 张比赛牌的逐张效果、数量、所属角色和转向方向。
2. 赛道每条跑道的精确星位、起点、终点、折叠线和最终直道边界。
3. 18 张下注票的完整数值，尤其各角色/YES/NO 堆的中、下层 Risky 赔率。
4. 12 张 Side Bet 的准确触发时点和边界条件。
5. 同一时点多个角色出局、冲线、碰撞和 Side Bet 触发的第二印刷版裁定。

实现前应由一份合法持有的第二印刷版实体游戏或经授权的组件清单完成转录，并由两人复核。用于核对的照片不得提交到仓库。

如果暂时无法取得组件，可以建立标为 `prototype` 的自定义数据集做引擎开发，但 UI、帮助页和 README 必须明确写成「prototype-compatible data」，不得宣称与商业版组件完全一致，也不得把猜测的数据标成正式规则。

### 2.3 已确认的核心组件

- 4 个参赛角色。
- 53 张比赛牌。
- 12 张 Side Bet 卡。
- 12 张角色下注票：每个角色 3 张。
- 6 张 Side Bet 下注票：YES 3 张、NO 3 张。
- 现金。
- 四跑道赛道和可向前折叠的后沿。

## 3. 首版规则摘要

### 3.1 游戏目标

游戏进行 3 场比赛。玩家通过押注角色名次和当场 Side Bet 赚取现金；第三场还会加倍一张自己的下注票。第三场结算后现金最多者获胜，现金相同则并列获胜。

「现金最多者获胜」是数字版明确采用的结束条件。商业规则书中的娱乐性“人生结果”文案不复制。

### 3.2 初始设置

每名玩家从 `💵 $10` 开始。

#### 3–8 人

基础比赛牌堆由 4 张带边框的角色起始牌，加上下表数量的随机非起始牌组成：

| 玩家数 | 随机非起始牌 | 基础牌堆总数 | 每人手牌 | 每人下注票 | 每人投入牌 | 最终比赛牌堆 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 3 | 11 | 15 | 3 | 2 | 1 | 18 |
| 4 | 10 | 14 | 3 | 2 | 1 | 18 |
| 5 | 9 | 13 | 3 | 2 | 1 | 18 |
| 6 | 8 | 12 | 3 | 2 | 1 | 18 |
| 7 | 7 | 11 | 3 | 2 | 1 | 18 |
| 8 | 6 | 10 | 3 | 2 | 1 | 18 |

每名玩家从剩余比赛牌中获得 3 张私密手牌。基础牌堆内容公开，手牌不公开。

#### 2 人变体

- 基础牌堆：4 张起始牌 + 10 张随机非起始牌，共 14 张。
- 每人 4 张私密手牌。
- 每人每场选 3 张下注票。
- 每人秘密投入 2 张比赛牌，最终牌堆仍为 18 张。
- 第二、三场前，每人从上一场 18 张牌中重新获得 2 张手牌，使手牌恢复为 4 张。

### 3.3 首位玩家与蛇形选票

第一场随机决定首位玩家；第二、三场首位玩家按座位顺时针移动一位。

3–8 人每场每人选 2 张票，顺序是一次往返蛇形：

```text
座位 1 → 2 → 3 → … → N → N → … → 3 → 2 → 1
```

2 人每场每人选 3 张票：

```text
1 → 2 → 2 → 1 → 1 → 2
```

可选票堆共 6 个：4 个角色、`YES`、`NO`。每堆顶层票被拿走后才露出下一层。选择票时必须同时选择：

- `Safe`：回报较低，失败通常不扣钱。
- `Risky`：回报较高，失败可能扣钱。

一个动作必须原子地提交「票堆 + Safe/Risky」。不能先占票再选择风险模式。

### 3.4 第三场加倍

第三场中，玩家拿到自己的第二张下注票时，必须选择自己本场的一张票作为 `Double`。

- 2 人局虽然会拿 3 张票，仍在拿到第二张票时完成加倍选择。
- 加倍同时作用于正收益和负收益。
- 服务端在接受该次选票动作时原子记录加倍对象，不能先选票后补选，避免竞态和信息差。

这一时点需在实体版复核；如第二印刷版组件明确给出不同操作时点，以实体规则为准并更新测试。

### 3.5 秘密投入比赛牌

选票结束后：

- 3–8 人：每人从手牌秘密选 1 张。
- 2 人：每人从手牌秘密选 2 张。

所有投入牌与公开的基础牌堆混合，构成恰好 18 张的当场比赛牌堆。其他玩家只能看到某人是否已提交和提交数量，不能看到牌面。

### 3.6 比赛流程

1. 服务端洗混 18 张比赛牌。
2. 顶部 3 张面朝下烧掉。
3. 之后逐张公开并完整结算。
4. 至少 3 个角色已经冲线或被淘汰时，比赛结束；剩余角色自动获得唯一剩余名次。
5. 若牌堆耗尽而比赛仍未结束，执行赛道折叠和重新洗牌流程。

浏览器可显示 `3 … 2 … 1 … GO!`，但倒计时只是表现层；权威牌序、烧牌和比赛状态都在服务端。

### 3.7 角色状态

每个角色有：

- 跑道 `lane`
- 纵向位置 `position`
- 朝向 `facing`：`forward` 或 `backward`
- 姿态 `fallen`
- 状态 `active`、`finished` 或 `dq`
- 最终名次或并列名次范围
- 出局原因

角色可以共享一个格子。共享格本身不会自动造成碰撞；只有牌所规定的移动过程进入或穿过其他角色时才处理碰撞。

### 3.8 比赛牌效果

正式实现应把牌拆成顺序效果，例如：

```text
recover → move(+2)
move(+2) → swerve(right)
fall_down
turn_around
move_to_next_star
all_racers(move(+3))
```

不要在代码中按卡片名称堆叠大量特殊分支；数据描述效果，解析器按顺序执行。

#### 数字移动

- 正数沿角色当前面向移动。
- 负数沿角色当前面向的反方向移动。
- 站立角色按格逐步移动，以便准确处理冲线、越界和沿途碰撞。
- 倒地角色遇到任何数字移动只爬 1 格，方向仍按该牌原本应移动的方向决定。

#### 星星移动

- 站立角色移动到其当前面向方向上的下一个星位。
- 沿途仍逐格处理碰撞、冲线和越界。
- 该方向没有下一颗星时不移动。
- 倒地角色不跳星，只按该方向爬 1 格。

#### Fall Down

- 站立角色变为倒地。
- 已倒地角色再次遭遇 Fall Down，立即因 `knockout` 被淘汰。

#### Turn Around

角色在 `forward` 和 `backward` 之间切换。已出局或冲线角色不受影响。

#### Recover

先清除倒地状态并恢复向前，再执行牌上的移动。恢复顺序不能放到移动之后。

#### Swerve

- 先完成纵向移动；若已冲线或出局，不再执行侧移。
- 左/右是相对角色当前面向，而不是相对屏幕。
- 侧移出四条跑道即因 `side_out` 淘汰。
- 侧移进入站立角色所在格：被撞角色倒地，移动者不受影响。
- 侧移进入已经倒地角色所在格：被撞角色因 `knockout` 淘汰，移动者不受影响。

正式组件中各角色固定向哪侧 Swerve 应来自数据表，不在解析器中写死。

#### 绿色全体牌

- 同时作用于所有仍活跃角色。
- 所有角色从同一个前置状态快照计算结果，再一次性提交。
- 角色之间不发生碰撞。
- 绿色牌不能让角色冲过终点；到达终点前最后一格后停止。
- 若是 Recover 绿色牌，先同时恢复，再同时移动。
- 向后越过赛道后沿仍会出局。

「绿色牌不冲线」和「无碰撞」必须有独立测试，不能复用普通逐格移动后再回滚。

### 3.9 冲线、出局与名次

#### 冲线

- 普通移动穿过终点即获得当前最高未占用名次。
- 如果一张牌先纵向冲线、理论上随后还要 Swerve，则冲线已经成立，不再侧移。
- 已冲线角色后续抽到自己的牌不再产生效果。

#### 出局

出局来源至少包括：

- `knockout`：倒地后再次被击倒或遭碰撞。
- `side_out`：Swerve 离开左右边界。
- `back_out`：向后离开赛道。
- `folded_out`：赛道折叠时位于被折掉区域。

单个角色出局时获得当前最低未占用名次。

同一结算步骤若有多个角色同时出局，它们形成一个名次组，占据相同数量的最低空余名次。例如两个角色同时出局且最低空位为第 3、4 名，则记录范围 `3–4`；下注结算使用该范围中较差的名次，即第 4 名。不要依赖 Python 容器遍历顺序人为拆开并列。

如果实体规则对三人同时出局另有裁定，数据复核阶段应替换此通用规则。

#### 自动分配最后名次

一旦 4 个角色中至少 3 个已有结果，比赛立即结束。唯一未定角色得到唯一空余名次，不再继续翻牌。

### 3.10 牌堆耗尽与赛道折叠

当 18 张牌全部处理完，且比赛仍未结束：

1. 将赛道可折叠后沿推进到下一条实线。
2. 处于被折区域的所有活跃角色同时因 `folded_out` 出局。
3. 若比赛尚未结束，把当场全部 18 张牌重新洗混；包括之前烧掉和公开的牌。
4. 再烧 3 张，继续逐张公开。

已冲线或出局角色对应的牌仍在 18 张牌中，公开时只显示「No effect」。不能为了加快比赛把这些牌从重洗牌堆中移除。

### 3.11 Side Bet

每场只使用一张公开 Side Bet 卡。玩家可拿 `YES` 或 `NO` 票押注该命题是否成立。

实现分成两类：

- `latched`：事件一旦发生就锁定为 YES，例如至少一次出界淘汰。
- `race_end`：比赛结束后根据最终排名计算，例如某角色是否进入后两名。

候选的 12 个谓词如下；文案必须自行改写，具体时点需通过合法组件复核：

1. 指定角色最终位于后两名。
2. 指定角色最终位于后两名。
3. 指定角色最终位于后两名。
4. 指定角色最终位于后两名。
5. 曾有至少两个角色同时倒地。
6. 曾有至少两个角色同时停在终点前最后一格。
7. 至少有一个角色被淘汰。
8. 倒地角色曾在最终直道内爬行，或爬入/爬出最终直道。
9. 第一名产生的那一刻，最终直道内没有其他活跃角色。
10. 至少一次越界或赛道折叠淘汰。
11. 两个角色曾在同一结算时点停在完全相同的格子，且该相遇未以其中一方淘汰结束。
12. 至少一次 Knockout 淘汰。

每个谓词由独立纯函数或事件订阅器实现，并记录最短证据：

```python
{
    "predicate_id": "any_knockout",
    "result": True,
    "step_index": 9,
    "evidence": {"racer_id": "racer_2"},
}
```

证据在触发后公开，方便玩家理解为什么 Side Bet 已锁定为 YES。未触发的未来条件不得泄露隐藏牌。

### 3.12 场间准备

第一、二场结算后，必须停在结果页，直到所有玩家点击 `Next Race`：

- 已确认玩家显示 `Ready`。
- 未确认玩家显示 `Waiting`。
- Bot 自动确认。
- 所有人确认后才执行下一场设置。

下一场设置：

1. 所有下注票回到各自堆顶并恢复初始顺序。
2. 当前 Side Bet 放到牌堆底，公开下一张。
3. 洗混刚结束比赛使用的 18 张比赛牌。
4. 3–8 人每人发 1 张；2 人每人发 2 张，补回原手牌数量。
5. 其余牌成为新一场公开的基础牌堆。
6. 重置赛道、角色、牌序、烧牌、折叠进度和 Side Bet 追踪器。
7. 首位玩家顺时针移动一席。
8. 进入下一场选票。

下一场只在上一场的 18 张牌中循环，不从第一场未使用的比赛牌中补入新牌。

### 3.13 结算

每张票独立得到一个有符号金额，再应用第三场加倍：

```text
ticket_delta = payout_or_penalty × (2 if doubled else 1)
race_net = sum(all ticket_delta)
money_after = max(0, money_before + race_net)
```

数字版采用「先合计本场全部有符号收益，再对总现金做一次最低为 0 的限制」的明确裁定，避免因票的结算顺序不同产生结果差异。

结果页必须逐票显示：

- 票的对象。
- Safe / Risky。
- 命中与否。
- 基础收益或罚款。
- 是否 Double。
- 最终票面变动。
- 玩家赛前现金、本场净变化、赛后现金。

具体赔率全部从数据文件读取，不能散落在 Python 或 JavaScript 常量中。

## 4. 比赛牌候选清单与核对要求

公开的二手清单显示 44 张角色牌和 9 张绿色全体牌，总计 53 张。下表只作为转录检查表，不是无需复核即可上线的授权数据。

### 4.1 每个角色候选 11 张

| 数量 | 效果 |
| ---: | --- |
| 1 | 带边框起始牌：Recover 后前进 2 |
| 1 | Fall Down |
| 1 | Turn Around |
| 1 | 前进 3 |
| 1 | 前进 2 |
| 1 | 后退 2 |
| 1 | 移动到下一颗星 |
| 1 | 前进 1 后 Swerve |
| 1 | 前进 2 后 Swerve |
| 1 | 前进 3 后 Swerve |
| 1 | Recover 后前进 1 |

4 个角色各 11 张，共 44 张。每个角色的固定 Swerve 方向必须单独核对。

### 4.2 候选绿色牌 9 张

| 数量 | 效果 |
| ---: | --- |
| 1 | 全体 Recover 后前进 2 |
| 1 | 全体 Recover 后前进 3 |
| 2 | 全体前进 1 |
| 2 | 全体前进 2 |
| 2 | 全体前进 3 |
| 1 | 全体后退 2 |

数据校验器必须验证总数和拷贝数，而不是只验证模板种类。

## 5. 赔率数据策略

已能从公开资料高置信确认的示例包括顶部 Safe 角色票 `10 / 7 / 5`、顶部 Risky 角色票 `15 / 5 / 2`，但其余中、下层数值和 Side Bet 票并未全部可靠核实。

因此：

- 方案文档不把推测值写成正式表格。
- `hot_streak_data.json` 正式版本不得留 `TODO`、`null` 或推测标记。
- 正式数据应附 `catalog_version` 和 `verified_against` 字段。
- 启动时发现数据不完整应拒绝注册游戏，而不是用默认值静默补齐。
- 测试使用固定 fixture 校验每一层每一个名次的值。

## 6. 服务端状态机

### 6.1 阶段

```text
betting
  ↓ 所有人选完票
card_selection
  ↓ 所有人提交秘密比赛牌
race_countdown
  ↓ 倒计时完成/首个推进动作
racing
  ↓ 至少三个角色已定名次
race_result
  ↓ 所有人 Next Race
betting（下一场）
  ↓ 第三场结束
game_over
```

阶段名必须是服务端唯一事实来源。客户端不能通过本地按钮状态自行推断并提前发送下一阶段动作。

### 6.2 建议状态结构

```python
state = {
    "game_id": "hot_streak",
    "catalog_version": "second-printing-verified-v1",
    "phase": "betting",
    "race_number": 1,
    "players": {
        player_id: {
            "money": 10,
            "hand": [card_instance_id, ...],
            "bets": [bet_record, ...],
            "submitted_card_ids": [],
            "submitted": False,
            "ready": False,
            "is_bot": False,
        },
    },
    "turn_order": [player_id, ...],
    "starting_player_index": 0,
    "draft_sequence": [player_id, ...],
    "draft_cursor": 0,
    "ticket_stacks": {...},
    "side_bet_deck": [side_bet_id, ...],
    "current_side_bet_id": "...",
    "side_bet_tracker": {...},
    "base_race_card_ids": [...],
    "submitted_cards_by_player": {...},
    "race_card_ids": [...],
    "draw_pile": [...],
    "burned_card_ids": [...],
    "revealed_card_ids": [...],
    "race_cycle": 1,
    "fold_stage": 0,
    "step_index": 0,
    "racers": {...},
    "podium_groups": [],
    "race_log": [],
    "last_race_summary": None,
    "race_history": [],
    "winner_ids": [],
    "rng_seed": "server-only",
    "rng_counter": 0,
}
```

### 6.3 牌实例与模板

模板描述规则，实例保证同模板多张牌也能被守恒检查：

```python
CardTemplate(
    template_id="racer_1_move_2",
    target="racer_1",
    effects=[{"type": "move", "distance": 2}],
    is_starting_card=False,
    copies=1,
)

CardInstance(
    instance_id="c037",
    template_id="racer_1_move_2",
)
```

任何时点每张实例牌必须且只能位于一个区域：

- 当前基础牌堆。
- 某玩家手牌。
- 已提交区。
- 当场抽牌堆。
- 当场烧牌区。
- 当场公开区。
- 当前 18 张比赛牌的重洗牌堆。
- 首场未进入游戏的牌区。

### 6.4 确定性随机

- 初始化、洗牌、Side Bet 顺序和首位玩家都通过模块内部的确定性 RNG helper。
- 保存 `rng_seed` 和 `rng_counter`，不要序列化 Python `random.Random` 对象。
- `serialize → deserialize` 后继续游戏，之后的抽牌结果必须与未重连时一致。
- seed、counter 和未来牌序永远不进入公开视图或事件。

## 7. 动作协议

所有动作继续走现有通用 `game:action`，不新增 Hot Streak 专用 Socket.IO handler。

### 7.1 `draft_ticket`

```json
{
  "type": "draft_ticket",
  "stack_id": "racer_1",
  "mode": "risky",
  "double_bet_id": null
}
```

第三场需要在该次动作完成 Double 时：

```json
{
  "type": "draft_ticket",
  "stack_id": "yes",
  "mode": "safe",
  "double_bet_id": "bet-r3-p2-01"
}
```

校验：

- 当前阶段是 `betting`。
- 当前玩家等于 `draft_sequence[draft_cursor]`。
- `stack_id` 是六个合法堆之一且仍有票。
- `mode` 只能是 `safe` 或 `risky`。
- 非加倍时点不得携带 `double_bet_id`。
- 加倍时点必须携带属于自己本场且可选的 bet ID。

### 7.2 `submit_race_cards`

```json
{
  "type": "submit_race_cards",
  "card_ids": ["c041"]
}
```

校验：

- 当前阶段是 `card_selection`。
- 玩家尚未提交。
- ID 唯一且全部属于该玩家当前手牌。
- 3–8 人恰好 1 张，2 人恰好 2 张。

提交后不可撤回；这是秘密同时选择，撤回会让玩家通过他人提交节奏获得额外信息。

### 7.3 `advance_race`

```json
{
  "type": "advance_race",
  "expected_step_index": 7
}
```

比赛没有玩家决策，但服务端也不应把未来牌序一次发给客户端。每一步由任一连接中的玩家或 Bot 请求推进：

- `expected_step_index` 必须等于当前公开 step index。
- 第一个合法请求推进一步并广播新状态。
- 同一 index 的重复请求安全拒绝为 stale，不产生第二次翻牌。
- 浏览器通常在动画完成约 700–1000ms 后自动发下一步。
- 若动画或计时器失效，3 秒后显示 `Continue Race` 作为手动兜底。
- 如果需要防止恶意客户端瞬间跳完，可增加服务端 `next_step_not_before` 节流；该时间不影响规则确定性。

一步只能完成以下一种原子事务：

- 倒计时推进。
- 公开并完整结算一张牌。
- 牌堆耗尽后的折叠、淘汰、重洗和烧牌。
- 比赛终止与结算。

### 7.4 `next_round`

```json
{"type": "next_round"}
```

UI 文案使用 `Next Race`，协议沿用通用语义名 `next_round`。

- 只在 `race_result` 合法。
- 每名玩家每场只记一次 Ready。
- 所有人 Ready 后才创建下一场。
- 第三场结果页不出现该动作。

### 7.5 `play_again`

```json
{"type": "play_again"}
```

只在 `game_over` 合法。第一个合法动作完整重置新局；旧动作重放不得二次重置。

## 8. 服务端解析算法

### 8.1 单角色普通牌

```text
resolve_regular_card(card):
    racer = target racer
    if racer is not active:
        emit no_effect
        return

    for effect in card.effects:
        if racer no longer active:
            break
        resolve effect in declared order

    evaluate latched side bets
    if at least 3 racers resolved:
        finalize remaining racer and race
```

### 8.2 逐格移动

```text
move_racer(racer, signed_distance, allow_finish=True, collisions=True):
    if racer.fallen:
        distance = one step in the intended direction
    else:
        distance = signed_distance resolved against facing

    for each step:
        compute next longitudinal cell
        if crossing finish and allow_finish:
            assign highest open rank
            stop
        if leaving back edge:
            mark DQ(back_out)
            stop
        move into cell
        if collisions:
            resolve every stationary active racer in that cell
```

碰撞处理中，移动者不因为撞到别人而倒地。若一个格子中有多个静止角色，应基于碰撞前快照同时处理，避免先后顺序影响结果。

### 8.3 Swerve

```text
resolve_swerve(racer, relative_direction):
    if racer is not active:
        return
    destination_lane = relative_to_facing(...)
    if destination_lane outside 0..3:
        DQ(side_out)
        return
    move to destination cell
    resolve all stationary racers there from a snapshot
```

### 8.4 绿色全体牌

```text
resolve_all_racers(card):
    snapshot = all racer states
    results = []
    for each active racer in canonical racer order:
        compute result from snapshot
        cap forward movement before finish
        do not calculate racer-to-racer collisions
        append result
    apply results simultaneously
    group simultaneous DQs
    evaluate side bets once
```

计算顺序可固定为角色 ID，但结果不能依赖该顺序。

### 8.5 名次分配

服务端维护可用名次集合 `{1, 2, 3, 4}`：

- 冲线组从小到大占用最高可用名次。
- 出局组从大到小占用最低可用名次。
- 同时组保存 `rank_start`、`rank_end` 和 `payout_rank=rank_end`。
- 最后一名自动分配时占用唯一剩余名次。

### 8.6 结算只执行一次

`finalize_race()` 必须有幂等保护：

```python
if state["phase"] != "racing":
    return
state["phase"] = "race_result"
```

完成后生成不可变的 `last_race_summary`，所有结果页展示均读取该摘要，避免重连时重新计算或重复加钱。

## 9. 数据文件

新增：

```text
game/assets/hot_streak_data.json
```

建议结构：

```json
{
  "catalog_version": "second-printing-verified-v1",
  "verified_against": "physical second printing",
  "racers": [],
  "track": {
    "lane_count": 4,
    "start_position": 0,
    "finish_position": 0,
    "star_positions_by_lane": {},
    "fold_cutoffs": [],
    "final_stretch_start": 0
  },
  "card_templates": [],
  "ticket_stacks": {},
  "side_bets": []
}
```

这里的 `0` 只表示方案示例，不是生产默认值。正式文件必须使用复核后的坐标。

### 9.1 启动校验

注册游戏时运行校验器：

- 卡牌实例总数恰好 53。
- 恰好 4 张起始牌，且每角色 1 张。
- 每角色牌恰好 11 张，绿色全体牌恰好 9 张。
- 每个模板 ID 和实例 ID 唯一。
- 4 个角色均有颜色、图标、纹理和 Swerve 方向。
- 赛道是 4 条跑道；起点、终点、星位、折叠线和最终直道坐标均合法。
- 所有折叠线严格递增且不会越过终点。
- 4 个角色票堆、YES 和 NO 票堆各有 3 层。
- 每层包含完整 Safe/Risky 结算数据。
- Side Bet 恰好 12 张，predicate ID 唯一且均有实现。
- 所有金额为整数。
- 数据版本不是 `prototype` 时不得包含 `unverified` 字段。

验证失败应抛出清晰异常并阻止游戏注册。

## 10. 公共视图与隐私

### 10.1 所有人可见

- 当前阶段、场次和首位玩家。
- 当前选票玩家、选票进度和蛇形顺序。
- 每个票堆剩余数量及当前顶层的完整 Safe/Risky 赔率。
- 所有人现金、已拿到的票、风险模式和第三场 Double 标记。
- 当前 Side Bet 文案、是否已锁定、公开证据。
- 选票结束前公开基础比赛牌的组成。
- 每人是否已提交秘密牌以及提交数量。
- 当前赛道、角色姿态、朝向、位置、冲线/出局状态。
- 当前已公开牌、公开牌历史、折叠阶段和比赛日志。
- 名次、赛果摘要、逐票结算和 Ready 状态。
- 最终胜者或并列胜者。

下注票在实体游戏中本来公开，因此这里不隐藏。

### 10.2 仅当前查看者可见

- 自己手牌的实例 ID 和完整牌面。
- 提交后自己投入了哪些牌，以便重连恢复确认状态。

### 10.3 永远不可见

- 其他玩家的手牌和具体投入牌。
- 洗混后的未来抽牌顺序。
- 烧掉的牌面和实例 ID。
- 尚未公开的 Side Bet 顺序。
- 本局未进入基础牌堆的比赛牌。
- RNG seed、counter 和服务端节流时间。

`get_public_view(state, viewer_id)` 必须构造新对象，不能浅拷贝后删除字段，以免嵌套列表引用泄露。

### 10.4 公开事件

事件名称全部加前缀：

```text
hot_streak:ticket_drafted
hot_streak:cards_submitted
hot_streak:race_started
hot_streak:card_revealed
hot_streak:track_folded
hot_streak:racer_finished
hot_streak:racer_dq
hot_streak:side_bet_hit
hot_streak:race_scored
hot_streak:next_round_ready
hot_streak:game_over
```

`cards_submitted` 只能带 `player_id` 和 `count`，不得带卡牌 ID。事件 payload 和状态视图使用同一隐私审查 helper。

## 11. Bot 方案

### 11.1 首版最低要求

- 只从 `get_legal_actions` 返回的动作中选择。
- 能按蛇形顺序拿合法票。
- 能选择 Safe/Risky。
- 能按人数提交正确数量的手牌。
- 第三场在正确时点选择一个合法 Double 目标。
- 比赛阶段可提交带正确 index 的 `advance_race`。
- 结果页自动 `next_round`。
- 不得读取未来牌序、烧牌或其他玩家手牌。

### 11.2 建议策略

在不阻塞首版的前提下使用轻量 Monte Carlo：

1. 根据公开基础牌、自己手牌、未知玩家投入数量构造可能的 18 张牌分布。
2. 对候选下注票估计名次/Side Bet 概率和期望收益。
3. 比较 Safe 与 Risky 的期望值，同时根据当前现金降低破产风险。
4. 选择投入牌组合，使自己的角色票或 Side Bet 命中概率增加。
5. 第三场 Double 选择绝对期望变动最大的票，但对负期望票施加惩罚。

Monte Carlo 必须用独立的 Bot 推演 RNG，不能消耗真实游戏 RNG。

## 12. 前端方案（严格遵守 FRONTEND.md）

### 12.1 文件和命名

主逻辑必须放在：

```text
static/games/hot_streak.js
```

不得把游戏逻辑堆进 `static/app.js`。所有全局函数使用 `hotStreak` 前缀，推荐只暴露：

```javascript
window.renderHotStreakGameState
window.clearHotStreakState
window.showHotStreakHeaderActions
```

其余变量和 helper 放在 IIFE/模块闭包中。CSS class 统一使用 `hot-streak-` 前缀，DOM ID 统一使用 `hot-streak-` 前缀。

### 12.2 视觉资产原则

不能复用官方：

- Logo 和字体排版。
- 角色造型、插画、名字牌和卡面。
- 票面、钞票、赛道纹理、奖杯或规则书版式。

数字版使用原创简化身份，例如：

| 机械 ID | 显示标识 | 颜色 | 辅助纹理 |
| --- | --- | --- | --- |
| `racer_1` | `🐻 Blaze` | orange | diagonal stripe |
| `racer_2` | `🌭 Dash` | coral | dots |
| `racer_3` | `🐟 Ripple` | blue | waves |
| `racer_4` | `👑 Comet` | violet/gold | checks |

最终名称可再调整，但必须使用「图标 + 文字 + 颜色/纹理」，不能只靠颜色区分。

其他通用 Emoji：

- 现金：`💵`
- 星位：`⭐`
- 倒地：`💫`
- 碰撞：`💥`
- 反向：`↩️`
- 出局：`🚫`
- 名次：`🥇 🥈 🥉`

### 12.3 桌面布局

```text
┌──────────────────────────────────────────────────────────┐
│ Hot Streak · Race 2/3 · Betting · Alice's pick  Help ? │
│ Alice 💵24   Bob 💵17   Chen 💵8                         │
├───────────────────────────────────┬──────────────────────┤
│                                   │ Side Bet             │
│       responsive race track       │ ticket / hand panel  │
│                                   │                      │
│                                   ├──────────────────────┤
│                                   │ scrollable race log  │
├───────────────────────────────────┴──────────────────────┤
│ phase-specific actions                                  │
└──────────────────────────────────────────────────────────┘
```

- 顶栏紧凑显示 `Race 2/3 · Betting · Alice's pick`。
- 现金总览不可盖住赛道。
- 主区域使用 CSS Grid；赛道列 `min-width: 0`，侧栏有最大宽度。
- 比赛日志设置 `max-height` 和 `overflow-y: auto`，不能无限撑高页面。
- 没有明确的弹层时，控件绝不能互相覆盖。

### 12.4 赛道

赛道用 CSS Grid 或仓库内自制 SVG 生成，不用位图：

- 桌面：4 条水平跑道，纵向格子从左到右。
- 移动端：将同一坐标变换为 4 列、由下往上的纵向赛道，使角色仍足够大。
- 星位、折叠线、最终直道和终点均用几何图形和文字标记。
- 折掉区域使用斜线遮罩，并通过 `aria-label` 说明。
- 倒地角色图标旋转并加 `💫`；反向角色显示箭头；已出局移到结果槽并显示原因。
- 同格多个角色使用小范围扇形错位，这是有意的游戏内叠放；除此之外不允许重叠。
- 动画只表现服务端已经确认的前一状态到后一状态。
- `prefers-reduced-motion: reduce` 时取消位移动画，直接更新并保留文字日志。

页面根节点必须：

```css
.hot-streak-root {
  max-width: 100%;
  min-width: 0;
  overflow-x: clip;
}
```

任何子元素都不得用固定大宽度迫使 `body` 横向滚动。

### 12.5 选票界面

- 六个票堆以响应式网格显示。
- 每堆显示对象、剩余票数、当前顶层 Safe/Risky 赔率。
- 非当前玩家看得到，但不能点击。
- 点击可用票堆后打开紧凑 sheet/popover，`Safe` 与 `Risky` 两个按钮同排。
- 点击背景或按 Esc 取消。
- 不提供 `Clear Selection` 按钮。
- 第三场加倍时，在同一弹层中显示自己的可选票，必须选择一张后才可 `Confirm Bet`。
- 确认按钮清楚写明完整动作，例如 `Take YES · Safe`。

输入与 label 在空间允许时同排，不把简短标签强制拆成上下两行。

### 12.6 手牌和秘密提交

- 每张牌显示原创图标、目标、效果顺序和方向文字，不模仿实体卡面。
- 点击牌切换选择状态。
- 3–8 人提示 `Choose 1 race card`；2 人提示 `Choose 2 race cards`。
- 点击手牌区域的空白处清空当前选择。
- 不提供 `Clear Selection` 按钮。
- `Submit Card` / `Submit 2 Cards` 与牌区相邻，不放在远离上下文的位置。
- 提交后锁定，显示自己的牌背占位和 `Submitted`；其他玩家只显示提交数量。
- 重连后恢复自己的已提交选择，但不允许改动。

### 12.7 比赛播放

- 当前牌在赛道旁放大显示。
- 每步只播放服务端当前公开的一张牌。
- 简短 live region 朗读：`Blaze moves 2 and knocks Ripple down.`
- 完整历史进入可滚动日志。
- 正常情况下客户端自动请求下一步，不要求玩家每张牌点击。
- 3 秒没有推进时显示小型 `Continue Race` 兜底按钮。
- 该按钮不会改变策略，只触发 `advance_race`。
- 浏览器隐藏/恢复、多个客户端同时请求和重连都通过 `expected_step_index` 保持幂等。

### 12.8 结果页

每场结果页显示：

- 4 个角色的最终名次或并列范围。
- 出局原因。
- Side Bet 最终 YES/NO 与证据。
- 每名玩家逐票结算、净变化和新余额。
- `Ready X/Y`。
- 每名玩家 `Ready` / `Waiting` 状态。
- 第一、二场显示 `Next Race`。

第三场显示：

- `Winner` 或 `Joint Winners`。
- 最终现金排序。
- `Play Again`。

不要复制实体规则书的“人生等级”文字。

### 12.9 移动端

在 320px 宽度下检查：

- 绝对没有页面级横向滚动。
- 状态条压缩为两行以内。
- 赛道优先显示，侧栏移到下方。
- 六个票堆使用 2 列网格。
- `Safe` / `Risky` 两按钮尽量同排。
- 手牌使用会换行的 2 列或单列卡片，不使用迫使页面横滚的长条。
- 相关操作按钮尽量每行 2 个。
- 触控目标至少约 44px。
- 计分板和日志可折叠，但默认仍能看到当前玩家、阶段和关键结果。
- 弹层有内边距，不贴屏幕边缘。

### 12.10 英文 UI

遵守 `FRONTEND.md`，非游戏界面文本统一用英文。建议主要文案：

```text
Race 1 of 3
Betting
Choose a ticket
Safe
Risky
Double this bet
Choose 1 race card
Submit Card
Waiting for players…
Race in progress
Continue Race
Race Results
Next Race
Ready 3/5
Final Results
Joint Winners
Play Again
```

方案文档可以中文，实际按钮和状态文案不能中英混杂。

## 13. Help 与 Explain

必须按 `designs/task40.md` 实现。

### 13.1 Help

Help 弹窗至少覆盖：

- 3 场比赛和现金目标。
- 蛇形选票。
- Safe / Risky。
- 秘密投入比赛牌。
- 2 人规则差异。
- 正负移动、面向、星星。
- Fall Down、Recover、Turn Around。
- Swerve、碰撞和出局。
- 绿色全体牌的同时移动与不能冲线。
- 烧 3 张、牌堆耗尽、赛道折叠和重洗。
- Side Bet。
- 第三场 Double。
- 并列出局和数字版现金最低为 0 的裁定。
- 结算后所有玩家点击 Next Race。

Help 可从标题栏随时打开；点击背景、关闭按钮或 Esc 关闭。

### 13.2 Explain

Explain 模式至少覆盖：

- 六个票堆。
- Safe / Risky。
- 第三场 Double 选择。
- 手牌。
- `Submit Card(s)`。
- `Continue Race`。
- `Next Race`。
- `Play Again`。

严格行为：

- 只有带解释的控件显示虚线框和问号光标。
- Explain 开启时，所有普通按钮和牌面操作都被捕获，不能误执行游戏动作。
- Help、Explain 自身和关闭 Explain 的控件不被拦截。
- disabled 按钮仍可通过 `pointerdown` 与坐标命中显示解释。
- 显示一次解释后退出 Explain。
- Esc 退出 Explain。
- Explain 开启时不能切换手牌、选择票堆或提交动作。

## 14. 仓库落点

### 14.1 新增文件

```text
game/hot_streak.py
game/assets/hot_streak_data.json
static/games/hot_streak.js
tests/test_hot_streak_game.py
```

### 14.2 修改文件

```text
game/definitions.py
game/dev_order.json
scripts/bgg_weight_scrape.py
static/index.html
static/app.js
static/games/shared.js        # 仅在通用配置/Help 接口确有需要时
static/room.js
static/style.css
```

### 14.3 注册定义

在 `game/definitions.py`：

- 导入 `HotStreakGame`。
- 注册 ID `hot_streak`。
- 显示名 `Hot Streak`。
- `min_players=2`。
- `max_players=8`。
- 使用现有 turn 模式；选票时由 `get_legal_actions` 限制当前玩家，秘密提交和 Ready 阶段允许多人各自行动。
- 配置 schema 为空对象且 `additionalProperties: false`，首版不暴露 seed、JSON 或 9+ 切换。
- 定义五种动作 schema，并严格限制额外字段。

新增注册后运行：

```bash
python scripts/gen_dev_order.py
```

不要手改 `game/dev_order.json` 的排序结果。

### 14.4 房间列表和权重

- 在 `static/index.html` 添加游戏选项和说明。
- 在 `static/room.js` 添加 `GAME_WEIGHT`。
- BGG 当前可见复杂度约为 `1.23 / 5`，实施时必须由脚本实时抓取并按仓库规范保留两位小数。
- 在 `scripts/bgg_weight_scrape.py` 的 `GAME_URLS` 加：

```text
https://boardgamegeek.com/boardgame/446497/hot-streak
```

然后运行：

```bash
python scripts/bgg_weight_scrape.py
```

若抓取失败，不凭记忆改写数值；在 PR 中说明网络/页面限制。

### 14.5 不修改 `app.py` 的理由

本游戏可以完全通过已有：

- `game:action`
- `game:state`
- 房间/session 生命周期
- Bot 调度

完成。比赛自动播放采用幂等的 `advance_race` 动作，不需要在 `app.py` 添加后台计时器或 Hot Streak 专用 Socket 事件。

## 15. 模块接口

`game/hot_streak.py` 遵循仓库现有模块接口：

```python
class HotStreakGame:
    @staticmethod
    def init_game(players, config, seed=None): ...

    @staticmethod
    def get_legal_actions(state, player_id): ...

    @staticmethod
    def apply_action(state, player_id, action): ...

    @staticmethod
    def get_public_view(state, viewer_id): ...

    @staticmethod
    def bot_move(state, player_id): ...

    @staticmethod
    def serialize(state): ...

    @staticmethod
    def deserialize(payload): ...
```

建议再拆分纯 helper：

```text
build_draft_sequence
validate_catalog
deal_initial_cards
start_race
resolve_card
resolve_effect
move_racer
resolve_collision_group
assign_finish_group
assign_dq_group
evaluate_side_bets
fold_track_and_reshuffle
score_race
prepare_next_race
build_race_summary
```

这些 helper 不读取 Socket.IO、DOM 或全局房间对象，方便确定性测试。

## 16. 日志与可访问性

### 16.1 日志

日志采用结构化事件，前端自行渲染句子：

```json
{
  "type": "move",
  "step_index": 8,
  "racer_id": "racer_1",
  "from": {"lane": 0, "position": 5},
  "to": {"lane": 0, "position": 7},
  "distance": 2
}
```

只保留渲染所需字段，不能在日志里塞服务端完整状态。长日志放在滚动容器。

### 16.2 可访问性

- 所有颜色状态都有文字、图标或纹理冗余。
- 卡牌、票堆和角色有明确 `aria-label`。
- 当前回合和当前公开牌使用礼貌 live region，不重复朗读整个赛道。
- 动画遵守 `prefers-reduced-motion`。
- 键盘能聚焦票堆、手牌、Help、Explain、提交和 Ready 按钮。
- 弹窗打开时管理焦点，关闭后返回触发控件。
- Explain 不破坏正常 Tab 顺序。

## 17. 测试计划

### 17.1 初始化与守恒

- 2–8 人均可初始化，其他人数拒绝。
- 每种人数的基础牌数、手牌数和投入数正确。
- 2 人和 3–8 人最终比赛牌堆都恰好 18 张。
- 所有 53 个实例 ID 唯一，任意时点无丢牌、重牌。
- 四张起始牌一定进入首场基础牌堆。
- 首位玩家由 seed 确定，重放一致。

### 17.2 选票

- 3–8 人的蛇形序列正确。
- 2 人序列为 `1,2,2,1,1,2`。
- 非当前玩家、空票堆、非法 mode、额外字段被拒绝。
- 顶层票取走后正确露出下一层。
- 每场后票堆完整恢复。
- 第二、三场首位玩家正确轮换。
- 第三场在每人第二张票时强制选择 Double。
- Double 正收益和负收益均乘 2。

### 17.3 秘密手牌

- 3–8 人只能交 1 张，2 人只能交 2 张。
- 不能交不属于自己的牌、重复 ID 或二次提交。
- 所有人提交后只触发一次比赛开始。
- 其他玩家视图和所有公开事件均不含牌面。
- 自己重连后能看到已提交的牌。

### 17.4 移动

- 正数随面向移动。
- 负数逆面向移动。
- Turn Around 正确切换。
- Recover 同时清除倒地和反向，再移动。
- 倒地角色对数字和星星都只爬 1 格。
- 星星查找严格选择移动方向上的下一颗；没有星时不动。
- 每个角色的 Swerve 左/右相对于自身面向。
- 纵向沿途碰撞与 Swerve 落点碰撞正确。
- 撞到站立角色使其倒地；撞到倒地角色使其 Knockout。
- 多角色同格和一次碰撞多个角色不依赖遍历顺序。
- 先冲线再 Swerve 时保留冲线结果。
- 后退、侧移和折叠淘汰原因区分。

### 17.5 绿色全体牌

- 所有活跃角色基于同一快照同时计算。
- 不触发角色间碰撞。
- 不能冲过终点。
- 可以停在终点前最后一格。
- 向后越界仍出局。
- 全体 Recover 在移动前生效。
- 结果不随角色字典插入顺序改变。

### 17.6 名次与比赛结束

- 普通冲线从最高空位分配。
- 普通 DQ 从最低空位分配。
- 两个或更多同时 DQ 形成名次范围。
- 并列下注使用较差名次。
- 三个角色定名次后，第四个自动获得剩余名次。
- 终止后不得继续翻牌或重复结算。

### 17.7 折叠与重洗

- 18 张耗尽后进入下一折叠线。
- 折叠区域角色同时 DQ。
- 若仍未结束，全部 18 张回收重洗并重新烧 3 张。
- 烧牌和已公开牌都回到重洗集合。
- 已结束角色的牌不被删除，之后公开为 No effect。
- 折叠导致第三个结果时不再无意义地重洗。
- 烧牌从任何玩家公共视图中都不可见。

### 17.8 Side Bet

- 12 个 predicate 各有正例和反例。
- latched 条件触发后不会恢复为 NO。
- 最终排名类只在赛末计算。
- 第一名产生瞬间的最终直道条件使用该瞬间快照。
- 同格条件不把导致淘汰的碰撞误算为成功停留。
- 证据不包含隐藏卡牌信息。

### 17.9 结算与场间

- 每层票的 Safe/Risky、1/2/3 名数值与数据文件一致。
- 第 4 名角色票收益为 0 或按核实数据执行。
- Side Bet YES/NO 命中和失败正确。
- 先合计 signed delta，再把现金限制到 0。
- 票的处理顺序不会改变最终现金。
- 第二、三场只从前一场 18 张牌中发新手牌。
- 3–8 人每人补 1 张；2 人每人补 2 张。
- 角色、折叠、烧牌、日志和 Side Bet tracker 正确重置。
- 未全 Ready 不进入下一场；重复 Ready 幂等。

### 17.10 结束、序列化与 Bot

- 第三场后进入 `game_over`。
- 最高现金玩家获胜；同额并列。
- `play_again` 完整重置且只执行一次。
- 序列化/反序列化后牌守恒、隐私和 RNG 连续性不变。
- Bot 在每个阶段只产生合法动作。
- 全 Bot/混合房间不会卡在 betting、submission、racing 或 Ready。

### 17.11 `advance_race` 并发

- 同一个 `expected_step_index` 多次请求只推进一步。
- 旧 index 被安全拒绝。
- 未来 index 被拒绝。
- 两个玩家并发请求不会翻两张牌。
- 重连客户端从当前 step 恢复，不重放服务端动作。

### 17.12 前端人工检查

- 320px、375px、768px 和桌面宽度均无页面横向滚动。
- 选票、手牌、日志和赛道不重叠。
- 长昵称和 8 人现金栏能换行。
- 弹层背景点击和 Esc 可关闭。
- 空白处取消牌选择。
- 没有 `Clear Selection`。
- 日志可滚动，不无限撑高。
- Help 内容完整。
- Explain 只标记已解释控件，且不会误触游戏动作。
- disabled 控件可以解释。
- Reduced Motion 可用。
- 所有实际 UI 文案为英文。

## 18. 验证命令

```bash
python scripts/gen_dev_order.py
python scripts/bgg_weight_scrape.py
python -m unittest tests.test_hot_streak_game
python -m unittest tests.test_frontend_script_names
python -m unittest tests.test_game_dev_order
python -m unittest
```

`bgg_weight_scrape.py` 依赖网络；其失败不应掩盖其他测试结果，但 PR 必须记录原因。

还需在浏览器手动完成：

- 一局 2 人游戏。
- 一局 3 人游戏。
- 一局 8 人游戏或构造 8 人状态。
- 一次牌堆耗尽并折叠。
- 一次并列出局。
- 一次第三场 Double 的负收益。
- 刷新/重连后继续秘密提交和比赛播放。
- 两个浏览器同时自动推进比赛。

## 19. 实施顺序

1. 用合法第二印刷版组件完成数据转录和双人复核。
2. 建立 `hot_streak_data.json` 与严格校验器。
3. 实现牌实例、初始化、蛇形选票和秘密提交。
4. 实现纯函数移动引擎、碰撞、冲线、DQ、并列和 Side Bet。
5. 实现折叠、重洗、结算、Ready 门槛和三场生命周期。
6. 实现 public view、事件过滤、序列化和 Bot。
7. 注册游戏并生成 `dev_order.json`。
8. 实现 `static/games/hot_streak.js`，先保证完整可玩。
9. 实现响应式赛道、原创视觉、动画、Help 和 Explain。
10. 加入 BGG 权重抓取和房间列表说明。
11. 跑单元测试、全量测试和多尺寸人工检查。

数据复核是第 1 步的硬门槛；引擎可使用显式 prototype fixture 并行开发，但正式注册默认不能加载未核实数据。

## 20. 后续范围：9 人以上模式

官方产品页提到 9 人以上变体。公开规则显示它与标准模式差异较大，大致包括：

- 不使用个人现金手牌和标准下注票流程。
- 玩家同时写下角色和 YES/NO 预测。
- 第三场选择一项预测加倍。
- 初始比赛牌使用 4 张起始牌加 14 张随机牌。
- 后续场次从当场牌堆替换若干张牌。
- 使用按正确人数分摊的固定奖金池。

这不是把 `max_players` 改大即可支持的功能。若以后实现，应作为明确的 `party` 模式，拥有独立配置、动作 schema、UI、结算和测试；在那之前标准模式保持 `max_players=8`。

## 21. 完成标准

只有同时满足以下条件才算完成：

- 正式规则数据已由合法第二印刷版组件核对，且校验器通过。
- 2–8 人三场完整可玩，2 人变体正确。
- 蛇形选票、Safe/Risky、第三场 Double 和秘密投入均由服务端校验。
- 比赛逐张公开，未来牌序、烧牌和其他玩家手牌不泄露。
- 移动、倒地、恢复、反向、Swerve、碰撞、绿色牌、冲线、DQ、并列和折叠均有测试。
- 12 个 Side Bet 全部实现并有正反测试。
- 场间严格等待所有玩家点击 `Next Race`。
- 断线重连和并发推进不会重复翻牌或重复结算。
- Bot 能完成所有阶段且不读取隐藏真值。
- 视觉不使用商业版美术，颜色之外还有图标、文字和纹理。
- `static/games/hot_streak.js` 承担主逻辑，所有全局命名带前缀。
- Help/Explain 符合 `designs/task40.md`。
- 320px 起无页面横向滚动，长日志可滚动，弹层支持 Esc/背景关闭，空白处可取消选择，且不存在 Clear Selection。
- 所有 UI 文案为英文。
- `python -m unittest` 全部通过，`game/dev_order.json` 已由脚本刷新。
