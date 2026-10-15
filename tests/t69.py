# Guida: ricerca in tempo reale (elenco con estratti, evidenziazione, accenti, Esc, /, EN)
from playwright.sync_api import sync_playwright
ok=True
def check(name,cond):
    global ok; ok=ok and bool(cond); print('OK ' if cond else 'KO ',name)
with sync_playwright() as p:
    b=p.chromium.launch(args=["--use-gl=swiftshader"])
    for lang,q,q2,none in [('it','spigolo','smusso','zzzzqq'),('en','edge','chamfer','zzzzqq')]:
        ctx=b.new_context(viewport={'width':1440,'height':900}); errs=[]
        ctx.add_init_script(f"localStorage.setItem('forma.lang','{lang}')")
        pg=ctx.new_page(); pg.on('pageerror',lambda e:errs.append(str(e)))
        pg.goto('file:///tmp/forma/dist/forma.html');pg.wait_for_function("window.forma");pg.wait_for_timeout(500)
        pg.keyboard.press('F1');pg.wait_for_timeout(400)
        n0=pg.evaluate("document.querySelectorAll('#hp-nav button[data-id]').length")
        pg.keyboard.press('/');pg.wait_for_timeout(100)
        check(lang+': / porta il cursore nella barra',pg.evaluate("document.activeElement.id")=='hp-q')
        pg.keyboard.type(q,delay=20);pg.wait_for_timeout(300)
        r=pg.evaluate("(()=>({res:document.querySelectorAll('#hp-nav .hp-res').length,sn:document.querySelectorAll('#hp-nav .hp-sn').length,mk:document.querySelectorAll('#hp-nav mark').length,hits:document.querySelectorAll('#hp-main mark.hp-hit').length,head:document.querySelector('#hp-nav .hp-g').textContent}))()")
        check(lang+': elenco risultati con estratti',r['res']>=2 and r['sn']>=2 and r['mk']>=2)
        check(lang+': parola evidenziata nella pagina',r['hits']>=1)
        # clic su un estratto: apre quella pagina
        pg.evaluate("document.querySelectorAll('#hp-nav .hp-res')[1].click()");pg.wait_for_timeout(200)
        t=pg.evaluate("document.querySelector('#hp-main h2').textContent")
        id1=pg.evaluate("document.querySelector('#hp-nav .hp-res.on span').textContent")
        check(lang+': clic sul risultato apre la pagina',t==id1 and pg.evaluate("document.querySelectorAll('#hp-main mark.hp-hit').length")>=1)
        # senza accenti / maiuscole
        pg.fill('#hp-q','SPIGOLO' if lang=='it' else 'EDGE');pg.wait_for_timeout(200)
        check(lang+': maiuscole indifferenti',pg.evaluate("document.querySelectorAll('#hp-nav .hp-res').length")>=2)
        if lang=='it':
            pg.fill('#hp-q','perche');pg.wait_for_timeout(200)
            check('it: accenti indifferenti (perche = perché)',pg.evaluate("document.querySelectorAll('#hp-nav .hp-res').length")>=1)
        pg.fill('#hp-q',none);pg.wait_for_timeout(200)
        check(lang+': nessun risultato',pg.evaluate("document.querySelectorAll('#hp-nav .hp-res').length")==0 and pg.evaluate("!!document.querySelector('#hp-nav .hp-none')"))
        # Esc: prima cancella la ricerca, la finestra resta aperta
        pg.keyboard.press('Escape');pg.wait_for_timeout(200)
        check(lang+': Esc cancella e la Guida resta aperta',pg.evaluate("document.querySelector('#hp-q').value")=='' and pg.evaluate("document.querySelector('#dlg-help').open") and pg.evaluate("document.querySelectorAll('#hp-nav button[data-id]').length")==n0)
        pg.keyboard.press('Escape');pg.wait_for_timeout(200)
        check(lang+': secondo Esc chiude',not pg.evaluate("document.querySelector('#dlg-help').open"))
        check(lang+': nessun errore',not errs)
        ctx.close()
    b.close()
print('TUTTO OK' if ok else 'FALLITO')
