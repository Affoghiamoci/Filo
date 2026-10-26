# 1.4.3: anteprima dal vivo di Arrotonda/Smussa e di Spingi / tira scritto nel campo; "Parete dritta" tolta
from playwright.sync_api import sync_playwright
exec(open('/tmp/forma/tests/t102.py').read().split('with sync_playwright()')[0])
ok=True
def check(name,cond):
    global ok; ok=ok and bool(cond); print('OK ' if cond else 'KO ',name)
with sync_playwright() as p:
    b=p.chromium.launch(args=["--use-gl=swiftshader"]);pg=b.new_page(viewport={'width':1300,'height':900})
    errs=[];pg.on('pageerror',lambda e:errs.append(str(e)))
    def start():
        pg.goto('file:///tmp/forma/dist/forma.html');pg.wait_for_function("window.forma&&forma.MM()");pg.wait_for_timeout(500)
    PICK="""((merged)=>{const F=forma,m=F.objects[F.objects.length-1];m.updateMatrixWorld(true);const an=F.edgeAnalysis(m);let hi=-1e9;for(let k=0;k<an.P.length;k+=3)hi=Math.max(hi,an.P[k+2]);
      for(const e of an.sharp){const A=an.vp(e.a),B=an.vp(e.b);if(Math.abs(A.z-hi)<1e-3&&Math.abs(B.z-hi)<1e-3){F.selectEdgeAt({object:m,point:A.clone().add(B).multiplyScalar(.5)},false);return F.edgeSel().length}}return 0})"""
    nTri="(()=>{let n=0;forma.objects.forEach(o=>n+=o.geometry.index?o.geometry.index.count/3:o.geometry.attributes.position.count/3);return n})()"
    # scatola parametrica: l'anteprima compare scrivendo e non cambia il pezzo
    start(); pg.evaluate("forma.createObject('box')"); pg.evaluate("forma.setTool('edge')"); pg.wait_for_timeout(200)
    check('nessuna casella Parete dritta',pg.evaluate("!document.querySelector('#e-mv-col')"))
    check('spigolo scelto',pg.evaluate(PICK+"(false)")==1)
    before=pg.evaluate("JSON.stringify(forma.objects[0].userData.p)")
    pg.click('#e-size'); pg.fill('#e-size','3'); pg.wait_for_timeout(500)
    prev=pg.evaluate("(()=>{let m=null;forma.THREE&&0;const s=forma.objects[0].parent;s.traverse(o=>{if(o.isMesh&&o.userData&&o.userData.kind==='merged'&&!forma.objects.includes(o)&&o.layers.mask===1)m=o});return m?m.geometry.attributes.position.count:0})()")
    check('anteprima del raccordo visibile',prev>0)
    check('il pezzo non è cambiato',pg.evaluate("JSON.stringify(forma.objects[0].userData.p)")==before and pg.evaluate("(forma.objects[0].layers.mask&1)===0"))
    pg.click('#e-type button[data-v=chamfer]'); pg.wait_for_timeout(500)
    check('cambiando tipo l anteprima resta',pg.evaluate("(forma.objects[0].layers.mask&1)===0"))
    pg.click('#e-go'); pg.wait_for_timeout(600)
    check('Applica: pezzo visibile e smussato',pg.evaluate("forma.objects[0].layers.mask")&1 and pg.evaluate("JSON.stringify(forma.objects[0].userData.p)")!=before)
    # pezzo non parametrico (motore a punti): anteprima e Applica danno lo stesso numero di triangoli
    start(); pg.evaluate("forma.createObject('box')"); pg.evaluate("forma.setTool('face')"); pg.wait_for_timeout(200)
    pg.evaluate("([t])=>forma.selectFaceFromHit({object:forma.objects[0],faceIndex:t},false)",[pg.evaluate(SIDE+"([0,0,1])")]);pg.wait_for_timeout(300)
    pg.evaluate("forma.applyFaceScale(70)"); pg.wait_for_timeout(600)
    pg.evaluate("forma.setTool('edge')"); pg.wait_for_timeout(200)
    check('spigolo del tronco scelto',pg.evaluate(PICK+"(true)")==1)
    pg.click('#e-size'); pg.fill('#e-size','1.5'); pg.wait_for_timeout(700)
    pv=pg.evaluate("(()=>{let c=0;forma.objects[0].parent.traverse(o=>{if(o.isMesh&&o.userData&&o.userData.kind==='merged'&&!forma.objects.includes(o)&&o.layers.mask===1)c=o.geometry.index?o.geometry.index.count/3:o.geometry.attributes.position.count/3});return c})()")
    t0=pg.evaluate(nTri)
    pg.click('#e-go'); pg.wait_for_timeout(800)
    check('anteprima uguale al risultato',pv>0 and pv==pg.evaluate(nTri) and pv!=t0)
    # Spingi / tira dal campo
    start(); pg.evaluate("forma.createObject('box')"); pg.evaluate("forma.setTool('face')"); pg.wait_for_timeout(200)
    pg.evaluate("([t])=>forma.selectFaceFromHit({object:forma.objects[0],faceIndex:t},false)",[pg.evaluate(SIDE+"([0,0,1])")]);pg.wait_for_timeout(300)
    pg.click('#f-push'); pg.fill('#f-push','6'); pg.wait_for_timeout(400)
    check('anteprima di Spingi scrivendo i mm',pg.evaluate("forma.facePrev.visible"))
    pg.click('#f-mode button[data-v=extrude]'); pg.fill('#f-push','-4'); pg.wait_for_timeout(400)
    check('anteprima di Scava visibile dentro il pezzo',pg.evaluate("forma.facePrev.visible && forma.facePrev.material.depthTest===false"))
    pg.click('#f-push-go'); pg.wait_for_timeout(600)
    check('Applica nasconde l anteprima',not pg.evaluate("forma.facePrev.visible"))
    print('errs',errs); ok=ok and not errs
    b.close()
print('TUTTO OK' if ok else 'QUALCOSA NON VA')
