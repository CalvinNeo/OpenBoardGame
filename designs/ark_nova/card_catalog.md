# 方舟动物园基础版卡牌与能力目录

> 机器数据位于 `game/assets/ark_nova/`。本目录只整理规则与数值，不包含商业卡图。

## 口径

- 内容牌共 235 张：动物 128、赞助商 64、保育项目 32、终局计分 11。另列出 5 类基础行动牌的 I/II 面。
- 243–257 号赞助商的 15 块独特建筑已按地图 0 同款 flat-top 轴向坐标录入；允许六向旋转，但彩色面必须朝上，因此不能镜像。
- `immediate` 在卡牌结算时执行；`after_action` 等整个动物行动结束再执行；`during_placement` 在安置动物步骤执行；`setup_and_passive` 打出时先放标记并继续保留持续规则；`passive` 监听之后的事件；`income` 在休息收入阶段执行；`endgame` 在最终计分时执行。
- `cascade` 字段明确会继续触发什么：额外行动、移动行动牌、再打动物/赞助商、免费建造或额外放置奖励；`none` 表示只结算当前效果。
- 卡牌会为自己的效果提供图标；双图标计两次。左侧打出条件不算图标，卡牌右上图标、合作动物园、大学以及临水/临岩要求才计入。
- 动物金币费用还会受到同洲合作动物园影响：每个匹配的大洲图标减 3 金币。展示区直接打出动物/赞助商需要升级对应行动，并额外支付文件夹编号。

## 基础行动牌

| 行动 | I 面 | II 面 |
|---|---|---|
| 卡牌 | 先推进休息2格。强度1–5依次抽/弃：1/1、1/0、2/1、2/0、3/1；强度5可改为精准拿牌。 | 先推进休息2格。强度1–5依次抽/弃：1/0、2/1、2/0、3/1、4/1；强度3–5可精准拿牌；可从声望范围抽牌并可越过声望9。 |
| 建造 | 建造恰好1个建筑，面积不超过行动强度，每格2金币；可建标准围栏、贩售亭、休憩亭和萌宠馆。 | 建造一个或多个不同建筑，总面积不超过行动强度，每格2金币；新增可建大型鸟舍和爬虫馆。 |
| 动物 | 只能从手牌打动物；强度1–5最多打0、1、1、1、2张。 | 可从手牌或声望范围打动物，展示牌额付文件夹金币；强度1–5最多打1、1、2、2、2张；强度5先得1声望。 |
| 协会 | 执行恰好1项协会任务，任务强度不超过行动强度。 | 执行一项或多项不同任务，总强度不超过行动强度；至少执行1项任务后可捐赠1次；可从声望范围打保育项目并支付文件夹金币。 |
| 赞助商 | 从手牌打恰好1张强度不超过X的赞助商；或推进休息X格并得X金币。 | 从手牌/声望范围打一张或多张赞助商，总强度不超过X+1，展示牌额付文件夹金币；或推进休息X格并得2X金币。 |

## 能力词典（45 项）

| key | 中文 / 英文 | 时机 | 级联类型 | 规则摘要 | 关键例外 |
|---|---|---|---|---|---|
| `sprint` | 疾跑 / Sprint | immediate | draw_cards | 从牌库抽取N张牌。 | — |
| `pack` | 群居 / Pack | immediate | scaling_reward | 按自己动物园中的食肉类图标数，每个获得1吸引力；本牌图标也计入。 | — |
| `hunter` | 狩猎 / Hunter | immediate | reveal_and_choose | 展示牌库顶N张牌，至多保留其中1张动物牌，其余弃掉。 | 若没有动物牌，全部弃掉。 |
| `clever` | 机灵 / Clever | after_action | reposition_action | 完成整个动物行动后，可将任意1张行动牌移到槽位1。 | — |
| `boost_association` | 推动：协会 / Boost: Association | after_action | reposition_action | 完成动物行动后，可将协会行动牌移到槽位1或5。 | — |
| `boost_building` | 推动：建造 / Boost: Build | after_action | reposition_action | 完成动物行动后，可将建造行动牌移到槽位1或5。 | — |
| `boost_cards` | 推动：卡牌 / Boost: Cards | after_action | reposition_action | 完成动物行动后，可将卡牌行动牌移到槽位1或5。 | — |
| `boost_sponsors` | 推动：赞助商 / Boost: Sponsors | after_action | reposition_action | 完成动物行动后，可将赞助商行动牌移到槽位1或5。 | — |
| `boost_animal` | 推动：动物 / Boost: Animals | after_action | reposition_action | 完成动物行动后，可将动物行动牌移到槽位1或5。 | — |
| `action_association` | 行动：协会 / Action: Association | after_action | extra_specific_action | 完成动物行动后，按协会牌当前槽位、升级面和修正正常执行一次协会行动。 | 必须执行指定行动，不能改做获得X标记的替代行动。 |
| `action_building` | 行动：建造 / Action: Build | after_action | extra_specific_action | 完成动物行动后，按建造牌当前槽位、升级面和修正正常执行一次建造行动。 | 必须执行指定行动，不能改做获得X标记的替代行动。 |
| `action_cards` | 行动：卡牌 / Action: Cards | after_action | extra_specific_action | 完成动物行动后，按卡牌牌当前槽位、升级面和修正正常执行一次卡牌行动。 | 必须执行指定行动，不能改做获得X标记的替代行动。 |
| `action_sponsors` | 行动：赞助商 / Action: Sponsors | after_action | extra_specific_action | 完成动物行动后，按赞助商牌当前槽位、升级面和修正正常执行一次赞助商行动。 | 必须执行指定行动，不能改做获得X标记的替代行动。 |
| `inventive` | 创造力 / Inventive | immediate | gain_x_tokens | 获得N枚X标记，上限仍为5。 | — |
| `inventive_bear` | 创造力：熊 / Inventive: Bear | immediate | scaling_reward | 按所有动物园中的熊类图标获得X标记，最多3枚。 | — |
| `inventive_primate` | 创造力：灵长类 / Inventive: Primates | immediate | threshold_reward | 自己有1/3/5个灵长类图标时，分别获得1/2/3枚X标记。 | — |
| `full_throated` | 呼唤 / Full-throated | immediate | hire_worker | 从个人板最低的协会事务员储存位雇佣1名事务员。 | 若已全部雇佣则无效果。 |
| `jumping` | 跳跃 / Jumping | immediate | advance_break | 将休息标记推进N格并获得N金币。 | 若到达最后一格，先得1枚X标记，回合结束后再结算休息。 |
| `multiplier_association` | 双重：协会 / Multiplier: Association | immediate | future_multi_action | 在协会行动牌上放1枚双倍标记；下次执行时，每枚标记都让该行动以相同强度多执行一次。 | 多枚双倍标记可以叠加。；X标记只增强其中一次子行动；全部子行动完成后才处理“行动后”效果和休息。；使用后或下次休息时归还。 |
| `multiplier_building` | 双重：建造 / Multiplier: Build | immediate | future_multi_action | 在建造行动牌上放1枚双倍标记；下次执行时，每枚标记都让该行动以相同强度多执行一次。 | 多枚双倍标记可以叠加。；X标记只增强其中一次子行动；全部子行动完成后才处理“行动后”效果和休息。；使用后或下次休息时归还。 |
| `multiplier_cards` | 双重：卡牌 / Multiplier: Cards | immediate | future_multi_action | 在卡牌行动牌上放1枚双倍标记；下次执行时，每枚标记都让该行动以相同强度多执行一次。 | 多枚双倍标记可以叠加。；X标记只增强其中一次子行动；全部子行动完成后才处理“行动后”效果和休息。；使用后或下次休息时归还。 |
| `multiplier_sponsors` | 双重：赞助商 / Multiplier: Sponsors | immediate | future_multi_action | 在赞助商行动牌上放1枚双倍标记；下次执行时，每枚标记都让该行动以相同强度多执行一次。 | 多枚双倍标记可以叠加。；X标记只增强其中一次子行动；全部子行动完成后才处理“行动后”效果和休息。；使用后或下次休息时归还。 |
| `iconic_animal` | 标志性动物 / Iconic Animal | immediate | global_scaling_reward | 按所有动物园中指定大洲图标的总数获得吸引力，最多8。 | — |
| `sun_bathing` | 日光浴 / Sunbathing | immediate | discard_for_money | 最多卖出N张手牌，每张获得4金币并置入弃牌堆。 | — |
| `pouch` | 育儿袋 / Pouch | immediate | tuck_cards | 最多把N张手牌压在本牌下，每张获得2吸引力。 | 压在牌下的牌不再有任何功能；放归该动物时一并弃掉且不失去这部分吸引力。 |
| `resistance` | 抵抗 / Resistance | immediate | gain_final_scoring_card | 抽2张终局计分牌，保留1张、弃1张。 | 达到10保育时可从自己所有终局计分牌中任选1张弃掉；终局结算其余全部。 |
| `assertion` | 执着 / Assertion | immediate | fetch_base_project | 从未使用的基础保育项目中任选1张加入手牌，之后可按通常规则打到协会板上方。 | — |
| `digging` | 刨挖 / Digging | immediate | repeatable_choice | 依次选择最多N次：弃展示区1张并立刻补牌，或弃手牌1张后从牌库抽1张。 | — |
| `sponsor_magnet` | 招商 / Sponsor Magnet | immediate | take_display_cards | 把展示区内全部赞助商牌加入手牌；忽略声望范围，回合结束时再补展示区。 | — |
| `flock_animal` | 群集动物 / Flock Animal | during_placement | shared_enclosure | 可与已在园内、所需围栏尺寸至少为N的食草动物共享其已占用围栏；否则仍可正常占用围栏。 | 同一只食草动物可承载多只群集动物。 |
| `venom` | 毒液 / Venom | immediate | opponent_action_debuff | 每名吸引力至少5且在你之前的玩家获得N枚毒液标记，依次放到其最低且未放毒液的行动牌上。 | 同一行动牌不能有两枚毒液。；使用中毒行动时移除其毒液；若回合结束仍未移除任何毒液，须支付2金币。；把中毒行动牌用于获得X标记的替代行动也会移除毒液（已持有5枚X而无法执行时除外）。；休息时移除全部毒液。 |
| `dominance` | 支配 / Dominance | immediate | fetch_specific_base_project | 若指定动物类目的基础保育项目未在游戏中，将它加入手牌。 | — |
| `pilfering_1` | 偷窃1 / Pilfering 1 | immediate | opponent_choice_loss | 吸引力最高且至少为5的目标选择：给你5金币，或让你随机拿其1张手牌。 | 并列目标由你选择；目标缺少一种资源时只能给另一种。 |
| `pilfering_2` | 偷窃2 / Pilfering 2 | immediate | opponent_choice_loss_twice | 依次对吸引力最高的玩家和保育最高的玩家各结算一次偷窃；保育目标须至少有1保育。 | 若两次命中同一玩家，也要依次结算；该玩家第二次可以改选另一种损失。 |
| `snapping_1` | 捕捉1 / Snapping 1 | immediate | take_display_card | 从展示区任选1张牌加入手牌，忽略声望范围；回合结束时补展示区。 | — |
| `snapping_2` | 捕捉2 / Snapping 2 | immediate | take_display_card_twice | 依次从展示区任选1张牌两次；可选择在两次之间补牌。 | — |
| `constriction` | 缠绕 / Constriction | immediate | opponent_action_debuff | 每名至少有5吸引力的玩家，每有一条计分轨领先你便获得1枚缠绕，放到其最高且未放缠绕的行动牌上；该牌本次强度-2。 | 结算顺序可放在本动物印刷吸引力之前或之后。；同一行动牌不能有两枚缠绕；双倍行动的每个子行动都减2。；缠绕牌到槽位1/2时可能变成-1/0，须用足够X标记升到至少1，或改做获得X标记的替代行动。；行动结算后移除该标记；休息时移除所有剩余标记。 |
| `hypnosis` | 催眠 / Hypnosis | after_action | borrow_opponent_action | 完成动物行动后，选择吸引力最高且至少为5的玩家槽位1、2或3的一张行动牌，按该玩家的升级面执行并把该牌移到槽位1。 | 可用自己的X标记；目标牌上的毒液/缠绕生效。；不能使用双倍标记。；独特建筑能否覆盖个人板的建造II格，仍看自己的建造牌是否升级。；若目标是自己则无效。 |
| `scavenging` | 食腐 / Scavenging | immediate | draw_from_discard | 将弃牌堆面朝下洗匀，随机抽N张，保留1张并弃掉其余。 | — |
| `posturing` | 姿态 / Posturing | immediate | free_build | 最多N次免费放置1个贩售亭或休憩亭，仍遵守通常放置规则。 | — |
| `perception_2` | 洞察力2 / Perception 2 | immediate | draw_and_keep | 从牌库抽2张，保留1张并弃1张。 | — |
| `perception_4` | 洞察力4 / Perception 4 | immediate | draw_and_keep | 从牌库抽4张，保留2张并弃2张。 | — |
| `determination` | 果断 / Determination | after_action | extra_any_action | 完成动物行动后，任选另一张行动牌正常执行一次，并按通常规则移动。 | 与指定的“行动：X”不同，果断允许选择获得X标记的替代行动。 |
| `peacocking` | 炫耀 / Peacocking | immediate | free_special_enclosure | 如可能，免费放置大型鸟舍；无需建造行动II，但仍遵守放置规则。 | — |
| `petting_zoo_animal` | 萌宠动物 / Petting Zoo Animal | immediate | scaling_reward | 按自己园内萌宠类图标总数，每个获得3吸引力；因此第1/2/3只分别令总收益增加3/6/9。 | 只能拥有1座萌宠馆，因此通常最多容纳3只。；萌宠动物也算小型动物。 |

## 动物牌（128 张）

| ID | 名称 | 金币 | 围栏 / 邻接 | 打出条件 | 图标 | 印刷收益 | 能力（时机） |
|---|---|---:|---|---|---|---|---|
| 401 | 猎豹<br>CHEETAH | 17 | standard:5 | 无 | predator×2、africa×1 | appeal +6 | 疾跑[immediate] |
| 402 | 狮子<br>LION | 16 | standard:4 | predator≥3 | predator×1、africa×1 | appeal +9 | 群居[immediate] |
| 403 | 花豹<br>LEOPARD | 20 | standard:3；rock≥1 | partner_zoo≥1 | predator×1、africa×1 | appeal +7、conservation +1 | 狩猎[immediate] |
| 404 | 狞猫<br>CARACAL | 9 | standard:2 | 无 | predator×1、africa×1 | appeal +4 | 狩猎[immediate] |
| 405 | 耳廓狐<br>FENNEC FOX | 8 | standard:1 | 无 | predator×1、africa×1 | appeal +3 | 机灵[after_action] |
| 406 | 西伯利亚虎<br>SIBERIAN TIGER | 30 | standard:5 | asia≥3 | predator×1、asia×1 | appeal +10、conservation +2、reputation +1 | — |
| 407 | 苏门答腊虎<br>SUMATRAN TIGER | 26 | standard:4；water≥2 | science≥2 | predator×1、asia×1 | appeal +8、conservation +2、reputation +1 | — |
| 408 | 懒熊<br>SLOTH BEAR | 14 | standard:3 | 无 | predator×1、bear×1、asia×1 | appeal +6 | 推动：协会[after_action] |
| 409 | 马来熊<br>SUN BEAR | 16 | standard:2 | partner_zoo≥1 | predator×1、bear×1、asia×1 | appeal +5 | 行动：协会[after_action] |
| 410 | 黄喉貂<br>YELLOW-THROATED MARTEN | 7 | standard:1 | 无 | predator×1、asia×1 | appeal +3 | 狩猎[immediate] |
| 411 | 灰棕熊<br>GRIZZLY BEAR | 22 | standard:5 | predator≥2、animals II | predator×1、bear×1、americas×1 | appeal +9 | 创造力：熊[immediate]；呼唤[immediate] |
| 412 | 美洲豹<br>JAGUAR | 16 | standard:4 | americas≥1 | predator×1、americas×1 | appeal +8 | 狩猎[immediate] |
| 413 | 美洲狮<br>COUGAR | 10 | standard:3；rock≥1 | 无 | predator×1、americas×1 | appeal +5 | 跳跃[immediate] |
| 414 | 南浣熊<br>SOUTH AMERICAN COATI | 11 | standard:2；rock≥1 | 无 | predator×1、bear×1、americas×1 | appeal +4 | 创造力[immediate] |
| 415 | 北美浣熊<br>RACCOON | 11 | standard:1 | 无 | predator×1、bear×1、americas×1 | appeal +4 | 推动：协会[after_action] |
| 416 | 普通棕熊<br>EURASIAN BROWN BEAR | 20 | standard:5；water≥1 | bear≥1、animals II | predator×1、bear×1、europe×1 | appeal +8 | 双重：协会[immediate]；呼唤[immediate] |
| 417 | 狼<br>WOLF | 12 | standard:4 | 无 | predator×1、europe×1 | appeal +4 | 群居[immediate] |
| 418 | 猞猁<br>EURASIAN LYNX | 11 | standard:3 | europe≥2 | predator×1、europe×1 | appeal +2 | 标志性动物[immediate] |
| 419 | 欧洲獾<br>EUROPEAN BADGER | 5 | standard:2 | 无 | predator×1、europe×1 | appeal +3 | 推动：动物[after_action] |
| 420 | 白鼬<br>STOAT | 4 | standard:1 | europe≥1 | predator×1、europe×1 | appeal +3 | 狩猎[immediate] |
| 421 | 新澳海狗<br>NEW ZEALAND FUR SEAL | 17 | standard:5；water≥1, rock≥1 | animals II | predator×1、australia×1 | appeal +8 | 呼唤[immediate] |
| 422 | 澳海狮<br>AUSTRALIAN SEA LION | 18 | standard:4；water≥1 | partner_zoo≥1 | predator×1、australia×1 | appeal +7、conservation +1 | 日光浴[immediate] |
| 423 | 新西兰海狮<br>NEW ZEALAND SEA LION | 17 | standard:3；water≥1 | 无 | predator×1、australia×1 | appeal +6 | 群居[immediate] |
| 424 | 澳洲野犬<br>AUSTRALIAN DINGO | 13 | standard:2 | 无 | predator×1、australia×1 | appeal +3 | 群居[immediate] |
| 425 | 袋獾<br>TASMANIAN DEVIL | 11 | standard:1 | science≥1 | predator×1、australia×1 | appeal +4、reputation +1 | 育儿袋[immediate] |
| 426 | 非洲草原象<br>AFRICAN BUSH ELEPHANT | 36 | standard:5 | animals II | herbivore×1、africa×2 | appeal +10、reputation +1 | 抵抗[immediate] |
| 427 | 白犀牛<br>WHITE RHINOCEROS | 24 | standard:4；rock≥1 | science≥1 | herbivore×1、africa×1 | appeal +9 | 执着[immediate] |
| 428 | 长颈鹿<br>GIRAFFE | 16 | standard:3 | 无 | herbivore×1、africa×1 | appeal +7 | 推动：赞助商[after_action] |
| 429 | 细纹斑马<br>GREVY'S ZEBRA | 12 | standard:2 | africa≥3 | herbivore×1、africa×1 | appeal +6、reputation +1 | 推动：赞助商[after_action]；群集动物[during_placement] |
| 430 | 倭河马<br>PYGMY HIPPOPOTAMUS | 15 | standard:2；water≥1 | partner_zoo≥1 | herbivore×1、africa×1 | appeal +6 | 行动：赞助商[after_action] |
| 431 | 亚洲象<br>ASIAN ELEPHANT | 33 | standard:5；water≥1 | animals II | herbivore×1、asia×2 | appeal +8、conservation +1 | 抵抗[immediate] |
| 432 | 印度犀<br>INDIAN RHINOCEROS | 25 | standard:4 | animals II | herbivore×1、asia×1 | appeal +9 | 执着[immediate] |
| 433 | 大熊猫<br>GIANT PANDA | 27 | standard:3 | herbivore≥1、bear≥1、partner_zoo≥1 | herbivore×1、bear×1、asia×1 | appeal +10、conservation +2、reputation +1 | — |
| 434 | 小熊猫<br>RED PANDA | 16 | standard:2 | science≥2 | herbivore×1、bear×1、asia×1 | appeal +6 | 双重：赞助商[immediate] |
| 435 | 亚洲貘<br>MALAYAN TAPIR | 17 | standard:2 | 无 | herbivore×1、asia×1 | appeal +5、reputation +1 | 刨挖[immediate] |
| 436 | 美洲野牛<br>AMERICAN BISON | 18 | standard:5 | americas≥3 | herbivore×1、americas×2 | appeal +4 | 标志性动物[immediate] |
| 437 | 麝牛<br>MUSKOX | 13 | standard:4 | americas≥1 | herbivore×1、americas×1 | appeal +5 | 招商[immediate] |
| 438 | 驯鹿<br>REINDEER | 12 | standard:3 | 无 | herbivore×1、americas×1 | appeal +5 | 群集动物[during_placement] |
| 439 | 大羊驼<br>LAMA | 10 | standard:2 | 无 | herbivore×1、americas×1 | appeal +4 | 群集动物[during_placement] |
| 440 | 山貘<br>MOUNTAIN TAPIR | 15 | standard:2；rock≥1 | 无 | herbivore×1、americas×1 | appeal +4、conservation +1 | 刨挖[immediate] |
| 441 | 欧洲野牛<br>EUROPEAN BISON | 19 | standard:5 | partner_zoo≥1 | herbivore×1、europe×2 | appeal +6 | 招商[immediate] |
| 442 | 驼鹿<br>MOOSE | 19 | standard:4 | herbivore≥2 | herbivore×1、europe×1 | appeal +7 | 双重：赞助商[immediate]；群集动物[during_placement] |
| 443 | 马鹿<br>RED DEER | 12 | standard:3 | 无 | herbivore×1、europe×1 | appeal +5 | 群集动物[during_placement] |
| 444 | 羱羊<br>ALPINE IBEX | 10 | standard:2；rock≥2 | 无 | herbivore×1、europe×1 | appeal +5 | 跳跃[immediate] |
| 445 | 非洲冕豪猪<br>CRESTED PORCUPINE | 8 | standard:1 | 无 | herbivore×1、europe×1 | appeal +3 | 刨挖[immediate] |
| 446 | 儒艮<br>DUGONG | 25 | standard:5；water≥2 | animals II | herbivore×1、australia×2 | appeal +9、conservation +1 | 刨挖[immediate] |
| 447 | 红袋鼠<br>RED KANGAROO | 23 | standard:4 | 无 | herbivore×1、australia×1 | appeal +7 | 育儿袋[immediate]；群集动物[during_placement] |
| 448 | 树袋熊<br>KOALA | 21 | standard:3；rock≥1 | australia≥1 | herbivore×1、bear×1、australia×1 | appeal +8、reputation +1 | 育儿袋[immediate] |
| 449 | 鸭嘴兽<br>PLATYPUS | 10 | standard:2；water≥1 | 无 | herbivore×1、australia×1 | appeal +4 | 毒液[immediate] |
| 450 | 塔斯马尼亚袋熊<br>COMMON WOMBAT | 9 | standard:2 | 无 | herbivore×1、australia×1 | appeal +4 | 育儿袋[immediate] |
| 451 | 长鼻猴<br>PROBOSCIS MONKEY | 32 | standard:5；rock≥1 | primate≥2、animals II | primate×1、asia×1 | appeal +10、conservation +2 | 支配[immediate] |
| 452 | 塞内加尔婴猴<br>SENEGAL BUSHBABY | 10 | standard:1 | africa≥2 | primate×1、africa×1 | appeal +1 | 标志性动物[immediate] |
| 453 | 白颈白眉猴<br>COLLARED MANGABEY | 20 | standard:4 | africa≥1 | primate×1、africa×1 | appeal +8 | 行动：卡牌[after_action] |
| 454 | 环尾狐猴<br>RING-TAILED LEMUR | 12 | standard:3；rock≥1 | 无 | primate×1、africa×1 | appeal +6 | 日光浴[immediate] |
| 455 | 东非黑白疣猴<br>MANTLED GUEREZA | 13 | standard:3 | 无 | primate×1、africa×1 | appeal +6 | 机灵[after_action] |
| 456 | 地中海猕猴<br>BARBARY MACAQUE | 13 | standard:2 | partner_zoo≥1 | primate×1、africa×1 | appeal +6 | 偷窃1[immediate] |
| 457 | 山魈<br>MANDRILL | 28 | standard:5 | primate≥3 | primate×2、africa×1 | appeal +9、conservation +2 | 双重：卡牌[immediate] |
| 458 | 日本猕猴<br>JAPANESE MACAQUE | 18 | standard:3；water≥1 | asia≥1 | primate×1、asia×1 | appeal +7 | 偷窃2[immediate] |
| 459 | 红腿白臀叶猴<br>RED-SHANKED DOUC | 17 | standard:4 | science≥1 | primate×1、asia×1 | appeal +7、reputation +1 | 创造力：灵长类[immediate] |
| 460 | 郁乌叶猴<br>DUSKY-LEAF MONKEY | 12 | standard:2 | 无 | primate×1、asia×1 | appeal +5 | 机灵[after_action] |
| 461 |  邦加跗猴<br>HORSFIELD'S TARSIER | 14 | standard:1 | partner_zoo≥1 | primate×1、asia×1 | appeal +3、reputation +2 | 跳跃[immediate] |
| 462 | 印度灰叶猴<br>NORTHERN PLAINS GRAY LANGUR | 13 | standard:3；rock≥1 | 无 | primate×1、asia×1 | appeal +6 | 跳跃[immediate] |
| 463 | 巴拿马白面卷尾猴<br>PANAMANIAN WHITE-FACED CAPUCHIN | 11 | standard:2 | partner_zoo≥1 | primate×1、americas×1 | appeal +5 | 偷窃1[immediate] |
| 464 | 棕蜘蛛猴<br>BROWN SPIDER MONKEY | 17 | standard:4 | primate≥1 | primate×1、americas×1 | appeal +6、conservation +1 | 创造力：灵长类[immediate] |
| 465 | 金狮面狨<br>GOLDEN LION TAMARIN | 10 | standard:1 | 无 | primate×1、americas×1 | appeal +4 | 机灵[after_action] |
| 466 | 玻利维亚红吼猴<br>BOLIVIAN RED HOWLER | 12 | standard:3 | 无 | primate×1、americas×1 | appeal +6 | 推动：卡牌[after_action] |
| 467 | 厄瓜多尔松鼠猴<br>ECUADORIAN SQUIRELL MONKEY | 12 | standard:2 | 无 | primate×1、americas×1 | appeal +5 | 机灵[after_action] |
| 468 | 绒顶柽柳猴<br>COTTON-TOP TAMARIN | 15 | standard:1 | science≥2 | primate×1、americas×1 | appeal +4、conservation +1、reputation +1 | — |
| 469 | 尼罗鳄<br>NILE CROCODILE | 13 | standard:5 / reptile_house:3；water≥1 | reptile≥3 | reptile×1、africa×1 | appeal +9 | 捕捉2[immediate] |
| 470 | 西部绿曼巴蛇<br>WESTERN GREEN MAMBA | 13 | standard:2 / reptile_house:1 | africa≥1、reptile≥1 | reptile×1、africa×1 | appeal +6 | 毒液[immediate] |
| 471 | 苏卡达陆龟<br>AFRICAN SPURRED TORTOISE | 22 | standard:3 / reptile_house:2 | 无 | reptile×1、africa×1 | appeal +6、conservation +1 | 日光浴[immediate] |
| 472 | 岩巨蜥<br>ROCK MONITOR | 12 | standard:2 / reptile_house:1；rock≥1 | 无 | reptile×1、africa×1 | appeal +5 | 日光浴[immediate] |
| 473 | 彩虹飞蜥<br>COMMON AGAMA | 9 | standard:1 / reptile_house:0 | 无 | reptile×1、africa×1 | appeal +3 | 日光浴[immediate] |
| 474 | 印度蟒<br>INDIAN ROCK PYTHON | 14 | standard:2 / reptile_house:1 | reptile≥2 | reptile×1、asia×1 | appeal +7 | 缠绕[immediate] |
| 475 | 印度眼镜蛇<br>KING COBRA | 13 | standard:2 / reptile_house:1 | science≥2、animals II | reptile×1、asia×1 | appeal +6 | 催眠[after_action] |
| 476 | 科莫多巨蜥<br>KOMODO DRAGON | 14 | standard:3 / reptile_house:2 | asia≥2 | reptile×1、asia×1 | appeal +2 | 标志性动物[immediate] |
| 477 | 高冠变色龙<br>VEILED CHAMELEON | 14 | standard:1 / reptile_house:0 | 无 | reptile×1、asia×1 | appeal +4 | 捕捉1[immediate] |
| 478 | 长鬣蜥<br>CHINESE WATER DRAGON | 8 | standard:1 / reptile_house:0；water≥1 | 无 | reptile×1、asia×1 | appeal +3 | 日光浴[immediate] |
| 479 | 美洲短吻鳄<br>AMERICAN ALLIGATOR | 18 | standard:4 / reptile_house:2；water≥1 | 无 | reptile×1、americas×1 | appeal +7 | 捕捉1[immediate] |
| 480 | 宽吻凯门鳄<br>BROAD-SNOUTED CAIMAN | 16 | standard:4 / reptile_house:2；water≥1 | 无 | reptile×1、americas×1 | appeal +6 | 捕捉1[immediate] |
| 481 | 圣克鲁斯岛加拉帕戈斯象龟<br>GALAPAGOS GIANT TORTOISE | 30 | standard:3 / reptile_house:2 | americas≥2、animals II | reptile×1、americas×1 | appeal +8、conservation +2、reputation +1 | 日光浴[immediate] |
| 482 | 亚马逊森蚺<br>ANACONDA | 13 | standard:2 / reptile_house:1；water≥1, rock≥1 | partner_zoo≥1 | reptile×1、americas×1 | appeal +6 | 缠绕[immediate] |
| 483 | 红尾蚺<br>BOA CONSTRICTOR | 16 | standard:2 / reptile_house:1 | science≥2 | reptile×1、americas×1 | appeal +7 | 缠绕[immediate] |
| 484 | 欧洲泽龟<br>EUROPEAN POND TURTLE | 9 | standard:1 / reptile_house:1；water≥1 | 无 | reptile×1、europe×1 | appeal +4 | — |
| 485 | 极北蝰<br>COMMON EUROPEAN ADDER | 10 | standard:1 / reptile_house:0 | partner_zoo≥1 | reptile×1、europe×1 | appeal +2 | 催眠[after_action] |
| 486 | 普通壁蜥<br>COMMON WALL LIZARD | 4 | standard:1 / reptile_house:0；rock≥1 | 无 | reptile×1、europe×1 | appeal +2 | — |
| 487 | 领纹蛇<br>EUROPEAN GRASS SNAKE | 8 | standard:1 / reptile_house:0；water≥1 | 无 | reptile×1、europe×1 | appeal +3 | 机灵[after_action] |
| 488 | 蛇蜥<br>SLOW WORM | 4 | standard:1 / reptile_house:0；water≥1 | 无 | reptile×1、europe×1 | appeal +2 | — |
| 489 | 湾鳄<br>SALTWATER CROCODILE | 23 | standard:5 / reptile_house:3；water≥1 | partner_zoo≥1 | reptile×2、australia×1 | appeal +9 | 捕捉2[immediate] |
| 490 | 砂巨蜥<br>GOULD'S MONITOR | 15 | standard:3 / reptile_house:2 | 无 | reptile×1、australia×1 | appeal +6 | 食腐[immediate] |
| 491 | 伞蜥<br>FRILLED LIZARD | 12 | standard:2 / reptile_house:1；rock≥1 | 无 | reptile×1、australia×1 | appeal +5 | 疾跑[immediate] |
| 492 | 细鳞太攀蛇<br>INLAND TAIPAN | 10 | standard:2 / reptile_house:1；rock≥1 | australia≥1、science≥1 | reptile×1、australia×1 | appeal +5 | 毒液[immediate] |
| 493 | 棘蜥<br>THORNY DEVIL | 6 | standard:1 / reptile_house:0；rock≥1 | 无 | reptile×1、australia×1 | appeal +3 | — |
| 494 | 非洲鸵鸟<br>AFRICAN OSTRICH | 20 | standard:5 / large_bird_aviary:4 | 无 | bird×1、africa×1 | appeal +8 | 疾跑[immediate] |
| 495 | 蛇鹫<br>SECRETARY BIRD | 14 | standard:4 / large_bird_aviary:1 | 无 | bird×1、africa×1 | appeal +4、conservation +1 | — |
| 496 | 秃鹳<br>MARABOU | 10 | standard:3 / large_bird_aviary:1 | 无 | bird×1、africa×1 | appeal +4 | 食腐[immediate] |
| 497 | 小红鹳<br>LESSER FLAMINGO | 15 | standard:2；water≥1 | 无 | bird×1、africa×1 | appeal +6 | 姿态[immediate] |
| 498 | 鲸头鹳<br>SHOEBILL | 9 | standard:1 / large_bird_aviary:1 | science≥2 | bird×1、africa×1 | appeal +3、conservation +1 | — |
| 499 | 秃鹫<br>CINEREOUS VULTURE | 16 | standard:5 / large_bird_aviary:1 | 无 | bird×1、asia×1 | appeal +6 | 食腐[immediate] |
| 500 | 长喙兀鹫<br>LONG-BILLED VULTURE | 20 | standard:4 / large_bird_aviary:1；rock≥1 | science≥1 | bird×1、asia×1 | appeal +5、conservation +1、reputation +1 | 食腐[immediate] |
| 501 | 蓝孔雀<br>INDIAN PEAFOWL | 18 | standard:3 | asia≥1 | bird×1、asia×1 | appeal +7 | 姿态[immediate] |
| 502 | 双角犀鸟<br>GREAT HORNBILL | 13 | standard:2 | 无 | bird×1、asia×1 | appeal +6 | 推动：建造[after_action] |
| 503 | 雪鸮<br>SNOWY OWL | 11 | standard:1 | bird≥2 | bird×1、asia×1 | appeal +4、reputation +1 | 洞察力4[immediate] |
| 504 | 安第斯神鹫<br>ANDEAN CONDOR | 17 | standard:5 / large_bird_aviary:1；rock≥1 | bird≥1 | bird×1、americas×1 | appeal +7、reputation +1 | 食腐[immediate] |
| 505 | 白头海雕<br>BALD EAGLE | 23 | standard:4 / large_bird_aviary:1；water≥1 | animals II | bird×1、americas×1 | appeal +8 | 果断[after_action] |
| 506 | 王鹫<br>KING VULTURE | 12 | standard:3 / large_bird_aviary:1 | bird≥3 | bird×1、americas×1 | appeal +9 | 食腐[immediate] |
| 507 | 大美洲鸵<br>GREATER RHEA | 12 | standard:2 | 无 | bird×1、americas×1 | appeal +5 | 疾跑[immediate] |
| 508 | 五彩金刚鹦鹉<br>SCARLET MACAW | 16 | standard:1 | partner_zoo≥1 | bird×1、americas×1 | appeal +4 | 姿态[immediate] |
| 509 | 金雕<br>GOLDEN EAGLE | 20 | standard:5 / large_bird_aviary:1；rock≥1 | animals II | bird×1、europe×1 | appeal +7 | 果断[after_action] |
| 510 | 白鹳<br>WHITE STORK | 9 | standard:4 / large_bird_aviary:1 | europe≥1 | bird×1、europe×1 | appeal +4 | 双重：建造[immediate] |
| 511 | 大红鹳<br>GREATER FLAMINGO | 16 | standard:3；water≥1 | 无 | bird×1、europe×1 | appeal +7 | 姿态[immediate] |
| 512 | 雕鸮<br>EURASIAN EAGLE-OWL | 10 | standard:2 | partner_zoo≥1 | bird×1、europe×1 | appeal +4 | 洞察力4[immediate] |
| 513 | 仓鸮<br>BARN OWL | 12 | standard:1 | 无 | bird×1、europe×1 | appeal +3 | 洞察力4[immediate] |
| 514 | 鸸鹋<br>EMU | 22 | standard:5 | australia≥2 | bird×1、australia×1 | appeal +7 | 炫耀[immediate] |
| 515 | 澳大利亚鹈鹕<br>AUSTRALIAN PELICAN | 13 | standard:4；water≥2 | 无 | bird×1、australia×1 | appeal +5 | 行动：建造[after_action] |
| 516 | 单垂鹤鸵<br>NORTHERN CASSOWARY | 12 | standard:3 | partner_zoo≥1 | bird×1、australia×1 | appeal +6 | 双重：建造[immediate] |
| 517 | 笑翠鸟<br>LAUGHING KOOKABURRA | 9 | standard:2 | australia≥1 | bird×1、australia×1 | — | 标志性动物[immediate] |
| 518 | 小极乐鸟<br>LESSER BIRD-OF-PARADISE | 15 | standard:1 | 无 | bird×1、australia×1 | appeal +5 | 姿态[immediate] |
| 519 | 家山羊<br>(DOMESTIC) GOAT | 7 | petting_zoo:1 | 无 | petting_zoo_animal×1 | — | 萌宠动物[immediate] |
| 520 | 绵羊<br>SHEEP | 7 | petting_zoo:1 | 无 | petting_zoo_animal×1 | — | 萌宠动物[immediate] |
| 521 | 马<br>HORSE | 7 | petting_zoo:1 | 无 | petting_zoo_animal×1 | reputation +1 | 萌宠动物[immediate] |
| 522 | 驴<br>DONKEY | 7 | petting_zoo:1 | 无 | petting_zoo_animal×1 | — | 创造力[immediate]；萌宠动物[immediate] |
| 523 | 家兔<br>DOMESTIC RABBIT | 7 | petting_zoo:1 | 无 | petting_zoo_animal×1 | — | 萌宠动物[immediate] |
| 524 | 曼加利察猪<br>MANGALICA | 7 | petting_zoo:1 | 无 | petting_zoo_animal×1 | — | 刨挖[immediate]；萌宠动物[immediate] |
| 525 | 豚鼠<br>GUINEA PIG | 7 | petting_zoo:1 | 无 | petting_zoo_animal×1 | — | 萌宠动物[immediate] |
| 526 | 羊驼<br>ALPACA | 7 | petting_zoo:1 | 无 | petting_zoo_animal×1 | — | 萌宠动物[immediate] |
| 527 | 虹彩吸蜜鹦鹉<br>COCONUT LORIKEET | 7 | petting_zoo:1 | 无 | petting_zoo_animal×1 | — | 萌宠动物[immediate] |
| 528 | 红颈袋鼠<br>BENNETT'S WALLABY | 7 | petting_zoo:1 | 无 | petting_zoo_animal×1 | — | 育儿袋[immediate]；萌宠动物[immediate] |

## 赞助商牌（64 张）

| ID | 名称 | 强度 | 打出条件 | 图标 / 印刷收益 | 效果（已按时机拆分） |
|---|---|---:|---|---|---|
| 201 | 科学实验室<br>SCIENCE LAB | 5 | sponsors II | science×1；— | immediate：打出时，从牌库抽1张，或拿取声望范围内的1张展示牌。<br>income：收入： 从牌库或声望范围内拿取1张卡牌。<br>endgame：3/6个研究图标，获得 {ConservationPoint-1} / {ConservationPoint-2} 。 |
| 202 | 发言人<br>SPOKESPERSON | 5 | science≥1 | science×1；— | passive：每次你在 你的动物园 中打出研究图标时，获得 {Reputation-1} 。 |
| 203 | 兽医<br>VETERINARIAN | 4 | 无 | science×1；— | immediate：拥有1/2/3所大学时，获得2/5/10金币。<br>passive：支持保护项目，仅需 {Slot-4} 。<br>endgame：拥有3所大学时，获得1保育。 |
| 204 | 科学博物馆<br>SCIENCE MUSEUM | 4 | science≥4 | science×1；— | immediate：自己每个科研图标获得2金币。<br>passive：每次你在 你的动物园 中打出研究图标时，获得 {ConservationPoint-1} 。 |
| 205 | 大猩猩野外研究<br>GORILLA FIELD RESEARCH | 3 | science≥3 | science×1；conservation +1、reputation +2 | — |
| 206 | 医学突破<br>MEDICAL BREAKTHROUGH | 5 | science≥4 | science×1；— | immediate：每个已支持的保育项目获得2吸引力。<br>income：收入： 获得 {ConservationPoint-1} 。 |
| 207 | 基础研究<br>BASIC RESEARCH | 4 | sponsors II、appeal<=25 | science×1；— | immediate：每有2个不同的大洲和/或动物类目图标，获得 {ConservationPoint-1} 。你以此方式每获得 {ConservationPoint-1} , 每位其他玩家获得 {Money-2} 。 |
| 208 | 科学图书馆<br>SCIENCE LIBRARY | 4 | 无 | science×1；— | immediate：自己每个科研图标获得1吸引力。<br>passive：每次 任何动物园 中打出研究图标时， 获得 {Money-2} 。<br>endgame：5个不同的动物类目图标，获得 {ConservationPoint-1} 。 |
| 209 | 技术研究所<br>TECHNOLOGY INSTITUTE | 5 | 无 | science×1；— | immediate：打出时获得1枚X标记。<br>income：收入： 获得1枚 {XToken} 标记。<br>endgame：拥有3所大学时，获得1保育。 |
| 210 | 美洲专家<br>EXPERT ON THE AMERICAS | 4 | 无 | americas×1；— | immediate：自己每个美洲图标获得1吸引力。<br>passive：每次你在 你的动物园 中打出美洲图标时，你可以免费建造一个贩售亭。<br>endgame：拥有至少5个贩售亭时，获得1保育。 |
| 211 | 欧洲专家<br>EXPERT ON EUROPE | 5 | 无 | europe×1；— | immediate：自己每个欧洲图标获得1吸引力。<br>passive：每次你在 你的动物园 中打出欧洲图标时，你可以免费建造1个1格饲养区。<br>endgame：拥有至少5个已占用的1格标准围栏时，获得1保育。 |
| 212 | 澳洲专家<br>EXPERT ON AUSTRALIA | 5 | 无 | australia×1；— | immediate：自己每个澳洲图标获得1吸引力。<br>passive：每次你在 你的动物园 中打出澳洲图标时，你可以从你的手牌中放置1张卡牌到本卡牌下方，以获得 {Appeal-2} (育儿袋 1)。 |
| 213 | 亚洲专家<br>EXPERT ON ASIA | 5 | 无 | asia×1；— | immediate：自己每个亚洲图标获得1吸引力。<br>passive：每次你在 你的动物园 中打出亚洲图标时，你可以免费建造1个休憩亭。 |
| 214 | 非洲专家<br>EXPERT ON AFRICA | 4 | 无 | africa×1；— | immediate：自己每个非洲图标获得1吸引力。<br>passive：每次你在 你的动物园 中打出非洲图标时，在你当前行动完成后，你可以将任意一张行动卡牌放置到 {Slot-1} (机灵)。<br>endgame：终局时，每枚持有的X标记获得1吸引力。 |
| 215 | 全球繁育计划<br>BREEDING COOPERATION | 4 | partner_zoo≥2 | —；— | setup_and_passive：打出本卡牌时，在本卡牌上放置2个玩家标记。当支持 基础 保护项目时，你可以弃除本卡牌上的1个标记(仅限1个)以代表任一图标。<br>endgame：支持了5个保护项目，获得 {ConservationPoint-1} 。 |
| 216 | 优秀的协调员<br>TALENTED COMMUNICATOR | 5 | sponsors II | —；— | immediate：雇佣1个协会事务员(呼唤)。<br>endgame：声望至少9时，获得1保育。 |
| 217 | 工程师<br>ENGINEER | 4 | 无 | —；— | passive：每当你使用“建造”行动 {BuildActionCard} 建造至少1个建筑时，你可以多建造 1个相同类型 的建筑(特殊饲养区除外)，按正常费用支付。<br>endgame：地图除水域、岩石外全部覆盖时，获得5吸引力。 |
| 218 | 育种计划<br>BREEDING PROGRAM | 4 | science≥2 | —；— | setup_and_passive：打出本卡牌时，在本卡牌上放置2个玩家标记。当支持 基础 保护项目时，你可以弃除本卡牌上的1个标记(仅限1个)以代表任一图标。<br>endgame：支持5个保护项目，获得 {ConservationPoint-1} 。 |
| 219 | 综合研究员<br>DIVERSITY RESEARCHER | 5 | sponsors II | science×1；— | immediate：每个水域和岩石的需求，获得 {Money-2} 。<br>passive：你可以覆盖水域和岩石格。忽略所有水域和岩石的需求。<br>endgame：每组1个水域图标加1个岩石图标获得2吸引力，最多计算3组。 |
| 220 | 联邦资助金<br>FEDERAL GRANTS | 4 | 无 | science×1；— | immediate：打出时获得3金币。<br>income：收入： 获得 {Money-3} 。<br>endgame：声望至少9时，获得1保育。 |
| 221 | 考古学家<br>ARCHEOLOGIST | 4 | science≥1 | science×1；— | passive：每次你获得你动物园边界格的放置奖励时，你免费获得你动物园中另一个未覆盖的放置奖励。<br>endgame：覆盖所有边界格（不含水域、岩石）时，获得1保育。 |
| 222 | 发布专利<br>RELEASE OF PATENTS | 5 | appeal<=25 | —；— | immediate：你的动物园里每个研究图标，获得 {ConservationPoint-1} (最多3)。你以此方式每获得 {ConservationPoint-1} ，每位其他玩家获得 {Money-2} 。 |
| 223 | 科研机构<br>SCIENCE INSTITUTE | 3 | 无 | science×2；— | — |
| 224 | 迁徙记录<br>MIGRATION RECORDING | 4 | science≥1 | science×1；— | immediate：打出时获得1枚X标记。<br>passive：每当你支持 放归野外 的保护项目时，额外获得 {ConservationPoint-1} 。 你可以多次支持每一个 放归野外 的保护项目。 |
| 225 | 检疫实验室<br>QUARANTINE LAB | 3 | 无 | science×1；— | immediate：打出时获得1枚X标记。<br>passive：毒液、缠绕、催眠 和 偷窃 的效果，对你无效。<br>endgame：5个不同的大洲图标，获得 {ConservationPoint-1} 。 |
| 226 | 海外研究所<br>FOREIGN INSTITUTE | 6 | 无 | science×1；reputation +2 | endgame：5个不同的大洲图标，获得 {ConservationPoint-1} 。 |
| 227 | 世界动物园协会特别任务<br>WAZA SPECIAL ASSIGNMENT | 6 | reputation>=6 | —；— | immediate：选择并标记本卡牌上的 {SizeAnimal-2} 或 {SizeAnimal-4} 。从牌库中逐一展示卡牌，将第一张所选择类型的动物卡牌加入你的手牌，然后将其余的卡牌塞入牌库 底部 。<br>passive：你不能再打出未放标记的类型。每当你打出小型或大型动物时，你获得 {Appeal-2} 或 {Appeal-4} 。 |
| 228 | 世界动物园协会小型动物计划<br>WAZA SMALL ANIMAL PROGRAM | 5 | reputation>=3 | —；— | immediate：自己每只小型动物获得2金币。<br>passive：每次你在“动物”行动 {AnimalActionCard} 中， 仅仅 打出 小型动物 时，你可以从你的手牌中按正常费用再打出1个小型动物。随后，从展示区拿取1个小型动物(如果有)。 |
| 229 | 小型动物专家<br>EXPERT IN SMALL ANIMALS | 5 | 无 | —；— | immediate：自己每只小型动物获得1吸引力。<br>passive：你打出小型动物的费用减 {Money-3} 。 |
| 230 | 大型动物专家<br>EXPERT IN LARGE ANIMALS | 4 | 无 | —；— | immediate：自己每只大型动物获得2吸引力。<br>passive：你打出大型动物的费用减 {Money-4} 。 |
| 231 | 灵长类资助计划<br>SPONSORSHIP: PRIMATES | 3 | primate≥1 | —；— | immediate：自己每个灵长类图标获得1吸引力。<br>income：收入： 你的动物园里有1/3/5个灵长类图标，获得 {Money-3} / {Money-6} / {Money-9} 。 |
| 232 | 爬行类资助计划<br>SPONSORSHIP: REPTILES | 3 | reptile≥1 | —；— | immediate：自己每个爬行类图标获得1吸引力。<br>income：收入： 你的动物园里有1/3/5个爬行类图标，获得 {Money-3} / {Money-6} / {Money-9} 。 |
| 233 | 秃鹫资助计划<br>SPONSORSHIP: VULTURES | 3 | bird≥1 | —；— | immediate：自己每个鸟类图标获得1吸引力。<br>income：收入： 你的动物园里有1/3/5个鸟类图标，获得 {Money-3} / {Money-6} / {Money-9} 。 |
| 234 | 狮子资助计划<br>SPONSORSHIP: LIONS | 3 | predator≥1 | —；— | immediate：自己每个食肉类图标获得1吸引力。<br>income：收入： 你的动物园里有1/3/5个食肉类图标，获得 {Money-3} / {Money-6} / {Money-9} 。 |
| 235 | 大象资助计划<br>SPONSORSHIP: ELEPHANTS | 3 | herbivore≥1 | —；— | immediate：自己每个食草类图标获得1吸引力。<br>income：收入： 你的动物园里有1/3/5个食草类图标，获得 {Money-3} / {Money-6} / {Money-9} 。 |
| 236 | 灵长类动物学家<br>PRIMATOLOGIST | 4 | 无 | primate×1；— | passive：每次 任何动物园 中打出灵长类图标时，获得 {Money-3} 。 |
| 237 | 爬行类动物学家<br>HERPETOLOGIST | 4 | 无 | reptile×1；— | passive：每次 任何动物园 中打出爬行类图标时，获得 {Money-3} 。 |
| 238 | 鸟类学家<br>ORNITHOLOGIST | 4 | 无 | bird×1；— | passive：每次 任何动物园 中打出鸟类图标时，获得 {Money-3} 。 |
| 239 | 食肉动物专家<br>EXPERT IN PREDATORS | 4 | 无 | predator×1；— | passive：每次 任何动物园 中打出食肉类图标时，获得 {Money-3} 。 |
| 240 | 食草动物专家<br>EXPERT IN HERBIVORES | 4 | 无 | herbivore×1；— | passive：每次 任何动物园 中打出食草类图标时，获得 {Money-3} 。 |
| 241 | 水文学家<br>HYDROLOGIST | 5 | 无 | water×1；— | immediate：自己每个水域图标获得1吸引力。<br>passive：你每覆盖一个与水域相邻的六角格， 获得 {Money-1} 。<br>endgame：如果所有的水域格都已相连，获得 {ConservationPoint-1} 。 |
| 242 | 地质学家<br>GEOLOGIST | 5 | 无 | rock×1；— | immediate：自己每2个岩石图标获得3吸引力。<br>passive：你每覆盖一个与岩石相邻的六角格， 获得 {Money-1} 。<br>endgame：如果所有的岩石格都已相连，获得 {ConservationPoint-1} 。 |
| 243 | 狐獴窝<br>MEERKAT DEN | 5 | reputation>=3 | herbivore×1；— | immediate：放置到至少相邻1个岩石格的位置。<br>passive：每次你在 你的动物园 中打出食草类图标时，获得 {Appeal-2} 。<br>endgame：至少6个食草类图标时，获得1保育。 |
| 244 | 企鹅馆<br>PENGUIN POOL | 5 | reputation>=3 | bird×1；— | immediate：放置到至少相邻1个水域格的位置。<br>passive：每次你在 你的动物园 中打出鸟类图标时，获得 {Appeal-2} 。<br>endgame：至少6个鸟类图标时，获得1保育。 |
| 245 | 水族馆<br>AQUARIUM | 5 | reputation>=3 | —；— | immediate：放置到至少相邻2个水域格的位置。<br>passive：每次你在 你的动物园 中打出水域图标时，获得 {Appeal-2} 。<br>endgame：至少6个水域图标时，获得1保育。 |
| 246 | 空中索道<br>CABLE CAR | 6 | 无 | —；— | immediate：放置到至少相邻2个岩石格的位置。<br>passive：每次你在 你的动物园 中打出岩石图标时，获得 {Appeal-2} 。<br>endgame：至少6个岩石图标时，获得1保育。 |
| 247 | 狒狒栖息岩<br>BABOON ROCK | 6 | 无 | primate×1；— | immediate：放置到至少相邻1个岩石格的位置。<br>passive：每次你在 你的动物园 中打出灵长类图标时，获得 {Appeal-2} 。<br>endgame：至少6个灵长类图标时，获得1保育。 |
| 248 | 猕猴园<br>RHESUS MONKEY PARK | 5 | 无 | primate×1；— | immediate：免费放置“猕猴园”独特建筑，并遵守通常建筑放置规则。<br>passive：每次你在 你的动物园 中打出灵长类图标时，获得 1个 {XToken} 标记。 |
| 249 | 猫头鹰棚屋<br>BARRED OWL HUT | 6 | 无 | bird×1；— | immediate：免费放置“猫头鹰棚屋”独特建筑，并遵守通常建筑放置规则。<br>passive：每次你在 你的动物园 中打出鸟类图标时，从牌库中抓取2张卡牌。保留1张并弃除另一张(洞察力 2)。 |
| 250 | 海龟水族箱<br>SEA TURTLE TANK | 5 | 无 | reptile×1；— | immediate：免费放置“海龟水族箱”独特建筑，并遵守通常建筑放置规则。<br>passive：每次你在 你的动物园 中打出爬行类图标时，你可以从你的手牌中卖出最多2张卡牌，每张卡牌 {Money-4} (日光浴 2)。 |
| 251 | 北极熊展<br>POLAR BEAR EXHIBIT | 5 | 无 | bear×1、predator×1；— | immediate：放置到至少相邻1个水域格的位置。<br>passive：每次 任何动物园 中打出熊类图标时，获得 {Appeal-2} 。<br>endgame：终局时，熊类图标3–5个获得保育1，6个或更多获得保育2。 |
| 252 | 斑鬣狗围场<br>SPOTTED HYENA COMPOUND | 5 | 无 | predator×1；— | immediate：免费放置“斑鬣狗围场”独特建筑，并遵守通常建筑放置规则。<br>passive：每次你在 你的动物园 中打出食肉类图标时，展示牌库顶端的X张卡牌。将1张动物卡牌加入你的手牌。弃除其余的卡牌。(X=你动物园里食肉类图标的数量)(狩猎X)。 |
| 253 | 霍加狓棚厩<br>OKAPI STABLE | 6 | 无 | herbivore×1；— | immediate：免费放置“霍加狓棚厩”独特建筑，并遵守通常建筑放置规则。<br>setup_and_passive：打出本卡牌时，在本卡牌上放置 3个玩家标记 。每次你在 你的动物园 中打出食草类图标时，你可以移除本卡牌上的1个标记并支付 {Money-X} ，以打出一张赞助商卡牌( {Money-X} = {Slot-X} )。 |
| 254 | 动物园课外学校<br>ZOO SCHOOL | 5 | 无 | —；conservation +1、reputation +1 | immediate：放置到至少2个边界格的位置。从牌库或声望范围内拿取1张卡牌。 |
| 255 | 儿童游乐园<br>ADVENTURE PLAYGROUND | 3 | 无 | —；appeal +4 | immediate：放置到至少相邻1个岩石格的位置。 |
| 256 | 水上乐园<br>WATER PLAYGROUND | 3 | 无 | —；appeal +4 | immediate：放置到至少相邻1个水域格的位置。 |
| 257 | 园区边门<br>SIDE ENTRANCE | 3 | 无 | —；— | immediate：放置到2个边界格的位置。不必与其他建筑相邻。<br>income：收入： 每个相邻“园区边门”的建筑(闲置的标准饲养区除外)，获得 {Money-2} 。<br>endgame：终局时若地图除水域和岩石外全部覆盖，获得吸引力5。 |
| 258 | 本地海鸟<br>NATIVE SEABIRDS | 5 | appeal<=25 | bird×1；— | immediate：每个相连的水域格，获得 {Appeal-1} 。<br>endgame：每2个孤立的水域格，获得 {ConservationPoint-1} 。 |
| 259 | 本地蜥蜴<br>NATIVE LIZARDS | 5 | appeal<=25 | reptile×1；— | immediate：每个相连的岩石格，获得 {Appeal-1} 。<br>endgame：每2个孤立的岩石格，获得 {ConservationPoint-1} 。 |
| 260 | 本地农牧动物<br>NATIVE FARM ANIMALS | 5 | appeal<=25 | herbivore×1；— | immediate：每个相连的没有建筑的边界格，获得 {Appeal-1} 。<br>endgame：每一组由6个没有建筑的可建造六角格连成的区域，获得 {ConservationPoint-1} 。 |
| 261 | 导游学校参观<br>GUIDED SCHOOL TOURS | 3 | 无 | —；appeal +1、conservation +1 | endgame：5个不同的动物类目图标，获得 {ConservationPoint-1} 。 |
| 262 | 探险家<br>EXPLORER | 5 | sponsors II | —；— | immediate：你的动物园里每个不同的大洲和动物类目图标，获得 {Money-2} 。<br>passive：每次你获得还未在 你动物园 里出现的大洲或动物类目图标时，获得 {Appeal-1} 和 {Money-2} 。 |
| 263 | 世界动物园协会大型动物计划<br>WAZA LARGE ANIMAL PROGRAM | 5 | sponsors II、reputation>=6 | —；— | immediate：你可以免费放置1个5格饲养区。<br>passive：如果你打出大型动物，你可以忽略1个由你选择的条件。 |
| 264 | 自由放养的新世界猴<br>FREE-RANGE NEW WORLD MONKEYS | 5 | appeal<=25 | primate×1；— | immediate：每个相连的具有放置奖励的六角格， 获得 {Appeal-1} 。<br>endgame：每2个孤立的具有放置奖励的六角格， 获得 {ConservationPoint-1} 。 |

## 独特建筑轮廓（15 块）

坐标以建筑身份图标所在格为 `(0,0)`；顺时针旋转一步使用 `(q,r)→(-r,q+r)`。只允许 0–5 共六个旋转步，不允许镜像。

| 卡牌 | 建筑 | 格数 | canonical cells | 放置限制 |
|---|---|---:|---|---|
| 243 | 狐獴窝 | 3 | `(0,0) (-1,1) (1,0)` | 相邻rock≥1；通常放置规则 |
| 244 | 企鹅馆 | 4 | `(0,0) (-1,0) (1,-1) (1,0)` | 相邻water≥1；通常放置规则 |
| 245 | 水族馆 | 4 | `(0,0) (-1,1) (1,0) (1,1)` | 相邻water≥2；通常放置规则 |
| 246 | 空中索道 | 4 | `(0,0) (1,-1) (-1,1) (-2,2)` | 相邻rock≥2；通常放置规则 |
| 247 | 狒狒栖息岩 | 4 | `(0,0) (-1,0) (1,0) (0,1)` | 相邻rock≥1；通常放置规则 |
| 248 | 猕猴园 | 4 | `(0,0) (-1,0) (-2,1) (1,0)` | 通常放置规则 |
| 249 | 猫头鹰棚屋 | 3 | `(0,0) (-1,0) (1,0)` | 通常放置规则 |
| 250 | 海龟水族箱 | 4 | `(0,0) (-1,0) (1,-1) (0,1)` | 相邻water≥1；通常放置规则 |
| 251 | 北极熊展 | 4 | `(0,0) (-1,1) (1,0) (2,-1)` | 相邻water≥1；通常放置规则 |
| 252 | 斑鬣狗围场 | 4 | `(0,0) (-1,0) (1,-1) (2,-2)` | 相邻rock≥1；通常放置规则 |
| 253 | 霍加狓棚厩 | 4 | `(0,0) (-2,1) (-1,1) (1,0)` | 通常放置规则 |
| 254 | 动物园课外学校 | 3 | `(0,0) (-1,0) (1,-1)` | 覆盖边界格≥2；通常放置规则 |
| 255 | 儿童游乐园 | 2 | `(0,0) (1,0)` | 相邻rock≥1；通常放置规则 |
| 256 | 水上乐园 | 2 | `(0,0) (1,0)` | 相邻water≥1；通常放置规则 |
| 257 | 园区边门 | 2 | `(0,0) (1,0)` | 覆盖边界格≥2；无需与已有建筑相邻；通常放置规则 |

## 保育项目（32 张）

| ID | 名称 | 类型 / 指标 | 支持格 | 新项目奖励 / 规则 |
|---|---|---|---|---|
| 101 | 物种多元化<br>SPECIES DIVERSITY | base / any_animal_category | 5 -> 保育+5（任意动物类目）；4 -> 保育+3（任意动物类目）；3 -> 保育+2（任意动物类目） | — |
| 102 | 起源地多元化<br>HABITAT DIVERSITY | base / any_continent | 5 -> 保育+5（任意大洲）；4 -> 保育+3（任意大洲）；3 -> 保育+2（任意大洲） | — |
| 103 | 非洲<br>AFRICA | base / africa | 5 -> 保育+5（非洲）；4 -> 保育+3（非洲）；2 -> 保育+2（非洲） | — |
| 104 | 美洲<br>AMERICAS | base / americas | 5 -> 保育+5（美洲）；4 -> 保育+3（美洲）；2 -> 保育+2（美洲） | — |
| 105 | 澳洲<br>AUSTRALIA | base / australia | 5 -> 保育+5（澳洲）；4 -> 保育+4（澳洲）；2 -> 保育+2（澳洲） | — |
| 106 | 亚洲<br>ASIA | base / asia | 5 -> 保育+5（亚洲）；4 -> 保育+3（亚洲）；2 -> 保育+2（亚洲） | — |
| 107 | 欧洲<br>EUROPE | base / europe | 5 -> 保育+5（欧洲）；4 -> 保育+4（欧洲）；2 -> 保育+2（欧洲） | — |
| 108 | 灵长类<br>PRIMATES | base / primate | 5 -> 保育+5（灵长类）；4 -> 保育+4（灵长类）；2 -> 保育+2（灵长类） | — |
| 109 | 爬行类<br>REPTILES | base / reptile | 5 -> 保育+5（爬行类）；4 -> 保育+4（爬行类）；2 -> 保育+2（爬行类） | — |
| 110 | 食肉类<br>PREDATORS | base / predator | 5 -> 保育+5（食肉类）；4 -> 保育+4（食肉类）；2 -> 保育+2（食肉类） | — |
| 111 | 食草类<br>HERBIVORES | base / herbivore | 5 -> 保育+5（食草类）；4 -> 保育+4（食草类）；2 -> 保育+2（食草类） | — |
| 112 | 鸟类<br>BIRDS | base / bird | 5 -> 保育+5（鸟类）；4 -> 保育+4（鸟类）；2 -> 保育+2（鸟类） | — |
| 113 | 巴伐利亚森林国家公园<br>BAVARIAN FOREST NATIONAL PARK | release / europe | 围栏尺寸5 -> 保育+5；围栏尺寸4 -> 保育+4；围栏尺寸3 -> 保育+3 | reputation +1；放归动物的已占用围栏尺寸须与奖励格完全相同 |
| 114 | 优胜美地国家公园<br>YOSEMITE NATIONAL PARK | release / americas | 围栏尺寸5 -> 保育+5；围栏尺寸4 -> 保育+4；围栏尺寸3 -> 保育+3 | reputation +1；放归动物的已占用围栏尺寸须与奖励格完全相同 |
| 115 | 安通国家公园<br>ANGTHONG NATIONAL PARK | release / asia | 围栏尺寸5 -> 保育+5；围栏尺寸4 -> 保育+4；围栏尺寸3 -> 保育+3 | reputation +1；放归动物的已占用围栏尺寸须与奖励格完全相同 |
| 116 | 塞伦盖蒂国家公园<br>SERENGETI NATIONAL PARK | release / africa | 围栏尺寸5 -> 保育+5；围栏尺寸4 -> 保育+4；围栏尺寸3 -> 保育+3 | reputation +1；放归动物的已占用围栏尺寸须与奖励格完全相同 |
| 117 | 蓝山国家公园<br>BLUE MOUNTAINS NATIONAL PARK | release / australia | 围栏尺寸5 -> 保育+5；围栏尺寸4 -> 保育+4；围栏尺寸3 -> 保育+3 | reputation +1；放归动物的已占用围栏尺寸须与奖励格完全相同 |
| 118 | 热带大草原<br>SAVANNA | release / predator | 围栏尺寸5 -> 保育+5；围栏尺寸4 -> 保育+4；围栏尺寸3 -> 保育+3 | reputation +1；放归动物的已占用围栏尺寸须与奖励格完全相同 |
| 119 | 低矮山脉<br>LOW MOUNTAIN RANGE | release / bird | 围栏尺寸5 -> 保育+5；围栏尺寸4 -> 保育+4；围栏尺寸3 -> 保育+3 | reputation +1；放归动物的已占用围栏尺寸须与奖励格完全相同 |
| 120 | 竹林<br>BAMBOO FOREST | release / herbivore | 围栏尺寸5 -> 保育+5；围栏尺寸4 -> 保育+4；围栏尺寸3 -> 保育+3 | reputation +1；放归动物的已占用围栏尺寸须与奖励格完全相同 |
| 121 | 海蚀洞<br>SEA CAVE | release / reptile | 围栏尺寸5 -> 保育+5；围栏尺寸4 -> 保育+4；围栏尺寸3 -> 保育+3 | reputation +1；放归动物的已占用围栏尺寸须与奖励格完全相同 |
| 122 | 丛林<br>JUNGLE | release / primate | 围栏尺寸5 -> 保育+5；围栏尺寸4 -> 保育+4；围栏尺寸3 -> 保育+3 | reputation +1；放归动物的已占用围栏尺寸须与奖励格完全相同 |
| 123 | 鸟类动物繁育计划<br>BIRD BREEDING PROGRAM | breeding / bird | 满足繁育条件 -> 保育+2、声望+2；满足繁育条件 -> 保育+1、声望+2；满足繁育条件 -> 保育+2 | —；动物标签匹配且有与其大洲相同的合作动物园 |
| 124 | 食肉类动物繁育计划<br>PREDATOR BREEDING PROGRAM | breeding / predator | 满足繁育条件 -> 保育+2、声望+2；满足繁育条件 -> 保育+1、声望+2；满足繁育条件 -> 保育+2 | —；动物标签匹配且有与其大洲相同的合作动物园 |
| 125 | 爬行类动物繁育计划<br>REPTILE BREEDING PROGRAM | breeding / reptile | 满足繁育条件 -> 保育+2、声望+2；满足繁育条件 -> 保育+1、声望+2；满足繁育条件 -> 保育+2 | —；动物标签匹配且有与其大洲相同的合作动物园 |
| 126 | 食草类动物繁育计划<br>HERBIVORE BREEDING PROGRAM | breeding / herbivore | 满足繁育条件 -> 保育+2、声望+2；满足繁育条件 -> 保育+1、声望+2；满足繁育条件 -> 保育+2 | —；动物标签匹配且有与其大洲相同的合作动物园 |
| 127 | 灵长类动物繁育计划<br>PRIMATE BREEDING PROGRAM | breeding / primate | 满足繁育条件 -> 保育+2、声望+2；满足繁育条件 -> 保育+1、声望+2；满足繁育条件 -> 保育+2 | —；动物标签匹配且有与其大洲相同的合作动物园 |
| 128 | 水生态<br>AQUATIC | standard / water | 5 -> 保育+4（水域）；4 -> 保育+3（水域）；2 -> 保育+2（水域） | — |
| 129 | 地质学<br>GEOLOGICAL | standard / rock | 5 -> 保育+4（岩石）；4 -> 保育+3（岩石）；2 -> 保育+2（岩石） | — |
| 130 | 小型动物<br>SMALL ANIMALS | standard / small_animal | 8 -> 保育+4（小型动物）；5 -> 保育+3（小型动物）；2 -> 保育+2（小型动物） | — |
| 131 | 大型动物<br>LARGE ANIMALS | standard / large_animal | 4 -> 保育+4（大型动物）；3 -> 保育+3（大型动物）；2 -> 保育+2（大型动物） | — |
| 132 | 科研<br>RESEARCH | standard / science | 5 -> 保育+4（科研）；4 -> 保育+3（科研）；2 -> 保育+2（科研） | — |

## 终局计分牌（11 张）

| ID | 名称 | 类型 / 指标 | 说明 | 计分 |
|---|---|---|---|---|
| 001 | 大型动物公园<br>Large Animal Zoo | metric_ladder / large_animal_count | 根据你动物园里的 大型动物 ， 获得 {ConservationPoint} 。 | 1 -> 保育1；2 -> 保育2；3 -> 保育3；4 -> 保育4 |
| 002 | 小型动物公园<br>Small Animal Zoo | metric_ladder / small_animal_count | 根据你动物园里的 小型动物 ， 获得 {ConservationPoint} 。 | 3 -> 保育1；6 -> 保育2；8 -> 保育3；10 -> 保育4 |
| 003 | 科研动物园<br>Research Zoo | metric_ladder / science_icon_count | 根据你动物园里的 研究 图标， 获得 {ConservationPoint} 。 | 3 -> 保育1；4 -> 保育2；5 -> 保育3；7 -> 保育4 |
| 004 | 主题建筑动物园<br>Architectural Zoo | independent_conditions / independent_conditions | 根据你动物园里的 建筑物 ， 获得 {ConservationPoint} 。 | 与 所有的水域格相连 ，获得 {ConservationPoint-1} 。 -> 保育1；与 所有的岩石格相连 ，获得 {ConservationPoint-1} 。 -> 保育1；覆盖 所有的边界格 ，获得 {ConservationPoint-1} 。 -> 保育1；完全覆盖 动物园地图 ，获得 {ConservationPoint-1} 。 -> 保育1 |
| 005 | 公益保护动物园<br>Conservation Zoo | metric_ladder / supported_conservation_project_count | 根据你 支持的保护项目 ， 获得 {ConservationPoint} 。 | 2 -> 保育1；3 -> 保育2；4 -> 保育3；5 -> 保育4 |
| 006 | 自然动物园<br>Naturalists Zoo | metric_ladder / empty_buildable_hex_count | 根据你动物园里 空置的可建造 六角格 ，获得 {ConservationPoint} 。 | 6 -> 保育1；12 -> 保育2；18 -> 保育3；24 -> 保育4 |
| 007 | 人气动物园<br>Favorite Zoo | metric_ladder / reputation | 根据你动物园的 声望 ， 获得 {ConservationPoint} 。 | 6 -> 保育1；9 -> 保育2；12 -> 保育3；15 -> 保育4 |
| 008 | 慈善动物园<br>Sponsored Zoo | metric_ladder / sponsor_card_count | 根据你动物园的 赞助商卡牌 ， 获得 {ConservationPoint} 。 | 3 -> 保育1；5 -> 保育2；7 -> 保育3；9 -> 保育4 |
| 009 | 综合物种动物园<br>Diverse Species Zoo | compare_right_hand_neighbor / compare_right_hand_neighbor | 比较你与右手边玩家的动物类目图标数量。 | 你每有一种 动物类目 图标多于你右手边的玩家，获得 {ConservationPoint-1} ，最多 {ConservationPoint-4} 。 -> 保育1 |
| 010 | 岩石公园<br>Climbing Park | metric_ladder / rock_icon_count | 根据你动物园的 岩石 图标， 获得 {ConservationPoint} 。 | 1 -> 保育1；3 -> 保育2；5 -> 保育3；6 -> 保育4 |
| 011 | 水生态公园<br>Aquatic Park | metric_ladder / water_icon_count | 根据你动物园的 水域 图标， 获得 {ConservationPoint} 。 | 2 -> 保育1；4 -> 保育2；6 -> 保育3；7 -> 保育4 |

## 已核对的资料差异

| 卡牌 | 字段 | 采用值 | 说明 |
|---|---|---|---|
| 463 | `cost` | `11` | 社区元数据曾误记为14；卡面为11。 |
| 482 | `placement` | `{"water":1,"rock":1}` | 补齐卡面左上角的临水、临岩要求。 |
| 251 | `placement` | `{"water":1}` | 补齐北极熊展独特建筑的临水要求。 |
| 256 | `printed_rewards.appeal` | `4` | 社区结构化数据漏记；卡面与官方词汇表均为4吸引力。 |
| 261 | `printed_rewards` | `{"appeal":1,"conservation":1}` | 补齐打出时的印刷奖励。 |
| 131 | `support_metric` | `"large_animal"` | 修正社区数据误标的水域计数。 |
| 132 | `support_metric` | `"science"` | 修正规则摘要误写的大型动物说明。 |

## 来源

- [Ark Nova Rulebook](https://capstone-games.com/cdn/shop/files/Ark-Nova-Rulebook.pdf?v=15269496103518830006)：action_cards, play_costs, turn_timing, association_tasks
- [Ark Nova Glossary](https://cdn.shopify.com/s/files/1/0947/3907/1278/files/Ark-Nova-Glossary.pdf?v=1754428544)：animal_abilities, sponsor_effects, release_projects
- [Ark Nova FAQ v2](https://cdn.shopify.com/s/files/1/0947/3907/1278/files/Ark-Nova-FAQ-v2.pdf?v=1754428544)：edge_cases, ability_interactions
- [Next Ark Nova Cards](https://github.com/Ender-Wiggin2019/Next-Ark-Nova-Cards)：card_ids, names, localized_text, metadata_cross_check
- [Ark Nova Cards Manager](https://github.com/PixelT/ArkNovaCardsManager)：visual_cross_check_only
- [方舟动物园 Ark Nova (Tabletop Simulator Workshop)](https://steamcommunity.com/sharedfiles/filedetails/?id=3527313436)：unique_building_footprints, component_cross_check
