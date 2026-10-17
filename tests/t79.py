# Tasto destro su un oggetto bloccato: voce Sblocca (anche tutto), selezione e cronologia
from playwright.sync_api import sync_playwright
ok=True
def check(name,cond):
    global ok; ok=ok and bool(cond); print('OK ' if cond else 'KO ',name)
with sync_playwright() as p:
    b=p.chromium.launch(args=["--use-gl=swiftshader"]);pg=b.new_page(viewport={'width':1400,'height':850})
    errs=[];pg.on('pageerror',lambda e:errs.append(str(e)))
    pg.goto('file:///tmp/forma/dist/forma.html');pg.wait_for_function("window.forma");pg.wait_for_timeout(900)
    pg.evaluate("document.querySelector('#empty-hint')&&document.querySelector('#empty-hint').classList.add('hidden')")
    pg.evaluate("(()=>{const f=forma;f.createObject('box');f.createObject('box');})()")
    pg.evaluate("(()=>{const o=forma.objects;o[0].position.x=-40;o[1].position.x=40;o[0].userData.name;forma.setSelection([o[0]]);forma.fitView();})()")
    pg.wait_for_timeout(300)
    scr=lambda i:pg.evaluate("""i=>{const o=forma.objects[i],v=new forma.THREE.Vector3();o.geometry.computeBoundingBox();o.localToWorld(v.copy(o.geometry.boundingBox.getCenter(new forma.THREE.Vector3())));v.project(forma.camera);const r=forma.canvas.getBoundingClientRect();return [r.left+(v.x+1)/2*r.width,r.top+(1-v.y)/2*r.height]}""",i)
    items=lambda:pg.evaluate("(()=>{const c=document.querySelector('#ctx');return c.classList.contains('hidden')?null:[...c.querySelectorAll('button span')].map(x=>x.textContent)})()")
    # blocca il primo dal menu
    x,y=scr(0); pg.mouse.click(x,y,button='right'); pg.wait_for_timeout(150)
    check('oggetto libero: menu con Blocca, senza Sblocca','Blocca' in (items() or []) and 'Sblocca' not in (items() or []))
    pg.locator('#ctx button',has_text='Blocca').click(); pg.wait_for_timeout(150)
    check('il primo è bloccato',pg.evaluate("forma.objects[0].userData.locked===true"))
    x,y=scr(0); pg.mouse.click(x,y,button='right'); pg.wait_for_timeout(150)
    it=items() or []
    check('sull\'oggetto bloccato compare Sblocca',it==['Sblocca'])
    pg.locator('#ctx button',has_text='Sblocca').click(); pg.wait_for_timeout(200)
    check('sbloccato e selezionato',pg.evaluate("forma.objects[0].userData.locked===false && forma.selection.includes(forma.objects[0])"))
    # annulla riporta il blocco, ripeti lo toglie
    pg.keyboard.press('Control+z'); pg.wait_for_timeout(150)
    check('Annulla ripristina il blocco',pg.evaluate("forma.objects[0].userData.locked===true"))
    # blocca entrambi, Sblocca tutto dal vuoto
    pg.evaluate("forma.objects.forEach(o=>o.userData.locked=true)")
    pg.mouse.click(700,120,button='right'); pg.wait_for_timeout(150)
    check('sul vuoto con bloccati: Sblocca tutto in cima',(items() or [''])[0]=='Sblocca tutto')
    pg.locator('#ctx button',has_text='Sblocca tutto').click(); pg.wait_for_timeout(200)
    check('tutti sbloccati',pg.evaluate("forma.objects.every(o=>!o.userData.locked)"))
    # EN
    pg.evaluate("document.querySelectorAll('#lang button')[1].click()"); pg.wait_for_timeout(200)
    pg.evaluate("forma.objects[0].userData.locked=true")
    x,y=scr(0); pg.mouse.click(x,y,button='right'); pg.wait_for_timeout(150)
    check('EN: Unlock',items()==['Unlock'] or (items() or [''])[0]=='Unlock')
    check('nessun errore',not errs)
    print('errs',errs); b.close()
print('TUTTO OK' if ok else 'ERRORI'); raise SystemExit(0 if ok else 1)
