/*
 * sentences.js — built-in practice sentences (Klasse 5/6), grouped in SECTIONS
 * that Lukas can choose on the home screen.
 *
 *   rechtschreibung  the original 50 spelling sentences (same cast as the worksheets:
 *                    Lukas, Mia, Tim, Frau Berger, Herr Weber, Oma, Opa). Ids b1…b50, never renumber.
 *   zeit, steinzeit, bronzezeit
 *                    Geschichte, Klasse 6 — written for dictation practice from the topics of his
 *                    history book ("Erste Begegnung mit Geschichte", "Wie messen Menschen die Zeit?",
 *                    "Leben in der Frühzeit", Himmelsscheibe von Nebra). Own wording, not book text.
 *                    Ids <section>-<n>, stable — add new sentences at the END of a section.
 *
 * Tags mark spelling topics inside a sentence (for later topic selection in the parent area).
 * Parent-added sentences live in the store (section 'eigene'), not here.
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

  // ---------- Geschichte (Klasse 6) ----------
  var HISTORY = {
    zeit: [
      ['Geschichte beginnt schon bei uns selbst und bei unserer Familie.', 'ie gross'],
      ['Auch unser Wohnort und unser Bundesland haben eine lange Geschichte.', 'dehnung'],
      ['Viele Menschen fühlen sich mit ihrer Heimat eng verbunden.', 'ie dehnung'],
      ['Ohne Quellen wüssten wir fast nichts über die Vergangenheit.', 'doppel ss'],
      ['Historikerinnen und Historiker stellen den Quellen viele Fragen.', 'doppel ie'],
      ['Die Wissenschaft von der Zeitmessung heißt Chronologie.', 'ss tz ie'],
      ['Schon sehr früh beobachteten die Menschen die Sonne, den Mond und die Sterne.', 'komma dehnung'],
      ['Nach dem Lauf der Himmelskörper stellten die Menschen die ersten Kalender auf.', 'doppel'],
      ['Unser Kalender richtet sich nach dem Sonnenjahr.', 'dehnung doppel'],
      ['Eine Sonnenuhr zeigt die Zeit nur an, wenn die Sonne scheint.', 'komma dehnung'],
      ['In einer Sanduhr rieselt der Sand langsam nach unten.', 'ie dehnung'],
      ['Mit Stonehenge konnte man den Sommeranfang und den Winteranfang bestimmen.', 'doppel gross'],
      ['Später erfanden die Menschen mechanische Uhren und Wecker.', 'ä ck dehnung'],
      ['Ein Jahrhundert dauert hundert Jahre, ein Jahrtausend dauert tausend Jahre.', 'komma dehnung']
    ],
    steinzeit: [
      ['In der Altsteinzeit lebten die Menschen als Jäger und Sammler.', 'ä doppel'],
      ['Sie zogen den Tieren hinterher und wohnten in Zelten aus Fellen.', 'ie dehnung tz doppel'],
      ['Das Feuer spendete Wärme und schützte vor wilden Tieren.', 'ä tz ie v'],
      ['Die Menschen sammelten Beeren, Nüsse und Wurzeln.', 'komma doppel ss'],
      ['Aus Feuerstein stellten sie scharfe Werkzeuge her.', 'doppel'],
      ['In der Jungsteinzeit wurden die Menschen sesshaft.', 'ss'],
      ['Sie bauten feste Häuser und gründeten die ersten Dörfer.', 'äu ö'],
      ['Die Bauern säten Getreide und hielten Ziegen, Schafe und Rinder.', 'komma ie ä'],
      ['Auf einer Getreidemühle aus Stein mahlten sie die Körner zu Mehl.', 'dehnung ü ö'],
      ['Plötzlich tauchte am Waldrand eine Gruppe fremder Jäger auf.', 'tz ä doppel'],
      ['Die Dorfbewohner unterbrachen ihre Arbeit und schauten neugierig hinüber.', 'dehnung ie'],
      ['Einer der Jäger zeigte aufgeregt auf das Feuer im Hintergrund.', 'ä gross'],
      ['Eine Rekonstruktionszeichnung zeigt, wie das Leben damals ausgesehen haben könnte.', 'komma ie'],
      ['Forscher finden die Spuren der Steinzeit oft tief in der Erde.', 'ie']
    ],
    bronzezeit: [
      ['Nach der Steinzeit folgten die Bronzezeit und danach die Eisenzeit.', 'dehnung'],
      ['Bronze ist eine Mischung aus Kupfer und Zinn.', 'doppel'],
      ['Aus Bronze fertigten die Menschen Schwerter, Beile und Meißel.', 'komma ss'],
      ['Die Himmelsscheibe von Nebra stammt aus der Bronzezeit.', 'doppel ss'],
      ['Auf der Scheibe sieht man eine Mondsichel und viele goldene Sterne.', 'ie dehnung'],
      ['Die goldenen Bögen am Rand zeigen den Lauf der Sonne.', 'ö'],
      ['Eine kleine Gruppe von Sternen am Himmel heißt Plejaden.', 'ss doppel'],
      ['Nach diesem Sternbild richteten sich die Bauern bei der Aussaat.', 'ie dehnung'],
      ['Die Scheibe ist aus Bronze und wiegt ungefähr zwei Kilogramm.', 'ie ä'],
      ['Heute kann man sie im Landesmuseum in Halle bewundern.', 'doppel'],
      ['Zu dem berühmten Fund gehörten auch zwei Schwerter und zwei Beile.', 'dehnung ö'],
      ['Wer Bronze herstellen wollte, brauchte viel Wissen und Geschick.', 'komma ss ck'],
      ['Die Menschen in Mitteleuropa lernten, Metall zu schmelzen.', 'komma doppel'],
      ['In Museen erzählen alte Gegenstände viel über die Vergangenheit.', 'ä doppel']
    ]
  };

  var SECTIONS = [
    { id: 'rechtschreibung', title: 'Rechtschreibung', sub: 'Alltagssätze mit Mia, Tim & Co.', icon: '✏️' },
    { id: 'zeit', title: 'Zeit & Geschichte', sub: 'Quellen, Kalender, Sonnenuhr', icon: '⏳' },
    { id: 'steinzeit', title: 'Steinzeit', sub: 'Jäger, Sammler und die ersten Bauern', icon: '🔥' },
    { id: 'bronzezeit', title: 'Bronzezeit', sub: 'Himmelsscheibe von Nebra', icon: '🌙' }
  ];

  var list = S.map(function (s, i) {
    return { id: 'b' + (i + 1), text: s[0], tags: s[1].split(' '), source: 'builtin', section: 'rechtschreibung' };
  });
  Object.keys(HISTORY).forEach(function (sec) {
    HISTORY[sec].forEach(function (s, i) {
      list.push({ id: sec + '-' + (i + 1), text: s[0], tags: s[1].split(' '), source: 'builtin', section: sec });
    });
  });

  root.DT = root.DT || {};
  root.DT.sections = SECTIONS;
  root.DT.builtinSentences = list;
})(typeof window !== 'undefined' ? window : globalThis);
