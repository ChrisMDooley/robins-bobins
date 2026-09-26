/*
 * quiz.js — shows one question at a time, checks answers, gives feedback,
 * and draws the end screens (practice, 5 Minuten, Prüfung).
 */
(function (root) {
  'use strict';
  var G = root.GEO, C = root.GEO_CONTENT, Q = root.GeoQuestions, U = root.GeoUI, K = root.GeoKarte;
  var h = U.h;

  var TOPIC = {}; C.topics.forEach(function (t) { TOPIC[t.id] = t; });
  var PRAISE = ['Richtig!', 'Super!', 'Genau!', 'Klasse!', 'Stimmt!', 'Prima!'];
  var SOFT = ['Fast!', 'Nicht ganz.', 'Knapp daneben.', 'Das war knifflig.'];

  // ------------------------------------------------------------ visuals
  function buildVisual(q, interactive) {
    var v = q.visual || {}, out = { el: null, map: null, scene: null };
    if (v.map) {
      var m = GeoMap.create(v.map, { layers: v.layers || {}, anchor: v.anchor, compass: v.compass, plainHome: v.plainHome,
                                      pick: interactive ? (v.pick || null) : null, capitals: v.capitals, neutral: true });
      if (v.highlight) m.highlight(v.highlight);
      if (v.anchor) m.showLabel('town-wehrheim', true);
      if (v.layers && v.layers.labels) Object.keys(m.labels).forEach(function (id) { if (id.indexOf('town-') === 0) m.showLabel(id, true); });
      if (v.highlight && v.highlight.length && (v.highlight[0].indexOf('town-') === 0) && q.format !== 'choice') {
        v.highlight.forEach(function (id) { m.showLabel(id, true); });
      }
      out.el = m.el; out.map = m;
    } else if (v.wappen) {
      out.el = h('div', { 'class': 'vis-wappen' }, [U.wappenImg(v.wappen, 'big')]);
    } else if (v.symbol) {
      out.el = h('div', { 'class': 'vis-symbol' }, [U.symbol(v.symbol, 120)]);
    } else if (v.scene) {
      var sv = U.sceneView(v.scene, { legend: v.legend, grid: v.grid, compass: v.compass, mark: v.mark, cells: q.format === 'cellClick' });
      out.el = sv.el; out.scene = sv;
    } else if (v.rose) {
      out.el = U.roseView({ labels: v.roseLabels !== false, showN: v.roseN });
    }
    if (out.el) out.el.classList.add('q-visual');
    return out;
  }

  // ------------------------------------------------------------ runner
  // opts: { title, onEnd(summary), exam }
  function run(app, session, opts) {
    opts = opts || {};
    var exam = session.mode === 'exam';
    var timerId = null;
    var screen = h('section', { 'class': 'quiz' + (exam ? ' is-exam' : '') });
    app.setView(screen, { back: true, overlay: true, onBack: function () { stopTimer(); } });

    var head = h('div', { 'class': 'quiz-head' });
    var titleEl = h('div', { 'class': 'quiz-title', text: opts.title || '' });
    var countEl = h('div', { 'class': 'quiz-count' });
    var timeEl = h('div', { 'class': 'quiz-time', hidden: !session.timeLimitMs });
    var progress = h('div', { 'class': 'quiz-progress' }, [h('div', { 'class': 'quiz-progress-fill' })]);
    head.appendChild(h('div', { 'class': 'quiz-head-row' }, [titleEl, h('div', { 'class': 'quiz-meta' }, [timeEl, countEl])]));
    head.appendChild(progress);
    screen.appendChild(head);
    var body = h('div', { 'class': 'quiz-body' });
    screen.appendChild(body);

    function stopTimer() { if (timerId) clearInterval(timerId); timerId = null; }
    if (session.timeLimitMs) {
      timerId = setInterval(function () {
        if (!document.body.contains(screen)) { stopTimer(); return; }
        var left = Math.max(0, session.timeLimitMs - (Date.now() - session.startedAt));
        var m = Math.floor(left / 60000), s = Math.floor(left / 1000) % 60;
        timeEl.textContent = left > 0 ? '⏱ ' + m + ':' + (s < 10 ? '0' : '') + s : '⏱ Letzte Frage!';
        timeEl.classList.toggle('is-low', left < 30000);
      }, 500);
    }

    var examAnswers = [];

    function showCount() {
      var n = session.asked.length + 1;
      if (exam) countEl.textContent = 'Aufgabe ' + Math.min(n, session.limit) + ' von ' + session.limit;
      else if (session.timeLimitMs) countEl.textContent = session.results.filter(function (r) { return r.ok; }).length + ' ✓';
      else countEl.textContent = Math.min(n, session.limit) + ' / ' + session.limit;
      var frac = session.timeLimitMs ? Math.min(1, (Date.now() - session.startedAt) / session.timeLimitMs)
                                     : session.asked.length / session.limit;
      progress.firstChild.style.width = Math.round(frac * 100) + '%';
    }

    function next() {
      var q = session.next();
      if (!q) { stopTimer(); return end(); }
      showCount();
      renderQuestion(q);
    }

    function renderQuestion(q) {
      body.innerHTML = '';
      var card = h('div', { 'class': 'q-card', 'data-format': q.format, 'data-topic': q.topic });
      var topicChip = h('span', { 'class': 'q-topic', text: TOPIC[q.topic].icon + ' ' + TOPIC[q.topic].title });
      card.appendChild(topicChip);
      card.appendChild(h('h2', { 'class': 'q-prompt', text: q.prompt }));
      if (q.sub) card.appendChild(h('p', { 'class': 'q-sub', text: q.sub }));
      var vis = buildVisual(q, true);
      var answerBox = h('div', { 'class': 'q-answers' });
      var feedback = h('div', { 'class': 'q-feedback', 'aria-live': 'polite', hidden: true });
      var layout = h('div', { 'class': 'q-layout' + (vis.el ? ' has-visual' : '') + (vis.map ? ' has-map' : '') });
      if (vis.el) layout.appendChild(vis.el);
      layout.appendChild(answerBox);
      card.appendChild(layout);
      body.appendChild(card);
      // Next to a map, feedback sits in the side column so it is seen without scrolling (placed after the answer widgets below).
      root.__geoTest = { q: q, map: vis.map, scene: vis.scene };   // read by the browser tests
      var answered = false, pending = null;

      function finish(given, extra) {
        if (answered) return;
        var ok = Q.check(q, given);
        if (exam) {
          answered = true;
          examAnswers.push({ q: q, given: given, ok: ok });
          session.record(q, ok, given);
          setTimeout(next, 150);
          return;
        }
        answered = true;
        session.record(q, ok, given);
        card.classList.add(ok ? 'is-right' : 'is-wrong');
        showFeedback(ok, given, extra);
      }

      // Exam: pick first, confirm with "Weiter" (can change mind before that).
      var confirmBtn = null;
      function choose(given, showChosen) {
        if (!exam) return finish(given);
        pending = given;
        if (showChosen) showChosen();
        if (!confirmBtn) {
          confirmBtn = h('button', { 'class': 'rb-btn q-next', type: 'button', text: 'Weiter ›', onclick: function () { finish(pending); } });
          body.appendChild(h('div', { 'class': 'q-actions' }, [confirmBtn]));
        }
      }

      function showFeedback(ok, given, extra) {
        feedback.hidden = false;
        feedback.className = 'q-feedback ' + (ok ? 'ok' : 'no');
        var msg;
        if (ok) {
          msg = q.format === 'type' && G.matchTyped(given, q.answer) === 'close'
            ? 'Richtig! Achte auf die Schreibweise: ' + q.answer + '.' : q.right;
          if (msg.indexOf('Richtig!') === 0) msg = G.pick(PRAISE) + msg.slice(8);
        } else {
          msg = q.wrong(given);
          if (!/^Fast/.test(msg)) msg = G.pick(SOFT) + ' ' + msg;
        }
        feedback.innerHTML = '';
        feedback.appendChild(h('div', { 'class': 'fb-icon', 'aria-hidden': 'true', text: ok ? '✓' : '↻' }));
        feedback.appendChild(h('div', { 'class': 'fb-text', text: msg }));
        var btn = h('button', { 'class': 'rb-btn fb-next', type: 'button', text: session.done() ? 'Fertig ›' : 'Weiter ›', onclick: next });
        feedback.appendChild(btn);
        if (ok) { app.coinTick(btn); }
        // reveal on the map / scene
        if (vis.map) {
          if (q.reveal) { vis.map.mark(q.reveal, ok ? 'right' : 'reveal'); vis.map.showLabel(q.reveal, true); }
          (q.targets || []).forEach(function (t) { vis.map.mark(t, 'reveal'); vis.map.showLabel(t, true); });
        }
        if (vis.scene && (q.revealCell || q.format === 'cellClick')) U.markCell(vis.scene.svg, q.revealCell || q.answer, 'is-reveal');
        setTimeout(function () { btn.focus({ preventScroll: true }); }, 50);
        feedback.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      }

      // ---------------- formats ----------------
      if (q.format === 'choice') {
        var grid = h('div', { 'class': 'options' + (q.imageOptions ? ' options-img' : '') });
        q.options.forEach(function (o) {
          var content = o.img ? [U.wappenImg(o.img)] : o.symbol ? [U.symbol(o.symbol, 64)] : [h('span', { text: o.label })];
          var b = h('button', { 'class': 'opt', type: 'button', 'data-value': o.value, 'aria-label': o.img || o.symbol ? 'Bild ' + (q.options.indexOf(o) + 1) : o.label }, content);
          b.addEventListener('click', function () {
            if (answered) return;
            if (exam) {
              choose(o.value, function () {
                grid.querySelectorAll('.opt').forEach(function (x) { x.classList.remove('is-chosen'); });
                b.classList.add('is-chosen');
              });
              return;
            }
            var ok = Q.check(q, o.value);
            grid.querySelectorAll('.opt').forEach(function (x) {
              x.disabled = true;
              if (x.getAttribute('data-value') === String(q.answer)) x.classList.add('is-right');
            });
            if (!ok) b.classList.add('is-wrong');
            finish(o.value);
          });
          grid.appendChild(b);
        });
        answerBox.appendChild(grid);
      }

      if (q.format === 'type') {
        var inp = h('input', { 'class': 'type-in', type: 'text', autocomplete: 'off', autocapitalize: 'words', spellcheck: 'false',
                               'aria-label': 'Deine Antwort', placeholder: 'Hauptstadt …' });
        var go = h('button', { 'class': 'rb-btn', type: 'button', text: 'Prüfen' });
        var submit = function () {
          if (answered || !inp.value.trim()) { inp.focus(); return; }
          inp.disabled = true; go.disabled = true;
          var ok = Q.check(q, inp.value);
          inp.classList.add(ok ? 'is-right' : 'is-wrong');
          if (exam) return choose(inp.value);
          finish(inp.value);
        };
        go.addEventListener('click', submit);
        inp.addEventListener('keydown', function (e) { if (e.key === 'Enter') submit(); });
        answerBox.appendChild(h('div', { 'class': 'type-row' }, [inp, go]));
        setTimeout(function () { inp.focus(); }, 60);
      }

      if (q.format === 'mapClick' || q.format === 'mapSeq') {
        var hint = h('p', { 'class': 'map-hint', 'aria-live': 'polite' });
        answerBox.appendChild(hint);
        var step = 0, seqOk = true;
        if (q.format === 'mapSeq') hint.textContent = '1. Tippe auf ' + q.stepLabels[0] + '.';
        vis.map.onPick(function (id) {
          if (answered) return;
          if (!id) { hint.textContent = { town: 'Tippe genau auf einen Punkt.', river: 'Tippe auf eine blaue Linie.' }[q.visual.pick] || 'Tippe auf die Karte.'; return; }
          if (q.format === 'mapSeq') {
            var target = q.targets[step];
            var hit = id === target;
            vis.map.mark(id, hit ? 'right' : 'wrong'); vis.map.showLabel(id, true);
            if (!hit) seqOk = false;
            step++;
            if (step < q.targets.length && seqOk) { hint.textContent = '2. Und jetzt ' + q.stepLabels[step] + '.'; return; }
            return finish(seqOk ? q.answer : id);
          }
          if (exam) {
            return choose(id, function () { vis.map.clearMarks(); vis.map.mark(id, 'chosen'); hint.textContent = 'Ausgewählt. Du kannst noch ändern.'; });
          }
          var ok = id === q.answer;
          vis.map.mark(id, ok ? 'right' : 'wrong');
          vis.map.showLabel(id, true);
          finish(id);
        });
      }

      if (q.format === 'mapDrag') {
        var tray = h('div', { 'class': 'drag-tray' });
        var chip = h('button', { 'class': 'chip', type: 'button', text: q.chip });
        tray.appendChild(chip);
        answerBox.appendChild(h('p', { 'class': 'map-hint', text: 'Ziehe das Namensschild auf die Karte – oder tippe es an und dann auf den Fluss.' }));
        answerBox.appendChild(tray);
        root.GeoGames.dragChip(chip, vis.map, function (id) {
          if (answered) return false;
          if (!id) return false;
          var ok = id === q.answer;
          vis.map.mark(id, ok ? 'right' : 'wrong'); vis.map.showLabel(id, true);
          tray.hidden = true;
          finish(id);
          return true;
        });
      }

      if (q.format === 'cellClick') {
        var svg = vis.scene.svg;
        svg.classList.add('cells-live');
        svg.addEventListener('click', function (e) {
          var cell = e.target.getAttribute && e.target.getAttribute('data-cell');
          if (!cell || answered) return;
          if (exam) return choose(cell, function () {
            svg.querySelectorAll('.is-chosen').forEach(function (x) { x.classList.remove('is-chosen'); });
            U.markCell(svg, cell, 'is-chosen');
          });
          U.markCell(svg, cell, cell === q.answer ? 'is-right' : 'is-wrong');
          finish(cell);
        });
      }

      if (q.format === 'roseClick') {
        var rose = vis.el;
        rose.classList.add('rose-live');
        rose.addEventListener('click', function (e) {
          var d = e.target.getAttribute && e.target.getAttribute('data-dir');
          if (!d || answered) return;
          if (exam) return choose(d, function () {
            rose.querySelectorAll('.is-chosen').forEach(function (x) { x.classList.remove('is-chosen'); });
            rose.querySelectorAll('[data-dir="' + d + '"]').forEach(function (x) { x.classList.add('is-chosen'); });
          });
          rose.querySelectorAll('.rose-pt[data-dir="' + d + '"]').forEach(function (x) { x.classList.add(d === q.answer ? 'is-right' : 'is-wrong'); });
          rose.querySelectorAll('.rose-pt[data-dir="' + q.answer + '"]').forEach(function (x) { x.classList.add('is-right'); });
          finish(d);
        });
      }

      if (vis.map || vis.scene) answerBox.appendChild(feedback); else body.appendChild(feedback);
    }

    // ------------------------------------------------------------ end screens
    function end() {
      var sum = session.finish();
      if (opts.onEnd) opts.onEnd(sum);
      body.innerHTML = '';
      head.remove();
      if (exam) return examEnd(sum);
      return practiceEnd(sum);
    }

    function practiceEnd(sum) {
      var coins = app.reward(sum, session.mode);
      var five = session.mode === '5min';
      var title = sum.total === 0 ? 'Bis gleich!' : five ? 'Super! 5 Minuten geschafft.' : 'Runde geschafft!';
      if (sum.total && sum.correct === sum.total) U.confetti();
      var tips = [];
      var weakTopic = sum.weakTopics[0] || null;
      var suggest = weakTopic || sum.weakest;
      var box = h('div', { 'class': 'end' }, [
        h('div', { 'class': 'end-hero' }, [app.robin(sum.correct >= sum.total * 0.7 ? 'celebrating' : 'encouraging', 120),
          h('div', {}, [h('h1', { text: title }), coins ? h('div', { 'class': 'end-coins' }, [h('span', { 'class': 'rb-coin' }), ' +' + coins + ' Münzen']) : null])]),
        h('div', { 'class': 'end-stats' }, [
          h('div', { 'class': 'big-stat ok' }, [h('b', { text: String(sum.correct) }), h('span', { text: 'richtig' })]),
          h('div', { 'class': 'big-stat again' }, [h('b', { text: String(sum.againKeys.length) }), h('span', { text: 'nochmal üben' })])
        ]),
        suggest ? h('p', { 'class': 'end-tip', text: tipText(suggest, !!weakTopic) }) : null,
        h('div', { 'class': 'end-actions' }, [
          suggest ? h('button', { 'class': 'rb-btn', type: 'button', text: TOPIC[suggest].icon + ' ' + TOPIC[suggest].title + ' üben',
            onclick: function () { app.startPractice([suggest], TOPIC[suggest].title); } }) : null,
          five ? h('button', { 'class': 'rb-btn rb-btn-soft', type: 'button', text: '⏱ Noch 5 Minuten', onclick: function () { app.startFive(); } })
               : h('button', { 'class': 'rb-btn rb-btn-soft', type: 'button', text: 'Noch eine Runde', onclick: function () { app.startPractice(session.topics, opts.title, opts.practiceOpts); } }),
          h('button', { 'class': 'rb-btn rb-btn-soft', type: 'button', text: 'Zum Start', onclick: function () { app.go('home'); } })
        ])
      ]);
      body.appendChild(box);
    }
    function tipText(topic, fromThisRound) {
      var t = TOPIC[topic].title.replace('Hessen – ', '').replace('Kartenkunde – ', '');
      var art = { 'Flüsse': 'die Flüsse', 'Städte': 'die Städte', 'Gebirge': 'die Gebirge', 'Wappen': 'die Wappen',
                  'Bundesländer': 'die Bundesländer', 'Hauptstädte': 'die Hauptstädte', 'Nachbarländer': 'die Nachbarländer',
                  'Legende': 'die Legende', 'Planquadrate': 'die Planquadrate', 'Himmelsrichtungen': 'die Himmelsrichtungen' }[t] || t;
      return (fromThisRound ? 'Heute solltest du dir ' : 'Als Nächstes: Schau dir ') + art + ' noch einmal an.';
    }

    function examEnd(sum) {
      var coins = app.reward(sum, 'exam');
      if (sum.correct >= sum.total * 0.85) U.confetti(40);
      var good = [], weak = [];
      Object.keys(sum.byTopic).forEach(function (t) {
        var b = sum.byTopic[t];
        (b.ok === b.n ? good : weak).push(t);
      });
      // group into the teacher's areas for the friendly review
      var box = h('div', { 'class': 'end exam-end' }, [
        h('div', { 'class': 'end-hero' }, [app.robin('glasses', 110), h('div', {}, [
          h('p', { 'class': 'exam-kicker', text: 'Probe-Lernzielkontrolle' }),
          h('h1', { text: 'Du hast ' + sum.correct + ' von ' + sum.total + ' Punkten erreicht.' }),
          coins ? h('div', { 'class': 'end-coins' }, [h('span', { 'class': 'rb-coin' }), ' +' + coins + ' Münzen']) : null])]),
        good.length ? h('div', { 'class': 'review good' }, [h('h2', { text: 'Das kannst du schon sehr gut:' }),
          h('ul', {}, good.map(function (t) { return h('li', {}, ['✓ ' + TOPIC[t].title]); }))]) : null,
        weak.length ? h('div', { 'class': 'review weak' }, [h('h2', { text: 'Das solltest du noch üben:' }),
          h('div', { 'class': 'weak-list' }, weak.map(function (t) {
            return h('button', { 'class': 'weak-btn', type: 'button', onclick: function () { app.startPractice([t], TOPIC[t].title); } },
              [h('span', { text: '→ ' + TOPIC[t].title }), h('span', { 'class': 'weak-go', text: 'Üben ›' })]);
          }))]) : null,
        examAnswers.some(function (a) { return !a.ok; }) ? h('details', { 'class': 'review-list' }, [
          h('summary', { text: 'Meine Fehler ansehen' }),
          h('ol', {}, examAnswers.filter(function (a) { return !a.ok; }).map(function (a) {
            return h('li', {}, [h('b', { text: a.q.prompt }), h('span', { text: ' ' + a.q.wrong(a.given) })]);
          }))]) : null,
        h('div', { 'class': 'end-actions' }, [
          h('button', { 'class': 'rb-btn', type: 'button', text: 'Neue Probe-Prüfung', onclick: function () { app.startExam(); } }),
          h('button', { 'class': 'rb-btn rb-btn-soft', type: 'button', text: 'Zum Start', onclick: function () { app.go('home'); } })
        ])
      ]);
      body.appendChild(box);
    }

    next();
    return { stop: stopTimer };
  }

  root.GeoQuiz = { run: run, buildVisual: buildVisual };
})(typeof window !== 'undefined' ? window : globalThis);
