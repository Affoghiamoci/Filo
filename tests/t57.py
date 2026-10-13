from playwright.sync_api import sync_playwright
with sync_playwright() as p:
    b=p.chromium.launch(args=["--use-gl=swiftshader"]);pg=b.new_page(viewport={'width':1300,'height':900})
    errs=[];pg.on('pageerror',lambda e:errs.append(str(e)))
    pg.goto('file:///tmp/forma/dist/forma.html');pg.wait_for_timeout(1000)
    print(pg.title(), pg.evaluate("document.querySelector('.titles').textContent"))
    pg.click('#b-info');pg.wait_for_timeout(300)
    pg.screenshot(path='info2.png')
    pg.click('.cl summary');pg.wait_for_timeout(200);pg.screenshot(path='info3.png')
    pg.click('#info-close');pg.click('[data-lang=en]');pg.click('#b-info');pg.wait_for_timeout(300)
    print(pg.evaluate("document.querySelector('.cl').innerText.slice(0,400)"))
    print(errs);b.close()
