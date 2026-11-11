# Bosque dos Desejos — para Júlia

Um labirinto de floresta em primeira pessoa para computador, com cinco baús de presentes e um painel privado para acompanhar as descobertas. A interface usa React e Three.js. A aplicação é Next.js, publica na Vercel, persiste no Turso com Drizzle e avisa cada presente novo pelo Resend.

## Como jogar

Entre na floresta, clique para capturar o mouse, use WASD ou as setas para caminhar e mova o mouse para olhar. A interface mostra a tecla de interação quando um baú está próximo. Esc libera o mouse. O som começa depois de uma interação e pode ser desligado na interface.

Os baús têm dificuldade crescente. O último fica no extremo mais distante do labirinto e só abre depois dos outros quatro. O mundo tem uma rota válida para todos os baús; os desvios tornam a busca mais longa. Os títulos dos presentes só são entregues pelo servidor depois da descoberta. A lista completa fica no módulo `lib/server/gifts.ts` e no painel privado `/admin`.

## Configuração necessária

1. Instale as dependências com `npm install`.
2. Copie `.env.example` para `.env.local`. Gere `SESSION_SECRET` aleatório de pelo menos 32 caracteres e escolha `ADMIN_PASSWORD` exclusivo de pelo menos 12 caracteres. Não há credenciais padrão.
3. Para testar no computador, deixe `TURSO_DATABASE_URL` vazio. O progresso fica em `.data/bosque.db`. Para usar o mesmo banco da Vercel, preencha a URL `libsql://` e o token do Turso.
4. Rode `npm run db:migrate` e depois `npm run dev`.

Na Vercel, cadastre as mesmas variáveis no projeto. `.env.local` não é publicado. O banco local e o banco Turso de produção são separados. As migrações rodam no primeiro acesso e também por `npm run db:migrate`.

`SESSION_SECRET` assina as sessões; alterá-lo invalida todos os cookies existentes. Guarde-o com segurança. `ADMIN_PASSWORD` protege `/admin`; a senha nunca é incluída no JavaScript público. As respostas mostram erro real de configuração/banco quando falta alguma dependência: não existe fallback que simule salvar no servidor.

## Como acompanhar as descobertas

Acesse `/admin` e entre com `ADMIN_PASSWORD`. O painel mostra cada pessoa/sessão, presentes encontrados, horários e status das notificações. As descobertas são gravadas no banco antes de aparecerem como salvas para a jogadora. Reabrir o mesmo baú não duplica o registro nem envia outro email.

Uma sessão anônima é identificada por cookie HttpOnly assinado, com validade de um ano. Voltar pelo mesmo navegador retoma os presentes encontrados. Limpar cookies, abrir uma janela anônima ou trocar de navegador cria uma pessoa/sessão separada; o painel mantém os registros anteriores. Não há autenticação pessoal ou sincronização de progresso entre aparelhos.

O painel apresenta as 500 descobertas e 200 sessões mais recentes, com totais calculados sobre todo o banco. As datas da API estão em UTC ISO 8601; a interface as apresenta no horário local. A sessão do administrador dura 12 horas e sair do painel revoga a sessão no banco.

## Email opcional com Resend

O painel funciona sem Resend. Para receber um aviso real quando Júlia encontrar um presente, configure as três variáveis no `.env.local` e, com os mesmos nomes, no projeto da Vercel:

- `RESEND_API_KEY`: chave privada criada em [resend.com/api-keys](https://resend.com/api-keys).
- `RESEND_FROM`: remetente autorizado, por exemplo `Bosque <presentes@seu-dominio.com>`.
- `NOTIFY_EMAIL`: endereço que receberá os avisos.

Sem as três variáveis, o status é `not_configured` e nenhum email é enviado. Quando configurado, cada nova descoberta tenta enviar um único aviso. A chave de idempotência usa o ID persistido da descoberta. Falha de email não apaga o presente: o painel mostra `failed`; não há reenvio automático. `pending` indica uma tentativa ainda em andamento ou interrompida. Verifique o domínio no Resend antes de enviar para um destinatário qualquer. Enquanto o domínio não estiver verificado, use `RESEND_FROM=Bosque <onboarding@resend.dev>` e coloque em `NOTIFY_EMAIL` o email da própria conta Resend. Nenhum email de teste é disparado na instalação.

## Publicar na Vercel

O `vercel.json` fixa o framework Next.js, porque o repositório ainda contém o `vite.config.ts` do starter antigo. As funções ficam em São Paulo (`gru1`).

1. Crie um banco no [Turso](https://turso.tech) e guarde a URL `libsql://` e o token.
2. Crie a API key do Resend e, se for avisar outro email, verifique o domínio do remetente.
3. Importe este diretório na Vercel. O build é `npm run build`.
4. Defina `SESSION_SECRET`, `ADMIN_PASSWORD`, `TURSO_DATABASE_URL` e `TURSO_AUTH_TOKEN`. Acrescente `RESEND_API_KEY`, `RESEND_FROM` e `NOTIFY_EMAIL` para ligar os avisos.
5. Publique. O primeiro acesso aplica as migrações em `drizzle/`.

`APP_ORIGIN` só é necessário se a origem vista pelo navegador for diferente da URL da requisição. Na Vercel isso normalmente fica vazio.

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

O Node.js precisa ser `>=22.13.0`. Os comandos são `npm run dev`, `npm run build`, `npm run start`, `npm run db:migrate` e `npm run db:generate`.

O diretório ainda carrega arquivos do starter Cloudflare (`worker/`, `vite.config.ts`, `scripts/`). A Vercel ignora esse caminho por causa do `vercel.json`.
