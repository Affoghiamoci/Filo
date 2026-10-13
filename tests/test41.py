from playwright.sync_api import sync_playwright
with sync_playwright() as p:
    b=p.chromium.launch(args=["--use-gl=swiftshader","--enable-webgl","--ignore-gpu-blocklist"])
    pg=b.new_context(viewport={'width':1440,'height':900}).new_page()
    errs=[]; pg.on('pageerror',lambda e:errs.append(str(e)))
    pg.goto('file:///tmp/forma/dist/forma.html'); pg.wait_for_timeout(500)
    pg.set_input_files('#file-in','/tmp/forma/samples/four.svg'); pg.wait_for_timeout(800)
    print(pg.evaluate("()=>window.forma.objects.map(o=>[o.userData.name,o.userData.gid,o.userData.color])"), pg.evaluate("window.forma.selection.length"), pg.evaluate("document.querySelector('#toast').textContent"), errs); b.close()
