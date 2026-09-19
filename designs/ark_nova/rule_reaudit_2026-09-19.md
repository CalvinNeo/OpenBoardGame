# Ark Nova 二次规则复查

日期：2026-09-19。检查对象为当前工作区实现（检查结束时 HEAD 为 `f65bef8`，包含已暂存的上一轮修改）。

本轮确认的 10 项遗留现已全部修复，其中包括 2 项卡局问题。第 1–10 节保留修复前的复现和原因，修复结果及验证见文末。

## 1. [P1] 果断选择获得 X 标记后，强制行动状态残留

- 复现：打出 505 白头海雕，果断选择 `gain_x`，再选择 Cards 行动牌获得 X 标记。
- 实际：轮到 p2 后，`forced_action` 仍是 p1 的 `gain_x`；p2 执行 Sponsors 收钱被拒绝，错误为 `must perform the granted extra action`。后续玩家的正常行动持续被锁住。
- 原因：`_defer_turn_end` 用被移动的实体行动牌名称匹配 `forced_action.action`，无法匹配第六种行动 `gain_x`，所以没有清除它。
- 位置：[game/ark_nova.py:2491](/Users/minimax/Desktop/OpenBoardGame/game/ark_nova.py:2491)、[清理分支](/Users/minimax/Desktop/OpenBoardGame/game/ark_nova.py:2524)。[官方 FAQ 第 3 页](https://www.feuerland-spiele.de/fileadmin/game/Arche_Nova/Arche_Nova_FAQ_V2_EN_A4_low.pdf)明确允许果断选择获得 X 标记。

## 2. [P1] 可以接受无法执行的额外行动，随后无法退出

- 复现：没有可用协会工人时打出 409 马来熊，接受“行动：协会”。
- 实际：进入 `forced_action=association`；唯一合法行动名称是 Association，但执行声望任务报 `not enough available association workers`。此时没有待选项可以 Skip，Bot 也返回 `None`。
- 原因：额外行动的接受选项未按实际可执行性过滤；接受后只允许指定行动，且没有结束这个可选效果的出口。
- 位置：[额外行动选项](/Users/minimax/Desktop/OpenBoardGame/game/ark_nova_effects.py:734)、[切换至强制行动](/Users/minimax/Desktop/OpenBoardGame/game/ark_nova.py:2347)。同类风险包括果断选择无牌可打的 Animals 或 X 标记已经达到上限时选择 `gain_x`。

## 3. [P2] 断言／优势取得的基础项目无法从手牌打出

- 复现：把未使用的 109 爬行类基础项目加入手牌，拥有足够爬行类图标，以强度 5 的协会行动打出并支持它。
- 实际：返回 `unknown zoo-deck conservation project`；`_add_project_to_board` 只接受 `deck_group=zoo_deck`，而能力取得的项目仍为 `base_setup`。
- 位置：[game/ark_nova.py:3296](/Users/minimax/Desktop/OpenBoardGame/game/ark_nova.py:3296)。[官方术语表第 2 页 Assertion](https://cdn.shopify.com/s/files/1/0947/3907/1278/files/Ark-Nova-Glossary.pdf?v=1754428544)允许通过协会行动把这类项目打到协会版块上方。修复时还需区分初始基础项目与后加项目，避免错误使用繁育计划的基础项目通配标记。

## 4. [P2] 非洲专家提前移动行动牌

- 复现：已有 214 非洲专家，Animals 位于槽位 5，打出 473 彩虹飞蜥；跳过日光浴后选择把 Sponsors 移到槽位 1。
- 实际：非洲专家的选择出现时，Animals 仍在槽位 5；完成后 Animals 在 1、Sponsors 在 2。
- 正确结果：先完成 Animals 并把它移到 1，再执行非洲专家；最终 Sponsors 应在 1、Animals 在 2。
- 位置：[被动触发注册](/Users/minimax/Desktop/OpenBoardGame/game/ark_nova_effects.py:1085)、[即时效果合并](/Users/minimax/Desktop/OpenBoardGame/game/ark_nova.py:2776)。依据：[官方术语表第 5 页，214](https://cdn.shopify.com/s/files/1/0947/3907/1278/files/Ark-Nova-Glossary.pdf?v=1754428544)。

## 5. [P2] 放归未优先移除特殊场馆标记

- 复现：同时有已占用的 3 格普通围栏和含 2 枚标记的爬行馆，放归能使用爬行馆的 490 砂巨蜥。
- 实际：系统同时提供普通围栏和爬行馆，可以翻空普通围栏并保留爬行馆的 2 枚标记。
- 正确结果：特殊场馆中有足够对应标记时必须先移除标记；只有不能如此处理时才翻普通围栏。
- 位置：[game/ark_nova.py:1259](/Users/minimax/Desktop/OpenBoardGame/game/ark_nova.py:1259)。依据：[官方术语表第 1 页 Release into the Wild](https://cdn.shopify.com/s/files/1/0947/3907/1278/files/Ark-Nova-Glossary.pdf?v=1754428544)。上一轮“任选特殊或普通”的结论需更正，[现有测试](/Users/minimax/Desktop/OpenBoardGame/tests/test_ark_nova_rule_regressions.py:298)也需调整预期。

## 6. [P2] 同一回合的额外行动开始前，展示区提前补牌

- 复现：同次 Animals 打出 441 招商动物和 505 白头海雕；招商拿走展示区赞助商后，果断选择 Cards。
- 实际：选择果断前展示区为 `[空, 419, 空, 415, 空, 420]`，额外 Cards 尚未执行就变成 `[419, 415, 420, 416, 217, 432]`。玩家可以提前取得本应回合结束才出现的新牌，文件夹位置也提前改变。
- 原因：`finish_action` 先补展示区，再处理 `queued_extra_actions`。
- 位置：[game/ark_nova.py:2428](/Users/minimax/Desktop/OpenBoardGame/game/ark_nova.py:2428)。[官方规则第 9 页](https://capstone-games.com/cdn/shop/files/Ark-Nova-Rulebook.pdf?v=15269496103518830006)要求整个回合结束后才补展示区。

## 7. [P2] 独特建筑被强制放在印刷奖励之前

- 复现：声望 3 时打出 254 动物园学校，并开启效果排序。
- 实际：第一个选项仍是放置建筑，随后立即拿牌；此时声望仍为 3，只能选展示区前两张。不能先拿牌面声望，再按声望 4 拿第三张。
- 原因：`_play_sponsor_card` 直接执行 `unique_building`，它不再参与效果排序；建筑触发的学校拿牌又先于印刷奖励。
- 位置：[game/ark_nova.py:2842](/Users/minimax/Desktop/OpenBoardGame/game/ark_nova.py:2842)，霍加狓代打赞助商也有相同顺序限制。[官方术语表第 1 页 Order](https://cdn.shopify.com/s/files/1/0947/3907/1278/files/Ark-Nova-Glossary.pdf?v=1754428544)直接以动物园学校举例，允许先获得声望和保育，再放建筑并拿牌。上一轮为防止放置失败而强制提前放置，限制了合法顺序。

## 8. [P2] 催眠仍不能在本动物印刷吸引力之前确定目标

- 复现：自己吸引力 5，对手 6，打出 485 欧洲蝰蛇并开启效果排序。
- 实际：先自动获得 2 吸引力成为榜首，催眠无目标，回合直接结束；没有先催眠对手的选项。
- 原因：催眠在卡牌生成源中被固定标成 `after_action`，因此被排除在即时效果排序之外。
- 位置：[scripts/arknova_card_reference.py:294](/Users/minimax/Desktop/OpenBoardGame/scripts/arknova_card_reference.py:294)、[game/ark_nova.py:2775](/Users/minimax/Desktop/OpenBoardGame/game/ark_nova.py:2775)。[官方术语表第 2 页 Hypnosis](https://cdn.shopify.com/s/files/1/0947/3907/1278/files/Ark-Nova-Glossary.pdf?v=1754428544)明确允许在催眠前或后获得本动物的吸引力。

## 9. [P2] 达到 10 保育时弃掉的最终计分牌消失

- 复现：两人局首次达到 10 保育，两人分别弃掉 006、011。
- 实际：两张牌从玩家手中移除，但未进入最终计分牌堆；牌堆仍为 7 张，正确应为 9 张。这会缩小后续抵抗能力的抽牌池。
- 位置：[game/ark_nova.py:4025](/Users/minimax/Desktop/OpenBoardGame/game/ark_nova.py:4025)。[官方规则第 18 页](https://capstone-games.com/cdn/shop/files/Ark-Nova-Rulebook.pdf?v=15269496103518830006)要求把这些牌面朝下放到剩余最终计分牌堆底部。

## 10. [P2] Cards II 不能逐张决定牌库／展示区来源

- 复现：Cards II 强度 5，不预选展示牌就提交抽牌。
- 实际：一次性抽完 4 张，下一步直接弃牌，无法在看到第一、二张之后再决定从展示区拿余下的牌。前端也要求提交前确定完整的 `market_card_ids`。
- 位置：[game/ark_nova.py:2570](/Users/minimax/Desktop/OpenBoardGame/game/ark_nova.py:2570)、[static/games/ark_nova.js:3192](/Users/minimax/Desktop/OpenBoardGame/static/games/ark_nova.js:3192)。[官方规则第 9 页示例](https://capstone-games.com/cdn/shop/files/Ark-Nova-Rulebook.pdf?v=15269496103518830006)展示了先拿展示牌、抽两张，再决定拿另一张展示牌的流程。

## 复查阶段的验证范围（修复前）

- 原有 Ark Nova 140 项单元与集成测试仍全部通过；这些通过结果不能排除上述遗漏。
- 两人种子 67、四人种子 79 的 Bot 对局均推进至终局，分别检查约 205、289 次决策。Bot 会规避部分无合法后续行动的选择，因此普通对局未触发上述卡局并不能证明玩家界面安全。
- 使用现有测试夹具构造 10 个定向场景，调用真实 `ArkNovaGame.apply_action` 与规则结算函数复现上述行为；Cards II 同时核对前端提交路径。
- 临时复现脚本：`/tmp/ark_nova_reaudit.py`；输出：`/tmp/ark_nova_reaudit_results.jsonl`。执行方式：`PYTHONPATH=. python /tmp/ark_nova_reaudit.py`。
- 未修改游戏实现、动作 schema 或正式测试断言。

## 修复结果

| 项目 | 修复后的行为 |
|---|---|
| 1. 果断获得 X | 按实际移动的行动牌完成获得 X，同时清理果断限制；旧存档中属于上一位玩家的残留限制也会清除 |
| 2. 无法执行的可选额外行动 | 接受后、开始执行前可用 `skip_extra_action` 放弃，前端和 Bot 均支持；不移动牌、不消耗标记。指定行动仍不能替换为获得 X，倍增重复也不能跳过 |
| 3. 未使用基础项目 | 能从手牌打出并支持，作为上方动态项目处理；公开视图和 Bot 都能识别。基础项目通配标记仅适用于最初位于下方的基础项目 |
| 4. 非洲专家 | 动物、赞助商和协会版块触发的机灵，统一延后到行动牌移动之后；倍增行动也等整组重复完成 |
| 5. 放归特殊场馆优先 | 对应特殊场馆有足够标记时必须移除标记，包含使用 0 格的动物；不足时才腾空普通围栏。新建场馆的迁入仍按迁入规则腾空普通围栏 |
| 6. 展示区补牌 | 同一回合的额外行动期间保留空位与原文件夹位置；整个回合完成后才补牌。原有明确要求即时补牌的能力仍按其规则执行 |
| 7. 独特建筑顺序 | 独特建筑参与即时效果排序，学校可先获得声望再建造拿牌，霍加狓代打同样支持。预先校验指定位置，并确保中途可选建造给尚未放置的独特建筑留下合法空间 |
| 8. 催眠 | 可选择在印刷吸引力前或后执行。立即暂停当前动物卡，按对手的强度、升级面执行借用行动，再恢复剩余效果、后续动物与倍增重复；牌面说明和生成源同步修正 |
| 9. 最终计分牌弃牌 | 达到 10 保育时弃掉的计分牌放回剩余计分牌堆底部，保留原牌堆顶部次序 |
| 10. Cards II 来源选择 | 每拿一张牌后更新手牌，再决定下一张来自牌库或可达展示区；全部拿完才弃牌、移动行动牌。新界面使用 `choose_card_sources`，旧客户端显式提交的完整拿牌方案继续兼容 |

## 修复验证

- 新增 21 项定向回归，将放归及霍加狓旧断言修正为正式规则预期；Ark Nova 共 **161 项测试通过**。
- 回归包含催眠前后排序、借用 Cards II 的嵌套选择、外层倍增恢复、旧果断状态恢复、0 格爬行动物放归及独特建筑最后合法空间保护。
- 两人（种子 67）和四人（种子 79）Bot 对局均完成终局，无非法行动或卡局。
- 浏览器实际操作完成 Cards II“展示区 → 牌库 → 牌库 → 展示区 → 弃牌”、跳过无工人的额外协会行动、催眠借用 Cards II 后恢复动物奖励；390px 手机宽度无横向溢出，控制台无 JavaScript 错误。
- 重建卡牌 JSON 与目录；JavaScript 语法检查、相关文件差异空白检查通过。

```sh
python scripts/gen_arknova_cards_json.py
python -m unittest tests.test_ark_nova_rule_regressions tests.test_ark_nova_game tests.test_ark_nova_effects tests.test_ark_nova_card_data tests.test_ark_nova_map0 tests.test_ark_nova_ai tests.test_ark_nova_integration
```
