"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft, ArrowUpRight, Check, CircleAlert, Compass, Flower2, Gift,
  Leaf, LoaderCircle, LockKeyhole, LogOut, Mail, RefreshCw,
  ShieldCheck, Sparkles, TreePine, UsersRound,
} from "lucide-react";
import "./admin.css";

type Discovery = {
  id: string;
  playerId: string;
  playerName: string;
  chestId: string;
  title: string;
  description: string;
  discoveredAt: string;
  notificationStatus: "not_configured" | "sent" | "failed" | "pending";
};

type AdminData = {
  players: { id: string; name: string; createdAt: string; lastSeenAt: string; discoveryCount: number }[];
  discoveries: Discovery[];
  totals: {
    players: number;
    discoveries: number;
    completedPlayers: number;
    byChest: { chestId: string; title: string; count: number }[];
  };
};

const gifts = [
  { id: "ember", title: "Um jantar especial", detail: "Macarrão com camarão, alho e bacon", rarity: "Fácil", icon: Flower2 },
  { id: "feast", title: "Um novo sabor", detail: "Hump steak", rarity: "Incomum", icon: Leaf },
  { id: "wish", title: "Um desejo só seu", detail: "Até R$ 200 na loja escolhida", rarity: "Raro", icon: Gift },
  { id: "creation", title: "Para criar mundos", detail: "Bambu Lab A1 Combo · Black Friday ou Natal", rarity: "Lendário", icon: Sparkles },
  { id: "horizon", title: "Um novo horizonte", detail: "Viagem para Floripa · no próximo ano", rarity: "Quase impossível", icon: Compass },
];

const notifications = {
  sent: { label: "E-mail enviado", className: "sent" },
  pending: { label: "Envio pendente", className: "pending" },
  failed: { label: "Falha no envio", className: "failed" },
  not_configured: { label: "E-mail não configurado", className: "unconfigured" },
};

function formatDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Data indisponível" : date.toLocaleString("pt-BR", {
    timeZone: "America/Sao_Paulo", day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
  });
}

async function readResponse(response: Response) {
  return response.json().catch(() => ({ error: "Não foi possível ler a resposta do servidor." })) as Promise<AdminData & { error?: string; code?: string }>;
}

export default function AdminPage() {
  const [state, setState] = useState<"loading" | "login" | "ready" | "setup" | "error">("loading");
  const [data, setData] = useState<AdminData | null>(null);
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);
  const [filter, setFilter] = useState("all");
  const requestInFlight = useRef(false);

  const refresh = useCallback(async () => {
    if (requestInFlight.current) return;
    requestInFlight.current = true;
    setRefreshing(true);
    try {
      const response = await fetch("/api/admin", { cache: "no-store", credentials: "same-origin" });
      const result = await readResponse(response);
      if (response.status === 401) {
        setData(null);
        setState("login");
        setError("");
        return;
      }
      if (!response.ok) {
        if (result.code === "configuration_required") setState("setup");
        else setState((current) => current === "ready" ? "ready" : "error");
        setError(result.error || "Não foi possível carregar as descobertas. Tente novamente.");
        return;
      }
      setData(result as AdminData);
      setState("ready");
      setError("");
      setUpdatedAt(new Date());
    } catch {
      setError("Não foi possível conectar ao bosque. Confira sua conexão e tente novamente.");
      setState((current) => current === "ready" ? "ready" : "error");
    } finally {
      requestInFlight.current = false;
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (state !== "ready") return;
    const timer = window.setInterval(() => { void refresh(); }, 20_000);
    return () => window.clearInterval(timer);
  }, [refresh, state]);

  async function login(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!password || busy) return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/admin/login", {
        method: "POST", headers: { "Content-Type": "application/json" },
        credentials: "same-origin", body: JSON.stringify({ password }),
      });
      const result = await readResponse(response);
      if (!response.ok) {
        if (result.code === "configuration_required") setState("setup");
        setError(result.error || "Não foi possível entrar. Confira sua senha.");
        return;
      }
      setPassword("");
      await refresh();
    } catch {
      setError("Não foi possível conectar. Tente novamente em instantes.");
    } finally {
      setBusy(false);
    }
  }

  async function logout() {
    if (busy) return;
    setBusy(true);
    try {
      const response = await fetch("/api/admin/logout", { method: "POST", credentials: "same-origin" });
      if (!response.ok) throw new Error("logout_failed");
      setData(null);
      setState("login");
      setError("");
      setUpdatedAt(null);
    } catch {
      setError("Não foi possível encerrar a sessão. Tente novamente.");
    } finally {
      setBusy(false);
    }
  }

  const discoveries = useMemo(() => data?.discoveries
    .filter((item) => filter === "all" || item.chestId === filter)
    .slice().sort((a, b) => Date.parse(b.discoveredAt) - Date.parse(a.discoveredAt)) || [], [data, filter]);

  return (
    <main className="admin-page">
      <header className="admin-header">
        <a href="/" className="admin-brand" aria-label="Bosque dos Desejos — início">
          <span className="admin-brand-icon"><TreePine size={22} strokeWidth={1.5} /></span>
          <span>Bosque dos Desejos<small>UM MUNDO FEITO PARA JÚLIA</small></span>
        </a>
        <div className="admin-header-actions">
          <span className="admin-private"><ShieldCheck size={14} /> Área reservada</span>
          <a href="/" className="admin-back"><ArrowLeft size={15} /> Voltar ao bosque</a>
          {state === "ready" && <button className="admin-logout" onClick={logout} disabled={busy} aria-label="Sair da área administrativa"><LogOut size={17} /></button>}
        </div>
      </header>

      {state !== "ready" || !data ? (
        <section className="admin-access">
          <div className="admin-access-art" aria-hidden="true">
            <div className="admin-art-top"><Leaf size={22} strokeWidth={1} /><span>CADA DESCOBERTA, UMA MEMÓRIA</span></div>
            <div className="admin-botanical"><Flower2 size={220} strokeWidth={0.45} /><Sparkles size={42} strokeWidth={0.7} /></div>
            <p>Por trás de toda<br />magia, existe<br /><em>um cuidado.</em></p>
            <div className="admin-art-bottom"><span>BOSQUE DOS DESEJOS</span><span>✧</span><span>PARA JÚLIA</span></div>
          </div>
          <div className="admin-access-form">
            <span className="admin-eyebrow"><span /> O GUARDIÃO DO BOSQUE</span>
            {state === "loading" ? <div className="admin-access-loading" role="status"><LoaderCircle size={24} className="admin-spin" /><p>Abrindo o seu cantinho...</p></div> : state === "setup" ? (
              <>
                <h1>A magia começa<br />nos detalhes.</h1>
                <p className="admin-access-copy">Falta configurar o acesso seguro ao painel.</p>
                <div className="admin-setup"><LockKeyhole size={20} /><div><strong>Configuração do administrador</strong><p>Defina <code>ADMIN_PASSWORD</code> e <code>SESSION_SECRET</code> nas variáveis de ambiente do projeto. Reinicie a aplicação depois de salvar.</p></div></div>
                {error && <p className="admin-message" role="alert">{error}</p>}
                <button className="admin-primary" onClick={() => void refresh()} disabled={refreshing}>{refreshing ? <LoaderCircle size={16} className="admin-spin" /> : <RefreshCw size={16} />} Verificar configuração</button>
              </>
            ) : state === "error" ? (
              <>
                <h1>Uma pausa<br />no caminho.</h1>
                <p className="admin-access-copy">O painel não conseguiu carregar os registros.</p>
                <div className="admin-alert" role="alert"><CircleAlert size={18} /><span>{error}</span></div>
                <button className="admin-primary" onClick={() => void refresh()} disabled={refreshing}>{refreshing ? <LoaderCircle size={16} className="admin-spin" /> : <RefreshCw size={16} />} Tentar novamente</button>
              </>
            ) : (
              <>
                <h1>Acompanhe<br />cada <em>descoberta.</em></h1>
                <p className="admin-access-copy">Um cantinho só seu para saber quais presentes a Júlia encontrou pelo caminho.</p>
                <form onSubmit={login} className="admin-login-form">
                  <label htmlFor="admin-password">SUA SENHA DE ACESSO</label>
                  <div className="admin-password-field"><LockKeyhole size={17} /><input id="admin-password" name="password" type="password" required autoComplete="current-password" placeholder="Digite a senha do guardião" value={password} onChange={(event) => setPassword(event.target.value)} disabled={busy} aria-describedby={error ? "admin-login-error" : undefined} /></div>
                  {error && <p id="admin-login-error" className="admin-message" role="alert">{error}</p>}
                  <button type="submit" className="admin-primary" disabled={busy || !password}>{busy ? <LoaderCircle size={17} className="admin-spin" /> : <span>Entrar no meu cantinho</span>}{!busy && <ArrowUpRight size={18} />}</button>
                </form>
                <p className="admin-access-note"><ShieldCheck size={14} /> Acesso privado. As surpresas ficam entre nós.</p>
              </>
            )}
          </div>
        </section>
      ) : (
        <div className="admin-content">
          <section className="admin-heading">
            <div><span className="admin-eyebrow"><span /> O SEU CANTINHO</span><h1>As pequenas <em>grandes descobertas.</em></h1><p>O bosque guarda os presentes. Aqui, você acompanha a magia acontecendo.</p></div>
            <button className="admin-refresh" disabled={refreshing} onClick={() => void refresh()}><RefreshCw size={15} className={refreshing ? "admin-spin" : ""} />{refreshing ? "Atualizando" : "Atualizar"}</button>
          </section>

          {error && <div className="admin-alert" role="alert"><CircleAlert size={18} /><span>{error} Os registros abaixo são da última atualização.</span></div>}

          <section className="admin-stats" aria-label="Resumo do bosque">
            <div className="admin-stat"><span className="admin-stat-icon"><UsersRound size={22} strokeWidth={1.4} /></span><div><span>AVENTUREIROS NO BOSQUE</span><strong>{data.totals.players}</strong></div><p>{data.totals.players === 0 ? "À espera da primeira visita" : "Jornadas que já começaram"}</p></div>
            <div className="admin-stat"><span className="admin-stat-icon"><Gift size={22} strokeWidth={1.4} /></span><div><span>PRESENTES DESCOBERTOS</span><strong>{data.totals.discoveries}</strong></div><p>{data.totals.discoveries === 0 ? "As surpresas estão esperando" : "Encontros que viraram memórias"}</p></div>
            <div className="admin-stat"><span className="admin-stat-icon"><Sparkles size={22} strokeWidth={1.4} /></span><div><span>JORNADAS COMPLETAS</span><strong>{data.totals.completedPlayers}</strong></div><p>Todos os cinco segredos revelados</p></div>
          </section>

          <section className="admin-gifts-section" aria-labelledby="admin-gifts-title">
            <div className="admin-section-heading"><h2 id="admin-gifts-title">Cinco presentes. <em>Infinitas histórias.</em></h2><span>DO PRIMEIRO PASSO AO GRANDE DESAFIO</span></div>
            <div className="admin-gifts">
              {gifts.map((gift, index) => {
                const count = data.totals.byChest.find((item) => item.chestId === gift.id)?.count || 0;
                const Icon = gift.icon;
                return <article className={`admin-gift${count > 0 ? " admin-gift-found" : ""}`} key={gift.id}>
                  <div className="admin-gift-top"><span>0{index + 1}</span><span className="admin-gift-rarity">{gift.rarity}</span></div>
                  <div className={`admin-gift-icon admin-gift-icon-${gift.id}`}><Icon size={31} strokeWidth={1.1} /></div>
                  <h3>{gift.title}</h3><p>{gift.detail}</p>
                  <div className="admin-gift-status">{count > 0 ? <><Check size={13} /><span>{count} {count === 1 ? "descoberta" : "descobertas"}</span></> : <><LockKeyhole size={12} /><span>Ainda é um segredo</span></>}</div>
                </article>;
              })}
            </div>
          </section>

          <section className="admin-log" aria-labelledby="admin-log-title">
            <div className="admin-log-heading"><div><span className="admin-eyebrow">O DIÁRIO DO BOSQUE</span><h2 id="admin-log-title">Cada baú tem uma história.</h2></div><label className="admin-filter"><span className="admin-sr-only">Filtrar por presente</span><select value={filter} onChange={(event) => setFilter(event.target.value)}><option value="all">Todos os presentes</option>{gifts.map((gift) => <option value={gift.id} key={gift.id}>{gift.title}</option>)}</select></label></div>
            {discoveries.length > 0 ? <div className="admin-table-wrap"><table><thead><tr><th scope="col">AVENTUREIRO</th><th scope="col">PRESENTE ENCONTRADO</th><th scope="col">QUANDO ACONTECEU</th><th scope="col">NOTIFICAÇÃO</th></tr></thead><tbody>{discoveries.map((discovery) => {
              const notification = notifications[discovery.notificationStatus] || notifications.not_configured;
              return <tr key={discovery.id}><td><span className="admin-player"><span className="admin-avatar">{discovery.playerName.charAt(0).toLocaleUpperCase("pt-BR") || "J"}</span>{discovery.playerName}</span></td><td><strong>{discovery.title}</strong><small>{discovery.description}</small></td><td><time dateTime={discovery.discoveredAt}>{formatDate(discovery.discoveredAt)}</time></td><td><span className={`admin-notification admin-notification-${notification.className}`}><Mail size={13} />{notification.label}</span></td></tr>;
            })}</tbody></table></div> : <div className="admin-empty"><div><Gift size={31} strokeWidth={1.2} /></div><h3>{filter === "all" ? "O primeiro segredo ainda está guardado." : "Este segredo ainda está guardado."}</h3><p>Assim que um baú for encontrado, a descoberta aparecerá aqui.</p><span><span /> ACOMPANHANDO O BOSQUE</span></div>}
            <div className="admin-log-footer"><span><span className="admin-live-dot" /> Atualização automática a cada 20 segundos</span><span>{updatedAt ? `Última atualização às ${updatedAt.toLocaleTimeString("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit", second: "2-digit" })}` : "Aguardando atualização"} · Brasília</span></div>
          </section>
          <footer className="admin-footer"><span><TreePine size={15} strokeWidth={1.4} /> Feito de carinho. Guardado com cuidado.</span><a href="/">De volta à magia <ArrowUpRight size={13} /></a></footer>
        </div>
      )}
    </main>
  );
}
