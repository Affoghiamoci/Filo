from playwright.sync_api import sync_playwright
with sync_playwright() as p:
    b=p.chromium.launch(args=["--use-gl=swiftshader"]);pg=b.new_page(viewport={'width':1300,'height':800})
    pg.goto('file:///tmp/forma/dist/forma.html');pg.wait_for_timeout(1500)
    pg.screenshot(path='/tmp/forma/welcome.png');b.close()
