import assert from "node:assert/strict";
import test from "node:test";
import { createMaze } from "./maze.ts";
import { PUZZLES, distancesFrom, puzzleCanWalk, puzzleHazard } from "./puzzles.ts";

const maze = createMaze();
const cell = (id: keyof typeof PUZZLES.cells) => PUZZLES.cells[id];

test("the axe and the rope sit on different branches, both before the river", () => {
  const blocked = distancesFrom(maze, maze.start, [PUZZLES.river.gate]);
  assert.ok(blocked[cell("axe").z][cell("axe").x] > 0, "axe is reachable without crossing the river");
  assert.ok(blocked[cell("rope").z][cell("rope").x] > 0, "rope is reachable without crossing the river");
  assert.notEqual(`${cell("axe").x}:${cell("axe").z}`, `${cell("rope").x}:${cell("rope").z}`);
  const wish = maze.chests.find((chest) => chest.id === "wish")!;
  assert.equal(blocked[wish.z][wish.x], -1, "the chest beyond the river stays out of reach");
});

test("the moonstone can be reached without pushing through the roots", () => {
  const blocked = distancesFrom(maze, maze.start, [PUZZLES.vines.gate]);
  assert.ok(blocked[cell("moonstone").z][cell("moonstone").x] > 0);
  const creation = maze.chests.find((chest) => chest.id === "creation")!;
  assert.equal(blocked[creation.z][creation.x], -1);
});

test("stepping into the river or the roots is a fall, and the bridge is a narrow crossing", () => {
  const gate = PUZZLES.river.gate;
  const x = gate.x * maze.cellSize;
  const z = gate.z * maze.cellSize;
  assert.equal(puzzleHazard(maze, x, z, []), "river");
  assert.equal(puzzleCanWalk(maze, x, z, []), false);
  assert.equal(puzzleHazard(maze, x, z, ["axe", "rope", "bridge"]), null);
  assert.equal(puzzleCanWalk(maze, x, z, ["axe", "rope", "bridge"]), true);
  const vines = PUZZLES.vines.gate;
  assert.equal(puzzleHazard(maze, vines.x * maze.cellSize, vines.z * maze.cellSize, ["bridge"]), "vines");
  assert.equal(puzzleHazard(maze, vines.x * maze.cellSize, vines.z * maze.cellSize, ["seal"]), null);
});

test("campfires are places you can stand, and the later one is not the same as the fork", () => {
  const [hearth, fork, ridge] = PUZZLES.campfires;
  for (const campfire of PUZZLES.campfires) {
    const column = Math.round(campfire.x / maze.cellSize);
    const row = Math.round(campfire.z / maze.cellSize);
    assert.equal(maze.grid[row][column], 0, campfire.id);
  }
  assert.notEqual(`${fork.x}:${fork.z}`, `${ridge.x}:${ridge.z}`);
  assert.ok(hearth.z > fork.z || hearth.x !== fork.x);
});
