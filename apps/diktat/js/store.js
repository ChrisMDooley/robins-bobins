/*
 * store.js — all persistence goes through here.
 *
 * Design for later cloud sync:
 *  - One JSON document per learner profile ("lukas").
 *  - History is append-only (attempts, sessions, coin entries), each with a
 *    unique id and timestamp, so two devices can later be merged by id.
 *  - The coin balance is never stored; it is the sum of coin entries.
 *  - Adapters implement { read(key) -> string|null, write(key, string) }.
 *    Today: localStorage (with an in-memory fallback). Later: a server/cloud
 *    adapter with the same two calls plus merge-by-id.
 */
(function (root) {
  'use strict';

  var SCHEMA_VERSION = 1;

  var DEFAULT_SETTINGS = {
    sessionLength: 10,
    fontScale: 1,          // 0.9 – 1.5
    spacing: 'wide',       // 'normal' | 'wide'
    font: 'atkinson',      // 'atkinson' | 'opendyslexic' | 'system'
    voiceName: '',         // '' = best available German voice
    rate: 0.9,
    slowRate: 0.6,
    coinValues: {
      sentence: 2,         // finishing a sentence (always)
      perfect: 3,          // sentence right first time
      correction: 1,       // each word successfully corrected (max 3 per sentence)
      correctionCap: 3,
      hardWord: 1,         // a previously difficult word now spelled right
      session: 5,          // finishing a session
      improvement: 3,      // beat own recent average
      streak: 2            // first session of the day while on a streak of ≥2 days
    }
  };

  function emptyState() {
    return {
      schema: SCHEMA_VERSION,
      profile: { id: 'lukas', name: 'Lukas' },
      settings: JSON.parse(JSON.stringify(DEFAULT_SETTINGS)),
      sentences: [],      // parent-added sentences (built-ins live in sentences.js)
      attempts: [],       // {id, sessionId, sentenceId, ts, typed, errors[], perfect, stats, corrected}
      sessions: [],       // {id, startedAt, endedAt, sentenceIds, coins, accuracy}
      coins: [],          // {id, ts, amount, reason}
      wordStats: {},      // word -> {seen, wrong, box, due, lastWrong}
      rewards: []         // milestone 2
    };
  }

  // ---------- adapters ----------

  function localStorageAdapter() {
    var ok = false;
    try { var k = '__dt_test'; root.localStorage.setItem(k, '1'); root.localStorage.removeItem(k); ok = true; } catch (e) { ok = false; }
    var mem = {};
    return {
      persistent: ok,
      read: function (key) { try { return ok ? root.localStorage.getItem(key) : (mem[key] || null); } catch (e) { return mem[key] || null; } },
      write: function (key, value) { try { if (ok) root.localStorage.setItem(key, value); else mem[key] = value; } catch (e) { mem[key] = value; } }
    };
  }

  // ---------- store ----------

  function createStore(adapter, profileId) {
    var key = 'diktat-trainer:' + (profileId || 'lukas');
    var state;

    function migrate(s) {
      var base = emptyState();
      for (var k in base) if (!(k in s)) s[k] = base[k];
      // add any new default settings / coin values without overwriting choices
      for (k in DEFAULT_SETTINGS) if (!(k in s.settings)) s.settings[k] = JSON.parse(JSON.stringify(DEFAULT_SETTINGS[k]));
      for (k in DEFAULT_SETTINGS.coinValues) if (!(k in s.settings.coinValues)) s.settings.coinValues[k] = DEFAULT_SETTINGS.coinValues[k];
      s.schema = SCHEMA_VERSION;
      return s;
    }

    function load() {
      var raw = adapter.read(key);
      try { state = raw ? migrate(JSON.parse(raw)) : emptyState(); } catch (e) { state = emptyState(); }
      return state;
    }

    function save() { adapter.write(key, JSON.stringify(state)); }

    function uid(prefix) {
      return (prefix || '') + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
    }

    load();

    return {
      persistent: adapter.persistent,
      get state() { return state; },
      save: save,
      uid: uid,
      update: function (fn) { fn(state); save(); },

      // coins — balance is derived, entries are append-only
      addCoins: function (amount, reason, extra) {
        var entry = { id: uid('c'), ts: Date.now(), amount: amount, reason: reason };
        if (extra) for (var k in extra) entry[k] = extra[k];
        state.coins.push(entry); save(); return entry;
      },
      balance: function () { return state.coins.reduce(function (s, c) { return s + c.amount; }, 0); },

      allSentences: function () {
        return (root.DT.builtinSentences || []).concat(state.sentences);
      },

      exportJSON: function () { return JSON.stringify(state, null, 2); },
      importJSON: function (text) { var s = migrate(JSON.parse(text)); state = s; save(); return s; },
      reset: function () { state = emptyState(); save(); }
    };
  }

  root.DT = root.DT || {};
  root.DT.createStore = createStore;
  root.DT.localStorageAdapter = localStorageAdapter;
  root.DT.DEFAULT_SETTINGS = DEFAULT_SETTINGS;
  if (typeof module !== 'undefined' && module.exports) module.exports = { createStore: createStore, emptyState: emptyState, DEFAULT_SETTINGS: DEFAULT_SETTINGS };
})(typeof window !== 'undefined' ? window : globalThis);
