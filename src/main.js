import { BOARD, TILE_TYPES } from './data/board.js';
import { CITIES } from './data/cities.js';
import { MARKET_ITEMS } from './data/content.js';
import { GENERALS, GENERAL_BY_ID } from './data/generals.js';
import {
  PHASES,
  buyCurrentCity,
  buyMarketItem,
  calculateHandLimit,
  calculateRent,
  challengeCity,
  createGame,
  endTurn,
  getCurrentPlayer,
  getLandingContext,
  marketPrice,
  payCurrentRent,
  resolveFunctionalTile,
  restoreGame,
  rollDice,
  runAITurn,
  serializableGame,
  siegeCurrentCity,
  skipLandingAction,
  startTurn,
  tileName,
  upgradeCurrentCity,
  useStrategyCard,
} from './game/engine.js';

const SAVE_KEY = 'sanguozhi-tianyun-save-v1';
const PHASE_LABELS = {
  [PHASES.PREPARATION]: '准备阶段',
  [PHASES.MOVEMENT]: '移动阶段',
  [PHASES.LANDING]: '落脚阶段',
  [PHASES.POST_ACTION]: '行动后阶段',
  [PHASES.GAME_OVER]: '终局',
};

const TILE_COLORS = {
  [TILE_TYPES.STATE]: '#7f9080',
  [TILE_TYPES.START]: '#e2c36f',
  [TILE_TYPES.STRATEGY]: '#829bc1',
  [TILE_TYPES.EVENT]: '#c66f5f',
  [TILE_TYPES.MARKET]: '#d7af5a',
  [TILE_TYPES.PRISON]: '#836b8c',
  [TILE_TYPES.HOSPITAL]: '#71a58e',
  [TILE_TYPES.FERRY]: '#5e9ab0',
};

const els = {
  app: document.querySelector('#app'),
  setup: document.querySelector('#setup-screen'),
  generalGrid: document.querySelector('#general-grid'),
  startButton: document.querySelector('#start-button'),
  continueButton: document.querySelector('#continue-button'),
  newGameButton: document.querySelector('#new-game-button'),
  saveButton: document.querySelector('#save-button'),
  playerStrip: document.querySelector('#player-strip'),
  roundLabel: document.querySelector('#round-label'),
  turnKicker: document.querySelector('#turn-kicker'),
  turnTitle: document.querySelector('#turn-title'),
  dice: document.querySelector('#dice-display'),
  board: document.querySelector('#board'),
  location: document.querySelector('#location-summary'),
  command: document.querySelector('#command-content'),
  handCount: document.querySelector('#hand-count'),
  handList: document.querySelector('#hand-list'),
  log: document.querySelector('#game-log'),
  toast: document.querySelector('#toast'),
  gameOver: document.querySelector('#game-over'),
  winnerTitle: document.querySelector('#winner-title'),
  winnerDescription: document.querySelector('#winner-description'),
  victoryNewGame: document.querySelector('#victory-new-game'),
};

let selectedGeneralId = 'zhaoyun';
let game = null;
let busy = false;
let toastTimer = null;

function showToast(message) {
  els.toast.textContent = message;
  els.toast.classList.add('visible');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => els.toast.classList.remove('visible'), 1800);
}

function renderSetup() {
  els.generalGrid.innerHTML = GENERALS.map((general) => `
    <button class="general-option ${general.id === selectedGeneralId ? 'selected' : ''}" type="button" data-general="${general.id}">
      <h3>${general.name} · ${general.title}</h3>
      <span>${general.skill}</span>
      <div class="general-stats"><b>武 ${general.might}</b><b>智 ${general.intelligence}</b><b>魅 ${general.charm}</b></div>
      <p class="general-skill">${general.id === 'zhaoyun' ? '推荐初次游玩：免疫监牢，属性均衡。' : '&nbsp;'}</p>
    </button>
  `).join('');
  els.continueButton.hidden = !localStorage.getItem(SAVE_KEY);
}

function startNewGame() {
  game = createGame({ humanGeneralId: selectedGeneralId });
  els.setup.hidden = true;
  els.app.hidden = false;
  els.gameOver.hidden = true;
  startTurn(game);
  persistGame(false);
  render();
  window.scrollTo({ top: 0, behavior: 'auto' });
}

function continueGame() {
  try {
    const data = JSON.parse(localStorage.getItem(SAVE_KEY));
    game = restoreGame(data);
    els.setup.hidden = true;
    els.app.hidden = false;
    render();
    window.scrollTo({ top: 0, behavior: 'auto' });
    if (!getCurrentPlayer(game).isHuman && game.phase !== PHASES.GAME_OVER) runAISequence();
  } catch {
    localStorage.removeItem(SAVE_KEY);
    showToast('存档无法读取，请重新开局');
    renderSetup();
  }
}

function resetToSetup() {
  if (game && !window.confirm('确定结束当前战局并返回选将吗？已保存的进度仍会保留。')) return;
  game = null;
  els.gameOver.hidden = true;
  els.app.hidden = true;
  els.setup.hidden = false;
  renderSetup();
}

function persistGame(notify = true) {
  if (!game) return;
  localStorage.setItem(SAVE_KEY, JSON.stringify(serializableGame(game)));
  if (notify) showToast('战局已保存在本机');
}

function renderPlayers() {
  els.playerStrip.innerHTML = game.players.map((player, index) => {
    const general = GENERAL_BY_ID[player.generalId];
    return `
      <article class="player-card ${index === game.currentPlayerIndex ? 'active' : ''} ${player.bankrupt ? 'bankrupt' : ''}" style="--player-color:${player.color}">
        <div class="player-name-row"><strong>${player.name}</strong><span>${general.title}${player.bankrupt ? ' · 已破产' : ''}</span></div>
        <div class="resource-row">
          <span>黄金<b>${Math.round(player.gold)}</b></span>
          <span>兵 / 粮<b>${player.troops} / ${player.food}</b></span>
          <span>城 / 威<b>${player.properties.length} / ${player.prestige}</b></span>
        </div>
      </article>
    `;
  }).join('');
}

function boardPoint(index) {
  const angle = (index / BOARD.length) * Math.PI * 2 - Math.PI / 2;
  return { x: 500 + Math.cos(angle) * 408, y: 340 + Math.sin(angle) * 275, angle };
}

function drawBoard() {
  const canvas = els.board;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  const gradient = ctx.createRadialGradient(500, 330, 40, 500, 330, 520);
  gradient.addColorStop(0, '#253127');
  gradient.addColorStop(1, '#101711');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.strokeStyle = 'rgba(216,180,92,.17)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  BOARD.forEach((_, index) => {
    const { x, y } = boardPoint(index);
    if (index === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  const first = boardPoint(0);
  ctx.lineTo(first.x, first.y);
  ctx.stroke();

  BOARD.forEach((tile, index) => {
    const { x, y } = boardPoint(index);
    const cityState = tile.cityId !== undefined ? game.cityStates[tile.cityId] : null;
    const owner = cityState?.ownerId ? game.players.find((player) => player.id === cityState.ownerId) : null;
    const isCurrentTile = index === getCurrentPlayer(game).position;
    const radius = isCurrentTile ? 8 : tile.cityId === undefined ? 5 : 3.5;
    if (owner) {
      ctx.beginPath();
      ctx.arc(x, y, radius + 3, 0, Math.PI * 2);
      ctx.fillStyle = owner.color;
      ctx.fill();
    }
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fillStyle = TILE_COLORS[tile.type];
    ctx.fill();
    if (isCurrentTile) {
      ctx.strokeStyle = '#fff3bd';
      ctx.lineWidth = 2;
      ctx.stroke();
    }
  });

  game.players.filter((player) => !player.bankrupt).forEach((player, playerIndex) => {
    const point = boardPoint(player.position);
    const offset = 12 + playerIndex * 6;
    ctx.beginPath();
    ctx.arc(point.x + Math.cos(point.angle) * offset, point.y + Math.sin(point.angle) * offset, 5.5, 0, Math.PI * 2);
    ctx.fillStyle = player.color;
    ctx.fill();
    ctx.strokeStyle = '#101511';
    ctx.lineWidth = 2;
    ctx.stroke();
  });

  const player = getCurrentPlayer(game);
  const tile = BOARD[player.position];
  const general = GENERAL_BY_ID[player.generalId];
  ctx.textAlign = 'center';
  ctx.fillStyle = '#d8b45c';
  ctx.font = '700 15px sans-serif';
  ctx.fillText(`第 ${game.round} 轮 · ${PHASE_LABELS[game.phase]}`, 500, 260);
  ctx.fillStyle = '#f0eddf';
  ctx.font = '44px STKaiti, KaiTi, serif';
  ctx.fillText(tileName(tile), 500, 320);
  ctx.fillStyle = '#a7ad9e';
  ctx.font = '15px sans-serif';
  ctx.fillText(`${general.name}驻足于第 ${tile.index + 1} 格`, 500, 354);
  ctx.fillStyle = 'rgba(216,180,92,.28)';
  ctx.fillRect(405, 384, 190, 1);
  ctx.fillStyle = '#899287';
  ctx.font = '12px sans-serif';
  ctx.fillText('金线为天下路 · 外环色标为势力归属', 500, 410);
}

function locationDescription(context) {
  if (context.city) {
    const ownerText = context.owner ? `归属 ${context.owner.name}` : '尚为无主之地';
    return `${ownerText} · ${context.city.tier} 级州郡 · 地价 ${context.city.price} · 基础过路费 ${context.city.baseRent}`;
  }
  const descriptions = {
    [TILE_TYPES.STRATEGY]: '抽取一张随机计策，手牌满时将错过。',
    [TILE_TYPES.EVENT]: '触发一项随机天下事件。',
    [TILE_TYPES.MARKET]: '可按主将魅力折扣购买军需与宝物。',
    [TILE_TYPES.PRISON]: '赵云免疫；其他武将将跳过下回合。',
    [TILE_TYPES.HOSPITAL]: '花费 80 金恢复 100 兵力；华佗免费且效果翻倍。',
    [TILE_TYPES.FERRY]: `花费 50 金前往第 ${context.tile.destination + 1} 格；孙权免费。`,
  };
  return descriptions[context.kind] ?? '天下局势瞬息万变。';
}

function button(label, action, style = 'secondary', extra = '') {
  return `<button type="button" class="button ${style} ${extra}" data-action="${action}" ${busy ? 'disabled' : ''}>${label}</button>`;
}

function renderCommands() {
  const player = getCurrentPlayer(game);
  const context = getLandingContext(game);
  els.location.innerHTML = `<strong>${tileName(context.tile)}</strong><p>${locationDescription(context)}</p>`;

  if (!player.isHuman || busy) {
    els.command.innerHTML = `<p>群雄正在推演局势，请稍候……</p>`;
    return;
  }
  if (game.phase === PHASES.MOVEMENT) {
    els.command.innerHTML = `<p>整军已毕。掷骰决定本回合行军距离。</p><div class="command-buttons">${button('掷骰行军', 'roll', 'primary', 'wide')}</div>`;
    return;
  }
  if (game.phase === PHASES.LANDING) {
    if (context.kind === 'unowned-city') {
      const price = player.generalId === 'sunquan' && !player.status.boughtThisRound ? Math.round(context.city.price * 0.8) : context.city.price;
      els.command.innerHTML = `<p>可将 ${context.city.name} 纳入治下，需 ${price} 金。当前持有 ${player.gold} 金。</p><div class="command-buttons">${button(`购入 · ${price} 金`, 'buy-city', 'primary')}${button('暂不购入', 'skip-landing')}</div>`;
    } else if (context.kind === 'opponent-city') {
      const rent = calculateRent(context.city, context.cityState.level, player);
      els.command.innerHTML = `<p>${context.owner.name} 控制此地。可直接缴纳 ${rent} 金，或以兵锋博取免单与战利品。</p><div class="command-buttons">${button(`缴费 · ${rent} 金`, 'pay-rent')}${button('挑战免单', 'challenge')}${button('正式攻城', 'siege', 'danger', 'wide')}</div>`;
    } else if (context.kind === 'owned-city') {
      const next = context.cityState.level + 1;
      const gold = Math.round(context.city.price * (next === 2 ? 0.5 : 0.75));
      const wood = next === 2 ? 2 : 4;
      const upgrade = next <= 3 ? button(`升至 ${next} 级 · ${gold} 金 / ${wood} 木`, 'upgrade', 'secondary', 'wide') : '';
      els.command.innerHTML = `<p>这是你的领地，当前 ${context.cityState.level} 级。升级可提高过路费与城防。</p><div class="command-buttons">${upgrade}${button('继续', 'skip-landing', 'primary', 'wide')}</div>`;
    } else if (context.kind === TILE_TYPES.MARKET) {
      const items = MARKET_ITEMS.map((item) => button(`${item.name} · ${marketPrice(player, item)} 金`, `market:${item.id}`)).join('');
      els.command.innerHTML = `<p>可以买多件军需；完成后离开市场。</p><div class="command-buttons">${items}${button('离开市场', 'resolve-tile', 'primary', 'wide')}</div>`;
    } else if (context.kind === TILE_TYPES.FERRY) {
      els.command.innerHTML = `<p>是否乘船抄近道？抵达目标后不会再次触发落脚事件。</p><div class="command-buttons">${button('乘船', 'use-ferry', 'primary')}${button('不乘', 'skip-ferry')}</div>`;
    } else {
      els.command.innerHTML = `<p>${locationDescription(context)}</p><div class="command-buttons">${button('处理落脚效果', 'resolve-tile', 'primary', 'wide')}</div>`;
    }
    return;
  }
  if (game.phase === PHASES.POST_ACTION) {
    let upgrade = '';
    if (context.kind === 'owned-city' && context.cityState.level < 3) upgrade = button('建设当前城市', 'upgrade', 'secondary');
    els.command.innerHTML = `<p>可以使用一张计策，或结束回合，将天命交给下一方势力。</p><div class="command-buttons">${upgrade}${button('结束回合', 'end-turn', 'primary', upgrade ? '' : 'wide')}</div>`;
    return;
  }
  if (game.phase === PHASES.GAME_OVER) els.command.innerHTML = '<p>天下胜负已定。</p>';
}

function renderHand() {
  const player = getCurrentPlayer(game);
  const general = GENERAL_BY_ID[player.generalId];
  const limit = calculateHandLimit(general.intelligence, player.generalId);
  els.handCount.textContent = `${player.hand.length} / ${limit}`;
  if (!player.hand.length) {
    els.handList.innerHTML = '<div class="empty-state">尚无锦囊，落在计策格可抽取。</div>';
    return;
  }
  const opponents = game.players.filter((candidate) => candidate.id !== player.id && !candidate.bankrupt);
  els.handList.innerHTML = player.hand.map((card, index) => {
    const targetSelect = card.target === 'opponent' ? `<select aria-label="计策目标" data-target-for="${index}">${opponents.map((target) => `<option value="${target.id}">${target.name}</option>`).join('')}</select>` : '';
    const canUse = player.isHuman && game.phase === PHASES.POST_ACTION && !busy;
    return `<article class="hand-card"><header><strong>${card.name}</strong><span class="eyebrow">${card.target === 'self' ? '自身' : card.target === 'richest' ? '最富者' : '对手'}</span></header><p>${card.description}</p><div class="hand-actions">${targetSelect}<button type="button" class="button ghost" data-card-index="${index}" ${canUse ? '' : 'disabled'}>使用</button></div></article>`;
  }).join('');
}

function renderLog() {
  els.log.innerHTML = game.log.length ? game.log.map((entry) => `<li class="${entry.tone}">${entry.message}</li>`).join('') : '<li>史官提笔，静候天下风云。</li>';
}

function renderVictory() {
  if (game.phase !== PHASES.GAME_OVER || !game.winner) {
    els.gameOver.hidden = true;
    return;
  }
  const winner = game.players.find((player) => player.id === game.winner.winnerId);
  els.winnerTitle.textContent = `${winner.name} · 一统天下`;
  els.winnerDescription.textContent = game.winner.reason === 'prestige' ? `${winner.name} 率先达到 240 威望，万民归心。` : `${winner.name} 令其余势力尽数破产，独掌山河。`;
  els.gameOver.hidden = false;
  localStorage.removeItem(SAVE_KEY);
}

function render() {
  if (!game) return;
  const player = getCurrentPlayer(game);
  els.roundLabel.textContent = String(game.round);
  els.turnKicker.textContent = PHASE_LABELS[game.phase];
  els.turnTitle.textContent = `${player.name}的回合`;
  els.dice.textContent = game.lastRoll ?? '—';
  renderPlayers();
  drawBoard();
  renderCommands();
  renderHand();
  renderLog();
  renderVictory();
}

function handleCommand(action) {
  if (busy || !game) return;
  let result;
  if (action === 'roll') rollDice(game);
  else if (action === 'buy-city') {
    result = buyCurrentCity(game);
    if (!result.ok) showToast('黄金不足，无法购入');
  } else if (action === 'skip-landing') skipLandingAction(game);
  else if (action === 'pay-rent') payCurrentRent(game);
  else if (action === 'challenge') challengeCity(game);
  else if (action === 'siege') siegeCurrentCity(game);
  else if (action === 'upgrade') {
    result = upgradeCurrentCity(game);
    if (!result.ok) showToast(result.reason === 'max' ? '城市已达最高等级' : '黄金或木材不足');
  } else if (action === 'resolve-tile') resolveFunctionalTile(game, { useFerry: false });
  else if (action === 'use-ferry') resolveFunctionalTile(game, { useFerry: true });
  else if (action === 'skip-ferry') {
    resolveFunctionalTile(game, { useFerry: false });
  } else if (action.startsWith('market:')) {
    result = buyMarketItem(game, action.slice(7));
    if (!result.ok) showToast('黄金不足');
  } else if (action === 'end-turn') {
    endTurn(game);
    persistGame(false);
    render();
    if (game.phase !== PHASES.GAME_OVER) runAISequence();
    return;
  }
  persistGame(false);
  render();
}

async function runAISequence() {
  busy = true;
  render();
  while (game.phase !== PHASES.GAME_OVER && !getCurrentPlayer(game).isHuman) {
    await new Promise((resolve) => setTimeout(resolve, 520));
    runAITurn(game);
    persistGame(false);
    render();
  }
  busy = false;
  if (game.phase !== PHASES.GAME_OVER && getCurrentPlayer(game).isHuman && game.phase === PHASES.PREPARATION) startTurn(game);
  persistGame(false);
  render();
}

els.generalGrid.addEventListener('click', (event) => {
  const option = event.target.closest('[data-general]');
  if (!option) return;
  selectedGeneralId = option.dataset.general;
  renderSetup();
});
els.startButton.addEventListener('click', startNewGame);
els.continueButton.addEventListener('click', continueGame);
els.newGameButton.addEventListener('click', resetToSetup);
els.victoryNewGame.addEventListener('click', resetToSetup);
els.saveButton.addEventListener('click', () => persistGame(true));
els.command.addEventListener('click', (event) => {
  const target = event.target.closest('[data-action]');
  if (target) handleCommand(target.dataset.action);
});
els.handList.addEventListener('click', (event) => {
  const target = event.target.closest('[data-card-index]');
  if (!target || busy) return;
  const cardIndex = Number(target.dataset.cardIndex);
  const select = els.handList.querySelector(`[data-target-for="${cardIndex}"]`);
  const result = useStrategyCard(game, cardIndex, select?.value);
  if (!result.ok) showToast(result.reason === 'food' ? '粮草不足' : '请选择有效目标');
  persistGame(false);
  render();
});

renderSetup();
