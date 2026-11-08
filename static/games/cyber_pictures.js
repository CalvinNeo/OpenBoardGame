// --- Help & Explain (designs/task40.md, designs/task185.md) -------------
const cyberPicturesHelpButton = document.getElementById("cyberPicturesHelpBtn");
const cyberPicturesExplainButton = document.getElementById("cyberPicturesExplainBtn");

const CYBER_PICTURES_HELP_CONFIG = {
  gameId: "cyber_pictures",
  title: { zh: "赛博画影 · Cyber Pictures", en: "Cyber Pictures" },
  basic: {
    win: {
      zh: "五轮结束后总分最高的人获胜，你的分数来自猜中别人作品的次数，以及别人猜中你作品的次数。",
      en: "After five rounds the highest total score wins. Your points come from how many other works you identify correctly and from how many players read your work correctly."
    },
    turn: {
      zh: "每一轮你先用手上的工具重画矩阵里属于你的那张照片，然后为除自己以外的每一件作品各选一个坐标。",
      en: "Each round you first rebuild your assigned photo from the matrix with the tool in your hands, and then you pick one coordinate for every work except your own."
    },
    key: {
      zh: "重点是把照片里最容易被认出来的那几个特征，用手上这件受限的工具夸张地表现出来，同时从别人的抽象作品里反推坐标。",
      en: "The key is to exaggerate the most recognisable features of your photo with the limited tool you were given, and to reverse that reasoning when you look at everyone else's abstractions."
    }
  },
  sections: [
    {
      id: "matrix",
      label: { zh: "矩阵与目标", en: "Matrix and target" },
      html: {
        zh: "<p>每轮开始时系统摆出一面 4×4 的照片矩阵(🖼️)，行用 A B C D，列用 1 2 3 4，所以坐标从 A1 排到 D4。</p>"
          + "<p>每位玩家会被秘密分配其中一个坐标作为本轮目标(Target)，只有你自己看得到，矩阵里会用高亮框标出它。</p>"
          + "<p>目标默认互不重复，如果房间允许重复目标，也可能出现两个人盯上同一张照片。</p>"
          + "<p>每一轮都会重新抽 16 张照片并重新分配目标，所以上一轮记住的布局没有用。</p>",
        en: "<p>Every round opens a 4×4 photo matrix (🖼️). Rows are labelled A to D and columns 1 to 4, so the coordinates run from A1 to D4.</p>"
          + "<p>Each player is secretly handed one of those coordinates as the round's target, and only you can see yours. The matrix highlights it for you.</p>"
          + "<p>Targets are normally all different, but a room that allows duplicates can point two players at the same photo.</p>"
          + "<p>Sixteen fresh photos are drawn and targets are reassigned every round, so nothing you memorised last round carries over.</p>"
      }
    },
    {
      id: "flow",
      label: { zh: "回合流程", en: "Round flow" },
      html: {
        zh: "<p>一轮分三步：Crafting 创作、Guessing 竞猜、Scoring 结算，三个阶段里所有玩家都是同时行动的。</p>"
          + "<p>创作阶段要等所有人都按了 Submit Creation 才进入竞猜，竞猜阶段要等所有人都按了 Submit Guesses 才结算。</p>"
          + "<p>结算界面按 Next Round 进入下一轮，工具会轮换给下家，第五轮结束后直接进入 Game over。</p>"
          + "<p>Submitted 和 Guessed 告诉你自己这一轮走到哪一步了。</p>",
        en: "<p>A round has three steps: Crafting, Guessing and Scoring, and every player acts at the same time in all three.</p>"
          + "<p>The guessing step only starts once everyone has pressed Submit Creation, and scoring only happens once everyone has pressed Submit Guesses.</p>"
          + "<p>Press Next Round on the scoring screen to move on. Tools rotate to the next player, and the fifth round runs straight into Game over.</p>"
          + "<p>Submitted and Guessed tell you how far you personally have got in the current round.</p>"
      }
    },
    {
      id: "tools_line",
      label: { zh: "线条类工具", en: "Line tools" },
      html: {
        zh: "<p>鞋带线(Shoelaces)：在画布上按住拖动就能拉出一条线，整轮最多画 2 条路径，Undo Path 撤销最后一条，Clear 全部清空。</p>"
          + "<p>推进器(Thruster)：火箭点(🟠)从左边匀速向右飞，重力一直把它往下拉，你按住鼠标、手指或空格键点火就能把它往上推，飞出来的轨迹就是你的作品。</p>"
          + "<p>推进器整轮只有 3 次尝试，飞出画布就算这次结束，Undo 可以删掉上一次轨迹并把这次机会还给你。</p>"
          + "<p>合成器(Synthesizer)：10 根取值为 0 到 100 的整数滑块决定 10 根柱子的高度，作品会被画成深色背景上的十根绿色柱子。</p>",
        en: "<p>Shoelaces: press and drag on the canvas to pull out a line. You may lay at most 2 paths in a round, Undo Path removes the last one and Clear removes them all.</p>"
          + "<p>Thruster: a rocket dot (🟠) flies from the left edge at a constant speed while gravity pulls it down. Holding the mouse, a finger or the space bar fires the engine and pushes it up, and the trail it leaves behind is your artwork.</p>"
          + "<p>The thruster gives you only 3 attempts per round. Leaving the canvas ends an attempt, and Undo deletes the last trail and hands that attempt back.</p>"
          + "<p>Synthesizer: 10 integer sliders from 0 to 100 set the height of 10 bars, and the finished work is drawn as ten green bars on a dark background.</p>"
      }
    },
    {
      id: "tools_collage",
      label: { zh: "拼贴类工具", en: "Collage tools" },
      html: {
        zh: "<p>像素网格(Pixel Grid)：3×3 一共九个格子，先在九色调色板里选好颜色再点格子填色，九格全部填满才能提交。</p>"
          + "<p>图标组合(Icon Set)：从表情图标库里点选，例如笑脸(😀)、树(🌳)、房子(🏠)、星星(⭐)，画布上要放 2 到 5 个，拖动可以移动，轻点一下就转 90°。</p>"
          + "<p>字母拼贴(AEIOU Collage)：只能用 A E I O U 五个大写字母，最多放 10 个，Rotation 滑块可以转到任意角度，轻点字母则快速转 90°。</p>"
          + "<p>几何堆叠(Shape Stacker)：七种空心图形，正方形(□)、长方形(▭)、三角形(△)、圆形(○)、拱形(◠)、椭圆(⬭)、正六边形(⬡)，可以拖动摆放并自由旋转。</p>",
        en: "<p>Pixel Grid: nine cells in a 3×3 block. Pick a colour from the nine-swatch palette and click a cell to fill it, and all nine cells must be filled before you can submit.</p>"
          + "<p>Icon Set: pick from the emoji library, for example the smiley (😀), the tree (🌳), the house (🏠) or the star (⭐). Place between 2 and 5 of them, drag to move and tap one to spin it 90°.</p>"
          + "<p>AEIOU Collage: only the five capital letters A, E, I, O and U are available, with at most 10 on the canvas. The Rotation slider turns the selected letter to any angle and a tap spins it 90°.</p>"
          + "<p>Shape Stacker: seven hollow shapes, the square (□), the rectangle (▭), the triangle (△), the circle (○), the arch (◠), the ellipse (⬭) and the hexagon (⬡). Drag them into place and rotate them freely.</p>"
      }
    },
    {
      id: "guess",
      label: { zh: "竞猜阶段", en: "Guessing" },
      html: {
        zh: "<p>竞猜阶段会匿名列出本轮所有作品，标题只写 Work #1、Work #2，作者是谁完全隐藏。</p>"
          + "<p>你必须为除自己以外的每一件作品在下拉框里选一个坐标，全部选完才能按 Submit Guesses。</p>"
          + "<p>自己的作品不需要猜，界面上会直接说明你不能猜自己的图。</p>"
          + "<p>所有人的猜测是同时提交的，所以谁也看不到别人选了什么。</p>",
        en: "<p>The guessing step lists every work from the round anonymously, labelled only as Work #1, Work #2 and so on, with the author hidden.</p>"
          + "<p>You must choose a coordinate from the dropdown for every work except your own, and Submit Guesses only unlocks once they are all filled in.</p>"
          + "<p>You never guess your own work, and the card says so where the dropdown would be.</p>"
          + "<p>Everyone submits at the same time, so nobody can see what the others picked.</p>"
      }
    },
    {
      id: "score",
      label: { zh: "计分与胜负", en: "Scoring and winning" },
      html: {
        zh: "<p>你每猜对一件别人的作品就得 1 分猜测分(Guess Points)。</p>"
          + "<p>每有一个人猜中你的作品，你就得 1 分艺术家分(Artist Points)，所以你的图被越多人认出来，加分越多。</p>"
          + "<p>本轮加分是这两项之和，直接累加进总分(Total)，五轮下来的总分决定胜负。</p>"
          + "<p>Round Results 会公布每件作品是谁画的、目标坐标是什么，以及每个人的猜测是对是错。</p>",
        en: "<p>Every other player's work you identify correctly earns you one Guess Point.</p>"
          + "<p>Every player who identifies your work earns you one Artist Point, so the more people read your picture the more it pays.</p>"
          + "<p>The two are added together for the round and go straight into your Total, and the total after five rounds decides the winner.</p>"
          + "<p>Round Results reveals who made each work, which coordinate it targeted, and whether each guess was right or wrong.</p>"
      }
    }
  ]
};

const CYBER_PICTURES_EXPLAIN = {
  game_title: { zh: "赛博画影(🖼️)，用受限的数字工具重画照片、再互相竞猜坐标的游戏。", en: "Cyber Pictures (🖼️), where you rebuild photos with limited digital tools and then guess each other's coordinates." },
  phase: { zh: "当前阶段。crafting 是创作，guessing 是竞猜，scoring 是结算，ended 是游戏结束。", en: "The current phase: crafting, guessing, scoring, or ended once the game is over." },
  round: { zh: "当前是第几轮，这一局固定打五轮。", en: "Which round is running. A game always lasts five rounds." },
  tool: { zh: "本轮分配给你的工具，每轮都会轮换一次，所以每种工具你都会轮到。", en: "The tool assigned to you this round. Tools rotate every round so you get to try all of them." },
  target: { zh: "你本轮的秘密目标坐标，你要用工具把矩阵(🖼️)里这张照片重画出来。", en: "Your secret target coordinate for this round. You rebuild that photo from the matrix (🖼️) with your tool." },
  submitted: { zh: "你本轮是否已经提交作品，要等所有人提交完才进入竞猜。", en: "Whether you have submitted your work. Guessing starts once everyone has." },
  guessed: { zh: "你本轮是否已经提交猜测，要等所有人提交完才结算。", en: "Whether you have submitted your guesses. Scoring starts once everyone has." },
  matrix: { zh: "本轮的 4×4 照片矩阵(🖼️)，行是 A 到 D，列是 1 到 4，你的目标坐标会用高亮框标出来。", en: "This round's 4×4 photo matrix (🖼️) with rows A to D and columns 1 to 4. Your target coordinate is highlighted." },
  shoelace_canvas: { zh: "鞋带线(Shoelaces)的画布，按住拖动就拉出一条线，整轮最多两条路径。", en: "The Shoelaces canvas. Press and drag to pull out a line, with at most two paths per round." },
  shoelace_undo: { zh: "撤销最后画的那条路径，只剩一条时按它就等于清空。", en: "Remove the path you drew last. Pressing it with a single path left empties the canvas." },
  shoelace_clear: { zh: "清空鞋带线(Shoelaces)画布上的全部路径，重新开始画。", en: "Wipe every path from the Shoelaces canvas and start again." },
  shoelace_hint: { zh: "提醒你鞋带线(Shoelaces)最多只能画 2 条路径。", en: "A reminder that Shoelaces allows at most 2 paths." },
  pixel_grid: { zh: "像素网格(Pixel Grid)的 3×3 九个格子，点一下就用当前选中的颜色填满这一格。", en: "The nine cells of the 3×3 Pixel Grid. Clicking one fills it with the colour currently selected." },
  pixel_color: { zh: "像素网格(Pixel Grid)九色调色板里的一种颜色，先选中它，再去点九宫格就能把那一格填成这个颜色。", en: "One colour from the nine-swatch Pixel Grid palette. Select it first, then click a cell to fill that cell with it." },
  icon_pick: { zh: "图标组合(Icon Set)图标库里的一个图标，点一下就把它加到画布中央，之后可以拖动位置、轻点旋转。", en: "One icon from the Icon Set library. Clicking it adds it to the middle of the canvas, where you can drag and rotate it." },
  icon_canvas: { zh: "图标组合(Icon Set)的画布，拖动图标换位置，轻点图标转 90°，一共要放 2 到 5 个。", en: "The Icon Set canvas. Drag icons to move them and tap one to spin it 90°. You need between 2 and 5 of them." },
  icon_remove: { zh: "移除最后放上去的那个图标。", en: "Remove the icon you placed last." },
  icon_clear: { zh: "清空画布上的全部图标，重新挑选。", en: "Clear every icon off the canvas and pick again." },
  icon_hint: { zh: "提醒你图标组合(Icon Set)要放 2 到 5 个图标，轻点可以转 90°。", en: "A reminder that the Icon Set needs 2 to 5 icons and that a tap rotates by 90°." },
  letter_pick: { zh: "字母拼贴(AEIOU Collage)的一个大写字母，A E I O U 五个里挑一个，点一下就往画布上加一个。", en: "One capital letter for the AEIOU Collage, chosen from A, E, I, O and U. Clicking it adds a copy to the canvas." },
  letter_canvas: { zh: "字母拼贴(AEIOU Collage)的画布，拖动字母摆位置，轻点字母转 90°，最多放 10 个。", en: "The AEIOU Collage canvas. Drag letters into place and tap one to spin it 90°, with at most 10 letters." },
  letter_rotate: { zh: "旋转滑块，把当前选中的字母转到 0 到 360 度之间的任意角度。", en: "The rotation slider, turning the selected letter to any angle between 0 and 360 degrees." },
  letter_rotate_value: { zh: "当前选中字母的角度读数。", en: "The angle currently applied to the selected letter." },
  letter_rotate_btn: { zh: "把选中的字母快速旋转 90 度，效果和轻点字母一样。", en: "Spin the selected letter 90 degrees, the same as tapping the letter itself." },
  letter_remove: { zh: "删掉当前选中的那个字母。", en: "Delete the letter you currently have selected." },
  letter_clear: { zh: "清空画布上的全部字母。", en: "Clear every letter off the canvas." },
  letter_hint: { zh: "提醒你字母拼贴(AEIOU Collage)可以用滑块任意旋转、轻点转 90°，上限是 10 个字母。", en: "A reminder that the AEIOU Collage rotates freely with the slider, spins 90° on a tap, and holds up to 10 letters." },
  shape_pick: { zh: "几何堆叠(Shape Stacker)七种空心图形之一，正方形(□)、长方形(▭)、三角形(△)、圆形(○)、拱形(◠)、椭圆(⬭)、正六边形(⬡)，点一下就把它加到画布中央。", en: "One of the seven hollow Shape Stacker shapes: square (□), rectangle (▭), triangle (△), circle (○), arch (◠), ellipse (⬭) and hexagon (⬡). Clicking it adds it to the middle of the canvas." },
  shape_canvas: { zh: "几何堆叠(Shape Stacker)的画布，拖动图形摆位置，轻点图形可以选中它。", en: "The Shape Stacker canvas. Drag shapes into place and tap one to select it." },
  shape_rotate: { zh: "旋转滑块，把当前选中的图形转到 0 到 360 度之间的任意角度。", en: "The rotation slider, turning the selected shape to any angle between 0 and 360 degrees." },
  shape_rotate_value: { zh: "当前选中图形的角度读数。", en: "The angle currently applied to the selected shape." },
  shape_remove: { zh: "删掉当前选中的那个图形。", en: "Delete the shape you currently have selected." },
  shape_clear: { zh: "清空画布上的全部图形。", en: "Clear every shape off the canvas." },
  shape_hint: { zh: "提醒你几何堆叠(Shape Stacker)的图形可以拖动摆放并自由旋转。", en: "A reminder that Shape Stacker shapes can be dragged into place and rotated freely." },
  thruster_canvas: { zh: "推进器(Thruster)的画布，火箭点(🟠)从这里起飞，按住鼠标、手指或空格键点火把它往上推。", en: "The Thruster canvas. The rocket dot (🟠) launches from here, and holding the mouse, a finger or the space bar fires the engine to push it up." },
  thruster_attempts: { zh: "推进器(Thruster)本轮还剩几次尝试，整轮一共 3 次，飞出画布就算用掉一次。", en: "How many Thruster attempts you have left this round. You get 3 in total and leaving the canvas spends one." },
  thruster_undo: { zh: "删掉上一次飞出来的轨迹，并把那次尝试机会还给你。", en: "Delete the last flight trail and hand that attempt back to you." },
  thruster_accel: { zh: "火箭点(🟠)当前的加速度，向上为正。点火时推力大于重力，不点火就一直往下掉。", en: "The rocket dot's (🟠) current acceleration with up as positive. Thrust beats gravity while firing, and without it the rocket only falls." },
  thruster_velocity: { zh: "火箭点(🟠)当前的竖直速度，向上为正，可以据此判断该点多久的火。", en: "The rocket dot's (🟠) current vertical speed with up as positive, which tells you how long to fire next." },
  thruster_hint: { zh: "提醒你按住鼠标、手指或空格键就能点火推进。", en: "A reminder that holding the mouse, a finger or the space bar fires the thruster." },
  synth_grid: { zh: "合成器(Synthesizer)的 10 根滑块，每根取 0 到 100 的整数，决定对应柱子的高度。", en: "The 10 Synthesizer sliders. Each takes an integer from 0 to 100 and sets the height of its bar." },
  synth_hint: { zh: "提醒你合成器(Synthesizer)要调 10 根整数滑块来决定柱子的高度。", en: "A reminder that the Synthesizer uses 10 integer sliders to set bar heights." },
  submit_craft: { zh: "提交你的作品。工具的完成条件没满足时按钮会保持禁用，提示会说明还差什么。", en: "Submit your work. The button stays disabled until your tool's requirements are met, and the hint says what is missing." },
  submission_hint: { zh: "提交状态提示，告诉你作品是否已经交上去，或者还差哪一步才能提交。", en: "The submission status, telling you whether the work is in or what still has to be done." },
  work_label: { zh: "这件作品的编号，作者名字被隐藏起来，只有 Work #1 这样的编号，Your Work 才是你自己那件。", en: "The label of this work. Authors are hidden behind numbers like Work #1, and only Your Work is your own." },
  work_preview: { zh: "这件作品的画面，别人就是靠它去猜目标坐标的。", en: "The picture of this work, which is all the other players get when they guess its target coordinate." },
  work_select: { zh: "为这件作品选一个坐标，从 A1 到 D4，你认为作者画的是矩阵(🖼️)里的哪一张。", en: "Pick a coordinate from A1 to D4 for this work, meaning which photo in the matrix (🖼️) you think the author was drawing." },
  work_self: { zh: "这是你自己的作品，你不需要也不能猜它。", en: "This is your own work, so you neither need to nor may guess it." },
  submit_guesses: { zh: "提交你对所有其他作品的坐标猜测，必须每件都选好才能按。", en: "Submit your coordinate guesses for every other work. It unlocks only when all of them are chosen." },
  round_scores: { zh: "本轮每个人的得分明细，Guess 是猜对别人的加分，Artist 是被别人猜对的加分，Total 是累计总分。", en: "This round's score breakdown for each player: Guess for the works you identified, Artist for the players who identified yours, and Total for the running score." },
  reveal: { zh: "本轮答案揭晓，每件作品都会标出作者、目标坐标，以及每个人猜的坐标是对是错。", en: "The round's reveal. Each work shows its author, the target coordinate, and whether every guess was right or wrong." },
  next_round: { zh: "进入下一轮，工具会轮换给下家，矩阵和目标重新分配。", en: "Move to the next round. Tools rotate to the next player and the matrix and targets are dealt again." },
  game_over: { zh: "五轮全部打完，游戏结束，总分最高的人获胜。", en: "All five rounds are done and the game is over. The highest total score wins." },
  players: { zh: "所有玩家的总分和本轮拿到的工具，你自己那一行会高亮。", en: "Every player with their total score and the tool they hold this round. Your own row is highlighted." }
};

let cyberPicturesHelpWidget = null;
let cyberPicturesExplainWidget = null;

function initCyberPicturesHelpExplain() {
  if (cyberPicturesHelpWidget || typeof window.obgCreateHelp !== "function") return;
  cyberPicturesHelpWidget = window.obgCreateHelp(CYBER_PICTURES_HELP_CONFIG);
  cyberPicturesExplainWidget = window.obgCreateExplain({
    gameId: "cyber_pictures",
    attribute: "data-cyber-pictures-explain",
    explanations: CYBER_PICTURES_EXPLAIN,
    button: cyberPicturesExplainButton,
    root: () => document.getElementById("cyberPicturesPanel"),
    bypass: ["#cyberPicturesHelpBtn", "#cyberPicturesExplainBtn"]
  });
  cyberPicturesHelpButton?.addEventListener("click", () => {
    cyberPicturesExplainWidget?.exit();
    cyberPicturesHelpWidget.open();
  });
  cyberPicturesExplainButton?.addEventListener("click", () => cyberPicturesExplainWidget?.toggle());
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initCyberPicturesHelpExplain);
} else {
  initCyberPicturesHelpExplain();
}

const CYBER_TOOL_KEYS = [
  "shoelaces",
  "pixel_grid",
  "icon_set",
  "aeiou",
  "shape_stacker",
  "thruster",
  "synthesizer",
];
const CYBER_TOOL_LABELS = {
  shoelaces: "Shoelaces",
  pixel_grid: "Pixel Grid",
  icon_set: "Icon Set",
  aeiou: "AEIOU Collage",
  shape_stacker: "Shape Stacker",
  thruster: "Thruster",
  synthesizer: "Synthesizer",
};
const CYBER_COORDS = ["A1", "A2", "A3", "A4", "B1", "B2", "B3", "B4", "C1", "C2", "C3", "C4", "D1", "D2", "D3", "D4"];
const CYBER_PIXEL_COLORS = ["#ef4444", "#f97316", "#eab308", "#22c55e", "#3b82f6", "#8b5cf6", "#000000", "#ffffff", "#8b5e34"];
const CYBER_ICON_SET = ["😀", "😺", "🌳", "🌞", "🏠", "🚗", "✈️", "⭐", "⚽", "🎧", "📚", "🍎", "🧩", "🎈", "🎮", "🎹", "🎲", "🧠", "🧸", "🕯️", "💡", "🔧", "🪜", "🔑", "📷", "🖌️", "📌", "🧭", "🌙", "☁️", "🔥", "💧", "🐶", "🐱", "🐦", "🐟", "🦋", "🐢", "🌻", "🌵", "🍕", "🍞", "🍩", "🍓", "☕", "🫖", "🚀", "🛸"];
const CYBER_CANVAS_SIZE = 360;
const CYBER_TEXT_SIZE = 36;
const CYBER_SHAPE_SPECS = {
  square: { w: 70, h: 70 },
  rectangle: { w: 90, h: 60 },
  triangle: { w: 90, h: 70 },
  circle: { w: 70, h: 70 },
  arch: { w: 90, h: 60 },
  ellipse: { w: 90, h: 60 },
  hexagon: { w: 90, h: 70 },
};
const CYBER_THRUSTER_MAX_ATTEMPTS = 3;
const CYBER_THRUSTER_COLOR = "#111111";
const CYBER_THRUSTER_STROKE = 4;
const CYBER_THRUSTER_CROSS_SEC = 6.5;
const CYBER_THRUSTER_GRAVITY_RATIO = 1.0;
const CYBER_THRUSTER_THRUST_RATIO = 2.0;
const CYBER_THRUSTER_RADIUS = 5;
const CYBER_THRUSTER_TOLERANCE = 20;
const CYBER_SYNTH_BARS = 10;

function clampValue(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

const cyberPicturesConfigBox = document.getElementById("cyberPicturesConfigBox");
const cyberPicturesDuplicateRow = document.getElementById("cyberPicturesDuplicateRow");
const cyberPicturesDuplicateToggle = document.getElementById("cyberPicturesDuplicateToggle");
const cyberPicturesToolRow = document.getElementById("cyberPicturesToolRow");
const cyberPicturesToolOptions = document.getElementById("cyberPicturesToolOptions");

const cyberPhaseLabel = document.getElementById("cyberPhase");
const cyberRoundLabel = document.getElementById("cyberRound");
const cyberTotalRoundsLabel = document.getElementById("cyberTotalRounds");
const cyberToolLabel = document.getElementById("cyberToolLabel");
const cyberTargetLabel = document.getElementById("cyberTargetLabel");
const cyberSubmittedLabel = document.getElementById("cyberSubmitted");
const cyberGuessedLabel = document.getElementById("cyberGuessed");
const cyberMatrixEl = document.getElementById("cyberMatrix");
const cyberCraftArea = document.getElementById("cyberCraftArea");
const cyberGuessArea = document.getElementById("cyberGuessArea");
const cyberScoreArea = document.getElementById("cyberScoreArea");
const cyberToolShoelaces = document.getElementById("cyberToolShoelaces");
const cyberShoelaceCanvas = document.getElementById("cyberShoelaceCanvas");
const cyberShoelaceUndoBtn = document.getElementById("cyberShoelaceUndoBtn");
const cyberShoelaceClearBtn = document.getElementById("cyberShoelaceClearBtn");
const cyberToolPixel = document.getElementById("cyberToolPixel");
const cyberPixelGrid = document.getElementById("cyberPixelGrid");
const cyberPixelPalette = document.getElementById("cyberPixelPalette");
const cyberToolIconSet = document.getElementById("cyberToolIconSet");
const cyberIconPalette = document.getElementById("cyberIconPalette");
const cyberIconCanvas = document.getElementById("cyberIconCanvas");
const cyberIconRemoveBtn = document.getElementById("cyberIconRemoveBtn");
const cyberIconClearBtn = document.getElementById("cyberIconClearBtn");
const cyberToolLetters = document.getElementById("cyberToolLetters");
const cyberLetterPalette = document.getElementById("cyberLetterPalette");
const cyberLetterCanvas = document.getElementById("cyberLetterCanvas");
const cyberLetterRotateBtn = document.getElementById("cyberLetterRotateBtn");
const cyberLetterRotate = document.getElementById("cyberLetterRotate");
const cyberLetterRotateValue = document.getElementById("cyberLetterRotateValue");
const cyberLetterRemoveBtn = document.getElementById("cyberLetterRemoveBtn");
const cyberLetterClearBtn = document.getElementById("cyberLetterClearBtn");
const cyberToolShapes = document.getElementById("cyberToolShapes");
const cyberShapePalette = document.getElementById("cyberShapePalette");
const cyberShapeCanvas = document.getElementById("cyberShapeCanvas");
const cyberShapeRotate = document.getElementById("cyberShapeRotate");
const cyberShapeRotateValue = document.getElementById("cyberShapeRotateValue");
const cyberShapeRemoveBtn = document.getElementById("cyberShapeRemoveBtn");
const cyberShapeClearBtn = document.getElementById("cyberShapeClearBtn");
const cyberToolThruster = document.getElementById("cyberToolThruster");
const cyberThrusterCanvas = document.getElementById("cyberThrusterCanvas");
const cyberThrusterAttempts = document.getElementById("cyberThrusterAttempts");
const cyberThrusterAccel = document.getElementById("cyberThrusterAccel");
const cyberThrusterVelocityLabel = document.getElementById("cyberThrusterVelocityLabel");
const cyberThrusterUndoBtn = document.getElementById("cyberThrusterUndoBtn");
const cyberToolSynth = document.getElementById("cyberToolSynth");
const cyberSynthGrid = document.getElementById("cyberSynthGrid");
const cyberSubmitBtn = document.getElementById("cyberSubmitBtn");
const cyberSubmissionHint = document.getElementById("cyberSubmissionHint");
const cyberWorks = document.getElementById("cyberWorks");
const cyberSubmitGuessBtn = document.getElementById("cyberSubmitGuessBtn");
const cyberRoundScores = document.getElementById("cyberRoundScores");
const cyberReveal = document.getElementById("cyberReveal");
const cyberNextRoundBtn = document.getElementById("cyberNextRoundBtn");
const cyberGameOverNotice = document.getElementById("cyberGameOverNotice");
const cyberPlayers = document.getElementById("cyberPlayers");
const cyberShoelaceCtx = cyberShoelaceCanvas ? cyberShoelaceCanvas.getContext("2d") : null;
const cyberThrusterCtx = cyberThrusterCanvas ? cyberThrusterCanvas.getContext("2d") : null;

let currentCyberView = null;

let cyberLastRound = null;
let cyberLastPhase = null;
let cyberLastToolIndex = null;
let cyberShoelacePaths = [];
let cyberShoelaceCurrentPath = null;
let cyberShoelaceDrawing = false;
let cyberPixelCells = [];
let cyberPixelSelectedColor = null;
let cyberIconItems = [];
let cyberIconDragging = null;
let cyberIconSelectedId = null;
let cyberLetterItems = [];
let cyberLetterDragging = null;
let cyberLetterSelectedId = null;
let cyberShapeItems = [];
let cyberShapeDragging = null;
let cyberShapeSelectedId = null;
let cyberThrusterPaths = [];
let cyberThrusterCurrentPath = null;
let cyberThrusterActive = false;
let cyberThrusterThrusting = false;
let cyberThrusterAttemptsLeft = 0;
let cyberThrusterFrame = null;
let cyberThrusterLastTs = null;
let cyberThrusterX = 0;
let cyberThrusterY = 0;
let cyberThrusterVelocity = 0;
let cyberThrusterWasOutside = false;
let cyberSynthValues = [];
let cyberSynthBarEls = [];
let cyberSynthSliderEls = [];
let cyberGuessSelections = {};

let cyberPicturesDisabledTools = new Set();

function updateCyberPicturesConfigRow() {
  const showRow = currentRoomState && currentGameType === "cyber_pictures" && currentRoomState.status === "lobby";
  if (cyberPicturesConfigBox) {
    cyberPicturesConfigBox.classList.toggle("hidden", !showRow);
    cyberPicturesConfigBox.setAttribute("aria-hidden", (!showRow).toString());
  }
  if (cyberPicturesDuplicateRow) {
    cyberPicturesDuplicateRow.classList.toggle("hidden", !showRow);
    cyberPicturesDuplicateRow.setAttribute("aria-hidden", (!showRow).toString());
  }
  if (cyberPicturesToolRow) {
    cyberPicturesToolRow.classList.toggle("hidden", !showRow);
    cyberPicturesToolRow.setAttribute("aria-hidden", (!showRow).toString());
  }
  if (showRow) {
    renderCyberPicturesToolOptions();
  }
}

function renderCyberPicturesToolOptions() {
  if (!cyberPicturesToolOptions) {
    return;
  }
  cyberPicturesToolOptions.innerHTML = "";
  CYBER_TOOL_KEYS.forEach((toolKey) => {
    const label = document.createElement("label");
    label.className = "cyber-tool-option";
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.value = toolKey;
    checkbox.checked = cyberPicturesDisabledTools.has(toolKey);
    checkbox.addEventListener("change", () => {
      if (checkbox.checked) {
        cyberPicturesDisabledTools.add(toolKey);
      } else {
        cyberPicturesDisabledTools.delete(toolKey);
      }
    });
    const text = document.createElement("span");
    text.textContent = CYBER_TOOL_LABELS[toolKey] || toolKey;
    label.appendChild(checkbox);
    label.appendChild(text);
    cyberPicturesToolOptions.appendChild(label);
  });
}

function getCyberCanvasPos(event, canvas) {
  const rect = canvas.getBoundingClientRect();
  const scaleX = rect.width ? canvas.width / rect.width : 1;
  const scaleY = rect.height ? canvas.height / rect.height : 1;
  return {
    x: (event.clientX - rect.left) * scaleX,
    y: (event.clientY - rect.top) * scaleY,
  };
}

function getCyberRelativePos(event, container) {
  const rect = container.getBoundingClientRect();
  return {
    x: event.clientX - rect.left,
    y: event.clientY - rect.top,
    width: rect.width || CYBER_CANVAS_SIZE,
    height: rect.height || CYBER_CANVAS_SIZE,
  };
}

function getCyberStageSize(container) {
  if (!container) {
    return { width: CYBER_CANVAS_SIZE, height: CYBER_CANVAS_SIZE };
  }
  const rect = container.getBoundingClientRect();
  const width = rect.width && rect.width > 0 ? rect.width : CYBER_CANVAS_SIZE;
  const height = rect.height && rect.height > 0 ? rect.height : CYBER_CANVAS_SIZE;
  return { width, height };
}

function renderCyberShoelaceCanvas() {
  if (!cyberShoelaceCtx || !cyberShoelaceCanvas) {
    return;
  }
  const width = cyberShoelaceCanvas.width;
  const height = cyberShoelaceCanvas.height;
  cyberShoelaceCtx.clearRect(0, 0, width, height);
  cyberShoelaceCtx.fillStyle = "#ffffff";
  cyberShoelaceCtx.fillRect(0, 0, width, height);
  cyberShoelaceCtx.lineCap = "round";
  cyberShoelaceCtx.lineJoin = "round";
  cyberShoelacePaths.forEach((path) => {
    const points = path.points || [];
    if (points.length < 2) {
      return;
    }
    cyberShoelaceCtx.strokeStyle = path.color || "#111111";
    cyberShoelaceCtx.lineWidth = path.width || 4;
    cyberShoelaceCtx.beginPath();
    cyberShoelaceCtx.moveTo(points[0].x, points[0].y);
    points.slice(1).forEach((pt) => cyberShoelaceCtx.lineTo(pt.x, pt.y));
    cyberShoelaceCtx.stroke();
  });
}

function startCyberShoelaceDraw(event) {
  if (!cyberShoelaceCanvas || !cyberShoelaceCtx) {
    return;
  }
  if (cyberShoelacePaths.length >= 2) {
    return;
  }
  event.preventDefault();
  const pos = getCyberCanvasPos(event, cyberShoelaceCanvas);
  cyberShoelaceCurrentPath = { points: [pos], color: "#111111", width: 4 };
  cyberShoelacePaths.push(cyberShoelaceCurrentPath);
  cyberShoelaceDrawing = true;
  renderCyberShoelaceCanvas();
}

function moveCyberShoelaceDraw(event) {
  if (!cyberShoelaceDrawing || !cyberShoelaceCurrentPath || !cyberShoelaceCanvas) {
    return;
  }
  const pos = getCyberCanvasPos(event, cyberShoelaceCanvas);
  cyberShoelaceCurrentPath.points.push(pos);
  renderCyberShoelaceCanvas();
  updateCyberSubmitButton(currentCyberView);
}

function endCyberShoelaceDraw() {
  cyberShoelaceDrawing = false;
  cyberShoelaceCurrentPath = null;
}

function clearCyberShoelace() {
  cyberShoelacePaths = [];
  cyberShoelaceCurrentPath = null;
  cyberShoelaceDrawing = false;
  renderCyberShoelaceCanvas();
  updateCyberSubmitButton(currentCyberView);
}

function undoCyberShoelace() {
  cyberShoelacePaths = cyberShoelacePaths.slice(0, -1);
  renderCyberShoelaceCanvas();
  updateCyberSubmitButton(currentCyberView);
}

function ensureCyberPixelCells() {
  if (!Array.isArray(cyberPixelCells) || cyberPixelCells.length !== 9) {
    cyberPixelCells = Array(9).fill(null);
  }
  if (!cyberPixelSelectedColor) {
    cyberPixelSelectedColor = CYBER_PIXEL_COLORS[0];
  }
}

function renderCyberPixelPalette() {
  if (!cyberPixelPalette || cyberPixelPalette.childNodes.length) {
    return;
  }
  CYBER_PIXEL_COLORS.forEach((color) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "cyber-pixel-color";
    button.setAttribute("data-cyber-pictures-explain", "pixel_color");
    button.style.background = color;
    button.title = color;
    button.addEventListener("click", () => {
      cyberPixelSelectedColor = color;
      updateCyberPixelPaletteHighlight();
    });
    cyberPixelPalette.appendChild(button);
  });
  updateCyberPixelPaletteHighlight();
}

function updateCyberPixelPaletteHighlight() {
  if (!cyberPixelPalette) {
    return;
  }
  const buttons = Array.from(cyberPixelPalette.querySelectorAll(".cyber-pixel-color"));
  buttons.forEach((button) => {
    const active = button.style.background === cyberPixelSelectedColor;
    button.classList.toggle("active", active);
  });
}

function initCyberPixelGrid() {
  if (!cyberPixelGrid || cyberPixelGrid.childNodes.length) {
    return;
  }
  ensureCyberPixelCells();
  for (let idx = 0; idx < 9; idx += 1) {
    const cell = document.createElement("div");
    cell.className = "cyber-pixel-cell";
    cell.dataset.index = `${idx}`;
    cell.addEventListener("click", () => {
      ensureCyberPixelCells();
      cyberPixelCells[idx] = cyberPixelSelectedColor;
      renderCyberPixelGrid();
      updateCyberSubmitButton(currentCyberView);
    });
    cyberPixelGrid.appendChild(cell);
  }
  renderCyberPixelGrid();
}

function renderCyberPixelGrid() {
  if (!cyberPixelGrid) {
    return;
  }
  ensureCyberPixelCells();
  Array.from(cyberPixelGrid.children).forEach((cell, idx) => {
    const color = cyberPixelCells[idx];
    if (color) {
      cell.style.background = color;
      cell.classList.remove("empty");
    } else {
      cell.style.background = "";
      cell.classList.add("empty");
    }
  });
}

function renderCyberIconPalette() {
  if (!cyberIconPalette || cyberIconPalette.childNodes.length) {
    return;
  }
  CYBER_ICON_SET.forEach((emoji) => {
    const button = document.createElement("button");
    button.type = "button";
    button.setAttribute("data-cyber-pictures-explain", "icon_pick");
    button.textContent = emoji;
    button.addEventListener("click", () => addCyberIcon(emoji));
    cyberIconPalette.appendChild(button);
  });
}

function addCyberIcon(emoji) {
  if (!cyberIconCanvas) {
    return;
  }
  if (cyberIconItems.length >= 5) {
    return;
  }
  const { width, height } = getCyberStageSize(cyberIconCanvas);
  const offset = (cyberIconItems.length % 3) * 12;
  const id = `icon-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  cyberIconItems.push({
    id,
    emoji,
    x: width / 2 + offset,
    y: height / 2 + offset,
    rotation: 0,
  });
  cyberIconSelectedId = id;
  renderCyberIconCanvas();
  updateCyberSubmitButton(currentCyberView);
}

function renderCyberIconCanvas() {
  if (!cyberIconCanvas) {
    return;
  }
  cyberIconCanvas.innerHTML = "";
  cyberIconItems.forEach((item) => {
    const el = document.createElement("div");
    el.className = "cyber-stage-item";
    if (item.id === cyberIconSelectedId) {
      el.classList.add("selected");
    }
    el.textContent = item.emoji;
    el.style.left = `${item.x}px`;
    el.style.top = `${item.y}px`;
    el.style.fontSize = "32px";
    el.style.transform = `translate(-50%, -50%) rotate(${item.rotation || 0}deg)`;
    el.dataset.id = item.id;
    el.addEventListener("pointerdown", startCyberIconDrag);
    cyberIconCanvas.appendChild(el);
  });
}

function startCyberIconDrag(event) {
  if (!cyberIconCanvas) {
    return;
  }
  const id = event.currentTarget.dataset.id;
  const item = cyberIconItems.find((entry) => entry.id === id);
  if (!item) {
    return;
  }
  event.preventDefault();
  const pos = getCyberRelativePos(event, cyberIconCanvas);
  cyberIconDragging = {
    id,
    offsetX: item.x - pos.x,
    offsetY: item.y - pos.y,
    element: event.currentTarget,
    startX: pos.x,
    startY: pos.y,
    moved: false,
  };
  cyberIconSelectedId = id;
  window.addEventListener("pointermove", onCyberIconDragMove);
  window.addEventListener("pointerup", onCyberIconDragEnd, { once: true });
}

function onCyberIconDragMove(event) {
  if (!cyberIconDragging || !cyberIconCanvas) {
    return;
  }
  const item = cyberIconItems.find((entry) => entry.id === cyberIconDragging.id);
  if (!item) {
    return;
  }
  const pos = getCyberRelativePos(event, cyberIconCanvas);
  const x = clampValue(pos.x + cyberIconDragging.offsetX, 0, pos.width);
  const y = clampValue(pos.y + cyberIconDragging.offsetY, 0, pos.height);
  item.x = x;
  item.y = y;
  if (Math.hypot(pos.x - cyberIconDragging.startX, pos.y - cyberIconDragging.startY) > 4) {
    cyberIconDragging.moved = true;
  }
  if (cyberIconDragging.element) {
    cyberIconDragging.element.style.left = `${x}px`;
    cyberIconDragging.element.style.top = `${y}px`;
  }
}

function onCyberIconDragEnd() {
  window.removeEventListener("pointermove", onCyberIconDragMove);
  const dragState = cyberIconDragging;
  if (dragState && !dragState.moved) {
    const item = cyberIconItems.find((entry) => entry.id === dragState.id);
    if (item) {
      item.rotation = (item.rotation + 90) % 360;
    }
  }
  cyberIconDragging = null;
  renderCyberIconCanvas();
  updateCyberSubmitButton(currentCyberView);
}

function removeCyberIcon() {
  const removed = cyberIconItems[cyberIconItems.length - 1];
  cyberIconItems = cyberIconItems.slice(0, -1);
  if (removed && removed.id === cyberIconSelectedId) {
    cyberIconSelectedId = null;
  }
  renderCyberIconCanvas();
  updateCyberSubmitButton(currentCyberView);
}

function clearCyberIcons() {
  cyberIconItems = [];
  cyberIconSelectedId = null;
  renderCyberIconCanvas();
  updateCyberSubmitButton(currentCyberView);
}

function renderCyberLetterPalette() {
  if (!cyberLetterPalette || cyberLetterPalette.childNodes.length) {
    return;
  }
  ["A", "E", "I", "O", "U"].forEach((char) => {
    const button = document.createElement("button");
    button.type = "button";
    button.setAttribute("data-cyber-pictures-explain", "letter_pick");
    button.textContent = char;
    button.addEventListener("click", () => addCyberLetter(char));
    cyberLetterPalette.appendChild(button);
  });
}

function addCyberLetter(char) {
  if (!cyberLetterCanvas) {
    return;
  }
  if (cyberLetterItems.length >= 10) {
    return;
  }
  const { width, height } = getCyberStageSize(cyberLetterCanvas);
  const offset = (cyberLetterItems.length % 4) * 10;
  const id = `letter-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  cyberLetterItems.push({
    id,
    char,
    x: width / 2 + offset,
    y: height / 2 + offset,
    rotation: 0,
  });
  cyberLetterSelectedId = id;
  updateCyberLetterRotationControl();
  renderCyberLetterCanvas();
  updateCyberSubmitButton(currentCyberView);
}

function renderCyberLetterCanvas() {
  if (!cyberLetterCanvas) {
    return;
  }
  cyberLetterCanvas.innerHTML = "";
  cyberLetterItems.forEach((item) => {
    const el = document.createElement("div");
    el.className = "cyber-stage-item";
    if (item.id === cyberLetterSelectedId) {
      el.classList.add("selected");
    }
    el.textContent = item.char;
    el.style.left = `${item.x}px`;
    el.style.top = `${item.y}px`;
    el.style.fontSize = "42px";
    el.style.fontWeight = "700";
    el.style.transform = `translate(-50%, -50%) rotate(${item.rotation}deg)`;
    el.dataset.id = item.id;
    el.addEventListener("pointerdown", startCyberLetterDrag);
    cyberLetterCanvas.appendChild(el);
  });
}

function updateCyberLetterRotationControl() {
  if (!cyberLetterRotate || !cyberLetterRotateValue) {
    return;
  }
  const item = cyberLetterItems.find((entry) => entry.id === cyberLetterSelectedId);
  const rotation = item ? item.rotation || 0 : 0;
  cyberLetterRotate.value = `${rotation}`;
  cyberLetterRotateValue.textContent = `${rotation}°`;
}

function setCyberLetterRotation(value) {
  const item = cyberLetterItems.find((entry) => entry.id === cyberLetterSelectedId);
  if (!item) {
    return;
  }
  const rotation = Number.isFinite(value) ? value : 0;
  item.rotation = rotation;
  updateCyberLetterRotationControl();
  renderCyberLetterCanvas();
  updateCyberSubmitButton(currentCyberView);
}

function startCyberLetterDrag(event) {
  if (!cyberLetterCanvas) {
    return;
  }
  const id = event.currentTarget.dataset.id;
  const item = cyberLetterItems.find((entry) => entry.id === id);
  if (!item) {
    return;
  }
  event.preventDefault();
  const pos = getCyberRelativePos(event, cyberLetterCanvas);
  cyberLetterDragging = {
    id,
    offsetX: item.x - pos.x,
    offsetY: item.y - pos.y,
    element: event.currentTarget,
    startX: pos.x,
    startY: pos.y,
    moved: false,
  };
  cyberLetterSelectedId = id;
  updateCyberLetterRotationControl();
  window.addEventListener("pointermove", onCyberLetterDragMove);
  window.addEventListener("pointerup", onCyberLetterDragEnd, { once: true });
}

function onCyberLetterDragMove(event) {
  if (!cyberLetterDragging || !cyberLetterCanvas) {
    return;
  }
  const item = cyberLetterItems.find((entry) => entry.id === cyberLetterDragging.id);
  if (!item) {
    return;
  }
  const pos = getCyberRelativePos(event, cyberLetterCanvas);
  const x = clampValue(pos.x + cyberLetterDragging.offsetX, 0, pos.width);
  const y = clampValue(pos.y + cyberLetterDragging.offsetY, 0, pos.height);
  item.x = x;
  item.y = y;
  if (Math.hypot(pos.x - cyberLetterDragging.startX, pos.y - cyberLetterDragging.startY) > 4) {
    cyberLetterDragging.moved = true;
  }
  if (cyberLetterDragging.element) {
    cyberLetterDragging.element.style.left = `${x}px`;
    cyberLetterDragging.element.style.top = `${y}px`;
  }
}

function onCyberLetterDragEnd() {
  window.removeEventListener("pointermove", onCyberLetterDragMove);
  const dragState = cyberLetterDragging;
  if (dragState && !dragState.moved) {
    const item = cyberLetterItems.find((entry) => entry.id === dragState.id);
    if (item) {
      item.rotation = (item.rotation + 90) % 360;
    }
  }
  cyberLetterDragging = null;
  updateCyberLetterRotationControl();
  renderCyberLetterCanvas();
  updateCyberSubmitButton(currentCyberView);
}

function rotateSelectedCyberLetter() {
  if (!cyberLetterSelectedId) {
    return;
  }
  const item = cyberLetterItems.find((entry) => entry.id === cyberLetterSelectedId);
  if (!item) {
    return;
  }
  item.rotation = (item.rotation + 90) % 360;
  updateCyberLetterRotationControl();
  renderCyberLetterCanvas();
  updateCyberSubmitButton(currentCyberView);
}

function removeSelectedCyberLetter() {
  if (!cyberLetterSelectedId) {
    return;
  }
  cyberLetterItems = cyberLetterItems.filter((entry) => entry.id !== cyberLetterSelectedId);
  cyberLetterSelectedId = null;
  updateCyberLetterRotationControl();
  renderCyberLetterCanvas();
  updateCyberSubmitButton(currentCyberView);
}

function clearCyberLetters() {
  cyberLetterItems = [];
  cyberLetterSelectedId = null;
  updateCyberLetterRotationControl();
  renderCyberLetterCanvas();
  updateCyberSubmitButton(currentCyberView);
}

function renderCyberShapePalette() {
  if (!cyberShapePalette || cyberShapePalette.childNodes.length) {
    return;
  }
  const shapes = [
    { id: "square", label: "□" },
    { id: "rectangle", label: "▭" },
    { id: "triangle", label: "△" },
    { id: "circle", label: "○" },
    { id: "arch", label: "◠" },
    { id: "ellipse", label: "⬭" },
    { id: "hexagon", label: "⬡" },
  ];
  shapes.forEach((shape) => {
    const button = document.createElement("button");
    button.type = "button";
    button.setAttribute("data-cyber-pictures-explain", "shape_pick");
    button.textContent = shape.label;
    button.addEventListener("click", () => addCyberShape(shape.id));
    cyberShapePalette.appendChild(button);
  });
}

function addCyberShape(shape) {
  if (!cyberShapeCanvas) {
    return;
  }
  if (cyberShapeItems.length >= 12) {
    return;
  }
  const { width, height } = getCyberStageSize(cyberShapeCanvas);
  const offset = (cyberShapeItems.length % 4) * 10;
  const id = `shape-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  cyberShapeItems.push({
    id,
    shape,
    x: width / 2 + offset,
    y: height / 2 + offset,
    rotation: 0,
  });
  cyberShapeSelectedId = id;
  updateCyberShapeRotationControl();
  renderCyberShapeCanvas();
  updateCyberSubmitButton(currentCyberView);
}

function buildCyberShapeSvg(shape, spec) {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", `0 0 ${spec.w} ${spec.h}`);
  svg.setAttribute("width", "100%");
  svg.setAttribute("height", "100%");
  svg.setAttribute("class", "cyber-shape");
  svg.setAttribute("aria-hidden", "true");
  svg.setAttribute("focusable", "false");
  const strokeWidth = 3;
  const stroke = "#111827";
  const applyStroke = (el) => {
    el.setAttribute("fill", "none");
    el.setAttribute("stroke", stroke);
    el.setAttribute("stroke-width", `${strokeWidth}`);
    el.setAttribute("stroke-linecap", "round");
    el.setAttribute("stroke-linejoin", "round");
  };
  if (shape === "square" || shape === "rectangle") {
    const rect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
    rect.setAttribute("x", `${strokeWidth / 2}`);
    rect.setAttribute("y", `${strokeWidth / 2}`);
    rect.setAttribute("width", `${spec.w - strokeWidth}`);
    rect.setAttribute("height", `${spec.h - strokeWidth}`);
    applyStroke(rect);
    svg.appendChild(rect);
    return svg;
  }
  if (shape === "circle") {
    const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
    const radius = Math.min(spec.w, spec.h) / 2 - strokeWidth / 2;
    circle.setAttribute("cx", `${spec.w / 2}`);
    circle.setAttribute("cy", `${spec.h / 2}`);
    circle.setAttribute("r", `${radius}`);
    applyStroke(circle);
    svg.appendChild(circle);
    return svg;
  }
  if (shape === "ellipse") {
    const ellipse = document.createElementNS("http://www.w3.org/2000/svg", "ellipse");
    ellipse.setAttribute("cx", `${spec.w / 2}`);
    ellipse.setAttribute("cy", `${spec.h / 2}`);
    ellipse.setAttribute("rx", `${spec.w / 2 - strokeWidth / 2}`);
    ellipse.setAttribute("ry", `${spec.h / 2 - strokeWidth / 2}`);
    applyStroke(ellipse);
    svg.appendChild(ellipse);
    return svg;
  }
  if (shape === "triangle") {
    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    const topY = strokeWidth / 2;
    const bottomY = spec.h - strokeWidth / 2;
    const leftX = strokeWidth / 2;
    const rightX = spec.w - strokeWidth / 2;
    path.setAttribute("d", `M ${spec.w / 2} ${topY} L ${rightX} ${bottomY} L ${leftX} ${bottomY} Z`);
    applyStroke(path);
    svg.appendChild(path);
    return svg;
  }
  if (shape === "arch") {
    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    const radius = spec.w / 2 - strokeWidth / 2;
    const bottomY = spec.h - strokeWidth / 2;
    let arcY = spec.h - radius - strokeWidth / 2;
    if (arcY < strokeWidth / 2) {
      arcY = strokeWidth / 2;
    }
    const leftX = strokeWidth / 2;
    const rightX = spec.w - strokeWidth / 2;
    path.setAttribute(
      "d",
      `M ${leftX} ${bottomY} L ${leftX} ${arcY} A ${radius} ${radius} 0 0 0 ${rightX} ${arcY} L ${rightX} ${bottomY} Z`
    );
    applyStroke(path);
    svg.appendChild(path);
    return svg;
  }
  if (shape === "hexagon") {
    const polygon = document.createElementNS("http://www.w3.org/2000/svg", "polygon");
    const w = spec.w - strokeWidth;
    const h = spec.h - strokeWidth;
    const offset = strokeWidth / 2;
    const dx = w * 0.25;
    const points = [
      [offset + dx, offset],
      [offset + w - dx, offset],
      [offset + w, offset + h / 2],
      [offset + w - dx, offset + h],
      [offset + dx, offset + h],
      [offset, offset + h / 2],
    ]
      .map((pair) => pair.join(","))
      .join(" ");
    polygon.setAttribute("points", points);
    applyStroke(polygon);
    svg.appendChild(polygon);
    return svg;
  }
  return svg;
}

function renderCyberShapeCanvas() {
  if (!cyberShapeCanvas) {
    return;
  }
  cyberShapeCanvas.innerHTML = "";
  cyberShapeItems.forEach((item) => {
    const shapeKey = item.shape === "cylinder" ? "ellipse" : item.shape;
    const spec = CYBER_SHAPE_SPECS[shapeKey] || { w: 80, h: 60 };
    const wrapper = document.createElement("div");
    wrapper.className = "cyber-stage-item cyber-shape-item";
    if (item.id === cyberShapeSelectedId) {
      wrapper.classList.add("selected");
    }
    wrapper.style.left = `${item.x}px`;
    wrapper.style.top = `${item.y}px`;
    wrapper.style.width = `${spec.w}px`;
    wrapper.style.height = `${spec.h}px`;
    wrapper.style.transform = `translate(-50%, -50%) rotate(${item.rotation}deg)`;
    wrapper.dataset.id = item.id;
    wrapper.addEventListener("pointerdown", startCyberShapeDrag);

    const shapeEl = buildCyberShapeSvg(shapeKey, spec);
    wrapper.appendChild(shapeEl);
    cyberShapeCanvas.appendChild(wrapper);
  });
}

function startCyberShapeDrag(event) {
  if (!cyberShapeCanvas) {
    return;
  }
  const id = event.currentTarget.dataset.id;
  const item = cyberShapeItems.find((entry) => entry.id === id);
  if (!item) {
    return;
  }
  event.preventDefault();
  const pos = getCyberRelativePos(event, cyberShapeCanvas);
  cyberShapeDragging = {
    id,
    offsetX: item.x - pos.x,
    offsetY: item.y - pos.y,
    element: event.currentTarget,
  };
  cyberShapeSelectedId = id;
  updateCyberShapeRotationControl();
  window.addEventListener("pointermove", onCyberShapeDragMove);
  window.addEventListener("pointerup", onCyberShapeDragEnd, { once: true });
}

function onCyberShapeDragMove(event) {
  if (!cyberShapeDragging || !cyberShapeCanvas) {
    return;
  }
  const item = cyberShapeItems.find((entry) => entry.id === cyberShapeDragging.id);
  if (!item) {
    return;
  }
  const pos = getCyberRelativePos(event, cyberShapeCanvas);
  const x = clampValue(pos.x + cyberShapeDragging.offsetX, 0, pos.width);
  const y = clampValue(pos.y + cyberShapeDragging.offsetY, 0, pos.height);
  item.x = x;
  item.y = y;
  if (cyberShapeDragging.element) {
    cyberShapeDragging.element.style.left = `${x}px`;
    cyberShapeDragging.element.style.top = `${y}px`;
  }
}

function onCyberShapeDragEnd() {
  window.removeEventListener("pointermove", onCyberShapeDragMove);
  cyberShapeDragging = null;
  renderCyberShapeCanvas();
  updateCyberSubmitButton(currentCyberView);
}

function updateCyberShapeRotationControl() {
  if (!cyberShapeRotate || !cyberShapeRotateValue) {
    return;
  }
  const item = cyberShapeItems.find((entry) => entry.id === cyberShapeSelectedId);
  const rotation = item ? item.rotation : 0;
  cyberShapeRotate.value = `${rotation}`;
  cyberShapeRotateValue.textContent = `${rotation}°`;
}

function setCyberShapeRotation(value) {
  const item = cyberShapeItems.find((entry) => entry.id === cyberShapeSelectedId);
  if (!item) {
    return;
  }
  const rotation = Number.isFinite(value) ? value : 0;
  item.rotation = rotation;
  updateCyberShapeRotationControl();
  renderCyberShapeCanvas();
  updateCyberSubmitButton(currentCyberView);
}

function removeSelectedCyberShape() {
  if (!cyberShapeSelectedId) {
    return;
  }
  cyberShapeItems = cyberShapeItems.filter((entry) => entry.id !== cyberShapeSelectedId);
  cyberShapeSelectedId = null;
  updateCyberShapeRotationControl();
  renderCyberShapeCanvas();
  updateCyberSubmitButton(currentCyberView);
}

function clearCyberShapes() {
  cyberShapeItems = [];
  cyberShapeSelectedId = null;
  updateCyberShapeRotationControl();
  renderCyberShapeCanvas();
  updateCyberSubmitButton(currentCyberView);
}

function drawCyberSmoothPath(ctx, points) {
  if (!points || points.length < 2) {
    return;
  }
  let segment = [];
  const flush = () => {
    if (segment.length < 2) {
      segment = [];
      return;
    }
    ctx.beginPath();
    ctx.moveTo(segment[0].x, segment[0].y);
    for (let i = 1; i < segment.length - 1; i += 1) {
      const midX = (segment[i].x + segment[i + 1].x) / 2;
      const midY = (segment[i].y + segment[i + 1].y) / 2;
      ctx.quadraticCurveTo(segment[i].x, segment[i].y, midX, midY);
    }
    const last = segment[segment.length - 1];
    ctx.lineTo(last.x, last.y);
    ctx.stroke();
    segment = [];
  };
  points.forEach((pt) => {
    if (!pt || !Number.isFinite(pt.x) || !Number.isFinite(pt.y)) {
      flush();
      return;
    }
    segment.push(pt);
  });
  flush();
}

function getCyberThrusterParams(width, height) {
  const speed = width / CYBER_THRUSTER_CROSS_SEC;
  return {
    speed,
    gravity: height * CYBER_THRUSTER_GRAVITY_RATIO,
    thrust: height * CYBER_THRUSTER_THRUST_RATIO,
    radius: CYBER_THRUSTER_RADIUS,
  };
}

function getCyberThrusterStartPoint(width, height) {
  const params = getCyberThrusterParams(width, height);
  return {
    x: params.radius,
    y: height * 0.5,
  };
}

function getCyberThrusterBounds(width, height) {
  const params = getCyberThrusterParams(width, height);
  const margin = CYBER_THRUSTER_TOLERANCE;
  return {
    inner: {
      left: margin + params.radius,
      right: width - margin - params.radius,
      top: margin + params.radius,
      bottom: height - margin - params.radius,
    },
    outer: {
      left: params.radius,
      right: width - params.radius,
      top: params.radius,
      bottom: height - params.radius,
    },
  };
}

function isCyberThrusterInBounds(bounds, x, y) {
  return x >= bounds.left && x <= bounds.right && y >= bounds.top && y <= bounds.bottom;
}

function formatSignedMetric(value) {
  const rounded = Math.round(value * 10) / 10;
  const display = Math.abs(rounded) < 0.05 ? 0 : rounded;
  const sign = display >= 0 ? "+" : "";
  return `${sign}${display.toFixed(1)}`;
}

function updateCyberThrusterMetrics(width, height) {
  if (!cyberThrusterAccel && !cyberThrusterVelocityLabel) {
    return;
  }
  let accel = 0;
  let velocity = 0;
  if (cyberThrusterActive && Number.isFinite(width) && Number.isFinite(height)) {
    const params = getCyberThrusterParams(width, height);
    const thrust = cyberThrusterThrusting ? params.thrust : 0;
    accel = thrust - params.gravity;
    velocity = -cyberThrusterVelocity;
  }
  if (cyberThrusterAccel) {
    cyberThrusterAccel.textContent = `Acceleration (up +): ${formatSignedMetric(accel)} px/s^2`;
  }
  if (cyberThrusterVelocityLabel) {
    cyberThrusterVelocityLabel.textContent = `Velocity (up +): ${formatSignedMetric(velocity)} px/s`;
  }
}

function recordCyberThrusterPoint(x, y, bounds) {
  if (!cyberThrusterCurrentPath) {
    return;
  }
  const inInner = isCyberThrusterInBounds(bounds.inner, x, y);
  if (inInner) {
    const points = cyberThrusterCurrentPath.points;
    if (cyberThrusterWasOutside && points.length > 0 && points[points.length - 1] !== null) {
      points.push(null);
    }
    points.push({ x, y });
    cyberThrusterWasOutside = false;
  } else {
    cyberThrusterWasOutside = true;
  }
}

function setCyberThrusterStartPosition() {
  if (!cyberThrusterCanvas) {
    return;
  }
  const width = cyberThrusterCanvas.width;
  const height = cyberThrusterCanvas.height;
  const start = getCyberThrusterStartPoint(width, height);
  cyberThrusterX = start.x;
  cyberThrusterY = start.y;
  cyberThrusterVelocity = 0;
}

function updateCyberThrusterAttempts() {
  if (cyberThrusterAttempts) {
    cyberThrusterAttempts.textContent = `Attempts left: ${cyberThrusterAttemptsLeft}`;
  }
  if (cyberThrusterUndoBtn) {
    cyberThrusterUndoBtn.disabled = cyberThrusterPaths.length === 0;
  }
}

function renderCyberThrusterCanvas() {
  if (!cyberThrusterCanvas || !cyberThrusterCtx) {
    return;
  }
  const width = cyberThrusterCanvas.width;
  const height = cyberThrusterCanvas.height;
  cyberThrusterCtx.clearRect(0, 0, width, height);
  cyberThrusterCtx.fillStyle = "#ffffff";
  cyberThrusterCtx.fillRect(0, 0, width, height);
  cyberThrusterCtx.lineCap = "round";
  cyberThrusterCtx.lineJoin = "round";
  cyberThrusterPaths.forEach((path) => {
    const points = path.points || [];
    if (points.length < 2) {
      return;
    }
    cyberThrusterCtx.strokeStyle = path.color || CYBER_THRUSTER_COLOR;
    cyberThrusterCtx.lineWidth = path.width || CYBER_THRUSTER_STROKE;
    drawCyberSmoothPath(cyberThrusterCtx, points);
  });
  const start = getCyberThrusterStartPoint(width, height);
  const rocketX = cyberThrusterActive ? cyberThrusterX : start.x;
  const rocketY = cyberThrusterActive ? cyberThrusterY : start.y;
  cyberThrusterCtx.fillStyle = "#f97316";
  cyberThrusterCtx.beginPath();
  cyberThrusterCtx.arc(rocketX, rocketY, CYBER_THRUSTER_RADIUS, 0, Math.PI * 2);
  cyberThrusterCtx.fill();
  updateCyberThrusterMetrics(width, height);
}

function startCyberThrusterLaunch() {
  if (!cyberThrusterCanvas || !cyberThrusterCtx) {
    return;
  }
  if (cyberThrusterActive || cyberThrusterAttemptsLeft <= 0) {
    return;
  }
  if (!currentCyberView || currentCyberView.phase !== "crafting") {
    return;
  }
  const toolKey = Number.isFinite(currentCyberView.your_tool)
    ? CYBER_TOOL_KEYS[currentCyberView.your_tool]
    : null;
  if (toolKey !== "thruster") {
    return;
  }
  const width = cyberThrusterCanvas.width;
  const height = cyberThrusterCanvas.height;
  cyberThrusterAttemptsLeft -= 1;
  setCyberThrusterStartPosition();
  cyberThrusterCurrentPath = {
    points: [],
    color: CYBER_THRUSTER_COLOR,
    width: CYBER_THRUSTER_STROKE,
  };
  cyberThrusterPaths.push(cyberThrusterCurrentPath);
  cyberThrusterActive = true;
  cyberThrusterThrusting = false;
  cyberThrusterLastTs = null;
  cyberThrusterWasOutside = false;
  recordCyberThrusterPoint(cyberThrusterX, cyberThrusterY, getCyberThrusterBounds(width, height));
  updateCyberThrusterAttempts();
  renderCyberThrusterCanvas();
  cyberThrusterFrame = window.requestAnimationFrame(stepCyberThruster);
}

function stepCyberThruster(timestamp) {
  if (!cyberThrusterActive || !cyberThrusterCanvas) {
    cyberThrusterFrame = null;
    return;
  }
  const width = cyberThrusterCanvas.width;
  const height = cyberThrusterCanvas.height;
  if (!cyberThrusterLastTs) {
    cyberThrusterLastTs = timestamp;
  }
  const dt = Math.min(0.05, (timestamp - cyberThrusterLastTs) / 1000);
  cyberThrusterLastTs = timestamp;
  const params = getCyberThrusterParams(width, height);
  const thrust = cyberThrusterThrusting ? params.thrust : 0;
  cyberThrusterVelocity += (params.gravity - thrust) * dt;
  cyberThrusterY += cyberThrusterVelocity * dt;
  cyberThrusterX += params.speed * dt;
  const bounds = getCyberThrusterBounds(width, height);
  recordCyberThrusterPoint(cyberThrusterX, cyberThrusterY, bounds);
  renderCyberThrusterCanvas();
  updateCyberSubmitButton(currentCyberView);
  if (!isCyberThrusterInBounds(bounds.outer, cyberThrusterX, cyberThrusterY)) {
    endCyberThrusterRun();
    return;
  }
  cyberThrusterFrame = window.requestAnimationFrame(stepCyberThruster);
}

function endCyberThrusterRun() {
  cyberThrusterActive = false;
  cyberThrusterThrusting = false;
  cyberThrusterCurrentPath = null;
  cyberThrusterLastTs = null;
  cyberThrusterWasOutside = false;
  if (cyberThrusterFrame) {
    window.cancelAnimationFrame(cyberThrusterFrame);
    cyberThrusterFrame = null;
  }
  setCyberThrusterStartPosition();
  updateCyberThrusterAttempts();
  renderCyberThrusterCanvas();
  updateCyberSubmitButton(currentCyberView);
}

function undoCyberThrusterRun() {
  if (cyberThrusterPaths.length === 0) {
    return;
  }
  if (cyberThrusterFrame) {
    window.cancelAnimationFrame(cyberThrusterFrame);
  }
  cyberThrusterFrame = null;
  cyberThrusterActive = false;
  cyberThrusterThrusting = false;
  cyberThrusterCurrentPath = null;
  cyberThrusterLastTs = null;
  cyberThrusterWasOutside = false;
  cyberThrusterPaths = cyberThrusterPaths.slice(0, -1);
  cyberThrusterAttemptsLeft = Math.min(CYBER_THRUSTER_MAX_ATTEMPTS, cyberThrusterAttemptsLeft + 1);
  setCyberThrusterStartPosition();
  updateCyberThrusterAttempts();
  renderCyberThrusterCanvas();
  updateCyberSubmitButton(currentCyberView);
}

function setCyberThrusterThrusting(active) {
  if (!cyberThrusterActive) {
    return;
  }
  cyberThrusterThrusting = active;
}

function isCyberThrusterToolActive() {
  if (!currentCyberView || currentGameType !== "cyber_pictures") {
    return false;
  }
  if (currentCyberView.phase !== "crafting") {
    return false;
  }
  const toolKey = Number.isFinite(currentCyberView.your_tool)
    ? CYBER_TOOL_KEYS[currentCyberView.your_tool]
    : null;
  return toolKey === "thruster";
}

function onCyberThrusterKeyDown(event) {
  if (event.code !== "Space") {
    return;
  }
  if (isTypingTarget(event.target) || !isCyberThrusterToolActive()) {
    return;
  }
  event.preventDefault();
  if (!cyberThrusterActive) {
    startCyberThrusterLaunch();
  }
  setCyberThrusterThrusting(true);
}

function onCyberThrusterKeyUp(event) {
  if (event.code !== "Space") {
    return;
  }
  if (isTypingTarget(event.target) || !isCyberThrusterToolActive()) {
    return;
  }
  event.preventDefault();
  setCyberThrusterThrusting(false);
}

function resetCyberThrusterState() {
  if (cyberThrusterFrame) {
    window.cancelAnimationFrame(cyberThrusterFrame);
  }
  cyberThrusterFrame = null;
  cyberThrusterActive = false;
  cyberThrusterThrusting = false;
  cyberThrusterCurrentPath = null;
  cyberThrusterPaths = [];
  cyberThrusterAttemptsLeft = CYBER_THRUSTER_MAX_ATTEMPTS;
  cyberThrusterLastTs = null;
  cyberThrusterWasOutside = false;
  setCyberThrusterStartPosition();
  updateCyberThrusterAttempts();
  renderCyberThrusterCanvas();
}

function ensureCyberSynthValues() {
  if (!Array.isArray(cyberSynthValues) || cyberSynthValues.length !== CYBER_SYNTH_BARS) {
    cyberSynthValues = Array(CYBER_SYNTH_BARS).fill(0);
  }
}

function initCyberSynthGrid() {
  if (!cyberSynthGrid || cyberSynthGrid.childNodes.length) {
    return;
  }
  ensureCyberSynthValues();
  cyberSynthBarEls = [];
  cyberSynthSliderEls = [];
  for (let i = 0; i < CYBER_SYNTH_BARS; i += 1) {
    const column = document.createElement("div");
    column.className = "cyber-synth-column";
    const bar = document.createElement("div");
    bar.className = "cyber-synth-bar";
    const fill = document.createElement("div");
    fill.className = "cyber-synth-fill";
    bar.appendChild(fill);
    const slider = document.createElement("input");
    slider.type = "range";
    slider.min = "0";
    slider.max = "100";
    slider.step = "1";
    slider.value = `${cyberSynthValues[i]}`;
    slider.className = "cyber-synth-slider";
    slider.addEventListener("input", () => {
      cyberSynthValues[i] = Number(slider.value);
      renderCyberSynthGrid();
      updateCyberSubmitButton(currentCyberView);
    });
    column.appendChild(bar);
    column.appendChild(slider);
    cyberSynthGrid.appendChild(column);
    cyberSynthBarEls.push(fill);
    cyberSynthSliderEls.push(slider);
  }
  renderCyberSynthGrid();
}

function renderCyberSynthGrid() {
  if (!cyberSynthGrid) {
    return;
  }
  ensureCyberSynthValues();
  cyberSynthBarEls.forEach((fill, idx) => {
    const value = clampValue(Number(cyberSynthValues[idx] || 0), 0, 100);
    fill.style.height = `${value}%`;
  });
  cyberSynthSliderEls.forEach((slider, idx) => {
    const value = clampValue(Number(cyberSynthValues[idx] || 0), 0, 100);
    slider.value = `${value}`;
  });
}

function resetCyberSynthState() {
  cyberSynthValues = Array(CYBER_SYNTH_BARS).fill(0);
  renderCyberSynthGrid();
}

function drawCyberShape(ctx, shape, x, y, rotation) {
  const shapeKey = shape === "cylinder" ? "ellipse" : shape;
  const spec = CYBER_SHAPE_SPECS[shapeKey] || { w: 80, h: 60 };
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(((rotation || 0) * Math.PI) / 180);
  ctx.strokeStyle = "#111827";
  ctx.lineWidth = 3;
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  if (shapeKey === "square" || shapeKey === "rectangle") {
    ctx.strokeRect(-spec.w / 2, -spec.h / 2, spec.w, spec.h);
  } else if (shapeKey === "circle") {
    ctx.beginPath();
    ctx.arc(0, 0, Math.min(spec.w, spec.h) / 2, 0, Math.PI * 2);
    ctx.stroke();
  } else if (shapeKey === "ellipse") {
    ctx.beginPath();
    ctx.ellipse(0, 0, spec.w / 2, spec.h / 2, 0, 0, Math.PI * 2);
    ctx.stroke();
  } else if (shapeKey === "triangle") {
    ctx.beginPath();
    ctx.moveTo(0, -spec.h / 2);
    ctx.lineTo(spec.w / 2, spec.h / 2);
    ctx.lineTo(-spec.w / 2, spec.h / 2);
    ctx.closePath();
    ctx.stroke();
  } else if (shapeKey === "arch") {
    const radius = spec.w / 2;
    const arcY = -spec.h / 2 + radius;
    ctx.beginPath();
    ctx.moveTo(-spec.w / 2, spec.h / 2);
    ctx.lineTo(-spec.w / 2, arcY);
    ctx.arc(0, arcY, radius, Math.PI, 0, true);
    ctx.lineTo(spec.w / 2, spec.h / 2);
    ctx.closePath();
    ctx.stroke();
  } else if (shapeKey === "hexagon") {
    const dx = spec.w * 0.25;
    ctx.beginPath();
    ctx.moveTo(-spec.w / 2 + dx, -spec.h / 2);
    ctx.lineTo(spec.w / 2 - dx, -spec.h / 2);
    ctx.lineTo(spec.w / 2, 0);
    ctx.lineTo(spec.w / 2 - dx, spec.h / 2);
    ctx.lineTo(-spec.w / 2 + dx, spec.h / 2);
    ctx.lineTo(-spec.w / 2, 0);
    ctx.closePath();
    ctx.stroke();
  }
  ctx.restore();
}

function renderCyberSubmission(canvas, submission) {
  if (!canvas || !submission) {
    return;
  }
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    return;
  }
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  const sourceW = submission.width || CYBER_CANVAS_SIZE;
  const sourceH = submission.height || CYBER_CANVAS_SIZE;
  const scale = Math.min(canvas.width / sourceW, canvas.height / sourceH);
  const offsetX = (canvas.width - sourceW * scale) / 2;
  const offsetY = (canvas.height - sourceH * scale) / 2;
  ctx.save();
  ctx.translate(offsetX, offsetY);
  ctx.scale(scale, scale);
  const tool = submission.tool;
  if (tool === "shoelaces") {
    const paths = submission.paths || [];
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    paths.forEach((path) => {
      const points = path.points || [];
      if (points.length < 2) {
        return;
      }
      ctx.strokeStyle = path.color || "#111111";
      ctx.lineWidth = path.width || 4;
      ctx.beginPath();
      ctx.moveTo(points[0].x, points[0].y);
      points.slice(1).forEach((pt) => ctx.lineTo(pt.x, pt.y));
      ctx.stroke();
    });
  } else if (tool === "thruster") {
    const paths = submission.paths || [];
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    paths.forEach((path) => {
      const points = path.points || [];
      if (points.length < 2) {
        return;
      }
      ctx.strokeStyle = path.color || CYBER_THRUSTER_COLOR;
      ctx.lineWidth = path.width || CYBER_THRUSTER_STROKE;
      drawCyberSmoothPath(ctx, points);
    });
  } else if (tool === "pixel_grid") {
    const cells = submission.cells || [];
    const cellW = sourceW / 3;
    const cellH = sourceH / 3;
    for (let idx = 0; idx < 9; idx += 1) {
      const color = cells[idx] || "#ffffff";
      const row = Math.floor(idx / 3);
      const col = idx % 3;
      ctx.fillStyle = color;
      ctx.fillRect(col * cellW, row * cellH, cellW, cellH);
      ctx.strokeStyle = "#e5e7eb";
      ctx.strokeRect(col * cellW, row * cellH, cellW, cellH);
    }
  } else if (tool === "icon_set") {
    const icons = submission.icons || [];
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = `${CYBER_TEXT_SIZE}px serif`;
    icons.forEach((icon) => {
      if (!icon) {
        return;
      }
      ctx.save();
      ctx.translate(icon.x, icon.y);
      ctx.rotate(((icon.rotation || 0) * Math.PI) / 180);
      ctx.fillText(icon.emoji || "", 0, 0);
      ctx.restore();
    });
  } else if (tool === "aeiou") {
    const letters = submission.letters || [];
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = `bold ${CYBER_TEXT_SIZE}px sans-serif`;
    letters.forEach((letter) => {
      if (!letter) {
        return;
      }
      ctx.save();
      ctx.translate(letter.x, letter.y);
      ctx.rotate(((letter.rotation || 0) * Math.PI) / 180);
      ctx.fillStyle = "#111827";
      ctx.fillText(letter.char || "", 0, 0);
      ctx.restore();
    });
  } else if (tool === "synthesizer") {
    const values = submission.values || [];
    ctx.fillStyle = "#0b0f1a";
    ctx.fillRect(0, 0, sourceW, sourceH);
    const gap = Math.max(2, Math.round(sourceW * 0.01));
    const barW = (sourceW - gap * (CYBER_SYNTH_BARS - 1)) / CYBER_SYNTH_BARS;
    for (let i = 0; i < CYBER_SYNTH_BARS; i += 1) {
      const value = clampValue(Number(values[i] || 0), 0, 100);
      const barH = (sourceH * value) / 100;
      const x = i * (barW + gap);
      const y = sourceH - barH;
      ctx.fillStyle = "#39ff14";
      ctx.fillRect(x, y, barW, barH);
    }
  } else if (tool === "shape_stacker") {
    const shapes = submission.shapes || [];
    shapes.forEach((shape) => {
      if (!shape) {
        return;
      }
      drawCyberShape(ctx, shape.shape, shape.x, shape.y, shape.rotation || 0);
    });
  }
  ctx.restore();
}

function setCyberActiveTool(toolIndex) {
  const toolKey = Number.isFinite(toolIndex) ? CYBER_TOOL_KEYS[toolIndex] : null;
  const toolMap = {
    shoelaces: cyberToolShoelaces,
    pixel_grid: cyberToolPixel,
    icon_set: cyberToolIconSet,
    aeiou: cyberToolLetters,
    shape_stacker: cyberToolShapes,
    thruster: cyberToolThruster,
    synthesizer: cyberToolSynth,
  };
  Object.values(toolMap).forEach((el) => {
    if (el) {
      el.classList.add("hidden");
    }
  });
  if (toolKey && toolMap[toolKey]) {
    toolMap[toolKey].classList.remove("hidden");
  }
  return toolKey;
}

function resetCyberToolState(toolKey) {
  if (toolKey === "shoelaces") {
    cyberShoelacePaths = [];
    cyberShoelaceCurrentPath = null;
    cyberShoelaceDrawing = false;
    renderCyberShoelaceCanvas();
  } else if (toolKey === "pixel_grid") {
    cyberPixelCells = Array(9).fill(null);
    renderCyberPixelGrid();
  } else if (toolKey === "icon_set") {
    cyberIconItems = [];
    cyberIconSelectedId = null;
    renderCyberIconCanvas();
  } else if (toolKey === "aeiou") {
    cyberLetterItems = [];
    cyberLetterSelectedId = null;
    updateCyberLetterRotationControl();
    renderCyberLetterCanvas();
  } else if (toolKey === "shape_stacker") {
    cyberShapeItems = [];
    cyberShapeSelectedId = null;
    updateCyberShapeRotationControl();
    renderCyberShapeCanvas();
  } else if (toolKey === "thruster") {
    resetCyberThrusterState();
  } else if (toolKey === "synthesizer") {
    resetCyberSynthState();
  }
}

function buildCyberSubmission(toolIndex) {
  const toolKey = CYBER_TOOL_KEYS[toolIndex] || "shoelaces";
  if (toolKey === "shoelaces") {
    return {
      tool: toolKey,
      width: cyberShoelaceCanvas ? cyberShoelaceCanvas.width : CYBER_CANVAS_SIZE,
      height: cyberShoelaceCanvas ? cyberShoelaceCanvas.height : CYBER_CANVAS_SIZE,
      paths: cyberShoelacePaths.map((path) => ({
        points: path.points.map((pt) => ({ x: pt.x, y: pt.y })),
        color: path.color,
        width: path.width,
      })),
    };
  }
  if (toolKey === "pixel_grid") {
    ensureCyberPixelCells();
    return {
      tool: toolKey,
      width: CYBER_CANVAS_SIZE,
      height: CYBER_CANVAS_SIZE,
      cells: cyberPixelCells.slice(),
    };
  }
  if (toolKey === "icon_set") {
    const { width, height } = getCyberStageSize(cyberIconCanvas);
    return {
      tool: toolKey,
      width,
      height,
      icons: cyberIconItems.map((item) => ({
        emoji: item.emoji,
        x: item.x,
        y: item.y,
        rotation: item.rotation || 0,
      })),
    };
  }
  if (toolKey === "aeiou") {
    const { width, height } = getCyberStageSize(cyberLetterCanvas);
    return {
      tool: toolKey,
      width,
      height,
      letters: cyberLetterItems.map((item) => ({
        char: item.char,
        x: item.x,
        y: item.y,
        rotation: item.rotation || 0,
      })),
    };
  }
  if (toolKey === "thruster") {
    return {
      tool: toolKey,
      width: cyberThrusterCanvas ? cyberThrusterCanvas.width : CYBER_CANVAS_SIZE,
      height: cyberThrusterCanvas ? cyberThrusterCanvas.height : CYBER_CANVAS_SIZE,
      paths: cyberThrusterPaths.map((path) => ({
        points: (path.points || []).map((pt) =>
          pt && Number.isFinite(pt.x) && Number.isFinite(pt.y) ? { x: pt.x, y: pt.y } : null
        ),
        color: path.color,
        width: path.width,
      })),
    };
  }
  if (toolKey === "synthesizer") {
    ensureCyberSynthValues();
    return {
      tool: toolKey,
      width: CYBER_CANVAS_SIZE,
      height: CYBER_CANVAS_SIZE,
      values: cyberSynthValues.map((value) => Math.round(value)),
    };
  }
  const { width, height } = getCyberStageSize(cyberShapeCanvas);
  return {
    tool: toolKey,
    width,
    height,
    shapes: cyberShapeItems.map((item) => ({
      shape: item.shape,
      x: item.x,
      y: item.y,
      rotation: item.rotation || 0,
    })),
  };
}

function canSubmitCyber(toolKey) {
  if (toolKey === "shoelaces") {
    return cyberShoelacePaths.length > 0;
  }
  if (toolKey === "pixel_grid") {
    ensureCyberPixelCells();
    return cyberPixelCells.every((cell) => Boolean(cell));
  }
  if (toolKey === "icon_set") {
    return cyberIconItems.length >= 2 && cyberIconItems.length <= 5;
  }
  if (toolKey === "aeiou") {
    return cyberLetterItems.length >= 1 && cyberLetterItems.length <= 10;
  }
  if (toolKey === "thruster") {
    return cyberThrusterPaths.some((path) => (path.points || []).length > 1);
  }
  if (toolKey === "synthesizer") {
    ensureCyberSynthValues();
    return cyberSynthValues.length === CYBER_SYNTH_BARS;
  }
  if (toolKey === "shape_stacker") {
    return cyberShapeItems.length >= 1;
  }
  return false;
}

function updateCyberSubmitButton(view) {
  if (!cyberSubmitBtn) {
    return;
  }
  if (!view || view.phase !== "crafting" || !Number.isFinite(view.your_tool)) {
    cyberSubmitBtn.disabled = true;
    return;
  }
  if (view.submitted) {
    cyberSubmitBtn.disabled = true;
    if (cyberSubmissionHint) {
      cyberSubmissionHint.textContent = "Submitted.";
    }
    return;
  }
  const toolKey = CYBER_TOOL_KEYS[view.your_tool];
  const ready = canSubmitCyber(toolKey);
  cyberSubmitBtn.disabled = !ready;
  if (cyberSubmissionHint) {
    cyberSubmissionHint.textContent = ready ? "" : "Complete your tool before submitting.";
  }
}

function renderCyberMatrix(matrix, target) {
  if (!cyberMatrixEl) {
    return;
  }
  cyberMatrixEl.innerHTML = "";
  (matrix || []).forEach((cell) => {
    const wrapper = document.createElement("div");
    wrapper.className = "cyber-cell";
    if (target && cell.id === target) {
      wrapper.classList.add("target");
    }
    const img = document.createElement("img");
    img.src = cell.url;
    img.alt = cell.id || "card";
    const label = document.createElement("div");
    label.className = "cyber-coord";
    label.textContent = cell.id || "-";
    wrapper.appendChild(img);
    wrapper.appendChild(label);
    cyberMatrixEl.appendChild(wrapper);
  });
}

function renderCyberPlayers(view) {
  if (!cyberPlayers) {
    return;
  }
  cyberPlayers.innerHTML = "";
  (view.players || []).forEach((player) => {
    const row = document.createElement("div");
    row.className = "player-row";
    const toolKey = Number.isFinite(player.tool_index) ? CYBER_TOOL_KEYS[player.tool_index] : null;
    const toolLabel = toolKey ? CYBER_TOOL_LABELS[toolKey] : "-";
    row.textContent = `${player.name || "?"} · ${player.score ?? 0} pts · ${toolLabel}`;
    if (player.player_id === view.you) {
      row.classList.add("player-you");
    }
    cyberPlayers.appendChild(row);
  });
}

function renderCyberGuessArea(view) {
  if (!cyberWorks) {
    return;
  }
  if (view && view.your_guesses) {
    cyberGuessSelections = { ...view.your_guesses };
  }
  const works = Array.isArray(view.works) ? view.works : [];
  cyberWorks.innerHTML = "";
  works.forEach((work, index) => {
    const card = document.createElement("div");
    card.className = "cyber-work-card";
    const header = document.createElement("div");
    header.className = "cyber-work-header";
    header.textContent = work.is_self ? "Your Work" : `Work #${index + 1}`;
    header.setAttribute("data-cyber-pictures-explain", "work_label");
    card.appendChild(header);

    const body = document.createElement("div");
    body.className = "cyber-work-body";
    const canvas = document.createElement("canvas");
    canvas.className = "cyber-preview";
    canvas.width = 180;
    canvas.height = 180;
    canvas.setAttribute("data-cyber-pictures-explain", "work_preview");
    renderCyberSubmission(canvas, work.submission);
    body.appendChild(canvas);

    if (!work.is_self) {
      const select = document.createElement("select");
      select.className = "cyber-guess-select";
      select.setAttribute("data-cyber-pictures-explain", "work_select");
      const empty = document.createElement("option");
      empty.value = "";
      empty.textContent = "-";
      select.appendChild(empty);
      CYBER_COORDS.forEach((coord) => {
        const option = document.createElement("option");
        option.value = coord;
        option.textContent = coord;
        select.appendChild(option);
      });
      if (cyberGuessSelections[work.work_id]) {
        select.value = cyberGuessSelections[work.work_id];
      }
      select.disabled = view.guessed;
      select.addEventListener("change", () => {
        cyberGuessSelections[work.work_id] = select.value;
        updateCyberGuessButton(view);
      });
      body.appendChild(select);
    } else {
      const note = document.createElement("div");
      note.className = "hint";
      note.setAttribute("data-cyber-pictures-explain", "work_self");
      note.textContent = "You do not guess your own work.";
      body.appendChild(note);
    }

    card.appendChild(body);
    cyberWorks.appendChild(card);
  });
  updateCyberGuessButton(view);
}

function updateCyberGuessButton(view) {
  if (!cyberSubmitGuessBtn) {
    return;
  }
  if (!view || view.phase !== "guessing") {
    cyberSubmitGuessBtn.disabled = true;
    return;
  }
  if (view.guessed) {
    cyberSubmitGuessBtn.disabled = true;
    return;
  }
  const works = Array.isArray(view.works) ? view.works : [];
  const ready = works.every((work) => {
    if (work.is_self) {
      return true;
    }
    return Boolean(cyberGuessSelections[work.work_id]);
  });
  cyberSubmitGuessBtn.disabled = !ready;
}

function renderCyberScoreArea(view) {
  if (cyberRoundScores) {
    cyberRoundScores.innerHTML = "";
    (view.round_scores || []).forEach((score) => {
      const card = document.createElement("div");
      card.className = "cyber-score-card";
      const name = document.createElement("div");
      name.className = "score-name";
      name.textContent = score.name || "?";
      const detail = document.createElement("div");
      detail.textContent = `Guess +${score.guess_points} · Artist +${score.artist_points} · Total ${score.total_score}`;
      card.appendChild(name);
      card.appendChild(detail);
      cyberRoundScores.appendChild(card);
    });
  }
  if (cyberReveal) {
    cyberReveal.innerHTML = "";
    (view.reveal || []).forEach((entry, idx) => {
      const card = document.createElement("div");
      card.className = "cyber-reveal-card";
      const header = document.createElement("div");
      header.className = "cyber-reveal-header";
      header.textContent = `#${idx + 1} ${entry.owner_name || "?"} · Target ${entry.target || "-"}`;
      card.appendChild(header);
      const canvas = document.createElement("canvas");
      canvas.className = "cyber-preview";
      canvas.width = 180;
      canvas.height = 180;
      renderCyberSubmission(canvas, entry.submission);
      card.appendChild(canvas);
      const guesses = entry.guesses || [];
      guesses.forEach((guess) => {
        const line = document.createElement("div");
        line.className = "cyber-guess-row";
        const name = document.createElement("span");
        name.textContent = guess.name || "?";
        const coord = document.createElement("span");
        coord.textContent = guess.guess || "-";
        coord.className = guess.correct ? "cyber-guess-correct" : "cyber-guess-wrong";
        line.appendChild(name);
        line.appendChild(coord);
        card.appendChild(line);
      });
      cyberReveal.appendChild(card);
    });
  }
}

function clearCyberState() {
  currentCyberView = null;
  cyberLastRound = null;
  cyberLastPhase = null;
  cyberLastToolIndex = null;
  cyberShoelacePaths = [];
  cyberShoelaceCurrentPath = null;
  cyberShoelaceDrawing = false;
  cyberPixelCells = Array(9).fill(null);
  cyberPixelSelectedColor = CYBER_PIXEL_COLORS[0];
  cyberIconItems = [];
  cyberIconDragging = null;
  cyberIconSelectedId = null;
  cyberLetterItems = [];
  cyberLetterDragging = null;
  cyberLetterSelectedId = null;
  cyberShapeItems = [];
  cyberShapeDragging = null;
  cyberShapeSelectedId = null;
  cyberThrusterPaths = [];
  cyberThrusterCurrentPath = null;
  cyberThrusterActive = false;
  cyberThrusterThrusting = false;
  cyberThrusterAttemptsLeft = CYBER_THRUSTER_MAX_ATTEMPTS;
  if (cyberThrusterFrame) {
    window.cancelAnimationFrame(cyberThrusterFrame);
  }
  cyberThrusterFrame = null;
  cyberThrusterLastTs = null;
  cyberThrusterX = 0;
  cyberThrusterY = 0;
  cyberThrusterVelocity = 0;
  cyberThrusterWasOutside = false;
  cyberSynthValues = Array(CYBER_SYNTH_BARS).fill(0);
  cyberGuessSelections = {};
  if (cyberPhaseLabel) cyberPhaseLabel.textContent = "-";
  if (cyberRoundLabel) cyberRoundLabel.textContent = "-";
  if (cyberTotalRoundsLabel) cyberTotalRoundsLabel.textContent = "-";
  if (cyberToolLabel) cyberToolLabel.textContent = "-";
  if (cyberTargetLabel) cyberTargetLabel.textContent = "-";
  if (cyberSubmittedLabel) cyberSubmittedLabel.textContent = "-";
  if (cyberGuessedLabel) cyberGuessedLabel.textContent = "-";
  if (cyberMatrixEl) cyberMatrixEl.innerHTML = "";
  if (cyberWorks) cyberWorks.innerHTML = "";
  if (cyberRoundScores) cyberRoundScores.innerHTML = "";
  if (cyberReveal) cyberReveal.innerHTML = "";
  if (cyberPlayers) cyberPlayers.innerHTML = "";
  if (cyberCraftArea) cyberCraftArea.classList.add("hidden");
  if (cyberGuessArea) cyberGuessArea.classList.add("hidden");
  if (cyberScoreArea) cyberScoreArea.classList.add("hidden");
  if (cyberGameOverNotice) cyberGameOverNotice.classList.add("hidden");
  updateCyberLetterRotationControl();
  updateCyberThrusterAttempts();
  renderCyberShoelaceCanvas();
  renderCyberPixelGrid();
  renderCyberIconCanvas();
  renderCyberLetterCanvas();
  renderCyberShapeCanvas();
  renderCyberThrusterCanvas();
  initCyberSynthGrid();
  renderCyberSynthGrid();
}

function renderCyberPicturesGameState(data) {
  const view = data.view;
  currentCyberView = view;
  if (currentGameType !== "cyber_pictures") {
    currentGameType = "cyber_pictures";
    setGamePanelVisibility("cyber_pictures");
  }
  if (cyberPhaseLabel) {
    cyberPhaseLabel.textContent = view.phase || "-";
  }
  if (cyberRoundLabel) {
    cyberRoundLabel.textContent = view.round ?? "-";
  }
  if (cyberTotalRoundsLabel) {
    cyberTotalRoundsLabel.textContent = view.total_rounds ?? "-";
  }
  const toolKey = Number.isFinite(view.your_tool) ? CYBER_TOOL_KEYS[view.your_tool] : null;
  if (cyberToolLabel) {
    cyberToolLabel.textContent = toolKey ? CYBER_TOOL_LABELS[toolKey] : "-";
  }
  if (cyberTargetLabel) {
    cyberTargetLabel.textContent = view.your_target || "-";
  }
  if (cyberSubmittedLabel) {
    cyberSubmittedLabel.textContent = view.submitted ? "yes" : "no";
  }
  if (cyberGuessedLabel) {
    cyberGuessedLabel.textContent = view.guessed ? "yes" : "no";
  }

  renderCyberMatrix(view.matrix || [], view.your_target);
  renderCyberPlayers(view);

  if (view.phase !== "crafting" && cyberThrusterActive) {
    endCyberThrusterRun();
  }

  if (view.phase === "crafting") {
    if (cyberCraftArea) cyberCraftArea.classList.remove("hidden");
    if (cyberGuessArea) cyberGuessArea.classList.add("hidden");
    if (cyberScoreArea) cyberScoreArea.classList.add("hidden");
    if (cyberGameOverNotice) cyberGameOverNotice.classList.add("hidden");
    const activeTool = setCyberActiveTool(view.your_tool);
    if (cyberLastRound !== view.round || cyberLastToolIndex !== view.your_tool || cyberLastPhase !== view.phase) {
      resetCyberToolState(activeTool);
    }
    updateCyberSubmitButton(view);
  } else if (view.phase === "guessing") {
    if (cyberCraftArea) cyberCraftArea.classList.add("hidden");
    if (cyberGuessArea) cyberGuessArea.classList.remove("hidden");
    if (cyberScoreArea) cyberScoreArea.classList.add("hidden");
    if (cyberGameOverNotice) cyberGameOverNotice.classList.add("hidden");
    if (cyberLastPhase !== view.phase || cyberLastRound !== view.round) {
      cyberGuessSelections = {};
    }
    renderCyberGuessArea(view);
  } else if (view.phase === "scoring" || view.phase === "ended") {
    if (cyberCraftArea) cyberCraftArea.classList.add("hidden");
    if (cyberGuessArea) cyberGuessArea.classList.add("hidden");
    if (cyberScoreArea) cyberScoreArea.classList.remove("hidden");
    if (cyberGameOverNotice) {
      cyberGameOverNotice.classList.toggle("hidden", view.phase !== "ended");
    }
    renderCyberScoreArea(view);
    if (cyberNextRoundBtn) {
      cyberNextRoundBtn.disabled = !view.allow_next_round;
    }
  }

  cyberLastRound = view.round;
  cyberLastPhase = view.phase;
  cyberLastToolIndex = view.your_tool;
}

renderCyberPixelPalette();
renderCyberIconPalette();
renderCyberLetterPalette();
renderCyberShapePalette();
initCyberPixelGrid();
renderCyberIconCanvas();
renderCyberLetterCanvas();
renderCyberShapeCanvas();
renderCyberShoelaceCanvas();
initCyberSynthGrid();
renderCyberSynthGrid();
resetCyberThrusterState();

if (cyberShoelaceCanvas) {
  cyberShoelaceCanvas.addEventListener("pointerdown", startCyberShoelaceDraw);
  cyberShoelaceCanvas.addEventListener("pointermove", moveCyberShoelaceDraw);
  cyberShoelaceCanvas.addEventListener("pointerup", endCyberShoelaceDraw);
  cyberShoelaceCanvas.addEventListener("pointerleave", endCyberShoelaceDraw);
}

if (cyberShoelaceClearBtn) {
  cyberShoelaceClearBtn.addEventListener("click", () => clearCyberShoelace());
}

if (cyberShoelaceUndoBtn) {
  cyberShoelaceUndoBtn.addEventListener("click", () => undoCyberShoelace());
}

if (cyberThrusterCanvas) {
  cyberThrusterCanvas.addEventListener("pointerdown", (event) => {
    if (!isCyberThrusterToolActive()) {
      return;
    }
    event.preventDefault();
    if (!cyberThrusterActive) {
      startCyberThrusterLaunch();
    }
    setCyberThrusterThrusting(true);
  });
  cyberThrusterCanvas.addEventListener("pointerup", () => setCyberThrusterThrusting(false));
  cyberThrusterCanvas.addEventListener("pointerleave", () => setCyberThrusterThrusting(false));
  cyberThrusterCanvas.addEventListener("pointercancel", () => setCyberThrusterThrusting(false));
}

if (cyberThrusterUndoBtn) {
  cyberThrusterUndoBtn.addEventListener("click", () => undoCyberThrusterRun());
}

if (cyberIconRemoveBtn) {
  cyberIconRemoveBtn.addEventListener("click", () => removeCyberIcon());
}

if (cyberIconClearBtn) {
  cyberIconClearBtn.addEventListener("click", () => clearCyberIcons());
}

if (cyberLetterRotateBtn) {
  cyberLetterRotateBtn.addEventListener("click", () => rotateSelectedCyberLetter());
}

if (cyberLetterRotate) {
  cyberLetterRotate.addEventListener("input", (event) => {
    const value = Number.parseInt(event.target.value, 10);
    setCyberLetterRotation(Number.isFinite(value) ? value : 0);
  });
}

if (cyberLetterRemoveBtn) {
  cyberLetterRemoveBtn.addEventListener("click", () => removeSelectedCyberLetter());
}

if (cyberLetterClearBtn) {
  cyberLetterClearBtn.addEventListener("click", () => clearCyberLetters());
}

if (cyberShapeRotate) {
  cyberShapeRotate.addEventListener("input", (event) => {
    const value = Number.parseInt(event.target.value, 10);
    setCyberShapeRotation(Number.isFinite(value) ? value : 0);
  });
}

if (cyberShapeRemoveBtn) {
  cyberShapeRemoveBtn.addEventListener("click", () => removeSelectedCyberShape());
}

if (cyberShapeClearBtn) {
  cyberShapeClearBtn.addEventListener("click", () => clearCyberShapes());
}

window.addEventListener("keydown", onCyberThrusterKeyDown);
window.addEventListener("keyup", onCyberThrusterKeyUp);

if (cyberSubmitBtn) {
  cyberSubmitBtn.addEventListener("click", () => {
    if (!currentCyberView || !Number.isFinite(currentCyberView.your_tool)) {
      return;
    }
    const toolKey = CYBER_TOOL_KEYS[currentCyberView.your_tool];
    if (!canSubmitCyber(toolKey)) {
      return;
    }
    const submission = buildCyberSubmission(currentCyberView.your_tool);
    sendAction({ type: "submit_crafting", submission });
  });
}

if (cyberSubmitGuessBtn) {
  cyberSubmitGuessBtn.addEventListener("click", () => {
    if (!currentCyberView) {
      return;
    }
    const works = Array.isArray(currentCyberView.works) ? currentCyberView.works : [];
    const ready = works.every((work) => work.is_self || Boolean(cyberGuessSelections[work.work_id]));
    if (!ready) {
      return;
    }
    sendAction({ type: "submit_guesses", guesses: cyberGuessSelections });
  });
}

if (cyberNextRoundBtn) {
  cyberNextRoundBtn.addEventListener("click", () => {
    sendAction({ type: "next_round" });
  });
}
