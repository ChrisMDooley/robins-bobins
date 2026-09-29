/*
 * practice.js — session building, spaced repetition and coin rules.
 * Pure logic on top of the store; no DOM.
 *
 * Spaced repetition (Leitner boxes 1–5):
 *   - a misspelled word goes to box 1 and is due immediately
 *   - each later correct spelling moves it up one box; next due after
 *     1 / 2 / 4 / 8 / 16 days
 *   - words in box < 5 with a mistake history are "problem words"; sessions
 *     prefer sentences containing due problem words (up to half the session)
 */
(function (root) {
  'use strict';
  var C = root.DT.compare;
  var DAY = 24 * 3600 * 1000;
  var INTERVAL_DAYS = [0, 1, 2, 4, 8, 16];

  function dayKey(ts) {
    var d = new Date(ts);
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }

  function shuffle(a) {
    for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)); var t = a[i]; a[i] = a[j]; a[j] = t; }
    return a;
  }

  function problemWords(state, now) {
    now = now || Date.now();
    return Object.keys(state.wordStats)
      .map(function (w) { return Object.assign({ word: w }, state.wordStats[w]); })
      .filter(function (s) { return s.wrong > 0 && s.box < 5; })
      .sort(function (a, b) { return (a.box - b.box) || (b.wrong - a.wrong) || (a.due - b.due); })
      .map(function (s) { s.isDue = s.due <= now; return s; });
  }

  // Sentences of one section ('alle' or missing = everything). Parent-added sentences are 'eigene'.
  function sectionPool(store, section) {
    var all = store.allSentences();
    if (!section || section === 'alle') return all;
    var pool = all.filter(function (s) { return (s.section || 'eigene') === section; });
    return pool.length ? pool : all;
  }

  function buildSession(store, section) {
    var state = store.state;
    var n = state.settings.sessionLength;
    var all = sectionPool(store, section);
    var lastSeen = {};
    state.attempts.forEach(function (a) { lastSeen[a.sentenceId] = Math.max(lastSeen[a.sentenceId] || 0, a.ts); });
    var chosen = [], used = {};

    // 1) sentences with due problem words
    var due = problemWords(state).filter(function (p) { return p.isDue; });
    var maxProblem = Math.ceil(n / 2);
    for (var i = 0; i < due.length && chosen.length < maxProblem; i++) {
      var w = due[i].word;
      var candidates = shuffle(all.filter(function (s) { return !used[s.id] && C.words(s.text).indexOf(w) !== -1; }));
      if (candidates.length) { chosen.push(candidates[0]); used[candidates[0].id] = true; }
    }
    // 2) fill with least-recently practised sentences (never-seen first)
    var rest = shuffle(all.filter(function (s) { return !used[s.id]; }))
      .sort(function (a, b) { return (lastSeen[a.id] || 0) - (lastSeen[b.id] || 0); });
    for (i = 0; i < rest.length && chosen.length < n; i++) chosen.push(rest[i]);

    return {
      id: store.uid('s'),
      section: section || 'alle',
      startedAt: Date.now(),
      sentences: shuffle(chosen),
      results: []   // per sentence: {sentenceId, result, corrected, coins}
    };
  }

  // Words the child must actively correct, split into single words for stats.
  function errorWords(result) {
    var set = {};
    C.correctionTargets(result).forEach(function (e) {
      e.expected.split(' ').forEach(function (w) { if (w) set[w] = true; });
    });
    return set;
  }

  // Update word stats after the first try; returns list of "hard words now right".
  function recordWordStats(state, sentenceText, result, now) {
    now = now || Date.now();
    var wrong = errorWords(result);
    var hardWordsRight = [];
    C.words(sentenceText).forEach(function (w) {
      var s = state.wordStats[w] || (state.wordStats[w] = { seen: 0, wrong: 0, box: 0, due: 0, lastWrong: 0 });
      s.seen++;
      if (wrong[w]) {
        s.wrong++; s.box = 1; s.due = now; s.lastWrong = now;
      } else if (s.wrong > 0 && s.box < 5) {
        if (s.due <= now) { // only promote when it was actually due (true spacing)
          s.box = Math.min(5, s.box + 1);
          s.due = now + INTERVAL_DAYS[s.box] * DAY;
        }
        hardWordsRight.push(w);
      }
    });
    return hardWordsRight;
  }

  function sentenceCoins(values, result, correctedCount, hardWordsRight) {
    var parts = [{ amount: values.sentence, reason: 'Satz geschafft' }];
    if (result.perfect) parts.push({ amount: values.perfect, reason: 'Alles richtig!' });
    var corr = Math.min(correctedCount, values.correctionCap);
    if (corr > 0) parts.push({ amount: corr * values.correction, reason: corr === 1 ? 'Wort verbessert' : corr + ' Wörter verbessert' });
    if (hardWordsRight.length) parts.push({ amount: hardWordsRight.length * values.hardWord,
      reason: 'Schwieriges Wort geschafft: ' + hardWordsRight.join(', ') });
    return parts;
  }

  function accuracyOf(results) {
    var total = 0, correct = 0;
    results.forEach(function (r) { total += r.result.stats.wordsTotal; correct += r.result.stats.wordsCorrect; });
    return total ? correct / total : 0;
  }

  function streakDays(state, now) {
    var days = {};
    state.sessions.forEach(function (s) { if (s.endedAt) days[dayKey(s.endedAt)] = true; });
    var d = new Date(now || Date.now());
    if (!days[dayKey(d)]) d.setDate(d.getDate() - 1); // today not done yet → count up to yesterday
    var n = 0;
    while (days[dayKey(d)]) { n++; d.setDate(d.getDate() - 1); }
    return n;
  }

  // Session-end bonuses. Call BEFORE pushing the new session into state.sessions.
  function sessionBonuses(state, session, now) {
    var v = state.settings.coinValues;
    var parts = [{ amount: v.session, reason: 'Übung geschafft' }];
    var acc = accuracyOf(session.results);
    var prev = state.sessions.slice(-5).map(function (s) { return s.accuracy; }).filter(function (x) { return typeof x === 'number'; });
    if (prev.length >= 2) {
      var avg = prev.reduce(function (a, b) { return a + b; }, 0) / prev.length;
      if (acc > avg + 0.001) parts.push({ amount: v.improvement, reason: 'Besser als sonst!' });
    }
    var alreadyToday = state.sessions.some(function (s) { return s.endedAt && dayKey(s.endedAt) === dayKey(now); });
    var streakBefore = streakDays(state, now); // includes yesterday
    if (!alreadyToday && streakBefore >= 1) {
      parts.push({ amount: v.streak, reason: 'Übungsserie: ' + (streakBefore + 1) + ' Tage' });
    }
    return { parts: parts, accuracy: acc };
  }

  root.DT = root.DT || {};
  root.DT.practice = {
    buildSession: buildSession,
    sectionPool: sectionPool,
    recordWordStats: recordWordStats,
    sentenceCoins: sentenceCoins,
    sessionBonuses: sessionBonuses,
    accuracyOf: accuracyOf,
    streakDays: streakDays,
    problemWords: problemWords,
    errorWords: errorWords,
    dayKey: dayKey
  };
})(typeof window !== 'undefined' ? window : globalThis);
