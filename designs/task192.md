# Task 192：哒哒哒（DADADA）

## 1. 游戏概述

- **中文名**：《哒哒哒》 ｜ **英文名**：DADADA ｜ **线上版 game_id**：`dadada`
- **发行**：The Op Games，2024（中文版 2026 年由国内渠道引进，B 站 2026-09 起量）
- **人数**：2–6 人 ｜ **时长**：约 15–30 分钟 ｜ **适龄**：8 岁以上 ｜ **BGG 复杂度**：1.10 / 5
- **机制**：合作 + 沟通限制（Communication Limits）+ 记忆 + 共识
- `turn_mode = "turn"`（造词期与试词期都按座位顺时针推进；投票与指认是同一回合内的并行子步骤）

一句话玩法：**全桌用五个没有意义的音节当场发明一门语言，再用这门语言把图卡"说"出来，看你们是不是真的在说同一门语言。**

## 2. 规则来源与可信度

核对日期：2026-11-09。

| 结论 | 来源 | 可信度 |
|---|---|---|
| 组件为 40 张音节牌 + 200 张图卡 | BGG / allboardgames.com / videogamegeek 商品页 | 高（多处一致） |
| 开局发 5 张音节牌、翻开 2 张，其余 3 张扣着 | whatsericplaying.com 开箱评测（拍了 setup 图） | 高 |
| 造词期处理 13 张图卡 | whatsericplaying.com、pojo.com | 高（两处一致） |
| 音节上限 5 张，翻完不再增加 | whatsericplaying.com「flipping more than the starting two as you need, to a maximum of five」 | 高 |
| 造词期禁止使用母语，只能用已翻开的音节交流 | pojo.com、playonwords.com、whatsericplaying.com | 高（三处一致） |
| 提议—认同—否则翻新音节 的逐张流程 | BGG 官方简介 + Pegasus Spiele（德语官方授权版）描述 | 高（发行方原文） |
| 试词期每轮摊 6 张图，命名者秘密选定其中 1 张 | BGG 官方简介 + pojo.com + whatsericplaying.com | 高（三处一致） |
| 只能用意造语言的音节命名，可组合、可重复 | BGG 官方简介、playonwords.com | 高 |
| 命中进 "Defined Picture" 堆并计 1 分 | pojo.com（拍了规则书计分表） | 高 |
| 未命中进 "Say What" 堆，攒 2 张结束 | pojo.com、whatsericplaying.com | 高（两处一致） |
| 每位玩家都当过一次命名者后正常结束 | whatsericplaying.com「Move onto the next player so everyone has a chance to be the picker. Once you have, tally up your score」 | 中高 |
| 第三阶段为复盘（Reflection），展示整门语言 | playonwords.com | 高 |

主要链接：

- [BGG DaDaDa (2024)](https://boardgamegeek.com/boardgame/420091/dadada) —— 发行方简介原文
- [DaDaDa — What's Eric Playing?](https://whatsericplaying.com/2024/12/16/dadada/) —— 最完整的逐条 setup 与回合流程
- [Dadada Board Game Review — Pojo](https://www.pojo.com/dadada-board-game-review/) —— 三阶段拆解与规则书照片
- [Dadada by The Op Games — Play On Words](https://playonwords.com/award/15826) —— 三阶段与复盘
- [DaDaDa — World of Games（Pegasus Spiele 授权版）](https://www.wog.ch/en/index.cfm/details/product/241067-DaDaDa) —— 德语官方描述
- B 站规则讲解：[聚会爆笑游戏《哒哒哒》规则讲解（碎嘴大爆炸，2026-09-28）](https://www.bilibili.com/video/BV1xyaV6aEZa)
- B 站试玩：[用五个音节创造我们的语言！《DADADA》（姬脑壳，2026-10-18）](https://www.bilibili.com/video/BV1GrJX69E4j)

**规则冲突与裁定**：物理版规则书未公开全文，各评测在"6 张候选图是新抽的还是造词期留下的"上有分歧。本实现采用 **BGG 发行方原文 + Pegasus 官方授权版** 的口径：造词期结束后每轮**从图卡堆新翻 6 张**，命名者从中秘密选定 1 张。这与 pojo / whatsericplaying 描述的"1 张目标 + 5 张干扰"完全等价。

## 3. 组件

### 3.1 音节牌（Sound Cards）

40 张，每张一个无意义单音节。线上版沿用发行方举例与同类风格，全部大写以便一眼读成一个音节：

`PU PEH AH OO BA DA FOO BONG JAH TEP MEEP POE RUE ZIK GLORP NIM KOO WHA YIP SNU BLIP MOO GUR HEE TZA VOO LUM NGA PIP QUO RAH SOO TUK UMP VEH WOB XAO YUM ZOO BLEH`

### 3.2 图卡（Image Cards）

**无法获取的资源**：实体版 200 张手绘 pictograph 的美术文件不可再分发。

**线上版替代方案**：`game/dadada_data.py` 自带 **257 张 emoji 图卡**，每张带 `emoji / zh / en` 三字段。选型原则：

- 只取具体可指认的物件（动物、食物、载具、工具、家居、衣物、自然、地点、娱乐、身体、杂物），刻意跨类别铺开，保证"能不能归成 3–5 类"这个核心玩法成立。
- 全部为 iOS 与 Windows 都有的 Unicode emoji，符合 DEV_GUIDE「不使用商用 UI 素材」与「Emoji 需兼容 iOS 和 Windows」。
- 257 张互不重复，远超一局最大消耗量（13 张造词 + 6 × 人数）。

### 3.3 开局

1. 洗匀音节牌，抽 5 张，**五张全部正面朝上**进入语言区（线上版偏离，见 §4.2）。
2. 洗匀图卡，翻开 13 张摊在图卡池，其余留作牌堆。
3. 造词期开始，座位 1 先手。

## 4. 线上版规则

### 4.1 阶段总览

`create`（造词期） → `speak`（命名） → `guess`（指认） → `reveal`（结算） → 下一轮 …… → `game_over`（复盘）

### 4.2 两处对发行方规则的偏离

| 偏离 | 发行方原版 | 线上版 | 理由 |
|---|---|---|---|
| **音节全部明牌** | 发 5 张，只翻 2 张，另 3 张扣着当储备，造词过程中按需翻开 | 开局 5 张全部正面朝上，没有储备牌，没有 `?` 翻开机制 | 玩家需要先看见全部家底才知道该把类别切多宽。扣着的牌让人误以为音节还能增加，反而做错决策 |
| **归类无需表决** | 提议后其他人逐个表态，过半同意才生效，否决则由同一人重提，两次否决进无名区 | 点图 + 点音节即刻生效，没有投票、没有否决、没有无名区 | 造词期的分歧应该在试词期暴露，而不是用投票压下去。全桌看不顺眼的归属会让这门语言后面自然卡住，那才是想要的信号。表决也让 13 张图的造词期多出 13 轮等待 |

去掉表决后连带删除：`vote` 动作、`pending` / `attempts` / `unnamed` 状态、无名区 UI。

### 4.3 造词期 `create`

按座位顺时针轮流，每人回合处理**一张**图：

1. 当前玩家从图卡池任选一张**未归类**的图。
2. 再点语言区里五个音节中的任意一个，这张图立刻归到该音节名下。
3. 轮到下一位。13 张图全部归完，造词期结束（恰好 13 个回合）。

> **母语禁令的线上处理**：实体版要求造词期只能说音节。线上版没有任何自由文本输入通道，这条约束由 UI 天然保证——玩家能表达的只有"哪张图"和"哪个音节"。

### 4.4 试词期 `speak` / `guess` / `reveal`

每轮：

1. 从图卡堆翻 **6 张**新图摊开，所有人可见。
2. 当前玩家成为**命名者**，从 6 张里**秘密选定 1 张**作为目标（只有他知道是哪张）。
3. 命名者用语言区里**已有的音节**拼出一个词，**1–5 个音节**，可重复，例如 `PU-PEH-PEH`。提交后不可更改。
4. 其余玩家各自点一张自己认为的图。**指认过程中互不可见**，避免抄答案；未结算前可随时改。
5. 全部指认完毕自动结算：
   - **命中**：票数最高的那张图**唯一**且正是目标 → +1 分，目标图进入 ✅ 已理解堆。
   - **未命中**：最高票不是目标，**或者最高票并列**（说明全桌根本没谈拢）→ 目标图进入 🤔 Say What 堆。
6. 结算后暂停，**所有人**按 Continue 才进入下一轮（DEV_GUIDE「每轮结束暂停」要求）。

### 4.5 结束条件

满足任一即结束：

- 🤔 Say What 堆攒到 **2 张**（立即结束）；
- **每位玩家都当过一次命名者**（即轮数 = 人数）。

结束后展示完整语言复盘：每个音节及其名下所有图、✅/🤔 两堆、最终得分与评价。

### 4.6 Help 章节结构

Help 共 8 个 tab，其中两个是专门为了消除误解而写的：

| Tab | 作用 |
|---|---|
| 基本规则 | 靠什么赢 / 每回合做什么 / 重点，各一句 |
| 开局 | 两副牌与发牌 |
| **举个例子** | 一整局的具体走法：13 张图怎么塞进 4 个音节，🍓草莓 怎么一说就中，🏪便利店 怎么把全桌逼疯 |
| 造词期 | 提议、表决、否决、无名区 |
| 试词期 | 六张候选图、锁定目标、拼词、指认 |
| 结算与胜负 | 命中判定、平票、Say What |
| **我知道你想说啥** | 逐条回答"为什么是这样"：为什么一张图只能一个音节、为什么只有五个音节、为什么试词期的图从没见过、为什么平票算错、为什么不能打字、为什么要点两次、为什么否决两次就放弃 |
| 线上操作 | 界面怎么点 |

> 「举个例子」和「我知道你想说啥」是实测补上的：首次试玩时玩家看到"点一个音节就提交"完全无法理解规则，
> 根因是**音节是类别不是词**这件事没有任何地方讲清楚。这两章把类别系统和设计意图摊开讲。

### 4.7 评价档位

| 命中率 | 评价 |
|---|---|
| 100% | 🏆 全员完全互相听懂 |
| ≥75% | 🌟 这门语言相当可靠 |
| ≥50% | 👍 大半能沟通 |
| >0% | 🤏 勉强能猜到一点 |
| 0% | 🤔 各说各话 |

## 5. 隐藏信息与隐私

| 信息 | 可见范围 |
|---|---|
| 6 张候选图 | 全体 |
| **命名者选定的目标** | 仅命名者本人；`reveal` / `game_over` 后全体 |
| **各玩家的指认** | 仅本人（`your_guess`）；全部指认完毕进入 `reveal` 后全体 |
| 说出的词 | `speak` 提交后全体（这正是玩法核心） |
| 语言区（音节 + 名下图） | 始终全体可见 |
| 表决进度 | 全体（合作游戏，公开讨论是玩法的一部分） |

## 6. 状态与动作

### 6.1 关键状态字段

```
stage            create | speak | guess | reveal | game_over
turn / turn_index    逻辑回合与座位指针（投票、指认同属一个 turn）
sounds[]         [{id, images[]}]  已翻开音节，按翻开顺序
reserve[]        扣着的音节
table[]          造词期 13 张图
placed{}         image -> sound
unnamed[]        两次被否决的图
attempts{}       image -> 已失败次数
pending          {image, sound, votes} | None
round            试词期轮次（上限 = 人数）
communicator     当前命名者
candidates[]     本轮 6 张
target / word / guesses / result
defined[] / say_what[] / score
```

### 6.2 动作

| 动作 | 谁可以发 | 载荷 |
|---|---|---|
| `propose` | 造词期当前玩家 | `image`, `sound`（音节 id 或 `new`） |
| `vote` | 造词期非当前玩家 | `approve: bool` |
| `speak` | 命名者 | `target`, `word[]`（1–5 个音节 id） |
| `guess` | 非命名者 | `image` |
| `continue` | 全体 | — |
| `play_again` | 全体 | — |

所有动作都带 `turn` 做 stale 校验，服务端再次跑 `ACTION_SCHEMA`（房间可开 `skip_validation`）。

## 7. AI 设计

刻意做成浅策略，因此**不**加入 `game/ai_metadata.py` 的 `STRATEGIC_AI_GAME_IDS`，Select Game 不显示 🤖。理由：造一门语言本身就是这个游戏的全部内容，随机策略无法体现任何"策略"。

Bot 行为：造词期随机提议一张图到一个音节（75% 概率赞同别人）、命名时随机选目标并随机拼 1–2 个音节、指认时随机选一张。信息纪律上，bot 只读公开视图能看到的部分，测试用例 `test_a_bot_never_sees_more_than_a_human` 断言非命名者的 bot 视图里 `target` 为 `None`。

## 8. 测试计划

### 8.1 `tests/test_dadada.py`（53 个用例，纯游戏逻辑）

- **注册**：GameDefinition 元数据、schema 接受全部真实载荷、拒绝未知/缺失字段（含 `vote` 与 `sound: "new"` 这两个已删除的载荷）、config 校验、人数越界抛错、牌堆自洽（40 音节唯一、257 图卡 emoji 唯一）
- **开局**：**五个音节全部明牌且状态里不存在 `reserve`**、图卡数量对齐发行方、同 seed 复现、只有当前玩家能提议
- **造词**：提议即刻生效、**非当前玩家在造词期无事可做（没有表决）**、五个音节都能从第一回合起用、已归类的图不能重复提议、13 张图恰好 13 个回合
- **试词**：只有命名者能说、词只能用已有音节、可以串三个音节、超长词被 schema 拒、目标必须在候选里、命名者不能指认、命中/未命中、平票算失败、并列最高票算失败、改指认、结算等全员
- **结束**：全员当过一次命名者正常结束、2 张 Say What 提前结束、Play Again 需全桌且重开后仍是 5 音节明牌
- **隐私**：说之前没人看到目标、猜的时候只有命名者看到目标、指认互不可见、结算后全公开、说出的词公开
- **拒绝**：stale turn、越权、未知玩家、畸形载荷、未知音节
- **存档**：五个阶段各自 serialize/deserialize 往返、恢复后能继续玩、10 种篡改载荷被拒
- **Bot**：每个阶段都产出合法动作、非自己回合返回 None、**已指认过的 bot 必须闭嘴**、全 bot 对局 2–6 人均能终局
- **随机对局**：2–6 人 × 4 seed 跑到底无死锁、图卡守恒、日志不无限增长、视图可 JSON 序列化

### 8.2 `tests/test_dadada_room.py`（7 个用例，房间集成）

覆盖 `app.py` 的房间生命周期：目录 API、开局阶段、**1 人类 + 1/2/3 bot 全部能打到 game_over**、
按 viewer 逐个广播 `game:state`、非法动作只报错不改 `state_version`、存档往返。

### 8.3 一个只有房间层才暴露的坑

指认阶段 `get_legal_actions` 对**已经指认过的人**仍然返回 `["guess"]`，因为人类需要能改主意。
但 `app.py` 的 bot runner 每一轮只取**第一个**有合法动作的 bot，于是那个 bot 会被无限重复调用，
`room.bot_running` 永远不释放，后续 `_maybe_run_bots` 全部变成空操作，
**其余指认者再也轮不到，整轮永远无法结算**。

纯逻辑测试发现不了它（测试里一次遍历所有玩家，动作一提交就触发结算）。
修复方式：bot 策略在 `bot_id in state["guesses"]` 时返回 `None`，
把"可以改主意"这条人类特权留在 `get_legal_actions` 里。
回归用例：`test_a_bot_that_already_guessed_stops_guessing` 与
`tests/test_dadada_room.py::test_a_stalled_guess_round_is_reported`。

## 9. 无法获取的资源

1. **实体版 200 张图卡美术** —— 不可再分发，改用 257 张 emoji 自建图卡库（§3.2）。
2. **实体版规则书全文 PDF** —— 未公开，规则由 BGG 发行方简介、Pegasus 授权版描述与四篇评测交叉确认（§2）。
3. **规则书计分表的具体分档** —— pojo 只拍到"有一张计分表"，未拍清内容，改用 §4.5 的自定档位。
4. **中文版官方译名与规则用语** —— B 站视频只有简介级信息，沿用《哒哒哒》这一中文名。
