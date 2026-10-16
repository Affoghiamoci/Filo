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
        pg.mouse.move(700,400);pg.mouse.down();pg.mouse.move(740,420,steps=5);pg.mouse.up();pg.wait_for_timeout(200)   # orbita: le sagome restano
        check(lang+': muovendosi nella scena le sagome restano',pg.evaluate(CNT)==3)
        pg.mouse.move(700,400);pg.keyboard.press('Escape');pg.wait_for_timeout(200)
        check(lang+': Esc: sagome sparite',pg.evaluate(CNT)==0)
        pg.fill('#rp-nx','2');pg.wait_for_timeout(200)
        check(lang+': tornano cambiando un numero',pg.evaluate(CNT)==3)
        pg.evaluate("forma.setTool('rotate')");pg.wait_for_timeout(200)
        check(lang+': cambio strumento: sagome sparite',pg.evaluate(CNT)==0)
        pg.evaluate("forma.setTool('move')");pg.wait_for_timeout(100)
        n0=pg.evaluate("forma.objects.length")
        pg.evaluate("forma.setSelection([forma.objects[0]])")
        pg.fill('#rp-nx','3');pg.fill('#rp-ny','1');pg.wait_for_timeout(200)
        check(lang+': 3x1 = 2 sagome',pg.evaluate(CNT)==2)
        x0=pg.evaluate("forma.objects[0].position.x")
        pg.click('#rp-go');pg.wait_for_timeout(500)
        check(lang+': Ripeti: sagome sparite e copie vere',pg.evaluate(CNT)==0 and pg.evaluate("forma.objects.length")==n0+2)
        xs=sorted(pg.evaluate("forma.objects.map(o=>+o.position.x.toFixed(2))"))
        ex=pg.evaluate("forma.sizeOf?forma.sizeOf(forma.objects[0]).x:30")
        check(lang+': originale al centro (3 colonne: -passo, 0, +passo)',len(xs)==3 and abs(xs[1]-x0)<0.01 and abs(xs[2]-xs[1]-(xs[1]-xs[0]))<0.01)
        check(lang+': nessun errore',not errs)
        ctx.close()
    b.close()
print('TUTTO OK' if ok else 'FALLITO')
