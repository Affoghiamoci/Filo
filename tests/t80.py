# Adatta (pulsante e ⌘0): con una selezione inquadra il pezzo, senza selezione tutto
from playwright.sync_api import sync_playwright
ok=True
def check(name,cond):
    global ok; ok=ok and bool(cond); print('OK ' if cond else 'KO ',name)
with sync_playwright() as p:
    b=p.chromium.launch(args=["--use-gl=swiftshader"]);pg=b.new_page(viewport={'width':1400,'height':850})
    errs=[];pg.on('pageerror',lambda e:errs.append(str(e)))
    pg.goto('file:///tmp/forma/dist/forma.html');pg.wait_for_function("window.forma");pg.wait_for_timeout(900)
    pg.evaluate("(()=>{forma.createObject('box');forma.createObject('box');const o=forma.objects;o[0].position.x=-90;o[1].position.x=90;forma.setSelection([]);})()")
    dist=lambda:pg.evaluate("forma.cam.dist"); tgt=lambda:pg.evaluate("forma.cam.target.x")
    pg.click('#b-fit'); pg.wait_for_timeout(600); dAll,xAll=dist(),tgt()
    check('senza selezione: inquadra tutto (centro ~0)',abs(xAll)<5)
    pg.evaluate("forma.setSelection([forma.objects[1]])"); pg.click('#b-fit'); pg.wait_for_timeout(600); dSel,xSel=dist(),tgt()
    check('con selezione: centro sul pezzo e più vicino',xSel>60 and dSel<dAll)
    pg.evaluate("forma.setSelection([])"); pg.keyboard.press('Control+0'); pg.wait_for_timeout(600)
    check('⌘0 senza selezione: di nuovo tutto',abs(tgt())<5)
    pg.evaluate("forma.setSelection([forma.objects[0]])"); pg.keyboard.press('Control+0'); pg.wait_for_timeout(600)
    check('⌘0 con selezione: sul pezzo',tgt()<-60)
    # menu sul vuoto: Inquadra tutto resta su tutto
    pg.mouse.click(700,110,button='right'); pg.wait_for_timeout(150)
    pg.locator('#ctx button',has_text='Inquadra tutto').click(); pg.wait_for_timeout(600)
    check('Inquadra tutto del menu ignora la selezione',abs(tgt())<5)
    check('nessun errore',not errs); print('errs',errs); b.close()
print('TUTTO OK' if ok else 'ERRORI'); raise SystemExit(0 if ok else 1)
