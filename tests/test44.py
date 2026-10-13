from playwright.sync_api import sync_playwright
import sys
font=sys.argv[1] if len(sys.argv)>1 else 'inter'
with sync_playwright() as p:
    b=p.chromium.launch(args=["--use-gl=swiftshader","--enable-webgl","--ignore-gpu-blocklist"])
    pg=b.new_context(viewport={'width':1440,'height':900}).new_page()
    errs=[]; pg.on('pageerror',lambda e:errs.append(str(e)))
    pg.goto('file:///tmp/forma/dist/forma.html'); pg.wait_for_timeout(500)
    pg.keyboard.press('b'); pg.keyboard.press('t'); pg.wait_for_timeout(400)
    pg.select_option('#t-font',font); pg.wait_for_timeout(400)
    pg.evaluate("""()=>{const f=window.forma;const [bx,tx]=f.objects;f.setDims&&0;bx.userData.p.w=80;bx.userData.p.d=40;bx.userData.p.h=20;}""")
    r=pg.evaluate("""()=>{const f=window.forma;const [bx,tx]=f.objects;
      f.setDims(bx,{w:80,d:40,h:20});
      tx.position.set(0,0,18);tx.updateMatrixWorld(true);
      f.setSelection([bx]); if(!tx.userData.hole) {f.setSelection([tx]);f.toggleHole();}
      f.setSelection([bx,tx]); f.combine();
      const o=f.objects[0];const g=o.geometry;const idx=g.index;const pos=g.attributes.position;
      const key=i=>[0,1,2].map(k=>Math.round([pos.getX(i),pos.getY(i),pos.getZ(i)][k]*1000)).join(',');
      const e=new Map();for(let t=0;t<idx.count;t+=3){for(let k=0;k<3;k++){const a=key(idx.getX(t+k)),b=key(idx.getX(t+(k+1)%3));const kk=a<b?a+'|'+b:b+'|'+a;e.set(kk,(e.get(kk)||0)+1);}}
      let open=0,non=0;e.forEach(v=>{if(v===1)open++;else if(v!==2)non++});
      return {n:f.objects.length,tris:idx.count/3,open,non}}""")
    print(font,r,errs); b.close()
