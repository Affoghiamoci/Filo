from playwright.sync_api import sync_playwright
with sync_playwright() as p:
    b=p.chromium.launch(args=["--use-gl=swiftshader","--enable-webgl","--ignore-gpu-blocklist"])
    pg=b.new_context(viewport={'width':1440,'height':900},color_scheme='light').new_page()
    errs=[]; pg.on('pageerror',lambda e:errs.append(str(e)))
    pg.goto('file:///tmp/forma/dist/forma.html'); pg.wait_for_timeout(500)
    pg.click('#theme [data-theme=dark]'); pg.wait_for_timeout(400); pg.screenshot(path='shots/dark.png')
    print(pg.evaluate("document.documentElement.dataset.theme"), pg.evaluate("getComputedStyle(document.body).backgroundColor"))
    pg.click('#theme [data-theme=auto]'); pg.wait_for_timeout(300); print(pg.evaluate("document.documentElement.dataset.theme"), pg.evaluate("getComputedStyle(document.body).backgroundColor"))
    pg.click('#b-info'); pg.wait_for_timeout(300); pg.screenshot(path='shots/info.png'); print(errs); b.close()
