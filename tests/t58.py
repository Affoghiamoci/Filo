# Interseca: volumi, fori, caso vuoto, annulla, cronologia
from playwright.sync_api import sync_playwright
def mk(pg,kind,x,y,z,w,d,h):
    pg.evaluate(f"forma.createObject('{kind}')");pg.wait_for_timeout(120)
    for k,v in (('w',w),('d',d),('h',h),('x',x),('y',y),('z',z)):
        pg.fill('#p-'+k,str(v));pg.keyboard.press('Enter')
    pg.wait_for_timeout(120)
def info(pg): return pg.evaluate("forma.objects.map(o=>{const s=forma.sizeOf(o),b=forma.worldBox(o);return [o.userData.kind,+s.w.toFixed(2),+s.d.toFixed(2),+s.h.toFixed(2),+b.min.x.toFixed(2),+b.max.x.toFixed(2)]})")
def fresh(b):
    pg=b.new_page(viewport={'width':1400,'height':850});pg.goto('file:///tmp/forma/dist/forma.html');pg.wait_for_function("window.forma");pg.wait_for_timeout(800);return pg
ok=True
def check(name,cond):
    global ok; ok=ok and cond; print('OK ' if cond else 'KO ',name)
with sync_playwright() as p:
    b=p.chromium.launch(args=["--use-gl=swiftshader"])
    errs=[]
    pg=fresh(b);pg.on('pageerror',lambda e:errs.append(str(e)))
    mk(pg,'box',0,0,0,20,20,20);mk(pg,'box',10,0,0,20,20,20)
    pg.evaluate("forma.setSelection([...forma.objects])");pg.keyboard.press('Control+Shift+e');pg.wait_for_timeout(900)
    r=info(pg);check('due scatole: in comune 10x20x20',len(r)==1 and r[0][1:4]==[10,20,20] and r[0][4:]==[0,10])
    pg.keyboard.press('Control+z');pg.wait_for_timeout(300);check('annulla riporta 2 oggetti',len(info(pg))==2)
    pg.keyboard.press('Control+Shift+z');pg.wait_for_timeout(300);check('ripeti',len(info(pg))==1)
    pg=fresh(b);mk(pg,'box',0,0,0,10,10,10);mk(pg,'box',50,0,0,10,10,10)
    pg.evaluate("forma.setSelection([...forma.objects])");pg.keyboard.press('Control+Shift+e');pg.wait_for_timeout(600)
    check('non sovrapposti: niente cambia + avviso',len(info(pg))==2 and 'non si sovrappongono' in pg.evaluate("document.querySelector('#toast').textContent"))
    pg=fresh(b);mk(pg,'box',0,0,0,20,20,20);mk(pg,'cylinder',0,0,0,10,10,40)
    pg.evaluate("forma.setSelection([...forma.objects])");pg.evaluate("forma.intersect()");pg.wait_for_timeout(900)
    r=info(pg);check('scatola e cilindro',len(r)==1 and r[0][1:4]==[10,10,20])
    pg=fresh(b);mk(pg,'box',0,0,0,30,30,30);mk(pg,'box',5,0,0,30,30,30);mk(pg,'box',10,0,0,30,30,30);mk(pg,'box',12,0,0,4,40,40)
    pg.evaluate("forma.setSelection([forma.objects[3]])");pg.keyboard.press('x')
    pg.evaluate("forma.setSelection([...forma.objects])");pg.evaluate("forma.intersect()");pg.wait_for_timeout(1200)
    r=info(pg);check('tre solidi e un foro: due pezzi',len(r)==2 and sorted(x[1] for x in r)==[1,15])
    pg=fresh(b);mk(pg,'box',0,0,0,20,20,20);mk(pg,'box',10,0,0,20,20,20)
    pg.evaluate("forma.setSelection([forma.objects[0]])");pg.keyboard.press('Control+Shift+e');pg.wait_for_timeout(300)
    check('un solo solido: avviso',len(info(pg))==2)
    pg.evaluate("forma.setSelection([...forma.objects])");pg.keyboard.press('Control+e');pg.wait_for_timeout(800)
    r=info(pg);check('Combina invariato (30x20x20)',len(r)==1 and r[0][1:4]==[30,20,20])
    check('nessun errore',not errs)
    b.close()
print('TUTTO OK' if ok else 'FALLITO')
