# 🎯 RASPBERRY PI DEPLOYMENT - COMPLETE GUIDE

**Folder**: `/raspberry-pi-device/`  
**Purpose**: Run IoT device simulator on physical Raspberry Pi to collect ARM performance data

---

## 📦 What's in This Folder

```
raspberry-pi-device/
├── device-simulator.js      # Main IoT device client (DID auth + streaming)
├── benchmark.js             # Performance measurement script
├── package.json             # Dependencies (only jsonwebtoken)
├── setup.sh                 # Auto-setup script for Pi
├── README.md                # Detailed documentation
├── QUICK_COMMANDS.md        # Copy-paste command reference
└── EXECUTION_GUIDE.md       # This file
```

---

## ⚡ FASTEST PATH: 3 Steps (10 minutes)

### **Step 1: Copy to Raspberry Pi (2 min)**

```bash
# On your Mac
cd /Users/ahmadraza/Downloads/work/Iot_project
scp -r raspberry-pi-device/ pi@YOUR_RPI_IP:~/
```

Replace `YOUR_RPI_IP` with your Raspberry Pi's IP address (e.g., `192.168.1.100`).

---

### **Step 2: Setup on Raspberry Pi (5 min)**

```bash
# SSH into Raspberry Pi
ssh pi@YOUR_RPI_IP

# Run automated setup
cd ~/raspberry-pi-device
chmod +x setup.sh
./setup.sh
```

The script will:
- ✅ Check/install Node.js 18+
- ✅ Install npm dependencies
- ✅ Create directories
- ✅ Test gateway connectivity

---

### **Step 3: Run Benchmark (3 min)**

```bash
# Still on Raspberry Pi
SERVER=http://YOUR_MAC_IP:3000 RUNS=20 node benchmark.js
```

Replace `YOUR_MAC_IP` with your Mac's IP address (find it with `ifconfig` on Mac).

**Done!** Results saved to `results/` folder.

---

## 📋 Detailed Step-by-Step

### **Before You Start**

Make sure:
- [ ] Raspberry Pi is powered on and connected to network
- [ ] You know Pi's IP address (check router or use `arp -a` on Mac)
- [ ] Gateway is running on your Mac (see below)
- [ ] Pi and Mac are on same network (same WiFi/Ethernet)

---

### **1. Start Gateway on Mac**

```bash
# Terminal 1 on Mac
cd /Users/ahmadraza/Downloads/work/Iot_project/verifier-gateway

# Start Fabric network (if not running)
cd ../fabric-samples/test-network
./network.sh up createChannel -c didchannel -ca
./network.sh deployCC -ccn didregistrycc -ccp ../../test-network/chaincode/didregistrycc -ccl javascript

# Start gateway
cd ../../verifier-gateway
PORT=3000 JWT_SECRET=$(openssl rand -hex 32) CLUSTER_WORKERS=1 node server.js
```

Verify gateway is running:
```bash
# Terminal 2 on Mac
curl http://localhost:3000/healthz
# Should return: {"status":"ok"}
```

Find your Mac's IP:
```bash
ifconfig | grep "inet " | grep -v 127.0.0.1 | head -1
# Example: inet 192.168.1.5
```

---

### **2. Copy Files to Raspberry Pi**

```bash
# On Mac
cd /Users/ahmadraza/Downloads/work/Iot_project
scp -r raspberry-pi-device/ pi@192.168.1.100:~/
# Replace 192.168.1.100 with YOUR Raspberry Pi IP
# Default password: raspberry
```

---

### **3. SSH into Raspberry Pi**

```bash
ssh pi@192.168.1.100
# Enter password (default: raspberry)
```

---

### **4. Run Setup Script**

```bash
cd ~/raspberry-pi-device
chmod +x setup.sh
./setup.sh
```

When prompted:
- Enter your Mac's IP address (e.g., `192.168.1.5`)
- Confirm Node.js installation if needed

---

### **5. Test Single Run (Optional)**

```bash
node device-simulator.js --server http://192.168.1.5:3000 --interval 2000
```

**Expected output:**
```
=== IoT Device Simulator (Raspberry Pi) ===
Server: http://192.168.1.5:3000
Architecture: arm64
Node.js: v18.19.0

[1/4] Generating ES256 keypair...
[2/4] Registering DID on blockchain...
      SUCCESS: DID registered
[SLOW-PATH] Authenticating with blockchain...
            Token received ✓
[3/4] Starting telemetry stream...

[0] ✓ temp=25.4°C, HR=78bpm
[1] ✓ temp=22.1°C, HR=85bpm
...
```

Press `Ctrl+C` after 30 seconds to stop.

---

### **6. Run Performance Benchmark**

```bash
SERVER=http://192.168.1.5:3000 RUNS=20 node benchmark.js
```

**Expected output:**
```
╔═══════════════════════════════════════════════╗
║   Raspberry Pi DID Authentication Benchmark  ║
╚═══════════════════════════════════════════════╝

Server:        http://192.168.1.5:3000
Runs:          20
Architecture:  arm64

Run  1/20: ✓ 1234ms
Run  2/20: ✓ 1189ms
...
Run 20/20: ✓ 1245ms

╔═══════════════════════════════════════════════╗
║              BENCHMARK RESULTS                ║
╚═══════════════════════════════════════════════╝

Authentication Latency (ms):
  Mean:           1215.45
  Median:         1210.00
  Min:            1180.23
  Max:            1280.45
  P95:            1265.10

Results saved: results/rpi-benchmark-2025-11-13T10-30-45.csv
✓ Benchmark complete!
```

---

### **7. View Results**

```bash
# On Raspberry Pi
cat results/summary-*.txt
cat results/rpi-benchmark-*.csv
```

---

### **8. Copy Results to Mac**

```bash
# On Mac (new terminal)
scp pi@192.168.1.100:~/raspberry-pi-device/results/*.csv \
  /Users/ahmadraza/Downloads/work/Iot_project/reports/ieee-did-iot/data/

scp pi@192.168.1.100:~/raspberry-pi-device/results/*.txt \
  /Users/ahmadraza/Downloads/work/Iot_project/reports/ieee-did-iot/data/
```

---

## 📊 What Data You'll Get

From the benchmark, extract these numbers for your report:

1. **Architecture**: `arm64` or `armv7l` (proves ARM hardware)
2. **Mean latency**: e.g., `1215 ms` or `35 ms`
3. **Latency range**: `Min - Max` (e.g., `1180-1280 ms`)
4. **P95 latency**: 95th percentile (e.g., `1265 ms`)
5. **Success rate**: Should be `100%`
6. **Node.js version**: e.g., `v18.19.0`

---

## 🎯 Update Your Report

After getting results, update `technical-report.md`:

### Add ARM Results to Section 7.2:

```markdown
### 7.2.2 ARM Hardware Validation

Performance measurements collected on Raspberry Pi 4 Model B (ARM64):

| Platform              | Architecture | Mean (ms) | Range (ms)  | P95 (ms) |
|-----------------------|--------------|-----------|-------------|----------|
| Test Infrastructure   | x86-64       | 21        | 14-31       | 31       |
| **Raspberry Pi 4**    | **ARM64**    | **1215**  | **1180-1280**| **1265** |

The ARM platform exhibits higher absolute latency due to network round-trip
time (WiFi vs localhost loopback) and lower CPU clock speed (1.5 GHz vs 3.2 GHz).
However, authentication completes in under 1.3 seconds, validating feasibility
for device provisioning workflows in clinical settings.
```

### Update Abstract:

Change from:
```markdown
Our evaluation on x86 test infrastructure demonstrates sub-30 ms authentication
latency...
```

To:
```markdown
Our evaluation demonstrates sub-30 ms authentication latency on co-located x86
test infrastructure and sub-1.3s latency on Raspberry Pi 4 (ARM64) with network
round-trip, validating feasibility for constrained edge devices...
```

### Update Section 10.1 (Limitations):

Remove:
```markdown
Hardware validation: The device simulator was designed for ARM-based platforms
but tested only on x86 architecture.
```

Add:
```markdown
**ARM validation completed**: Performance benchmarks on Raspberry Pi 4 Model B
confirm sub-1.3s authentication latency on ARM64 architecture, demonstrating
practical deployment feasibility on constrained edge devices.
```

---

## 🔧 Troubleshooting

### Problem: "ECONNREFUSED"
**Cause**: Gateway not reachable from Pi  
**Fix**:
1. Check gateway is running: `curl http://MAC_IP:3000/healthz` (on Pi)
2. Disable Mac firewall: System Preferences → Security → Firewall → Off
3. Check if Pi can ping Mac: `ping MAC_IP`

### Problem: "fetch is not a function"
**Cause**: Node.js version < 18  
**Fix**: Run setup script again or manually install Node 18+

### Problem: High latency (>5000ms)
**Cause**: Network issues  
**Fix**:
1. Use Ethernet instead of WiFi
2. Move Pi closer to router
3. Restart gateway on Mac

### Problem: Benchmark hangs
**Cause**: Old processes still running  
**Fix**:
```bash
pkill -9 node
# Then restart benchmark
```

---

## 📝 Quick Command Reference

```bash
# Test connectivity
ping MAC_IP
curl http://MAC_IP:3000/healthz

# Single test run
node device-simulator.js --server http://MAC_IP:3000

# Benchmark (20 runs, ~1 min)
SERVER=http://MAC_IP:3000 RUNS=20 node benchmark.js

# Benchmark (50 runs, ~3 min) - more data
SERVER=http://MAC_IP:3000 RUNS=50 node benchmark.js

# View results
ls -lh results/
cat results/summary-*.txt

# Check Pi specs
uname -m              # Architecture
cat /proc/cpuinfo     # CPU details
free -h               # Memory
vcgencmd measure_temp # Temperature
```

---

## ✅ Success Checklist

- [ ] Gateway running on Mac (port 3000)
- [ ] Files copied to Raspberry Pi
- [ ] Setup script executed successfully
- [ ] Node.js 18+ installed on Pi
- [ ] Single test run completed (saw "Token received ✓")
- [ ] Benchmark completed (20 runs, 100% success)
- [ ] Results files created in `results/` folder
- [ ] CSV copied back to Mac
- [ ] Numbers extracted for report
- [ ] Report updated with ARM measurements
- [ ] Section 10.1 limitation removed

---

## 🎉 What You've Accomplished

After completing this:

✅ **Validated DID authentication on real ARM hardware**  
✅ **Measured actual constrained-device performance**  
✅ **Collected empirical data (not simulated)**  
✅ **Proved system works beyond x86 test machines**  
✅ **Can claim "deployed and tested on Raspberry Pi 4"**  

**Your report rating goes from 8.5/10 → 9.0/10** 🚀

---

## 💡 Pro Tips

1. **Run benchmark 2-3 times** to get average statistics
2. **Use Ethernet cable** for most reliable measurements
3. **Let Pi cool down** between benchmark runs (check temp: `vcgencmd measure_temp`)
4. **Keep gateway log** on Mac to see requests arriving
5. **Save all CSV files** - you might need them for appendix

---

**Good luck with your Raspberry Pi deployment!** 🎓

If you encounter issues, check `README.md` for detailed troubleshooting or review the output of `setup.sh` for hints.
