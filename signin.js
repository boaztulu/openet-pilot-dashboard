// Sign-in of the public copy of the OpenET pilot dashboard. The password never leaves this
// browser: it derives a key (PBKDF2-SHA256) that unlocks the dashboard's content key from
// access.json. The content key is kept by session.js and used by the service worker (sw.js).
'use strict';
(async () => {
  const form = document.getElementById('form');
  const msg = document.getElementById('msg');
  const input = document.getElementById('password');
  const button = document.getElementById('go');
  const say = text => { msg.textContent = text; msg.hidden = !text; };
  const b64 = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));

  let inflate = false;
  try { inflate = !!new DecompressionStream('deflate-raw'); } catch (e) { inflate = false; }
  if (!('serviceWorker' in navigator) || !self.crypto || !crypto.subtle || !self.indexedDB || !inflate) {
    say('This browser window cannot open the dashboard. Please use a current Chrome, Edge, Firefox or Safari in a normal (not private) window.');
    return;
  }
  try {
    await navigator.serviceWorker.register('sw.js', { scope: './' });
    await navigator.serviceWorker.ready;
  } catch (e) {
    say('The dashboard could not start in this window. A private window can block it; please use a normal window.');
    return;
  }

  // Signed in already (for example after a forced reload, which skips the service worker):
  // open the dashboard, at most once every 10 seconds so that a failure cannot loop.
  try {
    if (await OEP.load()) {
      const last = Number(sessionStorage.getItem('oep-open') || 0);
      if (Date.now() - last > 10000) {
        sessionStorage.setItem('oep-open', String(Date.now()));
        location.reload();
        return;
      }
    }
  } catch (e) { /* no stored session: sign in below */ }

  form.hidden = false;
  input.focus();
  form.addEventListener('submit', async event => {
    event.preventDefault();
    button.disabled = true;
    say('Checking the password.');
    try {
      const access = await (await fetch('access.json', { cache: 'no-cache' })).json();
      const base = await crypto.subtle.importKey('raw', new TextEncoder().encode(input.value), 'PBKDF2', false, ['deriveKey']);
      const kek = await crypto.subtle.deriveKey(
        { name: 'PBKDF2', hash: 'SHA-256', salt: b64(access.salt), iterations: access.iterations },
        base, { name: 'AES-GCM', length: 256 }, false, ['unwrapKey']);
      let key;
      try {
        key = await crypto.subtle.unwrapKey('raw', b64(access.wrapped), kek,
          { name: 'AES-GCM', iv: b64(access.iv), additionalData: new TextEncoder().encode(access.aad) },
          { name: 'AES-GCM' }, false, ['decrypt']);
      } catch (e) {
        say('That password was not accepted.');
        button.disabled = false;
        input.select();
        return;
      }
      await OEP.save(key, access.session_hours || 12);
      input.value = '';
      sessionStorage.setItem('oep-open', String(Date.now()));
      location.reload();
    } catch (e) {
      say('Sign-in failed: ' + e.message);
      button.disabled = false;
    }
  });
})();
