# Waggle

Real‑time telemetry and visualization stack used by the CU Robotics team to inspect live robot data streams. The backend is a Rust/Axum service that buffers telemetry frames and broadcasts them over WebSockets, while the frontend is a React + Vite dashboard that renders plots, camera feeds, SVG overlays, and string telemetry at human‑friendly rates.

## Table of Contents
- [Overview](#overview)
- [Features](#features)
- [Repository Layout](#repository-layout)
- [Quick Start](#quick-start)
- [Running in Development](#running-in-development)
- [Sending Telemetry](#sending-telemetry)
- [Built-in Tools](#built-in-tools)
- [Testing and Linting](#testing-and-linting)
- [Contributing](#contributing)
- [License](#license)

## Overview
Waggle sits between your robot (or any data producer) and a web dashboard. Producers post batches of telemetry to the `/batch` HTTP endpoint. The backend throttles, normalizes, and buffers payloads before pushing them to any connected browsers via a WebSocket (`/ws`). The React client lets operators toggle individual graphs, inspect string values, render SVG overlays, and view camera frames provided as base64 images.

## Features
- Rust backend using Axum/Tokio with WebSocket fan‑out and JPG downscaling for image payloads.
- React + Tailwind + Recharts dashboard with live graph selection, dark/light mode, and CSV export.
- Simple JSON schema for graphs, text, images, SVG overlays, and optional robot pose data.
- Batch buffer that retains the most recent 10 frames while clients are disconnected, then replays on reconnect.
- Example simulator and replay/export utilities to test without hardware.

## Repository Layout
- `src/` – Rust backend (`main.rs`) and crate exports.
- `client/` – React dashboard (Vite app). `dist/` contains the production bundle served by the backend.
- `examples/simulator.rs` – Async Rust example that publishes fake data to Waggle at ~60 FPS.
- `docs/` – In-depth user and developer documentation (see [docs/README.md](docs/README.md)).
- `tools/` – Helper scripts for installing dependencies, replaying saved telemetry, and exporting image sequences.

## Quick Start
### Prerequisites
- [Rust toolchain](https://rustup.rs/) (edition 2024; Rust 1.78 or newer recommended).
- [Node.js 20+](https://nodejs.org/) (or install via the provided `tools/install.sh`).
- npm (ships with Node).

### First-time setup
```bash
# Install frontend dependencies
npm install --prefix client

# Build the production dashboard bundle served by the backend
npm run build --prefix client
```

### Launch everything
```bash
# In the repository root
cargo run
```

The server listens on `0.0.0.0:3000`. Point a browser at `http://localhost:3000/` to open the dashboard. When a client connects it will report `Connected` in the header once the WebSocket handshake succeeds.

## Running in Development
During iterative development you typically run the backend and Vite dev server separately:

```bash
# Terminal 1 (Rust service; auto-reloads on rebuild)
cargo run

# Terminal 2 (React dev server with HMR on port 5173)
cd client
npm run dev
```

Visit `http://localhost:5173` for the hot-reloading dashboard. The dev server proxies WebSocket requests to the default backend host (`ws://localhost:3000/ws`), so ensure the Rust process is running.

### Environment Variables
- `RUST_LOG=debug cargo run` enables verbose backend logging.
- `WAGGLE_WS_URL` (frontend) is currently inferred from `window.location.host`. To target a remote backend, launch the dashboard via production build or host the Vite dev server behind a proxy that rewrites API requests.

## Sending Telemetry
Producers POST batches of telemetry frames to `/batch`. Each payload is represented by the `WaggleData` structure; the backend converts any attached PNG images to 500×500 JPG thumbnails to keep network usage low before forwarding to browsers.

### HTTP Batch Endpoint (`POST /batch`)
```json
{
  "sent_timestamp": 1728000000,
  "images": {
    "Front Camera": { "image_data": "<base64 png>", "scale": 1, "flip": false }
  },
  "svg_data": {
    "Field Overlay": { "svg_string": "<svg>…</svg>" }
  },
  "graph_data": {
    "Battery Voltage": [
      { "x": 1728000000.0, "y": 12.6 },
      { "x": 1728000001.0, "y": 12.5 }
    ]
  },
  "string_data": {
    "Mode": { "value": "Autonomous" },
    "Status": { "value": "Ready" }
  },
  "robot_position": { "x": 2.1, "y": 4.8, "heading": 0.52 }
}
```

- `sent_timestamp`: milliseconds or seconds since epoch (numeric).
- `images`: map of name → `{ image_data, scale, flip }`. Supply PNG (the server re-encodes to JPG).
- `svg_data`: map of name → `{ svg_string }`. Rendered raw in the browser.
- `graph_data`: map of series name → array of `{ x, y, settings? }`. Setting `settings.clear_data` to true in a datapoint clears that series before adding the next point.
- `string_data`: map of name → `{ value }` for key/value widgets.
- `robot_position` (optional): displayed by consumers that support pose visualization (front-end stores but does not yet render pose).

Use JSON bodies (`Content-Type: application/json`). Example using `curl`:

```bash
curl -X POST http://localhost:3000/batch \
  -H "Content-Type: application/json" \
  -d @payload.json
```

### WebSocket Stream (`GET /ws`)
- Clients connect to receive live updates. Each message is a JSON array of `WaggleData` frames.
- New clients receive buffered frames (up to the most recent 10 batches) once a message is sent from the frontend to mark the connection ready.
- The backend pushes frames at up to 100 Hz while data is available. If the client disconnects, frames continue buffering until the max history is reached.

#### Browser Client Expectations
- Send any message (e.g., `"Hello from client"`) after connecting to signal readiness.
- Handle empty arrays—these indicate no new data but keep the heartbeat alive.
- The built-in React hook (`client/src/hooks/useWebSocket.ts`) demonstrates the intended flow, including reconnection and FPS instrumentation.

## Built-in Tools
- `examples/simulator.rs` – Generates synthetic graph/SVG/string data at 60 FPS. Run with `cargo run --example simulator`.
- `tools/replay.py` – Terminal UI that replays saved telemetry logs into a live Waggle instance (supports stepping forward/backward). Requires Python 3, `curses`, and `requests`.
- `tools/export_video.py` – Converts replay files into JPG sequences per image stream.
- `tools/install.sh` – Convenience script to install Node 20, Go, and JavaScript dependencies on Ubuntu-based systems.

## Testing and Linting
- Rust formatting: `cargo fmt`.
- Rust linting: `cargo clippy --all-targets`.
- Frontend formatting: `npm run lint --prefix client`.
- Frontend tests (if/when added): `npm test --prefix client`.

CI is not yet configured; running the commands above locally is recommended before submitting changes.

## Contributing
Pull requests are welcome for new data visualizations, protocol extensions, and tooling. Please open an issue first when proposing substantial API changes so downstream consumers (robot firmware, controllers, etc.) can coordinate deployment.

1. Fork and clone the repository.
2. Create a feature branch.
3. Make your changes, keeping documentation up to date.
4. Run the formatting/linting commands listed above.
5. Open a PR describing the changes and any testing performed.

## License
This project is licensed under the [MIT License](LICENSE).

