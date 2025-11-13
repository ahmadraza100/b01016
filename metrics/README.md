# Metrics Runner

Collects real metrics from your IoT DID gateway via ngrok and produces CSVs, a summary JSON, and a self-contained HTML report with charts.

## Usage

```sh
node metrics_runner.js --server https://293ce5de1c14.ngrok-free.app --count 100 --interval 1500
```

Options:
- `--server`    Gateway URL (default: your ngrok link)
- `--count`     Number of telemetry sends (default 50)
- `--interval`  Milliseconds between sends (default 1500)
- `--keep-keys` Persist generated keypair to `keys/`
- `--keydir`    Custom key directory

## Outputs
- `metrics_out/auth_latency.csv`
- `metrics_out/stream_latency.csv`
- `metrics_out/summary.json`
- `metrics_out/report.html` (open in browser)

## Notes
- Requires Node.js 18+ (for global `fetch`).
- Revocation enforcement is validated by calling `/api/did/revoke` and then attempting a fast-path send with the same session token; expected 401.
