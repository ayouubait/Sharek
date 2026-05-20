#!/bin/bash
# =====================================================================
# ShareK - Déploiement sur Hostinger
# Usage: ./deploy.sh
# =====================================================================
set -e

SSH_PORT=65002
SSH_USER=u421222135
SSH_HOST=82.25.102.97
REMOTE_DIR="~/domains/sharek.biosim.me/public_html"

cd "$(dirname "$0")"

echo "[1/3] Build Vite..."
npm run build

echo ""
echo "[2/3] Upload vers Hostinger ($SSH_HOST)..."
tar -czf - -C out . | ssh -p $SSH_PORT $SSH_USER@$SSH_HOST \
  "rm -rf $REMOTE_DIR/assets $REMOTE_DIR/index.html $REMOTE_DIR/logo.webp && tar -xzf - -C $REMOTE_DIR/"

echo ""
echo "[3/3] Déploiement terminé."
echo "→ https://sharek.biosim.me"
echo ""
echo "Pense au hard refresh (Cmd+Shift+R) sur le navigateur."
