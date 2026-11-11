"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { ArrowLeft, ArrowRight, BookOpen, Check, ChevronRight, Compass, Feather, Flower2, Gem, Gift, Headphones, Heart, Leaf, LoaderCircle, LockKeyhole, Maximize2, Mouse, Pause, Play, RotateCcw, Sparkles, Trees, Volume2, VolumeX, Wind, X } from "lucide-react";
import type { ForestController } from "@/components/forest/engine";
import { CHEST_IDS, type ChestId } from "@/lib/maze";

type Discovery = { chestId: ChestId; title: string; description: string; discoveredAt: string };
type Panel = "controls" | "journal" | "pause" | null;
const chapters = [
  { title: "Primeiro encanto", hint: "Onde o bosque começa, uma pequena luz espera por você.", rarity: "Um começo gentil", icon: Leaf },
  { title: "Entre as folhas", hint: "Nem todo caminho sem saída termina sem uma surpresa.", rarity: "Um pouco além", icon: Flower2 },
  { title: "Um desejo seu", hint: "As borboletas conhecem caminhos que os olhos deixam passar.", rarity: "Para os curiosos", icon: Feather },
  { title: "Pura imaginação", hint: "Há sonhos guardados onde a floresta fica mais silenciosa.", rarity: "Raro de encontrar", icon: Gem },
  { title: "Além do horizonte", hint: "Quatro encantos abrem o caminho para o último segredo. Vá além.", rarity: "Quase uma lenda", icon: Sparkles },
];

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
  return <div className="dialog-scrim" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><div ref={dialog} className={`forest-dialog ${className}`} role="dialog" aria-modal="true" aria-label={label}><button className="dialog-close" aria-label="Fechar" onClick={onClose}><X size={15} /></button>{children}</div></div>;
}

export default function ForestGame() {
  const container = useRef<HTMLDivElement>(null);
  const engine = useRef<ForestController | null>(null);
  const claimRef = useRef<(id: ChestId) => void>(() => {});
  const busyRef = useRef(false);
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

  useEffect(() => {
    let disposed = false;
    import("@/components/forest/engine").then(({ createForest }) => {
      if (disposed || !container.current) return;
      engine.current = createForest(container.current, {
        onReady: () => setReady(true), onNearChest: setNearChest, onRegion: setRegion,
        onInteract: (id) => claimRef.current(id),
        onPause: () => { if (hasStartedRef.current && !busyRef.current) setPanel((current) => current ?? "pause"); },
      });
      engine.current.setCollected(collectedRef.current.map((d) => d.chestId));
    }).catch(() => { if (!disposed) setRenderError(true); });
    api<{ discoveries: Discovery[]; playerId: string | null }>("/api/game").then((data) => {
      if (disposed) return;
      setDiscoveries(data.discoveries); collectedRef.current = data.discoveries;
      engine.current?.setCollected(data.discoveries.map((d) => d.chestId));
      setSessionReady(!!data.playerId);
    }).catch(() => { /* Entry retries the server and presents any remaining failure. */ });
    return () => { disposed = true; engine.current?.destroy(); engine.current = null; };
  }, []);

  const resume = useCallback(() => {
    setPanel(null); setGift(null); setError("");
    engine.current?.setPlaying(true);
  }, []);
  const closePanel = useCallback(() => {
    setPanel(null);
    if (hasStartedRef.current) setPanel("pause");
  }, []);
  const openPanel = (next: Panel) => { engine.current?.setPlaying(false); setPanel(next); };

  useEffect(() => {
    const key = (event: KeyboardEvent) => {
      if (event.code === "KeyJ" && started && !gift && !saving && !event.repeat) {
        engine.current?.setPlaying(false); setPanel((current) => current === "journal" ? "pause" : "journal");
      }
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [started, gift, saving]);

  const enter = async () => {
    if (!ready || connecting) return;
    if (!sessionReady) {
      setConnecting(true); setError("");
      try {
        const result = await api<{ discoveries: Discovery[]; playerId: string }>("/api/game", { name: "Júlia" });
        setDiscoveries(result.discoveries); collectedRef.current = result.discoveries;
        engine.current?.setCollected(result.discoveries.map((d) => d.chestId));
        setSessionReady(true); setPanel("controls");
      } catch (err) { setError(err instanceof Error ? err.message : "Não foi possível entrar no bosque."); }
      finally { setConnecting(false); }
    } else setPanel("controls");
  };

  const begin = () => {
    if (!sessionReady) { void enter(); return; }
    hasStartedRef.current = true; setStarted(true); setPanel(null); setError("");
    engine.current?.setSound(sound);
    engine.current?.setPlaying(true);
  };

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

  const toggleSound = () => { const next = !sound; setSound(next); engine.current?.setSound(next); };
  const found = (id: string) => discoveries.some((d) => d.chestId === id);
  const SoundIcon = sound ? Volume2 : VolumeX;
  const leave = () => { engine.current?.setPlaying(false); hasStartedRef.current = false; setStarted(false); setPanel(null); setGift(null); };

  return <main className="forest-app">
    <div ref={container} className={`forest-stage ${started ? "playing" : ""}`} />
    {renderError && <div className="fallback-art"><Trees /></div>}
    {!started && <>
      <div className="landing-veil" />
      <header className="site-header">
        <a href="/" className="brand" aria-label="Bosque dos Desejos, início"><span className="brand-emblem"><Sparkles strokeWidth={1.2} /></span><span>BOSQUE<br />DOS DESEJOS</span></a>
        <nav className="site-nav" aria-label="Navegação principal"><button className="nav-link active" onClick={() => setPanel(null)}>A floresta</button><button className="nav-link" onClick={() => openPanel("journal")}>Seu diário</button><button className="nav-link" onClick={() => openPanel("controls")}>Como jogar</button><button className="sound-button" onClick={toggleSound} aria-label={sound ? "Desativar som ambiente" : "Ativar som ambiente"}><SoundIcon size={14} /><span>Som {sound ? "ativado" : "desativado"}</span></button></nav>
      </header>
      <section className="hero-content">
        <div className="eyebrow"><Sparkles size={12} /> UMA AVENTURA FEITA PARA JÚLIA</div>
        <h1>Se perder também<br />é um jeito de<br /><em>se encontrar.</em></h1>
        <p className="hero-copy">Entre as folhas, a luz e um pouquinho de magia, cinco presentes esperam por você.<br />Siga sua curiosidade. O bosque é seu.</p>
        <button className="primary-button start-button" onClick={enter} disabled={!ready || connecting || renderError}>{connecting ? <LoaderCircle size={16} className="spin" /> : <Compass size={16} />}<span>{connecting ? "Abrindo o caminho…" : sessionReady ? "Voltar ao bosque" : "Entrar no bosque"}</span><ArrowRight size={16} /></button>
        <p className="headphone-note"><Headphones size={12} /> Com fones, a magia fica ainda melhor.</p>
        <p className="mobile-message">Esta aventura foi feita para computador. Abra com um teclado e mouse para explorar a floresta.</p>
        {renderError && <p className="error-banner">Não foi possível iniciar o cenário 3D. Use um navegador com WebGL e aceleração de hardware ativados.</p>}
        {error && <p className="error-banner" role="alert">{error}</p>}
      </section>
      <div className="hero-side-note"><Sparkles size={22} strokeWidth={1} /><span>Um lugar fora do tempo.<br />Um carinho em cada caminho.</span></div>
      {!ready && !renderError && <div className="loading-scene"><LoaderCircle className="spin" size={23} /><span>O bosque está despertando…</span></div>}
      <div className="scene-label"><span>01</span><i className="fine-rule" /><span>Clareira dos começos</span></div>
      <section className="gifts-strip" aria-label="Os cinco segredos"><div className="gifts-intro"><span className="eyebrow">PEQUENAS GRANDES DESCOBERTAS</span><p>Cinco segredos. Só seus.</p></div>{chapters.map((chapter, i) => { const Icon = chapter.icon; return <button key={chapter.title} className="secret-stop" onClick={() => openPanel("journal")}><span className={`secret-icon ${found(CHEST_IDS[i]) ? "found" : ""}`}><Icon size={18} strokeWidth={1.2} /></span><span><strong>{chapter.title}</strong><small>{found(CHEST_IDS[i]) ? "Encanto encontrado" : chapter.rarity}</small></span></button>; })}</section>
      <footer className="landing-footer"><span><Heart size={10} /> Feito com carinho, para você.</span><span>Vá com calma. A beleza está no caminho.</span><a href="/admin" aria-label="Painel do guardião">O guardião <ChevronRight size={9} style={{ display: "inline" }} /></a></footer>
    </>}
    {started && <div className="game-hud"><div className="hud-top"><div className="hud-region"><Compass size={31} strokeWidth={1} /><div><small>Bosque dos Desejos</small><p>{region}</p></div></div><div className="hud-actions"><button className="hud-button" onClick={() => openPanel("journal")}><BookOpen size={16} /><span>Seu diário</span><kbd>J</kbd></button><button className="hud-button" onClick={toggleSound} aria-label={sound ? "Desativar som" : "Ativar som"}><SoundIcon size={16} /></button><button className="hud-button" onClick={() => openPanel("pause")} aria-label="Pausar jogo"><Pause size={16} /></button></div></div><span className="crosshair" />
      {nearChest && !panel && !gift && !saving && <div className="near-chest"><span>O bosque guardou algo para você.</span><button className="interact-button" onClick={() => engine.current?.interact()}><kbd>E</kbd> Abrir o baú <Gift size={15} /></button></div>}
      <div className="hud-bottom"><div className="hud-hint"><div><kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> caminhar &nbsp; · &nbsp; mouse para olhar</div><div><kbd>Shift</kbd> correr &nbsp; <kbd>Esc</kbd> respirar um pouco</div></div><div className="hud-gems" aria-label={`${discoveries.length} de 5 presentes encontrados`}>{CHEST_IDS.map((id) => <Gem size={15} key={id} className={found(id) ? "found" : ""} strokeWidth={1.4} />)}</div></div>
    </div>}
    {panel === "controls" && <Dialog label="Como explorar o bosque" onClose={closePanel}><div className="eyebrow dialog-eyebrow"><Leaf size={12} /> SIGA SUA CURIOSIDADE</div><h2>Sem pressa.<br />Sem caminho errado.</h2><p className="dialog-description">Explore em primeira pessoa. Procure o brilho dos baús entre os caminhos e descubra o que a floresta guardou para você.</p><div className="controls-list"><div className="control-row"><span>Caminhar pelo bosque</span><span className="control-keys">{"WASD".split("").map((k) => <kbd key={k}>{k}</kbd>)}</span></div><div className="control-row"><span>Olhar ao redor</span><span className="control-keys"><Mouse size={15} /> Mova o mouse</span></div><div className="control-row"><span>Abrir um baú</span><span className="control-keys"><kbd>E</kbd></span></div><div className="control-row"><span>Correr · diário · pausar</span><span className="control-keys"><kbd>Shift</kbd><kbd>J</kbd><kbd>Esc</kbd></span></div></div><p className="dialog-description">Se o mouse não ficar preso ao jogo, clique e arraste para olhar. Os presentes encontrados ficam salvos neste navegador e registrados com o guardião.</p><button className="primary-button dialog-action" onClick={started ? resume : begin} disabled={!ready || connecting}>{connecting ? <LoaderCircle size={15} className="spin" /> : <Compass size={15} />}{started ? "Continuar explorando" : sessionReady ? "Que a aventura comece" : "Preparar minha aventura"}<ArrowRight size={15} /></button>{error && <p className="error-banner" role="alert">{error}</p>}</Dialog>}
    {panel === "journal" && <Dialog label="Seu diário de descobertas" className="journal-dialog" onClose={closePanel}><div className="journal-heading"><div className="journal-mark"><BookOpen size={23} strokeWidth={1.3} /></div><div><span className="eyebrow">AS MEMÓRIAS DO CAMINHO</span><h2>Seu diário, Júlia.</h2></div><div className="journal-count">{discoveries.length}<small> / 5</small></div></div>{chapters.map((chapter, i) => { const discovery = discoveries.find((d) => d.chestId === CHEST_IDS[i]); const Icon = chapter.icon; return <div className={`journal-row ${discovery ? "is-found" : ""}`} key={chapter.title}><span className="journal-rune"><Icon size={21} strokeWidth={1.25} /></span><div className="journal-text"><h3>{discovery ? discovery.title : chapter.title}</h3><p>{discovery ? discovery.description : chapter.hint}</p>{discovery && <small>Encontrado em {new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "long", timeZone: "America/Sao_Paulo" }).format(new Date(discovery.discoveredAt))}</small>}</div><span className="journal-lock">{discovery ? <Check size={12} /> : <LockKeyhole size={11} />}{discovery ? "Seu" : "Mistério"}</span></div>; })}<p className="journal-bottom"><Heart size={11} />{discoveries.length === 5 ? "Você encontrou todos os caminhos. E todos os carinhos." : "Cada descoberta é um carinho que sai do bosque com você."}</p>{started && <button className="primary-button dialog-action" onClick={resume}>Continuar explorando<ArrowRight size={15} /></button>}</Dialog>}
    {panel === "pause" && <Dialog label="Jogo pausado" onClose={resume}><div className="eyebrow dialog-eyebrow"><Wind size={13} /> UM RESPIRO NO CAMINHO</div><h2>O bosque espera.</h2><p className="dialog-description">{discoveries.length} de 5 encantos encontrados.<br />Sua próxima surpresa pode estar logo ali.</p><div className="pause-options"><button className="primary-button" onClick={resume}><Play size={15} />Continuar a aventura<ArrowRight size={15} /></button><button className="secondary-button" onClick={() => setPanel("journal")}><BookOpen size={15} />Abrir meu diário</button><div className="setting-row"><span>Som da floresta</span><button className="setting-toggle" onClick={toggleSound}>{sound ? "Ativado" : "Desativado"}</button></div><div className="setting-row"><span>Qualidade do cenário</span><button className="setting-toggle" onClick={() => { const next = quality === "high" ? "low" : "high"; setQuality(next); engine.current?.setQuality(next); }}>{quality === "high" ? "Alta" : "Leve"}</button></div><button className="secondary-button" onClick={() => { engine.current?.teleportToStart(); resume(); }}><RotateCcw size={14} />Voltar à clareira inicial</button><button className="nav-link" onClick={leave}><ArrowLeft size={12} style={{ display: "inline", marginRight: 7 }} />Voltar ao início</button></div></Dialog>}
    {gift && <Dialog label="Você encontrou um presente" className="gift-dialog" onClose={() => { setGift(null); setPanel("pause"); }}><div className="eyebrow dialog-eyebrow"><Sparkles size={12} /> UM SEGREDO AGORA É SEU</div><div className="gift-illustration"><Gift /></div><h2>{gift.title}</h2><p className="dialog-description">{gift.description}</p><p className="gift-saved"><Check size={12} />Presente registrado no seu diário e com o guardião.</p><button className="primary-button dialog-action" onClick={resume}>Ainda há magia pelo caminho<ArrowRight size={15} /></button></Dialog>}
    {saving && <div className="saving-overlay" role="status"><Sparkles size={25} className="spin" />Revelando seu presente…</div>}
    {error && started && <div className="game-error" role="alert"><span>{error}</span><button onClick={() => setError("")} aria-label="Fechar aviso"><X size={15} /></button></div>}
  </main>;
}
