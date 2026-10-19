# Feedback Reddit: raccordo/smusso tra la parete e un rigonfiamento cilindrico (superficie curva) in cima: prima "al massimo 0.1 mm"
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
        for k,v in [('w',50),('d',1.5),('h',31),('x',0),('y',0),('z',0)]: pg.fill('#p-'+k,str(v)); pg.keyboard.press('Enter')
        pg.evaluate("forma.createObject('cylinder')"); pg.wait_for_timeout(100)
        for k,v in [('w',6),('d',6),('h',50)]: pg.fill('#p-'+k,str(v)); pg.keyboard.press('Enter')
        pg.evaluate("(()=>{const o=forma.objects[1];o.rotation.set(0,Math.PI/2,0);o.position.set(-25,0,31);o.updateMatrixWorld(true);forma.setSelection(forma.objects);forma.combine('union')})()")
        pg.wait_for_function("forma.objects.length===1"); pg.wait_for_timeout(400)
    def fil(pt,r,mode='fillet'):
        pg.evaluate("forma.setTool('move');forma.setTool('edge')"); pg.wait_for_timeout(150)
        pg.evaluate("forma.selectEdgeAt({object:forma.objects[0],point:new forma.THREE.Vector3(%s)},false)"%pt)
        pg.wait_for_timeout(200); n=pg.evaluate("forma.edgeSel().length")
        pg.evaluate("forma.edgeMode.v='%s'"%mode); pg.fill('#e-size',str(r)); pg.click('#e-go'); pg.wait_for_timeout(3500)
        return n,pg.evaluate("document.querySelector('#toast').textContent")
    start(); v0=pg.evaluate(MAN); print('volume',v0, pg.evaluate("forma.objects[0].geometry.attributes.position.count"))
    z=31-(9-0.5625)**0.5
    n,t=fil('0,0.75,%f'%z,1); v1=pg.evaluate(MAN); print(n,t,v1)
    check('raccordo 1 mm sull\'attacco con il cilindro: fatto (%s)'%t,n==1 and 'Arrotondamento di 1' in t and v1>v0)
    n2,t=fil('0,-0.75,%f'%z,1.5); v2=pg.evaluate(MAN); print(n2,t,v2)
    check('raccordo 1,5 mm sull\'altro lato: fatto, chiuso (%s)'%t,'Arrotondamento di 1.5' in t and v2>v1)
    pg.screenshot(path='/tmp/claude-0/-home-claude/855145e8-0c7f-5220-a7bc-901db1b32e0d/scratchpad/curvo.png')
    start(); v0=pg.evaluate(MAN)
    n,t=fil('0,0.75,%f'%z,1,'chamfer'); v1=pg.evaluate(MAN); print(n,t,v1)
    check('smusso 1 mm: fatto (%s)'%t,'Smusso di 1' in t and v1>v0)
    start(); n,t=fil('0,0.75,%f'%z,500); print(t)
    check('raggio 500: ridotto al massimo (%s)'%t,'ridotto a' in t)
    check('nessun errore',not errs); print(errs[:3]); b.close()
print('TUTTO OK' if ok else 'ERRORI'); raise SystemExit(0 if ok else 1)
