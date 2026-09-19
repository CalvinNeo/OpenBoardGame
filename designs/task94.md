# Task 94 — CATAN: Starfarers（星际卡坦）实现方案

## 1. 任务结论

在 OpenBoardGame 中新增 2019 年重制版 `CATAN: Starfarers`，内部游戏 ID 使用 `catan_starfarers`，中文名使用《星际卡坦》。

首版实现 2019 基础盒的完整 3–4 人规则：

- 资源生产、7 点贡税、地球补给牌堆、玩家交易、银行交易和建造。
- 殖民船、贸易船、太空港、推进器、舰炮和货舱升级。
- 母舰彩球速度、遭遇、逐船飞行、星区发现、星系探索、殖民地、外星贸易站、海盗基地和冰冻星球。
- 4 个外星文明的 20 张友谊卡、友谊标记多数权、32 张基础遭遇卡和声望半章。
- 官方基础盒的 `beginner`、`strategic`、`explorer`、`wild_space` 四种设置。
- 3–4 人、Bot、断线重连、房间存档、Play Again 和服务端权威随机。

首版明确不包含：

- 1999 年旧版 `The Starfarers of Catan` 的旧地图、旧数值和旧组件规则。
- 5–6 人扩展、Travelers 外星前哨及双驾驶员回合规则。
- `New Encounters` 三个剧本、宣传遭遇卡、星际侦察员场景。
- 2 人独立游戏 `Starfarers Duel`。

实现必须满足仓库约束：

- 前端主要逻辑放在 `static/games/catan_starfarers.js`；所有浏览器全局名称使用 `catanStarfarers` 或 `CatanStarfarers` 独有前缀。
- 严格遵守 `FRONTEND.md` 和 `designs/task40.md`：Help / Explain、disabled 控件可解释、Esc 退出、点击空白取消选择、Emoji + 颜色 + 文字联合编码、移动端紧凑布局、日志内部滚动、页面无横向滚动。
- 每名玩家的完整回合结束后进入 `turn_review`，所有真人点击 **Next Turn** 才开始下一回合；Bot 自动确认。
- 服务端权威保存地图暗置内容、数字牌、资源补给顺序、遭遇牌顺序、骰子和彩球结果；客户端不能推算未来随机结果。
- 不使用 CATAN Logo、盒图、规则书截图、版图扫描、遭遇卡图、友谊卡图、外星人插画、母舰模型或商业字体。地图与组件全部用原创 SVG、CSS、文字和 Emoji 表达。

## 2. 游戏识别、来源与版本边界

### 2.1 基本信息

- 英文名：`CATAN: Starfarers`
- 中文名：《星际卡坦》
- 年份：2019
- 设计者：Klaus Teuber
- 玩家人数：3–4 人
- 官方时长：约 120 分钟
- 胜利目标：在自己的回合达到至少 15 VP
- BoardGameGeek ID：`282853`
- 官方产品页：<https://www.catan.com/starfarers>
- 官方基础规则：<https://www.catan.com/sites/default/files/2021-06/catan_starfarers_rulebook_eng_190823s_0_0.pdf>
- 官方 Almanac：<https://www.catan.com/sites/default/files/2021-06/catan_starfarers_almanac_eng_190823s_0.pdf>
- 官方 FAQ：<https://www.catan.com/faq/starfarers-catan>
- BGG：<https://boardgamegeek.com/boardgame/282853/catan-starfarers>

官方资料确认本方案使用的是 2019 年“完全修订的新版本”，而不是 1999 年旧版。两版的地图、母舰球数、特殊数字牌和若干规则不同，数据文件与测试不得交叉复用。

截至方案编写时，BGG 页面显示 Weight `2.60 / 5`。实现时仍应按仓库约定把 BGG URL 加入 `scripts/bgg_weight_scrape.py`，运行脚本取得当时数值，再以两位小数写入 `static/room.js`；本文数值不作为永久常量。

### 2.2 首版范围

首版实现基础盒内的完整核心系统和 4 种基础盒设置：

| `setup_mode` | 星区正反面 | 初始殖民 | 适用说明 |
| --- | --- | --- | --- |
| `beginner` | 官方入门固定布局，星区明置 | 官方固定位置 | 默认选项，适合首次游玩 |
| `strategic` | 近区／远区分别随机，星区明置 | 进阶 4 轮设置 | 能看见星区类型，但数字牌暗置 |
| `explorer` | 近区／远区分别随机，星区暗置 | 进阶 4 轮设置 | 飞船抵达后才发现星区 |
| `wild_space` | 全部星区混洗，随机移除 1 个，星区暗置 | 进阶 4 轮设置 | 可能少 1 个星系或外星前哨 |

创建房间时使用两步可视化选择器，不允许用户输入 JSON：先选择 `English / 中文`，再选择四种 `setup_mode`。未选择语言前布局按钮保持 disabled，并用 title 说明原因；语言与布局在建房时写入不可变房间配置。

### 2.3 商业素材与文字边界

不得提交或临摹：

- CATAN / CATAN Sun Logo、商品封面、官方版图底图、规则书页面或排版。
- 官方塑料母舰、殖民船、贸易船、外星前哨、友谊标记的精确造型。
- 官方星球、外星文明、遭遇卡、友谊卡插画和商业字体。
- 官方遭遇卡的完整叙事文字或逐字翻译。
- 从商品图、扫描件、视频或 Tabletop Simulator 模组裁切的素材。

可以实现公开规则机制、数值、拓扑和简短功能性说明。遭遇卡使用稳定 ID、原创短标题和重新表述的提示语；数据中只保存执行机制所需的分支，不复制原卡长文本。

视觉采用原创“深空航行仪表”方向：午夜蓝背景、低饱和星云、简洁轨道线和高对比状态光。资源与升级始终使用图标、文字、形状和颜色共同区分，不能只依赖颜色：

| 内容 | 显示建议 |
| --- | --- |
| Ore | `🔴 ⛏️ Ore` |
| Fuel | `🟠 ⛽ Fuel` |
| Carbon | `🔵 💠 Carbon` |
| Food | `🟢 🌿 Food` |
| Goods | `🟣 📦 Goods` |
| Booster | `🚀 Booster` |
| Cannon | `💥 Cannon` |
| Freight Pod | `📦 Freight` |
| Fame / VP | `🏅 Fame` / `⭐ VP` |

## 3. 已确认的基础规则

### 3.1 组件与公共库存

服务端数据按以下基础盒组件建模：

- 16 个星区：8 个行星系、4 个外星前哨、4 个空星区；一局使用 15 个。
- 36 个数字牌，其中 5 个为清除海盗基地／冰冻星球后的备用生产数字牌。
- 3 个海盗基地特殊标记、2 个冰冻星球特殊标记。
- 100 张资源牌：Ore、Fuel、Carbon、Food、Goods 各 20 张。
- 32 张遭遇牌。
- 4 个可建立贸易站的外星文明，每个文明 5 张友谊卡，共 20 张；Travelers 只出现在遭遇中。
- 40 个声望半章；每 2 个半章值 1 VP。
- 公共升级：24 个 Booster、24 个 Cannon、20 个 Freight Pod。
- 每种玩家颜色：9 个 Colony、7 个 Trade Station、3 个 Transport Ship、3 个 Shipyard、1 个 VP 标记。
- 每名玩家的母舰随机器包含 5 个球：2 个黄色、1 个蓝色、1 个红色、1 个黑色。

海盗基地强度为 `4 / 5 / 6`，冰冻星球需求为 `3 / 4`。精确数字牌正面、背面类型及备用生产数字必须从 2019 组件再次逐项审计后写入数据文件，并由数量校验测试锁定。

### 3.2 开局

所有模式中，玩家最终都拥有：

- 2 个普通 Colony。
- 1 个由 Colony 升级而成的 Spaceport。
- 1 艘起始船。
- 3 张从补给牌堆抽取的私密资源。
- 1 个声望半章。
- 4 VP。

`beginner` 使用规则书固定位置，每人起始船固定为 Colony Ship，并获得 1 个 Booster。3 人局把未使用颜色的固定起始建筑渲染成中立封锁点，它们不属于玩家、永不生产、不能移动。

进阶设置依次进行：

1. 起始玩家开始，顺时针每人放第 1 个 Colony。
2. 上一轮最后一人开始，逆时针每人放第 2 个 Colony。
3. 起始玩家开始，顺时针每人放第 3 个 Colony。
4. 上一轮最后一人开始，逆时针每人把其中 1 个 Colony 升级为 Spaceport、选择 Colony Ship 或 Trade Ship 放到相邻空位，并从 `2 Booster + 1 Cannon + 1 Freight Pod` 的公共奖励池取 1 个。

3 人进阶局只有 3 个奖励升级，剩余的 Catanian Colony 空位在设置完成后永久关闭。设置阶段允许 3 人局在同一初始星系占满 3 个位置；正式游戏中的新行星系仍最多只能建 2 个 Colony。

### 3.3 回合结构

每个玩家回合依次为：

1. **Production**：掷 2d6，处理行星生产或点数 7；随后按当前 VP 从地球补给牌堆抽牌。
2. **Trade & Build**：可任意次、任意顺序交易和建造。
3. **Flight**：若有船在版图上，摇母舰取得速度，必要时结算遭遇，再逐艘移动。
4. **Turn Review**：保留本回合生产、交易、建造、遭遇、探索和得分摘要；所有真人点击 **Next Turn** 后才换人。

如果当前玩家没有任何船在版图上，跳过母舰随机和 Flight 操作，但仍进入 `turn_review`。

### 3.4 资源生产与点数 7

普通点数：

- 每个与命中数字行星相邻的 Colony 或 Spaceport 生产 1 张对应资源。
- Spaceport 仍只生产 1 张，不像经典 CATAN 的城市生产 2 张。
- 同一资源供应不足以支付该资源的所有完整产量时，该资源所有玩家都不获得；其他资源仍正常结算。
- Green Folk 友谊卡的额外 `+1` 先计入该玩家完整产量，再做供应是否足够的整体判断。

地球补给牌堆：

- 初始从每种资源各取 8 张，共 40 张并洗牌。
- 当前玩家 4–7 VP 抽 2 张，8–9 VP 抽 1 张，10+ VP 不抽。
- 牌堆用完时从银行中按规则重新建立并洗牌。
- 抽到的类型只对获得者可见；其他玩家只看到其手牌总数变化。

掷出 7 时，严格按顺序处理：

1. 所有超过手牌上限的玩家秘密弃掉向下取整的一半。通常上限为 7；持有 Reduced Tribute 时上限为 12。
2. 当前玩家选择 1 名有资源的对手，服务端从其手牌中等概率随机偷 1 张。
3. 从当前玩家左手边开始，其余每名玩家依次从补给牌堆抽 1 张。
4. 当前玩家再按自己的 VP 抽 0–2 张常规补给。
5. 进入 Trade & Build。

所有需要弃牌的真人可以并行提交，但服务端必须等全部提交后才进行偷牌；提交内容仅本人可见。Bot 自动提交。

### 3.5 交易与建造

玩家交易：

- 只有当前玩家可以发起并最终确认交易。
- 非当前玩家只能与当前玩家交易，不能彼此交易，也不能与银行交易。
- 双方给出的资源都必须非空，不能赠送资源。
- 报价、还价和接受都是原子动作；最终确认时重新校验双方手牌。

银行交易：

- 默认 3 个相同资源换 1 个其他资源。
- Goods 默认 2:1。
- Merchants 友谊卡可提供指定普通资源 2:1，或每回合一次 Goods 1:1。

建造费用：

| 项目 | 费用 | 结果／上限 |
| --- | --- | --- |
| Colony Ship | 1 Ore + 1 Fuel + 1 Carbon + 1 Food | 消耗 1 Colony + 1 Transport；只能从自己的空 Spaceport 邻位发射 |
| Trade Ship | 1 Ore + 1 Fuel + 2 Goods | 消耗 1 Trade Station + 1 Transport；只能从自己的空 Spaceport 邻位发射 |
| Spaceport | 3 Carbon + 2 Food | 把现有 Colony 升级；每人最多 3 个 |
| Freight Pod | 2 Ore | 每人最多 5；用于贸易站与冰冻星球 |
| Cannon | 2 Carbon | 每人最多 6；用于战斗与海盗基地 |
| Booster | 2 Fuel | 每人最多 6；每个使所有船本回合速度 `+1` |

已经购买的升级不能卖回银行。建造或遭遇导致资源、组件位置变化时，所有未完成交易报价立即失效，避免使用过期手牌快照。

### 3.6 母舰随机与飞行

彩球数值：

- Blue = 1
- Yellow = 2（袋中有 2 个）
- Red = 3
- Black = 0（战斗）／触发遭遇（飞行）

数字版每次从 `[yellow, yellow, blue, red, black]` 中无放回等概率抽 2 个：

- 飞行时没有 Black：两球之和是基础速度，范围 3–5。
- 飞行时出现 Black：先触发遭遇，基础速度固定为 3，另一球数值忽略。
- 总速度 = 基础速度 + 实体 Booster + Scientists 友谊卡提供的速度。
- 同一总速度适用于当前玩家的所有船，每艘船都可最多移动这么多条边。

只要版图上有船，即使玩家不想移动，也必须摇母舰。船可以少走、走 0 步、沿已走过的边返回，也可以穿过被船或建筑占据的节点；但完成移动时一个节点只能有 1 个可占据棋子。

每艘船依次完成自己的移动，切换到下一艘后不能返回继续移动上一艘。遭遇中获得的新升级立即影响尚未完成移动的船；本飞行阶段获得的新免费 Trade Ship 在可放置时立即加入，并可于本回合移动。

### 3.7 发现、探索与特殊星球

需要区分两个动作：

- **Discover sector**：`explorer` / `wild_space` 中，船第一次到达暗置星区邻接点时翻开整个星区。
- **Explore system**：船第一次到达未探索行星系邻接点时，同时翻开该星系的 3 个数字牌。

发现或探索发生在移动途中，处理后若仍有速度可以继续移动。

特殊星球：

- 船到达海盗基地相邻节点，玩家有效 Cannon 数量达到标记要求时，立即清除基地。
- 船到达冰冻星球相邻节点，实体 Freight Pod 数量达到标记要求时，立即改造星球。
- 清除者取得对应永久 Fame Medal，值 1 VP，遭遇不能夺走。
- 服务端随机抽 1 个备用生产数字放到该星球；之后它可以生产。
- 不需要同时建立 Colony；取得奖章后可以继续飞行。
- Scientists 卡的 Cannon 加成可用于海盗基地；它不增加实体 Freight Pod。

一条移动步若同时让船邻接多个可立即清除的特殊星球，服务端按稳定 `planet_id` 顺序全部处理；每处理一个后检查当前玩家是否已在自己的回合达到 15 VP。

### 3.8 Colony、Spaceport 和飞行终点限制

- Colony Ship 在两个行星之间的空 Colony Site 结束移动时，可以立即建立 Colony，Transport 返回个人供应。
- 如果暂不建立，它下个自己的 Flight 必须建立或离开该节点；遭遇明确禁止移动时除外。
- 不能在与未清除海盗基地或冰冻星球相邻的位置建立 Colony。
- 正式游戏中不能再向 Catanian Colonies 增建 Colony。
- 4 人局每个新行星系最多 3 个 Colony；3 人局最多 2 个。
- Colony 永久存在；可在 Trade & Build 中升级为 Spaceport。
- Trade Ship 永远不能以 Colony Site 为移动终点。
- Colony Ship 永远不能以外星前哨的 Docking Point 为移动终点。
- 任何船都不能结束在其他玩家的 Spaceport Site。
- 如果升级 Spaceport 后对手的船恰好占据新形成的 Spaceport Site，该船在其下个 Flight 必须优先移开；即使遭遇要求锁定一艘船，也不能选择它规避清场。

### 3.9 外星前哨、友谊卡与多数权

Trade Ship 在前哨中心 Docking Point 结束移动时必须立即建立 Trade Station：

- 所需 Freight Pod 数量必须严格大于该前哨已经存在的 Trade Station 总数，即第 1–5 个站分别需要 1–5 个 Freight Pod。
- 只在建立当时检查需求；之后失去 Freight Pod 不会拆除旧站。
- Transport 返回个人供应，Trade Station 永久留在前哨。
- 玩家从该文明剩余的 5 张明置友谊卡中选择 1 张，效果立即生效。

Friendship Marker 值 2 VP：

- 第一个建立站的玩家取得标记。
- 后续建站者只有在自己的站数严格大于当前持有者时才夺取标记。
- 平局时当前持有者保留；不是重新按座位或首次建站顺序计算。

四类友谊卡的数据范围：

- **Diplomats**：7 点手牌上限提升、Goods 购买声望、落后玩家抽取对手资源、未生产时领取救济资源。
- **Merchants**：4 种普通资源的 2:1 银行汇率，以及每回合一次 Goods 1:1。
- **Green Folk**：Ore / Fuel / Carbon / Food / Goods 各 1 张生产 `+1`。
- **Scientists**：`+2 Cannon`、`+2 Booster`、3 张 `+1 Cannon +1 Booster`。

友谊卡是永久明置能力。遭遇要求移除母舰升级时，只能移除实体升级，不能移除或计算 Scientists 卡。

### 3.10 遭遇

基础牌堆共 32 张。飞行摇出 Black 后：

1. 当前玩家左侧玩家成为 `reader_id`，其私密视图能看到整张机制化遭遇内容。
2. Reader 点击 **Read Prompt**，全桌只看到重新表述的开场提示，不看到未选择分支。
3. 当前玩家提交 Yes / No、0–3 个资源或遭遇要求的其他选择；作为礼物的资源立即交回银行。
4. Reader 点击 **Reveal Result**，服务端执行对应分支并向所有人显示本次实际结果。
5. 若结果还要求选择资源、升级、船、对手或 Space Jump 终点，状态机继续阻塞到选择完成。
6. 结算后该牌进入弃牌堆，当前玩家以基础速度 3 继续 Flight，除非结果锁定了船。

遭遇中的战斗／速度比较由服务端为双方独立摇母舰：

- 主动玩家的战斗值 = 两球值 + 实体 Cannon + Scientists Cannon。
- 扮演海盗的对手只使用彩球与实体 Cannon，不获得 Scientists 卡加成；其本人不承受卡上奖励或处罚。
- 主动玩家平局视为成功。
- 普通速度比较使用双方全部有效 Booster；数字版不让玩家手动声明随机结果。

两张 Wear and Tear 对所有玩家依次生效；需要移除升级时，相关真人并行选择，Bot 自动选择。触发“重洗并抽新遭遇”的牌结算时，将当前触发牌暂时留在外面，洗混其余抽牌堆与弃牌堆后抽新牌，最后再把触发牌放入弃牌，避免立即抽回自身造成无限链。

所有 32 张遭遇必须数据化并逐分支测试。UI 文字使用原创短提示，数据动作至少覆盖：资源获得／支付／随机抽取、声望增减、免费升级、移除实体升级、锁定船、待放置免费 Trade Ship、Space Jump、速度／战斗比较、全员效果、按升级最多者奖励、重洗并继续抽牌。

### 3.11 得分与结束

VP 由状态实时派生，不把手工维护的 VP 轨道作为唯一真值：

```text
普通 Colony                 1 VP
Spaceport                    2 VP
持有 Friendship Marker      2 VP
已清除特殊星球永久奖章       1 VP
每 2 个 Fame Medal Pieces   1 VP
```

玩家只在自己的回合达到或保持至少 15 VP 时获胜，游戏立即结束，不等待其他玩家补回合：

- 当前玩家因建造、特殊星球、友谊标记、遭遇或声望达到 15，立即进入 `game_over`。
- 非当前玩家因全员遭遇奖励暂时达到 15，不会在别人的回合获胜；轮到其回合时若仍有至少 15 VP，在 Production 前立即获胜。
- 不存在最高分比较、最终轮或平局裁定；合法规则下一次只会由当前玩家触发胜利。

## 4. 数字版明确裁定

### 4.1 随机与隐藏信息

- 房间配置不接受公开 seed。
- `init_game` 使用 `secrets` 生成私密 `rng_seed`，搭配单调 `rng_counter` 和用途域生成确定性随机流。
- Dice、彩球、资源补给、星区、数字牌、备用数字、遭遇、随机偷牌分别使用域隔离，避免一次逻辑改动改变所有后续随机。
- 存档包含私密 seed 与 counter；公共视图和日志永不包含它们。
- 测试通过私有 helper 注入 seed，不把 seed 加入联网配置 schema。

### 4.2 补给牌堆重建

规则要求牌堆耗尽时再次从银行各取 8 张。若某种资源在银行少于 8，数字版从该种实际可用数量中全部取走，其他种仍最多取 8，混洗成新补给牌堆；绝不凭空生成资源。若银行完全没有牌，等待资源经建造、交易或弃牌回流后再重建。

所有补给抽牌都由服务端逐张执行；如抽牌中途耗尽，立刻重建后继续尚未完成的抽取。

### 4.3 在线交易协议

为保留自由协商而避免聊天文字解析，使用结构化交易抽屉：

1. 当前玩家用 `+ / −` 步进器设置 **You give** 和 **You want**，点击 **Open Offer**。
2. 其他玩家可 **Accept Terms**，也可用同样的资源控件提交 Counter Offer。
3. 当前玩家看到所有有效回应，选择其中一个 **Finalize**；只有该动作会交换资源。
4. 任何一方资源不足、手牌版本变化、回合阶段变化或报价被取消时，响应失效。

报价公开展示双方愿意交换的资源，这是玩家主动公开的信息；除此之外只公开手牌张数。不得设计自由文本或 JSON 输入。

### 4.4 逐步移动，不让客户端自动猜路径

地图上多条等长路线可能探索不同星区，发现内容又可能改变后续可走图，因此不能只发送目标让客户端猜最短路。采用逐边动作：

- **Select Ship** 后，服务端只返回下一步合法相邻节点。
- 点击相邻节点发送 `move_ship_step`，服务端消耗 1 移动力并立即处理发现／探索／特殊星球。
- 玩家可沿已有路径返回，仍正常消耗移动力。
- **Finish Move** 明确结束当前船；点击地图空白只取消本地选中，不撤销已经提交的移动。
- Space Jump 是独立动作，可把 1 艘船放到任意合法空节点并立即结束该船移动。

客户端只做高亮和预览，所有邻接、占用、终点类型、移动力和强制清场规则由服务端重验。

### 4.5 遭遇 Reader 与掉线

保留实体版“左侧玩家知道完整卡、当前玩家先做决定”的信息结构：

- Reader 的完整遭遇内容只出现在其 `get_public_view`。
- 当前玩家和其他人只看到已经读出的 prompt 与已经揭示的实际结果。
- Reader 不能上传文字、选择结果或修改效果；其按钮只是推进服务端预定义状态。
- Reader 是 Bot 时自动推进；真人掉线时保留席位并等待重连，不把完整遭遇泄漏给其他玩家。

### 4.6 回合复盘停顿

`turn_review` 严格满足 `FRONTEND.md`：

- 显示生产骰、资源张数变化、公开交易、建造、母舰结果、遭遇实际结果、探索、得分和当前版图。
- 所有真人（包括本回合没有动作的人）都要点击 **Next Turn**。
- Bot 自动确认；掉线真人不会自动确认，重连后继续。
- 达成 15 VP 时直接停在 `game_over`，最终状态不会自动消失。
- `game_over` 中所有真人点击 **Play Again** 后，以相同 `setup_mode` 和全新私密 seed 重开。

### 4.7 供应不足与强制奖励

- 普通生产先计算某资源的全部应得总量；供应不足则该资源无人获得。
- 遭遇、救济或选择性奖励按动作发生顺序领取，供应不足时只能领取仍存在的牌。
- 免费升级若对应公共库存为空，则该选项不合法；所有三种都为空时奖励落空。
- 免费 Trade Ship 无法立即放置时记录 `pending_free_trade_ships`；一旦出现可用 Transport、Trade Station 和 Spaceport Site，必须在下一可行时机先放置。
- Fame Medal Piece 供应为空时不能凭空获得；永久特殊星球奖章不占 40 个半章库存。

## 5. 数据与地图设计

### 5.1 文件拆分

建议新增：

```text
game/catan_starfarers.py
game/catan_starfarers_data.py
game/assets/catan_starfarers/map_graph.json
game/assets/catan_starfarers/sectors.json
game/assets/catan_starfarers/number_discs.json
game/assets/catan_starfarers/friendship_cards.json
game/assets/catan_starfarers/encounters.json
static/games/catan_starfarers.js
static/catan_starfarers.css
tests/test_catan_starfarers_game.py
tests/test_catan_starfarers_data.py
```

运行时不能依赖 `designs/`、网络或商业图片。Python 只加载随仓库提交并经过启动校验的数据。

### 5.2 原创 SVG 地图与权威图结构

`map_graph.json` 保存规则拓扑，不保存官方底图：

```json
{
  "slots": [{"id": "near-01", "x": 0.18, "y": 0.72, "band": "near"}],
  "nodes": [{"id": "n-001", "x": 0.12, "y": 0.66, "kind": "space"}],
  "edges": [["n-001", "n-002"]],
  "catanian_systems": [],
  "beginner_layout": {},
  "beginner_starting_pieces": {}
}
```

设计要求：

- 坐标归一化，客户端用一个带 `viewBox` 的 SVG 绘制；规则合法性只使用 node / edge ID。
- 星区模板定义局部节点、行星、Colony Site、Docking Point、与外部图的连接口。
- 暗置星区只向客户端暴露统一背面和边界接口，不暴露模板 ID、内部节点数或星区类型。
- 星区翻开后服务端把对应公开节点和边加入 view；客户端不能从本地资源反查该局暗置分配。
- 所有星区使用规范朝向；不额外引入规则未要求的随机旋转。

### 5.3 数据驱动内容

数字牌记录：

```json
{
  "id": "number-red-07",
  "back_group": "red",
  "kind": "production",
  "numbers": [6, 10]
}
```

友谊卡记录稳定 ID、文明、公开短名、被动修正或主动能力、每回合次数。遭遇卡使用受限效果 DSL：

```json
{
  "id": "encounter-01",
  "prompt_key": "merchant_gift",
  "choice": {"kind": "resource_count", "min": 0, "max": 3},
  "branches": {
    "0": [{"op": "gain_resource_choice", "count": 1}],
    "1": [{"op": "gain_fame", "count": 1}]
  }
}
```

允许的 `op` 必须白名单化，不能在 JSON 中执行表达式、Python 名称或任意脚本。复杂条件由明确的组合节点表示，并由数据测试覆盖所有分支可达性。

### 5.4 数据启动校验

模块导入或首次初始化时校验：

- 16 个星区 ID 唯一，类别数为 `8 / 4 / 4`，近／远星标分组合法。
- 36 个数字牌 ID 唯一，背面分组能一一匹配全部行星，特殊牌和 5 个备用牌数量正确。
- 32 个遭遇 ID 唯一，每个选择都有完整分支，所有 op 和参数合法。
- 20 张友谊卡恰好分成 4 组各 5 张，主动能力次数与被动修正合法。
- 地图边无悬空节点、无自环、邻接对称，所有特殊 site 只有合法数量的相邻行星。
- 所有固定入门位置合法，3 人中立封锁不会生产。
- 每个星区模板在允许的 slot 中都能正确连接。

数据错误应在启动／测试时明确失败，不能在游戏中静默跳过。

## 6. 服务端设计

### 6.1 游戏模块接口

新增 `CatanStarfarersGame`，实现仓库标准接口：

- `init_game(config, players)`
- `get_legal_actions(state, player_id)`
- `apply_action(state, player_id, action)`
- `get_public_view(state, viewer_id)`
- `bot_move(state, bot_id)`
- `serialize(state)`
- `deserialize(payload)`

`GameDefinition.turn_mode` 使用 `turn`。7 点并行弃牌、交易响应、全员遭遇选择和复盘确认由每名玩家各自的 `legal_actions` 表达，不依赖 `simultaneous` 模式。

### 6.2 状态结构

建议权威状态：

下列对象仅展示字段形状与典型值，并不是组件数量守恒的完整开局快照；正式初始化必须由组件清单生成并通过第 6.7 节断言。

```python
{
    "schema_version": 1,
    "game_id": "catan_starfarers",
    "config": {"setup_mode": "beginner"},
    "rng_seed": "server-secret",
    "rng_counter": 42,
    "phase": "production",  # setup | production | seven_discard | trade_build |
                              # encounter | flight | turn_review | game_over
    "subphase": None,
    "turn_no": 7,
    "turn_order": ["p1", "p2", "p3"],
    "active_player_id": "p2",
    "setup": {
        "round": None,
        "order": [],
        "index": 0,
        "bonus_upgrades": []
    },
    "board": {
        "slots": {
            "near-01": {
                "sector_id": "sector-system-03",
                "revealed": True,
                "explored": False
            }
        },
        "planets": {},
        "colonies": {},
        "spaceports": {},
        "trade_stations": {},
        "ships": {},
        "closed_colony_sites": []
    },
    "removed_sector_id": "sector-empty-04",
    "number_disc_pools": {},
    "reserve_number_deck": [],
    "resource_supply": {
        "ore": 12, "fuel": 12, "carbon": 12, "food": 12, "goods": 12
    },
    "reserve_deck": [],
    "upgrade_supply": {"booster": 20, "cannon": 24, "freight": 20},
    "fame_supply": 37,
    "encounters": {
        "draw": [], "discard": [], "current": None,
        "reader_id": None, "prompt_revealed": False, "result_revealed": False
    },
    "friendship_available": {
        "diplomats": [], "merchants": [], "green_folk": [], "scientists": []
    },
    "friendship_marker_holder": {
        "diplomats": None, "merchants": None,
        "green_folk": None, "scientists": None
    },
    "players": {
        "p1": {
            "hand": {"ore": 1, "fuel": 0, "carbon": 2, "food": 0, "goods": 0},
            "pieces": {
                "colonies": 6, "trade_stations": 7,
                "transports": 2, "shipyards": 2
            },
            "upgrades": {"booster": 1, "cannon": 0, "freight": 0},
            "friendship_cards": [],
            "fame_pieces": 1,
            "permanent_medals": [],
            "pending_free_trade_ships": 0,
            "turn_flags": {},
            "is_bot": False
        }
    },
    "production": {"dice": None, "pending_discards": {}, "summary": None},
    "trade": {"offer": None, "responses": {}, "epoch": 0},
    "flight": {
        "balls": None,
        "base_speed": None,
        "current_ship_id": None,
        "movement_spent": {},
        "finished_ship_ids": [],
        "locked_ship_ids": [],
        "must_clear_ship_ids": []
    },
    "pending": None,
    "turn_summary": [],
    "review_ready": [],
    "play_again_ready": [],
    "game_over": False,
    "winner_ids": [],
    "activity": []
}
```

精确 VP 由 `compute_vp(state, player_id)` 计算；公共 view 可以附带缓存值，但每次状态断言都验证缓存与派生值一致。

### 6.3 阶段状态机

```text
advanced setup
  -> production
  -> normal production or seven_discard -> pending production choices
  -> trade_build
  -> flight_start
       -> encounter_prompt -> encounter_choice -> encounter_resolution
       -> flight_move
  -> turn_review
  -> next player's production
  -> game_over (active player reaches 15 VP at any legal checkpoint)
```

`pending` 是单一阻塞决策或并行决策集合。任何阶段只能有一个顶层 pending 原因，例如：

- 7 点秘密弃牌。
- Galactic Relief Fund 选择资源。
- Encounter reader / actor / affected players的选择。
- 免费升级、移除升级、锁定船、奖励资源或 Space Jump。
- Trade Station 建立后的友谊卡选择。
- 需要立即放置的免费 Trade Ship。

处理完 pending 后调用统一 `_advance_state()`，循环执行无玩家选择的自动步骤，直到出现下一合法动作或游戏结束。

### 6.4 动作协议

设置：

- `setup_place_colony {site_id}`
- `setup_finish {colony_id, ship_type, launch_node_id, upgrade_type}`

生产与 7：

- `roll_production`
- `discard_resources {resources}`
- `choose_steal_target {target_player_id}`
- `choose_relief_resource {resource}`
- `skip_relief`

交易与建造：

- `open_trade_offer {give, want}`
- `submit_trade_response {give_to_active, receive_from_active}`
- `withdraw_trade_response`
- `accept_trade_response {response_id}`
- `cancel_trade_offer`
- `trade_with_supply {give_resource, give_count, receive_resource}`
- `build_ship {ship_type, spaceport_id, node_id}`
- `build_spaceport {colony_id}`
- `build_upgrade {upgrade_type}`
- `use_friendship {card_id, selection}`
- `start_flight`

遭遇：

- `read_encounter_prompt`
- `choose_encounter {choice, resources}`
- `reveal_encounter_result`
- `choose_pending_resources {resources}`
- `choose_pending_upgrade {upgrade_type}`
- `choose_pending_ship {ship_id}`
- `choose_pending_players {player_ids}`
- `resolve_wear {upgrade_type}`
- `place_free_trade_ship {spaceport_id, node_id}`

飞行：

- `begin_ship_move {ship_id}`
- `move_ship_step {ship_id, node_id}`
- `finish_ship_move {ship_id}`
- `establish_colony {ship_id}`
- `establish_trade_station {ship_id, outpost_id}`
- `choose_friendship_card {card_id}`
- `space_jump {ship_id, node_id}`
- `end_flight`

确认：

- `next_turn`
- `play_again`

`definitions.py` 对每种动作使用严格 `oneOf` JSON Schema，所有 object 都设置 `additionalProperties: false`；资源 bundle 限定五个键、非负整数和合理上限。业务层仍必须重新验证阶段、身份、库存、组件、目标节点、次数和权限。

### 6.5 原子性与胜利检查

每个动作按以下顺序执行：

1. 在不修改原状态的情况下校验 schema 之外的业务条件。
2. 对深拷贝或受控事务对象应用动作。
3. 自动推进强制效果和 pending。
4. 运行组件守恒、图占用、隐私相关状态断言。
5. 如果当前玩家处于自己的回合，调用 `compute_vp` 检查 15 VP。
6. 成功后一次性提交；失败返回稳定英文错误码／短消息，不留下半结算状态。

交易交换、生产批量发牌、友谊标记转移、特殊星球清除和遭遇分支尤其必须原子执行。

### 6.6 公共视图与防泄漏

所有玩家可见：

- 已发现星区、已探索数字、公开建筑、船和升级。
- 每名玩家的手牌总数、VP、声望半章数、永久奖章和友谊卡。
- 银行公开数量、补给牌堆剩余张数、遭遇抽／弃牌张数。
- 公开报价、当前阶段、合法行动者、母舰已揭示结果和已结算日志。

仅本人可见：

- 自己的五种资源精确数量。
- 自己待提交的秘密弃牌、私密补给抽牌和随机偷牌结果。
- 只对自己有效的合法目标与成本提示。

仅 Reader 可见：

- 当前遭遇完整分支和待读文本。

所有客户端都不可见：

- 私密 seed / counter、未来骰子／彩球结果。
- 补给牌堆顺序、遭遇牌顺序、备用数字牌顺序。
- 未发现星区模板、被移除星区、未探索数字牌。
- 其他玩家手牌组成、未提交弃牌和未公开遭遇分支。

活动日志只能记录公开信息；例如写“Blue drew 2 reserve cards”，不能写抽到的资源。

### 6.7 守恒式与存档

任意状态必须满足：

```text
每种资源：bank + reserve_deck + all hands = 20
booster：public supply + physical player upgrades = 24
cannon：public supply + physical player upgrades = 24
freight：public supply + physical player upgrades = 20
fame pieces：public supply + player fame pieces = 40
encounters：draw + discard + current = 32 unique ids
friendship cards：available + player-owned = 20 unique ids
sectors：board 15 + removed 1 = 16 unique ids
每名玩家：supply / board / ship cargo 中的 Colony、Trade Station、Transport、Shipyard 总数固定
```

`serialize` 保存全部权威私密状态；`deserialize` 拒绝未知 schema version、重复 ID、组件缺失、非法 phase / pending 组合和被篡改的图占用。存档往返后下一次随机结果必须与不中断游戏一致。

## 7. Bot 设计

Bot 每次只从 `get_public_view(state, bot_id)` 与自己的私密手牌构造决策，不能读取未发现星区、未来数字、遭遇分支或其他玩家资源组成。

基础策略：

- 设置时优先覆盖高概率数字、资源多样性和不重复的初始星系；按计划目标选择起始船与升级。
- 弃牌保留近期建造组合；随机偷牌只选合法且手牌较多的对手。
- 银行交易比较目标建造距离；玩家交易只接受双方非空且按稀缺度不过度亏损的报价。
- 建造优先级为“可到达的新 Colony / 关键 Trade Station / 推进器 / 对应障碍所需升级 / Spaceport”。
- 飞行用已知图上的 BFS / A* 寻找目标；暗置星区只使用相同先验，不读取真实模板。
- 遭遇决策只根据 Actor 实际听到的 prompt、现有资源和风险偏好；Reader Bot 仅自动执行 Read / Reveal。
- 友谊卡按当前短板评分，移动中优先清除已满足要求的特殊星球。
- `turn_review`、Wear and Tear 和 Play Again 自动确认或选择。

Bot 搜索必须有确定性 tie-break（稳定 ID），避免相同状态下测试结果漂移。每次 `bot_move` 只返回一个动作，由现有 `_maybe_run_bots` 循环继续推进。

## 8. 前端与交互

### 8.1 页面结构

游戏面板建议分为：

1. 顶部紧凑状态条：Active Player、Turn、Phase、Production Roll、Speed、⭐ VP。
2. 玩家卡带：名称、颜色 + 形状标识、手牌张数、VP、🚀 / 💥 / 📦、🏅、友谊卡和 Ready 状态。
3. 中央星图：单一响应式 SVG，绘制星区、行星、连接、船、建筑、前哨和合法目标。
4. 右侧上下文面板：当前选择详情、成本、公开能力和阶段说明。
5. 底部操作坞：只显示当前阶段最相关的 1–4 个动作。
6. 可折叠 Hand / Build / Trade 抽屉。
7. 固定最大高度且内部可滚动的 Game Log。

地图元素：

- Colony Ship 和 Trade Ship 使用不同轮廓、`C` / `T` 小徽标和不同 Emoji，不只靠玩家颜色。
- Colony、Spaceport、Trade Station 使用圆点、带环圆点、菱形三种形状。
- 未发现星区显示统一星图背面；未探索行星的数字显示 `?`。
- 可走节点显示柔和脉冲；选中后出现半透明操作层与 **Move / Finish / Settle**，符合 `FRONTEND.md` 的点选确认习惯。
- SVG 节点支持键盘 focus、Enter / Space 和屏幕阅读器标签。

### 8.2 桌面布局

宽度大于 980px 时使用 `minmax(0, 1fr) 300px` 的地图 + 侧栏布局。地图容器高度使用 `clamp(440px, 68vh, 760px)`，内部允许平移和缩放，但页面本身不横向滚动。

所有 Grid / Flex 子项设置 `min-width: 0`；长玩家名省略并在 title 中显示完整内容。弹窗层使用单一 z-index 体系，不能覆盖 Header 或把确认按钮推出视口。

### 8.3 关键交互

生产：

- 当前玩家点击 **Roll Production**；骰子动画只表现服务端已经决定的结果。
- 7 点时，受影响玩家在私密资源行内用步进器选择精确弃牌数，按钮显示 `Discard 4`。

建造：

- **Build** 抽屉以六张紧凑项目卡显示成本、库存和禁用原因。
- 选择 Ship 后只高亮自己的空 Spaceport Sites；点击目标出现 **Build / Cancel** 蒙版。
- 不提供 `Clear Selection`；点击抽屉外空白、地图空白或 Esc 取消尚未提交的本地选择。

交易：

- Give / Want 各 5 行资源，图标、说明和步进器同行。
- 桌面可并排，移动端上下排列；按钮尽量一行两个。
- 响应卡显示双方资源、回应者与 **Finalize**，Game Log 不记录未成交报价的私密手牌推断。

飞行：

- 母舰区域用 5 个简化彩球和一次短动画，不临摹实体母舰。
- 选船后地图只高亮服务端返回的下一步；顶部显示 `Movement 3 / 7`。
- 发现星区时暂停当前船并显示短 Reveal 卡，点击 **Continue Flight** 后保留剩余移动力。

遭遇：

- Reader 得到私密 Encounter 面板和 **Read Prompt**；Actor 得到选择面板。
- 其他玩家只看到 `Waiting for …`。
- Esc 可关闭视觉弹窗，但不会跳过规则状态；页面保留 **Resume Encounter** 按钮。

回合结算：

- `turn_review` 显示紧凑时间线和仍可查看的完整地图。
- **Next Turn** 显示 `2 / 3 Ready`；已经确认的按钮进入 disabled 状态，但 Explain 仍能解释。

### 8.4 移动端

小于 720px：

- 玩家卡横向内部滚动，但整个页面严禁横向滚动。
- 星图高度使用 `clamp(300px, 48vh, 520px)`，支持双指缩放与拖拽；重置视图放在地图工具条，不等同于清除选择。
- 操作区成为底部普通文档流 dock，提供 `Board / Hand / Build / Trade / Log` 标签，不使用覆盖地图内容的绝对定位。
- 一行尽量放两个按钮；资源图标、数字和 `+ / −` 保持同行，控件之间至少保留合理 padding。
- 弹窗宽度不超过 `calc(100vw - 24px)`，正文内部滚动，主要按钮保持可见。
- 所有文字和节点保持可点击尺寸，不能通过整体缩小页面来塞入内容。

### 8.5 Help

Help 对话框必须覆盖：

- 目标、15 VP 与“只在自己回合获胜”。
- 5 种资源、生产、补给牌和 7 点完整顺序。
- 玩家／银行交易和所有建造费用。
- 母舰彩球、速度、三种升级和逐船移动。
- Discover 与 Explore 的区别、海盗基地、冰冻星球和 Space Jump。
- Colony、Spaceport、Trade Station、Freight 要求和友谊标记多数权。
- 四个文明的友谊卡类型、遭遇 Reader 机制、声望计分。
- 3 人局限制、4 种地图设置和首版不包含的扩展。
- 数字版的逐步移动、回合复盘和断线等待规则。

规则正文属于游戏内容，可以中文说明并保留英文术语；Help / Close / Back 等通用 UI 标签使用英文。

### 8.6 Explain（严格遵守 task40）

至少为以下控件提供解释：

- Roll Production、Discard、Steal、Earth Reserve。
- Open Offer、Counter、Finalize、Bank Trade。
- 六种 Build 项目、资源行和公共库存。
- Shake Mothership、四种球、速度、三种升级。
- 船、合法节点、Finish Move、Settle、Trade Station、Space Jump。
- 暗置星区、数字牌、海盗基地、冰冻星球、外星前哨。
- Encounter Reader、Actor Choice、Read Prompt、Reveal Result。
- 友谊卡、Friendship Marker、Fame、VP。
- Next Turn、Play Again、Game Log。

实现要求：

- 进入 Explain 后，有解释的控件显示虚线高亮与问号光标。
- 无解释按钮外观不变，但捕获阶段拦截其原功能。
- 使用 `pointerdown` + 坐标／`elementFromPoint` 命中，使 disabled 按钮与 SVG 交互目标仍能说明。
- 点击一个有解释控件后显示说明并自动退出 Explain。
- Esc 优先退出 Explain；否则关闭最上层非强制弹窗。
- 切换离开游戏面板时清理 Explain class、临时高亮、地图选择和事件状态。

## 9. 注册与文件改动

- `game/catan_starfarers.py`：状态机、规则、随机、公开视图、Bot、序列化。
- `game/catan_starfarers_data.py` 与 `game/assets/catan_starfarers/*.json`：数据加载和校验。
- `game/definitions.py`：导入并注册 `CatanStarfarersGame`，加入严格 action / config schema。
- `game/__init__.py`：导出 `CatanStarfarersGame`。
- `game/tags.py`：标签使用 `euro`、`ameritrash`。
- `game/dev_order.json`：注册后运行 `python scripts/gen_dev_order.py`，不要手工猜顺序。
- `scripts/bgg_weight_scrape.py`：加入 `https://boardgamegeek.com/boardgame/282853/catan-starfarers`。
- `static/room.js`：加入脚本抓取出的两位小数 Weight；创建房间增加同一行的 setup select。
- `static/index.html`：加入游戏面板、Header Help / Explain、对话框、CSS 和脚本标签。
- `static/app.js`：只加入全局面板切换、Header actions 调用和 `renderGameState` 分发。
- `static/games/catan_starfarers.js`：主要渲染与交互；优先封装在 IIFE 中。
- `static/catan_starfarers.css`：全部使用 `.catan-starfarers-*` 命名空间。
- `tests/test_catan_starfarers_game.py`、`tests/test_catan_starfarers_data.py`：规则与数据测试。

需要暴露给 `app.js` 的少量全局入口也必须有独有前缀，例如：

```javascript
function renderCatanStarfarersGameState(data) {}
function showCatanStarfarersHeaderActions(visible) {}
```

不得在全局作用域声明 `selectedShip`、`renderBoard`、`showHelp` 等通用名称。

## 10. 测试计划

### 10.1 数据与初始化

- 组件数量、稳定 ID、星区／数字牌／友谊卡／32 张遭遇完整性。
- 四种 `setup_mode`，3 人与 4 人初始化。
- `beginner` 固定位置、3 人中立封锁、起始 Colony Ship / Booster / 3 资源 / 半章 / 4 VP。
- 进阶 4 轮顺逆序、Spaceport / 起始船 / 奖励升级选择和 3 人关闭位置。
- 私密 seed 不进入 config 或公共 view，同 seed helper 产生确定结果。

### 10.2 生产与资源

- 2d6 普通生产、双数字牌、Spaceport 仍只产 1。
- Green Folk `+1` 和供应不足时整种资源无人获得。
- 补给按 VP 抽 `2 / 1 / 0`，耗尽后重建并继续。
- 7 点普通上限与 Reduced Tribute 上限、奇数向下取整、并行秘密弃牌。
- 随机偷牌、对手依座位抽补给、当前玩家最后抽补给。
- 每种资源始终守恒为 20。

### 10.3 交易与建造

- 玩家报价、还价、仅当前玩家 Finalize、非空双方、资源不足和 stale epoch。
- 默认 3:1、Goods 2:1、四种 2:1 友谊卡和每回合一次 Goods 1:1。
- 六类建造成本、个人组件上限、公共升级库存、Spaceport Site 占用。
- 建造后取消过期报价，免费 Trade Ship 延迟义务。
- Fame for Sale 全局每回合一次、Helping Hand 条件和随机抽取。

### 10.4 母舰、遭遇与飞行

- 彩球从 `2Y / B / R / K` 无放回抽 2；球值与 Black 遭遇基础速度 3。
- 实体与 Scientists 速度／战斗加成；海盗扮演者不使用 Scientists。
- 32 张遭遇每条分支、所有 pending 选择、声望不低于 0、免费升级／船、重洗链。
- Reader 私有全文、Actor 只见 prompt、其他玩家不见未选分支。
- 逐边移动、少走／0 步／返回／穿过占用点、合法终点和每艘船独立速度。
- 升级即时影响后续船、锁定船、Spaceport 强制清场。
- Space Jump 任意合法空节点并终止该船移动。

### 10.5 探索、建筑与得分

- Strategic 的明置星区暗置数字；Explorer / Wild 的星区发现。
- Wild 随机移除 1 个星区且不泄漏；发现后图连接正确。
- 一次探索翻开 3 个数字牌，特殊牌换成正确特殊标记。
- Cannon / Freight 达标立即清除、抽备用数字、可不殖民继续飞。
- Colony Site 限制、3 人每新星系最多 2 个、不能回初始区扩建。
- Trade Station 第 1–5 个分别要求 1–5 Freight。
- 每站选择 1 张剩余友谊卡；多数权转移与平局持有者保留。
- VP 派生、半章奇偶变化、永久奖章不可被遭遇移除。
- 当前玩家 15 VP 立即结束；非当前玩家达到 15 等到自己回合再检查。

### 10.6 联机、存档与 Bot

- 所有真人 Next Turn 前不换人，Bot 自动确认，断线／重连保留 pending。
- Play Again 全员确认、相同设置、新 seed、状态完全重置。
- `get_public_view` 不泄漏手牌、补给顺序、遭遇顺序、星区、数字牌或随机状态。
- serialize / deserialize 往返保持下一随机结果，拒绝损坏和重复组件。
- Bot 在设置、弃牌、交易、遭遇、移动、友谊卡和确认阶段只返回合法动作。
- 资源、升级、声望、卡牌、星区与个人组件守恒断言。

### 10.7 运行命令

```bash
python -m unittest tests.test_catan_starfarers_data
python -m unittest tests.test_catan_starfarers_game
python -m unittest tests.test_game_dev_order tests.test_game_names tests.test_game_tags tests.test_frontend_script_names
```

前端人工验收使用约 1280px 桌面视口和约 390px 手机视口。UI 修改本身不要求运行逻辑测试，但整项功能包含新规则模块与全局注册，因此完成实现时仍需执行上述模块和注册测试。

## 11. 验收标准

- 3–4 名真人／Bot 能从任一首版设置完整玩到合法 15 VP 结束。
- 生产、7 点、补给、交易、建造、遭遇、探索、移动、友谊卡和计分与 2019 基础规则一致。
- 未发现地图、资源手牌、补给顺序、遭遇分支和未来随机不泄漏。
- 所有规则动作由服务端重验；刷新、断线重连和存档恢复不会重复奖励或改变随机序列。
- 每回合结束后不会自动进入下一回合，所有真人确认后才继续。
- Help 完整；Explain 能拦截所有按钮原功能，disabled 控件可解释，Esc 行为正确。
- 没有 `Clear Selection` 按钮；空白点击或 Esc 能取消本地选择。
- 通用 UI 使用英文；资源和游戏内容同时使用 Emoji、颜色、文字和形状。
- 桌面与手机无板块重叠、无页面横向滚动、无过长不可滚动日志，移动端按钮紧凑但不拥挤。
- 仓库不包含官方商业图像、扫描件、逐字卡文或需要额外授权的素材。
- 新前端主要逻辑位于 `static/games/catan_starfarers.js`，浏览器全局名称均带游戏独有前缀。

## 12. 建议实现顺序

1. 固化 2019 组件审计表、星区／数字牌／友谊卡／遭遇数据和启动校验。
2. 完成资源守恒、Production、7 点、补给、Trade & Build 和派生 VP。
3. 完成地图图结构、四种设置、逐边 Flight、发现／探索和特殊星球。
4. 完成 Trade Station、友谊卡、Reader 私密遭遇状态机和 32 张遭遇效果。
5. 完成存档、公共视图、防泄漏、Bot 与回合复盘。
6. 完成原创响应式前端、Help / Explain、桌面／移动端人工验收。
7. 最后注册游戏、刷新 `dev_order.json`、抓取 BGG Weight 并运行模块与全局测试。

## 13. 中英文版本增补

房间配置新增：

```json
{
  "setup_mode": "beginner",
  "language": "zh"
}
```

- `language` 只允许 `en` 或 `zh`，省略时为 `en`；服务端 schema 与游戏初始化都会拒绝其他值。
- 语言在创建房间时确定，开始游戏、重连、存档恢复和 Play Again 都沿用原配置，不能通过 `room:start` 临时覆盖。
- 中文版覆盖阶段名、资源、升级、飞船、四种布局、星区、外星文明、20 张友谊卡、32 张遭遇的标题／情境／选项／结果、行动提示、公开日志、Help 与 Explain。
- 英文与中文共用完全相同的稳定 ID、动作 payload、随机状态与规则计算；本地化仅改变公开文案，不改变游戏逻辑。
- 服务端按房间语言生成日志、星区名、友谊卡与遭遇公开视图，避免浏览器自行推断隐藏卡牌；客户端负责其余界面静态文案。
- 通用导航按钮（例如 Help、Explain、Close、Back to games）继续遵循 `FRONTEND.md` 使用英文；游戏内容随房间语言切换。
- 自动测试需锁定翻译覆盖集合与原始数据集合完全一致，并验证中文公共视图、建房配置持久化和非法语言拒绝。
