const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert');

function loadBattleReviewRules() {
  const htmlPath = path.join(__dirname, '..', 'battle_review.html');
  const html = fs.readFileSync(htmlPath, 'utf8');
  const start = html.indexOf('const STORAGE_KEY =');
  const end = html.indexOf('function aggregatePlayers(');
  if (start < 0 || end < 0 || end <= start) {
    throw new Error('找不到 battle_review.html 內的規則區段，測試無法載入。');
  }

  const source = html.slice(start, end);
  const context = {
    console,
    Math,
    Number,
    String,
    Boolean,
    Array,
    Object,
    JSON,
    Set,
    Map,
    Date,
    RegExp,
    localStorage: {
      getItem() { return null; },
      setItem() {},
      removeItem() {},
    },
    document: {
      querySelector() { return null; },
      querySelectorAll() { return []; },
      getElementById() { return null; },
      createElement() {
        return {
          click() {},
          remove() {},
          style: {},
        };
      },
      body: {
        appendChild() {},
      },
    },
    Blob: function Blob() {},
    URL: {
      createObjectURL() { return 'blob:mock'; },
      revokeObjectURL() {},
    },
  };
  vm.createContext(context);
  vm.runInContext(source, context, { filename: 'battle_review_rules.js' });
  vm.runInContext('state = { battles: [], activeBattleId: "", importDraft: {}, aliasMap: {}, settings: { weakPct: 30, deathPct: 30 } };', context);
  return context;
}

function loadBattleReviewHtml() {
  return fs.readFileSync(path.join(__dirname, '..', 'battle_review.html'), 'utf8');
}

function loadBattleReviewFullContext() {
  const htmlPath = path.join(__dirname, '..', 'battle_review.html');
  const html = fs.readFileSync(htmlPath, 'utf8');
  const start = html.indexOf('const STORAGE_KEY =');
  const end = html.lastIndexOf('</script>');
  if (start < 0 || end < 0 || end <= start) {
    throw new Error('找不到 battle_review.html 內的完整腳本區段，測試無法載入。');
  }

  const source = html.slice(start, end);
  const elements = new Map();
  function makeEl(id = '') {
    return {
      id,
      innerHTML: '',
      textContent: '',
      value: '',
      checked: false,
      disabled: false,
      style: {},
      dataset: {},
      className: '',
      options: [],
      children: [],
      classList: {
        add() {},
        remove() {},
        toggle() {},
        contains() { return false; },
      },
      addEventListener() {},
      appendChild(child) {
        this.children.push(child);
        this.options.push(child);
        return child;
      },
      remove() {},
      click() {},
      querySelector() { return makeEl(); },
      querySelectorAll() { return []; },
      setAttribute() {},
      removeAttribute() {},
      closest() { return null; },
    };
  }

  const requiredIds = [
    'matchup_weak_pct', 'matchup_strong_pct', 'matchup_roster_bottom_pct',
    'single_battle_matchup_box', 'current_battle_select', 'battle_summary', 'screening_grid',
    'commander_list', 'unknown_group_list', 'priority_list', 'secondary_list', 'observation_list',
    'priority_meta', 'secondary_meta', 'observation_meta', 'battle_manual_note',
    'player_battle_select', 'profession_battle_select', 'opponent_focus_select',
    'opponent_focus_cards', 'team_focus_cards', 'opponent_top_build', 'opponent_top_pvp',
    'opponent_top_kill', 'opponent_top_iron', 'opponent_top_healer', 'team_top_build',
    'team_top_pvp', 'team_top_kill', 'team_top_iron', 'team_top_healer',
    'profession_min_battles',
    'btn_export_profession_pdf', 'btn_export_focus_pdf', 'btn_group_defense', 'btn_group_bodyguard',
    'btn_auto_infer_assignments', 'btn_reset_all_assignments',
    'btn_select_all_players', 'btn_clear_all_players', 'btn_apply_roles_to_current',
    'btn_add_battle', 'btn_import_snapshot', 'btn_export_snapshot', 'profession_group_filter',
    'player_group_filter', 'btn_player_select_all', 'btn_player_select_none',
    'btn_player_delete_checked', 'btn_prof_select_all', 'btn_prof_select_none',
    'btn_prof_delete_checked', 'btn_delete_current_battle', 'import_section', 'import_result',
    'player_opponent_filter', 'profession_opponent_filter',
    'player_date_from_filter', 'player_date_to_filter',
    'profession_date_from_filter', 'profession_date_to_filter',
    'import_date', 'import_opponent', 'import_team_name', 'import_note', 'import_note_box',
    'csv_file', 'role_csv_file', 'btn_parse_csv', 'btn_parse_role_csv', 'import_auto_assign_without_roles',
    'role_import_controls',
  ];
  requiredIds.forEach((id) => elements.set(id, makeEl(id)));
  elements.get('matchup_weak_pct').value = '10';
  elements.get('matchup_strong_pct').value = '10';
  elements.get('matchup_roster_bottom_pct').value = '20';
  elements.get('profession_min_battles').value = '3';
  elements.get('profession_group_filter').value = 'all';
  elements.get('player_group_filter').value = 'all';
  elements.get('player_opponent_filter').value = 'all';
  elements.get('profession_opponent_filter').value = 'all';
  elements.get('player_date_from_filter').value = '';
  elements.get('player_date_to_filter').value = '';
  elements.get('profession_date_from_filter').value = '';
  elements.get('profession_date_to_filter').value = '';

  const document = {
    getElementById(id) {
      if (!elements.has(id)) elements.set(id, makeEl(id));
      return elements.get(id);
    },
    querySelector() { return makeEl(); },
    querySelectorAll() { return []; },
    createElement(tag) {
      const el = makeEl(tag);
      el.tagName = String(tag || '').toUpperCase();
      return el;
    },
    body: {
      appendChild() {},
      classList: { add() {}, remove() {} },
    },
  };

  const windowObj = {
    alert() {},
    confirm() { return true; },
    print() {},
    open() { return null; },
    addEventListener() {},
    removeEventListener() {},
    location: {
      href: 'https://example.test/desktop/',
      pathname: '/desktop/',
      search: '',
      hash: '',
    },
  };
  function URLShim(input, base) {
    return new URL(input, base);
  }
  URLShim.createObjectURL = function createObjectURL() { return 'blob:mock'; };
  URLShim.revokeObjectURL = function revokeObjectURL() {};

  const context = {
    console,
    Math,
    Number,
    String,
    Boolean,
    Array,
    Object,
    JSON,
    Set,
    Map,
    Date,
    RegExp,
    localStorage: {
      getItem() { return null; },
      setItem() {},
      removeItem() {},
    },
    document,
    window: windowObj,
    Blob: function Blob() {},
    URL: URLShim,
    setTimeout() { return 0; },
    clearTimeout() {},
    requestAnimationFrame() { return 0; },
    cancelAnimationFrame() {},
  };
  windowObj.document = document;
  vm.createContext(context);
  vm.runInContext(source, context, { filename: 'battle_review_full.js' });
  return { context, elements };
}

function basePlayer(overrides = {}) {
  return {
    name: '未命名',
    job: '碎夢',
    kill: 0,
    assist: 0,
    resource: 0,
    pvpDamage: 1000000,
    buildDamage: 1000000,
    heal: 0,
    takenDamage: 100000,
    death: 1,
    saveCount: 0,
    burnCount: 0,
    groupType: 'attack',
    subgroup: '',
    specialRoles: [],
    ...overrides,
  };
}

function buildBattle(players) {
  return {
    id: 'test_battle',
    date: '2026-04-20',
    opponent: '測試對手',
    result: 'loss',
    players,
  };
}

function loadExportBattles(filename = 'battle_review_export_2026-04-18.json') {
  const exportPath = path.join(__dirname, '..', filename);
  const data = JSON.parse(fs.readFileSync(exportPath, 'utf8'));
  return Array.isArray(data?.state?.battles) ? data.state.battles : [];
}

function fillerAttackers(count, prefix = '填充') {
  return Array.from({ length: count }, (_, index) => basePlayer({
    name: `${prefix}${index + 1}`,
    job: '碎夢',
    buildDamage: 9000000 - index * 200000,
    pvpDamage: 2000000 + index * 100000,
    assist: 20 + index,
    death: 1 + (index % 2),
  }));
}

function fillerAttackersLow(count, prefix = '低輸出填充') {
  return Array.from({ length: count }, (_, index) => basePlayer({
    name: `${prefix}${index + 1}`,
    job: '碎夢',
    buildDamage: 4200000 - index * 150000,
    pvpDamage: 1500000 - index * 50000,
    assist: 12 - Math.floor(index / 2),
    death: 2 + (index % 2),
  }));
}

function fillerDefenders(count, prefix = '守方') {
  return Array.from({ length: count }, (_, index) => basePlayer({
    name: `${prefix}${index + 1}`,
    groupType: 'defense',
    job: '碎夢',
    buildDamage: 1000000 + index * 50000,
    pvpDamage: 4500000 - index * 120000,
    kill: 14 - Math.floor(index / 2),
    assist: 25 - index,
    death: 1 + (index % 2),
  }));
}

function findSummary(review, name) {
  const summary = review.summaries.find(player => player.name === name);
  if (!summary) throw new Error(`找不到玩家 ${name} 的覆盤結果`);
  return summary;
}

function runCase(name, fn) {
  try {
    const result = fn();
    if (result && typeof result.then === 'function') {
      return result
        .then(() => {
          console.log(`PASS ${name}`);
        })
        .catch((error) => {
          console.error(`FAIL ${name}`);
          console.error(error.message);
          process.exitCode = 1;
        });
    }
    console.log(`PASS ${name}`);
  } catch (error) {
    console.error(`FAIL ${name}`);
    console.error(error.message);
    process.exitCode = 1;
  }
}

const rules = loadBattleReviewRules();
const { computeBattleReview } = rules;
const battleReviewHtml = loadBattleReviewHtml();

const asyncCases = [];
function queueCase(name, fn) {
  const result = runCase(name, fn);
  if (result && typeof result.then === 'function') asyncCases.push(result);
}

queueCase('素問雙弱會進歡迎找幹部覆盤', () => {
  const battle = buildBattle([
    basePlayer({ name: '奶弱雙', job: '素問', heal: 1200000, takenDamage: 1100000, saveCount: 1, death: 1, buildDamage: 0 }),
    basePlayer({ name: '奶A', job: '素問', heal: 5000000, takenDamage: 1000000, saveCount: 10, death: 1 }),
    basePlayer({ name: '奶B', job: '素問', heal: 4500000, takenDamage: 1200000, saveCount: 8, death: 2 }),
    basePlayer({ name: '奶C', job: '素問', heal: 3500000, takenDamage: 900000, saveCount: 5, death: 2 }),
    ...fillerAttackers(8),
  ]);
  const review = computeBattleReview(battle);
  assert.strictEqual(findSummary(review, '奶弱雙').level, 'secondary');
});

queueCase('素問雙弱加高重傷會進優先找幹部覆盤', () => {
  const battle = buildBattle([
    basePlayer({ name: '奶雙高死', job: '素問', heal: 1200000, takenDamage: 1100000, saveCount: 1, death: 8, buildDamage: 0 }),
    basePlayer({ name: '奶A', job: '素問', heal: 5000000, takenDamage: 1000000, saveCount: 10, death: 1 }),
    basePlayer({ name: '奶B', job: '素問', heal: 4500000, takenDamage: 1200000, saveCount: 8, death: 2 }),
    basePlayer({ name: '奶C', job: '素問', heal: 3500000, takenDamage: 900000, saveCount: 5, death: 2 }),
    ...fillerAttackers(8),
  ]);
  const review = computeBattleReview(battle);
  assert.strictEqual(findSummary(review, '奶雙高死').level, 'priority');
});

queueCase('素問單弱加高重傷會進歡迎找幹部覆盤', () => {
  const battle = buildBattle([
    basePlayer({ name: '奶單弱高死', job: '素問', heal: 4200000, takenDamage: 1100000, saveCount: 1, death: 8, buildDamage: 0 }),
    basePlayer({ name: '奶A', job: '素問', heal: 5000000, takenDamage: 1000000, saveCount: 10, death: 1 }),
    basePlayer({ name: '奶B', job: '素問', heal: 4500000, takenDamage: 1200000, saveCount: 8, death: 2 }),
    basePlayer({ name: '奶C', job: '素問', heal: 2000000, takenDamage: 1800000, saveCount: 5, death: 2 }),
    basePlayer({ name: '奶D', job: '素問', heal: 1800000, takenDamage: 1700000, saveCount: 3, death: 2 }),
    ...fillerAttackers(8),
  ]);
  const review = computeBattleReview(battle);
  const summary = findSummary(review, '奶單弱高死');
  assert.strictEqual(summary.level, 'secondary');
  assert(summary.hits.some(hit => hit.includes('化羽後')));
  assert(!summary.hits.some(hit => hit.includes('淨奶量後')));
});

queueCase('素問化羽分組第一時直接保護排除', () => {
  const battle = buildBattle([
    basePlayer({ name: '奶化羽第一', job: '素問', heal: 2600000, takenDamage: 2500000, saveCount: 12, death: 8, buildDamage: 0 }),
    basePlayer({ name: '奶A', job: '素問', heal: 5000000, takenDamage: 1000000, saveCount: 10, death: 1 }),
    basePlayer({ name: '奶B', job: '素問', heal: 4500000, takenDamage: 1200000, saveCount: 8, death: 2 }),
    basePlayer({ name: '奶C', job: '素問', heal: 3500000, takenDamage: 900000, saveCount: 5, death: 2 }),
    ...fillerAttackers(8),
  ]);
  const review = computeBattleReview(battle);
  assert.strictEqual(findSummary(review, '奶化羽第一').level, '');
});

queueCase('素問淨奶分組第一時直接保護排除', () => {
  const battle = buildBattle([
    basePlayer({ name: '奶淨奶第一', job: '素問', heal: 5200000, takenDamage: 200000, saveCount: 1, death: 8, buildDamage: 0 }),
    basePlayer({ name: '奶A', job: '素問', heal: 5000000, takenDamage: 1000000, saveCount: 10, death: 1 }),
    basePlayer({ name: '奶B', job: '素問', heal: 4500000, takenDamage: 1200000, saveCount: 8, death: 2 }),
    basePlayer({ name: '奶C', job: '素問', heal: 3500000, takenDamage: 900000, saveCount: 5, death: 2 }),
    ...fillerAttackers(8),
  ]);
  const review = computeBattleReview(battle);
  assert.strictEqual(findSummary(review, '奶淨奶第一').level, '');
});

queueCase('指揮不進自動名單', () => {
  const battle = buildBattle([
    basePlayer({ name: '指揮官', specialRoles: ['commander'], buildDamage: 100000, death: 9 }),
    basePlayer({ name: '打手A', buildDamage: 5000000, death: 1 }),
    basePlayer({ name: '打手B', buildDamage: 4800000, death: 2 }),
    basePlayer({ name: '打手C', buildDamage: 4200000, death: 2 }),
  ]);
  const review = computeBattleReview(battle);
  assert.strictEqual(findSummary(review, '指揮官').level, '');
});

queueCase('未定分工不進自動名單', () => {
  const battle = buildBattle([
    basePlayer({ name: '未定玩家', groupType: 'unknown', buildDamage: 100000, death: 9 }),
    basePlayer({ name: '打手A', buildDamage: 5000000, death: 1 }),
    basePlayer({ name: '打手B', buildDamage: 4800000, death: 2 }),
    basePlayer({ name: '打手C', buildDamage: 4200000, death: 2 }),
  ]);
  const review = computeBattleReview(battle);
  assert.strictEqual(findSummary(review, '未定玩家').level, '');
});

queueCase('特殊職責 lag 不進自動名單', () => {
  const battle = buildBattle([
    basePlayer({ name: '延遲玩家', specialRoles: ['lag'], buildDamage: 100000, death: 9 }),
    basePlayer({ name: '打手A', buildDamage: 5000000, death: 1 }),
    basePlayer({ name: '打手B', buildDamage: 4800000, death: 2 }),
    basePlayer({ name: '打手C', buildDamage: 4200000, death: 2 }),
  ]);
  const review = computeBattleReview(battle);
  assert.strictEqual(findSummary(review, '延遲玩家').level, '');
});

queueCase('一般DPS單弱加高重傷仍會進名單', () => {
  const battle = buildBattle([
    basePlayer({ name: '打手高死', job: '碎夢', buildDamage: 100000, pvpDamage: 5000000, assist: 100, death: 8 }),
    ...fillerAttackers(10, '打手'),
  ]);
  const review = computeBattleReview(battle);
  assert.strictEqual(findSummary(review, '打手高死').level, 'priority');
});

queueCase('通用保護規則命中時不進自動名單', () => {
  const battle = buildBattle([
    basePlayer({ name: '高擊殺保護', job: '碎夢', buildDamage: 100000, kill: 12, death: 3 }),
    basePlayer({ name: '打手A', job: '碎夢', buildDamage: 5000000, death: 1 }),
    basePlayer({ name: '打手B', job: '碎夢', buildDamage: 4800000, death: 2 }),
    basePlayer({ name: '打手C', job: '碎夢', buildDamage: 4200000, death: 2 }),
  ]);
  const review = computeBattleReview(battle);
  assert.strictEqual(findSummary(review, '高擊殺保護').level, '');
});

queueCase('進攻鐵衣主責與坦度都弱時會進歡迎找幹部覆盤', () => {
  const battle = buildBattle([
    basePlayer({ name: '鐵衣待查', job: '鐵衣', buildDamage: 0, takenDamage: 100000, death: 1, groupType: 'attack' }),
    ...fillerAttackers(12),
  ]);
  const review = computeBattleReview(battle);
  assert.strictEqual(findSummary(review, '鐵衣待查').level, 'secondary');
});

queueCase('進攻鐵衣主責與坦度都弱再加高重傷會進優先找幹部覆盤', () => {
  const battle = buildBattle([
    basePlayer({ name: '鐵衣高死', job: '鐵衣', buildDamage: 0, takenDamage: 100000, death: 9, groupType: 'attack' }),
    ...fillerAttackers(12),
  ]);
  const review = computeBattleReview(battle);
  assert.strictEqual(findSummary(review, '鐵衣高死').level, 'priority');
});

queueCase('九靈主責普通但焚骨偏弱時會進系統難以判定', () => {
  const battle = buildBattle([
    basePlayer({ name: '九靈待觀察', job: '九靈', buildDamage: 5000000, pvpDamage: 2000000, burnCount: 0, death: 2 }),
    basePlayer({ name: '九靈A', job: '九靈', buildDamage: 4500000, pvpDamage: 1800000, burnCount: 10, death: 1 }),
    basePlayer({ name: '九靈B', job: '九靈', buildDamage: 4000000, pvpDamage: 1700000, burnCount: 8, death: 2 }),
    basePlayer({ name: '九靈C', job: '九靈', buildDamage: 3500000, pvpDamage: 1500000, burnCount: 6, death: 2 }),
    basePlayer({ name: '九靈D', job: '九靈', buildDamage: 3000000, pvpDamage: 1300000, burnCount: 4, death: 2 }),
    ...fillerAttackers(10, '九靈高輸出'),
    ...fillerAttackersLow(5, '九靈低輸出'),
  ]);
  const review = computeBattleReview(battle);
  assert.strictEqual(findSummary(review, '九靈待觀察').level, 'observation');
});

queueCase('防守DPS單弱加高重傷但副指標不差時只進系統難以判定', () => {
  const battle = buildBattle([
    basePlayer({ name: '守方觀察', groupType: 'defense', job: '碎夢', pvpDamage: 500000, kill: 12, assist: 24, death: 8, buildDamage: 300000 }),
    ...fillerDefenders(10),
    ...fillerAttackers(4),
  ]);
  const review = computeBattleReview(battle);
  assert.strictEqual(findSummary(review, '守方觀察').level, 'observation');
});

queueCase('保鑣素問淨奶分組第一時也會被保護排除', () => {
  const battle = buildBattle([
    basePlayer({ name: '保鑣奶保護', groupType: 'bodyguard', job: '素問', heal: 4800000, takenDamage: 200000, saveCount: 1, death: 8, buildDamage: 0 }),
    basePlayer({ name: '進攻奶A', groupType: 'attack', job: '素問', heal: 5000000, takenDamage: 1000000, saveCount: 10, death: 1 }),
    basePlayer({ name: '進攻奶B', groupType: 'attack', job: '素問', heal: 4200000, takenDamage: 1100000, saveCount: 8, death: 2 }),
    basePlayer({ name: '保鑣奶B', groupType: 'bodyguard', job: '素問', heal: 2600000, takenDamage: 1500000, saveCount: 6, death: 2 }),
    ...fillerAttackers(8),
  ]);
  const review = computeBattleReview(battle);
  assert.strictEqual(findSummary(review, '保鑣奶保護').level, '');
});

queueCase('非坦鐵衣若先命中主邏輯，會維持待查名單不被 observation 覆蓋', () => {
  const battle = buildBattle([
    basePlayer({ name: '鐵衣觀察', job: '鐵衣', groupType: 'attack', buildDamage: 3600000, pvpDamage: 1800000, kill: 4, assist: 18, takenDamage: 20000000, death: 2 }),
    basePlayer({ name: '鐵衣A', job: '鐵衣', groupType: 'attack', buildDamage: 4500000, pvpDamage: 1500000, kill: 3, assist: 16, takenDamage: 8000000, death: 2 }),
    basePlayer({ name: '鐵衣B', job: '鐵衣', groupType: 'attack', buildDamage: 4200000, pvpDamage: 1400000, kill: 3, assist: 15, takenDamage: 7000000, death: 2 }),
    basePlayer({ name: '鐵衣C', job: '鐵衣', groupType: 'attack', buildDamage: 4000000, pvpDamage: 1300000, kill: 2, assist: 14, takenDamage: 6000000, death: 2 }),
    ...fillerAttackers(12, '鐵衣觀察填充'),
    ...fillerAttackersLow(8, '鐵衣觀察低輸出'),
  ]);
  const review = computeBattleReview(battle);
  assert.strictEqual(findSummary(review, '鐵衣觀察').level, 'secondary');
});

queueCase('保鑣DPS 單弱加高重傷但副指標不差時會進系統難以判定', () => {
  const battle = buildBattle([
    basePlayer({ name: '保鑣打手', groupType: 'bodyguard', job: '碎夢', buildDamage: 0, pvpDamage: 4500000, assist: 80, kill: 0, death: 8 }),
    ...fillerDefenders(8, '守保母體'),
    ...fillerAttackers(5, '進攻補位'),
  ]);
  const review = computeBattleReview(battle);
  const summary = findSummary(review, '保鑣打手');
  assert.strictEqual(summary.level, 'observation');
  assert(summary.hits.some(hit => hit.includes('擊殺後')));
});

queueCase('素問雙主責都弱時會優先走待查邏輯，不會落到 observation', () => {
  const battle = buildBattle([
    basePlayer({ name: '奶觀察', job: '素問', heal: 2600000, takenDamage: 1800000, saveCount: 3, death: 2, buildDamage: 0 }),
    basePlayer({ name: '奶A', job: '素問', heal: 5200000, takenDamage: 1200000, saveCount: 10, death: 1 }),
    basePlayer({ name: '奶B', job: '素問', heal: 4800000, takenDamage: 1500000, saveCount: 8, death: 2 }),
    basePlayer({ name: '奶C', job: '素問', heal: 4400000, takenDamage: 1700000, saveCount: 7, death: 2 }),
    basePlayer({ name: '奶D', job: '素問', heal: 3000000, takenDamage: 2100000, saveCount: 4, death: 2 }),
    ...fillerAttackers(8, '奶觀察填充'),
  ]);
  const review = computeBattleReview(battle);
  const summary = findSummary(review, '奶觀察');
  assert.strictEqual(summary.level, 'priority');
  assert(summary.hits.some(hit => hit.includes('化羽後')));
  assert(summary.hits.some(hit => hit.includes('淨奶量後')));
});

queueCase('防守素問分組第一保護只看防守側，不吃進攻側數據', () => {
  const battle = buildBattle([
    basePlayer({ name: '防守奶保護', groupType: 'defense', job: '素問', heal: 3000000, takenDamage: 200000, saveCount: 2, death: 6, buildDamage: 0 }),
    basePlayer({ name: '防守奶A', groupType: 'defense', job: '素問', heal: 2600000, takenDamage: 900000, saveCount: 8, death: 2, buildDamage: 0 }),
    basePlayer({ name: '防守奶B', groupType: 'defense', job: '素問', heal: 2500000, takenDamage: 1000000, saveCount: 6, death: 2, buildDamage: 0 }),
    basePlayer({ name: '進攻奶超高', groupType: 'attack', job: '素問', heal: 8000000, takenDamage: 1000000, saveCount: 20, death: 1, buildDamage: 0 }),
    ...fillerDefenders(8, '防守奶填充'),
  ]);
  const review = computeBattleReview(battle);
  assert.strictEqual(findSummary(review, '防守奶保護').level, '');
});

queueCase('保鑣素問若不是分組第一且雙弱加高重傷，理應進待查名單', () => {
  const battle = buildBattle([
    basePlayer({ name: '保鑣奶待查', groupType: 'bodyguard', job: '素問', heal: 2200000, takenDamage: 1800000, saveCount: 1, death: 8, buildDamage: 0 }),
    basePlayer({ name: '進攻奶A', groupType: 'attack', job: '素問', heal: 5000000, takenDamage: 1000000, saveCount: 10, death: 1, buildDamage: 0 }),
    basePlayer({ name: '進攻奶B', groupType: 'attack', job: '素問', heal: 4600000, takenDamage: 1100000, saveCount: 8, death: 2, buildDamage: 0 }),
    basePlayer({ name: '保鑣奶A', groupType: 'bodyguard', job: '素問', heal: 3500000, takenDamage: 1000000, saveCount: 6, death: 2, buildDamage: 0 }),
    ...fillerAttackers(12, '保鑣奶填充'),
  ]);
  const review = computeBattleReview(battle);
  assert.strictEqual(findSummary(review, '保鑣奶待查').level, 'priority');
});

queueCase('保鑣DPS 單弱加高重傷且副指標也差時會升到待查名單', () => {
  const battle = buildBattle([
    basePlayer({ name: '保鑣打手待查', groupType: 'bodyguard', job: '碎夢', buildDamage: 0, pvpDamage: 400000, assist: 3, kill: 1, death: 8 }),
    ...fillerDefenders(10, '守保待查母體'),
    ...fillerAttackers(4, '進攻補位待查'),
  ]);
  const review = computeBattleReview(battle);
  const summary = findSummary(review, '保鑣打手待查');
  assert.strictEqual(summary.level, 'priority');
  assert(summary.hits.some(hit => hit.includes('擊殺後')));
});

queueCase('保鑣DPS 雙弱且主責落到最底時即使未進高重傷也會進優先找幹部覆盤', () => {
  const battle = buildBattle([
    basePlayer({ name: '保鑣打手次待查', groupType: 'bodyguard', job: '碎夢', buildDamage: 0, pvpDamage: 350000, assist: 2, kill: 1, death: 0 }),
    ...fillerDefenders(10, '守保次待查母體'),
    ...fillerAttackers(4, '進攻補位次待查'),
  ]);
  const review = computeBattleReview(battle);
  const summary = findSummary(review, '保鑣打手次待查');
  assert.strictEqual(summary.level, 'priority');
  assert(summary.hits.some(hit => hit.includes('擊殺後')));
  assert(!summary.hits.some(hit => hit.includes('重傷前')));
});

queueCase('保鑣素問雙弱判定只看進攻保鑣側，不吃防守側化羽資料', () => {
  const battle = buildBattle([
    basePlayer({ name: '保鑣奶觀察', groupType: 'bodyguard', job: '素問', heal: 1800000, takenDamage: 1200000, saveCount: 1, death: 0, buildDamage: 0 }),
    basePlayer({ name: '保鑣奶A', groupType: 'bodyguard', job: '素問', heal: 3200000, takenDamage: 1000000, saveCount: 8, death: 2, buildDamage: 0 }),
    basePlayer({ name: '進攻奶A', groupType: 'attack', job: '素問', heal: 4200000, takenDamage: 900000, saveCount: 10, death: 1, buildDamage: 0 }),
    basePlayer({ name: '進攻奶B', groupType: 'attack', job: '素問', heal: 3900000, takenDamage: 1100000, saveCount: 9, death: 2, buildDamage: 0 }),
    basePlayer({ name: '防守奶超高', groupType: 'defense', job: '素問', heal: 9000000, takenDamage: 800000, saveCount: 30, death: 1, buildDamage: 0 }),
    basePlayer({ name: '防守奶A', groupType: 'defense', job: '素問', heal: 5000000, takenDamage: 1000000, saveCount: 12, death: 2, buildDamage: 0 }),
    ...fillerDefenders(8, '保鑣奶觀察防守填充'),
    ...fillerAttackers(8, '保鑣奶觀察進攻填充'),
  ]);
  const review = computeBattleReview(battle);
  const summary = findSummary(review, '保鑣奶觀察');
  assert.strictEqual(summary.level, 'secondary');
  assert(summary.hits.some(hit => hit.includes('化羽後')));
  assert(summary.hits.some(hit => hit.includes('淨奶量後')));
  assert(!summary.hits.some(hit => hit.includes('防守團素問')));
  assert(!summary.hits.some(hit => hit.includes('重傷前')));
});

queueCase('真資料冒煙測試：匯出檔三場都能正常跑出覆盤結果', () => {
  const battles = loadExportBattles();
  assert.strictEqual(battles.length, 3);
  battles.forEach((battle) => {
    const review = computeBattleReview(battle);
    assert(review);
    assert(Array.isArray(review.summaries));
    assert(review.summaries.length > 0);
  });
});

queueCase('真資料冒煙測試：2026-04-18 那場的名單數量維持目前結果', () => {
  const battles = loadExportBattles();
  const battle = battles.find(item => item.date === '2026-04-18');
  assert(battle);
  const review = computeBattleReview(battle);
  const priority = review.summaries.filter(player => player.level === 'priority').map(player => player.name);
  const secondary = review.summaries.filter(player => player.level === 'secondary').map(player => player.name);
  const observation = review.summaries.filter(player => player.level === 'observation').map(player => player.name);
  assert.strictEqual(priority.length, 5);
  assert.strictEqual(secondary.length, 5);
  assert.strictEqual(observation.length, 1);
  assert(priority.includes('沐沐貼貼'));
  assert(priority.includes('東野圭吾'));
  assert(secondary.includes('補藥'));
  assert.deepStrictEqual(observation, ['宵寶']);
});

queueCase('真資料冒煙測試：2026-04-11 兩場的關鍵名單維持目前結果', () => {
  const battles = loadExportBattles();
  const battleA = battles.find(item => item.id === 'battle_1776546088629_iycnvy');
  const battleB = battles.find(item => item.id === 'battle_1776546028478_5hxlub');
  assert(battleA);
  assert(battleB);
  const reviewA = computeBattleReview(battleA);
  const reviewB = computeBattleReview(battleB);
  const aPriority = reviewA.summaries.filter(player => player.level === 'priority').map(player => player.name);
  const bPriority = reviewB.summaries.filter(player => player.level === 'priority').map(player => player.name);
  assert.deepStrictEqual(aPriority, ['沐兮芸', '纓芙月', '姬紫月丶']);
  assert.deepStrictEqual(bPriority, ['沐兮芸', '纓芙月', '東野圭吾', '姬紫月丶']);
});

queueCase('匯入格式測試：Zone.Identifier 檔名會被擋下', async () => {
  await assert.rejects(
    () => rules.importReviewSnapshot({
      name: 'battle_review_export_2026-04-18.json:Zone.Identifier',
      async text() { return '[ZoneTransfer]\nZoneId=3'; },
    }),
    /Zone\.Identifier/
  );
});

queueCase('匯入格式測試：空檔會被擋下', async () => {
  await assert.rejects(
    () => rules.importReviewSnapshot({
      name: 'empty.json',
      async text() { return '   '; },
    }),
    /匯入檔是空的/
  );
});

queueCase('匯入格式測試：錯誤 JSON 會被擋下', async () => {
  await assert.rejects(
    () => rules.importReviewSnapshot({
      name: 'broken.json',
      async text() { return '{not-json'; },
    }),
    /不是有效的覆盤資料 JSON/
  );
});

queueCase('匯入格式測試：錯誤 app 標記會被擋下', async () => {
  await assert.rejects(
    () => rules.importReviewSnapshot({
      name: 'wrong-app.json',
      async text() { return JSON.stringify({ app: 'other_app', state: {} }); },
    }),
    /不是有效的覆盤資料 JSON/
  );
});

queueCase('匯入格式測試：有效匯出檔可成功匯入 state', async () => {
  const payload = fs.readFileSync(path.join(__dirname, '..', 'battle_review_export_2026-04-18.json'), 'utf8');
  vm.runInContext(`
    function refreshAll() {}
    function renderPlayerLookup() {}
    function renderProfessionTable() {}
    function switchTab() {}
  `, rules);
  await rules.importReviewSnapshot({
    name: 'battle_review_export_2026-04-18.json',
    async text() { return payload; },
  });
  const battleCount = vm.runInContext('state.battles.length', rules);
  const activeBattleId = vm.runInContext('state.activeBattleId', rules);
  assert.strictEqual(battleCount, 3);
  assert(activeBattleId);
});

queueCase('匯入串接測試：匯入後 activeBattle 可直接跑出單場覆盤結果', async () => {
  const payload = fs.readFileSync(path.join(__dirname, '..', 'battle_review_export_2026-04-18.json'), 'utf8');
  vm.runInContext(`
    function refreshAll() {}
    function renderPlayerLookup() {}
    function renderProfessionTable() {}
    function switchTab() {}
  `, rules);
  await rules.importReviewSnapshot({
    name: 'battle_review_export_2026-04-18.json',
    async text() { return payload; },
  });
  const activeBattle = rules.activeBattle();
  assert(activeBattle, '匯入後應該要能取到 activeBattle');
  assert(Array.isArray(activeBattle.players), 'activeBattle 應包含 players');
  assert(activeBattle.players.length > 0, 'activeBattle.players 不應為空');
  const review = computeBattleReview(activeBattle);
  assert.strictEqual(review.battle.id, activeBattle.id);
  assert.strictEqual(review.summaries.length, activeBattle.players.length);
});

queueCase('匯入串接測試：缺少 activeBattleId 時會回退到第一場', async () => {
  const raw = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'battle_review_export_2026-04-18.json'), 'utf8'));
  delete raw.state.activeBattleId;
  vm.runInContext(`
    function refreshAll() {}
    function renderPlayerLookup() {}
    function renderProfessionTable() {}
    function switchTab() {}
  `, rules);
  await rules.importReviewSnapshot({
    name: 'battle_review_export_missing_active.json',
    async text() { return JSON.stringify(raw); },
  });
  const firstBattleId = raw.state.battles[0].id;
  const activeBattleId = vm.runInContext('state.activeBattleId', rules);
  assert.strictEqual(activeBattleId, firstBattleId);
  assert.strictEqual(rules.activeBattle().id, firstBattleId);
});

queueCase('真資料串接測試：匯出檔三場都保留對手原始名單資料', () => {
  const battles = loadExportBattles();
  assert.strictEqual(battles.length, 3);
  battles.forEach((battle) => {
    assert(Array.isArray(battle.opponentPlayers), `${battle.id} 缺少 opponentPlayers`);
    assert(battle.opponentPlayers.length > 0, `${battle.id} 的 opponentPlayers 不應為空`);
    assert.strictEqual(typeof battle.opponentSummary, 'object', `${battle.id} 缺少 opponentSummary`);
  });
});

queueCase('單場對位 fallback 測試：缺少對手原始名單時顯示保護提示', () => {
  const battles = loadExportBattles();
  const battle = JSON.parse(JSON.stringify(battles[0]));
  delete battle.opponentPlayers;
  delete battle.opponentSummary;

  const { context, elements } = loadBattleReviewFullContext();
  context.__battle = battle;
  vm.runInContext('state.battles = [__battle]; state.activeBattleId = __battle.id;', context);
  vm.runInContext('renderSingleBattleMatchup();', context);

  const htmlOut = elements.get('single_battle_matchup_box').innerHTML;
  assert(
    htmlOut.includes('目前這場沒有對手原始名單資料'),
    '缺少對手原始名單時，單場對位應顯示保護提示'
  );
});

queueCase('單場對位分組會共用對手推測分工並套用到鐵衣素問', () => {
  const { context, elements } = loadBattleReviewFullContext();
  const battle = {
    id: 'matchup_group_battle',
    date: '2026-05-21',
    teamName: '己方',
    opponent: '敵方',
    result: 'win',
    players: [
      basePlayer({ name: '己方進攻鐵衣', job: '鐵衣', groupType: 'attack', buildDamage: 20000000, takenDamage: 30000000 }),
      basePlayer({ name: '己方防守奶', job: '素問', groupType: 'defense', buildDamage: 0, heal: 50000000, saveCount: 10 }),
      basePlayer({ name: '己方保鑣碎夢', job: '碎夢', groupType: 'bodyguard', buildDamage: 10000000, kill: 12 }),
    ],
    opponentPlayers: [
      basePlayer({ name: '敵進攻鐵衣', job: '鐵衣', buildDamage: 20000, kill: 0, takenDamage: 32000000 }),
      basePlayer({ name: '敵防守奶', job: '素問', buildDamage: 0, kill: 1, heal: 45000000, saveCount: 8 }),
      basePlayer({ name: '敵保鑣碎夢', job: '碎夢', buildDamage: 20000000, kill: 6 }),
      basePlayer({ name: '敵防守低擊殺', job: '血河', buildDamage: 0, kill: 1 }),
    ],
  };
  context.__battle = battle;
  vm.runInContext('state.battles = [__battle]; state.activeBattleId = __battle.id;', context);

  assert.strictEqual(context.matchupPlayerGroupForSide(context.derivePlayer(battle.opponentPlayers[0]), 'foe'), 'attack');
  assert.strictEqual(context.matchupPlayerGroupForSide(context.derivePlayer(battle.opponentPlayers[1]), 'foe'), 'defense');
  assert.strictEqual(context.matchupPlayerGroupForSide(context.derivePlayer(battle.opponentPlayers[2]), 'foe'), 'defense');
  assert.strictEqual(context.matchupPlayerGroupForSide(context.derivePlayer(battle.opponentPlayers[3]), 'foe'), 'defense');

  context.renderSingleBattleMatchup();
  const htmlOut = elements.get('single_battle_matchup_box').innerHTML;
  assert(!htmlOut.includes('對手 DPS 分組門檻'), '單場對位不應再顯示舊的對手 DPS 分組門檻');
  assert(htmlOut.includes('對手分工採假設性規則'), '單場對位應說明新的對手分工推測規則');
  assert(htmlOut.includes('己方 鐵衣・進攻組'), '鐵衣應顯示進攻組分段');
  assert(htmlOut.includes('己方 素問・防守+保鑣組'), '素問應顯示防守+保鑣組分段');
});

queueCase('CSV 解析測試：戰報分段可正確切出隊伍與玩家', () => {
  const csv = [
    '測試幫會,2',
    '玩家名字,職業,擊敗,助攻,資源,對玩家傷害,對建築傷害,治療值,承受傷害,重傷,化羽/清泉,焚骨',
    '小王,碎夢,3,8,1000,2000000,3000000,0,500000,2,0,0',
    '小花,素問,0,12,900,0,0,4500000,1200000,3,8,0',
  ].join('\n');
  const sections = rules.parseCsvSections(csv);
  assert.strictEqual(sections.length, 1);
  assert.strictEqual(sections[0].teamName, '測試幫會');
  assert.strictEqual(sections[0].players.length, 2);
  assert.strictEqual(sections[0].players[1].name, '小花');
  assert.strictEqual(sections[0].players[1].saveCount, 8);
});

queueCase('CSV 解析測試：Tab 戰報與首列額外空欄也可正確切出隊伍與玩家', () => {
  const csv = [
    '花舞\t2\t\t\t\t\t\t\t\t\t\t',
    '玩家名字\t職業\t擊敗\t助攻\t資源\t對玩家傷害\t對建築傷害\t治療值\t承受傷害\t重傷\t化羽/清泉\t焚骨',
    '婗沫\t素問\t0\t65\t0\t14485\t0\t24199369\t11286829\t3\t16\t0',
    '宵然\t血河\t35\t159\t780\t61011115\t0\t1568483\t25767849\t8\t0\t0',
  ].join('\n');
  const sections = rules.parseCsvSections(csv);
  assert.strictEqual(sections.length, 1);
  assert.strictEqual(sections[0].teamName, '花舞');
  assert.strictEqual(sections[0].players.length, 2);
  assert.strictEqual(sections[0].players[0].name, '婗沫');
  assert.strictEqual(sections[0].players[1].name, '宵然');
});

queueCase('CSV 解析測試：戰報空白姓名列會自動略過', () => {
  const csv = [
    '花舞,2',
    '玩家名字,職業,擊敗,助攻,資源,對玩家傷害,對建築傷害,治療值,承受傷害,重傷,化羽/清泉,焚骨',
    '  ,碎夢,1,2,3,4,5,6,7,8,9,10',
    '宵然,神相,11,12,13,14,15,16,17,18,19,20',
  ].join('\n');
  const sections = rules.parseCsvSections(csv);
  assert.strictEqual(sections.length, 1);
  assert.strictEqual(sections[0].players.length, 1);
  assert.strictEqual(sections[0].players[0].name, '宵然');
});

queueCase('CSV 解析測試：分工 CSV 可正確轉成 group 與 specialRoles', () => {
  const roleCsv = [
    'name,job,group_type,subgroup,special_roles,note,confidence',
    '小王,碎夢,attack,1,commander,主指揮,high',
    '小花,素問,bodyguard,2,healer,保人,medium',
  ].join('\n');
  const rows = rules.parseRoleCsv(roleCsv);
  assert.strictEqual(rows.length, 2);
  assert.strictEqual(rows[0].groupType, 'attack');
  assert.deepStrictEqual(Array.from(rows[0].specialRoles), ['commander']);
  assert.strictEqual(rows[1].groupType, 'bodyguard');
  assert.deepStrictEqual(Array.from(rows[1].specialRoles), ['healer']);
});

queueCase('CSV 解析測試：分工 CSV 空白姓名列會自動略過', () => {
  const roleCsv = [
    'name,job,group_type,subgroup,special_roles,note,confidence',
    '  ,神相,attack,進攻一隊,commander,空白列,low',
    '宵然,神相,attack,進攻一隊,commander,正常列,high',
  ].join('\n');
  const rows = rules.parseRoleCsv(roleCsv);
  assert.strictEqual(rows.length, 1);
  assert.strictEqual(rows[0].name, '宵然');
});

queueCase('場次標籤測試：可從戰報檔名抽出時間碼並組成顯示標籤', () => {
  assert.strictEqual(rules.extractBattleFileLabel('20260422_2213_花舞_臥龍.csv'), '2213');
  assert.strictEqual(rules.extractBattleFileLabel('20260422_223558_花舞_臥龍.csv'), '223558');
  assert.strictEqual(rules.extractBattleFileLabel('battle.csv'), '');
  const label = rules.battleDisplayLabel({
    date: '2026-04-22',
    sourceLabel: '2213',
    teamName: '花舞',
    opponent: '臥龍',
    players: [{}, {}],
  });
  assert.strictEqual(label, '2026-04-22｜2213｜花舞 vs 臥龍｜2人');
});

queueCase('分工套用測試：applyRoleRowsToBattle 會把分組與特職套進玩家', () => {
  const battle = buildBattle([
    basePlayer({ name: '小王', job: '碎夢', groupType: 'unknown' }),
    basePlayer({ name: '小花', job: '素問', groupType: 'unknown' }),
    basePlayer({ name: '路人', job: '九靈', groupType: 'unknown' }),
  ]);
  const roleRows = [
    { name: '小王', job: '碎夢', groupType: 'attack', subgroup: '1', specialRoles: ['commander'], note: '主指揮', confidence: 'high' },
    { name: '小花', job: '素問', groupType: 'bodyguard', subgroup: '2', specialRoles: ['healer'], note: '保人', confidence: 'medium' },
  ];
  const result = rules.applyRoleRowsToBattle(battle, roleRows);
  assert.strictEqual(result.matched, 2);
  assert.strictEqual(result.unmatchedRoles, 0);
  assert.strictEqual(result.battleOnly, 1);
  assert.strictEqual(battle.players[0].groupType, 'attack');
  assert.deepStrictEqual(Array.from(battle.players[0].specialRoles), ['commander']);
  assert.strictEqual(battle.players[1].groupType, 'bodyguard');
  assert.deepStrictEqual(Array.from(battle.players[1].specialRoles), ['healer']);
  assert.strictEqual(battle.players[2].groupType, 'unknown');
});

queueCase('自動分工推論測試：塔傷門檻可分開進攻與防守', () => {
  const players = [
    basePlayer({ name: '塔傷玄機', job: '玄機', groupType: 'unknown', kill: 1, assist: 24, resource: 0, pvpDamage: 8000000, buildDamage: 520000000, death: 15 }),
    basePlayer({ name: '守點玄機', job: '玄機', groupType: 'unknown', kill: 21, assist: 130, resource: 520, pvpDamage: 56000000, buildDamage: 0, death: 5 }),
    basePlayer({ name: '支援玄機', job: '玄機', groupType: 'unknown', kill: 17, assist: 95, resource: 260, pvpDamage: 43000000, buildDamage: 25000000, death: 12 }),
    basePlayer({ name: '塔傷龍吟', job: '龍吟', groupType: 'unknown', kill: 1, assist: 28, resource: 0, pvpDamage: 9000000, buildDamage: 480000000, death: 13 }),
  ].map(rules.derivePlayer);

  assert.strictEqual(rules.inferPlayerAssignment(players[0], players).groupType, 'attack');
  assert.strictEqual(rules.inferPlayerAssignment(players[1], players).groupType, 'defense');
  assert.strictEqual(rules.inferPlayerAssignment(basePlayer({ name: '臨界進攻', buildDamage: 10000 })).groupType, 'attack');
});

queueCase('自動分工推論測試：一鍵只處理未定並以二分類寫入信心與備註', () => {
  const { context } = loadBattleReviewFullContext();
  const players = [
    basePlayer({ name: '進攻奶', job: '素問', groupType: 'unknown', assist: 20, resource: 0, heal: 26000000, takenDamage: 12000000, buildDamage: 18000000, death: 5, saveCount: 12 }),
    basePlayer({ name: '防守奶', job: '素問', groupType: 'unknown', assist: 190, resource: 520, heal: 62000000, takenDamage: 18000000, buildDamage: 0, death: 1, saveCount: 14 }),
    basePlayer({ name: '保鑣奶', job: '素問', groupType: 'unknown', assist: 110, resource: 0, heal: 65000000, takenDamage: 36000000, buildDamage: 0, death: 7, saveCount: 17 }),
    basePlayer({ name: '已指定', job: '玄機', groupType: 'defense', assist: 120, resource: 260, buildDamage: 0 }),
  ];
  vm.runInContext(`state = {
    battles: [{ id: 'auto_battle', players: ${JSON.stringify(players)} }],
    activeBattleId: 'auto_battle',
    importDraft: {},
    aliasMap: {},
    settings: { weakPct: 30, deathPct: 30 }
  };`, context);

  context.autoInferUnknownAssignments();
  const battle = vm.runInContext('state.battles[0]', context);
  assert.strictEqual(battle.players.find(player => player.name === '進攻奶').groupType, 'attack');
  assert.strictEqual(battle.players.find(player => player.name === '防守奶').groupType, 'defense');
  assert.strictEqual(battle.players.find(player => player.name === '保鑣奶').groupType, 'defense');
  assert(battle.players.find(player => player.name === '保鑣奶').assignmentNote.includes('塔傷'));
  assert.strictEqual(battle.players.find(player => player.name === '已指定').groupType, 'defense');
  battle.players.slice(0, 3).forEach((player) => {
    assert(['high', 'medium', 'low'].includes(player.assignmentConfidence));
    assert(player.assignmentNote.includes('自動推論'));
    assert(player.subgroup.startsWith('自動推論-'));
  });
});

queueCase('分工重置測試：重置所有分工只清空分工欄位並保留特殊職責', () => {
  const { context } = loadBattleReviewFullContext();
  const players = [
    basePlayer({ name: '指揮', job: '鐵衣', groupType: 'attack', subgroup: '進攻一隊', specialRoles: ['commander'], assignmentNote: '人工分工', assignmentConfidence: 'high' }),
    basePlayer({ name: '防守', job: '碎夢', groupType: 'defense', subgroup: '防守一隊', specialRoles: [], assignmentNote: '人工分工', assignmentConfidence: 'medium' }),
  ];
  vm.runInContext(`state = {
    battles: [{ id: 'reset_battle', players: ${JSON.stringify(players)} }],
    activeBattleId: 'reset_battle',
    importDraft: {},
    aliasMap: {},
    settings: { weakPct: 30, deathPct: 30 }
  };`, context);

  context.resetAllAssignments();
  const battle = vm.runInContext('state.battles[0]', context);
  battle.players.forEach((player) => {
    assert.strictEqual(player.groupType, 'unknown');
    assert.strictEqual(player.subgroup, '');
    assert.strictEqual(player.assignmentNote, '');
    assert.strictEqual(player.assignmentConfidence, '');
  });
  assert.deepStrictEqual(Array.from(battle.players[0].specialRoles), ['commander']);
});

queueCase('別名解析測試：連鎖別名最終會收斂到最後名字', () => {
  vm.runInContext(`state.aliasMap = { '小王': '老王', '老王': '王總' };`, rules);
  assert.strictEqual(rules.canonicalPlayerName('小王'), '王總');
  assert.strictEqual(rules.canonicalPlayerName('老王'), '王總');
  assert.strictEqual(rules.canonicalPlayerName('王總'), '王總');
});

queueCase('最小 UI 冒煙測試：關鍵容器 ID 仍存在於 HTML', () => {
  const requiredIds = [
    'battle_summary',
    'screening_grid',
    'commander_list',
    'unknown_group_list',
    'priority_list',
    'secondary_list',
    'observation_list',
    'battle_manual_note',
    'rules_explain_box',
    'btn_auto_infer_assignments',
    'btn_reset_all_assignments',
  ];
  requiredIds.forEach((id) => {
    assert(
      battleReviewHtml.includes(`id="${id}"`),
      `缺少關鍵容器 id="${id}"`
    );
  });
});

queueCase('最小 UI 冒煙測試：關鍵函式仍存在於腳本', () => {
  const requiredFunctions = [
    'renderBattleSummary',
    'renderScreenings',
    'renderReviewLists',
    'computeBattleReview',
    'parseCsvSections',
    'parseRoleCsv',
    'applyRoleRowsToBattle',
    'importReviewSnapshot',
    'renderRulesExplain',
    'inferPlayerAssignment',
    'autoInferUnknownAssignments',
    'resetAllAssignments',
  ];
  requiredFunctions.forEach((fnName) => {
    assert(
      battleReviewHtml.includes(`function ${fnName}(`),
      `缺少關鍵函式 function ${fnName}(...)`
    );
  });
});

queueCase('最小 UI 冒煙測試：單場覆盤三個名單容器都有對應抓取', () => {
  const requiredSelectors = [
    "document.getElementById('priority_list')",
    "document.getElementById('secondary_list')",
    "document.getElementById('observation_list')",
    "document.getElementById('priority_meta')",
    "document.getElementById('secondary_meta')",
    "document.getElementById('observation_meta')",
  ];
  requiredSelectors.forEach((snippet) => {
    assert(
      battleReviewHtml.includes(snippet),
      `缺少關鍵 selector: ${snippet}`
    );
  });
});

queueCase('最小 UI 冒煙測試：單場覆盤 tab 與規則說明 tab 仍存在', () => {
  const requiredSnippets = [
    'data-tab="review"',
    'data-tab="rules"',
    'data-tab-panel="review"',
    'data-tab-panel="rules"',
  ];
  requiredSnippets.forEach((snippet) => {
    assert(
      battleReviewHtml.includes(snippet),
      `缺少關鍵 tab 標記: ${snippet}`
    );
  });
});

queueCase('最小 UI 冒煙測試：單場對位 tab 與容器仍存在', () => {
  const requiredSnippets = [
    'data-tab="matchup"',
    'data-tab-panel="matchup"',
    'id="single_battle_matchup_box"',
    'id="current_battle_select"',
  ];
  requiredSnippets.forEach((snippet) => {
    assert(
      battleReviewHtml.includes(snippet),
      `缺少單場對位關鍵標記: ${snippet}`
    );
  });
});

queueCase('最小 UI 冒煙測試：桌面版覆盤與對位匯出入口仍存在', () => {
  const requiredSnippets = [
    'id="btn_export_review_pdf"',
    'onclick="exportBattleReviewPdf()"',
    'id="btn_export_matchup_pdf"',
    "document.getElementById('btn_export_matchup_pdf')?.addEventListener('click', exportMatchupPdf);",
    "document.getElementById('btn_export_review_pdf')?.addEventListener('click', exportBattleReviewPdf);",
  ];
  requiredSnippets.forEach((snippet) => {
    assert(
      battleReviewHtml.includes(snippet),
      `缺少匯出入口或綁定: ${snippet}`
    );
  });
});

queueCase('玩家查詢出席場次資料會吃團別篩選，不會把其他團別一起算進去', () => {
  const { context } = loadBattleReviewFullContext();
  const battleA = {
    id: 'b1',
    date: '2026-04-30',
    opponent: '甲敵',
    result: 'win',
    ownTeam: '甲',
    players: [basePlayer({ name: '測試玩家', groupType: 'defense' })],
  };
  const battleB = {
    id: 'b2',
    date: '2026-04-30',
    opponent: '乙敵',
    result: 'loss',
    ownTeam: '甲',
    players: [basePlayer({ name: '測試玩家', groupType: 'bodyguard' })],
  };
  const battleC = {
    id: 'b3',
    date: '2026-04-30',
    opponent: '丙敵',
    result: 'win',
    ownTeam: '甲',
    players: [basePlayer({ name: '測試玩家', groupType: 'defense' })],
  };
  vm.runInContext(`state = {
    battles: ${JSON.stringify([battleA, battleB, battleC])},
    activeBattleId: '',
    importDraft: {},
    aliasMap: {},
    settings: { weakPct: 30, deathPct: 30 }
  };`, context);

  const defenseRows = context.lookupPlayerRows(['b1', 'b2', 'b3'], 'defense');
  const exact = defenseRows.find(item => item.name === '測試玩家');
  const attendedIds = [...new Set((exact.history || []).map(entry => entry.battleId).filter(Boolean))];

  assert.deepStrictEqual(attendedIds, ['b1', 'b3']);
});

queueCase('玩家查詢與職業表現場次清單會吃己方、對手與日期篩選', () => {
  const { context, elements } = loadBattleReviewFullContext();
  const battles = [
    { id: 'b1', date: '2026-05-08', teamName: '劍照霜寒', opponent: '頂樓風很大', result: 'win', players: [basePlayer({ name: '玩家一' })] },
    { id: 'b2', date: '2026-05-08', teamName: '劍照霜寒', opponent: '大汝牛', result: 'loss', players: [basePlayer({ name: '玩家二' })] },
    { id: 'b3', date: '2026-05-08', teamName: '塵煙如夢', opponent: '頂樓風很大', result: 'win', players: [basePlayer({ name: '玩家三' })] },
    { id: 'b4', date: '2026-05-09', teamName: '劍照霜寒', opponent: '頂樓風很大', result: 'win', players: [basePlayer({ name: '玩家四' })] },
    { id: 'b5', date: '2026-05-12', teamName: '塵煙似夢', opponent: '夜盡天明', result: 'win', players: [basePlayer({ name: '玩家五' })] },
  ];
  vm.runInContext(`state = {
    battles: ${JSON.stringify(battles)},
    activeBattleId: 'b1',
    importDraft: {},
    aliasMap: {},
    settings: { weakPct: 30, deathPct: 30 }
  };`, context);

  elements.get('player_own_team_filter').value = 'jianzhao';
  elements.get('player_opponent_filter').value = '頂樓風很大';
  elements.get('player_date_from_filter').value = '2026-05-08';
  elements.get('player_date_to_filter').value = '2026-05-08';
  context.renderBattleFilterOptions('player_battle_select');

  assert.deepStrictEqual(
    Array.from(context.filterBattleIdsByReviewFilters(['b1', 'b2', 'b3', 'b4'], 'jianzhao', '頂樓風很大', '2026-05-08', '2026-05-08')),
    ['b1']
  );
  assert(elements.get('player_battle_select').innerHTML.includes('value="b1"'), '玩家查詢場次清單應包含符合篩選的場次');
  assert(!elements.get('player_battle_select').innerHTML.includes('value="b2"'), '玩家查詢場次清單不應包含其他對手');
  assert(!elements.get('player_battle_select').innerHTML.includes('value="b3"'), '玩家查詢場次清單不應包含其他己方');
  assert(!elements.get('player_battle_select').innerHTML.includes('value="b4"'), '玩家查詢場次清單不應包含日期範圍外場次');
  assert(!elements.get('player_battle_select').innerHTML.includes('value="b5"'), '玩家查詢場次清單不應包含塵煙似夢場次');

  elements.get('profession_own_team_filter').value = 'chensi';
  elements.get('profession_opponent_filter').value = '夜盡天明';
  elements.get('profession_date_from_filter').value = '2026-05-12';
  elements.get('profession_date_to_filter').value = '2026-05-12';
  context.renderBattleFilterOptions('profession_battle_select');
  assert(elements.get('profession_battle_select').innerHTML.includes('value="b5"'), '職業表現場次清單應包含塵煙似夢場次');
  assert(!elements.get('profession_battle_select').innerHTML.includes('value="b1"'), '職業表現場次清單不應包含其他己方');
  assert(!elements.get('profession_battle_select').innerHTML.includes('value="b2"'), '職業表現場次清單不應包含其他對手');
  assert(!elements.get('profession_battle_select').innerHTML.includes('value="b4"'), '職業表現場次清單不應包含日期範圍外場次');

  assert.deepStrictEqual(
    Array.from(context.filterBattleIdsByReviewFilters(['b1', 'b2', 'b3', 'b4', 'b5'], 'flower_other', 'all', '', '')),
    [],
    '花舞或其他不應再包含已獨立列出的己方'
  );
});

queueCase('職業表現分析對手會改用對手名單並套推測分工', () => {
  const { context, elements } = loadBattleReviewFullContext();
  const battle = {
    id: 'b1',
    date: '2026-05-15',
    teamName: '己方',
    opponent: '敵方',
    result: 'win',
    players: [
      basePlayer({ name: '己方玩家', job: '碎夢', buildDamage: 90000000, kill: 1, groupType: 'attack' }),
    ],
    opponentPlayers: [
      basePlayer({ name: '敵進攻', job: '碎夢', buildDamage: 50000000, kill: 1, groupType: 'unknown' }),
      basePlayer({ name: '敵防守', job: '碎夢', buildDamage: 9999, kill: 20, groupType: 'unknown' }),
      basePlayer({ name: '敵保鑣', job: '碎夢', buildDamage: 20000000, kill: 6, groupType: 'unknown' }),
    ],
  };
  vm.runInContext(`state = {
    battles: ${JSON.stringify([battle])},
    activeBattleId: 'b1',
    importDraft: {},
    aliasMap: {},
    settings: { weakPct: 30, deathPct: 30 }
  };`, context);

  elements.get('profession_analyze_opponent').checked = true;
  elements.get('profession_min_battles').value = '1';

  const rows = context.professionRows();
  assert(!rows.some(row => row.name === '己方玩家'), '分析對手時不應使用己方玩家名單');
  assert.strictEqual(rows.find(row => row.name === '敵進攻')?.dominantGroupType, 'attack');
  assert.strictEqual(rows.find(row => row.name === '敵防守')?.dominantGroupType, 'defense');
  assert.strictEqual(rows.find(row => row.name === '敵保鑣')?.dominantGroupType, 'bodyguard');
  assert.strictEqual(rows.find(row => row.name === '敵進攻')?.winRate, 0, '對手視角應反轉己方勝敗');

  const attackChart = context.professionQuadrantChartData('碎夢', 'attack');
  const defenseChart = context.professionQuadrantChartData('碎夢', 'defense');
  assert(attackChart.rows.some(row => row.name === '敵保鑣'), '保鑣應出現在進攻象限圖');
  assert(defenseChart.rows.some(row => row.name === '敵保鑣'), '保鑣應出現在防守象限圖');
});

queueCase('加入場次若未讀分工且未勾選無分工表會擋下', () => {
  const { context, elements } = loadBattleReviewFullContext();
  vm.runInContext(`state = {
    battles: [],
    activeBattleId: '',
    importDraft: {},
    aliasMap: {},
    settings: { weakPct: 30, deathPct: 30 }
  };
  importedSections = [{
    teamName: '己方',
    players: ${JSON.stringify([basePlayer({ name: '未分工玩家', buildDamage: 1000000, kill: 1 })])}
  }];
  importedRoleRows = [];`, context);

  elements.get('import_section').value = '0';
  elements.get('import_team_name').value = '己方';
  elements.get('import_opponent').value = '敵方';
  elements.get('import_auto_assign_without_roles').checked = false;

  context.handleAddBattle();

  assert.strictEqual(vm.runInContext('state.battles.length', context), 0);
  assert(elements.get('import_note_box').textContent.includes('請先讀取分工 CSV'));
});

queueCase('加入場次勾選無分工表會共用職業表現推測分工', () => {
  const { context, elements } = loadBattleReviewFullContext();
  const players = [
    basePlayer({ name: '推測進攻', buildDamage: 50000000, kill: 1 }),
    basePlayer({ name: '推測防守', buildDamage: 9999, kill: 20 }),
    basePlayer({ name: '推測保鑣', buildDamage: 20000000, kill: 6 }),
  ];
  vm.runInContext(`state = {
    battles: [],
    activeBattleId: '',
    importDraft: {},
    aliasMap: {},
    settings: { weakPct: 30, deathPct: 30 }
  };
  importedSections = [{
    teamName: '己方',
    players: ${JSON.stringify(players)}
  }];
  importedRoleRows = [];`, context);

  elements.get('import_section').value = '0';
  elements.get('import_team_name').value = '己方';
  elements.get('import_opponent').value = '敵方';
  elements.get('import_auto_assign_without_roles').checked = true;
  context.updateRoleImportControls();
  context.handleAddBattle();

  const groups = vm.runInContext(`Object.fromEntries(state.battles[0].players.map(player => [player.name, player.groupType]))`, context);
  assert.strictEqual(vm.runInContext('state.battles.length', context), 1);
  assert.strictEqual(groups['推測進攻'], 'attack');
  assert.strictEqual(groups['推測防守'], 'defense');
  assert.strictEqual(groups['推測保鑣'], 'bodyguard');
  assert.strictEqual(elements.get('role_csv_file').disabled, true);
  assert.strictEqual(elements.get('btn_parse_role_csv').disabled, true);
});

queueCase('公開資料合併只補入不存在場次並保留本機設定', () => {
  const { context } = loadBattleReviewFullContext();
  const localState = {
    battles: [
      { id: 'same-id', date: '2026-05-01', sourceLabel: 'A', teamName: '本機幫', opponent: '對手甲', players: [] },
      { id: 'same-key-local', date: '2026-05-02', sourceLabel: 'B', teamName: '本機幫', opponent: '對手乙', players: [] },
    ],
    activeBattleId: 'same-id',
    importDraft: {},
    aliasMap: { 小名: '正名' },
    settings: { weakPct: 22, deathPct: 33 },
    batchExportConfig: { review: 1, matchup: 0, player: 3, leaders: 4, profession: 5, focus: 6 },
  };
  const publicState = {
    battles: [
      { id: 'same-id', date: '2026-05-09', sourceLabel: 'X', teamName: '公開幫', opponent: '重複ID', players: [] },
      { id: 'public-same-key', date: '2026-05-02', sourceLabel: 'B', teamName: '本機幫', opponent: '對手乙', players: [] },
      { id: 'public-new', date: '2026-05-03', sourceLabel: 'C', teamName: '公開幫', opponent: '對手丙', players: [] },
    ],
  };

  const result = context.mergePublicStateIntoLocal(publicState, localState);

  assert.strictEqual(result.added, 1);
  assert.strictEqual(result.skipped, 2);
  assert.deepStrictEqual(Array.from(result.state.battles, battle => battle.id), ['public-new', 'same-id', 'same-key-local']);
  assert.deepStrictEqual(JSON.parse(JSON.stringify(result.state.aliasMap)), localState.aliasMap);
  assert.deepStrictEqual(JSON.parse(JSON.stringify(result.state.settings)), localState.settings);
});

queueCase('公開模式網址與個人工具網址會使用同一頁參數切換', () => {
  const { context } = loadBattleReviewFullContext();
  context.window.location.href = 'https://example.test/desktop/?foo=bar#tab';
  context.window.location.search = '?foo=bar';
  context.window.location.pathname = '/desktop/';
  context.window.location.hash = '#tab';

  assert.strictEqual(context.isPublicReadOnlyMode(), false);
  assert(/^\/desktop\/\?foo=bar&public=latest&v=\d+#tab$/.test(context.publicLatestUrl()));

  context.window.location.href = 'https://example.test/desktop/?foo=bar&public=latest&v=123#tab';
  context.window.location.search = '?foo=bar&public=latest&v=123';
  assert.strictEqual(context.isPublicReadOnlyMode(), true);
  assert.strictEqual(context.publicShareDataUrl(), 'public-data/latest.json');
  assert.strictEqual(context.personalToolUrl(), '/desktop/?foo=bar#tab');
});

Promise.all(asyncCases).then(() => {
  if (!process.exitCode) {
    console.log('全部核心規則測試通過。');
  }
});
