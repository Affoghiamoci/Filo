# 1.3.2: pezzi non chiusi. Combina avvisa e propone la riparazione sperimentale; Controlla ha lo stesso pulsante.
from playwright.sync_api import sync_playwright
ok=True
def check(name,cond):
    global ok; ok=ok and bool(cond); print('OK ' if cond else 'KO ',name)
CRACK="""(()=>{const o=forma.objects[0],g=o.geometry.clone();const P=g.attributes.position;
  const ng=g.index?g.toNonIndexed():g;const A=ng.attributes.position;
  for(let t=0;t<A.count;t+=3){ if((t/3)%5===0){ A.setX(t,A.getX(t)+0.0025); } }   // vertici scostati di 2,5 µm: più della tolleranza di 1 µm, crepe vere
  A.needsUpdate=true; ng.computeVertexNormals(); o.geometry=ng; o.userData.geo=ng; return forma.openEdgeCount(ng)})()"""
with sync_playwright() as p:
    b=p.chromium.launch(args=["--use-gl=swiftshader"]);pg=b.new_page(viewport={'width':1300,'height':900})
    errs=[];pg.on('pageerror',lambda e:errs.append(str(e)))
    def start():
        pg.goto('file:///tmp/forma/dist/forma.html');pg.wait_for_function("window.forma&&forma.MM()");pg.wait_for_timeout(500)
    def box(w,d,h,x=0):
        pg.evaluate("forma.createObject('box')");pg.wait_for_timeout(100)
        for k,v in [('w',w),('d',d),('h',h),('x',x)]: pg.fill('#p-'+k,str(v));pg.keyboard.press('Enter')
    def comb(w=800):
        pg.evaluate("setTimeout(()=>{forma.setSelection(forma.objects);forma.combine('union')},0)");pg.wait_for_timeout(w)
    def damaged():
        start(); box(30,30,20); box(20,20,30,10)
        comb(500);pg.wait_for_function("forma.objects.length===1",timeout=60000);pg.wait_for_timeout(300)
        n=pg.evaluate(CRACK); return n
    # 1) Controlla: avviso + Ripara
    n=damaged(); check('pezzo danneggiato di prova: %d spigoli aperti'%n,n>0)
    pg.evaluate("forma.openCheck()"); pg.wait_for_function("!document.querySelector('#chk-body').classList.contains('hidden')",timeout=90000); pg.wait_for_timeout(300)
    check('Controlla: "Solido non chiuso" con pulsante Ripara',pg.is_visible('#chk-fix') and 'non chiuso' in pg.inner_text('#chk-list'))
    check('Controlla: scritto che è sperimentale','sperimentale' in pg.inner_text('#chk-list').lower())
    pg.click('#chk-fix'); pg.wait_for_timeout(3500)
    pg.wait_for_function("!document.querySelector('#chk-body').classList.contains('hidden')",timeout=90000); pg.wait_for_timeout(500)
    check('dopo Ripara: spigoli aperti = 0',pg.evaluate("forma.objects.every(o=>forma.openEdgeCount(o.geometry)===0)"))
    check('dopo Ripara: Controlla dice "Solido chiuso"','Solido chiuso' in pg.inner_text('#chk-list'))
    # 2) Combina con un pezzo non chiuso: finestra di avviso
    n=damaged(); box(20,20,20,25)
    comb()
    check('Combina: compare l\'avviso sui pezzi non chiusi',pg.evaluate("document.querySelector('#dlg-open').open"))
    check('Combina: nel testo il nome del pezzo e la parola sperimentale','sperimentale' in pg.inner_text('#dlg-open').lower())
    pg.click('#open-cancel'); pg.wait_for_timeout(500)
    check('Annulla: non cambia nulla (2 oggetti, uno ancora aperto)',pg.evaluate("forma.objects.length")==2 and pg.evaluate("forma.objects.some(o=>forma.openEdgeCount(o.geometry)>0)"))
    comb()
    pg.click('#open-fix'); pg.wait_for_function("forma.objects.length===1",timeout=90000); pg.wait_for_timeout(800)
    check('Ripara e combina: un solo pezzo chiuso',pg.evaluate("forma.objects.length")==1 and pg.evaluate("forma.openEdgeCount(forma.objects[0].geometry)")==0)
    pg.evaluate("forma.undo()"); pg.wait_for_timeout(800)
    check('⌘Z riporta i pezzi di prima',pg.evaluate("forma.objects.length")>=2)
    # 3) Combina comunque
    n=damaged(); box(20,20,20,25)
    comb()
    pg.click('#open-skip'); pg.wait_for_function("forma.objects.length>=1",timeout=60000); pg.wait_for_timeout(2500)
    check('Combina comunque: procede senza riparare (finestra chiusa)',not pg.evaluate("document.querySelector('#dlg-open').open"))
    # 4) pezzi chiusi: nessun avviso
    start(); box(20,20,20); box(20,20,20,10)
    comb(2500)
    check('pezzi chiusi: nessun avviso, un solo pezzo',not pg.evaluate("document.querySelector('#dlg-open').open") and pg.evaluate("forma.objects.length")==1)
    check('nessun errore di pagina',not errs); print(errs[:3]); b.close()
print('TUTTO OK' if ok else 'ERRORI'); raise SystemExit(0 if ok else 1)
