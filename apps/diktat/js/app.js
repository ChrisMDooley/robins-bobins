/*
 * app.js — screens and the learning loop:
 *   HEAR → WRITE → CHECK → UNDERSTAND → CORRECT → REWARD → NEXT
 */
(function () {
  'use strict';
  var DT = window.DT;
  var C = DT.compare, P = DT.practice, speech = DT.speech;
  var store = DT.createStore(DT.localStorageAdapter(), 'lukas');
  var $ = function (id) { return document.getElementById(id); };

  var session = null;   // current session (see practice.buildSession)
  var idx = 0;          // index of current sentence
  var cur = null;       // {sentence, result, targets, done{}, corrected, attempt, plays}

  // ---------- helpers ----------

  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; });
  }
  function show(id) {
    ['home', 'practice', 'summary', 'settings'].forEach(function (s) { $(s).hidden = s !== id; });
    window.scrollTo(0, 0);
  }
  function settings() { return store.state.settings; }

  function applyDisplaySettings() {
    var s = settings(), r = document.documentElement;
    r.style.setProperty('--scale', s.fontScale);
    r.classList.toggle('spacing-wide', s.spacing === 'wide');
    r.classList.remove('font-opendyslexic', 'font-system');
    if (s.font !== 'atkinson') r.classList.add('font-' + s.font);
  }

  function updateCoins(bump) {
    var b = store.balance();
    document.querySelectorAll('.coin-balance').forEach(function (el) { el.textContent = b; });
    if (bump) document.querySelectorAll('.coins').forEach(function (el) {
      if (el.offsetParent === null) return;
      el.classList.remove('bump'); void el.offsetWidth; el.classList.add('bump');
    });
  }

  // Coin pop animation, queued so several rewards don't overlap.
  var popQueue = Promise.resolve();
  function award(amount, reason, anchorEl) {
    if (!amount) return;
    store.addCoins(amount, reason, { sessionId: session ? session.id : null });
    if (session) session.coins += amount;
    popQueue = popQueue.then(function () {
      return new Promise(function (res) {
        updateCoins(true);
        var layer = $('pop-layer');
        var target = anchorEl || visibleCoins();
        var rect = target ? target.getBoundingClientRect() : { left: window.innerWidth / 2, top: 80, width: 0, height: 0 };
        var pop = document.createElement('div');
        pop.className = 'pop';
        pop.textContent = '+' + amount + '  ' + reason;
        var x = Math.min(Math.max(8, rect.left + rect.width / 2 - 80), window.innerWidth - 240);
        pop.style.left = x + 'px';
        pop.style.top = Math.max(8, rect.top + rect.height + 6) + 'px';
        layer.appendChild(pop);
        for (var i = 0; i < 8; i++) {
          var sp = document.createElement('span');
          sp.className = 'sparkle';
          sp.style.left = (rect.left + rect.width / 2) + 'px';
          sp.style.top = (rect.top + rect.height / 2) + 'px';
          var ang = (Math.PI * 2 * i) / 8;
          sp.style.setProperty('--dx', Math.round(Math.cos(ang) * 44) + 'px');
          sp.style.setProperty('--dy', Math.round(Math.sin(ang) * 44) + 'px');
          layer.appendChild(sp);
          setTimeout(sp.remove.bind(sp), 1000);
        }
        setTimeout(function () { pop.remove(); }, 1500);
        setTimeout(res, 450);
      });
    });
  }
  function visibleCoins() {
    var els = document.querySelectorAll('.coins');
    for (var i = 0; i < els.length; i++) if (els[i].offsetParent !== null) return els[i];
    return null;
  }

  // ---------- speech ----------

  function play(slow) {
    if (!cur) return;
    cur.plays++;
    var btn = $('btn-play');
    btn.classList.add('speaking');
    $('listen-status').textContent = slow ? 'Ganz langsam …' : 'Hör gut zu …';
    var s = settings();
    speech.speak(cur.sentence.text, { slow: slow, voiceName: s.voiceName, rate: s.rate, slowRate: s.slowRate })
      .then(function (ok) {
        btn.classList.remove('speaking');
        $('listen-status').textContent = ok ? (cur && cur.result ? 'Du kannst den Satz noch einmal anhören.' : 'Jetzt schreiben. Du kannst so oft hören, wie du willst.')
                                             : 'Die Vorlese-Stimme funktioniert gerade nicht. Bitte einen Erwachsenen fragen.';
        if (ok && !cur.result && document.activeElement !== $('answer') && window.matchMedia('(pointer:fine)').matches) $('answer').focus();
      });
  }

  // ---------- home ----------

  function renderHome() {
    updateCoins(false);
    var st = store.state;
    $('home-name').textContent = st.profile.name;
    var streak = P.streakDays(st);
    $('home-streak').textContent = streak;
    $('home-streak-label').textContent = streak === 1 ? 'Tag in Folge' : 'Tage in Folge';
    $('home-words').textContent = P.problemWords(st).length;
    $('start-sub').textContent = settings().sessionLength + ' Sätze';
    var practisedToday = st.sessions.some(function (s) { return s.endedAt && P.dayKey(s.endedAt) === P.dayKey(Date.now()); });
    $('home-sub').textContent = practisedToday ? 'Heute schon geübt – super! Noch eine Runde?' : 'Hören, schreiben, prüfen, verbessern.';
    var n = $('speech-notice');
    if (!speech.supported) { n.hidden = false; n.textContent = 'Dieser Browser kann keine Sätze vorlesen. Bitte Safari oder Chrome verwenden.'; }
    else n.hidden = true;
    show('home');
  }

  // ---------- practice ----------

  function startSession() {
    session = P.buildSession(store);
    session.coins = 0;
    idx = 0;
    show('practice');
    loadSentence();
  }

  function renderProgress() {
    var n = session.sentences.length, html = '';
    for (var i = 0; i < n; i++) html += '<span class="dot' + (i < idx ? ' done' : i === idx ? ' now' : '') + '"></span>';
    $('dots').innerHTML = html;
    $('progress-text').textContent = 'Satz ' + (idx + 1) + ' von ' + n;
  }

  function loadSentence() {
    cur = { sentence: session.sentences[idx], result: null, targets: [], done: {}, corrected: 0, plays: 0 };
    renderProgress();
    updateCoins(false);
    $('answer').value = '';
    $('btn-check').disabled = true;
    $('write-area').hidden = false;
    $('feedback').hidden = true;
    $('listen-status').textContent = 'Hör gut zu.';
    setTimeout(function () { play(false); }, 350);
  }

  function check() {
    var typed = $('answer').value;
    if (!typed.trim()) { $('listen-status').textContent = 'Schreib zuerst, was du gehört hast.'; return; }
    speech.stop();
    var sentence = cur.sentence;
    var result = C.compareSentence(sentence.text, typed);
    cur.result = result;
    cur.targets = C.correctionTargets(result);
    // Many problems at once? Then one calm step instead of a long list:
    // copy the whole correct sentence once.
    cur.sentenceMode = cur.targets.length > 4 || (result.stats.wordsTotal && result.stats.wordsCorrect / result.stats.wordsTotal < 0.5);
    if (cur.sentenceMode) cur.targets = [{ id: 'all', type: 'sentence', expected: result.target }];

    var hardRight = P.recordWordStats(store.state, sentence.text, result);
    cur.attempt = {
      id: store.uid('a'), sessionId: session.id, sentenceId: sentence.id, ts: Date.now(),
      text: sentence.text, typed: typed, plays: cur.plays,
      errors: result.errors.map(function (e) { return { type: e.type, expected: e.expected, got: e.got }; }),
      perfect: result.perfect, stats: result.stats, corrected: 0
    };
    store.state.attempts.push(cur.attempt);
    store.save();
    session.results.push({ sentenceId: sentence.id, result: result, corrected: 0 });

    renderFeedback();

    var v = settings().coinValues;
    if (result.perfect) award(v.perfect, 'Alles richtig!', $('fb-head'));
    if (hardRight.length) award(hardRight.length * v.hardWord, hardRight.length === 1 ? 'Schweres Wort geschafft' : hardRight.length + ' schwere Wörter geschafft', $('fb-target'));
  }

  function renderSentence(result, noBadges) {
    // Rebuild the correct sentence with marks. Quotes become German „ “.
    var html = '', prevNoSpaceAfter = true, quoteOpen = false, numOf = {}, n = 0;
    result.errors.forEach(function (e) { numOf[e.id] = ++n; });
    var numShown = {};
    result.items.forEach(function (it) {
      var t = it.text, noSpaceBefore = false, noSpaceAfter = false;
      if (it.kind === 'punct') {
        if (t === '"') { if (!quoteOpen) { t = '„'; noSpaceAfter = true; } else { t = '“'; noSpaceBefore = true; } quoteOpen = !quoteOpen; }
        else if (t === '(') noSpaceAfter = true;
        else if (/[.,!?:;)]/.test(t)) noSpaceBefore = true;
      }
      var inner;
      if (it.letters && (it.status === 'spelling' || it.status === 'capital')) {
        inner = it.letters.map(function (l) {
          return l.mark === 'fix' ? '<span class="lt-fix">' + esc(l.ch) + '</span>' : l.mark === 'near' ? '<span class="lt-near">' + esc(l.ch) + '</span>' : esc(l.ch);
        }).join('');
      } else inner = esc(t);
      var cls = (it.kind === 'punct' ? 'p' : 'w') + (it.status !== 'ok' ? ' mark-' + (it.status === 'missing' && it.kind === 'punct' ? 'punct' : it.status) : '');
      var badge = '';
      if (!noBadges && it.errorId && !numShown[it.errorId]) { badge = '<span class="num">' + numOf[it.errorId] + '</span>'; numShown[it.errorId] = true; }
      if (it.status === 'extra') inner = esc(t);
      var piece = '<span class="' + cls + '">' + inner + '</span>' + badge;
      if (badge) piece = '<span class="nowrap">' + piece + '</span>';
      html += (prevNoSpaceAfter || noSpaceBefore ? '' : ' ') + piece;
      prevNoSpaceAfter = noSpaceAfter;
    });
    return html;
  }

  var TYPE_LABEL = { spelling: 'Rechtschreibung', capital: 'Groß oder klein', punct: 'Satzzeichen',
                     missing: 'Wort fehlt', extra: 'Wort zu viel', spacing: 'Getrennt oder zusammen' };

  function lettersHTML(letters) {
    return letters.map(function (l) {
      return l.mark === 'fix' ? '<span class="lt-fix">' + esc(l.ch) + '</span>' : l.mark === 'near' ? '<span class="lt-near">' + esc(l.ch) + '</span>' : esc(l.ch);
    }).join('');
  }

  function renderFeedback() {
    var r = cur.result;
    $('write-area').hidden = true;
    $('feedback').hidden = false;
    var head = $('fb-head');
    if (cur.sentenceMode) {
      head.textContent = 'Das war ein schwerer Satz. Schau ihn dir genau an und schreib ihn noch einmal ab.';
      head.className = 'fb-head';
    } else if (r.perfect) { head.textContent = 'Super! Alles richtig geschrieben.'; head.className = 'fb-head perfect'; }
    else {
      var ok = r.stats.wordsCorrect, tot = r.stats.wordsTotal;
      head.textContent = ok + ' von ' + tot + ' Wörtern richtig. ' +
        (r.errors.length === 1 ? 'Schau dir eine Stelle genau an:' : 'Schau dir diese ' + r.errors.length + ' Stellen genau an:');
      head.className = 'fb-head';
    }
    $('fb-target').innerHTML = renderSentence(r, cur.sentenceMode);
    $('fb-typed').textContent = r.typed;
    document.querySelector('.mine').hidden = r.perfect;
    document.querySelector('.mine').open = false;

    var list = $('fb-fixes'), html = '';
    if (cur.sentenceMode) {
      html = '<li class="fix" id="fix-all"><span class="num">✎</span><div class="fix-body">' +
        '<span class="chip chip-sentence">Ganzer Satz</span>' +
        '<p class="fix-hint">Die bunten Stellen oben sind wichtig. Schreib den Satz genau so ab, wie er oben steht.</p>' +
        '<div class="fix-row"><textarea class="fix-input fix-sentence" id="in-all" data-err="all" rows="2" lang="de" ' +
        'autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false" enterkeyhint="done" ' +
        'aria-label="Schreib den ganzen Satz ab"></textarea></div>' +
        '<p class="fix-msg" id="msg-all" aria-live="polite"></p></div></li>';
    } else r.errors.forEach(function (e, i) {
      var isTarget = cur.targets.indexOf(e) !== -1;
      var word = e.letters ? lettersHTML(e.letters) : esc(e.expected || e.got);
      if (e.type === 'punct') word = '<span class="mark-punct">' + (e.expected ? esc(e.expected === '"' ? '„ “' : e.expected) : '<s>' + esc(e.got) + '</s>') + '</span>';
      if (e.type === 'extra') word = '<s>' + esc(e.got) + '</s>';
      html += '<li class="fix" id="fix-' + e.id + '"><span class="num">' + (i + 1) + '</span><div class="fix-body">' +
        '<span class="chip chip-' + e.type + '">' + TYPE_LABEL[e.type] + '</span>' +
        '<span class="fix-word" id="word-' + e.id + '">' + word + '</span>' +
        '<p class="fix-hint">' + esc(e.hint) + '</p>' +
        (isTarget ? '<div class="fix-row"><input class="fix-input" id="in-' + e.id + '" data-err="' + e.id + '" lang="de" ' +
          'autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false" enterkeyhint="next" ' +
          'aria-label="Schreib das Wort richtig: ' + esc(e.expected) + '" placeholder="Schreib es richtig ab"></div>' +
          '<p class="fix-msg" id="msg-' + e.id + '" aria-live="polite"></p>' : '') +
        '</div></li>';
    });
    list.innerHTML = html;
    list.querySelectorAll('.fix-input').forEach(function (inp) {
      inp.addEventListener('keydown', function (ev) { if (ev.key === 'Enter') { ev.preventDefault(); checkFix(inp); } });
      inp.addEventListener('input', function () { autoCheckFix(inp); });
    });
    updateNextButton();
    var first = list.querySelector('.fix-input');
    if (first && window.matchMedia('(pointer:fine)').matches) first.focus(); else if (!first) $('btn-next').focus();
  }

  function errById(id) { return cur.result.errors.concat(cur.targets).filter(function (e) { return e.id === id; })[0]; }

  // Accept as soon as the typed text matches, so he doesn't need to press Enter.
  function autoCheckFix(inp) {
    var e = errById(inp.dataset.err);
    if (!cur.done[e.id] && C.isCorrectRetype(e.expected, inp.value)) checkFix(inp);
  }

  function checkFix(inp) {
    var e = errById(inp.dataset.err);
    var msg = $('msg-' + e.id);
    if (cur.done[e.id]) { focusNextFix(); return; }
    if (C.isCorrectRetype(e.expected, inp.value)) {
      cur.done[e.id] = true;
      cur.corrected++;
      inp.readOnly = true;
      $('fix-' + e.id).classList.add('done');
      msg.className = 'fix-msg'; msg.textContent = 'Richtig!';
      var v = settings().coinValues;
      if (e.id === 'all') $('fb-target').innerHTML = renderSentence(C.compareSentence(cur.result.target, cur.result.target));
      if (e.id === 'all') { cur.corrected = v.correctionCap; award(v.correctionCap * v.correction, 'Satz verbessert!', inp); }
      else if (cur.corrected <= v.correctionCap) award(v.correction, 'Verbessert!', inp);
      updateNextButton();
      focusNextFix();
    } else if (inp.value.trim()) {
      if (e.id === 'all') {
        // Re-mark the sentence against this new try, so he sees what's still different.
        $('fb-target').innerHTML = renderSentence(C.compareSentence(cur.result.target, inp.value), true);
        msg.className = 'fix-msg try';
        msg.textContent = 'Fast! Die bunten Stellen oben sind noch anders.';
        return;
      }
      // Show the correct word again with the letters to look at — no guessing.
      var letters = C.charDiff(e.expected, C.normalise(inp.value));
      $('word-' + e.id).innerHTML = lettersHTML(letters);
      msg.className = 'fix-msg try';
      msg.textContent = 'Fast! Schau auf die unterstrichenen Buchstaben und schreib es genau so ab.';
      inp.select();
    }
  }

  function focusNextFix() {
    var inputs = Array.prototype.slice.call(document.querySelectorAll('.fix-input'));
    var next = inputs.filter(function (i) { return !cur.done[i.dataset.err]; })[0];
    if (next) next.focus(); else $('btn-next').focus();
  }

  function pendingFixes() { return cur.targets.filter(function (e) { return !cur.done[e.id]; }).length; }

  function updateNextButton() {
    var pending = pendingFixes();
    $('btn-next').disabled = pending > 0;
    $('btn-next').textContent = idx + 1 >= session.sentences.length ? 'Fertig!' : 'Weiter';
    $('btn-skip').hidden = pending === 0;
  }

  function next() {
    var v = settings().coinValues;
    cur.attempt.corrected = cur.corrected;
    session.results[session.results.length - 1].corrected = cur.corrected;
    store.save();
    award(v.sentence, 'Satz geschafft');
    idx++;
    if (idx >= session.sentences.length) popQueue.then(finish);
    else loadSentence();
  }

  // ---------- summary ----------

  function finish() {
    speech.stop();
    if (!session || !session.results.length) { session = null; renderHome(); return; }
    var now = Date.now();
    var b = P.sessionBonuses(store.state, session, now);
    show('summary');
    updateCoins(false);
    b.parts.forEach(function (p) { award(p.amount, p.reason, $('sum-coins')); });

    store.update(function (st) {
      st.sessions.push({ id: session.id, startedAt: session.startedAt, endedAt: now,
        sentenceIds: session.results.map(function (r) { return r.sentenceId; }),
        coins: session.coins, accuracy: b.accuracy });
    });

    var fixed = session.results.reduce(function (s, r) { return s + r.corrected; }, 0);
    var words = {};
    session.results.forEach(function (r) { Object.keys(P.errorWords(r.result)).forEach(function (w) { words[w] = true; }); });
    var wordList = Object.keys(words);

    $('sum-title').textContent = b.accuracy >= 0.95 ? 'Wow, fast alles richtig!' : 'Super gemacht, ' + store.state.profile.name + '!';
    $('sum-sentences').textContent = session.results.length;
    $('sum-acc').textContent = Math.round(b.accuracy * 100) + '%';
    $('sum-fixed').textContent = fixed;
    popQueue.then(function () { $('sum-coins').textContent = '+' + session.coins; });
    $('sum-coins').textContent = '+' + session.coins;
    var bonusSum = b.parts.reduce(function (a, p) { return a + p.amount; }, 0);
    var during = [{ reason: 'Sätze und Verbesserungen', amount: session.coins - bonusSum }];
    $('sum-bonus').innerHTML = during.concat(b.parts).map(function (p) { return '<li><span>' + esc(p.reason) + '</span><b>+' + p.amount + '</b></li>'; }).join('');
    $('sum-words-wrap').hidden = !wordList.length;
    $('sum-words').innerHTML = wordList.map(function (w) { return '<li>' + esc(w) + '</li>'; }).join('');
  }

  // ---------- settings ----------

  function fillVoices() {
    var sel = $('set-voice'), vs = speech.voices(), s = settings();
    sel.innerHTML = '<option value="">Automatisch (beste Stimme)</option>' +
      vs.map(function (v) { return '<option value="' + esc(v.name) + '">' + esc(v.name) + ' (' + esc(v.lang) + (v.localService ? '' : ', online') + ')</option>'; }).join('');
    sel.value = s.voiceName;
    var best = speech.pickVoice(s.voiceName);
    $('voice-help').textContent = !speech.supported ? 'Dieser Browser unterstützt keine Sprachausgabe.'
      : !vs.length ? 'Keine deutsche Stimme gefunden. Auf dem Mac: Systemeinstellungen → Bedienungshilfen → Gesprochene Inhalte → Systemstimme → Stimmen verwalten → Deutsch.'
      : 'Aktuell: ' + best.name + '. Tipp für den Mac: Unter Bedienungshilfen → Gesprochene Inhalte → Stimmen verwalten die „Premium“-Stimme von Anna oder Petra laden – sie klingt deutlich natürlicher.';
  }

  function openSettings() {
    var s = settings();
    fillVoices();
    $('set-rate').value = s.rate; $('rate-out').textContent = s.rate;
    $('set-slow').value = s.slowRate; $('slow-out').textContent = s.slowRate;
    $('set-font').value = s.font;
    $('set-size').value = s.fontScale; $('size-out').textContent = Math.round(s.fontScale * 100) + '%';
    $('set-spacing').checked = s.spacing === 'wide';
    $('set-length').value = String(s.sessionLength);
    $('data-help').textContent = (store.persistent ? 'Alle Daten bleiben auf diesem Gerät, in diesem Browser.' : 'Achtung: Dieser Browser speichert gerade nichts dauerhaft (privates Fenster?).') +
      ' ' + store.state.attempts.length + ' Sätze geübt, ' + store.balance() + ' Münzen.';
    $('backup-text').value = '';
    $('data-msg').textContent = '';
    $('reset-confirm').hidden = true;
    show('settings');
  }

  function bindSettings() {
    function set(fn) { store.update(function (st) { fn(st.settings); }); applyDisplaySettings(); }
    $('set-voice').addEventListener('change', function (e) { set(function (s) { s.voiceName = e.target.value; }); fillVoices(); });
    $('set-rate').addEventListener('input', function (e) { var v = parseFloat(e.target.value); $('rate-out').textContent = v; set(function (s) { s.rate = v; }); });
    $('set-slow').addEventListener('input', function (e) { var v = parseFloat(e.target.value); $('slow-out').textContent = v; set(function (s) { s.slowRate = v; }); });
    $('btn-voice-test').addEventListener('click', function () {
      var s = settings(); speech.speak('Der kleine Hund läuft schnell nach Hause.', { voiceName: s.voiceName, rate: s.rate });
    });
    $('set-font').addEventListener('change', function (e) { set(function (s) { s.font = e.target.value; }); });
    $('set-size').addEventListener('input', function (e) { var v = parseFloat(e.target.value); $('size-out').textContent = Math.round(v * 100) + '%'; set(function (s) { s.fontScale = v; }); });
    $('set-spacing').addEventListener('change', function (e) { set(function (s) { s.spacing = e.target.checked ? 'wide' : 'normal'; }); });
    $('set-length').addEventListener('change', function (e) { set(function (s) { s.sessionLength = parseInt(e.target.value, 10); }); });

    $('btn-export').addEventListener('click', function () {
      var json = store.exportJSON();
      $('backup-text').value = json;
      var done = function () { $('data-msg').textContent = 'Sicherung kopiert. Zum Beispiel in eine Notiz einfügen.'; };
      try { navigator.clipboard.writeText(json).then(done, function () { $('backup-text').select(); $('data-msg').textContent = 'Text markiert – jetzt kopieren.'; }); }
      catch (e) { $('backup-text').select(); $('data-msg').textContent = 'Text markiert – jetzt kopieren.'; }
    });
    if ($('btn-download')) $('btn-download').addEventListener('click', function () {
      try {
        var blob = new Blob([store.exportJSON()], { type: 'application/json' });
        var a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = 'diktat-trainer-sicherung-' + P.dayKey(Date.now()) + '.json';
        document.body.appendChild(a); a.click(); a.remove();
        $('data-msg').textContent = 'Sicherung wird heruntergeladen.';
      } catch (e) { $('data-msg').textContent = 'Herunterladen geht hier nicht – bitte „Sicherung kopieren“ nutzen.'; }
    });
    $('btn-import').addEventListener('click', function () {
      try { store.importJSON($('backup-text').value); applyDisplaySettings(); $('data-msg').textContent = 'Sicherung wiederhergestellt.'; updateCoins(false); }
      catch (e) { $('data-msg').textContent = 'Das ist keine gültige Sicherung. Bitte den ganzen Text einfügen.'; }
    });
    $('btn-reset').addEventListener('click', function () { $('reset-confirm').hidden = false; });
    $('btn-reset-no').addEventListener('click', function () { $('reset-confirm').hidden = true; });
    $('btn-reset-yes').addEventListener('click', function () {
      store.reset(); applyDisplaySettings(); $('reset-confirm').hidden = true; $('data-msg').textContent = 'Alles zurückgesetzt.'; updateCoins(false);
    });
    $('btn-settings-close').addEventListener('click', renderHome);
    speech.onVoices(function () { if (!$('settings').hidden) fillVoices(); });
  }

  // ---------- wiring ----------

  function bind() {
    $('btn-start').addEventListener('click', startSession);
    $('btn-again').addEventListener('click', startSession);
    $('btn-home').addEventListener('click', function () { session = null; renderHome(); });
    $('btn-settings').addEventListener('click', openSettings);
    $('btn-play').addEventListener('click', function () { play(false); });
    $('btn-replay').addEventListener('click', function () { play(false); });
    $('btn-slow').addEventListener('click', function () { play(true); });
    $('btn-check').addEventListener('click', check);
    $('btn-next').addEventListener('click', next);
    $('btn-skip').addEventListener('click', next);
    $('btn-quit').addEventListener('click', function () {
      speech.stop();
      if (session && session.results.length) finish(); else { session = null; renderHome(); }
    });

    var answer = $('answer');
    answer.addEventListener('input', function () { $('btn-check').disabled = !answer.value.trim(); });
    answer.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        if (answer.value.trim()) check(); else play(false);   // Enter on an empty box = listen again
      }
    });

    document.addEventListener('keydown', function (e) {
      if ($('practice').hidden) return;
      if (e.key === 'Escape') { e.preventDefault(); play(e.shiftKey); }
      else if (e.key === 'Enter' && cur && cur.result && document.activeElement === $('btn-next')) { /* native click */ }
    });
    bindSettings();
  }

  // ---------- start ----------

  applyDisplaySettings();
  bind();
  renderHome();

  // Ask the browser not to evict our data (Safari clears unused site data after a while).
  try { if (navigator.storage && navigator.storage.persist) navigator.storage.persist(); } catch (e) { /* ignore */ }

  // PWA: offline cache + installable. Only on http(s), never in a sandboxed preview.
  try {
    if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol) && window.self === window.top) {
      navigator.serviceWorker.register('sw.js').catch(function () { /* optional */ });
    }
  } catch (e) { /* ignore */ }

  window.DT.app = { store: store }; // handy for debugging in the console
})();
