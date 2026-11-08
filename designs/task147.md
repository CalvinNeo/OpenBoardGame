# Task 147：心意相通 / The Mind

## 目标与规则依据

按 Wolfgang Warsch 的《The Mind》标准版实现心意相通：2–4 人合作、保持安静，以共同的时间感把 1–100 的牌升序打出。用户未指定扩展，采用标准正面出牌模式；不包含 The Mind Extreme 或通关后的可选盲打挑战。

规则参考：[The Mind 规则全文](https://www.ultraboardgames.com/the-mind/game-rules.php)。未使用商业卡图或 UI 素材，牌面由数字、Emoji 和原创 CSS 绘制。

## 规则与线上适配

1. 2／3／4 人分别从 2／3／4 条生命（❤️ Lives）、1 枚飞镖（🌟 Throwing star）开始，目标是通过 12／10／8 关。每关重新洗全部 100 张牌，每人获得与关卡数相同的手牌。
2. 发牌后全员点击 Ready 集中注意力；全部准备完毕才可出牌。无固定轮序、无倒计时或建议出牌时刻，不自动替真人出牌。每次只能打自己最小的一张，使用固定的大按钮直接出牌，避免二次确认破坏节奏。
3. 服务端依收到动作的顺序结算。若有人仍持有更小的牌，全队只扣一次生命，所有小于刚打出数字的手牌公开弃置。尚有生命则暂停回顾、全员重新 Ready，继续当前关；生命归零立即全员失败，不能用本关奖励复活。
4. 任何玩家可 Stop 暂停并重新集中。手牌出完的玩家仍参与准备、飞镖决定与轮末确认。
5. 有飞镖时任何人可请求使用，申请者视为同意，其余人分别同意或拒绝。投票时冻结出牌；任一人拒绝则不消耗飞镖，全员重新集中；全员同意则扣一枚、每人公开弃掉自己最小的一张，再暂停回顾。空手玩家不弃牌。
6. 所有手牌出完就通过本关，包括失误清理／飞镖弃牌后出完。第 2／5／8 关奖励一枚飞镖，第 3／6／9 关奖励一条生命；生命上限 5、飞镖上限 3。结算显示全员出牌、失误弃牌、飞镖弃牌及奖励，突出本人记录。
7. 关卡结算后停留原桌面，全部席位点击 Next Round 后才重新发牌，之后再全员 Ready。最后一关直接展示合作胜利；Next Round 不二次确认。
8. 不提供游戏内数字交流或表情暗号；Help 明确禁止交流牌值、约定信号和数秒。现有房间系统日志仅记录已经发生的公开行动。真人断线仍保留确认资格，重连后继续。
9. 支持练习机器人：只使用个人视图、公开牌堆与内部时间感，不读取其他人的手牌或牌库。服务端定时检查是否愿意出牌，不广播机器人等待时刻或提前透露下一位出牌者；机器人只确认自己的席位。机器人是线上练习适配，不宣称复刻人与人的默契。

## 状态与接入

新增 `game/the_mind.py`，实现标准 init_game / get_legal_actions / apply_action / get_public_view / bot_move / serialize / deserialize。状态包括 focus、playing、star_vote、round_end、game_over；所有动作校验局 token 与阶段窗口。相同出牌窗口允许不同玩家并发，重复出牌、重复确认和跨阶段旧请求拒绝且无副作用。

公开视图仅包含各人剩余牌数、准备／投票状态及已公开的出牌／弃牌。只向本人发送其手牌；随机种子、未发牌与他人手牌不进入视图、事件或房间配置。活动存档禁止下载和克隆，凭原座位令牌恢复。每关洗牌使用可保存的种子与关卡号，保存后恢复不会改变后续发牌。

注册名称、人数、合作／轻量标签与开发顺序；首页只增加空面板、页头与弹窗挂载点。公共代码只增加必要的状态分发、存档保护以及实时机器人轮询分支，不改变其他游戏玩法。

## FRONTEND.md 与 task40.md

新增 `static/games/the_mind.{html,css,js}` 并在 GAME_ASSETS 按需注册。脚本采用 IIFE，公开入口带 TheMind 前缀；支持 DOMContentLoaded 后加载并同步已有房间状态，更新资源版本。

原创深靛蓝桌面、奶油色数字牌、薄荷绿操作区；桌面中央公开牌堆，上方紧凑资源与队友席位，下方自己的手牌和大出牌按钮，旁侧为有高度上限的公开记录。移动端重排为单列，手牌自动换行并内部滚动，320px 起不横向溢出，长名字断行。

一般界面文案用英文；中文游戏名与规则说明可保留。详细规则只在 Help；Explain 捕获交互、仅高亮可解释目标，禁用按钮也可查看，解释一次或 Esc 退出。静态 Emoji 与状态提供悬停／焦点提示，手机点击提示三秒后关闭且新提示替换旧提示。Help 与 Explain 同时写出 Emoji 和名称，不铺设 i 图标。弹窗支持 Esc、点外关闭和焦点返回。无 Clear Selection 按钮。需要本人准备、投票、出牌或下一关确认时，为收起的 RC 加红边框。

## 验证计划

- 规则测试：2–4 人设置、洗牌与隐私、无轮序／最小牌限制、并发／重复／过期请求、失误多张只扣一命、濒死与空手、暂停／重新准备、飞镖全员投票／拒绝／空手、奖励与上限、轮末屏障、胜负及 JSON 保存恢复。
- 机器人测试：仅个人视图、时间等待、不修改状态、完整对局；房间集成覆盖目录、分玩家广播、真人事件脱敏、定时机器人、热／冷重连和活动存档保护。
- 执行 `python3 scripts/gen_dev_order.py`，运行受公共接入影响的房间、注册与前端资源检查。保持已有游戏开发顺序。
- 浏览器验证真实多人房间全流程、按需加载、刷新恢复、Help／Explain／Esc／三秒提示、RC 红框，检查 1440／390／320px 关键阶段与长名字的页面／容器溢出，保存并查看截图。

## 实施记录

已完成服务端规则、私有视图、同时出牌窗口、失误／飞镖／奖励、轮末全员确认、机器人轮询、房间存档保护，以及 `static/games/the_mind.{html,css,js}` 按需加载。注册名为 `the_mind`，开发顺序追加为 108。所有对外事件只记录“谁做了什么”，不携带机器人等待时间或牌值；牌值只在牌已经公开后进入公共视图。

验证结果：

- `PYTHONDONTWRITEBYTECODE=1 python3 -m unittest tests.test_the_mind`：6 项通过，覆盖人数／关卡、最低牌约束、过期动作、失误清理、飞镖投票、奖励、回顾屏障和保存恢复。
- `PYTHONDONTWRITEBYTECODE=1 python3 -m unittest tests.test_the_mind tests.test_room_session tests.test_game_dev_order tests.test_game_names tests.test_game_tags tests.test_frontend_script_names tests.test_frontend_style_assets`：46 项通过（在工作区另一项 Compress 游戏加入前）；当前 The Mind／注册／名称／标签／脚本子集 14 项通过。
- `node --check static/games/the_mind.js`、`python3 -m py_compile game/the_mind.py app.py`、`git diff --check` 通过；已运行 `python3 scripts/gen_dev_order.py`，并保持既有游戏顺序、将本游戏置于 108。
- 已用 DummySio 验证真实房间开局、全员 Ready、多人私有视图广播、机器人等待／出牌与 The Mind 存档恢复路径。当前环境没有 Playwright 浏览器运行时，因此未保存浏览器截图；静态 CSS 资源与前端脚本命名检查已通过。

工作区备注：另一项并行的 Compress 游戏后来加入了新的 style fragment，但尚未补充公共样式占位，因此全局 `test_frontend_style_assets` 会报告该并行改动；本游戏使用独立 `styles`，不需要公共占位组。

范围说明：实现标准正面出牌版，不含 Extreme 版、通关后的盲打挑战和语音／聊天同步。线上版没有倒计时，机器人使用延迟模拟练习伙伴，不能代替真人默契。

## UI 优化（2026-11-07）

按 DEV_GUIDE.md 的前端要求、交互要求与 UI Acceptance Gate 重做界面，规则与服务端逻辑未改动。

### 结构与布局

- 去掉 `.tm-surface` 这层嵌套框：整块 `.game-panel` 通过 `data-game-theme="the_mind"` 直接变成深色桌面，页头标题由 `panelTitle` 换成「🧠 心意相通」，Help／Explain／Reconnect 均 `nowrap`。面板内不再有大框套小框。
- 删除主界面的大段装饰与规则文字（`COOPERATIVE SYNCHRONIZATION` 眉标、副标题、`Feel the moment.`/`No turns. No countdown…` 说明段），规则全部留在 Help。
- 竖向重排为：状态条 → 关卡进度轨 → 席位 → 桌面（牌堆＋轨迹＋弃牌＋公告）→ 行动区 → 手牌 → 结算回顾；共享日志收进右侧（窄屏移到末尾）可折叠 `<details>`，有高度上限且重绘后保持展开状态。
- 突出主体：牌堆卡与 `▶️ Play n` 大按钮是视觉重心；手牌用 `auto-fill` 保持卡片尺寸，宽屏不再被拉伸。

### 交互与信息

- 新增「RECENT PLAYS」按席位配色的最近出牌轨迹与「DISCARDED」明牌弃牌区，让同时行动的每个人都能看到别人刚做了什么；失误公告直接列出被弃的牌。
- 状态条用 ❤️／🌟 圆点串表示生命与飞镖，并补齐图标提示：桌面端悬停显示、手机端点按显示并在 3 秒后自动消失、键盘聚焦同样可读；席位手牌数改用 CSS 绘制的牌背图标，避免 `🂠` 在 Windows 上缺字。
- 手牌卡片改为非交互元素（原先只有最小牌可点的按钮点不出任何结果），最小牌高亮并标注 PLAY；出牌仍只用固定大按钮，不做二次确认。
- 触屏区分滑动与点击：只有位移小于 8px 的抬手才触发提示或解释，滑动滚动不会误触发。
- 修正两处交互缺陷：解释后的点击拦截改为按坐标匹配（此前 700ms 内任意点击—including Explain 按钮本身—都会被吞掉）；触屏点按先触发 focus 时提示曾被「不自动消失」分支覆盖而永不消失。
- Explain 覆盖状态条、进度轨、席位、牌堆、轨迹、弃牌、公告、行动按钮、手牌、回顾与日志；禁用按钮仍可解释，Esc 退出，无解释的按钮在解释模式下不触发原功能。
- 轮到自己时为收起的 RC 加红框；离开房间或切换游戏时清理面板、弹窗与该标记。

### 修改文件

`static/games/the_mind.css`、`static/games/the_mind.js`、`static/games/the_mind.html`、`static/game_assets.js`（资源版本 v=2 与 `panelTitle`）、`static/index.html`（加载器版本）、新增 `tests/the_mind_ui.py` 与 `tests/the_mind.browser.cjs`、本文。

### 验证结果

- `node --check static/games/the_mind.js tests/the_mind.browser.cjs`、`git diff --check` 通过。
- `python3 -m unittest tests.test_the_mind tests.test_room_session tests.test_frontend_style_assets tests.test_frontend_script_names tests.test_game_names tests.test_game_tags tests.test_game_dev_order tests.test_bot_threading`：65 项通过。
- `ROOM_TEST_URL=http://127.0.0.1:8147 PLAYWRIGHT_MODULE=<playwright> node tests/the_mind.browser.cjs` 通过（连续三次）：17 个视图 × 320／390／1024／1440px 的页面与容器无横向溢出、无内容溢出、关键容器两两不重叠；面板本身即桌面（内部容器无边框无背景）、页头三枚按钮不换行、无 Clear Selection、无逐块 i 标记；他人手牌数值不出现在 DOM，注入的 `<img onerror>` 名字被转义；Ready／Play／Stop／飞镖投票／Next Round 的提交与禁用态、系统错误后恢复；日志默认折叠、可展开且有界；悬停与三秒点按提示；Help 含 `Life (❤️)`／`Throwing star (🌟)`／`Ready (🖐️)`／`Stop (⏸️)` 且 Esc 关闭后焦点回到 Help；Explain 对区域与禁用按钮生效且不误发动作；触屏滑动不解释、轻点才解释；真实房间加机器人完成发牌→准备→出牌→（飞镖）→结算→下一关→刷新恢复→离开清理。
- 截图保存在 `build/the-mind-ui/`（各宽度对局、结算、12 张手牌、长名字、Help 与真实房间结算）。

### 未检查项

- 未做 iOS／Android／Windows 真机验证；Emoji 兼容性按 iOS／Windows 常见集合挑选，牌背图标改为自绘以规避缺字。
- 未改动规则、AI 与服务端；机器人在页面刷新后的准备时序偶发不稳定，属服务端机器人调度范畴，本次未修改，浏览器用例已改为只断言本人准备被接受。
