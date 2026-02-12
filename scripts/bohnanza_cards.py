import json
import random
import os

OUTPUT_DIR = "./game/assets"
OUTPUT_FILE = "bohnanza_cards.json"
TOTAL_CARDS_TO_GENERATE = 50 # 基础版通常有几十张卡，你可以生成更多

# --- 豆子定义 ---
# 稀有度参考：
# Blue (常见), Fire, Puff, Turkey, Runner, Soy (白骰子独有), Garden (黄骰子独有, 稀有)
BEANS = ["Blue", "Fire", "Puff", "Turkey", "Runner", "Soy", "Garden"]

# --- 任务模板池 ---
# 为了保证游戏平衡，我们不完全随机生成，而是从合法的“任务原型”中随机抽取参数
# 格式: {"type": 逻辑类型, "args": 参数, "desc": 描述模板}

TASK_POOLS = {
    1: [ # Level 1: 极易 (通常只需要2颗骰子)
        {"type": "count", "targets": {"Blue": 2}, "desc": "2x Blue"},
        {"type": "count", "targets": {"Fire": 2}, "desc": "2x Fire"},
        {"type": "set",   "targets": {"Blue": 1, "Fire": 1}, "desc": "1 Blue + 1 Fire"},
        {"type": "set",   "targets": {"Blue": 1, "Puff": 1}, "desc": "1 Blue + 1 Puff"},
        {"type": "any_kind", "count": 2, "desc": "2x Any Same Bean (Pair)"}
    ],
    2: [ # Level 2: 容易 (需要3颗常见骰子 或 2颗较难骰子)
        {"type": "count", "targets": {"Blue": 3}, "desc": "3x Blue"},
        {"type": "count", "targets": {"Turkey": 2}, "desc": "2x Turkey"},
        {"type": "count", "targets": {"Runner": 2}, "desc": "2x Runner"},
        {"type": "set",   "targets": {"Fire": 1, "Puff": 1, "Turkey": 1}, "desc": "1 Fire + 1 Puff + 1 Turkey"},
        {"type": "set",   "targets": {"Blue": 2, "Fire": 1}, "desc": "2 Blue + 1 Fire"}
    ],
    3: [ # Level 3: 中等 (Checkpoint - 1金币)
        {"type": "count", "targets": {"Soy": 2}, "desc": "2x Soy (White Dice only)"},
        {"type": "set",   "targets": {"Blue": 1, "Fire": 1, "Puff": 1, "Turkey": 1}, "desc": "Blue, Fire, Puff, Turkey"},
        {"type": "any_kind", "count": 3, "desc": "3x Any Same Bean (Three of a Kind)"},
        {"type": "set",   "targets": {"Runner": 1, "Soy": 1}, "desc": "1 Runner + 1 Soy"},
        {"type": "set",   "targets": {"Turkey": 2, "Blue": 1}, "desc": "2 Turkey + 1 Blue"}
    ],
    4: [ # Level 4: 困难 (涉及 Garden 或 4颗骰子)
        {"type": "count", "targets": {"Garden": 1}, "desc": "1x Garden (Yellow Dice only)"},
        {"type": "set",   "targets": {"Soy": 1, "Garden": 1}, "desc": "1 Soy + 1 Garden"},
        {"type": "any_kind", "count": 4, "desc": "4x Any Same Bean"},
        {"type": "full_house", "desc": "Full House (3x A + 2x B)"},
        {"type": "set",   "targets": {"Blue": 1, "Fire": 1, "Puff": 1, "Turkey": 1, "Runner": 1}, "desc": "Small Street (No Soy/Garden)"}
    ],
    5: [ # Level 5: 极难 (3金币, 往往需要完美运气)
        {"type": "count", "targets": {"Garden": 2}, "desc": "2x Garden (Max possible)"},
        {"type": "any_kind", "count": 5, "desc": "5x Any Same Bean (Yahtzee)"},
        {"type": "street", "desc": "Street (1 of each: Blue, Fire, Puff, Turkey, Runner/Soy/Garden)"},
        {"type": "set",   "targets": {"Soy": 3}, "desc": "3x Soy (All White Dice)"},
        {"type": "set",   "targets": {"Blue": 2, "Fire": 2, "Garden": 1}, "desc": "2 Blue + 2 Fire + 1 Garden"}
    ]
}

def generate_task(level):
    """从池中随机选择并微调生成一个任务"""
    pool = TASK_POOLS[level]
    template = random.choice(pool)
    
    # 深拷贝以防修改模板
    task = template.copy()
    task["level"] = level
    
    return task

def main():
    if not os.path.exists(OUTPUT_DIR):
        os.makedirs(OUTPUT_DIR)
        
    cards = []
    
    for i in range(TOTAL_CARDS_TO_GENERATE):
        card_id = i + 1
        card_tasks = []
        
        # 为这张卡生成 5 个层级的任务
        for level in range(1, 6):
            card_tasks.append(generate_task(level))
            
        cards.append({
            "id": card_id,
            "tasks": card_tasks # 数组索引 0 对应 Level 1
        })
    
    file_path = os.path.join(OUTPUT_DIR, OUTPUT_FILE)
    
    with open(file_path, "w", encoding="utf-8") as f:
        json.dump(cards, f, indent=2, ensure_ascii=False)
        
    print(f"Success! Generated {TOTAL_CARDS_TO_GENERATE} cards at: {file_path}")

if __name__ == "__main__":
    main()