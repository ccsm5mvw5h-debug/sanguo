export const GENERALS = Object.freeze([
  { id: 'lvbu', name: '吕布', title: '飞将', might: 10, intelligence: 3, charm: 5, skill: '战斗武力 +3，战后额外损失 10% 兵力' },
  { id: 'guanyu', name: '关羽', title: '威震', might: 9, intelligence: 6, charm: 7, skill: '战斗获胜获得 60 威望（3 回合冷却）' },
  { id: 'zhangfei', name: '张飞', title: '怒吼', might: 9, intelligence: 4, charm: 5, skill: '每圈可在对手城市勒索 100 金' },
  { id: 'zhaoyun', name: '赵云', title: '一身是胆', might: 8, intelligence: 6, charm: 8, skill: '免疫监牢' },
  { id: 'zhugeliang', name: '诸葛亮', title: '奇门', might: 4, intelligence: 10, charm: 9, skill: '手牌上限额外 +1' },
  { id: 'simayi', name: '司马懿', title: '隐忍', might: 5, intelligence: 9, charm: 8, skill: '每 3 回合侦察一名对手手牌' },
  { id: 'zhouyu', name: '周瑜', title: '火攻专精', might: 6, intelligence: 9, charm: 8, skill: '火攻伤害翻倍' },
  { id: 'caocao', name: '曹操', title: '挟天子', might: 7, intelligence: 9, charm: 8, skill: '每两圈经过起点额外抽一张计策' },
  { id: 'liubei', name: '刘备', title: '仁德', might: 6, intelligence: 7, charm: 10, skill: '自付过路费减少 15%' },
  { id: 'sunquan', name: '孙权', title: '水师', might: 6, intelligence: 8, charm: 8, skill: '渡口免费，每圈首次购地八折' },
  { id: 'yuanshao', name: '袁绍', title: '门阀', might: 5, intelligence: 5, charm: 8, skill: '初始 +200 金，每回合多消耗 10 粮' },
  { id: 'huatuo', name: '华佗', title: '悬壶', might: 2, intelligence: 8, charm: 9, skill: '医馆免费且治疗翻倍，治疗获得 5 威望' },
]);

export const GENERAL_BY_ID = Object.freeze(Object.fromEntries(GENERALS.map((general) => [general.id, general])));
