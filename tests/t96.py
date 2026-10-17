# Motore 1.0, fase 3: raccordo e smusso sulla struttura (spigoli esterni e interni), ripiego quando due spigoli si toccano
from playwright.sync_api import sync_playwright
import math
ok=True
def check(name,cond):
    global ok; ok=ok and bool(cond); print('OK ' if cond else 'KO ',name)
VOL="forma.soupVolume(forma.worldPositions(forma.objects[0]))"
ST="forma.topo(forma.objects[0]).stats"
def mk(pg,dims):
    pg.evaluate("forma.createObject('box')");pg.wait_for_timeout(150)
    for k,v in dims.items(): pg.fill('#p-'+k,str(v));pg.keyboard.press('Enter')
def L(pg):
    pg.reload();pg.wait_for_function("window.forma");pg.wait_for_timeout(700); pg.evaluate("window.__topoLog=[]")
    mk(pg,{'w':40,'d':20,'h':10,'x':0,'y':0,'z':0}); mk(pg,{'w':20,'d':20,'h':30,'x':-10,'y':0,'z':0})
    pg.evaluate("forma.setSelection(forma.objects);forma.combine('union')");pg.wait_for_function("forma.objects.length===1",timeout=60000);pg.wait_for_timeout(300)
    pg.evaluate("forma.setTool('edge')");pg.wait_for_timeout(200)
def edge(pg,pts,mode,size):
    for i,(x,y,z) in enumerate(pts):
        pg.evaluate("forma.selectEdgeAt({object:forma.objects[0],point:new forma.THREE.Vector3(%f,%f,%f)},%s)"%(x,y,z,'true' if i else 'false'));pg.wait_for_timeout(150)
    n=pg.evaluate("forma.edgeSel().length")
    pg.evaluate("forma.edgeMode.v='%s'"%mode); pg.fill('#e-size',str(size)); pg.click('#e-go'); pg.wait_for_timeout(1200)
    return n
with sync_playwright() as p:
    b=p.chromium.launch(args=["--use-gl=swiftshader"]);pg=b.new_page(viewport={'width':1400,'height':900})
    errs=[];pg.on('pageerror',lambda e:errs.append(str(e)))
    pg.goto('file:///tmp/forma/dist/forma.html');pg.wait_for_function("window.forma");pg.wait_for_timeout(900)
    poly=lambda r: r*r*(math.tan(math.pi/4)-0) # segnaposto
    seg=lambda r: r*r - (18*0.5*r*r*math.sin((math.pi/2)/18))   # quadrato r×r meno il quarto di cerchio fatto a 18 lati
    # interno, raccordo e smusso
    for mode,exp in [('fillet',16000+seg(3)*20),('chamfer',16000+4.5*20)]:
        L(pg); n=edge(pg,[(0,0,10)],mode,3); v=pg.evaluate(VOL); s=pg.evaluate(ST)
        check('interno %s: strada nuova %s, volume %.2f (atteso %.2f)'%(mode,pg.evaluate("window.__topoLog"),v,exp),pg.evaluate("window.__topoLog")==['edge-'+mode] and abs(v-exp)<0.05)
        check('interno %s: chiuso, nessun pizzico, nessun triangolo degenere'%mode,s['closed'] and s['pinched']==0 and s['degenerate']==0)
        check('interno %s: le facce di testa restano una faccia ciascuna (facce %d)'%(mode,s['faces']),s['faces']==(8+(18 if mode=='fillet' else 1)))
    # esterno: spigolo in cima alla torre (x=-20, z=30)
    for mode,exp in [('fillet',16000-seg(4)*20),('chamfer',16000-8*20)]:
        L(pg); edge(pg,[(-20,0,30)],mode,4); v=pg.evaluate(VOL)
        check('esterno %s: strada nuova %s, volume %.2f (atteso %.2f)'%(mode,pg.evaluate("window.__topoLog"),v,exp),pg.evaluate("window.__topoLog")==['edge-'+mode] and abs(v-exp)<0.05)
    # due spigoli che non si toccano: entrambi sulla strada nuova
    L(pg); n=edge(pg,[(-20,0,30),(20,0,0)],'fillet',2); v=pg.evaluate(VOL)
    check('due spigoli separati (%d): strada nuova %s, volume %.2f'%(n,pg.evaluate("window.__topoLog"),v),n==2 and pg.evaluate("window.__topoLog")==['edge-fillet'] and abs(v-(16000-seg(2)*40))<0.05)
    # due spigoli che si toccano in un angolo: ripiego sul metodo di prima, risultato comunque valido
    L(pg); n=edge(pg,[(-20,0,30),(-10,-10,30)],'fillet',2)
    check('spigoli che si toccano (%d): ripiego %s, un solo pezzo'%(n,pg.evaluate("window.__topoLog")),n==2 and pg.evaluate("window.__topoLog")==[] and pg.evaluate("forma.objects.length")==1 and pg.evaluate(VOL)<16000)
    # misura troppo grande per la faccia: ripiego (che decide da sé)
    L(pg); edge(pg,[(0,0,10)],'fillet',25)
    check('misura enorme: niente strada nuova (%s)'%pg.evaluate("window.__topoLog"),pg.evaluate("window.__topoLog")==[])
    # tronco di piramide: spigolo inclinato, facce di testa (sopra e sotto) non perpendicolari allo spigolo
    pg.reload();pg.wait_for_function("window.forma");pg.wait_for_timeout(700)
    mk(pg,{'w':30,'d':30,'h':30,'x':0,'y':0,'z':0}); pg.evaluate("forma.setTool('face')");pg.wait_for_timeout(200)
    tri=pg.evaluate("""(()=>{const o=forma.objects[0];o.updateMatrixWorld(true);const P=o.geometry.attributes.position,I=o.geometry.index;const n=(I?I.count:P.count)/3;const f=i=>I?I.getX(i):i;let best=-1,bz=-1e9;for(let t=0;t<n;t++){const V=[0,1,2].map(j=>new forma.THREE.Vector3().fromBufferAttribute(P,f(t*3+j)).applyMatrix4(o.matrixWorld));if(V.every(v=>Math.abs(v.z-V[0].z)<1e-4)&&V[0].z>bz){bz=V[0].z;best=t}}return best})()""")
    pg.evaluate("([t])=>forma.selectFaceFromHit({object:forma.objects[0],faceIndex:t},false)",[tri]);pg.wait_for_timeout(250)
    pg.fill('#f-scale','50');pg.press('#f-scale','Enter');pg.wait_for_timeout(1200)
    v0=pg.evaluate(VOL); pg.evaluate("window.__topoLog=[]"); pg.evaluate("forma.setTool('edge')");pg.wait_for_timeout(200)
    edge(pg,[(-11.25,-11.25,15)],'fillet',2); v=pg.evaluate(VOL); s=pg.evaluate(ST)
    check('tronco, spigolo inclinato: strada nuova %s, chiuso, volume sceso (%.1f → %.1f)'%(pg.evaluate("window.__topoLog"),v0,v),pg.evaluate("window.__topoLog")==['edge-fillet'] and s['closed'] and s['pinched']==0 and v<v0-1)
    bb=pg.evaluate("(()=>{const b=forma.worldBox(forma.objects[0]);return [b.min.z,b.max.z]})()")
    check('tronco: sopra e sotto restano a 0 e 30 (%s)'%bb,abs(bb[0])<1e-3 and abs(bb[1]-30)<1e-3)
    check('nessun errore',not errs); print('errs',errs); b.close()
print('TUTTO OK' if ok else 'ERRORI'); raise SystemExit(0 if ok else 1)
