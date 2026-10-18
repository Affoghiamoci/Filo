# 1.1.0: Righe e Svuota sui pezzi che salgono dritti (scatole, prismi anche rastremati, forme a L, pezzi con un buco passante)
from playwright.sync_api import sync_playwright
ok=True
def check(name,cond):
    global ok; ok=ok and bool(cond); print('OK ' if cond else 'KO ',name)
VOL="""(()=>{const o=forma.objects[0];const g=o.geometry,P=g.attributes.position,I=g.index;let v=0;const n=I?I.count:P.count;const f=i=>I?I.getX(i):i;for(let t=0;t<n;t+=3){const A=f(t),B=f(t+1),C=f(t+2);const ax=P.getX(A),ay=P.getY(A),az=P.getZ(A),bx=P.getX(B),by=P.getY(B),bz=P.getZ(B),cx=P.getX(C),cy=P.getY(C),cz=P.getZ(C);v+=(ax*(by*cz-bz*cy)-ay*(bx*cz-bz*cx)+az*(bx*cy-by*cx))/6}return v})()"""
OPEN="forma.openEdgeCount(forma.objects[0].geometry)"
MAN="(()=>{const o=forma.objects[0];const b=new forma.Brush(o.geometry);const m=forma.MM();const P=o.geometry.attributes.position;const I=o.geometry.index;const vp=new Float32Array(P.array);const tv=new Uint32Array(I?I.array:[...Array(P.count).keys()]);try{const me=new m.Mesh({numProp:3,vertProperties:vp,triVerts:tv});me.merge();const mm=new m.Manifold(me);const s=mm.status();mm.delete();return s}catch(e){return 'ERR '+(e.code||e.message||e)}})()"
TOAST="document.querySelector('#toast')?.textContent||''"
KIND="forma.objects[0].userData.kind"
O='/tmp/claude-0/-home-claude/855145e8-0c7f-5220-a7bc-901db1b32e0d/scratchpad/out/'
with sync_playwright() as p:
    b=p.chromium.launch(args=["--use-gl=swiftshader"]);pg=b.new_page(viewport={'width':1300,'height':900})
    errs=[];pg.on('pageerror',lambda e:errs.append(str(e)))
    def start():
        pg.goto('file:///tmp/forma/dist/forma.html');pg.wait_for_function("window.forma&&forma.MM()");pg.wait_for_timeout(600)
    def mk(kind,d):
        pg.evaluate("forma.createObject('%s')"%kind);pg.wait_for_timeout(150)
        for k,v in d: pg.fill('#p-'+k,str(v));pg.keyboard.press('Enter')
        pg.wait_for_timeout(100)
    def fill(n,depth,shape,twist,margin,wall,bottom):
        for id_,v in [('rv-n',n),('rv-depth',depth),('rv-twist',twist),('rv-margin',margin),('rv-wall',wall),('rv-bottom',bottom)]: pg.fill('#'+id_,str(v))
        pg.click('#rv-shape [data-v=%s]'%shape)
    def go(wait=1500): pg.click('#rv-go'); pg.wait_for_timeout(wait)
    def closed():
        o,m=pg.evaluate(OPEN),pg.evaluate(MAN)
        if o or m!='NoError': print('   aperti',o,m)
        return o==0 and m=='NoError'
    def union():
        pg.evaluate("forma.setSelection(forma.objects);forma.combine('union')");pg.wait_for_function("forma.objects.length===1",timeout=60000);pg.wait_for_timeout(300)
        pg.evaluate("forma.setSelection([forma.objects[0]])");pg.wait_for_timeout(200)
    start()
    # 1. scatola
    mk('box',[('w',40),('d',30),('h',50)])
    check('pannello visibile sulla scatola',pg.is_visible('#p-rev'))
    fill(0,1,'round',0,0,0,2); go()
    v=pg.evaluate(VOL); check('scatola liscia: diventa "sec" (%s), stesso volume (%.1f)'%(pg.evaluate(KIND),v),pg.evaluate(KIND)=='sec' and abs(v-60000)<1 and closed())
    fill(0,1,'round',0,0,2,2); go()
    v=pg.evaluate(VOL); exp=60000-36*26*48
    check('svuotata pareti 2 fondo 2: volume %.1f (atteso %d), chiusa, messaggio "%s"'%(v,exp,pg.evaluate(TOAST)),abs(v-exp)<2 and closed() and 'Svuotato' in pg.evaluate(TOAST))
    fill(40,1,'square',0,0,2,2); go()
    v2=pg.evaluate(VOL); s=pg.evaluate("JSON.stringify(forma.sizeOf(forma.objects[0]))")
    check('40 righe quadre da 1 mm + pareti: chiusa (%s), volume cresce (%.0f), misure %s'%(closed(),v2,s),closed() and v2>v+500 and v2<v+0.75*1*50*140)
    # righe per faccia: ogni lato ha un numero intero di righe, quindi gli spigoli restano a filo (punto nello spigolo = senza rilievo)
    cor=pg.evaluate("(()=>{const P=forma.objects[0].geometry.attributes.position;let best=1e9;for(let i=0;i<P.count;i++){const x=Math.abs(P.getX(i)),y=Math.abs(P.getY(i));best=Math.min(best,Math.hypot(x-20,y-15))}return best})()")
    check('spigolo vivo al suo posto (distanza %.3f)'%cor,cor<0.01)
    pg.screenshot(path=O+'scatola-righe.png',clip={'x':330,'y':150,'width':640,'height':560})
    pg.fill('#p-w','60'); pg.keyboard.press('Enter'); pg.wait_for_timeout(1500)
    s=pg.evaluate("forma.sizeOf(forma.objects[0])")
    check('larghezza 60: resta sec, chiusa, L=%.2f'%s['w'],pg.evaluate(KIND)=='sec' and abs(s['w']-60)<0.01 and closed())
    fill(0,1,'round',0,0,2,2); go()
    v=pg.evaluate(VOL); exp=60*30*50-56*26*48
    check('a 60 mm le pareti restano da 2 mm: volume %.1f (atteso %d)'%(v,exp),abs(v-exp)<2)
    pg.evaluate("forma.undo()"); pg.wait_for_timeout(1200)
    check('⌘Z torna alle righe',pg.evaluate("forma.objects[0].userData.p.ribs.n")==40 and closed())
    fill(0,1,'round',0,0,20,2); go()
    check('pareti troppo spesse: avviso (%s)'%pg.evaluate(TOAST),'troppo spesse' in pg.evaluate(TOAST))
    fill(0,1,'round',0,0,2,60); go()
    check('fondo troppo spesso: avviso (%s)'%pg.evaluate(TOAST),'troppo spesso' in pg.evaluate(TOAST))
    # 2. esagono rastremato (Cima 70 %) con torsione e margine
    start(); mk('prism',[('w',40),('d',40),('h',60),('t',70)])
    fill(36,1.2,'round',60,4,2,3); go(3000)
    check('esagono con la cima al 70%%, torsione 60°, margine 4: sec (%s), chiuso'%pg.evaluate(KIND),pg.evaluate(KIND)=='sec' and closed())
    k=pg.evaluate("forma.objects[0].userData.p.k"); check('rastrematura riconosciuta (%.3f)'%k,abs(k-0.7)<0.01)
    pg.screenshot(path=O+'esagono-righe.png',clip={'x':330,'y':150,'width':640,'height':560})
    # 3. L: due scatole alte uguali unite
    start(); mk('box',[('w',40),('d',10),('h',30),('x',0),('y',0)]); mk('box',[('w',10),('d',30),('h',30),('x',-15),('y',10)])
    union()
    fill(0,1,'round',0,0,0,2); go()
    v=pg.evaluate(VOL); check('L unita: riconosciuta (%s), stesso volume (%.1f → atteso %d)'%(pg.evaluate(KIND),v,(400+200)*30),pg.evaluate(KIND)=='sec' and abs(v-18000)<2)
    fill(30,0.8,'point',0,0,1.5,2); go(2000)
    check('L con righe a punta e pareti 1,5: chiusa',closed())
    pg.screenshot(path=O+'elle-righe.png',clip={'x':330,'y':150,'width':640,'height':560})
    # 4. tubo quadrato: scatola con un buco passante
    start(); mk('box',[('w',30),('d',30),('h',20)])
    pg.evaluate("forma.createObject('cylinder')"); pg.wait_for_timeout(150)
    for k,v in [('w',12),('d',12),('h',30),('x',0),('y',0),('z',-5)]: pg.fill('#p-'+k,str(v));pg.keyboard.press('Enter')
    pg.evaluate("forma.toggleHole()"); pg.wait_for_timeout(100); union()
    fill(24,0.8,'round',0,0,0,2); go(2000)
    check('scatola col buco passante: riconosciuta (%s), righe solo fuori, chiusa'%pg.evaluate(KIND),pg.evaluate(KIND)=='sec' and closed())
    fill(0,1,'round',0,0,2,2); go(2000)
    v=pg.evaluate(VOL); check('svuotata attorno al buco: chiusa, volume %.0f'%v,closed() and v>0 and v<30*30*20-3.14*36*20)
    # 5. scatola arrotondata (raggio 6): niente spigoli vivi, le righe girano tutto attorno
    start(); mk('box',[('w',40),('d',40),('h',30)]); pg.fill('#p-r','6'); pg.keyboard.press('Enter'); pg.wait_for_timeout(200)
    fill(50,0.8,'round',0,0,2,2); go(2000)
    check('scatola arrotondata con righe e pareti: chiusa',pg.evaluate(KIND)=='sec' and closed())
    # 6. salvataggio e ripresa
    pg.evaluate("forma.saveLast()"); pg.wait_for_timeout(300); n0=pg.evaluate("forma.objects[0].geometry.attributes.position.count")
    pg.reload(); pg.wait_for_function("window.forma");pg.wait_for_timeout(500)
    pg.evaluate("forma.restoreLast()"); pg.wait_for_function("forma.objects.length===1&&forma.MM()",timeout=20000); pg.wait_for_timeout(800)
    check('ripreso dopo il riavvio: sec, chiuso, stessi vertici',pg.evaluate(KIND)=='sec' and closed() and pg.evaluate("forma.objects[0].geometry.attributes.position.count")==n0)
    # 7. pezzi non dritti: rifiuto
    start(); mk('box',[('w',20),('d',20),('h',20)]); mk('box',[('w',5),('d',5),('h',5),('x',12)]); union()
    go(); check('pezzo a gradino: avviso (%s)'%pg.evaluate(TOAST),'non lo è' in pg.evaluate(TOAST) and pg.evaluate(KIND)=='merged')
    check('nessun errore',not errs); print('errs',errs); b.close()
print('TUTTO OK' if ok else 'ERRORI'); raise SystemExit(0 if ok else 1)
