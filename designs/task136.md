# Task 136：初创公司 / Startups

## 规则与范围

新增 `startups`，实现 Oink Games《初创公司》3–7 人基础规则、练习机器人、重连，以及可选的四局比赛。资料：[出版方游戏介绍](https://oinkgames.com/en/games/analog/startups/)、[英文规则书](https://tesera.ru/images/items/2531744/Startups_eng.pdf)、[规则速查 PDF](https://hobbygames.ru/download/rules/startups-rules.pdf)、[出版方公司名称说明](https://oinkgames.com/en/goods/pins-startups/)。全部牌面用原创 CSS、文字和 Emoji 绘制，不使用商业卡图或 Logo。

六家公司共 45 张牌：Giraffe Beer（🦒）5、Bowwow Games（🐶）6、Flamingo Soft（🦩）7、Octo Coffee（🐙）8、Hippo Powertech（🦛）9、Elephant Mars Travel（🐘）10。数字表示整副牌中的数量，不是股份价值。每局暗移除 5 张，各发 3 张手牌、10 枚资本（💰），市场为空。线上首局随机首家，按座位轮流行动。

每回合先拿一张、再放一张：

- 从牌堆抽牌：给市场上每张自己未持有对应反垄断标记的牌各付 1 枚资本，付不起不能抽牌；空市场或全部豁免时免费。
- 从市场拿牌：同时收走该牌上的资本；不能拿自己持有反垄断标记的公司。
- 放牌：从四张手牌中选一张公开投资或弃到市场。如果本回合从市场拿牌，不能弃任何同公司的牌，包括原来手中的同公司牌。
- 公开股份严格超过现任持有者时取得该公司的反垄断标记（🚫）；追平时标记保留。第一张公开投资就能获得标记；手牌在游戏中不参与标记判定。

有人抽走牌堆最后一张时，仍完成放牌，然后立即结算。所有人的 3 张手牌一起公开并计入股份；市场和暗移除牌不计入。每家公司仅唯一最多股份者获得收益，最高并列时无人收付，反垄断标记不破平。

小股东每持有该公司一张股份付出 1 枚原资本，收款方把每枚翻到 3 分面；因此最终财富 = 结算前资本 − 应付股份数 + 3 × 收入筹码数。允许负债，已收的 3 分筹码不能再支付，不按结算顺序抵销。财富高者胜；同分依次比收入筹码数、最近完成回合的顺序。

默认单局。四局赛每局按排名给第一名 +2、第二名 +1、最后一名 −1，其余 0；下局由上一局最后一名先手，重新洗 45 张牌、暗移除 5 张并重置资本。四局结束比较积分，再比较第一名次数、第二名次数；仍并列时按最后一局排名决定（线上明确补全最后一轮冠军不在并列者中的情形）。非最终局结算后停留，所有玩家点击 Next Round 才开始下一局，机器人只确认自己，断线真人不跳过。

## 状态与接口

新增 `game/startups.py`、`game/startups_ai.py`，提供项目标准 init/apply/public_view/legal_actions/bot_move/serialize/deserialize 接口。状态机 `take → place → take … → round_review / game_over`。动作 `draw`、`take_market(card_id)`、`invest(card_id)`、`discard(card_id)`、`next_round`；携带游戏 token、轮数、回合号防止旧请求作用于新局。独立验证字段、身份、阶段、资本、手牌归属和标记限制；非法动作不改变状态。

公开视图只提供自己的手牌、公开投资、资本、市场、标记和牌堆数量；对手手牌只在结算时公开。不暴露暗移除牌、牌堆顺序或 seed。抽牌事件不带牌面，机器人事件脱敏。保护进行中存档下载及克隆；原座位 token 可恢复服务器重启后的自动存档。

机器人只接收自身公开视图，根据可见持股、自己手牌、市场资本、剩余牌数与抽牌成本，选择拿牌及投资/弃牌；不读其他玩家暗牌。作为练习级对手，不声称最优策略。

接入注册、中文名、标签、配置、按需资源和状态分发，运行 `python3 scripts/gen_dev_order.py` 更新开发顺序。共享文件仅作必要增量，保留已有工作区修改。

## 前端要求

遵守 `FRONTEND.md` 和 `designs/task40.md`。新增 `static/games/startups.{html,css,js}`，以 IIFE 封装，仅暴露 Startups 前缀入口；首页只留配置、页头、面板、弹窗占位，在 `GAME_ASSETS` 注册并更新资源版本。初始化兼容 DOMContentLoaded 已结束、同步最近房间及游戏状态。

视觉为暖白投融资桌面、深绿重点和六种公司颜色，牌面同时显示 Emoji、公司名称、总发行量。紧凑布局展示市场、抽牌成本、自己的手牌、全部玩家持股与资本。桌面双栏，手机自动单栏，手牌和公司展示可换行；320px 起无横向溢出，长名称安全换行，日志和规则弹窗内部滚动。手机保持市场与手牌相邻。

拿市场牌和出手牌先点选，再在同一区域确认；点击空白或 Esc 取消，Cancel 保留，避免 Clear Selection。抽牌和 Next Round 是固定位置的大按钮，不加二次确认。Help 集中规则、结算例子、四局赛与图标释义；Explain 进入后拦截正常操作，只高亮可解释对象，包含 disabled 按钮，展示后退出，Esc 退出。静态指标提供电脑悬停/焦点说明，手机点击显示三秒浮动提示，新提示替换旧提示。说明同时列出图标及名称。非游戏内容 UI 使用英文。

## 验证计划

确定性规则测试覆盖 45 张牌/发牌/人数、抽牌逐张收费、豁免与缺钱、市场收款和同公司禁弃、标记取得/追平/转移、最后一张仍放牌、手牌揭示和最高平手、收入翻 3 面与负债、胜负破平、四局积分和全员确认、状态隔离、无效动作原子性、过期请求、序列化以及所有人数机器人完整对局。

集成测试验证目录、房间开始/行动/重连、事件/seed/存档保护，运行受共享改动影响的房间、机器人、标签、开发顺序及资源测试。浏览器检查真实房间流程、延迟加载、刷新重连、选择确认、Help/Explain/禁用按钮/Esc/提示、1440/390/320px 与长名字布局，保存截图。

## 实现与验证结果

已完成规则模块、仅使用可见信息的机器人、3–7 人房间接入、单局/四局配置、原座位重连与冷启动存档恢复、独立按需前端，以及 Help / Explain / 三秒触屏提示。结算区优先显示；桌面手牌保持卡牌尺寸，手机三张手牌紧凑排为一行、四张为两行。未引入商业图像素材。

- `python3 -m unittest tests.test_startups`：19 项通过，包含所有人数 × 单局/四局 × 5 个 seed 的 50 场机器人完整对局，以及逐步牌数/资金守恒检查。
- `python3 -m unittest tests.test_startups_integration tests.test_skull_king_integration tests.test_room_session tests.test_bot_threading tests.test_game_tags tests.test_game_dev_order tests.test_frontend_style_assets tests.test_deception_integration`：59 项通过；其中本游戏房间集成 5 项。
- `tests/startups.browser.cjs`：真实三人四局赛、三次全员确认停顿、两名服务器机器人的完整单局、刷新恢复、选牌与取消、Help、Explain（含禁用操作）、Esc、触屏三秒提示均通过。1440/390/320px 及七名长姓名玩家、四张手牌的 320px 触屏布局无横向溢出，浏览器脚本错误为 0。
- `tests/game_assets.browser.cjs`：公共资源按需加载、切换/重进房间、失败重试和样式顺序回归通过。
- `python3 scripts/gen_dev_order.py` 已执行，`startups` 为第 100 个游戏。`python3 scripts/bgg_weight_scrape.py --timeout 3 --out tmp/startups-bgg-weights.json` 返回 1.5802，目录展示为 **1.58**。
- Python/JavaScript 语法检查和 `git diff --check` 通过。截图与浏览器报告在 `tmp/startups-qa/`，含 `playing-1440.png`、`playing-390.png`、`results-390.png`、`seven-players-four-cards-320.png`、`result.json`。

另运行全量 `python3 -m unittest`：**2,335 项，8 项失败**（428 秒）。本游戏测试全部通过；失败均在其他游戏，本次未修改相关游戏逻辑。明细如下，完整输出见 `tmp/startups-qa/unittest-full.log`：

- `tests.test_ark_nova_integration` 的 `test_building_picker_uses_fixed_polyhex_pieces`、`test_optional_free_building_uses_map_and_can_be_skipped`：仍要求旧文案 `Choose one anchor hex on the zoo map`。单独运行同样失败；对应脚本与测试均和 HEAD 一致。
- `tests.test_ark_nova_maps.ArkNovaMapsTests.test_all_map_sources_generate_current_artifacts_and_share_geometry`：`map5a` 的源数据/生成产物规则文案不一致。
- `tests.test_guandan_reviewed_round.GuandanReviewedRoundRegressionTests.test_bot4_does_not_feed_low_single_to_seven_card_enemy_after_taking_lead`：机器人出牌与预期不一致；工作区同时有其他掼蛋修改，予以保留。
- `tests.test_halli_galli` 的 `test_flip_wait_allows_flip_after_ready`、`test_flip_wait_blocks_flip`、`test_ring_false_when_no_fruit_total_is_five`、`test_ring_success_when_fruit_total_is_five`：翻牌等待/按铃行为断言失败。
