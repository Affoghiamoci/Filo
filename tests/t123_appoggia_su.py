# Appoggia su…: il pezzo selezionato si appoggia (contatto esatto) sulla faccia cliccata di un altro pezzo
from playwright.sync_api import sync_playwright
with sync_playwright() as p:
    b = p.chromium.launch(args=["--use-gl=swiftshader"]); pg = b.new_page(viewport={'width': 1280, 'height': 720})
    errs = []; pg.on('pageerror', lambda e: errs.append(str(e)))
    for kind in ['box', 'cylinder', 'sphere']:
        pg.goto('file:///' + __file__.rsplit('/tests/', 1)[0] + '/dist/forma.html'); pg.wait_for_function("window.forma&&forma.MM()"); pg.wait_for_timeout(500)
        pg.evaluate("""(k)=>{const f=forma;f.createObject('box');f.createObject(k);const B=f.objects[1];B.position.set(70,0,40);B.rotation.set(0.6,0.4,0.2);B.updateMatrixWorld(true);f.setSelection([B]);f.layOnStart()}""", kind)
        assert pg.evaluate("forma.layOnMode")
        xy = pg.evaluate("""()=>{const f=forma,bb=f.worldBox(f.objects[0]);const v=new f.THREE.Vector3(bb.max.x,(bb.min.y+bb.max.y)/2+1,(bb.min.z+bb.max.z)/2+1);v.project(f.camera);const r=f.canvas.getBoundingClientRect();return [r.left+(v.x+1)/2*r.width-2,r.top+(1-v.y)/2*r.height]}""")
        pg.mouse.click(*xy); pg.wait_for_timeout(400)
        r = pg.evaluate("""()=>{const f=forma,a=f.worldBox(f.objects[0]),b=f.worldBox(f.objects[1]);return [a.max.x,b.min.x,f.layOnMode]}""")
        assert abs(r[0] - r[1]) < 0.01 and not r[2], (kind, r)
    pg.evaluate("forma.setSelection([forma.objects[1]]);forma.layOnStart()"); pg.keyboard.press('Escape')
    assert not pg.evaluate("forma.layOnMode"); assert not errs, errs
    print('OK'); b.close()
