# Bosque dos Desejos — para Júlia

Um labirinto de floresta em primeira pessoa para computador, com cinco baús de presentes e um painel privado para acompanhar as descobertas. A interface usa React e Three.js; a aplicação usa o roteamento do Next.js através de Vinext e roda em um Worker Cloudflare. A persistência usa Cloudflare D1 e Drizzle. Não exige Turso, Neon ou Vercel.

## Como jogar

Entre na floresta, clique para capturar o mouse, use WASD ou as setas para caminhar e mova o mouse para olhar. A interface mostra a tecla de interação quando um baú está próximo. Esc libera o mouse. O som começa depois de uma interação e pode ser desligado na interface.

Os baús têm dificuldade crescente. O último fica no extremo mais distante do labirinto e só abre depois dos outros quatro. O mundo tem uma rota válida para todos os baús; os desvios tornam a busca mais longa. Os títulos dos presentes só são entregues pelo servidor depois da descoberta. A lista completa fica no módulo `lib/server/gifts.ts` e no painel privado `/admin`.

## Configuração necessária

1. Instale as dependências pelo fluxo Sites documentado abaixo (ou `npm run install:ci`).
2. Copie `.env.example` para `.dev.vars`. Gere `SESSION_SECRET` aleatório de pelo menos 32 caracteres e escolha `ADMIN_PASSWORD` exclusivo de pelo menos 12 caracteres. Não há credenciais padrão.
3. Mantenha `.openai/hosting.json` com `"d1": "DB"`.
4. Rode `npm run build` e aplique a migração inicial no D1 local, conforme a seção de migrações abaixo.
5. Rode `npm run dev` para desenvolvimento ou `npm start` para visualizar o build.

No ambiente publicado, configure os mesmos segredos como variáveis privadas de ambiente da hospedagem. O arquivo `.dev.vars` não é publicado. O fluxo Sites provisiona o binding D1 e aplica as migrações ao publicar. O armazenamento local do preview e o banco publicado são separados. Não prometa que o preview estará disponível fora do computador antes de publicar.

`SESSION_SECRET` assina as sessões; alterá-lo invalida todos os cookies existentes. Guarde-o com segurança. `ADMIN_PASSWORD` protege `/admin`; a senha nunca é incluída no JavaScript público. As respostas mostram erro real de configuração/banco quando falta alguma dependência: não existe fallback que simule salvar no servidor.

## Como acompanhar as descobertas

Acesse `/admin` e entre com `ADMIN_PASSWORD`. O painel mostra cada pessoa/sessão, presentes encontrados, horários e status das notificações. As descobertas são gravadas no D1 antes de aparecerem como salvas para a jogadora. Reabrir o mesmo baú não duplica o registro nem envia outro email.

Uma sessão anônima é identificada por cookie HttpOnly assinado, com validade de um ano. Voltar pelo mesmo navegador retoma os presentes encontrados. Limpar cookies, abrir uma janela anônima ou trocar de navegador cria uma pessoa/sessão separada; o painel mantém os registros anteriores. Não há autenticação pessoal ou sincronização de progresso entre aparelhos.

O painel apresenta as 500 descobertas e 200 sessões mais recentes, com totais calculados sobre todo o banco. As datas da API estão em UTC ISO 8601; a interface as apresenta no horário local. A sessão do administrador dura 12 horas e sair do painel revoga a sessão no banco.

## Email opcional com Resend

O painel funciona sem Resend. Para receber um aviso real quando Júlia encontrar um presente, configure as três variáveis:

- `RESEND_API_KEY`: chave privada do Resend.
- `RESEND_FROM`: remetente autorizado, por exemplo `Bosque <presentes@seu-dominio.com>`.
- `NOTIFY_EMAIL`: endereço que receberá os avisos.

Sem as três variáveis, o status é `not_configured` e nenhum email é enviado. Quando configurado, cada nova descoberta tenta enviar um único aviso. A chave de idempotência usa o ID persistido da descoberta. Falha de email não apaga o presente: o painel mostra `failed`; não há reenvio automático. `pending` indica uma tentativa ainda em andamento ou interrompida. Configure um remetente/domínio verificado no Resend antes de utilizar um destinatário fora das restrições de teste da sua conta. Nenhum email de teste é disparado na instalação.

## API

Todas as respostas são JSON com `Cache-Control: no-store`. Requisições POST exigem `Origin` igual à origem pública da aplicação; as que enviam corpo também exigem `Content-Type: application/json`. Se um proxy substituir a origem da URL interna, configure `APP_ORIGIN` com a origem pública exata.

| Rota | Contrato |
| --- | --- |
| `GET /api/game` | `{ playerId: string \| null, discoveries: Discovery[], storage: "server" }` |
| `POST /api/game` | Corpo `{ name?: string }`, padrão Júlia. Cria ou retoma a sessão e retorna o mesmo formato do GET. |
| `POST /api/discover` | Corpo `{ chestId, position: { x, z } }`. Retorna `{ ...Discovery, discovery: Discovery, alreadyDiscovered, storage: "server" }`. |
| `POST /api/admin/login` | Corpo `{ password }`. Cria cookie de administrador e retorna `{ ok: true }`. |
| `GET /api/admin` | Sessão admin obrigatória. Retorna `{ players, discoveries, totals }`. |
| `POST /api/admin/logout` | Revoga a sessão atual e retorna `{ ok: true }`. |

`Discovery = { chestId, title, description, discoveredAt }`. O painel recebe também `id`, `playerId`, `playerName` e `notificationStatus` em cada descoberta. `players` contém `id`, `name`, `createdAt`, `lastSeenAt` e `discoveryCount`; `totals` contém `players`, `discoveries`, `completedPlayers` e `byChest: [{ chestId, title, count }]`.

Erros seguem `{ error, code }`: `401 authentication_required`/`invalid_password`, `403 invalid_origin`/`chest_locked`, `400 invalid_chest`/`too_far`/`invalid_body`, `429 rate_limited` (com `Retry-After`) e `503 configuration_required`/`database_unavailable`. Os IDs públicos são `ember`, `feast`, `wish`, `creation` e `horizon`.

O servidor confere a proximidade do baú nas coordenadas do labirinto compartilhado, a sessão e a unicidade de pessoa + baú. A posição é enviada pelo cliente: isso protege a experiência normal, mas não é um sistema antitrapaça contra alguém que altere requisições ou investigue o JavaScript. É uma surpresa pessoal, não um mecanismo de concessão de prêmios financeiros.

## Verificações do backend

```sh
node --experimental-strip-types --test lib/server/security.test.mjs lib/server/persistence.test.mjs
npx tsc --noEmit
npm run build
```

Os testes cobrem assinatura/adulteração/expiração de sessão, separação de papéis, senha, proteção de origem e unicidade/isolamento das descobertas no SQLite. Os testes de persistência usam o módulo `node:sqlite` disponível no Node.js 22.13+ e executam as migrações reais em memória. Nenhum teste envia email.

As seções abaixo documentam o runtime e o fluxo de publicação do starter Sites.

## Prerequisites

- Node.js `>=22.13.0`
- Portable: Windows, macOS, or Linux; no Bash required
- Managed Linux: managed Linux runtime with Bash, `flock`, `curl`, `sha256sum`, and GNU `timeout`
- Git and `tar` (including Windows `tar.exe`) are required for publishing; portable publication does not require Bash

## Sites Lifecycle

The Sites initializer copies the shared starter and selects managed-linux only when `SITES_MANAGED_LINUX_CONTAINER=1`; otherwise it selects portable. It saves the selection only in ignored `.sites-runtime/execution-profile.json`. Both profiles copy/configure first, then use the plugin's separate `install-dependencies.mjs` step to measure installation independently. Edit source under `app/` and follow the Sites skill for installation, preview, builds, and publishing.

Run `node <plugin-root>/scripts/configure-execution-profile.mjs` only when the profile is unknown for the current checkout and environment. Profile changes do not alter tracked source or require reinstalling otherwise-valid dependencies; restart an existing preview to use the new selection. Do not commit or upload `.sites-runtime/`.

This starter does not use `wrangler.jsonc`.

Publish archives outside the source checkout or under its ignored `outputs/` directory. Local `.env*`, `.dev.vars*`, TypeScript build state, and tool runtime directories are ignored; keep the hosting manifest, migrations, and authored scripts in source control.

`install:ci` runs `npm ci` once against the shared lockfile, disables parent-workspace discovery, and includes required dev/optional dependencies despite production/omit settings. Sharp defaults to prebuilt binaries unless explicitly configured otherwise. Do not overlap installers.

- **Portable:** Preserve host HOME, npm cache, registry, proxy, temporary paths, retry/concurrency settings, and lifecycle-script policy. Use `--prefer-offline --no-audit --no-fund`.
- **Managed Linux:** Use the existing project-local HOME/cache/tmp setup and Linux install lock, tarball preflight, and timeout. Restore the image-seeded npm cache only when its lockfile hash matches; retain network fallback. Builds keep their existing timeout. These helpers are not invoked by the portable profile.

`scripts/sites-env.mjs` preserves the caller's HOME, npm cache, proxy, XDG, and temporary-directory configuration while defaulting Wrangler and Miniflare state to the checkout. If npm reports an unwritable cache, select a writable path with `npm_config_cache` for that install. The `dev` and `start` scripts also keep Wrangler logs inside the checkout. Generated `.sites-runtime/` and `.wrangler/` directories are disposable and ignored by Git.

On portable, `npm run dev` uses `vinext dev` with HMR, starting at port 5173. Vinext records the running server in ignored `.vinext/` state, rejects an ordinary duplicate launch, and recovers stale state after a stopped process; exactly simultaneous starts can race. Pass `--port <port>` or `--hostname <host>` after `npm run dev --` when needed; keep portable previews on loopback.

For managed Linux browser QA, follow the Sites skill's managed preview reference. The daemon runs the project's Vite dev script with `--host 0.0.0.0 --port 4173 --strictPort`; use the CLI's returned URL. The ignored local profile survives the daemon's cleared environment.

The portable profile simulates ChatGPT sign-in only for loopback development requests. Visit `/signin-with-chatgpt?return_to=/` to sign in as `local_seedy` (`seedy@sites.test`, display name `Seedy`) and `/signout-with-chatgpt?return_to=/` to sign out. The development cookie preserves that identity across server restarts. Mock auth is disabled in the managed-linux profile and is not included in production builds; hosted authentication remains dispatch-owned.

The Worker uses `vinext/server/fetch-handler`, including Vinext's config-aware image handling. After building, `npm start` runs that Worker locally through Wrangler on `127.0.0.1`, sharing `.wrangler/state` with dev preview and local D1 migrations; it does not deploy the site or simulate sign-in. Use the URL printed by the server. Pass `npm start -- --port <port>` to select a different built-preview port.

Local previews use Miniflare's placeholder `Request.cf` metadata without a network lookup. Set `CLOUDFLARE_CF_FETCH_ENABLED=true` to opt into fetching preview metadata; this setting does not change hosted request metadata.

Local tool usage metrics are disabled by default. Set `WRANGLER_SEND_METRICS=true` to opt in.

## Included Shape

- edit site code under `app/`
- `app/chatgpt-auth.ts` provides optional dispatch-owned ChatGPT sign-in helpers
- `.openai/hosting.json` declares optional Sites D1 and R2 bindings
- `vite.config.ts` simulates declared bindings for local development
- `worker/index.ts` is the production Worker entrypoint and preserves request-scoped connector bindings
- `scripts/vite/` contains the maintained Vite integrations and the vendored Sites plugin license
- `scripts/connector-preview/` contains the local connector preview Worker and session helpers
- the remaining `scripts/` files select execution profiles and run installation, development, and builds; the plugin's helpers orchestrate the Sites lifecycle
- `dist/` contains generated deployment output; `.vinext/`, `.wrangler/`, and `.sites-runtime/` contain ignored local tool state
- `db/index.ts` reads the D1 binding from the Cloudflare Worker environment
- `db/schema.ts` defines players, sessions, discoveries and persisted rate limits
- `@cloudflare/workers-types` provides Worker types; `cloudflare-env.d.ts` declares optional `DB`/`BUCKET` bindings—update these declarations if binding names change
- `examples/d1/` contains an optional D1 example surface
- `drizzle.config.ts` supports local migration generation when needed

## Workspace Auth Headers

Signed-in visitors receive both `oai-authenticated-user-id` and `oai-authenticated-user-email`. Private Sites require every visitor to sign in; public Sites may also have anonymous visitors, for whom neither header is present.

The user ID is stable for the same user on the same Site and different across Sites. Use it as the durable user key; use email and name for display or contact purposes.

SIWC-authenticated workspace sites may also receive `oai-authenticated-user-full-name` when the user's SIWC profile has a non-empty `name` claim. The full-name value is percent-encoded UTF-8 and is accompanied by `oai-authenticated-user-full-name-encoding: percent-encoded-utf-8`.

Treat the full name as optional and fall back to email when it is absent:

```tsx
import { headers } from "next/headers";

export default async function Home() {
  const requestHeaders = await headers();
  const userId = requestHeaders.get("oai-authenticated-user-id");
  const email = requestHeaders.get("oai-authenticated-user-email");
  const encodedFullName = requestHeaders.get("oai-authenticated-user-full-name");
  const fullName =
    encodedFullName &&
    requestHeaders.get("oai-authenticated-user-full-name-encoding") ===
      "percent-encoded-utf-8"
      ? decodeURIComponent(encodedFullName)
      : null;

  const displayName = fullName ?? email;
  // ...
}
```

## Optional Dispatch-Owned ChatGPT Sign-In

Import the ready-to-use helpers from `app/chatgpt-auth.ts` when the site needs optional or required ChatGPT sign-in:

- Use `getChatGPTUser()` for optional signed-in UI.
- Use the returned `userId` as the stable user key for user-owned records; do not use email as a durable identifier.
- Use `requireChatGPTUser(returnTo)` for server-rendered pages that should send anonymous visitors through Sign in with ChatGPT.
- In a Server Component, start sign-in with `<a href={chatGPTSignInPath(returnTo)} target="_top">`. The auth helper module is server-only; do not import it into a Client Component.
- Do not use `fetch`, XHR, a client-side router, or a framework link that can prefetch the sign-in route. SIWC must start as a top-level navigation.
- Never request the AuthAPI authorization endpoint directly. The dispatch-owned `/signin-with-chatgpt` route must start the SIWC flow.
- Use `chatGPTSignOutPath(returnTo)` for browser sign-out links or actions.
- Pass a same-origin relative `returnTo` path for the destination after sign-in or sign-out. The helper validates and safely encodes it.
- Mark protected pages with `export const dynamic = "force-dynamic"` because they depend on per-request identity headers.

Dispatch owns `/signin-with-chatgpt`, `/signout-with-chatgpt`, `/callback`, the OAuth cookies, and identity header injection. Do not implement app routes for those reserved paths. Routes that do not import and call the helper remain anonymous-compatible.

SIWC establishes identity only; it does not prove workspace membership. Use the Sites hosting platform's access policy controls for workspace-wide restrictions, or enforce explicit server-side membership or allowlist checks.

Use SIWC for account pages, user-specific dashboards, saved records, and write actions tied to the current ChatGPT user. Leave public content anonymous.

## Local D1 migrations

For a D1-backed local preview, generate SQL with `npm run db:generate`. Build once through the Sites skill's build entrypoint (or `npm run build` for standalone use) to generate `dist/server/wrangler.json`, rebuilding if bindings change. From the project root, apply each pending migration in order:

```sh
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0000_true_odin.sql
```

Replace the filename with the pending migration and `DB` with your D1 binding name if different. Use `.wrangler/state`, not `.wrangler/state/v3`; Wrangler adds the versioned directories. Do not replay migrations already applied locally. This updates only the preview database; publishing applies production migrations separately.

## Diagnostic Commands

- `npm run install:ci`: perform the one locked dependency install
- `npm run dev`: start the Vite/Vinext development server
- `npm run build`: build the deployable Sites artifact
- `npm run start`: preview the built Worker locally with D1/R2 support
- `npm run db:generate`: generate Drizzle migrations after schema changes

When using the Sites plugin, follow its skill instructions for installation, builds, and publishing. These npm commands remain available for standalone use.

The portable build runs Vinext directly without a host `timeout` command. The managed-linux build uses `scripts/build-verified.sh` and its existing `SITES_BUILD_TIMEOUT` setting.

## Learn More

- [vinext Documentation](https://github.com/cloudflare/vinext)
- [Drizzle D1 Guide](https://orm.drizzle.team/docs/get-started/d1-new)
