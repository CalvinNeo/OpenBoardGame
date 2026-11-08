(() => {
  "use strict";
  const byId = suffix => document.getElementById(`ticketToRide${suffix}`);
  const panel = byId("Panel"), tooltip = byId("Tooltip");
  const map = byId("Map"), mapFrame = byId("MapFrame"), overlay = byId("RouteOverlay");
  const GAME = "ticket_to_ride";
  const MAP_W = 1000, MAP_H = 640;

  const COLORS = ["red", "orange", "yellow", "green", "blue", "purple", "white", "black"];
  const META = {
    red: {label: "Red", emoji: "🟥", hex: "#cf4b3c"},
    orange: {label: "Orange", emoji: "🟧", hex: "#e08b2c"},
    yellow: {label: "Yellow", emoji: "🟨", hex: "#e6c53c"},
    green: {label: "Green", emoji: "🟩", hex: "#4f9a56"},
    blue: {label: "Blue", emoji: "🟦", hex: "#3f7cc0"},
    purple: {label: "Purple", emoji: "🟪", hex: "#8a5fb0"},
    white: {label: "White", emoji: "⬜", hex: "#f4f2e8"},
    black: {label: "Black", emoji: "⬛", hex: "#3c3a38"},
    gray: {label: "Any colour", emoji: "🎨", hex: "#b8b4a8"},
    locomotive: {label: "Locomotive", emoji: "🚂", hex: "#c79a4b"},
  };
  const SEATS = ["#c94f3d", "#2f6fb0", "#3f8f5a", "#d9a520", "#2a9d8f"];

  let view = null, pending = false, pendingTimer, signature = "", stageSignature = "";
  let selectedRoute = null, payment = null;
  let tipTimer, tipTarget, ticketChoice = null;
  let helpWidget = null, explainWidget = null;
  let mapBox = {x: 0, y: 0, w: MAP_W, h: MAP_H}, drag = null, mapKey = "";
  let bounds = null, focusMode = false;

  // Help and Explain both come from static/games/shared_help.js so the bilingual
  // toggle, the section tabs and the explain-mode plumbing stay identical across
  // games. Contract: designs/task40.md, rollout: designs/task185.md.
  const TICKET_TO_RIDE_EXPLAIN = {
    turn: {
      zh: "当前进行到第几个行动。Ticket to Ride 没有固定轮次，大家轮流行动直到有人把车厢(🚃)降到 2 辆以下，此时进入 Final Round。",
      en: "How many turns have been taken. Ticket to Ride has no fixed rounds: play continues until someone drops to 2 or fewer train pieces (🚃), which starts the Final Round.",
    },
    deck: {
      zh: "抽牌堆(🂠)和弃牌堆(♻️)的剩余张数。抽牌堆耗尽时会把弃牌堆洗回，两堆都空了就不能再抽火车牌(🃏)。",
      en: "Cards left in the draw pile (🂠) and the discard pile (♻️). When the draw pile runs out the discards are reshuffled into it. If both are empty you cannot draw train car cards (🃏) at all.",
    },
    map: {
      zh: "地图上的每条线路由若干小格子组成，格数就是需要付出的车厢(🚃)数量。灰色线路是任意颜色(🎨)，可以用任何一种颜色支付但必须同色。",
      en: "Each route on the map is drawn as a row of slots, and the number of slots is how many train pieces (🚃) it costs. Gray routes are any colour (🎨) and accept any single colour.",
    },
    zoom: {
      zh: "加号和减号缩放，Fit 把整张地图收进视野，1:1 按原始比例显示。拖动地图可以平移，手机端由地图自己接管触摸手势，拖动结束时不会误选线路。",
      en: "Plus and minus zoom, Fit frames the whole board, and 1:1 shows it at native size. Drag to pan. On phones the map claims the touch gesture so dragging never scrolls the page or mis-selects a route.",
    },
    origin: {
      zh: "1:1 按原始比例显示地图，一个地图单位对应屏幕一个像素，适合放大查看密集区域。Fit 会重新把整张地图收进视野。",
      en: "1:1 shows the map at native size, one map unit per screen pixel, which helps in dense regions. Fit frames the whole board again.",
    },
    focus: {
      zh: "把地图放大到整屏，只保留缩放和线路认领面板。再按一次退出。这是手机端查看地图最舒服的方式。",
      en: "Expand the map to the whole screen, keeping only the zoom controls and the claim panel. Press again to exit. This is the most comfortable way to read the map on a phone.",
    },
    market: {
      zh: "五张明牌加一个抽牌堆(🂠)。轮到你时可以抽 2 张，明牌和牌堆任意组合。拿走明牌中的万能牌(🚂)会让本回合只剩这一张。",
      en: "Five face-up cards plus the draw pile (🂠). On your turn you take 2 cards from any mix of the two. Taking a face-up locomotive (🚂) uses up your whole draw.",
    },
    hand: {
      zh: "你的手牌，只显示每种颜色的张数，其他玩家看不到。认领线路时按颜色组合支付，万能牌(🚂)可以代替任意颜色。",
      en: "Your hand, shown only as counts per colour and hidden from everyone else. You pay for a route with one colour, and a locomotive (🚂) may stand in for any colour.",
    },
    tickets: {
      zh: "你的目的地车票(🎫)，只有你自己能看到。已连通的车票结算时加分，未连通的会扣掉同样的分数。",
      en: "Your destination tickets (🎫), visible only to you. A connected ticket adds its points at scoring, and an unconnected one subtracts the same amount.",
    },
    claim: {
      zh: "选中线路后选择用哪种颜色支付，万能牌(🚂)补足差额，再点 Claim。线路立刻计分并扣掉对应数量的车厢(🚃)。",
      en: "After picking a route, choose which colour to spend, top it up with locomotives (🚂), then press Claim. The route scores at once and costs that many train pieces (🚃).",
    },
    draw_tickets: {
      zh: "抽 3 张目的地车票(🎫)，至少保留 1 张。抽到的票会直接出现在下面的列表里，就地勾选要留的即可。",
      en: "Draw 3 destination tickets (🎫) and keep at least 1. The new tickets appear in the list below, where you tick the ones to keep.",
    },
    keep_tickets: {
      zh: "这一轮发给你的车票(🎫)。勾选要保留的，开局至少留 2 张，局中至少留 1 张。下面已保留的车票可以一起对照，看新票是否和旧票顺路。",
      en: "The destination tickets (🎫) offered to you this turn. Tick the ones to keep: at least 2 during setup, at least 1 later. Your existing tickets stay visible below so you can judge whether the new ones overlap.",
    },
    draw: {
      zh: "点明牌或抽牌堆(🂠)即可抽牌。第一次点击进入抽牌状态，再点一次完成本回合。抽牌堆是盲抽。",
      en: "Click a face-up card or the draw pile (🂠) to draw. The first click starts the draw and the second completes your turn. Cards from the pile are blind.",
    },
    players: {
      zh: "每位玩家剩余的车厢(🚃)、手牌(🃏)张数、车票(🎫)张数和已获得的线路分。车厢最少的人最接近终局。",
      en: "Every player's remaining train pieces (🚃), hand size (🃏), ticket count (🎫) and route points. Whoever has the fewest train pieces is closest to ending the game.",
    },
    scoring: {
      zh: "总分等于线路分加完成的车票(🎫)分，减去未完成的车票分，再加上最长连续线路的 10 分。",
      en: "Your total is route points plus completed destination tickets (🎫), minus the tickets you failed, plus 10 points for the longest continuous path.",
    },
  };

  const TICKET_TO_RIDE_HELP_CONFIG = {
    gameId: "ticket_to_ride",
    title: {zh: "铁路环游 · Ticket to Ride", en: "Ticket to Ride"},
    basic: {
      win: {
        zh: "总分最高的人获胜，总分由线路分、完成的车票(🎫)分和最长连续线路的 10 分组成。",
        en: "The highest total wins, and that total is your route points plus completed destination tickets (🎫) plus 10 points for the longest continuous path.",
      },
      turn: {
        zh: "轮到你时必须三选一：抽 2 张火车牌(🃏)、认领一段线路，或者抽 3 张目的地车票(🎫)并至少保留 1 张。",
        en: "On your turn you do exactly one of three things: draw 2 train car cards (🃏), claim one route, or draw 3 destination tickets (🎫) and keep at least 1.",
      },
      key: {
        zh: "长线路的每一节车厢(🚃)都更值钱，而车票(🎫)只有真正连通才加分，所以关键是赶在别人抢走之前把自己的车票路径铺出来。",
        en: "Long routes are worth far more per train piece (🚃), and a destination ticket (🎫) only pays once it is actually connected, so the key is laying your ticket path before someone else takes it.",
      },
    },
    sections: [
      {
        id: "setup",
        label: {zh: "组件与准备", en: "Setup"},
        html: {
          zh: "<p>这是 2 到 5 人的北美铁路游戏。地图上有 36 座城市和 100 段线路，其中 22 组是并行双线。</p>"
            + "<p>牌库共 110 张火车牌(🃏)，八种颜色各 12 张，外加 14 张万能牌(🚂)。翻出 5 张作为明牌，如果其中万能牌(🚂)达到 3 张，就全部弃掉重发。</p>"
            + "<p>每位玩家拿 45 辆车厢(🚃)和 4 张起手牌(🃏)，再抽 3 张目的地车票(🎫)并至少保留 2 张，其余的放回牌堆底。</p>"
            + "<p>八种颜色分别是红色(🟥)、橙色(🟧)、黄色(🟨)、绿色(🟩)、蓝色(🟦)、紫色(🟪)、白色(⬜)和黑色(⬛)。</p>",
          en: "<p>This is a North American railway game for 2 to 5 players. The map has 36 cities and 100 routes, 22 of which are parallel double routes.</p>"
            + "<p>The deck holds 110 train car cards (🃏): twelve of each of the eight colours plus fourteen locomotives (🚂). Five cards are turned face up, and if three or more of them are locomotives (🚂) the whole display is scrapped and redealt.</p>"
            + "<p>Every player takes 45 train pieces (🚃) and 4 starting cards (🃏), then draws 3 destination tickets (🎫) and keeps at least 2, returning the rest to the bottom of the deck.</p>"
            + "<p>The eight colours are red (🟥), orange (🟧), yellow (🟨), green (🟩), blue (🟦), purple (🟪), white (⬜) and black (⬛).</p>",
        },
      },
      {
        id: "drawing",
        label: {zh: "抽火车牌", en: "Drawing cards"},
        html: {
          zh: "<p>抽牌时一共拿 2 张，可以都来自明牌，也可以都来自抽牌堆(🂠)，或者两边各拿一张。拿走明牌后要立刻补上一张。</p>"
            + "<p>如果你拿走的是明牌里的万能牌(🚂)，本回合就只能拿这一张。从抽牌堆(🂠)摸到万能牌(🚂)不受限制，你仍然可以再抽一张。</p>"
            + "<p>只要明牌里同时出现 3 张万能牌(🚂)，这 5 张就全部弃掉并重新翻 5 张。抽牌堆(🂠)空了会把弃牌堆(♻️)洗回去。</p>",
          en: "<p>A draw takes 2 cards in total. They can both come from the face-up display, both from the draw pile (🂠), or one from each. Any face-up card you take is replaced immediately.</p>"
            + "<p>If the card you take face up is a locomotive (🚂), that single card is your whole draw. A locomotive (🚂) drawn blind from the pile (🂠) costs nothing extra and you still draw again.</p>"
            + "<p>Whenever 3 of the 5 face-up cards are locomotives (🚂), all five are discarded and five new ones are turned up. When the draw pile (🂠) empties, the discards (♻️) are shuffled back in.</p>",
        },
      },
      {
        id: "routes",
        label: {zh: "认领线路", en: "Claiming routes"},
        html: {
          zh: "<p>认领线路要打出与线路长度相同数量的同色火车牌(🃏)，万能牌(🚂)可以代替任意一种颜色。灰色线路是任意颜色(🎨)，你可以用任何一种颜色，但打出的牌必须全部同色。</p>"
            + "<p>线路长度决定分数：1 格 1 分，2 格 2 分，3 格 4 分，4 格 7 分，5 格 10 分，6 格 15 分。同样数量的车厢(🚃)，铺一条长线远比铺几条短线划算。</p>"
            + "<p>两座城市之间如果有两条并行线路，同一位玩家永远不能两条都占。2 到 3 人的对局里，只要有人占了其中一条，另一条就对所有人关闭。4 到 5 人的对局里两条都可以被不同玩家占据。</p>",
          en: "<p>Claiming a route means playing train car cards (🃏) of one colour equal to the route's length, and a locomotive (🚂) may stand in for any colour. Gray routes are any colour (🎨), so any single colour works, but every card you play must match.</p>"
            + "<p>Length decides the score: 1 space is 1 point, 2 is 2, 3 is 4, 4 is 7, 5 is 10 and 6 is 15. For the same number of train pieces (🚃), one long route is worth far more than several short ones.</p>"
            + "<p>Where two cities are joined by parallel routes, one player may never take both. In a 2 or 3 player game, claiming either track closes the other to everyone. In a 4 or 5 player game both tracks stay open to different players.</p>",
        },
      },
      {
        id: "tickets",
        label: {zh: "目的地车票", en: "Destination tickets"},
        html: {
          zh: "<p>目的地车票(🎫)写着两座城市和一个分值，只有你自己能看到内容。你只需要用自己的线路把这两座城市连起来就算完成。</p>"
            + "<p>完成的车票(🎫)结算时加上分值，没完成的车票会扣掉同样的分值，所以开局时贪心留票往往比少留更危险。</p>"
            + "<p>游戏中你可以用一回合抽 3 张车票(🎫)，但至少要保留 1 张，其余放回牌堆底。已经连通的车票会显示为完成状态。</p>",
          en: "<p>A destination ticket (🎫) names two cities and a point value, and only you can see yours. Completing it simply means joining those two cities with your own routes.</p>"
            + "<p>A completed ticket (🎫) adds its value at scoring and a failed one subtracts the same value, so hoarding tickets early is usually more dangerous than keeping fewer.</p>"
            + "<p>During the game you may spend a turn drawing 3 more tickets (🎫), but you must keep at least 1 and return the rest to the bottom of the deck. Tickets you have already connected are shown as complete.</p>",
        },
      },
      {
        id: "ending",
        label: {zh: "终局与计分", en: "Ending and scoring"},
        html: {
          zh: "<p>当有人在回合结束时只剩 0、1 或 2 辆车厢(🚃)，终局立刻触发。此时每位玩家，包括触发的那个人，都还可以再行动一次，然后才结算。</p>"
            + "<p>总分等于线路分，加上完成的车票(🎫)分值，减去未完成的车票(🎫)分值，再加上最长连续线路的 10 分。</p>"
            + "<p>最长连续线路可以绕圈，也可以重复经过同一座城市，但同一节车厢(🚃)不能被计算两次。并列最长的人都能拿到 10 分。</p>"
            + "<p>总分平手时，先比完成的车票(🎫)数量，再比是否持有最长连续线路。</p>",
          en: "<p>The moment a player ends a turn with 0, 1 or 2 train pieces (🚃) left, the endgame triggers. Every player then takes one final turn, including the one who triggered it, and only after that is scoring done.</p>"
            + "<p>Your total is your route points, plus the value of completed destination tickets (🎫), minus the value of the ones you failed, plus 10 points for the longest continuous path.</p>"
            + "<p>The longest path may loop and may pass through the same city more than once, but no single train piece (🚃) is ever counted twice. Players tied for longest all score the 10 points.</p>"
            + "<p>If totals are tied, the player with more completed destination tickets (🎫) wins, and after that the holder of the longest path.</p>",
        },
      },
    ],
  };

  // ------------------------------------------------------------------ helpers
  function node(tag, className, text) {
    const n = document.createElement(tag);
    if (className) n.className = className;
    if (text != null) n.textContent = text;
    return n;
  }
  function svg(tag, attrs) {
    const n = document.createElementNS("http://www.w3.org/2000/svg", tag);
    for (const [k, v] of Object.entries(attrs || {})) n.setAttribute(k, v);
    return n;
  }
  function text(id, value) { const el = byId(id); if (el) el.textContent = value; }
  function explainable(n, key, tip) {
    n.dataset.ttrExplain = key;
    if (tip) { n.dataset.ttrTip = tip; n.tabIndex = 0; }
    return n;
  }
  function button(label, fn, key, disabled, primary) {
    const n = node("button", primary ? "ttr-primary" : "", label);
    n.type = "button";
    n.disabled = Boolean(disabled);
    if (key) n.dataset.ttrExplain = key;
    n.addEventListener("click", fn);
    return n;
  }
  function own() { return view?.players.find(p => p.player_id === view.you) || null; }
  function claimableNow() {
    // Only highlight and allow picking routes while claiming is actually legal.
    return view?.legal_actions.includes("claim_route") ? new Set(view.claimable) : new Set();
  }
  function playerName(pid) { return view?.players.find(p => p.player_id === pid)?.name || pid || "—"; }
  function playerColor(pid) {
    const index = view ? view.players.findIndex(p => p.player_id === pid) : -1;
    return SEATS[Math.max(0, index) % SEATS.length];
  }
  function can(kind) { return Boolean(view?.legal_actions.includes(kind)) && !pending && socket.connected; }
  function colorLabel(color) {
    const meta = META[color];
    return meta ? `${meta.label}（${meta.emoji}）` : color;
  }
  function routeName(route) { return `${route.a} → ${route.b}`; }

  function send(kind, fields = {}) {
    if (!can(kind)) return;
    const action = {type: kind, revision: view.revision, ...fields};
    pending = true;
    clearTimeout(pendingTimer);
    pendingTimer = setTimeout(releasePending, 4000);
    renderMarket();
    sendAction(action);
  }
  function releasePending() {
    pending = false;
    clearTimeout(pendingTimer);
    if (view) { renderMarket(); renderMarketTools(); renderHand(); }
  }

  // --------------------------------------------------------------- map layout
  function geometry(route) {
    const a = view.cities[route.a], b = view.cities[route.b];
    const dx = b.x - a.x, dy = b.y - a.y;
    const span = Math.hypot(dx, dy) || 1;
    const ux = dx / span, uy = dy / span;
    const ox = -uy * route.offset, oy = ux * route.offset;
    const pad = 15;
    return {
      x1: a.x + ox + ux * pad, y1: a.y + oy + uy * pad,
      x2: b.x + ox - ux * pad, y2: b.y + oy - uy * pad,
      angle: Math.atan2(dy, dx) * 180 / Math.PI,
    };
  }

  function renderMap() {
    if (!view) return;
    const claimable = claimableNow();
    const key = JSON.stringify([view.revision, selectedRoute, [...claimable].join(",")]);
    if (key === mapKey) { positionOverlay(); return; }
    mapKey = key;
    const frag = document.createDocumentFragment();
    const claimed = view.claimed;

    for (const [routeId, route] of Object.entries(view.routes)) {
      const g = geometry(route);
      const owner = claimed[routeId];
      const group = svg("g", {class: "ttr-route"});
      group.dataset.route = routeId;
      const hit = svg("line", {
        class: "ttr-route-hit", x1: g.x1, y1: g.y1, x2: g.x2, y2: g.y2,
        "stroke-width": 17, "stroke-linecap": "round",
      });
      group.append(hit);
      const span = Math.hypot(g.x2 - g.x1, g.y2 - g.y1);
      const seg = span / route.length;
      const fill = owner ? playerColor(owner) : META[route.color].hex;
      for (let i = 0; i < route.length; i++) {
        const t = (i + 0.5) / route.length;
        const cx = g.x1 + (g.x2 - g.x1) * t, cy = g.y1 + (g.y2 - g.y1) * t;
        const slot = svg("rect", {
          class: "ttr-slot", x: cx - seg * 0.34, y: cy - 4.6,
          width: seg * 0.68, height: 9.2, rx: 2.4, fill,
          transform: `rotate(${g.angle.toFixed(2)} ${cx.toFixed(2)} ${cy.toFixed(2)})`,
        });
        group.append(slot);
      }
      if (owner) group.classList.add("is-claimed");
      else if (claimable.has(routeId)) group.classList.add("is-claimable");
      if (routeId === selectedRoute) group.classList.add("is-selected");
      frag.append(group);
    }

    for (const [name, city] of Object.entries(view.cities)) {
      const group = svg("g", {class: "ttr-city"});
      const lx = city.x + (city.lx || 0);
      const ly = city.y + (city.ly == null ? -11 : city.ly);
      // A label pushed away from its dot gets a short leader so it stays readable.
      if (Math.hypot(lx - city.x, ly - city.y) > 15) {
        group.append(svg("line", {
          class: "ttr-city-leader", x1: city.x, y1: city.y, x2: lx, y2: ly,
        }));
      }
      group.append(svg("circle", {class: "ttr-city-dot", cx: city.x, cy: city.y, r: 6.5}));
      const label = svg("text", {
        class: "ttr-city-name", x: lx, y: ly, "text-anchor": city.anchor || "middle",
      });
      label.textContent = name;
      group.append(label);
      frag.append(group);
    }
    map.replaceChildren(frag);
    positionOverlay();
  }

  function applyMapBox() {
    map.setAttribute("viewBox", `${mapBox.x} ${mapBox.y} ${mapBox.w} ${mapBox.h}`);
    positionOverlay();
  }
  // The board never fills the whole 1000x640 canvas, so the default view frames
  // the real content instead of paying for empty margin.
  function contentBounds() {
    if (!view) return {x: 0, y: 0, w: MAP_W, h: MAP_H};
    const FONT = 15, CHAR = 0.53, LINE = FONT * 1.02, PAD = 6;
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    const add = (x0, y0, x1, y1) => {
      minX = Math.min(minX, x0); minY = Math.min(minY, y0);
      maxX = Math.max(maxX, x1); maxY = Math.max(maxY, y1);
    };
    for (const [name, city] of Object.entries(view.cities)) {
      add(city.x - 8, city.y - 8, city.x + 8, city.y + 8);
      const lx = city.x + (city.lx || 0), ly = city.y + (city.ly == null ? -11 : city.ly);
      const width = name.length * FONT * CHAR;
      const x0 = city.anchor === "start" ? lx : (city.anchor === "end" ? lx - width : lx - width / 2);
      add(x0, ly - LINE * 0.8, x0 + width, ly + LINE * 0.25);
    }
    return {x: minX - PAD, y: minY - PAD, w: maxX - minX + PAD * 2, h: maxY - minY + PAD * 2};
  }
  function clampBox() {
    const b = bounds || {x: 0, y: 0, w: MAP_W, h: MAP_H};
    const minW = b.w / 6;
    let w = Math.min(b.w, Math.max(minW, mapBox.w));
    let h = mapBox.h * (w / mapBox.w);
    if (h > b.h) { h = b.h; w = mapBox.w * (h / mapBox.h); }
    const cx = mapBox.x + mapBox.w / 2, cy = mapBox.y + mapBox.h / 2;
    mapBox = {w, h, x: cx - w / 2, y: cy - h / 2};
    mapBox.x = Math.min(b.x + b.w - w, Math.max(b.x, mapBox.x));
    mapBox.y = Math.min(b.y + b.h - h, Math.max(b.y, mapBox.y));
  }
  function zoom(factor, cx, cy) {
    const px = cx == null ? mapBox.x + mapBox.w / 2 : cx;
    const py = cy == null ? mapBox.y + mapBox.h / 2 : cy;
    const w = mapBox.w * factor, h = mapBox.h * factor;
    mapBox = {
      x: px - (px - mapBox.x) * (w / mapBox.w),
      y: py - (py - mapBox.y) * (h / mapBox.h),
      w, h,
    };
    clampBox();
    applyMapBox();
  }
  function fitMap() {
    // Only cache real bounds: the startup call happens before any view exists.
    if (view) bounds = contentBounds();
    mapBox = {...(bounds || {x: 0, y: 0, w: MAP_W, h: MAP_H})};
    applyMapBox();
  }
  // Native size: one map unit per screen pixel.
  function originMap() {
    const rect = map.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const cx = mapBox.x + mapBox.w / 2, cy = mapBox.y + mapBox.h / 2;
    mapBox = {x: cx - rect.width / 2, y: cy - rect.height / 2, w: rect.width, h: rect.height};
    clampBox();
    applyMapBox();
  }
  // Full-screen mode matches the viewBox to the screen so a wide board fills a
  // portrait phone instead of floating in a letterbox. Fit still shows it all.
  function fillScreen() {
    const rect = map.getBoundingClientRect();
    if (!rect.width || !rect.height || !bounds) return;
    const aspect = rect.width / rect.height;
    let h = bounds.h, w = h * aspect;
    if (w > bounds.w) { w = bounds.w; h = w / aspect; }
    const cx = bounds.x + bounds.w / 2, cy = bounds.y + bounds.h / 2;
    mapBox = {x: cx - w / 2, y: cy - h / 2, w, h};
    clampBox();
    applyMapBox();
  }
  function setFocus(next) {
    focusMode = next;
    panel.dataset.ttrFocus = next ? "map" : "";
    byId("Focus").setAttribute("aria-pressed", String(next));
    document.body.classList.toggle("ttr-map-focus", next);
    requestAnimationFrame(() => {
      if (!view) return;
      bounds = contentBounds();
      if (next) fillScreen(); else fitMap();
    });
  }

  function positionOverlay() {
    if (!selectedRoute || !view || !view.routes[selectedRoute]) {
      overlay.classList.add("hidden");
      return;
    }
    const g = geometry(view.routes[selectedRoute]);
    const point = map.createSVGPoint();
    point.x = (g.x1 + g.x2) / 2;
    point.y = (g.y1 + g.y2) / 2;
    const matrix = map.getScreenCTM();
    if (!matrix) return;
    const screen = point.matrixTransform(matrix);
    const frame = mapFrame.getBoundingClientRect();
    overlay.classList.remove("hidden");
    const box = overlay.getBoundingClientRect();
    const halfW = box.width / 2;
    const left = Math.min(Math.max(screen.x - frame.left, halfW + 4),
                          Math.max(halfW + 4, frame.width - halfW - 4));
    let top = screen.y - frame.top + 18;
    if (top + box.height > frame.height - 4) top = screen.y - frame.top - box.height - 18;
    top = Math.max(4, Math.min(top, Math.max(4, frame.height - box.height - 4)));
    overlay.style.left = `${left}px`;
    overlay.style.top = `${top}px`;
  }

  // The claim panel lives on the map itself, next to the route, so the board
  // never needs a separate action column.
  function renderOverlay() {
    overlay.replaceChildren();
    if (!selectedRoute || !view) { overlay.classList.add("hidden"); return; }
    const route = view.routes[selectedRoute];
    const head = explainable(node("div", "ttr-claim-head"), "claim");
    head.append(node("strong", "", routeName(route)));
    head.append(node("span", "ttr-claim-meta",
      `${route.length} 🚃 · ${colorLabel(route.color)} · +${view.route_points[route.length]}`));
    overlay.append(head);
    const options = paymentOptions(route);
    if (!options.length) {
      overlay.append(node("p", "ttr-empty", "You cannot pay for this route."));
    } else {
      const grid = node("div", "ttr-payment");
      options.forEach(option => {
        const active = payment && option.color === payment.color
          && option.count === payment.count && option.locomotives === payment.locomotives;
        const chip = button("", () => { payment = option; renderOverlay(); }, "claim");
        chip.className = `ttr-payment-chip${active ? " is-active" : ""}`;
        if (option.count) {
          const part = node("span", "ttr-payment-part");
          part.append(node("span", "", META[option.color].emoji), node("span", "", `×${option.count}`));
          chip.append(part);
        }
        if (option.locomotives) {
          const part = node("span", "ttr-payment-part");
          part.append(node("span", "", "🚂"), node("span", "", `×${option.locomotives}`));
          chip.append(part);
        }
        grid.append(chip);
      });
      overlay.append(grid);
      if (payment && payment.color !== "locomotive") {
        const range = wildRange(route, payment.color);
        if (range.max > range.min) {
          const wilds = explainable(node("div", "ttr-wild-row"), "claim",
            "🚂 是万能牌，可以代替任意颜色。用 −／+ 决定这次花掉几张。");
          wilds.append(node("span", "", "🚂"));
          wilds.append(button("−", () => shiftWilds(-1), "claim", payment.locomotives <= range.min));
          wilds.append(node("strong", "", payment.locomotives));
          wilds.append(button("+", () => shiftWilds(1), "claim", payment.locomotives >= range.max));
          wilds.append(node("span", "", `${META[payment.color].emoji} ×${payment.count}`));
          overlay.append(wilds);
        }
      }
    }
    const row = node("div", "ttr-claim-row");
    row.append(button("Claim", confirmClaim, "claim", !payment || !can("claim_route"), true));
    row.append(button("Cancel", () => selectRoute(null), "claim"));
    overlay.append(row);
    overlay.setAttribute("aria-label", `Claim ${routeName(route)}`);
    positionOverlay();
  }

  // --------------------------------------------------------------- selection
  // One chip per playable colour, each spending as few wilds as possible. The
  // stepper below the chips then trades colour cards for wilds, so every legal
  // payment stays reachable without listing dozens of combinations.
  function paymentOptions(route) {
    const hand = own()?.hand || {};
    const length = route.length;
    const wilds = hand.locomotive || 0;
    const options = [];
    for (const color of COLORS) {
      if (route.color !== "gray" && color !== route.color) continue;
      const used = Math.min(length, hand[color] || 0);
      if (used + wilds < length) continue;
      options.push({color, count: used, locomotives: length - used});
    }
    if (wilds >= length) options.push({color: "locomotive", count: 0, locomotives: length});
    return options;
  }
  function wildRange(route, color) {
    const hand = own()?.hand || {};
    const length = route.length;
    if (color === "locomotive") return {min: length, max: length};
    const available = hand[color] || 0;
    return {min: Math.max(0, length - available), max: Math.min(length, hand.locomotive || 0)};
  }
  function shiftWilds(delta) {
    const route = view.routes[selectedRoute];
    if (!route || !payment || payment.color === "locomotive") return;
    const range = wildRange(route, payment.color);
    const next = Math.min(range.max, Math.max(range.min, payment.locomotives + delta));
    if (next === payment.locomotives) return;
    payment = {color: payment.color, count: route.length - next, locomotives: next};
    renderOverlay();
  }
  function defaultPayment(route) {
    const options = paymentOptions(route);
    if (!options.length) return null;
    return options.slice().sort((a, b) =>
      a.locomotives - b.locomotives || b.count - a.count || a.color.localeCompare(b.color))[0];
  }
  function paymentCards(option) {
    const cards = {};
    if (option.count) cards[option.color] = option.count;
    if (option.locomotives) cards.locomotive = option.locomotives;
    return cards;
  }
  function selectRoute(routeId) {
    selectedRoute = routeId;
    payment = routeId ? defaultPayment(view.routes[routeId]) : null;
    mapKey = "";
    renderMap();
    renderOverlay();
    renderHand();
    renderRouteList();
  }
  function confirmClaim() {
    if (!selectedRoute || !payment) return;
    const route = selectedRoute;
    const cards = paymentCards(payment);
    send("claim_route", {route, cards});
    selectRoute(null);
  }

  // ------------------------------------------------------------------ panels
  function renderMarket() {
    const market = byId("Market");
    market.replaceChildren();
    if (!view) return;
    const drawing = can("draw_card");
    const second = view.stage === "drawing" && view.draws_left === 1;
    view.face_up.forEach((card, index) => {
      const meta = META[card];
      const blocked = !drawing || (second && card === "locomotive");
      const chip = button("", () => send("draw_card", {source: "face_up", index}), "market", blocked);
      chip.className = `ttr-card ttr-card--${card}`;
      chip.style.setProperty("--ttr-card", meta.hex);
      chip.append(node("span", "ttr-card-emoji", meta.emoji), node("span", "ttr-card-name", meta.label));
      if (blocked && drawing && second && card === "locomotive") chip.classList.add("is-blocked");
      market.append(chip);
    });
    const deckEmpty = !view.deck_count && !view.discard_count;
    const deck = button("", () => send("draw_card", {source: "deck"}), "deck", !drawing || deckEmpty);
    deck.className = "ttr-card ttr-card--deck";
    deck.append(node("span", "ttr-card-emoji", "🂠"), node("span", "ttr-card-name", `Deck ${view.deck_count}`));
    market.append(deck);
    const hint = byId("DrawHint");
    if (hint) {
      hint.textContent = view.stage === "drawing"
        ? `Pick ${view.draws_left} more`
        : (drawing ? "Take 2 cards" : "");
    }
  }

  function renderHand() {
    const box = byId("Hand");
    box.replaceChildren();
    const me = own();
    if (!me || !me.hand) return;
    const route = selectedRoute ? view.routes[selectedRoute] : null;
    const useful = new Set();
    if (route) {
      if (route.color === "gray") COLORS.forEach(c => useful.add(c));
      else useful.add(route.color);
      useful.add("locomotive");
    }
    const entries = [...COLORS, "locomotive"].filter(c => me.hand[c]);
    if (!entries.length) {
      box.append(node("p", "ttr-empty", "No train cards yet."));
    } else {
      entries.forEach(color => {
        const chip = explainable(node("div", "ttr-hand-chip"), "hand",
          `${colorLabel(color)}：${me.hand[color]} 张`);
        chip.style.setProperty("--ttr-card", META[color].hex);
        if (route && useful.has(color)) chip.classList.add("is-useful");
        chip.append(node("span", "ttr-hand-emoji", META[color].emoji),
                    node("span", "ttr-hand-count", me.hand[color]));
        box.append(chip);
      });
    }
    text("HandCount", `${entries.reduce((sum, c) => sum + me.hand[c], 0)} cards`);
  }

  function renderTickets() {
    const box = byId("Tickets");
    box.replaceChildren();
    const me = own();
    if (!me || !me.tickets) return;
    const choosing = view.legal_actions.includes("keep_tickets");
    byId("TicketsSection").classList.toggle("is-choosing", Boolean(choosing));
    const action = byId("TicketAction");
    const canDraw = view.legal_actions.includes("draw_tickets");
    action.classList.toggle("hidden", !canDraw);
    action.disabled = pending || !canDraw;
    action.onclick = () => send("draw_tickets");

    if (choosing && me.pending_tickets?.length) box.append(buildTicketChoice(me.pending_tickets));
    if (!me.tickets.length) {
      if (!choosing) box.append(node("p", "ttr-empty", "No destination tickets yet."));
    } else {
      me.tickets.forEach(id => {
        const ticket = view.destinations[id];
        const done = view.ticket_status?.[id];
        const row = explainable(node("div", `ttr-ticket${done ? " is-done" : ""}`), "tickets",
          done ? "已连通，结算时加分。" : "尚未连通，结算时扣分。");
        row.append(node("span", "ttr-ticket-route", `${ticket.a} → ${ticket.b}`));
        row.append(node("strong", "ttr-ticket-points", `${done ? "✅" : "⏳"} ${ticket.points}`));
        box.append(row);
      });
    }
    text("TicketCount", `${me.tickets.length} kept`);
  }

  // Keeping tickets happens inside the ticket panel, right next to the tickets
  // already held, so there is no separate action area and no modal in the way.
  function buildTicketChoice(offered) {
    const signature = offered.join(",");
    const minimum = view.phase === "setup" ? 2 : 1;
    if (!ticketChoice || ticketChoice.signature !== signature) {
      ticketChoice = {signature, chosen: new Set(offered.slice(0, minimum))};
    }
    const chosen = ticketChoice.chosen;
    const block = explainable(node("div", "ttr-ticket-choice"), "keep_tickets");
    block.append(node("p", "ttr-choice-lead", `New tickets · keep at least ${minimum}`));
    const confirm = node("button", "ttr-primary", "");
    confirm.type = "button";
    const sync = () => {
      confirm.textContent = `Keep ${chosen.size}`;
      confirm.disabled = pending || chosen.size < minimum;
    };
    offered.forEach(id => {
      const ticket = view.destinations[id];
      const label = node("label", "ttr-ticket is-offer");
      const input = node("input");
      input.type = "checkbox";
      input.checked = chosen.has(id);
      input.addEventListener("change", () => {
        if (input.checked) chosen.add(id); else chosen.delete(id);
        sync();
      });
      label.append(input,
        node("span", "ttr-ticket-route", `${ticket.a} → ${ticket.b}`),
        node("strong", "ttr-ticket-points", `${ticket.points}`));
      block.append(label);
    });
    const row = node("div", "ttr-choice-row");
    row.append(confirm);
    block.append(row);
    confirm.addEventListener("click", () => send("keep_tickets", {tickets: [...chosen]}));
    sync();
    return block;
  }

  function renderRouteList() {
    const box = byId("Routes");
    box.replaceChildren();
    if (!view) return;
    const claimable = claimableNow();
    const ids = Object.keys(view.routes).filter(id => claimable.has(id));
    if (!ids.length) {
      box.append(node("p", "ttr-empty", "No route is affordable right now."));
      return;
    }
    ids.sort((a, b) => view.routes[a].a.localeCompare(view.routes[a].a));
    ids.forEach(id => {
      const route = view.routes[id];
      const row = button("", () => selectRoute(id), "claim");
      row.className = `ttr-route-row${id === selectedRoute ? " is-selected" : ""}`;
      row.style.setProperty("--ttr-card", META[route.color].hex);
      row.append(node("span", "ttr-route-swatch"));
      row.append(node("span", "ttr-route-name", routeName(route)));
      row.append(node("span", "ttr-route-meta", `${route.length} 🚃 · ${view.route_points[route.length]} pts`));
      box.append(row);
    });
  }

  function renderMarketTools() {
    const hint = byId("DrawHint");
    if (!view) { hint.textContent = ""; return; }
    hint.textContent = view.stage === "drawing"
      ? `Take ${view.draws_left} more`
      : (view.legal_actions.includes("draw_card") ? "Take 2 cards" : "");
  }

  function renderPlayers() {
    const box = byId("Players");
    box.replaceChildren();
    if (!view) return;
    view.players.forEach(player => {
      const card = node("div", `ttr-player${player.player_id === view.current_turn ? " is-turn" : ""}`);
      card.style.setProperty("--ttr-seat", playerColor(player.player_id));
      const head = node("div", "ttr-player-head");
      head.append(node("span", "ttr-player-dot"));
      head.append(node("strong", "", player.name + (player.is_bot ? " 🤖" : "")));
      if (view.winner_ids.includes(player.player_id)) head.append(node("span", "", "🏆"));
      card.append(head);
      const stats = explainable(node("div", "ttr-player-stats"), "players",
        "🚃 剩余车厢 · 🃏 手牌 · 🎫 车票 · 线路分");
      stats.append(node("span", "", `🚃 ${player.trains}`));
      stats.append(node("span", "", `🃏 ${player.hand_count}`));
      stats.append(node("span", "", `🎫 ${player.ticket_count}`));
      stats.append(node("span", "", `⭐ ${player.route_points}`));
      card.append(stats);
      card.append(node("div", "ttr-player-routes", `${player.routes.length} routes${view.longest_path?.[player.player_id] ? ` · longest ${view.longest_path[player.player_id]}` : ""}`));
      box.append(card);
    });
  }

  function renderReview() {
    const visible = Boolean(view?.game_over);
    byId("Review").classList.toggle("hidden", !visible);
    if (!visible) return;
    const box = byId("Results");
    box.replaceChildren();
    view.final_results.forEach(result => {
      const card = node("div", `ttr-result${view.winner_ids.includes(result.player_id) ? " is-winner" : ""}`);
      card.style.setProperty("--ttr-seat", playerColor(result.player_id));
      const head = node("div", "ttr-result-head");
      head.append(node("span", "ttr-player-dot"));
      head.append(node("strong", "", result.player_id === view.you ? `${playerName(result.player_id)} (you)` : playerName(result.player_id)));
      head.append(node("span", "ttr-result-total", `${result.total}`));
      card.append(head);
      const lines = explainable(node("div", "ttr-result-lines"), "scoring",
        "线路分 + 完成车票 − 未完成车票 + 最长线路 10 分");
      lines.append(node("span", "", `Routes ${result.route_points}`));
      lines.append(node("span", "", `Tickets +${result.ticket_points}`));
      lines.append(node("span", "", `Failed −${result.penalty}`));
      lines.append(node("span", "", `Longest ${result.longest_path}${result.longest_bonus ? " +10" : ""}`));
      card.append(lines);
      box.append(card);
    });
  }

  function renderStats() {
    const box = byId("Stats");
    box.replaceChildren();
    if (!view) return;
    const me = own();
    const rows = [
      ["🚃", "Trains", me ? me.trains : "—", "map"],
      ["🃏", "Cards", me ? me.hand_count : "—", "hand"],
      ["🎫", "Tickets", me ? me.ticket_count : "—", "tickets"],
      ["⭐", "Route pts", me ? me.route_points : "—", "scoring"],
    ];
    rows.forEach(([icon, label, value, key]) => {
      const n = explainable(node("div", "ttr-stat"), key);
      n.append(node("span", "ttr-stat-icon", icon),
               node("span", "ttr-stat-label", label),
               node("strong", "", value));
      box.append(n);
    });
  }

  function render() {
    if (!view) return;
    const me = own();
    text("Round", view.game_over ? "Game over"
      : view.phase === "setup" ? "Setup · choose tickets"
      : `Turn ${view.round}${view.last_round ? " · Final Round" : ""}`);
    text("DeckInfo", `🂠 ${view.deck_count} · ♻️ ${view.discard_count} · 🎫 ${view.ticket_deck_count}`);
    text("Status", view.game_over
      ? `🏆 ${view.winner_ids.map(playerName).join(" · ")}`
      : view.phase === "setup"
        ? `${view.players.filter(p => p.ready).length} / ${view.players.length} ready`
        : view.current_turn === view.you ? "Your turn" : `${playerName(view.current_turn)} is playing`);
    const hint = view.last_round && !view.game_over
      ? ` · ${view.final_turns.length} final turn${view.final_turns.length === 1 ? "" : "s"} left`
      : (me && me.trains <= 4 && !view.game_over ? ` · ${me.trains} 🚃 left` : "");
    byId("Status").textContent += hint;
    renderStats();
    renderMap();
    renderMarket();
    renderMarketTools();
    renderHand();
    renderTickets();
    renderRouteList();
    renderPlayers();
    renderReview();
    renderOverlay();
    const log = byId("Log");
    const scroll = log.scrollTop;
    log.replaceChildren(...[...view.log].reverse().map(row => node("li", "", `T${row.round} · ${row.text}`)));
    log.scrollTop = scroll;
  }

  // ---------------------------------------------------------------- tooltips
  function showTip(target, sticky) {
    const message = target?.dataset?.ttrTip;
    if (!message) return;
    clearTimeout(tipTimer);
    tipTarget = target;
    tooltip.textContent = message;
    tooltip.classList.remove("hidden");
    const rect = target.getBoundingClientRect();
    const box = tooltip.getBoundingClientRect();
    let left = rect.left + rect.width / 2 - box.width / 2;
    left = Math.max(8, Math.min(window.innerWidth - box.width - 8, left));
    let top = rect.top - box.height - 8;
    if (top < 8) top = rect.bottom + 8;
    tooltip.style.left = `${left + window.scrollX}px`;
    tooltip.style.top = `${top + window.scrollY}px`;
    if (sticky) tipTimer = setTimeout(hideTip, 3000);
  }
  function hideTip() {
    clearTimeout(tipTimer);
    tipTarget = null;
    tooltip.classList.add("hidden");
  }

  // -------------------------------------------------------------- listeners
  byId("ZoomIn").addEventListener("click", () => zoom(0.75));
  byId("ZoomOut").addEventListener("click", () => zoom(1.33));
  byId("Fit").addEventListener("click", fitMap);
  byId("Origin").addEventListener("click", originMap);
  byId("Focus").addEventListener("click", () => setFocus(!focusMode));

  map.addEventListener("pointerdown", event => {
    if (drag) return;
    event.preventDefault();
    hideTip();
    drag = {
      id: event.pointerId, x: event.clientX, y: event.clientY,
      box: {...mapBox}, route: event.target.closest("[data-route]")?.dataset.route, moved: false,
    };
    map.setPointerCapture(event.pointerId);
  });
  map.addEventListener("pointermove", event => {
    if (!drag || drag.id !== event.pointerId) return;
    const dx = event.clientX - drag.x, dy = event.clientY - drag.y;
    drag.moved = drag.moved || Math.hypot(dx, dy) > 6;
    if (!drag.moved) return;
    const rect = map.getBoundingClientRect();
    const scale = drag.box.w / Math.max(1, rect.width);
    mapBox = {...drag.box, x: drag.box.x - dx * scale, y: drag.box.y - dy * scale};
    clampBox();
    applyMapBox();
    map.classList.add("is-dragging");
  });
  function finishDrag(event) {
    if (!drag || drag.id !== event.pointerId) return;
    const ended = drag;
    drag = null;
    map.classList.remove("is-dragging");
    if (map.hasPointerCapture(event.pointerId)) map.releasePointerCapture(event.pointerId);
    if (event.type !== "pointerup" || ended.moved) return;
    if (ended.route && claimableNow().has(ended.route)) selectRoute(ended.route);
    else if (!ended.route) selectRoute(null);
  }
  ["pointerup", "pointercancel", "lostpointercapture"].forEach(type => map.addEventListener(type, finishDrag));
  map.addEventListener("wheel", event => {
    if (!view) return;
    event.preventDefault();
    zoom(event.deltaY > 0 ? 1.15 : 0.87);
  }, {passive: false});

  panel.addEventListener("click", event => {
    const tip = event.target.closest("[data-ttr-tip]");
    if (tip) showTip(tip, true); else hideTip();
    if (!event.target.closest("button,input,label,summary,svg,[data-ttr-tip],.ttr-route-row,.ttr-payment-chip")) {
      if (selectedRoute) selectRoute(null);
    }
  });
  panel.addEventListener("pointerover", event => {
    const tip = event.target.closest("[data-ttr-tip]");
    if (event.pointerType === "mouse" && tip && !tip.contains(event.relatedTarget)) showTip(tip);
  });
  panel.addEventListener("pointerout", event => {
    const tip = event.target.closest("[data-ttr-tip]");
    if (event.pointerType === "mouse" && tip && !tip.contains(event.relatedTarget)) hideTip();
  });
  panel.addEventListener("focusin", event => showTip(event.target.closest("[data-ttr-tip]")));
  panel.addEventListener("focusout", hideTip);
  document.addEventListener("keydown", event => {
    if (panel.classList.contains("hidden")) return;
    if (event.key === "Escape") {
      hideTip();
      if (selectedRoute) selectRoute(null);
    }
  }, true);
  document.addEventListener("scroll", hideTip, true);
  window.addEventListener("resize", () => {
    hideTip();
    if (view) {
      bounds = contentBounds();
      if (focusMode || window.innerWidth <= 900) fillScreen(); else fitMap();
    }
    positionOverlay();
  });
  window.addEventListener("blur", hideTip);

  // ------------------------------------------------------------------ socket
  function clearState() {
    view = null;
    signature = "";
    stageSignature = "";
    ticketChoice = null;
    selectedRoute = null;
    payment = null;
    pending = false;
    mapKey = "";
    drag = null;
    clearTimeout(pendingTimer);
    explainWidget?.exit();
    ["Market", "Hand", "Tickets", "Players", "Stats", "Routes", "Log", "Results", "Map"]
      .forEach(id => byId(id)?.replaceChildren());
    bounds = null;
    setFocus(false);
    byId("Review").classList.add("hidden");
    overlay.classList.add("hidden");
    text("Status", "Waiting to start");
    fitMap();
  }

  window.renderTicketToRideGameState = data => {
    if (data?.view?.game_id !== GAME || currentGameType !== GAME
        || (data.room_id && currentRoomState?.room_id !== data.room_id)) return;
    const next = data.view;
    const nextSignature = JSON.stringify([data.room_id, next.revision, next.phase, next.stage, next.current_turn, next.you]);
    if (nextSignature !== signature) { pending = false; clearTimeout(pendingTimer); hideTip(); }
    const stage = JSON.stringify([data.room_id, next.round, next.stage, next.current_turn, next.you]);
    if (stage !== stageSignature && (next.stage !== "action" || selectedRoute)) selectRoute(null);
    signature = nextSignature;
    stageSignature = stage;
    view = next;
    window.currentTicketToRideView = next;
    const firstView = !bounds;
    render();
    if (firstView) {
      // A phone screen is far taller than the board is wide, so open filled
      // rather than letterboxed. Desktop has room to frame the whole board.
      if (window.innerWidth <= 900) fillScreen(); else fitMap();
    }
  };
  window.showTicketToRideHeaderActions = visible => {
    byId("HeaderActions").style.display = visible ? "flex" : "none";
    if (!visible) clearState();
  };

  function initTicketToRideHelpExplain() {
    if (helpWidget || typeof window.obgCreateHelp !== "function") return;
    helpWidget = window.obgCreateHelp(TICKET_TO_RIDE_HELP_CONFIG);
    explainWidget = window.obgCreateExplain({
      gameId: GAME,
      attribute: "data-ttr-explain",
      explanations: TICKET_TO_RIDE_EXPLAIN,
      button: byId("ExplainBtn"),
      root: () => panel,
      bypass: ["#ticketToRideHelpBtn", "#ticketToRideExplainBtn"],
    });
    byId("HelpBtn").addEventListener("click", () => {
      explainWidget?.exit();
      helpWidget.open();
    });
    byId("ExplainBtn").addEventListener("click", () => explainWidget?.toggle());
  }

  function sync() {
    initTicketToRideHelpExplain();
    socket.on("system:error", releasePending);
    socket.on("disconnect", () => { releasePending(); hideTip(); });
    socket.on("connect", releasePending);
    fitMap();
    if (typeof lastGameStatePayload !== "undefined" && lastGameStatePayload?.game_type === GAME) {
      window.renderTicketToRideGameState(lastGameStatePayload);
    }
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", sync, {once: true});
  else sync();
})();
