# Spigolo: raggio grande riselezionabile, spigoli verticali del prisma e bordo di cilindro/cono restano modificabili
import math
from playwright.sync_api import sync_playwright
ok=True
def check(name,cond):
    global ok; ok=ok and bool(cond); print('OK ' if cond else 'KO ',name)
URL='file:///tmp/forma/dist/forma.html'
STATE="(()=>{const m=forma.objects[0],u=m.userData;return {kind:u.kind,p:u.p,tris:m.geometry.index?m.geometry.index.count/3:m.geometry.attributes.position.count/3}})()"
with sync_playwright() as p:
    b=p.chromium.launch(args=["--use-gl=swiftshader"])
    def fresh(kind):
        pg=b.new_page(viewport={'width':1440,'height':900}); pg.errs=[]; pg.on('pageerror',lambda e:pg.errs.append(str(e)))
        pg.goto(URL);pg.wait_for_function("window.forma");pg.wait_for_timeout(400)
        pg.evaluate(f"forma.createObject('{kind}')");pg.evaluate("forma.setTool('edge')");pg.wait_for_timeout(100); return pg
    def sel(pg,loc): return pg.evaluate(f"(()=>{{const m=forma.objects[0];const q=new forma.THREE.Vector3(...{loc});m.localToWorld(q);forma.selectEdgeAt({{object:m,point:q}},false);return forma.edgeSel().length}})()")
    def apply(pg,typ,v):
        pg.evaluate(f"document.querySelectorAll('#e-type button').forEach(b=>{{if(b.dataset.v==='{typ}')b.click()}})")
        pg.evaluate("(v)=>{const i=document.querySelector('#e-size');i.disabled=false;i.value=v;const g=document.querySelector('#e-go');if(!g.disabled)g.click()}",v);pg.wait_for_timeout(300)
    def again(pg): pg.evaluate("forma.setTool('move')");pg.evaluate("forma.setTool('edge')");pg.wait_for_timeout(100)
    # 1) scatola, raggio grande: si riseleziona cliccando sulla curva (0,414 r dallo spigolo vivo)
    pg=fresh('box'); sh=7*(math.sqrt(2)-1)/math.sqrt(2)
    sel(pg,[0,-15,30]); apply(pg,'fillet',7); again(pg)
    check('scatola r=7: riseleziona sulla curva',sel(pg,[0,-15+sh,30-sh])==1)
    check('scatola r=7: misura già scritta',pg.evaluate("document.querySelector('#e-size').value")=='7')
    # 2) prisma: spigolo verticale
    pg=fresh('prism'); sel(pg,[10,0,10]); apply(pg,'fillet',3)
    st=pg.evaluate(STATE); check('prisma verticale: resta prisma con spigolo singolo',st['kind']=='prism' and st['p'].get('ed',{}).get('pv:0',{}).get('r')==3)
    again(pg); check('prisma verticale: lo riseleziono',sel(pg,[10,0,10])==1 and pg.evaluate("document.querySelector('#e-size').value")=='3')
    apply(pg,'chamfer',2); st=pg.evaluate(STATE); check('prisma verticale: cambio in smusso da 2',st['kind']=='prism' and st['p']['ed']['pv:0']=={'r':2,'t':'c'})
    again(pg); sel(pg,[10,0,10]); apply(pg,'fillet',0); st=pg.evaluate(STATE); check('prisma verticale: con 0 torna come prima',st['tris']==24)
    # volume del raccordo e dello smusso verticali
    pg=fresh('prism'); sel(pg,[10,0,10]); apply(pg,'fillet',3); sel(pg,[-5,8.66,10]); apply(pg,'chamfer',2.5)
    vol=pg.evaluate("(()=>{const g=forma.objects[0].geometry;const a=g.attributes.position,ix=g.index;let v=0;const n=ix?ix.count:a.count;const P=i=>{const k=ix?ix.getX(i):i;return [a.getX(k),a.getY(k),a.getZ(k)]};for(let i=0;i<n;i+=3){const A=P(i),B=P(i+1),C=P(i+2);v+=(A[0]*(B[1]*C[2]-B[2]*C[1])-A[1]*(B[0]*C[2]-B[2]*C[0])+A[2]*(B[0]*C[1]-B[1]*C[0]))/6}return v})()")
    check('prisma: volume come previsto (%.1f)'%vol,abs(vol-5132.4)<3)
    check('prisma: nessun errore',not pg.errs)
    # 3) cilindro: bordo alto
    for typ in ['fillet','chamfer']:
        pg=fresh('cylinder'); sel(pg,[10,0,20]); apply(pg,typ,3)
        again(pg); n=sel(pg,[10-0.3*3,0,20-0.3*3] if typ=='fillet' else [10-1.5,0,20-1.5])
        check(f'cilindro {typ}: lo riseleziono',n==1 and pg.evaluate("document.querySelector('#e-size').value")=='3')
        apply(pg,typ,5); st=pg.evaluate(STATE); check(f'cilindro {typ}: da 5 resta parametrico',st['kind']=='cylinder' and st['p']['ft']==5)
        again(pg); sel(pg,[10-0.3*5,0,20-0.3*5] if typ=='fillet' else [10-2.5,0,20-2.5]); apply(pg,typ,0); st=pg.evaluate(STATE)
        check(f'cilindro {typ}: con 0 toglie il bordo',st['kind']=='cylinder' and not st['p']['ft'])
        check(f'cilindro {typ}: nessun errore',not pg.errs)
    b.close()
print('TUTTO OK' if ok else 'FALLITO')
