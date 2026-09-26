/*
 * rb-bridge.js — what the Robin's Bobins home screen shows on this app's card.
 * Loaded by the platform shell (index.html). Geo writes coins/activities straight into
 * the platform, so there is nothing to sync; only the small line on the card.
 */
(function (root) {
  'use strict';
  var TEST_DATE = '2026-09-29';   // Sachunterricht-Lernzielkontrolle (keep in sync with data/content.js)
  function daysUntil(d) {
    var t = new Date(d + 'T08:00:00'), n = new Date();
    return Math.round((Date.UTC(t.getFullYear(), t.getMonth(), t.getDate()) - Date.UTC(n.getFullYear(), n.getMonth(), n.getDate())) / 86400000);
  }
  root.RBGeo = {
    cardInfo: function (childId) {
      var doc = null;
      try { doc = JSON.parse(localStorage.getItem('rb-geo:' + childId) || 'null'); } catch (e) { doc = null; }
      var today = new Date().toDateString();
      var n = doc ? doc.answers.filter(function (a) { return new Date(a.ts).toDateString() === today; }).length : 0;
      var d = daysUntil(TEST_DATE);
      if (d >= 0 && d <= 7) return (d === 0 ? 'Heute LZK!' : d === 1 ? 'Morgen LZK!' : 'Noch ' + d + ' Tage bis zur LZK') + (n ? ' · heute ' + n + ' Fragen' : '');
      return n ? 'Heute ' + n + ' Fragen geübt' : '';
    }
  };
})(typeof window !== 'undefined' ? window : globalThis);
