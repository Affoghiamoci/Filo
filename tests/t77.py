from playwright.sync_api import sync_playwright
with sync_playwright() as p:
    b=p.chromium.launch(); pg=b.new_page(viewport={'width':1500,'height':900}); errs=[]
    pg.on('pageerror',lambda e:errs.append(str(e)))
    pg.goto('file:///tmp/forma/dist/forma.html'); pg.wait_for_timeout(800)
    pg.mouse.move(700,450)
    def bg(sel): return pg.evaluate("s=>getComputedStyle(document.querySelector(s)).backgroundColor",sel)
    sel='#tools .tool[aria-label="Ruota"] kbd'
    base=bg(sel); pg.keyboard.press('r')
    seen=[]
    for i in range(8):
        seen.append(bg(sel)); pg.wait_for_timeout(40)
    mid=max(seen,key=lambda c:int(c.split('(')[1].split(',')[0])); has=True
    pg.wait_for_timeout(900); end=bg(sel); has2=pg.evaluate("s=>document.querySelector(s).classList.contains('kflash')",sel)
    print('base',base,'mid',mid,has,'end',end,has2)
    assert not has2 and int(mid.split('(')[1].split(',')[0])>200
    print(seen)
    pg.keyboard.press('Control+d'); pg.wait_for_timeout(100)
    c=pg.evaluate("document.querySelector('#tools .tool[aria-label=Duplica] kbd').classList.contains('kflash')"); print('combina',c); assert c
    pg.keyboard.press('?'); pg.wait_for_timeout(100)
    print('help',pg.evaluate("document.querySelector('#help-open kbd').classList.contains('kflash')"))
    
    print('errs',errs); b.close()
