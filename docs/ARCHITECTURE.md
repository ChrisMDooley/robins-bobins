# Robin's Bobins — architecture (Milestone 1)

**One family space → three children → many small learning tools.**
The platform takes care of identity, navigation, motivation and shared rewards. Each app teaches one thing well.

---

## 1. Diktat Trainer as it was

A small, well-structured vanilla-JS PWA (≈1,300 lines of JS, no framework, no build step). Scripts are classic `<script>` tags so it also runs from `file://`.

| Layer | File | Notes |
|---|---|---|
| Checking engine | `js/compare.js` | Deterministic word alignment + letter diff, German spelling hints. Pure, unit-tested. |
| Content | `js/sentences.js` | 50 tagged Klasse-5/6 sentences. |
| Speech | `js/speech.js` | Web Speech API voice ranking. |
| Learning logic | `js/practice.js` | Session building, Leitner boxes for problem words, coin rules, streak. No DOM. |
| Persistence | `js/store.js` | One JSON doc per learner at `diktat-trainer:<id>`, adapter pattern, append-only ledgers with ids, balance derived. Already sync-ready. |
| UI / loop | `js/app.js` + `index.html` | Four screens (home, practice, summary, parent settings). Profile hard-wired to `'lukas'`. |
| PWA | `sw.js`, `manifest.webmanifest` | Network-first offline cache. |

It was already built the way a platform app should be: logic separated from DOM, storage behind an adapter, append-only records. The only hard-wired assumptions were **"the learner is Lukas"** and **"coins live in this app"**.

## 2. What stays app-specific (Diktat)

Everything educational: the checking engine, sentences, speech, Leitner word stats, the practice loop and its screens, Diktat's own coin *rules* (what earns how much), voice/font/session-length settings, its attempt history. None of that moved or changed.

## 3. What moves into shared infrastructure

| Concern | Before | Now |
|---|---|---|
| Who is practising | hard-coded `'lukas'` | `RB.requireChild()` (URL `?child=`) |
| Coin balance | Diktat ledger | **one platform ledger per child**; Diktat's entries copied in by id |
| Streak / "today" | Diktat sessions | platform activity log (all apps) |
| Way home | none | "‹ Meine Apps" → child home |
| Backup | Diktat only | platform backup covers platform + every app's data |
| Offline cache | Diktat SW | one platform SW for everything |
| Parent PIN, rewards, per-child apps | planned in Diktat M2 | platform Parent Mode (PIN + app toggles now, shop later) |

Later candidates: Diktat's font/dyslexia settings could become per-child platform display preferences; its reward-shop plan becomes Robin's Shop.

## 4. Architecture

```
┌──────────────────────────── one static site (GitHub Pages / any web server / file://) ─────────────────────────────┐
│                                                                                                                     │
│  index.html + platform/app.js      ← the shell: Wer bist du? · child home · Elternbereich                            │
│        │   links to  apps/<id>/index.html?child=<id>                                                                │
│        ▼                                                                                                            │
│  apps/diktat/   apps/<next>/   …   ← independent pages; each loads ../../shared/rb.js                               │
│        │                                                                                                            │
│        ▼                                                                                                            │
│  shared/rb.js  (SDK)   shared/robin.js (mascot)   shared/rb-theme.css (look)                                        │
│        │                                                                                                            │
│        ▼                                                                                                            │
│  localStorage (same origin) ── rb:platform · rb:child:<id> · <app-prefix><id>     ← later: a sync adapter           │
└─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┘
```

Key choices, and why:

- **Apps are separate pages, not modules inside one bundle.** An app is a folder with its own `index.html`, JS and CSS. It can use any approach internally. The platform only *links* to it. That is the loosest coupling there is, and it is why Diktat needed almost no changes.
- **The contract is one small SDK file** (`shared/rb.js`, classic script, no build). An app that loads it gets child identity, the coin bank, activity hooks, navigation URLs and backup participation. An app that doesn't load it still runs standalone.
- **Same origin = shared storage for free.** All apps live under one site, so they read and write the same `localStorage`. No messaging, no iframes, no server.
- **Full-page navigation instead of iframes.** Simpler, works with every browser, keeps each app's layout and keyboard handling intact, and the back button behaves normally.
- **Apps may only *earn* coins.** `RB.coins.add` rejects zero/negative earnings. Spending (shop) and corrections are separate record kinds reserved for Parent Mode. Mistakes can't cost coins because there is no API for it.
- **Bridges are optional.** Diktat already had its own ledger, so `apps/diktat/js/rb-bridge.js` copies it into the platform (idempotent, by id). New apps call `RB.coins.add` directly and need no bridge.

## 5. Folder structure

```
robins-bobins/
├─ index.html              platform shell page
├─ manifest.webmanifest    installable "Robin's Bobins" app
├─ sw.js                   offline cache for platform + all apps
├─ icons/                  Robin app icons
├─ platform/app.js         picker, child home, parent area (router on #/…)
├─ shared/
│  ├─ rb.js                the SDK every app can use
│  ├─ robin.js             Robin's poses + greeting lines
│  ├─ rb-theme.css         tokens and components (optional for apps)
│  └─ fonts/               Atkinson Hyperlegible (bundled, no third-party requests)
├─ apps/
│  ├─ registry.js          the list of apps (one entry per app)
│  ├─ diktat/              Diktat Trainer — imported with git subtree, history kept
│  │  └─ js/rb-bridge.js   hands Diktat coins/sessions to the platform
│  └─ _template/           copy this to start a new app
├─ docs/                   this file, NEW-APP.md
└─ tests/platform_e2e.py   whole-flow browser test
```

One repository, many independent folders: easy to deploy and back up as one site, while each app stays self-contained. Diktat's own tests still run inside its folder.

## 6. How Diktat is integrated

Diktat was imported with `git subtree add` (its commit history is preserved under `apps/diktat/`). Changes made to it:

1. `index.html`: loads `../../shared/rb.js` and `js/rb-bridge.js`; adds a hidden "‹ Meine Apps" link.
2. `js/app.js`: if the SDK is present, takes the child from the platform (instead of `'lukas'`), shows the platform balance, calls the bridge after each coin award and at session end, shows the back link, skips its own service worker, and rewords the reset warning ("Robin-Münzen bleiben erhalten").
3. `styles.css`: two lines for the back link. `build.py`: leaves platform scripts out of the single-file build.

**Without the SDK** (old repo, single-file build, opened on its own) Diktat behaves exactly as before. With it, the store key stays `diktat-trainer:<child>`, so Lukas's existing data is used as-is, and a second child simply gets `diktat-trainer:alex`.

## 7. Shared data model

Platform data (owned by `rb.js`):

```
rb:platform
  Family      {schema, deviceId, createdAt, children[], parent{pinHash}, rewards[], settings{}}
  Child       {id, name, color, ui:'standard'|'simple', apps:[appId…]}           ← which apps a child sees
  Reward      {id, title, cost, childIds|null, active}                            ← milestone 3 (Robin's Shop)

rb:child:<id>            one document per child — progress can't get mixed up
  CoinTransaction  {id, ts, amount, kind:'earn'|'redeem'|'adjust', reason, app, ref, deviceId}
  Activity         {id, app, kind:'session', startedAt, endedAt, summary{…small app-defined numbers}}
  RewardRedemption {id, rewardId, cost, requestedAt, approvedAt, approvedBy}      ← milestone 3

App (registry, in code) {id, title, subject, icon, color, path, storagePrefix, bridge?, hidden?}
```

App-specific learning data (owned by each app, never interpreted by the platform):

```
diktat-trainer:<child>   attempts, sessions, wordStats (Leitner), sentences, settings   ← unchanged
<prefix><child>          e.g. a future Mathe app: skills, problem categories, error patterns
```

Rules that keep later sync simple: every record has a globally unique id and a timestamp; ledgers are append-only; balances and streaks are derived, never stored; merging two devices is "union by id" (`RB.coins.merge`, `RB.activity.merge`). A sync adapter would replace the storage adapter's `read/write/keys` and add a merge step — no app changes.

The streak counts a day when *any* app recorded an activity. Coin *rules* stay per app (each app knows what effort looks like in its subject); values can be tuned per app.

## 8. Screens and flow

```
 Open app ─▶ Wer bist du?  [Lukas] [Alex] [Liliana]            (Eltern ─▶ PIN ─▶ Elternbereich)
                 │
                 ▼
            Hallo Lukas!   🔥 streak · 🪙 coins · ⭐ today   Robin: "Los geht's, Lukas!"
            Meine Apps: [🔊 Diktat Trainer]  […]
                 │                        ▲
                 ▼                        │ ‹ Meine Apps
            Diktat Trainer (?child=lukas) ─┘
                 hear → write → check → understand → correct → reward → next
```

- A fresh launch always asks **Wer bist du?** (no silent default child). "‹ Wechseln" returns there from any home.
- An app opened without a child is sent to the picker.
- Liliana's profile has `ui:'simple'`: bigger icons and tiles, fewer words. Same pages, different presentation.
- Robin says one short line on the home screen depending on the moment (start, returned after 3+ days, practised today, streak). He never interrupts inside an app.

## 9. Adding the next app

See `docs/NEW-APP.md`. In short: copy `apps/_template`, add one entry to `apps/registry.js`, add its files to `sw.js`, tick it for a child in Elternbereich.

## 10. Decisions for Chris

Milestone 1 is built with the defaults below; none of them block anything, but they are yours to make.

1. **Repository.** Default: new repo `robins-bobins` with Diktat inside (history kept). The old `diktat-trainer` repo can be archived once Lukas has moved over, or kept in sync with `git subtree push`.
2. **Names in public code.** On a public GitHub Pages site, the children's first names are visible in `shared/rb.js` (the default profiles) and in the sentences. No practice data is ever uploaded. Options: accept it, use a private repo (GitHub Pages from private repos needs a paid plan), or move names into a first-run setup screen.
3. **Moving Lukas's existing data.** Same site origin → automatic. But a Safari *Add to Dock* web app has its own storage, separate from Safari. If Lukas uses the Dock app: *Einstellungen → Sicherung kopieren* in the old app, then *Wiederherstellen* in Diktat inside Robin's Bobins. The coins then appear on his platform balance.
4. **Which apps for whom.** Default: Diktat only for Lukas. The sentences are Klasse 5/6 level, so probably not yet for Alex; switch it on in Elternbereich if you want.
5. **Robin's look.** The placeholder is a fawn whippet with a coral collar and a coin tag. Tell me Robin's real colour and markings (or share a photo) and I can match him, or swap in images via `RB.robin.images`.
6. **Coin economy.** A 10-sentence Diktat round currently earns about 55–60 coins (≈5 per sentence whether perfect or corrected, plus round bonuses). Before Robin's Shop, decide rough prices so rewards feel reachable but not instant (e.g. 15 min screen time ≈ 2–3 rounds), and whether other apps earn at a similar rate.
7. **Sync later.** When multi-device matters, the choices are roughly: a tiny self-hosted endpoint, a shared file in a cloud drive, or a hosted database. The data model supports any of them; no decision needed yet.
