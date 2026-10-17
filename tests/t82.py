# Calamita: con ⇧ (asse bloccato) e con le maniglie di ridimensionamento
from playwright.sync_api import sync_playwright
ok=True
def check(name,cond):
    global ok; ok=ok and bool(cond); print('OK ' if cond else 'KO ',name)
with sync_playwright() as p:
    b=p.chromium.launch(args=["--use-gl=swiftshader"]);pg=b.new_page(viewport={'width':1400,'height':850})
    errs=[];pg.on('pageerror',lambda e:errs.append(str(e)))
    pg.goto('file:///tmp/forma/dist/forma.html');pg.wait_for_function("window.forma");pg.wait_for_timeout(900)
    pg.evaluate("forma.setSnap(0)")                      # scatto Libero: l'aggancio può venire solo dalla calamita
    def mk(w,d,h,x):
        pg.evaluate("forma.createObject('box')");pg.wait_for_timeout(120)
        for k,v in [('w',w),('d',d),('h',h),('x',x),('y','0'),('z','0')]: pg.fill('#p-'+k,str(v));pg.keyboard.press('Enter')
    mk(20,20,20,0)      # fisso: x -10..10
    mk(20,20,20,60)     # mobile: x 50..70
    pg.evaluate("forma.setTool('move');forma.fitView()");pg.wait_for_timeout(500)
    scr=lambda v:pg.evaluate("(v=>{const p=new forma.THREE.Vector3(...v).project(forma.camera);const r=forma.canvas.getBoundingClientRect();return [r.left+(p.x*.5+.5)*r.width,r.top+(-p.y*.5+.5)*r.height]})(%s)"%v)
    # ---- ⇧: trascino il blocco mobile verso sinistra, quasi a contatto (lato a x=10 → il suo lato sinistro a x=50 va verso 10)
    pg.evaluate("forma.setSelection([forma.objects[1]])")
    a=scr([60,0,10]); pg.mouse.move(*a); pg.mouse.down()
    mpp=pg.evaluate("(()=>{const a=new forma.THREE.Vector3(0,0,0).project(forma.camera),b=new forma.THREE.Vector3(10,0,0).project(forma.camera);const r=forma.canvas.getBoundingClientRect();return Math.hypot((b.x-a.x)*r.width/2,(b.y-a.y)*r.height/2)/10})()")
    # sposto di 50 mm - 1.5 mm verso sinistra (in pixel lungo X schermo)
    ex=scr([61,0,10]); dx,dy=ex[0]-a[0],ex[1]-a[1]
    G=pg.evaluate("(([px,py])=>{const r=forma.canvas.getBoundingClientRect(),T=forma.THREE,rc=new T.Raycaster();rc.setFromCamera(new T.Vector2((px-r.left)/r.width*2-1,-((py-r.top)/r.height)*2+1),forma.camera);const p=rc.ray.intersectPlane(new T.Plane(new T.Vector3(0,0,1),0),new T.Vector3());return [p.x,p.y]})(%s)"%a);tx=scr([G[0]-39.3,G[1],0]); pg.keyboard.down('Shift')
    pg.mouse.move((a[0]+tx[0])/2,(a[1]+tx[1])/2,steps=4); pg.mouse.move(*tx,steps=4); pg.wait_for_timeout(150)
    x1=pg.evaluate("forma.objects[1].position.x")
    pg.mouse.up(); pg.keyboard.up('Shift'); pg.wait_for_timeout(150)
    check('⇧: la calamita aggancia a contatto (lato a x=10 → centro 20)',abs(x1-20)<0.05)
    pg.evaluate("forma.undo()");pg.wait_for_timeout(200)
    # ---- maniglia: allungo il blocco mobile dal lato sinistro verso il fisso
    pg.evaluate("forma.setSelection([forma.objects[1]])");pg.wait_for_timeout(200)
    h=pg.evaluate("(()=>{const h=forma.HANDLES.find(h=>h.userData.axis==='x'&&h.userData.sign===-1);return h.position.toArray()})()")
    a=scr(h); pg.mouse.move(*a); pg.mouse.down()
    tx=scr([h[0]-39.3,h[1],h[2]])
    pg.mouse.move((a[0]+tx[0])/2,(a[1]+tx[1])/2,steps=4); pg.mouse.move(*tx,steps=4); pg.wait_for_timeout(150)
    bx=pg.evaluate("(()=>{const b=forma.worldBox(forma.objects[1]);return [b.min.x,b.max.x]})()")
    pg.mouse.up(); pg.wait_for_timeout(150)
    check('maniglia: la faccia si aggancia al lato dell\'altro (x=10)',abs(bx[0]-10)<0.05 and abs(bx[1]-70)<0.05)
    # senza calamita: nessun aggancio
    pg.evaluate("forma.undo()");pg.wait_for_timeout(200)
    pg.evaluate("forma.state.magnet=false;forma.setSelection([forma.objects[1]])");pg.wait_for_timeout(200)
    h=pg.evaluate("(()=>{const h=forma.HANDLES.find(h=>h.userData.axis==='x'&&h.userData.sign===-1);return h.position.toArray()})()")
    a=scr(h); pg.mouse.move(*a); pg.mouse.down(); tx=scr([h[0]-39.3,h[1],h[2]])
    pg.mouse.move((a[0]+tx[0])/2,(a[1]+tx[1])/2,steps=4); pg.mouse.move(*tx,steps=4); pg.wait_for_timeout(150)
    bx=pg.evaluate("forma.worldBox(forma.objects[1]).min.x"); pg.mouse.up()
    check('calamita spenta: nessun aggancio',abs(bx-10)>0.2)
    check('nessun errore',not errs); print('errs',errs); b.close()
print('TUTTO OK' if ok else 'ERRORI'); raise SystemExit(0 if ok else 1)
