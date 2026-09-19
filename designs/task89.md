# Task 89 - Bohnanza: Das Würfelspiel（种豆：骰子游戏）实现方案

## 1. 任务结论

在 OpenBoardGame 中新增 2022 年 AMIGO 修订版 `Bohnanza: Das Würfelspiel`，内部游戏 ID 使用 `bohnanza_dice`。

首版范围：

- 支持 2-5 人，每局约 30 分钟。
- 使用 5 颗豆子骰、55 张收获卡、每张 5 层订单、10 豆币触发终局的 2022 规则。
- 服务端权威处理掷骰、留骰、整批重掷、订单匹配、回合外收获、牌堆回收、终局和并列获胜。
- 所有玩家的两张收获卡、完成进度和豆币都是公开信息；只隐藏抽牌堆顺序与未来骰子结果。
- 支持 Bot、断线重连、序列化、房间存档和确定性随机。
- 不引入早期 2012 版的 7 颗骰子、6 层订单和 13 豆币胜利条件。
- 不复制商业版 Logo、豆子人物、牌面、盒内豆田、字体或规则书版式；界面只使用 Emoji、CSS、文字和自制几何图案。
- 严格遵守 `FRONTEND.md`：主要前端逻辑独立放在 `static/games/bohnanza_dice.js`，全局名加 `bohnanzaDice` 前缀，移动端无水平页面滚动，弹窗支持 Esc，点击空白区取消选骰，并完整实现 `designs/task40.md` 的 Help / Explain 行为。

当前最重要的数据结论是：**公开规则书没有列出 55 张收获卡的完整机械数据**。因此首版不得把现有随机脚本产物当成官方牌组。在没有合法来源的完整校对牌表时，应发布明确标记为 `original-compatible-v1` 的 55 张自制兼容卡组，不宣称逐张复刻实体版。

## 2. 规则版本、资料来源与旧文档审计

### 2.1 游戏识别

- 德文名：`Bohnanza: Das Würfelspiel`
- 中文建议名：《种豆：骰子游戏》
- 设计者：Uwe Rosenberg
- 美术：Björn Pertoft（官方美术不复用）
- 发行：AMIGO
- 本文版本：2022 修订版，规则书 Version 2.0，商品号 `02253`
- 玩家人数：2-5
- 建议年龄：10+
- 时长：约 30 分钟
- BoardGameGeek ID：`368093`
- BGG：<https://boardgamegeek.com/boardgame/368093/bohnanza-das-wurfelspiel>
- AMIGO 官方英文规则：<https://blog.amigo-spiele.de/content/ap/rule/02253-GB-AmigoRule.pdf>
- AMIGO 官方德文规则：<https://blog.amigo-spiele.de/content/ap/rule/02253-DE-AmigoRule.pdf>

截至 2026-09-16，BGG 页面显示的 Weight 约为 `1.17 / 5`。真正落地时应把 BGG URL 加入 `scripts/bgg_weight_scrape.py`，运行脚本后再更新 `static/room.js` 的 `GAME_WEIGHT`，不把本文数值视为永久常量。

### 2.2 不得混入的 2012 旧版

`Bohnanza: Das Würfelspiel` 重新实现了 2012 年的 `Würfel Bohnanza`，但不是同一份组件表。

| 项目 | 2022 修订版（本任务） | 2012 旧版（禁止混入） |
| --- | ---: | ---: |
| 豆子骰 | 5 颗 | 7 颗 |
| 每张收获卡订单 | 5 层 | 6 层 |
| 触发分数 | 10 豆币 | 13 豆币 |
| 收获卡 | 55 张 | 64 张 |

任何出现“7 颗骰子”、“第 6 层订单”、“13 分结束”、“4 枚豆币收获”的程序或测试，都是版本污染。

### 2.3 仓库现有资料审计

仓库已有两份早期文档和一个未接入游戏的生成脚本。实现时按下表处理：

| 文件 | 结论 | 处理 |
| --- | --- | --- |
| `designs/task34.md` | 严重混入旧版：写了 7 种虚构/旧豆种、错误骰面、被动玩家可使用已留骰、主动玩家可提前停止等错误 | 视为已废弃资料，不用于代码或测试 |
| `designs/task56.md` | 规则主干与骰面数据基本正确，但没有完成仓库注册、联机收获冲突、Bot、响应式 UI、Help/Explain 和完整测试设计 | 作为规则核对参考；本文取代其作为落地规格 |
| `scripts/bohnanza_cards.py` | 生成 50 张而非 55 张，使用 7 种错误豆种和旧版/臆造任务，且每次运行随机改变牌表 | **禁止用于生产牌组**；实现时删除或改写为确定性验证/筛选工具 |

`task89.md` 是本游戏后续开发、评审和验收的唯一基准。

## 3. 商业素材边界与卡组数据门槛

### 3.1 不可直接复用

不得从规则书、商品页、BGG 图片、实体扫描或 Tabletop Simulator 模组中裁切或提取：

- `Bohnanza` 商标字形、官方牌框、牌背和盒面。
- Björn Pertoft 的豆子人物、表情、姿势和骰面插画。
- 豆田纹理、豆子人形标记、概览卡图片、规则书示例图和版式。
- 官方音效、宣传动画或字体。

前端必须自己表达相同机械信息，不追求“看起来和官方一样”。

### 3.2 可以结构化实现的规则信息

以下是玩法必需的规则数据：

- 6 种豆子的语义 ID。
- 两类骰子模板和各自的六面分布。
- 55 张收获卡的组件数量。
- 订单的 AND / OR / 可选豆种匹配关系。
- 3/4/5 层完成时对应 1/2/3 豆币。
- 10 豆币终局与并列获胜。

但“55 张官方卡的每一条订单排列”是一份未在公开规则书中结构化提供的完整内容集。不应靠批量抠图或不明来源模组来补齐。

### 3.3 首版卡组策略

新增 `game/assets/bohnanza_dice_cards.json`，文件顶层明确带元数据：

```json
{
  "schema_version": 1,
  "catalog_id": "original-compatible-v1",
  "catalog_status": "original-compatible",
  "official_component_count": 55,
  "cards": []
}
```

首版默认做法：

1. 使用与官方规则相同的 6 种豆子、骰面概率、5 层订单、自下向上推进和收获规则。
2. 编写 55 张固定、受版本控制的自制兼容卡，不在开局时随机生成卡面。
3. 用枚举全部 `6^5 = 7776` 个骰面索引结果计算每条订单的首掷成功率，把概率作为难度和数据验证信息，不参与游戏结算。
4. 手工复核每张卡的难度递进、豆种覆盖、组合多样性和可读性。
5. Help 的 `Digital Notes` 明确写“当前使用自制兼容收获卡组，并非商业版卡面复刻”。

未来若通过合法持有的实体或授权数据完成两人独立机械校对，可新增 `official-verified-v2`。更换目录时必须同时更新元数据、测试夹具和 Help，不能只换文件名或悄然宣称“官方”。

## 4. 组件与固定数据

### 4.1 实体组件与数字映射

| 实体组件 | 数量 | 数字版映射 |
| --- | ---: | --- |
| 收获卡 | 55 | JSON 卡目录与唯一 `card_id` |
| 玩家概览卡 | 5 | Help 中的骰面图例；牌堆不足时的 5 豆币标记 |
| 豆子骰 | 5 | 2 颗深色模板 + 3 颗浅色模板，每颗有稳定 ID |
| 豆子人形标记 | 1 | `active_player_id` 与当回合的 `repeat_used` |
| 盒盖豆田 | 1 | 中央已留骰区 `bean_field` |

### 4.2 六种豆子

| ID | 官方英文名 | 建议中文 | 自制视觉 | 无障碍文字 |
| --- | --- | --- | --- | --- |
| `garden` | Garden Bean | 花园豆 | 🌱 + 绿色椭圆 + 纵条 | `GA` |
| `red` | Red Bean | 红豆 | 🔥 + 红色椭圆 + 点纹 | `RE` |
| `soy` | Soy Bean | 大豆 | 🫘 + 紫色椭圆 + 斜纹 | `SO` |
| `green` | Green Bean | 绿豆 | 🥬 + 橙色椭圆 + 波纹 | `GR` |
| `stink` | Stink Bean | 臭豆 | 💨 + 棕色椭圆 + 交叉纹 | `ST` |
| `blue` | Blue Bean | 蓝豆 | 💧 + 蓝色椭圆 + 环纹 | `BL` |

注意：官方图标中 `Green Bean` 的底色偏橙，`Garden Bean` 的底色是绿色。程序永远以 ID 判断，UI 必须同时显示名称/缩写、符号、颜色和纹理，不能单靠“绿色”这个词。

### 4.3 骰子六面分布

2022 版有两种模板：

| 模板 | 实体数量 | 六个面 |
| --- | ---: | --- |
| `dark` | 2 | `blue`, `garden`, `stink`, `stink`, `soy`, `soy` |
| `light` | 3 | `stink`, `red`, `blue`, `blue`, `green`, `green` |

总共 30 个骰面的频数：

| 豆种 | 总面数 |
| --- | ---: |
| `blue` | 8 |
| `stink` | 7 |
| `green` | 6 |
| `soy` | 4 |
| `red` | 3 |
| `garden` | 2 |

骰子实例 ID 固定为：

```text
dark-1, dark-2
light-1, light-2, light-3
```

留骰动作提交 ID 而非当前数组下标，避免重排或断线恢复后选错骰子。

### 4.4 收获卡的双重用途

每张收获卡：

- 正面有 5 条订单，必须从最底部向上连续完成。
- 反面代表 1 枚豆币。
- 是玩家当前任务、下一张任务、抽牌堆或单枚豆币中的一种；同一物理卡 ID 不能同时出现在两个区域。
- 官方卡旁的小数字是“用开始时全部 5 颗骰子首掷完成此订单的概率百分比”，仅作难度参考。

## 5. 订单数据模型与匹配器

### 5.1 表达能力

官方规则书可确认的订单组合由三层构成：

1. 一条订单可有多个整体备选方案（OR）。
2. 一个备选方案包含多个需求槽（AND）。
3. 一个需求槽可接受一种或多种豆子（分割圆图标），但只能由一颗骰子填充。

数据结构：

```json
{
  "id": "compatible-001",
  "orders_bottom_to_top": [
    {
      "alternatives": [
        {
          "slots": [
            {"allowed": ["stink"]},
            {"allowed": ["soy"]},
            {"allowed": ["red"]}
          ]
        }
      ],
      "first_roll_probability": 0.14
    }
  ]
}
```

### 5.2 官方规则书的四个匹配样例

```text
1. stink + soy + red
2. green + green  OR  soy + soy
3. (soy OR green) + red + garden
4. (soy OR green) + (garden OR red) + (garden OR red)
```

第 4 个例子中，后两个槽需要两颗不同的骰子；一颗 `red` 不能同时填两个槽。

### 5.3 匹配算法

`matches_order(dice_faces, order)` 对每个 alternative 做一次小型 DFS / 二分匹配：

1. 先按可接受豆种数从少到多排序 slot，减少回溯。
2. 为当前 slot 选一颗尚未在本 alternative 中使用、且 face 在 `allowed` 内的骰子。
3. 所有 slot 都分配成功即该 alternative 成功。
4. 任意 alternative 成功即整条订单成功。

订单之间不“消耗”骰子。`advance_orders(card, completed_count, dice_faces)` 应每次对同一组骰子重新匹配新的最底部未完成订单，直到第一条失败或 5 条全部完成。

### 5.4 卡目录启动验证

服务启动时加载并验证：

- `cards` 恰好 55 张，`id` 全部唯一。
- 每张恰好 5 条订单，顺序明确为自下向上。
- 每条至少 1 个 alternative，每个 alternative 有 1-5 个 slot。
- `allowed` 只能包含 6 个合法 bean ID，不得为空，内部不得重复。
- 每条订单在这 5 颗实际骰子上至少有一个可能结果。
- 重新枚举 7776 个等概率面索引组合，校验 `first_roll_probability`。
- 自制牌组每张的首掷成功率总体应自下向上不增；如有为了组合体验而故意例外，必须在数据中加 `difficulty_exception_reason`。
- 不存在两张完全同签名的卡，除非目录元数据明确允许并记录张数。
- 禁止 `scripts/bohnanza_cards.py` 生成的 `Fire/Puff/Turkey/Runner` 等错误 ID。

## 6. 官方核心规则

### 6.1 游戏目标

通过完成收获卡上的订单并适时收获来赚取豆币。任一玩家收获后达到至少 10 豆币会触发最后阶段；收尾后豆币最多者获胜，并列时共同获胜。

### 6.2 设置

1. 校验玩家数为 2-5。
2. 加载并验证 55 张收获卡。
3. 使用服务端随机源洗牌。
4. 每人公开抽 2 张：一张是当前收获卡 `top_card`，另一张是覆盖/下一张卡 `cover_card`。
5. 所有玩家的 `completed_count` 设为 0，豆币设为 0。
6. 实体版由“最后吃过豆子的人”先手；数字版使用种子可复现的随机先手，并写入日志。
7. 先手拿到豆子标记和 5 颗骰子。

### 6.3 主动玩家的掷骰循环

1. 回合开始时掷出全部 5 颗骰子。
2. 每次新结果出现后，先让所有非主动玩家用“这一次刚掷出的骰子”自动检查订单。
3. 完成本次的收获决策检查点后，主动玩家必须把当前结果中至少 1 颗放入豆田。
4. 已放入豆田的骰子在本回合不得取回或重掷。
5. 若仍有未留骰，游戏进入等待掷骰状态；只有主动玩家再次提交 `roll`，才把杯中的骰子全部掷出并重复上述流程。
6. 主动玩家不能主动提前停止；必须直到 5 颗骰子全部进入豆田。

每次至少留 1 颗，因此一回合最多 5 次普通掷骰。

数字版不把“留骰”和“下一次掷骰”合成一个动作。`save_dice`、`harvest`、`keep_growing` 都不会隐式产生随机结果；普通掷骰始终来自主动玩家明确提交的 `roll`。Bot 作为主动玩家时仍会自行提交这个动作。

### 6.4 非主动玩家利用骰子

在主动玩家留下本次的任何骰子之前，其他每名玩家独立执行：

1. 只取 `current_roll` 的面，不加入 `bean_field` 中以前留下的骰子。
2. 从自己当前卡最底部的未完成订单开始。
3. 若能完成，将 `completed_count` 增加 1，再用同一组骰子检查下一条。
4. 在第一条失败的订单处停止。

此处没有有利可选分支，由服务端自动同时结算，不让每名玩家手动点“完成订单”。

### 6.5 每回合一次的整批重掷

主动玩家每回合最多一次使用豆子标记重复当前这次掷骰：

- 必须等其他玩家先用当前结果检查完订单。
- 必须重掷 `current_roll` 中的全部骰子，不得只选其中几颗。
- 已在豆田中的骰子保持不动。
- 新结果出现后，其他玩家又获得一次订单检查。
- 重掷之后仍必须从新结果留下至少 1 颗。

所以一回合的“掷骰结果事件”上限是 6：5 次普通结果 + 1 次特殊重掷结果。

### 6.6 主动玩家的回合末检查

只有 5 颗骰子全部在豆田后，主动玩家才用豆田内的全部 5 个面调用 `advance_orders`。

主动玩家不能在掷骰中途用已留骰和未留骰的合集提前推进自己的卡。

### 6.7 收获与分数

只要当前卡已完成至少 3 条订单，玩家就可收获：

| `completed_count` | 收获豆币 |
| ---: | ---: |
| 3 | 1 |
| 4 | 2 |
| 5 | 3 |

收获流程：

1. 把原 `top_card` 放入玩家的单枚豆币卡堆，它计第 1 枚豆币。
2. 若本次应得 2 或 3 枚，从抽牌堆再抽 1 或 2 张作为单枚豆币。
3. 原 `cover_card` 变成新 `top_card`，进度重置为 0。
4. 从抽牌堆公开抽 1 张新 `cover_card`。
5. 使用当前合法骰子上下文，立即检查新 `top_card`是否又能从底部推进。

完成 3 或 4 条时收获是策略选择，不能自动强制。完成 5 条后继续保留没有额外收益，但规则仍用“可以收获”表述；数字版保留玩家确认，不在普通阶段悄然自动收获。

### 6.8 收获卡不足与 5 豆币标记

实体规则允许在收获卡稀少时，把玩家概览卡翻到 5 豆币面，交换已赚得的 5 张单枚豆币卡。

数字版统一实现：

1. 每名玩家最多有一个 `five_coin_marker`。
2. 只在一次收获即将抽牌但剩余牌不足时启动回收，不提前改变牌堆。
3. 先查收获者，再按座位顺序查找至少有 5 张单枚豆币卡且尚无 5 豆币标记的玩家。
4. 移出其 5 张单枚豆币卡，给予 1 个 5 豆币标记，总分不变。
5. 把这 5 张卡用服务端 RNG 洗回剩余抽牌堆，记录公开日志。
6. 重复直到本次需要的牌数可抽；若仍不足，视为状态不变式破坏而非普通玩家错误。

这项裁定必须写入 Help 的 `Digital Notes`。

### 6.9 最后阶段

当任一玩家在一次收获后达到至少 10 豆币：

1. 立即标记 `final_phase = true`。
2. 若当前 5 颗骰子还未全在豆田，主动玩家停止后续掷骰，把刚掷出但未留的全部骰子放入豆田。
3. 主动玩家用完整豆田做最后一次当前卡检查；若本回合末已经检查过，不重复加进度。
4. 所有当前卡已完成至少 3 条的玩家进入最终收获队列。
5. 玩家可收获并在合法骰子上下文中连锁推进，也可选择不收获。
6. 最终队列清空后，豆币最多者获胜；并列最多者共同获胜。

不能在第一人到 10 分时直接宣布其单独获胜。

## 7. 联机数字版的统一裁定

### 7.1 为什么需要收获决策检查点

实体规则说玩家在完成至少 3 条后“任何时候”都可收获。如果网络版让非主动玩家与主动玩家抢发 Socket.IO 消息，结果会受延迟影响：主动玩家可能先留骰/重掷，使别人失去用当前结果推进新卡的机会。

因此服务端在以下时点建立显式决策队列：

- 每次新骰子结果产生、非主动玩家自动推进后。
- 5 颗骰子全部留下、主动玩家自动推进后。
- 最后阶段的主动玩家检查后。

只有队首玩家可提交 `harvest` 或 `keep_growing`，主动掷骰流程在队列清空前暂停。这使所有客户端得到相同结果，不把网速当成机制。

### 7.2 队列顺序

- 每次掷骰后：从主动玩家左手边开始按座位顺序，主动玩家最后。
- 主动玩家回合末：主动玩家先，然后向左按座位顺序。
- 最后收获：主动玩家先，然后向左按座位顺序。

当队首收获后新卡又达到至少 3 条时，该玩家保持在队首，直到其不再合格或选择 `keep_growing`，再轮到下一人。

### 7.3 `keep_growing` 的含义

在普通游戏中，`keep_growing` 仅表示“本检查点不收获”：

- 不改变卡或分数。
- 不再使用本次骰子结果换新卡。
- 不掷骰、不增加 RNG 计数器，也不改变当前骰面。
- 下一次产生新骰子结果或到回合末检查点时，若仍合格会再次询问。

在 `final_harvest` 中，`keep_growing` 等同于放弃本局最终收获，该玩家不再重新入队。UI 在最后阶段将按钮文案显示为 `Finish Without Harvesting`，但协议仍可使用 `keep_growing`。

### 7.4 收获后新卡使用的骰子上下文

| 收获发生时机 | 收获者 | 新当前卡立即检查的骰子 |
| --- | --- | --- |
| 每次掷骰后 | 非主动玩家 | 本次 `current_roll` |
| 每次掷骰后 | 主动玩家 | 无；其新卡等本回合结束再用完整豆田检查 |
| 主动回合末 | 主动玩家 | 完整 `bean_field` |
| 主动回合末 | 其他玩家 | 无；其已经在刚才的掷骰窗口获得过决策 |
| 掷骰后触发最后阶段 | 主动玩家 | 最终完整 `bean_field` |
| 掷骰后触发最后阶段 | 非主动玩家 | 保留的触发那次 `current_roll` |
| 回合末触发最后阶段 | 主动玩家 | 完整 `bean_field` |
| 回合末触发最后阶段 | 非主动玩家 | 无 |

这是对规则中“收获后立即看新卡是否也能完成”的可编程化解释，必须在 Help 中公开。

### 7.5 主动玩家中途触发 10 分

官方文字明确说“若达到 10 分的人不是主动玩家，主动玩家立即停止”，但没有详细写一名带着 3+ 层进度进入自己回合的玩家中途收获到 10 分的边界情形。

数字版统一裁定：不论触发者是否为主动玩家，只要在掷骰中途到 10 分，都立即将本次 `current_roll` 全部放入豆田，不再进行新的随机掷骰，然后执行主动玩家的最后检查。

### 7.6 “轮”与 `Next Round`

本游戏是一场连续轮流的完整对局，不存在像多局计分牌游戏那样的“每轮清场、结算、开新轮”。每名玩家的一次行动是 `Turn`，不是 `Round`，因此不在每个 Turn 后强行加 `Next Round`，否则会改变官方节奏。

为遵守 `FRONTEND.md` 中“结算后给所有人查看”的要求：

- `game_over` 页永久保留最终卡面、骰子、收获日志、分数和并列胜者，不自动清空。
- 如要重赛，所有真人玩家都必须点击 `Play Again`，Bot 自动确认。
- 重赛不沿用上局先手、牌序、骰子或分数。

## 8. 服务端状态机

### 8.1 阶段

```text
await_roll
  → after_roll           # 主动玩家显式 roll；可能先进入 harvest_decision
  → harvest_decision     # 如有合格收获者
  → after_roll           # 队列清空
  → await_roll           # save_dice 后仍有杯中骰，等待主动玩家显式 roll
  → after_roll           # repeat_roll 自身产生新结果
  → harvest_decision     # 新结果可能再次产生队列
  → after_roll
  → turn_end_harvest     # save_dice 使 5 颗全部留下，主动玩家自动推进
  → await_roll           # 下一名玩家

任一 harvest 达到 10+
  → final_harvest
  → game_over

game_over
  → game_over            # play_again 只更新 rematch_ready
  → await_roll           # 全员同意后重建对局
```

`harvest_decision` 专指掷骰后的收获窗口，`turn_end_harvest` 专指主动玩家用完整豆田检查后的窗口。两者共用同一套队列处理函数，`decision_origin` 用于存档恢复和选择正确的骰子上下文，而不是再造一套规则。

### 8.2 建议状态结构

```text
GameState:
  schema_version: 1
  game_id: "bohnanza_dice"
  config:
    seed: string | int | null
    catalog_id: "original-compatible-v1"
  rng_seed: string
  rng_counter: int

  phase: await_roll | after_roll | harvest_decision |
         turn_end_harvest | final_harvest | game_over
  game_over: bool            # 必须与 phase == game_over 一致，供 app.py 通用生命周期读取
  turn_number: int
  turn_order: player_id[]
  active_player_id: player_id

  players:
    player_id:
      top_card_id: string
      cover_card_id: string
      completed_count: 0..5
      single_coin_card_ids: string[]
      five_coin_marker: bool

  draw_deck: card_id[]

  dice:
    - id: "dark-1"
      template: dark | light
      face: bean_id | null
      zone: cup | current_roll | bean_field

  roll_sequence: int          # 全局单调事件序号
  roll_count_this_turn: 0..6
  current_roll_id: string | null
  current_roll_die_ids: string[]
  repeat_used: bool

  decision_origin: after_roll | turn_end | final | null
  harvest_queue: player_id[]
  harvest_contexts:
    player_id: bean_id[] | null
  final_trigger:
    player_id: player_id
    score: int
    origin: after_roll | turn_end
    retained_roll_faces: bean_id[] | null
  active_final_check_done: bool

  winner_ids: player_id[]
  rematch_ready: player_id[]
```

`score` 不必要作为可漂移的第二真相保存；可每次用：

```text
len(single_coin_card_ids) + (5 if five_coin_marker else 0)
```

计算。若为了性能缓存 `score`，则每次动作后必须断言两者相等。

### 8.3 掷骰结果解析

`resolve_roll(state)` 一次原子执行：

1. 为所有 `cup` 中的骰子按各自模板生成面。
2. 将它们设为 `current_roll`，增加 `roll_sequence` 和 `roll_count_this_turn`。
3. 对每名非主动玩家用该结果调用 `advance_orders`。
4. 记录公开掷骰和订单推进事件。
5. 构建本检查点收获队列与每人的上下文。
6. 有队列则进入 `harvest_decision`，无队列则进入 `after_roll`。

### 8.4 `save_dice` 的原子流程

1. 确认操作者是主动玩家、阶段是 `after_roll`、收获队列为空。
2. 确认 `die_ids` 非空、唯一、全部属于当前 `current_roll`。
3. 把所选骰子改为 `bean_field`。
4. 若仍有 `current_roll` 骰子，将它们改为 `cup`、清除旧骰面并进入 `await_roll`；此动作到此结束，不调用 RNG。
5. 若 5 颗骰子全在 `bean_field`，用全部面自动推进主动玩家，构建回合末收获队列。
6. 回合末队列清空且未触发终局时，才把 5 颗骰子返回 `cup`，传递主动玩家，重置 `repeat_used`。

### 8.5 确定性随机

不把 Python `random` 的隐式全局状态当成存档一部分。建议每次洗牌或掷骰使用：

```text
Random(f"{rng_seed}:{rng_counter}:{purpose}")
```

随机操作完成后把 `rng_counter += 1`。相同存档恢复后不会因进程或 Python 版本中其他代码调用了全局 RNG 而偏移。

客户端不下发 `rng_seed`、`rng_counter`、抽牌堆顺序或未来骰面。

### 8.6 卡牌守恒

任何时刻必须满足：

```text
draw_deck
+ 所有玩家的 top_card
+ 所有玩家的 cover_card
+ 所有玩家的 single_coin_card_ids
= 55 张唯一卡 ID
```

`five_coin_marker` 是分数代币，它代表已回收的 5 张卡，不是第 56 张收获卡。

## 9. 动作协议与校验

### 9.1 `roll`

```json
{"type": "roll"}
```

合法条件：

- 操作者是 `active_player_id`。
- `phase == "await_roll"`。
- `cup` 中至少有 1 颗骰子，且没有骰子仍在 `current_roll`；其余骰子可以已经在 `bean_field`。
- 游戏尚未结束。

回合首掷和后续普通掷骰都必须由主动玩家显式提交 `roll`。服务端只掷 `cup` 中的骰子；`save_dice`、`harvest` 和 `keep_growing` 都不得代替玩家触发普通掷骰。

### 9.2 `save_dice`

```json
{
  "type": "save_dice",
  "die_ids": ["dark-1", "light-2"]
}
```

合法条件：

- 操作者是主动玩家。
- `phase == "after_roll"`且没有待决收获队列。
- 列表 1-5 项、唯一，每个 ID 都处于 `current_roll`。
- 不接受骰面名称、数组下标或客户端自报的新结果。

### 9.3 `repeat_roll`

```json
{"type": "repeat_roll"}
```

合法条件：

- 操作者是主动玩家。
- `phase == "after_roll"`且收获队列为空。
- `repeat_used == false`。
- `current_roll` 至少有 1 颗骰子。

服务端对当前全部 `current_roll` 骰子重掷，不接受 `die_ids`，从协议层消除“只重掷部分”的非法可能。

### 9.4 `harvest`

```json
{"type": "harvest"}
```

合法条件：

- 操作者恰好是 `harvest_queue[0]`。
- 其 `completed_count >= 3`。
- 当前阶段为 `harvest_decision`、`turn_end_harvest` 或 `final_harvest`。
- 服务端在改状态前能通过 `ensure_draw_capacity(reward)` 满足本次抽牌。

### 9.5 `keep_growing`

```json
{"type": "keep_growing"}
```

只能由 `harvest_queue[0]` 提交。普通阶段仅跳过当前检查点，最终阶段则永久移出本局最终收获队列。

### 9.6 `play_again`

```json
{"type": "play_again"}
```

仅在 `game_over` 可用。每名真人玩家只能记录一次；`finish_game` 进入终局时直接把所有 Bot ID 放入 `rematch_ready`，不依赖会在 `game_over` 停止的通用 Bot 调度器再发动作。所有真人也确认后，用新的 RNG 子流重新初始化。

### 9.7 JSON Schema

`BOHNANZA_DICE_ACTION_SCHEMA` 对上述 6 种动作使用 `oneOf`，每个分支都设 `additionalProperties: false`。

`die_ids` 要求：

```text
type: array
minItems: 1
maxItems: 5
uniqueItems: true
items.pattern: ^(?:dark-[12]|light-[123])$
```

`BOHNANZA_DICE_CONFIG_SCHEMA` 首版只允许测试/可复现用 `seed`，不把目标分数、骰子数或牌数暴露成未测试的房规开关。

## 10. 核心纯函数

`game/bohnanza_dice.py` 应将以下逻辑拆成小型纯函数，方便穷举测试：

```text
load_and_validate_catalog(path) -> Catalog
canonical_order_signature(order) -> tuple
matches_order(dice_faces, order) -> bool
advance_orders(card, completed_count, dice_faces) -> new_count
enumerate_first_roll_probability(order) -> Fraction

roll_die(template, rng) -> bean_id
roll_cup_dice(dice, rng) -> dice
seat_order_from(state, player_id, include_start) -> player_id[]

harvest_reward(completed_count) -> 1 | 2 | 3
player_score(player_state) -> int
build_harvest_queue(state, origin) -> player_id[]
harvest_context_for(state, player_id, origin) -> bean_id[] | null
ensure_draw_capacity(state, needed, preferred_player_id) -> events
resolve_harvest(state, player_id) -> events

start_turn(state) -> events
resolve_roll(state) -> events
resolve_active_end_check(state) -> events
enter_final_phase(state, trigger_player_id, origin) -> events
finish_game(state) -> events

assert_card_conservation(state) -> None
assert_dice_conservation(state) -> None
```

`apply_action` 对不合法动作必须在任何状态变更、RNG 计数器增加或日志事件产生之前返回错误。

## 11. 公开视图、隐藏信息与事件

### 11.1 所有人可见

- 当前阶段、Turn 编号、主动玩家、特殊重掷是否已用。
- 5 颗骰子的 ID、模板、当前面和区域。
- 每名玩家的名字、座位、当前卡、覆盖卡、完成进度、单枚豆币数、5 豆币标记和总分。
- 收获队列和当前等待谁选择。
- 抽牌堆剩余数量，但不是顺序。
- 最后阶段触发者、最终分数和胜者。

两张收获卡在实体设置中都是正面朝上，因此不对其他玩家隐藏 `cover_card` 订单。界面可以默认折叠其卡面以节省空间，但所有玩家都可随时点击展开；这只是本地显示状态，不改变公开信息模型。

### 11.2 不得下发

- `draw_deck` 中的 card ID 顺序。
- `config.seed`、`rng_seed`、`rng_counter` 或能推断下一次结果的内部随机状态；公共视图的 `config` 只保留安全的 `catalog_id`。
- 服务端完整目录中本局未抽到的牌序。
- Bot 评分、搜索中间值或预选留骰。

### 11.3 合法动作与原因码

`get_public_view` 对当前查看者返回：

```text
legal_actions: string[]
action_reasons:
  roll: string | null
  save_dice: string | null
  repeat_roll: string | null
  harvest: string | null
  keep_growing: string | null
  play_again: string | null
```

建议原因码：

```text
not_your_turn
wrong_phase
waiting_for_harvest_decision
waiting_for_player
choose_at_least_one_die
repeat_already_used
no_current_roll
need_three_orders
not_queue_head
game_is_over
waiting_for_rematch_players
```

前端正常模式显示简短提示，Explain 模式显示完整原因，不在浏览器重新实现一套易漂移规则。

### 11.4 公开事件

```text
bohnanza_dice:game_started
bohnanza_dice:turn_started
bohnanza_dice:dice_rolled
bohnanza_dice:orders_completed
bohnanza_dice:repeat_used
bohnanza_dice:dice_saved
bohnanza_dice:harvest_prompt
bohnanza_dice:harvest_held
bohnanza_dice:harvested
bohnanza_dice:cards_recycled
bohnanza_dice:final_phase
bohnanza_dice:game_over
bohnanza_dice:rematch_ready
```

事件不携带牌堆顶的未来 card ID。日志文案应由前端使用结构化 payload 渲染，不直接插入服务端提供的 HTML。

## 12. Bot 方案

### 12.1 最低要求

Bot 必须：

- 能在 `await_roll` 提交 `roll`。
- 能在 `after_roll` 选择至少一颗合法骰子，必要时使用一次 `repeat_roll`。
- 作为收获队首时必须立即返回 `harvest` 或 `keep_growing`，不能卡死其他玩家。
- 在 `final_harvest` 收获所有可得分卡；进入 `game_over` 时由 `finish_game` 预先将 Bot 记入 `rematch_ready`。
- 只读取和真人玩家相同的公开视图语义，不窃取牌序或未来 RNG。

### 12.2 留骰启发式

对当前 `current_roll` 的所有非空子集（最多 31 个）评分：

1. 已留骰 + 候选子集对当前最底未完成订单已匹配的独立 slot 数。
2. 仍留在杯中的深/浅骰子对缺失 slot 产生可接受豆种的概率。
3. 若当前订单已稳定可完成，对下一条订单的兼容度。
4. 少量惩罚额外掷骰次数，因为每次掷骰也会帮助对手。
5. 保留非对称骰子模板信息：不能把两颗深色和三颗浅色骰子当成同分布。

同分时使用稳定 die ID 顺序破平，使测试可复现。

### 12.3 重掷与收获启发式

- 若当前结果对主要目标的最佳留骰评分很低，且特殊重掷未用，Bot 可 `repeat_roll`。
- 重掷阈值应考虑对手即将收获的风险，不是纯 Yahtzee 式最大化自己概率。
- 完成 5 条时总是收获。
- 完成 4 条时默认收获；仅在第 5 条首掷概率较高、领先并且对手未逼近 10 分时继续。
- 完成 3 条时，若 1 分可触发终局或对手已有 8-9 分则收获，否则根据第 4 条难度和牌堆状态决定。
- 最终收获没有继续留卡的未来价值，Bot 始终收获。

首版不需要 MCTS；正确、不卡死、会利用骰子模板差异比搜索深度更重要。

## 13. 前端方案（严格遵守 `FRONTEND.md`）

### 13.1 文件与全局命名

主要前端逻辑只放在：

```text
static/games/bohnanza_dice.js
```

允许进入浏览器全局作用域的名必须带独有前缀，例如：

```text
bohnanzaDiceCurrentView
bohnanzaDiceSelectedIds
bohnanzaDiceExplainMode
renderBohnanzaDiceGameState
clearBohnanzaDiceState
showBohnanzaDiceHeaderActions
```

不得声明 `currentView`、`selectedDice`、`renderGame`、`showHelp` 等通用全局名。可优先用 IIFE 把除必要入口外的状态全部变成私有变量。

`static/app.js` 只添加面板显隐、状态分发、清理和 header action 路由，不放留骰、收获、卡牌绘制或 Help/Explain 主逻辑。

### 13.2 原创视觉方向

- 整体使用温暖米色、农田绿和豆币金色，但不仿制官方黄红 Logo 和卡框。
- 豆子用自制 CSS 椭圆，叠加 Emoji、两字母缩写和纹理。
- 骰子用 CSS 圆角方块，深/浅模板用外框色、`DARK` / `LIGHT` 辅助文字和不同角标同时区分。
- 收获卡是简洁的五行合同卡，不使用官方豆子人物或相同的背景。
- 豆币用 `🪙` + 数字，5 豆币标记用 `🪙×5`，不复制官方牌背。

### 13.3 桌面端布局

```text
┌─────────────────────────────────────────────────────────────────────┐
│ Bohnanza Dice · Turn 7 · Alex's Turn         Help | Explain │
├─────────────────────────────────────────────────────────────────────┤
│ Players:  Alex 🪙 4  |  Mei 🪙 7  |  Jo 🪙 3  |  Sam 🪙 6    │
├───────────────────────────────┬─────────────────────────────────────┤
│ Rolled Dice                   │ Harvest Cards                       │
│ [D 💨] [D 🫘] [L 💧]       │ Alex  [Top 3/5] [Next]             │
│ Bean Field                   │ Mei   [Top 4/5] [Next]             │
│ [L 🥬] [L 🔥]              │ Jo    [Top 1/5] [Next]             │
│                              │ Sam   [Top 3/5] [Next]             │
│ [Reroll All N] [Save N Dice]│                                     │
├───────────────────────────────┴─────────────────────────────────────┤
│ Decision: Waiting for Mei - [Harvest 🪙×2] [Keep Growing]      │
├─────────────────────────────────────────────────────────────────────┤
│ Latest Activity (scrollable)                                      │
└─────────────────────────────────────────────────────────────────────┘
```

布局原则：

- 上方玩家摘要用 `flex-wrap`，不在页面上水平滚动。
- 桌面端主区使用自适应两列：左侧骰子与动作，右侧公开卡牌。
- 两列均设 `min-width: 0`，卡牌内容可换行，不允许长文本撑破容器。
- 日志、Help 和最终历史有 `max-height` + `overflow-y: auto`。
- 主页不使用大幅商品图或巨型装饰，减少无意义的纵向滚动。

### 13.4 骰子交互

- `current_roll` 中的每颗骰子是一个可键盘聚焦的按钮，点击切换 `aria-pressed` 与选中外框。
- `bean_field` 中的骰子是不可操作的状态元素，但 Explain 模式可说明为何不能取回。
- 至少选 1 颗后主按钮显示 `Save N Dice`；如已选当前全部剩余骰，显示 `Save & Finish`。留骰后若杯中仍有骰子，独立的 `Roll N Dice` 按钮才会启用。
- 点击骰子区外且不是功能按钮/弹窗的空白处会清除当前选择，**不新增 `Clear Selection` 按钮**。
- Esc 的优先级：关闭最上层 modal → 退出 Explain → 清除选骰。
- 收到新状态时，如果原选中 ID 已不在 `current_roll`，立即清除，不向服务端提交过期选择。

### 13.5 收获卡

每名玩家的区域显示：

- 名字、是否主动、豆币、`3/5` 式进度。
- 当前卡 5 行，视觉顺序上方最难、下方最容易；但 DOM 和数据层都标明 `bottom_to_top` 以防反向 bug。
- 每行保持紧凑，只显示 `#1-#5`、豆种 Emoji/缩写、`+`、同一骰位内的 `/`、整组间的 `OR`、`DONE/NEXT/LATER/PRE` 状态与 `🎲5` 首掷概率；不得在卡面重复堆叠规则说明句。
- `+` 分隔的骰位必须各自有独立边框，整个 alternative 再用外框成组；含多个允许豆种的单骰位用虚线框和 `/` 表示，避免把“一个骰位多选一”和“多颗骰子同时满足”画成同一种关系。
- 订单里的豆种 token 同时编码骰子模板：只出现在深骰的豆用深底，只出现在浅骰的豆用浅底，两类骰子都会出现的豆用深浅对半底色；完整含义进入 title、aria-label 和 Explain，不在卡面堆说明句。
- 当前卡 header 用短标签标明检查上下文：非主动玩家显示 `ROLL`，主动玩家显示 `FIELD×5`，cover 显示 `PRE`。Explain 再说明非主动玩家只用当前掷骰，主动玩家只在五骰全部留入豆田后检查。
- 已完成行使用明显的绿色双层高亮框 + `DONE`，不把下一张卡当作图片真正盖住文本，以保持可访问性。
- 每名玩家的公开 Cover Card 默认折叠为紧凑的 `Cover card · Show` 行，点击在完整卡面与折叠状态间切换；展开状态在局面刷新时保留，不使用水平卡牌跑马灯。
- 当前收获价值明确显示为 `Harvest for 🪙×1/2/3`。

### 13.6 收获决策条

当有队首时，在桌面流中显示醒目但不覆盖骰子和卡牌的 decision bar：

```text
Mei completed 4/5 orders. Waiting for Mei.
[Harvest 🪙×2] [Keep Growing]
```

- 只有队首本人的两个按钮可用；其他人看见等待状态和原因。
- 非主动玩家达到 3 条后也必须进入本次 `current_roll` 的收获队列；轮到本人时 `Harvest` 可用。若前面还有别人，状态只用短句提示 `your choice is queued`，不能让 disabled 按钮看起来像禁止非主动玩家收获。
- 若收获者不是主动玩家，提示必须点名当前主动玩家，并说明 `Keep Growing` 只归还回合控制权、不直接掷骰；随后若主动玩家是 Bot，Bot 仍会自行继续其回合。
- 两个按钮在手机宽度足够时同行紧凑排布，放不下才换行。
- 不使用需要输入 JSON、卡 ID 或数字的 UI。
- 收获完成后用短动画将卡移入豆币区；`prefers-reduced-motion: reduce` 时关闭移动和翻转。

### 13.7 移动端

在 `max-width: 720px` 时：

- 改为单列：顶栏 → 当前决策 → 掷骰/豆田 → 自己与主动玩家的展开卡 → 其他玩家摘要 → 日志。
- 最小为 320 CSS px 宽时仍不出现页面水平滚动；使用 `max-width: 100%`、`min-width: 0`、`overflow-wrap: anywhere`。
- 桌面端 5 颗骰子使用等宽网格；手机端统一骰盘使用不换行的弹性布局，按可用宽度同步收紧五颗骰子，但动作按钮仍保持至少 44px 高。
- 手机宽度隐藏整个 `Bean Field` 区域；骰子状态仍由服务端保存，并可从当前卡的 `FIELD×5` 上下文与操作状态判断，不让不可操作区域占据首屏。
- 手机端同时隐藏 `Current Roll` 标题行，把已锁定骰与本次新骰合并到同一个骰盘：锁定骰在左并保留锁定标记，新骰在右，中间只用一条竖线分区。五颗骰子必须始终保持单行，窄屏时等比收紧骰子尺寸而不换行。
- 玩家区缩短名字 header 到 current card 的间距，豆币圆章使用紧凑尺寸，但分数仍保持可读。
- `Fields & Scores` 不再额外显示 `PUBLIC HARVEST CARDS` eyebrow；手机端同时压缩游戏标题、状态、骰盘和动作按钮，使当前操作区保持在常见手机的一屏高度内。
- `Roll Dice`、`Save`、`Reroll` 三个骰子动作在 320px 起始宽度仍固定为同一排，不让主操作因换行分散到两个视区。
- `Harvest` / `Keep Growing` 两个决策按钮优先同行；所有动作按钮高度至少 44px，按钮之间保留 8px 以上间距。
- 玩家卡列表使用竖向 accordion，不使用会让整页左右滚动的宽表格。
- 动作区可使用正常文档流中的 `position: sticky; bottom: 0`，但必须保留占位与底部 safe-area padding，不覆盖卡牌或日志。

### 13.8 英文通用 UI

按 `FRONTEND.md`，与游戏内容无关的 UI 使用英文：

```text
Help
Explain
Close
Roll
Reroll Fresh Dice
Save N Dice
Save & Finish
Harvest
Keep Growing
Finish Without Harvesting
Waiting for ...
Latest Activity
Play Again
Winner / Winners
```

豆种名、游戏标题、订单和规则内容属于游戏内容，可在未来加本地化，但首版只需保证英文一致且无中德混杂的功能按钮。

### 13.9 可访问性

- 每个豆子 token 同时有文字、缩写、符号、颜色和纹理，不只靠色觉。
- 骰子按钮 `aria-label` 包含模板、序号、豆种、区域和选中状态。
- 卡牌的每条订单有可读文本，例如 `1 Soy Bean or Green Bean, plus 1 Red Bean and 1 Garden Bean`，不只有图标。
- 动态状态区使用 `aria-live="polite"`，一次只播报“Alex rolled 3 dice”、“Mei completed 2 orders”等摘要，不重复播报所有 DOM。
- modal 打开时移入焦点、Tab 焦点留在 modal 内，关闭后返回原按钮。
- 所有可玩操作可用键盘完成，不要依赖 hover。

## 14. Help 与 Explain（遵守 `designs/task40.md`）

### 14.1 Help

`Help` 打开 `Bohnanza Dice - Game Rules` 对话框，至少包含：

1. 目标、玩家数和 10 豆币终局。
2. 2 颗深色与 3 颗浅色骰子的面分布。
3. 六种豆子的颜色/纹理/缩写图例。
4. 订单从底部向上完成，同一订单内需独立骰子，不同订单间可重用同一组结果。
5. 主动玩家必须每次至少留 1 颗，不能提前停，只在 5 颗全留下后检查自己。
6. 其他玩家只用刚掷出的骰子，不能用豆田旧骰。
7. 每回合一次整批重掷。
8. 3/4/5 层对应 1/2/3 豆币，收获可延后，收获后下一张卡可在当前合法骰子上下文继续推进。
9. 达到 10 分后的主动玩家最后检查、全员最终收获和并列获胜。
10. `Digital Notes`：随机先手、收获队列顺序、`keep_growing` 检查点含义、骰子上下文表、卡堆回收规则、全员同意重赛。
11. `Deck Note`：当前 `catalog_id`、是否为自制兼容牌组，不误导为官方卡面复刻。

Help modal：

- 可用 `Close`、点击遮罩或 Esc 关闭。
- 内容过长时仅 modal body 纵向滚动，不撤掉标题和关闭按钮。
- 不使用官方规则书图片作为 Help 内容。

### 14.2 Explain 模式

必须完整遵守 `task40.md`：

- 点击 `Explain` 后进入解释模式。
- 只给有解释的按钮/交互元素加 `has-explanation`、虚线外框和问号光标，不让整页鼠标都变成问号。
- 用 capture phase 拦截所有普通功能按钮；无解释元素在 Explain 中也不执行原动作。
- Help、Explain 本身和 modal 关闭按钮不被普通拦截逻辑锁死。
- 对 native `disabled` 按钮用 `pointerdown` + 坐标命中检测，仍可解释为何不可用。
- 点击一个有解释的元素后显示解释 modal 并自动退出 Explain；Esc 也可退出。
- 切换游戏、离开房间或 `clearBohnanzaDiceState` 必须清除 body class、虚线高亮、临时解释 modal 和选骰状态。

Explain 至少覆盖：

- `Roll`。
- 每颗当前可选骰子。
- 豆田中已留骰子。
- `Save & Roll` / `Save & Finish`。
- `Reroll Fresh Dice`，包括“全部当前骰一起重掷”、“已使用”和“正等待收获决策”的 disabled 原因。
- `Harvest`、`Keep Growing`、`Finish Without Harvesting`。
- 当前卡、下一张卡、订单进度、豆币和抽牌堆数量。
- 每一条订单行；弹窗动态说明该行状态、按 `#1 → #5` 的解锁顺序、`+` / `/` / `OR` 语义、完整豆种名称与 `🎲5` 概率，不把这些长说明常驻在卡面。
- `Play Again`及尚未确认的玩家。

## 15. 仓库落点

### 15.1 新增文件

```text
game/bohnanza_dice.py
game/assets/bohnanza_dice_cards.json
static/games/bohnanza_dice.js
tests/test_bohnanza_dice.py
```

可选新增：

```text
scripts/validate_bohnanza_dice_cards.py
```

验证脚本只读取已提交的固定 JSON，生成概率报告或拒绝非法目录，不每次随机重写生产牌组。

### 15.2 修改文件

```text
game/__init__.py
  导入并导出 BohnanzaDiceGame

game/definitions.py
  新增 action/config schema 并注册 GameDefinition

static/index.html
  游戏选项、header actions、主面板、Help/Explain modal、独立脚本标签

static/app.js
  面板显隐、状态路由、清理和 header actions

static/style.css
  带 bohnanza-dice 前缀的卡牌、骰子、响应式、modal 和 Explain 样式

static/room.js
  GAME_WEIGHT 与房间卡片展示

scripts/bgg_weight_scrape.py
  新增 BGG 游戏 URL

game/dev_order.json
  运行 python scripts/gen_dev_order.py 后生成，不手工猜顺序
```

### 15.3 注册定义

```text
game_id: "bohnanza_dice"
name: "Bohnanza: Das Würfelspiel"
name_zh: "种豆：骰子游戏"
min_players: 2
max_players: 5
turn_mode: "turn"
module: BohnanzaDiceGame
```

模块接口：

```python
class BohnanzaDiceGame:
    game_id = "bohnanza_dice"
    min_players = 2
    max_players = 5

    @staticmethod
    def init_game(config, players): ...

    @staticmethod
    def get_legal_actions(state, player_id): ...

    @staticmethod
    def apply_action(state, player_id, action): ...

    @staticmethod
    def get_public_view(state, viewer_id): ...

    @staticmethod
    def bot_move(state, bot_id): ...

    @staticmethod
    def serialize(state): ...

    @staticmethod
    def deserialize(payload): ...
```

`app.py` 已通过 registry 调用通用模块接口，该游戏不需要新增专用 Socket.IO handler。只有发现通用 bot 调度无法处理回合外收获队首时，才对通用调度做最小、与游戏无关的修正；不把 Bohnanza 规则写进 `app.py`。

## 16. 测试计划

### 16.1 目录与固定数据

1. 目录恰好 55 张、ID 唯一、每张 5 条。
2. 所有 bean ID、alternative、slot 都合法。
3. 每条订单在真实骰子模板上可实现。
4. 枚举 7776 个面索引结果得到的概率与 JSON 元数据一致。
5. 深色骰恰好 `blue, garden, stink×2, soy×2`；浅色骰恰好 `stink, red, blue×2, green×2`。
6. 目录不含旧脚本的 `Fire/Puff/Turkey/Runner`。

### 16.2 订单匹配

7. 官方规则书的四个例子均有成功和失败夹具。
8. 一颗骰子不能同时填同一订单的两个 slot。
9. 同一组骰子可以连续完成多条订单。
10. 一条失败后不得跳到更高订单。
11. OR alternative 与单 slot 内多豆种的语义不被混淆。

### 16.3 初始化与随机

12. 1 人和 6 人局拒绝开始，2-5 人成功。
13. 每人恰好有两张不同公开卡，牌堆剩 `55 - 2N`。
14. 相同 seed 产生相同先手、牌序和骰子序列，不同 seed 不被测试强行要求每次都不同。
15. 序列化往返不改变 RNG 计数器或下一次结果。

### 16.4 掷骰、留骰与重掷

16. 回合首次 `roll` 掷全部 5 颗。
17. 非主动玩家只使用 `current_roll`，已在豆田的相同豆子不参与其匹配。
18. 主动玩家不在中途推进订单。
19. `save_dice` 拒绝空列表、重复 ID、已留骰 ID、不存在 ID 和非主动玩家。
20. 部分留骰后进入 `await_roll`，骰面与 RNG 均不再变化；只有主动玩家显式 `roll` 才产生下一次普通结果。
21. 已留骰不会被后续普通掷骰或 `repeat_roll` 改面。
22. `repeat_roll` 对当前所有未留骰生效，只能用一次，对手在重掷前后均得到检查。
23. 一个回合最多产生 6 个掷骰结果事件。
24. 5 颗全留下后主动玩家用完整豆田且只结算一次。

### 16.5 收获队列与连锁

25. 掷骰后队列从主动玩家左侧开始，主动玩家最后。
26. 只有队首能提交收获/继续，队列未清空时主动玩家不能抢先留骰或重掷。
27. 3/4/5 条分别给 1/2/3 分，不重复加分。
28. 收获后 top 进入单枚豆币，cover 变 top，抽新 cover，进度清零后按当前上下文连锁检查。
29. 非主动玩家在掷骰窗口收获时用 `current_roll`，不误用整个豆田。
30. 主动玩家在中途收获后不用尚未完成的豆田立即推进，回合末才检查。
31. 普通 `keep_growing` 只跳过一个检查点，不改变骰面、掷骰计数或 RNG；下一次由主动玩家显式产生新结果后可再入队。
31a. 公共视图携带 `turn_flow_version`；若前端检测到常驻服务仍是旧版本，禁用掷骰、留骰和收获按钮并要求重启服务，禁止新前端配旧规则继续产生隐式动作。
32. 收获连锁后仍然 3+ 条的玩家保持队首。

### 16.6 牌堆回收与守恒

33. 每次收获后 55 张卡的唯一性与区域守恒成立。
34. 抽牌足够时不提前兑换 5 豆币标记。
35. 牌不足时正确用 5 张单枚币卡兑换标记，分数不变，5 张卡洗回牌堆。
36. 多人同时满足兑换时按收获者优先、座位顺序选择，相同 seed 可复现回收后牌序。
37. 没有可兑换的 5 张单枚币卡时，引擎不静默复制卡或产生空 cover。

### 16.7 最后阶段

38. 非主动玩家在掷骰窗口到 10 分时，主动玩家不再掷骰，当前未留骰全部进豆田。
39. 主动玩家的最后卡检查只执行一次。
40. 最终收获允许连锁，分数可超过 10。
41. 达到 10 分不直接跳到胜者；必须完成全员最终收获队列。
42. 总分最多者胜，并列共同胜，不使用先到 10、最后收获数或座位破平。
43. `game_over` 不接受掷骰、留骰或收获；重赛必须全员 `play_again`。

### 16.8 公共视图、序列化与 Bot

44. 两张公开卡、进度、骰子和分数对所有玩家相同。
45. 公共视图不含牌堆顺序、RNG 状态或 Bot 搜索数据。
46. 断线重连时能恢复收获队首、决策原点和骰子上下文，不跳过或重复收获。
47. Bot 在每个可达阶段都能返回合法动作，数百局模拟不死锁。
48. 输入状态深拷贝上执行非法动作后，状态、RNG 计数器和卡序完全不变。

### 16.9 Schema 与前端人工检查

49. 所有动作拒绝多余字段，`die_ids` 有数量、唯一性和 pattern 限制。
50. `static/games/bohnanza_dice.js` 不泄漏通用全局名，通过 `tests/test_frontend_script_names.py`。
51. 320px、390px、768px 和宽屏时无页面水平滚动、按钮无重叠、decision bar 不挡住卡牌。
52. 点击空白处和 Esc 可清选骰，没有 `Clear Selection` 按钮。
53. Help 和 Explain modal 均可用 Esc 关闭，焦点移动/返回正确。
54. Explain 模式不会掷骰、留骰、收获或重赛，disabled 按钮仍能说明原因。
55. 日志、Help 和终局历史过长时内部纵向滚动，不把页面撑得过长。
56. 关闭颜色或使用灰度/色觉缺陷模拟时，仍可通过文字、缩写、纹理和符号识别六种豆子。

## 17. 验证命令

实现后至少运行：

```bash
python -m unittest tests.test_bohnanza_dice
python -m unittest tests.test_game_names tests.test_frontend_script_names tests.test_room_session
python scripts/gen_dev_order.py
node --check static/games/bohnanza_dice.js
python -m unittest
git diff --check
```

BGG Weight 更新：

```bash
python scripts/bgg_weight_scrape.py
```

若脚本需要网络，应正常申请权限，不手工伪造脚本输出。

## 18. 建议实施顺序

1. 冻结本文的版本边界，在代码和测试中禁用 `task34.md` 与现有错误生成脚本数据。
2. 先实现 bean 常量、骰子模板、订单 schema、DFS 匹配器和 7776 结果概率验证器。
3. 编写、评审并提交 55 张 `original-compatible-v1` 固定卡组；这是可玩版本的数据门槛。
4. 实现纯函数、卡/骰子守恒断言和单元测试。
5. 实现状态机、动作校验、收获队列、牌堆回收、终局、公共视图和序列化。
6. 实现 Bot，用 2-5 人随机对局压测可达性和不变式。
7. 注册游戏、更新 `game/__init__.py`、schema、BGG URL/Weight，运行 `gen_dev_order.py`。
8. 在 `static/index.html` 增加面板和 modal，在 `static/games/bohnanza_dice.js` 完成渲染和交互，只对 `static/app.js` 做必要的全局路由修改。
9. 补齐原创 CSS 豆子/骰子/收获卡、移动端、无障碍、Help 和 Explain。
10. 运行全套测试，用手机宽度、键盘、断线重连、Bot 和多人收获冲突场景做人工验收。

## 19. 完成标准

只有同时满足以下条件才算完成：

- 实现的是 2022 Version 2.0，无任何 2012 版组件或分数混入。
- 55 张牌的目录状态、来源边界和数据验证清楚；不运行现有错误随机生成脚本。
- 非主动玩家只用刚掷骰，主动玩家只在回合末用完整豆田。
- 整批重掷、收获队列、连锁换卡、5 豆币回收和最后阶段均由服务端原子处理。
- 延迟、双击、重放旧动作或断线重连不能重复加分、跳过收获者或改变骰子上下文。
- 最后收尾后才决定最高分，并列共同胜。
- Bot 可完整玩完 2-5 人局，不在回合外收获阶段卡死。
- 前端主逻辑位于 `static/games/bohnanza_dice.js`，全局命名无冲突。
- Emoji、文字、颜色和纹理共同表达豆种，不使用商业 UI 素材。
- 320px 宽起无页面水平滚动，无区块覆盖，操作按钮紧凑且可触。
- 点击空白处取消选择，Esc 清选/退出 Explain/关闭 modal，不增加 `Clear Selection`。
- Help/Explain 完整符合 `FRONTEND.md` 与 `designs/task40.md`，Explain 不会误触任何游戏动作。
- 日志、Help 和结果内部可滚动，最终结果保留到全员同意 `Play Again`。
- 新游戏注册后已重新生成 `game/dev_order.json`，针对性测试和全套测试均通过。
