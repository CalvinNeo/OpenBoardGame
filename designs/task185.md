# Task 185: Help / Explain 全量整改计划

## 1. 背景

`DEV_GUIDE.md` 要求所有游戏支持 Help 与 Explain，并严格遵守 `designs/task40.md`。现状是 118 个已注册游戏中，Help 的实现质量差异极大：少数游戏（lost_code、terra_nova、project_l）达到甚至超过规范，绝大多数只做到"有个弹窗"，还有 16 个完全没有 Help 入口。

本任务以 task40 的六条 Help 要求为验收基线，定义统一实现，并按批次推进修复。

## 2. 验收基线（task40.md 的六条 Help 要求）

| 编号 | 要求 |
| --- | --- |
| R1 | 支持中文和英文，可通过顶层的按钮切换 |
| R2 | 严格禁止用分号串联碎短句，要说前后贯通的句子 |
| R3 | 先讲基本规则便于快速上手，再讲进阶规则；基本规则各用一句话讲明：靠比什么赢、每回合到底能做什么、玩这个游戏的重点 |
| R4 | 游戏中使用的图标 / emoji，在讲解中必须括弧在其名字后面，如 `Gold(💰)` |
| R5 | 机制复杂的卡牌 / 效果 / 奖励等，应有专门章节讲解 |
| R6 | 玩法讲解较长时，顶部引入 tab 方便切换章节 |

Explain 部分（task40.md 另有规定）同样纳入整改：
- 有解释的按钮：虚线高亮 + 问号光标，点击显示说明。
- 无解释的按钮：外观与光标不变，点击不触发原功能。
- 已 disabled 的按钮：仍可点击查看解释（需 `pointerdown` + 坐标检测）。
- 退出：点击有解释的按钮后自动退出，或按 ESC。

## 3. 现状审计（2026-11-08）

统计口径：`static/game_assets.js` 中已注册的 118 个有 JS 的游戏。审计脚本见 `tmp/audit_req.py`。

| 编号 | 要求 | 达标 | 缺失 | 缺失率 |
| --- | --- | --- | --- | --- |
| R1 | 中英文切换 | 2 | 116 | 98% |
| R2 | 无分号串联碎短句 | 52 | 66 | 56% |
| R3 | 基本规则三句齐全 | 1 | 117 | 99% |
| R4 | emoji 括弧命名 | 63 | 55 | 47% |
| R5 | 复杂机制专门章节 | 12 | 106 | 90% |
| R6 | 章节 tab | 2 | 116 | 98% |
| — | Help 入口 | 102 | 16 | 14% |
| — | Explain 模式 | 105 | 13 | 11% |

### 3.1 结论

R1 / R3 / R6 是**全局性缺失**（缺失率 98%–99%），不是个别游戏的问题。R2 / R4 / R5 是**文案层缺失**，随重写文案一并解决。

因此整改策略是：先用共享模块把 R1 / R6 一次性做对，再通过重写文案解决 R2 / R3 / R4 / R5。

### 3.2 分层

按 Help 现状把 118 个游戏分为四层：

| 层 | 定义 | 数量 |
| --- | --- | --- |
| T1 | 完全没有 Help 入口 | 16 |
| T2 | Help 极薄（<600 字符） | 14 |
| T3 | Help 中等（600–3000 字符） | 66 |
| T4 | Help 大型（>=3000 字符） | 22 |

各层缺失情况：

| 层 | R1 双语 | R2 分号 | R3 基本三句 | R4 emoji | R5 专章 | R6 tab |
| --- | --- | --- | --- | --- | --- | --- |
| T1 | 16 | 3 | 16 | 14 | 15 | 16 |
| T2 | 14 | 0 | 14 | 14 | 14 | 14 |
| T3 | 66 | 43 | 66 | 24 | 57 | 66 |
| T4 | 20 | 20 | 21 | 3 | 20 | 20 |

### 3.3 名单

**T1 完全无 Help（16）**
`aidixit`、`blitz_sketch`、`cabo`、`castles_of_burgundy`、`coyote`、`cyber_pictures`、`draw_guess`、`dune_imperium`、`flip7`、`halli_galli`、`hive`、`impression_flower`、`kobayakawa`、`perfect_mismatch`、`skull`、`splendor`

**T2 极薄（14）**
`bomb_busters`、`carcassonne`、`cat_in_box`、`compress`、`decrypto`、`emerald_skulls`、`guandan`、`isle_of_skye`、`nine_upper`、`poison`、`splendor_pokemon`、`tacta`、`turing_machine`、`wriggle_roulette`

**T3 中等（66）**
`a_feast_for_odin`、`abraca_what`、`acquire`、`age_of_war`、`ark_nova`、`azul`、`blokus`、`bohnanza_dice`、`catan_starfarers`、`celestia`、`century_spice_road`、`challengers`、`chromino`、`citadels`、`cryptid`、`dare_words`、`davinci_code`、`deception`、`dumb_questions`、`eternal_decks`、`exploding_kittens`、`fake_artist`、`fang_niao`、`felix`、`gizmos`、`gold_rush`、`grand_austria_hotel`、`hanabi`、`high_society`、`hot_streak`、`in_a_grove`、`incan_gold`、`istanbul`、`kronologic`、`love_letter`、`mall_of_horror`、`maskmen`、`moshimo_yusha`、`natsumemo`、`no_thanks`、`orloj`、`patchwork`、`point_salad`、`pokemon_adventure`、`ponzi_scheme`、`power_grid`、`ra`、`rebel_princess`、`red_doors`、`sagrada`、`scout`、`semantic_guess`、`six_nimmt`、`skull_king`、`startups`、`subtext`、`tagiron`、`texas_holdem`、`the_mind`、`things_in_rings`、`ticket_to_ride`、`tucano`、`wandering_towers`、`wavelength`、`witchs_brew`、`word_decode`

**T4 大型（22）**
`boomerang_australia`、`cheaty_mages`、`colt_express`、`criminal_dance`、`dice_throne`、`dnd_starter_set`、`for_sale`、`forest_shuffle`、`gaia_project`、`gloomhaven`、`las_vegas`、`lost_code`、`manila`、`mind_the_lines`、`night_of_the_ninja`、`project_l`、`spirit_island`、`take_time`、`terra_nova`、`the_crew`、`word_sync`、`yahtzee`

### 3.4 参考实现

- `static/games/project_l.js`：task40.md 指定的参考实现，Explain 三类行为完整。
- `static/games/terra_nova.js`：章节 tab 实现（R6）。
- `static/games/lost_code.js`：中英文切换实现（R1）。
- `static/games/hanabi.js`：emoji 括弧命名规范（R4），如 `Red (🔴)`、`Score (⭐)`。

## 4. 统一实现约定

### 4.1 共享模块 `static/games/shared_help.js`（样式并入 `static/style.css`）

**`obgCreateHelp(config)`**

`config` 结构：
```js
{
  gameId: "hanabi",
  title: { zh: "花火", en: "Hanabi" },
  basic: {
    zh: { win: "...", turn: "...", key: "..." },   // R3 三句
    en: { win: "...", turn: "...", key: "..." }
  },
  sections: [                                        // R5 / R6
    { id: "basic",   zh: "基本规则", en: "Basics",   zhHtml: "...", enHtml: "..." },
    { id: "cards",   zh: "卡牌",     en: "Cards",    zhHtml: "...", enHtml: "..." }
  ]
}
```

行为：
- 顶部渲染语言切换按钮（R1），状态存 `localStorage`，默认中文。
- 章节数 >= 3 时顶部自动渲染 tab（R6）；章节少时平铺。
- 「基本规则」章节固定在最前，渲染 R3 的三句。
- 统一弹窗结构，Esc 关闭。

**`obgCreateExplain(config)`**

`config` 含 `explanations`（选择器 -> 说明）与 `bypass`（Help / Explain / 关闭按钮）。

行为严格按 task40：
- 进入模式时给命中元素加 `has-explanation` class，**仅该 class** 设 `cursor: help` 与虚线框。
- 捕获阶段（`addEventListener(..., true)`）拦截 click，使无解释元素不触发原功能。
- `pointerdown` + `getBoundingClientRect` 坐标检测，使 disabled 元素仍可解释。
- 点击有解释元素后自动退出；Esc 退出。

### 4.2 文案约定

- **R2**：禁止 `；` / `;` 串联碎短句。一句话一个意思，用句号断开。
- **R3**：每种语言都必须有三句：赢的条件、回合行动、重点。缺一不可。
- **R4**：所有图标写作 `名称(emoji)`，emoji 紧跟名称后的括号内。
- **R5**：卡牌 / 效果 / 奖励复杂时，独立成一个 section。
- **R6**：sections 数量 >= 3 时自动出 tab，由共享模块保证。
- 中英文两套文案都必须完整，不允许英文留空或只写标题。

## 5. 逐批修复计划

### 第 0 批：地基

**目标**：把 R1 / R6 一次性做对，后续批次只需提供文案。

- 新增 `static/games/shared_help.js`，实现 4.1 两个工厂。
- 在 `static/game_assets.js` 注册为所有游戏的公共前置脚本。
- 新增 `tests/test_help_contract.py`，静态校验每个注册游戏：
  - 声明了 Help / Explain 配置。
  - `basic` 三句齐全（中英各三句）。
  - 双语 sections 无空缺。
  - Help 文案无分号串联。
  - 出现的 emoji 均有括弧命名。
- 试点：先在 `hanabi`、`love_letter`、`skull` 三个游戏上接入验证，确认无回归后再全量迁移。

**验收**：`python -m unittest tests.test_help_contract` 通过；`tests/game_assets.browser.cjs` 通过。

**状态：已完成。**

- `static/games/shared_help.js` 提供 `obgCreateHelp` / `obgCreateExplain`。
- 样式并入 `static/style.css`（项目约定首页只允许一个 `coreStyles` link，不能直接 link `games/*.css`）。
- `tests/test_help_contract.py` 覆盖 R1 / R2 / R3 / R4 / R6 与 Explain 键覆盖，共 11 项。
- `tests/shared_help.browser.cjs` 做浏览器验收（本机需 `PLAYWRIGHT_MODULE`）。
- 试点 `skull` 已完成并通过真机验证：双语切换、4 个 tab、基本三句、Explain 三类行为、Esc 退出、320px 无横向溢出。
- 接入指南见 `designs/help_explain_guide.md`。

### 第 1 批：T1 补齐 13 个完全缺失的游戏

审计修正：`castles_of_burgundy`、`dune_imperium`、`hive` 实际已有 Help（按钮 ID 命名不同导致早期误判），不在本批。

本批名单：`aidixit`、`blitz_sketch`、`cabo`、`coyote`、`cyber_pictures`、`draw_guess`、`flip7`、`halli_galli`、`impression_flower`、`kobayakawa`、`perfect_mismatch`、`skull`、`splendor`

- 从零接入 `obgCreateHelp` / `obgCreateExplain`。
- 六条要求全部满足。
- 缺口最大、收益最直接，优先做。
- 批量验收脚本：`tmp/verify_t1.py`。

### 第 2 批：迁移 13 个轻量旧实现

原计划按"Help 文案长度"分层，实测发现静态审计无法可靠衡量旧实现（文案散在函数、模板与数据文件里）。
改用 **Help 实现代码量** 作为迁移复杂度代理，取最小的一批先做。

本批名单：`eternal_decks`、`ponzi_scheme`、`chromino`、`take_time`、`hive`、`dare_words`、`skull_king`、`moshimo_yusha`、`the_mind`、`incan_gold`、`word_sync`、`natsumemo`、`dune_imperium`

- 这些游戏都已有自己的 Help/Explain，属于**迁移**而非新建，风险点是删除旧实现时不能破坏 tooltip 与游戏逻辑。
- 其中 `eternal_decks`、`ponzi_scheme`、`chromino`、`take_time` 的 Help 按钮在 `static/index.html` 而非各自模板，迁移时只读 id，不改 index.html。
- 迁移指南见 `designs/help_migration_guide.md`。
- 批量验收脚本：`tmp/verify_batch2.py`。

**进度：13 个中完成 10 个。**

已完成并通过浏览器验证：`eternal_decks`、`ponzi_scheme`、`hive`、`dare_words`、`skull_king`、`moshimo_yusha`、`the_mind`、`incan_gold`、`word_sync`、`natsumemo`

未完成：`chromino`、`take_time`、`dune_imperium`（委派任务因计算预算耗尽中断，文件保持原状未损坏，下次继续）

### 迁移过程中发现并修复的地基缺陷

共享模块的 Explain 最初在 `pointerdown` 就立即触发，**移动端滚动会误开解释**，违反 DEV_GUIDE
「必须区分为了滚动的触碰，以及一个具有明显意图的点击动作」。已改为按下记录、抬起时校验移动距离
（容差 10px），并补了回归测试。修复后 13 个已迁移游戏全部复验通过。

**暂不迁移**：`no_thanks`。它的现有实现已包含完整手势识别、tooltip 与结构化 Explain，质量达标，
迁移收益低于风险。仅缺 R1/R3/R6，留待后续单独评估。其 Explain 文案可作为其他游戏文案质量的参照。

### 第 3 批：迁移其余旧实现

剩余约 91 个仍是旧实现的游戏，全部缺 R1 / R3 / R6，必须迁移到共享模块才能解决。
按 Help 实现代码量从小到大继续推进。

- 接入共享模块，保留可用文案，补双语与 tab。
- R2 缺失 43 个、R4 缺失 24 个、R5 缺失 57 个，逐个修文案。
- 按字母序切分，便于分工与进度跟踪。

### 第 4 批：T4 迁移 22 个大型 Help

`boomerang_australia`、`cheaty_mages`、`colt_express`、`criminal_dance`、`dice_throne`、`dnd_starter_set`、`for_sale`、`forest_shuffle`、`gaia_project`、`gloomhaven`、`las_vegas`、`lost_code`、`manila`、`mind_the_lines`、`night_of_the_ninja`、`project_l`、`spirit_island`、`take_time`、`terra_nova`、`the_crew`、`word_sync`、`yahtzee`

- 这批文案量大（ark_nova 5.5 万字符、terra_nova 5 万字符），**只做模块接入 + 补 R3 三句 + R6 tab**。
- R4 在这批基本已达标（仅 3 个缺失）。
- 长文不强制全量英译，英文可先给结构化摘要，但 R3 三句必须双语齐全。

### 第 5 批：Explain 行为一致性专项

对全部 118 个游戏逐个核对 task40 的四类行为（虚线高亮、无解释拦截、disabled 可解释、Esc 退出）。

### 第 6 批：终验

- 桌面端 1024 / 1440，手机端 320 / 390。
- Help 弹窗在 320px 下不横向滚动；tab 可横向滚动。
- 语言切换状态刷新后保持。
- 按 `DEV_GUIDE.md` 的 UI Acceptance Gate 记录检查项。

## 6. 测试与验收

每批改动后运行：

```bash
python -m unittest tests.test_help_contract
```

涉及全局加载器改动时追加：

```bash
python -m unittest tests.test_frontend_script_names tests.test_frontend_style_assets
```

资源版本号：修改 `static/game_assets.js` 对应条目的 `?v=`，以及 `static/index.html` 的加载器版本。

审计脚本：`tmp/audit_req.py`（六条要求逐条检查）、`tmp/tier.py`（分层）。

## 7. 风险

- **共享模块影响全部 118 个游戏**：第 0 批必须先在 3 个游戏试点，验证无回归再全量迁移。
- **长文案双语化成本高**：ark_nova / terra_nova / kronologic 等，第 4 批只接入不强制全译。
- **R3 文案需要游戏规则知识**：三句话必须准确，建议对照 `designs/` 下对应游戏的 taskxxx.md 撰写。
- **工作区已有大量未提交改动**：动手前先理清 `git status`，避免与既有改动冲突。
