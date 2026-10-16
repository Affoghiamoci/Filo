# Controlla stampa: l'analisi non blocca l'interfaccia, riparte se cambi il lavoro, si ferma se chiudi la finestra
from playwright.sync_api import sync_playwright
ok=True
def check(name,cond):
    global ok; ok=ok and bool(cond); print('OK ' if cond else 'KO ',name)
LIST="document.querySelector('#chk-list').innerText"
BODY="!document.querySelector('#chk-body').classList.contains('hidden')"
with sync_playwright() as p:
    b=p.chromium.launch(args=["--use-gl=swiftshader"])
    ctx=b.new_context(viewport={'width':1440,'height':900}); errs=[]
    ctx.add_init_script("localStorage.setItem('forma.lang','it')")
    pg=ctx.new_page(); pg.on('pageerror',lambda e:errs.append(str(e)))
    pg.goto('file:///tmp/forma/dist/forma.html');pg.wait_for_function("window.forma");pg.wait_for_timeout(500)
    pg.evaluate("forma.createObject('box')");pg.wait_for_timeout(300)
    pg.evaluate("forma.openCheck()")
    pg.wait_for_function(BODY,timeout=60000)
    check('risultato: poggia sul piatto',('Poggia sul piatto' in pg.evaluate(LIST)))
    check('risultato: solido chiuso',('Solido chiuso' in pg.evaluate(LIST)))
    check('slider degli strati: scritta aggiornata',(pg.evaluate("(()=>{const s=document.querySelector('#chk-sl');s.value=5;s.dispatchEvent(new Event('input'));return document.querySelector('#chk-rd').textContent})()").startswith('Strato 6')))
    # cambia il lavoro con la finestra aperta: l'analisi riparte da sola
    est0=pg.evaluate("document.querySelector('#chk-est').innerText")
    pg.evaluate("forma.setEulerDeg(forma.selection[0],0,0,0);forma.selection[0].scale.set(1,1,2.5);forma.selection[0].updateMatrixWorld(true);forma.layOnPlate&&0")
    pg.evaluate("forma.setSelection(forma.selection)")
    pg.evaluate("document.querySelector('#chk-lh [data-v=\"0.12\"]').click()")      # altro spessore di strato: stessa riesecuzione
    pg.wait_for_function("document.querySelector('#chk-est').innerText!==%r && !document.querySelector('#chk-body').classList.contains('hidden')"%est0,timeout=60000)
    check('cambio spessore strato: il controllo si aggiorna',True)
    check('nessuna analisi rimasta a metà',pg.evaluate("forma.chk.busy===false"))
    # nuovo cambio mentre sta ancora analizzando: ripartenza, vale l'ultima scelta
    pg.evaluate("forma.openCheck();document.querySelector('#chk-lh [data-v=\"0.2\"]').click()")
    pg.wait_for_timeout(300)
    pg.wait_for_function(BODY,timeout=60000);pg.wait_for_timeout(300)
    check('cambio durante l\'analisi: vale l\'ultima scelta (0,2 mm)',pg.evaluate("forma.chk.R && forma.chk.R.layer===0.2 && forma.chk.busy===false"))
    # chiusura durante l'analisi
    pg.click('#chk-x');pg.wait_for_timeout(300)
    pg.evaluate("forma.openCheck()");pg.click('#chk-x');pg.wait_for_timeout(2500)
    check('chiusa durante l\'analisi: finestra chiusa e motore libero',pg.evaluate("!document.querySelector('#dlg-check').open && forma.chk.busy===false"))
    pg.evaluate("forma.openCheck()")
    pg.wait_for_function(BODY,timeout=60000)
    check('riaperta: torna il risultato',('Solido chiuso' in pg.evaluate(LIST)))
    check('nessun errore di pagina',not errs)
    if errs: print(errs)
    b.close()
print('TUTTO OK' if ok else 'CI SONO ERRORI')
