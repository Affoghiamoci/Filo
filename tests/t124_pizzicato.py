# Due solidi che si toccano su una faccia (anello "pizzicato"): toManifold deve tenere il volume giusto
from playwright.sync_api import sync_playwright
with sync_playwright() as p:
    b = p.chromium.launch(args=["--use-gl=swiftshader"]); pg = b.new_page()
    errs = []; pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.goto('file:///' + __file__.rsplit('/tests/', 1)[0] + '/dist/forma.html'); pg.wait_for_function("window.forma&&forma.MM()")
    r = pg.evaluate("""()=>{const f=forma,T=f.THREE;
      // due cubi 10x10x10 affiancati (faccia in comune, vertici duplicati) + un terzo sopra che tocca lo spigolo
      const box=(x,y,z,s)=>{const g=new T.BoxGeometry(s,s,s).toNonIndexed();g.translate(x,y,z);return g};
      const gs=[box(5,5,5,10),box(15,5,5,10),box(10,5,15,10)];
      let n=0;gs.forEach(g=>n+=g.attributes.position.count);const P=new Float32Array(n*3);let o=0;gs.forEach(g=>{P.set(g.attributes.position.array,o);o+=g.attributes.position.array.length});
      const geo=new T.BufferGeometry().setAttribute('position',new T.BufferAttribute(P,3));
      const mesh=new T.Mesh(geo);const m=f.toManifold(mesh);
      return {vol:m?m.volume():null}}""")
    print(r); assert r['vol'] and abs(r['vol'] - 3000) < 1, r; assert not errs, errs
    print('OK'); b.close()
