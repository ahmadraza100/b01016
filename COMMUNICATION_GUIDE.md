# 🔄 RASPBERRY PI ↔ MAC COMMUNICATION GUIDE

## 📡 Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        YOUR HOME NETWORK                        │
│                    (192.168.1.x or 10.0.0.x)                   │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌──────────────────────────┐         ┌────────────────────┐  │
│  │   RASPBERRY PI           │         │     YOUR MAC       │  │
│  │   (Edge Device)          │         │   (Server Side)    │  │
│  │                          │         │                    │  │
│  │  IP: 192.168.1.100      │◄───────►│  IP: 192.168.1.5   │  │
│  │  Port: (client only)    │  WiFi   │  Port: 3000        │  │
│  │                          │    or   │                    │  │
│  │  Running:                │ Ethernet│  Running:          │  │
│  │  • device-simulator.js   │         │  • Hyperledger     │  │
│  │  • benchmark.js          │         │    Fabric          │  │
│  │                          │         │  • verifier-gateway│  │
│  └──────────────────────────┘         └────────────────────┘  │
│           │                                      ▲             │
│           │  HTTP Requests                       │             │
│           │  POST /api/did/create                │             │
│           │  POST /api/auth/token                │             │
│           │  POST /api/data/stream               │             │
│           └──────────────────────────────────────┘             │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**Key Point**: Raspberry Pi is the **CLIENT** (makes requests), Mac is the **SERVER** (receives requests).

---

## 📦 HOW TO TRANSFER FOLDER

### **Method 1: SCP (Secure Copy) - RECOMMENDED** ⭐

This is the easiest and most reliable method.

#### Step 1: Find Your Raspberry Pi IP Address

**Option A: Check your router**
- Open router admin panel (usually http://192.168.1.1)
- Look for connected devices
- Find "raspberrypi" or device with MAC starting with `b8:27:eb` or `dc:a6:32`

**Option B: Scan from Mac**
```bash
# On your Mac
arp -a | grep -E "b8:27:eb|dc:a6:32|e4:5f:01"
# These are Raspberry Pi MAC address prefixes

# Or use nmap (if installed)
nmap -sn 192.168.1.0/24 | grep -B 2 "Raspberry"
```

**Option C: Connect monitor to Pi**
```bash
# On Raspberry Pi (with keyboard/monitor)
hostname -I
# Shows IP address like: 192.168.1.100
```

#### Step 2: Transfer Folder from Mac to Pi

```bash
# On your Mac terminal
cd /Users/ahmadraza/Downloads/work/Iot_project

# Copy entire folder to Raspberry Pi
scp -r raspberry-pi-device/ pi@192.168.1.100:~/
#          ↑               ↑   ↑               ↑
#      folder name      user  Pi IP      destination
#                                          (~/ = home dir)

# You'll be prompted for password (default: raspberry)
```

**Expected output:**
```
device-simulator.js          100%   5.8KB  50.2KB/s   00:00
benchmark.js                 100%   6.0KB  55.1KB/s   00:00
package.json                 100%   583B   5.1KB/s    00:00
setup.sh                     100%   3.4KB  30.5KB/s   00:00
README.md                    100%   7.5KB  65.2KB/s   00:00
...
```

✅ **Done!** Folder is now on Raspberry Pi at `/home/pi/raspberry-pi-device/`

---

### **Method 2: USB Drive (If No Network)**

```bash
# 1. On Mac: Copy to USB
cp -r /Users/ahmadraza/Downloads/work/Iot_project/raspberry-pi-device /Volumes/USB_DRIVE/

# 2. Eject USB, plug into Raspberry Pi

# 3. On Raspberry Pi: Copy from USB
cp -r /media/pi/USB_DRIVE/raspberry-pi-device ~/
```

---

### **Method 3: GitHub (If You Use Git)**

```bash
# On Mac: Push to GitHub
cd /Users/ahmadraza/Downloads/work/Iot_project
git init
git add raspberry-pi-device/
git commit -m "Add Raspberry Pi device code"
git remote add origin https://github.com/YOUR_USERNAME/iot-did-project.git
git push -u origin main

# On Raspberry Pi: Clone
cd ~
git clone https://github.com/YOUR_USERNAME/iot-did-project.git
cd iot-did-project/raspberry-pi-device
```

---

## 🌐 NETWORK COMMUNICATION SETUP

### **Step 1: Find Your Mac's IP Address**

```bash
# On your Mac
ifconfig | grep "inet " | grep -v 127.0.0.1 | head -1
```

**Example output:**
```
inet 192.168.1.5 netmask 0xffffff00 broadcast 192.168.1.255
```

Your Mac IP is: **192.168.1.5** ← Use this!

**Alternative (easier):**
```bash
# On Mac
ipconfig getifaddr en0    # WiFi
# or
ipconfig getifaddr en1    # Ethernet
```

---

### **Step 2: Start Services on Mac**

#### A. Start Hyperledger Fabric Network

```bash
# Terminal 1 on Mac
cd /Users/ahmadraza/Downloads/work/Iot_project/fabric-samples/test-network

# Stop any existing network
./network.sh down

# Start fresh network with DID channel
./network.sh up createChannel -c didchannel -ca

# Deploy DID registry chaincode
./network.sh deployCC -ccn didregistrycc \
  -ccp ../../test-network/chaincode/didregistrycc \
  -ccl javascript
```

**Wait for output:**
```
Channel 'didchannel' joined
Chaincode deployed successfully
```

#### B. Start Verifier Gateway

```bash
# Terminal 2 on Mac
cd /Users/ahmadraza/Downloads/work/Iot_project/verifier-gateway

# Start gateway (accessible from network)
PORT=3000 \
JWT_SECRET=$(openssl rand -hex 32) \
CLUSTER_WORKERS=1 \
node server.js
```

**Expected output:**
```
Gateway listening on port 3000
Connected to Fabric network
DID Registry chaincode: didregistrycc
```

---

### **Step 3: Make Mac Accessible from Raspberry Pi**

#### Option A: Disable Mac Firewall (Simplest)

```bash
# System Preferences → Security & Privacy → Firewall
# Click "Turn Off Firewall" (temporarily while testing)
```

#### Option B: Allow Node.js Through Firewall

```bash
# System Preferences → Security & Privacy → Firewall → Firewall Options
# Click "+" and add Node.js application
# Or run this command:
sudo /usr/libexec/ApplicationFirewall/socketfilterfw --add /usr/local/bin/node
sudo /usr/libexec/ApplicationFirewall/socketfilterfw --unblock /usr/local/bin/node
```

---

### **Step 4: Verify Connectivity from Raspberry Pi**

```bash
# SSH into Raspberry Pi
ssh pi@192.168.1.100

# Test 1: Can Pi reach Mac?
ping -c 3 192.168.1.5
# Should see: 64 bytes from 192.168.1.5: icmp_seq=1 ttl=64 time=2.5 ms

# Test 2: Can Pi access gateway?
curl http://192.168.1.5:3000/healthz
# Should see: {"status":"ok"}

# Test 3: Check if port is open
nc -zv 192.168.1.5 3000
# Should see: Connection to 192.168.1.5 3000 port [tcp/*] succeeded!
```

✅ **If all 3 tests pass**: Network is ready!

❌ **If tests fail**: See troubleshooting below.

---

## 🚀 RUN ON RASPBERRY PI

### **Method 1: Interactive Setup (Easiest)**

```bash
# On Raspberry Pi
cd ~/raspberry-pi-device

# Run automated setup
chmod +x setup.sh
./setup.sh

# When prompted, enter your Mac's IP
# Example: 192.168.1.5
```

The script will:
1. Check/install Node.js 18+
2. Install npm dependencies
3. Test connectivity to Mac
4. Verify gateway is reachable

---

### **Method 2: Manual Setup**

```bash
# On Raspberry Pi
cd ~/raspberry-pi-device

# Install Node.js if needed
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs

# Install dependencies
npm install

# Run single test
node device-simulator.js --server http://192.168.1.5:3000 --interval 2000
#                                        ↑
#                              Your Mac's IP address!
```

---

### **Method 3: Environment Variable (Recommended for Scripts)**

```bash
# On Raspberry Pi
cd ~/raspberry-pi-device

# Set Mac IP as environment variable
export GATEWAY_SERVER=http://192.168.1.5:3000

# Run benchmark
SERVER=$GATEWAY_SERVER RUNS=20 node benchmark.js
```

---

## 📊 FULL WORKFLOW EXAMPLE

### **On Mac (Server Side)**

```bash
# ===== Terminal 1: Fabric Network =====
cd /Users/ahmadraza/Downloads/work/Iot_project/fabric-samples/test-network
./network.sh up createChannel -c didchannel -ca
./network.sh deployCC -ccn didregistrycc -ccp ../../test-network/chaincode/didregistrycc -ccl javascript

# ===== Terminal 2: Gateway =====
cd /Users/ahmadraza/Downloads/work/Iot_project/verifier-gateway
PORT=3000 JWT_SECRET=$(openssl rand -hex 32) CLUSTER_WORKERS=1 node server.js

# ===== Terminal 3: Monitor Logs =====
tail -f verifier-gateway/gateway.log
# You'll see requests from Raspberry Pi here!
```

---

### **On Raspberry Pi (Client Side)**

```bash
# ===== Terminal 1: Setup =====
ssh pi@192.168.1.100
cd ~/raspberry-pi-device
./setup.sh
# Enter Mac IP when prompted: 192.168.1.5

# ===== Terminal 2: Run Benchmark =====
SERVER=http://192.168.1.5:3000 RUNS=20 node benchmark.js

# Watch output:
# Run  1/20: ✓ 1234ms
# Run  2/20: ✓ 1189ms
# ...
```

---

### **Back on Mac: Copy Results**

```bash
# After benchmark completes on Pi
scp pi@192.168.1.100:~/raspberry-pi-device/results/*.csv \
  /Users/ahmadraza/Downloads/work/Iot_project/reports/ieee-did-iot/data/

scp pi@192.168.1.100:~/raspberry-pi-device/results/*.txt \
  /Users/ahmadraza/Downloads/work/Iot_project/reports/ieee-did-iot/data/
```

---

## 🔧 TROUBLESHOOTING

### Problem: "No route to host"

**Cause**: Mac firewall blocking connections  
**Solution**:
```bash
# On Mac: Disable firewall
# System Preferences → Security & Privacy → Firewall → Turn Off

# Or allow Node.js:
sudo /usr/libexec/ApplicationFirewall/socketfilterfw --add $(which node)
```

---

### Problem: "ECONNREFUSED"

**Cause**: Gateway not running or wrong port  
**Solution**:
```bash
# On Mac: Check if gateway is running
lsof -i :3000 | grep LISTEN
# Should show: node    12345 user    18u  IPv4 0x... 0t0  TCP *:3000 (LISTEN)

# If not running, start it:
cd /Users/ahmadraza/Downloads/work/Iot_project/verifier-gateway
PORT=3000 JWT_SECRET=$(openssl rand -hex 32) CLUSTER_WORKERS=1 node server.js
```

---

### Problem: "Connection timeout"

**Cause**: Wrong IP address or different networks  
**Solution**:
```bash
# On Mac: Verify IP
ifconfig | grep "inet " | grep -v 127.0.0.1

# On Raspberry Pi: Test ping
ping 192.168.1.5
# If no response, Mac and Pi are on different networks

# Check both devices are on same WiFi/router
```

---

### Problem: Can't SSH into Raspberry Pi

**Cause**: SSH not enabled  
**Solution**:
```bash
# Connect monitor/keyboard to Pi
# Run: sudo raspi-config
# Navigate to: Interface Options → SSH → Enable

# Or create empty file on SD card boot partition:
# Create file named "ssh" (no extension) in /boot/
```

---

### Problem: "Permission denied" when copying

**Cause**: Wrong SSH credentials  
**Solution**:
```bash
# Default credentials:
# Username: pi
# Password: raspberry

# If changed, use your custom credentials
scp -r raspberry-pi-device/ your_username@192.168.1.100:~/
```

---

## 📋 PRE-FLIGHT CHECKLIST

**Before running benchmark, verify:**

**On Mac:**
- [ ] Fabric network running (`docker ps` shows 5+ containers)
- [ ] Gateway running on port 3000 (`lsof -i :3000`)
- [ ] Firewall disabled or Node.js allowed
- [ ] Know Mac's IP address (`ifconfig`)

**On Raspberry Pi:**
- [ ] Folder transferred successfully (`ls ~/raspberry-pi-device`)
- [ ] Node.js 18+ installed (`node --version`)
- [ ] Dependencies installed (`ls node_modules/jsonwebtoken`)
- [ ] Can ping Mac (`ping MAC_IP`)
- [ ] Gateway responds (`curl http://MAC_IP:3000/healthz`)

**Network:**
- [ ] Mac and Pi on same network (same router/WiFi)
- [ ] No VPN running on Mac (can interfere)
- [ ] Router not blocking internal communication

---

## 🎯 QUICK REFERENCE CARD

```bash
# ========== MAC SIDE ==========
# Find Mac IP
ifconfig | grep "inet " | grep -v 127.0.0.1 | head -1

# Start gateway
cd verifier-gateway
PORT=3000 JWT_SECRET=$(openssl rand -hex 32) node server.js

# Transfer folder to Pi
scp -r raspberry-pi-device/ pi@PI_IP:~/

# Copy results back from Pi
scp pi@PI_IP:~/raspberry-pi-device/results/*.csv ./reports/ieee-did-iot/data/


# ========== RASPBERRY PI SIDE ==========
# Find Pi IP
hostname -I

# SSH from Mac
ssh pi@PI_IP

# Setup
cd ~/raspberry-pi-device
./setup.sh

# Run benchmark
SERVER=http://MAC_IP:3000 RUNS=20 node benchmark.js

# View results
cat results/summary-*.txt
```

---

## 💡 NETWORK TIPS

### **Use Ethernet for Best Results**

WiFi adds latency variability. For cleanest measurements:

```bash
# On Raspberry Pi: Connect Ethernet cable
# Mac: Connect Ethernet (if available)

# Both will get new IPs on Ethernet subnet
# Re-check IPs with ifconfig/hostname -I
```

### **Static IP (Optional but Recommended)**

Prevents IP from changing:

```bash
# On Raspberry Pi
sudo nano /etc/dhcpcd.conf

# Add at end:
interface wlan0  # or eth0 for Ethernet
static ip_address=192.168.1.100/24
static routers=192.168.1.1
static domain_name_servers=192.168.1.1 8.8.8.8

# Save and reboot
sudo reboot
```

Now Pi will always be at `192.168.1.100`.

---

## ✅ SUCCESS INDICATORS

**You'll know it's working when:**

1. ✅ SCP transfer completes without errors
2. ✅ `curl http://MAC_IP:3000/healthz` returns `{"status":"ok"}`
3. ✅ device-simulator shows "DID registered successfully"
4. ✅ benchmark shows "✓" checkmarks for each run
5. ✅ Mac gateway logs show incoming POST requests
6. ✅ Results CSV files created in `results/` folder

---

## 🎉 FINAL CHECKLIST

- [ ] Folder transferred to Pi (`scp -r` completed)
- [ ] Node.js installed on Pi (v18+)
- [ ] Dependencies installed (`npm install` done)
- [ ] Mac IP address known (e.g., 192.168.1.5)
- [ ] Gateway running on Mac (port 3000)
- [ ] Firewall not blocking (tested with curl)
- [ ] Network connectivity verified (ping works)
- [ ] Benchmark completed successfully (20 runs)
- [ ] Results copied back to Mac (CSV files)

**If all checked**: You're ready to update your report! 🚀

---

**Summary**: Raspberry Pi acts as **CLIENT**, Mac acts as **SERVER**. Pi makes HTTP requests to Mac's gateway, which talks to Hyperledger Fabric. Simple client-server model over your home network!
