# Room Control 板块设计

## Hide 功能

支持 Hide 功能，RC 被 Hide 时，会展示为“特殊形式”：
+ 仅对手机端：会以一个窄横条的形式 Dock 在最上方。点击横条，会展开 RC。
+ 仅对电脑端：会以一个小方块形式 Dock 在上下左右的某个边缘。可以拖动 Dock 上的 Handle 让小方块 Dock 到其他地方。点击小方块，会展开 RC。
+ 手机端和电脑端的“特殊形式”上都保留设置按钮；仅在当前游戏提供可用 Explain 时显示其真实按钮，不显示无功能的 Explain 占位图标，也不为其预留空白。展开、收起及切换屏幕宽度时始终只保留一个可用 Explain 入口。
+ 无论是 Show 和 Hide 状态，RC 都始终位于最上层，但是 RC 自己触发的弹窗（如 Select Game、Log）还是要比 RC 更上层。都是半透明的。
+ 当游戏开始的时候，会自动 Hide RC。

## Reconnect 与房间身份

- 房间列表统一使用一个 Enter 按钮：已有凭证时重连，无凭证时加入大厅，载入存档时进入选座流程。不再单独显示 Join、Join Ready 或列表内的 Reconnect 图标。
- Rooms 标题右侧提供 `auto ready` checkbox，默认不勾选，选择保存在当前浏览器。勾选后通过 Enter、房间 ID 或选座进入大厅会自动准备；关闭不会取消当前准备状态，也不会立即修改房间。页面刷新与自动重连不改变手动准备状态。
- 顶部 Reconnect 连接当前显示的房间；列表中的 Enter 连接该条目对应的房间。已结束但仍存在且保留本人座位的房间同样可重连，不自动跳转到最新一局。
- 切换房间仅切换当前连接，保留其他房间的座位与游戏状态；同一连接同时只操作一个房间。
- 浏览器连接、刷新列表或收到列表更新时，通过私有 `room:list` 请求提交已有 `player_id` / `reconnect_token`。服务器只为匹配的现存非 Bot 座位返回 `room_auth`，不按姓名授权、不更改连接状态、不公开广播密钥。
- Reopen 会保留原玩家身份。离线玩家即使只保存了旧房间凭证，也能发现新房间的重连资格；发现凭证不会改变当前房间、最后选择的房间或玩家名称。
- Access key 导入先恢复可访问房间；指定房间时只尝试该房间，没有资格则提示错误。退出、取消导入或断开连接后忽略旧请求，避免迟到的响应恢复身份。

## 房间操作

- Start 使用加宽按钮并显示 `▶️ Start`，保留原有可用条件和启动中反馈。
- Leave Room 先打开二次确认框，只有确认才发送离房请求和清理当前房间状态。Cancel、点击遮罩或 Escape 均取消离房并恢复焦点；确认框支持键盘焦点循环，默认聚焦 Cancel。确认期间若房间已切换，不得退出新的房间。

### 2026-11-23 UI 验收记录

- 实现文件：`static/index.html`、`static/room.js`、`static/style.css`；设计说明更新在本文件。
- 新增回归：`tests/room_entry_controls.browser.cjs`；同步更新 `tests/room_reconnect.browser.cjs`、`tests/room_access_key.browser.cjs`、`tests/game_assets.browser.cjs`，以及 `tests/deception.browser.cjs`、`tests/moshimo_yusha.browser.cjs`、`tests/no_thanks.browser.cjs`、`tests/terra_nova.browser.cjs`、`tests/the_mind.browser.cjs`、`tests/word_sync.browser.cjs` 的离房确认步骤。
- Chrome 桌面 / 触摸上下文检查 320、390、1024、1440px：RC 与确认框截图人工查看通过，按钮无重叠、无容器溢出或页面横向滚动，auto ready 紧邻 Rooms，Start 加宽。
- 浏览器回归通过：`room_entry_controls`、`room_reconnect`、`room_access_key`、`room_controls_drawer`。覆盖新加入、凭证重连、房间 ID、自动准备偏好持久化、刷新保留手动准备状态、取消/遮罩/Escape、焦点循环、确认期间切换房间、确认离房、抽屉与 Explain/弹窗层级。
- `python3 -m unittest tests.test_frontend_style_assets tests.test_help_contract` 的 13 项检查、全部改动 JS 的 `node --check` 与 `git diff --check` 通过。
- 验收缺口：`tests/game_assets.browser.cjs:50` 的既有首页脚本白名单只允许 `shared.js`，但本次改动前首页已包含 `shared_help.js` 与 `shared_effects.js`，因此该测试在后续资源加载检查前失败；本次未修改该无关断言。上述六个游戏回归仅更新确认步骤并检查语法，未完整重跑；选座后的自动准备未单独做端到端检查，未检查实体移动设备。不能宣称 DEV_GUIDE.md 全部验收完成。

## Select Game

- 顶部提供搜索（名称 / 中文名 / game_id / 标签）、Players 人数、Sort 排序三类控件，以及 Types 标签多选（取交集）。
- 游戏列表的 Grid 行顶部对齐；手机端列表仍占满剩余空间并独立滚动，但搜索或筛选后只有少量结果时，不得把条目拉高来填满列表。
- Players 支持 1-10 的精确人数，另有 `11+`：匹配所有仍能容纳 11 人及以上的游戏，即 `max_players >= 11` 或 `supported_player_counts` 中存在 `>= 11` 的取值，而不是恰好 11 人。精确人数仍按原有语义匹配。
- Sort 选项：Alphabet、Recently Played（当前浏览器最近开过的房间，来自 localStorage）、Recently Updated（游戏代码最近一次改动）、Development Order、Weight Asc / Weight Desc。所选排序保存在 localStorage。
- Recently Updated 依赖 `game/updated_at.json`，由 `python scripts/gen_dev_order.py` 与 dev order 一同生成：取该游戏主模块、同前缀的 `_ai` / `_data` 等模块、`static/games/<game_id>.*` 以及 `game/assets`、`assets`、`static/assets` 下同名资源最后一次 git 提交时间；尚未提交的新文件回退到文件修改时间。`/api/games` 通过 `updated_at` 字段下发，缺失该字段的游戏排在最后。
- 新增或调整排序选项时，同步更新 `static/index.html` 的 `<option>`、`static/room.js` 的 `GAME_SORT_KEYS` 与 `sortGames` 分支；`tests/test_game_picker_contract.py` 会检查三者一致，`tests/test_game_updated_at.py` 会检查元数据覆盖所有已注册游戏。
