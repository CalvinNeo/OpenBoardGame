# Task 112：地产达人 / For Sale

## 实现范围与规则

实现 `for_sale`，采用中文常见的 Eagle-Gryphon 基础版，支持 3–6 人、真人与机器人混合对局，不包含顾问扩充。规则依据：[Eagle-Gryphon 官方规则 PDF（©2008，准备见第 3 页，弃权／售房／胜负见第 4 页）](https://drive.google.com/file/d/1T6n0ZwFcNbp2DDJHsSIFVn_9sH6btNMr/view)，来源为[发行商游戏页](https://www.eagle-gryphon.com/products/for-sale)的规则下载目录。注意 [IELLO 2020 规则](https://iellogames.com/wp-content/uploads/2020/07/For-Sale_Rulebook_EN_V2.pdf) 使用不同初始资金和三人发牌，本实现不混用。线上随机先手替代原版按现实住宅决定先手；总资产与余币均相同时并列胜（IELLO 版明确该处理）。

- 地产牌(🏠)：1–30 各一张；支票(💵)：0、2–15 各两张，共 30 张，金额内部统一以千元为单位。
- 3／4 人每人现金(🪙) 18；5／6 人每人 14。3 人随机暗移除各 6 张地产、支票；4 人各 2 张；5／6 人不移除。两种牌独立洗混，移除牌与牌库顺序不公开。初始先手随机确定。
- 买房：每轮翻开人数张地产，按座位轮流加价或退出。出价是本轮总价，必须高于当前最高价且不超过自己的本轮可用资金；追加出价只追加差额。退出拿当前最低地产，收回已出价的一半向下取整，实际支付向上取整；没出价退出免费拿牌。最后留下者支付全部出价，拿最高地产并成为下轮先手。
- 所有地产卖完后进入售房：每轮翻开人数张支票，每人秘密提交一张自己的地产，提交后锁定，所有人提交后同时揭示；按地产数字从低到高对应支票从低到高。使用过的地产移出手牌，支票归玩家保留。
- 所有地产售完后比较支票总额加剩余现金，总额相同则剩余现金多者获胜，仍相同则并列。其他人的现金、持有地产和支票在终局前不直接公开；公开竞拍、已揭示成交属于可见历史。
- 每次买房竞拍或售房结算后进入 `round_end`，保留本轮分配与支付／退款，所有席位各自点击 **Next Round** 才继续，包含阶段切换和最终排名。机器人仅确认自身，断线真人仍需重连确认。

## 后端与接口约定

新建 `game/for_sale.py`，导出 `ForSaleGame`、`ACTION_SCHEMA`、`CONFIG_SCHEMA`。实现仓库标准 `init_game`、`get_legal_actions`、`apply_action`、`get_public_view`、`bot_move`、`serialize`、`deserialize`。配置为空对象，测试通过固定随机源保证可复现。

状态阶段：`buy → round_end → buy / sell → round_end → sell / game_over`。`round` 是整局递增轮次，`stage_round` 是本阶段轮次，`stage` 为 `buy` 或 `sell`；`turn` 只在买房行动后增长。所有动作包含当前 `round`；`bid`／`pass` 还包含 `turn`。售房和确认通过当前轮次及每人提交状态拒绝重放。所有输入检查在修改状态前完成，即使绕过房间 schema 也不能非法行动。

动作：`{type: bid, round, turn, amount}`、`{type: pass, round, turn}`、`{type: sell, round, property}`、`{type: next_round, round}`。数值只接受真正整数，不接受布尔值、字符串、浮点数或未知字段。

公开视图合同（前后端共享）：

- `game_id, you, phase, stage, round, stage_round, rounds_per_stage, turn, current_turn, start_player, game_over, winner, config`。
- `market_properties: int[]`、`market_checks: int[]`、`high_bid: int`、`high_bidder: str|null`、`active_players: str[]`、`next_ready: str[]`。
- `your_properties: int[]`、`your_checks: int[]`、`your_cash: int|null`（剩余未押资金）、`your_bid: int`（已押）、`your_selection: int|null`、`min_bid: int`、`max_bid: int`（剩余现金+已押）、`legal_actions: str[]`。
- `players: [{player_id,name,seat,is_bot,bid,passed,submitted,property_count,check_count,cash,total}]`：`cash/total` 仅本人或终局可见，其余为 null；`bid/passed` 为买房本轮公开信息。
- `round_summary: null|{stage,stage_round,rows:[{player_id,property,bid,paid,refund,check}],winner}`：买房行含出价、支付、退款；售房行含地产及支票；无关字段可省略。`winner` 为本轮买房最后留下者，售房为 null。
- `final_results: [{player_id,cash,checks,total,rank}]`（终局前为空，`checks` 是支票总额整数）、`log: [{round,text}]`。视图与存档深拷贝，牌库／移除牌／他人未揭示选择不下发。`market_properties` 只保留尚未分配的地产，轮末以 `round_summary` 展示分配结果。

机器人只基于自身公开视图决策，按剩余资金与地产价值设竞拍预算，售房结合当前支票价差分配手牌。不能读取其他玩家私牌、未揭示选择或未来牌库。售房事件只公开“已提交”；房间通用机器人事件也隐藏具体选择。接入正在进行的私密游戏存档导出／克隆保护，防止绕过公开视图读取牌库。

注册接入 `game/definitions.py`、`game/__init__.py`、`game/tags.py`，运行 `scripts/gen_dev_order.py`。前端沿用工作区新的 `static/game_assets.js` 按需加载结构，全局文件仅添加资源注册、入口与渲染分发。BGG 官方接口取得平均难度 1.2496，目录显示 1.25。

## 前端（遵守 FRONTEND.md 与 task40.md）

新建 `static/games/for_sale.js` 和 `static/for_sale.css`。JS 使用 IIFE；仅导出 `renderForSaleGameState`、`showForSaleHeaderActions`。DOM 为 `forSalePanel`、`forSaleHeaderActions`、`forSaleHelpBtn`、`forSaleExplainBtn`。

- 使用深绿、奶油白、铜金配色和自制 CSS 建筑／Emoji，不使用商用图片。紧凑布局包含阶段／轮次、中央地产或支票市场、玩家状态、自己的资金与地产、限定高度可滚动日志。
- 买房使用金额增减控件及 **Bid**／**Pass**，清楚显示本轮总价、需补差额与退出实际支付；售房点击地产后 **Confirm Sale**。不能操作时显示等待原因，提交中避免重复点击。
- 点空白或 Esc 取消尚未提交的地产选择，不添加 Clear Selection。结算面板显示本轮全部分配、支付／退款及 Ready 人数；全员确认后继续。
- 完整规则进入 **Help** 对话框，不在主界面堆规则。**Explain** 模式点选解释，支持 disabled 控件，拦截普通按钮，解释后退出，Esc 退出；不为每个区域添加 i 按钮。所有图标在规则与解释中同时写明名称与 Emoji。
- 无操作的图标和缩写支持桌面悬停、键盘焦点与触屏点击提示，手机提示 3 秒自动消失，连续点击替换。对话框 Esc／点背景关闭，保留焦点返回。
- 所有非游戏内容 UI 使用英文。宽屏主栏与侧栏并排；手机单栏或紧凑两列，网格允许收缩和换行，长玩家名可换行，不允许横向溢出和任何内容重叠。

## 验证计划

1. 规则测试：人数与牌组成、按人数移除、加价与差额、奇数退出、免费拿牌、最后玩家及下轮先手、售房同时揭示和重复支票、阶段转换与全员确认、平局、非法／过期／重放动作、信息隐私、存档深拷贝、3–6 人机器人完整对局。
2. 房间集成：目录、开局、私有广播、机器人事件、断线重连、存档保护、schema 绕过仍拒绝非法行动。
3. 因注册与房间全局接入，运行有关全局回归及完整测试，区分原有失败。UI 不运行逻辑测试；使用 JS 语法和实际浏览器检查 1440／390／320px 布局、Help／Explain、提示、操作与轮末暂停。

## 实施记录

游戏规则、注册、机器人、独立前端、Help／Explain、移动端提示、全员轮末确认、重连与存档隐私保护均已实现。

初版验证（2026-09-22）：

- 游戏规则及集成共 35 项通过；连同名称／标签／开发顺序／前端命名／房间与私密存档回归共 83 项通过。12 场 3–6 人机器人完整对局逐动作检查牌守恒。
- 全量 `python3 -m unittest` 执行 1517 项，1512 通过、5 项失败，与此前基线日志 `tmp/love_letter/baseline-tests.log` 的 5 项相同：德国心脏病 4 项时机测试、掼蛋 1 项历史局面测试。新增 28 项规则测试在全量测试启动后落盘，已包含在上述 83 项单独执行的回归中。
- 实际浏览器完成两场四人混合对局，覆盖出价／退出、售房、每轮确认、刷新重连、最终排名；Help／Esc、Explain 禁用按钮及无解释按钮拦截、移动端 Explain 工具栏、空白取消、悬停与触屏三秒提示均通过。
- 3／6 人全部阶段在 1440／390／320px 无横向溢出。移动端支票市场压缩为三列，320px 六人市场高 150px，`15K` 文字宽 39.64px，小于内容框 57.34px。日志及截图保存在 `tmp/for_sale/`，布局结果见 `layout-final-results.json`。
- JS 语法检查与 `git diff --check` 通过。

## 追加：增强机器人

针对“AI 有点蠢”的反馈，将初版固定预算／按支票区间选手牌的策略替换为独立 AI 模块。

- 增加结构化公开成交历史 `history` 与当前已公开退出结果 `auction_results`。历史仅在全轮结算后追加，所有字段来自原本公开的竞拍与揭示结果。机器人据此记住购入地产、已售出地产与支出，不读取隐藏手牌、未揭示选择、暗移除牌或未来牌库。
- 买房以“退出取得最低地产”为比较基准，评估加价后的地产边际收益、已押资金、退款与剩余轮数；在多个对手预算假设下模拟本轮竞拍，比较退出、最低加价和合理跳价，保留后续资金。
- 售房根据公开记牌建立对手可能选择的概率，并结合已经公开的出牌习惯。所有己方候选牌共享同一批 64 个对手样本，不能让模拟对手预知自己的秘密选择；计算本轮支票收益、剩余地产未来价值和后期对领先者的影响。牌力完全等价时优先用较小地产，相同支票时保留强牌。
- 支票顺位期望由“完整支票组减已公开支票”的可能池精确计算，不查看真实剩余顺序，也不排除尚不可知的暗移除牌。使用只依赖公开视图的稳定局部随机源，不改变全局随机状态。
- 增加策略场景、隐私变形、确定性、旧存档缺少历史的回退、运行耗时测试，并通过固定牌序、轮换座位的新旧策略对局评估改进。

增强 AI 验证结果（2026-09-22）：

- `python3 -m unittest tests.test_for_sale tests.test_for_sale_ai tests.test_for_sale_ai_buy tests.test_for_sale_integration`：62 项全部通过，8.515 秒。包括规则／房间、15 项买房策略测试、12 项记牌／售房／隐私／概率计算测试。并行开发当时注册了尚未落盘的新游戏模块，因此最终测试在 HEAD 快照叠加本次 For Sale 完整文件的隔离目录执行；AI 文件与工作区内容一致。
- 先运行 72 局固定种子对照，再用独立种子 212000–212007 运行 144 局留出验证，期间未调整策略。每组轮换所有座位，同牌序全旧策略重放作为资产对照。另有两个新版 AI 同桌的 18 局均合法结束，无死锁。

| 人数 | 留出局数 | 新 AI 胜率 | 旧 AI 每席胜率 | 同牌序同座位平均资产提升 |
| --- | --- | --- | --- | --- |
| 3 | 24 | 58.33% | 20.83% | +6.042 千元 |
| 4 | 32 | 28.12% | 23.96% | +2.906 千元 |
| 5 | 40 | 25.00% | 18.75% | +4.450 千元 |
| 6 | 48 | 25.00% | 15.00% | +4.312 千元 |

这些结果是对旧版规则策略的比较，四人组胜率优势较小；共享胜利按获胜人数分摊胜场。留出数据中买房决策 P95 最多 4.47ms，售房最多 37.52ms。未使用对手秘密提交或未来真实牌库；篡改这些隐藏值而保持公开视图不变的测试确认决策不变。

复跑命令：

```sh
python3 scripts/benchmark_for_sale_ai.py --seed-start 212000 --seeds 8 --json tmp/for_sale/ai-holdout-results.json
```

完整逐局记录见 `tmp/for_sale/ai-results.json`、`ai-holdout-results.json`、`ai-two-new-smoke.json`；测试日志见 `tmp/for_sale/ai-final-tests.log`。正式评估脚本 `scripts/benchmark_for_sale_ai.py` 已通过独立三局 smoke。

## 追加：竞拍在场名单

在 Bid／Pass 操作区上方增加 Still Bidding 名单与在场人数，以服务端 `active_players` 为准，按座位顺序显示玩家名和公开出价。You 标识自己，To act 标识当前行动者，Highest 标识最高出价者；尚未出价的玩家仍在名单内，退出玩家移入 Passed。自己退出或旁观时仍可查看名单，结算与售房阶段收起。

名单支持 Help、Explain、桌面悬停和触屏三秒提示。手机两列排列，长姓名和状态标记自动换行；已更新游戏 JS／CSS 及首页加载器资源版本。

验证（2026-09-23）：实际 Chrome 检查 1440／390／320px 下的六人在场、三人在场、自己退出后两人在场、旁观四种状态，共 12 组，无横向溢出或名单卡片重叠；检查退出更新、零出价、当前行动者与最高出价者区分、姓名转义、结算／售房收起，以及 Help／Explain／Esc、悬停和触屏提示。JS 语法和 `git diff --check` 通过。按 FRONTEND.md，纯 UI 修改未运行逻辑测试。记录与截图见 `tmp/for_sale/bid-roster-results.json`、`bid-roster-*.png`。
