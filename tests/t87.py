# Campi numerici "speciali" (popup maniglia, spigolo, spostamento spigolo, faccia, testo): somme e virgola
from playwright.sync_api import sync_playwright
import math
ok=True
def check(name,cond):
    global ok; ok=ok and bool(cond); print('OK ' if cond else 'KO ',name)
VOL="""(()=>{const o=forma.objects[0];o.updateMatrixWorld(true);const g=o.geometry,P=g.attributes.position,I=g.index;let v=0;const n=I?I.count:P.count;const f=i=>I?I.getX(i):i;
for(let t=0;t<n;t+=3){const A=f(t),B=f(t+1),C=f(t+2);const ax=P.getX(A),ay=P.getY(A),az=P.getZ(A),bx=P.getX(B),by=P.getY(B),bz=P.getZ(B),cx=P.getX(C),cy=P.getY(C),cz=P.getZ(C);v+=(ax*(by*cz-bz*cy)-ay*(bx*cz-bz*cx)+az*(bx*cy-by*cx))/6}return v})()"""
with sync_playwright() as p:
    b=p.chromium.launch(args=["--use-gl=swiftshader"]);pg=b.new_page(viewport={'width':1440,'height':900},locale='en-US')
    errs=[];pg.on('pageerror',lambda e:errs.append(str(e)))
    pg.goto('file:///tmp/forma/dist/forma.html');pg.wait_for_function("window.forma");pg.wait_for_timeout(900)
    pg.evaluate("forma.createObject('box')");pg.wait_for_timeout(200)
    for k,v in [('w','40'),('d','20'),('h','10'),('x','0'),('y','0'),('z','0')]: pg.fill('#p-'+k,v);pg.keyboard.press('Enter')
    pg.wait_for_timeout(200)
    S=lambda k:pg.evaluate("forma.sizeOf(forma.objects[0]).%s"%k)
    # 1) popup della maniglia: clic sulla maniglia X+, scrivo "5,5+4,5"
    pg.evaluate("forma.setTool('move')");pg.wait_for_timeout(200)
    pg.evaluate("forma.setSelection([forma.objects[0]])");pg.wait_for_timeout(300)
    h=pg.evaluate("(()=>{const h=forma.HANDLES.find(h=>h.userData.axis==='x'&&h.userData.sign===1);const v=h.position.clone().project(forma.camera);const r=forma.canvas.getBoundingClientRect();return [r.left+(v.x*.5+.5)*r.width,r.top+(-v.y*.5+.5)*r.height]})()")
    pg.mouse.click(h[0],h[1]);pg.wait_for_timeout(700)
    check('un solo clic sulla maniglia non apre il campo',not pg.is_visible('#hpop-val'))
    pg.mouse.dblclick(h[0],h[1]);pg.wait_for_timeout(300)
    vis=pg.is_visible('#hpop-val')
    check('doppio clic: popup maniglia aperto',vis)
    if vis:
        pg.keyboard.type('5,5+4,5');pg.keyboard.press('Enter');pg.wait_for_timeout(300)
        check('maniglia: 5,5+4,5 → +10 (larghezza %s)'%S('w'),abs(S('w')-50)<1e-6)
    # 2) spigolo convesso: raccordo con somma e virgola + Invio
    pg.evaluate("forma.setTool('edge')");pg.wait_for_timeout(300)
    bx=pg.evaluate("(()=>{const b=forma.worldBox(forma.objects[0]);return [b.min.x,b.min.y,b.min.z,b.max.x,b.max.y,b.max.z]})()")
    pg.evaluate("forma.selectEdgeAt({object:forma.objects[0],point:new forma.THREE.Vector3(%f,%f,%f)},false)"%(bx[0],(bx[1]+bx[4])/2,bx[5]))
    pg.wait_for_timeout(250)
    n=pg.evaluate("forma.edgeSel().length");check('spigolo selezionato (%d)'%n,n==1)
    if n==1:
        v0=pg.evaluate(VOL);L=bx[4]-bx[1]
        pg.evaluate("forma.edgeMode.v='fillet'")
        pg.fill('#e-size','1+1,5');pg.press('#e-size','Enter');pg.wait_for_timeout(700)
        v1=pg.evaluate(VOL);exp=v0-(1-math.pi/4)*2.5*2.5*L
        check('spigolo: 1+1,5 + Invio → raccordo 2.5 (volume %.1f atteso %.1f)'%(v1,exp),abs(v1-exp)<1.5)
        # 3) sposta spigolo: campo mm con somma
        pg.evaluate("forma.undo()");pg.wait_for_timeout(300)
        if pg.evaluate("forma.edgeSel().length")==0:   # Annulla riporta già lo spigolo selezionato
            pg.evaluate("forma.selectEdgeAt({object:forma.objects[0],point:new forma.THREE.Vector3(%f,%f,%f)},false)"%(bx[0],(bx[1]+bx[4])/2,bx[5]))
        pg.wait_for_timeout(250)
        if pg.is_visible('#e-mv'):
            pg.fill('#e-mv','1+1,5');pg.press('#e-mv','Enter');pg.wait_for_timeout(700)
            check('sposta spigolo: 1+1,5 + Invio ha modificato il pezzo',abs(pg.evaluate(VOL)-v0)>0.5)
        else: print('campo e-mv non visibile (saltato)')
    # 4) strumento Testo: campi misura
    pg.evaluate("forma.setTool('text')");pg.wait_for_timeout(400)
    if pg.is_visible('#t-size'):
        pg.fill('#t-text','Ciao');pg.wait_for_timeout(500)
        for id,typ,exp in [('t-size','10+5,5','15.5'),('t-depth','1+1','2'),('t-space','0,5+0,5','1')]:
            pg.fill('#'+id,typ);pg.press('#'+id,'Tab');pg.wait_for_timeout(250)
            check('testo %s: %s → %s (letto %s)'%(id,typ,exp,pg.input_value('#'+id)),pg.input_value('#'+id)==exp)
    check('nessun errore',not errs); print('errs',errs); b.close()
print('TUTTO OK' if ok else 'ERRORI'); raise SystemExit(0 if ok else 1)
