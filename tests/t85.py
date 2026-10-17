# Campi numerici: espressioni (10+1), virgola, frecce, Esc, valori non validi
from playwright.sync_api import sync_playwright
ok=True
def check(name,cond):
    global ok; ok=ok and bool(cond); print('OK ' if cond else 'KO ',name)
with sync_playwright() as p:
    b=p.chromium.launch(args=["--use-gl=swiftshader"]);pg=b.new_page(viewport={'width':1400,'height':850},locale='en-US')
    errs=[];pg.on('pageerror',lambda e:errs.append(str(e)))
    pg.goto('file:///tmp/forma/dist/forma.html');pg.wait_for_function("window.forma");pg.wait_for_timeout(800)
    pg.evaluate("forma.createObject('box')");pg.wait_for_timeout(200)
    W=lambda k='w':pg.evaluate("forma.sizeOf(forma.objects[0]).%s"%k)
    def typ(sel,t,key='Enter'):
        pg.click(sel);pg.keyboard.press('Control+A');pg.keyboard.type(t);pg.keyboard.press(key);pg.wait_for_timeout(150)
    typ('#p-w','10+1'); check('10+1 → 11 (campo %s)'%pg.input_value('#p-w'),W()==11 and pg.input_value('#p-w')=='11')
    typ('#p-w','2*5'); check('2*5 → 10',W()==10)
    typ('#p-w','(3+2)/2'); check('(3+2)/2 → 2.5',W()==2.5)
    typ('#p-w','10,5+1,5'); check('virgole nelle espressioni → 12',W()==12)
    typ('#p-w','30-5.5','Tab'); check('si conferma anche uscendo dal campo (Tab) → 24.5',W()==24.5)
    typ('#p-d','7x3'); check('x come per → 21',W('d')==21)
    typ('#p-w','abc'); check('testo non valido: il pezzo non cambia',W()==24.5)
    typ('#p-w','(12)/0'); check('divisione per zero: non cambia',W()==24.5)
    # nel pannello di posizione: negativi
    typ('#p-x','-5+2'); check('posizione -5+2 → -3',pg.evaluate("forma.objects[0].position.x")==-3)
    # frecce
    pg.click('#p-h'); pg.keyboard.press('Control+A'); pg.keyboard.type('20'); pg.keyboard.press('Enter'); pg.click('#p-h')
    pg.keyboard.press('ArrowUp'); pg.wait_for_timeout(100); check('freccia su: +0.5',W('h')==20.5)
    pg.keyboard.press('Shift+ArrowDown'); pg.wait_for_timeout(100); check('⇧ + freccia giù: -5',W('h')==15.5)
    # Esc torna al valore di partenza
    pg.click('#p-d'); pg.click('#p-h'); pg.keyboard.press('Control+A'); pg.keyboard.type('99'); pg.keyboard.press('Escape'); pg.wait_for_timeout(150)
    check('Esc annulla (altezza resta 15.5)',W('h')==15.5)
    # a metà espressione il modello non cambia
    pg.click('#p-d'); pg.click('#p-h'); pg.keyboard.press('Control+A'); pg.keyboard.type('8+'); pg.wait_for_timeout(100)
    check('"8+" a metà: resta l\'ultimo valore valido (8)',W('h')==8)
    pg.keyboard.type('2'); pg.keyboard.press('Enter'); pg.wait_for_timeout(150); check('8+2 → 10',W('h')==10)
    # campo dei fori/spigoli e maniglia
    check('nessun errore',not errs); print('errs',errs); b.close()
print('TUTTO OK' if ok else 'ERRORI'); raise SystemExit(0 if ok else 1)
