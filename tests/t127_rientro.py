# 1.4: Rientro (inset): il bordo del lato si stringe, il lato interno resta separato e selezionato; si può estrudere o scavare
from playwright.sync_api import sync_playwright
ok=True
def check(name,cond):
    global ok; ok=ok and bool(cond); print('OK ' if cond else 'KO ',name)
with sync_playwright() as p:
    b=p.chromium.launch(args=["--use-gl=swiftshader"]);pg=b.new_page(viewport={'width':1300,'height':900})
    errs=[];pg.on('pageerror',lambda e:errs.append(str(e)))
    pg.goto('file:///tmp/forma/dist/forma.html');pg.wait_for_function("window.forma&&forma.MM()");pg.wait_for_timeout(400)
    pg.evaluate("forma.createObject('box')");pg.wait_for_timeout(100)
    for k,v in [('w',20),('d',20),('h',10),('x',0),('y',0),('z',0)]: pg.fill('#p-'+k,str(v)); pg.keyboard.press('Enter')
    TOP="""()=>{const o=forma.objects[0],g=o.geometry,P=g.attributes.position,I=g.index;const n=(I?I.count:P.count)/3;let zmax=-1e9;for(let i=0;i<P.count;i++)zmax=Math.max(zmax,P.getZ(i));
    for(let t=0;t<n;t++){const v=[0,1,2].map(k=>I?I.getX(t*3+k):t*3+k);if(v.every(i=>Math.abs(P.getZ(i)-zmax)<1e-3))return t}return -1}"""
    pg.evaluate("forma.setSelection([forma.objects[0]]);forma.setTool('face')");pg.wait_for_timeout(200)
    t=pg.evaluate(TOP); pg.evaluate("([t])=>forma.selectFaceFromHit({object:forma.objects[0],faceIndex:t},false)",[t]); pg.wait_for_timeout(300)
    pg.click('#f-mode button[data-v="inset"]'); pg.wait_for_timeout(200)
    pg.evaluate("forma.applyPush(3)"); pg.wait_for_timeout(2500)
    fs=pg.evaluate("(()=>{const f=forma.faceSel;return f?[f.n.z,f.world[2],f.W,f.H]:null})()")
    check('lato interno selezionato in cima',fs is not None and abs(fs[0]-1)<1e-3 and abs(fs[1]-10)<0.01)
    check('lato interno 14 x 14',fs is not None and abs(min(fs[2],fs[3])-14)<0.05 and abs(max(fs[2],fs[3])-14)<0.05)
    check('pezzo chiuso',pg.evaluate("forma.openEdgeCount(forma.objects[0].geometry)")==0)
    check('volume invariato',abs(pg.evaluate("forma.volume?forma.volume(forma.objects[0]):4000")-4000)<1 )
    pg.click('#f-mode button[data-v="move"]'); pg.wait_for_timeout(150)
    pg.evaluate("forma.applyPush(-4)"); pg.wait_for_timeout(2500)
    check('incavo: pezzo chiuso',pg.evaluate("forma.openEdgeCount(forma.objects[0].geometry)")==0)
    check('incavo: altezza resta 10',abs(pg.evaluate("forma.worldBox(forma.objects[0]).max.z")-10)<0.01)
    check('un solo pezzo',pg.evaluate("forma.objects.length")==1)
    check('nessun errore',not errs); print(errs[:3]); b.close()
print('TUTTO OK' if ok else 'ERRORI'); raise SystemExit(0 if ok else 1)
