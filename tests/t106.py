# Cono con la cima più larga: L e P sono la larghezza vera; cambiandoli il cono si ridimensiona in proporzione
from playwright.sync_api import sync_playwright
ok=True
def check(name,cond):
    global ok; ok=ok and bool(cond); print('OK ' if cond else 'KO ',name)
BW="(()=>{const b=forma.worldBox(forma.objects[0]);return [b.max.x-b.min.x,b.max.y-b.min.y,b.max.z-b.min.z].map(v=>+v.toFixed(2))})()"
with sync_playwright() as p:
    b=p.chromium.launch(args=["--use-gl=swiftshader"]);pg=b.new_page(viewport={'width':1300,'height':900})
    errs=[];pg.on('pageerror',lambda e:errs.append(str(e)))
    pg.goto('file:///tmp/forma/dist/forma.html');pg.wait_for_function("window.forma");pg.wait_for_timeout(900)
    pg.evaluate("forma.createObject('cone')");pg.wait_for_timeout(200)
    for k,v in [('w',60),('d',60),('h',15),('q','76/60*100')]: pg.fill('#p-'+k,str(v));pg.keyboard.press('Enter')
    pg.wait_for_timeout(200)
    check('cima 126,7 %%: L mostra la larghezza vera 76 (%s), ingombro %s'%(pg.input_value('#p-w'),pg.evaluate(BW)),pg.input_value('#p-w')=='76' and pg.evaluate(BW)[0]==76)
    pg.fill('#p-w','152'); pg.keyboard.press('Enter'); pg.wait_for_timeout(200)
    bw=pg.evaluate(BW); base=pg.evaluate("forma.objects[0].userData.p.w")
    check('L 152: ingombro 152 e base 120 (%s, base %.2f)'%(bw,base),abs(bw[0]-152)<0.05 and abs(base-120)<0.05)
    pg.fill('#p-q','50'); pg.keyboard.press('Enter'); pg.wait_for_timeout(200)
    check('cima 50 %%: L torna la base (%s), ingombro %s'%(pg.input_value('#p-w'),pg.evaluate(BW)),pg.input_value('#p-w')=='120' and abs(pg.evaluate(BW)[0]-120)<0.05)
    check('nessun errore',not errs); print('errs',errs); b.close()
print('TUTTO OK' if ok else 'ERRORI'); raise SystemExit(0 if ok else 1)
