#!/usr/bin/env bash
# Start do app no Render. O Render define $PORT; o bot (opcional) roda no
# mesmo container e fala com a API por loopback.
set -eu

export APP_URL="${APP_URL:-http://localhost:${PORT:-3000}}"

if [ "${START_BOT:-0}" = "1" ]; then
  echo "[start] iniciando bot do WhatsApp em segundo plano…"
  npx tsx whatsapp-bot/bot.ts &
fi

exec npm run start
