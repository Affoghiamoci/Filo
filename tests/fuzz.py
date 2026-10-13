from playwright.sync_api import sync_playwright
import random
random.seed(5)
with sync_playwright() as p:
    b=p.chromium.launch(args=["--use-gl=swiftshader","--enable-webgl","--ignore-gpu-blocklist"])
    pg=b.new_context(viewport={'width':1440,'height':900}).new_page()
    errs=[]; pg.on('pageerror',lambda e:errs.append(str(e)))
    pg.goto('file:///tmp/forma/dist/forma.html'); pg.wait_for_timeout(500)
    pg.set_input_files('#file-in','/tmp/forma/samples/apple.3mf'); pg.wait_for_timeout(1000)
    pg.evaluate("()=>{const f=window.forma;f.setSelection([...f.objects]);f.groupSelection()}")
    REL="""()=>{const f=window.forma;const [a,b]=f.objects.slice().sort((x,y)=>(f.worldBox(y).getSize(new f.camera.position.constructor()).length())-(f.worldBox(x).getSize(new f.camera.position.constructor()).length()));const A=f.worldBox(a),B=f.worldBox(b);const c=B.getCenter(new A.min.constructor());const sa=A.getSize(new A.min.constructor()),sb=B.getSize(new A.min.constructor());return ['x','y','z'].map(k=>[(c[k]-A.min[k])/(sa[k]||1), sb[k]/(sa[k]||1)]).flat()}"""
    base=pg.evaluate(REL); bad=0
    log=[]
    for i in range(60):
        op=random.choice(['rotx','rotz','roty','w','d','h','lock','undo','redo','move'])
        if op.startswith('rot'): pg.evaluate(f"()=>window.forma.rotateSelection('{op[3]}',90)"); base=pg.evaluate(REL); continue
        if op=='lock': pg.click('#g-lock')
        elif op in 'wdh': pg.fill('#g-'+op, str(random.choice([20,60,150,300,45]))); pg.keyboard.press('Enter')
        elif op=='undo': pg.evaluate("()=>window.forma.undo()"); base=pg.evaluate(REL); continue
        elif op=='redo': pg.evaluate("()=>window.forma.redo()"); base=pg.evaluate(REL); continue
        elif op=='move': pg.evaluate("()=>{const f=window.forma;f.objects.forEach(o=>{o.position.x+=13;o.updateMatrixWorld(true)});}")
        pg.wait_for_timeout(30)
        cur=pg.evaluate(REL); log.append(op)
        if any(abs(x-y)>0.02*max(1,abs(y)) for x,y in zip(cur,base)):
            bad+=1; print('DRIFT after',log[-6:],[round(v,3) for v in base],[round(v,3) for v in cur]); base=cur
    print('bad',bad,errs); b.close()
