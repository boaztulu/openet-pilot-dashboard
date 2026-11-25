// Session of the public copy of the OpenET pilot dashboard: the decryption key, kept in this
// browser's IndexedDB as a non-extractable key until "Sign out" or until it expires.
// Used by the sign-in page (signin.js) and by the service worker (sw.js).
'use strict';
self.OEP = (() => {
  const DB = 'openet-pilot-dashboard';
  const STORE = 'session';
  const ID = 'current';

  function openDb() {
    return new Promise((resolve, reject) => {
      const r = indexedDB.open(DB, 1);
      r.onupgradeneeded = () => r.result.createObjectStore(STORE);
      r.onsuccess = () => resolve(r.result);
      r.onerror = () => reject(r.error);
    });
  }

  async function run(mode, fn) {
    const db = await openDb();
    try {
      return await new Promise((resolve, reject) => {
        const tx = db.transaction(STORE, mode);
        const req = fn(tx.objectStore(STORE));
        tx.oncomplete = () => resolve(req ? req.result : undefined);
        tx.onerror = () => reject(tx.error);
        tx.onabort = () => reject(tx.error);
      });
    } finally {
      db.close();
    }
  }

  return {
    // Prefix of the associated data of every encrypted file (the file's path follows).
    AAD: 'openet-pilot-dashboard/v1/',
    save(key, hours) {
      return run('readwrite', s => s.put({ key, expires: Date.now() + hours * 3600 * 1000 }, ID));
    },
    clear() {
      return run('readwrite', s => s.delete(ID));
    },
    async load() {
      const s = await run('readonly', st => st.get(ID));
      if (!s) return null;
      if (!(s.expires > Date.now())) { await this.clear(); return null; }
      return s.key;
    },
  };
})();
