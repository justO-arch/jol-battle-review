'use strict';
(() => {
  const entries = new Map();
  let leaving = false;
  const encode = value => JSON.stringify(value);
  function localDirty(keys) { return [...entries].some(([key, item]) => (!keys || keys.includes(key)) && encode(item.read()) !== item.saved); }
  function childDirty() {
    return [...document.querySelectorAll('iframe')].some(frame => {
      try { return frame.contentWindow.UnsavedGuard?.isDirty() || false; } catch { return false; }
    });
  }
  const api = window.UnsavedGuard = {
    track(key, read) { entries.set(key, { read, saved: encode(read()) }); },
    saved(key) { const item = entries.get(key); if (item) item.saved = encode(item.read()); },
    isDirty: () => localDirty() || childDirty(),
    confirm(keys) { return !(keys ? localDirty(keys) : api.isDirty()) || window.confirm('有尚未另存的修改。按「取消」返回另存新檔；按「確定」放棄受影響的修改並繼續。'); },
    navigate(url) { if (!api.confirm()) return false; leaving = true; location.href = url; return true; },
  };
  window.addEventListener('beforeunload', event => { if (window.parent === window && !leaving && api.isDirty()) { event.preventDefault(); event.returnValue = ''; } });
  document.addEventListener('click', event => {
    const anchor = event.target.closest('a[href]');
    if (!anchor || anchor.target === '_blank' || anchor.hasAttribute('download') || event.ctrlKey || event.metaKey || event.shiftKey || event.button) return;
    const url = new URL(anchor.href);
    if (url.protocol === 'blob:' || url.href === location.href) return;
    event.preventDefault(); api.navigate(url.href);
  });
})();
