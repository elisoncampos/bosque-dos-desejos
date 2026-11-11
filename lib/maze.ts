/** Deterministic world. Gift descriptions intentionally live on the server. */
export const CHEST_IDS = ["ember", "feast", "wish", "creation", "horizon"] as const;
export type ChestId = (typeof CHEST_IDS)[number];
export type MazeCell = { x: number; z: number };
export type MazeChest = MazeCell & { id: ChestId; distance: number };
export type Maze = {
  width: number;
  height: number;
  cellSize: number;
  grid: number[][];
  start: MazeCell;
  entrance: MazeCell;
  chests: MazeChest[];
  distances: number[][];
};

export function seededRandom(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function createMaze(seed = 351107): Maze {
  const width = 39;
  const height = 39;
  const cellSize = 6;
  const random = seededRandom(seed);
  const grid = Array.from({ length: height }, () => Array<number>(width).fill(1));
  const entrance = { x: 19, z: 31 };
  const stack = [entrance];
  grid[entrance.z][entrance.x] = 0;
  const directions = [[0, -2], [2, 0], [0, 2], [-2, 0]];

  // A perfect maze has one true route to every clearing, with long false branches.
  while (stack.length) {
    const cell = stack[stack.length - 1];
    const available = directions
      .map(([dx, dz]) => ({ x: cell.x + dx, z: cell.z + dz }))
      .filter((next) => next.x > 0 && next.x < width - 1 && next.z > 0 && next.z <= 31 && grid[next.z][next.x] === 1);
    if (!available.length) {
      stack.pop();
      continue;
    }
    const next = available[Math.floor(random() * available.length)];
    grid[(cell.z + next.z) / 2][(cell.x + next.x) / 2] = 0;
    grid[next.z][next.x] = 0;
    stack.push(next);
  }

  // Extra openings turn the single route into forks: two ways forward, and long branches that still end.
  const forks: MazeCell[] = [];
  for (let z = 2; z <= 30; z++) {
    for (let x = 2; x < width - 2; x++) {
      if (grid[z][x] !== 1) continue;
      const vertical = grid[z - 1][x] === 0 && grid[z + 1][x] === 0;
      const horizontal = grid[z][x - 1] === 0 && grid[z][x + 1] === 0;
      if (vertical !== horizontal) forks.push({ x, z });
    }
  }
  for (let i = forks.length - 1; i > 0; i--) {
    const swap = Math.floor(random() * (i + 1));
    [forks[i], forks[swap]] = [forks[swap], forks[i]];
  }
  for (const cell of forks.slice(0, 18)) grid[cell.z][cell.x] = 0;

  // A broad, safe meadow gives the player space to learn the controls.
  for (let z = 33; z <= 37; z++) for (let x = 15; x <= 23; x++) grid[z][x] = 0;
  grid[32][19] = 0;
  const start = { x: 19, z: 36 };
  const distances = Array.from({ length: height }, () => Array<number>(width).fill(-1));
  const queue: MazeCell[] = [start];
  distances[start.z][start.x] = 0;
  const steps = [[0, -1], [1, 0], [0, 1], [-1, 0]];
  for (let i = 0; i < queue.length; i++) {
    const cell = queue[i];
    for (const [dx, dz] of steps) {
      const x = cell.x + dx;
      const z = cell.z + dz;
      if (grid[z]?.[x] === 0 && distances[z][x] === -1) {
        distances[z][x] = distances[cell.z][cell.x] + 1;
        queue.push({ x, z });
      }
    }
  }

  const deadEnds = queue.filter(({ x, z }) => z < 32 && steps.filter(([dx, dz]) => grid[z + dz]?.[x + dx] === 0).length === 1)
    .sort((a, b) => distances[a.z][a.x] - distances[b.z][b.x]);
  const maxDistance = Math.max(...deadEnds.map(({ x, z }) => distances[z][x]));
  const selected = new Set<string>();
  const targets = [8, maxDistance * 0.2, maxDistance * 0.43, maxDistance * 0.7, maxDistance];
  let previousDistance = 0;
  const chests = CHEST_IDS.map((id, index) => {
    const candidates = index === 0 ? queue.filter(({ z }) => z < 32) : deadEnds;
    const possible = candidates.filter(({ x, z }) => !selected.has(`${x}:${z}`) && distances[z][x] > previousDistance);
    const cell = possible.reduce((best, next) => Math.abs(distances[next.z][next.x] - targets[index]) < Math.abs(distances[best.z][best.x] - targets[index]) ? next : best, possible[0]);
    selected.add(`${cell.x}:${cell.z}`);
    previousDistance = distances[cell.z][cell.x];
    return { ...cell, id, distance: previousDistance };
  });
  return { width, height, cellSize, grid, start, entrance, chests, distances };
}

export function canWalk(maze: Maze, x: number, z: number, radius = 0.4): boolean {
  // Sample all four corners so a diagonal cannot slip through the hedge.
  for (const dx of [-radius, radius]) {
    for (const dz of [-radius, radius]) {
      const column = Math.floor((x + dx) / maze.cellSize + 0.5);
      const row = Math.floor((z + dz) / maze.cellSize + 0.5);
      if (maze.grid[row]?.[column] !== 0) return false;
    }
  }
  return true;
}
