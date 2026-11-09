# Help 迁移待办与执行经验

配套 `designs/task185.md`。记录未完成项与执行过程中的经验教训。

## 0. 当前进度

- 注册游戏 **122** 个，已迁移 **50** 个，仍是旧实现 **72** 个。
- 已排除：`gaia_project`、`power_grid`（用户明确要求不做），实际可做 **70** 个。

用 `python3 tmp/next_batch.py` 按 help 足迹（Help 相关代码字符数）从小到大排序，
结果同时写入 `tmp/remaining.json`。**挑批次一律用这个脚本，不要凭印象选。**

## 1. 验收清单（每个游戏 / 每批收尾都要跑）

前两条是常规检查，**第三条才是关键**：契约测试和 `node --check` 都只做静态检查，
抓不到"引用了已删除的变量"或"在声明之前使用 const"这类**加载即崩**的错误。

```bash
node --check static/games/<game>.js          # 语法
python3 -m unittest tests.test_help_contract # 六条 Help 要求 + Explain 契约
python3 tmp/verify_batch<N>.py               # 本批 section/key 统计
node scripts/smoke_load.cjs <game>               # 真正加载，暴露模块初始化错误
```

**每批收尾时必须对全部已迁移游戏跑一遍冒烟测试**，而不只是新做的那几个：

```bash
python3 - <<'PY' > tmp/migrated_list.txt
import re, os
assets = open('static/game_assets.js', encoding='utf-8').read()
for g in re.findall(r'^\s{2}"([a-z0-9_]+)":\s*\{', assets, re.M):
    p = f'static/games/{g}.js'
    if os.path.exists(p) and 'obgCreateHelp' in open(p, encoding='utf-8', errors='ignore').read():
        print(g)
PY
while read g; do node scripts/smoke_load.cjs "$g"; done < tmp/migrated_list.txt
```

再加一条廉价的 grep，用于抓"删了变量但调用点还在"：

```bash
grep -nE '\bexplaining\b|\bsetExplain\b|\bopenDialog\b|\bshowExplanation\b|\bhelpText\b|\bhelpHTML\b' static/games/<game>.js
```

## 2. 待办清单

### 第二批至第五批：已完成（23 个）

第二批收尾 + 第三批（13 个）：
`chromino`(7/11)、`take_time`(6/17)、`dune_imperium`(11/3)、`challengers`(6/16)、
`deception`(6/14)、`pokemon_adventure`(5/11)、`cryptid`(7/14)、`startups`(6/19)、
`hanabi`(5/14)、`colt_express`(7/32)、`felix`(6/14)、`compress`(4/11)、`project_l`(6/25)

第四批（5 个）：
`no_thanks`(6/15)、`maskmen`(6/15)、`night_of_the_ninja`(5/27)、
`mall_of_horror`(7/25)、`a_feast_for_odin`(12/38)

第五批（5 个）：
`high_society`(7/10)、`dnd_starter_set`(6/34)、`for_sale`(7/18)、
`grand_austria_hotel`(9/16)、`gizmos`(7/13)

验收脚本：`tmp/verify_batch3.py` / `verify_batch4.py` / `verify_batch5.py`，均全绿。

## 3. 执行经验

### 3.1 委派粒度

单个 worker 承担 3–4 个游戏时会**耗尽计算预算**被中断。已验证的失败案例：
- 4 个游戏一批 → 全部失败
- 3 个游戏一批 → 全部失败
- 1 个游戏一批 → 仍然失败（当游戏本身很大时，如 dune_imperium 10 万字符）

**结论**：大文件游戏（JS 超过 5 万字符）必须单独处理，且要先 grep 定位再分段读，
不要通读全文。小游戏可以 2 个一批。

### 3.2 委派通道可能整体失效

出现过**所有 worker 在启动后立刻 terminated、零输出**的情况，连续三个任务
（felix / colt_express / project_l）无一例外。更隐蔽的一种是
**worker 报告"成功"但文件零改动**——必须用
`grep -c obgCreateHelp static/games/<game>.js` 复核，不能只信报告。

**结论**：派发后如果连续两个 worker 秒退，立刻停止委派、改为父会话串行自做，
不要反复重试浪费预算。父会话串行做一个中等游戏（3 万字符）约需 20–30 分钟。

### 3.3 worker 半成品比"零改动"更危险

`challengers` 的 worker 被 terminated 时，**新代码已经写进去了，旧代码却没删干净**：
整套旧 Explain 层（`explaining` / `setExplain` / `showExplanation` / `exempt`
及其监听器）都还在调用已删除的函数，还留了一个 `__REMOVED_HELP_START__` 占位函数，
而 `dialog` / `dialogClose` / `openDialog` **从未被定义过**。
契约测试和 `node --check` 全部通过，但游戏一加载就崩。

这个半成品状态还被其他会话提交进过 git。

**结论**：接手中断的 worker 成果时，第一件事是跑冒烟测试，
而不是相信它之前跑出的验收结果。

### 3.4 HELP_CONFIG 必须在 esc 之后定义（TDZ）

`HELP_CONFIG` 是**模块加载时求值的对象字面量**，里面用 `esc(...)` 拼 HTML。
如果把它插到 `const esc` 声明之前，文件一加载就抛
`ReferenceError: Cannot access 'esc' before initialization`，整个游戏面板永远空白。

踩过两次：`for_sale`（HELP_CONFIG 在 54 行、`esc` 在 152 行）、
`grand_austria_hotel`（58 行 vs 161 行）。

同理，**替换解释表时不要把被引用的源表一起删掉**。`dnd_starter_set` 和 `for_sale`
都出现过：新块里写 `DND_EXPLAIN.edition.zh = details.edition`，
但 `details` 正好是被替换掉的那个对象。删完立刻用
`grep -c 'const details = {'` 复核。

### 3.5 解释属性只能挂叶子节点（重要）

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

### 3.6 旧实现的数据形态

迁移时遇到的解释文案存储方式不止一种，都要转成 key：

| 形态 | 例子 | 处理 |
| --- | --- | --- |
| 独立文案表 | colt_express 的 `details`、chromino 的映射对象 | 直接搬进 `EXPLAIN` 并补 en，留一个 `zhText()` 之类给 tooltip 复用 |
| 属性值即整段文案 | felix、gizmos 把整段文本直接写进 `data-*-explain` | 抽成 key，动态部分移到 `data-*-tip` 保留 |
| JSON 三元组 | project_l 的 `JSON.stringify([title, body, cost])` | 合并成一条 key 文案，cost（`1 AP` / `−1 point` / `Free`）写进正文，不要丢 |
| key 与动态 id 混用 | dnd_starter_set 的法术 id、maskmen 的面具名 | 加一个 `detailKey()` 把动态 id 映射到静态 key，具体文本转 tooltip |
| 统一 tip 标记 | grand_austria_hotel 的 `passive()` | 用"按说明文本反查 key"的映射，让静态说明自动落到正确 key，动态的落到 `tip` |

### 3.7 纯 JS 渲染的游戏没有 html 文件

`for_sale` 的整个面板由 JS 渲染进 `index.html` 里的空 div，
`game_assets.js` 里也**没有 markup 条目**，所以 `static/games/for_sale.html` 不存在。
但 `test_explain_keys_covered_in_markup` 只读这个路径，文件缺失就判失败。

**当前做法**：新建一个只含 explain 锚点的 html 文件，并在顶部注释里写明用途。

**建议改进**：让契约测试在 html 缺失时回退到检查 JS 里的属性字面量，
否则这个检查对纯 JS 渲染的游戏是无效代理。后续如果还有同类游戏
（`game_assets.js` 里没有 `"markup"` 键的），会遇到同样的问题。

### 3.8 按钮位置有两种

Help/Explain 按钮可能出现在：
- 游戏自己的 `static/games/<game>.html`（多数）
- `static/index.html`（`chromino`、`take_time`、`eternal_decks`、`ponzi_scheme` 等）

迁移时**只读 id，不改 index.html**。
契约测试 `test_help_and_explain_buttons_present` 已修正为同时检查两处。

### 3.9 静态审计的局限

旧实现的 Help 文案散落在函数返回、数组 join、模板字符串、数据文件里，
静态正则无法可靠提取。判断"哪些游戏最需要迁移"时，用 **Help 相关代码行数/字符数**
作为复杂度代理比用"文案长度"更可靠。见 `tmp/next_batch.py`。

### 3.10 浏览器验证需要完整 DOM

验证迁移后的游戏时，只加载 `games/<game>.html` 会导致脚本因找不到
`xxxPanel` 而提前 return，误判为"Help 没打开"。必须同时提供：
- `index.html` 里的 `<div id="xxxPanel">` 容器
- `index.html` 里的 modal / dialog template
- 游戏自己的 template，且按 `data-game-target` 挂到对应容器

### 3.11 仓库有并发会话在提交整个工作区

多次观察到：刚改完的文件从 `git status` 里消失了，查 log 发现是另一个会话
用 `git commit` 把整个工作区一起扫进去了。这意味着**做到一半的中间状态
随时可能被提交**（`challengers` 的半成品就是这样进的 git）。

**做法**：全部做完再一次性提交，并且 `git add` 时**逐个列出自己的文件**，
不要用 `git add -A` 或 `git commit -a`。

## 4. 共享模块已修复的缺陷

1. **Help 关闭按钮无效**：点击处理漏了 `.obg-help-close` 分支。
2. **移动端滚动误触发解释**：原实现 `pointerdown` 立即触发，改为按下记录、
   抬起时校验移动距离（容差 10px）。
3. **切 tab 后滚动位置重置**：原实现每次重建整个 tabs DOM，改为 tab 条只建一次、
   切章节只换 body，并保存/恢复 `scrollLeft` 与 `scrollTop`。

## 5. 遗留事项

- **资源版本号**：已迁移游戏的 `?v=` 递增留给统一收尾环节处理，迁移过程中
  不要动 `static/game_assets.js`（该文件常有其他会话的并行改动）。
- **失效 css 规则**：共享模块用的是 `body.obg-explaining` + `.obg-has-explanation`，
  各游戏 css 里残留的 `.chromino-explaining`、`ce-explaining`、`nn-explaining`
  等旧规则已成死代码，视觉无影响，可单独排一轮清理。
- **契约测试的 markup 检查**：见 3.7，对纯 JS 渲染的游戏是无效代理。
