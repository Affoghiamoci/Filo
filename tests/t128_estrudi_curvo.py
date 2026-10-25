# 1.4: Estrudi su una superficie curva (lato di un cilindro): lo spessore segue la superficie, il pezzo resta chiuso
from playwright.sync_api import sync_playwright
ok=True
def check(name,cond):
    global ok; ok=ok and bool(cond); print('OK ' if cond else 'KO ',name)
with sync_playwright() as p:
    b=p.chromium.launch(args=["--use-gl=swiftshader"]);pg=b.new_page(viewport={'width':1300,'height':900})
    errs=[];pg.on('pageerror',lambda e:errs.append(str(e)))
    pg.goto('file:///tmp/forma/dist/forma.html');pg.wait_for_function("window.forma&&forma.MM()");pg.wait_for_timeout(400)
    pg.evaluate("forma.createObject('sphere')");pg.wait_for_timeout(100)
    for k,v in [('w',20),('d',20),('h',20),('x',0),('y',0),('z',0)]: pg.fill('#p-'+k,str(v)); pg.keyboard.press('Enter')
    pg.evaluate("forma.setSelection([forma.objects[0]]);forma.setTool('face')");pg.wait_for_timeout(200)
    pg.evaluate("forma.selectFaceFromHit({object:forma.objects[0],faceIndex:40},false)"); pg.wait_for_timeout(300)
    info=pg.evaluate("(()=>{const f=forma.faceSel;return f?{curved:f.curved,sn:!!f.sn}:null})()")
    print(info)
    check('lato curvo selezionato',info and info['curved'] and info['sn'])
    v0=pg.evaluate("forma.geoVolume(forma.objects[0].geometry)")
    pg.click('#f-mode button[data-v="extrude"]'); pg.wait_for_timeout(200)
    pg.evaluate("forma.applyPush(1.5)"); pg.wait_for_timeout(3000)
    v1=pg.evaluate("forma.geoVolume(forma.objects[0].geometry)")
    print(v0,v1)
    check('volume aumentato',v1>v0+1)
    check('pezzo chiuso',pg.evaluate("forma.openEdgeCount(forma.objects[0].geometry)")==0)
    check('un solo pezzo',pg.evaluate("forma.objects.length")==1)
    check('nessun errore',not errs); print(errs[:3]); b.close()
print('TUTTO OK' if ok else 'ERRORI'); raise SystemExit(0 if ok else 1)
