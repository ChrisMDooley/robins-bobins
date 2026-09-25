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

  var FUR = '#C98A5B', FUR_DARK = '#8F5A38', CREAM = '#F7E6D0', INK = '#2A2530', COLLAR = '#E0673B', GOLD = '#E3A21A', GOLD_EDGE = '#B97C0B';

  // Shared silhouette: long narrow muzzle, folded rose ear, slender neck.
  var HEAD =
    '<path d="M58 198C52 162 50 122 60 94C67 63 89 45 117 47C133 48 144 55 153 64C164 74 177 82 185 90C191 96 189 107 181 109C167 113 147 116 129 118C117 120 111 127 109 137C107 157 113 179 123 198Z" fill="' + FUR + '"/>' +
    '<path d="M109 137C107 157 113 179 123 198L98 198C96 176 99 154 109 137Z" fill="' + CREAM + '"/>' +
    '<path d="M150 62C160 71 172 80 181 88C173 86 160 80 150 70Z" fill="' + CREAM + '" opacity=".75"/>' +
    '<path d="M104 54C92 47 76 50 63 64C74 63 84 67 91 76C95 67 99 60 104 54Z" fill="' + FUR_DARK + '"/><path d="M91 76C86 70 78 67 70 66" fill="none" stroke="#6E4229" stroke-width="2" stroke-linecap="round" opacity=".6"/>' +
    '<ellipse cx="184" cy="97" rx="6.5" ry="5.5" fill="' + INK + '"/>' +
    '<circle cx="149" cy="97" r="8" fill="#F29A8A" opacity=".35"/>';

  var COLLAR_BAND = '<path d="M56 150C76 159 96 163 113 158" fill="none" stroke="' + COLLAR + '" stroke-width="11" stroke-linecap="round"/>';
  var TAG =
    '<circle cx="97" cy="176" r="11" fill="' + GOLD + '" stroke="' + GOLD_EDGE + '" stroke-width="3"/>' +
    '<text x="97" y="180.5" text-anchor="middle" font-family="Atkinson Hyperlegible, sans-serif" font-weight="700" font-size="12" fill="#fff">R</text>';

  var EYE_OPEN = '<ellipse cx="136" cy="73" rx="6" ry="6.6" fill="' + INK + '"/><circle cx="138.2" cy="70.6" r="2" fill="#fff"/>';
  var EYE_HAPPY = '<path d="M129 75Q136 66 143 75" fill="none" stroke="' + INK + '" stroke-width="3.6" stroke-linecap="round"/>';
  var EYE_SLEEP = '<path d="M129 72Q136 79 143 72" fill="none" stroke="' + INK + '" stroke-width="3.2" stroke-linecap="round"/>';
  var EYE_UP = '<ellipse cx="136" cy="73" rx="6" ry="6.6" fill="' + INK + '"/><circle cx="137" cy="69" r="2.2" fill="#fff"/>';
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
      HEAD + COLLAR_BAND + (pose === 'coin' ? '' : TAG) + extra + '</svg>';
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
