# Lato: casi limite (curvo, più lati, scava, scala su lato curvo)
from playwright.sync_api import sync_playwright
ok=True
def check(name,cond):
    global ok; ok=ok and bool(cond); print('OK ' if cond else 'KO ',name)
VOL="""(()=>{const o=forma.objects[0];o.updateMatrixWorld(true);const g=o.geometry,P=g.attributes.position,I=g.index;let v=0;const n=I?I.count:P.count;const f=i=>I?I.getX(i):i;
for(let t=0;t<n;t+=3){const A=f(t),B=f(t+1),C=f(t+2);const ax=P.getX(A),ay=P.getY(A),az=P.getZ(A),bx=P.getX(B),by=P.getY(B),bz=P.getZ(B),cx=P.getX(C),cy=P.getY(C),cz=P.getZ(C);v+=(ax*(by*cz-bz*cy)-ay*(bx*cz-bz*cx)+az*(bx*cy-by*cx))/6}return v})()"""
TRI="""(()=>{const o=forma.objects[0];const P=o.geometry.attributes.position,I=o.geometry.index;const n=(I?I.count:P.count)/3;const f=i=>I?I.getX(i):i;let best=-1,bz=-1e9;for(let t=0;t<n;t++){const V=[0,1,2].map(j=>new forma.THREE.Vector3().fromBufferAttribute(P,f(t*3+j)));if(V.every(v=>Math.abs(v.z-V[0].z)<1e-4)&&V[0].z>bz){bz=V[0].z;best=t}}return best})()"""
SIDE="""(()=>{const o=forma.objects[0];const P=o.geometry.attributes.position,I=o.geometry.index;const n=(I?I.count:P.count)/3;const f=i=>I?I.getX(i):i;for(let t=0;t<n;t++){const [a,b,c]=[0,1,2].map(j=>new forma.THREE.Vector3().fromBufferAttribute(P,f(t*3+j)));const nn=b.clone().sub(a).cross(c.clone().sub(a)).normalize();if(Math.abs(nn.z)<0.01&&nn.x>0.5)return t}return -1})()"""
def fresh(pg,kind,dims=None):
    pg.reload();pg.wait_for_function("window.forma");pg.wait_for_timeout(800)
    pg.evaluate("forma.createObject('%s')"%kind);pg.wait_for_timeout(300)
    for k,v in (dims or {}).items(): pg.fill('#p-'+k,str(v));pg.keyboard.press('Enter')
    pg.evaluate("forma.setTool('face')");pg.wait_for_timeout(250)
def pick(pg,js,add=False):
    pg.evaluate("([t,a])=>forma.selectFaceFromHit({object:forma.objects[0],faceIndex:t},a)",[pg.evaluate(js),add]);pg.wait_for_timeout(300)
with sync_playwright() as p:
    b=p.chromium.launch(args=["--use-gl=swiftshader"]);pg=b.new_page(viewport={'width':1440,'height':900})
    errs=[];pg.on('pageerror',lambda e:errs.append(str(e)))
    pg.goto('file:///tmp/forma/dist/forma.html');pg.wait_for_function("window.forma");pg.wait_for_timeout(900)
    # scava (valore negativo) con Estrudi
    fresh(pg,'box',{'w':30,'d':30,'h':30}); pick(pg,TRI); pg.click('#f-mode [data-v=extrude]')
    pg.fill('#f-push','-5');pg.press('#f-push','Enter');pg.wait_for_timeout(1500)
    check('Estrudi -5 scava: volume 22500 (%.0f)'%pg.evaluate(VOL),abs(pg.evaluate(VOL)-22500)<30)
    # lato curvo di un cilindro in Estrudi: nessun errore, un pezzo, volume maggiore
    fresh(pg,'cylinder'); v0=pg.evaluate(VOL); pick(pg,SIDE); n=pg.evaluate("forma.faceSet.length")
    pg.click('#f-mode [data-v=extrude]'); pg.fill('#f-push','3');pg.press('#f-push','Enter');pg.wait_for_timeout(2500)
    check('cilindro in Estrudi: un solo pezzo e nessun crollo (volume %.0f → %.0f, lati %d)'%(v0,pg.evaluate(VOL),n),pg.evaluate("forma.objects.length")==1 and pg.evaluate(VOL)>0)
    # Scala su lato curvo: avviso, il pezzo non cambia
    fresh(pg,'cylinder'); v0=pg.evaluate(VOL); pick(pg,SIDE)
    pg.fill('#f-scale','50');pg.press('#f-scale','Enter');pg.wait_for_timeout(500)
    check('Scala su lato curvo: il pezzo non cambia',abs(pg.evaluate(VOL)-v0)<0.5)
    # due lati insieme (⇧) in Sposta e in Estrudi
    for mode in ['move','extrude']:
        fresh(pg,'box',{'w':30,'d':30,'h':30}); v0=pg.evaluate(VOL)
        pick(pg,TRI); pick(pg,SIDE,True); check('%s: due lati scelti'%mode,pg.evaluate("forma.faceSet.length")==2)
        pg.click('#f-mode [data-v=%s]'%mode); pg.fill('#f-push','4');pg.press('#f-push','Enter');pg.wait_for_timeout(2000)
        check('%s: un solo pezzo, volume cresciuto (%.0f → %.0f)'%(mode,v0,pg.evaluate(VOL)),pg.evaluate("forma.objects.length")==1 and pg.evaluate(VOL)>v0+1000)
    # lato inclinato con due lati scelti (vecchio comportamento sui vertici condivisi): niente crolli
    check('nessun errore',not errs); print('errs',errs); b.close()
print('TUTTO OK' if ok else 'ERRORI'); raise SystemExit(0 if ok else 1)
