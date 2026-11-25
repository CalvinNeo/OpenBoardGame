# 喜爱标签

支持 Filter 菜单，其中包含不同的 filter 项目：
- Players，即支持游玩人数
- Favor，即标注的喜欢的游戏

在游戏列表的右边，增加一个星星的图案，存在选中和非选中两种情况，表示是否喜欢这个游戏。这个记录存在本地，支持在 Settings 里面进行备份和导入，和玩家是解耦的。

## 实现

- Select Game 顶部保留搜索和 Sort，原有 Players 移入 Filter 下拉菜单，并加入 Favor（Favorites only）复选框。菜单显示启用的筛选数量；收藏、人数、搜索、Types 标签按交集筛选，现有排序不变。重新打开 Select Game 时重置筛选条件，但保留收藏和已保存的排序。
- 每个游戏右侧提供独立的 ☆ / ★ 按钮，收藏操作不会触发游戏选择或创建房间。按钮支持 Tab、Space、Enter 与 `aria-pressed`，使用游戏名称提供可访问标签；取消收藏后立即更新仅收藏列表，并保留合理的键盘焦点。普通列表切换收藏不重建列表、不改变滚动位置，手机滑动星标区域只滚动、不切换收藏。
- Filter 点击菜单外关闭；Escape 优先关闭 Filter，再次 Escape 关闭 Select Game。Settings 保留 Escape、遮罩关闭和键盘焦点循环，隐藏的导入文件输入框不进入焦点循环。
- 收藏存放于 `localStorage` 的 `openboardgame:favorite_games`，内容为去重后的 game_id 数组，与姓名、房间凭证、玩家 ID 无关；改名、退出登录不会删除收藏。同源其他标签页的收藏变化会同步到当前打开的游戏列表。
- Settings → Favorite games 提供 Back up favorites 与 Import favorites。备份文件名为 `openboardgame-favorites.json`，仅包含收藏，不包含身份、凭证或其他设置。格式如下：

```json
{
  "type": "openboardgame:favorites",
  "version": 1,
  "game_ids": ["azul", "cabo"]
}
```

- 导入采用合并语义，不删除原有收藏，重复 ID 自动去重。空备份不清空已有收藏；尚未出现在当前游戏目录中的合法 ID 保留，便于跨版本恢复。
- 文件大小最多 1 MiB、最多 10000 个 ID；ID 必须是长度 1–100 的小写字母、数字、下划线或连字符，且以字母或数字开头。格式错误、版本不支持或内容非法时提示错误，不修改现有收藏。
- 损坏的本地记录按空收藏处理。浏览器存储不可写时，收藏继续保存在当前标签页内存中，并在 Settings 提示备份，避免影响游戏和房间操作。

## 2026-11-25 UI 验收记录

- 实现文件：`static/index.html`、`static/room.js`、`static/style.css`，同步更新首页公共 CSS / room.js 版本。文档更新于本文件和 `designs/room_control.md`；保留工作区已有游戏和其他本地修改。
- 新增 `tests/game_favorites.browser.cjs`，扩展 `tests/test_game_picker_contract.py`；适配 `tests/game_ai_catalog.browser.cjs`、`tests/room_controls.browser.cjs`、`tests/kobayakawa_ai.browser.cjs`、`tests/in_a_grove_ai.browser.cjs` 的 Players 菜单入口。
- Chrome 320、390、1024、1440px 浏览器回归通过，截图人工复核覆盖手机和桌面：Select Game、Filter、Settings 无意外重叠、容器溢出或整页横向滚动。截图存于忽略目录 `tmp/game-favorites/`。
- 收藏回归覆盖星标鼠标和键盘操作、点击不建房、手机触摸滑动不误收藏、列表滚动保持、组合筛选、空结果、Escape、焦点循环、备份下载、合并/重复/空备份导入、非法与超大文件、刷新恢复、跨标签页同步、改名/退出保留、损坏存储及写入失败降级。
- 原有 `game_ai_catalog` 浏览器回归四种宽度均通过，包含搜索、排序、人数筛选、AI 标记、实际选游戏建房，以及真人/Bot 回合、隐私与刷新重连。
- `python3 -m unittest tests.test_game_picker_contract tests.test_frontend_style_assets tests.test_help_contract` 共 21 项通过；全部改动 JS 的 `node --check` 与 `git diff --check` 通过。UI-only 未运行全量游戏逻辑测试。
- 验收缺口：`tests/game_assets.browser.cjs:50` 的既有首页脚本白名单仍只允许 shared.js，实际还包含既有 shared_help.js / shared_effects.js，测试在资源检查前失败；`tests/room_controls.browser.cjs:49` 在资源加载完毕前断言人数提示，实际为 Loading game files...，本轮未改动这些无关断言。两款专用 AI 回归仅适配入口和检查语法，未完整运行。未实测实体 iOS / Android、Safari、Windows 字体；因此不宣称 DEV_GUIDE.md 全项验收完成，无新增游戏规则或 Help / Explain 例外。
