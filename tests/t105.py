# 1.1.0: Righe e pareti sui pezzi a rotazione (vaso fatto con due coni e un raccordo), cono che si allarga, rifiuto sui pezzi non a rotazione
from playwright.sync_api import sync_playwright
import math
ok=True
def check(name,cond):
    global ok; ok=ok and bool(cond); print('OK ' if cond else 'KO ',name)
VOL="""(()=>{const o=forma.objects[0];o.updateMatrixWorld(true);const g=o.geometry,P=g.attributes.position,I=g.index;let v=0;const n=I?I.count:P.count;const f=i=>I?I.getX(i):i;for(let t=0;t<n;t+=3){const A=f(t),B=f(t+1),C=f(t+2);const ax=P.getX(A),ay=P.getY(A),az=P.getZ(A),bx=P.getX(B),by=P.getY(B),bz=P.getZ(B),cx=P.getX(C),cy=P.getY(C),cz=P.getZ(C);v+=(ax*(by*cz-bz*cy)-ay*(bx*cz-bz*cx)+az*(bx*cy-by*cx))/6}return v})()"""
OPEN="forma.openEdgeCount(forma.objects[0].geometry)"
TOAST="document.querySelector('#toast')?.textContent||''"
O='/tmp/claude-0/-home-claude/855145e8-0c7f-5220-a7bc-901db1b32e0d/scratchpad/out/'
with sync_playwright() as p:
    b=p.chromium.launch(args=["--use-gl=swiftshader"]);pg=b.new_page(viewport={'width':1300,'height':900})
    errs=[];pg.on('pageerror',lambda e:errs.append(str(e)))
    pg.goto('file:///tmp/forma/dist/forma.html');pg.wait_for_function("window.forma");pg.wait_for_timeout(900)
    def mk(kind,d):
        pg.evaluate("forma.createObject('%s')"%kind);pg.wait_for_timeout(150)
        for k,v in d: pg.fill('#p-'+k,str(v));pg.keyboard.press('Enter')
        pg.wait_for_timeout(100)
    def fill(n,depth,shape,twist,margin,wall,bottom):
        for id_,v in [('rv-n',n),('rv-depth',depth),('rv-twist',twist),('rv-margin',margin),('rv-wall',wall),('rv-bottom',bottom)]: pg.fill('#'+id_,str(v))
        pg.click('#rv-shape [data-v=%s]'%shape)
    # cono che si allarga: cima 127 %
    mk('cone',[('w',60),('d',60),('h',15),('q','76/60*100'),('x',0),('y',0),('z',0)])
    bw=pg.evaluate("(()=>{const b=forma.worldBox(forma.objects[0]);return b.max.x-b.min.x})()")
    check('cono con la cima al 127 %%: si allarga fino a 76 mm (%.2f)'%bw,abs(bw-76)<0.2)
    # vaso: cono che si allarga + cono che si stringe, combina, raccordo sull'anello della pancia
    mk('cone',[('w',76),('d',76),('h',48),('q',81.6),('x',0),('y',0),('z',15)])
    pg.evaluate("forma.setSelection(forma.objects);forma.combine('union')");pg.wait_for_function("forma.objects.length===1",timeout=60000);pg.wait_for_timeout(300)
    pg.evaluate("forma.setTool('edge')");pg.wait_for_timeout(200)
    pg.evaluate("forma.selectEdgeAt({object:forma.objects[0],point:new forma.THREE.Vector3(38,0,15)},false)");pg.wait_for_timeout(250)
    pg.evaluate("forma.edgeMode.v='fillet'"); pg.fill('#e-size','25'); pg.click('#e-go'); pg.wait_for_timeout(3000)
    pg.evaluate("forma.setTool('move');forma.setSelection([forma.objects[0]])");pg.wait_for_timeout(300)
    check('pannello Righe e pareti visibile sul vaso',pg.is_visible('#p-rev'))
    v0=pg.evaluate(VOL)
    fill(0,0.8,'round',0,0,0,2); pg.click('#sh-go'); pg.wait_for_timeout(2000); pg.click('#rv-go'); pg.wait_for_timeout(2500)
    v1=pg.evaluate(VOL)
    check('riconosciuto come pezzo a rotazione (%s), volume uguale (%.0f → %.0f)'%(pg.evaluate("forma.objects[0].userData.kind"),v0,v1),pg.evaluate("forma.objects[0].userData.kind")=='rev' and abs(v1-v0)<0.01*v0 and pg.evaluate(OPEN)==0)
    fill(150,0.7,'round',0,3,2,2); pg.click('#sh-go'); pg.wait_for_timeout(3000); pg.click('#rv-go'); pg.wait_for_timeout(4000)
    v2=pg.evaluate(VOL); t=pg.evaluate(TOAST)
    check('righe 150 da 0,7 + pareti 2 mm: chiuso (%s), molto meno volume (%.0f), messaggio "%s"'%(pg.evaluate(OPEN),v2,t),pg.evaluate(OPEN)==0 and v2<0.35*v1 and v2>0.05*v1 and '150 righe' in t)
    sz=pg.evaluate("JSON.stringify(forma.sizeOf(forma.objects[0]))"); print('misure',sz, 'triangoli',pg.evaluate("(forma.objects[0].geometry.index?forma.objects[0].geometry.index.count:forma.objects[0].geometry.attributes.position.count)/3"))
    # parete misurata: a metà altezza la sezione ha la parete di circa 2 mm (più le righe)
    pg.screenshot(path=O+'vaso-righe.png',clip={'x':330,'y':150,'width':640,'height':560})
    # cambiare l'altezza ricostruisce con le righe
    pg.fill('#p-h','80'); pg.keyboard.press('Enter'); pg.wait_for_timeout(2500)
    check('altezza 80: resta a rotazione, chiuso, alto 80 (%s)'%pg.evaluate("forma.sizeOf(forma.objects[0]).h"),abs(pg.evaluate("forma.sizeOf(forma.objects[0]).h")-80)<0.01 and pg.evaluate(OPEN)==0 and pg.evaluate("forma.objects[0].userData.kind")=='rev')
    pg.evaluate("forma.undo()"); pg.wait_for_timeout(1500)
    check('⌘Z torna a 63',abs(pg.evaluate("forma.sizeOf(forma.objects[0]).h")-63)<0.05)
    # torsione e forma a punta
    fill(40,1,'point',90,0,0,2); pg.click('#sh-go'); pg.wait_for_timeout(2000); pg.click('#rv-go'); pg.wait_for_timeout(3000)
    check('torsione 90° a punta: chiuso',pg.evaluate(OPEN)==0)
    # pezzo non a rotazione: scatola
    pg.reload();pg.wait_for_function("window.forma");pg.wait_for_timeout(600)
    mk('box',[('w',20),('d',20),('h',20)]); mk('box',[('w',5),('d',5),('h',5),('x',12)])
    pg.evaluate("forma.setSelection(forma.objects);forma.combine('union')");pg.wait_for_function("forma.objects.length===1",timeout=60000);pg.wait_for_timeout(300)
    pg.evaluate("forma.setSelection([forma.objects[0]])"); pg.wait_for_timeout(200)
    pg.click('#rv-go'); pg.wait_for_timeout(1000)
    check("pezzo non a rotazione: avviso (%s), resta com'era"%pg.inner_text('#rv-info'),'non lo è' in pg.inner_text('#rv-info') and pg.evaluate("forma.objects[0].userData.kind")=='merged')
    check('nessun errore',not errs); print('errs',errs); b.close()
print('TUTTO OK' if ok else 'ERRORI'); raise SystemExit(0 if ok else 1)
