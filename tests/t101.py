# I numeri nei campi sono valori veri: premendo Applica senza scrivere si usa quello che si vede
from playwright.sync_api import sync_playwright
import math
ok=True
def check(name,cond):
    global ok; ok=ok and bool(cond); print('OK ' if cond else 'KO ',name)
VOL="""(()=>{const o=forma.objects[0];o.updateMatrixWorld(true);const g=o.geometry,P=g.attributes.position,I=g.index;let v=0;const n=I?I.count:P.count;const f=i=>I?I.getX(i):i;for(let t=0;t<n;t+=3){const A=f(t),B=f(t+1),C=f(t+2);const ax=P.getX(A),ay=P.getY(A),az=P.getZ(A),bx=P.getX(B),by=P.getY(B),bz=P.getZ(B),cx=P.getX(C),cy=P.getY(C),cz=P.getZ(C);v+=(ax*(by*cz-bz*cy)-ay*(bx*cz-bz*cx)+az*(bx*cy-by*cx))/6}return v})()"""
with sync_playwright() as p:
    b=p.chromium.launch(args=["--use-gl=swiftshader"]);pg=b.new_page(viewport={'width':1300,'height':900})
    errs=[];pg.on('pageerror',lambda e:errs.append(str(e)))
    pg.goto('file:///tmp/forma/dist/forma.html');pg.wait_for_function("window.forma");pg.wait_for_timeout(900)
    for id_,v in [('f-push','0'),('f-scale','100'),('e-size','2'),('e-mv','5'),('e-scale','100'),('f-taper','100')]:
        check('%s mostra %s come valore vero'%(id_,v),pg.input_value('#'+id_)==v)
    # pezzo a L: raccordo dello spigolo interno premendo solo Applica → 2 mm
    def mk(d):
        pg.evaluate("forma.createObject('box')");pg.wait_for_timeout(150)
        for k,v in d.items(): pg.fill('#p-'+k,str(v));pg.keyboard.press('Enter')
    mk({'w':40,'d':20,'h':10,'x':0,'y':0,'z':0}); mk({'w':20,'d':20,'h':30,'x':-10,'y':0,'z':0})
    pg.evaluate("forma.setSelection(forma.objects);forma.combine('union')");pg.wait_for_function("forma.objects.length===1",timeout=60000);pg.wait_for_timeout(300)
    pg.evaluate("forma.setTool('edge')");pg.wait_for_timeout(200)
    pg.evaluate("forma.selectEdgeAt({object:forma.objects[0],point:new forma.THREE.Vector3(0,0,10)},false)");pg.wait_for_timeout(200)
    pg.evaluate("forma.edgeMode.v='fillet'"); v0=pg.evaluate(VOL)
    shown=pg.input_value('#e-size'); pg.click('#e-go'); pg.wait_for_timeout(1500)
    add=pg.evaluate(VOL)-v0
    check('raccordo con il valore mostrato (%s mm): aggiunti %.2f mm³ (≈ %.2f)'%(shown,add,4*(1-math.pi/4)*20),shown=='2' and abs(add-4*(1-math.pi/4)*20)<0.3)
    check('dopo Applica il campo resta a 2',pg.input_value('#e-size')=='2')
    check('nessun errore',not errs); print('errs',errs); b.close()
print('TUTTO OK' if ok else 'ERRORI'); raise SystemExit(0 if ok else 1)
