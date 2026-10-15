# Guida: legenda dei segni del Metro (IT/EN), 5 voci con la loro forma
from playwright.sync_api import sync_playwright
ok=True
def check(name,cond):
    global ok; ok=ok and bool(cond); print('OK ' if cond else 'KO ',name)
with sync_playwright() as p:
    b=p.chromium.launch(args=["--use-gl=swiftshader"])
    for lang,nav,title in [('it','Metro','Cosa significano i segni'),('en','Tape','What the marks mean')]:
        ctx=b.new_context(viewport={'width':1440,'height':900}); errs=[]
        ctx.add_init_script(f"localStorage.setItem('forma.lang','{lang}')")
        pg=ctx.new_page(); pg.on('pageerror',lambda e:errs.append(str(e)))
        pg.goto('file:///tmp/forma/dist/forma.html');pg.wait_for_function("window.forma");pg.wait_for_timeout(700)
        pg.keyboard.press('?');pg.wait_for_timeout(400)
        pg.click(f'#hp-nav button:has-text("{nav}")');pg.wait_for_timeout(300)
        check(lang+': titolo legenda presente',pg.evaluate(f"document.querySelector('#hp-main').innerText.toLowerCase().includes('{title}'.toLowerCase())"))
        check(lang+': 5 voci con segno',pg.evaluate("document.querySelectorAll('#hp-main .hp-leg li .mk').length")==5)
        shapes=pg.evaluate("[...document.querySelectorAll('#hp-main .hp-leg .mk')].map(e=>{const s=getComputedStyle(e);return [s.borderRadius,s.clipPath!=='none',s.width]})")
        check(lang+': quadrato, rombo, cerchio, puntino, cerchio piccolo',shapes[0][0]=='0px' and shapes[1][1] and shapes[2][0]=='50%' and shapes[3][2]=='6px' and shapes[4][2]=='9px')
        check(lang+': nessun errore',not errs)
        ctx.close()
    b.close()
print('TUTTO OK' if ok else 'FALLITO')
