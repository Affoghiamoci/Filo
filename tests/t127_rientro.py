# 1.4.4: Cornice dentro Estrudi (era il modo Rientro): bordo rialzato o vasca in un passo solo, con anteprima
from playwright.sync_api import sync_playwright
ok=True
def check(name,cond):
    global ok; ok=ok and bool(cond); print('OK ' if cond else 'KO ',name)
with sync_playwright() as p:
    b=p.chromium.launch(args=["--use-gl=swiftshader"]);pg=b.new_page(viewport={'width':1300,'height':900})
    errs=[];pg.on('pageerror',lambda e:errs.append(str(e)))
    pg.goto('file:///tmp/forma/dist/forma.html');pg.wait_for_function("window.forma&&forma.MM()");pg.wait_for_timeout(400)
    pg.evaluate("forma.createObject('box')");pg.wait_for_timeout(100)
    for k,v in [('w',20),('d',20),('h',10),('x',0),('y',0),('z',0)]: pg.fill('#p-'+k,str(v)); pg.keyboard.press('Enter')
    TOP="""()=>{const o=forma.objects[0],g=o.geometry,P=g.attributes.position,I=g.index;const n=(I?I.count:P.count)/3;let zmax=-1e9;for(let i=0;i<P.count;i++)zmax=Math.max(zmax,P.getZ(i));
    for(let t=0;t<n;t++){const v=[0,1,2].map(k=>I?I.getX(t*3+k):t*3+k);if(v.every(i=>Math.abs(P.getZ(i)-zmax)<1e-3))return t}return -1}"""
    pg.evaluate("forma.setSelection([forma.objects[0]]);forma.setTool('face')");pg.wait_for_timeout(200)
    t=pg.evaluate(TOP); pg.evaluate("([t])=>forma.selectFaceFromHit({object:forma.objects[0],faceIndex:t},false)",[t]); pg.wait_for_timeout(300)
    check('niente più modo Rientro a parte',pg.evaluate("!document.querySelector('#f-mode button[data-v=\"inset\"]')"))
    pg.click('#f-mode button[data-v="extrude"]'); pg.wait_for_timeout(200)
    check('Estrudi: Scala il lato nascosta',pg.evaluate("document.querySelector('#f-scale-box').classList.contains('hidden')"))
    pg.fill('#f-frame','3'); pg.click('#f-push'); pg.fill('#f-push','-4'); pg.wait_for_timeout(600)
    check('anteprima con cornice visibile',pg.evaluate("forma.facePrev.visible"))
    check('anteprima: un solo pezzo, nessuna copia',pg.evaluate("forma.objects.length")==1)
    h0=pg.evaluate("forma.histLen?forma.histLen():0")
    pg.click('#f-push-go'); pg.wait_for_timeout(3000)
    check('vasca: pezzo chiuso',pg.evaluate("forma.openEdgeCount(forma.objects[0].geometry)")==0)
    check('vasca: altezza resta 10',abs(pg.evaluate("forma.worldBox(forma.objects[0]).max.z")-10)<0.01)
    check('vasca: volume 4000 - 14x14x4',abs(pg.evaluate("forma.soupVolume(forma.worldPositions(forma.objects[0]))")-(4000-14*14*4))<1)
    check('un solo pezzo',pg.evaluate("forma.objects.length")==1)
    check('cornice tornata a 0',pg.evaluate("document.querySelector('#f-frame').value")=='0')
    pg.evaluate("forma.undo()"); pg.wait_for_timeout(800)
    check('un solo Annulla torna al cubo pieno',abs(pg.evaluate("forma.soupVolume(forma.worldPositions(forma.objects[0]))")-4000)<1)
    # bordo rialzato
    pg.evaluate("forma.setSelection([forma.objects[0]]);forma.setTool('face')");pg.wait_for_timeout(200)
    t=pg.evaluate(TOP); pg.evaluate("([t])=>forma.selectFaceFromHit({object:forma.objects[0],faceIndex:t},false)",[t]); pg.wait_for_timeout(300)
    pg.fill('#f-frame','2'); pg.fill('#f-push','5'); pg.click('#f-push-go'); pg.wait_for_timeout(3000)
    check('rialzo: altezza 15',abs(pg.evaluate("forma.worldBox(forma.objects[0]).max.z")-15)<0.01)
    check('rialzo: volume 4000 + 16x16x5',abs(pg.evaluate("forma.soupVolume(forma.worldPositions(forma.objects[0]))")-(4000+16*16*5))<1)
    check('rialzo: pezzo chiuso',pg.evaluate("forma.openEdgeCount(forma.objects[0].geometry)")==0)
    pg.click('#f-mode button[data-v="move"]'); pg.wait_for_timeout(200)
    check('Allunga: Scala il lato visibile',not pg.evaluate("document.querySelector('#f-scale-box').classList.contains('hidden')"))
    check('nessun errore',not errs); print(errs[:3]); b.close()
print('TUTTO OK' if ok else 'ERRORI'); raise SystemExit(0 if ok else 1)
