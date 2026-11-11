# Task 184：胆敢造词（Dare to Make Words）

## 玩法方案

- 还原国产原创聚会桌游《胆敢造词》的经典竞速规则：牌堆里是单字卡，桌面上是公开字列，谁先只用桌面上的字凑出通顺词句谁得分。
- `2–8` 人。牌堆 `100` 张单字卡（可选 `60` 张短局），洗匀后背面朝上。
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
