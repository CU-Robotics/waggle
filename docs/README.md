# Waggle

Waggle is the CU Robotics telemetry service: a Rust/Axum backend that buffers incoming telemetry frames and a React (Vite) dashboard that renders them in the browser. Producers POST JSON batches to `/batch`; connected clients receive live updates over `/ws`.

## Prerequisites
- Rust toolchain via [`rustup`](https://rustup.rs/).
- Node.js 20+ and npm. You can install Node with `./tools/install.sh` on Ubuntu-based hosts.
- Python 3 if you plan to use the replay/export utilities in `tools/`.

## Quick Start
```bash
# Install frontend dependencies and build the production bundle
npm install --prefix client
npm run build --prefix client

# Run the backend (serves the built dashboard at http://localhost:3000/)
cargo run
```

### Development Loop (hot reload)
```bash
# Terminal 1 – backend
cargo run

# Terminal 2 – frontend
cd client
npm run dev   # Vite dev server on http://localhost:5173
```
The dev server proxies WebSocket traffic to `ws://localhost:3000/ws`, so keep the backend running.

## Publishing Telemetry
- **HTTP:** POST a `WaggleData` JSON object to `/batch`. The backend converts embedded PNGs to 500×500 JPG thumbnails and stores up to 10 recent frames while clients are disconnected.
- **WebSocket:** Connect to `/ws`, send any message to mark the client ready, and the server will start streaming JSON arrays of frames at up to 100 Hz.

Minimal example:
```jsonc
{
  "sent_timestamp": 1728000000,
  "graph_data": {
    "Battery Voltage": [
      { "x": 1728000000.0, "y": 12.6 }
    ]
  },
  "string_data": {
    "Mode": { "value": "Autonomous" }
  }
}
```
See `docs/api.md` for the full schema (images, SVG overlays, robot pose data, etc.).

## Tooling
- `cargo run --example simulator` — generates fake telemetry to exercise the dashboard without hardware.
- `tools/replay.py` — replays saved telemetry into a live Waggle instance (requires Python 3).
- `tools/export_video.py` — exports replayed image streams as numbered JPG sequences.

## Testing & Linting
- Backend: `cargo fmt` and `cargo clippy --all-targets`.
- Frontend: `npm run lint --prefix client` and `npm run build --prefix client`.

## Contribution Checklist
- Run the formatting/linting commands above before opening a PR.
- Capture screenshots or short screencasts when changing UI behavior.
- Keep `docs/` in sync with new API fields or workflow changes.
- Coordinate schema or dashboard updates with team lead and the hive team so downstream consumers stay aligned.
