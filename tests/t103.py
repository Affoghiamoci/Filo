# Controlla aperto: selezionando un altro oggetto il controllo passa a quello
from playwright.sync_api import sync_playwright
ok=True
def check(name,cond):
    global ok; ok=ok and bool(cond); print('OK ' if cond else 'KO ',name)
with sync_playwright() as p:
    b=p.chromium.launch(args=["--use-gl=swiftshader"]);pg=b.new_page(viewport={'width':1300,'height':900})
    errs=[];pg.on('pageerror',lambda e:errs.append(str(e)))
    pg.goto('file:///tmp/forma/dist/forma.html');pg.wait_for_function("window.forma");pg.wait_for_timeout(900)
    def mk(kind,d):
        pg.evaluate("forma.createObject('%s')"%kind);pg.wait_for_timeout(150)
        for k,v in d.items(): pg.fill('#p-'+k,str(v));pg.keyboard.press('Enter')
    mk('box',{'w':20,'d':20,'h':12,'x':-30,'y':0,'z':0}); mk('cylinder',{'w':20,'d':20,'h':34,'x':30,'y':0,'z':0})
    pg.evaluate("forma.setSelection([forma.objects[0]])"); pg.wait_for_timeout(200)
    pg.evaluate("forma.openCheck()"); pg.wait_for_function("!document.querySelector('#chk-body').classList.contains('hidden')",timeout=60000); pg.wait_for_timeout(300)
    e1=pg.inner_text('#chk-est')
    pg.evaluate("forma.setSelection([forma.objects[1]])")
    pg.wait_for_timeout(600); pg.wait_for_function("!document.querySelector('#chk-body').classList.contains('hidden')",timeout=60000); pg.wait_for_timeout(300)
    e2=pg.inner_text('#chk-est')
    print(repr(e1),repr(e2))
    check('altezza del cubo nel primo controllo',"12" in e1)
    check('selezionando il cilindro il controllo passa a lui (altezza 34)',"34" in e2 and e1!=e2)
    check('nessun errore',not errs); print('errs',errs); b.close()
print('TUTTO OK' if ok else 'ERRORI'); raise SystemExit(0 if ok else 1)
