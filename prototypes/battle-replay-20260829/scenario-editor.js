'use strict';
(() => {
  const $ = id => document.getElementById(id);
  const T = window.THREE;
  if (!T) {
    $('status').textContent = '3D 引擎未載入，無法啟動空白劇本。';
    return;
  }

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
  const scenes = [
    { id: 'ally_upper_outer', label: '我方上外塔', kind: 'outer', side: 'ally', lane: 'upper' },
    { id: 'ally_middle_outer', label: '我方中外塔', kind: 'outer', side: 'ally', lane: 'middle' },
    { id: 'ally_lower_outer', label: '我方下外塔', kind: 'outer', side: 'ally', lane: 'lower' },
    { id: 'enemy_upper_outer', label: '敵方上外塔', kind: 'outer', side: 'enemy', lane: 'upper' },
    { id: 'enemy_middle_outer', label: '敵方中外塔', kind: 'outer', side: 'enemy', lane: 'middle' },
    { id: 'enemy_lower_outer', label: '敵方下外塔', kind: 'outer', side: 'enemy', lane: 'lower' },
    { id: 'ally_home', label: '我方家中', kind: 'home', side: 'ally' },
    { id: 'enemy_home', label: '敵方家中', kind: 'home', side: 'enemy' },
    { id: 'ally_upper_wild', label: '我方上野區', kind: 'wild', side: 'ally', lane: 'upper' },
    { id: 'ally_lower_wild', label: '我方下野區', kind: 'wild', side: 'ally', lane: 'lower' },
    { id: 'enemy_upper_wild', label: '敵方上野區', kind: 'wild', side: 'enemy', lane: 'upper' },
    { id: 'enemy_lower_wild', label: '敵方下野區', kind: 'wild', side: 'enemy', lane: 'lower' },
    { id: 'central_corridor', label: '中央河道', kind: 'corridor' },
    { id: 'full_map', label: '全場戰術圖', kind: 'full' },
  ];
  const sceneById = new Map(scenes.map(item => [item.id, item]));
  const kindLabels = { outer: '外塔場景', home: '家中場景', wild: '野區場景', corridor: '中央大道場景', full: '全場平面場景' };

  function appendSceneOptions() {
    const groups = [
      ['六座外塔', scenes.filter(item => item.kind === 'outer')],
      ['家中', scenes.filter(item => item.kind === 'home')],
      ['野區', scenes.filter(item => item.kind === 'wild')],
      ['中央區域', scenes.filter(item => item.kind === 'corridor')],
      ['全場', scenes.filter(item => item.kind === 'full')],
    ];
    for (const [label, items] of groups) {
      const group = document.createElement('optgroup');
      group.label = label;
      for (const item of items) group.append(new Option(item.label, item.id));
      $('scene-select').append(group);
    }
    professions.forEach(item => $('piece-profession').append(new Option(item.label, item.id)));
  }
  appendSceneOptions();

  let renderer;
  try {
    renderer = new T.WebGLRenderer({ canvas: $('scene'), antialias: true, alpha: true, preserveDrawingBuffer: true });
  } catch (error) {
    $('status').textContent = 'WebGL 無法啟動，請改用支援 WebGL 的瀏覽器。';
    return;
  }
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
  renderer.setClearColor(0x0a131b, 1);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = T.PCFSoftShadowMap;
  renderer.outputColorSpace = T.SRGBColorSpace;
  renderer.toneMapping = T.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;

  const world = new T.Scene();
  const camera = new T.PerspectiveCamera(43, 1, .1, 180);
  world.add(new T.HemisphereLight(0xe4f1f8, 0x5d4b39, 2));
  const sun = new T.DirectionalLight(0xffdfaa, 3.1);
  sun.position.set(-15, 28, 15);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -26, right: 26, top: 26, bottom: -26, near: 1, far: 70 });
  world.add(sun);
  const fill = new T.DirectionalLight(0x78a4c8, 1.1);
  fill.position.set(18, 13, -18);
  world.add(fill);

  const materials = new Map();
  function material(color, roughness = .82) {
    const key = `${color}:${roughness}`;
    if (!materials.has(key)) materials.set(key, new T.MeshStandardMaterial({ color, roughness }));
    return materials.get(key);
  }
  function mesh(geometry, mat, parent) {
    const item = new T.Mesh(geometry, mat);
    item.castShadow = true;
    item.receiveShadow = true;
    parent.add(item);
    return item;
  }
  function box(parent, x, y, z, width, height, depth, color) {
    const item = mesh(new T.BoxGeometry(width, height, depth), material(color), parent);
    item.position.set(x, y, z);
    return item;
  }
  function cylinder(parent, x, y, z, top, bottom, height, color, segments = 32) {
    const item = mesh(new T.CylinderGeometry(top, bottom, height, segments), material(color), parent);
    item.position.set(x, y, z);
    return item;
  }
  function beam(parent, startArray, endArray, width, color) {
    const start = new T.Vector3(...startArray);
    const end = new T.Vector3(...endArray);
    const vector = end.clone().sub(start);
    const item = mesh(new T.CylinderGeometry(width, width, vector.length(), 7), material(color), parent);
    item.position.copy(start.add(end).multiplyScalar(.5));
    item.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), vector.normalize());
    return item;
  }

  let terrain = new T.Group();
  world.add(terrain);
  let activeSceneId = scenes[0].id;
  const labels = [];
  const terrainLabels = [];
  function addTerrainLabel(text, x, z, lateral = false) {
    const element = document.createElement('div');
    element.className = `direction-label${lateral ? ' lateral' : ''}`;
    element.textContent = text;
    $('labels').append(element);
    const record = { element, position: new T.Vector3(x, .45, z) };
    labels.push(record);
    terrainLabels.push(record);
  }
  function clearTerrainLabels() {
    for (const record of terrainLabels.splice(0)) {
      record.element.remove();
      const index = labels.indexOf(record);
      if (index >= 0) labels.splice(index, 1);
    }
  }
  function homeLayout(sceneData) {
    const middleSign = sceneData.side === 'ally' ? 1 : -1;
    const middleTowerDistance = 20.5;
    const sideTowerDistance = middleTowerDistance * 1.3;
    const stairBoundaryDistance = middleTowerDistance * .62;
    return {
      middleSign,
      stairSign: -middleSign,
      middleTowerDistance,
      sideTowerDistance,
      wallX: 18.8,
      middleBoundaryDistance: 16.3,
      stairBoundaryDistance,
      stairPlatformDistance: middleTowerDistance * .55,
      towers: [
        { x: -sideTowerDistance, z: 0, lane: '上路' },
        { x: sideTowerDistance, z: 0, lane: '下路' },
        { x: 0, z: middleSign * middleTowerDistance, lane: '中路' },
      ],
    };
  }
  function wildLayout(sceneData) {
    const owner = sceneData.side === 'ally' ? '我方' : '敵方';
    const upper = sceneData.lane === 'upper';
    return {
      threeLane: `${owner}${upper ? '上路' : '中路'}`,
      nineLane: `${owner}${upper ? '中路' : '下路'}`,
    };
  }
  function addDirectionLabels(sceneData) {
    if (sceneData.kind === 'outer') {
      const allyTower = sceneData.side === 'ally';
      addTerrainLabel(`12 點・${allyTower ? '塔前' : '塔後'}\n${allyTower ? '往中央河道' : '往敵方大本營'}`, 0, 14.2);
      addTerrainLabel(`6 點・${allyTower ? '塔後' : '塔前'}\n${allyTower ? '往我方大本營' : '往中央河道'}`, 0, -14.2);
      addTerrainLabel('3 點・上路側', -11.5, 0, true);
      addTerrainLabel('9 點・下路側', 11.5, 0, true);
    } else if (sceneData.kind === 'home') {
      const owner = sceneData.side === 'ally' ? '我方' : '敵方';
      const layout = homeLayout(sceneData);
      addTerrainLabel(`3 點・上路門\n${owner}上路內塔`, -layout.sideTowerDistance, 0, true);
      addTerrainLabel(`9 點・下路門\n${owner}下路內塔`, layout.sideTowerDistance, 0, true);
      addTerrainLabel(`${layout.middleSign > 0 ? '12' : '6'} 點・中路門\n${owner}中路內塔`, 0, layout.middleSign * layout.middleTowerDistance);
      addTerrainLabel(`${layout.stairSign > 0 ? '12' : '6'} 點・樓梯平台\n無出口・無塔`, 0, layout.stairSign * layout.stairPlatformDistance);
    } else if (sceneData.kind === 'wild') {
      const layout = wildLayout(sceneData);
      addTerrainLabel('12 點・敵方側山壁\n不可直接穿越', 0, 10.8);
      addTerrainLabel('6 點・我方側山壁\n不可直接穿越', 0, -10.8);
      addTerrainLabel(`3 點出口\n通往${layout.threeLane}`, -16.7, 0, true);
      addTerrainLabel(`9 點出口\n通往${layout.nineLane}`, 16.7, 0, true);
    } else {
      addTerrainLabel('3 點・上路接點\n中央大道在此轉往外塔', -18.3, 0, true);
      addTerrainLabel('9 點・下路接點\n中央大道在此轉往外塔', 18.3, 0, true);
      for (const branch of corridorBranches()) {
        const clockSide = branch.sign > 0 ? '12 點側' : '6 點側';
        const sideLabel = branch.sign > 0 ? '敵方' : '我方';
        addTerrainLabel(`${clockSide}・${branch.screenPosition}支路\n接${sideLabel}${branch.lane}外塔`, branch.x, branch.sign * 15.8);
      }
    }
  }
  function buildOuterWalls() {
    let seed = 90817;
    const random = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
    for (const side of [-1, 1]) for (let index = 0; index < 10; index++) {
      const rock = mesh(new T.DodecahedronGeometry(1.15 + random() * .65, 0), material(0x70533f), terrain);
      rock.position.set(side * (12.2 + random() * 1.7), .55 + random() * .65, -8.2 + index * 1.8 + random() * .5);
      rock.scale.set(1.1 + random() * .7, 1.5 + random() * 1.3, 1 + random() * .5);
      rock.rotation.set(random(), random(), random());
    }
  }
  function buildOuterScene(sceneData) {
    cylinder(terrain, 0, -.4, 0, 12.35, 12.6, .8, 0x4b5050, 96);
    cylinder(terrain, 0, .02, 0, 12, 12, .16, 0x88857a, 96).castShadow = false;
    for (let ring = 3; ring <= 11; ring += 2) {
      const line = mesh(new T.TorusGeometry(ring, .045, 6, 96), material(0xaaa697), terrain);
      line.rotation.x = Math.PI / 2;
      line.position.y = .13;
    }
    for (let spoke = 0; spoke < 16; spoke++) {
      const angle = spoke / 16 * Math.PI * 2;
      beam(terrain, [Math.sin(angle) * 2.2, .14, Math.cos(angle) * 2.2], [Math.sin(angle) * 11.9, .14, Math.cos(angle) * 11.9], .035, 0x716f69).castShadow = false;
    }
    const roadWidth = 24 * .55;
    box(terrain, 0, -.12, 16, roadWidth, .45, 12, 0x6f6a60);
    box(terrain, 0, -.12, -16, roadWidth, .45, 12, 0x6f6a60);
    buildOuterWalls();
    box(terrain, 0, .35, 0, 3.8, .6, 3.8, 0x62645e);
    box(terrain, 0, .9, 0, 3.35, .25, 3.35, 0x745c43);
    for (const x of [-1.35, 1.35]) for (const z of [-1.35, 1.35]) cylinder(terrain, x, 2.6, z, .17, .23, 4.8, 0x493b30, 8);
    for (const z of [-1.45, 1.45]) box(terrain, 0, 4.45, z, 3.3, .25, .25, 0x866846);
    for (const x of [-1.45, 1.45]) box(terrain, x, 4.45, 0, .25, .25, 3.3, 0x866846);
    const roof = cylinder(terrain, 0, 5.3, 0, .15, 3.15, 1.65, 0x35434a, 4);
    roof.rotation.y = Math.PI / 4;
    addDirectionLabels(sceneData);
  }
  function buildHomeTower(x, z, color) {
    cylinder(terrain, x, .25, z, 1.45, 1.65, .5, 0x4f514d, 24);
    for (const offsetX of [-.75, .75]) for (const offsetZ of [-.75, .75]) cylinder(terrain, x + offsetX, 1.45, z + offsetZ, .12, .17, 2.4, 0x594536, 8);
    const roof = cylinder(terrain, x, 3.05, z, .1, 1.75, 1.05, 0x35434a, 4);
    roof.rotation.y = Math.PI / 4;
    cylinder(terrain, x, 3.95, z, .1, .13, .9, color, 10);
  }
  function buildHomeScene(sceneData) {
    const layout = homeLayout(sceneData);
    const middleBoundaryZ = layout.middleSign * layout.middleBoundaryDistance;
    const stairBoundaryZ = layout.stairSign * layout.stairBoundaryDistance;
    const floorCenterZ = (middleBoundaryZ + stairBoundaryZ) / 2;
    const floorDepth = Math.abs(middleBoundaryZ - stairBoundaryZ);
    box(terrain, 0, -.35, floorCenterZ, layout.wallX * 2 + .7, .7, floorDepth + .7, 0x555c5d);
    box(terrain, 0, .02, floorCenterZ, layout.wallX * 2, .16, floorDepth, 0x77766f);
    // The 3–9 o'clock axis is the long side; both walls leave a centered lane gate.
    const lowZ = Math.min(middleBoundaryZ, stairBoundaryZ);
    const highZ = Math.max(middleBoundaryZ, stairBoundaryZ);
    const gateHalfDepth = 2.5;
    for (const x of [-layout.wallX, layout.wallX]) {
      box(terrain, x, 1.4, (lowZ - gateHalfDepth) / 2, .55, 3.2, gateHalfDepth - lowZ, 0x59554e);
      box(terrain, x, 1.4, (gateHalfDepth + highZ) / 2, .55, 3.2, highZ - gateHalfDepth, 0x59554e);
    }
    // The middle-lane end has a gate; the mirrored end is a closed stair platform.
    for (const x of [-12.8, 12.8]) box(terrain, x, 1.4, middleBoundaryZ, 12, 3.2, .55, 0x59554e);
    box(terrain, 0, 1.4, stairBoundaryZ, layout.wallX * 2 + .55, 3.2, .55, 0x59554e);
    const sideRoadOuter = layout.sideTowerDistance + 7;
    const sideRoadCenter = (layout.wallX + sideRoadOuter) / 2;
    const sideRoadWidth = sideRoadOuter - layout.wallX;
    box(terrain, -sideRoadCenter, -.12, 0, sideRoadWidth, .45, 5, 0x6f6a60);
    box(terrain, sideRoadCenter, -.12, 0, sideRoadWidth, .45, 5, 0x6f6a60);
    box(terrain, 0, -.12, layout.middleSign * layout.middleTowerDistance, 5, .45, 9, 0x6f6a60);
    const stairStart = layout.stairPlatformDistance - 3.2;
    for (let step = 0; step < 3; step++) {
      const height = .35 + step * .32;
      box(terrain, 0, height / 2, layout.stairSign * (stairStart + step * 1.05), 8, height, 1.1, 0x696860);
    }
    box(terrain, 0, .65, layout.stairSign * layout.stairPlatformDistance, 8, 1.3, 2.55, 0x696860);
    const color = sceneData.side === 'ally' ? 0x65caed : 0xf17873;
    cylinder(terrain, 0, .45, 0, 2.4, 2.8, .9, 0x504c43, 48);
    cylinder(terrain, 0, 3.5, 0, .18, .22, 6, color, 16);
    const banner = box(terrain, 1.35, 5.0, 0, 2.7, 2.2, .12, color);
    banner.castShadow = false;
    layout.towers.forEach(item => buildHomeTower(item.x, item.z, color));
    addDirectionLabels(sceneData);
  }
  function buildWildScene(sceneData) {
    cylinder(terrain, 0, -.3, 0, 16.5, 17, .6, 0x455747, 72);
    cylinder(terrain, 0, .02, 0, 16, 16, .12, 0x60715b, 72).castShadow = false;
    // All four wilderness scenes share one straight left–right route and broad walkable green shoulders.
    box(terrain, 0, .09, 0, 36, .14, 5.2, 0x6b6758);
    let seed = sceneData.side === 'ally' ? 314 : 731;
    if (sceneData.lane === 'lower') seed += 97;
    const random = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
    for (const wallSign of [-1, 1]) for (let index = 0; index < 11; index++) {
      const rock = mesh(new T.DodecahedronGeometry(.7 + random() * .8, 0), material(0x6c5946), terrain);
      rock.position.set(-15 + index * 3, .55 + random() * .45, wallSign * 10.6);
      rock.scale.set(1.2 + random() * .7, 1.6 + random() * .9, 1.1 + random() * .45);
      rock.rotation.set(random() * .25, random() * Math.PI, random() * .2);
    }
    addDirectionLabels(sceneData);
  }
  function corridorBranches() {
    const lanes = [
      { x: 16, lane: '下路', screenPosition: '左' },
      { x: 0, lane: '中路', screenPosition: '中' },
      { x: -16, lane: '上路', screenPosition: '右' },
    ];
    return [-1, 1].flatMap(sign => lanes.map(item => ({ ...item, sign })));
  }
  function buildCorridorScene(sceneData) {
    // 「中央河道」是戰場俗稱；此處實際是一條沿 3–9 點方向延伸的石造大道。
    box(terrain, 0, -.3, 0, 37.6, .6, 9, 0x4d5554);
    box(terrain, 0, .02, 0, 37, .14, 8.2, 0x817d70).castShadow = false;
    for (let x = -16; x <= 16; x += 4) box(terrain, x, .105, 0, .08, .035, 8, 0x66645c).castShadow = false;
    for (const branch of corridorBranches()) {
      box(terrain, branch.x, -.22, branch.sign * 10.2, 5.4, .45, 12.5, 0x555b59);
      box(terrain, branch.x, .02, branch.sign * 10.2, 4.8, .14, 12.5, 0x77736a).castShadow = false;
      const sideColor = branch.sign > 0 ? 0xf17873 : 0x65caed;
      cylinder(terrain, branch.x, .22, branch.sign * 16.2, 1.25, 1.45, .42, 0x4f514d, 24);
      cylinder(terrain, branch.x, .8, branch.sign * 16.2, .12, .17, 1.2, sideColor, 10);
    }
    addDirectionLabels(sceneData);
  }
  function rebuildTerrain() {
    clearTerrainLabels();
    world.remove(terrain);
    terrain = new T.Group();
    world.add(terrain);
    const sceneData = sceneById.get(activeSceneId);
    if (sceneData.kind === 'full') return;
    if (sceneData.kind === 'outer') buildOuterScene(sceneData);
    else if (sceneData.kind === 'home') buildHomeScene(sceneData);
    else if (sceneData.kind === 'wild') buildWildScene(sceneData);
    else buildCorridorScene(sceneData);
    $('scene-title').textContent = sceneData.label;
    $('scene-kind').textContent = kindLabels[sceneData.kind];
  }

  const colors = { ally: 0x65caed, enemy: 0xf17873, neutral: 0xe0b653 };
  const pieces = [];
  const pieceObjects = new Map();
  const hitMeshes = [];
  const pieceLabels = [];
  let selectedId = null;
  let renamingId = null;
  let nextId = 1;
  let routeEditor = null;
  const cleanLabel = value => String(value ?? '').replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, 24);
  const routesByScene = new Map(scenes.filter(item => item.kind !== 'full').map(item => [item.id, []]));
  const notesByScene = new Map();
  $('tactical-notes').addEventListener('input', () => notesByScene.set(activeSceneId, $('tactical-notes').value));
  const history = [];
  const clone = value => JSON.parse(JSON.stringify(value));
  function currentState() { return { sceneId: activeSceneId, tacticalNotes: notesByScene.get(activeSceneId) ?? '', pieces: clone(pieces), routes: sceneById.get(activeSceneId)?.kind === 'full' ? [] : routeEditor?.getRoutes() ?? [] }; }
  function remember() {
    history.push(currentState());
    if (history.length > 40) history.shift();
    $('undo').disabled = false;
  }
  function selectedPiece() { return pieces.find(item => item.id === selectedId) ?? null; }
  function pieceTitle(piece) {
    return piece.label || piece.id;
  }
  function makePieceLabel(piece) {
    const element = document.createElement('div');
    element.className = `piece-label ${piece.side === 'enemy' ? 'enemy' : ''} ${piece.kind === 'group' ? 'group' : ''} ${piece.kind === 'marker' ? 'marker' : ''}`;
    const text = document.createElement('span');
    text.textContent = pieceTitle(piece);
    if (piece.kind === 'profession') {
      const icon = document.createElement('i');
      icon.className = 'profession-icon';
      icon.style.setProperty('--profession-index', String(professionById.get(piece.profession).iconIndex));
      element.append(icon);
    }
    element.append(text);
    $('labels').append(element);
    const record = { element, position: new T.Vector3() };
    labels.push(record);
    pieceLabels.push(record);
    return record;
  }
  function addPieceObject(piece) {
    const group = new T.Group();
    world.add(group);
    const color = colors[piece.side];
    const marker = piece.kind === 'marker';
    const size = piece.kind === 'group' ? .88 : marker ? .72 : .62;
    let ring;
    if (marker) {
      box(group, 0, .1, 0, 1.12, .2, 1.12, 0x172b36).rotation.y = Math.PI / 4;
      ring = box(group, 0, .23, 0, 1.28, .08, 1.28, color);
      ring.rotation.y = Math.PI / 4;
      const diamond = mesh(new T.OctahedronGeometry(.67, 0), material(color), group);
      diamond.position.y = 1.08;
      diamond.scale.set(.78, 1.18, .78);
    } else {
      cylinder(group, 0, .1, 0, size, size + .08, .2, 0x172b36, 32);
      ring = mesh(new T.TorusGeometry(size + .02, .08, 8, 32), material(color), group);
      ring.rotation.x = Math.PI / 2;
      ring.position.y = .22;
      const bodyCount = piece.kind === 'group' ? 3 : 1;
      for (let index = 0; index < bodyCount; index++) {
        const x = bodyCount === 3 ? (index - 1) * .5 : 0;
        const body = cylinder(group, x, .78, 0, .22, .34, 1.05, color, 12);
        body.castShadow = true;
        mesh(new T.SphereGeometry(.24, 14, 10), material(color), group).position.set(x, 1.48, 0);
      }
    }
    const hit = mesh(new T.CylinderGeometry(size + .1, size + .1, 2, 12), new T.MeshBasicMaterial({ visible: false }), group);
    hit.position.y = .9;
    hit.userData.pieceId = piece.id;
    hitMeshes.push(hit);
    const y = placementY(piece.x, piece.z);
    group.position.set(piece.x, y, piece.z);
    const label = makePieceLabel(piece);
    label.position.set(piece.x, y + 2.15, piece.z);
    pieceObjects.set(piece.id, { group, ring, label });
  }
  function removePieceObjects() {
    pieceObjects.forEach(object => world.remove(object.group));
    pieceObjects.clear();
    hitMeshes.length = 0;
    for (const record of pieceLabels.splice(0)) {
      record.element.remove();
      const index = labels.indexOf(record);
      if (index >= 0) labels.splice(index, 1);
    }
  }
  // 顯示名稱可直接在清單內改；內部 id 永遠不動，留白就回到 id。
  function renamePiece(id, label) {
    const piece = pieces.find(item => item.id === id);
    if (!piece) return false;
    const next = cleanLabel(label);
    if (piece.label === next) return false;
    remember();
    piece.label = next;
    renderPieces();
    $('status').textContent = `已更名為 ${pieceTitle(piece)}。`;
    return true;
  }
  function nameEditor(piece) {
    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'name-input';
    input.maxLength = 24;
    input.value = piece.label;
    input.placeholder = piece.id;
    input.dataset.nameInput = piece.id;
    input.setAttribute('aria-label', `${pieceTitle(piece)} 顯示名稱`);
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
      if (cancelled || !renamePiece(piece.id, value)) renderPieceList();
    });
    return input;
  }
  function beginRename(id) {
    if (!pieces.some(item => item.id === id)) return false;
    renamingId = id;
    renderPieceList();
    const input = $('piece-list').querySelector(`[data-name-input="${CSS.escape(id)}"]`);
    input?.focus();
    input?.select();
    return true;
  }
  function renderPieceList() {
    $('piece-list').replaceChildren();
    if (!pieces.length) {
      const empty = document.createElement('small');
      empty.textContent = '尚未放置棋子';
      $('piece-list').append(empty);
    }
    for (const piece of pieces) {
      const editing = renamingId === piece.id;
      const row = document.createElement('div');
      row.className = `piece-row ${piece.side === 'enemy' ? 'enemy' : ''} ${piece.kind === 'marker' ? 'marker' : ''} ${editing ? 'editing' : ''}`;
      const remove = document.createElement('button');
      remove.type = 'button';
      remove.className = 'remove';
      remove.textContent = '×';
      remove.title = `刪除 ${pieceTitle(piece)}`;
      remove.onclick = () => deletePiece(piece.id);
      if (editing) {
        row.append(nameEditor(piece), remove);
      } else {
        const select = document.createElement('button');
        select.type = 'button';
        select.dataset.rename = piece.id;
        select.setAttribute('aria-pressed', String(piece.id === selectedId));
        const title = document.createElement('b');
        title.textContent = pieceTitle(piece);
        select.append(title);
        select.title = '點名稱即可編輯';
        select.onclick = () => beginRename(piece.id);
        const rename = document.createElement('button');
        rename.type = 'button';
        rename.className = 'rename-btn';
        rename.dataset.piece = piece.id;
        rename.textContent = '選取';
        rename.title = `選取 ${pieceTitle(piece)}`;
        rename.setAttribute('aria-pressed', String(piece.id === selectedId));
        rename.onclick = () => selectPiece(piece.id);
        row.append(select, rename, remove);
      }
      $('piece-list').append(row);
    }
    $('piece-count').textContent = `${pieces.length} 個項目`;
    $('duplicate').disabled = !selectedPiece();
  }
  function renderPieces() {
    removePieceObjects();
    pieces.forEach(addPieceObject);
    renderPieceList();
    syncSelection();
  }
  function syncSelection() {
    pieceObjects.forEach((object, id) => {
      const piece = pieces.find(item => item.id === id);
      object.label.element.classList.toggle('selected', id === selectedId);
      object.ring.material = material(id === selectedId ? 0xefc979 : colors[piece.side]);
    });
    document.querySelectorAll('[data-piece]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.piece === selectedId)));
    $('duplicate').disabled = !selectedPiece();
  }
  function selectPiece(id) {
    selectedId = pieces.some(item => item.id === id) ? id : null;
    syncSelection();
    const piece = selectedPiece();
    if (piece) $('status').textContent = `已選取 ${pieceTitle(piece)}；可在場景中拖曳。`;
    return Boolean(piece);
  }
  function nextPosition(index = pieces.length) {
    const column = index % 5;
    const row = Math.floor(index / 5) % 3;
    return { x: -6 + column * 3, z: 5 - row * 3 };
  }
  function homePlacement(x, z, sceneData) {
    const layout = homeLayout(sceneData);
    const towardMiddle = z * layout.middleSign;
    const interior = Math.abs(x) < layout.wallX - .6
      && towardMiddle < layout.middleBoundaryDistance - .6
      && towardMiddle > -layout.stairBoundaryDistance + .6;
    const sideRoad = Math.abs(x) >= layout.wallX - .6
      && Math.abs(x) < layout.sideTowerDistance + 7
      && Math.abs(z) < 2.3;
    const middleRoad = Math.abs(x) < 2.3
      && towardMiddle >= layout.middleBoundaryDistance - .6
      && towardMiddle < layout.middleTowerDistance + 4.5;
    const blockedByTower = layout.towers.some(tower => Math.hypot(x - tower.x, z - tower.z) < 1.9);
    return (interior || sideRoad || middleRoad) && Math.hypot(x, z) > 2.5 && !blockedByTower;
  }
  function wildPlacement(x, z) {
    const inGreenClearing = (x / 15.4) ** 2 + (z / 8.8) ** 2 < 1;
    const onConnectingRoad = Math.abs(x) < 20.5 && Math.abs(z) < 2.45;
    return inGreenClearing || onConnectingRoad;
  }
  function corridorPlacement(x, z) {
    const onMainRoad = Math.abs(x) < 18.2 && Math.abs(z) < 3.85;
    const onBranch = corridorBranches().some(branch => Math.abs(x - branch.x) < 2.25 && Math.abs(z) < 16.5);
    const blockedByTowerMarker = corridorBranches().some(branch => Math.hypot(x - branch.x, z - branch.sign * 16.2) < 1.55);
    return (onMainRoad || onBranch) && !blockedByTowerMarker;
  }
  function canPlace(x, z, sceneId = activeSceneId) {
    if (!Number.isFinite(x) || !Number.isFinite(z)) return false;
    const sceneData = sceneById.get(sceneId);
    if (!sceneData) return false;
    if (sceneData.kind === 'outer') {
      const onDisc = Math.hypot(x, z) < 11.4 && Math.hypot(x, z) > 2.25 && !(Math.abs(x) > 9 && Math.abs(z) < 8.5);
      const onRoad = Math.abs(x) < 24 * .55 / 2 - .4 && Math.abs(z) >= 11 && Math.abs(z) <= 22;
      return onDisc || onRoad;
    }
    if (sceneData.kind === 'home') return homePlacement(x, z, sceneData);
    if (sceneData.kind === 'wild') return wildPlacement(x, z);
    return corridorPlacement(x, z);
  }
  function placementY(x, z, sceneId = activeSceneId) {
    const sceneData = sceneById.get(sceneId);
    if (sceneData?.kind !== 'home') return .2;
    const layout = homeLayout(sceneData);
    const towardStairs = z * layout.stairSign;
    if (Math.abs(x) > 4) return .2;
    const stairStart = layout.stairPlatformDistance - 3.2;
    // 與 buildHomeScene 的方塊中心、半深度和高度一致，並保留棋子底座間距 .2。
    if (Math.abs(towardStairs - layout.stairPlatformDistance) <= 1.275) return 1.5;
    for (let step = 2; step >= 0; step--) {
      if (Math.abs(towardStairs - (stairStart + step * 1.05)) <= .55) return .55 + step * .32;
    }
    return .2;
  }
  function safeNextPosition(index) {
    let point = nextPosition(index);
    if (canPlace(point.x, point.z)) return point;
    for (let step = 0; step < 24; step++) {
      const angle = step / 24 * Math.PI * 2;
      point = { x: Math.cos(angle) * 7, z: Math.sin(angle) * 7 };
      if (canPlace(point.x, point.z)) return point;
    }
    return { x: 4, z: 4 };
  }
  function addPiece() {
    if (pieces.length >= 120) {
      $('status').textContent = '單一劇本最多 120 枚棋子。';
      return false;
    }
    remember();
    const point = safeNextPosition(pieces.length);
    const kind = $('piece-kind').value;
    const piece = {
      id: `piece-${nextId++}`,
      side: kind === 'marker' ? 'neutral' : $('piece-side').value,
      kind,
      profession: kind === 'profession' ? $('piece-profession').value : null,
      label: $('piece-label').value.trim(),
      x: point.x,
      z: point.z,
      source: 'manual',
    };
    pieces.push(piece);
    $('piece-label').value = '';
    selectedId = piece.id;
    renderPieces();
    $('status').textContent = `已新增 ${pieceTitle(piece)}。`;
    return true;
  }
  function deletePiece(id) {
    const index = pieces.findIndex(item => item.id === id);
    if (index < 0) return false;
    remember();
    const [piece] = pieces.splice(index, 1);
    if (selectedId === id) selectedId = null;
    renderPieces();
    $('status').textContent = `已刪除 ${pieceTitle(piece)}，可按復原取回。`;
    return true;
  }
  function movePiece(id, x, z) {
    const piece = pieces.find(item => item.id === id);
    if (!piece || !canPlace(x, z)) return false;
    piece.x = Number(x.toFixed(3));
    piece.z = Number(z.toFixed(3));
    const object = pieceObjects.get(id);
    const y = placementY(piece.x, piece.z);
    object.group.position.set(piece.x, y, piece.z);
    object.label.position.set(piece.x, y + 2.15, piece.z);
    return true;
  }
  function duplicateSelected() {
    const original = selectedPiece();
    if (!original || pieces.length >= 120) return false;
    remember();
    const point = canPlace(original.x + 1.4, original.z + 1.4) ? { x: original.x + 1.4, z: original.z + 1.4 } : safeNextPosition(pieces.length);
    const copy = { ...clone(original), id: `piece-${nextId++}`, label: original.label ? `${original.label} 副本` : '', x: point.x, z: point.z };
    pieces.push(copy);
    selectedId = copy.id;
    renderPieces();
    $('status').textContent = `已複製 ${pieceTitle(original)}。`;
    return true;
  }
  function clearPieces() {
    if (!pieces.length) return false;
    remember();
    pieces.splice(0);
    selectedId = null;
    renderPieces();
    $('status').textContent = '棋子已清空，可按復原取回。';
    return true;
  }
  function restoreState(state) {
    activeSceneId = state.sceneId;
    notesByScene.set(activeSceneId, state.tacticalNotes ?? '');
    $('tactical-notes').value = notesByScene.get(activeSceneId);
    $('scene-select').value = activeSceneId;
    const fullMap = sceneById.get(activeSceneId)?.kind === 'full';
    document.body.classList.toggle('full-map', fullMap);
    pieces.splice(0, pieces.length, ...clone(state.pieces));
    nextId = Math.max(1, ...pieces.map(item => Number(item.id.match(/(\d+)$/)?.[1] || 0) + 1));
    selectedId = null;
    if (!fullMap) {
      rebuildTerrain();
      renderPieces();
    }
    routeEditor?.setRoutes(state.routes ?? []);
    if (routeEditor && sceneById.get(activeSceneId).kind !== 'full') routesByScene.set(activeSceneId, routeEditor.getRoutes());
  }
  function undo() {
    const state = history.pop();
    if (!state) return false;
    restoreState(state);
    $('undo').disabled = history.length === 0;
    $('status').textContent = '已復原上一個動作。';
    return true;
  }

  function validateImport(payload) {
    if (payload?.type !== 'justiceol-tactical-scenario' || payload.schemaVersion !== 1) throw new Error('不是支援的自由沙盤檔');
    if (!sceneById.has(payload.sceneId)) throw new Error('場景不存在');
    if (!Array.isArray(payload.pieces) || payload.pieces.length > 120) throw new Error('棋子資料無效');
    const ids = new Set();
    return {
      sceneId: payload.sceneId,
      tacticalNotes: typeof payload.tacticalNotes === 'string' ? payload.tacticalNotes.slice(0, 10000) : '',
      routes: routeEditor.validate(payload.routes ?? [], (x, z) => canPlace(x, z, payload.sceneId)),
      pieces: payload.pieces.map((item, index) => {
        const id = String(item.id || `piece-${index + 1}`);
        const x = Number(item.x), z = Number(item.z);
        const kind = item.kind === 'group' ? 'group' : item.kind === 'marker' ? 'marker' : 'profession';
        const side = kind === 'marker' ? 'neutral' : item.side;
        if (ids.has(id) || (kind !== 'marker' && !['ally', 'enemy'].includes(side)) || (kind === 'profession' && !professionById.has(item.profession))) throw new Error(`第 ${index + 1} 個項目資料無效`);
        if (!canPlace(x, z, payload.sceneId)) throw new Error(`第 ${index + 1} 枚棋子落在目前場景的牆壁、塔身或道路外，請調整位置後再開啟`);
        ids.add(id);
        return { id, side, kind, profession: kind === 'profession' ? item.profession : null, label: String(item.label || '').slice(0, 24), x, z, source: 'manual' };
      }),
    };
  }
  function exportScenario() {
    if (routeEditor.isDrawing()) { $('status').textContent = '請先雙擊完成路線或取消繪製，再另存新檔。'; return; }
    const payload = {
      schemaVersion: 1,
      type: 'justiceol-tactical-scenario',
      sceneId: activeSceneId,
      sceneLabel: sceneById.get(activeSceneId).label,
      tacticalNotes: notesByScene.get(activeSceneId) ?? '',
      coordinateSystem: 'scene center is (0,0); +z is 12 o’clock toward enemy base; -x is 3 o’clock toward upper-lane side; y is up',
      pieces: clone(pieces),
      routes: routeEditor.getRoutes(),
      note: 'Manual tactical scenario; not an observation of the historical match.',
    };
    const url = URL.createObjectURL(new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `沙盤-${activeSceneId}.json`;
    link.click();
    window.UnsavedGuard.saved('local');
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  $('add-piece').onclick = addPiece;
  function syncPieceKind() {
    const kind = $('piece-kind').value;
    const profession = kind === 'profession';
    const marker = kind === 'marker';
    $('piece-profession').disabled = !profession;
    $('profession-field').classList.toggle('is-disabled', !profession);
    $('piece-side').disabled = marker;
    $('side-field').classList.toggle('is-disabled', marker);
    $('label-field-title').textContent = marker ? '標記內容（選填，未填自動編號）' : '棋子 ID（選填，未填自動編號）';
    $('piece-label').placeholder = marker ? '例：集合位置／野怪位置' : '例：飯飯／進攻二隊';
    $('add-piece').textContent = marker ? '＋ 新增標記' : '＋ 新增棋子';
  }
  $('piece-kind').onchange = syncPieceKind;
  $('duplicate').onclick = duplicateSelected;
  $('undo').onclick = undo;
  $('clear').onclick = clearPieces;
  $('export').onclick = exportScenario;
  $('import').onclick = () => $('import-file').click();
  $('import-file').onchange = async event => {
    const file = event.target.files[0];
    event.target.value = '';
    if (!file) return;
    try {
      const state = validateImport(JSON.parse(await file.text()));
      if (!window.UnsavedGuard.confirm()) return;
      remember();
      restoreState(state);
      window.UnsavedGuard.saved('local');
      $('status').textContent = `已開啟舊檔，共 ${pieces.length} 個項目；內容仍標記為手動推演。`;
    } catch (error) {
      $('status').textContent = `開啟失敗，現有內容保持不變：${error.message}`;
    }
  };
  $('scene-select').onchange = () => {
    const next = $('scene-select').value;
    if (!sceneById.has(next) || next === activeSceneId) return;
    if (!window.UnsavedGuard.confirm()) { $('scene-select').value = activeSceneId; return; }
    remember();
    if (sceneById.get(activeSceneId).kind !== 'full') routesByScene.set(activeSceneId, routeEditor.getRoutes());
    activeSceneId = next;
    $('tactical-notes').value = notesByScene.get(activeSceneId) ?? '';
    const fullMap = sceneById.get(activeSceneId).kind === 'full';
    document.body.classList.toggle('full-map', fullMap);
    if (fullMap) {
      $('status').textContent = '已切換至全場戰術圖；使用右側工具配置棋子、標記與路線。';
      return;
    }
    let relocated = 0;
    pieces.forEach((piece, index) => {
      if (!canPlace(piece.x, piece.z)) {
        Object.assign(piece, safeNextPosition(index));
        relocated += 1;
      }
    });
    rebuildTerrain();
    renderPieces();
    routeEditor.setRoutes(routesByScene.get(activeSceneId) ?? []);
    $('status').textContent = relocated
      ? `已切換至 ${sceneById.get(activeSceneId).label}；${relocated} 枚棋子因落在牆壁、塔身或道路外，已移至可放置區。`
      : `已切換至 ${sceneById.get(activeSceneId).label}；原有棋子已保留。`;
  };

  const target = new T.Vector3(0, 0, 0);
  let theta = Math.PI, phi = .68, radius = 48;
  const presets = {
    overview: { theta: Math.PI, phi: .68, radius: 48, target: [0, 0, 0] },
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
    const kind = sceneById.get(activeSceneId)?.kind;
    radius = preset.radius * (kind === 'home' ? 1.2 : kind === 'corridor' ? 1.12 : 1);
    target.set(...preset.target);
    updateCamera();
    return true;
  }
  document.querySelectorAll('[data-camera]').forEach(button => button.onclick = () => setCamera(button.dataset.camera));
  const canvas = $('scene');
  const raycaster = new T.Raycaster();
  const pointer = new T.Vector2();
  const plane = new T.Plane(new T.Vector3(0, 1, 0), -.2);
  function cast(event) {
    const rect = canvas.getBoundingClientRect();
    pointer.set((event.clientX - rect.left) / rect.width * 2 - 1, -(event.clientY - rect.top) / rect.height * 2 + 1);
    raycaster.setFromCamera(pointer, camera);
  }
  // 指標落點要落在真正的地表高度上（家中樓梯會抬高），否則斜角視角下拖曳與畫面會偏移。
  function groundPoint(event) {
    cast(event);
    // 樓梯高度是離散的：疊代猜高度在邊緣可能來回跳，改取最近的有效水平面交點。
    let point = null;
    for (const height of [.2, .55, .87, 1.19, 1.5]) {
      plane.constant = -height;
      const hit = raycaster.ray.intersectPlane(plane, new T.Vector3());
      if (!hit || Math.abs(placementY(hit.x, hit.z) - height) >= .001) continue;
      if (!point || hit.distanceToSquared(raycaster.ray.origin) < point.distanceToSquared(raycaster.ray.origin)) point = hit;
    }
    plane.constant = -.2;
    return point;
  }
  routeEditor = window.createRouteEditor3D({
    THREE: T,
    parent: world,
    canvas,
    raycaster,
    cast,
    groundPoint,
    canPlace: (x, z) => canPlace(x, z),
    heightAt: (x, z) => placementY(x, z),
    color: () => $('route-color').value,
    colorSelect: $('route-color'),
    label: () => $('piece-label').value,
    list: $('route-list'),
    startButton: $('route-start'),
    cancelButton: $('route-cancel'),
    deleteButton: $('route-delete'),
    undoButton: $('route-undo'),
    addPointButton: $('route-add-node'),
    removePointButton: $('route-remove-node'),
    isEnabled: () => sceneById.get(activeSceneId)?.kind !== 'full',
    onStatus: text => { $('status').textContent = text; },
    onMode: drawing => $('stage').classList.toggle('drawing-route', drawing),
    onChange: routes => {
      if (sceneById.get(activeSceneId)?.kind !== 'full') routesByScene.set(activeSceneId, routes);
    },
  });
  let gesture = null;
  canvas.addEventListener('pointerdown', event => {
    if (gesture) return;
    cast(event);
    const hit = raycaster.intersectObjects(hitMeshes)[0];
    const pieceId = hit?.object.userData.pieceId;
    if (pieceId) {
      selectPiece(pieceId);
      remember();
    }
    gesture = { id: event.pointerId, x: event.clientX, y: event.clientY, pieceId, pan: event.button === 2 || event.shiftKey };
    canvas.setPointerCapture(event.pointerId);
  });
  canvas.addEventListener('pointermove', event => {
    if (!gesture || gesture.id !== event.pointerId) return;
    const dx = event.clientX - gesture.x;
    const dy = event.clientY - gesture.y;
    if (gesture.pieceId) {
      const point = groundPoint(event);
      if (point) movePiece(gesture.pieceId, point.x, point.z);
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
  document.addEventListener('keydown', event => {
    if (event.target.matches?.('input,select,textarea')) return;
    if (event.key === 'Delete') deletePiece(selectedId);
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z') { event.preventDefault(); undo(); }
  });

  function resize() {
    const rect = $('stage').getBoundingClientRect();
    renderer.setSize(rect.width, rect.height, false);
    camera.aspect = rect.width / rect.height;
    camera.updateProjectionMatrix();
  }
  new ResizeObserver(resize).observe($('stage'));
  function render() {
    renderer.render(world, camera);
    const rect = canvas.getBoundingClientRect();
    labels.forEach(item => {
      const point = item.position.clone().project(camera);
      item.element.style.display = point.z > 1 || point.z < -1 ? 'none' : '';
      item.element.style.left = `${Math.max(42, Math.min(rect.width - 42, (point.x * .5 + .5) * rect.width))}px`;
      item.element.style.top = `${(-point.y * .5 + .5) * rect.height}px`;
    });
    requestAnimationFrame(render);
  }

  $('scene-select').value = activeSceneId;
  $('piece-kind').value = 'profession';
  $('piece-profession').value = 'suwen';
  syncPieceKind();
  $('undo').disabled = true;
  rebuildTerrain();
  renderPieces();
  setCamera('overview');
  resize();
  render();

  window.scenarioEditor = {
    ready: true,
    professions: clone(professions),
    scenes: clone(scenes),
    directions: { twelve: '+z toward enemy', six: '-z toward ally', three: '-x upper-lane side', nine: '+x lower-lane side' },
    get sceneId() { return activeSceneId; },
    get selectedId() { return selectedId; },
    getPieces: () => clone(pieces),
    addPiece,
    deletePiece,
    renamePiece,
    beginRename,
    get renamingId() { return renamingId; },
    movePiece,
    canPlace,
    placementY,
    groundPoint: (clientX, clientY) => {
      const point = groundPoint({ clientX, clientY });
      return point ? { x: point.x, y: point.y, z: point.z } : null;
    },
    selectPiece,
    duplicateSelected,
    routeEditor,
    getRoutes: () => routeEditor.getRoutes(),
    projectPoint(x, z) {
      const point = new T.Vector3(x, placementY(x, z) + .35, z).project(camera);
      const rect = canvas.getBoundingClientRect();
      return { x: rect.left + (point.x * .5 + .5) * rect.width, y: rect.top + (-point.y * .5 + .5) * rect.height };
    },
    clearPieces,
    undo,
    setCamera,
    setScene(sceneId) {
      if (!sceneById.has(sceneId)) return false;
      $('scene-select').value = sceneId;
      $('scene-select').dispatchEvent(new Event('change'));
      return true;
    },
  };
  window.UnsavedGuard.track('local', () => ({ pieces, routes: routeEditor.getRoutes(), notes: notesByScene.get(activeSceneId) ?? '', draft: routeEditor.draftPoints }));
})();
