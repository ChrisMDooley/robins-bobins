/*
 * ui.js — small DOM helpers shared by all screens, plus the visual pieces
 * (Wappen image, legend symbol, fictional map, compass rose).
 */
(function (root) {
  'use strict';
  var G = root.GEO, K = root.GeoKarte, Q = root.GeoQuestions;

  function h(tag, attrs, kids) {
    var e = document.createElement(tag);
    attrs = attrs || {};
    for (var k in attrs) {
      var v = attrs[k];
      if (v == null || v === false) continue;
      if (k === 'class') e.className = v;
      else if (k === 'html') e.innerHTML = v;
      else if (k === 'text') e.textContent = v;
      else if (k.indexOf('on') === 0 && typeof v === 'function') e.addEventListener(k.slice(2), v);
      else e.setAttribute(k, v === true ? '' : v);
    }
    (kids || []).forEach(function (c) {
      if (c == null || c === false) return;
      e.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
    });
    return e;
  }

  function wappenImg(key, cls) {
    return h('img', { 'class': 'wappen ' + (cls || ''), src: 'wappen/' + key + '.svg', alt: 'Wappen', draggable: 'false' });
  }
  function symbol(id, size) { return h('span', { 'class': 'sym', html: K.symbolSVG(id, size || 56) }); }

  function legendPanel(ids) {
    ids = ids || ['stadt', 'dorf', 'fluss', 'see', 'wald', 'berg', 'strasse', 'eisenbahn', 'bahnhof', 'kirche', 'burg'];
    return h('div', { 'class': 'legend' }, [h('div', { 'class': 'legend-h', text: 'Legende' })].concat(ids.map(function (id) {
      return h('div', { 'class': 'legend-row' }, [symbol(id, 30), h('span', { text: Q.LEG[id].name })]);
    })));
  }

  function sceneView(scene, opts) {
    opts = opts || {};
    var box = h('div', { 'class': 'scene-wrap' + (opts.legend ? ' with-legend' : '') });
    var holder = h('div', { 'class': 'scene-holder', html: K.sceneSVG(scene, { grid: opts.grid !== false, compass: opts.compass, cells: opts.cells }) });
    box.appendChild(holder);
    if (opts.legend) box.appendChild(legendPanel());
    var svg = holder.querySelector('svg');
    if (opts.mark) {
      var o = scene.obj[opts.mark];
      var ring = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      ring.setAttribute('cx', o.x); ring.setAttribute('cy', o.y); ring.setAttribute('r', 27); ring.setAttribute('class', 'sc-mark');
      svg.insertBefore(ring, svg.querySelector('.sc-obj'));
    }
    return { el: box, svg: svg };
  }
  function markCell(svg, cell, cls) {
    var r = svg.querySelector('[data-cell="' + cell + '"]');
    if (r) r.classList.add(cls);
  }

  function roseView(opts) {
    opts = opts || {};
    var html = '<svg class="rose-svg" viewBox="-80 -80 160 160">' + K.compassSVG(0, 0, 52, { labels: opts.labels !== false }) + '</svg>';
    var box = h('div', { 'class': 'rose-wrap', html: html });
    if (opts.labels === false && opts.showN) {
      var g = box.querySelector('.rose');
      var t = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      t.setAttribute('class', 'rose-lab'); t.setAttribute('x', 0); t.setAttribute('y', -60); t.textContent = 'N';
      g.appendChild(t);
    }
    return box;
  }

  function bar(pct, cls) {
    return h('div', { 'class': 'mbar ' + (cls || '') }, [h('div', { 'class': 'mbar-fill', style: 'width:' + Math.max(0, Math.min(100, pct)) + '%' })]);
  }

  // A short "+3" coin float near an element.
  function coinFloat(anchor, n) {
    if (!anchor || !n) return;
    var r = anchor.getBoundingClientRect();
    var f = h('div', { 'class': 'coin-float', text: '+' + n });
    f.style.left = (r.left + r.width / 2) + 'px'; f.style.top = (r.top + window.scrollY) + 'px';
    document.body.appendChild(f);
    setTimeout(function () { f.remove(); }, 1200);
  }

  function confetti(n) {
    if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    var colors = ['#E0673B', '#E3A21A', '#3E8A5E', '#2B78C5', '#A8508C'];
    var box = h('div', { 'class': 'confetti', 'aria-hidden': 'true' });
    for (var i = 0; i < (n || 26); i++) {
      var p = h('i');
      p.style.left = (5 + G.rnd() * 90) + '%';
      p.style.background = colors[i % colors.length];
      p.style.animationDelay = (G.rnd() * 0.3) + 's';
      p.style.transform = 'rotate(' + Math.round(G.rnd() * 360) + 'deg)';
      box.appendChild(p);
    }
    document.body.appendChild(box);
    setTimeout(function () { box.remove(); }, 1800);
  }

  function daysUntil(dateStr) {
    var t = new Date(dateStr + 'T08:00:00'), now = new Date();
    var a = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
    var b = Date.UTC(t.getFullYear(), t.getMonth(), t.getDate());
    return Math.round((b - a) / 86400000);
  }

  root.GeoUI = { h: h, wappenImg: wappenImg, symbol: symbol, legendPanel: legendPanel, sceneView: sceneView,
                 markCell: markCell, roseView: roseView, bar: bar, coinFloat: coinFloat, confetti: confetti, daysUntil: daysUntil };
})(typeof window !== 'undefined' ? window : globalThis);
