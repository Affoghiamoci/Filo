from playwright.sync_api import sync_playwright
with sync_playwright() as p:
    b=p.chromium.launch(args=["--use-gl=swiftshader"])
    for name,ua,plat in [('win','Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120','Win32'),('mac','Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Chrome/120','MacIntel')]:
        ctx=b.new_context(user_agent=ua,viewport={'width':1300,'height':800})
        ctx.add_init_script(f"Object.defineProperty(Navigator.prototype,'platform',{{get:()=>'{plat}'}});Object.defineProperty(Navigator.prototype,'userAgentData',{{get:()=>undefined}})")
        pg=ctx.new_page();errs=[];pg.on('pageerror',lambda e:errs.append(str(e)))
        pg.goto('file:///tmp/forma/dist/forma.html');pg.wait_for_timeout(1200)
        print(name,pg.evaluate("[...document.querySelectorAll('kbd')].map(k=>k.textContent).filter(t=>/Ctrl|⌘|Canc|⌫/.test(t)).join(' | ')"))
        print(name,pg.evaluate("document.querySelector('#b-import').title"))
        pg.click('[data-lang=en]');pg.wait_for_timeout(300)
        print(name,'EN',pg.evaluate("document.querySelector('#b-export').title"), pg.evaluate("document.querySelector('[data-i18n-html]').textContent.match(/[^\\n]*(Ctrl|⌘)[^\\n]{0,30}/g)"))
        pg.keyboard.press('b');pg.wait_for_timeout(200);pg.keyboard.press('Control+d');pg.wait_for_timeout(200)
        print(name,'objs',pg.evaluate("window.forma&&window.forma.objects?window.forma.objects.length:'?'"),errs)
        if name=='win': pg.screenshot(path='win.png')
    b.close()
