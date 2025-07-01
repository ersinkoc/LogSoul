#!/bin/bash

# LogSoul Installation Script
# Usage: curl -fsSL https://get.logsoul.io | bash

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# LogSoul ASCII Art
echo -e "${BLUE}"
cat << 'EOF'
    ██╗      ██████╗  ██████╗ ███████╗ ██████╗ ██╗   ██╗██╗     
    ██║     ██╔═══██╗██╔════╝ ██╔════╝██╔═══██╗██║   ██║██║     
    ██║     ██║   ██║██║  ███╗███████╗██║   ██║██║   ██║██║     
    ██║     ██║   ██║██║   ██║╚════██║██║   ██║██║   ██║██║     
    ███████╗╚██████╔╝╚██████╔╝███████║╚██████╔╝╚██████╔╝███████╗
    ╚══════╝ ╚═════╝  ╚═════╝ ╚══════╝ ╚═════╝  ╚═════╝ ╚══════╝
                                                                
        Feel the pulse of your domains 🔮
EOF
echo -e "${NC}"

# Function to print colored output
print_status() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if running as root
if [ "$EUID" -eq 0 ]; then
    print_warning "Running as root. Consider running as a regular user."
fi

# Detect OS and architecture
OS="$(uname -s)"
ARCH="$(uname -m)"

print_status "Detected OS: $OS, Architecture: $ARCH"

# Check prerequisites
check_prerequisites() {
    print_status "Checking prerequisites..."
    
    # Check Node.js
    if ! command -v node &> /dev/null; then
        print_error "Node.js is not installed. Please install Node.js 16+ first:"
        echo "  - Visit: https://nodejs.org/"
        echo "  - Or use a package manager:"
        echo "    Ubuntu/Debian: sudo apt install nodejs npm"
        echo "    CentOS/RHEL: sudo yum install nodejs npm"
        echo "    macOS: brew install node"
        exit 1
    fi
    
    # Check Node.js version
    NODE_VERSION=$(node --version | cut -d'v' -f2)
    MAJOR_VERSION=$(echo $NODE_VERSION | cut -d'.' -f1)
    
    if [ "$MAJOR_VERSION" -lt 16 ]; then
        print_error "Node.js version $NODE_VERSION is too old. Please upgrade to Node.js 16+"
        exit 1
    fi
    
    print_status "Node.js version $NODE_VERSION ✓"
    
    # Check npm
    if ! command -v npm &> /dev/null; then
        print_error "npm is not installed. Please install npm."
        exit 1
    fi
    
    print_status "npm $(npm --version) ✓"
}

# Install LogSoul
install_logsoul() {
    print_status "Installing LogSoul..."
    
    # Create installation directory
    INSTALL_DIR="$HOME/.logsoul"
    mkdir -p "$INSTALL_DIR"
    cd "$INSTALL_DIR"
    
    # Download and extract LogSoul
    if command -v curl &> /dev/null; then
        print_status "Downloading LogSoul..."
        curl -fsSL "https://github.com/user/logsoul/archive/main.tar.gz" | tar -xz --strip-components=1
    elif command -v wget &> /dev/null; then
        print_status "Downloading LogSoul..."
        wget -qO- "https://github.com/user/logsoul/archive/main.tar.gz" | tar -xz --strip-components=1
    else
        print_error "Neither curl nor wget is available. Please install one of them."
        exit 1
    fi
    
    # Install dependencies
    print_status "Installing dependencies..."
    npm install --production
    
    # Build the project
    print_status "Building LogSoul..."
    npm run build
    
    # Create symlink for global access
    if [ -w "/usr/local/bin" ]; then
        ln -sf "$INSTALL_DIR/dist/src/cli/index.js" "/usr/local/bin/logsoul"
        chmod +x "/usr/local/bin/logsoul"
        print_status "Created global 'logsoul' command"
    else
        print_warning "Cannot create global command. Add $INSTALL_DIR/dist/src/cli to your PATH"
        echo "export PATH=\"$INSTALL_DIR/dist/src/cli:\$PATH\"" >> "$HOME/.bashrc"
    fi
}

# Create systemd service (Linux only)
create_service() {
    if [ "$OS" = "Linux" ] && command -v systemctl &> /dev/null; then
        print_status "Creating systemd service..."
        
        SERVICE_FILE="/etc/systemd/system/logsoul.service"
        
        if [ -w "/etc/systemd/system" ] || [ "$EUID" -eq 0 ]; then
            cat > "$SERVICE_FILE" << EOF
[Unit]
Description=LogSoul - Smart Log Monitoring
After=network.target
Wants=network.target

[Service]
Type=simple
User=$USER
WorkingDirectory=$INSTALL_DIR
ExecStart=/usr/bin/node $INSTALL_DIR/dist/src/index.js
Restart=always
RestartSec=10
Environment=NODE_ENV=production

# Security settings
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ProtectHome=true
ReadWritePaths=$INSTALL_DIR

[Install]
WantedBy=multi-user.target
EOF
            
            systemctl daemon-reload
            print_status "LogSoul service created. Enable with: sudo systemctl enable logsoul"
        else
            print_warning "Cannot create systemd service (insufficient permissions)"
        fi
    fi
}

# Post-installation setup
post_install() {
    print_status "Running post-installation setup..."
    
    # Initialize LogSoul
    cd "$INSTALL_DIR"
    node dist/src/cli/index.js init
    
    print_status "LogSoul installed successfully! 🎉"
    echo
    echo -e "${GREEN}Quick Start:${NC}"
    echo "  1. Discover domains:  logsoul discover"
    echo "  2. Start web server:  logsoul server"
    echo "  3. View dashboard:    http://localhost:3000"
    echo
    echo -e "${GREEN}Useful Commands:${NC}"
    echo "  logsoul --help        Show all commands"
    echo "  logsoul list          List monitored domains"
    echo "  logsoul watch <domain> Live tail domain logs"
    echo "  logsoul stats <domain> Show domain statistics"
    echo
    echo -e "${GREEN}Documentation:${NC}"
    echo "  https://github.com/user/logsoul"
    echo
    print_status "Happy monitoring! 🔮"
}

# Main installation flow
main() {
    print_status "Starting LogSoul installation..."
    
    check_prerequisites
    install_logsoul
    create_service
    post_install
}

# Run installation
main "$@"