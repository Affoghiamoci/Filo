# Motore 1.0, fase 1: vista topologica (vertici saldati, facce piane con buchi, spigoli convessi/concavi, gruppi lisci, difetti)
from playwright.sync_api import sync_playwright
import time
ok=True
def check(name,cond):
    global ok; ok=ok and bool(cond); print('OK ' if cond else 'KO ',name)
INFO="""((i)=>{const o=forma.objects[i];const t0=performance.now();const tp=forma.topo(o);const ms=performance.now()-t0;const P=forma.worldPositions(o);const R=forma.triangulateTopo(tp);
return Object.assign({},tp.stats,{ms,vol:forma.soupVolume(P),volR:forma.soupVolume(R),smooth:tp.smoothGroups.length,loopsMax:Math.max(...tp.faces.map(f=>f.loops.length)),
 corners:tp.faces.map(f=>f.loops[0]?f.loops[0].corners.length:0).sort((a,b)=>b-a).slice(0,3)})})"""
def mk(pg,kind,dims):
    pg.evaluate("forma.createObject('%s')"%kind);pg.wait_for_timeout(150)
    for k,v in dims.items(): pg.fill('#p-'+k,str(v));pg.keyboard.press('Enter')
    pg.wait_for_timeout(100)
def fresh(pg):
    pg.reload();pg.wait_for_function("window.forma");pg.wait_for_timeout(700)
def info(pg,i=0): return pg.evaluate(INFO+"(%d)"%i)
def same_vol(s): return abs(s['vol']-s['volR'])<1e-3*max(1,abs(s['vol']))
with sync_playwright() as p:
    b=p.chromium.launch(args=["--use-gl=swiftshader"]);pg=b.new_page(viewport={'width':1400,'height':900})
    errs=[];pg.on('pageerror',lambda e:errs.append(str(e)))
    pg.goto('file:///tmp/forma/dist/forma.html');pg.wait_for_function("window.forma");pg.wait_for_timeout(900)
    # cubo
    mk(pg,'box',{'w':30,'d':20,'h':10}); s=info(pg); print('cubo',s)
    check('cubo: 8 vertici, 6 facce, 12 spigoli tutti convessi (12 pieghe)',s['verts']==8 and s['faces']==6 and s['edges']==12 and s['concaveEdges']==0 and s['creases']==12)
    check('cubo: chiuso, 1 pezzo, genere 0, nessun difetto',s['closed'] and s['components']==1 and s['genus']==0 and s['pinched']==0)
    check('cubo: ogni faccia ha 4 angoli',s['corners']==[4,4,4])
    check('cubo: ritriangolato ha lo stesso volume (%.1f / %.1f)'%(s['vol'],s['volR']),same_vol(s) and abs(s['vol']-6000)<0.5)
    # cilindro: 2 facce piane + 1 superficie liscia
    fresh(pg); mk(pg,'cylinder',{'w':20,'d':20,'h':30}); s=info(pg); print('cilindro',{k:s[k] for k in ['faces','smooth','sharpEdges','creases','genus']})
    check('cilindro: 3 gruppi (sopra, sotto, lato curvo)',s['smooth']==3)
    check('cilindro: 2 pieghe (bordo alto e basso)',s['creases']==2)
    check('cilindro: ritriangolato stesso volume',same_vol(s))
    # pezzo a L: uno spigolo interno (concavo)
    fresh(pg); mk(pg,'box',{'w':40,'d':20,'h':10,'x':0,'y':0,'z':0}); mk(pg,'box',{'w':20,'d':20,'h':30,'x':-10,'y':0,'z':0})
    pg.evaluate("forma.setSelection(forma.objects);forma.combine('union')");pg.wait_for_function("forma.objects.length===1",timeout=60000);pg.wait_for_timeout(300)
    s=info(pg); print('L',s)
    check('L: 8 facce, 1 spigolo concavo',s['faces']==8 and s['concaveEdges']==1)
    check('L: facce di testa con 6 angoli',s['corners'][0]==6)
    check('L: ritriangolato stesso volume (16000)',same_vol(s) and abs(s['vol']-16000)<0.5)
    # cornice: faccia con un buco, genere 1
    fresh(pg); mk(pg,'box',{'w':40,'d':40,'h':10,'x':0,'y':0,'z':0}); mk(pg,'box',{'w':20,'d':20,'h':30,'x':0,'y':0,'z':-10})
    pg.evaluate("forma.toggleHole([forma.objects[1]])"); pg.wait_for_timeout(100)
    pg.evaluate("forma.setSelection(forma.objects);forma.combine('union')");pg.wait_for_function("forma.objects.length===1",timeout=60000);pg.wait_for_timeout(300)
    s=info(pg); print('cornice',s)
    check('cornice: sopra e sotto hanno un buco ciascuno (buchi %d)'%s['holes'],s['holes']==2 and s['loopsMax']==2)
    check('cornice: genere 1 (un foro passante)',s['genus']==1)
    check('cornice: ritriangolata stesso volume (12000)',same_vol(s) and abs(s['vol']-12000)<0.5)
    # due cubi che si toccano solo lungo uno spigolo: difetto segnalato
    fresh(pg); mk(pg,'box',{'w':20,'d':20,'h':20,'x':0,'y':0,'z':0}); mk(pg,'box',{'w':20,'d':20,'h':20,'x':20,'y':20,'z':0})
    pg.evaluate("forma.setSelection(forma.objects);forma.combine('union')");pg.wait_for_timeout(2500)
    s=info(pg); print('spigolo condiviso',{k:s[k] for k in ['components','nonManifoldEdges','pinched','closed','openEdges']})
    check('spigolo condiviso: segnalato (pizzico o spigolo non-manifold)',s['pinched']>0 or s['nonManifoldEdges']>0 or s['components']==2)
    # sfera: tutto un gruppo liscio, velocità
    fresh(pg); mk(pg,'sphere',{'w':30,'d':30,'h':30}); s=info(pg); print('sfera',{k:s[k] for k in ['tris','faces','smooth','ms']})
    check('sfera: un solo gruppo liscio',s['smooth']==1)
    check('sfera: analisi veloce (%.0f ms per %d triangoli)'%(s['ms'],s['tris']),s['ms']<1500)
    # testo (lettere con buchi) e scatola con bordi raccordati: la ricostruzione deve reggere
    fresh(pg); pg.click('[data-eh=text]') if pg.locator('[data-eh=text]').count() else pg.evaluate("forma.createObject('text')"); pg.wait_for_timeout(1200)
    s=info(pg); print('testo',{k:s[k] for k in ['tris','faces','holes','components','closed','ms']})
    check('testo: chiuso, ritriangolato stesso volume (%.1f / %.1f)'%(s['vol'],s['volR']),s['closed'] and same_vol(s))
    check('testo: le lettere con l\'occhiello hanno buchi (%d)'%s['holes'],s['holes']>0)
    fresh(pg); mk(pg,'box',{'w':30,'d':30,'h':20,'r':4,'ft':3}); s=info(pg); print('scatola raccordata',{k:s[k] for k in ['faces','smooth','creases','closed']})
    check('scatola raccordata: chiusa e ritriangolata uguale',s['closed'] and same_vol(s))
    check('nessun errore',not errs); print('errs',errs); b.close()
print('TUTTO OK' if ok else 'ERRORI'); raise SystemExit(0 if ok else 1)
