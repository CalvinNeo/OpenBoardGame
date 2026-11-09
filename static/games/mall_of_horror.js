(() => {
  const byId = suffix => document.getElementById(`mallOfHorror${suffix}`);
  const panel = byId("Panel"), header = byId("HeaderActions"), dialog = byId("Dialog"), tooltip = byId("Tooltip");
  const colors = ["#efad78", "#8ec5eb", "#d5a5e9", "#a5cb83", "#e9a8b6", "#f0d477"];
  const phaseNames = {setup:"布置幸存者", cards:"行动牌窗口", vote:"秘密投票", distribute:"分配货车物资", camera:"查看监控", chief_destination:"队长公布目的地", destinations:"秘密选择目的地", revenge:"僵尸复仇", move:"移动一个角色", victim:"选择牺牲角色", round_review:"本轮回顾", game_over:"救援抵达"};
  const voteNames = {truck:"搜索货车", chief:"选举保安队长", victim:"选择牺牲者"};
  const cardStages = {threat:"投票前", camera:"监控阶段", sprint:"移动阶段", hardware:"攻击前", weapon1:"攻击前", weapon2:"攻击前", hide:"攻击前"};
  const explanations = {
    round:["Round · 轮次", "每轮依次搜索货车、选队长、监控、选择目的地、移动、攻击。整轮攻击全部结束后停留在回顾页，全员点击 Next Round 后才继续；断线玩家须重连，淘汰者也需要确认。"],
    chief:["Chief · 保安队长 🛡️", "保安室（📹）中的角色投票选队长。从队长起顺时针出牌和移动。只有本轮当选的队长可以免费看骰子，并必须先公开目的地；平票留任或无人选举的队长没有这项权限。"],
    forecast:["Surveillance · 监控 📹", "四枚秘密骰子决定本轮新增僵尸（🧟）的地点。当轮当选队长和使用监控（📹）的玩家可查看。所有目的地锁定后才向全员揭晓；关闭地点的骰子忽略。初始布置使用两枚公开骰子。"],
    location:["Location · 地点", "地点人数上限按角色个数计算，壮汉（💪）仍只占一格。移动时满员或刚关闭会转去停车场（🚗）。到达阶段空地点达到八只僵尸（🧟）会被永久关闭，停车场除外。"],
    character:["Survivor · 幸存者", "模特（👱）：7 分、1 防御、1 票；壮汉（💪）：5 分、2 防御、1 票；枪手（🔫）：3 分、1 防御、2 票；三人局另有小女孩（👧）：1 分、1 防御、1 票。选择后在操作区确认；点空白或 Esc 取消。"],
    stats:["Location stats · 地点状态", "🧟 僵尸、🛡️ 防御、👥 人数／容量。普通地点僵尸不少于防御即突破；停车场有僵尸就突破，超市四只以上必突破。危险状态按当前棋盘显示，秘密骰子和后续噪音可能改变结果。"],
    score:["Score · 生存分 ⭐", "终局将每位玩家幸存角色的分数相加；同分比较剩余行动牌，再相同则并列。角色总数不超过 4（六人局为 6），或所有角色聚集在同一非停车场地点，轮末救援抵达。"],
    cards:["Action cards · 行动牌 🃏", "共 21 张牌，每种三张，用后不回洗。威胁（✊）加票，监控（📹）看骰，冲刺（🏃）改目的地，加固（🪵）加防御，单杀（🔪）／双杀（🪓）消灭僵尸，躲藏（🫥）保护自己的一个角色。灰色牌在此时不可用。"],
    vote:["Vote · 投票 🗳️", "地点内未躲藏角色提供票数，枪手（🔫）两票；选择一位候选玩家，所有票一起投给他，可以投自己。全部提交后揭晓。平票仅最高票者重投，地点外每位玩家另获一票（含淘汰者），不再出牌。"],
    threat:["Threat · 威胁 ✊", "本次投票额外加一票，重投时仍有效。首次只有地点内有未躲藏角色的玩家能投票；地点外玩家要等平票重投才可使用这份加票。不能在首次投票和重投之间再出牌。"],
    camera:["Camera · 监控 📹", "在监控阶段轮到自己时使用，秘密查看本轮四枚骰子。可以口头声称结果，但界面不会替你向其他人公开。看完后 Pass，让下一位行动。"],
    sprint:["Sprint · 冲刺 🏃", "移动时使用一张，改往任意未关闭且有空位的地点，允许选择原地点。选择冲刺牌、角色和目的地后一起确认；不使用冲刺时必须按锁定目的地移动一个不同地点的角色。"],
    hardware:["Hardware · 加固 🪵", "当前地点本次攻击的防御增加一。不能在停车场（🚗）使用；超市（🛒）有四只及以上僵尸时也不能使用。效果在地点攻击完成后结束。"],
    weapon1:["Weapon · 单杀武器 🔪", "在当前受攻击地点立即消灭一只僵尸（🧟）。你必须有角色在该地点。出牌窗口结束后重新检查是否仍需投票牺牲。"],
    weapon2:["Weapon · 双杀武器 🪓", "在当前受攻击地点立即消灭至多两只僵尸（🧟）。你必须有角色在该地点。出牌窗口结束后重新检查是否仍需投票牺牲。"],
    hide:["Hidden · 躲藏 🫥", "选择自己在受攻击地点的一个角色。本轮该角色不能被牺牲、不能投票，但仍提供防御；停车场后续每次投票仍受保护。若只剩躲藏角色就无人被吃。普通地点未进食的僵尸保留。"],
    place:["Place · 布置", "选择自己的一个未布置角色，再选两枚公开骰子对应的可用地点。若两处均满或关闭，可选任意有空位的地点。每人按座位轮流放一个，全部放好后自动投初始四枚僵尸骰子。"],
    destination:["Destination · 目的地 📍", "先决定去哪里，骰子揭晓后再决定移动哪个角色。当轮当选队长先公开选择；其他人锁定后只显示提交状态。允许选择满员地点；移动时若仍满员则去停车场（🚗）。若所有角色都已在目的地，必须持有冲刺。"],
    move:["Move · 移动", "从保安队长起依次移动一个角色。必须从不同地点移动到事先选好的目的地；容量按实际轮到你时计算。冲刺（🏃）可改目的地或留在原地。移动完成后，人群最多与模特（👱）最多的唯一地点分别多来一只僵尸。"],
    sacrifice:["Sacrifice · 牺牲", "投票选中你的颜色后，由你决定失去该地点的哪个未躲藏角色。普通地点牺牲一个就清掉所有僵尸；停车场（🚗）每只僵尸分别投票吃一个。淘汰玩家仍可参加平票重投，并仅在下一轮放一只复仇僵尸。"],
    distribute:["Truck · 货车 🚚", "获选者秘密查看三张行动牌，留一张、送另一位玩家一张、第三张放回牌库底。接收者只看到自己收到的牌；其他人看不到具体牌。牌库不足三张时依次留一、送一，有剩余才放回。"],
    pass:["Pass · 结束出牌", "结束自己的本次出牌窗口，轮到下一位。一次窗口可以连续使用多张合法牌；Pass 后不能回头补牌。平票重投不再开启新的出牌窗口。"],
    ready:["Next Round", "确认已看完本轮结果。每位玩家（含淘汰玩家）都确认后开始下一轮，不会额外弹出确认框。其他人未确认时仍保留当前棋盘和结果。"],
    revenge:["Revenge · 复仇 🧟", "仅在淘汰后的下一轮、所有幸存玩家锁定目的地后，放一只僵尸到任意未关闭地点。这次机会用完即结束；以后仍可参加平票重投。"],
  };
  const MOH_EXPLAIN = {
    round: { zh: explanations.round[1], en: "Round: each round runs through searching the truck, electing the chief, surveillance, choosing destinations, moving and attacking. Once every attack is resolved the game waits on the review page until everyone presses Next Round, where a disconnected player must reconnect and eliminated players still confirm." },
    chief: { zh: explanations.chief[1], en: "Chief (🛡️): the characters in the security room (📹) vote for the chief. Play and movement start from the chief and go clockwise. Only the chief elected this round may read the dice for free and must announce a destination first, while a chief who kept the seat through a tie or was not elected has neither privilege." },
    forecast: { zh: explanations.forecast[1], en: "Surveillance (📹): four secret dice decide where this round's new zombies (🧟) appear. The chief elected this round and anyone playing the camera (📹) may look. Everything is revealed to the table only after all destinations are locked, and dice pointing at a closed location are ignored. Setup instead uses two public dice." },
    location: { zh: explanations.location[1], en: "Location: capacity counts characters, and the tough guy (💪) still takes only one slot. Moving into a full or newly closed location sends you to the parking lot (🚗). An empty location that reaches eight zombies (🧟) during the arrival phase closes permanently, except the parking lot." },
    character: { zh: explanations.character[1], en: "Survivor: the model (👱) is worth 7 points with 1 defense and 1 vote, the tough guy (💪) 5 points with 2 defense and 1 vote, and the gunner (🔫) 3 points with 1 defense and 2 votes, while a three player game adds the little girl (👧) at 1 point, 1 defense and 1 vote. Confirm your pick in the action area, and click blank space or press Esc to cancel." },
    stats: { zh: explanations.stats[1], en: "Location stats: 🧟 zombies, 🛡️ defense and 👥 occupants against capacity. A normal location is breached when zombies are at least equal to defense, the parking lot is breached by a single zombie, and the supermarket always breaks at four. Danger is shown from the current board, and the secret dice and later noise may still change the outcome." },
    score: { zh: explanations.score[1], en: "Score (⭐): at the end the points of each player's surviving characters are added up, ties are broken by remaining action cards and a remaining tie is shared. Rescue arrives at the end of a round once at most 4 characters remain, 6 in a six player game, or once every survivor shares one non parking location." },
    cards: { zh: explanations.cards[1], en: "Action cards (🃏): 21 cards in total, three of each kind, and they are never reshuffled. Threat (✊) adds a vote, camera (📹) reads the dice, sprint (🏃) changes your destination, hardware (🪵) adds defense, single kill (🔪) and double kill (🪓) destroy zombies, and hidden (🫥) protects one of your own characters. A greyed card cannot be used right now." },
    vote: { zh: explanations.vote[1], en: "Vote (🗳️): each character in the location that is not hidden provides votes and the gunner (🔫) gives two. Pick one candidate player and all of your votes go to them, including voting for yourself, and everything is revealed once all votes are in. A tie is rerun among the top candidates only, where every player outside the location including the eliminated gains one vote and no more cards may be played." },
    threat: { zh: explanations.threat[1], en: "Threat (✊): adds one extra vote to this vote and it still counts in a runoff. On the first vote only players with an unhidden character in the location may vote, and players outside the location can only use this extra vote in a tie runoff. You cannot play cards between the first vote and the runoff." },
    camera: { zh: explanations.camera[1], en: "Camera (📹): play it on your turn during the surveillance phase to look at this round's four dice in secret. You may claim anything out loud but the interface never reveals it for you, and you press Pass afterwards to let the next player act." },
    sprint: { zh: explanations.sprint[1], en: "Sprint (🏃): play one during movement to head for any open location with a free slot, including staying where you are. Confirm the sprint card, the character and the destination together, and without a sprint you must move a character from a different location to your locked destination." },
    hardware: { zh: explanations.hardware[1], en: "Hardware (🪵): adds one defense to the location under attack this time. It cannot be used in the parking lot (🚗), nor in the supermarket (🛒) once four or more zombies are there, and the effect ends when that location's attack is resolved." },
    weapon1: { zh: explanations.weapon1[1], en: "Weapon (🔪): destroy one zombie (🧟) immediately in the location currently under attack. You must have a character there, and whether a sacrifice vote is still needed is rechecked once the card window closes." },
    weapon2: { zh: explanations.weapon2[1], en: "Weapon (🪓): destroy up to two zombies (🧟) immediately in the location currently under attack. You must have a character there, and whether a sacrifice vote is still needed is rechecked once the card window closes." },
    hide: { zh: explanations.hide[1], en: "Hidden (🫥): choose one of your own characters in the location under attack. For this round that character cannot be sacrificed and cannot vote but still provides defense, and it stays protected through every later vote in the parking lot. If only hidden characters remain then nobody is eaten, and zombies that ate nobody at a normal location stay outside." },
    place: { zh: explanations.place[1], en: "Place: choose one of your unplaced characters, then one of the available locations matching the two public dice. If both are full or closed you may pick any location with a free slot. Players take turns in seat order placing one character each, and the four starting zombie dice are rolled once everyone is placed." },
    destination: { zh: explanations.destination[1], en: "Destination (📍): decide where to go first and which character moves only after the dice are revealed. The chief elected this round announces first and everyone else only shows a submitted state once locked. You may pick a full location, in which case you end up in the parking lot (🚗), and if all of your characters are already at the destination you must hold a sprint." },
    move: { zh: explanations.move[1], en: "Move: starting from the chief, each player moves one character from a different location to the destination chosen earlier, and capacity is judged at the moment your turn comes. A sprint (🏃) may change the destination or keep you in place. After movement the single location with the most people and the single location with the most models (👱) each attract one extra zombie." },
    sacrifice: { zh: explanations.sacrifice[1], en: "Sacrifice: once a vote picks your colour you decide which unhidden character you lose in that location. At a normal location one sacrifice clears every zombie, while in the parking lot (🚗) each zombie eats one character through its own vote. Eliminated players still join tie runoffs and place a single revenge zombie in the next round only." },
    distribute: { zh: explanations.distribute[1], en: "Truck (🚚): the chosen player secretly looks at three action cards, keeps one, gives one to another player and puts the third on the bottom of the deck. The receiver sees only their own card and nobody else sees any of them, and when fewer than three cards remain you keep one and give one in that order, returning a card only if one is left." },
    pass: { zh: explanations.pass[1], en: "Pass: end your card window and let the next player act. You may play several legal cards in one window, and once you pass you cannot come back. A tie runoff never opens a new card window." },
    ready: { zh: explanations.ready[1], en: "Next Round: confirm that you have read the round result. The next round starts once every player including the eliminated has confirmed, with no extra confirmation dialog, and the board and result stay on screen while others are still deciding." },
    revenge: { zh: explanations.revenge[1], en: "Revenge (🧟): only in the round right after your elimination and only once every surviving player has locked a destination, you place one zombie in any location that is not closed. That single chance is all you get, though you may still join tie runoffs afterwards." },
    dialog_close: { zh: "关闭当前对话框并回到商场。", en: "Close the current dialog and return to the mall." }
  };
  const MOH_HELP_CONFIG = {
    gameId: "mall_of_horror",
    title: { zh: "僵尸商场 · Mall of Horror", en: "Mall of Horror" },
    basic: {
      win: {
        zh: "各自保护自己的队伍并活到最后。终局把每位玩家幸存角色的分数相加，最高者获胜，同分比较剩余行动牌，再同分则并列。",
        en: "Protect your own team and survive. At the end the points of each player's surviving characters are added up, the highest wins, ties are broken by remaining action cards and a remaining tie is shared."
      },
      turn: {
        zh: "每轮先在停车场投票选人搜索货车(🚚)、在保安室投票选队长(🛡️)，然后秘密选目的地(📍)、移动角色、依次出牌，最后对突破的地点投票决定谁失去角色。",
        en: "Each round the parking lot votes someone to search the truck (🚚), the security room votes for the chief (🛡️), then everyone secretly picks a destination (📍), moves a character, plays cards in turn, and finally votes at any breached location over who loses a character."
      },
      key: {
        zh: "手牌和秘密骰子只能口头描述而不能出示，所以真正的博弈在于用投票和承诺把僵尸(🧟)引到别人的地点，同时保住自己分数最高的角色。",
        en: "Hands and secret dice may only be described out loud and never shown, so the real game is using votes and promises to steer zombies (🧟) onto someone else's location while keeping your own highest scoring characters alive."
      }
    },
    sections: [
      {
        id: "survive",
        label: { zh: "在商场里活下来", en: "Survive the mall" },
        html: {
          zh: "<p>3 到 6 人各自保护自己的队伍，可以谈判、许诺和诈唬。手牌和秘密骰子只可口头描述，不得出示，除货车分牌外不可交易。</p><p>初始队长为第一座位，每人一张行动牌。按座位轮流掷两骰放一个角色，全部放好后投四骰放初始僵尸(🧟)。</p>",
          en: "<p>For 3 to 6 players, each protecting their own team while negotiating, promising and bluffing. Hands and secret dice may only be described out loud, never shown, and nothing may be traded except the cards from the truck.</p><p>The first seat starts as chief and everyone gets one action card. In seat order each player rolls two dice to place one character, and once everyone is placed four dice are rolled for the starting zombies (🧟).</p>"
        }
      },
      {
        id: "characters",
        label: { zh: "角色与胜利", en: "Characters and victory" },
        html: {
          zh: "<p>模特(👱)7 分 1 防御 1 票，壮汉(💪)5 分 2 防御 1 票，枪手(🔫)3 分 1 防御 2 票。三人局加小女孩(👧)1 分 1 防御 1 票，采用英文基础版数值，没有额外免死能力。</p><p>轮末只剩 4 个角色（六人局为 6），或所有幸存角色同处一个非停车场地点时结束。生存分最高者胜，同分比较剩余行动牌，再同分则并列。</p>",
          en: "<p>The model (👱) is worth 7 points with 1 defense and 1 vote, the tough guy (💪) 5 points with 2 defense and 1 vote, and the gunner (🔫) 3 points with 1 defense and 2 votes. A three player game adds the little girl (👧) at 1 point, 1 defense and 1 vote, using the English base game values with no extra immunity.</p><p>The round ends when at most 4 characters remain, 6 in a six player game, or when every survivor shares one non parking location. The highest survival score wins, ties are broken by remaining action cards and a remaining tie is shared.</p>"
        }
      },
      {
        id: "map",
        label: { zh: "商场地图", en: "The mall map" },
        html: {
          zh: "<p>① 洗手间(🚻)3 格，② 服装店(👕)4 格且 3 或 4 人时关闭，③ 玩具店(🧸)4 格，④ 停车场(🚗)不限，⑤ 保安室(📹)3 格，⑥ 超市(🛒)6 格。每个角色占一格。</p><p>空地点在僵尸到达阶段达到 8 只即关闭并清走僵尸，停车场永不关闭。</p>",
          en: "<p>① Restroom (🚻) with 3 slots, ② Clothing store (👕) with 4 slots and closed in 3 or 4 player games, ③ Toy store (🧸) with 4 slots, ④ Parking lot (🚗) with no limit, ⑤ Security room (📹) with 3 slots and ⑥ Supermarket (🛒) with 6 slots. Each character takes one slot.</p><p>An empty location that reaches 8 zombies during the arrival phase closes and its zombies are cleared, while the parking lot never closes.</p>"
        }
      },
      {
        id: "round",
        label: { zh: "一轮的流程", en: "A round" },
        html: {
          zh: "<p>停车场先投票选人搜索货车(🚚)：取三张、留一张、送另一玩家一张、第三张放牌库底，牌不足三张则按留一、送一的顺序处理。保安室随后投票选保安队长(🛡️)。</p><p>秘密投四枚僵尸骰子，仅当轮当选队长能免费看，其他玩家可按序用监控(📹)。当选队长先公开目的地(📍)，其余玩家同时秘密选择。所有人锁定后，满足条件的淘汰者放复仇僵尸，再同时揭晓骰子与目的地。</p><p>从队长起，每人选自己的一个角色移动到锁定地点，原地点必须不同。若目的地满员或刚关闭则转去停车场，冲刺(🏃)可改去任意有空位的地点，也可留在原处。移动后，人群最多的唯一地点和模特最多的唯一地点各吸引一只额外僵尸，平手不吸引。</p>",
          en: "<p>The parking lot first votes for someone to search the truck (🚚): draw three, keep one, give one to another player and put the third on the bottom of the deck, or when fewer than three remain just keep one and give one. The security room then votes for the chief (🛡️).</p><p>Four zombie dice are rolled in secret. Only the chief elected this round reads them for free while other players may use the camera (📹) in turn. The chief announces a destination (📍) first and everyone else chooses in secret at the same time. Once all are locked, an eligible eliminated player places a revenge zombie, and then the dice and destinations are revealed together.</p><p>Starting from the chief, each player moves one of their characters to the locked destination from a different location. A full or newly closed destination sends you to the parking lot, and a sprint (🏃) may redirect you to any location with a free slot or keep you in place. After movement the single location with the most people and the single location with the most models each attract one extra zombie, with no attraction on a tie.</p>"
        }
      },
      {
        id: "attack",
        label: { zh: "攻击与投票", en: "Attacks and votes" },
        html: {
          zh: "<p>依序检查 1 到 6 号地点。普通地点僵尸数不少于防御时突破，停车场一只就突破，超市四只就突破且无论防御多少。</p><p>先从队长起依次出牌，每人可出多张再 Pass，窗口结束后再检查突破。若仍突破，地点内玩家秘密投票选哪位玩家失去一个角色，可投自己，被选玩家自己挑一个未躲藏角色牺牲。</p><p>票数等于自己的未躲藏角色票数加威胁(✊)加票，所有票投同一人。首次平票仅最高票者重投，地点外玩家含淘汰者各有一票，威胁延续且不可再出牌。第二次平票则货车无人分牌、队长留任、牺牲在并列玩家中等概率抽签。</p><p>普通地点牺牲一个角色后清走全部僵尸，没吃到人则留在门外。停车场每只僵尸吃一个人，逐次投票与出牌，最后清走残余僵尸。躲藏保护整个攻击阶段。角色全部淘汰后仍能参与平票重投，并且仅在下一轮获得一次放置复仇僵尸的机会。</p>",
          en: "<p>Locations 1 to 6 are checked in order. A normal location is breached when zombies are at least equal to defense, the parking lot is breached by a single zombie, and the supermarket breaks at four regardless of defense.</p><p>Cards are played first, starting from the chief, where each player may play several and then pass, and the breach is rechecked once the window closes. If it still breaks, the players in that location secretly vote for which player loses a character, including voting for themselves, and the chosen player picks which of their unhidden characters to sacrifice.</p><p>Your votes equal the votes of your unhidden characters plus any threat (✊) bonus, and all of them go to one player. A first tie is rerun among the top candidates only, where every player outside the location including the eliminated gets one vote, threats carry over and no more cards may be played. A second tie means nobody distributes from the truck, the chief keeps the seat and the sacrifice is drawn at random among the tied players.</p><p>At a normal location one sacrifice clears every zombie, while zombies that ate nobody stay outside. In the parking lot each zombie eats one person through its own vote and card window, and the leftovers are cleared at the end. Hidden protects a character for the whole attack phase. Once all of your characters are gone you can still join tie runoffs and you gain a single revenge zombie placement in the next round only.</p>"
        }
      },
      {
        id: "cards",
        label: { zh: "行动牌", en: "Action cards" },
        html: {
          zh: "<p>七种各三张，共 21 张，用后不回洗。</p><p>威胁(✊)给本次投票和重投加一票，监控(📹)秘密看骰，冲刺(🏃)在移动时改地点，加固(🪵)防御加一且停车场和超市四只以上僵尸时不适用，单杀(🔪)消灭一只、双杀(🪓)至多两只，躲藏(🫥)使自己的一个角色不能被牺牲也不能投票但仍提供防御。</p>",
          en: "<p>Three of each of seven kinds for 21 cards, and they are never reshuffled.</p><p>Threat (✊) adds one vote to this vote and its runoff, camera (📹) reads the dice in secret, sprint (🏃) changes your location during movement, hardware (🪵) adds one defense but not in the parking lot or a supermarket with four or more zombies, single kill (🔪) destroys one zombie and double kill (🪓) up to two, and hidden (🫥) makes one of your characters unable to be sacrificed or to vote while still providing defense.</p>"
        }
      },
      {
        id: "controls",
        label: { zh: "操作与回顾", en: "Controls and review" },
        html: {
          zh: "<p>点选角色、地点或牌，再点击对应确认按钮，空白处或 Esc 取消。每轮全部攻击结算后，全员点击 Next Round 才继续，淘汰者也需要确认，断线真人须重连。</p><p>Help 汇总规则，Explain 点选解释且禁用按钮也可查看，按 Esc 退出。静态信息可悬停、聚焦或手机点击查看，点击提示 3 秒后消失。机器人只用自己的手牌和公共信息，适合练习。</p>",
          en: "<p>Select a character, a location or a card, then press the matching confirm button, and click blank space or press Esc to cancel. After every attack in a round is resolved, play continues only once everyone presses Next Round, where eliminated players must confirm too and a disconnected human must reconnect.</p><p>Help gathers the rules while Explain describes anything you tap including disabled buttons, and Esc leaves it. Static information can be hovered, focused or tapped on a phone, and a tapped tip disappears after 3 seconds. Bots use only their own hand and public information, which makes them good practice.</p>"
        }
      }
    ]
  };
  let mallOfHorrorHelpWidget = null;
  let mallOfHorrorExplainWidget = null;
  function initMallOfHorrorHelpExplain() {
    if (mallOfHorrorHelpWidget || typeof window.obgCreateHelp !== "function") return;
    mallOfHorrorHelpWidget = window.obgCreateHelp(MOH_HELP_CONFIG);
    mallOfHorrorExplainWidget = window.obgCreateExplain({
      gameId: "mall_of_horror",
      attribute: "data-moh-explain",
      explanations: MOH_EXPLAIN,
      button: byId("ExplainBtn"),
      root: () => panel,
      bypass: ["#mallOfHorrorHelpBtn", "#mallOfHorrorExplainBtn", "#mallOfHorrorDialogClose"]
    });
    byId("HelpBtn")?.addEventListener("click", () => {
      mallOfHorrorExplainWidget?.exit();
      mallOfHorrorHelpWidget.open();
    });
    byId("ExplainBtn")?.addEventListener("click", () => mallOfHorrorExplainWidget?.toggle());
  }

  let view = null, selected = {}, signature = null, pending = false, pendingTimer, tipTimer, wasUrgent = false;
  let returnFocus;
  const el = (tag, cls = "", value = "") => { const node = document.createElement(tag); node.className = cls; node.textContent = value; return node; };
  const text = (suffix, value) => { byId(suffix).textContent = value; };
  const player = pid => view?.players.find(p => p.player_id === pid);
  const name = pid => player(pid)?.name || "—";
  const seatColor = pid => colors[(player(pid)?.seat || 0) % colors.length];
  const shortName = pid => { const chars = Array.from(name(pid)); return chars.length > 12 ? `${chars.slice(0, 5).join("")}…${chars.slice(-3).join("")}` : chars.join(""); };
  const place = number => view?.locations.find(loc => loc.id === number);
  const placeLabel = number => { const loc = place(number); return loc ? `${loc.id} ${loc.emoji} ${loc.name}` : "—"; };
  const can = kind => !!view && !pending && socket.connected && view.legal_actions.includes(kind);
  const charLabel = c => `${c.emoji} ${c.name} · ${c.points}⭐`;
  const cardLabel = c => `${c.emoji} ${c.name}`;
  function tip(node, value, key) { node.dataset.mohTip = value; node.tabIndex = 0; if (key) node.dataset.mohExplain = key; return node; }
  function button(label, key, callback, enabled = true, cls = "") {
    const node = el("button", cls, label); node.type = "button"; node.dataset.mohExplain = key; node.disabled = !enabled;
    node.addEventListener("click", callback); return node;
  }
  function chosenButton(label, key, field, value, enabled = true, cls = "") {
    const node = button(label, key, () => { selected[field] = selected[field] === value ? null : value; render(); }, enabled, cls);
    node.classList.toggle("is-selected", selected[field] === value); node.setAttribute("aria-pressed", String(selected[field] === value)); return node;
  }
  function dispatch(kind, fields = {}) {
    if (!can(kind)) return;
    pending = true; hideTip(); clearTimeout(pendingTimer);
    pendingTimer = setTimeout(() => { pending = false; render(); }, 5000);
    sendAction({type:kind, game_token:view.game_token, step:view.step, ...fields}); render();
  }
  function ownCharacters() { return view.characters.filter(c => c.alive && c.owner === view.you); }
  function characterEnabled(c) {
    if (c.owner !== view.you || !c.alive || pending || !socket.connected) return false;
    if (can("place")) return c.location === null;
    if (can("move")) return view.move_options.some(o => o.character_id === c.id);
    if (can("sacrifice")) return view.victim_options.includes(c.id);
    const option = view.card_options.find(o => o.card_id === selected.cardId);
    return can("play_card") && !!option?.character_ids.includes(c.id);
  }
  function makeCharacter(c) {
    const node = chosenButton("", "character", "characterId", c.id, characterEnabled(c), `moh-character${c.hidden ? " is-hidden" : ""}`);
    node.dataset.characterId = c.id; node.style.setProperty("--seat-color", seatColor(c.owner));
    node.append(el("span", "moh-char-glyph", c.emoji), el("span", "moh-char-seat", String(player(c.owner).seat + 1)), el("span", "moh-char-points", `${c.points}⭐`));
    if (c.hidden) node.append(el("span", "moh-char-flag", "🫥"));
    node.setAttribute("aria-label", `${name(c.owner)} · ${charLabel(c)}${c.hidden ? " · Hidden" : ""}`);
    node.dataset.mohTip = `${name(c.owner)} · ${c.name}（${c.emoji}）：${c.points} 分，${c.strength} 防御，${c.hidden ? 0 : c.votes} 票。${c.hidden ? "本轮躲藏：不能被牺牲。" : ""}`;
    return node;
  }
  function ruleFor(loc) {
    if (loc.closed) return loc.id === 2 ? {chip:"🚫 3/4人", text:"3／4 人局关闭。", special:true} : {chip:"🚫 关闭", text:"该地点已永久关闭，僵尸已被清走。", special:true};
    if (loc.id === 4) return {chip:"🧟≥1", text:"停车场有僵尸就突破，每只僵尸单独投票选一个牺牲者。", special:true};
    if (loc.id === 6) return {chip:"🧟≥4", text:"超市有四只及以上僵尸必定突破，加固无效。", special:true};
    if (loc.id === 5) return {chip:"🗳️ 队长", text:"保安室内的角色投票选举本轮保安队长。", special:true};
    return {chip:"🧟≥🛡️", text:"僵尸数不少于防御时突破。", special:false};
  }
  function destinationEnabled(number) {
    if (can("place")) return view.setup_locations.includes(number);
    if (can("choose_destination")) return view.destination_options.includes(number);
    if (can("place_zombie")) return !place(number).closed;
    if (can("move") && selected.sprintId) return view.move_options.some(o => o.sprint_card_id === selected.sprintId && o.destination === number && (!selected.characterId || o.character_id === selected.characterId));
    return false;
  }
  function renderMap() {
    const map = byId("Map"); map.replaceChildren();
    view.locations.forEach(loc => {
      const area = el("article", `moh-location${loc.closed ? " is-closed" : ""}${loc.breached ? " is-threatened" : ""}${view.vote?.location === loc.id && ["cards", "vote", "victim"].includes(view.phase) ? " is-active" : ""}`);
      area.dataset.location = loc.id;
      const title = chosenButton("", "location", "destination", loc.id, destinationEnabled(loc.id), "moh-location-name");
      title.append(el("span", "moh-location-number", loc.id), el("span", "moh-location-label", `${loc.emoji} ${loc.name}`));
      const rule = ruleFor(loc);
      title.dataset.mohDetail = `${placeLabel(loc.id)}：容量 ${loc.capacity ?? "不限"}。${rule.text}${explanations.location[1]}`;
      title.dataset.mohTip = `${loc.name}（${loc.emoji}）：容量 ${loc.capacity ?? "不限"}。${rule.text}`;
      area.append(title);
      const stats = el("div", "moh-location-stats");
      stats.append(tip(el("span", loc.breached ? "moh-alert" : "", `🧟 ${loc.zombies}`), `Zombies（🧟）：门外有 ${loc.zombies} 只僵尸。`, "stats"));
      stats.append(tip(el("span", "", `🛡️ ${loc.strength}${view.attack_location === loc.id && view.defense_bonus ? ` +${view.defense_bonus}` : ""}`), "Defense（🛡️）：壮汉提供 2，其余角色提供 1；躲藏仍提供防御。", "stats"));
      const full = loc.capacity !== null && loc.occupants >= loc.capacity;
      stats.append(tip(el("span", full ? "moh-full" : "", `👥 ${loc.occupants}/${loc.capacity ?? "∞"}`), `Capacity（👥）：每个角色占一格，${full ? "当前已满员。" : ""}∞ 表示人数不限。`, "location"));
      stats.append(tip(el("span", `moh-location-rule${rule.special ? " is-special" : ""}`, rule.chip), `${loc.emoji} ${loc.name}：${rule.text}`, "location"));
      area.append(stats);
      const occupants = el("div", "moh-occupants");
      view.characters.filter(c => c.alive && c.location === loc.id).forEach(c => occupants.append(makeCharacter(c)));
      if (!occupants.childElementCount) occupants.append(el("span", "moh-empty", loc.closed ? "CLOSED" : "No survivors"));
      area.append(occupants); map.append(area);
    });
  }
  function renderPlayers() {
    const node = byId("Players"); node.replaceChildren();
    view.players.forEach(p => {
      const block = el("div", `moh-player${p.player_id === view.you ? " is-you" : ""}${!p.survivors ? " is-out" : ""}`);
      block.style.setProperty("--seat-color", seatColor(p.player_id));
      block.append(el("strong", "", `${p.seat + 1} ${p.player_id === view.chief ? "🛡️" : ""} ${p.name}${p.player_id === view.you ? " · You" : ""}`));
      block.append(el("small", "", `${p.points}⭐ ${p.survivors}👥 ${p.cards}🃏${view.ready.includes(p.player_id) ? " ✓" : ""}`));
      tip(block, `${p.name}：生存分（⭐）${p.points}，幸存角色（👥）${p.survivors}，手牌（🃏）${p.cards}。${!p.survivors ? "仍可参加平票重投。" : ""}`, "score"); node.append(block);
    });
  }
  function choices(container, label, items, key, field) {
    container.append(el("div", "moh-choice-label", label)); const row = el("div", "moh-choices");
    items.forEach(([value, text]) => row.append(chosenButton(text, key, field, value, !pending && socket.connected)));
    container.append(row); return row;
  }
  function charChoices(container, chars, label = "Choose a survivor") {
    container.append(el("div", "moh-choice-label", label)); const row = el("div", "moh-choices");
    chars.forEach(c => { const b = chosenButton(charLabel(c), "character", "characterId", c.id, characterEnabled(c)); b.dataset.characterId = c.id; row.append(b); });
    container.append(row);
  }
  function locationChoices(container, numbers) { choices(container, "Choose a destination", numbers.map(n => [n, placeLabel(n)]), "destination", "destination"); }
  function renderControls() {
    const node = byId("Controls"); node.replaceChildren(); text("ActionTitle", phaseNames[view.phase]); text("Step", pending ? "Sending…" : "");
    const urgent = !!view.legal_actions.length && !!player(view.you) && view.phase !== "game_over";
    if (urgent && !wasUrgent) setDockCollapsed(false);
    wasUrgent = urgent; byId("Command").classList.toggle("is-urgent", urgent);
    const own = ownCharacters();
    if (!socket.connected) { node.append(el("div", "moh-locked", "Reconnecting…")); return; }
    if (view.phase === "game_over") { node.append(el("p", "", "Game complete. Use Start Game in room controls to play again.")); return; }
    if (view.phase === "round_review") {
      node.append(el("p", "", `${view.ready.length} / ${view.players.length} ready`));
      const next = button(view.ready.includes(view.you) ? "Ready · waiting for others" : "Next Round", "ready", () => dispatch("next_round"), can("next_round"), "moh-primary"); next.id = "mallOfHorrorNext"; node.append(next); return;
    }
    if (can("place")) {
      node.append(el("p", "", `公开骰子：${view.setup_dice.join(" · ")}`));
      charChoices(node, own.filter(c => c.location === null)); locationChoices(node, view.setup_locations);
      node.append(button("Place survivor", "place", () => dispatch("place", {character_id:selected.characterId, destination:selected.destination}), !!selected.characterId && view.setup_locations.includes(selected.destination), "moh-primary")); return;
    }
    if (can("distribute")) {
      choices(node, "Keep one card", view.loot.map(c => [c.id, cardLabel(c)]), "distribute", "keepId");
      if (view.loot.length > 1) {
        choices(node, "Give one card", view.loot.map(c => [c.id, cardLabel(c)]), "distribute", "giveId");
        choices(node, "Choose a recipient", view.players.filter(p => p.player_id !== view.you).map(p => [p.player_id, p.name]), "distribute", "recipientId");
      }
      const valid = !!selected.keepId && (view.loot.length === 1 || (selected.giveId && selected.keepId !== selected.giveId && selected.recipientId));
      node.append(button("Distribute cards", "distribute", () => dispatch("distribute", {keep_id:selected.keepId, give_id:view.loot.length > 1 ? selected.giveId : null, recipient_id:view.loot.length > 1 ? selected.recipientId : null}), valid, "moh-primary")); return;
    }
    if (can("vote")) {
      node.append(el("p", "", `${voteNames[view.vote.kind]} · ${placeLabel(view.vote.location)}${view.vote.runoff ? " · 重投" : ""} · 你有 ${view.vote.weights[view.you]} 票`));
      choices(node, "Choose a player", view.vote.candidates.map(p => [p, name(p)]), "vote", "targetId");
      node.append(button("Lock vote", "vote", () => dispatch("vote", {target_id:selected.targetId}), view.vote.candidates.includes(selected.targetId), "moh-primary")); return;
    }
    if (can("choose_destination") || can("place_zombie")) {
      const revenge = can("place_zombie"), kind = revenge ? "place_zombie" : "choose_destination";
      const nums = revenge ? view.locations.filter(l => !l.closed).map(l => l.id) : view.destination_options;
      if (view.phase === "chief_destination") node.append(el("p", "", "你当轮当选队长，先公布目的地。"));
      else if (!revenge) node.append(el("p", "", "锁定地点；揭晓后再选移动哪个角色。"));
      locationChoices(node, nums);
      node.append(button(revenge ? "Place zombie" : view.phase === "chief_destination" ? "Announce destination" : "Lock destination", revenge ? "revenge" : "destination", () => dispatch(kind, {destination:selected.destination}), nums.includes(selected.destination), "moh-primary")); return;
    }
    if (can("move")) {
      const pledge = view.destinations[view.you];
      node.append(el("p", "", `锁定目的地：${placeLabel(pledge)}${selected.sprintId ? " · 🏃 冲刺" : ""}`));
      charChoices(node, own.filter(c => view.move_options.some(o => o.character_id === c.id)));
      if (selected.sprintId) {
        const nums = [...new Set(view.move_options.filter(o => o.sprint_card_id === selected.sprintId && (!selected.characterId || o.character_id === selected.characterId)).map(o => o.destination))]; locationChoices(node, nums);
      }
      const dest = selected.sprintId ? selected.destination : pledge;
      const option = view.move_options.find(o => o.character_id === selected.characterId && o.destination === dest && o.sprint_card_id === (selected.sprintId || null));
      if (option) node.append(el("p", "", `实际到达：${placeLabel(option.actual_destination)}${option.actual_destination !== dest ? "（原目的地不可进入）" : ""}`));
      node.append(button("Move survivor", "move", () => dispatch("move", {character_id:selected.characterId, destination:dest, sprint_card_id:selected.sprintId || null}), !!option, "moh-primary")); return;
    }
    if (can("sacrifice")) {
      node.append(el("p", "", `在${placeLabel(view.vote.location)}失去一个角色。`));
      charChoices(node, own.filter(c => view.victim_options.includes(c.id)));
      node.append(button("Sacrifice survivor", "sacrifice", () => dispatch("sacrifice", {character_id:selected.characterId}), view.victim_options.includes(selected.characterId), "moh-danger-button")); return;
    }
    if (can("pass")) {
      node.append(el("p", "", view.phase === "camera" ? "可使用监控（📹），或 Pass 继续。" : `${voteNames[view.vote.kind]} · ${placeLabel(view.vote.location)} · 可用牌已高亮。`));
      const card = view.hand.find(c => c.id === selected.cardId), option = view.card_options.find(o => o.card_id === selected.cardId);
      if (card && option) {
        const selection = el("div", "moh-selection"); selection.append(el("strong", "", cardLabel(card)), el("p", "", card.text));
        if (option.character_ids.length) charChoices(selection, own.filter(c => option.character_ids.includes(c.id)), "Choose who hides");
        const valid = !option.character_ids.length || option.character_ids.includes(selected.characterId);
        selection.append(button("Use card", card.kind, () => dispatch("play_card", {card_id:card.id, character_id:option.character_ids.length ? selected.characterId : null}), valid, "moh-primary")); node.append(selection);
      }
      const pass = button("Pass", "pass", () => dispatch("pass"), true); pass.id = "mallOfHorrorPass"; node.append(pass); return;
    }
    let message = view.current_turn ? `Waiting for ${name(view.current_turn)}` : "Waiting for other players";
    if (view.phase === "destinations" && view.destination_submitted.includes(view.you)) message = `🔒 Locked · ${placeLabel(view.destinations[view.you])}`;
    if (view.phase === "vote" && view.vote?.submitted.includes(view.you)) message = `🔒 Locked · ${name(view.vote.your_vote)}`;
    if (!player(view.you)) message = "Spectating";
    node.append(el("div", "moh-locked", message));
    if (view.phase === "vote") node.append(el("p", "", `${view.vote.submitted.length} / ${Object.keys(view.vote.weights).length} votes locked`));
    if (view.phase === "destinations") node.append(el("p", "", `${view.destination_submitted.length} / ${view.players.filter(p => p.survivors).length} destinations locked`));
  }
  function renderHand() {
    const hand = byId("Hand"); hand.replaceChildren(); text("HandTitle", player(view.you) ? "Your cards · private" : "Spectating");
    text("Deck", `🃏 ${view.deck_count} left`); byId("Deck").dataset.mohTip = `Deck（🃏）：牌库剩 ${view.deck_count} 张，已使用 ${view.discard_count} 张，不回洗。`;
    view.hand.forEach(card => {
      const sprint = card.kind === "sprint" && can("move");
      const enabled = sprint || (can("play_card") && view.card_options.some(o => o.card_id === card.id));
      const key = sprint ? "sprintId" : "cardId";
      const node = button("", card.kind, () => { selected[key] = selected[key] === card.id ? null : card.id; if (sprint) selected.destination = null; else selected.characterId = null; render(); }, enabled, "moh-card");
      node.dataset.cardId = card.id; node.dataset.mohTip = `${card.name}（${card.emoji}）：${card.text}`;
      node.classList.toggle("is-selected", selected[key] === card.id); node.setAttribute("aria-pressed", String(selected[key] === card.id));
      node.append(el("span", "moh-card-glyph", card.emoji), el("span", "moh-card-stage", cardStages[card.kind]), el("span", "moh-card-name", card.name)); hand.append(node);
    });
    if (!view.hand.length) hand.append(el("p", "moh-empty", "No cards"));
  }
  function renderIntel() {
    const setup = view.phase === "setup", dice = setup ? view.setup_dice : view.forecast;
    const known = Array.isArray(dice) && dice.length > 0;
    text("IntelLabel", !known ? "HIDDEN" : setup || view.revealed ? "REVEALED" : "PRIVATE");
    const node = byId("Dice"); node.replaceChildren();
    (known ? dice : [null,null,null,null]).forEach(value => node.append(el("span", `moh-die${value === null ? " is-hidden" : ""}`, value === null ? "?" : value)));
    node.dataset.mohTip = setup ? "Setup dice（🎲）：选择对应的可用地点布置。" : !known ? "Hidden（🔒）：秘密骰子尚未揭晓。" : view.revealed ? "僵尸骰子已公开，并已加入棋盘。" : "Private（🔒）：仅你能看到；目前尚未放置到棋盘。";
    const destinations = byId("Destinations"); destinations.replaceChildren();
    view.players.filter(p => p.survivors).forEach(p => {
      if (!view.destination_submitted.includes(p.player_id)) return;
      const n = view.destinations[p.player_id];
      const label = `${shortName(p.player_id)} → ${n ? `${n} ${place(n).emoji}` : "🔒"}`;
      const tag = tip(el("span", "moh-destination", label), n ? `${p.name}：${placeLabel(n)}` : `${p.name}：目的地已锁定，尚未公开。`, "destination");
      tag.style.setProperty("--seat-color", seatColor(p.player_id)); destinations.append(tag);
    });
  }
  function renderReview() {
    const review = byId("Review"); review.replaceChildren(); review.classList.toggle("hidden", !view.round_result);
    if (view.round_result) {
      review.append(tip(el("h3", "", view.game_over ? `🏆 ${view.winner_ids.map(name).join(" · ")}` : `Round ${view.round} complete`), "Winner（🏆）：生存分最高者获胜；同分比较手牌张数。", "score"));
      review.append(el("p", "", view.round_result.reason || "查看本轮结果；全员确认后继续。"));
      const scores = el("div", "moh-review-scores");
      view.round_result.scores.forEach(s => scores.append(tip(el("span", "", `${name(s.player_id)} · ${s.points}⭐ · ${s.survivors}👥 · ${s.cards}🃏`), "Score（⭐）生存分 · Survivors（👥）幸存角色 · Cards（🃏）剩余手牌。", "score"))); review.append(scores);
      const events = view.round_result.log.filter(item => /牺牲|封锁|抵挡/.test(item.text));
      review.append(el("p", "", events.length ? events.map(item => item.text).join(" ") : "本轮没有角色牺牲。"));
    }
    const log = byId("Log"); log.replaceChildren();
    view.log.slice().reverse().forEach(item => log.append(el("li", "", `R${item.round} · ${item.text}`)));
    const result = byId("VoteResult"); result.replaceChildren(); const vote = view.last_vote;
    if (vote) {
      result.append(el("strong", "", `${voteNames[vote.kind]} · ${placeLabel(vote.location)} · ${vote.winner ? name(vote.winner) : "平票"}${vote.random ? "（随机选定）" : ""}`));
      vote.history.forEach((round,i) => result.append(el("div", "", `${i ? "重投" : "首次"}：${Object.entries(round.ballots).map(([pid,target]) => `${name(pid)} → ${name(target)} ×${round.weights[pid]}`).join("；")}`)));
    }
  }
  function render() {
    if (!view) return;
    const scroll = ["Controls", "Hand", "Log"].map(id => [id, byId(id).scrollTop]);
    text("Round", view.phase === "setup" ? "SETUP" : `ROUND ${String(view.round).padStart(2,"0")}`);
    const acting = !!view.legal_actions.length && !!player(view.you) && view.phase !== "game_over";
    const status = !player(view.you) ? "👀 Spectating" : acting ? "🎯 Your turn" : view.current_turn ? `⏳ Waiting for ${shortName(view.current_turn)}` : "⏳ Waiting for other players";
    text("Status", status); byId("Status").classList.toggle("is-you", acting);
    text("Chief", `🛡️ ${shortName(view.chief)}`);
    byId("Chief").dataset.mohTip = `Chief（🛡️）：${name(view.chief)}。${view.elected ? "当轮当选，可免费看骰子。" : "本轮尚未当选，不享有免费看骰子的权限。"}`;
    const survivors = view.characters.filter(c => c.alive).length;
    text("Remaining", `👥 ${survivors} survivors`); byId("Remaining").dataset.mohTip = `Survivors（👥）：现有 ${survivors} 人；不超过 ${view.players.length === 6 ? 6 : 4} 人时轮末救援抵达。`;
    renderPlayers(); renderMap(); renderControls(); renderIntel(); renderHand(); renderReview();
    scroll.forEach(([id, top]) => { byId(id).scrollTop = top; });
  }
  function hideTip() { clearTimeout(tipTimer); tooltip.classList.add("hidden"); }
  function showTip(target, autoHide = false) {
    if (!target || mallOfHorrorExplainWidget?.isActive() || mallOfHorrorHelpWidget?.isOpen() || dialog.open) return;
    clearTimeout(tipTimer); tooltip.textContent = target.dataset.mohTip; tooltip.classList.remove("hidden");
    const r = target.getBoundingClientRect(), box = tooltip.getBoundingClientRect();
    tooltip.style.left = `${Math.max(12, Math.min(r.left, innerWidth - box.width - 12))}px`;
    tooltip.style.top = `${r.bottom + box.height + 12 < innerHeight ? r.bottom + 6 : Math.max(12, r.top - box.height - 6)}px`;
    if (autoHide) tipTimer = setTimeout(hideTip, 3000);
  }
  function setDockCollapsed(value) {
    byId("Command").classList.toggle("is-collapsed", value);
    byId("DockToggle").setAttribute("aria-expanded", String(!value));
    text("DockToggle", value ? "Show" : "Hide");
  }
  byId("DockToggle").addEventListener("click", () => setDockCollapsed(!byId("Command").classList.contains("is-collapsed")));
  byId("DialogClose").addEventListener("click", () => dialog.close());
  dialog.addEventListener("close", () => { if (returnFocus?.isConnected) returnFocus.focus(); });
  dialog.addEventListener("click", event => { const r = dialog.getBoundingClientRect(); if (event.target === dialog && (event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom)) dialog.close(); });
  document.addEventListener("keydown", event => {
    if (panel.classList.contains("hidden")) return;
    if (event.key === "Escape") { mallOfHorrorExplainWidget?.exit(); hideTip(); selected = {}; render(); }
  }, true);
  panel.addEventListener("pointerover", event => { if (event.pointerType === "mouse") showTip(event.target.closest("[data-moh-tip]")); });
  panel.addEventListener("pointerout", event => { if (event.pointerType === "mouse") hideTip(); });
  panel.addEventListener("focusin", event => showTip(event.target.closest("[data-moh-tip]"))); panel.addEventListener("focusout", hideTip);
  panel.addEventListener("pointerup", event => { if (event.pointerType !== "mouse") showTip(event.target.closest("[data-moh-tip]"), true); });
  panel.addEventListener("click", event => {
    const target = event.target.closest("[data-moh-tip]"); if (target) showTip(target, true); else hideTip();
    if (!event.target.closest("button, #mallOfHorrorControls, dialog") && Object.keys(selected).length) { selected = {}; render(); }
  });
  document.addEventListener("scroll", hideTip, true); window.addEventListener("resize", hideTip); window.addEventListener("blur", hideTip);
  function clearState() {
    view = null; signature = null; selected = {}; pending = false; wasUrgent = false;
    clearTimeout(pendingTimer); mallOfHorrorExplainWidget?.exit(); hideTip(); if (dialog.open) dialog.close();
    ["Players", "Map", "Controls", "Dice", "Destinations", "Hand", "Review", "Log", "VoteResult"].forEach(s => byId(s).replaceChildren());
    byId("Review").classList.add("hidden"); text("Status", "Waiting to start");
  }
  window.renderMallOfHorrorGameState = data => {
    if (data?.view?.game_id !== "mall_of_horror" || currentGameType !== "mall_of_horror" || (data.room_id && currentRoomState?.room_id !== data.room_id)) return;
    const incoming = JSON.stringify([data.room_id, data.view.game_token, data.view.step, data.view.you]);
    if (signature !== incoming) { selected = {}; hideTip(); }
    if (signature !== incoming || view?.revision !== data.view.revision) { pending = false; clearTimeout(pendingTimer); }
    signature = incoming; view = data.view; render();
  };
  window.clearMallOfHorrorState = clearState;
  window.showMallOfHorrorHeaderActions = visible => { header.style.display = visible ? "flex" : "none"; if (!visible) clearState(); };
  function syncRoom(state) { if (state?.game_type !== "mall_of_horror" || state.status === "lobby") clearState(); }
  function sync() {
    socket.on("room:state", syncRoom);
    socket.on("system:error", () => { pending = false; clearTimeout(pendingTimer); render(); });
    socket.on("disconnect", () => { pending = false; clearTimeout(pendingTimer); render(); hideTip(); }); socket.on("connect", render);
    if (typeof currentRoomState !== "undefined") syncRoom(currentRoomState);
    if (typeof lastGameStatePayload !== "undefined" && lastGameStatePayload?.game_type === "mall_of_horror") window.renderMallOfHorrorGameState(lastGameStatePayload);
  }
  initMallOfHorrorHelpExplain();
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", sync, {once:true}); else sync();
})();
