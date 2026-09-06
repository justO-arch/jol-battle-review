'use strict';
(() => {
  const NS = 'http://www.w3.org/2000/svg';
  const $ = id => document.getElementById(id);
  const svg = $('tactical-map');
  if (!svg || window.tacticalMap?.ready !== true) return;

  const params = new URLSearchParams(location.search);
  const overlayMode = params.get('overlay') === '1';
  if (overlayMode) document.body.classList.add('embedded', 'overlay');
  const matchId = overlayMode ? params.get('match') : null;
  const MAP_ID = overlayMode ? 'recorded-minimap' : window.tacticalMap.model.id;
  const MAP_VERSION = window.tacticalMap.model.schemaVersion;
  const SCHEMA_VERSION = 1;
  const PLAN_TYPE = 'justiceol-tactical-plan';
  const CHANNEL = 'justiceol-tactical';
  const VIEW = { width: 1000, height: 620 };
  // 與 tactical-map.js 的競技場外框一致；棋子只能落在這個圓角範圍內。
  const ARENA = { x: 18, y: 18, width: 964, height: 584, rx: 112, inset: 10 };
  const LIMITS = { pieces: 120, arrows: 40, arrowPoints: 24, label: 24, id: 40, history: 40 };
  const ID_PATTERN = /^[A-Za-z0-9_-]{1,40}$/;
  const COUNTDOWN_PATTERN = /^(\d{1,3}):([0-5]\d)$/;
  const COLORS = { ally: '#65caed', enemy: '#f17873', neutral: '#efc979' };
  const ROUTE_COLORS = { red: '#f17873', green: '#52c878', blue: '#65caed', yellow: '#efc979' };
  const legacyRouteColor = side => ({ ally: 'blue', enemy: 'red', neutral: 'yellow' }[side] ?? 'blue');
  const legacyRouteSide = color => ({ blue: 'ally', red: 'enemy', yellow: 'neutral', green: 'neutral' }[color] ?? 'ally');
  const normalizeRouteColor = (color, side) => Object.hasOwn(ROUTE_COLORS, color) ? color : legacyRouteColor(side ?? color);
  // 圖示列順序必須與 scenario-editor.js 的職業表一致（共用 assets/ui/profession-icons.png，25×225）。
  const professions = [
    { id: 'suimeng', label: '碎夢' },
    { id: 'tieyi', label: '鐵衣' },
    { id: 'xuanji', label: '玄機' },
    { id: 'xuehe', label: '血河' },
    { id: 'shenxiang', label: '神相' },
    { id: 'suwen', label: '素問' },
    { id: 'longyin', label: '龍吟' },
    { id: 'jiuling', label: '九靈' },
    { id: 'chaoguang', label: '潮光' },
  ].map((item, index) => ({ ...item, iconIndex: index }));
  const professionById = new Map(professions.map(item => [item.id, item]));

  const clone = value => JSON.parse(JSON.stringify(value));
  const round = value => Number(Number(value).toFixed(1));
  const UNSAFE_TEXT = /[\u0000-\u001f\u007f\u200b-\u200f\u2028\u2029]/g;
  const safeText = value => String(value ?? '').replace(UNSAFE_TEXT, '').trim().slice(0, LIMITS.label);
  const finite = value => typeof value === 'number' && Number.isFinite(value);

  function insideArena(x, y) {
    if (!finite(x) || !finite(y)) return false;
    if (x < 0 || y < 0 || x > VIEW.width || y > VIEW.height) return false;
    if (overlayMode) return ((x - 500) / 478) ** 2 + ((y - 310) / 288) ** 2 <= 1;
    const left = ARENA.x + ARENA.inset, right = ARENA.x + ARENA.width - ARENA.inset;
    const top = ARENA.y + ARENA.inset, bottom = ARENA.y + ARENA.height - ARENA.inset;
    if (x < left || x > right || y < top || y > bottom) return false;
    const radius = ARENA.rx - ARENA.inset;
    const cx = Math.min(Math.max(x, left + radius), right - radius);
    const cy = Math.min(Math.max(y, top + radius), bottom - radius);
    return Math.hypot(x - cx, y - cy) <= radius + 0.001;
  }
  function clampToArena(x, y) {
    if (insideArena(x, y)) return { x: round(x), y: round(y) };
    const centerX = ARENA.x + ARENA.width / 2, centerY = ARENA.y + ARENA.height / 2;
    let low = 0, high = 1;
    for (let step = 0; step < 24; step++) {
      const mid = (low + high) / 2;
      if (insideArena(centerX + (x - centerX) * mid, centerY + (y - centerY) * mid)) low = mid;
      else high = mid;
    }
    return { x: round(centerX + (x - centerX) * low), y: round(centerY + (y - centerY) * low) };
  }

  const state = { pieces: [], arrows: [], reference: { matchLabel: '', countdown: '', remainingSeconds: null } };
  const history = [];
  let selectedId = null;
  let renamingId = null;
  let selectedPointIndex = null;
  let insertMode = false;
  let annotationsHidden = false;
  let draft = null;
  let nextSerial = 1;
  const isBrush = item => item?.kind === 'brush';
  const brushButton = document.createElement('button');
  brushButton.id = 'brush-start'; brushButton.textContent = '＋ 自由畫筆';
  const widthSelect = document.createElement('select');
  widthSelect.id = 'brush-width'; widthSelect.setAttribute('aria-label', '筆畫粗細');
  for (const [i, text] of ['細筆', '中筆', '粗筆'].entries()) widthSelect.append(new Option(text, i + 1));
  widthSelect.value = '2';
  $('arrow-start').before(brushButton, widthSelect);
  brushButton.onclick = () => startBrush($('route-color').value, Number(widthSelect.value));
  widthSelect.onchange = () => setBrushWidth(Number(widthSelect.value));
  $('arrow-delete').textContent = '刪除線／筆畫';
  $('arrow-undo').textContent = '線／筆畫復原';

  const allIds = () => new Set([...state.pieces.map(item => item.id), ...state.arrows.map(item => item.id)]);
  function makeId(prefix) {
    const used = allIds();
    let id = `${prefix}-${nextSerial++}`;
    while (used.has(id)) id = `${prefix}-${nextSerial++}`;
    return id;
  }
  function findPiece(id) { return state.pieces.find(item => item.id === id) ?? null; }
  function findArrow(id) { return state.arrows.find(item => item.id === id) ?? null; }
  function selected() { return findPiece(selectedId) ?? findArrow(selectedId); }
  const title = item => item.label || item.id;
  function snapshot() { return { pieces: clone(state.pieces), arrows: clone(state.arrows), reference: readReferenceForm(), tacticalNotes: $('tactical-notes').value, selectedId, selectedPointIndex }; }
  function remember() {
    history.push(snapshot());
    if (history.length > LIMITS.history) history.shift();
    $('undo').disabled = false;
  }
  function status(text) { $('status').textContent = text; }

  const defs = document.createElementNS(NS, 'defs');
  svg.append(defs);
  for (const [colorName, color] of Object.entries(ROUTE_COLORS)) {
    const marker = document.createElementNS(NS, 'marker');
    for (const [name, value] of Object.entries({ id: `route-head-${colorName}`, viewBox: '0 0 10 10', refX: 8.5, refY: 5, markerWidth: 4.6, markerHeight: 4.6, orient: 'auto-start-reverse' })) marker.setAttribute(name, value);
    const head = document.createElementNS(NS, 'path');
    head.setAttribute('d', 'M0 0L10 5L0 10Z');
    head.setAttribute('fill', color);
    marker.append(head);
    defs.append(marker);
  }
  function layer(className) {
    const node = document.createElementNS(NS, 'g');
    node.setAttribute('class', className);
    svg.append(node);
    return node;
  }
  const arrowLayer = layer('route-layer');
  const pieceLayer = layer('piece-layer');
  const draftLayer = layer('draft-layer');
  function shape(name, attrs = {}, text = '', parent) {
    const node = document.createElementNS(NS, name);
    for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, value);
    if (text) node.textContent = text;
    parent.append(node);
    return node;
  }
  const routeD = points => points.map((point, index) => `${index ? 'L' : 'M'}${point[0]} ${point[1]}`).join(' ');

  function drawPiece(piece) {
    const color = COLORS[piece.side] ?? COLORS.neutral;
    const group = shape('g', { class: `token ${piece.kind} ${piece.side}`, 'data-piece': piece.id }, '', pieceLayer);
    shape('title', {}, `${title(piece)}（${piece.kind === 'marker' ? '中立標記' : piece.side === 'ally' ? '我方' : '敵方'}）`, group);
    if (piece.kind === 'marker') {
      shape('path', { d: `M${piece.x} ${piece.y - 17}L${piece.x + 15} ${piece.y}L${piece.x} ${piece.y + 17}L${piece.x - 15} ${piece.y}Z`, fill: '#0b1720', stroke: color, 'stroke-width': 3 }, '', group);
      shape('path', { d: `M${piece.x} ${piece.y - 8}L${piece.x + 7} ${piece.y}L${piece.x} ${piece.y + 8}L${piece.x - 7} ${piece.y}Z`, fill: color, opacity: .85 }, '', group);
    } else {
      shape('circle', { cx: piece.x, cy: piece.y, r: 17, fill: '#0b1720', stroke: color, 'stroke-width': 3 }, '', group);
      if (piece.kind === 'profession') {
        const icon = professionById.get(piece.profession);
        const nested = shape('svg', { x: piece.x - 12.5, y: piece.y - 12.5, width: 25, height: 25, viewBox: `0 ${icon.iconIndex * 25} 25 25` }, '', group);
        shape('image', { href: 'assets/ui/profession-icons.png', x: 0, y: 0, width: 25, height: 225 }, '', nested);
      } else {
        for (const offset of [-6.5, 0, 6.5]) shape('circle', { cx: piece.x + offset, cy: piece.y, r: 4.2, fill: color, opacity: .9 }, '', group);
        shape('circle', { cx: piece.x, cy: piece.y, r: 11.5, fill: 'none', stroke: color, 'stroke-width': 1.5, 'stroke-dasharray': '4 3' }, '', group);
      }
    }
    if (piece.id === selectedId) shape('circle', { cx: piece.x, cy: piece.y, r: 22, class: 'select-ring' }, '', group);
    shape('text', { x: piece.x, y: piece.y + 33, fill: color, 'text-anchor': 'middle', class: 'token-label' }, title(piece), group);
  }
  function drawArrow(arrow) {
    const colorName = normalizeRouteColor(arrow.color, arrow.side);
    const color = ROUTE_COLORS[colorName];
    const chosen = arrow.id === selectedId;
    const group = shape('g', { class: `route ${colorName}`, 'data-arrow': arrow.id }, '', arrowLayer);
    shape('title', {}, `${title(arrow)}（${isBrush(arrow) ? '自由筆畫' : '調兵路線'}）`, group);
    shape('path', { d: routeD(arrow.points), class: isBrush(arrow) ? 'brush-path' : 'arrow-path', stroke: color,
      ...(isBrush(arrow) ? { fill: 'none', 'stroke-width': arrow.width * 3, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' } : { 'marker-end': `url(#route-head-${colorName})` }), opacity: .92 }, '', group);
    shape('path', { d: routeD(arrow.points), class: 'arrow-hit', 'data-arrow-hit': arrow.id }, '', group);
    if (chosen && !isBrush(arrow)) arrow.points.forEach((point, index) => shape('circle', { cx: point[0], cy: point[1], r: 7, fill: index === selectedPointIndex ? '#fff' : '#0b1720', stroke: color, 'stroke-width': 2.5, class: 'arrow-handle', 'data-arrow-point': arrow.id, 'data-point-index': index }, '', group));
    if (chosen && isBrush(arrow)) shape('circle', { cx: arrow.points[0][0], cy: arrow.points[0][1], r: 6, fill: 'none', stroke: '#fff', 'stroke-width': 2, 'pointer-events': 'none' }, '', group);
    if (arrow.label) shape('text', { x: arrow.points[0][0], y: arrow.points[0][1] - 14, fill: color, 'text-anchor': 'middle', class: 'arrow-label' }, arrow.label, group);
  }
  function drawDraft() {
    draftLayer.replaceChildren();
    if (!draft || !draft.points.length) return;
    const color = ROUTE_COLORS[draft.color] ?? ROUTE_COLORS.blue;
    if (draft.points.length > 1) shape('path', { d: routeD(draft.points), class: isBrush(draft) ? 'brush-path' : 'draft-path', stroke: color, ...(isBrush(draft) ? { fill: 'none', 'stroke-width': draft.width * 3, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' } : {}) }, '', draftLayer);
    if (!isBrush(draft)) draft.points.forEach(point => shape('circle', { cx: point[0], cy: point[1], r: 5, fill: color, opacity: .9 }, '', draftLayer));
  }

  // 顯示名稱可直接在清單內改；內部 id 永遠不動，留白就回到 id。
  function renameItem(id, text) {
    const item = findPiece(id) ?? findArrow(id);
    if (!item) return false;
    const label = safeText(text);
    if (item.label === label) return false;
    remember();
    item.label = label;
    render();
    status(`已更名為 ${title(item)}。`);
    return true;
  }
  function nameEditor(item) {
    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'name-input';
    input.maxLength = LIMITS.label;
    input.value = item.label;
    input.placeholder = item.id;
    input.dataset.nameInput = item.id;
    input.setAttribute('aria-label', `${title(item)} 顯示名稱`);
    let composing = false;
    let cancelled = false;
    input.addEventListener('compositionstart', () => { composing = true; });
    input.addEventListener('compositionend', () => { composing = false; });
    input.addEventListener('keydown', event => {
      event.stopPropagation();
      if (composing || event.isComposing) return;
      if (event.key === 'Enter') { event.preventDefault(); input.blur(); return; }
      if (event.key === 'Escape') { event.preventDefault(); cancelled = true; input.blur(); }
    });
    input.addEventListener('blur', () => {
      const value = input.value;
      renamingId = null;
      if (cancelled || !renameItem(item.id, value)) renderList();
    });
    return input;
  }
  function beginRename(id) {
    if (annotationsHidden || !(findPiece(id) ?? findArrow(id))) return false;
    renamingId = id;
    renderList();
    const input = $('item-list').querySelector(`[data-name-input="${CSS.escape(id)}"]`);
    input?.focus();
    input?.select();
    return true;
  }
  function renderList() {
    const list = $('item-list');
    list.replaceChildren();
    const rows = [...state.pieces, ...state.arrows];
    if (!rows.length) {
      const empty = document.createElement('small');
      empty.textContent = '尚未放置任何棋子、標記或路線。';
      list.append(empty);
    }
    for (const item of rows) {
      const arrow = Array.isArray(item.points);
      const editing = renamingId === item.id;
      const row = document.createElement('div');
      row.className = `item-row ${item.side} ${editing ? 'editing' : ''}`;
      const remove = document.createElement('button');
      remove.type = 'button';
      remove.className = 'remove';
      remove.textContent = '×';
      remove.title = `刪除 ${title(item)}`;
      remove.onclick = () => deleteItem(item.id);
      if (editing) {
        row.append(nameEditor(item), remove);
        list.append(row);
        continue;
      }
      const select = document.createElement('button');
      select.type = 'button';
      select.dataset.item = item.id;
      select.setAttribute('aria-pressed', String(item.id === selectedId));
      const kindLabel = isBrush(item) ? '筆畫' : arrow ? `路線 ${item.points.length} 點` : item.kind === 'marker' ? '中立標記' : item.kind === 'group' ? '小隊' : professionById.get(item.profession).label;
      select.textContent = `${title(item)}・${kindLabel}`;
      if (arrow) select.style.borderLeftColor = ROUTE_COLORS[normalizeRouteColor(item.color, item.side)];
      select.onclick = () => selectItem(item.id);
      const rename = document.createElement('button');
      rename.type = 'button';
      rename.className = 'rename-btn';
      rename.textContent = '選取';
      rename.title = `選取 ${title(item)}`;
      rename.disabled = annotationsHidden;
      rename.onclick = () => selectItem(item.id);
      rename.dataset.item = item.id;
      delete select.dataset.item;
      select.dataset.rename = item.id;
      select.title = '點名稱即可編輯';
      select.onclick = () => beginRename(item.id);
      row.append(select, rename, remove);
      list.append(row);
    }
    $('item-count').textContent = `${state.pieces.length} 棋子／標記・${state.arrows.length} 路線`;
    $('delete').disabled = !selected();
    $('rename').disabled = !selected();
  }
  function render() {
    pieceLayer.replaceChildren();
    arrowLayer.replaceChildren();
    state.arrows.forEach(drawArrow);
    state.pieces.forEach(drawPiece);
    drawDraft();
    renderList();
    syncModeHint();
  }
  function syncModeHint() {
    brushButton.disabled = annotationsHidden || Boolean(draft) || state.arrows.length >= LIMITS.arrows;
    widthSelect.disabled = annotationsHidden || Boolean(draft);
    if (isBrush(selected())) widthSelect.value = String(selected().width);
    $('mode-hint').textContent = isBrush(draft) ? '畫筆模式・拖曳繪製，放開完成' : draft ? `繪製路線中・已放 ${draft.points.length} 點` : insertMode ? '新增節點模式・請點選線段' : selected() ? `已選取 ${title(selected())}${isBrush(selected()) ? '・可拖曳整筆' : ''}` : '選取模式';
    $('add-token').disabled = annotationsHidden;
    $('rename').disabled = annotationsHidden || !selected();
    $('delete').disabled = annotationsHidden || !selected();
    $('clear').disabled = annotationsHidden || (!state.pieces.length && !state.arrows.length);
    $('undo').disabled = annotationsHidden || history.length === 0;
    $('import').disabled = annotationsHidden;
    $('arrow-cancel').disabled = annotationsHidden || !draft;
    $('arrow-start').disabled = annotationsHidden || Boolean(draft) || state.arrows.length >= LIMITS.arrows;
    $('arrow-add-point').disabled = annotationsHidden || !findArrow(selectedId) || isBrush(selected()) || Boolean(draft);
    $('arrow-add-point').setAttribute('aria-pressed', String(insertMode));
    $('arrow-remove-point').disabled = annotationsHidden || !findArrow(selectedId) || isBrush(selected()) || selectedPointIndex == null || findArrow(selectedId).points.length <= 2 || Boolean(draft);
    $('arrow-delete').disabled = annotationsHidden || !findArrow(selectedId) || Boolean(draft);
    $('arrow-undo').disabled = annotationsHidden || history.length === 0;
    $('route-color').disabled = annotationsHidden || Boolean(draft);
    if (findArrow(selectedId)) $('route-color').value = normalizeRouteColor(findArrow(selectedId).color, findArrow(selectedId).side);
  }

  function nextPosition(index) {
    const column = index % 6, row = Math.floor(index / 6) % 6, wave = Math.floor(index / 36);
    return { x: 420 + column * 32 + wave * 7, y: 175 + row * 32 + wave * 7 };
  }
  function safePosition(index) {
    const point = nextPosition(index);
    if (insideArena(point.x, point.y)) return point;
    return { x: 500, y: 310 };
  }

  function addToken(options = {}) {
    if (state.pieces.length >= LIMITS.pieces) {
      status(`單一戰術盤最多 ${LIMITS.pieces} 個棋子或標記。`);
      return null;
    }
    const kind = ['profession', 'group', 'marker'].includes(options.kind) ? options.kind : $('token-kind').value;
    const side = kind === 'marker' ? 'neutral' : ['ally', 'enemy'].includes(options.side) ? options.side : $('token-side').value;
    const profession = kind === 'profession' ? (professionById.has(options.profession) ? options.profession : $('token-profession').value) : null;
    const label = safeText(options.label ?? $('token-label').value);
    const point = options.x !== undefined && options.y !== undefined ? clampToArena(Number(options.x), Number(options.y)) : safePosition(state.pieces.length);
    remember();
    const piece = { id: makeId(kind === 'marker' ? 'marker' : 'token'), kind, side, profession, label, x: point.x, y: point.y, source: 'manual' };
    state.pieces.push(piece);
    selectedId = piece.id;
    selectedPointIndex = null;
    insertMode = false;
    if (options.label === undefined) $('token-label').value = '';
    render();
    status(`已新增 ${title(piece)}，可直接在底圖上拖曳。`);
    postToParent({ type: 'editing-started' });
    return piece.id;
  }
  function selectItem(id) {
    selectedId = findPiece(id) || findArrow(id) ? id : null;
    selectedPointIndex = null;
    insertMode = false;
    const item = selected();
    $('rename-input').value = item?.label ?? '';
    render();
    if (item) status(`已選取 ${title(item)}；${isBrush(item) ? '可拖曳整筆移動。' : Array.isArray(item.points) ? '可選取並拖曳節點，或使用新增／移除節點。' : '可直接拖曳移動。'}`);
    return Boolean(item);
  }
  function moveItem(id, x, y) {
    const piece = findPiece(id);
    if (!piece || !insideArena(x, y)) return false;
    piece.x = round(x);
    piece.y = round(y);
    render();
    return true;
  }
  function renameSelected(text) {
    const item = selected();
    if (!item) return false;
    const label = safeText(text ?? $('rename-input').value);
    remember();
    item.label = label;
    render();
    status(`已更名為 ${title(item)}。`);
    return true;
  }
  function deleteItem(id) {
    const pieceIndex = state.pieces.findIndex(item => item.id === id);
    const arrowIndex = state.arrows.findIndex(item => item.id === id);
    if (pieceIndex < 0 && arrowIndex < 0) return false;
    remember();
    const [removed] = pieceIndex >= 0 ? state.pieces.splice(pieceIndex, 1) : state.arrows.splice(arrowIndex, 1);
    if (selectedId === id) selectedId = null;
    selectedPointIndex = null;
    insertMode = false;
    render();
    status(`已刪除 ${title(removed)}，可按復原取回。`);
    return true;
  }
  function clearAll() {
    if (!state.pieces.length && !state.arrows.length) return false;
    remember();
    state.pieces.splice(0);
    state.arrows.splice(0);
    selectedId = null;
    selectedPointIndex = null;
    insertMode = false;
    draft = null;
    render();
    status('戰術盤已清空，可按復原取回。');
    return true;
  }
  function undo() {
    const previous = history.pop();
    if (!previous) return false;
    state.pieces.splice(0, state.pieces.length, ...clone(previous.pieces));
    state.arrows.splice(0, state.arrows.length, ...clone(previous.arrows));
    applyReference(previous.reference);
    $('tactical-notes').value = previous.tacticalNotes ?? '';
    selectedId = previous.selectedId && (findPiece(previous.selectedId) || findArrow(previous.selectedId)) ? previous.selectedId : null;
    selectedPointIndex = selectedId && previous.selectedPointIndex != null && findArrow(selectedId)?.points[previous.selectedPointIndex] ? previous.selectedPointIndex : null;
    draft = null;
    insertMode = false;
    $('undo').disabled = history.length === 0;
    render();
    status('已復原上一個動作。');
    return true;
  }

  function startArrow(color) {
    if (draft || annotationsHidden) return false;
    if (state.arrows.length >= LIMITS.arrows) {
      status(`單一戰術盤最多 ${LIMITS.arrows} 條路線。`);
      return false;
    }
    const routeColor = normalizeRouteColor(color ?? $('route-color').value);
    draft = { color: routeColor, side: legacyRouteSide(routeColor), label: safeText($('token-label').value), points: [] };
    selectedId = null;
    selectedPointIndex = null;
    insertMode = false;
    render();
    status('路線繪製中：單擊增加節點，雙擊加入終點並完成。');
    postToParent({ type: 'editing-started' });
    return true;
  }
  function startBrush(color = 'blue', width = 2) {
    if (!window.BrushCore.validWidth(width) || !startArrow(color)) return false;
    draft.kind = 'brush'; draft.width = width;
    syncModeHint();
    status('畫筆：按住拖曳繪製，放開完成一筆；完成後可拖曳整筆。');
    return true;
  }
  function addBrushPoint(x, y) {
    if (!isBrush(draft) || !insideArena(x, y)) return false;
    if (draft.points.length >= window.BrushCore.MAX_SAMPLES) { status('已達單筆取樣上限；放開完成後可另起一筆。'); return false; }
    if (!window.BrushCore.append(draft.points, [round(x), round(y)], 2)) return false;
    drawDraft(); return true;
  }
  function moveStroke(id, dx, dy, base, record = true) {
    const stroke = findArrow(id);
    if (!isBrush(stroke) || !finite(dx) || !finite(dy) || annotationsHidden) return false;
    const points = (base ?? stroke.points).map(([x, y]) => [round(x + dx), round(y + dy)]);
    if (!points.every(([x, y]) => insideArena(x, y))) return false;
    if (record) remember();
    stroke.points = points; render(); return true;
  }
  function setBrushWidth(width) {
    const stroke = selected();
    if (!isBrush(stroke) || !window.BrushCore.validWidth(width) || stroke.width === width || annotationsHidden) return false;
    remember(); stroke.width = width; render(); return true;
  }
  function addArrowPoint(x, y) {
    if (!draft || draft.points.length >= LIMITS.arrowPoints || !insideArena(x, y)) return false;
    draft.points.push([round(x), round(y)]);
    drawDraft();
    syncModeHint();
    status(`已放第 ${draft.points.length} 個轉折點。`);
    return true;
  }
  function dropArrowPoint() {
    if (!draft || !draft.points.length) return false;
    draft.points.pop();
    drawDraft();
    syncModeHint();
    return true;
  }
  function finishArrow() {
    if (!draft || draft.points.length < 2) return false;
    if (isBrush(draft)) draft.points = window.BrushCore.finish(draft.points, 1.2);
    remember();
    const arrow = { id: makeId('route'), color: draft.color, side: draft.side, label: draft.label, points: draft.points.map(point => [point[0], point[1]]), source: 'manual', ...(isBrush(draft) ? { kind: 'brush', width: draft.width } : {}) };
    state.arrows.push(arrow);
    draft = null;
    selectedId = arrow.id;
    selectedPointIndex = null;
    $('token-label').value = '';
    render();
    status(isBrush(arrow) ? `已完成 ${title(arrow)}；可拖曳整筆，或再按自由畫筆新增一筆。` : `已完成 ${title(arrow)}，共 ${arrow.points.length} 個轉折點。`);
    return arrow.id;
  }
  function cancelArrow() {
    if (!draft) return false;
    draft = null;
    insertMode = false;
    render();
    status('已取消路線繪製。');
    return true;
  }
  function moveArrowPoint(id, index, x, y) {
    const arrow = findArrow(id);
    if (!arrow || !arrow.points[index] || !insideArena(x, y)) return false;
    arrow.points[index] = [round(x), round(y)];
    render();
    return true;
  }
  function setArrowColor(color) {
    const arrow = findArrow(selectedId);
    const next = normalizeRouteColor(color);
    if (!arrow || arrow.color === next) return false;
    remember();
    arrow.color = next;
    arrow.side = legacyRouteSide(next);
    render();
    status(`已將 ${title(arrow)} 改為${{ red: '紅色', green: '綠色', blue: '藍色', yellow: '黃色' }[next]}。`);
    return true;
  }
  function beginInsertArrowPoint() {
    const arrow = findArrow(selectedId);
    if (!arrow || isBrush(arrow) || draft) return false;
    insertMode = !insertMode;
    selectedPointIndex = null;
    render();
    status(insertMode ? '新增節點模式：請點選目前路線上的線段。' : '已取消新增節點。');
    return insertMode;
  }
  function insertArrowPoint(id, x, y) {
    const arrow = findArrow(id);
    if (!arrow || isBrush(arrow) || arrow.points.length >= LIMITS.arrowPoints || !insideArena(x, y)) return false;
    let bestIndex = 1, bestPoint = null, bestDistance = Infinity;
    for (let index = 0; index < arrow.points.length - 1; index++) {
      const [ax, ay] = arrow.points[index], [bx, by] = arrow.points[index + 1];
      const length = Math.hypot(bx - ax, by - ay) || 1;
      const ratio = Math.max(0, Math.min(1, ((x - ax) * (bx - ax) + (y - ay) * (by - ay)) / (length * length)));
      const distance = Math.hypot(x - (ax + (bx - ax) * ratio), y - (ay + (by - ay) * ratio));
      if (distance < bestDistance) { bestDistance = distance; bestIndex = index + 1; bestPoint = [ax + (bx - ax) * ratio, ay + (by - ay) * ratio]; }
    }
    if (!bestPoint || !insideArena(bestPoint[0], bestPoint[1])) return false;
    remember();
    arrow.points.splice(bestIndex, 0, [round(bestPoint[0]), round(bestPoint[1])]);
    selectedPointIndex = bestIndex;
    insertMode = false;
    render();
    status(`已在 ${title(arrow)} 插入轉折點，共 ${arrow.points.length} 點。`);
    return true;
  }
  function deleteArrowPoint(id, index) {
    const arrow = findArrow(id);
    if (!arrow || isBrush(arrow) || arrow.points.length <= 2 || !arrow.points[index]) return false;
    remember();
    arrow.points.splice(index, 1);
    selectedPointIndex = Math.min(index, arrow.points.length - 1);
    render();
    status(`已刪除轉折點，${title(arrow)} 剩 ${arrow.points.length} 點。`);
    return true;
  }

  function normalizeReference(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
    const matchLabel = String(value.matchLabel ?? '').replace(UNSAFE_TEXT, '').trim().slice(0, 48);
    const countdown = String(value.countdown ?? '').trim();
    const sourceMatchId = typeof value.matchId === 'string' ? value.matchId.slice(0, 100) : null;
    if (!countdown) return { matchId: sourceMatchId, matchLabel, countdown: '', remainingSeconds: null };
    const parsed = COUNTDOWN_PATTERN.exec(countdown);
    if (!parsed) return null;
    const seconds = Number(parsed[1]) * 60 + Number(parsed[2]);
    if (!Number.isInteger(seconds) || seconds < 0 || seconds > 35999) return null;
    if (value.remainingSeconds != null && (!finite(Number(value.remainingSeconds)) || Math.round(Number(value.remainingSeconds)) !== seconds)) return null;
    return { matchId: sourceMatchId, matchLabel, countdown: `${parsed[1]}:${parsed[2]}`, remainingSeconds: seconds };
  }
  function readReferenceForm() {
    const candidate = normalizeReference({ matchId: matchId || state.reference.matchId, matchLabel: $('reference-match').value, countdown: $('reference-countdown').value });
    return candidate ?? { matchLabel: String($('reference-match').value ?? '').trim().slice(0, 48), countdown: '', remainingSeconds: null };
  }
  function applyReference(reference, message) {
    state.reference = reference;
    $('reference-match').value = reference.matchLabel;
    $('reference-countdown').value = reference.countdown;
    if (message) status(message);
  }

  function validatePlan(payload) {
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) throw new Error('檔案不是有效的 JSON 物件');
    if (payload.type !== PLAN_TYPE) throw new Error('不是支援的戰術盤檔');
    if (payload.schemaVersion !== SCHEMA_VERSION) throw new Error(`不支援的 schemaVersion：${payload.schemaVersion}`);
    const legacyOverlay = overlayMode && payload.mapId === 'recorded-minimap-V06' && matchId === '20260829-round2';
    if (payload.mapId !== MAP_ID && !legacyOverlay) throw new Error('底圖識別碼不符，請確認是同一張全場底圖');
    if (overlayMode && (payload.reference?.matchId ? payload.reference.matchId !== matchId : !legacyOverlay)) throw new Error('標註檔屬於其他場次或缺少場次身分，請先切換來源場次');
    if (payload.mapVersion !== MAP_VERSION) throw new Error(`底圖版本不符：檔案 ${payload.mapVersion}／目前 ${MAP_VERSION}`);
    const reference = normalizeReference(payload.reference ?? {});
    if (!reference) throw new Error('對應場次或戰場倒數格式無效');
    const asArray = (value, name) => {
      if (value == null) return [];
      if (!Array.isArray(value)) throw new Error(`${name} 必須是陣列`);
      return value;
    };
    const rawTokens = asArray(payload.tokens, 'tokens');
    const rawMarkers = asArray(payload.markers, 'markers');
    const rawArrows = asArray(payload.arrows, 'arrows');
    if (rawTokens.length + rawMarkers.length > LIMITS.pieces) throw new Error(`棋子與標記合計不可超過 ${LIMITS.pieces} 個`);
    if (rawArrows.length > LIMITS.arrows) throw new Error(`路線不可超過 ${LIMITS.arrows} 條`);
    const ids = new Set();
    const takeId = (value, position) => {
      const id = String(value ?? '');
      if (!ID_PATTERN.test(id)) throw new Error(`${position} 的 id「${id.slice(0, 20)}」不是合法識別碼`);
      if (ids.has(id)) throw new Error(`${position} 的 id 重複：${id}`);
      ids.add(id);
      return id;
    };
    const readPiece = (item, index, forceMarker) => {
      const position = `第 ${index + 1} 個${forceMarker ? '標記' : '棋子'}`;
      if (!item || typeof item !== 'object' || Array.isArray(item)) throw new Error(`${position} 不是有效物件`);
      const kind = forceMarker ? 'marker' : item.kind === 'group' ? 'group' : 'profession';
      if (!forceMarker && !['profession', 'group'].includes(item.kind)) throw new Error(`${position} 的 kind 無效`);
      const side = kind === 'marker' ? 'neutral' : item.side;
      if (kind !== 'marker' && !['ally', 'enemy'].includes(side)) throw new Error(`${position} 的陣營無效`);
      if (kind === 'profession' && !professionById.has(item.profession)) throw new Error(`${position} 的職業無效`);
      const x = item.x, y = item.y;
      if (!finite(x) || !finite(y)) throw new Error(`${position} 的座標不是有限數值`);
      if (!insideArena(x, y)) throw new Error(`${position} 的座標落在底圖範圍外`);
      return { id: takeId(item.id, position), kind, side, profession: kind === 'profession' ? item.profession : null, label: safeText(item.label), x: round(x), y: round(y), source: 'manual' };
    };
    const pieces = [
      ...rawTokens.map((item, index) => readPiece(item, index, false)),
      ...rawMarkers.map((item, index) => readPiece(item, index, true)),
    ];
    const arrows = rawArrows.map((item, index) => {
      const position = `第 ${index + 1} 條路線`;
      if (!item || typeof item !== 'object' || Array.isArray(item)) throw new Error(`${position} 不是有效物件`);
      if (item.color != null && !Object.hasOwn(ROUTE_COLORS, item.color)) throw new Error(`${position} 的顏色無效`);
      if (item.color == null && !['ally', 'enemy', 'neutral'].includes(item.side)) throw new Error(`${position} 的顏色無效`);
      const color = normalizeRouteColor(item.color, item.side);
      if (!Array.isArray(item.points) || item.points.length < 2) throw new Error(`${position} 至少要有兩個轉折點`);
      if (item.kind != null && !['arrow', 'brush'].includes(item.kind)) throw new Error('不支援的筆畫類型');
      if (isBrush(item) && !window.BrushCore.validWidth(item.width)) throw new Error('筆畫粗細無效');
      if (item.points.length > (isBrush(item) ? window.BrushCore.MAX_POINTS : LIMITS.arrowPoints)) throw new Error(`${position} 的點數超過上限`);
      const points = item.points.map((point, pointIndex) => {
        if (!Array.isArray(point) || point.length !== 2) throw new Error(`${position} 第 ${pointIndex + 1} 個轉折點格式無效`);
        const x = point[0], y = point[1];
        if (!finite(x) || !finite(y)) throw new Error(`${position} 第 ${pointIndex + 1} 個轉折點不是有限數值`);
        if (!insideArena(x, y)) throw new Error(`${position} 第 ${pointIndex + 1} 個轉折點落在底圖範圍外`);
        return [round(x), round(y)];
      });
      return { id: takeId(item.id, position), color, side: legacyRouteSide(color), label: safeText(item.label), points, source: 'manual', ...(isBrush(item) ? { kind: 'brush', width: item.width } : {}) };
    });
    return { reference, pieces, arrows, tacticalNotes: typeof payload.tacticalNotes === 'string' ? payload.tacticalNotes.slice(0, 10000) : '' };
  }
  function exportPlan() {
    state.reference = readReferenceForm();
    return {
      schemaVersion: SCHEMA_VERSION,
      type: PLAN_TYPE,
      mapId: MAP_ID,
      mapVersion: MAP_VERSION,
      coordinateSystem: 'SVG viewBox 0 0 1000 620; enemy left, ally right, upper lane top, lower lane bottom',
      reference: clone(state.reference),
      tacticalNotes: $('tactical-notes').value,
      tokens: state.pieces.filter(item => item.kind !== 'marker').map(clone),
      markers: state.pieces.filter(item => item.kind === 'marker').map(clone),
      arrows: state.arrows.map(clone),
      note: 'Manual tactical plan; not an observation of the historical match.',
    };
  }
  function importPlan(payload) {
    let next;
    try {
      next = validatePlan(payload);
    } catch (error) {
      status(`開啟失敗，畫面內容保持不變：${error.message}`);
      return { ok: false, error: error.message };
    }
    if (!window.UnsavedGuard.confirm(['plan'])) return { ok: false, error: '已取消開啟' };
    remember();
    state.pieces.splice(0, state.pieces.length, ...next.pieces);
    state.arrows.splice(0, state.arrows.length, ...next.arrows);
    selectedId = null;
    selectedPointIndex = null;
    insertMode = false;
    draft = null;
    nextSerial = 1;
    applyReference(next.reference);
    $('tactical-notes').value = next.tacticalNotes;
    window.UnsavedGuard.saved('plan');
    render();
    status(`已開啟舊檔：${next.pieces.length} 個棋子／標記、${next.arrows.length} 條路線；內容仍標記為手動推演。`);
    if (next.reference.remainingSeconds != null) postToParent({ type: 'reference-restored', reference: clone(next.reference) });
    return { ok: true, pieces: next.pieces.length, arrows: next.arrows.length, reference: clone(next.reference) };
  }
  function saveFile() {
    if (draft) { status('請先雙擊完成路線或取消繪製，再另存新檔。'); return; }
    const payload = exportPlan();
    const url = URL.createObjectURL(new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `戰術盤-${payload.reference.countdown ? payload.reference.countdown.replace(':', 'm') + 's' : '未指定倒數'}.json`;
    link.click();
    window.UnsavedGuard.saved('plan');
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    status('已另存新檔；檔案含底圖版本、對應場次與倒數。');
  }

  const embedded = window.parent !== window || params.get('embed') === '1';
  if (embedded) document.body.classList.add('embedded');
  $('editor-tools').onclick = () => {
    const open = document.body.classList.toggle('tools-open');
    $('editor-tools').setAttribute('aria-expanded', String(open));
    $('editor-tools').textContent = open ? '收起工具' : '編輯工具';
  };
  const parentWindow = window.parent !== window ? window.parent : null;
  const allowedOrigins = new Set([location.origin]);
  if (location.protocol === 'file:') allowedOrigins.add('null');
  const targetOrigin = location.protocol === 'file:' ? '*' : location.origin;
  function postToParent(message) {
    if (!parentWindow) return false;
    parentWindow.postMessage({ channel: CHANNEL, from: 'editor', ...message }, targetOrigin);
    return true;
  }
  window.addEventListener('message', event => {
    if (!parentWindow || event.source !== parentWindow) return;
    if (!allowedOrigins.has(event.origin)) return;
    const data = event.data;
    if (!data || typeof data !== 'object' || data.channel !== CHANNEL || data.from !== 'overview') return;
    if (data.type === 'toggle-tools') {
      const open = typeof data.open === 'boolean' ? data.open : !document.body.classList.contains('tools-open');
      document.body.classList.toggle('tools-open', open);
      return;
    }
    if (data.type === 'annotations-visibility') {
      annotationsHidden = Boolean(data.hidden);
      document.body.classList.toggle('annotations-hidden', annotationsHidden);
      if (annotationsHidden) {
        draft = null;
        insertMode = false;
        renamingId = null;
        gesture = null;
      }
      render();
      status(annotationsHidden ? '標註已隱藏；取消勾選後可繼續編輯。' : '標註已顯示，可繼續編輯。');
      return;
    }
    if (data.type !== 'reference') return;
    const reference = normalizeReference(data.reference);
    if (reference) applyReference(reference);
  });

  function toMapPoint(event) {
    const ctm = svg.getScreenCTM();
    if (!ctm) return null;
    const point = svg.createSVGPoint();
    point.x = event.clientX;
    point.y = event.clientY;
    const mapped = point.matrixTransform(ctm.inverse());
    return { x: mapped.x, y: mapped.y };
  }
  let gesture = null;
  svg.addEventListener('pointerdown', event => {
    if (annotationsHidden) return;
    const point = toMapPoint(event);
    if (!point) return;
    if (isBrush(draft)) {
      event.preventDefault();
      if (event.button !== 0 || gesture || !addBrushPoint(point.x, point.y)) return;
      gesture = { pointerId: event.pointerId, brush: true };
      svg.setPointerCapture(event.pointerId); return;
    }
    if (draft) {
      event.preventDefault();
      return;
    }
    const target = event.target.closest?.('[data-piece],[data-arrow-point],[data-arrow-hit]');
    if (target) postToParent({ type: 'editing-started' });
    const handleId = target?.getAttribute('data-arrow-point');
    if (handleId) {
      if (selectedId !== handleId) selectItem(handleId);
      selectedPointIndex = Number(target.getAttribute('data-point-index'));
      insertMode = false;
      render();
      gesture = { pointerId: event.pointerId, arrowId: handleId, pointIndex: selectedPointIndex };
      svg.setPointerCapture(event.pointerId);
      return;
    }
    const pieceId = target?.getAttribute('data-piece');
    if (pieceId) {
      if (selectedId !== pieceId) selectItem(pieceId);
      gesture = { pointerId: event.pointerId, pieceId };
      svg.setPointerCapture(event.pointerId);
      return;
    }
    const arrowId = target?.getAttribute('data-arrow-hit');
    if (arrowId) {
      if (insertMode && arrowId === selectedId) insertArrowPoint(arrowId, point.x, point.y);
      else selectItem(arrowId);
      if (isBrush(findArrow(arrowId))) {
        gesture = { pointerId: event.pointerId, strokeId: arrowId, origin: point, base: clone(findArrow(arrowId).points) };
        svg.setPointerCapture(event.pointerId);
      }
      return;
    }
    if (selectedId) selectItem(null);
  });
  svg.addEventListener('pointermove', event => {
    if (!gesture || gesture.pointerId !== event.pointerId) return;
    const point = toMapPoint(event);
    if (!point) return;
    if (gesture.brush) { addBrushPoint(point.x, point.y); return; }
    if (gesture.strokeId) {
      const dx = point.x - gesture.origin.x, dy = point.y - gesture.origin.y;
      if (Math.hypot(dx, dy) > .1 && moveStroke(gesture.strokeId, dx, dy, gesture.base, !gesture.remembered)) gesture.remembered = true;
      return;
    }
    const safe = clampToArena(point.x, point.y);
    const previous = gesture.pieceId ? findPiece(gesture.pieceId) : null;
    const previousPoint = gesture.arrowId ? findArrow(gesture.arrowId)?.points[gesture.pointIndex] : null;
    if (previous && previous.x === safe.x && previous.y === safe.y) return;
    if (previousPoint && previousPoint[0] === safe.x && previousPoint[1] === safe.y) return;
    if (!gesture.remembered) { remember(); gesture.remembered = true; }
    if (gesture.pieceId) moveItem(gesture.pieceId, safe.x, safe.y);
    else moveArrowPoint(gesture.arrowId, gesture.pointIndex, safe.x, safe.y);
  });
  function release(event) {
    if (!gesture || gesture.pointerId !== event.pointerId) return;
    if (gesture.brush && event.type !== 'pointercancel') { const p = toMapPoint(event); if (p) addBrushPoint(p.x, p.y); }
    if (gesture.brush && (event.type === 'pointercancel' || !finishArrow())) cancelArrow();
    gesture = null;
    if (svg.hasPointerCapture(event.pointerId)) svg.releasePointerCapture(event.pointerId);
  }
  svg.addEventListener('pointerup', release);
  svg.addEventListener('pointercancel', release);
  let clickTimer = 0;
  svg.addEventListener('click', event => {
    if (!draft || isBrush(draft) || annotationsHidden) return;
    event.preventDefault();
    clearTimeout(clickTimer);
    const point = toMapPoint(event);
    clickTimer = setTimeout(() => { if (point) addArrowPoint(point.x, point.y); }, 230);
  });
  svg.addEventListener('dblclick', event => {
    if (draft && !isBrush(draft)) {
      event.preventDefault();
      clearTimeout(clickTimer);
      const point = toMapPoint(event);
      if (point) addArrowPoint(point.x, point.y);
      finishArrow();
      return;
    }
  });
  document.addEventListener('keydown', event => {
    if (event.target.matches('input,select,textarea')) return;
    if (event.key === 'Escape' && draft) { event.preventDefault(); cancelArrow(); return; }
    if (event.key === 'Enter' && draft && !isBrush(draft)) { event.preventDefault(); finishArrow(); return; }
    if (event.key === 'Delete' && selectedId) { event.preventDefault(); deleteItem(selectedId); return; }
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z') { event.preventDefault(); undo(); }
  });

  function syncKind() {
    const kind = $('token-kind').value;
    const marker = kind === 'marker';
    $('token-profession').disabled = kind !== 'profession';
    $('profession-field').classList.toggle('is-disabled', kind !== 'profession');
    $('token-side').disabled = marker;
    $('side-field').classList.toggle('is-disabled', marker);
    $('label-field-title').textContent = marker ? '標記名稱（選填，未填自動編號）' : '使用者 ID（選填，未填自動編號）';
    $('token-label').placeholder = marker ? '例：集合點／資源點' : '例：飯飯／進攻二隊';
    $('add-token').textContent = marker ? '＋ 新增標記' : '＋ 新增棋子';
  }
  professions.forEach(item => $('token-profession').append(new Option(item.label, item.id)));
  $('token-kind').onchange = syncKind;
  $('add-token').onclick = () => addToken();
  $('rename').onclick = () => renameSelected();
  $('delete').onclick = () => deleteItem(selectedId);
  $('undo').onclick = undo;
  $('clear').onclick = clearAll;
  $('export').onclick = saveFile;
  $('arrow-start').onclick = () => startArrow();
  $('arrow-cancel').onclick = cancelArrow;
  $('arrow-add-point').onclick = beginInsertArrowPoint;
  $('arrow-remove-point').onclick = () => deleteArrowPoint(selectedId, selectedPointIndex);
  $('arrow-delete').onclick = () => { if (findArrow(selectedId)) deleteItem(selectedId); };
  $('arrow-undo').onclick = undo;
  $('route-color').onchange = event => { if (findArrow(selectedId)) setArrowColor(event.target.value); };
  $('import').onclick = () => $('import-file').click();
  $('import-file').onchange = async event => {
    const file = event.target.files[0];
    event.target.value = '';
    if (!file) return;
    let payload;
    try {
      payload = JSON.parse(await file.text());
    } catch (error) {
      status(`開啟失敗，畫面內容保持不變：檔案不是有效的 JSON（${error.message}）`);
      return;
    }
    importPlan(payload);
  };
  for (const id of ['reference-match', 'reference-countdown']) $(id).addEventListener('change', () => { state.reference = readReferenceForm(); });

  $('map-version').textContent = `${MAP_ID}・v${MAP_VERSION}`;
  $('token-profession').value = 'suwen';
  $('route-color').value = 'blue';
  $('undo').disabled = true;
  syncKind();
  render();
  postToParent({ type: 'ready', mapId: MAP_ID, mapVersion: MAP_VERSION });

  window.tacticalEditor = {
    ready: true,
    mapId: MAP_ID,
    mapVersion: MAP_VERSION,
    limits: { ...LIMITS },
    professions: clone(professions),
    embedded,
    get selectedId() { return selectedId; },
    get selectedPointIndex() { return selectedPointIndex; },
    get insertMode() { return insertMode; },
    get draftPoints() { return draft ? draft.points.map(point => [...point]) : null; },
    getState: () => ({ pieces: clone(state.pieces), arrows: clone(state.arrows), reference: clone(state.reference) }),
    insideArena,
    addToken,
    selectItem,
    moveItem,
    renameSelected,
    renameItem,
    beginRename,
    get renamingId() { return renamingId; },
    deleteItem,
    clearAll,
    undo,
    startArrow,
    addArrowPoint,
    dropArrowPoint,
    finishArrow,
    cancelArrow,
    moveArrowPoint,
    setArrowColor,
    beginInsertArrowPoint,
    insertArrowPoint,
    deleteArrowPoint,
    startBrush, addBrushPoint, moveStroke, setBrushWidth,
    exportPlan,
    importPlan,
    setReference(reference) {
      const normalized = normalizeReference(reference);
      if (!normalized) return false;
      applyReference(normalized);
      return true;
    },
  };
  window.UnsavedGuard.track('plan', () => ({ pieces: state.pieces, arrows: state.arrows, draft, notes: $('tactical-notes').value, reference: overlayMode ? null : readReferenceForm() }));
})();
