# Errori di Righe e Svuota: in rosso sotto i campi, in tutte e due le sezioni se il pezzo non va bene; nessun avviso in alto.
# Cronologia, scheda Messaggi: tutti gli avvisi di Filo con l'ora, gli errori in rosso.
from playwright.sync_api import sync_playwright
ok=True
def check(name,cond):
    global ok; ok=ok and bool(cond); print('OK ' if cond else 'KO ',name)
O='/tmp/claude-0/-home-claude/855145e8-0c7f-5220-a7bc-901db1b32e0d/scratchpad/out/'
with sync_playwright() as p:
    b=p.chromium.launch(args=["--use-gl=swiftshader"]);pg=b.new_page(viewport={'width':1300,'height':900})
    errs=[];pg.on('pageerror',lambda e:errs.append(str(e)))
    pg.goto('file:///tmp/forma/dist/forma.html');pg.wait_for_function("window.forma&&forma.MM()");pg.wait_for_timeout(500)
    # pezzo né a rotazione né dritto
    pg.evaluate("forma.createObject('torus')"); pg.evaluate("forma.createObject('box')"); pg.wait_for_timeout(150)
    pg.evaluate("(()=>{const a=forma.objects[1],b=forma.objects[0];b.position.set(0,0,0);a.position.set(0,0,5);a.updateMatrixWorld(true);b.updateMatrixWorld(true);forma.setSelection([a,b])})()")
    pg.evaluate("forma.combine('union')"); pg.wait_for_timeout(2500)
    pg.evaluate("forma.setSelection([forma.objects[0]])"); pg.wait_for_timeout(200)
    pg.evaluate("document.querySelector('#toast').textContent=''")
    pg.click('#sh-go'); pg.wait_for_timeout(1200)
    a,b2=pg.inner_text('#rv-info'),pg.inner_text('#sh-info')
    red=pg.evaluate("getComputedStyle(document.querySelector('#sh-info')).color")
    check('Svuota su un pezzo non adatto: errore in tutte e due le sezioni',('non lo è' in a) and ('non lo è' in b2))
    check('in rosso (%s)'%red,red.replace(' ','') in ('rgb(229,72,77)',))
    check('nessun avviso in alto ("%s")'%pg.inner_text('#toast'),pg.inner_text('#toast')=='')
    pg.screenshot(path=O+'errori-righe.png',clip={'x':960,'y':0,'width':340,'height':900})
    # errore solo di Svuota su un pezzo adatto
    pg.evaluate("forma.createObject('cylinder')"); pg.wait_for_timeout(200)
    check('cambiando pezzo spariscono gli errori',pg.inner_text('#rv-info')=='' and pg.inner_text('#sh-info')=='')
    pg.fill('#rv-wall','30'); pg.wait_for_timeout(900)
    check('pareti troppo spesse: solo in Svuota ("%s" / "%s")'%(pg.inner_text('#rv-info'),pg.inner_text('#sh-info')),pg.inner_text('#rv-info')=='' and 'troppo spesse' in pg.inner_text('#sh-info'))
    pg.fill('#rv-wall','2'); pg.wait_for_timeout(900)
    check('valore giusto: l\'errore sparisce',pg.inner_text('#sh-info')=='')
    pg.click('#sh-go'); pg.wait_for_timeout(1500)
    # Messaggi
    pg.click('#b-history'); pg.wait_for_timeout(200)
    pg.click('#hist-tabs [data-t=msg]'); pg.wait_for_timeout(200)
    rows=pg.evaluate("[...document.querySelectorAll('#history-list .mrow')].map(r=>[r.className,r.innerText])")
    print('   ',rows)
    check('Messaggi: c\'è l\'errore in rosso e l\'avviso di Svuota',any('err' in c and 'non lo è' in t for c,t in rows) and any('Svuotato' in t for c,t in rows) and any('troppo spesse' in t for c,t in rows))
    check('ogni messaggio ha l\'ora',all(':' in t.split('\n')[0] for c,t in rows))
    pg.screenshot(path=O+'messaggi.png',clip={'x':700,'y':400,'width':600,'height':500})
    pg.click('#hist-tabs [data-t=steps]'); pg.wait_for_timeout(200)
    check('torna ai Passi',pg.evaluate("document.querySelectorAll('#history-list .hrow').length")>0)
    pg.click('#lang [data-lang=en]'); pg.wait_for_timeout(200); pg.click('#hist-tabs [data-t=msg]'); pg.wait_for_timeout(200)
    t=pg.inner_text('#history-list'); check('in inglese ("%s")'%t[:80].replace('\n',' '),'Hollowed' in t and 'neither' in t)
    pg.click('#lang [data-lang=it]')
    check('nessun errore',not errs); print('errs',errs[:3]); b.close()
print('TUTTO OK' if ok else 'ERRORI'); raise SystemExit(0 if ok else 1)
