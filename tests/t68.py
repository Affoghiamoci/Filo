# Metro con ⌥: croce che passa dal puntatore e arriva agli estremi misurati (lato piano e lato curvo)
from playwright.sync_api import sync_playwright
ok=True
def check(name,cond):
    global ok; ok=ok and bool(cond); print('OK ' if cond else 'KO ',name)
URL='file:///tmp/forma/dist/forma.html'
SCR="(loc)=>{const m=forma.objects[0];const q=new forma.THREE.Vector3(...loc);m.localToWorld(q);q.project(forma.camera);return [(q.x*.5+.5)*innerWidth,(-q.y*.5+.5)*innerHeight]}"
CROSS="(()=>{const s=document.querySelector('.face-cross');const c=s.querySelector('circle');return {disp:getComputedStyle(s).display,d:s.querySelector('.l').getAttribute('d')||'',cx:+c.getAttribute('cx'),cy:+c.getAttribute('cy'),tip:document.querySelector('.alt-tip').innerText}})()"
with sync_playwright() as p:
    b=p.chromium.launch(args=["--use-gl=swiftshader"])
    for kind,locs in [('box',[[0,0,40],[8,5,40]]),('cylinder',[[10,0,10],[3,9.5,10]])]:
        pg=b.new_page(viewport={'width':1440,'height':900}); errs=[]; pg.on('pageerror',lambda e:errs.append(str(e)))
        pg.goto(URL);pg.wait_for_function("window.forma");pg.wait_for_timeout(400)
        pg.evaluate(f"forma.createObject('{kind}')");pg.evaluate("forma.setTool('ruler')");pg.wait_for_timeout(200)
        pg.evaluate("forma.fitView&&forma.fitView()");pg.wait_for_timeout(500)
        h=pg.evaluate("forma.objects[0].userData.p.h")
        res=[]
        pg.keyboard.down('Alt')
        for loc in locs:
            loc=[loc[0],loc[1],h if loc[2]==40 else min(loc[2],h/2)]
            x,y=pg.evaluate(SCR,loc); pg.mouse.move(x-3,y-3); pg.mouse.move(x,y); pg.wait_for_timeout(300)
            r=pg.evaluate(CROSS); res.append((x,y,r))
        pg.keyboard.up('Alt'); pg.wait_for_timeout(200)
        after=pg.evaluate(CROSS)
        for x,y,r in res:
            print(kind,round(x),round(y),r['disp'],round(r['cx']),round(r['cy']),r['tip'].replace('\n',' | ')[:40])
        check(kind+': croce visibile con ⌥',all(r['disp']!='none' and r['d'].count('M')>=2 for _,_,r in res))
        check(kind+': il centro della croce è sul puntatore',all(abs(r['cx']-x)<8 and abs(r['cy']-y)<8 for x,y,r in res))
        check(kind+': la croce segue il puntatore',res[0][2]['d']!=res[1][2]['d'])
        check(kind+': senza ⌥ la croce sparisce',after['disp']=='none')
        check(kind+': nessun errore',not errs)
        pg.close()
    b.close()
print('TUTTO OK' if ok else 'FALLITO')
