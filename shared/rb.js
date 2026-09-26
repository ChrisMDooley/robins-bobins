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
    appUrl: function (appId, childId) {
      var a = apps.get(appId);
      return a ? BASE + a.path + '?child=' + encodeURIComponent(childId) : null;
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
    _merge: merge
  };
})(typeof window !== 'undefined' ? window : globalThis);
