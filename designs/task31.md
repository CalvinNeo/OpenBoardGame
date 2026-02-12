# 《秒懂心领神会》(Just One) 游戏规则与电子化实现设计文档

## 1. 游戏概述 (Overview)
《秒懂心领神会》是一款**多人合作**的派对猜词游戏。所有玩家作为一个团队，目标是尽可能获得高分。
* **玩家人数**：3 - 7人
* **游戏目标**：在一局游戏中（通常为13张牌），尽可能多地猜对单词。
* **核心机制**：一名玩家猜词，其他玩家每人提供一个线索词。**核心规则是：如果有两个或以上的玩家提供了相同的线索，这些线索会被互相“抵消”（抹去），猜词者将无法看到这些线索。**

---

## 2. 核心数据结构 (Data Structures)

为了实现电子版，需要定义以下核心对象：

### 2.1 词库 (Card Database)
每一张卡牌包含5个备选词（通常对应数字1-5）。
```json
{
  "card_id": 1001,
  "words": {
    "1": "巧克力",
    "2": "金字塔",
    "3": "蝙蝠侠",
    "4": "过山车",
    "5": "企鹅"
  }
}
```

### 2.2 游戏状态 (Game State)
```typescript
enum GamePhase {
  SETUP,           // 设置阶段
  PICK_WORD,       // 猜词者选号阶段
  GIVE_CLUES,      // 线索提供阶段
  FILTER_CLUES,    // 系统/玩家查重阶段 (核心逻辑)
  GUESS_WORD,      // 猜词阶段
  RESULT,          // 单轮结算
  GAME_OVER        // 终局结算
}

interface GameRoom {
  deck: Card[];          // 剩余牌库 (通常13张)
  score: number;         // 当前得分
  current_round: number;
  players: Player[];
  active_player_index: number; // 当前猜词者
  target_word: string;   // 本轮目标词
  clues: Map<PlayerId, string>; // 玩家提交的线索
  valid_clues: string[]; // 经过筛选后展示给猜词者的线索
}
```

---

## 3. 详细游戏流程与逻辑 (Game Loop & Logic)

### 阶段一：回合开始 (Round Start)
1.  从牌库中抽取一张卡牌。
2.  指定一名玩家为**“猜词者” (Guesser)**。
3.  其他玩家为**“线索者” (Clue Givers)**。
4.  **UI逻辑**：
    * 猜词者屏幕：显示“等待选择数字1-5”或随机盲选。不可见卡牌内容。
    * 线索者屏幕：显示卡牌正面（但不知道具体是哪个词，直到猜词者选择）。

### 阶段二：选择目标词 (Target Selection)
1.  猜词者从 1-5 中选择一个数字。
2.  系统锁定该卡牌对应数字的单词为 `target_word`。
3.  **UI逻辑**：
    * 猜词者屏幕：显示“你选择了数字X，请等待队友提供线索”。
    * 线索者屏幕：显示目标单词（例如：“巧克力”）。

### 阶段三：提供线索 (Submission)
1.  所有线索者必须输入**一个**线索词。
2.  **线索限制规则**（需在前端提示或后端校验）：
    * 只能写一个词（不能是句子）。
    * 不能包含目标词本身或其变体（如：目标“王子”，不能提示“王”）。
    * 不能是目标词的翻译。
    * 不能是方言或同音异义词的直接发音提示。
3.  **系统逻辑**：等待所有线索者提交完毕 `InputState` 变为 `Done`。

### 阶段四：线索查重与抵消 (Clue Comparison & Cancellation) —— **核心开发难点**
这是游戏最关键的步骤。电子版可以自动处理，也可以增加人工仲裁环节。

**算法逻辑**：
1.  收集所有提交的线索 `raw_clues`。
2.  **标准化处理 (Normalization)**：
    * 去除首尾空格。
    * 统一大小写（英文环境）。
    * （可选）中文简繁转换统一。
3.  **查重比较 (Duplicate Detection)**：
    * 遍历所有线索。
    * 如果有 >= 2 个线索在标准化后相同，标记为 `INVALID`。
    * **模糊匹配规则（进阶实现）**：
        * 同词根判定：例如 "Prince" 和 "Princess" 在严格规则下算重复。
        * 包含关系：例如 "苹果" 和 "红苹果" 在严格规则下通常算重复。
    * *电子版建议实现方式*：自动检测完全相同的词。对于“相似但不完全相同”的词，展示给线索者确认是否算作重复（投票机制）。
4.  **生成有效线索列表**：
    * `valid_clues = all_clues - duplicate_clues - illegal_clues`
5.  **特殊情况**：如果所有线索都被抵消，`valid_clues` 为空。

### 阶段五：猜词 (Guessing)
1.  **UI逻辑**：
    * 线索者屏幕：显示哪些线索被保留了，哪些被抵消了（显示被划掉的效果）。
    * 猜词者屏幕：**只显示** `valid_clues`。如果为空，提示“所有线索都重复了，你只能盲猜”。
2.  猜词者有一次输入机会。
3.  **操作选项**：
    * **回答**：输入猜测的词。
    * **跳过 (Pass)**：不确定答案，选择放弃。

### 阶段六：结算 (Resolution)
系统将玩家输入与 `target_word` 进行比对（支持一定的容错，如错别字或同义词库）。

* **情况 A：猜对 (Correct)**
    * 结果：成功。
    * 计分：`Score += 1`。
    * 卡牌处理：该卡牌移入“成功堆”。

* **情况 B：猜错 (Wrong)**
    * 结果：失败。
    * 计分：不加分。
    * **惩罚机制**：该卡牌移入“弃牌堆”，**并且**还需要从牌库中额外移除一张牌（或从成功堆扣除一张，取决于具体变体规则，标准规则是牌库移除）。即猜错一次实际上损失了2张牌的机会。

* **情况 C：跳过 (Pass)**
    * 结果：跳过。
    * 计分：不加分。
    * 卡牌处理：仅将当前卡牌移入“弃牌堆”，**不**额外扣除卡牌。

### 阶段七：终局 (Game Over)
当牌库耗尽（通常13轮）后，显示总得分。
* **评分标准**：
    * 13分：神级默契！
    * 11-12分：非常优秀。
    * 7-10分：一般水平。
    * 0-6分：如果在古代，你们可能已经被狮子吃了。

---

## 4. 电子版特色功能建议 (Digital Features)

为了优化电子版体验，建议增加以下模块：

1.  **自动/手动仲裁模式切换**：
    * *自动*：仅系统判断完全一致的字符串为重复。
    * *手动*：在线索提交后，展示给所有“线索者”（不给猜词者看）。线索者可以点击标记哪两个词意思太近算重复，或者哪个词违规了（如包含目标字）。

2.  **词库编辑器**：
    * 允许玩家导入自定义词库（JSON/CSV格式）。

3.  **防作弊机制**：
    * 当非猜词者输入线索时，系统实时检测是否包含了目标词，如果包含直接前端拦截报警。

4.  **计时器 (Timer)**：
    * 为写线索和猜词设置倒计时，增加紧张感。

---

## 5. 伪代码示例 (Pseudocode)

```python
def process_round(target_word, clues_dict):
    """
    处理线索并返回给猜词者可见的列表
    clues_dict: {player_id: clue_string}
    """
    # 1. 预处理
    normalized_clues = {}
    for pid, clue in clues_dict.items():
        normalized_clues[pid] = clue.strip().lower()

    # 2. 统计频率
    clue_counts = Counter(normalized_clues.values())
    
    # 3. 过滤重复和违规
    visible_clues = []
    eliminated_info = [] # 用于赛后复盘展示

    for pid, original_clue in clues_dict.items():
        norm_clue = normalized_clues[pid]
        
        # 规则：重复即消除
        if clue_counts[norm_clue] > 1:
            eliminated_info.append({
                "clue": original_clue, 
                "reason": "Duplicate"
            })
            continue
            
        # 规则：不能包含目标词 (简单的子串检查)
        if target_word in norm_clue:
             eliminated_info.append({
                "clue": original_clue, 
                "reason": "Contains Target"
            })
             continue
             
        visible_clues.append(original_clue)
        
    return visible_clues, eliminated_info
```