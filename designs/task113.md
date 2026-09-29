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
