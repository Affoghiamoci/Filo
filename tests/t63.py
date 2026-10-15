# Spigolo: "Parete dritta" spenta di default; Riprendi come seconda scheda sotto Inizia
from playwright.sync_api import sync_playwright
ok=True
def check(name,cond):
    global ok; ok=ok and bool(cond); print('OK ' if cond else 'KO ',name)
URL='file:///tmp/forma/dist/forma.html'
def rect(pg,sel): return pg.evaluate(f"(()=>{{const r=document.querySelector('{sel}').getBoundingClientRect();return [r.left,r.top,r.right,r.bottom]}})()")
with sync_playwright() as p:
    b=p.chromium.launch(args=["--use-gl=swiftshader"]); errs=[]
    ctx=b.new_context(viewport={'width':1440,'height':900}); pg=ctx.new_page(); pg.on('pageerror',lambda e:errs.append(str(e)))
    pg.goto(URL);pg.wait_for_function("window.forma");pg.wait_for_timeout(800)
    check('Riprendi nascosto se non c\'è niente da riprendere',pg.evaluate("getComputedStyle(document.querySelector('#ew-resume')).display")=='none')
    # prisma: spigolo orizzontale in basso, spostato in perpendicolare
    pg.evaluate("forma.createObject('box')");pg.wait_for_timeout(200)
    check('parete dritta spenta di default',pg.evaluate("document.querySelector('#e-mv-col').checked")==False)
    box=lambda: pg.evaluate("(()=>{const m=forma.objects[forma.objects.length-1];m.updateMatrixWorld(true);const b=new forma.THREE.Box3().setFromObject(m);return [b.min.toArray(),b.max.toArray()].map(a=>a.map(v=>+v.toFixed(2)))})()")
    def mv(col):
        pg.goto(URL);pg.wait_for_function("window.forma");pg.wait_for_timeout(600)
        pg.evaluate("forma.createObject('box')");pg.wait_for_timeout(150)
        pg.fill('#p-w','20');pg.keyboard.press('Enter');pg.fill('#p-d','20');pg.keyboard.press('Enter');pg.fill('#p-h','10');pg.keyboard.press('Enter');pg.wait_for_timeout(100)
        pg.evaluate("forma.setTool('edge')")
        pg.evaluate(f"(()=>{{const c=document.querySelector('#e-mv-col');c.checked={str(col).lower()};c.dispatchEvent(new Event('change'))}})()")
        r=pg.evaluate("""(()=>{const F=forma,m=F.selection[0];m.updateMatrixWorld(true);const an=F.edgeAnalysis(m);let lo=1e9,hi=-1e9;for(let k=0;k<an.P.length;k+=3){lo=Math.min(lo,an.P[k+2]);hi=Math.max(hi,an.P[k+2])}
          for(const e of an.sharp){const A=an.vp(e.a),B=an.vp(e.b);if(Math.abs(A.z-lo)<1e-3&&Math.abs(B.z-lo)<1e-3&&Math.abs(A.x-B.x)>5){F.selectEdgeAt({object:m,point:A.clone().add(B).multiplyScalar(.5)},false);const mi=F.moveInfo();F.moveEdgeBy(mi,'y',3);return 'ok'}}return 'noedge'})()""")
        pg.wait_for_timeout(200)
        # quanti vertici hanno z > 0 e y spostata: se la parete si sposta, il pezzo in alto è traslato
        return r,pg.evaluate("""(()=>{const m=forma.selection[0];m.updateMatrixWorld(true);const p=m.geometry.attributes.position,v=new forma.THREE.Vector3();let top=[1e9,-1e9],bot=[1e9,-1e9];for(let i=0;i<p.count;i++){v.fromBufferAttribute(p,i).applyMatrix4(m.matrixWorld);const r=v.z>5?top:bot;r[0]=Math.min(r[0],v.y);r[1]=Math.max(r[1],v.y)}return [top.map(x=>+x.toFixed(2)),bot.map(x=>+x.toFixed(2))]})()""")
    r0,(t0,b0)=mv(False); print(r0,t0,b0)
    check('spigolo da solo: sopra non si muove, sotto sì',r0=='ok' and abs((t0[1]-t0[0])-20)<0.01 and abs((b0[1]-b0[0])-20)>0.5)
    r1,(t1,b1)=mv(True); print(r1,t1,b1)
    check('con parete dritta attiva si sposta anche sopra',r1=='ok' and abs(t1[1]-13)<0.01 and abs(b1[1]-13)<0.01)
    # Riprendi
    pg.evaluate("forma.saveLast()");pg.wait_for_timeout(300)
    pg.reload();pg.wait_for_function("window.forma");pg.wait_for_timeout(1200)
    hint=rect(pg,'#empty-hint .ew:not(#ew-resume)'); res=rect(pg,'#ew-resume')
    check('Riprendi visibile come seconda scheda',pg.evaluate("getComputedStyle(document.querySelector('#ew-resume')).display")!='none')
    check('subito sotto, a 24 px',abs(res[1]-hint[3]-24)<1.5 and abs(res[0]-hint[0])<1 and abs(res[2]-hint[2])<1)
    check('dentro lo schermo e sopra la barra',res[3]<=900-12 and res[3]<=rect(pg,'#bar')[1]+1)
    check('la riga non è più dentro la scheda Inizia',pg.evaluate("!document.querySelector('#empty-hint .ew:not(#ew-resume) #ew-resume')"))
    pg.click('#ew-resume [data-eh=resume-del]');pg.wait_for_timeout(300)
    check('Elimina nasconde la scheda',pg.evaluate("getComputedStyle(document.querySelector('#ew-resume')).display")=='none')
    pg.reload();pg.wait_for_function("window.forma");pg.wait_for_timeout(1000)
    check('dopo Elimina non riappare',pg.evaluate("getComputedStyle(document.querySelector('#ew-resume')).display")=='none')
    check('nessun errore di pagina',not errs)
    if errs: print(errs)
    b.close()
print('TUTTO OK' if ok else 'FALLITO')
