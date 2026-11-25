// Service worker of the public copy of the OpenET pilot dashboard (GitHub Pages).
//
// Every file of the dashboard is stored on this site encrypted, under enc/. After sign-in this
// worker decrypts them in the browser, with the key kept by session.js, and serves them at the
// addresses the unchanged dashboard uses: ./ (the page), app/... (its files) and data/...
// It also serves the video tours at videos/. Nothing is sent anywhere, and without a valid
// session every encrypted file is refused. The headers are those the lab server sent.
'use strict';
importScripts('session.js');

const BASE = new URL('./', self.location).href;
const BASE_PATH = new URL(BASE).pathname;
const MAGIC = [0x4f, 0x45, 0x50, 0x31];   // "OEP1"
const TYPES = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.bin': 'application/octet-stream', '.png': 'image/png',
  '.svg': 'image/svg+xml', '.csv': 'text/csv; charset=utf-8', '.md': 'text/markdown; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8', '.woff2': 'font/woff2', '.ico': 'image/x-icon', '.mp4': 'video/mp4',
};
const CSP = "default-src 'self'; img-src 'self' data: blob:; media-src 'self' blob:; style-src 'self' 'unsafe-inline'; " +
  "script-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'";

function headers(type, extra) {
  return Object.assign({
    'Content-Type': type,
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'no-referrer',
    'Content-Security-Policy': CSP,
    'Cache-Control': 'no-store',
  }, extra || {});
}

function text(status, message) {
  return new Response(message, { status, headers: headers('text/plain; charset=utf-8') });
}

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', event => event.waitUntil(self.clients.claim()));

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET' && req.method !== 'HEAD') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin || !url.pathname.startsWith(BASE_PATH)) return;
  let rel;
  try { rel = decodeURIComponent(url.pathname.slice(BASE_PATH.length)); } catch (e) { return; }

  if (rel === 'logout') return event.respondWith(signOut());
  if (rel === '' || rel === 'index.html') {
    if (req.mode === 'navigate') event.respondWith(dashboard(req));
    return;
  }
  if (rel.startsWith('app/')) return event.respondWith(serve('www/' + rel.slice(4), req));
  if (rel.startsWith('data/')) return event.respondWith(serve('data/' + rel.slice(5), req));
  if (rel === 'videos') return event.respondWith(Response.redirect(BASE + 'videos/', 303));
  if (rel === 'videos/' || rel === 'videos/index.html') return event.respondWith(serve('pages/videos.html', req));
  if (rel.startsWith('videos/')) return event.respondWith(serve('videos/' + rel.slice(7), req));
  // Anything else (the sign-in page, its files, access.json, enc/) comes from the network.
});

// The key, re-read from IndexedDB at most once a minute; "Sign out" forgets it at once.
let cached = null;
async function session() {
  if (cached && cached.until > Date.now()) return cached.key;
  let key = null;
  try { key = await OEP.load(); } catch (e) { key = null; }
  cached = key ? { key, until: Date.now() + 60 * 1000 } : null;
  return key;
}

async function signOut() {
  cached = null;
  videos.clear();
  try { await OEP.clear(); } catch (e) { /* nothing stored */ }
  return Response.redirect(BASE, 303);
}

// Whether this build has the video tours (checked once per worker).
let hasVideos = null;
async function videosBuilt() {
  if (hasVideos === null) {
    try { hasVideos = (await fetch(BASE + 'enc/pages/videos.html.enc', { method: 'HEAD' })).ok; } catch (e) { hasVideos = false; }
  }
  return hasVideos;
}

// ./ : the dashboard when signed in, otherwise the sign-in page from the network.
async function dashboard(req) {
  const key = await session();
  if (!key) return fetch(req);
  const r = await serve('www/index.html', req, key);
  if (r.status !== 200) return r;
  let html = await r.text();
  // The only addition to the dashboard on this site: a link to the video tours beside "Sign out".
  if (await videosBuilt()) {
    html = html.replace('<a class="signout" href="logout">Sign out</a>',
      '<a class="signout" href="videos/">Video tours</a> <a class="signout" href="logout">Sign out</a>');
  }
  return new Response(html, { status: 200, headers: headers(TYPES['.html']) });
}

async function decrypt(buf, rel, key) {
  if (buf.length < 33 || MAGIC.some((b, i) => buf[i] !== b)) throw new Error('not an encrypted file');
  const flags = buf[4];
  const plain = new Uint8Array(await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: buf.subarray(5, 17), additionalData: new TextEncoder().encode(OEP.AAD + rel) },
    key, buf.subarray(17)));
  if (!(flags & 1)) return plain;
  const stream = new Blob([plain]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

// The last video decrypted, kept for the range requests a video player makes.
const videos = new Map();

async function serve(rel, req, key) {
  if (/(^|\/)\.\.(\/|$)|\\/.test(rel)) return text(404, 'Not found');
  key = key || await session();
  if (!key) return text(401, 'Please sign in at ' + BASE);
  const isVideo = rel.endsWith('.mp4');
  let body = isVideo ? videos.get(rel) : null;
  if (!body) {
    const r = await fetch(BASE + 'enc/' + rel.split('/').map(encodeURIComponent).join('/') + '.enc');
    if (!r.ok) return text(r.status === 404 ? 404 : 502, 'Not found');
    try {
      body = await decrypt(new Uint8Array(await r.arrayBuffer()), rel, key);
    } catch (e) {
      return text(500, 'This file could not be decrypted.');
    }
    if (isVideo) { videos.clear(); videos.set(rel, body); }
  }
  const ext = (rel.match(/\.[^./]+$/) || [''])[0].toLowerCase();
  const type = TYPES[ext] || 'application/octet-stream';
  const range = req.headers.get('range');
  if (isVideo && range) return ranged(body, range, type);
  return new Response(body, {
    status: 200,
    headers: headers(type, { 'Content-Length': String(body.byteLength), 'Accept-Ranges': isVideo ? 'bytes' : 'none' }),
  });
}

function ranged(body, range, type) {
  const size = body.byteLength;
  const refuse = () => new Response(null, { status: 416, headers: headers(type, { 'Content-Range': 'bytes */' + size }) });
  const m = /^bytes=(\d*)-(\d*)$/.exec(range.trim());
  if (!m || (m[1] === '' && m[2] === '')) return refuse();
  let start, end;
  if (m[1] === '') { start = Math.max(0, size - Number(m[2])); end = size - 1; }
  else { start = Number(m[1]); end = m[2] === '' ? size - 1 : Math.min(Number(m[2]), size - 1); }
  if (start > end || start >= size) return refuse();
  const part = body.subarray(start, end + 1);
  return new Response(part, {
    status: 206,
    headers: headers(type, {
      'Content-Range': `bytes ${start}-${end}/${size}`, 'Content-Length': String(part.byteLength), 'Accept-Ranges': 'bytes',
    }),
  });
}
