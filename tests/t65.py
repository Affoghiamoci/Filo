# Guida: Percorso, lezione 1 con immagini e "Prova ora" che carica l'esempio (⌘Z torna indietro)
from playwright.sync_api import sync_playwright
ok=True
def check(name,cond):
    global ok; ok=ok and bool(cond); print('OK ' if cond else 'KO ',name)
with sync_playwright() as p:
    b=p.chromium.launch(args=["--use-gl=swiftshader"])
    for lang,nav in [('it','1. La prima scatola'),('en','1. Your first box')]:
        ctx=b.new_context(viewport={'width':1440,'height':900}); errs=[]
        ctx.add_init_script(f"localStorage.setItem('forma.lang','{lang}')")
        pg=ctx.new_page(); pg.on('pageerror',lambda e:errs.append(str(e)))
        pg.goto('file:///tmp/forma/dist/forma.html');pg.wait_for_function("window.forma");pg.wait_for_timeout(700)
        pg.evaluate("forma.createObject('cylinder')");pg.wait_for_timeout(200)       # qualcosa sul piatto da sostituire
        pg.keyboard.press('?');pg.wait_for_timeout(400)
        check(lang+': gruppo Percorso nel menu',pg.evaluate("[...document.querySelectorAll('#hp-nav .hp-g')].some(e=>/percorso|learning/i.test(e.textContent))"))
        pg.click(f'#hp-nav button:has-text("{nav}")');pg.wait_for_timeout(500)
        check(lang+': 3 immagini caricate',pg.evaluate("[...document.querySelectorAll('#hp-main img')].filter(i=>i.complete||true).length")==3)
        check(lang+': 6 passi numerati',pg.evaluate("document.querySelectorAll('#hp-main .hp-st>li').length")==6)
        pg.wait_for_timeout(300)
        pg.screenshot(path=f'/tmp/t65_{lang}.png')
        pg.click('#hp-main [data-try]');pg.wait_for_timeout(700)
        check(lang+': la Guida si chiude',not pg.evaluate("document.querySelector('#dlg-help').open"))
        check(lang+': in scena una sola scatola 40×30×20',pg.evaluate("forma.objects.length")==1 and pg.evaluate("(()=>{const s=forma.sizeOf(forma.objects[0]);return [s.w,s.d,s.h].join()})()")=='40,30,20')
        pg.keyboard.press('Control+z');pg.wait_for_timeout(400)
        check(lang+': ⌘Z riporta il cilindro di prima',pg.evaluate("forma.objects.length")==1 and pg.evaluate("forma.objects[0].userData.kind")=='cylinder')
        check(lang+': nessun errore',not errs)
        ctx.close()
    b.close()
print('TUTTO OK' if ok else 'FALLITO')
