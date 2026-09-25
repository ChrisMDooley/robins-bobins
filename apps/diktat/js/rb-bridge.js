/*
 * rb-bridge.js — hands Diktat Trainer's coins and sessions to Robin's Bobins.
 *
 * Diktat keeps its own ledger (it existed before the platform). This bridge
 * copies every Diktat coin entry and finished session into the child's
 * platform ledger, using ids "diktat:<original id>". Copying is idempotent,
 * so it can run as often as we like: after each award, on app start, and when
 * the platform home opens. Nothing is ever removed from the platform ledger,
 * so resetting Diktat's own history never takes a child's coins away.
 *
 * Loaded by Diktat itself and by the platform shell. Harmless without RB.
 */
(function (root) {
  'use strict';
  var PREFIX = 'diktat-trainer:';

  function read(childId) {
    try { var raw = root.localStorage.getItem(PREFIX + childId); return raw ? JSON.parse(raw) : null; }
    catch (e) { return null; }
  }

  function sync(RB, childId, state) {
    if (!RB) return 0;
    state = state || read(childId);
    if (!state) return 0;
    var n = RB.coins.merge(childId, (state.coins || []).map(function (c) {
      return { id: 'diktat:' + c.id, ts: c.ts, amount: c.amount, kind: 'earn', reason: c.reason, app: 'diktat', ref: c.sessionId || null };
    }));
    RB.activity.merge(childId, (state.sessions || []).filter(function (s) { return s.endedAt; }).map(function (s) {
      return {
        id: 'diktat:' + s.id, app: 'diktat', kind: 'session', startedAt: s.startedAt, endedAt: s.endedAt,
        summary: { sentences: (s.sentenceIds || []).length, accuracy: s.accuracy, coins: s.coins }
      };
    }));
    return n;
  }

  // One friendly line for the app card on the child's home screen.
  function cardInfo(childId, now) {
    var st = read(childId);
    if (!st || !st.wordStats) return 'Hören, schreiben, verbessern';
    now = now || Date.now();
    var due = Object.keys(st.wordStats).filter(function (w) {
      var s = st.wordStats[w]; return s.wrong > 0 && s.box < 5 && s.due <= now;
    }).length;
    if (due) return due === 1 ? '1 Wort zum Wiederholen' : due + ' Wörter zum Wiederholen';
    return 'Hören, schreiben, verbessern';
  }

  root.RBDiktat = { sync: sync, cardInfo: cardInfo };
})(typeof window !== 'undefined' ? window : globalThis);
