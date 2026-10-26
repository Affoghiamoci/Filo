# 1.5.0: Cornice su contorni con curve strette (angoli arrotondati più piccoli della cornice): il rientro passa da Clipper
from playwright.sync_api import sync_playwright
ok=True
def check(name,cond):
    global ok; ok=ok and bool(cond); print('OK ' if cond else 'KO ',name)
URL='file:///tmp/forma/dist/forma.html'
VOL="forma.soupVolume(forma.worldPositions(forma.objects[0]))"
TOP="""()=>{const o=forma.objects[0],g=o.geometry,P=g.attributes.position,I=g.index;const n=(I?I.count:P.count)/3;let zmax=-1e9;for(let i=0;i<P.count;i++)zmax=Math.max(zmax,P.getZ(i));
    let best=-1,ba=0;for(let t=0;t<n;t++){const v=[0,1,2].map(k=>I?I.getX(t*3+k):t*3+k);if(!v.every(i=>Math.abs(P.getZ(i)-zmax)<1e-3))continue;const a=new forma.THREE.Vector3().fromBufferAttribute(P,v[0]),b=new forma.THREE.Vector3().fromBufferAttribute(P,v[1]),c=new forma.THREE.Vector3().fromBufferAttribute(P,v[2]);const ar=b.sub(a).cross(c.sub(a)).length();if(ar>ba){ba=ar;best=t}}return best}"""
with sync_playwright() as p:
    b=p.chromium.launch(args=["--use-gl=swiftshader"]);pg=b.new_page(viewport={'width':1300,'height':900})
    errs=[];pg.on('pageerror',lambda e:errs.append(str(e)))
    pg.goto(URL);pg.wait_for_function("window.forma&&forma.MM()");pg.wait_for_timeout(400)
    pg.evaluate("forma.createObject('box')");pg.wait_for_timeout(100)
    for k,v in [('w',30),('d',30),('h',10),('r',2)]: pg.fill('#p-'+k,str(v)); pg.keyboard.press('Enter')
    pg.wait_for_timeout(300)
    v0=pg.evaluate(VOL)
    pg.evaluate("forma.setSelection([forma.objects[0]]);forma.setTool('face')");pg.wait_for_timeout(200)
    t=pg.evaluate(TOP); pg.evaluate("([t])=>forma.selectFaceFromHit({object:forma.objects[0],faceIndex:t},false)",[t]); pg.wait_for_timeout(300)
    check('lato in cima scelto',pg.evaluate("!!forma.faceSel && Math.abs(forma.faceSel.n.z-1)<1e-3"))
    pg.click('#f-mode button[data-v="extrude"]'); pg.fill('#f-frame','5'); pg.fill('#f-push','-3'); pg.wait_for_timeout(800)
    check('anteprima con cornice più larga dei raccordi',pg.evaluate("forma.facePrev.visible"))
    pg.click('#f-push-go'); pg.wait_for_timeout(3000)
    v1=pg.evaluate(VOL)
    check('vasca fatta: pezzo chiuso',pg.evaluate("forma.openEdgeCount(forma.objects[0].geometry)")==0 and pg.evaluate("forma.objects.length")==1)
    check('volume tolto circa 20 x 20 x 3 (%.1f)'%(v0-v1),abs((v0-v1)-20*20*3)<2)
    check('nessun errore',not errs); print(errs[:3]); b.close()
print('TUTTO OK' if ok else 'ERRORI'); raise SystemExit(0 if ok else 1)
