# Livelli: il campo di rinomina si legge anche sulla riga selezionata (sfondo opaco e testo a contrasto), in tema chiaro e scuro
import os
from playwright.sync_api import sync_playwright
ok=True
def check(name,cond):
    global ok; ok=ok and bool(cond); print('OK ' if cond else 'KO ',name)
URL='file://'+os.path.abspath(os.path.join(os.path.dirname(__file__),'..','dist','forma.html'))
JS="""()=>{const i=document.querySelector('.lren');if(!i)return null;const p=s=>s.match(/[\\d.]+/g).map(Number);
  const lum=c=>{const[r,g,b]=c.slice(0,3).map(v=>{v/=255;return v<=.03928?v/12.92:Math.pow((v+.055)/1.055,2.4)});return .2126*r+.7152*g+.0722*b};
  const cs=getComputedStyle(i),bg=p(cs.backgroundColor),fg=p(cs.color),a=bg.length>3?bg[3]:1,L1=lum(bg),L2=lum(fg);
  return {alpha:a,contrast:(Math.max(L1,L2)+.05)/(Math.min(L1,L2)+.05)}}"""
with sync_playwright() as p:
    b=p.chromium.launch(args=["--use-gl=swiftshader"]);errs=[]
    for scheme in ['light','dark']:
        pg=b.new_page(viewport={'width':1200,'height':900},color_scheme=scheme);pg.on('pageerror',lambda e:errs.append(str(e)))
        pg.goto(URL);pg.wait_for_function("window.forma");pg.wait_for_timeout(900)
        pg.evaluate("forma.createObject('box')");pg.wait_for_timeout(200);pg.click('#b-layers');pg.wait_for_timeout(300)
        pg.evaluate("forma.setSelection([forma.objects[0]])");pg.wait_for_timeout(200)
        check(scheme+': la riga è selezionata',pg.locator('.lrow.sel').count()==1)
        pg.keyboard.press('F2');pg.wait_for_timeout(200)
        r=pg.evaluate(JS)
        check(scheme+': campo di rinomina aperto',r is not None)
        check(scheme+': sfondo opaco (alpha %s)'%(r and r['alpha']),r and r['alpha']>=0.99)
        check(scheme+': contrasto testo/sfondo %.1f'%(r and r['contrast']),r and r['contrast']>=7)
        pg.close()
    check('nessun errore',not errs); print('errs',errs); b.close()
print('TUTTO OK' if ok else 'FALLITO')
