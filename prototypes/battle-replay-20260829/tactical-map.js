'use strict';
(() => {
  const NS = 'http://www.w3.org/2000/svg';
  const svg = document.getElementById('tactical-map');
  if (!svg) return;

  const lanes = [
    { id: 'upper', label: '上路', y: 110 },
    { id: 'middle', label: '中路', y: 310 },
    { id: 'lower', label: '下路', y: 510 },
  ];
  const towers = [];
  const addTower = (side, tier, lane, x, y) => towers.push({ id: `${side}_${lane}_${tier}`, side, tier, lane, x, y, label: `${side === 'ally' ? '我方' : '敵方'}${lanes.find(item => item.id === lane).label}${tier === 'inner' ? '內塔' : tier === 'middle' ? '中塔' : '外塔'}` });
  for (const lane of lanes) {
    const enemyInner = lane.id === 'middle' ? [172, lane.y] : [90, lane.id === 'upper' ? 203 : 417];
    const allyInner = lane.id === 'middle' ? [828, lane.y] : [910, lane.id === 'upper' ? 203 : 417];
    addTower('enemy', 'inner', lane.id, ...enemyInner);
    addTower('enemy', 'middle', lane.id, 275, lane.y);
    addTower('enemy', 'outer', lane.id, 425, lane.y);
    addTower('ally', 'outer', lane.id, 575, lane.y);
    addTower('ally', 'middle', lane.id, 725, lane.y);
    addTower('ally', 'inner', lane.id, ...allyInner);
  }
  const wilds = [
    { id: 'enemy_upper_wild', side: 'enemy', label: '敵方上野區', x: 305, y: 145, width: 100, height: 130, roadX: 355, fromY: 110, toY: 310 },
    { id: 'enemy_lower_wild', side: 'enemy', label: '敵方下野區', x: 305, y: 345, width: 100, height: 130, roadX: 355, fromY: 310, toY: 510 },
    { id: 'ally_upper_wild', side: 'ally', label: '我方上野區', x: 595, y: 145, width: 100, height: 130, roadX: 645, fromY: 110, toY: 310 },
    { id: 'ally_lower_wild', side: 'ally', label: '我方下野區', x: 595, y: 345, width: 100, height: 130, roadX: 645, fromY: 310, toY: 510 },
  ];
  const branches = lanes.flatMap(lane => [
    { id: `enemy_${lane.id}_branch`, side: 'enemy', lane: lane.id, x1: 425, x2: 468, y: lane.y },
    { id: `ally_${lane.id}_branch`, side: 'ally', lane: lane.id, x1: 532, x2: 575, y: lane.y },
  ]);
  const model = {
    schemaVersion: 1,
    id: 'justiceol-tactical-map-draft-1',
    orientation: { enemy: 'left', ally: 'right', upper: 'top', lower: 'bottom' },
    precision: 'topology-and-relative-proportion',
    lanes,
    towers,
    wilds,
    corridor: { x: 500, y1: 110, y2: 510, width: 64, hasWater: false, branches },
    homes: [
      { side: 'enemy', flag: [90, 310], middleGate: [172, 310], stair: [38, 310], d: 82, sideTowerSpanRatio: 2.6, stairRatio: .6 },
      { side: 'ally', flag: [910, 310], middleGate: [828, 310], stair: [962, 310], d: 82, sideTowerSpanRatio: 2.6, stairRatio: .6 },
    ],
  };

  function element(name, attrs = {}, text = '') {
    const node = document.createElementNS(NS, name);
    Object.entries(attrs).forEach(([key, value]) => node.setAttribute(key, value));
    if (text) node.textContent = text;
    return node;
  }
  function append(name, attrs, text, parent = svg) {
    const node = element(name, attrs, text);
    parent.append(node);
    return node;
  }
  function path(points) { return points.map((point, index) => `${index ? 'L' : 'M'}${point[0]} ${point[1]}`).join(' '); }

  const defs = append('defs');
  const pattern = append('pattern', { id: 'grid', width: 40, height: 40, patternUnits: 'userSpaceOnUse' }, '', defs);
  append('path', { d: 'M40 0H0V40', fill: 'none', stroke: '#33505e', 'stroke-width': 1, opacity: .32 }, '', pattern);
  append('rect', { x: 18, y: 18, width: 964, height: 584, rx: 112, fill: '#122b37', stroke: '#45606d', 'stroke-width': 3, class: 'arena' });
  append('rect', { x: 25, y: 25, width: 950, height: 570, rx: 105, fill: 'url(#grid)' });

  const zoneLayer = append('g', { class: 'zones' });
  for (const home of model.homes) {
    const enemy = home.side === 'enemy';
    const points = enemy ? [[35, 178], [105, 160], [162, 192], [178, 310], [162, 428], [105, 460], [35, 442]] : [[965, 178], [895, 160], [838, 192], [822, 310], [838, 428], [895, 460], [965, 442]];
    append('path', { d: `${path(points)}Z`, fill: enemy ? '#40262c' : '#173946', stroke: enemy ? '#9d5355' : '#3a8eaa', 'stroke-width': 3, class: `home ${home.side}` }, '', zoneLayer);
    const stairX = home.stair[0];
    for (let index = 0; index < 4; index++) append('line', { x1: stairX + (enemy ? index * 5 : -index * 5), y1: 284, x2: stairX + (enemy ? index * 5 : -index * 5), y2: 336, stroke: '#9d927f', 'stroke-width': 3 }, '', zoneLayer);
    append('text', { x: enemy ? 83 : 917, y: 388, fill: '#b9cbd3', 'font-size': 12, 'text-anchor': 'middle' }, enemy ? '敵方家中' : '我方家中', zoneLayer);
    append('text', { x: stairX, y: 350, fill: '#d8c69a', 'font-size': 10, 'text-anchor': 'middle' }, '樓梯', zoneLayer);
  }
  for (const wild of wilds) {
    append('rect', { x: wild.x, y: wild.y, width: wild.width, height: wild.height, rx: 42, fill: '#405e4d', stroke: '#66866e', 'stroke-width': 2, class: `wild ${wild.side}` }, '', zoneLayer);
    append('line', { x1: wild.roadX, y1: wild.fromY, x2: wild.roadX, y2: wild.toY, stroke: '#9b9681', 'stroke-width': 16, class: 'wild-road' }, '', zoneLayer);
    for (const edgeX of [wild.x + 8, wild.x + wild.width - 8]) for (let y = wild.y + 24; y < wild.y + wild.height; y += 28) append('path', { d: `M${edgeX - 7} ${y + 7}L${edgeX} ${y - 8}L${edgeX + 7} ${y + 7}Z`, fill: '#5f5142', stroke: '#77634d', 'stroke-width': 1, class: 'mountain' }, '', zoneLayer);
    append('text', { x: wild.x + wild.width / 2, y: wild.y + wild.height / 2 + 4, fill: '#e4ecdf', 'font-size': 11, 'font-weight': 700, 'text-anchor': 'middle' }, wild.label, zoneLayer);
  }

  const roadLayer = append('g', { class: 'roads', fill: 'none', 'stroke-linecap': 'round', 'stroke-linejoin': 'round' });
  const enemyRoutes = {
    upper: [[90, 203], [132, 110], [425, 110]], middle: [[172, 310], [425, 310]], lower: [[90, 417], [132, 510], [425, 510]],
  };
  const allyRoutes = {
    upper: [[910, 203], [868, 110], [575, 110]], middle: [[828, 310], [575, 310]], lower: [[910, 417], [868, 510], [575, 510]],
  };
  for (const route of [...Object.values(enemyRoutes), ...Object.values(allyRoutes)]) {
    append('path', { d: path(route), stroke: '#4d5554', 'stroke-width': 30 }, '', roadLayer);
    append('path', { d: path(route), stroke: '#9f9a87', 'stroke-width': 22, class: 'lane-road' }, '', roadLayer);
  }
  append('line', { x1: 500, y1: 110, x2: 500, y2: 510, stroke: '#4d5554', 'stroke-width': 74, class: 'corridor-base' }, '', roadLayer);
  append('line', { x1: 500, y1: 110, x2: 500, y2: 510, stroke: '#aaa590', 'stroke-width': 62, class: 'corridor' }, '', roadLayer);
  for (const branch of branches) {
    append('line', { x1: branch.x1, y1: branch.y, x2: branch.x2, y2: branch.y, stroke: '#4d5554', 'stroke-width': 30 }, '', roadLayer);
    append('line', { x1: branch.x1, y1: branch.y, x2: branch.x2, y2: branch.y, stroke: '#aaa590', 'stroke-width': 22, class: `branch ${branch.side}` }, '', roadLayer);
  }

  const objectiveLayer = append('g', { class: 'objectives' });
  for (const tower of towers) {
    const color = tower.side === 'ally' ? '#65caed' : '#f17873';
    const radius = tower.tier === 'outer' ? 13 : tower.tier === 'middle' ? 11 : 10;
    const group = append('g', { class: `tower ${tower.side} ${tower.tier}`, 'data-id': tower.id }, '', objectiveLayer);
    append('title', {}, tower.label, group);
    append('circle', { cx: tower.x, cy: tower.y, r: radius + 5, fill: '#0b1720', stroke: color, 'stroke-width': 3 }, '', group);
    append('circle', { cx: tower.x, cy: tower.y, r: radius, fill: color, opacity: .82 }, '', group);
    append('text', { x: tower.x, y: tower.y + 4, fill: '#081018', 'font-size': 10, 'font-weight': 800, 'text-anchor': 'middle' }, tower.tier === 'inner' ? '內' : tower.tier === 'middle' ? '中' : '外', group);
  }
  for (const home of model.homes) {
    const color = home.side === 'ally' ? '#65caed' : '#f17873';
    const [x, y] = home.flag;
    const group = append('g', { class: `flag ${home.side}` }, '', objectiveLayer);
    append('path', { d: `M${x} ${y - 20}L${x + 16} ${y}L${x} ${y + 20}L${x - 16} ${y}Z`, fill: color, stroke: '#0b1720', 'stroke-width': 4 }, '', group);
    append('text', { x, y: y + 4, fill: '#081018', 'font-size': 11, 'font-weight': 800, 'text-anchor': 'middle' }, '旗', group);
  }

  const labelLayer = append('g', { class: 'map-labels', fill: '#e8f0f3', 'font-family': 'system-ui, Microsoft JhengHei, sans-serif' });
  for (const lane of lanes) {
    append('text', { x: 500, y: lane.y - 43, 'font-size': 14, 'font-weight': 750, 'text-anchor': 'middle' }, lane.label, labelLayer);
  }
  append('text', { x: 500, y: 292, fill: '#3b4140', 'font-size': 13, 'font-weight': 800, 'text-anchor': 'middle', transform: 'rotate(-90 500 292)' }, '中央大道・無水', labelLayer);
  append('text', { x: 72, y: 56, fill: '#f6a09a', 'font-size': 16, 'font-weight': 800 }, '敵方', labelLayer);
  append('text', { x: 928, y: 56, fill: '#88daf5', 'font-size': 16, 'font-weight': 800, 'text-anchor': 'end' }, '我方', labelLayer);
  append('text', { x: 500, y: 38, fill: '#b6c7cf', 'font-size': 11, 'text-anchor': 'middle' }, '上路 ↑', labelLayer);
  append('text', { x: 500, y: 592, fill: '#b6c7cf', 'font-size': 11, 'text-anchor': 'middle' }, '↓ 下路', labelLayer);

  window.tacticalMap = { ready: true, model: JSON.parse(JSON.stringify(model)) };
})();
