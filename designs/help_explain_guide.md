# Help / Explain 接入指南

配套 `designs/task185.md`。所有游戏统一使用 `static/games/shared_help.js` 提供的两个工厂，不再自行实现弹窗与解释模式。

样式已经并入 `static/style.css`（项目约定首页只允许一个 `coreStyles` link），游戏侧不需要再引入任何 CSS。

## 1. 可用 API

```js
window.obgCreateHelp(config)     // 返回 { open, close, isOpen, element }
window.obgCreateExplain(config)  // 返回 { enter, exit, toggle, isActive, refresh }
```

两者都接受 `{ zh, en }` 双语对象或纯字符串。语言状态存 `localStorage`，全局共享，默认中文。

## 2. Help 配置

```js
const XXX_HELP_CONFIG = {
  gameId: "xxx",
  title: { zh: "中文名 · English", en: "English" },
  basic: {
    win:  { zh: "一句话说明靠比什么赢。", en: "One sentence on how you win." },
    turn: { zh: "一句话说明每回合能做什么。", en: "One sentence on what a turn does." },
    key:  { zh: "一句话说明玩这个游戏的重点。", en: "One sentence on the key to the game." }
  },
  sections: [
    { id: "cards", label: { zh: "牌与目标", en: "Cards" }, html: { zh: "<p>…</p>", en: "<p>…</p>" } }
  ]
};
```

规则：
- `basic` 三句必填，中英都要有。共享模块自动渲染成「基本规则」章节并置于最前。
- `sections` 达到 3 个及以上时，共享模块自动渲染顶部 tab。
- `html` 内允许 HTML，但内容由游戏自己保证安全。

## 3. Explain 配置

```js
const XXX_EXPLAIN = {
  some_key: { zh: "这个控件做什么。", en: "What this control does." }
};

window.obgCreateExplain({
  gameId: "xxx",
  attribute: "data-xxx-explain",
  explanations: XXX_EXPLAIN,
  button: xxxExplainButton,
  root: () => document.getElementById("xxxPanel"),
  bypass: ["#xxxHelpBtn", "#xxxExplainBtn"]
});
```

DOM 侧在可交互元素上写 `data-xxx-explain="some_key"`，键必须存在于 `XXX_EXPLAIN`。

## 4. HTML 模板改动

在游戏 template 顶部加工具条，按钮不可换行：

```html
<div class="xxx-toolbar">
  <h3>🎴 Game</h3>
  <div class="xxx-tools">
    <button id="xxxHelpBtn" type="button">Help</button>
    <button id="xxxExplainBtn" type="button" aria-pressed="false">Explain</button>
  </div>
</div>
```

然后给每个需要解释的元素加 `data-xxx-explain`。**所有按钮、输入框、可点击区域都要覆盖**。

## 5. 六条验收要求

| 编号 | 要求 | 做法 |
| --- | --- | --- |
| R1 | 中英文切换 | 共享模块自带，无需额外处理 |
| R2 | 禁止分号串联碎短句 | 一句一个意思，用句号断开 |
| R3 | 基本规则三句 | `basic` 的 win / turn / key，中英齐全 |
| R4 | emoji 括弧命名 | 写作 `玫瑰(🌹)`、`Score(⭐)` |
| R5 | 复杂机制专门章节 | 复杂卡牌 / 效果 / 奖励单独一个 section |
| R6 | 长讲解用 tab | sections >= 3 自动出 tab |

## 6. 命名与加载

- 全局变量必须带游戏前缀，见 `DEV_GUIDE.md`。
- 初始化要处理脚本晚于 `DOMContentLoaded` 加载的情况：

```js
function initXxxHelpExplain() {
  if (xxxHelpWidget || typeof window.obgCreateHelp !== "function") return;
  // …
}
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initXxxHelpExplain);
} else {
  initXxxHelpExplain();
}
```

## 7. 版本号

改动游戏资源后更新 `static/game_assets.js` 中该游戏条目的 `?v=`。**批量迁移时由统一收尾环节处理，单个游戏不要各自改，避免冲突。**

## 8. 参考实现

`static/games/skull.js` 与 `static/games/skull.html` 是第一个完整接入的样板，六条要求全部满足。
