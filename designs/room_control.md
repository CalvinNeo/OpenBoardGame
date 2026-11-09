# Room Control 板块设计

## Hide 功能

支持 Hide 功能，RC 被 Hide 时，会展示为“特殊形式”：
+ 仅对手机端：会以一个窄横条的形式 Dock 在最上方。点击横条，会展开 RC。
+ 仅对电脑端：会以一个小方块形式 Dock 在上下左右的某个边缘。可以拖动 Dock 上的 Handle 让小方块 Dock 到其他地方。点击小方块，会展开 RC。
+ 手机端和电脑端的“特殊形式”上都应该有 Explain 按钮和设置按钮。
+ 无论是 Show 和 Hide 状态，RC 都始终位于最上层，但是 RC 自己触发的弹窗（如 Select Game、Log）还是要比 RC 更上层。都是半透明的。
+ 当游戏开始的时候，会自动 Hide RC。

## Reconnect 与房间身份

- 顶部 Reconnect 连接当前显示的房间；列表中的 Reconnect 连接该条目对应的房间。已结束但仍存在且保留本人座位的房间同样可重连，不自动跳转到最新一局。
- 切换房间仅切换当前连接，保留其他房间的座位与游戏状态；同一连接同时只操作一个房间。
- 浏览器连接、刷新列表或收到列表更新时，通过私有 `room:list` 请求提交已有 `player_id` / `reconnect_token`。服务器只为匹配的现存非 Bot 座位返回 `room_auth`，不按姓名授权、不更改连接状态、不公开广播密钥。
- Reopen 会保留原玩家身份。离线玩家即使只保存了旧房间凭证，也能发现新房间的重连资格；发现凭证不会改变当前房间、最后选择的房间或玩家名称。
- Access key 导入先恢复可访问房间；指定房间时只尝试该房间，没有资格则提示错误。退出、取消导入或断开连接后忽略旧请求，避免迟到的响应恢复身份。

## Select Game

- 顶部提供搜索（名称 / 中文名 / game_id / 标签）、Players 人数、Sort 排序三类控件，以及 Types 标签多选（取交集）。
- Players 支持 1-10 的精确人数，另有 `11+`：匹配所有仍能容纳 11 人及以上的游戏，即 `max_players >= 11` 或 `supported_player_counts` 中存在 `>= 11` 的取值，而不是恰好 11 人。精确人数仍按原有语义匹配。
- Sort 选项：Alphabet、Recently Played（当前浏览器最近开过的房间，来自 localStorage）、Recently Updated（游戏代码最近一次改动）、Development Order、Weight Asc / Weight Desc。所选排序保存在 localStorage。
- Recently Updated 依赖 `game/updated_at.json`，由 `python scripts/gen_dev_order.py` 与 dev order 一同生成：取该游戏主模块、同前缀的 `_ai` / `_data` 等模块、`static/games/<game_id>.*` 以及 `game/assets`、`assets`、`static/assets` 下同名资源最后一次 git 提交时间；尚未提交的新文件回退到文件修改时间。`/api/games` 通过 `updated_at` 字段下发，缺失该字段的游戏排在最后。
- 新增或调整排序选项时，同步更新 `static/index.html` 的 `<option>`、`static/room.js` 的 `GAME_SORT_KEYS` 与 `sortGames` 分支；`tests/test_game_picker_contract.py` 会检查三者一致，`tests/test_game_updated_at.py` 会检查元数据覆盖所有已注册游戏。
