# Lato: spingere un lato con tante tasche fino a filo con il fondo non blocca il programma; due lati paralleli ridotti senza pieghe (file dell'utente filo6.3mf)
import os,time
from playwright.sync_api import sync_playwright
ok=True
def check(name,cond):
    global ok; ok=ok and bool(cond); print('OK ' if cond else 'KO ',name)
URL='file:///tmp/forma/dist/forma.html'
F=os.path.join(os.path.dirname(os.path.abspath(__file__)),'data','filo6.3mf')
FIND="""(a)=>{const ax=a[0],idx=a[1];const o=forma.objects[idx];o.updateMatrixWorld(true);const g=o.geometry,P=g.attributes.position,I=g.index;const best={};
 const A=new forma.THREE.Vector3(),B=new forma.THREE.Vector3(),C=new forma.THREE.Vector3();const n=I?I.count/3:P.count/3;
 for(let t=0;t<n;t++){const f=k=>I?I.getX(t*3+k):t*3+k;A.fromBufferAttribute(P,f(0)).applyMatrix4(o.matrixWorld);B.fromBufferAttribute(P,f(1)).applyMatrix4(o.matrixWorld);C.fromBufferAttribute(P,f(2)).applyMatrix4(o.matrixWorld);
  const nn=B.clone().sub(A).cross(C.clone().sub(A));const ar=nn.length()/2;nn.normalize();const k=nn[ax];if(Math.abs(k)<0.999)continue;const s=k>0?'+':'-';const pos=(s==='+'?1:-1)*A[ax];if(!best[s]||pos>best[s].pos+1e-3||(Math.abs(pos-best[s].pos)<=1e-3&&ar>best[s].ar))best[s]={t,ar,pos}}
 return best}"""
def setup(pg):
    pg.goto(URL);pg.wait_for_function("window.forma");pg.wait_for_timeout(700)
    pg.set_input_files('#file-in',F,timeout=120000);pg.wait_for_timeout(3500)
    pg.evaluate("forma.setSelection([forma.objects[1]]);forma.setTool('face')");pg.wait_for_timeout(200)
def pick(pg,ax,both):
    b=pg.evaluate(FIND,[ax,1])
    pg.evaluate("([t])=>forma.selectFaceFromHit({object:forma.objects[1],faceIndex:t},false)",[b['-']['t']])
    if both: pg.evaluate("([t])=>forma.selectFaceFromHit({object:forma.objects[1],faceIndex:t},true)",[b['+']['t']])
with sync_playwright() as p:
    b=p.chromium.launch(args=["--use-gl=swiftshader"]); errs=[]
    pg=b.new_page(viewport={'width':1400,'height':900}); pg.on('pageerror',lambda e:errs.append(str(e))); pg.set_default_timeout(60000)
    setup(pg)
    check('importato: 2 pezzi',pg.evaluate("forma.objects.length")==2)
    pick(pg,'y',False)
    check('lato con le tasche selezionato',pg.evaluate("forma.faceSet.length")==1 and pg.evaluate("forma.faceSel.triSet.size")>1000)
    t=time.time(); pg.evaluate("forma.applyPush(-1)"); dt=time.time()-t
    check('spinto di 1 mm (a filo con il fondo delle tasche) in meno di 15 s: %.1f s'%dt,dt<15)
    check('lato liscio: poche facce e superficie chiusa',pg.evaluate("forma.objects[1].geometry.attributes.position.count")<400 and pg.evaluate("forma.openEdgeCount(forma.objects[1].geometry)")==0)
    check('misura giusta (29 mm)',abs(pg.evaluate("forma.sizeOf(forma.objects[1]).d")-29)<0.01 or abs(pg.evaluate("forma.sizeOf(forma.objects[1]).h")-29)<0.01 or abs(pg.evaluate("(()=>{const b=forma.worldBox(forma.objects[1]);return b.max.y-b.min.y})()")-29)<0.01)
    setup(pg)
    pick(pg,'x',True)
    check('due lati paralleli selezionati',pg.evaluate("forma.faceSet.length")==2)
    t=time.time(); pg.evaluate("forma.applyPush(-2)"); dt=time.time()-t
    check('ridotti di 2 mm: superficie chiusa',pg.evaluate("forma.openEdgeCount(forma.objects[1].geometry)")==0 and dt<15)
    FOLD="""(()=>{const o=forma.objects[1];o.updateMatrixWorld(true);const g=o.geometry,P=g.attributes.position,I=g.index;const n=I?I.count/3:P.count/3;
      const y0=forma.worldBox(o).min.y;let bad=0,onface=0;const v=[0,1,2].map(()=>new forma.THREE.Vector3());
      for(let t=0;t<n;t++){for(let k=0;k<3;k++)v[k].fromBufferAttribute(P,I?I.getX(t*3+k):t*3+k).applyMatrix4(o.matrixWorld);
        if(v.every(q=>Math.abs(q.y-y0)<1e-3)){onface++;const nn=v[1].clone().sub(v[0]).cross(v[2].clone().sub(v[0]));if(nn.y>1)bad++}}   // sul lato con le tasche i triangoli (oltre 0,5 mm²) guardano verso -Y; qualche scheggia minuscola del CSG è ammessa
      return [bad,onface]})()"""
    fo=pg.evaluate(FOLD); print('triangoli ribaltati / sul lato:',fo)
    check('nessun triangolo ribaltato sul lato con le tasche (niente pieghe)',fo[0]==0 and fo[1]>100)
    check('nessun errore di pagina',not errs)
    b.close()
print('TUTTO OK' if ok else 'FALLITO')
