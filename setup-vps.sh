#!/bin/bash
set -e

echo "=== [1/6] Cài Node.js 22 ==="
curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
apt-get install -y nodejs git nginx

echo "=== [2/6] Clone code ==="
cd /root
git clone https://github.com/tienmt219-cyber/dsd.git
cd dsd
git checkout claude/fervent-maxwell-zSj9h

echo "=== [3/6] Cài dependencies ==="
npm install

echo "=== [4/6] Setup database ==="
cp .env.example .env
# Đổi JWT secret cho an toàn
sed -i 's/fashion-pos-secret-key-change-in-production/'"$(openssl rand -hex 32)"'/' .env
npx prisma migrate deploy
npx prisma db seed

echo "=== [5/6] Build app ==="
npm run build

echo "=== [6/6] Cài PM2 + chạy app ==="
npm install -g pm2
pm2 start npm --name "dsd" -- start
pm2 startup
pm2 save

# Setup Nginx reverse proxy
cat > /etc/nginx/sites-available/default << 'NGINX'
server {
    listen 80;
    server_name _;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_cache_bypass $http_upgrade;
    }
}
NGINX

nginx -t && systemctl restart nginx

echo ""
echo "=========================================="
echo "  SETUP XONG!"
echo "  Truy cap: http://45.76.213.154"
echo "  Dream Team: http://45.76.213.154/dreamteam.html"
echo "=========================================="
