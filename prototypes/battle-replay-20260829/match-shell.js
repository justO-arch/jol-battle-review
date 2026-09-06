'use strict';
(() => {
  const base = new URL('.', document.currentScript.src);
  const page = location.pathname.split('/').pop();
  const json = async url => { const response = await fetch(url); if (!response.ok) throw new Error(`資料載入失敗：${response.status} ${url}`); return response.json(); };
  const script = src => new Promise((resolve, reject) => { const el = document.createElement('script'); el.src = new URL(src, base); el.onload = resolve; el.onerror = () => reject(new Error(`程式載入失敗：${src}`)); document.body.append(el); });
  function fail(error) { const box = document.createElement('div'); box.className = 'load-error'; box.textContent = `無法開啟覆盤：${error.message}。請確認場次網址與資料；本機請透過 HTTP 服務開啟。`; document.body.prepend(box); console.error(error); }
  window.MatchReady = (async () => {
    // Blank scenarios never fetch the match registry or any recorded-match assets.
    if (!['overview.html', 'event-review.html'].includes(page)) return null;
    const registryURL = new URL('matches/index.json', base);
    const registry = await json(registryURL);
    const params = new URLSearchParams(location.search);
    const id = params.get('match') || registry.defaultMatch;
    const entry = registry.matches.find(item => item.id === id);
    if (!entry) throw new Error('場次不存在，未自動改開其他場次');
    const manifestURL = new URL(entry.manifest, registryURL);
    const match = await json(manifestURL);
    if (match.schemaVersion !== 1 || match.id !== id || !Array.isArray(match.events)) throw new Error('場次設定格式或身分不符');
    const asset = value => new URL(value, manifestURL).href;
    const eventId = params.get('event') || match.events[0]?.id;
    const event = match.events.find(item => item.id === eventId);
    if (params.has('event') && !event) throw new Error('此場次沒有指定事件');
    const context = window.BattleMatch = { registry, match, event, asset, base, manifestURL };
    const urlFor = (file, matchId=id, selectedEvent=event?.id) => {
      const url = new URL(file, base); url.searchParams.set('match', matchId);
      if (selectedEvent) url.searchParams.set('event', selectedEvent);
      return url.href;
    };
    context.urlFor = urlFor;
    const current = new URL(location.href); current.searchParams.set('match', id); if (event) current.searchParams.set('event', event.id); history.replaceState(null, '', current);
    document.querySelectorAll('.page-nav a').forEach(a => { const file = new URL(a.href).pathname.split('/').pop(); if (file !== 'scenario-editor.html') a.href = urlFor(file); });
    const controls = document.createElement('div'); controls.className = 'match-controls';
    const label = document.createElement('label'); label.textContent = '場次';
    const select = document.createElement('select'); select.id = 'match-select'; select.setAttribute('aria-label', '選擇覆盤場次');
    registry.matches.forEach(item => select.add(new Option(item.label, item.id))); select.value = id;
    select.onchange = () => { if (!window.UnsavedGuard.navigate(urlFor(page, select.value, null))) select.value = id; };
    label.append(select); controls.append(label);
    if (page === 'event-review.html') {
      const label = document.createElement('label'); label.textContent = '事件'; const select = document.createElement('select'); select.id = 'event-select';
      match.events.forEach(item => select.add(new Option(item.title, item.id))); select.value = event?.id || '';
      select.onchange = () => { if (!window.UnsavedGuard.navigate(urlFor(page, id, select.value))) select.value = event.id; };
      label.append(select); controls.append(label);
    }
    document.querySelector('.page-nav').before(controls);
    if (page === 'overview.html') {
      const overview = match.overview;
      const values = await Promise.all([json(asset(overview.hud)), json(asset(overview.towerStates)), json(asset(overview.candidates))]);
      [window.BATTLE_R3_HUD, window.BATTLE_R3_TOWER_STATES, window.BATTLE_P4_EVENTS] = values;
      document.querySelector('.title').textContent = match.label;
      select.title = match.label;
      document.querySelector('.side-block h3').textContent = `同時刻原始 HUD（${overview.sourceLabel}）`;
      document.title = `${match.label}・大局概覽`;
      for (const el of document.querySelectorAll('#time,#video-time')) el.max = overview.duration;
      await script('webp-player.js'); await script('overview.js');
    } else {
      if (!event) throw new Error('此場次尚無局部覆盤事件，請先查看大局概覽');
      if (event.renderer !== 'tower-disc') throw new Error('此局部場景尚未提供對應觀察草模渲染器');
      [window.BATTLE_E01_EVIDENCE, window.BATTLE_E01_SCENE] = await Promise.all([json(asset(event.evidence)), json(asset(event.scene))]);
      document.querySelector('h1').textContent = event.title;
      document.querySelector('header p').textContent = `${match.label}｜候選窗口 ${event.window.start} → ${event.window.end}`;
      document.querySelector('.eyebrow').textContent = `JUSTICEOL / EVENT REVIEW · ${event.id}`;
      document.title = `${match.label}・${event.title}`;
      await script('../tower-sandbox/vendor/three.min.js'); await script('route-editor-3d.js'); await script('event-review.js');
    }
    return context;
  })();
  window.MatchReady.catch(fail);
})();
