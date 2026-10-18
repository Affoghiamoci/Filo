# Due lati estrusi insieme: niente spazio vuoto nello spigolo in comune (anche con la Cima)
from playwright.sync_api import sync_playwright
ok=True
def check(name,cond):
    global ok; ok=ok and bool(cond); print('OK ' if cond else 'KO ',name)
SIDE="""((want)=>{const o=forma.objects[0];o.updateMatrixWorld(true);const P=o.geometry.attributes.position,I=o.geometry.index;const n=(I?I.count:P.count)/3;const f=i=>I?I.getX(i):i;let best=-1,bd=-2;for(let t=0;t<n;t++){const [a,b,c]=[0,1,2].map(j=>new forma.THREE.Vector3().fromBufferAttribute(P,f(t*3+j)).applyMatrix4(o.matrixWorld));const nn=b.clone().sub(a).cross(c.clone().sub(a)).normalize();const d=nn.x*want[0]+nn.y*want[1]+nn.z*want[2];if(d>bd){bd=d;best=t}}return best})"""
VOL="""(()=>{const o=forma.objects[0];o.updateMatrixWorld(true);const g=o.geometry,P=g.attributes.position,I=g.index;let v=0;const n=I?I.count:P.count;const f=i=>I?I.getX(i):i;for(let t=0;t<n;t+=3){const A=f(t),B=f(t+1),C=f(t+2);const ax=P.getX(A),ay=P.getY(A),az=P.getZ(A),bx=P.getX(B),by=P.getY(B),bz=P.getZ(B),cx=P.getX(C),cy=P.getY(C),cz=P.getZ(C);v+=(ax*(by*cz-bz*cy)-ay*(bx*cz-bz*cx)+az*(bx*cy-by*cx))/6}return v})()"""
with sync_playwright() as p:
    b=p.chromium.launch(args=["--use-gl=swiftshader"]);pg=b.new_page(viewport={'width':1300,'height':900})
    errs=[];pg.on('pageerror',lambda e:errs.append(str(e)))
    pg.goto('file:///tmp/forma/dist/forma.html');pg.wait_for_function("window.forma");pg.wait_for_timeout(900)
    res={}
    for taper in ['100','80']:
        pg.reload();pg.wait_for_function("window.forma");pg.wait_for_timeout(600)
        pg.evaluate("forma.createObject('box')");pg.wait_for_timeout(150)
        for k,v in [('w',30),('d',30),('h',30),('x',0),('y',0),('z',0)]: pg.fill('#p-'+k,str(v));pg.keyboard.press('Enter')
        pg.evaluate("forma.setTool('face')");pg.wait_for_timeout(200)
        pg.evaluate("([t])=>forma.selectFaceFromHit({object:forma.objects[0],faceIndex:t},false)",[pg.evaluate(SIDE+"([1,0,0])")]);pg.wait_for_timeout(200)
        pg.evaluate("([t])=>forma.selectFaceFromHit({object:forma.objects[0],faceIndex:t},true)",[pg.evaluate(SIDE+"([0,1,0])")]);pg.wait_for_timeout(200)
        n=pg.evaluate("forma.faceSet.length")
        pg.click('#f-mode [data-v=extrude]'); pg.fill('#f-taper',taper); pg.fill('#f-push','5'); pg.press('#f-push','Enter'); pg.wait_for_timeout(2500)
        res[taper]=(n,pg.evaluate(VOL),pg.evaluate("forma.openEdgeCount(forma.objects[0].geometry)"),pg.evaluate("forma.objects.length"))
    print(res)
    n,v,op,no=res['100']
    check('cima 100: due lati, angolo pieno (volume %.1f, atteso 36750)'%v,n==2 and abs(v-36750)<1 and op==0 and no==1)
    n,v,op,no=res['80']
    # due prismi rastremati: 2 × 5/3 × (900 + 576 + 720) = 7320, più il riempimento dell'angolo (positivo)
    check('cima 80: chiuso, un pezzo, e più dei due blocchi separati (volume %.1f > %.1f)'%(v,27000+7320),op==0 and no==1 and v>27000+7320+5)
    check('nessun errore',not errs); print('errs',errs); b.close()
print('TUTTO OK' if ok else 'ERRORI'); raise SystemExit(0 if ok else 1)
