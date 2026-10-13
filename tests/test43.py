from playwright.sync_api import sync_playwright
import zipfile
with sync_playwright() as p:
    b=p.chromium.launch(args=["--use-gl=swiftshader","--enable-webgl","--ignore-gpu-blocklist"])
    pg=b.new_context(viewport={'width':1440,'height':900},accept_downloads=True).new_page()
    errs=[]; pg.on('pageerror',lambda e:errs.append(str(e)))
    pg.goto('file:///tmp/forma/dist/forma.html'); pg.wait_for_timeout(500)
    pg.keyboard.press('b'); pg.keyboard.press('b'); pg.keyboard.press('F7'); pg.wait_for_timeout(300)
    pg.evaluate("()=>{const f=window.forma;f.objects[1].position.set(50,0,0);f.objects[1].updateMatrixWorld(true);f.setSelection([f.objects[0]])}")
    pg.hover('.lrow[data-id]:nth-child(1)')
    pg.click('.lrow:nth-child(1) [data-lo]'); pg.click('.lrow:nth-child(2) [data-vo]'); pg.wait_for_timeout(200)
    print(pg.evaluate("()=>window.forma.objects.map(o=>[o.userData.locked,o.userData.hidden,o.visible])"), pg.evaluate("window.forma.selection.length"))
    pg.screenshot(path='shots/layers.png')
    # click canvas on locked object: should not select
    c=pg.evaluate("()=>{const f=window.forma;const o=f.objects[0];const v=o.position.clone();v.z+=10;v.project(f.camera);const r=f.canvas.getBoundingClientRect();return [(v.x+1)/2*r.width+r.left,(1-v.y)/2*r.height+r.top]}")
    pg.mouse.click(*c); print('sel after click locked',pg.evaluate("window.forma.selection.length"))
    pg.keyboard.press('Control+z'); pg.wait_for_timeout(200); print('undo',pg.evaluate("()=>window.forma.objects.map(o=>[o.userData.locked,o.userData.hidden])"))
    print(errs); b.close()
