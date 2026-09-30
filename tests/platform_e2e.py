"""End-to-end test of Robin's Bobins Milestone 1 in headless Chromium.

    python3 tests/platform_e2e.py [screenshot-dir]

Serves the repo on :8766, mocks speech (headless has no voices) and walks the whole
flow: picker → Lukas → Diktat Trainer → a real practice round → coins land in the
platform → back to Lukas's home. Also checks existing Diktat history is carried over,
child separation, the parent PIN, per-child apps, backup round trip and the template app.
"""
import http.server, threading, functools, os, sys, json, time
from playwright.sync_api import sync_playwright

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = sys.argv[1] if len(sys.argv) > 1 else os.path.join(ROOT, 'tests', 'shots')
os.makedirs(OUT, exist_ok=True)
class Quiet(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a): pass
handler = functools.partial(Quiet, directory=ROOT)
srv = http.server.ThreadingHTTPServer(('127.0.0.1', 8766), handler)
threading.Thread(target=srv.serve_forever, daemon=True).start()
URL = 'http://127.0.0.1:8766/'

MOCK = """
window.__spoken = [];
const fakeVoice = {name:'Anna', lang:'de-DE', localService:true, voiceURI:'Anna', default:true};
Object.defineProperty(window, 'speechSynthesis', {value: {
  getVoices: () => [fakeVoice], addEventListener(){}, onvoiceschanged: null,
  speak(u){ window.__spoken.push({text:u.text, rate:u.rate}); setTimeout(()=>u.onend && u.onend(), 30); },
  cancel(){}
}});
window.SpeechSynthesisUtterance = function(t){ this.text = t; };
"""

# Lukas already used the standalone Diktat Trainer yesterday: 14 coins, one session.
yesterday = int((time.time() - 86400) * 1000)
LEGACY = {
    'schema': 1, 'profile': {'id': 'lukas', 'name': 'Lukas'},
    'settings': {'sessionLength': 3}, 'sentences': [], 'attempts': [],
    'sessions': [{'id': 'sold1', 'startedAt': yesterday - 600000, 'endedAt': yesterday, 'sentenceIds': ['b1', 'b2'], 'coins': 14, 'accuracy': 0.8}],
    'coins': [{'id': 'cold1', 'ts': yesterday, 'amount': 9, 'reason': 'Satz geschafft'}, {'id': 'cold2', 'ts': yesterday, 'amount': 5, 'reason': 'Übung geschafft'}],
    'wordStats': {'Seitenstiche': {'seen': 1, 'wrong': 1, 'box': 1, 'due': yesterday, 'lastWrong': yesterday}}, 'rewards': []
}


# The whole site sits behind the family PIN (shared/rb.js). Tests use the stored unlock token
# (the public hash), never the PIN itself.
GATE_HASH = 'c623d5d8fdd2353ef1861b66169370d4a168aeb62f94cf63e08da88cddb06639'
UNLOCK = "try { localStorage.setItem('rb:gate', '%s'); } catch (e) {}" % GATE_HASH

errors, ok = [], []
def check(name, cond, info=''):
    (ok if cond else errors).append(name + ('' if cond else f'  → {info}'))

with sync_playwright() as p:
    b = p.chromium.launch()
    pg = b.new_page(viewport={'width': 1280, 'height': 860})
    pg.on('pageerror', lambda e: errors.append('pageerror: ' + str(e)))
    # 404s are errors, except optional files of sibling apps that are not served in this test
    pg.on('console', lambda m: m.type == 'error' and 'Failed to load resource' not in m.text and errors.append('console: ' + m.text))
    pg.on('response', lambda r: r.status >= 400 and '/europa-trainer/' not in r.url and errors.append('HTTP %d %s' % (r.status, r.url)))
    pg.add_init_script(MOCK)

    # ---------- family PIN gate (fresh browser, nothing stored) ----------
    gp = b.new_page(viewport={'width': 1280, 'height': 860})
    gp.on('pageerror', lambda e: errors.append('gate pageerror: ' + str(e)))
    for path in ('index.html', 'apps/geo/index.html?child=alex', 'apps/diktat/index.html?child=lukas'):
        gp.goto(URL + path); gp.wait_for_timeout(300)
        check('gate shown on ' + path, gp.locator('#rb-gate').is_visible())
        check('content hidden behind gate on ' + path,
              gp.evaluate("[...document.body.children].filter(e => e.id !== 'rb-gate' && e.tagName !== 'SCRIPT' && e.tagName !== 'NOSCRIPT' && getComputedStyle(e).visibility === 'visible').length") == 0)
    gp.fill('#rb-gate input', '000000'); gp.press('#rb-gate input', 'Enter'); gp.wait_for_timeout(150)
    check('wrong family PIN refused', 'stimmt nicht' in gp.inner_text('#rb-gate .msg') and gp.locator('#rb-gate').count() == 1)
    if os.environ.get('RB_TEST_PIN'):
        check('PIN not in page source', os.environ['RB_TEST_PIN'] not in gp.content())
        gp.fill('#rb-gate input', os.environ['RB_TEST_PIN']); gp.press('#rb-gate input', 'Enter'); gp.wait_for_timeout(300)
        check('right family PIN opens the app', gp.locator('#rb-gate').count() == 0 and 'Hallo Lukas' in gp.inner_text('body'))
        gp.goto(URL + 'index.html'); gp.wait_for_timeout(300)
        check('device remembered after unlock', gp.locator('#rb-gate').count() == 0)
    gp.close()
    pg.add_init_script(UNLOCK)

    pg.goto(URL + 'index.html')
    pg.evaluate(f"localStorage.clear(); localStorage.setItem('diktat-trainer:lukas', {json.dumps(json.dumps(LEGACY))})")
    pg.reload(); pg.wait_for_timeout(300)
    pg.screenshot(path=f'{OUT}/rb-1-picker.png')
    check('picker asks "Wer bist du?"', 'Wer bist du?' in pg.inner_text('body'))
    check('three children', pg.locator('.kid').count() == 3)
    check('Robin shown', pg.locator('.brand-hero .robin svg').count() == 1)
    lukas_card = pg.inner_text('.kid[data-child=lukas]')
    check('legacy Diktat coins carried over to Lukas', '14' in lukas_card, lukas_card)

    # Lukas's home
    pg.click('.kid[data-child=lukas]'); pg.wait_for_timeout(250)
    check('home greets Lukas', 'Hallo Lukas!' in pg.inner_text('h1'))
    check('Diktat card for Lukas', pg.locator('.app-card[data-app=diktat]').count() == 1)
    eu_hidden = pg.evaluate("() => !!(RB.apps.get('europa') || {}).hidden")
    if eu_hidden:
        check('Europa-Trainer card hidden until its site is live', pg.locator('.app-card[data-app=europa]').count() == 0)
    else:
        check('Europa-Trainer card for Lukas (own repo, granted once)', pg.locator('.app-card[data-app=europa]').count() == 1)
        href = pg.get_attribute('.app-card[data-app=europa]', 'href') or ''
        check('Europa card links to the sibling site with the child', href.endswith('../europa-trainer/?child=lukas'), href)
    check('card info from Diktat', 'Wort zum Wiederholen' in pg.inner_text('.app-card'), pg.inner_text('.app-card'))
    check('streak from legacy session', '1' in pg.inner_text('.stats .stat:first-child'), pg.inner_text('.stats'))
    pg.screenshot(path=f'{OUT}/rb-2-lukas-home.png')

    # Launch Diktat
    pg.click('.app-card[data-app=diktat]'); pg.wait_for_timeout(500)
    check('Diktat URL carries child', 'apps/diktat/index.html?child=lukas' in pg.url, pg.url)
    check('back-to-apps visible', pg.is_visible('#btn-apps'))
    check('Diktat shows platform balance', pg.inner_text('#home .coin-balance') == '14', pg.inner_text('#home .coin-balance'))
    check('Diktat home name', pg.inner_text('#home-name') == 'Lukas')
    pg.screenshot(path=f'{OUT}/rb-3-diktat-in-platform.png')

    # A real practice round (3 sentences, all correct first time)
    pg.click('#btn-start'); pg.wait_for_timeout(600)
    for i in range(3):
        target = pg.evaluate('window.__spoken[window.__spoken.length-1].text')
        pg.fill('#answer', target); pg.keyboard.press('Enter'); pg.wait_for_timeout(300)
        check(f'sentence {i+1} perfect', 'Alles richtig' in pg.inner_text('#fb-head'))
        pg.click('#btn-next'); pg.wait_for_timeout(700 if i < 2 else 2600)
    check('summary shown', pg.is_visible('#summary'))
    pg.wait_for_timeout(1200)
    rb_bal = pg.evaluate("RB.coins.balance('lukas')")
    dk = pg.evaluate("JSON.parse(localStorage.getItem('diktat-trainer:lukas'))")
    dk_bal = sum(c['amount'] for c in dk['coins'])
    check('platform balance == all Diktat coins', rb_bal == dk_bal and rb_bal > 14, (rb_bal, dk_bal))
    check('topbar shows platform balance', pg.inner_text('#summary .coin-balance') == str(rb_bal))
    acts = pg.evaluate("RB.activity.list('lukas')")
    check('session recorded as platform activity', len(acts) == 2, acts)
    pg.screenshot(path=f'{OUT}/rb-4-diktat-summary.png')

    # Back home
    pg.click('#btn-home'); pg.wait_for_timeout(200)
    pg.click('#btn-apps'); pg.wait_for_timeout(400)
    check('returned to Lukas home', pg.url.endswith('index.html#/c/lukas') and 'Hallo Lukas!' in pg.inner_text('h1'), pg.url)
    stats = pg.inner_text('.stats')
    check('home: coins updated', str(rb_bal) in stats, stats)
    check('home: 2-day streak', stats.startswith('🔥2') or '2 Tage' in stats.replace('\n', ' '), stats)
    check('home: 1 activity today', '1 Übung heute' in stats.replace('\n', ' '), stats)
    pg.screenshot(path=f'{OUT}/rb-5-lukas-home-after.png')

    # No child → back to the picker (never a silent default)
    pg.evaluate("sessionStorage.clear()")
    pg.goto(URL + 'apps/diktat/index.html'); pg.wait_for_timeout(500)
    check('Diktat without child → picker', pg.url.endswith('index.html#/'), pg.url)

    # Alex got his geography app once (grantTo); Liliana has no apps yet
    pg.goto(URL + 'index.html#/c/alex'); pg.wait_for_timeout(200)
    check('Alex has Deutschland & Hessen', pg.locator('.app-card[data-app=geo]').count() == 1)
    check('Alex has 0 coins', pg.evaluate("RB.coins.balance('alex')") == 0)
    pg.goto(URL + 'index.html#/c/liliana'); pg.wait_for_timeout(200)
    check('Liliana empty state', pg.locator('.empty').count() == 1)
    check('Liliana simple UI', pg.evaluate("document.documentElement.className") == 'ui-simple')
    pg.screenshot(path=f'{OUT}/rb-6-liliana-home.png')

    # Parent: set PIN, give Alex the Diktat Trainer
    pg.goto(URL + 'index.html#/eltern'); pg.wait_for_timeout(200)
    pg.fill('#pin1', '1234'); pg.fill('#pin2', '1234'); pg.click('#pin-form button'); pg.wait_for_timeout(200)
    check('parent area opens', 'Kinder und Apps' in pg.inner_text('body'))
    pg.check('input[data-child=alex][data-app=diktat]'); pg.wait_for_timeout(100)
    pg.uncheck('input[data-child=alex][data-app=geo]'); pg.wait_for_timeout(100)
    pg.reload(); pg.wait_for_timeout(200)
    check('un-ticked app stays off (grant only once)', pg.evaluate("RB.child('alex').apps.indexOf('geo')") == -1)
    pg.goto(URL + 'index.html#/eltern'); pg.wait_for_timeout(200)
    if pg.locator('#pin1').count(): pg.fill('#pin1', '1234'); pg.click('#pin-form button'); pg.wait_for_timeout(200)
    pg.check('input[data-child=alex][data-app=geo]'); pg.wait_for_timeout(100)
    pg.screenshot(path=f'{OUT}/rb-7-parent.png', full_page=True)
    exported = pg.evaluate("RB.backup.exportAll()")
    check('backup has platform, child and app data',
          all(k in exported['data'] for k in ('rb:platform', 'rb:child:lukas', 'diktat-trainer:lukas')), list(exported['data']))
    pg.click('#parent-done'); pg.wait_for_timeout(100)
    pg.goto(URL + 'index.html#/eltern'); pg.wait_for_timeout(200)
    check('parent area locks again', pg.locator('#pin1').count() == 1)
    pg.fill('#pin1', '9999'); pg.click('#pin-form button'); pg.wait_for_timeout(100)
    check('wrong PIN refused', 'nicht richtig' in pg.inner_text('#pin-msg'))

    # Alex uses Diktat: separate data, own name
    pg.goto(URL + 'index.html#/c/alex'); pg.wait_for_timeout(200)
    check('Alex now has Diktat', pg.locator('.app-card[data-app=diktat]').count() == 1)
    pg.click('.app-card[data-app=diktat]'); pg.wait_for_timeout(500)
    check('Diktat greets Alex', pg.inner_text('#home-name') == 'Alex')
    check('Alex starts at 0 coins', pg.inner_text('#home .coin-balance') == '0')
    check("Lukas's coins untouched", pg.evaluate("RB.coins.balance('lukas')") == rb_bal)

    # Backup round trip
    pg.goto(URL + 'index.html')
    pg.evaluate(f"localStorage.clear(); RB.backup.importAll({json.dumps(exported)})")
    check('restore brings coins back', pg.evaluate("RB.coins.balance('lukas')") == rb_bal)

    # Template app
    pg.goto(URL + 'apps/_template/index.html?child=liliana'); pg.wait_for_timeout(300)
    pg.click('#done'); pg.wait_for_timeout(100)
    check('template app earns platform coins', pg.evaluate("RB.coins.balance('liliana')") == 3)
    check('apps cannot take coins away', pg.evaluate("RB.coins.add('liliana', {amount:-5, reason:'x'})") is None)

    # Phone
    ph = b.new_page(viewport={'width': 390, 'height': 844}, device_scale_factor=2)
    ph.add_init_script(MOCK)
    ph.goto(URL + 'index.html'); ph.wait_for_timeout(300)
    ph.screenshot(path=f'{OUT}/rb-8-phone-picker.png')
    check('phone picker: no horizontal scroll', ph.evaluate('document.documentElement.scrollWidth') <= 390)
    ph.goto(URL + 'index.html#/c/lukas'); ph.wait_for_timeout(300)
    ph.screenshot(path=f'{OUT}/rb-9-phone-lukas.png')
    check('phone: no horizontal scroll', ph.evaluate('document.documentElement.scrollWidth') <= 390)
    b.close()

srv.shutdown()
for o in ok: print('ok  ', o)
for e in errors: print('FAIL', e)
print(f'\n{len(ok)} passed, {len(errors)} failed')
sys.exit(1 if errors else 0)
