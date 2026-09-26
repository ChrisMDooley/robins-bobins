/*
 * geo.js — small shared helpers: randomness, projection, compass directions, text matching.
 * No DOM. Loaded first.
 */
(function (root) {
  'use strict';

  // ---------- randomness (seedable, so tests can repeat a session) ----------
  var seed = null;
  function rnd() {
    if (seed === null) return Math.random();
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  }
  function setSeed(s) { seed = s == null ? null : (Math.abs(Math.floor(s)) % 2147483646) + 1; }
  function int(n) { return Math.floor(rnd() * n); }
  function pick(a) { return a[int(a.length)]; }
  function shuffle(a) {
    a = a.slice();
    for (var i = a.length - 1; i > 0; i--) { var j = int(i + 1), t = a[i]; a[i] = a[j]; a[j] = t; }
    return a;
  }
  function sample(a, n) { return shuffle(a).slice(0, n); }
  // Weighted choice from [{w, ...}]
  function weighted(list, key) {
    key = key || 'w';
    var tot = list.reduce(function (s, x) { return s + Math.max(0, x[key]); }, 0);
    if (tot <= 0) return list.length ? pick(list) : null;
    var r = rnd() * tot;
    for (var i = 0; i < list.length; i++) { r -= Math.max(0, list[i][key]); if (r <= 0) return list[i]; }
    return list[list.length - 1];
  }

  // ---------- projection (parameters come from data/maps.js) ----------
  function project(proj, lonLat) {
    return [(lonLat[0] - proj.lonMin) * proj.k * proj.s, (proj.latMax - lonLat[1]) * proj.s];
  }

  // ---------- directions ----------
  // Bearing from a to b in degrees (0 = north, 90 = east), on a locally flat map.
  function bearing(a, b) {
    var k = Math.cos((a[1] + b[1]) / 2 * Math.PI / 180);
    var dx = (b[0] - a[0]) * k, dy = b[1] - a[1];
    var deg = Math.atan2(dx, dy) * 180 / Math.PI;
    return (deg + 360) % 360;
  }
  function distKm(a, b) {
    var k = Math.cos((a[1] + b[1]) / 2 * Math.PI / 180);
    var dx = (b[0] - a[0]) * k * 111.2, dy = (b[1] - a[1]) * 111.2;
    return Math.sqrt(dx * dx + dy * dy);
  }
  var DIR8 = [
    { id: 'N', deg: 0, name: 'Norden', adj: 'nördlich' }, { id: 'NO', deg: 45, name: 'Nordosten', adj: 'nordöstlich' },
    { id: 'O', deg: 90, name: 'Osten', adj: 'östlich' }, { id: 'SO', deg: 135, name: 'Südosten', adj: 'südöstlich' },
    { id: 'S', deg: 180, name: 'Süden', adj: 'südlich' }, { id: 'SW', deg: 225, name: 'Südwesten', adj: 'südwestlich' },
    { id: 'W', deg: 270, name: 'Westen', adj: 'westlich' }, { id: 'NW', deg: 315, name: 'Nordwesten', adj: 'nordwestlich' }
  ];
  function angleDiff(a, b) { var d = Math.abs(a - b) % 360; return d > 180 ? 360 - d : d; }
  function dirInfo(id) { return DIR8.filter(function (d) { return d.id === id; })[0]; }
  // The direction a question may safely use, or null when the relation is ambiguous.
  //   main directions (N/O/S/W): within ±30° of the exact direction
  //   in-between directions (NO/SO/SW/NW): within ±12°
  // "Clearly NOT in direction X" (for distractors) = more than 60° away.
  function clearDirection(deg) {
    for (var i = 0; i < DIR8.length; i++) {
      var d = DIR8[i], tol = d.id.length === 1 ? 30 : 12;
      if (angleDiff(deg, d.deg) <= tol) return d;
    }
    return null;
  }
  function clearlyNot(deg, dirId) { return angleDiff(deg, dirInfo(dirId).deg) > 60; }

  // ---------- text answers ----------
  function norm(s) {
    return String(s || '').toLowerCase().trim()
      .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
      .replace(/[^a-z0-9]+/g, '');
  }
  function lev(a, b) {
    var m = a.length, n = b.length, d = [], i, j;
    for (i = 0; i <= m; i++) { d[i] = [i]; }
    for (j = 0; j <= n; j++) { d[0][j] = j; }
    for (i = 1; i <= m; i++) for (j = 1; j <= n; j++)
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    return d[m][n];
  }
  // 'exact' | 'close' (small spelling slip, counts as right) | 'wrong'
  function matchTyped(input, expected) {
    var a = norm(input), b = norm(expected);
    if (!a) return 'wrong';
    if (a === b) return String(input).trim() === expected ? 'exact' : 'close';
    if (b.length >= 6 && lev(a, b) <= 1) return 'close';
    return 'wrong';
  }

  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  root.GEO = {
    rnd: rnd, setSeed: setSeed, int: int, pick: pick, shuffle: shuffle, sample: sample, weighted: weighted,
    project: project, bearing: bearing, distKm: distKm, DIR8: DIR8, dirInfo: dirInfo,
    clearDirection: clearDirection, clearlyNot: clearlyNot, angleDiff: angleDiff,
    norm: norm, matchTyped: matchTyped, esc: esc
  };
})(typeof window !== 'undefined' ? window : globalThis);
