# Lukas' Diktat-Trainer

A small web app for practising German dictation in short sessions. Every sentence goes through the same loop:

**HEAR → WRITE → CHECK → UNDERSTAND → CORRECT → REWARD → NEXT**

## Running it

- **On the Mac:** double-click `index.html`. Safari or Chrome both work, and nothing needs installing.
- **As an app with its own icon:** host the folder on GitHub Pages (see below). Then use *Safari → File → Add to Dock*, or Chrome's install icon in the address bar.
- **Tests:** `node tests/compare.test.js` runs the comparison engine tests. `python3 tests/e2e_test.py` does a full practice session in headless Chromium.
- **Single-file version:** `python3 build.py` writes `dist/diktat-trainer-einzeldatei.html`.

## Getting the best German voice on the Mac

Go to *System Settings → Accessibility → Spoken Content → System Voice → Manage Voices… → German*. Download **Anna (Premium)** or **Petra (Premium)**. Then choose it in the app under *Einstellungen → Stimme*. The Premium voices sound much more natural than the default ones and work offline.

## Architecture (Version 1)

The app is plain HTML, CSS and JavaScript, with no framework and no build step. The scripts load as classic `<script>` tags rather than ES modules, so `index.html` also runs straight from `file://`.

| File | Job |
|---|---|
| `js/compare.js` | Deterministic checking (no LLM). A weighted word-level alignment pairs each misspelled word with its target, and a letter-level diff marks the exact letters. Error types: spelling, capital letters, missing word, extra word, punctuation, and joined/split words. Hints for typical patterns: double consonants, ck/tz, ie, Dehnungs-h, ß/ss, ä/äu, V. |
| `js/speech.js` | Web Speech API. Ranks the German voices on the device (Premium/Natural first); a parent can override the choice. |
| `js/store.js` | All persistence goes through here, in one JSON document per learner. The adapter is localStorage for now and can later be replaced by a cloud adapter. History is append-only with unique ids, so devices can later be merged by id. |
| `js/practice.js` | Session building, Leitner spaced repetition for problem words, coin rules and the streak. |
| `js/sentences.js` | 50 built-in sentences for Klasse 5/6, tagged by spelling topic. |
| `js/app.js` | Screens and the learning loop. |
| `sw.js`, `manifest.webmanifest` | PWA: installable and works offline once served over HTTPS. |

### Data model

```
Sentence  {id, text, tags[], source}
Attempt   {id, sessionId, sentenceId, ts, text, typed, plays, errors[{type,expected,got}], perfect, stats, corrected}
Session   {id, startedAt, endedAt, sentenceIds, coins, accuracy}
CoinEntry {id, ts, amount, reason, sessionId}      balance = sum of entries (never stored)
WordStat  word → {seen, wrong, box 1–5, due, lastWrong}
Settings  {sessionLength, fontScale, spacing, font, voiceName, rate, slowRate, coinValues{…}}
Reward    {id, title, cost, redeemed[]}            (milestone 2)
```

### Correction design

- The correct word is **always visible** while he retypes it, so he copies the right spelling and never guesses.
- If a retype is still wrong, the app marks the letters to look at again and he copies it once more.
- A word is accepted as soon as it matches; he doesn't need to press Enter.
- Punctuation and extra words are explained. He doesn't retype them.
- **When a sentence has many problems** (more than 4 words to fix, or under half the words right), he gets one calm step instead of a long list: copy the whole marked sentence once.
- *Später verbessern* is always available as a way out.

### Coins (never taken away; values live in `settings.coinValues`)

| | Coins |
|---|---|
| Sentence finished | +2 |
| Sentence right first time | +3 |
| Each word corrected (max 3 per sentence) / whole sentence copied | +1 / +3 |
| A former problem word now spelled right | +1 each |
| Session finished | +5 |
| Better than own average of the last 5 sessions | +3 |
| First session of the day while on a streak | +2 |

A perfect sentence earns about as much as a fully corrected one. That way, making mistakes on purpose doesn't pay more.

### Spaced repetition

A misspelled word goes into box 1 and is due immediately. Each time he later spells it right while it is due, it moves up a box: next due after 1, 2, 4, 8 and then 16 days. Up to half of each session is filled with sentences that contain due problem words.

## Privacy

Everything stays in the browser on this device. There is no analytics, no tracking, no accounts, and no third-party requests (the fonts are bundled). The only exception is if you pick an online voice such as "Google Deutsch". **Backup:** *Einstellungen → Daten → Sicherung herunterladen*.

## Roadmap

- **Milestone 2:** parent area behind a PIN; own sentences, pasted texts split into sentences, Lernwörter lists; reward shop (save-toward goal, redeem by parent); progress statistics.
- **Later:** optional cloud sync; recorded audio; LLM-generated practice sentences for problem words.
