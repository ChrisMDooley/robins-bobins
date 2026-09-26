/*
 * platform/app.js — the Robin's Bobins shell:
 *   #/            Wer bist du?        (child picker)
 *   #/c/<id>      Hallo <Name>!       (child home: stats + app cards)
 *   #/eltern      Elternbereich       (behind the parent PIN)
 * Learning apps are separate pages; the shell only links to them with ?child=<id>.
 */
(function () {
  'use strict';
  var RB = window.RB;
  var view = document.getElementById('view');
  var parentUnlocked = false;

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function robin(pose, size) { var el = RB.robin.el(pose, size); return el.outerHTML; }
  var WORDMARK = '<span class="rb-wordmark">Robin’s <b>Bobins</b></span>';
  function coinPill(n) { return '<span class="rb-coins"><span class="rb-coin" aria-hidden="true"></span><span>' + n + '</span></span>'; }

  // Apps that keep their own ledger hand their coins/sessions over here (idempotent).
  function syncChild(childId) {
    RB.apps.forChild(childId).forEach(function (a) {
      var b = a.bridge && window[a.bridge];
      if (b && b.sync) { try { b.sync(RB, childId); } catch (e) { console.warn('bridge sync failed', a.id, e); } }
    });
  }
  function syncAll() { RB.children().forEach(function (c) { syncChild(c.id); }); }

  // New apps meant for a particular child appear for them once (see RB.apps.applyGrants).
  try { RB.apps.applyGrants(); } catch (e) { console.warn('grants failed', e); }

  // ---------- Wer bist du? ----------

  function renderPicker() {
    syncAll();
    document.documentElement.className = '';
    var kids = RB.children().map(function (c) {
      return '<a class="kid" href="#/c/' + esc(c.id) + '" data-child="' + esc(c.id) + '" style="--c:' + esc(c.color) + '">' +
        '<span class="avatar" aria-hidden="true">' + esc(c.name.charAt(0)) + '</span>' +
        '<span class="kid-name">' + esc(c.name) + '</span>' +
        coinPill(RB.coins.balance(c.id)) + '</a>';
    }).join('');
    view.innerHTML =
      '<section class="picker">' +
        '<div class="brand-hero">' + robin('normal') + '<h1>' + WORDMARK + '</h1>' +
          '<p class="tagline">Unsere kleine Lernwelt</p></div>' +
        '<h2 class="who">Wer bist du?</h2>' +
        '<nav class="kids" aria-label="Kind auswählen">' + kids + '</nav>' +
        '<a class="rb-link parent-link" href="#/eltern">Eltern</a>' +
      '</section>';
    view.querySelectorAll('.kid').forEach(function (a) {
      a.addEventListener('click', function () { RB.selectChild(a.dataset.child); });
    });
    document.title = 'Robin’s Bobins';
  }

  // ---------- Hallo <Name>! ----------

  function renderHome(childId) {
    var c = RB.child(childId);
    if (!c) { location.hash = '#/'; return; }
    RB.selectChild(c.id);
    syncChild(c.id);
    document.documentElement.className = c.ui === 'simple' ? 'ui-simple' : '';
    var s = RB.progress.summary(c.id);
    var line = RB.robin.say(c, s);
    var apps = RB.apps.forChild(c.id);

    var cards = apps.map(function (a) {
      var b = a.bridge && window[a.bridge], info = '';
      if (b && b.cardInfo) { try { info = b.cardInfo(c.id) || ''; } catch (e) { info = ''; } }
      return '<a class="app-card" href="' + esc(RB.nav.appUrl(a.id, c.id)) + '" style="--c:' + esc(a.color) + '" data-app="' + esc(a.id) + '">' +
        '<span class="app-icon" aria-hidden="true">' + esc(a.icon) + '</span>' +
        '<span class="app-title">' + esc(a.title) + '</span>' +
        '<span class="app-sub">' + esc(a.subject) + '</span>' +
        (info ? '<span class="app-info">' + esc(info) + '</span>' : '') + '</a>';
    }).join('');
    if (!apps.length) {
      cards = '<div class="empty">' + robin('sleeping') + '<p><b>Hier kommen bald deine Apps!</b><br>' +
        '<span class="help">Robin baut gerade mit Papa daran.</span></p></div>';
    }

    view.innerHTML =
      '<header class="bar">' +
        '<a class="rb-link" href="#/" aria-label="Kind wechseln">‹ Wechseln</a>' +
        '<span class="rb-wordmark">Robin’s <b>Bobins</b></span>' +
        coinPill(s.coins) +
      '</header>' +
      '<section class="home">' +
        '<div class="greet">' + robin(line.pose) +
          '<div><h1>Hallo ' + esc(c.name) + '!</h1><span class="rb-bubble">' + esc(line.text) + '</span></div></div>' +
        '<div class="stats">' +
          '<span class="stat"><span class="ico">🔥</span>' + s.streak + ' <small>' + (s.streak === 1 ? 'Tag in Folge' : 'Tage in Folge') + '</small></span>' +
          '<span class="stat"><span class="rb-coin" aria-hidden="true"></span>' + s.coins + ' <small>Robin-Münzen</small></span>' +
          '<span class="stat"><span class="ico">⭐</span>' + s.today + ' <small>' + (s.today === 1 ? 'Übung heute' : 'Übungen heute') + '</small></span>' +
        '</div>' +
        '<h2 class="section-h">Meine Apps</h2>' +
        (apps.length ? '<nav class="apps" aria-label="Meine Apps">' + cards + '</nav>' : cards) +
      '</section>';
    document.title = c.name + ' · Robin’s Bobins';
  }

  // ---------- Elternbereich ----------

  function renderPin() {
    var setting = !RB.parent.hasPin();
    view.innerHTML =
      '<header class="bar"><a class="rb-link" href="#/">‹ Zurück</a>' + WORDMARK + '<span></span></header>' +
      '<section class="pin">' + robin('glasses', 110) +
        '<h1 style="margin:0">' + (setting ? 'Eltern-PIN festlegen' : 'Elternbereich') + '</h1>' +
        '<p class="help">' + (setting ? 'Vier Ziffern. Die Kinder sollten sie nicht kennen.' : 'Bitte PIN eingeben.') + '</p>' +
        '<form id="pin-form" class="pin" style="padding:0">' +
          '<input id="pin1" type="password" inputmode="numeric" pattern="[0-9]*" maxlength="4" autocomplete="off" aria-label="PIN">' +
          (setting ? '<input id="pin2" type="password" inputmode="numeric" pattern="[0-9]*" maxlength="4" autocomplete="off" aria-label="PIN wiederholen" placeholder="····">' : '') +
          '<button class="rb-btn" type="submit">' + (setting ? 'Speichern' : 'Öffnen') + '</button>' +
          '<p class="msg" id="pin-msg" aria-live="polite"></p>' +
        '</form></section>';
    var p1 = document.getElementById('pin1'); p1.focus();
    document.getElementById('pin-form').addEventListener('submit', function (e) {
      e.preventDefault();
      var msg = document.getElementById('pin-msg'), v = p1.value;
      if (!/^\d{4}$/.test(v)) { msg.textContent = 'Bitte genau vier Ziffern.'; return; }
      if (setting) {
        if (document.getElementById('pin2').value !== v) { msg.textContent = 'Die beiden PINs sind verschieden.'; return; }
        RB.parent.setPin(v);
      } else if (!RB.parent.checkPin(v)) { msg.textContent = 'Das war nicht richtig.'; p1.value = ''; return; }
      parentUnlocked = true;
      renderParent();
    });
  }

  function fmtDate(ts) {
    if (!ts) return 'noch nie';
    return new Date(ts).toLocaleDateString('de-DE', { weekday: 'short', day: 'numeric', month: 'short' });
  }

  function renderParent() {
    if (!parentUnlocked) { renderPin(); return; }
    syncAll();
    document.documentElement.className = '';
    var listed = RB.apps.list().filter(function (a) { return !a.hidden; });
    var rows = RB.children().map(function (c) {
      var s = RB.progress.summary(c.id), n = RB.activity.list(c.id).length;
      var toggles = listed.map(function (a) {
        return '<label><input type="checkbox" data-child="' + esc(c.id) + '" data-app="' + esc(a.id) + '"' +
          (c.apps.indexOf(a.id) !== -1 ? ' checked' : '') + '> ' + esc(a.icon + ' ' + a.title) + '</label>';
      }).join('');
      return '<div class="kid-row" style="--c:' + esc(c.color) + '">' +
        '<span class="avatar" style="background:' + esc(c.color) + '">' + esc(c.name.charAt(0)) + '</span>' +
        '<div><b>' + esc(c.name) + '</b> <span class="facts">· ' + s.coins + ' Münzen · ' + n + ' Übungen · Serie ' + s.streak +
          ' · zuletzt ' + esc(fmtDate(s.lastActiveAt)) + '</span></div>' +
        '<div class="toggles">' + toggles + '</div></div>';
    }).join('');

    view.innerHTML =
      '<header class="bar"><a class="rb-link" href="#/" id="parent-done">‹ Fertig</a>' + WORDMARK + '<span></span></header>' +
      '<section class="parent">' +
        '<h1>Elternbereich</h1>' +
        '<div class="panel"><h2>Kinder und Apps</h2>' + rows +
          '<p class="help">Ein Häkchen zeigt die App auf der Startseite dieses Kindes. Die Einstellungen einer App ' +
          '(Stimme, Schrift, Sätze pro Runde …) findest du vorerst in der App selbst.</p></div>' +
        '<div class="panel"><h2>Sicherung</h2>' +
          '<p class="help">' + (RB.persistent ? 'Alles liegt nur auf diesem Gerät, in diesem Browser.' : 'Achtung: Dieser Browser speichert gerade nichts dauerhaft (privates Fenster?).') +
          ' Die Sicherung enthält alle Kinder, alle Münzen und die Daten jeder App.</p>' +
          '<div class="row"><button class="rb-btn" id="bk-download" type="button">Sicherung herunterladen</button>' +
          '<button class="rb-btn rb-btn-soft" id="bk-copy" type="button">Sicherung kopieren</button></div>' +
          '<p style="margin-top:14px"><label for="bk-text" class="help">Zum Wiederherstellen die Sicherung hier einfügen:</label></p>' +
          '<textarea id="bk-text" class="backup" spellcheck="false"></textarea>' +
          '<div class="row"><button class="rb-btn rb-btn-soft" id="bk-import" type="button">Wiederherstellen</button></div>' +
          '<p class="help" id="bk-msg" aria-live="polite"></p></div>' +
        '<div class="panel"><h2>Familien-PIN</h2><p class="help">Dieses Gerät ist freigeschaltet. Abmelden, wenn es jemand anderem gehört ' +
          '(danach fragt die Seite wieder nach der Familien-PIN).</p>' +
          '<div class="row"><button class="rb-btn rb-btn-soft" id="gate-lock" type="button">Dieses Gerät abmelden</button></div></div>' +
        '<div class="panel"><h2>Kommt als Nächstes</h2><p class="help">Robin’s Shop (Belohnungen, Einlösen mit PIN), ' +
          'Münzen korrigieren, Übungsziele, Statistik pro App, Namen/Farben der Kinder ändern.</p></div>' +
      '</section>';

    view.querySelectorAll('.toggles input').forEach(function (box) {
      box.addEventListener('change', function () {
        RB.updateChild(box.dataset.child, function (c) {
          c.apps = c.apps.filter(function (id) { return id !== box.dataset.app; });
          if (box.checked) c.apps.push(box.dataset.app);
        });
      });
    });
    document.getElementById('gate-lock').addEventListener('click', function () { RB.gate.lock(); location.reload(); });
    var msg = document.getElementById('bk-msg');
    function json() { return JSON.stringify(RB.backup.exportAll(), null, 2); }
    document.getElementById('bk-download').addEventListener('click', function () {
      try {
        var a = document.createElement('a');
        a.href = URL.createObjectURL(new Blob([json()], { type: 'application/json' }));
        a.download = 'robins-bobins-sicherung-' + RB.dayKey(Date.now()) + '.json';
        document.body.appendChild(a); a.click(); a.remove();
        msg.textContent = 'Sicherung wird heruntergeladen.';
      } catch (e) { msg.textContent = 'Herunterladen geht hier nicht – bitte „Sicherung kopieren“ nutzen.'; }
    });
    document.getElementById('bk-copy').addEventListener('click', function () {
      var t = document.getElementById('bk-text'); t.value = json();
      var fallback = function () { t.select(); msg.textContent = 'Text markiert – jetzt kopieren.'; };
      try { navigator.clipboard.writeText(t.value).then(function () { msg.textContent = 'Sicherung kopiert.'; }, fallback); } catch (e) { fallback(); }
    });
    document.getElementById('bk-import').addEventListener('click', function () {
      try {
        var n = RB.backup.importAll(document.getElementById('bk-text').value);
        msg.textContent = 'Wiederhergestellt (' + n + ' Teile).';
        setTimeout(renderParent, 600);
      } catch (e) { msg.textContent = 'Das ist keine gültige Robin’s-Bobins-Sicherung.'; }
    });
    document.title = 'Eltern · Robin’s Bobins';
  }

  // ---------- router ----------

  function route() {
    var h = location.hash || '#/';
    var m = /^#\/c\/([^/?]+)/.exec(h);
    if (h.indexOf('#/eltern') !== 0) parentUnlocked = false;   // leaving the parent area locks it
    if (m) renderHome(decodeURIComponent(m[1]));
    else if (h.indexOf('#/eltern') === 0) renderParent();
    else renderPicker();
    window.scrollTo(0, 0);
  }
  window.addEventListener('hashchange', route);
  // Coming back from an app with the browser's back button restores a cached page: refresh numbers.
  window.addEventListener('pageshow', function (e) { if (e.persisted) route(); });
  route();

  try { if (navigator.storage && navigator.storage.persist) navigator.storage.persist(); } catch (e) { /* ignore */ }
  try {
    if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol) && window.self === window.top) {
      navigator.serviceWorker.register('sw.js').catch(function () { /* optional */ });
    }
  } catch (e) { /* ignore */ }
})();
