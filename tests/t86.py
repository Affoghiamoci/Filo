# Controllo di tutti i campi numerici: virgola, punto e somme ovunque
from playwright.sync_api import sync_playwright
ok=True
def check(name,cond):
    global ok; ok=ok and bool(cond); print('OK ' if cond else 'KO ',name)
with sync_playwright() as p:
    b=p.chromium.launch(args=["--use-gl=swiftshader"]);pg=b.new_page(viewport={'width':1500,'height':950},locale='en-US')
    errs=[];pg.on('pageerror',lambda e:errs.append(str(e)))
    pg.goto('file:///tmp/forma/dist/forma.html');pg.wait_for_function("window.forma");pg.wait_for_timeout(900)
    # apri i campi creati dinamicamente (piatto personalizzato) per includerli
    pg.evaluate("document.querySelector('#b-bed').click()");pg.wait_for_timeout(200)
    allin=pg.evaluate("[...document.querySelectorAll('input')].map(i=>({id:i.id||i.name||'?',type:i.type,num:i.hasAttribute('data-num')}))")
    nums=[i for i in allin if i['num']]
    print('campi numerici:',len(nums))
    check('nessun type=number rimasto',not [i for i in allin if i['type']=='number'])
    check('tutti i campi numerici sono di testo',all(i['type']=='text' for i in nums))
    sel=lambda i:('#'+i['id']) if i['id'] not in ('?','') and not i['id'].startswith('?') else None
    # 1) somme e virgola, via eventi (vale anche per i campi nascosti)
    bad=[]
    BOXF=('w','d','h','t','g','r')
    for i in nums:
        if i['id'] in BOXF: continue
        r=pg.evaluate("""(id)=>{const el=document.getElementById(id)||document.querySelector('[name="'+id+'"]');if(!el)return null;
          const out={};
          const go=(v)=>{el.value=v;el.dispatchEvent(new Event('input',{bubbles:true}));el.dispatchEvent(new Event('change',{bubbles:true}));return el.value};
          out.sum=go('10+1');out.mul=go('(2+3)*2');out.comma=go('2,5');out.cs=go('1,5+1,5');out.junk=go('abc');return out}""",i['id'])
        if r is None: bad.append((i['id'],'non trovato')); continue
        exp=('11','10','3','3','') if i['id'] in ('rp-nx','rp-ny','rp-n','rp-arc') else ('11','10','2.5','3','')
        if (r['sum'],r['mul'],r['comma'],r['cs'],r['junk'])!=exp: bad.append((i['id'],r))
    check('somme, virgola e valori non validi su tutti i %d campi (%s)'%(len(nums),bad[:3]),not bad)
    # scatolina: dentro i limiti del campo, somme e virgola funzionano
    pg.evaluate("document.querySelector('#dlg-box').showModal()");pg.wait_for_timeout(200)
    for n,typ,exp in [('w','30+50','80'),('d','20+20,5','41'),('h','10+20','30'),('t','1,2+0,8','2'),('g','0,2+0,1','0.3'),('r','2+2','4')]:
        pg.fill('#box-form [name=%s]'%n,typ); pg.press('#box-form [name=%s]'%n,'Tab'); pg.wait_for_timeout(80)
        v=pg.input_value('#box-form [name=%s]'%n)
        check('scatolina %s: %s → %s (letto %s)'%(n,typ,exp,v),v==exp)
    pg.evaluate("document.querySelector('#dlg-box').close()")
    pg.reload();pg.wait_for_function("window.forma");pg.wait_for_timeout(700)
    # 2) digitazione vera nei campi visibili del pannello
    pg.evaluate("forma.createObject('box')");pg.wait_for_timeout(200)
    vis=pg.evaluate("[...document.querySelectorAll('input[data-num]')].filter(i=>i.offsetParent!==null&&i.id).map(i=>i.id)")
    print('visibili con un pezzo:',vis)
    badt=[]
    for id in vis:
        pg.click('#'+id); pg.keyboard.press('Control+A'); pg.keyboard.type('4,5+1,5'); pg.keyboard.press('Tab'); pg.wait_for_timeout(60)
        v=pg.input_value('#'+id)
        pg.click('#'+id); pg.keyboard.press('Control+A'); pg.keyboard.type('6'); pg.keyboard.press('Tab'); pg.wait_for_timeout(60)
        ref=pg.input_value('#'+id)   # stesso valore digitato "liscio" (tiene conto dei limiti del campo)
        if v!=ref: badt.append((id,v,ref))
    check('digitando 4,5+1,5 in ogni campo visibile → 6 (%s)'%badt[:4],not badt)
    # 3) effetto sul modello
    W=lambda k:pg.evaluate("forma.sizeOf(forma.objects[0]).%s"%k)
    for id,k in [('p-w','w'),('p-d','d'),('p-h','h')]:
        pg.click('#'+id); pg.keyboard.press('Control+A'); pg.keyboard.type('12+8'); pg.keyboard.press('Enter'); pg.wait_for_timeout(100)
        check('%s: 12+8 → 20 sul modello'%id,W(k)==20)
    for id,ax in [('p-x','x'),('p-y','y'),('p-z','z')]:
        pg.click('#'+id); pg.keyboard.press('Control+A'); pg.keyboard.type('3+4,5'); pg.keyboard.press('Enter'); pg.wait_for_timeout(100)
        check('%s: 3+4,5 → 7.5 sul modello'%id,abs(pg.evaluate("forma.objects[0].position.%s"%ax)-7.5)<1e-6 or (ax=='z' and abs(pg.evaluate("forma.objects[0].position.z")-7.5)<1e-6))
    # rotazione
    pg.click('#p-rz'); pg.keyboard.press('Control+A'); pg.keyboard.type('30+15'); pg.keyboard.press('Enter'); pg.wait_for_timeout(150)
    check('rotazione Z: 30+15 → 45°',abs(pg.evaluate("forma.objects[0].rotation.z*180/Math.PI")-45)<0.01 or abs(pg.evaluate("new forma.THREE.Euler().setFromQuaternion(forma.objects[0].quaternion,'ZYX').z*180/Math.PI")-45)<0.01)
    # raggio angoli
    pg.click('#p-r'); pg.keyboard.press('Control+A'); pg.keyboard.type('1+1'); pg.keyboard.press('Enter'); pg.wait_for_timeout(150)
    check('raggio angoli: 1+1 → 2',pg.evaluate("forma.objects[0].userData.p.r")==2)
    # piatto personalizzato
    pg.evaluate("document.querySelector('#b-bed').click()");pg.wait_for_timeout(200)
    if pg.locator('#bed-w').count() and pg.locator('#bed-w').is_visible():
        pg.click('#bed-w'); pg.keyboard.press('Control+A'); pg.keyboard.type('100+80'); pg.keyboard.press('Enter'); pg.wait_for_timeout(150)
        check('piatto L: 100+80 → 180',pg.evaluate("forma.bed[0]")==180)
    else: print('piatto personalizzato non aperto (saltato)')
    pg.evaluate("document.querySelector('#bedmenu').classList.add('hidden')")
    # Ripeti
    pg.evaluate("forma.setSelection([forma.objects[0]])");pg.wait_for_timeout(100)
    if pg.locator('#rp-nx').is_visible():
        pg.click('#rp-nx'); pg.keyboard.press('Control+A'); pg.keyboard.type('1+2'); pg.keyboard.press('Tab')
        pg.click('#rp-ny'); pg.keyboard.press('Control+A'); pg.keyboard.type('1'); pg.keyboard.press('Tab')
        pg.click('#rp-px'); pg.keyboard.press('Control+A'); pg.keyboard.type('5,5+1,5'); pg.keyboard.press('Tab'); pg.wait_for_timeout(300)
        check('Ripeti: colonne 1+2 → 3, spazio 5,5+1,5 → 7',pg.input_value('#rp-nx')=='3' and pg.input_value('#rp-px')=='7' and pg.evaluate("forma.repeatPreviewCount")==2)
    # Taglia: posizione del piano
    pg.evaluate("forma.setTool('cut')");pg.wait_for_timeout(300)
    if pg.locator('#cut-pos').is_visible():
        pg.click('#cut-pos'); pg.keyboard.press('Control+A'); pg.keyboard.type('5+5'); pg.keyboard.press('Tab'); pg.wait_for_timeout(150)
        check('Taglia: posizione 5+5 → 10',pg.evaluate("forma.CUT.pos")==10)
        pg.click('#cut-pos'); pg.keyboard.press('Control+A'); pg.keyboard.type('2,5'); pg.keyboard.press('Tab'); pg.wait_for_timeout(150)
        check('Taglia: posizione 2,5 → 2.5',pg.evaluate("forma.CUT.pos")==2.5)
    # Spigolo: misura del raccordo applicata con Invio
    pg.evaluate("forma.setTool('edge')");pg.wait_for_timeout(300)
    pg.evaluate("(()=>{const o=forma.objects[0];o.rotation.set(0,0,0);o.quaternion.identity();o.position.set(0,0,0);o.updateMatrixWorld(true)})()")
    sz=pg.evaluate("forma.sizeOf(forma.objects[0])")
    pg.evaluate("forma.selectEdgeAt({object:forma.objects[0],point:new forma.THREE.Vector3(%f,%f,%f)},false)"%(-sz['w']/2,-sz['d']/2,sz['h']/2))
    pg.wait_for_timeout(200)
    if pg.evaluate("forma.edgeSel().length")==1:
        pg.fill('#e-size','1+1,5'); pg.press('#e-size','Enter'); pg.wait_for_timeout(300)
        ed=pg.evaluate("JSON.stringify(forma.objects[0].userData.p.ed||null)")
        check('Spigolo: 1+1,5 + Invio → raccordo 2.5 (%s)'%ed[:60],'2.5' in ed)
    check('nessun errore',not errs); print('errs',errs); b.close()
print('TUTTO OK' if ok else 'ERRORI'); raise SystemExit(0 if ok else 1)
