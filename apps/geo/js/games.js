/*
 * games.js — the two "play" formats:
 *   Zuordnen  (matching: Land ↔ Hauptstadt, Wappen ↔ Land, Wappen ↔ Land ↔ Hauptstadt)
 *   Ziehen    (drag names onto the map: Länder, Hauptstädte, Nachbarländer, Flüsse, Städte, Gebirge)
 * Both record every first attempt as an answer, so they feed the same adaptive practice.
 */
(function (root) {
  'use strict';
  var G = root.GEO, C = root.GEO_CONTENT, Q = root.GeoQuestions, U = root.GeoUI, A = root.GeoAdaptive;
  var h = U.h;

  // ------------------------------------------------------------ drag helper
  // Drag the chip onto the map (mouse or finger) — or tap the chip, then tap the map.
  // onDrop(featureId|null) returns true when the chip is used up.
  function dragChip(chip, map, onDrop, onSelect) {
    var ghost = null, start = null, moved = false;
    function end(e) {
      document.removeEventListener('pointermove', move);
      document.removeEventListener('pointerup', end);
      document.removeEventListener('pointercancel', end);
      if (ghost) { ghost.remove(); ghost = null; }
      chip.classList.remove('is-dragging');
      if (!moved) { select(); return; }
      var id = map.pickAt(e.clientX, e.clientY);
      var used = onDrop(id, chip);
      if (!used) bounce();
    }
    function move(e) {
      if (!start) return;
      if (!moved && Math.hypot(e.clientX - start[0], e.clientY - start[1]) < 6) return;
      if (!moved) {
        moved = true;
        ghost = chip.cloneNode(true);
        ghost.className = 'chip chip-ghost';
        document.body.appendChild(ghost);
        chip.classList.add('is-dragging');
      }
      ghost.style.left = e.clientX + 'px'; ghost.style.top = e.clientY + 'px';
      e.preventDefault();
    }
    function bounce() { chip.classList.remove('shake'); void chip.offsetWidth; chip.classList.add('shake'); }
    function select() {
      var on = !chip.classList.contains('is-selected');
      var tray = chip.parentNode;
      if (tray) tray.querySelectorAll('.chip.is-selected').forEach(function (c) { c.classList.remove('is-selected'); });
      chip.classList.toggle('is-selected', on);
      if (onSelect) onSelect(on ? chip : null);
      else map.onPick(on ? function (id) {
        if (!id) return;
        var used = onDrop(id, chip);
        if (!used) bounce();
        chip.classList.remove('is-selected');
        map.onPick(null);
      } : null);
    }
    chip.addEventListener('pointerdown', function (e) {
      if (chip.disabled) return;
      start = [e.clientX, e.clientY]; moved = false;
      document.addEventListener('pointermove', move, { passive: false });
      document.addEventListener('pointerup', end);
      document.addEventListener('pointercancel', end);
    });
    chip.addEventListener('click', function (e) { e.preventDefault(); });   // handled by pointerup
    chip.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); select(); } });
  }

  // Pick the n concepts of a topic that most need practice (plus variety).
  function pickItems(app, topic, n, filter) {
    var now = Date.now();
    var items = Q.topicItems(topic).filter(function (it) { return !filter || filter(it); }).map(function (it) {
      return { it: it, w: A.weight(it.key, app.store.stat(it.key), it.tier, now, null) + 0.5 };
    });
    var out = [];
    while (out.length < n && items.length) {
      var p = G.weighted(items);
      out.push(p.it.id);
      items.splice(items.indexOf(p), 1);
    }
    return out;
  }

  function record(app, topic, item, ok, mode) {
    app.store.answer({ topic: topic, item: item, ok: ok, mode: mode || 'game' }, A.update);
  }

  // ------------------------------------------------------------ Zuordnen
  var MATCH = {
    hauptstaedte: { title: 'Land ↔ Hauptstadt', topic: 'hauptstaedte', cols: ['land', 'hauptstadt'] },
    wappen: { title: 'Wappen ↔ Land', topic: 'wappen', cols: ['wappen', 'land'] },
    wappen3: { title: 'Wappen ↔ Land ↔ Hauptstadt', topic: 'wappen', cols: ['wappen', 'land', 'hauptstadt'] }
  };
  function cardFor(col, st) {
    if (col === 'wappen') return [U.wappenImg(st.wappen)];
    if (col === 'land') return [h('span', { text: st.name })];
    return [h('span', { text: st.capital })];
  }

  function match(app, kind) {
    var def = MATCH[kind], n = def.cols.length === 3 ? 4 : 5;
    var ids = pickItems(app, def.topic, n);
    var started = Date.now(), firstTry = {}, solved = 0;
    var view = h('section', { 'class': 'game match cols-' + def.cols.length });
    app.setView(view, { back: true, overlay: true });
    view.appendChild(h('div', { 'class': 'game-head' }, [
      h('h1', { text: '🔗 ' + def.title }),
      h('p', { 'class': 'q-sub', text: def.cols.length === 3 ? 'Tippe in jeder Spalte auf eins, das zusammengehört.' : 'Tippe links und rechts auf das, was zusammengehört.' })
    ]));
    var msg = h('p', { 'class': 'game-msg', 'aria-live': 'polite' });
    var board = h('div', { 'class': 'match-board' });
    var sel = {};
    def.cols.forEach(function (col) {
      var colEl = h('div', { 'class': 'match-col col-' + col });
      G.shuffle(ids).forEach(function (id) {
        var st = Q.STATE[id];
        var b = h('button', { 'class': 'match-card', type: 'button', 'data-id': id, 'data-col': col }, cardFor(col, st));
        b.addEventListener('click', function () {
          if (b.classList.contains('is-done')) return;
          colEl.querySelectorAll('.is-sel').forEach(function (x) { x.classList.remove('is-sel'); });
          b.classList.add('is-sel'); sel[col] = b;
          if (def.cols.every(function (c) { return sel[c]; })) check();
        });
        colEl.appendChild(b);
      });
      board.appendChild(colEl);
    });
    view.appendChild(board);
    view.appendChild(msg);

    function check() {
      var picked = def.cols.map(function (c) { return sel[c]; });
      var key = picked[0].getAttribute('data-id');
      var ok = picked.every(function (b) { return b.getAttribute('data-id') === key; });
      // the item judged is the one in the first column
      if (!(key in firstTry)) { firstTry[key] = ok; record(app, def.topic, key, ok, 'match'); }
      if (ok) {
        picked.forEach(function (b) { b.classList.remove('is-sel'); b.classList.add('is-done'); b.disabled = true; });
        var st = Q.STATE[key];
        msg.textContent = G.pick(['Richtig!', 'Super!', 'Genau!']) + ' ' + st.name + ' – ' + st.capital + '.';
        msg.className = 'game-msg ok';
        solved++;
        if (solved === ids.length) setTimeout(done, 700);
      } else {
        picked.forEach(function (b) { b.classList.remove('is-sel'); b.classList.add('shake'); setTimeout(function () { b.classList.remove('shake'); }, 500); });
        var st1 = Q.STATE[picked[0].getAttribute('data-id')];
        msg.textContent = 'Nicht ganz. ' + (def.cols[0] === 'wappen' ? 'Dieses Wappen gehört zu ' + st1.name + '.' : st1.name + ' hat die Hauptstadt ' + st1.capital + '.');
        msg.className = 'game-msg no';
      }
      sel = {};
    }
    function done() {
      var right = Object.keys(firstTry).filter(function (k) { return firstTry[k]; }).length;
      finishGame(app, view, { title: 'Alle gefunden!', right: right, total: ids.length, started: started, kind: 'match-' + kind,
        again: function () { match(app, kind); } });
    }
  }

  // ------------------------------------------------------------ Ziehen (map)
  var DRAG = {
    laender: { title: 'Bundesländer auf die Karte', map: 'germany', topic: 'laender', pick: 'state', n: 8,
               chip: function (id) { return Q.STATE[id].name; }, target: function (id) { return 'state-' + id; } },
    hauptstaedte: { title: 'Hauptstädte auf die Karte', map: 'germany', topic: 'hauptstaedte', pick: 'state', n: 8, capitals: true,
               chip: function (id) { return Q.STATE[id].capital; }, target: function (id) { return 'state-' + id; },
               filter: function (it) { return !Q.STATE[it.id].cityState; } },
    nachbarn: { title: 'Nachbarländer auf die Karte', map: 'europe', topic: 'nachbarn', pick: 'country', n: 9,
               chip: function (id) { return Q.COUNTRY[id].name; }, target: function (id) { return 'country-' + id; },
               filter: function (it) { return it.id !== 'unterscheiden'; } },
    fluesse: { title: 'Flüsse beschriften', map: 'hessen', topic: 'fluesse', pick: 'river', n: 9, layers: { rivers: true, towns: true, townsQuiet: true },
               chip: function (id) { return Q.RIVER[id].name; }, target: function (id) { return 'river-' + id; },
               filter: function (it) { return it.tier === 'core'; } },
    staedte: { title: 'Städte beschriften', map: 'hessen', topic: 'staedte', pick: 'town', n: 8, layers: { towns: true },
               chip: function (id) { return Q.tname(Q.TOWN[id]); }, target: function (id) { return 'town-' + id; },
               filter: function (it) { return !Q.TOWN[it.id].home; } },
    gebirge: { title: 'Gebirge beschriften', map: 'hessen', topic: 'gebirge', pick: 'region', n: 6, layers: { regions: true, towns: true, townsQuiet: true },
               chip: function (id) { return Q.MOUNT[id].name; }, target: function (id) { return 'region-' + id; } }
  };

  function mapDrag(app, kind) {
    var def = DRAG[kind];
    var ids = pickItems(app, def.topic, def.n, def.filter);
    var started = Date.now(), firstTry = {}, placed = 0;
    var view = h('section', { 'class': 'game dragmap' });
    app.setView(view, { back: true, overlay: true });
    view.appendChild(h('div', { 'class': 'game-head' }, [h('h1', { text: '✋ ' + def.title }),
      h('p', { 'class': 'q-sub', text: 'Ziehe jeden Namen an die richtige Stelle. Oder: Namen antippen, dann auf die Karte tippen.' })]));
    var map = GeoMap.create(def.map, { layers: def.layers || {}, pick: def.pick, anchor: def.map === 'hessen', capitals: def.capitals });
    if (def.map === 'hessen') map.showLabel('town-wehrheim', true);
    var msg = h('p', { 'class': 'game-msg', 'aria-live': 'polite' });
    var tray = h('div', { 'class': 'drag-tray' });
    view.appendChild(h('div', { 'class': 'drag-layout' }, [map.el, h('div', { 'class': 'drag-side' }, [tray, msg])]));

    G.shuffle(ids).forEach(function (id) {
      var chip = h('button', { 'class': 'chip', type: 'button', text: def.chip(id) });
      tray.appendChild(chip);
      dragChip(chip, map, function (fid) {
        if (!fid) { msg.textContent = 'Lass das Schild direkt auf ' + (def.pick === 'town' ? 'einem Punkt' : def.pick === 'river' ? 'einem Fluss' : 'einem Gebiet') + ' los.'; msg.className = 'game-msg'; return false; }
        var ok = fid === def.target(id);
        if (!(id in firstTry)) { firstTry[id] = ok; record(app, def.topic, id, ok, 'drag'); }
        if (ok) {
          map.mark(fid, 'done'); map.showLabel(fid, true);
          if (kind === 'hauptstaedte') map.showLabel('cap-' + id, true);
          chip.remove();
          placed++;
          msg.textContent = G.pick(['Richtig!', 'Super!', 'Passt!']) + ' ' + def.chip(id) + '.'; msg.className = 'game-msg ok';
          if (placed === ids.length) setTimeout(done, 600);
          return true;
        }
        map.mark(fid, 'wrong');
        setTimeout(function () { map.mark(fid, 'wrong', false); }, 900);
        var nm = map.nameOf(fid);
        msg.textContent = 'Nicht ganz' + (nm ? ' – das ist ' + nm : '') + '. Versuch es nochmal!'; msg.className = 'game-msg no';
        return false;
      });
    });
    function done() {
      var right = Object.keys(firstTry).filter(function (k) { return firstTry[k]; }).length;
      finishGame(app, view, { title: 'Karte fertig beschriftet!', right: right, total: ids.length, started: started, kind: 'drag-' + kind,
        again: function () { mapDrag(app, kind); } });
    }
  }

  function finishGame(app, view, o) {
    var coins = app.reward({ total: o.total, correct: o.right, startedAt: o.started, endedAt: Date.now() }, 'game', o.kind);
    if (o.right === o.total) U.confetti();
    var box = h('div', { 'class': 'end game-end' }, [
      h('div', { 'class': 'end-hero' }, [app.robin('celebrating', 100), h('div', {}, [h('h1', { text: o.title }),
        h('p', { text: o.right + ' von ' + o.total + ' gleich beim ersten Mal richtig.' }),
        coins ? h('div', { 'class': 'end-coins' }, [h('span', { 'class': 'rb-coin' }), ' +' + coins + ' Münzen']) : null])]),
      h('div', { 'class': 'end-actions' }, [
        h('button', { 'class': 'rb-btn', type: 'button', text: 'Nochmal spielen', onclick: o.again }),
        h('button', { 'class': 'rb-btn rb-btn-soft', type: 'button', text: 'Zurück zum Üben', onclick: function () { app.go('ueben'); } })
      ])
    ]);
    view.appendChild(box);
    box.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  root.GeoGames = { dragChip: dragChip, match: match, mapDrag: mapDrag, MATCH: MATCH, DRAG: DRAG };
})(typeof window !== 'undefined' ? window : globalThis);
