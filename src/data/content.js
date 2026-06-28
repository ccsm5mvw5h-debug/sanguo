export const STRATEGY_CARDS = Object.freeze([
  { id: 'fire-attack', name: '火攻', description: '使目标损失 80 兵力；智力压制时提高 20%，周瑜使用时翻倍。', target: 'opponent' },
  { id: 'equal-wealth', name: '均富', description: '从最富有的对手处获得双方黄金差额的 25%。', target: 'richest' },
  { id: 'harvest', name: '丰收', description: '立即获得 200 粮草与 2 木材。', target: 'self' },
  { id: 'sabotage', name: '破坏', description: '随机降低目标的一座已升级城市。', target: 'opponent' },
  { id: 'empty-fort', name: '空城计', description: '免除下一次需要支付的过路费。', target: 'self' },
  { id: 'recruit', name: '募兵', description: '消耗 100 粮草，补充 100 兵力。', target: 'self' },
]);

export const EVENTS = Object.freeze([
  { id: 'good-harvest', name: '五谷丰登', description: '获得 180 粮草。' },
  { id: 'imperial-gift', name: '朝廷赏赐', description: '获得 160 金。' },
  { id: 'bandits', name: '山贼侵扰', description: '损失 60 兵力。' },
  { id: 'flood', name: '水患', description: '损失 120 粮草与 1 木材。' },
  { id: 'public-praise', name: '万民称颂', description: '获得 18 威望。' },
  { id: 'forced-march', name: '急行军', description: '前进 3 格，不再次触发落脚事件。' },
]);

export const MARKET_ITEMS = Object.freeze([
  { id: 'food', name: '军粮', price: 80, description: '+180 粮草' },
  { id: 'troops', name: '募兵令', price: 120, description: '+100 兵力' },
  { id: 'timber', name: '木料', price: 100, description: '+3 木材' },
  { id: 'weapon', name: '青釭剑', price: 260, description: '武器战力 +2（不可叠加）' },
  { id: 'armor', name: '明光铠', price: 260, description: '防守战力 +2（不可叠加）' },
]);
