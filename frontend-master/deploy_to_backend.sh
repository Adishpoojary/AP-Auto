#!/bin/bash

################################################################################
# Dev/Test Deployment Script for AP Autos Dashboard
#
# Usage:
#   ./deploy_to_backend.sh
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
SERVER_HOST="13.232.57.189"
SERVER_PATH="/var/www/react-dashboard"
TEMP_PATH="/tmp/react-dashboard-build"

TIMESTAMP=$(date '+%Y-%m-%d %H:%M:%S')

echo "========================================================================"
echo -e "${BLUE}[$TIMESTAMP] React Dashboard → DEV (${SERVER_HOST})${NC}"
echo "========================================================================"

# ── Step 1: Build with devadmin env ──────────────────────────────────────────
echo ""
echo -e "${YELLOW}Step 1/6: Building React app (devadmin env)...${NC}"

if [ ! -f "package.json" ]; then
    echo -e "${RED}❌ package.json not found. Run from the frontend root.${NC}"
    exit 1
fi

# Copy devadmin env as the build env
cp .env.devadmin .env.production.local

npm run build
BUILD_EXIT=$?

# Clean up temp env override
rm -f .env.production.local

if [ $BUILD_EXIT -ne 0 ]; then
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
echo -e "${YELLOW}Step 4/6: Deploying build...${NC}"

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
echo -e "${YELLOW}Step 5/6: Writing nginx config...${NC}"

ssh -i "$SSH_KEY" "$SERVER_USER@$SERVER_HOST" 'sudo bash -s' << 'ENDSSH'

cat > /tmp/apautos-frontend.conf << 'NGINX'
server {
    server_name apautos.local;

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
    server_name apautos.local;
    return 301 http://apautos.local$request_uri;
}
NGINX

mv /tmp/devadmin-frontend.conf /etc/nginx/sites-available/devadmin-frontend.conf
ln -sf /etc/nginx/sites-available/devadmin-frontend.conf /etc/nginx/sites-enabled/devadmin-frontend.conf
echo "✓ Nginx config written and enabled"
ENDSSH

[ $? -ne 0 ] && echo -e "${RED}❌ Failed to write nginx config${NC}" && exit 1
echo -e "${GREEN}✓ Nginx config written${NC}"

# ── Step 6: Test and reload nginx ────────────────────────────────────────────
echo ""
echo -e "${YELLOW}Step 6/6: Testing and reloading nginx...${NC}"

ssh -i "$SSH_KEY" "$SERVER_USER@$SERVER_HOST" << 'ENDSSH'
    sudo nginx -t
    if [ $? -ne 0 ]; then
        echo "❌ Nginx config test failed"
        exit 1
    fi

    # Ensure PID file exists for nginx -s reload
    if [ ! -f /run/nginx.pid ]; then
        MASTER_PID=$(ps aux | grep 'nginx: master' | grep -v grep | awk '{print $2}' | head -1)
        if [ -n "$MASTER_PID" ]; then
            echo "$MASTER_PID" | sudo tee /run/nginx.pid > /dev/null
        fi
    fi

    sudo nginx -s reload
    echo "✓ Nginx reloaded"
ENDSSH

[ $? -ne 0 ] && echo -e "${RED}❌ Nginx reload failed${NC}" && exit 1
echo -e "${GREEN}✓ Nginx reloaded${NC}"

echo ""
echo "========================================================================"
echo -e "${GREEN}✓ Dev deployment complete!${NC}"
echo "========================================================================"
echo ""
echo -e "${BLUE}URL:${NC}    http://apautos.local"
echo -e "${BLUE}Server:${NC}     ${SERVER_HOST}"
echo -e "${BLUE}Build path:${NC} ${SERVER_PATH}"
echo ""
exit 0
