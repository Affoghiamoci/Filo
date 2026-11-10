# Livelli: i gruppi si rinominano (doppio clic, F2, campo Nome del pannello), il nome segue annulla/ripeti, duplica, separa e il salvataggio
import os
from playwright.sync_api import sync_playwright
ok=True
def check(name,cond):
    global ok; ok=ok and bool(cond); print('OK ' if cond else 'KO ',name)
URL='file://'+os.path.abspath(os.path.join(os.path.dirname(__file__),'..','dist','forma.html'))
GN="forma.objects.map(o=>o.userData.gname||null)"
ROW="(()=>{const r=document.querySelector('.lrow.grp .ln');return r?r.textContent:null})()"
with sync_playwright() as p:
    b=p.chromium.launch(args=["--use-gl=swiftshader"]);pg=b.new_page(viewport={'width':1200,'height':900})
    errs=[];pg.on('pageerror',lambda e:errs.append(str(e)))
    pg.goto(URL);pg.wait_for_function("window.forma");pg.wait_for_timeout(900)
    for k in ['box','cylinder','sphere']: pg.evaluate("forma.createObject('%s')"%k);pg.wait_for_timeout(120)
    pg.evaluate("forma.setSelection([...forma.objects]);forma.groupSelection()");pg.click('#b-layers');pg.wait_for_timeout(400)
    check('riga del gruppo con il nome di partenza',pg.evaluate(ROW).startswith('Gruppo'))
    # doppio clic sulla riga del gruppo
    pg.locator('.lrow.grp .ln').dblclick();pg.wait_for_timeout(250)
    check('doppio clic: campo di rinomina sul gruppo',pg.locator('.lren').count()==1)
    pg.keyboard.press('Control+a');pg.keyboard.type('Mensola');pg.keyboard.press('Enter');pg.wait_for_timeout(300)
    check('nome mostrato nella riga',pg.evaluate(ROW)=='Mensola')
    check('nome su tutti i pezzi del gruppo',pg.evaluate(GN)==['Mensola']*3)
    check('campo Nome del pannello: attivo e con il nome',pg.evaluate("(()=>{const e=document.querySelector('#p-name');return !e.disabled&&e.value==='Mensola'})()"))
    # F2 sul gruppo selezionato, poi Esc non cambia niente
    pg.evaluate("forma.setSelection([...forma.objects])");pg.wait_for_timeout(200)
    pg.keyboard.press('F2');pg.wait_for_timeout(250)
    check('F2: campo di rinomina sul gruppo',pg.locator('.lren').count()==1)
    pg.keyboard.press('Control+a');pg.keyboard.type('xx');pg.keyboard.press('Escape');pg.wait_for_timeout(250)
    check('F2 + Esc: nome invariato',pg.evaluate(ROW)=='Mensola')
    pg.keyboard.press('F2');pg.wait_for_timeout(200);pg.keyboard.press('Control+a');pg.keyboard.type('Base');pg.keyboard.press('Enter');pg.wait_for_timeout(300)
    check('F2 + Invio: nuovo nome',pg.evaluate(GN)==['Base']*3)
    # annulla / ripeti
    pg.evaluate("forma.undo()");pg.wait_for_timeout(300)
    check('annulla: torna Mensola',pg.evaluate(GN)==['Mensola']*3 and pg.evaluate(ROW)=='Mensola')
    pg.evaluate("forma.redo()");pg.wait_for_timeout(300)
    check('ripeti: torna Base',pg.evaluate(GN)==['Base']*3)
    # dal campo Nome del pannello
    pg.evaluate("forma.setSelection([...forma.objects])");pg.wait_for_timeout(200)
    pg.fill('#p-name','Telaio');pg.press('#p-name','Enter');pg.wait_for_timeout(300)
    check('campo Nome del pannello rinomina il gruppo',pg.evaluate(GN)==['Telaio']*3 and pg.evaluate(ROW)=='Telaio')
    # nome vuoto: torna a "Gruppo · 3"
    pg.keyboard.press('Escape');pg.evaluate("forma.setSelection([...forma.objects])");pg.wait_for_timeout(200)
    pg.keyboard.press('F2');pg.wait_for_timeout(200);pg.keyboard.press('Control+a');pg.keyboard.press('Delete');pg.keyboard.press('Enter');pg.wait_for_timeout(300)
    check('nome vuoto: torna "Gruppo · 3"',pg.evaluate(GN)==[None]*3 and '3' in pg.evaluate(ROW))
    pg.evaluate("forma.setSelection([...forma.objects])");pg.keyboard.press('F2');pg.wait_for_timeout(200);pg.keyboard.press('Control+a');pg.keyboard.type('Telaio');pg.keyboard.press('Enter');pg.wait_for_timeout(300)
    # duplica: la copia tiene il nome
    pg.evaluate("forma.setSelection([...forma.objects]);forma.duplicateSelection()");pg.wait_for_timeout(400)
    check('duplica: anche la copia si chiama Telaio',pg.evaluate("forma.objects.length")==6 and pg.evaluate(GN)==['Telaio']*6)
    # separa il gruppo: i pezzi non hanno più il nome
    pg.evaluate("forma.undo()");pg.wait_for_timeout(300)
    pg.evaluate("forma.setSelection([...forma.objects]);forma.ungroupSelection()");pg.wait_for_timeout(300)
    check('separa: il nome del gruppo sparisce',pg.evaluate(GN)==[None]*3)
    pg.evaluate("forma.groupSelection()");pg.wait_for_timeout(300)
    check('raggruppa di nuovo: nome di partenza',pg.evaluate(ROW).startswith('Gruppo'))
    pg.evaluate("forma.setSelection([...forma.objects])");pg.keyboard.press('F2');pg.wait_for_timeout(200);pg.keyboard.press('Control+a');pg.keyboard.type('Salvato');pg.keyboard.press('Enter');pg.wait_for_timeout(300)
    # salvataggio automatico e ripresa
    pg.evaluate("forma.saveLast()");pg.wait_for_timeout(800)
    pg.reload();pg.wait_for_function("window.forma");pg.wait_for_timeout(900)
    pg.evaluate("forma.restoreLast()");pg.wait_for_timeout(1200)
    check('ripresa dell\'ultimo lavoro: il gruppo ha ancora il nome',pg.evaluate("forma.objects.length")==3 and pg.evaluate(GN)==['Salvato']*3)
    check('nessun errore',not errs); print('errs',errs); b.close()
print('TUTTO OK' if ok else 'FALLITO')
