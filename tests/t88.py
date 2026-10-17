# Testo e spinta faccia: somme e virgola
from playwright.sync_api import sync_playwright
import math
ok=True
def check(name,cond):
    global ok; ok=ok and bool(cond); print('OK ' if cond else 'KO ',name)
with sync_playwright() as p:
    b=p.chromium.launch(args=["--use-gl=swiftshader"]);pg=b.new_page(viewport={'width':1440,'height':900},locale='en-US')
    errs=[];pg.on('pageerror',lambda e:errs.append(str(e)))
    pg.goto('file:///tmp/forma/dist/forma.html');pg.wait_for_timeout(700)
    pg.click('[data-eh=text]');pg.wait_for_timeout(700)
    check('pannello testo visibile',pg.is_visible('#t-size'))
    for id,typ,exp in [('t-size','10+5,5','15.5'),('t-depth','1+1','2'),('t-space','0,5+0,5','1')]:
        pg.click('#'+id);pg.keyboard.press('Control+A');pg.keyboard.type(typ);pg.keyboard.press('Enter');pg.wait_for_timeout(500)
        check('testo %s: %s → %s (letto %s)'%(id,typ,exp,pg.input_value('#'+id)),pg.input_value('#'+id)==exp)
    # faccia: spinta con somma
    pg.reload();pg.wait_for_function("window.forma");pg.wait_for_timeout(700)
    pg.evaluate("forma.createObject('box')");pg.wait_for_timeout(200)
    for k,v in [('w','20'),('d','20'),('h','20'),('x','0'),('y','0'),('z','0')]: pg.fill('#p-'+k,v);pg.keyboard.press('Enter')
    pg.evaluate("forma.setTool('face')");pg.wait_for_timeout(300)
    bx=pg.evaluate("(()=>{const b=forma.worldBox(forma.objects[0]);return [b.min.x,b.min.y,b.min.z,b.max.x,b.max.y,b.max.z]})()")
    H0=pg.evaluate("forma.sizeOf(forma.objects[0]).h")
    pg.evaluate("""(()=>{const o=forma.objects[0];o.updateMatrixWorld(true);const g=o.geometry,P=g.attributes.position,I=g.index;const n=(I?I.count:P.count)/3;const f=i=>I?I.getX(i):i;let best=-1,bz=-1e9;
for(let t=0;t<n;t++){const A=f(t*3),B=f(t*3+1),C=f(t*3+2);const z=[A,B,C].map(i=>P.getZ(i));if(Math.abs(z[0]-z[1])<1e-6&&Math.abs(z[1]-z[2])<1e-6&&z[0]>bz){bz=z[0];best=t}}
forma.selectFaceFromHit({object:o,faceIndex:best},false)})()""")
    pg.wait_for_timeout(300)
    if pg.is_visible('#f-push'):
        pg.click('#f-push');pg.keyboard.press('Control+A');pg.keyboard.type('2+1,5');pg.keyboard.press('Enter');pg.wait_for_timeout(700)
        H1=pg.evaluate("forma.sizeOf(forma.objects[0]).h")
        check('faccia: spinta 2+1,5 → +3.5 (h %s→%s)'%(H0,H1),abs(H1-H0-3.5)<1e-3)
    else: print('f-push non visibile: faccia non selezionata (',pg.evaluate("forma.faceSel&&1"),')')
    check('nessun errore',not errs); print('errs',errs); b.close()
print('TUTTO OK' if ok else 'ERRORI'); raise SystemExit(0 if ok else 1)
