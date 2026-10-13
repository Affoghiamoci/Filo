from playwright.sync_api import sync_playwright
import time
with sync_playwright() as p:
    b=p.chromium.launch(args=["--use-gl=swiftshader","--enable-webgl","--ignore-gpu-blocklist"])
    pg=b.new_context(viewport={'width':1440,'height':900}).new_page()
    pg.goto('file:///tmp/forma/dist/forma.html'); pg.wait_for_timeout(500); pg.screenshot(path='shots/welcome.png')
    pg.click('[data-eh=box]'); pg.keyboard.press('Escape')
    for font,text in [('lora','FORMA Rg'),('inter','FORMA'),('vt323','FORMA')]:
        pg.keyboard.press('Escape')
        pg.evaluate("()=>{const f=window.forma;f.objects.slice(1).forEach(o=>f.setSelection([o]));}")
        pg.click('[data-eh=text]') if pg.query_selector('[data-eh=text]:visible') else pg.evaluate("()=>document.querySelector('#tools')&&0")
        b.contexts[0]
    b.close()
