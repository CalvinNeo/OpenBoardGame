# Ark Nova zoo maps

房间的 Zoo maps 设置默认是 **Everyone uses Map 0**，沿用原来的开局流程。
选择 **Each player chooses** 后，每位玩家先确认自己的地图，再选择起始手牌；
可选地图 0 和以下六张地图，允许多位玩家选择相同地图。选图状态随游戏存档保存。

本次采用官方替代版 **1A–6A**，不是原版 1–6 的地形。每张图都使用自己的水域、
岩石、Build II 区域、覆盖奖励、保护项目奖励和协会里程碑。

| 编号 | 地图 | 特殊能力 |
| --- | --- | --- |
| 1A | 瞭望塔 / Observation Tower | 邻接瞭望塔的标准围栏翻到占用面时额外获得 2 吸引力。 |
| 2A | 户外区域 / Outdoor Areas | 邻接户外区域的标准围栏有效容量增加 2，释放动物时也适用。 |
| 3A | 银湖 / Silver Lake | 银湖周围指定的 11 个陆地格各提供 2 金钱的覆盖奖励；部分格同时要求 Build II。 |
| 4A | 商业港口 / Commercial Harbor | 覆盖 A6 后，每回合可以弃置一张手牌换取 3 金钱，不移动行动牌；休息期间不能使用。 |
| 5A | 公园餐厅 / Park Restaurant | 每次休息时，每个邻接餐厅且已覆盖的格子提供 1 金钱，空围栏也计入。 |
| 6A | 研究所 / Research Institute | 覆盖 A6 后，打出动物牌可忽略一个条件图标；不忽略水域或岩石条件，可与 WAZA 大型动物计划叠加。 |

保护项目奖励还包括：瞭望塔的付费打出赞助商收入、银湖的额外行动、商业港口的大学、
公园餐厅的免费特殊围栏，以及研究所的两次移动行动牌到第 1 格。
所有建造仍遵守地图连接、地形、Build II 和建筑数量限制。
其中免费特殊围栏奖励可以在 Build I 时建造爬行动物馆或大型鸟舍，但仍不能覆盖地图的 II 格。

浏览其他玩家时，地图及 Info 内容会切换到该玩家的图。
Help/Explain 包含选图和港口说明；地图格和奖励可以悬停或点击查看说明。

## Sources

- [Feuerland: official alternate zoo maps 1A–8A](https://www.feuerland-spiele.de/fileadmin/game/Arche_Nova/ArcheNova_ZooMap_Alternate_1_8a_DE_Web.pdf), pages 2–7.
- [Official Ark Nova Glossary](https://cdn.shopify.com/s/files/1/0947/3907/1278/files/Ark-Nova-Glossary.pdf), Advanced Zoo Map Clarifications, page 8.
- [Feuerland official FAQ v4](https://www.feuerland-spiele.de/fileadmin/game/Arche_Nova/Arche_Nova_FAQ_V4_DE_low.pdf), page 2: free special enclosures do not require the upgraded Build card.

SVG 是本项目绘制的矢量图，没有嵌入官方地图图片。
每张地图的 `map*.source.json` 保存逐格转录的数据和来源页码，运行以下命令同步运行时 JSON 和 SVG：

```powershell
1..6 | ForEach-Object {
    python scripts/gen_arknova_map_svg.py "designs/ark_nova/map${_}a.source.json" "game/assets/ark_nova/map${_}a.json" "static/assets/ark_nova/map${_}a.svg"
}
```

`game/ark_nova_maps.py` 提供按玩家选择的地图查询规则的公共辅助函数。
地图专用回归测试在 `tests/test_ark_nova_maps.py`，双人浏览器流程在
`tests/ark_nova_maps.browser.cjs`。
