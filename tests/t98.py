# Motore 1.0: raccordo d'angolo su una scatola con il tetto (lo spigolo verticale arriva dove si incontrano quattro facce)
from playwright.sync_api import sync_playwright
import math
ok=True
def check(name,cond):
    global ok; ok=ok and bool(cond); print('OK ' if cond else 'KO ',name)
VOL="forma.soupVolume(forma.worldPositions(forma.objects[0]))"
ST="forma.topo(forma.objects[0]).stats"
TOP="""(()=>{const o=forma.objects[0];o.updateMatrixWorld(true);const P=o.geometry.attributes.position,I=o.geometry.index;const n=(I?I.count:P.count)/3;const f=i=>I?I.getX(i):i;let best=-1,bz=-1e9;for(let t=0;t<n;t++){const V=[0,1,2].map(j=>new forma.THREE.Vector3().fromBufferAttribute(P,f(t*3+j)).applyMatrix4(o.matrixWorld));if(V.every(v=>Math.abs(v.z-V[0].z)<1e-4)&&V[0].z>bz){bz=V[0].z;best=t}}return best})()"""
def roofbox(pg):
    pg.reload();pg.wait_for_function("window.forma");pg.wait_for_timeout(700)
    pg.evaluate("forma.createObject('box')");pg.wait_for_timeout(150)
    for k,v in [('w',30),('d',30),('h',30),('x',0),('y',0),('z',0)]: pg.fill('#p-'+k,str(v));pg.keyboard.press('Enter')
    pg.evaluate("forma.setTool('face')");pg.wait_for_timeout(200)
    pg.evaluate("([t])=>forma.selectFaceFromHit({object:forma.objects[0],faceIndex:t},false)",[pg.evaluate(TOP)]);pg.wait_for_timeout(250)
    pg.click('#f-mode [data-v=extrude]'); pg.fill('#f-taper','1'); pg.fill('#f-push','13'); pg.press('#f-push','Enter'); pg.wait_for_timeout(1500)
    pg.click('#f-mode [data-v=move]') if pg.is_visible('#f-mode') else None
    pg.evaluate("window.__topoLog=[]"); pg.evaluate("forma.setTool('edge')");pg.wait_for_timeout(200)
def edges(pg,pts,mode,size):
    for i,(x,y,z) in enumerate(pts):
        pg.evaluate("forma.selectEdgeAt({object:forma.objects[0],point:new forma.THREE.Vector3(%f,%f,%f)},%s)"%(x,y,z,'true' if i else 'false'));pg.wait_for_timeout(120)
    n=pg.evaluate("forma.edgeSel().length")
    pg.evaluate("forma.edgeMode.v='%s'"%mode); pg.fill('#e-size',str(size)); pg.click('#e-go'); pg.wait_for_timeout(1800)
    return n
with sync_playwright() as p:
    b=p.chromium.launch(args=["--use-gl=swiftshader"]);pg=b.new_page(viewport={'width':1400,'height':900})
    errs=[];pg.on('pageerror',lambda e:errs.append(str(e)))
    pg.goto('file:///tmp/forma/dist/forma.html');pg.wait_for_function("window.forma");pg.wait_for_timeout(900)
    roofbox(pg); v0=pg.evaluate(VOL); s0=pg.evaluate(ST)
    print('scatola col tetto',round(v0,1),{k:s0[k] for k in ['faces','closed']})
    # angolo in basso (−15, 15, 0): bordo in basso lungo y, bordo in basso lungo x, spigolo verticale (che in cima tocca quattro facce)
    n=edges(pg,[(-15,0,0),(0,15,0),(-15,15,15)],'fillet',5)
    v=pg.evaluate(VOL); s=pg.evaluate(ST)
    check('3 spigoli scelti (%d), strada nuova %s'%(n,pg.evaluate("window.__topoLog")),n==3 and pg.evaluate("window.__topoLog")==['edge-fillet'])
    check('chiuso, pulito (%s)'%{k:s[k] for k in ['closed','pinched','degenerate','openEdges']},s['closed'] and s['pinched']==0 and s['degenerate']==0)
    d=pg.evaluate("""(()=>{const P=forma.worldPositions(forma.objects[0]);const c=new forma.THREE.Vector3(-10,10,5);let best=1e9,dd=0;for(let i=0;i<P.length;i+=3){const v=new forma.THREE.Vector3(P[i],P[i+1],P[i+2]);const s=(v.x+15)+(15-v.y)+v.z;if(s<best){best=s;dd=v.distanceTo(c)}}return dd})()""")
    check("l'angolo in basso è un pezzo di sfera di raggio 5 (%.4f)"%d,abs(d-5)<1e-3)
    seg=25*(1-math.pi/4); octant=125*(1-math.pi/6)
    # bordi in basso: lunghi 30, raccordati per 30-5; spigolo verticale: 30-5 fino alla gronda, poi il tetto lo taglia
    print('volume',round(v0,1),'→',round(v,1))
    check('volume sceso del giusto ordine (%.1f)'%(v0-v), 2*seg*25+octant+seg*20 < v0-v < 2*seg*25+octant+seg*30)
    # il tetto resta intatto in cima: la punta resta a 43
    bb=pg.evaluate("(()=>{const b=forma.worldBox(forma.objects[0]);return [b.min.z,b.max.z]})()")
    check('altezza invariata (%s)'%bb,abs(bb[0])<1e-3 and abs(bb[1]-43)<1e-3)
    # solo lo spigolo verticale: l'estremo in cima viene tagliato dalle due falde
    roofbox(pg); v0=pg.evaluate(VOL); n=edges(pg,[(-15,15,15)],'fillet',5); s=pg.evaluate(ST)
    check('solo spigolo verticale: strada nuova %s, chiuso'%pg.evaluate("window.__topoLog"),pg.evaluate("window.__topoLog")==['edge-fillet'] and s['closed'] and s['pinched']==0)
    roofbox(pg); n=edges(pg,[(-15,15,15)],'chamfer',4); s=pg.evaluate(ST)
    check('smusso dello spigolo verticale: strada nuova %s, chiuso'%pg.evaluate("window.__topoLog"),pg.evaluate("window.__topoLog")==['edge-chamfer'] and s['closed'])
    check('nessun errore',not errs); print('errs',errs); b.close()
print('TUTTO OK' if ok else 'ERRORI'); raise SystemExit(0 if ok else 1)
