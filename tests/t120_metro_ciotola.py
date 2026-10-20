# Metro su una ciotola tonda: l'interno è un pezzo unico (anche vicino al bordo), con diametro, raggio e profondità; bordo tondo con Ø
from playwright.sync_api import sync_playwright
ok=True
def check(name,cond):
    global ok; ok=ok and bool(cond); print('OK ' if cond else 'KO ',name)
with sync_playwright() as p:
    b=p.chromium.launch(args=["--use-gl=swiftshader"]);pg=b.new_page(viewport={'width':1300,'height':900})
    errs=[];pg.on('pageerror',lambda e:errs.append(str(e)))
    pg.goto('file:///tmp/forma/dist/forma.html');pg.wait_for_function("window.forma&&forma.MM()");pg.wait_for_timeout(400)
    def setd(vals):
        for k,v in vals: pg.fill('#p-'+k,str(v)); pg.keyboard.press('Enter')
    pg.evaluate("forma.createObject('box')"); pg.wait_for_timeout(80); setd([('w',60),('d',60),('h',30),('x',0),('y',0),('z',0)])
    pg.evaluate("forma.createObject('sphere')"); pg.wait_for_timeout(80); setd([('w',50),('d',50),('h',50),('x',0),('y',0),('z',9)])
    pg.evaluate("(()=>{forma.objects[1].userData.hole=true;forma.setSelection(forma.objects);forma.combine('union')})()"); pg.wait_for_function("forma.objects.length===1"); pg.wait_for_timeout(600)
    r=pg.evaluate("""(()=>{const o=forma.objects[0];const g=o.geometry,P=g.attributes.position,I=g.index;const nT=(I?I.count:P.count)/3;const T=forma.THREE;
      const c=new T.Vector3(0,0,34);const A=new T.Vector3(),B=new T.Vector3(),C=new T.Vector3();const inner=[];
      for(let t=0;t<nT;t++){const ia=I?I.getX(t*3):t*3,ib=I?I.getX(t*3+1):t*3+1,ic=I?I.getX(t*3+2):t*3+2;A.fromBufferAttribute(P,ia);B.fromBufferAttribute(P,ib);C.fromBufferAttribute(P,ic);
        const m=A.clone().add(B).add(C).divideScalar(3);const n=B.clone().sub(A).cross(C.clone().sub(A)).normalize();const r=m.distanceTo(c);
        if(r>18&&r<25.5&&m.z<29.99&&n.dot(c.clone().sub(m).normalize())>0.5)inner.push(t)}
      const out=[];for(const k of [0.1,0.5,0.9]){const fs=forma.computeFace(o,inner[Math.floor(inner.length*k)]);out.push({n:fs.triSet.size,conc:fs.concave,R:fs.fit&&fs.fit.R,kind:fs.fit&&fs.fit.kind})}
      return {inner:inner.length,out}})()""")
    print(r)
    check('qualunque punto dell\'interno prende tutta la ciotola',all(o['n']>=r['inner'] for o in r['out']))
    check('concava e sfera di raggio 25',all(o['conc'] and o['kind']=='sphere' and abs(o['R']-25)<0.1 for o in r['out']))
    # ⌥ sull'interno: righe con diametro e profondità
    pg.evaluate("forma.setSelection([]);forma.setTool('ruler')"); pg.wait_for_timeout(300)
    pg.evaluate("(()=>{const c=forma.cam;c.az=135;c.el=50;c.dist=120;c.target.set(0,0,18)})()")
    pg.mouse.move(900,700); pg.mouse.down(); pg.mouse.move(906,700,steps=3); pg.mouse.up(); pg.wait_for_timeout(400)
    pg.keyboard.down('Alt'); pg.mouse.move(520,470); pg.wait_for_timeout(600)
    t=pg.evaluate("(()=>{const t=document.querySelector('.alt-tip');return t?t.innerText:''})()"); print(t.replace('\n',' | '))
    pg.keyboard.up('Alt')
    check('tip: diametro interno 50, raggio 25, profondità 21','Ø 50 mm' in t and '25 mm' in t and '21 mm' in t)
    # bordo tondo: Ø
    pg.mouse.move(331,383); pg.wait_for_timeout(600)
    t2=pg.evaluate("(()=>{const t=document.querySelector('.alt-tip');return t?t.innerText:''})()"); print(t2.replace('\n',' | '))
    check('bordo tondo: Ø e raggio','Ø' in t2 and 'BORDO TONDO' in t2.upper())
    # due clic sull'interno: niente "lati paralleli", raggio nella nota
    pg.mouse.click(520,470); pg.wait_for_timeout(200); pg.mouse.click(780,440); pg.wait_for_timeout(400)
    card=pg.evaluate("(()=>{const c=document.querySelector('#ruler-card, .ruler-card');return c?c.innerText:''})()"); print(card.replace('\n',' | '))
    check('due punti sulla ciotola: linea retta con raggio',('Linea retta' in card) and ('raggio' in card.lower()))
    check('nessun errore',not errs); print(errs[:3]); b.close()
print('TUTTO OK' if ok else 'ERRORI'); raise SystemExit(0 if ok else 1)
