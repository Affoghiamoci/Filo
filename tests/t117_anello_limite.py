# Feedback: raccordo su un anello chiuso (fondo interno di una vaschetta) senza limite: il pezzo si deformava. Ora si riduce al massimo possibile
from playwright.sync_api import sync_playwright
ok=True
def check(name,cond):
    global ok; ok=ok and bool(cond); print('OK ' if cond else 'KO ',name)
MAN="(()=>{const o=forma.objects[0];const m=forma.MM();const P=o.geometry.attributes.position,I=o.geometry.index;try{const me=new m.Mesh({numProp:3,vertProperties:new Float32Array(P.array),triVerts:new Uint32Array(I?I.array:[...Array(P.count).keys()])});me.merge();const mm=new m.Manifold(me);const s=mm.status();const v=mm.volume();mm.delete();return s=='NoError'&&forma.openEdgeCount(o.geometry)==0?v:-1}catch(e){return -1}})()"
with sync_playwright() as p:
    b=p.chromium.launch(args=["--use-gl=swiftshader"]);pg=b.new_page(viewport={'width':1300,'height':900})
    errs=[];pg.on('pageerror',lambda e:errs.append(str(e)))
    def start():
        pg.goto('file:///tmp/forma/dist/forma.html');pg.wait_for_function("window.forma&&forma.MM()");pg.wait_for_timeout(400)
        pg.evaluate("forma.createObject('box')"); pg.wait_for_timeout(100)
        for k,v in [('w',80),('d',80),('h',18),('x',0),('y',0),('z',0)]: pg.fill('#p-'+k,str(v)); pg.keyboard.press('Enter')
        pg.evaluate("forma.createObject('cylinder')"); pg.wait_for_timeout(100)
        for k,v in [('w',60),('d',60),('h',12),('x',0),('y',0),('z',6)]: pg.fill('#p-'+k,str(v)); pg.keyboard.press('Enter')
        pg.evaluate("(()=>{forma.objects[1].userData.hole=true;forma.setSelection(forma.objects);forma.combine('union')})()")
        pg.wait_for_function("forma.objects.length===1"); pg.wait_for_timeout(500)
    def fil(r,mode='fillet'):
        pg.evaluate("forma.setTool('move');forma.setTool('edge')"); pg.wait_for_timeout(150)
        pg.evaluate("forma.selectEdgeAt({object:forma.objects[0],point:new forma.THREE.Vector3(30,0,6)},false)"); pg.wait_for_timeout(300)
        n=pg.evaluate("forma.edgeSel().length")
        pg.evaluate("forma.edgeMode.v='%s'"%mode); pg.fill('#e-size',str(r)); pg.click('#e-go'); pg.wait_for_timeout(4000)
        return n,pg.evaluate("document.querySelector('#toast').textContent"),pg.evaluate("forma.worldBox(forma.objects[0]).max.z")
    start(); v0=pg.evaluate(MAN); print('volume',v0)
    n,t,z=fil(3); v1=pg.evaluate(MAN); print(n,t,z,v1)
    check('raccordo 3 mm sul fondo interno: fatto e chiuso (%s)'%t,'Arrotondamento di 3' in t and v1>v0 and abs(z-18)<0.01)
    start(); n,t,z=fil(100); v2=pg.evaluate(MAN); print(n,t,z,v2)
    check('raccordo 100 mm: ridotto al massimo (%s)'%t,'ridotto a' in t)
    check('il pezzo non si deforma: altezza uguale, volume positivo e maggiore',abs(z-18)<0.01 and v2>v0 and v2<v0*1.5)
    start(); n,t,z=fil(100,'chamfer'); v3=pg.evaluate(MAN); print(n,t,z,v3)
    check('smusso 100 mm: ridotto al massimo (%s)'%t,'ridotto a' in t and abs(z-18)<0.01 and v3>v0)
    check('nessun errore',not errs); print(errs[:3]); b.close()
print('TUTTO OK' if ok else 'ERRORI'); raise SystemExit(0 if ok else 1)
