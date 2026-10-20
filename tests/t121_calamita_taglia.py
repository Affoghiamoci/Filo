# Calamita sul piano di Taglia/Allunga: si aggancia ai lati, alla metà e ai vertici degli oggetti; Lato rispetta il pulsante calamita
from playwright.sync_api import sync_playwright
ok=True
def check(name,cond):
    global ok; ok=ok and bool(cond); print('OK ' if cond else 'KO ',name)
with sync_playwright() as p:
    b=p.chromium.launch(args=["--use-gl=swiftshader"]);pg=b.new_page(viewport={'width':1300,'height':900})
    errs=[];pg.on('pageerror',lambda e:errs.append(str(e)))
    pg.goto('file:///tmp/forma/dist/forma.html');pg.wait_for_function("window.forma&&forma.MM()");pg.wait_for_timeout(400)
    def box(w,d,h,x=0,y=0,z=0):
        pg.evaluate("forma.createObject('box')"); pg.wait_for_timeout(80)
        for k,v in [('w',w),('d',d),('h',h),('x',x),('y',y),('z',z)]: pg.fill('#p-'+k,str(v)); pg.keyboard.press('Enter')
    box(30,30,30); box(20,20,20,60,0,0)
    pg.evaluate("forma.setSelection([forma.objects[0]]);forma.setTool('cut');forma.CUT.ax='z'"); pg.wait_for_timeout(300)
    r=pg.evaluate("(()=>{const c=forma.cutCandidates();const m=forma.cutMagnet(c,20.4);const m2=forma.cutMagnet(c,24.5);const m3=forma.cutMagnet(c,10.0);return {n:c.length,a:m&&[m.v,m.kind],b:m2&&[m2.v,m2.kind],c:m3&&[m3.v,m3.kind]}})()"); print(r)
    check('vicino a 20 (lato dell\'altro oggetto): si aggancia a 20',r['a'] and abs(r['a'][0]-20)<1e-6)
    check('lontano da tutto (24,5): niente aggancio',r['b'] is None)
    check('a 10 (metà dell\'altro oggetto): si aggancia',r['c'] and abs(r['c'][0]-10)<1e-6)
    pg.evaluate("forma.state.magnet=false")
    off=pg.evaluate("forma.cutMagnet(forma.cutCandidates(),20.4)")
    check('calamita spenta: nessun aggancio',off is None)
    check('nessun errore',not errs); print(errs[:3]); b.close()
print('TUTTO OK' if ok else 'ERRORI'); raise SystemExit(0 if ok else 1)
