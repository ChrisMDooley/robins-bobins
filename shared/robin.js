/*
 * robin.js — Robin the whippet, the Robin's Bobins mascot.
 *
 * RB.robin.svg(pose)       → inline SVG string (poses listed in POSES)
 * RB.robin.el(pose, size)  → a <span class="robin"> element ready to insert
 * RB.robin.say(child, ctx) → a short, restrained German line for the moment
 *
 * This is a placeholder drawing: one head-in-profile silhouette plus small
 * per-pose details. To use real pictures of Robin later, drop images into
 * shared/robin/ and list them in RB.robin.images, e.g.
 *     RB.robin.images.happy = 'robin/happy.png';
 * Any pose with an image uses it; the others keep the drawing.
 */
(function (root) {
  'use strict';
  var RB = root.RB;

  // Colours taken from Robin himself: pale cream coat with dark grey brindle,
  // a smoky grey face, black nose, brown eyes, dark rose ears.
  var COAT = '#EEE6D8', COAT_LIGHT = '#F8F3EA', BRINDLE = '#3D3A3C', MASK = '#5E595A', EAR = '#4E494B',
      EAR_PINK = '#D8A9A4', EYE_BROWN = '#7A4524', INK = '#1F1D20', COLLAR = '#2F3E78', GOLD = '#E3A21A', GOLD_EDGE = '#B97C0B';
  var FUR_DARK = EAR;

  var SILHOUETTE = 'M58 198C52 162 50 122 60 94C67 63 89 45 117 47C133 48 144 55 153 64C164 74 177 82 185 90C191 96 189 107 181 109C167 113 147 116 129 118C117 120 111 127 109 137C107 157 113 179 123 198Z';

  // Brindle: short dark streaks, seeded so Robin always looks the same.
  var BRINDLE_STROKES = (function () {
    var seed = 7, out = '';
    function rnd() { seed = (seed * 16807) % 2147483647; return seed / 2147483647; }
    for (var i = 0; i < 110; i++) {
      var x = 52 + rnd() * 104, y = 48 + rnd() * 152;
      if (x > 128 && y > 112) continue;                 // keep the pale chest clear
      if (x > 100 && y > 140 && rnd() < 0.6) continue;  // lighter throat
      var len = 4 + rnd() * 13, tilt = -0.55 + rnd() * 0.5, bend = (rnd() - 0.5) * 5;
      var x2 = x + Math.sin(tilt) * len, y2 = y + Math.cos(tilt) * len;
      out += '<path d="M' + x.toFixed(1) + ' ' + y.toFixed(1) + 'q' + bend.toFixed(1) + ' ' + (len / 2).toFixed(1) + ' ' +
        (x2 - x).toFixed(1) + ' ' + (y2 - y).toFixed(1) + '" stroke-width="' + (0.9 + rnd() * 1.9).toFixed(1) + '" opacity="' + (0.22 + rnd() * 0.4).toFixed(2) + '"/>';
    }
    return out;
  })();

  var uid = 0;
  function head() {
    var id = 'rbclip' + (++uid), g = 'rbmask' + uid;
    return '<defs><clipPath id="' + id + '"><path d="' + SILHOUETTE + '"/></clipPath>' +
      '<linearGradient id="' + g + '" x1="118" y1="0" x2="188" y2="0" gradientUnits="userSpaceOnUse">' +
      '<stop offset="0" stop-color="' + MASK + '" stop-opacity="0"/><stop offset=".55" stop-color="' + MASK + '" stop-opacity=".55"/>' +
      '<stop offset="1" stop-color="' + MASK + '" stop-opacity=".9"/></linearGradient></defs>' +
      '<path d="' + SILHOUETTE + '" fill="' + COAT + '"/>' +
      '<g clip-path="url(#' + id + ')">' +
        '<path d="M109 137C107 157 113 179 123 198L96 198C94 176 99 154 109 137Z" fill="' + COAT_LIGHT + '"/>' +
        '<g fill="none" stroke="' + BRINDLE + '" stroke-linecap="round">' + BRINDLE_STROKES + '</g>' +
        '<path d="M112 46L200 46L200 125L112 125Z" fill="url(#' + g + ')"/>' +
      '</g>' +
      '<path d="' + SILHOUETTE + '" fill="none" stroke="' + MASK + '" stroke-width="1.5" opacity=".35"/>' +
      '<path d="M104 54C92 47 76 50 63 64C74 63 84 67 91 76C95 67 99 60 104 54Z" fill="' + EAR + '"/>' +
      '<path d="M98 57C89 54 79 56 71 63C79 63 85 66 90 71C92 66 95 61 98 57Z" fill="' + EAR_PINK + '" opacity=".35"/>' +
      '<ellipse cx="184" cy="97" rx="6.5" ry="5.5" fill="' + INK + '"/>';
  }

  var COLLAR_BAND = '<path d="M56 150C76 159 96 163 113 158" fill="none" stroke="' + COLLAR + '" stroke-width="11" stroke-linecap="round"/>';
  var TAG =
    '<circle cx="97" cy="176" r="11" fill="' + GOLD + '" stroke="' + GOLD_EDGE + '" stroke-width="3"/>' +
    '<text x="97" y="180.5" text-anchor="middle" font-family="Atkinson Hyperlegible, sans-serif" font-weight="700" font-size="12" fill="#fff">R</text>';

  var EYE_OPEN = '<ellipse cx="136" cy="73" rx="6.2" ry="6.6" fill="' + INK + '"/><ellipse cx="136.4" cy="73.4" rx="4.3" ry="4.7" fill="' + EYE_BROWN + '"/><circle cx="136.6" cy="73.6" r="2.1" fill="' + INK + '"/><circle cx="138.4" cy="70.8" r="1.7" fill="#fff"/>';
  var EYE_HAPPY = '<path d="M129 75Q136 66 143 75" fill="none" stroke="' + INK + '" stroke-width="3.6" stroke-linecap="round"/>';
  var EYE_SLEEP = '<path d="M129 72Q136 79 143 72" fill="none" stroke="' + INK + '" stroke-width="3.2" stroke-linecap="round"/>';
  var EYE_UP = '<ellipse cx="136" cy="73" rx="6.2" ry="6.6" fill="' + INK + '"/><ellipse cx="136.6" cy="71" rx="4.3" ry="4.5" fill="' + EYE_BROWN + '"/><circle cx="137" cy="70" r="2" fill="' + INK + '"/><circle cx="138.4" cy="68.8" r="1.6" fill="#fff"/>';
  var BROW = '<path d="M128 62Q135 58 143 61" fill="none" stroke="' + FUR_DARK + '" stroke-width="3" stroke-linecap="round"/>';
  var SMILE = '<path d="M180 109C172 114 161 114 153 111" fill="none" stroke="' + INK + '" stroke-width="2.6" stroke-linecap="round"/>';
  var GRIN = '<path d="M181 108C172 116 158 117 150 111" fill="none" stroke="' + INK + '" stroke-width="2.8" stroke-linecap="round"/>' +
             '<path d="M163 114C164 124 172 126 175 118Z" fill="#E66B7A"/>';

  function coin(cx, cy, r) {
    return '<circle cx="' + cx + '" cy="' + cy + '" r="' + r + '" fill="' + GOLD + '" stroke="' + GOLD_EDGE + '" stroke-width="3"/>' +
      '<circle cx="' + cx + '" cy="' + cy + '" r="' + (r * 0.62) + '" fill="none" stroke="#FFE08A" stroke-width="2.4"/>';
  }

  var POSES = {
    normal:      EYE_OPEN + SMILE,
    happy:       EYE_HAPPY + GRIN,
    celebrating: EYE_HAPPY + GRIN +
      '<g stroke-linecap="round" stroke-width="5">' +
      '<path d="M22 40l8 6" stroke="' + COLLAR + '"/><path d="M40 16l2 10" stroke="' + GOLD + '"/>' +
      '<path d="M170 20l-6 8" stroke="#3E9A8A"/><path d="M190 46l-9 3" stroke="' + COLLAR + '"/>' +
      '<path d="M16 86l10 -2" stroke="#3E9A8A"/></g>',
    thinking:    EYE_UP + BROW + SMILE +
      '<circle cx="176" cy="40" r="4" fill="' + FUR_DARK + '" opacity=".5"/><circle cx="188" cy="24" r="6" fill="' + FUR_DARK + '" opacity=".5"/>',
    encouraging: EYE_OPEN + BROW + GRIN,
    sleeping:    EYE_SLEEP + SMILE +
      '<text x="160" y="42" font-family="Atkinson Hyperlegible, sans-serif" font-weight="700" font-size="20" fill="' + FUR_DARK + '" opacity=".6">z</text>' +
      '<text x="176" y="26" font-family="Atkinson Hyperlegible, sans-serif" font-weight="700" font-size="14" fill="' + FUR_DARK + '" opacity=".5">z</text>',
    coin:        EYE_HAPPY + SMILE + coin(170, 124, 14),
    glasses:     EYE_OPEN + SMILE +
      '<circle cx="136" cy="73" r="12" fill="none" stroke="' + INK + '" stroke-width="3.2"/>' +
      '<path d="M124 71L104 64" stroke="' + INK + '" stroke-width="3" stroke-linecap="round"/>'
  };

  function svg(pose) {
    var extra = POSES[pose] || POSES.normal;
    return '<svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Robin, der Whippet">' +
      head() + COLLAR_BAND + (pose === 'coin' ? '' : TAG) + extra + '</svg>';
  }

  var images = {};

  function el(pose, size) {
    var span = document.createElement('span');
    span.className = 'robin robin-' + (pose || 'normal');
    if (size) { span.style.width = size + 'px'; span.style.height = size + 'px'; }
    if (images[pose]) span.innerHTML = '<img src="' + RB.nav.base + 'shared/' + images[pose] + '" alt="Robin">';
    else span.innerHTML = svg(pose);
    return span;
  }

  // Restrained: one short line, only when it fits the moment.
  function say(c, ctx) {
    ctx = ctx || {};
    var n = c.name;
    if (ctx.daysAway != null && ctx.daysAway >= 3) return { pose: 'happy', text: 'Schön, dich wiederzusehen, ' + n + '!' };
    if (ctx.today >= 3) return { pose: 'celebrating', text: 'Wow, ' + n + '! Schon ' + ctx.today + ' Übungen heute.' };
    if (ctx.today >= 1) return { pose: 'happy', text: 'Super gemacht heute!' };
    if (ctx.streak >= 2) return { pose: 'encouraging', text: ctx.streak + ' Tage in Folge – weiter so!' };
    return { pose: 'normal', text: 'Los geht’s, ' + n + '!' };
  }

  RB.robin = { svg: svg, el: el, say: say, poses: Object.keys(POSES), images: images };
})(typeof window !== 'undefined' ? window : globalThis);
