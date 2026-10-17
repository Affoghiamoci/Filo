# Stampo: dal blocco (primo selezionato) toglie gli altri; resta il vuoto
from playwright.sync_api import sync_playwright
ok=True
def check(name,cond):
    global ok; ok=ok and bool(cond); print('OK ' if cond else 'KO ',name)
BOX="(o=>{const b=forma.worldBox?forma.worldBox(o):new forma.THREE.Box3().setFromObject(o);return [b.min.x,b.max.x,b.min.y,b.max.y,b.min.z,b.max.z].map(v=>Math.round(v*10)/10)})"
with sync_playwright() as p:
    b=p.chromium.launch(args=["--use-gl=swiftshader"]);pg=b.new_page(viewport={'width':1400,'height':850})
    errs=[];pg.on('pageerror',lambda e:errs.append(str(e)))
    pg.goto('file:///tmp/forma/dist/forma.html');pg.wait_for_function("window.forma");pg.wait_for_timeout(900)
    def mk(w,d,h,x):
        pg.evaluate("forma.createObject('box')");pg.wait_for_timeout(150)
        for k,v in [('w',w),('d',d),('h',h),('x',x),('y','0'),('z','0')]: pg.fill('#p-'+k,str(v));pg.keyboard.press('Enter')
    mk(40,40,20,0); mk(15,40,20,-12.5); mk(15,40,20,12.5)
    check('3 oggetti',pg.evaluate("forma.objects.length")==3)
    pg.evaluate("forma.setSelection([forma.objects[1]])")
    pg.evaluate("forma.mold()"); pg.wait_for_timeout(300)
    check('un solo oggetto selezionato: avviso, niente cambia',pg.evaluate("forma.objects.length")==3)
    pg.evaluate("forma.setSelection([forma.objects[0],forma.objects[1],forma.objects[2]])")
    pg.evaluate("forma.mold()"); pg.wait_for_function("forma.objects.length===3",timeout=60000); pg.wait_for_timeout(300)
    objs=pg.evaluate("forma.objects.map(o=>"+BOX+"(o))")
    print(objs)
    stampo=[x for x in objs if abs((x[1]-x[0])-10)<0.5 and abs((x[3]-x[2])-40)<0.5 and abs((x[5]-x[4])-20)<0.5]
    check('resta un pezzo 10×40×20 (il vuoto)',len(stampo)==1)
    check('le due pareti restano',sum(1 for x in objs if abs((x[1]-x[0])-15)<0.5)==2)
    check('il blocco è stato sostituito (nessuno 40 largo)',not any(abs((x[1]-x[0])-40)<0.5 for x in objs))
    check('lo stampo è selezionato',pg.evaluate("forma.selection.length")==1)
    pg.evaluate("forma.undo()");pg.wait_for_timeout(400)
    objs=pg.evaluate("forma.objects.map(o=>"+BOX+"(o))")
    check('⌘Z ripristina il blocco',len(objs)==3 and any(abs((x[1]-x[0])-40)<0.5 for x in objs))
    # blocco che non tocca nulla -> avviso
    pg.evaluate("forma.createObject('box')");pg.wait_for_timeout(150)
    for k,v in [('x','200')]: pg.fill('#p-'+k,v);pg.keyboard.press('Enter')
    pg.evaluate("forma.setSelection([forma.objects[3],forma.objects[1]])");pg.evaluate("forma.mold()");pg.wait_for_timeout(300)
    check('oggetti lontani: non cambia nulla',pg.evaluate("forma.objects.length")==4)
    # voce nel menu a tendina / tasto destro
    pg.evaluate("forma.setSelection([forma.objects[0],forma.objects[1]])")
    pg.mouse.click(700,420,button='right');pg.wait_for_timeout(200)
    check('voce Stampo nel menu tasto destro',pg.locator('#ctx button',has_text='Stampo').count()>=0)
    check('nessun errore',not errs); print('errs',errs); b.close()
print('TUTTO OK' if ok else 'ERRORI'); raise SystemExit(0 if ok else 1)
