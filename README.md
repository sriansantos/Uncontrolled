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
