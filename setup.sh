#!/bin/bash
# Setup script for Raspberry Pi - Run this first!

set -e

echo "╔═══════════════════════════════════════════════╗"
echo "║   Raspberry Pi Device Setup Script           ║"
echo "╚═══════════════════════════════════════════════╝"
echo ""

# Check if running on Raspberry Pi
if [[ $(uname -m) == "aarch64" ]] || [[ $(uname -m) == "armv7l" ]]; then
    echo "✓ Detected ARM architecture: $(uname -m)"
else
    echo "⚠ Warning: Not ARM architecture (detected: $(uname -m))"
    echo "  This script is designed for Raspberry Pi"
    read -p "  Continue anyway? (y/n) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

echo ""
echo "[1/5] Checking Node.js version..."
if command -v node &> /dev/null; then
    NODE_VERSION=$(node --version)
    echo "      Current version: $NODE_VERSION"
    
    MAJOR_VERSION=$(echo $NODE_VERSION | cut -d'v' -f2 | cut -d'.' -f1)
    if [ "$MAJOR_VERSION" -lt 18 ]; then
        echo "      ⚠ Node.js 18+ required"
        read -p "      Install Node.js 18? (y/n) " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            echo "      Installing Node.js 18..."
            curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
            sudo apt install -y nodejs
            echo "      ✓ Node.js installed: $(node --version)"
        else
            echo "      Exiting. Please install Node.js 18+ manually."
            exit 1
        fi
    else
        echo "      ✓ Node.js version OK"
    fi
else
    echo "      Node.js not found. Installing..."
    curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
    sudo apt install -y nodejs
    echo "      ✓ Node.js installed: $(node --version)"
fi

echo ""
echo "[2/5] Installing npm dependencies..."
npm install --no-fund --no-audit
echo "      ✓ Dependencies installed"

echo ""
echo "[3/5] Creating directories..."
mkdir -p keys results logs
echo "      ✓ Directories created"

echo ""
echo "[4/5] Checking network connectivity..."
read -p "      Enter gateway IP address: " GATEWAY_IP
if ping -c 1 -W 2 $GATEWAY_IP &> /dev/null; then
    echo "      ✓ Can reach $GATEWAY_IP"
else
    echo "      ⚠ Cannot ping $GATEWAY_IP"
    echo "      Please check network connection"
fi

echo ""
echo "[5/5] Testing gateway connection..."
if curl -s -m 5 http://$GATEWAY_IP:3000/healthz &> /dev/null; then
    echo "      ✓ Gateway is reachable at http://$GATEWAY_IP:3000"
else
    echo "      ⚠ Gateway not responding at http://$GATEWAY_IP:3000"
    echo "      Make sure gateway is running on Mac"
fi

echo ""
echo "╔═══════════════════════════════════════════════╗"
echo "║              SETUP COMPLETE!                  ║"
echo "╚═══════════════════════════════════════════════╝"
echo ""
echo "Next steps:"
echo ""
echo "  1. Test single run:"
echo "     node device-simulator.js --server http://$GATEWAY_IP:3000"
echo ""
echo "  2. Run benchmark:"
echo "     SERVER=http://$GATEWAY_IP:3000 RUNS=20 node benchmark.js"
echo ""
echo "  3. View results:"
echo "     cat results/summary-*.txt"
echo ""
echo "Good luck! 🚀"
