(() => {
  "use strict";
  const $ = suffix => document.getElementById(`gloomhaven${suffix}`);
  const panel = $("Panel"), header = $("HeaderActions"), dialog = $("Dialog"), tooltip = $("Tooltip");
  const elementInfo = {fire:["🔥","火"],ice:["❄️","冰"],air:["🌬️","风"],earth:["🌿","土"],light:["☀️","光"],dark:["🌑","暗"]};
  const conditionInfo = {poison:["☠️","中毒"],wound:["🩸","创伤"],disarm:["⛔","缴械"],immobilize:["⛓️","定身"],stun:["💫","晕眩"],muddle:["🌀","困惑"],strengthen:["✨","强化"]};
  const monsters = {guard:["🪓","强盗守卫"],archer:["🏹","强盗弓手"],bones:["💀","活骸"]};
  const explanations = {
    scenario:["战术遭遇版", "你们是一支合作闯关的佣兵队伍，每关的目标都是击败两个房间里的全部怪物。单人游玩时，你控制两名佣兵，多人游玩时每人控制一名。这里采用初版的战斗框架，提供六种职业、精简能力牌和三个原创关卡。房主可以选择从哪一关开始，以及 0–2 的难度。难度会改变怪物的生命、攻击、陷阱伤害和奖励，打赢第三关就完成了这次远征。"],
    ready:["Ready · 准备", "先为自己控制的佣兵选职业，队伍里的职业不能重复。单人游玩时要分别选好两名佣兵。房主可以在所有人都还没点 Ready 时调整关卡和难度。选好后点 Ready，等全员准备完毕，大家就会拿到各自的能力牌，开始第一轮选牌。"],
    round:["Round · 轮次", "一轮是大家各行动一次的完整过程，轮到某一名佣兵或怪物行动的那一段叫它的回合。每轮先选两张牌，等全员提交后，再按先攻（⌛，决定行动早晚的数字）从小到大行动。也可以选择长休，用这一轮的行动机会换回用过的牌，具体做法见 Help 的休息说明。全部行动结束后，游戏会停在回顾界面。看完结果、处理好需要的休息，再点 Next Round，等全员确认后才开始下一轮。即使你的佣兵已退出本关，也仍然需要确认。"],
    cards:["Ability cards（🂠）· 能力牌", "能力牌决定你这次能做什么。每轮从手牌里选两张，先点的那张决定先攻（⌛），数字越小越早行动，然后点 Commit 提交。轮到你时，用其中一张的上半和另一张的下半，先用哪张都行。普通用法会把牌放进弃牌堆（🗂️），以后可以通过休息拿回来。如果实际执行了标有 Lost（🔥）的半区，整张牌就会失去，休息也拿不回来。觉得牌面能力不合适时，可以改用 Basic 基础动作，这样只会弃牌。"],
    half:["上半 / 下半行动", "你提交了两张牌，但不能把两张的全部内容都用一遍。这个回合最多用一张牌的上半，再用另一张牌的下半，顺序由你决定。点 Use 会执行该半区写出的能力。点上半的 Basic ⚔️ 2 会改为一次攻击值为 2 的近战攻击，点下半的 Basic 👣 2 则改为获得 2 点移动力。需要移动或选择目标时，先点地图上的高亮位置或目标按钮，再确认操作。Finish Move 放弃剩余移动力，Skip 跳过当前这项效果。两张牌处理完后点 End Turn，结束自己的回合。提前结束也可以，没用的已提交牌会进入弃牌堆。"],
    map:["Hex map · 六角地图", "地图上每个六角形是一格。移动（👣 Move）通常每走一格花 1 点移动力，进入困难地形（≋）要花 2 点。你可以穿过队友，但不能停在任何角色已经占据的格子上，也不能直接穿过敌人或障碍（🪨）。带跳跃（🪽 Jump）的移动能越过角色、障碍和困难地形，不过落点仍必须能站人，落在陷阱（⚠️）上也仍会受伤。普通移动经过陷阱时就会触发，伤害是 2 加当前难度。走进关门（🚪 Door）所在格会开门，第二个房间的怪物会在本轮加入战斗，所以开门前最好先看队友是否跟得上。"],
    attack:["Attack（⚔️）· 攻击", "攻击值是计算伤害的起点，并不保证扣掉同样多的生命。每次攻击都会自动抽一张攻击修正牌，例如攻击 3 抽到 +1，就先算成 4。随后扣除目标的护盾（🛡️），最低为 0。穿刺（↗）表示这次能忽略多少护盾。目标已经中毒（☠️）时，先把攻击值加 1，再算修正。优势表示抽两张修正牌、采用结果较好的那张，劣势则采用较差的那张，两者同时存在时照常只抽一张。强化（✨）会给你优势，困惑（🌀）或用远程攻击打相邻敌人会给你劣势。攻击附带的状态即使在伤害为 0 时也会生效。"],
    damage:["Damage · 伤害与抵消", "佣兵将要受伤时，游戏会暂停，让你决定怎么处理。点 Take Damage 就扣除相应的生命（❤️）。如果不想承受这次伤害，可以选一张手牌，或者切到 2 discards 选两张弃牌，再点 Lose & Prevent。这些牌会进入失去区（🔥 Lost），换来整次伤害归零，以后休息也拿不回它们。已经提交但还没用的两张牌不在手牌或弃牌堆里，不能拿来抵伤。抵消伤害也不会取消攻击附带的状态。生命归零就会耗尽，也就是退出本关的战斗。"],
    rest:["Rest · 休息", "休息是把弃牌（🗂️，用过但还能回收的牌）拿回手里的办法，代价是失去其中一张。失去的牌进入 Lost（🔥），普通休息不能再拿回来。两种休息都要求至少有两张弃牌。短休是在轮末回顾时点 Short Rest，随机选出一张要失去的牌，点 Accept 后拿回其余弃牌，不占下一轮行动。若想保住抽中的牌，可以点 Redraw，付出 1 点伤害重抽一次。长休则是在轮初选牌时点 Long Rest，这轮不出两张牌，而是在先攻（⌛）99 时休息。轮到你后，自己挑一张弃牌点 Lose & Rest，失去它并拿回其余弃牌，同时治疗 2 点、恢复用过的疾行靴（🥾）。因此，短休适合急着继续行动，长休适合能空出一轮来恢复的时候。"],
    elements:["Elements · 元素", "火（🔥）、冰（❄️）、风（🌬️）、土（🌿）、光（☀️）和暗（🌑）是所有佣兵共用的资源。有些牌会生成元素，但要等使用者的回合结束才会出现，因此不能马上用掉自己刚生成的那份元素。元素刚出现时是 Strong（●，强），轮末变成 Waning（◐，弱），再过一个轮末就变成 Inert（○，消失）。强和弱都能用。执行写有“可消费”对应元素的攻击时，在第一次确认目标前点 Use 元素按钮，就能用掉这份元素，让该项攻击的攻击值加 1。"],
    conditions:["Conditions · 状态", "状态是角色身上持续生效的额外效果。中毒（☠️）会让敌人攻击你时的攻击值加 1，下一次治疗只解毒，不恢复生命。创伤（🩸）会让你在自己的回合开始时受 1 点伤害，治疗能清除它。缴械（⛔）让你不能攻击，定身（⛓️）让你不能移动，晕眩（💫）让你不能正常出牌行动或使用道具。困惑（🌀）让攻击修正抽两张取较差的结果，强化（✨）则取较好的结果，两者抵消。中毒和创伤会一直留到被治疗，其他五种通常在你接下来的回合结束时消失。如果是在你自己的回合中获得，则会留到你下一次回合结束。"],
    monster:["Monsters · 怪物行动", "怪物由系统控制，你可以根据公开的怪物能力牌判断它们本轮会做什么。强盗守卫（🪓）、强盗弓手（🏹）和活骸（💀）各自按种类共用一张牌，牌上的先攻（⌛）决定行动早晚，移动和攻击的加减数值则加到怪物自身数值上。同类中带星号的精英（★）先行动，然后才是普通怪物。怪物会优先追逐最省移动力就能攻击到的佣兵，并尽量绕开陷阱。远程怪物也会尽量拉开距离，因为贴身射击要抽两张攻击修正、采用较差的结果。牌上写“不移动”时，它就会留在原地。"],
    initiative:["Initiative（⌛）· 先攻", "先攻是本轮的行动顺序数字，越小就越早行动。你先点选的那张牌提供这个数字，但不要求你先使用那张牌。所有佣兵提交后，大家的先攻和怪物本轮的能力牌才会一起公开。如果佣兵和怪物的数字相同，佣兵先行动。两名佣兵相同就比较另一张牌上的数字，仍相同才按固定佣兵编号决定。同类怪物中，精英（★，较强的怪物）排在普通怪物前面，再各按编号行动。"],
    items:["Items · 道具", "每名佣兵都有治疗药水（🧪）和疾行靴（🥾）。在自己的正常行动回合里点 Heal 3，可以喝药水治疗 3 点，但每关只能喝一次，休息也不会补充药水。疾行靴要在正在执行移动能力时点 Move +2，给这次移动增加 2 点移动力。靴子用过后暂时不能再用，完成长休后才会恢复。长休就是用一轮出牌行动的机会换回弃牌并治疗自己，详细步骤见 Help。处于晕眩（💫，无法正常行动的状态）时不能使用道具。"],
    loot:["Loot（💰）· 拾取与成绩", "怪物被击败后会在所在格掉落一枚金币（💰）。走过金币不会自动捡走，但如果你的回合结束时站在金币上，就会自动拾取。卡牌上的 Loot 也就是拾取能力，数字表示范围，例如拾取 1 会收走自己脚下和相邻、没有被墙或关门挡住的金币。每枚金币计入成绩时价值为 2 加当前难度。执行带经验奖励的牌面能力和过关都能获得经验（⭐）。本版的金币、经验和击杀数用来记录成绩，没有商店或升级系统。"],
  };
  const help = `
    <h3>你们要一起完成什么？</h3>
    <p>你们控制一支佣兵队伍，在地图上移动、开门并击败怪物。佣兵就是你操控的角色。<strong>每关要清掉两个房间里的全部怪物，大家一起赢。</strong>单人玩时，你负责两名佣兵，多人玩时每人负责一名。本版有三个关卡，打赢第三关就完成远征。</p>

    <h3>先弄懂卡牌为什么会越打越少</h3>
    <p>佣兵靠<strong>能力牌</strong>行动。每张牌分为上半和下半，分别写着可用的能力。平常每轮选两张牌，轮到你时，用一张的上半和另一张的下半。例如，你可以用一张牌移动，再用另一张牌攻击。这里说的<strong>一轮（Round）</strong>，是全体佣兵和怪物各行动一次的完整过程。轮到某个角色行动的那一段，才叫它的<strong>回合（Turn）</strong>。</p>
    <p>牌有三个去处。<strong>手牌（🂠 Hand）</strong>是还拿在手里、可以选来出牌的牌。普通用过的牌会放进<strong>弃牌堆（🗂️ Discard）</strong>，暂时不能选，但休息后能拿回来。还有一些能力标着<strong>失去（🔥 Lost）</strong>，实际执行这种能力后，整张牌会进入失去区，普通休息也拿不回来。玩家有时把失去卡牌叫作“烧牌”，它和普通弃牌不是一回事。</p>
    <p>你不会在每轮开始时自动补满手牌，所以打几轮就得休息。每次休息又会失去一张牌，可反复使用的牌因此越来越少。生命（❤️）降到 0，或者轮初既凑不出两张手牌、又没有足够弃牌可以休息时，佣兵就会<strong>耗尽（Exhausted）</strong>，意思是退出本关战斗。因此，你既要保护生命，也要留意还能用多少张牌。</p>

    <h3>短休和长休到底是什么？</h3>
    <p><strong>休息就是付出一张弃牌，把其余弃牌拿回手里。</strong>短休和长休都要求弃牌堆里至少有两张牌，都不能拿回失去区里的牌，也都不需要先把手牌用光。同一名佣兵每轮只能完成一次休息。</p>
    <p><strong>短休（Short Rest）</strong>发生在一轮结束后的回顾界面。点 Short Rest，系统会随机挑一张弃牌让你失去。点 Accept 接受后，其余弃牌就回到手里，下一轮仍能正常出牌。如果特别想保住抽中的那张，可以点 Redraw，付出 1 点伤害重抽一次，第二次不会再抽中原来那张。短休不治疗，也不恢复道具。</p>
    <p><strong>长休（Long Rest）</strong>要在轮初选牌时决定。你这轮不提交两张能力牌，而是把自己的行动机会用来休息，本轮的行动顺序数字固定为 99。这个决定谁先谁后的数字叫<strong>先攻（⌛ Initiative）</strong>，越小越早，所以长休通常很晚才轮到。到你时，从弃牌中自己挑一张，点 Lose &amp; Rest 将它失去，再拿回其余弃牌。作为花掉这轮出牌机会的补偿，你还会接受 2 点治疗，并恢复用过的疾行靴（🥾，能给移动额外加 2 点的道具）。治疗通常恢复生命，但如果你中了毒（☠️，会让你被攻击时更容易受伤的状态），这次治疗只解毒而不回血。</p>
    <p>比如你有四张弃牌，休息后会拿回其中三张、失去一张。短休让你接着战斗，但哪张牌失去由随机决定。长休让你自己挑，还能治疗，不过休息前怪物仍可能攻击你。急着支援队友时往往适合短休，有喘息空间时再考虑长休。</p>

    <h3>准备好角色，然后选本轮的两张牌</h3>
    <p>开局先给佣兵选职业，队伍里不能选重复职业。单人玩时要分别为两名佣兵选择，也要分别操作他们。房主可以在还没有人点 Ready 时调整关卡和难度。第一次玩可以从第 1 关、难度 0 开始。所有人点 Ready 后，就进入第一轮选牌。</p>
    <p>先看看怪物离你多远，再决定本轮想做什么，例如走近后攻击，或者留在原地治疗。依次点两张手牌，再点 <strong>Commit</strong> 提交。你<strong>先点的那张牌</strong>决定本轮先攻，但不要求你行动时先用它，也不要求用它的上半。只要大家还没全部提交，你就可以点 Undo Plan 撤回重选。需要长休时，直接点 Long Rest 即可。</p>
    <p>等所有还在场的佣兵提交后，大家的选牌和怪物本轮的能力牌才会一起公开。系统按先攻从小到大安排顺序。如果佣兵和怪物同数，佣兵先行动。两名佣兵同数时，先比较各自另一张牌的数字，仍相同才按固定佣兵编号决定。轮到别人时，你可以看行动队列和 Recent actions 里的记录，了解发生了什么。</p>

    <h3>轮到你时，怎样把两张牌用出来？</h3>
    <p><strong>一个回合最多用一张牌的上半和另一张牌的下半，顺序自己选。</strong>不能用两次上半，也不能把同一张牌的上下半都用掉。点某个半区的 Use，就开始执行上面写的能力。如果有多项效果，会按牌面顺序处理，处理完这一半才能用另一张。</p>
    <p>举个实际例子：蛮族选了“盾锋”（先攻 15，上半攻击 3）和“长矛突刺”（先攻 27，下半移动 3）。选牌时先点盾锋，所以提交后本轮先攻是 15。轮到蛮族后，可以先点长矛突刺<strong>下半的 Use</strong>，选地图上的高亮落点，再点 Move，花移动力走到怪物旁边。如果还有移动力但不想再走，点 Finish Move。然后点盾锋<strong>上半的 Use</strong>，选相邻怪物并点 Attack，发起一次攻击值为 3 的攻击。攻击值是计算伤害的起点，实际扣多少生命还要看后面介绍的攻击修正和护盾。这两张牌都普通弃置，之后休息还能拿回来。</p>
    <p>如果原来的计划做不成，任何一张牌的上半都可以改用 <strong>Basic ⚔️ 2</strong>，对相邻敌人进行一次攻击值为 2 的攻击。下半则可以改用 <strong>Basic 👣 2</strong>，获得 2 点移动力。基础动作仍然占用对应的上半或下半，但不会触发牌面上的失去、经验或其他效果，所以即使这个半区标有 Lost，也只会普通弃牌。</p>
    <p>不想执行当前效果时可以点 Skip，移动时则用 Finish Move 放弃剩余移动力。如果一项能力能攻击多个目标，就逐个选择并确认，每个目标只选一次，也可以跳过剩余目标。处理完后点 <strong>End Turn</strong> 结束自己的回合。你也可以提前结束，已经提交但没用掉的牌仍会进入弃牌堆。如果一个标有 Lost 的半区完全没有实际执行效果，也只会弃置。</p>

    <h3>地图上怎么走，什么时候开门？</h3>
    <p>地图上的六角形每个是一格。<strong>移动（👣 Move）</strong>的数字是这次有多少移动力，普通地面每走一格花 1 点，进入<strong>困难地形（≋）</strong>花 2 点。可以少走，也可以分几次选择落点，直到移动力用完或点 Finish Move。你能穿过队友，但不能停在任何角色占据的格子里，也不能直接穿过敌人或<strong>障碍（🪨）</strong>。</p>
    <p>带<strong>跳跃（🪽 Jump）</strong>的移动可以越过角色和障碍，经过困难地形也只花 1 点，但最后必须落在没有角色、没有障碍的格子上。普通移动经过<strong>陷阱（⚠️ Trap）</strong>就会触发，造成“2 加当前难度”的伤害，之后陷阱消失。跳跃可以跨过中途的陷阱，不过选择陷阱格作为落点仍会触发。</p>
    <p>走进<strong>门（🚪 Door）</strong>所在的格子，就会打开第二个房间。新出现的怪物本轮就会行动，如果它们的先攻已经过了，会在开门者结束回合后尽快行动。开门后你仍可花剩余移动力继续走，但最好先确认队友能否跟上，不要独自冲进新一群怪物中间。</p>

    <h3>攻击为什么不一定打出牌上写的伤害？</h3>
    <p><strong>攻击（⚔️ Attack）</strong>后的数字是攻击值。没有额外射程的攻击只能打相邻怪物。<strong>射程（🎯 Range）</strong>表示最远隔多少格，例如射程 3 可以打三格以内的敌人。目标还必须在<strong>视线</strong>内，也就是你和它之间没有墙或关闭的门挡住。本版的角色和障碍不挡视线，系统会高亮当前能选的目标。</p>
    <p>确认攻击后，系统会自动抽一张<strong>攻击修正牌</strong>，用来调整这次攻击值。它是另一副牌，不是你手里的能力牌。抽到 +1 就加 1，抽到 −1 就减 1，×0 表示这次伤害为 0，×2 表示攻击值翻倍。然后再扣掉目标的<strong>护盾（🛡️ Shield）</strong>。例如攻击 3 抽到 +1，对方有护盾 1，最终受到的伤害就是 3。伤害最低为 0。</p>
    <p><strong>穿刺（↗ Pierce）</strong>表示这次能忽略多少点护盾，例如穿刺 2 可以忽略护盾 2，但不会在对方没有护盾时额外加伤害。通过能力获得的临时护盾会持续到本轮结束，可以抵挡这期间的多次攻击，但挡不住陷阱或其他直接伤害。如果目标早已<strong>中毒（☠️）</strong>，则先把攻击值加 1，再抽修正和扣护盾。攻击新附加的中毒只影响之后的攻击。</p>
    <p>有时攻击会获得<strong>优势</strong>或<strong>劣势</strong>。优势会抽两张修正牌，采用结果较好的那张，劣势则取较差的那张。<strong>强化（✨）</strong>是一种让攻击有优势的状态，<strong>困惑（🌀）</strong>会让攻击有劣势。用远程攻击打紧挨着自己的怪物也有劣势，因此弓箭或法术通常适合拉开距离再用。优势和劣势同时存在时相互抵消，照常抽一张，多个相同来源也不会继续叠加抽牌。</p>
    <p>每名佣兵都有独立的 20 张修正牌，怪物则共用一副。每副有六张 0、五张 +1、五张 −1，以及 +2、−2、×0、×2 各一张。抽到 ×0 或 ×2 后，会在轮末把抽牌堆和弃掉的修正牌合在一起洗匀。抽牌堆提前用完时也会自动洗牌，这些都由系统处理。</p>

    <h3>受伤时，要扣生命还是用牌保命？</h3>
    <p>每次佣兵将受到伤害时，游戏会停下来让你选择。点 <strong>Take Damage</strong> 就扣除显示的生命值。如果这一击太危险，你可以选<strong>一张手牌</strong>，或者切到 <strong>2 discards</strong> 选<strong>两张弃牌</strong>，再点 <strong>Lose &amp; Prevent</strong>。所选的牌会失去，换来<strong>整次伤害归零</strong>。例如要受 5 点伤害，失去一张手牌就能把这 5 点全挡掉。</p>
    <p>已经提交、还没执行的本轮牌暂时放在一旁，既不算手牌也不算弃牌，不能用来抵伤。已经执行完、进入弃牌堆的牌则可以。陷阱、短休重抽等其他来源的伤害也能这样抵消，但抵消伤害不能取消攻击附带的状态。即使攻击最终造成 0 点伤害，附加状态仍会生效。用牌保命能救急，不过会减少以后能行动的轮数。</p>

    <h3>治疗和身上的状态怎么处理？</h3>
    <p><strong>治疗（❤️ Heal）</strong>通常恢复指定数值的生命，但不会超过最大生命。写“自己”的能力只能治疗自己，带射程（🎯）的治疗可以选择范围和视线内的自己或队友。操作和攻击类似，选目标后点 Heal 确认。身上的<strong>状态</strong>是会持续一段时间的效果，治疗遇到其中的中毒和创伤时有特别规则。</p>
    <p><strong>中毒（☠️ Poison）</strong>会让攻击你的攻击值加 1，直到接受治疗。中毒时，下一次治疗只负责解毒，不恢复生命。比如你剩 3 点生命又中毒，喝治疗 3 的药水后仍是 3 点，但毒解了。</p>
    <p><strong>创伤（🩸 Wound）</strong>会在你每次回合开始时造成 1 点伤害，治疗能清除创伤并正常回血。如果中毒和创伤同时存在，一次治疗会把两者一起清除，但因为中毒，这次仍不回血。长休的治疗也遵守这些规则。</p>
    <p><strong>缴械（⛔ Disarm）</strong>让角色不能攻击，但还能移动或治疗。<strong>定身（⛓️ Immobilize）</strong>让角色不能移动，但还能攻击。<strong>晕眩（💫 Stun）</strong>让角色无法进行正常的出牌行动，也不能用道具，此时点 End Turn 结束回合即可。如果这一轮选的是长休，仍可完成长休。</p>
    <p><strong>困惑（🌀 Muddle）</strong>和<strong>强化（✨ Strengthen）</strong>分别让攻击获得前面说的劣势和优势。除了中毒、创伤要靠治疗解除，其他五种状态都会在角色接下来的回合结束时消失。如果状态是在角色自己的回合中获得，则会多留到它下一次回合结束。例如你本回合给自己强化，就能用于本回合剩下的攻击，以及下一次回合的攻击。</p>

    <h3>牌上写的“生成元素”和“消费元素”是什么？</h3>
    <p><strong>元素</strong>是场上所有佣兵共用的资源，包括火（🔥）、冰（❄️）、风（🌬️）、土（🌿）、光（☀️）和暗（🌑）。实际执行带“生成”字样的能力后，对应元素会在<strong>这名佣兵的回合结束时</strong>出现。因此，你不能用掉自己本回合刚生成、还没出现的那份元素，但后行动的队友可以接着用。</p>
    <p>元素刚生成时显示 <strong>Strong（●，强）</strong>，本轮结束后变成 <strong>Waning（◐，弱）</strong>，再过一个轮末就变成 <strong>Inert（○，消失）</strong>。强和弱都可以消费，也就是用掉这份元素。执行写着“可消费”对应元素的攻击时，在第一次确认目标前点 <strong>Use 元素</strong>按钮，就会让这一项攻击的攻击值加 1，并把元素变为消失。如果这一项攻击有多个目标，加成会用于它的每个目标。</p>
    <p>例如织法者先用能力生成火，自己的回合结束后，火才可用。后行动的佣兵如果有写着“可消费火”的攻击，就可以把它用掉。也可以把火留到下一轮，但它可能被队友先用掉，所以选牌时最好商量一下。</p>

    <h3>怪物会怎么行动？</h3>
    <p>怪物由系统控制。强盗守卫（🪓）、强盗弓手（🏹）和活骸（💀）会按种类各抽一张能力牌，同类怪物共用这张牌。牌上的先攻决定本轮什么时候行动，移动和攻击旁的加减数字则加在怪物本身的数值上。如果牌写着“不移动”，它就算离你很远也不会走近。同类中带星号的<strong>精英（★）</strong>是更强的怪物，它们先行动，再轮到普通怪物，各自按编号排序。</p>
    <p>怪物选定要追打的佣兵叫作<strong>聚焦</strong>。它先比较走到能攻击位置需要花多少移动力，优先选择花费最少的目标。如果相同，再比较当前距离和佣兵先攻。它会优先找不踩陷阱的路线，远程怪物也会尽量避开贴身射击的劣势。因此，离怪物最近的人不一定是它最后攻击的人，地形和是否已经进入射程都会影响选择。</p>

    <h3>一轮打完后怎么补牌，什么时候能继续？</h3>
    <p>所有角色行动结束后，游戏会停在回顾界面，保留地图和本轮记录。<strong>先看自己的剩余手牌，再决定是否短休。</strong>想继续正常出牌，就要保证下一轮至少有两张手牌。也可以留着至少两张弃牌，准备下一轮长休。决定好后点 Next Round，等所有玩家都确认才会继续。还在处理短休时不能确认，已经耗尽的佣兵所属玩家也要确认。</p>
    <p>有两个涉及抵伤的特殊情况：如果你选了长休，却在轮到自己前用弃牌抵伤，导致弃牌不足两张，这次长休就无法完成，只能结束回合。短休重抽的 1 点伤害也能用牌抵消，但若因此失去了系统刚选中的候选弃牌，系统会从剩余弃牌里重新选一张。如果没有弃牌剩下，休息就直接结束。</p>

    <h3>道具、金币和经验有什么用？</h3>
    <p>每名佣兵都有<strong>治疗药水（🧪）</strong>和<strong>疾行靴（🥾）</strong>。在自己的正常行动回合里点 Heal 3 可以喝药水治疗 3 点，每关只能用一次，长休也不会补充药水。疾行靴要在执行移动能力期间点 Move +2，让当前这次移动多出 2 点移动力。用过的靴子会暂时停用，完成长休才能再次使用。</p>
    <p>每只怪物被击败后会在原地掉一枚<strong>金币（💰 Gold）</strong>。路过不会捡走，但回合结束时会自动拾取自己脚下的金币。<strong>拾取（💰 Loot）</strong>能力能捡起范围内、有视线的金币，例如拾取 1 包括自己脚下和相邻格。每枚金币计入成绩时价值为 2 加当前难度。</p>
    <p><strong>经验（⭐ XP）</strong>来自实际执行标有经验奖励的牌面能力，以及过关奖励。使用 Basic 不会获得牌面的经验。本版把经验、金币和击杀数作为累计成绩，没有用金币买东西或用经验升级的环节。另外，织法者的<strong>回收（♻️）</strong>能力可以把此前失去的牌拿回手里，这是休息之外的特殊能力。执行它的那张牌随后才会失去，所以不能把自己一并拿回来。</p>

    <h3>怎样过关，又会在什么时候失败？</h3>
    <p>如果一轮结束时，两个房间的怪物都已经被击败，你们就赢下本关。只清掉第一间还不算赢，要开门清掉第二间。如果全部佣兵都耗尽，则本关失败。某一名佣兵先耗尽并不意味着全队输了，其余人仍可继续完成目标。</p>
    <p>过关后全员点 Continue 进入下一关，失败后全员点 Retry 重试当前关。进入新关或重试时，生命、能力牌和道具都会恢复，经验、金币与击杀数继续累计。第三关获胜后，整场远征结束。</p>

    <h3>界面操作和本版范围</h3>
    <p>单人控制两名佣兵时，用 H1、H2 标签切换。手机上可以用 Room 1、Room 2 看各房间，All 显示全部已探索区域。手牌和日志过长时可以在各自区域内滚动。点已选的牌、周围空白或按 Esc 可以取消尚未提交的选牌，弹窗中按 Esc 可以关闭说明。想查某个对象时，先点 Explain，再点带虚线的对象，查看后会自动退出解释模式。静态图标在电脑上可悬停查看提示，手机上点一下会显示 3 秒。</p>
    <p>这是采用《幽港迷城》初版战斗框架的战术遭遇版，使用六种初始职业、精简重写的能力牌和三个原创双房间关卡，不含完整剧情战役、召唤物、升级、退休、事件、商店或遗产解锁。具体数值以本版卡面为准。难度 0–2 会改变怪物数值、陷阱伤害和奖励，单人不会额外叠加原版的难度修正。本版视线按两个格子的中心连线计算，恰好贴边时，有一侧能通过就算看得见。机器人只使用自己可见的信息，可以作为练习队友。</p>
    <p><a href="https://online.flippingbook.com/view/642368833/" target="_blank" rel="noopener noreferrer">想进一步了解原版，可以阅读初版规则书</a></p>`;
  let view = null, heroId = null, selected = [], selectedAction = null, damagePile = "hand", pending = false, explaining = false;
  let pendingTimer, tipTimer, suppressTimer, suppressClick = false, focusBeforeDialog = null;
  const narrowLayout = window.matchMedia("(max-width: 720px)");
  let roomMode = narrowLayout.matches ? 1 : 0, previousPositionRoom = null;
  narrowLayout.addEventListener("change", () => { roomMode = narrowLayout.matches ? previousPositionRoom || 1 : 0; if (view) renderMap(); });
  const el = (tag, cls, text) => { const n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; };
  const setText = (id, text) => { $(id).textContent = text; };
  const hero = () => view?.heroes.find(h => h.id === heroId);
  const ownHeroes = () => view?.heroes.filter(h => h.owner === view.you) || [];
  const playerName = pid => view?.players.find(p => p.player_id === pid)?.name || "Spectator";
  const className = h => h ? `${view.classes[h.class_id].icon} ${view.classes[h.class_id].name}` : "—";
  const unitName = id => { const h = view.heroes.find(h => h.id === id); const m = view.monsters.find(m => m.id === id); return h ? className(h) : m ? `${monsters[m.kind][0]} ${monsters[m.kind][1]} ${m.number}${m.elite ? " ★" : ""}` : view.last_attack?.target===id ? view.last_attack.target_name || id : view.last_attack?.attacker===id ? view.last_attack.attacker_name || id : id; };
  const opts = (type, hid = null) => view?.options.filter(o => o.type === type && (!hid || o.hero_id === hid)) || [];
  const matching = (type, fields = {}) => opts(type).find(o => Object.entries(fields).every(([k,v]) => JSON.stringify(o[k]) === JSON.stringify(v)));
  const enabled = option => !!option && !pending && socket.connected;
  function tip(node, message, key) { node.dataset.ghTip = message; node.tabIndex = 0; if (key) node.dataset.ghExplain = key; return node; }
  function button(text, action, key, cls = "") {
    const b = el("button",cls,text); b.type = "button"; b.disabled = !enabled(action); if (key) b.dataset.ghExplain = key;
    b.addEventListener("click", () => dispatch(action)); return b;
  }
  function localButton(text, fn, key) { const b = el("button","",text); b.type="button"; if (key) b.dataset.ghExplain=key; b.addEventListener("click",fn); return b; }
  function dispatch(action) {
    if (!enabled(action) || explaining || !view.options.some(o => JSON.stringify(o) === JSON.stringify(action))) return;
    pending = true; selectedAction = null; hideTip(); clearTimeout(pendingTimer);
    pendingTimer = setTimeout(() => { pending=false; render(); }, 3000);
    sendAction({...action, ...Object.fromEntries(["game_token","scenario_attempt","round","revision"].map(k=>[k,view[k]]))}); render();
  }
  function clearSelection() { selected=[]; selectedAction=null; renderHand(); renderActions(); renderMap(); }
  function effectText(e) {
    let text = {attack:`⚔️ 攻击 ${e.value}${e.range>1 ? ` · 🎯 射程 ${e.range}` : ""}`,move:`👣 移动 ${e.value}${e.jump ? " · 🪽 跳跃" : ""}`,heal:`❤️ 治疗 ${e.value}${e.range ? ` · 🎯 ${e.range}` : " · 自己"}`,shield:`🛡️ 护盾 ${e.value}`,loot:`💰 拾取 ${e.value}`,recover:"♻️ 回收所有失去的牌",strengthen:"✨ 强化自己"}[e.kind] || e.kind;
    if (e.targets>1) text += ` · ${e.targets} 个目标`;
    if (e.pierce) text += ` · ↗ 穿刺 ${e.pierce}`;
    if (e.condition) text += ` · ${conditionInfo[e.condition].join(" ")}`;
    if (e.infuse) text += ` · 生成 ${elementInfo[e.infuse].join("")}`;
    if (e.consume) text += ` · 可消费 ${elementInfo[e.consume].join("")}`;
    return text;
  }
  function cardDescription(card) { return `${card.name}，先攻（⌛）${card.initiative}。上半：${card.top.map(effectText).join("；")}${card.top_loss ? "，执行后失去（🔥 Lost）" : ""}。下半：${card.bottom.map(effectText).join("；")}${card.bottom_loss ? "，执行后失去（🔥 Lost）" : ""}。${card.xp ? `实际执行牌面能力获得 ${card.xp} 经验（⭐）。` : ""}`; }
  function renderSetup() {
    $("Setup").classList.toggle("hidden",view.phase!=="setup");
    if (view.phase!=="setup") return;
    $("ScenarioSelect").replaceChildren();
    view.scenarios.forEach(s=>{const n=el("option","",`${s.id} · ${s.name}`);n.value=s.id;$("ScenarioSelect").append(n);});
    $("ScenarioSelect").value=view.scenario; $("Difficulty").value=view.difficulty;
    $("ScenarioSelect").disabled=$("Difficulty").disabled=!opts("configure").length || pending;
    setText("SetupReady",`${view.ready.length} / ${view.players.length} ready`);
    const tabs=$("SetupHeroes");tabs.replaceChildren();
    ownHeroes().forEach(h=>{const b=localButton(`${h.id.toUpperCase()} · ${className(h)}`,()=>{heroId=h.id;renderSetup();},"ready");b.setAttribute("aria-pressed",String(h.id===heroId));tabs.append(b);});
    const box=$("Classes");box.replaceChildren();
    Object.entries(view.classes).forEach(([id,c])=>{const action=matching("choose_class",{hero_id:heroId,class_id:id});const b=button("",action,"ready","gh-class");b.style.setProperty("--class-color",c.color);b.append(el("strong","",`${c.icon} ${c.name}`),el("span","",c.role),el("span","",`❤️ ${c.hp} · 🂠 ${c.hand}`));b.setAttribute("aria-pressed",String(hero()?.class_id===id));box.append(b);});
    const ready=opts("ready")[0]||opts("unready")[0];$("Ready").disabled=!enabled(ready);$("Ready").textContent=ready?.type==="unready" ? "Unready" : "Ready";$("Ready").onclick=()=>dispatch(ready);
  }
  function renderHeroes() {
    const box=$("Heroes");box.replaceChildren();
    view.heroes.forEach(h=>{
      const n=el("article",`gh-hero${view.current===h.id ? " is-current" : ""}${h.exhausted ? " is-exhausted" : ""}`);n.style.setProperty("--class-color",view.classes[h.class_id].color);
      n.append(el("strong","",`${h.id.toUpperCase()} · ${className(h)}`),el("div","gh-owner",`${playerName(h.owner)}${h.owner===view.you ? " · You" : ""}${h.exhausted ? " · Exhausted" : h.planned && view.phase==="planning" ? " · Ready ✓" : ""}`));
      if (h.hp!=null) {
        const health=el("div","gh-health"),fill=el("i");fill.style.width=`${h.hp/h.max_hp*100}%`;health.append(fill);n.append(health);
        const stats=el("div","gh-stats");
        [[`❤️ ${h.hp}/${h.max_hp}`,"生命（❤️）：归零则耗尽。","damage"],[`🂠 ${h.hand_count}`,"手牌（🂠）：只有本人能看到牌面。","cards"],[`🗂️ ${h.discard_count}`,"弃牌（🗂️）：休息后可以回收。","rest"],[`🔥 ${h.lost_count}`,"Lost（🔥）：本关失去的牌。","rest"],[`⭐ ${h.xp}`,"经验（⭐）：累计成绩。","loot"],[`💰 ${h.gold}`,"金币（💰）：累计成绩。","loot"]].forEach(([t,d,k])=>stats.append(tip(el("span","",t),d,k)));
        n.append(stats);
        const conditions=Object.keys(h.conditions).map(c=>conditionInfo[c].join(" ")).join(" · ");
        if (conditions) n.append(tip(el("div","gh-owner",conditions),explanations.conditions[1],"conditions"));
      }
      box.append(n);
    });
  }
  const svgEl = (tag, attrs = {}, text) => {const n=document.createElementNS("http://www.w3.org/2000/svg",tag);Object.entries(attrs).forEach(([k,v])=>n.setAttribute(k,String(v)));if(text!=null)n.textContent=text;return n;};
  function renderMap() {
    if (!view || view.phase==="setup") return;
    const rooms=$("Rooms");rooms.replaceChildren();
    [0,1,2].filter(r=>r!==2||view.cells.some(c=>c.room===2)).forEach(r=>{const b=localButton(r ? `Room ${r}` : "All",()=>{roomMode=r;renderMap();},"map");b.setAttribute("aria-pressed",String(roomMode===r));rooms.append(b);});
    const cells=view.cells.filter(c=>!roomMode||c.room===roomMode||c.terrain==="door");
    const centers=cells.map(c=>({c,x:Math.sqrt(3)*29*(c.q+c.r/2),y:43.5*c.r}));
    const minX=Math.min(...centers.map(p=>p.x))-32,maxX=Math.max(...centers.map(p=>p.x))+32,minY=-34,maxY=Math.max(...centers.map(p=>p.y))+34;
    const svg=svgEl("svg",{viewBox:`${minX} ${minY} ${maxX-minX} ${maxY-minY}`,role:"group","aria-label":"Explored hex map"});
    centers.forEach(({c,x,y})=>{
      const h=view.heroes.find(h=>!h.exhausted&&h.pos[0]===c.q&&h.pos[1]===c.r),m=view.monsters.find(m=>m.pos[0]===c.q&&m.pos[1]===c.r),unit=h||m;
      const move=matching("move",{hero_id:heroId,q:c.q,r:c.r}),target=unit&&matching("target",{hero_id:heroId,target:unit.id}),action=target||move;
      const selectedHere=selectedAction&&JSON.stringify(selectedAction)===JSON.stringify(action);
      const n=svgEl("g",{class:`gh-hex${action ? " is-reachable" : ""}${selectedHere ? " is-selected" : ""}`,tabindex:0,role:"button","aria-disabled":String(!action),"data-gh-explain":"map","data-q":c.q,"data-r":c.r});
      const terrain={floor:"地面",obstacle:"障碍（🪨）",trap:"陷阱（⚠️）",difficult:"困难地形（≋）",door:c.open ? "已开启的门" : "关闭的门（🚪）"}[c.terrain];
      n.dataset.ghTip=`${unit ? `${unitName(unit.id)}，❤️ ${unit.hp}/${unit.max_hp}。` : ""}${terrain} · [${c.q}, ${c.r}]${c.coins ? ` · 💰 ${c.coins}` : ""}${action ? "。可点选并确认操作。" : ""}`;n.setAttribute("aria-label",n.dataset.ghTip);
      n.append(svgEl("polygon",{points:Array.from({length:6},(_,i)=>{const a=(60*i-30)*Math.PI/180;return `${x+28*Math.cos(a)},${y+28*Math.sin(a)}`;}).join(" ")}));
      if(unit){n.append(svgEl("circle",{cx:x,cy:y-2,r:18,class:`gh-token${m ? " monster" : ""}${view.current===unit.id ? " active" : ""}`}));n.append(svgEl("text",{x,y:y-4,class:"gh-token-icon"},h ? view.classes[h.class_id].icon : monsters[m.kind][0]));n.append(svgEl("text",{x,y:y+20,class:"gh-hex-detail"},`${h ? h.id.toUpperCase() : `${m.elite ? "★" : "#"}${m.number}`} · ${unit.hp}♥`));}
      else {const icon=c.coins ? "💰" : {obstacle:"🪨",trap:"⚠️",difficult:"≋",door:c.open ? "◇" : "🚪"}[c.terrain]||"";n.append(svgEl("text",{x,y,class:"gh-terrain"},icon));}
      const choose=()=>{if(action&&!pending&&!explaining){selectedAction=action;renderMap();renderActions();}else showTip(n,true);};
      n.addEventListener("click",choose);n.addEventListener("keydown",e=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();choose();}});svg.append(n);
    });$("Map").replaceChildren(svg);
  }
  function renderBattleInfo() {
    $("Elements").replaceChildren();
    Object.entries(elementInfo).forEach(([key,[icon,name]])=>{const strength=view.elements[key];$("Elements").append(tip(el("span",`gh-element${!strength ? " is-empty" : strength===2 ? " is-strong" : ""}`,`${icon} ${name} · ${["○","◐","●"][strength]}`),`${name}（${icon}）：${["Inert · 消失","Waning · 弱","Strong · 强"][strength]}。`,"elements"));});
    $("Queue").replaceChildren();
    view.queue.forEach((id,index)=>{const h=view.heroes.find(h=>h.id===id),m=view.monsters.find(m=>m.id===id);if(!h&&!m)return;const initiative=h ? h.initiative : view.monster_cards[m.kind]?.initiative;$("Queue").append(tip(el("span",`gh-initiative${view.current===id ? " is-current" : index<view.queue_index ? " is-done" : ""}`,`⌛ ${initiative ?? "?"} · ${h ? view.classes[h.class_id].icon : monsters[m.kind][0]} ${h ? id.toUpperCase() : m.number}`),`${unitName(id)} · 先攻 ${initiative ?? "尚未公开"}`,"initiative"));});
    $("MonsterCards").replaceChildren();Object.entries(view.monster_cards).forEach(([kind,card])=>{const b=tip(el("div","gh-monster-card"),explanations.monster[1],"monster");b.append(el("strong","",`${monsters[kind].join(" ")} · ⌛ ${card.initiative}`),el("div","",`${card.name} · ${card.move===null ? "不移动" : `👣 ${card.move>=0 ? "+" : ""}${card.move}`} · ⚔️ ${card.attack>=0 ? "+" : ""}${card.attack}${card.shield ? ` · 🛡️ ${card.shield}` : ""}`));$("MonsterCards").append(b);});
    $("LastAttack").classList.toggle("hidden",!view.last_attack);
    if(view.last_attack){const a=view.last_attack;const mod=m=>m==="miss" ? "×0" : m==="double" ? "×2" : m>0 ? `+${m}` : m;setText("LastAttack",`${unitName(a.attacker)} → ${unitName(a.target)} · [${a.drawn.map(mod).join(" / ")}] → ⚔️ ${a.damage}`);$("LastAttack").dataset.ghTip=explanations.attack[1];}
    const log=$("Log"),scroll=log.scrollTop;log.replaceChildren();[...view.log].reverse().forEach(row=>log.append(el("li","",`R${row.round} · ${row.text}`)));log.scrollTop=scroll;
  }
  function renderReview() {
    const reviewing=["round_review","scenario_review","game_over"].includes(view.phase);
    $("Review").classList.toggle("hidden",!reviewing);if(!reviewing)return;
    setText("ResultTitle",view.result ? `${view.result.won ? "🏆" : "🕯️"} ${view.result.won ? "遭遇胜利" : "公司耗尽"}${view.game_over ? " · 远征完成" : ""}` : `Round ${view.round} complete`);
    $("ResultTitle").dataset.ghTip=view.result ? `${view.result.won ? "胜利（🏆）：两房间的怪物均已击败。" : "失败（🕯️）：所有佣兵耗尽。"}确认后推进或重试。` : explanations.round[1];$("ResultTitle").dataset.ghExplain="round";$("ResultTitle").tabIndex=0;
    setText("ReadyCount",view.game_over ? "Final results" : `${view.ready.length} / ${view.players.length} ready`);
    $("Results").replaceChildren();if(!view.result){const report=el("div","gh-round-report");view.heroes.forEach(h=>{const rows=(view.round_report||[]).filter(row=>row.hero_id===h.id);const group=el("div",`gh-report-group${h.owner===view.you ? " is-yours" : ""}`);group.append(el("strong","",`${className(h)}${h.owner===view.you ? " · You" : ""}`));rows.forEach(row=>group.append(el("div","",row.text)));if(!rows.length)group.append(el("div","","No actions this round."));report.append(group);});$("Results").append(report);}if(view.result)view.result.heroes.forEach(h=>$("Results").append(tip(el("div","gh-score",`${className(h)} · ⭐ ${h.xp} · 💰 ${h.gold} · ⚔️ ${h.kills} 击杀`),"经验（⭐）、金币（💰）与击杀为累计成绩。","loot")));
    const box=$("RestOptions");box.replaceChildren();
    ownHeroes().forEach(h=>{
      if(h.rest_pending){const n=el("div","gh-rest");n.append(el("span","",`${className(h)} · 🔥 ${view.cards[h.rest_pending.card].name}`),button("Accept",matching("rest_accept",{hero_id:h.id}),"rest"),button("Redraw · 1 ❤️",matching("rest_redraw",{hero_id:h.id}),"rest"));box.append(n);}
      else if(opts("short_rest",h.id).length)box.append(button(`${className(h)} · Short Rest`,opts("short_rest",h.id)[0],"rest"));
    });
    const next=opts("next_round")[0]||opts("continue")[0];$("Next").classList.toggle("hidden",view.game_over);$("Next").disabled=!enabled(next);$("Next").textContent=view.ready.includes(view.you) ? "Ready ✓" : view.phase==="round_review" ? "Next Round" : view.result?.won ? "Continue" : "Retry";$("Next").onclick=()=>dispatch(next);
  }
  function renderActions() {
    if(!view || view.phase==="setup")return;
    const h=hero(),box=$("Actions");box.replaceChildren();$("SelectedAction").replaceChildren();$("SelectedAction").classList.toggle("hidden",!selectedAction);
    if(selectedAction){const action=selectedAction;const label=action.type==="move" ? `Move → [${action.q}, ${action.r}]` : `${view.active?.effects[view.active.index]?.kind==="heal" ? "Heal" : "Attack"} → ${unitName(action.target)}`;$("SelectedAction").append(el("span","",label),button(action.type==="move" ? "Move" : view.active?.effects[view.active.index]?.kind==="heal" ? "Heal" : "Attack",action,action.type==="move" ? "map" : "attack","gh-primary"),localButton("Cancel",()=>{selectedAction=null;renderMap();renderActions();}));}
    let message="Spectating · hands are private.";
    if(h){
      if(view.damage){
        const d=view.damage,ours=heroesOwn(d.hero_id);message=`${unitName(d.hero_id)} · ${d.source} → ${d.amount} damage`;
        if(ours){box.append(button(`Take ${d.amount} Damage`,matching("damage",{hero_id:d.hero_id,cards:[]}),"damage","gh-danger"));
          const use=opts("damage",d.hero_id).find(o=>o.cards.length===selected.length&&o.cards.length&&o.cards.every(c=>selected.includes(c)));
          box.append(button("Lose & Prevent",use,"damage","gh-primary"));
          ["hand","discard"].forEach(p=>{const b=localButton(p==="hand" ? "1 hand card" : "2 discards",()=>{damagePile=p;selected=[];renderHand();renderActions();},"damage");b.setAttribute("aria-pressed",String(damagePile===p));box.append(b);});
          message += ` · Select ${damagePile==="hand" ? "1 hand card" : "2 discarded cards"}, or take the damage.`;
        }
      }else if(h.exhausted)message="Exhausted · watch the company and confirm round results.";
      else if(view.phase==="planning"){
        if(h.planned){message=`${className(h)} · Plan locked. Waiting for the company.`;box.append(button("Undo Plan",matching("undo_plan",{hero_id:h.id}),"cards"));}
        else {message=`${className(h)} · Choose 2 cards. First card sets initiative.`;const plan=matching("plan",{hero_id:h.id,cards:selected});box.append(button(selected.length===2 ? `Commit · ⌛ ${view.cards[selected[0]].initiative}` : `Commit · ${selected.length}/2`,plan,"cards","gh-primary"),button("Long Rest · ⌛ 99",matching("long_rest",{hero_id:h.id}),"rest"));}
      }else if(view.phase==="acting"){
        if(view.current!==h.id)message=view.active ? `${unitName(view.current)} · ${view.cards[view.active.card].name} · ${effectText(view.active.effects[view.active.index])}` : `Waiting for ${unitName(view.current)}.`;
        else if(h.resting){message="Long rest · choose one discarded card to lose.";if(opts("end_turn",h.id).length)box.append(button("End Turn",opts("end_turn",h.id)[0],"rest"));}
        else if(view.active){const e=view.active.effects[view.active.index];message=`${view.cards[view.active.card].name} · ${effectText(e)}${e.kind==="move" ? ` · ${view.active.remaining} remaining` : ""}`;
          if(opts("consume",h.id).length)box.append(button(`Use ${elementInfo[e.consume].join(" ")} · +1`,opts("consume",h.id)[0],"elements"));
          opts("target",h.id).forEach(o=>box.append(localButton(`${e.kind==="heal" ? "❤️" : "⚔️"} ${unitName(o.target)}`,()=>{selectedAction=o;renderMap();renderActions();},e.kind==="heal" ? "conditions" : "attack")));
          box.append(button(e.kind==="move" ? "Finish Move" : "Skip",opts("skip",h.id)[0],"half"));
        }else{message=`${className(h)} · Choose a card half, or End Turn.`;box.append(button("End Turn",matching("end_turn",{hero_id:h.id}),"half"));}
        opts("item",h.id).forEach(o=>box.append(button(o.item==="potion" ? "🧪 Heal 3" : "🥾 Move +2",o,"items")));
      }else message="Review the map and results before continuing.";
    }
    setText("Command",message);
  }
  function heroesOwn(id){return view.heroes.some(h=>h.id===id&&h.owner===view.you);}
  function renderHand() {
    if(!view||view.phase==="setup")return;
    const h=hero(),tabs=$("HeroTabs");tabs.replaceChildren();
    ownHeroes().forEach(unit=>{const b=localButton(`${unit.id.toUpperCase()} ${view.classes[unit.class_id].icon}`,()=>{heroId=unit.id;selected=[];selectedAction=null;renderHand();renderActions();renderMap();},"cards");b.setAttribute("aria-pressed",String(h?.id===unit.id));tabs.append(b);});
    setText("HandTitle",h ? className(h) : "Spectating");
    const box=$("Hand"),scroll=box.scrollTop;box.replaceChildren();
    if(!h){$("Piles").classList.add("hidden");return;}
    const takingDamage=view.damage?.hero_id===h.id&&heroesOwn(h.id),resting=view.current===h.id&&h.resting&&view.phase==="acting"&&!view.damage;
    const acting=view.phase==="acting"&&view.current===h.id&&!takingDamage&&!resting;
    const ids=takingDamage ? h[damagePile] : resting ? h.discard : acting||h.planned ? h.played : h.hand;
    ids.forEach(cid=>{
      const card=view.cards[cid],pickable=takingDamage||(!h.planned&&view.phase==="planning"),n=el(pickable ? "button" : "article",`gh-card${selected.includes(cid) ? " is-selected" : ""}`);
      n.style.setProperty("--class-color",view.classes[h.class_id].color);n.dataset.ghExplain="card";n.dataset.cardId=cid;n.setAttribute("aria-label",cardDescription(card));
      if(pickable){n.type="button";n.disabled=pending||!socket.connected;n.setAttribute("aria-pressed",String(selected.includes(cid)));n.addEventListener("click",()=>{if(explaining)return;const max=takingDamage&&damagePile==="hand" ? 1 : 2;if(selected.includes(cid))selected=selected.filter(c=>c!==cid);else if(selected.length<max)selected.push(cid);else selected=[cid];renderHand();renderActions();});}
      const title=el("div","gh-card-title");title.append(el("span","",card.name),tip(el("strong","",String(card.initiative).padStart(2,"0")),`先攻（⌛）${card.initiative}，越小越早。`,"initiative"));n.append(title);
      ["top","bottom"].forEach(half=>{const part=tip(el("div","gh-card-half"),`${card[half].map(effectText).join("；")}${card[half+"_loss"] ? "。执行牌面能力后失去此牌（🔥 Lost）。" : "。执行后弃置。"}`,"half");part.append(el("b","",`${half==="top" ? "▲ 上半" : "▼ 下半"}${card[half+"_loss"] ? " · 🔥 Lost" : ""}${card.xp ? ` · ⭐ ${card.xp}` : ""}`),el("span","",card[half].map(effectText).join(" → ")));
        if(acting){const actions=el("div","gh-half-buttons");actions.append(button("Use",matching("half",{hero_id:h.id,card:cid,half,basic:false}),"half"),button(half==="top" ? "Basic ⚔️ 2" : "Basic 👣 2",matching("half",{hero_id:h.id,card:cid,half,basic:true}),"half"));part.append(actions);}
        n.append(part);
      });
      if(selected.includes(cid))n.append(el("div","gh-card-selection",takingDamage ? "Selected to lose" : `${selected.indexOf(cid)+1} · ${selected.indexOf(cid)===0 ? "⌛ Initiative" : "Second card"}`));
      if(resting)n.append(button("Lose & Rest",matching("rest_lose",{hero_id:h.id,card:cid}),"rest"));
      box.append(n);
    });
    box.scrollTop=scroll;
    $("Piles").classList.remove("hidden");setText("PileTitle",`Discard ${h.discard_count} · Lost ${h.lost_count}`);$("PileCards").replaceChildren();
    [[h.discard,"🗂️"],[h.lost,"🔥"]].forEach(([list,icon])=>list.forEach(cid=>$("PileCards").append(tip(el("span","",`${icon} ${view.cards[cid].name}`),cardDescription(view.cards[cid]),"cards"))));
  }
  function render() {
    if(!view)return;
    document.getElementById("roomControlsPanel")?.classList.toggle("gh-your-turn",socket.connected&&view.options.some(o=>!["undo_plan","unready","configure","choose_class"].includes(o.type)));
    $("Battle").classList.toggle("hidden",view.phase==="setup");
    setText("Round",view.phase==="setup" ? "Company setup" : `Round ${view.round}`);setText("ScenarioName",`${String(view.scenario).padStart(2,"0")} · ${view.scenarios[view.scenario-1].name}`);
    const status={setup:"Prepare the company",planning:"Choose your two cards",acting:view.damage ? "Damage · choose a response" : `Turn · ${unitName(view.current)}`,round_review:"Round complete · all players confirm",scenario_review:view.result?.won ? "Victory · ready for the next encounter" : "Defeat · ready to retry",game_over:"Expedition complete"}[view.phase];
    setText("Status",!socket.connected ? "Disconnected · reconnecting…" : status);
    renderSetup();renderHeroes();renderReview();if(view.phase!=="setup"){renderMap();renderBattleInfo();renderHand();renderActions();}
  }
  function hideTip(){clearTimeout(tipTimer);tooltip.classList.add("hidden");}
  function showTip(target,auto=false){if(!target?.dataset.ghTip||explaining||dialog.open)return;clearTimeout(tipTimer);tooltip.textContent=target.dataset.ghTip;tooltip.classList.remove("hidden");const r=target.getBoundingClientRect(),b=tooltip.getBoundingClientRect();tooltip.style.left=`${Math.max(12,Math.min(r.left,innerWidth-b.width-12))}px`;tooltip.style.top=`${r.bottom+b.height+12<innerHeight ? r.bottom+6 : Math.max(12,r.top-b.height-6)}px`;if(auto)tipTimer=setTimeout(hideTip,3000);}
  function setExplain(value){explaining=value;panel.classList.toggle("gh-explaining",value);$("ExplainBtn").setAttribute("aria-pressed",String(value));hideTip();}
  function showDialog(title,body,html=false){hideTip();focusBeforeDialog=document.activeElement;setText("DialogTitle",title);if(html)$("DialogBody").innerHTML=body;else $("DialogBody").replaceChildren(el("p","",body));if(!dialog.open)dialog.showModal();$("DialogClose").focus();}
  function explain(target){if(!target)return;const key=target.dataset.ghExplain;let entry=explanations[key];if(key==="card"&&view?.cards[target.dataset.cardId]){const c=view.cards[target.dataset.cardId];entry=[c.name,cardDescription(c)+" "+explanations.cards[1]];}else if(target.dataset.ghTip&&entry)entry=[entry[0],target.dataset.ghTip+" "+entry[1]];if(entry){setExplain(false);showDialog(...entry);}}
  const exempt=target=>target.closest("#gloomhavenHelpBtn,#gloomhavenExplainBtn,#gloomhavenDialog");
  $("HelpBtn").addEventListener("click",()=>{setExplain(false);showDialog("Gloomhaven · Help",help,true);});
  $("ExplainBtn").addEventListener("click",()=>setExplain(!explaining));$("DialogClose").addEventListener("click",()=>dialog.close());
  dialog.addEventListener("close",()=>{if(focusBeforeDialog?.isConnected)focusBeforeDialog.focus();});
  $("ScenarioSelect").addEventListener("change",()=>dispatch(matching("configure",{scenario:Number($("ScenarioSelect").value),difficulty:view.difficulty})));
  $("Difficulty").addEventListener("change",()=>dispatch(matching("configure",{scenario:view.scenario,difficulty:Number($("Difficulty").value)})));
  document.addEventListener("pointerdown",event=>{if(!explaining||panel.classList.contains("hidden")||exempt(event.target))return;event.preventDefault();event.stopImmediatePropagation();const target=[...panel.querySelectorAll("[data-gh-explain]")].reverse().find(n=>{const r=n.getBoundingClientRect();return r.width&&r.height&&event.clientX>=r.left&&event.clientX<=r.right&&event.clientY>=r.top&&event.clientY<=r.bottom;});suppressClick=true;clearTimeout(suppressTimer);suppressTimer=setTimeout(()=>{suppressClick=false;},700);explain(target);},true);
  document.addEventListener("click",event=>{if(suppressClick){suppressClick=false;event.preventDefault();event.stopImmediatePropagation();return;}if(!explaining||panel.classList.contains("hidden")||exempt(event.target))return;event.preventDefault();event.stopImmediatePropagation();explain(event.target.closest("[data-gh-explain]"));},true);
  document.addEventListener("keydown",event=>{if(panel.classList.contains("hidden"))return;if(event.key==="Escape"){setExplain(false);hideTip();clearSelection();}if(explaining&&!exempt(event.target)&&["Enter"," "].includes(event.key)){event.preventDefault();event.stopImmediatePropagation();explain(event.target.closest("[data-gh-explain]"));}},true);
  panel.addEventListener("pointerover",event=>{if(event.pointerType==="mouse")showTip(event.target.closest("[data-gh-tip]"));});panel.addEventListener("pointerout",event=>{if(event.pointerType==="mouse")hideTip();});panel.addEventListener("focusin",event=>showTip(event.target.closest("[data-gh-tip]")));panel.addEventListener("focusout",hideTip);
  panel.addEventListener("click",event=>{const target=event.target.closest("[data-gh-tip]");if(target&&!event.target.closest("button"))showTip(target,true);if(!event.target.closest("button,svg,select,details,dialog,.gh-card")&&(selected.length||selectedAction))clearSelection();});
  document.addEventListener("scroll",hideTip,true);window.addEventListener("resize",()=>{hideTip();if(view)renderMap();});window.addEventListener("blur",hideTip);
  function clearState(){document.getElementById("roomControlsPanel")?.classList.remove("gh-your-turn");view=null;heroId=null;selected=[];selectedAction=null;pending=false;suppressClick=false;clearTimeout(pendingTimer);clearTimeout(suppressTimer);setExplain(false);hideTip();if(dialog.open)dialog.close();["Heroes","Hand","Map","Actions","Log"].forEach(id=>$(id).replaceChildren());["Battle","Setup","Review"].forEach(id=>$(id).classList.add("hidden"));setText("Status","Waiting to start");previousPositionRoom=null;}
  window.renderGloomhavenGameState=data=>{
    if(data?.view?.game_id!=="gloomhaven"||currentGameType!=="gloomhaven"||(data.room_id&&currentRoomState?.room_id!==data.room_id))return;
    const incoming=data.view,phaseChanged=view?.phase!==incoming.phase,newGame=view?.game_token!==incoming.game_token;
    if(newGame){heroId=null;selected=[];previousPositionRoom=null;}
    if(phaseChanged||view?.damage?.hero_id!==incoming.damage?.hero_id)selected=[];
    if(view?.revision!==incoming.revision){pending=false;clearTimeout(pendingTimer);selectedAction=null;}
    view=incoming;
    const forced=view.damage?.hero_id||view.current;
    if(forced&&heroesOwn(forced))heroId=forced;
    if(!ownHeroes().some(h=>h.id===heroId))heroId=ownHeroes()[0]?.id||null;
    const h=hero();if(h?.hand&&view.phase==="planning"&&!h.planned)selected=selected.filter(c=>h.hand.includes(c));
    if(h?.pos){const r=view.cells.find(c=>c.q===h.pos[0]&&c.r===h.pos[1])?.room;if(roomMode&&r&&r!==previousPositionRoom)roomMode=r;previousPositionRoom=r;}
    render();
  };
  window.clearGloomhavenState=clearState;
  window.showGloomhavenHeaderActions=visible=>{header.style.display=visible ? "flex" : "none";if(!visible)clearState();};
  function syncRoom(state){if(state?.game_type!=="gloomhaven"||state.status==="lobby")clearState();}
  function sync(){socket.on("room:state",syncRoom);socket.on("system:error",()=>{pending=false;clearTimeout(pendingTimer);render();});socket.on("disconnect",()=>{pending=false;clearTimeout(pendingTimer);hideTip();render();});socket.on("connect",render);if(typeof currentRoomState!=="undefined")syncRoom(currentRoomState);if(typeof lastGameStatePayload!=="undefined"&&lastGameStatePayload?.game_type==="gloomhaven")window.renderGloomhavenGameState(lastGameStatePayload);}
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",sync,{once:true});else sync();
})();
