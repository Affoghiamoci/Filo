# 1.3.5: oscuramento negli incavi (mappa delle altezze) e luce che segue la camera
import io
from PIL import Image
from playwright.sync_api import sync_playwright
ok=True
def check(name,cond):
    global ok; ok=ok and bool(cond); print('OK ' if cond else 'KO ',name)
def setp(pg,vals):
    for k,v in vals: pg.fill('#p-'+k,str(v)); pg.keyboard.press('Enter')
with sync_playwright() as p:
    b=p.chromium.launch(args=["--use-gl=swiftshader"]);pg=b.new_page(viewport={'width':1300,'height':900})
    errs=[];pg.on('pageerror',lambda e:errs.append(str(e)))
    pg.goto('file:///tmp/forma/dist/forma.html');pg.wait_for_function("window.forma&&forma.MM()");pg.wait_for_timeout(400)
    pg.evaluate("forma.createObject('box')");pg.wait_for_timeout(100); setp(pg,[('w',60),('d',120),('h',50),('x',0),('y',0),('z',0)])
    pg.evaluate("forma.createObject('box')");pg.wait_for_timeout(100); setp(pg,[('w',56),('d',116),('h',50),('x',0),('y',0),('z',2)])
    pg.evaluate("(()=>{forma.objects[1].userData.hole=true;forma.setSelection(forma.objects);forma.combine('union')})()");pg.wait_for_timeout(2500)
    pg.evaluate("forma.setSelection([]);forma.setTool('move')")
    pg.evaluate("(()=>{const c=forma.cam;c.az=135;c.el=45;c.dist=330;c.target.set(0,0,20)})()");pg.mouse.move(900,600);pg.mouse.down();pg.mouse.move(903,600);pg.mouse.up();pg.wait_for_timeout(500)
    def lum(k):
        pg.evaluate("k=>{forma.aoU.aoK.value=k}",k); pg.mouse.move(901,601);pg.mouse.down();pg.mouse.move(903,601);pg.mouse.up();pg.wait_for_timeout(600)
        im=Image.open(io.BytesIO(pg.screenshot())).convert('L'); W,H=im.size
        # fondo interno: cerca il pixel più chiaro nella parte centrale (il fondo è l'unica superficie rivolta in su dentro la scatola)
        reg=im.crop((int(W*.35),int(H*.45),int(W*.65),int(H*.75))); px=list(reg.getdata()); return sum(px)/len(px)
    l0=lum(0.0); l1=lum(0.55)
    print('luminosità media zona scatola: senza',round(l0,1),'con',round(l1,1))
    check('con l\'oscuramento la zona interna è più scura',l1<l0-1.5)
    check('nessun errore',not errs); print(errs[:3]); b.close()
print('TUTTO OK' if ok else 'ERRORI'); raise SystemExit(0 if ok else 1)
