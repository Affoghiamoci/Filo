from playwright.sync_api import sync_playwright
with sync_playwright() as p:
    b=p.chromium.launch(args=["--use-gl=swiftshader","--enable-webgl","--ignore-gpu-blocklist"])
    pg=b.new_context(viewport={'width':1440,'height':900}).new_page()
    errs=[]; pg.on('pageerror',lambda e:errs.append(str(e)))
    pg.goto('file:///tmp/forma/dist/forma.html'); pg.wait_for_timeout(500)
    pg.set_input_files('#file-in','/tmp/forma/samples/apple.3mf'); pg.wait_for_timeout(1000)
    I="()=>window.forma.objects.map(o=>{const b=window.forma.worldBox(o);return [b.min,b.max].map(v=>[v.x,v.y,v.z].map(n=>+n.toFixed(1)))})"
    print('import',pg.evaluate(I))
    pg.evaluate("()=>{const f=window.forma;f.setSelection([...f.objects]);f.rotateSelection('x',90);f.rotateSelection('y',90)}")
    print('rot',pg.evaluate(I))
    pg.click('#tools >> text=Lato'); pg.keyboard.press('Control+0'); pg.wait_for_timeout(400)
    c=pg.evaluate("()=>{const f=window.forma;const o=f.objects[0];const b=f.worldBox(o);const v=b.getCenter(new b.min.constructor());v.project(f.camera);const r=f.canvas.getBoundingClientRect();return [(v.x+1)/2*r.width+r.left,(1-v.y)/2*r.height+r.top]}")
    pg.mouse.move(*c); pg.wait_for_timeout(200); pg.mouse.click(*c); pg.wait_for_timeout(500)
    print('faces',pg.evaluate("()=>[window.forma.faceSet.length, window.forma.selection.length]"))
    pg.fill('#f-push','20'); pg.click('#f-push-go'); pg.wait_for_timeout(800)
    print('push',pg.evaluate(I), pg.evaluate("document.querySelector('#toast').textContent"), errs); b.close()
