# Task 110：情书 / Love Letter

## 版本与规则依据

实现 `love_letter`，采用经典 16 张、2–4 人规则（AEG 1–8 编号），不混用新版 21 张牌的编号与计分。规则核对来源：[经典规则](https://www.ultraboardgames.com/love-letter/game-rules.php)、[AEG Premium 规则书中的 2–4 人部分](https://www.rulespal.com/love-letter-premium-edition/rulebook)及[规则书 PDF](https://gamers-hq.de/media/pdf/a3/95/57/Love-Letter-Premium_Rulebook.pdf)。仅实现基础角色；首轮随机先手，之后由上一轮胜者先手，并列时在胜者中随机选择，这是线上替代现实约会时间的约定。

## 规则与状态

| 点数 | 角色 | 张数 | 效果 |
| --- | --- | --- | --- |
| 1 | 卫兵 Guard (💂) | 5 | 指定另一名未受保护的玩家，猜其手牌为 2–8，猜中淘汰。 |
| 2 | 牧师 Priest (🔍) | 2 | 仅自己查看另一名玩家的手牌。 |
| 3 | 男爵 Baron (⚔️) | 2 | 双方秘密比较剩余手牌，较小者淘汰，相等无事发生。 |
| 4 | 侍女 Handmaid (🛡️) | 2 | 直到自己下次回合开始前不受他人卡牌效果影响。 |
| 5 | 王子 Prince (🤴) | 2 | 指定任一可选玩家（包括自己）弃掉手牌并补一张；弃公主则淘汰且不补牌。 |
| 6 | 国王 King (👑) | 1 | 与另一名玩家交换剩余手牌。 |
| 7 | 伯爵夫人 Countess (🌹) | 1 | 同持王子或国王必须打出；可以主动打出，不公开是否被迫。 |
| 8 | 公主 Princess (👸) | 1 | 任何原因弃掉都会淘汰。 |

每轮洗全部牌，暗置一张备用牌；双人局额外明置三张。各发一张，当前玩家自动摸一张，再选择一张打出。所有弃牌按顺序公开，淘汰玩家的剩余手牌也公开但不发动效果。需要指定他人的牌在无合法目标时空放；王子必须选择自己。牌库空时王子从暗置备用牌补牌。

只剩一人或行动完整结算后牌库为空，进入轮末展示。比较存活者手牌点数，再比较弃牌总和，仍同分者各获一个好感标记(❤️)。2／3／4 人分别需要 7／5／4 个。共同达到目标则共同获胜。每轮结束保留翻牌、淘汰原因、平局依据与得分；未结束整局时，包括已淘汰者在内的所有席位分别点击 **Next Round** 后才开始下一轮，机器人只确认自己，断线真人继续等待。

## 后端设计

- 新建 `game/love_letter.py`：卡牌定义、动作／配置 schema、初始化、服务端合法动作、结算、公开视图、机器人与存档接口。配置保持标准规则，无随机种子配置泄漏。
- 阶段：`play → round_end → play`；达到胜利条件进入 `game_over`。动作携带 `round` 和 `turn`，拒绝过期或重复提交；所有验证在修改状态前完成，绕过房间 schema 也不能非法操作。
- `play_card` 使用角色点数指定牌，按需附 `target`／`guess`；`next_round` 单独记录确认。人数、目标、保护、伯爵夫人、卫兵不可猜 1 等由服务器验证。
- 公开视图仅包含自己的手牌、自己的秘密情报及合法选择；别人手牌、牌库、备用牌不下发。牧师／男爵／国王的情报写入对应玩家的私有记录，公共事件仅含公开结果。目标再次行动或换牌后，旧情报标为历史观察，不能被误认成实时手牌。
- 机器人只使用本人公开视图：优先强制出牌、避免弃公主，结合公开弃牌与有效情报估计卫兵猜测、男爵比较、王子弃牌和国王交换；支持完整对局。
- 接入 `game/definitions.py`、`game/__init__.py`、标签，运行 `scripts/gen_dev_order.py`。沿用 Socket.IO 房间、重连、存档；扩展现有进行中隐私牌局的存档下载／克隆保护，避免旁路暴露整副牌。

## 前端设计（遵守 FRONTEND.md 与 task40.md）

- 新建 `static/games/love_letter.js`，用 IIFE 封装，导出的函数全部带 LoveLetter 前缀；独立 `static/love_letter.css`，`app.js` 仅增加面板切换和渲染分发。
- 酒红、羊皮纸与金色的信笺风格，通过 CSS／Emoji 绘制，不使用商业图片。顶部紧凑显示轮次、牌库、好感目标与行动提示；桌面主栏放玩家与手牌，侧栏放角色参考和可滚动日志；手机改为单栏、玩家两列、两张手牌同行。
- 出牌流程为点击手牌 → 选择目标 → 卫兵选择猜测 → **Play Card**。不可选目标显示保护／淘汰状态；无目标时明确显示空放。空白及 Esc 取消本地选择，没有 Clear Selection。所有通用 UI 按钮用英文。
- 公共弃牌按打出顺序展示；私有情报独立呈现，重连可恢复。轮末停留在完整结果与 **Next Round** 确认进度，不自动跳走。
- **Help** 对话框承载完整规则；**Explain** 模式给可解释项虚线高亮，拦截所有普通按钮，已禁用按钮也可解释，说明后退出，Esc 退出。图标在 Help／Explain 中同时列出 Emoji 与名称。无操作图标鼠标悬停显示提示，触屏点击显示三秒并以最新提示替换。
- 禁止横向溢出、内容重叠；长玩家名换行，所有网格用可收缩列，日志限定高度滚动；对话框支持 Esc／背景关闭与焦点返回。

## 验证与交付

1. 单元测试覆盖 16 张组成、双人准备、全部角色、非法输入不改状态、保护时限、淘汰、牌库耗尽与备用牌、平局、全员确认、终局、私密信息、存档往返和机器人完整对局。
2. 房间集成测试覆盖目录、开局、私有视图／广播、断线重连、过期动作、存档保护。
3. 因注册与房间接入涉及全局，执行仓库测试；前端只做 JS 语法及实际浏览器交互／布局验证，不为外观写逻辑测试。
4. 浏览器检查桌面及 390／320px 手机，实际进行出牌、查看 Help／Explain、提示、轮末与重连，保存截图记录。

## 实施记录

已完成规则引擎、机器人、游戏注册、标签与开发顺序、独立前端、Help／Explain、移动端提示、私有情报、轮末全员确认，以及存档隐私保护。未新增房间配置项，创建房间后可直接添加机器人或邀请真人。

验证结果（2026-09-22）：

- `PYTHONDONTWRITEBYTECODE=1 python3 -m unittest tests.test_love_letter tests.test_love_letter_integration`：28 项通过，包含 18 场确定性机器人完整对局与每步 16 张牌守恒检查。
- 情书、游戏名称／标签／开发顺序、前端全局命名、房间会话、世界巡游存档回归合计 71 项通过。命令：`python3 -m unittest tests.test_game_names tests.test_game_tags tests.test_game_dev_order tests.test_frontend_script_names tests.test_room_session tests.test_boomerang_australia_integration tests.test_love_letter tests.test_love_letter_integration`。
- `python3 -m unittest`：1510 项中 1505 项通过、5 项失败。用 `git archive HEAD game tests assets` 在独立临时目录复跑，5 项均产生相同失败，确认为原有问题：德国心脏病的两个翻牌等待、两个抢铃测试，以及掼蛋 `test_bot4_does_not_feed_low_single_to_seven_card_enemy_after_taking_lead`。本任务未改动这些游戏。
- `node --check static/games/love_letter.js`、`node --check static/app.js`、`git diff --check` 通过。
- 本机 Socket.IO 实际四人对局：牧师秘密看牌、卫兵目标与猜测、伯爵夫人出牌、机器人行动、淘汰、结算、Ready 3/4 等待真人、刷新重连保留结果、确认后进入下一轮均正常。
- 桌面、390px 与 320px 窄屏检查没有横向溢出或子元素溢出；Help 内容、Esc 关闭、Explain 禁用按钮解释、无解释按钮拦截、手机工具栏的 Explain 退出／Help 切换、空白取消、提示更新和自动消失均已验证，浏览器无脚本错误。
- 截图与测试日志保存在 `tmp/love_letter/`：[桌面截图](../tmp/love_letter/desktop.png)、[390px 截图](../tmp/love_letter/mobile-390.png)、[320px 截图](../tmp/love_letter/mobile-320.png)。
