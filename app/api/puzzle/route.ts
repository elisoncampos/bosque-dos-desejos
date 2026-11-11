import { asc, eq } from 'drizzle-orm';
import { puzzleEvents } from '@/db/schema';
import { ACTION_IDS, PUZZLES, puzzleRequirement, type PuzzleAction } from '@/lib/puzzles';
import { ApiError, assertMutation, body, database, handle, json, rateLimit, readSession, requireSession } from '@/lib/server/http';
export const dynamic='force-dynamic';
export function GET(request:Request) {return handle(async()=>{
  const db=await database();const session=await readSession(request,db,'player');
  if(!session?.playerId)return json({actions:[]});
  const rows=await db.select().from(puzzleEvents).where(eq(puzzleEvents.playerId,session.playerId)).orderBy(asc(puzzleEvents.createdAt));
  return json({actions:rows.map(r=>r.action)});
});}
export function POST(request:Request) {return handle(async()=>{
  assertMutation(request);const data=await body(request);const db=await database();const session=await requireSession(request,db,'player');
  if(!session.playerId)throw new ApiError(401,'authentication_required','Entre no bosque novamente.');
  await rateLimit(request,db,'puzzle',90,60);
  if(typeof data.action!=='string'||!ACTION_IDS.includes(data.action as PuzzleAction))throw new ApiError(400,'invalid_action','Este objeto não faz parte do bosque.');
  const action=data.action as PuzzleAction;const position=data.position as {x?:number;z?:number}|undefined;const target=PUZZLES.positions[action];
  if(!position||typeof position.x!=='number'||typeof position.z!=='number'||!Number.isFinite(position.x)||!Number.isFinite(position.z)||Math.hypot(position.x-target.x,position.z-target.z)>3.5)throw new ApiError(400,'too_far','Chegue mais perto para interagir.');
  const rows=await db.select().from(puzzleEvents).where(eq(puzzleEvents.playerId,session.playerId)).orderBy(asc(puzzleEvents.createdAt));const actions=rows.map(r=>r.action);
  const missing=puzzleRequirement(action,actions);if(missing)throw new ApiError(409,'missing_item',missing);
  await db.insert(puzzleEvents).values({playerId:session.playerId,action,createdAt:Date.now()}).onConflictDoNothing();
  return json({actions:Array.from(new Set([...actions,action])),message:action==='bridge'?'A árvore caiu. A corda está firme. Agora dá para atravessar.':action==='seal'?'A pedra despertou o altar. As raízes abriram passagem.':'Guardado na mochila.'});
});}
