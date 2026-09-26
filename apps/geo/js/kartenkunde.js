/*
 * kartenkunde.js — a fictional map for Legende / Planquadrate / Himmelsrichtungen.
 * Every call to makeScene() builds a NEW random map (so Alex learns how to read a grid,
 * not where the Bahnhof was last time). Pure functions returning data + SVG strings.
 *
 * Grid: columns A–E (left → right), rows 1–5 (top → bottom), like school maps.
 * North is up.
 */
(function (root) {
  'use strict';
  var G = root.GEO;
  var COLS = ['A', 'B', 'C', 'D', 'E'], N = 5, CELL = 80, PAD = 30;
  var SIZE = N * CELL;

  // ---------- legend symbols (drawn centred on 0,0, about 40×40) ----------
  var SYM = {
    stadt: '<rect x="-17" y="-13" width="34" height="26" rx="3" fill="#D6453D" stroke="#7A1F1A" stroke-width="2"/>' +
      '<rect x="-9" y="-6" width="7" height="7" fill="#fff" opacity=".85"/><rect x="3" y="-2" width="7" height="7" fill="#fff" opacity=".85"/>',
    dorf: '<circle r="8" fill="#D6453D" stroke="#7A1F1A" stroke-width="2"/>',
    fluss: '<path d="M-20 4 C-12 -8 -4 12 4 0 S16 -8 20 -4" fill="none" stroke="#2B78C5" stroke-width="5" stroke-linecap="round"/>',
    see: '<ellipse rx="18" ry="11" fill="#8CC4F0" stroke="#2B78C5" stroke-width="2.5"/>',
    wald: '<rect x="-18" y="-14" width="36" height="28" rx="9" fill="#7DBE6A" stroke="#3E7D35" stroke-width="2"/>' +
      '<circle cx="-7" cy="-2" r="4" fill="#3E7D35"/><circle cx="6" cy="-5" r="4" fill="#3E7D35"/><circle cx="3" cy="6" r="4" fill="#3E7D35"/>',
    berg: '<path d="M-17 13 L0 -15 L17 13 Z" fill="#A8743F" stroke="#5E3B17" stroke-width="2" stroke-linejoin="round"/>' +
      '<path d="M-5 -6 L0 -15 L5 -6 L2 -8 L0 -5 L-2 -8 Z" fill="#fff"/>',
    strasse: '<path d="M-20 0 H20" stroke="#6B5F55" stroke-width="9" stroke-linecap="round"/><path d="M-20 0 H20" stroke="#F4C542" stroke-width="5" stroke-linecap="round"/>',
    eisenbahn: '<path d="M-20 0 H20" stroke="#222" stroke-width="6"/><path d="M-20 0 H20" stroke="#fff" stroke-width="2.5" stroke-dasharray="6 6"/>',
    bahnhof: '<rect x="-14" y="-9" width="28" height="18" rx="2" fill="#222"/><rect x="-9" y="-4" width="18" height="8" fill="#fff"/>',
    kirche: '<circle cy="4" r="9" fill="#fff" stroke="#222" stroke-width="2.5"/><path d="M0 -5 V-17 M-5 -12 H5" stroke="#222" stroke-width="2.5"/>',
    burg: '<path d="M-12 13 V-8 H-7 V-13 H-2 V-8 H2 V-13 H7 V-8 H12 V13 Z" fill="#8E8A86" stroke="#3D3935" stroke-width="2" stroke-linejoin="round"/>' +
      '<rect x="-3" y="3" width="6" height="10" fill="#3D3935"/>'
  };

  function symbolSVG(id, size) {
    size = size || 56;
    return '<svg viewBox="-24 -24 48 48" width="' + size + '" height="' + size + '" aria-hidden="true">' + SYM[id] + '</svg>';
  }

  function cellName(c, r) { return COLS[c] + (r + 1); }
  function cellCenter(c, r) { return [PAD + c * CELL + CELL / 2, PAD + r * CELL + CELL / 2]; }

  // ---------- random scene ----------
  var POINT_OBJECTS = ['stadt', 'dorf', 'see', 'berg', 'bahnhof', 'kirche', 'burg'];

  function makeScene() {
    for (var tries = 0; tries < 50; tries++) {
      var s = tryScene();
      if (s) return s;
    }
    return tryScene(true);
  }

  function tryScene(force) {
    var used = {}, objects = [];
    function key(c, r) { return c + ',' + r; }

    // River: left edge → right edge, one row step at most per column.
    var r0 = G.int(N), riverCells = [], row = r0, pts = [[PAD - 4, cellCenter(0, r0)[1]]];
    for (var c = 0; c < N; c++) {
      if (c > 0) { var step = G.pick([-1, 0, 1]); row = Math.max(0, Math.min(N - 1, row + step)); }
      riverCells.push([c, row]); used[key(c, row)] = 'fluss';
      var cc = cellCenter(c, row);
      pts.push([cc[0] + G.int(20) - 10, cc[1] + G.int(20) - 10]);
    }
    pts.push([PAD + SIZE + 4, pts[pts.length - 1][1]]);

    // Point objects in distinct free cells, keeping a little distance where possible.
    var free = [];
    for (var cx = 0; cx < N; cx++) for (var ry = 0; ry < N; ry++) if (!used[key(cx, ry)]) free.push([cx, ry]);
    free = G.shuffle(free);
    for (var i = 0; i < POINT_OBJECTS.length; i++) {
      var cell = free.shift();
      if (!cell) return null;
      used[key(cell[0], cell[1])] = POINT_OBJECTS[i];
      var ctr = cellCenter(cell[0], cell[1]);
      objects.push({ id: POINT_OBJECTS[i], c: cell[0], r: cell[1], cell: cellName(cell[0], cell[1]),
                     x: ctr[0] + G.int(16) - 8, y: ctr[1] + G.int(16) - 8 });
    }
    // Forest: up to 2 free cells.
    var forest = free.splice(0, 2);
    forest.forEach(function (f) { used[key(f[0], f[1])] = 'wald'; });
    var obj = {}; objects.forEach(function (o) { obj[o.id] = o; });

    // Lines must not run through other objects (a railway through the church is confusing).
    function cellOf(x, y) { return [Math.floor((x - PAD) / CELL), Math.floor((y - PAD) / CELL)]; }
    function blocked(pts, allow) {
      for (var i = 1; i < pts.length; i++) {
        for (var t = 0; t <= 40; t++) {
          var x = pts[i - 1][0] + (pts[i][0] - pts[i - 1][0]) * t / 40, y = pts[i - 1][1] + (pts[i][1] - pts[i - 1][1]) * t / 40;
          var c = cellOf(x, y), what = used[key(c[0], c[1])];
          if (what && what !== 'fluss' && what !== 'wald' && allow.indexOf(what) < 0) return true;
        }
      }
      return false;
    }
    // Railway: straight line through the Bahnhof, horizontal or vertical, edge to edge.
    var b = obj.bahnhof, rails = G.shuffle([[[PAD, b.y], [PAD + SIZE, b.y]], [[b.x, PAD], [b.x, PAD + SIZE]]]);
    var rail = rails.filter(function (r) { return !blocked(r, ['bahnhof']); })[0];
    // Road: Dorf → Stadt, as an L (either corner).
    var d = obj.dorf, st = obj.stadt;
    var roads = G.shuffle([[[d.x, d.y], [st.x, d.y], [st.x, st.y]], [[d.x, d.y], [d.x, st.y], [st.x, st.y]]]);
    var road = roads.filter(function (r) { return !blocked(r, ['dorf', 'stadt']); })[0];
    if ((!rail || !road) && !force) return null;
    rail = rail || rails[0]; road = road || roads[0];

    return { cols: COLS, n: N, cell: CELL, pad: PAD, size: SIZE, objects: objects, obj: obj,
             river: pts, riverCells: riverCells, forest: forest, rail: rail, road: road };
  }

  function objectAt(scene, cell) {
    return scene.objects.filter(function (o) { return o.cell === cell; })[0] || null;
  }

  // Direction from a to b on the grid, only when it is unambiguous (same row or column).
  function gridDirection(a, b) {
    if (a.c === b.c && b.r < a.r) return 'N';
    if (a.c === b.c && b.r > a.r) return 'S';
    if (a.r === b.r && b.c > a.c) return 'O';
    if (a.r === b.r && b.c < a.c) return 'W';
    return null;
  }
  // Is b to the north of a in ANY sense (for keeping distractors clearly wrong)?
  function anyNorthish(a, b, dir) {
    var dx = b.c - a.c, dy = a.r - b.r;
    return { N: dy > 0, S: dy < 0, O: dx > 0, W: dx < 0 }[dir];
  }

  // ---------- drawing ----------
  function path(pts, smooth) {
    if (!smooth) return 'M' + pts.map(function (p) { return p[0] + ' ' + p[1]; }).join(' L');
    var d = 'M' + pts[0][0] + ' ' + pts[0][1];
    for (var i = 1; i < pts.length; i++) {
      var p0 = pts[i - 1], p1 = pts[i], mx = (p0[0] + p1[0]) / 2;
      d += ' C' + mx + ' ' + p0[1] + ' ' + mx + ' ' + p1[1] + ' ' + p1[0] + ' ' + p1[1];
    }
    return d;
  }

  // opts: {grid:true, labels:true, highlightCell:'B4', compass:true}
  function sceneSVG(s, opts) {
    opts = opts || {};
    var W = s.pad + s.size + 10, out = [];
    out.push('<svg class="scene" viewBox="0 0 ' + (W + (opts.compass ? 70 : 0)) + ' ' + W + '" role="img" aria-label="Karte">');
    out.push('<rect x="' + s.pad + '" y="' + s.pad + '" width="' + s.size + '" height="' + s.size + '" fill="#F3EEDC" rx="4"/>');
    s.forest.forEach(function (f) {
      var x = s.pad + f[0] * s.cell + 6, y = s.pad + f[1] * s.cell + 6;
      out.push('<rect class="sc-wald" data-obj="wald" x="' + x + '" y="' + y + '" width="' + (s.cell - 12) + '" height="' + (s.cell - 12) + '" rx="18" fill="#7DBE6A" stroke="#3E7D35" stroke-width="2"/>');
      out.push('<circle cx="' + (x + 20) + '" cy="' + (y + 26) + '" r="5" fill="#3E7D35"/><circle cx="' + (x + 44) + '" cy="' + (y + 22) + '" r="5" fill="#3E7D35"/><circle cx="' + (x + 34) + '" cy="' + (y + 46) + '" r="5" fill="#3E7D35"/>');
    });
    out.push('<path class="sc-fluss" data-obj="fluss" d="' + path(s.river, true) + '" fill="none" stroke="#2B78C5" stroke-width="7" stroke-linecap="round"/>');
    out.push('<path d="' + path(s.road) + '" fill="none" stroke="#6B5F55" stroke-width="9" stroke-linejoin="round"/><path class="sc-strasse" data-obj="strasse" d="' + path(s.road) + '" fill="none" stroke="#F4C542" stroke-width="5" stroke-linejoin="round"/>');
    out.push('<path d="' + path(s.rail) + '" stroke="#222" stroke-width="6"/><path class="sc-eisenbahn" data-obj="eisenbahn" d="' + path(s.rail) + '" stroke="#fff" stroke-width="2.5" stroke-dasharray="7 7"/>');
    s.objects.forEach(function (o) {
      out.push('<g class="sc-obj" data-obj="' + o.id + '" transform="translate(' + o.x + ' ' + o.y + ')">' + SYM[o.id] + '</g>');
    });
    if (opts.grid !== false) {
      for (var i = 0; i <= s.n; i++) {
        var p = s.pad + i * s.cell;
        out.push('<line x1="' + p + '" y1="' + s.pad + '" x2="' + p + '" y2="' + (s.pad + s.size) + '" stroke="#6E6472" stroke-width="1.2" opacity=".55"/>');
        out.push('<line x1="' + s.pad + '" y1="' + p + '" x2="' + (s.pad + s.size) + '" y2="' + p + '" stroke="#6E6472" stroke-width="1.2" opacity=".55"/>');
      }
      for (var k = 0; k < s.n; k++) {
        out.push('<text x="' + (s.pad + k * s.cell + s.cell / 2) + '" y="' + (s.pad - 9) + '" class="sc-lab">' + s.cols[k] + '</text>');
        out.push('<text x="' + (s.pad - 14) + '" y="' + (s.pad + k * s.cell + s.cell / 2 + 7) + '" class="sc-lab">' + (k + 1) + '</text>');
      }
    }
    if (opts.grid !== false || opts.cells) {
      // invisible cells on top for clicks (also without grid lines, e.g. "Finde den Bahnhof")
      for (var c = 0; c < s.n; c++) for (var r = 0; r < s.n; r++) {
        out.push('<rect class="sc-cell" data-cell="' + cellName(c, r) + '" x="' + (s.pad + c * s.cell) + '" y="' + (s.pad + r * s.cell) + '" width="' + s.cell + '" height="' + s.cell + '"/>');
      }
    }
    if (opts.compass) out.push(compassSVG(W + 35, 70, 30));
    out.push('</svg>');
    return out.join('');
  }

  // Compass rose (Windrose). Points carry data-dir for click questions; labels optional.
  function compassSVG(cx, cy, r, opts) {
    opts = opts || {};
    var lab = opts.labels !== false, o = ['<g class="rose" transform="translate(' + cx + ' ' + cy + ')">'];
    var pts = { N: [0, -1], O: [1, 0], S: [0, 1], W: [-1, 0] };
    Object.keys(pts).forEach(function (d) {
      var v = pts[d], tip = [v[0] * r, v[1] * r], side = [v[1] * r * 0.22, -v[0] * r * 0.22];
      o.push('<path class="rose-pt" data-dir="' + d + '" d="M' + tip[0] + ' ' + tip[1] + ' L' + side[0] + ' ' + side[1] + ' L0 0 Z" fill="' + (d === 'N' ? '#E0673B' : '#2A2530') + '"/>');
      o.push('<path class="rose-pt" data-dir="' + d + '" d="M' + tip[0] + ' ' + tip[1] + ' L' + (-side[0]) + ' ' + (-side[1]) + ' L0 0 Z" fill="' + (d === 'N' ? '#F7B79E' : '#9A8F9E') + '"/>');
      if (lab) o.push('<text class="rose-lab" x="' + v[0] * (r + 13) + '" y="' + (v[1] * (r + 13) + 6) + '">' + d + '</text>');
      // big invisible hit area per direction
      o.push('<circle class="rose-hit" data-dir="' + d + '" cx="' + v[0] * r * 0.8 + '" cy="' + v[1] * r * 0.8 + '" r="' + r * 0.55 + '"/>');
    });
    o.push('</g>');
    return o.join('');
  }

  root.GeoKarte = {
    SYM: SYM, symbolSVG: symbolSVG, makeScene: makeScene, sceneSVG: sceneSVG, compassSVG: compassSVG,
    objectAt: objectAt, gridDirection: gridDirection, anyNorthish: anyNorthish, cellName: cellName, COLS: COLS
  };
})(typeof window !== 'undefined' ? window : globalThis);
