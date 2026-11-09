# Help 迁移待办与执行经验

配套 `designs/task185.md`。记录未完成项与执行过程中的经验教训。

## 0. 当前进度

- 注册游戏 **122** 个，已迁移 **40** 个，仍是旧实现 **80** 个。
- 已排除：`gaia_project`、`power_grid`（用户明确要求不做），实际可做 **78** 个。

用 `python3 tmp/next_batch.py` 按 help 足迹（Help 相关代码字符数）从小到大排序，
结果同时写入 `tmp/remaining.json`。**挑批次一律用这个脚本，不要凭印象选。**

## 1. 待办清单

### 第二批、第三批：已完成（13 个）

`chromino`(7/11)、`take_time`(6/17)、`dune_imperium`(11/3)、`challengers`(6/16)、
`deception`(6/14)、`pokemon_adventure`(5/11)、`cryptid`(7/14)、`startups`(6/19)、
`hanabi`(5/14)、`colt_express`(7/32)、`felix`(6/14)、`compress`(4/11)、`project_l`(6/25)

验收脚本：`tmp/verify_batch3.py`，当前 **13/13 pass**。

### 第四批（5 个）

`no_thanks`、`maskmen`、`night_of_the_ninja`、`mall_of_horror`、`a_feast_for_odin`

验收脚本：`tmp/verify_batch4.py`

## 2. 执行经验

### 2.1 委派粒度

单个 worker 承担 3–4 个游戏时会**耗尽计算预算**被中断。已验证的失败案例：
- 4 个游戏一批 → 全部失败
- 3 个游戏一批 → 全部失败
- 1 个游戏一批 → 仍然失败（当游戏本身很大时，如 dune_imperium 10 万字符）

**结论**：大文件游戏（JS 超过 5 万字符）必须单独处理，且要先 grep 定位再分段读，
不要通读全文。小游戏可以 2 个一批。

### 2.2 委派通道可能整体失效（2026-11-08 实测）

第三批后期出现过**所有 worker 在启动后立刻 terminated、零输出**的情况，
连续三个任务（felix / colt_express / project_l）无一例外。
更隐蔽的一种是 **worker 报告"成功"但文件零改动**——必须用
`grep -c obgCreateHelp static/games/<game>.js` 复核，不能只信报告。

**结论**：派发后如果连续两个 worker 秒退，立刻停止委派、改为父会话串行自做，
不要反复重试浪费预算。父会话串行做一个中等游戏（3 万字符）约需 20–30 分钟。

### 2.3 按钮位置有两种

Help/Explain 按钮可能出现在：
- 游戏自己的 `static/games/<game>.html`（多数）
- `static/index.html`（`chromino`、`take_time`、`eternal_decks`、`ponzi_scheme` 等）

迁移时**只读 id，不改 index.html**。

契约测试 `test_help_and_explain_buttons_present` 已修正为同时检查两处。

### 2.4 静态审计的局限

旧实现的 Help 文案散落在函数返回、数组 join、模板字符串、数据文件里，
静态正则无法可靠提取。判断"哪些游戏最需要迁移"时，用 **Help 相关代码行数/字符数**
作为复杂度代理比用"文案长度"更可靠。见 `tmp/next_batch.py`。

### 2.5 浏览器验证需要完整 DOM

验证迁移后的游戏时，只加载 `games/<game>.html` 会导致脚本因找不到
`xxxPanel` 而提前 return，误判为"Help 没打开"。必须同时提供：
- `index.html` 里的 `<div id="xxxPanel">` 容器
- `index.html` 里的 modal / dialog template
- 游戏自己的 template，且按 `data-game-target` 挂到对应容器

### 2.6 解释属性只能挂叶子节点（重要）

共享模块 `obgCreateExplain` 的 `atPoint()` 实现是：

```js
function atPoint(x, y) {
  return targets().find((node) => { /* 命中测试 */ });
}
```

而 `targets()` 来自 `root().querySelectorAll(selector)`，是**文档顺序**，
祖先元素排在后代之前，`find()` 会先返回祖先。

**后果**：把 `data-*-explain` 挂到覆盖整个面板的大容器（例如 `#challengersContent`、
`#coltExpressSurface`）上，内层所有更精确的解释元素将**永远点不到**，
点哪里都只弹容器那一条。

**做法**：
- 优先挂在叶子节点（按钮、徽章、单个格子）上。
- 面板里没有现成叶子时，参考 `cryptid` / `take_time` / `dune_imperium` / `challengers`
  的做法：挂到 dialog 关闭按钮，并新增一条 `dialog_close` 解释。
- 元素被 `hidden` 时 `getBoundingClientRect()` 宽高为 0，会被 `box.width && box.height`
  过滤掉，同样不能作为挂载点。

### 2.7 旧实现的三种数据形态

迁移时遇到的解释文案存储方式不止一种，都要转成 key：

| 形态 | 例子 | 处理 |
| --- | --- | --- |
| 独立文案表 | colt_express 的 `details`、chromino 的映射对象 | 直接搬进 `EXPLAIN` 并补 en，留一个 `zhText()` 之类给 tooltip 复用 |
| 属性值即整段文案 | felix 的 `dataset.felixExplain = "Bid with Mice (🐭)..."` | 抽成 key，动态部分（如具体卡牌描述）移到 `data-*-tip` 保留 |
| JSON 三元组 | project_l 的 `JSON.stringify([title, body, cost])` | 合并成一条 key 文案，cost（`1 AP` / `−1 point` / `Free`）写进正文，不要丢 |

## 3. 共享模块已修复的缺陷

1. **Help 关闭按钮无效**：点击处理漏了 `.obg-help-close` 分支。
2. **移动端滚动误触发解释**：原实现 `pointerdown` 立即触发，改为按下记录、
   抬起时校验移动距离（容差 10px）。
3. **切 tab 后滚动位置重置**：原实现每次重建整个 tabs DOM，改为 tab 条只建一次、
   切章节只换 body，并保存/恢复 `scrollLeft` 与 `scrollTop`。

## 4. 遗留事项

- **资源版本号**：已迁移游戏的 `?v=` 递增留给统一收尾环节处理，迁移过程中
  不要动 `static/game_assets.js`（该文件常有其他会话的并行改动）。
- **失效 css 规则**：共享模块用的是 `body.obg-explaining` + `.obg-has-explanation`，
  各游戏 css 里残留的 `.chromino-explaining`、`ce-explaining`、`nn-explaining`
  等旧规则已成死代码，视觉无影响，可单独排一轮清理。
