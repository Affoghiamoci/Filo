# Motore 1.0, fase 2: Sposta ed Estrudi passano dalla topologia (senza booleane) e ripiegano sul metodo vecchio nei casi a rischio
from playwright.sync_api import sync_playwright
ok=True
def check(name,cond):
    global ok; ok=ok and bool(cond); print('OK ' if cond else 'KO ',name)
VOL="forma.soupVolume(forma.worldPositions(forma.objects[0]))"
ST="(()=>{const s=forma.topo(forma.objects[0]).stats;return s})()"
TOP="""(()=>{const o=forma.objects[0];o.updateMatrixWorld(true);const P=o.geometry.attributes.position,I=o.geometry.index;const n=(I?I.count:P.count)/3;const f=i=>I?I.getX(i):i;let best=-1,bz=-1e9,bx=1e9;
for(let t=0;t<n;t++){const V=[0,1,2].map(j=>new forma.THREE.Vector3().fromBufferAttribute(P,f(t*3+j)).applyMatrix4(o.matrixWorld));if(V.every(v=>Math.abs(v.z-V[0].z)<1e-4)){const cx=(V[0].x+V[1].x+V[2].x)/3;if(V[0].z>bz+1e-4||(Math.abs(V[0].z-bz)<1e-4&&WANT)){bz=V[0].z;bx=cx;best=t}}}return best})()"""
def mk(pg,dims,kind='box'):
    pg.evaluate("forma.createObject('%s')"%kind);pg.wait_for_timeout(150)
    for k,v in dims.items(): pg.fill('#p-'+k,str(v));pg.keyboard.press('Enter')
def fresh(pg):
    pg.reload();pg.wait_for_function("window.forma");pg.wait_for_timeout(700); pg.evaluate("window.__topoLog=[]")
def push(pg,tri,dist,mode='move',taper=''):
    pg.evaluate("forma.setTool('face')");pg.wait_for_timeout(200)
    pg.evaluate("([t])=>forma.selectFaceFromHit({object:forma.objects[0],faceIndex:t},false)",[tri]);pg.wait_for_timeout(250)
    pg.click('#f-mode [data-v=%s]'%mode)
    if mode=='extrude': pg.fill('#f-taper',taper)
    pg.fill('#f-push',str(dist));pg.press('#f-push','Enter');pg.wait_for_timeout(1500)
LOG="window.__topoLog.slice()"
with sync_playwright() as p:
    b=p.chromium.launch(args=["--use-gl=swiftshader"]);pg=b.new_page(viewport={'width':1400,'height':900})
    errs=[];pg.on('pageerror',lambda e:errs.append(str(e)))
    pg.goto('file:///tmp/forma/dist/forma.html');pg.wait_for_function("window.forma");pg.wait_for_timeout(900)
    top=lambda: pg.evaluate(TOP.replace('WANT','false'))
    # cubo: Sposta in alto
    fresh(pg); mk(pg,{'w':30,'d':30,'h':30,'x':0,'y':0,'z':0}); push(pg,top(),5)
    check('cubo, Sposta +5: strada nuova %s, volume 31500 (%.1f)'%(pg.evaluate(LOG),pg.evaluate(VOL)),pg.evaluate(LOG)==['move'] and abs(pg.evaluate(VOL)-31500)<0.01)
    s=pg.evaluate(ST); check('risultato pulito: chiuso, 6 facce, 8 vertici (%s)'%{k:s[k] for k in ['faces','verts','closed','pinched']},s['closed'] and s['faces']==6 and s['verts']==8)
    # cubo: Estrudi con Cima 50 → volume esatto
    fresh(pg); mk(pg,{'w':30,'d':30,'h':30,'x':0,'y':0,'z':0}); push(pg,top(),10,'extrude','50')
    v=pg.evaluate(VOL); s=pg.evaluate(ST)
    check('Estrudi 10 cima 50%%: strada nuova %s, volume esatto 32250 (%.2f)'%(pg.evaluate(LOG),v),pg.evaluate(LOG)==['extrude'] and abs(v-32250)<0.01)
    check('pomello: chiuso, 10 facce (%s)'%{k:s[k] for k in ['faces','closed','pinched','degenerate']},s['closed'] and s['faces']==10 and s['pinched']==0)
    # pezzo a L: estrudere la cima del braccio basso ha la torre accanto → ripiego sull'unione booleana
    fresh(pg); mk(pg,{'w':40,'d':20,'h':10,'x':0,'y':0,'z':0}); mk(pg,{'w':20,'d':20,'h':30,'x':-10,'y':0,'z':0})
    pg.evaluate("forma.setSelection(forma.objects);forma.combine('union')");pg.wait_for_function("forma.objects.length===1",timeout=60000);pg.wait_for_timeout(300)
    low=pg.evaluate(TOP.replace("V[0].z>bz+1e-4||(Math.abs(V[0].z-bz)<1e-4&&WANT)","Math.abs(V[0].z-10)<1e-4&&cx>0"))
    push(pg,low,5,'extrude','')
    check('L, Estrudi accanto alla torre: ripiego %s, volume 18000 (%.1f)'%(pg.evaluate(LOG),pg.evaluate(VOL)),pg.evaluate(LOG)==[] and abs(pg.evaluate(VOL)-18000)<1)
    # L: Sposta il braccio basso in su di 5 (scorre sulla parete della torre): strada nuova
    pg.evaluate("forma.undo()");pg.wait_for_timeout(500); pg.evaluate("window.__topoLog=[]")
    low=pg.evaluate(TOP.replace("V[0].z>bz+1e-4||(Math.abs(V[0].z-bz)<1e-4&&WANT)","Math.abs(V[0].z-10)<1e-4&&cx>0"))
    push(pg,low,5)
    check('L, Sposta +5 lungo la torre: strada nuova %s, volume 18000 (%.1f)'%(pg.evaluate(LOG),pg.evaluate(VOL)),pg.evaluate(LOG)==['move'] and abs(pg.evaluate(VOL)-18000)<0.01)
    # L: Sposta oltre la cima della torre (+25): la parete della torre sparirebbe → ripiego, ma risultato giusto
    pg.evaluate("forma.undo()");pg.wait_for_timeout(500); pg.evaluate("window.__topoLog=[]")
    low=pg.evaluate(TOP.replace("V[0].z>bz+1e-4||(Math.abs(V[0].z-bz)<1e-4&&WANT)","Math.abs(V[0].z-10)<1e-4&&cx>0"))
    push(pg,low,25)
    check('L, Sposta oltre la torre: niente strada nuova (%s), pezzo ancora unico'%pg.evaluate(LOG),pg.evaluate(LOG)==[] and pg.evaluate("forma.objects.length")==1)
    # cornice (faccia con buco): Estrudi la faccia sopra → pareti anche attorno al buco
    fresh(pg); mk(pg,{'w':40,'d':40,'h':10,'x':0,'y':0,'z':0}); mk(pg,{'w':20,'d':20,'h':30,'x':0,'y':0,'z':-10})
    pg.evaluate("forma.toggleHole([forma.objects[1]])");pg.evaluate("forma.setSelection(forma.objects);forma.combine('union')");pg.wait_for_function("forma.objects.length===1",timeout=60000);pg.wait_for_timeout(300)
    push(pg,top(),5,'extrude','')
    s=pg.evaluate(ST)
    check('cornice, Estrudi 5: strada nuova %s, volume 18000 (%.1f), ancora un foro (genere %s)'%(pg.evaluate(LOG),pg.evaluate(VOL),s['genus']),pg.evaluate(LOG)==['extrude'] and abs(pg.evaluate(VOL)-18000)<0.01 and s['genus']==1)
    check('nessun errore',not errs); print('errs',errs); b.close()
print('TUTTO OK' if ok else 'ERRORI'); raise SystemExit(0 if ok else 1)
