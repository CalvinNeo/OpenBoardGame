# 灵迹岛规则与机制数据来源

本次实现采用基础游戏的入门设置：1–4 位精灵、四位低复杂度精灵、平衡岛板、固定力量进阶；不使用荒芜卡、对手、情景、扩展事件或扩展标记。进阶用尽后按基础规则，从剩余的小力量或大力量中抽 4 留 1。数据含 16 张专属力量、36 张基础小力量、22 张基础大力量和 15 张基础恐惧牌。中文名称与短说明是本项目的辅助译写，不声称等同某一正式中文版本。没有收录官方美术、背景故事或完整卡文。

## 权威规则

- [Greater Than Games 的 Spirit Island 页面](https://shop.greaterthangames.com/products/spirit-island)提供规则书和 Wiki 入口；它确认基础版为 1–4 人。
- [发行商链接的基础规则书](https://www.dropbox.com/scl/fi/5wzghwnbsi39msyy6vvox/Spirit-Island-CORE-Rulebook.pdf?dl=0&rlkey=86i7aofqbzhulezjr7z0ssyff&st=iqv6wpml)：第 3 页入门模式，第 6–7 页设置与平衡板示例，第 8–12 页轮次和入侵者，第 13–19 页精灵、力量、恐惧与荒芜。
- [官方 FAQ：设置时额外加入 1 荒芜](https://querki.net/raw/darker/spirit-island-faq/one-more-blight-errata)：无荒芜卡模式的初始荒芜池是 `5 × 玩家数 + 1`，不是 `5 × 玩家数`。地图上的初始荒芜来自盒外供应，不扣此池。
- [官方 FAQ：Setup](https://querki.net/raw/darker/spirit-island-faq/Setup)：初始探索属于设置；印刷图示的初始荒芜不消耗池；使用平衡岛板，板块可按合法边缘连接。
- [官方 FAQ：Repeat](https://querki.net/raw/darker/spirit-island-faq/Repeat)：重复力量不会再次获得牌边元素；重复时忽略任何重复指令。Powerstorm 的门槛授予三张不同牌各一次重复机会，不能循环获得重复次数。
- [官方 FAQ：恐惧牌引起的新恐惧牌](https://querki.net/raw/darker/spirit-island-faq/.3y28aus)：新赚到的牌加入当前恐惧结算的末尾，同一入侵阶段继续结算；恐怖等级升级立即影响后续牌。
- [官方 FAQ：全岛持续效果](https://querki.net/raw/darker/spirit-island-faq/do-island-wide-effects-check-land-contents-at-resolution)与 [Encompassing Ward 勘误](https://querki.net/raw/darker/spirit-island-faq/.7w4ganu)：全岛恐惧牌的达汉、存在等条件在实际动作时检查；单地力量的防御通常在力量结算时确定。Encompassing Ward 随目标精灵存在的位置动态提供防御。
- [官方 FAQ：Entwined Power](https://querki.net/raw/darker/spirit-island-faq/Entwined%2BPower)：共享存在只用于力量目标与距离；单人对自己使用仍获两张牌，门槛获 6 能量；每张获得的大力量各要求遗忘一张，赠送不要求遗忘。结算中遗忘自身会立即失去牌边元素，继续结算时重新检查门槛。
- [官方数字版更新说明](https://store.steampowered.com/news/posts/?appids=1236720&enddate=1699898745&feed=steam_community_announcements)：可从两种牌堆任选的通常获得力量效果采用固定进阶；公告明确排除 Entwined Power。Gift of Power 指定小力量，不属于任选牌堆效果。本项目据此让这两张牌正常抽牌。
- [官方 FAQ：Blazing Renewal](https://querki.net/raw/darker/spirit-island-faq/Blazing%2BRenewal)：门槛为额外分配 4 伤害，且没有被摧毁的存在可以放回时，不能只使用门槛造成伤害。其文本距离由施放者存在量起。
- [官方 FAQ：Push](https://querki.net/raw/darker/spirit-island-faq/Push)及[设计者对 Dissolve the Bonds of Kinship 的解释](https://forums.greaterthangames.com/t/errata-question/18546/19)：该牌必须把探索者推到尽可能多的不同邻地，超出邻地数的剩余探索者不必均分。

## 数值转录与交叉检查

[Spirit Island Wiki](https://spiritislandwiki.com/)由发行商官网链接，属于社区维护的资料站，不应误称发行商的最终裁定渠道。本次直接访问部分详情页返回 403，因此从 [Spirit Island Mastery 的公开 Wiki 抓取记录](https://github.com/bfowle/spirit-island/tree/main/data)核对事实字段；该缓存保留原始 Wiki 模板，采用时只提取机制字段，没有复制其策略文字或实现代码。

- [四位精灵缓存](https://github.com/bfowle/spirit-island/tree/main/data/references/wiki)：成长、初始设置、轨道、天赋门槛、七张力量进阶。
- [平衡岛板 A–D 缓存](https://github.com/bfowle/spirit-island/tree/main/data/boards)：各地形、本板邻接、沿海属性和初始达汉／建筑／荒芜。所有扩展标记均排除。
- [牌组缓存](https://github.com/bfowle/spirit-island/tree/main/data/decks)：筛选基础版的 `minor.json`、`major.json`、`unique.json`、`fear.json`；其余扩展牌不参与。
- [Lightning 交叉检查](https://seesaawiki.jp/privatedesktopgame/d/LightningsSwiftStrike)、[River 交叉检查](https://seesaawiki.jp/privatedesktopgame/d/RiverSurgesInSunlight)、[Earth 交叉检查](https://seesaawiki.jp/privatedesktopgame/d/VitalStrengthOfTheEarth)、[Shadows 交叉检查](https://seesaawiki.jp/privatedesktopgame/d/ShadowsFlickerLikeFlame)。这些是社区转录，仅作交叉核对，不覆盖官方 FAQ。

核对时发现缓存将 The Land Thrashes in Furious Pain 的目标错误标为达汉，已改为有荒芜的土地。[Horizons 官方规则书中的重复说明](https://meepletron-storage.s3.us-east-2.amazonaws.com/resources/horizon-of-spirit-island-rulebook.pdf)明确说明，其门槛重复才忽略目标地的荒芜要求。Drought 确实摧毁 3 个村镇，然后对每个村镇／城市造成 1 伤害，不能误写成摧毁探索者。

本板之外的连边不是根据缓存猜测：按上述发行商基础规则书第 6–7 页的示例地图放大核图，固定为单人 A、双人 A/C、三人 B/C/D、四人 A/B/C/D。`BOARD_LAYOUTS` 与 `CROSS_BOARD_EDGES` 明确保存所用地图，包括接角邻接；客户端可用不同的示意布局显示，但合法性只依据这些连接。

地图重绘时再次核对三人示例：C7、C8 接触 D 板右上方的沙地 D4，原先误记为左侧带初始村镇的沙地 D7；已修正这两条连边并加入回归断言。四人中央 A7/B8/C4/D8 共角，两对对角土地也相邻，因此不能只用共享长边判断。

## 关键规则实现约定

- 每人恐惧池 4；基础恐惧牌随机取 9 张，3/3/3 分隔。获得第 3、6 张时立即升级恐怖等级，获得最后一张时恐惧胜利。
- 入侵牌按阶段 I 取 3、II 取 4、III 取 5；设置结束进行一次探索，第一轮没有蹂躏。无对手时阶段 II 的升级符号没有额外效果。
- 探索需同地或邻地有村镇／城市，或目标地沿海；探索者本身不是来源。建造要求当地有入侵者，村镇多于城市时造城市，否则造村镇。
- 蹂躏对土地和达汉同时计算同一伤害；土地受到至少 2 伤害加 1 荒芜，达汉每 2 生命损失一个，存活者每个反击 2。防御同时降低两类伤害。
- 荒芜会摧毁当地每位精灵各 1 存在；已有荒芜时向玩家所选的一块邻地连锁，不能扩散到所有邻地。
- 元素用于检查门槛，不消耗。力量按牌文顺序尽量结算；明确写“改为”的天赋档位替代旧效果。
- [The Trees and Stones Speak of War 的门槛](https://querki.net/raw/darker/spirit-island-faq/.bu6ocxq)每推离一个达汉移动防御 2；该力量完成后再被其他效果移动的达汉不继续携带这份防御。
- `energy_track` / `plays_track` 的索引 0 为最初露出格；River 出牌轨索引 4 解锁每轮收回 1 张弃牌，该格继续提供 3 次出牌。
- 移除与替换不产生摧毁建筑的恐惧；摧毁村镇产生 1、城市产生 2。满伤害单位立即摧毁，其他伤害在时间流逝时恢复。
