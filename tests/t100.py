# Allunga segue le linee del pezzo (mai un'estrusione): esagono fino a dove il lato sparisce, cima di un tronco che prosegue la piramide
from playwright.sync_api import sync_playwright
ok=True
def check(name,cond):
    global ok; ok=ok and bool(cond); print('OK ' if cond else 'KO ',name)
SIDE="""((want)=>{const o=forma.objects[0];o.updateMatrixWorld(true);const P=o.geometry.attributes.position,I=o.geometry.index;const n=(I?I.count:P.count)/3;const f=i=>I?I.getX(i):i;let best=-1,bd=-2;for(let t=0;t<n;t++){const [a,b,c]=[0,1,2].map(j=>new forma.THREE.Vector3().fromBufferAttribute(P,f(t*3+j)).applyMatrix4(o.matrixWorld));const nn=b.clone().sub(a).cross(c.clone().sub(a)).normalize();const d=nn.x*want[0]+nn.y*want[1]+nn.z*want[2];if(d>bd){bd=d;best=t}}return best})"""
VOL="""(()=>{const o=forma.objects[0];o.updateMatrixWorld(true);const g=o.geometry,P=g.attributes.position,I=g.index;let v=0;const n=I?I.count:P.count;const f=i=>I?I.getX(i):i;for(let t=0;t<n;t+=3){const A=f(t),B=f(t+1),C=f(t+2);const ax=P.getX(A),ay=P.getY(A),az=P.getZ(A),bx=P.getX(B),by=P.getY(B),bz=P.getZ(B),cx=P.getX(C),cy=P.getY(C),cz=P.getZ(C);v+=(ax*(by*cz-bz*cy)-ay*(bx*cz-bz*cx)+az*(bx*cy-by*cx))/6}return v})()"""
TOAST="document.querySelector('#toast')?.textContent||''"
def pick(pg,want):
    pg.evaluate("forma.setTool('face')");pg.wait_for_timeout(200)
    pg.evaluate("([t])=>forma.selectFaceFromHit({object:forma.objects[0],faceIndex:t},false)",[pg.evaluate(SIDE+"(%s)"%want)]);pg.wait_for_timeout(250)
def push(pg,mode,dist,taper=None):
    pg.click('#f-mode [data-v=%s]'%mode)
    if taper is not None: pg.fill('#f-taper',str(taper))
    pg.fill('#f-push',str(dist));pg.press('#f-push','Enter');pg.wait_for_timeout(1500)
with sync_playwright() as p:
    b=p.chromium.launch(args=["--use-gl=swiftshader"]);pg=b.new_page(viewport={'width':1200,'height':900})
    errs=[];pg.on('pageerror',lambda e:errs.append(str(e)))
    pg.goto('file:///tmp/forma/dist/forma.html');pg.wait_for_function("window.forma");pg.wait_for_timeout(900)
    def fresh(kind):
        pg.reload();pg.wait_for_function("window.forma");pg.wait_for_timeout(600)
        pg.evaluate("forma.createObject('%s')"%kind);pg.wait_for_timeout(300)
    # esagono (lato 10): fino a 5√3 = 8.66 mm Allunga, oltre avviso e pezzo invariato
    fresh('prism'); v0=pg.evaluate(VOL); pick(pg,'[0.866,0.5,0]'); push(pg,'move',8)
    check('esagono Allunga 8: lato tirato (%s)'%pg.evaluate(TOAST),'tirato' in pg.evaluate(TOAST) and pg.evaluate(VOL)>v0)
    fresh('prism'); v0=pg.evaluate(VOL); pick(pg,'[0.866,0.5,0]'); push(pg,'move',15)
    t=pg.evaluate(TOAST)
    check('esagono Allunga 15: avviso con la misura massima 8.66 (%s)'%t,'8.66' in t and 'sparisce' in t)
    check("esagono Allunga 15: il pezzo non diventa un'estrusione (volume invariato)",abs(pg.evaluate(VOL)-v0)<0.01)
    fresh('prism'); v0=pg.evaluate(VOL); pick(pg,'[0.866,0.5,0]'); push(pg,'extrude',15,'')
    check('esagono Estrudi 15: blocco dritto (10×20×15 = +3000)',abs(pg.evaluate(VOL)-v0-3000)<1)
    # tronco di piramide (cubo 30 con la cima al 50 %): Allunga la cima di 10 prosegue le pareti inclinate
    fresh('box')
    for k,v in [('w',30),('d',30),('h',30),('x',0),('y',0),('z',0)]: pg.fill('#p-'+k,str(v));pg.keyboard.press('Enter')
    pick(pg,'[0,0,1]'); pg.fill('#f-scale','50'); pg.press('#f-scale','Enter'); pg.wait_for_timeout(1200)
    check('tronco: 15750',abs(pg.evaluate(VOL)-15750)<1)
    pick(pg,'[0,0,1]'); push(pg,'move',10)
    v=pg.evaluate(VOL); exp=(30*30*60-10*10*20)/3
    check('tronco, Allunga la cima di 10: la piramide prosegue (volume %.1f, atteso %.1f)'%(v,exp),abs(v-exp)<1)
    check('nessun errore',not errs); print('errs',errs); b.close()
print('TUTTO OK' if ok else 'ERRORI'); raise SystemExit(0 if ok else 1)
