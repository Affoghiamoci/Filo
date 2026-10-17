# Spigoli interni (concavi) di un pezzo combinato: si possono scegliere e raccordare/smussare aggiungendo materiale
from playwright.sync_api import sync_playwright
ok=True
def check(name,cond):
    global ok; ok=ok and bool(cond); print('OK ' if cond else 'KO ',name)
VOL="""(()=>{const o=forma.objects[0];o.updateMatrixWorld(true);const g=o.geometry,P=g.attributes.position,I=g.index;let v=0;const n=I?I.count:P.count;const f=i=>I?I.getX(i):i;
for(let t=0;t<n;t+=3){const A=f(t),B=f(t+1),C=f(t+2);const ax=P.getX(A),ay=P.getY(A),az=P.getZ(A),bx=P.getX(B),by=P.getY(B),bz=P.getZ(B),cx=P.getX(C),cy=P.getY(C),cz=P.getZ(C);v+=(ax*(by*cz-bz*cy)-ay*(bx*cz-bz*cx)+az*(bx*cy-by*cx))/6}return v})()"""
with sync_playwright() as p:
    b=p.chromium.launch(args=["--use-gl=swiftshader"]);pg=b.new_page(viewport={'width':1440,'height':900})
    errs=[];pg.on('pageerror',lambda e:errs.append(str(e)))
    pg.goto('file:///tmp/forma/dist/forma.html');pg.wait_for_function("window.forma");pg.wait_for_timeout(900)
    def mk(w,d,h,x):
        pg.evaluate("forma.createObject('box')");pg.wait_for_timeout(120)
        for k,v in [('w',w),('d',d),('h',h),('x',x),('y','0'),('z','0')]: pg.fill('#p-'+k,str(v));pg.keyboard.press('Enter')
    mk(40,20,10,0); mk(20,20,30,-10)
    pg.evaluate("forma.setSelection(forma.objects);forma.combine('union')");pg.wait_for_function("forma.objects.length===1",timeout=60000);pg.wait_for_timeout(300)
    v0=pg.evaluate(VOL); check('L: volume 16000',abs(v0-16000)<1)
    for mode in ['fillet','chamfer']:
        pg.evaluate("forma.setTool('edge')");pg.wait_for_timeout(200)
        pg.evaluate("forma.selectEdgeAt({object:forma.objects[0],point:new forma.THREE.Vector3(0,0,10)},false)");pg.wait_for_timeout(200)
        n=pg.evaluate("forma.edgeSel().length"); conc=pg.evaluate("forma.edgeSel().map(x=>x.chain.concave)")
        check(mode+': spigolo interno selezionabile (%s)'%conc,n==1 and conc==[True])
        pg.evaluate("forma.edgeMode.v='%s'"%mode)
        pg.fill('#e-size','3'); pg.click('#e-go'); pg.wait_for_timeout(600)
        v1=pg.evaluate(VOL)
        exp=16000+(9*(1-3.141592653589793/4) if mode=='fillet' else 4.5)*20
        check(mode+': materiale aggiunto (volume %.1f, atteso %.1f)'%(v1,exp),abs(v1-exp)<1.5)
        check(mode+': sempre un solo pezzo',pg.evaluate("forma.objects.length")==1)
        pg.evaluate("forma.undo()");pg.wait_for_timeout(300)
        check(mode+': ⌘Z ripristina',abs(pg.evaluate(VOL)-16000)<1)
    check('nessun errore',not errs); print('errs',errs); b.close()
print('TUTTO OK' if ok else 'ERRORI'); raise SystemExit(0 if ok else 1)
