# Waggle API Reference

This document describes the network interfaces exposed by the Waggle backend. All routes are rooted at `http://<host>:3000/` unless configured otherwise.

## Table of Contents
- [Endpoints](#endpoints)
- [Telemetry Schema](#telemetry-schema)
- [Graph Settings](#graph-settings)
- [Versioning](#versioning)

## Endpoints

### `POST /batch`
Accepts a single telemetry batch encoded as JSON. The body must be valid UTF-8.

- **Headers:** `Content-Type: application/json`
- **Response:** `200 OK` on success, `4xx` on malformed input.
- **Rate:** Designed for up to 100 frames per second; higher rates may be dropped once the buffer fills.

Example:

```json
{
  "sent_timestamp": 1730000000,
  "graph_data": {
    "Motor RPM": [
      { "x": 1730000000.0, "y": 123.4 }
    ],
    "Battery Voltage": [
      { "x": 1730000000.0, "y": 12.7, "settings": { "clear_data": false } }
    ]
  },
  "images": {
    "Front Camera": {
      "image_data": "<base64 png string>",
      "scale": 1,
      "flip": false
    }
  },
  "svg_data": {
    "Field Overlay": {
      "svg_string": "<svg>...</svg>"
    }
  },
  "string_data": {
    "Mode": { "value": "Autonomous" },
    "Status": { "value": "Ready" }
  },
  "robot_position": {
    "x": 1.25,
    "y": 3.42,
    "heading": 0.87
  }
}
```

#### Error handling
- Invalid JSON results in `400 Bad Request`.
- Images that fail to decode are skipped; the response still returns `200 OK`. Backend logs contain details.
- Oversized payloads may be rejected by the reverse proxy if one is placed in front of Waggle.

### `GET /ws`
WebSocket endpoint used by dashboards and other consumers to receive live telemetry.

- **Protocol:** ws / wss (if proxied).
- **Messages:** JSON-encoded arrays of `WaggleData` objects.
- **Client responsibilities:**
  - Send a message (any string) immediately after connecting to mark the socket ready to receive data.
  - Handle `[]` (empty arrays) which are used as keep-alives.
  - Reconnect if the socket closes; see `client/src/hooks/useWebSocket.ts` for a reference implementation.

Example message delivered to clients:

```json
[
  {
    "sent_timestamp": 1730001234,
    "graph_data": {
      "Motor RPM": [
        { "x": 1730001234.0, "y": 120.0 },
        { "x": 1730001234.1, "y": 119.4 }
      ]
    },
    "images": {},
    "svg_data": {},
    "string_data": {}
  }
]
```

### Static assets
Any other HTTP request falls back to serving files from `client/dist`. This allows the React single-page application to be hosted on the same origin.

## Telemetry Schema

| Field | Type | Required | Notes |
| ----- | ---- | -------- | ----- |
| `sent_timestamp` | number | ✓ | Epoch in seconds or milliseconds. |
| `graph_data` | object | optional | Map of series name → array of [`GraphPoint`](#graphpoint). |
| `images` | object | optional | Map of name → [`ImageData`](#imagedata). |
| `svg_data` | object | optional | Map of name → [`SvgData`](#svgdata). |
| `string_data` | object | optional | Map of name → [`StringData`](#stringdata). |
| `robot_position` | object | optional | [`RobotPosition`](#robotposition). Stored by the frontend; UI components can visualize it. |

### `GraphPoint`
```json
{ "x": <number>, "y": <number>, "settings": { "clear_data": <bool> }? }
```

### `ImageData`
```json
{ "image_data": "<base64 png>", "scale": <number>, "flip": <bool> }
```
- Publish PNG data; the backend resizes to 500×500 and converts to JPG before sending to clients.
- `scale` controls the display size multiplier on the dashboard.
- `flip=true` indicates the UI should mirror the image horizontally and vertically.

### `SvgData`
```json
{ "svg_string": "<svg>...</svg>" }
```
- Provide valid inline SVG markup. The frontend injects it directly via `dangerouslySetInnerHTML`.

### `StringData`
```json
{ "value": "<string>" }
```
- Use for human-readable values (states, warnings, counters).

### `RobotPosition`
```json
{ "x": <number>, "y": <number>, "heading": <number> }
```
- Heading is measured in radians; consumers can convert as needed.

## Graph Settings
Each point accepts an optional `settings` object. Supported flags:

| Flag | Type | Description |
| ---- | ---- | ----------- |
| `clear_data` | boolean | If true, the frontend clears the series before pushing the next point. Useful for resetting integral plots without breaking continuity. |

Additional settings can be introduced in future versions; clients should ignore unknown fields.

## Versioning
The current payload format is equivalent to `"schema 1"` in replay files. Breaking changes will increment the schema and be documented here. Consumers should reject replays that do not start with `schema 1` as their first line.

