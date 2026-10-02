/*
 * guest.js — Robin's Bobins for a GUEST (a classmate of one of our children).
 *
 * A guest gets: a start page (gast/?name=<Name>) with the apps listed in APPS, one coin total,
 * a little activity log (streak, "heute geübt") and, if listed in PINS, a parent PIN for the
 * apps' parent areas. A guest NEVER sees the family: no family PIN, no family data, no rb.js.
 * Everything is stored on the guest's own device (localStorage), under 'rb-gast…' keys.
 *
 * Privacy: the guest's name is only in his link (and on his device). PINS holds salted hashes
 * only: sha256(SALT + id) → sha256(SALT + id + ':' + pin).
 *
 * Apps load this file only in guest mode (Europa-Trainer: index.html with ?gast=<Name>).
 */
(function (root) {
  'use strict';

  // Apps a guest can use. url is relative to the site root (chrismdooley.github.io/).
  // To add one: a line here; the app needs guest mode (?gast=<Name>, see europa-trainer/js/platform.js).
  var APPS = [
    { id: 'europa', title: 'Europa-Trainer', subject: 'Erdkunde', icon: '🌍', color: '#2F6DB5',
      url: 'europa-trainer/', card: 'europa-trainer/rb-card.js', bridge: 'RBEuropa' }
  ];

  var SALT = 'robins-bobins-guest:6b58224c93d388ca:';
  var PINS = {
    '91c23884bb554d8e22a2e913956ba74090f17a9502f98da95a4450a6b7348539': 'defd83611593eeff1569dabc37bf8f6a5a969a855c68dfde0616a29651f9c1e0'
  };

  var KEY = 'rb-gast';                         // who the guest is on this device
  var DAY = 86400000;

  function sha256(str) {
    var K = [0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,
      0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,
      0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,
      0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,0xd192e819,0xd6990624,0xf40e3585,0x106aa070,
      0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,
      0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2];
    var bytes = unescape(encodeURIComponent(str)), l = bytes.length, words = [], i;
    for (i = 0; i < l; i++) words[i >> 2] |= (bytes.charCodeAt(i) & 0xff) << (24 - (i % 4) * 8);
    words[l >> 2] |= 0x80 << (24 - (l % 4) * 8);
    words[(((l + 8) >> 6) + 1) * 16 - 1] = l * 8;
    var H = [0x6a09e667,0xbb67ae85,0x3c6ef372,0xa54ff53a,0x510e527f,0x9b05688c,0x1f83d9ab,0x5be0cd19], W = [];
    function r(x, n) { return (x >>> n) | (x << (32 - n)); }
    for (var j = 0; j < words.length; j += 16) {
      var a = H[0], b = H[1], c = H[2], d = H[3], e = H[4], f = H[5], g = H[6], h = H[7];
      for (i = 0; i < 64; i++) {
        if (i < 16) W[i] = words[j + i] | 0;
        else W[i] = (r(W[i-2],17) ^ r(W[i-2],19) ^ (W[i-2] >>> 10)) + W[i-7] + (r(W[i-15],7) ^ r(W[i-15],18) ^ (W[i-15] >>> 3)) + W[i-16] | 0;
        var t1 = h + (r(e,6) ^ r(e,11) ^ r(e,25)) + ((e & f) ^ (~e & g)) + K[i] + W[i] | 0;
        var t2 = (r(a,2) ^ r(a,13) ^ r(a,22)) + ((a & b) ^ (a & c) ^ (b & c)) | 0;
        h = g; g = f; f = e; e = d + t1 | 0; d = c; c = b; b = a; a = t1 + t2 | 0;
      }
      H[0] = H[0] + a | 0; H[1] = H[1] + b | 0; H[2] = H[2] + c | 0; H[3] = H[3] + d | 0;
      H[4] = H[4] + e | 0; H[5] = H[5] + f | 0; H[6] = H[6] + g | 0; H[7] = H[7] + h | 0;
    }
    return H.map(function (x) { return ('00000000' + (x >>> 0).toString(16)).slice(-8); }).join('');
  }

  function store(k, v) { try { if (v === undefined) return JSON.parse(root.localStorage.getItem(k) || 'null'); root.localStorage.setItem(k, JSON.stringify(v)); } catch (e) { return null; } }
  function param(n) { var m = new RegExp('[?&]' + n + '=([^&#]*)').exec(root.location ? root.location.search : ''); try { return m ? decodeURIComponent(m[1].replace(/\+/g, ' ')) : ''; } catch (e) { return ''; } }
  function clean(n) { return String(n || '').replace(/[^A-Za-zÄÖÜäöüßÀ-ÿ' -]/g, '').trim().slice(0, 24); }
  function slug(n) { return n.toLowerCase().replace(/[^a-zäöüßà-ÿ]+/g, '-').replace(/^-|-$/g, ''); }

  var fromLink = clean(param('name') || param('gast'));
  var name = fromLink || clean(store(KEY)) || clean(store('europa-trainer:gast'));
  if (fromLink) store(KEY, fromLink);
  name = name ? name.charAt(0).toUpperCase() + name.slice(1) : '';
  var id = name ? slug(name) : '';

  // Site root, from where this file was loaded (…/robins-bobins/shared/guest.js).
  var me = root.document && (root.document.currentScript || [].slice.call(root.document.scripts).filter(function (s) { return /shared\/guest\.js/.test(s.src); })[0]);
  var siteRoot = me && me.src ? me.src.replace(/robins-bobins\/shared\/guest\.js.*$/, '') : '../';

  function dataKey() { return 'rb-gast:' + id; }
  function data() { var d = store(dataKey()) || {}; d.coins = d.coins || []; d.activity = d.activity || []; return d; }
  function save(d) { d.coins = d.coins.slice(-500); d.activity = d.activity.slice(-500); store(dataKey(), d); }
  function dayKey(t) { var d = new Date(t); return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate(); }

  var G = {
    name: name, id: id, childId: id ? 'gast-' + id : '',
    apps: APPS, siteRoot: siteRoot,
    startUrl: siteRoot + 'robins-bobins/gast/' + (name ? '?name=' + encodeURIComponent(name) : ''),
    appUrl: function (a) { return siteRoot + a.url + '?gast=' + encodeURIComponent(name); },
    // Coins: earned only, never taken away.
    coins: {
      balance: function () { return id ? data().coins.reduce(function (s, c) { return s + c.amount; }, 0) : 0; },
      add: function (amount, reason, app) {
        if (!id || !(amount > 0)) return 0;
        var d = data(); d.coins.push({ ts: Date.now(), amount: Math.round(amount), reason: reason || '', app: app || '' }); save(d);
        return Math.round(amount);
      }
    },
    activity: {
      record: function (app, summary) { if (!id) return; var d = data(); d.activity.push({ ts: Date.now(), app: app, summary: summary || {} }); save(d); },
      summary: function () {
        var acts = id ? data().activity : [], today = dayKey(Date.now()), days = {};
        acts.forEach(function (a) { days[dayKey(a.ts)] = true; });
        var streak = 0, t = Date.now();
        if (!days[today]) t -= DAY;                       // yesterday still counts until today is over
        while (days[dayKey(t)]) { streak++; t -= DAY; }
        return { today: acts.filter(function (a) { return dayKey(a.ts) === today; }).length, streak: streak };
      }
    },
    hasPin: function () { return !!(id && PINS[sha256(SALT + id)]); },
    checkPin: function (pin) { var want = id && PINS[sha256(SALT + id)]; return !want || sha256(SALT + id + ':' + String(pin).trim()) === want; }
  };

  root.RBGuest = G;
})(typeof window !== 'undefined' ? window : globalThis);
