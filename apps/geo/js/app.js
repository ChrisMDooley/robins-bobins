/*
 * app.js — the shell: who is practising, header, router, HOME, ÜBEN menu, FORTSCHRITT,
 * and the link to Robin's Bobins (coins + activity). Loaded last.
 */
(function (root) {
  'use strict';
  var G = root.GEO, C = root.GEO_CONTENT, Q = root.GeoQuestions, U = root.GeoUI, A = root.GeoAdaptive, S = root.GeoSession;
  var h = U.h;
  var APP_ID = 'geo';

  // ------------------------------------------------------------ who
  var RB = root.RB || null;
  var child = RB ? RB.requireChild() : { id: 'alex', name: 'Alex' };   // standalone: Alex
  if (!child) return;
  var store = new GeoStore.Store(child.id);
  var TOPIC = {}; C.topics.forEach(function (t) { TOPIC[t.id] = t; });

  var main = document.getElementById('main');
  var coinsEl = document.getElementById('coins');
  var backBtn = document.getElementById('back');
  var homeLink = document.getElementById('apps-link');
  if (RB) { homeLink.href = RB.nav.homeUrl(child.id); } else { homeLink.hidden = true; document.getElementById('coin-pill').hidden = true; }

  function showCoins() { if (RB) coinsEl.textContent = RB.coins.balance(child.id); }
  showCoins();

  function robin(pose, size) {
    if (RB && RB.robin) return RB.robin.el(pose, size);
    return h('span', { 'class': 'robin', text: '🐕' });
  }

  // ------------------------------------------------------------ coins + activity
  var sessionCoins = 0;
  function coinTick(anchor) { sessionCoins++; U.coinFloat(anchor, 1); }
  // Effort pays: 1 per right answer, + a finishing bonus. Nothing is ever taken away.
  function reward(sum, mode, kind) {
    var bonus = { '5min': 5, exam: 8, practice: 3, game: 3 }[mode] || 3;
    var amount = (mode === 'exam' || mode === 'game' ? sum.correct : sessionCoins) + (sum.total ? bonus : 0);
    sessionCoins = 0;
    if (!sum.total) return 0;
    if (RB) {
      RB.coins.add(child.id, { amount: amount, reason: { '5min': '5 Minuten geübt', exam: 'Probe-Prüfung geschafft', practice: 'Runde geübt', game: 'Spiel geschafft' }[mode] || 'Geübt', app: APP_ID });
      RB.activity.record(child.id, { app: APP_ID, kind: 'session', startedAt: sum.startedAt || Date.now(), endedAt: sum.endedAt || Date.now(),
                                     summary: { mode: kind || mode, answered: sum.total, correct: sum.correct } });
      showCoins();
    }
    if (mode === 'game') store.addSession({ mode: kind || 'game', startedAt: sum.startedAt, endedAt: sum.endedAt, total: sum.total, correct: sum.correct });
    return amount;
  }

  // ------------------------------------------------------------ view + router
  var onLeave = null, overlay = false, roundFrom = 'home';
  function route() { return (location.hash || '').replace(/^#\/?/, '') || 'home'; }
  function setView(node, opts) {
    opts = opts || {};
    overlay = !!opts.overlay;
    if (onLeave) { try { onLeave(); } catch (e) { /* ignore */ } }
    onLeave = opts.onBack || null;
    main.innerHTML = '';
    main.appendChild(node);
    backBtn.hidden = !opts.back;
    window.scrollTo(0, 0);
    node.classList.add('enter');
  }
  function go(route) {
    if (location.hash !== '#/' + route) location.hash = '#/' + route;
    else render();
  }
  backBtn.addEventListener('click', function () {
    var r = route();
    if (r === 'runde') { current = null; return go(roundFrom); }
    if (overlay) return render();                 // a game on top of a menu → back to that menu
    if (r.indexOf('lernen/') === 0) return go('lernen');
    go('home');
  });

  function render() {
    var r = (location.hash || '').replace(/^#\/?/, '') || 'home';
    var parts = r.split('/');
    if (parts[0] === 'lernen' && parts[1] && GeoLearn[parts[1]]) return GeoLearn[parts[1]](app);
    if (parts[0] === 'lernen') return GeoLearn.menu(app);
    if (parts[0] === 'ueben') return uebenMenu();
    if (parts[0] === 'fortschritt') return progressView();
    if (parts[0] === 'runde' && current) return;             // a round is running
    return home();
  }
  window.addEventListener('hashchange', render);

  // ------------------------------------------------------------ rounds
  var current = null;
  function startRound(session, title, practiceOpts) {
    sessionCoins = 0;
    current = session;
    if (route() !== 'runde') { roundFrom = route(); history.pushState(null, '', '#/runde'); }
    GeoQuiz.run(app, session, { title: title, practiceOpts: practiceOpts, onEnd: function () { current = null; } });
  }
  function startPractice(topics, title, o) {
    o = o || {};
    startRound(S.create(store, { mode: 'practice', topics: topics, limit: o.limit || 10, allow: o.allow, forbid: o.forbid }), title || 'Üben', o);
  }
  function startFive() { startRound(S.create(store, { mode: '5min' }), '⏱ 5 Minuten'); }
  function startExam() { startRound(S.create(store, { mode: 'exam' }), '📝 Probe-Lernzielkontrolle'); }

  // ------------------------------------------------------------ HOME
  function countdown() {
    var d = U.daysUntil(C.testDate);
    if (d > 1) return 'Noch ' + d + ' Tage bis zur Lernzielkontrolle';
    if (d === 1) return 'Morgen ist die Lernzielkontrolle – du schaffst das!';
    if (d === 0) return 'Heute ist die Lernzielkontrolle. Viel Glück!';
    return null;
  }
  function overall() {
    var tot = 0, n = 0;
    C.topics.forEach(function (t) { tot += S.topicMastery(store, t.id).raw; n++; });
    return Math.round(tot / n * 10) * 10;
  }
  function answeredToday() {
    var k = new Date().toDateString();
    return store.doc.answers.filter(function (a) { return new Date(a.ts).toDateString() === k; }).length;
  }

  function home() {
    var cd = countdown(), today = answeredToday();
    var line = today ? 'Heute schon ' + today + ' Fragen geübt. Weiter so!' : cd ? 'Mach einmal deine 5 Minuten!' : 'Los geht\'s!';
    var v = h('section', { 'class': 'home-geo' }, [
      h('div', { 'class': 'hero' }, [robin(today ? 'happy' : 'normal', 110), h('div', { 'class': 'hero-text' }, [
        h('h1', { text: 'Hallo ' + child.name + '!' }),
        h('p', { 'class': 'rb-bubble', text: line }),
        cd ? h('p', { 'class': 'countdown', text: '📅 ' + cd }) : null])]),
      h('div', { 'class': 'main-menu' }, [
        bigBtn('lernen', '📖', 'LERNEN', 'Karten ansehen und entdecken', function () { go('lernen'); }),
        bigBtn('ueben', '✏️', 'ÜBEN', 'Ein Thema auswählen', function () { go('ueben'); }),
        bigBtn('fuenf', '⏱', '5 MINUTEN ÜBEN', 'Ein Klick – los geht\'s! Robin sucht aus, was du noch üben solltest.', startFive),
        bigBtn('pruefung', '📝', 'PRÜFUNG ÜBEN', '18 Aufgaben wie in der Lernzielkontrolle', startExam),
        bigBtn('fortschritt', '📊', 'FORTSCHRITT', 'Was kann ich schon? (' + overall() + ' %)', function () { go('fortschritt'); })
      ])
    ]);
    setView(v, { back: false });
  }
  function bigBtn(id, icon, title, sub, fn) {
    return h('button', { 'class': 'menu-btn mb-' + id, type: 'button', 'data-menu': id, onclick: fn }, [
      h('span', { 'class': 'mb-icon', 'aria-hidden': 'true', text: icon }),
      h('span', { 'class': 'mb-text' }, [h('span', { 'class': 'mb-title', text: title }), h('span', { 'class': 'mb-sub', text: sub })])]);
  }

  // ------------------------------------------------------------ ÜBEN
  function uebenMenu() {
    var v = h('section', { 'class': 'menu' }, [h('h1', { 'class': 'screen-h', text: '✏️ Üben' }),
      h('p', { 'class': 'screen-sub', text: 'Wähle ein Thema. Was du noch nicht so gut kannst, kommt öfter dran.' })]);
    var groups = [
      ['Deutschland', ['laender', 'hauptstaedte', 'wappen', 'nachbarn']],
      ['Hessen', ['staedte', 'fluesse', 'gebirge']],
      ['Kartenkunde', ['legende', 'planquadrate', 'richtungen']]
    ];
    groups.forEach(function (g) {
      v.appendChild(h('h2', { 'class': 'group-h', text: g[0] }));
      if (g[0] === 'Hessen') {
        v.appendChild(h('div', { 'class': 'quick-row' }, [
          quick('🏙 Städte', function () { startPractice(['staedte'], 'Hessen – Städte'); }),
          quick('🌊 Flüsse', function () { startPractice(['fluesse'], 'Hessen – Flüsse'); }),
          quick('⛰ Gebirge', function () { startPractice(['gebirge'], 'Hessen – Gebirge'); }),
          quick('🗺 Alles zusammen', function () { startPractice(['staedte', 'fluesse', 'gebirge'], 'Hessen – alles zusammen', { limit: 12 }); }),
          quick('📍 Zeig es auf der Karte', function () { startPractice(['staedte', 'fluesse', 'gebirge'], 'Zeig es auf der Karte', { allow: ['mapClick'], limit: 10 }); })
        ]));
      }
      var grid = h('div', { 'class': 'topic-grid' });
      g[1].forEach(function (tid) {
        var t = TOPIC[tid], m = S.topicMastery(store, tid);
        grid.appendChild(h('button', { 'class': 'topic-card st-' + m.status, type: 'button', 'data-topic': tid, onclick: function () { startPractice([tid], t.title); } }, [
          h('span', { 'class': 'tc-icon', text: t.icon }), h('span', { 'class': 'tc-title', text: t.title.replace('Hessen – ', '').replace('Kartenkunde – ', '') }),
          U.bar(m.pct), h('span', { 'class': 'tc-status', text: A.STATUS_TEXT[m.status] })]));
      });
      v.appendChild(grid);
    });
    v.appendChild(h('h2', { 'class': 'group-h', text: 'Spiele' }));
    v.appendChild(h('div', { 'class': 'quick-row' }, [
      quick('🔗 Land ↔ Hauptstadt', function () { GeoGames.match(app, 'hauptstaedte'); }),
      quick('🔗 Wappen ↔ Land', function () { GeoGames.match(app, 'wappen'); }),
      quick('🔗 Wappen ↔ Land ↔ Hauptstadt', function () { GeoGames.match(app, 'wappen3'); }),
      quick('✋ Länder auf die Karte', function () { GeoGames.mapDrag(app, 'laender'); }),
      quick('✋ Hauptstädte auf die Karte', function () { GeoGames.mapDrag(app, 'hauptstaedte'); }),
      quick('✋ Nachbarländer auf die Karte', function () { GeoGames.mapDrag(app, 'nachbarn'); }),
      quick('✋ Flüsse beschriften', function () { GeoGames.mapDrag(app, 'fluesse'); }),
      quick('✋ Städte beschriften', function () { GeoGames.mapDrag(app, 'staedte'); }),
      quick('✋ Gebirge beschriften', function () { GeoGames.mapDrag(app, 'gebirge'); })
    ]));
    setView(v, { back: true });
  }
  function quick(label, fn) { return h('button', { 'class': 'quick', type: 'button', text: label, onclick: fn }); }

  // ------------------------------------------------------------ FORTSCHRITT
  function itemLabel(key) {
    var p = key.split(':'), t = p[0], id = p[1];
    try {
      if (t === 'laender') return Q.STATE[id].name + ' auf der Karte';
      if (t === 'hauptstaedte') return Q.STATE[id].name + ' – ' + Q.STATE[id].capital;
      if (t === 'wappen') return 'Wappen von ' + Q.STATE[id].name;
      if (t === 'nachbarn') return id === 'unterscheiden' ? 'Nachbarland oder nicht?' : Q.COUNTRY[id].name;
      if (t === 'staedte') return Q.tname(Q.TOWN[id]);
      if (t === 'fluesse') return Q.RIVER[id].name;
      if (t === 'gebirge') return Q.MOUNT[id].name;
      if (t === 'legende') return 'Zeichen: ' + Q.LEG[id].name;
      if (t === 'planquadrate') return { lesen: 'Planquadrat ablesen', finden: 'Planquadrat finden', was: 'Was liegt im Planquadrat?' }[id];
      if (t === 'richtungen') return { oben: 'Norden ist oben', windrose: 'Windrose', 'nord-von': 'Was liegt nördlich …?', 'richtung-von': 'In welche Richtung …?', hessen: 'Richtungen von Wehrheim aus' }[id];
    } catch (e) { /* fallthrough */ }
    return key;
  }

  function progressView() {
    var tot = store.totals(), cd = countdown();
    var ms = C.topics.map(function (t) { return { t: t, m: S.topicMastery(store, t.id) }; });
    var mastered = ms.filter(function (x) { return x.m.status === 'kann'; }).length;
    var v = h('section', { 'class': 'progress-view' }, [h('h1', { 'class': 'screen-h', text: '📊 Mein Fortschritt' }),
      cd ? h('p', { 'class': 'countdown', text: '📅 ' + cd }) : null,
      h('div', { 'class': 'p-stats' }, [
        pstat(tot.answered, 'Fragen beantwortet'), pstat(tot.correct, 'richtig'), pstat(mastered + ' / ' + C.topics.length, 'Themen gemeistert')])]);
    var list = h('div', { 'class': 'p-list' });
    ms.forEach(function (x) {
      list.appendChild(h('button', { 'class': 'p-row st-' + x.m.status, type: 'button', 'data-topic': x.t.id, onclick: function () { startPractice([x.t.id], x.t.title); } }, [
        h('span', { 'class': 'p-name', text: x.t.icon + ' ' + x.t.title }), U.bar(x.m.pct),
        h('span', { 'class': 'p-pct', text: x.m.seen ? 'ca. ' + x.m.pct + ' %' : '–' }),
        h('span', { 'class': 'p-status', text: A.STATUS_TEXT[x.m.status] })]));
    });
    v.appendChild(list);
    v.appendChild(h('p', { 'class': 'help', text: 'Die Prozente sind eine Schätzung. Die letzten Antworten zählen am meisten.' }));

    // What keeps going wrong
    var trouble = Object.keys(store.doc.items).map(function (k) { return { k: k, s: store.doc.items[k] }; })
      .filter(function (x) { return (x.s.recent || []).some(function (r) { return !r; }) && A.mastery(x.s) < 0.7; })
      .sort(function (a, b) { return A.mastery(a.s) - A.mastery(b.s); }).slice(0, 6);
    if (trouble.length) {
      v.appendChild(h('div', { 'class': 'trouble' }, [h('h2', { text: 'Das kommt bald noch einmal dran:' }),
        h('ul', {}, trouble.map(function (x) { return h('li', { text: itemLabel(x.k) }); }))]));
    }
    var exams = store.doc.sessions.filter(function (s) { return s.mode === 'exam'; }).slice(-5).reverse();
    if (exams.length) {
      v.appendChild(h('div', { 'class': 'exams' }, [h('h2', { text: 'Probe-Prüfungen' }),
        h('ul', {}, exams.map(function (e) {
          return h('li', { text: new Date(e.endedAt).toLocaleDateString('de-DE', { weekday: 'short', day: 'numeric', month: 'numeric' }) + ': ' + e.score + ' von ' + e.max + ' Punkten' });
        }))]));
    }
    var reset = h('details', { 'class': 'parent-reset' }, [h('summary', { text: 'Für Eltern' }),
      h('p', { 'class': 'help', text: 'Löscht nur den Lernstand dieser App. Robin-Münzen bleiben erhalten.' }),
      h('button', { 'class': 'rb-btn rb-btn-soft small', type: 'button', text: 'Lernstand zurücksetzen', onclick: function () {
        if (confirm('Lernstand von ' + child.name + ' in dieser App wirklich löschen?')) { store.reset(); progressView(); }
      } })]);
    v.appendChild(reset);
    setView(v, { back: true });
  }
  function pstat(n, label) { return h('div', { 'class': 'p-stat' }, [h('b', { text: String(n) }), h('span', { text: label })]); }

  var app = {
    child: child, store: store, setView: setView, go: go, robin: robin, reward: reward, coinTick: coinTick,
    startPractice: startPractice, startFive: startFive, startExam: startExam, itemLabel: itemLabel
  };
  root.GeoApp = app;
  if (location.hash === '#/runde') history.replaceState(null, '', '#/home');
  render();
})(typeof window !== 'undefined' ? window : globalThis);
