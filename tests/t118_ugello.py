# Controllo di stampa: ugello selezionabile (controllo + esporta), pareti sottili, fessure, ponti, piatto
from playwright.sync_api import sync_playwright
ok=True
def check(name,cond):
    global ok; ok=ok and bool(cond); print('OK ' if cond else 'KO ',name)
LIST="document.querySelector('#chk-list').innerText"
BODY="!document.querySelector('#chk-body').classList.contains('hidden')"
with sync_playwright() as p:
    b=p.chromium.launch(args=["--use-gl=swiftshader"]);pg=b.new_page(viewport={'width':1300,'height':900})
    errs=[];pg.on('pageerror',lambda e:errs.append(str(e)))
    pg.goto('file:///tmp/forma/dist/forma.html');pg.wait_for_function("window.forma&&forma.MM()");pg.wait_for_timeout(400)
    def box(w,d,h,x=0,y=0,z=0):
        pg.evaluate("forma.createObject('box')"); pg.wait_for_timeout(80)
        for k,v in [('w',w),('d',d),('h',h),('x',x),('y',y),('z',z)]: pg.fill('#p-'+k,str(v)); pg.keyboard.press('Enter')
    # 1) lastra sottile 0.3 mm: sotto una linea con ugello 0.4 e anche con 0.2 non lo è
    box(40,0.3,20)
    pg.evaluate("forma.openCheck()"); pg.wait_for_function(BODY,timeout=90000); pg.wait_for_timeout(300)
    t=pg.evaluate(LIST); print(t[:300])
    check('ugello 0,4: parete da 0,3 mm segnalata come più sottile di una linea','più sottili di una linea' in t)
    pg.evaluate("document.querySelector('#chk-nz [data-v=\"0.2\"]').click()"); pg.wait_for_timeout(300)
    pg.wait_for_function(BODY,timeout=90000); pg.wait_for_timeout(500)
    t2=pg.evaluate(LIST); print(t2[:300])
    check('ugello 0,2: la stessa parete è stampabile (niente "più sottili di una linea")','più sottili di una linea' not in t2)
    check('con 0,2 gli strati proposti cambiano (0,10 ideale)',pg.evaluate("document.querySelector('#chk-lh').dataset.v")=='0.1')
    # 2) piatto: scatola enorme
    pg.evaluate("document.querySelector('#chk-nz [data-v=\"0.4\"]').click()"); pg.wait_for_timeout(300)
    pg.click('#chk-x'); pg.wait_for_timeout(300)
    pg.evaluate("forma.selectAll&&forma.selectAll();forma.setSelection(forma.objects);forma.setDims&&0")
    pg.fill('#p-w','250'); pg.keyboard.press('Enter'); pg.wait_for_timeout(200)
    pg.evaluate("forma.openCheck()"); pg.wait_for_function(BODY,timeout=90000); pg.wait_for_timeout(500)
    t3=pg.evaluate(LIST); print(t3[:200])
    check('pezzo da 250 mm: più grande del piatto','Più grande del piatto' in t3 or 'più grande del piatto' in t3.lower())
    pg.click('#chk-x'); pg.wait_for_timeout(300)
    # 3) esporta: selettore ugello con consigli
    pg.evaluate("forma.askExport('3mf')"); pg.wait_for_timeout(300)
    check('esporta: selettore ugello visibile',pg.is_visible('#exp-nzs'))
    d0=pg.inner_text('#exp-nz-d'); print(d0)
    check('consigli per 0,4: strato ideale 0,20 e linea 0,42','0,20' in d0 and '0,42' in d0)
    pg.click('#exp-nzs [data-v="0.6"]'); pg.wait_for_timeout(200)
    d1=pg.inner_text('#exp-nz-d'); print(d1)
    check('consigli per 0,6: linea 0,62 e strato ideale 0,30','0,62' in d1 and '0,30' in d1)
    check('la scelta si ricorda nel controllo',pg.evaluate("document.querySelector('#chk-nz').dataset.v")=='0.6')
    pg.click('#exp-cancel'); pg.wait_for_timeout(200)
    check('nessun errore',not errs); print(errs[:3]); b.close()
print('TUTTO OK' if ok else 'ERRORI'); raise SystemExit(0 if ok else 1)
