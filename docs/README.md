# Waggle Documentation

This directory contains the canonical documentation for Waggle. The goal is to make it straightforward for robotics teams to deploy the dashboard, integrate telemetry publishers, and extend the system.

## Table of Contents
- [Audience](#audience)
- [System Overview](#system-overview)
- [Backend Service](#backend-service)
- [Frontend Dashboard](#frontend-dashboard)
- [Telemetry Schema](#telemetry-schema)
- [Data Producers](#data-producers)
- [Replays and Analysis](#replays-and-analysis)
- [Deployment Notes](#deployment-notes)
- [Troubleshooting](#troubleshooting)
- [Glossary](#glossary)

## Audience
This documentation targets:
- Operators who need to set up Waggle on a robot or competition field computer.
- Developers who want to extend the Rust backend or React dashboard.
- Data engineers building publishers that stream telemetry into Waggle.

## System Overview
Waggle is made up of three conceptual pieces:
1. **Telemetry producers** (robots, simulators, scripts) POST batches of telemetry frames to the backend.
2. **Rust backend** buffers and normalizes frames, then forwards them over WebSockets.
3. **React dashboard** renders graphs, camera feeds, SVG overlays, and key/value pairs in the browser.

When no clients are connected, the backend keeps a rolling buffer of the latest 10 batches. Once a browser connects and sends any message, the server drains the buffer and resumes streaming at up to 100 frames per second.

## Backend Service
- Source: `src/main.rs`.
- Frameworks: Axum, Tokio, and Tower HTTP for static asset serving.
- Concurrency model: Tokio tasks, `parking_lot::Mutex` for lightweight locking, and `mpsc::UnboundedSender` channels per client.

### Request lifecycle
1. Telemetry POST to `/batch` is parsed into `WaggleData`.
2. Each `ImageData` payload is decoded from base64 PNG, resized to 500×500, re-encoded as JPG, and placed back into the struct.
3. The batch is appended to the shared buffer (`Vec<WaggleData>` capped at 10 entries).
4. A periodic task (100 Hz) checks if any client has signaled readiness and, if so, serializes buffered frames into JSON and broadcasts them to every connected WebSocket.
5. Disconnected clients are pruned automatically if their send channel errors.

### Static asset serving
The backend serves the built React bundle from `client/dist`. Any unknown HTTP route falls back to this directory, allowing the SPA router to handle navigation.

### Tuning knobs
- Buffer size (currently 10 frames) and FPS ticker (100 Hz) are hardcoded but easy to adjust in `src/main.rs`.
- Image resizing dimensions (500×500) are defined where `thumbnail` is invoked. Adjust if your use case demands higher fidelity.

## Frontend Dashboard
- Source: `client/src`.
- Built with React, Tailwind, and Recharts via Vite tooling.
- Bundled build artifacts live in `client/dist` and are served automatically by the backend.

### Core behaviors
- `client/src/hooks/useWebSocket.ts` manages WebSocket connections, reconnection strategy, FPS instrumentation, and in-memory stores.
- Graph tiling is on-demand: clicking a metric in the "Sensor readings" section toggles an interactive chart powered by Recharts (`client/src/components/LiveGraph.tsx`).
- CSV export uses `client/src/csvHelper.ts` to flatten all graph series into a single file.
- Dark mode preference is stored in `localStorage` and respects system defaults on first load.

### Customization tips
- Add new visualization cards by extending `App.tsx` with additional components that consume `graphData`, `imageData`, etc.
- To surface `robot_position`, create a component that reads `robotPosition` from the hook and renders on a field map.
- Tailwind styles can be modified in `client/src/index.css`.

## Telemetry Schema
The wire format is documented in depth in [api.md](api.md). Quick summary:

| Field | Type | Description |
| ----- | ---- | ----------- |
| `sent_timestamp` | integer/float | Timestamp when the data was captured. |
| `images` | map<string, ImageData> | Base64-encoded PNG bytes with optional display settings. |
| `svg_data` | map<string, SvgData> | Raw SVG markup rendered directly on the page. |
| `graph_data` | map<string, GraphPoint[]> | Numeric series plotted over time. Supports the `settings.clear_data` flag. |
| `string_data` | map<string, StringData> | Key/value entries shown as text. |
| `robot_position` | object | Optional pose data (`x`, `y`, `heading`). |

All fields are optional except `sent_timestamp`. Empty maps are fine if you only publish a subset of the data types.

## Data Producers
### Rust example
Run the simulator to see Waggle in action without hardware:

```bash
cargo run --example simulator
```

The example publishes cosine graphs, rotating SVGs, and random strings at ~60 FPS. Open the dashboard to observe the feed.

### Python snippet
```python
import json
import time
import base64
import requests

payload = {
    "sent_timestamp": time.time(),
    "graph_data": {
        "Temperature": [{"x": time.time(), "y": 28.2}]
    },
    "string_data": {
        "Mode": {"value": "Autonomous"}
    }
}

requests.post("http://localhost:3000/batch",
              data=json.dumps(payload),
              headers={"Content-Type": "application/json"})
```

### Performance considerations
- Keep batch sizes small (ideally a single frame per request) to minimize latency.
- The server will silently drop images it cannot decode; check logs if an image fails to display.
- Send numeric timestamps in seconds or milliseconds—both work as floats in JavaScript.

## Replays and Analysis
- `tools/replay.py` replays saved telemetry using a curses UI. Useful for debugging or demonstrations.
- `tools/export_video.py` exports image streams to numbered JPG frames (per stream).
- Replay files expect a first line containing `"schema 1"` followed by newline-delimited JSON documents.
- To create replays, have producers set `save_replay=true` (if implemented in your fork) or mirror `/batch` traffic into a file.

## Deployment Notes
- The default listener is `0.0.0.0:3000`. Use `RUST_LOG=info cargo run --release` for production.
- Behind a reverse proxy (nginx, Caddy, etc.), ensure WebSocket upgrade headers are forwarded.
- HTTPS termination should happen at the proxy; the built-in server only speaks HTTP.
- For multi-machine setups, either build the frontend and serve it via the backend or host the Vite bundle separately and configure the frontend to talk to the remote backend.

## Troubleshooting
- **Dashboard says "Disconnected":** confirm the backend is reachable on port 3000 and CORS/firewalls permit WebSocket traffic.
- **Graphs freeze:** WebSocket reconnection attempts back off exponentially up to 20 tries. Check the browser console and backend logs.
- **Images look blurry:** Increase the resize target in `src/main.rs` (`decoded.thumbnail(…)`) or publish higher-resolution base64 data.
- **High latency:** Reduce publish rate or payload size; each frame is broadcast to every client, so large images can saturate the pipeline.

## Glossary
- **Batch:** One HTTP POST payload containing zero or more telemetry frames.
- **Frame:** The logical unit of telemetry forwarded to the UI in a single broadcast.
- **Producer:** Any program that POSTs to `/batch`.
- **Consumer:** A WebSocket client that renders Waggle data (typically the React dashboard).
- **Replay:** Offline capture that can be re-sent to the backend for analysis.

