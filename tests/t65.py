NPAG=29   # 1.5.0: tolta la pagina di Allunga
# Guida: tutte le pagine IT/EN si aprono, nessun segnaposto rimasto, nessuna immagine rotta, gruppo File presente
from playwright.sync_api import sync_playwright
ok=True
def check(name,cond):
    global ok; ok=ok and bool(cond); print('OK ' if cond else 'KO ',name)
with sync_playwright() as p:
    b=p.chromium.launch(args=["--use-gl=swiftshader"])
    for lang in ['it','en']:
        ctx=b.new_context(viewport={'width':1440,'height':900}); errs=[]
        ctx.add_init_script(f"localStorage.setItem('forma.lang','{lang}')")
        pg=ctx.new_page(); pg.on('pageerror',lambda e:errs.append(str(e)))
        pg.goto('file:///tmp/forma/dist/forma.html');pg.wait_for_function("window.forma");pg.wait_for_timeout(700)
        pg.keyboard.press('?');pg.wait_for_timeout(400)
        n=pg.evaluate("document.querySelectorAll('#hp-nav button[data-id]').length")
        check(lang+': %d pagine'%n,n==NPAG)
        bad=[]
        for i in range(n):
            pg.evaluate(f"document.querySelectorAll('#hp-nav button[data-id]')[{i}].click()");pg.wait_for_function("[...document.querySelectorAll('#hp-main img')].every(i=>i.complete)",timeout=3000)
            r=pg.evaluate("(()=>{const m=document.querySelector('#hp-main');const t=m.innerText;return {t:m.querySelector('h2').textContent,tok:/\\{\\{|\\$\\{|undefined/.test(t),imgs:[...m.querySelectorAll('img')].filter(i=>!i.complete||i.naturalWidth===0).length,len:t.length}})()")
            if r['tok'] or r['imgs'] or r['len']<200: bad.append(r)
        check(lang+': nessun segnaposto, immagine rotta o pagina vuota '+str(bad),not bad)
        check(lang+': gruppo File',pg.evaluate("[...document.querySelectorAll('#hp-nav .hp-g')].some(e=>/^(file|files)$/i.test(e.textContent.trim()))"))
        check(lang+': nessun errore',not errs)
        ctx.close()
    b.close()
print('TUTTO OK' if ok else 'FALLITO')
