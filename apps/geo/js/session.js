/*
 * session.js — builds rounds: practice, 5 Minuten, mock test. No DOM.
 *
 *   var s = GeoSession.create(store, { mode: '5min' });
 *   var q = s.next();          // null when the round is over
 *   s.record(q, ok);           // after each answer (stores it, updates boxes)
 *   s.summary();               // numbers for the end screen
 */
(function (root) {
  'use strict';
  var G = root.GEO, C = root.GEO_CONTENT, Q = root.GeoQuestions, A = root.GeoAdaptive;

  var ALL_TOPICS = C.topics.map(function (t) { return t.id; });

  // Mock test: 18 points across all five teacher areas.
  var EXAM_PLAN = [
    ['laender', 2], ['hauptstaedte', 2], ['wappen', 3], ['nachbarn', 2],
    ['staedte', 2], ['fluesse', 2], ['gebirge', 1],
    ['legende', 1], ['planquadrate', 2], ['richtungen', 1]
  ];

  function topicMastery(store, topic) {
    return A.topicMastery(Q.topicItems(topic), function (k) { return store.stat(k); });
  }

  // How much a topic deserves attention right now (5 Minuten).
  function topicNeed(store, topic) {
    var m = topicMastery(store, topic);
    var unseenShare = 1 - m.seen / Math.max(1, m.total);
    return 0.15 + (1 - m.raw) + 0.4 * unseenShare;
  }

  function create(store, opts) {
    opts = opts || {};
    var mode = opts.mode || 'practice';
    var topics = opts.topics && opts.topics.length ? opts.topics : ALL_TOPICS;
    var s = {
      mode: mode, topics: topics, startedAt: Date.now(),
      limit: opts.limit || (mode === '5min' ? 20 : mode === 'exam' ? 18 : 10),
      timeLimitMs: mode === '5min' ? 5 * 60 * 1000 : 0,
      asked: [], wrong: {}, results: [], examQueue: null,
      allow: opts.allow || null, forbid: opts.forbid || null
    };

    if (mode === 'exam') {
      s.examQueue = [];
      EXAM_PLAN.forEach(function (p) {
        var items = G.shuffle(Q.topicItems(p[0]));
        var n = 0;
        for (var i = 0; i < items.length && n < p[1]; i++) {
          var qq = Q.make(p[0], items[i].id, { exam: true, forbid: ['type', 'mapDrag', 'mapSeq'] });
          if (qq) { s.examQueue.push(qq); n++; }
        }
      });
      s.limit = s.examQueue.length;
    }

    s.timeUp = function () { return s.timeLimitMs && Date.now() - s.startedAt >= s.timeLimitMs; };
    s.done = function () { return s.asked.length >= s.limit || (s.timeUp() && s.asked.length >= 5); };

    s.next = function () {
      if (s.done()) return null;
      if (s.examQueue) return s.examQueue[s.asked.length] || null;
      var now = Date.now();
      for (var attempt = 0; attempt < 12; attempt++) {
        // 1. topic: weakest first (5 Minuten), otherwise even
        var tlist = s.topics.map(function (t) { return { t: t, w: mode === '5min' ? topicNeed(store, t) : 1 }; });
        var topic = G.weighted(tlist).t;
        // 2. item inside the topic
        var items = Q.topicItems(topic).map(function (it) {
          return { it: it, w: A.weight(it.key, store.stat(it.key), it.tier, now, s) };
        });
        var pick = G.weighted(items);
        if (!pick || pick.w <= 0) continue;
        var qq = Q.make(topic, pick.it.id, { stat: store.stat(pick.it.key), allow: s.allow, forbid: s.forbid });
        if (qq) return qq;
      }
      return null;
    };

    s.record = function (qq, ok, given) {
      s.asked.push(qq.key);
      if (!ok) s.wrong[qq.key] = s.asked.length;
      else delete s.wrong[qq.key];
      s.results.push({ key: qq.key, topic: qq.topic, item: qq.item, ok: !!ok, prompt: qq.prompt, given: given, q: qq });
      store.answer({ topic: qq.topic, item: qq.item, ok: ok, mode: mode, q: qq.gen }, A.update);
    };

    s.summary = function () {
      var byTopic = {};
      s.results.forEach(function (r) {
        var b = byTopic[r.topic] || (byTopic[r.topic] = { n: 0, ok: 0 });
        b.n++; if (r.ok) b.ok++;
      });
      var correct = s.results.filter(function (r) { return r.ok; }).length;
      // "noch einmal üben" = concepts that were wrong at least once and not fixed later
      var again = {};
      s.results.forEach(function (r) { if (!r.ok) again[r.key] = r; else delete again[r.key]; });
      var weakTopics = Object.keys(byTopic).filter(function (t) { return byTopic[t].ok < byTopic[t].n; })
        .sort(function (a, b) { return (byTopic[a].ok / byTopic[a].n) - (byTopic[b].ok / byTopic[b].n); });
      // Overall weakest topic by mastery (for "Heute solltest du …")
      var weakest = ALL_TOPICS.map(function (t) { return { t: t, m: topicMastery(store, t) }; })
        .filter(function (x) { return x.m.seen > 0; })
        .sort(function (a, b) { return a.m.raw - b.m.raw; })[0];
      return {
        mode: mode, total: s.results.length, correct: correct, wrongCount: s.results.length - correct,
        againKeys: Object.keys(again), byTopic: byTopic, weakTopics: weakTopics,
        weakest: weakest ? weakest.t : null, startedAt: s.startedAt, endedAt: Date.now()
      };
    };

    s.finish = function () {
      var sum = s.summary();
      store.addSession({ mode: mode, startedAt: s.startedAt, endedAt: sum.endedAt, total: sum.total, correct: sum.correct,
                         topics: sum.byTopic, score: mode === 'exam' ? sum.correct : undefined, max: mode === 'exam' ? sum.total : undefined });
      return sum;
    };
    return s;
  }

  root.GeoSession = { create: create, topicMastery: topicMastery, topicNeed: topicNeed, EXAM_PLAN: EXAM_PLAN, ALL_TOPICS: ALL_TOPICS };
})(typeof window !== 'undefined' ? window : globalThis);
