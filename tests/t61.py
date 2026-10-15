# Blocca e Nascondi (menu e Livelli) entrano nella cronologia: Annulla e Ripeti li riportano
from playwright.sync_api import sync_playwright
ok=True
def check(name,cond):
    global ok; ok=ok and bool(cond); print('OK ' if cond else 'KO ',name)
def mk(pg,kind,x):
    pg.evaluate(f"forma.createObject('{kind}')");pg.wait_for_timeout(120)
    pg.fill('#p-x',str(x));pg.keyboard.press('Enter');pg.wait_for_timeout(100)
def st(pg): return pg.evaluate("forma.objects.map(o=>[!!o.userData.hidden,!!o.userData.locked,o.visible])")
def hist(pg): return pg.evaluate("document.querySelector('#history').innerText.replace(/\\n+/g,' | ')")
def scr(pg,i):
    return pg.evaluate(f"(()=>{{const m=forma.objects[{i}];const c=forma.worldBox(m).getCenter(new forma.THREE.Vector3());forma.camera.updateMatrixWorld(true);c.project(forma.camera);const r=document.querySelector('#view').getBoundingClientRect();return [(c.x+1)/2*r.width+r.left,(1-c.y)/2*r.height+r.top]}})()")
with sync_playwright() as p:
    b=p.chromium.launch(args=["--use-gl=swiftshader"]);pg=b.new_page(viewport={'width':1400,'height':850})
    errs=[];pg.on('pageerror',lambda e:errs.append(str(e)))
    pg.goto('file:///tmp/forma/dist/forma.html');pg.wait_for_function("window.forma");pg.wait_for_timeout(900)
    mk(pg,'box',-40);mk(pg,'box',40)
    # nascondi dal menu
    x,y=scr(pg,1);pg.mouse.click(x,y,button='right');pg.wait_for_timeout(200);pg.locator('#ctx button',has_text='Nascondi').click();pg.wait_for_timeout(200)
    check('nascosto',st(pg)[1]==[True,False,False])
    pg.keyboard.press('Control+z');pg.wait_for_timeout(250)
    check('annulla: torna visibile e selezionato',st(pg)[1]==[False,False,True] and pg.evaluate("forma.selection.length")==1)
    pg.keyboard.press('Control+Shift+z');pg.wait_for_timeout(250)
    check('ripeti: di nuovo nascosto',st(pg)[1]==[True,False,False])
    pg.keyboard.press('Control+z');pg.wait_for_timeout(200)
    # blocca dal menu
    pg.evaluate("forma.setSelection([forma.objects[0]])")
    x,y=scr(pg,0);pg.mouse.click(x,y,button='right');pg.wait_for_timeout(200);pg.locator('#ctx button',has_text='Blocca').click();pg.wait_for_timeout(200)
    check('bloccato',st(pg)[0]==[False,True,True])
    pg.keyboard.press('Control+z');pg.wait_for_timeout(250);check('annulla: sbloccato',st(pg)[0]==[False,False,True])
    # dai Livelli
    pg.keyboard.press('F7');pg.wait_for_timeout(300)
    pg.evaluate("forma.setSelection([])")
    pg.locator('#layers-list .lrow:not(.grp) .lbt').first.click();pg.wait_for_timeout(200)
    s1=st(pg);check('Livelli: un pulsante cambia uno stato',any(a or l for a,l,_ in s1))
    pg.keyboard.press('Control+z');pg.wait_for_timeout(250);check('annulla dai Livelli',all(not a and not l for a,l,_ in st(pg)))
    # cronologia e ripetibilità dopo altre operazioni
    pg.evaluate("forma.setSelection([forma.objects[1]])");pg.keyboard.press('Delete');pg.wait_for_timeout(150)
    pg.evaluate("forma.setSelection([forma.objects[0]])");x,y=scr(pg,0);pg.mouse.click(x,y,button='right');pg.wait_for_timeout(200);pg.locator('#ctx button',has_text='Nascondi').click();pg.wait_for_timeout(200)
    pg.keyboard.press('F8');pg.wait_for_timeout(300);print(hist(pg))
    check('etichetta in cronologia',('Nascosto' in hist(pg)))
    pg.keyboard.press('Control+z');pg.keyboard.press('Control+z');pg.wait_for_timeout(250);check('due annulla: tornano oggetto eliminato e visibilità',len(st(pg))==2 and all(not a for a,l,_ in st(pg)))
    check('nessun errore',not errs);print(errs)
    b.close()
print('TUTTO OK' if ok else 'FALLITO')
