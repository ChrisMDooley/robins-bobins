/*
 * questions.js — turns content into questions. No DOM.
 *
 * Each TOPIC lists its items (the concepts that are tracked and repeated) and a set of
 * GENERATORS. A generator takes an item and returns a question, or null when it does not
 * fit that item (e.g. "In welchen Fluss mündet …?" for a river that has no `into`).
 *
 * Adding a new quiz type = add one generator to a topic's list.
 * Adding a town/river/state = add it to data/content.js; questions follow automatically.
 *
 * Question shape (what the UI understands):
 *   { topic, item, format, prompt, sub?, visual?, options?, answer, accept?, targets?,
 *     right: text shown when correct, wrong(given): text shown when wrong,
 *     reveal?: {map feature id to show after answering}, exam: bool (usable in the mock test) }
 *
 *   format: 'choice'   options [{value,label}] (label may be an image: {img})
 *           'type'     typed answer (answer = expected text)
 *           'mapClick' tap a feature on a map (visual.map; answer = feature id)
 *           'mapSeq'   tap several features in order (targets = [ids])
 *           'mapDrag'  drag one name onto the map (answer = feature id)
 *           'cellClick' tap a Planquadrat (answer = 'C3')
 *           'roseClick' tap a direction on the compass rose (answer = 'O')
 */
(function (root) {
  'use strict';
  var G = root.GEO, C = root.GEO_CONTENT, K = root.GeoKarte;

  function byId(list) { var o = {}; list.forEach(function (x) { o[x.id] = x; }); return o; }
  var STATE = byId(C.states), COUNTRY = byId(C.countries), TOWN = byId(C.towns),
      RIVER = byId(C.rivers), MOUNT = byId(C.mountains), LEG = byId(C.legend);
  var NEIGHBOURS = C.countries.filter(function (c) { return c.neighbour; });
  var NOT_NEIGHBOURS = C.countries.filter(function (c) { return !c.neighbour && !c.self; });
  var HOME = TOWN[C.homeTown];
  var DIRNAME = { N: 'Norden', O: 'Osten', S: 'Süden', W: 'Westen' };
  var DIRADJ = { N: 'nördlich', O: 'östlich', S: 'südlich', W: 'westlich' };

  function tname(t) { return t.short || t.name; }
  function art(x, kasus) {           // der Main / die Lahn / den Main
    if (kasus === 'akk') return x.article === 'der' ? 'den' : x.article;
    if (kasus === 'dat') return x.article === 'der' ? 'dem' : 'der';
    return x.article;
  }
  function cap(s) { return s.charAt(0).toUpperCase() + s.slice(1); }

  // 4 options: the answer + distractors (preferred ones first, then the rest at random).
  function options(answer, preferred, pool, n, label) {
    n = n || 4; label = label || function (x) { return x; };
    var chosen = [answer], seen = {}; seen[answer] = 1;
    G.shuffle(preferred || []).concat(G.shuffle(pool)).forEach(function (x) {
      if (chosen.length < n && !seen[x]) { chosen.push(x); seen[x] = 1; }
    });
    return G.shuffle(chosen).map(function (v) { return { value: v, label: label(v) }; });
  }
  function q(o) { if (o.exam === undefined) o.exam = true; return o; }

  // ======================================================================= topics
  var T = {};

  // ---------------------------------------------------------------- Bundesländer
  T.laender = {
    items: function () { return C.states.map(function (s) { return { id: s.id, tier: 'core' }; }); },
    gens: [
      function mapFind(id) {
        var s = STATE[id];
        return q({ format: 'mapClick', prompt: 'Wo liegt ' + s.name + '?', sub: 'Tippe auf das Bundesland.',
          visual: { map: 'germany', pick: 'state' }, answer: 'state-' + id,
          right: 'Richtig! Das ist ' + s.name + '.',
          wrong: function (g) { var o = g && STATE[g.replace('state-', '')]; return (o ? 'Das war ' + o.name + '. ' : '') + s.name + ' ist hier markiert.'; },
          reveal: 'state-' + id });
      },
      function mapName(id) {
        var s = STATE[id];
        return q({ format: 'choice', prompt: 'Welches Bundesland ist das?',
          visual: { map: 'germany', highlight: ['state-' + id] },
          options: options(id, C.confusable[id], C.states.map(function (x) { return x.id; }), 4, function (v) { return STATE[v].name; }),
          answer: id, right: 'Richtig! Das ist ' + s.name + '.',
          wrong: function () { return 'Das ist ' + s.name + '.'; } });
      }
    ]
  };

  // ---------------------------------------------------------------- Hauptstädte
  function capitalOf(id) { return STATE[id].capital; }
  T.hauptstaedte = {
    items: T.laender.items,
    gens: [
      function capChoice(id) {
        var s = STATE[id];
        var pref = (C.confusable[id] || []).map(capitalOf);
        return q({ format: 'choice', prompt: 'Wie heißt die Hauptstadt von ' + s.name + '?',
          options: options(s.capital, pref, C.states.map(function (x) { return x.capital; })),
          answer: s.capital, right: 'Richtig! ' + s.capital + ' ist die Hauptstadt von ' + s.name + '.',
          wrong: function (g) {
            var other = C.states.filter(function (x) { return x.capital === g && x.id !== id; })[0];
            return 'Fast! Die Hauptstadt von ' + s.name + ' ist ' + s.capital + '.' +
              (other ? ' ' + g + ' gehört zu ' + other.name + '.' : '');
          } });
      },
      function capType(id, ctx) {
        var s = STATE[id];
        if (!ctx.stat || (ctx.stat.box || 0) < 2) return null;   // typing only once he knows it a bit
        return q({ format: 'type', prompt: 'Schreibe die Hauptstadt von ' + s.name + '.',
          answer: s.capital, right: 'Richtig! ' + s.capital + '.',
          wrong: function () { return 'Die Hauptstadt von ' + s.name + ' ist ' + s.capital + '.'; } });
      },
      function capReverse(id) {
        var s = STATE[id];
        if (s.cityState) return null;
        var pref = C.confusable[id] || [];
        return q({ format: 'choice', prompt: 'Zu welchem Bundesland gehört die Hauptstadt ' + s.capital + '?',
          options: options(id, pref, C.states.filter(function (x) { return !x.cityState; }).map(function (x) { return x.id; }), 4,
            function (v) { return STATE[v].name; }),
          answer: id, right: 'Richtig! ' + s.capital + ' ist die Hauptstadt von ' + s.name + '.',
          wrong: function () { return s.capital + ' ist die Hauptstadt von ' + s.name + '.'; } });
      },
      function capMap(id) {
        var s = STATE[id];
        if (s.cityState) return null;
        return q({ format: 'mapClick', prompt: s.capital + ' ist eine Landeshauptstadt.', sub: 'In welchem Bundesland liegt sie? Tippe es an.',
          visual: { map: 'germany', pick: 'state', capitals: true }, answer: 'state-' + id,
          right: 'Richtig! ' + s.capital + ' liegt in ' + s.name + '.',
          wrong: function () { return s.capital + ' ist die Hauptstadt von ' + s.name + '.'; }, reveal: 'state-' + id });
      }
    ]
  };

  // ---------------------------------------------------------------- Wappen
  T.wappen = {
    items: T.laender.items,
    gens: [
      function wappenToName(id) {
        var s = STATE[id];
        return q({ format: 'choice', prompt: 'Zu welchem Bundesland gehört dieses Wappen?',
          visual: { wappen: s.wappen },
          options: options(id, C.confusable[id], C.states.map(function (x) { return x.id; }), 4, function (v) { return STATE[v].name; }),
          answer: id, right: 'Richtig! Das ist das Wappen von ' + s.name + '.',
          wrong: function () { return 'Das ist das Wappen von ' + s.name + '.'; } });
      },
      function nameToWappen(id) {
        var s = STATE[id];
        var opts = options(id, C.confusable[id], C.states.map(function (x) { return x.id; }), 4, function (v) { return STATE[v].name; });
        opts.forEach(function (o) { o.img = STATE[o.value].wappen; });
        return q({ format: 'choice', imageOptions: true, prompt: 'Welches ist das Wappen von ' + s.name + '?',
          options: opts, answer: id, right: 'Richtig! Das ist das Wappen von ' + s.name + '.',
          wrong: function (g) { return (g && STATE[g] ? 'Das war das Wappen von ' + STATE[g].name + '. ' : '') + 'Das Wappen von ' + s.name + ' ist grün markiert.'; } });
      }
    ]
  };

  // ---------------------------------------------------------------- Nachbarländer
  T.nachbarn = {
    items: function () {
      return NEIGHBOURS.map(function (c) { return { id: c.id, tier: 'core' }; }).concat([{ id: 'unterscheiden', tier: 'core' }]);
    },
    gens: [
      function findCountry(id) {
        if (id === 'unterscheiden') return null;
        var c = COUNTRY[id];
        return q({ format: 'mapClick', prompt: 'Tippe auf ' + c.name + '.', visual: { map: 'europe', pick: 'country' },
          answer: 'country-' + id, right: 'Richtig! Das ist ' + c.name + '.',
          wrong: function (g) { var o = g && COUNTRY[g.replace('country-', '')]; return (o ? 'Das war ' + o.name + '. ' : '') + c.name + ' ist markiert.'; },
          reveal: 'country-' + id });
      },
      function nameCountry(id) {
        if (id === 'unterscheiden') return null;
        var c = COUNTRY[id];
        var pool = NEIGHBOURS.concat(NOT_NEIGHBOURS).filter(function (x) { return x.id !== 'liechtenstein'; }).map(function (x) { return x.id; });
        return q({ format: 'choice', prompt: 'Welches Land ist das?', visual: { map: 'europe', highlight: ['country-' + id] },
          options: options(id, [], pool, 4, function (v) { return COUNTRY[v].name; }), answer: id,
          right: 'Richtig! Das ist ' + c.name + '.', wrong: function () { return 'Das ist ' + c.name + '.'; } });
      },
      function direction(id) {
        if (id === 'unterscheiden') return null;
        var c = COUNTRY[id];
        var others = NEIGHBOURS.filter(function (x) { return x.dir !== c.dir; }).map(function (x) { return x.id; });
        var prompt = c.dir === 'N' ? 'Welches Nachbarland liegt nördlich von Deutschland?'
          : 'Welches Nachbarland liegt ' + DIRADJ[c.dir] + ' von Deutschland?';
        var same = NEIGHBOURS.filter(function (x) { return x.dir === c.dir && x.id !== id; }).map(function (x) { return x.name; });
        return q({ format: 'choice', prompt: prompt, visual: { map: 'europe', compass: true },
          options: options(id, [], others, 4, function (v) { return COUNTRY[v].name; }), answer: id,
          right: 'Richtig! ' + c.name + ' liegt im ' + DIRNAME[c.dir] + '.' + (same.length ? ' Auch ' + same.join(' und ') + '.' : ''),
          wrong: function (g) { return c.name + ' liegt im ' + DIRNAME[c.dir] + '.' + (g && COUNTRY[g] ? ' ' + COUNTRY[g].name + ' liegt im ' + DIRNAME[COUNTRY[g].dir] + '.' : ''); },
          reveal: 'country-' + id });
      },
      function isNeighbour(id) {
        if (id === 'unterscheiden') return null;
        var c = COUNTRY[id];
        return q({ format: 'choice', prompt: 'Welches Land ist ein Nachbarland von Deutschland?',
          options: options(id, [], NOT_NEIGHBOURS.map(function (x) { return x.id; }), 4, function (v) { return COUNTRY[v].name; }),
          answer: id, right: 'Richtig! ' + c.name + ' grenzt an Deutschland.',
          wrong: function (g) { return (g && COUNTRY[g] ? COUNTRY[g].name + ' grenzt nicht an Deutschland. ' : '') + c.name + ' ist ein Nachbarland.'; } });
      },
      function notNeighbour(id) {
        if (id !== 'unterscheiden') return null;
        var odd = G.pick(NOT_NEIGHBOURS.filter(function (x) { return x.id !== 'liechtenstein'; }));
        return q({ format: 'choice', prompt: 'Welches Land ist KEIN Nachbarland von Deutschland?',
          options: options(odd.id, [], NEIGHBOURS.map(function (x) { return x.id; }), 4, function (v) { return COUNTRY[v].name; }),
          answer: odd.id, right: 'Richtig! ' + odd.name + ' grenzt nicht an Deutschland.',
          wrong: function () { return odd.name + ' grenzt nicht an Deutschland. Die anderen sind Nachbarländer.'; },
          visual: { map: 'europe', highlight: ['country-' + odd.id], quiet: true } });
      },
      function countNeighbours(id) {
        if (id !== 'unterscheiden') return null;
        return q({ format: 'choice', prompt: 'Wie viele Nachbarländer hat Deutschland?',
          options: G.shuffle(['7', '8', '9', '10']).map(function (v) { return { value: v, label: v }; }), answer: '9',
          right: 'Richtig! Deutschland hat 9 Nachbarländer.', wrong: function () { return 'Deutschland hat 9 Nachbarländer.'; } });
      }
    ]
  };

  // ---------------------------------------------------------------- Hessen: Städte
  var CORE_TOWNS = C.towns.filter(function (t) { return t.tier === 'core'; });
  function northMost() { return CORE_TOWNS.slice().sort(function (a, b) { return b.lonLat[1] - a.lonLat[1]; })[0]; }
  function southMost() { return CORE_TOWNS.slice().sort(function (a, b) { return a.lonLat[1] - b.lonLat[1]; })[0]; }
  function fromHome(t) { var d = G.bearing(HOME.lonLat, t.lonLat); return { deg: d, dir: G.clearDirection(d) }; }
  function nearTowns(t, n) {
    return C.towns.filter(function (x) { return x.id !== t.id && !x.home; })
      .sort(function (a, b) { return G.distKm(a.lonLat, t.lonLat) - G.distKm(b.lonLat, t.lonLat); })
      .slice(0, n).map(function (x) { return x.id; });
  }

  T.staedte = {
    items: function () { return C.towns.map(function (t) { return { id: t.id, tier: t.home ? 'core' : t.tier }; }); },
    gens: [
      function showTown(id) {
        var t = TOWN[id];
        return q({ format: 'mapClick', prompt: t.home ? 'Wo liegt Wehrheim auf der Hessenkarte?' : 'Zeig es auf der Karte: ' + tname(t),
          sub: t.home ? 'Hier wohnst du! Tippe auf den Punkt.' : 'Tippe auf den richtigen Punkt.',
          visual: { map: 'hessen', layers: { towns: true }, pick: 'town', anchor: !t.home, plainHome: t.home }, answer: 'town-' + id,
          right: 'Richtig! Hier liegt ' + tname(t) + '.',
          wrong: function (g) { var o = g && TOWN[g.replace('town-', '')]; return (o ? 'Das war ' + tname(o) + '. ' : '') + tname(t) + ' ist markiert.'; },
          reveal: 'town-' + id });
      },
      function nameTown(id) {
        var t = TOWN[id];
        if (t.home) return null;
        return q({ format: 'choice', prompt: 'Welche Stadt ist das?',
          visual: { map: 'hessen', layers: { towns: true }, highlight: ['town-' + id], anchor: true },
          options: options(id, nearTowns(t, 3), C.towns.filter(function (x) { return !x.home; }).map(function (x) { return x.id; }), 4,
            function (v) { return tname(TOWN[v]); }),
          answer: id, right: 'Richtig! Das ist ' + tname(t) + '.', wrong: function () { return 'Das ist ' + tname(t) + '. ' + t.fact; } });
      },
      function capitalOfHessen(id) {
        if (!TOWN[id].capital) return null;
        return q({ format: 'choice', prompt: 'Welche Stadt ist die Landeshauptstadt von Hessen?',
          options: options(id, ['frankfurt', 'kassel', 'darmstadt'], [], 4, function (v) { return tname(TOWN[v]); }),
          answer: id, right: 'Richtig! Wiesbaden ist die Landeshauptstadt – nicht Frankfurt, auch wenn Frankfurt größer ist.',
          wrong: function () { return 'Fast! Die Landeshauptstadt von Hessen ist Wiesbaden. Frankfurt ist nur die größte Stadt.'; } });
      },
      function extremes(id) {
        var t = TOWN[id], n = northMost(), s = southMost();
        if (t.id !== n.id && t.id !== s.id) return null;
        var north = t.id === n.id;
        var pool = CORE_TOWNS.filter(function (x) { return north ? x.lonLat[1] < 50.7 : x.lonLat[1] > 50.3; }).map(function (x) { return x.id; });
        return q({ format: 'choice', prompt: north ? 'Welche große Stadt liegt ganz im Norden von Hessen?' : 'Welche große Stadt liegt ganz im Süden von Hessen?',
          options: options(id, [], pool, 4, function (v) { return tname(TOWN[v]); }), answer: id,
          right: 'Richtig! ' + tname(t) + ' liegt ganz im ' + (north ? 'Norden' : 'Süden') + '.',
          wrong: function () { return tname(t) + ' liegt ganz im ' + (north ? 'Norden' : 'Süden') + ' von Hessen.'; },
          visual: { map: 'hessen', layers: { towns: true }, anchor: true, compass: true, quiet: true }, reveal: 'town-' + id });
      },
      function fromWehrheim(id) {
        var t = TOWN[id];
        if (t.home) return null;
        var fh = fromHome(t);
        if (!fh.dir || G.distKm(HOME.lonLat, t.lonLat) < 8) return null;
        var dir = fh.dir;
        var pool = C.towns.filter(function (x) {
          return !x.home && x.id !== id && G.clearlyNot(G.bearing(HOME.lonLat, x.lonLat), dir.id) && G.distKm(HOME.lonLat, x.lonLat) > 8;
        }).map(function (x) { return x.id; });
        if (pool.length < 3) return null;
        return q({ format: 'choice', prompt: 'Welche Stadt liegt ' + dir.adj + ' von Wehrheim?',
          sub: 'Schau auf die Karte. Norden ist oben.',
          visual: { map: 'hessen', layers: { towns: true, labels: true }, anchor: true, compass: true },
          options: options(id, [], pool, 4, function (v) { return tname(TOWN[v]); }), answer: id,
          right: 'Richtig! ' + tname(t) + ' liegt ' + dir.adj + ' von Wehrheim.',
          wrong: function (g) {
            var o = g && TOWN[g];
            return tname(t) + ' liegt ' + dir.adj + ' von Wehrheim.' + (o ? ' ' + tname(o) + ' liegt woanders.' : '');
          }, reveal: 'town-' + id });
      },
      function sequence(id) {
        var t = TOWN[id];
        if (t.home || t.tier !== 'core') return null;
        return q({ format: 'mapSeq', prompt: 'Finde zuerst Wehrheim und dann ' + tname(t) + '.',
          visual: { map: 'hessen', layers: { towns: true }, pick: 'town', plainHome: true },
          targets: ['town-wehrheim', 'town-' + id], answer: 'town-' + id,
          stepLabels: ['Wehrheim', tname(t)],
          right: 'Super! Von Wehrheim nach ' + tname(t) + '.',
          wrong: function () { return 'Wehrheim und ' + tname(t) + ' sind jetzt markiert.'; } });
      }
    ]
  };

  // ---------------------------------------------------------------- Hessen: Flüsse
  var HESSEN_RIVERS = C.rivers;
  T.fluesse = {
    items: function () { return C.rivers.map(function (r) { return { id: r.id, tier: r.tier }; }); },
    gens: [
      function clickRiver(id) {
        var r = RIVER[id];
        return q({ format: 'mapClick', prompt: 'Zeige ' + art(r, 'akk') + ' ' + r.name + '.', sub: 'Tippe auf den Fluss.',
          visual: { map: 'hessen', layers: { rivers: true, towns: true, townsQuiet: true }, pick: 'river', anchor: true },
          answer: 'river-' + id, right: 'Richtig! Das ist ' + art(r) + ' ' + r.name + '.',
          wrong: function (g) { var o = g && RIVER[g.replace('river-', '')]; return (o ? 'Das war ' + art(o) + ' ' + o.name + '. ' : '') + cap(art(r)) + ' ' + r.name + ' leuchtet jetzt.'; },
          reveal: 'river-' + id });
      },
      function nameRiver(id) {
        var r = RIVER[id];
        var pref = [r.into, r.joinsWith].filter(Boolean);
        C.rivers.forEach(function (x) { if (x.into === id) pref.push(x.id); });
        return q({ format: 'choice', prompt: 'Wie heißt dieser Fluss?',
          visual: { map: 'hessen', layers: { rivers: true, towns: true, townsQuiet: true }, highlight: ['river-' + id], anchor: true },
          options: options(id, pref, C.rivers.map(function (x) { return x.id; }), 4, function (v) { return RIVER[v].name; }),
          answer: id, right: 'Richtig! Das ist ' + art(r) + ' ' + r.name + '.', wrong: function () { return 'Das ist ' + art(r) + ' ' + r.name + '. ' + r.fact; } });
      },
      function throughTown(id) {
        var towns = C.towns.filter(function (t) { return (t.rivers || []).indexOf(id) >= 0; });
        if (!towns.length) return null;
        var t = G.pick(towns), r = RIVER[id];
        var pool = C.rivers.filter(function (x) { return (t.rivers || []).indexOf(x.id) < 0; }).map(function (x) { return x.id; });
        return q({ format: 'choice', prompt: (t.capital ? 'An welchem Fluss liegt ' : 'Welcher Fluss fließt durch ') + tname(t) + '?',
          options: options(id, [], pool, 4, function (v) { return RIVER[v].name; }), answer: id,
          right: 'Richtig! ' + tname(t) + ' liegt ' + (r.article === 'der' ? 'am ' : 'an der ') + r.name + '.',
          wrong: function () { return tname(t) + ' liegt ' + (r.article === 'der' ? 'am ' : 'an der ') + r.name + '.'; },
          visual: { map: 'hessen', layers: { rivers: true, towns: true }, highlight: ['town-' + t.id], quiet: true }, reveal: 'river-' + id });
      },
      function intoRiver(id) {
        var r = RIVER[id];
        if (!r.into) return null;
        var into = RIVER[r.into];
        var pool = C.rivers.filter(function (x) { return x.id !== id && x.id !== r.into; }).map(function (x) { return x.id; });
        return q({ format: 'choice', prompt: 'In welchen Fluss mündet ' + art(r) + ' ' + r.name + '?',
          options: options(r.into, [], pool, 4, function (v) { return RIVER[v].name; }), answer: r.into,
          right: 'Richtig! ' + cap(art(r)) + ' ' + r.name + ' fließt in ' + art(into, 'akk') + ' ' + into.name + '.',
          wrong: function () { return cap(art(r)) + ' ' + r.name + ' mündet in ' + art(into, 'akk') + ' ' + into.name + '.' + chainText(id); },
          visual: { map: 'hessen', layers: { rivers: true }, highlight: ['river-' + id, 'river-' + r.into], quiet: true } });
      },
      function weser(id) {
        if (id !== 'weser' && id !== 'werra') return null;
        var ok = 'Fulda und Werra';
        return q({ format: 'choice', prompt: 'Aus welchen zwei Flüssen entsteht die Weser?',
          options: G.shuffle([ok, 'Main und Rhein', 'Lahn und Eder', 'Nidda und Nidder']).map(function (v) { return { value: v, label: v }; }),
          answer: ok, right: 'Richtig! Fulda und Werra fließen zusammen und werden zur Weser.',
          wrong: function () { return 'Fulda und Werra fließen in Hann. Münden zusammen – ab da heißt der Fluss Weser.'; },
          visual: { map: 'hessen', layers: { rivers: true }, highlight: ['river-fulda', 'river-werra', 'river-weser'], quiet: true } });
      },
      function northRiver(id) {
        if (id !== 'fulda') return null;
        return q({ format: 'choice', prompt: 'Welcher große Fluss fließt durch Nordhessen und durch Kassel?',
          options: options('fulda', [], ['main', 'nidda', 'kinzig', 'nidder', 'rhein'], 4, function (v) { return RIVER[v].name; }),
          answer: 'fulda', right: 'Richtig! Die Fulda fließt durch Kassel.',
          wrong: function () { return 'Die Fulda fließt durch Nordhessen und durch Kassel.'; }, reveal: 'river-fulda' });
      },
      function dragRiver(id) {
        var r = RIVER[id];
        if (r.tier !== 'core') return null;
        return q({ format: 'mapDrag', exam: false, prompt: 'Ziehe »' + r.name + '« auf den richtigen Fluss.',
          visual: { map: 'hessen', layers: { rivers: true, towns: true, townsQuiet: true }, pick: 'river', anchor: true },
          chip: r.name, answer: 'river-' + id, right: 'Richtig! Das ist ' + art(r) + ' ' + r.name + '.',
          wrong: function () { return 'Hier fließt ' + art(r) + ' ' + r.name + '.'; }, reveal: 'river-' + id });
      }
    ]
  };
  // "Nidder → Nidda → Main → Rhein"
  function chain(id) {
    var out = [RIVER[id].name], cur = RIVER[id], guard = 0;
    while (cur && cur.into && guard++ < 6) { cur = RIVER[cur.into]; out.push(cur.name); }
    return out;
  }
  function chainText(id) { var c = chain(id); return c.length > 2 ? ' (' + c.join(' → ') + ')' : ''; }

  // ---------------------------------------------------------------- Hessen: Gebirge
  T.gebirge = {
    items: function () { return C.mountains.map(function (m) { return { id: m.id, tier: m.tier }; }); },
    gens: [
      function clickRegion(id) {
        var m = MOUNT[id];
        return q({ format: 'mapClick', prompt: 'Wo liegt ' + art(m) + ' ' + m.name + '?', sub: 'Tippe auf das Gebirge.',
          visual: { map: 'hessen', layers: { regions: true, towns: true, townsQuiet: true }, pick: 'region', anchor: true },
          answer: 'region-' + id, right: 'Richtig! Das ist ' + art(m) + ' ' + m.name + '.',
          wrong: function (g) { var o = g && MOUNT[g.replace('region-', '')]; return (o ? 'Das war ' + art(o) + ' ' + o.name + '. ' : '') + cap(art(m)) + ' ' + m.name + ' ist markiert.'; },
          reveal: 'region-' + id });
      },
      function nameRegion(id) {
        var m = MOUNT[id];
        return q({ format: 'choice', prompt: 'Welches Gebirge ist das?',
          visual: { map: 'hessen', layers: { regions: true, towns: true, townsQuiet: true }, highlight: ['region-' + id], anchor: true },
          options: options(id, [], C.mountains.map(function (x) { return x.id; }), 4, function (v) { return MOUNT[v].name; }),
          answer: id, right: 'Richtig! Das ist ' + art(m) + ' ' + m.name + '.', wrong: function () { return 'Das ist ' + art(m) + ' ' + m.name + '. ' + m.fact; } });
      },
      function where(id) {
        var m = MOUNT[id];
        return q({ format: 'choice', prompt: 'Welches Mittelgebirge liegt ' + m.where + ' von Hessen?',
          options: options(id, [], C.mountains.map(function (x) { return x.id; }), 4, function (v) { return MOUNT[v].name; }),
          answer: id, right: 'Richtig! ' + cap(art(m)) + ' ' + m.name + ' liegt ' + m.where + '.',
          wrong: function () { return cap(art(m)) + ' ' + m.name + ' liegt ' + m.where + ' von Hessen.'; },
          visual: { map: 'hessen', layers: { regions: true }, compass: true, quiet: true }, reveal: 'region-' + id });
      },
      function special(id) {
        var m = MOUNT[id];
        var pool = C.mountains.map(function (x) { return x.id; });
        var label = function (v) { return MOUNT[v].name; };
        if (id === 'taunus') return q({ format: 'choice', prompt: 'Welches Mittelgebirge liegt bei Wehrheim?',
          options: options(id, [], pool, 4, label), answer: id, right: 'Richtig! Wehrheim liegt im Taunus – da wohnst du!',
          wrong: function () { return 'Wehrheim liegt im Taunus. Da wohnst du!'; },
          visual: { map: 'hessen', layers: { regions: true }, anchor: true, quiet: true }, reveal: 'region-taunus' });
        if (id === 'rhoen') return q({ format: 'choice', prompt: 'In welchem Gebirge liegt die Wasserkuppe, der höchste Berg von Hessen?',
          options: options(id, [], pool, 4, label), answer: id, right: 'Richtig! Die Wasserkuppe liegt in der Rhön.',
          wrong: function () { return 'Die Wasserkuppe (950 m) liegt in der Rhön.'; } });
        if (id === 'vogelsberg') return q({ format: 'choice', prompt: 'Aus welchem Gebirge kommen Nidda und Nidder?',
          options: options(id, [], pool, 4, label), answer: id, right: 'Richtig! Beide kommen aus dem Vogelsberg.',
          wrong: function () { return 'Nidda und Nidder kommen aus dem Vogelsberg.'; },
          visual: { map: 'hessen', layers: { regions: true, rivers: true }, highlight: ['river-nidda', 'river-nidder'], quiet: true } });
        return null;
      }
    ]
  };

  // ---------------------------------------------------------------- Kartenkunde: Legende
  var SCENE_ITEMS = ['stadt', 'dorf', 'see', 'berg', 'bahnhof', 'kirche', 'burg'];
  T.legende = {
    items: function () { return C.legend.map(function (l) { return { id: l.id, tier: (l.id === 'kirche' || l.id === 'burg') ? 'extra' : 'core' }; }); },
    gens: [
      function symbolToName(id) {
        var l = LEG[id];
        return q({ format: 'choice', prompt: 'Was bedeutet dieses Zeichen?', visual: { symbol: id },
          options: options(id, [], C.legend.map(function (x) { return x.id; }), 4, function (v) { return LEG[v].name; }),
          answer: id, right: 'Richtig! Das Zeichen bedeutet ' + l.name + '.', wrong: function () { return 'Dieses Zeichen bedeutet ' + l.name + '.'; } });
      },
      function nameToSymbol(id) {
        var l = LEG[id];
        var opts = options(id, [], C.legend.map(function (x) { return x.id; }), 4, function (v) { return LEG[v].name; });
        opts.forEach(function (o) { o.symbol = o.value; });
        return q({ format: 'choice', imageOptions: true, prompt: 'Welches Zeichen zeigt ' + l.article + ' ' + l.name + '?',
          options: opts, answer: id, right: 'Richtig!', wrong: function () { return 'So sieht das Zeichen für ' + l.name + ' aus.'; } });
      },
      function colourQuestion(id) {
        var map = { wald: 'die grüne Fläche', fluss: 'die blaue Linie', see: 'die blaue Fläche' };
        if (!map[id]) return null;
        var l = LEG[id];
        return q({ format: 'choice', prompt: 'Was bedeutet ' + map[id] + ' auf der Karte?', visual: { symbol: id },
          options: options(id, ['wald', 'fluss', 'see', 'strasse'], [], 4, function (v) { return LEG[v].name; }), answer: id,
          right: 'Richtig! ' + cap(map[id]) + ' bedeutet ' + l.name + '.', wrong: function () { return cap(map[id]) + ' bedeutet ' + l.name + '.'; } });
      },
      function findOnScene(id, ctx) {
        if (SCENE_ITEMS.indexOf(id) < 0) return null;
        var l = LEG[id], s = K.makeScene();
        return q({ format: 'cellClick', prompt: 'Finde ' + (l.article === 'einen' ? 'den' : l.article === 'ein' ? 'das' : 'die') + ' ' + l.name + ' auf der Karte.',
          sub: 'Die Legende hilft dir.', visual: { scene: s, legend: true, grid: false }, answer: s.obj[id].cell,
          right: 'Richtig gefunden!', wrong: function () { return 'Hier ist ' + (l.article === 'einen' ? 'der' : l.article === 'ein' ? 'das' : 'die') + ' ' + l.name + '.'; } });
      }
    ]
  };

  // ---------------------------------------------------------------- Kartenkunde: Planquadrate
  var OBJ_NAME = { stadt: 'die Stadt', dorf: 'das Dorf', see: 'der See', berg: 'der Berg', bahnhof: 'der Bahnhof', kirche: 'die Kirche', burg: 'die Burg' };
  function vonDat(id) {            // 'der Bahnhof' → 'vom Bahnhof', 'die Stadt' → 'von der Stadt'
    var a = OBJ_NAME[id].split(' ');
    return (a[0] === 'die' ? 'von der ' : 'vom ') + a[1];
  }
  function nearCells(cell) {
    var c = K.COLS.indexOf(cell[0]), r = +cell.slice(1) - 1, out = [];
    // typical mistakes: swapped neighbours, one off
    [[c + 1, r], [c - 1, r], [c, r + 1], [c, r - 1], [r, c]].forEach(function (p) {
      if (p[0] >= 0 && p[0] < 5 && p[1] >= 0 && p[1] < 5) out.push(K.cellName(p[0], p[1]));
    });
    return out.filter(function (x) { return x !== cell; });
  }
  function allCells() { var a = []; for (var c = 0; c < 5; c++) for (var r = 0; r < 5; r++) a.push(K.cellName(c, r)); return a; }
  T.planquadrate = {
    items: function () { return [{ id: 'lesen', tier: 'core' }, { id: 'finden', tier: 'core' }, { id: 'was', tier: 'core' }]; },
    gens: [
      function lesen(id) {
        if (id !== 'lesen') return null;
        var s = K.makeScene(), o = G.pick(s.objects);
        return q({ format: 'choice', prompt: 'In welchem Planquadrat liegt ' + OBJ_NAME[o.id] + '?',
          sub: 'Erst den Buchstaben (oben), dann die Zahl (links).',
          visual: { scene: s, legend: true }, options: options(o.cell, nearCells(o.cell), allCells()), answer: o.cell,
          right: 'Richtig! ' + cap(OBJ_NAME[o.id]) + ' liegt in ' + o.cell + '.',
          wrong: function () { return cap(OBJ_NAME[o.id]) + ' liegt in ' + o.cell + ': Spalte ' + o.cell[0] + ', Zeile ' + o.cell.slice(1) + '.'; },
          revealCell: o.cell });
      },
      function finden(id) {
        if (id !== 'finden') return null;
        var s = K.makeScene(), cell = G.pick(allCells());
        return q({ format: 'cellClick', prompt: 'Tippe auf das Planquadrat ' + cell + '.',
          sub: 'Buchstabe ' + cell[0] + ' oben, Zahl ' + cell.slice(1) + ' links.',
          visual: { scene: s }, answer: cell, right: 'Richtig! Das ist ' + cell + '.',
          wrong: function (g) { return (g ? 'Das war ' + g + '. ' : '') + cell + ' ist hier: Spalte ' + cell[0] + ', Zeile ' + cell.slice(1) + '.'; } });
      },
      function was(id) {
        if (id !== 'was') return null;
        var s = K.makeScene(), o = G.pick(s.objects);
        var others = s.objects.filter(function (x) { return x.id !== o.id; }).map(function (x) { return x.id; });
        return q({ format: 'choice', prompt: 'Was liegt im Planquadrat ' + o.cell + '?', visual: { scene: s, legend: true },
          options: options(o.id, [], others, 4, function (v) { return cap(OBJ_NAME[v].split(' ')[1]); }), answer: o.id,
          right: 'Richtig! In ' + o.cell + ' liegt ' + OBJ_NAME[o.id] + '.',
          wrong: function () { return 'In ' + o.cell + ' liegt ' + OBJ_NAME[o.id] + '.'; }, revealCell: o.cell });
      }
    ]
  };

  // ---------------------------------------------------------------- Kartenkunde: Himmelsrichtungen
  T.richtungen = {
    items: function () {
      return [{ id: 'oben', tier: 'core' }, { id: 'windrose', tier: 'core' }, { id: 'nord-von', tier: 'core' },
              { id: 'richtung-von', tier: 'core' }, { id: 'hessen', tier: 'core' }];
    },
    gens: [
      function oben(id) {
        if (id !== 'oben') return null;
        var side = G.pick([['oben', 'N'], ['unten', 'S'], ['rechts', 'O'], ['links', 'W']]);
        return q({ format: 'choice', prompt: 'Welche Himmelsrichtung zeigt auf einer Karte nach ' + side[0] + '?',
          options: G.shuffle(['N', 'O', 'S', 'W']).map(function (v) { return { value: v, label: DIRNAME[v] }; }), answer: side[1],
          right: 'Richtig! ' + cap(side[0]) + ' ist ' + DIRNAME[side[1]] + '.',
          wrong: function () { return 'Auf Karten ist Norden oben. Nach ' + side[0] + ' zeigt ' + DIRNAME[side[1]] + '.'; },
          visual: { rose: true, roseLabels: false } });
      },
      function windrose(id) {
        if (id !== 'windrose') return null;
        var d = G.pick(['N', 'O', 'S', 'W']);
        return q({ format: 'roseClick', prompt: 'Tippe auf ' + DIRNAME[d] + '.', sub: 'Merkspruch: Nie Ohne Seife Waschen (im Uhrzeigersinn).',
          visual: { rose: true, roseLabels: false, roseN: true }, answer: d,
          right: 'Richtig! Das ist ' + DIRNAME[d] + '.', wrong: function () { return DIRNAME[d] + ' ist markiert. Norden ist oben, dann im Uhrzeigersinn: Osten, Süden, Westen.'; } });
      },
      function nordVon(id) {
        if (id !== 'nord-von') return null;
        for (var t = 0; t < 30; t++) {
          var s = K.makeScene(), a = G.pick(s.objects), dir = G.pick(['N', 'O', 'S', 'W']);
          var hits = s.objects.filter(function (b) { return b !== a && K.gridDirection(a, b) === dir; });
          if (hits.length !== 1) continue;
          var ans = hits[0];
          var pool = s.objects.filter(function (b) { return b !== a && b !== ans && !K.anyNorthish(a, b, dir); }).map(function (b) { return b.id; });
          if (pool.length < 2) continue;
          return q({ format: 'choice', prompt: 'Was liegt ' + DIRADJ[dir] + ' ' + vonDat(a.id) + '?',
            sub: 'Norden ist oben.', visual: { scene: s, legend: true, compass: true, grid: false, mark: a.id },
            options: options(ans.id, [], pool, Math.min(4, pool.length + 1), function (v) { return cap(OBJ_NAME[v].split(' ')[1]); }), answer: ans.id,
            right: 'Richtig! ' + cap(OBJ_NAME[ans.id]) + ' liegt ' + DIRADJ[dir] + '.',
            wrong: function () { return cap(OBJ_NAME[ans.id]) + ' liegt ' + DIRADJ[dir] + ' – ' + ({ N: 'darüber', S: 'darunter', O: 'rechts daneben', W: 'links daneben' })[dir] + '.'; } });
        }
        return null;
      },
      function richtungVon(id) {
        if (id !== 'richtung-von') return null;
        for (var t = 0; t < 30; t++) {
          var s = K.makeScene(), a = G.pick(s.objects), b = G.pick(s.objects);
          if (a === b) continue;
          var dir = K.gridDirection(a, b);
          if (!dir) continue;
          return q({ format: 'choice', prompt: 'In welcher Richtung liegt ' + OBJ_NAME[b.id] + ', ' + vonDat(a.id) + ' aus gesehen?',
            sub: 'Norden ist oben.', visual: { scene: s, legend: true, compass: true, grid: false, mark: a.id },
            options: G.shuffle(['N', 'O', 'S', 'W']).map(function (v) { return { value: v, label: DIRNAME[v] }; }), answer: dir,
            right: 'Richtig! Im ' + DIRNAME[dir] + '.', wrong: function () { return cap(OBJ_NAME[b.id]) + ' liegt im ' + DIRNAME[dir] + '.'; } });
        }
        return null;
      },
      function hessenRichtung(id) {
        if (id !== 'hessen') return null;
        var ok = C.towns.filter(function (t) {
          if (t.home || G.distKm(HOME.lonLat, t.lonLat) < 8) return false;
          var d = G.clearDirection(G.bearing(HOME.lonLat, t.lonLat));
          return d && d.id.length === 1;
        });
        var t = G.pick(ok), d = G.clearDirection(G.bearing(HOME.lonLat, t.lonLat));
        return q({ format: 'choice', prompt: 'In welcher Richtung liegt ' + tname(t) + ' von Wehrheim aus?',
          sub: 'Norden ist oben.', visual: { map: 'hessen', layers: { towns: true, labels: true }, anchor: true, compass: true, highlight: ['town-' + t.id] },
          options: G.shuffle(['N', 'O', 'S', 'W']).map(function (v) { return { value: v, label: DIRNAME[v] }; }), answer: d.id,
          right: 'Richtig! ' + tname(t) + ' liegt im ' + d.name + ' von Wehrheim.', wrong: function () { return tname(t) + ' liegt ' + d.adj + ' von Wehrheim.'; } });
      }
    ]
  };

  // ======================================================================= API
  function topicItems(topic) {
    return T[topic].items().map(function (it) { return { key: topic + ':' + it.id, id: it.id, tier: it.tier, topic: topic }; });
  }
  // Build a question for (topic, item). ctx: {stat, exam, allow:[formats]}
  function make(topic, itemId, ctx) {
    ctx = ctx || {};
    var gens = G.shuffle(T[topic].gens);
    for (var i = 0; i < gens.length; i++) {
      var qq = null;
      try { qq = gens[i](itemId, ctx); } catch (e) { if (root.console) console.warn('generator failed', topic, itemId, e); qq = null; }
      if (!qq) continue;
      if (ctx.exam && !qq.exam) continue;
      if (ctx.allow && ctx.allow.indexOf(qq.format) < 0) continue;
      if (ctx.forbid && ctx.forbid.indexOf(qq.format) >= 0) continue;
      qq.topic = topic; qq.item = itemId; qq.key = topic + ':' + itemId; qq.gen = gens[i].name;
      return qq;
    }
    return null;
  }
  function check(qq, given) {
    if (qq.format === 'type') return G.matchTyped(given, qq.answer) !== 'wrong';
    if (qq.accept) return qq.accept.indexOf(given) >= 0;
    return given === qq.answer;
  }

  root.GeoQuestions = {
    topics: T, topicItems: topicItems, make: make, check: check, chain: chain,
    STATE: STATE, COUNTRY: COUNTRY, TOWN: TOWN, RIVER: RIVER, MOUNT: MOUNT, LEG: LEG, OBJ_NAME: OBJ_NAME,
    DIRNAME: DIRNAME, tname: tname, art: art
  };
})(typeof window !== 'undefined' ? window : globalThis);
