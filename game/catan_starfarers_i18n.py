"""Chinese copy for the original CATAN: Starfarers data set."""

from __future__ import annotations

from typing import Dict


RESOURCE_ZH = {
    "ore": "矿石",
    "fuel": "燃料",
    "carbon": "碳素",
    "food": "食物",
    "goods": "货物",
}

UPGRADE_ZH = {
    "booster": "推进器",
    "cannon": "火炮",
    "freight": "货舱环",
}

SHIP_ZH = {
    "colony": "殖民船",
    "trade": "贸易船",
}

SETUP_ZH = {
    "beginner": "新手",
    "strategic": "战略",
    "explorer": "探索",
    "wild_space": "未知宇宙",
}

BALL_ZH = {
    "blue": "蓝球",
    "yellow": "黄球",
    "red": "红球",
    "black": "黑球",
}

CIVILIZATION_ZH = {
    "diplomats": "外交官",
    "merchants": "商人",
    "green_folk": "绿族",
    "scientists": "科学家",
}

SECTOR_ZH = {
    "system-red-dwarf": "红矮星",
    "system-amber-cloud": "琥珀云",
    "outpost-travelers": "外交官中继站",
    "outpost-merchants": "商人交易所",
    "system-cobalt-rift": "钴蓝裂隙",
    "system-verdant-twin": "翠绿双星",
    "system-violet-ice": "紫罗兰冰原",
    "empty-silent-drift": "寂静漂流区",
    "outpost-green-folk": "绿族花园",
    "system-iron-maelstrom": "钢铁漩涡",
    "outpost-scientists": "科学家阵列",
    "empty-blue-veil": "蓝色帷幕",
    "system-frozen-orchard": "冰封果园",
    "empty-ion-shoal": "离子浅滩",
    "system-black-anchor": "黑锚星区",
    "empty-far-horizon": "遥远地平线",
}

FRIENDSHIP_ZH: Dict[str, Dict[str, str]] = {
    "diplomats-open-hold": {"name": "开放货舱", "description": "你的贡税手牌上限为12张。"},
    "diplomats-relief": {"name": "救济宪章", "description": "立即获得1点声望。"},
    "diplomats-envoy": {"name": "深空使节", "description": "立即获得1点声望。"},
    "diplomats-concord": {"name": "星际协约", "description": "立即获得1点声望。"},
    "diplomats-hospitality": {"name": "好客之道", "description": "立即抽取1张地球后备牌。"},
    "merchants-ore": {"name": "矿石交易所", "description": "以2:1与供应区交易矿石。"},
    "merchants-fuel": {"name": "燃料交易所", "description": "以2:1与供应区交易燃料。"},
    "merchants-carbon": {"name": "碳素交易所", "description": "以2:1与供应区交易碳素。"},
    "merchants-food": {"name": "食物交易所", "description": "以2:1与供应区交易食物。"},
    "merchants-goods": {"name": "货物经纪", "description": "每回合一次，你可以1:1交易货物。"},
    "green-folk-ore": {"name": "矿石培育", "description": "生产矿石时额外获得1份矿石。"},
    "green-folk-fuel": {"name": "燃料花簇", "description": "生产燃料时额外获得1份燃料。"},
    "green-folk-carbon": {"name": "碳素林地", "description": "生产碳素时额外获得1份碳素。"},
    "green-folk-food": {"name": "食物花园", "description": "生产食物时额外获得1份食物。"},
    "green-folk-goods": {"name": "活体工坊", "description": "生产货物时额外获得1份货物。"},
    "scientists-cannon-2": {"name": "脉冲炮组", "description": "对抗海盗基地时，有效火炮等级+2。"},
    "scientists-booster-2": {"name": "折跃透镜", "description": "飞行速度+2。"},
    "scientists-hybrid-a": {"name": "矢量实验室", "description": "有效火炮等级+1，飞行速度+1。"},
    "scientists-hybrid-b": {"name": "场域实验室", "description": "有效火炮等级+1，飞行速度+1。"},
    "scientists-hybrid-c": {"name": "轨道实验室", "description": "有效火炮等级+1，飞行速度+1。"},
}

ENCOUNTER_ZH: Dict[str, Dict] = {
    "encounter-01": {
        "title": "漂流中继器", "prompt": "一座寂静的中继器翻滚着穿过你的航线。",
        "options": {
            "repair": {"label": "花费1燃料进行维修", "result": "中继器将你的呼号传遍了边疆。"},
            "scan": {"label": "保持距离进行扫描", "result": "货运登记表为你带来一批有用物资。"},
        },
    },
    "encounter-02": {
        "title": "太阳尾流", "prompt": "一道新生的太阳尾流可以把你的舰队推向前方。",
        "options": {
            "ride": {"label": "乘上尾流", "result": "这次冒险弹射让每艘未完成移动的飞船增加2点移动力。"},
            "shelter": {"label": "躲到小卫星后方", "result": "等待期间，你收集到了一份凝结燃料。"},
        },
    },
    "encounter-03": {
        "title": "边疆庆典", "prompt": "一座偏远空间站邀请你的船员参加发射庆典。",
        "options": {
            "sponsor": {"label": "花费1货物赞助庆典", "result": "空间站为你的慷慨举行了盛大庆祝。"},
            "visit": {"label": "短暂到访", "result": "当地种植者为你的厨房补充了食物。"},
        },
    },
    "encounter-04": {
        "title": "微流星雨", "prompt": "闪耀的微流星带逐渐包围了舰队。",
        "options": {
            "push": {"label": "全速冲过", "result": "你成功抢先穿越，但散装货物受到损坏。"},
            "brace": {"label": "稳住舰身并保护货舱", "result": "谨慎通行耗费了时间，但保住了货物。"},
        },
    },
    "encounter-05": {
        "title": "废弃铸造厂", "prompt": "一座自动铸造厂仍会响应基础指令。",
        "options": {
            "restart": {"label": "花费1碳素重启工厂", "result": "铸造厂打印出一枚免费的推进器。"},
            "salvage": {"label": "拆取外部框架", "result": "你回收了一批矿石。"},
        },
    },
    "encounter-06": {
        "title": "海关浮标", "prompt": "海关浮标要求你自愿申报货物。",
        "options": {
            "declare": {"label": "归还1份随机资源", "result": "规范的申报手续为你赢得公开赞誉。"},
            "detour": {"label": "绕行远路", "result": "绕行途中平安无事。"},
        },
    },
    "encounter-07": {
        "title": "碳素彗星", "prompt": "一颗多孔彗星携带着异常纯净的碳素。",
        "options": {
            "mine": {"label": "停船开采", "result": "船员装载了2份碳素。"},
            "chart": {"label": "为其他旅行者绘制星图", "result": "共享星图为你赢得1点声望。"},
        },
    },
    "encounter-08": {
        "title": "求救信标", "prompt": "一艘受损勘探船正在广播求救信号。",
        "options": {
            "tow": {"label": "花费1燃料将其拖回家园", "result": "获救船员向所有人讲述了你的援助。"},
            "supplies": {"label": "留下应急食物", "result": "信标记录下了你的善举。"},
        },
    },
    "encounter-09": {
        "title": "引力结", "prompt": "前方空间折叠成一道狭窄的引力结。",
        "options": {
            "thread": {"label": "穿过中心", "result": "精准点火为舰队增加3点移动力。"},
            "edge": {"label": "沿边缘绕行", "result": "舰队保持原定航线。"},
        },
    },
    "encounter-10": {
        "title": "海盗诱饵", "prompt": "海盗诱饵正试图把你的护航舰引开。",
        "options": {
            "challenge": {"label": "挑战该信号", "result": "你的火炮信号吓退了伏击者。"},
            "withdraw": {"label": "脱离接触", "result": "一艘飞船在本次飞行剩余时间内必须原地待命。"},
        },
    },
    "encounter-11": {
        "title": "真菌方舟", "prompt": "一艘活体方舟愿用孢子交换补给。",
        "options": {
            "trade": {"label": "花费1食物", "result": "方舟用2份货物交换了食物。"},
            "observe": {"label": "不靠港进行观察", "result": "这次观测为你的记录增加1点声望。"},
        },
    },
    "encounter-12": {
        "title": "冷反应堆", "prompt": "一座休眠反应堆还能支持最后一次制造循环。",
        "options": {
            "freight": {"label": "打印货舱环", "result": "反应堆完成了一枚免费的货舱环。"},
            "cannon": {"label": "打印火炮", "result": "反应堆完成了一门免费火炮。"},
        },
    },
    "encounter-13": {
        "title": "星尘采收", "prompt": "一条富含矿物的尘埃带横穿你的航线。",
        "options": {
            "filter": {"label": "过滤高密度核心", "result": "过滤器收集了2份矿石。"},
            "fast": {"label": "保持编队", "result": "舰队增加1点移动力。"},
        },
    },
    "encounter-14": {
        "title": "游牧市场", "prompt": "游牧商人在航线旁开设了一个短暂市场。",
        "options": {
            "buy": {"label": "花费1矿石购买补给", "result": "商人交给你1食物和1燃料。"},
            "news": {"label": "交换导航情报", "result": "游牧者把你的名字加入了航线图。"},
        },
    },
    "encounter-15": {
        "title": "引擎谐振", "prompt": "奇异共振震动着每一座引擎支架。",
        "options": {
            "tune": {"label": "花费1燃料调校引擎", "result": "同步后的引擎增加2点移动力。"},
            "idle": {"label": "短暂关闭动力", "result": "震动消退，舰队未受损伤。"},
        },
    },
    "encounter-16": {
        "title": "档案舱", "prompt": "一座密封档案舱正在寻找新的保管人。",
        "options": {
            "open": {"label": "打开档案", "result": "找回的星图带来2点声望，但易碎货物有所损失。"},
            "deliver": {"label": "保持密封并送达", "result": "接收网络给予你1点声望。"},
        },
    },
    "encounter-17": {
        "title": "离子飑", "prompt": "一场离子飑正面席卷舰队。",
        "options": {
            "shield": {"label": "花费1碳素加固护盾", "result": "临时护盾让舰队保持了速度。"},
            "weather": {"label": "硬抗风暴", "result": "一件实体升级被震落。"},
        },
    },
    "encounter-18": {
        "title": "燃料云花", "prompt": "一团发光云雾中悬浮着稳定的燃料液滴。",
        "options": {
            "collect": {"label": "收集液滴", "result": "货舱获得2份燃料。"},
            "broadcast": {"label": "广播坐标", "result": "分享发现为你赢得1点声望。"},
        },
    },
    "encounter-19": {
        "title": "轨道厨房", "prompt": "一家著名轨道厨房急需一批配送。",
        "options": {
            "deliver": {"label": "花费2食物", "result": "感激的厨师们奖励你3点声望。"},
            "sample": {"label": "与工作人员交换故事", "result": "离开时你获得1份食物。"},
        },
    },
    "encounter-20": {
        "title": "磁性残骸", "prompt": "一艘残骸的磁场正吸附附近的金属。",
        "options": {
            "salvage": {"label": "冒险近距离打捞", "result": "你回收了一门免费火炮，但损失1份随机资源。"},
            "mark": {"label": "标记危险区", "result": "安全警示为你赢得1点声望。"},
        },
    },
    "encounter-21": {
        "title": "静默船队", "prompt": "一支安静的船队请求与你共享导航走廊。",
        "options": {
            "escort": {"label": "护送船队", "result": "船队的感谢化为2点声望。"},
            "coordinates": {"label": "发送航线坐标", "result": "船队转交给你1份货物。"},
        },
    },
    "encounter-22": {
        "title": "原型引擎", "prompt": "研究团队提供了一台不稳定的原型引擎。",
        "options": {
            "test": {"label": "测试原型机", "result": "引擎增加3点移动力，随后消耗1份随机资源。"},
            "decline": {"label": "谢绝并查看笔记", "result": "研究笔记免费改进了一枚推进器。"},
        },
    },
    "encounter-23": {
        "title": "彗星修道院", "prompt": "一座雕刻在彗星中的修道院欢迎旅行者。",
        "options": {
            "donate": {"label": "捐赠1货物", "result": "这笔捐赠被整个边疆铭记。"},
            "rest": {"label": "与看护者一同休息", "result": "他们补充了1份食物。"},
        },
    },
    "encounter-24": {
        "title": "矿石小卫星", "prompt": "一颗小卫星表面遍布裸露矿脉。",
        "options": {
            "extract": {"label": "开采2份矿石", "result": "短暂采矿让两个货舱装满矿石。"},
            "survey": {"label": "发布公开勘测报告", "result": "勘测报告为你赢得1点声望。"},
        },
    },
    "encounter-25": {
        "title": "信号花园", "prompt": "一片自主信标花园开始复制你的信号。",
        "options": {
            "compose": {"label": "编写问候信息", "result": "问候广为传播，为你赢得2点声望。"},
            "harvest": {"label": "收取一枚闲置电池", "result": "电池提供1份燃料。"},
        },
    },
    "encounter-26": {
        "title": "货运抽签", "prompt": "一家货运合作社提供一个密封集装箱。",
        "options": {
            "open": {"label": "打开集装箱", "result": "里面是一枚免费的货舱环。"},
            "resell": {"label": "转售提货权", "result": "提货权换来1份货物。"},
        },
    },
    "encounter-27": {
        "title": "不稳定星门", "prompt": "一座不稳定星门在两个安全校准点之间闪烁。",
        "options": {
            "enter": {"label": "进入星门", "result": "跃迁增加4点移动力，但会剥离一件实体升级。"},
            "bypass": {"label": "绕过星门", "result": "你保全舰队并收集到1份碳素。"},
        },
    },
    "encounter-28": {
        "title": "边疆直播", "prompt": "一场边疆直播邀请舰长分享故事。",
        "options": {
            "story": {"label": "参加直播", "result": "访谈为你增加1点声望。"},
            "sponsor": {"label": "花费1货物赞助节目", "result": "赞助节目为你增加3点声望。"},
        },
    },
    "encounter-29": {
        "title": "冰封天线", "prompt": "一座冰封天线保存着宝贵的航线日志。",
        "options": {
            "thaw": {"label": "花费1燃料解冻", "result": "航线日志增加2点移动力和1点声望。"},
            "leave": {"label": "留下警示标记", "result": "警示标记为你增加1点声望。"},
        },
    },
    "encounter-30": {
        "title": "船壳合唱", "prompt": "共鸣晶体让每一艘船的外壳和谐歌唱。",
        "options": {
            "record": {"label": "记录共鸣", "result": "这段录音为你赢得2点声望。"},
            "collect": {"label": "收集晶体碎片", "result": "碎片可作为1份碳素和1份矿石。"},
        },
    },
    "encounter-31": {
        "title": "应急船坞", "prompt": "一座应急船坞关闭前可提供一次快速改装。",
        "options": {
            "booster": {"label": "安装推进器", "result": "船坞免费安装了一枚推进器。"},
            "freight": {"label": "安装货舱环", "result": "船坞免费安装了一枚货舱环。"},
        },
    },
    "encounter-32": {
        "title": "最后的光", "prompt": "一座渐暗的信标只剩发送最后一条消息的能量。",
        "options": {
            "carry": {"label": "替它继续传递消息", "result": "这份承诺带来2点声望，但一艘飞船必须留下下载数据。"},
            "salvage": {"label": "回收剩余电池", "result": "电池提供1份燃料。"},
        },
    },
}


def validate_translations(
    sector_ids: set[str], friendship_ids: set[str], encounter_options: Dict[str, set[str]]
) -> None:
    if set(SECTOR_ZH) != sector_ids:
        raise ValueError("Chinese sector translations are incomplete")
    if set(FRIENDSHIP_ZH) != friendship_ids:
        raise ValueError("Chinese friendship translations are incomplete")
    if set(ENCOUNTER_ZH) != set(encounter_options):
        raise ValueError("Chinese encounter translations are incomplete")
    for encounter_id, option_ids in encounter_options.items():
        translated = ENCOUNTER_ZH[encounter_id]
        if not translated.get("title") or not translated.get("prompt"):
            raise ValueError(f"Chinese encounter copy is incomplete: {encounter_id}")
        if set(translated.get("options", {})) != option_ids:
            raise ValueError(f"Chinese encounter options are incomplete: {encounter_id}")
        for option_id in option_ids:
            option = translated["options"][option_id]
            if not option.get("label") or not option.get("result"):
                raise ValueError(f"Chinese encounter option copy is incomplete: {encounter_id}/{option_id}")


__all__ = [
    "BALL_ZH",
    "CIVILIZATION_ZH",
    "ENCOUNTER_ZH",
    "FRIENDSHIP_ZH",
    "RESOURCE_ZH",
    "SECTOR_ZH",
    "SETUP_ZH",
    "SHIP_ZH",
    "UPGRADE_ZH",
    "validate_translations",
]
