from playwright.sync_api import sync_playwright
import time,sys
with sync_playwright() as p:
    b=p.chromium.launch(args=["--use-gl=swiftshader","--enable-webgl","--ignore-gpu-blocklist"])
    for font in ['inter','lora','vt323','bebas']:
        pg=b.new_context(viewport={'width':1000,'height':800}).new_page()
        pg.goto('file:///tmp/forma/dist/forma.html'); pg.wait_for_timeout(400)
        pg.click('[data-eh=box]'); pg.click('#tools >> text=Testo'); pg.wait_for_timeout(300)
        pg.fill('#t-text','FORMA Rg'); pg.select_option('#t-font',font); pg.wait_for_timeout(500)
        t=time.time()
        pg.evaluate("""()=>{const f=window.forma;const [bx,tx]=f.objects;f.setDims(bx,{w:80,d:40,h:20});tx.position.set(0,0,18);tx.updateMatrixWorld(true);f.setSelection([tx]);f.toggleHole();f.setSelection([bx,tx]);f.combine();}""")
        print(font,round(time.time()-t,1),'s tris',pg.evaluate("()=>window.forma.objects[0].geometry.index.count/3"))
        pg.close()
    b.close()
