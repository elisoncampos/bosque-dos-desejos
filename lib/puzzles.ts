import { createMaze, canWalk, type Maze, type MazeCell } from "./maze.ts";

export const ACTION_IDS = ["axe", "rope", "moonstone", "bridge", "seal"] as const;
export type PuzzleAction = typeof ACTION_IDS[number];
export type PuzzleTarget = { id: string; label: string; message: string };
export type PuzzleState = { actions: PuzzleAction[] };
export type Campfire = { id: string; name: string; message: string; x: number; z: number };
export type Hazard = "river" | "vines";
export const EMPTY_PUZZLES: PuzzleState = { actions: [] };
export const ITEM_NAMES: Record<string, string> = { axe: "Machado", rope: "Corda", moonstone: "Pedra da lua" };

const adjacent = (cell: MazeCell) => [[0, 1], [1, 0], [0, -1], [-1, 0]].map(([x, z]) => ({ x: cell.x + x, z: cell.z + z }));
const keyOf = (cell: MazeCell) => `${cell.x}:${cell.z}`;

function openNeighbors(maze: Maze, cell: MazeCell) {
  return adjacent(cell).filter((next) => maze.grid[next.z]?.[next.x] === 0);
}

export function distancesFrom(maze: Maze, origin: MazeCell, blocked: MazeCell[] = []) {
  const walls = new Set(blocked.map(keyOf));
  const distances = Array.from({ length: maze.height }, () => Array<number>(maze.width).fill(-1));
  if (walls.has(keyOf(origin)) || maze.grid[origin.z]?.[origin.x] !== 0) return distances;
  const queue = [origin];
  distances[origin.z][origin.x] = 0;
  for (let index = 0; index < queue.length; index++) {
    const cell = queue[index];
    for (const next of openNeighbors(maze, cell)) {
      if (walls.has(keyOf(next)) || distances[next.z][next.x] !== -1) continue;
      distances[next.z][next.x] = distances[cell.z][cell.x] + 1;
      queue.push(next);
    }
  }
  return distances;
}

function cellsWhere(maze: Maze, distances: number[][], accept: (cell: MazeCell, distance: number, exits: number) => boolean) {
  const found: Array<MazeCell & { distance: number }> = [];
  for (let z = 1; z < maze.height - 1; z++) {
    for (let x = 1; x < maze.width - 1; x++) {
      if (distances[z][x] < 0) continue;
      const cell = { x, z };
      const exits = openNeighbors(maze, cell).length;
      if (accept(cell, distances[z][x], exits)) found.push({ ...cell, distance: distances[z][x] });
    }
  }
  return found;
}

function closest(cells: Array<MazeCell & { distance: number }>, target: number) {
  return cells.reduce((best, next) => Math.abs(next.distance - target) < Math.abs(best.distance - target) ? next : best);
}

function pathOf(maze: Maze, distances: number[][], cell: MazeCell) {
  const path = [cell];
  let current = cell;
  while (distances[current.z][current.x] > 0) {
    const step = openNeighbors(maze, current).find((next) => distances[next.z][next.x] === distances[current.z][current.x] - 1);
    if (!step) break;
    path.push(step);
    current = step;
  }
  return path;
}

export function createPuzzles(maze: Maze = createMaze()) {
  function barrier(id: string) {
    const chest = maze.chests.find((item) => item.id === id);
    if (!chest) throw new Error(`Missing chest ${id}`);
    const gate = adjacent(chest).find((cell) => maze.distances[cell.z]?.[cell.x] === chest.distance - 1);
    const approach = gate && adjacent(gate).find((cell) => maze.distances[cell.z]?.[cell.x] === chest.distance - 2);
    if (!gate || !approach) throw new Error(`Missing approach for ${id}`);
    return { gate, approach, dx: chest.x - gate.x, dz: chest.z - gate.z };
  }
  const river = barrier("wish");
  const vines = barrier("creation");
  const used = new Set<string>([...maze.chests.map(keyOf), keyOf(river.gate), keyOf(river.approach), keyOf(vines.gate), keyOf(vines.approach)]);
  const beforeRiver = distancesFrom(maze, maze.start, [river.gate]);
  const riverDistance = beforeRiver[river.approach.z][river.approach.x];
  const deadEnds = cellsWhere(maze, beforeRiver, (cell, distance, exits) => exits === 1 && distance > 12 && distance < riverDistance && !used.has(keyOf(cell)) && cell.z < 32);
  if (deadEnds.length < 2) throw new Error("The forest needs two branches before the river.");
  const axe = closest(deadEnds, 48);
  used.add(keyOf(axe));
  const axePath = new Set(pathOf(maze, beforeRiver, axe).map(keyOf));
  const rope = deadEnds
    .filter((cell) => keyOf(cell) !== keyOf(axe))
    .reduce((best, next) => {
      const shared = pathOf(maze, beforeRiver, next).filter((cell) => axePath.has(keyOf(cell))).length;
      const bestShared = pathOf(maze, beforeRiver, best).filter((cell) => axePath.has(keyOf(cell))).length;
      return shared < bestShared ? next : best;
    });
  used.add(keyOf(rope));
  const beforeVines = distancesFrom(maze, maze.start, [vines.gate]);
  const stoneEnds = cellsWhere(maze, beforeVines, (cell, distance, exits) => exits === 1 && !used.has(keyOf(cell)) && cell.z < 32 && distance > beforeRiver[river.approach.z][river.approach.x]);
  const moonstone = (stoneEnds.length ? closest(stoneEnds, maze.chests.find((item) => item.id === "creation")!.distance * 0.82) : closest(cellsWhere(maze, beforeVines, (cell, distance, exits) => exits === 1 && !used.has(keyOf(cell)) && cell.z < 32 && distance > 20), 140));
  used.add(keyOf(moonstone));

  const forkChoices = cellsWhere(maze, beforeRiver, (cell, distance, exits) => exits >= 3 && distance > 16 && distance < riverDistance - 2 && !used.has(keyOf(cell)));
  const fork = (forkChoices.length ? closest(forkChoices, riverDistance * 0.55) : closest(cellsWhere(maze, beforeRiver, (cell, distance) => distance > 16 && !used.has(keyOf(cell)) && cell.z < 32), 40));
  const ridgeChoices = cellsWhere(maze, beforeVines, (cell, distance, exits) => exits >= 3 && distance > maze.chests.find((item) => item.id === "wish")!.distance + 4 && beforeVines[vines.approach.z][vines.approach.x] > distance && !used.has(keyOf(cell)));
  const ridge = ridgeChoices.length ? closest(ridgeChoices, maze.chests.find((item) => item.id === "creation")!.distance * 0.75) : fork;
  const hearthCell = { x: 16, z: 36 };
  const world = (cell: MazeCell) => ({ x: cell.x * maze.cellSize, z: cell.z * maze.cellSize });
  const campfires: Campfire[] = [
    { id: "hearth", name: "Fogueira da clareira", message: "O primeiro descanso. Se a floresta te derrubar, você pode acordar aqui.", ...world(hearthCell) },
    { id: "fork", name: "Fogueira do caminho partido", message: "Dois caminhos se separam. Descansar aqui guarda o lugar.", ...world(fork) },
    { id: "ridge", name: "Fogueira da outra margem", message: "Um pouco de calor depois da travessia. Dá para deixar este ponto guardado.", ...world(ridge) },
  ];
  const gridCells = { axe, rope, moonstone, bridge: river.approach, seal: vines.approach };
  const positions = Object.fromEntries(Object.entries(gridCells).map(([id, cell]) => [id, world(cell)])) as Record<PuzzleAction, MazeCell>;
  return { river, vines, positions, campfires, cells: gridCells };
}

export const PUZZLES = createPuzzles();

export function puzzleTarget(id: string, actions: readonly string[]): PuzzleTarget {
  const campfire = PUZZLES.campfires.find((item) => item.id === id);
  if (campfire) return { id, label: "Descansar e guardar o lugar", message: campfire.message };
  if (id === "bridge") return { id, label: actions.includes("axe") && actions.includes("rope") ? "Cortar e amarrar a árvore" : "Examinar a árvore", message: "O rio é fundo. Esta árvore alcançaria a outra margem…" };
  if (id === "seal") return { id, label: actions.includes("moonstone") ? "Encaixar a pedra da lua" : "Examinar o altar", message: "Uma marca de lua brilha sob as raízes." };
  return { id, label: `Recolher ${ITEM_NAMES[id].toLowerCase()}`, message: id === "axe" ? "Um machado esquecido entre as raízes. Serve para derrubar a árvore do rio." : id === "rope" ? "Uma corda resistente, noutro braço da floresta. Segura uma ponte." : "Uma pedra que parece guardar o luar." };
}

export function puzzleRequirement(id: PuzzleAction, actions: readonly string[]): string | null {
  if (id === "bridge" && (!actions.includes("axe") || !actions.includes("rope"))) return !actions.includes("axe") && !actions.includes("rope") ? "Preciso de um machado para cortar e de uma corda para firmar a árvore." : !actions.includes("axe") ? "A corda está comigo. Falta algo para cortar a árvore." : "O machado está comigo. Uma corda deixaria a travessia segura.";
  if (id === "seal" && !actions.includes("moonstone")) return "Há um encaixe vazio no altar. Parece ter o formato de uma lua.";
  return null;
}

function barrierContact(barrier: { gate: MazeCell; dx: number; dz: number }, x: number, z: number) {
  const gateX = barrier.gate.x * 6;
  const gateZ = barrier.gate.z * 6;
  const along = (x - gateX) * barrier.dx + (z - gateZ) * barrier.dz;
  const across = (x - gateX) * barrier.dz - (z - gateZ) * barrier.dx;
  const inside = Math.abs(along) < 2.85 && Math.abs(across) < 3.5;
  return { inside, onLog: inside && Math.abs(across) <= 0.85 };
}

export function puzzleHazard(maze: Maze, x: number, z: number, actions: readonly string[]): Hazard | null {
  if (!canWalk(maze, x, z)) return null;
  const river = barrierContact(PUZZLES.river, x, z);
  if (river.inside && !(actions.includes("bridge") && river.onLog)) return "river";
  const vines = barrierContact(PUZZLES.vines, x, z);
  if (vines.inside && !actions.includes("seal")) return "vines";
  return null;
}

export function puzzleCanWalk(maze: Maze, x: number, z: number, actions: readonly string[]) {
  return canWalk(maze, x, z) && !puzzleHazard(maze, x, z, actions);
}

export function campfireNear(x: number, z: number) {
  return PUZZLES.campfires.find((campfire) => Math.hypot(campfire.x - x, campfire.z - z) <= 4) ?? null;
}
