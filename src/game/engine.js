import { BOARD, TILE_TYPES } from '../data/board.js';
import { CITIES } from '../data/cities.js';
import { EVENTS, MARKET_ITEMS, STRATEGY_CARDS } from '../data/content.js';
import { GENERAL_BY_ID, GENERALS } from '../data/generals.js';

export const PHASES = Object.freeze({
  PREPARATION: 'preparation',
  MOVEMENT: 'movement',
  LANDING: 'landing',
  POST_ACTION: 'post-action',
  GAME_OVER: 'game-over',
});

export const ACTIONS = Object.freeze({
  PAY_RENT: 'pay-rent',
  CHALLENGE: 'challenge',
  SIEGE: 'siege',
});

const PLAYER_COLORS = ['#f4d35e', '#ee6c4d', '#63c7b2', '#8d7cff'];
export const INITIAL_GOLD = 10_500;

function randomIndex(game, length) {
  return Math.min(length - 1, Math.floor(game.rng() * length));
}

function randomItem(game, items) {
  return items[randomIndex(game, items.length)];
}

function addLog(game, message, tone = 'normal') {
  game.log.unshift({ id: game.nextLogId++, message, tone });
  game.log = game.log.slice(0, 80);
}

function makePlayer(general, index, isHuman) {
  return {
    id: `player-${index + 1}`,
    name: isHuman ? `你 · ${general.name}` : `AI · ${general.name}`,
    generalId: general.id,
    isHuman,
    color: PLAYER_COLORS[index],
    position: 0,
    gold: INITIAL_GOLD + (general.id === 'yuanshao' ? 200 : 0),
    troops: 400,
    food: 500,
    wood: 0,
    prestige: 0,
    properties: [],
    hand: [],
    weapon: 0,
    armor: 0,
    skipTurns: 0,
    status: { rentShield: 0 },
    cooldowns: {},
    bankrupt: false,
  };
}

export function createGame({ humanGeneralId = 'zhaoyun', aiCount = 3, rng = Math.random } = {}) {
  if (!GENERAL_BY_ID[humanGeneralId]) throw new Error('未知武将');
  const human = GENERAL_BY_ID[humanGeneralId];
  const availableAI = GENERALS.filter((general) => general.id !== humanGeneralId);
  const aiGenerals = [];
  while (aiGenerals.length < aiCount && availableAI.length) {
    const index = Math.min(availableAI.length - 1, Math.floor(rng() * availableAI.length));
    aiGenerals.push(availableAI.splice(index, 1)[0]);
  }
  const generals = [human, ...aiGenerals];
  return {
    version: 1,
    players: generals.map((general, index) => makePlayer(general, index, index === 0)),
    cityStates: CITIES.map((city) => ({ cityId: city.id, ownerId: null, level: 1 })),
    currentPlayerIndex: 0,
    round: 1,
    turn: 1,
    phase: PHASES.PREPARATION,
    lastRoll: null,
    winner: null,
    pending: null,
    log: [],
    nextLogId: 1,
    rng,
  };
}

export function getCurrentPlayer(game) {
  return game.players[game.currentPlayerIndex];
}

export function getGeneral(player) {
  return GENERAL_BY_ID[player.generalId];
}

export function calculateHandLimit(intelligence, generalId) {
  let limit = 4;
  if (intelligence >= 8) limit += 1;
  if (intelligence <= 4) limit -= 1;
  if (generalId === 'zhugeliang') limit += 1;
  return Math.max(2, limit);
}

export function calculateRent(city, level = 1, payer) {
  const multiplier = level === 3 ? 2.2 : level === 2 ? 1.5 : 1;
  let rent = Math.round(city.baseRent * multiplier);
  if (payer?.generalId === 'liubei') rent = Math.round(rent * 0.85);
  return rent;
}

export function calculateCombatPower({
  might,
  troops,
  weapon = 0,
  armor = 0,
  cityLevel = 1,
  garrison = 0,
  roll = 1,
  defending = false,
  generalId,
}) {
  const luBuBonus = generalId === 'lvbu' ? 3 : 0;
  let power = might + luBuBonus + troops / 50 + roll;
  if (defending) {
    power += armor;
    power += cityLevel === 3 ? 5 : cityLevel === 2 ? 3 : 0;
    power += garrison / 50;
  } else {
    power += weapon;
  }
  return power;
}

function incomeMultiplier(cityCount) {
  if (cityCount >= 60) return 0.5;
  if (cityCount >= 50) return 0.6;
  if (cityCount >= 40) return 0.7;
  if (cityCount >= 30) return 0.8;
  if (cityCount >= 20) return 0.9;
  return 1;
}

export function applyTurnIncome(game, player) {
  const salary = 80 + game.round * 4;
  player.gold += salary;
  return { salary };
}

export function settleOwnedCities(game, player) {
  const multiplier = incomeMultiplier(player.properties.length);
  let grossIncome = 0;
  let wood = 0;
  let prestige = 0;
  let maintenance = 0;

  for (const property of player.properties) {
    const city = CITIES[property.cityId];
    grossIncome += Math.round(city.baseRent * 0.22 * property.level);
    wood += city.wood;
    prestige += city.prestige;
  }

  if (player.properties.length > 10) {
    maintenance = (player.properties.length - 10) * 8;
    for (const property of player.properties) {
      if (property.level === 2) maintenance += 3;
      if (property.level === 3) maintenance += 6;
    }
  }

  const netIncome = Math.round(grossIncome * multiplier);
  player.gold += netIncome - maintenance;
  player.wood += wood;
  player.prestige += prestige;

  let troopFoodCost = 0;
  if (player.troops > 500) {
    troopFoodCost = Math.ceil((player.troops - 500) / 20);
    if (player.troops > 1000) {
      troopFoodCost *= 2;
      player.prestige = Math.max(0, player.prestige - 10);
    }
    player.food = Math.max(0, player.food - troopFoodCost);
  }

  if (player.gold < 0 && player.properties.some((property) => property.level > 1)) {
    const upgraded = player.properties.filter((property) => property.level > 1);
    const selected = upgraded[randomIndex(game, upgraded.length)];
    selected.level -= 1;
    game.cityStates[selected.cityId].level = selected.level;
    addLog(game, `${player.name} 无力支付维持费，${CITIES[selected.cityId].name} 降为 ${selected.level} 级。`, 'danger');
  }

  return { grossIncome, netIncome, wood, prestige, maintenance, troopFoodCost, incomeMultiplier: multiplier };
}

export function startTurn(game) {
  if (game.phase === PHASES.GAME_OVER) return null;
  const player = getCurrentPlayer(game);
  if (player.bankrupt) return endTurn(game);
  game.phase = PHASES.PREPARATION;
  const { salary } = applyTurnIncome(game, player);
  const settlement = settleOwnedCities(game, player);
  if (player.generalId === 'yuanshao') player.food = Math.max(0, player.food - 10);

  for (const key of Object.keys(player.cooldowns)) {
    player.cooldowns[key] = Math.max(0, player.cooldowns[key] - 1);
  }

  addLog(game, `${player.name} 开始回合，领取俸禄 ${salary} 金。`);
  if (player.skipTurns > 0) {
    player.skipTurns -= 1;
    addLog(game, `${player.name} 仍在监牢，本回合跳过。`, 'danger');
    game.phase = PHASES.POST_ACTION;
    return { skipped: true, settlement };
  }
  game.phase = PHASES.MOVEMENT;
  return { skipped: false, settlement };
}

export function moveCurrentPlayer(game, steps) {
  if (game.phase !== PHASES.MOVEMENT) throw new Error('当前不能移动');
  const player = getCurrentPlayer(game);
  const previous = player.position;
  const raw = previous + steps;
  player.position = raw % BOARD.length;
  if (raw >= BOARD.length) {
    const general = getGeneral(player);
    const bonus = general.charm * 20;
    player.gold += bonus;
    addLog(game, `${player.name} 经过洛阳，因魅力获得 ${bonus} 金。`, 'good');
    if (player.generalId === 'caocao' && game.round % 2 === 0) drawStrategyCard(game, player);
  }
  game.lastRoll = steps;
  game.phase = PHASES.LANDING;
  addLog(game, `${player.name} 移动 ${steps} 格，到达 ${tileName(BOARD[player.position])}。`);
  return player.position;
}

export function rollDice(game) {
  const roll = 1 + randomIndex(game, 6);
  moveCurrentPlayer(game, roll);
  return roll;
}

export function tileName(tile) {
  if (tile.cityId !== undefined) return CITIES[tile.cityId].name;
  return {
    [TILE_TYPES.STRATEGY]: '计策格',
    [TILE_TYPES.EVENT]: '事件格',
    [TILE_TYPES.MARKET]: '市场',
    [TILE_TYPES.PRISON]: '监牢',
    [TILE_TYPES.HOSPITAL]: '医馆',
    [TILE_TYPES.FERRY]: '渡口',
  }[tile.type] ?? tile.type;
}

export function getLandingContext(game) {
  const player = getCurrentPlayer(game);
  const tile = BOARD[player.position];
  if (tile.cityId === undefined) return { player, tile, kind: tile.type };
  const city = CITIES[tile.cityId];
  const cityState = game.cityStates[tile.cityId];
  const owner = cityState.ownerId ? game.players.find((candidate) => candidate.id === cityState.ownerId) : null;
  const kind = !owner ? 'unowned-city' : owner.id === player.id ? 'owned-city' : 'opponent-city';
  return { player, tile, city, cityState, owner, kind };
}

function purchaseDiscount(player, city) {
  if (player.generalId === 'sunquan' && !player.status.boughtThisRound) return Math.round(city.price * 0.8);
  return city.price;
}

export function buyCurrentCity(game) {
  const context = getLandingContext(game);
  if (context.kind !== 'unowned-city') throw new Error('这里没有可购买城市');
  const price = purchaseDiscount(context.player, context.city);
  if (context.player.gold < price) return { ok: false, reason: 'gold', price };
  context.player.gold -= price;
  context.cityState.ownerId = context.player.id;
  const property = { cityId: context.city.id, level: 1 };
  context.player.properties.push(property);
  context.player.status.boughtThisRound = true;
  game.phase = PHASES.POST_ACTION;
  addLog(game, `${context.player.name} 以 ${price} 金购入 ${context.city.name}。`, 'good');
  return { ok: true, price, property };
}

export function skipLandingAction(game) {
  game.phase = PHASES.POST_ACTION;
  return { ok: true };
}

function transferRent(game, payer, owner, amount) {
  if (payer.status.rentShield > 0) {
    payer.status.rentShield -= 1;
    addLog(game, `${payer.name} 使用空城计，免除本次过路费。`, 'good');
    return 0;
  }
  payer.gold -= amount;
  owner.gold += Math.round(amount * 1.15);
  addLog(game, `${payer.name} 支付 ${amount} 金过路费，${owner.name} 获得含通胀奖励的 ${Math.round(amount * 1.15)} 金。`, 'danger');
  resolveBankruptcy(game, payer);
  return amount;
}

export function payCurrentRent(game) {
  const context = getLandingContext(game);
  if (context.kind !== 'opponent-city') throw new Error('当前无需支付过路费');
  const rent = calculateRent(context.city, context.cityState.level, context.player);
  transferRent(game, context.player, context.owner, rent);
  game.phase = PHASES.POST_ACTION;
  return { rent };
}

function combatStats(player, roll, defending, city, cityLevel) {
  const general = getGeneral(player);
  return {
    might: general.might,
    troops: player.troops,
    weapon: player.weapon,
    armor: player.armor,
    roll,
    defending,
    cityLevel,
    garrison: city?.garrison ?? 0,
    generalId: player.generalId,
  };
}

function afterCombat(game, player, won) {
  if (player.generalId === 'guanyu' && won && !player.cooldowns.awe) {
    player.prestige += 60;
    player.cooldowns.awe = 3;
    addLog(game, `${player.name} 发动“威震”，获得 60 威望。`, 'good');
  }
  if (player.generalId === 'lvbu') {
    player.troops = Math.max(1, Math.floor(player.troops * 0.9));
    addLog(game, `${player.name} 因“飞将”战后额外损失 10% 兵力。`);
  }
}

export function challengeCity(game, { attacker, defender, city, cityLevel = 1, attackRoll, defenseRoll } = {}) {
  attacker ??= getCurrentPlayer(game);
  if (!defender || !city) {
    const context = getLandingContext(game);
    defender = context.owner;
    city = context.city;
    cityLevel = context.cityState.level;
  }
  attackRoll ??= 1 + randomIndex(game, 6);
  defenseRoll ??= 1 + randomIndex(game, 6);
  const attackPower = calculateCombatPower(combatStats(attacker, attackRoll, false, city, cityLevel));
  const defensePower = calculateCombatPower(combatStats(defender, defenseRoll, true, city, cityLevel));
  const won = attackPower >= defensePower;
  if (!won) {
    attacker.troops = Math.max(1, Math.floor(attacker.troops * 0.95));
    transferRent(game, attacker, defender, calculateRent(city, cityLevel, attacker));
  }
  afterCombat(game, attacker, won);
  game.phase = PHASES.POST_ACTION;
  addLog(game, `${attacker.name} 挑战${won ? '成功，免除过路费' : '失败，损失 5% 兵力并缴费'}（${attackPower.toFixed(1)} : ${defensePower.toFixed(1)}）。`, won ? 'good' : 'danger');
  return { won, attackPower, defensePower, attackRoll, defenseRoll };
}

export function siegeCurrentCity(game) {
  const context = getLandingContext(game);
  if (context.kind !== 'opponent-city') throw new Error('当前不能攻城');
  const attackRoll = 1 + randomIndex(game, 6);
  const defenseRoll = 1 + randomIndex(game, 6);
  const attackPower = calculateCombatPower(combatStats(context.player, attackRoll, false, context.city, context.cityState.level));
  const defensePower = calculateCombatPower(combatStats(context.owner, defenseRoll, true, context.city, context.cityState.level));
  const won = attackPower >= defensePower + 2;
  let loot = 0;
  if (won) {
    loot = Math.max(0, Math.floor(context.owner.gold * 0.35));
    context.owner.gold -= loot;
    context.player.gold += loot;
    const food = Math.min(150, context.owner.food);
    context.owner.food -= food;
    context.player.food += food;
  } else {
    context.player.troops = Math.max(1, Math.floor(context.player.troops * 0.85));
    transferRent(game, context.player, context.owner, calculateRent(context.city, context.cityState.level, context.player));
  }
  afterCombat(game, context.player, won);
  game.phase = PHASES.POST_ACTION;
  addLog(game, `${context.player.name} 攻打 ${context.city.name}${won ? `成功，掠夺 ${loot} 金与粮草` : '失败，损失 15% 兵力并缴费'}（${attackPower.toFixed(1)} : ${defensePower.toFixed(1)}）。`, won ? 'good' : 'danger');
  return { won, attackPower, defensePower, attackRoll, defenseRoll, loot };
}

export function upgradeCurrentCity(game) {
  const context = getLandingContext(game);
  if (context.kind !== 'owned-city') return { ok: false, reason: 'owner' };
  if (context.cityState.level >= 3) return { ok: false, reason: 'max' };
  const nextLevel = context.cityState.level + 1;
  const goldCost = Math.round(context.city.price * (nextLevel === 2 ? 0.5 : 0.75));
  const woodCost = nextLevel === 2 ? 2 : 4;
  if (context.player.gold < goldCost || context.player.wood < woodCost) return { ok: false, reason: 'resources', goldCost, woodCost };
  context.player.gold -= goldCost;
  context.player.wood -= woodCost;
  context.cityState.level = nextLevel;
  const property = context.player.properties.find((candidate) => candidate.cityId === context.city.id);
  property.level = nextLevel;
  addLog(game, `${context.player.name} 将 ${context.city.name} 升至 ${nextLevel} 级。`, 'good');
  return { ok: true, level: nextLevel, goldCost, woodCost };
}

export function drawStrategyCard(game, player = getCurrentPlayer(game)) {
  const card = randomItem(game, STRATEGY_CARDS);
  const general = getGeneral(player);
  const limit = calculateHandLimit(general.intelligence, player.generalId);
  if (player.hand.length >= limit) {
    addLog(game, `${player.name} 手牌已满，错过了 ${card.name}。`);
    return null;
  }
  player.hand.push({ ...card, instanceId: `${game.turn}-${game.nextLogId}-${player.hand.length}` });
  addLog(game, `${player.name} 获得计策“${card.name}”。`, 'good');
  return card;
}

function strategyResisted(game, user, target) {
  const difference = getGeneral(target).intelligence - getGeneral(user).intelligence;
  if (difference < 2) return false;
  const chance = Math.floor(difference / 2) * 0.1;
  return game.rng() < chance;
}

export function useStrategyCard(game, cardIndex, targetId) {
  const player = getCurrentPlayer(game);
  const card = player.hand[cardIndex];
  if (!card) return { ok: false, reason: 'card' };
  const target = targetId ? game.players.find((candidate) => candidate.id === targetId && !candidate.bankrupt) : null;
  if (card.target === 'opponent' && (!target || target.id === player.id)) return { ok: false, reason: 'target' };
  if (target && strategyResisted(game, player, target)) {
    player.hand.splice(cardIndex, 1);
    addLog(game, `${target.name} 识破并抵抗了“${card.name}”。`);
    return { ok: true, resisted: true };
  }
  let result = {};
  if (card.id === 'fire-attack') {
    let damage = player.generalId === 'zhouyu' ? 160 : 80;
    if (getGeneral(player).intelligence > getGeneral(target).intelligence) damage = Math.round(damage * 1.2);
    target.troops = Math.max(1, target.troops - damage);
    result = { damage, targetId: target.id };
  } else if (card.id === 'equal-wealth') {
    const richest = [...game.players].filter((candidate) => !candidate.bankrupt && candidate.id !== player.id).sort((a, b) => b.gold - a.gold)[0];
    const amount = Math.max(0, Math.floor((richest.gold - player.gold) * 0.25));
    richest.gold -= amount;
    player.gold += amount;
    result = { amount, targetId: richest.id };
  } else if (card.id === 'harvest') {
    player.food += 200;
    player.wood += 2;
    result = { food: 200, wood: 2 };
  } else if (card.id === 'sabotage') {
    const upgraded = target.properties.filter((property) => property.level > 1);
    if (upgraded.length) {
      const property = randomItem(game, upgraded);
      property.level -= 1;
      game.cityStates[property.cityId].level = property.level;
      result = { cityId: property.cityId };
    }
  } else if (card.id === 'empty-fort') {
    player.status.rentShield += 1;
    result = { shield: 1 };
  } else if (card.id === 'recruit') {
    if (player.food < 100) return { ok: false, reason: 'food' };
    player.food -= 100;
    player.troops += 100;
    result = { troops: 100 };
  }
  player.hand.splice(cardIndex, 1);
  addLog(game, `${player.name} 使用计策“${card.name}”。`, 'good');
  return { ok: true, cardId: card.id, ...result };
}

export function resolveFunctionalTile(game, { useFerry = true } = {}) {
  const player = getCurrentPlayer(game);
  const tile = BOARD[player.position];
  if (tile.cityId !== undefined) return { type: 'city' };
  let result = { type: tile.type };
  if (tile.type === TILE_TYPES.STRATEGY) {
    result.card = drawStrategyCard(game, player);
  } else if (tile.type === TILE_TYPES.EVENT) {
    const event = randomItem(game, EVENTS);
    if (event.id === 'good-harvest') player.food += 180;
    if (event.id === 'imperial-gift') player.gold += 160;
    if (event.id === 'bandits') player.troops = Math.max(1, player.troops - 60);
    if (event.id === 'flood') {
      player.food = Math.max(0, player.food - 120);
      player.wood = Math.max(0, player.wood - 1);
    }
    if (event.id === 'public-praise') player.prestige += 18;
    if (event.id === 'forced-march') player.position = (player.position + 3) % BOARD.length;
    addLog(game, `${player.name} 遭遇“${event.name}”：${event.description}`, event.id === 'bandits' || event.id === 'flood' ? 'danger' : 'good');
    result.event = event;
  } else if (tile.type === TILE_TYPES.PRISON) {
    if (player.generalId === 'zhaoyun') {
      addLog(game, `${player.name} 发动“一身是胆”，免疫监牢。`, 'good');
    } else {
      player.skipTurns = 1;
      addLog(game, `${player.name} 被关入监牢，将跳过下回合。`, 'danger');
    }
  } else if (tile.type === TILE_TYPES.HOSPITAL) {
    const isHuaTuo = player.generalId === 'huatuo';
    const cost = isHuaTuo ? 0 : 80;
    if (player.gold >= cost) {
      player.gold -= cost;
      player.troops += isHuaTuo ? 200 : 100;
      if (isHuaTuo) player.prestige += 5;
      addLog(game, `${player.name} 在医馆治疗，恢复 ${isHuaTuo ? 200 : 100} 兵力。`, 'good');
    }
  } else if (tile.type === TILE_TYPES.FERRY && useFerry) {
    const cost = player.generalId === 'sunquan' ? 0 : 50;
    if (player.gold >= cost) {
      player.gold -= cost;
      player.position = tile.destination;
      result.destination = tile.destination;
      addLog(game, `${player.name} 支付 ${cost} 金乘船前往 ${tileName(BOARD[player.position])}。`);
    }
  }
  game.phase = PHASES.POST_ACTION;
  return result;
}

export function marketPrice(player, item) {
  return Math.max(1, Math.round(item.price * (1 - 0.02 * getGeneral(player).charm)));
}

export function buyMarketItem(game, itemId) {
  const player = getCurrentPlayer(game);
  const item = MARKET_ITEMS.find((candidate) => candidate.id === itemId);
  if (!item) return { ok: false, reason: 'item' };
  const price = marketPrice(player, item);
  if (player.gold < price) return { ok: false, reason: 'gold', price };
  player.gold -= price;
  if (item.id === 'food') player.food += 180;
  if (item.id === 'troops') player.troops += 100;
  if (item.id === 'timber') player.wood += 3;
  if (item.id === 'weapon') player.weapon = Math.max(player.weapon, 2);
  if (item.id === 'armor') player.armor = Math.max(player.armor, 2);
  addLog(game, `${player.name} 在市场购买 ${item.name}，花费 ${price} 金。`, 'good');
  return { ok: true, price, item };
}

export function resolveBankruptcy(game, player) {
  if (player.gold <= 0 && player.properties.length === 0) {
    player.bankrupt = true;
    addLog(game, `${player.name} 宣告破产。`, 'danger');
  }
  return player.bankrupt;
}

export function checkVictory(game) {
  const prestigeWinner = game.players.find((player) => !player.bankrupt && player.prestige >= 240);
  if (prestigeWinner) return { winnerId: prestigeWinner.id, reason: 'prestige' };
  const active = game.players.filter((player) => !player.bankrupt);
  if (active.length === 1) return { winnerId: active[0].id, reason: 'bankruptcy' };
  return null;
}

function applyPeriodicReward(game) {
  if (game.round % 10 !== 0) return;
  for (const player of game.players.filter((candidate) => !candidate.bankrupt)) {
    player.gold += 300;
    player.food += 150;
  }
  addLog(game, `第 ${game.round} 回合周期赏赐：全体获得 300 金与 150 粮草。`, 'good');
}

export function endTurn(game) {
  const victory = checkVictory(game);
  if (victory) {
    game.winner = victory;
    game.phase = PHASES.GAME_OVER;
    const winner = game.players.find((player) => player.id === victory.winnerId);
    addLog(game, `${winner.name} 通过${victory.reason === 'prestige' ? '威望' : '破产'}条件获胜！`, 'good');
    return victory;
  }
  const current = getCurrentPlayer(game);
  current.status.boughtThisRound = false;
  do {
    game.currentPlayerIndex = (game.currentPlayerIndex + 1) % game.players.length;
    if (game.currentPlayerIndex === 0) {
      game.round += 1;
      applyPeriodicReward(game);
    }
  } while (getCurrentPlayer(game).bankrupt);
  game.turn += 1;
  game.phase = PHASES.PREPARATION;
  game.pending = null;
  game.lastRoll = null;
  return null;
}

export function runAITurn(game) {
  const player = getCurrentPlayer(game);
  if (player.isHuman) throw new Error('不能自动执行玩家回合');
  const preparation = startTurn(game);
  if (preparation?.skipped) {
    endTurn(game);
    return { skipped: true };
  }
  const roll = rollDice(game);
  const context = getLandingContext(game);
  let action = 'skip';
  if (context.kind === 'unowned-city') {
    const price = purchaseDiscount(player, context.city);
    const highValue = context.city.tier <= 2;
    const shouldBuy = player.properties.length < 10 ? game.rng() < 0.9 : highValue && player.properties.length < 20;
    if (shouldBuy && player.gold >= price) {
      buyCurrentCity(game);
      action = 'buy';
    } else skipLandingAction(game);
  } else if (context.kind === 'opponent-city') {
    const general = getGeneral(player);
    const aggressive = ['lvbu', 'guanyu', 'zhangfei'].includes(player.generalId);
    const attackEstimate = general.might + player.troops / 50 + player.weapon;
    const defendEstimate = getGeneral(context.owner).might + context.owner.troops / 50 + context.owner.armor + context.city.garrison / 50;
    if (aggressive && attackEstimate >= defendEstimate + 1) {
      siegeCurrentCity(game);
      action = 'siege';
    } else if (attackEstimate >= defendEstimate + 2) {
      challengeCity(game);
      action = 'challenge';
    } else {
      payCurrentRent(game);
      action = 'rent';
    }
  } else if (context.kind === 'owned-city') {
    const property = player.properties.find((candidate) => candidate.cityId === context.city.id);
    if (property.level < 3 && player.gold > context.city.price && player.wood >= 2) {
      const result = upgradeCurrentCity(game);
      action = result.ok ? 'upgrade' : 'skip';
    }
    skipLandingAction(game);
  } else if (context.kind === TILE_TYPES.MARKET) {
    const desired = player.food < 300 ? 'food' : player.troops < 300 ? 'troops' : null;
    if (desired) buyMarketItem(game, desired);
    resolveFunctionalTile(game, { useFerry: true });
    action = 'market';
  } else {
    resolveFunctionalTile(game, { useFerry: true });
    action = context.kind;
  }

  if (player.hand.length && game.rng() < 0.45) {
    const cardIndex = player.hand.findIndex((card) => card.target === 'self' || card.target === 'richest');
    if (cardIndex >= 0) useStrategyCard(game, cardIndex);
  }
  endTurn(game);
  return { roll, action };
}

export function serializableGame(game) {
  const { rng, ...data } = game;
  return data;
}

export function restoreGame(data, rng = Math.random) {
  if (data.version !== 1) throw new Error('不支持的存档版本');
  return { ...structuredClone(data), rng };
}
