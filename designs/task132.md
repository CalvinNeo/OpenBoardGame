# Task 132：出神入画 / Mind the Lines

## 游戏范围与依据

实现 `mind_the_lines`，即 Die 7 Bazis 的 **Krakel Orakel / Mind the Lines（出神入画）**，2–8 人合作游戏。采用基础玩法及 2–3 人双词变体，不包含扩展。依据[原版出版规则书](https://www.die-spieltruhe.de/img/products/docs/119-071_1_Anleitung.pdf)、[英文规则译本](https://nastol.io/storage/games/files/krakel_orakel/941292/Krakel_Orakel_rules.pdf)与[作者介绍](https://www.7bazis.de/ver%C3%B6ffentlichte-spiele/krakel-orakel/)。不照搬商业美术、实体画板或完整商业词卡；使用程序生成的原创线稿与原创中英双语词库，并在 Help 中注明。

每局最多 4 轮。所有人查看自己的秘密词语，准备完成后同时开始 2 分钟描画，只能利用画板已有线条，禁止字母、文字、数字和暗示。4–8 人每人一词；2–3 人每人两词，画在同一张画板上，不标注哪一部分属于哪个词。全员提前提交可提前结束。随后将真实词卡和等量干扰词混合公开，展示所有画作，按顺序每人排除一词；双词模式轮流两圈。过程中不交流线索，被排除的词是否真实答案也不立即揭示。排除完毕统一认领、计算误排真实词数。累计错误超过玩家人数立即失败，否则完成四轮获胜；等于人数仍可获胜。首位玩家轮流顺移。

轮末停留在结果画廊，展示词语归属、排除者、本轮和累计错误；所有席位点击 **Next Round** 才进入下一轮，并清空画迹、将画板顺时针传给下一人。机器人只确认自己的席位，断线真人须重连确认。最终结果保持可查看。除标准 120 秒外，提供 180 秒与不限时练习配置，明确标注为线上便利选项。实体版由最近看过艺术品的人开始；线上默认首个座位开始，随后逐轮顺移。

## 后端方案与接口

新增 `game/mind_the_lines.py`、`game/mind_the_lines_data.py`，实现标准游戏接口及服务器超时结算。状态机为 `ready → drawing → oracle → round_result / game_over`。每人分配双面原创画板；线稿由短线段组成，客户端画笔吸附已有线段，服务端只接受合法线段编号、面与方向，不能提交自由坐标、图片或额外笔迹。画板与秘密词的生成独立。保存每人最新草稿；计时结束自动锁定草稿，断线不阻塞猜测阶段。

动作：`ready`、`save_drawing`、`submit_drawing`、`eliminate`、`next_round`。所有动作带 `round_token`；草稿／提交带单人递增 `seq`，排除带 `revision`，防止旧轮请求、乱序草稿和重复点击。非法动作原子拒绝。`resolve_timeout(state, now_ms)` 只处理当前已到期绘画，返回公开事件。配置为 `difficulty: easy | hard`、`draw_seconds: 0 | 120 | 180`，可用私有 seed 做确定性测试。

前后端视图约定：`game_id, phase, round, total_rounds, round_token, revision, config, you, players, current_turn, deadline_ms, server_now_ms, errors, error_limit, words_per_player, legal_actions`。玩家项含 `player_id, name, is_bot, ready, submitted, next_round_ready`。本人独享 `your_words: [{id, zh, en}]`、`your_board: {id, sides: [segments, segments]}`（每条线段为 `[x1,y1,x2,y2]`，坐标 0–1000）、`your_drawing: {segments: [id], side, rotation, seq}`。公开阶段另有 `drawings: [{player_id, board_id, lines, segments, side, rotation, words?}]`，`cards: [{id, zh, en, eliminated_by?, owner_id?}]`；`owner_id` 和画作 `words` 只在结算公开。`last_round_summary` 包含本轮错误及完整认领。绘画期不公开其他人的草稿；事件不包含私密词、草稿或牌库。旁观者无私密数据、无合法动作。

机器人只使用自身视图：描画用原创轮廓映射到已有线段，排除参考公开画作和自己的词，不读取真实答案归属。定位为基础练习机器人，不宣称理解任意人类绘画。序列化保留草稿、截止时间与轮号。接入房间目录、标签、机器人、服务器计时器、重连及活动存档下载／克隆隐私保护，隐藏公开配置里的 seed，刷新 `game/dev_order.json`。

## 前端方案（遵守 FRONTEND.md 与 task40.md）

新增 `static/games/mind_the_lines.{html,css,js}`；在 `GAME_ASSETS` 注册按需加载脚本、独立 CSS 和模板。首页只添加空面板、页头、配置与弹窗占位；公共代码仅接入 renderer 和开局配置。脚本使用 IIFE，仅暴露 `MindTheLines` 前缀入口，兼容延迟加载及首状态回放。

- 采用暖纸色画板、墨色线条、紫色强调色，Emoji 与文字共同展示词语（🔒）、时间（⏳）、画板（✏️）、错误（❌）。游戏外操作文案英文，游戏词语中英双语。
- 绘画区保持正方形，鼠标／触摸拖动吸附虚线，固定笔宽，无填充与自由画笔。支持 Eraser、Undo、Flip、Rotate、Submit。触摸仅在画板内使用 `touch-action: none` 与指针捕获；抬起／取消正确结束，区域外保留滚动。单次笔画完成即保存草稿，移动时节流保存，刷新恢复；切面和旋转可撤销。
- 猜测时画廊与候选词紧邻；点击画作可放大查看，词卡点选后出现 Eliminate／Cancel。空白或 Esc 取消未提交选择，不加入 Clear Selection。自己绘画、准备进度、当前行动者和轮末等待进度清晰可见。
- 桌面双栏，手机重排为紧凑单栏／双列词卡，320px 宽度仍无横向滚动、文字或 Emoji 溢出；长姓名可换行，历史记录内部滚动。
- Help 集中完整规则、特殊人数、计时选项及数字化差异；Explain 进入后再点对象解释。捕获阶段拦截包括无说明按钮在内的操作，disabled 按钮也能通过 pointerdown 坐标命中解释，仅有说明的目标显示虚线与问号。解释后自动退出，Esc 关闭／退出并恢复焦点，不逐区增加 i 图标。
- 静态图标／指标有鼠标悬停与键盘焦点说明，手机点击显示 3 秒浮层，新提示替换旧提示。图标和名称在 Help／Explain 中同时列出。弹窗支持 Esc、背景关闭及焦点管理。

## 验证计划

规则测试覆盖 2–8 人、双词轮次、四轮／提前失败／阈值平局、误排计分、轮流排除、全员确认、服务器超时与提前提交、草稿保存／乱序／重连、线段／面／方向验证、旁观隐私、事件与 seed 隐私、非法动作原子性、序列化及多人数机器人完整对局。集成测试覆盖目录、房间开局、计时调度、广播、机器人和存档保护。

涉及共享注册和分发，运行相关共享回归和模块测试；按 FRONTEND.md 不为纯 UI 改动运行逻辑测试。浏览器验证实际开局、绘画、排除、结算、刷新恢复、Help／Explain、禁用按钮、移动端拖动与提示，检查 1440／390／320px 布局及无脚本错误。保留工作区现有未提交的 Power Grid 和其他文件修改。

## 实施记录

已完成，游戏目录可选择 **Mind the Lines · 出神入画**。

- 后端实现 2–8 人、双词变体、全员准备、标准／练习计时、保存与锁定草稿、轮流排除、统一认领、四轮合作胜负、全员 Next Round、传板与起始玩家轮换。两档原创词库各 64 词，共 128 个中英双语词；每块双面画板独立生成不规则线网和 7 条弯曲长线，不含由答案决定的图形。
- 服务器校验线段编号、面、方向、草稿序号、轮 token 和猜测 revision；草稿乱序不会覆盖新稿，重复确认／提交／排除不重复计分。公开事件、旁观视图及房间配置不泄露其他人的词语或草稿。活动存档下载和克隆受保护，已过期存档冷恢复后也会自动结束绘画。
- 基础机器人以原创物体轮廓描画，通过公开线稿与候选轮廓作近似比较；不读取他人词语或真实归属。空间分桶及有限缓存减少计算。真人持续保存不会取消其他席位正在完成的机器人绘画；仅此独立动作放宽房间整体版本比较，仍校验所属轮次、个人序号和截止时间。
- 前端采用独立按需加载资源，完成触摸吸附描画、擦除、翻面／旋转／撤销、保存恢复、画作放大、点选词卡后确认、完整 Help／Explain、禁用按钮说明和手机三秒提示。窄屏画廊与词卡采用内部竖向滚动，长姓名正常换行。无商业美术依赖。
- 数字化差异：原创词库／线网；线上首轮默认第一个座位；预设短线段是最小描画单位；3 分钟和不限时仅为练习选项。单次翻面清空笔迹，可 Undo 恢复。刷新恢复服务器已收到的草稿，浏览器 Undo 历史不跨刷新保存。界面显示当前轮完整认领与累计错误，不提供逐轮画廊回放。

验证结果：

- `python3 -B -m unittest tests.test_mind_the_lines tests.test_room_session tests.test_game_names tests.test_game_tags tests.test_game_dev_order tests.test_frontend_script_names tests.test_frontend_style_assets tests.test_bot_threading`：**66 项通过**（24 项模块测试＋42 项共享回归）。
- `python3 -B -m unittest tests.test_mind_the_lines_integration -v`：**14 项通过**。共 **80 项通过**；包含过期存档恢复、离线绘画超时、持续自动保存期间机器人仍能提交的回归。
- 模块测试覆盖 2／3／4／8 人机器人完整四轮、双词两圈、错误恰等于人数获胜和超过人数失败、传板、非法动作原子性及视图隐私。
- `tests/mind_the_lines.browser.cjs`：两个独立 Chrome 上下文实际完成四轮，验证鼠标／手机触摸、草稿刷新恢复、擦除／翻面／旋转与撤销、Help／Esc、Explain 的禁用按钮和无说明按钮拦截、提示替换与三秒消失、全员确认等待。真实页面及额外 8 人／长姓名／旁观视图在 **1440／390／320px** 检查通过，无页面横向滚动、元素横向溢出或脚本错误。
- `tests/game_assets.browser.cjs`：按需加载、重连、离开再进入、HTML／CSS／脚本失败重试、样式覆盖顺序、过期房间请求回归全部通过。
- 修改脚本的 `node --check` 与 `git diff --check` 通过；`python3 -B scripts/gen_dev_order.py` 已刷新开发顺序（第 97 项）。
- 验收截图及 8 人视图数据位于 `tmp/mind-the-lines-qa/`。已修复浏览器验收发现的 Explain 关闭后吞下一次点击、离线画稿处理、计时器重启等问题；未改写既有 Power Grid 工作内容。

## 游戏列表可见性补查

- 当前后端目录返回 97 款游戏，包含 `mind_the_lines / Mind the Lines / 出神入画`。本地浏览器中文搜索可命中，并可从列表成功创建房间。
- 修复公共列表缓存：每次打开 Create Room 清除页面内的旧目录，并通过 `cache: "no-store"` 重新获取；同一次打开期间的搜索和筛选仍复用目录，并发请求仍合并。更新 `room.js` 首页资源版本至 `app_v60`。
- 已验证“页面预载旧目录 → 服务增加新游戏 → 再次打开列表能找到新游戏”，以及筛选复用、请求失败重试和并发合并；42 项共享回归、JavaScript 语法及差异检查通过。
- 以上验证针对本地工作区；尚未取得用户实际访问的网址，不能据此认定其运行中的服务已更新。
