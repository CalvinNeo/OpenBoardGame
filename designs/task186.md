# Task 186：铁路环游（Ticket to Ride）

## 玩法方案

- 还原 Alan R. Moon 2004 年《Ticket to Ride》**北美基础版**（Days of Wonder），2–5 人。BGG Weight 1.82（`scripts/bgg_weight_scrape.py` 实测 1.8179）。
- 地图为 36 座城市、100 段线路、30 张目的地车票，全部按公开出版的北美地图逐条录入：
  - 线路颜色分布为 8 种颜色各 7 段 + 44 段灰色（🎨 任意颜色），共 100 段；其中 22 组为并行双线。
  - 长度 1–6，分值 `1→1 · 2→2 · 3→4 · 4→7 · 5→10 · 6→15`。
- 组件：110 张火车牌（8 色各 12 张 + 14 张 🚂 Locomotive 万能牌）；每人 45 辆 🚃 车厢、4 张起手牌、3 张 🎫 车票（至少保留 2 张）。
- 每回合三选一：
  1. **抽火车牌**：抽 2 张，明牌／牌堆任意组合。拿走明牌中的 🚂 时本回合只能抽这一张；从牌堆抽到 🚂 仍可再抽一张。明牌被取走后立即补牌；明牌同时出现 3 张 🚂 时全部弃掉重发。
  2. **认领线路**：打出与线路长度相同的同色牌，🚂 可补足差额。灰色线路可用任意一种颜色，但所有牌必须同色。
  3. **抽目的地车票**：抽 3 张，至少保留 1 张，其余放回牌堆底。
- 双线规则：同一玩家永远不能占同一对双线的两条；2–3 人局中一条被占后另一条对所有人关闭，4–5 人局两条都可被不同玩家占据。
- 终局：有人回合结束时 🚃 降到 0／1／2，进入 Final Round，**每位玩家（含触发者）再行动一次**，然后结算。该条以 Days of Wonder 英文规则为准（多方信源在此处说法不一致，已按官方规则书写并写入单元测试）。
- 结算：线路分 + 完成的 🎫 分值 − 未完成的 🎫 分值 + 最长连续线路 10 分。最长线路可绕圈、可重复经过同一城市，但同一节车厢不能算两次；并列者都得 10 分。平分先比完成的 🎫 数量，再比是否持有最长线路。

## 判定与校验

- 服务端全量校验：回合归属、阶段、抽牌来源（`deck` / `face_up`）、明牌下标、支付牌型、手牌持有量、剩余车厢、双线归属。
- 支付牌型归一化后必须满足：总张数等于线路长度；除 🚂 外最多一种颜色；该颜色必须等于线路颜色（灰色线路除外）。
- 抽牌堆耗尽时把弃牌堆洗回；两堆都空时不再允许抽火车牌，`get_legal_actions` 只返回其余选项，全都没有时返回 `pass`。
- 车票保留数量：开局 ≥ 2，游戏中 ≥ 1；未保留的票放回牌堆底。
- 所有动作都带 `revision`；`setup` 阶段是同时选票，为了容忍并发提交，该阶段不校验 `revision`。
- 种子只留在服务端：`ticket_to_ride` 已加入 `app.py` 的 `game_config` 过滤白名单，避免洗牌种子被广播出去。

## 状态与并发

- `phase`：`setup`（同时选票）→ `playing` → `final_round` → `game_over`。
- `stage`：`action` → `drawing`（`draws_left` 剩余抽数）／`choosing_tickets`（`pending_tickets` 待选票）。
- `order` 是从起始玩家开始的座位顺时针序列；`final_turns` 记录终局还剩谁没行动。
- 私有信息：手牌、已保留车票、待选车票只在 `get_public_view` 里对本人返回；`game_over` 后全部公开。`app.py` 的 `_public_bot_action` 对本游戏只回传 `type`，防止 Bot 的选票被广播。
- 公开信息：`claimed` 线路归属、明牌、牌堆／弃牌堆张数、每人车厢数与手牌张数。抽牌堆顺序与票堆顺序从不出现在视图里（浏览器测试断言 `'deck' in view === false`）。

## Bot

设计约 190 行，按 DEV_GUIDE 要求直接写在本文件，不另开文档。

- **规划**：对每张未完成的车票，在「对手已占与自己占用的双线兄弟线路」被剔除的图上跑 Dijkstra；**自己已铺的线路代价为 0**，因此规划天然识别已完成的部分，不会重复铺路。这是关键修正：早期版本把自己已占线路当作障碍，导致自对弈 30 局的车票完成率只有 12.1%。
- **认领优先级**：`线路分/长度 + 0.20×长度` 为基础分，在车票路径上的线路额外 `+8`（长票再 `+3`），一端已接到对手网络的再加 `0.7`。只要规划内的线路付得起就立刻认领；规划外的高分线路只在手牌冗余（≥26 张）、车票全部完成或已进入终局时才铺。
- **抽牌**：按规划缺口给明牌打分，🚂 在手牌 < 26 张时权重最高；第二次抽牌时明牌 🚂 被服务端拒绝，改为抽牌堆。
- **选票**：枚举所有合法子集，代价为并集里尚未占用的线路总长度，得分 `Σ分值 − 1.35×代价 − 4×超预算`，预算为剩余车厢 − 10（开局）／− 6（局中）。中盘抽票很保守（仅在当前车票全部完成且车厢 ≥ 30 时才会抽）。
- 实测（每种人数 6–8 局自对弈）：车票完成率 **99.4%**，胜者平均 99–109 分（区间 88–128），剩余车厢 1.7–3.5 辆，与真实对局分布一致。

## 交付文件与显示约定

- 后端：`game/ticket_to_ride_data.py`（地图静态数据）、`game/ticket_to_ride.py`（规则引擎）、`game/ticket_to_ride_ai.py`（Bot）；注册在 `game/definitions.py`、`game/__init__.py`、`game/tags.py`、`game/ai_metadata.py`、`game/dev_order.json`；`app.py` 增加种子过滤与 Bot 动作脱敏。
- 前端：`static/games/ticket_to_ride.{html,css,js}`，接入 `static/game_assets.js`、`static/index.html`、`static/app.js`、`static/room.js`（`GAME_WEIGHT = 1.82`）；BGG 链接登记在 `scripts/bgg_weight_scrape.py`。
- 界面主体是 SVG 地图：线路画成一串车厢格，已被认领的填成玩家颜色，可认领的加粗描边。城市名的摆放位置由离线求解器逐城计算（`tmp` 脚本，代价 = 与其他标签的重叠面积 ×4 + 与线路段的重叠 ×0.55 + 偏移距离），36 个标签互不重叠、也不压住线路；偏移超过 15 单位时补一条虚线引线。
- 【原地确认】点地图上的线路会在该线路上方弹出 Claim／Cancel 蒙版；支付方案每种可用颜色只给一个「尽量少用万能牌」的组合，再配 🚂 加减器在「同色牌 ↔ 万能牌」之间调整，因此不需要穷举 26 种组合。
- 点击地图空白处或按 Esc 取消选择，不提供 Clear Selection 按钮。
- Help 与 Explain 统一走 `static/games/shared_help.js`（`designs/task40.md` + `designs/help_explain_guide.md`），满足六条要求：内置中英切换（R1）、`basic` 三句基本规则（R3）、五个章节自动出 tab（R6）、图标一律写成 `车厢(🚃)` 形式（R4）、终局与计分单独成章（R5）。
- 图标：🚃 车厢、🃏 手牌、🎫 车票、🚂 万能牌、🎨 灰色线路、🂠 抽牌堆、♻️ 弃牌堆、🏆 获胜。
- **没有任何「ACTION」区**（DEV_GUIDE「通用的交互」）。三个回合行动全部在各自板块内完成：
  + 抽火车牌 → 直接点 CARD MARKET 里的明牌或牌堆(🂠)。
  + 认领线路 → 点 MAP 上的线路，线路名、支付方案、🚂 加减器、Claim／Cancel 全部落在那条线路旁边。
  + 抽目的地车票 → `🎫 Draw 3` 按钮在 YOUR TICKETS 标题行；抽到的 3 张票就地出现在该板块顶部，勾选后按板块内的 `Keep N` 确认。
  选票从弹窗改成板块内内联，是一个实质性改进：新票下方紧接着显示已保留的车票，玩家可以直接判断新票是否与旧票顺路，而这正是这个决策需要的上下文，弹窗会把它挡住。板块在待选时加橙色描边提示。
- 整个游戏因此没有弹窗，`ticketToRideDialog` 已从 `static/games/ticket_to_ride.html` 与 `static/index.html` 中移除。
- 地图视口遵守 DEV_GUIDE「对特殊前端元素的要求 → 地图」：
  + **放缩 / Fit / Origin**：`−` `+` 缩放，`Fit` 把整张地图收进视野，`1:1` 按原始比例显示（一个地图单位对应屏幕一个像素）。
  + **padding 禁止太大**：视口不再用整块 `0 0 1000 640` 画布，而是按 36 座城市圆点与标签的实际包围盒求解，默认视图去掉约 21% 的空白边距。
  + **手机端尽可能占据一屏**：新增 `⛶` 全屏地图模式，只保留缩放控件与认领面板，其余板块全部 dock 掉。由于棋盘比手机屏幕宽得多，全屏模式把 viewBox 贴合屏幕比例，横向裁切并由拖动浏览，避免上下留出大片空白；非全屏时地图高度为 `clamp(240px, 42vh, 420px)` 并同样以填充方式取景，`Fit` 仍可一键看全图。
  + **电脑端地图优先展示**：两列布局改为 `1.75fr / 1fr`，地图高度上限 `min(64vh, 640px)`。
- 手机端顶部状态压缩为一行（回合 + 轮到谁 + 牌堆信息），四项统计在窄屏隐藏文字只留图标与数字。

## 验收记录（2026-11-08）

- 修改文件：`game/ticket_to_ride_data.py`、`game/ticket_to_ride.py`、`game/ticket_to_ride_ai.py`、`game/definitions.py`、`game/__init__.py`、`game/tags.py`、`game/ai_metadata.py`、`game/dev_order.json`、`app.py`、`scripts/bgg_weight_scrape.py`；`static/games/ticket_to_ride.{html,css,js}`、`static/game_assets.js`、`static/index.html`、`static/app.js`、`static/room.js`；`tests/test_ticket_to_ride.py`、`tests/ticket_to_ride.browser.cjs`、`tests/ticket_to_ride_live.browser.cjs` 和本方案。
- `python3 -m unittest tests.test_ticket_to_ride`：30 项通过。定向回归（frontend_style_assets / game_dev_order / game_tags / ai_metadata / game_names / frontend_script_names / room_session）：98 项通过。
- 视口检查 320 / 390 / 1024 / 1440 px，覆盖 `setup`、`setup_waiting`、`turn`、`claim`、`drawing`、`waiting`、`tickets`、`over`、`long_names`、`two_players`、`five_players` 共 11 个合成视图，另加板块内选票、选中线路、Help 弹窗、全屏地图四个交互态：均无横向溢出、无板块重叠、无内容溢出容器，Help／Reconnect 按钮不换行。
- 无 ACTION 区验收：页面里不存在 `.ttr-dialog` 或任何独立操作栏；选票态断言 `#ticketToRideTickets` 内同时有 3 张待选票与 2 张已保留票、`Keep N` 按钮在板块内、抽票按钮在待选时隐藏。
- 地图视口断言：`Fit` 的 viewBox 宽度落在 900–1010 之间且左边距被裁到 20 以内（证明按内容取景而非整块画布）；`1:1` 的 viewBox 宽度与地图元素像素宽度相差 < 2；手机端首屏 viewBox 宽度 < 900（证明是填充取景而非上下留白）；全屏模式地图高度 > 500px。
- 交互检查：Help 中英切换与章节 tab、Explain 模式（含对 disabled 元素解释）、Esc 关闭、桌面悬停提示、手机点击 3 秒提示、点空白取消选择、地图拖动不误选线路、地图触摸拖动不滚动页面（`scrollY === 0`）、明牌 🚂 作为第二张时被禁用、Claim 后发出合法的 `claim_route` 动作、Fit／1:1／全屏三个视口控件的往返切换。
- 真实服务端端到端（`tests/ticket_to_ride_live.browser.cjs`）：建房 → 加 2 个 Bot → 开始 → 选票 → 58 个真人回合（抽牌／认领线路／抽车票交替）→ 终局结算，全程无 `system:error`、无 pageerror；并断言选票期间其他玩家的手牌与车票始终为 `null`。
- 全量 `python3 -m unittest`：在 `HEAD` 的干净 worktree 上跑过基线，11 项失败（ark_nova_integration 5、ark_nova_maps 1、guandan_bot 1、halli_galli 4）与本次改动无关；本次改动后失败数与基线一致，未新增失败。
- 未检查：iOS / Android 真机；本机无 Playwright，用 `playwright-core` + 系统 Chrome 跑两个 `tests/*.browser.cjs`。
- 保留例外：Room Controls 收起时，游戏 Explain 按钮会被移入 RC 的 Dock（`designs/room_control.md` 规定行为），因此面板头部只并排显示 Help 与 Reconnect。
