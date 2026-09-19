# Task 87 — Poison（毒药）实现方案

## 1. 任务结论

在 OpenBoardGame 中新增 Reiner Knizia 的卡牌游戏 `Poison`（中文常见名《毒药》），内部游戏 ID 使用 `poison`。

首版范围采用 Playroom Entertainment 2005 年英文规则：

- 支持 3-6 人。
- 一局进行与玩家人数相同的轮数，让每名玩家各担任一次庄家。
- 使用完整 50 张牌：三色药水牌 42 张、毒药牌 8 张。
- 服务端权威处理发牌、出牌目标、爆锅、暗扣牌、每轮免疫计分、累计分与胜负。
- 支持 Bot、断线重连、序列化和房间存档。
- 每轮结算后停在结果页，所有玩家点击 `Next Round` 后才开始下一轮。
- 严格遵守 `FRONTEND.md`：Emoji 与颜色辅助阅读、非游戏内容 UI 使用英文、移动端紧凑且不横向溢出、空白处取消选择、弹窗支持 Esc，并完整实现 task40 的 Help / Explain 行为。
- 不复制商业版 Logo、卡面、药瓶插画、坩埚插画、字体或规则书版式；前端仅使用 Emoji、CSS、文字和自制几何图案。

本游戏的规则数据很小且已能从英文规则书完整确认，不需要额外商业牌面数据文件，也不存在先做 prototype 牌表的前置阻塞。

## 2. 游戏识别、规则版本与资料来源

### 2.1 识别信息

- 中文名：《毒药》
- 英文名：`Poison`
- 设计者：Reiner Knizia
- 首版年份：2005
- 玩家人数：3-6 人
- 单轮时长：约 10 分钟；完整对局通常约 30 分钟
- 类型：手牌管理、风险控制、多数收集、记忆信息
- BoardGameGeek ID：`17025`
- BGG 页面：<https://boardgamegeek.com/boardgame/17025/poison>
- Playroom Entertainment 英文规则书镜像：<https://reglur.spilavinir.is/Poison.pdf>
- 日文发行商规则简介：<https://www.mobius-games.co.jp/Amigo/poison.html>

`Poison` 另有 `Baker's Dozen`、`Friday the 13th` 等重制名称。本文实现的是 2005 年 `Poison` 的 50 张牌、三口锅版本，不混入其他重制版可能存在的视觉主题或规则改动。

截至 2026-09-16，BGG 页面显示的复杂度约为 `1.19 / 5`。真正落地时仍应把上述 BGG URL 加入 `scripts/bgg_weight_scrape.py` 并重新抓取，然后按仓库约定更新 `static/room.js`；不要只把本文记录值当成永久常量。

### 2.2 已核对的关键规则

以下容易误写的规则已按英文规则书确认：

- 锅中总值可以等于 13；只有 **大于 13** 才爆锅。
- 爆锅者拿走锅中此前已有的全部牌，刚打出的触发牌留在锅中。
- 只有毒药的锅仍是无色锅；之后第一张普通药水牌才为它确定颜色。
- 同一种普通药水颜色不能同时存在于两口锅。
- 每轮只结算玩家此前收走的暗扣牌；轮末仍留在锅里的牌不计分。
- 普通药水牌每张 1 分，毒药牌每张 2 分，牌面数字不等于罚分。
- 某颜色只有唯一收集最多者可以免除该色全部罚分；最多数量并列时，该颜色无人免疫。
- 毒药永远不能免疫。
- 完整游戏进行“每位玩家一轮”，累计罚分最低者获胜。

英文规则在“不能查看暗扣牌”的一句中使用了 `end of the game`，但紧接着又要求每轮结束查看这些牌、计分并重新开轮。数字版按可执行且与计分段一致的解释处理：**暗扣牌在本轮进行期间不可查看，在本轮结算时公开统计**。

### 2.3 数字版统一裁定

规则书没有完整规定少量数字实现细节，首版统一如下：

- 第一轮庄家从所有玩家中由服务端随机选择，并写入状态；之后庄家按座位顺时针移动一席。
- 座位升序定义为顺时针方向，“庄家左手边”就是座位顺序中的下一名玩家。
- 总罚分并列最低时共同获胜，不额外用年龄、最后一轮分数或随机数破平。
- 三人局的虚拟第四手固定放在发牌顺序最后，牌面在整轮内和轮末都不公开，只显示移除数量。
- 牌数不平均时，先打空手牌的玩家自动跳过，不需要提交 `Pass`。
- Bot 在轮末自动确认；真人仍必须各自点击 `Next Round`。
- 最终结果不会自动消失。重赛也采用全员确认，避免一名玩家单方面清掉其他人的结果页。

这些数字版裁定必须写入 Help 的 `Digital Notes`，不能作为隐藏实现细节。

## 3. 商业素材与自制视觉边界

### 3.1 不可直接复用

以下内容不得从规则书、BGG、商品页、实体扫描或 Tabletop Simulator 模组中提取后提交：

- `Poison` 商标字样及其特殊字体效果；
- 官方药瓶、毒药瓶、坩埚、背景纹理和牌背；
- 盒面、规则书示例图、图标和版式；
- 任一发行版本的宣传图、音效或动画。

### 3.2 可以结构化实现的规则数据

以下是玩法必需的公开规则数据，可直接用常量生成：

- 三种普通药水颜色；
- 数字 `1、2、4、5、7`；
- 每种颜色的数量分布；
- 8 张数值为 4 的毒药；
- 锅的数量、13 点安全上限、罚分和多数免疫规则。

### 3.3 自制视觉方向

- 红色药水：`🔴` + 竖条纹 + `R` 辅助符号。
- 蓝色药水：`🔵` + 点阵纹 + `B` 辅助符号。
- 紫色药水：`🟣` + 斜纹 + `P` 辅助符号。
- 绿色毒药：`☠️` + 交叉纹 + `POISON` 文本。
- 锅使用通用 `⚗️` / `🫕` Emoji 和自制 CSS 圆弧，不使用官方坩埚图。

颜色、Emoji、纹理和文字同时表达牌种，不能只靠颜色区分。

## 4. 组件与牌表

### 4.1 普通药水牌

每种颜色 14 张，共 42 张：

| 牌面值 | 每色数量 | 三色合计 |
| ---: | ---: | ---: |
| 1 | 3 | 9 |
| 2 | 3 | 9 |
| 4 | 2 | 6 |
| 5 | 3 | 9 |
| 7 | 3 | 9 |
| **合计** | **14** | **42** |

颜色内部 ID：

```text
red
blue
purple
```

### 4.2 毒药牌

- 数量：8 张。
- 牌面值：全部为 4。
- 内部颜色/类型：`poison`。
- 可以打进任意一口锅。
- 计分时每张 2 分，并且不能获得免疫。

### 4.3 牌实例

牌的规则数据很少，可在 `game/poison.py` 中由常量生成，不需要新增 JSON：

```text
CardInstance:
  id: string               # 每张物理牌唯一，例如 poison-red-1-01
  kind: potion | poison
  color: red | blue | purple | poison
  value: 1 | 2 | 4 | 5 | 7
```

即使牌面完全相同，也必须拥有不同 `id`，以便校验手牌所有权、保存/恢复和卡牌守恒。

### 4.4 卡牌守恒

任何游戏状态都必须满足：

```text
玩家手牌
+ 三口锅中的牌
+ 所有玩家收走的暗扣牌
+ 三人局移除的虚拟手牌
= 50 张唯一实例
```

轮次切换时，以上所有区域重新汇总、洗牌和发牌；累计分除外，不保留上一轮的手牌或锅状态。

## 5. 标准游戏规则

### 5.1 目标

尽量少收走牌。若不得不收某种普通药水，则争取成为该颜色唯一收集最多者，从而免除该颜色罚分。完整游戏结束时累计罚分最低者获胜。

### 5.2 第一轮设置

1. 校验人数为 3-6。
2. 生成并校验 50 张唯一牌实例。
3. 服务端随机选择第一轮庄家。
4. 洗混全部牌。
5. 从庄家左手边开始，按顺时针逐张发牌。
6. 三口锅均为空且无颜色。
7. 庄家左手边玩家首先行动。
8. 所有玩家轮分与累计分设为 0。

不同人数的牌量如下：

| 玩家数 | 发牌手数 | 真人初始手牌 | 移除牌 | 完整游戏轮数 |
| ---: | ---: | --- | ---: | ---: |
| 3 | 4 | 13 / 13 / 12 | 虚拟第四手 12 | 3 |
| 4 | 4 | 13 / 13 / 12 / 12 | 0 | 4 |
| 5 | 5 | 每人 10 | 0 | 5 |
| 6 | 6 | 9 / 9 / 8 / 8 / 8 / 8 | 0 | 6 |

表中的多牌位置以“庄家左手边”为第一位。由于每轮庄家顺时针移动，完整游戏中额外牌的位置会公平轮换：四人局每人恰好两轮拿 13 张；六人局每人恰好两轮拿 9 张；三人局每人恰好两轮拿 13 张、一次拿 12 张。

### 5.3 一个回合

行动玩家必须：

1. 从自己手中选择一张牌；
2. 选择一口合法的锅；
3. 把牌正面打入该锅；
4. 服务端重新计算锅的合计值；
5. 若合计不超过 13，牌留在锅里；
6. 若合计大于 13，行动玩家暗扣收走此前已有的牌，刚打出的牌独自留在锅里；
7. 轮到下一名仍有手牌的玩家。

没有自愿跳过、弃牌、换牌或查看暗扣牌的动作。

### 5.4 锅的颜色与合法目标

锅的颜色不是永久字段，而应由锅中现存的普通药水牌推导：

```text
锅里没有普通药水牌 -> unassigned
锅里有普通药水牌   -> 该普通药水的唯一颜色
```

服务器应断言同一口锅中至多存在一种普通药水颜色。

普通药水的合法锅：

- 若场上已有该颜色的锅，只能打入那一口锅。
- 若场上没有该颜色的锅，可以打入任意无色锅。
- 不能打入其他普通药水颜色的锅。

毒药的合法锅：

- 三口锅全部合法，与锅当前颜色无关。

### 5.5 只有毒药的锅仍无色

这是实现中最容易遗漏的状态变化：

- 空锅中先打入毒药，锅仍无色。
- 只有毒药的锅可以被任意尚未在别锅出现的普通颜色认领。
- 一个已有红色药水的锅被毒药触发爆锅后，红色旧牌被收走，触发的毒药独自留下；此时该锅立刻重新变为无色，红色也可以在另一口无色锅重新出现。
- 如果触发爆锅的是红色药水，则该红色牌留下，锅仍为红色。

因此不要在状态中维护一个可能与牌堆漂移的永久 `cauldron.color`；公共视图可以输出服务器即时推导出的 `derived_color`。

### 5.6 13 点与爆锅

```text
new_total <= 13  -> 不爆锅
new_total > 13   -> 爆锅
```

例：锅内为 `7 + 4`。

- 再打 `2`，总值为 13，全部留在锅中。
- 再打 `4`，总值为 15，行动玩家收走原来的 `7 + 4`，新打的 `4` 留下。

爆锅结算必须是单个原子动作。客户端不能先提交牌、再单独请求收牌，否则会产生断线和并发中间态。

建议纯函数：

```text
resolve_play(stack, played_card):
  previous = copy(stack)
  total = sum(previous values) + played_card.value
  if total <= 13:
    return stack = previous + [played_card], captured = []
  return stack = [played_card], captured = previous
```

### 5.7 暗扣牌

玩家爆锅后收走的牌：

- 在服务器完整状态中保存具体实例；
- 在本轮进行期间，对所有客户端都只显示张数；
- 即使是牌的拥有者，也不能通过自己的私有视图重新查看颜色、数值或毒药数量；
- 轮末结算时才公开按红、蓝、紫、毒药分类的数量；
- UI 不提供翻看、展开或 hover 预览暗扣牌的入口。

此前出现在锅里的信息当然可能被玩家记住，但数字版不能提供永久可检索的牌面历史来代替记忆。

### 5.8 手牌不平均与自动跳过

四人和六人局会有人少一张牌，三人局也有一名玩家少一张。玩家打空手牌后：

- 保持在玩家列表和计分中；
- 不再获得行动回合；
- `_advance_turn` 从座位顺序中寻找下一名 `hand` 非空的玩家；
- 所有真人手牌都为空时立即进入轮末结算。

不能要求空手牌玩家点击 `Pass`，也不能让当前回合停在空手牌玩家身上。

### 5.9 一轮结束与计分

当所有真人手牌均为空时，本轮结束。轮末仍留在三口锅中的牌不会被任何人取得，也不参与本轮罚分。

对每个普通颜色分别统计每名玩家暗扣牌数量：

```text
max_count = max(player_color_counts)
immune_player = 唯一达到 max_count 且 max_count > 0 的玩家
```

- 若唯一最多，该玩家此颜色的全部牌为 0 分。
- 若最多数量有两人或更多并列，此颜色无人免疫。
- 没有人收过某色时无需指定免疫者。
- 一名玩家可以同时对多个普通颜色免疫。
- 毒药不参与多数比较。

单轮罚分：

```text
round_score(player) =
  未免疫的红色张数
  + 未免疫的蓝色张数
  + 未免疫的紫色张数
  + 2 * 毒药张数
```

这里按张数计分，不使用卡牌上的 `1/2/4/5/7` 数值。

### 5.10 轮末暂停

进入 `round_summary` 后：

- 公开所有玩家本轮各类别张数、免疫颜色、本轮罚分和累计罚分；
- 显示三口锅最后留下的牌，但明确标为 `Not scored`；
- 显示 `Ready X / N`；
- 每名真人只可点击一次 `Next Round`；
- Bot 自动加入 ready 集合；
- 全体玩家准备完成前，服务器绝不洗牌、发牌或隐藏本轮结果。

这一步是 `FRONTEND.md` 的强制要求，不可用客户端定时器自动跳过。

### 5.11 新一轮

非最后一轮全员确认后：

1. 收回三口锅、所有暗扣牌和三人局虚拟手的牌；
2. 断言恰好回收 50 个唯一牌 ID；
3. 庄家顺时针移动一席；
4. 重新洗混 50 张牌；
5. 按本轮庄家左手边开始重新发牌；
6. 清空锅、暗扣牌、本轮分、摘要和 ready 集合；
7. 庄家左手边首先行动。

上一轮累计分保留，其他玩法状态全部重置。

### 5.12 游戏结束

完成与玩家人数相同的轮数后：

- `total_score` 最低的玩家获胜；
- 最低分并列则共同获胜；
- 最后一轮摘要与最终累计榜同时保留；
- 阶段进入 `game_over`，不再接受出牌或 `Next Round`；
- `Play Again` 使用全员确认，确认完成后重新随机第一轮庄家并开启全新对局。

## 6. 服务端状态机

### 6.1 阶段

```text
init_game
  -> playing
       -> playing                  # 正常出牌或爆锅后换人
       -> round_summary            # 所有人手牌为空，且不是最后一轮
            -> round_summary       # 等待更多玩家确认
            -> playing             # 全员确认，开始下一轮
       -> game_over                # 最后一轮计分完成
            -> game_over           # 等待重赛确认
            -> playing             # 全员确认，重置整局
```

不需要独立的 `choose_cauldron` 服务端阶段；选择牌与锅必须一次提交，避免玩家选牌后断线留下半完成状态。

### 6.2 建议状态结构

```python
{
    "version": 1,
    "phase": "playing",  # playing | round_summary | game_over
    "round_number": 1,
    "total_rounds": 4,
    "base_seed": "server-generated-secret",
    "dealer_id": "p1",
    "start_player_id": "p2",
    "current_turn": "p2",
    "turn_order": ["p1", "p2", "p3", "p4"],
    "player_meta": {...},
    "players": {
        "p1": {
            "hand": [CardInstance, ...],
            "captured": [CardInstance, ...],
            "round_score": None,
            "total_score": 0,
            "round_breakdown": None,
        }
    },
    "cauldrons": [
        {"cards": [CardInstance, ...]},
        {"cards": [CardInstance, ...]},
        {"cards": [CardInstance, ...]},
    ],
    "removed_hand": [],
    "round_summary": None,
    "next_round_ready": [],
    "rematch_ready": [],
    "last_action": None,
    "winner_ids": [],
    "game_over": False,
}
```

`base_seed`、对手手牌、暗扣牌和虚拟手只存在于服务器完整状态，不进入未授权公共视图。

### 6.3 确定性随机

- 未提供测试 seed 时，用服务端安全随机源产生 `base_seed` 并存入完整状态。
- 每轮使用 `base_seed + game_index + round_number` 派生独立洗牌随机流。
- 重赛增加 `game_index`，不能复用前一局牌序。
- 测试可通过 config 注入 seed；普通房间 UI 不显示 seed 输入框。
- 公共视图绝不发送 seed，否则客户端可以推导其他玩家手牌和虚拟手。

### 6.4 核心纯函数

建议把规则拆成可独立测试的纯函数：

```text
build_deck()
derive_cauldron_color(cards)
legal_cauldron_indices(state, card)
resolve_play(cards, played_card)
next_player_with_cards(state, after_player_id)
score_round(captured_by_player)
deal_round(state, seed, dealer_id)
assert_card_conservation(state)
```

`apply_action` 只负责编排这些函数和更新阶段，不把颜色判定、爆锅和计分重复写在多个分支中。

## 7. 动作协议

### 7.1 `play_card`

```json
{
  "type": "play_card",
  "card_id": "poison-red-7-02",
  "cauldron_index": 1
}
```

JSON Schema 要求：

- `card_id` 是有限长度字符串；
- `cauldron_index` 是 `0..2` 整数；
- 三个字段全部必填；
- `additionalProperties: false`。

服务端依次校验：

1. 当前阶段是 `playing`；
2. 提交者是 `current_turn`；
3. `card_id` 确实在提交者手牌中；
4. 锅索引有效；
5. 该牌对该锅合法；
6. 从手牌移除并原子完成放牌/爆锅；
7. 卡牌守恒仍成立；
8. 推进到下一玩家或轮末计分。

失败动作不能造成部分状态修改。

### 7.2 `next_round`

```json
{"type": "next_round"}
```

- 只在非最终轮的 `round_summary` 合法。
- 每名玩家重复提交只计一次。
- 只有 ready 集合覆盖全部玩家后才开始新一轮。
- Bot 的 `bot_move` 在此阶段返回该动作。

### 7.3 `play_again`

```json
{"type": "play_again"}
```

- 只在 `game_over` 合法。
- 作为重赛确认，而不是单人立即重置。
- 重复提交幂等。
- 全员确认后调用统一的整局重置函数；不能在旧 state 上零散改字段。

### 7.4 合法动作视图

`get_legal_actions` 返回动作名称，同时给当前查看者一个只基于公开信息和自己手牌生成的 `legal_plays`：

```json
{
  "card_id": "poison-blue-5-01",
  "cauldron_indices": [0],
  "outcomes": {
    "0": {"new_total": 15, "will_overflow": true, "captured_count": 3}
  }
}
```

预览中的总值、是否爆锅和收牌张数都能由桌面公开信息计算，不泄露隐藏信息。客户端可以据此高亮合法锅，但服务器仍必须重新验证。

## 8. 出牌与计分算法边界

### 8.1 合法锅算法

```text
if card.kind == poison:
  return [0, 1, 2]

assigned = 找到 derived_color == card.color 的锅
if assigned exists:
  return [assigned.index]

return 所有 derived_color == unassigned 的锅
```

正常合法状态下，普通药水总能找到至少一口锅，因为场上最多同时分配三种普通颜色，且对应颜色若已存在就可继续放入。

### 8.2 爆锅后颜色释放

爆锅完成后再从留下的触发牌推导颜色，不能沿用动作前的颜色：

```text
红锅 [red 7, poison 4] + poison 4
-> 玩家收 [red 7, poison 4]
-> 锅剩 [poison 4]
-> derived_color = unassigned
```

该用例必须有独立单元测试。

### 8.3 计分只执行一次

轮末逻辑必须由阶段保护：

- 最后一张牌提交后只调用一次 `score_round`；
- 重复 Socket 消息在阶段已经改变后被拒绝；
- 断线恢复只读取已保存的 `round_summary`，不重新累计；
- `next_round` 只清理本轮状态，不再次把 `round_score` 加进累计分。

### 8.4 多数免疫不能按点数判断

多数比较使用卡牌 **张数**：

```text
一张 red 7 == 一张 red 1 == 一张 red 4
```

牌面值只服务于锅的 13 点上限。建议状态和测试分别使用 `value_total` 与 `card_count` 命名，避免混淆。

## 9. 公共视图与隐藏信息

### 9.1 所有人可见

- 当前轮数 / 总轮数；
- 当前庄家、起始玩家和行动玩家；
- 三口锅中现存的全部正面牌、合计值和推导颜色；
- 每名玩家剩余手牌张数；
- 每名玩家本轮暗扣牌总张数，但不是内容；
- 已完成轮次的累计罚分；
- 安全的最近动作摘要；
- 轮末公开的分类数量、免疫颜色、本轮分和累计分；
- ready / rematch ready 状态；
- 最终赢家。

### 9.2 仅当前查看者可见

- 自己当前手牌的完整牌实例；
- 自己每张牌的合法锅和公开结果预览。

自己的暗扣牌内容也不属于私有可见数据，在轮末前只显示数量。

### 9.3 永远不能在进行中下发

- 其他玩家手牌内容；
- 任一玩家暗扣牌内容；
- 三人局虚拟第四手内容；
- 本轮或未来轮的 seed / RNG 状态；
- 能推导隐藏牌序的完整牌库顺序；
- 服务端用于 Bot 搜索的内部候选评分。

### 9.4 安全事件

建议事件：

```text
poison:play
poison:overflow
poison:round_scored
poison:ready
poison:round_started
poison:game_over
poison:rematch_ready
```

`poison:overflow` 只发送玩家、锅索引和收走张数，不附上被收走的牌数组。轮末再通过摘要公开分类统计。

### 9.5 日志策略

不要提供可以回放本轮全部牌面的永久明细日志，否则等价于允许玩家翻查暗扣牌。

如保留日志面板，只记录：

- 谁向哪口锅完成一次动作；
- 是否爆锅；
- 收走几张；
- 谁已准备下一轮。

不记录已离开锅的历史牌值与颜色。日志设置固定最大高度并允许纵向滚动，页面本身不得横向滚动。

## 10. Bot 方案

### 10.1 最低要求

- `playing` 阶段始终返回一个合法 `play_card`；
- `round_summary` 自动返回 `next_round`；
- `game_over` 可自动返回 `play_again`，但只有房间中已有真人发起重赛确认时才跟随，避免 Bot 主动不断开新局；
- 不读取人类客户端无权知道的对手手牌、虚拟手或暗扣牌内容来决定动作。

### 10.2 首版启发式

枚举自己所有 `card × legal cauldron` 候选，并按以下顺序评分：

1. 优先不爆锅。
2. 不爆锅时，优先把锅推到接近但不超过 13，以增加后续压力。
3. 若必须爆锅，优先收走张数更少的锅。
4. 同张数时，优先避开当前公开可见的毒药。
5. 毒药牌倾向加入总值较低且不会立即爆锅的锅。
6. 完全同分时使用本局派生 RNG 随机破平，保证测试可复现。

该策略不需要作弊式记牌，也足以避免纯随机 Bot 经常做明显坏招。后续若实现高级 Bot，可只基于公开行动维护独立记忆模型。

## 11. 前端方案（严格遵守 FRONTEND.md）

### 11.1 文件与全局命名

主要前端逻辑必须放在新增文件：

```text
static/games/poison.js
```

建议用 IIFE 保存选择状态，只向全局暴露路由需要的少量函数：

```text
renderPoisonGameState
showPoisonHeaderActions
clearPoisonState
```

如果还有顶层全局函数或变量，全部使用 `poison` / `Poison` 独有前缀，例如：

```text
poisonSelectedCardId
poisonExplainMode
isPoisonActionAvailable
```

禁止使用 `selectedCard`、`renderGame`、`showHelp` 等通用全局名。

`static/app.js` 只增加必要的面板显示、状态分发和 header action 路由；不能把选牌、绘制锅、Help 或 Explain 主逻辑放回全局文件。

### 11.2 桌面布局

建议结构：

```text
+----------------------------------------------------------------+
| Round 2 / 5 | Dealer: Mei | Turn: Alex        Help | Explain   |
+----------------------------------------------------------------+
| Player cards: name · hand count · captured count · total score |
+----------------------------------------------------------------+
|        [ 🔴⚗️ 12 / 13 ] [ ⚗️ 8 / 13 ] [ 🟣⚗️ 13 / 13 ]        |
|        [ visible stack ] [visible stack] [ visible stack ]      |
+----------------------------------------------------------------+
| Status: Choose a card, then choose a highlighted cauldron.      |
+----------------------------------------------------------------+
| Your Hand                                                     |
| [🔴 1] [🔵 2] [☠️ 4] [🟣 5] [🔴 7] ...                        |
+----------------------------------------------------------------+
| Round summary / compact safe log                               |
+----------------------------------------------------------------+
```

- 顶部状态栏只保留轮数、庄家和当前行动者三个高频信息。
- 玩家区使用响应式卡片，不制作六列固定宽表格。
- 三口锅是页面视觉中心，并始终在手牌上方。
- 手牌区靠近锅，但不能用 fixed 元素遮挡锅、结果或房间按钮。
- 结果阶段用正常文档流中的全宽 summary 区，不用覆盖棋盘的不可退出浮层。

### 11.3 锅组件

每口锅都是可聚焦的 `<button>` 或包含一个明确按钮：

- 显示锅序号、`derived_color`、当前总值和 `13` 上限。
- 堆叠展示当前仍在锅中的所有牌；牌多时可紧凑重叠，但每张的颜色/符号/数值仍可辨认。
- 选中手牌后，合法锅显示实线高亮；非法锅降低对比度但仍保留内容可读性。
- 预览显示 `12 → 16`、`Overflow · take 3` 等结果。
- 总值恰好 13 使用安全的强调色和 `At limit` 文本，不能误标成爆锅。
- 空锅或只有毒药的锅显示 `Unassigned`。

### 11.4 手牌交互

1. 点击一张手牌进入选择状态。
2. 合法锅高亮，并显示各自公开结果预览。
3. 点击合法锅立即提交原子 `play_card`。
4. 点击当前已选牌、手牌区外的空白或按 Esc，取消本地选择。
5. 点击另一张牌切换选择。

不增加 `Clear Selection` 按钮。提交后立即锁定本地动作，等待下一份权威状态，防止双击重复提交。

非当前玩家：

- 所有手牌动作禁用；
- 明确显示 `Waiting for <name>`；
- 仍可打开 Help / Explain；
- 不显示误导性的可点击锅高亮。

### 11.5 牌面

自制牌面包含：

- 大号数字；
- `🔴 / 🔵 / 🟣 / ☠️`；
- 英文短标签 `RED / BLUE / PURPLE / POISON`；
- 对应纹理；
- 高对比边框和清楚的选中态。

不要用官方瓶子图。数字是锅值，牌角另显示小型说明：普通牌 `1 penalty card`，毒药 `2 penalty points`，避免新玩家误以为牌面 7 会罚 7 分。

### 11.6 玩家状态

每名玩家卡片显示：

```text
Name · Dealer / Turn badge
Hand: 8
Captured: 5 face-down
Total: 7
```

- 本轮进行时不显示暗扣牌分类或估算分。
- 轮末显示 `Red 3 · Blue 1 · Purple 0 · Poison 2`。
- 获得免疫的颜色显示 `Immune` 徽标和删除线罚分。
- 当前玩家不能只靠发光颜色表示，要同时有 `YOUR TURN` 文本/图标。

### 11.7 轮末摘要

六人移动端不能使用需要横向滚动的宽表。每名玩家使用一张摘要卡：

```text
Alex
🔴 5 — Immune (0)
🔵 2 — 2 pts
🟣 0 — 0 pts
☠️ 2 — 4 pts
Round 6 · Total 19
```

摘要区下方显示：

- `Ready 3 / 5`；
- 当前查看者的 `Next Round` 按钮；
- 已点击后按钮文案改为 `Ready` 并禁用；
- 等待中的玩家姓名；
- 最后一轮则显示赢家与 `Play Again` 共识状态。

### 11.8 移动端

在 320、360、390、430 px 宽度重点验证：

- 页面宽度始终不超过 viewport，严格禁止页面级横向滚动。
- 三口锅优先保持三列紧凑布局；极窄屏可改为 `2 + 1` 网格，但不得把牌缩小到不可读。
- 手牌使用 3-4 列自动换行，不依赖水平滚动条。
- 玩家摘要使用 2 列或单列卡片。
- 高频状态和操作靠近，按钮至少约 44 px 可点击高度。
- `Help` 与 `Explain` 可在同一行紧凑排列。
- summary 与 Help 内容可纵向滚动；主游戏不应因空白和巨幅装饰产生过长页面。
- `min-width: 0`、`overflow-wrap: anywhere` 和响应式网格用于处理长玩家名。

### 11.9 英文 UI 文案

所有运行时通用 UI 使用英文，例如：

```text
Round 1 / 4
Dealer
Your Turn
Waiting for Alex
Choose a card
Choose a cauldron
Unassigned
At limit
Overflow — take 3 cards
Captured
Round Summary
Immune
Not scored
Ready 2 / 4
Next Round
Final Results
Play Again
Help
Explain
Close
```

内部错误不要直接显示 Python 文本；映射成简短英文提示，例如 `That cauldron is not legal for this potion.`。

### 11.10 可访问性

- 所有牌和锅使用真实按钮，可通过 Tab 聚焦和 Enter/Space 操作。
- 牌的 `aria-label` 包含类型、值和是否选中，例如 `Blue potion, value 5, selected`。
- 锅的 `aria-label` 包含颜色、总值、牌数和预览结果。
- 状态变化用克制的 `aria-live="polite"`，不要让整个棋盘每次重绘都被朗读。
- `aria-current` 或可见文本标识当前玩家。
- 颜色对比达到常规可读标准；免疫/非法/选中不能只依赖色相。
- 动画遵守 `prefers-reduced-motion`。
- 焦点样式不能被选中样式覆盖。

## 12. Help 与 Explain（遵守 task40.md）

### 12.1 Help

`Help` 打开 `Poison Help` 对话框，内容至少包括：

1. Goal；
2. Card Deck；
3. Setup and Dealer；
4. How to Play a Card；
5. Cauldron Colors；
6. `13 is safe; only more than 13 overflows`；
7. Overflow and face-down captured cards；
8. Round Scoring；
9. Majority ties and poison；
10. Number of Rounds and Winning；
11. Three-player removed hand；
12. Digital Notes；
13. Symbol / pattern legend。

Help 对话框：

- 支持右上角 `Close`；
- 支持 Esc；
- 点击背景关闭；
- 内容过长时只让 modal body 纵向滚动；
- 打开后移动焦点到标题或关闭按钮，关闭后把焦点还给 Help 按钮；
- 不复制规则书原文和图片，使用自写英文摘要与自制示例。

### 12.2 Explain 模式

严格按 `designs/task40.md`：

- 点击 `Explain` 后进入解释模式。
- 只有存在解释的按钮才显示虚线高亮与问号光标。
- 没有解释的按钮外观和光标不变，但点击不能触发原功能。
- 已 disabled 的按钮仍能通过 `pointerdown + 坐标命中` 查看解释。
- 事件使用 capture 阶段拦截，防止原点击处理器先执行。
- Help、Explain 自身和 modal 关闭按钮不被普通拦截逻辑锁死。
- 点击一个有解释的按钮，显示其说明并自动退出解释模式。
- Esc 退出解释模式。
- 游戏切换、离开房间和 `clearPoisonState` 必须清理 explain class、临时高亮和选牌状态。

建议解释目标：

```text
Hand card
Cauldron
Current total / 13
Captured pile
Dealer badge
Turn badge
Next Round
Play Again
```

动态生成的手牌和锅按钮使用 `data-poison-explain`，不要依赖易失的数组索引。

## 13. 仓库落点

### 13.1 新增文件

```text
game/poison.py
static/games/poison.js
tests/test_poison_game.py
designs/task87.md
```

不需要新增商业图片、字体、声音或 `game/assets` 数据文件。

### 13.2 修改文件

```text
game/__init__.py
game/definitions.py
game/dev_order.json
static/index.html
static/app.js
static/room.js
static/style.css
scripts/bgg_weight_scrape.py
```

具体内容：

- `game/__init__.py`：导入并导出 `PoisonGame`。
- `game/definitions.py`：新增 action/config schema 并注册游戏。
- `game/dev_order.json`：注册后运行生成脚本，不手工猜顺序。
- `static/index.html`：游戏选项、header actions、游戏面板、Help/Explain modal、脚本标签。
- `static/app.js`：仅增加 `poisonPanel` 的显示/隐藏、header actions 和状态渲染路由。
- `static/room.js`：增加 BGG weight，并在清理房间状态时调用 `clearPoisonState()`。
- `static/style.css`：所有样式限定在 `.poison-*` / `#poisonPanel` 范围。
- `scripts/bgg_weight_scrape.py`：增加 BGG URL。

### 13.3 注册定义

```python
register_game(
    GameDefinition(
        game_id=PoisonGame.game_id,
        name="Poison",
        min_players=3,
        max_players=6,
        turn_mode="turn",
        action_schema=POISON_ACTION_SCHEMA,
        config_schema=POISON_CONFIG_SCHEMA,
        module=PoisonGame,
        serialize=PoisonGame.serialize,
        deserialize=PoisonGame.deserialize,
    )
)
```

`POISON_CONFIG_SCHEMA` 首版只接受可选测试 seed，`additionalProperties` 为 false；大厅不需要为本游戏增加配置卡。

### 13.4 不修改 `app.py`

现有房间框架已经通过 `GameDefinition` 调用：

```text
init_game
get_public_view
get_legal_actions
apply_action
bot_move
serialize
deserialize
```

Poison 没有倒计时、同时提交、文件上传或额外 Socket.IO 事件，因此不应增加专用 `app.py` handler。所有游戏动作走现有通用 action 通道。

## 14. 模块接口

`game/poison.py` 提供：

```python
class PoisonGame:
    game_id = "poison"
    min_players = 3
    max_players = 6

    @staticmethod
    def init_game(config: Optional[Dict], players: List[Dict]) -> Dict: ...

    @staticmethod
    def get_legal_actions(state: Dict, player_id: str) -> List[str]: ...

    @staticmethod
    def apply_action(
        state: Dict,
        player_id: str,
        action: Dict,
    ) -> Tuple[List[Dict], Optional[str]]: ...

    @staticmethod
    def get_public_view(state: Dict, viewer_id: str) -> Dict: ...

    @staticmethod
    def bot_move(state: Dict, bot_id: str) -> Optional[Dict]: ...

    @staticmethod
    def serialize(state: Dict) -> Dict: ...

    @staticmethod
    def deserialize(payload: Dict) -> Dict: ...
```

公开 helper 保留类型注解。内部 helper 保持小而纯，错误返回风格与现有模块一致。

## 15. 测试计划

### 15.1 牌表与初始化

- 恰好生成 50 张牌且 ID 唯一。
- 每种普通颜色恰好 14 张。
- 每色 `1×3、2×3、4×2、5×3、7×3`。
- 毒药恰好 8 张且全部为值 4。
- 3-6 人都能初始化，2 人和 7 人被注册层拒绝。
- 第一轮庄家、起始玩家和当前玩家关系正确。
- 相同 seed 产生相同牌序，不同 seed 可产生不同牌序。

### 15.2 发牌与公平轮换

- 三人局生成四手，虚拟手固定 12 张，真人是 13/13/12。
- 四人局是 13/13/12/12。
- 五人局每人 10 张。
- 六人局是 9/9/8/8/8/8。
- 三人完整三轮后，每人两次 13、一次 12。
- 四人完整四轮后，每人两次 13、两次 12。
- 六人完整六轮后，每人两次 9、四次 8。
- 每轮和轮次切换后 50 张牌守恒。

### 15.3 合法锅

- 空场时普通颜色可选任意三口锅。
- 红色一旦出现在某锅，后续红色只能去该锅。
- 蓝色不能打入红锅。
- 毒药在任何状态下都可选三口锅。
- 只有毒药的锅保持无色。
- 普通颜色可以认领只有毒药的锅。
- 同色不会同时出现在两口锅。

### 15.4 13 点和爆锅

- 新总值 12 不爆锅。
- 新总值恰好 13 不爆锅。
- 新总值 14 或更高才爆锅。
- 爆锅只收走此前牌，触发牌保留。
- 捕获张数、锅总值、手牌移除和事件一致。
- 毒药触发爆锅后若独自留下，旧颜色被释放。
- 普通药水触发爆锅后仍维持该颜色。
- 重复/非法动作不会部分修改状态。

### 15.5 回合推进

- 非当前玩家出牌被拒绝。
- 不属于自己的 `card_id` 被拒绝。
- 非法锅被拒绝。
- 打空手牌的玩家被自动跳过。
- 不平均手牌下不会卡死在空手玩家。
- 最后一张手牌后恰好结算一次。

### 15.6 暗扣牌与隐私

- 服务器状态保存捕获牌实例。
- 捕获者自己的进行中视图也只看到张数。
- 对手只看到手牌数和暗扣牌数。
- 公共视图不含虚拟手牌内容。
- 公共视图不含 seed、未来牌序或其他玩家手牌。
- overflow 事件不含被收走的牌数组。
- 轮末摘要才公开分类数量。

### 15.7 计分

- 普通药水每张 1 分，与牌面值无关。
- 毒药每张 2 分。
- 每个普通颜色唯一最多者该色计 0。
- 两人并列最多时双方都不免疫。
- 三人并列最多时同样无人免疫。
- 一名玩家可同时免疫两个或三个颜色。
- 毒药数量最多也不能免疫。
- 未捕获任何某色时不产生虚假免疫者。
- 轮末锅中剩余牌不计分。
- 累计分只加一次。

### 15.8 轮末确认与终局

- 未全员 ready 前状态保持在 `round_summary`。
- 同一玩家重复 ready 幂等。
- Bot 自动 ready，不阻塞真人。
- 全员 ready 后庄家和起始玩家正确轮换。
- 新一轮清空锅、暗扣牌和 round score，保留 total score。
- 总轮数等于玩家人数。
- 最低总分者获胜。
- 最低分并列时共同获胜。
- 最终摘要保持可见。
- 重赛必须全员确认，并重新生成独立牌序。

### 15.9 序列化、断线与 Bot

- `serialize -> deserialize` 保留隐藏状态、轮次、ready 和分数。
- 在 `playing`、`round_summary`、`game_over` 断线重连均恢复正确视图。
- Bot 在大量随机合法状态中只返回可接受动作。
- Bot 不读取对手手牌或暗扣牌内容评分。
- 固定 seed 下 Bot 对局可以跑到终局且卡牌始终守恒。

### 15.10 Schema 与事件

- 缺少 `card_id` 或锅索引的动作被 schema 拒绝。
- 锅索引 `-1`、`3`、字符串等被拒绝。
- 多余字段被拒绝。
- 事件 payload 不泄露隐藏数据。
- 过期双击在第一条成功后被稳定拒绝。

### 15.11 前端人工检查

- 1440×900 桌面布局无覆盖。
- 768×1024 平板布局无横向滚动。
- 320×568、360×800、390×844、430×932 手机布局无横向滚动。
- 13 张手牌在手机上可读且可点，不需要缩放页面。
- 六名玩家的轮末摘要无需横向表格。
- 选牌后只高亮合法锅，恰好 13 与爆锅预览正确。
- 点击空白和 Esc 都可取消选牌。
- Help、Explain 和解释 modal 均可 Esc 退出。
- Explain 模式不触发任何真实游戏动作。
- disabled 按钮仍能显示解释。
- 游戏切换后无残留 explain 样式或选牌状态。
- 键盘可完成选择牌和选择锅。
- 颜色辨识模拟下仍能依靠 Emoji、纹理和文字分辨四类牌。
- `prefers-reduced-motion` 下没有强制位移动画。

## 16. 验证命令

实现完成后至少运行：

```bash
python -m unittest tests.test_poison_game
python -m unittest tests.test_room_session
python -m unittest tests.test_frontend_script_names
python scripts/gen_dev_order.py
python -m unittest tests.test_game_dev_order
python scripts/bgg_weight_scrape.py
python -m unittest
```

另做语法和差异检查：

```bash
node --check static/games/poison.js
git diff --check
```

执行 `scripts/gen_dev_order.py` 后要确认只产生预期的新游戏顺序变化；抓权重失败时不能伪造数值，应保留明确的待核对状态。

## 17. 建议实施顺序

1. 在 `game/poison.py` 实现牌表、推导颜色、合法锅、爆锅、计分和卡牌守恒纯函数。
2. 写 `tests/test_poison_game.py` 覆盖规则边界和隐私，再实现完整状态机。
3. 在 `game/__init__.py` 和 `game/definitions.py` 注册 action/config schema。
4. 运行后端单测和固定 seed Bot 全局模拟。
5. 在 `static/index.html` 添加游戏入口、面板和 Help/Explain 容器。
6. 在 `static/games/poison.js` 完成渲染、选择、预览、summary、Help 和 Explain。
7. 在 `static/style.css` 完成 scoped 桌面/移动端布局和无障碍状态。
8. 在 `static/app.js`、`static/room.js` 添加最少的全局路由与清理接线。
9. 增加 BGG URL、抓取 weight，并生成 `game/dev_order.json`。
10. 运行全量测试、JS 语法检查和多个 viewport 人工验收。

## 18. 完成标准

只有同时满足以下条件才算完成：

- 3-6 人标准完整局可从发牌玩到最终累计结算。
- 50 张牌的数量、分布和唯一实例完全正确。
- 等于 13 安全、大于 13 爆锅、触发牌留下等核心规则无误。
- 只有毒药的锅正确保持无色，爆锅后的颜色释放正确。
- 三人虚拟第四手和所有不平均手牌回合不会泄密或卡死。
- 多数免疫、并列无人免疫、毒药双倍罚分和累计胜负均有测试。
- 进行中没有客户端能看到对手手牌、暗扣牌内容、虚拟手或 seed。
- 每轮结算后全员确认才进入下一轮。
- Bot、断线重连、存档恢复和重赛共识可用。
- 主要前端逻辑位于 `static/games/poison.js`，所有全局名称带游戏前缀。
- Help / Explain 完整符合 `designs/task40.md`。
- 桌面、平板和手机均无组件覆盖、无页面级横向滚动，且不依赖颜色单独传达信息。
- 未提交任何商业版图片、字体、Logo、卡面或规则书截图。
- 单游戏测试、注册测试、前端命名测试和全量 `unittest` 全部通过。
