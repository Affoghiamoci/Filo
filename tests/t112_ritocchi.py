# Ritocchi dopo la 1.1.1: anteprima di Scala il lato, Invio in Taglia e Allunga, calamita a metà, righe che si spengono verso i poli,
# avviso di Svuota con il valore massimo, il lato arancione di Estrudi segue la Cima
from playwright.sync_api import sync_playwright
exec(open('/tmp/forma/tests/t102.py').read().split('with sync_playwright()')[0])
with sync_playwright() as p:
    b=p.chromium.launch(args=["--use-gl=swiftshader"]);pg=b.new_page(viewport={'width':1300,'height':900})
    errs=[];pg.on('pageerror',lambda e:errs.append(str(e)))
    def start():
        pg.goto('file:///tmp/forma/dist/forma.html');pg.wait_for_function("window.forma&&forma.MM()");pg.wait_for_timeout(500)
    # Scala il lato: anteprima
    start(); pg.evaluate("forma.createObject('box')"); pg.evaluate("forma.setTool('face')"); pg.wait_for_timeout(200)
    pg.evaluate("([t])=>forma.selectFaceFromHit({object:forma.objects[0],faceIndex:t},false)",[pg.evaluate(SIDE+"([0,0,1])")]);pg.wait_for_timeout(300)
    pg.fill('#f-scale','40'); pg.wait_for_timeout(400)
    check('Scala il lato: anteprima mentre scrivi, il pezzo non cambia',pg.evaluate("forma.__scalePrev") and pg.evaluate("forma.objects[0].userData.kind")=='box')
    pg.fill('#f-scale','100'); pg.wait_for_timeout(300)
    check('100 %: niente anteprima',not pg.evaluate("forma.__scalePrev"))
    pg.fill('#f-scale','40'); pg.wait_for_timeout(300); pg.click('#f-scale-go'); pg.wait_for_timeout(1500)
    check('Applica: lato ridimensionato, anteprima spenta',not pg.evaluate("forma.__scalePrev") and 'ridimensionato' in pg.evaluate("document.querySelector('#toast').textContent"))
    # Estrudi con la Cima: il lato arancione si stringe durante il trascinamento
    start(); pg.evaluate("forma.createObject('box')"); pg.evaluate("forma.setTool('face')"); pg.wait_for_timeout(200)
    pg.evaluate("([t])=>forma.selectFaceFromHit({object:forma.objects[0],faceIndex:t},false)",[pg.evaluate(SIDE+"([0,0,1])")]);pg.wait_for_timeout(300)
    pg.click('#f-mode [data-v=extrude]'); pg.fill('#f-taper','60')
    c=scr(pg,CEN); tip=scr(pg,"(()=>{const c=%s;return c.addScaledVector(forma.faceSel.n,8)})()"%CEN)
    pg.mouse.move(c[0],c[1]); pg.mouse.down()
    for k in range(1,9): pg.mouse.move(c[0]+(tip[0]-c[0])*k/8, c[1]+(tip[1]-c[1])*k/8); pg.wait_for_timeout(60)
    pg.wait_for_timeout(300)
    sc=pg.evaluate("forma.__selMeshScale")
    check('Estrudi con Cima 60: il lato arancione è al 60 %% (%s)'%sc,sc is not None and abs(sc-0.6)<0.01)
    pg.mouse.up(); pg.wait_for_timeout(1500)
    # Taglia e Allunga con Invio
    start(); pg.evaluate("forma.createObject('box')"); pg.wait_for_timeout(200)
    pg.evaluate("forma.setTool('cut')"); pg.wait_for_timeout(300); pg.evaluate("forma.canvas.focus()"); pg.keyboard.press('Enter'); pg.wait_for_timeout(2500)
    check('Taglia con Invio: due pezzi',pg.evaluate("forma.objects.length")==2)
    pg.evaluate("forma.setTool('stretch')"); pg.wait_for_timeout(300); pg.evaluate("forma.setSelection([forma.objects[0]])")
    pg.fill('#cut-delta','5'); pg.evaluate("forma.canvas.focus()"); h0=pg.evaluate("forma.sizeOf(forma.objects[0]).h")
    pg.keyboard.press('Enter'); pg.wait_for_timeout(2500)
    check('Allunga con Invio: +5 mm',abs(pg.evaluate("forma.sizeOf(forma.objects.at(-1)).h")-h0-5)<0.01)
    # calamita a metà
    start(); pg.evaluate("forma.createObject('cylinder')")
    for f,v in [('w',40),('d',40),('h',30),('x',0),('y',0)]: pg.fill('#p-'+f,str(v)); pg.keyboard.press('Enter')
    pg.fill('#rv-wall','2'); pg.click('#sh-go'); pg.wait_for_timeout(1500)
    pg.evaluate("forma.createObject('sphere')")
    for f,v in [('w',30),('d',30),('h',30),('x',0),('y',0),('z',40)]: pg.fill('#p-'+f,str(v)); pg.keyboard.press('Enter')
    r=pg.evaluate("""(()=>{const sp=forma.objects[1];const info=forma.ensureSnap({},'snapz',new Map([[sp,sp.position.clone()]]));const sn=forma.snapFaces(info,new forma.THREE.Vector3(0,0,-24.6),'z');return sn?[sn.c.z,!!sn.M.mid]:null})()""")
    check('calamita: la sfera si ferma a metà sul bordo del vaso (%s)'%r,r and abs(r[0]+0.4)<0.01 and r[1])
    # righe sulla sfera: ai poli la superficie resta liscia
    pg.evaluate("forma.setSelection([forma.objects[1]])"); pg.wait_for_timeout(200)
    for id_,v in [('rv-n',60),('rv-depth',1),('rv-twist',0),('rv-margin',0)]: pg.fill('#'+id_,str(v))
    pg.click('#rv-go'); pg.wait_for_timeout(2000)
    pole=pg.evaluate("""(()=>{const o=forma.objects[1],P=forma.worldPositions(o),b=forma.worldBox(o),cx=(b.min.x+b.max.x)/2,cy=(b.min.y+b.max.y)/2,cz=(b.min.z+b.max.z)/2;let dev=0,eq=0;
      for(let i=0;i<P.length;i+=3){const x=P[i]-cx,y=P[i+1]-cy,z=P[i+2]-cz,r=Math.hypot(x,y,z),lat=Math.abs(Math.atan2(z,Math.hypot(x,y)))*180/Math.PI;if(lat>65)dev=Math.max(dev,Math.abs(r-15));if(lat<10)eq=Math.max(eq,r-15)}return [dev,eq]})()""")
    check('sfera: liscia vicino ai poli (scarto %.3f), righe piene all equatore (%.2f)'%(pole[0],pole[1]),pole[0]<0.05 and pole[1]>0.8)
    # avviso di Svuota con il massimo
    pg.evaluate("forma.setSelection([forma.objects[0]])"); pg.wait_for_timeout(200); pg.fill('#rv-wall','30'); pg.wait_for_timeout(900)
    t=pg.inner_text('#sh-info'); check('pareti troppo grosse: "%s"'%t,'al massimo' in t)
    check('nessun errore',not errs); print('errs',errs[:3]); b.close()
print('TUTTO OK' if ok else 'ERRORI'); raise SystemExit(0 if ok else 1)
