import test from 'node:test';
import assert from 'node:assert/strict';

import {
  ACTIONS,
  INITIAL_GOLD,
  PHASES,
  applyTurnIncome,
  calculateCombatPower,
  calculateHandLimit,
  calculateRent,
  challengeCity,
  checkVictory,
  createGame,
  getCityPurchaseAvailability,
  getFerryAvailability,
  getHospitalAvailability,
  getMarketItemAvailability,
  getStrategyCardAvailability,
  getStrategyDrawAvailability,
  getUpgradeAvailability,
  moveCurrentPlayer,
  resolveBankruptcy,
  restoreGame,
  rollDice,
  runAITurn,
  serializableGame,
  settleOwnedCities,
  startTurn,
} from '../src/game/engine.js';
import { CITIES } from '../src/data/cities.js';

const fixedRng = (value) => () => value;

test('新游戏创建一名玩家和三名 AI，并进入准备阶段', () => {
  const game = createGame({ humanGeneralId: 'zhaoyun', rng: fixedRng(0) });
  assert.equal(game.players.length, 4);
  assert.equal(game.players.filter((player) => player.isHuman).length, 1);
  assert.equal(game.players[0].gold, 10_500);
  assert.equal(game.phase, PHASES.PREPARATION);
});

test('袁绍在 10500 基础初始金上获得额外 200 金', () => {
  const game = createGame({ humanGeneralId: 'yuanshao', rng: fixedRng(0) });
  assert.equal(game.players[0].gold, 10_700);
});

test('基础初始金足够购买 15 座最高价的二级城郡', () => {
  const highestMediumCityPrice = Math.max(...CITIES.filter((city) => city.tier === 2).map((city) => city.price));
  assert.equal(highestMediumCityPrice, 700);
  assert.ok(INITIAL_GOLD >= highestMediumCityPrice * 15);
});

test('购城不可用时说明缺少黄金及解锁标准', () => {
  const game = createGame({ humanGeneralId: 'zhaoyun', rng: fixedRng(0) });
  game.phase = PHASES.LANDING;
  game.players[0].gold = 100;
  const availability = getCityPurchaseAvailability(game);
  assert.equal(availability.allowed, false);
  assert.match(availability.reason, /黄金不足.*缺少 650 金/);
  assert.equal(availability.requirement, '至少持有 750 金。');
});

test('升级不可用时同时说明黄金、木材缺口和完整标准', () => {
  const game = createGame({ humanGeneralId: 'zhaoyun', rng: fixedRng(0) });
  const player = game.players[0];
  game.phase = PHASES.POST_ACTION;
  game.cityStates[0] = { cityId: 0, ownerId: player.id, level: 1 };
  player.properties = [{ cityId: 0, level: 1 }];
  player.gold = 100;
  player.wood = 0;
  const availability = getUpgradeAvailability(game);
  assert.equal(availability.allowed, false);
  assert.match(availability.reason, /黄金缺少 275 金/);
  assert.match(availability.reason, /木材缺少 2/);
  assert.equal(availability.requirement, '升至 2 级需要 375 金和 2 木材。');
});

test('渡口和医馆会显示费用门槛，孙权与华佗保留免费特技', () => {
  const ferryGame = createGame({ humanGeneralId: 'zhaoyun', rng: fixedRng(0) });
  ferryGame.players[0].position = 14;
  ferryGame.players[0].gold = 49;
  assert.deepEqual(getFerryAvailability(ferryGame), {
    allowed: false,
    reason: '黄金不足：当前 49 金，缺少 1 金。',
    requirement: '乘船需要 50 金；孙权免费。',
    cost: 50,
  });

  const sunQuanGame = createGame({ humanGeneralId: 'sunquan', rng: fixedRng(0) });
  sunQuanGame.players[0].position = 14;
  sunQuanGame.players[0].gold = 0;
  assert.equal(getFerryAvailability(sunQuanGame).allowed, true);

  const hospitalGame = createGame({ humanGeneralId: 'zhaoyun', rng: fixedRng(0) });
  hospitalGame.players[0].position = 123;
  hospitalGame.players[0].gold = 79;
  assert.equal(getHospitalAvailability(hospitalGame).allowed, false);
  assert.equal(getHospitalAvailability(hospitalGame).requirement, '治疗需要 80 金；华佗免费。');

  const huaTuoGame = createGame({ humanGeneralId: 'huatuo', rng: fixedRng(0) });
  huaTuoGame.players[0].position = 123;
  huaTuoGame.players[0].gold = 0;
  assert.equal(getHospitalAvailability(huaTuoGame).allowed, true);
});

test('市场商品会说明金钱门槛，已拥有的装备不能重复购买', () => {
  const game = createGame({ humanGeneralId: 'zhaoyun', rng: fixedRng(0) });
  const player = game.players[0];
  player.gold = 0;
  const food = getMarketItemAvailability(game, 'food');
  assert.equal(food.allowed, false);
  assert.match(food.reason, /黄金不足/);
  assert.match(food.requirement, /购买军粮需要 \d+ 金/);

  player.gold = 10_500;
  player.weapon = 2;
  const weapon = getMarketItemAvailability(game, 'weapon');
  assert.equal(weapon.allowed, false);
  assert.match(weapon.reason, /已经装备/);
  assert.equal(weapon.requirement, '无需重复购买；当前武器加成已达到 +2。');
});

test('计策会说明阶段、资源和目标条件', () => {
  const game = createGame({ humanGeneralId: 'zhaoyun', rng: fixedRng(0) });
  const player = game.players[0];
  player.hand = [{ id: 'recruit', name: '募兵', target: 'self' }];
  game.phase = PHASES.MOVEMENT;
  assert.equal(getStrategyCardAvailability(game, 0).requirement, '只能在自己的行动后阶段使用计策。');

  game.phase = PHASES.POST_ACTION;
  player.food = 99;
  const recruit = getStrategyCardAvailability(game, 0);
  assert.equal(recruit.allowed, false);
  assert.equal(recruit.requirement, '使用“募兵”需要至少 100 粮草。');

  player.hand = [{ id: 'sabotage', name: '破坏', target: 'opponent' }];
  const target = game.players[1];
  const sabotage = getStrategyCardAvailability(game, 0, target.id);
  assert.equal(sabotage.allowed, false);
  assert.equal(sabotage.requirement, '目标必须至少拥有一座 2 级或 3 级城市。');
});

test('手牌已满时说明抽牌失败原因和释放手牌标准', () => {
  const game = createGame({ humanGeneralId: 'zhaoyun', rng: fixedRng(0) });
  game.players[0].hand = Array.from({ length: 4 }, (_, index) => ({ id: `card-${index}` }));
  const availability = getStrategyDrawAvailability(game);
  assert.equal(availability.allowed, false);
  assert.match(availability.reason, /手牌已满/);
  assert.match(availability.requirement, /少于 4 张/);
});

test('智力决定手牌上限', () => {
  assert.equal(calculateHandLimit(10, 'zhugeliang'), 6);
  assert.equal(calculateHandLimit(8), 5);
  assert.equal(calculateHandLimit(5), 4);
  assert.equal(calculateHandLimit(4), 3);
});

test('开始回合发放基础俸禄并处理袁绍粮耗', () => {
  const game = createGame({ humanGeneralId: 'yuanshao', rng: fixedRng(0) });
  const player = game.players[0];
  startTurn(game);
  assert.equal(player.gold, 10_784);
  assert.equal(player.food, 490);
  assert.equal(game.phase, PHASES.MOVEMENT);
});

test('移动越过起点时按魅力获得额外黄金', () => {
  const game = createGame({ humanGeneralId: 'zhaoyun', rng: fixedRng(0) });
  game.players[0].position = 133;
  game.phase = PHASES.MOVEMENT;
  moveCurrentPlayer(game, 4);
  assert.equal(game.players[0].position, 2);
  assert.equal(game.players[0].gold, 10_660);
  assert.equal(game.phase, PHASES.LANDING);
});

test('骰子只在移动阶段生效并返回 1 到 6', () => {
  const game = createGame({ humanGeneralId: 'zhaoyun', rng: fixedRng(0.99) });
  game.phase = PHASES.MOVEMENT;
  assert.equal(rollDice(game), 6);
  assert.equal(game.lastRoll, 6);
  assert.equal(game.phase, PHASES.LANDING);
});

test('租金随城市等级增长，刘备自付减少 15%', () => {
  const baseCity = { baseRent: 100 };
  assert.equal(calculateRent(baseCity, 1), 100);
  assert.equal(calculateRent(baseCity, 2), 150);
  assert.equal(calculateRent(baseCity, 3), 220);
  assert.equal(calculateRent(baseCity, 1, { generalId: 'liubei' }), 85);
});

test('战力公式包含武力、兵力、装备、城防、守军和骰子', () => {
  assert.equal(calculateCombatPower({ might: 8, troops: 400, weapon: 2, roll: 6 }), 24);
  assert.equal(calculateCombatPower({ might: 8, troops: 400, armor: 2, cityLevel: 2, garrison: 90, roll: 6, defending: true }), 28.8);
});

test('挑战成功免除租金，失败损失 5% 兵力并缴费', () => {
  const game = createGame({ humanGeneralId: 'zhaoyun', rng: fixedRng(0) });
  const attacker = game.players[0];
  const defender = game.players[1];
  attacker.gold = 500;
  defender.gold = 500;
  const city = { baseRent: 100, garrison: 15 };

  const result = challengeCity(game, { attacker, defender, city, cityLevel: 1, attackRoll: 1, defenseRoll: 6 });
  assert.equal(result.won, false);
  assert.equal(attacker.troops, 380);
  assert.equal(attacker.gold, 400);
  assert.equal(defender.gold, 615);
});

test('地产结算应用收益递减、维护费与兵力超限粮耗', () => {
  const game = createGame({ humanGeneralId: 'zhaoyun', rng: fixedRng(0) });
  const player = game.players[0];
  player.troops = 620;
  player.gold = 1000;
  player.properties = Array.from({ length: 21 }, (_, cityId) => ({ cityId, level: cityId === 0 ? 2 : 1 }));
  const beforeFood = player.food;
  const report = settleOwnedCities(game, player);
  assert.equal(report.incomeMultiplier, 0.9);
  assert.equal(report.maintenance, 91);
  assert.equal(player.food, beforeFood - 6);
  assert.ok(player.gold > 1000);
});

test('全局俸禄公式为 80 + 回合数 * 4', () => {
  const game = createGame({ humanGeneralId: 'zhaoyun', rng: fixedRng(0) });
  game.round = 5;
  const player = game.players[0];
  const result = applyTurnIncome(game, player);
  assert.equal(result.salary, 100);
});

test('威望达到 240 时立即获胜', () => {
  const game = createGame({ humanGeneralId: 'zhaoyun', rng: fixedRng(0) });
  game.players[2].prestige = 240;
  assert.deepEqual(checkVictory(game), { winnerId: game.players[2].id, reason: 'prestige' });
});

test('无黄金且无地产会破产，仅剩一方时判定破产胜利', () => {
  const game = createGame({ humanGeneralId: 'zhaoyun', rng: fixedRng(0) });
  for (const player of game.players.slice(1)) {
    player.gold = 0;
    player.properties = [];
    resolveBankruptcy(game, player);
  }
  assert.deepEqual(checkVictory(game), { winnerId: game.players[0].id, reason: 'bankruptcy' });
});

test('动作常量包含三种对手地产处理', () => {
  assert.deepEqual([ACTIONS.PAY_RENT, ACTIONS.CHALLENGE, ACTIONS.SIEGE], ['pay-rent', 'challenge', 'siege']);
});

test('存档可以恢复且随机函数不会写入存档', () => {
  const game = createGame({ humanGeneralId: 'zhaoyun', rng: fixedRng(0.2) });
  startTurn(game);
  const data = serializableGame(game);
  assert.equal('rng' in data, false);
  const restored = restoreGame(JSON.parse(JSON.stringify(data)), fixedRng(0.4));
  assert.equal(restored.players[0].generalId, 'zhaoyun');
  assert.equal(restored.phase, PHASES.MOVEMENT);
  assert.equal(restored.rng(), 0.4);
});

test('四方 AI 可以连续运行至终局且资源保持有效数值', () => {
  let seed = 20260629;
  const rng = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 0x1_0000_0000;
  };
  const game = createGame({ humanGeneralId: 'zhaoyun', rng });
  game.players[0].isHuman = false;
  let turns = 0;
  while (game.phase !== PHASES.GAME_OVER && turns < 800) {
    runAITurn(game);
    turns += 1;
  }
  assert.equal(game.phase, PHASES.GAME_OVER);
  assert.ok(turns < 800);
  for (const player of game.players) {
    assert.ok([player.gold, player.troops, player.food, player.wood, player.prestige].every(Number.isFinite));
    assert.ok(player.troops >= 1);
    assert.ok(player.food >= 0);
  }
});
