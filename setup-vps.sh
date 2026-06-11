#!/bin/bash
set -e

# ═══════════════════════════════════════════════════
#  Dream Team VPS Deploy Script
#  Usage: ssh root@YOUR_VPS_IP 'bash -s' < setup-vps.sh
# ═══════════════════════════════════════════════════

VPS_IP="${VPS_IP:-YOUR_VPS_IP}"
BRANCH="claude/trusting-hawking-pjeiko"
APP_DIR="/root/dsd"
DOMAIN="${DOMAIN:-}"

echo "╔══════════════════════════════════════╗"
echo "║   🌸 Dream Team VPS Setup           ║"
echo "╚══════════════════════════════════════╝"

# ── [1/7] Node.js + tools ─────────────────────────
echo "=== [1/7] Cài Node.js 22 + tools ==="
if ! command -v node &>/dev/null; then
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
  apt-get install -y nodejs
fi
apt-get install -y git nginx certbot python3-certbot-nginx -y
node -v && npm -v

# ── [2/7] Clone code ──────────────────────────────
echo "=== [2/7] Clone code ==="
if [ -d "$APP_DIR" ]; then
  cd "$APP_DIR"
  git fetch origin "$BRANCH"
  git checkout "$BRANCH"
  git pull origin "$BRANCH"
else
  cd /root
  git clone https://github.com/tienmt219-cyber/dsd.git
  cd dsd
  git checkout "$BRANCH"
fi

# ── [3/7] Install dependencies ────────────────────
echo "=== [3/7] npm install ==="
npm install --production=false

# ── [4/7] Setup .env ──────────────────────────────
echo "=== [4/7] Setup .env ==="
if [ ! -f .env ]; then
  cat > .env << ENVEOF
DATABASE_URL="file:./dev.db"
JWT_SECRET="$(openssl rand -hex 32)"
GEMINI_KEY="AIzaSyDoabiBYK6T08k33o4fSvxS4DXlsyHOMG0"
NODE_ENV=production
ENVEOF
  echo "  ✅ .env created"
else
  echo "  ⏭ .env exists, skipping"
fi

# ── [5/7] Database setup ──────────────────────────
echo "=== [5/7] Database: schema + migration ==="
npx prisma generate

if [ ! -f dev.db ]; then
  echo "  Creating fresh database..."
  npx prisma db push
  echo "  ✅ Schema created"

  # Migration from xlsx (if file exists)
  if [ -f mydream.xlsx ]; then
    echo "  Importing data from mydream.xlsx..."
    node scripts/migrate-xlsx.mjs mydream.xlsx
    echo "  ✅ Data imported"
  else
    echo "  ⚠ mydream.xlsx not found — empty database"
    echo "  Upload it and run: node scripts/migrate-xlsx.mjs mydream.xlsx"
  fi
else
  echo "  ⏭ dev.db exists, applying schema changes..."
  npx prisma db push
fi

# ── [6/7] Build + PM2 ─────────────────────────────
echo "=== [6/7] Build app ==="
npm run build

echo "  Starting with PM2..."
npm install -g pm2 2>/dev/null || true

if pm2 describe dsd &>/dev/null; then
  pm2 restart dsd
else
  pm2 start npm --name "dsd" -- start
  pm2 startup -u root --hp /root 2>/dev/null || true
  pm2 save
fi

# ── [7/7] Nginx ────────────────────────────────────
echo "=== [7/7] Nginx reverse proxy ==="

cat > /etc/nginx/sites-available/dsd << 'NGINX'
server {
    listen 80;
    server_name _;

    client_max_body_size 10M;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 120s;
    }
}
NGINX

ln -sf /etc/nginx/sites-available/dsd /etc/nginx/sites-enabled/dsd
rm -f /etc/nginx/sites-enabled/default 2>/dev/null || true
nginx -t && systemctl restart nginx && systemctl enable nginx

echo ""
echo "╔══════════════════════════════════════════════╗"
echo "║  ✅ SETUP XONG!                             ║"
echo "║                                              ║"
echo "║  App:        http://$VPS_IP                  ║"
echo "║  Dream Team: http://$VPS_IP/dreamteam.html   ║"
echo "║                                              ║"
echo "║  Commands:                                   ║"
echo "║    pm2 logs dsd        # xem logs            ║"
echo "║    pm2 restart dsd     # restart app         ║"
echo "║    cd /root/dsd && git pull && npm run build  ║"
echo "║    pm2 restart dsd     # update code         ║"
echo "╚══════════════════════════════════════════════╝"
echo ""
echo "📦 Nếu cần import data:"
echo "   scp mydream.xlsx root@$VPS_IP:/root/dsd/"
echo "   ssh root@$VPS_IP 'cd /root/dsd && node scripts/migrate-xlsx.mjs'"
echo ""
echo "🔒 Nếu có domain, setup HTTPS:"
echo "   certbot --nginx -d yourdomain.com"
