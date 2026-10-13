from playwright.sync_api import sync_playwright
import sys
font=sys.argv[1]
with sync_playwright() as p:
    b=p.chromium.launch(args=["--use-gl=swiftshader","--enable-webgl","--ignore-gpu-blocklist"])
    pg=b.new_context(viewport={'width':1000,'height':800}).new_page()
    errs=[]; pg.on('pageerror',lambda e:errs.append(str(e)))
    pg.goto('file:///tmp/forma/dist/forma.html'); pg.wait_for_timeout(500)
    pg.keyboard.press('b'); pg.keyboard.press('t'); pg.wait_for_timeout(400)
    pg.fill('#t-text','FORMA Rg'); pg.select_option('#t-font',font); pg.wait_for_timeout(400)
    pg.evaluate("""()=>{const f=window.forma;const [bx,tx]=f.objects;f.setDims(bx,{w:80,d:40,h:20});tx.position.set(0,0,18);tx.updateMatrixWorld(true);f.setSelection([tx]);f.toggleHole();f.setSelection([bx,tx]);f.combine();f.setSelection([]);}""")
    pg.click('text=SOPRA'); pg.keyboard.press('Control+0'); pg.wait_for_timeout(500)
    pg.screenshot(path=f'shots/combo-{font}.png'); print(errs); b.close()
