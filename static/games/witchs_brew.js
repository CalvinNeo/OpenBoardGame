/* Witch's Brew front end. Rules: designs/task77.md. UI rules: DEV_GUIDE.md. */

let currentWitchsBrewView = null;
let witchsBrewSelectedRoles = new Set();
let witchsBrewChoice = null;
let witchsBrewPick = null;
let witchsBrewPickSignature = "";
let witchsBrewExtraIngredient = "";
let witchsBrewHelpWidget = null;
let witchsBrewExplainWidget = null;
let witchsBrewTooltipTimer = null;
const witchsBrewRoundLog = new Map();

const WITCHS_BREW_RES = { red: "🔴", green: "🟢", white: "⚪", gold: "🟡", vial: "🧴" };
const WITCHS_BREW_RES_NAME = {
  red: "Wolf blood",
  green: "Herbs",
  white: "Snake venom",
  gold: "Gold",
  vial: "Vial",
};
const WITCHS_BREW_INGREDIENTS = ["red", "green", "white"];
const WITCHS_BREW_RAVEN = "🐦‍⬛";
const WITCHS_BREW_STACKS = [
  { key: "copper", label: "Copper", icon: "🧙", role: "wizard" },
  { key: "iron", label: "Iron", icon: "🧪", role: "witch" },
  { key: "silver", label: "Silver", icon: "🍃", role: "druid" },
];
const WITCHS_BREW_SHELVES = [
  { key: "gold_shelf", label: "Gold shelf", icon: "💰", role: "cutpurse", unit: "gold" },
  { key: "ingredient_shelf", label: "Ingredient shelf", icon: "🙏", role: "begging_monk", unit: "ingredients" },
];
const WITCHS_BREW_ROLE_ORDER = [
  "wolf_keeper", "snake_hunter", "herb_collector",
  "alchemist", "fortune_teller", "assistant",
  "wizard", "witch", "druid",
  "warlock", "cutpurse", "begging_monk",
];
// Short effect labels so twelve role cards still fit one phone screen.
const WITCHS_BREW_ROLE_SHORT = {
  wolf_keeper: { full: "🔴×3", favor: "🔴×1" },
  snake_hunter: { full: "⚪×3", favor: "⚪×1" },
  herb_collector: { full: "🟢×3", favor: "🟢×1" },
  alchemist: { full: "1 ing → 🟡×5", favor: "1 ing → 🟡×2" },
  fortune_teller: { full: "🟡1 → 🧴×2", favor: "🟡1 → 🧴×1" },
  assistant: { full: "🟡1 → any 3 ing", favor: "🟡1 → any 1 ing" },
  wizard: { full: "Buy 🧙 copper", favor: "Buy copper +2🟡" },
  witch: { full: "Buy 🧪 iron", favor: "Buy iron +2🟡" },
  druid: { full: "Buy 🍃 silver", favor: "Buy silver +2🟡" },
  warlock: { full: "Cast the spell", favor: "🟡×1" },
  cutpurse: { full: "Tax 🟡 → shelf", favor: "Lose 1 less 🟡" },
  begging_monk: { full: "Tax ing → shelf", favor: "Lose 1 less ing" },
};
const WITCHS_BREW_ROLE_KIND = {
  wolf_keeper: "resource", snake_hunter: "resource", herb_collector: "resource",
  alchemist: "gold", fortune_teller: "gold", assistant: "gold",
  wizard: "cauldron", witch: "cauldron", druid: "cauldron",
  warlock: "spell", cutpurse: "shelf", begging_monk: "shelf",
};
const WITCHS_BREW_PHASE_LABEL = {
  select_roles: "Choosing roles",
  play_role: "Playing a role",
  respond: "Challenge round",
  resolve_action: "Resolving",
  choose_loss: "Monk tax",
  round_pause: "Round review",
  game_over: "Game over",
};

const witchsBrewGamePanel = document.getElementById("witchsBrewPanel");
const witchsBrewHeaderActions = document.getElementById("witchsBrewHeaderActions");
const witchsBrewHelpBtn = document.getElementById("witchsBrewHelpBtn");
const witchsBrewExplainBtn = document.getElementById("witchsBrewExplainBtn");
const witchsBrewSetLabel = document.getElementById("witchsBrewSet");
const witchsBrewRoundLabel = document.getElementById("witchsBrewRound");
const witchsBrewRavensLabel = document.getElementById("witchsBrewRavens");
const witchsBrewPhaseLabel = document.getElementById("witchsBrewPhase");
const witchsBrewStatus = document.getElementById("witchsBrewStatus");
const witchsBrewNotice = document.getElementById("witchsBrewNotice");
const witchsBrewNoticeTitle = document.getElementById("witchsBrewNoticeTitle");
const witchsBrewNoticeBody = document.getElementById("witchsBrewNoticeBody");
const witchsBrewNoticeRows = document.getElementById("witchsBrewNoticeRows");
const witchsBrewNoticeReady = document.getElementById("witchsBrewNoticeReady");
const witchsBrewNextRoundBtn = document.getElementById("witchsBrewNextRoundBtn");
const witchsBrewStage = document.getElementById("witchsBrewStage");
const witchsBrewHandTitle = document.getElementById("witchsBrewHandTitle");
const witchsBrewHandMeta = document.getElementById("witchsBrewHandMeta");
const witchsBrewHand = document.getElementById("witchsBrewHand");
const witchsBrewHandBar = document.getElementById("witchsBrewHandBar");
const witchsBrewHandOverlay = document.getElementById("witchsBrewHandOverlay");
const witchsBrewPublic = document.getElementById("witchsBrewPublic");
const witchsBrewSpell = document.getElementById("witchsBrewSpell");
const witchsBrewTurnMeta = document.getElementById("witchsBrewTurnMeta");
const witchsBrewPlayers = document.getElementById("witchsBrewPlayers");
const witchsBrewSpellList = document.getElementById("witchsBrewSpellList");
const witchsBrewStackList = document.getElementById("witchsBrewStackList");
const witchsBrewShelfList = document.getElementById("witchsBrewShelfList");
const witchsBrewRoleList = document.getElementById("witchsBrewRoleList");
const witchsBrewLog = document.getElementById("witchsBrewLog");

const witchsBrewTooltip = document.createElement("div");
witchsBrewTooltip.className = "wb-tooltip";
witchsBrewTooltip.id = "witchsBrewTooltip";
witchsBrewTooltip.setAttribute("role", "tooltip");
witchsBrewTooltip.hidden = true;
document.body.appendChild(witchsBrewTooltip);

const WITCHS_BREW_HELP_CONFIG = {
  gameId: "witchs_brew",
  title: { zh: "女巫的佳酿 · Witch's Brew", en: "Witch's Brew" },
  basic: {
    win: {
      zh: "大轮结束时乌鸦(🐦‍⬛) 药水牌达到 4 张就立刻结算，药锅牌和药橱牌上的分数加上药水瓶(🧴) 数量最高的人获胜。",
      en: "The game ends at the close of a set once four raven (🐦‍⬛) cards are on the table, and the player with the most points from cauldrons, shelves and vials (🧴) wins."
    },
    turn: {
      zh: "每个大轮所有人先秘密选 5 张角色牌，然后轮流打出角色牌，持有同名角色的人必须跟着打出并选择抢下完整行动或者拿走较弱的恩惠。",
      en: "Each set everybody secretly keeps five role cards, then roles are played in turn and anyone holding the same role must play it too, choosing between claiming the full action or taking the weaker favor."
    },
    key: {
      zh: "抢完整行动收益更高却会被后来者抢走，越晚响应越安全，所以要算清后面还有几个人可能持有这张角色牌。",
      en: "A full action pays much more but a later player can steal it, so responding late is safer and the real skill is judging how many players behind you might still hold that role."
    }
  },
  sections: [
    {
      id: "flow",
      label: { zh: "大轮流程", en: "How a set runs" },
      html: {
        zh: "<p>每个大轮开始时，所有人同时从 12 张角色牌里秘密挑 5 张，剩下的 7 张本轮不能用。</p>"
          + "<p>起始玩家打出一张角色牌并宣称完整行动，然后从他的下家开始按座位顺序，每名玩家依次响应这一张角色牌。</p>"
          + "<p>手里没有这张角色牌的玩家自动跳过。手里有的玩家必须把它打出来，并在抢下完整行动和接受恩惠之间二选一。</p>"
          + "<p>选择恩惠的人立刻拿到较弱的收益并退出争夺，后来抢走完整行动的人会让之前的宣称者一无所获。</p>"
          + "<p>所有响应结束后，最后一个宣称完整行动的人执行完整行动，并成为下一轮的起始玩家。</p>"
          + "<p>五张手牌全部打完后进入大轮结算，法术书堆顶移到底部，再检查乌鸦(🐦‍⬛) 数量是否达到 4 张。</p>",
        en: "<p>At the start of a set everybody secretly keeps five of the twelve role cards at the same time, and the other seven cannot be used this set.</p>"
          + "<p>The start player plays a role and claims the full action, then each other player responds to that role once in seat order.</p>"
          + "<p>A player without that role is skipped automatically. A player holding it must play it and choose between claiming the full action and taking the favor.</p>"
          + "<p>Taking the favor pays a smaller benefit at once and leaves the contest, while a later full claim leaves the earlier claimant with nothing.</p>"
          + "<p>Once every response is in, the last player who claimed the full action performs it and becomes the next start player.</p>"
          + "<p>When all five cards are played the set closes, the top spell moves to the bottom, and the raven (🐦‍⬛) count is checked against four.</p>"
      }
    },
    {
      id: "roles",
      label: { zh: "十二张角色", en: "The twelve roles" },
      html: {
        zh: "<p>三种材料分别是狼血(🔴)、药草(🟢) 和蛇毒(⚪)，另外还有金块(🟡) 和药水瓶(🧴)。</p>"
          + "<p>狼饲养员(🩸) 完整行动拿 3 个狼血(🔴)，恩惠拿 1 个。捕蛇人(⚪) 和药草采集者(🌿) 同理，分别给蛇毒(⚪) 和药草(🟢)。</p>"
          + "<p>炼金术士(⚗️) 支付 1 个材料换 5 个金块(🟡)，恩惠只换 2 个。占卜师(🔮) 支付 1 个金块(🟡) 换 2 个药水瓶(🧴)，恩惠只换 1 个。</p>"
          + "<p>助手(🧑‍🔬) 支付 1 个金块(🟡) 换任意 3 个材料，恩惠只换 1 个，颜色可以自由组合。</p>"
          + "<p>巫师(🧙) 买铜锅，女巫(🧪) 买铁锅，德鲁伊(🍃) 买银锅。完整行动按堆顶成本支付，恩惠要多付 2 个金块(🟡)。买到药锅后还可以额外支付 1 个材料换 1 个药水瓶(🧴)。</p>"
          + "<p>术士(📖) 完整行动施放法术书堆顶的法术，恩惠是拿 1 个金块(🟡)。</p>"
          + "<p>扒手(💰) 按每 3 个金块(🟡) 抽 1 个的比例向其他人收税并堆到金块药橱上。托钵僧(🙏) 按每 4 个材料抽 1 个的比例收材料税。这两张牌的恩惠是让自己少损失 1 个。</p>",
        en: "<p>The three ingredients are wolf blood (🔴), herbs (🟢) and snake venom (⚪), alongside gold (🟡) and vials (🧴).</p>"
          + "<p>The Wolf Keeper (🩸) takes three wolf blood (🔴) for the full action and one for the favor. The Snake Hunter (⚪) and Herb Collector (🌿) work the same way for venom (⚪) and herbs (🟢).</p>"
          + "<p>The Alchemist (⚗️) pays one ingredient for five gold (🟡), or two on the favor. The Fortune Teller (🔮) pays one gold (🟡) for two vials (🧴), or one on the favor.</p>"
          + "<p>The Assistant (🧑‍🔬) pays one gold (🟡) for any three ingredients in any colour mix, or any one ingredient on the favor.</p>"
          + "<p>The Wizard (🧙) buys copper, the Witch (🧪) buys iron and the Druid (🍃) buys silver. The full action pays the printed cost and the favor adds two gold (🟡) on top. After taking a cauldron you may pay one extra ingredient for one vial (🧴).</p>"
          + "<p>The Warlock (📖) casts the top spell for the full action and simply takes one gold (🟡) for the favor.</p>"
          + "<p>The Cutpurse (💰) taxes one gold (🟡) for every three each opponent holds and piles it on the gold shelf. The Begging Monk (🙏) taxes one ingredient for every four. Their favors reduce your own loss by one.</p>"
      }
    },
    {
      id: "cards",
      label: { zh: "药锅与药橱", en: "Cauldrons and shelves" },
      html: {
        zh: "<p>三堆药锅牌分别是铜锅(🧙)、铁锅(🧪) 和银锅(🍃)，每堆七张，永远只翻开最上面一张，低分在顶高分在底。</p>"
          + "<p>药锅牌上写着需要支付的材料和买下后得到的分数，带乌鸦(🐦‍⬛) 的牌会公开留在你面前并计入结束条件。</p>"
          + "<p>两堆药橱牌分别是金块药橱(💰) 和材料药橱(🙏)，每堆五张。药橱牌写的是门槛而不是成本。</p>"
          + "<p>扒手(💰) 和托钵僧(🙏) 收来的东西会堆在药橱牌上跨轮保留，堆够门槛就能拿走这张牌并清空堆放物。</p>"
          + "<p>药锅牌和药橱牌上的分数在游戏结束时直接计入总分，药水瓶(🧴) 每个值 1 分。</p>",
        en: "<p>The three cauldron stacks are copper (🧙), iron (🧪) and silver (🍃) with seven cards each, and only the top card is ever face up with cheap cards on top.</p>"
          + "<p>A cauldron card shows the ingredients it costs and the points it pays, and a card with a raven (🐦‍⬛) stays face up in front of you and counts toward the end condition.</p>"
          + "<p>The two shelf stacks are the gold shelf (💰) and the ingredient shelf (🙏) with five cards each, and a shelf card shows a threshold instead of a cost.</p>"
          + "<p>Everything the Cutpurse (💰) and Begging Monk (🙏) collect stays on the shelf card across rounds, and reaching the threshold takes the card and clears the pile.</p>"
          + "<p>Cauldron and shelf points count directly at the end of the game, and every vial (🧴) is worth one point.</p>"
      }
    },
    {
      id: "spells",
      label: { zh: "法术书", en: "The spell book" },
      html: {
        zh: "<p>法术书是八张公开的循环牌堆，只有术士(📖) 的完整行动会用到当前堆顶。</p>"
          + "<p>Copia 拿任意 3 个材料。Optio 按正常成本买下任意一堆药锅的堆顶。</p>"
          + "<p>Herba 支付 1 个药草(🟢) 换 2 个药水瓶(🧴)，Lupus 用狼血(🔴)，Serpens 用蛇毒(⚪)，效果相同。</p>"
          + "<p>Magus 拿走铜锅堆顶，Sanatio 拿走银锅堆顶，Strix 拿走铁锅堆顶，支付的材料总数和牌面成本相同但颜色可以随意搭配。</p>"
          + "<p>每个大轮结束时，无论有没有人用过法术，堆顶都会移到底部。</p>",
        en: "<p>The spell book is a public cycling deck of eight cards and only the Warlock (📖) full action uses the current top card.</p>"
          + "<p>Copia takes any three ingredients. Optio buys the top card of any cauldron stack at its normal cost.</p>"
          + "<p>Herba pays one herb (🟢) for two vials (🧴), and Lupus with wolf blood (🔴) and Serpens with venom (⚪) work the same way.</p>"
          + "<p>Magus takes the top copper, Sanatio the top silver and Strix the top iron, paying the same total number of ingredients in any colours you like.</p>"
          + "<p>At the end of every set the top spell moves to the bottom whether anybody used it or not.</p>"
      }
    },
    {
      id: "scoring",
      label: { zh: "计分与结束", en: "Scoring and endings" },
      html: {
        zh: "<p>游戏只在大轮结束时检查结束条件，也就是所有人面前带乌鸦(🐦‍⬛) 的药锅牌和药橱牌加起来至少 4 张。</p>"
          + "<p>总分等于已获得的药锅牌分数加药橱牌分数，再加药水瓶(🧴) 的数量，剩下的金块(🟡) 和材料不计分。</p>"
          + "<p>总分打平时比较剩余的狼血(🔴)、药草(🟢)、蛇毒(⚪) 和金块(🟡) 总数，更多的人获胜，再平就并列获胜。</p>"
          + "<p>每个小轮结算完都会停下来让所有人看盘面，所有人都按下 Next Round 之后游戏才继续。</p>",
        en: "<p>The end condition is only checked when a set closes, and it triggers once the raven (🐦‍⬛) cauldrons and shelves on the table add up to four.</p>"
          + "<p>Your score is the points on your cauldrons plus your shelves plus your vials (🧴), and leftover gold (🟡) and ingredients score nothing.</p>"
          + "<p>A tie is broken by the larger total of leftover wolf blood (🔴), herbs (🟢), venom (⚪) and gold (🟡), and a remaining tie is shared.</p>"
          + "<p>Every round pauses so everybody can study the board, and play only resumes once every player has pressed Next Round.</p>"
      }
    }
  ]
};

const WITCHS_BREW_EXPLAIN = {
  set: { zh: "当前是第几个大轮。每个大轮所有人重新选 5 张角色牌。", en: "Which set is being played. Every set everybody picks five role cards again." },
  round: { zh: "当前大轮里的第几个小轮，每个小轮争夺一张角色牌。", en: "Which round of the current set is running. Each round contests one role." },
  ravens: { zh: "场上带乌鸦(🐦‍⬛) 的药锅牌和药橱牌总数。攒到 4 张时，本大轮结束就立刻结算。", en: "How many raven (🐦‍⬛) cauldrons and shelves are on the table. At four the set closes and the game scores immediately." },
  phase: { zh: "当前阶段。Choosing roles 是选牌，Challenge round 是抢角色，Round review 是小轮结算后的暂停。", en: "The current phase. Choosing roles is the secret pick, Challenge round is the contest, and Round review is the pause after a round." },
  status: { zh: "一句话说明现在的局面，告诉你该做什么或者正在等谁。", en: "A one line summary of the situation, telling you what to do or whom you are waiting for." },
  notice: { zh: "刚结束的小轮结果，包括谁抢到完整行动、谁拿了恩惠、谁跳过了。", en: "The result of the round that just finished, including who won the full action, who took a favor and who passed." },
  ready: { zh: "已经按下 Next Round 的人数，所有人确认后游戏才继续。", en: "How many players already pressed Next Round. Play resumes only when everybody has confirmed." },
  next_round: { zh: "确认你已经看完这一轮的结果。这只是回顾确认，不会跳过别人的查看时间。", en: "Confirm that you have reviewed the round. It is only a review confirmation and never skips anybody else's look at the board." },
  stage: { zh: "当前争夺的角色牌。上面写着完整行动和恩惠的效果，以及谁宣称了完整行动。轮到你结算时，操作按钮也在这里。", en: "The role currently being contested, showing its full action and favor plus who claimed the full action. Your resolution controls also appear here on your turn." },
  hand_meta: { zh: "手牌区的状态。选牌阶段显示已选几张，其他阶段显示还剩几张角色牌。", en: "The state of your role area. During the pick it counts your selections, and later it counts the roles still in hand." },
  hand: { zh: "你的角色牌。选牌阶段点选 5 张，其他阶段点一张打出去。灰色的牌是本大轮被禁用的角色。", en: "Your role cards. Tap to pick five during selection, or tap one to play it later. Greyed cards are disabled for this set." },
  table: { zh: "公共区。所有玩家都能看到药锅堆顶、药橱进度和当前法术。", en: "The public area. Every player sees the cauldron tops, the shelf progress and the current spell." },
  public: { zh: "三堆药锅和两堆药橱的堆顶。药锅牌写的是材料成本，药橱牌写的是还需要堆多少才拿得走。", en: "The top card of three cauldron stacks and two shelf stacks. A cauldron shows its ingredient cost and a shelf shows how much more it needs." },
  spell: { zh: "法术书堆顶。只有术士(📖) 的完整行动能施放它。", en: "The top of the spell book. Only the Warlock (📖) full action can cast it." },
  turn: { zh: "现在轮到谁行动。边框变红的玩家正在操作。", en: "Whose turn it is. The player outlined in red is the one acting." },
  players: { zh: "所有玩家的公开信息，包括资源、剩余手牌数、已打出的角色和已获得的牌。", en: "Public information for every player, including resources, cards left in hand, roles already played and cards collected." },
  reference: { zh: "折叠的参考资料，包括法术顺序、牌堆全览、全部角色效果和小轮日志。", en: "Collapsed reference material with the spell order, full stack lists, every role effect and the round log." },
  role_card: { zh: "一张角色牌。上面是完整行动，下面是恩惠。完整行动收益更高但会被后面的人抢走。", en: "One role card. The full action is on top and the favor below. The full action pays more but a later player can steal it." },
  role_disabled: { zh: "这张角色牌本大轮被禁用，3 人局每轮禁 2 张，4 人局每轮禁 1 张。", en: "This role is disabled for the current set. Two are disabled in a three player game and one in a four player game." },
  confirm_roles: { zh: "提交你选好的 5 张角色牌。提交之后本大轮不能更换，其他人也看不到你选了什么。", en: "Submit the five roles you picked. They are locked for the set and nobody else can see what you chose." },
  play_role: { zh: "把这张角色牌作为完整行动打出去。之后持有同名角色的人可以抢走它。", en: "Play this role as a full action. Players behind you holding the same role may steal it." },
  respond: { zh: "你也持有这张角色牌，必须打出来。抢下完整行动收益更高但会被更后面的人抢走，拿恩惠则立刻落袋。", en: "You hold this role too and must play it. Claiming the full action pays more but can still be stolen, while the favor is banked at once." },
  resolve: { zh: "执行你赢得的行动。所有行动都是可选的，资源不够时可以放弃。", en: "Perform the action you won. Every action is optional, so you may decline when you cannot pay." },
  picker: { zh: "用加减按钮挑选材料，不用打字。上面的数字是已经选中的数量。", en: "Pick ingredients with the plus and minus buttons instead of typing. The number is how many you selected." },
  skip: { zh: "放弃这次行动，不获得任何收益。", en: "Give up this action and take nothing." },
  cauldron: { zh: "一堆药锅的堆顶牌。左边是需要的材料，右边是买下后的分数。", en: "The top card of a cauldron stack. The ingredients it costs are on the left and the points it pays on the right." },
  shelf: { zh: "一堆药橱的堆顶牌。进度条表示已经堆上去多少，堆满门槛就能拿走这张牌。", en: "The top card of a shelf stack. The bar shows how much has been piled on, and filling the threshold takes the card." },
  spell_card: { zh: "当前法术。只有术士(📖) 的完整行动可以施放。", en: "The current spell. Only the Warlock (📖) full action can cast it." },
  player_card: { zh: "一名玩家的公开信息。资源对所有人可见，选好的角色牌只有自己能看到。", en: "Public information about one player. Resources are visible to everybody while the chosen roles stay private." },
  log: { zh: "本局已经结束的小轮记录，方便回顾谁在什么时候抢走了什么。", en: "A record of the rounds already played, useful for reviewing who stole what and when." }
};

function initWitchsBrewHelpExplain() {
  if (witchsBrewHelpWidget || typeof window.obgCreateHelp !== "function") return;
  witchsBrewHelpWidget = window.obgCreateHelp(WITCHS_BREW_HELP_CONFIG);
  witchsBrewExplainWidget = window.obgCreateExplain({
    gameId: "witchs_brew",
    attribute: "data-wb-explain",
    explanations: WITCHS_BREW_EXPLAIN,
    button: witchsBrewExplainBtn,
    root: () => witchsBrewGamePanel,
    bypass: ["#witchsBrewHelpBtn", "#witchsBrewExplainBtn"]
  });
  witchsBrewHelpBtn?.addEventListener("click", () => {
    witchsBrewExplainWidget?.exit();
    witchsBrewHelpWidget.open();
  });
  witchsBrewExplainBtn?.addEventListener("click", () => witchsBrewExplainWidget?.toggle());
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initWitchsBrewHelpExplain);
} else {
  initWitchsBrewHelpExplain();
}

/* ------------------------------------------------------------------ *
 * Small helpers
 * ------------------------------------------------------------------ */

function witchsBrewPlayer(view, playerId) {
  return (view.players || []).find((entry) => entry.player_id === playerId) || null;
}

function witchsBrewName(view, playerId) {
  const player = witchsBrewPlayer(view, playerId);
  return player ? player.name || player.player_id : playerId || "-";
}

function witchsBrewMe(view) {
  return witchsBrewPlayer(view, view.you);
}

function witchsBrewRoleInfo(view, role) {
  const defs = (view && view.role_defs) || {};
  return defs[role] || { name: role || "-", emoji: "❔", full: "", favor: "" };
}

function witchsBrewRoleLabel(view, role) {
  const info = witchsBrewRoleInfo(view, role);
  return (info.emoji || "") + " " + (info.name || role);
}

function witchsBrewSpellInfo(view, spell) {
  const defs = (view && view.spell_defs) || {};
  return defs[spell] || null;
}

function witchsBrewAmount(value) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

function witchsBrewCostTotal(cost) {
  return WITCHS_BREW_INGREDIENTS.reduce((sum, key) => sum + witchsBrewAmount((cost || {})[key]), 0);
}

function witchsBrewCostText(cost) {
  const parts = WITCHS_BREW_INGREDIENTS
    .filter((key) => witchsBrewAmount((cost || {})[key]) > 0)
    .map((key) => WITCHS_BREW_RES[key] + "×" + witchsBrewAmount(cost[key]));
  return parts.length ? parts.join(" ") : "free";
}

function witchsBrewCountText(counts) {
  const parts = Object.keys(WITCHS_BREW_RES)
    .filter((key) => witchsBrewAmount((counts || {})[key]) > 0)
    .map((key) => WITCHS_BREW_RES[key] + "×" + witchsBrewAmount(counts[key]));
  return parts.length ? parts.join(" ") : "nothing";
}

function witchsBrewRavenCount(view) {
  return (view.players || []).reduce((sum, player) => {
    const cards = [...(player.potions || []), ...(player.shelves || [])];
    return sum + cards.filter((card) => card.raven).length;
  }, 0);
}

function witchsBrewTopCard(cards) {
  return Array.isArray(cards) && cards.length ? cards[0] : null;
}

function witchsBrewElement(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
}

function witchsBrewButton(label, onClick, options = {}) {
  const button = witchsBrewElement("button", options.className || "wb-btn", label);
  button.type = "button";
  if (options.explain) button.dataset.wbExplain = options.explain;
  if (options.primary) button.classList.add("is-primary");
  if (options.disabled) {
    button.disabled = true;
  } else {
    button.classList.add("action-allowed");
    button.addEventListener("click", onClick);
  }
  return button;
}

function witchsBrewSend(action) {
  witchsBrewChoice = null;
  sendAction(action);
}

function witchsBrewPendingSignature(view) {
  const pending = view.pending_action || {};
  const monk = view.monk_resolution || {};
  const loss = (monk.pending_losses || [])[0] || {};
  return [
    view.phase, view.set_number, view.round_number,
    pending.player_id, pending.role, pending.strength,
    loss.player_id, loss.amount
  ].join("|");
}

function witchsBrewResetTransient(view) {
  const signature = witchsBrewPendingSignature(view);
  if (signature === witchsBrewPickSignature) return;
  witchsBrewPickSignature = signature;
  witchsBrewPick = null;
  witchsBrewExtraIngredient = "";
  witchsBrewChoice = null;
}

/* ------------------------------------------------------------------ *
 * Ingredient picker
 * ------------------------------------------------------------------ */

function witchsBrewPicker(keys, options = {}) {
  const store = witchsBrewPick || {};
  keys.forEach((key) => {
    if (typeof store[key] !== "number") store[key] = 0;
  });
  witchsBrewPick = store;
  const limits = options.limits || {};
  const cap = typeof options.cap === "number" ? options.cap : Infinity;

  const wrap = witchsBrewElement("div", "wb-picker");
  wrap.dataset.wbExplain = "picker";
  const row = witchsBrewElement("div", "wb-picker-row");
  const faces = {};

  const total = () => keys.reduce((sum, key) => sum + (store[key] || 0), 0);

  const sync = () => {
    keys.forEach((key) => {
      const face = faces[key];
      if (!face) return;
      face.querySelector("b").textContent = String(store[key] || 0);
      face.classList.toggle("is-zero", !store[key]);
      const limit = typeof limits[key] === "number" ? limits[key] : Infinity;
      face.parentElement.querySelector(".wb-pill-minus").disabled = !store[key];
      face.parentElement.querySelector(".wb-pill-plus").disabled = (store[key] || 0) >= limit || total() >= cap;
    });
    if (options.counter) {
      options.counter.textContent = total() + (typeof cap === "number" ? " / " + cap : "");
      options.counter.classList.toggle("is-ready", typeof cap === "number" && total() === cap);
    }
    if (options.onChange) options.onChange(total());
  };

  keys.forEach((key) => {
    const pill = witchsBrewElement("div", "wb-pill");
    const minus = witchsBrewElement("button", "wb-pill-btn wb-pill-minus", "−");
    minus.type = "button";
    minus.setAttribute("aria-label", "Remove one " + (WITCHS_BREW_RES_NAME[key] || key));
    minus.addEventListener("click", () => {
      store[key] = Math.max(0, (store[key] || 0) - 1);
      sync();
    });
    const face = witchsBrewElement("span", "wb-pill-face");
    face.append(witchsBrewElement("span", "wb-pill-icon", WITCHS_BREW_RES[key] || key));
    face.append(witchsBrewElement("b", null, "0"));
    face.dataset.wbTip = WITCHS_BREW_RES_NAME[key] || key;
    const plus = witchsBrewElement("button", "wb-pill-btn wb-pill-plus", "+");
    plus.type = "button";
    plus.setAttribute("aria-label", "Add one " + (WITCHS_BREW_RES_NAME[key] || key));
    plus.addEventListener("click", () => {
      store[key] = (store[key] || 0) + 1;
      sync();
    });
    pill.append(minus, face, plus);
    faces[key] = face;
    row.appendChild(pill);
  });

  wrap.appendChild(row);
  sync();
  return wrap;
}

function witchsBrewPickValues(keys) {
  const result = {};
  keys.forEach((key) => {
    result[key] = (witchsBrewPick && witchsBrewPick[key]) || 0;
  });
  return result;
}

function witchsBrewPickTotal(keys) {
  return keys.reduce((sum, key) => sum + ((witchsBrewPick && witchsBrewPick[key]) || 0), 0);
}


/* ------------------------------------------------------------------ *
 * Top strip, status line and round notice
 * ------------------------------------------------------------------ */

function renderWitchsBrewStrip(view) {
  if (witchsBrewSetLabel) witchsBrewSetLabel.textContent = view.set_number ?? "-";
  if (witchsBrewRoundLabel) witchsBrewRoundLabel.textContent = view.round_number ?? "-";
  if (witchsBrewRavensLabel) witchsBrewRavensLabel.textContent = witchsBrewRavenCount(view) + "/4";
  if (witchsBrewPhaseLabel) {
    witchsBrewPhaseLabel.textContent = WITCHS_BREW_PHASE_LABEL[view.phase] || view.phase || "-";
  }
  if (witchsBrewTurnMeta) {
    const current = view.current_player ? witchsBrewName(view, view.current_player) : null;
    witchsBrewTurnMeta.textContent = view.game_over
      ? "Final scores"
      : current ? "Turn: " + current : "Everyone at once";
  }
}

function renderWitchsBrewStatus(view) {
  if (!witchsBrewStatus) return;
  const legal = view.legal_actions || [];
  const players = view.players || [];
  const chosen = players.filter((player) => player.selected_ready).length;
  const pauseReady = view.pause_ready || [];
  let text;
  if (view.game_over) {
    const winners = (view.winner || []).map((pid) => witchsBrewName(view, pid));
    text = winners.length
      ? winners.join(", ") + (winners.length > 1 ? " share the win" : " wins")
      : "Game over";
  } else if (view.phase === "select_roles") {
    text = legal.includes("select_roles")
      ? "Pick 5 of the 12 roles for set " + view.set_number + "."
      : "Roles locked in. Waiting for the others (" + chosen + "/" + players.length + ").";
  } else if (view.phase === "round_pause") {
    text = "Round resolved. " + pauseReady.length + "/" + players.length + " ready for the next round.";
  } else if (view.phase === "choose_loss") {
    text = legal.includes("choose_loss")
      ? "The Begging Monk is taxing you. Choose which ingredients to give up."
      : "Waiting for " + witchsBrewName(view, view.current_player) + " to choose ingredients.";
  } else if (view.phase === "resolve_action") {
    const pending = view.pending_action || {};
    text = legal.includes("resolve_action")
      ? "Resolve your " + witchsBrewRoleLabel(view, pending.role) + " action."
      : witchsBrewName(view, pending.player_id) + " is resolving " + witchsBrewRoleLabel(view, pending.role) + ".";
  } else if (view.phase === "respond") {
    text = legal.includes("respond")
      ? "You also hold " + witchsBrewRoleLabel(view, view.active_role) + ". Claim it or take the favor."
      : "Waiting for " + witchsBrewName(view, view.current_player) + " to answer " + witchsBrewRoleLabel(view, view.active_role) + ".";
  } else if (view.phase === "play_role") {
    text = legal.includes("play_role")
      ? "Your turn. Play one role as a full action."
      : witchsBrewName(view, view.current_player) + " is choosing a role.";
  } else {
    text = "Waiting for the table.";
  }
  witchsBrewStatus.textContent = text;
}

function witchsBrewRecordRound(round) {
  if (!round || round.round_number == null) return;
  const key = round.set_number + ":" + round.round_number;
  if (witchsBrewRoundLog.has(key)) return;
  witchsBrewRoundLog.set(key, {
    key,
    set: round.set_number,
    round: round.round_number,
    role: round.role,
    claimant: round.claimant,
    summary: round.summary || ""
  });
}

function renderWitchsBrewNotice(view) {
  if (!witchsBrewNotice) return;
  const round = view.phase === "round_pause" ? view.last_round : null;
  const over = view.game_over;
  if (!round && !over) {
    witchsBrewNotice.classList.add("hidden");
    witchsBrewNotice.setAttribute("aria-hidden", "true");
    return;
  }
  witchsBrewNotice.classList.remove("hidden");
  witchsBrewNotice.setAttribute("aria-hidden", "false");
  witchsBrewNoticeRows.innerHTML = "";

  const addRow = (key, value) => {
    const row = witchsBrewElement("div", "wb-notice-row");
    row.append(witchsBrewElement("span", "wb-notice-key", key), witchsBrewElement("span", "wb-notice-val", value));
    witchsBrewNoticeRows.appendChild(row);
  };

  if (over) {
    const winners = (view.winner || []).map((pid) => witchsBrewName(view, pid));
    witchsBrewNoticeTitle.textContent = "Game over";
    witchsBrewNoticeBody.textContent = winners.length
      ? winners.join(", ") + (winners.length > 1 ? " share the win" : " wins")
      : "Final scores are on the player boards.";
    (view.players || [])
      .slice()
      .sort((a, b) => (((view.scores || {})[b.player_id] || {}).total || 0) - (((view.scores || {})[a.player_id] || {}).total || 0))
      .forEach((player) => {
        const score = (view.scores || {})[player.player_id] || {};
        addRow(player.name || player.player_id,
          (score.total ?? 0) + " VP · cards " + (score.cards ?? 0) + " · " + WITCHS_BREW_RES.vial + " " + (score.vials ?? 0));
      });
    witchsBrewNoticeReady.textContent = "";
    witchsBrewNextRoundBtn.classList.add("hidden");
    return;
  }

  witchsBrewNoticeTitle.textContent = witchsBrewRoleLabel(view, round.role) + " resolved";
  witchsBrewNoticeBody.textContent = witchsBrewName(view, round.claimant) + " " + (round.summary || "finished the action");
  addRow("Full action", witchsBrewName(view, round.claimant));
  addRow("Favor", (round.favor_players || []).map((pid) => witchsBrewName(view, pid)).join(", ") || "nobody");
  addRow("Passed", (round.passed || []).map((pid) => witchsBrewName(view, pid)).join(", ") || "nobody");

  const pauseReady = view.pause_ready || [];
  const mine = pauseReady.includes(view.you);
  witchsBrewNoticeReady.textContent = pauseReady.length + "/" + (view.players || []).length + " ready";
  const canAdvance = (view.legal_actions || []).includes("next_round");
  witchsBrewNextRoundBtn.classList.remove("hidden");
  witchsBrewNextRoundBtn.disabled = !canAdvance;
  witchsBrewNextRoundBtn.classList.toggle("action-allowed", canAdvance);
  witchsBrewNextRoundBtn.textContent = mine ? "Waiting for others" : "Next Round";
  witchsBrewRecordRound(round);
}

/* ------------------------------------------------------------------ *
 * Stage: the role being contested and its resolution controls
 * ------------------------------------------------------------------ */

function witchsBrewStageRoleCard(view, role, strength) {
  const info = witchsBrewRoleInfo(view, role);
  const card = witchsBrewElement("div", "wb-stage-role kind-" + (WITCHS_BREW_ROLE_KIND[role] || "spell"));
  card.dataset.wbExplain = "role_card";
  const emoji = witchsBrewElement("span", "wb-stage-emoji", info.emoji || "❔");
  const body = witchsBrewElement("div", "wb-stage-body");
  const title = witchsBrewElement("div", "wb-stage-name");
  title.append(witchsBrewElement("strong", null, info.name || role));
  if (strength) {
    title.append(witchsBrewElement("span", "wb-tag " + (strength === "full" ? "is-full" : "is-favor"),
      strength === "full" ? "Full action" : "Favor"));
  }
  body.appendChild(title);
  const effects = witchsBrewElement("div", "wb-stage-effects");
  const full = witchsBrewElement("span", "wb-effect");
  full.append(witchsBrewElement("i", null, "Full"), document.createTextNode(info.full || "-"));
  const favor = witchsBrewElement("span", "wb-effect");
  favor.append(witchsBrewElement("i", null, "Favor"), document.createTextNode(info.favor || "-"));
  effects.append(full, favor);
  body.appendChild(effects);
  card.append(emoji, body);
  card.dataset.wbTip = info.name + ". Full action: " + info.full + ". Favor: " + info.favor + ".";
  return card;
}

function witchsBrewContestLines(view) {
  const lines = witchsBrewElement("div", "wb-contest");
  const add = (label, value) => {
    if (!value) return;
    const line = witchsBrewElement("div", "wb-contest-line");
    line.append(witchsBrewElement("span", "wb-contest-key", label), witchsBrewElement("span", "wb-contest-val", value));
    lines.appendChild(line);
  };
  add("Claiming", view.claimant ? witchsBrewName(view, view.claimant) : null);
  add("Favor taken", (view.favor_players || []).map((pid) => witchsBrewName(view, pid)).join(", "));
  add("Passed", (view.round_passed || []).map((pid) => witchsBrewName(view, pid)).join(", "));
  return lines.childElementCount ? lines : null;
}

function witchsBrewExtraVialRow() {
  const row = witchsBrewElement("div", "wb-extra");
  row.append(witchsBrewElement("span", "wb-extra-label", "After buying, pay 1 ingredient for " + WITCHS_BREW_RES.vial + "×1"));
  const chips = witchsBrewElement("div", "wb-chips");
  const options = [{ key: "", icon: "✖", name: "nothing" }].concat(
    WITCHS_BREW_INGREDIENTS.map((key) => ({ key, icon: WITCHS_BREW_RES[key], name: WITCHS_BREW_RES_NAME[key] }))
  );
  options.forEach((option) => {
    const chip = witchsBrewElement("button", "wb-chip-btn", option.icon);
    chip.type = "button";
    chip.dataset.wbTip = option.key ? "Pay one " + option.name + " for one vial" : "Skip the extra vial";
    chip.classList.toggle("is-on", witchsBrewExtraIngredient === option.key);
    chip.addEventListener("click", () => {
      witchsBrewExtraIngredient = option.key;
      chips.querySelectorAll(".wb-chip-btn").forEach((node) => node.classList.remove("is-on"));
      chip.classList.add("is-on");
    });
    chips.appendChild(chip);
  });
  row.appendChild(chips);
  return row;
}

function witchsBrewSpellControls(view, host, commit, resources) {
  const spell = view.spell;
  const info = witchsBrewSpellInfo(view, spell);
  if (!info) {
    host.appendChild(witchsBrewButton("Cast the spell", () => commit({}), { primary: true, explain: "resolve" }));
    return;
  }
  if (spell === "copia") {
    const counter = witchsBrewElement("span", "wb-pick-count", "0 / 3");
    host.appendChild(witchsBrewPicker(WITCHS_BREW_INGREDIENTS, { cap: 3, counter }));
    host.appendChild(counter);
    host.appendChild(witchsBrewButton("Cast Copia",
      () => commit({ gain_ingredients: witchsBrewPickValues(WITCHS_BREW_INGREDIENTS) }),
      { primary: true, explain: "resolve" }));
    return;
  }
  if (spell === "optio") {
    WITCHS_BREW_STACKS.forEach((stack) => {
      const card = witchsBrewTopCard((view.cauldrons || {})[stack.key]);
      host.appendChild(witchsBrewButton(
        card ? "Buy " + stack.icon + " " + stack.label + " · " + witchsBrewCostText(card.cost) : stack.icon + " " + stack.label + " empty",
        () => commit({ stack: stack.key }),
        { primary: true, explain: "resolve", disabled: !card }
      ));
    });
    return;
  }
  const spellCost = { herba: "green", lupus: "red", serpens: "white" };
  if (spellCost[spell]) {
    const color = spellCost[spell];
    host.appendChild(witchsBrewButton(
      "Pay " + WITCHS_BREW_RES[color] + "×1 → " + WITCHS_BREW_RES.vial + "×2",
      () => commit({}),
      { primary: true, explain: "resolve", disabled: witchsBrewAmount(resources[color]) <= 0 }
    ));
    return;
  }
  const spellStack = { magus: "copper", sanatio: "silver", strix: "iron" };
  if (spellStack[spell]) {
    const stack = WITCHS_BREW_STACKS.find((entry) => entry.key === spellStack[spell]);
    const card = witchsBrewTopCard((view.cauldrons || {})[stack.key]);
    const need = card ? witchsBrewCostTotal(card.cost) : 0;
    const limits = {};
    WITCHS_BREW_INGREDIENTS.forEach((key) => {
      limits[key] = witchsBrewAmount(resources[key]);
    });
    const counter = witchsBrewElement("span", "wb-pick-count", "0 / " + need);
    host.appendChild(witchsBrewPicker(WITCHS_BREW_INGREDIENTS, { cap: need, limits, counter }));
    host.appendChild(counter);
    host.appendChild(witchsBrewButton(
      card ? "Cast " + info.name + " → " + stack.icon + " " + stack.label : stack.label + " is empty",
      () => commit({ payment: witchsBrewPickValues(WITCHS_BREW_INGREDIENTS) }),
      { primary: true, explain: "resolve", disabled: !card }
    ));
    return;
  }
  host.appendChild(witchsBrewButton("Cast " + info.name, () => commit({}), { primary: true, explain: "resolve" }));
}

function witchsBrewResolutionControls(view, host) {
  const pending = view.pending_action || {};
  const role = pending.role;
  const full = pending.strength === "full";
  const me = witchsBrewMe(view) || { resources: {} };
  const resources = me.resources || {};
  const controls = witchsBrewElement("div", "wb-controls");
  const commit = (extra) => witchsBrewSend({ type: "resolve_action", ...extra });

  if (role === "wolf_keeper" || role === "snake_hunter" || role === "herb_collector") {
    const color = role === "wolf_keeper" ? "red" : role === "snake_hunter" ? "white" : "green";
    const amount = full ? 3 : 1;
    controls.append(witchsBrewButton("Take " + WITCHS_BREW_RES[color] + "×" + amount, () => commit({}),
      { primary: true, explain: "resolve" }));
  } else if (role === "alchemist") {
    const gain = full ? 5 : 2;
    WITCHS_BREW_INGREDIENTS.forEach((color) => {
      controls.append(witchsBrewButton(
        "Pay " + WITCHS_BREW_RES[color] + " → " + WITCHS_BREW_RES.gold + "×" + gain,
        () => commit({ pay_ingredient: color }),
        { primary: true, explain: "resolve", disabled: witchsBrewAmount(resources[color]) <= 0 }
      ));
    });
  } else if (role === "fortune_teller") {
    const gain = full ? 2 : 1;
    controls.append(witchsBrewButton(
      "Pay " + WITCHS_BREW_RES.gold + "×1 → " + WITCHS_BREW_RES.vial + "×" + gain,
      () => commit({}),
      { primary: true, explain: "resolve", disabled: witchsBrewAmount(resources.gold) <= 0 }
    ));
  } else if (role === "assistant") {
    const need = full ? 3 : 1;
    const counter = witchsBrewElement("span", "wb-pick-count", "0 / " + need);
    controls.appendChild(witchsBrewPicker(WITCHS_BREW_INGREDIENTS, { cap: need, counter }));
    controls.appendChild(counter);
    controls.append(witchsBrewButton("Pay " + WITCHS_BREW_RES.gold + "×1 → take these",
      () => commit({ gain_ingredients: witchsBrewPickValues(WITCHS_BREW_INGREDIENTS) }),
      { primary: true, explain: "resolve", disabled: witchsBrewAmount(resources.gold) <= 0 }));
  } else if (role === "wizard" || role === "witch" || role === "druid") {
    const stack = WITCHS_BREW_STACKS.find((entry) => entry.role === role);
    const card = witchsBrewTopCard((view.cauldrons || {})[stack.key]);
    const extra = full ? 0 : 2;
    const label = card
      ? "Buy " + stack.icon + " " + stack.label + " · " + witchsBrewCostText(card.cost) + (extra ? " + " + WITCHS_BREW_RES.gold + "×" + extra : "")
      : "Buy " + stack.icon + " " + stack.label;
    controls.appendChild(witchsBrewExtraVialRow());
    controls.append(witchsBrewButton(label, () => commit({ extra_ingredient: witchsBrewExtraIngredient || undefined }),
      { primary: true, explain: "resolve", disabled: !card }));
  } else if (role === "warlock" && !full) {
    controls.append(witchsBrewButton("Take " + WITCHS_BREW_RES.gold + "×1", () => commit({}),
      { primary: true, explain: "resolve" }));
  } else if (role === "warlock") {
    witchsBrewSpellControls(view, controls, commit, resources);
  } else if (role === "cutpurse") {
    if (!full) {
      controls.append(witchsBrewButton("Take the protection", () => commit({}), { primary: true, explain: "resolve" }));
    } else {
      const cap = witchsBrewAmount(resources.gold);
      const counter = witchsBrewElement("span", "wb-pick-count", "0");
      controls.appendChild(witchsBrewPicker(["gold"], { cap, limits: { gold: cap }, counter }));
      controls.appendChild(counter);
      controls.append(witchsBrewButton("Add gold to the " + WITCHS_BREW_SHELVES[0].icon + " shelf",
        () => commit({ augment_gold: witchsBrewPickTotal(["gold"]) }),
        { primary: true, explain: "resolve" }));
    }
  } else if (role === "begging_monk") {
    if (!full) {
      controls.append(witchsBrewButton("Take the protection", () => commit({}), { primary: true, explain: "resolve" }));
    } else {
      const limits = {};
      let cap = 0;
      WITCHS_BREW_INGREDIENTS.forEach((key) => {
        limits[key] = witchsBrewAmount(resources[key]);
        cap += limits[key];
      });
      const counter = witchsBrewElement("span", "wb-pick-count", "0");
      controls.appendChild(witchsBrewPicker(WITCHS_BREW_INGREDIENTS, { cap, limits, counter }));
      controls.appendChild(counter);
      controls.append(witchsBrewButton("Add ingredients to the " + WITCHS_BREW_SHELVES[1].icon + " shelf",
        () => commit({ augment_ingredients: witchsBrewPickValues(WITCHS_BREW_INGREDIENTS) }),
        { primary: true, explain: "resolve" }));
    }
  } else {
    controls.append(witchsBrewButton("Resolve", () => commit({}), { primary: true, explain: "resolve" }));
  }

  controls.appendChild(witchsBrewButton("Skip", () => witchsBrewSend({ type: "resolve_action", skip: true }),
    { className: "wb-btn is-ghost", explain: "skip" }));
  host.appendChild(controls);
}

function witchsBrewLossControls(view, host) {
  const monk = view.monk_resolution || {};
  const loss = (monk.pending_losses || [])[0] || {};
  const amount = witchsBrewAmount(loss.amount);
  const me = witchsBrewMe(view) || { resources: {} };
  const limits = {};
  WITCHS_BREW_INGREDIENTS.forEach((key) => {
    limits[key] = witchsBrewAmount((me.resources || {})[key]);
  });
  const controls = witchsBrewElement("div", "wb-controls");
  const counter = witchsBrewElement("span", "wb-pick-count", "0 / " + amount);
  controls.appendChild(witchsBrewPicker(WITCHS_BREW_INGREDIENTS, { cap: amount, limits, counter }));
  controls.appendChild(counter);
  controls.appendChild(witchsBrewButton("Give these up",
    () => witchsBrewSend({ type: "choose_loss", loss: witchsBrewPickValues(WITCHS_BREW_INGREDIENTS) }),
    { primary: true, explain: "resolve" }));
  host.appendChild(controls);
}

function renderWitchsBrewStage(view) {
  if (!witchsBrewStage) return;
  witchsBrewStage.innerHTML = "";
  const legal = view.legal_actions || [];

  if (view.game_over) {
    witchsBrewStage.classList.add("hidden");
    return;
  }
  witchsBrewStage.classList.remove("hidden");

  if (view.phase === "select_roles") {
    const prompt = witchsBrewElement("div", "wb-stage-prompt");
    prompt.append(
      witchsBrewElement("span", "wb-stage-prompt-icon", "🧪"),
      witchsBrewElement("span", null, legal.includes("select_roles")
        ? "Set " + view.set_number + ": keep five of the twelve roles."
        : "Set " + view.set_number + ": your five roles are locked in.")
    );
    witchsBrewStage.appendChild(prompt);
    return;
  }

  if (view.phase === "choose_loss") {
    const monk = view.monk_resolution || {};
    const loss = (monk.pending_losses || [])[0] || {};
    const mine = legal.includes("choose_loss");
    witchsBrewStage.appendChild(witchsBrewStageRoleCard(view, "begging_monk", "full"));
    witchsBrewStage.appendChild(witchsBrewElement("div", "wb-stage-text", mine
      ? witchsBrewName(view, monk.actor) + " takes " + witchsBrewAmount(loss.amount) + " ingredient(s) from you."
      : "Waiting for " + witchsBrewName(view, view.current_player) + " to choose ingredients."));
    if (mine) witchsBrewLossControls(view, witchsBrewStage);
    return;
  }

  if (view.phase === "play_role") {
    const mine = legal.includes("play_role");
    const prompt = witchsBrewElement("div", "wb-stage-prompt");
    prompt.append(
      witchsBrewElement("span", "wb-stage-prompt-icon", mine ? "🎴" : "⏳"),
      witchsBrewElement("span", null, mine
        ? "Play one of your roles as a full action."
        : witchsBrewName(view, view.current_player) + " is choosing a role.")
    );
    witchsBrewStage.appendChild(prompt);
    return;
  }

  if (!view.active_role) {
    witchsBrewStage.classList.add("hidden");
    return;
  }

  const pending = view.pending_action || {};
  const mine = legal.includes("resolve_action") || legal.includes("respond");
  const strength = view.phase === "resolve_action" ? pending.strength : null;
  witchsBrewStage.appendChild(witchsBrewStageRoleCard(view, view.active_role, strength));
  const contest = witchsBrewContestLines(view);
  if (contest) witchsBrewStage.appendChild(contest);

  if (view.phase === "respond") {
    witchsBrewStage.appendChild(witchsBrewElement("div", "wb-stage-text", mine
      ? "You hold this role too. Tap it in your hand to claim it or take the favor."
      : "Waiting for " + witchsBrewName(view, view.current_player) + " to answer."));
  } else if (view.phase === "resolve_action") {
    witchsBrewStage.appendChild(witchsBrewElement("div", "wb-stage-text", mine
      ? "Your action. Every action is optional."
      : witchsBrewName(view, pending.player_id) + " is resolving this role."));
    if (mine) witchsBrewResolutionControls(view, witchsBrewStage);
  }
}


/* ------------------------------------------------------------------ *
 * Hand: role cards plus in-place confirmation
 * ------------------------------------------------------------------ */

function witchsBrewRoleCard(view, role, options = {}) {
  const info = witchsBrewRoleInfo(view, role);
  const short = WITCHS_BREW_ROLE_SHORT[role] || { full: info.full, favor: info.favor };
  const card = witchsBrewElement("button", "wb-role kind-" + (WITCHS_BREW_ROLE_KIND[role] || "spell"));
  card.type = "button";
  card.dataset.wbExplain = options.disabled ? "role_disabled" : "role_card";
  card.dataset.wbTip = info.name + ". Full action: " + info.full + ". Favor: " + info.favor + ".";
  card.appendChild(witchsBrewElement("span", "wb-role-emoji", options.disabled ? "🚫" : info.emoji || "❔"));
  card.appendChild(witchsBrewElement("span", "wb-role-name", info.name || role));
  const effects = witchsBrewElement("span", "wb-role-effects");
  const full = witchsBrewElement("span", "wb-role-effect is-full");
  full.append(witchsBrewElement("i", null, "F"), document.createTextNode(short.full || "-"));
  const favor = witchsBrewElement("span", "wb-role-effect is-favor");
  favor.append(witchsBrewElement("i", null, "V"), document.createTextNode(short.favor || "-"));
  effects.append(full, favor);
  card.appendChild(effects);
  if (options.selected) card.classList.add("is-selected");
  if (options.disabled) card.classList.add("is-disabled");
  if (options.actionable) card.classList.add("is-actionable");
  if (options.onClick) {
    card.addEventListener("click", options.onClick);
  } else {
    card.disabled = true;
  }
  return card;
}

function renderWitchsBrewHandOverlay(view) {
  if (!witchsBrewHandOverlay) return;
  if (!witchsBrewChoice) {
    witchsBrewHandOverlay.classList.add("hidden");
    witchsBrewHandOverlay.setAttribute("aria-hidden", "true");
    witchsBrewHandOverlay.innerHTML = "";
    return;
  }
  const role = witchsBrewChoice.role;
  const mode = witchsBrewChoice.mode;
  const info = witchsBrewRoleInfo(view, role);
  witchsBrewHandOverlay.classList.remove("hidden");
  witchsBrewHandOverlay.setAttribute("aria-hidden", "false");
  witchsBrewHandOverlay.innerHTML = "";

  const sheet = witchsBrewElement("div", "wb-overlay-sheet");
  sheet.dataset.wbExplain = mode === "play" ? "play_role" : "respond";
  sheet.addEventListener("click", (event) => event.stopPropagation());

  const head = witchsBrewElement("div", "wb-overlay-head");
  head.append(
    witchsBrewElement("span", "wb-overlay-emoji", info.emoji || "❔"),
    witchsBrewElement("strong", null, info.name || role)
  );
  sheet.appendChild(head);

  const cancel = () => {
    witchsBrewChoice = null;
    renderWitchsBrewHand(currentWitchsBrewView);
  };
  const actions = witchsBrewElement("div", "wb-overlay-actions");

  if (mode === "play") {
    sheet.appendChild(witchsBrewElement("p", "wb-overlay-text",
      "Play as a full action: " + info.full + ". Players behind you holding this role may steal it."));
    actions.append(
      witchsBrewButton("Play full action", () => witchsBrewSend({ type: "play_role", role }), { primary: true }),
      witchsBrewButton("Cancel", cancel, { className: "wb-btn is-ghost" })
    );
  } else {
    sheet.appendChild(witchsBrewElement("p", "wb-overlay-text", "You hold this role too and must play it. Pick one side."));
    const compare = witchsBrewElement("div", "wb-compare");
    const fullCol = witchsBrewElement("div", "wb-compare-col");
    fullCol.append(witchsBrewElement("span", "wb-compare-tag is-full", "Claim full"), witchsBrewElement("span", null, info.full || "-"));
    const favorCol = witchsBrewElement("div", "wb-compare-col");
    favorCol.append(witchsBrewElement("span", "wb-compare-tag is-favor", "Take favor"), witchsBrewElement("span", null, info.favor || "-"));
    compare.append(fullCol, favorCol);
    sheet.appendChild(compare);
    actions.append(
      witchsBrewButton("Claim full action", () => witchsBrewSend({ type: "respond", response: "claim_full" }), { primary: true }),
      witchsBrewButton("Take favor", () => witchsBrewSend({ type: "respond", response: "take_favor" })),
      witchsBrewButton("Cancel", cancel, { className: "wb-btn is-ghost" })
    );
  }

  sheet.appendChild(actions);
  witchsBrewHandOverlay.appendChild(sheet);
}

function renderWitchsBrewHand(view) {
  if (!witchsBrewHand) return;
  const legal = view.legal_actions || [];
  const selecting = view.phase === "select_roles";
  const submitted = selecting && (view.your_selected || []).length > 0;
  const disabledRoles = view.disabled_roles || [];
  witchsBrewHand.innerHTML = "";
  witchsBrewHandBar.innerHTML = "";
  witchsBrewHand.classList.toggle("is-select", selecting);
  if (witchsBrewHandTitle) witchsBrewHandTitle.textContent = selecting ? "Pick five roles" : "Your roles";

  if (selecting) {
    const count = submitted ? (view.your_selected || []).length : witchsBrewSelectedRoles.size;
    if (witchsBrewHandMeta) {
      witchsBrewHandMeta.textContent = submitted ? "Locked in" : count + "/5 chosen";
    }
    WITCHS_BREW_ROLE_ORDER.forEach((role) => {
      const isDisabled = disabledRoles.includes(role);
      const isSelected = submitted
        ? (view.your_selected || []).includes(role)
        : witchsBrewSelectedRoles.has(role);
      witchsBrewHand.appendChild(witchsBrewRoleCard(view, role, {
        disabled: isDisabled,
        selected: isSelected,
        actionable: !isDisabled && !submitted,
        onClick: isDisabled || submitted ? null : () => {
          if (witchsBrewSelectedRoles.has(role)) {
            witchsBrewSelectedRoles.delete(role);
          } else if (witchsBrewSelectedRoles.size < 5) {
            witchsBrewSelectedRoles.add(role);
          }
          renderWitchsBrewHand(currentWitchsBrewView);
        }
      }));
    });
    if (submitted) {
      witchsBrewHandBar.appendChild(witchsBrewElement("span", "wb-hand-note", "Waiting for the other players to choose."));
    } else {
      witchsBrewHandBar.append(
        witchsBrewElement("span", "wb-hand-count", witchsBrewSelectedRoles.size + "/5"),
        witchsBrewButton("Confirm roles",
          () => witchsBrewSend({ type: "select_roles", roles: Array.from(witchsBrewSelectedRoles) }),
          { primary: true, explain: "confirm_roles", disabled: witchsBrewSelectedRoles.size !== 5 })
      );
    }
    renderWitchsBrewHandOverlay(view);
    return;
  }

  const hand = view.your_hand || [];
  const canPlay = legal.includes("play_role");
  const canRespond = legal.includes("respond");
  if (witchsBrewHandMeta) witchsBrewHandMeta.textContent = hand.length ? hand.length + " left" : "Empty";
  if (!hand.length) {
    witchsBrewHand.appendChild(witchsBrewElement("div", "wb-empty", "No roles left this set."));
  }
  hand.forEach((role) => {
    const actionable = canPlay || (canRespond && role === view.active_role);
    witchsBrewHand.appendChild(witchsBrewRoleCard(view, role, {
      actionable,
      onClick: actionable ? () => {
        witchsBrewChoice = { role, mode: canPlay ? "play" : "respond" };
        renderWitchsBrewHand(currentWitchsBrewView);
      } : null
    }));
  });
  if (canRespond) {
    witchsBrewHandBar.appendChild(witchsBrewElement("span", "wb-hand-note",
      "Tap " + witchsBrewRoleLabel(view, view.active_role) + " to claim the full action or take the favor."));
  } else if (canPlay) {
    witchsBrewHandBar.appendChild(witchsBrewElement("span", "wb-hand-note", "Tap a role to play it as a full action."));
  }
  renderWitchsBrewHandOverlay(view);
}

if (witchsBrewHandOverlay) {
  witchsBrewHandOverlay.addEventListener("click", () => {
    if (!witchsBrewChoice) return;
    witchsBrewChoice = null;
    renderWitchsBrewHand(currentWitchsBrewView);
  });
}

/* ------------------------------------------------------------------ *
 * Public brewing table
 * ------------------------------------------------------------------ */

function renderWitchsBrewPublic(view) {
  if (!witchsBrewPublic) return;
  witchsBrewPublic.innerHTML = "";

  const foot = (node, card, left) => {
    const row = witchsBrewElement("div", "wb-card-foot");
    const vp = witchsBrewElement("span", "wb-vp", card.vp + " VP");
    vp.dataset.wbTip = "Points scored at the end of the game";
    row.appendChild(vp);
    if (card.raven) {
      const raven = witchsBrewElement("span", "wb-raven", WITCHS_BREW_RAVEN);
      raven.dataset.wbTip = "A raven card. Four of these on the table end the game at the close of a set.";
      row.appendChild(raven);
    }
    row.appendChild(witchsBrewElement("span", "wb-card-left", left + " left"));
    node.appendChild(row);
  };

  WITCHS_BREW_STACKS.forEach((stack) => {
    const cards = (view.cauldrons || {})[stack.key] || [];
    const card = witchsBrewTopCard(cards);
    const node = witchsBrewElement("div", "wb-card wb-cauldron stack-" + stack.key);
    node.dataset.wbExplain = "cauldron";
    const head = witchsBrewElement("div", "wb-card-head");
    head.append(witchsBrewElement("span", "wb-card-icon", stack.icon), witchsBrewElement("strong", null, stack.label));
    node.appendChild(head);
    if (card) {
      const cost = witchsBrewElement("div", "wb-card-cost", witchsBrewCostText(card.cost));
      cost.dataset.wbTip = "Costs " + witchsBrewCostText(card.cost) + " to buy this cauldron.";
      node.appendChild(cost);
      foot(node, card, cards.length);
      node.dataset.wbTip = stack.label + " cauldron. " + witchsBrewCostText(card.cost) + " for " + card.vp
        + " points." + (card.raven ? " Carries a raven." : "");
    } else {
      node.appendChild(witchsBrewElement("div", "wb-card-empty", "Empty"));
    }
    witchsBrewPublic.appendChild(node);
  });

  WITCHS_BREW_SHELVES.forEach((shelf) => {
    const cards = (view.shelves || {})[shelf.key] || [];
    const card = witchsBrewTopCard(cards);
    const stored = (view.shelf_stored || {})[shelf.key] || {};
    const storedTotal = shelf.unit === "gold"
      ? witchsBrewAmount(stored.gold)
      : WITCHS_BREW_INGREDIENTS.reduce((sum, key) => sum + witchsBrewAmount(stored[key]), 0);
    const node = witchsBrewElement("div", "wb-card wb-shelf shelf-" + shelf.key);
    node.dataset.wbExplain = "shelf";
    const head = witchsBrewElement("div", "wb-card-head");
    head.append(witchsBrewElement("span", "wb-card-icon", shelf.icon), witchsBrewElement("strong", null, shelf.label));
    node.appendChild(head);
    if (card) {
      const need = Math.max(1, witchsBrewAmount(card.threshold));
      const bar = witchsBrewElement("div", "wb-bar");
      const fill = witchsBrewElement("span", "wb-bar-fill");
      fill.style.width = Math.min(100, Math.round((storedTotal / need) * 100)) + "%";
      bar.appendChild(fill);
      node.appendChild(bar);
      const progress = witchsBrewElement("div", "wb-card-progress",
        (shelf.unit === "gold" ? WITCHS_BREW_RES.gold : "ing") + " " + storedTotal + "/" + witchsBrewAmount(card.threshold));
      progress.dataset.wbTip = shelf.unit === "gold"
        ? "Gold piled on this shelf card. Filling the threshold lets the Cutpurse take it."
        : "Ingredients piled on this shelf card. Filling the threshold lets the Begging Monk take it.";
      node.appendChild(progress);
      if (shelf.unit !== "gold" && storedTotal > 0) {
        node.appendChild(witchsBrewElement("div", "wb-card-stored", witchsBrewCountText(stored)));
      }
      foot(node, card, cards.length);
      node.dataset.wbTip = shelf.label + ". " + storedTotal + " of " + witchsBrewAmount(card.threshold)
        + " piled up for " + card.vp + " points.";
    } else {
      node.appendChild(witchsBrewElement("div", "wb-card-empty", "Empty"));
    }
    witchsBrewPublic.appendChild(node);
  });
}

function renderWitchsBrewSpell(view) {
  if (!witchsBrewSpell) return;
  witchsBrewSpell.innerHTML = "";
  const info = witchsBrewSpellInfo(view, view.spell);
  const node = witchsBrewElement("div", "wb-spell-card");
  node.dataset.wbExplain = "spell_card";
  node.append(
    witchsBrewElement("span", "wb-card-icon", "📖"),
    witchsBrewElement("strong", null, info ? info.name : "No spell"),
    witchsBrewElement("span", "wb-spell-text", info ? info.text : "The spell book is empty.")
  );
  node.dataset.wbTip = info
    ? "Current spell " + info.name + ". " + info.text + " Only the Warlock full action can cast it."
    : "No spell available";
  witchsBrewSpell.appendChild(node);
}

/* ------------------------------------------------------------------ *
 * Players
 * ------------------------------------------------------------------ */

function renderWitchsBrewPlayers(view) {
  if (!witchsBrewPlayers) return;
  witchsBrewPlayers.innerHTML = "";
  (view.players || []).forEach((player) => {
    const node = witchsBrewElement("div", "wb-player");
    node.dataset.wbExplain = "player_card";
    if (player.player_id === view.you) node.classList.add("is-you");
    if (player.player_id === view.current_player) node.classList.add("is-current");
    if ((view.pause_ready || []).includes(player.player_id)) node.classList.add("is-ready");
    if ((view.winner || []).includes(player.player_id)) node.classList.add("is-winner");

    const head = witchsBrewElement("div", "wb-player-head");
    head.appendChild(witchsBrewElement("strong", "wb-player-name", player.name || player.player_id));
    const tags = [];
    if (player.player_id === view.you) tags.push("you");
    if (player.is_bot) tags.push("bot");
    if (tags.length) head.appendChild(witchsBrewElement("span", "wb-player-tag", tags.join(" · ")));
    const score = (view.scores || {})[player.player_id];
    head.appendChild(witchsBrewElement("span", "wb-player-score", score ? score.total + " VP" : player.hand_count + " 🃏"));
    node.appendChild(head);

    const res = witchsBrewElement("div", "wb-player-res");
    Object.keys(WITCHS_BREW_RES).forEach((key) => {
      const amount = witchsBrewAmount((player.resources || {})[key]);
      const chip = witchsBrewElement("span", "wb-res");
      chip.append(witchsBrewElement("span", "wb-res-icon", WITCHS_BREW_RES[key]), witchsBrewElement("b", null, String(amount)));
      chip.dataset.wbTip = WITCHS_BREW_RES_NAME[key] + ": " + amount;
      res.appendChild(chip);
    });
    node.appendChild(res);

    const played = (player.played_roles || []).map((role) => witchsBrewRoleInfo(view, role).emoji || role);
    node.appendChild(witchsBrewElement("div", "wb-player-meta", view.phase === "select_roles"
      ? (player.selected_ready ? "✓ roles locked" : "choosing " + player.selected_count + "/5")
      : "played " + (played.length ? played.join(" ") : "–")));

    const won = [...(player.potions || []), ...(player.shelves || [])];
    if (won.length) {
      const row = witchsBrewElement("div", "wb-player-cards");
      won.forEach((card) => {
        const chip = witchsBrewElement("span", "wb-won", card.vp + (card.raven ? WITCHS_BREW_RAVEN : ""));
        chip.dataset.wbTip = card.vp + " points" + (card.raven ? " with a raven" : "");
        row.appendChild(chip);
      });
      node.appendChild(row);
    }

    node.dataset.wbTip = (player.name || player.player_id) + " holds " + player.hand_count + " role card(s).";
    witchsBrewPlayers.appendChild(node);
  });
}

/* ------------------------------------------------------------------ *
 * Collapsible reference
 * ------------------------------------------------------------------ */

function renderWitchsBrewReference(view) {
  if (witchsBrewSpellList) {
    witchsBrewSpellList.innerHTML = "";
    (view.spell_deck || []).forEach((spell, index) => {
      const info = witchsBrewSpellInfo(view, spell);
      const item = witchsBrewElement("li", index === 0 ? "is-current" : null);
      item.append(
        witchsBrewElement("strong", null, info ? info.name : spell),
        witchsBrewElement("span", null, info ? info.text : "")
      );
      witchsBrewSpellList.appendChild(item);
    });
  }
  const stackBlock = (host, title, entries, describe) => {
    const block = witchsBrewElement("div", "wb-stack");
    block.appendChild(witchsBrewElement("strong", null, title));
    const list = witchsBrewElement("ol", "wb-stack-list");
    entries.forEach((card, index) => {
      const item = witchsBrewElement("li", index === 0 ? "is-top" : null);
      const parts = describe(card);
      item.append(witchsBrewElement("span", null, parts[0]), witchsBrewElement("span", null, parts[1]));
      list.appendChild(item);
    });
    block.appendChild(list);
    host.appendChild(block);
  };
  if (witchsBrewStackList) {
    witchsBrewStackList.innerHTML = "";
    WITCHS_BREW_STACKS.forEach((stack) => {
      stackBlock(witchsBrewStackList, stack.icon + " " + stack.label, (view.cauldrons || {})[stack.key] || [],
        (card) => [witchsBrewCostText(card.cost), (card.vp + " VP " + (card.raven ? WITCHS_BREW_RAVEN : "")).trim()]);
    });
  }
  if (witchsBrewShelfList) {
    witchsBrewShelfList.innerHTML = "";
    WITCHS_BREW_SHELVES.forEach((shelf) => {
      stackBlock(witchsBrewShelfList, shelf.icon + " " + shelf.label, (view.shelves || {})[shelf.key] || [],
        (card) => ["need " + card.threshold, (card.vp + " VP " + (card.raven ? WITCHS_BREW_RAVEN : "")).trim()]);
    });
  }
  if (witchsBrewRoleList) {
    witchsBrewRoleList.innerHTML = "";
    WITCHS_BREW_ROLE_ORDER.forEach((role) => {
      const info = witchsBrewRoleInfo(view, role);
      const row = witchsBrewElement("div", "wb-role-row kind-" + (WITCHS_BREW_ROLE_KIND[role] || "spell"));
      row.append(
        witchsBrewElement("span", "wb-role-row-icon", info.emoji || "❔"),
        witchsBrewElement("strong", null, info.name || role),
        witchsBrewElement("span", "wb-role-row-full", info.full || "-"),
        witchsBrewElement("span", "wb-role-row-favor", info.favor || "-")
      );
      witchsBrewRoleList.appendChild(row);
    });
  }
  if (witchsBrewLog) {
    witchsBrewLog.innerHTML = "";
    const entries = Array.from(witchsBrewRoundLog.values()).sort((a, b) => (a.set - b.set) || (a.round - b.round));
    if (!entries.length) {
      witchsBrewLog.appendChild(witchsBrewElement("li", "wb-empty", "No rounds finished yet."));
    }
    entries.forEach((entry) => {
      const item = witchsBrewElement("li");
      item.append(
        witchsBrewElement("strong", null, "S" + entry.set + "·R" + entry.round + " " + (witchsBrewRoleInfo(view, entry.role).emoji || "")),
        witchsBrewElement("span", null, witchsBrewName(view, entry.claimant) + " " + entry.summary)
      );
      witchsBrewLog.appendChild(item);
    });
  }
}

/* ------------------------------------------------------------------ *
 * Entry points
 * ------------------------------------------------------------------ */

function clearWitchsBrewState() {
  currentWitchsBrewView = null;
  witchsBrewSelectedRoles = new Set();
  witchsBrewChoice = null;
  witchsBrewPick = null;
  witchsBrewPickSignature = "";
  witchsBrewExtraIngredient = "";
  witchsBrewRoundLog.clear();
  if (witchsBrewExplainWidget) witchsBrewExplainWidget.exit();
  witchsBrewHideTooltip();
  [witchsBrewSetLabel, witchsBrewRoundLabel, witchsBrewRavensLabel, witchsBrewPhaseLabel].forEach((node) => {
    if (node) node.textContent = "-";
  });
  if (witchsBrewStatus) witchsBrewStatus.textContent = "Waiting for game state…";
  if (witchsBrewTurnMeta) witchsBrewTurnMeta.textContent = "";
  if (witchsBrewHandMeta) witchsBrewHandMeta.textContent = "";
  if (witchsBrewNotice) {
    witchsBrewNotice.classList.add("hidden");
    witchsBrewNotice.setAttribute("aria-hidden", "true");
  }
  if (witchsBrewNoticeRows) witchsBrewNoticeRows.innerHTML = "";
  if (witchsBrewNoticeReady) witchsBrewNoticeReady.textContent = "";
  if (witchsBrewNextRoundBtn) witchsBrewNextRoundBtn.classList.add("hidden");
  [witchsBrewStage, witchsBrewHand, witchsBrewHandBar, witchsBrewHandOverlay,
    witchsBrewPublic, witchsBrewSpell, witchsBrewPlayers,
    witchsBrewSpellList, witchsBrewStackList, witchsBrewShelfList, witchsBrewRoleList, witchsBrewLog]
    .forEach((node) => {
      if (node) node.innerHTML = "";
    });
  if (witchsBrewStage) witchsBrewStage.classList.add("hidden");
  if (witchsBrewHandOverlay) witchsBrewHandOverlay.classList.add("hidden");
}

function showWitchsBrewHeaderActions(show) {
  if (witchsBrewHeaderActions) witchsBrewHeaderActions.style.display = show ? "flex" : "none";
  if (!show) {
    if (witchsBrewExplainWidget) witchsBrewExplainWidget.exit();
    witchsBrewHideTooltip();
  }
}

function renderWitchsBrewGameState(data) {
  const view = data.view || data.state || data;
  if (!view || view.game_id !== "witchs_brew") return;
  currentWitchsBrewView = view;
  if (view.phase !== "select_roles") witchsBrewSelectedRoles = new Set();
  witchsBrewResetTransient(view);
  renderWitchsBrewStrip(view);
  renderWitchsBrewStatus(view);
  renderWitchsBrewNotice(view);
  renderWitchsBrewStage(view);
  renderWitchsBrewHand(view);
  renderWitchsBrewPublic(view);
  renderWitchsBrewSpell(view);
  renderWitchsBrewPlayers(view);
  renderWitchsBrewReference(view);
  if (witchsBrewExplainWidget) witchsBrewExplainWidget.refresh();
  if (typeof logGameEvents === "function") logGameEvents(data);
}

if (witchsBrewNextRoundBtn) {
  witchsBrewNextRoundBtn.addEventListener("click", () => {
    if (!currentWitchsBrewView) return;
    if ((currentWitchsBrewView.legal_actions || []).includes("next_round")) {
      witchsBrewSend({ type: "next_round" });
    }
  });
}

/* ------------------------------------------------------------------ *
 * Tooltips: hover on desktop, tap for three seconds on touch
 * ------------------------------------------------------------------ */

function witchsBrewHideTooltip() {
  window.clearTimeout(witchsBrewTooltipTimer);
  witchsBrewTooltip.hidden = true;
}

function witchsBrewShowTooltip(target) {
  if (!target || !target.dataset.wbTip || document.body.classList.contains("obg-explaining")) return;
  witchsBrewTooltip.textContent = target.dataset.wbTip;
  witchsBrewTooltip.hidden = false;
  const bounds = target.getBoundingClientRect();
  const tip = witchsBrewTooltip.getBoundingClientRect();
  witchsBrewTooltip.style.left = Math.max(10, Math.min(bounds.left, window.innerWidth - tip.width - 10)) + "px";
  witchsBrewTooltip.style.top = Math.max(10, Math.min(bounds.bottom + 6, window.innerHeight - tip.height - 10)) + "px";
  window.clearTimeout(witchsBrewTooltipTimer);
  witchsBrewTooltipTimer = window.setTimeout(witchsBrewHideTooltip, 3000);
}

if (witchsBrewGamePanel) {
  witchsBrewGamePanel.addEventListener("pointerover", (event) => {
    if (event.pointerType === "mouse") witchsBrewShowTooltip(event.target.closest("[data-wb-tip]"));
  });
  witchsBrewGamePanel.addEventListener("pointerout", witchsBrewHideTooltip);
  witchsBrewGamePanel.addEventListener("click", (event) => {
    if (event.target.closest("button, summary")) return;
    witchsBrewShowTooltip(event.target.closest("[data-wb-tip]"));
  });
}

document.addEventListener("scroll", witchsBrewHideTooltip, true);
document.addEventListener("keydown", (event) => {
  if (currentGameType !== "witchs_brew" || event.key !== "Escape") return;
  witchsBrewHideTooltip();
  if (witchsBrewChoice) {
    witchsBrewChoice = null;
    renderWitchsBrewHand(currentWitchsBrewView);
  }
});

