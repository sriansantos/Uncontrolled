#!/usr/bin/env bash
# Startup script da VM Google Cloud (e2-micro) — Uncontrollader WhatsApp Bot.
# Roda a cada boot e é idempotente: reboot da VM também atualiza o código.
# Configuração chega via metadata: github_token, app_url, whatsapp_token.
set -euo pipefail

METADATA=http://metadata.google.internal/computeMetadata/v1/instance/attributes
md() { curl -sSf -H "Metadata-Flavor: Google" "$METADATA/$1"; }

export DEBIAN_FRONTEND=noninteractive
apt-get update -y
apt-get install -y ca-certificates curl gnupg git

GH_TOKEN=$(md github_token || true)
APP_URL=$(md app_url)
WA_TOKEN=$(md whatsapp_token)

REPO=/opt/uncontrollader
BOT=$REPO/whatsapp-bot
SESSION=/var/lib/uncontrollader-bot

# ---- código (reboot = atualiza) ----
if [ -d "$REPO/.git" ]; then
  cd "$REPO"
  git pull --ff-only || true
else
  if [ -n "$GH_TOKEN" ]; then
    git clone "https://x-access-token:${GH_TOKEN}@github.com/sriansantos/Uncontrolled.git" "$REPO"
  else
    git clone "https://github.com/sriansantos/Uncontrolled.git" "$REPO"
  fi
fi

# ---- Node 22 (uma vez só) ----
if ! command -v node >/dev/null 2>&1; then
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
  apt-get install -y nodejs
fi

# ---- swap de 1 GB (e2-micro tem 1 GB de RAM) ----
if [ ! -f /swapfile ]; then
  fallocate -l 1G /swapfile
  chmod 600 /swapfile
  mkswap /swapfile
  swapon /swapfile
  echo '/swapfile none swap sw 0 0' >> /etc/fstab
fi

# ---- configuração do bot ----
mkdir -p "$SESSION"
cat > "$BOT/.env" <<EOF
APP_URL=$APP_URL
WHATSAPP_TOKEN=$WA_TOKEN
BOT_SESSION_DIR=$SESSION
EOF

# ---- dependências só do bot (leve) ----
cd "$BOT"
npm install --no-audit --no-fund

# ---- serviço systemd: reinicia sozinho em crash e no boot ----
cat > /etc/systemd/system/uncontrollader-bot.service <<'UNIT'
[Unit]
Description=Uncontrollader WhatsApp Bot
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
WorkingDirectory=/opt/uncontrollader/whatsapp-bot
ExecStart=/usr/bin/npx tsx bot.ts
Restart=always
RestartSec=5
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
UNIT

systemctl daemon-reload
systemctl enable --now uncontrollader-bot

echo "startup concluído — QR do WhatsApp: journalctl -u uncontrollader-bot -n 60 --no-pager"
