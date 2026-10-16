# 3D da dietro a destra. Rotellina: con scatti piccoli (come un mouse su Mac) la vista ruota; col pulsante "Rotellina = zoom" zooma e la scelta resta. Intestazioni a pallino.
from playwright.sync_api import sync_playwright
ok=True
def check(name,cond):
    global ok; ok=ok and bool(cond); print('OK ' if cond else 'KO ',name)
URL='file:///tmp/forma/dist/forma.html'
with sync_playwright() as p:
    b=p.chromium.launch(args=["--use-gl=swiftshader"]); errs=[]
    pg=b.new_page(viewport={'width':1280,'height':760}); pg.on('pageerror',lambda e:errs.append(str(e)))
    pg.goto(URL);pg.wait_for_function("window.forma");pg.wait_for_timeout(800)
    pg.evaluate("localStorage.removeItem('filo.wheel')")
    pg.evaluate("forma.createObject('box')");pg.wait_for_timeout(300)
    d0=pg.evaluate("forma.cam.dist"); pg.mouse.move(640,380)
    for _ in range(3): pg.mouse.wheel(0,4); pg.wait_for_timeout(30)
    check('automatico: scatti piccoli non zoomano',abs(pg.evaluate("forma.cam.dist")-d0)<1e-6)
    pg.click('#b-wheel');pg.wait_for_timeout(100);pg.mouse.move(640,380)
    for _ in range(3): pg.mouse.wheel(0,4); pg.wait_for_timeout(30)
    check('acceso: la rotellina zooma',pg.evaluate("forma.cam.dist")>d0+5)
    pg.reload();pg.wait_for_function("window.forma");pg.wait_for_timeout(800)
    check('la scelta resta dopo il ricaricamento',pg.evaluate("document.querySelector('#b-wheel').getAttribute('aria-pressed')")=='true')
    pg.evaluate("localStorage.removeItem('filo.wheel')")
    pg.evaluate("forma.createObject('box')");pg.wait_for_timeout(300)
    check('intestazione: pallino pieno arancione se aperta',pg.evaluate("(()=>{const h=[...document.querySelectorAll('#p-scroll h4.ph')].find(h=>h.offsetParent);return getComputedStyle(h,'::before').borderRadius==='50%'&&getComputedStyle(h,'::after').content==='none'})()"))
    check('Allinea al piatto non compare più con un oggetto',pg.evaluate("document.querySelector('#p-key').offsetParent===null"))
    pg.click('[data-view=iso]');pg.wait_for_timeout(900)
    check('3D: guarda da dietro a destra (X, Y e Z visibili), isometrica vera 45°/35,26°',pg.evaluate("Math.abs(forma.cam.az-135)<0.5&&Math.abs(forma.cam.el-35.264)<0.5"))
    check('nessun errore di pagina',not errs)
    b.close()
print('TUTTO OK' if ok else 'ERRORI')
