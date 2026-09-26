/*
 * store.js — Alex's learning data for this app, one JSON document per child
 * at  rb-geo:<childId>  (the storagePrefix registered in apps/registry.js).
 *
 * Document:
 *   items    { "<topic>:<item>": ItemStat }   derived per concept, updated on every answer
 *   answers  [Answer]      append-only log (capped), every record has an id
 *   sessions [Session]     finished rounds (practice, 5 minutes, test)
 *
 *   ItemStat {seen, right, wrong, box, due, last, recent:[1,0,…]}   recent = last 6 answers, newest last
 *   Answer   {id, ts, topic, item, ok, mode, q}
 *   Session  {id, mode, startedAt, endedAt, total, correct, topics:{topic:{n,ok}}, score?, max?}
 */
(function (root) {
  'use strict';

  var SCHEMA = 1;
  var PREFIX = 'rb-geo:';
  var MAX_ANSWERS = 1500;

  function adapter() {
    var ok = false, mem = {};
    try { root.localStorage.setItem('__geo_t', '1'); root.localStorage.removeItem('__geo_t'); ok = true; } catch (e) { ok = false; }
    return {
      persistent: ok,
      read: function (k) { try { return ok ? root.localStorage.getItem(k) : (mem[k] || null); } catch (e) { return mem[k] || null; } },
      write: function (k, v) { try { if (ok) root.localStorage.setItem(k, v); else mem[k] = v; } catch (e) { mem[k] = v; } }
    };
  }

  function uid(p) { return (p || '') + Date.now().toString(36) + Math.random().toString(36).slice(2, 8); }

  function empty(childId) {
    return { schema: SCHEMA, childId: childId, createdAt: Date.now(), items: {}, answers: [], sessions: [], settings: {} };
  }

  function Store(childId, ad) {
    this.childId = childId;
    this.ad = ad || adapter();
    this.key = PREFIX + childId;
    this.doc = this.load();
  }
  Store.prototype.load = function () {
    var raw = this.ad.read(this.key), d = null;
    try { d = raw ? JSON.parse(raw) : null; } catch (e) { d = null; }
    var base = empty(this.childId);
    if (!d) return base;
    for (var k in base) if (!(k in d)) d[k] = base[k];
    return d;
  };
  Store.prototype.save = function () { this.ad.write(this.key, JSON.stringify(this.doc)); };
  Store.prototype.stat = function (key) { return this.doc.items[key] || null; };

  // Record one answer. `update` is the adaptive rule (adaptive.js) that changes the ItemStat.
  Store.prototype.answer = function (a, update, now) {
    now = now || Date.now();
    var key = a.topic + ':' + a.item;
    var s = this.doc.items[key] || { seen: 0, right: 0, wrong: 0, box: 0, due: 0, last: 0, recent: [] };
    s.seen++; if (a.ok) s.right++; else s.wrong++;
    s.recent.push(a.ok ? 1 : 0); if (s.recent.length > 6) s.recent.shift();
    s.last = now;
    if (update) update(s, a.ok, now);
    this.doc.items[key] = s;
    var rec = { id: uid('g'), ts: now, topic: a.topic, item: a.item, ok: !!a.ok, mode: a.mode || 'practice', q: a.q || '' };
    this.doc.answers.push(rec);
    if (this.doc.answers.length > MAX_ANSWERS) this.doc.answers = this.doc.answers.slice(-MAX_ANSWERS);
    this.save();
    return rec;
  };
  Store.prototype.addSession = function (s) {
    s.id = s.id || uid('s');
    this.doc.sessions.push(s);
    this.save();
    return s;
  };
  Store.prototype.totals = function () {
    var n = 0, ok = 0, items = this.doc.items;
    for (var k in items) { n += items[k].seen; ok += items[k].right; }
    return { answered: n, correct: ok, sessions: this.doc.sessions.length };
  };
  Store.prototype.reset = function () { this.doc = empty(this.childId); this.save(); };

  root.GeoStore = { Store: Store, adapter: adapter, uid: uid, PREFIX: PREFIX };
})(typeof window !== 'undefined' ? window : globalThis);
