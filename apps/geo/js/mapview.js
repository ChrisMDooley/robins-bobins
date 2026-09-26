/*
 * mapview.js — interactive SVG maps built from data/maps.js.
 *
 *   var m = GeoMap.create('hessen', { layers: {towns, rivers, regions, labels}, anchor: true,
 *                                     capitals: true, compass: true, pick: 'river' });
 *   container.appendChild(m.el);
 *   m.onPick(function (featureId, evt) {...});
 *   m.highlight(['river-main']);  m.mark('town-kassel', 'right'|'wrong'|'reveal'|'chosen');
 *   m.setLayer('rivers', false);  m.showLabel(id, true);
 *
 * Every shape carries data-id (state-hessen, country-polen, town-kassel, river-nidder,
 * region-taunus), so questions can point at anything by id.
 */
(function (root) {
  'use strict';
  var G = root.GEO, C = root.GEO_CONTENT, M = root.GEO_MAPS;
  var NS = 'http://www.w3.org/2000/svg';

  function el(tag, attrs, parent) {
    var e = document.createElementNS(NS, tag);
    for (var k in attrs) if (attrs[k] != null) e.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(e);
    return e;
  }
  function text(parent, x, y, str, cls) {
    var t = el('text', { x: x, y: y, 'class': cls }, parent);
    t.textContent = str;
    return t;
  }
  function byId(list) { var o = {}; list.forEach(function (x) { o[x.id] = x; }); return o; }
  var STATES = byId(C.states), COUNTRIES = byId(C.countries), TOWNS = byId(C.towns),
      RIVERS = byId(C.rivers), MOUNTS = byId(C.mountains);

  function nameOf(id) {
    var p = id.split('-'), kind = p.shift(), key = p.join('-');
    var src = { state: STATES, country: COUNTRIES, town: TOWNS, river: RIVERS, region: MOUNTS, nstate: STATES }[kind];
    var x = src && src[key];
    return x ? (x.short || x.name) : '';
  }

  function compass(parent, x, y, r) {
    var g = el('g', { 'class': 'map-compass', transform: 'translate(' + x + ' ' + y + ')' }, parent);
    el('circle', { r: r + 9, 'class': 'mc-bg' }, g);
    el('path', { d: 'M0 ' + (-r) + ' L' + (r * 0.28) + ' 0 L0 ' + (r * 0.2) + ' L' + (-r * 0.28) + ' 0 Z', 'class': 'mc-n' }, g);
    el('path', { d: 'M0 ' + r + ' L' + (r * 0.28) + ' 0 L0 ' + (-r * 0.2) + ' L' + (-r * 0.28) + ' 0 Z', 'class': 'mc-s' }, g);
    el('path', { d: 'M' + (-r) + ' 0 L0 ' + (r * 0.22) + ' L' + r + ' 0 L0 ' + (-r * 0.22) + ' Z', 'class': 'mc-s', opacity: '.6' }, g);
    text(g, 0, -r - 12, 'N', 'mc-lab');
    text(g, r + 14, 5, 'O', 'mc-lab mc-lab-s');
    text(g, 0, r + 22, 'S', 'mc-lab mc-lab-s');
    text(g, -r - 14, 5, 'W', 'mc-lab mc-lab-s');
    return g;
  }

  // Wehrheim marker: a little house, so it reads as "home" and not as one more dot.
  function homeMarker(parent, x, y) {
    var g = el('g', { 'class': 'home-mark', transform: 'translate(' + x + ' ' + y + ')' }, parent);
    el('circle', { r: 13, 'class': 'home-halo' }, g);
    el('path', { d: 'M-7 1 L0 -6 L7 1 V8 H-7 Z', 'class': 'home-house' }, g);
    el('path', { d: 'M-9 1 L0 -8 L9 1', 'class': 'home-roof' }, g);
    return g;
  }

  function create(mapName, opts) {
    opts = opts || {};
    var data = M[mapName], P = data.proj;
    var layers = opts.layers || {};
    var wrap = document.createElement('div');
    wrap.className = 'map map-' + mapName + (opts.labels ? ' show-labels' : '') + (opts.neutral ? ' neutral' : '');
    var pad = 6;
    var svg = el('svg', { viewBox: (-pad) + ' ' + (-pad) + ' ' + (P.w + 2 * pad) + ' ' + (P.h + 2 * pad),
                          'class': 'map-svg', role: 'img', 'aria-label': 'Karte' });
    wrap.appendChild(svg);
    var gBase = el('g', { 'class': 'l-base' }, svg);
    var gReg = el('g', { 'class': 'l-regions' }, svg);
    var gRiv = el('g', { 'class': 'l-rivers' }, svg);
    var gTown = el('g', { 'class': 'l-towns' }, svg);
    var gLab = el('g', { 'class': 'l-labels' }, svg);
    var gTop = el('g', { 'class': 'l-top' }, svg);
    var shapes = {}, labels = {}, points = {};     // id → element / label / [x,y]

    if (mapName === 'germany') {
      data.states.forEach(function (s) {
        shapes[s.id] = el('path', { d: s.d, 'class': 'f state' + (s.key === 'hessen' && !opts.neutral ? ' is-home' : ''), 'data-id': s.id }, gBase);
        var st = STATES[s.key], lab = s.label;
        labels[s.id] = text(gLab, lab[0], lab[1] + 4, st.name, 'lab lab-state' + (st.cityState ? ' lab-small' : ''));
      });
      el('path', { d: data.outline, 'class': 'outline' }, gBase);
      // Small city states: a generous invisible tap target on top.
      data.states.forEach(function (s) {
        if (!STATES[s.key].cityState) return;
        el('circle', { cx: s.label[0], cy: s.label[1], r: s.key === 'bremen' ? 11 : 13, 'class': 'hit-halo', 'data-id': s.id }, gTop);
      });
      if (opts.capitals) C.states.forEach(function (st) {
        var p = G.project(P, st.capitalLonLat);
        el('circle', { cx: p[0], cy: p[1], r: 4, 'class': 'capital-dot' }, gTown);
        points['cap-' + st.id] = p;
        labels['cap-' + st.id] = text(gLab, p[0] + 6, p[1] - 5, st.capital, 'lab lab-cap');
      });
    }

    if (mapName === 'europe') {
      data.countries.forEach(function (c) {
        var cls = 'f country' + (c.key === 'deutschland' ? ' is-de' : c.key && COUNTRIES[c.key].neighbour ? ' is-nb' : c.key ? ' is-other' : ' is-bg');
        shapes[c.id] = el('path', { d: c.d, 'class': cls, 'data-id': c.key ? c.id : null }, gBase);
        if (c.key && c.label) labels[c.id] = text(gLab, c.label[0], c.label[1] + 4, COUNTRIES[c.key].name, 'lab lab-country');
      });
      // Luxemburg / Liechtenstein are tiny: tap halos
      ['luxemburg', 'liechtenstein'].forEach(function (k) {
        var c = data.countries.filter(function (x) { return x.key === k; })[0];
        if (c && c.label) el('circle', { cx: c.label[0], cy: c.label[1], r: k === 'luxemburg' ? 9 : 6, 'class': 'hit-halo', 'data-id': c.id }, gTop);
      });
    }

    if (mapName === 'hessen') {
      data.neighbours.forEach(function (s) {
        el('path', { d: s.d, 'class': 'nstate' }, gBase);
        if (opts.neighbourNames) text(gLab, s.label[0], s.label[1], STATES[s.key].name, 'lab lab-nstate always');
      });
      el('path', { d: data.hessen, 'class': 'hessen-land' }, gBase);
      data.regions.forEach(function (r) {
        shapes[r.id] = el('path', { d: r.d, 'class': 'f region', 'data-id': r.id }, gReg);
        labels[r.id] = text(gLab, r.label[0], r.label[1], MOUNTS[r.key].name, 'lab lab-region');
      });
      data.rivers.forEach(function (r) {
        var grp = el('g', { 'class': 'river-g', 'data-for': r.id }, gRiv);
        el('path', { d: r.d, 'class': 'river-casing', 'stroke-width': r.width + 3 }, grp);
        shapes[r.id] = el('path', { d: r.d, 'class': 'f river' + (RIVERS[r.key].tier === 'extra' ? ' is-extra' : ''), 'stroke-width': r.width, 'data-id': r.id }, grp);
        el('path', { d: r.d, 'class': 'river-hit', 'data-id': r.id }, grp);
      });
      C.towns.forEach(function (t) {
        var p = G.project(P, t.lonLat), id = 'town-' + t.id;
        points[id] = p;
        if (t.home && !opts.plainHome) {
          shapes[id] = homeMarker(gTown, p[0], p[1]);
          shapes[id].setAttribute('data-id', id);
        } else {
          shapes[id] = el('circle', { cx: p[0], cy: p[1], r: t.capital ? 7 : t.tier === 'core' ? 5.5 : 4.2,
            'class': 'f town' + (t.capital ? ' is-capital' : '') + (t.tier === 'extra' ? ' is-extra' : ''), 'data-id': id }, gTown);
        }
        var dx = t.labelDx || 9, anchor = 'start';
        // keep labels of the dense Rhein-Main cluster readable
        var place = { offenbach: [8, 14], 'bad-nauheim': [8, -6], friedberg: [8, 12], 'bad-homburg': [-8, 13, 'end'],
                      wiesbaden: [-9, 4, 'end'], hanau: [8, 4], frankfurt: [-8, -8, 'end'], wetzlar: [-8, 4, 'end'],
                      wehrheim: [-15, -8, 'end'], darmstadt: [9, 4] }[t.id];
        var lx = p[0] + (place ? place[0] : dx), ly = p[1] + (place ? place[1] : 4);
        labels[id] = text(gLab, lx, ly, t.short || t.name, 'lab lab-town' + (t.home ? ' lab-home' : '') + (t.capital ? ' lab-capital' : ''));
        if (place && place[2]) labels[id].setAttribute('text-anchor', place[2]);
      });
    }

    if (opts.compass) compass(gTop, P.w - 34, 44, 20);

    // ---------- layers & labels ----------
    function setLayer(name, on) { wrap.classList.toggle('hide-' + name, !on); }
    if (mapName === 'hessen') {
      setLayer('towns', !!layers.towns || !!opts.anchor);
      if (!layers.towns && opts.anchor) wrap.classList.add('anchor-only');
      setLayer('rivers', !!layers.rivers);
      setLayer('regions', !!layers.regions);
      if (layers.townsQuiet) wrap.classList.add('towns-quiet');
    }
    if (layers.labels) wrap.classList.add('show-labels');
    if (opts.anchor) wrap.classList.add('show-home');

    function showLabel(id, on) { if (labels[id]) labels[id].classList.toggle('on', on !== false); }
    function marks(id, cls, on) {
      var e = shapes[id];
      if (!e) return;
      e.classList.toggle('is-' + cls, on !== false);
      if (e.parentNode && e.parentNode.classList.contains('river-g')) e.parentNode.classList.toggle('is-' + cls, on !== false);
      if (cls === 'hl' || cls === 'reveal' || cls === 'right') bringToFront(e);
    }
    function bringToFront(e) {
      var node = e.parentNode && e.parentNode.classList.contains('river-g') ? e.parentNode : e;
      if (node.parentNode) node.parentNode.appendChild(node);
    }
    function clearMarks() {
      Object.keys(shapes).forEach(function (id) {
        ['hl', 'right', 'wrong', 'reveal', 'chosen', 'done'].forEach(function (c) { marks(id, c, false); });
      });
    }

    // ---------- picking ----------
    var pickCb = null, pickKind = opts.pick || null;
    function svgPoint(evt) {
      var pt = svg.createSVGPoint(); pt.x = evt.clientX; pt.y = evt.clientY;
      var m = svg.getScreenCTM();
      return m ? pt.matrixTransform(m.inverse()) : { x: 0, y: 0 };
    }
    function unitsPerPx() {
      var r = svg.getBoundingClientRect();
      return (P.w + 2 * pad) / Math.max(1, r.width);
    }
    function kindOf(id) { return id ? id.split('-')[0] : null; }

    // Returns a feature id for a screen point, honouring the kind that may be picked.
    function pickAt(clientX, clientY) {
      var kind = pickKind;
      if (kind === 'town') {
        var p = svgPoint({ clientX: clientX, clientY: clientY }), best = null, bd = 1e9, upp = unitsPerPx();
        Object.keys(points).forEach(function (id) {
          if (id.indexOf('town-') !== 0) return;
          var q = points[id], d = Math.hypot(q[0] - p.x, q[1] - p.y);
          if (d < bd) { bd = d; best = id; }
        });
        return bd <= Math.max(26 * upp, 16) ? best : null;     // ≈ 26 screen px tolerance
      }
      if (kind === 'river') {
        // Nearest river line to the finger (rivers meet and cross, so "what is on top" is not enough).
        var pr = svgPoint({ clientX: clientX, clientY: clientY }), bestR = null, bdR = 1e9, uppR = unitsPerPx();
        riverSamples().forEach(function (rs) {
          for (var i = 0; i < rs.pts.length; i++) {
            var d = Math.hypot(rs.pts[i][0] - pr.x, rs.pts[i][1] - pr.y);
            if (d < bdR) { bdR = d; bestR = rs.id; }
          }
        });
        return bdR <= Math.max(18 * uppR, 9) ? bestR : null;    // ≈ 18 screen px
      }
      // Areas: look under the finger, then around it (fingers are wide).
      var offs = [[0, 0], [6, 0], [-6, 0], [0, 6], [0, -6], [10, 10], [-10, 10], [10, -10], [-10, -10], [14, 0], [-14, 0], [0, 14], [0, -14]];
      for (var i = 0; i < offs.length; i++) {
        var list = document.elementsFromPoint ? document.elementsFromPoint(clientX + offs[i][0], clientY + offs[i][1])
                                              : [document.elementFromPoint(clientX + offs[i][0], clientY + offs[i][1])];
        for (var j = 0; j < list.length; j++) {
          var e = list[j];
          if (!e || !svg.contains(e)) continue;
          var id = e.getAttribute && e.getAttribute('data-id');
          if (!id && e.parentNode && e.parentNode.getAttribute) id = e.parentNode.getAttribute('data-id');
          if (!id) continue;
          if (!kind || kindOf(id) === kind) return id;
        }
        if (kind !== 'river' && i > 0) break;   // areas: only a small search; rivers: wider
      }
      return null;
    }
    var _rs = null;
    function riverSamples() {
      if (_rs) return _rs;
      _rs = Object.keys(shapes).filter(function (id) { return id.indexOf('river-') === 0; }).map(function (id) {
        var e = shapes[id], len = e.getTotalLength(), pts = [];
        for (var t = 0; t <= len; t += 3) { var q = e.getPointAtLength(t); pts.push([q.x, q.y]); }
        return { id: id, pts: pts };
      });
      return _rs;
    }
    svg.addEventListener('click', function (evt) {
      if (!pickCb) return;
      var id = pickAt(evt.clientX, evt.clientY);
      pickCb(id, evt);
    });
    if (pickKind) wrap.classList.add('pick-' + pickKind);

    function zoomTo(ids) {
      // Hessen river-system close-ups are not needed for grade 4; the whole map stays in view.
    }

    return {
      el: wrap, svg: svg, name: mapName, proj: P, shapes: shapes, labels: labels, points: points,
      onPick: function (cb) { pickCb = cb; }, setPick: function (k) { pickKind = k; },
      pickAt: pickAt, setLayer: setLayer, showLabel: showLabel,
      mark: marks, highlight: function (ids) { (ids || []).forEach(function (id) { marks(id, 'hl'); }); },
      clearMarks: clearMarks, nameOf: nameOf, zoomTo: zoomTo,
      pointOf: function (id) {
        if (points[id]) return points[id];
        var e = shapes[id]; if (!e || !e.getBBox) return null;
        var b = e.getBBox(); return [b.x + b.width / 2, b.y + b.height / 2];
      },
      // Screen position of a feature (for tests and for pointing things out).
      clientPointOf: function (id) {
        var p = null, e = shapes[id];
        if (points[id]) p = points[id];
        else if (id.indexOf('river-') === 0 && e) {
          var len = e.getTotalLength(), best = null;
          // a point well inside the view (not at the map edge)
          for (var t = 0.35; t <= 0.65; t += 0.05) { var q = e.getPointAtLength(len * t); if (!best && q.x > 30 && q.y > 30 && q.x < P.w - 30 && q.y < P.h - 30) best = q; }
          best = best || e.getPointAtLength(len / 2); p = [best.x, best.y];
        } else {
          var src = (mapName === 'germany' ? data.states : mapName === 'europe' ? data.countries : data.regions).filter(function (x) { return x.id === id; })[0];
          if (src && src.label) p = src.label;
        }
        if (!p) return null;
        var pt = svg.createSVGPoint(); pt.x = p[0]; pt.y = p[1];
        var r = pt.matrixTransform(svg.getScreenCTM());
        return [r.x, r.y];
      },
      addLabel: function (x, y, str, cls) { return text(gLab, x, y, str, 'lab always ' + (cls || '')); }
    };
  }

  root.GeoMap = { create: create, nameOf: nameOf };
})(typeof window !== 'undefined' ? window : globalThis);
