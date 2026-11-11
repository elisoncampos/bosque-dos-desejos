import * as THREE from 'three';
import { PUZZLES, type PuzzleAction } from '@/lib/puzzles';
export function createPuzzleScenery(scene: THREE.Scene) {
  const root=new THREE.Group();scene.add(root);
  const resources:Array<THREE.BufferGeometry|THREE.Material>=[];
  const mat=(color:string,emissive?:string)=>{const m=new THREE.MeshStandardMaterial({color,roughness:.85,flatShading:true,...(emissive?{emissive,emissiveIntensity:1.7}:{})});resources.push(m);return m;};
  const bark=mat('#715039'),wood=mat('#c0a17a'),iron=mat('#a6bdc0'),ropeMat=mat('#c5ae77'),rock=mat('#7b8e82'),leaf=mat('#67885f'),magic=mat('#e2d5ff','#9d78ee');
  const add=(g:THREE.BufferGeometry,m:THREE.Material,parent:THREE.Object3D,x:number,y:number,z:number)=>{resources.push(g);const o=new THREE.Mesh(g,m);o.position.set(x,y,z);o.castShadow=true;o.receiveShadow=true;parent.add(o);return o;};
  const pickups=new Map<string,THREE.Group>();
  for(const id of ['axe','rope','moonstone'] as const){
    const p=PUZZLES.positions[id],group=new THREE.Group();group.position.set(p.x,0,p.z);root.add(group);
    add(new THREE.CylinderGeometry(.55,.75,.55,7),bark,group,0,.275,0);
    add(new THREE.CylinderGeometry(.56,.56,.04,12),wood,group,0,.57,0);
    const item=new THREE.Group();item.position.y=.8;group.add(item);pickups.set(id,item);
    if(id==='axe'){
      const handle=add(new THREE.CylinderGeometry(.045,.06,1.15,7),wood,item,0,.25,0);handle.rotation.z=-.35;
      const blade=add(new THREE.BoxGeometry(.42,.32,.075),iron,item,.22,.7,0);blade.rotation.z=-.35;
      add(new THREE.BoxGeometry(.12,.15,.1),bark,item,.12,.68,0);
    }else if(id==='rope'){
      for(let i=0;i<6;i++){const coil=add(new THREE.TorusGeometry(.23+i*.007,.035,5,24),ropeMat,item,0,i*.055,0);coil.rotation.x=Math.PI/2;}
    }else{
      add(new THREE.OctahedronGeometry(.32),magic,item,0,.2,0);
      const ring=add(new THREE.TorusGeometry(.47,.015,5,32),magic,item,0,.2,0);ring.rotation.x=.5;
    }
    const light=new THREE.PointLight(id==='moonstone'?'#d0b1ff':'#ffe5a4',3,7,2);light.position.y=1.4;item.add(light);
  }
  const river=new THREE.Group();river.position.set(PUZZLES.river.gate.x*6,0,PUZZLES.river.gate.z*6);river.rotation.y=Math.atan2(PUZZLES.river.dx,PUZZLES.river.dz);root.add(river);
  const waterMat=new THREE.MeshStandardMaterial({color:'#3c9fba',metalness:.35,roughness:.22,transparent:true,opacity:.94,emissive:'#16495a',emissiveIntensity:.25});resources.push(waterMat);
  const water=add(new THREE.PlaneGeometry(19,5.5,1,1),waterMat,river,0,.12,0);water.rotation.x=-Math.PI/2;water.castShadow=false;
  const foamMat=mat('#afddd5');const ripples:THREE.Mesh[]=[];
  for(let i=0;i<18;i++){const r=add(new THREE.BoxGeometry(.6+(i%3)*.3,.012,.035),foamMat,river,(i*1.37)%18-9,.14,(i*1.77)%5-2.5);r.castShadow=false;ripples.push(r);}
  for(const bank of [-1,1])for(let i=-3;i<=3;i++){const stone=add(new THREE.IcosahedronGeometry(.38,0),rock,river,i*.95,.15,bank*2.95);stone.scale.set(1.2,.6,.8);}
  const fallenTree=new THREE.Group();fallenTree.position.set(0,.2,-3.35);river.add(fallenTree);
  add(new THREE.CylinderGeometry(.49,.64,6.7,9),bark,fallenTree,0,3.35,0);
  add(new THREE.CylinderGeometry(.5,.5,.04,9),wood,fallenTree,0,6.71,0);
  const crown=add(new THREE.IcosahedronGeometry(1.8,1),leaf,fallenTree,0,7,0);crown.scale.set(1.2,.65,1);
  const bindings=new THREE.Group();fallenTree.add(bindings);
  for(const y of [.4,.6,5.8,6]){const loop=add(new THREE.TorusGeometry(.63,.045,6,24),ropeMat,bindings,0,y,0);loop.rotation.x=Math.PI/2;}
  bindings.visible=false;
  const vines=new THREE.Group();vines.position.set(PUZZLES.vines.gate.x*6,0,PUZZLES.vines.gate.z*6);vines.rotation.y=Math.atan2(PUZZLES.vines.dx,PUZZLES.vines.dz);root.add(vines);
  const curtain=new THREE.Group();vines.add(curtain);
  for(let i=-3;i<=3;i++){const stem=add(new THREE.CylinderGeometry(.16,.3,4.4,7),bark,curtain,i*.8,2.1,0);stem.rotation.z=(i%2===0?.2:-.2);const leaves=add(new THREE.IcosahedronGeometry(.7,0),leaf,curtain,i*.8,2+(i%2)*.6,.1);leaves.scale.set(.8,1.8,.65);}
  const altar=new THREE.Group();altar.position.set(PUZZLES.positions.seal.x,0,PUZZLES.positions.seal.z);root.add(altar);
  add(new THREE.CylinderGeometry(.6,.85,.85,6),rock,altar,1.6,.425,0);
  const rune=add(new THREE.TorusGeometry(.3,.065,7,24,Math.PI*1.6),magic,altar,1.6,1,0);rune.rotation.x=-Math.PI/2;
  const installed=add(new THREE.OctahedronGeometry(.23),magic,altar,1.6,1.2,0);installed.visible=false;
  let completed=new Set<string>();let first=true;
  function setState(actions:readonly string[]){completed=new Set(actions);for(const [id,item] of pickups)item.visible=!completed.has(id);bindings.visible=completed.has('bridge');installed.visible=completed.has('seal');if(first){fallenTree.rotation.x=completed.has('bridge')?Math.PI/2:0;curtain.scale.y=completed.has('seal')?.025:1;first=false;}}
  function update(time:number,dt:number){
    fallenTree.rotation.x=THREE.MathUtils.damp(fallenTree.rotation.x,completed.has('bridge')?Math.PI/2:0,2,dt);
    crown.scale.setScalar(completed.has('bridge')?.28:1);
    curtain.scale.y=THREE.MathUtils.damp(curtain.scale.y,completed.has('seal')?.025:1,2.3,dt);
    for(let i=0;i<ripples.length;i++)ripples[i].position.x=((time*.7+i*1.37)%18)-9;
    for(const [id,item] of pickups){if(id==='moonstone')item.rotation.y=time*.6;item.position.y=.8+Math.sin(time*1.4)*.05;}
  }
  return {setState,update,destroy(){scene.remove(root);resources.forEach(r=>r.dispose());}};
}
