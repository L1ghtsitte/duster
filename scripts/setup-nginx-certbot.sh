#!/bin/bash
# Ubuntu/Debian: Nginx + Let's Encrypt для Duster API
# Использование: sudo ./setup-nginx-certbot.sh api.club.example.com

set -euo pipefail
DOMAIN="${1:?Укажите домен, например api.club.example.com}"
EMAIL="${2:-admin@${DOMAIN}}"
UPSTREAM_PORT="${3:-3847}"

apt-get update
apt-get install -y nginx certbot python3-certbot-nginx

cat > "/etc/nginx/sites-available/duster" <<EOF
server {
    listen 80;
    server_name ${DOMAIN};

    location / {
        proxy_pass http://127.0.0.1:${UPSTREAM_PORT};
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_read_timeout 86400;
    }
}
EOF

ln -sf /etc/nginx/sites-available/duster /etc/nginx/sites-enabled/duster
nginx -t && systemctl reload nginx

certbot --nginx -d "${DOMAIN}" --non-interactive --agree-tos -m "${EMAIL}"

echo "Готово. Установите DUSTER_PUBLIC_URL=https://${DOMAIN}"
