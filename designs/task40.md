# Task 40: 游戏 Help & Explain 按钮实现指南

## 功能需求

### Help 按钮
- 点击弹出游戏规则对话框
  + 支持中文和英文，可以通过顶层的按钮切换。
  + 严格禁止用分号串联碎短句，要说前后贯通的句子。
  + 游戏讲解需要先讲解基本规则便于快速上手，再讲解进阶规则。基本规则包括各用一句话讲明白下面的事情：
    * 靠比什么赢
    * 每回合到底能做什么
    * 玩这个游戏的重点
  + 如果游戏中使用了图标/emoji，那么在讲解中必须也把这个图标/emoji 括弧在其名字的后面。
  + 对于游戏中机制复杂的卡牌/效果/奖励等，应该在 Help 中有专门的章节讲解。
  + 如果玩法讲解较长，要在顶部引入 tab 方便切换章节。

### Explain 按钮
- 点击进入"解释模式"
- 解释模式下：
  1. **有解释的按钮**：显示虚线高亮 + 问号光标，点击显示功能说明
  2. **无解释的按钮**：外观不变、光标不变，但点击不触发原功能
  3. **已 disabled 的按钮**：仍可点击查看解释
- 退出方式：点击有解释的按钮后自动退出，或按 ESC 退出
- 内容
  + Explain 的内容，不仅要包括这个展示元素/交互元素本身的功能，也要解释这个它所展示的内容的含义。例如，“Explain 抽牌区的卡”的时候，不仅要解释抽牌区是做什么用的，也要解释当前这个卡的效果是什么。

## 实现要点

### 1. 问号光标仅在有解释的按钮上显示

**错误做法：**
```css
body.explain-mode {
  cursor: help;  /* 整个页面都变问号 */
}
```

**正确做法：**
- 进入模式时给有解释的按钮添加 class（如 `has-explanation`）
- CSS 只对该 class 设置问号光标：
```css
body.explain-mode button.has-explanation {
  cursor: help;
  outline: 2px dashed #3b82f6;
}
```

### 2. 解释模式下禁用所有按钮功能

**要点：**
- 用事件捕获（第三参数 `true`）拦截点击
- 对非功能按钮（如 Help/Explain 本身、Modal 关闭按钮）不拦截
```javascript
document.addEventListener("click", (e) => {
  if (!explainMode) return;

  const button = e.target.closest("button");
  if (!button) return;
  if (button === explainBtn || button === helpBtn) return;  // 不拦截自身
  if (button === modalCloseBtn) return;  // 不拦截关闭按钮

  e.preventDefault();
  e.stopPropagation();
  // 如果有解释则显示...
}, true);
```

### 3. Disabled 按钮也能点击查看解释

**问题：** 浏览器不会在 disabled 元素上触发 click/mousedown 事件

**解决方案：** 使用 `pointerdown` + 坐标检测
```javascript
function findButtonAtPoint(x, y) {
  for (const buttonId of Object.keys(BUTTON_EXPLANATIONS)) {
    const btn = document.getElementById(buttonId);
    if (!btn) continue;
    const rect = btn.getBoundingClientRect();
    if (x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom) {
      return buttonId;
    }
  }
  return null;
}

document.addEventListener("pointerdown", (e) => {
  if (!explainMode) return;

  const buttonId = findButtonAtPoint(e.clientX, e.clientY);
  if (buttonId) {
    e.preventDefault();
    e.stopPropagation();
    showButtonExplanation(buttonId);
    exitExplainMode();
  }
}, true);
```

### 4. 游戏切换时显示/隐藏按钮

在 `app.js` 的游戏面板切换逻辑中调用：
```javascript
if (typeof showXxxHeaderActions === "function") {
  showXxxHeaderActions(showXxx);
}
```

## 参考实现

Project L 的实现见 `static/games/project_l.js` 中的 Help/Explain 相关代码。
