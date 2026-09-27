# 世界巡游（澳洲）牌表与规则数据来源

核对日期：2026-09-22。对应实现：`game/boomerang_australia_data.py`。

## 来源与核对范围

1. [Grail Games 官方游戏页面](https://www.grailgames.games/our-games/boomerang-australia)：确认采用 **Boomerang: Australia（2020）**，作者 Scott Almes，2–4 人；不是 Boomerang: Europe 或 Boomerang: USA。
2. [官方规则书](https://www.grailgames.games/s/Boomerang_Rules_12pp_WEBVIEW.pdf)：计分和轮次规则。也可查看 [同版规则书镜像](https://cdn.1j1ju.com/medias/f9/c5/91-boomerang-australia-rulebook.pdf)。
3. [官方额外记分表](https://www.grailgames.games/s/score-card.jpg)：目视核对七个地区的字母分组、最后两张牌使用 `@`、`#`，以及活动计分表。其直接文件地址为 [官方 Squarespace 图片](https://static1.squarespace.com/static/62e17bf47de1842f5a971df9/t/6593682e1b138e19218f7d92/1704159286771/score+card+.jpg)。
4. [官方八张牌例](https://images.squarespace-cdn.com/content/v1/62e17bf47de1842f5a971df9/ffad47ff-dbff-4105-bdc8-78fd75fe5a43/card%2Bexamples.jpg)：逐项核对 A、O、K、W、I、S、E、@ 的地点、地区、数字、收集物、动物、活动，均与实现一致；其中 `@` 明确为 Port Arthur。
5. [完整 28 张公开数据表 A](https://github.com/mohammed-shakir/BoomerangAustralia/blob/2dc89aeaa51a20e71c11469e572c6e35590d5d89/resources/australia/cards.json)：地点英文名、数字与图标的逐张数据来源。固定版本 `2dc89aeaa51a20e71c11469e572c6e35590d5d89`。
6. [完整 28 张公开数据表 B](https://github.com/WarsayMaharena/BoomerangAustralia/blob/4e1077e5973c99d2038e447bdd19a73c72234588/src/Cards.json)：交叉比对；标准化字段名称后，28 张牌的数字、收集物、动物、活动及地点名全部一致。固定版本 `4e1077e5973c99d2038e447bdd19a73c72234588`。这两份为公开实现的数据，并非出版社发布的完整牌表，不能视为两次独立的实物核验。
7. [Board Game Arena 游戏说明](https://en.boardgamearena.com/gamepanel?game=boomerangaustralia)：比对整副牌的数量分布。该页面的活动分值短摘要与详细规则矛盾，故该处以官方记分表为准。

完整牌表有可追溯数据来源；官方图片直接核验了其中八张及全部地区分组。未以地理或动物生态常识修改卡上的图标：原规则书明确说明部分地点与动物组合服务于游戏设计，并非自然教育资料。

## 数据标准化

- 公开实现中的 `*`（Port Arthur）映射为实物的 `@`；`-`（Richmond）映射为实物的 `#`。
- 上游数据表 A 的 `New South Whales` 是拼写错误；按官方牌例及数据表 B，使用 `New South Wales`。
- 中文地点名、地区名是本项目的显示译名，不宣称来自官方中文版。英文名保留来源表的名称。
- 空图标统一为 Python `None`；收集物、动物、活动使用稳定英文 ID。
- `CARDS` 是以牌面字母为键的字典，每张含 `id`、`name`、`name_zh`、`region`、`number`、`collection`、`animal`、`activity`。
- `REGIONS` 是以 `wa / nt / qld / sa / nsw / vic / tas` 为键的字典，各含英文名 `name`、中文名 `name_zh` 和四张牌的 `cards`。
- 不存储、分发原版商业卡牌美术；代码仅记录玩法必需的事实数据。核验用下载文件位于临时目录，不加入项目。

## 已确认的计分常量

| 类型 | 符号 | 分值 |
| --- | --- | ---: |
| 收集物 | `leaf` 树叶 | 1 |
| 收集物 | `flower` 野花 | 2 |
| 收集物 | `shell` 贝壳 | 3 |
| 收集物 | `souvenir` 纪念品 | 5 |
| 动物（一对） | `kangaroo` 袋鼠 | 3 |
| 动物（一对） | `emu` 鸸鹋 | 4 |
| 动物（一对） | `wombat` 袋熊 | 5 |
| 动物（一对） | `koala` 考拉 | 7 |
| 动物（一对） | `platypus` 鸭嘴兽 | 9 |

活动有 `swimming`（游泳）、`bushwalking`（徒步）、`culture`（原住民文化）、`sightseeing`（观光）。官方记分表明确为：

| 同类活动数量 | 0 | 1 | 2 | 3 | 4 | 5 | 6 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 分数 | 0 | 0 | **2** | 4 | 7 | 10 | 15 |

因此 `ACTIVITY_POINTS = (0, 0, 2, 4, 7, 10, 15)`。BGA 短摘要写的“两图标 1 分”与官方记分表不一致，未采用。

## 全牌数量核验

| 检查项 | 核对结果 |
| --- | --- |
| 总数与唯一 ID | 28 张；A–Z、@、# 各一张 |
| 地区 | 西澳 A–D、北领地 E–H、昆士兰 I–L、南澳 M–P、新南威尔士 Q–T、维多利亚 U–X、塔斯马尼亚 Y/Z/@/#；每区 4 张 |
| 数字 | 西澳 1、维多利亚 2、南澳 3、北领地 4、新南威尔士 5、昆士兰 6、塔斯马尼亚 7；每个数字 4 张 |
| 活动 | 四种活动各 6 张，4 张无活动 |
| 收集物 | 树叶 5、野花 4、贝壳 3、纪念品 1，15 张无收集物 |
| 动物 | 袋鼠 5、鸸鹋 5、袋熊 4、考拉 3、鸭嘴兽 2，9 张无动物 |

## 核验文件 SHA-256

记录校验和便于复核上游页面今后是否变化；文件未打包进仓库。

| 文件 | SHA-256 |
| --- | --- |
| 数据表 A `cards.json` | `edbbc44231889d34b16643bbb3bf8b6e03b8c57008df5d27a429a699bab1371d` |
| 数据表 B `Cards.json` | `6f2fb89f3e7c92e166e3451f08b25395aaa588995922f3d9352f1e7e5eb1481a` |
| 官方记分表 | `492c5759b67c5c3ca6e45026b1393d750e99beb0e809b970c3668d4e2c973f84` |
| 官方八张牌例 | `bf69fd0674a8729bd86db1825d867f8d5b3ac2caee24779a5b976573785c9947` |
