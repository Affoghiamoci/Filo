# Lato inclinato: il piano si sposta lungo la sua normale e sopra/sotto restano orizzontali (niente "salita")
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
with sync_playwright() as p:
    b=p.chromium.launch(args=["--use-gl=swiftshader"]);pg=b.new_page(viewport={'width':1440,'height':900})
    errs=[];pg.on('pageerror',lambda e:errs.append(str(e)))
    pg.goto('file:///tmp/forma/dist/forma.html');pg.wait_for_function("window.forma");pg.wait_for_timeout(900)
    make(pg); check('pezzo rastremato: quote z 0 e 60',pg.evaluate(ZS)==[0,60])
    d0=pg.evaluate(PL); check('un solo piano inclinato (%s)'%d0,len(d0)==1)
    pick(pg); pg.evaluate("forma.applyPush(10)");pg.wait_for_timeout(900)
    check('dopo +10: sopra e sotto restano orizzontali (%s)'%pg.evaluate(ZS),pg.evaluate(ZS)==[0,60])
    d1=pg.evaluate(PL); check('il piano si è spostato di 10 lungo la normale (%s→%s)'%(d0,d1),len(d1)==1 and abs(d1[0]-d0[0]-10)<0.05)
    check('sempre un solo pezzo',pg.evaluate("forma.objects.length")==1)
    pick(pg); pg.evaluate("forma.applyPush(-4)");pg.wait_for_timeout(900)
    d2=pg.evaluate(PL); check('poi -4: quote ancora 0 e 60 e piano a %s'%d2,pg.evaluate(ZS)==[0,60] and len(d2)==1 and abs(d2[0]-d0[0]-6)<0.05)
    check('nessun errore',not errs); print('errs',errs); b.close()
print('TUTTO OK' if ok else 'ERRORI'); raise SystemExit(0 if ok else 1)
