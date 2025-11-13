# Raspberry Pi Device - Quick Start Guide

This folder contains everything needed to run the IoT device simulator on your Raspberry Pi.

---

## 📦 What's Included

- `device-simulator.js` - Main IoT device client (DID authentication + telemetry streaming)
- `benchmark.js` - Performance measurement script
- `package.json` - Node.js dependencies
- `README.md` - This file

---

## 🚀 Step-by-Step Setup

### **1. Copy Folder to Raspberry Pi**

From your Mac:

```bash
# Option A: SCP (easiest)
cd /Users/ahmadraza/Downloads/work/Iot_project
scp -r raspberry-pi-device/ pi@RASPBERRY_PI_IP:~/

# Option B: USB drive
# Copy folder to USB, plug into Pi, then:
# cp -r /media/usb/raspberry-pi-device ~/
```

---

### **2. SSH into Raspberry Pi**

```bash
ssh pi@RASPBERRY_PI_IP
# Default password: raspberry
```

---

### **3. Install Node.js 18+ (if not already installed)**

```bash
# Check current version
node --version

# If not installed or < v18, install:
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs

# Verify
node --version  # Should show v18.x or v20.x
```

---

### **4. Install Dependencies**

```bash
cd ~/raspberry-pi-device
npm install
```

This installs `jsonwebtoken` (only dependency).

---

### **5. Start Gateway on Your Mac**

Keep your Mac running the gateway:

```bash
# On your Mac terminal
cd /Users/ahmadraza/Downloads/work/Iot_project/verifier-gateway
PORT=3000 JWT_SECRET=$(openssl rand -hex 32) CLUSTER_WORKERS=1 node server.js
```

Find your Mac's IP address:

```bash
# On Mac
ifconfig | grep "inet " | grep -v 127.0.0.1 | head -1
# Example output: inet 192.168.1.5
```

---

### **6. Run Device Simulator on Raspberry Pi**

```bash
# On Raspberry Pi
cd ~/raspberry-pi-device

# Replace 192.168.1.5 with YOUR Mac's IP address
node device-simulator.js --server http://192.168.1.5:3000 --interval 2000
```

**Expected Output:**

```
=== IoT Device Simulator (Raspberry Pi) ===
Server: http://192.168.1.5:3000
Interval: 2000ms
Architecture: arm64
Node.js: v18.19.0

[1/4] Generating ES256 keypair...
      DID: did:fabric:rpi-a3f2e8

[2/4] Registering DID on blockchain...
      SUCCESS: DID registered

[SLOW-PATH] Authenticating with blockchain...
            Token received ✓

[3/4] Starting telemetry stream (fast-path)...
      Press Ctrl+C to stop

[0] ✓ temp=25.4°C, HR=78bpm
[1] ✓ temp=22.1°C, HR=85bpm
[2] ✓ temp=28.9°C, HR=92bpm
...
```

Let it run for 60 seconds, then press `Ctrl+C`.

**Session Summary will show:**

```
=== Session Summary ===
Total requests: 30
Successful: 30
Slow-path auths: 1
Success rate: 100.0%

Stopped.
```

---

## 📊 Run Performance Benchmark

To collect precise latency measurements:

```bash
cd ~/raspberry-pi-device

# Run 20 authentication cycles
SERVER=http://192.168.1.5:3000 RUNS=20 node benchmark.js
```

**Output:**

```
╔═══════════════════════════════════════════════╗
║   Raspberry Pi DID Authentication Benchmark  ║
╚═══════════════════════════════════════════════╝

Server:        http://192.168.1.5:3000
Runs:          20
Architecture:  arm64
Node.js:       v18.19.0
Platform:      linux

Starting benchmark...

Run  1/20: ✓ 1234ms
Run  2/20: ✓ 1189ms
Run  3/20: ✓ 1201ms
...
Run 20/20: ✓ 1245ms

╔═══════════════════════════════════════════════╗
║              BENCHMARK RESULTS                ║
╚═══════════════════════════════════════════════╝

Total runs:       20
Successful:       20 (100.0%)
Total time:       48.3s

Authentication Latency (ms):
  Mean:           1215.45
  Median:         1210.00
  Std Dev:        28.34
  Min:            1180.23
  Max:            1280.45
  P95:            1265.10
  P99:            1280.45

Results saved: results/rpi-benchmark-2025-11-13T10-30-45.csv
Summary saved: results/summary-2025-11-13T10-30-45.txt

✓ Benchmark complete!
```

---

## 📥 Copy Results Back to Mac

```bash
# On your Mac
scp pi@RASPBERRY_PI_IP:~/raspberry-pi-device/results/*.csv \
  /Users/ahmadraza/Downloads/work/Iot_project/reports/ieee-did-iot/data/

scp pi@RASPBERRY_PI_IP:~/raspberry-pi-device/results/*.txt \
  /Users/ahmadraza/Downloads/work/Iot_project/reports/ieee-did-iot/data/
```

---

## 🎯 What to Extract for Report

From the benchmark results, note these numbers:

1. **Architecture**: `arm64` (proves it's ARM)
2. **Mean latency**: e.g., `1215 ms` or `35 ms` (depends on network)
3. **Range**: `Min - Max` (e.g., `1180 - 1280 ms`)
4. **P95 latency**: e.g., `1265 ms`
5. **Success rate**: Should be `100%`

Update your report:

```markdown
### 7.2.2 ARM Hardware Validation

Performance measurements on Raspberry Pi 4 Model B (ARM64):

| Platform           | Architecture | Mean (ms) | Range (ms)    | P95 (ms) |
|--------------------|--------------|-----------|---------------|----------|
| Test Infrastructure| x86-64       | 21        | 14-31         | 31       |
| Raspberry Pi 4     | ARM64        | 1215      | 1180-1280     | 1265     |

ARM platform exhibits higher latency due to:
- Lower clock speed (1.5 GHz vs 3.2 GHz)
- Network round-trip time (WiFi vs localhost)
- Constrained memory bandwidth

However, performance remains within acceptable bounds for device provisioning
(sub-2000ms authentication cycle).
```

---

## 🔧 Troubleshooting

### Problem: "ECONNREFUSED"

**Solution:**
- Check gateway is running on Mac: `curl http://MAC_IP:3000/healthz`
- Disable Mac firewall temporarily: System Preferences → Security → Firewall
- Verify Pi can ping Mac: `ping MAC_IP`

### Problem: "fetch is not a function"

**Solution:**
- Node.js version too old
- Upgrade: `curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash - && sudo apt install -y nodejs`

### Problem: Benchmark hangs

**Solution:**
- Check if old processes running: `ps aux | grep node`
- Kill them: `pkill -9 node`
- Restart benchmark

### Problem: High latency (>5000ms)

**Solution:**
- WiFi interference - use Ethernet cable
- Gateway overloaded - restart gateway
- Check Fabric network: `docker ps` on Mac

---

## 📋 Quick Command Reference

```bash
# Test single authentication
node device-simulator.js --server http://MAC_IP:3000 --interval 2000

# Run benchmark (20 runs)
SERVER=http://MAC_IP:3000 RUNS=20 node benchmark.js

# Run benchmark (50 runs for more data)
SERVER=http://MAC_IP:3000 RUNS=50 node benchmark.js

# Keep keys for debugging
node device-simulator.js --server http://MAC_IP:3000 --keep-keys

# Check saved keys
ls -la keys/
```

---

## 🎓 What You've Accomplished

After running this on Raspberry Pi:

✅ Validated DID authentication on real ARM hardware  
✅ Measured actual constrained-device performance  
✅ Collected empirical latency data for report  
✅ Proved system works beyond x86 test infrastructure  
✅ Demonstrated edge device deployment feasibility  

**Your report can now claim:**
- "Validated on Raspberry Pi 4 (ARM64 architecture)"
- "Measured authentication latency: X ms on ARM vs Y ms on x86"
- "Demonstrated feasibility for edge device deployment"

---

## 🚀 Next Steps

1. Run benchmark with `RUNS=30` for robust statistics
2. Copy CSV results back to Mac
3. Update report Section 7.2 with ARM measurements
4. Regenerate comparison figures (x86 vs ARM)
5. Remove "not validated on hardware" limitation from Section 10.1

**Good luck!** 🎉
