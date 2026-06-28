import test from 'node:test';
import assert from 'node:assert/strict';

import {
  ACTIONS,
  PHASES,
  applyTurnIncome,
  calculateCombatPower,
  calculateHandLimit,
  calculateRent,
  challengeCity,
  checkVictory,
  createGame,
  moveCurrentPlayer,
  resolveBankruptcy,
  restoreGame,
  rollDice,
  runAITurn,
  serializableGame,
  settleOwnedCities,
  startTurn,
} from '../src/game/engine.js';

const fixedRng = (value) => () => value;

test('新游戏创建一名玩家和三名 AI，并进入准备阶段', () => {
  const game = createGame({ humanGeneralId: 'zhaoyun', rng: fixedRng(0) });
  assert.equal(game.players.length, 4);
  assert.equal(game.players.filter((player) => player.isHuman).length, 1);
  assert.equal(game.players[0].gold, 200);
  assert.equal(game.phase, PHASES.PREPARATION);
});

test('袁绍获得初始 200 金加成', () => {
  const game = createGame({ humanGeneralId: 'yuanshao', rng: fixedRng(0) });
  assert.equal(game.players[0].gold, 400);
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
  assert.equal(player.gold, 484);
  assert.equal(player.food, 490);
  assert.equal(game.phase, PHASES.MOVEMENT);
});

test('移动越过起点时按魅力获得额外黄金', () => {
  const game = createGame({ humanGeneralId: 'zhaoyun', rng: fixedRng(0) });
  game.players[0].position = 133;
  game.phase = PHASES.MOVEMENT;
  moveCurrentPlayer(game, 4);
  assert.equal(game.players[0].position, 2);
  assert.equal(game.players[0].gold, 360);
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
