'use strict';
(() => {
  const config = window.BattleMatch.match.overview;
  const target = document.querySelector('#minimap-video');
  const status = document.querySelector('#video-status');
  const events = new EventTarget(), cache = new Map();
  let time = 0, paused = true, rate = 1, serial = 0, shown = -1, last = performance.now();
  const fire = type => events.dispatchEvent(new Event(type));
  const frameNumber = value => Math.min(config.frames.count - 1, Math.floor(value));
  const url = index => window.BattleMatch.asset(config.frames.pattern.replace('{frame}', String(index).padStart(config.frames.digits, '0')));
  function fetchImage(index) {
    if (cache.has(index)) return cache.get(index);
    const promise = new Promise((resolve, reject) => { const image = new Image(); image.onload = () => resolve(image); image.onerror = () => reject(new Error(`缺少第 ${index} 秒圖片`)); image.src = url(index); });
    cache.set(index, promise); promise.catch(() => { if (cache.get(index) === promise) cache.delete(index); });
    return promise;
  }
  async function show() {
    if (time >= config.duration) {
      ++serial; shown = -1; target.style.visibility = 'hidden'; target.dataset.frame = '';
      status.textContent = '00:00・錄影結束；最後可用小地圖為 00:01，未補造結束影格。';
      return;
    }
    const index = frameNumber(time);
    if (index === shown) return;
    shown = index;
    const token = ++serial;
    target.style.visibility = 'hidden'; target.dataset.frame = '';
    status.textContent = `小地圖第 ${index} 秒載入中…`;
    try {
      const image = await fetchImage(index);
      if (token !== serial) return;
      target.src = image.src; target.alt = `戰場倒數 ${Math.floor((config.duration-index)/60)}:${String((config.duration-index)%60).padStart(2,'0')} 的小地圖`;
      target.style.visibility = 'visible'; target.dataset.frame = String(index);
      status.textContent = `WebP・每秒一張・${config.frames.width}×${config.frames.height}`;
      fire('seeked');
    } catch (error) {
      if (token !== serial) return;
      status.textContent = `${error.message}，目前畫面留空；可重試或選其他時間。`;
      shown = -1; player.pause();
    }
    // Only retain the current and next three seconds; stale responses cannot update the view.
    for (const key of cache.keys()) if (key < index || key > index + 3) cache.delete(key);
    for (let i=index+1; i<=Math.min(index+3, config.frames.count-1); i++) fetchImage(i).catch(()=>{});
  }
  const player = window.minimapPlayer = {
    get duration() { return config.duration; }, get currentTime() { return time; },
    set currentTime(value) { time = Math.max(0, Math.min(config.duration, Number(value) || 0)); last = performance.now(); fire('seeking'); show(); fire('timeupdate'); },
    get paused() { return paused; }, get playbackRate() { return rate; }, set playbackRate(value) { rate = Number(value) || 1; },
    play() { if (time >= config.duration) this.currentTime = 0; paused = false; last = performance.now(); show(); fire('play'); return Promise.resolve(); },
    pause() { if (!paused) { paused = true; fire('pause'); } },
    addEventListener: (...args) => events.addEventListener(...args),
    get cacheSize() { return cache.size; },
  };
  function tick(now) { if (!paused) { const previous = Math.floor(time); time = Math.min(config.duration, time + (now-last)/1000*rate); if (Math.floor(time)!==previous) { show(); fire('timeupdate'); } if(time>=config.duration){player.pause();fire('ended');} } last=now; requestAnimationFrame(tick); }
  requestAnimationFrame(tick); show();
})();
