# Feedback (Gass_electric_key): coprire con una scatola un'incisione lasciava tanti "pezzi" (le cavità chiuse) con bordi aperti. Ora la cavità resta nel pezzo
import os
from playwright.sync_api import sync_playwright
ok=True
def check(name,cond):
    global ok; ok=ok and bool(cond); print('OK ' if cond else 'KO ',name)
with sync_playwright() as p:
    b=p.chromium.launch(args=["--use-gl=swiftshader"]);pg=b.new_page(viewport={'width':1300,'height':900})
    errs=[];pg.on('pageerror',lambda e:errs.append(str(e)))
    pg.goto('file:///tmp/forma/dist/forma.html');pg.wait_for_function("window.forma&&forma.MM()");pg.wait_for_timeout(400)
    pg.set_input_files('#file-in',os.path.join(os.path.dirname(os.path.abspath(__file__)),'data','gass_electric_key.3mf')); pg.wait_for_timeout(3000)
    pg.evaluate("forma.createObject('box')"); pg.wait_for_timeout(150)
    for k,v in zip('whdxyz',(1.5,29.98,20.42,2.298,0,2.5)): pg.fill('#p-'+k,str(v)); pg.keyboard.press('Enter')
    pg.evaluate("(()=>{forma.objects[1].userData.hole=false;forma.setSelection(forma.objects);forma.combine('union')})()"); pg.wait_for_timeout(6000)
    check('un solo pezzo (le cavità restano dentro)',pg.evaluate("forma.objects.length")==1)
    check('nessun bordo aperto',pg.evaluate("forma.openEdgeCount(forma.objects[0].geometry)")==0)
    check('nessun errore',not errs); print(errs[:3]); b.close()
print('TUTTO OK' if ok else 'ERRORI'); raise SystemExit(0 if ok else 1)
