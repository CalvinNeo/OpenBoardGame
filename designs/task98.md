# Task 98 — Take Time（时序谜局）

## 范围与规则依据

新增 `take_time`，支持 2–4 人、房间机器人、私有视图和保存恢复。实现讨论、静默放置、揭牌结算、失败奖励、重试、遗憾封套和关卡进度的完整闭环。

依据：[Libellud 官方资源页](https://www.libellud.com/en/resources/take-time/)、[英文规则](https://cdn.svc.asmodee.net/production-libellud/uploads/2025/09/TT_RULES_EN_WEB.pdf)、[中文规则](https://cdn.svc.asmodee.net/production-libellud/uploads/2025/09/TT_RULES_CNS_WEB.pdf)；官方资源页的 PRESS KIT EN 中 `TT_LEAFLET_EN.pdf` 用于核对特殊规则。

当前内容：完整收录基础游戏官方 10 章、每章 4 关，共 40 个钟盘。11 个 Original practice 原创练习保留在独立路线，不混入官方顺序。钟盘事实配置放在 `game/assets/take_time/clocks.json`，依据[钟盘正面参考](https://github.com/JuggerC/taketime-web/tree/main/public/img/clocks)逐项录入，并使用[官方 PRESS KIT EN](https://cdn.svc.asmodee.net/production-libellud/uploads/2025/09/PRESS-KIT-EN.zip) 的 `TT_LEAFLET_EN.pdf` 核对图标和全部章节机制。未复制第三方代码或商业美术。Rebirth 是独立可选组合模式，不属于这 40 关，本次未实现。

## 规则与状态机

- 太阳 ☀️ 与月亮 🌙 各 1–12，共 24 张，每次重新洗牌并只发出 12 张。4 人各 3 张；3 人各 4 张；2 人各 4 张手牌和 2 张备用牌。两人都出过两张后，双方同时获得各自的备用牌。
- `discussion`：可以讨论，只能看到各人的牌背颜色。玩家点击 `Ready` 看自己的手牌，此后不可修改公共讨论计划；全员准备完才开始 `placement`。为线上便捷，公共计划通过六个时段的目标值点选完成，不能在看牌后编辑。
- `placement`：任意玩家可抢先放置第一张，随后按座位顺序轮转。每次选择自己的牌、六个时段之一和暗置／明置。团队基础明牌额度等于人数，失败后每次增加 1，最多增加 3。禁明牌钟盘不受奖励例外影响。
- 牌背颜色、放置顺序、所有者始终公开；暗牌数字只对所有者可见，其他人和观众只见牌背。牌 ID 使用与数值无关的随机标识；公开视图不包含洗牌种子、牌库、对手牌值或备用牌值。日志和机器人动作广播同样隐藏数字。
- `round_end`：最后一张落下后揭开全部牌，逐时段显示总和与每项通过／失败原因。每个时段至少一张，从指针起顺时针总和非递减（允许相等），通常不超过 24；官方入门钟盘无 24 上限，第一段恰好一张太阳、最后一段恰好三张牌。
- 区间、数量、颜色、最近目标、极值条件只在揭牌时判定，不通过“合法目标”预先透露隐牌。首尾位置和必须出最高／最低牌属于出牌限制，由服务端即时验证。
- 自由指针练习可在讨论时选择起点；结算时检测全部六个起点，保留原起点若可行，否则选择可通过的起点。差值练习要求每段恰好两张，以两牌差比较次序，其他条件仍使用牌面总和。
- 成功默认下一关；失败默认重试。尚未确认的玩家可选择 `Skip to Regrets`；任意继续方式变更都会清空已有的确认。必须所有玩家点击 `Next Round` 后才重新发牌。机器人只确认自己的席位；未连线真人也不会被自动跳过。
- 遗憾关卡在主路线之后依次重访；可以在结算界面结束本次旅程，只有所有人都确认才进入终局。所有收录关卡通过才显示完成；提前结束需明确展示未完成数量。成功和跳过清空奖励，重试保留奖励。

## 实现结构

- `game/take_time_data.py`：有来源标记的钟盘定义、说明、action/config schema。
- `game/take_time.py`：服务端状态机、严格类型与权限校验、结算、公共视图、可复现随机、仅使用自身视图的启发式机器人和深拷贝序列化。
- `static/games/take_time.js`：IIFE 私有状态；仅暴露带 TakeTime 前缀的接入函数。`static/take_time.css` 全部采用 `take-time-` 样式作用域。
- 在注册表、标签、HTML、面板切换与渲染分发中增量接入；隐藏机器人动作参数；运行 `scripts/gen_dev_order.py`。

## 前端要求（FRONTEND.md / task40.md）

- 深蓝与温暖金色的时钟主题，☀️／🌙 结合明显底色与文字；棋盘完全用 CSS 绘制，不使用商业 UI、美术或图片。
- 桌面棋盘与手牌／行动双栏，六个时段按顺时针环绕中心；小屏重新排为两列，附明显顺序编号。禁止横向滚动、覆盖和内容溢出。玩家名允许换行；日志限高滚动；动作紧凑且留足间距。
- 选牌、选时段、`Place face down`／`Place face up`；空白与 Esc 取消，无 Clear Selection。按钮和通用 UI 使用英文，规则文本可用中文。
- `Help` 完整规则对话框；`Explain` 捕获点击禁止原操作，仅有解释控件显示虚线与问号光标；disabled 按钮通过 pointerdown 坐标命中查看解释。解释后或 Esc 退出。原生 dialog 支持 Esc、遮罩关闭、焦点管理。
- 发牌后不在页面或 DOM 偷藏别人的牌值；当轮结算原位展示所有牌、分段结果与就绪人数，避免自动闪过。

## 验证计划

模块测试覆盖 2／3／4 人发牌及备用牌时机、看牌权限、首出竞争与轮转、明牌额度、隐私（包括 ID／日志／机器人广播）、结算各种条件与平局、重试／跳过／遗憾重访、全员确认、非法动作原子性、序列化和不读取隐藏信息的机器人。

由于接入全局注册与分发，运行房间会话、名称、标签、开发顺序和脚本命名检查。实际浏览器检查桌面和 375px／窄屏布局、选牌确认、Help、Explain（含 disabled）、Esc、结算等待，保存截图。纯 UI 调整不运行逻辑测试。

## 实施记录

方案完成后已直接实现并接入大厅，支持 2–4 人、机器人、存档恢复、分玩家隐私视图、全员确认后重试／继续和遗憾关卡重访。机器人会等待真人完成讨论准备，避免提前锁定公共计划。

- 自动验证：`PYTHONPYCACHEPREFIX=/tmp/take-time-pycache python3 -m unittest tests.test_take_time tests.test_room_session tests.test_game_names tests.test_game_tags tests.test_game_dev_order tests.test_frontend_script_names`，58 项全部通过，其中 Take Time 模块 26 项。新后端文件编译、四个接入脚本的 JavaScript 语法检查和 `git diff --check` 均通过。开发顺序已重新生成。
- 浏览器验证：实际建房、添加机器人、讨论计划修改、准备看牌、选牌／取消、暗置／明置、两人备用牌加入、完整 12 张揭牌、分段失败原因、结算停留、刷新恢复与全员确认结束均通过；Help、Esc、Explain（含 disabled 控件和手机移位后的按钮）正常，Explain 能阻止原操作。
- 布局验证：1280px 桌面，以及 320px、375px、768px 视口检查无页面横向溢出；桌面时钟各时段与中心无交叠，浏览器未报告控制台错误。
- 截图：[桌面出牌](../tmp/take_time_qa/desktop-playing.png)、[桌面揭牌](../tmp/take_time_qa/desktop-reveal.png)、[手机揭牌](../tmp/take_time_qa/mobile-reveal.png)。
- 初版内容为 1 个官方入门钟盘及 11 个原创练习。后续完整关卡与局内选关更新见下节。

## 官方完整关卡与局内选关

- 官方路线从所选关卡开始，按章顺序继续，最终进入遗憾重访。原创练习独立成线。保留旧版关卡 ID、显式 `start_clock` 配置和存档兼容，不改无关数据。
- 默认 Start 进入独立 `setup` 选关界面，不在 Room Control 或游戏主板放开局配置。`Levels` 按钮紧挨 Reconnect 右侧，打开章节选关弹窗，支持 Escape、遮罩关闭和焦点返回。
- 看牌前可以切换关卡。一人 Ready 后只能浏览，不可中断出牌。轮末选关是继续方式提案，清空已有确认，仍需全员 Next Round 后才进入新关。切关开始新路线，清空当前路线完成／遗憾记录和奖励，界面明确提示。
- 第 1 章仅前三关无 24 上限。第 2 章禁止数值只在揭牌验证，不通过合法落点泄漏暗牌。第 3 章两处最小牌标记检查两张最小牌分置，并支持太阳最小／月亮最大和最后一张落点。
- 第 4 章分别支持手中最大、最小和固定顺序最左牌。第 5／6 章每段恰好两张，第 6 章次序比较差值，但 24 上限、区间和最近目标仍比较总和。
- 第 7 章仅补牌图标时段立即从未发牌堆补牌，至全体手牌用尽结束，空手席位自动跳过，最后一张按真实最终出牌判断。牌堆及补入手牌的数值不向其他人公开。
- 第 8 章仅指定时段触发顺／逆时针旋转，已落牌保持原位，禁放规则随盘移动。8.4 印刷指针随盘旋转，其他可移动指针保持原位置。
- 第 9 章仅标记边界施加相等／至少相差条件，9.4 单独限制全盘总和极差不超过 4。第 10 章独立比较各段首张牌的非递减顺序，10.4 额外有秒针，初始禁放 3／6 段，每次出牌后顺时针前进一段。
- 新增机制纳入双语 Help，并通过 Explain 和规则文字的悬停／触屏提示解释。移除逐区块的独立信息图标，保持棋盘紧凑。

### 验收记录

- 修改文件：`game/assets/take_time/clocks.json`、`game/take_time_data.py`、`game/take_time.py`、`static/games/take_time.html`、`static/games/take_time.js`、`static/take_time.css`、`static/game_assets.js`、`static/index.html`、`tests/test_take_time.py`、`tests/test_room_session.py`、`tests/take_time.browser.cjs`、本文件。保留工作区其他任务和用户改动，不创建提交或分支。
- Chrome 320／390／1024／1440px 检查初始选关、弹窗、讨论、出牌和揭牌，40 关各 3 种局面共 480 次布局检查无页面横向溢出／内容溢出。人工复核桌面和手机截图，按钮同排且 Levels 位于 Reconnect 右侧。截图在忽略目录 `tmp/take_time_campaign_qa/`。
- 实际双客户端建房和启动、房间同步选关、390px 触屏点选、看牌后锁定切关、10.4 完整 12 张出牌、秒针落点、轮末提案、等待全员确认、切入 6.2、刷新重连、双语 Help、Explain 拦截和 Escape 均已验证。
- 自动检查：`python3 -m unittest tests.test_take_time tests.test_room_session tests.test_frontend_style_assets tests.test_help_contract tests.test_frontend_script_names` 107 项通过，覆盖全部 51 个官方／练习钟盘在 2／3／4 人机器人局的完整结算、新机制、隐私和存档恢复。另执行 JavaScript 语法、stub 初始化和 `git diff --check`。
- DEV_GUIDE 专项验收已覆盖布局、开局独立设置、Help／Explain、英文通用 UI 和轮末暂停。通用 `tests/game_assets.browser.cjs` 在首页脚本列表断言处失败：其仅预期 `shared.js`，现有首页还加载 `shared_effects.js` 和 `shared_help.js`，尚未进入 Take Time 检查。本次未修改无关测试，不能声称全部验收通过。Take Time 专用脚本验证了实际懒加载与刷新恢复。未在实体 iOS／Windows 设备及 Safari 上验证，浏览器验收为 macOS Chrome 与触屏模拟。Rebirth 组合模式不在此次 40 关范围。

### 当前关卡 Help（2026-11-26）

- 在基本规则之后新增双语“当前关卡 / Current level”页，直接读取当前公开钟盘定义，覆盖全部 40 个官方关卡和 11 个原创练习。先解释本关整体规则，再按实际时段编号列出牌色／张数、总和区间、最近目标、全场与花色极值、禁值、补牌、旋转和相邻边界。
- 明确总和与差值的区别、无上限例外、指定第几张与真正最后一张落点、两张最小牌分置、首牌独立起点、当前秒针禁放位置，以及旋转只移动规则而不移动已放牌。Help 不读取或显示任何暗牌数值。
- 切关、旋转或秒针前进时，已打开的当前关卡页同步更新，不重建标签栏或重置阅读滚动位置。尚未选关时提示先选钟盘，离房清理时关闭 Help。流程页同步修正为手牌与备用牌用尽后揭牌，避免与补牌关卡冲突。
- 本次修改：`static/games/take_time.js`、`static/game_assets.js`、`static/index.html`、`tests/take_time.browser.cjs`、本文件。仅修改游戏前端与资源版本，不改后端规则或公共样式，保留其他任务的本地改动。
- 验证：Chrome 320／390／1024／1440px，51 关中英双语共 408 次 Help 布局检查及 480 次既有钟盘布局检查通过。真实双客户端切关即时更新、12 次出牌的秒针同步且阅读位置不跳动、旋转后时段规则、无特殊时段练习、尚未选关提示、语言切换、重开与 Escape、离房清理、既有 Levels／Explain／刷新重连均通过。目视复核手机和桌面截图，保存在 `tmp/take_time_campaign_qa/help-*.png`。
- 前端样式、Help 契约、全局命名共 14 项测试通过，另通过游戏／清单／浏览器脚本语法、stub 初始化和 `git diff --check`。UI-only 改动不重复运行游戏逻辑测试。本次修改的 DEV_GUIDE 布局与交互要求已验收；未检查实体 iOS／Windows 或 Safari，上一节记录的通用懒加载浏览器测试失败仍未修复，不宣称整个项目全部验收通过。
