import { createMaze, type ChestId } from "@/lib/maze";

// This module is only imported by API route handlers. Locked rewards never enter the client bundle.
export const GIFTS: Record<ChestId, { title: string; description: string }> = {
  ember: { title: "Macarrão com camarão, alho e bacon", description: "Uma noite deliciosa, feita com carinho. Seu macarrão com camarão, alho e bacon está garantido." },
  feast: { title: "Hump steak", description: "Um jantar especial com hump steak para celebrar essa descoberta." },
  wish: { title: "Uma compra de até R$ 200", description: "Escolha sua loja favorita: você ganhou uma compra de até R$ 200." },
  creation: { title: "Bambu Lab A1 Combo", description: "Uma Bambu Lab A1 Combo para dar forma às suas ideias — na Black Friday ou no Natal." },
  horizon: { title: "Viagem para Florianópolis", description: "Você encontrou o segredo mais distante da floresta: uma viagem para Floripa em 2027." },
};

export const MAZE = createMaze();

export function isChestId(value: unknown): value is ChestId {
  return typeof value === "string" && Object.hasOwn(GIFTS, value);
}

export function isNearChest(chestId: ChestId, position: unknown) {
  if (!position || typeof position !== "object") return false;
  const { x, z } = position as { x?: unknown; z?: unknown };
  if (typeof x !== "number" || typeof z !== "number" || !Number.isFinite(x) || !Number.isFinite(z)) return false;
  const chest = MAZE.chests.find((item) => item.id === chestId);
  return !!chest && Math.hypot(x - chest.x * MAZE.cellSize, z - chest.z * MAZE.cellSize) <= 3.5;
}

export function publicDiscovery(row: { chestId: string; discoveredAt: number }) {
  if (!isChestId(row.chestId)) throw new Error("Unknown saved chest.");
  return { chestId: row.chestId, ...GIFTS[row.chestId], discoveredAt: new Date(row.discoveredAt).toISOString() };
}
