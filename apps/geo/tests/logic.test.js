/* Logic tests for the Geo app (no browser):  node apps/geo/tests/logic.test.js */
'use strict';
global.window = global;
var path = require('path'), D = path.join(__dirname, '..');
['data/content.js', 'data/maps.js', 'js/geo.js', 'js/kartenkunde.js', 'js/questions.js', 'js/adaptive.js', 'js/store.js', 'js/session.js']
  .forEach(function (f) { require(path.join(D, f)); });

var G = GEO, C = GEO_CONTENT, Q = GeoQuestions, A = GeoAdaptive, S = GeoSession, M = GEO_MAPS;
var fails = 0, passes = 0;
function ok(cond, msg) { if (cond) passes++; else { fails++; console.log('FAIL', msg); } }

// ---- every item of every topic yields questions; options are sane ----
var formats = {};
C.topics.forEach(function (t) {
  Q.topicItems(t.id).forEach(function (it) {
    var made = 0;
    for (var i = 0; i < 40; i++) {
      var q = Q.make(t.id, it.id, { stat: { box: 3, seen: 5 } });
      if (!q) continue;
      made++;
      formats[q.format] = (formats[q.format] || 0) + 1;
      ok(q.prompt && q.prompt.length > 5, t.id + ':' + it.id + ' prompt');
      ok(typeof q.wrong === 'function' && typeof q.right === 'string', it.id + ' feedback');
      if (q.format === 'choice') {
        var vals = q.options.map(function (o) { return o.value; });
        ok(vals.indexOf(q.answer) >= 0, t.id + ':' + it.id + ' (' + q.gen + ') answer in options');
        ok(new Set(vals).size === vals.length, t.id + ':' + it.id + ' (' + q.gen + ') options unique ' + vals);
        ok(vals.length >= 3, t.id + ':' + it.id + ' (' + q.gen + ') has ≥3 options');
        var labels = q.options.map(function (o) { return o.label; });
        ok(new Set(labels).size === labels.length, t.id + ':' + it.id + ' (' + q.gen + ') labels unique ' + labels);
        ok(typeof q.wrong(vals.filter(function (v) { return v !== q.answer; })[0]) === 'string', it.id + ' wrong() text');
      }
      if (q.format === 'mapClick' || q.format === 'mapDrag') {
        var m = M[q.visual.map], all = [];
        if (q.visual.map === 'germany') all = m.states.map(function (x) { return x.id; });
        if (q.visual.map === 'europe') all = m.countries.map(function (x) { return x.id; });
        if (q.visual.map === 'hessen') all = m.rivers.map(function (x) { return x.id; }).concat(m.regions.map(function (x) { return x.id; }))
          .concat(C.towns.map(function (x) { return 'town-' + x.id; }));
        ok(all.indexOf(q.answer) >= 0, 'map target exists: ' + q.answer);
      }
      if (q.format === 'cellClick') ok(/^[A-E][1-5]$/.test(q.answer), 'cell answer ' + q.answer);
    }
    ok(made > 0, 'no question at all for ' + t.id + ':' + it.id);
  });
});
console.log('formats generated:', JSON.stringify(formats));

// ---- specific facts the prompt insists on ----
function find(topic, item, gen) {
  for (var i = 0; i < 200; i++) { var q = Q.make(topic, item, { stat: { box: 3, seen: 5 } }); if (q && q.gen === gen) return q; }
  return null;
}
var q1 = find('hauptstaedte', 'hessen', 'capChoice');
ok(q1 && q1.answer === 'Wiesbaden' && /Wiesbaden/.test(q1.wrong('Frankfurt am Main')), 'Hessen → Wiesbaden');
var q2 = find('fluesse', 'nidder', 'intoRiver');
ok(q2 && q2.answer === 'nidda', 'Nidder → Nidda');
ok(/Nidder → Nidda → Main → Rhein/.test(q2.wrong('main')), 'chain shown: ' + q2.wrong('main'));
var q3 = find('gebirge', 'taunus', 'special');
ok(q3 && /Wehrheim/.test(q3.prompt) && q3.answer === 'taunus', 'Wehrheim → Taunus');
var q4 = find('hauptstaedte', 'sachsen', 'capChoice');
ok(q4 && /Sachsen-Anhalt/.test(q4.wrong('Magdeburg')), 'Magdeburg mix-up explained: ' + q4.wrong('Magdeburg'));
ok(Q.check({ format: 'type', answer: 'München' }, 'muenchen'), 'typed Muenchen accepted');
ok(Q.check({ format: 'type', answer: 'Düsseldorf' }, 'Dusseldorf'), 'typed Dusseldorf accepted (1 slip)');
ok(!Q.check({ format: 'type', answer: 'Mainz' }, 'Main'), 'Main ≠ Mainz');

// ---- directions from Wehrheim: every generated statement must hold with margin ----
var home = Q.TOWN.wehrheim;
for (var i = 0; i < 300; i++) {
  var t = G.pick(C.towns.filter(function (x) { return !x.home; }));
  var q = Q.make('staedte', t.id, { stat: { box: 1, seen: 1 } });
  if (!q || q.gen !== 'fromWehrheim') continue;
  var ans = Q.TOWN[q.answer], dir = G.DIR8.filter(function (d) { return q.prompt.indexOf(' ' + d.adj + ' ') >= 0; })[0];
  ok(G.angleDiff(G.bearing(home.lonLat, ans.lonLat), dir.deg) <= (dir.id.length === 1 ? 30 : 12), 'answer direction ok ' + q.prompt);
  q.options.forEach(function (o) {
    if (o.value !== q.answer) ok(G.angleDiff(G.bearing(home.lonLat, Q.TOWN[o.value].lonLat), dir.deg) > 60, 'distractor clearly not ' + dir.adj + ': ' + o.label);
  });
}
var fr = G.clearDirection(G.bearing(home.lonLat, Q.TOWN.frankfurt.lonLat));
ok(fr && fr.id === 'S', 'Frankfurt is south of Wehrheim (' + (fr && fr.id) + ')');
var ha = G.clearDirection(G.bearing(home.lonLat, Q.TOWN.hanau.lonLat));
ok(ha && ha.id === 'SO', 'Hanau is south-east of Wehrheim (' + (ha && ha.id) + ')');

// ---- Kartenkunde scenes: distinct cells, grid direction logic ----
for (var k = 0; k < 200; k++) {
  var sc = GeoKarte.makeScene();
  var cells = sc.objects.map(function (o) { return o.cell; });
  ok(new Set(cells).size === cells.length, 'scene objects in distinct cells');
  ok(sc.objects.length === 7, 'scene has all objects');
}
for (var j = 0; j < 200; j++) {
  var qn = Q.make('richtungen', 'nord-von', {});
  if (!qn) continue;
  var sc2 = qn.visual.scene, a = sc2.obj[qn.visual.mark], b = sc2.obj[qn.answer];
  var dirId = { 'nördlich': 'N', 'südlich': 'S', 'östlich': 'O', 'westlich': 'W' }[qn.prompt.split(' ')[2]];
  ok(GeoKarte.gridDirection(a, b) === dirId, 'nord-von answer correct ' + qn.prompt);
  qn.options.forEach(function (o) { if (o.value !== qn.answer) ok(!GeoKarte.anyNorthish(a, sc2.obj[o.value], dirId), 'nord-von distractor wrong'); });
}

// ---- adaptive: mistakes come back more, mastered items less ----
var store = new GeoStore.Store('test', { read: function () { return null; }, write: function () {} });
var now = Date.now();
store.answer({ topic: 'hauptstaedte', item: 'hessen', ok: true }, A.update, now);
store.answer({ topic: 'hauptstaedte', item: 'hessen', ok: true }, A.update, now);
store.answer({ topic: 'hauptstaedte', item: 'hessen', ok: true }, A.update, now);
store.answer({ topic: 'hauptstaedte', item: 'hessen', ok: true }, A.update, now);
store.answer({ topic: 'hauptstaedte', item: 'sachsen', ok: false }, A.update, now);
store.answer({ topic: 'hauptstaedte', item: 'sachsen', ok: false }, A.update, now);
var wH = A.weight('hauptstaedte:hessen', store.stat('hauptstaedte:hessen'), 'core', now + 1000, null);
var wS = A.weight('hauptstaedte:sachsen', store.stat('hauptstaedte:sachsen'), 'core', now + 1000, null);
var wN = A.weight('hauptstaedte:bayern', null, 'core', now + 1000, null);
ok(wS > wN && wN > wH && wH > 0, 'weights: wrong ' + wS + ' > unseen ' + wN + ' > mastered ' + wH + ' > 0');
ok(A.mastery(store.stat('hauptstaedte:hessen')) > 0.9, 'mastery high after 4 right');
ok(A.mastery(store.stat('hauptstaedte:sachsen')) === 0, 'mastery 0 after wrongs');

// In-session: a mistake rests 2 questions, then comes back strongly
var sess = { asked: ['hauptstaedte:sachsen'], wrong: { 'hauptstaedte:sachsen': 1 } };
ok(A.weight('hauptstaedte:sachsen', store.stat('hauptstaedte:sachsen'), 'core', now, sess) === 0, 'mistake rests first');
sess.asked.push('a', 'b', 'c');
ok(A.weight('hauptstaedte:sachsen', store.stat('hauptstaedte:sachsen'), 'core', now, sess) > wS, 'mistake returns boosted');

// ---- 5 Minuten focuses on the weak topic ----
var st2 = new GeoStore.Store('t2', { read: function () { return null; }, write: function () {} });
GeoSession.ALL_TOPICS.forEach(function (tp) {
  Q.topicItems(tp).forEach(function (it) {
    for (var r = 0; r < 4; r++) st2.answer({ topic: tp, item: it.id, ok: tp !== 'fluesse' }, A.update, now - 3600e3);
  });
});
var counts = {};
G.setSeed(42);
for (var rnd = 0; rnd < 10; rnd++) {
  var s5 = GeoSession.create(st2, { mode: '5min' });
  for (var n = 0; n < 15; n++) { var qq = s5.next(); if (!qq) break; counts[qq.topic] = (counts[qq.topic] || 0) + 1; s5.asked.push(qq.key); }
}
G.setSeed(null);
var fl = counts.fluesse || 0, others = Object.keys(counts).filter(function (k) { return k !== 'fluesse'; }).map(function (k) { return counts[k]; });
ok(fl > Math.max.apply(null, others) * 2, '5 Minuten prefers weak topic: ' + JSON.stringify(counts));

// ---- mock test plan ----
var ex = GeoSession.create(new GeoStore.Store('t3', { read: function () { return null; }, write: function () {} }), { mode: 'exam' });
ok(ex.limit === 18, 'exam has 18 questions (' + ex.limit + ')');
var tcount = {}; ex.examQueue.forEach(function (x) { tcount[x.topic] = (tcount[x.topic] || 0) + 1; ok(x.exam !== false && ['type', 'mapDrag', 'mapSeq'].indexOf(x.format) < 0, 'exam format ok'); });
ok(Object.keys(tcount).length === 10, 'exam covers all 10 topics ' + JSON.stringify(tcount));

// ---- mastery display rounded to 10 ----
var tm = A.topicMastery(Q.topicItems('hauptstaedte'), function (key) { return store.stat(key); });
ok(tm.pct % 10 === 0, 'pct rounded ' + tm.pct);

console.log(passes + ' passed, ' + fails + ' failed');
process.exit(fails ? 1 : 0);
