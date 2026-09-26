/*
 * adaptive.js — the learning rules. No DOM, no storage.
 *
 *  - Leitner boxes 0…5 per concept ("hauptstaedte:sachsen", "fluesse:nidder" …).
 *    Wrong → box 0 and due again at once. Right → one box up, next due later.
 *  - Picking: a weighted lottery. Low boxes, overdue and unseen concepts get more tickets;
 *    mastered ones keep a few tickets so they are revisited now and then.
 *    Inside a session a concept rests for a few questions, and a mistake comes back
 *    after 3–6 other questions.
 *  - Mastery: recent answers count most (last 6, newest weighted highest), scaled by
 *    how much evidence there is. Shown rounded to 10 % — it is an estimate, not a grade.
 */
(function (root) {
  'use strict';

  var MIN = 60 * 1000, H = 60 * MIN, D = 24 * H;
  // The test is days away, not weeks: short intervals.
  var INTERVAL = [0, 3 * MIN, 30 * MIN, 6 * H, 1 * D, 3 * D];
  var BOX_WEIGHT = [9, 6, 4, 2.5, 1.2, 0.6];
  var UNSEEN_WEIGHT = 4;
  var RECENT_W = [1, 1.3, 1.7, 2.2, 2.9, 3.7];

  function update(s, ok, now) {
    if (ok) { s.box = Math.min(5, (s.box || 0) + 1); s.due = now + INTERVAL[s.box]; }
    else { s.box = 0; s.due = now; }
  }

  // sess: { asked: [key…] in order, wrong: {key: indexWhenWrong} }
  function weight(key, stat, tier, now, sess) {
    var w;
    if (!stat || !stat.seen) w = UNSEEN_WEIGHT;
    else {
      w = BOX_WEIGHT[stat.box || 0];
      if (stat.box >= 1 && stat.due <= now) w *= 1.5;
      if (stat.box >= 2 && stat.due > now) w *= 0.5;
      var wrongs = (stat.recent || []).filter(function (x) { return !x; }).length;
      if (wrongs >= 2) w *= 1.5;
    }
    if (tier === 'extra') w *= 0.5;
    if (sess) {
      var n = sess.asked.length, lastAt = sess.asked.lastIndexOf(key);
      if (lastAt >= 0 && n - lastAt <= 3) return 0;            // rest a little
      if (key in sess.wrong) {
        var since = n - sess.wrong[key];
        w *= since >= 3 ? 4 : 0;                                  // mistakes come back soon, not at once
      } else if (lastAt >= 0) w *= 0.3;                         // already done right this session
    }
    return w;
  }

  function mastery(stat) {
    if (!stat || !stat.seen) return 0;
    var r = stat.recent || [], off = RECENT_W.length - r.length, num = 0, den = 0;
    for (var i = 0; i < r.length; i++) { num += RECENT_W[off + i] * r[i]; den += RECENT_W[off + i]; }
    var acc = den ? num / den : 0;
    var evidence = Math.min(1, stat.seen / 3);
    return acc * (0.4 + 0.6 * evidence);
  }

  // items: [{key, tier}]  → {pct (rounded to 10), raw, seen, status}
  function topicMastery(items, getStat) {
    var num = 0, den = 0, seen = 0;
    items.forEach(function (it) {
      var w = it.tier === 'extra' ? 0.5 : 1, s = getStat(it.key);
      num += w * mastery(s); den += w;
      if (s && s.seen) seen++;
    });
    var raw = den ? num / den : 0;
    var pct = Math.round(raw * 10) * 10;
    var status = seen === 0 ? 'neu' : pct >= 80 ? 'kann' : pct >= 50 ? 'fast' : 'ueben';
    return { pct: pct, raw: raw, seen: seen, total: items.length, status: status };
  }

  var STATUS_TEXT = { neu: 'Noch nicht geübt', kann: 'Kannst du schon!', fast: 'Fast geschafft', ueben: 'Noch üben' };

  root.GeoAdaptive = {
    INTERVAL: INTERVAL, update: update, weight: weight, mastery: mastery, topicMastery: topicMastery,
    STATUS_TEXT: STATUS_TEXT
  };
})(typeof window !== 'undefined' ? window : globalThis);
