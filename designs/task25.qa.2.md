# 问题
确认输出格式

- 我倾向用单一 HTML 文件：内嵌 CSS + 文本 + 图片（data URL），离线可直接打开。绘图类内容用原图 data URL 或用 JSON + 内联脚本渲染到
<canvas>。这种做法可以吗？
- Cyber Pictures 的“原图”指玩家的作品，还是还要包含每轮的 4x4 目标照片矩阵？如果要包含目标照片，是否允许把 16 张图也做成 base64 内
嵌（文件会大一些），还是只写坐标+文件名即可？

按钮展示位置/权限

- “放到 Room 里面”理解为：房间页有一个统一按钮，但仅在当前游戏实现了 download_memories 且 game_over 后显示/可点。这个判断逻辑是否
OK？
- 所有人都能下载完整内容（含隐藏信息）吗？是否需要限制只有房主/管理员才能下载？

四个游戏的“记忆内容”提案（请你确认/改动）

- Draw & Guess：每个 book 的完整链条（初始 prompt + 每轮 drawing/guess），包含作者名、轮次、文本、原图 data URL；结尾标注 final
guess 是否匹配原 prompt；可选：玩家列表与座位、配置（语言/猜测方式）。
- Impression Flower：每轮的 guesser、word bank、每位 setter 的 prompt word、对应 drawing（原图 data URL）、guesser 的匹配结果
（drawing_id -> word）、正确/错误列表、得分变化；如果启用 review votes，附投票结果。
- Cyber Pictures：每轮 matrix（若需要就嵌图，否则仅坐标+文件名）、每位玩家的 tool/target、提交作品（从 submission JSON 复刻原图）、
所有猜测（guesser -> work_id -> 坐标）、揭晓结果（who drew what、哪些猜对）、回合与总分。
- Decrypto：每轮双方关键词、当轮 code、encryptor 提交的 clues、己方 decrypt guess（含提交者）、对方 intercept guess（含提交者）、正
确性、拦截/误通讯 token 变化；最终胜负与完整历史。

细节

- HTML 内的说明文字用中文还是英文？
- “游戏开始时间”我会在 init_game 时记录本地时间；可吗？

你确认完我就开始实现。

# 回答
确认输出格式：
- 单一 HTML 文件，以及后面等等这一部分，你说的可以。
- Cyber Pictures 的“原图”不仅是玩家的作品，也包含目标照片。但是目标照片如果明显很大的话，可以以减少清晰度的方式，让它变小。

按钮展示位置/权限

- 房间页有一个统一按钮这一段话，我觉得就一直可点吧。如果游戏不支持，就显示不支持。如果游戏支持，那么什么时候点，你就按照什么进度去构建 memories。
- 所有人都可以下载。

四个游戏的“记忆内容”提案（请你确认/改动）

- Draw & Guess：OK。
- Impression Flower：OK
- Cyber Pictures：OK
- Decrypto：OK

细节，你说的是可以的。