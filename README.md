# sanguo

## 三国志·天运

根据《三国志·天运》游戏设计文档 v3.1 制作的网页端可玩原型。

## 当前版本

- 1 名玩家对 3 名 AI，本地单机
- 100 座城市、135 格环形棋盘
- 回合、骰子移动、地产购买/升级、过路费、挑战与攻城
- 俸禄、资源产出、人口税、地产维持费、周期赏赐
- 计策、事件、市场、医馆、监牢、渡口
- 12 名武将及主要属性规则
- 破产与 240 威望双胜利条件
- 轻量 Canvas 棋盘，不依赖图片素材

## 运行

需要 Node.js 20 或更高版本：

```bash
npm start
```

然后访问终端显示的本地地址。

## 验证

```bash
npm test
npm run check
```

## 设计说明

原文存在缺失和冲突的数据，临时口径及后续待办记录在 [`docs/DECISIONS.md`](docs/DECISIONS.md) 与 [`docs/IMPLEMENTATION_LOG.md`](docs/IMPLEMENTATION_LOG.md)。
