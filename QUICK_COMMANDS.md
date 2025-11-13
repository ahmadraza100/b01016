# Quick Commands - Raspberry Pi Deployment

## Copy to Raspberry Pi (from Mac)

```bash
cd /Users/ahmadraza/Downloads/work/Iot_project
scp -r raspberry-pi-device/ pi@RASPBERRY_PI_IP:~/
```

## On Raspberry Pi

```bash
# SSH into Pi
ssh pi@RASPBERRY_PI_IP

# Install Node.js 18+ (if needed)
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs

# Go to folder
cd ~/raspberry-pi-device

# Install dependencies
npm install

# Run single test (replace MAC_IP with your Mac's IP)
node device-simulator.js --server http://MAC_IP:3000 --interval 2000

# Run benchmark (20 runs, ~1 minute)
SERVER=http://MAC_IP:3000 RUNS=20 node benchmark.js
```

## Get Mac IP Address

```bash
# On Mac terminal
ifconfig | grep "inet " | grep -v 127.0.0.1 | head -1
# Example output: inet 192.168.1.5
```

## Start Gateway on Mac

```bash
cd /Users/ahmadraza/Downloads/work/Iot_project/verifier-gateway
PORT=3000 JWT_SECRET=$(openssl rand -hex 32) CLUSTER_WORKERS=1 node server.js
```

## Copy Results Back to Mac

```bash
# On Mac (after benchmark completes)
scp pi@RASPBERRY_PI_IP:~/raspberry-pi-device/results/*.csv \
  /Users/ahmadraza/Downloads/work/Iot_project/reports/ieee-did-iot/data/
```

## Verify Results

```bash
# On Mac
cat /Users/ahmadraza/Downloads/work/Iot_project/reports/ieee-did-iot/data/rpi-benchmark-*.csv
```
