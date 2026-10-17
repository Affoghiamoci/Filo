# Doppio clic sulle maniglie (Sposta, Lato, Spigolo: spostamento e scala): campo per scrivere la misura
from playwright.sync_api import sync_playwright
ok=True
def check(name,cond):
    global ok; ok=ok and bool(cond); print('OK ' if cond else 'KO ',name)
VOL="""(()=>{const o=forma.objects[0];o.updateMatrixWorld(true);const g=o.geometry,P=g.attributes.position,I=g.index;let v=0;const n=I?I.count:P.count;const f=i=>I?I.getX(i):i;
for(let t=0;t<n;t+=3){const A=f(t),B=f(t+1),C=f(t+2);const ax=P.getX(A),ay=P.getY(A),az=P.getZ(A),bx=P.getX(B),by=P.getY(B),bz=P.getZ(B),cx=P.getX(C),cy=P.getY(C),cz=P.getZ(C);v+=(ax*(by*cz-bz*cy)-ay*(bx*cz-bz*cx)+az*(bx*cy-by*cx))/6}return v})()"""
TOP="""(()=>{const o=forma.objects[0];o.updateMatrixWorld(true);const P=o.geometry.attributes.position,I=o.geometry.index;const n=(I?I.count:P.count)/3;const f=i=>I?I.getX(i):i;let best=-1,bz=-1e9;
for(let t=0;t<n;t++){const V=[0,1,2].map(j=>new forma.THREE.Vector3().fromBufferAttribute(P,f(t*3+j)).applyMatrix4(o.matrixWorld));if(V.every(v=>Math.abs(v.z-V[0].z)<1e-4)&&V[0].z>bz){bz=V[0].z;best=t}}return best})()"""
def scr(pg,expr):   # posizione a schermo di un punto 3D
    return pg.evaluate("(()=>{const v=(%s).clone().project(forma.camera);const r=forma.canvas.getBoundingClientRect();return [r.left+(v.x*.5+.5)*r.width,r.top+(-v.y*.5+.5)*r.height]})()"%expr)
def fresh(pg):
    pg.reload();pg.wait_for_function("window.forma");pg.wait_for_timeout(800)
    pg.evaluate("forma.createObject('box')");pg.wait_for_timeout(250)
    for k,v in [('w','30'),('d','30'),('h','30'),('x','0'),('y','0'),('z','0')]: pg.fill('#p-'+k,v);pg.keyboard.press('Enter')
    pg.wait_for_timeout(200)
with sync_playwright() as p:
    b=p.chromium.launch(args=["--use-gl=swiftshader"]);pg=b.new_page(viewport={'width':1440,'height':900})
    errs=[];pg.on('pageerror',lambda e:errs.append(str(e)))
    pg.goto('file:///tmp/forma/dist/forma.html');pg.wait_for_function("window.forma");pg.wait_for_timeout(900)
    # Lato
    fresh(pg); pg.evaluate("forma.setTool('face')");pg.wait_for_timeout(250)
    pg.evaluate("([t])=>forma.selectFaceFromHit({object:forma.objects[0],faceIndex:t},false)",[pg.evaluate(TOP)]);pg.wait_for_timeout(300)
    c=scr(pg,"(()=>{const w=forma.faceSel.world;let x=0,y=0,z=0,n=0;for(let i=0;i<w.length;i+=3){x+=w[i];y+=w[i+1];z+=w[i+2];n++}return new forma.THREE.Vector3(x/n,y/n,z/n)})()")
    pg.mouse.click(c[0],c[1]);pg.wait_for_timeout(700)
    check('Lato: un clic non apre il campo (%s)'%pg.is_visible('#hpop-val'),not pg.is_visible('#hpop-val'))
    pg.mouse.dblclick(c[0],c[1]);pg.wait_for_timeout(300)
    check('Lato: doppio clic apre il campo',pg.is_visible('#hpop-val'))
    check('Lato: etichetta "sposta di" e unità mm',pg.text_content('#hpop-lbl')=='sposta di' and pg.text_content('#hpop-unit')=='mm')
    pg.keyboard.type('2+2');pg.keyboard.press('Enter');pg.wait_for_timeout(1500)
    check('Lato: 2+2 → altezza 34 (%s)'%pg.evaluate("forma.sizeOf(forma.objects[0]).h"),abs(pg.evaluate("forma.sizeOf(forma.objects[0]).h")-34)<0.01)
    # Spigolo: sposta
    fresh(pg); pg.evaluate("forma.setTool('edge')");pg.wait_for_timeout(300)
    bx=pg.evaluate("(()=>{const b=forma.worldBox(forma.objects[0]);return [b.min.x,b.min.y,b.min.z,b.max.x,b.max.y,b.max.z]})()")
    pg.evaluate("forma.selectEdgeAt({object:forma.objects[0],point:new forma.THREE.Vector3(%f,%f,%f)},false)"%(bx[0],(bx[1]+bx[4])/2,bx[5]));pg.wait_for_timeout(300)
    vis=pg.evaluate("forma.moveHandle.visible")
    check('Spigolo: maniglia di spostamento visibile',vis)
    if vis:
        v0=pg.evaluate(VOL); c=scr(pg,"forma.moveHandle.position")
        pg.mouse.click(c[0],c[1]);pg.wait_for_timeout(700)
        check('Spigolo (sposta): un clic non apre il campo',not pg.is_visible('#hpop-val'))
        c=scr(pg,"forma.moveHandle.position"); pg.mouse.dblclick(c[0],c[1]);pg.wait_for_timeout(300)
        check('Spigolo (sposta): doppio clic apre il campo',pg.is_visible('#hpop-val'))
        pg.keyboard.type('1+1');pg.keyboard.press('Enter');pg.wait_for_timeout(1500)
        check('Spigolo (sposta): il pezzo è cambiato (%.0f → %.0f)'%(v0,pg.evaluate(VOL)),abs(pg.evaluate(VOL)-v0)>1)
    # Spigolo: scala dell'anello
    fresh(pg); pg.evaluate("forma.setTool('edge')");pg.wait_for_timeout(300)
    bx=pg.evaluate("(()=>{const b=forma.worldBox(forma.objects[0]);return [b.min.x,b.min.y,b.min.z,b.max.x,b.max.y,b.max.z]})()")
    cx=(bx[0]+bx[3])/2;cy=(bx[1]+bx[4])/2
    for i,(x,y,z) in enumerate([(cx,bx[1],bx[5]),(cx,bx[4],bx[5]),(bx[0],cy,bx[5]),(bx[3],cy,bx[5])]):
        pg.evaluate("forma.selectEdgeAt({object:forma.objects[0],point:new forma.THREE.Vector3(%f,%f,%f)},%s)"%(x,y,z,'true' if i else 'false'));pg.wait_for_timeout(150)
    vis=pg.evaluate("forma.edgeHandle.visible"); check('Anello: maniglia di scala visibile',vis)
    if vis:
        c=scr(pg,"forma.edgeHandle.position"); pg.mouse.dblclick(c[0],c[1]);pg.wait_for_timeout(300)
        check('Anello: doppio clic apre il campo in %',pg.is_visible('#hpop-val') and pg.text_content('#hpop-unit')=='%')
        pg.keyboard.type('25+25');pg.keyboard.press('Enter');pg.wait_for_timeout(1800)
        check('Anello: 25+25 → 50 %% (volume %.0f, atteso 15750)'%pg.evaluate(VOL),abs(pg.evaluate(VOL)-15750)<80)
    check('nessun errore',not errs); print('errs',errs); b.close()
print('TUTTO OK' if ok else 'ERRORI'); raise SystemExit(0 if ok else 1)
