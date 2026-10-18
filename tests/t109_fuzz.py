# 1.1.0: sequenze casuali di operazioni (forme, misure, unione, fori, righe e pareti, copia, rotazione, annulla e ripeti):
# dopo ogni passo nessun errore e ogni solido resta chiuso; alla fine annulla tutto e ripeti tutto tornano agli stessi volumi
from playwright.sync_api import sync_playwright
import random, sys
ok=True
def check(name,cond):
    global ok; ok=ok and bool(cond); print('OK ' if cond else 'KO ',name)
LIB="""window.T={
 vol(o){const P=forma.worldPositions(o);let v=0;for(let i=0;i<P.length;i+=9){const a=[P[i],P[i+1],P[i+2]],b=[P[i+3],P[i+4],P[i+5]],c=[P[i+6],P[i+7],P[i+8]];v+=(a[0]*(b[1]*c[2]-b[2]*c[1])-a[1]*(b[0]*c[2]-b[2]*c[0])+a[2]*(b[0]*c[1]-b[1]*c[0]))/6}return v},
 man(o){const m=forma.MM();const P=o.geometry.attributes.position,I=o.geometry.index;try{const me=new m.Mesh({numProp:3,vertProperties:new Float32Array(P.array),triVerts:new Uint32Array(I?I.array:[...Array(P.count).keys()])});me.merge();const mm=new m.Manifold(me);const s=mm.status();mm.delete();return s=='NoError'&&forma.openEdgeCount(o.geometry)==0?'ok':s}catch(e){return 'ERR '+(e.code||e.message)}},
 state(){return forma.objects.map(o=>o.userData.kind+(o.userData.hole?'H':'')+':'+Math.round(T.vol(o))).join(' ')},
 bad(){return forma.objects.filter(o=>!o.userData.hole).map(o=>[o.userData.name,o.userData.kind,T.man(o)]).filter(x=>x[2]!=='ok')},
};"""
seeds=[int(a) for a in sys.argv[1:]] or [11,23,37]
with sync_playwright() as p:
    b=p.chromium.launch(args=["--use-gl=swiftshader"]);pg=b.new_page(viewport={'width':1300,'height':900})
    errs=[];pg.on('pageerror',lambda e:errs.append(str(e)))
    for seed in seeds:
        R=random.Random(seed)
        pg.goto('file:///tmp/forma/dist/forma.html');pg.wait_for_function("window.forma&&forma.MM()");pg.wait_for_timeout(500);pg.evaluate(LIB)
        log=[]; states=[]
        for step in range(28):
            n=pg.evaluate("forma.objects.length")
            ops=['new']*(3 if n<2 else 1)+(['size','rev','rev','union','hole','dup','rot','undo','redo','w'] if n else [])
            op=R.choice(ops); i=R.randrange(n) if n else 0
            try:
                if op=='new':
                    k=R.choice(['box','cylinder','cone','prism','sphere','box','prism'])
                    pg.evaluate("forma.createObject('%s')"%k); pg.wait_for_timeout(100)
                    for f,v in [('w',R.randint(10,50)),('d',R.randint(10,50)),('h',R.randint(10,60)),('x',R.randint(-20,20)),('y',R.randint(-20,20))]: pg.fill('#p-'+f,str(v)); pg.keyboard.press('Enter')
                    if k in ('box','prism') and R.random()<0.4: pg.fill('#p-t',str(R.randint(50,100))); pg.keyboard.press('Enter')
                    if k=='box' and R.random()<0.3: pg.fill('#p-r',str(R.randint(1,5))); pg.keyboard.press('Enter')
                    if k=='cone': pg.fill('#p-q',str(R.choice([0,40,150]))); pg.keyboard.press('Enter')
                    log.append('new %s'%k)
                elif op in ('size','w'):
                    pg.evaluate("forma.setSelection([forma.objects[%d]])"%i); pg.wait_for_timeout(100)
                    if pg.evaluate("forma.objects[%d].userData.hole"%i): continue
                    f=R.choice(['w','d','h']); v=R.randint(8,70); pg.fill('#p-'+f,str(v)); pg.keyboard.press('Enter'); log.append('size %d %s=%d'%(i,f,v))
                elif op=='rev':
                    if pg.evaluate("forma.objects[%d].userData.hole"%i): continue
                    pg.evaluate("forma.setSelection([forma.objects[%d]])"%i); pg.wait_for_timeout(100)
                    if not pg.is_visible('#p-rev'): continue
                    vals=[('rv-n',R.choice([0,12,30,60])),('rv-depth',R.choice([0.5,1,1.5])),('rv-twist',R.choice([0,0,45,-90])),('rv-margin',R.choice([0,0,3])),('rv-wall',R.choice([0,0,1.6,2.5])),('rv-bottom',R.choice([1,2,3]))]
                    for id_,v in vals: pg.fill('#'+id_,str(v))
                    pg.click('#rv-shape [data-v=%s]'%R.choice(['round','point','square'])); pg.click('#rv-go'); pg.wait_for_timeout(1500)
                    log.append('rev %d %s → %s'%(i,vals,pg.evaluate("document.querySelector('#toast')?.textContent")))
                elif op=='union' and n>=2:
                    j=R.choice([x for x in range(n) if x!=i])
                    pg.evaluate("forma.setSelection([forma.objects[%d],forma.objects[%d]])"%(i,j)); pg.evaluate("forma.combine('union')"); pg.wait_for_timeout(2500); log.append('union %d %d'%(i,j))
                elif op=='hole' and n>=2:
                    pg.evaluate("forma.setSelection([forma.objects[%d]])"%i); pg.evaluate("forma.toggleHole()"); pg.wait_for_timeout(100); log.append('hole %d'%i)
                elif op=='dup':
                    pg.evaluate("forma.setSelection([forma.objects[%d]])"%i); pg.evaluate("forma.duplicateSelection()"); pg.wait_for_timeout(300); log.append('dup %d'%i)
                elif op=='rot':
                    pg.evaluate("forma.setSelection([forma.objects[%d]])"%i); pg.wait_for_timeout(100); a=R.choice([90,45,30]); pg.fill('#p-r'+R.choice('xyz'),str(a)); pg.keyboard.press('Enter'); log.append('rot %d %d'%(i,a))
                elif op=='undo': pg.evaluate("forma.undo()"); pg.wait_for_timeout(800); log.append('undo')
                elif op=='redo': pg.evaluate("forma.redo()"); pg.wait_for_timeout(800); log.append('redo')
                else: continue
            except Exception as e:
                log.append('ECCEZIONE %s %s'%(op,str(e)[:120])); check('seme %d passo %d %s senza eccezioni'%(seed,step,op),False); break
            pg.wait_for_timeout(150)
            bad=pg.evaluate("T.bad()")
            if bad or errs:
                check('seme %d passo %d (%s): tutto chiuso %s, errori %s'%(seed,step,log[-1] if log else op,bad,errs[:2]),False); print('   storia:',log); break
        st=pg.evaluate("T.state()")
        check('seme %d: %d passi, tutti i solidi chiusi, nessun errore — %s'%(seed,len(log),st[:150]),not errs and not pg.evaluate("T.bad()"))
        # annulla tutto e ripeti tutto
        for _ in range(60): pg.evaluate("forma.undo()")
        pg.wait_for_timeout(1500)
        for _ in range(60): pg.evaluate("forma.redo()")
        pg.wait_for_timeout(2500)
        st2=pg.evaluate("T.state()")
        check('seme %d: annulla tutto e ripeti tutto torna uguale'%seed,st2==st and not pg.evaluate("T.bad()")); 
        if st2!=st: print('   prima ',st,'\n   dopo  ',st2)
    check('nessun errore',not errs); print('errs',errs[:3]); b.close()
print('TUTTO OK' if ok else 'ERRORI'); raise SystemExit(0 if ok else 1)
