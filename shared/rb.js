/*
 * rb.js — the Robin's Bobins platform SDK.
 *
 * Every learning app may load this one file (a classic <script>, so it also
 * works from file://). It gives the app:
 *   - who is practising     RB.requireChild(), RB.child(id), RB.children()
 *   - the shared coin bank  RB.coins.add / merge / balance / list
 *   - progress hooks        RB.activity.record / merge, RB.progress.summary
 *   - navigation            RB.nav.homeUrl(childId), RB.nav.pickerUrl(), RB.nav.appUrl(appId, childId)
 *   - the app registry      RB.apps.register / list / get / forChild
 *   - backup                RB.backup.exportAll / importAll   (platform + every app's data)
 *
 * Storage layout (all in localStorage today, all JSON):
 *   rb:platform          one family document: children, which apps each child has, parent PIN, rewards
 *   rb:child:<id>        one document per child: coin ledger, activity log, redemptions
 *   <appPrefix><id>      each app's OWN learning data, e.g. diktat-trainer:lukas. The platform never
 *                        interprets it; it only includes it in backups.
 *
 * Designed for later sync between devices (not built yet):
 *   - ledgers are append-only lists of records with globally unique ids
 *   - a balance is never stored, only derived
 *   - merging two copies = union by id  (see merge() below — the same function sync will use)
 *   - all reads/writes go through one adapter { read, write, keys } that a sync adapter can replace
 */
(function (root) {
  'use strict';

  var SCHEMA = 1;
  var PLATFORM_KEY = 'rb:platform';
  var CHILD_PREFIX = 'rb:child:';
  var CURRENT_KEY = 'rb:current';          // sessionStorage: who picked in THIS tab
  var DAY = 24 * 3600 * 1000;

  // First-run family. Parent Mode edits these later; ids never change.
  var DEFAULT_CHILDREN = [
    { id: 'lukas',   name: 'Lukas',   color: '#1F6F8B', ui: 'standard', apps: ['diktat'] },
    { id: 'alex',    name: 'Alex',    color: '#D46A2E', ui: 'standard', apps: [] },
    { id: 'liliana', name: 'Liliana', color: '#A8508C', ui: 'simple',   apps: [] }
  ];

  // Where is the platform root? Derived from this script's own URL, so apps can
  // live at any depth and links still work on GitHub Pages, localhost or file://.
  var BASE = (function () {
    try {
      var src = document.currentScript && document.currentScript.src;
      if (src) return src.replace(/shared\/rb\.js(\?.*)?$/, '');
    } catch (e) { /* ignore */ }
    return './';
  })();

  // ---------- storage adapter ----------

  function localStorageAdapter() {
    var ok = false, mem = {};
    try { root.localStorage.setItem('__rb_test', '1'); root.localStorage.removeItem('__rb_test'); ok = true; } catch (e) { ok = false; }
    return {
      persistent: ok,
      read: function (k) { try { return ok ? root.localStorage.getItem(k) : (k in mem ? mem[k] : null); } catch (e) { return null; } },
      write: function (k, v) { try { if (ok) root.localStorage.setItem(k, v); else mem[k] = v; } catch (e) { mem[k] = v; } },
      keys: function () {
        if (!ok) return Object.keys(mem);
        var out = [];
        for (var i = 0; i < root.localStorage.length; i++) out.push(root.localStorage.key(i));
        return out;
      }
    };
  }

  var adapter = localStorageAdapter();

  function readJSON(key) {
    var raw = adapter.read(key);
    if (!raw) return null;
    try { return JSON.parse(raw); } catch (e) { return null; }
  }
  function writeJSON(key, obj) {
    adapter.write(key, JSON.stringify(obj));
    try { root.dispatchEvent(new CustomEvent('rb:change', { detail: { key: key } })); } catch (e) { /* old browsers */ }
  }

  function uid(prefix) {
    return (prefix || '') + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }
  function clone(o) { return JSON.parse(JSON.stringify(o)); }

  // ---------- platform document ----------

  function emptyPlatform() {
    return {
      schema: SCHEMA,
      deviceId: uid('d'),
      createdAt: Date.now(),
      children: clone(DEFAULT_CHILDREN),
      parent: { pinHash: null },
      rewards: [],          // Robin's Shop (milestone 3): {id, title, cost, childIds[]|null, active}
      settings: {}
    };
  }

  var platform = null;
  function P() {
    if (platform) return platform;
    platform = readJSON(PLATFORM_KEY);
    if (!platform) { platform = emptyPlatform(); writeJSON(PLATFORM_KEY, platform); }
    var base = emptyPlatform();
    for (var k in base) if (!(k in platform)) platform[k] = base[k];
    return platform;
  }
  function savePlatform() { writeJSON(PLATFORM_KEY, P()); }

  // Another tab or app page may have written in the meantime: always re-read
  // before changing, so two pages never overwrite each other's entries.
  function freshPlatform() { platform = null; return P(); }

  // ---------- child documents ----------

  function emptyChildDoc(id) {
    return { schema: SCHEMA, childId: id, coins: [], activities: [], redemptions: [] };
  }
  function childDoc(id) {
    var d = readJSON(CHILD_PREFIX + id) || emptyChildDoc(id);
    var base = emptyChildDoc(id);
    for (var k in base) if (!(k in d)) d[k] = base[k];
    return d;
  }
  function saveChildDoc(d) { writeJSON(CHILD_PREFIX + d.childId, d); }

  // Union by id. Existing records win (records are immutable once written).
  function merge(list, incoming) {
    var have = {}, added = 0;
    list.forEach(function (r) { have[r.id] = true; });
    incoming.forEach(function (r) { if (r && r.id && !have[r.id]) { list.push(r); have[r.id] = true; added++; } });
    return added;
  }

  // ---------- children ----------

  function children() { return P().children.slice(); }
  function child(id) { return P().children.filter(function (c) { return c.id === id; })[0] || null; }

  function updateChild(id, fn) {
    var p = freshPlatform();
    var c = p.children.filter(function (x) { return x.id === id; })[0];
    if (!c) return null;
    fn(c); savePlatform(); return c;
  }

  function selectChild(id) {
    try { root.sessionStorage.setItem(CURRENT_KEY, id); } catch (e) { /* ignore */ }
  }

  // The child an app page is running for: ?child=<id> in the URL first, then
  // whoever was picked in this tab. Never a silent default — that is how
  // progress gets mixed up.
  function currentChildId() {
    var m = /[?&]child=([a-z0-9_-]+)/i.exec(root.location ? root.location.search : '');
    if (m && child(m[1])) { selectChild(m[1]); return m[1]; }
    try { var s = root.sessionStorage.getItem(CURRENT_KEY); if (s && child(s)) return s; } catch (e) { /* ignore */ }
    return null;
  }

  // For apps: returns the child, or sends the browser to "Wer bist du?".
  function requireChild() {
    var id = currentChildId();
    if (id) return child(id);
    root.location.href = nav.pickerUrl();
    return null;
  }

  // ---------- coins ----------
  // CoinTransaction {id, ts, amount, kind:'earn'|'redeem'|'adjust', reason, app, ref, deviceId}
  // Apps may only EARN. Spending (shop) and corrections belong to Parent Mode.
  // Mistakes never cost coins: there is simply no API for an app to take any away.

  function normaliseCoin(e) {
    var kind = e.kind || 'earn';
    var amount = Math.round(Number(e.amount) || 0);
    if (kind === 'earn' && amount <= 0) return null;
    return {
      id: e.id || uid('c'), ts: e.ts || Date.now(), amount: amount, kind: kind,
      reason: String(e.reason || ''), app: e.app || null, ref: e.ref || null, deviceId: P().deviceId
    };
  }

  var coins = {
    add: function (childId, entry) {
      var d = childDoc(childId), e = normaliseCoin(entry);
      if (!e) return null;
      if (merge(d.coins, [e])) saveChildDoc(d);
      return e;
    },
    // Add many at once (one write). Idempotent: same ids are skipped. Returns how many were new.
    merge: function (childId, entries) {
      var d = childDoc(childId);
      var n = merge(d.coins, entries.map(normaliseCoin).filter(Boolean));
      if (n) saveChildDoc(d);
      return n;
    },
    balance: function (childId) {
      return childDoc(childId).coins.reduce(function (s, c) { return s + c.amount; }, 0);
    },
    list: function (childId) { return childDoc(childId).coins.slice(); },
    // Parent Mode only (not exposed to child screens).
    adjust: function (childId, amount, reason) {
      return coins.add(childId, { amount: amount, kind: 'adjust', reason: reason || 'Eltern-Korrektur', app: 'platform' });
    }
  };

  // ---------- activity / progress ----------
  // Activity {id, app, kind:'session'|..., startedAt, endedAt, summary:{...app-defined small numbers}}

  function normaliseActivity(a) {
    if (!a || !a.app) return null;
    return {
      id: a.id || uid('a'), app: a.app, kind: a.kind || 'session',
      startedAt: a.startedAt || a.endedAt || Date.now(), endedAt: a.endedAt || null,
      summary: a.summary || {}
    };
  }

  var activity = {
    record: function (childId, a) {
      var d = childDoc(childId), r = normaliseActivity(a);
      if (!r) return null;
      if (merge(d.activities, [r])) saveChildDoc(d);
      return r;
    },
    merge: function (childId, list) {
      var d = childDoc(childId);
      var n = merge(d.activities, list.map(normaliseActivity).filter(Boolean));
      if (n) saveChildDoc(d);
      return n;
    },
    list: function (childId) { return childDoc(childId).activities.slice(); }
  };

  function dayKey(ts) {
    var d = new Date(ts);
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }

  // The small numbers a child sees. Detailed analytics belong in Parent Mode.
  function summary(childId, now) {
    now = now || Date.now();
    var d = childDoc(childId);
    var done = d.activities.filter(function (a) { return a.endedAt; });
    var days = {};
    done.forEach(function (a) { days[dayKey(a.endedAt)] = true; });
    var cur = new Date(now);
    if (!days[dayKey(cur)]) cur.setDate(cur.getDate() - 1);   // today not done yet → streak up to yesterday
    var streak = 0;
    while (days[dayKey(cur)]) { streak++; cur.setDate(cur.getDate() - 1); }
    var today = done.filter(function (a) { return dayKey(a.endedAt) === dayKey(now); }).length;
    var last = done.reduce(function (m, a) { return Math.max(m, a.endedAt); }, 0);
    return {
      coins: d.coins.reduce(function (s, c) { return s + c.amount; }, 0),
      streak: streak, today: today, lastActiveAt: last || null,
      daysAway: last ? Math.floor((now - last) / DAY) : null
    };
  }

  // ---------- apps ----------
  // App {id, title, subject, icon, color, path, storagePrefix, bridge?, hidden?}

  var registry = [];
  var apps = {
    register: function (def) { registry = registry.filter(function (a) { return a.id !== def.id; }); registry.push(def); },
    list: function () { return registry.slice(); },
    get: function (id) { return registry.filter(function (a) { return a.id === id; })[0] || null; },
    // An app may name children it is meant for (grantTo). It is switched on for them ONCE;
    // after that Parent Mode decides (un-ticking it is remembered and respected).
    applyGrants: function () {
      var p = freshPlatform(), changed = false;
      p.settings.granted = p.settings.granted || {};
      registry.forEach(function (a) {
        if (!a.grantTo || p.settings.granted[a.id]) return;
        a.grantTo.forEach(function (cid) {
          var c = p.children.filter(function (x) { return x.id === cid; })[0];
          if (c && c.apps.indexOf(a.id) === -1) c.apps.push(a.id);
        });
        p.settings.granted[a.id] = Date.now(); changed = true;
      });
      if (changed) savePlatform();
      return changed;
    },
    forChild: function (childId) {
      var c = child(childId);
      if (!c) return [];
      return c.apps.map(apps.get).filter(function (a) { return a && !a.hidden; });
    }
  };

  // ---------- navigation ----------

  var nav = {
    base: BASE,
    pickerUrl: function () { return BASE + 'index.html#/'; },
    homeUrl: function (childId) { return BASE + 'index.html#/c/' + encodeURIComponent(childId); },
    // Apps in this repo use `path`; apps with their own repository use `url`
    // (absolute, or relative to the platform root: '../europa-trainer/' on the same site).
    appUrl: function (appId, childId) {
      var a = apps.get(appId);
      if (!a) return null;
      var u = a.url ? (/^https?:\/\//.test(a.url) ? a.url : BASE + a.url) : BASE + a.path;
      return u + (u.indexOf('?') >= 0 ? '&' : '?') + 'child=' + encodeURIComponent(childId);
    },
    home: function (childId) { root.location.href = nav.homeUrl(childId); }
  };

  // ---------- parent PIN ----------
  // A speed bump for children, not security: the data lives unencrypted in this browser.

  function hashPin(pin) {
    var s = 'robins-bobins:' + pin, h = 0x811c9dc5;
    for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = (h * 0x01000193) >>> 0; }
    return h.toString(16);
  }
  var parent = {
    hasPin: function () { return !!P().parent.pinHash; },
    setPin: function (pin) { freshPlatform().parent.pinHash = hashPin(String(pin)); savePlatform(); },
    checkPin: function (pin) { return P().parent.pinHash === hashPin(String(pin)); }
  };

  // ---------- backup ----------
  // One file with the platform AND every app's own data, keyed exactly as stored.

  function ownedKey(k) {
    if (k.indexOf('rb:') === 0) return true;
    return registry.some(function (a) { return a.storagePrefix && k.indexOf(a.storagePrefix) === 0; });
  }
  var backup = {
    exportAll: function () {
      var data = {};
      adapter.keys().filter(ownedKey).sort().forEach(function (k) {
        var raw = adapter.read(k);
        try { data[k] = JSON.parse(raw); } catch (e) { data[k] = raw; }
      });
      return { format: 'robins-bobins-backup', version: 1, exportedAt: new Date().toISOString(), data: data };
    },
    importAll: function (obj) {
      if (typeof obj === 'string') obj = JSON.parse(obj);
      if (!obj || obj.format !== 'robins-bobins-backup' || !obj.data) throw new Error('not a Robin\'s Bobins backup');
      Object.keys(obj.data).filter(ownedKey).forEach(function (k) {
        var v = obj.data[k];
        adapter.write(k, typeof v === 'string' ? v : JSON.stringify(v));
      });
      platform = null;
      return Object.keys(obj.data).length;
    }
  };


  // ---------- family PIN gate ----------
  // A lock screen in front of every page that loads this SDK (platform + all apps).
  // Only a salted SHA-256 of the PIN is stored here, never the PIN itself. Once entered,
  // the device is remembered (localStorage 'rb:gate') until "Dieses Gerät abmelden".
  // HONEST LIMIT: this is a door, not a safe. The site is static and public, so anyone
  // who reads the source code can see everything that is in it.
  var GATE_SALT = 'robins-bobins-family:e3663b0217e072a5:';
  var GATE_HASH = 'c623d5d8fdd2353ef1861b66169370d4a168aeb62f94cf63e08da88cddb06639';
  var GATE_KEY = 'rb:gate';

  // Small synchronous SHA-256 (works on file:// and old browsers, no crypto.subtle needed).
  function sha256(str) {
    var K = [0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,
      0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,
      0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,
      0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,0xd192e819,0xd6990624,0xf40e3585,0x106aa070,
      0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,
      0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2];
    var bytes = unescape(encodeURIComponent(str)), l = bytes.length, words = [], i;
    for (i = 0; i < l; i++) words[i >> 2] |= (bytes.charCodeAt(i) & 0xff) << (24 - (i % 4) * 8);
    words[l >> 2] |= 0x80 << (24 - (l % 4) * 8);
    words[(((l + 8) >> 6) + 1) * 16 - 1] = l * 8;
    var H = [0x6a09e667,0xbb67ae85,0x3c6ef372,0xa54ff53a,0x510e527f,0x9b05688c,0x1f83d9ab,0x5be0cd19], W = [];
    function r(x, n) { return (x >>> n) | (x << (32 - n)); }
    for (var j = 0; j < words.length; j += 16) {
      var a = H[0], b = H[1], c = H[2], d = H[3], e = H[4], f = H[5], g = H[6], h = H[7];
      for (i = 0; i < 64; i++) {
        if (i < 16) W[i] = words[j + i] | 0;
        else W[i] = (r(W[i-2],17) ^ r(W[i-2],19) ^ (W[i-2] >>> 10)) + W[i-7] + (r(W[i-15],7) ^ r(W[i-15],18) ^ (W[i-15] >>> 3)) + W[i-16] | 0;
        var t1 = h + (r(e,6) ^ r(e,11) ^ r(e,25)) + ((e & f) ^ (~e & g)) + K[i] + W[i] | 0;
        var t2 = (r(a,2) ^ r(a,13) ^ r(a,22)) + ((a & b) ^ (a & c) ^ (b & c)) | 0;
        h = g; g = f; f = e; e = d + t1 | 0; d = c; c = b; b = a; a = t1 + t2 | 0;
      }
      H[0] = H[0] + a | 0; H[1] = H[1] + b | 0; H[2] = H[2] + c | 0; H[3] = H[3] + d | 0;
      H[4] = H[4] + e | 0; H[5] = H[5] + f | 0; H[6] = H[6] + g | 0; H[7] = H[7] + h | 0;
    }
    return H.map(function (x) { return ('00000000' + (x >>> 0).toString(16)).slice(-8); }).join('');
  }

  var gate = {
    unlocked: function () { return adapter.read(GATE_KEY) === GATE_HASH; },
    check: function (pin) { return sha256(GATE_SALT + String(pin).trim()) === GATE_HASH; },
    unlock: function (pin) {
      if (!gate.check(pin)) return false;
      adapter.write(GATE_KEY, GATE_HASH);
      return true;
    },
    lock: function () { try { root.localStorage.removeItem(GATE_KEY); } catch (e) { /* ignore */ } }
  };

  function showGate() {
    if (!root.document || gate.unlocked()) return;
    var doc = root.document, html = doc.documentElement;
    html.setAttribute('data-rb-locked', '');
    var css = doc.createElement('style');
    css.textContent =
      'html[data-rb-locked] body > :not(#rb-gate){visibility:hidden!important}' +
      '#rb-gate{position:fixed;inset:0;z-index:9999;display:flex;align-items:center;justify-content:center;padding:24px;' +
      'background:#FBF5EC;font-family:"Atkinson Hyperlegible",system-ui,sans-serif;color:#2A2530}' +
      '#rb-gate form{display:flex;flex-direction:column;align-items:center;gap:14px;text-align:center;max-width:340px;width:100%}' +
      '#rb-gate h1{margin:0;font-size:1.9em}#rb-gate h1 b{color:#E0673B}#rb-gate p{margin:0;color:#6E6472}' +
      '#rb-gate input{font-size:2em;letter-spacing:.4em;text-align:center;width:8.5em;padding:10px 0 10px .4em;border:2px solid #EADCCB;' +
      'border-radius:14px;background:#fff;font-family:inherit}#rb-gate input:focus{outline:none;border-color:#E0673B}' +
      '#rb-gate button{border:0;border-radius:14px;padding:12px 28px;min-height:48px;font-weight:700;font-size:1.05em;font-family:inherit;' +
      'background:#E0673B;color:#fff;cursor:pointer}#rb-gate .msg{min-height:1.4em;color:#C9542B;font-weight:700}' +
      '#rb-gate .robin{width:120px;height:120px;display:block}#rb-gate .robin svg{width:100%;height:100%}' +
      '@keyframes rbshake{20%,60%{transform:translateX(-6px)}40%,80%{transform:translateX(6px)}}#rb-gate .shake{animation:rbshake .4s}';
    (doc.head || html).appendChild(css);
    function build() {
      if (doc.getElementById('rb-gate')) return;
      var box = doc.createElement('div');
      box.id = 'rb-gate';
      box.innerHTML = '<form autocomplete="off"><span class="robin" aria-hidden="true"></span>' +
        '<h1>Robin’s <b>Bobins</b></h1><p>Bitte die Familien-PIN eingeben.</p>' +
        '<input type="password" inputmode="numeric" pattern="[0-9]*" maxlength="12" aria-label="Familien-PIN" autofocus>' +
        '<button type="submit">Los geht’s</button><p class="msg" aria-live="polite"></p></form>';
      doc.body.appendChild(box);
      var form = box.querySelector('form'), input = box.querySelector('input'), msg = box.querySelector('.msg');
      try { if (root.RB && root.RB.robin) box.querySelector('.robin').innerHTML = root.RB.robin.svg('normal'); } catch (e) { /* ignore */ }
      // robin.js loads after this file: draw him once everything is there
      root.addEventListener('load', function () { try { if (root.RB && root.RB.robin) box.querySelector('.robin').innerHTML = root.RB.robin.svg('normal'); } catch (e) {} });
      form.addEventListener('submit', function (ev) {
        ev.preventDefault();
        if (gate.unlock(input.value)) {
          box.remove(); html.removeAttribute('data-rb-locked');
          try { root.dispatchEvent(new CustomEvent('rb:unlocked')); } catch (e) { /* ignore */ }
        } else {
          msg.textContent = 'Die PIN stimmt nicht.';
          input.value = ''; form.classList.remove('shake'); void form.offsetWidth; form.classList.add('shake'); input.focus();
        }
      });
      input.focus();
    }
    if (doc.body) build(); else doc.addEventListener('DOMContentLoaded', build);
  }

  root.RB = {
    VERSION: '0.2.0',
    persistent: adapter.persistent,
    uid: uid,
    dayKey: dayKey,
    children: children,
    child: child,
    updateChild: updateChild,
    selectChild: selectChild,
    currentChildId: currentChildId,
    requireChild: requireChild,
    coins: coins,
    activity: activity,
    progress: { summary: summary },
    apps: apps,
    nav: nav,
    parent: parent,
    backup: backup,
    gate: gate,
    _merge: merge
  };
  showGate();
})(typeof window !== 'undefined' ? window : globalThis);
