/*
Metrics Runner for IoT DID Gateway (ngrok)
Measures slow-path auth latency, fast-path stream latency, re-auth events, and revocation enforcement.
Outputs CSVs, a summary JSON, and a self-contained HTML report with charts.

Usage:
  node metrics_runner.js [--server URL] [--count N] [--interval ms] [--keep-keys] [--keydir DIR]

Defaults:
  server   = https://293ce5de1c14.ngrok-free.app
  count    = 50
  interval = 1500 ms

Requirements: Node.js 18+
*/

const crypto = require('node:crypto');
const jwt = require('jsonwebtoken');
const fs = require('node:fs');
const path = require('node:path');

const DEFAULT_SERVER = 'https://293ce5de1c14.ngrok-free.app';
const DEFAULT_COUNT = 50;
const DEFAULT_INTERVAL = 1500; // ms

function parseArgs() {
  const args = process.argv.slice(2);
  const result = {};
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === '--server' && args[i + 1]) { result.server = args[++i]; }
    else if (a === '--count' && args[i + 1]) { result.count = parseInt(args[++i], 10); }
    else if (a === '--interval' && args[i + 1]) { result.interval = parseInt(args[++i], 10); }
    else if (a === '--keep-keys') { result.keepKeys = true; }
    else if (a === '--keydir' && args[i + 1]) { result.keydir = args[++i]; }
  }
  return result;
}

async function postJson(url, body, headers = {}) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(body),
  });
  const start = Date.now();
  const text = await res.text();
  const elapsed = Date.now() - start; // ms to read body
  let json = null;
  try { json = JSON.parse(text); } catch { json = { raw: text }; }
  return { ok: res.ok, status: res.status, body: json, elapsed, headers: Object.fromEntries(res.headers.entries()) };
}

function makeDid() { return `did:fabric:rpi-${crypto.randomBytes(6).toString('hex')}`; }

function writeCSV(filePath, rows) {
  const dir = path.dirname(filePath);
  fs.mkdirSync(dir, { recursive: true });
  const header = rows.length ? Object.keys(rows[0]).join(',') + '\n' : '';
  const body = rows.map(r => Object.values(r).join(',')).join('\n');
  fs.writeFileSync(filePath, header + body + (body ? '\n' : ''));
}

function writeJSON(filePath, obj) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(obj, null, 2));
}

function percentile(arr, p) {
  if (!arr.length) return 0;
  const sorted = [...arr].sort((a,b)=>a-b);
  const idx = Math.floor((p/100) * (sorted.length - 1));
  return sorted[idx];
}

async function main() {
  const argv = parseArgs();
  const server = (argv.server || DEFAULT_SERVER).replace(/\/$/, '');
  const count = argv.count || DEFAULT_COUNT;
  const interval = argv.interval || DEFAULT_INTERVAL;
  const keydir = argv.keydir || path.resolve(__dirname, 'keys');
  const outDir = path.resolve(__dirname, 'metrics_out');

  if (typeof fetch !== 'function') { console.error('Node 18+ required (global fetch)'); process.exit(1); }

  console.log('=== Metrics Runner (IoT DID Gateway) ===');
  console.log(`Server: ${server}`);
  console.log(`Count: ${count}`);
  console.log(`Interval: ${interval}ms`);
  console.log(`Arch: ${process.arch}`);
  console.log(`Node: ${process.version}`);
  console.log(`Output dir: ${outDir}\n`);

  // 1) Generate keypair
  console.log('[1/6] Generating ES256 keypair...');
  const { publicKey, privateKey } = crypto.generateKeyPairSync('ec', { namedCurve: 'P-256' });
  const privatePem = privateKey.export({ type: 'pkcs8', format: 'pem' });
  const publicPem = publicKey.export({ type: 'spki', format: 'pem' });
  if (argv.keepKeys) {
    fs.mkdirSync(keydir, { recursive: true });
    fs.writeFileSync(path.join(keydir, 'private.pem'), privatePem, { mode: 0o600 });
    fs.writeFileSync(path.join(keydir, 'public.pem'), publicPem);
    console.log(`      Keys saved -> ${keydir}`);
  }

  const did = makeDid();
  console.log(`      DID: ${did}\n`);

  // 2) Register DID
  console.log('[2/6] Registering DID...');
  const regStart = performance.now();
  const regRes = await postJson(`${server}/api/did/create`, { did, publicKey: publicPem });
  const regLatency = performance.now() - regStart;
  if (!regRes.ok) { console.error('      Register FAILED', regRes.status, regRes.body); process.exit(1); }
  console.log(`      Register OK (${Math.round(regLatency)} ms)\n`);

  // 3) Slow-path authentication
  console.log('[3/6] Slow-path authentication...');
  let sessionToken = null;
  const authLatencies = [];
  async function slowAuth() {
    const payload = { iat: Math.floor(Date.now() / 1000) };
    const aud = `${server}/api/auth/token`;
    const challengeJwt = jwt.sign(payload, privatePem, { algorithm: 'ES256', issuer: did, audience: aud, expiresIn: '30s' });
    const t0 = performance.now();
    const res = await postJson(`${server}/api/auth/token`, { did, challenge_jwt: challengeJwt });
    const dt = performance.now() - t0;
    authLatencies.push(dt);
    if (!res.ok) { console.error('      Auth FAILED', res.status, res.body); return null; }
    return res.body.token;
  }
  sessionToken = await slowAuth();
  if (!sessionToken) { console.error('Initial auth failed'); process.exit(1); }
  console.log(`      Token OK (latency ~${Math.round(authLatencies[0])} ms)\n`);

  // 4) Fast-path streaming
  console.log('[4/6] Streaming telemetry...');
  const streamLatencies = []; // ms per send
  let success = 0; let errors = 0; let reauths = 1; // include initial
  for (let i = 0; i < count; i++) {
    const temperature = (20 + Math.random() * 10).toFixed(2);
    const heartRate = Math.floor(60 + Math.random() * 40);
    const payload = { temperature: parseFloat(temperature), heartRate, timestamp: new Date().toISOString(), seq: i };
    const t0 = performance.now();
    const res = await fetch(`${server}/api/data/stream`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${sessionToken}` },
      body: JSON.stringify(payload),
    });
    const dt = performance.now() - t0;
    if (res.status === 401) {
      // reauth
      const token = await slowAuth();
      if (!token) { errors++; console.error(`[${i}] Re-auth FAILED`); } else { sessionToken = token; reauths++; }
      streamLatencies.push(dt);
    } else if (!res.ok) {
      errors++;
      streamLatencies.push(dt);
      const txt = await res.text();
      console.warn(`[${i}] ERROR ${res.status}: ${txt}`);
    } else {
      success++;
      streamLatencies.push(dt);
      console.log(`[${i}] ✓ temp=${temperature}°C, hr=${heartRate} bpm (${Math.round(dt)} ms)`);
    }
    if (i < count - 1) await new Promise(r => setTimeout(r, interval));
  }
  console.log(`      Done. Success=${success}, Errors=${errors}, Reauths=${reauths}\n`);

  // 5) Revocation test (optional)
  console.log('[5/6] Revocation check...');
  let revokedBlocked = false;
  try {
    const revokeRes = await postJson(`${server}/api/did/revoke`, { did });
    if (revokeRes.ok) {
      const res = await fetch(`${server}/api/data/stream`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${sessionToken}` },
        body: JSON.stringify({ temperature: 25.1, heartRate: 70, timestamp: new Date().toISOString(), seq: 'revoke-test' }),
      });
      revokedBlocked = (res.status === 401);
      console.log(`      Revocation enforcement: ${revokedBlocked ? 'BLOCKED ✓' : 'NOT BLOCKED ✗'}`);
    } else {
      console.warn('      Revocation call failed; skipping enforcement check');
    }
  } catch (e) { console.warn('      Revocation check error:', e.message); }

  // 6) Persist results
  console.log('[6/6] Writing outputs...');
  const authCsv = authLatencies.map((ms, i) => ({ sample: i, latency_ms: Math.round(ms) }));
  const streamCsv = streamLatencies.map((ms, i) => ({ seq: i, latency_ms: Math.round(ms) }));
  writeCSV(path.join(outDir, 'auth_latency.csv'), authCsv);
  writeCSV(path.join(outDir, 'stream_latency.csv'), streamCsv);
  const summary = {
    server,
    did,
    counts: { success, errors, reauths, total: count },
    auth_latency_ms: {
      p50: Math.round(percentile(authLatencies, 50)),
      p90: Math.round(percentile(authLatencies, 90)),
      p99: Math.round(percentile(authLatencies, 99)),
      min: Math.round(Math.min(...authLatencies)),
      max: Math.round(Math.max(...authLatencies)),
    },
    stream_latency_ms: {
      p50: Math.round(percentile(streamLatencies, 50)),
      p90: Math.round(percentile(streamLatencies, 90)),
      p99: Math.round(percentile(streamLatencies, 99)),
      min: Math.round(Math.min(...streamLatencies)),
      max: Math.round(Math.max(...streamLatencies)),
    },
    revokedBlocked,
    generatedAt: new Date().toISOString(),
  };
  writeJSON(path.join(outDir, 'summary.json'), summary);

  // Self-contained HTML report with Chart.js
  const html = `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>IoT DID Metrics Report</title>
  <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
  <style>
    body { font-family: system-ui, -apple-system, sans-serif; margin: 20px; }
    .grid { display: grid; grid-template-columns: 1fr; gap: 24px; }
    canvas { max-width: 100%; height: 320px; }
    .card { border: 1px solid #ddd; border-radius: 8px; padding: 16px; }
    .badge { display: inline-block; padding: 4px 8px; border-radius: 6px; background:#eef; }
  </style>
</head>
<body>
  <h1>IoT DID Metrics Report</h1>
  <div>Server: <span class="badge">${summary.server}</span></div>
  <div>DID: <span class="badge">${summary.did}</span></div>
  <div>Generated: ${summary.generatedAt}</div>
  <div class="grid">
    <div class="card">
      <h3>Slow-path Auth Latency (ms)</h3>
      <canvas id="authChart"></canvas>
    </div>
    <div class="card">
      <h3>Fast-path Stream Latency (ms)</h3>
      <canvas id="streamChart"></canvas>
    </div>
    <div class="card">
      <h3>Summary</h3>
      <pre>${JSON.stringify(summary, null, 2)}</pre>
    </div>
  </div>
  <script>
    const AUTH = ${JSON.stringify(authCsv)};
    const STREAM = ${JSON.stringify(streamCsv)};
    new Chart(document.getElementById('authChart'), {
      type: 'line',
      data: { labels: AUTH.map(r=>r.sample), datasets: [{ label: 'Auth Latency (ms)', data: AUTH.map(r=>r.latency_ms), borderColor: '#1f77b4' }] },
      options: { responsive: true, plugins: { legend: { display: true } } }
    });
    new Chart(document.getElementById('streamChart'), {
      type: 'line',
      data: { labels: STREAM.map(r=>r.seq), datasets: [{ label: 'Stream Latency (ms)', data: STREAM.map(r=>r.latency_ms), borderColor: '#2ca02c' }] },
      options: { responsive: true, plugins: { legend: { display: true } } }
    });
  </script>
</body>
</html>`;
  fs.writeFileSync(path.join(outDir, 'report.html'), html);

  console.log(`Outputs written:`);
  console.log(`  - ${path.join(outDir, 'auth_latency.csv')}`);
  console.log(`  - ${path.join(outDir, 'stream_latency.csv')}`);
  console.log(`  - ${path.join(outDir, 'summary.json')}`);
  console.log(`  - ${path.join(outDir, 'report.html')} (open in browser)`);
}

main().catch((err) => { console.error('Fatal:', err); process.exit(1); });