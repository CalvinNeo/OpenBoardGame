# Task 93 - Emerald Skulls（翡翠骰骨）实现方案

## 1. 任务结论

在 OpenBoardGame 中新增 `Emerald Skulls`，内部游戏 ID 使用 `emerald_skulls`，中文名使用《翡翠骰骨》。首版实现官方多人基础模式：2-6 人、4 张标准下注牌、买骰、实时下注、递增层级放骰、骷髅万能面、鼻子重掷、重掷方块、5 种出局结果、3 种大奖、按下注先后结算，以及齿轮池耗尽时结束游戏。

首版不实现单人对手牌、进阶下注牌和 7-8 人扩展。这些模块不会改变多人基础状态机，后续可在 `betting_mode` 配置与独立数据目录中追加。创建房间列表明确显示 2-6 人，Help 中也明确标注当前范围，避免把未实现内容误写成已支持。

实现必须满足以下项目约束：

- 服务端权威保存随机数、骰池、下注顺序、齿轮与重掷方块，并只接受当前阶段合法的动作。
- 回合结算后进入 `turn_result`，所有真人点击 **Next Turn** 后才开始下一名投骰手的回合；Bot 自动确认。
- 游戏结束后保留最终盘面和完整结算摘要，并由所有玩家确认 **Play Again** 后重开。
- 前端主要逻辑放在 `static/games/emerald_skulls.js`，所有浏览器全局名称带 `emeraldSkulls` 前缀。
- 严格遵守 `FRONTEND.md` 与 `designs/task40.md`：Help / Explain、Explain 捕获与 disabled 按钮解释、Esc 退出、点击空白取消骰子选择、Emoji 货币/资源、移动端紧凑布局、日志滚动、无横向页面滚动。
- 不使用商业 Logo、规则书页面、卡图、版图扫描、产品摄影或商业字体；骷髅盘、骰子和下注牌全部由 HTML/CSS 与 Emoji 重绘。

## 2. 规则来源与数字版边界

### 2.1 已核对来源

- Thunderworks Games 官方产品页：<https://thunderworksgames.com/products/emerald-skulls-board-game>
- Thunderworks Games 官方英文规则：<https://cdn.shopify.com/s/files/1/0525/7753/4134/files/ES-Rulebook-Web.pdf?v=1731352923>
- BoardGameGeek：<https://boardgamegeek.com/boardgame/421762/emerald-skulls>

官方资料确认：游戏为 1-6 人、约 30-45 分钟；多人游戏中玩家轮流成为投骰手，其余玩家在投骰手持骰、掷骰前实时下注。基础规则齿轮池为每名玩家 40 枚；2 人 80、3 人 120，依此类推。

### 2.2 首版规则范围

每回合包含：

1. **Buy Dice**：投骰手免费取 3 骰，或花费 `1 / 3 / 6 / 10` 枚齿轮使用 `4 / 5 / 6 / 7` 骰。
2. **Allow Bets**：其他玩家各有 2 个下注标记，可在本回合不同次掷骰前下注；下注落下后不能移动。
3. **Roll**：投骰手掷骰池中所有骰子。
4. **Place / Reroll**：选择一个合法层级，放置至少 1 颗该点数或万能骷髅骰；也可消耗重掷方块，或从鼻子取回一颗普通 3 点骰后重掷。
5. **Check**：得到 Bust Out、Chicken Out、Gem Out、Run Out 或 Double Out；否则继续开放下注并再掷。
6. **Payout**：先结算投骰手，再依下注牌编号、牌内左侧后右侧、每叠下注由早到晚结算。

只有一次掷骰所得的一个层级可以被放置；不要求把该层级所有可放骰都放下。已达到的最高层级形成下限，之后只能放同层或更高层。眼睛最多 2 骰，额头宝石最多 1 骰；下颚、上颚、鼻子不限（但全局只有 7 骰）。

### 2.3 数字版明确裁定

- Socket.IO 到达服务端的顺序就是实时下注顺序；同一下注位先到者获得更高赔率。服务端回传 `sequence`，所有客户端看到相同顺序。
- `await_roll` 阶段投骰手点击 **Roll Dice** 即关闭本次下注窗口。界面持续提示投骰手给其他玩家合理下注时间，但不强制倒计时。
- 骰子使用稳定 ID `die-1` 到 `die-7`。服务端以 `seed + rng_counter + purpose` 生成确定性结果，存档恢复后不会重复或跳过随机结果。
- 万能骷髅骰在放置时记录其选定层级；鼻子重掷不能取回万能骰。
- 若一次掷骰没有任何合法放置，但仍可使用重掷能力，投骰手可以重掷或点击 **Accept Bust**；没有可用重掷时立即爆掉。
- 使用重掷方块时，若总共还未使用 7 颗骰，就从供应加入 1 骰；已经使用 7 骰时仍允许仅重掷当前骰池。
- 使用鼻子重掷后，即使鼻子层已没有骰，最低可放层仍为 3。
- Double Out 同时满足 Gem Out 与 Run Out，因此对应的基础下注都可中奖；其余下注按各自条件独立判断。
- 每名下注者每回合有 2 枚筹码；两枚可以先后放在同一个下注位置。每个位置按先到顺序占据从高到低的收益格，放下后不能移动。
- 结算中齿轮池不足时，当前收款人拿走剩余全部齿轮，后续款项不再支付，游戏立即结束。
- 平局依次比较重掷方块数量、最近担任投骰手者；仍无法区分则共同获胜。

## 3. 标准下注与结算数据

标准下注固定为服务端常量，前端只渲染服务端给出的结构：

| 编号 | 左侧下注（先结） | 赔率 | 右侧下注 | 赔率 |
| --- | --- | --- | --- | --- |
| 1 | Pick n' Bust：至少挖鼻 1 次后 Bust Out | 10 / 8 / 5 | Mad Nargash：仅以万能骰达成 Gem Out | 8 / 5 / 3 |
| 2 | Grim Grin：只在牙齿层达成 Run Out | 5 / 3 / 2 | Emerald Skull：7 骰 Full Skull Double Out | 10 / 8 / 5 |
| 3 | Busted Fowl：Bust Out 或 Chicken Out | 5 / 3 / 2 | Final Jewel：Gem Out | 2 / 1 |
| 4 | Empty Hands：Run Out | 2 / 1 | Empty n' Shiny：Double Out | 5 / 3 / 2 |

表中赔率按筹码到达顺序从左至右列出，越早下注收益越高。

大奖是投骰手可选的结算方式，若同时满足多个，只能从标准结算与所有已满足大奖中选一个：

- **Mad Nargash**：Gem Out 且版图上全为万能骰；每颗已放万能骰 5 齿轮。
- **Grim Grin**：Run Out 且骰子只在两层牙齿；每颗普通 1/2 点骰 3 齿轮，万能骰不计分。
- **Emerald Skull**：Double Out 且为 Full Skull（牙齿共 3、鼻子 1、眼睛 2、宝石 1）；固定 30 齿轮。

标准投骰手逐骰收益：

| 层级 | Chicken / Gem Out | Run / Double Out |
| --- | ---: | ---: |
| 💎 宝石 | 3 ⚙️ | 5 ⚙️ |
| 👁️ 眼睛 | 2 ⚙️ | 5 ⚙️ |
| 👃 鼻子 | 1 🟩 | 1 🟩 |
| 🦷 上颚 | 1 ⚙️ | 2 ⚙️ |
| 🦷 下颚 | 1 ⚙️ | 1 ⚙️ |

万能骰仅在 Gem Out / Double Out 时按所放层级计入标准收益；Chicken Out / Run Out 时忽略万能骰。

## 4. 服务端设计

新增 `game/emerald_skulls.py`，实现 `EmeraldSkullsGame` 的 `init_game`、`get_legal_actions`、`apply_action`、`get_public_view`、`bot_move`、`serialize` 和 `deserialize`。

### 4.1 状态结构

```python
{
    "version": 1,
    "game_id": "emerald_skulls",
    "config": {"seed": "...", "betting_mode": "standard"},
    "turn_order": ["p1", "p2"],
    "active_player_id": "p1",
    "phase": "buy_dice",
    "turn_number": 1,
    "gear_supply": 80,
    "players": {
        "p1": {"gears": 0, "reroll_cubes": 0, "bets": [], "ready": False}
    },
    "chosen_dice_count": None,
    "dice_cost": 0,
    "dice": [
        {"die_id": "die-1", "face": None, "zone": "supply", "level": None}
    ],
    "minimum_level": 1,
    "nose_picks": 0,
    "bet_sequence": 0,
    "bet_stacks": {"<bet_id>": []},
    "result": None,
    "payout_options": [],
    "turn_result": None,
    "review_ready": [],
    "activity": [],
    "game_over": False,
    "winner_ids": []
}
```

骰子在 `pool / rolled / board` 三个区域之一，状态断言检查 7 个稳定 ID 恰好各出现一次。`result` 只在出局后产生；若有多个投骰手结算选项，先进入 `choose_payout`，否则服务端直接结算并进入 `turn_result`。

### 4.2 动作

- `buy_dice {count}`
- `place_bet {bet_id}`
- `roll`
- `place_dice {level, die_ids}`
- `spend_reroll_cube`
- `pick_nose {die_id}`
- `continue_roll`
- `chicken_out`
- `accept_bust`
- `choose_payout {option_id}`
- `next_turn`
- `play_again`

`place_bet` 可与投骰手的顺序动作并发到达，但只在服务端仍处于 `await_roll` 时有效。动作 schema 对骰子数量、层级、稳定 ID、下注 ID、额外字段与类型做严格约束；业务层再次校验所属玩家、阶段、余额、容量和可放性。

### 4.3 Bot

- 买自己能承受的 3-5 骰，保留至少 1 齿轮。
- 下注优先选择仍有最高赔率空位、且与当前盘面仍相容的结果。
- 放骰时用“避免立即爆掉 + 预期标准收益 + 可达大奖”排序；低收益高风险时 Chicken Out。
- 有 Bust 风险时优先使用已持有的重掷方块，其次合法挖鼻；结果回顾自动确认。

Bot 不读取客户端不可见信息，也不修改随机结果。

## 5. 前端与交互

### 5.1 页面结构

在现有游戏页中新增：

- 顶部状态条：投骰手、阶段、回合、齿轮池。
- 玩家横向自适应卡片：名称、⚙️ 齿轮、🟩 重掷方块、剩余下注标记、确认状态。
- 中央原创骷髅盘：5 个自上而下的层级槽，用 `💎 / 👁️ / 👃 / 🦷`、层级数字、颜色和轮廓共同区分。
- 骰盘：绿色 CSS 骰子，普通面显示 `Ⅰ-Ⅴ`，万能面显示 `💀`；可放骰可点选，选中后显示半透明蒙版与 `Place`。
- 标准下注牌：2×2 响应式网格；每侧显示条件、赔率位和按先后排列的玩家标记。
- 操作坞：只显示当前阶段相关的 1-3 个主要按钮，不需要输入 JSON。
- 回合结算卡：本回合结果、投骰手收益、每个中奖下注、未支付款项和 Next Turn 确认进度。
- 可滚动 Game Log。

页面在桌面使用盘面 + 下注双栏；小于 820px 改为单栏，下注牌 2 列；小于 520px 改为 1 列，按钮在可容纳时保持一行两个。任何区域都设置 `min-width: 0`，长名字截断，禁止横向页面滚动。

### 5.2 Help / Explain

Help 包含目标、完整回合、放骰限制、5 种结果、标准结算、3 种大奖、下注先后、游戏结束与首版范围。

Explain 模式为以下元素提供说明：买骰按钮、Roll、骰子、每个骷髅层、两种重掷、Chicken Out、Accept Bust、下注侧、赔率叠、大奖选择、Next Turn、玩家资源与日志。进入模式后：

- 有解释的控件显示虚线高亮和问号光标。
- 无解释按钮仍拦截原功能但不改变外观。
- 使用捕获阶段 `pointerdown` + 坐标命中，使 disabled 按钮仍可解释。
- 点开一次解释后自动退出；Esc 可退出 Explain 或关闭最上层对话框。

点击骰盘、骷髅盘与操作坞之外的空白区域会清除当前骰子选择，不增加 Clear Selection 按钮。

## 6. 注册与集成

- `game/__init__.py` 与 `game/definitions.py`：导入并注册 `EmeraldSkullsGame`。
- `game/definitions.py`：新增严格 action/config JSON Schema。
- `game/tags.py`：标签为 `filler`、`push_your_luck`、`auction`。
- `game/dev_order.json`：运行 `python scripts/gen_dev_order.py` 后纳入新 ID。
- `scripts/bgg_weight_scrape.py`：加入 BGG URL；`static/room.js` 使用抓取到的 2 位小数 weight。
- `static/index.html`：新增 header actions、游戏面板、Help/Explain 弹窗与脚本标签。
- `static/app.js`：仅加入全局游戏面板切换和状态渲染分发。
- `static/style.css`：新增 `.emerald-skulls-*` 命名空间样式。

## 7. 测试与验收

新增 `tests/test_emerald_skulls_game.py`，至少覆盖：

- 2-6 人初始化、齿轮池与确定性随机。
- 买骰价格和余额限制。
- 实时下注的数量、同一位置双筹码、容量、顺序与不可移动。
- 普通面/万能面放置、单层限制、递增层级、眼睛/宝石容量。
- 重掷方块加骰、7 骰上限、鼻子取回限制与最低层保留。
- 5 种结果及 Double Out 同时满足 Gem/Run 条件。
- 标准逐骰结算、万能骰计分差异、鼻子方块奖励。
- 3 种大奖识别与投骰手选择。
- 8 个标准下注条件、赔率叠顺序和结算牌序。
- 齿轮池中途耗尽、胜者和平局规则。
- 所有真人 Next Turn 后才换回合、Bot 自动确认、Play Again。
- 公共视图不泄漏下一次随机结果，存档往返保持状态且拒绝损坏数据。

运行：

```bash
python -m unittest tests.test_emerald_skulls_game
python -m unittest tests.test_game_dev_order tests.test_game_names tests.test_game_tags tests.test_frontend_script_names
```

前端人工验收使用桌面约 1280px、手机约 390px 两种视口，检查 Explain 对 disabled 控件、Esc、空白取消选择、长日志滚动、结算停顿、无重叠和无横向滚动。
