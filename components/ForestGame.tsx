"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { ArrowLeft, ArrowRight, Axe, BookOpen, Check, ChevronRight, Compass, Gem, Gift, Headphones, Heart, Leaf, LoaderCircle, Mouse, Pause, Play, RotateCcw, Sparkles, Trees, Volume2, VolumeX, Wind, X } from "lucide-react";
import type { ForestController } from "@/components/forest/engine";
import { FairyMark, Fireflies, LeafCorner, VineFrame, WoodEmblem } from "@/components/forest/ui-ornaments";
import { CHEST_IDS, type ChestId } from "@/lib/maze";
import { ITEM_NAMES, type PuzzleAction, type PuzzleTarget, type PuzzleState } from "@/lib/puzzles";

type Discovery = { chestId: ChestId; title: string; description: string; discoveredAt: string };
type Panel = "controls" | "journal" | "pause" | null;

async function api<T>(path: string, data?: unknown): Promise<T> {
  const response = await fetch(path, { method: data === undefined ? "GET" : "POST", headers: data === undefined ? undefined : { "Content-Type": "application/json" }, body: data === undefined ? undefined : JSON.stringify(data), cache: "no-store" });
  const result = await response.json().catch(() => ({})) as T & { error?: string };
  if (!response.ok) throw new Error(result.error || "O bosque não conseguiu salvar agora. Tente novamente.");
  return result as T;
}

function Dialog({ children, label, className = "", onClose }: { children: ReactNode; label: string; className?: string; onClose: () => void }) {
  const dialog = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const root = dialog.current;
    root?.querySelector<HTMLButtonElement>("button")?.focus();
    const handle = (event: KeyboardEvent) => {
      if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); onClose(); }
      if (event.key !== "Tab" || !root) return;
      const elements = Array.from(root.querySelectorAll<HTMLElement>('button:not([disabled]),a[href],input:not([disabled]),[tabindex="0"]'));
      const first = elements[0]; const last = elements[elements.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    };
    document.addEventListener("keydown", handle, true);
    return () => { document.removeEventListener("keydown", handle, true); previous?.focus(); };
  }, [onClose]);
  return (
    <div className="dialog-scrim" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <div ref={dialog} className={`forest-dialog ${className}`} role="dialog" aria-modal="true" aria-label={label}>
        <LeafCorner className="is-tl" />
        <LeafCorner className="is-tr" />
        <LeafCorner className="is-bl" />
        <LeafCorner className="is-br" />
        <button className="dialog-close" aria-label="Fechar" onClick={onClose}><X size={15} /></button>
        {children}
      </div>
    </div>
  );
}

export default function ForestGame() {
  const container = useRef<HTMLDivElement>(null);
  const engine = useRef<ForestController | null>(null);
  const claimRef = useRef<(id: ChestId) => void>(() => {});
  const busyRef = useRef(false);
  const puzzleRef = useRef<(id: PuzzleAction) => void>(() => {});
  const campfireRef = useRef<(id: string) => void>(() => {});
  const selectSlotRef = useRef<(index: number) => void>(() => {});
  const toggleSoundRef = useRef(() => {});
  const checkpointRef = useRef<{ x: number; z: number } | null>(null);
  const actionsRef = useRef<PuzzleAction[]>([]);
  const [actions, setActions] = useState<PuzzleAction[]>([]);
  const [nearObject, setNearObject] = useState<PuzzleTarget | null>(null);
  const [nearCampfire, setNearCampfire] = useState<PuzzleTarget | null>(null);
  const [selectedSlot, setSelectedSlot] = useState(0);
  const [notice, setNotice] = useState("");
  const hasStartedRef = useRef(false);
  const collectedRef = useRef<Discovery[]>([]);
  const [ready, setReady] = useState(false);
  const [renderError, setRenderError] = useState(false);
  const [started, setStarted] = useState(false);
  const [panel, setPanel] = useState<Panel>(null);
  const [sound, setSound] = useState(false);
  const [quality, setQuality] = useState<"high" | "low">("high");
  const [nearChest, setNearChest] = useState<ChestId | null>(null);
  const [region, setRegion] = useState("Clareira dos começos");
  const [discoveries, setDiscoveries] = useState<Discovery[]>([]);
  const [gift, setGift] = useState<Discovery | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [sessionReady, setSessionReady] = useState(false);

  const playUi = useCallback((kind: "open" | "select" | "close" = "select") => {
    engine.current?.playUi(kind);
  }, []);

  useEffect(() => {
    let disposed = false;
    import("@/components/forest/engine").then(({ createForest }) => {
      if (disposed || !container.current) return;
      engine.current = createForest(container.current, {
        onNearObject: setNearObject, onPuzzle: id => puzzleRef.current(id),
        onNearCampfire: setNearCampfire, onCampfire: id => campfireRef.current(id),
        onHazard: (hazard) => setNotice(hazard === "river" ? "A água te levou. Você acorda na última fogueira, com a mochila intacta." : "As raízes te prenderam. Você acorda na última fogueira, com a mochila intacta."),
        onReady: () => setReady(true), onNearChest: setNearChest, onRegion: setRegion,
        onInteract: (id) => claimRef.current(id),
        onPause: () => { if (hasStartedRef.current && !busyRef.current) setPanel((current) => current ?? "pause"); },
      });
      engine.current.setCollected(collectedRef.current.map((d) => d.chestId));
      engine.current.setPuzzleState(actionsRef.current);
    }).catch(() => { if (!disposed) setRenderError(true); });
    api<{ discoveries: Discovery[]; playerId: string | null; checkpoint: { x: number; z: number } | null }>("/api/game").then(async (data) => {
      const progress = await api<PuzzleState>("/api/puzzle");
      if (disposed) return;
      checkpointRef.current = data.checkpoint;
      setDiscoveries(data.discoveries); collectedRef.current = data.discoveries;
      engine.current?.setCollected(data.discoveries.map((d) => d.chestId));
      actionsRef.current = progress.actions; setActions(progress.actions); engine.current?.setPuzzleState(progress.actions);
      setSessionReady(!!data.playerId);
    }).catch(() => { /* Entry retries the server and presents any remaining failure. */ });
    return () => { disposed = true; engine.current?.destroy(); engine.current = null; };
  }, []);

  const resume = useCallback(() => {
    playUi("close");
    setPanel(null); setGift(null); setError("");
    engine.current?.setPlaying(true);
  }, [playUi]);
  const closePanel = useCallback(() => {
    playUi("close");
    setPanel(null);
    if (hasStartedRef.current) setPanel("pause");
  }, [playUi]);
  const openPanel = (next: Panel) => {
    playUi("open");
    engine.current?.setPlaying(false);
    setPanel(next);
  };

  useEffect(() => {
    const key = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.tagName === "SELECT" || target.isContentEditable)) return;
      if (!started || gift || saving || event.repeat) return;
      if (event.code === "KeyJ") {
        engine.current?.setPlaying(false); setPanel((current) => current === "journal" ? "pause" : "journal");
      }
      if (panel) return;
      if (event.code === "KeyM") { event.preventDefault(); toggleSoundRef.current(); }
      if (event.code.startsWith("Digit")) {
        const slot = Number(event.code.slice(5)) - 1;
        if (slot >= 0 && slot < 9) { event.preventDefault(); selectSlotRef.current(slot); }
      }
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [started, gift, saving, panel]);

  const enter = async () => {
    if (!ready || connecting) return;
    playUi("open");
    if (!sessionReady) {
      setConnecting(true); setError("");
      try {
        const result = await api<{ discoveries: Discovery[]; playerId: string; checkpoint: { x: number; z: number } | null }>("/api/game", { name: "Júlia" });
        checkpointRef.current = result.checkpoint;
        setDiscoveries(result.discoveries); collectedRef.current = result.discoveries;
        engine.current?.setCollected(result.discoveries.map((d) => d.chestId));
        const progress = await api<PuzzleState>("/api/puzzle");
        actionsRef.current = progress.actions; setActions(progress.actions); engine.current?.setPuzzleState(progress.actions);
        setSessionReady(true); setPanel("controls");
      } catch (err) { setError(err instanceof Error ? err.message : "Não foi possível entrar no bosque."); }
      finally { setConnecting(false); }
    } else setPanel("controls");
  };

  const begin = () => {
    if (!sessionReady) { void enter(); return; }
    playUi("select");
    hasStartedRef.current = true; setStarted(true); setPanel(null); setError("");
    const saved = checkpointRef.current;
    if (saved) engine.current?.wakeAt(saved.x, saved.z);
    engine.current?.setSound(sound);
    engine.current?.setPlaying(true);
  };

  useEffect(() => {
    claimRef.current = async (chestId) => {
      if (busyRef.current || collectedRef.current.some((d) => d.chestId === chestId)) return;
      busyRef.current = true; setSaving(true); setError("");
      const position = engine.current?.getPosition();
      engine.current?.setPlaying(false);
      try {
        const result = await api<{ discovery: Discovery }>("/api/discover", { chestId, position });
        const next = [...collectedRef.current.filter((d) => d.chestId !== chestId), result.discovery];
        collectedRef.current = next; setDiscoveries(next);
        engine.current?.setCollected(next.map((d) => d.chestId));
        setGift(result.discovery); setPanel(null);
      } catch (err) { setError(err instanceof Error ? err.message : "Seu presente ainda não foi registrado. Tente abrir o baú novamente."); setPanel("pause"); }
      finally { busyRef.current = false; setSaving(false); }
    };
    puzzleRef.current = async (action) => {
      if (busyRef.current) return;
      busyRef.current = true; setError(""); setNotice("");
      try {
        const result = await api<PuzzleState & { message: string }>("/api/puzzle", { action, position: engine.current?.getPosition() });
        actionsRef.current = result.actions; setActions(result.actions); engine.current?.setPuzzleState(result.actions); setNotice(result.message);
      } catch (err) { setError(err instanceof Error ? err.message : "Não foi possível guardar o objeto. Tente novamente."); }
      finally { busyRef.current = false; }
    };
    campfireRef.current = async (campfireId) => {
      if (busyRef.current) return;
      busyRef.current = true; setError("");
      try {
        const result = await api<{ checkpoint: { x: number; z: number }; message: string }>("/api/checkpoint", { campfireId, position: engine.current?.getPosition() });
        checkpointRef.current = result.checkpoint;
        engine.current?.setCheckpoint(result.checkpoint.x, result.checkpoint.z);
        setNotice(result.message);
      } catch (err) { setError(err instanceof Error ? err.message : "Não foi possível guardar o lugar. Tente novamente."); }
      finally { busyRef.current = false; }
    };
  }, []);

  const held = actions.filter((id) => id in ITEM_NAMES);
  useEffect(() => {
    const item = actions.filter((id) => id in ITEM_NAMES)[selectedSlot];
    engine.current?.setEquipped(item === "axe" ? "axe" : null);
  }, [actions, selectedSlot, ready]);
  const selectSlot = (index: number) => {
    setSelectedSlot(index);
    const item = held[index];
    if (!item) return;
    playUi("select");
    if (engine.current?.tryUse(item === "moonstone" ? "seal" : "bridge")) return;
    setNotice(`${ITEM_NAMES[item]} em mãos.`);
  };
  useEffect(() => { selectSlotRef.current = selectSlot; });
  useEffect(() => { if (!notice) return; const timer = setTimeout(() => setNotice(""), 5500); return () => clearTimeout(timer); }, [notice]);
  const toggleSound = () => {
    const next = !sound;
    setSound(next);
    engine.current?.setSound(next);
    if (next) engine.current?.playUi("select");
  };
  useEffect(() => { toggleSoundRef.current = toggleSound; });
  const SoundIcon = sound ? Volume2 : VolumeX;
  const leave = () => { engine.current?.setPlaying(false); hasStartedRef.current = false; setStarted(false); setPanel(null); setGift(null); };
  const foundIds = new Set(discoveries.map((d) => d.chestId));

  return <main className="forest-app">
    <div ref={container} className={`forest-stage ${started ? "playing" : ""}`} />
    {renderError && <div className="fallback-art"><Trees /></div>}
    {!started && <>
      <div className="title-veil" />
      <Fireflies />
      <div className="title-topbar">
        <button className="sound-pill" onClick={toggleSound} aria-label={sound ? "Desativar som ambiente" : "Ativar som ambiente"}>
          <SoundIcon size={14} /><span>Som {sound ? "ligado" : "mudo"}</span>
        </button>
        <div className="title-links">
          <button className="ghost-link" onClick={() => openPanel("journal")}><BookOpen size={13} /><span> Diário</span></button>
          <button className="ghost-link" onClick={() => openPanel("controls")}><Compass size={13} /><span> Controles</span></button>
        </div>
      </div>
      <section className="title-screen">
        <div className="title-card">
          <div className="title-brand">
            <WoodEmblem className="title-emblem" />
            <div className="title-eyebrow"><FairyMark size={14} /> Para Júlia</div>
          </div>
          <h1>Bosque dos Desejos</h1>
          <VineFrame className="title-ornament" />
          <p className="title-tagline">Se perder também é um jeito de se encontrar.</p>
          <p className="title-copy">Entre as folhas, a luz dourada e um pouquinho de magia, há cinco segredos esperando por você.</p>
          <div className="title-actions">
            <button
              className={`game-button start-button${ready && !connecting && !renderError ? " is-pulse" : ""}`}
              onClick={enter}
              disabled={!ready || connecting || renderError}
            >
              {connecting ? <LoaderCircle size={16} className="spin" /> : <FairyMark size={16} />}
              <span>{connecting ? "Abrindo o caminho…" : sessionReady ? "Voltar ao bosque" : "Entrar no bosque"}</span>
              <ArrowRight size={15} />
            </button>
            {ready && !connecting && !renderError && <p className="click-hint">Clique para começar</p>}
            <p className="headphone-note"><Headphones size={12} /> Com fones, a magia fica ainda melhor.</p>
            <p className="mobile-message">Esta aventura foi feita para computador. Abra com um teclado e mouse para explorar a floresta.</p>
            {renderError && <p className="error-banner">Não foi possível iniciar o cenário 3D. Use um navegador com WebGL e aceleração de hardware ativados.</p>}
            {error && <p className="error-banner" role="alert">{error}</p>}
          </div>
          <div className="title-progress" aria-label={`${discoveries.length} de 5 presentes encontrados`}>
            {CHEST_IDS.map((id) => (
              <span key={id} className={`title-gem${foundIds.has(id) ? " is-found" : ""}`} title={foundIds.has(id) ? "Presente encontrado" : "Ainda escondido"}>
                {foundIds.has(id) ? <Sparkles size={14} /> : <Leaf size={13} />}
              </span>
            ))}
          </div>
        </div>
      </section>
      {!ready && !renderError && <div className="loading-scene"><LoaderCircle className="spin" size={22} /><span>O bosque está despertando…</span></div>}
      <footer className="title-footer">
        <span><Heart size={10} /> Feito com carinho, para você.</span>
        <a href="/admin" aria-label="Painel do guardião">O guardião <ChevronRight size={9} style={{ display: "inline" }} /></a>
      </footer>
    </>}
    {started && <div className="game-hud">
      <div className="hud-top">
        <div className="hud-region">
          <FairyMark size={28} />
          <div><small>Bosque dos Desejos</small><p>{region}</p></div>
        </div>
        <div className="hud-actions">
          <button className="hud-button" onClick={() => openPanel("journal")}><BookOpen size={16} /><span>Diário</span><kbd>J</kbd></button>
          <button className="hud-button" onClick={toggleSound} aria-label={sound ? "Desativar som" : "Ativar som"}><SoundIcon size={16} /><kbd>M</kbd></button>
          <button className="hud-button" onClick={() => openPanel("pause")} aria-label="Pausar jogo"><Pause size={16} /></button>
        </div>
      </div>
      <span className="crosshair" />
      {nearChest && !nearObject && !panel && !gift && !saving && <div className="near-chest"><span>O bosque guardou algo para você.</span><button className="interact-button" onClick={() => engine.current?.interact()}><kbd>E</kbd> Abrir o baú <Gift size={15} /></button></div>}
      {nearObject && !panel && !gift && !saving && <div className="near-chest"><span>{nearObject.message}</span><button className="interact-button" onClick={() => engine.current?.interact()}><kbd>E</kbd>{nearObject.label}</button></div>}
      {nearCampfire && !nearObject && !nearChest && !panel && !gift && !saving && <div className="near-chest"><span>{nearCampfire.message}</span><button className="interact-button" onClick={() => engine.current?.interact()}><kbd>E</kbd>{nearCampfire.label}</button></div>}
      <div className="hotbar" role="toolbar" aria-label="Mochila">{Array.from({ length: 9 }, (_, index) => {
        const id = held[index];
        const used = (id === "rope" && actions.includes("bridge")) || (id === "moonstone" && actions.includes("seal"));
        return <button type="button" key={index} className={`hotbar-slot${selectedSlot === index ? " is-selected" : ""}${id ? "" : " is-empty"}${used ? " is-used" : ""}`} onClick={() => selectSlot(index)} aria-pressed={selectedSlot === index} aria-label={id ? `${ITEM_NAMES[id]}${used ? ", utilizado" : ""}, tecla ${index + 1}` : `Espaço ${index + 1}`}><kbd>{index + 1}</kbd>{id ? <>{id === "axe" ? <Axe size={18} strokeWidth={1.7} /> : <Gem size={15} />}<span>{ITEM_NAMES[id]}</span>{used ? <small>utilizado</small> : null}</> : null}</button>;
      })}</div>
      <div className="hud-bottom">
        <div className="hud-hint">
          <div><kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> caminhar &nbsp; · &nbsp; arrastar para olhar</div>
          <div><kbd>Shift</kbd> correr &nbsp; <kbd>Esc</kbd> respirar um pouco</div>
        </div>
        <button className="hud-button inventory-button" onClick={() => openPanel("journal")}><BookOpen size={15} /> Mochila {held.length || ""}</button>
      </div>
    </div>}
    {panel === "controls" && <Dialog label="Como explorar o bosque" onClose={closePanel}>
      <div className="dialog-eyebrow"><Leaf size={12} /> Siga sua curiosidade</div>
      <h2>Sem pressa.<br />Sem caminho errado.</h2>
      <VineFrame className="dialog-vine" />
      <p className="dialog-description">Explore em primeira pessoa. Observe os caminhos, recolha objetos e encontre um jeito de passar pelos obstáculos. O bosque guarda suas próprias surpresas.</p>
      <div className="controls-list">
        <div className="control-row"><span>Caminhar pelo bosque</span><span className="control-keys">{"WASD".split("").map((k) => <kbd key={k}>{k}</kbd>)}</span></div>
        <div className="control-row"><span>Olhar ao redor</span><span className="control-keys"><Mouse size={15} /> Clique e arraste</span></div>
        <div className="control-row"><span>Recolher · examinar · abrir</span><span className="control-keys"><kbd>E</kbd></span></div>
        <div className="control-row"><span>Escolher um item da mochila</span><span className="control-keys"><kbd>1</kbd>–<kbd>9</kbd></span></div>
        <div className="control-row"><span>Som da floresta</span><span className="control-keys"><kbd>M</kbd></span></div>
        <div className="control-row"><span>Correr · diário · pausar</span><span className="control-keys"><kbd>Shift</kbd><kbd>J</kbd><kbd>Esc</kbd></span></div>
      </div>
      <p className="dialog-description">As fogueiras guardam o lugar: cair na água ou nas raízes te acorda na última. Os presentes encontrados ficam salvos neste navegador e registrados com o guardião.</p>
      <button className="game-button dialog-action" onClick={started ? resume : begin} disabled={!ready || connecting}>
        {connecting ? <LoaderCircle size={15} className="spin" /> : <FairyMark size={15} />}
        {started ? "Continuar explorando" : sessionReady ? "Que a aventura comece" : "Preparar minha aventura"}
        <ArrowRight size={15} />
      </button>
      {error && <p className="error-banner" role="alert">{error}</p>}
    </Dialog>}
    {panel === "journal" && <Dialog label="Sua mochila e diário" className="journal-dialog" onClose={closePanel}>
      <div className="journal-heading">
        <div className="journal-mark"><BookOpen size={23} strokeWidth={1.3} /></div>
        <div>
          <div className="dialog-eyebrow" style={{ justifyContent: "flex-start" }}>O que veio pelo caminho</div>
          <h2>Sua mochila, Júlia.</h2>
        </div>
        <div className="journal-count">{discoveries.length}<small>/5</small></div>
      </div>
      <div className="inventory-list">
        {actions.filter(id => id in ITEM_NAMES).length
          ? actions.filter(id => id in ITEM_NAMES).map(id => (
            <span className="inventory-item" key={id}>
              {id === "axe" ? <Axe size={15} /> : <Gem size={15} />}
              {ITEM_NAMES[id]}
              {(id === "rope" && actions.includes("bridge")) || (id === "moonstone" && actions.includes("seal")) ? <small>utilizado</small> : null}
            </span>
          ))
          : <p className="dialog-description">Sua mochila está vazia. Objetos encontrados na floresta podem abrir novos caminhos.</p>}
      </div>
      {actions.includes("bridge") && <p className="journal-bottom"><Check size={12} />Uma ponte feita de árvore e coragem.</p>}
      {actions.includes("seal") && <p className="journal-bottom"><Check size={12} />O altar da lua despertou.</p>}
      {discoveries.map(discovery => (
        <div className="journal-row is-found" key={discovery.chestId}>
          <span className="journal-rune"><Gift size={21} strokeWidth={1.25} /></span>
          <div className="journal-text">
            <h3>{discovery.title}</h3>
            <p>{discovery.description}</p>
            <small>Encontrado em {new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "long", timeZone: "America/Sao_Paulo" }).format(new Date(discovery.discoveredAt))}</small>
          </div>
        </div>
      ))}
      <p className="journal-bottom"><Heart size={11} />Só o que você encontra vira história aqui.</p>
      {started && <button className="game-button dialog-action" onClick={resume}>Continuar explorando<ArrowRight size={15} /></button>}
    </Dialog>}
    {panel === "pause" && <Dialog label="Jogo pausado" onClose={resume}>
      <div className="dialog-eyebrow"><Wind size={13} /> Um respiro no caminho</div>
      <h2>O bosque espera.</h2>
      <VineFrame className="dialog-vine" />
      <p className="dialog-description">
        {discoveries.length ? `${discoveries.length} descoberta${discoveries.length > 1 ? "s" : ""} guardada${discoveries.length > 1 ? "s" : ""} no diário.` : "Seu caminho ainda está sendo escrito."}
        <br />Sua próxima surpresa pode estar logo ali.
      </p>
      <div className="pause-options">
        <button className="game-button" onClick={resume}><Play size={15} />Continuar a aventura<ArrowRight size={15} /></button>
        <button className="secondary-button" onClick={() => { playUi("open"); setPanel("journal"); }}><BookOpen size={15} />Abrir meu diário</button>
        <div className="setting-row"><span>Som da floresta</span><button className="setting-toggle" onClick={toggleSound}>{sound ? "Ativado" : "Desativado"}</button></div>
        <div className="setting-row"><span>Qualidade do cenário</span><button className="setting-toggle" onClick={() => { const next = quality === "high" ? "low" : "high"; setQuality(next); engine.current?.setQuality(next); playUi("select"); }}>{quality === "high" ? "Alta" : "Leve"}</button></div>
        <button className="secondary-button" onClick={() => { engine.current?.teleportToStart(); resume(); }}><RotateCcw size={14} />Voltar à clareira inicial</button>
        <button className="pause-leave" onClick={leave}><ArrowLeft size={12} />Voltar ao início</button>
      </div>
    </Dialog>}
    {gift && <Dialog label="Você encontrou um presente" className="gift-dialog" onClose={() => { setGift(null); setPanel("pause"); }}>
      <div className="dialog-eyebrow"><FairyMark size={14} /> Um segredo agora é seu</div>
      <div className="gift-illustration"><Gift /></div>
      <h2>{gift.title}</h2>
      <p className="dialog-description">{gift.description}</p>
      <p className="gift-saved"><Check size={12} />Presente registrado no seu diário e com o guardião.</p>
      <button className="game-button dialog-action" onClick={resume}>Ainda há magia pelo caminho<ArrowRight size={15} /></button>
    </Dialog>}
    {notice && started && <div className="puzzle-notice" role="status"><Check size={15} />{notice}</div>}
    {saving && <div className="saving-overlay" role="status"><Sparkles size={25} className="spin" />Revelando seu presente…</div>}
    {error && started && <div className="game-error" role="alert"><span>{error}</span><button onClick={() => setError("")} aria-label="Fechar aviso"><X size={15} /></button></div>}
  </main>;
}
