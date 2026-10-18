# 1.1.0: anteprima di Righe e pareti mentre cambi i campi (il pezzo vero non cambia finché non premi Applica, Esc la toglie),
# cilindro con la Cima oltre il 100 % (si allarga verso l'alto, L e P sono la larghezza della cima)
from playwright.sync_api import sync_playwright
import math
ok=True
def check(name,cond):
    global ok; ok=ok and bool(cond); print('OK ' if cond else 'KO ',name)
PREV="(()=>{const s=forma.__revPrev;return s?s:null})()"
O='/tmp/claude-0/-home-claude/855145e8-0c7f-5220-a7bc-901db1b32e0d/scratchpad/out/'
with sync_playwright() as p:
    b=p.chromium.launch(args=["--use-gl=swiftshader"]);pg=b.new_page(viewport={'width':1300,'height':900})
    errs=[];pg.on('pageerror',lambda e:errs.append(str(e)))
    pg.goto('file:///tmp/forma/dist/forma.html');pg.wait_for_function("window.forma&&forma.MM()");pg.wait_for_timeout(500)
    # cilindro che si allarga
    pg.evaluate("forma.createObject('cylinder')"); pg.wait_for_timeout(150)
    for k,v in [('w',20),('d',20),('h',20),('t',150)]: pg.fill('#p-'+k,str(v)); pg.keyboard.press('Enter')
    pg.wait_for_timeout(200)
    bb=pg.evaluate("(()=>{const b=forma.worldBox(forma.objects[0]);return [b.max.x-b.min.x,b.max.z-b.min.z]})()")
    s=pg.evaluate("forma.sizeOf(forma.objects[0])")
    check('cilindro Cima 150 %%: largo %.2f in cima (atteso 30), L nel pannello %.2f, campo %s'%(bb[0],s['w'],pg.input_value('#p-t')),abs(bb[0]-30)<0.05 and abs(s['w']-30)<0.05 and pg.input_value('#p-t')=='150')
    pg.fill('#p-w','40'); pg.keyboard.press('Enter'); pg.fill('#p-d','40'); pg.keyboard.press('Enter'); pg.wait_for_timeout(200)
    bb=pg.evaluate("(()=>{const b=forma.worldBox(forma.objects[0]);return b.max.x-b.min.x})()")
    check('L = 40: la cima è larga 40 (%.2f)'%bb,abs(bb-40)<0.05)
    pg.fill('#p-t','400'); pg.keyboard.press('Enter'); pg.wait_for_timeout(200)
    check('Cima oltre 300 si ferma a 300 (%s)'%pg.evaluate("forma.objects[0].userData.p.t"),pg.evaluate("forma.objects[0].userData.p.t")==300)
    pg.fill('#p-t','150'); pg.keyboard.press('Enter'); pg.wait_for_timeout(200)
    pg.fill('#p-ft','2'); pg.keyboard.press('Enter'); pg.wait_for_timeout(400)
    check('con il bordo alto arrotondato resta chiuso',pg.evaluate("forma.openEdgeCount(forma.objects[0].geometry)")==0)
    pg.fill('#p-ft','0'); pg.keyboard.press('Enter'); pg.wait_for_timeout(200)
    # anteprima
    v0=pg.evaluate("forma.objects[0].geometry.attributes.position.count"); k0=pg.evaluate("forma.objects[0].userData.kind")
    pg.fill('#rv-n','40'); pg.fill('#rv-depth','1'); pg.fill('#rv-wall','2'); pg.wait_for_timeout(800)
    info=pg.inner_text('#rv-info')
    check('anteprima accesa, nessun testo superfluo ("%s")'%info,info=='' and pg.evaluate("forma.__revPrev")==True)
    check('il pezzo vero non è cambiato',pg.evaluate("forma.objects[0].geometry.attributes.position.count")==v0 and pg.evaluate("forma.objects[0].userData.kind")==k0)
    pg.screenshot(path=O+'anteprima-righe.png',clip={'x':330,'y':150,'width':640,'height':560})
    pg.click('#rv-shape [data-v=point]'); pg.wait_for_timeout(800)
    check('cambiare la forma aggiorna l\'anteprima',pg.evaluate("forma.__revPrev")==True)
    pg.keyboard.press('Escape'); pg.wait_for_timeout(300)
    check('Esc toglie l\'anteprima, il pezzo resta com\'era',pg.evaluate("forma.__revPrev")==False and pg.evaluate("forma.objects[0].userData.kind")==k0)
    pg.fill('#rv-n','30'); pg.wait_for_timeout(800); pg.click('#rv-go'); pg.wait_for_timeout(2000)
    check('Applica: il pezzo diventa a rotazione (%s), anteprima spenta, chiuso'%pg.evaluate("forma.objects[0].userData.kind"),pg.evaluate("forma.objects[0].userData.kind")=='rev' and pg.evaluate("forma.__revPrev")==False and pg.evaluate("forma.openEdgeCount(forma.objects[0].geometry)")==0)
    pg.fill('#rv-n','60'); pg.wait_for_timeout(800)
    pg.evaluate("forma.setSelection([])"); pg.wait_for_timeout(200)
    check('cambiando selezione l\'anteprima sparisce',pg.evaluate("forma.__revPrev")==False and pg.evaluate("forma.objects[0].userData.p.ribs.n")==30)
    # pezzo non adatto: l'avviso arriva subito, senza anteprima
    pg.evaluate("forma.createObject('torus')"); pg.wait_for_timeout(150)
    pg.evaluate("forma.createObject('box')"); pg.wait_for_timeout(150)
    pg.evaluate("(()=>{const a=forma.objects.at(-1),b=forma.objects.at(-2);b.position.set(0,0,0);a.position.set(0,0,5);a.updateMatrixWorld(true);b.updateMatrixWorld(true);forma.setSelection([a,b])})()")
    pg.evaluate("forma.combine('union')"); pg.wait_for_timeout(2500)
    pg.evaluate("forma.setSelection([forma.objects.at(-1)])"); pg.wait_for_timeout(200)
    pg.fill('#rv-n','20'); pg.wait_for_timeout(800)
    check('pezzo né a rotazione né dritto: avviso nel pannello ("%s")'%pg.inner_text('#rv-info')[:60],'non lo è' in pg.inner_text('#rv-info') and pg.evaluate("forma.__revPrev")==False)
    check('nessun errore',not errs); print('errs',errs[:3]); b.close()
print('TUTTO OK' if ok else 'ERRORI'); raise SystemExit(0 if ok else 1)
