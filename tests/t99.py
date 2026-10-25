# Lato su superfici curve: Estrudi su cilindro/cono allarga il raggio come Sposta; sul toro un avviso, mai un pezzo rotto
from playwright.sync_api import sync_playwright
ok=True
def check(name,cond):
    global ok; ok=ok and bool(cond); print('OK ' if cond else 'KO ',name)
SIDE="""(()=>{const o=forma.objects[0];o.updateMatrixWorld(true);const P=o.geometry.attributes.position,I=o.geometry.index;const n=(I?I.count:P.count)/3;const f=i=>I?I.getX(i):i;let best=-1,bx=-1e9;for(let t=0;t<n;t++){const V=[0,1,2].map(j=>new forma.THREE.Vector3().fromBufferAttribute(P,f(t*3+j)).applyMatrix4(o.matrixWorld));const cx=(V[0].x+V[1].x+V[2].x)/3;if(cx>bx){bx=cx;best=t}}return best})()"""
VOL="""(()=>{const o=forma.objects[0];o.updateMatrixWorld(true);const g=o.geometry,P=g.attributes.position,I=g.index;let v=0;const n=I?I.count:P.count;const f=i=>I?I.getX(i):i;
for(let t=0;t<n;t+=3){const A=f(t),B=f(t+1),C=f(t+2);const ax=P.getX(A),ay=P.getY(A),az=P.getZ(A),bx=P.getX(B),by=P.getY(B),bz=P.getZ(B),cx=P.getX(C),cy=P.getY(C),cz=P.getZ(C);v+=(ax*(by*cz-bz*cy)-ay*(bx*cz-bz*cx)+az*(bx*cy-by*cx))/6}return v})()"""
with sync_playwright() as p:
    b=p.chromium.launch(args=["--use-gl=swiftshader"]);pg=b.new_page(viewport={'width':1200,'height':900})
    errs=[];pg.on('pageerror',lambda e:errs.append(str(e)))
    pg.goto('file:///tmp/forma/dist/forma.html');pg.wait_for_function("window.forma");pg.wait_for_timeout(900)
    res={}
    for kind in ['cone','cylinder','torus']:
      for mode in ['move','extrude']:
        pg.reload();pg.wait_for_function("window.forma");pg.wait_for_timeout(700)
        pg.evaluate("forma.createObject('%s')"%kind);pg.wait_for_timeout(300)
        pg.evaluate("forma.setTool('face')");pg.wait_for_timeout(200)
        pg.evaluate("([t])=>forma.selectFaceFromHit({object:forma.objects[0],faceIndex:t},false)",[pg.evaluate(SIDE)]);pg.wait_for_timeout(300)
        v0=pg.evaluate(VOL)
        pg.click('#f-mode [data-v=%s]'%mode); pg.fill('#f-push','3');pg.press('#f-push','Enter');pg.wait_for_timeout(2000)
        res[kind,mode]=(v0,pg.evaluate(VOL),pg.evaluate("forma.sizeOf(forma.objects[0])"),pg.evaluate("forma.openEdgeCount(forma.objects[0].geometry)===0"),pg.evaluate("forma.objects.length"))
    for kind in ['cone','cylinder']:
        v0,v1,sz,cl,n=res[kind,'extrude']; m=res[kind,'move']
        check('%s: Estrudi sul lato curvo = Sposta (allarga il raggio: %s → %s mm, chiuso)'%(kind,round(m[2]['w'],2),round(sz['w'],2)),abs(v1-m[1])<0.5 and abs(sz['w']-sz['d'])<0.01 and cl and n==1)
    v0,v1,sz,cl,n=res['torus','move']
    check('toro move: nessun pezzo rotto (chiuso %s, volume invariato %.0f → %.0f)'%(cl,v0,v1),cl and abs(v1-v0)<0.5 and n==1)
    v0,v1,sz,cl,n=res['torus','extrude']
    check('toro extrude: spessore lungo la superficie (chiuso %s, volume %.0f → %.0f)'%(cl,v0,v1),cl and v1>v0+1 and n==1)
    check('nessun errore',not errs); print('errs',errs); b.close()
print('TUTTO OK' if ok else 'ERRORI'); raise SystemExit(0 if ok else 1)
