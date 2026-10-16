from playwright.sync_api import sync_playwright
import sys,random
OK=True
JS="""(a)=>{const M=forma.MM(), Mf=M.Manifold, T=forma.THREE;
 // pezzi con vertici quasi coincidenti (scarti sotto il micron), tipici di booleane su tessellazioni diverse
 const {n1,n2,d,N,rh,R,hseg}=a;
 const A=Mf.cylinder(9.61,R,R,n1,true).translate([0,0,4.8]);
 const B=Mf.cylinder(9.61,R+d,R+d,n1,true).rotate([0,0,d*40]).translate([0,0,4.8]);
 let U=Mf.union([A,B]); const hs=[]; for(let i=0;i<N;i++){const t=i/N*Math.PI*2; hs.push(Mf.cylinder(12,rh,rh,hseg,true).translate([(R+0.1)*Math.cos(t),(R+0.1)*Math.sin(t),4.8]));}
 U=U.subtract(Mf.union(hs)); const hole=Mf.cylinder(12,4.4,4.4,200,true).translate([0,0,4.8]); U=U.subtract(hole);
 const mesh=U.getMesh(), vp=mesh.vertProperties, tv=mesh.triVerts, nP=mesh.numProp;
 const pos=new Float32Array(tv.length*3); for(let i=0;i<tv.length;i++){const k=tv[i]*nP;pos[i*3]=vp[k];pos[i*3+1]=vp[k+1];pos[i*3+2]=vp[k+2];}
 const g=new T.BufferGeometry(); g.setAttribute('position',new T.BufferAttribute(pos,3)); const m=new T.Mesh(g); m.updateMatrixWorld(true);
 const count=(geo)=>{const p=geo.attributes.position, idx=geo.index, n=idx?idx.count:p.count; const map=new Map(); const ids=new Int32Array(n);
   for(let i=0;i<n;i++){const j=idx?idx.getX(i):i; const k=p.getX(j)+','+p.getY(j)+','+p.getZ(j); let id=map.get(k); if(id===undefined){id=map.size;map.set(k,id);} ids[i]=id;}
   const e=new Map(); for(let t=0;t<n;t+=3){const a=ids[t],b=ids[t+1],c=ids[t+2]; if(a==b||b==c||a==c)continue; for(const [x,y] of [[a,b],[b,c],[c,a]]){const k=x+'>'+y; e.set(k,(e.get(k)||0)+1);} }
   let unp=0,dup=0; for(const [k,c] of e){const [x,y]=k.split('>'); if((e.get(y+'>'+x)||0)!==c)unp++; if(c>1)dup++;} return unp+dup;};
 const before=count(g); const baked=forma.bakeResult(m,'t'); return [g.attributes.position.count/3,before,baked.geo.index?baked.geo.index.count/3:baked.geo.attributes.position.count/3,count(baked.geo)];}"""
with sync_playwright() as p:
    b=p.chromium.launch(); pg=b.new_page(); pg.goto('file:///tmp/forma/dist/forma.html'); pg.wait_for_timeout(1500)
    az,el=pg.evaluate("[forma.cam.az,forma.cam.el]"); ok0=abs(az-135)<0.5 and abs(el-35.264)<0.5
    print(('OK ' if ok0 else 'KO ')+'la vista all\'avvio è quella isometrica (45°/35,26°)')
    random.seed(5); bad=0; n=0
    for i in range(20):
        a=dict(n1=random.choice([97,128,200,255]),n2=100,d=random.choice([0.0001,0.0007,0.002,0.01]),N=random.choice([96,100]),rh=random.choice([0.4,0.5]),R=random.choice([12.4,12.9]),hseg=random.choice([16,32]))
        r=pg.evaluate(JS,a); n+=1; bad+= 1 if r[3] else 0
    print(('OK ' if bad==0 else 'KO ')+f'dopo il calcolo, {n} anelli zigrinati restano chiusi ({bad} rotti)')
    # esportazione: il 3MF di un pezzo chiuso resta chiuso
    ex=pg.evaluate("""(()=>{forma.createObject('cylinder');const o=forma.objects.at(-1);return forma.build3MF([o]).length}) ()""")
    print('OK' if ex>1000 else 'KO','export 3MF produce dati',ex)
    print('TUTTO OK' if ok0 and bad==0 and ex>1000 else 'FALLITO'); b.close()
