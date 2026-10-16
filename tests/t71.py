# Scorciatoie del browser: ⌘G, ⌘E, ⌘D, ⌘S, ⌘O, ⌘0 non arrivano al browser, nemmeno con un campo selezionato; ⌘C, ⌘V, ⌘A nei campi restano libere
from playwright.sync_api import sync_playwright
ok=True
def check(name,cond):
    global ok; ok=ok and bool(cond); print('OK ' if cond else 'KO ',name)
JS="(k)=>{const ev=new KeyboardEvent('keydown',{key:k,metaKey:true,bubbles:true,cancelable:true});document.activeElement.dispatchEvent(ev);return ev.defaultPrevented}"
with sync_playwright() as p:
    b=p.chromium.launch(args=["--use-gl=swiftshader"])
    pg=b.new_page(viewport={'width':1440,'height':900})
    pg.goto('file:///tmp/forma/dist/forma.html');pg.wait_for_function("window.forma");pg.wait_for_timeout(500)
    pg.evaluate("forma.createObject('box')");pg.wait_for_timeout(300)
    for where in ['scena','campo']:
        if where=='campo': pg.focus('#rp-nx')
        else: pg.evaluate("document.activeElement.blur()")
        check(where+': ⌘G, ⇧⌘G, ⌘E, ⌘D, ⌘S, ⌘O, ⌘0 bloccate',all(pg.evaluate(JS,k) for k in ['g','e','d','s','o','0']))
    check('campo: ⌘C, ⌘V, ⌘A restano al browser',not any(pg.evaluate(JS,k) for k in ['c','v','a']))
    b.close()
print('TUTTO OK' if ok else 'FALLITO')
