# 1.1.0: progetti veri dall'inizio alla fine (posacenere, vaso esagonale rigato, scatolina con coperchio, gancio, blocco con vite, portapenne a L),
# ognuno chiuso e stampabile, esportato in 3MF e STL e reimportato con lo stesso volume, ripreso dopo il riavvio, anche in inglese
from playwright.sync_api import sync_playwright
ok=True
def check(name,cond):
    global ok; ok=ok and bool(cond); print('OK ' if cond else 'KO ',name)
LIB="""window.T={
 vol(o){const P=forma.worldPositions(o);let v=0;for(let i=0;i<P.length;i+=9){const a=[P[i],P[i+1],P[i+2]],b=[P[i+3],P[i+4],P[i+5]],c=[P[i+6],P[i+7],P[i+8]];v+=(a[0]*(b[1]*c[2]-b[2]*c[1])-a[1]*(b[0]*c[2]-b[2]*c[0])+a[2]*(b[0]*c[1]-b[1]*c[0]))/6}return v},
 man(o){const m=forma.MM();const P=o.geometry.attributes.position,I=o.geometry.index;try{const me=new m.Mesh({numProp:3,vertProperties:new Float32Array(P.array),triVerts:new Uint32Array(I?I.array:[...Array(P.count).keys()])});me.merge();const mm=new m.Manifold(me);const s=mm.status();const g=mm.genus();mm.delete();return s=='NoError'&&forma.openEdgeCount(o.geometry)==0?'ok':s}catch(e){return 'ERR '+(e.code||e.message)}},
 all(){return forma.objects.filter(o=>!o.userData.hole).map(o=>T.man(o))},
 total(){return forma.objects.filter(o=>!o.userData.hole).reduce((s,o)=>s+T.vol(o),0)},
};"""
TOAST="document.querySelector('#toast')?.textContent||''"
O='/tmp/claude-0/-home-claude/855145e8-0c7f-5220-a7bc-901db1b32e0d/scratchpad/out/'
with sync_playwright() as p:
    b=p.chromium.launch(args=["--use-gl=swiftshader"]);pg=b.new_page(viewport={'width':1300,'height':900})
    errs=[];pg.on('pageerror',lambda e:errs.append(str(e)))
    def start():
        pg.goto('file:///tmp/forma/dist/forma.html');pg.wait_for_function("window.forma&&forma.MM()");pg.wait_for_timeout(500);pg.evaluate(LIB)
    def mk(kind,d,hole=False):
        pg.evaluate("forma.createObject('%s')"%kind);pg.wait_for_timeout(120)
        for k,v in d: pg.fill('#p-'+k,str(v));pg.keyboard.press('Enter')
        if hole: pg.evaluate("forma.toggleHole()")
        pg.wait_for_timeout(80)
    def sel(idx): pg.evaluate("forma.setSelection(%s)"%('forma.objects' if idx is None else '[forma.objects[%d]]'%idx)); pg.wait_for_timeout(150)
    def union(idx=None):
        sel(idx); n=pg.evaluate("forma.objects.length")
        pg.evaluate("forma.combine('union')");pg.wait_for_function("forma.objects.length<%d"%n,timeout=90000);pg.wait_for_timeout(300)
    def rev(n,depth,shape,twist,margin,wall,bottom,idx=0):
        sel(idx)
        for id_,v in [('rv-n',n),('rv-depth',depth),('rv-twist',twist),('rv-margin',margin),('rv-wall',wall),('rv-bottom',bottom)]: pg.fill('#'+id_,str(v))
        pg.click('#rv-shape [data-v=%s]'%shape); pg.click('#rv-go'); pg.wait_for_timeout(2500)
    def roundtrip(tag):
        v0=pg.evaluate("T.total()")
        r=pg.evaluate("""(async()=>{const list=forma.objects.filter(o=>!o.userData.hole);const d3=forma.build3MF(list);const st=forma.exportSTL('x');
           const before=forma.objects.length;await forma.importFiles([new File([d3],'p.3mf')]);const a=forma.objects.slice(before);
           const v3=a.reduce((s,o)=>s+T.vol(o),0),c3=a.map(o=>T.man(o));a.forEach(o=>{forma.setSelection([o])});
           const b2=forma.objects.length;const pr=forma.importFiles([new File([st],'p.stl')]);for(let k=0;k<40;k++){await new Promise(r=>setTimeout(r,100));const dl=document.querySelector('#dlg-split');if(dl.open){dl.close('split');break}}await pr;const s=forma.objects.slice(b2);const vs=s.reduce((x,o)=>x+T.vol(o),0),cs=s.map(o=>T.man(o));
           return {v3,c3,vs,cs,n3:a.length}})()""")
        check('%s: 3MF reimportato (%d pezzi) volume %.0f = %.0f, chiuso %s; STL volume %.0f, chiuso %s'%(tag,r['n3'],r['v3'],v0,r['c3'],r['vs'],r['cs']),
              abs(r['v3']-v0)<0.002*v0+1 and abs(r['vs']-v0)<0.002*v0+1 and all(c=='ok' for c in r['c3']+r['cs']))
    def shot(name): pg.evaluate("forma.fitView&&forma.fitView()"); pg.wait_for_timeout(400); pg.screenshot(path=O+name,clip={'x':330,'y':120,'width':640,'height':600})

    # 1. POSACENERE: cilindro 90×30 svuotato, tre tacche per le sigarette sul bordo
    start(); mk('cylinder',[('w',90),('d',90),('h',30)])
    rev(0,1,'round',0,0,3,3)
    v=pg.evaluate("T.vol(forma.objects[0])"); import math; exp=math.pi*45**2*30-math.pi*42**2*27
    check('posacenere svuotato: a rotazione, volume %.0f (atteso %.0f)'%(v,exp),pg.evaluate("forma.objects[0].userData.kind")=='rev' and abs(v-exp)<0.01*exp)
    for a in [0,120,240]:
        mk('cylinder',[('w',10),('d',10),('h',100),('rx',90),('rz',a)],hole=True)
        pg.evaluate("(()=>{const o=forma.objects.at(-1);const b=forma.worldBox(o),c=b.getCenter(new forma.THREE.Vector3());o.position.x+=-c.x;o.position.y+=-c.y;o.position.z+=30-c.z;o.updateMatrixWorld(true)})()")
    union()
    v2=pg.evaluate("T.vol(forma.objects[0])")
    check('posacenere con tre tacche: un pezzo, chiuso (%s), tolti %.0f mm³'%(pg.evaluate("T.all()"),v-v2),pg.evaluate("forma.objects.length")==1 and pg.evaluate("T.all()")==['ok'] and 400<v-v2<900)
    shot('p-posacenere.png'); roundtrip('posacenere')

    # 2. VASO ESAGONALE: prisma 70×120 Cima 80 %, 48 righe tonde da 1 mm con torsione 30°, pareti 2, fondo 3
    start(); mk('prism',[('w',70),('d',70),('h',120),('t',80)])
    rev(48,1,'round',30,6,2,3)
    check('vaso esagonale: sec, chiuso (%s)'%pg.evaluate("T.all()"),pg.evaluate("forma.objects[0].userData.kind")=='sec' and pg.evaluate("T.all()")==['ok'])
    s=pg.evaluate("forma.sizeOf(forma.objects[0])"); check('misure tenute %s'%s,abs(s['h']-120)<0.01)
    shot('p-vaso-esagonale.png'); roundtrip('vaso esagonale')
    pg.evaluate("forma.saveLast()"); pg.wait_for_timeout(200); v0=pg.evaluate("T.total()")
    pg.reload(); pg.wait_for_function("window.forma"); pg.evaluate(LIB); pg.evaluate("forma.restoreLast()"); pg.wait_for_function("forma.objects.length>0&&forma.MM()",timeout=20000); pg.wait_for_timeout(1000)
    check('vaso ripreso dopo il riavvio: stesso volume (%.0f)'%pg.evaluate("T.total()"),abs(pg.evaluate("T.total()")-v0)<1 and pg.evaluate("forma.objects[0].userData.kind")=='sec')

    # 3. SCATOLINA CON COPERCHIO: scatola arrotondata svuotata + coperchio con il bordino che entra
    start(); mk('box',[('w',60),('d',40),('h',30),('r',4)])
    rev(0,1,'round',0,0,2,2)
    mk('box',[('w',60),('d',40),('h',3),('r',4),('x',80),('y',0)]); mk('box',[('w',55.6),('d',35.6),('h',3),('r',2),('x',80),('y',0),('z',3)])
    union(None) if False else None
    pg.evaluate("forma.setSelection([forma.objects[1],forma.objects[2]])"); pg.evaluate("forma.combine('union')"); pg.wait_for_function("forma.objects.length===2",timeout=60000); pg.wait_for_timeout(300)
    check('scatolina e coperchio: due pezzi chiusi (%s)'%pg.evaluate("T.all()"),pg.evaluate("T.all()")==['ok','ok'])
    gap=pg.evaluate("(()=>{const s=forma.objects.find(o=>o.userData.kind==='sec');const P=s.userData.p;return P.shell.t})()")
    check('gioco del coperchio: interno 56 × 36, bordino 55,6 × 35,6 (0,2 mm per lato), pareti %s'%gap,gap==2)
    shot('p-scatolina.png'); roundtrip('scatolina')

    # 4. GANCIO A MURO: piastra + braccio + punta, due fori svasati per le viti
    start(); mk('box',[('w',30),('d',5),('h',60)]); mk('box',[('w',30),('d',40),('h',6),('y',22.5)]); mk('box',[('w',30),('d',6),('h',16),('y',39.5)])
    for z in [15,45]:
        mk('cylinder',[('w',4.5),('d',4.5),('h',20),('rx',90),('x',0),('y',-8),('z',z-2.25)],hole=True)
        mk('cone',[('q',50),('w',9),('d',9),('h',3),('rx',-90),('x',0),('y',1.0),('z',z-4.5)],hole=True)
    union()
    check('gancio: un pezzo chiuso (%s)'%pg.evaluate("T.all()"),pg.evaluate("forma.objects.length")==1 and pg.evaluate("T.all()")==['ok'])
    pg.evaluate("forma.setTool('edge')"); pg.wait_for_timeout(200)
    pg.evaluate("(()=>{const o=forma.objects[0];const b=forma.worldBox(o);forma.selectEdgeAt({object:o,point:new forma.THREE.Vector3(0,2.5,6)},false)})()"); pg.wait_for_timeout(250)
    pg.evaluate("forma.edgeMode.v='fillet'"); pg.fill('#e-size','4'); pg.click('#e-go'); pg.wait_for_timeout(3000)
    pg.evaluate("forma.setTool('move')"); pg.wait_for_timeout(200)
    check('gancio con il raccordo interno: chiuso (%s), messaggio %s'%(pg.evaluate("T.all()"),pg.evaluate(TOAST)),pg.evaluate("T.all()")==['ok'])
    shot('p-gancio.png'); roundtrip('gancio')

    # 5. BLOCCO DEL LETTO 40×80×78 con foro per la vite (5 mm, profondo 40) e svasatura
    start(); mk('box',[('w',40),('d',80),('h',78)])
    mk('cylinder',[('w',5),('d',5),('h',40),('x',0),('y',0),('z',38.5)],hole=True)
    mk('cone',[('q',300),('w',10),('d',10),('h',2.5),('x',0),('y',0),('z',75.6)],hole=True)
    pg.evaluate("(()=>{const o=forma.objects.at(-1);const b=forma.worldBox(o);o.position.z+=78.01-b.max.z;o.updateMatrixWorld(true)})()")
    union()
    v=pg.evaluate("T.vol(forma.objects[0])"); full=40*80*78
    check('blocco con foro vite: chiuso (%s), tolto %.0f mm³'%(pg.evaluate("T.all()"),full-v),pg.evaluate("T.all()")==['ok'] and 800<full-v<1000)
    shot('p-blocco.png'); roundtrip('blocco')

    # 6. PORTAPENNE A L: due scatole alte uguali unite, righe squadrate faccia per faccia, svuotato
    start(); mk('box',[('w',70),('d',25),('h',90),('x',0),('y',0)]); mk('box',[('w',25),('d',45),('h',90),('x',-22.5),('y',35)])
    union()
    rev(56,1,'square',0,5,2,3)
    check('portapenne a L: sec, chiuso (%s)'%pg.evaluate("T.all()"),pg.evaluate("forma.objects[0].userData.kind")=='sec' and pg.evaluate("T.all()")==['ok'])
    pg.fill('#p-h','70'); pg.keyboard.press('Enter'); pg.wait_for_timeout(1500)
    check('portapenne abbassato a 70: chiuso, alto 70',pg.evaluate("T.all()")==['ok'] and abs(pg.evaluate("forma.sizeOf(forma.objects[0]).h")-70)<0.01)
    pg.evaluate("forma.undo()"); pg.wait_for_timeout(1200); check('⌘Z: di nuovo 90',abs(pg.evaluate("forma.sizeOf(forma.objects[0]).h")-90)<0.01)
    pg.evaluate("forma.redo()"); pg.wait_for_timeout(1200); check('⇧⌘Z: di nuovo 70',abs(pg.evaluate("forma.sizeOf(forma.objects[0]).h")-70)<0.01 and pg.evaluate("T.all()")==['ok'])
    shot('p-portapenne.png'); roundtrip('portapenne')
    # Controlla sul portapenne
    pg.evaluate("forma.openCheck()"); pg.wait_for_timeout(2500)
    txt=pg.evaluate("document.querySelector('#chk')?.innerText||document.querySelector('[id^=chk]')?.innerText||''")
    print('   Controlla:',txt[:300].replace('\n',' | '))
    # 7. in inglese
    pg.keyboard.press('Escape'); pg.wait_for_timeout(200)
    pg.click('#lang [data-lang=en]'); pg.wait_for_timeout(300); sel(0)
    check('pannello Righe e pareti senza testo superfluo',pg.inner_text('#rv-info')=='' and not pg.is_visible('#rv-info'))
    pg.fill('#rv-wall','40'); pg.evaluate("document.querySelector('#rv-go').click()"); pg.wait_for_timeout(1500)
    check('avviso in inglese: "%s"'%pg.evaluate(TOAST),'too thick' in pg.evaluate(TOAST))
    pg.fill('#rv-wall','45'); pg.wait_for_timeout(800)
    check('avviso in inglese anche nel pannello: "%s"'%pg.inner_text('#rv-info'),'too thick' in pg.inner_text('#rv-info'))
    pg.click('#lang [data-lang=it]'); pg.wait_for_timeout(200)
    check('nessun errore',not errs); print('errs',errs[:3]); b.close()
print('TUTTO OK' if ok else 'ERRORI'); raise SystemExit(0 if ok else 1)
