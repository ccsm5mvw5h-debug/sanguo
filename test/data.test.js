import test from 'node:test';
import assert from 'node:assert/strict';

import { BOARD, TILE_TYPES } from '../src/data/board.js';
import { CITIES } from '../src/data/cities.js';
import { GENERALS } from '../src/data/generals.js';

test('地图包含 135 格、100 城和 35 个功能格', () => {
  assert.equal(BOARD.length, 135);
  assert.equal(CITIES.length, 100);
  assert.equal(BOARD.filter((tile) => tile.cityId !== undefined).length, 100);
  assert.equal(BOARD.filter((tile) => tile.cityId === undefined).length, 35);
});

test('所有城市恰好出现一次，所有格子类型有效', () => {
  const cityIds = BOARD.filter((tile) => tile.cityId !== undefined).map((tile) => tile.cityId);
  assert.deepEqual([...cityIds].sort((a, b) => a - b), Array.from({ length: 100 }, (_, index) => index));
  assert.ok(BOARD.every((tile) => Object.values(TILE_TYPES).includes(tile.type)));
});

test('所有渡口只把玩家送往更靠前的格子', () => {
  const ferries = BOARD.filter((tile) => tile.type === TILE_TYPES.FERRY);
  assert.ok(ferries.length > 0);
  for (const ferry of ferries) {
    assert.ok(ferry.destination > ferry.index, `第 ${ferry.index + 1} 格渡口不能向后传送`);
    assert.ok(ferry.destination < BOARD.length);
  }
});

test('城市等级遵循 10:20:30:40，价格和租金在文档区间内', () => {
  const tierCounts = CITIES.reduce((counts, city) => {
    counts[city.tier] = (counts[city.tier] ?? 0) + 1;
    return counts;
  }, {});
  assert.deepEqual(tierCounts, {
    1: 10,
    2: 20,
    3: 30,
    4: 40,
  });

  const ranges = {
    1: { price: [750, 900], rent: [280, 350] },
    2: { price: [550, 700], rent: [200, 260] },
    3: { price: [350, 500], rent: [130, 180] },
    4: { price: [150, 300], rent: [50, 110] },
  };
  for (const city of CITIES) {
    const range = ranges[city.tier];
    assert.ok(city.price >= range.price[0] && city.price <= range.price[1]);
    assert.ok(city.baseRent >= range.rent[0] && city.baseRent <= range.rent[1]);
  }
});

test('提供设计文档中的 12 名武将', () => {
  assert.equal(GENERALS.length, 12);
  assert.deepEqual(GENERALS.map((general) => general.name), [
    '吕布', '关羽', '张飞', '赵云', '诸葛亮', '司马懿',
    '周瑜', '曹操', '刘备', '孙权', '袁绍', '华佗',
  ]);
});
