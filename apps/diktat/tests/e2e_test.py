"""End-to-end run of one practice session in headless Chromium.
Speech is mocked (headless has no voices); everything else is the real app.
Run:  python3 tests/e2e_test.py  (serves the folder on :8765)
"""
import http.server, threading, functools, os, sys
from playwright.sync_api import sync_playwright

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = sys.argv[1] if len(sys.argv) > 1 else ROOT
handler = functools.partial(http.server.SimpleHTTPRequestHandler, directory=ROOT)
handler.log_message = lambda *a: None
srv = http.server.ThreadingHTTPServer(('127.0.0.1', 8765), handler)
threading.Thread(target=srv.serve_forever, daemon=True).start()

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

errors = []
with sync_playwright() as p:
    b = p.chromium.launch()
    pg = b.new_page(viewport={'width': 1280, 'height': 900})
    pg.on('pageerror', lambda e: errors.append(str(e)))
    pg.on('console', lambda m: m.type == 'error' and errors.append(m.text))
    pg.add_init_script(MOCK)
    pg.goto('http://127.0.0.1:8765/index.html')
    pg.screenshot(path=f'{OUT}/shot-1-home.png')

    # shorten session to 3 for the test
    pg.evaluate("DT.app.store.update(s => s.settings.sessionLength = 3)")
    pg.reload()
    pg.click('#btn-start')
    pg.wait_for_timeout(600)
    spoken = pg.evaluate('window.__spoken')
    assert spoken, 'sentence was not spoken'

    for i in range(3):
        target = pg.evaluate('window.__spoken[window.__spoken.length-1].text')
        if i == 0:
            # typical mistakes: lower-case first noun, drop last letter of a long word, no final punctuation
            words = target.split(' ')
            wrong = [w for w in words]
            wrong[-1] = wrong[-1].rstrip('.!?“"')
            for k, w in enumerate(wrong):
                if k > 0 and w[:1].isupper():
                    wrong[k] = w.lower(); break
            longest = max(range(len(wrong)), key=lambda k: len(wrong[k]))
            wrong[longest] = wrong[longest][:-1]
            typed = ' '.join(wrong)
        else:
            typed = target
        pg.fill('#answer', typed)
        pg.keyboard.press('Enter')
        pg.wait_for_timeout(300)
        if i == 0:
            pg.screenshot(path=f'{OUT}/shot-2-feedback.png', full_page=True)
            # wrong retype first, then correct
            inputs = pg.query_selector_all('.fix-input')
            assert inputs, 'no correction inputs'
            first = inputs[0]
            pg.fill(f'#{first.get_attribute("id")}', 'xx')
            first.press('Enter')
            pg.wait_for_timeout(200)
            assert 'Fast' in pg.inner_text(f'#msg-{first.get_attribute("data-err")}')
            assert pg.is_disabled('#btn-next')
            for inp in pg.query_selector_all('.fix-input'):
                eid = inp.get_attribute('data-err')
                expected = pg.evaluate(f"document.querySelector('#fix-{eid}').dataset.x || null")
                # read expected from the aria-label
                label = inp.get_attribute('aria-label').split(': ', 1)[1]
                inp.fill(label)
            pg.wait_for_timeout(400)
            pg.screenshot(path=f'{OUT}/shot-3-corrected.png', full_page=True)
            assert not pg.is_disabled('#btn-next'), 'next still disabled'
        else:
            assert 'Alles richtig' in pg.inner_text('#fb-head')
        pg.click('#btn-next')
        pg.wait_for_timeout(700 if i < 2 else 2500)

    assert pg.is_visible('#summary'), 'summary not shown'
    pg.wait_for_timeout(1500)
    pg.screenshot(path=f'{OUT}/shot-4-summary.png', full_page=True)
    state = pg.evaluate('JSON.parse(localStorage.getItem("diktat-trainer:lukas"))')
    bal = sum(c['amount'] for c in state['coins'])
    print('coins', bal, [ (c['amount'], c['reason']) for c in state['coins']])
    print('sessions', len(state['sessions']), 'attempts', len(state['attempts']))
    print('problem words', [w for w, s in state['wordStats'].items() if s['wrong']])
    print('summary text:', pg.inner_text('#summary')[:400].replace('\n', ' | '))

    # phone layout of feedback
    # ---- Thema wählen: a history section only gives sentences from that section ----
    sp = b.new_page(viewport={'width': 1280, 'height': 900})
    sp.on('pageerror', lambda e: errors.append(str(e)))
    sp.add_init_script(MOCK)
    sp.goto('http://127.0.0.1:8765/index.html'); sp.wait_for_timeout(300)
    n_sections = sp.locator('.section').count()
    assert n_sections >= 5, f'expected ≥5 section buttons, got {n_sections}'
    for sec in ('steinzeit', 'zeit', 'bronzezeit'):
        sp.click(f'.section[data-section={sec}]'); sp.wait_for_timeout(100)
        assert sp.get_attribute(f'.section[data-section={sec}]', 'aria-pressed') == 'true'
        sp.reload(); sp.wait_for_timeout(300)
        assert sp.get_attribute(f'.section[data-section={sec}]', 'aria-pressed') == 'true', 'choice not remembered'
        sp.click('#btn-start'); sp.wait_for_timeout(500)
        texts = sp.evaluate("window.__spoken.map(u => u.text)")
        pool = sp.evaluate(f"DT.builtinSentences.filter(s => s.section === '{sec}').map(s => s.text)")
        assert texts and all(t in pool for t in texts), f'{sec}: sentence from another section: {texts}'
        if sec == 'steinzeit': sp.screenshot(path=f'{OUT}/shot-sections-practice.png')
        sp.click('#btn-quit'); sp.wait_for_timeout(300)
        sp.evaluate("window.__spoken = []")
    sp.click('.section[data-section=steinzeit]'); sp.wait_for_timeout(100)
    sp.screenshot(path=f'{OUT}/shot-sections-home.png', full_page=True)
    print('sections ok:', n_sections, 'buttons')
    sp.close()

    ph = b.new_page(viewport={'width': 390, 'height': 844}, device_scale_factor=2)
    ph.add_init_script(MOCK)
    ph.goto('http://127.0.0.1:8765/index.html')
    ph.screenshot(path=f'{OUT}/shot-5-phone-home.png')
    ph.click('#btn-start'); ph.wait_for_timeout(500)
    ph.fill('#answer', 'der kleine hund leuft schnel nachhause')
    ph.click('#btn-check'); ph.wait_for_timeout(400)
    ph.screenshot(path=f'{OUT}/shot-6-phone-feedback.png', full_page=True)
    assert ph.is_visible('#in-all'), 'sentence mode not used for a very wrong answer'
    tgt = ph.evaluate('window.__spoken[0].text')
    ph.fill('#in-all', tgt[:-1])   # drop the final punctuation mark (. ! ? or “)
    ph.press('#in-all', 'Enter'); ph.wait_for_timeout(200)
    assert 'Fast' in ph.inner_text('#msg-all')
    ph.fill('#in-all', tgt); ph.wait_for_timeout(500)
    assert not ph.is_disabled('#btn-next'), 'sentence retype not accepted'
    ph.screenshot(path=f'{OUT}/shot-7-phone-sentence-done.png', full_page=True)
    sw = ph.evaluate('document.documentElement.scrollWidth')
    print('phone scrollWidth', sw)
    b.close()

print('JS errors:', errors or 'none')
srv.shutdown()
