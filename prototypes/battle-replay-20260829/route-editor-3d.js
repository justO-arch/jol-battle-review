'use strict';
(() => {
  const COLORS = { red: 0xf17873, green: 0x52c878, blue: 0x65caed, yellow: 0xefc979 };
  const COLOR_CSS = { red: '#f17873', green: '#52c878', blue: '#65caed', yellow: '#efc979' };
  const legacyColor = side => ({ ally: 'blue', enemy: 'red', neutral: 'yellow' }[side] ?? 'blue');
  const legacySide = color => ({ blue: 'ally', red: 'enemy', yellow: 'neutral', green: 'neutral' }[color] ?? 'ally');
  const normalizeColor = (color, side) => Object.hasOwn(COLORS, color) ? color : legacyColor(side ?? color);
  const clone = value => JSON.parse(JSON.stringify(value));
  const cleanLabel = value => String(value ?? '').replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, 24);
  const validId = value => /^[A-Za-z0-9_-]{1,40}$/.test(value);

  // 顯示常數。取樣只影響畫面，存檔仍只有 route.points 這些邏輯節點。
  const GROUND_LIFT = .06;
  const HEAD_LIFT = .03;
  const HANDLE_LIFT = .38;
  const SAMPLE_STEP = .5;
  const RIBBON_HALF_WIDTH = .3;
  const HEAD_LENGTH = 1.5;
  const HEAD_HALF_WIDTH = .72;
  const HIT_SPAN = 2;

  window.createRouteEditor3D = options => {
    const T = options.THREE;
    const parent = options.parent;
    const canvas = options.canvas;
    const routeRoot = new T.Group();
    parent.add(routeRoot);
    const routes = [];
    const history = [];
    const hitMeshes = [];
    let renderState = [];
    let draft = null;
    let selectedId = null;
    let selectedPointIndex = null;
    let insertMode = false;
    let serial = 1;
    let clickTimer = 0;
    let drag = null;
    let brushPointer = null;
    let brushButton = null, widthSelect = null;
    const isBrush = route => route?.kind === 'brush';

    const status = text => options.onStatus?.(text);
    const notify = () => options.onChange?.(clone(routes));
    const title = route => route.label || route.id;
    const selected = () => routes.find(route => route.id === selectedId) ?? null;
    const snapshot = () => ({ routes: clone(routes), selectedId, selectedPointIndex });
    function remember() {
      history.push(snapshot());
      if (history.length > 40) history.shift();
      syncButtons();
    }
    function disposeTree(node) {
      node.traverse(child => {
        child.geometry?.dispose?.();
        if (Array.isArray(child.material)) child.material.forEach(item => item.dispose?.());
        else child.material?.dispose?.();
      });
    }
    function clearRendered() {
      while (routeRoot.children.length) {
        const child = routeRoot.children[0];
        routeRoot.remove(child);
        disposeTree(child);
      }
      hitMeshes.length = 0;
      renderState = [];
    }
    const groundY = (x, z) => options.heightAt?.(x, z) ?? .2;
    function point3(point, lift = GROUND_LIFT) {
      return new T.Vector3(point.x, groundY(point.x, point.z) + lift, point.z);
    }
    // 沿每個線段取樣，讓路線跟著地形（含家中樓梯）起伏；只有 route.points 會被存檔。
    function samplePath(points) {
      const path = [];
      const totalLength = points.slice(1).reduce((sum, p, i) => sum + Math.hypot(p.x - points[i].x, p.z - points[i].z), 0);
      const stepSize = Math.max(SAMPLE_STEP, totalLength / 1600);
      const push = (x, z) => {
        const previous = path.at(-1);
        if (previous && Math.hypot(previous.x - x, previous.z - z) < 1e-3) return;
        path.push(new T.Vector3(x, groundY(x, z) + GROUND_LIFT, z));
      };
      for (let index = 0; index < points.length - 1; index++) {
        const start = points[index], end = points[index + 1];
        const steps = Math.max(1, Math.ceil(Math.hypot(end.x - start.x, end.z - start.z) / stepSize));
        for (let step = 0; step < steps; step++) push(start.x + (end.x - start.x) * step / steps, start.z + (end.z - start.z) * step / steps);
      }
      const last = points.at(-1);
      push(last.x, last.z);
      return path;
    }
    // 尾端讓出箭頭長度，箭頭與帶狀路線就不會重疊互閃。
    function trimEnd(path, amount) {
      const trimmed = path.slice();
      let remaining = amount;
      while (trimmed.length > 1 && remaining > 0) {
        const last = trimmed.at(-1), previous = trimmed.at(-2);
        const span = Math.hypot(last.x - previous.x, last.z - previous.z);
        if (span <= remaining + 1e-6) { trimmed.pop(); remaining -= span; continue; }
        const ratio = remaining / span;
        const x = last.x + (previous.x - last.x) * ratio;
        const z = last.z + (previous.z - last.z) * ratio;
        trimmed[trimmed.length - 1] = new T.Vector3(x, groundY(x, z) + GROUND_LIFT, z);
        remaining = 0;
      }
      return trimmed;
    }
    function ribbonGeometry(path, halfWidth) {
      const positions = [], indices = [];
      for (let index = 0; index < path.length; index++) {
        const previous = path[Math.max(0, index - 1)], next = path[Math.min(path.length - 1, index + 1)];
        const dx = next.x - previous.x, dz = next.z - previous.z;
        const length = Math.hypot(dx, dz) || 1;
        const offsetX = -dz / length * halfWidth, offsetZ = dx / length * halfWidth;
        const point = path[index];
        for (const sign of [1, -1]) {
          const x = point.x + sign * offsetX, z = point.z + sign * offsetZ;
          positions.push(x, groundY(x, z) + GROUND_LIFT, z);
        }
      }
      for (let index = 0; index < path.length - 1; index++) {
        const base = index * 2;
        indices.push(base, base + 1, base + 2, base + 2, base + 1, base + 3);
      }
      const geometry = new T.BufferGeometry();
      geometry.setAttribute('position', new T.Float32BufferAttribute(positions, 3));
      geometry.setIndex(indices);
      return geometry;
    }
    function headCorners(path, headLength) {
      const tip = path.at(-1), previous = path.at(-2);
      const dx = tip.x - previous.x, dz = tip.z - previous.z;
      const length = Math.hypot(dx, dz);
      if (length < 1e-3) return null;
      const forwardX = dx / length, forwardZ = dz / length;
      const backX = tip.x - forwardX * headLength, backZ = tip.z - forwardZ * headLength;
      const halfWidth = HEAD_HALF_WIDTH * headLength / HEAD_LENGTH;
      const offsetX = -forwardZ * halfWidth, offsetZ = forwardX * halfWidth;
      const lift = GROUND_LIFT + HEAD_LIFT;
      return [[tip.x, tip.z], [backX + offsetX, backZ + offsetZ], [backX - offsetX, backZ - offsetZ]]
        .map(([x, z]) => new T.Vector3(x, groundY(x, z) + lift, z));
    }
    function flatGeometry(corners) {
      const geometry = new T.BufferGeometry();
      geometry.setAttribute('position', new T.Float32BufferAttribute(corners.flatMap(point => [point.x, point.y, point.z]), 3));
      return geometry;
    }
    // 貼地材質：真實深度測試讓塔身與山石正確遮擋；polygonOffset 只用來避開與地面的 z-fighting。
    function groundMaterial(color) {
      return new T.MeshBasicMaterial({
        color, side: T.DoubleSide, depthTest: true, depthWrite: false,
        polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4,
      });
    }
    function addHitMeshes(routeId, path, group) {
      const anchors = [path[0]];
      let run = 0;
      for (let index = 1; index < path.length; index++) {
        run += path[index].distanceTo(path[index - 1]);
        if (run >= HIT_SPAN || index === path.length - 1) { anchors.push(path[index]); run = 0; }
      }
      for (let index = 0; index < anchors.length - 1; index++) {
        const direction = anchors[index + 1].clone().sub(anchors[index]);
        if (direction.length() < 1e-3) continue;
        const hit = new T.Mesh(new T.CylinderGeometry(.55, .55, direction.length(), 8), new T.MeshBasicMaterial({ visible: false }));
        hit.position.copy(anchors[index]).add(anchors[index + 1]).multiplyScalar(.5);
        hit.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), direction.normalize());
        hit.userData.routeId = routeId;
        hitMeshes.push(hit);
        group.add(hit);
      }
    }
    function drawPath(route, isDraft = false) {
      if (route.points.length < 2 && !isDraft) return;
      const group = new T.Group();
      routeRoot.add(group);
      const color = COLORS[route.color] ?? COLORS.blue;
      if (route.points.length >= 2) {
        const path = samplePath(route.points);
        if (path.length >= 2) {
          // 短線或最後一段急轉彎時，箭頭不能越過最後一個邏輯節點。
          const last = route.points.at(-1), previous = route.points.at(-2);
          const headLength = Math.min(HEAD_LENGTH, Math.hypot(last.x - previous.x, last.z - previous.z) * .8);
          const ribbonPath = isDraft || isBrush(route) ? path : trimEnd(path, headLength);
          const ribbon = new T.Mesh(ribbonGeometry(ribbonPath, isBrush(route) ? .15 * route.width : RIBBON_HALF_WIDTH), groundMaterial(color));
          ribbon.renderOrder = 20;
          group.add(ribbon);
          const corners = isDraft || isBrush(route) ? null : headCorners(path, headLength);
          if (corners) {
            const head = new T.Mesh(flatGeometry(corners), groundMaterial(color));
            head.renderOrder = 21;
            group.add(head);
          }
          if (!isDraft) addHitMeshes(route.id, path, group);
          renderState.push({
            id: route.id || 'draft',
            draft: isDraft,
            color: route.color,
            nodes: route.points.map(point => ({ x: point.x, z: point.z })),
            samples: path.map(point => ({ x: point.x, y: point.y, z: point.z })),
            head: corners?.map(point => ({ x: point.x, y: point.y, z: point.z })) ?? null,
            depth: {
              test: ribbon.material.depthTest,
              write: ribbon.material.depthWrite,
              polygonOffset: ribbon.material.polygonOffset,
              renderOrder: ribbon.renderOrder,
            },
          });
        }
      }
      if (!isBrush(route) && (isDraft || route.id === selectedId)) route.points.forEach((point, index) => {
        const handleColor = !isDraft && index === selectedPointIndex ? 0xffffff : COLORS.yellow;
        const handle = new T.Mesh(new T.SphereGeometry(.3, 12, 8), new T.MeshBasicMaterial({ color: handleColor }));
        handle.position.copy(point3(point, HANDLE_LIFT));
        handle.renderOrder = 22;
        if (!isDraft) {
          handle.userData.routeId = route.id;
          handle.userData.pointIndex = index;
          hitMeshes.push(handle);
        }
        group.add(handle);
      });
    }
    function renderList() {
      const list = options.list;
      if (!list) return;
      list.replaceChildren();
      if (!routes.length) {
        const empty = document.createElement('small');
        empty.textContent = '尚未繪製路線';
        list.append(empty);
      }
      routes.forEach(route => {
        const row = document.createElement('div');
        row.className = 'route-row';
        const choose = document.createElement('button');
        choose.type = 'button';
        choose.dataset.route = route.id;
        choose.setAttribute('aria-pressed', String(route.id === selectedId));
        choose.textContent = isBrush(route) ? `${title(route)}・筆畫` : `${title(route)}・${route.points.length} 點`;
        choose.style.borderLeftColor = COLOR_CSS[route.color] ?? COLOR_CSS.blue;
        choose.onclick = () => select(route.id);
        const remove = document.createElement('button');
        remove.type = 'button';
        remove.textContent = '×';
        remove.title = `刪除 ${title(route)}`;
        remove.onclick = () => deleteRoute(route.id);
        row.append(choose, remove);
        list.append(row);
      });
    }
    function syncButtons() {
      if (brushButton) brushButton.disabled = Boolean(draft) || options.isEnabled?.() === false;
      if (widthSelect) {
        widthSelect.disabled = Boolean(draft) || options.isEnabled?.() === false;
        if (isBrush(selected())) widthSelect.value = String(selected().width);
      }
      if (options.startButton) options.startButton.disabled = Boolean(draft) || options.isEnabled?.() === false;
      if (options.cancelButton) options.cancelButton.disabled = !draft;
      if (options.deleteButton) options.deleteButton.disabled = !selected() || options.isEnabled?.() === false;
      if (options.undoButton) options.undoButton.disabled = history.length === 0 || options.isEnabled?.() === false;
      if (options.addPointButton) {
        options.addPointButton.disabled = !selected() || isBrush(selected()) || Boolean(draft);
        options.addPointButton.setAttribute('aria-pressed', String(insertMode));
      }
      if (options.removePointButton) options.removePointButton.disabled = !selected() || selectedPointIndex == null || selected().points.length <= 2 || Boolean(draft);
      if (options.colorSelect) {
        options.colorSelect.disabled = Boolean(draft) || options.isEnabled?.() === false;
        if (selected()) options.colorSelect.value = selected().color;
      }
      options.onMode?.(Boolean(draft));
    }
    function render() {
      clearRendered();
      routes.forEach(route => drawPath(route));
      if (draft) drawPath(draft, true);
      renderList();
      syncButtons();
    }
    function makeId() {
      const used = new Set(routes.map(route => route.id));
      let id = `route-${serial++}`;
      while (used.has(id)) id = `route-${serial++}`;
      return id;
    }
    function start(color = 'blue', label = '') {
      if (draft || options.isEnabled?.() === false || routes.length >= 40) return false;
      const routeColor = normalizeColor(color);
      draft = { id: '', color: routeColor, side: legacySide(routeColor), label: cleanLabel(label), points: [] };
      selectedId = null;
      selectedPointIndex = null;
      insertMode = false;
      render();
      status('路線繪製中：單擊增加節點，雙擊加入終點並完成。');
      return true;
    }
    function startBrush(color = 'blue', width = 2) {
      if (!window.BrushCore.validWidth(width) || !start(color)) return false;
      draft.kind = 'brush'; draft.width = width;
      status('畫筆：按住拖曳繪製，放開完成一筆；完成後可拖曳整筆。');
      return true;
    }
    function addPoint(x, z) {
      if (!draft || !Number.isFinite(x) || !Number.isFinite(z) || !options.canPlace(x, z)) return false;
      if (isBrush(draft)) {
        const points = draft.points.map(p => [p.x, p.z]);
        if (points.length >= window.BrushCore.MAX_SAMPLES) { status('已達單筆取樣上限；放開完成後可另起一筆。'); return false; }
        if (!window.BrushCore.append(points, [x, z], .1)) return false;
        draft.points = points.map(([x, z]) => ({ x, z }));
        render(); return true;
      }
      if (draft.points.length >= 24) return false;
      const point = { x: Number(x.toFixed(3)), z: Number(z.toFixed(3)) };
      const last = draft.points.at(-1);
      if (last && Math.hypot(last.x - point.x, last.z - point.z) < .08) return false;
      draft.points.push(point);
      render();
      return true;
    }
    function finish(x, z) {
      if (!draft) return false;
      if (Number.isFinite(x) && Number.isFinite(z)) addPoint(x, z);
      if (draft.points.length < 2) {
        status('至少需要兩個節點才能完成路線。');
        return false;
      }
      if (isBrush(draft)) draft.points = window.BrushCore.finish(draft.points.map(p => [p.x, p.z]), .06).map(([x, z]) => ({ x, z }));
      remember();
      const route = { ...draft, id: makeId(), source: 'manual' };
      routes.push(route);
      draft = null;
      selectedId = route.id;
      selectedPointIndex = null;
      render();
      notify();
      status(isBrush(route) ? `已完成 ${title(route)}；可選取並拖曳整筆。` : `已完成 ${title(route)}；可選取並拖曳節點。`);
      return route.id;
    }
    function cancel() {
      if (!draft) return false;
      draft = null;
      brushPointer = null;
      insertMode = false;
      render();
      status('已取消路線繪製。');
      return true;
    }
    function select(id) {
      selectedId = routes.some(route => route.id === id) ? id : null;
      selectedPointIndex = null;
      insertMode = false;
      render();
      if (selected()) status(isBrush(selected()) ? `已選取 ${title(selected())}；拖曳可移動整筆。` : `已選取 ${title(selected())}；可選節點拖曳，或按「新增節點」。`);
      return Boolean(selectedId);
    }
    function deleteRoute(id = selectedId) {
      if (options.isEnabled?.() === false) return false;
      const index = routes.findIndex(route => route.id === id);
      if (index < 0) return false;
      remember();
      const [removed] = routes.splice(index, 1);
      if (selectedId === id) selectedId = null;
      selectedPointIndex = null;
      insertMode = false;
      render();
      notify();
      status(`已刪除 ${title(removed)}，可按路線復原取回。`);
      return true;
    }
    function setColor(color) {
      if (options.isEnabled?.() === false) return false;
      const route = selected();
      const next = normalizeColor(color);
      if (!route || route.color === next) return false;
      remember();
      route.color = next;
      route.side = legacySide(next);
      render();
      notify();
      status(`已將 ${title(route)} 改為${{ red: '紅色', green: '綠色', blue: '藍色', yellow: '黃色' }[next]}。`);
      return true;
    }
    function beginInsertPoint() {
      if (!selected() || isBrush(selected()) || draft) return false;
      insertMode = !insertMode;
      selectedPointIndex = null;
      render();
      status(insertMode ? '新增節點模式：請點選目前路線上的線段。' : '已取消新增節點。');
      return insertMode;
    }
    function insertPoint(id, x, z) {
      const route = routes.find(item => item.id === id);
      if (!route || isBrush(route) || route.points.length >= 24 || !options.canPlace(x, z)) return false;
      let bestIndex = 1, bestPoint = null, bestDistance = Infinity;
      for (let index = 0; index < route.points.length - 1; index++) {
        const start = route.points[index], end = route.points[index + 1];
        const dx = end.x - start.x, dz = end.z - start.z;
        const lengthSquared = dx * dx + dz * dz || 1;
        const ratio = Math.max(0, Math.min(1, ((x - start.x) * dx + (z - start.z) * dz) / lengthSquared));
        const point = { x: start.x + dx * ratio, z: start.z + dz * ratio };
        const distance = Math.hypot(x - point.x, z - point.z);
        if (distance < bestDistance) { bestDistance = distance; bestIndex = index + 1; bestPoint = point; }
      }
      if (!bestPoint || !options.canPlace(bestPoint.x, bestPoint.z)) return false;
      remember();
      route.points.splice(bestIndex, 0, { x: Number(bestPoint.x.toFixed(3)), z: Number(bestPoint.z.toFixed(3)) });
      selectedId = id;
      selectedPointIndex = bestIndex;
      insertMode = false;
      render();
      notify();
      status(`已新增節點，${title(route)} 現有 ${route.points.length} 點。`);
      return true;
    }
    function selectPoint(id, index) {
      const route = routes.find(item => item.id === id);
      if (isBrush(route) || !route?.points[index]) return false;
      selectedId = id;
      selectedPointIndex = index;
      insertMode = false;
      render();
      status(`已選取 ${title(route)} 的第 ${index + 1} 個節點。`);
      return true;
    }
    function removePoint(id = selectedId, index = selectedPointIndex) {
      const route = routes.find(item => item.id === id);
      if (isBrush(route) || !route?.points[index] || route.points.length <= 2) return false;
      remember();
      route.points.splice(index, 1);
      selectedPointIndex = Math.min(index, route.points.length - 1);
      render();
      notify();
      status(`已移除節點，${title(route)} 剩 ${route.points.length} 點。`);
      return true;
    }
    function movePoint(id, index, x, z) {
      const route = routes.find(item => item.id === id);
      if (isBrush(route) || !route?.points[index] || !options.canPlace(x, z)) return false;
      route.points[index] = { x: Number(x.toFixed(3)), z: Number(z.toFixed(3)) };
      render();
      notify();
      return true;
    }
    function undo() {
      if (options.isEnabled?.() === false) return false;
      const previous = history.pop();
      if (!previous) return false;
      routes.splice(0, routes.length, ...clone(previous.routes));
      selectedId = previous.selectedId && routes.some(route => route.id === previous.selectedId) ? previous.selectedId : null;
      selectedPointIndex = selectedId && previous.selectedPointIndex != null && selected()?.points[previous.selectedPointIndex] ? previous.selectedPointIndex : null;
      draft = null;
      insertMode = false;
      render();
      notify();
      status('已復原上一個路線動作。');
      return true;
    }
    function moveStroke(id, dx, dz, base, record = true) {
      const route = routes.find(r => r.id === id);
      if (!isBrush(route) || options.isEnabled?.() === false || !Number.isFinite(dx) || !Number.isFinite(dz)) return false;
      const points = (base ?? route.points).map(p => ({ x: p.x + dx, z: p.z + dz }));
      if (!points.every(p => options.canPlace(p.x, p.z))) return false;
      if (record) remember();
      route.points = points; render(); notify(); return true;
    }
    function setWidth(width) {
      const route = selected();
      if (!isBrush(route) || options.isEnabled?.() === false || !window.BrushCore.validWidth(width) || route.width === width) return false;
      remember(); route.width = width; render(); notify(); return true;
    }
    function validate(input, canPlace = options.canPlace) {
      if (input == null) return [];
      if (!Array.isArray(input) || input.length > 40) throw new Error('路線資料無效');
      const ids = new Set();
      return input.map((route, routeIndex) => {
        if (!route || typeof route !== 'object' || !validId(String(route.id ?? '')) || ids.has(route.id)) throw new Error(`第 ${routeIndex + 1} 條路線識別碼無效`);
        if (route.color != null && !Object.hasOwn(COLORS, route.color)) throw new Error(`第 ${routeIndex + 1} 條路線顏色無效`);
        if (route.color == null && !['ally', 'enemy', 'neutral'].includes(route.side)) throw new Error(`第 ${routeIndex + 1} 條路線顏色無效`);
        const color = normalizeColor(route.color, route.side);
        if (route.kind != null && !['arrow', 'brush'].includes(route.kind)) throw new Error('不支援的筆畫類型');
        if (isBrush(route) && !window.BrushCore.validWidth(route.width)) throw new Error('筆畫粗細無效');
        if (!Array.isArray(route.points) || route.points.length < 2 || route.points.length > (isBrush(route) ? window.BrushCore.MAX_POINTS : 24)) throw new Error(`第 ${routeIndex + 1} 條路線資料無效`);
        const points = route.points.map((point, pointIndex) => {
          const x = point?.x, z = point?.z;
          if (!Number.isFinite(x) || !Number.isFinite(z) || !canPlace(x, z)) throw new Error(`第 ${routeIndex + 1} 條路線第 ${pointIndex + 1} 點不在可通行區`);
          return { x, z };
        });
        ids.add(route.id);
        return { id: route.id, color, side: legacySide(color), label: cleanLabel(route.label), points, source: 'manual', ...(isBrush(route) ? { kind: 'brush', width: route.width } : {}) };
      });
    }
    function setRoutes(input, { record = false } = {}) {
      const next = validate(input);
      if (record) remember();
      else history.length = 0;
      routes.splice(0, routes.length, ...clone(next));
      selectedId = null;
      selectedPointIndex = null;
      draft = null;
      brushPointer = null;
      drag = null;
      insertMode = false;
      serial = Math.max(1, ...routes.map(route => Number(route.id.match(/(\d+)$/)?.[1] || 0) + 1));
      render();
      notify();
      return true;
    }

    if (options.startButton) {
      brushButton = document.createElement('button');
      brushButton.id = 'brush-start'; brushButton.textContent = '＋ 自由畫筆';
      widthSelect = document.createElement('select');
      widthSelect.id = 'brush-width'; widthSelect.setAttribute('aria-label', '筆畫粗細');
      for (const [i, text] of ['細筆', '中筆', '粗筆'].entries()) widthSelect.append(new Option(text, i + 1));
      widthSelect.value = '2';
      options.startButton.before(brushButton, widthSelect);
      brushButton.onclick = () => startBrush(options.colorSelect?.value ?? 'blue', Number(widthSelect.value));
      widthSelect.onchange = () => setWidth(Number(widthSelect.value));
      if (options.deleteButton) options.deleteButton.textContent = '刪除線／筆畫';
      if (options.undoButton) options.undoButton.textContent = '線／筆畫復原';
    }
    options.startButton?.addEventListener('click', () => start(options.color?.() ?? options.colorSelect?.value ?? options.side?.() ?? 'blue', options.label?.() ?? ''));
    options.cancelButton?.addEventListener('click', cancel);
    options.deleteButton?.addEventListener('click', () => deleteRoute());
    options.undoButton?.addEventListener('click', undo);
    options.addPointButton?.addEventListener('click', beginInsertPoint);
    options.removePointButton?.addEventListener('click', () => removePoint());
    options.colorSelect?.addEventListener('change', event => { if (selected()) setColor(event.target.value); });

    canvas.addEventListener('pointerdown', event => {
      if (event.button !== 0 && !draft) return;
      if (isBrush(draft)) {
        event.preventDefault(); event.stopImmediatePropagation();
        if (event.button !== 0 || brushPointer != null) return;
        const point = options.groundPoint(event);
        if (point && addPoint(point.x, point.z)) { brushPointer = event.pointerId; canvas.setPointerCapture(event.pointerId); }
        return;
      }
      if (draft) {
        event.preventDefault();
        event.stopImmediatePropagation();
        return;
      }
      if (options.isEnabled?.() === false) return;
      options.cast(event);
      const hits = options.raycaster.intersectObjects(hitMeshes);
      const hit = hits.find(item => item.object.userData.pointIndex != null) ?? hits[0];
      if (!hit) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      const routeId = hit.object.userData.routeId;
      const pointIndex = hit.object.userData.pointIndex;
      if (pointIndex != null) {
        if (selectedId !== routeId || selectedPointIndex !== pointIndex) selectPoint(routeId, pointIndex);
        remember();
        drag = { pointerId: event.pointerId, routeId, pointIndex };
        canvas.setPointerCapture(event.pointerId);
      } else if (insertMode && selectedId === routeId) {
        const point = options.groundPoint(event);
        if (point) insertPoint(routeId, point.x, point.z);
      } else {
        select(routeId);
        if (isBrush(selected())) {
          const point = options.groundPoint(event);
          if (point) { drag = { pointerId: event.pointerId, routeId, origin: point, base: clone(selected().points) }; canvas.setPointerCapture(event.pointerId); }
        }
      }
    }, true);
    canvas.addEventListener('pointermove', event => {
      if (isBrush(draft) && brushPointer === event.pointerId) {
        event.stopImmediatePropagation(); const point = options.groundPoint(event);
        if (point) addPoint(point.x, point.z); return;
      }
      if (!drag || drag.pointerId !== event.pointerId) return;
      event.stopImmediatePropagation();
      const point = options.groundPoint(event);
      if (point && drag.base) {
        const dx = point.x - drag.origin.x, dz = point.z - drag.origin.z;
        if (Math.hypot(dx, dz) > .01 && moveStroke(drag.routeId, dx, dz, drag.base, !drag.remembered)) drag.remembered = true;
      } else if (point) movePoint(drag.routeId, drag.pointIndex, point.x, point.z);
    }, true);
    const release = event => {
      if (brushPointer === event.pointerId) {
        event.stopImmediatePropagation(); brushPointer = null;
        if (event.type !== 'pointercancel') { const point = options.groundPoint(event); if (point) addPoint(point.x, point.z); }
        if (event.type === 'pointercancel' || !finish()) cancel();
        if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
        return;
      }
      if (!drag || drag.pointerId !== event.pointerId) return;
      event.stopImmediatePropagation();
      drag = null;
      if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
    };
    canvas.addEventListener('pointerup', release, true);
    canvas.addEventListener('pointercancel', release, true);
    canvas.addEventListener('click', event => {
      if (!draft || isBrush(draft)) return;
      event.preventDefault();
      clearTimeout(clickTimer);
      const point = options.groundPoint(event);
      clickTimer = setTimeout(() => { if (point) addPoint(point.x, point.z); }, 230);
    });
    canvas.addEventListener('dblclick', event => {
      if (!draft || isBrush(draft)) return;
      event.preventDefault();
      clearTimeout(clickTimer);
      const point = options.groundPoint(event);
      if (point) finish(point.x, point.z);
    });

    render();
    return {
      start, startBrush, moveStroke, setWidth, addPoint, finish, cancel, select, selectPoint, deleteRoute, movePoint, insertPoint, removePoint, beginInsertPoint, setColor, undo, validate, setRoutes,
      getRoutes: () => clone(routes),
      getRenderState: () => clone(renderState),
      groundHeight: (x, z) => groundY(x, z),
      geometry: { groundLift: GROUND_LIFT, headLift: HEAD_LIFT, handleLift: HANDLE_LIFT, sampleStep: SAMPLE_STEP, headLength: HEAD_LENGTH },
      get draftPoints() { return draft ? clone(draft.points) : null; },
      get selectedId() { return selectedId; },
      get selectedPointIndex() { return selectedPointIndex; },
      get insertMode() { return insertMode; },
      isDrawing: () => Boolean(draft),
      refresh: render,
    };
  };
})();
