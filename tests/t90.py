# Lato: interruttore Sposta il lato / Estrudi
from playwright.sync_api import sync_playwright
ok=True
def check(name,cond):
    global ok; ok=ok and bool(cond); print('OK ' if cond else 'KO ',name)
ZS="""(()=>{const o=forma.objects[0];o.updateMatrixWorld(true);const P=o.geometry.attributes.position,I=o.geometry.index;const zs=new Set();const n=I?I.count:P.count;for(let i=0;i<n;i++){const k=I?I.getX(i):i;const v=new forma.THREE.Vector3().fromBufferAttribute(P,k).applyMatrix4(o.matrixWorld);zs.add(Math.round(v.z*100)/100)}return [...zs].sort((a,b)=>a-b)})()"""
# distanza del piano inclinato (normale con x<0) dall'origine
PL="""(()=>{const o=forma.objects[0];o.updateMatrixWorld(true);const P=o.geometry.attributes.position,I=o.geometry.index;const n=(I?I.count:P.count)/3;const f=i=>I?I.getX(i):i;const ds=[];
for(let t=0;t<n;t++){const [a,b,c]=[0,1,2].map(j=>new forma.THREE.Vector3().fromBufferAttribute(P,f(t*3+j)).applyMatrix4(o.matrixWorld));const nn=b.clone().sub(a).cross(c.clone().sub(a)).normalize();if(nn.x<-0.5&&Math.abs(nn.z)>0.05)ds.push(Math.round(nn.dot(a)*100)/100)}return [...new Set(ds)]})()"""
TRI="""(()=>{const o=forma.objects[0];const P=o.geometry.attributes.position,I=o.geometry.index;const n=(I?I.count:P.count)/3;const f=i=>I?I.getX(i):i;for(let t=0;t<n;t++){const [a,b,c]=[0,1,2].map(j=>new forma.THREE.Vector3().fromBufferAttribute(P,f(t*3+j)));const nn=b.clone().sub(a).cross(c.clone().sub(a)).normalize();if(nn.x<-0.5&&Math.abs(nn.z)>0.05)return t}return -1})()"""
def make(pg):
    pg.evaluate("forma.createObject('box')");pg.wait_for_timeout(200)
    for k,v in [('w','30'),('d','30'),('h','60'),('x','0'),('y','0'),('z','0')]: pg.fill('#p-'+k,v);pg.keyboard.press('Enter')
    pg.evaluate("forma.setTool('edge')");pg.wait_for_timeout(300)
    bx=pg.evaluate("(()=>{const b=forma.worldBox(forma.objects[0]);return [b.min.x,b.min.y,b.min.z,b.max.x,b.max.y,b.max.z]})()")
    cx=(bx[0]+bx[3])/2;cy=(bx[1]+bx[4])/2
    for i,(x,y,z) in enumerate([(cx,bx[1],bx[5]),(cx,bx[4],bx[5]),(bx[0],cy,bx[5]),(bx[3],cy,bx[5])]):
        pg.evaluate("forma.selectEdgeAt({object:forma.objects[0],point:new forma.THREE.Vector3(%f,%f,%f)},%s)"%(x,y,z,'true' if i else 'false'));pg.wait_for_timeout(150)
    pg.evaluate("forma.applyEdgeScale(50)");pg.wait_for_timeout(900)
def pick(pg):
    pg.evaluate("forma.setTool('face')");pg.wait_for_timeout(300)
    pg.evaluate("([t])=>forma.selectFaceFromHit({object:forma.objects[0],faceIndex:t},false)",[pg.evaluate(TRI)]);pg.wait_for_timeout(300)
VOL="""(()=>{const o=forma.objects[0];o.updateMatrixWorld(true);const g=o.geometry,P=g.attributes.position,I=g.index;let v=0;const n=I?I.count:P.count;const f=i=>I?I.getX(i):i;
for(let t=0;t<n;t+=3){const A=f(t),B=f(t+1),C=f(t+2);const ax=P.getX(A),ay=P.getY(A),az=P.getZ(A),bx=P.getX(B),by=P.getY(B),bz=P.getZ(B),cx=P.getX(C),cy=P.getY(C),cz=P.getZ(C);v+=(ax*(by*cz-bz*cy)-ay*(bx*cz-bz*cx)+az*(bx*cy-by*cx))/6}return v})()"""
AREA="""(()=>{const w=forma.faceSel.world;let a=0;for(let i=0;i<w.length;i+=9){const A=new forma.THREE.Vector3(w[i],w[i+1],w[i+2]),B=new forma.THREE.Vector3(w[i+3],w[i+4],w[i+5]),C=new forma.THREE.Vector3(w[i+6],w[i+7],w[i+8]);a+=B.clone().sub(A).cross(C.clone().sub(A)).length()/2}return a})()"""
with sync_playwright() as p:
    b=p.chromium.launch(args=["--use-gl=swiftshader"]);pg=b.new_page(viewport={'width':1440,'height':900})
    errs=[];pg.on('pageerror',lambda e:errs.append(str(e)))
    pg.goto('file:///tmp/forma/dist/forma.html');pg.wait_for_function("window.forma");pg.wait_for_timeout(900)
    make(pg); pick(pg)
    check('interruttore presente, "Sposta il lato" attivo',pg.is_visible('#f-mode') and 'on' in pg.get_attribute('#f-mode [data-v=move]','class'))
    A=pg.evaluate(AREA); v0=pg.evaluate(VOL)
    pg.click('#f-mode [data-v=extrude]'); pg.wait_for_timeout(100)
    check('clic su Estrudi: attivo',pg.evaluate("document.querySelector('#f-mode [data-v=extrude]').classList.contains('on')") and not pg.evaluate("document.querySelector('#f-mode [data-v=move]').classList.contains('on')"))
    pg.fill('#f-push','2+3');pg.press('#f-push','Enter');pg.wait_for_timeout(1500)
    v1=pg.evaluate(VOL)
    check('Estrudi +5: volume + area×5 (%.0f → %.0f, atteso +%.0f)'%(v0,v1,A*5),abs((v1-v0)-A*5)<0.02*A*5)
    check('sempre un solo pezzo',pg.evaluate("forma.objects.length")==1)
    toast=pg.evaluate("document.querySelector('#toast')?.textContent||''")
    check('messaggio: estruso (%s)'%toast,'estruso' in toast)
    # prisma esagonale: spostando un lato i vicini si allungano, estrudendo no
    pg.reload();pg.wait_for_function("window.forma");pg.wait_for_timeout(800)
    SIDE="""(()=>{const o=forma.objects[0];const P=o.geometry.attributes.position,I=o.geometry.index;const n=(I?I.count:P.count)/3;const f=i=>I?I.getX(i):i;for(let t=0;t<n;t++){const [a,b,c]=[0,1,2].map(j=>new forma.THREE.Vector3().fromBufferAttribute(P,f(t*3+j)));const nn=b.clone().sub(a).cross(c.clone().sub(a)).normalize();if(Math.abs(nn.z)<0.01&&nn.x>0.5)return t}return -1})()"""
    res={}
    for mode in ['extrude','move']:
        pg.evaluate("forma.objects.slice().forEach(o=>0)")
        pg.reload();pg.wait_for_function("window.forma");pg.wait_for_timeout(800)
        pg.evaluate("forma.createObject('prism')");pg.wait_for_timeout(300)
        pg.evaluate("forma.setTool('face')");pg.wait_for_timeout(300)
        t=pg.evaluate(SIDE); check('prisma: lato trovato (%s)'%t,t>=0)
        pg.evaluate("([t])=>forma.selectFaceFromHit({object:forma.objects[0],faceIndex:t},false)",[t]);pg.wait_for_timeout(300)
        A=pg.evaluate(AREA); v0=pg.evaluate(VOL)
        pg.click('#f-mode [data-v=%s]'%mode); pg.fill('#f-push','5');pg.press('#f-push','Enter');pg.wait_for_timeout(1500)
        res[mode]=(pg.evaluate(VOL)-v0,A*5)
    print(res)
    check('prisma: Estrudi aggiunge esattamente area×5',abs(res['extrude'][0]-res['extrude'][1])<0.02*res['extrude'][1])
    check('prisma: Sposta dà un risultato diverso (i vicini seguono il lato)',abs(res['move'][0]-res['extrude'][0])>1)
    # inglese
    pg.click('#lang-en') if pg.locator('#lang-en').count() else None
    check('nessun errore',not errs); print('errs',errs); b.close()
print('TUTTO OK' if ok else 'ERRORI'); raise SystemExit(0 if ok else 1)
