# Task 183：同频共词 / Word Sync

## 需求与规则

- 原创双人联想游戏，`game_id = word_sync`；仅支持 2 / 4 / 6 / 8 人，不支持奇数人数。
- 开局按房间座位顺序两两组队：第 1、2 位一队，第 3、4 位一队，依此类推。开局后队伍固定，重连不改变队伍。
- 每轮尚未完成的队伍中，两位队友各自输入一个词。第一轮自由联想，后续可参考自己队伍上一轮的两个词继续联想；不设置标准答案、词库限制、倒计时或轮数上限，不额外禁止重复词。
- 输入最多 24 个 Unicode 字符，必须含文字或数字；拒绝控制字符与空白答案。比较时采用 Unicode NFKC、去首尾空白、合并中间空白与大小写折叠；不自动合并同义词、简繁体或不同标点。
- 提交即锁定，提交前其他人只能看到“正在想 / 已锁定”，不能看到词语。所有未完成队伍都提交后整轮同时亮词，避免提交先后成为优势。
- 同队两词相同即完成，记下当前轮数；已完成队伍停止猜词。尚未完成的队伍继续，直到所有队伍完成。
- 每轮亮词后保留现场，所有玩家（包括已完成队伍）点击 `Next Round` 才开始下一轮；末轮直接保留终局，无自动重开。
- 用轮数最少的队伍获胜；按轮数从少到多排名，同轮完成并列，不按提交速度破同分。2 人时显示单队合作完成记录。
- 玩家不应提前通过聊天、语音或暗号约定答案。系统只校验文本相同，不判断语义关联或线下交流。

## 服务端与隐私

- 新增 `game/word_sync.py`，实现统一游戏接口、动作与配置 Schema、名单与人数校验、序列化 / 反序列化及练习机器人。
- 状态保存固定队伍、当前轮次、阶段、私密提交、公开历史、完成轮次、全员确认名单、最终排名及获胜玩家。
- 阶段为 `guess → reveal → guess`，所有队伍完成时进入 `game_over`；动作携带随机 `game_token` 与递增 `window_id`，防重复、过期和跨局请求。拒绝的动作不改变状态，绕过外层 Schema 也不能绕过服务端校验。
- 玩家视图只暴露本人当前提交、各人的提交状态、已经亮出的历史和队伍进度；旁观者看不到任何未亮词。事件及机器人日志不含私密答案。
- 未结束的存档禁止公开下载或无凭证加载；原座位凭证支持热重连与服务端重启后的恢复。终局存档可下载。
- 练习机器人仅从自身公开视图决策：第一轮使用简单固定起始词，之后从本队上一轮公开词中选稳定的同一个词。它是流程演示伙伴，不读取任何未揭晓提交，不标记为专门策略 AI。

## 界面与接入

- 遵循 `DEV_GUIDE.md`、`FRONTEND.md`、`designs/task40.md`、`designs/room_control.md`；主要界面直接位于 Game 内，不额外嵌套整体外框。
- 自绘暖色纸张 / 青绿色词卡；中心突出本队两张词卡、单词输入与就近提交；队伍排名与其他队伍放在次要区域，历史默认折叠且限高滚动。
- 手机紧凑纵排、桌面双栏；长名字和长词换行，不横向溢出；Game 标题可缩短，Help / Explain / Reconnect 保持单行。开局沿用 RC 自动收起；需要本人行动时强调 RC dock。
- 亮词页同时展示本轮各队词语并强调自己队伍；已完成队伍显示完成轮数；本人锁定词明确注明仅自己可见。
- 非游戏内容 UI 使用英文；规则集中于 Help。Explain 捕获操作、虚线高亮、支持 disabled 按钮、点击说明后退出；Esc 退出模式及弹窗。状态图标提供桌面悬停 / 手机轻触 3 秒提示，滑动不触发提示或操作。
- JS 使用 IIFE 与 `wordSync` 独有全局命名；DOM 就绪检查、懒加载后同步房间状态、断线 / 错误解除等待、切换游戏清理临时状态。输入草稿在他人提交时保留，避免焦点丢失。
- 通过 `static/game_assets.js` 按需加载独立 `.js` / `.css` / `.html`，首页仅放空容器，资源变化递增版本。同频共词仅在房间开局或恢复已开始对局后加载；大厅不加载游戏文件，也不以文件未加载阻止 Start。开局后的 Game 区显示类似 Semantic Guess 的文件完成进度、当前阶段及错误重试。
- 注册中英文名字、人数、标签，刷新 `game/dev_order.json`。原创玩法没有对应 BGG 记录，`GAME_WEIGHT.word_sync = null`，不冒用其他游戏权重或伪造 BGG 数据。

## 验证计划

- 单元测试：合法人数 / 座位分队、词语归一化与非法输入、提交锁定与隐藏、同时亮词、全员确认、已完成队伍跳过猜词、多人排名 / 并列、两人模式、过期动作、存档往返、机器人仅使用公开信息。
- 房间集成：目录、奇数开局拒绝、2 / 4 / 6 / 8 人开局、定向广播、日志脱敏、热 / 冷重连、存档下载保护、跳过外层校验时依然安全。
- 浏览器：320 / 390 / 1024 / 1440px，输入与提交、IME 回车保护、草稿保留、亮词 / 确认 / 终局、Help / Explain / Esc、disabled 解释、轻触提示与滚动区分、RC、长文本、懒加载、切换及重连。
- 修改公共注册 / 路由后运行相关公共测试及完整测试；实际结果和未验证项目记录在本文，不新增单独验收文档。

## 实施记录

- 2026-11-06：检查编号至 `task182`，选用未占用的 `task183`；先完成本设计，再实现。
- 已实现固定座位配对、私密锁词、全桌同时揭晓、全员 Next Round、完成队伍跳过猜词、并列名次、单队合作记录和练习机器人。游戏出现在 Select Game 中，人数限制同时在目录、房间 UI 和服务端生效。
- 已实现事件 / 机器人日志脱敏、未结束存档下载及加载保护、热重连与原凭证冷恢复、跨局 / 过期动作拒绝；文本使用 `textContent` / HTML 转义，不执行玩家提交的标记。
- 已处理输入草稿与焦点保持、中文 IME 回车保护、重复提交锁、错误 / 断线解除等待；弹窗关闭仅在需要时恢复焦点，避免异步关闭事件抢走输入焦点。弹窗样式仅作用于自身内容，不影响被公共层迁入的 RC。

### 本次文件清单

- 设计：`designs/task183.md`。
- 规则：`game/word_sync.py`。
- 服务端接入：`app.py`、`game/__init__.py`、`game/definitions.py`、`game/tags.py`、`game/dev_order.json`。
- 界面：`static/games/word_sync.html`、`static/games/word_sync.css`、`static/games/word_sync.js`。
- 前端接入：`static/game_assets.js`、`static/index.html`、`static/app.js`、`static/room.js`。
- 测试：`tests/test_word_sync.py`、`tests/test_word_sync_integration.py`、`tests/word_sync.browser.cjs`。
- 保留工作区原有开发规范、其他游戏、AI 和设计文档改动；没有提交或新建分支，没有修改其他游戏规则。

### 实际检查结果

- `python3 scripts/gen_dev_order.py`：成功，当前 118 个游戏，Word Sync 为第 118 项。
- `python3 -m unittest tests.test_word_sync tests.test_word_sync_integration`：23 项通过。
- `python3 -m unittest tests.test_word_sync tests.test_word_sync_integration tests.test_room_session tests.test_game_dev_order tests.test_frontend_style_assets tests.test_game_tags tests.test_frontend_script_names tests.test_ai_metadata`：70 项通过。
- `node --check` 检查新游戏脚本、浏览器测试、公共分发及资产清单；`git diff --check` 与 `git diff --cached --check` 均通过。
- `python3 -m unittest`：执行 3679 项，11 项失败，未修改这些失败涉及的功能。具体为 Ark Nova integration 的 5 项旧前端源码断言、Ark Nova map5a 生成产物一致性、Guandan opening 策略断言，以及 Halli Galli 的 4 项翻牌 / 抢铃断言；日志 `/tmp/openboardgame-word-sync-unittest.log`。新游戏及其接入测试均通过。
- 使用本机 Chrome headless + Playwright，在隔离临时数据目录的本地服务器运行 `tests/word_sync.browser.cjs`：320 / 390 / 1024 / 1440px 全部通过。检查开局、私密锁词、亮词、部分确认、完成队伍等待、终局、旁观、2 人和 8 人视图、超长名字及词语，无游戏区域横向溢出或组件重叠；查看了桌面、手机与真实终局截图。
- 交互检查通过：输入和草稿 / 焦点保留、IME 回车、24 字校验、重复提交、错误恢复、Help / Explain / Esc、disabled 控件解释、Explain 屏蔽无解释按钮、悬停 / 轻触 3 秒提示、连续提示更新、触摸滚动不误触、长历史折叠 / 限高滚动、懒加载及切换清理。
- 真实 4 客户端联机通过：自动收起 RC、行动提示、不同玩家词语隔离、断线重连及页面刷新恢复锁词、全员确认屏障、2 轮结束和名次；另验证真人 + 机器人 2 人局和收起 RC 后再次开局。
- `tests/game_assets.browser.cjs`：公共按需加载完整回归通过，覆盖加载顺序、CSS 优先级、失败重试、部分脚本失败、切换 / 离开期间的过期加载，以及创建 / 开局 / 重载。
- 浏览器命令：`PLAYWRIGHT_MODULE=/tmp/openboardgame-word-sync-browser/node_modules/playwright ROOM_TEST_URL=http://127.0.0.1:8793 node tests/word_sync.browser.cjs`；公共回归替换为 `tests/game_assets.browser.cjs`。测试依赖安装在 `/tmp`，未新增仓库运行依赖。截图在 `tmp/word-sync-ui/`。

### 未检查与例外

- 尚未使用实体 iOS / Android 设备、Safari / Firefox、系统真实中文输入法及系统辅助读屏验证；触摸与 IME 用浏览器事件模拟。
- 6 / 8 人完整流程已通过服务端及机器人测试，8 人视图已覆盖全部宽度；真实多浏览器联机实际使用 4 人，另加 2 人真人 + 机器人。
- 全量测试有上述 11 项其他模块失败，不将其宣称为全库通过。
- 沿用公共 RC：桌面 dock 允许浮层覆盖；终局 RC 可自动展开，收起后可完整查看结果。公共桌面 RC 内部既有固定网格的测量差异不属于新游戏组件，未改造公共布局。
- 原创游戏无可核验 BGG 条目，权重登记为 `null`（未评级）；不编造难度数值。练习机器人不是语义推理 AI，不作专门 AI 标记。

## 开局加载调整（2026-11-06）

- 原因核查：公共流程进入房间就加载全部游戏资源，同时 Start 以资源完成为前置条件；原生 script / stylesheet 标签没有超时保护，网络请求一直不结束时会一直显示 Loading game files。未取得用户现场请求记录，不将具体网络原因认定为已定位。
- 同频共词声明 `loadOnStart`；共享的加载判断同时用于大厅加载、Start 校验和状态展示。其他需要提前渲染配置的游戏维持原流程，Semantic Guess 的服务端词库准备进度保持不变。
- 启动后才下载 markup / styles / scripts；进度按实际完成的文件数计算，明确显示 `files ready`，不伪装成下载字节百分比或计时动画。加载完成后自动回放最新状态。
- 请求等待超过 15 秒显示可重试状态。原生脚本超时后仍复用在途请求，避免重试导致同一脚本重复执行；实际请求失败会清理缓存，允许重新请求。页面重载可重新发起仍未返回的请求。
- 本次修改：`static/game_assets.js`、`static/games/shared.js`、`static/room.js`、`static/index.html`、`static/style.css`；补充 `tests/word_sync.browser.cjs`、`tests/game_assets.browser.cjs`，同步更新本文。
- 验收通过：大厅没有请求同频共词游戏资源，准备后 Start 可用；开局才请求资源，实际完成 0 / 1 / 2 / 3 个文件对应 0% / 33% / 66% / 完成。慢网、15 秒脚本等待超时、同一在途脚本重试不重复执行、HTML 503 重试、自动进入最新状态、重载已开局房间、加载中离开房间均通过。
- Chrome 浏览器检查 320 / 390 / 1024 / 1440px 的读条及原游戏交互，无横向溢出；查看手机及桌面截图。启动截图位于 `tmp/word-sync-ui/startup-*.png`。两套浏览器回归通过，公共回归额外验证 Semantic Guess 的大厅配置与服务端 42% 初始化进度保持不变。
- `python3 -m unittest tests.test_frontend_style_assets tests.test_frontend_script_names`：3 项通过；改动的 JS 及两套浏览器测试 `node --check`、`git diff --check` 均通过。本次只修改前端 UI 与资源加载，按开发规范未重复运行游戏逻辑全量测试。
- 本次未检查：实体手机、Safari / Firefox、用户遇到卡住时的实际网络请求；使用 Chrome 模拟慢网和超时。保留其他游戏的提前加载配置流程，只有同频共词设置开局后加载。

## 大乱斗模式与 2-10 人（2026-11-07）

### 需求与规则

- 人数扩展为 **2-10 人**。原团队模式规则不变，仍按座位两两固定组队，但只接受偶数人数 **2 / 4 / 6 / 8 / 10**；奇数人数只能玩大乱斗。1 人不可开局。
- 新增 **大乱斗（Free-for-all）** 模式：不分队，每人每轮私下写一个词。
- 大乱斗胜负：**同一轮内只要有两个及以上玩家写出相同的词，游戏立即结束，这些玩家并列获胜（🏆），其余人落败**。若同一轮出现多组不同的重复词，各组玩家全部获胜。不按提交速度破同分，只有同一轮的词可以相撞。
- 无人撞词时亮词后全员 `Next Round` 进入下一轮，不设轮数上限；亮词前依旧只暴露“已锁定 / 正在想”。
- 上一轮所有玩家的词在猜词阶段作为参考展示；历史记录公开、可折叠滚动。
- 词语归一化、私密锁定、同时亮词、全员确认、存档保护等规则两种模式完全一致。
- 模式在房间 **Game Options → Mode** 中选择：`Team · pairs`（默认）或 `Free-for-all`。游戏选项只在大厅可改；已开局的房间保持开局时的模式。

### 服务端

- `game/word_sync.py` 增加 `mode` 配置（`team` / `free_for_all`，缺省 `team`），`CONFIG_SCHEMA` 由“不接受任何选项”改为只接受 `mode`。
- `min_players = 2`、`max_players = 10`、`supported_player_counts = 2..10`（目录与房间按并集展示），另加 `player_counts_by_mode` 供服务端按模式校验：团队模式仅偶数，大乱斗 2-10。人数不合法时 `init_game` 抛错，`room:start` 回 `system:error`，`skip_validation` 也无法绕过。
- 状态新增 `mode`。大乱斗把每位玩家表示为一个单人 `team`（`team_id = team-N`，N 为座位序号），复用既有的 `history` / `matched_round` / `standings` 结构：猜中即 `matched_round = 当前轮`，未猜中保持 `None`。
- 结算：团队模式“所有队伍完成”才结束；大乱斗“任意玩家撞词”即结束，`winner` / `winning_team_ids` 按座位顺序记录全部获胜者。排名对大乱斗只有第 1 名（并列），其余为未完成。
- `_standings` 排序由 `team_id` 字符串改为座位序号，避免 10 人时 `team-10` 排在 `team-2` 之前。
- 反序列化按模式分别校验：团队模式逐条比对两词是否相同；大乱斗额外重建“每轮每人一个词”的映射，校验 `matched` 标记、同轮撞词人数、获胜轮次必须等于结束轮，并校验 `revision`（按实际提交词数累计，不再假设每队 2 词）。旧存档（无 `mode`、`config = {}`）仍按团队模式加载。
- 练习机器人大乱斗策略：第一轮按座位奇偶取固定起始词，之后取上一轮**已公开**词中排序最小的一个，因此全机器人局最迟第 2 轮结束；只读自身公开视图。

### 界面与接入

- `static/index.html` 增加 `wordSyncConfigBox`（Mode 下拉 + 说明），`static/app.js` 提供 `updateWordSyncConfigRow()` / `getWordSyncMode()`（大厅脚本，游戏脚本仍是开局后加载），`static/games/shared.js` 在开局时提交 `config.mode`，`static/room.js` 在 `getRoomStartReason` 中对团队模式的奇数人数直接禁用 Start 并给出提示。
- `app.py` 把 `word_sync` 加入“开局后用 `game_state.config` 覆盖 `room.game_config`”的名单，房间状态因此能回传模式，客户端重连或回到大厅时下拉框显示实际模式。
- 大乱斗界面沿用同一套版式：左侧只 spotlight 自己的词卡（YOU / 座位号），右侧 `PLAYERS` 列表逐人显示已亮词或 🔒 / Thinking，获胜者标 🏆 Winner，未撞词者显示 No match；`Last round` 一行展示上一轮全部词作为灵感；历史按轮分组，用 chip 显示“名字 + 词”，撞词的 chip 高亮。标题、状态文案、Explain 与 Help 均按模式切换（`MANY MINDS. ONE WORD.` / `Find a twin word.` 等）。
- Select Game 的人数标签支持连续区间：连续人数渲染为 `2-10`，不再输出 `2 / 3 / … / 10`（其他游戏的 `2 / 4 / 6 / 8` 等离散列表保持原样）。

### 本次文件清单

- 规则：`game/word_sync.py`。
- 服务端接入：`app.py`。
- 界面：`static/games/word_sync.js`、`static/games/word_sync.css`、`static/games/word_sync.html`。
- 前端接入：`static/index.html`、`static/app.js`、`static/room.js`、`static/games/shared.js`、`static/game_assets.js`。
- 测试：`tests/test_word_sync.py`、`tests/test_word_sync_integration.py`、`tests/word_sync.browser.cjs`。
- 未新建单独验收文档，本次记录写在本文件。

### 实际检查结果

- `python3 -m unittest tests.test_word_sync tests.test_word_sync_integration`：31 项通过（新增大乱斗撞词即结束、多组并列、十人座位排序、两人多轮、存档往返与篡改拒绝、机器人只用公开词、目录 2-10 人、奇数人数团队模式拒绝而大乱斗可开、大乱斗房间全流程与存档下载）。
- `python3 -m unittest tests.test_room_session tests.test_game_dev_order tests.test_frontend_style_assets tests.test_game_tags tests.test_frontend_script_names tests.test_ai_metadata`：47 项通过。
- `python3 -m unittest`：3687 项（本次新增 8 项），11 项失败，与改动前记录的失败集合完全一致，均为其他模块的既有失败（Ark Nova integration 5 项 + map5a 产物 1 项、Guandan 开局策略 1 项、Halli Galli 翻牌 / 抢铃 4 项），本次未触碰这些模块。
- 本机 Chrome headless + Playwright 运行 `tests/word_sync.browser.cjs` 通过：320 / 390 / 1024 / 1440px 下团队与大乱斗的全部 fixture（猜词、他人锁定、旁观、亮词、已确认、第二轮、终局、超长名字与超长词）均无横向溢出与组件重叠；大乱斗历史 chip 12 个、撞词 chip 2 个、320px 展开后仍不溢出。
- 真实 4 客户端联机通过：团队模式完整对局结束后，4 人退出并新建房间，在大厅把 Mode 切到 Free-for-all 开局，验证 `game_config.mode` 回传、撞词前他人词语不出现在任何视图、3 / 4 锁定提示、终局 “Alex + Morgan win!” 与 🏆 标记、败者 “Nobody wrote your word”。
- `tests/game_assets.browser.cjs` 公共按需加载回归通过（新的 `game_assets.js?v=206` / `shared.js?v=app_v43` / `app.js?v=app_v63` / `room.js?v=app_v100`）。
- Select Game 标签专项检查：320 / 390 / 1024 / 1440px 下 `👥 2-10` 与其他游戏一致，人数标签不超出卡片、无横向溢出。
- `node --check` 覆盖改动的全部 JS 与浏览器测试；`git diff --check` 通过。

### 未检查与例外

- 未使用实体 iOS / Android、Safari / Firefox、系统中文输入法与读屏验证；触摸与 IME 仍用浏览器事件模拟。
- 大乱斗真实联机使用 4 人；6-10 人通过服务端测试、全机器人对局与 320-1440px 视图 fixture 覆盖。
- 模式只能在开局前选择，这是所有带 Game Options 游戏的既有行为；已开局房间不提供中途切换。
- 全量测试的 11 项失败属于其他模块的既有失败，未在本次修复，也不宣称全库通过。

## 禁用已公开词（2026-11-08）

### 需求与规则

- 之前轮次里**任何人**公开过的词进入全场禁用表，从下一轮开始谁都不能再写，不分队伍或个人维度，组队模式和大乱斗规则一致。
- 同一轮内写相同的词仍然照常配对：组队模式的 Match 和大乱斗的撞词获胜完全不受影响，禁用只针对**已经亮过**的轮次。
- 比较沿用既有的归一化（NFKC、去首尾空白、合并中间空白、大小写折叠），所以 `Red`、`RED`、`  Red `、`ＡＰＰＬＥ` 视为同一个词。
- 服务端拒绝时不改变任何状态并回 `system:error`，`skip_validation` 也无法绕过。

### 服务端

- `game/word_sync.py` 新增 `_revealed_words()` / `_used_words()` / `_used_word_list()`，按（轮次, 队伍座位, 词序）排序，保证展示顺序稳定且同队两词不被打乱。
- `apply_action` 在 `submit_word` 归一化之后查禁用表，命中返回 `USED_WORD_MESSAGE`，不写入 `pending`。
- `get_public_view` 增加 `used_words`（按公开顺序去重）。它只由已亮词推导，不包含任何 `pending`，旁观者与对手看到的内容一致。
- 存档版本升到 2。`deserialize` 同时接受 1 和 2，只对版本 2 校验「同一个词只能出现在一个轮次」以及「pending 不得命中历史词」，因此改动前存档（可能含重复词）仍可加载；版本 2 的篡改存档会被拒绝。
- 练习机器人改为按 `BOT_WORDS` 取第一个尚未公开的词（候选用尽时回退到 `词N`），不再复用上一轮的词；全机器人局仍然最迟第 2 轮结束。

### 界面

- 输入框下方新增 `Used words · N` 一行：带删除线的胶囊标签，超出高度后限高滚动（桌面 80px / 手机 68px）。
- 输入到禁用词时立刻禁用 Lock word、把对应胶囊标红、并显示 `already used` 提示；客户端只做即时提示，服务端仍是权威。
- 猜词阶段和亮词阶段都显示，终局隐藏；第一轮没有已用词时整行隐藏。
- Help 的「什么算同一个词」「锁定与公开」「操作与练习」与 Explain 的 `word` 文案同步改写，新增 `used_words` 解释项。
- 顺带修复：离开游戏（切走或回到大厅）时关闭仍然打开的 Help 弹窗。

### 本次文件清单

- 规则：`game/word_sync.py`。
- 界面：`static/games/word_sync.js`、`static/games/word_sync.css`、`static/games/word_sync.html`。
- 前端接入：`static/game_assets.js`（资源版本）、`static/index.html`（加载器版本）。
- 测试：`tests/test_word_sync.py`、`tests/test_word_sync_integration.py`、`tests/word_sync.browser.cjs`。
- 文档：`designs/task183.md`（本节）。

### 实际检查结果

- `python3 -m unittest tests.test_word_sync tests.test_word_sync_integration`：35 项通过（新增禁用词跨队拦截、归一化变体、同轮重复仍可配对、`used_words` 视图顺序、版本 1 / 2 存档差异、房间层 `skip_validation` 仍被拒）。
- `python3 -m unittest tests.test_frontend_style_assets tests.test_frontend_script_names tests.test_game_dev_order tests.test_game_tags tests.test_ai_metadata`：12 项通过。
- 本机 Chrome headless + Playwright 运行 `tests/word_sync.browser.cjs` 全量通过：320 / 390 / 1024 / 1440px 下团队与大乱斗的全部 fixture 无横向溢出与组件重叠；新增断言覆盖 `Used words` 在第一轮隐藏、亮词与第二轮显示、终局隐藏、7 / 11 / 70 个标签、限高滚动、输入 `Red` / `RED` / `red` / `  Red  ` / `月亮` / `树` 均禁用提交且高亮唯一命中、禁用态点击不发送动作、换新词后恢复可提交。
- 真实 4 客户端联机（团队模式 2 轮结束、大乱斗撞词、房间切换、模式切换、断线重连、真人 + 机器人）全部通过。
- 截图：`tmp/word-sync-ui/used-words-320.png`、`used-blocked-desktop.png`、`used-blocked-mobile.png`、`used-ffa-mobile.png`。
- `node --check` 覆盖改动的 JS 与浏览器测试；`git diff --check` 通过。

### 未检查与例外

- 未使用实体 iOS / Android、Safari / Firefox、系统中文输入法与读屏验证；触摸与 IME 仍用浏览器事件模拟。
- 客户端的大小写提示用 `toLowerCase()`，与服务端 `casefold()` 在 `ß` / `ẞ` 这类字符上可能不一致；服务端始终是权威，误判只会多一次服务端拒绝。
- 版本 1 的旧存档不做跨轮唯一性校验（否则改动前的存档无法加载），只有版本 2 起才强制该不变量。
- `tests/word_sync.browser.cjs` 里 `#wordSyncDialog` 等选择器在共享帮助组件重构后已经失效，本次一并改为 `dialog.obg-help-dialog` / `dialog.obg-explain-dialog`；共享组件本身未改动。

