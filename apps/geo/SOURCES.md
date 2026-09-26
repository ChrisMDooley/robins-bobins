# Sources and licences — Deutschland & Hessen

## Landeswappen (`wappen/*.svg`)

Unmodified original SVG files from Wikimedia Commons, byte-identical to the Commons originals
(SHA-1 checked on 26 Sept 2026). They are the versions used in the German Wikipedia infobox of each Land
(Berlin and Hamburg: the Commons redirects from "Coat of arms of Berlin/Hamburg").

Licence status on Commons: **public domain** — official works (amtliche Werke, §5 UrhG). Note: coats of arms
are also *Hoheitszeichen*; their use is restricted by state law (e.g. no use that suggests an official
publication). Showing them in a private learning app for a child is ordinary educational use.

| Land | File | Commons page | SHA-1 |
|---|---|---|---|
| Baden-Württemberg | `wappen/bw.svg` | [Greater coat of arms of Baden-Württemberg.svg](https://commons.wikimedia.org/wiki/File:Greater_coat_of_arms_of_Baden-W%C3%BCrttemberg.svg) | `17c88aada4c702477732f3b13b0994ec4587b54e` |
| Bayern | `wappen/by.svg` | [Coat of arms of Bavaria.svg](https://commons.wikimedia.org/wiki/File:Coat_of_arms_of_Bavaria.svg) | `945231b8cfdcb42097173a9b8d84993d210d7f31` |
| Berlin | `wappen/be.svg` | [DEU Berlin COA.svg](https://commons.wikimedia.org/wiki/File:DEU_Berlin_COA.svg) | `38779b8ad69fcb9d4cfac6e39b058244511e5eee` |
| Brandenburg | `wappen/bb.svg` | [DEU Brandenburg COA.svg](https://commons.wikimedia.org/wiki/File:DEU_Brandenburg_COA.svg) | `fead9d12edf9c7f618084387bb26e2833cc4463c` |
| Bremen | `wappen/hb.svg` | [Bremen greater coat of arms.svg](https://commons.wikimedia.org/wiki/File:Bremen_greater_coat_of_arms.svg) | `83d448b4f64d6de540e28e0f6d31205ea7268fc4` |
| Hamburg | `wappen/hh.svg` | [DEU Hamburg COA.svg](https://commons.wikimedia.org/wiki/File:DEU_Hamburg_COA.svg) | `fbd3c6b8003e46283720daf5c3c7264ecff38107` |
| Hessen | `wappen/he.svg` | [Coat of arms of Hesse.svg](https://commons.wikimedia.org/wiki/File:Coat_of_arms_of_Hesse.svg) | `de78cf38835739fa3213899b215597607fe3d6e4` |
| Mecklenburg-Vorpommern | `wappen/mv.svg` | [Coat of arms of Mecklenburg-Western Pomerania (great).svg](https://commons.wikimedia.org/wiki/File:Coat_of_arms_of_Mecklenburg-Western_Pomerania_(great).svg) | `9f3c5bd8cbc8bba1ae3dadfbb77b083da97dc3b0` |
| Niedersachsen | `wappen/ni.svg` | [Wappen von Niedersachsen.svg](https://commons.wikimedia.org/wiki/File:Wappen_von_Niedersachsen.svg) | `da97cb6cf27bf708810fdb94b1f679825d1692ac` |
| Nordrhein-Westfalen | `wappen/nw.svg` | [Coat of arms of North Rhine-Westphalia.svg](https://commons.wikimedia.org/wiki/File:Coat_of_arms_of_North_Rhine-Westphalia.svg) | `4881134355074d405851b9ef86b923ab1aae44d5` |
| Rheinland-Pfalz | `wappen/rp.svg` | [Coat of arms of Rhineland-Palatinate.svg](https://commons.wikimedia.org/wiki/File:Coat_of_arms_of_Rhineland-Palatinate.svg) | `ab7ddac18394b55bd6710fac8f9f4b6b8365c10a` |
| Saarland | `wappen/sl.svg` | [Wappen des Saarlands.svg](https://commons.wikimedia.org/wiki/File:Wappen_des_Saarlands.svg) | `ca3057770d2e1363f0c735e537be811ac53d7dd8` |
| Sachsen | `wappen/sn.svg` | [Coat of arms of Saxony.svg](https://commons.wikimedia.org/wiki/File:Coat_of_arms_of_Saxony.svg) | `c04ae23291bbfed7bd4b6c7204f4cda5f4f7a8b7` |
| Sachsen-Anhalt | `wappen/st.svg` | [Wappen Sachsen-Anhalt.svg](https://commons.wikimedia.org/wiki/File:Wappen_Sachsen-Anhalt.svg) | `3048c9d46f3d7d26595975beea2f29e7a954bb8a` |
| Schleswig-Holstein | `wappen/sh.svg` | [DEU Schleswig-Holstein COA.svg](https://commons.wikimedia.org/wiki/File:DEU_Schleswig-Holstein_COA.svg) | `0af5e1cb97a28d01c4d2bfc939208db6e2435a17` |
| Thüringen | `wappen/th.svg` | [Coat of arms of Thuringia.svg](https://commons.wikimedia.org/wiki/File:Coat_of_arms_of_Thuringia.svg) | `8bce07c0eb3a06ef095e701c233a0173521bf4b7` |

## Maps (`data/maps.js`, built by `tools/build_maps.py` from `tools/raw/`)

- **States of Germany**, **countries of Europe**: [Natural Earth](https://www.naturalearthdata.com/) 1:10m admin-1 and 1:50m admin-0 — public domain.
- **Hessen border, rivers, the six Mittelgebirge areas, town positions**: © [OpenStreetMap](https://www.openstreetmap.org/copyright) contributors, licensed under the [ODbL](https://opendatacommons.org/licenses/odbl/). Fetched via the Overpass API on 26 Sept 2026:
  - Hessen: relation 62650 · Taunus: relation 3342122 (Q158884) · Westerwald: relation 3273435 (Q640966) · Rhön: way 571378856 (Q148988) ·
    Spessart: relation 6308866 (Q182470) · Odenwald: relation 7579947 (Q8359) · Vogelsberg: relation 8743914 (Q317074)
  - Rivers: all `waterway=river` ways named Rhein, Main, Lahn, Fulda, Werra, Eder, Nidda, Nidder, Kinzig, Weser in and around Hessen
  - Towns: OSM `place` nodes (e.g. Wehrheim node 38902689, Kassel node 1583294719)
  The shapes are simplified for a child-friendly map (Hessen border ~200 m, rivers ~250 m, mountain areas ~600 m tolerance).
  Mittelgebirge borders are not sharp in nature; the OSM region outlines are one reasonable delimitation.

## How the content is checked

`python3 tools/build_maps.py` refuses to build if the educational data disagrees with the geometry:
every capital lies in its state; every town marked as in Hessen lies in Hessen; every "river flows through town"
fact is within 2.5 km of that river (Wiesbaden–Rhein: 6 km, the city centre is inland); every "flows into"
river really meets its river (Nidder→Nidda→Main→Rhein, Eder→Fulda, Kinzig→Main, Lahn→Rhein, Fulda+Werra→Weser);
Wehrheim lies inside the Taunus outline; the 9 neighbours touch Germany and the distractor countries do not;
Hessen's area comes out at ≈21,100 km².

Directions in questions ("… liegt südöstlich von Wehrheim") are computed from coordinates at run time and only
asked when unambiguous (main directions within ±30°, in-between directions within ±12°; wrong options must be
more than 60° away). `tests/logic.test.js` checks this for every generated question.
