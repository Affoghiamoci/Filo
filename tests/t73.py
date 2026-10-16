# Combina con molti pezzi: un solo calcolo di Manifold, stesso risultato del metodo a coppie
from playwright.sync_api import sync_playwright
ok=True
def check(name,cond):
    global ok; ok=ok and bool(cond); print('OK ' if cond else 'KO ',name)
VOL="""(()=>{const o=forma.objects[0];o.updateMatrixWorld(true);const g=o.geometry,P=g.attributes.position,I=g.index;let v=0;const n=I?I.count:P.count;const f=i=>I?I.getX(i):i;
for(let t=0;t<n;t+=3){const A=f(t),B=f(t+1),C=f(t+2);const ax=P.getX(A),ay=P.getY(A),az=P.getZ(A),bx=P.getX(B),by=P.getY(B),bz=P.getZ(B),cx=P.getX(C),cy=P.getY(C),cz=P.getZ(C);v+=(ax*(by*cz-bz*cy)-ay*(bx*cz-bz*cx)+az*(bx*cy-by*cx))/6}return v})()"""
with sync_playwright() as p:
    b=p.chromium.launch(args=["--use-gl=swiftshader"])
    ctx=b.new_context(viewport={'width':1440,'height':900}); errs=[]
    pg=ctx.new_page(); pg.on('pageerror',lambda e:errs.append(str(e)))
    pg.goto('file:///tmp/forma/dist/forma.html');pg.wait_for_function("window.forma");pg.wait_for_timeout(800)
    def scene():
        pg.evaluate("forma.setSelection(forma.objects);forma.objects.slice().forEach(o=>{})")
    def build():
        pg.evaluate("forma.createObject('box')");pg.wait_for_timeout(150)
        for k,v in [('w','60'),('d','40'),('h','4'),('x','0'),('y','0')]: pg.fill('#p-'+k,v);pg.keyboard.press('Enter')
        pg.evaluate("forma.createObject('cylinder')");pg.wait_for_timeout(150)
        for k,v in [('w','5'),('d','5'),('h','12'),('x','0'),('y','0'),('z','-4')]: pg.fill('#p-'+k,v);pg.keyboard.press('Enter')
        pg.evaluate("forma.toggleHole()");pg.wait_for_timeout(100)
        pg.fill('#rp-nx','5');pg.fill('#rp-ny','3');pg.fill('#rp-px','7');pg.fill('#rp-py','7');pg.wait_for_timeout(150)
        pg.click('#rp-go');pg.wait_for_timeout(600)
    build()
    n=pg.evaluate("forma.objects.length");check('piastra + 15 fori',n==16 and pg.evaluate("forma.objects.filter(o=>o.userData.hole).length")==15)
    pg.evaluate("forma.setSelection(forma.objects)")
    pg.evaluate("forma.combine('union')");pg.wait_for_function("forma.objects.length===1",timeout=120000);pg.wait_for_timeout(300)
    v1=pg.evaluate(VOL);check('un solo pezzo dopo Combina',pg.evaluate("forma.objects.length")==1)
    check('motore: Manifold',pg.evaluate("forma.evaluator&&0")!=1)
    # stesso lavoro con il metodo a coppie (Manifold a due a due)
    pg.evaluate("forma.undo()");pg.wait_for_timeout(500)
    pg.evaluate("forma.setSelection(forma.objects);window.__pairwise=true")
    pg.evaluate("forma.combine('union')");pg.wait_for_function("forma.objects.length===1",timeout=300000);pg.wait_for_timeout(300)
    v2=pg.evaluate(VOL)
    print('volumi',round(v1,3),round(v2,3))
    check('stesso volume tra un calcolo solo e metodo a coppie (0,05 %)',abs(v1-v2)/abs(v2)<0.0005)
    # volume atteso: piastra 60x40x4 meno 15 cilindri di 5 mm (approssimati da poligoni): vicino al teorico
    import math
    check('volume vicino al teorico',abs(v1-(60*40*4-15*math.pi*2.5**2*4))/(60*40*4)<0.01)
    # tre solidi sovrapposti
    pg.evaluate("forma.objects.slice().forEach(o=>{});location.reload()");pg.wait_for_function("window.forma");pg.wait_for_timeout(500)
    pg.evaluate("forma.createObject('box');forma.createObject('box');forma.createObject('box')");pg.wait_for_timeout(200)
    pg.evaluate("(()=>{const w=forma.worldBox(forma.objects[0]).getSize(new forma.THREE.Vector3()).x;forma.objects.forEach((o,i)=>{o.position.set(i*w*0.3,0,o.position.z);o.updateMatrixWorld(true)})})()")
    pg.evaluate("forma.setSelection(forma.objects)")
    exp=pg.evaluate("(()=>{const bb=new forma.THREE.Box3();forma.objects.forEach(o=>bb.union(forma.worldBox(o)));const s=bb.getSize(new forma.THREE.Vector3());return s.x*s.y*s.z})()")
    pg.evaluate("forma.combine('union')");pg.wait_for_function("forma.objects.length===1",timeout=120000);pg.wait_for_timeout(300)
    v3=pg.evaluate(VOL);check('tre solidi sovrapposti: volume della loro unione',abs(v3-exp)/exp<0.001)
    pg.evaluate("location.reload()");pg.wait_for_function("window.forma");pg.wait_for_timeout(500)
    pg.evaluate("forma.createObject('box');forma.createObject('box');forma.createObject('box')");pg.wait_for_timeout(200)
    pg.evaluate("(()=>{const w=forma.worldBox(forma.objects[0]).getSize(new forma.THREE.Vector3()).x;forma.objects.forEach((o,i)=>{o.position.set(i*w*0.3,0,o.position.z);o.updateMatrixWorld(true)})})()")
    pg.evaluate("forma.setSelection(forma.objects)")
    pg.evaluate("forma.intersect()");pg.wait_for_function("forma.objects.length===1",timeout=120000);pg.wait_for_timeout(300)
    vi=pg.evaluate(VOL);check('Interseca di tre solidi: resta la parte comune (volume 7200)',abs(vi-7200)<1)
    check('nessun errore di pagina',not errs)
    if errs: print(errs)
    b.close()
print('TUTTO OK' if ok else 'CI SONO ERRORI')
