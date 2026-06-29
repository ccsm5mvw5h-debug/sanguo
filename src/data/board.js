export const TILE_TYPES = Object.freeze({
  STATE: 'state',
  STRATEGY: 'strategy',
  EVENT: 'event',
  MARKET: 'market',
  PRISON: 'prison',
  START: 'start',
  HOSPITAL: 'hospital',
  FERRY: 'ferry',
});

const FUNCTIONAL_TILES = new Map([
  [2, 'STRATEGY'], [4, 'EVENT'], [7, 'MARKET'], [11, 'STRATEGY'],
  [14, 'FERRY'], [17, 'EVENT'], [20, 'MARKET'], [23, 'STRATEGY'],
  [27, 'PRISON'], [30, 'EVENT'], [32, 'FERRY'], [36, 'MARKET'],
  [39, 'STRATEGY'], [44, 'EVENT'], [48, 'PRISON'], [52, 'FERRY'],
  [56, 'EVENT'], [59, 'STRATEGY'], [65, 'MARKET'], [69, 'FERRY'],
  [71, 'EVENT'], [73, 'STRATEGY'], [80, 'EVENT'], [83, 'MARKET'],
  [87, 'STRATEGY'], [91, 'EVENT'], [97, 'FERRY'], [101, 'EVENT'],
  [105, 'STRATEGY'], [110, 'MARKET'], [114, 'EVENT'], [119, 'STRATEGY'],
  [123, 'HOSPITAL'], [127, 'EVENT'], [131, 'HOSPITAL'],
]);

const FERRY_ROUTES = Object.freeze({
  14: 85,
  32: 110,
  52: 97,
  69: 123,
  97: 131,
});

let cityId = 0;
export const BOARD = Array.from({ length: 135 }, (_, index) => {
  if (index === 0) {
    cityId += 1;
    return Object.freeze({ index, type: TILE_TYPES.START, cityId: 0 });
  }
  const functionalType = FUNCTIONAL_TILES.get(index);
  if (functionalType) {
    const tile = { index, type: TILE_TYPES[functionalType] };
    if (functionalType === 'FERRY') tile.destination = FERRY_ROUTES[index];
    return Object.freeze(tile);
  }
  const tile = Object.freeze({ index, type: TILE_TYPES.STATE, cityId });
  cityId += 1;
  return tile;
});

export const TILE_LABELS = Object.freeze({
  [TILE_TYPES.STRATEGY]: '计策',
  [TILE_TYPES.EVENT]: '事件',
  [TILE_TYPES.MARKET]: '市场',
  [TILE_TYPES.PRISON]: '监牢',
  [TILE_TYPES.START]: '洛阳·起点',
  [TILE_TYPES.HOSPITAL]: '医馆',
  [TILE_TYPES.FERRY]: '渡口',
});
