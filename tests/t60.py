# Menu del tasto destro: apertura, voci per contesto, azioni, chiusura, orbita col destro intatta
from playwright.sync_api import sync_playwright
ok=True
def check(name,cond):
    global ok; ok=ok and bool(cond); print('OK ' if cond else 'KO ',name)
def mk(pg,kind,x,y,z,w,d,h):
    pg.evaluate(f"forma.createObject('{kind}')");pg.wait_for_timeout(120)
    for k,v in (('w',w),('d',d),('h',h),('x',x),('y',y),('z',z)):
        pg.fill('#p-'+k,str(v));pg.keyboard.press('Enter')
    pg.wait_for_timeout(120)
def menu(pg): return pg.evaluate("(()=>{const m=document.querySelector('#ctx');return m.classList.contains('hidden')?null:[...m.querySelectorAll('button')].map(b=>b.querySelector('span').textContent+(b.disabled?'(off)':'')+(b.classList.contains('on')?'*':''))})()")
def screen(pg,i=0):  # centro schermo dell'oggetto i
    return pg.evaluate(f"(()=>{{const m=forma.objects[{i}];const b=forma.worldBox(m);const c=b.getCenter(new forma.THREE.Vector3());forma.camera.updateMatrixWorld(true);c.project(forma.camera);const r=document.querySelector('#view').getBoundingClientRect();return [(c.x+1)/2*r.width+r.left,(1-c.y)/2*r.height+r.top]}})()")
with sync_playwright() as p:
    b=p.chromium.launch(args=["--use-gl=swiftshader"]);pg=b.new_page(viewport={'width':1400,'height':850})
    errs=[];pg.on('pageerror',lambda e:errs.append(str(e)))
    pg.goto('file:///tmp/forma/dist/forma.html');pg.wait_for_function("window.forma");pg.wait_for_timeout(900)
    # vuoto
    pg.mouse.click(450,400,button='right');pg.wait_for_timeout(200)
    check('vuoto: menu corto',menu(pg)==['Incolla(off)','Seleziona tutto(off)','Inquadra tutto','Raggi X','Misure'])
    pg.keyboard.press('Escape');pg.wait_for_timeout(100);check('Esc chiude',menu(pg) is None)
    # orbita col destro: trascinando non si apre
    pg.mouse.move(450,400);pg.mouse.down(button='right');pg.mouse.move(520,380,steps=5);pg.mouse.up(button='right');pg.wait_for_timeout(150)
    check('trascinando col destro non si apre',menu(pg) is None)
    # un oggetto
    mk(pg,'box',0,0,10,20,20,20);mk(pg,'box',40,0,0,20,20,20)
    pg.evaluate("forma.setSelection([])")
    x,y=screen(pg,0);pg.mouse.click(x,y,button='right');pg.wait_for_timeout(250)
    check('sotto il clic si seleziona',pg.evaluate("forma.selection.length")==1 and pg.evaluate("forma.selection[0]===forma.objects[0]"))
    check('oggetto singolo',menu(pg)==['Duplica','Copia','Trasforma in foro','Appoggia a terra','Blocca','Nascondi','Elimina'])
    pg.screenshot(path='/tmp/ctx_one.png',clip={'x':max(0,x-100),'y':max(0,y-100),'width':420,'height':380})
    # appoggia a terra
    pg.locator('#ctx button',has_text='Appoggia').click();pg.wait_for_timeout(200)
    check('appoggia a terra',abs(pg.evaluate("forma.worldBox(forma.objects[0]).min.z"))<1e-3 and menu(pg) is None)
    # duplica
    x,y=screen(pg,0);pg.mouse.click(x,y,button='right');pg.wait_for_timeout(200)
    pg.locator('#ctx button',has_text='Duplica').click();pg.wait_for_timeout(200)
    check('duplica',len(pg.evaluate("forma.objects"))==3)
    pg.keyboard.press('Control+z');pg.wait_for_timeout(200)
    # foro e ritorno
    x,y=screen(pg,0);pg.mouse.click(x,y,button='right');pg.wait_for_timeout(200)
    pg.locator('#ctx button',has_text='Trasforma in foro').click();pg.wait_for_timeout(200)
    check('foro',pg.evaluate("forma.objects[0].userData.hole")==True)
    pg.mouse.click(x,y,button='right');pg.wait_for_timeout(200)
    check('etichetta cambia in solido',menu(pg) and menu(pg)[2]=='Trasforma in solido');pg.keyboard.press('Escape')
    pg.evaluate("forma.setSelection([forma.objects[0]])");pg.keyboard.press('x');pg.wait_for_timeout(100)
    # più oggetti
    pg.evaluate("forma.setSelection([...forma.objects])")
    x,y=screen(pg,0);pg.mouse.click(x,y,button='right');pg.wait_for_timeout(250)
    check('selezione multipla mantenuta',pg.evaluate("forma.selection.length")==2)
    m=menu(pg);check('più oggetti: Combina, Interseca, Raggruppa',m and ['Combina','Interseca','Raggruppa']==[v for v in m if v in('Combina','Interseca','Raggruppa')])
    pg.locator('#ctx button',has_text='Raggruppa').click();pg.wait_for_timeout(200)
    x,y=screen(pg,0);pg.mouse.click(x,y,button='right');pg.wait_for_timeout(200)
    check('gruppo: Separa gruppo',menu(pg) and 'Separa gruppo' in menu(pg) and 'Raggruppa' not in menu(pg));pg.keyboard.press('Escape')
    # blocca/nascondi
    pg.evaluate("forma.setSelection([forma.objects[1]])")
    x,y=screen(pg,1);pg.mouse.click(x,y,button='right');pg.wait_for_timeout(200)
    pg.locator('#ctx button',has_text='Nascondi').click();pg.wait_for_timeout(200)
    check('nascondi: sparisce e si deseleziona',pg.evaluate("forma.objects.some(o=>o.userData.hidden)") and pg.evaluate("forma.selection.length")==0)
    # chiusure: tastiera, clic fuori, rotella
    pg.mouse.click(800,700,button='right');pg.wait_for_timeout(150);check('apre sul vuoto',menu(pg) is not None)
    pg.keyboard.press('ArrowDown');pg.keyboard.press('ArrowDown');pg.wait_for_timeout(80)
    check('frecce scorrono le voci',pg.evaluate("document.activeElement.closest('#ctx')!==null"))
    pg.mouse.click(300,300);pg.wait_for_timeout(100);check('clic fuori chiude',menu(pg) is None)
    pg.mouse.click(800,700,button='right');pg.wait_for_timeout(150);pg.mouse.wheel(0,100);pg.wait_for_timeout(100);check('rotella chiude',menu(pg) is None)
    pg.mouse.click(800,700,button='right');pg.wait_for_timeout(150);pg.keyboard.press('v');pg.wait_for_timeout(100);check('altro tasto chiude',menu(pg) is None)
    # raggi X da menu
    pg.mouse.click(800,700,button='right');pg.wait_for_timeout(150)
    pg.locator('#ctx button',has_text='Raggi X').click();pg.wait_for_timeout(150)
    pg.mouse.click(800,700,button='right');pg.wait_for_timeout(150);check('Raggi X acceso, con indicatore',menu(pg) and 'Raggi X*' in menu(pg));pg.keyboard.press('Escape')
    # il menu laterale degli strumenti e il suo clic destro restano indipendenti
    pg.locator('#tools .grp[data-g=comb]').click(button='right');pg.wait_for_timeout(150)
    check('clic destro sugli strumenti: menu varianti, non questo',pg.evaluate("!document.querySelector('#flyout').classList.contains('hidden')") and menu(pg) is None)
    # sempre dentro lo schermo
    pg.keyboard.press('Escape');pg.mouse.click(1390,845,button='right');pg.wait_for_timeout(200)
    check('vicino al bordo resta nello schermo',pg.evaluate("(()=>{const r=document.querySelector('#ctx').getBoundingClientRect();return r.right<=innerWidth&&r.bottom<=innerHeight&&r.left>=0&&r.top>=0})()"))
    pg.screenshot(path='/tmp/ctx_edge.png')
    check('nessun errore',not errs); print(errs)
    b.close()
print('TUTTO OK' if ok else 'FALLITO')
