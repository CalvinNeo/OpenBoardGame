# Task 113：拉斯维加斯 / Las Vegas

## 范围与规则依据

实现 `las_vegas`，采用 Rüdiger Dorn 的 Ravensburger / alea 2012 基础版，支持 2–5 人和机器人；附带官方 2–4 人白骰变体。规则来源为[Ravensburger 官方英文规则书](https://www.ravensburger.org/spielanleitungen/ecm/Spielanleitungen/26938_Vegas_EN.pdf)。不混用新版或 Royale 的赌场、轮次和组件。

- 每人每轮 8 枚自己的骰子(🎲)，6 个赌场(🎰)分别对应点数 1–6。每次掷出所有剩余骰子，选一个点数，把该点数的全部骰子放进对应赌场，再轮到下一个仍有骰子的玩家。不允许只放一部分、重掷已掷的骰子或跳过行动。
- 共 54 张钞票(💵)，单位使用美元整数：10,000／40,000／50,000 各 6 张，20,000／30,000 各 8 张，60,000／70,000／80,000／90,000 各 5 张。开局洗牌；每轮按赌场顺序发到各自总额至少 50,000，奖金面额全部公开。
- 所有人用完骰子后结算：每个赌场中骰子数量相同的所有参与者全部取消资格（包括低位平手）；其他人按数量降序，每人最多获得一张剩余最高面额钞票。没拿走的钞票放回牌库底。赌场顺序固定从 1 到 6。
- 赢得的钞票面朝下保留：本人可查看金额和面额，他人仅见张数；公开获得奖金的历史仍可查看。未来牌库永不下发。初始先手线上随机决定，每轮先手顺座位轮转。
- 共 4 轮，总金额最高者胜；金额相同则钞票张数多者胜，再相同则并列。
- 可选 `neutral_dice` 默认关闭，仅 2–4 人可用。2 人每人额外 4 白骰，3／4 人额外 2 白骰；3 人局另有 2 白骰开轮自动掷入对应赌场。白骰(⚪)与自己的骰子一起掷，同点数必须一起放，可只放白骰；所有白骰属于同一个中立参与者。中立方正常参与平手／排名，所获奖金回牌库底。
- `round_end` 保留全部赌场骰子、平手状态和奖金分配。每个席位分别确认 **Next Round**，全员确认才继续，第四轮也先展示结算再进入终局。机器人只确认自身；断线真人需重连。

## 后端合同

新建 `game/las_vegas.py`，提供 `LasVegasGame`、`ACTION_SCHEMA`、`CONFIG_SCHEMA` 及标准七个接口，动作逐项检查并在变更状态之前拒绝非法输入。状态阶段为 `roll → place → roll / round_end → roll / game_over`。

- `roll` / `place` 动作必须含 `{type, round, turn}`，放置另含 `face`（1–6 整数）；`next_round` 含 `{type, round}`。拒绝未知字段、布尔值、浮点数、过期轮次和回合。掷骰后阶段改变，不可重复掷骰；放置后 `turn` 自增。
- 内部状态：`players` 按 ID 映射 `{remaining, neutral_remaining, banknotes}`；`turn_order`、`player_meta`、`banknote_deck`；`roll: {own: int[], neutral: int[]}`；`casinos: [{face, banknotes, dice: {player_id: count}, neutral_dice}]`；`start_player, current_turn, round, turn, next_ready, round_summary, final_results, log, winner, game_over`。
- 公开视图：`game_id, you, config, phase, round, total_rounds(4), turn, current_turn, start_player, game_over, winner, next_ready, legal_actions, roll, casinos, round_summary, final_results, log`；`your_banknotes: int[]`、`your_total: int|null`。
- `players: [{player_id,name,seat,is_bot,color,remaining,neutral_remaining,banknote_count,total}]`，`color` 为 0–4；`total` 仅本人或终局可见。`casinos` 保留上述结构，额外含当前推算 `tied_players: str[]`（中立 ID 为 `__neutral__`）和 `payouts: [{player_id,amount,dice}]`，明确只是当前盘面的分配预览。
- `round_summary: null | {round,casinos:[{face,banknotes,dice,neutral_dice,tied_players,payouts,returned:int[]}],earnings:[{player_id,amount,banknotes:int[]}],neutral_returned:int}`；`final_results: [{player_id,total,banknote_count,rank}]`。钞票在轮末保留于显示快照，但守恒统计使用牌库加玩家持有，避免把展示快照重复计数。
- 序列化、反序列化、公开视图均深拷贝。机器人决策仅接收自己的公开视图，比较放置后的奖金预期和骰子成本，且合法走完白骰和轮末确认。
- 注册 `game/definitions.py`、`game/__init__.py`、`game/tags.py`，刷新 `game/dev_order.json`。接入进行中私密存档导出／克隆保护；断线重连依托房间系统。

## 前端方案（FRONTEND.md / task40.md）

新建 `static/games/las_vegas.js`、`static/games/las_vegas.html`、`static/las_vegas.css`。使用 IIFE 私有作用域，仅导出 `renderLasVegasGameState`、`showLasVegasHeaderActions`。主容器 `lasVegasPanel`，头部 `lasVegasHeaderActions` / `lasVegasHelpBtn` / `lasVegasExplainBtn`。按需加载清单注册 JS/CSS/HTML 并更新首页清单版本。

- 自制 CSS 骰子、Emoji 和颜色：深蓝夜景配暖金、薄荷色，六个赌场紧凑网格，玩家骰子颜色同时带姓名，避免只靠颜色辨认。赌场直接展示全部奖金、投注数、平手取消和暂时可获奖金。
- 操作区位于赌场附近，**Roll Dice** 后按点数组展示自己／白骰数量，选择点数或赌场后 **Place Dice** 确认。点空白／Esc 取消选择；没有 Clear Selection。无合法动作时显示等待状态，发送中禁用重复提交。
- 结算展示所有奖金归属、平手取消、回收钞票和自己的收入；全员确认数量明确可见。终局显示名次、金额、张数和平手赢家。
- **Help** 对话框放完整规则；**Explain** 进入点选解释，支持 disabled 控件、全局捕获阻止原动作、解释后自动退出、Esc 退出。不逐项添加 i 按钮。
- 不可操作图标、缩写支持桌面悬停和键盘焦点、手机点击 3 秒浮动提示；连续点击替换；规则／解释同时写名称与 Emoji。对话框 Esc／背景关闭并归还焦点。
- 非游戏内容 UI 英文。宽屏赌场主栏和玩家侧栏，窄屏重排，320px 也不得横向滚动、重叠或溢出，长名字换行。日志限定高度独立滚动。
- 初始化兼容 DOMContentLoaded 已发生；注册监听后同步 `currentRoomState`，全局分发允许游戏尚未加载。

## 验证

规则测试覆盖组件组成、2–5 人、赌场补款、全部同点骰放置、跳过耗尽玩家、所有层级平手、奖金按面额分配、回收顺序、先手轮转、4 轮全员确认、金额／张数／并列决胜、白骰全流程、非法与重放请求不变更状态、私密视图与深拷贝、机器人完整对局。房间测试覆盖注册、创建、开局、广播、重连、存档保护。

因添加全局注册和存档条件，运行相关全局回归及完整 unittest；区分工作区已有失败。前端不新增逻辑单测，使用 JS 语法和真实浏览器验证桌面、390px、320px 布局、Help／Explain、触屏提示、真实操作与轮末等待。

## 实施记录

- 后端、游戏注册、按需资源、房间活局存档保护已接入；目录 BGG API `avgweight=1.1667`，展示为 `1.17`。原版官方规则链接见开头。
- 已完成 140 局机器人模拟（基础 2–5 人、白骰 2–4 人，各 20 个随机种子），每步检查 54 张钞票守恒，均完整结束；单元测试另覆盖各色骰子守恒。全员确认包含第四轮；恢复存档／重连保留已掷骰面。
- 前端已实现独立 HTML template／CSS／IIFE JS，按需加载；大厅白骰选项跟随人数限制，五人自动取消并禁用；从游戏状态恢复白骰配置，刷新后重开不丢模式。提供放置前奖金预览、平手提示、逐赌场回收和完整终局排名。
- `python3 -m unittest tests.test_las_vegas tests.test_las_vegas_integration tests.test_game_names tests.test_game_tags tests.test_game_dev_order tests.test_frontend_script_names tests.test_room_session`：68 项全部通过，其中本游戏 23 项单元测试＋7 项房间集成测试。日志：`tmp/las_vegas/focused-tests.log`。
- `python3 -m unittest`：执行 1580 项，11 处失败位于其他游戏：方舟动物园并发规则审计测试 6 处（含子测试）、掼蛋 1 处、德国心脏病 4 处；掼蛋与德国心脏病的同名失败在已有 `tmp/love_letter/full-tests.log` 亦可见。本次未改动这些模块。完整日志：`tmp/las_vegas/full-tests.log`。全量发现测试时本游戏的新测试文件尚未全部落盘，最终以以上 68 项独立回归覆盖本次新增测试。
- JS 语法检查与本次文件 `git diff --check` 通过。`scripts/gen_dev_order.py` 已运行，保留共享工作区的其他游戏注册。
- 实际 Chrome 验收通过：从大厅加载新游戏、白骰选项在加机器人／Ready 时保持、真实掷骰、刷新同骰面、选点确认、空白／Esc 取消、完整四轮人机对局、四次轮末暂停、最终排名；Help／Esc、禁用控件 Explain；基础五人／白骰三人的 8 份状态在 1440／390／320px 下无页面及内部水平溢出。截图在 `tmp/las_vegas/`。
- 手机触屏验收通过：连续点击更换 tooltip，3 秒后自动关闭；Explain 拦截原行动且解释后退出；五人大厅自动取消／禁用白骰，并成功以基础模式开局。浏览器验证脚本：`tmp/las_vegas/browser_smoke.cjs`、`tmp/las_vegas/mobile_lobby_smoke.cjs`。

## Royale 豪华版与 UI 优化（2026-11-21）

- 豪华版通过大厅 `Edition → Royale · 豪华版` 选择，复用已实现的 `edition: "royale"` 引擎：2–5 人、3 轮、7 小骰与 1 大骰、每轮 2 筹码、16 种赌场小游戏。基础版与白骰变体保持独立，旧存档缺省仍采用基础版。具体规则及线上边界见现有 `designs/las_vegas_royale.md`。
- 按 `DEV_GUIDE.md` 将掷骰栏并入棋盘，选中赌场内直接确认投放，小游戏选择也位于对应赌场内，不再使用独立 Action 面板。保留投放前奖金预览、秘密选择权限、轮末全员确认和原有重连机制。
- 桌面六赌场为三列，手机为两列。缩小板块标题、保持游戏标题与 Reconnect／Help 控件同行，版本选择标签与下拉框同行。Double Down／Knockout 仅显示实际占位玩家，避免空名单撑高棋盘。Activity 默认折叠，展开后独立滚动，点选骰子及刷新状态时保留展开状态。
- Help 支持中英文切换及快速上手、回合结算、图标操作、16 种小游戏章节，先讲胜利条件、每回合行动与策略重点。图标说明包含名字与符号，线上免费 Pass、奖金供应和现金找零例外均披露。Explain 在抬手时确认点击，超过 10px 移动或取消手势不弹解释，禁用按钮仍可解释，后续正常点击不会被误吞。
- 涉及文件：`static/games/las_vegas.js`、`static/games/las_vegas.html`、`static/las_vegas.css`、`static/game_assets.js`、`static/index.html`、`tests/las_vegas_royale.browser.cjs`、`tests/las_vegas_royale_fixtures.py` 及本设计文档。资源清单同步更新脚本、样式、模板与首页清单版本，不更改公共样式或规则引擎。
- 验收：Chrome 在 320、390、600、768、1024、1440px 检查基础版、白骰与豪华版共 31 份真实公开视图（186 组合），无页面或游戏元素水平溢出。目视检查 320／390／1024／1440px 截图及 Black Box 秘密分组，截图保存在忽略目录 `build/las-vegas-royale-qa/`。
- 交互验收：版本选项及开局载荷、放置和大骰预览、封锁、Pass、小游戏及秘密分组、旁观权限、轮末确认、双语章节与 Esc、禁用 Explain、日志折叠保留、取消选择。Chrome 触屏模拟检查点选／确认、连续 tooltip 更新与 3 秒关闭、Explain 滑动不触发及点击后退出。
- 检查：`node --check static/games/las_vegas.js`、`node --check tests/las_vegas_royale.browser.cjs`、`node scripts/smoke_load.cjs las_vegas`、`python3 -m unittest tests.test_las_vegas tests.test_las_vegas_royale tests.test_las_vegas_integration tests.test_frontend_style_assets tests.test_help_contract`（74 项）、`node tests/las_vegas_royale.browser.cjs`（配合已有 Playwright 和 `PYTHON=python3`）、`git diff --check`。
- 已覆盖本次 `DEV_GUIDE.md` 的桌面／移动布局与交互验收要求。未进行 iOS Safari／Windows 真机测试，不能将 Chrome 触屏模拟等同于跨平台真机验收。本次未改全局行为，不运行全部游戏逻辑测试。共享工作区其他游戏的修改保持不动。

## 2026-11-23 开局配置移入 Room

- 将 Edition 与白骰选项从主板移到 Room Control → Room 配置卡；模板继续懒加载，首页只提供空挂载点。Royale 隐藏白骰选项，五人仍自动取消并禁用白骰，Ready 更新不重置选择。
- 配置卡仅在本游戏大厅显示，开局、离房或切换游戏后隐藏，沿用既有 `room:start` 载荷及重连配置。游戏规则、CSS、Help / Explain 的局内行为未变。
- 本游戏修改：`static/games/las_vegas.html`、`static/games/las_vegas.js`、`tests/las_vegas_royale.browser.cjs`、本文件；共同修改：`DEV_GUIDE.md`、`designs/room_control.md`、`static/index.html`、`static/game_assets.js`，新增 `tests/game_setup_location.browser.cjs`。
- Chrome 检查配置区 320 / 390 / 1024 / 1440px 并目视复核截图，无配置内容溢出或整页横向滚动。新增回归通过：首次懒加载、Ready 保留、跨游戏切换、回到原房、实际 Royale 开局载荷、开局后隐藏及刷新重连。
- `tests/las_vegas_royale.browser.cjs` 通过：六档宽度、31 种视图，覆盖基础／白骰／豪华版、放置、大骰、秘密决策、轮末、双语 Help、禁用 Explain、Escape 与触摸交互。
- `tests.test_frontend_style_assets`、`tests.test_help_contract` 共 13 项通过；相关 JS 的 `node --check`、`node scripts/smoke_load.cjs las_vegas`、`git diff --check` 通过。纯 UI 未运行游戏逻辑或全量套件。
- 本次涉及的 DEV_GUIDE 布局与交互验收通过，无新增 UI 例外；截图在忽略目录 `tmp/game-setup-location/`。未实测实体 iOS / Android、Windows 字体，不宣称跨平台真机全部验收。
