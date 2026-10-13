from playwright.sync_api import sync_playwright
import sys
with sync_playwright() as p:
    b=p.chromium.launch(args=["--use-gl=swiftshader"]);pg=b.new_page(viewport={'width':1400,'height':850})
    errs=[];pg.on('pageerror',lambda e:errs.append(str(e)));pg.on('console',lambda m: m.type=='error' and errs.append(m.text))
    pg.goto('file:///tmp/forma/dist/forma.html');pg.wait_for_timeout(1200)
    pg.evaluate("forma.createObject('box')");pg.wait_for_timeout(200)
    pg.keyboard.press('e');pg.wait_for_timeout(200)
    print(pg.evaluate("(()=>{const o=forma.objects[0];const an=forma.edgeAnalysis(o);return [an.sharp.length]})()"))
    # chain on first sharp edge
    print(pg.evaluate("""(()=>{const o=forma.objects[0];const an=forma.edgeAnalysis(o);const ch=forma.chainOf(an,an.sharp[0]);return [ch.verts.length,ch.closed]})()"""))
    # volume helper
    vol="""(m)=>{const g=m.geometry.index?m.geometry.toNonIndexed():m.geometry;const p=g.attributes.position;let v=0;for(let i=0;i<p.count;i+=3){const ax=p.getX(i),ay=p.getY(i),az=p.getZ(i),bx=p.getX(i+1),by=p.getY(i+1),bz=p.getZ(i+1),cx=p.getX(i+2),cy=p.getY(i+2),cz=p.getZ(i+2);v+=(ax*(by*cz-bz*cy)-ay*(bx*cz-bz*cx)+az*(bx*cy-by*cx))/6}return v}"""
    print('vol0',pg.evaluate(f"({vol})(forma.objects[0])"))
    for mode,size in [('fillet',3),('chamfer',3)]:
        pg.evaluate("forma.createObject('box')")
        r=pg.evaluate(f"""(()=>{{const o=forma.objects.at(-1);forma.setSelection([o]);const an=forma.edgeAnalysis(o);
          const e=an.sharp[0];const ch=forma.chainOf(an,e);forma.edgeSel().push({{obj:o,chain:ch}});forma.edgeMode.v='{mode}';document.querySelector('#e-size').value='{size}';forma.applyEdges();
          const n=forma.objects.at(-1);return [n.userData.kind,({vol})(n)]}})()""")
        print(mode,r)
    pg.screenshot(path='edge1.png');print(errs);b.close()
