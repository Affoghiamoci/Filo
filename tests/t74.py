# Barra proprietà: sezioni comprimibili (stato ricordato, Posizione/Misure in sincronia), freccia "altro sotto"; Riquadro prende anche i pezzi coperti
from playwright.sync_api import sync_playwright
ok=True
def check(name,cond):
    global ok; ok=ok and bool(cond); print('OK ' if cond else 'KO ',name)
URL='file:///tmp/forma/dist/forma.html'
HEADS="[...document.querySelectorAll('#p-scroll h4.ph')].filter(h=>h.offsetParent).map(h=>h.dataset.k)"
with sync_playwright() as p:
    b=p.chromium.launch(args=["--use-gl=swiftshader"]); errs=[]
    pg=b.new_page(viewport={'width':1280,'height':760}); pg.on('pageerror',lambda e:errs.append(str(e)))
    pg.goto(URL);pg.wait_for_function("window.forma");pg.wait_for_timeout(800)
    pg.evaluate("(()=>{const f=forma;f.setSelection([f.createObject('box'),f.createObject('cylinder')])})()");pg.wait_for_timeout(400)
    hs=pg.evaluate(HEADS)
    check('Posizione sta sopra Allinea (gruppo)',hs.index('posizione')<hs.index('allinea'))
    check('la freccia "altro sotto" compare quando c\'è altro da scorrere',pg.evaluate("!document.querySelector('#p-more').classList.contains('hidden')"))
    pg.evaluate("document.querySelector('#p-scroll').scrollTop=9999");pg.wait_for_timeout(200)
    check('in fondo la freccia sparisce',pg.evaluate("document.querySelector('#p-more').classList.contains('hidden')"))
    pg.evaluate("document.querySelector('#p-scroll').scrollTop=0");pg.wait_for_timeout(100)
    pg.evaluate("[...document.querySelectorAll('#p-scroll h4.ph')].find(h=>h.offsetParent&&h.dataset.k==='posizione').click()");pg.wait_for_timeout(200)
    check('clic sull\'intestazione comprime la sezione',pg.evaluate("document.querySelector('#g-x').offsetParent===null"))
    pg.evaluate("forma.setSelection([forma.objects[0]])");pg.wait_for_timeout(300)
    check('Posizione dell\'oggetto singolo resta in sincronia',pg.evaluate("document.querySelector('#p-x').offsetParent===null"))
    pg.reload();pg.wait_for_function("window.forma");pg.wait_for_timeout(800)
    pg.evaluate("forma.createObject('box')");pg.wait_for_timeout(300)
    check('lo stato resta dopo il ricaricamento',pg.evaluate("document.querySelector('#p-x').offsetParent===null"))
    pg.focus("#p-scroll h4.ph[data-k=posizione]");pg.keyboard.press('Enter');pg.wait_for_timeout(200)
    check('Invio riapre la sezione',pg.evaluate("document.querySelector('#p-x').offsetParent!==null"))
    check('nessun errore di pagina',not errs)
    b.close()
print('TUTTO OK' if ok else 'FALLITO')
