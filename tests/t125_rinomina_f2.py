# Livelli: F2 rinomina l'oggetto selezionato; due clic ravvicinati in fondo alla lista rinominano anche se il pannello si ridisegna
import os
from playwright.sync_api import sync_playwright
ok=True
def check(name,cond):
    global ok; ok=ok and bool(cond); print('OK ' if cond else 'KO ',name)
URL='file://'+os.path.abspath(os.path.join(os.path.dirname(__file__),'..','dist','forma.html'))
with sync_playwright() as p:
    b=p.chromium.launch(args=["--use-gl=swiftshader"]);pg=b.new_page(viewport={'width':1200,'height':900})
    errs=[];pg.on('pageerror',lambda e:errs.append(str(e)))
    pg.goto(URL);pg.wait_for_function("window.forma");pg.wait_for_timeout(900)
    for k in ['box','cylinder','sphere','box','cone']: pg.evaluate("forma.createObject('%s')"%k);pg.wait_for_timeout(150)
    pg.click('#b-layers');pg.wait_for_timeout(300)
    rows=pg.locator('#layers-list .lrow[data-id]') if pg.locator('#layers-list').count() else None
    n=rows.count()
    # F2 con un oggetto selezionato
    pg.evaluate("forma.setSelection([forma.objects[2]])");pg.wait_for_timeout(200)
    pg.keyboard.press('F2');pg.wait_for_timeout(200)
    check('F2 apre il campo di rinomina',pg.locator('.lren').count()==1)
    pg.keyboard.press('Control+a');pg.keyboard.type('Sfera nuova');pg.keyboard.press('Enter');pg.wait_for_timeout(300)
    check('F2: nome cambiato',pg.evaluate("forma.objects[2].userData.name")=='Sfera nuova')
    # F2 poi Esc: nome invariato
    pg.keyboard.press('F2');pg.wait_for_timeout(150);pg.keyboard.type('xx');pg.keyboard.press('Escape');pg.wait_for_timeout(200)
    check('F2 + Esc: nome invariato',pg.evaluate("forma.objects[2].userData.name")=='Sfera nuova')
    # due clic ravvicinati sull'ultima riga
    last=pg.locator('.lrow[data-id] .ln').last
    last.click();last.click(delay=0);pg.wait_for_timeout(300)
    check('doppio clic sull\'ultima riga apre il campo',pg.locator('.lren').count()==1)
    pg.keyboard.press('Control+a');pg.keyboard.type('Ultimo');pg.keyboard.press('Enter');pg.wait_for_timeout(300)
    check('doppio clic: nome cambiato',pg.evaluate("forma.objects[forma.objects.length-1].userData.name")=='Ultimo')
    # F2 dentro un campo numerico non deve aprire la rinomina
    pg.fill('#p-w','12');pg.keyboard.press('F2');pg.wait_for_timeout(150)
    check('F2 in un campo numerico: niente rinomina',pg.locator('.lren').count()==0)
    check('nessun errore',not errs); print('errs',errs); b.close()
print('TUTTO OK' if ok else 'FALLITO')
