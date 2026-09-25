/*
 * sentences.js — built-in practice sentences (Klasse 5/6).
 * Same cast of characters as the worksheets (Lukas, Mia, Tim, Frau Berger,
 * Herr Weber, Oma, Opa). Tags group sentences by spelling topic so the parent
 * area can later select topics. Parent-added sentences live in the store,
 * not here.
 */
(function (root) {
  'use strict';
  var S = [
    // Großschreibung – Nominalisierung (Signalwörter)
    ['Beim Laufen bekomme ich immer Seitenstiche.', 'gross'],
    ['Zum Lesen setzt sich Mia auf das Sofa.', 'gross'],
    ['Tim hat heute etwas Lustiges erlebt.', 'gross'],
    ['Das Schwimmen im See macht allen Spaß.', 'gross ss'],
    ['Oma wünscht uns alles Gute zum Geburtstag.', 'gross'],
    ['Nach dem Essen spielen wir draußen Fußball.', 'gross ss'],
    ['Frau Berger erzählt uns etwas Spannendes.', 'gross doppel'],
    ['Im Dunkeln sieht man die Sterne besonders gut.', 'gross ie'],
    ['Lukas hat beim Radfahren viel Ausdauer.', 'gross'],
    ['Das Beste am Wochenende ist das Ausschlafen.', 'gross'],

    // Doppelte Mitlaute, ck, tz
    ['Der kleine Hund läuft schnell nach Hause.', 'doppel äu'],
    ['Plötzlich klingelt es an der Tür.', 'tz doppel'],
    ['Mia packt ihren Rucksack für den Ausflug.', 'ck'],
    ['Der Wind ist heute sehr kalt und nass.', 'doppel ss'],
    ['Tim sitzt auf der Mauer und isst einen Apfel.', 'tz ss doppel'],
    ['Opa backt am Sonntag einen Kuchen.', 'ck'],
    ['Die Katze springt auf den warmen Platz am Fenster.', 'tz'],
    ['Herr Weber kommt immer pünktlich zur Stunde.', 'doppel ck'],
    ['Wir sammeln bunte Blätter im Wald.', 'doppel ä'],
    ['Mein Bruder schwimmt schneller als ich.', 'doppel'],

    // ie, Dehnungs-h
    ['Mia spielt gern Klavier.', 'ie'],
    ['Wir fahren mit dem Fahrrad zur Schule.', 'dehnung'],
    ['Die Ziege frisst frisches Gras.', 'ie ss'],
    ['Opa erzählt eine Geschichte von früher.', 'dehnung ä'],
    ['Lukas zieht seine Schuhe an.', 'ie dehnung'],
    ['Im Sommer fliegen viele Bienen über die Wiese.', 'ie'],
    ['Nach der Stunde gehen wir nach Hause.', 'dehnung'],
    ['Tim wohnt in einem hohen Haus.', 'dehnung'],
    ['Die Kinder dürfen heute länger spielen.', 'ie ä'],
    ['Ich nehme mir ein Stück Brot.', 'dehnung ck'],

    // ß / ss, das / dass
    ['Die Straße ist nass vom Regen.', 'ss'],
    ['Ich weiß, dass du das kannst.', 'dass komma ss'],
    ['Mia hofft, dass morgen die Sonne scheint.', 'dass komma'],
    ['Der große Hund heißt Bello.', 'ss'],
    ['Wir essen heute Abend Spaghetti.', 'ss gross'],
    ['Das Buch, das auf dem Tisch liegt, gehört Tim.', 'dass komma'],
    ['Frau Berger sagt, dass wir leise sein sollen.', 'dass komma'],

    // ä / äu, V
    ['Die Mäuse laufen durch den Keller.', 'äu doppel'],
    ['Im Herbst fallen die Blätter von den Bäumen.', 'äu ä doppel'],
    ['Der Vogel sitzt auf dem Ast.', 'v tz'],
    ['Vielleicht regnet es morgen.', 'v ie'],
    ['Oma hat nämlich heute Geburtstag.', 'ä dehnung'],
    ['Lukas trägt seine Jacke.', 'ä ck'],
    ['Wir verstecken uns hinter den Bäumen.', 'v ck äu'],

    // Kommas, Fragen, wörtliche Rede
    ['Kommst du morgen mit ins Schwimmbad?', 'doppel'],
    ['Mia ruft: „Komm schnell!“', 'rede doppel'],
    ['Wenn es regnet, bleiben wir zu Hause.', 'komma'],
    ['Tim fragt: „Hast du meinen Ball gesehen?“', 'rede'],
    ['Wir kaufen Äpfel, Birnen und Bananen.', 'komma ä'],
    ['Weil es so kalt war, zog Lukas eine Mütze auf.', 'komma ü']
  ];

  root.DT = root.DT || {};
  root.DT.builtinSentences = S.map(function (s, i) {
    return { id: 'b' + (i + 1), text: s[0], tags: s[1].split(' '), source: 'builtin' };
  });
})(typeof window !== 'undefined' ? window : globalThis);
