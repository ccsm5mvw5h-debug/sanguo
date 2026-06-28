const CITY_NAMES = [
  '洛阳', '邺城', '南皮', '平原', '下邳', '小沛', '陈留', '许昌', '汝南', '寿春',
  '广陵', '建业', '吴郡', '会稽', '丹阳', '新都', '鄱阳', '豫章', '临川', '江夏',
  '襄阳', '江陵', '长沙', '武陵', '零陵', '桂阳', '苍梧', '南海', '交趾', '九真',
  '日南', '朱崖', '合浦', '郁林', '牂牁', '永昌', '建宁', '越巂', '成都', '梓潼',
  '涪陵', '江州', '巴西', '巴东', '汉中', '武都', '阴平', '汶山', '汉嘉', '沈黎',
  '云南', '兴古', '天水', '陇西', '金城', '武威', '张掖', '酒泉', '敦煌', '西域长史府',
  '朔方', '五原', '云中', '雁门', '太原', '上党', '代郡', '渔阳', '右北平', '辽西',
  '辽东', '玄菟', '乐浪', '带方', '真番', '临屯', '广阳', '渤海', '河间', '清河',
  '魏郡', '河东', '河内', '上郡', '西河', '冯翊', '扶风', '安定', '北地', '新平',
  '广魏', '南安', '狄道', '临渭', '襄武', '成纪', '街亭', '柳城', '易京', '函谷关',
];

const TIER_CONFIG = {
  1: { count: 10, price: [750, 900], rent: [280, 350], wood: [2, 3], prestige: 1, garrison: 90 },
  2: { count: 20, price: [550, 700], rent: [200, 260], wood: [1, 2], prestige: 1, garrison: 60 },
  3: { count: 30, price: [350, 500], rent: [130, 180], wood: [1, 1], prestige: 1, garrison: 30 },
  4: { count: 40, price: [150, 300], rent: [50, 110], wood: [0, 1], prestige: 2, garrison: 15 },
};

function interpolate([min, max], index, count) {
  if (count === 1) return min;
  return Math.round(min + ((max - min) * index) / (count - 1));
}

function tierForIndex(index) {
  if (index < 10) return 1;
  if (index < 30) return 2;
  if (index < 60) return 3;
  return 4;
}

export const CITIES = CITY_NAMES.map((name, id) => {
  const tier = tierForIndex(id);
  const tierStart = tier === 1 ? 0 : tier === 2 ? 10 : tier === 3 ? 30 : 60;
  const config = TIER_CONFIG[tier];
  const tierIndex = id - tierStart;
  return Object.freeze({
    id,
    name,
    tier,
    price: interpolate(config.price, tierIndex, config.count),
    baseRent: interpolate(config.rent, tierIndex, config.count),
    wood: interpolate(config.wood, tierIndex, config.count),
    prestige: config.prestige,
    garrison: config.garrison,
  });
});

export { TIER_CONFIG };
