'use strict';
(() => {
  const $ = id => document.getElementById(id);
  const evidence = window.BATTLE_E01_EVIDENCE;
  const data = window.BATTLE_E01_SCENE;
  if (!window.THREE || !evidence || !data) {
    $('video-status').textContent = '必要的本機資料或 3D 引擎未載入。';
    return;
  }

  const context = window.BattleMatch;
  const eventConfig = context.event;
  const requestedSnapshot = new URLSearchParams(location.search).get('snapshot');
  const sourceLinks = eventConfig.sources;
  function originalLink(id, countdown) {
    const [minutes, seconds] = countdown.split(':').map(Number);
    const source = sourceLinks[id];
    const time = source.offset - (minutes * 60 + seconds);
    return 'https://www.youtube.com/watch?v=' + source.videoId + '&t=' + time + 's';
  }
  function sourceTime(id, countdown) {
    const [m, s] = countdown.split(':').map(Number);
    const time = sourceLinks[id].offset - (m * 60 + s);
    return Math.floor(time / 60) + ':' + String(time % 60).padStart(2, '0');
  }
  const sourcePoster = (id, countdown) => context.asset(eventConfig.snapshots[countdown][id]);
  const observers = new Map(evidence.sourceObservers.map(item => [item.sourceId, item]));
  function renderSources(countdown) {
    $('videos').innerHTML = evidence.sourceObservers.map(item => `
      <figure class="video-card"><img src="${sourcePoster(item.sourceId, countdown)}" alt="${item.playerName}視角・戰場倒數 ${countdown}" loading="lazy">
      <figcaption><b>${item.playerName}視角</b><small>${item.profession}・${item.assignment}｜戰場倒數 ${countdown}｜原片 ${sourceTime(item.sourceId, countdown)}</small>
      <a href="${originalLink(item.sourceId, countdown)}" target="_blank" rel="noopener noreferrer">觀看原片此刻 ↗</a></figcaption></figure>`).join('');
    $('video-clock').textContent = countdown;
    $('video-status').textContent = '截圖對應目前 3D 快照；連結將另開原網站到對應時間，不在此頁同步播放。';
  }

  renderSources(data.activeSnapshot);
  const keyframeCountdowns = Object.keys(eventConfig.keyframes);
  const keyframePath = (sourceId, countdown) => context.asset(eventConfig.keyframes[countdown][sourceId]);
  let activeKeyframe = keyframeCountdowns.includes(data.activeSnapshot) ? data.activeSnapshot : keyframeCountdowns[0];
  $('keyframe-buttons').innerHTML = keyframeCountdowns.map(countdown => `<button type="button" data-keyframe="${countdown}" aria-pressed="${countdown === activeKeyframe}">${countdown}</button>`).join('');
  $('keyframe-grid').innerHTML = evidence.sourceObservers.map(item => `
    <figure class="keyframe-card"><img data-keyframe-source="${item.sourceId}" alt="${item.sourceId} ${activeKeyframe} 關鍵幀">
    <figcaption><b>${item.sourceId}・${item.playerName}</b>　${item.profession}・${item.assignment}<br><a data-keyframe-link="${item.sourceId}" target="_blank" rel="noopener noreferrer">觀看原片此刻 ↗</a></figcaption></figure>`).join('');
  function setKeyframe(countdown) {
    if (!keyframeCountdowns.includes(countdown)) return false;
    activeKeyframe = countdown;
    document.querySelectorAll('[data-keyframe]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.keyframe === countdown)));
    document.querySelectorAll('[data-keyframe-source]').forEach(image => {
      image.src = keyframePath(image.dataset.keyframeSource, countdown);
      image.alt = `${image.dataset.keyframeSource} ${countdown} 關鍵幀`;
    });
    document.querySelectorAll('[data-keyframe-link]').forEach(link => {
      link.href = originalLink(link.dataset.keyframeLink, countdown);
      link.textContent = `觀看原片此刻（原片 ${sourceTime(link.dataset.keyframeLink, countdown)}）↗`;
    });
    $('keyframe-note').textContent = `${countdown}・四視角同一塔區關鍵幀。只將可交叉核對的人物放進共同場景，其餘維持區域級描述。`;
    return true;
  }
  document.querySelectorAll('[data-keyframe]').forEach(button => button.onclick = () => setKeyframe(button.dataset.keyframe));
  setKeyframe(activeKeyframe);

  const T = window.THREE;
  const canvas = $('scene');
  let renderer;
  try {
    renderer = new T.WebGLRenderer({ canvas, antialias: true, alpha: true, preserveDrawingBuffer: true });
  } catch (error) {
    $('video-status').textContent = 'WebGL 無法啟動；證據截圖與原片連結仍可使用。';
    return;
  }
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = T.PCFSoftShadowMap;
  renderer.outputColorSpace = T.SRGBColorSpace;
  renderer.toneMapping = T.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;

  const scene = new T.Scene();
  const camera = new T.PerspectiveCamera(43, 1, .1, 180);
  scene.add(new T.HemisphereLight(0xe4f1f8, 0x695744, 2.1));
  const sun = new T.DirectionalLight(0xffdfaa, 3.4);
  sun.position.set(-15, 28, 15);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -26, right: 26, top: 26, bottom: -26, near: 1, far: 70 });
  scene.add(sun);
  const fill = new T.DirectionalLight(0x78a4c8, 1.2);
  fill.position.set(18, 13, -18);
  scene.add(fill);

  const root = new T.Group();
  const inferred = new T.Group();
  scene.add(root, inferred);
  const materials = new Map();
  function material(color, roughness = .82) {
    const key = `${color}:${roughness}`;
    if (!materials.has(key)) materials.set(key, new T.MeshStandardMaterial({ color, roughness }));
    return materials.get(key);
  }
  function mesh(geometry, mat, parent = root) {
    const item = new T.Mesh(geometry, mat);
    item.castShadow = true;
    item.receiveShadow = true;
    parent.add(item);
    return item;
  }
  function box(x, y, z, width, height, depth, color, parent = root) {
    const item = mesh(new T.BoxGeometry(width, height, depth), material(color), parent);
    item.position.set(x, y, z);
    return item;
  }
  function cylinder(x, y, z, top, bottom, height, color, segments = 24, parent = root) {
    const item = mesh(new T.CylinderGeometry(top, bottom, height, segments), material(color), parent);
    item.position.set(x, y, z);
    return item;
  }
  function beam(startArray, endArray, width, color, parent = root) {
    const start = new T.Vector3(...startArray);
    const end = new T.Vector3(...endArray);
    const vector = end.clone().sub(start);
    const item = mesh(new T.CylinderGeometry(width, width, vector.length(), 7), material(color), parent);
    item.position.copy(start.add(end).multiplyScalar(.5));
    item.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), vector.normalize());
    return item;
  }

  // Direct topology: circular stone platform with the tower at its center.
  cylinder(0, -.4, 0, 12.35, 12.6, .8, 0x4b5050, 96);
  cylinder(0, .02, 0, 12, 12, .16, 0x88857a, 96).castShadow = false;
  for (let ring = 3; ring <= 11; ring += 2) {
    const line = mesh(new T.TorusGeometry(ring, .045, 6, 96), material(0xaaa697));
    line.rotation.x = Math.PI / 2;
    line.position.y = .13;
  }
  for (let spoke = 0; spoke < 16; spoke++) {
    const angle = spoke / 16 * Math.PI * 2;
    const line = beam([Math.sin(angle) * 2.2, .14, Math.cos(angle) * 2.2], [Math.sin(angle) * 11.9, .14, Math.cos(angle) * 11.9], .035, 0x716f69);
    line.castShadow = false;
  }
  const rim = mesh(new T.TorusGeometry(12.2, .12, 8, 128), material(0xb2afa3));
  rim.rotation.x = Math.PI / 2;
  rim.position.y = .2;
  const roadWidth = 24 * .55;
  box(0, -.12, 16, roadWidth, .45, 12, 0x6f6a60);
  box(0, -.12, -16, roadWidth, .45, 12, 0x6f6a60);

  // Central tower, intentionally centered after the user's geometry correction.
  const tower = new T.Group();
  root.add(tower);
  box(0, .35, 0, 3.8, .6, 3.8, 0x62645e, tower);
  box(0, .9, 0, 3.35, .25, 3.35, 0x745c43, tower);
  for (const x of [-1.35, 1.35]) for (const z of [-1.35, 1.35]) cylinder(x, 2.6, z, .17, .23, 4.8, 0x493b30, 8, tower);
  for (const z of [-1.45, 1.45]) box(0, 4.45, z, 3.3, .25, .25, 0x866846, tower);
  for (const x of [-1.45, 1.45]) box(x, 4.45, 0, .25, .25, 3.3, 0x866846, tower);
  const roof = cylinder(0, 5.3, 0, .15, 3.15, 1.65, 0x35434a, 4, tower);
  roof.rotation.y = Math.PI / 4;
  box(0, 6.2, 0, .2, .35, 1.2, 0x555f5d, tower);

  // The platform is flanked by rock walls; both the 12 and 6 o'clock ends are roads.
  let seed = 8110;
  const random = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
  for (const side of [-1, 1]) for (let index = 0; index < 10; index++) {
    const rock = mesh(new T.DodecahedronGeometry(1.1 + random() * .8, 0), material(0x76543d));
    rock.position.set(side * (12.2 + random() * 1.7), .5 + random() * .8, -8.2 + index * 1.8 + random() * .5);
    rock.scale.set(1 + random(), 1.3 + random() * 1.7, 1 + random() * .5);
    rock.rotation.set(random(), random(), random());
  }

  const actorById = new Map(data.actors.map(item => [item.id, item]));
  const actorObjects = new Map();
  const hitMeshes = [];
  const labels = [];
  const colors = { ally: 0x58c9ee, enemy: 0xf17072 };
  function addDirectionLabel(text, x, z, lateral = false) {
    const element = document.createElement('div');
    element.className = `direction-label${lateral ? ' lateral' : ''}`;
    element.textContent = text;
    $('labels').append(element);
    labels.push({ element, position: new T.Vector3(x, .45, z) });
  }
  const enemyTower = data.terrain.towerSide === 'enemy';
  document.querySelector('.stage-info small').textContent = enemyTower ? '敵方塔：12 點是塔後，6 點是塔前' : '我方塔：12 點是塔前，6 點是塔後';
  $('scene').setAttribute('aria-label', `${evidence.objective.displayName}三維觀察草模`);
  document.querySelector('.stage-note span:last-child').textContent = `${data.snapshots.length} 個離散檢查點，不在快照間插值；座標不是遊戲公尺`;
  addDirectionLabel(enemyTower ? '12 點・塔後\n往敵方大本營' : '12 點・塔前\n往中央河道', 0, 14.2);
  addDirectionLabel(enemyTower ? '6 點・塔前\n往中央河道' : '6 點・塔後\n往我方大本營', 0, -14.2);
  addDirectionLabel('3 點・上路側', -11.5, 0, true);
  addDirectionLabel('9 點・下路側', 11.5, 0, true);
  function addLabel(actor, position) {
    const element = document.createElement('div');
    element.className = `scene-label ${actor.side === 'enemy' ? 'enemy' : ''} ${actor.kind === 'group' ? 'group' : ''}`;
    element.textContent = actor.label;
    $('labels').append(element);
    const record = { element, position };
    labels.push(record);
    return record;
  }
  for (const actor of data.actors) {
    const group = new T.Group();
    scene.add(group);
    const color = colors[actor.side];
    const size = actor.kind === 'group' ? .72 : .52;
    const base = mesh(new T.CylinderGeometry(size, size, .09, 32), material(0x1d3440), group);
    base.position.y = .07;
    const ringActor = mesh(new T.TorusGeometry(size, .06, 8, 32), material(color), group);
    ringActor.rotation.x = Math.PI / 2;
    ringActor.position.y = .14;
    const bodyCount = actor.kind === 'group' ? 3 : 1;
    for (let index = 0; index < bodyCount; index++) {
      const x = actor.kind === 'group' ? (index - 1) * .42 : 0;
      const body = mesh(new T.CylinderGeometry(.2, .3, .8, 8), material(color), group);
      body.position.set(x, .72, 0);
      const head = mesh(new T.SphereGeometry(.18, 10, 8), material(0xe1c9a1), group);
      head.position.set(x, 1.27, 0);
    }
    const hit = mesh(new T.CylinderGeometry(size, size, 1.8, 10), new T.MeshBasicMaterial({ visible: false }), group);
    hit.position.y = .9;
    hit.userData.actorId = actor.id;
    hitMeshes.push(hit);
    const label = addLabel(actor, new T.Vector3());
    actorObjects.set(actor.id, { actor, group, ring: ringActor, label });

    const button = document.createElement('button');
    button.className = `actor ${actor.side === 'enemy' ? 'enemy' : ''}`;
    button.dataset.actor = actor.id;
    button.setAttribute('aria-pressed', 'false');
    button.innerHTML = `<b>${actor.label}</b><small>${actor.profession}・${actor.kind === 'group' ? '群組棋子' : observers.get(actor.id.replace('OBS_', ''))?.assignment || '錄影者'}</small>`;
    button.onclick = () => selectActor(actor.id);
    $('actor-list').append(button);
  }

  const teachingBySnapshot = new Map(data.snapshots.map(snapshot => [snapshot.battleCountdown, Object.fromEntries(
    Object.entries(snapshot.positions).map(([id, position]) => [id, { x: position[0], z: position[1] }]),
  )]));
  const routesBySnapshot = new Map(data.snapshots.map(snapshot => [snapshot.battleCountdown, []]));
  const notesBySnapshot = new Map();
  $('tactical-notes').addEventListener('input', () => { if (mode === 'teaching') notesBySnapshot.set(activeSnapshot, $('tactical-notes').value); });
  const reason = document.createElement('div');
  reason.id = 'selection-reason'; reason.className = 'selection-reason';
  reason.textContent = eventConfig.selectionReason + '\n\n' + eventConfig.evidenceBoundary;
  $('tactical-notes').before(reason);
  function renderNotesMode() {
    const teaching = mode === 'teaching';
    $('tactical-notes-panel').hidden = false;
    $('tactical-notes').hidden = !teaching; reason.hidden = teaching;
    $('tactical-notes-panel').querySelector('label').textContent = teaching ? '戰術說明' : '選段理由與證據界線';
    $('tactical-notes-panel').querySelector('small').textContent = teaching ? '隨目前快照另存新檔；原始觀察草模不會被修改。' : '此說明屬於整個事件，切換快照不會改變。';
  }
  let routeEditor = null;
  let activeSnapshot = data.activeSnapshot;
  let mode = 'original';
  let selectedActor = null;
  const teachingLines = new T.Group();
  scene.add(teachingLines);
  function snapshotData() { return data.snapshots.find(item => item.battleCountdown === activeSnapshot); }
  function originalPosition(id) {
    const position = snapshotData().positions[id];
    return { x: position[0], z: position[1] };
  }
  function clearTeachingLines() {
    while (teachingLines.children.length) teachingLines.remove(teachingLines.children[0]);
  }
  function syncActors() {
    clearTeachingLines();
    for (const [id, object] of actorObjects) {
      const original = originalPosition(id);
      const current = mode === 'teaching' ? teachingBySnapshot.get(activeSnapshot)[id] : original;
      object.group.position.set(current.x, .22, current.z);
      object.label.position.set(current.x, 2.2, current.z);
      if (mode === 'teaching' && Math.hypot(current.x - original.x, current.z - original.z) > .05) {
        const start = new T.Vector3(original.x, .34, original.z);
        const end = new T.Vector3(current.x, .34, current.z);
        const direction = end.clone().sub(start);
        teachingLines.add(new T.ArrowHelper(direction.clone().normalize(), start, direction.length(), 0xefc979, .7, .35));
      }
    }
  }
  function renderSnapshotSummary() {
    const snapshot = evidence.snapshots.find(item => item.battleCountdown === activeSnapshot);
    const readings = snapshot.towerHp.map(item => ({ percent: item.percent.toFixed(1), source: observers.get(item.sourceId)?.playerName || item.sourceId }));
    const sameReading = new Set(readings.map(item => item.percent)).size === 1;
    const towerLine = sameReading
      ? `<strong>${snapshot.battleCountdown}・${evidence.objective.displayName}・剩餘血量 ${readings[0].percent}%</strong><small>塔血來源：${readings.map(item => `${item.source}視角`).join('／')}</small>`
      : `<strong>${snapshot.battleCountdown}・${evidence.objective.displayName}</strong><small>剩餘血量：${readings.map(item => `${item.source}視角 ${item.percent}%`).join('／')}</small>`;
    $('snapshot-summary').innerHTML = `${towerLine}<small>${snapshot.summary}</small><small>可見下限：我方 ${snapshot.crowdLowerBound.allies}／敵方 ${snapshot.crowdLowerBound.enemies}（不跨視角相加）</small>`;
    $('scene-time').textContent = `${activeSnapshot}・${mode === 'teaching' ? '教學分支' : '觀察草模'}`;
    document.querySelectorAll('[data-snapshot]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.snapshot === activeSnapshot)));
  }
  function setSnapshot(countdown) {
    if (!data.snapshots.some(item => item.battleCountdown === countdown)) return false;
    if (countdown !== activeSnapshot && routeEditor?.isDrawing() && !window.confirm('路線尚未完成；取消可返回繼續繪製，確定會放棄未完成路線並切換快照。')) return false;
    if (routeEditor) routesBySnapshot.set(activeSnapshot, routeEditor.getRoutes());
    activeSnapshot = countdown;
    const address = new URL(location.href);
    address.searchParams.set('snapshot', countdown); history.replaceState(null, '', address);
    $('tactical-notes').value = notesBySnapshot.get(activeSnapshot) ?? '';
    renderSources(countdown);
    syncActors();
    routeEditor?.setRoutes(routesBySnapshot.get(activeSnapshot) ?? []);
    renderSnapshotSummary();
    return true;
  }
  $('snapshot-buttons').innerHTML = data.snapshots.map(item => `<button data-snapshot="${item.battleCountdown}">${item.battleCountdown}</button>`).join('');
  document.querySelectorAll('[data-snapshot]').forEach(button => button.onclick = () => setSnapshot(button.dataset.snapshot));
  function setMode(next) {
    mode = next;
    renderNotesMode();
    $('original').setAttribute('aria-pressed', String(mode === 'original'));
    $('teaching').setAttribute('aria-pressed', String(mode === 'teaching'));
    $('stage').classList.toggle('editing', mode === 'teaching');
    if (mode !== 'teaching') routeEditor?.cancel();
    routeEditor?.refresh();
    syncActors();
    renderSnapshotSummary();
  }
  $('original').onclick = () => setMode('original');
  $('teaching').onclick = () => setMode('teaching');
  function selectActor(id) {
    if (!actorObjects.has(id)) return false;
    selectedActor = id;
    document.querySelectorAll('[data-actor]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.actor === id)));
    actorObjects.forEach((object, key) => {
      object.label.element.classList.toggle('selected', key === id);
      object.ring.material = material(key === id ? 0xefc979 : colors[object.actor.side]);
    });
    const actor = actorById.get(id);
    $('evidence').innerHTML = `<strong>${actor.label}・${actor.profession}</strong>${actor.evidence}<br>位置信心：${actor.confidence}`;
    return true;
  }
  function canPlace(x, z) {
    const onDisc = Math.hypot(x, z) < 11.5 && !(Math.abs(x) > 9 && Math.abs(z) < 8.5);
    const onRoad = Math.abs(x) < 24 * .55 / 2 - .4 && Math.abs(z) >= 11 && Math.abs(z) <= 22;
    return Number.isFinite(x) && Number.isFinite(z) && (onDisc || onRoad) && Math.hypot(x, z) > 2.25;
  }
  function moveActor(id, x, z) {
    if (mode !== 'teaching' || !actorObjects.has(id) || !canPlace(x, z)) return false;
    teachingBySnapshot.get(activeSnapshot)[id] = { x, z };
    syncActors();
    return true;
  }
  $('reset').onclick = () => {
    const snapshot = snapshotData();
    teachingBySnapshot.set(activeSnapshot, Object.fromEntries(Object.entries(snapshot.positions).map(([id, position]) => [id, { x: position[0], z: position[1] }])));
    routesBySnapshot.set(activeSnapshot, []);
    notesBySnapshot.set(activeSnapshot, '');
    $('tactical-notes').value = '';
    routeEditor?.setRoutes([]);
    syncActors();
  };
  $('export').onclick = () => {
    if (routeEditor.isDrawing()) { $('evidence').textContent = '請先雙擊完成路線或取消繪製，再另存新檔。'; return; }
    const payload = {
      schemaVersion: 1,
      type: 'e01-teaching-branch',
      eventId: data.eventId,
      source: { matchId: context.match.id, eventId: eventConfig.id, snapshot: activeSnapshot },
      snapshot: activeSnapshot,
      coordinateSystem: data.coordinateSystem,
      original: Object.fromEntries(Object.keys(snapshotData().positions).map(id => [id, originalPosition(id)])),
      teaching: teachingBySnapshot.get(activeSnapshot),
      tacticalNotes: notesBySnapshot.get(activeSnapshot) ?? '',
      routes: routeEditor.getRoutes(),
      note: 'Teaching positions are separate from the manual observation draft.',
    };
    const url = URL.createObjectURL(new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `${context.match.id}-${eventConfig.id}-${activeSnapshot.replace(':', '')}-teaching.json`;
    link.click();
    window.UnsavedGuard.saved(activeSnapshot);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  $('import').onclick = () => $('import-file').click();
  $('import-file').onchange = async event => {
    const file = event.target.files[0];
    event.target.value = '';
    if (!file) return;
    try {
      const payload = JSON.parse(await file.text());
      if (payload.source ? (payload.source.matchId !== context.match.id || payload.source.eventId !== eventConfig.id || payload.source.snapshot !== payload.snapshot) : (context.match.id !== '20260829-round2' || eventConfig.id !== 'P4-C02')) throw new Error('教學檔屬於其他場次／事件，請先切換到來源覆盤');
      if (payload.type !== 'e01-teaching-branch' || payload.eventId !== data.eventId || !data.snapshots.some(item => item.battleCountdown === payload.snapshot)) throw new Error('不是本事件的教學檔');
      const positions = {};
      for (const actor of data.actors) {
        const point = payload.teaching?.[actor.id];
        if (!point || !canPlace(Number(point.x), Number(point.z))) throw new Error(`${actor.id} 位置無效`);
        positions[actor.id] = { x: Number(point.x), z: Number(point.z) };
      }
      const routes = routeEditor.validate(payload.routes ?? []);
      if (!window.UnsavedGuard.confirm([payload.snapshot])) return;
      teachingBySnapshot.set(payload.snapshot, positions);
      setSnapshot(payload.snapshot);
      notesBySnapshot.set(payload.snapshot, typeof payload.tacticalNotes === 'string' ? payload.tacticalNotes.slice(0, 10000) : '');
      $('tactical-notes').value = notesBySnapshot.get(payload.snapshot);
      routesBySnapshot.set(payload.snapshot, routes);
      routeEditor.setRoutes(routes);
      setMode('teaching');
      window.UnsavedGuard.saved(payload.snapshot);
      $('evidence').innerHTML = '<strong>已開啟教學檔</strong>原始觀察草模未被修改。';
    } catch (error) {
      $('evidence').innerHTML = `<strong>開啟失敗，現有內容保持不變</strong>${error.message}`;
    }
  };
  $('warnings').innerHTML = data.warnings.map(item => `<li>${item}</li>`).join('');

  const target = new T.Vector3(0, 0, 0);
  let theta = Math.PI;
  let phi = .68;
  let radius = 48;
  const presets = {
    overview: { theta: Math.PI, phi: .68, radius: 48, target: [0, 0, 0] },
    source: { theta: -.35, phi: .92, radius: 29, target: [0, 1, 1] },
    top: { theta: Math.PI, phi: .06, radius: 46, target: [0, 0, 0] },
    reverse: { theta: 0, phi: .72, radius: 46, target: [0, 1, 0] },
  };
  function updateCamera() {
    camera.position.set(target.x + radius * Math.sin(phi) * Math.sin(theta), target.y + radius * Math.cos(phi), target.z + radius * Math.sin(phi) * Math.cos(theta));
    camera.lookAt(target);
    camera.updateMatrixWorld();
  }
  function setCamera(name) {
    const preset = presets[name];
    if (!preset) return false;
    theta = preset.theta;
    phi = preset.phi;
    radius = preset.radius;
    target.set(...preset.target);
    updateCamera();
    return true;
  }
  document.querySelectorAll('[data-camera]').forEach(button => button.onclick = () => setCamera(button.dataset.camera));
  const raycaster = new T.Raycaster();
  const pointer = new T.Vector2();
  const plane = new T.Plane(new T.Vector3(0, 1, 0), -.22);
  function cast(event) {
    const rect = canvas.getBoundingClientRect();
    pointer.set((event.clientX - rect.left) / rect.width * 2 - 1, -(event.clientY - rect.top) / rect.height * 2 + 1);
    raycaster.setFromCamera(pointer, camera);
  }
  function groundPoint(event) {
    cast(event);
    return raycaster.ray.intersectPlane(plane, new T.Vector3());
  }
  routeEditor = window.createRouteEditor3D({
    THREE: T,
    parent: scene,
    canvas,
    raycaster,
    cast,
    groundPoint,
    canPlace,
    color: () => $('route-color').value,
    colorSelect: $('route-color'),
    label: () => '',
    list: $('route-list'),
    startButton: $('route-start'),
    cancelButton: $('route-cancel'),
    deleteButton: $('route-delete'),
    undoButton: $('route-undo'),
    addPointButton: $('route-add-node'),
    removePointButton: $('route-remove-node'),
    isEnabled: () => mode === 'teaching',
    onStatus: text => { $('evidence').innerHTML = `<strong>教學路線</strong>${text}`; },
    onMode: drawing => $('stage').classList.toggle('drawing-route', drawing),
    onChange: routes => routesBySnapshot.set(activeSnapshot, routes),
  });
  let gesture = null;
  canvas.addEventListener('pointerdown', event => {
    if (gesture) return;
    cast(event);
    const hit = raycaster.intersectObjects(hitMeshes)[0];
    const actorId = hit?.object.userData.actorId;
    if (actorId) selectActor(actorId);
    gesture = { id: event.pointerId, x: event.clientX, y: event.clientY, startX: event.clientX, startY: event.clientY, actor: mode === 'teaching' ? actorId : null, pan: event.button === 2 || event.shiftKey };
    canvas.setPointerCapture(event.pointerId);
  });
  canvas.addEventListener('pointermove', event => {
    if (!gesture || gesture.id !== event.pointerId) return;
    const dx = event.clientX - gesture.x;
    const dy = event.clientY - gesture.y;
    if (gesture.actor) {
      const point = groundPoint(event);
      if (point) moveActor(gesture.actor, point.x, point.z);
    } else if (gesture.pan) {
      const right = new T.Vector3().setFromMatrixColumn(camera.matrix, 0);
      const forward = new T.Vector3(Math.sin(theta), 0, Math.cos(theta));
      target.addScaledVector(right, -dx * radius * .0015);
      target.addScaledVector(forward, -dy * radius * .0015);
      updateCamera();
    } else {
      theta -= dx * .006;
      phi = Math.max(.06, Math.min(1.43, phi - dy * .004));
      updateCamera();
    }
    gesture.x = event.clientX;
    gesture.y = event.clientY;
  });
  function release(event) {
    if (!gesture || gesture.id !== event.pointerId) return;
    gesture = null;
    if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
  }
  canvas.addEventListener('pointerup', release);
  canvas.addEventListener('pointercancel', release);
  canvas.addEventListener('contextmenu', event => event.preventDefault());
  canvas.addEventListener('wheel', event => {
    event.preventDefault();
    radius = Math.max(13, Math.min(70, radius * Math.exp(event.deltaY * .001)));
    updateCamera();
  }, { passive: false });

  function resize() {
    const rect = $('stage').getBoundingClientRect();
    renderer.setSize(rect.width, rect.height, false);
    camera.aspect = rect.width / rect.height;
    camera.updateProjectionMatrix();
  }
  new ResizeObserver(resize).observe($('stage'));
  resize();
  setCamera('overview');
  function render() {
    renderer.render(scene, camera);
    const rect = canvas.getBoundingClientRect();
    labels.forEach(item => {
      const point = item.position.clone().project(camera);
      item.element.style.display = point.z > 1 || point.z < -1 ? 'none' : '';
      item.element.style.left = `${Math.max(35, Math.min(rect.width - 35, (point.x * .5 + .5) * rect.width))}px`;
      item.element.style.top = `${(-point.y * .5 + .5) * rect.height}px`;
    });
    requestAnimationFrame(render);
  }
  render();
  setSnapshot(data.activeSnapshot);
  selectActor('OBS_V06');

  window.eventReview = {
    ready: true,
    get mode() { return mode; },
    get snapshot() { return activeSnapshot; },
    get selectedActor() { return selectedActor; },
    get keyframe() { return activeKeyframe; },
    directions: { twelve: enemyTower ? 'tower rear toward enemy base' : 'tower front toward central river', six: enemyTower ? 'tower front toward central river' : 'tower rear toward ally base', three: 'upper-lane side', nine: 'lower-lane side' },
    setMode,
    setSnapshot,
    setKeyframe,
    setCamera,
    selectActor,
    moveActor,
    canPlace,
    getOriginal: () => Object.fromEntries(Object.keys(snapshotData().positions).map(id => [id, originalPosition(id)])),
    getTeaching: () => JSON.parse(JSON.stringify(teachingBySnapshot.get(activeSnapshot))),
    getRoutes: () => routeEditor.getRoutes(),
    routeEditor,
  };
  for (const snapshot of data.snapshots) {
    const key = snapshot.battleCountdown;
    window.UnsavedGuard.track(key, () => ({ teaching: teachingBySnapshot.get(key), notes: notesBySnapshot.get(key) ?? '', routes: key === activeSnapshot ? routeEditor.getRoutes() : routesBySnapshot.get(key), draft: key === activeSnapshot ? routeEditor.draftPoints : null }));
  }
  renderNotesMode();
  if (requestedSnapshot) setSnapshot(requestedSnapshot);
})();
