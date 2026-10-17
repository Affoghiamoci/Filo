# Lato: campo Scala % e combinazione Estrudi + Scala (pomello)
from playwright.sync_api import sync_playwright
ok=True
def check(name,cond):
    global ok; ok=ok and bool(cond); print('OK ' if cond else 'KO ',name)
VOL="""(()=>{const o=forma.objects[0];o.updateMatrixWorld(true);const g=o.geometry,P=g.attributes.position,I=g.index;let v=0;const n=I?I.count:P.count;const f=i=>I?I.getX(i):i;
for(let t=0;t<n;t+=3){const A=f(t),B=f(t+1),C=f(t+2);const ax=P.getX(A),ay=P.getY(A),az=P.getZ(A),bx=P.getX(B),by=P.getY(B),bz=P.getZ(B),cx=P.getX(C),cy=P.getY(C),cz=P.getZ(C);v+=(ax*(by*cz-bz*cy)-ay*(bx*cz-bz*cx)+az*(bx*cy-by*cx))/6}return v})()"""
TOP="""(()=>{const o=forma.objects[0];o.updateMatrixWorld(true);const P=o.geometry.attributes.position,I=o.geometry.index;const n=(I?I.count:P.count)/3;const f=i=>I?I.getX(i):i;let best=-1,bz=-1e9;
for(let t=0;t<n;t++){const V=[0,1,2].map(j=>new forma.THREE.Vector3().fromBufferAttribute(P,f(t*3+j)).applyMatrix4(o.matrixWorld));if(V.every(v=>Math.abs(v.z-V[0].z)<1e-4)&&V[0].z>bz){bz=V[0].z;best=t}}return best})()"""
def sel_top(pg):
    pg.evaluate("forma.setTool('face')");pg.wait_for_timeout(250)
    pg.evaluate("([t])=>forma.selectFaceFromHit({object:forma.objects[0],faceIndex:t},false)",[pg.evaluate(TOP)]);pg.wait_for_timeout(300)
with sync_playwright() as p:
    b=p.chromium.launch(args=["--use-gl=swiftshader"]);pg=b.new_page(viewport={'width':1440,'height':900})
    errs=[];pg.on('pageerror',lambda e:errs.append(str(e)))
    pg.goto('file:///tmp/forma/dist/forma.html');pg.wait_for_function("window.forma");pg.wait_for_timeout(900)
    pg.evaluate("forma.createObject('box')");pg.wait_for_timeout(200)
    for k,v in [('w','30'),('d','30'),('h','30'),('x','0'),('y','0'),('z','0')]: pg.fill('#p-'+k,v);pg.keyboard.press('Enter')
    sel_top(pg)
    check('campo Scala visibile nel pannello Lato',pg.is_visible('#f-scale'))
    pg.fill('#f-scale','25+25');pg.press('#f-scale','Enter');pg.wait_for_timeout(1500)
    v=pg.evaluate(VOL); sz=pg.evaluate("forma.sizeOf(forma.objects[0])")
    check('scala 25+25 → 50 %%: tronco di piramide (volume %.0f, atteso 15750)'%v,abs(v-15750)<15750*0.005)
    check('ingombro invariato 30×30×30 (%s)'%[sz['w'],sz['d'],sz['h']],abs(sz['w']-30)<1e-3 and abs(sz['d']-30)<1e-3 and abs(sz['h']-30)<1e-3)
    check('un solo pezzo',pg.evaluate("forma.objects.length")==1)
    pg.evaluate("forma.undo()");pg.wait_for_timeout(500)
    check('⌘Z ripristina il cubo (%.0f)'%pg.evaluate(VOL),abs(pg.evaluate(VOL)-27000)<1)
    # pomello in un passaggio: estrudi 10 con la cima al 50 %
    sel_top(pg); pg.click('#f-mode [data-v=extrude]'); check('campo Cima visibile solo in Estrudi',pg.is_visible('#f-taper'))
    pg.fill('#f-push','5+5');pg.fill('#f-taper','25+25');pg.press('#f-push','Enter');pg.wait_for_timeout(1800)
    v=pg.evaluate(VOL); sz=pg.evaluate("forma.sizeOf(forma.objects[0])")
    check('estrusione 10 con cima al 50 %%: volume %.0f (atteso 32250)'%v,abs(v-32250)<32250*0.005)
    check('altezza 40, larghezza ancora 30 (%s×%s×%s)'%(sz['w'],sz['d'],sz['h']),abs(sz['h']-40)<0.05 and abs(sz['w']-30)<0.05)
    check('un solo pezzo',pg.evaluate("forma.objects.length")==1)
    pg.evaluate("forma.undo()");pg.wait_for_timeout(500)
    sel_top(pg); pg.fill('#f-taper','150'); pg.fill('#f-push','10');pg.press('#f-push','Enter');pg.wait_for_timeout(1800)
    sz=pg.evaluate("forma.sizeOf(forma.objects[0])")
    check('cima al 150 %%: si allarga (larghezza %s)'%sz['w'],abs(sz['w']-45)<0.1 and abs(sz['h']-40)<0.05)
    pg.evaluate("forma.undo()");pg.wait_for_timeout(500)
    sel_top(pg); pg.fill('#f-taper','abc'); pg.fill('#f-push','10');pg.press('#f-push','Enter');pg.wait_for_timeout(1500)
    check('Cima con testo non valido: il campo si svuota e il prisma resta dritto (volume %.0f)'%pg.evaluate(VOL),abs(pg.evaluate(VOL)-36000)<30)
    pg.evaluate("forma.undo()");pg.wait_for_timeout(500)
    sel_top(pg); pg.click('#f-mode [data-v=move]'); check('in Sposta il campo Cima sparisce',not pg.is_visible('#f-taper'))
    pg.click('#f-mode [data-v=extrude]'); check('in Estrudi il campo Cima torna',pg.is_visible('#f-taper'))
    pg.click('#f-mode [data-v=move]')
    # scala non valida
    v=pg.evaluate(VOL)
    sel_top(pg); pg.fill('#f-scale','abc');pg.press('#f-scale','Enter');pg.wait_for_timeout(300)
    check('Scala con testo non valido: il pezzo non cambia',abs(pg.evaluate(VOL)-v)<0.5)
    check('nessun errore',not errs); print('errs',errs); b.close()
print('TUTTO OK' if ok else 'ERRORI'); raise SystemExit(0 if ok else 1)
