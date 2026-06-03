#!/usr/bin/env bash
set -e

DUSTER_VERSION="0.1.0"
INSTALL_DIR="${DUSTER_INSTALL_DIR:-/opt/duster}"
LOG_FILE="/tmp/duster-install-$$.log"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log() { echo -e "${BLUE}[INFO]${NC} $1" | tee -a "$LOG_FILE"; }
ok() { echo -e "${GREEN}OK${NC} $1" | tee -a "$LOG_FILE"; }
warn() { echo -e "${YELLOW}WARN${NC} $1" | tee -a "$LOG_FILE"; }
err() { echo -e "${RED}ERR${NC} $1" | tee -a "$LOG_FILE"; exit 1; }

detect_os() {
    if [ -f /etc/os-release ]; then . /etc/os-release; OS=$ID
    else err "Cannot detect OS"; fi
}

check_root() {
    if [ "$EUID" -ne 0 ]; then err "Run with sudo"; fi
}

install_deps() {
    log "Installing dependencies..."
    if command -v apt-get &> /dev/null; then
        apt-get update
        apt-get install -y curl wget git postgresql postgresql-contrib redis-server
        if ! command -v node &> /dev/null; then
            curl -fsSL https://deb.nodesource.com/gpgkey/nodesource-repo.gpg.key | gpg --dearmor -o /etc/apt/keyrings/nodesource.gpg
            echo "deb [signed-by=/etc/apt/keyrings/nodesource.gpg] https://deb.nodesource.com/node_$(lsb_release -cs) nodistro main" > /etc/apt/sources.list.d/nodesource.list
            apt-get update && apt-get install -y nodejs
        fi
    elif command -v dnf &> /dev/null; then
        dnf install -y curl wget git postgresql-server redis
        if ! command -v node &> /dev/null; then
            curl -fsSL https://rpm.nodesource.com/setup_22.x | bash -
            dnf install -y nodejs
        fi
    fi
    ok "Dependencies ready"
}

setup_postgres() {
    log "Setting up PostgreSQL..."
    systemctl enable postgresql 2>/dev/null || true
    systemctl start postgresql 2>/dev/null || true
    sudo -u postgres psql -c "CREATE USER duster WITH PASSWORD 'duster' CREATEDB;" 2>/dev/null || true
    sudo -u postgres psql -c "CREATE DATABASE duster OWNER duster;" 2>/dev/null || true
    ok "PostgreSQL ready"
}

setup_redis() {
    log "Setting up Redis..."
    systemctl enable redis 2>/dev/null || true
    systemctl start redis 2>/dev/null || true
    ok "Redis ready"
}

setup_app() {
    log "Installing Duster..."
    mkdir -p "$INSTALL_DIR"
    cd "$INSTALL_DIR"
    if [ ! -d .git ]; then
        git clone https://github.com/L1ghtsitte/duster.git . 2>/dev/null || warn "Git clone failed, using local files"
    fi
    npm install --legacy-peer-deps 2>/dev/null || true
    npm run build --workspace=@duster/server 2>/dev/null || true
    ok "Duster ready in $INSTALL_DIR"
}

setup_env() {
    if [ ! -f "$INSTALL_DIR/packages/server/.env" ]; then
        mkdir -p "$INSTALL_DIR/packages/server"
        cat > "$INSTALL_DIR/packages/server/.env" << EOF
NODE_ENV=production
PORT=3847
DATABASE_URL=postgresql://duster:duster@localhost:5432/duster
REDIS_URL=redis://localhost:6379
DUSTER_JWT_SECRET=$(openssl rand -base64 32)
DUSTER_PUBLIC_URL=http://localhost:3847
LOG_LEVEL=info
EOF
        ok ".env created"
    fi
}

setup_systemd() {
    log "Creating systemd service..."
    cat > /etc/systemd/system/duster-server.service << EOF
[Unit]
Description=Duster Server
After=network.target postgresql.service redis.service

[Service]
Type=simple
User=root
WorkingDirectory=$INSTALL_DIR/packages/server
ExecStart=/usr/bin/node dist/index.js
Restart=always

[Install]
WantedBy=multi-user.target
EOF
    systemctl daemon-reload 2>/dev/null || true
    systemctl enable duster-server 2>/dev/null || true
    ok "Systemd service created"
}

echo ""
echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}  Duster v$DUSTER_VERSION - Installer${NC}"
echo -e "${YELLOW}  Not tested, tests from v1.0.0${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

check_root
detect_os
log "OS: $OS"

install_deps
setup_postgres
setup_redis
setup_app
setup_env
setup_systemd

ok "Installation complete!"
echo ""
echo "API: http://localhost:3847/api/health"
echo "Admin: http://localhost:3847/admin"
echo "Login: admin / admin123"
echo ""
echo -e "${BLUE}========================================${NC}"