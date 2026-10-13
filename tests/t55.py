from playwright.sync_api import sync_playwright
with sync_playwright() as p:
    b=p.chromium.launch(args=["--use-gl=swiftshader"]);pg=b.new_page(viewport={'width':1400,'height':850})
    pg.goto('file:///tmp/forma/dist/forma.html');pg.wait_for_timeout(1000)
    print(pg.evaluate("""(()=>{forma.createObject('box');forma.createObject('cylinder');const [a,c]=forma.objects;c.userData.hole=true;c.position.set(5,3,-1);c.userData.p.h=30;c.updateMatrixWorld();forma.setSelection([a,c]);forma.combine();
    const m=forma.objects.at(-1);const g=m.geometry.index?m.geometry.toNonIndexed():m.geometry;const p=g.attributes.position;const q=v=>Math.round(v*2000);const k=i=>q(p.getX(i))+','+q(p.getY(i))+','+q(p.getZ(i));const E=new Map();for(let i=0;i<p.count;i+=3)for(let j=0;j<3;j++){const a=k(i+j),b=k(i+(j+1)%3);const key=a<b?a+'|'+b:b+'|'+a;E.set(key,(E.get(key)||0)+1)}let bad=0;for(const v of E.values())if(v!==2)bad++;return [bad,E.size,p.count/3]})()"""))
    b.close()
