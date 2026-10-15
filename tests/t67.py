# Info orizzontale: novità a sinistra, resto a destra, link al repository, licenza MIT (IT/EN, anche stretto)
from playwright.sync_api import sync_playwright
ok=True
def check(name,cond):
    global ok; ok=ok and bool(cond); print('OK ' if cond else 'KO ',name)
with sync_playwright() as p:
    b=p.chromium.launch(args=["--use-gl=swiftshader"])
    for lang,w in [('it',1440),('en',1440),('it',500)]:
        ctx=b.new_context(viewport={'width':w,'height':900}); errs=[]
        ctx.add_init_script(f"localStorage.setItem('forma.lang','{lang}')")
        pg=ctx.new_page(); pg.on('pageerror',lambda e:errs.append(str(e)))
        pg.goto('file:///tmp/forma/dist/forma.html');pg.wait_for_function("window.forma");pg.wait_for_timeout(700)
        pg.click('#b-info');pg.wait_for_timeout(400)
        r=pg.evaluate("(()=>{const q=s=>document.querySelector(s).getBoundingClientRect();const n=q('#dlg-info .info-news'),m=q('#dlg-info .info-main'),d=q('#dlg-info');return {nl:n.left,nr:n.right,nt:n.top,ml:m.left,mt:m.top,mr:m.right,dl:d.left,dr:d.right,w:innerWidth,href:document.querySelector('.info-link').href,txt:document.querySelector('#dlg-info').innerText}})()")
        tag=f'{lang} {w}px: '
        if w>=900:
            check(tag+'novità a sinistra, resto a destra',r['nr']<=r['ml']+1 and abs(r['nt']-r['mt'])<40)
        else:
            check(tag+'una colonna, resto sopra le novità',r['mt']<r['nt'] and r['dr']<=r['w'])
        if w>=900:
            h0=pg.evaluate("document.querySelector('#dlg-info').getBoundingClientRect().height")
            pg.click('#dlg-info summary');pg.wait_for_timeout(700)
            h1=pg.evaluate("document.querySelector('#dlg-info').getBoundingClientRect().height")
            check(tag+'aprendo Versioni precedenti la finestra non cambia altezza',abs(h0-h1)<1 and pg.evaluate("(()=>{const c=document.querySelector('.cl');return c.scrollHeight>c.clientHeight})()"))
        check(tag+'link al repository',r['href']=='https://github.com/Affoghiamoci/Filo')
        check(tag+'testo MIT',('MIT' in r['txt']) and (('Codice' in r['txt'].title()) if lang=='it' else ('code' in r['txt'].lower())))
        check(tag+'nessun errore',not errs)
        ctx.close()
    b.close()
print('TUTTO OK' if ok else 'FALLITO')
