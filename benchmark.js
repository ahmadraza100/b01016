/*
Performance Benchmark for Raspberry Pi
Measures authentication latency and throughput
*/

const { performance } = require('perf_hooks');
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');

const RUNS = parseInt(process.env.RUNS || '20', 10);
const SERVER = process.env.SERVER || 'http://localhost:3000';
const OUTPUT_DIR = process.env.OUTPUT_DIR || path.join(__dirname, 'results');

async function measureAuthenticationCycle() {
  return new Promise((resolve) => {
    const deviceId = `did:fabric:bench-${Date.now()}-${Math.random().toString(36).slice(2,8)}`;
    const start = performance.now();
    
    exec(
      `node device-simulator.js --server ${SERVER} --did ${deviceId}`,
      { timeout: 10000 },
      (error, stdout, stderr) => {
        const duration = performance.now() - start;
        const success = !error && stdout.includes('DID registered');
        
        resolve({
          duration,
          success,
          deviceId,
          output: stdout.substring(0, 200) // first 200 chars
        });
      }
    );
    
    // Kill after first telemetry to measure just auth cycle
    setTimeout(() => {
      exec(`pkill -f "device-simulator.js.*${deviceId}"`);
    }, 3000);
  });
}

async function runBenchmark() {
  console.log('╔═══════════════════════════════════════════════╗');
  console.log('║   Raspberry Pi DID Authentication Benchmark  ║');
  console.log('╚═══════════════════════════════════════════════╝\n');
  console.log(`Server:        ${SERVER}`);
  console.log(`Runs:          ${RUNS}`);
  console.log(`Architecture:  ${process.arch}`);
  console.log(`Node.js:       ${process.version}`);
  console.log(`Platform:      ${process.platform}\n`);
  console.log('Starting benchmark...\n');

  const results = [];
  const startTime = Date.now();

  for (let i = 1; i <= RUNS; i++) {
    try {
      process.stdout.write(`Run ${i.toString().padStart(2)}/${RUNS}: `);
      
      const result = await measureAuthenticationCycle();
      results.push(result);
      
      if (result.success) {
        console.log(`✓ ${result.duration.toFixed(0)}ms`);
      } else {
        console.log(`✗ FAILED`);
      }
      
      // Delay between runs
      await new Promise(r => setTimeout(r, 2000));
      
    } catch (err) {
      console.log(`✗ ERROR: ${err.message}`);
    }
  }

  const totalTime = ((Date.now() - startTime) / 1000).toFixed(1);

  // Calculate statistics
  const successful = results.filter(r => r.success);
  const latencies = successful.map(r => r.duration);
  
  if (latencies.length === 0) {
    console.error('\n❌ All runs failed. Check gateway connectivity.');
    process.exit(1);
  }

  const mean = latencies.reduce((a, b) => a + b, 0) / latencies.length;
  const sorted = latencies.slice().sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)];
  const p95 = sorted[Math.floor(sorted.length * 0.95)];
  const p99 = sorted[Math.floor(sorted.length * 0.99)] || sorted[sorted.length - 1];
  const min = Math.min(...latencies);
  const max = Math.max(...latencies);
  const stddev = Math.sqrt(
    latencies.reduce((sq, n) => sq + Math.pow(n - mean, 2), 0) / latencies.length
  );

  // Print results
  console.log('\n╔═══════════════════════════════════════════════╗');
  console.log('║              BENCHMARK RESULTS                ║');
  console.log('╚═══════════════════════════════════════════════╝\n');
  console.log(`Total runs:       ${RUNS}`);
  console.log(`Successful:       ${successful.length} (${((successful.length/RUNS)*100).toFixed(1)}%)`);
  console.log(`Total time:       ${totalTime}s\n`);
  
  console.log('Authentication Latency (ms):');
  console.log(`  Mean:           ${mean.toFixed(2)}`);
  console.log(`  Median:         ${median.toFixed(2)}`);
  console.log(`  Std Dev:        ${stddev.toFixed(2)}`);
  console.log(`  Min:            ${min.toFixed(2)}`);
  console.log(`  Max:            ${max.toFixed(2)}`);
  console.log(`  P95:            ${p95.toFixed(2)}`);
  console.log(`  P99:            ${p99.toFixed(2)}\n`);

  // Save to CSV
  try {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
    
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
    const csvFile = path.join(OUTPUT_DIR, `rpi-benchmark-${timestamp}.csv`);
    
    const csvHeader = 'run,latency_ms,success,device_id\n';
    const csvRows = results.map((r, i) => 
      `${i+1},${r.duration.toFixed(2)},${r.success},${r.deviceId}`
    ).join('\n');
    
    fs.writeFileSync(csvFile, csvHeader + csvRows);
    console.log(`Results saved: ${csvFile}\n`);
    
    // Also save summary
    const summaryFile = path.join(OUTPUT_DIR, `summary-${timestamp}.txt`);
    const summary = `
Raspberry Pi DID Authentication Benchmark
==========================================
Date:          ${new Date().toISOString()}
Server:        ${SERVER}
Architecture:  ${process.arch}
Node.js:       ${process.version}
Platform:      ${process.platform}

Results:
--------
Total runs:    ${RUNS}
Successful:    ${successful.length} (${((successful.length/RUNS)*100).toFixed(1)}%)
Total time:    ${totalTime}s

Latency (ms):
  Mean:        ${mean.toFixed(2)}
  Median:      ${median.toFixed(2)}
  Std Dev:     ${stddev.toFixed(2)}
  Min:         ${min.toFixed(2)}
  Max:         ${max.toFixed(2)}
  P95:         ${p95.toFixed(2)}
  P99:         ${p99.toFixed(2)}
`;
    fs.writeFileSync(summaryFile, summary);
    console.log(`Summary saved: ${summaryFile}\n`);
    
  } catch (err) {
    console.error('Failed to save results:', err.message);
  }

  console.log('✓ Benchmark complete!\n');
}

// Run
runBenchmark().catch(err => {
  console.error('Benchmark error:', err);
  process.exit(1);
});
