/*
IoT Device Simulator for Raspberry Pi
Performs DID-based authentication with Verifier Gateway

Usage:
  node device-simulator.js --server http://GATEWAY_IP:3000 --interval 2000

Requirements: Node.js 18+
*/

const crypto = require('node:crypto');
const jwt = require('jsonwebtoken');
const fs = require('node:fs');
const path = require('node:path');

const DEFAULT_SERVER = 'http://localhost:3000';
const DEFAULT_INTERVAL = 2000; // ms

function parseArgs() {
  const args = process.argv.slice(2);
  const result = {};
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === '--server' && args[i + 1]) { result.server = args[++i]; }
    else if (a === '--did' && args[i + 1]) { result.did = args[++i]; }
    else if (a === '--interval' && args[i + 1]) { result.interval = parseInt(args[++i], 10); }
    else if (a === '--keep-keys') { result.keepKeys = true; }
    else if (a === '--keydir' && args[i + 1]) { result.keydir = args[++i]; }
  }
  return result;
}

async function postJson(url, body) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch (e) { json = { raw: text }; }
  return { ok: res.ok, status: res.status, body: json };
}

function makeDid() {
  return `did:fabric:rpi-${crypto.randomBytes(6).toString('hex')}`;
}

async function main() {
  const argv = parseArgs();
  const server = argv.server || DEFAULT_SERVER;
  const interval = argv.interval || DEFAULT_INTERVAL;
  const keydir = argv.keydir || path.resolve(__dirname, 'keys');

  // Check Node 18+
  if (typeof fetch !== 'function') {
    console.error('ERROR: Global fetch() not available. Please use Node.js 18+');
    process.exit(1);
  }

  console.log('=== IoT Device Simulator (Raspberry Pi) ===');
  console.log(`Server: ${server}`);
  console.log(`Interval: ${interval}ms`);
  console.log(`Architecture: ${process.arch}`);
  console.log(`Node.js: ${process.version}\n`);

  // 1) Generate keypair
  console.log('[1/4] Generating ES256 keypair...');
  const { publicKey, privateKey } = crypto.generateKeyPairSync('ec', { namedCurve: 'P-256' });
  const privatePem = privateKey.export({ type: 'pkcs8', format: 'pem' });
  const publicPem = publicKey.export({ type: 'spki', format: 'pem' });

  if (argv.keepKeys) {
    try { fs.mkdirSync(keydir, { recursive: true }); } catch (e) {/* ignore */}
    fs.writeFileSync(path.join(keydir, 'private.pem'), privatePem, { mode: 0o600 });
    fs.writeFileSync(path.join(keydir, 'public.pem'), publicPem);
    console.log(`      Keys saved to ${keydir}/`);
  }

  const did = argv.did || makeDid();
  console.log(`      DID: ${did}\n`);

  // 2) Register DID
  console.log('[2/4] Registering DID on blockchain...');
  const regResult = await postJson(`${server}/api/did/create`, { did, publicKey: publicPem });
  if (!regResult.ok) {
    console.error(`      FAILED: ${regResult.status}`, regResult.body);
    process.exit(1);
  }
  console.log(`      SUCCESS: DID registered\n`);

  // 3) Slow-path authentication
  async function slowPathAuth() {
    console.log('[SLOW-PATH] Authenticating with blockchain...');

    const payload = { iat: Math.floor(Date.now() / 1000) };
    const aud = `${server.replace(/\/$/, '')}/api/auth/token`;

    const challengeJwt = jwt.sign(payload, privatePem, {
      algorithm: 'ES256',
      issuer: did,
      audience: aud,
      expiresIn: '30s',
    });

    const tokenRes = await postJson(`${server}/api/auth/token`, { did, challenge_jwt: challengeJwt });
    if (!tokenRes.ok) {
      console.error('            Authentication failed:', tokenRes.status, tokenRes.body);
      return null;
    }
    console.log('            Token received ✓');
    return tokenRes.body.token;
  }

  let sessionToken = await slowPathAuth();
  if (!sessionToken) {
    console.error('Initial authentication failed. Exiting.');
    process.exit(1);
  }

  // 4) Fast-path streaming
  console.log('\n[3/4] Starting telemetry stream (fast-path)...');
  console.log('      Press Ctrl+C to stop\n');
  
  let count = 0;
  let successCount = 0;
  let slowPathCount = 1; // initial auth

  async function sendTelemetry() {
    const temperature = (20 + Math.random() * 10).toFixed(2);
    const heartRate = Math.floor(60 + Math.random() * 40);
    const payload = { 
      temperature: parseFloat(temperature), 
      heartRate,
      timestamp: new Date().toISOString(),
      count 
    };
    
    const res = await fetch(`${server}/api/data/stream`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json', 
        Authorization: `Bearer ${sessionToken}` 
      },
      body: JSON.stringify(payload),
    });
    
    if (res.status === 401) {
      console.warn(`[${count}] Token expired, re-authenticating...`);
      sessionToken = await slowPathAuth();
      slowPathCount++;
      if (!sessionToken) {
        console.error('Re-authentication failed. Stopping.');
        process.exit(1);
      }
      return;
    }
    
    if (!res.ok) {
      const txt = await res.text();
      console.warn(`[${count}] ERROR ${res.status}: ${txt}`);
      return;
    }
    
    successCount++;
    console.log(`[${count}] ✓ temp=${temperature}°C, HR=${heartRate}bpm`);
    count++;
  }

  const timer = setInterval(() => {
    sendTelemetry().catch((e) => console.error('Send error:', e.message));
  }, interval);

  process.on('SIGINT', () => {
    clearInterval(timer);
    console.log('\n\n=== Session Summary ===');
    console.log(`Total requests: ${count}`);
    console.log(`Successful: ${successCount}`);
    console.log(`Slow-path auths: ${slowPathCount}`);
    console.log(`Success rate: ${((successCount/count)*100).toFixed(1)}%`);
    console.log('\nStopped.');
    process.exit(0);
  });
}

main().catch((err) => { 
  console.error('Fatal error:', err); 
  process.exit(1); 
});
