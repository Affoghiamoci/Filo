# Appoggia sul piatto: raddrizza sul lato piatto stabile più vicino e porta a Z = 0
import os
from playwright.sync_api import sync_playwright
ok=True
def check(name,cond):
    global ok; ok=ok and bool(cond); print('OK ' if cond else 'KO ',name)
def fresh(b):
    pg=b.new_page(viewport={'width':1400,'height':850});pg.goto('file:///tmp/forma/dist/forma.html');pg.wait_for_function("window.forma");pg.wait_for_timeout(800);return pg
def mk(pg,kind,**f):
    pg.evaluate(f"forma.createObject('{kind}')");pg.wait_for_timeout(120)
    for k,v in f.items(): pg.fill('#p-'+k,str(v));pg.keyboard.press('Enter');pg.wait_for_timeout(80)
def flat(pg,i=0):   # quanti vertici stanno sul punto più basso e quanto sale il minimo
    return pg.evaluate(f"""(()=>{{const m=forma.objects[{i}];m.updateMatrixWorld(true);const p=m.geometry.attributes.position,v=new forma.THREE.Vector3();let lo=1e9;const z=[];for(let i=0;i<p.count;i++){{v.fromBufferAttribute(p,i).applyMatrix4(m.matrixWorld);z.push(v.z);lo=Math.min(lo,v.z)}}return [+lo.toFixed(4),z.filter(x=>x-lo<0.01).length]}})()""")
def toast(pg): return pg.evaluate("document.querySelector('#toast').textContent")
def rot(pg): return pg.evaluate("['#p-rx','#p-ry','#p-rz'].map(s=>+document.querySelector(s).value)")
with sync_playwright() as p:
    b=p.chromium.launch(args=["--use-gl=swiftshader"])
    errs=[]
    pg=fresh(b);pg.on('pageerror',lambda e:errs.append(str(e)))
    mk(pg,'box',w=20,d=30,h=10,ry=15,z=12)
    pg.evaluate("forma.layOnPlate()");pg.wait_for_timeout(300)
    check('scatola inclinata 15°: rotazione azzerata e a quota 0',rot(pg)==[0,0,0] and flat(pg)[0]==0 and flat(pg)[1]>=4)
    check('avviso con i gradi',toast(pg).startswith('Raddrizzato di 15°'))
    pg.keyboard.press('Control+z');pg.wait_for_timeout(250)
    check('annulla riporta l\'inclinazione',rot(pg)[1]==15)
    pg.keyboard.press('Control+Shift+z');pg.wait_for_timeout(250);check('ripeti',rot(pg)==[0,0,0])
    pg.evaluate("forma.layOnPlate()");pg.wait_for_timeout(200);check('già appoggiato: avviso e niente cambia',toast(pg)=='È già appoggiato al piatto')
    # inclinazione su due assi, il giro attorno a Z resta
    pg=fresh(b);mk(pg,'box',w=20,d=30,h=10,rx=12,ry=-9,rz=40,z=20)
    pg.evaluate("forma.layOnPlate()");pg.wait_for_timeout(300)
    r=flat(pg);check('due assi: base piatta a Z 0',r[0]==0 and r[1]>=4)
    # cilindro inclinato di 20°: poggia sul cerchio di base
    pg=fresh(b);mk(pg,'cylinder',w=20,d=20,h=40,rx=20,z=30)
    pg.evaluate("forma.layOnPlate()");pg.wait_for_timeout(300)
    r=flat(pg);check('cilindro inclinato: base a terra',r[0]==0 and r[1]>=10)
    # sfera: niente lato piatto, si limita a scendere
    pg=fresh(b);mk(pg,'sphere',w=20,d=20,h=20,z=15)
    pg.evaluate("forma.layOnPlate()");pg.wait_for_timeout(300)
    check('sfera: appoggia a Z 0',abs(flat(pg)[0])<1e-3)
    # due oggetti selezionati insieme: sono un blocco unico, il blocco inclinato torna dritto e le distanze restano
    pg=fresh(b);mk(pg,'box',w=20,d=20,h=10,x=-20);mk(pg,'box',w=20,d=20,h=10,x=20)
    pg.evaluate("""(()=>{const T=forma.THREE,R=new T.Quaternion().setFromAxisAngle(new T.Vector3(0,1,0),10*Math.PI/180),c=new T.Vector3(0,0,5);
      forma.objects.forEach(m=>{m.position.sub(c).applyQuaternion(R).add(c);m.position.z+=12;m.quaternion.premultiply(R);m.updateMatrixWorld(true)});forma.setSelection([...forma.objects])})()""")
    d0=pg.evaluate("forma.objects[1].position.clone().sub(forma.objects[0].position).length()")
    pg.evaluate("forma.layOnPlate()");pg.wait_for_timeout(300)
    d1=pg.evaluate("forma.objects[1].position.clone().sub(forma.objects[0].position).length()")
    q=pg.evaluate("forma.objects.map(m=>m.quaternion.toArray().map(v=>+v.toFixed(4)))")
    check('selezione multipla: blocco dritto, distanza invariata, a terra',abs(d0-d1)<1e-3 and min(flat(pg,0)[0],flat(pg,1)[0])==0 and all(abs(x[1])<1e-3 for x in q))
    # il pulsante nel pannello e il menu fanno la stessa cosa
    pg=fresh(b);mk(pg,'box',w=20,d=30,h=10,ry=15,z=12)
    pg.click('#p-ground');pg.wait_for_timeout(300);check('pulsante del pannello',rot(pg)==[0,0,0] and flat(pg)[0]==0)
    # il pezzo di Ciro
    pg=fresh(b)
    pg.set_input_files('#file-in','/tmp/pezzo-1.3mf');pg.wait_for_timeout(1500)
    n=pg.evaluate("forma.objects.length");pg.evaluate("forma.setSelection([...forma.objects])")
    before=flat(pg);pg.evaluate("forma.layOnPlate()");pg.wait_for_timeout(500);after=flat(pg)
    print('pezzo di Ciro',n,before,after,toast(pg))
    check('pezzo di Ciro: ora poggia su un lato piatto a Z 0',n==1 and after[0]==0 and after[1]>=6)
    check('nessun errore',not errs);print(errs)
    b.close()
print('TUTTO OK' if ok else 'FALLITO')
