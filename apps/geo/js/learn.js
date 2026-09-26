/*
 * learn.js — LERNEN: look, tap, discover. Nothing is graded here.
 */
(function (root) {
  'use strict';
  var G = root.GEO, C = root.GEO_CONTENT, Q = root.GeoQuestions, U = root.GeoUI, K = root.GeoKarte;
  var h = U.h;

  var AREAS = [
    { id: 'laender', icon: '🗺️', title: 'Bundesländer & Hauptstädte', sub: '16 Länder, 16 Hauptstädte' },
    { id: 'wappen', icon: '🛡️', title: 'Wappen', sub: 'Alle 16 Landeswappen' },
    { id: 'nachbarn', icon: '🌍', title: 'Nachbarländer', sub: '9 Länder rund um Deutschland' },
    { id: 'hessen', icon: '🏞️', title: 'Hessen', sub: 'Städte, Flüsse, Gebirge' },
    { id: 'karte', icon: '🧭', title: 'Kartenkunde', sub: 'Legende, Planquadrate, Himmelsrichtungen' }
  ];

  function menu(app) {
    var v = h('section', { 'class': 'menu' }, [h('h1', { 'class': 'screen-h', text: '📖 Lernen' }),
      h('p', { 'class': 'screen-sub', text: 'Schau dir alles in Ruhe an. Tippe auf die Karten!' })]);
    var grid = h('div', { 'class': 'tiles' });
    AREAS.forEach(function (a) {
      grid.appendChild(h('button', { 'class': 'tile', type: 'button', 'data-area': a.id, onclick: function () { app.go('lernen/' + a.id); } }, [
        h('span', { 'class': 'tile-icon', text: a.icon }), h('span', { 'class': 'tile-title', text: a.title }), h('span', { 'class': 'tile-sub', text: a.sub })]));
    });
    v.appendChild(grid);
    app.setView(v, { back: true });
  }

  function infoCard(parent) {
    var c = h('div', { 'class': 'info-card', 'aria-live': 'polite', hidden: true });
    parent.appendChild(c);
    return function (kids) { c.innerHTML = ''; kids.forEach(function (k) { if (k) c.appendChild(k); }); c.hidden = false; c.classList.remove('pop'); void c.offsetWidth; c.classList.add('pop'); };
  }

  function playRow(app, items) {
    return h('div', { 'class': 'play-row' }, [h('span', { 'class': 'play-h', text: 'Jetzt ausprobieren:' })].concat(items.map(function (it) {
      return h('button', { 'class': 'rb-btn rb-btn-soft small', type: 'button', text: it[0], onclick: it[1] });
    })));
  }

  // ------------------------------------------------------------ Bundesländer
  function laender(app) {
    var v = h('section', { 'class': 'learn' }, [h('h1', { 'class': 'screen-h', text: '🗺️ Bundesländer & Hauptstädte' }),
      h('p', { 'class': 'screen-sub', text: 'Tippe auf ein Bundesland.' })]);
    var map = GeoMap.create('germany', { capitals: true });
    map.setPick('state');
    var namesOn = false;
    var toggle = h('button', { 'class': 'toggle', type: 'button', 'aria-pressed': 'false', text: 'Alle Namen zeigen' });
    toggle.addEventListener('click', function () {
      namesOn = !namesOn; toggle.setAttribute('aria-pressed', String(namesOn));
      map.el.classList.toggle('show-labels', namesOn);
    });
    var side = h('div', { 'class': 'learn-side' });
    var show = infoCard(side);
    function select(id) {
      var st = Q.STATE[id];
      map.clearMarks(); map.mark('state-' + id, 'hl');
      Object.keys(map.labels).forEach(function (k) { map.showLabel(k, false); });
      map.showLabel('state-' + id, true); map.showLabel('cap-' + id, true);
      show([U.wappenImg(st.wappen), h('div', {}, [h('h2', { text: st.name }), h('p', { text: 'Hauptstadt: ' + st.capital }),
        st.home ? h('p', { 'class': 'home-note', text: '🏠 Hier wohnst du!' }) : null,
        st.cityState ? h('p', { 'class': 'note', text: 'Stadtstaat: Die Stadt ist selbst ein Bundesland.' }) : null])]);
      list.querySelectorAll('.st-row').forEach(function (r) { r.classList.toggle('is-on', r.getAttribute('data-id') === id); });
    }
    map.onPick(function (fid) { if (fid) select(fid.replace('state-', '')); });
    var list = h('div', { 'class': 'st-list' });
    C.states.forEach(function (st) {
      list.appendChild(h('button', { 'class': 'st-row', type: 'button', 'data-id': st.id, onclick: function () { select(st.id); } },
        [U.wappenImg(st.wappen, 'tiny'), h('span', { 'class': 'st-name', text: st.name }), h('span', { 'class': 'st-cap', text: st.capital })]));
    });
    side.appendChild(list);
    v.appendChild(h('div', { 'class': 'learn-tools' }, [toggle]));
    v.appendChild(h('div', { 'class': 'learn-layout' }, [map.el, side]));
    v.appendChild(playRow(app, [
      ['🔗 Land ↔ Hauptstadt', function () { GeoGames.match(app, 'hauptstaedte'); }],
      ['✋ Länder auf die Karte', function () { GeoGames.mapDrag(app, 'laender'); }],
      ['✋ Hauptstädte auf die Karte', function () { GeoGames.mapDrag(app, 'hauptstaedte'); }]
    ]));
    app.setView(v, { back: true });
    select('hessen');
  }

  // ------------------------------------------------------------ Wappen
  function wappen(app) {
    var v = h('section', { 'class': 'learn' }, [h('h1', { 'class': 'screen-h', text: '🛡️ Wappen der Bundesländer' }),
      h('p', { 'class': 'screen-sub', text: 'Tipp: Achte auf Tiere und Farben. Mit »Verdecken« kannst du dich selbst testen.' })]);
    var hideOn = false;
    var toggle = h('button', { 'class': 'toggle', type: 'button', 'aria-pressed': 'false', text: 'Namen verdecken' });
    var gal = h('div', { 'class': 'gallery' });
    toggle.addEventListener('click', function () {
      hideOn = !hideOn; toggle.setAttribute('aria-pressed', String(hideOn));
      gal.classList.toggle('is-covered', hideOn);
      gal.querySelectorAll('.w-card').forEach(function (c) { c.classList.remove('is-open'); });
    });
    var HINT = { bw: 'Drei schwarze Löwen, Hirsch und Greif', by: 'Blau-weiße Rauten, zwei Löwen', be: 'Schwarzer Bär', bb: 'Roter Adler',
      hb: 'Silberner Schlüssel', hh: 'Weiße Burg mit drei Türmen', he: 'Rot-weiß gestreifter Löwe auf Blau, ohne Sterne', mv: 'Stierköpfe, Greif und Adler',
      ni: 'Weißes Pferd auf Rot', nw: 'Welle, Pferd und Rose', rp: 'Kreuz, Rad und Löwe', sl: 'Vier Felder: zwei Löwen, ein Kreuz, drei kleine Adler',
      sn: 'Grüner Rautenkranz auf Gelb-Schwarz', st: 'Oben Rautenkranz und Adler, unten ein Bär auf einer Mauer', sh: 'Zwei Löwen und ein Nesselblatt', th: 'Wie Hessen – aber mit acht weißen Sternen!' };
    C.states.forEach(function (st) {
      var card = h('button', { 'class': 'w-card', type: 'button', 'data-id': st.id }, [
        U.wappenImg(st.wappen), h('span', { 'class': 'w-name', text: st.name }), h('span', { 'class': 'w-cap', text: 'Hauptstadt: ' + st.capital }),
        h('span', { 'class': 'w-hint', text: HINT[st.wappen] || '' })]);
      card.addEventListener('click', function () { card.classList.toggle('is-open'); });
      gal.appendChild(card);
    });
    v.appendChild(h('div', { 'class': 'learn-tools' }, [toggle]));
    v.appendChild(gal);
    v.appendChild(h('p', { 'class': 'source-note', html: 'Wappen: Originaldateien aus Wikimedia Commons (gemeinfrei, amtliche Werke). <a href="SOURCES.md" target="_blank" rel="noopener">Quellen</a>' }));
    v.appendChild(playRow(app, [
      ['🔗 Wappen ↔ Land', function () { GeoGames.match(app, 'wappen'); }],
      ['🔗 Wappen ↔ Land ↔ Hauptstadt', function () { GeoGames.match(app, 'wappen3'); }]
    ]));
    app.setView(v, { back: true });
  }

  // ------------------------------------------------------------ Nachbarländer
  function nachbarn(app) {
    var v = h('section', { 'class': 'learn' }, [h('h1', { 'class': 'screen-h', text: '🌍 Deutschlands Nachbarländer' }),
      h('p', { 'class': 'screen-sub', text: 'Deutschland hat 9 Nachbarländer. Tippe auf ein Land!' })]);
    var map = GeoMap.create('europe', { compass: true, pick: 'country' });
    var side = h('div', { 'class': 'learn-side' });
    var show = infoCard(side);
    map.onPick(function (fid) {
      if (!fid) return;
      var c = Q.COUNTRY[fid.replace('country-', '')];
      map.clearMarks(); map.mark(fid, 'hl');
      Object.keys(map.labels).forEach(function (k) { map.showLabel(k, false); });
      map.showLabel(fid, true);
      if (c.self) return show([h('h2', { text: '🇩🇪 Deutschland' }), h('p', { text: 'Hier wohnst du. Rundherum liegen 9 Nachbarländer.' })]);
      show([h('h2', { text: c.name }), c.neighbour
        ? h('p', { 'class': 'yes', text: '✓ Nachbarland – liegt im ' + Q.DIRNAME[c.dir] + ' von Deutschland.' })
        : h('p', { 'class': 'no', text: '✗ Kein Nachbarland. Es grenzt nicht an Deutschland.' })]);
    });
    var byDir = { N: [], O: [], S: [], W: [] };
    C.countries.forEach(function (c) { if (c.neighbour) byDir[c.dir].push(c.name); });
    var dirs = h('div', { 'class': 'dir-box' }, ['N', 'O', 'S', 'W'].map(function (d) {
      return h('div', { 'class': 'dir-row' }, [h('b', { text: Q.DIRNAME[d] + ':' }), h('span', { text: ' ' + byDir[d].join(', ') })]);
    }));
    side.appendChild(dirs);
    var toggle = h('button', { 'class': 'toggle', type: 'button', 'aria-pressed': 'false', text: 'Alle Namen zeigen' });
    toggle.addEventListener('click', function () {
      var on = toggle.getAttribute('aria-pressed') !== 'true'; toggle.setAttribute('aria-pressed', String(on));
      map.el.classList.toggle('show-labels', on);
    });
    v.appendChild(h('div', { 'class': 'learn-tools' }, [toggle, h('span', { 'class': 'legend-dot nb', text: 'Nachbarland' }), h('span', { 'class': 'legend-dot other', text: 'kein Nachbarland' })]));
    v.appendChild(h('div', { 'class': 'learn-layout' }, [map.el, side]));
    v.appendChild(playRow(app, [['✋ Nachbarländer auf die Karte', function () { GeoGames.mapDrag(app, 'nachbarn'); }]]));
    app.setView(v, { back: true });
  }

  // ------------------------------------------------------------ Hessen
  function hessen(app) {
    var v = h('section', { 'class': 'learn' }, [h('h1', { 'class': 'screen-h', text: '🏞️ Hessen' }),
      h('p', { 'class': 'screen-sub', text: 'Schalte Städte, Flüsse und Gebirge ein. Tippe auf alles, was du siehst!' })]);
    var layers = { towns: true, rivers: false, regions: false };
    var map = GeoMap.create('hessen', { layers: layers, anchor: true, compass: true, neighbourNames: true });
    map.showLabel('town-wehrheim', true);
    var side = h('div', { 'class': 'learn-side' });
    var show = infoCard(side);

    function pickAny(evt) {
      // In learning mode anything visible can be tapped: towns first (small), then rivers, then regions.
      var kinds = ['town', 'river', 'region'].filter(function (k) { return layers[{ town: 'towns', river: 'rivers', region: 'regions' }[k]]; });
      for (var i = 0; i < kinds.length; i++) { map.setPick(kinds[i]); var id = map.pickAt(evt.clientX, evt.clientY); if (id) return id; }
      return null;
    }
    map.svg.addEventListener('click', function (evt) {
      var id = pickAny(evt);
      if (id) select(id);
    });
    function select(id) {
      map.clearMarks(); map.mark(id, 'hl'); map.showLabel(id, true);
      var kind = id.split('-')[0], key = id.slice(kind.length + 1);
      if (kind === 'town') {
        var t = Q.TOWN[key];
        var rel = '';
        if (!t.home) {
          var d = G.clearDirection(G.bearing(Q.TOWN.wehrheim.lonLat, t.lonLat));
          var km = Math.round(G.distKm(Q.TOWN.wehrheim.lonLat, t.lonLat) / 5) * 5;
          rel = d ? 'Von Wehrheim aus: ' + d.name + ', etwa ' + km + ' km.' : 'Von Wehrheim etwa ' + km + ' km entfernt.';
        }
        show([h('h2', { text: (t.home ? '🏠 ' : t.capital ? '⭐ ' : '🏙️ ') + t.name }), h('p', { text: t.fact }), rel ? h('p', { 'class': 'note', text: rel }) : null]);
      } else if (kind === 'river') {
        var r = Q.RIVER[key], ch = Q.chain(key);
        var trib = C.rivers.filter(function (x) { return x.into === key; }).map(function (x) { return x.name; });
        show([h('h2', { text: '🌊 ' + r.name }), h('p', { text: r.fact }),
          ch.length > 1 ? h('p', { 'class': 'chain', text: ch.join(' → ') }) : null,
          r.becomes ? h('p', { 'class': 'chain', text: 'Fulda + Werra → Weser' }) : null,
          trib.length ? h('p', { 'class': 'note', text: 'Hinein fließt: ' + trib.join(', ') }) : null]);
      } else if (kind === 'region') {
        var m = Q.MOUNT[key];
        show([h('h2', { text: '⛰️ ' + m.name }), h('p', { text: m.fact }), h('p', { 'class': 'note', text: 'Liegt ' + m.where + ' von Hessen.' }),
          m.peaks.length ? h('p', { 'class': 'note', text: '▲ ' + m.peaks[0].name + ' (' + m.peaks[0].ele + ' m)' }) : null]);
      }
    }
    function layerBtn(key, label) {
      var b = h('button', { 'class': 'toggle layer-' + key, type: 'button', 'aria-pressed': String(layers[key]), text: label });
      b.addEventListener('click', function () {
        layers[key] = !layers[key]; b.setAttribute('aria-pressed', String(layers[key]));
        map.setLayer(key, layers[key]);
        if (key === 'towns') map.el.classList.toggle('anchor-only', !layers.towns);
      });
      return b;
    }
    var namesBtn = h('button', { 'class': 'toggle', type: 'button', 'aria-pressed': 'true', text: 'Namen' });
    map.el.classList.add('show-labels');
    namesBtn.addEventListener('click', function () {
      var on = namesBtn.getAttribute('aria-pressed') !== 'true'; namesBtn.setAttribute('aria-pressed', String(on));
      map.el.classList.toggle('show-labels', on);
    });
    var homeBtn = h('button', { 'class': 'rb-btn small', type: 'button', text: '🏠 Hier ist Wehrheim', onclick: function () {
      select('town-wehrheim');
      var mk = map.shapes['town-wehrheim']; mk.classList.remove('ping'); void mk.getBBox(); mk.classList.add('ping');
    } });
    v.appendChild(h('div', { 'class': 'learn-tools' }, [layerBtn('towns', '🏙️ Städte'), layerBtn('rivers', '🌊 Flüsse'), layerBtn('regions', '⛰️ Gebirge'), namesBtn, homeBtn]));
    v.appendChild(h('div', { 'class': 'learn-layout' }, [map.el, side]));

    // River system: how the water flows
    var sys = h('div', { 'class': 'river-system' }, [h('h2', { text: '🌊 Wohin fließt das Wasser?' }),
      flow(['Nidder', 'Nidda', 'Main', 'Rhein']), flow(['Kinzig', 'Main', 'Rhein']), flow(['Lahn', 'Rhein']),
      flow(['Eder', 'Fulda']), h('div', { 'class': 'flow' }, [h('span', { 'class': 'fl', text: 'Fulda' }), h('span', { 'class': 'plus', text: '+' }),
        h('span', { 'class': 'fl', text: 'Werra' }), h('span', { 'class': 'arrow', text: '→' }), h('span', { 'class': 'fl big', text: 'Weser' })])]);
    function flow(names) {
      var kids = [];
      names.forEach(function (n, i) { if (i) kids.push(h('span', { 'class': 'arrow', text: '→' })); kids.push(h('span', { 'class': 'fl' + (i === names.length - 1 ? ' big' : ''), text: n })); });
      return h('div', { 'class': 'flow' }, kids);
    }
    var mts = h('div', { 'class': 'mt-box' }, [h('h2', { text: '⛰️ Wo liegen die Gebirge?' })].concat(C.mountains.map(function (m) {
      return h('div', { 'class': 'mt-row' }, [h('b', { text: m.name }), h('span', { text: ' ' + m.where + (m.id === 'taunus' ? ' – hier wohnst du!' : '') })]);
    })));
    v.appendChild(h('div', { 'class': 'learn-facts' }, [sys, mts]));
    v.appendChild(playRow(app, [
      ['✋ Städte beschriften', function () { GeoGames.mapDrag(app, 'staedte'); }],
      ['✋ Flüsse beschriften', function () { GeoGames.mapDrag(app, 'fluesse'); }],
      ['✋ Gebirge beschriften', function () { GeoGames.mapDrag(app, 'gebirge'); }]
    ]));
    v.appendChild(h('p', { 'class': 'source-note', text: 'Karte: © OpenStreetMap-Mitwirkende (ODbL), Natural Earth. Vereinfacht.' }));
    app.setView(v, { back: true });
    select('town-wehrheim');
  }

  // ------------------------------------------------------------ Kartenkunde
  function karte(app) {
    var v = h('section', { 'class': 'learn karte' }, [h('h1', { 'class': 'screen-h', text: '🧭 Kartenkunde' })]);
    // Legende
    v.appendChild(h('div', { 'class': 'kk-block' }, [h('h2', { text: '🔣 Die Legende erklärt die Zeichen' }),
      h('div', { 'class': 'legend-grid' }, C.legend.map(function (l) { return h('div', { 'class': 'lg-cell' }, [U.symbol(l.id, 52), h('span', { text: l.name })]); }))]));
    // Planquadrate
    var scene = K.makeScene();
    var pqBox = h('div', { 'class': 'kk-block' });
    var pqMsg = h('p', { 'class': 'pq-msg', 'aria-live': 'polite', text: 'Tippe auf ein Kästchen!' });
    function drawScene() {
      var sv = U.sceneView(scene, { legend: true });
      sv.svg.classList.add('cells-live');
      sv.svg.addEventListener('click', function (e) {
        var cell = e.target.getAttribute && e.target.getAttribute('data-cell');
        if (!cell) return;
        sv.svg.querySelectorAll('.is-reveal').forEach(function (x) { x.classList.remove('is-reveal'); });
        U.markCell(sv.svg, cell, 'is-reveal');
        var o = K.objectAt(scene, cell);
        pqMsg.innerHTML = '';
        pqMsg.appendChild(h('b', { text: cell })); pqMsg.appendChild(document.createTextNode(' = Spalte ' + cell[0] + ', Zeile ' + cell.slice(1) + (o ? ' → hier liegt ' + Q.OBJ_NAME[o.id] + '.' : '.')));
      });
      return sv.el;
    }
    var holder = h('div', {}, [drawScene()]);
    pqBox.appendChild(h('h2', { text: '#️⃣ Planquadrate' }));
    pqBox.appendChild(h('p', { 'class': 'kk-rule', text: 'Erst den Buchstaben oben, dann die Zahl an der Seite: B4 = Spalte B, Zeile 4.' }));
    pqBox.appendChild(holder); pqBox.appendChild(pqMsg);
    pqBox.appendChild(h('button', { 'class': 'rb-btn rb-btn-soft small', type: 'button', text: '🔄 Neue Karte', onclick: function () {
      scene = K.makeScene(); holder.innerHTML = ''; holder.appendChild(drawScene()); pqMsg.textContent = 'Tippe auf ein Kästchen!';
    } }));
    v.appendChild(pqBox);
    // Himmelsrichtungen
    v.appendChild(h('div', { 'class': 'kk-block kk-rose' }, [h('h2', { text: '🧭 Himmelsrichtungen' }),
      h('div', { 'class': 'rose-learn' }, [U.roseView({}), h('div', {}, [
        h('p', { 'class': 'kk-rule', html: '<b>N</b>orden ist auf Karten <b>oben</b>, <b>S</b>üden unten, <b>O</b>sten rechts, <b>W</b>esten links.' }),
        h('p', { 'class': 'kk-rule', html: 'Merkspruch im Uhrzeigersinn: <b>N</b>ie <b>O</b>hne <b>S</b>eife <b>W</b>aschen.' }),
        h('p', { 'class': 'note', text: 'Dazwischen: Nordosten, Südosten, Südwesten, Nordwesten.' }),
        h('p', { 'class': 'note', text: 'Beispiel: Frankfurt liegt südlich von Wehrheim. Hanau liegt südöstlich.' })])])]));
    v.appendChild(playRow(app, [
      ['🔣 Legende üben', function () { app.startPractice(['legende'], 'Legende'); }],
      ['#️⃣ Planquadrate üben', function () { app.startPractice(['planquadrate'], 'Planquadrate'); }],
      ['🧭 Himmelsrichtungen üben', function () { app.startPractice(['richtungen'], 'Himmelsrichtungen'); }]
    ]));
    app.setView(v, { back: true });
  }

  root.GeoLearn = { menu: menu, laender: laender, wappen: wappen, nachbarn: nachbarn, hessen: hessen, karte: karte, AREAS: AREAS };
})(typeof window !== 'undefined' ? window : globalThis);
