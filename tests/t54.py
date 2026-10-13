from playwright.sync_api import sync_playwright
with sync_playwright() as p:
    b=p.chromium.launch(args=["--use-gl=swiftshader"]);pg=b.new_page(viewport={'width':1400,'height':850})
    errs=[];pg.on('pageerror',lambda e:errs.append(str(e)));pg.on('console',lambda m: m.type=='error' and errs.append(m.text))
    pg.goto('file:///tmp/forma/dist/forma.html');pg.wait_for_timeout(1200)
    helper="""
    window.T={vol:(m)=>{const g=m.geometry.index?m.geometry.toNonIndexed():m.geometry;const p=g.attributes.position;let v=0;for(let i=0;i<p.count;i+=3){const ax=p.getX(i),ay=p.getY(i),az=p.getZ(i),bx=p.getX(i+1),by=p.getY(i+1),bz=p.getZ(i+1),cx=p.getX(i+2),cy=p.getY(i+2),cz=p.getZ(i+2);v+=(ax*(by*cz-bz*cy)-ay*(bx*cz-bz*cx)+az*(bx*cy-by*cx))/6}return v},
    open:(m)=>{const g=m.geometry.index?m.geometry.toNonIndexed():m.geometry;const p=g.attributes.position;const q=v=>Math.round(v*2000);const k=i=>q(p.getX(i))+','+q(p.getY(i))+','+q(p.getZ(i));const E=new Map();for(let i=0;i<p.count;i+=3)for(let j=0;j<3;j++){const a=k(i+j),b=k(i+(j+1)%3);const key=a<b?a+'|'+b:b+'|'+a;E.set(key,(E.get(key)||0)+1)}let bad=0;for(const v of E.values())if(v!==2)bad++;return bad},
    run:(kind,mode,size,pred,params)=>{forma.createObject(kind);const o=forma.objects.at(-1);if(params)Object.assign(o.userData.p,params);forma.setSelection([o]);
      const an=forma.edgeAnalysis(o);const es=an.sharp.filter(e=>pred?new Function('e','an','return '+pred)(e,an):true);
      const sel=forma.edgeSel();sel.length=0;const seen=[];for(const e of es){const ch=forma.chainOf(an,e);if(seen.some(s=>s.verts.length===ch.verts.length&&ch.verts.every(v=>s.verts.includes(v))))continue;seen.push(ch);sel.push({obj:o,chain:ch})}
      forma.edgeMode.v=mode;document.querySelector('#e-size').value=size;const n0=forma.objects.length;forma.applyEdges();
      const n=forma.objects.at(-1);return {chains:seen.length,lens:seen.map(s=>s.verts.length+(s.closed?'c':'o')),kind:n.userData.kind,vol:T.vol(n),open:T.open(n)}}}
    """
    pg.evaluate(helper)
    topz="(e,an)=>true"
    print('cyl all fillet2', pg.evaluate("T.run('cylinder','fillet',2)"))
    print('box top4 chamfer', pg.evaluate("T.run('box','chamfer',2,'an.vp(e.a).z>19.9&&an.vp(e.b).z>19.9')"))
    print('box all fillet2', pg.evaluate("T.run('box','fillet',2)"))
    print('prism all chamfer', pg.evaluate("T.run('prism','chamfer',1.5)"))
    print('cone fillet', pg.evaluate("T.run('cone','fillet',1.5,null,{q:50})"))
    print('rbox fillet', pg.evaluate("T.run('box','fillet',1,null,{r:6})"))
    pg.evaluate("forma.fitView&&forma.fitView()");pg.wait_for_timeout(300)
    pg.screenshot(path='edge2.png');print(errs);b.close()
