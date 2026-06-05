# 《叛逆公主》规则与电子版实现说明

本文档按已核验的英文规则书整理：《Rebel Princess》第二版规则，Zombi Paella，PDF：`https://zombipaella.com/wp-content/uploads/2024/02/rebelprincess-ed02_rulebook_en.pdf`。另参考 Bezier Games 的 Deluxe Edition Living FAQ，用于识别版本差异与部分裁定：`https://beziergames.com/pages/rebel-princess-deluxe-edition-living-faq`。

传牌图标已通过 Tabletop Simulator Workshop 存档核验：`Rebel Princess Complete (English)`，Steam Workshop ID `3549548404`，其说明称基于 `Rebel Princess / Rebelles Princesses`，ID `3268117466`。我只使用该 TTS 存档中的规则牌文字、CardID 顺序和传牌图标信息，不使用牌面美术作为电子版素材。

注意：Bezier Games Deluxe Edition 与 Zombi Paella 第二版存在牌名、牌数、机制差异。本文主体只描述 Zombi Paella 规则书中能确认的 4 类花色牌、21 张回合牌、10 张公主牌玩法。

## 游戏概况

- 玩家人数：3-6 人。
- 游戏时长：约 30-45 分钟。
- 核心机制：类似红心大战的吃墩游戏。玩家不想吃到会带来“求婚数”的牌。
- 胜利目标：5 轮结束后，累计求婚数最少的玩家获胜。
- 主题解释：玩家扮演童话公主，在 5 天舞会中尽量避开王子的求婚。王子牌和青蛙牌会带来求婚数。

## 组件

### 普通牌

共有 4 个花色，每个花色最多 12 张，点数为 1-12。

- 王后 Queen：1-12。
- 仙女 Fairy：1-12。
- 宠物 Pet：1-12，其中宠物 8 是青蛙 Frog。
- 王子 Prince：1-12。

电子版建议使用如下结构：

```json
{
  "id": "prince-12",
  "suit": "prince",
  "rank": 12,
  "isFrog": false,
  "baseProposal": 1
}
```

普通牌基础求婚数：

- 每张王子牌：1 求婚数。
- 宠物 8 青蛙：5 求婚数。
- 其他牌：0 求婚数。

部分回合牌会改变计分方式，例如“宠物复仇”让所有宠物牌也计分。

### 公主牌

规则书列出 10 张公主牌。每名玩家拥有 1 张且不能重复。公主能力默认每轮最多使用 1 次，使用后横置/标记为 exhausted，本轮结束后恢复。

### 回合牌

规则书列出 21 张回合牌。每局选择或随机抽取 5 张，按顺序面朝下排列。每轮开始翻开 1 张并应用它的特殊规则。

每张回合牌还带有开局传牌图标，表示本轮开始时每名玩家要同时向左或向右传出若干张牌。规则书文字说明了传牌原则；完整数量/方向已通过 TTS 牌面核验。电子版应把传牌配置作为 `RoundCard.pass` 字段保存。

## 玩家人数与牌组构成

按玩家人数从 4 个花色中移除某些点数，确保所有牌能平均发给玩家。

- 3 人：每个花色只使用 2-10，移除 1、11、12。牌数为 4 * 9 = 36，每人 12 张。
- 4 人：每个花色使用 1-10，移除 11、12。牌数为 4 * 10 = 40，每人 10 张。
- 5 人：同 4 人，每个花色使用 1-10。牌数为 40，每人 8 张。
- 6 人：每个花色使用 1-12。牌数为 48，每人 8 张。

电子版牌组生成：

```text
if player_count == 3:
  ranks = [2,3,4,5,6,7,8,9,10]
elif player_count in [4,5]:
  ranks = [1,2,3,4,5,6,7,8,9,10]
elif player_count == 6:
  ranks = [1,2,3,4,5,6,7,8,9,10,11,12]
deck = all suits x ranks
```

## 开局设置

1. 按玩家人数生成普通牌牌组。
2. 洗牌，全部平均发给玩家，面朝下成为手牌。
3. 每名玩家选择或随机获得 1 张公主牌。
4. 选择或随机确定 5 张回合牌，按第 1-5 轮顺序放置。
5. 确定起始玩家：
   - 若玩家选择公主，规则书建议第一个选择公主的人为起始玩家。
   - 若随机发公主，规则书主题规则为“最近参加婚礼的人”起始。电子版可随机或房主指定。

初学推荐的 5 张回合牌顺序：

1. Once Upon a Time...
2. Masquerade Ball
3. Invitation
4. Royal Decree
5. Wedding Gift

## 每局流程

一局固定进行 5 轮。

每轮流程：

1. 翻开本轮回合牌，应用其特殊规则。
2. 按本轮回合牌图标执行开局传牌：
   - 每名玩家从自己手牌中选出指定数量与方向的牌。
   - 所有人同时选择。
   - 玩家不能在交出自己的牌之前查看收到的牌。
3. 起始玩家开始第一墩。
4. 重复进行若干墩，直到本轮手牌全部打完。
5. 统计本轮每名玩家吃到的求婚数并记录。
6. 洗回所有普通牌，重新发牌。
7. 所有公主能力恢复为可用。
8. 翻开下一张回合牌。
9. 上一轮最后一墩的赢家成为下一轮起始玩家。

本轮墩数通常等于每人手牌数量。但若回合牌改变消耗方式，例如 Wedding Gift 每墩每人额外暗置 1 张牌，则本轮墩数会减少。

## 普通吃墩规则

一墩按顺时针从起始玩家开始，每名玩家依次打出 1 张牌。

### 首牌与跟牌

- 第一张打出的牌决定本墩主花色，称为 leading suit。
- 后续玩家若有主花色牌，必须打出一张该花色牌。
- 若没有主花色牌，则称为 void，可以打任意其他花色牌。

### 墩的赢家

基础规则下：

- 只比较主花色牌。
- 主花色中点数最高的玩家赢得本墩。
- 非主花色牌不能赢墩，除非回合牌或公主能力改写规则。
- 赢家收走本墩所有牌，面朝下放到自己的已赢墩区。
- 已赢墩区在本轮结束前不能查看。
- 赢家成为下一墩起始玩家。

### 王子不能主动开局

王子花色有特殊限制：

- 在王子“潜入舞会”之前，玩家不能用王子牌作为一墩的首牌。
- 青蛙不是王子牌，不会触发王子潜入。
- 当某名玩家因为 void 而打出一张王子牌后，王子视为已经潜入舞会。
- 从那一刻起，直到本轮结束，玩家可以用王子牌作为首牌。
- 如果起始玩家手里只有王子牌，即使王子尚未潜入，也允许用王子牌开局。

电子版应维护：

```json
{
  "princesSneakedIn": false
}
```

当一名非首牌玩家在 void 状态下打出 `suit == "prince"` 的牌时，将其设为 `true`。

## 求婚数计分

每轮结束后统计每名玩家已赢墩区内所有会带来求婚数的牌。

基础计分：

- 每张王子牌 = 1。
- 宠物 8 青蛙 = 5。
- 其他牌 = 0。

游戏结束后：

- 累计求婚数最少者获胜。
- 若平手，比较“得 0 求婚数的轮数”，次数更多者获胜。
- 若仍平手，共同胜利。

电子版建议每轮记录：

```json
{
  "roundIndex": 0,
  "roundCard": "once_upon_a_time",
  "scores": {
    "playerA": 2,
    "playerB": 0,
    "playerC": 4
  }
}
```

## 公主能力通用规则

- 每名玩家每轮最多使用自己的公主能力 1 次。
- 使用时宣告并把公主标记为 exhausted。
- 能力在本轮结束后恢复。
- 公主能力的时机由每张牌说明决定。
- 初学局可以忽略公主能力，只玩基础吃墩和回合牌。

电子版应为每个能力定义：

- `timing`：可触发时机。
- `canUse(gameState, playerId)`：当前状态是否合法。
- `resolve(gameState, playerId, choices)`：执行能力。
- `exhaustedThisRound`：本轮是否已使用。

## 10 张公主牌

### Cinderella 灰姑娘：午夜变身

时机：下一墩开始前。

效果：本墩点数大小反转，12 视为最低，1 视为最高。

实现：

- 给下一墩设置 `rankOrderInverted = true`。
- 只影响该墩。
- 若同时有 Upside Down 回合牌的 6 点反转，需要用“反转次数”处理。每出现一次反转效果就翻转一次最终大小顺序。

### Snow White 白雪公主：七个小矮人

时机：当自己打出点数 7 或更低的牌时。

效果：可以让这张牌在本墩结算时当作 0 点。

实现：

- 该牌原始点数不变，用于手牌与计分身份。
- 本墩比较大小时该牌有效点数为 0。
- 使用后公主 exhausted。

### The Little Mermaid 小美人鱼：催眠歌声

时机：某玩家即将开始下一墩之前。

效果：指定该起始玩家必须用哪个花色开局。

限制：

- 若起始玩家没有该花色牌，则按普通规则开局。
- 若王子尚未潜入，本能力不能强制指定王子花色。
- 青蛙不算王子潜入。

实现：

- 设置 `forcedLeadSuit` 到下一墩起始玩家。
- 校验该玩家是否有该花色可出。
- 与王子开局限制同时存在时，王子限制优先阻止非法强制。

### Pocahontas 宝嘉康蒂：荒野向导

时机：自己赢得一墩后。

效果：选择另一名玩家开始下一墩。

实现：

- 替换默认 `nextLeader = trickWinner`。
- 只能选择非自己玩家。

### Sleeping Beauty 睡美人：命运纺锤

时机：下一墩开始前。

效果：

1. 每名玩家，包括睡美人自己，从手牌中选择 1 张牌交给睡美人。
2. 睡美人秘密查看所有收到的牌。
3. 睡美人保留其中 1 张。
4. 其余牌随机分发给其他玩家，不公开。

实现注意：

- 如果手牌为空不能触发。
- 每名玩家手牌数量最终保持不变，睡美人也只多拿后再分出。
- “随机分发给其他玩家”按规则不让睡美人指定具体去向。

### Alice 爱丽丝：混乱疯帽

时机：自己刚赢得一墩，且该墩不包含青蛙。

效果：洗混所有玩家当前手牌，并重新发回给每名玩家。

实现：

- 只洗当前仍在手里的牌，不影响已赢墩和已打出的本墩。
- 重新发牌后每名玩家手牌数量应保持原数量；规则文字说 deal back to every player's hand，包括自己，通常可按当前每人手牌数量重新分配。
- 若该墩包含宠物 8 青蛙，不能触发。

### Mulan 花木兰：伪装

时机：一墩所有玩家都打完牌、但尚未判定赢家之前。

效果：把自己本墩打出的牌，与自己手牌中另一张同花色牌交换；不能换青蛙。

实现：

- 新换上的牌必须与原打出牌同花色。
- 被换上的牌不能是青蛙。
- 换下的原牌回到木兰手牌。
- Bezier FAQ 对同类能力给出明确裁定：必须从自己手牌换，青蛙不能被换。

### Scheherazade 山鲁佐德：集市交易

时机：下一墩开始前。

效果：

1. 从任意一名玩家手牌中随机抽 1 张。
2. 你查看后，可选择用自己手牌中的 1 张牌与其交换。
3. 也可以把抽到的牌还给对方，不交换。

实现：

- 被抽玩家可以是任意其他玩家；规则文字为 any player，是否可选自己没有实用意义，电子版建议只允许选择其他玩家。
- 抽取是随机，不由使用者指定具体牌。
- 交换时双方手牌数量不变。

### The Pea Princess 豌豆公主：再睡五分钟

时机：自己打出一张牌时。

效果：本墩中尚未打牌的其他玩家，如果手中有点数大于 5 的牌，则之后必须打出点数大于 5 的牌。

实现：

- 设置当前墩约束 `mustPlayRankAboveFiveForRemainingPlayers = true`。
- 该约束只影响尚未行动的玩家。
- 玩家仍须先满足更高优先级的跟花色规则；Bezier FAQ 对 Deluxe 裁定说明，小美人鱼指定花色/主花色义务优先，若该花色没有 >5，仍必须按花色规则出牌。
- 如果一个玩家完全没有 >5 的合法牌，则按普通合法牌集合出牌。

### The Ice Princess 冰雪公主：冻结

时机：某玩家即将开始一墩前。

效果：该玩家必须从手牌中随机打出一张牌作为首牌。

特殊：

- 如果随机选中的是王子牌，则视为王子已经潜入本轮。

实现：

- 忽略起始玩家的自主选择，随机取其一张手牌作为首牌。
- 若抽到王子，设置 `princesSneakedIn = true`。
- 若王子未潜入但随机抽到王子，仍合法。

## 21 张回合牌

回合牌规则优先于基础规则。若公主能力与回合牌冲突，通常按具体时机与文字裁定；电子版应把能力和回合效果拆成事件钩子处理。

### a. Once Upon a Time... 从前从前

入门牌，无额外规则。

### b. Invitation 邀请函

入门牌，无额外规则。

### c. Masquerade Ball 化装舞会

本轮中，除起始玩家外，所有玩家打出的牌都先面朝下。

流程：

1. 起始玩家明牌打出首牌，确定主花色。
2. 其他玩家选择合法牌，牌面暂时隐藏。
3. 所有人打完后同时翻开。
4. 按正常规则判定赢家。

实现注意：

- 电子版服务端必须仍然校验跟花色合法性。
- 客户端只隐藏尚未翻开的牌面。

### d. Royal Decree 皇家法令

王后花色总是赢墩。

判定：

- 若本墩至少有 1 张王后牌，则最高点数王后赢。
- 若没有王后牌，则按基础规则判定。

实现：

```text
if any card.suit == queen:
  winner = highest effective rank among queen cards
else:
  winner = normal leading suit winner
```

### e. Musical Chairs 抢椅子

每墩结束后，每名玩家同时从手牌中选 1 张牌，面朝下传给右侧玩家。

实现：

- 在墩结算、下一墩开始前触发。
- 若玩家已经没有手牌，则不触发或传牌数量为 0。
- 所有人同时选择，不能先看收到的牌。

### f. Pets' Revenge 宠物复仇

本轮结束计分时，宠物牌也会带来求婚数。

计分：

- 每张宠物牌 = 1。
- 青蛙基础为 5，再因宠物牌额外 +1，因此青蛙 = 6。
- 王子仍按基础规则每张 1。

### g. Late to the Ball 迟到舞会

开局传牌后、第一墩开始前，每名玩家从手牌中选择 1 张牌面朝下放在自己面前。

效果：

- 这些牌不参与前面的墩。
- 到本轮最后一墩时，这张牌将作为该玩家打出的牌，并按正常规则处理。

实现：

- 每人保存 `reservedLastTrickCard`。
- 前面墩数减少 1 张手牌。
- 最后一墩中，玩家没有选择权，自动打出保留牌。
- 最后一墩仍需要按正常规则验证/处理；若保留牌不符合跟花色，规则文字说“following the normal rules”，电子版需要决定是否允许玩家保留非法牌。更稳妥实现是在最后一墩自动打出，不做跟花色阻止，因为保留时无法预知最后主花色；但判定仍按正常胜负规则。

### h. Poisoned Apple 毒苹果

本轮中，void 玩家打出的牌会赢墩。

判定：

- 若没有 void 玩家，按基础规则判定。
- 若有 1 名 void 玩家，该玩家赢得本墩。
- 若有多名 void 玩家，点数最高者赢。
- 若点数相同，后打出的玩家赢。

实现：

- 对每张非首牌记录 `wasVoid = player had no leading suit before playing`。
- 注意：如果玩家有主花色却违规打其他花色，不能被视为合法 void。

### i. Crystal Clear 水晶透明

本轮开始时，每名玩家从自己手牌中选择 1 个花色，把该花色所有手牌明牌放在自己面前。

效果：

- 这些牌仍属于该玩家手牌。
- 可以正常打出。
- 其他玩家可见这些牌。

实现：

- 为每名玩家保存 `revealedSuitThisRound`。
- 客户端展示该玩家手牌中属于该花色的牌面。
- 当这些牌被打出、传出或交换时，更新可见状态。

### j. Upside Down 颠倒

本轮中，任何花色的 6 点牌会反转本墩点数大小顺序。

规则：

- 只影响出现 6 点牌的那一墩。
- 每出现 1 张 6 点牌，大小顺序反转 1 次。
- 若出现奇数张 6，低点数大于高点数，即 1 最大、12 最小。
- 若出现偶数张 6，反转相互抵消，仍按正常顺序。

实现：

```text
inversions = count(cards in trick where rank == 6)
if cinderella_inversion_active:
  inversions += 1
inverted = inversions % 2 == 1
effectiveRank = inverted ? -rank : rank
```

### k. Dancing Queens 王后共舞

本轮计分时，王子与王后会配对改变求婚数。

计分算法：

1. 对某玩家赢得的牌，分离出王子牌与王后牌。
2. 优先按相同点数配对王子和王后。
3. 一对点数相同的王子+王后：两张合计 3 求婚数。
4. 点数不相同但能配对的王子+王后：两张合计 2 求婚数。
5. 无法配到王后的王子：每张 1 求婚数。
6. 青蛙仍按基础规则 5 求婚数，规则书未说明王后影响青蛙。

实现建议：

```text
score = frog_score
for each prince rank:
  if queen same rank exists:
    consume prince and queen
    score += 3
for each remaining prince:
  if any queen remains:
    consume prince and one queen
    score += 2
  else:
    score += 1
```

若要最大化官方意图，应优先同点数配对；非同点数配对不影响分数差异，所以任意配即可。

### l. The Prince Always Rings Twice 王子总会响两次铃

每墩分两轮出牌：所有玩家先各打一张，然后同一墩继续，每名玩家再各打一张。

判定：

- 本墩主花色由第一张首牌决定。
- 每名玩家的两张牌中，只有主花色牌参与其点数合计。
- 赢家是主花色点数合计最高的玩家。
- 若合计相同，拥有最高单张主花色牌的玩家赢。
- 若玩家两张中只有一张是主花色，另一张不计入合计。

实现注意：

- 每名玩家每墩消耗 2 张牌，因此本轮墩数约为手牌数的一半。
- 第二轮出牌仍需“following the rules”，即仍应要求能跟主花色则跟主花色；若手牌中没有主花色可打，才可打其他花色。
- 若最后只剩 1 张牌，理论上本轮初始手牌数量都是偶数，正常不会发生。

### m. Wedding Gift 结婚礼物

每墩开始时，每名玩家先从手牌中选择 1 张牌，面朝下放入礼物堆；该堆会给本墩赢家。

效果：

- 放入礼物堆的牌不参与本墩胜负判定。
- 本墩每名玩家随后正常打 1 张牌。
- 赢家收走本墩明牌和礼物堆所有暗牌。
- 因每墩每人消耗 2 张牌，本轮只会进行平常一半数量的墩。

规则书明确给出本牌传牌图标示例：本轮开始时每名玩家同时向右传 1 张、向左传 1 张。

### n. After-party 余兴派对

每名玩家把自己的手牌平均分为两半，其中一半面朝下放在一旁。

流程：

1. 先使用其中一半手牌进行游戏。
2. 第一半打完后，再使用另一半。

实现：

- 需要让玩家选择两组，或随机/按排序分组。规则书说 divide their hand，应允许玩家自己分。
- 放在一旁的一半在前半段不可用。
- 两半都属于该玩家，不传给别人。

### o. Bathroom Break 厕所休息

本轮计分时，王子牌求婚数翻倍，但累计求婚数最高的玩家除外。

规则：

- 在本轮开始前比较“截至目前的累计求婚数”。
- 累计最高的玩家，或并列最高的多名玩家，本轮王子牌不翻倍。
- 其他玩家本轮每张王子牌 = 2。
- 青蛙不是王子牌，仍按基础 5。

实现：

```text
leaders = players with max(totalScoreBeforeRound)
if player in leaders:
  princeValue = 1
else:
  princeValue = 2
```

### p. Single Fairy 单身仙女

本轮计分时，每张吃到的仙女牌抵消 1 求婚数。

规则：

- 每张 Fairy = -1。
- 本轮可以得到负分。
- 王子、青蛙等先按本轮其他规则计分，再扣仙女。规则书没有说明与其他计分回合牌叠加，因为每轮只有 1 张回合牌，通常无冲突。

### q. Blind Man's Bluff 盲人摸象

每名玩家把手牌平均分为两半，其中一半面朝下放在一旁。

流程：

1. 先使用自己未放置的一半手牌。
2. 第一半打完后，把放在一旁的另一半交给右侧玩家。
3. 右侧玩家使用收到的那一半继续本轮。

实现：

- 和 After-party 类似，但第二半会交给右侧玩家。
- 需要记录每名玩家的 `setAsideHalf`，在半轮切换时批量传递。
- 玩家后半段使用的是别人原本放置的牌。

### r. Midnight Makeover 午夜改造

仙女牌成为百搭牌。

规则：

- 仙女可以跟随任意花色。
- 玩家可以在任何时候打仙女。
- 只要玩家手中有仙女，就不视为 void。
- 本墩赢家为“主花色牌或仙女牌”中点数最高者。
- 若点数相同，后打出的玩家赢。
- 若一墩以仙女开局，主花色就是仙女。

实现重点：

- 合法出牌：如果有主花色或仙女，必须打主花色或仙女；没有时才是真正 void。
- 比较赢家：候选牌为 `card.suit == leadingSuit || card.suit == fairy`。
- 若 leadingSuit 是 fairy，候选牌就是仙女牌。

### s. Pass the Bouquet! 传递花束

本墩中，每出现一个新花色，该花色会成为新的主花色。

示例：

- A 用王后开局，主花色为王后。
- B 没有王后，打出宠物。
- 主花色变为宠物。
- 后续玩家若有宠物必须打宠物。
- 最终最高宠物赢。

实现：

- 维护动态 `currentLeadingSuit`。
- 每名玩家行动前，若有 `currentLeadingSuit` 必须跟该花色。
- 若玩家没有当前主花色并打出一个不同花色，则 `currentLeadingSuit = playedCard.suit`。
- 赢家按最终主花色中最高点数判定。
- 王子潜入规则仍按“void 打出王子”触发。

### t. Haggle with the Hag 与女巫讨价还价

当玩家赢得一墩时，可以用自己手牌中的 1 张牌，交换本墩中的 1 张牌。

规则：

- 玩家从手牌选择 1 张并展示。
- 选择本墩中 1 张牌拿回手牌。
- 不能拿回自己刚刚打出的那张牌。
- 放入本墩的牌会进入自己的已赢墩区。

实现：

- 在结算赢家后、把墩加入已赢墩区前触发。
- 选择交换后，更新 trick cards 与 winner hand。
- 如果把王子放入已赢墩区，不会因为这个动作触发王子潜入；Bezier FAQ 对 Deluxe 同名牌也确认：只有 void 打出王子才代表潜入。

### u. Odds and Evens 奇偶

除跟花色外，还必须尽量匹配首牌的奇偶性。

规则：

- 首牌确定主花色和奇偶性。
- 后续玩家如果能同时满足“主花色 + 同奇偶”，必须这样打。
- 如果不能同时满足，仍然优先满足主花色。
- 如果没有主花色而 void，则奇偶要求再次优先：若能打同奇偶的任意花色，应打同奇偶牌。
- 若连同奇偶也没有，则可打任意牌。

合法牌算法：

```text
leadParity = lead.rank % 2
sameSuitSameParity = hand cards where suit == leadingSuit and rank % 2 == leadParity
if sameSuitSameParity:
  legal = sameSuitSameParity
else:
  sameSuit = hand cards where suit == leadingSuit
  if sameSuit:
    legal = sameSuit
  else:
    sameParity = hand cards where rank % 2 == leadParity
    if sameParity:
      legal = sameParity
    else:
      legal = all hand
```

## 开局传牌系统

每轮开始的传牌是通用机制：

1. 本轮回合牌给出若干传牌指令，例如 `1 right`、`1 left`。
2. 玩家从手牌选择对应数量的牌。
3. 所有玩家同时提交。
4. 服务端验证每人提交数量正确。
5. 服务端同时移动牌。
6. 传牌完成后，玩家才看到收到的新牌。

数据结构建议：

```json
{
  "pass": [
    { "count": 1, "direction": "right" },
    { "count": 1, "direction": "left" }
  ]
}
```

方向定义：

- `left`：传给顺时针下一名玩家，具体取决于座位数组定义。
- `right`：传给逆时针上一名玩家。

TTS 牌面核验出的基础 21 张回合牌开局传牌配置如下。这里把牌面上的顺时针箭头记为 `right`，逆时针箭头记为 `left`；该方向由 Wedding Gift 的规则书示例和 Musical Chairs 牌面文字共同校准。

| 字母 | 回合牌 | 开局传牌配置 |
| --- | --- | --- |
| a | Once Upon a Time... | `[{ "count": 3, "direction": "right" }]` |
| b | Invitation | `[{ "count": 3, "direction": "right" }]` |
| c | Masquerade Ball | `[{ "count": 1, "direction": "right" }]` |
| d | Royal Decree | `[{ "count": 3, "direction": "right" }]` |
| e | Musical Chairs | `[{ "count": 1, "direction": "right" }]` |
| f | Pets' Revenge | `[{ "count": 1, "direction": "left" }, { "count": 1, "direction": "right" }]` |
| g | Late to the Ball | `[{ "count": 1, "direction": "right" }]` |
| h | Poisoned Apple | `[{ "count": 2, "direction": "right" }]` |
| i | Crystal Clear | `[{ "count": 2, "direction": "right" }]` |
| j | Upside Down | `[{ "count": 2, "direction": "right" }]` |
| k | Dancing Queens | `[{ "count": 2, "direction": "right" }]` |
| l | The Prince Always Rings Twice | `[{ "count": 1, "direction": "left" }, { "count": 1, "direction": "right" }]` |
| m | Wedding Gift | `[{ "count": 1, "direction": "left" }, { "count": 1, "direction": "right" }]` |
| n | After-party | `[{ "count": 1, "direction": "right" }]` |
| o | Bathroom Break | `[{ "count": 2, "direction": "right" }]` |
| p | Single Fairy | `[{ "count": 1, "direction": "right" }]` |
| q | Blind Man's Bluff | `[{ "count": 1, "direction": "right" }]` |
| r | Midnight Makeover | `[{ "count": 3, "direction": "right" }]` |
| s | Pass the Bouquet! | `[{ "count": 3, "direction": "right" }]` |
| t | Haggle with the Hag | `[{ "count": 1, "direction": "right" }]` |
| u | Odds and Evens | `[{ "count": 2, "direction": "right" }]` |

实现时建议把这张表独立成数据常量，并允许后续版本覆盖。Deluxe Edition 与扩展牌存在额外回合牌，不应混入基础第二版的 21 张牌。

## 合法出牌判定优先级建议

电子版实现时，建议按“当前回合牌/公主能力修改后的合法牌函数”统一生成可出牌集合，不要在 UI 里手写判断。

基础函数：

```text
getLegalCards(player, trickState, roundEffect, pendingPrincessEffects):
  if player is lead:
    legal = hand
    apply prince lead restriction
    apply forced lead effects
    apply random lead effects
  else:
    legal = follow leading suit if possible else all hand
    apply round-specific constraints
    apply princess constraints
  return legal
```

重要状态：

```json
{
  "roundIndex": 0,
  "trickIndex": 0,
  "leaderId": "p1",
  "currentTrick": [
    {
      "playerId": "p1",
      "card": { "suit": "queen", "rank": 3 },
      "faceDown": false,
      "effectiveRank": 3,
      "wasVoid": false
    }
  ],
  "leadingSuit": "queen",
  "princesSneakedIn": false,
  "roundCardId": "masquerade_ball",
  "pendingEffects": []
}
```

## 墩赢家判定优先级建议

多数回合牌会替换或修饰“谁赢本墩”。建议用策略函数：

```text
determineWinner(trick, roundCard, activePrincessEffects):
  if roundCard == royal_decree:
    ...
  elif roundCard == poisoned_apple:
    ...
  elif roundCard == prince_always_rings_twice:
    ...
  elif roundCard == pass_the_bouquet:
    ...
  elif roundCard == midnight_makeover:
    ...
  else:
    normal leading suit highest
```

点数比较应使用 `effectiveRank`，以支持灰姑娘、白雪公主、Upside Down 等效果。

## 计分函数建议

```text
scoreWonCards(player, wonCards, roundCard, totalScoresBeforeRound):
  if roundCard == pets_revenge:
    princes = count(prince) * 1
    pets = count(pet) * 1
    frog_extra = 5 if frog exists else 0
    return princes + pets + frog_extra

  if roundCard == dancing_queens:
    return scoreDancingQueens(wonCards)

  if roundCard == bathroom_break:
    princeValue = 1 if player in current leaders else 2
    return count(prince) * princeValue + frogBase

  if roundCard == single_fairy:
    return baseScore(wonCards) - count(fairy)

  return count(prince) + (5 if frog exists else 0)
```

如果一名玩家因为某些效果得到负分，允许本轮分数与累计分数为负。

## 需要实现的客户端信息隐藏

电子版必须处理以下隐藏信息：

- 每名玩家手牌只对自己可见。
- Masquerade Ball 中非首牌玩家打出的牌，在所有人打完前对其他玩家隐藏。
- Sleeping Beauty 收到的牌只对睡美人可见，之后随机分发结果只对收到者可见。
- Scheherazade 随机抽到的牌只对使用者可见。
- Wedding Gift 的礼物堆牌在进入墩前面朝下，通常直到计分或赢家查看前不公开；规则只说给赢家，建议对赢家也先保持已赢墩不可查看。
- 已赢墩在本轮结束前不能查看。
- Crystal Clear 选择的花色明牌公开，且需要随牌移动更新公开状态。

## 轮间暂停需求

按本仓库 `FRONTEND.md` 要求，每轮结束并完成计分后需要暂停：

- 展示本轮回合牌、每名玩家本轮吃到的求婚数、累计求婚数。
- 展示关键吃墩牌统计，例如王子数量、青蛙归属。
- 所有玩家点击 `Next Round` 后才开始下一轮发牌/翻牌。

## 推荐电子版模块拆分

```text
game/rebel_princess.py
  Card, Princess, RoundCard dataclass
  build_deck(player_count)
  deal(deck, players)
  get_legal_cards(...)
  play_card(...)
  determine_trick_winner(...)
  score_round(...)
  serialize_private_view(player_id)

static/games/rebel_princess.js
  render hand / trick / scores
  choose pass cards
  choose princess power targets
  show round pause and Next Round
```

## 无法完整获取或需要补齐的游戏资源

以下内容我没有从可公开文本中完整获取，若要做完全贴合实体版的电子版，需要补齐：

- 官方卡牌美术、牌背、图标、排版、字体等商用视觉资源。电子版应使用自制替代素材或仅用文字/emoji 表示。
- 官方中文本地化名称与中文牌面原文。本文中文名为便于理解的译名，不保证等同出版物。
- Bezier Games Deluxe Edition 的完整规则书、完整牌表与全部额外牌。TTS 模组中能看到 Deluxe 与扩展牌对象，但本文主体只实现 Zombi Paella 第二版 21 张基础回合牌；其 FAQ 中出现 Magic Beans、Three Times a Lady、Sisterhood、Sum Enchanted Evening 等不在 Zombi Paella 21 张回合牌列表中的牌名，说明不同版本并不完全一致。
- “Rebel of the Ball”等 Deluxe/第二版宣传中提到的追赶或反转机制，在本文所核验的 Zombi Paella PDF 正文中没有完整规则，因此未纳入主体实现。
- 各公主与各回合牌之间的所有边界冲突裁定。本文只列出已能从规则书或 FAQ 明确推导的裁定；完整实现应在测试中覆盖组合效果，并在需要时查官方论坛/FAQ。
