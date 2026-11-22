from typing import Dict, List


def _card(card_id: str, name: str, name_zh: str, color: str, category: str,
          cost: int, rolls: List[int], expansion: str, effect: str, zh: str) -> Dict:
    return {"id": card_id, "name": name, "name_zh": name_zh, "color": color,
            "category": category, "cost": cost, "rolls": rolls, "expansion": expansion,
            "effect": effect, "effect_zh": zh}


_CARDS = [
    _card("wheat_field", "Wheat Field", "麦田", "blue", "grain", 1, [1], "base", "Get 1 coin from the bank on anyone's turn.", "任何人的回合，从银行获得1金币。"),
    _card("ranch", "Ranch", "牧场", "blue", "animal", 1, [2], "base", "Get 1 coin from the bank on anyone's turn.", "任何人的回合，从银行获得1金币。"),
    _card("bakery", "Bakery", "面包店", "green", "shop", 1, [2, 3], "base", "On your turn, get 1 coin from the bank.", "自己的回合，从银行获得1金币。"),
    _card("cafe", "Cafe", "咖啡馆", "red", "restaurant", 2, [3], "base", "On an opponent's turn, take 1 coin from the active player.", "对手的回合，从当前玩家收取1金币。"),
    _card("convenience_store", "Convenience Store", "便利店", "green", "shop", 2, [4], "base", "On your turn, get 3 coins from the bank.", "自己的回合，从银行获得3金币。"),
    _card("forest", "Forest", "森林", "blue", "resource", 3, [5], "base", "Get 1 coin from the bank on anyone's turn.", "任何人的回合，从银行获得1金币。"),
    _card("stadium", "Stadium", "体育场", "purple", "major", 6, [6], "base", "On your turn, take 2 coins from each opponent.", "自己的回合，从每位对手收取2金币。"),
    _card("tv_station", "TV Station", "电视台", "purple", "major", 7, [6], "base", "On your turn, take 5 coins from one opponent of your choice.", "自己的回合，选择一位对手并收取5金币。"),
    _card("business_center", "Business Center", "商务中心", "purple", "major", 8, [6], "base", "You may exchange one of your non-Major establishments with an opponent's non-Major establishment. Renovation tokens travel with cards.", "可以与一位对手交换各一张非紫色设施，装修标记随卡转移。"),
    _card("cheese_factory", "Cheese Factory", "奶酪工厂", "green", "factory", 5, [7], "base", "Get 3 coins for each animal establishment you own, including closed ones.", "每拥有一张畜牧设施获得3金币，装修中的设施也计数。"),
    _card("furniture_factory", "Furniture Factory", "家具工厂", "green", "factory", 3, [8], "base", "Get 3 coins for each resource establishment you own, including closed ones.", "每拥有一张资源设施获得3金币，装修中的设施也计数。"),
    _card("mine", "Mine", "矿山", "blue", "resource", 6, [9], "base", "Get 5 coins from the bank on anyone's turn.", "任何人的回合，从银行获得5金币。"),
    _card("family_restaurant", "Family Restaurant", "家庭餐厅", "red", "restaurant", 3, [9, 10], "base", "On an opponent's turn, take 2 coins from the active player.", "对手的回合，从当前玩家收取2金币。"),
    _card("apple_orchard", "Apple Orchard", "苹果园", "blue", "grain", 3, [10], "base", "Get 3 coins from the bank on anyone's turn.", "任何人的回合，从银行获得3金币。"),
    _card("produce_market", "Fruit & Vegetable Market", "果蔬市场", "green", "market", 2, [11, 12], "base", "Get 2 coins for each grain establishment you own, including closed ones.", "每拥有一张农作物设施获得2金币，装修中的设施也计数。"),
    _card("sushi_bar", "Sushi Bar", "寿司店", "red", "restaurant", 4, [1], "harbor", "If you own a Harbor, take 3 coins from the active opponent.", "拥有港口时，从当前行动的对手收取3金币。"),
    _card("flower_garden", "Flower Garden", "花田", "blue", "grain", 2, [4], "harbor", "Get 1 coin from the bank on anyone's turn.", "任何人的回合，从银行获得1金币。"),
    _card("flower_shop", "Flower Shop", "花店", "green", "shop", 1, [6], "harbor", "Get 1 coin for each Flower Garden you own, or 2 per garden with Shopping Mall.", "每拥有一张花田获得1金币，拥有购物中心时每张花田获得2金币。"),
    _card("pizza_joint", "Pizza Joint", "披萨店", "red", "restaurant", 1, [7], "harbor", "Take 1 coin from the active opponent.", "从当前行动的对手收取1金币。"),
    _card("hamburger_stand", "Hamburger Stand", "汉堡店", "red", "restaurant", 1, [8], "harbor", "Take 1 coin from the active opponent.", "从当前行动的对手收取1金币。"),
    _card("mackerel_boat", "Mackerel Boat", "鲭鱼船", "blue", "boat", 2, [8], "harbor", "If you own a Harbor, get 3 coins from the bank.", "拥有港口时，从银行获得3金币。"),
    _card("tuna_boat", "Tuna Boat", "金枪鱼船", "blue", "boat", 5, [12, 13, 14], "harbor", "With a Harbor, get the total of a separate two-dice roll per boat. All Tuna Boats share that roll.", "拥有港口时，每艘船获得额外投掷两骰的点数总和。所有金枪鱼船共用这次额外骰点。"),
    _card("food_warehouse", "Food Warehouse", "食品仓库", "green", "factory", 2, [12, 13], "harbor", "Get 2 coins for each restaurant establishment you own.", "每拥有一张餐饮设施获得2金币。"),
    _card("publisher", "Publisher", "出版社", "purple", "major", 5, [7], "harbor", "Take 1 coin from each opponent for each shop and restaurant they own.", "每位对手每拥有一张商店或餐饮设施，就向你支付1金币。"),
    _card("tax_office", "Tax Office", "税务局", "purple", "major", 4, [8, 9], "harbor", "From each opponent with at least 10 coins, take half their coins, rounded down.", "向每位至少拥有10金币的对手收取其金币的一半，向下取整。"),
    _card("corn_field", "Corn Field", "玉米田", "blue", "grain", 2, [3, 4], "millionaires", "If you have fewer than 2 built landmarks, get 1 coin from the bank.", "已建地标少于2座时，从银行获得1金币。"),
    _card("general_store", "General Store", "杂货店", "green", "shop", 0, [2], "millionaires", "If you have fewer than 2 built landmarks, get 2 coins from the bank.", "已建地标少于2座时，从银行获得2金币。"),
    _card("vineyard", "Vineyard", "葡萄园", "blue", "grain", 3, [7], "millionaires", "Get 3 coins from the bank on anyone's turn.", "任何人的回合，从银行获得3金币。"),
    _card("demolition_company", "Demolition Company", "拆迁公司", "green", "company", 2, [4], "millionaires", "If possible, you must demolish one of your built landmarks and get 8 coins from the bank.", "若有已建地标，必须拆除其中一座并从银行获得8金币。"),
    _card("loan_office", "Loan Office", "贷款公司", "green", "company", -5, [5, 6], "millionaires", "Receive 5 coins when building this card. When activated, pay 2 coins to the bank, or as much as you can.", "建造时获得5金币。触发时向银行支付2金币，不足则付清现有金币。"),
    _card("moving_company", "Moving Company", "搬家公司", "green", "company", 2, [9, 10], "millionaires", "Give one of your non-Major establishments to an opponent, then get 4 coins from the bank. You may give this card itself.", "将自己的一张非紫色设施交给一位对手，然后从银行获得4金币，可以送出搬家公司自身。"),
    _card("winery", "Winery", "酿酒厂", "green", "factory", 3, [9], "millionaires", "Get 6 coins per Vineyard you own, then close this Winery for renovation. Its next activation only reopens it.", "每张自有葡萄园带来6金币，然后本酿酒厂停业装修。下次触发只复业，不获得收益。"),
    _card("soda_bottling_plant", "Soda Bottling Plant", "汽水工厂", "green", "factory", 5, [11], "millionaires", "Get 1 coin for each restaurant establishment owned by all players.", "全体玩家每拥有一张餐饮设施，你就获得1金币。"),
    _card("french_restaurant", "French Restaurant", "法国餐厅", "red", "restaurant", 3, [5], "millionaires", "If the active opponent has at least 2 built landmarks, take 5 coins from them.", "当前行动的对手已建至少2座地标时，向其收取5金币。"),
    _card("private_club", "Private Club", "私人俱乐部", "red", "restaurant", 4, [12, 13, 14], "millionaires", "If the active opponent has at least 3 built landmarks, take all their coins.", "当前行动的对手已建至少3座地标时，收取其全部金币。"),
    _card("exhibit_hall", "Exhibit Hall", "展览馆", "purple", "major", 7, [10], "millionaires", "You may activate one of your non-Major establishments instead. If you do, return this Exhibit Hall to the supply.", "可以改为触发自己的一张非紫色设施。若这样做，将本展览馆退回市场。"),
    _card("park", "Park", "公园", "purple", "major", 3, [11, 12, 13], "millionaires", "Pool everyone's coins and give each player an equal share, rounded up. The bank supplies the difference.", "合并所有人的金币后平均分配，每人所得向上取整，差额由银行补足。"),
    _card("renovation_company", "Renovation Company", "装修公司", "purple", "major", 4, [8], "millionaires", "Choose a non-Major type. Close everyone's cards of that type. Take 1 coin from each opponent per newly closed card.", "选择一种非紫色设施，所有人该类设施停业装修。每使对手的一张设施新停业，就向其收取1金币。"),
    _card("tech_startup", "Tech Startup", "科技公司", "purple", "major", 1, [10], "millionaires", "Take your invested amount from each opponent. At the end of your turn you may invest exactly 1 coin. Investments cannot be spent.", "触发时向每位对手收取等于投资额的金币。自己回合结束可投资恰好1金币，投资不能取回或用于建造。"),
]
CARDS = {card["id"]: card for card in _CARDS}
LANDMARKS = {
    "train_station": {"name": "Train Station", "name_zh": "火车站", "cost": 4, "expansion": "base", "effect": "You may roll one or two dice.", "effect_zh": "每回合可以选择掷一骰或两骰。"},
    "shopping_mall": {"name": "Shopping Mall", "name_zh": "购物中心", "cost": 10, "expansion": "base", "effect": "Each shop and restaurant earns 1 extra coin when it earns income.", "effect_zh": "每张产生收益的商店或餐饮设施额外获得1金币。"},
    "amusement_park": {"name": "Amusement Park", "name_zh": "游乐园", "cost": 16, "expansion": "base", "effect": "If your final two dice show doubles, take another turn after this turn.", "effect_zh": "最终两骰相同时，本回合结束后再进行一个回合。"},
    "radio_tower": {"name": "Radio Tower", "name_zh": "广播塔", "cost": 22, "expansion": "base", "effect": "Once per turn you may reroll all the dice. You may change the number of dice if you have a Train Station.", "effect_zh": "每回合可以重掷全部骰子一次。有火车站时可以改变重掷的骰子数量。"},
    "harbor": {"name": "Harbor", "name_zh": "港口", "cost": 2, "expansion": "harbor", "effect": "After rolling 10 or more, you may add 2 to the activation total. Enables your fishing boats and Sushi Bars.", "effect_zh": "骰点总和至少10时，可以为触发点数增加2。启用自己的渔船和寿司店。"},
    "airport": {"name": "Airport", "name_zh": "机场", "cost": 30, "expansion": "harbor", "effect": "If you build nothing on your turn, get 10 coins from the bank.", "effect_zh": "若本回合不建造任何设施或地标，获得10金币。"},
}
