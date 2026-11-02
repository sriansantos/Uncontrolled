# Bot 24h na Google Cloud (VM gratuita)

Guia para rodar o bot do WhatsApp numa VM **e2-micro** do Google Cloud no plano
**Always Free** (não expira, R$ 0). A VM fica ligada 24h — você não precisa mais
deixar o PC ligado.

> **Antes de começar**: decida onde o bot mora. Quando o da VM estiver ativo,
> **não rode** o `npm run whatsapp` do PC — dois bots no mesmo número respondem
> em dobro.

## 1. Conta e projeto (~10 min)

1. Crie a conta em [console.cloud.google.com](https://console.cloud.google.com)
   (login Google + cartão de crédito para verificar identidade — o tier free não
   debita; crie um **orçamento com alerta em US$ 1** para tranquilidade)
2. Um projeto padrão já vem criado ("My First Project"). Copie o **ID do projeto**
   na página inicial (algo como `my-project-123456`)

## 2. Token do GitHub (se o repositório for privado)

GitHub → Settings → Developer settings → **Fine-grained personal access
tokens** → Generate → permissão **Contents: Read-only** no repositório
`Uncontrolled` → copie o token (começa com `github_pat_…`).

## 3. Criar a VM via Cloud Shell (copiar e colar)

No console, abra o **Cloud Shell** (ícone `>_` no topo). Cole os blocos abaixo,
substituindo os três valores em maiúsculas:

```bash
# 1) projeto
gcloud config set project SEU_PROJECT_ID

# 2) baixa o script de instalação do bot
mkdir -p uncontrolled && cd uncontrolled
curl -sSfL -H "Authorization: Bearer SEU_GITHUB_TOKEN" \
  -o gcp-startup.sh https://raw.githubusercontent.com/sriansantos/Uncontrolled/main/whatsapp-bot/gcp-startup.sh

# 3) cria a VM — o script instala tudo sozinho no primeiro boot (~3 min)
#    (o valor do --metadata inteiro entre ASPAS — token com "&" quebra o comando)
gcloud compute instances create uncontrollader-bot \
  --zone=us-east1-b \
  --machine-type=e2-micro \
  --image-family=ubuntu-2404-lts-amd64 \
  --image-project=ubuntu-os-cloud \
  --boot-disk-type=pd-standard \
  --boot-disk-size=30GB \
  --metadata-from-file startup-script=gcp-startup.sh \
  --metadata="github_token=SEU_GITHUB_TOKEN,app_url=https://uncontrolled.onrender.com,whatsapp_token=TOKEN_DO_BOT"
```

`TOKEN_DO_BOT` = o token registrado com `npm run bot:add -- nome email`
(salve quando o comando imprimir). Cada bot tem o seu — e é ele que liga o
número do WhatsApp ao usuário dono dos lançamentos.

## 4. Escanear o QR (uma vez só)

```bash
gcloud compute ssh uncontrollader-bot --zone=us-east1-b \
  --command="sleep 20 && journalctl -u uncontrollader-bot -n 60 --no-pager"
```

O QR aparece no terminal. No celular: **WhatsApp → Aparelhos conectados →
Conectar aparelho**. Se o QR expirar, rode o comando de novo (gera um novo).
Depois o log mostra `✅ Bot conectado!` — teste mandando `saldo` para você mesmo.

## 5. Comandos do dia a dia (Cloud Shell)

```bash
# ver o log ao vivo (QR, mensagens processadas, erros)
gcloud compute ssh uncontrollader-bot --zone=us-east1-b \
  --command="journalctl -u uncontrollader-bot -f"

# atualizar o bot para a última versão do repositório
gcloud compute ssh uncontrollader-bot --zone=us-east1-b \
  --command="cd /opt/uncontrollader && sudo git pull && sudo systemctl restart uncontrollader-bot"

# reiniciar o serviço
gcloud compute ssh uncontrollader-bot --zone=us-east1-b \
  --command="sudo systemctl restart uncontrollader-bot"

# pausar o bot (sem perder a sessão)
gcloud compute ssh uncontrollader-bot --zone=us-east1-b \
  --command="sudo systemctl stop uncontrollader-bot"
```

## 5.1 Quem pode conversar com o bot

Por padrão o bot escuta **todos os chats diretos** do número conectado —
inclusive conversas normais (com a família, por exemplo). Para permitir só os
números que você escolher, adicione ao `.env` da VM:

```bash
gcloud compute ssh uncontrollader-bot --zone=us-east1-b \
  --command="sudo sed -i '/^ALLOWED_NUMBERS=/d' /opt/uncontrollader/whatsapp-bot/.env && echo 'ALLOWED_NUMBERS=5562920053791' | sudo tee -a /opt/uncontrollader/whatsapp-bot/.env && sudo systemctl restart uncontrollader-bot && sleep 3 && journalctl -u uncontrollader-bot -n 5 --no-pager"
```

(Troque `5562920053791` pelo número completo **com DDI e DDD**, só dígitos —
vários separados por vírgula. Conversas de fora da lista são **ignoradas em
silêncio** e aparecem no log como `↩ ignorado`. Grupos continuam exigindo o
prefixo `!` e podem ser restringidos com `ALLOWED_JIDS`.)

## 6. Como funciona lá dentro

- O código fica em `/opt/uncontrollader` (clonado do GitHub no primeiro boot)
- A sessão do WhatsApp fica em `/var/lib/uncontrollader-bot` — persiste entre
  reinícios e deploys; só escaneia QR de novo se você desconectar a sessão no
  celular (Aparelhos conectados)
- O serviço systemd **reinicia sozinho** se o bot cair, e volta ao ligar a VM
- O startup script roda a cada boot: **reiniciar a VM também atualiza o código**
- A VM é a região `us-east1` (EUA) por ser região gratuita — a latência de
  ~150 ms é irrelevante para lançamentos
- Serviço parado/VM desligada = **sem cobrança** de máquina (e a sessão fica salva)

## Custos e limites do Always Free

- 1 VM `e2-micro` ligada 24/7, 30 GB de disco padrão e IP externo em uso: **R$ 0**
- Regiões gratuitas: apenas EUA (`us-east1`, `us-central1`, `us-west1`)
- Pegadinhas que geram cobrança: VM fora das regiões acima, **IP estático
  reservado** parado, disco > 30 GB, ou uma segunda VM
