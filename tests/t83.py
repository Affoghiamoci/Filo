# Feedback Reddit: scatola cubo, virgola nei campi, decimali in inglese, doppio clic seleziona il valore
from playwright.sync_api import sync_playwright
ok=True
def check(name,cond):
    global ok; ok=ok and bool(cond); print('OK ' if cond else 'KO ',name)
with sync_playwright() as p:
    b=p.chromium.launch(args=["--use-gl=swiftshader"]);pg=b.new_page(viewport={'width':1400,'height':850},locale='en-US')
    errs=[];pg.on('pageerror',lambda e:errs.append(str(e)))
    pg.goto('file:///tmp/forma/dist/forma.html');pg.wait_for_function("window.forma");pg.wait_for_timeout(800)
    pg.evaluate("forma.createObject('box')");pg.wait_for_timeout(200)
    s=pg.evaluate("forma.sizeOf(forma.objects[0])")
    check('la scatola nasce cubo',s['w']==s['d']==s['h'])
    pg.click('#p-w'); pg.keyboard.press('Control+A'); pg.keyboard.type('4,5'); pg.keyboard.press('Enter'); pg.wait_for_timeout(150)
    check('virgola nei campi = punto (4,5 → 4.5, non 45)',pg.evaluate("forma.sizeOf(forma.objects[0]).w")==4.5)
    pg.click('#p-d'); pg.keyboard.press('Control+A'); pg.keyboard.type('7.25'); pg.keyboard.press('Enter'); pg.wait_for_timeout(150)
    check('il punto resta valido',pg.evaluate("forma.sizeOf(forma.objects[0]).d")==7.25)
    pg.dblclick('#p-h'); pg.wait_for_timeout(100)
    sel=pg.evaluate("(()=>{const i=document.querySelector('#p-h');return i.value.length>0&&i.selectionStart===0&&i.selectionEnd===i.value.length||document.getSelection().toString()===i.value})()")
    check('doppio clic evidenzia il valore',sel)
    # lingua inglese: niente virgole decimali nelle etichette
    pg.click('[data-lang="en"]'); pg.wait_for_timeout(300)
    pg.evaluate("forma.setSnap(0.5)"); pg.wait_for_timeout(300)
    txt=pg.evaluate("document.body.innerText")
    import re
    bad=re.findall(r'\d,\d(?!\d\d\d)',txt)
    check('in inglese nessun decimale con la virgola (%s)'%bad[:3],not bad)
    check('nessun errore',not errs); print('errs',errs); b.close()
print('TUTTO OK' if ok else 'ERRORI'); raise SystemExit(0 if ok else 1)
