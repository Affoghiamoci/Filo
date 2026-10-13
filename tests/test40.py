from playwright.sync_api import sync_playwright
with sync_playwright() as p:
    b=p.chromium.launch(args=["--use-gl=swiftshader","--enable-webgl","--ignore-gpu-blocklist"])
    pg=b.new_context(viewport={'width':1440,'height':900}).new_page()
    errs=[]; pg.on('pageerror',lambda e:errs.append(str(e)))
    pg.goto('file:///tmp/forma/dist/forma.html'); pg.wait_for_timeout(500)
    pg.set_input_files('#file-in','/tmp/forma/samples/apple.3mf'); pg.wait_for_timeout(1000)
    pg.evaluate("()=>{const f=window.forma;f.setSelection([...f.objects]);f.groupSelection();f.rotateSelection('x',90);f.rotateSelection('z',90)}")
    pg.keyboard.press('Control+0'); pg.wait_for_timeout(400)
    info="()=>window.forma.objects.map(o=>{const b=window.forma.worldBox(o);return [b.min,b.max].map(v=>[v.x,v.y,v.z].map(n=>+n.toFixed(1)))})"
    print(pg.evaluate(info)); pg.screenshot(path='shots/a0.png')
    for ax,sg,dx,dy in [('y',1,-60,10),('z',1,0,60)]:
        pos=pg.evaluate("(a)=>{const f=window.forma;const h=f.HANDLES.find(h=>h.userData.axis===a[0]&&h.userData.sign===a[1]);const v=h.position.clone().project(f.camera);const r=f.canvas.getBoundingClientRect();return [(v.x+1)/2*r.width+r.left,(1-v.y)/2*r.height+r.top]}",[ax,sg])
        pg.mouse.move(*pos); pg.mouse.down(); pg.mouse.move(pos[0]+dx,pos[1]+dy,steps=8); pg.mouse.up(); pg.wait_for_timeout(200)
        print(ax,pg.evaluate(info)); pg.keyboard.press('Control+0'); pg.wait_for_timeout(300); pg.screenshot(path=f'shots/a-{ax}.png')
    print(errs); b.close()
