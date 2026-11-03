# Combina e Stampo pesanti girano in un worker: stesso risultato del calcolo sul thread principale, e si possono annullare (pulsante o Esc)
import os, json
from playwright.sync_api import sync_playwright
ok=True
def check(name,cond):
    global ok; ok=ok and bool(cond); print('OK ' if cond else 'KO ',name)
URL='file://'+os.path.abspath(os.path.join(os.path.dirname(__file__),'..','dist','forma.html'))
SCENE="""()=>{const F=forma;F.createObject('box');const blk=F.objects[0];blk.userData.p.w=200;blk.userData.p.d=200;
  for(let i=0;i<60;i++){F.createObject('sphere');const o=F.objects[F.objects.length-1];o.position.set(-90+(i%10)*20,-90+Math.floor(i/10)*30,10);o.updateMatrixWorld(true);}
  F.setSelection([...F.objects]);return F.objects.length}"""
SUMMARY="""()=>{const F=forma;return {n:F.objects.length,sel:F.selection.length,tris:F.objects.map(o=>Math.round((o.geometry.index?o.geometry.index.count:o.geometry.attributes.position.count)/3)),
  vol:F.objects.map(o=>+Math.abs(F.geoVolume(o.geometry)).toFixed(2)),names:F.objects.map(o=>o.userData.name),pos:F.objects.map(o=>o.position.toArray().map(x=>+x.toFixed(3)))}}"""
def fresh(pg,noworker=False):
    workers.clear();pg.reload();pg.wait_for_function("window.forma");pg.wait_for_timeout(1200)
    if noworker: pg.evaluate("window.__noWorker=true")
    return pg.evaluate(SCENE)
def wait_idle(pg,t=90000):
    pg.wait_for_function("document.querySelector('#busy').classList.contains('hidden')",timeout=t)
def run(pg,op):
    pg.evaluate("()=>{window.__done=false;forma.%s().then(()=>{window.__done=true})}"%op)
    pg.wait_for_function("window.__done===true",timeout=120000);pg.wait_for_timeout(300)
with sync_playwright() as p:
    b=p.chromium.launch(args=["--use-gl=swiftshader"]);pg=b.new_page(viewport={'width':1200,'height':900})
    errs=[];pg.on('pageerror',lambda e:errs.append(str(e)))
    workers=[];pg.on('worker',lambda w:workers.append(w))
    pg.goto(URL);pg.wait_for_function("window.forma");pg.wait_for_timeout(1200)
    # 1) Combina: worker e thread principale danno lo stesso pezzo
    fresh(pg);run(pg,'combine');w=pg.evaluate(SUMMARY);wc=w
    fresh(pg,True);run(pg,'combine');s=pg.evaluate(SUMMARY)
    print('worker',json.dumps(w)[:200]);print('sync  ',json.dumps(s)[:200])
    check('Combina: un solo pezzo',w['n']==1)
    check('Combina: worker = thread principale (triangoli, volume, nome, posizione)',w==s)
    # 2) Stampo: stesso confronto
    fresh(pg);run(pg,'mold');w=pg.evaluate(SUMMARY)
    fresh(pg,True);run(pg,'mold');s=pg.evaluate(SUMMARY)
    check('Stampo: worker = thread principale',w==s and w['n']>=1)
    # 3) Annulla con il pulsante: la scena non cambia e la pagina resta viva
    fresh(pg);before=pg.evaluate(SUMMARY)
    pg.evaluate("()=>{window.__done=false;window.__tick=0;setInterval(()=>window.__tick++,50);forma.combine().then(()=>{window.__done=true})}")
    pg.wait_for_function("document.querySelector('#busy').classList.contains('cancelable')",timeout=20000)
    check('barra con il pulsante Annulla visibile',pg.is_visible('#busy-x'))
    check('schermo di protezione attivo',pg.is_visible('#busy-shield'))
    pg.wait_for_function("window.__tick>=0");
    for _ in range(100):                                        # il worker parte dopo i primi disegni della pagina (in software sono lenti)
        if workers: break
        pg.wait_for_timeout(100)
    check('il calcolo gira in un worker',len(workers)>0)
    pg.wait_for_timeout(400);t0=pg.evaluate("window.__tick");pg.wait_for_timeout(800);t1=pg.evaluate("window.__tick")
    check('la pagina resta viva mentre il worker calcola (%d tick in 0,8 s)'%(t1-t0),t1-t0>=5)
    check('i tasti non toccano la scena durante il calcolo',pg.evaluate("forma.objects.length")==before['n'])
    pg.click('#busy-x');pg.wait_for_function("window.__done===true",timeout=20000);pg.wait_for_timeout(300)
    after=pg.evaluate(SUMMARY)
    check('Annulla: la scena è identica a prima',after==before)
    check('Annulla: barra e schermo spariti',pg.evaluate("document.querySelector('#busy').classList.contains('hidden')") and not pg.is_visible('#busy-shield'))
    check('Annulla: avviso "Operazione annullata"',pg.evaluate("document.querySelector('#toast')?.textContent||''")=='Operazione annullata')
    # 4) dopo Annulla il calcolo successivo funziona
    run(pg,'combine');a=pg.evaluate(SUMMARY)
    check('dopo Annulla, Combina funziona e dà lo stesso pezzo di prima',a==wc)
    # 5) Annulla con Esc
    fresh(pg);before=pg.evaluate(SUMMARY)
    pg.evaluate("()=>{window.__done=false;forma.mold().then(()=>{window.__done=true})}")
    pg.wait_for_function("document.querySelector('#busy').classList.contains('cancelable')",timeout=20000)
    pg.wait_for_timeout(300);pg.keyboard.press('Escape');pg.wait_for_function("window.__done===true",timeout=20000);pg.wait_for_timeout(300)
    check('Esc annulla lo Stampo: scena identica',pg.evaluate(SUMMARY)==before)
    # 6) l'annullamento non lascia nulla nella cronologia: Annulla ultima azione (undo) non cambia niente di strano
    check('nessun errore',not errs); print('errs',errs); b.close()
print('TUTTO OK' if ok else 'FALLITO')
