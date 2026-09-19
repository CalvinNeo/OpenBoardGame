# Task 84: 《TACTA》规则与电子版实现规格

## 实现状态（2026-09-12）

首版现已落地：2-6 人 Standard、Quick Round、Limited Space 和 Sabotage 均已接入房间、服务器规则、bot、存档/public view、SVG 前端与自动化测试。Free Play 和 7-12 人 Team Up 仍按本文暂缓。

当前 `game/assets/tacta_cards.json` 明确标记为 `original-compatible-set`：它是 18 张自制机械测试牌，不是官方牌面扫描或经官方逐张校对的数据。因此本实现可以完整游玩和验证状态机、计分、任意斜角吸附与碰撞，但不宣称复刻实体版每张牌的精确接口坐标。拿到可合法核对的完整牌表后，应提升 `catalog_version` 并替换这份目录。

自制牌表的矩形牌框会在已匹配接口周围产生空白区域重叠；当前裁定是“接口必须完整重合、新牌只可与目标牌产生非完整重叠、不得与第二条非祖先分支产生正面积相交”。这替代了下文理想正式牌表所要求的“交集面积恰好等于接口 cover polygon”。更换为校对牌表时，应恢复严格 cover polygon 判定并更新几何夹具。

## 实现结论与范围

本文以 The Op Games 2025 年英文版基础规则为准，目标是在本仓库中实现一个服务器权威、支持断线重连与存档、桌面端和移动端均可操作的《TACTA》电子版。

首版建议范围：

- 支持 2-6 人。
- 实现标准轮流模式。
- 同一规则引擎支持 `Quick Round`、`Limited Space`、`Sabotage` 三种轮流制变体。
- 首版暂不实现 `Free Play` 实时抢放模式和 7-12 人 `Team Up`，因为二者需要同时动作冲突裁决、共享颜色队伍与不同的结束条件；规则仍在本文完整记录，方便后续扩展。
- 所有落牌由服务器用离散几何数据判定，客户端不能提交任意坐标绕过规则。
- 不复用官方牌面、商标、字体或插画。卡牌以自制 SVG、纯色边框、几何图形和无障碍符号重绘。

本游戏实现的最大前置条件不是状态机，而是**准确录入 18 种卡牌模板和起始牌的机械几何数据**。公开规则书只展示少量示例，没有提供完整、可机器读取的牌表；在这份数据校对完成以前，不能宣称实现与实体版完全一致。

## 游戏识别与已核对来源

- 英文名：`TACTA`
- 设计师：Jason Tremblay
- 出版商：The Op Games / USAopoly
- 年份：2025
- 基础盒人数：2-6 人
- 时长：约 20 分钟
- 年龄：7+
- 类型：抽象策略、空间拼放、牌堆两端选牌、覆盖计分
- BoardGameGeek ID：`401636`
- 当前 BGG Weight 约为 `1.34`，落地时应按仓库约定更新 `static/room.js` 的 `GAME_WEIGHT`。

已核对资料：

- The Op Games 官方规则 PDF：`https://images.salsify.com/image/upload/s--hagOKqsT--/nup3rya2tqz8sssfbiz6.pdf`
- The Op Games 产品页：`https://theop.games/products/tacta`
- Board Game Arena 规则摘要：`https://en.doc.boardgamearena.com/Gamehelptacta`
- Board Game Arena 游戏页：`https://en.boardgamearena.com/gamepanel?game=tacta`
- BoardGameGeek：`https://boardgamegeek.com/boardgame/401636/tacta`

资料之间存在版本文案差异：官方 2025 规则明确写的是 6 套颜色、每套 18 张；部分较新的商品文案写“up to 8 colors”或“2+ players”。本任务按 2025 基础盒的 6 色、2-6 人实现，不把未确认的新版本内容混入基础规则。

## 无法完整获取或不可直接使用的游戏资源

### 1. 完整的 18 张牌几何目录

公开规则能确认每色 18 张牌、中央有花色与点数、边缘有三角形/正方形/长方形接口，但没有给出以下完整数据：

- 每张牌上所有接口的精确位置、尺寸、方向和轮廓。
- 大小不同的同类图形分别如何匹配。
- 每个计分圆点属于哪个接口以及精确位置。
- 18 张牌的中央花色、点数与边缘图案的一一对应关系。
- 起始牌上所有可连接位置的精确几何信息。

这些数据是规则引擎的一部分，不只是美术。开发前需要用正版实体、授权资料或经过许可的参考逐张人工校对，并生成 `CardTemplate` 数据。商品宣传图只能用来辅助核对，不能当作生产素材直接裁切使用。

### 2. 官方视觉资产

以下内容受版权或商标保护，不能直接复制到项目中：

- 官方牌面图片、牌背、盒面、规则书排版。
- `TACTA` 商标图形、The Op Games 标志。
- 官方字体、颜色纹理、宣传插画和动画。
- 官方颜色无障碍图标的具体美术造型。

电子版应保留机械信息，但重新设计视觉：深色或浅色卡底、自制图形路径、六种高对比颜色、自制纹理/字母符号、通用圆点计分标记。

### 3. 没有标准化的桌面尺寸

实体规则只说桌边是边界，开局前选择一个足够大的平面，没有规定长宽。不同桌子会改变边缘封锁与“无合法位置”的概率。电子版必须明确自己的统一裁定，不能假装存在官方尺寸。

本文建议标准模式使用“技术上有界、玩法上等同超大桌面”的坐标平面，边界不会刻意参与正常策略；`Limited Space` 依照官方规则通过每轮只用一个花色减少牌数，而不是擅自缩小桌面。

### 4. 规则书未穷尽的边界裁定

公开规则没有明确说明：

- 起始玩家比较“较小外侧牌点数”和“两张外侧牌点数之和”后仍平手怎么办。
- “卡边可以轻微接触”在数字坐标中允许多大误差。
- 一个圆点只被遮住一部分时是否仍算可见。
- 其他玩家是否应看见某玩家牌堆两端的牌面。
- 多局制中下一局的起始玩家如何确定。
- `Limited Space` 三种花色的先后顺序。

本文会为这些情况给出一致、可测试的电子版裁定，并在 Help 中标明属于数字版标准化处理。

### 5. 本地化与表现资源

- 没有可直接复用的官方中文牌名或中文规则全文。
- 音效、落牌动画、教学高亮、日志文案需要自行制作。
- 官方规则中的实体“纠正歪牌”和“移除非法牌”流程不需要原样电子化；服务器应在落牌前阻止非法动作。

## 核心玩法概览

每名玩家拿一套独立颜色的 18 张双面牌，洗牌后保持成一叠，不能翻看中间的牌。每回合只能从牌堆最上端或最下端二选一。

玩家把所选牌翻面或旋转，使牌边的某个几何接口与场上一张牌的同尺寸、同轮廓接口完全重合。新牌只能连接/覆盖一张旧牌，不能同时压到两张牌的有效区域。新牌会遮住下方接口中的圆点，同时把自己的圆点留在最上层，因此场上各色的实时得分会不断变化。

所有玩家把牌打完后，每个仍然可见的己方圆点计 1 分，最高分获胜。

## 游戏组件与卡牌语义

### 起始牌

- 1 张白色/中性色起始牌。
- 没有计分圆点。
- 放在游戏区域中央。
- 提供能够接纳任意首张玩家牌的连接位置。
- 不属于任何玩家，不参与计分。

起始牌仍然必须录入可用接口和吸附姿态，不能只当作背景图片。首张牌也要经过正常几何校验。

### 玩家牌

- 共 108 张。
- 6 个颜色牌组：蓝、绿、橙、粉、紫、红。
- 每色 18 张，同一颜色只能分给一名玩家。
- 每张牌正反两面均可使用；背面是正面的镜像。

每张牌包含：

1. **边缘接口**
   - 轮廓为三角形、正方形或长方形。
   - 同为长方形但尺寸不同的接口不能匹配；合法性看完整轮廓与尺寸，不只看名称。
   - 接口可能是空心，也可能包含圆点。
   - 匹配时忽略“空心/带点”的差异，只要求几何完全相同并对齐。
2. **圆点**
   - 每个圆点值 1 分。
   - 被后来放置的牌遮住后不计分。
3. **中央点数**
   - 等于该牌全部圆点的总数。
   - 已公开资料显示点数范围为 1-6，但最终仍须用完整牌表校对。
4. **中央花色**
   - `circle`、`square`、`triangle` 三种之一。
   - 标准游戏不使用花色。
   - Quick、Limited Space、Sabotage 会按花色筛牌或传牌。
5. **颜色无障碍标识**
   - 颜色和额外符号共同标识牌的归属。
   - 数字版必须使用自制符号，不可只靠颜色区分玩家。

### 双面与方向

实体牌可以翻到镜像面，也可以在桌面上转到任意角度，并不局限于 90 度。实际合法角度仍是可枚举的：一旦选定“来源接口 + 目标接口”，两块全等接口的轮廓和朝向会把牌吸附到有限个刚体姿态。

```text
face: front | back
placement transform: derived from source connector, target connector and shape symmetry
```

`back` 是 `front` 的镜像，因此数据文件只需保存一套正面几何，由变换函数生成背面。不要为两面维护两套容易漂移的数据。正式状态保存服务器算出的定点仿射矩阵，不把角度限制成 `0/90/180/270`。

## 标准游戏规则

### 1. 设置

1. 校验玩家人数为 2-6。
2. 在游戏区域中心放置起始牌。
3. 按座位顺序给每名玩家分配不同颜色的一套 18 张牌。
4. 分别洗混每名玩家的牌组，并保持为有顺序的牌堆。
5. 每名玩家只可查看/选择自己牌堆的两个外侧牌；中间牌顺序隐藏。
6. 比较所有玩家两张外侧牌中的较小点数，最小者成为起始玩家。
7. 若并列，再比较两张外侧牌点数之和，较小者先手。
8. 若仍并列，电子版使用本局随机种子在并列者中随机选择，并写入日志。
9. 从起始玩家开始，之后始终按座位顺时针轮流行动。

如果牌堆只剩 1 张，`top` 和 `bottom` 是同一张实例，UI 只能显示一个可选项，服务器也不能把它当作两个选择。

### 2. 一个回合

行动玩家必须从以下流程完成一次落牌：

1. 在牌堆最上端或最下端选择一张牌。
2. 可以把牌翻到镜像面。
3. 可以转动牌；数字版通过选择来源接口、目标接口和合法对称姿态自动吸附到所需角度。
4. 选择场上一张牌当前仍暴露的边缘接口。
5. 用所选牌的一个同轮廓接口覆盖目标接口。
6. 服务器验证后把新牌固定到场上，并从原牌堆对应一端移除。
7. 更新接口暴露状态、可见圆点和实时分数。
8. 轮到下一名玩家。

落下后不能撤回、旋转、翻面、平移或改放到别处。浏览器端的幽灵预览不算落牌，只有服务器接受 `place_card` 后才改变正式状态。

### 3. 合法连接

合法放置必须同时满足：

- 所用牌确实是行动玩家牌堆的 `top` 或 `bottom`。
- 目标是起始牌或已经合法放置在场上的牌。
- 目标接口当前仍位于最上层、没有被后来的牌覆盖。
- 来源接口与目标接口的完整 `shape_id` 一致；空心/带点属性不参与匹配。
- 变换后两个接口的吸附框架完全对齐。
- 新牌只与目标牌产生规则定义的正面积重叠。
- 新牌不能与任何第二张旧牌产生正面积重叠。
- 新牌不能覆盖第二张牌的边线、接口或圆点。
- 新牌不能超出数字版游戏区域的技术边界。
- 新牌的坐标和方向由服务器从接口计算，不接受客户端自报的自由浮点坐标。

允许连接任何颜色的牌，包括自己的牌。标准模式没有“不能盖自己”的限制；这一限制只属于 `Free Play`。

### 4. 一次只能连接一张牌

实体规则允许牌边轻微碰到别的牌，只要没有压到那张牌的轮廓、接口或圆点。为了让网络对局无争议，数字版采用严格且简单的统一判定：

- 与目标牌的重叠必须等于该接口定义的合法覆盖区域。
- 与其他牌的正面积相交一律非法。
- 仅边或角的零面积接触允许。
- 卡牌局部几何使用整数坐标，世界变换使用统一定点精度；多边形比较使用服务器定义的极小 epsilon，不使用随屏幕像素或浏览器缩放变化的视觉容差。

这与 Board Game Arena 的严格吸附思路一致，也避免不同屏幕缩放造成合法性差异。

### 5. 被覆盖接口仍可继续叠放的表达

一张新牌用自己的来源接口盖住旧牌的目标接口：

- 旧牌的目标接口变为 `covered_by = new_card_id`，其圆点不再可见。
- 新牌的来源接口位于最上层，仍作为一个可被后续牌覆盖的暴露接口。
- 因此同一位置可以形成向上的覆盖链，但任一时刻只有最上层接口可选。
- 新牌的其他接口也全部暴露，除非因数据定义或后续落牌被覆盖。

实现时不能简单地把“本次用过的来源接口”永久禁用，否则会错误阻止后续叠牌。

### 6. 没有合法连接时

只有当玩家的两个外侧牌在所有方向、所有暴露接口上都不存在合法连接时，才可以把其中一张牌单独放到游戏区域的空白处：

- 单独放置的牌不能接触或重叠任何已有牌。
- 它仍属于正常场上牌，其接口之后可以被连接。
- 玩家仍可从 `top` 或 `bottom` 选择要单独放置的牌。
- 只要任意一个外侧牌存在至少一个合法连接，`place_isolated` 就必须被服务器拒绝。

数字版不要求玩家拖到任意像素位置。服务器在当前整体包围盒外沿按固定螺旋/网格算法生成若干 `isolated_slot`，客户端选择一个空槽即可。这样能够保证断线重放和不同浏览器上的结果完全一致。

### 7. 游戏结束与计分

标准游戏在所有玩家都放完自己的牌后结束。

```text
player_score = count(visible dots whose owner_color == player.color)
```

计分细节：

- 每个可见圆点 1 分。
- 点数属于牌的印刷颜色，而不是打出该牌的人；这对 Sabotage 很重要。
- 被覆盖接口中的圆点不计分。
- 空心接口没有圆点，但仍可覆盖带点接口。
- 起始牌不计分。
- 最高分玩家获胜。
- 最高分并列时共同获胜，不额外设计决胜条件。

服务器每次落牌后都可以重算并公开实时分数，因为实体桌面上的可见圆点本来就是公开信息。最终计分使用同一个纯函数，不能另写一套容易产生差异的结算逻辑。

### 8. 实体非法牌处理在电子版中的变化

实体规则允许玩家事后发现非法牌：如果上面还没有别的牌，立即移除；如果已有牌压在上面，则等计分时再移除非法牌。电子版应在提交阶段阻止非法位置，因此正常对局不会进入这条分支。

调试模式即使允许跳过通用 action schema，也不应绕过 `TactaGame.apply_action` 内的几何校验。不要为生产状态保留“非法但暂时存在”的牌。

## 官方变体

### Quick Round

- 遵守标准规则。
- 开局移除 1 个或 2 个中央花色，只使用剩余 2 个或 1 个花色。
- 使用两种花色时每名玩家牌数应由已校对牌表计算，预计为 12 张。
- 使用一种花色时预计为 6 张。
- 所有人放完参与本局的牌后正常计分。

房间 UI 不让玩家输入 JSON，应提供三个带说明的选项：

```text
All suits (18 cards)
Two suits (quick)
One suit (very quick)
```

若选择少于三种花色，再用紧凑的复选项选择 `○ Circle`、`□ Square`、`△ Triangle`；复选框和文字同一行。

### Limited Space

- 共进行 3 小局。
- 每小局只使用一种中央花色。
- 三局分别使用 circle、square、triangle，每局重新设置起始牌和场地。
- 每小局结束后记录所有玩家本局可见圆点。
- 三局总分最高者获胜。

电子版标准化裁定：

- 用随机种子打乱三种花色的出场顺序，并在开局公开完整顺序。
- 每小局分别洗牌，并重新依照外侧牌点数确定起始玩家。
- 小局结算后进入 `round_summary`，保留最终版图和本局得分。
- 按 `FRONTEND.md`，所有玩家点击 `Next Round` 后才清桌开始下一局。

### Sabotage

- 开局只使用两个花色。
- 每名玩家从这两个花色中选择一个，把自己该花色的全部牌传给左手玩家。
- 玩家保留自己的另一个花色，并收到右手玩家传来的一个花色，然后把新牌堆一起洗混。
- 玩家可能打出别人的颜色，但所有放置规则不变。
- 结算时只数自己原始颜色的可见圆点，而不是自己打出的所有牌。

电子版流程：

1. 房主在开局配置中选择参与的两个花色。
2. 所有玩家同时私下选择 `pass_suit`。
3. 等所有人提交后一次性向左传牌，避免根据他人选择反应。
4. 每人得到自己的保留花色与右手玩家传来的花色。
5. 洗牌、决定起始玩家并开始正常回合。

玩家选择结果在全部提交前不可公开。传牌完成后可以公开“每名玩家控制哪些颜色/花色牌”，但完整牌堆顺序仍保密。

### Team Up

官方建议大团体采用两人共享一个颜色：

- 每色 18 张牌洗混后，各给两名队友 9 张。
- 队友不要相邻入座。
- 队伍按共享颜色计分。
- 官方更推荐与 Free Play 一起使用；若轮流玩，建议每回合控制在 10 秒内，这只是节奏建议。

首版不实现。后续实现时需要把最大人数扩展至 12，并增加 `team_id`、共享 `score_color`、自动错开座位与队友 UI。

### Free Play

- 没有轮流顺序，倒数后所有人同时落牌。
- 仍须遵守连接、覆盖和单牌连接限制。
- 不能把牌放在自己的颜色上。
- 任意玩家打出最后一张牌时游戏立即结束并计分。

首版不实现。后续需要服务器对同时到达的动作做原子排序：先被服务器接受的动作生效，后续基于旧版图的动作返回 `stale placement` 并要求客户端刷新。建议届时单独注册 `tacta_free_play`，避免 `turn_mode="turn"` 与同时动作语义冲突。

### 多局与目标分

官方规则允许约定局数，或以先达到目标分数为胜，建议目标为 100。首版可先只做单局；若加入系列赛：

- 每局清空版图并重新洗牌。
- 每局结束都进入全员 `Next Round` 暂停。
- 累计各局分数。
- 到达固定局数后最高累计分获胜。
- 目标分模式在一局结算后检查；多人同时达到目标时，以累计分最高者获胜，仍同分则并列。

## 数字版标准化裁定汇总

| 问题 | 数字版裁定 |
|---|---|
| 最终起始玩家仍平手 | 用本局 seed 在并列者中随机选，并记录日志 |
| 其他玩家外侧牌是否可见 | 默认仅本人可见，其他人只看剩余张数；Help 标明此数字版裁定 |
| 轻微碰触 | 非目标牌只允许零面积边/角接触，正面积重叠一律拒绝 |
| 部分遮点 | 卡牌目录把点绑定到接口；接口被合法覆盖时，该接口的点全部隐藏 |
| 标准桌面大小 | 使用足够大的技术坐标范围和可平移视口，不把未标准化桌边当作主要机制 |
| 无合法连接 | 必须对 top、bottom、正反面、全部来源接口和接口对称姿态做穷举后才开放单独放置 |
| 非法牌争议 | 服务器预校验，正式状态不允许非法牌 |
| Limited Space 顺序 | seed 随机排序并开局公开 |
| 多小局起始玩家 | 每小局重新按外侧牌点数确定 |

如果之后获得官方 FAQ 与这些裁定冲突，应更新本文、规则 Help 和相应测试，不能只修改前端表现。

## 卡牌数据格式

### 牌模板

建议建立唯一权威数据文件：

```text
game/assets/tacta_cards.json
```

数据只描述规则所需几何，不包含官方图片：

```json
{
  "catalog_version": 1,
  "coordinate_scale": 1000,
  "card_size": {"width": 1000, "height": 1560},
  "connector_shapes": [
    {
      "shape_id": "triangle_small_v1",
      "polygon": [[0, 0], [200, 0], [100, 180]],
      "symmetry_transforms": ["identity"]
    }
  ],
  "templates": [
    {
      "template_id": "circle_1_a",
      "suit": "circle",
      "value": 1,
      "connectors": [
        {
          "connector_id": "c0",
          "shape_id": "triangle_small_v1",
          "shape": "triangle",
          "frame": {
            "origin": [120, 0],
            "x_axis": [1, 0],
            "y_axis": [0, 1]
          },
          "cover_polygon": [[120, 0], [320, 0], [220, 180]],
          "path": "M ... Z",
          "dot_ids": ["d0"]
        }
      ],
      "dots": [
        {"dot_id": "d0", "x": 220, "y": 76, "connector_id": "c0"}
      ]
    }
  ],
  "starting_card": {
    "template_id": "start",
    "connectors": []
  }
}
```

字段要求：

- `template_id` 在 18 种模板中唯一。
- `value == len(dots)`。
- 每个 `dot.connector_id` 必须存在。
- `shape_id` 同时编码图形类型、尺寸和具体可匹配轮廓；不能只存 `triangle`。
- `connector_shapes` 定义规范轮廓及其有限个自同构；长方形通常有 2 个方向，正方形可能有 4 个，具体以校对数据为准。
- `frame` 把规范轮廓映射到牌的局部坐标，包含位置和任意斜角方向，不假设接口与卡边平行。
- `cover_polygon` 用于校验目标牌的合法覆盖区域和 SVG 裁剪。
- `path` 由自制几何生成，不存官方位图。
- 起始牌可以使用特殊通配连接定义，但必须能为每种玩家牌算出唯一吸附姿态。

开发时增加数据校验器，在模块加载或单元测试时立即拒绝损坏目录。目录未通过正版参考逐张核对时应保留显眼的 `catalog_status: provisional`，不能把猜测数据静默当成正式规则。

### 卡牌实例

```text
CardInstance:
  card_id: string
  template_id: string
  owner_color: blue | green | orange | pink | purple | red
  controller_id: player_id
```

- `owner_color` 决定圆点归属和得分，终局前不会改变。
- `controller_id` 是当前牌堆拥有者；标准模式与颜色主人相同，Sabotage 中可能不同。
- 一套颜色包含 18 个模板各一张；确切对应关系以校对后的目录为准。

### 已放置牌

```text
PlacedCard:
  card_id: string
  template_id: string
  owner_color: string
  played_by: player_id
  z_index: integer
  pose:
    face: front | back
    matrix_fixed: [a, b, c, d, tx, ty]
  parent_card_id: string | null
  parent_connector_id: string | null
  source_connector_id: string | null
  covered_connectors:
    connector_id -> child_card_id
```

模板局部坐标使用整数；`matrix_fixed` 的 6 个值按统一比例保存定点仿射变换，可以表达实物图中常见的斜角落牌。`z_index` 等于落牌序号且只增不减，SVG 按该顺序绘制即可得到正确遮挡层级。

## 推荐游戏状态

```text
GameState:
  game_id: tacta
  phase:
    sabotage_choose
    playing
    round_summary
    game_over

  config:
    mode: standard | quick | limited_space | sabotage
    active_suits: list[suit]
    series_type: single | fixed_rounds | target_score
    series_value: integer | null

  catalog_version: integer
  random_seed: string | integer
  rng_state: serializable

  players: dict[player_id, PlayerState]
  player_meta: dict[player_id, PlayerMeta]
  turn_order: list[player_id]
  current_turn: player_id | null
  start_player: player_id | null

  round_index: integer
  suit_schedule: list[suit]
  active_round_suit: suit | null
  board_revision: integer
  placed_cards: list[PlacedCard]
  technical_bounds: Rect

  live_scores: dict[color, integer]
  round_scores: list[dict[color, integer]]
  cumulative_scores: dict[color, integer]
  next_ready: list[player_id]
  last_round_summary: object | null

  winner: list[player_id]
  final_results: object | null
  game_over: boolean
  log: list[Event]
```

```text
PlayerState:
  color: string
  deck: list[CardInstance]
  pass_suit: suit | null
  legal_move_status: unknown | has_connection | isolated_only
```

`deck[0]` 是 `top`，`deck[-1]` 是 `bottom`。不要另存两张外侧牌，否则在出牌、传牌、存档恢复时容易产生重复状态。

## 几何引擎

### 坐标与变换

牌在实际对局中会出现斜角，因此不能使用方格棋盘或只支持 90 度的旋转。建议使用“规范接口轮廓 + 接口局部框架 + 定点仿射矩阵”：

```text
mirror_card_local_geometry(template, face)
global_connector_frame(placed_card, connector)
compose_fixed_matrices(left, right)
snap_pose(source_frame, target_frame, symmetry_transform, face)
transform_polygon(polygon, pose_matrix)
```

流程：

1. 如果 `face == back`，先围绕卡牌竖轴镜像。
2. 读取来源接口把规范 shape 映射到牌局部坐标的 `source_frame`。
3. 读取目标接口已经变换到世界坐标的 `target_frame`。
4. 枚举该规范 shape 允许的有限个 `symmetry_transform`。
5. 计算 `target_frame × symmetry × inverse(source_frame)`，得到整张新牌的世界变换。
6. 把矩阵量化到统一定点比例，生成候选 `pose_matrix`。
7. 用变换后的两个接口多边形再次校验重合误差和覆盖面积。

这样既能表达 17°、45°、135° 等斜角，也仍然只产生有限候选。不要在客户端拖拽结束位置后反推角度或四舍五入。客户端可以用同一公式算预览，但服务器必须独立根据接口重新计算最终矩阵。

建议常量：

```text
MATRIX_SCALE = 1_000_000_000
GEOMETRY_EPSILON = a small value expressed in logical units
```

所有服务器候选先量化再校验和保存；客户端显示使用服务器同精度矩阵。epsilon 只吸收定点矩阵组合误差，不能大到让肉眼可见的错位变合法。

### 暴露接口索引

每次合法落牌后维护：

```text
exposed_by_shape_id:
  shape_id -> list[(card_id, connector_id)]
```

- 旧牌被盖接口从索引删除。
- 新牌的所有接口加入索引，包括本次用于覆盖旧牌的来源接口。
- 起始牌接口同样进入索引。
- 排序固定为 `(z_index, connector_id)`，保证候选列表、bot 和回放稳定。

### 候选位置枚举

```text
enumerate_legal_placements(state, player_id):
  result = []
  for deck_end, card in unique_outer_cards(player.deck):
    template = catalog[card.template_id]
    for face in [front, back]:
      for source in template.connectors:
        for target in exposed_by_shape_id[source.shape_id]:
          for symmetry_index, symmetry in symmetries(source.shape_id):
            pose = snap_pose(source, target, symmetry, face)
            if validate_candidate(...):
              result.append(canonical_candidate(...))
  return deduplicate_and_sort(result)
```

对称轮廓、不同接口或镜像面可能产生同一位置，必须按量化后的矩阵去重：

```text
(deck_end, card_id, pose_matrix, target_card_id, target_connector_id)
```

当 top 和 bottom 指向同一张牌时也要先去重。

### 单个候选校验

```text
validate_candidate(state, player_id, candidate):
  require player_id == state.current_turn
  require candidate.card is current top or bottom
  require target card exists
  require target connector is exposed
  require source.shape_id == target.shape_id or target is valid start wildcard
  require transformed connector polygons coincide within GEOMETRY_EPSILON
  require candidate card is within technical bounds
  require polygon_intersection(candidate, target) equals target.legal_cover_region within epsilon
  require polygon_intersection_area(candidate, every other card) <= epsilon
  require candidate does not cover a second card's path or dots
  return true
```

牌框经过斜角旋转后是任意方向的凸四边形，不能只比较 axis-aligned bounding box。可先用 AABB 做快速排除，再用凸多边形 SAT 判断接触，最后用 Sutherland-Hodgman 裁剪或等价算法计算目标牌的交集多边形与面积。

推荐把 AABB 放入空间哈希或 R-tree 风格的网格索引。最多 109 张牌，朴素 O(n) 已经可用；先保证正确，再在性能测试显示有需要时优化。

### 可见圆点

最稳妥的规则模型不是根据浏览器像素采样，而是根据接口覆盖关系计算：

```text
visible_dots(card):
  total = 0
  for connector in card.template.connectors:
    if connector is exposed:
      total += len(connector.dot_ids)
  return total
```

目录校验必须保证所有圆点都归属于一个接口。若校对后发现某个圆点不属于可覆盖接口，则给它 `connector_id = null`，它永远可见，计分函数要显式支持。

SVG 遮挡只负责视觉；服务器的接口关系才是分数真相。

### 技术坐标范围与视口

建议逻辑坐标使用较大的固定范围，例如 `[-32768, 32767]`，起始牌位于原点。正常对局中不应接近这个边界。

客户端视口独立保存：

```text
viewport:
  pan_x
  pan_y
  zoom
```

视口不是游戏状态，不写入服务器存档。`Fit Board` 根据所有已放置牌的包围盒自动缩放。

### 单独放置槽

当且仅当完整枚举结果为空时：

1. 取当前版图包围盒。
2. 在外沿按上、右、下、左的固定螺旋顺序生成网格点。
3. 保留与所有现有牌既不相交也不接触的前 8 个位置。
4. 给每个位置稳定编号 `iso_<board_revision>_<index>`。
5. 仅向当前玩家公开这些槽。

提交时服务器重新确认本版图 revision、重新枚举确实无连接、重新验证槽位仍为空。

## 状态机

### 初始化

```text
init_game(config, players):
  validate player count and config
  assign unique colors by seat
  build one filtered deck per player
  if sabotage:
    phase = sabotage_choose
  else:
    shuffle every deck
    choose_start_player()
    place starting card
    phase = playing
```

所有随机行为必须使用可序列化的局内 RNG，不直接依赖进程级 `random` 全局状态。这样存档恢复后洗牌、bot 和变体顺序仍可复现。

### Sabotage 选择阶段

```text
choose_pass_suit(player_id, suit):
  require phase == sabotage_choose
  require suit in config.active_suits
  save private choice
  if all players chose:
    pass selected cards left simultaneously
    shuffle new decks
    choose_start_player()
    phase = playing
```

重复提交可选择“覆盖自己尚未锁定的选择”或“第一次即锁定”。首版建议第一次提交即锁定，减少同时选择状态复杂度；UI 用确认弹窗防止误点，Esc 可退出弹窗。

### 正常落牌阶段

```text
place_card(player_id, action):
  require phase == playing
  require player_id == current_turn
  reconstruct candidate from action
  validate candidate
  pop deck end
  append PlacedCard with next z_index
  update exposed connector index
  recompute live scores
  board_revision += 1

  if every deck is empty:
    finish_round()
  else:
    current_turn = next player clockwise
```

每名玩家在标准/Quick/Limited/Sabotage 中牌数相同，因此按顺时针轮流时不会有人提前空牌后还需被跳过。实现仍应安全跳过空牌玩家，以兼容未来队伍或自定义牌组。

### 小局结算与暂停

```text
finish_round():
  scores = calculate_visible_scores()
  append scores to round_scores
  add scores to cumulative_scores
  save final board in last_round_summary

  if series or limited-space continues:
    phase = round_summary
    next_ready = []
  else:
    finish_game()
```

`round_summary` 时：

- 保留最终版图，不立即清桌。
- 展示本局每名玩家的可见点数与累计分。
- 所有非旁观玩家点击 `Next Round` 后才继续。
- bot 自动点击，但不能替真人点击。
- 全员准备后再创建下一局牌堆、起始牌和新版图。

### 游戏结束

```text
finish_game():
  max_score = max(cumulative_scores)
  winning_colors = all colors with max_score
  winner = players whose assigned score color is in winning_colors
  phase = game_over
  game_over = true
  current_turn = null
```

最终状态必须保留完整版图和各接口/圆点的可见状态，方便玩家查看与存档回放。

## Action Schema

建议在 `game/definitions.py` 中增加：

```text
TACTA_ACTION_SCHEMA oneOf:
  {
    type: "place_card",
    deck_end: "top" | "bottom",
    source_connector_id: string,
    target_card_id: string,
    target_connector_id: string,
    face: "front" | "back",
    symmetry_index: integer,
    board_revision: integer
  }

  {
    type: "place_isolated",
    deck_end: "top" | "bottom",
    isolated_slot_id: string,
    face: "front" | "back",
    board_revision: integer
  }

  {
    type: "choose_pass_suit",
    suit: "circle" | "square" | "triangle"
  }

  {
    type: "next_round"
  }
```

`symmetry_index` 选择同一规范接口轮廓允许的离散重合方式；它不是角度。服务器从来源接口、目标接口、正反面和该索引推导任意斜角矩阵。`board_revision` 用于快速识别陈旧预览，但不能替代完整服务器校验。

单独放置使用服务器生成的规范姿态：玩家选择正反面，整体旋转固定为该空槽的默认方向。因为单独牌会成为不能与其他分支桥接的独立连通分量，而标准数字桌面不靠边界制造策略，这个整体旋转不改变该分量内部的合法连接结构，同时避免引入无限个自由角度。

配置 schema 建议：

```text
TACTA_CONFIG_SCHEMA:
  mode: standard | quick | limited_space | sabotage
  active_suits: unique list of circle/square/triangle
  series_type: single | fixed_rounds | target_score
  series_value: integer
  seed: optional string | integer
```

约束需在 `init_game` 再校验一次：

- standard 使用 3 种花色。
- quick 使用 1 或 2 种花色。
- limited_space 固定三小局，每局一种花色。
- sabotage 必须恰好使用 2 种花色。
- `series_value` 只在对应系列模式出现并为正整数。

## 公开视图与隐藏信息

### 所有人可见

- 模式、当前小局、花色安排。
- 玩家姓名、座位、颜色、无障碍符号。
- 当前行动玩家和起始玩家。
- 每名玩家剩余牌数。
- 所有已放置牌的模板、颜色、姿态、层级和覆盖关系。
- 当前各色可见圆点数。
- 小局得分、累计分和最终结果。
- Sabotage 传牌结束后的牌色归属摘要。

### 仅本人可见

- 自己牌堆 top 与 bottom 的完整牌模板。
- 自己尚未公开的 Sabotage 传牌选择。
- 自己当前可用的单独放置槽。

### 永远不应提前发送

- 任何玩家牌堆中间的顺序或牌面。
- 其他玩家牌堆的 top/bottom 牌面。
- 尚未全部提交时其他人的 Sabotage 选择。
- 能由隐藏牌推导出的对手合法位置列表。

推荐 `get_public_view(state, viewer_id)`：

```text
{
  game_id,
  phase,
  config_without_secret_seed,
  board_revision,
  current_turn,
  start_player,
  placed_cards,
  live_scores,
  players: [{player_id, name, color, symbol, deck_count}],
  your_outer_cards: [{deck_end, card}] only for viewer,
  your_isolated_slots: [...] only if viewer is active and no joins exist,
  legal_actions,
  round_summary,
  final_results,
  card_templates
}
```

18 种自制几何模板可以随视图发送以保持单一真相；如果实测 payload 过大，再生成版本化的静态 JSON，并用测试保证前后端目录哈希一致。

## 推荐事件

继续使用仓库已有通用 `game:action`，不新增 Tacta 专用 Socket.IO handler。

游戏模块返回的事件可为：

```text
tacta:pass_suit_chosen
tacta:sabotage_cards_passed
tacta:card_placed
tacta:card_placed_isolated
tacta:score_changed
tacta:round_finished
tacta:next_round_ready
tacta:round_started
tacta:game_finished
```

事件 payload 不能包含未公开牌。`card_placed` 日志应包含打出者、牌颜色、中央点数、被覆盖牌、被遮住点数和新的实时比分，方便复盘。

## 前端方案

### 页面布局

桌面端建议：

1. 顶栏：`TACTA`、模式、小局、当前玩家、Help、Explain。
2. 主区域：可平移缩放的 SVG 游戏桌面，占最大空间。
3. 右侧：玩家列表、实时可见点数、剩余牌数、滚动日志。
4. 底部固定操作坞：自己的 Top/Bottom 外侧牌、Flip、Turn、候选切换、Place。
5. 小局暂停时：版图上方显示不遮挡关键内容的结算卡片，移动端改为底部抽屉。

不要让版图、操作坞、日志互相覆盖。日志高度受限并可滚动。

### 卡牌视觉

- 使用 SVG `<g>` 表示一张牌，按 `z_index` 排序，并把服务器的 `matrix_fixed` 转成 SVG `matrix(...)`；这样斜角牌无需栅格化。
- 自制深色卡底配玩家高对比边框，或自制浅色主题，不复刻官方版式。
- 圆点用高对比 `●`/SVG circle 表示。
- 三种接口用清楚的几何轮廓表示：`△`、`□`、长方框。
- 六种玩家颜色同时配自制符号，例如 `B◆`、`G✚`、`O║`、`P●`、`V▲`、`R×`；最终符号需做色盲检查。
- 玩家面板可搭配 `🔵`、`🟢`、`🟠` 等 Emoji，但不能只依靠 Emoji 颜色传达归属。
- 被选目标接口显示虚线光圈，合法候选显示半透明幽灵牌。
- 落牌后短暂高亮被遮住的圆点，并让实时比分平滑更新。

### 推荐操作流程

1. 点击底部 `Top` 或 `Bottom` 牌。
2. 场上所有可匹配且不会碰撞的目标接口高亮。
3. 点击一个目标接口，显示首个吸附候选幽灵。
4. 如果同一目标有多个合法来源接口/姿态，用紧凑的 `◀ / ▶` 或 `Turn` 切换；`Turn` 表示“下一个能与该接口完全重合的刚体姿态”，不是固定转 90 度。`Flip` 切换镜像面。
5. 点击 `Place` 提交。
6. 点击游戏桌面空白处或按 Esc 取消当前选择，不提供多余的 Clear Selection 按钮。

可增加快捷键：

```text
R = Next legal orientation
F = Flip
Enter = Place
Esc = Cancel / Close modal / Exit Explain
```

快捷键只在焦点不位于 input/button 时生效，并为触屏提供等价按钮。

### 没有连接时

- 服务器确认两张外侧牌均无合法连接后，显示 `Place Separately`。
- 点击后显示 8 个预生成空槽，不允许自由输入 x/y。
- 选择槽位后可选择 Flip；整体角度由空槽规范化，Help 中说明这个数字版裁定。
- Explain 文案应明确“只有当前两张外侧牌都无法连接时才可使用”。

### 版图浏览

- 鼠标拖空白处平移，滚轮缩放。
- 触屏使用单指拖移、双指缩放；只在 SVG 版图区设置合适的 `touch-action`，不要破坏页面其余滚动。
- 提供 `Fit Board` 与 `Center Last Move`。
- 缩放范围应保证既能看全局，也能看清接口和圆点。
- 当前玩家切换时不要强行重置用户视口；只在最后一步超出屏幕时温和移到可见范围。

### 移动端

- Top/Bottom 两张牌并排，牌只剩一张时居中。
- `Flip + Turn` 同行，`Previous + Next` 同行，`Place` 占一行或与次要按钮同行。
- 玩家分数和日志放入可折叠底部区域。
- 保持按钮间合理 padding，不把整张版图缩得过小。
- 长按接口显示说明，短按选择。
- Modal 支持 Esc；移动端提供显眼的 Close。

### Help

必须遵守 `designs/task40.md`。Help 至少覆盖：

- 目标与终局计分。
- 只能使用牌堆最上/最下的牌。
- Flip 与 Turn 的区别，以及 Turn 会在接口决定的斜角候选间切换。
- 图形必须完整同形同尺寸，空心/带点可以互盖。
- 一次只能连接一张牌。
- 自己颜色的牌也能覆盖。
- 何时允许单独放牌。
- 实时分数为何会下降。
- 当前启用变体的额外规则。
- 数字版关于严格碰撞、隐藏外侧牌和超大桌面的标准化裁定。

### Explain

Explain 模式至少解释：

- Top Card / Bottom Card。
- Flip。
- Turn / Next Orientation。
- Previous Placement / Next Placement。
- Place。
- Place Separately。
- Fit Board。
- Center Last Move。
- Next Round。

动态不可用原因应具体，例如：

- `Not your turn.`
- `This shape is a different size.`
- `That connector is already covered.`
- `This placement overlaps a second card.`
- `A legal connection exists, so the card cannot be placed separately.`
- `This preview is stale because another move changed the board.`

解释模式下拦截所有游戏按钮原功能；没有说明的按钮不触发；disabled 按钮仍能查看说明；点击说明后或按 Esc 退出。

## Bot 建议

首版可提供一个确定性启发式 bot，复用完整候选枚举：

```text
move_score =
  opponent_dots_covered * 4
  - own_dots_covered * 2
  + own_visible_dots_added
  + exposed_connector_diversity * 0.25
  - edge_congestion_penalty
```

- 在最高分候选中使用局内 RNG 选一个，避免固定套路。
- 若没有连接，优先选择使自身暴露接口种类最多的外侧牌与空槽。
- Sabotage 中“己方圆点”按 `owner_color` 判断，不按当前控制者判断；打出对手颜色时应倾向隐藏其点。
- bot 只能读取服务器完整状态，不能改变真人公开视图的信息边界。
- 性能测试需保证最复杂终盘枚举不会明显阻塞 Socket.IO 事件循环；需要时缓存按模板/目标接口生成的吸附变换。

## 仓库文件改动计划

### 新增

```text
game/tacta.py
game/assets/tacta_cards.json
static/games/tacta.js
tests/test_tacta.py
```

可选新增：

```text
scripts/validate_tacta_cards.py
```

### 修改

```text
game/__init__.py
  import/export TactaGame

game/definitions.py
  TACTA_ACTION_SCHEMA
  TACTA_CONFIG_SCHEMA
  register_game(GameDefinition(..., game_id="tacta", turn_mode="turn"))

static/index.html
  房间配置项
  tactaPanel
  Help/Explain modal
  引入 /static/games/tacta.js

static/app.js
  缓存 tactaPanel
  游戏切换时显示/隐藏面板
  调用 renderTactaGame(state.game)
  游戏切换时 clearTactaState()

static/room.js
  收集 Tacta 房间配置
  GAME_WEIGHT 增加 tacta: 1.34

static/style.css
  所有样式使用 tacta- 前缀
  桌面/移动端 SVG、操作坞、玩家区、modal、explain 高亮

game/dev_order.json
  注册完成后运行 python scripts/gen_dev_order.py 自动刷新
```

不需要在 `app.py` 中新增专用 Socket.IO handler；沿用注册表与通用 `game:action`。

浏览器全局作用域里的函数和变量全部使用 `tacta`/`Tacta` 独有前缀，例如：

```text
tactaSelectedDeckEnd
tactaPreviewCandidate
renderTactaGame
clearTactaState
showTactaHeaderActions
```

不得声明 `selectedCard`、`renderBoard`、`clearState` 之类容易与其他游戏冲突的顶层名称。

## 推荐后端函数拆分

```text
game/tacta.py
  load_and_validate_catalog()
  build_color_deck(color, active_suits)
  unique_outer_cards(deck)
  choose_start_player(state)
  transform_point(...)
  transform_connector(...)
  snap_pose(...)
  rectangles_overlap_positive_area(...)
  enumerate_legal_placements(...)
  validate_candidate(...)
  generate_isolated_slots(...)
  place_card(...)
  calculate_visible_scores(...)
  begin_round(...)
  finish_round(...)
  finish_game(...)

  class TactaGame:
    init_game(config, players)
    get_legal_actions(state, player_id)
    apply_action(state, player_id, action)
    get_public_view(state, viewer_id)
    bot_move(state, bot_id)
    serialize(state)
    deserialize(payload)
```

所有核心规则写成纯函数，避免把合法性散落到 `apply_action` 和前端。

## 测试计划

### 卡牌目录

1. 恰好有 18 个玩家牌模板和 1 个起始牌模板。
2. `template_id`、每张牌内的 `connector_id`、`dot_id` 唯一。
3. 每张牌 `value == dots.length`。
4. 每个圆点引用有效接口或明确为永远可见。
5. 每个 `shape_id` 至少有可连接对象。
6. 所有 path/polygon/frame 坐标在牌框允许范围内。
7. 镜像两次回到原几何；每个规范接口声明的对称变换都把轮廓映回自身。
8. 同色牌组完整复制 18 种模板，不丢牌、不重复。

### 初始化与外侧牌

1. 2、3、4、5、6 人均可初始化。
2. 玩家颜色按座位唯一分配。
3. 每人标准模式 18 张，Quick 按花色过滤。
4. 中间牌不出现在非本人 public view。
5. top/bottom 正确；只剩 1 张时不会重复。
6. 起始玩家先比最小外侧值，再比和值，最终平手走 seed 随机。
7. 相同 seed 产生相同洗牌、起始玩家和 Limited Space 顺序。

### 合法连接

1. 相同完整轮廓可以连接。
2. 三角形不能连正方形。
3. 大长方形不能连小长方形。
4. 空心可盖带点，带点可盖空心。
5. front/back、接口斜角与规范轮廓的全部对称变换都能生成正确吸附姿态。
6. 至少包含一个非 90 度的合法落牌夹具，防止实现退化成方格/直角旋转。
7. 可以覆盖自己颜色，也可覆盖任意对手颜色。
8. 已被覆盖的旧接口不能直接再次选取。
9. 新牌用于连接的来源接口仍可作为后续最上层目标。
10. 旋转四边形与第二张牌正面积相交时拒绝。
11. 只有零面积边/角接触第二张牌时允许。
12. 客户端伪造 pose/x/y 无效，因为服务器只从接口推导矩阵。
13. 陈旧 `board_revision` 被拒绝。
14. 不是当前玩家、不是外侧牌、错误 source connector/symmetry 均被拒绝。

### 无合法连接

1. top 无位置但 bottom 有位置时不能单独放牌。
2. 两张外侧牌的两面、全部来源接口、目标接口和形状对称姿态均无位置时开放 `place_isolated`。
3. 单独牌不能接触任何已有牌。
4. 单独牌之后可被正常连接。
5. 伪造或过期 `isolated_slot_id` 被拒绝。

### 覆盖与计分

1. 覆盖有 3 点的接口后，该颜色实时分减少 3。
2. 空心接口被盖不减少分。
3. 新牌来源接口上的点仍可见并计分。
4. 来源接口之后被覆盖时再扣掉其点。
5. 多层覆盖链只计算每个位置最上层的圆点。
6. 牌的 `owner_color` 决定分数，而不是 `played_by`。
7. 起始牌永远是 0 分。
8. 终局分与最后一次实时分完全一致。
9. 最高分并列时返回多个赢家。

### 状态机与终局

1. 每次合法落牌只从对应一端移除一张牌。
2. 落牌后按顺时针换人。
3. 所有人牌堆为空才结束标准局。
4. Limited Space 每局保留最终桌面直到全员 Next Round。
5. 未全员准备时不能提前清桌。
6. 三小局累计分正确。
7. 序列化/反序列化后版图、覆盖关系、RNG 和当前玩家不变。
8. 断线重连只收到适合该 viewer 的隐藏信息。

### Sabotage

1. 必须恰好启用两个花色。
2. 每人只能选择启用花色之一传出。
3. 全员提交前不公开选择、不移动牌。
4. 所有传牌同时向左执行。
5. 新牌堆由自己的保留牌和右手玩家的传入牌组成。
6. 打出别人颜色的牌时，分数仍归原颜色。

### 前端与可访问性

1. `static/games/tacta.js` 顶层名称不与其他脚本冲突。
2. Help、Explain、Esc、点击空白取消均按 `task40.md` 工作。
3. disabled 的 Place/Place Separately 仍可在 Explain 中说明原因。
4. 375px 宽度下操作坞不横向溢出。
5. 日志可滚动，版图与操作区不覆盖。
6. 只看无障碍符号也能区分六名玩家。
7. 触屏可以完成选择、平移、缩放、翻面、旋转和落牌。

## 性能与一致性风险

### 候选爆炸

终盘可能有大量暴露接口。优化顺序：

1. 按 `shape_id` 索引目标。
2. 预计算“牌模板 + face”的局部接口几何和每种规范 shape 的对称矩阵。
3. 预计算不同接口对的吸附变换。
4. 用版图空间网格只检测候选附近的牌。
5. 缓存当前玩家 top/bottom 的候选，`board_revision` 改变即失效。

不要先用近似几何换性能；109 张牌规模下正确性优先。

### 前后端判定漂移

客户端判定只用于高亮和预览，服务器判定是唯一权威。共享同一目录版本并在 action 中携带 `board_revision`。如果服务器拒绝客户端显示为合法的候选，前端应刷新状态并显示简短原因，不能本地强行落牌。

### 存档体积

存档只保存 `template_id + pose + cover relation`，不重复保存 SVG path。反序列化时按 `catalog_version` 加载目录；版本不匹配应给出明确错误，不能悄悄用新版目录解释旧存档。

### 版权风险

机械坐标与规则数据、视觉设计必须分离。生产 UI 只使用本项目自制 SVG。代码评审需确认没有提交官方扫描图、商品图、Logo 或从 BGA 抓取的素材。

## 实施顺序

### 阶段 0：卡牌目录门槛

1. 获取可合法核对的完整牌组参考。
2. 逐张录入 18 种模板与起始牌。
3. 用数据校验器验证点数、接口和变换。
4. 人工做一张“18 牌目录预览页”逐张复核。

如果这一步未完成，只能继续开发带测试夹具的几何引擎，不能进入规则验收。

### 阶段 1：纯后端规则引擎

1. 数据加载与校验。
2. 镜像、接口对称、斜角刚体吸附与多边形碰撞。
3. 外侧牌、起始玩家、正常落牌。
4. 暴露接口与实时计分。
5. 无合法连接和单独放置。
6. public view、存档和 bot。
7. 完成标准模式单元测试。

### 阶段 2：仓库注册与基础 UI

1. 注册 `TactaGame`、action/config schema。
2. 新建 `static/games/tacta.js`。
3. 在 `index.html` 增加面板、配置、modal 和脚本。
4. 在 `app.js` 接入显示、渲染、清理。
5. 在 `room.js` 接入配置并加入 BGG Weight。
6. 实现 SVG 版图、外侧牌、落牌预览、分数和日志。

### 阶段 3：交互与可访问性

1. 平移、缩放、Fit Board、Center Last Move。
2. 桌面端与 375px 移动端布局。
3. 自制颜色符号、键盘和触屏交互。
4. Help/Explain 完整接入。
5. 断线重连与陈旧预览提示。

### 阶段 4：轮流制变体

1. Quick Round。
2. Limited Space 三小局与全员 Next Round。
3. Sabotage 同时秘密选花色与传牌。
4. 系列局/目标分，如产品需要。

### 阶段 5：验证

执行：

```text
python -m unittest tests.test_tacta
python -m unittest tests.test_frontend_script_names
python scripts/gen_dev_order.py
python -m unittest tests.test_game_dev_order
python -m unittest
```

并进行人工 QA：

- 2 人和 6 人完整打一局。
- 桌面鼠标与 375px 触屏各打一局。
- 专门构造多层覆盖、边角接触、无合法连接、终盘大版图。
- Sabotage 打出对手颜色牌并核对得分归属。
- Limited Space 每局结算时确认版图不会提前消失。

## 首版验收标准

- 2-6 人标准局可以从建房、开局一直玩到正确计分和并列胜利。
- 只有牌堆 top/bottom 可用，中间牌不会经 public view 泄漏。
- 正反面、任意斜角吸附、同轮廓匹配、单牌连接和旋转多边形碰撞均由服务器验证。
- 实时分数与最终可见圆点完全一致。
- 两张外侧牌均无合法连接时才允许单独放置。
- 断线重连、存档恢复后方向、层级、覆盖关系与轮次不变。
- 使用自制 SVG 和颜色辅助符号，不包含商用 UI 或官方牌面资源。
- Help/Explain、Esc、点击空白取消、移动端紧凑布局满足 `FRONTEND.md` 与 `designs/task40.md`。
- 新游戏注册后 `tests/test_game_dev_order.py` 和完整测试套件保持通过。

## 暂缓项

以下不阻塞首版：

- Free Play 实时抢放。
- 7-12 人 Team Up。
- 非官方 2 分钟计时玩法或其他 House Rules。
- 官方美术、音效和品牌视觉。
- 自由像素拖放；首版使用接口吸附候选，规则更清楚且可验证。

后续扩展不能改变标准模式存档含义；如卡牌目录需要修正，应提升 `catalog_version` 并提供明确的旧存档兼容策略。
