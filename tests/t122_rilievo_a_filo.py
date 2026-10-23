# Feedback (Gass_electric_key): togliere una forma in rilievo spingendola fino al piano del fondo lasciava il pezzo con bordi aperti
import os
from playwright.sync_api import sync_playwright
ok=True
def check(name,cond):
    global ok; ok=ok and bool(cond); print('OK ' if cond else 'KO ',name)
FIND="""([X,Y,Z])=>{const g=forma.objects[0].geometry,P=g.attributes.position,I=g.index;let best=-1,bd=1e9;const n=(I?I.count:P.count)/3;
for(let t=0;t<n;t++){const v=[0,1,2].map(k=>I?I.getX(t*3+k):t*3+k);if(v.some(i=>Math.abs(P.getX(i)-X)>1e-3))continue;
const cy=v.reduce((a,i)=>a+P.getY(i),0)/3,cz=v.reduce((a,i)=>a+P.getZ(i),0)/3;const d=Math.hypot(cy-Y,cz-Z);if(d<bd){bd=d;best=t}}return best}"""
MAN="(()=>{const o=forma.objects[0];const m=forma.MM();const P=o.geometry.attributes.position,I=o.geometry.index;try{const me=new m.Mesh({numProp:3,vertProperties:new Float32Array(P.array),triVerts:new Uint32Array(I?I.array:[...Array(P.count).keys()])});me.merge();const mm=new m.Manifold(me);const s=mm.status();const v=mm.volume();mm.delete();return [s,v,forma.openEdgeCount(o.geometry)]}catch(e){return String(e)}})()"
with sync_playwright() as p:
    b=p.chromium.launch(args=["--use-gl=swiftshader"]);pg=b.new_page(viewport={'width':1300,'height':900})
    errs=[];pg.on('pageerror',lambda e:errs.append(str(e)))
    pg.goto('file:///tmp/forma/dist/forma.html');pg.wait_for_function("window.forma&&forma.MM()");pg.wait_for_timeout(400)
    pg.set_input_files('#file-in',os.path.join(os.path.dirname(os.path.abspath(__file__)),'data','gass_electric_key.3mf')); pg.wait_for_timeout(3000)
    v0=pg.evaluate(MAN); check('il pezzo di partenza è chiuso',v0[0]=='NoError' and v0[2]==0)
    t=pg.evaluate(FIND,[1.548,-9,8]); check('trovata una forma in rilievo',t>=0)
    pg.evaluate("forma.setSelection([forma.objects[0]]);forma.setTool('face')");pg.wait_for_timeout(200)
    pg.evaluate("([t])=>forma.selectFaceFromHit({object:forma.objects[0],faceIndex:t},false)",[t]); pg.wait_for_timeout(300)
    pg.evaluate("forma.applyPush(-0.5)"); pg.wait_for_timeout(4000)
    v1=pg.evaluate(MAN); print(v0,v1)
    check('spinta fino al fondo: pezzo ancora chiuso, senza bordi aperti',v1[0]=='NoError' and v1[2]==0)
    check('il volume cala (la forma è stata tolta)',v1[1]<v0[1]-50)
    check('nessun errore',not errs); print(errs[:3]); b.close()
print('TUTTO OK' if ok else 'ERRORI'); raise SystemExit(0 if ok else 1)
