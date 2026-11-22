# Task 184：胆敢造词（Dare to Make Words）

## 玩法方案

- 还原国产原创聚会桌游《胆敢造词》的经典竞速规则：牌堆里是单字卡，桌面上是公开字列，谁先只用桌面上的字凑出通顺词句谁得分。
- `2–8` 人。牌堆 `100` 张单字卡（可选 `60` 张短局），洗匀后背面朝上。
- 单字池新增 `200` 个不重复的常用汉字，与原有字种无重叠，涵盖代词、动词、形容词、自然、时间、身体、亲友、学习、生活、饮食和数字。Full / Short 仍使用 `100 / 60` 张：保留各自原牌堆里有重复的高频基础字及其张数，其余位置从该模式原有的单张字与新增字中不放回随机抽取，每局再洗牌。
- 翻牌权按座位顺时针轮转：轮到谁，谁翻开 1 张字卡接到桌面字列末尾，然后翻牌权交给下一位。
- 任何玩家（翻牌玩家也算）在 `flipping` 阶段随时可以抢答：提交一个只使用桌面字列、每个字卡最多用一次、至少 3 个字的词语/短语/短句。
- 抢答进入 `voting`：除抢答者外的所有玩家投「认可 / 不认可」。认可票多于不认可票才算成立（平票视为不成立）。
- 成立：抢答者收走这次用到的全部字卡作为分数（1 张 1 分），用过的字离开桌面，没用到的字留在桌上。
- 不成立：字卡全部留在桌面，抢答者进入冷却，要等桌上再翻出 1 张牌才能再次抢答（防止连续乱喊）。
- 每次结算后进入 `reveal`，展示词句、每人投票和得分变化；所有玩家点 Next 之后才继续（符合 DEV_GUIDE 的回合间暂停要求）。
- 结束条件：牌堆翻完且桌面剩余字不足 3 个（再也凑不出合法词句），或牌堆已空时任一玩家选择「结束本局」。字卡最多的玩家获胜，并列则共享胜利。

## 判定与校验

- 服务端只做客观校验：NFKC 规范化并去掉空白后，必须全部是汉字（`U+3400–U+4DBF`、`U+4E00–U+9FFF`）、长度 ≥ 3、字符多重集包含于桌面字列多重集。违反时返回具体原因，不消耗回合。
- 「是否通顺合理」完全交给玩家投票，服务端不判语义，也不做同音字替换。
- 抢答成功后按字符逐个占用最靠左的同字卡，保证每张字卡只被用一次。

## 状态与并发

- `phase`：`flipping` → `voting` → `reveal` → （`flipping` 或 `game_over`）。
- `window_id` 只在「桌面字列变化」或「阶段切换」时递增：翻牌、抢答、结算、Next。同一投票窗口内的多次投票和同一结算窗口内的多次 Next 不改变 `window_id`，避免并发投票被误判为过期动作。
- 投票期间只公开「已投 / 未投」人数，不公开他人票向；结算后才在 `last_result` 公开每人的选择。
- 存档校验牌堆 + 桌面 + 已用字卡的字符多重集必须等于初始牌堆，防止读档篡改。
- 随机组牌的新局保存私有 `initial_deck`，先检查其数量、各字张数和高频基础字是否符合字池，再作为存档字符守恒校验的基准；公开视图不下发该字段。没有此字段的旧存档仍严格按原固定牌堆校验，不给旧局补入新字。

## Bot

- 抢答：内置约 160 条 3–4 字常用词与成语词库，命中且未冷却时以约 70% 概率抢答；测试保证词库用字全部来自牌堆。
- 翻牌：轮到 Bot 翻牌且没有可抢答的词时翻牌。
- 投票：约 75% 投认可；结算页自动点 Next。
- `bot_move` 支持 `delay_ms`，让 Bot 有可观察的思考时间。

## 交付文件与显示约定

- 后端：`game/dare_words.py`；注册在 `game/definitions.py`、`game/__init__.py`、`game/tags.py`、`game/dev_order.json`；`app.py` 补 Bot 动作公开与重连跑 Bot 的名单。
- 前端：`static/games/dare_words.{html,css,js}`，接入 `static/game_assets.js`、`static/index.html`、`static/app.js`、`static/room.js`、`static/games/shared.js`。
- 界面主体是桌面字列；词句**只能靠点字卡拼出来**，没有任何输入框：点一次字卡接到词句末尾，再点一次同一张卡取回，已选字卡区里的字也能点掉，点击面板空白处清空全部，不提供 Clear Selection 按钮。已选区实时显示顺序号与字数校验，3–24 字之间抢答按钮才亮起。
- 房间设置：牌堆规模 `Full 100 / Short 60`，默认 Full。
- 图标：🀄 字卡、🗣 抢答、✅ 认可、❌ 不认可、🏆 获胜。Help 与 Explain 中同时给出符号与文字。

## 验收记录（2026-11-07）

- 修改文件：`game/dare_words.py`、`game/definitions.py`、`game/__init__.py`、`game/tags.py`、`game/dev_order.json`、`app.py`；`static/games/dare_words.{html,css,js}`、`static/game_assets.js`、`static/index.html`、`static/app.js`、`static/room.js`、`static/games/shared.js`；`tests/test_dare_words.py`、`tests/test_dare_words_integration.py` 和本方案。
- 定向回归：`python3 -m unittest tests.test_dare_words tests.test_dare_words_integration tests.test_prepared_game_initialization tests.test_frontend_script_names tests.test_frontend_style_assets tests.test_game_dev_order tests.test_game_names tests.test_game_tags tests.test_ai_metadata tests.test_bot_threading tests.test_word_sync tests.test_word_sync_integration`：87 项通过；`node --check`、`python3 -m compileall`、`git diff --check` 通过。
- 同批次 `tests.test_room_session` 有 11 项报错，全部来自并行会话新加的 `room_auth` 用例（`app.py` 尚未实现该字段），与本游戏无关。
- 真实服务端浏览器验证：建房 → 加 2 个 Bot → 开始 → 翻牌 → Bot 抢答 → 投票 → 结算 → Next → 自己点字卡拼词并抢答，全流程通过；控制台与网络无错误。
- 视口检查 320 / 390 / 1024 / 1440 px：合成视图覆盖 `flipping`、`voting`、`reveal`、`game_over` 四种阶段，均无横向溢出、无板块重叠；手机端字卡 46×60、桌面端 58×76，记分板手机 2 列。
- 交互检查：Help 弹窗、Explain 模式（点击后自动退出）、Esc 关闭、桌面悬停提示、点击空白清空选择、连点字卡（已修复原先整行重建导致连点失效与焦点丢失的问题）。
- 未检查：iOS / Android 真机；本机未安装 Playwright，多视口通过同源 iframe + 注入脚本测量完成，未生成 `tests/*.browser.cjs` 脚本。
- 保留例外：Room Controls 收起后的 Dock 悬浮在左侧边缘，可能盖住「翻牌」按钮左侧约 36px，这是全局 Dock 行为（`designs/room_control.md` 允许 dock 与其他板块重叠），按钮仍有可点区域。

## 去掉输入框，改为纯点选拼词（2026-11-11）

- 需求：抢答词句不再提供任何打字入口，点桌面字卡出什么就是什么。
- 界面：`dareWordsInput` 输入框删除，改为 `#dareWordsPhrase` 已选字卡区，按顺序显示选中的字和序号徽标；空时显示「点字卡拼出至少 3 个字」占位。凑够 3 字且不超过 24 字时整个区域转为绿色就绪态。
- 交互：点桌面字卡追加到末尾；再点同一张卡、或点已选区里的字都能取回；点面板空白处清空全部；超过 24 字时给出「最多 24 个字。」提示并且不再追加。没有 Clear Selection 按钮。
- 逻辑：`selection`（字卡 id 数组）成为词句的唯一来源，`phraseText()` 负责拼接；客户端只保留长度校验，用字合法性由「只能点桌面卡」天然保证，服务端仍做完整校验。
- 文案：Help 的「抢答与用字」与 Explain 的 `phrase` 条目同步改写，明确说明没有输入框；`data-dw-explain="input"` 改名为 `phrase`。
- 资源版本：`dare_words.js?v=3`、`dare_words.css?v=2`、`dare_words.html?v=2`，首页 `game_assets.js?v=253`。
- 验证：真实服务端跑通翻牌 → 点选拼词 → 抢答 → 表决；点 2 张卡时提示「至少 3 个字。」且按钮禁用，点第 3 张后按钮亮起并显示「✓ 3 个字，全部来自桌面」，点已选区的字可取回并重新编号，点空白处清空全部，抢答提交后服务端收到的词句与界面一致。
- 视口 320 / 390 / 1024 / 1440 px：均无横向溢出、无板块重叠；已选字卡在四档下都单行显示，手机端 36×36、桌面端 40×40；320px 页面高度由 833px 降到 780px（刚好一屏）。控制台与网络无错误。

## 开局可选最短词句 3 / 4 / 5 字（2026-11-18）

- 需求：原规则把「至少 3 个字」写死在代码里，现在改为开局可选 3、4、5 个字。
- 后端 `game/dare_words.py`：`MIN_PHRASE_CHARS` 常量换成 `MIN_PHRASE_CHOICES = (3, 4, 5)` 与 `DEFAULT_MIN_PHRASE_CHARS = 3`；`CONFIG_SCHEMA` 增加 `min_chars` 枚举；`init_game` 把 `config` 归一化为 `{deck_size, min_chars}` 并写入 `state["min_chars"]`，非整数或越界值直接抛错（挡住 JSON Schema 里 `3.0` 与 `true` 这类相等但类型不对的值）。
- 所有下限判定改为读状态：`validate_phrase`（报错文案「至少要用 N 个字。」）、`get_legal_actions`（桌面不足 N 张不能抢答）、`_is_game_over`（牌堆空且桌面不足 N 张才自动结束）、`get_public_view` 的 `min_chars`。
- 存档：`deserialize` 接受旧档（既无 `config.min_chars` 也无 `state.min_chars`）并归一化为 3；`config` 与 `state.min_chars` 不一致视为篡改。
- Bot：新增 `BOT_PHRASES_LONG`（10 条 5 字词组，仅在最短 5 字时启用，3 / 4 字局节奏不变），并给 `BOT_PATTERNS` 补 15 条 4–5 槽模板。补的模板里有一半不含动词槽，因此 60 张短牌堆（没有任何动作字）也能凑出 4 / 5 字词。词库与模板按 `len(phrase) >= min_chars` 过滤。
- 前端：房间设置新增「最短词句 Min chars」下拉（3 个字 · 经典 / 4 个字 / 5 个字 · 最难），`getDareWordsConfig()` 一并提交 `min_chars`；已选字卡区的占位文案改为按当前下限动态生成；Help 的流程与抢答章节、Explain 的 `claim` 条目改写为「房间设置选定的字数」。资源版本 `dare_words.js?v=5`、`dare_words.html?v=3`，首页 `game_assets.js?v=258`。
- 测试：`tests/test_dare_words.py` 新增下限门槛、结束阈值随下限变化、存档保下限与旧档归一化、3 / 4 / 5 × 全副 / 短副 Bot 对局不卡死且每次抢答都不短于下限；`tests/test_dare_words_integration.py` 新增开局下发 `min_chars=5` 后 4 字抢答被拒、5 字抢答进入表决、`min_chars=6` 开局失败。

### 验收记录（2026-11-18）

- 修改文件：`game/dare_words.py`、`static/games/dare_words.{html,js}`、`static/game_assets.js`、`static/index.html`、`tests/test_dare_words.py`、`tests/test_dare_words_integration.py` 和本文件。
- 定向回归：`python3 -m unittest tests.test_dare_words tests.test_dare_words_integration tests.test_prepared_game_initialization tests.test_frontend_script_names tests.test_frontend_style_assets tests.test_game_dev_order tests.test_game_names tests.test_game_tags tests.test_ai_metadata tests.test_bot_threading` 共 61 项通过；`node --check static/games/dare_words.js`、`node scripts/smoke_load.cjs dare_words`、`git diff --check` 通过。
- 真实服务端浏览器验收（Chrome + playwright-core，脚本 `tmp/dw_viewport_check.cjs`）：320 / 390 / 1024 / 1440 px 四档各开一局**真实双人局**（无 Bot 干扰），逐档走完 开局设置 → 开始 → 交替翻 6 张 → 选 4 张被锁并提示「至少 5 个字。」→ 选第 5 张解锁 → 抢答 → 表决 → 结算暂停。四档均：面板真实可见、无横向溢出、翻牌与抢答按钮不重叠、桌面字列不压翻牌按钮、记分板与状态栏尺寸正常、结算显示 +5 张且暂停等 Next；52 项断言全通过，0 条 console / page 错误。
- 交互与文案：房间设置下拉真实提交 `min_chars`（`getDareWordsConfig()` 返回 `{deck_size,min_chars}`），开局后下拉锁定为所选值；已选字卡区占位文案随下限变为「点字卡拼出至少 5 个字」；点已选区的字可取回。
- 未检查：iOS / Android 真机；桌面宽度下 Room Control 默认收起为 Dock（`#roomControlsPanel.collapsed`，既有共享行为，牌堆下拉同样如此），验收时按玩家操作点开 Dock 后测量。
- 本机验收产生的房间只存在于运行中的服务内存里，`.data/` 未新增目录。

## 提示遮挡翻牌按钮修复（2026-11-11）

- 问题：桌面字列外层带 `data-dw-tip`，悬停字卡时事件冒泡到外层，提示被定位到整个字列区块的下方，正好压住「翻牌」按钮。
- 修复一：新增 `tipAnchor()`，命中 `button / a / input / select / textarea / label / [role=button]` 的元素一律不出提示。字卡和已选字卡本身可交互，按 DEV_GUIDE「有交互功能的元素点击后不出浮动提示」不再冒泡出外层提示；鼠标悬停、触摸点按和键盘聚焦三条路径都走同一个判定。
- 修复二：`showTip()` 改为依次尝试「锚点下方 → 锚点上方 → 视口底部」，用 `coversControl()` 逐个比对面板内所有按钮的矩形，只要会压住按钮就换位置；三处都压住时直接不显示，绝不遮挡可点元素。
- 结果：悬停任意字卡（含 `is-selected is-order` 状态）不再出现提示；悬停「桌面字列」标题或区块空白处时，提示自动翻到字列上方。
- 验证：320 / 390 / 1024 / 1440 px 四档实测，提示与按钮重叠数均为 0，提示框底边分别为 109 / 127 / 122 / 122 px，而翻牌按钮顶边在 327 / 260 / 279 / 279 px，四档都无横向溢出；牌堆数量等静态说明的提示仍正常显示。资源版本 `dare_words.js?v=4`，首页 `game_assets.js?v=254`。

## 单字池扩充（2026-11-22）

- `game/dare_words.py` 新增 `EXTRA_DECK_CHARACTERS`，恰好 `200` 个新的单字，不改变 `100 / 60` 张局长、最短词句设置、投票与计分规则。保留重复的高频基础字，避免纯随机抽样削弱基本组句能力；原 Bot 词库和模板仍可使用，词句语义仍由玩家投票判断。
- 新局保存本局初始牌堆，用于随机组牌后的读档守恒校验；保留原固定牌堆旧档兼容，新增信息不出现在任何玩家的公开视图中。
- 定向测试覆盖新增字数量、单字与唯一性、两个模式的随机组牌与高频字保留、新字翻牌和抢答计分、新旧存档往返与非法字/重复字篡改、房间广播中的剩余张数及隐藏牌堆隐私。
- 验证：`python3 -m unittest tests.test_dare_words tests.test_dare_words_integration` 共 `41` 项通过，`git diff --check` 通过；额外以 `20` 个随机种子覆盖 Full / Short × 最短 3 / 4 / 5 字，共 `120` 局 Bot 对局全部结束，开局与结束存档均能完整往返。
- 本次仅修改后端字池、测试与本文档，未改动前端资源或布局，无需刷新前端资源版本；不重复进行 UI 视口验收。
