/*
 * compare.js — deterministic sentence comparison for the Diktat-Trainer.
 *
 * No LLM, no network. Two levels of alignment:
 *   1. Token level (words + punctuation) with a weighted edit distance, so a
 *      misspelled word is paired with its target instead of being counted as
 *      "one missing + one extra". Also handles joined ("nachhause") and
 *      split ("Fahr rad") words.
 *   2. Character level inside each misspelled word, so we can highlight
 *      exactly which letters need attention.
 *
 * Result shape (see compareSentence):
 *   { perfect, items[], errors[], stats }
 *   items  = ordered list for rendering the correct sentence with marks
 *   errors = one entry per problem, with a type and a kid-friendly hint
 */
(function (root) {
  'use strict';

  // ---------- normalisation & tokenising ----------

  function normalise(s) {
    return (s || '')
      .normalize('NFC')
      .replace(/[„“”«»″]/g, '"')      // all double quotes → "
      .replace(/[‚‘’`´]/g, "'")        // all single quotes → '
      .replace(/[‐‑‒–—]/g, '-')        // dashes → -
      .replace(/ /g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  // Words may contain inner hyphens/apostrophes (E-Mail, geht's).
  var TOKEN_RE = /[\p{L}\p{N}]+(?:['-][\p{L}\p{N}]+)*|[^\s\p{L}\p{N}]/gu;

  function tokenize(s) {
    var out = [];
    var m;
    var str = normalise(s);
    TOKEN_RE.lastIndex = 0;
    while ((m = TOKEN_RE.exec(str)) !== null) {
      var t = m[0];
      out.push({ text: t, kind: /[\p{L}\p{N}]/u.test(t) ? 'word' : 'punct' });
    }
    return out;
  }

  function lower(s) { return s.toLocaleLowerCase('de-DE'); }

  // ---------- plain Levenshtein ----------

  function lev(a, b) {
    var m = a.length, n = b.length;
    if (!m) return n;
    if (!n) return m;
    var prev = new Array(n + 1), cur = new Array(n + 1);
    for (var j = 0; j <= n; j++) prev[j] = j;
    for (var i = 1; i <= m; i++) {
      cur[0] = i;
      for (var k = 1; k <= n; k++) {
        cur[k] = Math.min(prev[k] + 1, cur[k - 1] + 1, prev[k - 1] + (a[i - 1] === b[k - 1] ? 0 : 1));
      }
      var tmp = prev; prev = cur; cur = tmp;
    }
    return prev[n];
  }

  // ---------- token alignment ----------

  var COST = { indel: 1, caseOnly: 0.3, joinSplit: 0.5, punctSub: 1, spellingScale: 2.4 };

  function subCost(e, t) {
    if (e.kind !== t.kind) return Infinity;
    if (e.kind === 'punct') return e.text === t.text ? 0 : COST.punctSub;
    if (e.text === t.text) return 0;
    var le = lower(e.text), lt = lower(t.text);
    if (le === lt) return COST.caseOnly;
    var d = lev(le, lt);
    var ratio = d / Math.max(le.length, lt.length);
    // Very different words cost more than delete+insert (2), so the aligner
    // prefers "missing + extra" for them instead of calling it a misspelling.
    return 0.2 + ratio * COST.spellingScale;
  }

  function joinKey(tokens) {
    return lower(tokens.map(function (x) { return x.text; }).join('')).replace(/-/g, '');
  }

  function alignTokens(E, T) {
    var m = E.length, n = T.length;
    var D = [], B = [];
    for (var i = 0; i <= m; i++) { D.push(new Array(n + 1).fill(Infinity)); B.push(new Array(n + 1).fill(null)); }
    D[0][0] = 0;
    for (i = 0; i <= m; i++) {
      for (var j = 0; j <= n; j++) {
        var here = D[i][j];
        if (here === Infinity) continue;
        function relax(ii, jj, c, op) {
          if (here + c < D[ii][jj]) { D[ii][jj] = here + c; B[ii][jj] = { i: i, j: j, op: op }; }
        }
        if (i < m) relax(i + 1, j, COST.indel, 'del');
        if (j < n) relax(i, j + 1, COST.indel, 'ins');
        if (i < m && j < n) {
          var c = subCost(E[i], T[j]);
          if (c < Infinity) relax(i + 1, j + 1, c, 'sub');
        }
        // two target words written as one ("nachhause" for "nach Hause")
        if (i + 1 < m && j < n && E[i].kind === 'word' && E[i + 1].kind === 'word' && T[j].kind === 'word' &&
            joinKey([E[i], E[i + 1]]) === joinKey([T[j]])) relax(i + 2, j + 1, COST.joinSplit, 'join');
        // one target word written as two ("Fahr rad" for "Fahrrad")
        if (i < m && j + 1 < n && E[i].kind === 'word' && T[j].kind === 'word' && T[j + 1].kind === 'word' &&
            joinKey([E[i]]) === joinKey([T[j], T[j + 1]])) relax(i + 1, j + 2, COST.joinSplit, 'split');
      }
    }
    // backtrack
    var ops = [];
    i = m; j = n;
    while (i > 0 || j > 0) {
      var b = B[i][j];
      ops.push({ op: b.op, e: E.slice(b.i, i), t: T.slice(b.j, j) });
      i = b.i; j = b.j;
    }
    return ops.reverse();
  }

  // ---------- character alignment inside a word ----------

  // Returns per-character marks for the target word plus a count of extra
  // letters the child typed. Case-sensitive so a wrong capital shows too.
  function charDiff(expected, got) {
    var a = Array.from(expected), b = Array.from(got);
    var m = a.length, n = b.length;
    var D = [];
    for (var i = 0; i <= m; i++) { D.push(new Array(n + 1).fill(0)); D[i][0] = i; }
    for (var j = 0; j <= n; j++) D[0][j] = j;
    for (i = 1; i <= m; i++) {
      for (j = 1; j <= n; j++) {
        var same = a[i - 1] === b[j - 1] ? 0 : (lower(a[i - 1]) === lower(b[j - 1]) ? 0.5 : 1);
        D[i][j] = Math.min(D[i - 1][j] + 1, D[i][j - 1] + 1, D[i - 1][j - 1] + same);
      }
    }
    var marks = new Array(m).fill('ok');
    var extraBefore = new Array(m + 1).fill(0); // extra typed letters before target index
    i = m; j = n;
    while (i > 0 || j > 0) {
      if (i > 0 && j > 0) {
        var s = a[i - 1] === b[j - 1] ? 0 : (lower(a[i - 1]) === lower(b[j - 1]) ? 0.5 : 1);
        if (D[i][j] === D[i - 1][j - 1] + s) {
          if (s) marks[i - 1] = 'fix';
          i--; j--; continue;
        }
      }
      if (i > 0 && D[i][j] === D[i - 1][j] + 1) { marks[i - 1] = 'fix'; i--; continue; }
      extraBefore[i]++; j--;
    }
    // An extra letter is shown by marking its neighbours in the target word.
    for (var k = 0; k <= m; k++) {
      if (extraBefore[k]) {
        if (k > 0) marks[k - 1] = marks[k - 1] === 'ok' ? 'near' : marks[k - 1];
        if (k < m) marks[k] = marks[k] === 'ok' ? 'near' : marks[k];
      }
    }
    return a.map(function (ch, idx) { return { ch: ch, mark: marks[idx] }; });
  }

  // ---------- kid-friendly hints (German) ----------

  function spellingHint(exp, got) {
    var e = lower(exp), g = lower(got);
    var capNote = exp[0] !== got[0] && lower(exp[0]) === lower(got[0])
      ? (exp[0] === exp[0].toUpperCase() ? ' Und: groß am Anfang.' : ' Und: klein am Anfang.') : '';
    var dbl = e.match(/(bb|dd|ff|gg|kk|ll|mm|nn|pp|rr|ss|tt)/g) || [];
    for (var d = 0; d < dbl.length; d++) {
      if (e.replace(dbl[d], dbl[d][0]) === g) return 'Doppelter Mitlaut: „' + dbl[d] + '“ – nach kurzem Vokal.' + capNote;
    }
    if (/ck/.test(e) && e.replace('ck', 'k') === g) return 'Nach kurzem Vokal: „ck“ statt „k“.' + capNote;
    if (/tz/.test(e) && e.replace('tz', 'z') === g) return 'Nach kurzem Vokal: „tz“ statt „z“.' + capNote;
    if (/ie/.test(e) && e.replace('ie', 'i') === g) return 'Langes i schreibt man meistens „ie“.' + capNote;
    if (/[aeiouäöü]h/.test(e) && e.replace(/([aeiouäöü])h/, '$1') === g) return 'Hier steckt ein Dehnungs-h drin.' + capNote;
    if (/ß/.test(e) && e.replace('ß', 'ss') === g) return 'Nach langem Vokal: „ß“.' + capNote;
    if (/ss/.test(e) && e.replace('ss', 'ß') === g) return 'Nach kurzem Vokal: „ss“.' + capNote;
    if (/ä/.test(e) && e.replace('ä', 'e') === g) return '„ä“ – weil es mit „a“ verwandt ist.' + capNote;
    if (/äu/.test(e) && e.replace('äu', 'eu') === g) return '„äu“ – weil es mit „au“ verwandt ist.' + capNote;
    if (/^v/.test(e) && e.replace(/^v/, 'f') === g) return 'Mit „V“ wie bei „Vogel“.' + capNote;
    if (e.length > g.length) return 'Da fehlt noch etwas – schau auf die markierten Buchstaben.' + capNote;
    if (e.length < g.length) return 'Ein Buchstabe zu viel – schau auf die markierten Stellen.' + capNote;
    return 'Schau auf die markierten Buchstaben.' + capNote;
  }

  function punctName(p) {
    return { '.': 'Punkt', ',': 'Komma', '?': 'Fragezeichen', '!': 'Ausrufezeichen', ':': 'Doppelpunkt',
             ';': 'Semikolon', '"': 'Anführungszeichen', '-': 'Bindestrich' }[p] || '„' + p + '“';
  }

  // ---------- main entry ----------

  function compareSentence(target, typed) {
    var E = tokenize(target), T = tokenize(typed);
    var ops = alignTokens(E, T);
    var items = [], errors = [];
    var wordsTotal = E.filter(function (x) { return x.kind === 'word'; }).length;
    var wordsCorrect = 0;
    var isLastPunct = function (idx) { return idx === ops.length - 1; };

    ops.forEach(function (o, idx) {
      var e = o.e[0], t = o.t[0];
      if (o.op === 'sub' && e.text === t.text) {
        items.push({ text: e.text, kind: e.kind, status: 'ok' });
        if (e.kind === 'word') wordsCorrect++;
        return;
      }
      var err;
      if (o.op === 'sub' && e.kind === 'punct') {
        err = { type: 'punct', expected: e.text, got: t.text,
                hint: 'Hier gehört ein ' + punctName(e.text) + ' hin, kein ' + punctName(t.text) + '.' };
      } else if (o.op === 'sub' && lower(e.text) === lower(t.text)) {
        var big = e.text[0] !== lower(e.text[0]);
        err = { type: 'capital', expected: e.text, got: t.text,
                hint: '„' + e.text + '“ schreibt man ' + (big ? 'groß.' : 'klein.'), letters: charDiff(e.text, t.text) };
      } else if (o.op === 'sub') {
        err = { type: 'spelling', expected: e.text, got: t.text,
                hint: spellingHint(e.text, t.text), letters: charDiff(e.text, t.text) };
      } else if (o.op === 'join') {
        var two = o.e.map(function (x) { return x.text; }).join(' ');
        err = { type: 'spacing', expected: two, got: t.text, hint: '„' + two + '“ schreibt man getrennt.' };
      } else if (o.op === 'split') {
        var twoT = o.t.map(function (x) { return x.text; }).join(' ');
        err = { type: 'spacing', expected: e.text, got: twoT, hint: '„' + e.text + '“ schreibt man zusammen.' };
      } else if (o.op === 'del' && e.kind === 'word') {
        err = { type: 'missing', expected: e.text, got: '', hint: 'Das Wort „' + e.text + '“ fehlt noch.' };
      } else if (o.op === 'del') {
        err = { type: 'punct', expected: e.text, got: '',
                hint: isLastPunct(idx) && /[.?!]/.test(e.text) ? 'Am Satzende fehlt ' + (e.text === '.' ? 'der Punkt.' : 'das ' + punctName(e.text) + '.')
                                                            : 'Hier fehlt ein ' + punctName(e.text) + '.' };
      } else if (o.op === 'ins' && t.kind === 'word') {
        err = { type: 'extra', expected: '', got: t.text, hint: '„' + t.text + '“ gehört nicht in diesen Satz.' };
      } else {
        err = { type: 'punct', expected: '', got: t.text, hint: 'Hier kommt kein ' + punctName(t.text) + ' hin.' };
      }
      err.id = 'e' + errors.length;
      errors.push(err);
      if (o.op === 'ins') {
        items.push({ text: t.text, kind: t.kind, status: 'extra', errorId: err.id });
      } else if (o.op === 'join') {
        o.e.forEach(function (x) { items.push({ text: x.text, kind: 'word', status: 'spacing', errorId: err.id }); });
      } else {
        items.push({ text: e.text, kind: e.kind, status: o.op === 'del' ? 'missing' : err.type,
                     errorId: err.id, letters: err.letters });
      }
    });

    return {
      target: normalise(target),
      typed: normalise(typed),
      perfect: errors.length === 0,
      items: items,
      errors: errors,
      stats: {
        wordsTotal: wordsTotal,
        wordsCorrect: wordsCorrect,
        spelling: count(errors, 'spelling') + count(errors, 'spacing'),
        capital: count(errors, 'capital'),
        punct: count(errors, 'punct'),
        missing: count(errors, 'missing'),
        extra: count(errors, 'extra')
      }
    };
  }

  function count(arr, type) { return arr.filter(function (x) { return x.type === type; }).length; }

  // Which errors does the child actively retype? Words only — retyping a comma
  // is busywork; punctuation is acknowledged instead.
  function correctionTargets(result) {
    return result.errors.filter(function (e) {
      return e.type === 'spelling' || e.type === 'capital' || e.type === 'missing' || e.type === 'spacing';
    });
  }

  // Exact match needed for a correction (after whitespace normalisation).
  function isCorrectRetype(expected, typed) {
    return normalise(expected) === normalise(typed);
  }

  // Words of a sentence (for statistics / spaced repetition).
  function words(sentence) {
    return tokenize(sentence).filter(function (x) { return x.kind === 'word'; }).map(function (x) { return x.text; });
  }

  var api = { compareSentence: compareSentence, correctionTargets: correctionTargets,
              isCorrectRetype: isCorrectRetype, tokenize: tokenize, normalise: normalise,
              charDiff: charDiff, words: words, lev: lev };
  root.DT = root.DT || {};
  root.DT.compare = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
