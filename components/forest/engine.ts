import * as THREE from "three";
import { canWalk, createMaze, seededRandom, type ChestId } from "@/lib/maze";
import { ForestSound } from "./sound";
import { ACTION_IDS, PUZZLES, puzzleTarget, puzzleCanWalk, type PuzzleAction, type PuzzleTarget } from "@/lib/puzzles";
import { createPuzzleScenery } from "./puzzle-scene";

export type ForestPosition = { x: number; z: number; steps: number; elapsed: number };
export type ForestCallbacks = {
  onNearObject?: (target: PuzzleTarget | null) => void;
  onPuzzle?: (action: PuzzleAction) => void;
  onNearChest?: (id: ChestId | null) => void;
  onInteract?: (id: ChestId) => void;
  onPause?: () => void;
  onReady?: () => void;
  onRegion?: (name: string) => void;
  onMove?: (position: ForestPosition) => void;
};
export type ForestController = {
  setPlaying: (playing: boolean) => void;
  setSound: (enabled: boolean) => void;
  setQuality: (quality: "high" | "low") => void;
  interact: () => void;
  destroy: () => void;
  teleportToStart: () => void;
  setPuzzleState: (actions: string[]) => void;
  setCollected: (ids: string[]) => void;
  getPosition: () => ForestPosition;
};
type Instance = { position: THREE.Vector3; scale: THREE.Vector3; rotation?: THREE.Euler; color?: string };
type ChestObject = { id: ChestId; group: THREE.Group; lid: THREE.Group; glow: THREE.Mesh; light: THREE.PointLight; opened: boolean };

export function createForest(container: HTMLElement, callbacks: ForestCallbacks = {}): ForestController {
  const maze = createMaze();
  const random = seededRandom(111135);
  const scene = new THREE.Scene();
  scene.background = new THREE.Color("#9bb6a5");
  scene.fog = new THREE.FogExp2("#9bb6a5", 0.018);
  const camera = new THREE.PerspectiveCamera(62, 1, 0.1, 160);
  camera.rotation.order = "YXZ";
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: "high-performance" });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.65));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.18;
  renderer.domElement.setAttribute("aria-label", "Floresta mágica em três dimensões");
  renderer.domElement.style.cssText = "display:block;width:100%;height:100%;outline:none;touch-action:none";
  renderer.domElement.tabIndex = 0;
  container.appendChild(renderer.domElement);
  const puzzleScenery = createPuzzleScenery(scene);
  const puzzleActions = new Set<string>();
  let nearObject: PuzzleAction | null = null;
  const clock = new THREE.Clock();
  const sound = new ForestSound();
  const disposable: Array<THREE.BufferGeometry | THREE.Material | THREE.Texture> = [];
  const v = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
  const material = (color: string, options: THREE.MeshStandardMaterialParameters = {}) => {
    const result = new THREE.MeshStandardMaterial({ color, roughness: 0.92, flatShading: true, ...options });
    disposable.push(result);
    return result;
  };
  const geom = <T extends THREE.BufferGeometry>(geometry: T): T => { disposable.push(geometry); return geometry; };
  const sphere = geom(new THREE.IcosahedronGeometry(1, 1));
  const petalGeometry = geom(new THREE.IcosahedronGeometry(1, 0));
  const smoothSphere = geom(new THREE.IcosahedronGeometry(1, 2));
  const cylinder = geom(new THREE.CylinderGeometry(0.7, 1, 1, 7));
  const box = geom(new THREE.BoxGeometry(1, 1, 1));
  const leafMaterial = material("#ffffff");
  const barkMaterial = material("#705849");
  const hedgeMaterial = material("#ffffff");
  const stoneMaterial = material("#ffffff");
  const grassMaterial = material("#ffffff", { side: THREE.DoubleSide });
  const stemMaterial = material("#b8b78c");
  const flowerMaterial = material("#ffffff", { roughness: 0.8 });
  const mushroomMaterial = material("#ffffff");
  const creamMaterial = material("#f1dfbd");
  const trunks: Instance[] = [];
  const leaves: Instance[] = [];
  const hedges: Instance[] = [];
  const stones: Instance[] = [];
  const grass: Instance[] = [];
  const flowers: Instance[] = [];
  const flowerStems: Instance[] = [];
  const caps: Instance[] = [];
  const mushroomStems: Instance[] = [];
  const mushroomSpots: Instance[] = [];
  const fernLeaves: Instance[] = [];
  const pathTiles: Instance[] = [];
  const leafColors = ["#6a8b58", "#758e60", "#4f7656", "#98a371", "#8d9c63", "#55775a"];
  const hedgeColors = ["#69875e", "#6e8d60", "#87a16b", "#597e5c"];
  const grassColors = ["#789159", "#94a76a", "#537650", "#a7b576", "#6b8957"];
  const flowerColors = ["#f2c1cc", "#f8d6d1", "#e7a5b5", "#d6b3dc", "#eaca9b", "#e4b2d1"];
  const pick = (colors: string[]) => colors[Math.floor(random() * colors.length)];
  function instance(list: Instance[], x: number, y: number, z: number, sx: number, sy: number, sz: number, color?: string, rotation?: THREE.Euler) {
    list.push({ position: v(x, y, z), scale: v(sx, sy, sz), color, rotation });
  }
  function batch(geometry: THREE.BufferGeometry, mat: THREE.Material, data: Instance[], cast = false, receive = true) {
    const mesh = new THREE.InstancedMesh(geometry, mat, data.length);
    const dummy = new THREE.Object3D();
    for (let i = 0; i < data.length; i++) {
      dummy.position.copy(data[i].position);
      dummy.scale.copy(data[i].scale);
      dummy.rotation.copy(data[i].rotation ?? new THREE.Euler());
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
      if (data[i].color) mesh.setColorAt(i, new THREE.Color(data[i].color));
    }
    mesh.castShadow = cast;
    mesh.receiveShadow = receive;
    mesh.computeBoundingSphere();
    scene.add(mesh);
    return mesh;
  }
  function mesh(geometry: THREE.BufferGeometry, mat: THREE.Material, parent: THREE.Object3D, position: THREE.Vector3, scale?: THREE.Vector3) {
    const object = new THREE.Mesh(geometry, mat);
    object.position.copy(position);
    if (scale) object.scale.copy(scale);
    object.castShadow = true;
    object.receiveShadow = true;
    parent.add(object);
    return object;
  }
  function tree(x: number, z: number, size = 1, pink = false) {
    const height = (8.4 + random() * 4.1) * size;
    const radius = (0.45 + random() * 0.35) * size;
    instance(trunks, x, height * 0.49, z, radius, height, radius, undefined, new THREE.Euler((random() - 0.5) * 0.1, random() * 6, (random() - 0.5) * 0.1));
    for (let b = 0; b < 3; b++) {
      const angle = b * 2.1 + random();
      instance(trunks, x + Math.sin(angle) * size, height * 0.64, z + Math.cos(angle) * size, radius * 0.48, height * 0.38, radius * 0.48, undefined, new THREE.Euler(Math.cos(angle) * 0.7, 0, Math.sin(angle) * 0.7));
    }
    for (let c = 0; c < 5; c++) {
      const angle = c * 2.4;
      const spread = c === 0 ? 0 : size * (1.5 + random());
      const color = pink ? pick(["#bc91a8", "#d9a6b8", "#d7b3bf", "#c298af"]) : pick(leafColors);
      instance(leaves, x + Math.sin(angle) * spread, height + (random() - 0.3) * size * 2, z + Math.cos(angle) * spread, size * (2.5 + random()), size * (1.8 + random()), size * (2.5 + random()), color, new THREE.Euler(random(), random(), random()));
    }
    for (let r = 0; r < 3; r++) {
      const angle = r * 2.09;
      instance(trunks, x + Math.cos(angle) * radius, 0.4 * size, z + Math.sin(angle) * radius, radius * 0.6, size * 1.8, radius * 0.65, undefined, new THREE.Euler(Math.sin(angle) * 0.9, 0, Math.cos(angle) * 0.9));
    }
  }
  function flowerPatch(x: number, z: number, count: number, spread = 1) {
    for (let i = 0; i < count; i++) {
      const px = x + (random() - 0.5) * spread;
      const pz = z + (random() - 0.5) * spread;
      const h = 0.28 + random() * 0.35;
      instance(flowerStems, px, h / 2, pz, 0.025, h, 0.025);
      const color = pick(flowerColors);
      for (let petal = 0; petal < 4; petal++) {
        const angle = petal * Math.PI / 2;
        instance(flowers, px + Math.cos(angle) * 0.07, h, pz + Math.sin(angle) * 0.07, 0.11, 0.045, 0.1, color);
      }
      instance(flowers, px, h + 0.035, pz, 0.04, 0.04, 0.04, "#f2d697");
    }
  }
  function mushroom(x: number, z: number, size = 1, hero = false) {
    const h = (0.55 + random() * 0.35) * size;
    instance(mushroomStems, x, h / 2, z, size * 0.12, h, size * 0.12);
    const color = hero ? "#c5869f" : pick(["#bd6c86", "#d29ba7", "#c6a576", "#a69aba"]);
    instance(caps, x, h, z, size * 0.48, size * 0.29, size * 0.48, color);
    instance(mushroomStems, x, h, z, size * 0.44, size * 0.045, size * 0.44);
    for (let i = 0; i < 5; i++) {
      const angle = i * 2.4;
      const distance = i === 0 ? 0 : 0.29;
      instance(mushroomSpots, x + Math.cos(angle) * distance * size, h + size * (i === 0 ? 0.285 : 0.22), z + Math.sin(angle) * distance * size, size * 0.055, size * 0.016, size * 0.055);
    }
  }
  function fern(x: number, z: number, size = 1) {
    for (let branch = 0; branch < 7; branch++) {
      const angle = branch * Math.PI * 2 / 7 + random() * 0.1;
      for (let leaf = 1; leaf <= 5; leaf++) {
        const extent = leaf / 5;
        const distance = extent * size * 0.95;
        const height = Math.sin(extent * 2.1) * size * 0.65;
        for (const side of [-1, 1]) {
          const perpendicular = angle + side * 0.55;
          const width = (0.2 - extent * 0.09) * size;
          instance(fernLeaves, x + Math.sin(angle) * distance + Math.sin(perpendicular) * width, height, z + Math.cos(angle) * distance + Math.cos(perpendicular) * width, width, size * 0.035, (0.24 - extent * 0.1) * size, pick(["#689361", "#86a46d", "#789d65"]), new THREE.Euler(0.1, perpendicular, 0));
        }
      }
    }
  }

  const ambient = new THREE.HemisphereLight("#fff0d6", "#465745", 2.3);
  scene.add(ambient);
  const sunlight = new THREE.DirectionalLight("#ffe7b8", 3.5);
  sunlight.position.set(82, 62, 175);
  sunlight.target.position.set(114, 0, 211);
  sunlight.castShadow = true;
  sunlight.shadow.mapSize.set(2048, 2048);
  sunlight.shadow.camera.left = -42;
  sunlight.shadow.camera.right = 42;
  sunlight.shadow.camera.top = 42;
  sunlight.shadow.camera.bottom = -42;
  sunlight.shadow.camera.near = 1;
  sunlight.shadow.camera.far = 150;
  sunlight.shadow.bias = -0.00025;
  sunlight.shadow.normalBias = 0.06;
  sunlight.shadow.radius = 3;
  scene.add(sunlight, sunlight.target);
  const fill = new THREE.DirectionalLight("#c4d8dd", 0.45);
  fill.position.set(160, 16, 240);
  scene.add(fill);

  const groundMaterial = material("#738963");
  const ground = mesh(geom(new THREE.PlaneGeometry(260, 260)), groundMaterial, scene, v(114, -0.06, 114));
  ground.rotation.x = -Math.PI / 2;
  ground.castShadow = false;
  const pathMaterial = material("#ffffff", { polygonOffset: true, polygonOffsetFactor: -1 });
  const pathGeometry = geom(new THREE.CircleGeometry(1, 9));
  pathGeometry.rotateX(-Math.PI / 2);

  for (let z = 0; z < maze.height; z++) {
    for (let x = 0; x < maze.width; x++) {
      const wx = x * maze.cellSize;
      const wz = z * maze.cellSize;
      const isWall = maze.grid[z][x] === 1;
      const isMeadow = z >= 33 && x >= 15 && x <= 23 && !isWall;
      if (isWall) {
        // Overlapping natural masses make a continuous collision wall look like woodland.
        const h = 2.6 + random() * 1.1;
        instance(hedges, wx, h * 0.42, wz, 3.7, h * 0.73, 3.65, pick(hedgeColors), new THREE.Euler(0, random(), 0));
        instance(hedges, wx + (random() - 0.5) * 3, h * 0.85, wz + (random() - 0.5) * 3, 2.4, 1.3, 2.4, pick(hedgeColors));
        const exposed = [[0, 1], [0, -1], [1, 0], [-1, 0]].some(([dx, dz]) => maze.grid[z + dz]?.[x + dx] === 0);
        if (random() < (exposed ? 0.54 : 0.18)) tree(wx + (random() - 0.5) * 1.9, wz + (random() - 0.5) * 1.9, 0.8 + random() * 0.4, random() < 0.045);
        if (exposed && random() < 0.45) {
          const dx = random() * 5 - 2.5;
          const dz = random() * 5 - 2.5;
          instance(stones, wx + dx, 0.2, wz + dz, 0.5 + random(), 0.5 + random() * 0.6, 0.6 + random(), "#7e8d75");
        }
      } else {
        if ([PUZZLES.river.gate, PUZZLES.vines.gate].some(c => c.x === x && c.z === z)) continue;
        const dirt = isMeadow ? Math.abs(x - 19) < 1 : true;
        if (dirt) instance(pathTiles, wx + (random() - 0.5) * 0.3, 0, wz, isMeadow ? 2.4 : 2.5, 1, 4.2, pick(["#b1ac8e", "#a8a68a", "#aaa58a"]));
        const clumps = isMeadow ? 44 : 16;
        for (let n = 0; n < clumps; n++) {
          let dx = (random() - 0.5) * 5.8;
          const dz = (random() - 0.5) * 5.8;
          if (!isMeadow && Math.abs(dx) < 1.4 && Math.abs(dz) < 1.7) dx += dx > 0 ? 1.6 : -1.6;
          if (isMeadow && Math.abs(x - 19) < 1 && Math.abs(dx) < 1.5 && random() < 0.8) continue;
          const h = 0.23 + random() * 0.45;
          instance(grass, wx + dx, 0, wz + dz, 0.6 + random() * 0.6, h, 0.6 + random() * 0.6, pick(grassColors), new THREE.Euler(0, random() * Math.PI, 0));
        }
        if (random() < (isMeadow ? 0.6 : 0.25)) flowerPatch(wx + (random() > 0.5 ? -2.2 : 2.2), wz + (random() - 0.5) * 3, isMeadow ? 12 : 5, 2.3);
        if (random() < 0.14) mushroom(wx + (random() > 0.5 ? -2.2 : 2.2), wz, 0.5 + random() * 0.8);
        if (random() < 0.12) fern(wx + (random() > 0.5 ? -2.25 : 2.25), wz + 1, 0.7 + random() * 0.4);
      }
    }
  }

  // Hand-composed entrance: old trees, oversize mushrooms and petal gardens.
  tree(100, 208, 1.45);
  tree(129, 203, 1.35, true);
  tree(93, 220, 1.6);
  tree(133, 225, 1.35);
  tree(104, 192, 1.3);
  tree(125, 187, 1.55);
  tree(138, 212, 1.6);
  mushroom(121.2, 209.5, 3.5, true);
  mushroom(123.4, 210, 1.7, true);
  mushroom(120.2, 211, 1.1, true);
  mushroom(104, 204, 2.2, true);
  mushroom(106, 204.5, 1.1);
  flowerPatch(120, 211.4, 70, 6);
  flowerPatch(108, 211, 60, 5);
  flowerPatch(118.5, 201, 45, 4);
  flowerPatch(109, 196, 35, 3);
  fern(109.6, 212.7, 1.5);
  fern(117.3, 215.1, 1.8);
  fern(121, 208, 1.6);
  fern(106, 206.7, 1.9);
  for (let i = 0; i < 18; i++) {
    const a = i * 0.7;
    instance(stones, 113.5 + Math.sin(a) * 0.8, 0.05, 214 - i * 1.25, 0.65 + random() * 0.25, 0.08, 0.42 + random() * 0.2, pick(["#c3bea5", "#b5b59d", "#acb39a"]), new THREE.Euler(0, a, 0));
  }
  const bladeGeometry = new THREE.BufferGeometry();
  bladeGeometry.setAttribute("position", new THREE.Float32BufferAttribute([
    -0.14, 0, 0, 0.14, 0, 0, 0.06, 1, 0.05,
    0, 0, -0.12, 0, 0, 0.12, -0.1, 0.78, 0,
    -0.16, 0, -0.08, 0.08, 0, 0.08, 0.25, 0.66, 0.12,
  ], 3));
  bladeGeometry.computeVertexNormals();
  geom(bladeGeometry);
  const capGeometry = geom(new THREE.SphereGeometry(1, 12, 7, 0, Math.PI * 2, 0, Math.PI / 2));
  batch(pathGeometry, pathMaterial, pathTiles, false, true);
  batch(cylinder, barkMaterial, trunks, true);
  const leafMesh = batch(smoothSphere, leafMaterial, leaves, true);
  batch(sphere, hedgeMaterial, hedges, true);
  batch(sphere, stoneMaterial, stones, true);
  const grassMesh = batch(bladeGeometry, grassMaterial, grass, false);
  batch(cylinder, stemMaterial, flowerStems, false);
  batch(petalGeometry, flowerMaterial, flowers, false);
  batch(capGeometry, mushroomMaterial, caps, true);
  batch(cylinder, creamMaterial, mushroomStems, true);
  batch(petalGeometry, creamMaterial, mushroomSpots, false);
  batch(petalGeometry, leafMaterial, fernLeaves, false);

  const water = mesh(geom(new THREE.CircleGeometry(3.7, 32)), material("#77a8a0", { metalness: 0.12, roughness: 0.23, transparent: true, opacity: 0.87 }), scene, v(126, 0.008, 219));
  water.rotation.x = -Math.PI / 2;
  water.scale.y = 0.7;
  water.castShadow = false;
  const rippleMaterial = new THREE.MeshBasicMaterial({ color: "#bfd4b8", transparent: true, opacity: 0.24, depthWrite: false });
  disposable.push(rippleMaterial);
  for (const radius of [0.5, 1.1, 1.8]) {
    const ripple = mesh(geom(new THREE.TorusGeometry(radius, 0.018, 3, 40)), rippleMaterial, scene, v(125.5, 0.025, 218.8));
    ripple.rotation.x = -Math.PI / 2;
    ripple.scale.y = 0.7;
    ripple.castShadow = false;
  }

  const arch = new THREE.Group();
  arch.position.set(114, 0, 192);
  scene.add(arch);
  const archMaterial = material("#7c7253");
  const mossMaterial = material("#9caa73");
  const archCurve = new THREE.CatmullRomCurve3([v(-3.6, 0, 0), v(-3.5, 3.4, 0.15), v(-2.4, 6, 0), v(0, 7, -0.1), v(2.4, 6, 0), v(3.5, 3.4, 0.1), v(3.6, 0, 0)]);
  mesh(geom(new THREE.TubeGeometry(archCurve, 28, 0.55, 7, false)), archMaterial, arch, v(0, 0, 0));
  const vineCurve = new THREE.CatmullRomCurve3(Array.from({ length: 40 }, (_, i) => {
    const point = archCurve.getPoint(i / 39);
    point.x += Math.sin(i * 1.3) * 0.3;
    point.z += Math.cos(i * 1.3) * 0.5;
    return point;
  }));
  mesh(geom(new THREE.TubeGeometry(vineCurve, 80, 0.095, 5, false)), mossMaterial, arch, v(0, 0, 0));
  for (let i = 0; i < 23; i++) {
    const p = archCurve.getPoint((i + 1) / 25);
    mesh(sphere, i % 4 === 0 ? material("#e7b4c5") : mossMaterial, arch, p.add(v((random() - 0.5) * 0.8, 0.1, -0.2)), v(0.65, 0.3, 0.6));
  }
  const glowMaterial = material("#fff2bd", { emissive: "#ffd48e", emissiveIntensity: 2, roughness: 0.5 });
  const lanternMaterial = material("#8a7451", { metalness: 0.35 });
  for (const side of [-1, 1]) {
    mesh(cylinder, lanternMaterial, arch, v(side * 2.9, 4.5, 0.3), v(0.035, 1.25, 0.035));
    mesh(sphere, glowMaterial, arch, v(side * 2.9, 3.75, 0.3), v(0.2, 0.32, 0.2));
    mesh(geom(new THREE.ConeGeometry(0.3, 0.22, 6)), lanternMaterial, arch, v(side * 2.9, 4.06, 0.3));
    mesh(geom(new THREE.ConeGeometry(0.25, 0.16, 6)), lanternMaterial, arch, v(side * 2.9, 3.44, 0.3)).rotation.z = Math.PI;
    const light = new THREE.PointLight("#ffde99", 4, 8, 2);
    light.position.set(side * 2.9, 3.75, 0.5);
    arch.add(light);
  }

  // Thin translucent shafts of light make the clearing feel alive without a postprocess.
  const rayMaterial = new THREE.MeshBasicMaterial({ color: "#ffe8bb", transparent: true, opacity: 0.035, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending });
  disposable.push(rayMaterial);
  for (let i = 0; i < 7; i++) {
    const ray = new THREE.Mesh(geom(new THREE.CylinderGeometry(0.2, 1.5, 20, 8, 1, true)), rayMaterial);
    ray.position.set(104 + i * 4, 9, 190 + (i % 3) * 6);
    ray.rotation.z = -0.37;
    scene.add(ray);
  }

  const chestObjects: ChestObject[] = [];
  const woodMaterial = material("#805745", { roughness: 0.75 });
  const goldMaterial = material("#c7a265", { metalness: 0.45, roughness: 0.4 });
  const chestGlowMaterial = material("#ffe6a6", { emissive: "#ffc873", emissiveIntensity: 2.7, transparent: true, opacity: 0.55 });
  const darkMaterial = material("#493b35");
  for (const chest of maze.chests) {
    const group = new THREE.Group();
    group.position.set(chest.x * maze.cellSize, 0.1, chest.z * maze.cellSize);
    scene.add(group);
    mesh(sphere, mossMaterial, group, v(0, -0.06, 0), v(1.5, 0.18, 1.35));
    mesh(box, woodMaterial, group, v(0, 0.42, 0), v(1.35, 0.7, 0.9));
    const lid = new THREE.Group();
    lid.position.set(0, 0.78, -0.43);
    group.add(lid);
    mesh(box, woodMaterial, lid, v(0, 0.1, 0.43), v(1.4, 0.22, 0.94));
    const roundedTop = geom(new THREE.CylinderGeometry(0.47, 0.47, 1.4, 12, 1, false, 0, Math.PI));
    const roof = mesh(roundedTop, woodMaterial, lid, v(0, 0.13, 0.43));
    roof.rotation.z = Math.PI / 2;
    for (const side of [-1, 1]) {
      mesh(box, goldMaterial, group, v(side * 0.48, 0.42, 0.463), v(0.09, 0.74, 0.035));
      mesh(box, goldMaterial, group, v(side * 0.48, 0.42, -0.463), v(0.09, 0.74, 0.035));
      mesh(box, goldMaterial, lid, v(side * 0.48, 0.24, 0.43), v(0.095, 0.08, 0.98));
    }
    mesh(box, goldMaterial, group, v(0, 0.65, 0.485), v(0.23, 0.27, 0.06));
    mesh(sphere, darkMaterial, group, v(0, 0.65, 0.525), v(0.035, 0.055, 0.02));
    mesh(box, goldMaterial, group, v(0, 0.11, 0), v(1.4, 0.08, 0.95));
    const glow = mesh(geom(new THREE.OctahedronGeometry(0.2)), chestGlowMaterial, group, v(0, 1.7, 0), v(0.75, 1.3, 0.75));
    glow.castShadow = false;
    const light = new THREE.PointLight("#ffcf79", 3.5, 6, 2);
    light.position.set(0, 1.25, 0);
    group.add(light);
    chestObjects.push({ id: chest.id, group, lid, glow, light, opened: false });
  }

  // Sprite textures are generated locally; there are no remote models or image dependencies.
  function radialTexture() {
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 64;
    const ctx = canvas.getContext("2d")!;
    const gradient = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    gradient.addColorStop(0, "rgba(255,255,239,1)");
    gradient.addColorStop(0.15, "rgba(255,244,191,0.9)");
    gradient.addColorStop(0.45, "rgba(255,222,156,0.18)");
    gradient.addColorStop(1, "rgba(255,222,156,0)");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 64, 64);
    const texture = new THREE.CanvasTexture(canvas);
    disposable.push(texture);
    return texture;
  }
  const particleCount = 140;
  const particlePositions = new Float32Array(particleCount * 3);
  const particleOffsets = new Float32Array(particleCount * 4);
  for (let i = 0; i < particleCount; i++) {
    particleOffsets[i * 4] = (random() - 0.5) * 44;
    particleOffsets[i * 4 + 1] = 0.5 + random() * 6.5;
    particleOffsets[i * 4 + 2] = (random() - 0.5) * 44;
    particleOffsets[i * 4 + 3] = random() * Math.PI * 2;
  }
  const particleGeometry = geom(new THREE.BufferGeometry());
  particleGeometry.setAttribute("position", new THREE.BufferAttribute(particlePositions, 3));
  const particleMaterial = new THREE.PointsMaterial({ size: 0.2, map: radialTexture(), color: "#fff2b0", transparent: true, opacity: 0.85, depthWrite: false, blending: THREE.AdditiveBlending });
  disposable.push(particleMaterial);
  const particles = new THREE.Points(particleGeometry, particleMaterial);
  particles.frustumCulled = false;
  scene.add(particles);

  const butterflyGroup = new THREE.Group();
  scene.add(butterflyGroup);
  const butterflies: { body: THREE.Group; left: THREE.Mesh; right: THREE.Mesh; phase: number; base: THREE.Vector3 }[] = [];
  const wingGeometry = geom(new THREE.CircleGeometry(0.11, 6));
  const wingMaterial = material("#d6b6df", { side: THREE.DoubleSide, emissive: "#705970", emissiveIntensity: 0.25 });
  for (let i = 0; i < 12; i++) {
    const body = new THREE.Group();
    const left = mesh(wingGeometry, wingMaterial, body, v(-0.09, 0, 0), v(1, 1.5, 1));
    const right = mesh(wingGeometry, wingMaterial, body, v(0.09, 0, 0), v(1, 1.5, 1));
    body.rotation.x = -0.6;
    butterflyGroup.add(body);
    butterflies.push({ body, left, right, phase: random() * Math.PI * 2, base: v(108 + random() * 14, 0.6 + random() * 1.4, 198 + random() * 16) });
  }

  let destroyed = false;
  let playing = false;
  let hasPlayed = false;
  let soundEnabled = false;
  let dragging = false;
  let yaw = 0;
  let pitch = 0.025;
  let travel = 0;
  let elapsed = 0;
  let lastMove = 0;
  let lastProximity = 0;
  let lastRegion = "";
  let nearChest: ChestId | null = null;
  let frame = 0;
  let animation = 0;
  let suppressUnlockPause = false;
  const keys = new Set<string>();
  const collected = new Set<string>();
  const startX = maze.start.x * maze.cellSize;
  const startZ = maze.start.z * maze.cellSize;
  camera.position.set(startX, 1.72, startZ);
  const position = (): ForestPosition => ({ x: camera.position.x, z: camera.position.z, steps: Math.round(travel / 0.72), elapsed: Math.floor(elapsed) });
  function resize() {
    const width = Math.max(container.clientWidth, 1);
    const height = Math.max(container.clientHeight, 1);
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  }
  const observer = new ResizeObserver(resize);
  observer.observe(container);
  resize();

  function lockPointer() {
    if (document.pointerLockElement === renderer.domElement) return;
    try {
      const result = renderer.domElement.requestPointerLock();
      if (result) result.catch(() => undefined);
    } catch { /* Drag-to-look remains available when an iframe disallows pointer lock. */ }
  }
  function setPlaying(value: boolean) {
    if (destroyed) return;
    playing = value;
    keys.clear();
    dragging = false;
    if (value) {
      hasPlayed = true;
      renderer.domElement.focus({ preventScroll: true });
      lockPointer();
      if (soundEnabled) sound.setEnabled(true);
    } else if (document.pointerLockElement === renderer.domElement) {
      suppressUnlockPause = true;
      document.exitPointerLock();
    }
  }
  function interact() {
    if (!playing) return;
    if (nearObject) {
      const p = PUZZLES.positions[nearObject];
      if (Math.hypot(camera.position.x-p.x,camera.position.z-p.z) < 3.4) { callbacks.onPuzzle?.(nearObject); return; }
    }
    if (!nearChest || collected.has(nearChest)) return;
    const chest = chestObjects.find((entry) => entry.id === nearChest);
    if (!chest || Math.hypot(camera.position.x - chest.group.position.x, camera.position.z - chest.group.position.z) >= 3.4) {
      nearChest = null;
      callbacks.onNearChest?.(null);
      return;
    }
    callbacks.onInteract?.(nearChest);
  }
  function onKeyDown(event: KeyboardEvent) {
    if (!playing) return;
    if (["KeyW", "KeyA", "KeyS", "KeyD", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Space", "KeyE"].includes(event.code)) event.preventDefault();
    keys.add(event.code);
    if (event.code === "KeyE" && !event.repeat) interact();
    if (event.code === "Escape") {
      setPlaying(false);
      callbacks.onPause?.();
    }
  }
  function onKeyUp(event: KeyboardEvent) { keys.delete(event.code); }
  function onMouseMove(event: MouseEvent) {
    if (!playing || (document.pointerLockElement !== renderer.domElement && !dragging)) return;
    yaw -= event.movementX * 0.0021;
    pitch = THREE.MathUtils.clamp(pitch - event.movementY * 0.0021, -1.25, 1.25);
  }
  function onMouseDown(event: MouseEvent) {
    if (!playing || event.button !== 0) return;
    dragging = true;
    lockPointer();
  }
  function onMouseUp() { dragging = false; }
  function onPointerLockChange() {
    if (document.pointerLockElement === renderer.domElement) return;
    if (suppressUnlockPause) { suppressUnlockPause = false; return; }
    if (playing) {
      playing = false;
      keys.clear();
      callbacks.onPause?.();
    }
  }
  function onBlur() {
    keys.clear();
    if (playing) { setPlaying(false); callbacks.onPause?.(); }
  }
  function onVisibility() { if (document.hidden) onBlur(); }
  window.addEventListener("keydown", onKeyDown);
  window.addEventListener("keyup", onKeyUp);
  window.addEventListener("mousemove", onMouseMove);
  window.addEventListener("mouseup", onMouseUp);
  window.addEventListener("blur", onBlur);
  renderer.domElement.addEventListener("mousedown", onMouseDown);
  document.addEventListener("pointerlockchange", onPointerLockChange);
  document.addEventListener("visibilitychange", onVisibility);

  const animate = () => {
    if (destroyed) return;
    animation = requestAnimationFrame(animate);
    const dt = Math.min(clock.getDelta(), 0.05);
    const time = clock.elapsedTime;
    frame++;
    if (playing) {
      elapsed += dt;
      let forward = Number(keys.has("KeyW") || keys.has("ArrowUp")) - Number(keys.has("KeyS") || keys.has("ArrowDown"));
      let strafe = Number(keys.has("KeyD") || keys.has("ArrowRight")) - Number(keys.has("KeyA") || keys.has("ArrowLeft"));
      const length = Math.hypot(forward, strafe);
      if (length) {
        forward /= length;
        strafe /= length;
        const speed = keys.has("ShiftLeft") || keys.has("ShiftRight") ? 6.4 : 4.2;
        const dx = (strafe * Math.cos(yaw) - forward * Math.sin(yaw)) * speed * dt;
        const dz = (-forward * Math.cos(yaw) - strafe * Math.sin(yaw)) * speed * dt;
        const beforeX = camera.position.x;
        const beforeZ = camera.position.z;
        if (puzzleCanWalk(maze, camera.position.x + dx, camera.position.z, [...puzzleActions])) camera.position.x += dx;
        if (puzzleCanWalk(maze, camera.position.x, camera.position.z + dz, [...puzzleActions])) camera.position.z += dz;
        travel += Math.hypot(camera.position.x - beforeX, camera.position.z - beforeZ);
        camera.position.y = THREE.MathUtils.lerp(camera.position.y, 1.72 + Math.sin(travel * 3.2) * 0.025, 0.25);
      } else camera.position.y = THREE.MathUtils.lerp(camera.position.y, 1.72, 0.07);
      camera.rotation.set(pitch, yaw, 0, "YXZ");
      if (time - lastMove > 4) { callbacks.onMove?.(position()); lastMove = time; }
      if (time - lastProximity > 0.15) {
        lastProximity = time;
        const object = ACTION_IDS.find(id => !puzzleActions.has(id) && Math.hypot(camera.position.x-PUZZLES.positions[id].x,camera.position.z-PUZZLES.positions[id].z)<3.4) ?? null;
        if (object !== nearObject) { nearObject = object; callbacks.onNearObject?.(object ? puzzleTarget(object,[...puzzleActions]) : null); }
        const closest = chestObjects.find((chest) => !collected.has(chest.id) && Math.hypot(camera.position.x - chest.group.position.x, camera.position.z - chest.group.position.z) < 3.4);
        const id = closest?.id ?? null;
        if (id !== nearChest) { nearChest = id; callbacks.onNearChest?.(id); }
        const column = Math.round(camera.position.x / maze.cellSize);
        const row = Math.round(camera.position.z / maze.cellSize);
        const distance = maze.distances[row]?.[column] ?? 0;
        const region = row >= 32 ? "Clareira dos começos" : distance < 70 ? "Jardim dos sussurros" : distance < 160 ? "Bosque das borboletas" : distance < 260 ? "Vale dos sonhos" : distance < 360 ? "Floresta dos segredos" : "Além do horizonte";
        if (region !== lastRegion) { lastRegion = region; callbacks.onRegion?.(region); }
      }
    } else if (!hasPlayed) {
      camera.rotation.set(0.04 + Math.sin(time * 0.12) * 0.009, -0.04 + Math.sin(time * 0.065) * 0.055, 0, "YXZ");
      yaw = camera.rotation.y;
      pitch = camera.rotation.x;
    }
    if (frame % 12 === 0) {
      sunlight.position.set(camera.position.x - 32, 62, camera.position.z - 36);
      sunlight.target.position.set(camera.position.x, 0, camera.position.z - 6);
      sunlight.target.updateMatrixWorld();
    }
    for (let i = 0; i < particleCount; i++) {
      const phase = particleOffsets[i * 4 + 3];
      particlePositions[i * 3] = camera.position.x + particleOffsets[i * 4] + Math.sin(time * 0.22 + phase) * 1.2;
      particlePositions[i * 3 + 1] = particleOffsets[i * 4 + 1] + Math.sin(time * 0.32 + phase) * 0.5;
      particlePositions[i * 3 + 2] = camera.position.z + particleOffsets[i * 4 + 2] + Math.cos(time * 0.2 + phase) * 1.2;
    }
    particleGeometry.attributes.position.needsUpdate = true;
    for (const butterfly of butterflies) {
      butterfly.body.position.copy(butterfly.base).add(v(Math.sin(time * 0.55 + butterfly.phase) * 1.2, Math.sin(time * 1.3 + butterfly.phase) * 0.25, Math.cos(time * 0.45 + butterfly.phase) * 0.8));
      butterfly.body.rotation.y = time * 0.3 + butterfly.phase;
      butterfly.left.rotation.y = Math.sin(time * 12 + butterfly.phase) * 0.9;
      butterfly.right.rotation.y = -butterfly.left.rotation.y;
    }
    for (const chest of chestObjects) {
      chest.lid.rotation.x = THREE.MathUtils.lerp(chest.lid.rotation.x, chest.opened ? -1.15 : 0, dt * 4);
      chest.glow.position.y = 1.65 + Math.sin(time * 1.7 + chest.group.position.x) * 0.16;
      chest.glow.rotation.y = time * 0.7;
      chest.glow.visible = !chest.opened;
      chest.light.intensity = chest.opened ? 1 : 3.5 + Math.sin(time * 2) * 0.6;
    }
    puzzleScenery.update(time, dt);
    renderer.render(scene, camera);
  };
  animate();
  callbacks.onRegion?.("Clareira dos começos");
  requestAnimationFrame(() => { if (!destroyed) callbacks.onReady?.(); });

  return {
    setPlaying,
    setPuzzleState(actions) { puzzleActions.clear(); actions.forEach(a=>puzzleActions.add(a)); puzzleScenery.setState(actions); nearObject=null; callbacks.onNearObject?.(null); },
    setSound(enabled) { soundEnabled = enabled; if (playing || !enabled) sound.setEnabled(enabled); },
    setQuality(quality) {
      renderer.setPixelRatio(quality === "high" ? Math.min(window.devicePixelRatio || 1, 1.65) : 1);
      renderer.shadowMap.enabled = quality === "high";
      leafMesh.castShadow = quality === "high";
      grassMesh.visible = true;
      resize();
    },
    interact,
    getPosition: position,
    teleportToStart() {
      camera.position.set(startX, 1.72, startZ);
      yaw = 0;
      pitch = 0.025;
      nearChest = null;
      callbacks.onNearChest?.(null);
      callbacks.onRegion?.("Clareira dos começos");
      callbacks.onMove?.(position());
    },
    setCollected(ids) {
      const newlyOpened = ids.some((id) => !collected.has(id));
      collected.clear();
      ids.forEach((id) => collected.add(id));
      for (const chest of chestObjects) chest.opened = collected.has(chest.id);
      if (newlyOpened && hasPlayed) sound.chest();
      if (nearChest && collected.has(nearChest)) { nearChest = null; callbacks.onNearChest?.(null); }
    },
    destroy() {
      destroyed = true;
      playing = false;
      cancelAnimationFrame(animation);
      if (document.pointerLockElement === renderer.domElement) document.exitPointerLock();
      observer.disconnect();
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
      window.removeEventListener("blur", onBlur);
      renderer.domElement.removeEventListener("mousedown", onMouseDown);
      document.removeEventListener("pointerlockchange", onPointerLockChange);
      document.removeEventListener("visibilitychange", onVisibility);
      sound.destroy();
      puzzleScenery.destroy();
      disposable.forEach((resource) => resource.dispose());
      renderer.dispose();
      renderer.domElement.remove();
    },
  };
}
