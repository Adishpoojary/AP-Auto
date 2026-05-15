#!/bin/bash

################################################################################
# Production Deployment Script for AP Autos Dashboard
#
# Usage:
#   ./deploy_to_production.sh
#
# Requirements:
#   - SSH key at ~/.ssh/id_ed25519
#   - Node.js and npm installed locally
################################################################################

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

SSH_KEY="$HOME/.ssh/id_ed25519"
SERVER_USER="ubuntu"
SERVER_HOST="3.110.159.63"
OLD_SERVER_HOST="13.232.57.189"
SERVER_PATH="/var/www/react-dashboard"
TEMP_PATH="/tmp/react-dashboard-build"

# Parse flags
SKIP_NGINX=false
for arg in "$@"; do
    [ "$arg" = "--skip-nginx" ] && SKIP_NGINX=true
done

TIMESTAMP=$(date '+%Y-%m-%d %H:%M:%S')

echo "========================================================================"
echo -e "${BLUE}[$TIMESTAMP] React Dashboard → PRODUCTION (${SERVER_HOST})${NC}"
echo "========================================================================"

# ── Step 1: Build ────────────────────────────────────────────────────────────
echo ""
echo -e "${YELLOW}Step 1/6: Building React app...${NC}"

if [ ! -f "package.json" ]; then
    echo -e "${RED}❌ package.json not found. Run from the frontend root.${NC}"
    exit 1
fi

npm run build
if [ $? -ne 0 ]; then
    echo -e "${RED}❌ Build failed.${NC}"
    exit 1
fi
echo -e "${GREEN}✓ Build complete${NC}"

# ── Step 2: Prepare server directories ───────────────────────────────────────
echo ""
echo -e "${YELLOW}Step 2/6: Preparing server directories...${NC}"

ssh -i "$SSH_KEY" "$SERVER_USER@$SERVER_HOST" << 'ENDSSH'
    sudo mkdir -p /var/www/react-dashboard
    sudo chown -R www-data:www-data /var/www/react-dashboard
    sudo chmod -R 755 /var/www/react-dashboard
    mkdir -p /tmp/react-dashboard-build
    echo "✓ Directories ready"
ENDSSH

[ $? -ne 0 ] && echo -e "${RED}❌ Failed to prepare directories${NC}" && exit 1
echo -e "${GREEN}✓ Directories prepared${NC}"

# ── Step 3: Upload build ──────────────────────────────────────────────────────
echo ""
echo -e "${YELLOW}Step 3/6: Uploading build...${NC}"

scp -i "$SSH_KEY" -r build/* "$SERVER_USER@$SERVER_HOST:$TEMP_PATH/"
[ $? -ne 0 ] && echo -e "${RED}❌ Upload failed${NC}" && exit 1
echo -e "${GREEN}✓ Build uploaded${NC}"

# ── Step 4: Deploy build on server ───────────────────────────────────────────
echo ""
echo -e "${YELLOW}Step 4/6: Deploying build to ${SERVER_PATH}...${NC}"

ssh -i "$SSH_KEY" "$SERVER_USER@$SERVER_HOST" << 'ENDSSH'
    sudo rm -rf /var/www/react-dashboard/*
    sudo cp -r /tmp/react-dashboard-build/* /var/www/react-dashboard/
    sudo chown -R www-data:www-data /var/www/react-dashboard
    sudo chmod -R 755 /var/www/react-dashboard
    rm -rf /tmp/react-dashboard-build
    echo "✓ Build deployed"
ENDSSH

[ $? -ne 0 ] && echo -e "${RED}❌ Deploy failed${NC}" && exit 1
echo -e "${GREEN}✓ Build deployed${NC}"

# ── Step 5: Write nginx config ────────────────────────────────────────────────
echo ""
if [ "$SKIP_NGINX" = true ]; then
    echo -e "${YELLOW}Step 5/6: Skipping nginx config (--skip-nginx passed)${NC}"
else
echo -e "${YELLOW}Step 5/6: Writing nginx config...${NC}"

ssh -i "$SSH_KEY" "$SERVER_USER@$SERVER_HOST" 'sudo bash -s' << 'ENDSSH'

cat > /tmp/apautos-frontend.conf << 'NGINX'
server {
    server_name apautos.co;

    root /var/www/react-dashboard;
    index index.html;

    # ── OPS API – vehicle-drivers rewrite ─────────────────────────────────
    location = /api/v1/ops/vehicle-drivers {
        rewrite ^/api/v1/ops/vehicle-drivers$ /api/vehicle-drivers break;
        proxy_pass http://localhost:8000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # ── Vehicle Chat WebSocket ─────────────────────────────────────────────
    location /api/v1/ops/ws/ {
        proxy_pass http://127.0.0.1:8000/api/v1/ops/ws/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "Upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 86400;
        proxy_send_timeout 86400;
    }

    # ── OPS API ────────────────────────────────────────────────────────────
    location /api/v1/ops/ {
        proxy_pass http://localhost:8000/api/v1/ops/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # ── Dispatch vehicles rewrite ──────────────────────────────────────────
    location = /api/dispatch/vehicles {
        rewrite ^/api/dispatch/vehicles$ /api/vehicles break;
        proxy_pass http://localhost:8000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # ── Dispatch double-/api fix ───────────────────────────────────────────
    location ~ ^/api/dispatch/api/(.*)$ {
        rewrite ^/api/dispatch/api/(.*)$ /api/dispatch/$1 break;
        proxy_pass http://localhost:8000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # ── Dispatch API ───────────────────────────────────────────────────────
    location /api/dispatch/ {
        proxy_pass http://localhost:8000/api/dispatch/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # ── Customer double-/api fix ───────────────────────────────────────────
    location ~ ^/api/customer/api/(.*)$ {
        rewrite ^/api/customer/api/(.*)$ /api/customer/$1 break;
        proxy_pass http://localhost:8000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # ── Customer WebSocket ─────────────────────────────────────────────────
    location ~ ^/api/customer/ws/ {
        proxy_pass http://localhost:8000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "Upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 86400;
    }

    # ── Payment API ────────────────────────────────────────────────────────
    location /api/payment/ {
        proxy_pass http://localhost:8000/api/payment/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # ── Generic API ────────────────────────────────────────────────────────
    location /api/ {
        proxy_pass http://localhost:8000/api/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # ── WebSocket ──────────────────────────────────────────────────────────
    location /ws {
        proxy_pass http://localhost:8000/ws;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "Upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_read_timeout 86400;
    }

    # ── React SPA ──────────────────────────────────────────────────────────
    location / {
        try_files $uri $uri/ /index.html;
    }

    # ── Static asset caching ───────────────────────────────────────────────
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # ── Security headers ───────────────────────────────────────────────────
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;

    # ── Gzip ───────────────────────────────────────────────────────────────
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types text/plain text/css text/xml text/javascript application/javascript application/json;

    listen 80;
}

server {
    listen 80;
    server_name apautos.co;
    return 301 http://apautos.co$request_uri;
}
NGINX

mv /tmp/admin-frontend.conf /etc/nginx/sites-available/admin-frontend.conf
ln -sf /etc/nginx/sites-available/admin-frontend.conf /etc/nginx/sites-enabled/admin-frontend.conf
echo "✓ Nginx config written and enabled"
ENDSSH

[ $? -ne 0 ] && echo -e "${RED}❌ Failed to write nginx config${NC}" && exit 1
echo -e "${GREEN}✓ Nginx config written${NC}"
fi  # end SKIP_NGINX check

# ── Step 6: Test and reload nginx on production (do NOT touch other hosts) ───
# Note: OLD_SERVER_HOST used to match the dev admin box (deploy_to_backend.sh).
# Stopping nginx there broke devadmin.unloadin.com. DNS cutover is manual if needed.
echo ""
echo -e "${YELLOW}Step 6/6: Testing and reloading nginx on production (${SERVER_HOST})...${NC}"
ssh -i "$SSH_KEY" "$SERVER_USER@$SERVER_HOST" << 'ENDSSH'
    sudo nginx -t
    if [ $? -eq 0 ]; then
        sudo systemctl enable nginx
        sudo systemctl reload nginx 2>/dev/null || sudo systemctl restart nginx
        echo "✓ Production nginx reloaded"
    else
        echo "❌ Nginx config test failed — not reloaded"
        exit 1
    fi
ENDSSH

[ $? -ne 0 ] && echo -e "${RED}❌ Production nginx reload failed${NC}" && exit 1
echo -e "${GREEN}✓ Production nginx OK${NC}"

# ── Summary ───────────────────────────────────────────────────────────────────
echo ""
echo "========================================================================"
echo -e "${GREEN}✓ Production deployment complete!${NC}"
echo "========================================================================"
echo ""
echo ""
echo -e "${BLUE}Production URL:${NC} http://apautos.co"
echo -e "${BLUE}Server:${NC}         ${SERVER_HOST}"
echo -e "${BLUE}Build path:${NC}     ${SERVER_PATH}"
echo ""
exit 0
