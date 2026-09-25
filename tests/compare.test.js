// Run with:  node tests/compare.test.js
const C = require('../js/compare.js');
let fail = 0, pass = 0;
function check(name, cond, extra) {
  if (cond) pass++; else { fail++; console.log('FAIL:', name, extra !== undefined ? JSON.stringify(extra, null, 1) : ''); }
}
function types(r) { return r.errors.map(e => e.type + ':' + (e.expected || '') + '/' + (e.got || '')); }

let r;

// The example from the brief
r = C.compareSentence('Der kleine Hund läuft schnell nach Hause.', 'Der kleine hund läuft schnel nach Hause');
check('brief example', JSON.stringify(types(r)) === JSON.stringify(['capital:Hund/hund', 'spelling:schnell/schnel', 'punct:./']), types(r));
check('brief hint ll', /ll/.test(r.errors[1].hint), r.errors[1].hint);
check('brief end punct hint', /Satzende/.test(r.errors[2].hint), r.errors[2].hint);
check('brief stats', r.stats.wordsCorrect === 5 && r.stats.wordsTotal === 7, r.stats);

// Perfect, with quote/space normalisation
r = C.compareSentence('Mia ruft: „Komm schnell!“', 'Mia  ruft: "Komm schnell!"');
check('quotes normalised', r.perfect, types(r));

// Missing & extra words
r = C.compareSentence('Wir fahren morgen mit dem Fahrrad.', 'Wir fahren mit dem dem Fahrrad.');
check('missing + extra', types(r).includes('missing:morgen/') && types(r).includes('extra:/dem'), types(r));

// Very different word → missing + extra rather than misspelling? (still sensible either way)
r = C.compareSentence('Der Hund bellt.', 'Der Elefant bellt.');
check('different word flagged', !r.perfect && r.errors.length >= 1, types(r));

// Join / split
r = C.compareSentence('Ich gehe nach Hause.', 'Ich gehe nachhause.');
check('join', types(r)[0] === 'spacing:nach Hause/nachhause', types(r));
r = C.compareSentence('Mein Fahrrad ist rot.', 'Mein Fahr rad ist rot.');
check('split', types(r)[0] === 'spacing:Fahrrad/Fahr rad', types(r));

// Spelling hints
const hint = (a, b) => C.compareSentence(a, b).errors[0].hint;
check('ie hint', /ie/.test(hint('Er spielt.', 'Er spilt.')));
check('dehnungs-h', /Dehnungs-h/.test(hint('Wir fahren.', 'Wir faren.')));
check('ß hint', /ß/.test(hint('Die Straße ist lang.', 'Die Strasse ist lang.')));
check('ck hint', /ck/.test(hint('Der Zucker.', 'Der Zuker.')));
check('ä hint', /ä/.test(hint('Die Männer.', 'Die Menner.')));
check('plötzlich spelling', C.compareSentence('Plötzlich regnet es.', 'Plözlich regnet es.').errors[0].type === 'spelling');

// Nominalised verb (capital)
r = C.compareSentence('Beim Laufen bin ich schnell.', 'Beim laufen bin ich schnell.');
check('nominalised verb', types(r)[0] === 'capital:Laufen/laufen' && /groß/.test(r.errors[0].hint), types(r));
r = C.compareSentence('Wir laufen schnell.', 'Wir Laufen schnell.');
check('wrongly capital', /klein/.test(r.errors[0].hint), r.errors[0].hint);

// Comma
r = C.compareSentence('Ich glaube, dass es regnet.', 'Ich glaube das es regnet.');
check('comma + das/dass', types(r).includes('punct:,/') && types(r).includes('spelling:dass/das'), types(r));

// Wrong punctuation
r = C.compareSentence('Kommst du mit?', 'Kommst du mit.');
check('wrong punct', types(r)[0] === 'punct:?/.', types(r));

// Char diff highlights
const cd = C.charDiff('schnell', 'schnel').map(x => x.mark).join(',');
check('char diff marks one letter', cd.split(',').filter(x => x !== 'ok').length === 1, cd);

// Empty answer
r = C.compareSentence('Der Hund bellt.', '');
check('empty answer', r.errors.length === 4, types(r));

// Retype check
check('retype exact', C.isCorrectRetype('Hund', ' Hund '));
check('retype case sensitive', !C.isCorrectRetype('Hund', 'hund'));

// Umlaut in NFD form (some keyboards)
r = C.compareSentence('Er läuft.', 'Er läuft.');
check('NFD umlaut', r.perfect, types(r));

console.log(`${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
