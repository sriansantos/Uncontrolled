# Uncontrollader — Finanças Pessoais

Aplicativo web local para controle de gastos e organização financeira pessoal, com o modelo de
orçamento da planilha **Primo Pobre 2026**: receitas por fonte, despesas **essenciais × não
essenciais**, orçado vs. realizado, sobra do mês e reserva de emergência (6 × essenciais).

Construído em **Next.js 16 + TypeScript + Tailwind + shadcn/ui + Prisma + SQLite**, todo em
pt-BR com valores em R$. A arquitetura é full-stack com API REST embutida — a mesma API que,
no futuro, receberá a integração com WhatsApp.

## Como rodar

Pré-requisito: Node.js 18+ (testado com Node 24).

```bash
npm install          # dependências
npx prisma migrate dev   # cria o banco dev.db (SQLite)
npm run db:seed      # categorias padrão da planilha (idempotente)
npm run dev          # http://localhost:3000
```

Para ver o dashboard populado com dados fictícios do mês corrente:

```bash
npm run db:seed:demo
```

> Os dados demo podem ser removidos em Lançamentos/Recorrências, ou apague o arquivo
> `dev.db` e rode `npx prisma migrate dev && npm run db:seed` para recomeçar limpo.

## Rodando com Turso (banco na nuvem)

O app suporta dois modos pelo `.env`, sem mudar código: **local** (SQLite no disco,
padrão) e **Turso** (SQLite na nuvem — sobrevive a restarts, deploys e formatação).

**Migração para o Turso, passo a passo:**

1. Crie uma conta em [app.turso.tech](https://app.turso.tech) (login com GitHub, sem cartão).
2. Crie um banco: **Create database** → nome (ex.: `uncontrollader`), location **São Paulo**.
3. No painel do banco, copie a **Database URL** (`libsql://…`) e gere um **token**
   (**Generate token**) — são os dois valores que o app precisa.
4. Edite o `.env` da raiz (use o `.env.example` de referência):
   ```env
   DATABASE_URL="libsql://uncontrollader-suaconta.turso.io"
   DATABASE_AUTH_TOKEN="eyJ..."
   ```
5. Leve seus dados atuais (cria as tabelas e copia tudo do `dev.db`):
   ```bash
   npm run db:sync
   ```
   Começando do zero em vez de migrar? Rode `npm run db:seed` (semeia o banco remoto).
6. `npm run dev` — o app agora lê e grava no Turso. O bot do WhatsApp e todas as telas
   funcionam igual.

**Notas:**
- Para voltar ao modo local, só reverter o `.env` para `file:./dev.db` — o arquivo continua lá.
- Plano Free do Turso (5 GB, 500 mi de leituras/mês) dá para décadas de uso pessoal.
- Mudanças futuras de schema: migre local (`npx prisma migrate dev`) e rode
  `npm run db:sync -- --force` para recopiar, ou aplique o SQL da migration no Turso.
- O token é uma senha: nunca suba o `.env` (já está no `.gitignore`).

## Telas

| Rota | O que faz |
|---|---|
| `/` | **Dashboard**: entradas, essenciais, não essenciais e sobra (real × orçado); meta de reserva de emergência; renda comprometida; taxa de poupança; gráficos Entradas × Saídas, despesas por categoria e últimos 6 meses; contas do mês e lançamentos recentes |
| `/lancamentos` | Registro de entradas/saídas com filtros por mês, categoria, tipo e busca; criar, editar e excluir |
| `/orcamento` | Grade mensal no formato da planilha: valor orçado por categoria × realizado, com diferença e totais por seção; copiar do mês anterior |
| `/recorrencias` | Assinaturas/contas fixas com dia de vencimento; status do mês (pago/pendente/atrasado); marcar como pago cria o lançamento |
| `/categorias` | Categorias padrão da planilha (10 essenciais, 20 não essenciais, 4 de receita); criar, mover entre essencial/não essencial, ativar/desativar |

## Modelo de dados

- **Category** — nome, natureza (`INCOME`/`EXPENSE`), tier (`ESSENCIAL`/`NAO_ESSENCIAL`)
- **Transaction** — data, descrição, valor em **centavos**, natureza, categoria,
  origem (`MANUAL`/`WHATSAPP`/`IMPORT` — campo pronto para as próximas fases)
- **BudgetItem** — valor orçado por categoria/mês
- **Recurrence** — nome, valor, dia de vencimento; pagamento gera Transaction vinculada

Indicadores calculados (espelham as fórmulas da planilha):

- Sobra do mês = entradas − despesas
- Reserva de emergência ideal = essenciais × 6
- Renda comprometida (%) e taxa de poupança (%)

## Segurança (login)

O app exige autenticação para tudo — telas e API.

- **Primeiro acesso**: ao abrir o app sem nenhum usuário cadastrado, a tela de
  login mostra o formulário de criação do administrador (uma única vez).
- **Login**: sessão opaca em cookie `httpOnly` (SameSite=Lax, 30 dias). No
  banco guarda-se apenas o **hash do token** — vazamento do banco não expõe
  sessões utilizáveis.
- **Senhas**: hash **scrypt** (N=16384, r=8, nativo do Node, recomendação
  OWASP), salt aleatório por usuário e comparação em tempo constante.
- **Rate limiting**: login limitado a **5 tentativas / 10 min por IP**, com
  bloqueio de 10 min ao exceder (e custo de hash mesmo para emails
  inexistentes, para não enumerar contas). O endpoint do bot tem limite de
  60 msg/min e exige o `WHATSAPP_TOKEN` do `.env` (header `x-bot-token`).
- **Middleware global**: todas as páginas sem sessão vão para `/login`; toda
  API sem sessão responde 401 — exceto `/api/auth/*` (login/status/registro
  único) e `/api/whatsapp/*` (autenticado por token).
- **Acessos adicionais**: `npm run user:add -- email@exemplo.com senhaForte123`
  (mínimo 8 caracteres). Não há registro público depois do primeiro acesso.

## Deploy no Render

O repositório tem o blueprint pronto (`render.yaml`) — o Render lê dele toda a
configuração. O banco fica no Turso, então nenhum arquivo precisa persistir no
servidor para o **app** funcionar.

**Opção A — Plano free (R$ 0, app na internet; bot continua no seu PC):**

1. Crie a conta em [render.com](https://render.com) com o GitHub.
2. **New → Blueprint** → selecione o repositório `Uncontrolled`.
3. Preencha quando pedido: `DATABASE_URL`, `DATABASE_AUTH_TOKEN` (os mesmos do
   seu `.env` do Turso) e `WHATSAPP_TOKEN` (crie uma senha qualquer — protege a
   API do bot).
4. **Apply** → o build roda sozinho (`npm ci` + `prisma generate` + `next build`).
5. A URL `https://uncontrollader-xxxx.onrender.com` fica no ar.

No plano free o app **adormece após 15 min sem acesso** (a primeira visita
seguinte demora ~50 s para acordar). Dados seguros — estão no Turso.

**Bot híbrido (grátis):** no seu PC, aponte o bot para a nuvem:
`APP_URL=https://uncontrollader-xxxx.onrender.com WHATSAPP_TOKEN=sua-senha npm run whatsapp`.
Cada mensagem acorda o app se estiver dormindo (1ª lenta, resto voa).

**Opção B — Plano starter (~US$ 7/mês, sempre ligado, com bot 24h):**

1. Mesmos passos A, mas antes de **Apply** mude `plan: free` → `starter` no
   `render.yaml` (ou no painel) e defina `START_BOT=1`.
2. No painel do serviço: **Disks → Attach disk** → mount path `/var/data`
   (1 GB) — é onde a sessão do WhatsApp persiste entre deploys.
3. No primeiro boot, abra **Logs** ao vivo: o QR do WhatsApp aparece lá —
   escaneie com o celular (Aparelhos conectados → Conectar). Só uma vez.
4. `APP_URL` já é resolvido internamente (loopback) — nada a configurar.

> Aviso honesto: o bot usa a interface não-oficial do WhatsApp (Baileys) em
> qualquer cenário — local ou nuvem. Risco de bloqueio pequeno, mas existe.

## Integração com WhatsApp (bot local)

Lance gastos e receitas mandando mensagem de texto — o bot conecta uma sessão
do WhatsApp (Baileys, não-oficial) no seu PC e fala com a API do app.

```bash
npm run whatsapp    # escaneie o QR com: Aparelhos conectados → Conectar aparelho
```

> Pré-requisito: `npm run dev` rodando em outra janela. A sessão fica salva em
> `whatsapp-bot/session` (no .gitignore — nunca compartilhe). Para deslogar,
> apague essa pasta. Não é afiliado ao WhatsApp; risco pequeno de bloqueio —
> se preferir isolamento, use um chip secundário.

**Comandos** (na conversa com o próprio número; em grupo, prefixe com `!`):

| Mensagem | Resultado |
|---|---|
| `mercado 150,90` | Despesa em Supermercado (palavra-chave → categoria) |
| `uber 23` · `ifood 42` · `farmacia 65` | Lança na categoria reconhecida |
| `+6500 salario` | Entrada (o `+` indica receita) |
| `paguei netflix` | Marca a recorrência como paga no mês |
| `saldo` | Resumo do mês + contas em aberto |
| `desfazer` | Apaga o último lançamento feito via WhatsApp |
| `ajuda` | Lista os comandos |

Sem palavra-chave reconhecida, a despesa cai em "Outras despesas". O bot
responde confirmando cada lançamento. Variáveis opcionais: `APP_URL`,
`WHATSAPP_TOKEN` (header `x-bot-token`), `ALLOWED_JIDS` (restringir chats).

## API REST

A mesma API usada pelas telas — base para a integração com WhatsApp:

```
GET/POST        /api/transactions        (filtros: month, kind, categoryId, q)
PATCH/DELETE    /api/transactions/:id
GET/POST        /api/categories
PATCH/DELETE    /api/categories/:id
GET/PUT         /api/budget?month=YYYY-MM
POST            /api/budget/copy        { from, to }
GET/POST        /api/recurrences?month=
PATCH/DELETE    /api/recurrences/:id
POST            /api/recurrences/:id/pay { month }   (idempotente)
GET             /api/dashboard?month=YYYY-MM
POST            /api/whatsapp/message   { text }  ← interpretador do bot
```

## Roadmap

1. ~~**Integração WhatsApp**~~ — ✅ entregue (bot local, ver seção acima).
2. **Investimentos** — carteira, aportes mensais (categoria já existe) e evolução do patrimônio.
3. **Grupos de gastos** — despesas compartilhadas com múltiplos membros e rateio (o bot já
   aceita mensagens de grupo com `!`; falta registrar *quem* lançou e o rateio).

## Estrutura

```
prisma/schema.prisma     modelo de dados (SQLite)
prisma/seed.ts           categorias da planilha + dados demo (--demo)
src/app/api/...          rotas REST
src/app/page.tsx         dashboard
src/app/{lancamentos,orcamento,recorrencias,categorias}/
src/lib/                 db, dinheiro (centavos↔BRL), meses, validação (zod), agregações
```
