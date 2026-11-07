# 6 nimmt! (谁是牛头王) - 游戏逻辑设计文档

本文档详细描述了《6 nimmt!》的游戏规则与逻辑，旨在作为开发电子版游戏的可以直接参考的需求文档。

## 1. 游戏基础配置 (Game Config)

### 1.1 卡牌定义
游戏包含 **104张** 唯一的卡牌，编号为 **1 到 104**。
每张卡牌拥有两个属性：
1.  **数值 (Value)**: 1-104 (用于排序和比大小)。
2.  **牛头数/罚分 (Bullheads/Penalty)**: 基于数值计算，规则如下：
    * **数值为 55**: 7 个牛头。
    * **数值为 11 的倍数** (11, 22, 33, 44, 66, 77, 88, 99): 5 个牛头。
    * **数值为 10 的倍数** (10, 20, 30, 40, 50, 60, 70, 80, 90, 100): 3 个牛头。
    * **数值为 5 的倍数** (5, 15, 25... 排除上述情况): 2 个牛头。
    * **其他所有数字**: 1 个牛头。

### 1.2 游戏人数
* 支持 2 到 10 人。

### 1.3 胜利条件
* 游戏通常进行若干局。
* 当任意一名玩家的总罚分达到或超过 **66分** 时，游戏结束。
* 此时总罚分最少的玩家获胜。

---

## 2. 游戏状态数据结构 (Data Structures)

为了实现电子版，需要维护以下核心状态：

```json
{
  "players": [
    {
      "id": "player_1",
      "hand": [], // 当前手牌 (List of Cards)
      "score": 0, // 总罚分
      "selectedCard": null, // 本回合选中的牌
      "state": "WAITING_FOR_INPUT" // 状态: 选牌中, 选行中, 等待中
    }
  ],
  "rows": [
    // 游戏盘面始终有4行
    { "id": 0, "cards": [] }, 
    { "id": 1, "cards": [] },
    { "id": 2, "cards": [] },
    { "id": 3, "cards": [] }
  ],
  "deck": [], // 剩余牌堆 (发牌后通常为空，除非支持变体规则)
  "currentTurnState": "SELECTION_PHASE" // 当前回合阶段
}
```

---

## 3. 游戏初始化 (Initialization)

1.  **洗牌**: 创建 1-104 的卡牌数组并随机打乱。
2.  **发牌**: 每位玩家分发 **10张** 牌作为手牌。
3.  **排面初始化**:
    * 从牌堆中再翻开 **4张** 牌。
    * 将这4张牌分别作为 **4个行 (Rows)** 的起始牌。
    * *注意*: 这里的4张牌若有牛头数不计入任何玩家得分。

---

## 4. 核心游戏循环 (Game Loop)

每一局游戏包含 **10个回合** (因为每人10张手牌)。
每回合包含以下三个阶段：

### 阶段一：同步出牌 (Simultaneous Selection)
1.  所有玩家从手牌中选择 **1张** 牌。
2.  选定后，该牌在逻辑上标记为“已打出”，但在UI上对其他玩家不可见（面朝下）。
3.  当所有玩家都确认选牌后，进入阶段二。

### 阶段二：结算排序 (Reveal & Sort)
1.  翻开所有玩家打出的牌。
2.  将这些牌按 **数值从小到大** 进行排序。
    * *示例*: 玩家A出12，玩家B出4，玩家C出60。
    * *处理顺序*: 玩家B(4) -> 玩家A(12) -> 玩家C(60)。

### 阶段三：放置卡牌逻辑 (Placement Logic) - **核心算法**

按排序后的顺序，依次处理每一张玩家打出的牌 (`play_card`)。对于每一张牌，执行以下判断逻辑：

#### 逻辑 A: 寻找合法行 (Find Valid Rows)
遍历盘面上的 4 行，找到满足以下条件的所有行：
* **条件**: `row.last_card.value < play_card.value`
* (即：行尾的牌必须比打出的牌小)

#### 逻辑 B: 自动放置 (Automatic Placement)
* **情况 1: 存在至少一个合法行**
    * 在所有合法行中，选择差值最小的一行。
    * **算法**: 找到 `min(play_card.value - row.last_card.value)` 的行。
    * **判定**:
        * 如果该行目前的卡牌数量 **< 5**：
            * 将 `play_card` 追加到该行末尾。
            * *回合结束，处理下一张牌。*
        * 如果该行目前的卡牌数量 **== 5** (即这第6张牌)：
            * **触发“牛头王” (6 nimmt!) 事件**:
                1.  该行现有的 5 张牌被移除。
                2.  计算这 5 张牌的牛头总数，加到该玩家的 `score` 中。
                3.  这 5 张牌进入弃牌堆（不再使用）。
                4.  `play_card` 成为该行新的 **第1张** 牌。

* **情况 2: 不存在合法行 (所有行的尾牌都比打出的牌大)**
    * 这种情况通常发生在玩家打出的牌非常小。
    * **触发“主动吃牌” (Player Choice) 事件**:
        1.  游戏逻辑暂停，请求该玩家输入。
        2.  玩家必须在 4 行中 **任意选择一行**。
        3.  被选中行的 **所有卡牌** 被移除。
        4.  计算被移除卡牌的牛头总数，加到该玩家的 `score` 中。
        5.  `play_card` 成为该行新的 **第1张** 牌。
        6.  *策略提示*: 玩家通常会选择牛头总数最少的一行来吃。

---

## 5. 局末与游戏结束结算

### 5.1 局末 (End of Round)
* 当 10 回合结束后（手牌为空），一局结束。
* 检查所有玩家的 `score`。

### 5.2 游戏结束判定 (Game Over)
* 如果 **任意玩家** `score >= 66`：
    * 游戏彻底结束。
    * 按分数排序，分数 **最低** 者为冠军。
* 如果 **无人** `score >= 66`：
    * 保留当前分数。
    * 重新洗牌（包括所有弃牌和之前的牌），开始新的一局 (Go to Section 3)。

---

## 6. 伪代码参考 (Pseudo-code Implementation)

```python
def process_turn(played_cards):
    # played_cards 是一个列表: [{player: p1, card: c1}, {player: p2, card: c2}...]
    
    # 1. 排序：从小到大
    sorted_plays = sort_by_card_value(played_cards)

    # 2. 依次处理
    for play in sorted_plays:
        card = play.card
        player = play.player
        
        # 寻找合适的行
        valid_rows = []
        for row in game_board.rows:
            if row.last_card.value < card.value:
                valid_rows.append(row)
        
        if len(valid_rows) > 0:
            # 规则：放入差值最小的行
            target_row = get_row_with_smallest_diff(valid_rows, card)
            
            if len(target_row.cards) == 5:
                # 规则：第6张牌，吃掉前5张
                player.score += calculate_bullheads(target_row.cards)
                target_row.cards = [card] # 重置该行
                log(f"{player.name} 放置第6张牌，吃了 {target_row.id} 行")
            else:
                # 正常追加
                target_row.cards.append(card)
        
        else:
            # 规则：牌太小，无法放入任何行
            # 必须由玩家选择一行吃掉 (UI交互)
            chosen_row_index = wait_for_player_decision(player)
            target_row = game_board.rows[chosen_row_index]
            
            player.score += calculate_bullheads(target_row.cards)
            target_row.cards = [card] # 重置该行
            log(f"{player.name} 牌太小，主动吃了 {target_row.id} 行")

```

## 7. 特殊情况与UI提示需求

1.  **卡牌信息展示**:
    * 在电子版中，务必在卡牌UI上直观显示其牛头数（例如：牌面画有相应数量的牛头图标）。
2.  **选择行提示**:
    * 当触发“主动吃牌”逻辑时，UI应高亮显示4个行，并显示每行当前的牛头总数，辅助玩家决策。
3.  **动画顺序**:
    * 必须严格按照卡牌数值从小到大的顺序播放动画，不能同时结算，因为前一张牌的结算结果（如清空了一行）会直接改变后一张牌的放置环境。

## 8. 常见FAQ (开发注意事项)

* **Q: 如果两张牌数值一样怎么办？**
    * A: 既然一副牌1-104不重复，这种情况不会发生。如果实现了“双副牌变体”，则先打出的先结算（或视为并列，需额外定义规则）。标准版无需考虑。
* **Q: 玩家能否查看已吃掉的弃牌堆？**
    * A: 规则上通常不公开弃牌堆详情，只显示每个玩家当前的罚分总数。
* **Q: 104号牌一定是第6张吗？**
    * A: 不一定。如果某一行的最后一张是 103，那么 104 可以安全地放在它后面成为第2、3、4、5张。只有当该行已有5张时，104才会触发吃牌。

## 9. UI 与公开信息 AI（2026-11-06）

### 牌桌与交互

- 游戏直接展示在 Game 主面板内，标题改为「6 nimmt! · 谁是牛头王」。桌面端四行牌桌与手牌为主体，右侧为紧凑计分栏；手机端四行均完整显示五个牌位及危险第六格，手牌使用五列两行，不产生横向滚动。
- 卡面上方显示数字，底部显示准确牛头数（🐮 ×N）；1、2、3、5、7 牛头分别用蓝、绿、金、紫、玫红辅助区分。行头显示整行罚分和占用格数，满行用暖色提示。
- 选牌仅作本地预选，Play Card 确认后才锁定；当前落点预览明确标为“仅当前预览”，不承诺同时出牌后的最终落点。再次点击、空白处或 Esc 取消未提交选择。
- 选行先高亮再就地 Take Row / Cancel 确认；本次已揭牌顺序在牌桌上方展示，正在选行的人单独强调。发送期间禁止重复提交，他人的状态更新不会重新开启按钮；报错、断线或发送超时允许恢复。
- 每次结算按数字顺序列出每人的卡、目标行、吃掉的牌和新增罚分，突出本人。View Table、Esc 或点遮罩只收起结果，不确认；Results 可重开。Next Round 无二次确认，必须全员分别确认才继续。长列表单独滚动，确认与收起按钮始终保留在可视区域。
- 接入按需加载的 Help / Explain。Explain 拦截普通动作，包含 disabled 按钮的坐标命中；退出后不会误触原动作。非交互图标提供悬停／键盘提示和点击后 3 秒消失的移动端浮层。手势移动超过阈值或触发滚动／取消时不选择牌或行。
- Room Controls 的 Explain 可正常停靠；需要本人出牌、选行、确认时，折叠 RC 标红。离房／切游戏清理定时器、弹窗、待提交状态及红框；后加载脚本同步当前房间和最近状态，重连可恢复暗选与结算。

### 默认 AI 策略

- `SixNimmtGame.bot_move` 只把 `get_public_view(state, bot_id)` 交给 `game/six_nimmt_ai.py`，不读对手手牌、暗选牌或未发牌库。Room Controls 原有 Add Bot 即可使用，无额外服务或模型依赖。
- 每轮记录 `seen_cards`：初始行首与之后公开揭牌的数字；暗选期间不加入，新发牌时重置。用于扣除已公开牌，等价于记忆公开历史。旧存档缺少此字段时仍能运行，但只能利用仍在公共视图中的历史。
- 每次选择固定抽取 96 组不重复的未知牌，按对手公开手牌数分配假想手牌。模拟策略混合随机出牌和带噪声的风险启发式，避免假设所有对手都使用同一种最优策略。
- 所有候选使用相同样本，逐张按数字顺序模拟行末匹配、强制吃行和第六张清行；评分包含期望罚分、较大罚分惩罚、剩余手牌的后续风险。随机源由公开局面和自身手牌确定，不消耗发牌用的全局随机数。
- 选行首先最小化本次牛头罚分；同罚分时结合已揭开的后续牌和剩余手牌风险选择。结算只确认自己一次，不代替真人、不跳过暂停；游戏结束、观战或无合法动作时返回 None。
- 修复暗选泄漏：`six_nimmt:select` / `six_nimmt:auto_select` 只广播玩家 ID；通用 `bot:action` 对此游戏只广播动作类型。具体暗选牌只在本人私有视图中可见，直到全员锁定后一起公开。

### 验证与结果

- 逻辑／集成：`python3 -m unittest tests.test_six_nimmt tests.test_six_nimmt_integration tests.test_frontend_style_assets -v`，21 项通过。覆盖 2/10 人完整轮次、4 人完整终局、合法动作、确定性、不改状态／全局随机源、暗选隐私、假想牌去重、旧存档、超时、机器人调度、真人结算屏障和重连。
- 浏览器：`tests/six_nimmt.browser.cjs` 在 Chrome headless 下检查 320、390、1024、1440px；覆盖选牌、锁定、选行、等待、观战、结算、已确认、终局、长名字／三位数罚分、Help/Esc、Explain/disabled、原地确认、取消、连续状态更新、结算收起／重开、触摸滚动防误选、3 秒提示、游戏切换，以及真实房间 Add Bot → 开局 → 出牌 → 结算 → 刷新重连 → Next Round。未发现横向溢出，10 人结算确认按钮不随列表滚出视野。
- `tests/game_assets.browser.cjs` 通过：首次加载、离房重入、资源失败重试、CSS 覆盖顺序和延迟加载回归正常。
- 公共房间回归：`python3 -m unittest tests.test_room_session tests.test_bot_threading tests.test_game_dev_order -v`，39 项通过；与上述专项合计 60 项。JavaScript / Python 语法检查和限定文件的 `git diff --check` 通过。
- 全量 `python3 -m unittest` 执行 3605 项，结果为 19 failures / 1 error，失败分布在 Ark Nova、Guandan、Halli Galli，6nimmt 相关用例没有失败。未修改这些其他游戏来处理失败；本次不宣称全量测试通过。完整日志保留在 `tmp/six-nimmt-ui/full-tests.log`。
- AI 基准：`python3 scripts/benchmark_six_nimmt_ai.py --seeds 12 --seed 20261106 --output tmp/six-nimmt-ui/ai-benchmark.json`。相同发牌、轮换所有席位，候选替换原随机机器人一席，其余对手仍使用原随机出牌／最少牛头选行策略；每局比较完整 10 次出牌。

| 人数 | 配对轮数 | 原随机平均罚分 | 新策略平均罚分 | 新策略胜出份额（平局分摊） | 选牌 P95 |
| --- | --- | --- | --- | --- | --- |
| 2 | 24 | 7.375 | 5.458 | 64.6% | 10.989ms |
| 4 | 48 | 11.938 | 6.312 | 63.5% | 14.208ms |
| 6 | 72 | 13.653 | 7.972 | 34.0% | 16.690ms |
| 10 | 120 | 14.892 | 9.717 | 18.3% | 22.692ms |

- 这 264 个配对轮次属于固定种子、小规模基准，不代表对真人或其他高级 AI 的胜率；没有宣称最优策略。
- BGG：在 `scripts/bgg_weight_scrape.py` 注册 `https://boardgamegeek.com/boardgame/432/6-nimmt`，本次查询 `averageweight = 1.1879`，四舍五入仍为 `static/room.js` 已有的 1.19，无需改动该值。
- 未覆盖：真实 iOS Safari、Windows Emoji 字体、物理设备触摸及真实弱网／多设备竞态；移动端验证采用 Chromium 触摸模拟。10 人计分栏允许纵向滚动，牌桌与手牌不需要横向滚动；长名字在计分栏截断并通过提示显示全名，在结算中换行。

### 本次文件范围

- UI：`static/games/six_nimmt.html`、`static/games/six_nimmt.css`、`static/games/six_nimmt.js`；资源注册与缓存版本：`static/game_assets.js`、`static/index.html`。
- 策略与状态：`game/six_nimmt.py`、`game/six_nimmt_ai.py`；机器人事件隐私分支：`app.py`。
- 验证：`tests/test_six_nimmt.py`、`tests/test_six_nimmt_integration.py`、`tests/six_nimmt.browser.cjs`、`scripts/benchmark_six_nimmt_ai.py`；权重来源：`scripts/bgg_weight_scrape.py`。设计和验收记录直接更新本文，不新建独立任务文档。

## 2026-11-07：结算摆牌顺序图

- 每次揭牌结算优先展示四行牌桌图。本次新牌标注全桌摆放序号（`#1` 到 `#10`）、数字和出牌人，用姓名替换卡片底部牛头；原有牌压低显示，自己的新牌用绿色强调。
- 使用公开结算中的 `placements`、`taken_cards` 和最终 `rows` 还原行内变化，不依赖客户端历史，也不修改后端规则或公开视图。被吃走的牌保留为虚线卡片，注明收牌人的摆牌序号、姓名和新增罚分；同一行多次吃牌按发生顺序展示，新牌即使本轮又被吃走也保留归属。
- 罚分明细默认折叠，展开后仍可核对每个人的落点和被收走的数字。正文独立纵向滚动，View Table 与 Next Round 固定保留；确认人数更新不重建图示、不折叠明细，也不重置滚动位置。
- 手机卡片姓名最多两行，特别长的名字截断；鼠标悬停、键盘聚焦或手机点按可读全名、摆牌序号和去向，手机提示 3 秒后自动消失。说明同步到 Help 和 Explain。
- 修改文件：`static/games/six_nimmt.html`、`static/games/six_nimmt.css`、`static/games/six_nimmt.js`、`tests/six_nimmt.browser.cjs`、本文；资源版本同步到 `static/game_assets.js` 和 `static/index.html`。

### 验收

- `tests/six_nimmt.browser.cjs` 通过 Chrome headless 的 320、390、1024、1440px 检查，并人工核对桌面／手机截图；没有横向溢出，Next Round 始终可见。覆盖十人同一行连续吃牌、自选吃牌、第六张吃牌、安全放置、多行落点、旧牌／新牌区分、所有新牌只出现一次、出牌人和全桌序号、最终剩余牌、观战、HTML 名字转义、两行长名字、折叠明细及确认更新时滚动保持。
- 同一浏览器脚本同时通过悬停／触摸提示、Help／Explain／Esc、结算收起和重开、选牌／选行确认、触摸滚动防误选、真实房间机器人、刷新重连与 Next Round 回归。截图在 `tmp/six-nimmt-ui/`。
- `python3 -m unittest tests.test_frontend_style_assets -v`：2 项通过。`node --check` 检查游戏脚本与浏览器测试脚本，限定修改文件的 `git diff --check` 通过。
- 本次仅改 UI，没有运行游戏逻辑或全量单元测试。未检查真实 iOS Safari、Windows 字体、物理触摸设备、真实弱网与多设备并发；长图／展开明细保留正文纵向滚动，超长姓名保留截断加完整提示。
