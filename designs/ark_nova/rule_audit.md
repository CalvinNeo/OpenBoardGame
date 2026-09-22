# Ark Nova 规则审计记录

本文件统一保存 Ark Nova 的规则审计、复现证据及修复验证记录，按审计日期保留历史过程；旧记录中的测试数量、代码行号和缺陷状态均对应当时版本，以后续修复回填为准。后续审计继续追加在本文件。最新全牌字段复核见文末“2026-09-22：128 张动物、11 张终局与 32 张保护项目逐牌复核”；其中更正了早期对 482 岩石图标的误读。

# 2026-09-18

## 基础版规则与卡牌效果审计

以下保留首次审计及后续回填的修复说明；各轮验证记录与最新遗留见 2026-09-19。

### 结论

本轮不是只修复单张卡，而是重新以官方基础版规则资料为准，检查卡牌数据、效果结算、协会版块、休息、Map 0、前端选择与说明文字之间是否一致。

用户指出的三个问题已经分别定位并修正：

| 问题 | 审计结论 | 修正结果 |
|---|---|---|
| 525 豚鼠 / 526 羊驼不能进入萌宠动物园 | 两张牌的印刷入住方式都只有萌宠动物园 1 格；卡牌数据原本正确，问题同时存在于动作 JSON 校验范围和前端围栏候选 | 动物动作 schema 已接受 525/526，前端只提供兼容的萌宠动物园；两张牌的核心路径也统一覆盖 |
| 大学的帽子与研究图标混淆 | 🎓 是声望，🔬 是研究；大学本身另用 🏫 表示。三块大学并不是同一奖励的多枚库存 | 改为三块共享协会版块：`🔬×2`、`🔬×1 + 🎓×2`、`🎓×1 + 手牌上限 5`；被领取后到下一次休息前不可再取 |
| 121 海蚀洞效果标错 | 海蚀洞确实是爬行类放归项目；旧数据还把 `5/4/3` 点保育奖励误写成三个精确尺寸条件 | 现在按动物卡上印刷的标准围栏尺寸分为 `4-5 / 3 / 1-2` 三档，即使动物住在爬行馆等特殊场馆也不改变档位 |

### 官方依据

- [Ark Nova Rulebook](https://capstone-games.com/cdn/shop/files/Ark-Nova-Rulebook.pdf?v=15269496103518830006)
- [Ark Nova Glossary](https://cdn.shopify.com/s/files/1/0947/3907/1278/files/Ark-Nova-Glossary.pdf?v=1754428544)
- [Ark Nova Icon Overview](https://cdn.shopify.com/s/files/1/0947/3907/1278/files/Ark-Nova-Icon-Overview.pdf?v=1754428545)
- [Ark Nova FAQ v2](https://cdn.shopify.com/s/files/1/0947/3907/1278/files/Ark-Nova-FAQ-v2.pdf?v=1754428544)
- [Ark Nova: Marine Worlds Rulebook](https://capstone-games.com/cdn/shop/files/AN_Exp1_Rules_EN_0-7_low.pdf?v=3049443834535182443)

审计时直接检查了官方 PDF 的正文和图标页，而不是仅依赖现有中文文案。社区牌库数据只用于逐字段交叉核对，不作为规则裁决来源。

### 审计范围

| 范围 | 数量或内容 |
|---|---|
| 动物卡 | 128 张：费用、标准围栏尺寸、替代场馆、岩石/水域条件、标签、奖励、能力 |
| 赞助商卡 | 64 张：行动强度、条件、建筑、即时/持续/收入/终局效果 |
| 基础保护项目 | 12 张 |
| 放归与繁育保护项目 | 20 张 |
| 最终计分卡 | 11 张 |
| 行动卡 | 5 类、正反两面 |
| 公共系统 | 协会版块、大学、伙伴动物园、休息、展示区、声望轨、Map 0 奖励与升级 |
| 前端 | 卡牌信息、合法目标列表、协会供应、项目选择及玩家可见状态 |

### 已修正的规则偏差

#### 图标、标签与触发

- 动物类别补齐为七类：鸟类、食草类、猛兽、灵长类、爬行类、熊类、萌宠类。
- 一张卡会为自己的效果提供其右上角图标；左侧打出条件不提供图标。
- 大学上印刷的研究图标和伙伴动物园的大洲图标在取得时立刻生效，并能触发相应的“获得图标”效果；手牌上限大学没有研究图标。
- 双图标按两个图标处理，可令对应触发效果结算两次。
- 区分“你获得图标”和“任意玩家获得图标”，不再把自己的专属触发错误地监听全桌。
- 区分“获得一个此前没有的独特图标”和普通获得图标。
- 动物及独特赞助商建筑上的临水、临岩要求也计入动物园图标统计。

#### 动物能力与入住

- 525 豚鼠与 526 羊驼严格使用萌宠动物园；动作 schema 不再错误拒绝 525，前端也不再给出普通围栏目标。
- 同一次 Animals 行动中打出多张萌宠动物时，每张自身的递增吸引力以它入场当时的萌宠图标数锁定，不再让第一张错误地看见后打出的牌。
- 群居比较的是宿主动物卡上印刷的标准围栏尺寸，不是它当前实际占用的建筑容量。
- “大型动物”按印刷标准围栏尺寸 4 或 5 判断；入住爬行馆或大型鸟类馆不会失去大型动物身份。
- 猎取效果在有动物牌可选时必须保留一张，不能以空选择规避。
- 跳跃效果的数值和显示区边界受到正确限制。
- 227 的传牌结束后，未被保留的剩余卡进入弃牌堆。
- 放归带袋囊牌的动物时，一并弃掉该动物下方的袋囊牌。

#### 保护项目与放归

- 113–122 的放归项目均按被放归动物的印刷标准围栏尺寸分档：4–5 格获得 5 保育，3 格获得 4 保育，1–2 格获得 3 保育。
- 121 海蚀洞的类别保持为爬行类；纠正的是三个尺寸区间、奖励对应关系以及必须使用印刷标准尺寸的判定。
- 放归后正确移除动物、扣除其印刷吸引力、腾空对应场馆，并处理相关附属卡。
- 支持项目的重复支持、额外奖励和可选动物候选使用同一套规则校验。

#### 协会版块、大学与休息

- 大学供应改为协会版块上的三块唯一板块，而不是每种四枚库存。
- 三块大学的奖励严格区分：两枚研究；一枚研究加两格声望；一格声望加手牌上限 5。
- 被取得的大学或伙伴动物园从协会版块移除；休息时各补回一块。
- 公共视图明确返回 `available`、`owned_by_you` 和 `on_board`，前端不会在空列表时回退为“全部可取”。
- 在 Map 0 上取得第二个伙伴动物园或第二所大学时，正确进入一次行动卡升级选择。
- 协会板块自身提供的图标会参与即时触发。

#### 展示区、声望与额外行动

- 普通捕捉、赞助商磁铁等效果保留原文件夹位置，并在回合结束时补牌，不再因数组前移改变文件夹费用/声望范围。
- `Snapping 2` 两次拿牌之间增加明确选择：玩家可以立刻补满展示区，也可以不补；第二张仍必须从当时的展示区拿取。
- 科学实验室只能从当前声望范围内选择卡牌。
- Cards I 不能把声望提高到 10 以上；Cards II 才能进入 10–15。
- 声望已经到 15 时，继续获得的每点声望改为 1 点吸引力。
- 声望文件夹边界改为官方轨道的 `0 / 2 / 4 / 7 / 10 / 13`；补齐 5、8、11、12、13、14、15 的一次性奖励。
- Animals II 强度 5 的 1 声望是可选项，并在行动开始时决定，因此会正确影响本次展示区范围。
- 效果授予的额外行动现在可选择放弃；执行时仍按正常规则移动行动卡并允许花费 X 标记。催眠不能使用倍增标记。
- 决断既能再次执行 Animals，也能选择获得 X 标记的分支。
- 倍增标记不再默认一次耗尽：玩家明确选择使用数量，每枚增加一次完整行动；未使用的标记留在行动卡上，休息时才清除。
- 毒液和缠绕按规则自动影响所有合格玩家，不再要求玩家手动点一个无意义的目标；催眠只列出吸引力榜首的合法目标。
- 偷窃 2 分别计算吸引力榜首和保育榜首，允许两个目标相同，并在各自出现平局时提供组合选择；所有互动能力统一执行“对方至少 5 吸引力”和检疫实验室忽略该玩家计数的规则。

#### 赞助商、建筑与终局计分

- 独特赞助商建筑没有合法位置时不能打出，不再先收取费用/奖励后留下无法放置的建筑。
- 姿态的多个免费亭子改为逐个选择和放置；前端单次地图放置现在能被效果层正确接收，不会静默丢失。
- 断言/优势从单独持久化的“未使用基础项目”牌堆取牌；旧存档会排除已在桌面、手牌或弃牌堆中的项目，避免复制同一张项目牌。
- 最终计分卡 009 使用全部七种动物类别，并比较右手边玩家，而不是漏掉熊类、萌宠类或比较错方向。
- 终局“大型动物”类统计统一使用印刷标准围栏尺寸。

#### 公共版块、奖励选择与回合流程

- Map 0 保育奖励现在在提交项目任务前明确选择并随任务发送，奖励会在协会任务顺序中的正确位置立即生效。
- 2 人局捐赠区使用 `2 / 5 / 7 / 10` 四个可用格；旧存档会迁移到正确的七格公共布局，而不重复出现金额 2。
- 休息由触发者开始按顺序结算收入；若终局条件在休息中首次达成，包括触发休息者在内的所有玩家各有最后一回合。
- 保育奖励在“所有行动已升级、所有工人已启用”或免费围栏没有合法位置时，不再创建无选项的强制选择而卡死游戏。

#### 基础版与《海洋世界》替换卡混用

官方《海洋世界》规则书明确列出了要替换的基础版卡牌。本项目的数据声明是“纯基础版、无扩展”，但六张终局计分卡误用了扩展替换版的计分门槛。已恢复为原始基础版：

| 卡号 | 卡牌 | 误用的扩展替换值 | 原始基础版 |
|---|---|---|---|
| 001 | 大型动物公园 | 1 / 2 / 3 / 4 | 1 / 2 / 4 / 5 |
| 003 | 科研动物园 | 3 / 4 / 5 / 7 | 3 / 4 / 5 / 6 |
| 005 | 公益保护动物园 | 2 / 3 / 4 / 5 | 3 / 4 / 5 / 6 |
| 008 | 慈善动物园 | 3 / 5 / 7 / 9 | 3 / 6 / 8 / 10 |
| 010 | 岩石公园 | 1 / 3 / 5 / 6 | 1 / 3 / 5 / 7 |
| 011 | 水生态公园 | 2 / 4 / 6 / 7 | 2 / 4 / 6 / 8 |

同一张官方替换清单里的 009、101、102、131 以及 207、208、225、226、227、250、261、262 也已逐张重查。项目中 009、101、102、131 仍使用基础版的判定和门槛；上述赞助商卡的基础版效果与官方术语表一致，其中 227 的剩余展示牌去向已在本轮改为弃牌堆。

### 数据层交叉核对

- 对 128 张动物卡逐张比较费用、吸引力、保育、声望、标准围栏尺寸、临水/临岩、标签与能力标识。
- 对 64 张赞助商卡逐张比较行动强度、奖励和效果标识。
- 当时将 482 判为同时要求临水及临岩。**此结论已于 2026-09-22 更正：牌面只要求临水 1；另一处棕色数字 1 是爬行馆占用量，不是岩石要求。**详见文末逐牌复核；不能继续沿用旧断言。
- 生成文件来自 `scripts/arknova_card_reference.py` 和 `scripts/gen_arknova_cards_json.py`；不要直接手改生成后的 JSON。

# 2026-09-19

本日按工作先后记录后续修复、二次复查及修复、第三次复查、第四次回归复查，以及第三、四次问题的集中修复。第三次的 7 项和第四次新增的 6 项，累计 **13 项（2 项 P1、11 项 P2）现已全部修复**；另修正长局回归发现的额外 Cards II Bot 卡局。新增 35 项回归测试，Ark Nova 共 **196 项通过**。下面各次复查保留当时的复现结果和验证范围，最新状态见文末“第三、四次复查问题修复”。放归优先级、独特建筑顺序以二次复查记录为准；催眠以第四次复查的更正及本轮修复为准。

## 后续核查与修复

上一轮列出的五项建模边界现已补齐状态模型和交互；后续核查发现的偏差也一并修正：

| 问题 | 当前行为 |
|---|---|
| 多张动物或赞助商没有逐张结算 | 每张卡及其嵌套选择全部完成后才能继续出牌；刚得到的金币、图标和手牌立即可用。行动卡在整次行动完成后移动，行动结束能力随后结算 |
| 印刷奖励和互动能力顺序固定 | 玩家可先结算毒液、偷窃等能力，再取得印刷吸引力；目标以能力实际结算时的轨道状态确定 |
| 同时效果无法排序 | 玩家可选择自己的下一项效果，或采用列出的顺序；另一位玩家仍自行选择其效果顺序，嵌套选择不会被后续效果覆盖 |
| 放归错误地依赖动物与建筑的绑定 | 普通围栏的占用状态单独记录；优先移除特殊场馆对应标记，不足时按印刷尺寸和地形要求选择最小合格已占用围栏，处理地形回退与并列选择。群集动物也能使用已失去建筑绑定的合法宿主 |
| 新建特殊场馆不能迁移动物 | 爬行馆、大型鸟类馆建成后可逐只迁入相符动物，并逐次检查容量和腾空围栏；玩家可以随时结束此次迁移 |
| 亭子没有获得吸引力 | 付费和免费放置亭子均立即获得 1 吸引力 |
| Build II 错误禁止不同尺寸普通围栏 | 建筑类型与尺寸共同决定是否重复；工程师允许的同款非特殊建筑副本仍付钱，但不额外消耗强度 |
| WAZA 大型动物项目忽略整项图标条件 | 只豁免一个缺少的图标，不再一次跳过多个同类图标；仍检查独立的地形要求 |
| 考古学家永久消耗未覆盖地图奖励 | 复制奖励不标记该格已被覆盖；以后仍可再次复制，实际覆盖时也正常获得奖励 |
| 偷窃 2 错选零保育目标 | 保育分支要求目标至少有 1 保育 |
| 非当前玩家交叉轨道过早触发终局 | 普通回合结束只检查当前玩家；休息中检查全部玩家。休息首次触发终局时，触发休息者也有最后一回合 |
| 休息收入选项过时 | 从触发者开始逐人完整结算收入并补展示区，下一位玩家根据最新展示区选择 |
| 起始手牌选择泄露展示区 | 所有人完成保留起始手牌前，公开视图和前端均显示六张牌背 |
| 毒液罚款不足导致选择无法结束 | 保存受毒液影响回合的起始状态；若完整结算后仍无力支付，恢复整回合并允许重新行动。Bot 避开已经失败的相同方案 |
| 独特建筑、连锁出牌和后续任务卡住 | 提交的独特建筑位置在赞助商入场前校验；霍加狓连锁可使用前一张刚抽到的赞助商，附带建筑参与即时效果排序并保留合法放置空间。已完成交互后变为非法的后续出牌可重选，后续建造或协会计划可结束已完成的合法部分 |

前端通过 `choose_effect_order` 提供效果顺序选择，通过 `continue_action` 提供逐张继续出牌，通过 `choose_card_sources` 提供 Cards II 每张牌的来源选择。旧 API 的明确拿牌方案仍受支持。毒液整回合回滚需要回合开始时的快照；更新前已经停在回合中途的旧存档不具备该历史快照。

### 验证记录

2026-09-18 的上一轮审计执行了数据重建、静态解析和效果注册覆盖检查，未运行测试套件。2026-09-19 本次修复新增 32 项规则回归测试，Ark Nova 的 140 项测试全部通过：

```sh
python -m unittest tests.test_ark_nova_rule_regressions tests.test_ark_nova_game tests.test_ark_nova_effects tests.test_ark_nova_card_data tests.test_ark_nova_map0 tests.test_ark_nova_ai tests.test_ark_nova_integration
```

- 三个固定种子（11、23、47）的三人 Bot 对局，各连续执行 120 次决策，共 360 次，覆盖效果排序、待选项和多次休息，无非法行动或卡死。
- 浏览器实际点击验证起始牌背、先结算毒液、日光浴卖牌后继续打第二张动物，以及连续迁移两只动物。
- 390px 手机视口无横向溢出，场馆选项显示名称和地图坐标，浏览器无 JavaScript 错误。
- 前端 JavaScript 语法检查和 Ark Nova 相关文件的 `git diff --check` 通过。

## 二次规则复查

检查对象为当前工作区实现（检查结束时 HEAD 为 `f65bef8`，包含已暂存的上一轮修改）。

本轮确认的 10 项遗留当时均已提交修复，其中包括 2 项卡局问题。第 1–10 节保留修复前的复现和原因，修复结果及验证见本节的「修复结果」和「修复验证」。第四次复查进一步发现第 8 项将“提前确定催眠目标”误实现为“立即执行借用行动”，相关结论以后文更正为准。

### 1. [P1] 果断选择获得 X 标记后，强制行动状态残留

- 复现：打出 505 白头海雕，果断选择 `gain_x`，再选择 Cards 行动牌获得 X 标记。
- 实际：轮到 p2 后，`forced_action` 仍是 p1 的 `gain_x`；p2 执行 Sponsors 收钱被拒绝，错误为 `must perform the granted extra action`。后续玩家的正常行动持续被锁住。
- 原因：`_defer_turn_end` 用被移动的实体行动牌名称匹配 `forced_action.action`，无法匹配第六种行动 `gain_x`，所以没有清除它。
- 位置：[game/ark_nova.py:2491](/Users/minimax/Desktop/OpenBoardGame/game/ark_nova.py:2491)、[清理分支](/Users/minimax/Desktop/OpenBoardGame/game/ark_nova.py:2524)。[官方 FAQ 第 3 页](https://www.feuerland-spiele.de/fileadmin/game/Arche_Nova/Arche_Nova_FAQ_V2_EN_A4_low.pdf)明确允许果断选择获得 X 标记。

### 2. [P1] 可以接受无法执行的额外行动，随后无法退出

- 复现：没有可用协会工人时打出 409 马来熊，接受“行动：协会”。
- 实际：进入 `forced_action=association`；唯一合法行动名称是 Association，但执行声望任务报 `not enough available association workers`。此时没有待选项可以 Skip，Bot 也返回 `None`。
- 原因：额外行动的接受选项未按实际可执行性过滤；接受后只允许指定行动，且没有结束这个可选效果的出口。
- 位置：[额外行动选项](/Users/minimax/Desktop/OpenBoardGame/game/ark_nova_effects.py:734)、[切换至强制行动](/Users/minimax/Desktop/OpenBoardGame/game/ark_nova.py:2347)。同类风险包括果断选择无牌可打的 Animals 或 X 标记已经达到上限时选择 `gain_x`。

### 3. [P2] 断言／优势取得的基础项目无法从手牌打出

- 复现：把未使用的 109 爬行类基础项目加入手牌，拥有足够爬行类图标，以强度 5 的协会行动打出并支持它。
- 实际：返回 `unknown zoo-deck conservation project`；`_add_project_to_board` 只接受 `deck_group=zoo_deck`，而能力取得的项目仍为 `base_setup`。
- 位置：[game/ark_nova.py:3296](/Users/minimax/Desktop/OpenBoardGame/game/ark_nova.py:3296)。[官方术语表第 2 页 Assertion](https://cdn.shopify.com/s/files/1/0947/3907/1278/files/Ark-Nova-Glossary.pdf?v=1754428544)允许通过协会行动把这类项目打到协会版块上方。修复时还需区分初始基础项目与后加项目，避免错误使用繁育计划的基础项目通配标记。

### 4. [P2] 非洲专家提前移动行动牌

- 复现：已有 214 非洲专家，Animals 位于槽位 5，打出 473 彩虹飞蜥；跳过日光浴后选择把 Sponsors 移到槽位 1。
- 实际：非洲专家的选择出现时，Animals 仍在槽位 5；完成后 Animals 在 1、Sponsors 在 2。
- 正确结果：先完成 Animals 并把它移到 1，再执行非洲专家；最终 Sponsors 应在 1、Animals 在 2。
- 位置：[被动触发注册](/Users/minimax/Desktop/OpenBoardGame/game/ark_nova_effects.py:1085)、[即时效果合并](/Users/minimax/Desktop/OpenBoardGame/game/ark_nova.py:2776)。依据：[官方术语表第 5 页，214](https://cdn.shopify.com/s/files/1/0947/3907/1278/files/Ark-Nova-Glossary.pdf?v=1754428544)。

### 5. [P2] 放归未优先移除特殊场馆标记

- 复现：同时有已占用的 3 格普通围栏和含 2 枚标记的爬行馆，放归能使用爬行馆的 490 砂巨蜥。
- 实际：系统同时提供普通围栏和爬行馆，可以翻空普通围栏并保留爬行馆的 2 枚标记。
- 正确结果：特殊场馆中有足够对应标记时必须先移除标记；只有不能如此处理时才翻普通围栏。
- 位置：[game/ark_nova.py:1259](/Users/minimax/Desktop/OpenBoardGame/game/ark_nova.py:1259)。依据：[官方术语表第 1 页 Release into the Wild](https://cdn.shopify.com/s/files/1/0947/3907/1278/files/Ark-Nova-Glossary.pdf?v=1754428544)。上一轮“任选特殊或普通”的结论需更正，[现有测试](/Users/minimax/Desktop/OpenBoardGame/tests/test_ark_nova_rule_regressions.py:298)也需调整预期。

### 6. [P2] 同一回合的额外行动开始前，展示区提前补牌

- 复现：同次 Animals 打出 441 招商动物和 505 白头海雕；招商拿走展示区赞助商后，果断选择 Cards。
- 实际：选择果断前展示区为 `[空, 419, 空, 415, 空, 420]`，额外 Cards 尚未执行就变成 `[419, 415, 420, 416, 217, 432]`。玩家可以提前取得本应回合结束才出现的新牌，文件夹位置也提前改变。
- 原因：`finish_action` 先补展示区，再处理 `queued_extra_actions`。
- 位置：[game/ark_nova.py:2428](/Users/minimax/Desktop/OpenBoardGame/game/ark_nova.py:2428)。[官方规则第 9 页](https://capstone-games.com/cdn/shop/files/Ark-Nova-Rulebook.pdf?v=15269496103518830006)要求整个回合结束后才补展示区。

### 7. [P2] 独特建筑被强制放在印刷奖励之前

- 复现：声望 3 时打出 254 动物园学校，并开启效果排序。
- 实际：第一个选项仍是放置建筑，随后立即拿牌；此时声望仍为 3，只能选展示区前两张。不能先拿牌面声望，再按声望 4 拿第三张。
- 原因：`_play_sponsor_card` 直接执行 `unique_building`，它不再参与效果排序；建筑触发的学校拿牌又先于印刷奖励。
- 位置：[game/ark_nova.py:2842](/Users/minimax/Desktop/OpenBoardGame/game/ark_nova.py:2842)，霍加狓代打赞助商也有相同顺序限制。[官方术语表第 1 页 Order](https://cdn.shopify.com/s/files/1/0947/3907/1278/files/Ark-Nova-Glossary.pdf?v=1754428544)直接以动物园学校举例，允许先获得声望和保育，再放建筑并拿牌。上一轮为防止放置失败而强制提前放置，限制了合法顺序。

### 8. [P2] 催眠仍不能在本动物印刷吸引力之前确定目标

- 复现：自己吸引力 5，对手 6，打出 485 欧洲蝰蛇并开启效果排序。
- 实际：先自动获得 2 吸引力成为榜首，催眠无目标，回合直接结束；没有先催眠对手的选项。
- 原因：催眠在卡牌生成源中被固定标成 `after_action`，因此被排除在即时效果排序之外。
- 位置：[scripts/arknova_card_reference.py:294](/Users/minimax/Desktop/OpenBoardGame/scripts/arknova_card_reference.py:294)、[game/ark_nova.py:2775](/Users/minimax/Desktop/OpenBoardGame/game/ark_nova.py:2775)。当时依据[官方术语表第 2 页 Hypnosis](https://cdn.shopify.com/s/files/1/0947/3907/1278/files/Ark-Nova-Glossary.pdf?v=1754428544)关于吸引力前后顺序的表述进行修复；第四次复查核实设计团队对此文字的澄清：提前的是确定目标，实际借用行动仍须等当前行动结束。

### 9. [P2] 达到 10 保育时弃掉的最终计分牌消失

- 复现：两人局首次达到 10 保育，两人分别弃掉 006、011。
- 实际：两张牌从玩家手中移除，但未进入最终计分牌堆；牌堆仍为 7 张，正确应为 9 张。这会缩小后续抵抗能力的抽牌池。
- 位置：[game/ark_nova.py:4025](/Users/minimax/Desktop/OpenBoardGame/game/ark_nova.py:4025)。[官方规则第 18 页](https://capstone-games.com/cdn/shop/files/Ark-Nova-Rulebook.pdf?v=15269496103518830006)要求把这些牌面朝下放到剩余最终计分牌堆底部。

### 10. [P2] Cards II 不能逐张决定牌库／展示区来源

- 复现：Cards II 强度 5，不预选展示牌就提交抽牌。
- 实际：一次性抽完 4 张，下一步直接弃牌，无法在看到第一、二张之后再决定从展示区拿余下的牌。前端也要求提交前确定完整的 `market_card_ids`。
- 位置：[game/ark_nova.py:2570](/Users/minimax/Desktop/OpenBoardGame/game/ark_nova.py:2570)、[static/games/ark_nova.js:3192](/Users/minimax/Desktop/OpenBoardGame/static/games/ark_nova.js:3192)。[官方规则第 9 页示例](https://capstone-games.com/cdn/shop/files/Ark-Nova-Rulebook.pdf?v=15269496103518830006)展示了先拿展示牌、抽两张，再决定拿另一张展示牌的流程。

### 复查阶段的验证范围（修复前）

- 原有 Ark Nova 140 项单元与集成测试仍全部通过；这些通过结果不能排除上述遗漏。
- 两人种子 67、四人种子 79 的 Bot 对局均推进至终局，分别检查约 205、289 次决策。Bot 会规避部分无合法后续行动的选择，因此普通对局未触发上述卡局并不能证明玩家界面安全。
- 使用现有测试夹具构造 10 个定向场景，调用真实 `ArkNovaGame.apply_action` 与规则结算函数复现上述行为；Cards II 同时核对前端提交路径。
- 临时复现脚本：`/tmp/ark_nova_reaudit.py`；输出：`/tmp/ark_nova_reaudit_results.jsonl`。执行方式：`PYTHONPATH=. python /tmp/ark_nova_reaudit.py`。
- 未修改游戏实现、动作 schema 或正式测试断言。

### 修复结果

| 项目 | 修复后的行为 |
|---|---|
| 1. 果断获得 X | 按实际移动的行动牌完成获得 X，同时清理果断限制；旧存档中属于上一位玩家的残留限制也会清除 |
| 2. 无法执行的可选额外行动 | 接受后、开始执行前可用 `skip_extra_action` 放弃，前端和 Bot 均支持；不移动牌、不消耗标记。指定行动仍不能替换为获得 X，倍增重复也不能跳过 |
| 3. 未使用基础项目 | 能从手牌打出并支持，作为上方动态项目处理；公开视图和 Bot 都能识别。基础项目通配标记仅适用于最初位于下方的基础项目 |
| 4. 非洲专家 | 动物、赞助商和协会版块触发的机灵，统一延后到行动牌移动之后；倍增行动也等整组重复完成 |
| 5. 放归特殊场馆优先 | 对应特殊场馆有足够标记时必须移除标记，包含使用 0 格的动物；不足时才腾空普通围栏。新建场馆的迁入仍按迁入规则腾空普通围栏 |
| 6. 展示区补牌 | 同一回合的额外行动期间保留空位与原文件夹位置；整个回合完成后才补牌。原有明确要求即时补牌的能力仍按其规则执行 |
| 7. 独特建筑顺序 | 独特建筑参与即时效果排序，学校可先获得声望再建造拿牌，霍加狓代打同样支持。预先校验指定位置，并确保中途可选建造给尚未放置的独特建筑留下合法空间 |
| 8. 催眠 | 当时实现为在印刷吸引力前后立即暂停动物卡，执行借用行动，再恢复剩余效果；第四次复查确认该执行时机不正确。本轮集中修复已保留提前确定目标的能力，将实际借用行动推迟至原行动结束，并更正生成源与相关测试 |
| 9. 最终计分牌弃牌 | 达到 10 保育时弃掉的计分牌放回剩余计分牌堆底部，保留原牌堆顶部次序 |
| 10. Cards II 来源选择 | 每拿一张牌后更新手牌，再决定下一张来自牌库或可达展示区；全部拿完才弃牌、移动行动牌。新界面使用 `choose_card_sources`，旧客户端显式提交的完整拿牌方案继续兼容 |

### 修复验证

- 新增 21 项定向回归，将放归及霍加狓旧断言修正为正式规则预期；Ark Nova 共 **161 项测试通过**。
- 回归包含催眠前后排序、借用 Cards II 的嵌套选择、外层倍增恢复、旧果断状态恢复、0 格爬行动物放归及独特建筑最后合法空间保护。
- 两人（种子 67）和四人（种子 79）Bot 对局均完成终局，无非法行动或卡局。
- 浏览器实际操作完成 Cards II“展示区 → 牌库 → 牌库 → 展示区 → 弃牌”、跳过无工人的额外协会行动、催眠借用 Cards II 后恢复动物奖励；390px 手机宽度无横向溢出，控制台无 JavaScript 错误。
- 重建卡牌 JSON 与目录；JavaScript 语法检查、相关文件差异空白检查通过。

```sh
python scripts/gen_arknova_cards_json.py
python -m unittest tests.test_ark_nova_rule_regressions tests.test_ark_nova_game tests.test_ark_nova_effects tests.test_ark_nova_card_data tests.test_ark_nova_map0 tests.test_ark_nova_ai tests.test_ark_nova_integration
```

## 第三次规则复查

检查版本：`68e62ab`。本轮在上一轮修复后的实现上，重点检查倍增、催眠、行动结束效果的嵌套，以及休息和奖励选择的边界。

确认 **7 项遗留：1 项 P1 卡局、6 项 P2 规则偏差**。均已构造场景复现；复查阶段只记录审计结果，未修改游戏实现。以下为修复前记录，现已全部修复，见文末集中修复结果。

### 1. [P1] 倍增的第二次行动无法执行时，对局没有出口

- 前置：Animals I 位于槽位 5，有 1 枚倍增标记；手中只有 473 彩虹飞蜥，场上只有一个空的 1 格围栏。
- 操作：提交 Animals，使用 1 枚倍增标记，打出 473；跳过日光浴。
- 实际：第一轮出牌已经提交，手牌为空、围栏已占用；随后进入不可跳过的 `forced_action=animals`。合法行动列表只返回 `animals`，空出牌报 `Animals requires at least one card`，跳过报 `there is no optional extra action to skip`；Bot 返回 `None`。整局无法继续。
- 原因：创建重复行动时没有处理不可执行的后续重复，也没有恢复到可操作状态的路径。
- 位置：[重复行动状态](/Users/minimax/Desktop/OpenBoardGame/game/ark_nova.py:2521)、[跳过限制](/Users/minimax/Desktop/OpenBoardGame/game/ark_nova.py:2440)。
- 规则及修复约束：[官方术语表第 3 页 Multiplier](https://cdn.shopify.com/s/files/1/0947/3907/1278/files/Ark-Nova-Glossary.pdf?v=1754428544)说明重复行动的结算；[官方 FAQ 第 3 页](https://www.feuerland-spiele.de/fileadmin/game/Arche_Nova/Arche_Nova_FAQ_V2_EN_A4_low.pdf)禁止把一次常规行动和一次获得 X 标记混用。因此，不能用“允许第二次改拿 X”掩盖卡局；需在接受倍增及其后续结算时处理无法完成的计划。

### 2. [P2] 催眠借用 Build II 仍按自己的 Build I 检查地图限制

- 前置：自己的 Build 未升级；对手槽位 3 的 Build 已升级。H3 是空的 II 标记格，并与现有建筑相邻。
- 操作：485 欧洲蝰蛇先执行催眠，借用对手的 Build II，在 H3 建亭子。
- 实际：借用面已正确记录为 II，仍返回 `Build II is required for a marked space`。同一场地若把自己的 Build 标为升级，位置校验就通过。
- 正确结果：该次借用 Build II 应允许覆盖 II 标记格。
- 原因：地图校验直接读取自己的 `action_cards.build.upgraded`，绕过借用行动的面；前端预览也重复了同样判断。
- 位置：[后端](/Users/minimax/Desktop/OpenBoardGame/game/ark_nova.py:902)、[前端](/Users/minimax/Desktop/OpenBoardGame/static/games/ark_nova.js:1766)。
- 依据：[官方术语表第 2 页 Hypnosis 示例 1](https://cdn.shopify.com/s/files/1/0947/3907/1278/files/Ark-Nova-Glossary.pdf?v=1754428544)明确允许这种建造。第 3 页示例 4 要求查看自己的 Build，适用的是借用 Sponsors 放置独特建筑，不能推广到借用 Build 本身。

### 3. [P2] 选择先执行额外行动，仍被强制先结算其余行动结束效果

- 前置：已有 214 非洲专家，打出 453 白颈白眉猴；同时触发“机灵”和“行动：卡牌”，启用效果排序。
- 操作：先选“行动：卡牌”并接受，再计划完成 Cards 后用“机灵”把 Sponsors 移到槽位 1。
- 实际：接受 Cards 后，系统先弹出 `move_action_card`；此时 Cards 尚未开始。移动 Sponsors 后才启动额外 Cards。最终 Cards 在 1、Sponsors 在 2。
- 正确结果：所选 Cards 应先完整执行，再让玩家处理剩余的“机灵”；按上述选择，Sponsors 应在 1、Cards 在 2。
- 原因：`extra_action_requested` 只追加到 `queued_extra_actions`，而剩余效果队列继续执行。效果排序改变了“接受行动”的顺序，没有改变行动实际执行顺序。
- 位置：[额外行动入队](/Users/minimax/Desktop/OpenBoardGame/game/ark_nova.py:1770)、[队列优先执行](/Users/minimax/Desktop/OpenBoardGame/game/ark_nova.py:2492)。
- 依据：[官方术语表第 1 页 Order](https://cdn.shopify.com/s/files/1/0947/3907/1278/files/Ark-Nova-Glossary.pdf?v=1754428544)允许自行决定同时触发效果的执行顺序。

### 4. [P2] 科学实验室收入在同一玩家收入尚未结束时补展示牌

- 前置：声望 0，同时拥有 201 科学实验室和地图拿牌收入；选择先结算科学实验室。
- 操作：科学实验室拿走文件夹 1 的 462。
- 实际：展示区立即从 `[462, 424, 214, 509, 416, 217]` 变为 `[424, 214, 509, 416, 217, 432]`。随后该玩家的地图收入可以在声望 0 时拿走原本位于文件夹 2 的 424。
- 正确结果：同一玩家收入期间保留空位；该玩家全部收入完成后才补牌。因此下一次地图拿牌应只能从牌库取得。
- 原因：效果层把所有 `timing=income` 的展示区拿牌都标为即时补牌，绕过核心按玩家结算完收入后统一补牌的逻辑。
- 位置：[game/ark_nova_effects.py:673](/Users/minimax/Desktop/OpenBoardGame/game/ark_nova_effects.py:673)。
- 依据：[官方规则第 18 页 Break 第 5 步](https://capstone-games.com/cdn/shop/files/Ark-Nova-Rulebook.pdf?v=15269496103518830006)规定每名玩家的收入结束后补展示区。

### 5. [P2] 休息时尚未弃手牌，就提前公开新展示牌

- 前置：玩家有 4 张手牌、上限为 3；Sponsors 推进休息条至末端。
- 实际：仍停在 `discard_cards` 时，公开视图的展示区已经从 `[508, 418, 462, 424, 214, 509]` 更新为 `[462, 424, 214, 509, 416, 217]`。玩家可以看过新出现的 416、217 后再决定弃哪张手牌。
- 正确结果：先完成全部玩家的手牌上限弃牌，再进入后续休息步骤和展示区补牌。
- 原因：`_resolve_break` 仅排入弃牌选择，没有等选择完成就继续修改展示区并抽取新牌。
- 位置：[弃牌排队](/Users/minimax/Desktop/OpenBoardGame/game/ark_nova.py:2224)、[提前补牌](/Users/minimax/Desktop/OpenBoardGame/game/ark_nova.py:2251)。
- 依据：[官方规则第 18 页 Break](https://capstone-games.com/cdn/shop/files/Ark-Nova-Rulebook.pdf?v=15269496103518830006)要求按顺序执行第 1 步弃牌和第 4 步补展示区。

### 6. [P2] 免费围栏奖励被强制执行，不能保留地图空间

- 前置：已解锁 Map 0 的 `enclosure_2_income`，地图仍有合法的 2 格围栏位置。
- 操作：休息收入出现免费围栏选择，尝试放弃本次放置。
- 实际：待选项 `min=1`，提交空选择返回 `wrong number of selections`。玩家必须占用地图空间，不能为后续大围栏保留空间。
- 正确结果：可以跳过本次免费围栏奖励，不影响以后休息再次取得该收入。
- 原因：地图首次奖励、休息收入和保育奖励牌的免费围栏均使用强制选择；解析器也无跳过分支。
- 位置：[地图奖励](/Users/minimax/Desktop/OpenBoardGame/game/ark_nova.py:1451)、[休息收入](/Users/minimax/Desktop/OpenBoardGame/game/ark_nova.py:1900)、[奖励牌](/Users/minimax/Desktop/OpenBoardGame/game/ark_nova.py:3821)、[选择解析](/Users/minimax/Desktop/OpenBoardGame/game/ark_nova.py:4238)。
- 依据：[官方 Icon Overview 第 1 页，免费 2／3 格围栏图标](https://cdn.shopify.com/s/files/1/0947/3907/1278/files/Ark-Nova-Icon-Overview.pdf?v=1754428545)使用可选建造表述。本轮核对了此前下载的官方文本摘录。

### 7. [P2] 声望无法增加时，仍能以空协会任务解锁捐赠

- 前置：声望 9、Cards I、Association II 位于槽位 2，有 1 名可用工人。
- 操作：提交声望任务并捐赠。
- 实际：声望保持 9，系统仍消耗工人、移动协会牌，并允许花 2 钱取得 1 保育。
- 正确结果：此时没有完成可产生效果的声望任务，不能靠该空任务获得捐赠资格。Cards II 且声望 15 的情况不同：声望可转换为吸引力，不能一概禁止。
- 原因：声望任务无条件调用奖励函数；奖励在 9 处被截断为 0 后，仍按成功任务记录并继续捐赠。
- 位置：[game/ark_nova.py:3677](/Users/minimax/Desktop/OpenBoardGame/game/ark_nova.py:3677)。
- 依据：[官方规则第 8、16 页](https://capstone-games.com/cdn/shop/files/Ark-Nova-Rulebook.pdf?v=15269496103518830006)分别禁止空行动，并要求捐赠前实际完成至少一个协会任务。

### 暂未计入确认数量的边界

**动物能力与普通抽牌在牌库耗尽时处理不一致。** 牌库只剩 1 张、弃牌堆有 3 张时，401 猎豹的“抽 3 张”实际只得到 1 张；普通 Cards 路径的 `_draw` 则会洗回弃牌堆。涉及 `_draw_cards`、`_reveal_from_deck`、科学实验室牌库选项及 WAZA 搜索等路径。

本轮已复现代码差异，但未在所查官方基础版规则、术语表及 FAQ 中找到明确的牌库耗尽处理条款，所以不把“必须洗回弃牌堆”当成已确认的官方规则结论。后续统一此边界时需明确采用的规则。

### 验证与范围

- Ark Nova 现有 **161 项测试全部通过**；上述组合边界未被当前断言覆盖。
- 三人 Bot 对局（种子 103）经过 273 次决策正常完成，未出现非法动作；常规对局结果不能排除上述定向场景的问题。
- 使用现有夹具构造 8 个定向场景：7 个确认问题，加 1 个牌库耗尽观察项。动作和选择通过真实 `ArkNovaGame.apply_action` 执行；休息收入案例另调用实际核心休息结算函数。
- 临时复现脚本：`/tmp/ark_nova_third_audit.py`；结果：`/tmp/ark_nova_third_audit_results.jsonl`。其中断言用于确认当前缺陷行为，不能作为修复后的正确预期。
- 本轮不是重新逐字段校对全部卡牌；重点是上一轮修改涉及的连续结算、嵌套行动、休息信息公开及选择出口。
- 未修改游戏代码、生成数据、前端或正式测试。

```sh
/usr/bin/python3 -m unittest tests.test_ark_nova_rule_regressions tests.test_ark_nova_game tests.test_ark_nova_effects tests.test_ark_nova_card_data tests.test_ark_nova_map0 tests.test_ark_nova_ai tests.test_ark_nova_integration
PYTHONPATH=. /usr/bin/python3 /tmp/ark_nova_third_audit.py
```

## 第四次回归复查

检查版本：`68e62ab`。在第三次已知 7 项之外，复查协会项目、赞助商组合、客户端行动校验、隐藏信息广播与实际长局。新增确认 **6 项：1 项 P1、5 项 P2**，均有定向复现。以下为修复前记录，现已全部修复，见文末集中修复结果。

### 1. [P1] 牌库抽到的隐藏手牌随事件广播给所有对手

- 操作：p1 使用强度 5 的 Cards I，从牌库抽牌并弃掉一张旧手牌；通过真实 `_emit_game_state` 生成发给 p2 的 Socket.IO 消息，以 mock 捕获发送内容。
- 实际：p2 的公开视图正确隐藏 p1 手牌，但同一消息的 `ark_nova:cards.payload.drawn` 包含 `["416", "217", "432"]`；这三张牌仍全部在 p1 的隐藏手牌中。对手从收到的网络消息即可得知牌面，无须访问服务器状态。
- 原因：Cards 事件包含私有牌号，房间广播把相同 `events` 原样附到每个玩家的消息，未按接收者过滤。逐张 Cards II 的最终事件及效果层 `cards_drawn` 也有同类牌号字段，修复时应统一检查。
- 位置：[普通抽牌事件](/Users/minimax/Desktop/OpenBoardGame/game/ark_nova.py:2766)、[逐张抽牌事件](/Users/minimax/Desktop/OpenBoardGame/game/ark_nova.py:2670)、[效果抽牌事件](/Users/minimax/Desktop/OpenBoardGame/game/ark_nova_effects.py:415)、[公共广播](/Users/minimax/Desktop/OpenBoardGame/app.py:472)。
- 正确结果：本人可以收到抽到的牌号；对手只能得到应当公开的信息，例如抽牌数量和公开展示区取牌。依据：[官方规则第 5 页，个人设置 F](https://capstone-games.com/cdn/shop/files/Ark-Nova-Rulebook.pdf?v=15269496103518830006)要求手牌对其他玩家保密。

### 2. [P2] 催眠把提前确定目标错误地实现为提前执行借用行动

- 前置：p1 吸引力 24，有 485 欧洲蝰蛇和 222，2 枚 X 标记；p2 吸引力 30，Sponsors I 在槽位 3。
- 操作：打出 485，选择先催眠，借用对手 Sponsors 并花 2 枚 X，打出要求吸引力不超过 25 的 222。
- 实际：开始借用 Sponsors 时，吸引力仍为 24、自己的 Animals 仍在槽位 5；222 成功入场。随后才取得 485 的 2 吸引力，变为 26。
- 正确结果：可以在取得动物吸引力前确定催眠目标，但必须完成当前 Animals 行动、领取奖励并移动行动牌后，才实际执行借用行动。该场景借用时已是 26 吸引力，不能打出 222。
- 原因：`hypnosis_action` 选择完成后立即调用 `_suspend_for_extra_action`；生成源也把催眠执行标为 `immediate`。现有测试 `test_hypnosis_executes_a_borrowed_action_before_animal_rewards` 恰好断言错误顺序，因此测试通过不能证明规则正确。
- 位置：[执行入口](/Users/minimax/Desktop/OpenBoardGame/game/ark_nova.py:4059)、[能力生成源](/Users/minimax/Desktop/OpenBoardGame/scripts/arknova_card_reference.py:294)、[错误预期测试](/Users/minimax/Desktop/OpenBoardGame/tests/test_ark_nova_rule_regressions.py:733)。
- 依据：[Bastian Winkelhaus 于 2022-03-18 的设计团队澄清](https://boardgamegeek.com/thread/2832987/hypnosis-timing)明确区分目标确定与实际执行，并以“最多 25 吸引力赞助商”说明这一限制；同时更正了术语表的歧义。本项更正二次复查第 8 项的修复方向，不能简单恢复为在行动结束后才判断目标。

### 3. [P2] 项目奖励越过保育里程碑选择，导致后续声望丢失

- 前置：保育 1、声望 9、Cards I；已有 473 和非洲伙伴动物园，手持 125 爬行繁育项目。
- 操作：开启效果排序，支持 125 第 2 格，获得 1 保育和 2 声望；到达保育 2 时选择升级 Cards。
- 实际：出现升级选择之前，2 声望就已被 Cards I 的 9 上限截断；完成升级后声望仍是 9。选择地图 `conservation_1_income` 也无法先处理地图奖励来解除限制。
- 正确结果：可以先取得保育、完成升级 Cards，再领取声望至 11，并触发声望 11 的保育奖励。地图奖励也允许安排在项目奖励之前或之后。
- 原因：`_support_project` 直接批量调用 `_apply_rewards`；保育里程碑只排入待选队列，函数继续发声望，最后才处理地图奖励。
- 位置：[项目奖励顺序](/Users/minimax/Desktop/OpenBoardGame/game/ark_nova.py:3597)、[里程碑入队](/Users/minimax/Desktop/OpenBoardGame/game/ark_nova.py:533)。
- 依据：[官方规则第 15 页](https://capstone-games.com/cdn/shop/files/Ark-Nova-Rulebook.pdf?v=15269496103518830006)允许选择地图奖励相对项目奖励的顺序；[官方术语表第 1 页 Order](https://cdn.shopify.com/s/files/1/0947/3907/1278/files/Ark-Nova-Glossary.pdf?v=1754428544)要求奖励即时结算，并允许选择同时奖励的顺序。

### 4. [P2] 协会界面忽略行动中新增工人和金钱，阻止合法计划

- 工人场景：Association II 槽位 5 加 1 枚 X，声望 6、1 名可用工人；计划先拿声望大学，再做声望任务。大学提供 2 声望，到 8 时解锁的新工人可供第二项任务使用。后端完整接受，最终两项任务各有一名工人；客户端却报 `Reputation needs 1 association worker; only 0 are available at that point.`
- 金钱场景：现有金钱 0，Association II 支持 125 第 2 格，选择地图 12 钱奖励后捐赠 2 钱。后端接受，最终金钱 10；客户端却报 `This plan needs at least 💰2; you currently have 💰0.`
- 原因：`arkNovaAssociationPlanIssue` 只模拟声望任务和第三伙伴带来的工人，漏掉大学及其他奖励；资金检查只比较行动开始前的余额。两种拒绝均用实际公开视图执行原始前端函数复现，与同一状态的真实后端行动结果对照。
- 位置：[工人校验](/Users/minimax/Desktop/OpenBoardGame/static/games/ark_nova.js:2242)、[金钱校验](/Users/minimax/Desktop/OpenBoardGame/static/games/ark_nova.js:2265)。
- 正确结果：允许使用前一任务已取得的奖励完成后续任务或捐赠。依据：[官方 FAQ 第 2 页 Other](https://www.feuerland-spiele.de/fileadmin/game/Arche_Nova/Arche_Nova_FAQ_V2_EN_A4_low.pdf)明确允许同一行动即时使用奖励，只有行动种类和强度在开始时锁定。

### 5. [P2] 通配标记可以补足项目条件，界面却按没有标记禁用档位

- 前置：473 提供 1 个爬行类图标，215 有 2 枚通配标记；109 基础项目第 3 格开放，需要 2 个爬行类图标。
- 实际：公开项目返回 `eligible_slots=[]`，界面禁用该档并在加入计划时再次拦截。相同状态向真实 `apply_action` 提交 `wild_token_card_id="215"` 则成功支持项目，标记由 2 变 1。
- 原因：项目公开资格计算调用 `_project_requirement_met` 时没有传入可用通配数量；前端只依据该静态资格列表，没有根据选择的通配标记更新。
- 位置：[公开资格](/Users/minimax/Desktop/OpenBoardGame/game/ark_nova.py:4488)、[档位禁用](/Users/minimax/Desktop/OpenBoardGame/static/games/ark_nova.js:2618)、[提交拦截](/Users/minimax/Desktop/OpenBoardGame/static/games/ark_nova.js:3162)。
- 正确结果：在选择合法通配标记后，补足条件的档位应可以选择和提交。依据：[官方术语表第 5 页 215](https://cdn.shopify.com/s/files/1/0947/3907/1278/files/Ark-Nova-Glossary.pdf?v=1754428544)明确允许用一枚标记补足一个基础项目图标。

### 6. [P2] 215 与 218 无法各用一枚通配标记支持同一项目

- 前置：473 与非洲伙伴提供 2 个非洲图标，103 第 2 格要求 4 个；215、218 各有 2 枚可用标记。
- 操作：尝试从两张赞助商各花一枚标记，补足缺少的 2 个图标。
- 实际：后端只接收一个 `wild_token_card_id`，把通配数量固定为 1。单独传任一卡都不满足项目；单数字段传数组会报标记不可用，尝试复数字段则被忽略。五种输入均被拒绝且状态不变，底层需求函数传入 `wild_icons=2` 本身可以满足条件。
- 正确结果：可以各用一枚，分别扣除并记录两张卡的使用；仍禁止从同一张卡为同一项目使用两枚。此项是后端表达能力缺失，与上一项单枚通配的界面拦截独立。
- 位置：[单卡输入](/Users/minimax/Desktop/OpenBoardGame/game/ark_nova.py:3537)、[固定通配数量](/Users/minimax/Desktop/OpenBoardGame/game/ark_nova.py:3556)、[单卡扣除](/Users/minimax/Desktop/OpenBoardGame/game/ark_nova.py:3591)。
- 依据：[Bastian Winkelhaus 于 2021-12-31 的设计团队答复](https://boardgamegeek.com/thread/2784782/breeding-cooperation-card-215-and-breeding-program)明确允许两张卡各使用一枚。

### 验证与范围

- Ark Nova 现有 **161 项测试全部通过**。催眠测试存在上述错误预期；其他新增边界缺少相应断言。
- 重新运行第三次的定向复现，原有 **7 项遗留仍全部成立**；牌库耗尽观察项仍不计入确认数量。
- 六局 Bot 对局全部正常终局，共 **1,724 次决策、52 次休息**；覆盖 178 次效果排序、26 次继续出牌、134 次 Cards II 来源选择，以及放归、迁移、额外行动、偷窃和袋囊。

| 人数 | 种子 | 决策数 | 休息数 | 结果 |
|---|---:|---:|---:|---|
| 2 | 131 | 265 | 8 | 正常终局 |
| 2 | 137 | 297 | 9 | 正常终局 |
| 3 | 139 | 272 | 8 | 正常终局 |
| 3 | 149 | 295 | 9 | 正常终局 |
| 4 | 151 | 272 | 8 | 正常终局 |
| 4 | 157 | 323 | 10 | 正常终局 |

- 长局逐步检查动作成功、行动槽位 1–5 唯一、资源非负和轨道上限、展示区六槽、稳定结算边界的实体卡守恒，以及终局无待选/效果/强制行动残留。Bot 对局通过不能排除已构造的定向边界。
- 定向复现临时文件：`/tmp/ark_nova_fourth_association_audit.py`、`/tmp/ark_nova_audit_hypnosis.py`、`/tmp/ark_nova_fourth_client_audit.py`、`/tmp/ark_nova_fourth_client_audit.js`；长局脚本及结果：`/tmp/ark_nova_fourth_smoke.py`、`/tmp/ark_nova_fourth_smoke_results.json`。这些文件不在仓库内，上述各节已保留复现步骤和实际结果。
- 客户端计划校验在 Node VM 中运行仓库原始函数；广播检查 mock 了 `sio.emit`，执行实际公共消息构造逻辑。本轮未进行新的浏览器点击测试。
- 本轮只更新本审计文件，未修改游戏实现、卡牌数据、前端或正式测试。

```sh
/usr/bin/python3 -m unittest tests.test_ark_nova_rule_regressions tests.test_ark_nova_game tests.test_ark_nova_effects tests.test_ark_nova_card_data tests.test_ark_nova_map0 tests.test_ark_nova_ai tests.test_ark_nova_integration
PYTHONPATH=. /usr/bin/python3 /tmp/ark_nova_third_audit.py
PYTHONPATH=. /usr/bin/python3 /tmp/ark_nova_fourth_association_audit.py
PYTHONPATH=. /usr/bin/python3 /tmp/ark_nova_audit_hypnosis.py
PYTHONPATH=. /usr/bin/python3 /tmp/ark_nova_fourth_client_audit.py
/Users/minimax/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node /tmp/ark_nova_fourth_client_audit.js
PYTHONPATH=. /usr/bin/python3 /tmp/ark_nova_fourth_smoke.py
```

## 第三、四次复查问题修复

第三次 7 项、第四次 6 项均已修复；下面的编号对应上文各次复查。保留修复前的复现记录，便于追溯错误行为和规则依据。

| 复查项目 | 修复后的行为 |
|---|---|
| 第三次 1：倍增后续行动卡局 | 每次重复前检查是否仍有合法行动，包含可用 X。无法继续时恢复整组倍增行动开始前的状态，恢复资源、卡牌、建筑和倍增标记，允许重新规划；不能只跳过第二次，也不能替换为获得 X。Bot 记录失败方案，避免反复选择同一计划 |
| 第三次 2：借用 Build II 无法进入升级格 | 放置校验和客户端预览均使用此次借用行动的等级，允许 Build II 覆盖升级限定格；借用 Sponsors II 不会同时把自己的 Build I 升级 |
| 第三次 3：额外行动与剩余效果顺序错误 | 接受额外行动后立即暂停原效果队列，完成额外行动及其嵌套选择后再恢复剩余机灵等效果；跳过可选额外行动也会正确恢复原队列 |
| 第三次 4：科学实验室收入提前补展示牌 | 领取展示牌后保留空位，等该玩家本次收入全部完成再补牌，后续同次收入效果不能看到提前补出的牌 |
| 第三次 5：休息弃牌前刷新展示区 | 先完成所有玩家的手牌上限弃牌，再执行休息清理、工人返回、展示区刷新和收入，避免弃牌时提前获得新展示牌信息 |
| 第三次 6：免费围栏不能放弃 | 三种免费围栏来源均支持跳过，允许空选择，不强迫占用地图空间；客户端和 Bot 都能继续结算 |
| 第三次 7：无效声望任务开启捐赠 | Cards I 声望已达 9 时不能执行无收益声望任务，也不能据此捐赠；Cards II 的声望上限及可转化吸引力另行判断 |
| 第四次 1：隐藏牌号随事件广播 | Ark Nova 事件按接收者独立过滤，本人保留私有牌号，对手只收到数量及应公开内容；同时覆盖效果抽牌、袋囊、计分牌保留、基础项目领取、偷窃、Bot 行动和诊断元数据，并验证倍增快照不会外泄 |
| 第四次 2：催眠过早执行 | 仍允许在动物吸引力之前或之后锁定目标；完成整个 Animals 行动、结算奖励并移动行动牌后，才选择和执行借用行动。修正生成源、生成数据、卡牌目录及此前断言错误时机的测试 |
| 第四次 3：项目奖励越过里程碑 | 项目各项奖励和地图奖励进入可排序效果队列；保育里程碑选择必须完成后才继续后续奖励，因此可以先升级 Cards 再获得声望 |
| 第四次 4：协会计划忽略中途奖励 | 客户端保留初始任务及固定强度等校验，移除不完整的后续工人、资金预测；后端逐项按实际奖励更新后的状态校验，允许新工人继续任务、项目现金支付捐赠 |
| 第四次 5：单枚通配不能解锁界面档位 | 公开视图提供按通配数量区分的项目资格；界面随选择更新可用档位，补足条件后可正常加入并提交计划 |
| 第四次 6：两张赞助商不能共同提供通配 | 动作、界面、公开资格和 Bot 支持 `wild_token_card_ids`，允许 215、218 各用一枚；逐张校验和扣除，仍禁止同卡重复使用，并兼容旧单数输入字段 |

### 新增回归与长局修正

- 新增 **35 项正式测试**：行动顺序 7 项、协会 14 项、休息 4 项、事件隐私 9 项、Bot 1 项。相关测试文件为 `tests/test_ark_nova_action_order_regressions.py`、`tests/test_ark_nova_association_regressions.py`、`tests/test_ark_nova_break_regressions.py`、`tests/test_ark_nova_event_privacy.py` 和 `tests/test_ark_nova_ai.py`。同时调整原有催眠、休息测试，使预期符合修正后的时机。
- Ark Nova **196 项测试全部通过**；房间会话测试与隐私测试组合也通过。
- 长局首次运行时，四人种子 151 在第 167 次决策暴露新问题：额外 Cards II 尚在选择拿牌来源，Bot 就将强制行动判断为无法继续。现已修复为先完成待选流程，增加完整来源选择回归；失败快照能继续，重新运行该整局也正常终局。
- 另检查嵌套额外行动恢复、多枚倍增的执行次数、第三次重复无法建造时的整组恢复，以及嵌套可选行动倍增失败后仍能跳过并恢复外层机灵。

修复后六局均正常终局，共 **1,753 次决策、50 次休息**：

| 人数 | 种子 | 决策数 | 休息数 | 结果 |
|---|---:|---:|---:|---|
| 2 | 131 | 283 | 7 | 正常终局 |
| 2 | 137 | 317 | 9 | 正常终局 |
| 3 | 139 | 260 | 8 | 正常终局 |
| 3 | 149 | 247 | 7 | 正常终局 |
| 4 | 151 | 313 | 9 | 正常终局 |
| 4 | 157 | 333 | 10 | 正常终局 |

长局逐步检查动作成功、行动槽位 1–5 唯一、资源非负和轨道上限、展示区六槽、稳定结算边界的实体卡守恒，以及终局无待选、效果或强制行动残留。脚本及结果保存在临时文件 `/tmp/ark_nova_fixed_smoke.py`、`/tmp/ark_nova_fixed_smoke_results.json`；本节已记录不依赖临时文件的结果摘要。

### 客户端与生成文件验证

- 使用仓库实际 JavaScript、CSS 和真实 `ArkNovaGame.apply_action` 场景进行浏览器操作：双通配解锁并支持项目、项目奖励排序、大学解锁工人后继续声望任务、零现金领取项目奖励后捐赠、跳过免费围栏、催眠借用 Build II 在 H3 升级限定格建造，均成功。
- 修正催眠界面说明；修复浏览器验证发现的手机奖励下拉框横向溢出、通配复选框标签换行。390px 视口下页面宽度为 390px，无横向溢出，复选框和标签同行；控制台无 JavaScript 错误。
- 重建卡牌 JSON、能力 JSON 和卡牌目录；JavaScript 语法检查及相关文件差异空白检查通过。

```sh
/usr/bin/python3 scripts/gen_arknova_cards_json.py
/usr/bin/python3 -m unittest discover -s tests -p 'test_ark_nova*.py'
/usr/bin/python3 -m unittest tests.test_room_session tests.test_ark_nova_event_privacy
/Users/minimax/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node --check static/games/ark_nova.js
PYTHONPATH=. /usr/bin/python3 /tmp/ark_nova_fixed_smoke.py
```

### 全仓库验证与边界

- 因修改了公共消息广播入口，尝试运行完整 `python -m unittest`。掼蛋训练测试 `tests/test_guandan_nn_train.py` 的 `test_policy_target_blend_prefers_soft_targets_for_model_search` 长时间未结束，随后中断，不能记为全仓库通过。日志：`/tmp/ark_nova_fix_full_tests.log`。
- 排除掼蛋测试后运行 **858 项，854 项通过、4 项失败**，均为 Halli Galli 的翻牌等待和按铃测试。单独重跑 `tests.test_halli_galli`，同样 4 项失败；其游戏文件及测试文件相对修复前 `68e62ab` 均无变化，属于本次范围外的既有问题。日志：`/tmp/ark_nova_fix_global_without_guandan.log`。
- 整组倍增恢复依赖行动开始时保存的私有快照。更新前已经卡在倍增中途、且没有该快照的旧存档，无法追溯恢复此前状态；本轮保证的是更新后开始的行动流程。
- 第三次复查的牌库耗尽观察项仍未确认为规则缺陷，本轮未改动对应可选规则。测试和长局结果不代表所有卡牌组合已穷尽验证。

# 2026-09-21：官方规则复核（2026-09-22 修复回填）

**状态：以下 6 类问题已于 2026-09-22 全部修复，新增 23 条回归测试；Ark Nova 共 219 条测试通过。**

以下保留 2026-09-21 在 `09c134f` 上的审计证据，当时确认了 6 类问题，其中 1 类能使正常界面与 AI 都无法继续对局。范围为基础版、Map 0、多人规则。修复详情见文末回填记录。

## 1. [P1] 偷窃 2 的第二次选择不会刷新，可能卡住对局

**位置：** [连续生成两次选择](/Users/minimax/Desktop/OpenBoardGame/game/ark_nova.py:1653)、[按当前资源生成选项](/Users/minimax/Desktop/OpenBoardGame/game/ark_nova.py:1574)、[拒绝无手牌时交牌](/Users/minimax/Desktop/OpenBoardGame/game/ark_nova.py:4127)。

官方要求针对同一玩家的两次偷窃依次处理；没有手牌且不足 5 钱时，交出剩余的钱，余额为零也能完成。依据：[Glossary 第 3 页，Pilfering](https://cdn.shopify.com/s/files/1/0947/3907/1278/files/Ark-Nova-Glossary.pdf?v=1754428544#page=3)。

复现：458 日本猕猴的两个偷窃目标都是同一名玩家；该玩家在吸引力和保育上均领先，只有 1 张手牌、0 钱。两次选择提前生成，均只有 `card`。第一次拿走最后一张手牌后，第二次仍只能交牌，提交返回 `no hand card available for pilfering`，AI 返回 `None`。界面没有可用的交钱或跳过选项。

预期第二次按更新后的资源生成选择，交出 0 钱并继续。修复应覆盖“首次交钱后不足 5 钱”和“首次交出最后一张牌”两种资源变化。

## 2. [P2] 保育轨 5 / 8 奖励池不符合基础版组件

**位置：** [BONUS_TOKEN_DEFS](/Users/minimax/Desktop/OpenBoardGame/game/ark_nova.py:114)、[随机选取奖励](/Users/minimax/Desktop/OpenBoardGame/game/ark_nova.py:4882)。

规则书明确基础版只有 4 次行动牌升级机会，不能升级全部 5 张行动牌。官方 FAQ 也展示了伙伴动物园与大学奖励板块。依据：[Rulebook 第 8 页](https://capstone-games.com/cdn/shop/files/Ark-Nova-Rulebook.pdf?v=15269496103518830006#page=8)、[FAQ 第 1 页，Bonus Tiles / Icons](https://cdn.shopify.com/s/files/1/0947/3907/1278/files/Ark-Nova-FAQ-v2.pdf?v=1754428544#page=1)。

当前奖励池包含额外的 `upgrade`，却没有伙伴动物园、大学奖励。种子 7 的正常初始化会在保育 5 放出 `upgrade` 和 `worker`。已有 4 张升级牌的玩家领取 `upgrade` 后，能够把第 5 张也升级。

应重新核对整套基础版 9 块奖励的构成与图标含义，而不是只在升级数量达到 4 时禁用该错误板块。本条确定的偏差是额外升级与缺失的官方奖励；复现脚本同时记录了当前完整池，便于修复时核对。

## 3. [P2] 重复毒液 / 缠绕错误扩散到额外行动牌

**位置：** [_add_action_token](/Users/minimax/Desktop/OpenBoardGame/game/ark_nova.py:1515)、[生成器中的毒液说明](/Users/minimax/Desktop/OpenBoardGame/scripts/arknova_card_reference.py:287)。

毒液按槽位 1、2……放置，缠绕按槽位 5、4 放置；指定位置已有同类标记时，丢弃新标记。不会另找其他槽位。依据：[Glossary 第 2 页，Constriction；第 3 页，Venom](https://cdn.shopify.com/s/files/1/0947/3907/1278/files/Ark-Nova-Glossary.pdf?v=1754428544#page=2)。

当前循环跳过已有标记的牌后继续遍历，直到新增足量标记。通过实际动物行动复现：

- 槽位 1 已有毒液，再触发 449 鸭嘴兽的毒液 1：实际槽位 1、2 均有毒液，正确结果只有槽位 1。
- 槽位 5 已有缠绕，再触发 482 森蚺对仅吸引力领先玩家的缠绕 1：实际槽位 4、5 均有缠绕，正确结果只有槽位 5。

能力说明生成器同样写成寻找未放标记的牌。修复逻辑时需同步修正文案及生成的数据。

## 4. [P2] 263 大型动物计划的免费 5 格围栏无法通过正常界面领取

**位置：** [前端构造提交参数](/Users/minimax/Desktop/OpenBoardGame/static/games/ark_nova.js:3265)、[效果层转发放置参数](/Users/minimax/Desktop/OpenBoardGame/game/ark_nova_effects.py:1400)、[核心默认尺寸为 1](/Users/minimax/Desktop/OpenBoardGame/game/ark_nova.py:1755)。

263 的即时效果允许免费建造 5 格围栏，仍遵守通常放置规则。依据：[Glossary 第 7 页，263](https://cdn.shopify.com/s/files/1/0947/3907/1278/files/Ark-Nova-Glossary.pdf?v=1754428544#page=7)。

界面按照待决选择中的 `size=5` 绘制围栏，但发送的 `selection` 只有 `building_type` 和 `cells`。效果层没有补回固定尺寸，核心把 `standard_enclosure` 的默认尺寸当作 1，导致合法的 5 格位置报 `building size does not match its cells`。

用实际打出 263 后生成的选择复现：格子 `C5, C6, D6, D7, E6` 按前端参数提交失败；同一请求显式加入 `size: 5` 后成功。此处复现的是前后端协议路径，未通过浏览器点击操作。玩家可以跳过，但会丢失本应可领取的奖励。

## 5. [P2] 228 小型动物计划被错误归入“行动结束后”效果

**位置：** [_advance_card_sequence](/Users/minimax/Desktop/OpenBoardGame/game/ark_nova.py:3126)。

228 的额外小型动物属于该次 Animals 行动；只有明确标注“行动完成后”的效果才应在行动完成、行动牌移到槽位 1 后执行。依据：[Glossary 第 6 页，228](https://cdn.shopify.com/s/files/1/0947/3907/1278/files/Ark-Nova-Glossary.pdf?v=1754428544#page=6)、[第 1 页，Order](https://cdn.shopify.com/s/files/1/0947/3907/1278/files/Ark-Nova-Glossary.pdf?v=1754428544#page=1)。

代码先结束 Animals 行动，再把 `small_program` 放入与动物“行动结束后”能力相同的可排序效果组。

复现：场上已有 228；打出 430 倭河马，填满唯一空围栏。此时程序已将 Animals 移到槽位 1，并允许先执行倭河马的额外 Sponsors 行动。通过 211 欧洲专家建造免费 1 格围栏后，再回到 228 的选择，把 445 冠豪猪放入刚建的围栏。按照上述官方时序，额外小动物应先于这次 Sponsors 行动结算，此时没有可入住围栏。

应在原 Animals 行动内完成 228 的额外出牌及展示区取牌，再统一处理真正的行动结束后效果。

## 6. [P2] 标志性动物提前锁定图标数量，漏算同批效果新增的图标

**位置：** [_animal_effect_refs 的 metric_value 快照](/Users/minimax/Desktop/OpenBoardGame/game/ark_nova.py:2081)、[优先使用快照计算奖励](/Users/minimax/Desktop/OpenBoardGame/game/ark_nova_effects.py:794)。

官方允许同一时间发生的奖励和效果自行排序，253 霍加狓馆允许在获得食草图标时立即付钱打出赞助商。依据：[Glossary 第 1 页，Order；第 7 页，253](https://cdn.shopify.com/s/files/1/0947/3907/1278/files/Ark-Nova-Glossary.pdf?v=1754428544#page=1)。本条关于最终数量的判断，是将这些时序条款应用于 436 标志性动物效果所得的结论。

复现：打出 436 美洲野牛后，全桌有 5 个美洲图标；先选择 253 的触发，打出 210 美洲专家，图标总数增至 6；再结算野牛的标志性动物。实际只增加 5 吸引力，应增加 6，且未触及 8 的上限。

原因是野牛刚入场时就把图标总数写入效果参数，之后玩家选择的效果顺序无法改变该值。修复时应在该能力实际执行时计数，同时保留“前一张动物全部即时效果完成后，才打下一张动物”的顺序约束。本轮未将其他使用 `metric_value` 的能力一概认定为已复现缺陷。

## 验证记录

审计时、修复前的 Ark Nova 测试：196 条全部通过，尚未覆盖以下组合。

```sh
/usr/bin/python3 -m unittest discover -s tests -p 'test_ark_nova*.py'
```

新增 [复现脚本](/Users/minimax/Desktop/OpenBoardGame/tmp/ark_nova_audit_20260921.py) 在内存中构造必要局面，再通过 `ArkNovaGame.apply_action` 执行动作和选择；奖励池案例另检查正常初始化，并直接触发保育跨格奖励。7 个场景对应以上 6 类问题，全部复现。原始结果见 [JSONL](/Users/minimax/Desktop/OpenBoardGame/tmp/ark_nova_audit_20260921.jsonl)。

```sh
PYTHONPATH=. /usr/bin/python3 tmp/ark_nova_audit_20260921.py
```

注意：该脚本断言的是审计当日的错误表现，用于保存缺陷证据；修复时应将这些场景转换为断言正确规则行为的正式回归测试。

## 修复回填：2026-09-22

| 问题 | 修复后的行为 |
|---|---|
| 偷窃 2 卡局 | 每次选择激活时重新读取目标资源；首次偷走最后一张手牌后，第二次可交出剩余的 0–4 钱；首次交钱后不足 5 钱时，只提供交牌。已停在旧错误选择上的存档也会刷新 |
| 保育奖励池 | 恢复基础版 9 块：2 声望、10 钱、免费 3 格围栏、倍增、3 X、取 3 张牌、大学、伙伴动物园、付钱打出赞助商。取牌逐张选来源，保留展示区空位；协会奖励使用公共库存、地图升级限制及原有图标触发；赞助商只从手牌打出并按卡牌等级付费。催眠借用 Association 时，地图限制按借用牌面判断，见后续更正 |
| 重复毒液 / 缠绕 | 只检查规则指定的槽位，丢弃重复标记，不继续寻找其他牌；说明生成器、卡牌 JSON 和卡牌目录已同步更新 |
| 263 免费围栏 | 后端从卡牌效果定义取得固定的建筑类型与尺寸；原前端不含 `size` 的合法提交现在成功，客户端也不能把奖励替换成较小建筑 |
| 228 小型动物计划 | 额外动物及展示区取牌在原 Animals 行动内完成；其自身的“行动结束后”能力也统一延后。每次倍增子行动各自完成小型动物计划，再进入下一次行动 |
| 标志性动物计数 | 在能力实际执行时读取图标数量，可看见先执行的同时触发效果新增的图标；继续保持逐张动物完整结算，避免第一张错误计入随后打出的第二张 |

奖励含义同时核对了 [官方 Icon Overview](https://cdn.shopify.com/s/files/1/0947/3907/1278/files/Ark-Nova-Icon-Overview.pdf?v=1754428545)：付钱打出赞助商的费用是卡牌等级，赞助商行动牌不移动。

存档版本更新至 4。旧存档中尚未领取的 `card_2 / worker / appeal_5 / upgrade` 分别替换为 `card_3 / university / partner_zoo / sponsor`；已领取奖励不回滚。旧版已经结束 Animals 并打开的小型动物计划选择，允许完成已获得的那次奖励；新生成的选择均使用修正后的行动内时序。

正式验收使用 [test_ark_nova_audit_regressions.py](/Users/minimax/Desktop/OpenBoardGame/tests/test_ark_nova_audit_regressions.py)，不再运行断言旧错误表现的临时审计脚本。新增 23 条测试涵盖原 6 类复现、资源耗尽、重复双标记、奖励合法性和库存、AI 选择、旧存档、倍增行动及后续动物图标隔离。

```text
/usr/bin/python3 -m unittest discover -s tests -p 'test_ark_nova*.py'
Ran 219 tests in 2.100s
OK
```

最终差异通过 `git diff HEAD --check` 检查。263 的界面问题通过实际浏览器提交格式的后端集成路径验证；本轮没有改动界面布局，也未运行浏览器点击测试。

# 2026-09-22：行动奖励、催眠、免费建筑与休息触发复核

本轮在上一轮 219 项测试通过的基础上，继续核对基础版、Map 0 的组合规则。确认并修复以下 5 类新偏差，使用正式 `apply_action` / `resolve_choice` 流程构造回归，不以临时脚本中的旧错误表现作为验收标准。

## 1. 协会板块奖励与图标效果不能自由排序

- 复现：声望 9、Cards I，取得第二所大学，选择印有 1 研究与 2 声望的大学。原实现先发声望再提供升级，声望被截在 9；正确顺序允许先用第二所大学的奖励升级 Cards，再得到声望至 11及声望轨的保育奖励。
- 第三所大学的 2 保育、研究图标触发，以及伙伴动物园的地图奖励也适用同一规则。例如第二个亚洲伙伴可先触发亚洲专家建亭、取得覆盖奖励，再决定升级哪张行动牌。
- 修复：大学与伙伴动物园的同时奖励组成可排序效果组；升级选择在实际弹出时刷新，避免前一个声望奖励已升级的行动牌仍出现在后续升级选项中。
- 依据：[Rulebook 第 14 页](https://capstone-games.com/cdn/shop/files/Ark-Nova-Rulebook.pdf?v=15269496103518830006#page=14)协会板块及地图奖励；[Glossary 第 1 页 Order](https://cdn.shopify.com/s/files/1/0947/3907/1278/files/Ark-Nova-Glossary.pdf?v=1754428544#page=1)同时奖励顺序。

## 2. 催眠借用 Association II 仍被自己的未升级牌限制

- 复现：自己 Association I、已有两个伙伴动物园，催眠借用对手 Association II 做伙伴任务。原代码同时要求自己的行动牌已升级，错误拒绝第三个伙伴。
- 修复：普通协会任务按本次实际使用的行动卡等级判断；借用 II 可取第三个伙伴，借用 I 即使自己的牌已升级也不能取。本次借用行动中取得的保育奖励同样使用借用卡面；借用其他行动时才检查自己的 Association。已更正上一轮两条反向断言这一规则的旧回归。
- 依据：[Glossary 第 2–3 页 Hypnosis](https://cdn.shopify.com/s/files/1/0947/3907/1278/files/Ark-Nova-Glossary.pdf?v=1754428544#page=2)规定整次借用行动使用对方卡面，并以建造升级格与第三伙伴限制分别举例。本项将同一条款应用于借用 Association II 的情形。

## 3. 专家奖励可被提交参数替换成其他免费建筑

- 复现：211 欧洲专家奖励免费 1 格标准围栏，但提交 5 格围栏的位置和尺寸会被成功接受；210、213 的亭子奖励同样存在客户端覆盖建筑类型的路径。
- 修复：效果层从卡牌定义锁定建筑类型和围栏尺寸，玩家只选择放置位置。正常浏览器不附带 `size` 的提交继续有效，错误建筑或尺寸不能改变卡牌奖励。
- 依据：[Glossary 第 5 页 210、211、213](https://cdn.shopify.com/s/files/1/0947/3907/1278/files/Ark-Nova-Glossary.pdf?v=1754428544#page=5)各专家卡的固定建筑奖励。

## 4. 偷窃平局不能选择自己的动物园

- 复现：自己与对手并列最高吸引力或保育时，目标列表预先排除了自己，只能偷取对手；偷窃 2 也无法让其中一个平局分支选择自己而不生效。
- 修复：平局目标保留自己的动物园；选自己时仅该次偷窃不生效。独占榜首的自己仍直接跳过，两个榜单分别选择和结算。
- 依据：[Glossary 第 3 页 Pilfering](https://cdn.shopify.com/s/files/1/0947/3907/1278/files/Ark-Nova-Glossary.pdf?v=1754428544#page=3)允许在并列动物园中决定受影响者，自己受影响时能力不生效。

## 5. 休息期间的非洲专家效果延迟到下一玩家回合

- 复现：已有 206+214、保育 4，休息收入到保育 5 后领取非洲伙伴动物园；或通过收入奖励打出 214。原实现把“机灵”加入行动结束队列，但休息期间没有对应的行动结束节点，导致下一位玩家完成行动后才弹出上一位玩家的选择。
- 修复：休息期间获得图标触发的效果在此次休息内完成；通常回合仍保持行动结束后的时序。测试分别覆盖触发休息者与其他玩家，并确认后继回合没有遗留选择。
- 依据：[Glossary 第 1 页 Order、第 5 页 214](https://cdn.shopify.com/s/files/1/0947/3907/1278/files/Ark-Nova-Glossary.pdf?v=1754428544#page=5)及 [Rulebook 第 18–19 页](https://capstone-games.com/cdn/shop/files/Ark-Nova-Rulebook.pdf?v=15269496103518830006#page=18)。休息中已不存在尚未完成的行动，因此应在休息中结算；不能把延迟效果转移到后续玩家的行动。

## 文档整理

按用户要求，原 `rule_audit_20260921.md` 已全文并入本文件并移除独立文档。历史规则依据、复现和修复回填均保留；本轮及后续审计继续写在本文件。早期 `designs/arknova_bugfix.md` 是 UI/交互修复历史，仍通过链接指向本规则审计文件。

## 本轮验证

此阶段新增 22 项正式回归测试，并更正 2 项旧断言：

- `tests/test_ark_nova_actions_audit_20260922.py`：10 项，覆盖大学及伙伴奖励排序、升级选项刷新、催眠借牌等级。
- `tests/test_ark_nova_effect_audit_20260922.py`：10 项，覆盖免费建筑协议、可跳过、偷窃两个榜单的平局选择及非法选择原子性。
- `tests/test_ark_nova_lifecycle_audit_20260922.py`：2 项，分别覆盖休息中的伙伴图标与新打出赞助商，各含休息触发者/其他玩家两个子场景。

以下是增加最后一项催眠捐赠回归之前的阶段检查；包含该测试与逐牌测试的最终结果见下一节。

```text
/usr/bin/python3 -m unittest discover -s tests -p 'test_ark_nova*.py'
Ran 240 tests in 2.258s
OK
```

所有 Ark Nova 相关变更通过 `git diff --check`。本轮未改变前端布局，免费建筑兼容性通过浏览器实际提交格式的后端回归验证；未进行浏览器点击测试。

另以正常 `ArkNovaGame.bot_move` / `apply_action` 完整运行 2、3、4 人对局，均自然结束，无非法行动或选择卡死：

| 人数 | 种子 | 决策次数 | 休息次数 | 最终分数（座次顺序） |
|---|---|---|---|---|
| 2 | 922 | 212 | 7 | -32 / 16 |
| 3 | 923 | 249 | 8 | -33 / -10 / 11 |
| 4 | 924 | 245 | 9 | -45 / -27 / 10 / -27 |

完整对局是流程补充检查，不代替以上定向规则回归，也不表示已穷尽所有卡牌组合。

# 2026-09-22：128 张动物、11 张终局与 32 张保护项目逐牌复核

## 范围与核对方式

按用户补充要求，本阶段重点复核全部 **171 张**指定卡牌，而非只检查已经被报告的动物。范围仍是原始基础版、Map 0、多人规则；未套用《海洋世界》替换卡数值，也未将动物牌蓝色单人替代效果用于多人对局。

| 牌类 | 覆盖 | 核对字段与行为 |
|---|---|---|
| 动物 | 401–528，128 张 | 费用、标准尺寸、特殊馆类型与占用量、水岩、72 项打出条件、255 项右上角标签记录及各自次数、吸引力/保育/声望、126 个能力实例的标识、参数和时序 |
| 终局 | 001–011，11 张 | 原始基础版门槛、统计对象、四种地图条件、右邻比较的七种动物类别及 4 分上限；逐个数值边界比较核心与独立效果 API |
| 保护项目 | 101–132，32 张 | 标签、每档要求和奖励、放归印刷尺寸、繁育动物与对应大洲伙伴、手牌打出后的立即支持、新项目奖励、重复支持与例外 |

动物逐张查看印刷卡图，并与独立社区转录逐字段比较。终局与项目逐张比较独立转录，再按官方术语表、规则书和扩展替换清单复核规则；**没有将这一部分描述成逐张目视核验 43 张完整扫描卡图**。独立期望值保存在测试 fixture 中，不从本地生成器直接复制作为期望；逐牌阅读表继续由 `card_catalog.md` 展示，本审计说明统一保存在当前文件。

依据与版本：

- [官方规则书](https://capstone-games.com/cdn/shop/files/Ark-Nova-Rulebook.pdf?v=15269496103518830006)、[术语表](https://cdn.shopify.com/s/files/1/0947/3907/1278/files/Ark-Nova-Glossary.pdf?v=1754428544)、[FAQ v2](https://cdn.shopify.com/s/files/1/0947/3907/1278/files/Ark-Nova-FAQ-v2.pdf?v=1754428544)，以及[海洋世界替换清单](https://capstone-games.com/cdn/shop/files/AN_Exp1_Rules_EN_0-7_low.pdf?v=3049443834535182443)。规则裁决以官方正文和印刷卡面为准。
- [动物印刷扫描图](https://github.com/PixelT/ArkNovaCardsManager/tree/67686265a98d423c6182dda63d967cdd92ffeb85/src/images/animal)，固定提交 `67686265a98d423c6182dda63d967cdd92ffeb85`；结构化转录仅用作辅助。
- 独立 [Animals.ts](https://github.com/Ender-Wiggin2019/Next-Ark-Nova-Cards/blob/6f67a11b9a038d75bb327cd1abfe20165d6c0055/src/data/Animals.ts)、[Projects.ts](https://github.com/Ender-Wiggin2019/Next-Ark-Nova-Cards/blob/6f67a11b9a038d75bb327cd1abfe20165d6c0055/src/data/Projects.ts)、[EndGames.ts](https://github.com/Ender-Wiggin2019/Next-Ark-Nova-Cards/blob/6f67a11b9a038d75bb327cd1abfe20165d6c0055/src/data/EndGames.ts)，固定提交 `6f67a11b9a038d75bb327cd1abfe20165d6c0055`，终局采用原始基础版数组。

## 本阶段发现与修复

| 问题 | 修复及影响 |
|---|---|
| **482 森蚺把爬行馆容量误读成岩石条件** | 卡面为标准围栏 2、临水 1，或爬行馆占用 1；没有临岩要求。修正 `4.rule.md`、结构化纠错记录和旧测试，再重新生成 JSON。实际在临水、不临岩的围栏出牌成功，仍拒绝干燥围栏；打出后获得水域标签而不虚增岩石标签，避免影响 010、129 等统计。早期审计中的相反判断已就地标明更正。 |
| **萌宠标签在前端显示为默认菱形** | 数据用 `petting_zoo_animal`，前端只映射了旧别名 `petting_zoo`。补齐正式标签的图标映射，并更新脚本缓存版本。10 张萌宠现在都能显示对应标签；本阶段没有发现入住引擎新的同类缺陷，但对 519–528 全部补了场馆类型和容量回归。 |
| **475 / 485 逐牌中文仍说“立即执行，然后继续结算本动物”** | 核心和共享规则已处理延后执行，但卡牌原始说明与能力文字没有同步。现统一写明先确定目标，当前行动完成并移动牌后再选择借用行动，按该牌当前 I／II 面执行，执行后移到槽位 1。依据术语表 pp.2–3 Hypnosis。 |
| **101–112 元数据错误标记不能从手牌支持** | 断言/优势可让未使用的基础项目进入手牌，随后必须打出并立即支持；原核心路径已可执行，但 `may_support_from_hand` 和 `must_support_immediately_when_played` 错为 false。生成器改为 true，全部 32 张逐档经正式动作验证。依据术语表 pp.1–2 Conservation projects、Assertion / Dominance。 |
| **004 独立计分 API 的无缓存分支没有排除已覆盖水岩** | 正常对局的派生地图条件已正确；独立 API 直接计算时却继续要求 219 已覆盖的水岩邻接建筑。补齐过滤并同步卡牌规则说明，核心与无缓存计算一致。依据术语表 p.5 的 219 与 p.8 的 004。 |
| **独立项目效果 API 可重复支持同一项目的不同档** | 正常对局已有此限制；补齐独立 API 的同玩家重复支持校验，保留 224 对放归项目的例外，额外保育也统一读取生效中的规则。拒绝重复支持不会改变状态。此 API 的地图奖励与标记消费仍由核心流程管理，未将它扩展成完整动作入口。 |

## 专项核对结论

### 研究、声望、标签与入住

- 11 张带研究条件的动物使用 `science` 计数，声望奖励使用 `reputation`；两组动物 fixture 分别核对这些字段，条件测试逐项降到门槛以下，后 64 张还固定声望为 15，确认声望不能代替研究。前端实际格式化函数仍分别显示 🔬 与 🎓。
- 右上角标签共 255 条记录、计入重复图标后 263 枚；复核七种动物类别和五大洲，包含双图标。条件区的研究/动物/大洲条件不能被当作卡牌新增图标。
- 519–528 共 10 张萌宠，每张只能入住萌宠园并占 1 格；有空位可打出、满园拒绝，普通围栏/爬行馆/大型鸟类馆均不能代替。521 的奖励是声望，522、524、528 的额外能力仍与萌宠递增吸引力分别处理。
- 128 张动物的全部 **164 个牌面场馆选项**均经动作 JSON schema 和真实 `ArkNovaGame.apply_action` 打出，确认牌从手牌进入动物园、正确记录占用量。此测试用 219 排除水岩干扰以单独验证协议和入住；水岩期望由独立牌面 fixture 及 482 正反实打案例验证，不宣称 164 个场景覆盖了每种地图位置。测试启用效果排序，部分案例在奖励/能力待选处停止，因此它不单独证明每张牌的所有能力已完整结算；能力参数及时序由独立字段断言及专项效果回归验证。
- 额外调用实际前端函数，对 128 张动物与不同类型/容量建筑进行 **2,048 次**前后端合法性比较，全部一致；所有标签均有具体图标映射，10 张萌宠说明均为萌宠园 1 格且没有标准围栏选项。该检查不等同于浏览器逐张点击测试。

### 终局计分

本次没有发现需要改变的原版数字门槛。独立 fixture 固定如下数据，并测试每个阈值上下界：

| 牌号 | 统计项 | 1 / 2 / 3 / 4 保育门槛 |
|---|---|---|
| 001 | 大型动物 | 1 / 2 / 4 / 5 |
| 002 | 小型动物 | 3 / 6 / 8 / 10 |
| 003 | 研究图标 | 3 / 4 / 5 / 6 |
| 005 | 已支持项目 | 3 / 4 / 5 / 6 |
| 006 | 未覆盖可建造格 | 6 / 12 / 18 / 24 |
| 007 | 声望 | 6 / 9 / 12 / 15 |
| 008 | 赞助商 | 3 / 6 / 8 / 10 |
| 010 | 岩石图标 | 1 / 3 / 5 / 7 |
| 011 | 水域图标 | 2 / 4 / 6 / 8 |

004 使用四项地图条件，已覆盖的水岩不参加相邻条件；009 与右手边玩家比较全部七种动物类别，必须严格多于对方，每胜一类 1 保育，最多 4。

### 保护项目

- 101–112 按各自类别、大洲及独立印刷档位核对，不把不同项目的 5/3/2 与 5/4/2 奖励混用。101/102 统计不同动物类别/大洲种类数，不是同一种的总图标数。
- 113–122 依次为欧洲、美洲、亚洲、非洲、澳洲、猛兽、鸟类、食草类、爬行类、灵长类；按卡牌印刷标准尺寸 4–5 / 3 / 1–2 得 5 / 4 / 3 保育，首次从手牌打出的新项目另得 1 声望。
- 123–127 依次为鸟类、猛兽、爬行类、食草类、灵长类；必须有该类动物及它对应大洲的伙伴动物园，仅有赞助商提供的类别图标不足。三档奖励分别是 2 保育+2 声望、1 保育+2 声望、2 保育。
- 128/129/130/131/132 依次统计水域、岩石、小型动物、大型动物、研究；17 张计数项目均逐档测试标签、门槛及奖励。32 张项目共 **96 次**正式支持动作覆盖从手牌打出、每档奖励、标记消费以及项目本身不增加动物园标签。

## 外部数据冲突与证据边界

- 463 的费用保持 11；PixelT 结构化数据的 14 与扫描牌面及另一转录不符，未照搬。464 不要求岩石，外部转录的非数值字段也未采用。
- 482 的独立转录存在地形漏项，因此必须看卡图确认临水 1；同样不能据本地旧测试坚持临岩 1。
- 131 的外部项目数据出现 Water 字段，以及放归项目外部数据漏记新项目的 1 声望，都未用于覆盖本地正确值。
- 462 扫描中的尺寸数字清晰度不足；两个独立结构化来源均为 3，本地维持 3。不能将该单个字段记成已由清晰扫描单独证明。
- 完成的是全部指定卡牌字段核对、各类规则边界及重点组合验证；并未穷尽所有牌序、地图位置和能力组合。赞助商的全部逐牌复核属于前述历史审计，本阶段没有重新声称完成另一次 64 张赞助商全字段扫描。

## 修复生成与最终验证

源数据改在 `designs/4.rule.md`、`scripts/arknova_card_reference.py` 和 `scripts/gen_arknova_cards_json.py`，统一运行生成器更新资产及 `card_catalog.md`；没有直接手改生成的 JSON。

本阶段新增 24 项测试（包含上述大量逐牌子场景）：

- `tests/test_ark_nova_animals_401_464_reference.py`：5 项，独立前 64 张字段、条件及重点能力。
- `tests/test_ark_nova_animals_465_528.py`：9 项，独立后 64 张字段、条件反例、482 实打、10 张萌宠与催眠文字。
- `tests/test_ark_nova_animal_play_contracts.py`：1 项，128 张动物的 164 个场馆选项逐一走真实出牌入口。
- `tests/test_ark_nova_projects_final_card_audit.py`：9 项，全部 43 张项目/终局、计分边界和 96 次正式支持动作。

```text
python3 scripts/gen_arknova_cards_json.py
128 animal_cards / 32 conservation_projects / 11 final_scoring_cards

python3 -m unittest discover -s tests -p 'test_ark_nova*.py'
Ran 265 tests in 5.052s
OK

node --check static/games/ark_nova.js
通过

实际前端函数交叉检查：128 动物 / 2048 场馆比较 / 255 标签映射
10 张萌宠场馆说明及研究、声望图标区分：通过
```

本次两阶段合计新增 46 项测试，修改了旧错误断言；最终全量为 265 项。Ark Nova 相关修改通过 `git diff --check`。先前 2/3/4 人完整 Bot 对局结果见上一节。未运行与 Ark Nova 无关的全仓测试；前端没有布局改动，本阶段验证了真实格式化/候选函数，未进行浏览器逐张点牌。
