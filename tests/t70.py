# Ripeti: anteprima in tempo reale (sagome, totale e ingombro), sparisce uscendo dal pannello, diventa vera con Ripeti
from playwright.sync_api import sync_playwright
ok=True
def check(name,cond):
    global ok; ok=ok and bool(cond); print('OK ' if cond else 'KO ',name)
CNT="forma.repeatPreviewCount"
INFO="document.querySelector('#rp-info').textContent"
with sync_playwright() as p:
    b=p.chromium.launch(args=["--use-gl=swiftshader"])
    for lang in ['it','en']:
        ctx=b.new_context(viewport={'width':1440,'height':900}); errs=[]
        ctx.add_init_script(f"localStorage.setItem('forma.lang','{lang}')")
        pg=ctx.new_page(); pg.on('pageerror',lambda e:errs.append(str(e)))
        pg.goto('file:///tmp/forma/dist/forma.html');pg.wait_for_function("window.forma");pg.wait_for_timeout(500)
        pg.evaluate("forma.createObject('box')");pg.wait_for_timeout(300)
        info0=pg.evaluate(INFO)
        check(lang+': totale già scritto prima di toccare nulla',('8' in info0) and ('mm' in info0))
        check(lang+': nessuna sagoma prima di toccare i campi',pg.evaluate(CNT)==0)
        pg.fill('#rp-nx','4');pg.wait_for_timeout(200)
        check(lang+': 4x3 = 11 sagome',pg.evaluate(CNT)==11 and pg.evaluate(INFO).startswith('11 '))
        pg.click('#rp-mode [data-v="honey"]');pg.wait_for_timeout(200)
        check(lang+': nido d\'ape: stesse 11 sagome',pg.evaluate(CNT)==11)
        pg.click('#rp-mode [data-v="polar"]');pg.wait_for_timeout(200)
        check(lang+': cerchio: 5 sagome (6 copie)',pg.evaluate(CNT)==5 and not ('×' in pg.evaluate(INFO)))
        pg.fill('#rp-n','200');pg.wait_for_timeout(200)
        pg.click('#rp-mode [data-v="grid"]');pg.fill('#rp-nx','60');pg.fill('#rp-ny','60');pg.wait_for_timeout(300)
        check(lang+': oltre il limite nessuna sagoma e avviso',pg.evaluate(CNT)==0 and ('600' in pg.evaluate(INFO)))
        pg.fill('#rp-nx','2');pg.fill('#rp-ny','2');pg.wait_for_timeout(200)
        check(lang+': 2x2 = 3 sagome',pg.evaluate(CNT)==3)
        pg.mouse.click(700,400);pg.wait_for_timeout(200)       # fuori dal pannello
        check(lang+': clic fuori: sagome sparite',pg.evaluate(CNT)==0)
        n0=pg.evaluate("forma.objects.length")
        pg.evaluate("forma.setSelection([forma.objects[0]])")
        pg.fill('#rp-nx','3');pg.fill('#rp-ny','1');pg.wait_for_timeout(200)
        check(lang+': 3x1 = 2 sagome',pg.evaluate(CNT)==2)
        pg.click('#rp-go');pg.wait_for_timeout(500)
        check(lang+': Ripeti: sagome sparite e copie vere',pg.evaluate(CNT)==0 and pg.evaluate("forma.objects.length")==n0+2)
        check(lang+': nessun errore',not errs)
        ctx.close()
    b.close()
print('TUTTO OK' if ok else 'FALLITO')
