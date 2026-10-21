// The browser's own copy of a site file, loaded with "Load file" in the viewer or sent from the layout editor.
// It lives in this browser only, in IndexedDB (site files can outgrow localStorage), and is used instead of
// data/hall.json until it is cleared.
const DB = 'server-hall-live', STORE = 'files', KEY = 'site';
function db() {
  return new Promise((ok, fail) => {
    const q = indexedDB.open(DB, 1);
    q.onupgradeneeded = () => q.result.createObjectStore(STORE);
    q.onsuccess = () => ok(q.result); q.onerror = () => fail(q.error);
  });
}
async function run(mode, fn) {
  const d = await db();
  return new Promise((ok, fail) => {
    const t = d.transaction(STORE, mode), q = fn(t.objectStore(STORE));
    t.oncomplete = () => ok(q.result); t.onerror = () => fail(t.error);
  });
}
// { name, text, at } or null (also when storage is blocked, e.g. some private windows)
export const getLocal = () => run('readonly', s => s.get(KEY)).then(v => v || null, () => null);
export const putLocal = (name, text) => run('readwrite', s => s.put({ name, text, at: Date.now() }, KEY));
export const clearLocal = () => run('readwrite', s => s.delete(KEY));
