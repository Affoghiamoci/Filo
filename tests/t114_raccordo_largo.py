# Feedback Reddit: raccordo sotto una sporgenza più stretta del raggio → usciva una pinna sottile. Ora Filo dice il massimo.
# Controlli che i casi normali (blocco su una piastra, L con raccordo grande) funzionino ancora.
from playwright.sync_api import sync_playwright
ok=True
def check(name,cond):
    global ok; ok=ok and bool(cond); print('OK ' if cond else 'KO ',name)
MAN="(()=>{const o=forma.objects[0];const m=forma.MM();const P=o.geometry.attributes.position,I=o.geometry.index;try{const me=new m.Mesh({numProp:3,vertProperties:new Float32Array(P.array),triVerts:new Uint32Array(I?I.array:[...Array(P.count).keys()])});me.merge();const mm=new m.Manifold(me);const s=mm.status();mm.delete();return s=='NoError'&&forma.openEdgeCount(o.geometry)==0}catch(e){return false}})()"
TOAST="document.querySelector('#toast').textContent"
with sync_playwright() as p:
    b=p.chromium.launch(args=["--use-gl=swiftshader"]);pg=b.new_page(viewport={'width':1300,'height':900})
    errs=[];pg.on('pageerror',lambda e:errs.append(str(e)))
    def start(): pg.goto('file:///tmp/forma/dist/forma.html');pg.wait_for_function("window.forma&&forma.MM()");pg.wait_for_timeout(400)
    def mk(d):
        pg.evaluate("forma.createObject('box')"); pg.wait_for_timeout(100)
        for k,v in d: pg.fill('#p-'+k,str(v)); pg.keyboard.press('Enter')
    def union(): pg.evaluate("forma.setSelection(forma.objects);forma.combine('union')"); pg.wait_for_function("forma.objects.length===1"); pg.wait_for_timeout(300)
    def fil(pts,r):
        pg.evaluate("forma.setTool('move');forma.setTool('edge')"); pg.wait_for_timeout(150)
        pg.evaluate("forma.selectEdgeAt({object:forma.objects[0],point:new forma.THREE.Vector3(%s)},false)"%pts[0])
        for q in pts[1:]: pg.evaluate("forma.selectEdgeAt({object:forma.objects[0],point:new forma.THREE.Vector3(%s)},true)"%q)
        pg.wait_for_timeout(150); pg.evaluate("forma.edgeMode.v='fillet'"); pg.fill('#e-size',str(r)); pg.click('#e-go'); pg.wait_for_timeout(2500)
        return pg.evaluate(TOAST)
    # L con sporgenza in cima di 2,5 mm per lato
    start(); mk([('w',50),('d',20),('h',3),('x',0),('y',0),('z',0)]); mk([('w',50),('d',3),('h',31),('x',0),('y',8.5),('z',0)]); mk([('w',50),('d',8),('h',3),('x',0),('y',8.5),('z',28)]); union()
    t=fil(['0,7,3'],5); check('raccordo grande in basso: fatto (%s)'%t,'Arrotondamento' in t and pg.evaluate(MAN))
    n0=pg.evaluate("forma.objects[0].geometry.attributes.position.count")
    pg.evaluate("forma.setTool('move');forma.setTool('edge')"); pg.wait_for_timeout(150)
    pg.evaluate("forma.selectEdgeAt({object:forma.objects[0],point:new forma.THREE.Vector3(0,7,28)},false)"); pg.evaluate("forma.selectEdgeAt({object:forma.objects[0],point:new forma.THREE.Vector3(0,10,28)},true)"); pg.wait_for_timeout(200)
    h=pg.evaluate("document.querySelector('#e-hint').textContent"); check('sotto il campo: massimo (%s)'%h,'2.4' in h)
    t=fil(['0,7,28','0,10,28'],4); check('raggio 4 sotto una sporgenza di 2,5: ridotto a 2,4 e fatto (%s)'%t,'ridotto a 2.4' in t and pg.evaluate(MAN) and pg.input_value('#e-size')=='2.4')
    # scatola parametrica: valore troppo alto → massimo
    start(); mk([('w',20),('d',20),('h',10),('x',0),('y',0),('z',0)])
    t=fil(['0,-10,10'],50); check('scatola, raggio 50: ridotto (%s)'%t,'ridotto a' in t and pg.evaluate(MAN))
    # blocco su una piastra più grande: lo spigolo è più corto della faccia della piastra
    start(); mk([('w',60),('d',60),('h',4),('x',0),('y',0),('z',0)]); mk([('w',20),('d',20),('h',15),('x',0),('y',0),('z',4)]); union()
    t=fil(['0,-10,4'],3); check('blocco su piastra, raccordo 3: fatto (%s)'%t,'Arrotondamento' in t and pg.evaluate(MAN))
    check('nessun errore',not errs); print(errs[:3]); b.close()
print('TUTTO OK' if ok else 'ERRORI'); raise SystemExit(0 if ok else 1)
