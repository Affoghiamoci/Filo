# Motore 1.0: angolo a pallina (tre spigoli raccordati che si incontrano) e scatola con tutti gli spigoli arrotondati
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
def cube(pg):   # cubo 30 "unito" (non più parametrico), centrato in x,y, da z 0 a 30
    pg.reload();pg.wait_for_function("window.forma");pg.wait_for_timeout(700); pg.evaluate("window.__topoLog=[]")
    mk(pg,{'w':30,'d':30,'h':30,'x':0,'y':0,'z':0}); mk(pg,{'w':10,'d':10,'h':10,'x':0,'y':0,'z':10})
    pg.evaluate("forma.setSelection(forma.objects);forma.combine('union')");pg.wait_for_function("forma.objects.length===1",timeout=60000);pg.wait_for_timeout(300)
    pg.evaluate("forma.setTool('edge')");pg.wait_for_timeout(200)
def edges(pg,pts,mode,size):
    for i,(x,y,z) in enumerate(pts):
        pg.evaluate("forma.selectEdgeAt({object:forma.objects[0],point:new forma.THREE.Vector3(%f,%f,%f)},%s)"%(x,y,z,'true' if i else 'false'));pg.wait_for_timeout(120)
    n=pg.evaluate("forma.edgeSel().length")
    pg.evaluate("forma.edgeMode.v='%s'"%mode); pg.fill('#e-size',str(size)); pg.click('#e-go'); pg.wait_for_timeout(1800)
    return n
r=4
seg=r*r*(1-math.pi/4); octant=r**3*(1-math.pi/6)
with sync_playwright() as p:
    b=p.chromium.launch(args=["--use-gl=swiftshader"]);pg=b.new_page(viewport={'width':1400,'height':900})
    errs=[];pg.on('pageerror',lambda e:errs.append(str(e)))
    pg.goto('file:///tmp/forma/dist/forma.html');pg.wait_for_function("window.forma");pg.wait_for_timeout(900)
    # un angolo: i tre spigoli che arrivano in (-15,-15,30)
    cube(pg); n=edges(pg,[(-15,0,30),(0,-15,30),(-15,-15,15)],'fillet',r)
    v=pg.evaluate(VOL); s=pg.evaluate(ST); exp=27000-3*seg*(30-r)-octant
    check('un angolo (%d spigoli): strada nuova %s'%(n,pg.evaluate("window.__topoLog")),n==3 and pg.evaluate("window.__topoLog")==['edge-fillet'])
    check('volume %.1f (teorico %.1f, i triangoli tolgono un filo di più)'%(v,exp),exp-3<v<exp+0.01)
    check('chiuso, nessun pizzico, nessun triangolo degenere (%s)'%{k:s[k] for k in ['closed','pinched','degenerate','openEdges']},s['closed'] and s['pinched']==0 and s['degenerate']==0)
    bb=pg.evaluate("(()=>{const b=forma.worldBox(forma.objects[0]);return [b.min.x,b.min.y,b.min.z,b.max.x,b.max.y,b.max.z].map(v=>Math.round(v*1000)/1000)})()")
    check('ingombro invariato 30×30×30 (%s)'%bb,bb==[-15,-15,0,15,15,30])
    # punto più vicino all'angolo: sulla sfera, a distanza r dal centro (−11,−11,26)
    d=pg.evaluate("""(()=>{const P=forma.worldPositions(forma.objects[0]);const c=new forma.THREE.Vector3(-11,-11,26);let best=1e9,dd=0;for(let i=0;i<P.length;i+=3){const v=new forma.THREE.Vector3(P[i],P[i+1],P[i+2]);const s=(v.x+15)+(v.y+15)+(30-v.z);if(s<best){best=s;dd=v.distanceTo(c)}}return dd})()""")
    check("la punta dell'angolo sta sulla sfera di raggio 4 (%.4f)"%d,abs(d-r)<1e-3)
    # tutti i 12 spigoli
    cube(pg)
    pts=[(0,-15,0),(0,15,0),(-15,0,0),(15,0,0),(0,-15,30),(0,15,30),(-15,0,30),(15,0,30),(-15,-15,15),(15,-15,15),(-15,15,15),(15,15,15)]
    n=edges(pg,pts,'fillet',r); v=pg.evaluate(VOL); s=pg.evaluate(ST); exp=27000-12*seg*(30-2*r)-8*octant
    check('12 spigoli (%d): strada nuova %s'%(n,pg.evaluate("window.__topoLog")),n==12 and pg.evaluate("window.__topoLog")==['edge-fillet'])
    check('scatola tutta arrotondata: volume %.1f (teorico %.1f)'%(v,exp),exp-8<v<exp+0.01)
    check('chiusa, pulita, nessuno spigolo vivo rimasto (%s)'%{k:s[k] for k in ['closed','pinched','degenerate','creases']},s['closed'] and s['pinched']==0 and s['degenerate']==0 and s['creases']==0)
    # due spigoli su tre nello stesso angolo: ripiego (spigolo verticale vivo)
    cube(pg); edges(pg,[(-15,0,30),(0,-15,30)],'fillet',r)
    check('due su tre: ripiego %s, pezzo valido'%pg.evaluate("window.__topoLog"),pg.evaluate("window.__topoLog")==[] and pg.evaluate("forma.objects.length")==1)
    # smusso su tre spigoli di un angolo: per ora ripiego
    cube(pg); edges(pg,[(-15,0,30),(0,-15,30),(-15,-15,15)],'chamfer',r)
    check("smusso d'angolo: ripiego %s, pezzo valido"%pg.evaluate("window.__topoLog"),pg.evaluate("window.__topoLog")==[] and pg.evaluate("forma.objects.length")==1)
    check('nessun errore',not errs); print('errs',errs); b.close()
print('TUTTO OK' if ok else 'ERRORI'); raise SystemExit(0 if ok else 1)
