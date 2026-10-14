# task148：脑力压缩（Compress）

## 目标

加入 Oink Games《Compress》（中文名“脑力压缩”）的在线版本。它保留原作的核心体验：玩家面对不断增长的 0/1 序列，只能用 8 个笔记槽记录信息，并在压力下继续准确回答。

## 规则方案

- 支持 1–7 人，采用轮流行动；每位玩家开始时拥有 8 张私有笔记牌。笔记牌使用黑白底色和 `0`/`1` 图标表示，作为自己的记录工具。
- 游戏以一条隐藏的二进制序列开始，初始公开长度为 3。每次答对当前序列末尾的下一位，序列增长 1 位并轮到下一位仍在场的玩家。
- 玩家回答时选择 `0` 或 `1`。答对后可从自己的 8 个笔记槽中选择一个，把本次结果写入该槽；这对应实体游戏里用有限卡牌压缩记录的动作。槽位可以覆盖，形成持续的“压缩”决策。
- 答错会获得 1 个错误标记并结束本次机会，目标位保持不变，轮到下一位玩家。累计 2 个错误标记的玩家淘汰；单人游戏的两次错误代表本局失败。
- 序列达到 20 位时结束本局，仍在场玩家按答对次数（准确记录的长度）计分，分数最高者获胜；若只剩一名玩家，则立即获胜。
- 每轮结算后停在结果状态，所有玩家点击 `Next Round` 后才继续。对于本游戏，答错/淘汰属于当前回合结算，答对推进到下一位行动，不额外弹确认。
- 为避免网页直接暴露完整答案，公共视图只显示最近 8 位已确认序列；玩家自己的 8 个笔记槽、错误标记和得分单独显示。服务端始终保存完整序列并校验答案。

## 服务端实现

- 新增 `game/compress.py`，提供 `init_game`、`get_legal_actions`、`apply_action`、`get_public_view`、`bot_move`、`serialize`、`deserialize`，以及严格的 `ACTION_SCHEMA`/`CONFIG_SCHEMA`。
- 牌堆包含四种（白/黑 × 0/1）笔记牌；每位玩家固定 8 张，笔记值可被覆盖但不泄露给其他玩家。
- 使用 `compress` 作为 `game_id`，在 `game/__init__.py`、`game/definitions.py`、`game/tags.py` 注册，并刷新 `game/dev_order.json`。

## 前端实现

- 遵守 `FRONTEND.md`：新建 `static/games/compress.html/js/css`，通过 `GAME_ASSETS` 按需加载，不把独立脚本和样式直接塞进首页。
- 主面板使用紧凑的响应式布局：序列状态、笔记槽、0/1 操作、玩家状态和回合结果同屏；移动端改为单列，禁止横向溢出。
- 用 `0️⃣`/`1️⃣`、黑白牌面和错误标记增强辨识度；`Help` 只在弹窗中说明规则，`Explain` 进入点选解释模式，并支持悬停/触摸提示和 `Esc` 关闭。
- 接入 `static/app.js` 的状态分发、`static/room.js` 的清理钩子和 `static/game_assets.js` 的资源清单；资源 URL 使用版本号。

## 验证

- 新增 `tests/test_compress.py` 覆盖初始化、轮流行动、正确/错误回答、笔记覆盖、淘汰、结算、公共视图隐私和序列化。
- 运行 `python3 -m unittest tests.test_compress tests.test_room_session`、`python3 -m unittest tests.test_frontend_style_assets`，并运行 `python3 scripts/gen_dev_order.py` 更新开发顺序。
