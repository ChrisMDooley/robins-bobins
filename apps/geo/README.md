# Deutschland & Hessen (Sachunterricht, Klasse 4)

Robin's Bobins app for Alex's first Sachunterricht-Lernzielkontrolle (29 Sept 2026):
**Bundesländer und Hauptstädte · Wappen · Nachbarländer · Flüsse, Gebirge und Städte in Hessen · Kartenkunde**.

Open `apps/geo/index.html?child=alex` (or Alex's card on the Robin's Bobins home). Without the platform
SDK the page still runs, as Alex, without coins.

## What Alex can do

| Menu | What happens |
|---|---|
| **LERNEN** | Tap-to-discover maps: Germany (state → Wappen + Hauptstadt), Wappen gallery with "Namen verdecken", Europe (neighbour or not, and where), Hessen with layer switches Städte / Flüsse / Gebirge, Wehrheim as home anchor, "Wohin fließt das Wasser?", Kartenkunde (legend, tap-a-Planquadrat, compass rose). |
| **ÜBEN** | One topic at a time (10 topics, each with a mastery bar), Hessen quick modes 🏙 🌊 ⛰ 🗺 and 📍 *Zeig es auf der Karte*, games: 🔗 matching (Land↔Hauptstadt, Wappen↔Land, Wappen↔Land↔Hauptstadt) and ✋ drag names onto maps. |
| **5 MINUTEN ÜBEN** | One tap. Mixed questions for 5 minutes (or 20 questions), weighted towards his weakest topics and concepts; ends with "Super! 5 Minuten geschafft.", *x richtig / y nochmal üben* and a suggestion. |
| **PRÜFUNG ÜBEN** | 18 questions like the test (4 Deutschland, 3 Wappen, 2 Nachbarn, 5 Hessen, 4 Kartenkunde), no feedback until the end, "Du hast 16 von 18 Punkten erreicht.", strengths ✓ and weak topics → straight into practice. No grades. |
| **FORTSCHRITT** | Answers, correct answers, topics mastered, one bar per topic (rounded to 10 %, recent answers count most), what comes back soon, past mock tests. |

Mistakes never cost coins; a wrong answer shows the right one with a one-line explanation
("Fast! Die Hauptstadt von Sachsen ist Dresden. Magdeburg gehört zu Sachsen-Anhalt.") and the concept comes back
3–6 questions later and more often afterwards.

## Structure

```
apps/geo/
├─ index.html, geo.css        page + look (uses shared/rb-theme.css)
├─ data/content.js            WHAT is learnt: states, Wappen keys, countries, towns, rivers, mountains, legend, topics
├─ data/maps.js               GENERATED SVG geometry (tools/build_maps.py)
├─ js/geo.js                  helpers: random, projection, compass directions, typed-answer matching
├─ js/kartenkunde.js          random fictional maps (grid, legend symbols, compass rose)
├─ js/questions.js            topics → items → question generators   (add a quiz type here)
├─ js/adaptive.js             Leitner boxes, weights, mastery          (the learning rules)
├─ js/store.js                progress in localStorage  rb-geo:<child>
├─ js/session.js              practice / 5 Minuten / mock test rounds
├─ js/mapview.js              interactive SVG maps (ids: state-*, country-*, town-*, river-*, region-*)
├─ js/quiz.js, games.js, learn.js, ui.js, app.js     screens
├─ js/rb-bridge.js            line on the Robin's Bobins card ("Noch 3 Tage bis zur LZK")
├─ wappen/*.svg               16 Landeswappen, unmodified Commons originals — see SOURCES.md
├─ tools/build_maps.py        builds data/maps.js from tools/raw/ AND checks content.js against the geometry
└─ tests/logic.test.js        node tests (every item, every generator, directions, adaptivity, test plan)
```

Browser test for the whole flow: `python3 tests/geo_e2e.py` (from the repo root).

## Changing the content

- **Add a town / river / mountain range / state / country:** add it to `data/content.js`.
  Rivers and mountains also need an OSM name present in `tools/raw/` (re-fetch if new), then
  `python3 apps/geo/tools/build_maps.py` — it rebuilds the maps and fails loudly if a fact does not match the map.
- **Add a question type:** add a generator function to a topic's `gens` list in `js/questions.js`
  (return `null` when it does not fit an item). It is picked up by practice, 5 Minuten and — if `exam` is not `false` — the mock test.
- **Change the test date:** `testDate` in `data/content.js` and `TEST_DATE` in `js/rb-bridge.js`.

Tests: `node apps/geo/tests/logic.test.js` · `python3 apps/geo/tools/build_maps.py` · `python3 tests/geo_e2e.py`.
