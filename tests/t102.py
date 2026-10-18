# Anteprima dal vivo del Lato mentre si trascina la maniglia: Estrudi mostra il blocco, Allunga il pezzo, rossa oltre il massimo
from playwright.sync_api import sync_playwright
ok=True
def check(name,cond):
    global ok; ok=ok and bool(cond); print('OK ' if cond else 'KO ',name)
SIDE="""((want)=>{const o=forma.objects[0];o.updateMatrixWorld(true);const P=o.geometry.attributes.position,I=o.geometry.index;const n=(I?I.count:P.count)/3;const f=i=>I?I.getX(i):i;let best=-1,bd=-2;for(let t=0;t<n;t++){const [a,b,c]=[0,1,2].map(j=>new forma.THREE.Vector3().fromBufferAttribute(P,f(t*3+j)).applyMatrix4(o.matrixWorld));const nn=b.clone().sub(a).cross(c.clone().sub(a)).normalize();const d=nn.x*want[0]+nn.y*want[1]+nn.z*want[2];if(d>bd){bd=d;best=t}}return best})"""
def scr(pg,expr):
    return pg.evaluate("(()=>{const v=(%s).clone().project(forma.camera);const r=forma.canvas.getBoundingClientRect();return [r.left+(v.x*.5+.5)*r.width,r.top+(-v.y*.5+.5)*r.height]})()"%expr)
CEN="(()=>{const w=forma.faceSel.world;let x=0,y=0,z=0,n=0;for(let i=0;i<w.length;i+=3){x+=w[i];y+=w[i+1];z+=w[i+2];n++}return new forma.THREE.Vector3(x/n,y/n,z/n)})()"
with sync_playwright() as p:
    b=p.chromium.launch(args=["--use-gl=swiftshader"]);pg=b.new_page(viewport={'width':1300,'height':900})
    errs=[];pg.on('pageerror',lambda e:errs.append(str(e)))
    pg.goto('file:///tmp/forma/dist/forma.html');pg.wait_for_function("window.forma");pg.wait_for_timeout(900)
    def drag(mode,want,far_pts):
        pg.reload();pg.wait_for_function("window.forma");pg.wait_for_timeout(600)
        pg.evaluate("forma.createObject('prism')");pg.wait_for_timeout(300)
        pg.evaluate("forma.setTool('face')");pg.wait_for_timeout(200)
        pg.evaluate("([t])=>forma.selectFaceFromHit({object:forma.objects[0],faceIndex:t},false)",[pg.evaluate(SIDE+"(%s)"%want)]);pg.wait_for_timeout(300)
        pg.click('#f-mode [data-v=%s]'%mode)
        c=scr(pg,CEN); tip=scr(pg,"(()=>{const c=%s;return c.addScaledVector(forma.faceSel.n,%f)})()"%(CEN,far_pts))
        pg.mouse.move(c[0],c[1]); pg.mouse.down()
        for k in range(1,9): pg.mouse.move(c[0]+(tip[0]-c[0])*k/8, c[1]+(tip[1]-c[1])*k/8); pg.wait_for_timeout(60)
        pg.wait_for_timeout(250)
        st=pg.evaluate("({vis:forma.facePrev.visible,tris:forma.facePrev.geometry.attributes.position?forma.facePrev.geometry.attributes.position.count/3:0,red:forma.facePrev.material.color.getHex()===0xe5484d})")
        read=pg.evaluate("document.querySelector('#dragread').textContent")
        pg.mouse.up(); pg.wait_for_timeout(1500)
        return st,read,pg.evaluate("forma.facePrev.visible")
    st,read,after=drag('extrude','[0.866,0.5,0]',5)
    check('Estrudi: anteprima visibile durante il trascinamento (%s, "%s")'%(st,read),st['vis'] and st['tris']>0 and not st['red'] and read.startswith('Estrudi'))
    check('Estrudi: sparisce quando lasci',not after)
    st,read,after=drag('move','[0.866,0.5,0]',5)
    check('Allunga: anteprima del pezzo intero (%s)'%st,st['vis'] and st['tris']>=20 and not st['red'])
    st,read,after=drag('move','[0.866,0.5,0]',14)
    check('Allunga oltre 8.66: anteprima rossa e quota "oltre il massimo" (%s, "%s")'%(st,read),st['vis'] and st['red'] and 'oltre il massimo' in read)
    check('nessun errore',not errs); print('errs',errs); b.close()
print('TUTTO OK' if ok else 'ERRORI'); raise SystemExit(0 if ok else 1)
