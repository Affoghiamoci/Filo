# Cima % fino a 300 anche su scatola e prisma; barra in alto del telefono dentro lo schermo
from playwright.sync_api import sync_playwright
ok=True
def check(name,cond):
    global ok; ok=ok and bool(cond); print('OK ' if cond else 'KO ',name)
with sync_playwright() as p:
    b=p.chromium.launch(args=["--use-gl=swiftshader"]);pg=b.new_page(viewport={'width':1300,'height':900})
    errs=[];pg.on('pageerror',lambda e:errs.append(str(e)))
    pg.goto('file:///tmp/forma/dist/forma.html');pg.wait_for_function("window.forma&&forma.MM()");pg.wait_for_timeout(400)
    for kind in ('box','prism'):
        pg.evaluate("forma.createObject('%s')"%kind); pg.wait_for_timeout(150)
        mx=pg.evaluate("document.querySelector('#p-t').max"); check(kind+' max Cima = 300 (%s)'%mx,mx=='300')
        pg.fill('#p-t','200'); pg.keyboard.press('Enter'); pg.wait_for_timeout(200)
        r=pg.evaluate("(()=>{const o=forma.objects[forma.objects.length-1];const bb=new forma.THREE.Box3().setFromObject(o);const s=forma.sizeOf(o);return [o.userData.p.t,bb.max.x-bb.min.x,s.w,o.userData.p.w]})()")
        check(kind+' Cima 200: larghezza ~ doppia (%s)'%r, r[0]==200 and abs(r[1]-2*r[3])<0.5 and abs(r[2]-2*r[3])<0.01)
    check('nessun errore',not errs); b.close()
    b=p.chromium.launch(args=["--use-gl=swiftshader"])
    for w in (390,360,320):
        c=b.new_context(viewport={'width':w,'height':664},is_mobile=True,has_touch=True,user_agent="Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Version/17.0 Mobile/15E148 Safari/604.1")
        pg=c.new_page(); pg.goto('file:///tmp/forma/dist/forma.html'); pg.wait_for_function("window.forma&&forma.MM()"); pg.wait_for_timeout(500)
        r=pg.evaluate("(()=>{const q=s=>document.querySelector(s).getBoundingClientRect();return [q('#b-export').right,q('#b-export').left,q('#b-import').left,innerWidth]})()")
        check('telefono %d: Esporta dentro lo schermo (%s)'%(w,r), r[0]<=r[3]-4 and r[2]>=0)
    b.close()
print('TUTTO OK' if ok else 'ERRORI'); raise SystemExit(0 if ok else 1)
