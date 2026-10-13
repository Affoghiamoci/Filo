from playwright.sync_api import sync_playwright
with sync_playwright() as p:
    b=p.chromium.launch(args=["--use-gl=swiftshader"]);pg=b.new_page(viewport={'width':1400,'height':850})
    errs=[];pg.on('pageerror',lambda e:errs.append(str(e)));pg.on('console',lambda m: m.type=='error' and errs.append(m.text))
    pg.goto('file:///tmp/forma/dist/forma.html');pg.wait_for_timeout(1000)
    pg.evaluate("forma.createObject('cylinder');forma.createObject('box');forma.objects[1].position.set(40,0,0);forma.objects[0].position.set(-5,0,0);forma.fitView()");pg.wait_for_timeout(500)
    pg.keyboard.press('e');pg.wait_for_timeout(200)
    # project top rim point of box edge
    pt=pg.evaluate("""(()=>{const o=forma.objects[1];const an=forma.edgeAnalysis(o);const e=an.sharp.find(e=>an.vp(e.a).z>19&&an.vp(e.b).z>19&&Math.abs(an.vp(e.a).y-an.vp(e.b).y)<1&&an.vp(e.a).y<0);
      const a=an.vp(e.a),b=an.vp(e.b);const m=a.clone().add(b).multiplyScalar(.5);m.y+=1.5;m.z-=0.5;m.project(forma.camera);const r=forma.canvas.getBoundingClientRect();return [r.left+(m.x*.5+.5)*r.width,r.top+(-m.y*.5+.5)*r.height]})()""")
    print(pt)
    pg.mouse.move(pt[0],pt[1]);pg.wait_for_timeout(300);pg.screenshot(path='edge3.png')
    pg.mouse.click(pt[0],pt[1]);pg.wait_for_timeout(300)
    print(pg.evaluate("forma.edgeSel().length"))
    pg.screenshot(path='edge4.png')
    pg.fill('#e-size','3');pg.click('#e-go');pg.wait_for_timeout(600)
    pg.screenshot(path='edge5.png')
    print(pg.evaluate("forma.objects.map(o=>o.userData.kind)"), errs)
    pg.keyboard.press('v');pg.keyboard.press('Control+z');pg.wait_for_timeout(300)
    print(pg.evaluate("forma.objects.map(o=>o.userData.kind)"), errs)
    b.close()
