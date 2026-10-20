# Controllo di stampa: fessure troppo strette, ponti lunghi, pezzo alto e stretto, strato sottile tra due campioni
from playwright.sync_api import sync_playwright
ok=True
def check(name,cond):
    global ok; ok=ok and bool(cond); print('OK ' if cond else 'KO ',name)
LIST="document.querySelector('#chk-list').innerText"
BODY="!document.querySelector('#chk-body').classList.contains('hidden')"
with sync_playwright() as p:
    b=p.chromium.launch(args=["--use-gl=swiftshader"]);pg=b.new_page(viewport={'width':1300,'height':900})
    errs=[];pg.on('pageerror',lambda e:errs.append(str(e)))
    def start():
        pg.goto('file:///tmp/forma/dist/forma.html');pg.wait_for_function("window.forma&&forma.MM()");pg.wait_for_timeout(400)
    def box(w,d,h,x=0,y=0,z=0):
        pg.evaluate("forma.createObject('box')"); pg.wait_for_timeout(80)
        for k,v in [('w',w),('d',d),('h',h),('x',x),('y',y),('z',z)]: pg.fill('#p-'+k,str(v)); pg.keyboard.press('Enter')
    def run():
        pg.evaluate("forma.openCheck()"); pg.wait_for_function(BODY,timeout=120000); pg.wait_for_timeout(500); return pg.evaluate(LIST)
    # fessura da 0,25 mm in un blocco (ugello 0,4)
    start(); box(30,30,10); box(0.25,20,12,0,0,-1)
    pg.evaluate("(()=>{forma.objects[1].userData.hole=true;forma.setSelection(forma.objects);forma.combine('union')})()"); pg.wait_for_function("forma.objects.length===1"); pg.wait_for_timeout(400)
    pg.evaluate("forma.setSelection(forma.objects)")
    t=run(); print(t[:400])
    check('fessura da 0,25 mm: segnalata','Fessure e fori troppo stretti' in t)
    # ponte lungo: due pilastri e una lastra
    start(); box(5,20,10,-17.5,0,0); box(5,20,10,17.5,0,0); box(40,20,3,0,0,10)
    pg.evaluate("forma.setSelection(forma.objects);forma.combine('union')"); pg.wait_for_function("forma.objects.length===1"); pg.wait_for_timeout(400)
    t=run(); print(t[:600])
    check('ponte da 30 mm: segnalato','Ponti lunghi' in t)
    # colonna alta e stretta
    start(); box(6,6,80)
    t=run(); check('colonna 6x6x80: alta e stretta','Pezzo alto e stretto' in t)
    # gradino sottile (0,3 mm alto 0,25) tra i campioni: lastra 0,3 spessa su un blocco, alta solo 1 mm a metà altezza
    start(); box(30,30,40); box(40,0.3,1,0,0,20)
    pg.evaluate("forma.setSelection(forma.objects);forma.combine('union')"); pg.wait_for_function("forma.objects.length===1"); pg.wait_for_timeout(400)
    check('nessun errore',not errs); print(errs[:3]); b.close()
print('TUTTO OK' if ok else 'ERRORI'); raise SystemExit(0 if ok else 1)
